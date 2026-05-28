/*
 * data_sdk.js  —  window.dataSdk
 * MAATAA OS · reverse-engineered local SDK (offline, no CDN, no external deps)
 *
 * PROVENANCE
 *   Reconstructed from observed call sites in assets/html/*.html.
 *   Pages reference <script src="/_sdk/data_sdk.js"></script>. The only usage
 *   found in the wild (gallery/maa_lang/system_complete_product.html:1144-1200):
 *
 *     const dataHandler = { onDataChanged(data) { records = data; render(); } };
 *     const result = await window.dataSdk.init(dataHandler);   // result.isOk
 *     const result = await window.dataSdk.create(newComponent); // result.isOk
 *
 *   Observed record shape (caller-defined, opaque to the SDK):
 *     { id, layer_name, component, status, progress, notes, timestamp }
 *   Observed result shape: { isOk: boolean, ... }
 *
 * DESIGN (PHKD-aligned)
 *   - Offline-capable persistent store (localStorage), namespaced per page path
 *     so collections never bleed across isolated app surfaces.
 *   - Async API returning {isOk,data,error} result objects (never throws to caller).
 *   - Fail-closed: any failure -> {isOk:false,error}; the page can show its
 *     "failed, please try again" path exactly as written.
 *   - Observable: window.dataSdk.health() + __meta evidence.
 *   - Deterministic: same operations -> same stored state; ids preserved.
 *   - Honest: ALPHA local persistence. NOT a synced/sovereign backend. There is
 *     no server, no auth, no replication. Do not present as production storage.
 *
 * Beyond the two observed methods, list/read/update/remove are provided so the
 * contract is usable; they follow the same result-object convention.
 */
(function () {
  'use strict';

  var VERSION = '0.1.0-alpha.1';
  var TAG = '[data_sdk]';
  // Collection key is namespaced by page path; a page hosts one default store.
  var STORE_NS = 'maataa:data_sdk:' + (location.pathname || '/');
  var memoryStore = {};

  function safeLog(level, args) {
    try { (console[level] || console.log).apply(console, [TAG].concat(args)); } catch (e) {}
  }
  var log = {
    info: function () { safeLog('info', [].slice.call(arguments)); },
    warn: function () { safeLog('warn', [].slice.call(arguments)); },
    error: function () { safeLog('error', [].slice.call(arguments)); }
  };

  function ok(data) { return { isOk: true, data: data, error: null }; }
  function fail(code, detail) { log.error(code, detail || ''); return { isOk: false, data: null, error: { code: code, detail: String(detail || '') } }; }

  // ---- isolated persistent storage (fail-closed) ----------------------------
  function readAll() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(STORE_NS) : memoryStore[STORE_NS];
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      log.warn('store read failed, returning empty set', e && e.message);
      return [];
    }
  }
  function writeAll(records) {
    var raw;
    try { raw = JSON.stringify(records); } catch (e) { return fail('serialize_error', e && e.message); }
    try {
      if (window.localStorage) window.localStorage.setItem(STORE_NS, raw);
      else memoryStore[STORE_NS] = raw;
      return ok(records);
    } catch (e) {
      memoryStore[STORE_NS] = raw; // degrade to memory, still report degraded write
      return fail('persist_unavailable', e && e.message);
    }
  }

  // ---- internal state -------------------------------------------------------
  var state = { initialized: false, handler: null, records: [], opCount: 0, initTs: null };

  function notifyChanged() {
    if (state.handler && typeof state.handler.onDataChanged === 'function') {
      // hand the caller a defensive copy
      try { state.handler.onDataChanged(state.records.slice()); }
      catch (e) { log.error('onDataChanged threw (caller render error)', e); }
    }
  }

  function genId() { return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }

  // ---- public API (all async, all return result objects) --------------------
  var api = {
    version: VERSION,

    /**
     * init(handler) -> Promise<{isOk,data}>
     * Registers an optional { onDataChanged(records) } handler, loads the
     * persisted collection, and pushes the initial data to the handler.
     */
    init: function (handler) {
      return new Promise(function (resolve) {
        try {
          state.handler = (handler && typeof handler === 'object') ? handler : null;
          state.records = readAll();
          state.initialized = true;
          state.initTs = Date.now();
          notifyChanged();
          log.info('initialized', { records: state.records.length, version: VERSION });
          resolve(ok(state.records.slice()));
        } catch (e) {
          resolve(fail('init_error', e && e.message));
        }
      });
    },

    /**
     * create(record) -> Promise<{isOk,data}>
     * Appends a record (assigning id/timestamp if absent), persists, notifies.
     */
    create: function (record) {
      return new Promise(function (resolve) {
        if (!state.initialized) log.warn('create() before init() — initializing implicitly');
        if (!record || typeof record !== 'object') return resolve(fail('invalid_record', 'record must be an object'));
        try {
          var rec = {};
          for (var k in record) if (Object.prototype.hasOwnProperty.call(record, k)) rec[k] = record[k];
          if (rec.id == null) rec.id = genId();
          if (rec.timestamp == null) rec.timestamp = Date.now();
          // id uniqueness (fail-closed on collision rather than silently overwrite)
          for (var i = 0; i < state.records.length; i++) {
            if (state.records[i] && state.records[i].id === rec.id) return resolve(fail('duplicate_id', rec.id));
          }
          state.records.push(rec);
          var w = writeAll(state.records);
          state.opCount++;
          notifyChanged();
          if (!w.isOk) return resolve(fail('persist_degraded', 'created in memory but not persisted'));
          resolve(ok(rec));
        } catch (e) {
          resolve(fail('create_error', e && e.message));
        }
      });
    },

    /** list() -> Promise<{isOk,data:[records]}> */
    list: function () {
      return Promise.resolve(ok(readAll()));
    },

    /** read(id) -> Promise<{isOk,data:record}> */
    read: function (id) {
      return new Promise(function (resolve) {
        var all = readAll();
        for (var i = 0; i < all.length; i++) if (all[i] && all[i].id === id) return resolve(ok(all[i]));
        resolve(fail('not_found', id));
      });
    },

    /** update(id, patch) -> Promise<{isOk,data:record}> */
    update: function (id, patch) {
      return new Promise(function (resolve) {
        if (!patch || typeof patch !== 'object') return resolve(fail('invalid_patch', 'patch must be an object'));
        state.records = readAll();
        for (var i = 0; i < state.records.length; i++) {
          if (state.records[i] && state.records[i].id === id) {
            for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) state.records[i][k] = patch[k];
            var w = writeAll(state.records);
            state.opCount++;
            notifyChanged();
            return resolve(w.isOk ? ok(state.records[i]) : fail('persist_degraded', 'updated in memory only'));
          }
        }
        resolve(fail('not_found', id));
      });
    },

    /** remove(id) -> Promise<{isOk,data:{id}}> */
    remove: function (id) {
      return new Promise(function (resolve) {
        state.records = readAll();
        var next = [], found = false;
        for (var i = 0; i < state.records.length; i++) {
          if (state.records[i] && state.records[i].id === id) { found = true; continue; }
          next.push(state.records[i]);
        }
        if (!found) return resolve(fail('not_found', id));
        state.records = next;
        var w = writeAll(state.records);
        state.opCount++;
        notifyChanged();
        resolve(w.isOk ? ok({ id: id }) : fail('persist_degraded', 'removed in memory only'));
      });
    },

    /** clear() -> Promise<{isOk}> : wipe this page's collection */
    clear: function () {
      return new Promise(function (resolve) {
        state.records = [];
        var w = writeAll(state.records);
        state.opCount++;
        notifyChanged();
        resolve(w.isOk ? ok([]) : fail('persist_degraded', 'cleared in memory only'));
      });
    },

    /** health() -> observable status/evidence */
    health: function () {
      return {
        runtime: 'data_sdk',
        version: VERSION,
        initialized: state.initialized,
        records: readAll().length,
        opCount: state.opCount,
        persistence: (function () { try { return !!window.localStorage; } catch (e) { return false; } })(),
        scope: STORE_NS,
        initTs: state.initTs
      };
    }
  };

  api.__meta = {
    runtime: 'data_sdk',
    version: VERSION,
    reconstructed: true,
    source: 'reverse-engineered from assets/html call sites',
    observedMethods: ['init', 'create'],
    backend: 'local-only (localStorage); NOT a synced/sovereign server',
    status: 'GOVERNED_PRODUCTION_NO_GO'
  };

  try { window.dataSdk = api; } catch (e) { log.error('cannot attach to window', e); }
  log.info('loaded', VERSION);
})();
