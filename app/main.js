// app/main.js — agenda usando SEMPRE o delay atual; mantém suas rotinas rescan/draw
(function (global) {
  "use strict";

  const state = (global.kbf && global.kbf.state) || (global.state ||= { enabled: true, autoDelayMs: 120 });
  const getDelayMs = global.kbf?.getDelayMs || (() => state.autoDelayMs ?? 120);

  let _t = 0;

  function clearPending(){ if (_t) { clearTimeout(_t); _t = 0; } }

  function schedule() {
    clearPending();
    if (!state.enabled) return;
    const ms = Math.max(0, Number(getDelayMs()) || 0);
    _t = setTimeout(run, ms);
  }

  function scheduleImmediate() {
    clearPending();
    if (!state.enabled) return;
    run();
  }

  function run() {
    try { (global.kazuCore?.rescan ?? global.rescan)?.(); } catch {}
    try { (global.kazuCore?.draw  ?? global.draw )?.(); } catch {}
  }

  // Inputs da página re-disparam schedule
  function hookTyping() {
    const sel = 'input[type="text"], input[type="search"], textarea, [contenteditable="true"]';
    try {
      document.querySelectorAll(sel).forEach(el => {
        el.removeEventListener("input", schedule);
        el.addEventListener("input", schedule);
      });
    } catch {}
  }

  (async function boot() {
    if (global.kbf?.loadState) await global.kbf.loadState();
    hookTyping();
    const mo = new MutationObserver(hookTyping);
    mo.observe(document.documentElement, { childList: true, subtree: true });

    schedule();

    // expõe pra outros módulos
    global.kbf = Object.assign(global.kbf || {}, { schedule, scheduleImmediate });
  })();
})(window);
