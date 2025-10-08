// app/state.js
(function () {
  const { clamp } = window.kbf.utils;
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
    advCollapsed: null, // null = automático por largura; true/false = escolha do usuário
  };
  globalThis.excluded = state.excluded;

  const KEYS = [
    "kbf_last_target", "kbf_gap", "kbf_ignored",
    "kbf_panel_visible", "kbf_delay", "kbf_advCollapsed"
  ];

  async function load() {
    try {
      const res = await storage.get(KEYS);
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
    return state;
  }
  function save(obj) { try { storage.set(obj); } catch {} }

  function getDelayMs()     { return clamp(Math.round(Number(state.autoDelayMs) || 300), 80, 1000); }
  function setDelayMs(v)    { state.autoDelayMs = getDelayMs(v); save({ kbf_delay: state.autoDelayMs }); }
  function getGap()         { return state.arrowGap; }
  function setGap(v)        { state.arrowGap = clamp(Math.round(v) || 230, 60, 480); save({ kbf_gap: state.arrowGap }); }
  function setPanelVisible(b){ state.panelVisible = !!b; save({ kbf_panel_visible: state.panelVisible }); }
  function setAdvCollapsed(v){ state.advCollapsed = (v === null ? null : !!v); save({ kbf_advCollapsed: state.advCollapsed }); }
  function persistIgnored() { save({ kbf_ignored: Array.from(state.excluded) }); }

  window.kbf.state = {
    state, load, save,
    getDelayMs, setDelayMs,
    getGap, setGap,
    setPanelVisible, setAdvCollapsed,
    persistIgnored
  };
})();
