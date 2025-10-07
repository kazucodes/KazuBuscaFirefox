// app/ui.js — liga Delay (+ / − / input) ao estado/agendador, mesmo em Shadow DOM
import { state, setAutoDelayMs, setEnabled } from "./state.js";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(n) || 0)));

// tenta achar o root do painel (host com shadow) — cai pro document se não tiver
function getPanelRoot() {
  const host = document.querySelector("#kbf-panel, [data-kbf-panel], .kbf-panel");
  return host?.shadowRoot || host || document;
}

function selectControls(root) {
  const $ = (sel) => root.querySelector(sel);
  return {
    delayInput:  $("#kbf-delay"),
    delayDecBtn: $("#kbf-delay-dec"),
    delayIncBtn: $("#kbf-delay-inc"),
    delayLabel:  $("#kbf-delay-label"),
    enabledEl:   $("#kbf-enabled"),
  };
}

export function wirePanel({ schedule, scheduleImmediate } = {}) {
  const root = getPanelRoot();
  let els = selectControls(root);

  // se painel ainda não existe, espera aparecer e conecta
  if (!els.delayInput && !els.delayDecBtn && !els.delayIncBtn) {
    const mo = new MutationObserver(() => {
      const r = getPanelRoot();
      els = selectControls(r);
      if (els.delayInput || els.delayDecBtn || els.delayIncBtn) {
        mo.disconnect();
        console.log("[KBF] UI found — wiring");
        attachHandlers(els);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    attachHandlers(els);
  }

  function setUI(v) {
    if (els.delayInput) els.delayInput.value = String(v);
    if (els.delayLabel) els.delayLabel.textContent = `${v} ms`;
  }

  function attachHandlers(els) {
    // estado → UI (inicial)
    setUI(clamp(state.autoDelayMs, 0, 10000));
    if (els.enabledEl && "checked" in els.enabledEl) els.enabledEl.checked = !!state.enabled;

    const applyDelay = async (val) => {
      const v = clamp(val, 0, 10000);
      await setAutoDelayMs(v);
      setUI(v);
      console.log("[KBF] UI set delay =", v, "ms");
      try { schedule && schedule(); } catch {}
    };

    els.delayInput?.addEventListener("input",  (e) => applyDelay(e.target.value));
    els.delayInput?.addEventListener("change", (e) => applyDelay(e.target.value));

    els.delayDecBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      const step = Number(els.delayInput?.step) || 50;
      const cur  = Number(els.delayInput?.value) || state.autoDelayMs;
      applyDelay(cur - step);
    });

    els.delayIncBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      const step = Number(els.delayInput?.step) || 50;
      const cur  = Number(els.delayInput?.value) || state.autoDelayMs;
      applyDelay(cur + step);
    });

    els.enabledEl?.addEventListener("change", async (e) => {
      await setEnabled(!!e.target.checked);
      if (state.enabled) try { scheduleImmediate && scheduleImmediate(); } catch {}
    });

    // refletir mudanças externas
    try {
      (browser?.storage || chrome?.storage)?.onChanged.addListener?.((changes, area) => {
        if (area !== "local" && area !== "sync") return;
        if (changes["kbf:autoDelayMs"]) {
          const v = clamp(changes["kbf:autoDelayMs"].newValue, 0, 10000);
          setUI(v);
        }
        if (changes["kbf:enabled"] && els.enabledEl && "checked" in els.enabledEl) {
          els.enabledEl.checked = !!changes["kbf:enabled"].newValue;
        }
      });
    } catch {}
  }

  return { /* util se quiser expor algo */ };
}
