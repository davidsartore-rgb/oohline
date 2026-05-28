'use strict';

// Server-side pricing engine — mirrors src/pricing.js from the frontend.
// Input: raw DB rows from Prisma. Output: same shape as the frontend Pricing.compute().

function shippingFor(shipping, formatCode, qty) {
  const def = (shipping && typeof shipping.default_chf === 'number') ? shipping.default_chf : 25;
  const overrides = (shipping && Array.isArray(shipping.overrides)) ? shipping.overrides : [];
  const q = Math.max(1, parseInt(qty, 10) || 1);

  const matching = overrides.filter((o) => {
    const fmtOk = !Array.isArray(o.formats) || o.formats.length === 0 || o.formats.includes(formatCode);
    const qtyOk = (parseInt(o.from_qty, 10) || 1) <= q;
    return fmtOk && qtyOk;
  });
  if (matching.length === 0) return { fee_chf: def, row: null };

  matching.sort((a, b) => {
    const qa = parseInt(a.from_qty, 10) || 1;
    const qb = parseInt(b.from_qty, 10) || 1;
    if (qa !== qb) return qb - qa;
    const sa = (Array.isArray(a.formats) && a.formats.length > 0) ? 1 : 0;
    const sb = (Array.isArray(b.formats) && b.formats.length > 0) ? 1 : 0;
    return sb - sa;
  });
  const row = matching[0];
  return { fee_chf: typeof row.fee_chf === 'number' ? row.fee_chf : def, row };
}

function paperForFormat(papers, formatPapers, formatCode) {
  // formatPapers is the FormatPaper join table; papers is the Paper records.
  // Find papers assigned to this format, lowest priority wins.
  const assigned = formatPapers
    .filter(fp => fp.format_code === formatCode)
    .sort((a, b) => a.priority - b.priority);
  if (assigned.length === 0) return papers[0] || null;
  return papers.find(p => p.id === assigned[0].paper_id) || papers[0] || null;
}

function compute({ formats, papers, formatPapers, tiers, subjects, settings, shipping }, {
  formatCode, quantity, numSubjects, express,
}) {
  const fmt = formats.find(f => f.code === formatCode);
  if (!fmt) return null;

  const paper = paperForFormat(papers, formatPapers, formatCode);
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const subj = Math.max(1, parseInt(numSubjects, 10) || 1);

  // Volume tier: largest from <= qty wins
  const sortedTiers = [...tiers].sort((a, b) => a.from_quantity - b.from_quantity);
  let tier = sortedTiers[0];
  for (const t of sortedTiers) if (qty >= t.from_quantity) tier = t;

  // Subject fee: largest count <= subj wins
  const sortedSubj = [...subjects].sort((a, b) => a.count - b.count);
  let subjRow = sortedSubj[0];
  for (const s of sortedSubj) if (subj >= s.count) subjRow = s;
  const subjectFee = subjRow ? Number(subjRow.fee_chf) : 0;

  // Settings
  const expressPctSetting = settings.find(s => s.key === 'express_surcharge_pct');
  const expressPct = express ? (Number(expressPctSetting?.value ?? 22) / 100) : 0;
  const vatRateSetting = settings.find(s => s.key === 'vat_rate');
  const vatRate = Number(vatRateSetting?.value ?? 0.081);

  const unitBase = Number(fmt.base_price);
  const paperFactor = paper ? Number(paper.factor) : 1;
  const discountPct = Number(tier?.discount_pct ?? 0) / 100;

  const unit = unitBase * paperFactor;
  const subtotal = unit * qty;
  const discountAmount = subtotal * discountPct;
  const afterDiscount = subtotal - discountAmount;
  const beforeExpress = afterDiscount + subjectFee;
  const expressAmount = beforeExpress * expressPct;

  const shippingLookup = shippingFor(shipping, formatCode, qty);
  const shippingFee = shippingLookup.fee_chf;
  const shippingRow = shippingLookup.row;

  const totalHT = beforeExpress + expressAmount + shippingFee;
  const vat = totalHT * vatRate;
  const totalTTC = totalHT + vat;
  const unitEffective = totalHT / qty;

  return {
    fmt, paper,
    qty, subj,
    unitBase, paperFactor, unit,
    discountPct, expressPct,
    tier, subjRow,
    subjectFee,
    subtotal, discountAmount, afterDiscount, beforeExpress, expressAmount,
    shippingFee, shippingRow,
    totalHT, vat, totalTTC, unitEffective,
  };
}

function fmtCHF(n) {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency', currency: 'CHF',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

module.exports = { compute, paperForFormat, shippingFor, fmtCHF };
