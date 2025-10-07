// app/ui.js — conecta UI (inclusive dentro de Shadow DOM) ao estado/agendador

import { state, setAutoDelayMs, setEnabled } from "./state.js";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(n) || 0)));

function getPanelRoot() {
  // se o painel tiver um host com shadow, procure por aqui:
  const host = document.querySelector("#kbf-panel, [data-kbf-panel], .kbf-panel");
  return host?.shadowRoot || host || document;
}

export function wirePanel({ schedule, scheduleImmediate } = {}) {
  const root = getPanelRoot();
  const $ = (sel) => root.querySelector(sel);

  const delayInput  = $("#kbf-delay");
  const delayDecBtn = $("#kbf-delay-dec");
  const delayIncBtn = $("#kbf-delay-inc");
  const delayLabel  = $("#kbf-delay-label");
  const enabledEl   = $("#kbf-enabled");

  // estado → UI (inicial)
  if (delayInput) delayInput.value = String(clamp(state.autoDelayMs, 0, 10000));
  if (delayLabel) delayLabel.textContent = `${state.autoDelayMs} ms`;
  if (enabledEl && "checked" in enabledEl) enabledEl.checked = !!state.enabled;

  const setUI = (v) => {
    if (delayInput) delayInput.value = String(v);
    if (delayLabel) delayLabel.textContent = `${v} ms`;
  };

  const applyDelay = async (val) => {
    const v = clamp(val, 0, 10000);
    await setAutoDelayMs(v);
    setUI(v);
    try { schedule && schedule(); } catch {}
  };

  // eventos do delay
  delayInput?.addEventListener("input",  (e) => applyDelay(e.target.value));
  delayInput?.addEventListener("change", (e) => applyDelay(e.target.value));

  delayDecBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const cur = Number(delayInput?.value) || state.autoDelayMs;
    applyDelay(cur - (Number(delayInput?.step) || 50));
  });

  delayIncBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const cur = Number(delayInput?.value) || state.autoDelayMs;
    applyDelay(cur + (Number(delayInput?.step) || 50));
  });

  // ligar/desligar (opcional)
  enabledEl?.addEventListener("change", async (e) => {
    await setEnabled(!!e.target.checked);
    if (state.enabled) try { scheduleImmediate && scheduleImmediate(); } catch {}
  });

  // refletir mudanças externas (outra aba/options)
  try {
    (browser?.storage || chrome?.storage)?.onChanged.addListener?.((changes, area) => {
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

  // opcional: expor utilitário de teste
  return { applyDelay };
}
