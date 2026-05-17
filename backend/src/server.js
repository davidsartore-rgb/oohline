'use strict';
require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const fastify = require('fastify')({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    ...(process.env.NODE_ENV !== 'production' && {
      transport: { target: 'pino-pretty' },
    }),
  },
});
const prisma = require('./prisma');

// ── Plugins ───────────────────────────────────────────────────────────────────

fastify.register(require('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'",
        'https://unpkg.com', 'https://fonts.googleapis.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

fastify.register(require('@fastify/cors'), {
  origin: false, // Same-origin only (served from Nginx)
  credentials: true,
});

fastify.register(require('@fastify/cookie'));

fastify.register(require('@fastify/rate-limit'), {
  global: false, // Applied per-route
  keyGenerator: (req) => req.ip,
});

fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB for XLSX imports
});

// ── Session decorator ─────────────────────────────────────────────────────────
// Validates the sid cookie against admin_sessions table.
// Attaches req.adminUser if valid.

fastify.decorateRequest('adminUser', null);

async function authenticate(req, reply) {
  const token = req.cookies.sid;
  if (!token) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await prisma.adminSession.findUnique({
    where: { token_hash: tokenHash },
    include: { user: true },
  }).catch(() => null);

  if (!session || session.expires_at < new Date()) {
    reply.clearCookie('sid');
    return reply.code(401).send({ error: { code: 'SESSION_EXPIRED', message: 'Session expired' } });
  }

  req.adminUser = session.user;

  // Slide the session expiry (12h rolling)
  const newExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await prisma.adminSession.update({
    where: { id: session.id },
    data: { expires_at: newExpiry },
  }).catch(() => {});
}

fastify.decorate('authenticate', authenticate);

// ── Static frontend ────────────────────────────────────────────────────────────
const FRONTEND = path.join(__dirname, '..', '..', 'project');
fastify.register(require('@fastify/static'), {
  root: FRONTEND,
  prefix: '/',
  decorateReply: false,
});

// ── API routes ────────────────────────────────────────────────────────────────
fastify.register(require('./routes/public'), { prefix: '/api/public' });
fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
fastify.register(require('./routes/admin'), { prefix: '/api/admin' });

// ── Health check ──────────────────────────────────────────────────────────────
fastify.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }));

// ── SPA fallback ──────────────────────────────────────────────────────────────
fastify.setNotFoundHandler(async (req, reply) => {
  if (req.raw.url && req.raw.url.startsWith('/api/')) {
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'API route not found' } });
  }
  return reply.sendFile('OOH Catalogue.html');
});

// ── Cleanup ───────────────────────────────────────────────────────────────────
// Delete expired sessions daily (in-process cron)
setInterval(async () => {
  try {
    const deleted = await prisma.adminSession.deleteMany({
      where: { expires_at: { lt: new Date() } },
    });
    if (deleted.count > 0) fastify.log.info(`[cron] Deleted ${deleted.count} expired sessions`);
  } catch {}
}, 60 * 60 * 1000); // every hour

// Delete expired quote requests daily
setInterval(async () => {
  try {
    const deleted = await prisma.quoteRequest.deleteMany({
      where: { expires_at: { lt: new Date() } },
    });
    if (deleted.count > 0) fastify.log.info(`[cron] Deleted ${deleted.count} expired quotes`);
  } catch {}
}, 24 * 60 * 60 * 1000); // every 24h

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await prisma.$connect();
    await fastify.listen({
      port: Number(process.env.PORT || 3000),
      host: process.env.HOST || '0.0.0.0',
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
});

start();
