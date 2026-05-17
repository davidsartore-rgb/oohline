// Catalogue page — formats grouped by enabled sections (OOH, MOOH, …).
// 3 layout variants per section: grid (cards), table (dense), split (list+preview).

function CatalogPage({ db, lang, onSelectFormat, layout }) {
  const t = useT(lang);
  const [sort, setSort] = useState("default");
  const [activeSectionId, setActiveSectionId] = useState("all");

  const enabledSections = useMemo(
    () => (db.sections || []).filter((s) => s.enabled !== false),
    [db.sections]
  );

  // Build sections: section meta + its formats
  const sectionBlocks = useMemo(() => {
    const sorter = (arr) => {
      const a = [...arr];
      if (sort === "default") return a;
      if (sort === "name") a.sort((x, y) => x.code.localeCompare(y.code));
      if (sort === "size") a.sort((x, y) => (x.width_cm * x.height_cm) - (y.width_cm * y.height_cm));
      if (sort === "price") a.sort((x, y) => x.base_price - y.base_price);
      return a;
    };
    const orphanFormats = db.formats.filter((f) => !enabledSections.find((s) => s.id === f.section));
    return [
      ...enabledSections.map((s) => ({
        section: s,
        formats: sorter(db.formats.filter((f) => f.section === s.id)),
      })),
      // Orphans (no section assigned): only if there are any AND there are no enabled sections at all
      ...(enabledSections.length === 0 && orphanFormats.length
        ? [{ section: { id: "_none", name_fr: "Autres", name_en: "Other", desc_fr: "", desc_en: "" }, formats: sorter(orphanFormats) }]
        : []),
    ].filter((b) => b.formats.length > 0);
  }, [db.formats, enabledSections, sort]);

  const visibleBlocks = activeSectionId === "all"
    ? sectionBlocks
    : sectionBlocks.filter((b) => b.section.id === activeSectionId);

  const showSectionFilter = enabledSections.length > 1;

  return (
    <div className="page">
      <div className="page-head">
        <div className="breadcrumb">
          {(() => {
            const bn = db.header && db.header.brand_name;
            const v = bn === undefined ? t("brand_name") : bn;
            return v ? <><span>{v}</span><span className="sep">/</span></> : null;
          })()}
          <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{t("nav_catalog")}</span>
        </div>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h1 className="page-title">{getPageText(db, "catalog", "title", lang, t("page_catalog_title"))}</h1>
            <p className="page-sub">{getPageText(db, "catalog", "sub", lang, t("page_catalog_sub"))}</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ minWidth: 0 }}>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 200 }}>
                <option value="default">{t("sort_by")} : Ordre catalogue</option>
                <option value="name">{t("sort_by")} : {t("sort_name")}</option>
                <option value="size">{t("sort_by")} : {t("sort_size")}</option>
                <option value="price">{t("sort_by")} : {t("sort_price")}</option>
              </select>
            </div>
          </div>
        </div>

        {showSectionFilter && (
          <div style={{ display: "flex", gap: 6, marginTop: 18, flexWrap: "wrap" }}>
            <button
              className={`chip ${activeSectionId === "all" ? "on" : ""}`}
              onClick={() => setActiveSectionId("all")}
            >Tous</button>
            {enabledSections.map((s) => (
              <button key={s.id}
                className={`chip ${activeSectionId === s.id ? "on" : ""}`}
                onClick={() => setActiveSectionId(s.id)}
              >{s.id} — {((lang === "fr" ? s.name_fr : s.name_en) || s.id).replace(/^.* — /, "")}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {visibleBlocks.map((block) => (
          <CatalogSection
            key={block.section.id}
            block={block}
            t={t} lang={lang}
            layout={layout}
            onSelect={onSelectFormat}
            showHeader={enabledSections.length > 1 || activeSectionId === "all"}
          />
        ))}
        {visibleBlocks.length === 0 && (
          <div className="card card-pad" style={{ textAlign: "center", padding: 60, color: "var(--ink-3)" }}>
            Aucun format à afficher. Activez au moins une section dans l'administration.
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogSection({ block, t, lang, layout, onSelect, showHeader }) {
  const { section, formats } = block;
  return (
    <section data-screen-label={section.id}>
      {showHeader && (
        <div className="section-header" style={{ marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2>{lang === "fr" ? section.name_fr : section.name_en}</h2>
              <span className="badge badge-blue">{section.id}</span>
              <span className="muted-2" style={{ fontSize: 12 }}>
                {formats.length} format{formats.length > 1 ? "s" : ""}
              </span>
            </div>
            {(section.desc_fr || section.desc_en) && (
              <div className="section-desc">{lang === "fr" ? section.desc_fr : section.desc_en}</div>
            )}
          </div>
        </div>
      )}
      {layout === "grid" && <CatalogGrid t={t} formats={formats} lang={lang} onSelect={onSelect} />}
      {layout === "table" && <CatalogTable t={t} formats={formats} lang={lang} onSelect={onSelect} />}
      {layout === "split" && <CatalogSplit t={t} formats={formats} lang={lang} onSelect={onSelect} />}
    </section>
  );
}

// ───── Variant A: card grid ─────
function CatalogGrid({ t, formats, lang, onSelect }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {formats.map((f) => (
        <div key={f.code} className="card catalog-card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{
            padding: 24,
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--line)",
            borderRadius: "10px 10px 0 0",
            display: "grid", placeItems: "center",
            minHeight: 160,
          }}>
            <FormatThumb fmt={f} size={120} />
          </div>
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            <div>
              <div className="row" style={{ gap: 8 }}>
                <span className="badge badge-blue">{f.code}</span>
                {f.surface_m2 ? (
                  <span className="badge">
                    {Pricing.fmtN(f.surface_m2, 2)} {t("m2")}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8, color: "var(--ink)" }}>
                {lang === "fr" ? f.name_fr : f.name_en}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {f.width_cm} × {f.height_cm} {t("cm")}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.45, flex: 1 }}>
              {lang === "fr" ? f.desc_fr : f.desc_en}
            </div>
            <div className="row" style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>{t("unit_price_from")}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {Pricing.fmtCHF(f.base_price)} <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>{t("per_unit")}</span>
                </div>
              </div>
              <div className="spacer" />
              <button className="btn btn-primary" onClick={() => onSelect(f.code)}>
                {t("configure")} →
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ───── Variant B: dense table ─────
function CatalogTable({ t, formats, lang, onSelect }) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 72 }}></th>
            <th>{t("code")}</th>
            <th>{t("name_label")}</th>
            <th>{t("dimensions")}</th>
            <th className="num">{t("surface")}</th>
            <th className="num">{t("unit_price_from")}</th>
            <th style={{ width: 140 }}></th>
          </tr>
        </thead>
        <tbody>
          {formats.map((f) => (
            <tr key={f.code} className="row">
              <td><FormatThumb fmt={f} size={48} showLabel={false} /></td>
              <td><span className="badge badge-blue">{f.code}</span></td>
              <td>
                <div style={{ fontWeight: 600, color: "var(--ink)" }}>{lang === "fr" ? f.name_fr : f.name_en}</div>
                <div className="muted" style={{ fontSize: 11 }}>{lang === "fr" ? f.desc_fr : f.desc_en}</div>
              </td>
              <td className="mono" style={{ color: "var(--ink-2)" }}>{f.width_cm} × {f.height_cm} cm</td>
              <td className="num">{f.surface_m2 ? `${Pricing.fmtN(f.surface_m2, 2)} m²` : ""}</td>
              <td className="num price">{Pricing.fmtCHF(f.base_price)}</td>
              <td>
                <button className="btn btn-sm btn-primary" onClick={() => onSelect(f.code)}>
                  {t("configure")} →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───── Variant C: split — list left, big preview right ─────
function CatalogSplit({ t, formats, lang, onSelect }) {
  const [active, setActive] = useState(formats[0]?.code);
  // Reset selection when formats change (section switch)
  useEffect(() => {
    if (!formats.find((f) => f.code === active)) setActive(formats[0]?.code);
  }, [formats]); // eslint-disable-line
  const fmt = formats.find((f) => f.code === active) || formats[0];

  return (
    <div className="split-aside">
      <div className="card" style={{ overflow: "hidden" }}>
        {formats.map((f) => (
          <button
            key={f.code}
            onClick={() => setActive(f.code)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              width: "100%", textAlign: "left",
              padding: "12px 14px",
              borderBottom: "1px solid var(--line)",
              background: active === f.code ? "var(--brand-50)" : "transparent",
              borderLeft: `3px solid ${active === f.code ? "var(--brand-700)" : "transparent"}`,
            }}
          >
            <FormatThumb fmt={f} size={40} showLabel={false} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{f.code}</div>
              <div className="muted" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lang === "fr" ? f.name_fr : f.name_en}
              </div>
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{Pricing.fmtCHF(f.base_price)}</div>
          </button>
        ))}
      </div>

      {fmt && (
        <div className="card">
          <div className="card-pad" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, padding: 28 }}>
            <div style={{
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              minHeight: 280,
              display: "grid", placeItems: "center",
              padding: 24,
            }}>
              <FormatThumb fmt={fmt} size={240} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span className="badge badge-blue">{fmt.code}</span>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: "10px 0 4px", letterSpacing: "-0.02em" }}>
                  {lang === "fr" ? fmt.name_fr : fmt.name_en}
                </h2>
                <div className="muted">{lang === "fr" ? fmt.desc_fr : fmt.desc_en}</div>
              </div>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                <Stat label={t("dimensions")} value={`${fmt.width_cm} × ${fmt.height_cm} cm`} />
                <Stat label={t("surface")} value={fmt.surface_m2 ? `${Pricing.fmtN(fmt.surface_m2, 2)} m²` : "—"} />
                <Stat label="Section" value={fmt.section || "—"} />
                <Stat label={t("unit_price_from")} value={Pricing.fmtCHF(fmt.base_price)} accent />
              </div>
              <button className="btn btn-primary btn-lg" style={{ marginTop: 12, alignSelf: "flex-start" }} onClick={() => onSelect(fmt.code)}>
                {t("configure")} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 12px" }}>
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent ? "var(--brand-700)" : "var(--ink)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{value}</div>
    </div>
  );
}

window.CatalogPage = CatalogPage;
