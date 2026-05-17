'use strict';
const prisma = require('./prisma');

async function log({ actor, action, target, before, after, ip, userAgent }) {
  try {
    await prisma.auditLog.create({
      data: { actor, action, target, before, after, ip, user_agent: userAgent },
    });
  } catch (err) {
    // Audit log failure should not crash the app — just log it
    console.error('[audit] Failed to write audit log:', err.message);
  }
}

module.exports = { log };
