// Pricing database — API-backed with localStorage fallback.
// loadSync() returns cached data for the initial render.
// refresh() fetches from the API and updates the cache.
// save() writes to localStorage AND syncs to the API if an admin session is active.

const DB_KEY = "ooh_pricing_db_v8";

const DEFAULT_DB = {
  sections: [], formats: [], papers: [],
  tiers: [], subjects: [],
  express_surcharge_pct: 22,
  shipping: {
    default_chf: 25,
    overrides: [
      { id: "s1", label_fr: "Petite quantité (jusqu'à 49 ex.)",  label_en: "Small qty (up to 49)",   from_qty: 1,   formats: [], fee_chf: 25 },
      { id: "s2", label_fr: "Quantité moyenne (50–99 ex.)",      label_en: "Medium qty (50–99)",     from_qty: 50,  formats: [], fee_chf: 45 },
      { id: "s3", label_fr: "Grande quantité (100–249 ex.)",     label_en: "Large qty (100–249)",    from_qty: 100, formats: [], fee_chf: 75 },
      { id: "s4", label_fr: "Très grande quantité (≥ 250 ex.)",  label_en: "Very large qty (≥ 250)", from_qty: 250, formats: [], fee_chf: 120 },
      { id: "s5", label_fr: "Grands formats (F24, MOOH)",        label_en: "Large formats (F24, MOOH)", from_qty: 1, formats: ["F24", "TB", "F12T"], fee_chf: 55 },
    ],
  },
  contact_email: "devis@oohline.ch",
  cookies_banner_enabled: true,
  page_texts: {},
  legal_pages: {},
  header: { logo: null, logo_alt: "OOH Line", brand_name: "OOH Line", brand_tag: "", show_status: true, show_lang: true },
  footer: { enabled: true, sections: [] },
};

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function readCache() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

window.DB = {
  _cache: null,

  // Synchronous — used for the initial React render
  load() {
    if (this._cache) return this._cache;
    const cached = readCache();
    if (cached && cached.formats && cached.formats.length > 0) {
      this._cache = { ...deepClone(DEFAULT_DB), ...cached };
      return this._cache;
    }
    this._cache = deepClone(DEFAULT_DB);
    return this._cache;
  },

  // Called from App on mount — fetches live data from the API
  async refresh() {
    try {
      // If admin is logged in, use the admin endpoint (returns all sections including disabled)
      const isAdmin = window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn();
      const url = isAdmin ? "/api/admin/full-config" : "/api/public/catalog";
      const [catalog, pricing] = await Promise.all([
        fetch(url, { credentials: "include" }).then(r => r.ok ? r.json() : null),
        isAdmin ? Promise.resolve(null) : fetch("/api/public/pricing-config").then(r => r.ok ? r.json() : null),
      ]);

      if (!catalog) return this._cache; // API unavailable — keep cached data

      const merged = {
        ...deepClone(DEFAULT_DB),
        ...(readCache() || {}),
        ...catalog,
        ...(pricing || {}),
      };
      this._cache = merged;
      localStorage.setItem(DB_KEY, JSON.stringify(merged));
      return merged;
    } catch (err) {
      console.warn("[DB] API refresh failed, using cached data:", err.message);
      return this._cache;
    }
  },

  // Save — writes to localStorage and syncs to API (fire-and-forget)
  save(db) {
    this._cache = db;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    // Sync to API if admin is logged in
    if (window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn()) {
      fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(db),
        credentials: "include",
      }).catch(err => console.warn("[DB] API sync failed:", err.message));
    }
  },

  reset() {
    localStorage.removeItem(DB_KEY);
    this._cache = deepClone(DEFAULT_DB);
    return this._cache;
  },

  defaults() { return deepClone(DEFAULT_DB); },
};
