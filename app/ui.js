// app/ui.js
import { state, storage, addIgnored, isIgnored, persistIgnored } from "./state.js";

// guarda refs do overlay/painel
let UI = null;

// render atual
let rendered = []; // [{pair, key, mEl, aEl}]
let typingTimer = null;

const AUTO_DELAY_MS = 300;        // auto-marcar após digitar
const BADGE_W = 28, BADGE_H = 28; // devem casar com CSS do overlay
const ARROW_W = 26, ARROW_H = 18;
const EDGE_PAD = 2;


// util: viewport real (visualViewport)
function getVP() {
  const v = window.visualViewport;
  return v ? { x: v.offsetLeft, y: v.offsetTop, w: v.width, h: v.height }
           : { x: 0,            y: 0,           w: window.innerWidth, h: window.innerHeight };
}

// chave estável para exclusão manual (por posição do ícone)
function pairKey(p) {
  const r = p.iconEl.getBoundingClientRect();
  return `${Math.round(r.left)}x${Math.round(r.top)}`;
}

// posicionamento do selo (esquerda se couber; senão direita)
function computeBadgePos(rect){
  const V = getVP();
  const viewportLeft  = V.x + EDGE_PAD;
  const viewportRight = V.x + V.w - EDGE_PAD;

  const wantLeft = rect.left - BADGE_W - 8;
  const leftOK   = wantLeft >= viewportLeft;

  let left, side;
  if (leftOK) { left = wantLeft; side = "left"; }
  else        { left = rect.right + 8; side = "right"; }

  left = Math.min(Math.max(left, viewportLeft), viewportRight - BADGE_W);
  const top = Math.round(rect.top + V.y + (rect.height - BADGE_H) / 2);
  return { left: Math.round(left), top, side };
}

// posicionamento da seta (gap configurável)
function computeArrowPos(iconRect){
  const V = getVP();
  const viewportLeft  = V.x + EDGE_PAD;
  const viewportRight = V.x + V.w - EDGE_PAD;

  let left = iconRect.right + state.arrowGap;
  const maxLeft = viewportRight - ARROW_W;
  const minLeft = viewportLeft;
  left = Math.min(Math.max(left, minLeft), maxLeft);

  const top = Math.round(iconRect.top + V.y + (iconRect.height - ARROW_H) / 2);
  return { left: Math.round(left), top };
}

// limpa marcadores/setas
export function clearBoxes(){
  rendered.forEach(it => {
    try { it.mEl?.remove(); } catch{}
    try { it.aEl?.remove(); } catch{}
  });
  rendered = [];
}

// atualiza contador (atualmente sem UI; deixo no-op p/ compat.)
export function updateCounter(){ /* opcional */ }

// redesenha todos os selos/setas para o alvo atual
export function drawBadges({pairs}){
  clearBoxes();
  if (!state.enabled || !state.targetNumber || !UI) return;

  const target = String(state.targetNumber);
  let firstRect = null;

  pairs.forEach(p=>{
    if (String(p.num) !== target) return;

    const key = pairKey(p);
    if (isIgnored(key)) return;

    const ir = p.iconEl.getBoundingClientRect();

    // selo
    const m = document.createElement("div");
    m.className = "marker";
    m.textContent = p.num;
    const bpos = computeBadgePos(ir);
    m.style.left = bpos.left + "px";
    m.style.top  = bpos.top  + "px";
    m.dataset.side = bpos.side;
    // excluir falso-positivo: clique no selo quando modo Excluir estiver ativo
    m.addEventListener("click", async (e)=>{
      if (!state.deleteMode) return;
      e.preventDefault(); e.stopPropagation();
      addIgnored(key);
      await persistIgnored();
      // remove esse item imediatamente
      try { m.remove(); } catch {}
      try { a.remove(); } catch {}
    }, true);

    UI.layer.appendChild(m);

    // seta
    const a = document.createElement("div");
    a.className = "arrow";
    const apos = computeArrowPos(ir);
    a.style.left = apos.left + "px";
    a.style.top  = apos.top  + "px";
    UI.layer.appendChild(a);

    rendered.push({ pair:p, key, mEl:m, aEl:a });
    if (!firstRect) firstRect = ir;
  });
}

// reposiciona no scroll/zoom
export function repositionMarkers({pairs}){
  if (!UI || !rendered.length) return;
  rendered.forEach(it=>{
    const ir = it.pair.iconEl.getBoundingClientRect();

    const bpos = computeBadgePos(ir);
    it.mEl.style.left = bpos.left + "px";
    it.mEl.style.top  = bpos.top  + "px";
    it.mEl.dataset.side = bpos.side;

    const apos = computeArrowPos(ir);
    it.aEl.style.left = apos.left + "px";
    it.aEl.style.top  = apos.top  + "px";
  });
}

// conecta painel, botões e inputs
export function wirePanel({ui, state, schedule}){
  UI = ui;

  // aplicar visibilidade inicial do painel/fab
  applyPanelVisibility();

  // número: auto-mark
  ui.input.addEventListener("input", ()=>{
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(()=> {
      const v = (ui.input.value||"").trim();
      if (/^\d{1,2}$/.test(v)) {
        state.targetNumber = v;
        storage.set({ kbf_last_target: v });
        schedule();
        ui.input.value = "";
        ui.input.focus({ preventScroll:true });
      }
    }, AUTO_DELAY_MS);
  });

  ui.btnGo.addEventListener("click", ()=>{
    const v = (ui.input.value||"").trim();
    if (!/^\d{1,2}$/.test(v)) return;
    state.targetNumber = v;
    storage.set({ kbf_last_target: v });
    schedule();
    ui.input.value = "";
    ui.input.focus({ preventScroll:true });
  });

  ui.btnRescan.addEventListener("click", ()=> schedule());

  ui.btnClear.addEventListener("click", ()=>{
    state.targetNumber = null;
    storage.set({ kbf_last_target: "" });
    clearBoxes();
    ui.input.value = "";
    ui.input.focus({ preventScroll:true });
  });

  // Excluir: toggle
  ui.btnDelMode?.addEventListener("click", ()=>{
    state.deleteMode = !state.deleteMode;
    if (state.deleteMode) ui.btnDelMode.classList.add("toggled");
    else ui.btnDelMode.classList.remove("toggled");
  });

  // Distância da seta (input e +/−)
  const syncGapInput = ()=> ui.gapInput && (ui.gapInput.value = String(state.arrowGap));
  syncGapInput();

  ui.gapInput?.addEventListener("change", ()=>{
    const val = Number(ui.gapInput.value);
    if (!Number.isFinite(val)) return;
    state.arrowGap = Math.max(60, Math.min(480, Math.round(val)));
    storage.set({ kbf_gap: state.arrowGap });
    repositionMarkers({pairs:[]}); // reposiciona os já desenhados
  });
  ui.gapDec?.addEventListener("click", ()=>{
    state.arrowGap = Math.max(60, state.arrowGap - 5);
    storage.set({ kbf_gap: state.arrowGap });
    syncGapInput(); repositionMarkers({pairs:[]});
  });
  ui.gapInc?.addEventListener("click", ()=>{
    state.arrowGap = Math.min(480, state.arrowGap + 5);
    storage.set({ kbf_gap: state.arrowGap });
    syncGapInput(); repositionMarkers({pairs:[]});
  });

  // Delay da auto-busca
  const syncDelay = () => { if (UI.delayInput) UI.delayInput.value = String(state.autoDelayMs); };
  syncDelay();

  const clampDelay = v => Math.max(80, Math.min(1000, Math.round(v)));

  const onDelayChange = () => {
    const val = Number(UI.delayInput.value);
    if (!Number.isFinite(val)) return;
    state.autoDelayMs = clampDelay(val);
    storage.set({ kbf_delay: state.autoDelayMs });
  };

  UI.delayInput.addEventListener("change", onDelayChange);
  UI.delayDec.addEventListener("click", ()=> {
    state.autoDelayMs = clampDelay(state.autoDelayMs - 20);
    storage.set({ kbf_delay: state.autoDelayMs });
    syncDelay();
  });
  UI.delayInc.addEventListener("click", ()=> {
    state.autoDelayMs = clampDelay(state.autoDelayMs + 20);
    storage.set({ kbf_delay: state.autoDelayMs });
    syncDelay();
  });


  // Escopo/Desfazer — se você já tiver handlers, conecte aqui; por ora são no-ops
  ui.btnScope?.addEventListener("click", ()=>{/* opcional: iniciar seleção de escopo */});
  ui.btnUnscope?.addEventListener("click", ()=>{/* opcional: limpar escopo */});

  // Mostrar/ocultar painel
  ui.btnHide?.addEventListener("click", ()=>{
    state.panelVisible = false;
    storage.set({ kbf_panel_visible: false });
    applyPanelVisibility();
  });
  ui.fab?.addEventListener("click", ()=>{
    state.panelVisible = true;
    storage.set({ kbf_panel_visible: true });
    applyPanelVisibility();
  });
}

// aplica a visibilidade do painel/fab
function applyPanelVisibility(){
  if (!UI) return;
  UI.panel.style.display = state.panelVisible ? "flex" : "none";
  UI.fab.style.display   = state.panelVisible ? "none" : "block";
}