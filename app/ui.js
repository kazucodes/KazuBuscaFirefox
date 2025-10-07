import { state, setDelayMs, setEnabled } from "./state.js";

const PANEL_ID = "kazu-panel";

function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function formatMs(ms) {
  if (ms < 1000) return `${ms} ms`;
  const s = (ms / 1000).toFixed(ms % 1000 ? 2 : 0);
  return `${s} s`;
}

function buildPanel() {
  // Evita duplicar
  const existing = document.getElementById(PANEL_ID);
  if (existing) return existing;

  const host = document.createElement("div");
  host.id = PANEL_ID;
  host.style.all = "initial"; // reseta estilos herdados da página
  host.style.position = "fixed";
  host.style.inset = "auto 16px 16px auto";
  host.style.zIndex = 2147483646; // quase topo
  host.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host{ all: initial }
    .card{ box-sizing:border-box; width: 320px; background: #0b1220; color:#e8eefc; border:1px solid #2b3754; border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,.35); padding:14px; }
    .row{ display:flex; align-items:center; gap:10px; margin:10px 0 }
    .row.space{ justify-content:space-between }
    .title{ font-weight:600; font-size:14px; letter-spacing:.2px }
    .muted{ opacity:.8; font-size:12px }
    .switch{ position:relative; width:44px; height:24px; background:#24304a; border-radius:12px; cursor:pointer; transition:background .2s }
    .knob{ position:absolute; top:3px; left:3px; width:18px; height:18px; background:#e8eefc; border-radius:50%; transition:left .2s }
    .switch.on{ background:#2563eb }
    .switch.on .knob{ left:23px }
    .range{ -webkit-appearance:none; width:100%; height:6px; background:#24304a; border-radius:999px; outline:none }
    .range::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:16px; height:16px; border-radius:50%; background:#7aa2ff; cursor:pointer }
    .num{ width:88px; background:#0e1629; color:#e8eefc; border:1px solid #2b3754; border-radius:10px; padding:8px; font-size:14px }
    .btn{ background:#1f2a44; color:#e8eefc; border:1px solid #334266; border-radius:10px; padding:8px 10px; font-size:13px; cursor:pointer; transition:filter .15s }
    .btn:hover{ filter:brightness(1.1) }
    .btn.primary{ background:#2563eb; border-color:#1d4ed8 }
    .col{ display:flex; flex-direction:column; gap:6px }
    .grow{ flex:1 }
    .sep{ height:1px; background:#1b2440; margin:8px 0 }
    .small{ font-size:11px; opacity:.8 }
    .link{ color:#9bb8ff; text-decoration:none }
  `;

  const wrap = document.createElement("div");
  wrap.className = "card";
  wrap.innerHTML = `
    <div class="row space">
      <div class="title">KazuBusca</div>
      <div id="enableSwitch" class="switch"><div class="knob"></div></div>
    </div>

    <div class="row">
      <div class="col grow">
        <div class="row" style="margin:6px 0 0 0">
          <input id="delayRange" class="range grow" type="range" min="50" max="5000" step="10" />
          <input id="delayNumber" class="num" type="number" min="0" max="10000" step="10" />
        </div>
        <div id="delayPreview" class="small muted">&nbsp;</div>
      </div>
    </div>

    <div class="sep"></div>

    <div class="row space">
      <div class="row" style="gap:8px">
        <button id="runNowBtn" class="btn">Rodar agora</button>
        <button id="applyBtn" class="btn primary">Aplicar</button>
      </div>
      <a id="collapseLink" class="link small" href="#">minimizar</a>
    </div>
  `;

  shadow.append(style, wrap);
  document.documentElement.appendChild(host);
  return host;
}

function setSwitchEl(el, on) {
  el.classList.toggle("on", !!on);
  el.setAttribute("aria-checked", on ? "true" : "false");
}

function initUI({ onSchedule, onImmediate, onClearPending } = {}) {
  const host = buildPanel();
  const root = host.shadowRoot;
  const enableSwitch = root.getElementById("enableSwitch");
  const delayRange = root.getElementById("delayRange");
  const delayNumber = root.getElementById("delayNumber");
  const delayPreview = root.getElementById("delayPreview");
  const applyBtn = root.getElementById("applyBtn");
  const runNowBtn = root.getElementById("runNowBtn");
  const collapseLink = root.getElementById("collapseLink");

  // Estado visual inicial
  function syncUIFromState() {
    setSwitchEl(enableSwitch, state.enabled);
    const ms = clamp(state.delayMs, 0, 10000);
    delayRange.value = String(clamp(ms, 50, 5000));
    delayNumber.value = String(ms);
    delayPreview.textContent = `Delay atual: ${formatMs(ms)} · ${state.enabled ? "Ativo" : "Desligado"}`;
  }

  // Handlers
  enableSwitch.addEventListener("click", async () => {
    const next = !state.enabled;
    await setEnabled(next);
    setSwitchEl(enableSwitch, next);
    delayPreview.textContent = `Delay atual: ${formatMs(state.delayMs)} · ${next ? "Ativo" : "Desligado"}`;
    // Se desativou, opcionalmente cancele timers pendentes
    try { onClearPending && onClearPending(); } catch {}
  });

  delayRange.addEventListener("input", async (e) => {
    const ms = clamp(e.target.value, 0, 10000);
    delayNumber.value = String(ms);
    delayPreview.textContent = `Delay atual: ${formatMs(ms)} · ${state.enabled ? "Ativo" : "Desligado"}`;
    await setDelayMs(ms);
    try { onSchedule && onSchedule(); } catch {}
  });

  delayNumber.addEventListener("change", async (e) => {
    const ms = clamp(e.target.value, 0, 10000);
    delayNumber.value = String(ms);
    delayRange.value = String(clamp(ms, 50, 5000));
    delayPreview.textContent = `Delay atual: ${formatMs(ms)} · ${state.enabled ? "Ativo" : "Desligado"}`;
    await setDelayMs(ms);
    try { onSchedule && onSchedule(); } catch {}
  });

  applyBtn.addEventListener("click", async () => {
    // Apenas reforça o estado atual e re-agenda
    await setDelayMs(clamp(delayNumber.value, 0, 10000));
    try { onSchedule && onSchedule(); } catch {}
  });

  runNowBtn.addEventListener("click", () => {
    try { onImmediate && onImmediate(); } catch {}
  });

  // Minimizar / restaurar
  let collapsed = false;
  collapseLink.addEventListener("click", (e) => {
    e.preventDefault();
    collapsed = !collapsed;
    const card = collapseLink.closest(".card");
    if (!card) return;
    if (collapsed) {
      card.style.height = "36px";
      card.style.overflow = "hidden";
      collapseLink.textContent = "restaurar";
    } else {
      card.style.height = "auto";
      card.style.overflow = "visible";
      collapseLink.textContent = "minimizar";
    }
  });

  // Reagir a mudanças vindas de fora (outra aba/options)
  try {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" && area !== "sync") return;
      let touched = false;
      if (changes.delayMs) {
        state.delayMs = Number(changes.delayMs.newValue) || state.delayMs;
        touched = true;
      }
      if (changes.enabled) {
        state.enabled = Boolean(changes.enabled.newValue);
        touched = true;
      }
      if (touched) syncUIFromState();
    });
  } catch {}

  // Inicializa visual
  syncUIFromState();

  return {
    updateFromState: syncUIFromState,
    get elements() {
      return { host, enableSwitch, delayRange, delayNumber, delayPreview, applyBtn, runNowBtn, collapseLink };
    },
    destroy() {
      host.remove();
    }
  };
}

export default initUI;
