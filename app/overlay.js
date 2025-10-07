// app/overlay.js
import { state } from "./state.js";

export function mountOverlay() {
  const prev = document.getElementById("kbf-host");
  if (prev) prev.remove();

  const host = document.createElement("div");
  host.id = "kbf-host";
  Object.assign(host.style, {
    position: "fixed",
    left: "0", top: "0", width: "0", height: "0",
    zIndex: "2147483647",
    pointerEvents: "none"
  });
  document.documentElement.appendChild(host);
  const sh = host.attachShadow({ mode: "open" });

  sh.innerHTML = `
  <style>
    .layer{position:absolute;inset:0;pointer-events:none;font:13px system-ui,-apple-system,Segoe UI,Roboto,Arial}
    .ui-layer{position:absolute;inset:0;pointer-events:auto}

    .panel{
      position:fixed;left:10px;top:10px;display:flex;gap:8px;align-items:center;
      background:rgba(20,20,22,.92);color:#fff;padding:8px;border-radius:12px;
      border:1px solid rgba(255,255,255,.12);box-shadow:0 8px 24px rgba(0,0,0,.45);
      pointer-events:auto;user-select:none
    }
    .panel input[type="text"]{
      width:90px;padding:6px 8px;border-radius:8px;border:1px solid #333;background:#0f0f12;color:#fff
    }
    .panel .box{
      display:flex;align-items:center;gap:6px;background:#141416;padding:4px 6px;border-radius:8px;border:1px solid #2b2b2b
    }
    .panel .box input{
      width:64px;padding:4px 6px;border-radius:6px;border:1px solid #333;background:#0f0f12;color:#fff
    }
    .panel button{
      padding:6px 10px;border-radius:10px;border:1px solid #2b2b2b;background:#1b1b1f;color:#eee;cursor:pointer
    }
    .panel button.primary{background:#0b5cff;border-color:#0b5cff;color:#fff}
    .panel button.toggled{background:#ff3b3b;border-color:#ff3b3b;color:#fff}
    .panel .sep{width:1px;height:18px;background:#333;margin:0 2px}

    .fab{
      position:fixed;left:10px;top:10px;width:36px;height:36px;border-radius:18px;background:#0b5cff;color:#fff;border:none;cursor:pointer;
      display:none;pointer-events:auto;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.45)
    }

    .marker{
      position:absolute;width:28px;height:28px;background:#ffd400;color:#1a1a1a;border-radius:10px;font-weight:700;font-size:13px;
      display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.25);
      user-select:none; left:0; top:0; pointer-events:none;
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
    /* em modo excluir, os marcadores podem ser clicados */
    .marker[data-del="1"]{ pointer-events:auto; cursor:pointer; outline:2px solid rgba(255,59,59,.8) }

    .arrow{
      position:absolute;width:26px;height:18px;background:#ffd400;border-radius:6px;
      box-shadow:0 2px 10px rgba(0,0,0,.25);pointer-events:none;user-select:none; left:0; top:0;
    }
    .arrow::after{
      content:"";position:absolute;right:-9px;top:50%;transform:translateY(-50%);
      border-width:9px 0 9px 9px;border-style:solid;border-color:transparent transparent transparent #ffd400;
      filter:drop-shadow(0 0 2px rgba(0,0,0,.2))
    }

    .iconbox{position:absolute;border:1px dashed rgba(255,255,0,.35);background:rgba(255,255,0,.06);pointer-events:none}
    .pick{outline:2px solid #ffd400 !important; cursor:crosshair !important;}
  </style>

  <div class="layer" id="kbf-layer"></div>
  <div class="ui-layer" id="kbf-ui"></div>

  <button id="kbf-fab" class="fab" title="Abrir painel">KB</button>

  <div id="kbf-panel" class="panel">
    <input id="kbf-input" type="text" maxlength="2" inputmode="numeric" placeholder="nº..." />
    <button id="kbf-go" class="primary">Marcar</button>
    <button id="kbf-clear">Limpar</button>
    <button id="kbf-rescan" title="Re-escanear">↻</button>

    <div class="sep"></div>
    <button id="kbf-scope">Escopo</button>
    <button id="kbf-unscope">Desfazer</button>

    <div class="sep"></div>
    <div class="box">
      <span>Seta</span>
      <button id="kbf-gap-dec" title="-">–</button>
      <input id="kbf-gap" type="number" step="5" min="60" max="600" />
      <button id="kbf-gap-inc" title="+">+</button>
    </div>

    <div class="sep"></div>
    <div class="box">
      <span>Delay</span>
      <button id="kbf-delay-dec" title="-">–</button>
      <input id="kbf-delay" type="number" step="50" min="80" max="2000" />
      <span>ms</span>
      <button id="kbf-delay-inc" title="+">+</button>
    </div>

    <div class="sep"></div>
    <button id="kbf-del" title="Remover falsos positivos">Excluir</button>

    <div class="sep"></div>
    <button id="kbf-hide" title="Fechar painel">✕</button>
  </div>
  `;

  // referências
  const ui = {
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
    btnDelMode: sh.getElementById("kbf-del"),
    gapInput: sh.getElementById("kbf-gap"),
    gapDec: sh.getElementById("kbf-gap-dec"),
    gapInc: sh.getElementById("kbf-gap-inc"),
    delayInput: sh.getElementById("kbf-delay"),
    delayDec: sh.getElementById("kbf-delay-dec"),
    delayInc: sh.getElementById("kbf-delay-inc"),
  };

  // atributos dos inputs numéricos
  ui.gapInput.value = state.arrowGap;
  ui.delayInput.value = state.autoDelayMs;
  ui.delayInput.min = "80"; ui.delayInput.max = "2000"; ui.delayInput.step = "50";

  return ui;
}

export function applyPanelVisibility(ui) {
  if (!ui) return;
  if (state.panelVisible) {
    ui.panel.style.display = "flex";
    ui.fab.style.display = "none";
    // foca sem scroll
    setTimeout(() => ui.input?.focus({ preventScroll: true }), 0);
  } else {
    ui.panel.style.display = "none";
    ui.fab.style.display = "block";
  }
}
