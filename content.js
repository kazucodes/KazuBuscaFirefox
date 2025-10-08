// content.js
(() => {
  if (window.__KBF_RUNNING__) return;
  window.__KBF_RUNNING__ = true;

  const ST = window.kbf.state;
  const UIx = window.kbf.overlay;
  const DT  = window.kbf.detect;
  const { raf, ric } = window.kbf.utils;

  let UI = null;
  let rendered = [];
  let pairs = [];
  let tickerActive = false, lastScrollTs = 0;
  let _sched = 0;

  function getCollapsedDesired() {
    const auto = window.innerWidth < 560;
    return (ST.state.advCollapsed === null) ? auto : !!ST.state.advCollapsed;
  }
  function applyVisibility(){ UIx.applyPanelVisibility(UI, ST.state.panelVisible); }
  function fitPanel(){ UIx.fitPanel(UI); UIx.renderCollapsed(UI, getCollapsedDesired()); }

  function runOnce() {
    const root = (window.__KBF_SCOPE__ || document);
    const s = DT.scan(root);
    pairs = s.pairs;
    // <<< LIMPA TUDO ANTES DE DESENHAR
    DT.clearAll(UI);
    rendered = DT.draw(pairs, UI, ST.state);
    autoCopyIfNeeded();
  }

  function schedule() {
    clearTimeout(_sched);
    if (!ST.state.enabled) return;
    const ms = ST.getDelayMs();
    _sched = setTimeout(() => {
      if (!ST.state.enabled) return;
      runOnce();
      try { console.debug("[KBF] run (delay:", ms, "ms)"); } catch {}
    }, ms);
    try { console.debug("[KBF] schedule in", ms, "ms"); } catch {}
  }
  function scheduleImmediate() {
    clearTimeout(_sched);
    if (!ST.state.enabled) return;
    runOnce();
  }

  async function autoCopyIfNeeded() {
    if (!rendered.length || !ST.state.targetNumber) return;
    if (ST.state.lastCopiedForTarget === ST.state.targetNumber) return;
    const wait = ST.getDelayMs();
    setTimeout(async () => {
      const ok = await DT.copyFirstArrowToClipboard(rendered);
      if (ok) ST.state.lastCopiedForTarget = ST.state.targetNumber;
    }, wait);
  }

  function onAnyScroll(){
    lastScrollTs=performance.now();
    if(!tickerActive){
      tickerActive=true;
      const tick=()=>{ DT.reposition(rendered, ST.state); if(performance.now()-lastScrollTs<120){ raf(tick);} else { tickerActive=false; } };
      raf(tick);
    }
  }

  function wirePanel() {
    applyVisibility();

    UI.btnHide?.addEventListener("click", ()=>{ ST.setPanelVisible(false); applyVisibility(); });
    UI.fab?.addEventListener("click", ()=>{ ST.setPanelVisible(true); applyVisibility(); });

    // Mais/Menos
    UI.btnMore?.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      const next = !getCollapsedDesired();
      ST.setAdvCollapsed(next);
      UIx.renderCollapsed(UI, next);
    });

    // entrada nº com delay atual
    let typingTimer=null;
    const trigger = (v) => {
      if(!/^\d{1,2}$/.test(v)) return;
      ST.state.targetNumber=v; ST.state.lastCopiedForTarget=null;
      ST.save({ kbf_last_target:v });
      scheduleImmediate(); // já limpa e redesenha
      UI.input.value=""; UI.input.focus({preventScroll:true});
    };
    UI.input.addEventListener("input", ()=>{
      if (typingTimer) clearTimeout(typingTimer);
      const delay = ST.getDelayMs();
      typingTimer = setTimeout(()=> trigger((UI.input.value||"").trim()), delay);
    });
    UI.btnGo?.addEventListener("click", ()=> trigger((UI.input.value||"").trim()));
    UI.input.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); trigger((UI.input.value||"").trim()); }});

    // LIMPAR — zera tudo e limpa a camada inteira
    UI.btnClear?.addEventListener("click", ()=>{
      ST.state.targetNumber=null;
      ST.state.lastCopiedForTarget=null;
      ST.save({ kbf_last_target:"" });
      DT.clearAll(UI);             // limpa qualquer resíduo visual
      rendered = [];
      pairs = [];
      UI.input.value="";
      UI.input.focus({preventScroll:true});
    });

    // excluir toggle
    UI.btnDelMode?.addEventListener("click", ()=>{
      ST.state.deleteMode=!ST.state.deleteMode;
      UI.btnDelMode.classList.toggle("toggled", ST.state.deleteMode);
    });

    // escopo
    UI.btnScope?.addEventListener("click", ()=>{
      if (window.__KBF_PICKING__) return;
      window.__KBF_PICKING__ = true;
      document.body.classList.add("pick");
      const over=e=> (e.target.__kbfPrevOutline=e.target.style.outline, e.target.style.outline="2px solid #ffd400");
      const out =e=> (e.target.style.outline=e.target.__kbfPrevOutline||"", delete e.target.__kbfPrevOutline);
      function done(el){
        window.__KBF_PICKING__ = false; document.body.classList.remove("pick");
        document.removeEventListener("mouseover", over, true);
        document.removeEventListener("mouseout",  out,  true);
        document.removeEventListener("click", click, true);
        window.__KBF_SCOPE__ = el || null;
        scheduleImmediate();
      }
      function click(e){
        e.preventDefault(); e.stopPropagation();
        const el=e.target.closest('section, table, [role="rowgroup"], [data-market], .market, .selection, .panel, .table, .widget, div');
        done(el || e.target);
      }
      document.addEventListener("mouseover", over, true);
      document.addEventListener("mouseout",  out,  true);
      document.addEventListener("click", click, true);
    });
    UI.btnUnscope?.addEventListener("click", ()=>{ window.__KBF_SCOPE__=null; scheduleImmediate(); });

    // gap
    const syncGap=()=> UI.gapInput && (UI.gapInput.value=String(ST.state.arrowGap));
    syncGap();
    UI.gapInput?.addEventListener("change", ()=>{ const v=Number(UI.gapInput.value); if(!Number.isFinite(v)) return; ST.setGap(v); DT.reposition(rendered, ST.state); });
    UI.gapDec?.addEventListener("click", (e)=>{ e.preventDefault(); ST.setGap(ST.state.arrowGap-5); syncGap(); DT.reposition(rendered, ST.state); });
    UI.gapInc?.addEventListener("click", (e)=>{ e.preventDefault(); ST.setGap(ST.state.arrowGap+5); syncGap(); DT.reposition(rendered, ST.state); });

    // delay
    const clampDelay = v => {
      const min = Number(UI.delayInput?.min)  || 80;
      const max = Number(UI.delayInput?.max)  || 1000;
      let n = Math.round(Number(v));
      if (!Number.isFinite(n)) n = ST.state.autoDelayMs || 300;
      return Math.max(min, Math.min(max, n));
    };
    const syncDelay = () => { if (UI.delayInput) UI.delayInput.value = String(ST.state.autoDelayMs); };
    const persistAndResched = () => { ST.save({ kbf_delay: ST.state.autoDelayMs }); schedule(); };
    syncDelay();

    UI.delayInput?.addEventListener("input", ()=>{ ST.state.autoDelayMs = clampDelay(UI.delayInput.value); syncDelay(); persistAndResched(); });
    UI.delayInput?.addEventListener("change",()=>{ ST.state.autoDelayMs = clampDelay(UI.delayInput.value); syncDelay(); persistAndResched(); });
    UI.delayDec?.addEventListener("click",(e)=>{ e.preventDefault(); const step=Number(UI.delayInput?.step)||20; ST.state.autoDelayMs = clampDelay((UI.delayInput?.value||ST.state.autoDelayMs)-step); syncDelay(); persistAndResched(); });
    UI.delayInc?.addEventListener("click",(e)=>{ e.preventDefault(); const step=Number(UI.delayInput?.step)||20; ST.state.autoDelayMs = clampDelay((UI.delayInput?.value||ST.state.autoDelayMs)+step); syncDelay(); persistAndResched(); });
    UI.delayInput?.addEventListener("keydown",(e)=>{ if(e.key!=="ArrowUp"&&e.key!=="ArrowDown") return; e.preventDefault(); const step=Number(UI.delayInput?.step)||20; ST.state.autoDelayMs = clampDelay((UI.delayInput?.value||ST.state.autoDelayMs)+(e.key==="ArrowUp"?step:-step)); syncDelay(); persistAndResched(); });
  }

  document.addEventListener("keydown",(e)=>{ if(e.altKey&&e.shiftKey&&e.key.toLowerCase()==="m"){ e.preventDefault(); (async()=>{ await window.kbf.detect.copyFirstArrowToClipboard(rendered); })(); } }, true);

  window.addEventListener("scroll", onAnyScroll, {passive:true, capture:true});
  window.addEventListener("wheel",  onAnyScroll, {passive:true});
  window.addEventListener("touchmove", onAnyScroll, {passive:true});
  window.visualViewport && window.visualViewport.addEventListener("scroll", onAnyScroll, {passive:true});
  window.visualViewport && window.visualViewport.addEventListener("resize", onAnyScroll, {passive:true});
  window.addEventListener("resize", ()=>{ fitPanel(); schedule(); }, {passive:true});

  const mo=new MutationObserver(()=>{ ric(()=> schedule()); });
  mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true});

  (async()=>{
    await ST.load();
    UI = UIx.mountOverlay();
    window.__KBF_UI__ = UI;  // debug
    applyVisibility();
    wirePanel();
    fitPanel();
    schedule();
  })();
})();
