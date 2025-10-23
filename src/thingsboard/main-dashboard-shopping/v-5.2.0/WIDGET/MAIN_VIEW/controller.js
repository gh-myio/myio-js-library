/*********************************************************
 * MYIO â€“ Container 2 states (menu/content)
 * - Ajusta alturas automaticamente
 * - Suporta "menu compacto" via evento global
 * - MantÃ©m simples: os tb-dashboard-state renderizam os
 * dashboards configurados no prÃ³prio ThingsBoard.
 *********************************************************/

// Debug configuration
const DEBUG_ACTIVE = true; // TEMPORARY - for debugging orchestrator issue

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

// RFC-0051.1 + RFC-0052: Global widget settings (will be populated in onInit)
// IMPORTANT: customerTB_ID must NEVER be 'default' - it must always be a valid ThingsBoard ID
let widgetSettings = {
  customerTB_ID: null,  // RFC-0052: Changed from 'default' to null - MUST be set in onInit
  enableCache: true,    // RFC-0052: New - enable/disable cache globally
  cacheTtlMinutes: 30,
  enableStaleWhileRevalidate: true,
  maxCacheSize: 50,
  debugMode: false,
  domainsEnabled: { energy: true, water: true, temperature: true }
};

(function () {
  // UtilitÃ¡rios DOM
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  let rootEl;

  // Atualiza a altura Ãºtil do conteÃºdo e garante que os elementos estÃ£o bem posicionados
  function applySizing() {
    try {
      const sidebarW = getCssVar('--sidebar-w');

      // ForÃ§a recÃ¡lculo do layout se necessÃ¡rio
      if (rootEl) {
        rootEl.style.display = 'grid';

        // Garante que os tb-child elementos do MENU não tenham overflow issues
        const menu = $('.myio-menu', rootEl);
        if (menu) {
          const menuChildren = $$('.tb-child', menu);
          menuChildren.forEach(child => {
            child.style.overflow = 'hidden';
            child.style.width = '100%';
            child.style.height = '100%';
          });
        }

        // Especial tratamento para o conteúdo principal - permite scroll nos widgets
        const content = $('.myio-content', rootEl);
        if (content) {
          // Primeiro: container direto do content deve ter overflow auto para controlar scroll
          const contentChild = $('.tb-child', content);
          if (contentChild) {
            contentChild.style.overflow = 'auto';  // Mudado de 'visible' para 'auto'
            contentChild.style.height = '100%';
            contentChild.style.width = '100%';
          }

          // Segundo: dentro dos states, os widgets individuais também precisam de scroll
          const stateContainers = $$('[data-content-state]', content);
          LogHelper.log(`[MAIN_VIEW] Found ${stateContainers.length} state containers`);
          stateContainers.forEach((stateContainer, idx) => {
            const widgetsInState = $$('.tb-child', stateContainer);
            LogHelper.log(`[MAIN_VIEW] State ${idx}: ${widgetsInState.length} widgets found`, {
              state: stateContainer.getAttribute('data-content-state'),
              display: stateContainer.style.display
            });
            widgetsInState.forEach((widget, widgetIdx) => {
              const before = widget.style.overflow;
              widget.style.overflow = 'auto';
              widget.style.width = '100%';
              widget.style.height = '100%';
              LogHelper.log(`[MAIN_VIEW]   Widget ${widgetIdx}: overflow ${before} → auto`);
            });
          });

          // DiagnÃ³stico: logar dimensÃµes do container visÃ­vel
          const visible = Array.from(content.querySelectorAll('[data-content-state]'))
            .find(div => (div.style.display !== 'none'));
          if (visible) {
            const r1 = content.getBoundingClientRect();
            const r2 = visible.getBoundingClientRect();
            const r3 = contentChild ? contentChild.getBoundingClientRect() : null;
            LogHelper.log('[MAIN_VIEW] sizing content dims', { content: { w: r1.width, h: r1.height }, visible: { w: r2.width, h: r2.height }, child: r3 ? { w: r3.width, h: r3.height } : null });
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

    // ForÃ§a recÃ¡lculo apÃ³s mudanÃ§a de modo
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

  // Detecta mudanÃ§as de viewport para aplicar sizing
  function setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined' && rootEl) {
      const resizeObserver = new ResizeObserver(() => {
        applySizing();
      });
      resizeObserver.observe(rootEl);
    }
  }


  // RFC-0047: Clean up expired cache from localStorage
  function cleanupExpiredCache() {
    // RFC-0052: Skip cleanup if cache is disabled
    if (!widgetSettings.enableCache) {
      LogHelper.log('[Orchestrator] â­ï¸ Cache disabled - skipping cleanup');
      return;
    }

    LogHelper.log('[Orchestrator] ðŸ§¹ Starting cleanup of expired cache...');

    const now = Date.now();
    const ttlMs = 30 * 60_000; // 30 minutes in milliseconds
    let removedCount = 0;
    let totalCount = 0;

    try {
      // Iterate through all localStorage keys
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);

        // Only process myio:cache: keys
        if (!storageKey || !storageKey.startsWith('myio:cache:')) {
          continue;
        }

        totalCount++;

        try {
          const valueStr = localStorage.getItem(storageKey);
          if (!valueStr) continue;

          const parsed = JSON.parse(valueStr);

          // Extract cache entry (format: { "TB_ID:domain:...": { data, cachedAt, ... } })
          const cacheEntry = Object.values(parsed)[0];

          if (!cacheEntry || !cacheEntry.cachedAt) {
            // Invalid or old format cache, mark for removal
            LogHelper.warn(`[Orchestrator] Invalid cache entry (missing cachedAt): ${storageKey}`);
            keysToRemove.push(storageKey);
            continue;
          }

          const age = now - cacheEntry.cachedAt;
          const expired = age > ttlMs;

          if (expired) {
            const ageMinutes = Math.round(age / 60_000);
            LogHelper.log(`[Orchestrator] â° Removing expired cache: ${storageKey} (age: ${ageMinutes} minutes)`);
            keysToRemove.push(storageKey);
          }
        } catch (parseErr) {
          LogHelper.warn(`[Orchestrator] Failed to parse cache entry: ${storageKey}`, parseErr);
          keysToRemove.push(storageKey); // Remove corrupted entries
        }
      }

      // Remove expired keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        removedCount++;
      });

      LogHelper.log(`[Orchestrator] âœ… Cache cleanup complete: ${removedCount}/${totalCount} entries removed`);
    } catch (err) {
      LogHelper.error('[Orchestrator] âŒ Error during cache cleanup:', err);
    }
  }

  // ThingsBoard lifecycle
  self.onInit = async function () {

    rootEl = $('#myio-root');

    // RFC-0051.1 + RFC-0052: Populate global widget settings early to avoid undefined errors
    // These settings are available globally to all functions

    // CRITICAL: customerTB_ID MUST be set - abort if missing
    const customerTB_ID = self.ctx.settings?.customerTB_ID;
    if (!customerTB_ID) {
      LogHelper.error('[Orchestrator] âŒ CRITICAL: customerTB_ID is missing from widget settings!');
      LogHelper.error('[Orchestrator] Widget cannot function without customerTB_ID. Please configure it in widget settings.');
      throw new Error('customerTB_ID is required but not found in widget settings');
    }

    widgetSettings.customerTB_ID = customerTB_ID;
    widgetSettings.enableCache = self.ctx.settings?.enableCache ?? true;  // RFC-0052: New
    widgetSettings.cacheTtlMinutes = self.ctx.settings?.cacheTtlMinutes ?? 30;
    widgetSettings.enableStaleWhileRevalidate = self.ctx.settings?.enableStaleWhileRevalidate ?? true;
    widgetSettings.maxCacheSize = self.ctx.settings?.maxCacheSize ?? 50;
    widgetSettings.debugMode = self.ctx.settings?.debugMode ?? false;
    widgetSettings.domainsEnabled = self.ctx.settings?.domainsEnabled ?? {
      energy: true,
      water: true,
      temperature: true
    };

    LogHelper.log('[Orchestrator] ðŸ“‹ Widget settings captured:', {
      customerTB_ID: widgetSettings.customerTB_ID,
      enableCache: widgetSettings.enableCache,  // RFC-0052
      cacheTtlMinutes: widgetSettings.cacheTtlMinutes,
      debugMode: widgetSettings.debugMode
    });

    // RFC-0052: Initialize config AFTER widgetSettings are populated
    config = {
      enableCache: widgetSettings.enableCache,
      ttlMinutes: widgetSettings.cacheTtlMinutes,
      enableStaleWhileRevalidate: widgetSettings.enableStaleWhileRevalidate,
      maxCacheSize: widgetSettings.maxCacheSize,
      debugMode: widgetSettings.debugMode,
      domainsEnabled: widgetSettings.domainsEnabled
    };

    LogHelper.log('[Orchestrator] ðŸ”§ Config initialized from settings:', config);

    // RFC-0052: Log cache status
    if (config.enableCache) {
      LogHelper.log(`[Orchestrator] âœ… Cache ENABLED (TTL: ${config.ttlMinutes} min)`);
    } else {
      LogHelper.warn('[Orchestrator] âš ï¸ CACHE DISABLED - All requests will fetch fresh data from API');
      LogHelper.warn('[Orchestrator] This increases API load. Enable cache for better performance.');
    }

    // RFC-0051.2: Expose orchestrator stub IMMEDIATELY
    // This prevents race conditions with TELEMETRY widgets that check for orchestrator
    // We expose a stub with isReady flag that will be set to true when fully initialized
    if (!window.MyIOOrchestrator) {
      window.MyIOOrchestrator = {
        // Status flags
        isReady: false,
        credentialsSet: false,

        // Data access methods (will be populated later)
        getCurrentPeriod: () => null,
        getCache: () => null,
        getCredentials: () => null,
        invalidateCache: (domain) => {
          LogHelper.warn('[Orchestrator] âš ï¸ invalidateCache called before orchestrator is ready');
        },

        // Credential management (will be populated later)
        setCredentials: async (customerId, clientId, clientSecret) => {
          LogHelper.warn('[Orchestrator] âš ï¸ setCredentials called before orchestrator is ready');
        },

        // Token manager stub
        tokenManager: {
          setToken: (key, token) => {
            LogHelper.warn('[Orchestrator] âš ï¸ tokenManager.setToken called before orchestrator is ready');
          }
        },

        // Internal state (will be populated later)
        memCache: null,
        inFlight: {}
      };

      LogHelper.log('[Orchestrator] âš¡ Exposed to window.MyIOOrchestrator EARLY (stub mode)');
    }

    registerGlobalEvents();
    setupResizeObserver();

    // RFC-0047: Clean up expired cache on init
    cleanupExpiredCache();

    // Initialize MyIO Library and Authentication
    const MyIO = (typeof MyIOLibrary !== "undefined" && MyIOLibrary)
         || (typeof window !== "undefined" && window.MyIOLibrary)
         || null;

    if (MyIO) {
      try {
        // RFC-0051.1: Use widgetSettings from closure
        const customerTB_ID = widgetSettings.customerTB_ID !== 'default' ? widgetSettings.customerTB_ID : "";
        const jwt = localStorage.getItem("jwt_token");

        LogHelper.log("[MAIN_VIEW] ðŸ” Credentials fetch starting...");
        LogHelper.log("[MAIN_VIEW] customerTB_ID:", customerTB_ID ? customerTB_ID : "âŒ NOT FOUND IN SETTINGS");
        LogHelper.log("[MAIN_VIEW] jwt token:", jwt ? "âœ… FOUND" : "âŒ NOT FOUND IN localStorage");

        let CLIENT_ID = "";
        let CLIENT_SECRET = "";
        let CUSTOMER_ING_ID = "";

        if (customerTB_ID && jwt) {
          try {
            LogHelper.log("[MAIN_VIEW] ðŸ“¡ Fetching customer attributes from ThingsBoard...");
            // Fetch customer attributes
            const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);

            LogHelper.log("[MAIN_VIEW] ðŸ“¦ Received attrs:", attrs);

            CLIENT_ID = attrs?.client_id || "";
            CLIENT_SECRET = attrs?.client_secret || "";
            CUSTOMER_ING_ID = attrs?.ingestionId || "";

            LogHelper.log("[MAIN_VIEW] ðŸ”‘ Parsed credentials:");
            LogHelper.log("[MAIN_VIEW]   CLIENT_ID:", CLIENT_ID ? "âœ… " + CLIENT_ID : "âŒ EMPTY");
            LogHelper.log("[MAIN_VIEW]   CLIENT_SECRET:", CLIENT_SECRET ? "âœ… " + CLIENT_SECRET.substring(0, 10) + "..." : "âŒ EMPTY");
            LogHelper.log("[MAIN_VIEW]   CUSTOMER_ING_ID:", CUSTOMER_ING_ID ? "âœ… " + CUSTOMER_ING_ID : "âŒ EMPTY");
          } catch (err) {
            LogHelper.error("[MAIN_VIEW] âŒ Failed to fetch customer attributes:", err);
            LogHelper.error("[MAIN_VIEW] Error details:", {
              message: err.message,
              stack: err.stack,
              name: err.name
            });
          }
        } else {
          LogHelper.warn("[MAIN_VIEW] âš ï¸ Cannot fetch credentials - missing required data:");
          if (!customerTB_ID) LogHelper.warn("[MAIN_VIEW]   - customerTB_ID is missing from settings");
          if (!jwt) LogHelper.warn("[MAIN_VIEW]   - JWT token is missing from localStorage");
        }

        // Check if credentials are present
        if (!CLIENT_ID || !CLIENT_SECRET || !CUSTOMER_ING_ID) {
          LogHelper.warn("[MAIN_VIEW] Missing credentials - CLIENT_ID, CLIENT_SECRET, or CUSTOMER_ING_ID not found");
          LogHelper.warn("[MAIN_VIEW] Orchestrator will be available but won't be able to fetch data without credentials");

          // RFC-0054 FIX: Dispatch initial tab event even without credentials (with delay)
          // This enables HEADER controls, even though data fetch will fail
          LogHelper.log('[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...');
          setTimeout(() => {
            LogHelper.log('[MAIN_VIEW] Dispatching initial tab event for default state: energy (no credentials)');
            window.dispatchEvent(
              new CustomEvent('myio:dashboard-state', {
                detail: { tab: 'energy' }
              })
            );
          }, 100);
        } else {
          // Set credentials in orchestrator (only if present)
          LogHelper.log("[MAIN_VIEW] ðŸ” Calling MyIOOrchestrator.setCredentials...");
          LogHelper.log("[MAIN_VIEW] ðŸ” Arguments:", {
            customerId: CUSTOMER_ING_ID,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET.substring(0, 10) + "..."
          });

          MyIOOrchestrator.setCredentials(CUSTOMER_ING_ID, CLIENT_ID, CLIENT_SECRET);

          LogHelper.log("[MAIN_VIEW] ðŸ” setCredentials completed, verifying...");
          // Verify credentials were set
          const currentCreds = MyIOOrchestrator.getCredentials?.();
          if (currentCreds) {
            LogHelper.log("[MAIN_VIEW] âœ… Credentials verified in orchestrator:", currentCreds);
          } else {
            LogHelper.warn("[MAIN_VIEW] âš ï¸ Orchestrator does not have getCredentials method");
          }

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

          // RFC-0054 FIX: Dispatch initial tab event AFTER credentials AND with delay
          // Delay ensures HEADER has time to register its listener
          // This ensures customerTB_ID is available for cache key generation
          LogHelper.log('[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...');
          setTimeout(() => {
            LogHelper.log('[MAIN_VIEW] Dispatching initial tab event for default state: energy (after credentials + delay)');
            window.dispatchEvent(
              new CustomEvent('myio:dashboard-state', {
                detail: { tab: 'energy' }
              })
            );
          }, 100);
        }
      } catch (err) {
        LogHelper.error("[MAIN_VIEW] Auth initialization failed:", err);

        // RFC-0054 FIX: Dispatch initial tab event even on error (with delay)
        // This enables HEADER controls, even though data fetch will fail
        LogHelper.log('[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...');
        setTimeout(() => {
          LogHelper.log('[MAIN_VIEW] Dispatching initial tab event for default state: energy (after error)');
          window.dispatchEvent(
            new CustomEvent('myio:dashboard-state', {
              detail: { tab: 'energy' }
            })
          );
        }, 100);
      }
    } else {
      LogHelper.warn("[MAIN_VIEW] MyIOLibrary not available");

      // RFC-0054 FIX: Dispatch initial tab event even without MyIOLibrary (with delay)
      // This enables HEADER controls, even though data fetch will fail
      LogHelper.log('[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...');
      setTimeout(() => {
        LogHelper.log('[MAIN_VIEW] Dispatching initial tab event for default state: energy (no MyIOLibrary)');
        window.dispatchEvent(
          new CustomEvent('myio:dashboard-state', {
            detail: { tab: 'energy' }
          })
        );
      }, 100);
    }

    // Log Ãºtil para conferir se os states existem
    try {
      const states = (ctx?.dashboard?.configuration?.states) || {};
     // LogHelper.log('[myio-container] states disponÃ­veis:', Object.keys(states));
      // Esperados: "menu", "telemetry_content", "water_content", "temperature_content", "alarm_content", "footer"
    } catch (e) {
      LogHelper.warn('[myio-container] nÃ£o foi possÃ­vel listar states:', e);
    }
  };

  self.onResize = function () {
    applySizing();
  };

  self.onDataUpdated = function () {
    // Normalmente nÃ£o Ã© necessÃ¡rio aqui, pois cada state cuida do prÃ³prio dado.
    // Mas podemos garantir que o layout estÃ¡ correto
    setTimeout(() => {
      applySizing();
    }, 50);
  };

  self.onDestroy = function () {
    // Limpa event listeners se necessÃ¡rio
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
// ========== RFC-0045: ROBUST CACHE STRATEGY WITH PRIORITIZATION ==========

/**
 * Global shared state for widget coordination and cache management
 * Prevents race conditions and ensures first widget priority
 */
if (!window.MyIOOrchestratorState) {
  window.MyIOOrchestratorState = {
    // Widget registration and priority
    widgetPriority: [],
    widgetRegistry: new Map(), // widgetId -> {domain, registeredAt}

    // Cache management
    cache: {},

    // Loading state per domain
    loading: {},

    // Pending listeners for late-joining widgets
    pendingListeners: {},

    // Last emission timestamp per domain (deduplication)
    lastEmission: {},

    // Lock to prevent concurrent requests
    locks: {}
  };

  LogHelper.log('[Orchestrator] ðŸŒ Global state initialized:', window.MyIOOrchestratorState);
}

const OrchestratorState = window.MyIOOrchestratorState;

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
 * Converts Date/timestamp to ISO with SÃ£o Paulo timezone.
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
 * RFC-0047: Enhanced cache key with Customer TB ID for multi-tenancy support
 * Format: myio:cache:TB_ID:domain:startISO:endISO:granularity
 */
// RFC-0051.1: Use widgetSettings from closure instead of self.ctx.settings
function cacheKey(domain, period) {
  const customerTbId = widgetSettings.customerTB_ID;
  return `${customerTbId}:${domain}:${period.startISO}:${period.endISO}:${period.granularity}`;
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

const DATA_API_HOST = "https://api.data.apps.myio-bas.com";

const MyIOOrchestrator = (() => {
// ========== PHASE 1: BUSY OVERLAY MANAGEMENT (RFC-0044/RFC-0054) ==========
const BUSY_OVERLAY_ID = 'myio-orchestrator-busy-overlay';
let globalBusyState = {
  isVisible: false,
  timeoutId: null,
  startTime: null,
  currentDomain: null,
  requestCount: 0
};

// RFC-0054: contador por domínio e cooldown pós-provide
const activeRequests = new Map(); // domain -> count
const lastProvide = new Map();    // domain -> { periodKey, at }

function getActiveTotal() {
  let total = 0;
  activeRequests.forEach((v) => { total += (v || 0); });
  return total;
}

function ensureOrchestratorBusyDOM() {
  let el = document.getElementById(BUSY_OVERLAY_ID);
  if (el) return el;
  
  el = document.createElement('div');
  el.id = BUSY_OVERLAY_ID;
  el.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(45, 20, 88, 0.6);
    backdrop-filter: blur(3px);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    font-family: Inter, system-ui, sans-serif;
  `;
  
  const container = document.createElement('div');
  container.style.cssText = `
    background: #2d1458;
    color: #fff;
    border-radius: 18px;
    padding: 24px 32px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 320px;
  `;
  
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255,255,255,0.25);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  `;
  
  const message = document.createElement('div');
  message.id = `${BUSY_OVERLAY_ID}-message`;
  message.style.cssText = `
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.2px;
  `;
  message.textContent = 'Carregando dados...';
  
  container.appendChild(spinner);
  container.appendChild(message);
  el.appendChild(container);
  document.body.appendChild(el);
  
  // Add CSS animation
  if (!document.querySelector('#myio-busy-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'myio-busy-styles';
    styleEl.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleEl);
  }
  
  return el;
}

// PHASE 1: Centralized busy management with extended timeout
function showGlobalBusy(domain = 'unknown', message = 'Carregando dados...') {
  // RFC-0054: cooldown - não reabrir modal se acabou de prover dados
  const lp = lastProvide.get(domain);
  if (lp && (Date.now() - lp.at) < 30000) {
    LogHelper.log(`[Orchestrator] ⏭️ Cooldown active for ${domain}, skipping showGlobalBusy()`);
    return;
  }
  const totalBefore = getActiveTotal();
  const prev = activeRequests.get(domain) || 0;
  activeRequests.set(domain, prev + 1);
  LogHelper.log(`[Orchestrator] 🔢 Active requests for ${domain}: ${prev + 1} (totalBefore=${totalBefore})`);

  const el = ensureOrchestratorBusyDOM();
  const messageEl = el.querySelector(`#${BUSY_OVERLAY_ID}-message`);

  if (messageEl) {
    // Mensagem genérica para evitar rótulo incorreto ao alternar abas
    messageEl.textContent = 'Carregando dados...';
  }

  // Clear existing timeout
  if (globalBusyState.timeoutId) {
    clearTimeout(globalBusyState.timeoutId);
    globalBusyState.timeoutId = null;
  }

  // Mostrar overlay apenas quando saiu de 0 → 1
  if (totalBefore === 0) {
    globalBusyState.isVisible = true;
    globalBusyState.currentDomain = domain;
    globalBusyState.startTime = Date.now();
    globalBusyState.requestCount++;
    el.style.display = 'flex';
  }

  // RFC-0048: Start widget monitoring (will be stopped by hideGlobalBusy)
  // This is defined later in the orchestrator initialization
  if (window.MyIOOrchestrator?.widgetBusyMonitor) {
    window.MyIOOrchestrator.widgetBusyMonitor.startMonitoring(domain);
  }

  // PHASE 1: Extended timeout (25s instead of 10s)
  globalBusyState.timeoutId = setTimeout(() => {
    LogHelper.warn(`[Orchestrator] ⚠️ BUSY TIMEOUT (25s) for domain ${domain} - implementing recovery`);

    // Check if still actually busy
    if (globalBusyState.isVisible && el.style.display !== 'none') {
      // PHASE 3: Circuit breaker pattern - try graceful recovery
      try {
        // Emit recovery event
        window.dispatchEvent(new CustomEvent('myio:busy-timeout-recovery', {
          detail: { domain, duration: Date.now() - globalBusyState.startTime }
        }));

        // Try to invalidate cache for the specific domain
        if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.invalidateCache === 'function') {
          window.MyIOOrchestrator.invalidateCache(domain);
          LogHelper.log(`[Orchestrator] 🧹 Cache invalidated for domain ${domain}`);
        }

        // Hide busy and show user-friendly message
        hideGlobalBusy(domain);

        // PHASE 4: Non-intrusive notification instead of alert
        showRecoveryNotification();

      } catch (err) {
        LogHelper.error(`[Orchestrator] âŒ Error in timeout recovery:`, err);
        hideGlobalBusy(domain);
      }
    }

    globalBusyState.timeoutId = null;
  }, 25000); // 25 seconds (Phase 1 requirement)

  if (totalBefore === 0) {
    LogHelper.log(`[Orchestrator] ✅ Global busy shown (domain=${domain})`);
  } else {
    LogHelper.log(`[Orchestrator] ⏭️ Busy already visible (domain=${domain})`);
  }
}

function hideGlobalBusy(domain = null) {
  // RFC-0054: decremento por domínio; se domain for nulo, força limpeza
  if (domain) {
    const prev = activeRequests.get(domain) || 0;
    const next = Math.max(0, prev - 1);
    activeRequests.set(domain, next);
    LogHelper.log(`[Orchestrator] ⏬ hideGlobalBusy(${domain}) -> ${prev}→${next}, total=${getActiveTotal()}`);
    if (getActiveTotal() > 0) return; // mantém overlay enquanto houver ativas
  } else {
    activeRequests.clear();
  }

  // RFC-0048: Stop widget monitoring for current domain
  if (window.MyIOOrchestrator?.widgetBusyMonitor) {
    window.MyIOOrchestrator.widgetBusyMonitor.stopAll();
  }

  const el = document.getElementById(BUSY_OVERLAY_ID);
  if (el) {
    el.style.display = 'none';
  }

  // Clear timeout
  if (globalBusyState.timeoutId) {
    clearTimeout(globalBusyState.timeoutId);
    globalBusyState.timeoutId = null;
  }

  // Update state
  globalBusyState.isVisible = false;
  globalBusyState.currentDomain = null;
  globalBusyState.startTime = null;

  LogHelper.log(`[Orchestrator] ✅ Global busy hidden`);
}

// PHASE 4: Non-intrusive recovery notification
function showRecoveryNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f97316;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    font-family: Inter, system-ui, sans-serif;
  `;
  notification.textContent = 'Dados recarregados automaticamente';
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 4000);
}

// Premium alert for missing credentials
function showCredentialsAlert() {
  const overlay = document.createElement('div');
  overlay.id = 'myio-credentials-alert';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(45, 20, 88, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: Inter, system-ui, sans-serif;
  `;

  const alertBox = document.createElement('div');
  alertBox.style.cssText = `
    background: linear-gradient(135deg, #2d1458 0%, #1a0b33 100%);
    color: #fff;
    border-radius: 20px;
    padding: 40px 48px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    border: 2px solid rgba(255,255,255,0.1);
    max-width: 500px;
    text-align: center;
    animation: slideIn 0.3s ease-out;
  `;

  alertBox.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">âš ï¸</div>
    <h2 style="
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 16px 0;
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    ">Credenciais NÃ£o Encontradas</h2>
    <p style="
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 24px 0;
      color: rgba(255,255,255,0.85);
    ">
      As credenciais de autenticaÃ§Ã£o nÃ£o foram configuradas no sistema.
      <br><br>
      <strong>Credenciais necessÃ¡rias:</strong>
      <br>â€¢ CLIENT_ID
      <br>â€¢ CLIENT_SECRET
      <br>â€¢ CUSTOMER_ING_ID
      <br><br>
      Entre em contato com o administrador para configurar as credenciais necessÃ¡rias.
    </p>
    <button id="credentials-alert-close" style="
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      border: none;
      padding: 14px 32px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
      transition: all 0.2s ease;
    ">Fechar</button>
  `;

  overlay.appendChild(alertBox);
  document.body.appendChild(overlay);

  // Add CSS animation
  if (!document.querySelector('#myio-credentials-alert-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'myio-credentials-alert-styles';
    styleEl.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      #credentials-alert-close:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(245, 158, 11, 0.5);
      }

      #credentials-alert-close:active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(styleEl);
  }

  // Close button handler
  const closeBtn = document.getElementById('credentials-alert-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
  }

  LogHelper.error('[MAIN_VIEW] Credentials alert displayed - system halted');
}

// PHASE 2: Shared state management for widgets coordination
let sharedWidgetState = {
  activePeriod: null,
  lastProcessedPeriodKey: null,
  busyWidgets: new Set(),
  mutexMap: new Map() // RFC-0054 FIX: Mutex por domínio (não global)
};

// PHASE 3: Enhanced event emission with debounce
let eventEmissionDebounce = new Map();

function debouncedEmitProvide(domain, periodKey, items, delay = 300) {
  const key = `${domain}:${periodKey}`;
  
  if (eventEmissionDebounce.has(key)) {
    clearTimeout(eventEmissionDebounce.get(key));
  }
  
  const timeoutId = setTimeout(() => {
    emitProvide(domain, periodKey, items);
    eventEmissionDebounce.delete(key);
  }, delay);
  
  eventEmissionDebounce.set(key, timeoutId);
}

  // State
  const memCache = new Map();
  const inFlight = new Map();
  const abortControllers = new Map();

  // RFC-0051.1 + RFC-0052: Config will be initialized in onInit() after widgetSettings are populated
  let config = null;

  let visibleTab = 'energy';
  let currentPeriod = null;
  let CUSTOMER_ING_ID = '';
  let CLIENT_ID = '';
  let CLIENT_SECRET = '';

  // Credentials promise resolver for async wait
  let credentialsResolver = null;
  let credentialsPromise = new Promise(resolve => {
    credentialsResolver = resolve;
  });

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

      if (config?.debugMode) {
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
  // RFC-0047: Enhanced cache read with expiration validation
  function readCache(key) {
    // RFC-0052: Do not read from cache if cache is disabled
    if (!config?.enableCache) {
      LogHelper.log(`[Orchestrator] â­ï¸ Cache disabled - skipping read for ${key}`);
      return null; // Always return null = cache miss
    }

    const entry = memCache.get(key);
    if (!entry) return null;

    // RFC-0045 FIX 1: Validate cache must have data
    // Don't serve empty arrays as valid cache
    if (!entry.data || entry.data.length === 0) {
      LogHelper.warn(`[Orchestrator] âš ï¸ Cache for ${key} is empty, invalidating`);
      memCache.delete(key);
      return null;
    }

    // RFC-0047: Validate cache expiration (30 minutes)
    const age = Date.now() - entry.cachedAt;
    const expired = age > entry.ttlMinutes * 60_000;

    if (expired) {
      LogHelper.warn(`[Orchestrator] â° Cache for ${key} expired (age: ${Math.round(age / 60_000)} minutes)`);
      memCache.delete(key);
      // Also remove from localStorage
      try {
        localStorage.removeItem(`myio:cache:${key}`);
      } catch (e) {
        LogHelper.warn('[Orchestrator] Failed to remove expired cache from localStorage:', e);
      }
      return null;
    }

    const fresh = age < entry.ttlMinutes * 60_000;

    return { ...entry, fresh };
  }

  // RFC-0047: Enhanced cache write with timestamp
  function writeCache(key, data) {
    // RFC-0052: Do not write to cache if cache is disabled
    if (!config?.enableCache) {
      LogHelper.log(`[Orchestrator] â­ï¸ Cache disabled - skipping write for ${key}`);
      return;
    }

    // RFC-0045 FIX 2: Don't cache empty arrays
    // Empty data should not be persisted as it causes bugs when served from cache
    if (!data || data.length === 0) {
      LogHelper.warn(`[Orchestrator] âš ï¸ Skipping cache write for ${key} - empty data`);
      return;
    }

    if (memCache.has(key)) memCache.delete(key);

    const now = Date.now();

    // RFC-0047: Enhanced cache entry with timestamp and TTL metadata
    const cacheEntry = {
      data,
      cachedAt: now, // Timestamp when cache was created
      hydratedAt: now, // Backward compatibility
      ttlMinutes: config?.ttlMinutes ?? 30, // TTL in minutes (30)
      expiresAt: now + ((config?.ttlMinutes ?? 30) * 60_000) // Explicit expiration timestamp
    };

    memCache.set(key, cacheEntry);

    // Log cache write
    LogHelper.log(`[Orchestrator] ðŸ’¾ Cache written for ${key}: ${data.length} items, TTL: ${config?.ttlMinutes ?? 30} min, expires: ${new Date(cacheEntry.expiresAt).toLocaleTimeString()}`);

    while (memCache.size > (config?.maxCacheSize ?? 50)) {
      const oldestKey = memCache.keys().next().value;
      memCache.delete(oldestKey);
      if (config?.debugMode) LogHelper.log(`[Orchestrator] Evicted cache key: ${oldestKey}`);
    }

    persistToStorage(key, cacheEntry);
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
    // RFC-0052: Log warning if cache is disabled
    if (!config?.enableCache) {
      LogHelper.log(`[Orchestrator] â­ï¸ Cache disabled - invalidateCache('${domain}') has no effect`);
      return; // Early return - no cache to invalidate
    }

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

    if (config?.debugMode) LogHelper.log(`[Orchestrator] Cache invalidated: ${domain}`);
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

  // RFC-0047: Enhanced clearStorageCache with TB_ID awareness
  // RFC-0051.1: Use widgetSettings from closure
  function clearStorageCache(domain) {
    const customerTbId = widgetSettings.customerTB_ID;

    // RFC-0047: Updated prefix format to include TB_ID
    // Format: myio:cache:TB_ID:domain: or myio:cache:TB_ID: (all domains for customer)
    const prefix = domain
      ? `myio:cache:${customerTbId}:${domain}:`
      : `myio:cache:${customerTbId}:`;

    LogHelper.log(`[Orchestrator] ðŸ§¹ Clearing localStorage cache with prefix: ${prefix}`);

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      LogHelper.log(`[Orchestrator] ðŸ—‘ï¸ Removed cache key: ${key}`);
    });

    LogHelper.log(`[Orchestrator] âœ… Cleared ${keysToRemove.length} cache entries`);
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
      LogHelper.log(`[Orchestrator] ðŸ” fetchAndEnrich called for ${domain}`);

      // RFC-0054 Solução 4: Early return se há dados recentes disponíveis
      // Verifica ANTES de aguardar credentials para evitar timeout desnecessário
      const key = cacheKey(domain, period);
      const recent = OrchestratorState.cache[domain];

      if (recent && (Date.now() - recent.timestamp) < 30000) {
        const recentPeriod = extractPeriod(recent.periodKey);
        const currentPeriod = extractPeriod(key);

        if (recentPeriod === currentPeriod) {
          LogHelper.log(`[Orchestrator] ⏭️ Early return - recent data already available for ${domain}`);
          LogHelper.log(`[Orchestrator] 📊 Using cached data: ${recent.periodKey} (${recent.items.length} items)`);
          return recent.items; // ✅ Retorna dados recentes SEM fazer fetch
        } else {
          LogHelper.log(`[Orchestrator] 🔄 Period mismatch - proceeding with fetch`);
          LogHelper.log(`[Orchestrator] 📊 Recent: ${recentPeriod}, Current: ${currentPeriod}`);
        }
      } else {
        if (!recent) {
          LogHelper.log(`[Orchestrator] 🔄 No recent data - proceeding with fetch`);
        } else {
          const age = Date.now() - recent.timestamp;
          LogHelper.log(`[Orchestrator] 🔄 Data too old (${age}ms) - proceeding with fetch`);
        }
      }

      // Wait for credentials to be set (with timeout to prevent infinite wait)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Credentials timeout after 10s')), 10000)
      );

      try {
        LogHelper.log(`[Orchestrator] â³ Waiting for credentials to be set...`);
        await Promise.race([credentialsPromise, timeoutPromise]);
        LogHelper.log(`[Orchestrator] âœ… Credentials available, proceeding with fetch`);
      } catch (err) {
        LogHelper.error(`[Orchestrator] âš ï¸ Credentials timeout - ${err.message}`);
        throw new Error('Credentials not available - initialization timeout');
      }

      // Log current credential state after waiting
      LogHelper.log(`[Orchestrator] ðŸ” Current credentials state:`, {
        CLIENT_ID: CLIENT_ID || "âŒ EMPTY",
        CLIENT_SECRET_length: CLIENT_SECRET?.length || 0,
        CUSTOMER_ING_ID: CUSTOMER_ING_ID || "âŒ EMPTY"
      });

      // Validate credentials exist
      if (!CLIENT_ID || !CLIENT_SECRET) {
        LogHelper.error(`[Orchestrator] âŒ Credentials validation failed:`, {
          CLIENT_ID: CLIENT_ID || "MISSING",
          CLIENT_SECRET_exists: !!CLIENT_SECRET,
          CUSTOMER_ING_ID: CUSTOMER_ING_ID || "MISSING"
        });
        throw new Error('Missing CLIENT_ID or CLIENT_SECRET - credentials not configured');
      }

      const clientId = CLIENT_ID;
      const clientSecret = CLIENT_SECRET;

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

      // Validate customer ID exists
      if (!CUSTOMER_ING_ID) {
        throw new Error('Missing CUSTOMER_ING_ID - customer not configured');
      }

      const customerId = CUSTOMER_ING_ID;

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
        label: row.name || row.label || row.identifier || row.id,  // â† API usa "name", nÃ£o "label"
        value: Number(row.total_value || 0),
        perc: 0,
        deviceType: row.deviceType || 'energy',
        slaveId: row.slaveId || null,
        centralId: row.centralId || null
      }));

      // DEBUG: Log sample item with value
      if (items.length > 0 && items[0].value > 0) {
        LogHelper.log(`[Orchestrator] ðŸ” Sample API row â†’ item:`, {
          api_row: { id: rows[0].id, total_value: rows[0].total_value, name: rows[0].name },
          mapped_item: { id: items[0].id, ingestionId: items[0].ingestionId, value: items[0].value, label: items[0].label }
        });
      }

      LogHelper.log(`[Orchestrator] fetchAndEnrich: fetched ${items.length} items for domain ${domain}`);
      return items;
    } catch (error) {
      LogHelper.error(`[Orchestrator] fetchAndEnrich error for domain ${domain}:`, error);
      return [];
    }
  }

  /**
   * RFC-0054 Solução 1: Extrai período da cache key, ignorando customerTB_ID
   * @param {string} cacheKey - Ex: 'null:energy:2025-10-01...:day' ou '20b93da0:energy:2025-10-01...:day'
   * @returns {string} Ex: 'energy:2025-10-01...:day'
   */
  function extractPeriod(cacheKey) {
    if (!cacheKey) return '';
    const parts = cacheKey.split(':');
    return parts.slice(1).join(':'); // Remove primeiro segmento (customerTB_ID)
  }

  // PHASE 1 & 2: Enhanced hydrateDomain with centralized busy and mutex
  async function hydrateDomain(domain, period) {
    const key = cacheKey(domain, period);
    const startTime = Date.now();

    LogHelper.log(`[Orchestrator] hydrateDomain called for ${domain}:`, { key, inFlight: inFlight.has(key) });


    // RFC-0054 FIX 2: Early return ANTES do mutex - verifica se há dados recentes disponíveis
    const recent = OrchestratorState.cache[domain];
    if (recent && (Date.now() - recent.timestamp) < 30000) {
      const recentPeriod = extractPeriod(recent.periodKey);
      const currentPeriod = extractPeriod(key);

      if (recentPeriod === currentPeriod) {
        LogHelper.log(`[Orchestrator] ⏭️ Early return in hydrateDomain - recent data available for ${domain}`);
        LogHelper.log(`[Orchestrator] 📊 Using cached: ${recent.periodKey}, Requested: ${key}`);

        // Emitir dados imediatamente sem aguardar mutex
        emitProvide(domain, recent.periodKey, recent.items);

        return recent.items;
      } else {
        LogHelper.log(`[Orchestrator] 🔄 Different period - proceeding: recent=${recentPeriod}, current=${currentPeriod}`);

        // RFC-0054 FIX 3: Liberar mutex quando período muda para evitar deadlock
        if (sharedWidgetState.mutexMap.get(domain)) {
          LogHelper.log(`[Orchestrator] 🔓 Releasing mutex for ${domain} - period changed`);
          sharedWidgetState.mutexMap.set(domain, false);
        }
      }
    }

    // RFC-0052: Log cache status
    if (config?.enableCache) {
      LogHelper.log(`[Orchestrator] ðŸ” Checking cache for ${domain}...`);
    } else {
      LogHelper.log(`[Orchestrator] ðŸ”„ Cache disabled - will fetch fresh data for ${domain}...`);
    }

    // PHASE 2: Mutex to prevent duplicate requests across widgets
    // RFC-0054 FIX: Add timeout to prevent infinite waiting (deadlock prevention)
    if (sharedWidgetState.mutexMap.get(domain)) {
      LogHelper.log(`[Orchestrator] â¸ï¸ Waiting for mutex release...`);
      const mutexTimeout = 5000;
      const startWait = Date.now();

      await new Promise((resolve, reject) => {
        const checkMutex = () => {
          const waitTime = Date.now() - startWait;

          if (!sharedWidgetState.mutexMap.get(domain)) {
            LogHelper.log(`[Orchestrator] Mutex released after ${waitTime}ms`);
            resolve();
          } else if (waitTime >= mutexTimeout) {
            LogHelper.error(`[Orchestrator] Mutex timeout after ${mutexTimeout}ms - forcing release to prevent deadlock`);
            LogHelper.error(`[Orchestrator] Force releasing mutex for domain: ${domain}`);
            sharedWidgetState.mutexMap.set(domain, false);
            resolve();
          } else {
            setTimeout(checkMutex, 50);
          }
        };
        checkMutex();
      });
    }

    if (inFlight.has(key)) {
      LogHelper.log(`[Orchestrator] â­ï¸ Coalescing duplicate request for ${key}`);
      return inFlight.get(key);
    }

    const cached = readCache(key);

    // IMPORTANT: Emit cached data immediately (no debounce)
    // Debounce was causing race conditions with fresh data
    if (cached) {
      LogHelper.log(`[Orchestrator] ðŸŽ¯ Cache hit for ${domain}, fresh: ${cached.fresh}`);
      emitProvide(domain, key, cached.data);
      metrics.recordHydration(domain, Date.now() - startTime, true);

      if (cached.fresh) {
        // IMPORTANT: Always hide busy for fresh cache hits
        LogHelper.log(`[Orchestrator] âœ… Fresh cache hit - hiding busy immediately`);
        setTimeout(() => hideGlobalBusy(domain), 100); // Small delay to ensure UI update
        return cached.data;
      }
  
    // RFC-0054: No-busy refresh — se já emitimos dados recentemente para o mesmo período,
    // reemitir sem abrir modal e retornar imediatamente
    try {
      const recent = OrchestratorState.cache[domain];

      if (recent && (Date.now() - recent.timestamp) < 30000) {
        const recentPeriod = extractPeriod(recent.periodKey);
        const currentPeriod = extractPeriod(key);

        if (recentPeriod === currentPeriod) {
          LogHelper.log(`[Orchestrator] ⏭️ No-busy refresh for ${domain} (recent data, period match)`);
          if (recent.periodKey !== key) {
            LogHelper.log(`[Orchestrator] 📝 Cache key mismatch ignored: ${key} vs ${recent.periodKey}`);
          }
          emitProvide(domain, recent.periodKey, recent.items);
          return recent.items; // ✅ Retorna dados recentes mesmo com customerTB_ID diferente
        }
      }
    } catch (e) {
      LogHelper.warn(`[Orchestrator] ⚠️ Cache check failed:`, e);
    }
  }

    // PHASE 1: Show centralized busy overlay
    showGlobalBusy(domain, 'Carregando dados...');
    
    // PHASE 2: Set mutex for coordination
    // RFC-0054 FIX: Lock mutex POR DOMÍNIO

    sharedWidgetState.mutexMap.set(domain, true);
    sharedWidgetState.activePeriod = period;

    const fetchPromise = (async () => {
      try {
        const items = await fetchAndEnrich(domain, period);

        writeCache(key, items);

        emitHydrated(domain, key, items.length);

        // IMPORTANT: Emit immediately for fresh data (no debounce)
        // Debounce caused issues where empty data was emitted before fetch completed
        emitProvide(domain, key, items);
        LogHelper.log(`[Orchestrator] 📡 Emitted provide-data for ${domain} with ${items.length} items`);

        // RFC-0054 Solução 3: Cancelar requisições pendentes para o mesmo período
        const currentPeriod = extractPeriod(key);
        let canceledCount = 0;

        inFlight.forEach((promise, pendingKey) => {
          if (pendingKey !== key) { // Não cancelar a própria requisição
            const pendingPeriod = extractPeriod(pendingKey);

            if (pendingPeriod === currentPeriod) {
              LogHelper.log(`[Orchestrator] ❌ Canceling redundant request: ${pendingKey}`);
              inFlight.delete(pendingKey);
              canceledCount++;
            }
          }
        });

        if (canceledCount > 0) {
          LogHelper.log(`[Orchestrator] 🧹 Canceled ${canceledCount} redundant requests for ${domain}`);
        }

        const duration = Date.now() - startTime;
        metrics.recordHydration(domain, duration, false);

        LogHelper.log(`[Orchestrator] âœ… Fresh data fetched for ${domain} in ${duration}ms`);
        return items;
      } catch (error) {
        LogHelper.error(`[Orchestrator] âŒ Error fetching ${domain}:`, error);
        metrics.recordError(domain, error);
        emitError(domain, error);
        throw error;
      } finally {
        // PHASE 1: Hide busy overlay
        LogHelper.log(`[Orchestrator] 🏁 Finally block - hiding busy for ${domain}`);
        hideGlobalBusy(domain);

        // RFC-0054 Solução 2: Mutex Condicional - não liberar se há dados recentes válidos
        const hasRecentData = OrchestratorState.cache[domain] &&
                              (Date.now() - OrchestratorState.cache[domain].timestamp) < 30000;

        if (hasRecentData) {
          const recentPeriod = extractPeriod(OrchestratorState.cache[domain].periodKey);
          const currentPeriod = extractPeriod(key);

          if (recentPeriod === currentPeriod) {
            LogHelper.log(`[Orchestrator] ⏭️ Keeping mutex locked - recent data available for ${domain}`);
            LogHelper.log(`[Orchestrator] 📊 Cache: ${OrchestratorState.cache[domain].periodKey}, Request: ${key}`);
            // NÃO libera mutex - previne requisições duplicadas
          } else {
            sharedWidgetState.mutexMap.set(domain, false);
            LogHelper.log(`[Orchestrator] 🔓 Mutex released for ${domain} - different period`);
          }
        } else {
          sharedWidgetState.mutexMap.set(domain, false);
          LogHelper.log(`[Orchestrator] 🔓 Mutex released for ${domain} - no recent data`);
        }
      }
    })()
      .finally(() => {
        inFlight.delete(key);
        LogHelper.log(`[Orchestrator] ðŸ§¹ Cleaned up inFlight for ${key}`);
      });

    inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  // RFC-0053: Simplified event emission (no iframes!)
  // Replaced 3-layer forwarding (current + parent + children) with single window emission
  function emitToAllContexts(eventName, detail) {
    // Single window context - all widgets in same window
    window.dispatchEvent(new CustomEvent(eventName, { detail }));

    if (config?.debugMode) {
      LogHelper.log(`[Orchestrator] ðŸ“¡ RFC-0053: Emitted ${eventName} (single context)`, detail);
    }
  }

  // RFC-0045: Enhanced emitProvide with deduplication and retry
  function emitProvide(domain, periodKey, items) {
    const now = Date.now();
    const key = `${domain}_${periodKey}`;

    // RFC-0045 FIX 3: Don't emit empty arrays
    // Empty data propagates to widgets causing them to show zero values
    if (!items || items.length === 0) {
      LogHelper.warn(`[Orchestrator] âš ï¸ Skipping emitProvide for ${domain} - no items to emit`);
      return;
    }

    // 1. PREVENT DUPLICATE EMISSIONS (< 100ms)
    if (OrchestratorState.lastEmission[key]) {
      const timeSinceLastEmit = now - OrchestratorState.lastEmission[key];
      if (timeSinceLastEmit < 100) {
        LogHelper.log(`[Orchestrator] â­ï¸ Skipping duplicate emission for ${domain} (${timeSinceLastEmit}ms ago)`);
        return;
      }
    }

    OrchestratorState.lastEmission[key] = now;

    // 2. STORE IN CACHE WITH VERSION (Single Source of Truth)
    if (!window.MyIOOrchestratorData) {
      window.MyIOOrchestratorData = {};
    }

    const version = (window.MyIOOrchestratorData[domain]?.version || 0) + 1;

    window.MyIOOrchestratorData[domain] = {
      periodKey,
      items,
      timestamp: now,
      version: version
    };

    OrchestratorState.cache[domain] = {
      periodKey,
      items,
      timestamp: now,
      version: version
    };

    LogHelper.log(`[Orchestrator] ðŸ“¦ Cache updated for ${domain}: ${items.length} items (v${version})`);

    // 3. EMIT EVENT TO ALL CONTEXTS
    const eventDetail = { domain, periodKey, items, version };

    // 3a. Emit to current window
    window.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', { detail: eventDetail }));

    try { lastProvide.set(domain, { periodKey, at: Date.now() }); hideGlobalBusy(domain); } catch (e) {}
    // RFC-0053: Contexto Ãºnico â€” sem emissÃ£o para parent/iframes
    // Todos os widgets recebem via window.dispatchEvent acima

    // 4. MARK AS NOT LOADING
    OrchestratorState.loading[domain] = false;

    // 5. PROCESS PENDING LISTENERS (widgets that arrived late)
    if (OrchestratorState.pendingListeners[domain]) {
      LogHelper.log(`[Orchestrator] ðŸ”” Processing ${OrchestratorState.pendingListeners[domain].length} pending listeners for ${domain}`);

      OrchestratorState.pendingListeners[domain].forEach(callback => {
        try {
          callback({ detail: eventDetail });
        } catch (err) {
          LogHelper.error(`[Orchestrator] Error calling pending listener:`, err);
        }
      });

      delete OrchestratorState.pendingListeners[domain];
    }

    LogHelper.log(`[Orchestrator] ðŸ“¡ Emitted provide-data for ${domain} with ${items.length} items`);
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

      if (config?.debugMode) LogHelper.log('[Orchestrator] Tokens rotated');
    },

    getToken(type) {
      return this.tokens[type] || null;
    },

    setToken(type, value) {
      this.tokens[type] = value;
    }
  };

  // RFC-0045: Widget registration system for priority management
  /**
   * Registra widget com prioridade baseada na ordem de inicializaÃ§Ã£o
   */
  function registerWidget(widgetId, domain) {
    if (!OrchestratorState.widgetPriority.includes(widgetId)) {
      OrchestratorState.widgetPriority.push(widgetId);

      const priority = OrchestratorState.widgetPriority.indexOf(widgetId) + 1;

      // Store in registry with metadata
      OrchestratorState.widgetRegistry.set(widgetId, {
        domain,
        registeredAt: Date.now(),
        priority
      });

      LogHelper.log(`[Orchestrator] ðŸ“ Widget registered: ${widgetId} (domain: ${domain}, priority: ${priority})`);
    }
  }

  /**
   * Listener para widgets se registrarem
   */
  window.addEventListener('myio:widget:register', (ev) => {
    const { widgetId, domain } = ev.detail;
    registerWidget(widgetId, domain);
  });

  // Event listeners
  window.addEventListener('myio:update-date', (ev) => {
    LogHelper.log('[Orchestrator] ðŸ“… Received myio:update-date event', ev.detail);
    currentPeriod = ev.detail.period;

    // RFC-0042: Cross-context emission removed - HEADER already handles this
    // No need to re-emit here as it creates infinite loop

    if (visibleTab && currentPeriod) {
      LogHelper.log(`[Orchestrator] ðŸ“… myio:update-date â†’ hydrateDomain(${visibleTab})`);
      hydrateDomain(visibleTab, currentPeriod);
    }
  });

  window.addEventListener('myio:dashboard-state', (ev) => {
    try { hideGlobalBusy(domain); } catch (e) {}
    visibleTab = ev.detail.tab;
    if (visibleTab && currentPeriod) {
      LogHelper.log(`[Orchestrator] 🔄 myio:dashboard-state → hydrateDomain(${visibleTab})`);
      hydrateDomain(visibleTab, currentPeriod);
    } else {
      LogHelper.log(`[Orchestrator] 🔄 myio:dashboard-state skipped (visibleTab=${visibleTab}, currentPeriod=${!!currentPeriod})`);
    }
  });

  // RFC-0045: Enhanced request-data listener with priority and pending listeners
  window.addEventListener('myio:telemetry:request-data', async (ev) => {
    const { domain, period, widgetId, priority } = ev.detail;

    LogHelper.log(`[Orchestrator] ðŸ“¨ Received data request from widget ${widgetId} (domain: ${domain}, priority: ${priority})`);

    // Verificar se jÃ¡ temos dados frescos no cache
    const cached = OrchestratorState.cache[domain];
    if (cached && (Date.now() - cached.timestamp < 30000)) {
      LogHelper.log(`[Orchestrator] âœ… Serving from cache for ${domain} (age: ${Date.now() - cached.timestamp}ms)`);
      emitProvide(domain, cached.periodKey, cached.items);
      return;
    }

    // Verificar se jÃ¡ estÃ¡ em progresso
    if (OrchestratorState.loading[domain]) {
      LogHelper.log(`[Orchestrator] â³ Already loading ${domain}, adding to pending listeners`);

      // Adicionar listener pendente
      if (!OrchestratorState.pendingListeners[domain]) {
        OrchestratorState.pendingListeners[domain] = [];
      }

      OrchestratorState.pendingListeners[domain].push((data) => {
        // Emitir diretamente para o widget solicitante
        window.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', { detail: data.detail }));
    try { lastProvide.set(domain, { periodKey, at: Date.now() }); hideGlobalBusy(domain); } catch (e) {}
      });

      return;
    }

    // Buscar dados frescos
    OrchestratorState.loading[domain] = true;

    try {
      const p = period || currentPeriod;
      if (p) {
        LogHelper.log(`[Orchestrator] ðŸ“¡ myio:telemetry:request-data â†’ hydrateDomain(${domain})`);
        await hydrateDomain(domain, p);
      } else {
        LogHelper.log(`[Orchestrator] ðŸ“¡ myio:telemetry:request-data skipped (no period)`);
        OrchestratorState.loading[domain] = false;
      }
    } catch (error) {
      LogHelper.error(`[Orchestrator] Error hydrating ${domain}:`, error);
      OrchestratorState.loading[domain] = false;
    }
  });

  // RFC-0047: Enhanced cleanup interval with localStorage sync
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean memCache
    for (const [key, entry] of memCache.entries()) {
      const age = now - entry.cachedAt; // RFC-0047: Use cachedAt instead of hydratedAt
      // RFC-0047: Clean entries older than TTL (not 2x TTL)
      if (age > entry.ttlMinutes * 60_000) {
        memCache.delete(key);
        cleanedCount++;

        // Also remove from localStorage
        try {
          localStorage.removeItem(`myio:cache:${key}`);
        } catch (e) {
          LogHelper.warn('[Orchestrator] Failed to remove from localStorage:', e);
        }
      }
    }

    if (cleanedCount > 0) {
      LogHelper.log(`[Orchestrator] ðŸ§¹ Periodic cleanup: removed ${cleanedCount} expired entries`);
    }

    // RFC-0047: Also clean localStorage periodically
    cleanupExpiredCache();
  }, 10 * 60 * 1000); // Every 10 minutes

  // Telemetry reporting
  if (!config?.debugMode && typeof window.tbClient !== 'undefined') {
    setInterval(() => {
      try {
        window.tbClient.sendTelemetry(metrics.generateTelemetrySummary());
      } catch (e) {
        LogHelper.warn('[Orchestrator] Failed to send telemetry:', e);
      }
    }, 5 * 60 * 1000);
  }

  // RFC-0048: Widget Busy Monitor - Detects stuck widgets showing busy for too long
  const widgetBusyMonitor = {
    timers: new Map(), // domain -> timeoutId
    TIMEOUT_MS: 30000, // 30 seconds

    startMonitoring(domain) {
      // Clear existing timer if any
      this.stopMonitoring(domain);

      const timerId = setTimeout(() => {
        LogHelper.error(`[WidgetMonitor] âš ï¸ Widget ${domain} has been showing busy for more than ${this.TIMEOUT_MS/1000}s!`);
        LogHelper.error(`[WidgetMonitor] Possible issues:`);
        LogHelper.error(`[WidgetMonitor] 1. Widget nÃ£o recebeu dados do orchestrator`);
        LogHelper.error(`[WidgetMonitor] 2. Widget recebeu dados vazios mas nÃ£o chamou hideBusy()`);
        LogHelper.error(`[WidgetMonitor] 3. Erro silencioso impedindo processamento`);

        // Log current busy state
        const busyState = globalBusyState;
        LogHelper.error(`[WidgetMonitor] Current busy state:`, busyState);

        // Log cache state for this domain
        const cacheKey = `${domain}:${currentPeriod?.startISO || 'unknown'}:${currentPeriod?.endISO || 'unknown'}`;
        const cached = memCache.get(cacheKey);
        LogHelper.error(`[WidgetMonitor] Cache state for ${domain}:`, {
          hasCachedData: !!cached,
          itemCount: cached?.items?.length || 0,
          cachedAt: cached?.cachedAt ? new Date(cached.cachedAt).toISOString() : 'never'
        });

        // Attempt auto-recovery: force hide busy for stuck widget
        LogHelper.warn(`[WidgetMonitor] ðŸ”§ Attempting auto-recovery: forcing hideBusy for ${domain}`);
        hideGlobalBusy(domain);
      }, this.TIMEOUT_MS);

      this.timers.set(domain, timerId);
      LogHelper.log(`[WidgetMonitor] âœ… Started monitoring ${domain} (timeout: ${this.TIMEOUT_MS/1000}s)`);
    },

    stopMonitoring(domain) {
      const timerId = this.timers.get(domain);
      if (timerId) {
        clearTimeout(timerId);
        this.timers.delete(domain);
        LogHelper.log(`[WidgetMonitor] âœ… Stopped monitoring ${domain}`);
      }
    },

    stopAll() {
      for (const [domain, timerId] of this.timers.entries()) {
        clearTimeout(timerId);
        LogHelper.log(`[WidgetMonitor] âœ… Stopped monitoring ${domain}`);
      }
      this.timers.clear();
    }
  };

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

    // RFC-0044: PHASE 1 - Expose centralized busy management
    showGlobalBusy,
    hideGlobalBusy,

    // RFC-0044: PHASE 2 - Expose shared state
    getSharedWidgetState: () => sharedWidgetState,
    setSharedPeriod: (period) => { sharedWidgetState.activePeriod = period; },

    // RFC-0044: PHASE 4 - Expose busy state for debugging
    getBusyState: () => ({ ...globalBusyState }),

    // RFC-0048: Expose widget busy monitor
    widgetBusyMonitor,

    setCredentials: (customerId, clientId, clientSecret) => {
      LogHelper.log(`[Orchestrator] ðŸ” setCredentials called with:`, {
        customerId,
        clientId,
        clientSecretLength: clientSecret?.length || 0
      });

      CUSTOMER_ING_ID = customerId;
      CLIENT_ID = clientId;
      CLIENT_SECRET = clientSecret;

      LogHelper.log(`[Orchestrator] âœ… Credentials set successfully:`, {
        CUSTOMER_ING_ID,
        CLIENT_ID,
        CLIENT_SECRET_length: CLIENT_SECRET?.length || 0
      });

      // RFC-0051.2: Mark credentials as set
      if (window.MyIOOrchestrator) {
        window.MyIOOrchestrator.credentialsSet = true;
      }

      // Resolve the promise to unblock waiting fetchAndEnrich calls
      if (credentialsResolver) {
        credentialsResolver();
        LogHelper.log(`[Orchestrator] âœ… Credentials promise resolved - unblocking pending requests`);
      }
    },

    getCredentials: () => {
      return {
        CUSTOMER_ING_ID,
        CLIENT_ID,
        CLIENT_SECRET_length: CLIENT_SECRET?.length || 0
      };
    },

    destroy: () => {
      clearInterval(cleanupInterval);
      invalidateCache('*');

      // RFC-0048: Stop all widget monitors
      widgetBusyMonitor.stopAll();

      // RFC-0044: Clean up busy overlay on destroy
      hideGlobalBusy(domain);
      const busyEl = document.getElementById(BUSY_OVERLAY_ID);
      if (busyEl && busyEl.parentNode) {
        busyEl.parentNode.removeChild(busyEl);
      }
    }
  };
})();

// RFC-0051.2: Update stub with real implementation and mark as ready
if (window.MyIOOrchestrator && !window.MyIOOrchestrator.isReady) {
  // Merge real implementation with stub
  Object.assign(window.MyIOOrchestrator, MyIOOrchestrator);

  // Mark as ready
  window.MyIOOrchestrator.isReady = true;
  window.MyIOOrchestrator.credentialsSet = false; // Will be set by setCredentials()

  LogHelper.log('[Orchestrator] âœ… Orchestrator fully initialized and ready');

  // Emit ready event for widgets that are waiting
  window.dispatchEvent(new CustomEvent('myio:orchestrator:ready', {
    detail: { timestamp: Date.now() }
  }));

  LogHelper.log('[Orchestrator] ðŸ“¢ Emitted myio:orchestrator:ready event');
} else {
  // Fallback: no stub exists (shouldn't happen but be safe)
  window.MyIOOrchestrator = MyIOOrchestrator;
  window.MyIOOrchestrator.isReady = true;
  window.MyIOOrchestrator.credentialsSet = false;

  LogHelper.log('[MyIOOrchestrator] Initialized (no stub found)');
}
