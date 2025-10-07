export const storage = (typeof browser!=="undefined" ? browser.storage.local : chrome.storage.local);

const excludedSet = (globalThis.excluded instanceof Set) ? globalThis.excluded : new Set();
globalThis.excluded = excludedSet;



export const state = {
  enabled: true,
  panelVisible: true,
  targetNumber: null,
  arrowGap: 230,
  autoDelayMs: 300,
  deleteMode: false,
  // coleções
  excluded: excludedSet,
};

export const isIgnored     = k => state.excluded.has(k);
export const addIgnored    = k => state.excluded.add(k);
export const removeIgnored = k => state.excluded.delete(k);
export const clearIgnored  = () => state.excluded.clear();

export async function loadPersisted(){
  try{
    const res = await storage.get(["kbf_last_target","kbf_gap","kbf_ignored","kbf_panel_visible"]);
    state.targetNumber = (res.kbf_last_target||"").trim() || null;
    if (Number.isFinite(res.kbf_gap)) state.arrowGap = res.kbf_gap;
    if (Array.isArray(res.kbf_ignored)) {
      state.excluded.clear();
      for (const k of res.kbf_ignored) state.excluded.add(k);
    }
    if (typeof res.kbf_panel_visible === "boolean") state.panelVisible = res.kbf_panel_visible;
  }catch{}
}

export async function persistIgnored(){
  try{ await storage.set({ kbf_ignored: Array.from(state.excluded) }); }catch{}
}
