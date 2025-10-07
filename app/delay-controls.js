// app/delay-controls.js — liga os controles de delay do painel

const STORAGE_KEY = "kbf_delay";
const clamp = (n, lo, hi) => {
  n = Number(n); if (!Number.isFinite(n)) return lo;
  n = Math.round(n); return Math.min(hi, Math.max(lo, n));
};

async function storageGet(key, def) {
  try {
    if (typeof browser !== "undefined" && browser.storage?.local) {
      const o = await browser.storage.local.get(key);
      return o?.[key] ?? def;
    }
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const o = await new Promise(r => chrome.storage.local.get(key, r));
      return o?.[key] ?? def;
    }
  } catch {}
  try { const raw = localStorage.getItem(key); return raw == null ? def : JSON.parse(raw); } catch { return def; }
}

async function storageSet(obj) {
  try {
    if (typeof browser !== "undefined" && browser.storage?.local) return void await browser.storage.local.set(obj);
    if (typeof chrome !== "undefined" && chrome.storage?.local)  return void await new Promise(r => chrome.storage.local.set(obj, r));
  } catch {}
  try { for (const [k,v] of Object.entries(obj)) localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

export async function wireDelayControls({ root, state, onChange }) {
  const input = root.querySelector("#kbf-delay");
  const dec   = root.querySelector("#kbf-delay-dec");
  const inc   = root.querySelector("#kbf-delay-inc");
  const label = root.querySelector("#kbf-delay-label");

  if (!input && !dec && !inc) return false;

  // valor inicial: storage -> state -> UI
  const saved = await storageGet(STORAGE_KEY, state.autoDelayMs ?? 120);
  state.autoDelayMs = clamp(saved, 0, 10000);
  if (input) input.value = String(state.autoDelayMs);
  if (label) label.textContent = `${state.autoDelayMs} ms`;

  const apply = async (val) => {
    state.autoDelayMs = clamp(val, 0, 10000);
    if (input) input.value = String(state.autoDelayMs);
    if (label) label.textContent = `${state.autoDelayMs} ms`;
    await storageSet({ [STORAGE_KEY]: state.autoDelayMs });
    onChange?.();
  };

  input?.addEventListener("input",  e => apply(e.target.value));
  input?.addEventListener("change", e => apply(e.target.value));
  dec  ?.addEventListener("click", e => { e.preventDefault(); const step = Number(input?.step)||50; apply((Number(input?.value)||state.autoDelayMs)-step); });
  inc  ?.addEventListener("click", e => { e.preventDefault(); const step = Number(input?.step)||50; apply((Number(input?.value)||state.autoDelayMs)+step); });

  return true;
}
