// main.js
// Content script principal (ESM). Mantém um agendador simples
// que SEMPRE lê o delay atual de state.delayMs.

import { state, loadPersisted } from "./state.js";

let _timer = 0;

function clearPending() {
  if (_timer) {
    clearTimeout(_timer);
    _timer = 0;
  }
}

function schedule() {
  clearPending();
  _timer = setTimeout(run, state.delayMs); // lê o valor ATUAL
}

function scheduleImmediate() {
  run();
}

function run() {
  if (!state.enabled) return;
  // === SUA LÓGICA REAL AQUI ===
  // Troque pelos seus métodos/fluxo:
  rescan();
  draw();
}

// ---- Stubs: substitua/importe suas implementações reais ----
function rescan() {
  // varra/colete o DOM
}
function draw() {
  // atualize/renderize sua UI
}

(async function bootstrap() {
  await loadPersisted();

  // debug/global helpers (para delay-controls.js acessar schedule)
  Object.assign(window, {
    kazu: {
      state,
      schedule,
      scheduleImmediate,
      clearPending,
      // opcional: expor run/rescan/draw se quiser
      run, rescan, draw,
    },
  });

  // se quiser, rode uma primeira vez:
  // schedule();
})();
