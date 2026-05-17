// Legal: cookies banner, footer, mentions légales modal, privacy policy modal.
// Texts target Switzerland (nLPD/FADP) with GDPR-style transparency for EU
// visitors. NOT a substitute for legal review — adapt to your reality.

function CookiesBanner({ db }) {
  const KEY = "ooh_cookies_consent_v1";
  const [open, setOpen] = useState(() => !localStorage.getItem(KEY));
  if (db && db.cookies_banner_enabled === false) return null;
  if (!open) return null;
  const set = (val) => { localStorage.setItem(KEY, val); setOpen(false); };
  return (
    <div style={{
      position: "fixed", bottom: 16, left: 16, right: 16, zIndex: 90,
      background: "var(--ink)", color: "white",
      borderRadius: 10, padding: "14px 18px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
      display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
      maxWidth: 1100, margin: "0 auto",
    }}>
      <span style={{ fontSize: 20 }}>🍪</span>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5, minWidth: 240 }}>
        Ce site utilise uniquement des <strong>cookies fonctionnels</strong> (préférence de langue,
        session admin, panier de devis) — pas de tracking publicitaire, pas d'analytics tiers.
        Voir la <a style={{ color: "#a8c4f0" }} href="#privacy" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("open-legal", { detail: "privacy" })); }}>politique de confidentialité</a>.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => set("refused")}
          style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "white", background: "transparent", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 5 }}>
          Refuser
        </button>
        <button onClick={() => set("accepted")}
          style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "var(--ink)", background: "white", border: "none", borderRadius: 5 }}>
          Accepter
        </button>
      </div>
    </div>
  );
}

// Parse a footer line and replace magic tokens with React nodes.
// Tokens:  {{legal}} {{privacy}} {{cookies}} {{email:foo@bar.ch}} {{contact_email}} {{year}}
function renderFooterLine(line, onOpen, contactEmail) {
  if (!line) return null;
  let replaced = String(line).replace(/{{year}}/g, String(new Date().getFullYear()));
  if (contactEmail) replaced = replaced.replace(/{{contact_email}}/g, `{{email:${contactEmail}}}`);
  const re = /\{\{(legal|privacy|cookies|email:[^}]+)\}\}/g;
  const parts = [];
  let last = 0; let m; let key = 0;
  while ((m = re.exec(replaced)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{replaced.slice(last, m.index)}</span>);
    const tok = m[1];
    if (tok === "legal" || tok === "privacy" || tok === "cookies") {
      const labels = {
        legal: "Mentions légales", privacy: "Politique de confidentialité", cookies: "Cookies",
      };
      parts.push(
        <a key={key++} href={`#${tok}`} onClick={(e) => { e.preventDefault(); onOpen(tok); }}>
          {labels[tok]}
        </a>
      );
    } else if (tok.startsWith("email:")) {
      const addr = tok.slice(6);
      parts.push(<a key={key++} href={`mailto:${addr}`}>{addr}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < replaced.length) parts.push(<span key={key++}>{replaced.slice(last)}</span>);
  return parts;
}

function Footer({ onOpen, lang, db }) {
  const footerCfg = (db && db.footer) || { enabled: true, sections: [] };
  const contactEmail = (db && db.contact_email) || CONFIG.contact_email;
  if (!footerCfg.enabled) return null;
  const sections = (footerCfg.sections || []).filter((s) => s.enabled !== false);
  if (sections.length === 0) return null;

  return (
    <footer style={{
      maxWidth: "var(--maxw)", margin: "0 auto",
      padding: "32px 24px 40px",
      borderTop: "1px solid var(--line)",
      display: "grid", gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))`, gap: 28,
      fontSize: 12, color: "var(--ink-3)",
    }}>
      {sections.map((s) => (
        <div key={s.id} style={{
          textAlign: s.align === "right" ? "right" : "left",
          alignSelf: s.align === "right" ? "end" : "start",
        }}>
          {s.title && (
            <div style={{
              fontWeight: 700, color: "var(--ink-2)", marginBottom: 8,
              fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5,
            }}>{s.title}</div>
          )}
          {(s.lines || []).map((line, i) => (
            <div key={i} style={{
              fontWeight: s.bold_first && i === 0 ? 600 : 400,
              color: s.bold_first && i === 0 ? "var(--ink-2)" : (s.muted ? "var(--ink-4)" : "var(--ink-3)"),
              marginBottom: 2,
            }}>
              {renderFooterLine(line, onOpen, contactEmail)}
            </div>
          ))}
        </div>
      ))}
    </footer>
  );
}

function LegalModal({ page, onClose, db, lang }) {
  if (!page) return null;
  const docs = (db && db.legal_pages) || {};
  const doc = docs[page] || {};
  const title = (lang === "fr" ? doc.title_fr : doc.title_en) ||
    (page === "legal" ? "Mentions légales" : page === "privacy" ? "Politique de confidentialité" : "Politique cookies");
  const content = (lang === "fr" ? doc.content_fr : doc.content_en) || "";

  const html = useMemo(() => {
    if (!window.marked) return `<p>${escapeHtml(content)}</p>`;
    try {
      return window.marked.parse(content, { breaks: true, gfm: true });
    } catch {
      return `<pre>${escapeHtml(content)}</pre>`;
    }
  }, [content]);

  return (
    <Modal open={!!page} onClose={onClose} width={760}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Mise à jour : mai 2026</div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
      </div>
      <div className="legal-body"
        style={{ padding: 24, maxHeight: "70vh", overflow: "auto", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex" }}>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={onClose}>OK</button>
      </div>
    </Modal>
  );
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.CookiesBanner = CookiesBanner;
window.Footer = Footer;
window.LegalModal = LegalModal;
