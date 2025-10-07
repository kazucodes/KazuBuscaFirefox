// delay-controls.js
// Liga os elementos: #delayMinus, #delayInput, #delayPlus
// ao estado (browser.storage.local) e chama window.kazu.schedule()
// sempre que o valor mudar.

import { state, setDelayMs } from "./state.js";

const STEP = 50;      // incremento dos botões
const MIN  = 0;
const MAX  = 10000;

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(x)));
}

async function applyDelay(ms) {
  const v = clamp(ms, MIN, MAX);
  const inputEl = document.getElementById("delayInput");
  if (inputEl) inputEl.value = String(v);    // reflete na UI
  await setDelayMs(v);                       // persiste e atualiza state.delayMs
  try { window.kazu?.schedule?.(); } catch {}// reagenda com o NOVO delay
  console.debug("[delay] agora =", v, "ms");
}

function initDelayControls() {
  const minusBtn = document.getElementById("delayMinus");
  const inputEl  = document.getElementById("delayInput");
  const plusBtn  = document.getElementById("delayPlus");

  // inicializa o input com o valor atual do estado
  if (inputEl) inputEl.value = String(clamp(state.delayMs, MIN, MAX));

  minusBtn?.addEventListener("click", () => {
    const cur = Number(inputEl?.value ?? state.delayMs) || 0;
    applyDelay(cur - STEP);
  });

  plusBtn?.addEventListener("click", () => {
    const cur = Number(inputEl?.value ?? state.delayMs) || 0;
    applyDelay(cur + STEP);
  });

  // Atualiza em tempo real enquanto digita; troque para 'change' se preferir
  inputEl?.addEventListener("input", (e) => {
    applyDelay(e.target.value);
  });
}

// Garante que os elementos existam
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDelayControls);
} else {
  initDelayControls();
}
