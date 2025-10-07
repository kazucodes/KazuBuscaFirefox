import { vis, rectArea, near, mobile } from "./utils.js";

const NUM_RE = /^\s*(\d{1,2})\s*$/;

// --- helpers locais ao arquivo ---
function isClickable(el) {
  if (!el) return false;
  if (el.closest('button,a,[role="button"],[role="link"]')) return true;
  const cs = getComputedStyle(el);
  return cs.cursor === 'pointer';
}
function isOddsish(el) {
  if (!el) return false;
  // classes/atributos comuns em colunas de odds/quotas
  const s = ((el.className || '') + ' ' + (el.getAttribute?.('data-*') || '')).toLowerCase();
  if (s.match(/\bodd|odds|price|quota|quot|bet|market|selection|stake|parlay\b/)) return true;
  if (el.closest('[data-odds],[data-price],[data-selection],[class*="odd"],[class*="price"],[class*="quot"]')) return true;
  return false;
}
function badFont(el) {
  const fs = parseFloat(getComputedStyle(el).fontSize || '0') || 0;
  return (fs < 11 || fs > 36);
}
function hasDigitSiblings(el) {
  const pick = (n) => (n?.textContent || '').trim();
  const ps = pick(el.previousSibling) + pick(el.previousElementSibling);
  const ns = pick(el.nextSibling) + pick(el.nextElementSibling);
  // se ao lado houver dígito ou ponto, provavelmente é parte de cotação “9 . 5 0”
  return /[\d.]/.test(ps) || /[\d.]/.test(ns);
}

export function collectNumbers(root = getRoot()) {
  const found = [];

  // 1) TEXTOS curtos (1–2 dígitos)
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: n => {
        const t = (n.textContent || '').trim();
        return (t.length <= 3 && /^\d{1,2}$/.test(t))
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    }
  );
  let nd;
  while ((nd = walker.nextNode())) {
    const el = nd.parentElement;
    if (!el || el.closest('#kbf-host')) continue;
    if (!vis(el)) continue;
    if (isClickable(el) || isOddsish(el) || badFont(el) || hasDigitSiblings(el)) continue;

    const num = (nd.textContent || '').trim();
    found.push({ el, num, rect: el.getBoundingClientRect(), source: 'text' });
  }

  // 2) ATRIBUTOS curtos
  const attrQ = '[data-number],[data-num],[aria-label],[title],img[alt]';
  root.querySelectorAll(attrQ).forEach(el => {
    if (el.closest('#kbf-host')) return;
    if (!vis(el)) return;
    if (isClickable(el) || isOddsish(el) || badFont(el)) return;

    const cand = [el.getAttribute('data-number'), el.getAttribute('data-num'),
                  el.getAttribute('aria-label'), el.getAttribute('title'),
                  el.getAttribute('alt')]
                .find(Boolean);
    if (!cand) return;
    const m = String(cand).match(/(?:^|\b)(\d{1,2})(?:\b|$)/);
    if (m) {
      found.push({ el, num: m[1], rect: el.getBoundingClientRect(), source: 'attr' });
    }
  });

  // 3) DEDUPE + ranking (mesma lógica que você já usava)
  const ranked = found
    .map(c => ({ ...c, area: rectArea(c.rect), prio: c.source === 'text' ? 0 : 1 }))
    .sort((a, b) => (a.prio - b.prio) || (a.area - b.area));

  const nums = [];
  for (const c of ranked) {
    const clash = nums.find(k => rectIoU(k.rect, c.rect) > 0.7 || near(k.rect, c.rect));
    if (!clash) nums.push(c);
  }
  return nums;
}


const SELECTOR = [
  "img","svg","div","span","[role='img']","[data-icon]",
  "[class*='avatar']","[class*='shirt']","[class*='camisa']","[class*='player']"
].join(",");

const ATTRS = ["data-number","data-num","aria-label","title","alt"];

function isIconish(r, loose=false){
  const ar=r.width/Math.max(1,r.height);
  if (loose)  return r.height>=12&&r.height<=220&&r.width>=12&&r.width<=220&&ar>0.25&&ar<3.2;
  return r.height>= (mobile()? 10:16) && r.height<=180 && r.width>= (mobile()? 10:16) && r.width<=180 && ar>0.35 && ar<2.8;
}

function dedupeSort(list){
  const arr=[...list].sort((a,b)=>a.rect.top-b.rect.top||a.rect.left-b.rect.left);
  const keep=[];
  for(const c of arr){
    const clash=keep.find(k=> IoU(k.rect,c.rect)>0.55 || near(k.rect,c.rect));
    if(!clash) keep.push(c);
  }
  return keep;
}
const IoU=(a,b)=>{
  const x1=Math.max(a.left,b.left), y1=Math.max(a.top,b.top);
  const x2=Math.min(a.right,b.right), y2=Math.min(a.bottom,b.bottom);
  const iw=Math.max(0,x2-x1), ih=Math.max(0,y2-y1);
  const inter=iw*ih, union=rectArea(a)+rectArea(b)-inter;
  return union? inter/union : 0;
};

function getNumFromAttrs(el){
  for(const a of ATTRS){
    const v=el.getAttribute && el.getAttribute(a);
    if(!v) continue;
    if (v.length<=4){ const m=v.trim().match(NUM_RE); if(m) return m[1]; }
    else { const m=v.match(/(?:^|\b)(\d{1,2})(?:\b|$)/); if(m) return m[1]; }
  }
  return null;
}

export function collectIcons(root=document){
  const raw=[];
  root.querySelectorAll(SELECTOR).forEach(el=>{
    if (el.closest("#kbf-host")) return;
    if (!vis(el)) return;
    const r=el.getBoundingClientRect();
    if (isIconish(r)) raw.push({el,rect:r});
  });
  let icons = dedupeSort(raw);

  // Fallback: muito pouco? relaxa as restrições e tenta de novo
  if (icons.length < 3) {
    const alt=[];
    root.querySelectorAll(SELECTOR).forEach(el=>{
      if (el.closest("#kbf-host")||!vis(el)) return;
      const r=el.getBoundingClientRect();
      if (isIconish(r,true)) alt.push({el,rect:r});
    });
    icons = dedupeSort(alt);
  }
  return icons;
}

export function collectNumbers(root=document){
  const out=[];

  // texto curto
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
    acceptNode(n){ const t=(n.textContent||"").trim(); return (t.length<=3&&NUM_RE.test(t))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT; }
  });
  let nd;
  while((nd=walker.nextNode())){
    const el=nd.parentElement;
    if(!el || el.closest("#kbf-host") || !vis(el)) continue;
    const num = (nd.textContent||"").trim().match(NUM_RE)[1];
    out.push({el,num,rect:el.getBoundingClientRect(), source:"text"});
  }

  // atributos
  const attrQ="[data-number],[data-num],[aria-label],[title],img[alt]";
  root.querySelectorAll(attrQ).forEach(el=>{
    if(el.closest("#kbf-host")||!vis(el))return;
    const num=getNumFromAttrs(el); if(num) out.push({el,num,rect:el.getBoundingClientRect(),source:"attr"});
  });

  // elementos curtos
  const shortQ="span,b,strong,em,small,i,button,a,div,p,li";
  root.querySelectorAll(shortQ).forEach(el=>{
    if(el.closest("#kbf-host")||!vis(el))return;
    const t=(el.textContent||"").trim(); if(t&&t.length<=3&&NUM_RE.test(t)){
      const num=t.match(NUM_RE)[1];
      out.push({el,num,rect:el.getBoundingClientRect(),source:"text"});
    }
  });

  // dedupe por área/overlap
  const ranked = out.map(c=>({...c, area:rectArea(c.rect), prio:c.source==="text"?0:1}))
                    .sort((a,b)=>(a.prio-b.prio)||(a.area-b.area));
  const kept=[];
  for(const c of ranked){
    const clash=kept.find(k=> IoU(k.rect,c.rect)>0.7 || near(k.rect,c.rect) );
    if(!clash) kept.push(c);
  }
  return kept;
}
