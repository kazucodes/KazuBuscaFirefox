// app/state.js — estado global + persistência
(function (global) {
  "use strict";

  const STORAGE_DELAY   = "kbf_delay";
  const STORAGE_ENABLED = "kbf_enabled";

  function clamp(n, lo, hi) {
    n = Number(n);
    if (!Number.isFinite(n)) n = lo;
    n = Math.round(n);
    return Math.min(hi, Math.max(lo, n));
  }

  const storage = {
    async get(key, defVal) {
      try {
        if (typeof browser !== "undefined" && browser.storage?.local) {
          const o = await browser.storage.local.get(key);
          return o && o[key] !== undefined ? o[key] : defVal;
        }
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
          const o = await new Promise(r => chrome.storage.local.get(key, r));
          return o && o[key] !== undefined ? o[key] : defVal;
        }
      } catch {}
      try { const raw = localStorage.getItem(key); return raw == null ? defVal : JSON.parse(raw); }
      catch { return defVal; }
    },
    async set(obj) {
      try {
        if (typeof browser !== "undefined" && browser.storage?.local) return void (await browser.storage.local.set(obj));
        if (typeof chrome !== "undefined" && chrome.storage?.local)  return void (await new Promise(r => chrome.storage.local.set(obj, r)));
      } catch {}
      try { for (const k in obj) localStorage.setItem(k, JSON.stringify(obj[k])); } catch {}
    }
  };

  const state = global.state || {
    enabled: true,
    autoDelayMs: 120
  };
  global.state = state;

  async function loadState() {
    state.autoDelayMs = clamp(await storage.get(STORAGE_DELAY, state.autoDelayMs ?? 120), 0, 10000);
    state.enabled     = !!(await storage.get(STORAGE_ENABLED, state.enabled ?? true));
  }

  async function setDelayMs(ms) {
    state.autoDelayMs = clamp(ms, 0, 10000);
    await storage.set({ [STORAGE_DELAY]: state.autoDelayMs });
  }

  function getDelayMs() {
    return clamp(state.autoDelayMs ?? 120, 0, 10000);
  }

  async function setEnabled(on) {
    state.enabled = !!on;
    await storage.set({ [STORAGE_ENABLED]: state.enabled });
  }

  global.kbf = Object.assign(global.kbf || {}, {
    state,
    loadState,
    setDelayMs,
    getDelayMs,
    setEnabled
  });
})(window);
