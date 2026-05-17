// Shared UI primitives + small helpers
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// Translation hook
function useT(lang) {
  return useCallback((key) => {
    const dict = window.I18N[lang] || window.I18N.fr;
    return dict[key] || key;
  }, [lang]);
}

// Format thumbnail: visual block scaled to format's aspect ratio
function FormatThumb({ fmt, size = 96, showLabel = true }) {
  // scale to fit within size×size box, keep aspect ratio
  const ratio = fmt.width_cm / fmt.height_cm;
  let w, h;
  if (ratio >= 1) {
    w = size; h = size / ratio;
  } else {
    h = size; w = size * ratio;
  }
  return (
    <div className="fmt-thumb" style={{ width: w, height: h, borderRadius: 4 }}>
      {showLabel && <span className="fmt-thumb-label">{fmt.code}</span>}
    </div>
  );
}

// Number stepper
function Stepper({ value, onChange, min = 1, max = 99999, step = 1 }) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <div className="input-stepper">
      <button type="button" onClick={dec} aria-label="−">−</button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          onChange(isNaN(v) ? min : Math.max(min, Math.min(max, v)));
        }}
      />
      <button type="button" onClick={inc} aria-label="+">+</button>
    </div>
  );
}

// Generic Modal
function Modal({ open, onClose, children, width = 560 }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// Toast
function Toast({ msg, kind = "ok" }) {
  if (!msg) return null;
  return (
    <div className={`toast ${kind}`}>
      <span>{kind === "ok" ? "✓" : "•"}</span> {msg}
    </div>
  );
}

// Tab bar
function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--line)", marginBottom: 20 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: active === t.id ? "var(--brand-700)" : "var(--ink-3)",
            borderBottom: `2px solid ${active === t.id ? "var(--brand-700)" : "transparent"}`,
            marginBottom: -1,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Helper: read editable page text from db, fallback to i18n.
function getPageText(db, page, field, lang, fallback) {
  const grp = db && db.page_texts && db.page_texts[page];
  if (!grp) return fallback;
  const v = grp[`${field}_${lang}`];
  return (v !== undefined && v !== null) ? v : fallback;
}

Object.assign(window, { useT, FormatThumb, Stepper, Modal, Toast, Tabs, getPageText });
