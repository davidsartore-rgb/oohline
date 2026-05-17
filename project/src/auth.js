// Admin authentication — API-backed.
// Credentials are verified server-side (Argon2id). Sessions are HttpOnly
// cookies managed by the backend. No passwords stored in the browser.

(function () {
  const SESSION_KEY = "ooh_admin_session_v1";

  window.Auth = {
    _username: null,

    // ── Login ────────────────────────────────────────────────────────────────
    async verifyLogin(u, p, totpCode) {
      try {
        const r = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, password: p, totpCode }),
          credentials: "include",
        });
        if (r.ok) {
          const data = await r.json();
          if (data.require2fa) return { require2fa: true };
          this._username = data.username;
          return true;
        }
        try {
          const err = await r.json();
          if (err?.error?.code === "ACCOUNT_LOCKED") return { locked: true, message: err.error.message };
        } catch {}
        return false;
      } catch {
        return false;
      }
    },

    // ── Session ──────────────────────────────────────────────────────────────
    startSession() {
      sessionStorage.setItem(SESSION_KEY, "ok");
    },
    endSession() {
      sessionStorage.removeItem(SESSION_KEY);
      this._username = null;
      fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    },
    isLoggedIn() {
      return sessionStorage.getItem(SESSION_KEY) === "ok";
    },

    // ── Username ─────────────────────────────────────────────────────────────
    async getUsername() {
      if (this._username) return this._username;
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          this._username = d.username;
          return d.username;
        }
      } catch {}
      return "admin";
    },

    async isDefault() { return false; },

    // ── Change credentials ───────────────────────────────────────────────────
    async setCreds({ username, password, oldPassword }) {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername: username, newPassword: password, oldPassword }),
        credentials: "include",
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error?.message || "Failed to update credentials");
      }
      this._username = username;
    },

    // ── Recovery — magic link (email-based) ──────────────────────────────────
    async startRecovery(email) {
      const r = await fetch("/api/auth/recovery/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return r.ok;
    },

    async completeRecovery({ token, newPassword, newUsername }) {
      const r = await fetch("/api/auth/recovery/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, newUsername }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error?.message || "Recovery failed");
      }
      return true;
    },

    verifyRecovery() { return false; }, // Legacy no-op

    // ── 2FA ──────────────────────────────────────────────────────────────────
    async setup2FA() {
      const r = await fetch("/api/auth/2fa/setup", { method: "POST", credentials: "include" });
      return r.ok ? r.json() : null;
    },
    async verify2FA(code) {
      const r = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        credentials: "include",
      });
      return r.ok ? r.json() : null;
    },
    async disable2FA() {
      return fetch("/api/auth/2fa/disable", { method: "POST", credentials: "include" }).then(r => r.ok);
    },
    async isTwoFactorEnabled() {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        if (r.ok) { const d = await r.json(); return !!d.totp_enabled; }
      } catch {}
      return false;
    },
    setTwoFactorEnabled() {},
  };
})();
