'use strict';
const { z } = require('zod');
const crypto = require('crypto');
const prisma = require('../prisma');
const { compute } = require('../pricing');
const { sendQuoteInternal, sendQuoteConfirmation } = require('../email');

// ── Helper: load full catalog from DB ─────────────────────────────────────────
async function loadCatalogData({ adminMode = false } = {}) {
  const [sections, formats, formatPapers, papers, tiers, subjects, settings,
    pageTexts, legalPages, headerRow, footerRow] = await Promise.all([
    prisma.section.findMany({ orderBy: { display_order: 'asc' } }),
    prisma.format.findMany({
      where: adminMode ? {} : { archived_at: null },
      orderBy: { display_order: 'asc' },
    }),
    prisma.formatPaper.findMany(),
    prisma.paper.findMany({ orderBy: { display_order: 'asc' } }),
    prisma.volumeTier.findMany({ orderBy: { from_quantity: 'asc' } }),
    prisma.subjectFee.findMany({ orderBy: { count: 'asc' } }),
    prisma.setting.findMany(),
    prisma.pageText.findMany(),
    prisma.legalPage.findMany(),
    prisma.headerConfig.findUnique({ where: { id: 1 } }),
    prisma.footerConfig.findUnique({ where: { id: 1 } }),
  ]);

  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const expressePct = Number(settingsMap.express_surcharge_pct ?? 22);
  const contactEmail = settingsMap.contact_email ?? process.env.CONTACT_EMAIL;
  const cookiesBannerEnabled = settingsMap.cookies_banner_enabled !== false;

  // Shape papers with formats array (for frontend compatibility)
  const papersWithFormats = papers.map(p => ({
    id: p.id,
    name_fr: p.name_fr,
    name_en: p.name_en,
    factor: Number(p.factor),
    display_order: p.display_order,
    formats: formatPapers.filter(fp => fp.paper_id === p.id).map(fp => fp.format_code),
  }));

  // Shape formats
  const formatsOut = formats.map(f => ({
    code: f.code,
    section: f.section_id,
    name_fr: f.name_fr,
    name_en: f.name_en,
    desc_fr: f.desc_fr,
    desc_en: f.desc_en,
    width_cm: Number(f.width_cm),
    height_cm: Number(f.height_cm),
    surface_m2: f.surface_m2 != null ? Number(f.surface_m2) : null,
    base_price: Number(f.base_price),
    display_order: f.display_order,
  }));

  // Filter to enabled sections for public mode
  const enabledSectionIds = new Set(
    (adminMode ? sections : sections.filter(s => s.enabled)).map(s => s.id)
  );
  const visibleFormats = adminMode
    ? formatsOut
    : formatsOut.filter(f => !f.section || enabledSectionIds.has(f.section));

  const pageTextsMap = {};
  for (const pt of pageTexts) {
    pageTextsMap[pt.page] = {
      title_fr: pt.title_fr, title_en: pt.title_en,
      sub_fr: pt.sub_fr, sub_en: pt.sub_en,
    };
  }

  const legalPagesMap = {};
  for (const lp of legalPages) {
    legalPagesMap[lp.id] = {
      title_fr: lp.title_fr, title_en: lp.title_en,
      content_fr: lp.content_fr, content_en: lp.content_en,
    };
  }

  return {
    sections: (adminMode ? sections : sections.filter(s => s.enabled)).map(s => ({
      id: s.id,
      name_fr: s.name_fr, name_en: s.name_en,
      desc_fr: s.desc_fr, desc_en: s.desc_en,
      enabled: s.enabled, display_order: s.display_order,
    })),
    formats: visibleFormats,
    papers: papersWithFormats,
    tiers: tiers.map(t => ({ from: t.from_quantity, discount: Number(t.discount_pct) })),
    subjects: subjects.map(s => ({ count: s.count, fee_chf: Number(s.fee_chf) })),
    express_surcharge_pct: expressePct,
    contact_email: contactEmail,
    cookies_banner_enabled: cookiesBannerEnabled,
    page_texts: pageTextsMap,
    legal_pages: legalPagesMap,
    header: headerRow ? {
      logo: headerRow.logo, logo_alt: headerRow.logo_alt,
      brand_name: headerRow.brand_name, brand_tag: headerRow.brand_tag,
      show_status: headerRow.show_status, show_lang: headerRow.show_lang,
    } : null,
    footer: footerRow ? {
      enabled: footerRow.enabled,
      sections: footerRow.sections,
    } : null,
  };
}

module.exports = async function publicRoutes(fastify) {

  // GET /api/public/catalog — full site config for the frontend
  fastify.get('/catalog', async (req, reply) => {
    try {
      const data = await loadCatalogData({ adminMode: false });
      return data;
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: { code: 'DB_ERROR', message: 'Failed to load catalog' } });
    }
  });

  // GET /api/public/pricing-config
  fastify.get('/pricing-config', async (req, reply) => {
    try {
      const [tiers, subjects, settings] = await Promise.all([
        prisma.volumeTier.findMany({ orderBy: { from_quantity: 'asc' } }),
        prisma.subjectFee.findMany({ orderBy: { count: 'asc' } }),
        prisma.setting.findMany(),
      ]);
      const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
      return {
        tiers: tiers.map(t => ({ from: t.from_quantity, discount: Number(t.discount_pct) })),
        subjects: subjects.map(s => ({ count: s.count, fee_chf: Number(s.fee_chf) })),
        express_surcharge_pct: Number(settingsMap.express_surcharge_pct ?? 22),
        vat_rate: Number(settingsMap.vat_rate ?? 0.081),
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: { code: 'DB_ERROR', message: 'Failed to load config' } });
    }
  });

  // POST /api/public/quote-requests — submit a quote request
  fastify.post('/quote-requests', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour',
        keyGenerator: (req) => req.ip,
      },
    },
  }, async (req, reply) => {
    const schema = z.object({
      formatCode: z.string().min(1).max(20),
      quantity: z.number().int().min(1).max(100000),
      subjects: z.number().int().min(1).max(100),
      express: z.boolean().default(false),
      company: z.string().min(1).max(255),
      contactName: z.string().min(1).max(255),
      email: z.string().email().max(255),
      phone: z.string().max(50).optional(),
      message: z.string().max(5000).optional(),
      consent: z.literal(true),
      lang: z.enum(['fr', 'en']).default('fr'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.issues },
      });
    }

    const body = parsed.data;

    // Load pricing data for server-side recompute
    const [formats, formatPapers, papers, tiers, subjects, settings] = await Promise.all([
      prisma.format.findMany({ where: { archived_at: null } }),
      prisma.formatPaper.findMany(),
      prisma.paper.findMany(),
      prisma.volumeTier.findMany(),
      prisma.subjectFee.findMany(),
      prisma.setting.findMany(),
    ]);

    const fmt = formats.find(f => f.code === body.formatCode);
    if (!fmt) {
      return reply.code(400).send({ error: { code: 'FORMAT_NOT_FOUND', message: 'Unknown format' } });
    }

    const result = compute(
      { formats, papers, formatPapers, tiers, subjects, settings },
      { formatCode: body.formatCode, quantity: body.quantity, numSubjects: body.subjects, express: body.express }
    );

    if (!result) {
      return reply.code(400).send({ error: { code: 'COMPUTE_ERROR', message: 'Failed to compute price' } });
    }

    // Generate unique reference
    const year = new Date().getFullYear();
    const rand = Math.floor(Math.random() * 9000) + 1000;
    const reference = `OOH-${year}-${rand}`;

    const consentAt = new Date();
    const expiresAt = new Date(consentAt.getTime() + 365 * 24 * 60 * 60 * 1000); // 12 months

    const quote = await prisma.quoteRequest.create({
      data: {
        reference,
        format_code: body.formatCode,
        paper_id: result.paper?.id ?? null,
        quantity: body.quantity,
        subjects: body.subjects,
        express: body.express,
        computed_ht: result.totalHT,
        computed_ttc: result.totalTTC,
        company: body.company,
        contact_name: body.contactName,
        email: body.email,
        phone: body.phone ?? null,
        message: body.message ?? null,
        consent_at: consentAt,
        consent_ip: req.ip,
        expires_at: expiresAt,
        lang: body.lang,
      },
    });

    // Send emails (non-blocking — don't fail the request if email fails)
    const adminUrl = process.env.APP_URL || '';
    Promise.all([
      sendQuoteInternal({ quote, result, adminUrl }).catch(err =>
        fastify.log.error({ err }, '[email] Failed to send internal quote notification')
      ),
      sendQuoteConfirmation({ quote, result }).catch(err =>
        fastify.log.error({ err }, '[email] Failed to send quote confirmation to customer')
      ),
    ]);

    return reply.code(201).send({ reference });
  });

  // Expose loadCatalogData for admin routes
  fastify.decorate('loadCatalogData', loadCatalogData);
};

module.exports.loadCatalogData = loadCatalogData;
