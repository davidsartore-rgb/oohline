// Quote request modal — composes a mailto: link with full quote breakdown so
// the user's mail client opens pre-filled. No real backend needed for a
// prototype, no data ever leaves the browser via this app.

function QuoteModal({ open, onClose, result, lang, onSent, db }) {
  const t = useT(lang);
  const [form, setForm] = useState({ company: "", name: "", email: "", phone: "", message: "" });
  const [stage, setStage] = useState("form"); // form | preview | sent
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (open) {
      setStage("form");
      setConsent(false);
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

  const { fmt, paper, qty, subj, subjectFee, unit, totalHT, totalTTC, unitEffective,
          discountPct, expressPct, discountAmount, expressAmount, vat } = result;

  const subject = `Demande de devis OOH — ${fmt.code} × ${qty} ex.`;

  const body = [
    `Bonjour,`,
    ``,
    `Je souhaite recevoir un devis pour la commande suivante :`,
    ``,
    `─ COMMANDE ──────────────────────────────`,
    `Format       : ${fmt.code} — ${lang === "fr" ? fmt.name_fr : fmt.name_en}`,
    `Dimensions   : ${fmt.width_cm} × ${fmt.height_cm} cm`,
    `Papier       : ${paper ? (lang === "fr" ? paper.name_fr : paper.name_en) : "—"}`,
    `Quantité     : ${qty} exemplaires`,
    `Sujets       : ${subj} visuel${subj > 1 ? "s" : ""} différent${subj > 1 ? "s" : ""}`,
    `Délai        : ${expressPct > 0 ? "Express (48 h)" : "Standard (5 jours)"}`,
    ``,
    `─ DEVIS INDICATIF (calculateur en ligne) ─`,
    `Prix unitaire     : ${Pricing.fmtCHF(unit)} / ex.`,
    `Sous-total        : ${Pricing.fmtCHF(unit * qty)}`,
    discountPct > 0 ? `Remise volume     : − ${Pricing.fmtCHF(discountAmount)} (${(discountPct*100).toFixed(0)} %)` : null,
    `Traitement fichiers (${subj} sujet${subj > 1 ? "s" : ""}) : + ${Pricing.fmtCHF(subjectFee)}`,
    expressPct > 0 ? `Majoration express : + ${Pricing.fmtCHF(expressAmount)} (${(expressPct*100).toFixed(0)} %)` : null,
    `Total HT          : ${Pricing.fmtCHF(totalHT)}`,
    `TVA 8,1 %         : ${Pricing.fmtCHF(vat)}`,
    `TOTAL TTC         : ${Pricing.fmtCHF(totalTTC)}`,
    ``,
    `─ CONTACT ───────────────────────────────`,
    `Entreprise   : ${form.company}`,
    `Nom          : ${form.name}`,
    `Email        : ${form.email}`,
    form.phone ? `Téléphone    : ${form.phone}` : null,
    ``,
    form.message ? `─ MESSAGE ───────────────────────────────\n${form.message}\n` : null,
    `Merci de me confirmer ce devis et de m'indiquer la procédure pour l'envoi du visuel.`,
    ``,
    `Cordialement,`,
    form.name,
  ].filter(Boolean).join("\n");

  const contactEmail = (db && db.contact_email) || CONFIG.contact_email;

  const mailto = `mailto:${encodeURIComponent(contactEmail)}`
    + `?subject=${encodeURIComponent(subject)}`
    + `&body=${encodeURIComponent(body)}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      onSent && onSent("📋 Récapitulatif copié dans le presse-papier.");
    } catch {
      onSent && onSent("Impossible de copier — sélectionnez le texte manuellement.");
    }
  };

  const goPreview = (e) => {
    e.preventDefault();
    if (!consent) return;
    setStage("preview");
  };

  const goSend = () => {
    window.location.href = mailto;
    setStage("sent");
    onSent && onSent(t("sent_ok"));
  };

  return (
    <Modal open={open} onClose={onClose} width={640}>
      {stage === "form" && (
        <form onSubmit={goPreview}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>{t("quote_title")}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {t("quote_sub")} La demande s'ouvre dans votre client mail à destination de <code className="kbd">{contactEmail}</code>.
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
          </div>

          <div style={{ padding: 20, background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <FormatThumb fmt={fmt} size={56} showLabel={false} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{fmt.code} · {lang === "fr" ? fmt.name_fr : fmt.name_en}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {qty} ex. · {subj} sujet{subj > 1 ? "s" : ""} · {paper ? (lang === "fr" ? paper.name_fr : paper.name_en) : "—"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{Pricing.fmtCHF(totalHT)}</div>
                <div className="muted" style={{ fontSize: 11 }}>{t("total_ht")} · {Pricing.fmtCHF(totalTTC)} TTC</div>
              </div>
            </div>
          </div>

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
                J'accepte que mes coordonnées soient transmises à <strong>{CONFIG.company_name}</strong> par
                email pour le traitement de cette demande de devis. Conservation max {CONFIG.retention_months} mois.
                Détails dans la <a href="#privacy" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("open-legal", { detail: "privacy" })); }}>politique de confidentialité</a>. *
              </span>
            </label>
          </div>

          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 11 }}>* champs obligatoires</span>
            <div className="spacer" />
            <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
            <button type="submit" disabled={!consent} className="btn btn-primary">Aperçu & envoi →</button>
          </div>
        </form>
      )}

      {stage === "preview" && (
        <div>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Aperçu de l'email</div>
            <div className="muted" style={{ fontSize: 12 }}>Voici ce qui sera envoyé à {contactEmail}. Vous pouvez ajuster avant l'envoi dans votre client mail.</div>
          </div>
          <div style={{ padding: 24, fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.6, background: "var(--surface-2)", borderBottom: "1px solid var(--line)", maxHeight: 360, overflow: "auto", whiteSpace: "pre-wrap" }}>
            <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
              <div><strong>À :</strong> {contactEmail}</div>
              <div><strong>Objet :</strong> {subject}</div>
            </div>
            {body}
          </div>
          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" className="btn" onClick={() => setStage("form")}>← Modifier</button>
            <div className="spacer" />
            <button type="button" className="btn" onClick={copyToClipboard}>📋 Copier</button>
            <button type="button" className="btn btn-primary" onClick={goSend}>✉ Ouvrir mon client mail</button>
          </div>
        </div>
      )}

      {stage === "sent" && (
        <div style={{ padding: 36, textAlign: "center" }}>
          <div style={{ width: 60, height: 60, margin: "0 auto 16px", borderRadius: 100, background: "var(--ok-bg)", color: "var(--ok)", display: "grid", placeItems: "center", fontSize: 28, fontWeight: 700 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Votre client mail s'est ouvert</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            Vérifiez que l'email s'est bien ouvert dans votre messagerie, puis envoyez-le.
          </div>
          <div className="muted-2" style={{ fontSize: 12, marginBottom: 20 }}>
            Si rien ne s'est passé, copiez le récapitulatif et écrivez-nous manuellement à<br/>
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="btn" onClick={() => setStage("preview")}>← Retour à l'aperçu</button>
            <button className="btn btn-primary" onClick={onClose}>Fermer</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

window.QuoteModal = QuoteModal;
