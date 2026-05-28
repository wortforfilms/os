/*
 * element_sdk.js  —  window.elementSdk
 * MAATAA OS · reverse-engineered local SDK (offline, no CDN, no external deps)
 *
 * PROVENANCE
 *   Reconstructed from observed call sites in assets/html/*.html (34 pages).
 *   Pages reference <script src="/_sdk/element_sdk.js"></script> and only ever
 *   call two methods:  window.elementSdk.init(spec)  and  .setConfig(patch).
 *   The init `spec` shape observed in the wild (e.g. usp.html:834):
 *     {
 *       defaultConfig,                 // object of theme + content tokens
 *       onConfigChange(config),        // page re-renders itself from config
 *       mapToCapabilities(config) -> { recolorables:[{get,set}], borderables:[],
 *                                      fontEditable:{get,set}, fontSizeable:{get,set} },
 *       mapToEditPanelValues(config) -> Map<string,string>   // editable text fields
 *     }
 *
 * DESIGN (PHKD-aligned)
 *   - Offline-capable: zero network, zero CDN.
 *   - Deterministic: pure config in -> DOM render out via the page's callback.
 *   - Fail-closed: never throws into caller; returns {isOk:false,error} and logs.
 *   - Isolated: persistence namespaced per page path (no cross-page bleed).
 *   - Observable: exposes window.elementSdk.health() and __meta evidence.
 *   - Honest: this is an ALPHA reconstruction, not the original vendor SDK.
 *
 * This file is intentionally a faithful *contract* reimplementation, not a
 * cleanroom copy of any proprietary builder. It satisfies the calls the pages
 * make and adds an optional postMessage editor bridge so the config can be
 * driven by host editor chrome if one is present.
 */
(function () {
  'use strict';

  var VERSION = '0.1.0-alpha.1';
  var TAG = '[element_sdk]';
  var STORAGE_NS = 'maataa:element_sdk:' + (location.pathname || '/');
  var BRIDGE_SOURCE = 'maataa-element-editor';

  function safeLog(level, args) {
    try { (console[level] || console.log).apply(console, [TAG].concat(args)); } catch (e) {}
  }
  var log = {
    info: function () { safeLog('info', [].slice.call(arguments)); },
    warn: function () { safeLog('warn', [].slice.call(arguments)); },
    error: function () { safeLog('error', [].slice.call(arguments)); }
  };

  // ---- isolated persistence (fail-closed; degrades to in-memory) ------------
  var memoryStore = {};
  function loadPersisted() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(STORAGE_NS) : memoryStore[STORAGE_NS];
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      log.warn('persistence read unavailable, using defaults', e && e.message);
      return null;
    }
  }
  function persist(config) {
    var raw;
    try { raw = JSON.stringify(config); } catch (e) { log.error('config not serializable', e); return false; }
    try {
      if (window.localStorage) window.localStorage.setItem(STORAGE_NS, raw);
      else memoryStore[STORAGE_NS] = raw;
      return true;
    } catch (e) {
      memoryStore[STORAGE_NS] = raw; // degrade, do not fail the caller
      log.warn('localStorage unavailable, persisted to memory only');
      return false;
    }
  }

  // ---- internal state -------------------------------------------------------
  var state = {
    initialized: false,
    spec: null,
    config: {},
    capabilities: null,
    changeCount: 0,
    initTs: null
  };

  function rebuildCapabilities() {
    if (state.spec && typeof state.spec.mapToCapabilities === 'function') {
      try { state.capabilities = state.spec.mapToCapabilities(state.config); }
      catch (e) { log.error('mapToCapabilities threw', e); state.capabilities = null; }
    }
  }

  function emitConfigChange() {
    state.changeCount++;
    if (state.spec && typeof state.spec.onConfigChange === 'function') {
      try { state.spec.onConfigChange(shallowCopy(state.config)); }
      catch (e) { log.error('onConfigChange threw (page render error)', e); }
    }
    broadcast('configChanged', { config: shallowCopy(state.config) });
  }

  function shallowCopy(o) { var c = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k]; return c; }

  // ---- optional host-editor bridge (postMessage) ----------------------------
  // If the page is embedded in builder chrome, the parent can drive config and
  // read editable capabilities. Safe no-op when standalone.
  var bridgeBound = false;
  function broadcast(type, payload) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: BRIDGE_SOURCE, type: type, payload: payload, version: VERSION }, '*');
      }
    } catch (e) {}
  }
  function bindEditorBridge() {
    if (bridgeBound) return;
    bridgeBound = true;
    try {
      window.addEventListener('message', function (ev) {
        var msg = ev && ev.data;
        if (!msg || msg.target !== BRIDGE_SOURCE || !msg.type) return;
        switch (msg.type) {
          case 'setConfig':
            api.setConfig(msg.payload || {});
            break;
          case 'getState':
            broadcast('state', { config: shallowCopy(state.config), editPanel: serializeEditPanel(), health: api.health() });
            break;
          case 'getEditPanel':
            broadcast('editPanel', serializeEditPanel());
            break;
          case 'invokeCapability':
            invokeCapability(msg.payload);
            break;
          default:
            log.warn('unknown bridge message', msg.type);
        }
      }, false);
    } catch (e) { log.warn('editor bridge unavailable', e && e.message); }
  }
  function serializeEditPanel() {
    var out = {};
    var m = api.getEditPanelValues();
    try { m.forEach(function (v, k) { out[k] = v; }); } catch (e) {}
    return out;
  }
  function invokeCapability(p) {
    if (!p || !state.capabilities) return;
    try {
      if (p.group === 'fontEditable' && state.capabilities.fontEditable) state.capabilities.fontEditable.set(p.value);
      else if (p.group === 'fontSizeable' && state.capabilities.fontSizeable) state.capabilities.fontSizeable.set(p.value);
      else if (p.group === 'recolorables' && state.capabilities.recolorables && state.capabilities.recolorables[p.index]) state.capabilities.recolorables[p.index].set(p.value);
      else if (p.group === 'borderables' && state.capabilities.borderables && state.capabilities.borderables[p.index]) state.capabilities.borderables[p.index].set(p.value);
    } catch (e) { log.error('invokeCapability failed', e); }
  }

  // ---- public API -----------------------------------------------------------
  var api = {
    version: VERSION,

    /**
     * init(spec) -> {isOk}
     * Stores the spec, merges defaultConfig with any persisted overrides,
     * builds the capability map, and performs the first render via onConfigChange.
     */
    init: function (spec) {
      if (!spec || typeof spec !== 'object') {
        log.error('init requires a spec object'); return { isOk: false, error: 'invalid_spec' };
      }
      state.spec = spec;
      var def = (spec.defaultConfig && typeof spec.defaultConfig === 'object') ? spec.defaultConfig : {};
      var persisted = loadPersisted() || {};
      state.config = {};
      var k;
      for (k in def) if (Object.prototype.hasOwnProperty.call(def, k)) state.config[k] = def[k];
      for (k in persisted) if (Object.prototype.hasOwnProperty.call(persisted, k)) state.config[k] = persisted[k];
      rebuildCapabilities();
      state.initialized = true;
      state.initTs = Date.now();
      emitConfigChange();        // initial deterministic render
      bindEditorBridge();
      log.info('initialized', { configKeys: Object.keys(state.config).length, restored: Object.keys(persisted).length, version: VERSION });
      return { isOk: true };
    },

    /**
     * setConfig(patch) -> {isOk, config}
     * Merges patch into config, persists, refreshes capabilities, re-renders.
     */
    setConfig: function (patch) {
      if (!state.initialized) log.warn('setConfig() called before init() — applying anyway');
      if (!patch || typeof patch !== 'object') return { isOk: false, error: 'invalid_patch' };
      for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) state.config[k] = patch[k];
      persist(state.config);
      rebuildCapabilities();
      emitConfigChange();
      return { isOk: true, config: shallowCopy(state.config) };
    },

    /** getConfig() -> snapshot copy */
    getConfig: function () { return shallowCopy(state.config); },

    /** resetConfig() -> {isOk} : drop persisted overrides, return to defaults */
    resetConfig: function () {
      var def = (state.spec && state.spec.defaultConfig) || {};
      state.config = shallowCopy(def);
      persist(state.config);
      rebuildCapabilities();
      emitConfigChange();
      return { isOk: true, config: shallowCopy(state.config) };
    },

    /** getCapabilities() -> last capability map (recolorables/borderables/fonts) */
    getCapabilities: function () { return state.capabilities; },

    /** getEditPanelValues() -> Map<string,string> (empty Map if none) */
    getEditPanelValues: function () {
      if (state.spec && typeof state.spec.mapToEditPanelValues === 'function') {
        try { return state.spec.mapToEditPanelValues(state.config); }
        catch (e) { log.error('mapToEditPanelValues threw', e); }
      }
      return new Map();
    },

    /** health() -> observable status/evidence for this runtime */
    health: function () {
      return {
        runtime: 'element_sdk',
        version: VERSION,
        initialized: state.initialized,
        configKeys: Object.keys(state.config).length,
        changeCount: state.changeCount,
        capabilities: state.capabilities ? {
          recolorables: (state.capabilities.recolorables || []).length,
          borderables: (state.capabilities.borderables || []).length,
          fontEditable: !!state.capabilities.fontEditable,
          fontSizeable: !!state.capabilities.fontSizeable
        } : null,
        persistence: (function () { try { return !!window.localStorage; } catch (e) { return false; } })(),
        initTs: state.initTs
      };
    }
  };

  api.__meta = {
    runtime: 'element_sdk',
    version: VERSION,
    reconstructed: true,
    source: 'reverse-engineered from assets/html call sites',
    observedMethods: ['init', 'setConfig'],
    status: 'GOVERNED_PRODUCTION_NO_GO'
  };

  // publish
  try { window.elementSdk = api; } catch (e) { log.error('cannot attach to window', e); }
  log.info('loaded', VERSION);
})();
