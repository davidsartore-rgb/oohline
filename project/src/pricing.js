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
    const totalHT = beforeExpress + expressAmount;
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
