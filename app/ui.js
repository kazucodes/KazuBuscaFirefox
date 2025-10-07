// app/ui.js
import { state, setArrowGap, setAutoDelay, setPanelVisible, setTargetNumber, setDeleteMode, setScopeEl, persistExcluded } from "./state.js";

// ========= helpers locais (UI) =========
const EDGE_PAD = 2;
const BADGE_W = 28, BADGE_H = 28, BADGE_GAP = 8;
const ARROW_W = 26, ARROW_H = 18;

const getVP = () => {
  const v = window.visualViewport;
  return v ? { x: v.offsetLeft, y: v.offsetTop, w: v.width, h: v.height } :
             { x: 0,            y: 0,           w: window.innerWidth, h: window.innerHeight };
};

const rectArea = (r) => Math.max(1, r.width) * Math.max(1, r.height);

function getRowContainer(el) {
  let cur = el;
  for (let i = 0; i < 6 && cur; i++, cur = cur.parentElement) {
    const cs = cur && getComputedStyle(cur); if (!cs) continue;
    const isRowFlex = cs.display === "flex" && (cs.flexDirection === "row" || cs.flexDirection === "row-reverse");
    const isGrid = cs.display === "grid" && String(cs.gridTemplateColumns || "").length > 0;
    if (isRowFlex || isGrid) return cur;
  }
  return el.parentElement || el;
}

function computeBadgePos(rect) {
  const V = getVP();
  const viewportLeft = V.x + EDGE_PAD;
  const viewportRight = V.x + V.w - EDGE_PAD;

  const wantLeft = rect.left - BADGE_W - BADGE_GAP;
  const leftOK = wantLeft >= viewportLeft;

  let left, side;
  if (leftOK) { left = wantLeft; side = "left"; }
  else { left = rect.right + BADGE_GAP; side = "right"; }

  left = Math.min(Math.max(left, viewportLeft), viewportRight - BADGE_W);
  const top = Math.round(rect.top + V.y + (rect.height - BADGE_H) / 2);
  return { left: Math.round(left), top, side };
}

function computeArrowPos(rowRect, iconRect) {
  const V = getVP();
  const viewportLeft = V.x + EDGE_PAD;
  const viewportRight = V.x + V.w - EDGE_PAD;

  const useRow = rowRect && rowRect.width >= 60 && rowRect.height >= 20;
  const baseLeft = useRow ? rowRect.left : viewportLeft;
  const baseRight = useRow ? rowRect.right : viewportRight;
  const baseTop = useRow ? rowRect.top : iconRect.top;
  const baseH = useRow ? rowRect.height : iconRect.height;

  let left = iconRect.right + state.arrowGap;

  const maxLeft = Math.min(baseRight - 12 - ARROW_W, viewportRight - ARROW_W);
  const minLeft = Math.max(baseLeft + 12, viewportLeft);
  left = Math.min(Math.max(left, minLeft), maxLeft);

  const top = Math.round(baseTop + V.y + (baseH - ARROW_H) / 2);
  return { left: Math.round(left), top };
}

// ========= elementos desenhados =========
let markers = [];     // <div class="marker">
let arrows  = [];     // <div class="arrow">
let boxes   = [];     // debug (não usamos agora)

function clearMarkers(ui) {
  markers.forEach(m => m.remove());
  arrows.forEach(a => a?.remove());
  markers = []; arrows = [];
}
function clearBoxes(ui) {
  boxes.forEach(b => b.remove());
  boxes = [];
}

// ========= exclusão (FP) =========
function makeKeyFromPair(p) {
  // chave estável por ícone + número
  const r = p.iconEl.getBoundingClientRect();
  return `k:${Math.round(r.left)}:${Math.round(r.top)}:${Math.round(r.width)}:${Math.round(r.height)}:${p.num}`;
}

// ========= desenho =========
export function drawBadges(ui, pairs) {
  clearMarkers(ui);
  if (!state.targetNumber) return;

  const matches = pairs.filter(p => p.num === state.targetNumber && !state.excluded.has(makeKeyFromPair(p)));

  let firstRect = null;
  matches.forEach((p, idx) => {
    const ir = p.iconEl.getBoundingClientRect();

    // marcador
    const m = document.createElement("div");
    m.className = "marker";
    m.textContent = p.num;
    const bpos = computeBadgePos(ir);
    m.style.left = bpos.left + "px";
    m.style.top  = bpos.top  + "px";
    m.dataset.side = bpos.side;
    if (state.deleteMode) m.dataset.del = "1";
    ui.layer.appendChild(m);
    markers.push(m);

    // seta
    const rowEl = getRowContainer(p.iconEl);
    const rowRect = rowEl ? rowEl.getBoundingClientRect() : null;
    const a = document.createElement("div");
    a.className = "arrow";
    const apos = computeArrowPos(rowRect, ir);
    a.style.left = apos.left + "px";
    a.style.top  = apos.top  + "px";
    ui.layer.appendChild(a);
    arrows[idx] = a;

    // click para excluir quando em modo delete
    if (state.deleteMode) {
      const key = makeKeyFromPair(p);
      m.addEventListener("click", (ev) => {
        ev.preventDefault();
        state.excluded.add(key);
        persistExcluded();
        drawBadges(ui, pairs);
      }, { once: true });
    }

    if (!firstRect) firstRect = ir;
  });

  // nada de auto-scroll: mantemos a posição
}

export function repositionMarkers(ui, pairs) {
  if (!state.targetNumber) return;
  const matches = pairs.filter(p => p.num === state.targetNumber && !state.excluded.has(makeKeyFromPair(p)));

  matches.forEach((p, idx) => {
    const ir = p.iconEl.getBoundingClientRect();

    const m = markers[idx];
    if (m) {
      const bpos = computeBadgePos(ir);
      m.style.left = bpos.left + "px";
      m.style.top  = bpos.top  + "px";
      m.dataset.side = bpos.side;
      if (state.deleteMode) m.dataset.del = "1"; else m.removeAttribute("data-del");
    }

    const a = arrows[idx];
    if (a) {
      const rowEl = getRowContainer(p.iconEl);
      const rowRect = rowEl ? rowEl.getBoundingClientRect() : null;
      const apos = computeArrowPos(rowRect, ir);
      a.style.left = apos.left + "px";
      a.style.top  = apos.top  + "px";
    }
  });
}

export function wirePanel(ui, { onMarkNow, onRescan, onToggleScope, onClearScope }) {
  // valores iniciais
  ui.gapInput.value = state.arrowGap;
  ui.delayInput.value = state.autoDelayMs;

  // abrir/fechar
  ui.btnHide.addEventListener("click", () => { setPanelVisible(false); applyPanelVisibility(ui); });
  ui.fab.addEventListener("click", () => { setPanelVisible(true);  applyPanelVisibility(ui); });

  // marcar
  let typingTimer = null;
  const trigger = () => onMarkNow((ui.input.value || "").trim());

  ui.input.addEventListener("input", () => {
    if (typingTimer) clearTimeout(typingTimer);
    const v = (ui.input.value || "").trim();
    const base = Math.max(80, Math.min(2000, state.autoDelayMs));
    const delay = (v.length >= 2) ? Math.max(80, Math.round(base * 0.7)) : base;
    typingTimer = setTimeout(trigger, delay);
  });
  ui.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); trigger(); }
  });
  ui.btnGo.addEventListener("click", trigger);

  // limpar
  ui.btnClear.addEventListener("click", () => {
    setTargetNumber(null);
    ui.input.value = "";
    clearMarkers(ui);
  });

  // rescan
  ui.btnRescan.addEventListener("click", onRescan);

  // escopo
  ui.btnScope.addEventListener("click", onToggleScope);
  ui.btnUnscope.addEventListener("click", onClearScope);

  // seta (gap)
  const syncGap = () => ui.gapInput.value = state.arrowGap;
  ui.gapDec.addEventListener("click", () => { ui.gapInput.value = setArrowGap(state.arrowGap - 10); onRescan(); });
  ui.gapInc.addEventListener("click", () => { ui.gapInput.value = setArrowGap(state.arrowGap + 10); onRescan(); });
  ui.gapInput.addEventListener("change", () => {
    ui.gapInput.value = setArrowGap(parseInt(ui.gapInput.value, 10));
    onRescan();
  });
  syncGap();

  // delay
  const syncDelay = () => ui.delayInput.value = state.autoDelayMs;
  ui.delayDec.addEventListener("click", () => { ui.delayInput.value = setAutoDelay(state.autoDelayMs - 50); });
  ui.delayInc.addEventListener("click", () => { ui.delayInput.value = setAutoDelay(state.autoDelayMs + 50); });
  ui.delayInput.addEventListener("change", () => {
    ui.delayInput.value = setAutoDelay(parseInt(ui.delayInput.value, 10));
  });
  syncDelay();

  // excluir (modo)
  const syncDel = () => {
    if (state.deleteMode) ui.btnDelMode.classList.add("toggled");
    else ui.btnDelMode.classList.remove("toggled");
  };
  ui.btnDelMode.addEventListener("click", () => {
    setDeleteMode(!state.deleteMode);
    syncDel();
    // redesenha para habilitar clique nos marcadores
    onRescan();
  });
  syncDel();
}

export function applyPanelVisibility(ui) {
  // proxy para overlay.applyPanelVisibility (mantido aqui por conveniência)
  const evt = new CustomEvent("__kbf_apply_panel__", { bubbles: true });
  ui.panel.dispatchEvent(evt);
}

// ===== Escopo manual (pick) =====
export function startScopePick(cbDone) {
  if (document.body.classList.contains("pick")) return;
  document.body.classList.add("pick");

  const over = e => (e.target.__kbf_prevOutline = e.target.style.outline, e.target.style.outline = "2px solid #ffd400");
  const out  = e => (e.target.style.outline = e.target.__kbf_prevOutline || "", delete e.target.__kbf_prevOutline);

  function finish(el) {
    document.body.classList.remove("pick");
    document.removeEventListener("mouseover", over, true);
    document.removeEventListener("mouseout", out, true);
    document.removeEventListener("click", click, true);
    setScopeEl(el || null);
    cbDone?.();
  }
  function click(e) {
    e.preventDefault(); e.stopPropagation();
    const el = e.target.closest('section, table, [role="rowgroup"], [data-market], .market, .selection, .panel, .table, .widget, div');
    finish(el || e.target);
  }

  document.addEventListener("mouseover", over, true);
  document.addEventListener("mouseout", out, true);
  document.addEventListener("click", click, true);
}

export function clearScope(cbDone) {
  setScopeEl(null);
  cbDone?.();
}

// Copia coords da primeira seta (para o AHK)
export async function copyFirstArrowToClipboard() {
  const a0 = arrows.find(Boolean);
  if (!a0) return false;

  const r = a0.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const baseX = (window.mozInnerScreenX !== undefined ? window.mozInnerScreenX : 0);
  const baseY = (window.mozInnerScreenY !== undefined ? window.mozInnerScreenY : 0);

  const sx = Math.round(baseX + (r.left + r.width / 2) * dpr);
  const sy = Math.round(baseY + (r.top  + r.height / 2) * dpr);
  const txt = `${sx},${sy}`;

  try {
    await navigator.clipboard.writeText(txt);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = txt; document.body.appendChild(ta);
    ta.select(); document.execCommand("copy"); ta.remove();
  }
  return true;
}

export { clearMarkers, clearBoxes };
