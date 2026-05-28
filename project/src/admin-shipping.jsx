// Admin → Livraison : frais de port & emballage.
// Tarif de base (défaut) + surcharges optionnelles par format et/ou quantité.
//
// Règle de résolution (cf. Pricing.shippingFor) :
//   1) on filtre les surcharges dont `formats` est vide OU contient le code du format choisi
//      ET dont `from_qty` <= quantité commandée
//   2) parmi celles-ci, plus grand `from_qty` gagne ; à égalité, la plus spécifique
//      (avec liste de formats) l'emporte sur "tous formats"
//   3) si aucune ne correspond, on retombe sur `default_chf`.

function ShippingTab({ db, update, t, lang }) {
  const ship = db.shipping || { default_chf: 25, overrides: [] };
  const overrides = Array.isArray(ship.overrides) ? ship.overrides : [];

  const setShipping = (patch) => update({ shipping: { ...ship, ...patch } });

  const onChange = (idx, field, value) => {
    const next = [...overrides];
    next[idx] = { ...next[idx], [field]: value };
    setShipping({ overrides: next });
  };

  const onDelete = (idx) => {
    if (!confirm("Supprimer cette surcharge ?")) return;
    setShipping({ overrides: overrides.filter((_, i) => i !== idx) });
  };

  const onAdd = () => {
    setShipping({
      overrides: [...overrides, {
        id: `s${Date.now()}`,
        label_fr: "Nouvelle surcharge",
        label_en: "New surcharge",
        from_qty: 1, formats: [], fee_chf: 30,
      }],
    });
  };

  const allCodes = db.formats.map((f) => f.code);

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ─── Tarif de base ─── */}
        <div className="card card-pad">
          <div className="card-title" style={{ marginBottom: 12 }}>Tarif de base par défaut</div>
          <div className="field" style={{ maxWidth: 280 }}>
            <div className="field-label">Frais de port & emballage (CHF)</div>
            <input className="input" type="number" step="0.5"
              value={ship.default_chf != null ? ship.default_chf : 25}
              onChange={(e) => setShipping({ default_chf: parseFloat(e.target.value) || 0 })}
              style={{ fontSize: 14, fontWeight: 600, textAlign: "right" }} />
            <div className="field-hint">
              Montant appliqué <strong>par défaut</strong> à toutes les commandes, sauf si une surcharge ci-dessous correspond au format et à la quantité.
            </div>
          </div>
        </div>

        {/* ─── Surcharges ─── */}
        <div className="card" style={{ overflow: "visible" }}>
          <div className="card-head">
            <div className="card-title">Surcharges (sécurité par volume / format)</div>
            <div className="spacer" />
            <button className="btn btn-sm btn-primary" onClick={onAdd}>+ Ajouter une surcharge</button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Libellé (FR / EN)</th>
                <th className="num" style={{ width: 110 }}>À partir de</th>
                <th style={{ width: 260 }}>Formats concernés</th>
                <th className="num" style={{ width: 130 }}>Tarif (CHF)</th>
                <th style={{ width: 56 }}></th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((o, i) => (
                <tr key={o.id || i}>
                  <td>
                    <input className="input" style={{ padding: "5px 8px", fontSize: 12, marginBottom: 4 }}
                      value={o.label_fr || ""} placeholder="Libellé FR"
                      onChange={(e) => onChange(i, "label_fr", e.target.value)} />
                    <input className="input" style={{ padding: "5px 8px", fontSize: 11, color: "var(--ink-3)" }}
                      value={o.label_en || ""} placeholder="Label EN"
                      onChange={(e) => onChange(i, "label_en", e.target.value)} />
                  </td>
                  <td>
                    <input className="input" type="number" min="1"
                      style={{ padding: "5px 8px", fontSize: 12, textAlign: "right" }}
                      value={o.from_qty || 1}
                      onChange={(e) => onChange(i, "from_qty", parseInt(e.target.value, 10) || 1)} />
                    <div className="muted-2" style={{ fontSize: 10, textAlign: "right", marginTop: 2 }}>exemplaires</div>
                  </td>
                  <td>
                    <FormatMultiPicker
                      allCodes={allCodes}
                      selected={Array.isArray(o.formats) ? o.formats : []}
                      db={db}
                      onChange={(formats) => onChange(i, "formats", formats)}
                    />
                    <div className="muted-2" style={{ fontSize: 10, marginTop: 4 }}>
                      Vide = tous formats
                    </div>
                  </td>
                  <td>
                    <input className="input" type="number" step="0.5"
                      style={{ padding: "5px 8px", fontSize: 12, textAlign: "right", fontWeight: 600 }}
                      value={o.fee_chf != null ? o.fee_chf : 0}
                      onChange={(e) => onChange(i, "fee_chf", parseFloat(e.target.value) || 0)} />
                  </td>
                  <td>
                    <button className="btn btn-sm btn-ghost" style={{ color: "var(--err)" }} onClick={() => onDelete(i)}>✕</button>
                  </td>
                </tr>
              ))}
              {overrides.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "var(--ink-4)", fontSize: 12 }}>
                    Aucune surcharge — le tarif de base s'applique à toutes les commandes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ padding: "12px 14px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-3)", background: "var(--surface-2)", lineHeight: 1.6 }}>
            <strong>Règle :</strong> pour chaque devis, on prend la surcharge dont la quantité minimale est la plus élevée tout en restant ≤ à la quantité commandée, en tenant compte du format. À défaut, c'est le tarif de base ci-dessus qui s'applique. Les frais de port sont <strong>soumis à la TVA 8,1 %</strong> comme le reste du devis.
          </div>
        </div>

        {/* ─── Simulateur ─── */}
        <ShippingSimulator db={db} />
      </div>

      {/* ─── Aperçu visuel ─── */}
      <ShippingPreview db={db} lang={lang} />
    </div>
  );
}

// ── Simulateur : voir le tarif appliqué selon un format + quantité ──
function ShippingSimulator({ db }) {
  const [fmtCode, setFmtCode] = useState(db.formats[0] ? db.formats[0].code : "");
  const [qty, setQty] = useState(50);

  const lookup = Pricing.shippingFor(db, fmtCode, qty);
  const fmt = db.formats.find((f) => f.code === fmtCode);

  return (
    <div className="card card-pad">
      <div className="card-title" style={{ marginBottom: 12 }}>Simulateur</div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
        <div className="field" style={{ margin: 0 }}>
          <div className="field-label">Format</div>
          <select className="select" value={fmtCode} onChange={(e) => setFmtCode(e.target.value)}>
            {db.formats.map((f) => <option key={f.code} value={f.code}>{f.code}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <div className="field-label">Quantité</div>
          <input className="input" type="number" min="1" value={qty}
            onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)} />
        </div>
        <div style={{
          padding: "10px 14px",
          background: "var(--brand-50)",
          border: "1px solid var(--brand-100)",
          borderRadius: 6,
          textAlign: "center",
        }}>
          <div className="muted" style={{ fontSize: 10, marginBottom: 2 }}>Tarif appliqué</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--brand-800)", fontVariantNumeric: "tabular-nums" }}>
            {Pricing.fmtCHF(lookup.fee_chf)}
          </div>
        </div>
      </div>
      <div className="muted-2" style={{ fontSize: 11, marginTop: 10 }}>
        {lookup.row
          ? <>↳ Surcharge appliquée : <strong style={{ color: "var(--ink-2)" }}>{lookup.row.label_fr || lookup.row.id}</strong></>
          : <>↳ Tarif de base (aucune surcharge applicable pour {fmt ? fmt.code : "—"} × {qty} ex.)</>
        }
      </div>
    </div>
  );
}

// ── Aperçu visuel : tableau des paliers triés ──
function ShippingPreview({ db, lang }) {
  const ship = db.shipping || { default_chf: 25, overrides: [] };
  const overrides = Array.isArray(ship.overrides) ? [...ship.overrides] : [];
  const max = Math.max(ship.default_chf || 0, ...overrides.map((o) => o.fee_chf || 0), 1);
  const sorted = overrides.sort((a, b) => (a.from_qty || 1) - (b.from_qty || 1));

  return (
    <div className="card card-pad" style={{ position: "sticky", top: "calc(var(--header-h) + 20px)" }}>
      <div className="card-title" style={{ marginBottom: 14 }}>Aperçu visuel</div>

      {/* Default bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div className="mono" style={{ width: 80, fontSize: 11, color: "var(--ink-3)", textAlign: "right" }}>défaut</div>
        <div style={{ flex: 1, height: 22, background: "var(--surface-3)", borderRadius: 3, position: "relative" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${((ship.default_chf || 0) / max) * 100}%`,
            background: "var(--ink-3)", borderRadius: 3,
          }}></div>
          <div style={{
            position: "absolute", left: 10, top: 0, bottom: 0,
            display: "flex", alignItems: "center",
            fontSize: 11, fontWeight: 600, color: "white",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}>
            {Pricing.fmtCHF(ship.default_chf || 0)}
          </div>
        </div>
      </div>

      <div className="divider" style={{ margin: "8px 0 12px" }} />

      <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 8, fontWeight: 500 }}>Surcharges (triées par seuil)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((o, i) => {
          const v = o.fee_chf || 0;
          const pct = (v / max) * 100;
          const fmtScope = (Array.isArray(o.formats) && o.formats.length > 0)
            ? o.formats.join(", ")
            : "tous";
          return (
            <div key={o.id || i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="mono" style={{ width: 80, fontSize: 10, color: "var(--ink-3)", textAlign: "right" }}>≥ {o.from_qty || 1}</div>
              <div style={{ flex: 1, height: 22, background: "var(--surface-3)", borderRadius: 3, position: "relative" }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${pct}%`,
                  background: "var(--brand-600)", borderRadius: 3,
                }}></div>
                <div style={{
                  position: "absolute", left: 10, top: 0, bottom: 0,
                  display: "flex", alignItems: "center",
                  fontSize: 11, fontWeight: 600, color: "white",
                  textShadow: "0 1px 2px rgba(107,42,29,0.5)",
                }}>
                  {Pricing.fmtCHF(v)}
                </div>
                <div style={{
                  position: "absolute", right: 8, top: 0, bottom: 0,
                  display: "flex", alignItems: "center",
                  fontSize: 9, color: "var(--ink-4)",
                  fontFamily: "var(--font-mono)",
                }}>{fmtScope}</div>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="muted-2" style={{ fontSize: 11, textAlign: "center", padding: 12 }}>
            Aucune surcharge définie.
          </div>
        )}
      </div>
    </div>
  );
}

window.ShippingTab = ShippingTab;
