// app/overlay.js
export function mountOverlay(){
  const old = document.getElementById("kbf-host");
  if (old) old.remove();

  const host = document.createElement("div");
  host.id = "kbf-host";
  Object.assign(host.style, {
    position: "fixed", left: 0, top: 0, width: 0, height: 0,
    zIndex: 2147483647,
    // IMPORTANTE: host precisa aceitar eventos para o painel funcionar
    pointerEvents: "auto"
  });
  document.documentElement.appendChild(host);

  const sh = host.attachShadow({ mode: "open" });
  sh.innerHTML = `
  <style>
    .layer{position:absolute;inset:0;pointer-events:none;font:13px system-ui,-apple-system,Segoe UI,Roboto,Arial}
    .ui-layer{position:absolute;inset:0;pointer-events:auto;}

    .panel{
      position:fixed;left:10px;top:10px;display:flex;gap:8px;align-items:center;
      background:rgba(20,20,22,.92);color:#fff;padding:8px;border-radius:12px;
      border:1px solid rgba(255,255,255,.12);box-shadow:0 8px 24px rgba(0,0,0,.45);
      pointer-events:auto;user-select:none
    }
    .panel input[type="text"]{width:90px;padding:6px 8px;border-radius:8px;border:1px solid #333;background:#0f0f12;color:#fff}
    .panel .gapBox{display:flex;align-items:center;gap:6px;background:#141416;padding:4px 6px;border-radius:8px;border:1px solid #2b2b2b}
    .panel .gapBox input{width:60px;padding:4px 6px;border-radius:6px;border:1px solid #333;background:#0f0f12;color:#fff}
    .panel button{padding:6px 10px;border-radius:10px;border:1px solid #2b2b2b;background:#1b1b1f;color:#eee;cursor:pointer}
    .panel button.primary{background:#0b5cff;border-color:#0b5cff;color:#fff}
    .panel button.toggled{background:#ff3b3b;border-color:#ff3b3b;color:#fff}
    .panel .sep{width:1px;height:18px;background:#333;margin:0 2px}
    .fab{
      position:fixed;left:10px;top:10px;width:36px;height:36px;border-radius:18px;background:#0b5cff;color:#fff;border:none;cursor:pointer;
      display:none;pointer-events:auto;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.45)
    }

    .marker{
      position:absolute;width:28px;height:28px;background:#ffd400;color:#1a1a1a;border-radius:10px;font-weight:700;font-size:13px;
      display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.25);pointer-events:none;user-select:none;
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
    .kill{
      position:absolute;width:18px;height:18px;border-radius:9px;background:#ff3b3b;color:#fff;
      font-weight:900;font-size:12px;line-height:18px;text-align:center;
      box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer;user-select:none;
      will-change: transform; left:0; top:0;
    }
    .kill:hover{ filter:brightness(1.08); }
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
    <div class="gapBox">
      <span>Seta</span>
      <button id="kbf-gap-dec" title="-">–</button>
      <input id="kbf-gap" type="number" step="5" min="60" max="480" />
      <button id="kbf-gap-inc" title="+">+</button>
    </div>

    <div class="sep"></div>
    <button id="kbf-del" title="Remover falsos positivos">Excluir</button>

    <div class="sep"></div>
    <button id="kbf-hide" title="Fechar painel">✕</button>
  </div>
  `;

  const ui = {
    sh,
    layer: sh.getElementById('kbf-layer'),
    uiLayer: sh.getElementById('kbf-ui'),
    panel: sh.getElementById('kbf-panel'),
    fab: sh.getElementById('kbf-fab'),
    input: sh.getElementById('kbf-input'),
    btnGo: sh.getElementById('kbf-go'),
    btnClear: sh.getElementById('kbf-clear'),
    btnRescan: sh.getElementById('kbf-rescan'),
    btnScope: sh.getElementById('kbf-scope'),
    btnUnscope: sh.getElementById('kbf-unscope'),
    btnHide: sh.getElementById('kbf-hide'),
    btnDelMode: sh.getElementById('kbf-del'),
    gapInput: sh.getElementById('kbf-gap'),
    gapDec: sh.getElementById('kbf-gap-dec'),
    gapInc: sh.getElementById('kbf-gap-inc'),
    // >>> NOVOS CAMPOS (Delay)
    delayInput: sh.getElementById('kbf-delay'),
    delayDec:   sh.getElementById('kbf-delay-dec'),
    delayInc:   sh.getElementById('kbf-delay-inc'),
  };


  return ui;
}
