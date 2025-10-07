// app/main.js — agendador único lendo o delay do estado (sem debounce fixo)
import { state, loadPersisted } from "./state.js";
import { wirePanel } from "./ui.js";

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
  console.log("[KBF] scheduleImmediate");
  runScan();
}

function runScan() {
  if (!state.enabled) { console.log("[KBF] skipped (disabled)"); return; }
  console.log("[KBF] runScan at", performance.now().toFixed(1));

  // chame suas funções reais (não quebra se não existirem):
  try {
    if (typeof window.kazuCore?.rescan === "function") window.kazuCore.rescan();
    else if (typeof rescan === "function") rescan();
  } catch (e) { console.debug("[KBF] rescan error", e); }

  try {
    if (typeof window.kazuCore?.draw === "function") window.kazuCore.draw();
    else if (typeof draw === "function") draw();
  } catch (e) { console.debug("[KBF] draw error", e); }
}

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
  console.log("[KBF] main.js LOADED");
  await loadPersisted();

  wirePanel({ schedule, scheduleImmediate });

  attachInputListeners(document);
  const mo = observeDomForInputs();

  // helpers p/ depurar no console do content script
  Object.assign(window, {
    kazu: {
      state,
      schedule,
      scheduleImmediate,
      clearPending,
      destroy() { try { mo.disconnect(); } catch {}; clearPending(); },
    },
  });

  // opcional: dispare uma primeira execução
  // schedule();
})();
