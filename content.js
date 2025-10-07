// content.js — consolidado: delay dinâmico + compat c/ teu painel + fallback seguro
(function () {
  "use strict";

  // ========== CONFIG ==========
  var STORAGE_KEY_DELAY   = "kbf_delay";
  var STORAGE_KEY_ENABLED = "kbf_enabled";
  var DEFAULT_DELAY       = 120;           // fallback inicial
  var FALLBACK_ATTR       = "data-kbf-fallback-overlay";

  // ========== UTILS ==========
  function clamp(n, lo, hi) {
    n = Number(n);
    if (!isFinite(n)) return lo;
    n = Math.round(n);
    return Math.min(hi, Math.max(lo, n));
  }

  // storage compat (browser/chrome/localStorage)
  var storage = {
    get: function (key, defVal) {
      return new Promise(function (resolve) {
        try {
          if (typeof browser !== "undefined" && browser.storage?.local) {
            browser.storage.local.get(key).then(function (o) {
              resolve((o && o[key] !== undefined) ? o[key] : defVal);
            }, function(){ resolve(defVal); });
            return;
          }
          if (typeof chrome !== "undefined" && chrome.storage?.local) {
            chrome.storage.local.get(key, function (o) {
              resolve((o && o[key] !== undefined) ? o[key] : defVal);
            });
            return;
          }
        } catch(_) {}
        try {
          var raw = localStorage.getItem(key);
          resolve(raw == null ? defVal : JSON.parse(raw));
        } catch(_) { resolve(defVal); }
      });
    },
    set: function (obj) {
      return new Promise(function (resolve) {
        try {
          if (typeof browser !== "undefined" && browser.storage?.local) {
            browser.storage.local.set(obj).then(function(){ resolve(); }, function(){ resolve(); });
            return;
          }
          if (typeof chrome !== "undefined" && chrome.storage?.local) {
            chrome.storage.local.set(obj, function(){ resolve(); });
            return;
          }
        } catch(_) {}
        try { for (var k in obj) localStorage.setItem(k, JSON.stringify(obj[k])); } catch(_){}
        resolve();
      });
    },
    onChanged: function (cb) {
      try {
        if (typeof browser !== "undefined" && browser.storage?.onChanged?.addListener) {
          browser.storage.onChanged.addListener(cb); return;
        }
        if (typeof chrome !== "undefined" && chrome.storage?.onChanged?.addListener) {
          chrome.storage.onChanged.addListener(cb); return;
        }
      } catch(_){}
    }
  };

  // ========== STATE ==========
  var state = {
    enabled: true,
    autoDelayMs: DEFAULT_DELAY
  };

  // ========== SCHEDULER (lê delay "ao vivo") ==========
  var _timer = 0;
  function clearPending(){ if (_timer) { clearTimeout(_timer); _timer = 0; } }

  function schedule() {
    clearPending();
    if (!state.enabled) return;
    var ms = Math.max(0, Number(state.autoDelayMs) || 0);
    _timer = setTimeout(run, ms);
  }

  function scheduleImmediate() {
    clearPending();
    if (!state.enabled) return;
    run();
  }

  function run() {
    // mantém tua lógica: chama rescan/draw se existirem
    try {
      if (window.kazuCore && typeof window.kazuCore.rescan === "function") window.kazuCore.rescan();
      else if (typeof window.rescan === "function") window.rescan();
    } catch(_) {}
    try {
      if (window.kazuCore && typeof window.kazuCore.draw === "function") window.kazuCore.draw();
      else if (typeof window.draw === "function") window.draw();
    } catch(_) {}
  }

  // ========== PAINEL (usa o teu; cria fallback só se faltar) ==========
  function findHost() {
    var host = document.getElementById("kbf-panel") ||
               document.querySelector("[data-kbf-panel], .kbf-panel");
    return host || null;
  }
  function panelRoot() {
    var host = findHost();
    return (host && (host.shadowRoot || host)) || document;
  }

  // cria overlay fallback (se o teu não existir)
  function ensureFallbackPanel() {
    if (findHost()) return null; // já existe teu painel

    var host = document.createElement("div");
    host.id = "kbf-panel";
    host.setAttribute(FALLBACK_ATTR, "1");
    host.style.position = "fixed";
    host.style.right = "16px";
    host.style.bottom = "16px";
    host.style.zIndex = "2147483647";

    var sh = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    sh.innerHTML = `
      <style>
        .card{font:13px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
              color:#e8eefc;background:#0b1220;border:1px solid #2b3754;border-radius:12px;
              padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
        .row{display:flex;align-items:center;gap:8px}
        .num{width:84px;background:#0e1629;color:#e8eefc;border:1px solid #2b3754;border-radius:10px;padding:6px 8px}
        .btn{border:1px solid #334266;background:#1f2a44;color:#e8eefc;border-radius:10px;padding:4px 8px;cursor:pointer}
        .btn:hover{filter:brightness(1.1)}
        .muted{opacity:.8;font-size:12px;margin-top:6px}
        .title{font-weight:600;margin-right:8px}
      </style>
      <div class="card">
        <div class="row">
          <span class="title">Delay</span>
          <button id="kbf-delay-dec" class="btn" type="button">−</button>
          <input id="kbf-delay" class="num" type="number" min="0" max="10000" step="50"/>
          <span>ms</span>
          <button id="kbf-delay-inc" class="btn" type="button">＋</button>
        </div>
        <div id="kbf-delay-label" class="muted"></div>
      </div>
    `;
    document.documentElement.appendChild(host);
    return host;
  }

  // se um painel "oficial" surgir, remove o fallback
  function maybeRemoveFallback() {
    var official = findHost();
    var fallback = document.querySelector('#kbf-panel[' + FALLBACK_ATTR + '="1"]');
    if (official && fallback && official !== fallback) {
      try { fallback.remove(); } catch(_) {}
    }
  }

  // ========= WIRING DOS CONTROLES =========
  var ui = { input:null, dec:null, inc:null, label:null, enabled:null };
  var wired = false;

  function queryControls() {
    var root = panelRoot();
    function q(sel){ try { return root.querySelector(sel); } catch(_) { return null; } }
    ui.input  = q("#kbf-delay");
    ui.dec    = q("#kbf-delay-dec");
    ui.inc    = q("#kbf-delay-inc");
    ui.label  = q("#kbf-delay-label");
    ui.enabled= q("#kbf-enabled"); // se existir no teu painel
    return !!(ui.input || ui.dec || ui.inc);
  }

  function syncDelayUI() {
    if (ui.input) ui.input.value = String(state.autoDelayMs);
    if (ui.label) ui.label.textContent = state.autoDelayMs + " ms";
  }

  function applyDelay(v) {
    v = clamp(v, 0, 10000);
    state.autoDelayMs = v;
    syncDelayUI();
    var obj = {}; obj[STORAGE_KEY_DELAY] = v;
    storage.set(obj);
    schedule();
  }

  function wireUI() {
    if (wired) return true;
    if (!queryControls()) return false;

    // inicial (nunca vazio)
    syncDelayUI();
    if (ui.enabled && "checked" in ui.enabled) ui.enabled.checked = !!state.enabled;

    ui.input?.addEventListener("input",  function (e) { applyDelay(e.target.value); });
    ui.input?.addEventListener("change", function (e) { applyDelay(e.target.value); });

    ui.dec?.addEventListener("click", function (e) {
      e.preventDefault();
      var step = Number(ui.input && ui.input.step) || 50;
      var cur  = Number(ui.input && ui.input.value) || state.autoDelayMs;
      applyDelay(cur - step);
    });
    ui.inc?.addEventListener("click", function (e) {
      e.preventDefault();
      var step = Number(ui.input && ui.input.step) || 50;
      var cur  = Number(ui.input && ui.input.value) || state.autoDelayMs;
      applyDelay(cur + step);
    });

    ui.enabled?.addEventListener("change", function () {
      state.enabled = !!ui.enabled.checked;
      if (state.enabled) scheduleImmediate(); else clearPending();
    });

    wired = true;
    return true;
  }

  // ========== INPUTS DA PÁGINA (reagenda ao digitar) ==========
  function hookTyping(root) {
    var sel = 'input[type="text"], input[type="search"], textarea, [contenteditable="true"]';
    try {
      Array.prototype.forEach.call(root.querySelectorAll(sel), function (el) {
        el.removeEventListener("input", schedule);
        el.addEventListener("input", schedule);
      });
    } catch(_) {}
  }

  // ========== BOOTSTRAP ==========
  (async function init() {
    // carrega persistidos
    var savedDelay   = await storage.get(STORAGE_KEY_DELAY, DEFAULT_DELAY);
    var savedEnabled = await storage.get(STORAGE_KEY_ENABLED, true);
    state.autoDelayMs = clamp(savedDelay, 0, 10000);
    state.enabled     = !!savedEnabled;

    // tenta usar teu painel; se não houver, cria fallback em ~350ms
    if (!wireUI()) {
      setTimeout(function () {
        if (!findHost()) ensureFallbackPanel();
        if (wireUI()) maybeRemoveFallback();
      }, 350);
    }

    // observa DOM: se teu painel surgir, removemos fallback e religamos
    var mo = new MutationObserver(function () {
      if (!wired) {
        if (wireUI()) maybeRemoveFallback();
      } else {
        maybeRemoveFallback();
      }
      hookTyping(document);
    });
    mo.observe(document.documentElement, { childList:true, subtree:true });

    // agenda inicial já com número
    schedule();

    // refletir mudanças externas (outra aba/options)
    storage.onChanged(function (changes, area) {
      try { if (area !== "local" && area !== "sync") return; } catch(_){}
      if (changes && changes[STORAGE_KEY_DELAY]) {
        state.autoDelayMs = clamp(changes[STORAGE_KEY_DELAY].newValue, 0, 10000);
        syncDelayUI();
      }
      if (changes && changes[STORAGE_KEY_ENABLED]) {
        state.enabled = !!changes[STORAGE_KEY_ENABLED].newValue;
        if (state.enabled) scheduleImmediate(); else clearPending();
      }
    });

    // helpers de debug (console do content script)
    try { window.kazu = { state: state, schedule: schedule, scheduleImmediate: scheduleImmediate }; } catch(_){}
  })();
})();
