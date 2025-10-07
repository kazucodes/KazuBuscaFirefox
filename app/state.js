// app/state.js — estado + persistência do KazuBusca (Firefox WebExtension)

export const state = {
  enabled: true,
  autoDelayMs: 120, // padrão do painel
};

const KEYS = {
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

async function storageSet(obj) {
  try {
    if (typeof browser !== "undefined" && browser.storage?.local) {
      await browser.storage.local.set(obj);
    } else if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await new Promise((r) => chrome.storage.local.set(obj, r));
    } else {
      for (const [k, v] of Object.entries(obj)) localStorage.setItem(k, JSON.stringify(v));
    }
  } catch { /* silencioso */ }
}

async function storageGet(keys) {
  try {
    if (typeof browser !== "undefined" && browser.storage?.local) {
      return await browser.storage.local.get(keys);
    } else if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return await new Promise((r) => chrome.storage.local.get(keys, r));
    } else {
      const out = {};
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        out[k] = raw ? JSON.parse(raw) : undefined;
      }
      return out;
    }
  } catch {
    return {};
  }
}

export async function loadPersisted() {
  const data = await storageGet([KEYS.enabled, KEYS.autoDelayMs]);
  if (Object.prototype.hasOwnProperty.call(data, KEYS.enabled)) {
    state.enabled = toBool(data[KEYS.enabled], state.enabled);
  }
  if (Object.prototype.hasOwnProperty.call(data, KEYS.autoDelayMs)) {
    state.autoDelayMs = toMs(data[KEYS.autoDelayMs], state.autoDelayMs);
  }

  // refletir mudanças vindas de outras abas/options
  try {
    (browser?.storage || chrome?.storage)?.onChanged.addListener?.((changes, area) => {
      if (area !== "local" && area !== "sync") return;
      if (changes[KEYS.enabled])    state.enabled    = toBool(changes[KEYS.enabled].newValue, state.enabled);
      if (changes[KEYS.autoDelayMs]) state.autoDelayMs = toMs(changes[KEYS.autoDelayMs].newValue, state.autoDelayMs);
    });
  } catch {}
}

export async function setEnabled(on) {
  state.enabled = toBool(on, state.enabled);
  await storageSet({ [KEYS.enabled]: state.enabled });
  return state.enabled;
}

export async function setAutoDelayMs(ms) {
  state.autoDelayMs = toMs(ms, state.autoDelayMs);
  await storageSet({ [KEYS.autoDelayMs]: state.autoDelayMs });
  return state.autoDelayMs;
}
