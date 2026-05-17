// Admin authentication — credentials hashed (SHA-256 + salt) and persisted in
// localStorage. Recovery code is still hard-coded (cannot be otherwise without
// a backend), but the password itself is no longer stored in clear.
//
// LIMITS (be honest about this):
//   • This is client-side only — anyone reading the JS source can read the
//     recovery code and re-implement verifyLogin themselves.
//   • The salt is randomised per install but the hash is in localStorage too,
//     so an offline brute-force is theoretically possible.
//   • Real security needs a server. See BACKEND_SPEC.md for the migration.
//
// What we get vs. plaintext:
//   • No clear password sitting in DevTools → Application → Local Storage.
//   • Sniffing the storage between users / extensions / shared profiles is
//     no longer enough; you'd need to crack the hash.

(function () {
  const CREDS_KEY = "ooh_admin_creds_v2";
  const SESSION_KEY = "ooh_admin_session_v1";

  // >>> CHANGE THIS ONCE BEFORE GOING LIVE — share it with the admin offline <<<
  const RECOVERY_CODE = "OOHL-K8FD-NX2P-9HRQ-Y3T6";

  // Initial credentials (used on first run, until the admin changes them).
  const DEFAULT_USERNAME = "admin";
  const DEFAULT_PASSWORD = "S?3Wq9Z$:8hmf6";

  // ── crypto helpers ────────────────────────────────────────────────────────
  function bufToHex(buf) {
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  function randomSalt() {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return bufToHex(a);
  }
  async function sha256Hex(text) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return bufToHex(hash);
  }
  async function hashPassword(password, salt) {
    // Run a few rounds to slow down brute force at least a little
    let h = await sha256Hex(salt + ":" + password);
    for (let i = 0; i < 1000; i++) h = await sha256Hex(h + ":" + salt);
    return h;
  }

  // ── storage ───────────────────────────────────────────────────────────────
  function readRaw() {
    try {
      const raw = localStorage.getItem(CREDS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function writeRaw(rec) {
    localStorage.setItem(CREDS_KEY, JSON.stringify(rec));
  }

  // First-run init: seeds the default credentials (hashed) so the admin can
  // log in without manual setup. The admin should immediately change them.
  let initPromise = null;
  function ensureInit() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (readRaw()) return;
      const salt = randomSalt();
      const hash = await hashPassword(DEFAULT_PASSWORD, salt);
      writeRaw({ username: DEFAULT_USERNAME, salt, hash, isDefault: true });
    })();
    return initPromise;
  }
  ensureInit(); // fire-and-forget, completes well before any login attempt

  // ── public API ────────────────────────────────────────────────────────────
  async function getUsername() {
    await ensureInit();
    const rec = readRaw();
    return rec ? rec.username : DEFAULT_USERNAME;
  }

  async function isDefault() {
    await ensureInit();
    const rec = readRaw();
    return !!(rec && rec.isDefault);
  }

  async function setCreds({ username, password }) {
    const salt = randomSalt();
    const hash = await hashPassword(String(password), salt);
    writeRaw({ username: String(username).trim(), salt, hash, isDefault: false });
  }

  async function verifyLogin(u, p) {
    await ensureInit();
    const rec = readRaw();
    if (!rec) return false;
    if (rec.username !== String(u).trim()) return false;
    const candidate = await hashPassword(String(p), rec.salt);
    // constant-time compare
    if (candidate.length !== rec.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ rec.hash.charCodeAt(i);
    return diff === 0;
  }

  function verifyRecovery(code) {
    return String(code).trim().toUpperCase() === RECOVERY_CODE.toUpperCase();
  }

  function startSession() { sessionStorage.setItem(SESSION_KEY, "ok"); }
  function endSession() { sessionStorage.removeItem(SESSION_KEY); }
  function isLoggedIn() { return sessionStorage.getItem(SESSION_KEY) === "ok"; }

  // 2FA — flag persisted in localStorage. Real TOTP setup happens in
  // production (server side). Prototype just exposes the on/off state.
  const TWOFA_KEY = "ooh_admin_2fa_v1";
  function isTwoFactorEnabled() { return localStorage.getItem(TWOFA_KEY) === "on"; }
  function setTwoFactorEnabled(on) {
    if (on) localStorage.setItem(TWOFA_KEY, "on");
    else localStorage.removeItem(TWOFA_KEY);
  }

  window.Auth = {
    getUsername, isDefault, setCreds, verifyLogin, verifyRecovery,
    startSession, endSession, isLoggedIn,
    isTwoFactorEnabled, setTwoFactorEnabled,
  };
})();
