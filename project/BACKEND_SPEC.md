# Backend specification — AfficheOOH catalogue

> Audience: a Claude Code session (or any developer) tasked with replacing the
> current client-side-only prototype with a production-ready stack.

## 1. Context

The current implementation is a **static HTML/React prototype** that runs
entirely in the browser. The pricing database, admin credentials and quote
requests live in `localStorage` / `sessionStorage` / `mailto:`. This is fine
for demos and internal use over a trusted network, but **not for production**.

This document describes the target architecture, the API surface to build, the
security requirements and the migration path from the prototype.

## 2. Target architecture

Recommended stack (pick the closest one your team is comfortable with):

| Layer       | Recommendation                              | Alternatives                  |
|-------------|---------------------------------------------|-------------------------------|
| Runtime     | **Node.js 20 LTS**                          | Python 3.12, PHP 8.2          |
| Framework   | **Fastify** or **Express**                  | NestJS, Django, Laravel       |
| Database    | **PostgreSQL 16**                           | MySQL 8                       |
| ORM         | **Prisma**                                  | Drizzle, Knex                 |
| Auth        | Argon2 hashing + cookie session             | JWT (only if SPA-on-CDN)      |
| Mail        | **Postmark** or **SendGrid**                | AWS SES                       |
| Hosting     | **Hostinger VPS** (KVM 2+ recommandé)       | Infomaniak (CH), Exoscale (CH), Hetzner |
| Storage     | Local FS for uploaded artworks              | S3-compatible (Cloudflare R2) |
| Observability | **Sentry** (errors) + Pino logs           | Datadog                       |

Keep the static front-end (`OOH Catalogue.html` + `src/*`) and serve it from
the same origin as the API to avoid CORS complexity. The current React code
can be migrated to a Vite project if desired but it works as-is.

```
┌────────────────────────────────────────────────────────────────────┐
│ Browser (catalogue / calculator / admin)                          │
└─────────────┬──────────────────────────────────────────────────────┘
              │ HTTPS, session cookie (HttpOnly, Secure, SameSite=Lax)
              ▼
┌────────────────────────────────────────────────────────────────────┐
│ Reverse proxy: Nginx / Caddy — TLS, HSTS, CSP, rate-limit         │
└─────────────┬──────────────────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────────────────────────┐
│ Node.js API (Fastify)                                              │
│ ├── /api/public/*    (no auth)                                     │
│ ├── /api/admin/*     (cookie session)                              │
│ └── /api/auth/*      (login / logout / recovery)                   │
└─────────────┬──────────────────────────────────────────────────────┘
              │
       ┌──────┴─────────┐
       ▼                ▼
   PostgreSQL       Postmark
                     (transactional email)
```

## 3. Data model

```sql
-- Pricing database (admin-editable)
CREATE TABLE formats (
  code           TEXT PRIMARY KEY,            -- e.g. 'F4'
  name_fr        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  width_cm       NUMERIC(6,1) NOT NULL,
  height_cm      NUMERIC(6,1) NOT NULL,
  base_price_chf NUMERIC(10,2) NOT NULL,
  desc_fr        TEXT,
  desc_en        TEXT,
  display_order  INT DEFAULT 0,
  archived_at    TIMESTAMPTZ
);

CREATE TABLE papers (
  id          TEXT PRIMARY KEY,
  name_fr     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  factor      NUMERIC(5,3) NOT NULL DEFAULT 1.000,
  display_order INT DEFAULT 0
);

CREATE TABLE format_papers (   -- many-to-many; many papers can serve a format
  format_code TEXT REFERENCES formats(code) ON DELETE CASCADE,
  paper_id    TEXT REFERENCES papers(id) ON DELETE CASCADE,
  priority    INT DEFAULT 0,    -- lowest priority wins as the default paper
  PRIMARY KEY (format_code, paper_id)
);

CREATE TABLE volume_tiers (
  id            SERIAL PRIMARY KEY,
  from_quantity INT NOT NULL,
  discount_pct  NUMERIC(5,2) NOT NULL
);

CREATE TABLE subject_fees (
  id        SERIAL PRIMARY KEY,
  count     INT NOT NULL,
  fee_chf   NUMERIC(10,2) NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
-- seed: ('express_surcharge_pct', '22'), ('vat_rate', '0.081')

-- Admin users
CREATE TABLE admin_users (
  id            SERIAL PRIMARY KEY,
  username      CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,             -- argon2id
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  failed_logins INT DEFAULT 0,
  locked_until  TIMESTAMPTZ
);

-- Quote requests (replaces the mailto: prototype)
CREATE TABLE quote_requests (
  id             SERIAL PRIMARY KEY,
  reference      TEXT UNIQUE NOT NULL,     -- e.g. 'OOH-2026-1234'
  format_code    TEXT NOT NULL,
  paper_id       TEXT,
  quantity       INT NOT NULL,
  subjects       INT NOT NULL,
  express        BOOLEAN NOT NULL DEFAULT false,
  computed_ht    NUMERIC(10,2) NOT NULL,   -- server-recomputes (never trust client)
  computed_ttc   NUMERIC(10,2) NOT NULL,
  company        TEXT NOT NULL,
  contact_name   TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  message        TEXT,
  consent_at     TIMESTAMPTZ NOT NULL,     -- GDPR/nLPD audit trail
  consent_ip     INET,
  status         TEXT DEFAULT 'new',       -- new | quoted | won | lost | dropped
  created_at     TIMESTAMPTZ DEFAULT now(),
  expires_at     TIMESTAMPTZ DEFAULT (now() + interval '12 months')
);
CREATE INDEX ON quote_requests (created_at);
CREATE INDEX ON quote_requests (status);

-- Audit log (compliance + debugging)
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  at          TIMESTAMPTZ DEFAULT now(),
  actor       TEXT NOT NULL,        -- admin username or 'system'
  action      TEXT NOT NULL,        -- e.g. 'format.update', 'auth.login.failed'
  target      TEXT,                 -- e.g. 'formats:F12'
  before      JSONB,
  after       JSONB,
  ip          INET,
  user_agent  TEXT
);
```

Run a daily cron to delete `quote_requests` older than `expires_at` (nLPD/RGPD
retention). Keep accounting-relevant invoices in a separate table with the
10-year retention required by Swiss `CO art. 957`.

## 4. API surface

All responses are JSON. Errors follow `{ error: { code, message } }`.

### Public

```
GET  /api/public/formats             → [{code, name_fr, name_en, width_cm, height_cm, base_price_chf, paper}]
GET  /api/public/papers              → [{id, name_fr, name_en, factor}]   (factors only; not always exposed)
GET  /api/public/pricing-config      → {tiers, subjects, express_surcharge_pct, vat_rate}
POST /api/public/quote-requests      → {reference}   ← creates a quote
                                       Body: {formatCode, quantity, subjects, express,
                                              company, contactName, email, phone?, message?,
                                              consent: true}
                                       Server recomputes price; client-supplied total is ignored.
                                       Triggers email to {CONFIG.contact_email} and to the client.
```

### Auth

```
POST /api/auth/login                 → {ok: true}    sets HttpOnly cookie
POST /api/auth/logout                → {ok: true}
POST /api/auth/recovery/start        → {ok: true}    Sends magic link to admin email
POST /api/auth/recovery/complete     → {ok: true}    body: {token, newPassword}
GET  /api/auth/me                    → {username}    401 if not logged in
POST /api/auth/change-password       → {ok: true}    body: {oldPassword, newPassword}
```

### Admin (cookie session required)

```
GET    /api/admin/formats              → list
POST   /api/admin/formats              → create
PATCH  /api/admin/formats/:code        → update
DELETE /api/admin/formats/:code        → soft delete (set archived_at)

GET    /api/admin/papers               → list
POST/PATCH/DELETE  /api/admin/papers/...

GET    /api/admin/volume-tiers         → list
PUT    /api/admin/volume-tiers         → replace entire set (atomic)

GET    /api/admin/subject-fees         → list
PUT    /api/admin/subject-fees         → replace entire set

GET    /api/admin/settings             → key/value map
PATCH  /api/admin/settings             → partial merge

GET    /api/admin/quote-requests       → paginated list, filters: status, dateRange, search
GET    /api/admin/quote-requests/:id   → detail
PATCH  /api/admin/quote-requests/:id   → update status

POST   /api/admin/import               → multipart, accepts .xlsx / .csv (same shape as prototype)
GET    /api/admin/export               → returns .xlsx workbook

GET    /api/admin/audit-log            → paginated
```

## 5. Security requirements

### Authentication

- **Argon2id** for password hashing (`crypto.argon2.hash()` in Node, params:
  `memoryCost: 19456, timeCost: 2, parallelism: 1`).
- Session cookie:
  ```
  Set-Cookie: sid=<random>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200
  ```
  Token: 256 bit random, stored hashed server-side. **Not a JWT.**
- **Account lockout**: 5 failed logins → lock for 15 minutes. Increment
  `failed_logins`; check `locked_until` before accepting password.
- **2FA (recommended)**: TOTP via `speakeasy` library; enroll from Admin → Compte.
- **Password recovery**: email-based magic link (24 h expiry, single-use,
  invalidated on use). **No more hardcoded recovery code.**

### Transport & headers

```
HTTPS only; redirect HTTP → HTTPS.
HSTS:                    max-age=63072000; includeSubDomains; preload
CSP:                     default-src 'self'; script-src 'self' 'unsafe-eval' (Babel); ...
X-Frame-Options:         DENY
X-Content-Type-Options:  nosniff
Referrer-Policy:         strict-origin-when-cross-origin
Permissions-Policy:      camera=(), microphone=(), geolocation=()
```

Use Helmet on the Node side and reinforce at the proxy.

### Input & abuse

- All POST/PATCH bodies validated with **Zod** schemas; reject extra fields.
- **Rate limits**:
  - `/api/auth/login`         → 5 req / 15 min / IP, 5 req / 15 min / username
  - `/api/public/quote-requests` → 3 req / hour / IP (anti-spam)
- **CSRF**: SameSite=Lax cookie + a synchronizer token on admin POST/PATCH.
- **Brute force IP**: optional fail2ban watching `audit_log` for failed logins.

### Server-side recompute

**Never trust the client's computed price.** When a quote is submitted, the
server reads the current pricing tables, computes `totalHT` and `totalTTC`,
and stores them. The email body uses the server-computed values. If the
client's total disagrees by more than 0.5 CHF, log it as suspicious.

## 6. Email

Use **Postmark** transactional templates (or SendGrid):

- `quote-request-internal`: sent to `CONFIG.contact_email`. Contains the full
  computed quote, the contact details and a one-click link to the admin
  detail page.
- `quote-request-confirmation`: sent to the customer. Contains the reference
  number, the same breakdown, the retention notice and contact info.

DKIM + SPF + DMARC must be configured on the sending domain.

## 7. Migration from prototype

The prototype already produces XLSX exports of the entire pricing database in
the exact column shape the backend should accept. The migration path is:

1. Stand up the Node + Postgres backend with empty tables.
2. From the prototype's Admin → Import/Export, download `ooh-pricing-*.xlsx`.
3. POST that file to `/api/admin/import` (one-off bootstrap endpoint, removed
   after migration).
4. Replace `src/db.js`, `src/io.js`, `src/auth.js` with thin `fetch()` wrappers
   that call the new API.
5. Remove the `mailto:` flow from `src/quote.jsx` — POST to
   `/api/public/quote-requests` instead and show the returned reference.

The React components in `src/catalog.jsx`, `src/calculator.jsx`,
`src/admin.jsx` need no behaviour change — only their data source.

## 8. nLPD / RGPD compliance checklist

- [ ] Mentions légales filled in (currently placeholders in `src/legal.jsx`)
- [ ] Hosting provider documented in mentions légales
- [ ] DPO / privacy contact email reachable (`CONFIG.privacy_email`)
- [ ] Cookies banner with explicit reject button (already implemented)
- [ ] Consent timestamp + IP stored on every quote (`quote_requests.consent_at`)
- [ ] Subject access request workflow documented internally
- [ ] Data retention cron in place (delete dropped quotes after N months)
- [ ] DPA signed with each subprocessor (email provider, hosting, error reporting)
- [ ] HTTPS + HSTS in place on production domain
- [ ] Audit log retention policy decided (recommend 24 months)

## 9. Operational notes

- Backups: daily encrypted Postgres dump to off-site storage, 30-day retention.
- Monitoring: uptime check + 4xx/5xx rate alerting + disk usage.
- Disaster recovery: documented RTO / RPO, restore tested quarterly.
- Updates: dependabot / renovate on; manual review for major upgrades.
- Logs: structured (JSON) via Pino; ship to a long-term store; redact PII.

## 10. Estimated effort

For a single experienced full-stack dev or Claude Code session, the build
breaks down roughly as:

| Phase                          | Effort |
|--------------------------------|--------|
| Project scaffold + auth + DB   | 2 d    |
| Pricing CRUD + admin endpoints | 2 d    |
| Quote submission + emails      | 1.5 d  |
| Frontend rewiring              | 1.5 d  |
| Hardening + headers + rate limits | 1 d |
| Deploy + monitoring + docs     | 1 d    |
| **Total**                      | **~9 working days** |

Add 2 days for 2FA, magic-link recovery and a basic admin dashboard of quote
requests if those are in scope.

---

*Document version: 1.0 — May 2026. Maintained alongside the prototype repo;
update whenever the pricing model or admin surface changes.*
