'use strict';
const crypto = require('crypto');
const argon2 = require('argon2');
const { z } = require('zod');
const XLSX = require('xlsx');
const prisma = require('../prisma');
const { log: auditLog } = require('../audit');
const { loadCatalogData } = require('./public');

const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// ── Atomic DB update from a full config object ────────────────────────────────
async function applyFullConfig(db, actor, ip) {
  await prisma.$transaction(async (tx) => {
    // Clear FK-dependent tables first to avoid constraint violations:
    // format_papers → formats → sections (cascade order)
    await tx.formatPaper.deleteMany();
    await tx.format.deleteMany();

    // Sections (formats already deleted, no FK violation)
    if (Array.isArray(db.sections)) {
      await tx.section.deleteMany();
      for (const s of db.sections) {
        await tx.section.create({
          data: {
            id: s.id, name_fr: s.name_fr || '', name_en: s.name_en || '',
            desc_fr: s.desc_fr || null, desc_en: s.desc_en || null,
            enabled: s.enabled !== false,
            display_order: s.display_order ?? 0,
          },
        });
      }
    }

    // Formats (insert after sections exist)
    if (Array.isArray(db.formats)) {
      for (let i = 0; i < db.formats.length; i++) {
        const f = db.formats[i];
        await tx.format.create({
          data: {
            code: f.code, section_id: f.section || null,
            name_fr: f.name_fr || '', name_en: f.name_en || '',
            desc_fr: f.desc_fr || null, desc_en: f.desc_en || null,
            width_cm: Number(f.width_cm) || 0, height_cm: Number(f.height_cm) || 0,
            surface_m2: f.surface_m2 != null ? Number(f.surface_m2) : null,
            base_price: Number(f.base_price) || 0,
            display_order: i,
          },
        });
      }
    }

    // Papers + FormatPapers (format_papers already cleared above)
    if (Array.isArray(db.papers)) {
      await tx.paper.deleteMany();
      for (let i = 0; i < db.papers.length; i++) {
        const p = db.papers[i];
        await tx.paper.create({
          data: {
            id: p.id, name_fr: p.name_fr || '', name_en: p.name_en || '',
            factor: Number(p.factor) || 1, display_order: i,
          },
        });
        const formats = Array.isArray(p.formats) ? p.formats : [];
        for (const fCode of formats) {
          await tx.formatPaper.upsert({
            where: { format_code_paper_id: { format_code: fCode, paper_id: p.id } },
            update: { priority: 0 },
            create: { format_code: fCode, paper_id: p.id, priority: 0 },
          }).catch(() => {}); // format might not exist — skip silently
        }
      }
    }

    // Volume tiers
    if (Array.isArray(db.tiers)) {
      await tx.volumeTier.deleteMany();
      for (const t of db.tiers) {
        await tx.volumeTier.create({ data: { from_quantity: t.from || 0, discount_pct: Number(t.discount) || 0 } });
      }
    }

    // Subject fees
    if (Array.isArray(db.subjects)) {
      await tx.subjectFee.deleteMany();
      for (const s of db.subjects) {
        await tx.subjectFee.create({ data: { count: s.count || 1, fee_chf: Number(s.fee_chf) || 0 } });
      }
    }

    // Settings
    const settingUpdates = {};
    if (db.express_surcharge_pct !== undefined) settingUpdates.express_surcharge_pct = Number(db.express_surcharge_pct);
    if (db.contact_email !== undefined) settingUpdates.contact_email = db.contact_email;
    if (db.cookies_banner_enabled !== undefined) settingUpdates.cookies_banner_enabled = db.cookies_banner_enabled;
    if (db.shipping !== undefined) settingUpdates.shipping = db.shipping;
    for (const [key, value] of Object.entries(settingUpdates)) {
      await tx.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }

    // Page texts
    if (db.page_texts) {
      for (const [page, texts] of Object.entries(db.page_texts)) {
        await tx.pageText.upsert({
          where: { page },
          update: { title_fr: texts.title_fr, title_en: texts.title_en, sub_fr: texts.sub_fr, sub_en: texts.sub_en },
          create: { page, title_fr: texts.title_fr, title_en: texts.title_en, sub_fr: texts.sub_fr, sub_en: texts.sub_en },
        });
      }
    }

    // Legal pages
    if (db.legal_pages) {
      for (const [id, doc] of Object.entries(db.legal_pages)) {
        await tx.legalPage.upsert({
          where: { id },
          update: { title_fr: doc.title_fr, title_en: doc.title_en, content_fr: doc.content_fr, content_en: doc.content_en },
          create: { id, title_fr: doc.title_fr, title_en: doc.title_en, content_fr: doc.content_fr, content_en: doc.content_en },
        });
      }
    }

    // Header config
    if (db.header) {
      const h = db.header;
      await tx.headerConfig.upsert({
        where: { id: 1 },
        update: { logo: h.logo, logo_alt: h.logo_alt, brand_name: h.brand_name, brand_tag: h.brand_tag, show_status: h.show_status !== false, show_lang: h.show_lang !== false },
        create: { id: 1, logo: h.logo, logo_alt: h.logo_alt, brand_name: h.brand_name, brand_tag: h.brand_tag, show_status: h.show_status !== false, show_lang: h.show_lang !== false },
      });
    }

    // Footer config
    if (db.footer) {
      await tx.footerConfig.upsert({
        where: { id: 1 },
        update: { enabled: db.footer.enabled !== false, sections: db.footer.sections || [] },
        create: { id: 1, enabled: db.footer.enabled !== false, sections: db.footer.sections || [] },
      });
    }
  });

  await auditLog({ actor, action: 'admin.config.updated', ip });
}

module.exports = async function adminRoutes(fastify) {

  // All admin routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // ── Full config (read) ─────────────────────────────────────────────────────

  fastify.get('/full-config', async (req, reply) => {
    try {
      return await loadCatalogData({ adminMode: true });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: { code: 'DB_ERROR', message: 'Failed to load config' } });
    }
  });

  // ── Full config (write) — accepts the entire frontend db object ────────────

  fastify.put('/config', async (req, reply) => {
    try {
      await applyFullConfig(req.body, req.adminUser.username, req.ip);
      return { ok: true };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: { code: 'DB_ERROR', message: 'Failed to save config' } });
    }
  });

  // ── Sections ───────────────────────────────────────────────────────────────

  fastify.get('/sections', async () => {
    const rows = await prisma.section.findMany({ orderBy: { display_order: 'asc' } });
    return rows;
  });

  fastify.put('/sections', async (req, reply) => {
    const sections = req.body;
    if (!Array.isArray(sections)) return reply.code(400).send({ error: { code: 'INVALID', message: 'Expected array' } });
    await prisma.section.deleteMany();
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      await prisma.section.create({ data: { id: s.id, name_fr: s.name_fr, name_en: s.name_en, desc_fr: s.desc_fr, desc_en: s.desc_en, enabled: s.enabled !== false, display_order: i } });
    }
    await auditLog({ actor: req.adminUser.username, action: 'admin.sections.updated', ip: req.ip });
    return { ok: true };
  });

  // ── Formats ────────────────────────────────────────────────────────────────

  fastify.get('/formats', async () => {
    return prisma.format.findMany({ orderBy: { display_order: 'asc' } });
  });

  fastify.post('/formats', async (req, reply) => {
    const f = req.body;
    try {
      const created = await prisma.format.create({
        data: {
          code: f.code, section_id: f.section || null,
          name_fr: f.name_fr || '', name_en: f.name_en || '',
          desc_fr: f.desc_fr || null, desc_en: f.desc_en || null,
          width_cm: Number(f.width_cm) || 0, height_cm: Number(f.height_cm) || 0,
          surface_m2: f.surface_m2 != null ? Number(f.surface_m2) : null,
          base_price: Number(f.base_price) || 0,
          display_order: f.display_order ?? 999,
        },
      });
      await auditLog({ actor: req.adminUser.username, action: 'admin.format.created', target: `formats:${f.code}`, after: f, ip: req.ip });
      return created;
    } catch (err) {
      return reply.code(400).send({ error: { code: 'DB_ERROR', message: err.message } });
    }
  });

  fastify.patch('/formats/:code', async (req, reply) => {
    const { code } = req.params;
    const f = req.body;
    try {
      const existing = await prisma.format.findUnique({ where: { code } });
      const updated = await prisma.format.update({
        where: { code },
        data: {
          section_id: f.section !== undefined ? (f.section || null) : undefined,
          name_fr: f.name_fr, name_en: f.name_en,
          desc_fr: f.desc_fr, desc_en: f.desc_en,
          width_cm: f.width_cm != null ? Number(f.width_cm) : undefined,
          height_cm: f.height_cm != null ? Number(f.height_cm) : undefined,
          surface_m2: f.surface_m2 !== undefined ? (f.surface_m2 != null ? Number(f.surface_m2) : null) : undefined,
          base_price: f.base_price != null ? Number(f.base_price) : undefined,
          display_order: f.display_order,
        },
      });
      await auditLog({ actor: req.adminUser.username, action: 'admin.format.updated', target: `formats:${code}`, before: existing, after: f, ip: req.ip });
      return updated;
    } catch (err) {
      return reply.code(400).send({ error: { code: 'DB_ERROR', message: err.message } });
    }
  });

  fastify.delete('/formats/:code', async (req, reply) => {
    const { code } = req.params;
    await prisma.format.update({ where: { code }, data: { archived_at: new Date() } });
    await auditLog({ actor: req.adminUser.username, action: 'admin.format.archived', target: `formats:${code}`, ip: req.ip });
    return { ok: true };
  });

  // ── Papers ─────────────────────────────────────────────────────────────────

  fastify.get('/papers', async () => {
    const papers = await prisma.paper.findMany({ orderBy: { display_order: 'asc' } });
    const formatPapers = await prisma.formatPaper.findMany();
    return papers.map(p => ({
      ...p, factor: Number(p.factor),
      formats: formatPapers.filter(fp => fp.paper_id === p.id).map(fp => fp.format_code),
    }));
  });

  fastify.put('/papers', async (req, reply) => {
    const papers = req.body;
    if (!Array.isArray(papers)) return reply.code(400).send({ error: { code: 'INVALID', message: 'Expected array' } });
    await prisma.formatPaper.deleteMany();
    await prisma.paper.deleteMany();
    for (let i = 0; i < papers.length; i++) {
      const p = papers[i];
      await prisma.paper.create({ data: { id: p.id, name_fr: p.name_fr, name_en: p.name_en, factor: Number(p.factor) || 1, display_order: i } });
      for (const fCode of (p.formats || [])) {
        await prisma.formatPaper.create({ data: { format_code: fCode, paper_id: p.id, priority: 0 } }).catch(() => {});
      }
    }
    await auditLog({ actor: req.adminUser.username, action: 'admin.papers.updated', ip: req.ip });
    return { ok: true };
  });

  // ── Volume tiers ───────────────────────────────────────────────────────────

  fastify.get('/volume-tiers', async () => {
    const rows = await prisma.volumeTier.findMany({ orderBy: { from_quantity: 'asc' } });
    return rows.map(r => ({ id: r.id, from: r.from_quantity, discount: Number(r.discount_pct) }));
  });

  fastify.put('/volume-tiers', async (req, reply) => {
    const tiers = req.body;
    if (!Array.isArray(tiers)) return reply.code(400).send({ error: { code: 'INVALID', message: 'Expected array' } });
    await prisma.volumeTier.deleteMany();
    for (const t of tiers) {
      await prisma.volumeTier.create({ data: { from_quantity: Number(t.from) || 0, discount_pct: Number(t.discount) || 0 } });
    }
    await auditLog({ actor: req.adminUser.username, action: 'admin.tiers.updated', ip: req.ip });
    return { ok: true };
  });

  // ── Subject fees ───────────────────────────────────────────────────────────

  fastify.get('/subject-fees', async () => {
    const rows = await prisma.subjectFee.findMany({ orderBy: { count: 'asc' } });
    return rows.map(r => ({ id: r.id, count: r.count, fee_chf: Number(r.fee_chf) }));
  });

  fastify.put('/subject-fees', async (req, reply) => {
    const fees = req.body;
    if (!Array.isArray(fees)) return reply.code(400).send({ error: { code: 'INVALID', message: 'Expected array' } });
    await prisma.subjectFee.deleteMany();
    for (const s of fees) {
      await prisma.subjectFee.create({ data: { count: Number(s.count) || 1, fee_chf: Number(s.fee_chf) || 0 } });
    }
    await auditLog({ actor: req.adminUser.username, action: 'admin.subjects.updated', ip: req.ip });
    return { ok: true };
  });

  // ── Settings ───────────────────────────────────────────────────────────────

  fastify.get('/settings', async () => {
    const rows = await prisma.setting.findMany();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  });

  fastify.patch('/settings', async (req, reply) => {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') return reply.code(400).send({ error: { code: 'INVALID', message: 'Expected object' } });
    for (const [key, value] of Object.entries(updates)) {
      await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    await auditLog({ actor: req.adminUser.username, action: 'admin.settings.updated', after: updates, ip: req.ip });
    return { ok: true };
  });

  // ── Page texts ─────────────────────────────────────────────────────────────

  fastify.get('/page-texts', async () => {
    const rows = await prisma.pageText.findMany();
    return Object.fromEntries(rows.map(r => [r.page, r]));
  });

  fastify.patch('/page-texts/:page', async (req, reply) => {
    const { page } = req.params;
    const data = req.body;
    await prisma.pageText.upsert({
      where: { page },
      update: data,
      create: { page, ...data },
    });
    return { ok: true };
  });

  // ── Legal pages ────────────────────────────────────────────────────────────

  fastify.get('/legal-pages', async () => {
    const rows = await prisma.legalPage.findMany();
    return Object.fromEntries(rows.map(r => [r.id, r]));
  });

  fastify.patch('/legal-pages/:id', async (req, reply) => {
    const { id } = req.params;
    const data = req.body;
    await prisma.legalPage.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
    await auditLog({ actor: req.adminUser.username, action: `admin.legal.${id}.updated`, ip: req.ip });
    return { ok: true };
  });

  // ── Header config ──────────────────────────────────────────────────────────

  fastify.get('/header', async () => {
    return prisma.headerConfig.findUnique({ where: { id: 1 } });
  });

  fastify.put('/header', async (req, reply) => {
    const h = req.body;
    await prisma.headerConfig.upsert({
      where: { id: 1 },
      update: { logo: h.logo, logo_alt: h.logo_alt, brand_name: h.brand_name, brand_tag: h.brand_tag, show_status: h.show_status !== false, show_lang: h.show_lang !== false },
      create: { id: 1, logo: h.logo, logo_alt: h.logo_alt, brand_name: h.brand_name, brand_tag: h.brand_tag, show_status: h.show_status !== false, show_lang: h.show_lang !== false },
    });
    return { ok: true };
  });

  // ── Footer config ──────────────────────────────────────────────────────────

  fastify.get('/footer', async () => {
    return prisma.footerConfig.findUnique({ where: { id: 1 } });
  });

  fastify.put('/footer', async (req, reply) => {
    const f = req.body;
    await prisma.footerConfig.upsert({
      where: { id: 1 },
      update: { enabled: f.enabled !== false, sections: f.sections || [] },
      create: { id: 1, enabled: f.enabled !== false, sections: f.sections || [] },
    });
    return { ok: true };
  });

  // ── Quote requests ─────────────────────────────────────────────────────────

  fastify.get('/quote-requests', async (req) => {
    const { page = 1, pageSize = 50, status, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { company: { contains: search } },
        { contact_name: { contains: search } },
        { email: { contains: search } },
        { reference: { contains: search } },
      ];
    }
    const [total, items] = await Promise.all([
      prisma.quoteRequest.count({ where }),
      prisma.quoteRequest.findMany({
        where, orderBy: { created_at: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
    ]);
    return {
      total, page: Number(page), pageSize: Number(pageSize),
      items: items.map(q => ({
        ...q, computed_ht: Number(q.computed_ht), computed_ttc: Number(q.computed_ttc),
      })),
    };
  });

  fastify.get('/quote-requests/:id', async (req, reply) => {
    const quote = await prisma.quoteRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!quote) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Quote not found' } });
    return { ...quote, computed_ht: Number(quote.computed_ht), computed_ttc: Number(quote.computed_ttc) };
  });

  fastify.patch('/quote-requests/:id', async (req, reply) => {
    const { id } = req.params;
    const { status } = req.body || {};
    const validStatuses = ['new', 'quoted', 'won', 'lost', 'dropped'];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({ error: { code: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` } });
    }
    const existing = await prisma.quoteRequest.findUnique({ where: { id: Number(id) } });
    const updated = await prisma.quoteRequest.update({ where: { id: Number(id) }, data: { status } });
    await auditLog({
      actor: req.adminUser.username, action: 'admin.quote.status.changed',
      target: `quote_requests:${id}`, before: { status: existing.status }, after: { status }, ip: req.ip,
    });
    return { ...updated, computed_ht: Number(updated.computed_ht), computed_ttc: Number(updated.computed_ttc) };
  });

  // ── Import XLSX ────────────────────────────────────────────────────────────

  fastify.post('/import-xlsx', async (req, reply) => {
    if (process.env.DISABLE_IMPORT === 'true') {
      return reply.code(403).send({ error: { code: 'DISABLED', message: 'Import endpoint is disabled' } });
    }

    const data = await req.file();
    if (!data) return reply.code(400).send({ error: { code: 'NO_FILE', message: 'No file uploaded' } });

    const buf = await data.toBuffer();
    const wb = XLSX.read(buf, { type: 'buffer' });

    const get = (sheet) => {
      const ws = wb.Sheets[sheet];
      if (!ws) return null;
      return XLSX.utils.sheet_to_json(ws, { defval: '' });
    };

    const coerce = (row, schema) => {
      const out = {};
      for (const k in schema) {
        const v = row[k];
        if (schema[k] === 'int') out[k] = parseInt(v, 10) || 0;
        else if (schema[k] === 'float') out[k] = parseFloat(String(v).replace(',', '.')) || 0;
        else if (schema[k] === 'bool') {
          if (typeof v === 'boolean') out[k] = v;
          else { const s = String(v ?? '').toLowerCase(); out[k] = ['true', '1', 'oui', 'yes', 'on', 'x'].includes(s); }
        }
        else if (schema[k] === 'csv') {
          if (Array.isArray(v)) out[k] = v.map(String).map(s => s.trim()).filter(Boolean);
          else out[k] = String(v || '').split(/[,;|]\s*/).map(s => s.trim()).filter(Boolean);
        }
        else out[k] = v != null ? String(v) : '';
      }
      return out;
    };

    const dbPayload = {};

    const se = get('sections');
    if (se?.length) dbPayload.sections = se.map(r => coerce(r, { id: 'string', name_fr: 'string', name_en: 'string', desc_fr: 'string', desc_en: 'string', enabled: 'bool' }));

    const f = get('formats');
    if (f?.length) dbPayload.formats = f.map(r => coerce(r, { code: 'string', section: 'string', name_fr: 'string', name_en: 'string', width_cm: 'float', height_cm: 'float', surface_m2: 'float', base_price: 'float', desc_fr: 'string', desc_en: 'string' }));

    const ti = get('tiers');
    if (ti?.length) dbPayload.tiers = ti.map(r => coerce(r, { from: 'int', discount: 'float' }));

    const su = get('subjects');
    if (su?.length) dbPayload.subjects = su.map(r => coerce(r, { count: 'int', fee_chf: 'float' }));

    const pa = get('papers');
    if (pa?.length) dbPayload.papers = pa.map(r => coerce(r, { id: 'string', name_fr: 'string', name_en: 'string', factor: 'float', formats: 'csv' }));

    const set = get('settings');
    if (set?.length) {
      const row = set.find(r => String(r.key) === 'express_surcharge_pct');
      if (row) dbPayload.express_surcharge_pct = parseFloat(row.value) || 22;
    }

    await applyFullConfig(dbPayload, req.adminUser.username, req.ip);
    return { ok: true, imported: Object.keys(dbPayload) };
  });

  // ── Export XLSX ────────────────────────────────────────────────────────────

  fastify.get('/export-xlsx', async (req, reply) => {
    const catalog = await loadCatalogData({ adminMode: true });

    const wb = XLSX.utils.book_new();
    const papersFlat = catalog.papers.map(p => ({ ...p, formats: Array.isArray(p.formats) ? p.formats.join(',') : '' }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catalog.sections || []), 'sections');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catalog.formats || []), 'formats');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      catalog.tiers.map(t => ({ from: t.from, discount: t.discount }))
    ), 'tiers');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      catalog.subjects.map(s => ({ count: s.count, fee_chf: s.fee_chf }))
    ), 'subjects');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(papersFlat), 'papers');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { key: 'express_surcharge_pct', value: catalog.express_surcharge_pct },
    ]), 'settings');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="ooh-pricing-${d}.xlsx"`);
    return reply.send(buf);
  });

  // ── Audit log ──────────────────────────────────────────────────────────────

  fastify.get('/audit-log', async (req) => {
    const { page = 1, pageSize = 100 } = req.query;
    const [total, items] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        orderBy: { at: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
    ]);
    return {
      total, page: Number(page), pageSize: Number(pageSize),
      items: items.map(i => ({ ...i, id: String(i.id) })),
    };
  });

  // ── Admin account (recovery email) ────────────────────────────────────────

  fastify.patch('/account/recovery-email', async (req, reply) => {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') return reply.code(400).send({ error: { code: 'INVALID', message: 'Email required' } });
    await prisma.adminUser.update({ where: { id: req.adminUser.id }, data: { recovery_email: email.trim() } });
    return { ok: true };
  });
};
