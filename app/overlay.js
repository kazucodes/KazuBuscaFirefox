// app/overlay.js
// Só cuida da UI (Shadow DOM). A lógica fica no content.js.
// expõe window.kbfOverlay.mountOverlay()

(() => {
  function mountOverlay() {
    const old = document.getElementById("kbf-host");
    if (old) old.remove();

    const host = document.createElement("div");
    host.id = "kbf-host";
    Object.assign(host.style, {
      position: "fixed", left: 0, top: 0, width: 0, height: 0,
      zIndex: 2147483647, pointerEvents: "none"
    });
    document.documentElement.appendChild(host);

    const sh = host.attachShadow({ mode: "open" });
    sh.innerHTML = `
      <style>
        .layer{position:absolute;inset:0;pointer-events:none;font:13px system-ui,-apple-system,Segoe UI,Roboto,Arial}
        .ui{position:absolute;inset:0;pointer-events:auto;}

        /* Painel à esquerda + responsivo */
        .panel{
          position:fixed;
          left:10px; top:10px;
          display:flex; align-items:center; gap:8px; flex-wrap:wrap;
          max-width:calc(100vw - 20px);
          background:rgba(20,20,22,.92); color:#fff; padding:8px; border-radius:12px;
          border:1px solid rgba(255,255,255,.12); box-shadow:0 8px 24px rgba(0,0,0,.45);
          pointer-events:auto; user-select:none;
        }
        .panel.compact{ font-size:12px; gap:6px; padding:6px; }

        .panel input[type="text"]{width:90px;padding:6px 8px;border-radius:8px;border:1px solid #333;background:#0f0f12;color:#fff}
        .panel button{padding:6px 10px;border-radius:10px;border:1px solid #2b2b2b;background:#1b1b1f;color:#eee;cursor:pointer}
        .panel button.primary{background:#0b5cff;border-color:#0b5cff;color:#fff}
        .panel button.toggled{background:#ff3b3b;border-color:#ff3b3b;color:#fff}
        .panel .sep{width:1px;height:18px;background:#333;margin:0 2px}

        .group-adv{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .gapBox,.delayBox{display:flex;align-items:center;gap:6px;background:#141416;padding:4px 6px;border-radius:8px;border:1px solid #2b2b2b}
        .gapBox input,.delayBox input{width:60px;padding:4px 6px;border-radius:6px;border:1px solid #333;background:#0f0f12;color:#fff}

        /* Colapso (modo simples): mostra só nº, Limpar e Mais ▾ */
        .panel.collapsed .group-adv{ display:none; }
        .panel.collapsed .only-adv{ display:none !important; }
        .panel.collapsed .sep{ display:none; }

        .fab{
          position:fixed;left:10px;top:10px;width:36px;height:36px;border-radius:18px;background:#0b5cff;color:#fff;border:none;cursor:pointer;
          display:none;pointer-events:auto;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.45)
        }

        /* Estilos dos marcadores usados pelo content.js */
        .marker{
          position:absolute;width:28px;height:28px;background:#ffd400;color:#1a1a1a;border-radius:10px;font-weight:700;font-size:13px;
          display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.25);pointer-events:auto;user-select:none;
          will-change: transform; left:0; top:0;
        }
        .marker[data-side="left"]::after{
          content:"";position:absolute;right:-8px;top:50%;transform:translateY(-50%);
          border-width:6px;border-style:solid;border-color:transparent transparent transparent #ffd400;
          filter:drop-shadow(0 0 2px rgba(0,0,0,.2))
        }
        .marker[data-side="right"]::after{
          content:"";position:absolute;left:-8px;top:50%;transform:translateY(-50%);
          border-width:6px;border-style:solid;border-color:transparent #ffd400 transparent transparent;
          filter:drop-shadow(0 0 2px rgba(0,0,0,.2))
        }
        .arrow{
          position:absolute;width:26px;height:18px;background:#00E5FF;border-radius:6px;
          box-shadow:0 2px 10px rgba(0,0,0,.25);pointer-events:none;user-select:none;
          will-change: transform; left:0; top:0;
        }
        .arrow::after{
          content:"";position:absolute;right:-9px;top:50%;transform:translateY(-50%);
          border-width:9px 0 9px 9px;border-style:solid;border-color:transparent transparent transparent #00E5FF;
          filter:drop-shadow(0 0 2px rgba(0,0,0,.2))
        }
      </style>

      <div class="layer" id="kbf-layer"></div>
      <div class="ui" id="kbf-ui"></div>

      <button id="kbf-fab" class="fab" title="Abrir painel">KB</button>

      <div id="kbf-panel" class="panel">
        <!-- sempre visível -->
        <input id="kbf-input" type="text" maxlength="2" inputmode="numeric" placeholder="nº..." />
        <button id="kbf-clear">Limpar</button>
        <button id="kbf-more" class="primary" title="Mais opções">Mais ▾</button>

        <!-- avançado -->
        <div class="group-adv" id="kbf-adv">
          <button id="kbf-go" class="only-adv">Marcar</button>
          <button id="kbf-rescan" title="Re-escanear" class="only-adv">↻</button>

          <div class="sep only-adv"></div>
          <button id="kbf-scope"   class="only-adv">Escopo</button>
          <button id="kbf-unscope" class="only-adv">Desfazer</button>

          <div class="sep only-adv"></div>
          <div class="gapBox only-adv">
            <span>Seta</span>
            <button id="kbf-gap-dec" title="-">–</button>
            <input id="kbf-gap" type="number" step="5" min="60" max="480" />
            <button id="kbf-gap-inc" title="+">+</button>
          </div>

          <div class="sep only-adv"></div>
          <div class="delayBox only-adv">
            <span>Delay</span>
            <button id="kbf-delay-dec" title="-">–</button>
            <input id="kbf-delay" type="number" step="20" min="80" max="1000" />
            <span>ms</span>
            <button id="kbf-delay-inc" title="+">+</button>
          </div>

          <div class="sep only-adv"></div>
          <button id="kbf-del"  class="only-adv" title="Remover falsos positivos">Excluir</button>
          <button id="kbf-hide" class="only-adv" title="Fechar painel">✕</button>
        </div>
      </div>
    `;

    return {
      sh,
      layer: sh.getElementById("kbf-layer"),
      uiLayer: sh.getElementById("kbf-ui"),
      panel: sh.getElementById("kbf-panel"),
      fab: sh.getElementById("kbf-fab"),
      input: sh.getElementById("kbf-input"),
      btnGo: sh.getElementById("kbf-go"),
      btnClear: sh.getElementById("kbf-clear"),
      btnRescan: sh.getElementById("kbf-rescan"),
      btnScope: sh.getElementById("kbf-scope"),
      btnUnscope: sh.getElementById("kbf-unscope"),
      btnHide: sh.getElementById("kbf-hide"),
      btnMore: sh.getElementById("kbf-more"),
      adv: sh.getElementById("kbf-adv"),
      btnDelMode: sh.getElementById("kbf-del"),
      gapInput: sh.getElementById("kbf-gap"),
      gapDec: sh.getElementById("kbf-gap-dec"),
      gapInc: sh.getElementById("kbf-gap-inc"),
      delayInput: sh.getElementById("kbf-delay"),
      delayDec:   sh.getElementById("kbf-delay-dec"),
      delayInc:   sh.getElementById("kbf-delay-inc"),
    };
  }

  // exporta global para o content.js (mesmo isolated world)
  window.kbfOverlay = { mountOverlay };
})();
