// app/delay-controls.js — conecta os controles do SEU overlay ao estado e reagenda
(function (global) {
  "use strict";

  const kbf = global.kbf || (global.kbf = {});
  const state = kbf.state || (global.state ||= { enabled: true, autoDelayMs: 120 });

  const setDelayMs = kbf.setDelayMs || (v => { state.autoDelayMs = v; });
  const schedule   = () => (kbf.schedule ? kbf.schedule() : void 0);

  const clamp = (n) => {
    n = Number(n); if (!Number.isFinite(n)) n = 120;
    n = Math.round(n);
    return Math.min(10000, Math.max(0, n));
  };

  function panelRoot() {
    const host = document.getElementById("kbf-panel") ||
                 document.querySelector("[data-kbf-panel], .kbf-panel");
    return (host && (host.shadowRoot || host)) || document;
  }

  function wireOnce() {
    const root  = panelRoot();
    const input = root.querySelector("#kbf-delay");
    const dec   = root.querySelector("#kbf-delay-dec");
    const inc   = root.querySelector("#kbf-delay-inc");
    const label = root.querySelector("#kbf-delay-label");

    if (!input && !dec && !inc) return false;           // seu overlay ainda não montou
    if (input && input.dataset.kbfWired === "1") return true;

    // estado -> UI (nunca vazio)
    input && (input.value = String(state.autoDelayMs ?? 120));
    label && (label.textContent = `${state.autoDelayMs ?? 120} ms`);

    const apply = async (val) => {
      const v = clamp(val);
      await Promise.resolve(setDelayMs(v));
      if (input) input.value = String(v);
      if (label) label.textContent = `${v} ms`;
      schedule();
    };

    input?.addEventListener("input",  (e) => apply(e.target.value));
    input?.addEventListener("change", (e) => apply(e.target.value));
    dec  ?.addEventListener("click",  (e) => { e.preventDefault(); const step = Number(input?.step)||50; apply((Number(input?.value)||state.autoDelayMs||120)-step); });
    inc  ?.addEventListener("click",  (e) => { e.preventDefault(); const step = Number(input?.step)||50; apply((Number(input?.value)||state.autoDelayMs||120)+step); });

    if (input) input.dataset.kbfWired = "1";
    return true;
  }

  // liga agora; se o painel montar depois (SPA), observa e liga
  if (!wireOnce()) {
    const mo = new MutationObserver(() => { if (wireOnce()) try { mo.disconnect(); } catch {} });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})(window);
