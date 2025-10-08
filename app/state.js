// app/state.js — estado + storage (+ delay centralizado)

const KEY_ENABLED = "kbf_enabled";
const KEY_IGNORED = "kbf_ignored";
const KEY_DELAY_A = "kbf:autoDelayMs"; // compat
const KEY_DELAY_B = "kbf_delay";       // compat
const DEFAULT_DELAY = 120;

// ---------- Storage helpers ----------
async function storageGet(key, def) {
  try {
    if (typeof browser !== "undefined" && browser.storage?.local) {
      const o = await browser.storage.local.get(key);
      return (o && o[key] !== undefined) ? o[key] : def;
    }
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const o = await new Promise(r => chrome.storage.local.get(key, r));
      return (o && o[key] !== undefined) ? o[key] : def;
    }
  } catch {}
  try { const raw = localStorage.getItem(key); return raw == null ? def : JSON.parse(raw); } catch { return def; }
}

async function storageSet(obj) {
  try {
    if (typeof browser !== "undefined" && browser.storage?.local) return void (await browser.storage.local.set(obj));
    if (typeof chrome !== "undefined" && chrome.storage?.local)  return void (await new Promise(r => chrome.storage.local.set(obj, r)));
  } catch {}
  try { for (const [k, v] of Object.entries(obj)) localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

// ---------- Estado global ----------
export const state =
  (window.kbf && window.kbf.state) ||
  (window.kbf = Object.assign(window.kbf || {}, { state: {
    enabled: true,
    ignored: [],
    autoDelayMs: DEFAULT_DELAY,   // delay em memória
  }})).state;

// ---------- Delay ----------
const clamp = (n) => {
  n = Number(n);
  if (!Number.isFinite(n)) n = DEFAULT_DELAY;
  n = Math.round(n);
  return Math.min(10000, Math.max(0, n));
};

function loadDelayLocal() {
  try { const a = localStorage.getItem(KEY_DELAY_A); if (a != null) return clamp(JSON.parse(a)); } catch {}
  try { const b = localStorage.getItem(KEY_DELAY_B); if (b != null) return clamp(JSON.parse(b)); } catch {}
  return DEFAULT_DELAY;
}
function saveDelayLocal(v) {
  v = clamp(v);
  try { localStorage.setItem(KEY_DELAY_A, JSON.stringify(v)); } catch {}
  try { localStorage.setItem(KEY_DELAY_B, JSON.stringify(v)); } catch {}
}

export function getDelayMs() {
  const v = clamp(state.autoDelayMs ?? loadDelayLocal());
  // mantém sincronizado em memória
  state.autoDelayMs = v;
  return v;
}

export function setDelayMs(v, { persist = true, schedule = true } = {}) {
  const n = clamp(v);
  state.autoDelayMs = n;
  if (persist) saveDelayLocal(n);
  if (schedule) try { window.kbf?.schedule?.(); } catch {}
  return n;
}

// ---------- Enabled / Ignored ----------
export async function loadState() {
  state.enabled = !!(await storageGet(KEY_ENABLED, state.enabled ?? true));
  const ignored = await storageGet(KEY_IGNORED, []);
  state.ignored = Array.isArray(ignored) ? [...new Set(ignored.map(Number).filter(Number.isFinite))] : [];
  // Delay inicial
  state.autoDelayMs = clamp(state.autoDelayMs ?? loadDelayLocal());
  saveDelayLocal(state.autoDelayMs);
  return state;
}

export async function setEnabled(on) {
  state.enabled = !!on;
  await storageSet({ [KEY_ENABLED]: state.enabled });
  return state.enabled;
}

export function getIgnored() {
  return Array.isArray(state.ignored) ? [...new Set(state.ignored.map(Number).filter(Number.isFinite))] : [];
}

export async function persistIgnored(list) {
  const arr = Array.isArray(list) ? list : [];
  const clean = [...new Set(arr.map(Number).filter(Number.isFinite))];
  state.ignored = clean;
  await storageSet({ [KEY_IGNORED]: clean });
  return clean;
}

// ---------- API global p/ debug ----------
Object.assign(window.kbf || (window.kbf = {}), {
  state, getDelayMs, setDelayMs,
});

export default state;
