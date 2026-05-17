'use strict';
const crypto = require('crypto');
const argon2 = require('argon2');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { z } = require('zod');
const prisma = require('../prisma');
const { log: auditLog } = require('../audit');
const { sendRecoveryLink, send2FABackupCodes } = require('../email');

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setCookieOpts(reply, token, maxAge) {
  reply.setCookie('sid', token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax',
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: Math.floor((maxAge || SESSION_TTL_MS) / 1000),
  });
}

module.exports = async function authRoutes(fastify) {

  // POST /api/auth/login
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        keyGenerator: (req) => req.ip,
        errorResponseBuilder: () => ({
          error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again in 15 minutes.' },
        }),
      },
    },
  }, async (req, reply) => {
    const { username, password, totpCode } = req.body || {};
    if (!username || !password) {
      return reply.code(400).send({ error: { code: 'MISSING_FIELDS', message: 'Username and password required' } });
    }

    const user = await prisma.adminUser.findFirst({
      where: { username: { equals: String(username), mode: 'insensitive' } },
    });

    const ip = req.ip;
    const userAgent = req.headers['user-agent'] || '';

    if (!user) {
      await auditLog({ actor: String(username), action: 'auth.login.failed', target: 'users:' + username, ip, userAgent });
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
    }

    // Lockout check
    if (user.locked_until && user.locked_until > new Date()) {
      const mins = Math.ceil((user.locked_until - Date.now()) / 60000);
      await auditLog({ actor: user.username, action: 'auth.login.locked', ip, userAgent });
      return reply.code(423).send({
        error: { code: 'ACCOUNT_LOCKED', message: `Account locked. Try again in ${mins} minute(s).` },
      });
    }

    const valid = await argon2.verify(user.password_hash, String(password), ARGON2_OPTIONS).catch(() => false);

    if (!valid) {
      const fails = user.failed_logins + 1;
      const update = { failed_logins: fails };
      if (fails >= LOCKOUT_ATTEMPTS) {
        update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }
      await prisma.adminUser.update({ where: { id: user.id }, data: update });
      await auditLog({ actor: user.username, action: 'auth.login.failed', ip, userAgent });
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
    }

    // 2FA check (if enabled)
    if (user.totp_enabled && user.totp_secret) {
      if (!totpCode) {
        return reply.code(200).send({ require2fa: true });
      }
      const verified = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token: String(totpCode),
        window: 1,
      });
      // Check backup codes if TOTP failed
      if (!verified) {
        const backupCodes = user.backup_codes || [];
        const matchIndex = await findAndConsumeBackupCode(backupCodes, String(totpCode), user.id);
        if (matchIndex === -1) {
          await auditLog({ actor: user.username, action: 'auth.2fa.failed', ip, userAgent });
          return reply.code(401).send({ error: { code: 'INVALID_2FA', message: 'Invalid 2FA code' } });
        }
      }
    }

    // Success — create session
    const token = randomToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const sessionId = crypto.randomUUID();

    await prisma.adminSession.create({
      data: { id: sessionId, token_hash: tokenHash, user_id: user.id, expires_at: expiresAt, ip, user_agent: userAgent },
    });

    // Reset failed logins
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { failed_logins: 0, locked_until: null, last_login_at: new Date() },
    });

    await auditLog({ actor: user.username, action: 'auth.login.success', ip, userAgent });

    setCookieOpts(reply, token);
    return { ok: true, username: user.username };
  });

  // POST /api/auth/logout
  fastify.post('/logout', async (req, reply) => {
    const token = req.cookies.sid;
    if (token) {
      const tokenHash = hashToken(token);
      await prisma.adminSession.deleteMany({ where: { token_hash: tokenHash } }).catch(() => {});
    }
    reply.clearCookie('sid');
    return { ok: true };
  });

  // GET /api/auth/me
  fastify.get('/me', { preHandler: fastify.authenticate }, async (req) => {
    return {
      username: req.adminUser.username,
      totp_enabled: req.adminUser.totp_enabled,
      recovery_email: req.adminUser.recovery_email,
    };
  });

  // POST /api/auth/change-password
  fastify.post('/change-password', { preHandler: fastify.authenticate }, async (req, reply) => {
    const schema = z.object({
      oldPassword: z.string().min(1).optional(),
      newPassword: z.string().min(8).max(255),
      newUsername: z.string().min(3).max(100).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    }
    const { oldPassword, newPassword, newUsername } = parsed.data;

    if (oldPassword) {
      const valid = await argon2.verify(req.adminUser.password_hash, oldPassword, ARGON2_OPTIONS);
      if (!valid) return reply.code(401).send({ error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect' } });
    }

    const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);
    const update = { password_hash: passwordHash };
    if (newUsername) update.username = newUsername.trim();

    await prisma.adminUser.update({ where: { id: req.adminUser.id }, data: update });
    await auditLog({ actor: req.adminUser.username, action: 'auth.password.changed', ip: req.ip, userAgent: req.headers['user-agent'] });

    return { ok: true };
  });

  // POST /api/auth/recovery/start — send magic link
  fastify.post('/recovery/start', {
    config: {
      rateLimit: { max: 3, timeWindow: '1 hour', keyGenerator: (req) => req.ip },
    },
  }, async (req, reply) => {
    const { email } = req.body || {};
    // Always return ok to avoid user enumeration
    const user = await prisma.adminUser.findFirst({ where: { recovery_email: email } });
    if (user) {
      const token = randomToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.recoveryToken.deleteMany({ where: { user_id: user.id } });
      await prisma.recoveryToken.create({
        data: { id: crypto.randomUUID(), token_hash: tokenHash, user_id: user.id, expires_at: expiresAt },
      });
      const appUrl = process.env.APP_URL || 'https://oohline.ch';
      await sendRecoveryLink({ to: email, token, appUrl }).catch(err =>
        fastify.log.error({ err }, '[email] Failed to send recovery link')
      );
    }
    return { ok: true };
  });

  // POST /api/auth/recovery/complete — consume magic link + set new password
  fastify.post('/recovery/complete', async (req, reply) => {
    const schema = z.object({
      token: z.string().min(10),
      newPassword: z.string().min(8).max(255),
      newUsername: z.string().min(3).max(100).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    }
    const { token, newPassword, newUsername } = parsed.data;
    const tokenHash = hashToken(token);

    const rec = await prisma.recoveryToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!rec || rec.used_at || rec.expires_at < new Date()) {
      return reply.code(400).send({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
    }

    const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);
    const update = { password_hash: passwordHash, failed_logins: 0, locked_until: null };
    if (newUsername) update.username = newUsername.trim();

    await prisma.adminUser.update({ where: { id: rec.user_id }, data: update });
    await prisma.recoveryToken.update({ where: { id: rec.id }, data: { used_at: new Date() } });
    await auditLog({ actor: rec.user.username, action: 'auth.password.recovered', ip: req.ip, userAgent: req.headers['user-agent'] });

    return { ok: true };
  });

  // ── 2FA ────────────────────────────────────────────────────────────────────

  // POST /api/auth/2fa/setup — generate TOTP secret + QR code
  fastify.post('/2fa/setup', { preHandler: fastify.authenticate }, async (req) => {
    const secret = speakeasy.generateSecret({
      name: `OOH Line (${req.adminUser.username})`,
      length: 20,
    });
    // Store temporarily in DB (not yet enabled)
    await prisma.adminUser.update({
      where: { id: req.adminUser.id },
      data: { totp_secret: secret.base32, totp_enabled: false },
    });
    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
    return { secret: secret.base32, qrCode: qrDataUrl };
  });

  // POST /api/auth/2fa/verify — verify code + enable 2FA
  fastify.post('/2fa/verify', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { code } = req.body || {};
    const user = await prisma.adminUser.findUnique({ where: { id: req.adminUser.id } });
    if (!user.totp_secret) return reply.code(400).send({ error: { code: 'NO_SECRET', message: '2FA setup not started' } });

    const valid = speakeasy.totp.verify({
      secret: user.totp_secret, encoding: 'base32', token: String(code), window: 1,
    });
    if (!valid) return reply.code(400).send({ error: { code: 'INVALID_CODE', message: 'Invalid 2FA code' } });

    // Generate backup codes
    const rawCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
    const hashedCodes = await Promise.all(rawCodes.map(c => argon2.hash(c, ARGON2_OPTIONS)));

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { totp_enabled: true, backup_codes: hashedCodes },
    });

    // Email backup codes
    const adminEmail = user.recovery_email;
    if (adminEmail) {
      await send2FABackupCodes({ to: adminEmail, codes: rawCodes }).catch(err =>
        fastify.log.error({ err }, '[email] Failed to send 2FA backup codes')
      );
    }

    await auditLog({ actor: user.username, action: 'auth.2fa.enabled', ip: req.ip });

    return { ok: true, backupCodes: rawCodes };
  });

  // POST /api/auth/2fa/disable
  fastify.post('/2fa/disable', { preHandler: fastify.authenticate }, async (req) => {
    await prisma.adminUser.update({
      where: { id: req.adminUser.id },
      data: { totp_secret: null, totp_enabled: false, backup_codes: null },
    });
    await auditLog({ actor: req.adminUser.username, action: 'auth.2fa.disabled', ip: req.ip });
    return { ok: true };
  });
};

// Helper: check backup codes (hash comparison)
async function findAndConsumeBackupCode(hashedCodes, inputCode, userId) {
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await argon2.verify(hashedCodes[i], inputCode).catch(() => false);
    if (match) {
      // Consume it (remove from list)
      const newCodes = [...hashedCodes];
      newCodes.splice(i, 1);
      await prisma.adminUser.update({ where: { id: userId }, data: { backup_codes: newCodes } });
      return i;
    }
  }
  return -1;
}
