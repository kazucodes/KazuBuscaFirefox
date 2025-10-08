// app/detect.js
(function () {
  const { inViewRect, getVP } = window.kbf.utils;
  const SELECTOR = ["img","svg","div","span","[role='img']","[data-icon]","[class*='avatar']","[class*='shirt']","[class*='camisa']","[class*='player']"].join(",");

  const BADGE_W=28,BADGE_H=28,ARROW_W=26,ARROW_H=18,EDGE_PAD=2;

  const rectArea=r=>Math.max(1,r.width)*Math.max(1,r.height);
  const rectIoU=(a,b)=>{const x1=Math.max(a.left,b.left),y1=Math.max(a.top,b.top),x2=Math.min(a.right,b.right),y2=Math.min(a.bottom,b.bottom);const iw=Math.max(0,x2-x1),ih=Math.max(0,y2-y1);const inter=iw*ih,union=rectArea(a)+rectArea(b)-inter;return union?inter/union:0;};
  const near=(a,b)=>Math.hypot((a.left+a.width/2)-(b.left+b.width/2),(a.top+a.height/2)-(b.top+b.height/2))<8;

  function mobile(){ return window.innerWidth <= 520 || matchMedia("(max-width:520px)").matches; }
  function isIconish(r,loose=false){ const ar=r.width/Math.max(1,r.height); if(loose) return r.height>=12&&r.height<=220&&r.width>=12&&r.width<=220&&ar>0.25&&ar<3.2; return r.height>=(mobile()?10:16)&&r.height<=180&&r.width>=(mobile()?10:16)&&r.width<=180&&ar>0.35&&ar<2.8; }
  function dedupeSort(list){ const arr=[...list].sort((a,b)=>a.rect.top-b.rect.top||a.rect.left-b.rect.left); const keep=[]; for(const c of arr){ const clash=keep.find(k=>rectIoU(k.rect,c.rect)>0.55||near(k.rect,c.rect)); if(!clash)keep.push(c);} return keep; }

  function collectIcons(root=document){
    const raw=[];
    root.querySelectorAll(SELECTOR).forEach(el=>{
      if(el.closest("#kbf-host")) return;
      const r=el.getBoundingClientRect();
      if(!inViewRect(r)) return;
      if(isIconish(r)) raw.push({el,rect:r});
    });
    let icons=dedupeSort(raw);
    if(icons.length<3){
      const alt=[];
      root.querySelectorAll(SELECTOR).forEach(el=>{
        if(el.closest("#kbf-host")) return;
        const r=el.getBoundingClientRect();
        if(!inViewRect(r)) return;
        if(isIconish(r,true)) alt.push({el,rect:r});
      });
      icons=dedupeSort(alt);
    }
    return icons;
  }

  const NUM_RE = /^\s*(\d{1,2})\s*$/;
  function isClickable(el){ if(!el) return false; if(el.closest('button,a,[role="button"],[role="link"]')) return true; const cs=getComputedStyle(el); return cs.cursor==="pointer"; }
  function isOddsish(el){ if(!el) return false; const s=((el.className||"")+" "+(el.getAttribute?.("data-*")||"")).toLowerCase(); if(/\bodd|odds|price|quota|quot|bet|market|selection|stake|parlay\b/.test(s)) return true; if(el.closest('[data-odds],[data-price],[data-selection],[class*="odd"],[class*="price"],[class*="quot"]')) return true; return false; }
  function badFont(el){ const fs=parseFloat(getComputedStyle(el).fontSize||"0")||0; return (fs<11||fs>36); }
  function hasDigitSiblings(el){ const pick=n=>(n?.textContent||"").trim(); const ps=pick(el.previousSibling)+pick(el.previousElementSibling); const ns=pick(el.nextSibling)+pick(el.nextElementSibling); return /[\d.]/.test(ps)||/[\d.]/.test(ns); }

  function collectNumbers(root=document){
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
      const r=el.getBoundingClientRect(); if(!inViewRect(r)) return;
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
      const rowFlex = cs.display==="flex" && (cs.flexDirection==="row"||cs.flexDirection==="row-reverse");
      const grid    = cs.display==="grid" && String(cs.gridTemplateColumns||"").length>0;
      if(rowFlex || grid) return cur;
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
      const sameRow=vertOverlapRatio(ir,r) >= (isMob?0.45:0.6);
      const dx=cxN-cxI, dy=cyN-cyI; const dist=Math.hypot(dx,dy);
      const leftPenalty=dx<-12?150:0; const leftBias=r.left*0.002;
      return { n, score:(sameRow?0:100)+dist+leftPenalty+leftBias, sameRow, left:r.left };
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

  function computeBadgePos(rect){
    const V=getVP(); const viewportLeft=V.x+EDGE_PAD, viewportRight=V.x+V.w-EDGE_PAD;
    const wantLeft=rect.left-BADGE_W-8; const leftOK=wantLeft>=viewportLeft;
    let left,side; if(leftOK){left=wantLeft;side="left";}else{left=rect.right+8;side="right";}
    left=Math.min(Math.max(left,viewportLeft),viewportRight-BADGE_W);
    const top=Math.round(rect.top+V.y+(rect.height-BADGE_H)/2); return {left:Math.round(left),top,side};
  }
  function computeArrowPos(iconRect, gap){
    const V=getVP(); const viewportLeft=V.x+EDGE_PAD, viewportRight=V.x+V.w-EDGE_PAD;
    let left=iconRect.right+gap;
    left=Math.min(Math.max(left,viewportLeft),viewportRight-ARROW_W);
    const top=Math.round(iconRect.top+V.y+(iconRect.height-ARROW_H)/2);
    return {left:Math.round(left),top};
  }

  function scan(root) {
    const icons = collectIcons(root);
    const nums  = collectNumbers(root);
    const pairs = pairIconsAndNumbers(icons, nums);
    return { icons, nums, pairs };
  }

  function draw(pairs, ui, st) {
    const rendered = [];
    if (!st.enabled || !st.targetNumber || !ui) return rendered;
    const t = String(st.targetNumber);

    pairs.forEach(p=>{
      if (String(p.num) !== t) return;
      const key = `${Math.round(p.iconRect.left)}x${Math.round(p.iconRect.top)}`;
      if (st.excluded.has(key)) return;

      const ir = p.iconEl.getBoundingClientRect();
      const m=document.createElement("div"); m.className="marker"; m.textContent=p.num;
      const b=computeBadgePos(ir); m.style.left=b.left+"px"; m.style.top=b.top+"px"; m.dataset.side=b.side;
      m.addEventListener("click", async (e)=>{ if(!st.deleteMode) return; e.preventDefault(); e.stopPropagation(); st.excluded.add(key); window.kbf.state.persistIgnored(); try{m.remove();}catch{} }, true);
      ui.layer.appendChild(m);

      const a=document.createElement("div"); a.className="arrow";
      const ap=computeArrowPos(ir, st.arrowGap); a.style.left=ap.left+"px"; a.style.top=ap.top+"px";
      ui.layer.appendChild(a);

      rendered.push({m,a,p});
    });
    return rendered;
  }

  function reposition(rendered, st){
    rendered.forEach(it=>{
      const ir=it.p.iconEl.getBoundingClientRect();
      const b=computeBadgePos(ir); it.m.style.left=b.left+"px"; it.m.style.top=b.top+"px"; it.m.dataset.side=b.side;
      const ap=computeArrowPos(ir, st.arrowGap); it.a.style.left=ap.left+"px"; it.a.style.top=ap.top+"px";
    });
  }

  function clear(rendered){
    rendered.forEach(it=>{ try{it.m?.remove();}catch{} try{it.a?.remove();}catch{} });
    rendered.length=0;
  }

  // >>> novo: limpa toda a camada (caso existam marcadores de execuções anteriores)
  function clearAll(ui){
    if (!ui) return;
    try { ui.layer.querySelectorAll('.marker, .arrow, .kill').forEach(el => el.remove()); } catch {}
  }

  async function copyFirstArrowToClipboard(rendered){
    try{
      const a0 = rendered.find(Boolean)?.a; if(!a0) return false;
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

  window.kbf.detect = { scan, draw, reposition, clear, clearAll, copyFirstArrowToClipboard };
})();
