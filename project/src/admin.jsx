// Admin BDD — formats, tiers, subject multipliers, papers

// ─── Row reorder cell (up/down arrows + drag handle) ───
function RowReorderCell({ index, total, onMove, onDragStart, onDragOver, onDrop }) {
  return (
    <td style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <span
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          title="Glisser pour réorganiser"
          style={{
            cursor: "grab", padding: "4px 6px",
            color: "var(--ink-4)", fontSize: 14, lineHeight: 1,
            userSelect: "none",
          }}>⋮⋮</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)}
            title="Monter"
            style={{
              padding: "0 4px", fontSize: 9, lineHeight: 1, height: 14,
              color: index === 0 ? "var(--ink-5)" : "var(--ink-3)",
              cursor: index === 0 ? "default" : "pointer",
            }}>▲</button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}
            title="Descendre"
            style={{
              padding: "0 4px", fontSize: 9, lineHeight: 1, height: 14,
              color: index === total - 1 ? "var(--ink-5)" : "var(--ink-3)",
              cursor: index === total - 1 ? "default" : "pointer",
            }}>▼</button>
        </div>
      </div>
    </td>
  );
}

// Hook returning helpers for HTML5 drag-and-drop reordering of an array key in the DB
function useReorderHandlers(db, update, key) {
  const dragIndex = useRef(null);
  const move = (from, to) => {
    const arr = [...(db[key] || [])];
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return;
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    update({ [key]: arr });
  };
  const dragStart = (i) => (e) => { dragIndex.current = i; e.dataTransfer.effectAllowed = "move"; };
  const dragOver = (i) => (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const drop = (i) => (e) => {
    e.preventDefault();
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from == null || from === i) return;
    move(from, i);
  };
  return { move, dragStart, dragOver, drop };
}

window.RowReorderCell = RowReorderCell;
window.useReorderHandlers = useReorderHandlers;

function AdminPage({ db, setDb, lang, onSaved }) {
  const t = useT(lang);
  const [tab, setTab] = useState("formats");

  const tabs = [
    { id: "sections", label: "Sections" },
    { id: "formats", label: t("tab_formats") },
    { id: "tiers", label: t("tab_tiers") },
    { id: "subjects", label: t("tab_subjects") },
    { id: "options", label: t("tab_options") },
    { id: "shipping", label: "Livraison" },
    { id: "texts", label: "Textes" },
    { id: "legal", label: "Légal" },
    { id: "header", label: "En-tête" },
    { id: "footer", label: "Pied de page" },
    { id: "account", label: "Compte" },
  ];

  const [saveError, setSaveError] = useState(null);

  const update = async (patch) => {
    const next = { ...db, ...patch };
    setDb(next);
    try {
      await DB.save(next);
      setSaveError(null);
      onSaved && onSaved();
    } catch (err) {
      console.error("[Admin] Save failed:", err);
      setSaveError(err.message);
    }
  };

  const resetAll = () => {
    if (confirm(t("confirm_reset"))) {
      const fresh = DB.reset();
      setDb(fresh);
      onSaved && onSaved();
    }
  };

  return (
    <div className="page">
      {saveError && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <span>⚠️ Erreur de sauvegarde : {saveError}</span>
          <button onClick={() => setSaveError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}
      <div className="page-head">
        <div className="breadcrumb">
          {(() => {
            const bn = db.header && db.header.brand_name;
            const v = bn === undefined ? t("brand_name") : bn;
            return v ? <><span>{v}</span><span className="sep">/</span></> : null;
          })()}
          <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{t("nav_admin")}</span>
        </div>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h1 className="page-title">{t("page_admin_title")}</h1>
            <p className="page-sub">{t("page_admin_sub")}</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge">{db.formats.length} {t("formats_count")}</span>
            <ImportExportMenu db={db} setDb={(next) => { setDb(next); DB.save(next); onSaved && onSaved(); }} tab={tab} />
            <button className="btn" onClick={resetAll}>↺ {t("reset")}</button>
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 14px", background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 6, marginBottom: 18, fontSize: 12, color: "var(--brand-800)", display: "flex", alignItems: "center", gap: 8 }}>
        <span>💾</span> {t("saved_locally")}
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "sections" && <SectionsTab db={db} update={update} t={t} lang={lang} />}
      {tab === "formats" && <FormatsTab db={db} update={update} t={t} lang={lang} />}
      {tab === "tiers" && <TiersTab db={db} update={update} t={t} />}
      {tab === "subjects" && <SubjectsTab db={db} update={update} t={t} />}
      {tab === "options" && <OptionsTab db={db} update={update} t={t} lang={lang} />}
      {tab === "shipping" && <ShippingTab db={db} update={update} t={t} lang={lang} />}
      {tab === "texts" && <TextsTab db={db} update={update} />}
      {tab === "legal" && <LegalTab db={db} update={update} />}
      {tab === "header" && <HeaderTab db={db} update={update} />}
      {tab === "footer" && <FooterTab db={db} update={update} t={t} />}
      {tab === "account" && <AccountTab onSaved={() => onSaved && onSaved()} />}
    </div>
  );
}

// Toggle for 2FA enabled state (persisted via Auth).
function TwoFactorToggle() {
  const [on, setOn] = useState(() => Auth.isTwoFactorEnabled());
  const flip = () => {
    const next = !on;
    Auth.setTwoFactorEnabled(next);
    setOn(next);
  };
  return <Toggle on={on} onChange={flip} />;
}

// ─── Account: change admin credentials ───
function AccountTab({ onSaved }) {
  const [username, setUsername] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [oldP, setOldP] = useState("");
  const [u, setU] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const name = await Auth.getUsername();
    const def = await Auth.isDefault();
    setUsername(name); setU(name); setIsDefault(def);
  };
  useEffect(() => { reload(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setOk(false);
    if (busy) return;
    setBusy(true);
    try {
      if (!(await Auth.verifyLogin(username, oldP))) { setErr("Mot de passe actuel incorrect."); return; }
      if (!u.trim()) { setErr("Identifiant requis."); return; }
      if (p1.length < 4) { setErr("Nouveau mot de passe : 4 caractères minimum."); return; }
      if (p1 !== p2) { setErr("Les mots de passe ne correspondent pas."); return; }
      await Auth.setCreds({ username: u.trim(), password: p1 });
      await reload();
      setErr(""); setOldP(""); setP1(""); setP2("");
      setOk(true);
      onSaved && onSaved();
      setTimeout(() => setOk(false), 2400);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0, 480px) 1fr", gap: 18, alignItems: "start" }}>
      <form onSubmit={submit} className="card">
        <div className="card-head">
          <div className="card-title">Identifiants administrateur</div>
          {isDefault && (
            <>
              <div className="spacer" />
              <span className="badge badge-warn">⚠ Identifiants par défaut</span>
            </>
          )}
        </div>
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <div className="field-label">Identifiant actuel</div>
            <div style={{ padding: "8px 11px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
              {username || "…"}
            </div>
          </div>
          <div className="field">
            <div className="field-label">Mot de passe actuel *</div>
            <input type="password" required className="input" value={oldP} onChange={(e) => { setOldP(e.target.value); setErr(""); }} />
          </div>
          <div className="divider" />
          <div className="field">
            <div className="field-label">Nouvel identifiant</div>
            <input className="input" value={u} onChange={(e) => { setU(e.target.value); setErr(""); }} />
            <div className="field-hint">Sensible à la casse. Évitez les espaces.</div>
          </div>
          <div className="field">
            <div className="field-label">Nouveau mot de passe</div>
            <input type="password" className="input" value={p1} onChange={(e) => { setP1(e.target.value); setErr(""); }} placeholder="4 caractères minimum" />
          </div>
          <div className="field">
            <div className="field-label">Confirmation</div>
            <input type="password" className="input" value={p2} onChange={(e) => { setP2(e.target.value); setErr(""); }} />
          </div>

          {err && (
            <div style={{ padding: "8px 12px", background: "var(--err-bg)", color: "var(--err)", borderRadius: 5, fontSize: 12 }}>
              ⚠ {err}
            </div>
          )}
          {ok && (
            <div style={{ padding: "8px 12px", background: "var(--ok-bg)", color: "var(--ok)", borderRadius: 5, fontSize: 12 }}>
              ✓ Identifiants mis à jour.
            </div>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: 6 }}>
            {busy ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </div>
      </form>

      <div className="card card-pad">
        <div className="card-title" style={{ marginBottom: 10 }}>Authentification à deux facteurs (2FA)</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 8 }}>
          <div style={{ flexShrink: 0, paddingTop: 2 }}>
            <TwoFactorToggle />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, color: "var(--ink)" }}>Activer la 2FA TOTP</div>
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>
              Une fois activée en production, à chaque connexion il vous sera demandé un code à 6 chiffres généré par Google Authenticator ou Authy, en plus de votre mot de passe.
              Le QR code de configuration sera affiché à l'activation.
            </div>
            <div className="muted-2" style={{ fontSize: 11, marginTop: 8, fontStyle: "italic" }}>
              ⚠ Prototype : l'activation est mémorisée pour l'interface, mais le flux TOTP réel
              (génération QR, vérification code) sera implémenté côté serveur en production.
            </div>
          </div>
        </div>
        <div className="divider" />
        <div className="card-title" style={{ marginBottom: 10, fontSize: 12 }}>Sécurité du compte</div>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.55, marginTop: 0 }}>
          Les mots de passe sont stockés <strong>hachés (SHA-256 + salt, 1000 itérations)</strong> dans
          le navigateur (<code className="kbd">localStorage</code>, clé <code className="kbd">ooh_admin_creds_v2</code>).
          Aucun mot de passe n'est conservé en clair.
        </p>
        <div className="divider" />
        <div className="card-title" style={{ marginBottom: 8, fontSize: 12 }}>Code de récupération</div>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.55, marginTop: 0 }}>
          En cas de mot de passe oublié, l'écran de connexion propose une option « Mot de passe oublié ? »
          qui demande un code de récupération permettant de redéfinir vos identifiants.
          Le code est défini dans <code className="kbd">src/auth.js</code> → <code className="kbd">RECOVERY_CODE</code>.
        </p>
        <div className="divider" />
        <div className="card-title" style={{ marginBottom: 8, fontSize: 12 }}>⚠ Limites de cette implémentation</div>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.55, marginTop: 0 }}>
          Cette authentification est <strong>purement côté client</strong> — adaptée à un prototype ou un
          intranet de confiance, pas à de la production publique. Pour une vraie sécurité (rate-limiting,
          2FA, audit log, brute-force protection), un backend est requis. Voir <code className="kbd">BACKEND_SPEC.md</code>.
        </p>
      </div>
    </div>
  );
}

// ─── Sections: enable/disable + manage ───
function SectionsTab({ db, update, t, lang }) {
  const reorder = useReorderHandlers(db, update, "sections");
  const onChange = (idx, field, value) => {
    const sections = [...(db.sections || [])];
    sections[idx] = { ...sections[idx], [field]: value };
    update({ sections });
  };
  const onDelete = (idx) => {
    if (!confirm("Supprimer cette section ? Les formats qui y sont rattachés deviendront orphelins.")) return;
    update({ sections: (db.sections || []).filter((_, i) => i !== idx) });
  };
  const onAdd = () => {
    const id = prompt("Identifiant court de la section (ex : RAIL, AIRPORT) :");
    if (!id) return;
    update({ sections: [...(db.sections || []), {
      id: id.trim().toUpperCase(),
      name_fr: "Nouvelle section",
      name_en: "New section",
      desc_fr: "", desc_en: "",
      enabled: true,
    }] });
  };
  const sections = db.sections || [];
  return (
    <div className="card" style={{ overflow: "visible" }}>
      <div className="card-head">
        <div className="card-title">Sections du catalogue</div>
        <div className="spacer" />
        <button className="btn btn-sm btn-primary" onClick={onAdd}>+ Ajouter une section</button>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 64 }} title="Réordonner">⋮⋮</th>
            <th style={{ width: 90 }}>Visible</th>
            <th style={{ width: 100 }}>{t("code")}</th>
            <th>{t("name_label")} (FR / EN)</th>
            <th>Description courte</th>
            <th style={{ width: 90 }} className="num">Formats</th>
            <th style={{ width: 56 }}></th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s, i) => {
            const count = db.formats.filter((f) => f.section === s.id).length;
            return (
              <tr key={i}>
                <RowReorderCell index={i} total={sections.length}
                  onMove={reorder.move}
                  onDragStart={reorder.dragStart(i)}
                  onDragOver={reorder.dragOver(i)}
                  onDrop={reorder.drop(i)} />
                <td>
                  <Toggle on={s.enabled !== false} onChange={(v) => onChange(i, "enabled", v)} />
                </td>
                <td>
                  <input className="input mono" style={{ padding: "5px 8px", fontSize: 12, width: 90, textTransform: "uppercase" }}
                    value={s.id} onChange={(e) => onChange(i, "id", e.target.value.toUpperCase().trim())} />
                </td>
                <td>
                  <input className="input" style={{ padding: "5px 8px", fontSize: 12, marginBottom: 4 }}
                    value={s.name_fr} placeholder="FR" onChange={(e) => onChange(i, "name_fr", e.target.value)} />
                  <input className="input" style={{ padding: "5px 8px", fontSize: 11, color: "var(--ink-3)" }}
                    value={s.name_en} placeholder="EN" onChange={(e) => onChange(i, "name_en", e.target.value)} />
                </td>
                <td>
                  <input className="input" style={{ padding: "5px 8px", fontSize: 12, marginBottom: 4 }}
                    value={s.desc_fr} placeholder="Description FR" onChange={(e) => onChange(i, "desc_fr", e.target.value)} />
                  <input className="input" style={{ padding: "5px 8px", fontSize: 11, color: "var(--ink-3)" }}
                    value={s.desc_en} placeholder="Description EN" onChange={(e) => onChange(i, "desc_en", e.target.value)} />
                </td>
                <td className="num">
                  <span className={count > 0 ? "badge badge-blue" : "badge"}>{count}</span>
                </td>
                <td>
                  <button className="btn btn-sm btn-ghost" style={{ color: "var(--err)" }} onClick={() => onDelete(i)}>✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding: "12px 14px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-3)", background: "var(--surface-2)", lineHeight: 1.55 }}>
        Une section <strong>désactivée</strong> est masquée du catalogue public — ses formats restent dans la BDD mais ne sont plus visibles.
        Le client peut filtrer par section sur le catalogue lorsque plusieurs sections sont actives.
      </div>
    </div>
  );
}

// Pretty toggle switch
function Toggle({ on, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: 38, height: 22, borderRadius: 100,
        background: on ? "var(--brand-600)" : "var(--ink-5)",
        position: "relative", transition: "background 0.15s",
        border: "none", padding: 0, cursor: "pointer",
      }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 18 : 2,
        width: 18, height: 18, borderRadius: 100,
        background: "white",
        transition: "left 0.15s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }}></span>
    </button>
  );
}

// ─── Formats: editable table ───
function FormatsTab({ db, update, t, lang }) {
  const reorder = useReorderHandlers(db, update, "formats");
  const onChange = (idx, field, value) => {
    const formats = [...db.formats];
    formats[idx] = { ...formats[idx], [field]: value };
    update({ formats });
  };
  const onDelete = (idx) => {
    if (!confirm("Supprimer ce format ?")) return;
    const formats = db.formats.filter((_, i) => i !== idx);
    update({ formats });
  };
  const onAdd = () => {
    const firstSection = (db.sections && db.sections[0] && db.sections[0].id) || "";
    const formats = [...db.formats, {
      code: `F${Math.floor(Math.random()*900+100)}`,
      section: firstSection,
      name_fr: t("new_format"), name_en: t("new_format"),
      width_cm: 100, height_cm: 100, base_price: 20,
      desc_fr: "", desc_en: "",
    }];
    update({ formats });
  };
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-head">
        <div className="card-title">{t("tab_formats")}</div>
        <div className="spacer" />
        <button className="btn btn-sm btn-primary" onClick={onAdd}>+ {t("add")}</button>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 64 }} title="Réordonner">⋮⋮</th>
            <th style={{ width: 56 }}></th>
            <th style={{ width: 110 }}>Section</th>
            <th style={{ width: 90 }}>{t("code")}</th>
            <th>{t("name_label")} (FR / EN) + Description</th>
            <th style={{ width: 100 }} className="num">Largeur (cm)</th>
            <th style={{ width: 100 }} className="num">Hauteur (cm)</th>
            <th style={{ width: 110 }} className="num">Surface (m²)</th>
            <th style={{ width: 140 }} className="num">{t("base_price")} CHF</th>
            <th style={{ width: 56 }}></th>
          </tr>
        </thead>
        <tbody>
          {db.formats.map((f, i) => (
            <tr key={i}>
              <RowReorderCell index={i} total={db.formats.length}
                onMove={reorder.move}
                onDragStart={reorder.dragStart(i)}
                onDragOver={reorder.dragOver(i)}
                onDrop={reorder.drop(i)} />
              <td><FormatThumb fmt={f} size={36} showLabel={false} /></td>
              <td>
                <select className="select" style={{ padding: "5px 22px 5px 8px", fontSize: 12, backgroundPosition: "right 8px center" }}
                  value={f.section || ""} onChange={(e) => onChange(i, "section", e.target.value)}>
                  <option value="">—</option>
                  {(db.sections || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.id}</option>
                  ))}
                </select>
              </td>
              <td><input className="input" style={{ padding: "5px 8px", fontSize: 12, fontFamily: "var(--font-mono)" }} value={f.code} onChange={(e) => onChange(i, "code", e.target.value)} /></td>
              <td>
                <input className="input" style={{ padding: "5px 8px", fontSize: 12 }} value={lang === "fr" ? f.name_fr : f.name_en}
                  placeholder={lang === "fr" ? "Nom (FR)" : "Name (EN)"}
                  onChange={(e) => onChange(i, lang === "fr" ? "name_fr" : "name_en", e.target.value)} />
                <input className="input" style={{ padding: "5px 8px", fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}
                  value={lang === "fr" ? f.name_en : f.name_fr}
                  placeholder={lang === "fr" ? "Name (EN)" : "Nom (FR)"}
                  onChange={(e) => onChange(i, lang === "fr" ? "name_en" : "name_fr", e.target.value)} />
                <textarea className="textarea" style={{ padding: "5px 8px", fontSize: 11, marginTop: 4, minHeight: 36, resize: "vertical" }}
                  rows={2}
                  value={lang === "fr" ? (f.desc_fr || "") : (f.desc_en || "")}
                  placeholder={lang === "fr" ? "Description courte (FR) — affichée dans le catalogue" : "Short description (EN) — shown in the catalogue"}
                  onChange={(e) => onChange(i, lang === "fr" ? "desc_fr" : "desc_en", e.target.value)} />
                <textarea className="textarea" style={{ padding: "5px 8px", fontSize: 11, marginTop: 4, minHeight: 36, resize: "vertical", color: "var(--ink-3)" }}
                  rows={2}
                  value={lang === "fr" ? (f.desc_en || "") : (f.desc_fr || "")}
                  placeholder={lang === "fr" ? "Description (EN)" : "Description (FR)"}
                  onChange={(e) => onChange(i, lang === "fr" ? "desc_en" : "desc_fr", e.target.value)} />
              </td>
              <td><input className="input" style={{ padding: "5px 8px", fontSize: 12, textAlign: "right" }} type="number" step="0.5" value={f.width_cm} onChange={(e) => onChange(i, "width_cm", parseFloat(e.target.value)||0)} /></td>
              <td><input className="input" style={{ padding: "5px 8px", fontSize: 12, textAlign: "right" }} type="number" step="0.5" value={f.height_cm} onChange={(e) => onChange(i, "height_cm", parseFloat(e.target.value)||0)} /></td>
              <td style={{ verticalAlign: "top" }}>
                <input className="input" style={{ padding: "5px 8px", fontSize: 12, textAlign: "right" }} type="number" step="0.01"
                  value={f.surface_m2 != null && f.surface_m2 !== 0 ? f.surface_m2 : ""}
                  placeholder="—"
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : parseFloat(e.target.value);
                    onChange(i, "surface_m2", isNaN(v) ? null : v);
                  }} />
                <div className="muted-2" style={{ fontSize: 10, textAlign: "right", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                  <button type="button"
                    onClick={() => onChange(i, "surface_m2", Math.round((f.width_cm * f.height_cm) / 100) / 100)}
                    title="Calculer depuis largeur × hauteur"
                    style={{ color: "var(--brand-600)", textDecoration: "underline", padding: 0, fontSize: 10 }}>
                    ↻ auto ({Pricing.fmtN((f.width_cm * f.height_cm) / 10000, 2)})
                  </button>
                </div>
              </td>
              <td>
                <input className="input" style={{ padding: "5px 8px", fontSize: 12, textAlign: "right", fontWeight: 600 }} type="number" step="0.5" value={f.base_price} onChange={(e) => onChange(i, "base_price", parseFloat(e.target.value)||0)} />
              </td>
              <td><button className="btn btn-sm btn-ghost" style={{ color: "var(--err)" }} onClick={() => onDelete(i)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tiers ───
function TiersTab({ db, update, t }) {
  const reorder = useReorderHandlers(db, update, "tiers");
  const onChange = (idx, field, value) => {
    const tiers = [...db.tiers];
    tiers[idx] = { ...tiers[idx], [field]: value };
    update({ tiers });
  };
  const onDelete = (idx) => update({ tiers: db.tiers.filter((_, i) => i !== idx) });
  const onAdd = () => update({ tiers: [...db.tiers, { from: 1000, discount: 35 }] });

  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0, 520px) 1fr", gap: 18, alignItems: "start" }}>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-head">
          <div className="card-title">{t("tab_tiers")}</div>
          <div className="spacer" />
          <button className="btn btn-sm btn-primary" onClick={onAdd}>+ {t("add")}</button>
        </div>
        <table className="tbl">
          <thead><tr><th style={{ width: 64 }} title="Réordonner">⋮⋮</th><th className="num">{t("from_qty")}</th><th className="num">{t("discount_pct")}</th><th style={{ width: 56 }}></th></tr></thead>
          <tbody>
            {db.tiers.map((tier, i) => (
              <tr key={i}>
                <RowReorderCell index={i} total={db.tiers.length}
                  onMove={reorder.move}
                  onDragStart={reorder.dragStart(i)}
                  onDragOver={reorder.dragOver(i)}
                  onDrop={reorder.drop(i)} />
                <td><input className="input" style={{ padding: "5px 8px", fontSize: 12, textAlign: "right" }} type="number" value={tier.from} onChange={(e) => onChange(i, "from", parseInt(e.target.value)||0)} /></td>
                <td><input className="input" style={{ padding: "5px 8px", fontSize: 12, textAlign: "right" }} type="number" step="0.5" value={tier.discount} onChange={(e) => onChange(i, "discount", parseFloat(e.target.value)||0)} /></td>
                <td><button className="btn btn-sm btn-ghost" style={{ color: "var(--err)" }} onClick={() => onDelete(i)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TierVisualization db={db} />
    </div>
  );
}

function TierVisualization({ db }) {
  const sorted = [...db.tiers].sort((a, b) => a.from - b.from);
  const max = Math.max(...sorted.map(t => t.discount), 1);
  return (
    <div className="card card-pad">
      <div className="card-title" style={{ marginBottom: 14 }}>Aperçu visuel des paliers</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((tier, i) => {
          const hasValue = tier.discount > 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="mono" style={{ width: 70, fontSize: 11, color: "var(--ink-3)", textAlign: "right" }}>≥ {tier.from}</div>
              <div style={{ flex: 1, height: 22, background: "var(--surface-3)", borderRadius: 3, position: "relative" }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${(tier.discount / max) * 100}%`,
                  background: hasValue ? "var(--brand-600)" : "var(--ink-5)",
                  borderRadius: 3,
                  transition: "width 0.2s",
                }}></div>
                <div style={{
                  position: "absolute", left: 10, top: 0, bottom: 0,
                  display: "flex", alignItems: "center",
                  fontSize: 11, fontWeight: 600,
                  color: hasValue ? "white" : "var(--ink-3)",
                  textShadow: hasValue ? "0 1px 2px rgba(107,42,29,0.5)" : "none",
                }}>
                  {tier.discount.toFixed(1)} %
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Subjects ───
function SubjectsTab({ db, update, t }) {
  const reorder = useReorderHandlers(db, update, "subjects");
  const onChange = (idx, field, value) => {
    const subjects = [...db.subjects];
    subjects[idx] = { ...subjects[idx], [field]: value };
    update({ subjects });
  };
  const onDelete = (idx) => update({ subjects: db.subjects.filter((_, i) => i !== idx) });
  const onAdd = () => update({ subjects: [...db.subjects, { count: 20, fee_chf: 900 }] });
  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0, 520px) 1fr", gap: 18, alignItems: "start" }}>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-head">
          <div className="card-title">{t("tab_subjects")}</div>
          <div className="spacer" />
          <button className="btn btn-sm btn-primary" onClick={onAdd}>+ {t("add")}</button>
        </div>
        <table className="tbl">
          <thead><tr><th style={{ width: 64 }} title="Réordonner">⋮⋮</th><th className="num">{t("subjects_count")}</th><th className="num">Prix supp. (CHF)</th><th style={{ width: 56 }}></th></tr></thead>
          <tbody>
            {db.subjects.map((s, i) => (
              <tr key={i}>
                <RowReorderCell index={i} total={db.subjects.length}
                  onMove={reorder.move}
                  onDragStart={reorder.dragStart(i)}
                  onDragOver={reorder.dragOver(i)}
                  onDrop={reorder.drop(i)} />
                <td><input className="input" style={{ padding: "5px 8px", fontSize: 12, textAlign: "right" }} type="number" value={s.count} onChange={(e) => onChange(i, "count", parseInt(e.target.value)||1)} /></td>
                <td><input className="input" style={{ padding: "5px 8px", fontSize: 12, textAlign: "right", fontWeight: 600 }} type="number" step="5" value={s.fee_chf || 0} onChange={(e) => onChange(i, "fee_chf", parseFloat(e.target.value)||0)} /></td>
                <td><button className="btn btn-sm btn-ghost" style={{ color: "var(--err)" }} onClick={() => onDelete(i)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-3)", background: "var(--surface-2)" }}>
          Montant fixe ajouté au devis pour le traitement de N sujets différents (mise en page, BAT, plaques). Affiché sur ligne distincte du calculateur.
        </div>
      </div>
      <SubjectsFeeViz db={db} />
    </div>
  );
}

function SubjectsFeeViz({ db }) {
  const sorted = [...db.subjects].sort((a, b) => a.count - b.count);
  const max = Math.max(...sorted.map(s => s.fee_chf || 0), 1);
  return (
    <div className="card card-pad">
      <div className="card-title" style={{ marginBottom: 14 }}>Aperçu des paliers</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((s, i) => {
          const v = s.fee_chf || 0;
          const pct = (v / max) * 100;
          const hasValue = v > 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="mono" style={{ width: 80, fontSize: 11, color: "var(--ink-3)", textAlign: "right" }}>{s.count} sujet{s.count > 1 ? "s" : ""}</div>
              <div style={{ flex: 1, height: 22, background: "var(--surface-3)", borderRadius: 3, position: "relative" }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${pct}%`,
                  background: "var(--brand-600)", borderRadius: 3,
                  transition: "width 0.2s",
                }}></div>
                <div style={{
                  position: "absolute", left: 10, top: 0, bottom: 0,
                  display: "flex", alignItems: "center",
                  fontSize: 11, fontWeight: 600,
                  color: hasValue ? "white" : "var(--ink-3)",
                  textShadow: hasValue ? "0 1px 2px rgba(107,42,29,0.5)" : "none",
                }}>
                  + {Pricing.fmtCHF(v)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Options & papers ───
function OptionsTab({ db, update, t, lang }) {
  const onChangePaper = (idx, field, value) => {
    const papers = [...db.papers];
    papers[idx] = { ...papers[idx], [field]: value };
    update({ papers });
  };
  const onDel = (idx) => update({ papers: db.papers.filter((_, i) => i !== idx) });
  const onAdd = () => update({ papers: [...db.papers, { id: `p${Date.now()}`, name_fr: "Nouveau papier", name_en: "New paper", factor: 1, formats: [] }] });

  const allCodes = db.formats.map((f) => f.code);

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
      <div className="card" style={{ overflow: "visible" }}>
        <div className="card-head">
          <div className="card-title">{t("tab_options")}</div>
          <div className="spacer" />
          <button className="btn btn-sm btn-primary" onClick={onAdd}>+ {t("add")}</button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 90 }}>{t("code")}</th>
              <th>{t("name_label")} (FR)</th>
              <th className="num" style={{ width: 90 }}>{t("paper_factor")}</th>
              <th style={{ width: 280 }}>Affecté aux formats</th>
              <th style={{ width: 56 }}></th>
            </tr>
          </thead>
          <tbody>
            {db.papers.map((p, i) => (
              <tr key={i}>
                <td><input className="input mono" style={{ padding: "5px 8px", fontSize: 12, width: 90 }} value={p.id} onChange={(e) => onChangePaper(i, "id", e.target.value)} /></td>
                <td>
                  <input className="input" style={{ padding: "5px 8px", fontSize: 12 }} value={p.name_fr} onChange={(e) => onChangePaper(i, "name_fr", e.target.value)} />
                  <input className="input" style={{ padding: "5px 8px", fontSize: 11, marginTop: 4, color: "var(--ink-3)" }} value={p.name_en} placeholder="EN" onChange={(e) => onChangePaper(i, "name_en", e.target.value)} />
                </td>
                <td><input className="input" style={{ padding: "5px 8px", fontSize: 12, textAlign: "right" }} type="number" step="0.01" value={p.factor} onChange={(e) => onChangePaper(i, "factor", parseFloat(e.target.value)||1)} /></td>
                <td>
                  <FormatMultiPicker
                    allCodes={allCodes}
                    selected={Array.isArray(p.formats) ? p.formats : []}
                    db={db}
                    onChange={(formats) => onChangePaper(i, "formats", formats)}
                  />
                </td>
                <td><button className="btn btn-sm btn-ghost" style={{ color: "var(--err)" }} onClick={() => onDel(i)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-3)", background: "var(--surface-2)" }}>
          Un papier peut être affecté à plusieurs formats. Si plusieurs papiers ciblent le même format, le premier de la liste est utilisé.
          Le client ne choisit pas son papier — il est défini par le format et l'emplacement.
        </div>
      </div>
      <div className="card card-pad">
        <div className="card-title" style={{ marginBottom: 12 }}>Adresse de réception des devis</div>
        <div className="field" style={{ marginBottom: 10 }}>
          <div className="field-label">Email destinataire</div>
          <input className="input" type="email" value={db.contact_email || ""}
            placeholder="devis@exemple.ch"
            onChange={(e) => update({ contact_email: e.target.value })} />
          <div className="field-hint">Adresse vers laquelle le bouton « Demander un devis » ouvre le client mail du visiteur (mailto:).</div>
        </div>

        <div className="divider" />

        <div className="card-title" style={{ marginBottom: 12 }}>{t("express_fee")}</div>
        <div className="field">
          <div className="field-label">Majoration (%)</div>
          <input className="input" type="number" step="0.5" value={db.express_surcharge_pct}
            onChange={(e) => update({ express_surcharge_pct: parseFloat(e.target.value) || 0 })} />
          <div className="field-hint">Appliquée au sous-total HT (après remise volume + traitement fichiers) lorsque l'option Express est sélectionnée.</div>
        </div>

        <div className="divider" />
        <div className="card-title" style={{ marginBottom: 10, fontSize: 12 }}>Affectations papier → format</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          {db.formats.map((f) => {
            const p = Pricing.paperForFormat(db, f.code);
            return (
              <div key={f.code} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="badge badge-blue" style={{ minWidth: 50, justifyContent: "center" }}>{f.code}</span>
                <span style={{ color: "var(--ink-4)" }}>→</span>
                <span style={{ color: p ? "var(--ink-2)" : "var(--err)", fontWeight: 500 }}>
                  {p ? (lang === "fr" ? p.name_fr : p.name_en) : "⚠ non assigné"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Multi-select chip picker for format codes
function FormatMultiPicker({ allCodes, selected, db, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    setTimeout(() => document.addEventListener("click", onDoc), 0);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  const toggle = (code) => {
    if (selected.includes(code)) onChange(selected.filter((c) => c !== code));
    else onChange([...selected, code]);
  };

  // Warn if a format is also covered by another paper
  const conflicts = selected.filter((code) =>
    db.papers.filter((pp) => Array.isArray(pp.formats) && pp.formats.includes(code)).length > 1
  );

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", textAlign: "left",
          padding: "5px 30px 5px 8px",
          border: "1px solid var(--line-strong)",
          background: "var(--surface)",
          borderRadius: "var(--radius)",
          fontSize: 12, minHeight: 30,
          display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center",
          position: "relative",
        }}
      >
        {selected.length === 0 && <span style={{ color: "var(--ink-4)" }}>— Sélectionner —</span>}
        {selected.map((code) => (
          <span key={code} className="badge badge-blue" style={{ fontSize: 11 }}>{code}</span>
        ))}
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)", fontSize: 9 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--surface)", border: "1px solid var(--line)",
          borderRadius: 6, boxShadow: "var(--shadow-pop)",
          zIndex: 30, padding: 4,
        }}>
          {allCodes.map((code) => {
            const on = selected.includes(code);
            return (
              <label key={code} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 8px", borderRadius: 4,
                cursor: "pointer", fontSize: 12,
                background: on ? "var(--brand-50)" : "transparent",
              }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--surface-3)"; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                <input type="checkbox" checked={on} onChange={() => toggle(code)} />
                <span className={`badge ${on ? "badge-blue" : ""}`}>{code}</span>
              </label>
            );
          })}
          {allCodes.length === 0 && <div style={{ padding: 8, fontSize: 11, color: "var(--ink-4)" }}>Aucun format défini.</div>}
        </div>
      )}
      {conflicts.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 10, color: "var(--warn)" }}>
          ⚠ {conflicts.join(", ")} défini sur plusieurs papiers
        </div>
      )}
    </div>
  );
}

// ─── Header admin ───
function HeaderTab({ db, update }) {
  const header = db.header || {};
  const setHeader = (patch) => update({ header: { ...header, ...patch } });
  const fileRef = useRef(null);
  const [err, setErr] = useState("");

  const MAX_SIZE = 500 * 1024; // 500 KB

  const onPickFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    if (!/\.(svg|png|jpe?g|webp|gif)$/i.test(file.name)) {
      setErr("Format non supporté. Utilisez SVG, PNG, JPG, WEBP ou GIF.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setErr(`Image trop volumineuse (${Math.round(file.size/1024)} KB). Maximum 500 KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setHeader({ logo: ev.target.result, logo_alt: file.name.replace(/\.[^.]+$/, "") });
    };
    reader.onerror = () => setErr("Lecture du fichier échouée.");
    reader.readAsDataURL(file);
  };
  const onClear = () => setHeader({ logo: null });

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 380px", gap: 18, alignItems: "start" }}>
      <div className="card">
        <div className="card-head">
          <div className="card-title">En-tête du site</div>
        </div>
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 22 }}>

          <div className="field">
            <div className="field-label">Logo</div>
            <div style={{
              border: "1px dashed var(--line-strong)",
              borderRadius: 8,
              padding: 18,
              display: "flex", alignItems: "center", gap: 18,
              background: "var(--surface-2)",
            }}>
              <div style={{
                width: 80, height: 64,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                display: "grid", placeItems: "center",
                padding: 8, overflow: "hidden",
              }}>
                {header.logo ? (
                  <img src={header.logo} alt={header.logo_alt || "logo"}
                    style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 11, color: "var(--ink-4)" }}>—</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
                  {header.logo ? "Logo personnalisé" : "Aucun logo — placeholder utilisé"}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  SVG · PNG · JPG · WEBP · GIF — max 500 KB. Ratio préservé automatiquement, hauteur fixée à 40 px.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => fileRef.current && fileRef.current.click()}>
                    ⬆ {header.logo ? "Remplacer" : "Téléverser"}
                  </button>
                  {header.logo && (
                    <button type="button" className="btn btn-sm" onClick={onClear} style={{ color: "var(--err)" }}>
                      ✕ Retirer
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp,.gif,image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
                    onChange={onPickFile} style={{ display: "none" }} />
                </div>
              </div>
            </div>
            {err && (
              <div style={{ padding: "8px 12px", background: "var(--err-bg)", color: "var(--err)", borderRadius: 5, fontSize: 12, marginTop: 8 }}>
                ⚠ {err}
              </div>
            )}
          </div>

          <div className="field">
            <div className="field-label">Texte alternatif du logo (accessibilité)</div>
            <input className="input" value={header.logo_alt || ""}
              placeholder="Ex. Logo AfficheOOH"
              onChange={(e) => setHeader({ logo_alt: e.target.value })} />
          </div>

          <div className="divider" />

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="field">
              <div className="field-label">Nom de la marque</div>
              <input className="input" value={header.brand_name || ""}
                placeholder="AfficheOOH"
                onChange={(e) => setHeader({ brand_name: e.target.value })} />
              <div className="field-hint">Laisser vide pour masquer le nom à côté du logo.</div>
            </div>
            <div className="field">
              <div className="field-label">Complément (sous-titre)</div>
              <input className="input" value={header.brand_tag || ""}
                placeholder="Ex. Catalogue B2B"
                onChange={(e) => setHeader({ brand_tag: e.target.value })} />
              <div className="field-hint">Petit badge à côté du nom. Laisser vide pour masquer.</div>
            </div>
          </div>

          <div className="divider" />

          <div className="card-title" style={{ fontSize: 12 }}>Éléments à droite de l'en-tête</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <Toggle on={header.show_lang !== false} onChange={(v) => setHeader({ show_lang: v })} />
              <div>
                <div style={{ fontWeight: 500 }}>Sélecteur de langue (FR / EN)</div>
                <div className="muted" style={{ fontSize: 11 }}>Masque le bouton de bascule de langue.</div>
              </div>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <Toggle on={header.show_status !== false} onChange={(v) => setHeader({ show_status: v })} />
              <div>
                <div style={{ fontWeight: 500 }}>Indicateur « Tous systèmes opérationnels »</div>
                <div className="muted" style={{ fontSize: 11 }}>Statut décoratif. Désactivez si non pertinent.</div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ position: "sticky", top: "calc(var(--header-h) + 20px)" }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Aperçu</div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
          <div className="topbar" style={{ position: "static", height: "auto" }}>
            <div className="topbar-inner" style={{ padding: "10px 14px" }}>
              <div className="brand" style={{ userSelect: "none" }}>
                {header.logo ? (
                  <img src={header.logo} alt={header.logo_alt || "logo"}
                    style={{ height: 40, width: "auto", maxWidth: 200, objectFit: "contain", display: "block" }} />
                ) : (
                  <div className="brand-mark">{(header.brand_name || "A").slice(0, 1).toUpperCase()}</div>
                )}
                {header.brand_name && (
                  <div><div className="brand-name">{header.brand_name}</div></div>
                )}
                {header.brand_tag && <span className="brand-tag">{header.brand_tag}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="divider" />
        <div className="card-title" style={{ marginBottom: 8, fontSize: 12 }}>Recommandations</div>
        <ul style={{ paddingLeft: 18, fontSize: 11, color: "var(--ink-3)", margin: 0, lineHeight: 1.7 }}>
          <li>SVG recommandé pour la netteté à tous les écrans.</li>
          <li>PNG/WEBP avec fond transparent fonctionnent aussi.</li>
          <li>Le logo est redimensionné à 40 px de hauteur, la largeur s'adapte.</li>
          <li>Le ratio est préservé automatiquement (largeur max 200 px).</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Texts admin (editable page copy + AI translation helper) ───
function TextsTab({ db, update }) {
  const texts = db.page_texts || {};
  const setText = (page, key, value) => {
    update({ page_texts: { ...texts, [page]: { ...(texts[page] || {}), [key]: value } } });
  };

  const pages = [
    {
      id: "catalog",
      label: "Catalogue",
      fields: [
        { id: "title", label: "Titre de la page", multiline: false },
        { id: "sub", label: "Sous-titre / introduction", multiline: true },
      ],
    },
    {
      id: "calc",
      label: "Calculateur",
      fields: [
        { id: "title", label: "Titre de la page", multiline: false },
        { id: "sub", label: "Sous-titre / introduction", multiline: true },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="card card-pad" style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 20 }}>✨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "var(--brand-900)" }}>Édition bilingue avec assistance IA</div>
            <div style={{ fontSize: 12, color: "var(--brand-800)", lineHeight: 1.55, marginTop: 4 }}>
              Saisissez le texte en français à gauche, puis cliquez sur <strong>✨ Traduire</strong> pour générer
              automatiquement la version anglaise. Vous pouvez ensuite modifier la traduction proposée.
              Les champs vides retombent sur les valeurs par défaut.
            </div>
          </div>
        </div>
      </div>

      {pages.map((p) => (
        <div key={p.id} className="card">
          <div className="card-head">
            <div className="card-title">Page « {p.label} »</div>
          </div>
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {p.fields.map((f) => (
              <BilingualField
                key={f.id}
                label={f.label}
                multiline={f.multiline}
                valueFr={(texts[p.id] && texts[p.id][`${f.id}_fr`]) || ""}
                valueEn={(texts[p.id] && texts[p.id][`${f.id}_en`]) || ""}
                onChangeFr={(v) => setText(p.id, `${f.id}_fr`, v)}
                onChangeEn={(v) => setText(p.id, `${f.id}_en`, v)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="card card-pad" style={{ background: "var(--surface-2)" }}>
        <div className="card-title" style={{ fontSize: 12, marginBottom: 8 }}>Autres textes éditables</div>
        <ul style={{ paddingLeft: 18, fontSize: 12, color: "var(--ink-3)", margin: 0, lineHeight: 1.7 }}>
          <li><strong>Fil d'Ariane / Breadcrumb</strong> (« AfficheOOH / Catalogue ») → onglet <strong>En-tête</strong> → « Nom de la marque » (même valeur que dans le logo)</li>
          <li>Nom de la marque + sous-titre → onglet <strong>En-tête</strong></li>
          <li>Pied de page (4 colonnes éditables) → onglet <strong>Pied de page</strong></li>
          <li>Description de chaque format → onglet <strong>{`Formats & prix unitaires`}</strong></li>
          <li>Nom et description de chaque section → onglet <strong>Sections</strong></li>
          <li>Mentions légales et politique de confidentialité → onglet <strong>Légal</strong></li>
        </ul>
      </div>
    </div>
  );
}

// FR + EN side-by-side editor with an "AI translate" button.
function BilingualField({ label, valueFr, valueEn, onChangeFr, onChangeEn, multiline }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const translate = async () => {
    if (!valueFr.trim()) { setErr("Saisissez d'abord le texte FR."); return; }
    if (!window.claude || !window.claude.complete) { setErr("Service IA indisponible."); return; }
    setBusy(true); setErr("");
    try {
      const prompt = `Translate this French marketing copy to English. Keep the same tone (professional B2B), preserve technical terms (F4, F12, OOH, MOOH, CHF, etc.) as-is. Reply with ONLY the translation, no preamble, no quotes, no explanation.\n\nText: ${valueFr}`;
      const out = await window.claude.complete(prompt);
      onChangeEn(String(out || "").trim().replace(/^["'`]|["'`]$/g, ""));
    } catch (e) {
      setErr("Échec de la traduction : " + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const InputCmp = multiline ? "textarea" : "input";
  const inputProps = multiline ? { rows: 2 } : {};

  return (
    <div className="field">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="field-label" style={{ flex: 1 }}>{label}</div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span className="badge" style={{ fontSize: 10 }}>🇫🇷 FR</span>
            <div className="spacer" />
            <button type="button" disabled={busy || !valueFr.trim()} onClick={translate}
              className="btn btn-sm"
              style={{ padding: "3px 8px", fontSize: 11,
                color: "var(--brand-700)",
                borderColor: "var(--brand-200)",
                background: busy ? "var(--surface-3)" : "var(--brand-50)",
              }}
              title="Traduire FR → EN avec Claude">
              {busy ? "…" : "✨ Traduire →"}
            </button>
          </div>
          <InputCmp className={multiline ? "textarea" : "input"} {...inputProps}
            value={valueFr} onChange={(e) => onChangeFr(e.target.value)} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span className="badge" style={{ fontSize: 10 }}>🇬🇧 EN</span>
          </div>
          <InputCmp className={multiline ? "textarea" : "input"} {...inputProps}
            value={valueEn} onChange={(e) => onChangeEn(e.target.value)} />
        </div>
      </div>
      {err && (
        <div style={{ padding: "6px 10px", background: "var(--err-bg)", color: "var(--err)", borderRadius: 4, fontSize: 11, marginTop: 6 }}>
          ⚠ {err}
        </div>
      )}
    </div>
  );
}

window.AdminPage = AdminPage;

// ─── Legal documents admin (markdown editor + AI translation) ───
function LegalTab({ db, update }) {
  const docs = db.legal_pages || {};
  const setDoc = (page, key, value) => {
    update({ legal_pages: { ...docs, [page]: { ...(docs[page] || {}), [key]: value } } });
  };
  const [active, setActive] = useState("legal");

  const pages = [
    { id: "legal", label: "Mentions légales" },
    { id: "privacy", label: "Politique de confidentialité" },
    { id: "cookies", label: "Politique cookies" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="card card-pad" style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "var(--brand-900)" }}>Documents légaux éditables</div>
            <div style={{ fontSize: 12, color: "var(--brand-800)", lineHeight: 1.55, marginTop: 4 }}>
              Rédigez ici les contenus des trois documents légaux affichés dans les modales du site.
              Le format <strong>Markdown</strong> est supporté : titres avec <code>### Titre</code>, liens avec{" "}
              <code>[texte](https://url)</code>, listes avec <code>- item</code>, tableaux{" "}
              <code>|colonne|colonne|</code>, citations avec <code>{`> texte`}</code>, gras avec <code>**texte**</code>.
              Bouton <strong>✨ Traduire</strong> pour générer la version anglaise.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {pages.map((p) => (
          <button key={p.id}
            className={`chip ${active === p.id ? "on" : ""}`}
            onClick={() => setActive(p.id)}
          >{p.label}</button>
        ))}
      </div>

      {pages.filter((p) => p.id === active).map((p) => {
        const doc = docs[p.id] || {};
        return (
          <div key={p.id} className="card">
            <div className="card-head">
              <div>
                <div className="card-title">{p.label}</div>
                <div className="card-sub">Version affichée dans la modale du site (FR / EN)</div>
              </div>
            </div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <BilingualField
                label="Titre du document"
                multiline={false}
                valueFr={doc.title_fr || ""}
                valueEn={doc.title_en || ""}
                onChangeFr={(v) => setDoc(p.id, "title_fr", v)}
                onChangeEn={(v) => setDoc(p.id, "title_en", v)}
              />
              <BilingualMarkdown
                label="Contenu (Markdown)"
                valueFr={doc.content_fr || ""}
                valueEn={doc.content_en || ""}
                onChangeFr={(v) => setDoc(p.id, "content_fr", v)}
                onChangeEn={(v) => setDoc(p.id, "content_en", v)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Larger bilingual editor with live preview + AI translation, for Markdown docs.
function BilingualMarkdown({ label, valueFr, valueEn, onChangeFr, onChangeEn }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showPreview, setShowPreview] = useState("fr");

  const translate = async () => {
    if (!valueFr.trim()) { setErr("Saisissez d'abord le texte FR."); return; }
    if (!window.claude || !window.claude.complete) { setErr("Service IA indisponible."); return; }
    setBusy(true); setErr("");
    try {
      const prompt = `Translate this French legal document to English. Preserve Markdown formatting exactly (headings, lists, tables, links, bold, blockquotes). Keep legal terminology accurate (Swiss FADP/nLPD, GDPR, FDPIC/PFPDT). Reply with ONLY the translation, no preamble.\n\nDocument:\n${valueFr}`;
      const out = await window.claude.complete(prompt);
      onChangeEn(String(out || "").trim());
    } catch (e) {
      setErr("Échec de la traduction : " + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const preview = (value) => {
    if (!value) return "<em style='color:var(--ink-4)'>Aperçu vide</em>";
    if (!window.marked) return value;
    try { return window.marked.parse(value, { breaks: true, gfm: true }); }
    catch { return value; }
  };

  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span className="badge" style={{ fontSize: 10 }}>🇫🇷 FR</span>
            <div className="spacer" />
            <button type="button" disabled={busy || !valueFr.trim()} onClick={translate}
              className="btn btn-sm"
              style={{ padding: "3px 8px", fontSize: 11,
                color: "var(--brand-700)",
                borderColor: "var(--brand-200)",
                background: busy ? "var(--surface-3)" : "var(--brand-50)",
              }}
              title="Traduire FR → EN avec Claude">
              {busy ? "Traduction…" : "✨ Traduire →"}
            </button>
          </div>
          <textarea className="textarea mono" rows={18}
            style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
            value={valueFr} onChange={(e) => onChangeFr(e.target.value)} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span className="badge" style={{ fontSize: 10 }}>🇬🇧 EN</span>
          </div>
          <textarea className="textarea mono" rows={18}
            style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
            value={valueEn} onChange={(e) => onChangeEn(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span className="field-label" style={{ margin: 0 }}>Aperçu</span>
        <div className="seg" style={{ padding: 2 }}>
          <button className={showPreview === "fr" ? "on" : ""} onClick={() => setShowPreview("fr")}>FR</button>
          <button className={showPreview === "en" ? "on" : ""} onClick={() => setShowPreview("en")}>EN</button>
        </div>
      </div>
      <div className="legal-body"
        style={{
          marginTop: 8,
          padding: 18,
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)",
          maxHeight: 360, overflow: "auto",
        }}
        dangerouslySetInnerHTML={{ __html: preview(showPreview === "fr" ? valueFr : valueEn) }}
      />

      {err && (
        <div style={{ padding: "6px 10px", background: "var(--err-bg)", color: "var(--err)", borderRadius: 4, fontSize: 11, marginTop: 6 }}>
          ⚠ {err}
        </div>
      )}
    </div>
  );
}

// ─── Footer admin ───
function FooterTab({ db, update, t }) {
  const footer = db.footer || { enabled: true, sections: [] };
  const setFooter = (patch) => update({ footer: { ...footer, ...patch } });
  const reorder = useReorderHandlers({ ...db, footer_sections: footer.sections }, (patch) => {
    if (patch.footer_sections) setFooter({ sections: patch.footer_sections });
  }, "footer_sections");

  const onChangeSection = (idx, field, value) => {
    const sections = [...(footer.sections || [])];
    sections[idx] = { ...sections[idx], [field]: value };
    setFooter({ sections });
  };
  const onDelete = (idx) => {
    if (!confirm("Supprimer cette colonne du pied de page ?")) return;
    setFooter({ sections: (footer.sections || []).filter((_, i) => i !== idx) });
  };
  const onAdd = () => {
    setFooter({ sections: [...(footer.sections || []), {
      id: `s${Date.now()}`,
      enabled: true,
      title: "Nouvelle colonne",
      align: "left",
      lines: [""],
    }] });
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Toggle on={footer.enabled !== false} onChange={(v) => setFooter({ enabled: v })} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>Afficher le pied de page</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Si désactivé, l'intégralité du footer disparaît du site (mentions légales restent accessibles via le bandeau cookies).
            </div>
          </div>
          <button className="btn btn-sm btn-primary" onClick={onAdd}>+ Ajouter une colonne</button>
        </div>

        <div className="card card-pad" style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flexShrink: 0, paddingTop: 2 }}>
            <Toggle on={db.cookies_banner_enabled !== false} onChange={(v) => update({ cookies_banner_enabled: v })} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>Afficher le bandeau cookies</div>
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>
              Désactiver uniquement si vous gérez le consentement via un autre outil (Cookiebot, Axeptio…) ou si vous n'utilisez aucun cookie soumis à consentement.
            </div>
          </div>
        </div>

        {(footer.sections || []).map((s, i) => (
          <div key={s.id || i} className="card" style={{ opacity: s.enabled === false ? 0.6 : 1 }}>
            <div className="card-head" style={{ gap: 12 }}>
              <span
                draggable
                onDragStart={reorder.dragStart(i)}
                onDragOver={reorder.dragOver(i)}
                onDrop={reorder.drop(i)}
                title="Glisser pour réorganiser"
                style={{ cursor: "grab", padding: "4px 6px", color: "var(--ink-4)", fontSize: 14, userSelect: "none" }}>⋮⋮</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <button type="button" disabled={i === 0} onClick={() => reorder.move(i, i - 1)}
                  style={{ padding: "0 4px", fontSize: 9, lineHeight: 1, height: 14, color: i === 0 ? "var(--ink-5)" : "var(--ink-3)" }}>▲</button>
                <button type="button" disabled={i === (footer.sections || []).length - 1} onClick={() => reorder.move(i, i + 1)}
                  style={{ padding: "0 4px", fontSize: 9, lineHeight: 1, height: 14, color: i === (footer.sections || []).length - 1 ? "var(--ink-5)" : "var(--ink-3)" }}>▼</button>
              </div>
              <Toggle on={s.enabled !== false} onChange={(v) => onChangeSection(i, "enabled", v)} />
              <span className="muted-2" style={{ fontSize: 11 }}>Colonne {i + 1}</span>
              <div className="spacer" />
              <button className="btn btn-sm btn-ghost" style={{ color: "var(--err)" }} onClick={() => onDelete(i)}>✕</button>
            </div>
            <div className="card-pad" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <div className="field-label">Titre de la colonne</div>
                <input className="input" value={s.title || ""} placeholder="Ex. Contact (laisser vide pour pas de titre)"
                  onChange={(e) => onChangeSection(i, "title", e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <div className="field-label">Contenu (1 ligne par entrée)</div>
                <textarea className="textarea" rows={Math.max(3, (s.lines || []).length + 1)}
                  value={(s.lines || []).join("\n")}
                  onChange={(e) => onChangeSection(i, "lines", e.target.value.split("\n"))} />
                <div className="field-hint" style={{ lineHeight: 1.5 }}>
                  Tokens disponibles :{" "}
                  <code className="kbd">{"{{legal}}"}</code>{" "}
                  <code className="kbd">{"{{privacy}}"}</code>{" "}
                  <code className="kbd">{"{{cookies}}"}</code>{" "}
                  <code className="kbd">{"{{contact_email}}"}</code>{" "}
                  <code className="kbd">{"{{email:adresse@exemple.ch}}"}</code>{" "}
                  <code className="kbd">{"{{year}}"}</code>
                </div>
              </div>
              <div className="field">
                <div className="field-label">Alignement</div>
                <div className="seg">
                  <button className={s.align !== "right" ? "on" : ""} onClick={() => onChangeSection(i, "align", "left")}>← Gauche</button>
                  <button className={s.align === "right" ? "on" : ""} onClick={() => onChangeSection(i, "align", "right")}>Droite →</button>
                </div>
              </div>
              <div className="field">
                <div className="field-label">Mise en forme</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <input type="checkbox" checked={!!s.bold_first} onChange={(e) => onChangeSection(i, "bold_first", e.target.checked)} />
                    Première ligne en gras
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <input type="checkbox" checked={!!s.muted} onChange={(e) => onChangeSection(i, "muted", e.target.checked)} />
                    Texte estompé (style mention légale)
                  </label>
                </div>
              </div>
            </div>
          </div>
        ))}

        {(footer.sections || []).length === 0 && (
          <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-3)" }}>
            Aucune colonne. Ajoutez-en une avec le bouton ci-dessus.
          </div>
        )}
      </div>

      <div className="card card-pad" style={{ position: "sticky", top: "calc(var(--header-h) + 20px)" }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Aperçu en direct</div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden", background: "var(--surface-2)" }}>
          <div style={{ transform: "scale(0.62)", transformOrigin: "top left", width: "161%", pointerEvents: "none" }}>
            <Footer db={db} onOpen={() => {}} lang="fr" />
          </div>
        </div>
        <div className="divider" />
        <div className="card-title" style={{ marginBottom: 8, fontSize: 12 }}>Tokens disponibles</div>
        <ul style={{ paddingLeft: 18, fontSize: 11, color: "var(--ink-3)", margin: 0, lineHeight: 1.7 }}>
          <li><code className="kbd">{"{{legal}}"}</code> → lien « Mentions légales »</li>
          <li><code className="kbd">{"{{privacy}}"}</code> → lien « Politique de confidentialité »</li>
          <li><code className="kbd">{"{{cookies}}"}</code> → lien « Cookies »</li>
          <li><code className="kbd">{"{{contact_email}}"}</code> → email défini dans Options (sync auto)</li>
          <li><code className="kbd">{"{{email:x@y.ch}}"}</code> → lien mailto cliquable</li>
          <li><code className="kbd">{"{{year}}"}</code> → année courante (auto)</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Import / Export menu ───
function ImportExportMenu({ db, setDb, tab }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!e.target.closest(".io-menu")) setOpen(false); };
    setTimeout(() => document.addEventListener("click", onDoc), 0);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setError("");
    try {
      const next = await IO.importFile(file, db);
      setDb(next);
    } catch (err) {
      setError(err.message || "Erreur lors de l'import.");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const tabCSVLabel = tab === "sections" ? "Sections" : tab === "formats" ? "Formats" : tab === "tiers" ? "Paliers" : tab === "subjects" ? "Sujets" : "Papiers";

  return (
    <div className="io-menu" style={{ position: "relative" }}>
      <button className="btn" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        ⇅ Import / Export ▾
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8,
          boxShadow: "var(--shadow-pop)", minWidth: 280, padding: 6, zIndex: 80,
        }}>
          <MenuHeader>Export</MenuHeader>
          <MenuItem icon="📊" label="Exporter tout (.xlsx)" sub="Workbook 4 onglets + paramètres"
            onClick={() => { IO.exportXLSX(db); setOpen(false); }} />
          <MenuItem icon="📄" label={`Exporter onglet courant (.csv)`} sub={`${tabCSVLabel} — UTF-8, séparateur ;`}
            onClick={() => { IO.exportCSV(tab, db); setOpen(false); }} />
          <Divider />
          <MenuHeader>Import</MenuHeader>
          <MenuItem icon="⬆" label="Importer un fichier" sub=".xlsx, .xls ou .csv (détection auto)"
            onClick={() => fileRef.current && fileRef.current.click()}
            disabled={busy} />
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={onPick} style={{ display: "none" }} />
          {busy && <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--ink-3)" }}>Import en cours…</div>}
          {error && <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--err)", background: "var(--err-bg)", borderRadius: 4, margin: "6px" }}>⚠ {error}</div>}
          <Divider />
          <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--ink-4)" }}>
            L'import remplace les lignes de l'onglet correspondant. Sauvegarde locale automatique.
          </div>
        </div>
      )}
    </div>
  );
}

function MenuHeader({ children }) {
  return <div style={{ padding: "6px 12px 2px", fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.06 }}>{children}</div>;
}
function MenuItem({ icon, label, sub, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: "100%", textAlign: "left",
        padding: "8px 12px", borderRadius: 5,
        display: "flex", gap: 10, alignItems: "center",
        opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer",
        background: "transparent",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "var(--surface-3)"; }}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{sub}</div>}
      </div>
    </button>
  );
}
function Divider() { return <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />; }
