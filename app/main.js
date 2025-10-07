// app/main.js
import { state, loadPersisted, setPanelVisible, setTargetNumber } from "./state.js";
import { debounce, raf, ric } from "./utils.js";
import { mountOverlay, applyPanelVisibility as _applyPanelVisibility } from "./overlay.js";
import { drawBadges, repositionMarkers, wirePanel, startScopePick, clearScope, copyFirstArrowToClipboard, clearMarkers } from "./ui.js";
import { collectIcons, collectNumbers } from "./detect.js";
import { pairIconsAndNumbers } from "./pair.js";

let UI = null;
let icons = [], nums = [], pairs = [];
let scanScheduled = false;
let tickerActive = false;
let lastScrollTs = 0;

function getRoot() {
  return state.scopeEl || document;
}

function rescan() {
  const root = getRoot();
  icons = collectIcons(root);
  nums  = collectNumbers(root);
  // pareia e filtra por escopo
  pairs = pairIconsAndNumbers(icons, nums);
  // (a exclusão por FP é aplicada no drawBadges)
}

function draw() {
  drawBadges(UI, pairs);
}

const schedule = debounce(() => {
  if (!state.enabled) return;
  rescan(); draw();
}, 120);

function scheduleImmediate() {
  if (!state.enabled) return;
  rescan(); draw();
}

// reposicionamento suave enquanto rola/zoom
function onAnyScroll() {
  lastScrollTs = performance.now();
  if (!tickerActive) {
    tickerActive = true;
    const tick = () => {
      repositionMarkers(UI, pairs);
      if (performance.now() - lastScrollTs < 200) { raf(tick); }
      else { tickerActive = false; }
    };
    raf(tick);
  }
}

function applyPanelVisibility() {
  _applyPanelVisibility(UI);
}

// marcar agora (fluxo principal)
async function markNow(raw) {
  const v = (raw || "").toString().trim();
  if (!/^\d{1,2}$/.test(v)) return;
  setTargetNumber(v);
  scheduleImmediate();
  // Atualiza o clipboard com a 1ª seta (para o AHK pegar e mover o mouse)
  setTimeout(() => { copyFirstArrowToClipboard(); }, 0);
  // prepara input para a próxima
  try { UI.input.value = ""; UI.input.focus({ preventScroll: true }); } catch {}
}

export async function start() {
  await loadPersisted();

  UI = mountOverlay();
  // hook interno para applyPanelVisibility via ui.js
  UI.panel.addEventListener("__kbf_apply_panel__", () => _applyPanelVisibility(UI));
  applyPanelVisibility();

  wirePanel(UI, {
    onMarkNow: markNow,
    onRescan: schedule,
    onToggleScope: () => startScopePick(() => { scheduleImmediate(); }),
    onClearScope:  () => { clearScope(() => scheduleImmediate()); }
  });

  // listeners globais
  window.addEventListener("scroll", onAnyScroll, { passive: true, capture: true });
  document.addEventListener("scroll", onAnyScroll, { passive: true, capture: true });
  (document.scrollingElement || document.documentElement).addEventListener("scroll", onAnyScroll, { passive: true, capture: true });
  window.addEventListener("wheel", onAnyScroll, { passive: true });
  window.addEventListener("touchmove", onAnyScroll, { passive: true });
  window.visualViewport && window.visualViewport.addEventListener("scroll", onAnyScroll, { passive: true });
  window.visualViewport && window.visualViewport.addEventListener("resize", onAnyScroll, { passive: true });

  window.addEventListener("resize", schedule, { passive: true });

  const mo = new MutationObserver(() => {
    if (scanScheduled) return;
    scanScheduled = true;
    ric(() => { scanScheduled = false; schedule(); });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

  // Atalho Alt+Shift+M -> copiar coords da 1ª seta
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.shiftKey && (e.key.toLowerCase() === "m")) {
      e.preventDefault();
      copyFirstArrowToClipboard();
    }
  }, true);

  // primeira varredura
  scheduleImmediate();
}
