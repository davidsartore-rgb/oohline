// Import / export — CSV (native) + XLSX (SheetJS).
// Exports the four pricing tables (formats, tiers, subjects, papers).
//
// XLSX export: one workbook, one sheet per table + a "settings" sheet.
// XLSX import: reads the same shape; missing sheets are left untouched.
// CSV is per-table; useful for quick spreadsheet edits.

(function () {
  const FORMAT_COLS = ["code", "section", "name_fr", "name_en", "width_cm", "height_cm", "surface_m2", "base_price", "desc_fr", "desc_en"];
  const SECTION_COLS = ["id", "name_fr", "name_en", "desc_fr", "desc_en", "enabled"];
  const TIER_COLS = ["from", "discount"];
  const SUBJ_COLS = ["count", "fee_chf"];
  const PAPER_COLS = ["id", "name_fr", "name_en", "factor", "formats"];

  function rowsToCSV(cols, rows) {
    const esc = (v) => {
      if (v == null) return "";
      // serialise arrays as comma-joined string for CSV
      const s = Array.isArray(v) ? v.join(",") : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = cols.join(";");
    const body = rows.map((r) => cols.map((c) => esc(r[c])).join(";")).join("\n");
    return head + "\n" + body;
  }

  function parseCSV(text) {
    // Sniff delimiter
    const first = text.split(/\r?\n/)[0] || "";
    const delim = first.includes(";") ? ";" : ",";
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length);
    if (!lines.length) return [];
    const split = (line) => {
      const out = []; let cur = ""; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQ) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') inQ = false;
          else cur += ch;
        } else {
          if (ch === '"') inQ = true;
          else if (ch === delim) { out.push(cur); cur = ""; }
          else cur += ch;
        }
      }
      out.push(cur);
      return out;
    };
    const cols = split(lines[0]).map((s) => s.trim());
    return lines.slice(1).map((line) => {
      const vals = split(line);
      const obj = {};
      cols.forEach((c, i) => { obj[c] = vals[i] != null ? vals[i] : ""; });
      return obj;
    });
  }

  function coerce(row, schema) {
    // schema: { col: "string" | "int" | "float" | "csv" | "bool" }
    const out = {};
    for (const k in schema) {
      const v = row[k];
      if (schema[k] === "int") out[k] = parseInt(v, 10) || 0;
      else if (schema[k] === "float") out[k] = parseFloat(String(v).replace(",", ".")) || 0;
      else if (schema[k] === "bool") {
        if (typeof v === "boolean") out[k] = v;
        else {
          const s = String(v == null ? "" : v).trim().toLowerCase();
          out[k] = (s === "true" || s === "1" || s === "oui" || s === "yes" || s === "on" || s === "x");
        }
      }
      else if (schema[k] === "csv") {
        if (Array.isArray(v)) out[k] = v.map(String).map((s) => s.trim()).filter(Boolean);
        else out[k] = String(v || "").split(/[,;|]\s*/).map((s) => s.trim()).filter(Boolean);
      }
      else out[k] = v != null ? String(v) : "";
    }
    return out;
  }

  const FORMAT_SCHEMA = { code: "string", section: "string", name_fr: "string", name_en: "string",
    width_cm: "float", height_cm: "float", surface_m2: "float", base_price: "float", desc_fr: "string", desc_en: "string" };
  const SECTION_SCHEMA = { id: "string", name_fr: "string", name_en: "string", desc_fr: "string", desc_en: "string", enabled: "bool" };
  const TIER_SCHEMA = { from: "int", discount: "float" };
  const SUBJ_SCHEMA = { count: "int", fee_chf: "float" };
  const PAPER_SCHEMA = { id: "string", name_fr: "string", name_en: "string", factor: "float", formats: "csv" };

  function download(filename, content, mime = "text/plain") {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  // ───── Export CSV (current tab) ─────
  function exportCSV(tab, db) {
    if (tab === "sections") download(`ooh-sections-${stamp()}.csv`, rowsToCSV(SECTION_COLS, db.sections || []), "text/csv");
    if (tab === "formats")  download(`ooh-formats-${stamp()}.csv`, rowsToCSV(FORMAT_COLS, db.formats), "text/csv");
    if (tab === "tiers")    download(`ooh-tiers-${stamp()}.csv`,   rowsToCSV(TIER_COLS,   db.tiers),   "text/csv");
    if (tab === "subjects") download(`ooh-subjects-${stamp()}.csv`,rowsToCSV(SUBJ_COLS,   db.subjects),"text/csv");
    if (tab === "options")  download(`ooh-papers-${stamp()}.csv`,  rowsToCSV(PAPER_COLS,  db.papers),  "text/csv");
  }

  // ───── Export XLSX (full workbook) ─────
  function exportXLSX(db) {
    if (!window.XLSX) { alert("Module Excel non chargé — réessayez dans un instant."); return; }
    const wb = XLSX.utils.book_new();
    const papersFlat = db.papers.map((p) => ({ ...p, formats: Array.isArray(p.formats) ? p.formats.join(",") : "" }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.sections || [], { header: SECTION_COLS }), "sections");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.formats,  { header: FORMAT_COLS }), "formats");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.tiers,    { header: TIER_COLS }),   "tiers");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.subjects, { header: SUBJ_COLS }),   "subjects");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(papersFlat,  { header: PAPER_COLS }),  "papers");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { key: "express_surcharge_pct", value: db.express_surcharge_pct },
    ]), "settings");
    XLSX.writeFile(wb, `ooh-pricing-${stamp()}.xlsx`);
  }

  // ───── Import (file → patched DB) ─────
  async function importFile(file, db) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) return importXLSX(file, db);
    if (name.endsWith(".csv") || name.endsWith(".txt")) return importCSVFile(file, db);
    throw new Error("Format non supporté. Utilisez .xlsx, .xls ou .csv.");
  }

  async function importCSVFile(file, db) {
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) throw new Error("Fichier CSV vide.");
    const cols = Object.keys(rows[0]);
    // Auto-detect target table from columns
    if (cols.includes("id") && (cols.includes("enabled") || cols.includes("desc_fr")) && !cols.includes("factor")) {
      return { ...db, sections: rows.map((r) => coerce(r, SECTION_SCHEMA)) };
    }
    if (cols.includes("code") && cols.includes("base_price")) {
      return { ...db, formats: rows.map((r) => coerce(r, FORMAT_SCHEMA)) };
    }
    if (cols.includes("from") && cols.includes("discount")) {
      return { ...db, tiers: rows.map((r) => coerce(r, TIER_SCHEMA)) };
    }
    if (cols.includes("count") && (cols.includes("fee_chf") || cols.includes("multiplier"))) {
      return { ...db, subjects: rows.map((r) => coerce(r, SUBJ_SCHEMA)) };
    }
    if (cols.includes("id") && cols.includes("factor")) {
      return { ...db, papers: rows.map((r) => coerce(r, PAPER_SCHEMA)) };
    }
    throw new Error("CSV non reconnu — colonnes attendues : code/from/count/id.");
  }

  async function importXLSX(file, db) {
    if (!window.XLSX) throw new Error("Module Excel non chargé.");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const next = { ...db };
    const get = (sheet) => {
      const ws = wb.Sheets[sheet];
      if (!ws) return null;
      return XLSX.utils.sheet_to_json(ws, { defval: "" });
    };
    const se = get("sections");
    if (se && se.length) next.sections = se.map((r) => coerce(r, SECTION_SCHEMA));
    const f = get("formats");
    if (f && f.length) next.formats = f.map((r) => coerce(r, FORMAT_SCHEMA));
    const ti = get("tiers");
    if (ti && ti.length) next.tiers = ti.map((r) => coerce(r, TIER_SCHEMA));
    const su = get("subjects");
    if (su && su.length) next.subjects = su.map((r) => coerce(r, SUBJ_SCHEMA));
    const pa = get("papers");
    if (pa && pa.length) next.papers = pa.map((r) => coerce(r, PAPER_SCHEMA));
    const set = get("settings");
    if (set && set.length) {
      const row = set.find((r) => String(r.key) === "express_surcharge_pct");
      if (row) next.express_surcharge_pct = parseFloat(row.value) || 0;
    }
    return next;
  }

  function stamp() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  }

  window.IO = { exportCSV, exportXLSX, importFile };
})();
