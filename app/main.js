import { state, loadPersisted } from "./state.js";
import { ric, debounce } from "./utils.js";
import { mountOverlay } from "./overlay.js";
import { wirePanel, drawBadges, clearBoxes, repositionMarkers, updateCounter } from "./ui.js";
import { collectIcons, collectNumbers } from "./detect.js";
import { pairIconsAndNumbers } from "./pair.js";

let icons=[], nums=[], pairs=[];
let scanScheduled=false, tickerActive=false, lastScrollTs=0, stopped=false;

function rescan(){
  const root = document;
  icons = collectIcons(root);
  nums  = collectNumbers(root);
  pairs = pairIconsAndNumbers(icons, nums);
  updateCounter({icons, nums, pairs});
}
function draw(){ drawBadges({pairs}); }
const schedule = debounce(()=>{ if(stopped||!state.enabled) return; rescan(); draw(); }, 120);

function onAnyScroll(){
  lastScrollTs=performance.now();
  if(!tickerActive){
    tickerActive=true;
    const tick=()=>{
      repositionMarkers({pairs});
      if(performance.now()-lastScrollTs<150){ requestAnimationFrame(tick); } else { tickerActive=false; }
    };
    requestAnimationFrame(tick);
  }
}

export async function start(registerStop){
  stopped=false;

  // listeners (uma vez)
  window.addEventListener("scroll", onAnyScroll, {passive:true, capture:true});
  window.addEventListener("wheel",  onAnyScroll, {passive:true});
  window.addEventListener("touchmove", onAnyScroll, {passive:true});
  window.visualViewport && window.visualViewport.addEventListener("scroll", onAnyScroll, {passive:true});
  window.visualViewport && window.visualViewport.addEventListener("resize", onAnyScroll, {passive:true});
  window.addEventListener("resize", schedule, {passive:true});

  const mo = new MutationObserver(()=>{ if(scanScheduled) return; scanScheduled=true; ric(()=>{scanScheduled=false; schedule();}); });
  mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true});

  await loadPersisted();
  const ui = mountOverlay();              // desenha painel/host
  wirePanel({ui, state, schedule, pairs, icons, nums}); // conecta botões

  // Primeira varredura
  rescan(); draw();

  // watchdog: se não achar nada, relaxa reprocessando
  setInterval(()=>{ if(stopped || !state.enabled) return;
    if (icons.length===0 || pairs.length===0) { rescan(); draw(); }
  }, 1200);

  // debug helper
  window.KBF = {
    ping(){ console.log("KBF:", {icons:icons.length, nums:nums.length, pairs:pairs.length, target:state.targetNumber}); },
  };

  registerStop && registerStop(()=>{ stopped=true; mo.disconnect(); clearBoxes(); });
}

export function stop(){ /* preenchido via registerStop no content.js */ }
