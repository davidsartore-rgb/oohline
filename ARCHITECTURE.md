# Architecture — OOH Line

## Overview

OOH Line is a B2B poster-printing catalogue and price calculator for the Swiss OOH/MOOH advertising market. It is a single-origin web application: Fastify serves both the static React frontend and a REST API from the same process on port 3000.

```
Browser
  │
  ├── HTTPS ──► Nginx (reverse proxy, TLS termination, rate-limit)
  │                │
  │                └──► Fastify :3000 (Node.js 20)
  │                        │
  │                        ├── Static: project/ (React/Babel, plain HTML)
  │                        ├── /api/public/*   (catalogue, pricing, quotes)
  │                        ├── /api/auth/*     (login, 2FA, recovery)
  │                        └── /api/admin/*    (CRUD, config, audit)
  │                                │
  │                                └──► MariaDB 10.6 (via Prisma ORM)
  │
  └── SMTP ──► nodemailer → Hostinger SMTP (or Postmark)
```

---

## Frontend

The frontend is a **no-build-step React/Babel prototype** served as static HTML. All JSX is compiled in the browser via `@babel/standalone`. Scripts are loaded via `<script>` tags; no bundler, no npm in the frontend.

### Key frontend files

| File | Purpose |
|---|---|
| `project/OOH Catalogue.html` | Entry point — loads all scripts and renders `<div id="root">` |
| `project/src/app.jsx` | Root React component, routing (hash-based), admin shell |
| `project/src/db.js` | Data layer: localStorage cache + API refresh/sync |
| `project/src/auth.js` | Auth layer: session cookie + API calls |
| `project/src/pricing.js` | Client-side price calculator (UI only — never trusted by server) |
| `project/src/quote.jsx` | Quote request modal — POSTs to `/api/public/quote-requests` |
| `project/src/io.js` | XLSX/CSV import-export — server-side export in admin mode |

### Data flow

1. On mount, `DB.refresh()` fetches `/api/public/catalog` (public) or `/api/admin/full-config` (admin).
2. Data is stored in `localStorage` as a cache for instant subsequent loads.
3. Admin saves call `DB.save(db)` which writes to `localStorage` and fire-and-forgets `PUT /api/admin/config`.
4. The server is the source of truth; the cache is refreshed on every page load.

---

## Backend

### Technology choices

| Choice | Reason |
|---|---|
| **Fastify 4** | Fast, low overhead, first-class async/await, good plugin ecosystem |
| **MariaDB 10.6 + Prisma** | Hostinger Business includes MariaDB; Prisma provides type-safe queries and migrations |
| **Argon2id** | Best-practice password hashing (memory-hard, side-channel resistant) |
| **HttpOnly session cookies** | Prevents XSS token theft; no JWTs in localStorage |
| **speakeasy TOTP** | RFC 6238 TOTP 2FA, compatible with any authenticator app |

### Directory structure

```
backend/
├── src/
│   ├── server.js         # Fastify app, plugin registration, crons
│   ├── prisma.js         # PrismaClient singleton
│   ├── pricing.js        # Server-side pricing engine (mirrors frontend)
│   ├── email.js          # nodemailer abstraction (SMTP / Postmark)
│   ├── audit.js          # Audit log helper
│   └── routes/
│       ├── public.js     # Unauthenticated API routes
│       ├── auth.js       # Login, logout, 2FA, recovery
│       └── admin.js      # Protected admin CRUD
├── prisma/
│   ├── schema.prisma     # Database schema
│   ├── migrations/       # Auto-generated migration SQL
│   └── seed.js           # Initial data (formats, papers, tiers, admin user)
├── .env.example          # All required environment variables
└── package.json
```

### Authentication

```
Login flow:
  POST /api/auth/login
    → Argon2id verify password
    → Check lockout (5 failures → 15 min lock)
    → If totp_enabled: return { require2fa: true }
    → Else: create session (crypto.randomBytes(32), SHA-256 hashed in DB)
    → Set HttpOnly cookie "sid" (Secure, SameSite=Strict, 7 days)

2FA flow (if enabled):
  POST /api/auth/login/2fa
    → Verify TOTP code via speakeasy
    → Or verify backup code (Argon2id, single-use)
    → Create session, set cookie

Session middleware (authenticate preHandler):
  → Read "sid" cookie
  → SHA-256 hash it
  → Look up in admin_sessions (check expires_at)
  → Slide expiry by 12h
  → Attach user to request.user

Recovery flow:
  POST /api/auth/recovery/start { email }
    → Look up admin user by recovery_email
    → Generate 32-byte token, store SHA-256 hash with 24h expiry
    → Email magic link: https://oohline.ch/#recover=TOKEN

  POST /api/auth/recovery/complete { token, newPassword, newUsername? }
    → SHA-256 hash token, look up in DB
    → Verify not expired, not used
    → Argon2id hash new password, update user
    → Mark token used, invalidate all existing sessions
```

### Pricing invariant

**The server never trusts client-computed prices.** Every quote submission triggers a full server-side recomputation in `backend/src/pricing.js`, which mirrors the frontend `project/src/pricing.js` exactly. The client sends `{ formatCode, paperId, quantity, subjects, express }` — never totals.

### Config management

Admin config is stored normalized across many tables (sections, formats, papers, etc.). The frontend works with a denormalized "DB object" (the same shape as `DEFAULT_DB` in `db.js`). The `applyFullConfig()` function in `routes/admin.js` handles the translation: it accepts the frontend DB object and applies it to all tables atomically in a Prisma transaction.

```
Frontend DB shape                    Database tables
─────────────────                    ───────────────
db.sections[]              ←→        Section
db.formats[]               ←→        Format + Section.id FK
db.papers[]  (with formats[])  ←→   Paper + FormatPaper (join table)
db.tiers[]   ({ from, discount })  ←→  VolumeTier
db.subjects[]              ←→        SubjectFee
db.express_surcharge_pct   ←→        Setting("express_surcharge_pct")
db.page_texts              ←→        PageText
db.legal_pages             ←→        LegalPage
db.header                  ←→        HeaderConfig
db.footer                  ←→        FooterConfig
```

### Security layers

| Layer | Mechanism |
|---|---|
| TLS | Nginx + Let's Encrypt (HSTS preload) |
| Headers | `@fastify/helmet` (CSP, X-Frame-Options, etc.) + Nginx add_header |
| Rate limiting | `@fastify/rate-limit`: 5/15min on login, 3/h on quote requests |
| Account lockout | 5 failed logins → 15-minute lock (tracked in DB) |
| CSRF | SameSite=Strict cookies; all state-changing requests require valid session |
| Input validation | Zod schemas on all API inputs |
| SQL injection | Parameterized queries via Prisma (no raw SQL) |
| XSS | CSP + HttpOnly cookies (no tokens accessible from JS) |
| Audit log | Every admin write action recorded in `audit_log` |

### GDPR / nLPD compliance

- Quote requests store `consent_at` (timestamp) and `consent_ip`
- Quotes expire after 90 days; a daily cron deletes expired records
- Privacy policy and cookie policy are editable via the admin panel
- Cookie consent banner is configurable (on/off) from admin settings
- No third-party analytics or tracking scripts

---

## Database schema (summary)

```
Section ──< Format >──< FormatPaper >── Paper
                                            │
VolumeTier     (quantity discount brackets) │
SubjectFee     (per-subject file fee)       │
Setting        (key-value config)           │
PageText       (catalogue/calculator page headings)
LegalPage      (privacy, legal, cookies — rich text)
HeaderConfig   (logo, brand name, language toggle)
FooterConfig   (footer sections as JSON)

AdminUser ──< AdminSession
          ──< RecoveryToken

QuoteRequest   (submitted quote forms — expires after 90 days)
AuditLog       (append-only admin action log)
```

All monetary values are stored in CHF. Percentages are stored as decimals (e.g. `0.081` for 8.1% VAT).

---

## Cron jobs (in-process)

| Job | Schedule | Action |
|---|---|---|
| Session cleanup | Hourly | `DELETE FROM admin_sessions WHERE expires_at < NOW()` |
| Quote expiry | Daily at 02:00 | `DELETE FROM quote_requests WHERE expires_at < NOW()` |

These run inside the Fastify process via `setInterval` / `setTimeout`. For high-traffic sites, move them to a separate cron process or database event.

---

## Email

`backend/src/email.js` provides a nodemailer abstraction. The transport is selected by environment:

- **Default**: Hostinger SMTP (`smtp.hostinger.com:465`, SSL)
- **Postmark**: Set `POSTMARK_API_KEY` in `.env` to use Postmark's SMTP bridge instead

Four email templates (plain text, bilingual FR/EN):

| Function | Trigger | Recipient |
|---|---|---|
| `sendQuoteInternal` | Quote submitted | `CONTACT_EMAIL` |
| `sendQuoteConfirmation` | Quote submitted | Customer |
| `sendRecoveryLink` | Recovery started | Admin recovery email |
| `send2FABackupCodes` | 2FA enabled | Admin recovery email |
