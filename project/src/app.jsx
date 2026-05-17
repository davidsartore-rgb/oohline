// Main app — top bar, routing, tweaks, lang, admin auth.
//
// Admin access:
//   - NOT shown in the public top nav.
//   - Reachable at URL hash `#admin` (or by clicking the brand mark 3× in 1.5 s).
//   - Password-protected. Demo credentials are hard-coded in ADMIN_CREDS below.
//     Session is kept in sessionStorage so a reload during the day stays logged in.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "catalogLayout": "grid",
  "calcUx": "form",
  "defaultLang": "fr",
  "showTweaks": false
}/*EDITMODE-END*/;

// >>> Demo credentials are now stored in Auth (src/auth.js). The admin can
// change them in-app (Admin → Compte) or recover via the recovery code on the
// login screen. Default creds (until first change): admin / ooh2026.
const SESSION_KEY = "ooh_admin_session_v1";

function App() {
  const [db, setDb] = useState(() => DB.load());
  const [page, setPage] = useState(() => location.hash === "#admin" ? "admin" : "catalog");
  const [lang, setLang] = useState(TWEAK_DEFAULTS.defaultLang);
  const [pickedFormat, setPickedFormat] = useState(null);
  const [toast, setToast] = useState("");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [tweaks, setTweaks] = useTweaks(TWEAK_DEFAULTS);
  const [adminAuthed, setAdminAuthed] = useState(() => Auth.isLoggedIn());
  const [legalPage, setLegalPage] = useState(null);
  // Recovery token in URL hash (e.g. #recover=TOKEN)
  const [recoveryToken, setRecoveryToken] = useState(() => {
    const m = location.hash.match(/^#recover=(.+)/);
    return m ? m[1] : null;
  });

  const t = useT(lang);

  // Load live data from API on mount
  useEffect(() => {
    DB.refresh().then(data => { if (data) setDb(data); });
  }, []);

  useEffect(() => {
    const name = (db.header && db.header.brand_name) || t("brand_name");
    document.title = `${name}${page === "admin" ? " — Admin" : " — " + t("nav_" + page)}`;
  }, [lang, page, t, db.header]);

  // Open legal modals on event (from cookies banner, quote consent text, footer)
  useEffect(() => {
    const onOpen = (e) => setLegalPage(e.detail);
    window.addEventListener("open-legal", onOpen);
    return () => window.removeEventListener("open-legal", onOpen);
  }, []);

  // Hash → page sync (so user can bookmark/share #admin)
  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#admin") setPage("admin");
      else if (location.hash === "#calculator") setPage("calc");
      else if (location.hash === "" || location.hash === "#catalog") setPage("catalog");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const goPage = (next) => {
    setPage(next);
    if (next === "admin") location.hash = "#admin";
    else if (next === "catalog") history.replaceState(null, "", location.pathname);
    else if (next === "calc") location.hash = "#calculator";
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const onSelectFormat = (code) => {
    setPickedFormat(code);
    goPage("calc");
  };

  // shared calculator state (lifted so the quote modal can read the same result)
  const [calcState, setCalcState] = useState({
    formatCode: db.formats[0]?.code, quantity: 25, subjects: 1, express: false,
  });
  useEffect(() => {
    if (pickedFormat) setCalcState((s) => ({ ...s, formatCode: pickedFormat }));
  }, [pickedFormat]);

  const result = useMemo(() => Pricing.compute({ db, ...calcState }), [db, calcState]);

  // Brand-mark triple-click easter egg → opens admin
  const clickTimes = useRef([]);
  const onBrandClick = () => {
    const now = Date.now();
    clickTimes.current = [...clickTimes.current.filter((ts) => now - ts < 1500), now];
    if (clickTimes.current.length >= 3) {
      clickTimes.current = [];
      goPage("admin");
    }
  };

  const onLogin = async (u, p) => {
    if (await Auth.verifyLogin(u, p)) {
      Auth.startSession();
      setAdminAuthed(true);
      return true;
    }
    return false;
  };
  const onLogout = () => {
    Auth.endSession();
    setAdminAuthed(false);
    goPage("catalog");
  };

  return (
    <>
      <Topbar
        t={t}
        db={db}
        lang={lang} setLang={setLang}
        page={page} setPage={goPage}
        onBrandClick={onBrandClick}
        adminAuthed={adminAuthed}
        onLogout={onLogout}
      />

      {page === "catalog" && (
        <CatalogPage db={db} lang={lang} onSelectFormat={onSelectFormat} layout={tweaks.catalogLayout} />
      )}

      {page === "calc" && (
        <CalculatorBridge
          db={db} lang={lang}
          initialFormat={pickedFormat}
          ux={tweaks.calcUx}
          calcState={calcState} setCalcState={setCalcState}
          onOpenQuote={() => setQuoteOpen(true)}
        />
      )}

      {page === "admin" && (
        adminAuthed
          ? <AdminPage db={db} setDb={setDb} lang={lang} onSaved={() => showToast(t("saved"))} />
          : <LoginGate onLogin={onLogin} onCancel={() => goPage("catalog")} />
      )}

      <QuoteModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        result={result}
        lang={lang}
        db={db}
        onSent={(msg) => showToast(msg || t("sent_ok"))}
      />

      {recoveryToken && (
        <PasswordResetModal
          token={recoveryToken}
          onClose={() => { setRecoveryToken(null); history.replaceState(null, "", location.pathname); }}
          onSuccess={() => {
            setRecoveryToken(null);
            history.replaceState(null, "", location.pathname);
            showToast("Mot de passe mis à jour — connectez-vous.");
          }}
        />
      )}

      <Footer onOpen={(p) => setLegalPage(p)} lang={lang} db={db} />
      <CookiesBanner db={db} />
      <LegalModal page={legalPage} onClose={() => setLegalPage(null)} db={db} lang={lang} />

      <Toast msg={toast} />

      <TweaksPanel title="Tweaks" noDeckControls>
        <TweakSection label="Variations">
          <TweakRadio
            label="Catalogue"
            value={tweaks.catalogLayout}
            onChange={(v) => setTweaks("catalogLayout", v)}
            options={[
              { value: "grid", label: "Grille" },
              { value: "table", label: "Tableau" },
              { value: "split", label: "Mixte" },
            ]}
          />
          <TweakSelect
            label="Calculateur"
            value={tweaks.calcUx}
            onChange={(v) => setTweaks("calcUx", v)}
            options={[
              { value: "form", label: "Formulaire + résumé latéral" },
              { value: "wizard", label: "Wizard étape par étape" },
              { value: "compact", label: "Compact (tout en ligne)" },
            ]}
          />
        </TweakSection>
        <TweakSection label="Langue par défaut">
          <TweakRadio
            label="Langue"
            value={tweaks.defaultLang}
            onChange={(v) => { setTweaks("defaultLang", v); setLang(v); }}
            options={[{ value: "fr", label: "FR" }, { value: "en", label: "EN" }]}
          />
        </TweakSection>
        <TweakSection label="Accès admin">
          <div style={{ fontSize: 11, color: "var(--ink-3)", padding: "4px 0 8px", lineHeight: 1.5 }}>
            URL <code className="kbd">#admin</code> · ou 3 clics sur le logo<br/>
            Login démo : <code className="kbd">admin</code> / <code className="kbd">ooh2026</code> (à changer)<br/>
            <span className="muted-2">Mots de passe hachés (SHA-256). Code de récupération dans <code>src/auth.js</code>.</span>
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// Bridge: re-uses lifted state so quote modal can read the same result
function CalculatorBridge({ db, lang, initialFormat, ux, calcState, setCalcState, onOpenQuote }) {
  const t = useT(lang);
  const set = (key, val) => setCalcState((s) => ({ ...s, [key]: val }));

  // Available formats = formats whose section is enabled
  const enabledSections = useMemo(
    () => (db.sections || []).filter((s) => s.enabled !== false),
    [db.sections]
  );
  const enabledSectionIds = useMemo(() => enabledSections.map((s) => s.id), [enabledSections]);

  const visibleFormats = useMemo(
    () => db.formats.filter((f) => !f.section || enabledSectionIds.includes(f.section)),
    [db.formats, enabledSectionIds]
  );

  // Section filter chips (only shown if 2+ sections enabled)
  const [activeSectionId, setActiveSectionId] = useState(() => enabledSections[0]?.id || "all");
  // Re-sync if sections change
  useEffect(() => {
    if (activeSectionId !== "all" && !enabledSectionIds.includes(activeSectionId)) {
      setActiveSectionId(enabledSections[0]?.id || "all");
    }
  }, [enabledSectionIds]); // eslint-disable-line

  const showSectionFilter = enabledSections.length > 1;
  const filteredFormats = showSectionFilter && activeSectionId !== "all"
    ? visibleFormats.filter((f) => f.section === activeSectionId)
    : visibleFormats;

  // Make sure the selected format is in the filtered list. If a user picked a
  // format from a section then changed section, switch to the first format of
  // the new filter.
  useEffect(() => {
    if (filteredFormats.length === 0) return;
    if (!filteredFormats.find((f) => f.code === calcState.formatCode)) {
      set("formatCode", filteredFormats[0].code);
    }
  }, [filteredFormats]); // eslint-disable-line

  // If the user arrived from the catalogue with a specific format, jump to its section
  useEffect(() => {
    if (!initialFormat) return;
    const fmt = db.formats.find((f) => f.code === initialFormat);
    if (fmt && fmt.section && enabledSectionIds.includes(fmt.section) && showSectionFilter) {
      setActiveSectionId(fmt.section);
    }
  }, [initialFormat, db, enabledSectionIds, showSectionFilter]);

  const result = useMemo(() => Pricing.compute({ db, ...calcState }), [db, calcState]);

  const shared = {
    db, t, lang,
    formats: filteredFormats,
    formatCode: calcState.formatCode, setFormatCode: (v) => set("formatCode", v),
    quantity: calcState.quantity, setQuantity: (v) => set("quantity", v),
    subjects: calcState.subjects, setSubjects: (v) => set("subjects", v),
    express: calcState.express, setExpress: (v) => set("express", v),
    result, onOpenQuote,
  };

  return (
    <div className="page" data-screen-label="Calculator">
      <div className="page-head">
        <div className="breadcrumb">
          {(() => {
            const bn = db.header && db.header.brand_name;
            const v = bn === undefined ? t("brand_name") : bn;
            return v ? <><span>{v}</span><span className="sep">/</span></> : null;
          })()}
          <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{t("nav_calc")}</span>
        </div>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h1 className="page-title">{getPageText(db, "calc", "title", lang, t("page_calc_title"))}</h1>
            <p className="page-sub">{getPageText(db, "calc", "sub", lang, t("page_calc_sub"))}</p>
          </div>
          <span className="badge badge-ok">● {t("instant_quote")}</span>
        </div>

        {showSectionFilter && (
          <div style={{ display: "flex", gap: 6, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 12, marginRight: 4, fontWeight: 500 }}>Type :</span>
            {enabledSections.map((s) => (
              <button key={s.id}
                className={`chip ${activeSectionId === s.id ? "on" : ""}`}
                onClick={() => setActiveSectionId(s.id)}
              >{s.id} — {((lang === "fr" ? s.name_fr : s.name_en) || s.id).replace(/^.* — /, "")}</button>
            ))}
            <button
              className={`chip ${activeSectionId === "all" ? "on" : ""}`}
              onClick={() => setActiveSectionId("all")}
            >Tous</button>
          </div>
        )}
      </div>

      {filteredFormats.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: "center", padding: 60, color: "var(--ink-3)" }}>
          Aucun format disponible. Activez au moins une section dans l'administration.
        </div>
      ) : (
        <>
          {ux === "form" && <CalcForm {...shared} />}
          {ux === "wizard" && <CalcWizard {...shared} />}
          {ux === "compact" && <CalcCompact {...shared} />}
        </>
      )}
    </div>
  );
}

function Topbar({ t, db, lang, setLang, page, setPage, onBrandClick, adminAuthed, onLogout }) {
  const header = (db && db.header) || {};
  // Empty string = explicitly hidden by admin. Only fall back to translation
  // when the field has never been set (undefined).
  const brandName = header.brand_name !== undefined ? header.brand_name : t("brand_name");
  const brandTag = header.brand_tag !== undefined ? header.brand_tag : t("brand_tag");
  const showStatus = header.show_status !== false;
  const showLang = header.show_lang !== false;
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="brand" onClick={onBrandClick} style={{ cursor: "pointer", userSelect: "none" }} title="">
          {header.logo ? (
            <img
              src={header.logo}
              alt={header.logo_alt || brandName}
              style={{ height: 40, width: "auto", maxWidth: 200, objectFit: "contain", display: "block" }}
            />
          ) : (
            <div className="brand-mark">{(brandName || "A").slice(0, 1).toUpperCase()}</div>
          )}
          {brandName && (
            <div>
              <div className="brand-name">{brandName}</div>
            </div>
          )}
          {brandTag && <span className="brand-tag">{brandTag}</span>}
        </div>

        <nav className="topnav">
          <button className={page === "catalog" ? "active" : ""} onClick={() => setPage("catalog")}>{t("nav_catalog")}</button>
          <button className={page === "calc" ? "active" : ""} onClick={() => setPage("calc")}>{t("nav_calc")}</button>
          {page === "admin" && (
            <button className="active" onClick={() => setPage("admin")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11 }}>🔒</span> {t("nav_admin")}
            </button>
          )}
        </nav>

        <div className="topbar-right">
          {showLang && (
            <div className="lang-switch">
              <button className={lang === "fr" ? "on" : ""} onClick={() => setLang("fr")}>FR</button>
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
            </div>
          )}
          {page === "admin" && adminAuthed ? (
            <button className="btn btn-sm" onClick={onLogout}>↪ Déconnexion</button>
          ) : showStatus ? (
            <button className="btn btn-sm" style={{ gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 100, background: "var(--ok)" }}></span>
              <span className="muted" style={{ fontWeight: 500 }}>Tous systèmes opérationnels</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Login gate for admin ───
function LoginGate({ onLogin, onCancel }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await onLogin(u.trim(), p);
    setBusy(false);
    if (!ok) setErr(true);
  };
  return (
    <div style={{ minHeight: "calc(100vh - var(--header-h))", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={submit} className="card" style={{ width: 380, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--brand-700)", color: "white", display: "grid", placeItems: "center", fontSize: 16 }}>🔒</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>Accès administrateur</div>
            <div className="muted" style={{ fontSize: 12 }}>Administration de la base de prix</div>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <div className="field-label">Identifiant</div>
          <input autoFocus className="input" value={u} onChange={(e) => { setU(e.target.value); setErr(false); }} />
        </div>
        <div className="field" style={{ marginBottom: 6 }}>
          <div className="field-label">Mot de passe</div>
          <input type="password" className="input" value={p} onChange={(e) => { setP(e.target.value); setErr(false); }} />
        </div>
        <div style={{ textAlign: "right", marginBottom: 14 }}>
          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "2px 0", color: "var(--brand-600)", fontSize: 11 }}
            onClick={() => setRecoveryOpen(true)}>
            Mot de passe oublié ?
          </button>
        </div>

        {err && (
          <div style={{ padding: "8px 12px", background: "var(--err-bg)", color: "var(--err)", borderRadius: 5, fontSize: 12, marginBottom: 14 }}>
            ⚠ Identifiants incorrects.
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button type="button" className="btn" onClick={onCancel} style={{ flex: 1, justifyContent: "center" }}>Retour</button>
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>
            {busy ? "Vérification…" : "Se connecter →"}
          </button>
        </div>
      </form>

      <RecoveryModal
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        onSuccess={async () => {
          setRecoveryOpen(false);
          const username = await Auth.getUsername();
          setU(username);
          setP("");
        }}
      />
    </div>
  );
}

function RecoveryModal({ open, onClose, onSuccess }) {
  const [step, setStep] = useState(0); // 0: email, 1: sent
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { if (open) { setStep(0); setEmail(""); setErr(""); } }, [open]);

  const sendLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setErr("Email requis.");
    setBusy(true);
    const ok = await Auth.startRecovery(email.trim());
    setBusy(false);
    if (ok) setStep(1);
    else setErr("Impossible d'envoyer l'email. Vérifiez votre adresse.");
  };

  return (
    <Modal open={open} onClose={onClose} width={420}>
      {step === 0 && (
        <form onSubmit={sendLink}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Récupération d'accès</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Un lien de réinitialisation sera envoyé à votre adresse de récupération.
            </div>
          </div>
          <div style={{ padding: 24 }}>
            <div className="field">
              <div className="field-label">Email de récupération</div>
              <input autoFocus type="email" className="input" placeholder="admin@votredomaine.ch"
                value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
              <div className="field-hint">L'adresse configurée dans Admin → Compte → Email de récupération.</div>
            </div>
            {err && <div style={{ padding: "8px 12px", background: "var(--err-bg)", color: "var(--err)", borderRadius: 5, fontSize: 12, marginTop: 12 }}>⚠ {err}</div>}
          </div>
          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 10 }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>Annuler</button>
            <button type="submit" disabled={busy} className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>
              {busy ? "Envoi…" : "Envoyer le lien →"}
            </button>
          </div>
        </form>
      )}
      {step === 1 && (
        <div style={{ padding: 36, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 14 }}>📧</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Lien envoyé !</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            Consultez votre email et cliquez sur le lien de récupération.<br />
            Valable 24 heures, usage unique.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={onClose}>OK</button>
        </div>
      )}
    </Modal>
  );
}

// Password reset modal — triggered by #recover=TOKEN in URL
function PasswordResetModal({ token, onClose, onSuccess }) {
  const [u, setU] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (p1.length < 8) return setErr("Mot de passe : 8 caractères minimum.");
    if (p1 !== p2) return setErr("Les mots de passe ne correspondent pas.");
    setBusy(true);
    try {
      await Auth.completeRecovery({ token, newPassword: p1, newUsername: u.trim() || undefined });
      setDone(true);
      setTimeout(() => onSuccess && onSuccess(), 1500);
    } catch (e) {
      setErr(e.message || "Erreur lors de la réinitialisation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} width={400}>
      {done ? (
        <div style={{ padding: 36, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 14px", borderRadius: 100, background: "var(--ok-bg)", color: "var(--ok)", display: "grid", placeItems: "center", fontSize: 26 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Mot de passe mis à jour</div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Nouveau mot de passe</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Définissez vos nouveaux identifiants.</div>
          </div>
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field">
              <div className="field-label">Identifiant (laisser vide pour conserver)</div>
              <input className="input" value={u} onChange={(e) => { setU(e.target.value); setErr(""); }} />
            </div>
            <div className="field">
              <div className="field-label">Nouveau mot de passe</div>
              <input type="password" className="input" autoFocus value={p1} onChange={(e) => { setP1(e.target.value); setErr(""); }} />
            </div>
            <div className="field">
              <div className="field-label">Confirmation</div>
              <input type="password" className="input" value={p2} onChange={(e) => { setP2(e.target.value); setErr(""); }} />
            </div>
            {err && <div style={{ padding: "8px 12px", background: "var(--err-bg)", color: "var(--err)", borderRadius: 5, fontSize: 12 }}>⚠ {err}</div>}
          </div>
          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 10 }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>Annuler</button>
            <button type="submit" disabled={busy} className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

window.App = App;
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
