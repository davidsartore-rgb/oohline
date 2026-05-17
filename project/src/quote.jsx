// Quote request modal — POSTs to /api/public/quote-requests.
// Server recomputes pricing before saving; never trusts client totals.

function QuoteModal({ open, onClose, result, lang, onSent, db }) {
  const t = useT(lang);
  const [form, setForm] = useState({ company: "", name: "", email: "", phone: "", message: "" });
  const [stage, setStage] = useState("form"); // form | sending | sent | error
  const [consent, setConsent] = useState(false);
  const [reference, setReference] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (open) {
      setStage("form");
      setConsent(false);
      setErrorMsg("");
      setReference("");
      setForm({ company: "", name: "", email: "", phone: "", message: "" });
    }
  }, [open]);

  if (!result) return (
    <Modal open={open} onClose={onClose}>
      <div className="card-pad" style={{ padding: 28 }}>
        <div className="muted">{t("no_quote")}</div>
        <button className="btn" style={{ marginTop: 16 }} onClick={onClose}>{t("cancel")}</button>
      </div>
    </Modal>
  );

  const { fmt, paper, qty, subj, express, totalHT, totalTTC } = result;

  const contactEmail = (db && db.contact_email) || CONFIG.contact_email;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!consent) return;
    setStage("sending");
    setErrorMsg("");
    try {
      const r = await fetch("/api/public/quote-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formatCode: fmt.code,
          paperId: paper ? paper.id : null,
          quantity: qty,
          subjects: subj,
          express: !!express,
          company: form.company,
          contactName: form.name,
          email: form.email,
          phone: form.phone || null,
          message: form.message || null,
          consent: true,
          lang: lang || "fr",
        }),
      });
      if (r.ok) {
        const data = await r.json();
        setReference(data.reference || "");
        setStage("sent");
        onSent && onSent(lang === "en" ? "Quote request sent!" : "Demande de devis envoyée !");
      } else {
        let msg = lang === "en" ? "Submission failed. Please try again." : "Envoi échoué. Veuillez réessayer.";
        try {
          const err = await r.json();
          if (err?.error?.message) msg = err.error.message;
        } catch {}
        setErrorMsg(msg);
        setStage("error");
      }
    } catch {
      setErrorMsg(lang === "en" ? "Network error. Please check your connection." : "Erreur réseau. Vérifiez votre connexion.");
      setStage("error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} width={600}>
      {(stage === "form" || stage === "error") && (
        <form onSubmit={handleSubmit}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{t("quote_title")}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {lang === "en"
                  ? "We will get back to you within one business day."
                  : "Nous vous répondons dans un délai d'un jour ouvrable."}
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
          </div>

          <div style={{ padding: 16, background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <FormatThumb fmt={fmt} size={52} showLabel={false} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{fmt.code} · {lang === "fr" ? fmt.name_fr : fmt.name_en}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {qty} ex. · {subj} sujet{subj > 1 ? "s" : ""} · {paper ? (lang === "fr" ? paper.name_fr : paper.name_en) : "—"}
                  {express ? <span style={{ marginLeft: 6, color: "var(--accent)" }}>· Express 48 h</span> : null}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{Pricing.fmtCHF(totalHT)}</div>
                <div className="muted" style={{ fontSize: 11 }}>{t("total_ht")} · {Pricing.fmtCHF(totalTTC)} TTC</div>
              </div>
            </div>
          </div>

          {stage === "error" && (
            <div style={{ padding: "10px 24px", background: "var(--err-bg, #fff1f0)", color: "var(--err, #c0392b)", fontSize: 13, borderBottom: "1px solid var(--line)" }}>
              {errorMsg}
            </div>
          )}

          <div className="form-2col" style={{ padding: 24 }}>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <div className="field-label">{t("company")} *</div>
              <input required className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="field">
              <div className="field-label">{t("contact_name")} *</div>
              <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <div className="field-label">{t("email")} *</div>
              <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <div className="field-label">{t("phone")}</div>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <div className="field-label">{t("message")}</div>
              <textarea className="textarea" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>

            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5, cursor: "pointer" }}>
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                {lang === "en"
                  ? <>I agree that my contact details be shared with <strong>{CONFIG.company_name}</strong> to process this quote request. Stored for max {CONFIG.retention_months} months. See our <a href="#privacy" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("open-legal", { detail: "privacy" })); }}>privacy policy</a>. *</>
                  : <>J'accepte que mes coordonnées soient transmises à <strong>{CONFIG.company_name}</strong> pour le traitement de cette demande de devis. Conservation max {CONFIG.retention_months} mois. Voir la <a href="#privacy" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("open-legal", { detail: "privacy" })); }}>politique de confidentialité</a>. *</>
                }
              </span>
            </label>
          </div>

          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 11 }}>* {lang === "en" ? "required fields" : "champs obligatoires"}</span>
            <div className="spacer" />
            <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" disabled={!consent} className="btn btn-primary">
              {lang === "en" ? "Send request →" : "Envoyer la demande →"}
            </button>
          </div>
        </form>
      )}

      {stage === "sending" && (
        <div style={{ padding: 48, textAlign: "center" }}>
          <div className="spinner" style={{ width: 36, height: 36, margin: "0 auto 16px", border: "3px solid var(--line)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div className="muted">{lang === "en" ? "Sending your request…" : "Envoi en cours…"}</div>
        </div>
      )}

      {stage === "sent" && (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ width: 60, height: 60, margin: "0 auto 16px", borderRadius: 100, background: "var(--ok-bg)", color: "var(--ok)", display: "grid", placeItems: "center", fontSize: 28, fontWeight: 700 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            {lang === "en" ? "Request sent!" : "Demande envoyée !"}
          </div>
          {reference && (
            <div style={{ margin: "12px auto", display: "inline-block", padding: "6px 14px", background: "var(--surface-2)", borderRadius: 6, fontSize: 14, fontFamily: "var(--font-mono)", letterSpacing: "0.04em", border: "1px solid var(--line)" }}>
              {lang === "en" ? "Reference:" : "Référence :"} <strong>{reference}</strong>
            </div>
          )}
          <div className="muted" style={{ fontSize: 13, marginTop: 12, marginBottom: 6 }}>
            {lang === "en"
              ? <>A confirmation has been sent to <strong>{form.email}</strong>. We will get back to you within one business day at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</>
              : <>Une confirmation a été envoyée à <strong>{form.email}</strong>. Nous vous répondrons sous un jour ouvrable à <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</>
            }
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onClose}>
            {lang === "en" ? "Close" : "Fermer"}
          </button>
        </div>
      )}
    </Modal>
  );
}

window.QuoteModal = QuoteModal;
