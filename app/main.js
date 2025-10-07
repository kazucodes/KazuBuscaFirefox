// app/main.js — agendador único lendo state.autoDelayMs “ao vivo”

import { state, loadPersisted } from "./state.js";
import { wirePanel } from "./ui.js";

let _timer = 0;

function clearPending() {
  if (_timer) { clearTimeout(_timer); _timer = 0; }
}

function schedule() {
  clearPending();
  const ms = Math.max(0, Number(state.autoDelayMs) || 0);
  _timer = setTimeout(runScan, ms);
}

function scheduleImmediate() {
  clearPending();
  runScan();
}

function runScan() {
  if (!state.enabled) return;

  // chame suas funções reais aqui (sem quebrar se não existirem):
  try {
    if (typeof window.kazuCore?.rescan === "function") window.kazuCore.rescan();
    else if (typeof rescan === "function") rescan();
  } catch (e) { /* noop */ }

  try {
    if (typeof window.kazuCore?.draw === "function") window.kazuCore.draw();
    else if (typeof draw === "function") draw();
  } catch (e) { /* noop */ }
}

// reagendar em inputs usuais
function attachInputListeners(root = document) {
  const sel = 'input[type="text"], input[type="search"], textarea, [contenteditable="true"]';
  for (const el of root.querySelectorAll(sel)) {
    el.removeEventListener("input", schedule);
    el.addEventListener("input", schedule);
  }
}

function observeDomForInputs() {
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "childList" && (m.addedNodes?.length || m.removedNodes?.length)) {
        attachInputListeners(document);
        schedule();
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  return mo;
}

(async function bootstrap() {
  await loadPersisted();

  // conecta os controles do painel
  wirePanel({ schedule, scheduleImmediate });

  // listeners gerais
  attachInputListeners(document);
  const mo = observeDomForInputs();

  // helpers de debug
  Object.assign(window, {
    kazu: {
      state,
      schedule,
      scheduleImmediate,
      clearPending,
      destroy() { try { mo.disconnect(); } catch {}; clearPending(); },
    },
  });

  // opcional: primeira execução
  // schedule();
})();
