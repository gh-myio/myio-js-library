/* global self, window, document, localStorage, MyIOLibrary, ResizeObserver */

/*********************************************************
 * MYIO – Container 2 states (menu/content)
 * - Ajusta alturas automaticamente
 * - Suporta "menu compacto" via evento global
 * - Mantém simples: os tb-dashboard-state renderizam os
 * dashboards configurados no próprio ThingsBoard.
 *********************************************************/

// Debug configuration - can be toggled at runtime via window.MyIOUtils.setDebug(true/false)
let DEBUG_ACTIVE = true;

// LogHelper utility - shared across all widgets in this context
const LogHelper = {
  log: function (...args) {
    if (DEBUG_ACTIVE) {
      console.log(...args);
    }
  },
  warn: function (...args) {
    if (DEBUG_ACTIVE) {
      console.warn(...args);
    }
  },
  error: function (...args) {
    // Errors always logged regardless of DEBUG_ACTIVE
    console.error(...args);
  },
};

// RFC-0091: Expose shared utilities globally for child widgets (TELEMETRY, etc.)
// RFC-0091: Shared constants across all widgets
const DATA_API_HOST = 'https://api.data.apps.myio-bas.com';

window.MyIOUtils = window.MyIOUtils || {};
Object.assign(window.MyIOUtils, {
  LogHelper,
  DATA_API_HOST,
  isDebugActive: () => DEBUG_ACTIVE,
  setDebug: (active) => {
    DEBUG_ACTIVE = !!active;
    console.log(`[MyIOUtils] Debug mode ${DEBUG_ACTIVE ? 'enabled' : 'disabled'}`);
  },
  // Temperature domain: global min/max temperature limits (populated by onDataUpdated)
  temperatureLimits: {
    minTemperature: null,
    maxTemperature: null,
  },
  /**
   * Handle 401 Unauthorized errors globally
   * Shows toast message and reloads the page
   * @param {string} context - Context description for logging (e.g., 'TemperatureSettingsModal')
   */
  handleUnauthorizedError: (context = 'API') => {
    LogHelper.error(`[MyIOUtils] 401 Unauthorized in ${context} - session expired`);

    // Get MyIOToast from library
    const MyIOToast = window.MyIOLibrary?.MyIOToast;
    if (MyIOToast) {
      MyIOToast.error('Sessão expirada. Recarregando página...', 3000);
    } else {
      console.error('[MyIOUtils] Sessão expirada. Recarregando página...');
    }

    // Reload page after toast displays
    setTimeout(() => {
      window.location.reload();
    }, 2500);
  },
});
// Expose customerTB_ID via getter (reads from MyIOOrchestrator when available)
// Check if property already exists to avoid "Cannot redefine property" error
if (!Object.prototype.hasOwnProperty.call(window.MyIOUtils, 'customerTB_ID')) {
  Object.defineProperty(window.MyIOUtils, 'customerTB_ID', {
    get: () => window.MyIOOrchestrator?.customerTB_ID || null,
    enumerable: true,
    configurable: true, // Allow redefinition if needed
  });
}

// RFC-0051.1: Global widget settings (will be populated in onInit)
// IMPORTANT: customerTB_ID must NEVER be 'default' - it must always be a valid ThingsBoard ID
let widgetSettings = {
  customerTB_ID: null, // MUST be set in onInit
  debugMode: false,
  domainsEnabled: { energy: true, water: true, temperature: true },
};

// Config object (populated in onInit from widgetSettings)
let config = null;

(function () {
  // Utilitários DOM
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  let rootEl;

  // Atualiza a altura útil do conteúdo e garante que os elementos estão bem posicionados
  function applySizing() {
    try {
      // Força recálculo do layout se necessário
      if (rootEl) {
        rootEl.style.display = 'grid';

        // Garante que os tb-child elementos do MENU n�o tenham overflow issues
        const menu = $('.myio-menu', rootEl);
        if (menu) {
          const menuChildren = $$('.tb-child', menu);
          menuChildren.forEach((child) => {
            child.style.overflow = 'hidden';
            child.style.width = '100%';
            child.style.height = '100%';
          });
        }

        // Especial tratamento para o conte�do principal - permite scroll nos widgets
        const content = $('.myio-content', rootEl);
        if (content) {
          // Primeiro: container direto do content deve ter overflow auto para controlar scroll
          const contentChild = $('.tb-child', content);
          if (contentChild) {
            contentChild.style.overflow = 'auto'; // Mudado de 'visible' para 'auto'
            contentChild.style.height = '100%';
            contentChild.style.width = '100%';
          }

          // Segundo: dentro dos states, os widgets individuais tamb�m precisam de scroll
          const stateContainers = $$('[data-content-state]', content);
          LogHelper.log(`[MAIN_VIEW] Found ${stateContainers.length} state containers`);
          stateContainers.forEach((stateContainer, idx) => {
            const widgetsInState = $$('.tb-child', stateContainer);
            LogHelper.log(`[MAIN_VIEW] State ${idx}: ${widgetsInState.length} widgets found`, {
              state: stateContainer.getAttribute('data-content-state'),
              display: stateContainer.style.display,
            });
            widgetsInState.forEach((widget, widgetIdx) => {
              const before = widget.style.overflow;
              widget.style.overflow = 'auto';
              widget.style.width = '100%';
              widget.style.height = '100%';
              LogHelper.log(`[MAIN_VIEW]   Widget ${widgetIdx}: overflow ${before} ? auto`);
            });
          });

          // Diagnóstico: logar dimensões do container visível
          const visible = Array.from(content.querySelectorAll('[data-content-state]')).find(
            (div) => div.style.display !== 'none'
          );
          if (visible) {
            const r1 = content.getBoundingClientRect();
            const r2 = visible.getBoundingClientRect();
            const r3 = contentChild ? contentChild.getBoundingClientRect() : null;
            LogHelper.log('[MAIN_VIEW] sizing content dims', {
              content: { w: r1.width, h: r1.height },
              visible: { w: r2.width, h: r2.height },
              child: r3 ? { w: r3.width, h: r3.height } : null,
            });
          }
        }
      }
    } catch (e) {
      LogHelper.warn('[myio-container] sizing warn:', e);
    }
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

    // Populate global widget settings early to avoid undefined errors
    // These settings are available globally to all functions

    // CRITICAL: customerTB_ID MUST be set - abort if missing
    const customerTB_ID = self.ctx.settings?.customerTB_ID;
    if (!customerTB_ID) {
      LogHelper.error('[Orchestrator] ❌ CRITICAL: customerTB_ID is missing from widget settings!');
      LogHelper.error(
        '[Orchestrator] Widget cannot function without customerTB_ID. Please configure it in widget settings.'
      );
      throw new Error('customerTB_ID is required but not found in widget settings');
    }

    widgetSettings.customerTB_ID = customerTB_ID;

    // RFC-0085: Expose customerTB_ID globally for MENU and other widgets
    if (window.MyIOOrchestrator) {
      window.MyIOOrchestrator.customerTB_ID = customerTB_ID;
    }

    widgetSettings.debugMode = self.ctx.settings?.debugMode ?? false;
    widgetSettings.domainsEnabled = self.ctx.settings?.domainsEnabled ?? {
      energy: true,
      water: true,
      temperature: true,
    };

    LogHelper.log('[Orchestrator] 📋 Widget settings captured:', {
      customerTB_ID: widgetSettings.customerTB_ID,
      debugMode: widgetSettings.debugMode,
    });

    // Initialize config from widgetSettings
    config = {
      debugMode: widgetSettings.debugMode,
      domainsEnabled: widgetSettings.domainsEnabled,
    };

    LogHelper.log('[Orchestrator] 🔧 Config initialized from settings:', config);

    // RFC-0051.2: Expose orchestrator stub IMMEDIATELY
    // This prevents race conditions with TELEMETRY widgets that check for orchestrator
    // We expose a stub with isReady flag that will be set to true when fully initialized
    if (!window.MyIOOrchestrator) {
      window.MyIOOrchestrator = {
        // Status flags
        isReady: false,
        credentialsSet: false,

        // Customer ID from settings (for MENU and other widgets)
        customerTB_ID: null,

        // Data access methods (will be populated later)
        getCurrentPeriod: () => null,
        getCredentials: () => null,

        // Credential management (will be populated later)
        setCredentials: async (customerId, clientId, clientSecret) => {
          LogHelper.warn('[Orchestrator] ⚠️ setCredentials called before orchestrator is ready');
        },

        // Token manager stub
        tokenManager: {
          setToken: (key, token) => {
            LogHelper.warn('[Orchestrator] ⚠️ tokenManager.setToken called before orchestrator is ready');
          },
        },

        // Internal state (will be populated later)
        inFlight: {},
      };

      LogHelper.log('[Orchestrator] ⚡ Exposed to window.MyIOOrchestrator EARLY (stub mode)');
    }

    registerGlobalEvents();
    setupResizeObserver();

    // Initialize MyIO Library and Authentication
    const MyIO =
      (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) ||
      (typeof window !== 'undefined' && window.MyIOLibrary) ||
      null;

    if (MyIO) {
      try {
        // RFC-0051.1: Use widgetSettings from closure
        const customerTB_ID = widgetSettings.customerTB_ID !== 'default' ? widgetSettings.customerTB_ID : '';
        const jwt = localStorage.getItem('jwt_token');

        LogHelper.log('[MAIN_VIEW] 🔍 Credentials fetch starting...');
        LogHelper.log(
          '[MAIN_VIEW] customerTB_ID:',
          customerTB_ID ? customerTB_ID : '❌ NOT FOUND IN SETTINGS'
        );
        LogHelper.log('[MAIN_VIEW] jwt token:', jwt ? '✅ FOUND' : '❌ NOT FOUND IN localStorage');

        let CLIENT_ID = '';
        let CLIENT_SECRET = '';
        let CUSTOMER_ING_ID = '';

        if (customerTB_ID && jwt) {
          try {
            LogHelper.log('[MAIN_VIEW] 📡 Fetching customer attributes from ThingsBoard...');
            // Fetch customer attributes
            const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);

            LogHelper.log('[MAIN_VIEW] 📦 Received attrs:', attrs);

            CLIENT_ID = attrs?.client_id || '';
            CLIENT_SECRET = attrs?.client_secret || '';
            CUSTOMER_ING_ID = attrs?.ingestionId || '';

            LogHelper.log('[MAIN_VIEW] 🔑 Parsed credentials:');
            LogHelper.log('[MAIN_VIEW]   CLIENT_ID:', CLIENT_ID ? '✅ ' + CLIENT_ID : '❌ EMPTY');
            LogHelper.log(
              '[MAIN_VIEW]   CLIENT_SECRET:',
              CLIENT_SECRET ? '✅ ' + CLIENT_SECRET.substring(0, 10) + '...' : '❌ EMPTY'
            );
            LogHelper.log(
              '[MAIN_VIEW]   CUSTOMER_ING_ID:',
              CUSTOMER_ING_ID ? '✅ ' + CUSTOMER_ING_ID : '❌ EMPTY'
            );
          } catch (err) {
            LogHelper.error('[MAIN_VIEW] ❌ Failed to fetch customer attributes:', err);
            LogHelper.error('[MAIN_VIEW] Error details:', {
              message: err.message,
              stack: err.stack,
              name: err.name,
            });
          }
        } else {
          LogHelper.warn('[MAIN_VIEW] ⚠️ Cannot fetch credentials - missing required data:');
          if (!customerTB_ID) LogHelper.warn('[MAIN_VIEW]   - customerTB_ID is missing from settings');
          if (!jwt) LogHelper.warn('[MAIN_VIEW]   - JWT token is missing from localStorage');
        }

        // Check if credentials are present
        if (!CLIENT_ID || !CLIENT_SECRET || !CUSTOMER_ING_ID) {
          LogHelper.warn(
            '[MAIN_VIEW] Missing credentials - CLIENT_ID, CLIENT_SECRET, or CUSTOMER_ING_ID not found'
          );
          LogHelper.warn(
            "[MAIN_VIEW] Orchestrator will be available but won't be able to fetch data without credentials"
          );

          // RFC-0054 FIX: Dispatch initial tab event even without credentials (with delay)
          // This enables HEADER controls, even though data fetch will fail
          LogHelper.log(
            '[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...'
          );
          setTimeout(() => {
            LogHelper.log(
              '[MAIN_VIEW] Dispatching initial tab event for default state: energy (no credentials)'
            );
            window.dispatchEvent(
              new CustomEvent('myio:dashboard-state', {
                detail: { tab: 'energy' },
              })
            );
          }, 100);
        } else {
          // Set credentials in orchestrator (only if present)
          LogHelper.log('[MAIN_VIEW] 🔐 Calling MyIOOrchestrator.setCredentials...');
          LogHelper.log('[MAIN_VIEW] 🔐 Arguments:', {
            customerId: CUSTOMER_ING_ID,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET.substring(0, 10) + '...',
          });

          MyIOOrchestrator.setCredentials(CUSTOMER_ING_ID, CLIENT_ID, CLIENT_SECRET);

          LogHelper.log('[MAIN_VIEW] 🔐 setCredentials completed, verifying...');
          // Verify credentials were set
          const currentCreds = MyIOOrchestrator.getCredentials?.();
          if (currentCreds) {
            LogHelper.log('[MAIN_VIEW] ✅ Credentials verified in orchestrator:', currentCreds);
          } else {
            LogHelper.warn('[MAIN_VIEW] ⚠️ Orchestrator does not have getCredentials method');
          }

          // Build auth and get token
          const myIOAuth = MyIO.buildMyioIngestionAuth({
            dataApiHost: 'https://api.data.apps.myio-bas.com',
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
          });

          // Get token and set it in token manager
          const ingestionToken = await myIOAuth.getToken();
          MyIOOrchestrator.tokenManager.setToken('ingestionToken', ingestionToken);

          LogHelper.log('[MAIN_VIEW] Auth initialized successfully with CLIENT_ID:', CLIENT_ID);

          // Dispatch initial tab event AFTER credentials AND with delay
          // Delay ensures HEADER has time to register its listener
          LogHelper.log(
            '[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...'
          );
          setTimeout(() => {
            LogHelper.log(
              '[MAIN_VIEW] Dispatching initial tab event for default state: energy (after credentials + delay)'
            );
            window.dispatchEvent(
              new CustomEvent('myio:dashboard-state', {
                detail: { tab: 'energy' },
              })
            );
          }, 100);
        }
      } catch (err) {
        LogHelper.error('[MAIN_VIEW] Auth initialization failed:', err);

        // RFC-0054 FIX: Dispatch initial tab event even on error (with delay)
        // This enables HEADER controls, even though data fetch will fail
        LogHelper.log(
          '[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...'
        );
        setTimeout(() => {
          LogHelper.log('[MAIN_VIEW] Dispatching initial tab event for default state: energy (after error)');
          window.dispatchEvent(
            new CustomEvent('myio:dashboard-state', {
              detail: { tab: 'energy' },
            })
          );
        }, 100);
      }
    } else {
      LogHelper.warn('[MAIN_VIEW] MyIOLibrary not available');

      // RFC-0054 FIX: Dispatch initial tab event even without MyIOLibrary (with delay)
      // This enables HEADER controls, even though data fetch will fail
      LogHelper.log(
        '[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...'
      );
      setTimeout(() => {
        LogHelper.log('[MAIN_VIEW] Dispatching initial tab event for default state: energy (no MyIOLibrary)');
        window.dispatchEvent(
          new CustomEvent('myio:dashboard-state', {
            detail: { tab: 'energy' },
          })
        );
      }, 100);
    }

    // // Log útil para conferir se os states existem
    // try {
    //   const states = self.ctx?.dashboard?.configuration?.states || {};
    //   // LogHelper.log('[myio-container] states disponíveis:', Object.keys(states));
    //   // Esperados: "menu", "telemetry_content", "water_content", "temperature_content", "alarm_content", "footer"
    // } catch (e) {
    //   LogHelper.warn('[myio-container] não foi possível listar states:', e);
    // }
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

    // Extract and expose global minTemperature/maxTemperature for temperature domain
    // These values are read by TELEMETRY widget via window.MyIOUtils.temperatureLimits
    const ctxDataRows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
    ctxDataRows.forEach((data) => {
      const keyName = data?.dataKey?.name;
      if (keyName === 'maxTemperature') {
        const val = Number(data.data?.[0]?.[1]) || null;
        window.MyIOUtils.temperatureLimits.maxTemperature = val;
        LogHelper.log(`[MAIN_VIEW] Exposed global maxTemperature: ${val}`);
      }
      if (keyName === 'minTemperature') {
        const val = Number(data.data?.[0]?.[1]) || null;
        window.MyIOUtils.temperatureLimits.minTemperature = val;
        LogHelper.log(`[MAIN_VIEW] Exposed global minTemperature: ${val}`);
      }
    });
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

// ========== ORCHESTRATOR IMPLEMENTATION ==========

/**
 * Global shared state for widget coordination
 * Prevents race conditions and ensures first widget priority
 */
if (!window.MyIOOrchestratorState) {
  window.MyIOOrchestratorState = {
    // Widget registration and priority
    widgetPriority: [],
    widgetRegistry: new Map(), // widgetId -> {domain, registeredAt}

    // Loading state per domain
    loading: {},

    // Pending listeners for late-joining widgets
    pendingListeners: {},

    // Last emission timestamp per domain (deduplication)
    lastEmission: {},

    // Lock to prevent concurrent requests
    locks: {},
  };

  LogHelper.log('[Orchestrator] 🌍 Global state initialized:', window.MyIOOrchestratorState);
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
 * Generates a unique key from domain and period for request deduplication.
 */
function periodKey(domain, period) {
  const customerTbId = widgetSettings.customerTB_ID;
  return `${customerTbId}:${domain}:${period.startISO}:${period.endISO}:${period.granularity}`;
}

// ========== ORCHESTRATOR SINGLETON ==========

const MyIOOrchestrator = (() => {
  // ========== PHASE 1: BUSY OVERLAY MANAGEMENT (RFC-0044/RFC-0054) ==========
  const BUSY_OVERLAY_ID = 'myio-orchestrator-busy-overlay';
  let globalBusyState = {
    isVisible: false,
    timeoutId: null,
    startTime: null,
    currentDomain: null,
    requestCount: 0,
  };

  // RFC-0054: contador por dom�nio e cooldown p�s-provide
  const activeRequests = new Map(); // domain -> count
  const lastProvide = new Map(); // domain -> { periodKey, at }

  function getActiveTotal() {
    let total = 0;
    activeRequests.forEach((v) => {
      total += v || 0;
    });
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
  function showGlobalBusy(domain = 'unknown', message = 'Carregando dados...', timeoutMs = 25000) {
    // RFC-0054: cooldown - n�o reabrir modal se acabou de prover dados
    const lp = lastProvide.get(domain);
    if (lp && Date.now() - lp.at < 30000) {
      LogHelper.log(`[Orchestrator] ?? Cooldown active for ${domain}, skipping showGlobalBusy()`);
      return;
    }
    const totalBefore = getActiveTotal();
    const prev = activeRequests.get(domain) || 0;
    activeRequests.set(domain, prev + 1);
    LogHelper.log(
      `[Orchestrator] ?? Active requests for ${domain}: ${prev + 1} (totalBefore=${totalBefore})`
    );

    const el = ensureOrchestratorBusyDOM();
    const messageEl = el.querySelector(`#${BUSY_OVERLAY_ID}-message`);

    if (messageEl) {
      // Mensagem gen�rica para evitar r�tulo incorreto ao alternar abas
      messageEl.textContent = 'Carregando dados...';
    }

    // Clear existing timeout
    if (globalBusyState.timeoutId) {
      clearTimeout(globalBusyState.timeoutId);
      globalBusyState.timeoutId = null;
    }

    // Mostrar overlay apenas quando saiu de 0 ? 1
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
      LogHelper.warn(`[Orchestrator] ?? BUSY TIMEOUT (25s) for domain ${domain} - implementing recovery`);

      // Check if still actually busy
      if (globalBusyState.isVisible && el.style.display !== 'none') {
        // PHASE 3: Circuit breaker pattern - try graceful recovery
        try {
          // Emit recovery event
          window.dispatchEvent(
            new CustomEvent('myio:busy-timeout-recovery', {
              detail: { domain, duration: Date.now() - globalBusyState.startTime },
            })
          );

          // Hide busy and show user-friendly message
          hideGlobalBusy(domain);

          // Non-intrusive notification
          showRecoveryNotification();
        } catch (err) {
          LogHelper.error(`[Orchestrator] ❌ Error in timeout recovery:`, err);
          hideGlobalBusy(domain);
        }
      }

      globalBusyState.timeoutId = null;
    }, timeoutMs); // 25 seconds (Phase 1 requirement)

    if (totalBefore === 0) {
      LogHelper.log(`[Orchestrator] ? Global busy shown (domain=${domain})`);
    } else {
      LogHelper.log(`[Orchestrator] ?? Busy already visible (domain=${domain})`);
    }
  }

  function hideGlobalBusy(domain = null) {
    // RFC-0054: decremento por dom�nio; se domain for nulo, for�a limpeza
    if (domain) {
      const prev = activeRequests.get(domain) || 0;
      const next = Math.max(0, prev - 1);
      activeRequests.set(domain, next);
      LogHelper.log(
        `[Orchestrator] ? hideGlobalBusy(${domain}) -> ${prev}?${next}, total=${getActiveTotal()}`
      );
      if (getActiveTotal() > 0) return; // mant�m overlay enquanto houver ativas
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

    LogHelper.log(`[Orchestrator] ? Global busy hidden`);
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
    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
    <h2 style="
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 16px 0;
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    ">Credenciais Não Encontradas</h2>
    <p style="
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 24px 0;
      color: rgba(255,255,255,0.85);
    ">
      As credenciais de autenticação não foram configuradas no sistema.
      <br><br>
      <strong>Credenciais necessárias:</strong>
      <br>• CLIENT_ID
      <br>• CLIENT_SECRET
      <br>• CUSTOMER_ING_ID
      <br><br>
      Entre em contato com o administrador para configurar as credenciais necessárias.
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
    mutexMap: new Map(), // RFC-0054 FIX: Mutex por dom�nio (n�o global)
  };

  // State
  const inFlight = new Map();
  const abortControllers = new Map();

  // Config will be initialized in onInit() after widgetSettings are populated
  let config = null;

  let visibleTab = 'energy';
  let currentPeriod = null;
  let CUSTOMER_ING_ID = '';
  let CLIENT_ID = '';
  let CLIENT_SECRET = '';

  // Credentials promise resolver for async wait
  let credentialsResolver = null;
  let credentialsPromise = new Promise((resolve) => {
    credentialsResolver = resolve;
  });

  // Metrics
  const metrics = {
    hydrationTimes: [],
    totalRequests: 0,
    errorCounts: {},

    recordHydration(domain, duration) {
      this.hydrationTimes.push({ domain, duration, timestamp: Date.now() });
      this.totalRequests++;

      if (config?.debugMode) {
        LogHelper.log(`[Orchestrator] ${domain} hydration: ${duration}ms`);
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
        orchestrator_total_requests: this.totalRequests,
        orchestrator_avg_hydration_ms: avg,
        orchestrator_errors_total: Object.values(this.errorCounts).reduce((a, b) => a + b, 0),
      };
    },
  };

  // Request management
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

  async function fetchAndEnrich(domain, period) {
    try {
      LogHelper.log(`[Orchestrator] 🔍 fetchAndEnrich called for ${domain}`);

      // Skip API fetch for temperature domain - uses only ctx.data telemetry from ThingsBoard
      if (domain === 'temperature') {
        LogHelper.log(`[Orchestrator] Skipping API fetch for temperature domain - using ctx.data only`);
        return []; // Return empty array - TELEMETRY widget will use ctx.data directly
      }

      // Wait for credentials promise and refresh from global state
      // Don't trust local scope variables - they may be stale
      LogHelper.log(`[Orchestrator] Credentials check: flag=${window.MyIOOrchestrator?.credentialsSet}`);

      // If credentials flag is not set, wait for them with timeout
      if (!window.MyIOOrchestrator?.credentialsSet) {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Credentials timeout after 10s')), 10000)
        );

        try {
          LogHelper.log(`[Orchestrator] ⏳ Waiting for credentials to be set...`);
          await Promise.race([credentialsPromise, timeoutPromise]);
          LogHelper.log(`[Orchestrator] ✅ Credentials promise resolved`);
        } catch (err) {
          LogHelper.error(`[Orchestrator] ⚠️ Credentials timeout - ${err.message}`);
          throw new Error('Credentials not available - initialization timeout');
        }
      } else {
        LogHelper.log(`[Orchestrator] ✅ Credentials flag already set`);
      }

      // RFC-0082 FIX: Always refresh credentials from global state after waiting
      // This ensures we have the latest values, not stale closure variables
      const latestCreds = window.MyIOOrchestrator?.getCredentials?.();

      if (!latestCreds || !latestCreds.CLIENT_ID || !latestCreds.CLIENT_SECRET) {
        LogHelper.error(`[Orchestrator] ❌ Credentials validation failed after wait:`, {
          hasGetCredentials: !!window.MyIOOrchestrator?.getCredentials,
          credentialsReturned: !!latestCreds,
          CLIENT_ID: latestCreds?.CLIENT_ID || 'MISSING',
          CLIENT_SECRET_exists: !!latestCreds?.CLIENT_SECRET,
          CUSTOMER_ING_ID: latestCreds?.CUSTOMER_ING_ID || 'MISSING',
        });
        throw new Error('Missing CLIENT_ID or CLIENT_SECRET - credentials not properly set');
      }

      const clientId = latestCreds.CLIENT_ID;
      const clientSecret = latestCreds.CLIENT_SECRET;

      LogHelper.log(`[Orchestrator] 🔍 Using credentials:`, {
        CLIENT_ID: clientId?.substring(0, 10) + '...',
        CLIENT_SECRET_length: clientSecret?.length || 0,
        CUSTOMER_ING_ID: latestCreds.CUSTOMER_ING_ID,
      });

      // Create fresh MyIOAuth instance every time (like TELEMETRY widget)
      const MyIO =
        (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) ||
        (typeof window !== 'undefined' && window.MyIOLibrary) ||
        null;

      if (!MyIO) {
        throw new Error('MyIOLibrary not available');
      }

      const myIOAuth = MyIO.buildMyioIngestionAuth({
        dataApiHost: DATA_API_HOST,
        clientId: clientId,
        clientSecret: clientSecret,
      });

      // Get fresh token
      const token = await myIOAuth.getToken();
      if (!token) {
        throw new Error('Failed to get ingestion token');
      }

      // Validate customer ID exists
      if (!latestCreds.CUSTOMER_ING_ID) {
        throw new Error('Missing CUSTOMER_ING_ID - customer not configured');
      }

      const customerId = latestCreds.CUSTOMER_ING_ID;

      // Build API URL based on domain
      const url = new URL(
        `${DATA_API_HOST}/api/v1/telemetry/customers/${customerId}/${domain}/devices/totals`
      );
      url.searchParams.set('startTime', period.startISO);
      url.searchParams.set('endTime', period.endISO);
      url.searchParams.set('deep', '1');

      LogHelper.log(`[Orchestrator] Fetching from: ${url.toString()}`);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          emitTokenExpired();
        }
        throw new Error(`API error: ${res.status}`);
      }

      const json = await res.json();
      const rows = Array.isArray(json) ? json : json?.data ?? [];

      // Debug first row to see available fields
      if (rows.length > 0) {
        //LogHelper.log(`[Orchestrator] Sample API row (full):`, JSON.stringify(rows[0], null, 2));
        //LogHelper.log(`[Orchestrator] Sample API row groupType field:`, rows[0].groupType);
      }

      // Convert API response to enriched items format
      const items = rows.map((row) => ({
        id: row.id,
        tbId: row.id,
        ingestionId: row.id,
        identifier: row.identifier || row.id,
        label: row.name || row.label || row.identifier || row.id, // ← API usa "name", não "label"
        value: Number(row.total_value || 0),
        perc: 0,
        deviceType: row.deviceType || 'energy',
        slaveId: row.slaveId || null,
        centralId: row.centralId || null,
      }));

      // DEBUG: Log sample item with value
      if (items.length > 0 && items[0].value > 0) {
        LogHelper.log(`[Orchestrator] 🔍 Sample API row → item:`, {
          api_row: { id: rows[0].id, total_value: rows[0].total_value, name: rows[0].name },
          mapped_item: {
            id: items[0].id,
            ingestionId: items[0].ingestionId,
            value: items[0].value,
            label: items[0].label,
          },
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
   * Extracts period from key, ignoring customerTB_ID prefix.
   * @param {string} key - Ex: 'null:energy:2025-10-01...:day' ou '20b93da0:energy:2025-10-01...:day'
   * @returns {string} Ex: 'energy:2025-10-01...:day'
   */
  function extractPeriod(key) {
    if (!key) return '';
    const parts = key.split(':');
    return parts.slice(1).join(':'); // Remove primeiro segmento (customerTB_ID)
  }

  // Fetch data for a domain and period
  async function hydrateDomain(domain, period) {
    const key = periodKey(domain, period);
    const startTime = Date.now();

    LogHelper.log(`[Orchestrator] hydrateDomain called for ${domain}:`, { key, inFlight: inFlight.has(key) });

    // Coalesce duplicate requests
    if (inFlight.has(key)) {
      LogHelper.log(`[Orchestrator] ⏭️ Coalescing duplicate request for ${key}`);
      return inFlight.get(key);
    }

    // Show busy overlay
    showGlobalBusy(domain, 'Carregando dados...');

    // Set mutex for coordination
    sharedWidgetState.mutexMap.set(domain, true);
    sharedWidgetState.activePeriod = period;

    const fetchPromise = (async () => {
      try {
        const items = await fetchAndEnrich(domain, period);

        emitHydrated(domain, key, items.length);

        // Emit data to widgets
        emitProvide(domain, key, items);
        LogHelper.log(`[Orchestrator] 📡 Emitted provide-data for ${domain} with ${items.length} items`);

        const duration = Date.now() - startTime;
        metrics.recordHydration(domain, duration);

        LogHelper.log(`[Orchestrator] ✅ Data fetched for ${domain} in ${duration}ms`);
        return items;
      } catch (error) {
        LogHelper.error(`[Orchestrator] ❌ Error fetching ${domain}:`, error);
        metrics.recordError(domain, error);
        emitError(domain, error);
        throw error;
      } finally {
        // Hide busy overlay
        LogHelper.log(`[Orchestrator] 🔄 Finally block - hiding busy for ${domain}`);
        hideGlobalBusy(domain);

        // Release mutex
        sharedWidgetState.mutexMap.set(domain, false);
        LogHelper.log(`[Orchestrator] 🔓 Mutex released for ${domain}`);
      }
    })().finally(() => {
      inFlight.delete(key);
      LogHelper.log(`[Orchestrator] 🧹 Cleaned up inFlight for ${key}`);
    });

    inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  // Emit data to widgets
  function emitProvide(domain, pKey, items) {
    const now = Date.now();
    const key = `${domain}_${pKey}`;

    // Don't emit empty arrays
    if (!items || items.length === 0) {
      LogHelper.warn(`[Orchestrator] ⚠️ Skipping emitProvide for ${domain} - no items to emit`);
      return;
    }

    // Prevent duplicate emissions (< 100ms)
    if (OrchestratorState.lastEmission[key]) {
      const timeSinceLastEmit = now - OrchestratorState.lastEmission[key];
      if (timeSinceLastEmit < 100) {
        LogHelper.log(
          `[Orchestrator] ⏭️ Skipping duplicate emission for ${domain} (${timeSinceLastEmit}ms ago)`
        );
        return;
      }
    }

    OrchestratorState.lastEmission[key] = now;

    // Emit event to all widgets
    const eventDetail = { domain, periodKey: pKey, items };
    window.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', { detail: eventDetail }));

    try {
      lastProvide.set(domain, { periodKey: pKey, at: Date.now() });
      hideGlobalBusy(domain);
    } catch (e) {
      // Silently ignore
    }

    // Mark as not loading
    OrchestratorState.loading[domain] = false;

    // Process pending listeners (widgets that arrived late)
    if (OrchestratorState.pendingListeners[domain]) {
      LogHelper.log(
        `[Orchestrator] 🔔 Processing ${OrchestratorState.pendingListeners[domain].length} pending listeners for ${domain}`
      );

      OrchestratorState.pendingListeners[domain].forEach((callback) => {
        try {
          callback({ detail: eventDetail });
        } catch (err) {
          LogHelper.error(`[Orchestrator] Error calling pending listener:`, err);
        }
      });

      delete OrchestratorState.pendingListeners[domain];
    }

    LogHelper.log(`[Orchestrator] 📡 Emitted provide-data for ${domain} with ${items.length} items`);
  }

  function emitHydrated(domain, periodKey, count) {
    window.dispatchEvent(
      new CustomEvent('myio:orchestrator:data-hydrated', {
        detail: { domain, periodKey, count },
      })
    );
  }

  function emitError(domain, error) {
    window.dispatchEvent(
      new CustomEvent('myio:orchestrator:error', {
        detail: {
          domain,
          error: error.message || String(error),
          code: error.status || 500,
        },
      })
    );
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

      // Abort in-flight requests when tokens are rotated
      abortAllInflight();

      window.dispatchEvent(new CustomEvent('myio:token-rotated', { detail: {} }));

      if (config?.debugMode) LogHelper.log('[Orchestrator] Tokens rotated');
    },

    getToken(type) {
      return this.tokens[type] || null;
    },

    setToken(type, value) {
      this.tokens[type] = value;
    },
  };

  // Widget registration system for priority management
  /**
   * Registra widget com prioridade baseada na ordem de inicialização
   */
  function registerWidget(widgetId, domain) {
    if (!OrchestratorState.widgetPriority.includes(widgetId)) {
      OrchestratorState.widgetPriority.push(widgetId);

      const priority = OrchestratorState.widgetPriority.indexOf(widgetId) + 1;

      // Store in registry with metadata
      OrchestratorState.widgetRegistry.set(widgetId, {
        domain,
        registeredAt: Date.now(),
        priority,
      });

      LogHelper.log(
        `[Orchestrator] 📝 Widget registered: ${widgetId} (domain: ${domain}, priority: ${priority})`
      );
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
    LogHelper.log('[Orchestrator] 📅 Received myio:update-date event', ev.detail);
    currentPeriod = ev.detail.period;

    // Cross-context emission removed - HEADER already handles this
    // No need to re-emit here as it creates infinite loop

    if (visibleTab && currentPeriod) {
      LogHelper.log(`[Orchestrator] 📅 myio:update-date → hydrateDomain(${visibleTab})`);
      hydrateDomain(visibleTab, currentPeriod);
    }
  });

  window.addEventListener('myio:dashboard-state', (ev) => {
    const tab = ev.detail.tab;
    try {
      hideGlobalBusy(tab);
    } catch (e) {
      // Silently ignore - busy indicator may not exist yet
    }
    visibleTab = tab;
    if (visibleTab && currentPeriod) {
      LogHelper.log(`[Orchestrator] ?? myio:dashboard-state ? hydrateDomain(${visibleTab})`);
      hydrateDomain(visibleTab, currentPeriod);
    } else {
      LogHelper.log(
        `[Orchestrator] ?? myio:dashboard-state skipped (visibleTab=${visibleTab}, currentPeriod=${!!currentPeriod})`
      );
    }
  });

  // Request-data listener with pending listeners support
  window.addEventListener('myio:telemetry:request-data', async (ev) => {
    const { domain, period, widgetId, priority } = ev.detail;

    LogHelper.log(
      `[Orchestrator] 📨 Received data request from widget ${widgetId} (domain: ${domain}, priority: ${priority})`
    );

    // Check if already loading
    if (OrchestratorState.loading[domain]) {
      LogHelper.log(`[Orchestrator] ⏳ Already loading ${domain}, adding to pending listeners`);

      // Add pending listener
      if (!OrchestratorState.pendingListeners[domain]) {
        OrchestratorState.pendingListeners[domain] = [];
      }

      OrchestratorState.pendingListeners[domain].push((data) => {
        window.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', { detail: data.detail }));
        try {
          lastProvide.set(domain, { periodKey: data.detail.periodKey, at: Date.now() });
          hideGlobalBusy(domain);
        } catch (e) {
          // Silently ignore
        }
      });

      return;
    }

    // Fetch fresh data
    OrchestratorState.loading[domain] = true;

    try {
      const p = period || currentPeriod;
      if (p) {
        LogHelper.log(`[Orchestrator] 📡 myio:telemetry:request-data → hydrateDomain(${domain})`);
        await hydrateDomain(domain, p);
      } else {
        LogHelper.log(`[Orchestrator] 📡 myio:telemetry:request-data skipped (no period)`);
        OrchestratorState.loading[domain] = false;
      }
    } catch (error) {
      LogHelper.error(`[Orchestrator] Error hydrating ${domain}:`, error);
      OrchestratorState.loading[domain] = false;
    }
  });

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
        LogHelper.error(
          `[WidgetMonitor] ⚠️ Widget ${domain} has been showing busy for more than ${
            this.TIMEOUT_MS / 1000
          }s!`
        );
        LogHelper.error(`[WidgetMonitor] Possible issues:`);
        LogHelper.error(`[WidgetMonitor] 1. Widget não recebeu dados do orchestrator`);
        LogHelper.error(`[WidgetMonitor] 2. Widget recebeu dados vazios mas não chamou hideBusy()`);
        LogHelper.error(`[WidgetMonitor] 3. Erro silencioso impedindo processamento`);

        // Log current busy state
        const busyState = globalBusyState;
        LogHelper.error(`[WidgetMonitor] Current busy state:`, busyState);

        // Attempt auto-recovery: force hide busy for stuck widget
        LogHelper.warn(`[WidgetMonitor] 🔧 Attempting auto-recovery: forcing hideBusy for ${domain}`);
        hideGlobalBusy(domain);
      }, this.TIMEOUT_MS);

      this.timers.set(domain, timerId);
      LogHelper.log(`[WidgetMonitor] ✅ Started monitoring ${domain} (timeout: ${this.TIMEOUT_MS / 1000}s)`);
    },

    stopMonitoring(domain) {
      const timerId = this.timers.get(domain);
      if (timerId) {
        clearTimeout(timerId);
        this.timers.delete(domain);
        LogHelper.log(`[WidgetMonitor] ✅ Stopped monitoring ${domain}`);
      }
    },

    stopAll() {
      for (const [domain, timerId] of this.timers.entries()) {
        clearTimeout(timerId);
        LogHelper.log(`[WidgetMonitor] ✅ Stopped monitoring ${domain}`);
      }
      this.timers.clear();
    },
  };

  // Public API
  return {
    hydrateDomain,
    setVisibleTab: (tab) => {
      visibleTab = tab;
    },
    getVisibleTab: () => visibleTab,
    getCurrentPeriod: () => currentPeriod,
    getStats: () => ({
      totalRequests: metrics.totalRequests,
      inFlightCount: inFlight.size,
    }),
    tokenManager,
    metrics,
    config,

    // Expose centralized busy management
    showGlobalBusy,
    hideGlobalBusy,

    // Expose shared state
    getSharedWidgetState: () => sharedWidgetState,
    setSharedPeriod: (period) => {
      sharedWidgetState.activePeriod = period;
    },

    // Expose busy state for debugging
    getBusyState: () => ({ ...globalBusyState }),

    // Expose widget busy monitor
    widgetBusyMonitor,

    setCredentials: (customerId, clientId, clientSecret) => {
      LogHelper.log(`[Orchestrator] 🔐 setCredentials called with:`, {
        customerId,
        clientId,
        clientSecretLength: clientSecret?.length || 0,
      });

      CUSTOMER_ING_ID = customerId;
      CLIENT_ID = clientId;
      CLIENT_SECRET = clientSecret;

      LogHelper.log(`[Orchestrator] ✅ Credentials set successfully:`, {
        CUSTOMER_ING_ID,
        CLIENT_ID,
        CLIENT_SECRET_length: CLIENT_SECRET?.length || 0,
      });

      // RFC-0051.2: Mark credentials as set
      if (window.MyIOOrchestrator) {
        window.MyIOOrchestrator.credentialsSet = true;
      }

      // Resolve the promise to unblock waiting fetchAndEnrich calls
      if (credentialsResolver) {
        credentialsResolver();
        LogHelper.log(`[Orchestrator] ✅ Credentials promise resolved - unblocking pending requests`);
      }
    },

    getCredentials: () => {
      return {
        CUSTOMER_ING_ID,
        CLIENT_ID,
        CLIENT_SECRET,
      };
    },

    destroy: () => {
      // Abort all in-flight requests
      abortAllInflight();

      // Stop all widget monitors
      widgetBusyMonitor.stopAll();

      // Clean up busy overlay
      hideGlobalBusy();
      const busyEl = document.getElementById(BUSY_OVERLAY_ID);
      if (busyEl && busyEl.parentNode) {
        busyEl.parentNode.removeChild(busyEl);
      }
    },
  };
})();

// RFC-0051.2: Update stub with real implementation and mark as ready
if (window.MyIOOrchestrator && !window.MyIOOrchestrator.isReady) {
  // Merge real implementation with stub
  Object.assign(window.MyIOOrchestrator, MyIOOrchestrator);

  // Mark as ready
  window.MyIOOrchestrator.isReady = true;
  window.MyIOOrchestrator.credentialsSet = false; // Will be set by setCredentials()

  LogHelper.log('[Orchestrator] ✅ Orchestrator fully initialized and ready');

  // Emit ready event for widgets that are waiting
  window.dispatchEvent(
    new CustomEvent('myio:orchestrator:ready', {
      detail: { timestamp: Date.now() },
    })
  );

  LogHelper.log('[Orchestrator] 📢 Emitted myio:orchestrator:ready event');
} else {
  // Fallback: no stub exists (shouldn't happen but be safe)
  window.MyIOOrchestrator = MyIOOrchestrator;
  window.MyIOOrchestrator.isReady = true;
  window.MyIOOrchestrator.credentialsSet = false;

  LogHelper.log('[MyIOOrchestrator] Initialized (no stub found)');
}
