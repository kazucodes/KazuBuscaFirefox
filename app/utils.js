
export const raf  = fn => requestAnimationFrame(fn);
export const ric  = window.requestIdleCallback || (fn=>setTimeout(fn, 200));
export const debounce = (fn,ms)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

export const mobile = () => window.innerWidth <= 520 || matchMedia("(max-width:520px)").matches;

export const vis = el => {
  const cs = getComputedStyle(el);
  if (cs.display==="none" || cs.visibility==="hidden" || +cs.opacity===0) return false;
  const r = el.getBoundingClientRect();
  return r.width>=6 && r.height>=6;
};

export const near = (a,b)=> Math.hypot(
  (a.left+a.width/2)-(b.left+b.width/2),
  (a.top+a.height/2)-(b.top+b.height/2)
) < 8;

export const rectArea = r => Math.max(1,r.width)*Math.max(1,r.height);

export function getTopSafeMargin(){
  const MIN=100, MAX=260, EXTRA=12;
  let maxBottom=0;
  document.querySelectorAll("body *").forEach(el=>{
    if (el.closest("#kbf-host")) return;
    const cs=getComputedStyle(el);
    const fixed = cs.position==="fixed"||cs.position==="sticky";
    if(!fixed || cs.visibility==="hidden" || cs.display==="none" || +cs.opacity===0) return;
    const r=el.getBoundingClientRect();
    if (r.top<=4 && r.bottom>0 && r.height>=28 && r.width>=120 && r.bottom>maxBottom) maxBottom=r.bottom;
  });
  return Math.max(MIN, Math.min(MAX, Math.ceil(maxBottom)+EXTRA));
}
