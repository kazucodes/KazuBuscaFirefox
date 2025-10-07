// state.js — estado global + persistência

const _storage = (typeof browser !== 'undefined' ? browser.storage.local : chrome.storage.local);

export const storage = {
  async get(keys) {
    return new Promise(res => _storage.get(keys, res));
  },
  async set(obj) {
    return new Promise(res => _storage.set(obj, res));
  }
};

export const state = {
  enabled: true,
  panelVisible: true,
  targetNumber: null,

  // UI
  arrowGap: 230,
  autoDelayMs: 300,
  deleteMode: false,

  // dados de detecção
  icons: [],
  nums: [],
  pairs: [],

  // escopo opcional
  scopeEl: null,

  // exclusões (sessão)
  excluded: new Set(),
};

export async function loadPersisted() {
  try {
    const res = await storage.get([
      "kbf_last_target",
      "kbf_gap",
      "kbf_panel_visible",
      "kbf_auto_delay_ms"
    ]);
    if (typeof res.kbf_last_target === "string" && res.kbf_last_target.trim()) {
      state.targetNumber = res.kbf_last_target.trim();
    }
    if (Number.isFinite(+res.kbf_gap)) state.arrowGap = +res.kbf_gap;
    if (typeof res.kbf_panel_visible === "boolean") state.panelVisible = res.kbf_panel_visible;
    if (Number.isFinite(+res.kbf_auto_delay_ms)) state.autoDelayMs = +res.kbf_auto_delay_ms;
  } catch (e) {
    console.warn("KBF warn: loadPersisted", e);
  }
}

export function setPanelVisible(v) {
  state.panelVisible = !!v;
  storage.set({ kbf_panel_visible: state.panelVisible });
}

export function setArrowGap(g) {
  const gg = Math.max(60, Math.min(600, Math.floor(g || 230)));
  state.arrowGap = gg;
  storage.set({ kbf_gap: gg });
  return gg;
}

export function setAutoDelay(ms) {
  const clamped = Math.max(80, Math.min(2000, Math.floor(ms || 300)));
  state.autoDelayMs = clamped;
  storage.set({ kbf_auto_delay_ms: clamped });
  return clamped;
}

export function setTargetNumber(v) {
  const t = (v == null) ? null : String(v).trim();
  state.targetNumber = t;
  storage.set({ kbf_last_target: t || "" });
}

export function setData({ icons = [], nums = [], pairs = [] }) {
  state.icons = icons;
  state.nums = nums;
  state.pairs = pairs;
}

export function setScopeEl(el) {
  state.scopeEl = el || null;
}

export function clearScope() {
  state.scopeEl = null;
}
