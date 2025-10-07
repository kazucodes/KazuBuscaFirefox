// app/pair.js
// Pareamento ícone ↔ número com filtros rígidos (janela horizontal + overlap vertical)

import { mobile } from "./utils.js";
import { getRowContainer } from "./detect.js";

// --- helpers locais ---------------------------------------------------------

// Extrai nº (1–2 dígitos) do próprio elemento (texto ou atributos comuns)
const ATTRS = ["data-number", "data-num", "aria-label", "title", "alt"];
function extractNumFromEl(el) {
  if (!el) return null;

  const t = (el.textContent || "").trim();
  let m = t.length <= 3 ? t.match(/^\s*(\d{1,2})\s*$/) : null;
  if (m) return m[1];

  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (!v) continue;
    const mm = String(v).match(/(?:^|\b)(\d{1,2})(?:\b|$)/);
    if (mm) return mm[1];
  }
  return null;
}

// razão de sobreposição vertical (0–1) baseada na menor altura
function vertOverlapRatio(a, b) {
  const top = Math.max(a.top, b.top);
  const bot = Math.min(a.bottom, b.bottom);
  const inter = Math.max(0, bot - top);
  const h = Math.min(a.height, b.height) || 1;
  return inter / h;
}

// filtra candidatos que estão numa “janela” à direita do ícone
// left ∈ [icon.left - 20, icon.left + 150] e overlap vertical ≥ 50%
function filterByWindow(ir, list) {
  const minL = ir.left - 20;
  const maxL = ir.left + 150;
  return list.filter((n) => {
    const r = n.rect;
    if (r.left < minL || r.left > maxL) return false;
    return vertOverlapRatio(ir, r) >= 0.5;
  });
}

// pontuação final: prioriza mesma linha, depois distância pequena,
// penaliza muito quem está à esquerda do ícone e desempata pelo mais à esquerda
function pickByDistance(ir, list, isMob) {
  if (!list || !list.length) return null;

  const cxI = ir.left + ir.width / 2;
  const cyI = ir.top + ir.height / 2;

  const scored = list
    .map((n) => {
      const r = n.rect;
      const cxN = r.left + r.width / 2;
      const cyN = r.top + r.height / 2;

      const ov = vertOverlapRatio(ir, r);
      const sameRow = ov >= (isMob ? 0.45 : 0.6);

      const dx = cxN - cxI;
      const dy = cyN - cyI;
      const dist = Math.hypot(dx, dy);

      const leftPenalty = dx < -12 ? 150 : 0; // muito à esquerda do ícone

      // leve viés para “mais à esquerda” (em odds, números ficam à direita)
      const leftBias = r.left * 0.002;

      const score = (sameRow ? 0 : 100) + dist + leftPenalty + leftBias;
      return { n, score, sameRow, left: r.left };
    })
    .sort(
      (a, b) =>
        (b.sameRow - a.sameRow) || // mesma linha primeiro
        (a.score - b.score) || // menor score
        (a.left - b.left) // mais à esquerda
    );

  return scored[0]?.n || null;
}

// --- API principal ----------------------------------------------------------

/**
 * Pareia cada ícone com o número mais provável na linha.
 * @param {Array<{el:Element, rect:DOMRect}>} icons
 * @param {Array<{el:Element, num:string, rect:DOMRect}>} nums
 * @returns {Array<{iconEl:Element, iconRect:DOMRect, num:string, numRect:DOMRect}>}
 */
export function pairIconsAndNumbers(icons, nums) {
  const out = [];
  const isMob = mobile();

  for (const ic of icons) {
    const ir = ic.rect || ic.el.getBoundingClientRect();

    // 1) tenta extrair nº do próprio ícone (casos em que o nº está dentro do SVG/IMG)
    let num = extractNumFromEl(ic.el);
    let nr = null;

    // 2) se não achou, usa candidatos da mesma linha (container) filtrados pela janela
    if (!num) {
      const row = getRowContainer(ic.el);
      let candidates = nums.filter((n) => row && row.contains(n.el));
      candidates = filterByWindow(ir, candidates);

      // fallback: se ainda vazio, usa todos os números mas filtrados pela janela
      if (!candidates.length) {
        candidates = filterByWindow(ir, nums);
      }

      const pick = pickByDistance(ir, candidates, isMob);
      if (pick) {
        num = pick.num;
        nr = pick.rect;
      }
    }

    if (num) {
      out.push({ iconEl: ic.el, iconRect: ir, num, numRect: nr || ir });
    }
  }

  return out;
}