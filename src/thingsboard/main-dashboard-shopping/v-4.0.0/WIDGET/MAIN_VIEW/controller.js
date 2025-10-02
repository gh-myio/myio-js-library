/*********************************************************
 * MYIO – Container 2 states (menu/content)
 * - Ajusta alturas automaticamente
 * - Suporta "menu compacto" via evento global
 * - Mantém simples: os tb-dashboard-state renderizam os
 * dashboards configurados no próprio ThingsBoard.
 *********************************************************/

let globalStartDateFilter = null; // ISO ex.: '2025-09-01T00:00:00-03:00'
let globalEndDateFilter   = null; // ISO ex.: '2025-09-30T23:59:59-03:00'

(function () {
  // Utilitários DOM
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  let rootEl;

  // Atualiza a altura útil do conteúdo e garante que os elementos estão bem posicionados
  function applySizing() {
    try {
      const sidebarW = getCssVar('--sidebar-w');

      // Força recálculo do layout se necessário
      if (rootEl) {
        rootEl.style.display = 'grid';

        // Garante que os tb-child elementos não tenham overflow issues
        const tbChildren = $$('.tb-child', rootEl);
        tbChildren.forEach(child => {
          child.style.overflow = 'hidden';
          child.style.width = '100%';
          child.style.height = '100%';
        });

        // Especial tratamento para o conteúdo principal
        const content = $('.myio-content', rootEl);
        if (content) {
          const contentChild = $('.tb-child', content);
          if (contentChild) {
            contentChild.style.overflow = 'visible';
            contentChild.style.minHeight = '100%';
          }
        }
      }
    } catch (e) {
      console.warn('[myio-container] sizing warn:', e);
    }
  }

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '0px';
  }

  // Alterna o modo "menu compacto" acrescentando/removendo classe no root
  function setMenuCompact(compact) {
    if (!rootEl) return;
    rootEl.classList.toggle('menu-compact', !!compact);

    // Força recálculo após mudança de modo
    setTimeout(() => {
      applySizing();
    }, 50);
  }

  // Exponha dois eventos globais simples (opcionais):
  // window.dispatchEvent(new CustomEvent('myio:menu-compact', { detail: { compact: true } }))
  // window.dispatchEvent(new CustomEvent('myio:menu-expand'))
  function registerGlobalEvents() {
    on(window, 'myio:menu-compact', (ev) => {
      setMenuCompact(ev?.detail?.compact ?? true);
    });
    on(window, 'myio:menu-expand', () => {
      setMenuCompact(false);
    });

    // Adiciona suporte para toggle via evento
    on(window, 'myio:menu-toggle', () => {
      const isCompact = rootEl?.classList.contains('menu-compact');
      setMenuCompact(!isCompact);
    });
  }

  // Detecta mudanças de viewport para aplicar sizing
  function setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined' && rootEl) {
      const resizeObserver = new ResizeObserver(() => {
        applySizing();
      });
      resizeObserver.observe(rootEl);
    }
  }

  // ThingsBoard lifecycle
  self.onInit = function () {

    rootEl = $('#myio-root');
    registerGlobalEvents();
    setupResizeObserver();

    // Log útil para conferir se os states existem
    try {
      const states = (ctx?.dashboard?.configuration?.states) || {};
     // console.log('[myio-container] states disponíveis:', Object.keys(states));
      // Esperados: "menu", "telemetry_content"
    } catch (e) {
      console.warn('[myio-container] não foi possível listar states:', e);
    }
  };

  self.onResize = function () {
    applySizing();
  };

  self.onDataUpdated = function () {
    // Normalmente não é necessário aqui, pois cada state cuida do próprio dado.
    // Mas podemos garantir que o layout está correto
    setTimeout(() => {
      applySizing();
    }, 50);
  };

  self.onDestroy = function () {
    // Limpa event listeners se necessário
    if (typeof window !== 'undefined') {
      // Remove custom event listeners se foram adicionados
    }

    // Destroy orchestrator
    if (window.MyIOOrchestrator) {
      window.MyIOOrchestrator.destroy();
    }
  };
})();

// ========== RFC-0042: ORCHESTRATOR IMPLEMENTATION ==========

/**
 * @typedef {'hour'|'day'|'month'} Granularity
 * @typedef {'energy'|'water'|'temperature'} Domain
 * @typedef {'entry_meters'|'common_area'|'stores'|'substation'} GroupType
 */

/**
 * @typedef {Object} Period
 * @property {string} startISO - ISO 8601 with timezone
 * @property {string} endISO - ISO 8601 with timezone
 * @property {Granularity} granularity - Data aggregation level
 * @property {string} tz - IANA timezone
 */

/**
 * @typedef {Object} EnrichedItem
 * @property {string} id - ThingsBoard entityId (single source of truth)
 * @property {string} tbId - ThingsBoard deviceId
 * @property {string} ingestionId - Data Ingestion API UUID
 * @property {string} identifier - Human-readable ID
 * @property {string} label - Display name
 * @property {GroupType} groupType - Device category
 * @property {number} value - Consumption total
 * @property {number} perc - Percentage of group total
 * @property {string|null} slaveId - Modbus slave ID
 * @property {string|null} centralId - Central unit ID
 * @property {string} deviceType - Device type
 */

// ========== UTILITIES ==========

/**
 * Converts Date/timestamp to ISO with São Paulo timezone.
 * Handles DST transitions (BRT = -03:00, BRST = -02:00).
 */
function toISO(dt, tz = 'America/Sao_Paulo') {
  const d = (typeof dt === 'number') ? new Date(dt)
          : (dt instanceof Date) ? dt
          : new Date(String(dt));

  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');

  // Detect offset (BRT = -03:00, BRST = -02:00 during DST)
  const offset = -d.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMins = Math.abs(offset) % 60;
  const offsetStr = `${offset >= 0 ? '+' : '-'}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetStr}`;
}

/**
 * Calculates granularity based on date range duration.
 */
function calcGranularity(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const diffDays = (end - start) / (1000 * 60 * 60 * 24);

  if (diffDays > 92) return 'month';
  if (diffDays > 3) return 'day';
  return 'hour';
}

/**
 * Generates cache key from domain and period.
 */
function cacheKey(domain, period) {
  return `${domain}:${period.startISO}:${period.endISO}:${period.granularity}`;
}

/**
 * Normalizes ingestion API response.
 */
function normalizeIngestionRow(row) {
  return {
    id: row.id || row.tbId || row.deviceId,
    total_value: Number(row.total_value ?? row.totalValue ?? 0)
  };
}

/**
 * Validates UUID format.
 */
function isValidUUID(v) {
  if (!v || typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ========== ORCHESTRATOR SINGLETON ==========

const MyIOOrchestrator = (() => {
  const DATA_API_HOST = "https://api.data.apps.myio-bas.com";

  // State
  const memCache = new Map();
  const inFlight = new Map();
  const abortControllers = new Map();

  const config = {
    ttlMinutes: 5,
    enableStaleWhileRevalidate: true,
    maxCacheSize: 50,
    debugMode: false,
    domainsEnabled: { energy: true, water: true, temperature: true }
  };

  let visibleTab = 'energy';
  let currentPeriod = null;
  let CUSTOMER_ING_ID = '';
  let CLIENT_ID = '';
  let CLIENT_SECRET = '';

  // Metrics
  const metrics = {
    hydrationTimes: [],
    cacheHitRatio: 0,
    totalRequests: 0,
    cacheHits: 0,
    errorCounts: {},

    recordHydration(domain, duration, fromCache) {
      this.hydrationTimes.push({ domain, duration, fromCache, timestamp: Date.now() });
      this.totalRequests++;
      if (fromCache) this.cacheHits++;
      this.cacheHitRatio = this.totalRequests > 0 ? (this.cacheHits / this.totalRequests) * 100 : 0;

      if (config.debugMode) {
        console.log(`[Orchestrator] ${domain} hydration: ${duration}ms (${fromCache ? 'cache' : 'fresh'})`);
      }
    },

    recordError(domain, error) {
      this.errorCounts[domain] = (this.errorCounts[domain] || 0) + 1;
      console.error(`[Orchestrator] ${domain} error:`, error);
    },

    generateTelemetrySummary() {
      const sum = this.hydrationTimes.reduce((acc, h) => acc + h.duration, 0);
      const avg = this.hydrationTimes.length > 0 ? Math.round(sum / this.hydrationTimes.length) : 0;

      return {
        orchestrator_cache_hit_ratio: this.cacheHitRatio,
        orchestrator_total_requests: this.totalRequests,
        orchestrator_cache_hits: this.cacheHits,
        orchestrator_avg_hydration_ms: avg,
        orchestrator_errors_total: Object.values(this.errorCounts).reduce((a, b) => a + b, 0),
        orchestrator_memory_mb: (memCache.size * 2) / 1024
      };
    }
  };

  // Cache operations
  function readCache(key) {
    const entry = memCache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.hydratedAt;
    const fresh = age < entry.ttlMinutes * 60_000;

    return { ...entry, fresh };
  }

  function writeCache(key, data) {
    if (memCache.has(key)) memCache.delete(key);

    memCache.set(key, {
      data,
      hydratedAt: Date.now(),
      ttlMinutes: config.ttlMinutes
    });

    while (memCache.size > config.maxCacheSize) {
      const oldestKey = memCache.keys().next().value;
      memCache.delete(oldestKey);
      if (config.debugMode) console.log(`[Orchestrator] Evicted cache key: ${oldestKey}`);
    }

    persistToStorage(key, memCache.get(key));
  }

  function persistToStorage(key, entry) {
    try {
      const payload = JSON.stringify({ [key]: entry });
      if (payload.length > 5 * 1024 * 1024) {
        console.warn('[Orchestrator] Payload too large for localStorage');
        return;
      }
      localStorage.setItem(`myio:cache:${key}`, payload);
    } catch (e) {
      console.warn('[Orchestrator] localStorage persist failed:', e);
    }
  }

  function invalidateCache(domain = '*') {
    if (domain === '*') {
      memCache.clear();
      abortAllInflight();
      clearStorageCache();
    } else {
      for (const [key, _] of memCache.entries()) {
        if (key.startsWith(`${domain}:`)) {
          memCache.delete(key);
          abortInflight(key);
        }
      }
    }

    if (config.debugMode) console.log(`[Orchestrator] Cache invalidated: ${domain}`);
  }

  function abortInflight(key) {
    const ac = abortControllers.get(key);
    if (ac) {
      ac.abort();
      abortControllers.delete(key);
    }
  }

  function abortAllInflight() {
    for (const [key, ac] of abortControllers.entries()) {
      ac.abort();
    }
    abortControllers.clear();
    inFlight.clear();
  }

  function clearStorageCache(domain) {
    const prefix = domain ? `myio:cache:${domain}:` : 'myio:cache:';
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  }

  // Data fetching
  async function fetchApiTotals(domain, period) {
    const key = cacheKey(domain, period);

    abortInflight(key);

    const ac = new AbortController();
    abortControllers.set(key, ac);

    try {
      const token = await tokenManager.getToken('ingestionToken');
      if (!token) throw new Error('No ingestion token');

      const url = new URL(`${DATA_API_HOST}/api/v1/telemetry/customers/${CUSTOMER_ING_ID}/${domain}/devices/totals`);
      url.searchParams.set('startTime', period.startISO);
      url.searchParams.set('endTime', period.endISO);
      url.searchParams.set('deep', '1');

      const res = await fetch(url.toString(), {
        signal: ac.signal,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          emitTokenExpired();
        }
        throw new Error(`API error: ${res.status}`);
      }

      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json?.data ?? []);

      const map = new Map();
      for (const r of rows) {
        if (r && r.id) {
          const normalized = normalizeIngestionRow(r);
          map.set(String(normalized.id), normalized);
        }
      }

      return map;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`[Orchestrator] Fetch aborted: ${key}`);
        return new Map();
      }
      throw err;
    } finally {
      abortControllers.delete(key);
    }
  }

  async function fetchAndEnrich(domain, period) {
    // This will be populated by TELEMETRY widget logic
    // For now, return empty array
    console.warn('[Orchestrator] fetchAndEnrich not yet fully implemented');
    return [];
  }

  async function hydrateDomain(domain, period) {
    const key = cacheKey(domain, period);
    const startTime = Date.now();

    if (inFlight.has(key)) {
      if (config.debugMode) console.log(`[Orchestrator] Coalescing request for ${key}`);
      return inFlight.get(key);
    }

    const cached = readCache(key);

    if (cached) {
      emitProvide(domain, key, cached.data);
      metrics.recordHydration(domain, Date.now() - startTime, true);

      if (cached.fresh) {
        return;
      }
    }

    const fetchPromise = (async () => {
      try {
        const items = await fetchAndEnrich(domain, period);

        writeCache(key, items);

        emitHydrated(domain, key, items.length);
        emitProvide(domain, key, items);

        const duration = Date.now() - startTime;
        metrics.recordHydration(domain, duration, false);

        return items;
      } catch (error) {
        metrics.recordError(domain, error);
        emitError(domain, error);
        throw error;
      }
    })()
      .finally(() => inFlight.delete(key));

    inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  // Event emitters
  function emitProvide(domain, periodKey, items) {
    window.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', {
      detail: { domain, periodKey, items }
    }));
  }

  function emitHydrated(domain, periodKey, count) {
    window.dispatchEvent(new CustomEvent('myio:orchestrator:cache-hydrated', {
      detail: { domain, periodKey, count }
    }));
  }

  function emitError(domain, error) {
    window.dispatchEvent(new CustomEvent('myio:orchestrator:error', {
      detail: {
        domain,
        error: error.message || String(error),
        code: error.status || 500
      }
    }));
  }

  let tokenExpiredDebounce = 0;
  function emitTokenExpired() {
    const now = Date.now();
    if (now - tokenExpiredDebounce < 60_000) return;

    tokenExpiredDebounce = now;
    window.dispatchEvent(new CustomEvent('myio:token-expired', { detail: {} }));
  }

  // Token manager
  const tokenManager = {
    tokens: {},

    updateTokens(newTokens) {
      this.tokens = { ...this.tokens, ...newTokens };

      invalidateCache('*');

      window.dispatchEvent(new CustomEvent('myio:token-rotated', { detail: {} }));

      if (config.debugMode) console.log('[Orchestrator] Tokens rotated');
    },

    getToken(type) {
      return this.tokens[type] || null;
    },

    setToken(type, value) {
      this.tokens[type] = value;
    }
  };

  // Event listeners
  window.addEventListener('myio:update-date', (ev) => {
    currentPeriod = ev.detail.period;
    if (visibleTab && currentPeriod) {
      hydrateDomain(visibleTab, currentPeriod);
    }
  });

  window.addEventListener('myio:dashboard-state', (ev) => {
    visibleTab = ev.detail.tab;
    if (visibleTab && currentPeriod) {
      hydrateDomain(visibleTab, currentPeriod);
    }
  });

  window.addEventListener('myio:telemetry:request-data', (ev) => {
    const { domain, period } = ev.detail;
    const p = period || currentPeriod;
    if (p) {
      hydrateDomain(domain, p);
    }
  });

  // Cleanup interval
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memCache.entries()) {
      const age = now - entry.hydratedAt;
      if (age > entry.ttlMinutes * 60_000 * 2) {
        memCache.delete(key);
      }
    }
  }, 10 * 60 * 1000);

  // Telemetry reporting
  if (!config.debugMode && typeof window.tbClient !== 'undefined') {
    setInterval(() => {
      try {
        window.tbClient.sendTelemetry(metrics.generateTelemetrySummary());
      } catch (e) {
        console.warn('[Orchestrator] Failed to send telemetry:', e);
      }
    }, 5 * 60 * 1000);
  }

  // Public API
  return {
    hydrateDomain,
    setVisibleTab: (tab) => { visibleTab = tab; },
    getVisibleTab: () => visibleTab,
    getCurrentPeriod: () => currentPeriod,
    invalidateCache,
    getCacheStats: () => ({
      hitRate: metrics.cacheHitRatio,
      totalRequests: metrics.totalRequests,
      cacheSize: memCache.size,
      inFlightCount: inFlight.size
    }),
    tokenManager,
    metrics,
    config,
    memCache,

    setCredentials: (customerId, clientId, clientSecret) => {
      CUSTOMER_ING_ID = customerId;
      CLIENT_ID = clientId;
      CLIENT_SECRET = clientSecret;
    },

    destroy: () => {
      clearInterval(cleanupInterval);
      invalidateCache('*');
    }
  };
})();

// Expose globally
window.MyIOOrchestrator = MyIOOrchestrator;

console.log('[MyIOOrchestrator] Initialized');