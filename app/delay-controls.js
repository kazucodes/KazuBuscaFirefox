// app/delay-controls.js — inicializa e controla o Delay (sem browser.storage)
// Funciona com Shadow DOM, sem depender de IDs específicos.

(function () {
  "use strict";

  const DEF = 120;
  const K1  = "kbf:autoDelayMs"; // chave compat
  const K2  = "kbf_delay";       // chave compat

  // ---------- utils ----------
  const clamp = (n) => {
    n = Number(n);
    if (!Number.isFinite(n)) n = DEF;
    n = Math.round(n);
    return Math.min(10000, Math.max(0, n));
  };

  const save = (v) => {
    v = clamp(v);
    try { localStorage.setItem(K1, JSON.stringify(v)); } catch {}
    try { localStorage.setItem(K2, JSON.stringify(v)); } catch {}
    return v;
  };

  const load = () => {
    try { const a = localStorage.getItem(K1); if (a != null) return clamp(JSON.parse(a)); } catch {}
    try { const b = localStorage.getItem(K2); if (b != null) return clamp(JSON.parse(b)); } catch {}
    return DEF;
  };

  const schedule = () => { try { window.kbf?.schedule?.(); } catch {} };
  const T = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

  // ---------- estado global (garante valor inicial) ----------
  (function initState() {
    const v = load();
    const kbf = (window.kbf = window.kbf || {});
    kbf.state = kbf.state || {};
    if (!Number.isFinite(kbf.state.autoDelayMs)) {
      kbf.state.autoDelayMs = v;
    } else {
      // mantém o que já havia, mas persiste
      save(kbf.state.autoDelayMs);
    }
    // API p/ debug/uso externo
    kbf.getDelay = () => clamp(kbf.state.autoDelayMs ?? DEF);
    kbf.setDelay = (val) => apply(val);
  })();

  // ---------- heurísticas de identificação ----------
  function looksLikeMinus(el) {
    const t = T(el);
    return /^-?$/.test(t) || /−/.test(t) || /menos/i.test(t) ||
           /(^|[-_])dec($|[-_])/i.test(el.id||"") ||
           /dec/i.test(el.getAttribute?.("data-role")||"") ||
           /dec|minus|decrement/i.test(el.getAttribute?.("aria-label")||"");
  }
  function looksLikePlus(el) {
    const t = T(el);
    return /^\+$/.test(t) || /＋/.test(t) || /mais/i.test(t) ||
           /(^|[-_])inc($|[-_])/i.test(el.id||"") ||
           /inc/i.test(el.getAttribute?.("data-role")||"") ||
           /inc|plus|increment/i.test(el.getAttribute?.("aria-label")||"");
  }
  function isDelayContainer(el) {
    return /\bDelay\b/i.test(T(el)); // seu rótulo usa "Delay"
  }

  function findDelayContextFromPath(path) {
    for (const el of path) {
      if (!(el instanceof Element)) continue;
      const group = el.closest?.("div,nav,header,section,article") || el;
      if (!group || !isDelayContainer(group)) continue;

      const input = group.querySelector("input[type='number']") || group.querySelector("input");
      const buttons = [...group.querySelectorAll("button,[role=button]")];
      const dec = group.querySelector("#kbf-delay-dec") || buttons.find(looksLikeMinus);
      const inc = group.querySelector("#kbf-delay-inc") || buttons.find(looksLikePlus);
      const label = group.querySelector("#kbf-delay-label"); // opcional

      if (input && (dec || inc)) return { group, input, dec, inc, label };
    }
    return null;
  }

  function ensureInitialInInput(ctrls) {
    if (!ctrls?.input) return;
    if ((ctrls.input.value ?? "") === "") {
      const v = window.kbf?.getDelay?.() ?? load();
      ctrls.input.valueAsNumber = v;
      if (ctrls.label) ctrls.label.textContent = `${v} ms`;
    }
  }

  // ---------- aplicar / render ----------
  function render(ctrls, v) {
    if (ctrls?.input) ctrls.input.valueAsNumber = v;
    if (ctrls?.label) ctrls.label.textContent = `${v} ms`;
  }

  function apply(v, ctrls) {
    const n = clamp(v);
    (window.kbf = window.kbf || {}).state = window.kbf.state || {};
    window.kbf.state.autoDelayMs = n;
    save(n);
    if (ctrls) render(ctrls, n);
    schedule();
    return n;
  }

  // ---------- listeners delegados (captura para Shadow DOM) ----------
  function targetFrom(e) { return (e.composedPath && e.composedPath()[0]) || e.target; }
  function pathFrom(e)   { return (e.composedPath && e.composedPath()) || [e.target]; }

  // input/change no campo numérico
  function onInput(e) {
    const t = targetFrom(e);
    if (!(t instanceof HTMLInputElement) || t.type !== "number") return;
    const ctx = findDelayContextFromPath(pathFrom(e));
    if (!ctx) return;
    apply(t.value, ctx);
  }

  // clique nos botões +/- (ou equivalentes)
  function onClick(e) {
    const p = pathFrom(e);
    const ctx = findDelayContextFromPath(p);
    if (!ctx) return;

    const t = p.find(n => n instanceof Element);
    if (!(t instanceof Element)) return;

    const isDec = looksLikeMinus(t) || !!t.closest?.("[data-role='dec']");
    const isInc = looksLikePlus(t)  || !!t.closest?.("[data-role='inc']");
    if (!isDec && !isInc) return;

    e.preventDefault();
    ensureInitialInInput(ctx);

    const step = Number(ctx.input?.step) || 50;
    const cur  = Number.isFinite(ctx.input?.valueAsNumber)
      ? ctx.input.valueAsNumber
      : (window.kbf?.getDelay?.() ?? load());

    apply(cur + (isInc ? step : -step), ctx);
  }

  // setinhas ↑/↓ no input
  function onKey(e) {
    const t = targetFrom(e);
    if (!(t instanceof HTMLInputElement) || t.type !== "number") return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

    const ctx = findDelayContextFromPath(pathFrom(e));
    if (!ctx) return;

    e.preventDefault();
    ensureInitialInInput(ctx);

    const step = Number(ctx.input?.step) || 50;
    const cur  = Number.isFinite(ctx.input?.valueAsNumber)
      ? ctx.input.valueAsNumber
      : (window.kbf?.getDelay?.() ?? load());

    apply(cur + (e.key === "ArrowUp" ? step : -step), ctx);
  }

  document.addEventListener("input",   onInput, { capture: true });
  document.addEventListener("change",  onInput, { capture: true });
  document.addEventListener("click",   onClick, { capture: true });
  document.addEventListener("keydown", onKey,   { capture: true });

  // Preenche automaticamente inputs vazios quando a barra aparece
  const mo = new MutationObserver(() => {
    const blocks = [...document.querySelectorAll("div,nav,header,section,article")]
      .filter(el => isDelayContainer(el) && el.querySelector("input[type='number']"));
    for (const b of blocks) {
      const input = b.querySelector("input[type='number']");
      if (input && input.value === "") {
        input.valueAsNumber = window.kbf?.getDelay?.() ?? load();
        const label = b.querySelector("#kbf-delay-label");
        if (label) label.textContent = `${input.valueAsNumber} ms`;
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
