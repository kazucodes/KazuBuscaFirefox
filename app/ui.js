// app/ui.js — UI do Delay com event delegation (Shadow DOM safe)
import { state, setAutoDelay, setEnabled } from "./state.js";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(n) || 0)));

function findInPath(path, matchFn) {
  for (const n of path) {
    if (n && n.nodeType === 1 && matchFn(n)) return n;
  }
  return null;
}

function getPanelRoot() {
  // tente um host conhecido; se não houver, use document
  const host = document.querySelector("#kbf-panel, [data-kbf-panel], .kbf-panel");
  return host?.shadowRoot || host || document;
}

export function wirePanel({ schedule, scheduleImmediate } = {}) {
  const root = getPanelRoot();

  // helpers p/ selecionar dentro do root atual
  const $ = (sel) => root.querySelector(sel);
  const delayInput = $("#kbf-delay");
  const delayLabel = $("#kbf-delay-label");
  const enabledEl  = $("#kbf-enabled");

  // estado → UI inicial
  if (delayInput) delayInput.value = String(clamp(state.autoDelayMs, 0, 10000));
  if (delayLabel) delayLabel.textContent = `${state.autoDelayMs} ms`;
  if (enabledEl && "checked" in enabledEl) enabledEl.checked = !!state.enabled;

  const setUI = (v) => {
    if (delayInput) delayInput.value = String(v);
    if (delayLabel) delayLabel.textContent = `${v} ms`;
  };

  const applyDelay = async (val) => {
    const v = clamp(val, 0, 10000);
    await setAutoDelay(v);
    setUI(v);
    try { schedule && schedule(); } catch {}
  };

  // ——— EVENT DELEGATION (funciona em Shadow DOM) ———
  // Captura cliques e inputs, procurando alvos por ID ou data-attr
  const onClickCapture = (e) => {
    const path = e.composedPath?.() || [e.target];

    // - botão DEC
    const isDec = (el) =>
      el.id === "kbf-delay-dec" || (el.dataset && (el.dataset.kbf === "delay-dec" || el.dataset.role === "kbf-delay-dec"));
    const decEl = findInPath(path, isDec);
    if (decEl) {
      e.preventDefault();
      const curr = Number((delayInput || $("#kbf-delay"))?.value) || state.autoDelayMs;
      applyDelay(curr - 50);
      return;
    }

    // - botão INC
    const isInc = (el) =>
      el.id === "kbf-delay-inc" || (el.dataset && (el.dataset.kbf === "delay-inc" || el.dataset.role === "kbf-delay-inc"));
    const incEl = findInPath(path, isInc);
    if (incEl) {
      e.preventDefault();
      const curr = Number((delayInput || $("#kbf-delay"))?.value) || state.autoDelayMs;
      applyDelay(curr + 50);
      return;
    }

    // - enabled (toggle)
    const isEnabled = (el) => el.id === "kbf-enabled" || (el.dataset && el.dataset.kbf === "enabled");
    const enEl = findInPath(path, isEnabled);
    if (enEl && "checked" in enEl) {
      e.preventDefault();
      setEnabled(!!enEl.checked).then(() => {
        if (state.enabled) { try { scheduleImmediate && scheduleImmediate(); } catch {} }
      });
      return;
    }
  };

  const onInputCapture = (e) => {
    const path = e.composedPath?.() || [e.target];
    const isDelayInput = (el) => el.id === "kbf-delay" || (el.dataset && el.dataset.kbf === "delay");
    const inp = findInPath(path, isDelayInput);
    if (inp) {
      applyDelay(inp.value);
    }
  };

  // use CAPTURE pra atravessar shadow boundaries
  document.addEventListener("click", onClickCapture, true);
  document.addEventListener("input", onInputCapture, true);

  // reflita mudanças externas (outra aba/options)
  try {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" && area !== "sync") return;
      if (changes["kbf:autoDelayMs"]) {
        const v = clamp(changes["kbf:autoDelayMs"].newValue, 0, 10000);
        setUI(v);
      }
      if (changes["kbf:enabled"] && enabledEl && "checked" in enabledEl) {
        enabledEl.checked = !!changes["kbf:enabled"].newValue;
      }
    });
  } catch {}

  // expõe utilitário (opcional)
  return {
    applyDelay,
    destroy() {
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("input", onInputCapture, true);
    },
  };
}
