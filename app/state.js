// state.js
// Estado e persistência (Firefox WebExtension)

export const state = {
  enabled: true,
  delayMs: 300,
};

const KEYS = {
  enabled: "enabled",
  delayMs: "delayMs",
};

function toBool(v, fallback = true) {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return fallback;
}

function toMs(v, fallback = 300) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

export async function loadPersisted() {
  try {
    const data = await browser.storage.local.get(Object.values(KEYS));
    if (Object.prototype.hasOwnProperty.call(data, KEYS.enabled)) {
      state.enabled = toBool(data[KEYS.enabled], state.enabled);
    }
    if (Object.prototype.hasOwnProperty.call(data, KEYS.delayMs)) {
      state.delayMs = toMs(data[KEYS.delayMs], state.delayMs);
    }
  } catch (err) {
    console.debug("[state] loadPersisted fallback (no storage)", err);
  }
}

export async function setEnabled(on) {
  state.enabled = toBool(on, state.enabled);
  try {
    await browser.storage.local.set({ [KEYS.enabled]: state.enabled });
  } catch {}
  return state.enabled;
}

export async function setDelayMs(ms) {
  state.delayMs = toMs(ms, state.delayMs);
  try {
    await browser.storage.local.set({ [KEYS.delayMs]: state.delayMs });
  } catch {}
  return state.delayMs;
}

// (Opcional) ouvir mudanças vindas de outras abas/options
export function subscribeStorage(onChange) {
  try {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" && area !== "sync") return;
      let touched = false;
      if (changes[KEYS.enabled]) {
        state.enabled = toBool(changes[KEYS.enabled].newValue, state.enabled);
        touched = true;
      }
      if (changes[KEYS.delayMs]) {
        state.delayMs = toMs(changes[KEYS.delayMs].newValue, state.delayMs);
        touched = true;
      }
      if (touched && typeof onChange === "function") onChange({ ...state });
    });
  } catch {}
}
