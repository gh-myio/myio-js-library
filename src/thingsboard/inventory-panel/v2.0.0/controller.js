/* global self, window, document */
/* inventory-panel v2.0.0 — Device Inventory (RFC-0237, ED-1324)
 *
 * Thin ThingsBoard widget over the pure logic in MyIOLibrary.inventory
 * (src/utils/devices/inventory): rules, filters, visible rows, export matrix.
 *
 * - All state lives inside createInventoryApp() — one closure per widget instance,
 *   no module-level mutable state and no window.* handlers (multi-instance safe).
 * - Events are delegated on the root via data-action attributes.
 * - Styles are injected inside the widget container, scoped by .ipv2-root.
 * - onDestroy clears every timer/listener and drops in-flight responses
 *   (generation token).
 */

var IPV2_DEFAULTS = {
  title: 'Inventário de Dispositivos',
  pageSize: 1000,
  refreshInterval: 0,
  staleHours: 24,
  disabledRules: ['C6'],
  integrationOverrides: {},
  defaultGroupBy: 'customer',
  defaultSort: 'gravity',
  enableNavigation: true,
  xlsxScriptUrl: '', // empty = pinned SheetJS from cdnjs (IPV2_XLSX_JS)
  debug: false,
};

var IPV2_RENDER_BATCH = 200;
var IPV2_SEARCH_DEBOUNCE_MS = 150;
var IPV2_COLLAPSE_GROUPS_ABOVE = 50;

var IPV2_CSS = [
  '.ipv2-root{--ip-accent:#3e1a7d;--ip-accent-soft:#f1ecfb;--ip-bg:#f8fafc;--ip-panel:#ffffff;--ip-text:#1e293b;--ip-muted:#64748b;--ip-border:#e2e8f0;',
  '--ip-ok:#16a34a;--ip-pending:#d97706;--ip-critical:#dc2626;--ip-unknown:#94a3b8;',
  'font-family:Nunito,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ip-text);background:var(--ip-bg);height:100%;display:flex;flex-direction:column;overflow:hidden;font-size:13px}',
  '.ipv2-root *{box-sizing:border-box}',
  '.ipv2-header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--ip-accent);color:#fff}',
  '.ipv2-title{font-size:16px;font-weight:700;flex:1;margin:0}',
  '.ipv2-btn{border:1px solid var(--ip-border);background:var(--ip-panel);color:var(--ip-text);border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer}',
  '.ipv2-btn:hover{border-color:var(--ip-accent)}',
  '.ipv2-btn[disabled]{opacity:.5;cursor:not-allowed}',
  '.ipv2-header .ipv2-btn{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.3)}',
  '.ipv2-export{position:relative}',
  '.ipv2-export-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:30;min-width:230px;background:var(--ip-panel);border:1px solid var(--ip-border);border-radius:10px;box-shadow:0 12px 30px rgba(15,23,42,.18);padding:6px 0}',
  '.ipv2-export-menu[hidden]{display:none}',
  '.ipv2-export-menu button{display:flex;flex-direction:column;align-items:flex-start;width:100%;border:none;background:transparent;font:inherit;color:var(--ip-text);text-align:left;padding:7px 14px;cursor:pointer}',
  '.ipv2-export-menu button:hover{background:var(--ip-accent-soft)}',
  '.ipv2-export-menu button[disabled]{opacity:.5;cursor:progress}',
  '.ipv2-export-menu small{color:var(--ip-muted);font-size:11px}',
  '.ipv2-kpis{display:flex;flex-wrap:wrap;align-items:center;gap:6px 0;padding:10px 16px;background:var(--ip-panel);border-bottom:1px solid var(--ip-border)}',
  '.ipv2-kpi-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}',
  '.ipv2-kpi-row + .ipv2-kpi-row{margin-left:16px;padding-left:16px;border-left:1px solid var(--ip-border)}',
  '.ipv2-kpi-label{display:inline-flex;align-items:center;gap:4px;font-weight:700;color:var(--ip-muted);margin-right:2px}',
  '.ipv2-help{width:16px;height:16px;border-radius:50%;border:1px solid var(--ip-border);background:var(--ip-panel);color:var(--ip-muted);font:700 10px/1 inherit;padding:0;cursor:help;display:inline-flex;align-items:center;justify-content:center}',
  '.ipv2-help:hover,.ipv2-help:focus-visible{border-color:var(--ip-accent);color:var(--ip-accent);outline:none}',
  '.ipv2-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--ip-border);background:var(--ip-panel);border-radius:999px;padding:3px 10px;font:inherit;cursor:pointer;color:var(--ip-text)}',
  '.ipv2-chip[aria-pressed="true"]{background:var(--ip-accent-soft);border-color:var(--ip-accent);font-weight:700}',
  '.ipv2-chip[disabled]{opacity:.45;cursor:default}',
  '.ipv2-dot{width:8px;height:8px;border-radius:50%;display:inline-block;background:var(--ip-unknown)}',
  '.ipv2-dot.ok{background:var(--ip-ok)}.ipv2-dot.pending{background:var(--ip-pending)}.ipv2-dot.critical,.ipv2-dot.inactive{background:var(--ip-critical)}',
  '.ipv2-lifecycle{color:var(--ip-muted);font-size:12px;flex-basis:100%}',
  '.ipv2-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 16px;background:var(--ip-panel);border-bottom:1px solid var(--ip-border)}',
  '.ipv2-search{flex:1;min-width:220px;border:1px solid var(--ip-border);border-radius:8px;padding:7px 10px;font:inherit}',
  '.ipv2-select{border:1px solid var(--ip-border);border-radius:8px;padding:6px 8px;font:inherit;background:var(--ip-panel)}',
  '.ipv2-active{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:0 16px 8px;background:var(--ip-panel)}',
  '.ipv2-active:empty{display:none}',
  '.ipv2-status{padding:6px 16px;color:var(--ip-muted);font-size:12px;border-bottom:1px solid var(--ip-border);display:flex;justify-content:space-between;gap:8px}',
  '.ipv2-banner{margin:8px 16px 0;padding:8px 12px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}',
  '.ipv2-banner:empty{display:none}',
  '.ipv2-list{flex:1;overflow:auto;padding:8px 16px 16px}',
  '.ipv2-group{margin-top:8px}',
  '.ipv2-group-head{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:none;background:transparent;font:inherit;font-weight:700;cursor:pointer;text-align:left;color:var(--ip-text)}',
  '.ipv2-group-head:hover{background:var(--ip-accent-soft);border-radius:6px}',
  '.ipv2-group-count{color:var(--ip-muted);font-weight:600}',
  '.ipv2-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px;border:1px solid var(--ip-border);border-radius:10px;background:var(--ip-panel);margin-top:6px;cursor:pointer}',
  '.ipv2-row:hover{border-color:var(--ip-accent)}',
  '.ipv2-row img{width:28px;height:28px;object-fit:contain}',
  '.ipv2-name{display:flex;align-items:center;gap:6px;min-width:0}',
  '.ipv2-primary{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.ipv2-secondary{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.ipv2-copy{border:none;background:transparent;color:#94a3b8;cursor:pointer;padding:2px 4px;border-radius:4px;font:inherit}',
  '.ipv2-copy:hover{color:var(--ip-accent);background:var(--ip-accent-soft)}',
  '.ipv2-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:3px;align-items:center}',
  '.ipv2-pill{border-radius:999px;padding:1px 8px;font-size:11px;background:#eef2ff;color:#3730a3}',
  '.ipv2-pill.unclassified{background:#f1f5f9;color:#64748b}',
  '.ipv2-reason{border-radius:4px;padding:1px 6px;font-size:11px;background:#fef2f2;color:#991b1b}',
  '.ipv2-hint{border-radius:4px;padding:1px 6px;font-size:11px;background:#f1f5f9;color:#475569}',
  '.ipv2-badges{display:flex;flex-direction:column;align-items:flex-end;gap:3px;white-space:nowrap}',
  '.ipv2-badge{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700}',
  '.ipv2-badge small{font-weight:400;color:var(--ip-muted)}',
  '.ipv2-more{display:block;margin:12px auto}',
  '.ipv2-state{padding:40px 16px;text-align:center;color:var(--ip-muted)}',
  '.ipv2-state strong{display:block;color:var(--ip-text);font-size:15px;margin-bottom:6px}',
  '.ipv2-progress{height:6px;background:var(--ip-border);border-radius:3px;overflow:hidden;max-width:360px;margin:12px auto 0}',
  '.ipv2-progress span{display:block;height:100%;background:var(--ip-accent);transition:width .2s}',
  '.ipv2-tabs{display:flex;gap:4px;padding:0 16px;background:var(--ip-panel);border-bottom:1px solid var(--ip-border)}',
  '.ipv2-tab{border:none;background:transparent;font:inherit;font-weight:700;color:var(--ip-muted);padding:10px 14px;cursor:pointer;border-bottom:3px solid transparent}',
  '.ipv2-tab[aria-selected="true"]{color:var(--ip-accent);border-bottom-color:var(--ip-accent)}',
  '.ipv2-dims{display:flex;flex-wrap:wrap;gap:6px}',
  '.ipv2-dim-btn[data-active="true"]{border-color:var(--ip-accent);background:var(--ip-accent-soft);font-weight:700}',
  '.ipv2-toolbar{position:relative}',
  '.ipv2-pop{position:absolute;z-index:20;top:100%;left:16px;min-width:280px;max-width:420px;max-height:360px;display:flex;flex-direction:column;background:var(--ip-panel);border:1px solid var(--ip-border);border-radius:10px;box-shadow:0 12px 30px rgba(15,23,42,.18)}',
  '.ipv2-pop[hidden]{display:none}',
  '.ipv2-pop-head{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--ip-border);font-weight:700}',
  '.ipv2-pop-search{margin:8px 12px 0;border:1px solid var(--ip-border);border-radius:6px;padding:6px 8px;font:inherit}',
  '.ipv2-pop-list{overflow:auto;padding:6px 0}',
  '.ipv2-opt{display:flex;align-items:center;gap:8px;width:100%;border:none;background:transparent;font:inherit;text-align:left;padding:6px 12px;cursor:pointer;color:var(--ip-text)}',
  '.ipv2-opt:hover{background:var(--ip-accent-soft)}',
  '.ipv2-opt[disabled]{opacity:.45;cursor:default}',
  '.ipv2-opt .ipv2-check{width:15px;height:15px;border:2px solid #cbd5e1;border-radius:4px;flex-shrink:0}',
  '.ipv2-opt[aria-checked="true"] .ipv2-check{background:var(--ip-accent);border-color:var(--ip-accent)}',
  '.ipv2-opt-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.ipv2-opt-count{color:var(--ip-muted);font-size:12px}',
  '.ipv2-chip-x{border:none;background:transparent;cursor:pointer;color:var(--ip-muted);font:inherit;padding:0 0 0 2px}',
  '.ipv2-dash{flex:1;overflow:auto;padding:12px 16px 16px}',
  '.ipv2-dash[hidden],.ipv2-list[hidden]{display:none}',
  '.ipv2-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}',
  '.ipv2-card{border:1px solid var(--ip-border);border-radius:12px;background:var(--ip-panel);padding:12px;text-align:left;font:inherit;cursor:pointer;color:var(--ip-text)}',
  '.ipv2-card:hover{border-color:var(--ip-accent)}',
  '.ipv2-card small{display:block;color:var(--ip-muted);font-weight:700;margin-bottom:4px}',
  '.ipv2-card strong{font-size:22px}',
  '.ipv2-card.ok strong{color:var(--ip-ok)}.ipv2-card.pending strong{color:var(--ip-pending)}.ipv2-card.critical strong,.ipv2-card.inactive strong{color:var(--ip-critical)}',
  '.ipv2-dash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:12px}',
  '.ipv2-box{border:1px solid var(--ip-border);border-radius:12px;background:var(--ip-panel);padding:12px;min-width:0}',
  '.ipv2-box h3{margin:0 0 8px;font-size:13px}',
  '.ipv2-chart{position:relative;height:240px}',
  '.ipv2-empty{color:var(--ip-muted);padding:24px 0;text-align:center}',
  '.ipv2-matrix{border-collapse:collapse;width:100%;font-size:12px}',
  '.ipv2-matrix th,.ipv2-matrix td{border:1px solid var(--ip-border);padding:4px 6px;text-align:center;white-space:nowrap}',
  '.ipv2-matrix th:first-child,.ipv2-matrix td:first-child{text-align:left;max-width:220px;overflow:hidden;text-overflow:ellipsis}',
  '.ipv2-matrix td button{border:none;background:transparent;font:inherit;cursor:pointer;width:100%}',
  '.ipv2-matrix td.hot{background:#fef2f2;font-weight:700}',
].join('\n');

// Third-party scripts, pinned and loaded lazily (only when the feature is used).
var IPV2_CHART_JS = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
var IPV2_XLSX_JS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
var IPV2_JSPDF_JS = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
var IPV2_AUTOTABLE_JS = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';

/**
 * Loads a script once per page (shared by every instance). Resolves to `pick()` once
 * loaded, or null on failure (a failed load can be retried later).
 */
function ipv2LoadScript(url, pick) {
  var ready = pick();
  if (ready) return Promise.resolve(ready);
  var cache = (window.__ipv2Scripts = window.__ipv2Scripts || {});
  if (!cache[url]) {
    cache[url] = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = url;
      script.onload = function () {
        resolve(pick() || null);
      };
      script.onerror = function () {
        delete cache[url];
        resolve(null);
      };
      document.head.appendChild(script);
    });
  }
  return cache[url];
}

function ipv2LoadChartJs() {
  return ipv2LoadScript(IPV2_CHART_JS, function () {
    return window.Chart;
  });
}

function ipv2LoadXlsx(url) {
  return ipv2LoadScript(url || IPV2_XLSX_JS, function () {
    return window.XLSX;
  });
}

/** jsPDF + the autoTable plugin (the plugin needs jsPDF on the page first). */
function ipv2LoadJsPdf() {
  var jsPdf = function () {
    return window.jspdf && window.jspdf.jsPDF;
  };
  return ipv2LoadScript(IPV2_JSPDF_JS, jsPdf).then(function (JsPDF) {
    if (!JsPDF) return null;
    return ipv2LoadScript(IPV2_AUTOTABLE_JS, function () {
      return typeof JsPDF.API.autoTable === 'function' ? JsPDF : null;
    });
  });
}

/** settings.schema stores lists/maps as text: "C6, C7" and '{"Cliente": true}'. */
function normalizeInventorySettings(raw) {
  var s = Object.assign({}, IPV2_DEFAULTS, raw || {});
  if (typeof s.disabledRules === 'string') {
    s.disabledRules = s.disabledRules
      .split(',')
      .map(function (x) {
        return x.trim().toUpperCase();
      })
      .filter(Boolean);
  }
  if (typeof s.integrationOverrides === 'string') {
    try {
      s.integrationOverrides = JSON.parse(s.integrationOverrides || '{}') || {};
    } catch {
      s.integrationOverrides = {}; // invalid JSON in the setting → no overrides
    }
  }
  return s;
}

function createInventoryApp(ctx) {
  var settings = normalizeInventorySettings(ctx.settings);
  var root = ctx.$container && ctx.$container[0];
  var lib = (typeof window !== 'undefined' && window.MyIOLibrary) || null;
  var inv = lib && lib.inventory;

  var state = {
    devices: [],
    rows: [],
    filters: null,
    sort: settings.defaultSort,
    groupBy: settings.defaultGroupBy,
    collapsed: {},
    renderLimit: IPV2_RENDER_BATCH,
    loading: null, // { loaded, total }
    error: null,
    partial: null, // { failedPages, total }
    loadedAt: null,
    refreshError: null,
    tab: 'list', // 'list' | 'dashboard'
    openDim: null, // dimension whose dropdown is open
    dimSearch: '',
  };

  var generation = 0;
  var inFlight = false;
  var destroyed = false;
  var refreshTimer = null;
  var searchTimer = null;
  var timers = [];
  var charts = [];
  var els = {};

  // Toolbar dropdowns (the Cadastro / Atividade axes are filtered by the KPI chips).
  var DIMENSIONS = [
    { dim: 'customers', label: 'Cliente', searchable: true },
    { dim: 'domains', label: 'Domínio' },
    { dim: 'profiles', label: 'Perfil', searchable: true },
    { dim: 'rules', label: 'Regra' },
    { dim: 'lifecycle', label: 'Ciclo de vida' },
  ];

  function log() {
    if (!settings.debug || typeof console === 'undefined') return;
    console.log.apply(console, ['[inventory-panel v2]'].concat([].slice.call(arguments)));
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- ThingsBoard HTTP (ctx.http is an Angular HttpClient: Observables) ----------
  function toPromise(observable) {
    if (observable && typeof observable.toPromise === 'function') return observable.toPromise();
    return new Promise(function (resolve, reject) {
      observable.subscribe(resolve, reject);
    });
  }
  function httpGet(url) {
    return toPromise(ctx.http.get(url));
  }
  function httpPost(url, body) {
    return toPromise(ctx.http.post(url, body));
  }

  // ---------- data loading (RFC-0237 §1) ----------
  function fetchCustomerMap() {
    var map = new Map();
    function page(n) {
      return httpGet('/api/customers?pageSize=1000&page=' + n + '&sortProperty=title&sortOrder=ASC').then(function (res) {
        (res.data || []).forEach(function (c) {
          if (c.title && c.id && c.id.id) map.set(c.title, c.id.id);
        });
        return res.hasNext ? page(n + 1) : map;
      });
    }
    return page(0).catch(function (err) {
      log('customers failed', err);
      return map; // customer ids stay empty in exports; the list still works
    });
  }

  function fetchPage(n) {
    var body = inv.buildEntitiesQueryBody(n, settings.pageSize);
    return httpPost('/api/entitiesQuery/find', body).catch(function () {
      return httpPost('/api/entitiesQuery/find', body); // one retry
    });
  }

  function load(isRefresh) {
    if (inFlight || destroyed) return;
    inFlight = true;
    var myGen = ++generation;
    var hadData = state.devices.length > 0;
    if (!hadData) {
      state.loading = { loaded: 0, total: null };
      state.error = null;
      renderAll();
    }

    fetchCustomerMap()
      .then(function (customerIdByName) {
        if (myGen !== generation || destroyed) return null;
        var devices = [];
        var failedPages = 0;
        var total = null;

        function next(n) {
          return fetchPage(n).then(
            function (res) {
              if (myGen !== generation || destroyed) return null;
              total = res.totalElements;
              (res.data || []).forEach(function (raw) {
                devices.push(inv.parseEntityRow(raw, { customerIdByName: customerIdByName }));
              });
              if (!hadData) {
                state.loading = { loaded: devices.length, total: total };
                renderProgress();
              }
              return res.hasNext ? next(n + 1) : devices;
            },
            function (err) {
              if (myGen !== generation || destroyed) return null;
              if (n === 0) throw err; // nothing to show — first page is mandatory
              failedPages++;
              log('page failed', n, err);
              // We cannot know hasNext of a failed page: try the next one until it is empty.
              return total !== null && (n + 1) * settings.pageSize < total ? next(n + 1) : devices;
            }
          );
        }

        return next(0).then(function (list) {
          if (!list || myGen !== generation || destroyed) return;
          state.devices = list;
          state.partial = failedPages ? { failedPages: failedPages, total: total } : null;
          state.loadedAt = Date.now();
          state.refreshError = null;
          state.error = null;
          state.loading = null;
          rebuildRows();
          renderAll();
        });
      })
      .catch(function (err) {
        if (myGen !== generation || destroyed) return;
        state.loading = null;
        if (hadData && isRefresh) {
          state.refreshError = Date.now();
        } else {
          state.error = (err && (err.message || err.statusText)) || 'Falha ao carregar os dispositivos';
        }
        renderAll();
      })
      .then(function () {
        if (myGen === generation) inFlight = false;
      });
  }

  function rebuildRows() {
    state.rows = inv.buildInventoryRows(state.devices, {
      now: Date.now(),
      staleHours: Number(settings.staleHours) || 24,
      disabledRules: settings.disabledRules || [],
      integrationOverrides: settings.integrationOverrides || {},
    });
    state.renderLimit = IPV2_RENDER_BATCH;
  }

  // ---------- rendering ----------
  function shell() {
    root.innerHTML =
      '<style>' +
      IPV2_CSS +
      '</style>' +
      '<div class="ipv2-root" data-ipv2-root>' +
      '<header class="ipv2-header">' +
      '<h2 class="ipv2-title"></h2>' +
      '<button class="ipv2-btn" type="button" data-action="refresh">⟳ Atualizar</button>' +
      '<div class="ipv2-export">' +
      '<button class="ipv2-btn" type="button" data-action="export-menu" data-role="export-btn" aria-haspopup="menu" aria-expanded="false" disabled>Exportar</button>' +
      '<div class="ipv2-export-menu" data-region="export-menu" role="menu" hidden>' +
      '<button type="button" role="menuitem" data-action="export" data-format="xlsx">Excel (XLSX)<small>Planilha com abas Dispositivos e Filtros</small></button>' +
      '<button type="button" role="menuitem" data-action="export" data-format="csv">CSV<small>Só a tabela — separador ";"</small></button>' +
      '<button type="button" role="menuitem" data-action="export" data-format="pdf">PDF<small>Resumo, matriz cliente × regra e lista</small></button>' +
      '</div></div>' +
      '</header>' +
      '<nav class="ipv2-tabs" role="tablist">' +
      '<button class="ipv2-tab" type="button" role="tab" data-action="tab" data-tab="list">Dispositivos</button>' +
      '<button class="ipv2-tab" type="button" role="tab" data-action="tab" data-tab="dashboard">Painel</button>' +
      '</nav>' +
      '<section class="ipv2-kpis" data-region="kpis"></section>' +
      '<section class="ipv2-toolbar">' +
      '<input class="ipv2-search" type="search" data-role="search" placeholder="Buscar label, name, identificador, cliente…" aria-label="Buscar dispositivos">' +
      '<div class="ipv2-dims" data-region="dims"></div>' +
      '<div class="ipv2-pop" data-region="pop" hidden></div>' +
      '<label data-role="list-only">Agrupar por <select class="ipv2-select" data-role="groupBy">' +
      '<option value="customer">Cliente</option><option value="domain">Domínio</option><option value="profile">Perfil</option><option value="none">Nenhum</option>' +
      '</select></label>' +
      '<label data-role="list-only">Ordenar <select class="ipv2-select" data-role="sort">' +
      '<option value="gravity">Gravidade</option><option value="label">Nome</option><option value="customer">Cliente</option><option value="lastActivity">Última atividade</option>' +
      '</select></label>' +
      '</section>' +
      '<div class="ipv2-active" data-region="active"></div>' +
      '<div class="ipv2-status"><span data-region="count" aria-live="polite"></span><span data-region="updated"></span></div>' +
      '<div class="ipv2-banner" data-region="banner" role="status"></div>' +
      '<main class="ipv2-list" data-region="list"></main>' +
      '<section class="ipv2-dash" data-region="dashboard" hidden></section>' +
      '</div>';

    var app = root.querySelector('[data-ipv2-root]');
    els = {
      app: app,
      title: app.querySelector('.ipv2-title'),
      kpis: app.querySelector('[data-region="kpis"]'),
      active: app.querySelector('[data-region="active"]'),
      count: app.querySelector('[data-region="count"]'),
      updated: app.querySelector('[data-region="updated"]'),
      banner: app.querySelector('[data-region="banner"]'),
      list: app.querySelector('[data-region="list"]'),
      dashboard: app.querySelector('[data-region="dashboard"]'),
      dims: app.querySelector('[data-region="dims"]'),
      pop: app.querySelector('[data-region="pop"]'),
      search: app.querySelector('[data-role="search"]'),
      groupBy: app.querySelector('[data-role="groupBy"]'),
      sort: app.querySelector('[data-role="sort"]'),
      exportBtn: app.querySelector('[data-role="export-btn"]'),
      exportMenu: app.querySelector('[data-region="export-menu"]'),
    };
    els.title.textContent = settings.title;
    els.groupBy.value = state.groupBy;
    els.sort.value = state.sort;

    app.addEventListener('click', onClick);
    app.addEventListener('input', onPopInput);
    app.addEventListener('keydown', onKeydown);
    app.addEventListener('mouseover', onHelpOver);
    app.addEventListener('mouseout', onHelpOut);
    els.search.addEventListener('input', onSearchInput);
    els.groupBy.addEventListener('change', onSelectChange);
    els.sort.addEventListener('change', onSelectChange);
  }

  function renderAll() {
    if (destroyed || !els.app) return;
    renderKpis();
    renderDims();
    renderPop();
    renderActiveFilters();
    renderBanner();
    renderTabs();
    renderContent();
    renderExportButton();
  }

  /** Regions that depend on the filters (everything except header/toolbar inputs). */
  function renderFiltered() {
    renderKpis();
    renderDims();
    renderPop();
    renderActiveFilters();
    renderContent();
    renderExportButton();
  }

  function renderTabs() {
    els.app.querySelectorAll('[data-action="tab"]').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === state.tab));
    });
    els.list.hidden = state.tab !== 'list';
    els.app.querySelectorAll('[data-role="list-only"]').forEach(function (el) {
      el.hidden = state.tab !== 'list';
    });
    els.dashboard.hidden = state.tab !== 'dashboard';
  }

  function renderContent() {
    if (state.tab === 'dashboard') renderDashboard();
    else renderList();
  }

  // ---------- toolbar dropdowns ----------
  var LIFECYCLE_ORDER = ['active', 'stock', 'archived'];

  function optionLabel(dim, value) {
    if (dim === 'customers') return inv.customerKeyLabel(value);
    if (dim === 'domains') return inv.DOMAIN_LABELS[value] || value;
    if (dim === 'rules') {
      var rule = inv.getInventoryRule(value);
      return rule ? rule.label : value;
    }
    if (dim === 'lifecycle') return inv.LIFECYCLE_LABELS[value] || value;
    return value;
  }

  /** Options of a dimension: every value present in the data, with its facet count. */
  function dimOptions(dim) {
    var counts = inv.facetCounts(state.rows, state.filters, dim);
    var values = new Set();
    if (dim === 'rules') {
      inv.INVENTORY_RULES.forEach(function (r) {
        values.add(r.id);
      });
    } else if (dim === 'lifecycle') {
      LIFECYCLE_ORDER.forEach(function (v) {
        values.add(v);
      });
    } else {
      state.rows.forEach(function (r) {
        inv.dimensionValues(r, dim).forEach(function (v) {
          values.add(v);
        });
      });
    }
    state.filters[dim].forEach(function (v) {
      values.add(v); // keep selected options visible even at zero
    });
    var list = Array.from(values).map(function (v) {
      return { value: v, label: optionLabel(dim, v), count: counts.get(v) || 0 };
    });
    if (dim === 'rules' || dim === 'lifecycle') return list;
    return list.sort(function (a, b) {
      if (a.value === inv.NO_CUSTOMER_KEY) return -1;
      if (b.value === inv.NO_CUSTOMER_KEY) return 1;
      return a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' });
    });
  }

  function renderDims() {
    if (!state.rows.length) {
      els.dims.innerHTML = '';
      return;
    }
    els.dims.innerHTML = DIMENSIONS.map(function (d) {
      var n = state.filters[d.dim].size;
      var isDefaultLifecycle = d.dim === 'lifecycle' && n === 1 && state.filters.lifecycle.has('active');
      var active = n > 0 && !isDefaultLifecycle;
      return (
        '<button class="ipv2-btn ipv2-dim-btn" type="button" data-action="open-dim" data-dim="' + d.dim + '"' +
        ' data-active="' + active + '" aria-expanded="' + (state.openDim === d.dim) + '">' +
        esc(d.label) + (active ? ' (' + n + ')' : '') + ' ▾</button>'
      );
    }).join('');
  }

  function renderPop() {
    if (!state.openDim || !state.rows.length) {
      els.pop.hidden = true;
      els.pop.innerHTML = '';
      return;
    }
    var def = DIMENSIONS.filter(function (d) {
      return d.dim === state.openDim;
    })[0];
    var needle = state.dimSearch ? inv.normalizeText(state.dimSearch) : '';
    var options = dimOptions(state.openDim).filter(function (o) {
      return !needle || inv.normalizeText(o.label).includes(needle);
    });
    var selected = state.filters[state.openDim];
    var hadSearch = els.pop.querySelector('[data-role="dim-search"]');
    var keepFocus = hadSearch && root.ownerDocument.activeElement === hadSearch;

    var listHtml = options.length
      ? options
          .map(function (o) {
            var checked = selected.has(o.value);
            var rule = state.openDim === 'rules' ? inv.getInventoryRule(o.value) : null;
            return (
              '<button class="ipv2-opt" type="button" role="menuitemcheckbox" data-action="toggle-filter" data-dim="' + state.openDim +
              '" data-value="' + esc(o.value) + '" aria-checked="' + checked + '"' +
              (o.count === 0 && !checked ? ' disabled' : '') + (rule ? ' title="' + esc(rule.description) + '"' : '') + '>' +
              '<span class="ipv2-check"></span><span class="ipv2-opt-label">' + esc(o.label) + '</span>' +
              '<span class="ipv2-opt-count">' + o.count.toLocaleString('pt-BR') + '</span></button>'
            );
          })
          .join('')
      : '<div class="ipv2-empty">Nenhuma opção</div>';

    if (hadSearch && def.searchable) {
      // Re-render only the options so the search input keeps its value and focus.
      els.pop.querySelector('.ipv2-pop-list').innerHTML = listHtml;
      if (keepFocus) hadSearch.focus();
    } else {
      els.pop.innerHTML =
        '<div class="ipv2-pop-head">' + esc(def.label) +
        '<button class="ipv2-chip-x" type="button" data-action="clear-dim" data-dim="' + def.dim + '">Limpar</button></div>' +
        (def.searchable
          ? '<input class="ipv2-pop-search" type="search" data-role="dim-search" placeholder="Filtrar ' + esc(def.label.toLowerCase()) + '…" value="' + esc(state.dimSearch) + '">'
          : '') +
        '<div class="ipv2-pop-list" role="menu">' + listHtml + '</div>';
    }
    els.pop.hidden = false;
  }

  function closePop() {
    if (!state.openDim) return;
    state.openDim = null;
    state.dimSearch = '';
    renderDims();
    renderPop();
  }

  function countBy(rows, pick) {
    var out = {};
    rows.forEach(function (r) {
      var k = pick(r);
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }

  function kpiChip(dim, value, dotClass, text, count) {
    var pressed = state.filters[dim].has(value);
    return (
      '<button class="ipv2-chip" type="button" data-action="toggle-filter" data-dim="' + dim + '" data-value="' + esc(value) + '"' +
      ' aria-pressed="' + pressed + '"' + (count === 0 && !pressed ? ' disabled' : '') + '>' +
      '<span class="ipv2-dot ' + dotClass + '"></span>' + esc(text) + ' <strong>' + count.toLocaleString('pt-BR') + '</strong></button>'
    );
  }

  // ---------- export (RFC-0237 §5): XLSX / CSV / PDF of getVisibleRows() ----------
  var exporting = false;

  function renderExportButton() {
    if (!els.exportBtn) return;
    var ready = state.rows.length > 0 && state.filters;
    var count = ready ? inv.applyFilters(state.rows, state.filters).length : 0;
    els.exportBtn.disabled = !ready || count === 0 || exporting;
    els.exportBtn.textContent = exporting ? 'Gerando…' : ready ? 'Exportar ' + count.toLocaleString('pt-BR') + ' ▾' : 'Exportar';
  }

  function setExportMenu(open) {
    if (!els.exportMenu) return;
    els.exportMenu.hidden = !open;
    els.exportBtn.setAttribute('aria-expanded', String(open));
  }

  function exportRows() {
    return inv.getVisibleRows(state.rows, state.filters, state.sort, state.groupBy);
  }

  function currentUserName() {
    var u = ctx.currentUser || {};
    return u.sub || u.email || '';
  }

  function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    timers.push(
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 2000)
    );
  }

  function notify(severity, message) {
    if (lib.openMessageDialog) {
      lib.openMessageDialog({ severity: severity, message: message });
    } else if (lib.MyIOToast && lib.MyIOToast[severity === 'error' ? 'error' : 'info']) {
      lib.MyIOToast[severity === 'error' ? 'error' : 'info'](message);
    }
  }

  /** A generator script failed to load (offline, CDN blocked): offer the CSV instead. */
  function offerCsvFallback(what) {
    var message = 'Não foi possível carregar o gerador de ' + what + '. Deseja baixar o CSV com os mesmos dispositivos?';
    if (!lib.openConfirmDialog) {
      notify('error', message.replace(' Deseja baixar o CSV com os mesmos dispositivos?', ''));
      return;
    }
    lib
      .openConfirmDialog({
        title: 'Exportação indisponível',
        message: message,
        buttons: [
          { label: 'Cancelar', value: 'cancel' },
          { label: 'Baixar CSV', value: 'csv', variant: 'primary', autoFocus: true },
        ],
      })
      .then(function (choice) {
        if (choice === 'csv') exportCsv(exportRows(), new Date());
      });
  }

  function exportCsv(rows, now) {
    var csv = inv.toCSV(inv.toExportMatrix(rows));
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), inv.exportFileName(state.filters, 'csv', now));
    return Promise.resolve();
  }

  function exportXlsx(rows, now) {
    return ipv2LoadXlsx(settings.xlsxScriptUrl).then(function (XLSX) {
      if (!XLSX) return offerCsvFallback('XLSX');
      var matrix = inv.toExportMatrix(rows);
      // Every cell is a string: ids keep their leading zeros and nothing becomes a formula.
      var sheet = XLSX.utils.aoa_to_sheet([matrix.header].concat(matrix.rows));
      sheet['!autofilter'] = { ref: sheet['!ref'] };
      sheet['!cols'] = matrix.header.map(function (h, i) {
        var width = h.length;
        for (var r = 0; r < matrix.rows.length && r < 500; r++) width = Math.max(width, matrix.rows[r][i].length);
        return { wch: Math.min(Math.max(width + 2, 8), 50) };
      });
      var summary = inv.buildExportSummary(state.filters, inv.buildDashboardSummary(rows), {
        generatedAt: now.getTime(),
        generatedBy: currentUserName(),
        exported: rows.length,
      });
      var filtersSheet = XLSX.utils.aoa_to_sheet([['Campo', 'Valor']].concat(summary));
      filtersSheet['!cols'] = [{ wch: 44 }, { wch: 60 }];

      var book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Dispositivos');
      XLSX.utils.book_append_sheet(book, filtersSheet, 'Filtros');
      var data = XLSX.write(book, { bookType: 'xlsx', type: 'array', compression: true });
      downloadBlob(
        new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        inv.exportFileName(state.filters, 'xlsx', now)
      );
    });
  }

  // ----- PDF annex: one device per line, 3 columns per page, font 6 -----
  var PDF_COLORS = {
    ok: [22, 163, 74],
    pending: [217, 119, 6],
    critical: [220, 38, 38],
    inactive: [220, 38, 38],
    partial: [148, 163, 184],
    nodata: [148, 163, 184],
    excluded: [203, 213, 225],
  };
  var PDF_PAGE = { w: 297, h: 210, margin: 10, top: 17, bottom: 12, cols: 3, gap: 6, line: 3.05 };

  function pdfDot(doc, x, y, level) {
    var c = PDF_COLORS[level] || PDF_COLORS.nodata;
    doc.setFillColor(c[0], c[1], c[2]);
    doc.circle(x, y, 0.75, 'F');
  }

  /** Text cut with "…" to fit `width` mm at the current font. */
  function pdfFit(doc, text, width) {
    if (doc.getTextWidth(text) <= width) return text;
    var lo = 0;
    var hi = text.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if (doc.getTextWidth(text.slice(0, mid) + '…') <= width) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo) + '…';
  }

  function pdfAge(ms, now) {
    if (ms === null) return '—';
    var hours = Math.max(0, (now - ms) / 3600000);
    if (hours < 1) return '<1h';
    if (hours < 48) return Math.floor(hours) + 'h';
    return Math.floor(hours / 24) + 'd';
  }

  function pdfGroupTitle(key) {
    if (state.groupBy === 'none') return 'Dispositivos';
    if (key === inv.NO_CUSTOMER_KEY) return 'Sem cliente';
    if (state.groupBy === 'domain') return inv.DOMAIN_LABELS[key] || key;
    return key;
  }

  /** Page-1 legend: dots and the rule codes used in the annex. */
  function pdfLegend(doc, x, y) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Legenda do anexo', x, y);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    var lineY = y + 5;
    [
      ['ok', 'Cadastro íntegro / reportando'],
      ['pending', 'Cadastro pendente'],
      ['critical', 'Cadastro crítico / sem atividade'],
      ['nodata', 'Parcial / sem dado'],
    ].forEach(function (item) {
      pdfDot(doc, x + 1, lineY - 0.9, item[0]);
      doc.text(item[1], x + 4, lineY);
      lineY += 3.6;
    });
    // Example line (the standard PDF font has no "●": dots are drawn).
    lineY += 1;
    doc.text('Linha:', x, lineY);
    pdfDot(doc, x + 10, lineY - 0.9, 'pending');
    pdfDot(doc, x + 12, lineY - 0.9, 'ok');
    doc.text('Label (name)   regras · última atividade', x + 14, lineY);
    doc.text('1º ponto = Cadastro, 2º = Atividade', x, lineY + 3.6);
    lineY += 9;
    inv.INVENTORY_RULES.forEach(function (r) {
      if ((settings.disabledRules || []).indexOf(r.id) !== -1) return;
      doc.setFont('helvetica', 'bold');
      doc.text(r.id, x, lineY);
      doc.setFont('helvetica', 'normal');
      doc.text(r.label, x + 7, lineY);
      lineY += 3.6;
    });
  }

  function pdfAnnex(doc, groups, total, now) {
    var P = PDF_PAGE;
    var colW = (P.w - 2 * P.margin - (P.cols - 1) * P.gap) / P.cols;
    var maxY = P.h - P.bottom;
    var col = 0;
    var y = 0;

    function newPage() {
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(62, 26, 125);
      doc.text('Anexo — dispositivos (' + total.toLocaleString('pt-BR') + ')', P.margin, 11);
      col = 0;
      y = P.top;
    }
    function nextSlot(height) {
      if (y + height <= maxY) return;
      col++;
      y = P.top;
      if (col >= P.cols) newPage();
    }
    function colX() {
      return P.margin + col * (colW + P.gap);
    }
    function groupHeader(title, count, continued) {
      nextSlot(P.line * 2); // never leave a header alone at the bottom of a column
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(62, 26, 125);
      doc.text(pdfFit(doc, title + ' (' + count + ')' + (continued ? ' — cont.' : ''), colW), colX(), y + 2.2);
      doc.setDrawColor(203, 213, 225);
      doc.line(colX(), y + 3, colX() + colW, y + 3);
      y += P.line + 1.2;
    }

    newPage();
    groups.forEach(function (g) {
      var title = pdfGroupTitle(g.key);
      groupHeader(title, g.rows.length, false);
      g.rows.forEach(function (row) {
        var before = col;
        nextSlot(P.line);
        if (col !== before || y === P.top) {
          // the group continues in a new column/page: repeat its header
          groupHeader(title, g.rows.length, true);
        }
        var x = colX();
        var ev = row.evaluation;
        pdfDot(doc, x + 0.9, y + 1.4, ev.cadastro.level);
        pdfDot(doc, x + 2.9, y + 1.4, ev.atividade.level);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        var right = (ev.failed.length ? ev.failed.join(' ') + ' · ' : '') + pdfAge(row.device.lastActivityTime, now);
        var rightW = doc.getTextWidth(right);
        doc.setTextColor(100, 116, 139);
        doc.text(right, x + colW, y + 2, { align: 'right' });

        var parts = inv.formatDeviceLabel(row.device);
        var left = parts.primary + (parts.secondary ? ' (' + parts.secondary + ')' : '');
        doc.setTextColor(30, 41, 59);
        doc.text(pdfFit(doc, left, colW - 5 - rightW - 2), x + 4.6, y + 2);
        y += P.line;
      });
      y += 1.2;
    });
  }

  function exportPdf(rows, now) {
    return ipv2LoadJsPdf().then(function (JsPDF) {
      if (!JsPDF) return offerCsvFallback('PDF');
      var doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      var accent = [62, 26, 125];
      var dash = inv.buildDashboardSummary(rows, { matrixCustomers: 15 });
      var summary = inv.buildExportSummary(state.filters, dash, {
        generatedAt: now.getTime(),
        generatedBy: currentUserName(),
        exported: rows.length,
      });

      doc.setFontSize(15);
      doc.setTextColor(accent[0], accent[1], accent[2]);
      doc.text(settings.title || 'Inventário de Dispositivos', 14, 15);
      doc.setTextColor(0, 0, 0);

      doc.autoTable({
        startY: 20,
        body: summary,
        theme: 'plain',
        tableWidth: 150,
        styles: { fontSize: 8, cellPadding: 0.8 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
      });

      if (dash.matrix.customers.length) {
        var y = doc.lastAutoTable.finalY + 8;
        doc.setFontSize(11);
        doc.text('Clientes × regras com falha (dispositivos)', 14, y);
        doc.autoTable({
          startY: y + 3,
          head: [
            ['Cliente'].concat(
              dash.matrix.rules.map(function (id) {
                var rule = inv.getInventoryRule(id);
                return rule ? rule.label : id;
              })
            ),
          ],
          body: dash.matrix.customers.map(function (c, i) {
            return [inv.customerKeyLabel(c)].concat(
              dash.matrix.cells[i].map(function (n) {
                return n ? String(n) : '';
              })
            );
          }),
          styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
          columnStyles: { 0: { halign: 'left', cellWidth: 60 } },
          headStyles: { fillColor: accent },
        });
      }

      pdfLegend(doc, 172, 22);
      pdfAnnex(doc, inv.getVisibleGroups(state.rows, state.filters, state.sort, state.groupBy), rows.length, now.getTime());

      var pages = doc.internal.getNumberOfPages();
      var stamp = inv.formatDateTime(now.getTime());
      for (var p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('Gerado em ' + stamp + ' · Página ' + p + ' de ' + pages, 283, 205, { align: 'right' });
      }
      downloadBlob(doc.output('blob'), inv.exportFileName(state.filters, 'pdf', now));
    });
  }

  function runExport(format) {
    if (exporting || !state.rows.length) return;
    setExportMenu(false);
    var rows = exportRows();
    if (!rows.length) return;
    var run = format === 'xlsx' ? exportXlsx : format === 'pdf' ? exportPdf : exportCsv;
    exporting = true;
    renderExportButton();
    log('export', format, rows.length);
    run(rows, new Date())
      .catch(function (err) {
        log('export failed', format, err);
        notify('error', 'Falha ao gerar o arquivo ' + format.toUpperCase() + '.');
      })
      .then(function () {
        exporting = false;
        if (!destroyed) renderExportButton();
      });
  }

  // ---------- KPI help ("?" + MyIOLibrary.InfoTooltip) ----------
  var HELP_TITLES = { cadastro: 'Cadastro — o que significa', atividade: 'Atividade — o que significa' };

  function helpButton(axis) {
    return (
      '<button class="ipv2-help" type="button" data-action="kpi-help" data-help="' + axis + '"' +
      ' aria-label="' + esc(HELP_TITLES[axis]) + '">?</button>'
    );
  }

  function rulesHelpList(severity) {
    var disabled = settings.disabledRules || [];
    return inv.INVENTORY_RULES.filter(function (r) {
      return r.axis === 'cadastro' && r.severity === severity && disabled.indexOf(r.id) === -1;
    })
      .map(function (r) {
        return '<li><b>' + esc(r.id) + '</b> ' + esc(r.label) + ' — ' + esc(r.description) + '</li>';
      })
      .join('');
  }

  // The tooltip lives in document.body (outside the panel's CSS variables): literal colours.
  var HELP_DOT_COLORS = { ok: '#16a34a', pending: '#d97706', critical: '#dc2626', inactive: '#dc2626', unknown: '#94a3b8' };

  function helpLevel(dotClass, title, text, extra) {
    return (
      '<div style="margin:0 0 10px"><div style="display:flex;align-items:center;gap:6px;font-weight:700">' +
      '<span style="width:8px;height:8px;border-radius:50%;display:inline-block;background:' + HELP_DOT_COLORS[dotClass] + '"></span>' +
      esc(title) + '</div>' +
      '<div style="margin:2px 0 0 14px;color:#475569">' + text + '</div>' +
      (extra ? '<ul style="margin:4px 0 0 14px;padding-left:16px;color:#475569">' + extra + '</ul>' : '') +
      '</div>'
    );
  }

  function helpContent(axis) {
    var foot =
      '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;color:#64748b">' +
      'Devices <b>arquivados</b> ou <b>em estoque</b> continuam na lista, mas ficam fora das contagens. ' +
      'Clique num indicador para filtrar a lista.</div>';
    if (axis === 'cadastro') {
      return (
        '<div style="margin-bottom:10px">O device está registrado e integrado corretamente? ' +
        'Quando falha em mais de uma regra, vale a pior.</div>' +
        helpLevel('critical', 'Crítico', 'O dado que chega ao cliente fica <b>errado ou faltando</b>.', rulesHelpList('critical')) +
        helpLevel('pending', 'Pendente', 'Os números estão certos, mas <b>alguma função fica prejudicada</b> ou o cadastro precisa de ajuste.', rulesHelpList('pending')) +
        helpLevel('ok', 'Íntegro', 'Todas as regras que se aplicam ao device passaram.') +
        helpLevel('unknown', 'Parcial', 'Parte dos atributos não carregou; o painel não afirma que está íntegro.') +
        '<div style="color:#475569">Clientes sem nenhuma integração MYIO (sem ingestionId / gcdrDeviceId em nenhum device) ' +
        'não são cobrados pelas regras de integração.</div>' +
        foot
      );
    }
    var hours = Number(settings.staleHours) || 24;
    return (
      '<div style="margin-bottom:10px">O device está enviando dados?</div>' +
      helpLevel('ok', 'Reportando', 'Ativo no ThingsBoard e com atividade nas últimas <b>' + hours + ' h</b>.') +
      helpLevel('inactive', 'Sem atividade', 'Inativo no ThingsBoard, ou a última atividade é mais antiga que ' + hours + ' h.') +
      helpLevel('unknown', 'Sem dado', 'O ThingsBoard não tem registro de última atividade deste device.') +
      foot
    );
  }

  function showHelp(btn) {
    var tip = lib.InfoTooltip;
    if (!tip || typeof tip.show !== 'function') return;
    var axis = btn.getAttribute('data-help');
    tip.show(btn, { icon: '❓', title: HELP_TITLES[axis] || '', content: helpContent(axis) });
  }

  function onHelpOver(ev) {
    var btn = ev.target.closest && ev.target.closest('[data-help]');
    if (btn && !(ev.relatedTarget && btn.contains(ev.relatedTarget))) showHelp(btn);
  }

  function onHelpOut(ev) {
    var btn = ev.target.closest && ev.target.closest('[data-help]');
    if (!btn || (ev.relatedTarget && btn.contains(ev.relatedTarget))) return;
    if (lib.InfoTooltip && lib.InfoTooltip.startDelayedHide) lib.InfoTooltip.startDelayedHide();
  }

  function renderKpis() {
    if (!state.rows.length) {
      els.kpis.innerHTML = '';
      return;
    }
    // Facet counts: each axis ignores its own selection but honours every other filter.
    var cad = inv.facetCounts(state.rows, state.filters, 'cadastro');
    var atv = inv.facetCounts(state.rows, state.filters, 'atividade');
    var get = function (m, k) {
      return m.get(k) || 0;
    };
    var life = countBy(state.rows, function (r) {
      return r.evaluation.lifecycle.status;
    });

    var html =
      '<div class="ipv2-kpi-row"><span class="ipv2-kpi-label">Cadastro' + helpButton('cadastro') + '</span>' +
      kpiChip('cadastro', 'ok', 'ok', 'Íntegro', get(cad, 'ok')) +
      kpiChip('cadastro', 'pending', 'pending', 'Pendente', get(cad, 'pending')) +
      kpiChip('cadastro', 'critical', 'critical', 'Crítico', get(cad, 'critical')) +
      (get(cad, 'partial') ? kpiChip('cadastro', 'partial', 'unknown', 'Parcial', get(cad, 'partial')) : '') +
      '</div>' +
      '<div class="ipv2-kpi-row"><span class="ipv2-kpi-label">Atividade' + helpButton('atividade') + '</span>' +
      kpiChip('atividade', 'ok', 'ok', 'Reportando', get(atv, 'ok')) +
      kpiChip('atividade', 'inactive', 'inactive', 'Sem atividade', get(atv, 'inactive')) +
      (get(atv, 'nodata') ? kpiChip('atividade', 'nodata', 'unknown', 'Sem dado', get(atv, 'nodata')) : '') +
      '</div>' +
      '<div class="ipv2-lifecycle">Ciclo de vida: ' +
      (life.archived || 0).toLocaleString('pt-BR') + ' arquivados · ' +
      (life.stock || 0).toLocaleString('pt-BR') + ' em estoque (fora dos indicadores)</div>';
    els.kpis.innerHTML = html;
  }

  var ACTIVE_CHIP_DIMS = [
    { dim: 'customers', label: 'Cliente' },
    { dim: 'domains', label: 'Domínio' },
    { dim: 'profiles', label: 'Perfil' },
    { dim: 'cadastro', label: 'Cadastro' },
    { dim: 'atividade', label: 'Atividade' },
    { dim: 'rules', label: 'Regra' },
    { dim: 'lifecycle', label: 'Ciclo de vida' },
  ];

  function axisLabel(dim, value) {
    if (dim === 'cadastro') return inv.CADASTRO_LABELS[value] || value;
    if (dim === 'atividade') return inv.ATIVIDADE_LABELS[value] || value;
    return optionLabel(dim, value);
  }

  function isDefaultLifecycle() {
    return state.filters.lifecycle.size === 1 && state.filters.lifecycle.has('active');
  }

  function renderActiveFilters() {
    if (!state.filters) return;
    var chips = ACTIVE_CHIP_DIMS.filter(function (d) {
      if (d.dim === 'lifecycle' && isDefaultLifecycle()) return false;
      return state.filters[d.dim].size > 0;
    }).map(function (d) {
      var values = Array.from(state.filters[d.dim]).map(function (v) {
        return axisLabel(d.dim, v);
      });
      return (
        '<span class="ipv2-chip" aria-pressed="true">' + esc(d.label) + ': ' + esc(values.join(', ')) +
        '<button class="ipv2-chip-x" type="button" data-action="clear-dim" data-dim="' + d.dim + '" aria-label="Remover filtro ' + esc(d.label) + '">✕</button></span>'
      );
    });
    if (state.filters.text.trim()) {
      chips.push(
        '<span class="ipv2-chip" aria-pressed="true">Busca: ' + esc(state.filters.text.trim()) +
        '<button class="ipv2-chip-x" type="button" data-action="clear-text" aria-label="Limpar busca">✕</button></span>'
      );
    }
    els.active.innerHTML = chips.length
      ? '<span class="ipv2-lifecycle">Filtros ativos:</span>' + chips.join('') +
        '<button class="ipv2-btn" type="button" data-action="clear-filters">Limpar tudo</button>'
      : '';
  }

  function renderBanner() {
    var msgs = [];
    if (state.partial) {
      msgs.push(
        'Carregamento parcial: ' + state.partial.failedPages + ' página(s) falharam — alguns dispositivos podem estar faltando.'
      );
    }
    if (state.refreshError) {
      msgs.push('Falha ao atualizar — exibindo os dados de ' + formatTime(state.loadedAt) + '.');
    }
    els.banner.textContent = msgs.join(' ');
    els.updated.textContent = state.loadedAt ? 'Atualizado às ' + formatTime(state.loadedAt) : '';
  }

  function formatTime(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function relativeTime(ms) {
    if (!ms) return '';
    var diff = Date.now() - ms;
    var min = Math.round(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return 'há ' + min + ' min';
    var h = Math.round(min / 60);
    if (h < 48) return 'há ' + h + ' h';
    return 'há ' + Math.round(h / 24) + ' d';
  }

  function renderProgress() {
    if (!state.loading || !els.list) return;
    var l = state.loading;
    var pct = l.total ? Math.min(100, Math.round((l.loaded / l.total) * 100)) : 5;
    els.list.innerHTML =
      '<div class="ipv2-state"><strong>Carregando dispositivos…</strong>' +
      (l.total ? l.loaded.toLocaleString('pt-BR') + ' de ' + l.total.toLocaleString('pt-BR') : 'Consultando o ThingsBoard') +
      '<div class="ipv2-progress"><span style="width:' + pct + '%"></span></div></div>';
    els.count.textContent = '';
  }

  function groupTitle(key) {
    if (key === inv.NO_CUSTOMER_KEY) return '⚠ Sem cliente';
    if (state.groupBy === 'domain') return inv.DOMAIN_LABELS[key] || key;
    return key;
  }

  function cadastroBadge(row) {
    var c = row.evaluation.cadastro;
    if (c.level === 'excluded') return '';
    var cls = c.level === 'partial' ? 'unknown' : c.level;
    return (
      '<span class="ipv2-badge"><span class="ipv2-dot ' + cls + '"></span>Cadastro: ' + esc(inv.CADASTRO_LABELS[c.level]) +
      (c.partial ? ' <small>· avaliação parcial</small>' : '') + '</span>'
    );
  }

  function atividadeBadge(row) {
    var a = row.evaluation.atividade;
    if (a.level === 'excluded') return '';
    var cls = a.level === 'nodata' ? 'unknown' : a.level;
    var when = row.device.lastActivityTime ? ' <small>' + esc(relativeTime(row.device.lastActivityTime)) + '</small>' : '';
    return '<span class="ipv2-badge"><span class="ipv2-dot ' + cls + '"></span>' + esc(inv.ATIVIDADE_LABELS[a.level]) + when + '</span>';
  }

  function reasonsHtml(row) {
    var failed = row.evaluation.failed;
    var html = failed
      .slice(0, 2)
      .map(function (id) {
        var rule = inv.getInventoryRule(id);
        return '<span class="ipv2-reason" title="' + esc(rule ? rule.description : id) + '">' + esc(rule ? rule.label : id) + '</span>';
      })
      .join('');
    if (failed.length > 2) {
      var rest = failed
        .slice(2)
        .map(function (id) {
          var rule = inv.getInventoryRule(id);
          return rule ? rule.label : id;
        })
        .join('; ');
      html += '<span class="ipv2-reason" title="' + esc(rest) + '">+' + (failed.length - 2) + '</span>';
    }
    var life = row.evaluation.lifecycle;
    if (life.status !== 'active') html += '<span class="ipv2-hint">' + esc(inv.LIFECYCLE_LABELS[life.status]) + '</span>';
    else if (life.legacyHint) html += '<span class="ipv2-hint" title="Sinal legado — preencha lifecycleStatus">possivelmente arquivado</span>';
    return html;
  }

  function rowHtml(row) {
    var d = row.device;
    var parts = inv.formatDeviceLabel(d);
    var icon = lib.getDeviceIcon ? lib.getDeviceIcon(d.deviceProfile || '') : '';
    return (
      '<div class="ipv2-row" data-action="open-device" data-id="' + esc(d.id) + '">' +
      '<img src="' + esc(icon) + '" alt="" loading="lazy">' +
      '<div style="min-width:0">' +
      '<div class="ipv2-name"><span class="ipv2-primary" title="' + esc(parts.primary) + '">' + esc(parts.primary) + '</span>' +
      (parts.secondary ? '<span class="ipv2-secondary" title="' + esc(parts.secondary) + '">(' + esc(parts.secondary) + ')</span>' : '') +
      '<button class="ipv2-copy" type="button" data-action="copy-name" data-name="' + esc(d.name) + '" aria-label="Copiar name" title="Copiar name">⧉</button></div>' +
      '<div class="ipv2-meta"><span class="ipv2-pill' + (row.domain === 'unclassified' ? ' unclassified' : '') + '">' + esc(row.profileLabel) + '</span>' +
      reasonsHtml(row) + '</div>' +
      '</div>' +
      '<div class="ipv2-badges">' + cadastroBadge(row) + atividadeBadge(row) + '</div>' +
      '</div>'
    );
  }

  function renderList() {
    if (!els.list) return;
    if (state.loading) return renderProgress();
    if (state.error) {
      els.list.innerHTML =
        '<div class="ipv2-state"><strong>Não foi possível carregar o inventário</strong>' + esc(state.error) +
        '<br><button class="ipv2-btn" type="button" data-action="retry" style="margin-top:12px">Tentar de novo</button></div>';
      els.count.textContent = '';
      return;
    }

    var groups = inv.getVisibleGroups(state.rows, state.filters, state.sort, state.groupBy);
    var visibleCount = groups.reduce(function (s, g) {
      return s + g.rows.length;
    }, 0);
    var activeTotal = state.rows.filter(function (r) {
      return r.evaluation.lifecycle.status === 'active';
    }).length;
    els.count.textContent =
      'Mostrando ' + visibleCount.toLocaleString('pt-BR') + ' de ' + state.rows.length.toLocaleString('pt-BR') + ' dispositivos';

    if (!visibleCount) {
      var noIssues = state.rows.length && !hasAnyFilter() && activeTotal === 0;
      els.list.innerHTML = noIssues
        ? '<div class="ipv2-state"><strong>Nenhum dispositivo ativo</strong></div>'
        : '<div class="ipv2-state"><strong>Nenhum dispositivo com esses filtros</strong>' +
          '<button class="ipv2-btn" type="button" data-action="clear-filters" style="margin-top:12px">Limpar tudo</button></div>';
      return;
    }

    var budget = state.renderLimit;
    var html = '';
    groups.forEach(function (g) {
      var grouped = state.groupBy !== 'none';
      var collapsed = grouped && isCollapsed(g);
      if (grouped) {
        html +=
          '<section class="ipv2-group"><button class="ipv2-group-head" type="button" data-action="toggle-group" data-key="' + esc(g.key) + '"' +
          ' aria-expanded="' + !collapsed + '">' + (collapsed ? '▶' : '▼') + ' ' + esc(groupTitle(g.key)) +
          ' <span class="ipv2-group-count">(' + g.rows.length.toLocaleString('pt-BR') + ')</span></button>';
      }
      if (!collapsed) {
        for (var i = 0; i < g.rows.length && budget > 0; i++, budget--) html += rowHtml(g.rows[i]);
      }
      if (grouped) html += '</section>';
    });
    if (budget <= 0) {
      html += '<button class="ipv2-btn ipv2-more" type="button" data-action="load-more">Mostrar mais</button>';
    }
    els.list.innerHTML = html;
  }

  function isCollapsed(group) {
    if (Object.prototype.hasOwnProperty.call(state.collapsed, group.key)) return state.collapsed[group.key];
    if (group.key === inv.NO_CUSTOMER_KEY) return false;
    return group.rows.length > IPV2_COLLAPSE_GROUPS_ABOVE;
  }

  function hasAnyFilter() {
    return inv.summarizeFilters(state.filters).some(function (pair) {
      return pair[0] !== 'Ciclo de vida';
    });
  }

  // ---------- Painel (RFC-0237, AC-15) ----------
  function cloneFilters(f) {
    return {
      customers: new Set(f.customers),
      domains: new Set(f.domains),
      profiles: new Set(f.profiles),
      cadastro: new Set(f.cadastro),
      atividade: new Set(f.atividade),
      rules: new Set(f.rules),
      lifecycle: new Set(f.lifecycle),
      text: f.text,
    };
  }

  /** Rows the Painel summarizes: the list filters, but stock/archived kept so they can be counted as excluded. */
  function dashboardRows() {
    var f = state.filters;
    if (isDefaultLifecycle()) {
      f = cloneFilters(f);
      f.lifecycle.clear();
    }
    return inv.applyFilters(state.rows, f);
  }

  function destroyCharts() {
    charts.forEach(function (c) {
      try {
        c.destroy();
      } catch (e) {
        log('chart destroy failed', e);
      }
    });
    charts = [];
  }

  /** Applies a Painel click as a filter and opens the list. */
  function applyDashFilter(kind, a, b) {
    var f = state.filters;
    if (kind === 'total') {
      f.cadastro.clear();
      f.atividade.clear();
    } else if (kind === 'cadastro' || kind === 'atividade') {
      f[kind] = new Set([a]);
    } else if (kind === 'excluded') {
      f.lifecycle = new Set(['stock', 'archived']);
      f.cadastro.clear();
      f.atividade.clear();
    } else if (kind === 'customer') {
      f.customers = new Set([a]);
    } else if (kind === 'rule') {
      f.rules = new Set([a]);
    } else if (kind === 'cell') {
      f.customers = new Set([a]);
      f.rules = new Set([b]);
    }
    state.tab = 'list';
    state.renderLimit = IPV2_RENDER_BATCH;
    renderAll();
  }

  function dashCard(kind, value, cls, label, count) {
    return (
      '<button class="ipv2-card ' + cls + '" type="button" data-action="dash-filter" data-kind="' + kind + '" data-a="' + esc(value) + '">' +
      '<small>' + esc(label) + '</small><strong>' + count.toLocaleString('pt-BR') + '</strong></button>'
    );
  }

  function renderDashboard() {
    destroyCharts();
    if (state.loading || state.error || !state.rows.length) {
      els.dashboard.innerHTML =
        '<div class="ipv2-state"><strong>' +
        (state.error ? 'Não foi possível carregar o inventário' : 'Carregando dispositivos…') + '</strong></div>';
      return;
    }
    var d = inv.buildDashboardSummary(dashboardRows(), { topCustomers: 10, matrixCustomers: 15 });
    els.count.textContent =
      'Painel de ' + d.inIndicators.toLocaleString('pt-BR') + ' dispositivos nos indicadores (' + d.total.toLocaleString('pt-BR') + ' no filtro)';

    var cards =
      '<div class="ipv2-cards">' +
      dashCard('total', '', '', 'Total nos indicadores', d.inIndicators) +
      dashCard('cadastro', 'ok', 'ok', 'Cadastro íntegro', d.cadastro.ok) +
      dashCard('cadastro', 'pending', 'pending', 'Cadastro pendente', d.cadastro.pending) +
      dashCard('cadastro', 'critical', 'critical', 'Cadastro crítico', d.cadastro.critical) +
      (d.cadastro.partial ? dashCard('cadastro', 'partial', '', 'Avaliação parcial', d.cadastro.partial) : '') +
      dashCard('atividade', 'ok', 'ok', 'Reportando', d.atividade.ok) +
      dashCard('atividade', 'inactive', 'inactive', 'Sem atividade', d.atividade.inactive) +
      (d.atividade.nodata ? dashCard('atividade', 'nodata', '', 'Sem dado de atividade', d.atividade.nodata) : '') +
      dashCard('excluded', '', '', 'Fora dos indicadores', d.excluded.stock + d.excluded.archived) +
      '</div>';

    var matrix = '';
    if (d.matrix.customers.length) {
      matrix =
        '<table class="ipv2-matrix"><thead><tr><th>Cliente</th>' +
        d.matrix.rules
          .map(function (id) {
            var rule = inv.getInventoryRule(id);
            return '<th title="' + esc(rule ? rule.description : id) + '">' + esc(rule ? rule.label : id) + '</th>';
          })
          .join('') +
        '</tr></thead><tbody>' +
        d.matrix.customers
          .map(function (c, i) {
            return (
              '<tr><td title="' + esc(inv.customerKeyLabel(c)) + '">' + esc(inv.customerKeyLabel(c)) + '</td>' +
              d.matrix.cells[i]
                .map(function (n, j) {
                  return n
                    ? '<td class="hot"><button type="button" data-action="dash-filter" data-kind="cell" data-a="' + esc(c) +
                        '" data-b="' + esc(d.matrix.rules[j]) + '">' + n.toLocaleString('pt-BR') + '</button></td>'
                    : '<td>—</td>';
                })
                .join('') +
              '</tr>'
            );
          })
          .join('') +
        '</tbody></table>';
    }

    els.dashboard.innerHTML =
      cards +
      '<div class="ipv2-dash-grid">' +
      '<div class="ipv2-box"><h3>Cadastro</h3><div class="ipv2-chart"><canvas data-chart="cadastro"></canvas></div></div>' +
      '<div class="ipv2-box"><h3>Atividade</h3><div class="ipv2-chart"><canvas data-chart="atividade"></canvas></div></div>' +
      '<div class="ipv2-box"><h3>Clientes com mais problemas de cadastro</h3>' +
      (d.topCustomers.length ? '<div class="ipv2-chart"><canvas data-chart="customers"></canvas></div>' : '<div class="ipv2-empty">Nenhum cliente com pendências</div>') +
      '</div>' +
      '<div class="ipv2-box"><h3>Regras que mais falham</h3>' +
      (d.topRules.length ? '<div class="ipv2-chart"><canvas data-chart="rules"></canvas></div>' : '<div class="ipv2-empty">Nenhuma regra falhando</div>') +
      '</div>' +
      '</div>' +
      '<div class="ipv2-box" style="margin-top:12px"><h3>Matriz cliente × regra</h3>' +
      (matrix || '<div class="ipv2-empty">Nenhuma falha no filtro atual</div>') +
      '</div>';

    var token = generation + ':' + Date.now();
    els.dashboard.setAttribute('data-render', token);
    ipv2LoadChartJs().then(function (Chart) {
      if (destroyed || state.tab !== 'dashboard' || els.dashboard.getAttribute('data-render') !== token) return;
      if (!Chart) {
        els.dashboard.querySelectorAll('.ipv2-chart').forEach(function (el) {
          el.innerHTML = '<div class="ipv2-empty">Gráfico indisponível (Chart.js não carregou)</div>';
        });
        return;
      }
      drawCharts(Chart, d);
    });
  }

  function drawCharts(Chart, d) {
    var css = window.getComputedStyle(els.app);
    var color = function (name) {
      return css.getPropertyValue(name).trim();
    };
    var ok = color('--ip-ok'), pending = color('--ip-pending'), critical = color('--ip-critical'), unknown = color('--ip-unknown');
    var canvas = function (name) {
      return els.dashboard.querySelector('[data-chart="' + name + '"]');
    };
    var make = function (el, config) {
      if (el) charts.push(new Chart(el, config));
    };
    var clickIndex = function (handler) {
      return function (evt, elements) {
        if (elements && elements.length) handler(elements[0].index);
      };
    };
    var common = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };

    var cadKeys = ['ok', 'pending', 'critical', 'partial'];
    make(canvas('cadastro'), {
      type: 'doughnut',
      data: {
        labels: cadKeys.map(function (k) {
          return inv.CADASTRO_LABELS[k];
        }),
        datasets: [{ data: cadKeys.map(function (k) { return d.cadastro[k]; }), backgroundColor: [ok, pending, critical, unknown] }],
      },
      options: Object.assign({}, common, { onClick: clickIndex(function (i) { applyDashFilter('cadastro', cadKeys[i]); }) }),
    });

    var atvKeys = ['ok', 'inactive', 'nodata'];
    make(canvas('atividade'), {
      type: 'doughnut',
      data: {
        labels: atvKeys.map(function (k) {
          return inv.ATIVIDADE_LABELS[k];
        }),
        datasets: [{ data: atvKeys.map(function (k) { return d.atividade[k]; }), backgroundColor: [ok, critical, unknown] }],
      },
      options: Object.assign({}, common, { onClick: clickIndex(function (i) { applyDashFilter('atividade', atvKeys[i]); }) }),
    });

    make(canvas('customers'), {
      type: 'bar',
      data: {
        labels: d.topCustomers.map(function (c) {
          return inv.customerKeyLabel(c.key);
        }),
        datasets: [
          { label: 'Crítico', data: d.topCustomers.map(function (c) { return c.critical; }), backgroundColor: critical },
          { label: 'Pendente', data: d.topCustomers.map(function (c) { return c.pending; }), backgroundColor: pending },
        ],
      },
      options: Object.assign({}, common, {
        indexAxis: 'y',
        scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true } },
        onClick: clickIndex(function (i) { applyDashFilter('customer', d.topCustomers[i].key); }),
      }),
    });

    make(canvas('rules'), {
      type: 'bar',
      data: {
        labels: d.topRules.map(function (r) {
          return r.label;
        }),
        datasets: [{ label: 'Dispositivos', data: d.topRules.map(function (r) { return r.count; }), backgroundColor: color('--ip-accent') }],
      },
      options: Object.assign({}, common, {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { precision: 0 } } },
        onClick: clickIndex(function (i) { applyDashFilter('rule', d.topRules[i].id); }),
      }),
    });
  }

  // ---------- events ----------
  function onClick(ev) {
    var el = ev.target.closest('[data-action]');
    // Any click outside the open dropdown (and its toggle) closes it.
    if (state.openDim && !ev.target.closest('[data-region="pop"]') && !(el && el.getAttribute('data-action') === 'open-dim')) {
      closePop();
    }
    if (els.exportMenu && !els.exportMenu.hidden && !ev.target.closest('.ipv2-export')) setExportMenu(false);
    if (!el || !els.app.contains(el)) return;
    var action = el.getAttribute('data-action');

    if (action === 'export-menu') return setExportMenu(els.exportMenu.hidden);
    if (action === 'export') return runExport(el.getAttribute('data-format'));

    if (action === 'open-dim') {
      var dimToOpen = el.getAttribute('data-dim');
      state.openDim = state.openDim === dimToOpen ? null : dimToOpen;
      state.dimSearch = '';
      els.pop.innerHTML = '';
      renderDims();
      renderPop();
      var input = els.pop.querySelector('[data-role="dim-search"]');
      if (input) input.focus();
      return;
    }
    if (action === 'clear-dim') {
      var dimToClear = el.getAttribute('data-dim');
      state.filters[dimToClear] = dimToClear === 'lifecycle' ? new Set(['active']) : new Set();
      state.renderLimit = IPV2_RENDER_BATCH;
      return renderFiltered();
    }
    if (action === 'clear-text') {
      state.filters.text = '';
      els.search.value = '';
      return renderFiltered();
    }
    if (action === 'tab') {
      state.tab = el.getAttribute('data-tab');
      closePop();
      renderTabs();
      return renderContent();
    }
    if (action === 'dash-filter') {
      return applyDashFilter(el.getAttribute('data-kind'), el.getAttribute('data-a'), el.getAttribute('data-b'));
    }
    if (action === 'copy-name') {
      ev.stopPropagation(); // copying must never open the device (row click)
      copyName(el);
      return;
    }
    if (action === 'kpi-help') return showHelp(el); // touch / keyboard (hover is handled by onHelpOver)
    if (action === 'refresh') return load(true);
    if (action === 'retry') return load(false);
    if (action === 'clear-filters') {
      state.filters = inv.createEmptyFilters();
      els.search.value = '';
      state.renderLimit = IPV2_RENDER_BATCH;
      return renderAll();
    }
    if (action === 'toggle-filter') {
      var dim = el.getAttribute('data-dim');
      var value = el.getAttribute('data-value');
      var set = state.filters[dim];
      if (set.has(value)) set.delete(value);
      else set.add(value);
      state.renderLimit = IPV2_RENDER_BATCH;
      return renderFiltered();
    }
    if (action === 'toggle-group') {
      var key = el.getAttribute('data-key');
      var group = inv
        .getVisibleGroups(state.rows, state.filters, state.sort, state.groupBy)
        .filter(function (g) {
          return g.key === key;
        })[0];
      state.collapsed[key] = group ? !isCollapsed(group) : false;
      return renderList();
    }
    if (action === 'load-more') {
      state.renderLimit += IPV2_RENDER_BATCH;
      return renderList();
    }
    if (action === 'open-device') {
      if (!settings.enableNavigation || !ctx.stateController) return;
      ctx.stateController.openState('device', { id: el.getAttribute('data-id'), entityType: 'DEVICE' });
    }
  }

  function copyName(button) {
    var name = button.getAttribute('data-name') || '';
    var done = function (ok) {
      button.textContent = ok ? '✓' : '✗';
      timers.push(
        setTimeout(function () {
          button.textContent = '⧉';
        }, 1500)
      );
      if (!ok && lib.MyIOToast && lib.MyIOToast.error) lib.MyIOToast.error('Não foi possível copiar');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(name).then(
        function () {
          done(true);
        },
        function () {
          done(false);
        }
      );
    } else {
      done(false);
    }
  }

  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.filters.text = els.search.value;
      state.renderLimit = IPV2_RENDER_BATCH;
      // Only the data regions — the search input keeps its value and focus.
      renderFiltered();
    }, IPV2_SEARCH_DEBOUNCE_MS);
  }

  /** Search box inside a dropdown (Cliente / Perfil): filters the options only. */
  function onPopInput(ev) {
    if (!ev.target.matches || !ev.target.matches('[data-role="dim-search"]')) return;
    state.dimSearch = ev.target.value;
    renderPop();
  }

  function onKeydown(ev) {
    if (ev.key === 'Escape' && els.exportMenu && !els.exportMenu.hidden) {
      setExportMenu(false);
      els.exportBtn.focus();
      return;
    }
    if (ev.key === 'Escape' && state.openDim) {
      closePop();
      var toggle = els.dims.querySelector('[data-dim]');
      if (toggle) toggle.focus();
    }
  }

  function onSelectChange() {
    state.groupBy = els.groupBy.value;
    state.sort = els.sort.value;
    state.renderLimit = IPV2_RENDER_BATCH;
    if (state.tab === 'list') renderList();
  }

  // ---------- lifecycle ----------
  return {
    start: function () {
      if (!root) return;
      if (!inv || typeof inv.buildInventoryRows !== 'function') {
        root.innerHTML =
          '<div style="padding:24px;font-family:sans-serif;color:#991b1b">MyIOLibrary.inventory não está disponível — ' +
          'verifique se a biblioteca myio-js-library (≥ versão com RFC-0237) está nos recursos do widget.</div>';
        return;
      }
      state.filters = inv.createEmptyFilters();
      shell();
      load(false);
      var interval = Number(settings.refreshInterval) || 0;
      if (interval > 0) {
        refreshTimer = setInterval(function () {
          load(true);
        }, interval * 1000);
      }
    },
    destroy: function () {
      destroyed = true;
      generation++; // late responses are dropped
      clearInterval(refreshTimer);
      clearTimeout(searchTimer);
      timers.forEach(clearTimeout);
      if (els.app) {
        els.app.removeEventListener('click', onClick);
        els.search.removeEventListener('input', onSearchInput);
        els.groupBy.removeEventListener('change', onSelectChange);
        els.sort.removeEventListener('change', onSelectChange);
        els.app.removeEventListener('input', onPopInput);
        els.app.removeEventListener('keydown', onKeydown);
        els.app.removeEventListener('mouseover', onHelpOver);
        els.app.removeEventListener('mouseout', onHelpOut);
      }
      if (lib.InfoTooltip && lib.InfoTooltip.hide) lib.InfoTooltip.hide();
      destroyCharts();
      if (root) root.innerHTML = '';
      els = {};
    },
    // Exposed for the showcase / debugging only.
    _state: state,
    refresh: function () {
      load(true);
    },
  };
}

self.onInit = function () {
  self.__inventoryApp = createInventoryApp(self.ctx);
  self.__inventoryApp.start();
};

self.onDataUpdated = function () {
  // No datasource: the widget loads its own data through entitiesQuery.
};

self.onResize = function () {};

self.onDestroy = function () {
  if (self.__inventoryApp) self.__inventoryApp.destroy();
  self.__inventoryApp = null;
};
