// content.js — lógica (scan, desenho, delay, storage, Mais/Menos)
(() => {
  if (window.__KBF_RUNNING__) return;
  window.__KBF_RUNNING__ = true;

  const storage = (globalThis.browser?.storage?.local || globalThis.chrome?.storage?.local);

  const state = {
    enabled: true,
    panelVisible: true,
    targetNumber: null,
    arrowGap: 230,
    deleteMode: false,
    lastCopiedForTarget: null,
    excluded: (globalThis.excluded instanceof Set) ? globalThis.excluded : new Set(),
    autoDelayMs: 300,
    // null = automático por largura; true/false = escolha explícita via botão
    advCollapsed: null,
  };
  globalThis.excluded = state.excluded;

  async function loadPersisted() {
    try {
      const res = await storage.get([
        "kbf_last_target","kbf_gap","kbf_ignored","kbf_panel_visible",
        "kbf_delay","kbf_advCollapsed"
      ]);
      state.targetNumber = (res.kbf_last_target || "").trim() || null;
      if (Number.isFinite(res.kbf_gap)) state.arrowGap = res.kbf_gap;
      if (Number.isFinite(res.kbf_delay)) state.autoDelayMs = res.kbf_delay;
      if (typeof res.kbf_panel_visible === "boolean") state.panelVisible = res.kbf_panel_visible;
      if (typeof res.kbf_advCollapsed === "boolean") state.advCollapsed = res.kbf_advCollapsed;

      if (Array.isArray(res.kbf_ignored)) {
        state.excluded.clear();
        for (const k of res.kbf_ignored) state.excluded.add(k);
      }
    } catch {}
  }
  async function persistIgnored(){ try{ await storage.set({ kbf_ignored: Array.from(state.excluded) }); }catch{} }
  const isIgnored = k => state.excluded.has(k);
  const addIgnored = k => state.excluded.add(k);

  const raf = fn => requestAnimationFrame(fn);
  const ric = window.requestIdleCallback || (fn => setTimeout(fn, 150));
  const NUM_RE = /^\s*(\d{1,2})\s*$/;

  function getVP(){
    const v = window.visualViewport;
    return v ? { x:v.offsetLeft, y:v.offsetTop, w:v.width, h:v.height }
             : { x:0, y:0, w:innerWidth, h:innerHeight };
  }
  const VIEW_PAD = 60;
  function inViewRect(r, pad = VIEW_PAD){
    const V = getVP();
    const L = V.x - pad, T = V.y - pad, R = V.x + V.w + pad, B = V.y + V.h + pad;
    return r.right > L && r.left < R && r.bottom > T && r.top < B;
  }
  const rectArea=r=>Math.max(1,r.width)*Math.max(1,r.height);
  const rectIoU=(a,b)=>{const x1=Math.max(a.left,b.left),y1=Math.max(a.top,b.top),x2=Math.min(a.right,b.right),y2=Math.min(a.bottom,b.bottom);const iw=Math.max(0,x2-x1),ih=Math.max(0,y2-y1);const inter=iw*ih,union=rectArea(a)+rectArea(b)-inter;return union?inter/union:0;};
  const near=(a,b)=>Math.hypot((a.left+a.width/2)-(b.left+b.width/2),(a.top+a.height/2)-(b.top+b.height/2))<8;
  const mobile = () => window.innerWidth <= 520 || matchMedia("(max-width:520px)").matches;

  // ---------- UI (vem do overlay.js) ----------
  let UI = null, rendered = [];
  const mountOverlay = () => window.kbfOverlay?.mountOverlay();

  // ---------- Escopo ----------
  let scopeEl=null, pickingScope=false;
  const getRoot=()=> scopeEl||document;
  function startScopePick(){
    if (pickingScope) return;
    pickingScope=true;
    document.body.classList.add("pick");
    const over=e=> (e.target.__kbfPrevOutline=e.target.style.outline, e.target.style.outline="2px solid #ffd400");
    const out =e=> (e.target.style.outline=e.target.__kbfPrevOutline||"", delete e.target.__kbfPrevOutline);
    function done(el){
      pickingScope=false; document.body.classList.remove("pick");
      document.removeEventListener("mouseover", over, true);
      document.removeEventListener("mouseout",  out,  true);
      document.removeEventListener("click", click, true);
      scopeEl = el || null; schedule();
    }
    function click(e){
      e.preventDefault(); e.stopPropagation();
      const el=e.target.closest('section, table, [role="rowgroup"], [data-market], .market, .selection, .panel, .table, .widget, div');
      done(el || e.target);
    }
    document.addEventListener("mouseover", over, true);
    document.addEventListener("mouseout",  out,  true);
    document.addEventListener("click", click, true);
  }
  function clearScope(){ scopeEl=null; schedule(); }

  // ---------- Detect (viewport) ----------
  const SELECTOR=["img","svg","div","span","[role='img']","[data-icon]","[class*='avatar']","[class*='shirt']","[class*='camisa']","[class*='player']"].join(",");
  function isIconish(r,loose=false){const ar=r.width/Math.max(1,r.height); if(loose)return r.height>=12&&r.height<=220&&r.width>=12&&r.width<=220&&ar>0.25&&ar<3.2; return r.height>=(mobile()?10:16)&&r.height<=180&&r.width>=(mobile()?10:16)&&r.width<=180&&ar>0.35&&ar<2.8;}
  function dedupeSort(list){const arr=[...list].sort((a,b)=>a.rect.top-b.rect.top||a.rect.left-b.rect.left);const keep=[];for(const c of arr){const clash=keep.find(k=>rectIoU(k.rect,c.rect)>0.55||near(k.rect,c.rect));if(!clash)keep.push(c);}return keep;}

  function collectIcons(root=getRoot()){
    const raw=[];
    root.querySelectorAll(SELECTOR).forEach(el=>{
      if (el.closest("#kbf-host")) return;
      const r=el.getBoundingClientRect();
      if (!inViewRect(r)) return;
      if (isIconish(r)) raw.push({el,rect:r});
    });
    let icons=dedupeSort(raw);
    if(icons.length<3){
      const alt=[];
      root.querySelectorAll(SELECTOR).forEach(el=>{
        if (el.closest("#kbf-host")) return;
        const r=el.getBoundingClientRect();
        if (!inViewRect(r)) return;
        if (isIconish(r,true)) alt.push({el,rect:r});
      });
      icons=dedupeSort(alt);
    }
    return icons;
  }

  function isClickable(el){ if(!el) return false; if(el.closest('button,a,[role="button"],[role="link"]')) return true; const cs=getComputedStyle(el); return cs.cursor==="pointer";}
  function isOddsish(el){ if(!el) return false; const s=((el.className||"")+" "+(el.getAttribute?.("data-*")||"")).toLowerCase(); if(/\bodd|odds|price|quota|quot|bet|market|selection|stake|parlay\b/.test(s)) return true; if(el.closest('[data-odds],[data-price],[data-selection],[class*="odd"],[class*="price"],[class*="quot"]')) return true; return false;}
  function badFont(el){ const fs=parseFloat(getComputedStyle(el).fontSize||"0")||0; return (fs<11||fs>36);}
  function hasDigitSiblings(el){ const pick=n=>(n?.textContent||"").trim(); const ps=pick(el.previousSibling)+pick(el.previousElementSibling); const ns=pick(el.nextSibling)+pick(el.nextElementSibling); return /[\d.]/.test(ps)||/[\d.]/.test(ns); }

  function collectNumbers(root=getRoot()){
    const found=[];
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
      acceptNode:n=>{
        const t=(n.textContent||"").trim();
        if (!(t.length<=3 && NUM_RE.test(t))) return NodeFilter.FILTER_REJECT;
        const el=n.parentElement; if(!el) return NodeFilter.FILTER_REJECT;
        const r=el.getBoundingClientRect();
        return inViewRect(r) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    let nd; while((nd=walker.nextNode())){
      const el=nd.parentElement; if (!el || el.closest("#kbf-host")) continue;
      if (isClickable(el)||isOddsish(el)||badFont(el)||hasDigitSiblings(el)) continue;
      const num=(nd.textContent||"").trim();
      found.push({el,num,rect:el.getBoundingClientRect(),source:"text"});
    }

    const attrQ="[data-number],[data-num],[aria-label],[title],img[alt]";
    root.querySelectorAll(attrQ).forEach(el=>{
      if (el.closest("#kbf-host")) return;
      const r=el.getBoundingClientRect();
      if (!inViewRect(r)) return;
      if (isClickable(el)||isOddsish(el)||badFont(el)) return;
      const cand=[el.getAttribute("data-number"),el.getAttribute("data-num"),el.getAttribute("aria-label"),el.getAttribute("title"),el.getAttribute("alt")].find(Boolean);
      if(!cand) return;
      const m=String(cand).match(/(?:^|\b)(\d{1,2})(?:\b|$)/);
      if(m) found.push({el,num:m[1],rect:r,source:"attr"});
    });

    const ranked=found.map(c=>({...c,area:rectArea(c.rect),prio:c.source==="text"?0:1})).sort((a,b)=>(a.prio-b.prio)||(a.area-b.area));
    const nums=[]; for(const c of ranked){const clash=nums.find(k=>rectIoU(k.rect,c.rect)>0.7||near(k.rect,c.rect)); if(!clash) nums.push(c);}
    return nums;
  }

  function getRowContainer(el){
    let cur=el;
    for(let i=0;i<6&&cur;i++,cur=cur.parentElement){
      const cs=cur&&getComputedStyle(cur); if(!cs) continue;
      const isRowFlex=cs.display==="flex"&&(cs.flexDirection==="row"||cs.flexDirection==="row-reverse");
      const isGrid=cs.display==="grid"&&String(cs.gridTemplateColumns||"").length>0;
      if(isRowFlex||isGrid) return cur;
    }
    return el.parentElement||el;
  }

  function extractNumFromEl(el){
    if(!el) return null;
    const t=(el.textContent||"").trim(); let m=t.length<=3?t.match(NUM_RE):null; if(m) return m[1];
    const ATTRS=["data-number","data-num","aria-label","title","alt"];
    for(const a of ATTRS){ const v=el.getAttribute?.(a); if(!v) continue; const mm=String(v).match(/(?:^|\b)(\d{1,2})(?:\b|$)/); if(mm) return mm[1]; }
    return null;
  }
  function vertOverlapRatio(a,b){ const top=Math.max(a.top,b.top), bot=Math.min(a.bottom,b.bottom); const inter=Math.max(0,bot-top); const h=Math.min(a.height,b.height)||1; return inter/h; }
  function filterByWindow(ir, list){ const minL=ir.left-20, maxL=ir.left+150; return list.filter(n=>{ const r=n.rect; if(r.left<minL||r.left>maxL) return false; return vertOverlapRatio(ir,r)>=0.5; }); }
  function pickByDistance(ir, list, isMob){
    if(!list||!list.length) return null;
    const cxI=ir.left+ir.width/2, cyI=ir.top+ir.height/2;
    const scored=list.map(n=>{
      const r=n.rect; const cxN=r.left+r.width/2, cyN=r.top+r.height/2;
      const ov=vertOverlapRatio(ir,r); const sameRow=ov>=(isMob?0.45:0.6);
      const dx=cxN-cxI, dy=cyN-cyI; const dist=Math.hypot(dx,dy);
      const leftPenalty=dx<-12?150:0; const leftBias=r.left*0.002;
      const score=(sameRow?0:100)+dist+leftPenalty+leftBias;
      return {n,score,sameRow,left:r.left};
    }).sort((a,b)=>(b.sameRow-b.sameRow)||(a.score-b.score)||(a.left-b.left));
    return scored[0]?.n||null;
  }
  function pairIconsAndNumbers(icons, nums){
    const out=[]; const isMob=mobile();
    for(const ic of icons){
      const ir=(ic.rect||ic.el.getBoundingClientRect());
      let num=extractNumFromEl(ic.el), nr=null;
      if(!num){
        const row=getRowContainer(ic.el);
        let cand=nums.filter(n=> row&&row.contains(n.el));
        cand=filterByWindow(ir,cand);
        if(!cand.length) cand=filterByWindow(ir,nums);
        const pick=pickByDistance(ir,cand,isMob);
        if(pick){ num=pick.num; nr=pick.rect; }
      }
      if(num) out.push({iconEl:ic.el,iconRect:ir,num,numRect:nr||ir});
    }
    return out;
  }

  // ---------- Desenho ----------
  const BADGE_W=28,BADGE_H=28,ARROW_W=26,ARROW_H=18,EDGE_PAD=2;

  function computeBadgePos(rect){
    const V=getVP(); const viewportLeft=V.x+EDGE_PAD, viewportRight=V.x+V.w-EDGE_PAD;
    const wantLeft=rect.left-BADGE_W-8; const leftOK=wantLeft>=viewportLeft;
    let left,side; if(leftOK){left=wantLeft;side="left";}else{left=rect.right+8;side="right";}
    left=Math.min(Math.max(left,viewportLeft),viewportRight-BADGE_W);
    const top=Math.round(rect.top+V.y+(rect.height-BADGE_H)/2); return {left:Math.round(left),top,side};
  }
  function computeArrowPos(iconRect){
    const V=getVP(); const viewportLeft=V.x+EDGE_PAD, viewportRight=V.x+V.w-EDGE_PAD;
    let left=iconRect.right+state.arrowGap;
    left=Math.min(Math.max(left,viewportLeft),viewportRight-ARROW_W);
    const top=Math.round(iconRect.top+V.y+(iconRect.height-ARROW_H)/2);
    return {left:Math.round(left),top};
  }
  function pairKey(p){ const r=p.iconEl.getBoundingClientRect(); return `${Math.round(r.left)}x${Math.round(r.top)}`; }

  function getFirstArrow(){ return rendered.find(Boolean)?.a || null; }
  async function copyFirstArrowToClipboard(){
    try{
      const a0=getFirstArrow(); if(!a0) return false;
      const r=a0.getBoundingClientRect(); const dpr=window.devicePixelRatio||1;
      const baseX=(window.mozInnerScreenX!==undefined?window.mozInnerScreenX:(window.screenX||0));
      const baseY=(window.mozInnerScreenY!==undefined?window.mozInnerScreenY:(window.screenY||0));
      const sx=Math.round(baseX+(r.left+r.width/2)*dpr), sy=Math.round(baseY+(r.top+r.height/2)*dpr);
      const txt=`${sx},${sy}`;
      try{ await navigator.clipboard.writeText(txt); }
      catch{ const ta=document.createElement("textarea"); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
      return true;
    }catch{ return false; }
  }

  function clearBoxes(){ rendered.forEach(it=>{ try{it.m?.remove();}catch{} try{it.a?.remove();}catch{} }); rendered=[]; }
  function drawBadges(pairs){
    clearBoxes();
    if(!state.enabled||!state.targetNumber||!UI) return;
    const t=String(state.targetNumber);

    pairs.forEach(p=>{
      if(String(p.num)!==t) return;
      const key=pairKey(p); if(isIgnored(key)) return;

      const ir=p.iconEl.getBoundingClientRect();
      const m=document.createElement("div"); m.className="marker"; m.textContent=p.num;
      const b=computeBadgePos(ir); m.style.left=b.left+"px"; m.style.top=b.top+"px"; m.dataset.side=b.side;
      m.addEventListener("click", async (e)=>{ if(!state.deleteMode) return; e.preventDefault(); e.stopPropagation(); addIgnored(key); await persistIgnored(); try{m.remove();}catch{} }, true);
      UI.layer.appendChild(m);

      const a=document.createElement("div"); a.className="arrow";
      const ap=computeArrowPos(ir); a.style.left=ap.left+"px"; a.style.top=ap.top+"px";
      UI.layer.appendChild(a);

      rendered.push({m,a,p});
    });

    if (rendered.length && state.targetNumber) {
      const wait = Math.max(5, Math.min(2000, Number(state.autoDelayMs) || 300));
      if (state.lastCopiedForTarget !== state.targetNumber) {
        setTimeout(async () => {
          const ok = await copyFirstArrowToClipboard();
          if (ok) state.lastCopiedForTarget = state.targetNumber;
        }, wait);
      }
    }
  }
  function repositionMarkers(pairs){
    if(!rendered.length) return;
    rendered.forEach(it=>{
      const ir=it.p.iconEl.getBoundingClientRect();
      const b=computeBadgePos(ir); it.m.style.left=b.left+"px"; it.m.style.top=b.top+"px"; it.m.dataset.side=b.side;
      const ap=computeArrowPos(ir); it.a.style.left=ap.left+"px"; it.a.style.top=ap.top+"px";
    });
  }
  function applyPanelVisibility(){
    if(!UI) return;
    UI.panel.style.display = state.panelVisible ? "flex" : "none";
    UI.fab.style.display   = state.panelVisible ? "none" : "block";
  }

  // ---------- Scheduler ----------
  let _sched = 0;
  const getCurrentDelay = () => Math.max(0, Math.min(2000, Math.round(Number(state.autoDelayMs) || 300)));
  function schedule() {
    clearTimeout(_sched);
    if (!state.enabled) return;
    const ms = getCurrentDelay();
    _sched = setTimeout(() => {
      if (!state.enabled) return;
      rescan(); draw();
      try { console.debug("[KBF] run (delay:", ms, "ms)"); } catch {}
    }, ms);
    try { console.debug("[KBF] schedule in", ms, "ms"); } catch {}
  }
  function scheduleImmediate(){
    clearTimeout(_sched);
    if (!state.enabled) return;
    rescan(); draw();
  }

  function wirePanel(scheduleImmediate){
    applyPanelVisibility();
    UI.btnHide?.addEventListener("click", ()=>{ state.panelVisible=false; storage.set({kbf_panel_visible:false}); applyPanelVisibility(); });
    UI.fab?.addEventListener("click",  ()=>{ state.panelVisible=true;  storage.set({kbf_panel_visible:true});  applyPanelVisibility(); });

    // trigger ao digitar
    let typingTimer=null;
    const trigger = (v) => {
      if(!/^\d{1,2}$/.test(v)) return;
      state.targetNumber=v; state.lastCopiedForTarget=null;
      storage.set({kbf_last_target:v});
      scheduleImmediate();
      UI.input.value=""; UI.input.focus({preventScroll:true});
    };
    UI.input.addEventListener("input", ()=>{
      if (typingTimer) clearTimeout(typingTimer);
      const delay = getCurrentDelay();
      typingTimer = setTimeout(()=> trigger((UI.input.value||"").trim()), delay);
    });
    UI.btnGo?.addEventListener("click", ()=> trigger((UI.input.value||"").trim()));
    UI.input.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); trigger((UI.input.value||"").trim()); }});

    UI.btnClear.addEventListener("click", ()=>{
      state.targetNumber=null; state.lastCopiedForTarget=null;
      storage.set({kbf_last_target:""});
      clearBoxes(); UI.input.value=""; UI.input.focus({preventScroll:true});
    });
    UI.btnRescan?.addEventListener("click", ()=> scheduleImmediate());

    UI.btnDelMode?.addEventListener("click", ()=>{
      state.deleteMode=!state.deleteMode;
      UI.btnDelMode.classList.toggle("toggled", state.deleteMode);
    });

    // gap
    const syncGap=()=> UI.gapInput && (UI.gapInput.value=String(state.arrowGap));
    syncGap();
    const onGapChange = ()=>{
      const val=Number(UI.gapInput.value); if(!Number.isFinite(val)) return;
      state.arrowGap=Math.max(60,Math.min(480,Math.round(val)));
      storage.set({kbf_gap:state.arrowGap});
      repositionMarkers(pairs);
    };
    UI.gapInput?.addEventListener("change", onGapChange);
    UI.gapDec?.addEventListener("click", ()=>{ state.arrowGap=Math.max(60,state.arrowGap-5); storage.set({kbf_gap:state.arrowGap}); syncGap(); repositionMarkers(pairs); });
    UI.gapInc?.addEventListener("click", ()=>{ state.arrowGap=Math.min(480,state.arrowGap+5); storage.set({kbf_gap:state.arrowGap}); syncGap(); repositionMarkers(pairs); });

    // delay
    const clampDelay = v => {
      const min = Number(UI.delayInput?.min)  || 80;
      const max = Number(UI.delayInput?.max)  || 1000;
      let n = Math.round(Number(v));
      if (!Number.isFinite(n)) n = state.autoDelayMs || 300;
      return Math.max(min, Math.min(max, n));
    };
    const syncDelay = () => { if (UI.delayInput) UI.delayInput.value = String(state.autoDelayMs); };
    const persistDelay = () => { try { storage.set({ kbf_delay: state.autoDelayMs }); } catch {} };
    syncDelay();

    UI.delayInput?.addEventListener("input", () => {
      state.autoDelayMs = clampDelay(UI.delayInput.value);
      syncDelay(); persistDelay(); schedule();
    });
    UI.delayInput?.addEventListener("change", () => {
      state.autoDelayMs = clampDelay(UI.delayInput.value);
      syncDelay(); persistDelay(); schedule();
    });
    UI.delayDec?.addEventListener("click", (e) => {
      e.preventDefault();
      const step = Number(UI.delayInput?.step) || 20;
      const cur  = clampDelay(UI.delayInput?.value ?? state.autoDelayMs);
      state.autoDelayMs = clampDelay(cur - step);
      syncDelay(); persistDelay(); schedule();
    });
    UI.delayInc?.addEventListener("click", (e) => {
      e.preventDefault();
      const step = Number(UI.delayInput?.step) || 20;
      const cur  = clampDelay(UI.delayInput?.value ?? state.autoDelayMs);
      state.autoDelayMs = clampDelay(cur + step);
      syncDelay(); persistDelay(); schedule();
    });
    UI.delayInput?.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const step = Number(UI.delayInput?.step) || 20;
      const cur  = clampDelay(UI.delayInput?.value ?? state.autoDelayMs);
      state.autoDelayMs = clampDelay(cur + (e.key === "ArrowUp" ? step : -step));
      syncDelay(); persistDelay(); schedule();
    });

    // escopo
    UI.btnScope?.addEventListener("click", ()=> startScopePick());
    UI.btnUnscope?.addEventListener("click", ()=> clearScope());

    // Mais / Menos — clique sempre vence
    UI.btnMore.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !getCollapsedDesired();
      state.advCollapsed = next;
      try { storage.set({ kbf_advCollapsed: next }); } catch {}
      renderCollapsed();
    });
  }

  // ---------- Pipeline / scroll ----------
  let icons=[], nums=[], pairs=[], tickerActive=false, lastScrollTs=0;

  function rescan(){ const root=getRoot(); icons=collectIcons(root); nums=collectNumbers(root); pairs=pairIconsAndNumbers(icons,nums); }
  function draw(){ drawBadges(pairs); }

  function onAnyScroll(){
    lastScrollTs=performance.now();
    if(!tickerActive){
      tickerActive=true;
      const tick=()=>{ repositionMarkers(pairs); if(performance.now()-lastScrollTs<120){ raf(tick);} else { tickerActive=false; } };
      raf(tick);
    }
  }
  window.addEventListener("scroll", onAnyScroll, {passive:true, capture:true});
  window.addEventListener("wheel",  onAnyScroll, {passive:true});
  window.addEventListener("touchmove", onAnyScroll, {passive:true});
  window.visualViewport && window.visualViewport.addEventListener("scroll", onAnyScroll, {passive:true});
  window.visualViewport && window.visualViewport.addEventListener("resize", onAnyScroll, {passive:true});
  window.addEventListener("resize", schedule, {passive:true});

  const mo=new MutationObserver(()=>{ ric(()=> schedule()); });
  mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true});

  // ---------- Alt+Shift+M ----------
  document.addEventListener("keydown",(e)=>{ if(e.altKey&&e.shiftKey&&e.key.toLowerCase()==="m"){ e.preventDefault(); (async()=>{ await copyFirstArrowToClipboard(); })(); } }, true);

  // ---------- Colapso/compacto ----------
  function getCollapsedDesired() {
    const auto = window.innerWidth < 560;
    return (state.advCollapsed === null) ? auto : !!state.advCollapsed;
  }
  function renderCollapsed() {
    const collapsed = getCollapsedDesired();
    UI.panel.classList.toggle('collapsed', collapsed);
    if (UI.btnMore) UI.btnMore.textContent = collapsed ? "Mais ▾" : "Menos ▴";
  }
  function fitPanel() {
    UI.panel.classList.toggle('compact', window.innerWidth < 560);
    renderCollapsed();
  }

  // ---------- Boot ----------
  (async()=>{
    try{
      await loadPersisted();
      UI = mountOverlay();
      window.__KBF_UI__ = UI;   // debug
      window.kbfState   = state;
      applyPanelVisibility();
      wirePanel(scheduleImmediate);
      fitPanel();
      window.addEventListener('resize', fitPanel, { passive:true });
      schedule();
    }catch(err){
      console.error("KBF erro (boot):", err);
      alert("KBF erro: " + err.message);
    }
  })();

})();
