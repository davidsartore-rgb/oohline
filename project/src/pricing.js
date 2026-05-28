// Pricing engine — single source of truth for the calculator and admin previews.
//
//   unit          = format.base_price × paper.factor
//   subtotal      = unit × quantity
//   discountAmt   = subtotal × volume_discount
//   afterDiscount = subtotal − discountAmt
//   subjectFee    = lookup(N subjects)              ← FIXED CHF, distinct line
//   beforeExpress = afterDiscount + subjectFee
//   expressAmt    = beforeExpress × express_pct
//   totalHT       = beforeExpress + expressAmt
//   vat (CH 8.1%) = totalHT × 0.081
//
// Paper is NOT user-selectable; it is derived from the format (each paper has
// a `formats` array; the first paper that lists the format wins).

window.Pricing = {
  paperForFormat(db, formatCode) {
    const direct = db.papers.find((p) => Array.isArray(p.formats) && p.formats.includes(formatCode));
    return direct || db.papers[0];
  },

  // Returns { fee_chf, row | null } — largest matching from_qty override wins;
  // format-specific overrides beat catch-all ones on tie; falls back to default_chf.
  shippingFor(db, formatCode, qty) {
    const ship = db.shipping || {};
    const def = typeof ship.default_chf === "number" ? ship.default_chf : 25;
    const overrides = Array.isArray(ship.overrides) ? ship.overrides : [];
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
    return { fee_chf: typeof row.fee_chf === "number" ? row.fee_chf : def, row };
  },

  compute({ db, formatCode, quantity, subjects, express }) {
    const fmt = db.formats.find((f) => f.code === formatCode);
    if (!fmt) return null;
    const paper = this.paperForFormat(db, formatCode);

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const subj = Math.max(1, parseInt(subjects, 10) || 1);

    // Volume tier: largest "from" <= qty wins
    const sortedTiers = [...db.tiers].sort((a, b) => a.from - b.from);
    let tier = sortedTiers[0];
    for (const t of sortedTiers) if (qty >= t.from) tier = t;

    // Subject fee: largest "count" <= subj wins
    const sortedSubj = [...db.subjects].sort((a, b) => a.count - b.count);
    let subjRow = sortedSubj[0];
    for (const s of sortedSubj) if (subj >= s.count) subjRow = s;
    const subjectFee = subjRow ? (subjRow.fee_chf || 0) : 0;

    const unitBase = fmt.base_price;
    const paperFactor = paper ? paper.factor : 1;
    const discountPct = tier.discount / 100;
    const expressPct = express ? db.express_surcharge_pct / 100 : 0;

    const unit = unitBase * paperFactor;
    const subtotal = unit * qty;
    const discountAmount = subtotal * discountPct;
    const afterDiscount = subtotal - discountAmount;
    const beforeExpress = afterDiscount + subjectFee;
    const expressAmount = beforeExpress * expressPct;

    const shippingLookup = this.shippingFor(db, formatCode, qty);
    const shippingFee = shippingLookup.fee_chf;
    const shippingRow = shippingLookup.row;

    const totalHT = beforeExpress + expressAmount + shippingFee;
    const vat = totalHT * 0.081;
    const totalTTC = totalHT + vat;
    const unitEffective = totalHT / qty;

    return {
      fmt, paper,
      qty, subj,
      unitBase, paperFactor, unit,
      discountPct, expressPct,
      tier, subjRow,
      subjectFee,
      subtotal,
      discountAmount,
      afterDiscount,
      beforeExpress,
      expressAmount,
      shippingFee, shippingRow,
      totalHT, vat, totalTTC, unitEffective,
    };
  },

  fmtCHF(n) {
    if (n == null || isNaN(n)) return "—";
    return new Intl.NumberFormat("de-CH", {
      style: "currency", currency: "CHF",
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n);
  },
  fmtEUR(n) { return window.Pricing.fmtCHF(n); },
  fmtN(n, d = 0) {
    return new Intl.NumberFormat("de-CH", {
      minimumFractionDigits: d, maximumFractionDigits: d,
    }).format(n);
  },
};
