// app/state.js — estado + persistência

export const state = {
  enabled: true,
  autoDelayMs: 120,
};

const K = {
  enabled: "kbf:enabled",
  autoDelayMs: "kbf:autoDelayMs",
};

const toBool = (v, fb = true) =>
  typeof v === "boolean" ? v :
  (v === "true" || v === 1 || v === "1") ? true :
  (v === "false" || v === 0 || v === "0") ? false : fb;

const toMs = (v, fb = 120) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fb;
};

export async function loadPersisted() {
  try {
    const data = await browser.storage.local.get([K.enabled, K.autoDelayMs]);
    if (Object.prototype.hasOwnProperty.call(data, K.enabled))    state.enabled    = toBool(data[K.enabled], state.enabled);
    if (Object.prototype.hasOwnProperty.call(data, K.autoDelayMs)) state.autoDelayMs = toMs(data[K.autoDelayMs], state.autoDelayMs);
  } catch (e) { console.debug("[state] storage?", e); }

  try {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" && area !== "sync") return;
      if (changes[K.enabled])    state.enabled    = toBool(changes[K.enabled].newValue, state.enabled);
      if (changes[K.autoDelayMs]) state.autoDelayMs = toMs(changes[K.autoDelayMs].newValue, state.autoDelayMs);
    });
  } catch {}
}

export async function setEnabled(on) {
  state.enabled = toBool(on, state.enabled);
  try { await browser.storage.local.set({ [K.enabled]: state.enabled }); } catch {}
  return state.enabled;
}

export async function setAutoDelay(ms) {
  state.autoDelayMs = toMs(ms, state.autoDelayMs);
  try { await browser.storage.local.set({ [K.autoDelayMs]: state.autoDelayMs }); } catch {}
  return state.autoDelayMs;
}
