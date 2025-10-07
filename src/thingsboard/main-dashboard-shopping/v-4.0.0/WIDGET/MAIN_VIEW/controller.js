/*********************************************************
 * MYIO – Container 2 states (menu/content)
 * - Ajusta alturas automaticamente
 * - Suporta "menu compacto" via evento global
 * - Mantém simples: os tb-dashboard-state renderizam os
 * dashboards configurados no próprio ThingsBoard.
 *********************************************************/

// Debug configuration
const DEBUG_ACTIVE = true;

// LogHelper utility
const LogHelper = {
  log: function(...args) {
    if (DEBUG_ACTIVE) {
      console.log(...args);
    }
  },
  warn: function(...args) {
    if (DEBUG_ACTIVE) {
      console.warn(...args);
    }
  },
  error: function(...args) {
    if (DEBUG_ACTIVE) {
      console.error(...args);
    }
  }
};

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
      LogHelper.warn('[myio-container] sizing warn:', e);
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
  self.onInit = async function () {

    rootEl = $('#myio-root');
    registerGlobalEvents();
    setupResizeObserver();

    // Initialize MyIO Library and Authentication
    const MyIO = (typeof MyIOLibrary !== "undefined" && MyIOLibrary)
         || (typeof window !== "undefined" && window.MyIOLibrary)
         || null;

    if (MyIO) {
      try {
        // Get credentials from settings
        const customerTB_ID = self.ctx.settings?.customerTB_ID || "";
        const jwt = localStorage.getItem("jwt_token");

        let CLIENT_ID = "";
        let CLIENT_SECRET = "";
        let CUSTOMER_ING_ID = "";

        if (customerTB_ID && jwt) {
          try {
            // Fetch customer attributes
            const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
            CLIENT_ID = attrs?.client_id || "";
            CLIENT_SECRET = attrs?.client_secret || "";
            CUSTOMER_ING_ID = attrs?.ingestionId || "";
          } catch (err) {
            LogHelper.warn("[MAIN_VIEW] Failed to fetch customer attributes:", err);
          }
        }

        // Fallback credentials if not found
        if (!CLIENT_ID || !CLIENT_SECRET) {
          LogHelper.log("[MAIN_VIEW] Using fallback credentials");
          CLIENT_ID = "mestreal_mfh4e642_4flnuh";
          CLIENT_SECRET = "gv0zfmdekNxYA296OcqFrnBAVU4PhbUBhBwNlMCamk2oXDHeXJqu1K6YtpVOZ5da";
          CUSTOMER_ING_ID = "e01bdd22-3be6-4b75-9dae-442c8b8c186e"; // Valid customer ID
        }

        // Set credentials in orchestrator
        MyIOOrchestrator.setCredentials(CUSTOMER_ING_ID, CLIENT_ID, CLIENT_SECRET);

        // Build auth and get token
        const myIOAuth = MyIO.buildMyioIngestionAuth({
          dataApiHost: "https://api.data.apps.myio-bas.com",
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET
        });

        // Get token and set it in token manager
        const ingestionToken = await myIOAuth.getToken();
        MyIOOrchestrator.tokenManager.setToken('ingestionToken', ingestionToken);

        LogHelper.log("[MAIN_VIEW] Auth initialized successfully with CLIENT_ID:", CLIENT_ID);
      } catch (err) {
        LogHelper.error("[MAIN_VIEW] Auth initialization failed:", err);
      }
    } else {
      LogHelper.warn("[MAIN_VIEW] MyIOLibrary not available");
    }

    // Log útil para conferir se os states existem
    try {
      const states = (ctx?.dashboard?.configuration?.states) || {};
     // LogHelper.log('[myio-container] states disponíveis:', Object.keys(states));
      // Esperados: "menu", "telemetry_content", "water_content", "temperature_content", "alarm_content", "footer"
    } catch (e) {
      LogHelper.warn('[myio-container] não foi possível listar states:', e);
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
        LogHelper.log(`[Orchestrator] ${domain} hydration: ${duration}ms (${fromCache ? 'cache' : 'fresh'})`);
      }
    },

    recordError(domain, error) {
      this.errorCounts[domain] = (this.errorCounts[domain] || 0) + 1;
      LogHelper.error(`[Orchestrator] ${domain} error:`, error);
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
      if (config.debugMode) LogHelper.log(`[Orchestrator] Evicted cache key: ${oldestKey}`);
    }

    persistToStorage(key, memCache.get(key));
  }

  function persistToStorage(key, entry) {
    try {
      const payload = JSON.stringify({ [key]: entry });
      if (payload.length > 5 * 1024 * 1024) {
        LogHelper.warn('[Orchestrator] Payload too large for localStorage');
        return;
      }
      localStorage.setItem(`myio:cache:${key}`, payload);
    } catch (e) {
      LogHelper.warn('[Orchestrator] localStorage persist failed:', e);
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

    if (config.debugMode) LogHelper.log(`[Orchestrator] Cache invalidated: ${domain}`);
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
        LogHelper.log(`[Orchestrator] Fetch aborted: ${key}`);
        return new Map();
      }
      throw err;
    } finally {
      abortControllers.delete(key);
    }
  }

  async function fetchAndEnrich(domain, period) {
    try {
      // Use hardcoded credentials as fallback
      const fallbackClientId = "mestreal_mfh4e642_4flnuh";
      const fallbackClientSecret = "gv0zfmdekNxYA296OcqFrnBAVU4PhbUBhBwNlMCamk2oXDHeXJqu1K6YtpVOZ5da";
      
      // Use stored credentials or fallback
      const clientId = CLIENT_ID || fallbackClientId;
      const clientSecret = CLIENT_SECRET || fallbackClientSecret;
      
      if (!clientId || !clientSecret) {
        throw new Error('Missing CLIENT_ID or CLIENT_SECRET');
      }

      // Create fresh MyIOAuth instance every time (like TELEMETRY widget)
      const MyIO = (typeof MyIOLibrary !== "undefined" && MyIOLibrary)
           || (typeof window !== "undefined" && window.MyIOLibrary)
           || null;

      if (!MyIO) {
        throw new Error('MyIOLibrary not available');
      }

      const myIOAuth = MyIO.buildMyioIngestionAuth({
        dataApiHost: DATA_API_HOST,
        clientId: clientId,
        clientSecret: clientSecret
      });

      // Get fresh token
      const token = await myIOAuth.getToken();
      if (!token) {
        throw new Error('Failed to get ingestion token');
      }

      // Use stored customer ID or fallback
      const customerId = CUSTOMER_ING_ID || "e01bdd22-3be6-4b75-9dae-442c8b8c186e";

      // Build API URL based on domain
      const url = new URL(`${DATA_API_HOST}/api/v1/telemetry/customers/${customerId}/${domain}/devices/totals`);
      url.searchParams.set('startTime', period.startISO);
      url.searchParams.set('endTime', period.endISO);
      url.searchParams.set('deep', '1');

      LogHelper.log(`[Orchestrator] Fetching from: ${url.toString()}`);

      const res = await fetch(url.toString(), {
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

      // RFC-0042: Debug first row to see available fields
      if (rows.length > 0) {
        //LogHelper.log(`[Orchestrator] Sample API row (full):`, JSON.stringify(rows[0], null, 2));
        //LogHelper.log(`[Orchestrator] Sample API row groupType field:`, rows[0].groupType);
      }

      // Convert API response to enriched items format
      const items = rows.map(row => ({
        id: row.id,
        tbId: row.id,
        ingestionId: row.id,
        identifier: row.identifier || row.id,
        label: row.name || row.label || row.identifier || row.id,  // ← API usa "name", não "label"
        value: Number(row.total_value || 0),
        perc: 0,
        deviceType: row.deviceType || 'energy',
        slaveId: row.slaveId || null,
        centralId: row.centralId || null
      }));

      LogHelper.log(`[Orchestrator] fetchAndEnrich: fetched ${items.length} items for domain ${domain}`);
      return items;
    } catch (error) {
      LogHelper.error(`[Orchestrator] fetchAndEnrich error for domain ${domain}:`, error);
      return [];
    }
  }

  async function hydrateDomain(domain, period) {
    const key = cacheKey(domain, period);
    const startTime = Date.now();

    if (inFlight.has(key)) {
      if (config.debugMode) LogHelper.log(`[Orchestrator] Coalescing request for ${key}`);
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

  // RFC-0042: Cross-context event forwarding helper
  function emitToAllContexts(eventName, detail) {
    // 1. Emit to current window
    window.dispatchEvent(new CustomEvent(eventName, { detail }));

    // 2. Emit to parent window if in iframe
    try {
      if (window.parent && window.parent !== window) {
        window.parent.dispatchEvent(new CustomEvent(eventName, { detail }));
      }
    } catch (e) {
      // Cross-origin iframe, ignore
    }

    // 3. Emit to all child iframes
    try {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((iframe, idx) => {
        try {
          iframe.contentWindow.dispatchEvent(new CustomEvent(eventName, { detail }));
        } catch (e) {
          // Cross-origin iframe, ignore
        }
      });
    } catch (e) {
      // Cannot access iframes, ignore
    }
  }

  // Event emitters
  function emitProvide(domain, periodKey, items) {
    LogHelper.log(`[Orchestrator] Emitting provide-data event for domain ${domain} with ${items.length} items`);

    // Store data for late-joining widgets
    if (!window.MyIOOrchestratorData) {
      window.MyIOOrchestratorData = {};
    }
    window.MyIOOrchestratorData[domain] = { periodKey, items, timestamp: Date.now() };

    // RFC-0042: Emit to all contexts (parent, current, iframes)
    emitToAllContexts('myio:telemetry:provide-data', { domain, periodKey, items });

    // Retry mechanism for late-joining widgets
    setTimeout(() => {
      LogHelper.log(`[Orchestrator] Retrying event emission for domain ${domain}`);
      emitToAllContexts('myio:telemetry:provide-data', { domain, periodKey, items });
    }, 1000);
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

      if (config.debugMode) LogHelper.log('[Orchestrator] Tokens rotated');
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
    LogHelper.log('[Orchestrator] Received myio:update-date event', ev.detail);
    currentPeriod = ev.detail.period;

    // RFC-0042: Cross-context emission removed - HEADER already handles this
    // No need to re-emit here as it creates infinite loop

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
        LogHelper.warn('[Orchestrator] Failed to send telemetry:', e);
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

LogHelper.log('[MyIOOrchestrator] Initialized');
