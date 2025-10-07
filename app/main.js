// app/main.js — agendador único lendo state.autoDelayMs “ao vivo”

import { state, loadPersisted } from "./state.js";
import { wirePanel } from "./ui.js";

console.log("[KBF] main.js LOADED");

let _timer = 0;

function clearPending() {
  if (_timer) { clearTimeout(_timer); _timer = 0; }
}

function schedule() {
  clearPending();
  const ms = Math.max(0, Number(state.autoDelayMs) || 0);
  console.log("[KBF] schedule in", ms, "ms");
  _timer = setTimeout(runScan, ms);
}

function scheduleImmediate() {
  clearPending();
  runScan();
}

function runScan() {
  if (!state.enabled) { console.log("[KBF] skipped (disabled)"); return; }
  console.log("[KBF] runScan at", performance.now().toFixed(1));
  // rescan(); draw();  // suas funções
}

// inputs comuns que devem reagendar
function attachInputListeners(root = document) {
  const sel = 'input[type="text"], input[type="search"], textarea, [contenteditable="true"]';
  const els = Array.from(root.querySelectorAll(sel));
  els.forEach((el) => {
    el.removeEventListener("input", schedule);
    el.addEventListener("input", schedule);
  });
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

  // conecta o painel (funciona em Shadow DOM)
  wirePanel({ schedule, scheduleImmediate });

  attachInputListeners(document);
  const mo = observeDomForInputs();

  // debug helpers
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
