// content.js — carrega seus scripts de app/ e faz o wire do Delay no seu painel
(function () {
  "use strict";

  // ===== CONFIG =====
  var APP_FILES = ["app/state.js", "app/ui.js", "app/main.js"]; // ajuste se seus nomes forem outros
  var STORAGE_KEY_DELAY   = "kbf_delay";
  var STORAGE_KEY_ENABLED = "kbf_enabled";
  var DEFAULT_DELAY       = 120;

  // ===== UTILS =====
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

  // ===== STATE =====
  var state = (typeof window !== "undefined" && window.state) || {
    enabled: true,
    autoDelayMs: DEFAULT_DELAY
  };

  // ===== SCHEDULER (sem debounce fixo) =====
  var _timer = 0;

  function clearPending(){ if (_timer) { clearTimeout(_timer); _timer = 0; } }

  function schedule() {
    clearPending();
    if (!state.enabled) return;
    var ms = Math.max(0, Number(state.autoDelayMs ?? DEFAULT_DELAY) || 0);
    _timer = setTimeout(run, ms);
  }

  function scheduleImmediate() {
    clearPending();
    if (!state.enabled) return;
    run();
  }

  function run() {
    try {
      if (window.kazuCore && typeof window.kazuCore.rescan === "function") window.kazuCore.rescan();
      else if (typeof window.rescan === "function") window.rescan();
    } catch(_) {}
    try {
      if (window.kazuCore && typeof window.kazuCore.draw === "function") window.kazuCore.draw();
      else if (typeof window.draw === "function") window.draw();
    } catch(_) {}
  }

  // ===== INJEÇÃO DOS SEUS SCRIPTS app/* =====
  function injectScript(path) {
    return new Promise(function (resolve) {
      try {
        var url = (browser && browser.runtime && browser.runtime.getURL)
          ? browser.runtime.getURL(path)
          : (chrome && chrome.runtime && chrome.runtime.getURL)
            ? chrome.runtime.getURL(path)
            : path;
        var s = document.createElement("script");
        s.src = url;
        s.onload = function(){ resolve(true); };
        s.onerror = function(){ resolve(false); };
        (document.head || document.documentElement).appendChild(s);
      } catch(_) { resolve(false); }
    });
  }

  async function injectAppFilesSequentially(files) {
    for (var i = 0; i < files.length; i++) {
      var ok = await injectScript(files[i]);
      // mesmo se falhar, segue — mas registra no console da página
      if (!ok) { try { console.warn("[KBF] falhou ao injetar:", files[i]); } catch(_){} }
    }
  }

  // ===== WIRE DO SEU PAINEL =====
  var ui = { input:null, dec:null, inc:null, label:null, enabled:null };
  var wired = false;

  function getPanelRoot() {
    var host = document.getElementById("kbf-panel")
            || document.querySelector("[data-kbf-panel], .kbf-panel");
    return (host && (host.shadowRoot || host)) || document;
  }

  function queryControls() {
    var root = getPanelRoot();
    function q(sel){ try { return root.querySelector(sel); } catch(_) { return null; } }
    ui.input  = q("#kbf-delay");
    ui.dec    = q("#kbf-delay-dec");
    ui.inc    = q("#kbf-delay-inc");
    ui.label  = q("#kbf-delay-label");
    ui.enabled= q("#kbf-enabled");
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

    // input
    ui.input?.addEventListener("input",  function (e) { applyDelay(e.target.value); });
    ui.input?.addEventListener("change", function (e) { applyDelay(e.target.value); });

    // botões (respeita step do input; default 50)
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

    // toggle enabled (se seu painel tiver esse checkbox)
    ui.enabled?.addEventListener("change", function () {
      state.enabled = !!ui.enabled.checked;
      if (state.enabled) scheduleImmediate(); else clearPending();
    });

    wired = true;
    return true;
  }

  // reagendar ao digitar no site
  function hookTyping(root) {
    var sel = 'input[type="text"], input[type="search"], textarea, [contenteditable="true"]';
    try {
      Array.prototype.forEach.call(root.querySelectorAll(sel), function (el) {
        el.removeEventListener("input", schedule);
        el.addEventListener("input", schedule);
      });
    } catch(_) {}
  }

  // ===== BOOTSTRAP =====
  (async function init() {
    // 1) carregar estado salvo
    var savedDelay   = await storage.get(STORAGE_KEY_DELAY, DEFAULT_DELAY);
    var savedEnabled = await storage.get(STORAGE_KEY_ENABLED, true);
    state.autoDelayMs = clamp(savedDelay, 0, 10000);
    state.enabled     = !!savedEnabled;

    // 2) injetar seus arquivos de app/ (ordem importa se há dependências)
    await injectAppFilesSequentially(APP_FILES);

    // 3) tentar ligar imediatamente (se o painel já estiver montado)
    if (!wireUI()) {
      // 4) senão, observar o DOM até seu painel aparecer (sem criar overlay alternativo)
      var tries = 0, MAX_TRIES = 200; // ~20s com intervalo de 100ms
      var iv = setInterval(function () {
        tries++;
        if (wireUI() || tries >= MAX_TRIES) clearInterval(iv);
      }, 100);

      // também um MutationObserver para aparecer assim que montar
      var mo = new MutationObserver(function () {
        if (wireUI()) { try { mo.disconnect(); } catch(_){} }
      });
      mo.observe(document.documentElement, { childList:true, subtree:true });
    }

    // 5) agenda inicial
    schedule();

    // 6) reagenda quando inputs aparecem
    hookTyping(document);
    var mo2 = new MutationObserver(function () {
      if (!wired) wireUI();
      hookTyping(document);
    });
    mo2.observe(document.documentElement, { childList:true, subtree:true });

    // 7) refletir mudanças externas de storage
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

    // 8) helpers p/ console do content script
    try { window.kazu = { state: state, schedule: schedule, scheduleImmediate: scheduleImmediate }; } catch(_){}
  })();
})();
