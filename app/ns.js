// app/ns.js
(function () {
  if (window.kbf) return;           // singleton
  const kbf = {};

  const raf = (fn) => requestAnimationFrame(fn);
  const ric = window.requestIdleCallback || ((fn) => setTimeout(fn, 150));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function getVP() {
    const v = window.visualViewport;
    return v
      ? { x: v.offsetLeft, y: v.offsetTop, w: v.width, h: v.height }
      : { x: 0, y: 0, w: innerWidth, h: innerHeight };
  }

  function inViewRect(r, pad = 60) {
    const V = getVP();
    const L = V.x - pad, T = V.y - pad, R = V.x + V.w + pad, B = V.y + V.h + pad;
    return r.right > L && r.left < R && r.bottom > T && r.top < B;
  }

  kbf.utils = { raf, ric, clamp, getVP, inViewRect };
  window.kbf = kbf;
})();
