// Price calculator — 3 UX variants. Paper is derived from format (no choice).
//   "form"     : classic form with summary panel
//   "wizard"   : step-by-step wizard
//   "compact"  : one-row dense bar with everything inline

// ───── Shared summary panel ─────
function SummaryPanel({ result, t, onOpenQuote, lang }) {
  if (!result) {
    return (
      <div className="card card-pad summary">
        <div className="muted" style={{ textAlign: "center", padding: "40px 12px" }}>{t("no_quote")}</div>
      </div>
    );
  }
  const { fmt, paper, qty, subj, unit, subjectFee, subtotal, discountAmount, expressAmount,
          totalHT, vat, totalTTC, unitEffective, discountPct, expressPct, tier } = result;
  return (
    <div className="card summary">
      <div className="card-head">
        <div>
          <div className="card-title">{t("summary")}</div>
          <div className="card-sub">{lang === "fr" ? fmt.name_fr : fmt.name_en} · {fmt.code}</div>
        </div>
        <div className="spacer" />
        <span className="badge">× {qty}</span>
      </div>
      <div className="card-pad">
        <div className="price-big">{Pricing.fmtCHF(totalHT)}</div>
        <div className="price-unit">{t("total_ht")} · {t("unit_eff")} {Pricing.fmtCHF(unitEffective)} / ex.</div>

        <div className="divider" />

        <div className="line">
          <span>{fmt.code} × {qty} ex.</span>
          <span className="num">{Pricing.fmtCHF(subtotal)}</span>
        </div>
        <div className="line muted" style={{ paddingTop: 0, fontSize: 11 }}>
          <span>↳ {Pricing.fmtCHF(unit)} / ex. ({paper ? (lang === "fr" ? paper.name_fr : paper.name_en) : "—"})</span>
        </div>
        {discountPct > 0 && (
          <div className="line" style={{ color: "var(--ok)" }}>
            <span>− {t("discount")} (≥ {tier.from} ex. · {(discountPct*100).toFixed(0)} %)</span>
            <span className="num">− {Pricing.fmtCHF(discountAmount)}</span>
          </div>
        )}
        <div className="line">
          <span>+ {t("subjects_fee")} ({subj} {subj > 1 ? "sujets" : "sujet"})</span>
          <span className="num">+ {Pricing.fmtCHF(subjectFee)}</span>
        </div>
        {expressPct > 0 && (
          <div className="line" style={{ color: "var(--warn)" }}>
            <span>+ {t("express_fee")} ({(expressPct*100).toFixed(0)} %)</span>
            <span className="num">+ {Pricing.fmtCHF(expressAmount)}</span>
          </div>
        )}
        <div className="line tot">
          <span>{t("total_ht")}</span>
          <span className="num">{Pricing.fmtCHF(totalHT)}</span>
        </div>
        <div className="line muted">
          <span>{t("vat")}</span>
          <span className="num">{Pricing.fmtCHF(vat)}</span>
        </div>
        <div className="line tot">
          <span>{t("total_ttc")}</span>
          <span className="num">{Pricing.fmtCHF(totalTTC)}</span>
        </div>

        <button className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={onOpenQuote}>
          {t("request_quote")} →
        </button>
        <div className="muted-2" style={{ fontSize: 11, textAlign: "center", marginTop: 8 }}>{t("no_account_needed")}</div>
      </div>
    </div>
  );
}

// Small inline "paper for this format" pill
function PaperPill({ paper, lang, t }) {
  if (!paper) return null;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 10px",
      background: "var(--surface-2)", border: "1px solid var(--line)",
      borderRadius: 6, fontSize: 12, color: "var(--ink-2)",
    }}>
      <span style={{ width: 6, height: 6, background: "var(--brand-500)", borderRadius: 100 }}></span>
      <span className="muted" style={{ fontSize: 11 }}>{t("paper_for_format")} :</span>
      <strong>{lang === "fr" ? paper.name_fr : paper.name_en}</strong>
    </div>
  );
}

// ───── Variant 1: classic form + sticky summary ─────
function CalcForm({ db, t, lang, formats, formatCode, setFormatCode, quantity, setQuantity, subjects, setSubjects, express, setExpress, result, onOpenQuote }) {
  const fmt = formats.find((f) => f.code === formatCode);
  const paper = result && result.paper;
  return (
    <div className="split-summary">
      <div className="card">
        <div className="card-head">
          <div className="card-title">{t("pick_format")} & {t("options")}</div>
          <div className="spacer" />
          <span className="muted-2" style={{ fontSize: 11 }}>{t("calc_intro")}</span>
        </div>
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 22 }}>

          <div className="field">
            <div className="field-label">{t("format")}</div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
              {formats.map((f) => {
                const p = Pricing.paperForFormat(db, f.code);
                return (
                  <button
                    key={f.code}
                    onClick={() => setFormatCode(f.code)}
                    style={{
                      padding: 12,
                      border: `1px solid ${formatCode === f.code ? "var(--brand-700)" : "var(--line)"}`,
                      background: formatCode === f.code ? "var(--brand-50)" : "var(--surface)",
                      borderRadius: 8,
                      textAlign: "left",
                      display: "flex", flexDirection: "column", gap: 8,
                      boxShadow: formatCode === f.code ? "0 0 0 3px var(--brand-50)" : "none",
                      transition: "all 0.12s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <FormatThumb fmt={f} size={44} showLabel={false} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{f.code}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{f.width_cm}×{f.height_cm} cm</div>
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{Pricing.fmtCHF(f.base_price)} / ex.</div>
                    {p && <div className="muted" style={{ fontSize: 10 }}>↳ {lang === "fr" ? p.name_fr : p.name_en}</div>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-2col">
            <div className="field">
              <div className="field-label">{t("quantity")}</div>
              <Stepper value={quantity} onChange={setQuantity} min={1} max={9999} />
              <div className="field-hint">
                {result && result.discountPct > 0 && (
                  <span style={{ color: "var(--ok)" }}>− {(result.discountPct*100).toFixed(0)} % {t("discount")}</span>
                )}
                {result && result.discountPct === 0 && (
                  <span>+ 10 ex. → 5 % · + 25 ex. → 9 %…</span>
                )}
              </div>
            </div>
            <div className="field">
              <div className="field-label">{t("subjects")}</div>
              <Stepper value={subjects} onChange={setSubjects} min={1} max={50} />
              <div className="field-hint">
                {result && (
                  <span>{t("subjects_fee")} : <strong style={{ color: "var(--ink-2)" }}>+ {Pricing.fmtCHF(result.subjectFee)}</strong></span>
                )}
              </div>
            </div>
          </div>

          <div className="field">
            <div className="field-label">{t("delay")}</div>
            <div className="seg" style={{ width: "fit-content" }}>
              <button className={!express ? "on" : ""} onClick={() => setExpress(false)}>{t("delay_standard")}</button>
              <button className={express ? "on" : ""} onClick={() => setExpress(true)}>{t("delay_express")} +{db.express_surcharge_pct}%</button>
            </div>
          </div>

          {fmt && (
            <div style={{ padding: 14, background: "var(--surface-2)", borderRadius: 6, border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
              <PaperPill paper={paper} lang={lang} t={t} />
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                <span className="badge badge-blue" style={{ marginRight: 8 }}>i</span>
                {t("drop_visual")}.
              </div>
            </div>
          )}
        </div>
      </div>

      <SummaryPanel result={result} t={t} lang={lang} onOpenQuote={onOpenQuote} />
    </div>
  );
}

// ───── Variant 2: step-by-step wizard ─────
function CalcWizard({ db, t, lang, formats, formatCode, setFormatCode, quantity, setQuantity, subjects, setSubjects, express, setExpress, result, onOpenQuote }) {
  const [step, setStep] = useState(0);
  const steps = [t("format"), t("quantity"), t("options"), t("summary")];

  return (
    <div className="card">
      <div className="card-head" style={{ gap: 24 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, opacity: i > step ? 0.5 : 1 }}>
            <span className={`step-dot ${i <= step ? "on" : ""}`}>{i + 1}</span>
            <span style={{ fontSize: 12, fontWeight: i === step ? 700 : 500, color: i === step ? "var(--ink)" : "var(--ink-3)" }}>{s}</span>
            {i < steps.length - 1 && <span style={{ width: 24, height: 1, background: "var(--line)", marginLeft: 8 }}></span>}
          </div>
        ))}
      </div>

      <div className="card-pad" style={{ minHeight: 380, padding: 28 }}>
        {step === 0 && (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {formats.map((f) => {
              const p = Pricing.paperForFormat(db, f.code);
              return (
                <button key={f.code} onClick={() => { setFormatCode(f.code); setStep(1); }}
                  style={{
                    padding: 16, textAlign: "left",
                    border: `1px solid ${formatCode === f.code ? "var(--brand-700)" : "var(--line-strong)"}`,
                    background: formatCode === f.code ? "var(--brand-50)" : "var(--surface)",
                    borderRadius: 8, display: "flex", flexDirection: "column", gap: 10,
                  }}>
                  <FormatThumb fmt={f} size={80} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{f.code} — {(lang === "fr" ? f.name_fr : f.name_en).split(" — ").slice(1).join(" — ")}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{f.width_cm}×{f.height_cm} cm · {Pricing.fmtCHF(f.base_price)}/ex.</div>
                    {p && <div className="muted-2" style={{ fontSize: 11, marginTop: 4 }}>↳ {lang === "fr" ? p.name_fr : p.name_en}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div style={{ maxWidth: 480, margin: "20px auto", display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="field">
              <div className="field-label" style={{ fontSize: 14 }}>{t("quantity")}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {[10, 25, 50, 100, 250, 500].map((n) => (
                  <button key={n} className={`chip ${quantity === n ? "on" : ""}`} onClick={() => setQuantity(n)}>{n} ex.</button>
                ))}
              </div>
              <Stepper value={quantity} onChange={setQuantity} max={9999} />
            </div>
            <div className="field">
              <div className="field-label" style={{ fontSize: 14 }}>{t("subjects")}</div>
              <Stepper value={subjects} onChange={setSubjects} max={50} />
              <div className="field-hint">{t("subjects_hint")} {result && <>— supplément : <strong>+ {Pricing.fmtCHF(result.subjectFee)}</strong></>}</div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ maxWidth: 520, margin: "20px auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {result && (
              <div style={{ padding: 14, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8 }}>
                <PaperPill paper={result.paper} lang={lang} t={t} />
                <div className="muted-2" style={{ fontSize: 11, marginTop: 8 }}>
                  Le papier est défini par le format choisi et l'emplacement. Pas de choix client.
                </div>
              </div>
            )}
            <div className="field">
              <div className="field-label">{t("delay")}</div>
              <div className="seg"><button className={!express ? "on" : ""} onClick={() => setExpress(false)}>{t("delay_standard")}</button>
                <button className={express ? "on" : ""} onClick={() => setExpress(true)}>{t("delay_express")} +{db.express_surcharge_pct}%</button></div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <SummaryPanel result={result} t={t} lang={lang} onOpenQuote={onOpenQuote} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("breakdown")}</div>
              <table className="tbl" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
                <tbody>
                  <tr><td>{t("format")}</td><td className="num">{result.fmt.code}</td></tr>
                  <tr><td>{t("paper")}</td><td className="num">{lang === "fr" ? result.paper.name_fr : result.paper.name_en}</td></tr>
                  <tr><td>{t("base_price")}</td><td className="num">{Pricing.fmtCHF(result.unitBase)}</td></tr>
                  <tr><td>Papier ×</td><td className="num">× {result.paperFactor.toFixed(2)}</td></tr>
                  <tr><td>Prix unitaire</td><td className="num price">{Pricing.fmtCHF(result.unit)}</td></tr>
                  <tr><td>{t("quantity")}</td><td className="num">× {result.qty}</td></tr>
                  <tr><td>{t("discount")}</td><td className="num">− {(result.discountPct*100).toFixed(0)} %</td></tr>
                  <tr><td>{t("subjects_fee")}</td><td className="num">+ {Pricing.fmtCHF(result.subjectFee)}</td></tr>
                  <tr><td>{t("delay")}</td><td className="num">{result.expressPct ? `+ ${(result.expressPct*100).toFixed(0)} %` : "0 %"}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "14px 18px", borderTop: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>← Précédent</button>
        <div className="spacer" />
        {result && step < 3 && (
          <div className="muted" style={{ fontSize: 12 }}>
            {t("total_ht")} : <strong style={{ color: "var(--ink)" }}>{Pricing.fmtCHF(result.totalHT)}</strong>
          </div>
        )}
        {step < 3 ? (
          <button className="btn btn-primary" onClick={() => setStep((s) => Math.min(3, s + 1))}>Suivant →</button>
        ) : (
          <button className="btn btn-primary" onClick={onOpenQuote}>{t("request_quote")} →</button>
        )}
      </div>
    </div>
  );
}

// ───── Variant 3: compact one-bar calculator ─────
function CalcCompact({ db, t, lang, formats, formatCode, setFormatCode, quantity, setQuantity, subjects, setSubjects, express, setExpress, result, onOpenQuote }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="card" style={{ padding: "16px 18px" }}>
        <div className="compact-row">
          <div className="field">
            <div className="field-label">{t("format")}</div>
            <select className="select" value={formatCode} onChange={(e) => setFormatCode(e.target.value)}>
              {formats.map((f) => <option key={f.code} value={f.code}>{f.code} — {lang === "fr" ? f.name_fr : f.name_en}</option>)}
            </select>
          </div>
          <div className="field">
            <div className="field-label">{t("quantity")}</div>
            <Stepper value={quantity} onChange={setQuantity} max={9999} />
          </div>
          <div className="field">
            <div className="field-label">{t("subjects")}</div>
            <Stepper value={subjects} onChange={setSubjects} max={50} />
          </div>
          <div className="field">
            <div className="field-label">{t("delay")}</div>
            <div className="seg">
              <button className={!express ? "on" : ""} onClick={() => setExpress(false)}>Std</button>
              <button className={express ? "on" : ""} onClick={() => setExpress(true)}>Express</button>
            </div>
          </div>
        </div>
        {result && <div style={{ marginTop: 12 }}><PaperPill paper={result.paper} lang={lang} t={t} /></div>}
      </div>

      {result && (
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 18 }}>
          <div className="card">
            <div className="card-head"><div className="card-title">{t("breakdown")}</div></div>
            <table className="tbl">
              <thead>
                <tr><th>Élément</th><th>Détail</th><th className="num">Valeur</th></tr>
              </thead>
              <tbody>
                <tr><td>{t("base_price")}</td><td>{result.fmt.code}</td><td className="num price">{Pricing.fmtCHF(result.unitBase)}</td></tr>
                <tr><td>{t("paper")}</td><td>{lang === "fr" ? result.paper.name_fr : result.paper.name_en}</td><td className="num">× {result.paperFactor.toFixed(2)}</td></tr>
                <tr style={{ background: "var(--surface-2)" }}><td>Prix unitaire</td><td></td><td className="num price">{Pricing.fmtCHF(result.unit)}</td></tr>
                <tr><td>{t("quantity")}</td><td>{result.qty} exemplaires</td><td className="num">× {result.qty}</td></tr>
                <tr><td>Sous-total</td><td></td><td className="num price">{Pricing.fmtCHF(result.subtotal)}</td></tr>
                {result.discountPct > 0 && <tr style={{ color: "var(--ok)" }}><td>{t("discount")}</td><td>palier {result.tier.from}+ ({(result.discountPct*100).toFixed(0)} %)</td><td className="num">− {Pricing.fmtCHF(result.discountAmount)}</td></tr>}
                <tr style={{ color: "var(--brand-700)" }}><td>{t("subjects_fee")}</td><td>{result.subj} sujet{result.subj > 1 ? "s" : ""}</td><td className="num">+ {Pricing.fmtCHF(result.subjectFee)}</td></tr>
                {result.expressPct > 0 && <tr style={{ color: "var(--warn)" }}><td>{t("express_fee")}</td><td>+ {(result.expressPct*100).toFixed(0)} %</td><td className="num">+ {Pricing.fmtCHF(result.expressAmount)}</td></tr>}
                <tr style={{ background: "var(--surface-2)", fontWeight: 700 }}><td>{t("total_ht")}</td><td></td><td className="num price">{Pricing.fmtCHF(result.totalHT)}</td></tr>
                <tr><td className="muted">{t("vat")}</td><td></td><td className="num muted">{Pricing.fmtCHF(result.vat)}</td></tr>
                <tr style={{ background: "var(--brand-50)", fontWeight: 700, color: "var(--brand-800)" }}><td>{t("total_ttc")}</td><td></td><td className="num">{Pricing.fmtCHF(result.totalTTC)}</td></tr>
              </tbody>
            </table>
          </div>
          <SummaryPanel result={result} t={t} lang={lang} onOpenQuote={onOpenQuote} />
        </div>
      )}
    </div>
  );
}

window.CalcForm = CalcForm;
window.CalcWizard = CalcWizard;
window.CalcCompact = CalcCompact;
