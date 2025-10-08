// app/main.js — usa seu overlay, lê delay do state e agenda corretamente

import "./prelude.js";
import { addGlobalStyle } from "./utils.js";
import state, { loadState, setEnabled, getDelayMs } from "./state.js";
import { collectNumbers } from "./detect.js";
import { mountOverlay, /* panelRoot (se precisar) */ } from "./overlay.js";
import "./pair.js";
import "./ui.js";
import "./delay-controls.js"; // <- mantém, se você estiver usando

// Destaques (mesmo do seu snapshot)
addGlobalStyle?.("kbf-highlight-style", `
.kbf-mark { background:#ffe066; color:#1b1b1b; border-radius:3px; padding:0 2px;
            box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); }
`);

let activeMarks = [];
function clearHighlights() {
  for (const span of activeMarks) {
    try {
      const p = span.parentNode; if (!p) continue;
      p.replaceChild(document.createTextNode(span.textContent || ""), span);
      p.normalize && p.normalize();
    } catch {}
  }
  activeMarks = [];
}
function highlightNumber(target) {
  clearHighlights();
  if (!state.enabled) return;
  const n = Number(target);
  if (!Number.isFinite(n)) return;

  const wanted = String(n);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const txt = node.nodeValue;
      if (!txt || !txt.trim()) return NodeFilter.FILTER_REJECT;
      const host = document.getElementById("kbf-host"); // seu host do shadow
      if (host && host.contains(node.parentElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let node;
  while ((node = walker.nextNode())) {
    try {
      const text = node.nodeValue;
      const nums = collectNumbers(text);
      if (!nums.includes(n)) continue;
      const parts = text.split(new RegExp(`(${wanted})`, "g"));
      if (parts.length <= 1) continue;

      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (part === wanted) {
          const span = document.createElement("span");
          span.className = "kbf-mark";
          span.textContent = part;
          activeMarks.push(span);
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      }
      node.parentNode.replaceChild(frag, node);
    } catch {}
  }
}

// ---------- Scheduler (lê delay central) ----------
let _t = 0;

export function schedule() {
  try { clearTimeout(_t); } catch {}
  if (!state.enabled) return;
  const ms = Math.max(0, Number(getDelayMs()));
  _t = setTimeout(runScan, ms);
  try { console.log(`[KBF] schedule in ${ms} ms`); } catch {}
}
export function scheduleImmediate() {
  try { clearTimeout(_t); } catch {}
  if (!state.enabled) return;
  runScan();
}
function runScan() {
  try { (window.kazuCore?.rescan ?? window.rescan)?.(); } catch {}
  try { (window.kazuCore?.draw  ?? window.draw )?.(); } catch {}
  try { console.log("[KBF] runScan"); } catch {}
}

Object.assign(window.kbf || (window.kbf = {}), { state, schedule, scheduleImmediate });

// Opcional: reagendar ao digitar
(function hookTyping(){
  const sel = 'input[type="text"], input[type="search"], textarea, [contenteditable="true"]';
  const attach = () => {
    try {
      document.querySelectorAll(sel).forEach(el => {
        el.removeEventListener("input", schedule);
        el.addEventListener("input", schedule);
      });
    } catch {}
  };
  attach();
  const mo = new MutationObserver(attach);
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

// ---------- Boot ----------
(async function boot() {
  await loadState();
  mountOverlay();      // seu overlay com o bloco Delay
  schedule();          // primeira passada
  console.log("[KBF] main.js LOADED (delay centralizado)");
})();
