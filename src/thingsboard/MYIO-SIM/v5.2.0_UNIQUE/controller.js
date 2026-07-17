// ===================================================================
// RFC-0111: MAIN_UNIQUE_DATASOURCE Controller
// Single Datasource Architecture - Head Office Dashboard
// ===================================================================

/* eslint-disable no-undef */
/* global self, window, document */

// Debug configuration - set from settings.enableDebugMode in onInit
let DEBUG_ACTIVE = false;

// Feature flag (HO): pré-carga de anotações no WelcomeModal (meta counts). Enquanto
// a funcionalidade não é liberada, mantenha FALSE — evita dezenas/centenas de
// requests por customer no load da modal e mostra um cadeado 🔒 no badge 📋.
const ENABLE_ANNOTATIONS_META = false;

// RFC-0122: LogHelper - initialized inside onInit after library check
// @see src/utils/logHelper.js - createLogHelper
let LogHelper = null;

// RFC-0111: Default shopping cards with correct dashboard IDs (from WELCOME controller)
// deviceCounts use null = loading (spinner), number = loaded (show value)
const DEFAULT_SHOPPING_CARDS = [
  {
    title: 'Mestre Álvaro',
    buttonId: 'ShoppingMestreAlvaro',
    dashboardId: '6c188a90-b0cc-11f0-9722-210aa9448abc',
    entityId: '6c188a90-b0cc-11f0-9722-210aa9448abc',
    entityType: 'ASSET',
    customerId: null,
    deviceCounts: { energy: null, water: null, temperature: null }, // null = loading spinner
  },
  {
    title: 'Mont Serrat',
    buttonId: 'ShoppingMontSerrat',
    dashboardId: '39e4ca30-b503-11f0-be7f-e760d1498268',
    entityId: '39e4ca30-b503-11f0-be7f-e760d1498268',
    entityType: 'ASSET',
    customerId: null,
    deviceCounts: { energy: null, water: null, temperature: null },
  },
  {
    title: 'Moxuara',
    buttonId: 'ShoppingMoxuara',
    dashboardId: '4b53bbb0-b5a7-11f0-be7f-e760d1498268',
    entityId: '4b53bbb0-b5a7-11f0-be7f-e760d1498268',
    entityType: 'ASSET',
    customerId: null,
    deviceCounts: { energy: null, water: null, temperature: null },
  },
  {
    title: 'Rio Poty',
    buttonId: 'ShoppingRioPoty',
    dashboardId: 'd432db90-cee9-11f0-998e-25174baff087',
    entityId: 'd432db90-cee9-11f0-998e-25174baff087',
    entityType: 'ASSET',
    customerId: null,
    deviceCounts: { energy: null, water: null, temperature: null },
  },
  {
    title: 'Shopping da Ilha',
    buttonId: 'ShoppingDaIlha',
    dashboardId: 'd2754480-b668-11f0-be7f-e760d1498268',
    entityId: 'd2754480-b668-11f0-be7f-e760d1498268',
    entityType: 'ASSET',
    customerId: null,
    deviceCounts: { energy: null, water: null, temperature: null },
  },
  {
    title: 'Metrópole Pará',
    buttonId: 'ShoppingMetropolePara',
    dashboardId: 'aaa21b80-d6e9-11f0-998e-25174baff087',
    entityId: 'aaa21b80-d6e9-11f0-998e-25174baff087',
    entityType: 'ASSET',
    customerId: null,
    deviceCounts: { energy: null, water: null, temperature: null },
  },
];

const DOMAIN_TEMPERATURE = 'temperature';
const DOMAIN_ENERGY = 'energy';
const DOMAIN_WATER = 'water';
const DOMAIN_ALL_LIST = [DOMAIN_ENERGY, DOMAIN_WATER, DOMAIN_TEMPERATURE];

// RFC-0111: Guard to prevent multiple API enrichment calls
let _apiEnrichmentDone = false;
let _apiEnrichmentInProgress = false;

// RFC-0175: Guard to prevent concurrent async renders of the operational grid
let _isRenderingOperationalGrid = false;

// Global counter for credentials retry attempts (max 10 attempts)
let _credentialsRetryCount = 0;
// Bound for the classified-data wait in triggerApiEnrichment (was unbounded: with no
// datasource it retried every 1s forever, piling up when onInit re-runs)
let _classifiedRetryCount = 0;
const MAX_CLASSIFIED_RETRIES = 30;
const MAX_CREDENTIALS_RETRIES = 10;

// RFC-0126: Module-level variables for event handlers
// These must be declared before self.onInit so handlers can be registered immediately
/* eslint-disable no-unused-vars -- RFC-0126 scaffolding; some counters/caches/refs are write-only (readers not yet implemented) */
let _onDataUpdatedCallCount = null;
let _cachedShoppings = [];
let _cachedClassified = null;
let _cachedDeviceCounts = null;
let _menuInstanceRef = null;
let _welcomeModalRef = null;
let _headerInstanceRef = null;
/* eslint-enable no-unused-vars */
let _currentCustomersCards = null; // Shopping cards from datasource or DEFAULT_SHOPPING_CARDS
let _forceRemovePartialOwnerName = ''; // Prefix to remove from ownerName
let _goalsEntityLabel = 'Shopping'; // Set from settings.goalsEntityLabel in onInit
let _goalsEntityLabelPlural = 'Shoppings'; // Set from settings.goalsEntityLabelPlural in onInit
// Variações do label da entidade (Shopping, Estação, Hospital, Escola…) para os
// textos da UI — NUNCA hardcodar "shopping" em string visível; usar estas helpers.
const _entS = () => _goalsEntityLabel; // singular ("Shopping")
const _entSLow = () => _goalsEntityLabel.toLowerCase(); // "shopping"
const _entP = () => _goalsEntityLabelPlural; // plural ("Shoppings")
const _entPLow = () => _goalsEntityLabelPlural.toLowerCase(); // "shoppings"

// Helper to clean ownerName by removing configured prefix (module-level for use in buildMetadataMapFromCtxData)
function cleanOwnerName(name) {
  if (!name || !_forceRemovePartialOwnerName) return name;
  const trimmed = name.trim();
  if (trimmed.toLowerCase().startsWith(_forceRemovePartialOwnerName.toLowerCase())) {
    return trimmed.substring(_forceRemovePartialOwnerName.length).trim();
  }
  return trimmed;
}

// ===================================================================
// Data Cache Configuration (5-minute validity)
// Stores enriched data to avoid redundant API calls on navigation
// ===================================================================
const DATA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
let _dataCache = {
  timestamp: 0,
  enrichedData: null,
  rawDatasource: null,
  isValid: function () {
    if (!this.enrichedData) return false;
    const age = Date.now() - this.timestamp;
    const valid = age < DATA_CACHE_TTL_MS;
    if (!valid) {
      console.log('[MAIN_UNIQUE] Cache expired (age:', Math.round(age / 1000), 's)');
    }
    return valid;
  },
  set: function (enrichedData, rawDatasource) {
    this.enrichedData = enrichedData;
    this.rawDatasource = rawDatasource;
    this.timestamp = Date.now();
    console.log('[MAIN_UNIQUE] Cache updated at', new Date(this.timestamp).toLocaleTimeString());
  },
  clear: function () {
    this.enrichedData = null;
    this.rawDatasource = null;
    this.timestamp = 0;
    console.log('[MAIN_UNIQUE] Cache cleared');
  },
  getAge: function () {
    if (!this.timestamp) return null;
    return Math.round((Date.now() - this.timestamp) / 1000);
  },
};

// RFC-0127: Event handler for menu requesting shoppings
// Responds with cached data when menu component requests it
window.addEventListener('myio:request-shoppings', () => {
  console.log('[MAIN_UNIQUE] myio:request-shoppings received, cached:', _cachedShoppings.length);
  if (_menuInstanceRef && _cachedShoppings.length > 0) {
    _menuInstanceRef.updateShoppings?.(_cachedShoppings);
    console.log('[MAIN_UNIQUE] Shoppings sent to menu on request');
  }
});

// Force refresh event handler - clears cache and triggers data reload
// Dispatched by Menu component "Carregar" button
window.addEventListener('myio:force-refresh', () => {
  console.log('[MAIN_UNIQUE] myio:force-refresh received - clearing cache');
  _dataCache.clear();
  _apiEnrichmentDone = false;
  _apiEnrichmentInProgress = false;

  // Trigger onDataUpdated to re-fetch data
  if (self.ctx?.datasources?.[0]?.data) {
    console.log('[MAIN_UNIQUE] Triggering data refresh...');
    self.onDataUpdated();
  }
});

self.onInit = async function () {
  'use strict';

  // === 0. CLEAR MODULE-LEVEL CACHE (must be first) ===
  // Prevents stale data when widget is reloaded or dashboard refreshed
  _onDataUpdatedCallCount = 0;
  _cachedShoppings = [];
  _cachedClassified = null;
  _cachedDeviceCounts = null;
  _menuInstanceRef = null;
  _headerInstanceRef = null;
  _welcomeModalRef = null;
  _isRenderingOperationalGrid = false;

  // === 1. LIBRARY REFERENCE (must be first) ===
  const MyIOLibrary = window.MyIOLibrary;
  if (!MyIOLibrary) {
    console.error('[MAIN_UNIQUE] MyIOLibrary not found');
    return;
  }

  // === 1.1 CONFIGURATION ===
  const settings = self.ctx.settings || {};
  let currentThemeMode = settings.defaultThemeMode || 'dark';
  DEBUG_ACTIVE = settings.enableDebugMode ?? false;

  // Set module-level variables for functions outside onInit scope
  _forceRemovePartialOwnerName = (settings.forceRemovePartialOwnerName || '').trim();
  _goalsEntityLabel = settings.goalsEntityLabel || 'Shopping';
  // Plural configurável ("Estações", "Hospitais"…); fallback ingênuo +s
  _goalsEntityLabelPlural = settings.goalsEntityLabelPlural || `${_goalsEntityLabel}s`;

  // RFC-0122: Initialize LogHelper from library
  if (!MyIOLibrary.createLogHelper) {
    // showToast didn't exist at module scope — this path used to throw a ReferenceError
    MyIOLibrary.MyIOToast?.error?.('Erro: biblioteca não carregada (createLogHelper)');
    console.error('[MAIN_UNIQUE] MyIOLibrary.createLogHelper not available');
    return;
  }

  LogHelper = MyIOLibrary.createLogHelper({
    debugActive: DEBUG_ACTIVE,
    config: { widget: 'MAIN_UNIQUE_DATASOURCE' },
  });

  LogHelper.log('[MAIN_UNIQUE] onInit called', self.ctx);

  // === 1.2 WIDGET EDITOR GUARD ===
  // Inside the ThingsBoard widget editor there are no settings/datasources: the full init
  // (welcome modal, orchestrator, retry chains, event listeners) spams "not configured"
  // toasts, re-registers listeners on every editor re-init and the unbounded retry chains
  // pile up until the tab freezes. Render a lightweight placeholder and stop.
  if (self.ctx.widgetEditMode) {
    const host = self.ctx.$container?.[0];
    if (host) {
      host.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;' +
        "font:14px 'Nunito',system-ui,sans-serif;color:#64748b;text-align:center;padding:16px\">" +
        'MAIN_UNIQUE_DATASOURCE<br>Preview desabilitado no editor de widget.<br>' +
        'Configure settings/datasource e visualize no dashboard.</div>';
    }
    LogHelper.log('[MAIN_UNIQUE] widgetEditMode detected: skipping full init');
    return;
  }

  // === 1.3 REQUIRED SETTINGS GUARD (fail-fast) ===
  // Without these settings nothing downstream can work; previously the widget kept
  // initializing anyway (welcome modal, orchestrator, retry chains, toasts) and the
  // accumulated work froze the tab. Render a config hint and stop.
  if (!settings.customerTB_ID || !settings.dataApiHost) {
    const missing = [
      !settings.customerTB_ID ? 'customerTB_ID' : null,
      !settings.dataApiHost ? 'dataApiHost' : null,
    ]
      .filter(Boolean)
      .join(', ');
    const host = self.ctx.$container?.[0];
    if (host) {
      host.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;' +
        "font:14px 'Nunito',system-ui,sans-serif;color:#64748b;text-align:center;padding:16px\">" +
        'MAIN_UNIQUE_DATASOURCE<br>Settings obrigatórios ausentes: <b>' +
        missing +
        '</b><br>' +
        'Configure o widget para inicializar.</div>';
    }
    LogHelper.warn(`[MAIN_UNIQUE] Missing required settings (${missing}) - init aborted`);
    return;
  }

  // === 2. CREDENTIALS AND UTILITIES FOR TELEMETRY WIDGET ===
  // RFC-0111: TELEMETRY widget depends on these utilities from MAIN
  const DATA_API_HOST = settings.dataApiHost || '';
  if (!DATA_API_HOST) {
    const msg = 'dataApiHost não configurado. Verifique as configurações do widget.';
    LogHelper.warn('[MAIN_UNIQUE_DATASOURCE]', msg);
    if (MyIOLibrary?.MyIOToast?.error) {
      MyIOLibrary.MyIOToast.error(msg);
    }
  }
  // Rotas reais são /api/v1/alarms… e o AlarmApiClient NÃO acrescenta o prefixo —
  // normaliza aqui p/ aceitar a base com ou sem /api/v1 (auditoria 2026-07-07: sem
  // isso todas as chamadas de alarmes davam 404 "Route not found")
  const ALARMS_API_BASE = (() => {
    const b = String(settings.alarmsApiBaseUrl || 'https://alarms-api.a.myio-bas.com').replace(/\/+$/, '');
    return /\/api\/v1$/.test(b) ? b : `${b}/api/v1`;
  })();
  const ALARMS_API_KEY = settings.alarmsApiKey || '';
  const GCDR_API_BASE = settings.gcdrApiBaseUrl || 'https://gcdr-api.a.myio-bas.com';
  // RFC-0046: expose GCDR base URL via window state (analogous to MAIN) for the Goals panel.
  window.MyIOUtils = window.MyIOUtils || {};
  window.MyIOUtils.gcdrApiBaseUrl = GCDR_API_BASE;

  // Charts SDK base URL — consumed by the FOOTER comparison modal. Single
  // source of truth lives here on MAIN; FOOTER does not hold its own
  // fallback so misconfiguration surfaces as a toast instead of silently
  // landing on the wrong environment.
  const CHARTS_BASE_URL = settings.chartsBaseUrl || 'https://graphs.apps.myio-bas.com';
  window.MyIOUtils = window.MyIOUtils || {};
  window.MyIOUtils.chartsBaseUrl = CHARTS_BASE_URL;
  LogHelper.log('[MAIN_UNIQUE] chartsBaseUrl:', CHARTS_BASE_URL);

  // RFC-0189: Temperature API fetch for offline detection + modal data source
  const ENABLE_TEMPERATURE_API = settings.enableTemperatureApiDataFetch ?? false;
  window.MyIOUtils.enableTemperatureApiDataFetch = ENABLE_TEMPERATURE_API;
  LogHelper.log('[MAIN_UNIQUE] RFC-0189: enableTemperatureApiDataFetch:', ENABLE_TEMPERATURE_API);

  // RFC-0178: Configure AlarmService with the correct base URL and API key from settings
  if (MyIOLibrary?.AlarmService?.configure) {
    MyIOLibrary.AlarmService.configure(ALARMS_API_BASE, undefined, ALARMS_API_KEY);
    LogHelper.log('[MAIN_UNIQUE] AlarmService configured with baseUrl:', ALARMS_API_BASE);
  }

  // RFC-0178/RFC-0180: Expose API base URLs on MyIOOrchestrator for components (e.g. btnAlarmBundleMap)
  if (window.MyIOOrchestrator) {
    window.MyIOOrchestrator.alarmsApiBaseUrl = ALARMS_API_BASE;
    window.MyIOOrchestrator.gcdrApiBaseUrl = GCDR_API_BASE;
  }

  // Credentials will be fetched from ThingsBoard customer attributes
  let CLIENT_ID = '';
  let CLIENT_SECRET = '';
  let CUSTOMER_ING_ID = '';
  let GCDR_CUSTOMER_ID = ''; // customer SERVER_SCOPE attr: gcdrCustomerId
  let GCDR_API_KEY = ''; // customer SERVER_SCOPE attr: gcdrApiKey (X-API-Key p/ Goals/GCDR, como no v-5.2.0)

  // Get ThingsBoard customer ID (required from settings)
  const getCustomerTB_ID = () => {
    if (settings.customerTB_ID) {
      return settings.customerTB_ID;
    }

    // settings.customerTB_ID not configured - show error toast
    if (typeof MyIOLibrary?.MyIOToast?.error === 'function') {
      MyIOLibrary.MyIOToast.error('settings.customerTB_ID not configured');
    } else {
      console.error('[MAIN_UNIQUE] settings.customerTB_ID not configured');
    }

    return '';
  };

  const getJwtToken = () => {
    // Get JWT token from ThingsBoard auth service
    try {
      const authService = self.ctx?.$injector?.get?.('authService');

      if (authService?.getJwtToken) {
        return authService.getJwtToken();
      }
    } catch {
      // Fallback methods
    }
    // Try from localStorage
    return localStorage.getItem('jwt_token') || '';
  };

  // Fetch credentials from ThingsBoard customer attributes (like old MAIN)
  const fetchCredentialsFromThingsBoard = async () => {
    const customerTB_ID = getCustomerTB_ID();
    const jwt = getJwtToken();

    LogHelper.log('Fetching credentials for customer:', customerTB_ID);

    if (!customerTB_ID || !jwt) {
      LogHelper.warn('Missing customerTB_ID or JWT token');
      return;
    }

    try {
      // Use MyIOLibrary function to fetch customer attrs
      if (MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage) {
        const attrs = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
        LogHelper.log('Received attrs:', attrs);

        CLIENT_ID = attrs?.client_id || '';
        CLIENT_SECRET = attrs?.client_secret || '';
        CUSTOMER_ING_ID = attrs?.ingestionId || '';
        GCDR_CUSTOMER_ID = attrs?.gcdrCustomerId || '';
        GCDR_API_KEY = attrs?.gcdrApiKey || '';

        // Update MyIOUtils with fetched credentials
        window.MyIOUtils.CLIENT_ID = CLIENT_ID;
        window.MyIOUtils.CLIENT_SECRET = CLIENT_SECRET;
        window.MyIOUtils.CUSTOMER_ING_ID = CUSTOMER_ING_ID;
        window.MyIOUtils.GCDR_CUSTOMER_ID = GCDR_CUSTOMER_ID;
        window.MyIOUtils.GCDR_API_KEY = GCDR_API_KEY;
        // Parity with v-5.2.0 MAIN_VIEW: gcdrApiKey exposto no orchestrator (Goals/GCDR auth)
        if (window.MyIOOrchestrator) window.MyIOOrchestrator.gcdrApiKey = GCDR_API_KEY;
        // A gcdrApiKey do HO é MASTER na Alarms API (retorna alarmes de todos os
        // customers do tenant) — reconfigura o AlarmService com ela; a settings
        // alarmsApiKey (configure inicial) é rejeitada com 401 no /api/v1
        if (GCDR_API_KEY && MyIOLibrary?.AlarmService?.configure) {
          MyIOLibrary.AlarmService.configure(ALARMS_API_BASE, undefined, GCDR_API_KEY);
          LogHelper.log('[MAIN_UNIQUE] AlarmService reconfigured with customer gcdrApiKey (master)');
        }
        window.MyIOUtils.getCredentials = () => ({
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          customerId: CUSTOMER_ING_ID,
          dataApiHost: DATA_API_HOST,
        });

        // RFC-0115: Create and expose myIOAuth globally for TELEMETRY
        if (MyIOLibrary?.buildMyioIngestionAuth && CLIENT_ID && CLIENT_SECRET) {
          try {
            const myIOAuth = MyIOLibrary.buildMyioIngestionAuth({
              dataApiHost: DATA_API_HOST,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
            });

            window.MyIOUtils.myIOAuth = myIOAuth;
            window.MyIOUtils.getToken = () => myIOAuth.getToken();
            LogHelper.log('myIOAuth created and exposed on MyIOUtils');
          } catch (err) {
            LogHelper.error('Failed to create myIOAuth:', err);
          }
        }

        LogHelper.log('Credentials updated:', {
          CLIENT_ID: CLIENT_ID ? '***' : '',
          CUSTOMER_ING_ID,
          GCDR_CUSTOMER_ID,
        });
      } else {
        LogHelper.error('fetchThingsboardCustomerAttrsFromStorage not available in MyIOLibrary');
      }
    } catch (error) {
      LogHelper.error('Failed to fetch credentials:', error);
    }
  };

  const getCustomerNameForDevice = (device) => {
    return device?.customerName || device?.ownerName || 'N/A';
  };

  const fetchCustomerServerScopeAttrs = async (customerId) => {
    LogHelper.log('fetchCustomerServerScopeAttrs called for:', customerId);
    const jwt = getJwtToken();

    if (MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage && customerId && jwt) {
      const attrs = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(customerId, jwt);
      return attrs || {};
    }

    return {};
  };

  // RFC-0152: Fetch feature flags from customer SERVER_SCOPE attributes
  // Defaults: show-energy-tab=true, show-water-tab=true, show-temperature-tab=true, show-indicators-operational-panels=false
  const fetchOperationalIndicatorsAccess = async () => {
    const customerTB_ID = getCustomerTB_ID();
    const jwt = getJwtToken();

    LogHelper.log('RFC-0152: Checking feature flags access for customer:', customerTB_ID);

    if (!customerTB_ID || !jwt) {
      LogHelper.warn('RFC-0152: Missing customerTB_ID or JWT token for feature flags check');
      // Dispatch defaults: all domain tabs visible, operational hidden
      window.dispatchEvent(
        new CustomEvent('myio:operational-indicators-access', { detail: { enabled: false } })
      );
      window.dispatchEvent(
        new CustomEvent('myio:domains-access', {
          detail: {
            energy: true,
            water: true,
            temperature: true,
            showGoalsButton: true,
            energySubTabs: { equipments: true, stores: true, dashboard: true },
          },
        })
      );
      return { showOperationalPanels: false };
    }

    try {
      if (MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage) {
        const attrs = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);

        const showOperationalPanels = attrs?.['show-indicators-operational-panels'] === 'true';
        const showEnergyTab = attrs?.['show-energy-tab'] !== 'false'; // default true
        const showWaterTab = attrs?.['show-water-tab'] !== 'false'; // default true
        const showTemperatureTab = attrs?.['show-temperature-tab'] !== 'false'; // default true
        const showGoalsButton = attrs?.['show-goals-button'] !== 'false'; // default true
        const showEnergyEquipments = attrs?.['show-energy-tab.equipments'] !== 'false'; // default true
        const showEnergyStores = attrs?.['show-energy-tab.stores'] !== 'false'; // default true
        const showEnergyDashboard = attrs?.['show-energy-tab.dashboard'] !== 'false'; // default true
        const apiKeyGcdr = attrs?.['apiKeyGcdr'] || '';

        LogHelper.log('RFC-0152: Feature flags:', {
          showOperationalPanels,
          showEnergyTab,
          showWaterTab,
          showTemperatureTab,
          showGoalsButton,
          showEnergyEquipments,
          showEnergyStores,
          showEnergyDashboard,
        });

        const domainsAccess = {
          energy: showEnergyTab,
          water: showWaterTab,
          temperature: showTemperatureTab,
          showGoalsButton,
          energySubTabs: {
            equipments: showEnergyEquipments,
            stores: showEnergyStores,
            dashboard: showEnergyDashboard,
          },
        };

        // Update MyIOUtils with all feature flag states
        if (window.MyIOUtils) {
          window.MyIOUtils.operationalIndicators = { enabled: showOperationalPanels };
          window.MyIOUtils.domainsAccess = domainsAccess;
          if (apiKeyGcdr) window.MyIOUtils.ALARMS_API_KEY = apiKeyGcdr;
        }

        // Re-configure AlarmService with the real API key from SERVER_SCOPE
        if (apiKeyGcdr && MyIOLibrary?.AlarmService?.configure) {
          MyIOLibrary.AlarmService.configure(ALARMS_API_BASE, undefined, apiKeyGcdr);
          LogHelper.log('[MAIN_UNIQUE] AlarmService re-configured with apiKeyGcdr from SERVER_SCOPE');
        }

        // Dispatch events for Menu component to react
        window.dispatchEvent(
          new CustomEvent('myio:operational-indicators-access', {
            detail: { enabled: showOperationalPanels },
          })
        );
        window.dispatchEvent(new CustomEvent('myio:domains-access', { detail: domainsAccess }));

        return { showOperationalPanels };
      }
    } catch (error) {
      LogHelper.error('RFC-0152: Failed to fetch feature flags:', error);
    }

    // Fallback defaults on error
    window.dispatchEvent(
      new CustomEvent('myio:operational-indicators-access', { detail: { enabled: false } })
    );
    window.dispatchEvent(
      new CustomEvent('myio:domains-access', {
        detail: {
          energy: true,
          water: true,
          temperature: true,
          showGoalsButton: true,
          energySubTabs: { equipments: true, stores: true, dashboard: true },
        },
      })
    );
    return { showOperationalPanels: false };
  };

  // RFC-0093: Centralized Header CSS
  const HEADER_CSS = `
.equip-stats-header {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 16px;
  margin-bottom: 16px;
  border-bottom: 3px solid #cbd5e1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  width: 100%;
}
.equip-stats-header .stat-item {
  display: flex !important;
  flex-direction: column !important;
  gap: 2px;
  flex: 1;
  min-width: 0;
  text-align: center;
}
.equip-stats-header .stat-item.highlight {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-radius: 8px;
  padding: 6px 12px;
  border: 1px solid #93c5fd;
}
.equip-stats-header .stat-label {
  font-size: 12px;
  color: #6b7a90;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.equip-stats-header .stat-value {
  font-size: 16px;
  color: #1c2743;
  font-weight: 700;
}
.equip-stats-header .stat-item.highlight .stat-value {
  color: #1d4ed8;
  font-size: 20px;
}
.equip-stats-header .filter-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: auto;
}
.equip-stats-header .search-wrap {
  position: relative;
  width: 0;
  overflow: hidden;
  transition: width 0.3s ease;
}
.equip-stats-header .search-wrap.active {
  width: 200px;
}
.equip-stats-header .search-wrap input {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid #dde7f1;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
}
.equip-stats-header .search-wrap input:focus {
  border-color: #1f6fb5;
  box-shadow: 0 0 0 2px rgba(31, 111, 181, 0.1);
}
.equip-stats-header .icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #dde7f1;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.equip-stats-header .icon-btn:hover {
  background: #f8f9fa;
  border-color: #1f6fb5;
}
.equip-stats-header .icon-btn svg {
  fill: #1c2743;
}

/* ====== DARK THEME SUPPORT FOR HEADER ====== */
[data-theme="dark"] .equip-stats-header {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-color: #334155;
  border-bottom-color: #475569;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
[data-theme="dark"] .equip-stats-header .stat-label {
  color: #94a3b8;
}
[data-theme="dark"] .equip-stats-header .stat-value {
  color: #f1f5f9;
}
[data-theme="dark"] .equip-stats-header .stat-item.highlight {
  background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%);
  border-color: #3b82f6;
}
[data-theme="dark"] .equip-stats-header .stat-item.highlight .stat-value {
  color: #93c5fd;
}
[data-theme="dark"] .equip-stats-header .search-wrap input {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}
[data-theme="dark"] .equip-stats-header .search-wrap input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}
[data-theme="dark"] .equip-stats-header .search-wrap input::placeholder {
  color: #64748b;
}
[data-theme="dark"] .equip-stats-header .icon-btn {
  background: #1e293b;
  border-color: #334155;
}
[data-theme="dark"] .equip-stats-header .icon-btn:hover {
  background: #334155;
  border-color: #3b82f6;
}
[data-theme="dark"] .equip-stats-header .icon-btn svg {
  fill: #f1f5f9;
}

/* ====== RFC-0090: CENTRALIZED FILTER MODAL STYLES ====== */
.myio-filter-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
  backdrop-filter: blur(4px);
  left: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  animation: myioFadeIn 0.2s ease-in;
}
.myio-filter-modal.hidden { display: none; }
.myio-filter-modal-card {
  background: #fff;
  border-radius: 0;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: none;
  overflow: hidden;
}
@media (min-width: 768px) {
  .myio-filter-modal-card {
    border-radius: 16px;
    width: 90%;
    max-width: 900px;
    height: auto;
    max-height: 90vh;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
}
.myio-filter-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #dde7f1;
}
.myio-filter-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1c2743;
}
.myio-filter-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.myio-filter-modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid #dde7f1;
}
.myio-filter-modal .filter-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.myio-filter-modal .block-label {
  font-size: 14px;
  font-weight: 600;
  color: #1c2743;
}
.myio-filter-modal .filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.myio-filter-modal .filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #dde7f1;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: #6b7a90;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.myio-filter-modal .filter-tab:hover {
  background: #f8f9fa;
  border-color: #1f6fb5;
  color: #1f6fb5;
}
.myio-filter-modal .filter-tab.active {
  background: rgba(31, 111, 181, 0.1);
  border-color: #1f6fb5;
  color: #1f6fb5;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(31, 111, 181, 0.15);
}
.myio-filter-modal .btn {
  padding: 10px 20px;
  border: 1px solid #dde7f1;
  background: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.myio-filter-modal .btn:hover { background: #f8f9fa; }
.myio-filter-modal .btn.primary {
  background: #1f6fb5;
  color: #fff;
  border-color: #1f6fb5;
}
.myio-filter-modal .btn.primary:hover {
  background: #1a5a8f;
  border-color: #1a5a8f;
}
.myio-filter-modal .icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #dde7f1;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.myio-filter-modal .icon-btn:hover {
  background: #f8f9fa;
  border-color: #1f6fb5;
}
.myio-filter-modal .icon-btn svg { fill: #1c2743; }
@keyframes myioFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
body.filter-modal-open { overflow: hidden !important; }
`;

  // Inject header CSS
  if (!document.getElementById('myio-header-css')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'myio-header-css';
    styleEl.textContent = HEADER_CSS;
    document.head.appendChild(styleEl);
    LogHelper.log('Header CSS injected');
  }

  // Header domain configuration
  const HEADER_DOMAIN_CONFIG = {
    energy: {
      totalLabel: 'Total de Equipamentos',
      consumptionLabel: 'Consumo Total',
      zeroLabel: 'Sem Consumo',
      formatValue: (val) => MyIOLibrary?.formatEnergy?.(val) || `${val.toFixed(2)} kWh`,
    },
    stores: {
      totalLabel: 'Total de Lojas',
      consumptionLabel: 'Consumo Total',
      zeroLabel: 'Sem Consumo',
      formatValue: (val) => MyIOLibrary?.formatEnergy?.(val) || `${val.toFixed(2)} kWh`,
    },
    water: {
      totalLabel: 'Total de Hidrômetros',
      consumptionLabel: 'Consumo Total',
      zeroLabel: 'Sem Consumo',
      formatValue: (val) => MyIOLibrary?.formatWaterVolumeM3?.(val) || `${val.toFixed(2)} m³`,
    },
    temperature: {
      totalLabel: 'Total de Sensores',
      consumptionLabel: 'Média de Temperatura',
      zeroLabel: 'Sem Leitura',
      formatValue: (val) => MyIOLibrary?.formatTemperature?.(val) || `${val.toFixed(1)}°C`,
    },
  };

  // RFC-0093: Build and inject a centralized header for device grids
  // Global assignment - FIEL ao showcase/telemetry-grid/index.html
  window.MyIOUtils = window.MyIOUtils || {};

  const buildHeaderDevicesGrid = (config) => {
    LogHelper.log('[buildHeaderDevicesGrid]', config);

    const {
      container,
      domain = DOMAIN_ENERGY,
      idPrefix = 'devices',
      labels = {},
      includeSearch = true,
      includeFilter = true,
      onSearchClick,
      onFilterClick,
    } = config;

    const containerEl = typeof container === 'string' ? document.querySelector(container) : container;
    if (!containerEl) {
      LogHelper.error('buildHeaderDevicesGrid: Container not found');
      return null;
    }

    const domainConfig = HEADER_DOMAIN_CONFIG[domain] || HEADER_DOMAIN_CONFIG.energy;

    const finalLabels = {
      connectivity: labels.connectivity || 'Conectividade',
      total: labels.total || domainConfig.totalLabel,
      consumption: labels.consumption || domainConfig.consumptionLabel,
      zero: labels.zero || domainConfig.zeroLabel,
    };

    const ids = {
      header: `${idPrefix}StatsHeader`,
      connectivity: `${idPrefix}StatsConnectivity`,
      total: `${idPrefix}StatsTotal`,
      consumption: `${idPrefix}StatsConsumption`,
      zero: `${idPrefix}StatsZero`,
      searchWrap: `${idPrefix}SearchWrap`,
      searchInput: `${idPrefix}Search`,
      btnSearch: `${idPrefix}BtnSearch`,
      btnFilter: `${idPrefix}BtnFilter`,
      btnMaximize: `${idPrefix}BtnMaximize`,
    };

    const searchButtonHTML = includeSearch
      ? `<button class="icon-btn" id="${ids.btnSearch}" title="Buscar" aria-label="Buscar">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5z"/>
          </svg>
        </button>`
      : '';

    const filterButtonHTML = includeFilter
      ? `<button class="icon-btn" id="${ids.btnFilter}" title="Filtros" aria-label="Filtros">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/>
          </svg>
        </button>`
      : '';

    const headerHTML = `
      <div class="equip-stats-header" id="${ids.header}" style="display: flex !important; flex-direction: row !important;">
        <div class="stat-item">
          <span class="stat-label">${finalLabels.connectivity}</span>
          <span class="stat-value" id="${ids.connectivity}">-</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">${finalLabels.total}</span>
          <span class="stat-value" id="${ids.total}">-</span>
        </div>
        <div class="stat-item highlight">
          <span class="stat-label">${finalLabels.consumption}</span>
          <span class="stat-value" id="${ids.consumption}">-</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">${finalLabels.zero}</span>
          <span class="stat-value" id="${ids.zero}">-</span>
        </div>
        <div class="filter-actions">
          <div class="search-wrap" id="${ids.searchWrap}">
            <input type="text" id="${ids.searchInput}" placeholder="Buscar..." autocomplete="off">
          </div>
          ${searchButtonHTML}
          ${filterButtonHTML}
          <button class="icon-btn" id="${ids.btnMaximize}" title="Maximizar" aria-label="Maximizar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="icon-maximize" aria-hidden="true">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="icon-minimize" style="display:none;" aria-hidden="true">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    containerEl.insertAdjacentHTML('afterbegin', headerHTML);

    // Use setTimeout to ensure DOM is ready before attaching event handlers
    // RFC-0121: Follows showcase pattern for consistent behavior
    setTimeout(() => {
      // Search button handler
      if (includeSearch && onSearchClick) {
        const btnSearch = document.getElementById(ids.btnSearch);
        const searchWrap = document.getElementById(ids.searchWrap);
        LogHelper.log('[buildHeaderDevicesGrid] Search button:', ids.btnSearch, btnSearch);
        if (btnSearch) {
          btnSearch.addEventListener('click', () => {
            LogHelper.log('[buildHeaderDevicesGrid] Search button clicked');
            if (searchWrap) {
              searchWrap.classList.toggle('active');
              if (searchWrap.classList.contains('active')) {
                const input = document.getElementById(ids.searchInput);
                if (input) input.focus();
              }
            }
            onSearchClick();
          });
        }
      }

      // Filter button handler
      if (includeFilter && onFilterClick) {
        const btnFilter = document.getElementById(ids.btnFilter);
        LogHelper.log('[buildHeaderDevicesGrid] Filter button:', ids.btnFilter, btnFilter);
        if (btnFilter) {
          btnFilter.addEventListener('click', () => {
            LogHelper.log('[buildHeaderDevicesGrid] Filter button clicked');
            onFilterClick();
          });
        }
      }

      // Maximize button handler - toggles .maximized class on telemetry-grid-wrap
      const btnMaximize = document.getElementById(ids.btnMaximize);
      LogHelper.log('[buildHeaderDevicesGrid] Maximize button:', ids.btnMaximize, btnMaximize);
      if (btnMaximize) {
        btnMaximize.addEventListener('click', () => {
          LogHelper.log('[buildHeaderDevicesGrid] Maximize button clicked');
          const telemetryWrap = document.querySelector('.telemetry-grid-wrap');
          if (!telemetryWrap) {
            LogHelper.warn('[buildHeaderDevicesGrid] .telemetry-grid-wrap not found');
            return;
          }
          const isMaximized = telemetryWrap.classList.toggle('maximized');

          // Toggle button icon
          const iconMax = btnMaximize.querySelector('.icon-maximize');
          const iconMin = btnMaximize.querySelector('.icon-minimize');
          if (iconMax && iconMin) {
            iconMax.style.display = isMaximized ? 'none' : 'block';
            iconMin.style.display = isMaximized ? 'block' : 'none';
          }

          // Also dispatch event for other listeners
          window.dispatchEvent(
            new CustomEvent('myio:telemetry-maximize', {
              detail: { domain, idPrefix, maximized: isMaximized },
            })
          );

          LogHelper.log('[buildHeaderDevicesGrid] Maximized:', isMaximized);
        });
      }
    }, 0);

    const controller = {
      ids,
      domain,
      domainConfig,

      updateStats(stats) {
        const { online = 0, total = 0, consumption = 0, zeroCount = 0 } = stats;

        const connectivityEl = document.getElementById(ids.connectivity);
        const totalEl = document.getElementById(ids.total);
        const consumptionEl = document.getElementById(ids.consumption);
        const zeroEl = document.getElementById(ids.zero);

        if (!connectivityEl || !totalEl || !consumptionEl || !zeroEl) {
          LogHelper.warn(`buildHeaderDevicesGrid: Stats elements not found for ${idPrefix}`);
          return;
        }

        const percentage = total > 0 ? ((online / total) * 100).toFixed(1) : '0.0';

        connectivityEl.textContent = `${online}/${total} (${percentage}%)`;
        totalEl.textContent = total.toString();
        consumptionEl.textContent = domainConfig.formatValue(consumption);
        zeroEl.textContent = zeroCount.toString();

        LogHelper.log(`Header stats updated for ${idPrefix}:`, stats);
      },

      updateFromDevices(devices, options = {}) {
        const { cache } = options;

        let online = 0;

        devices.forEach((device) => {
          const devStatus = (device.deviceStatus || '').toLowerCase();
          const isOffline = ['offline', 'no_info'].includes(devStatus);
          const isNotInstalled = devStatus === 'not_installed';
          if (!isOffline && !isNotInstalled) {
            online++;
          }
        });

        let totalConsumption = 0;
        let zeroCount = 0;

        devices.forEach((device) => {
          let consumption = 0;

          // RFC-0138 FIX: Use correct field names for consumption lookup
          // Priority: device fields from API enrichment > cache lookup
          // NEVER fallback to ThingsBoard values (val/value/lastValue) when not from API

          // First, check if device was enriched with API data
          if (device.apiEnriched || device._hasApiData) {
            consumption = Number(device.consumption) || Number(device.val) || Number(device.value) || 0;
          }
          // Otherwise, try to get from cache using ingestionId
          else if (cache && device.ingestionId) {
            const cached = cache.get(device.ingestionId);
            if (cached) {
              // Use consumption/val/value fields, NOT total_value (which is API response field)
              consumption = Number(cached.consumption) || Number(cached.val) || Number(cached.value) || 0;
            }
          }

          // NOTE: Removed fallback to device.val/value/lastValue from ThingsBoard
          // Data should ONLY come from ingestion API. If no API data, consumption stays 0.

          totalConsumption += consumption;
          if (consumption === 0) zeroCount++;
        });

        this.updateStats({
          online,
          total: devices.length,
          consumption: totalConsumption,
          zeroCount,
        });
      },

      getSearchInput() {
        return document.getElementById(ids.searchInput);
      },

      toggleSearch(active) {
        const searchWrap = document.getElementById(ids.searchWrap);
        if (searchWrap) {
          if (active !== undefined) {
            searchWrap.classList.toggle('active', active);
          } else {
            searchWrap.classList.toggle('active');
          }
        }
      },

      destroy() {
        const header = document.getElementById(ids.header);
        if (header) header.remove();
      },
    };

    LogHelper.log(`Header built for domain '${domain}' with prefix '${idPrefix}'`);

    return controller;
  };

  // RFC-0140 FIX: Expose buildHeaderDevicesGrid globally for TelemetryGrid component
  window.MyIOUtils.buildHeaderDevicesGrid = buildHeaderDevicesGrid;

  // RFC-0090: createFilterModal — removed inline implementation; use MyIOLibrary.createFilterModalComponent
  // window.MyIOUtils.createFilterModal = (config) => {

  /**
   * RFC-0111/RFC-0112: Update customer cards (datasource; fallback DEFAULT_SHOPPING_CARDS)
   * with real counts and consumption from classified data.
   * Matches by customer card title to device ownerName
   * @param {Object} classified - Classified device data
   * @returns {Array} Updated customer cards with real device counts and consumption values
   */
  const updateCustomerCardsWithRealCounts = (classified) => {
    // RFC-0112: Use calculateShoppingDeviceStats to get counts AND consumption values
    const statsByOwnerName = MyIOLibrary.calculateShoppingDeviceStats(DOMAIN_ALL_LIST, classified);

    LogHelper.log('Device stats by ownerName:', Object.fromEntries(statsByOwnerName));

    // Use current shopping cards (from datasource) with fallback to defaults
    const baseCards = _currentCustomersCards || DEFAULT_SHOPPING_CARDS;

    // Persist to _currentCustomersCards so later updates (e.g. metaCounts enrichment)
    // don't revert deviceCounts back to the loading state
    _currentCustomersCards = baseCards.map((card) => {
      // Reaplica o dashboardId resolvido — a reconstrução não pode descartá-lo
      card = applyDefaultDashboardToCard(card);
      if (!card.title) {
        LogHelper.log('Card has no title, skipping');
        return card;
      }

      const cardTitleNorm = card.title.toLowerCase().trim();

      // 1. Try exact match on normalized title
      if (statsByOwnerName.has(cardTitleNorm)) {
        const stats = statsByOwnerName.get(cardTitleNorm);
        LogHelper.log(`Exact match for ${card.title}:`, stats);
        // RFC-0112: Return deviceCounts with both counts and consumption values
        return {
          ...card,
          deviceCounts: {
            energy: stats.energy,
            water: stats.water,
            temperature: stats.temperature,
            energyConsumption: stats.energyConsumption,
            waterConsumption: stats.waterConsumption,
            temperatureAvg: stats.temperatureAvg,
          },
        };
      }

      // 2. Try partial match: ownerName contains card title OR card title contains ownerName
      const matchByName = [...statsByOwnerName.keys()].find((ownerName) => {
        if (typeof ownerName !== 'string') return false;
        // Check both directions for partial match
        return ownerName.includes(cardTitleNorm) || cardTitleNorm.includes(ownerName);
      });

      if (matchByName) {
        const stats = statsByOwnerName.get(matchByName);
        LogHelper.log(`Partial match ${card.title} -> ${matchByName}:`, stats);
        // RFC-0112: Return deviceCounts with both counts and consumption values
        return {
          ...card,
          deviceCounts: {
            energy: stats.energy,
            water: stats.water,
            temperature: stats.temperature,
            energyConsumption: stats.energyConsumption,
            waterConsumption: stats.waterConsumption,
            temperatureAvg: stats.temperatureAvg,
          },
        };
      }

      LogHelper.log(`No counts found for ${card.title}`);
      return card;
    });

    return _currentCustomersCards;
  };

  /**
   * RFC-0111: Update customer cards in welcome modal with real device counts
   * @param {Object} welcomeModal - Welcome modal instance
   * @param {Array} updatedCards - Customer cards with real device counts
   */
  const updateWelcomeModalCustomersCards = (welcomeModal, updatedCards) => {
    // updateShoppingCards é a API pública do WelcomeModal na lib — não renomear aqui
    if (welcomeModal && welcomeModal.updateShoppingCards) {
      welcomeModal.updateShoppingCards(updatedCards);
      LogHelper.log('Welcome modal updated with real device counts');
      return;
    }

    // Fallback: Update DOM directly
    LogHelper.log('Updating customer cards DOM directly');
    updatedCards.forEach((card) => {
      const cardEl = document.querySelector(
        `[data-shopping-id="${card.entityId}"], [data-button-id="${card.buttonId}"]`
      );
      if (cardEl) {
        const energyBadge = cardEl.querySelector('.device-count-energy, [data-domain="energy"]');
        const waterBadge = cardEl.querySelector('.device-count-water, [data-domain="water"]');
        const tempBadge = cardEl.querySelector('.device-count-temperature, [data-domain="temperature"]');

        if (energyBadge) energyBadge.textContent = card.deviceCounts.energy || 0;
        if (waterBadge) waterBadge.textContent = card.deviceCounts.water || 0;
        if (tempBadge) tempBadge.textContent = card.deviceCounts.temperature || 0;
      }
    });
  };

  // Expose utilities globally for TELEMETRY widget (initial state)
  // RFC-0120: Include currentThemeMode for consistent theme propagation
  window.MyIOUtils = {
    DATA_API_HOST,
    ALARMS_API_BASE,
    ALARMS_API_KEY,
    GCDR_API_BASE,
    chartsBaseUrl: CHARTS_BASE_URL, // must be re-included here: this full reassignment clobbers the earlier window.MyIOUtils.chartsBaseUrl set (the FOOTER reads it later)
    enableTemperatureApiDataFetch: ENABLE_TEMPERATURE_API, // must be re-included here: this full reassignment clobbers the earlier window.MyIOUtils.enableTemperatureApiDataFetch set (RFC-0189 gates read it later)
    CLIENT_ID,
    CLIENT_SECRET,
    CUSTOMER_ING_ID,
    GCDR_CUSTOMER_ID,
    LogHelper,
    calculateDeviceStatusMasterRules: MyIOLibrary.calculateDeviceStatusMasterRules,
    mapConnectionStatus: MyIOLibrary.mapConnectionStatus,
    formatRelativeTime: MyIOLibrary.formatRelativeTime,
    formatarDuracao: MyIOLibrary.formatarDuracao,
    getCustomerNameForDevice,
    findValue: MyIOLibrary.findValueWithDefault,
    fetchCustomerServerScopeAttrs,
    // RFC-0125: Use library components for header and filter modal
    buildHeaderDevicesGrid: MyIOLibrary.createHeaderDevicesGridComponent,
    createFilterModal: MyIOLibrary.createFilterModalComponent,
    getConsumptionRangesHierarchical: () => null,
    getCachedConsumptionLimits: () => null,
    getCredentials: () => ({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      customerId: CUSTOMER_ING_ID,
      dataApiHost: DATA_API_HOST,
    }),
    customerTB_ID: getCustomerTB_ID(),
    // RFC-0120: Theme state for child widgets
    currentThemeMode: currentThemeMode,
    getThemeMode: () => currentThemeMode,
    // RFC-0152: Operational Indicators feature gating
    operationalIndicators: {
      enabled: false, // Will be set after attribute check
    },
  };

  // RFC-0121: Helper to apply background to page and all relevant containers
  const applyBackgroundToPage = (themeMode) => {
    const themeSettings = themeMode === 'dark' ? settings.darkMode : settings.lightMode;
    const backgroundType = themeSettings?.backgroundType || 'color';

    let backgroundStyle;
    if (backgroundType === 'image' && themeSettings?.backgroundUrl) {
      backgroundStyle = `url('${themeSettings.backgroundUrl}') center center / cover no-repeat fixed`;
    } else {
      const bgColor = themeSettings?.backgroundColor || (themeMode === 'dark' ? '#0f172a' : '#f8fafc');
      backgroundStyle = bgColor;
    }

    // Apply to body
    document.body.style.background = backgroundStyle;

    // Apply to ThingsBoard dashboard containers (global and section-specific)
    const tbContainers = [
      '.tb-dashboard-page',
      '.tb-dashboard-page-content',
      '.tb-absolute-fill',
      '.mat-drawer-content',
      '.mat-sidenav-content',
      '.tb-dashboard-container',
      '.tb-widget-container',
      '.tb-widget',
      'tb-dashboard-state',
      // Section-specific containers
      '.myio-header-section .tb-widget',
      '.myio-header-section .tb-widget-container',
      '.myio-menu-section .tb-widget',
      '.myio-menu-section .tb-widget-container',
      '.myio-main-view-section .tb-widget',
      '.myio-main-view-section .tb-widget-container',
      '.myio-footer-section .tb-widget',
      '.myio-footer-section .tb-widget-container',
    ];

    tbContainers.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.background = 'transparent';
        el.style.backgroundColor = 'transparent';
      });
    });

    // Also force sections to be transparent
    const sections = [
      '.myio-header-section',
      '.myio-menu-section',
      '.myio-main-view-section',
      '.myio-footer-section',
    ];
    sections.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.background = 'transparent';
        el.style.backgroundColor = 'transparent';
      });
    });

    // Apply to main wrap
    const wrap = document.getElementById('mainUniqueWrap');
    if (wrap) {
      wrap.style.background = backgroundStyle;
    }

    LogHelper.log('Background applied to page:', { themeMode, backgroundType, backgroundStyle });
  };

  // RFC-0120: Apply initial theme to main wrapper immediately
  const mainWrap = document.getElementById('mainUniqueWrap');
  if (mainWrap) {
    mainWrap.setAttribute('data-theme', currentThemeMode);
  }

  // RFC-0121: Apply initial background to page
  applyBackgroundToPage(currentThemeMode);

  LogHelper.log('MyIOUtils exposed globally (credentials pending fetch)');

  // Fetch credentials from ThingsBoard
  await fetchCredentialsFromThingsBoard();

  // RFC-0152: Fetch Operational Indicators access
  await fetchOperationalIndicatorsAccess();

  // === 3. EXTRACT WELCOME CONFIG FROM SETTINGS ===
  const welcomeConfig = {
    enableDebugMode: settings.enableDebugMode,
    defaultHeroTitle: settings.defaultHeroTitle,
    defaultHeroDescription: settings.defaultHeroDescription,
    defaultPrimaryLabel: settings.defaultPrimaryLabel,
    defaultShortcutsTitle: settings.defaultShortcutsTitle,
    darkMode: settings.darkMode || {},
    lightMode: settings.lightMode || {},
  };

  // === 4. RFC-0112: FETCH USER INFO AND OPEN WELCOME MODAL ===
  // Skip welcome modal if already opened (prevents duplicate modals)
  const welcomeModalKey = '__MYIO_WELCOME_MODAL_OPENED__';
  if (window[welcomeModalKey]) {
    LogHelper.log('Welcome modal already opened, skipping');
    return; // Don't continue initialization for child widgets
  }

  window[welcomeModalKey] = true;

  // Fetch user info for display in the modal
  const userInfoRaw = await MyIOLibrary.fetchCurrentUserInfo();
  const userInfo = userInfoRaw ? { fullName: userInfoRaw.name, email: userInfoRaw.email } : null;
  LogHelper.log('User info fetched:', userInfo);
  // Expõe o email do usuário logado para gates de UI (ex.: botão "$" do Metas × Consumo).
  // No HO o TB retorna algo como rodrigo@myio.com.br; SuperAdmin = domínio @myio.com.br.
  window.MyIOUtils = window.MyIOUtils || {};
  window.MyIOUtils.currentUserEmail = userInfo?.email || '';
  window.MyIOUtils.SuperAdmin = /@myio\.com\.br$/i.test(userInfo?.email || '');

  // Build shopping cards from datasource with fallback to DEFAULT_SHOPPING_CARDS
  _currentCustomersCards = buildCustomerCardsFromDatasource(self.ctx.data || []);
  LogHelper.log('Initial shopping cards:', _currentCustomersCards.length, 'cards');

  const welcomeModal = MyIOLibrary.openWelcomeModal({
    ctx: self.ctx,
    themeMode: currentThemeMode,
    showThemeToggle: true,
    showUserMenu: true, // Explicitly enable user menu
    configTemplate: welcomeConfig,
    shoppingCards: _currentCustomersCards, // From datasource or fallback to defaults
    cardVersion: 'v1', // Use original card style (not Metro UI v2)
    userInfo: userInfo, // Pass user info for display
    ctaLabel: welcomeConfig.defaultPrimaryLabel || 'ACESSAR PAINEL',
    ctaDisabled: false,
    closeOnCtaClick: true,
    closeOnCardClick: true,
    showEnergyValue: false,
    showWaterValue: false,
    showTempValue: false,
    countSizeMultiplier: 2,
    showFontSizeSlider: true,
    entityLabel: settings.goalsEntityLabel || 'shopping',
    onThemeChange: (newTheme) => {
      currentThemeMode = newTheme;
      applyGlobalTheme(newTheme);
      // Update all components with new theme
      if (headerInstance) headerInstance.setThemeMode?.(newTheme);
      if (menuInstance) menuInstance.setThemeMode?.(newTheme);
      if (footerInstance) footerInstance.setThemeMode?.(newTheme);
    },
    onClose: () => {
      LogHelper.log('[MAIN_UNIQUE] Welcome modal closed');
      // Clear flag to allow re-opening on next navigation
      window['__MYIO_WELCOME_MODAL_OPENED__'] = false;
    },
    onCardClick: (card) => {
      LogHelper.log('[MAIN_UNIQUE] Shopping card clicked:', card.title);
      // Handle shopping selection if needed
    },
  });

  // RFC-0126: Update module-level reference for early event handlers
  _welcomeModalRef = welcomeModal;

  // Os datasources dos HOs não expõem dataKey `dashboardId` — sem ele os cards do
  // welcome nunca ficam clicáveis (não redirecionam ao dashboard do shopping).
  // Enriquece async com o attr `customerDefaultDashboard` de cada customer.
  enrichShoppingCardsWithDefaultDashboards(welcomeModal);

  // Retry function: wait for data-ready event with retry and toast feedback
  // 10 attempts x 3s = 30s max wait time
  const waitForDataReadyWithRetry = async (
    componentName,
    onDataReceived,
    maxRetries = 10,
    intervalMs = 3000
  ) => {
    let dataReceived = false;
    let receivedClassified = null;

    // Listen for data-ready event
    const dataReadyHandler = (event) => {
      const { classified } = event.detail || {};
      if (classified) {
        dataReceived = true;
        receivedClassified = classified;
      }
    };
    window.addEventListener('myio:data-ready', dataReadyHandler);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Check if data already arrived
      if (dataReceived && receivedClassified) {
        window.removeEventListener('myio:data-ready', dataReadyHandler);
        LogHelper.log(`[MAIN_UNIQUE] ${componentName} data received on attempt ${attempt}`);
        if (attempt > 1) {
          MyIOLibrary.MyIOToast?.success?.(`Dados de ${componentName} carregados (tentativa ${attempt})`);
        }
        onDataReceived(receivedClassified);
        return true;
      }

      if (attempt < maxRetries) {
        MyIOLibrary.MyIOToast?.warning?.(
          `Aguardando dados para ${componentName}... Tentativa ${attempt}/${maxRetries}`,
          intervalMs
        );
        LogHelper.log(`[MAIN_UNIQUE] Waiting for ${componentName} data, attempt ${attempt}/${maxRetries}`);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    // All retries exhausted
    window.removeEventListener('myio:data-ready', dataReadyHandler);
    LogHelper.log(`[MAIN_UNIQUE] ${componentName} data not received after ${maxRetries} attempts`);
    MyIOLibrary.MyIOToast?.error?.(`Não foi possível carregar dados de ${componentName}. Tente recarregar.`);
    return false;
  };

  // Start retry for WelcomeModal data (non-blocking)
  waitForDataReadyWithRetry('Shopping Cards', (classified) => {
    const updatedCards = updateCustomerCardsWithRealCounts(classified);
    updateWelcomeModalCustomersCards(welcomeModal, updatedCards);
    maybeReleaseCta(); // telemetria chegou → libera o CTA se os meta-counts já terminaram
  });

  // RFC-0126: Listen for update event from early handler (handles future updates)
  const updateWelcomeHandler = (event) => {
    const { classified, shoppingCards: dynamicCards } = event.detail || {};
    LogHelper.log('Update welcome modal event received');

    if (classified) {
      const updatedCards = updateCustomerCardsWithRealCounts(classified);
      updateWelcomeModalCustomersCards(welcomeModal, updatedCards);
    } else if (dynamicCards && dynamicCards.length > 0) {
      _currentCustomersCards = dynamicCards;
      updateWelcomeModalCustomersCards(welcomeModal, dynamicCards);
    }
    maybeReleaseCta(); // telemetria pode ter chegado → reavalia o gate do CTA

    // Cards may have arrived/changed: fetch meta counts for any not yet enriched
    enrichCardsWithMetaCounts();
  };

  // Listen for data-ready to update WelcomeModal when data arrives (permanent listener)
  // This covers cases where data takes longer than the retry period (30s)
  window.addEventListener('myio:data-ready', updateWelcomeHandler);

  // RFC-0111: Listen for event to re-open welcome modal (from header back button)
  window.addEventListener('myio:open-welcome-modal', () => {
    LogHelper.log('Re-opening welcome modal (triggered by header back button)');
    if (welcomeModal && welcomeModal.open) {
      welcomeModal.open();
    }
  });

  // === WelcomeModal meta counts (users / alarms / annotations) ===
  // Users: TB GET /api/customer/{id}/users — same source as the MENU user management modal
  // Alarms: GCDR Alarms API filtered by the customer's gcdrCustomerId — same rule as the v-5.4.0 header badge
  // Annotations: buildAnnotationServiceOrchestrator over SERVER_SCOPE log_annotations (RFC-0203)
  // All customers run in parallel; each of the 3 sources lands on the card as soon as it resolves
  // (badge spinners → values, per-card progress bar, global progress bar, CTA gated at 100%).
  const _enrichedMetaIds = new Set();
  const _cardMetaProgress = new Map(); // entityId -> completed sources (0..3)
  let _metaTasksTotal = 0;
  let _metaTasksDone = 0;

  // Gate do CTA "Acessar painel": só libera quando os meta-counts E a telemetria
  // (deviceCounts) terminarem. Fallback timer evita travar eternamente se a
  // telemetria não resolver (card sem match / dado vazio).
  let _metaTasksAllDone = false;
  let _ctaFallbackFired = false;
  let _ctaFallbackTimer = null;
  const _telemetryReady = () => {
    const targets = (_currentCustomersCards || []).filter(
      (c) => c && c.entityType === 'CUSTOMER' && (c.customerId || c.entityId)
    );
    if (!targets.length) return true;
    return targets.every((c) => {
      const d = c.deviceCounts || {};
      return d.energy != null || d.water != null || d.temperature != null;
    });
  };
  const _releaseCta = () => {
    welcomeModal.setCtaHidden?.(false);
    welcomeModal.setCtaDisabled?.(false);
  };
  const maybeReleaseCta = () => {
    if (!_metaTasksAllDone) return;
    if (_telemetryReady() || _ctaFallbackFired) {
      if (_ctaFallbackTimer) {
        clearTimeout(_ctaFallbackTimer);
        _ctaFallbackTimer = null;
      }
      _releaseCta();
    } else if (!_ctaFallbackTimer) {
      _ctaFallbackTimer = setTimeout(() => {
        _ctaFallbackFired = true;
        _ctaFallbackTimer = null;
        _releaseCta();
      }, 15000);
    }
  };

  const enrichCardsWithMetaCounts = async () => {
    const jwt = getJwtToken();
    const cards = _currentCustomersCards || [];
    if (!jwt || cards.length === 0) return;

    const tbBase = window.location.origin;

    // Same rule as v-5.4.0: offline/connectivity alarms are excluded from the badge
    const isOfflineAlarm = (a) => {
      const t = String(a?.title || '').toUpperCase();
      return (
        a?.alarmType === 'connectivity' ||
        t.startsWith('DEVICE OFFLINE') ||
        t.startsWith('DISPOSITIVO OFFLINE')
      );
    };

    const fetchUsersMeta = async (customerTbId) => {
      try {
        const res = await fetch(`${tbBase}/api/customer/${customerTbId}/users?pageSize=100&page=0`, {
          headers: { 'X-Authorization': `Bearer ${jwt}` },
        });
        if (!res.ok) return null;
        const page = await res.json();
        const data = Array.isArray(page?.data) ? page.data : [];
        const list = data.map((u) => ({
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Usuário',
          email: u.email || '',
        }));
        return { count: Number(page?.totalElements ?? list.length), list };
      } catch (err) {
        LogHelper.warn('[MetaCounts] users fetch failed:', err);
        return null;
      }
    };

    const fetchAlarmsMeta = async (attrs) => {
      const gcdrCustomerId = attrs?.gcdrCustomerId || '';
      // A chave é per-customer (gcdrApiKey do SERVER_SCOPE do shopping) — a
      // settings.alarmsApiKey é rejeitada com 401 no /api/v1 (auditoria 2026-07-07)
      const apiKey = attrs?.gcdrApiKey || GCDR_API_KEY || ALARMS_API_KEY;
      if (!apiKey || !gcdrCustomerId) return null;
      try {
        const url = `${ALARMS_API_BASE}/alarms?state=OPEN,ACK,ESCALATED,SNOOZED&customerId=${encodeURIComponent(gcdrCustomerId)}&limit=100`;
        const res = await fetch(url, {
          headers: {
            'X-API-Key': apiKey,
            'X-Tenant-ID': attrs?.gcdrTenantId || '',
            Accept: 'application/json',
          },
        });
        if (!res.ok) return null;
        const json = await res.json();
        const alarms = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.items)
            ? json.items
            : Array.isArray(json?.data?.items)
              ? json.data.items
              : [];
        const visible = alarms.filter((a) => !isOfflineAlarm(a));
        return {
          count: visible.length,
          list: visible.slice(0, 20).map((a) => ({
            title: a.title || a.alarmType || 'Alarme',
            severity: a.severity || '',
            state: a.state || '',
            deviceName: a.deviceName || a.deviceLabel || '',
          })),
        };
      } catch (err) {
        LogHelper.warn('[MetaCounts] alarms fetch failed:', err);
        return null;
      }
    };

    const fetchAnnotationsMeta = async (customerTbId) => {
      if (!MyIOLibrary.buildAnnotationServiceOrchestrator) return null;
      try {
        const orch = await MyIOLibrary.buildAnnotationServiceOrchestrator({
          customerId: customerTbId,
          tbHost: tbBase,
          jwt,
        });
        if (!orch) return null;
        const list = [];
        (orch.getAll?.() || []).forEach((d) => {
          (d.annotations || []).forEach((a) => {
            if (a.status === 'archived') return;
            list.push({
              text: a.text || '',
              type: a.type || '',
              deviceLabel: d.label || d.name || '',
              createdAt: a.createdAt || '',
            });
          });
        });
        list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return { count: orch.getTotalCount?.() ?? list.length, list: list.slice(0, 20) };
      } catch (err) {
        LogHelper.warn('[MetaCounts] annotations fetch failed:', err);
        return null;
      }
    };

    // Merge a partial result into the CURRENT cards by entityId (deviceCounts updates replace
    // the array concurrently, so never mutate a stale snapshot) and re-render the modal
    const applyMetaPatch = (entityId, countsPatch, detailsPatch) => {
      _currentCustomersCards = (_currentCustomersCards || []).map((c) => {
        if (c.entityId !== entityId) return c;
        return {
          ...c,
          metaCounts: { ...(c.metaCounts || {}), ...countsPatch },
          metaDetails: { ...(c.metaDetails || {}), ...(detailsPatch || {}) },
          metaProgress: (_cardMetaProgress.get(entityId) ?? 0) / 3,
        };
      });
      updateWelcomeModalCustomersCards(welcomeModal, _currentCustomersCards);
    };

    // One source finished for one card: bump per-card + global progress; unlock CTA at 100%
    const completeMetaTask = (entityId) => {
      _cardMetaProgress.set(entityId, (_cardMetaProgress.get(entityId) ?? 0) + 1);
      _metaTasksDone++;
      const pct = _metaTasksTotal > 0 ? (_metaTasksDone / _metaTasksTotal) * 100 : 100;
      welcomeModal.setEnrichmentProgress?.(pct);
      if (_metaTasksDone >= _metaTasksTotal) {
        _metaTasksAllDone = true;
        maybeReleaseCta(); // só libera se a telemetria também estiver pronta (ou fallback)
      }
    };

    // Only cards from the 'customers' datasource carry a TB customer id;
    // DEFAULT fallback cards (ASSET, customerId null) can't be counted
    const targets = cards
      .filter(
        (c) =>
          c.entityType === 'CUSTOMER' && (c.customerId || c.entityId) && !_enrichedMetaIds.has(c.entityId)
      )
      .map((c) => ({ entityId: c.entityId, customerTbId: c.customerId || c.entityId, title: c.title }));

    if (targets.length === 0) return;

    targets.forEach((t) => _enrichedMetaIds.add(t.entityId));
    _metaTasksTotal += targets.length * 3;

    // CTA hidden (and disabled as belt-and-braces) until every source of every customer resolves
    welcomeModal.setCtaHidden?.(true);
    welcomeModal.setCtaDisabled?.(true);
    welcomeModal.setEnrichmentProgress?.((_metaTasksDone / _metaTasksTotal) * 100);

    // Seed loading state: badge spinners + 0% card progress bar
    targets.forEach((t) => {
      _cardMetaProgress.set(t.entityId, _cardMetaProgress.get(t.entityId) ?? 0);
      applyMetaPatch(
        t.entityId,
        ENABLE_ANNOTATIONS_META
          ? { users: null, alarms: null, annotations: null }
          : { users: null, alarms: null, annotationsLocked: true },
        {}
      );
    });

    try {
      await Promise.all(
        targets.map(async (target) => {
          const attrs = await fetchCustomerServerScopeAttrs(target.customerTbId).catch(() => ({}));
          await Promise.all([
            fetchUsersMeta(target.customerTbId).then((r) => {
              completeMetaTask(target.entityId);
              applyMetaPatch(target.entityId, { users: r?.count ?? 0 }, { users: r?.list ?? [] });
            }),
            fetchAlarmsMeta(attrs).then((r) => {
              completeMetaTask(target.entityId);
              applyMetaPatch(target.entityId, { alarms: r?.count ?? 0 }, { alarms: r?.list ?? [] });
            }),
            ENABLE_ANNOTATIONS_META
              ? fetchAnnotationsMeta(target.customerTbId).then((r) => {
                  completeMetaTask(target.entityId);
                  applyMetaPatch(
                    target.entityId,
                    { annotations: r?.count ?? 0 },
                    { annotations: r?.list ?? [] }
                  );
                })
              : Promise.resolve().then(() => {
                  // Funcionalidade não liberada: sem request, badge fica com cadeado.
                  completeMetaTask(target.entityId);
                  applyMetaPatch(target.entityId, { annotationsLocked: true }, {});
                }),
          ]);
          LogHelper.log(`[MetaCounts] ${target.title}: enrichment complete`);
        })
      );
    } catch (err) {
      LogHelper.error('[MetaCounts] enrichment failed:', err);
      welcomeModal.setCtaHidden?.(false);
      welcomeModal.setCtaDisabled?.(false);
      welcomeModal.setEnrichmentProgress?.(100, 'Falha ao carregar indicadores');
    }
  };

  // Non-blocking: counts appear progressively as each source resolves
  enrichCardsWithMetaCounts();

  // === 5. RFC-0113: RENDER HEADER COMPONENT ===
  const headerContainer = document.getElementById('headerContainer');
  let headerInstance = null;

  // As cores de FONTE do appearance (cardEnergiaFontColor etc.) chegam ao card como
  // `color` inline, mas o CSS da lib pinta título/kpi/subrow com rgba(255,255,255,.9)
  // hardcoded — a fonte configurada nunca aparece. Injeta regras por card (id) apenas
  // quando a cor foi configurada nas settings, com !important para vencer a classe.
  const applyHeaderFontColorFix = () => {
    const map = {
      equip: settings.cardEquipamentosFontColor,
      energy: settings.cardEnergiaFontColor,
      temp: settings.cardTemperaturaFontColor,
      water: settings.cardAguaFontColor,
    };
    const rules = Object.entries(map)
      .filter(([, color]) => !!color)
      .map(
        ([k, color]) => `
#headerContainer #myio-header-card-${k} .myio-header-card__title,
#headerContainer #myio-header-card-${k} .myio-header-card__kpi,
#headerContainer #myio-header-card-${k} .myio-header-card__kpi *,
#headerContainer #myio-header-card-${k} .myio-header-card__subrow,
#headerContainer #myio-header-card-${k} .myio-header-card__subrow *{color:${color} !important;}`
      )
      .join('\n');
    if (!rules) return;
    let tag = document.getElementById('myio-header-fontcolor-fix');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'myio-header-fontcolor-fix';
      document.head.appendChild(tag);
    }
    tag.textContent = rules;
  };

  if (headerContainer && MyIOLibrary.createHeaderComponent) {
    headerInstance = MyIOLibrary.createHeaderComponent({
      container: headerContainer,
      ctx: self.ctx,
      themeMode: currentThemeMode,
      logoUrl: settings.darkMode?.logoUrl || settings.lightMode?.logoUrl,
      configTemplate: {
        logoBackgroundColor: settings.logoBackgroundColor,
      },
      cardColors: {
        equipment: {
          background: settings.cardEquipamentosBackgroundColor,
          font: settings.cardEquipamentosFontColor,
        },
        energy: {
          background: settings.cardEnergiaBackgroundColor,
          font: settings.cardEnergiaFontColor,
        },
        temperature: {
          background: settings.cardTemperaturaBackgroundColor,
          font: settings.cardTemperaturaFontColor,
        },
        water: {
          background: settings.cardAguaBackgroundColor,
          font: settings.cardAguaFontColor,
        },
      },
      enableTooltips: true,
      onFilterApply: (selection) => {
        window.dispatchEvent(
          new CustomEvent('myio:filter-applied', {
            detail: { selection, ts: Date.now() },
          })
        );
      },
      onBackClick: () => {
        // Re-open welcome modal
        if (welcomeModal) {
          welcomeModal.open?.();
        }
      },
    });
    applyHeaderFontColorFix();

    // RFC-0126: Update module-level reference for early event handlers
    _headerInstanceRef = headerInstance;

    // Helper function to dispatch header events from classified data
    const dispatchHeaderEventsFromClassified = (classifiedData) => {
      LogHelper.log('[MAIN_UNIQUE] Dispatching summary events for header');

      // Calculate totals
      const energyItems = [
        ...(classifiedData.energy?.equipments || []),
        ...(classifiedData.energy?.stores || []),
        ...(classifiedData.energy?.entrada || []),
      ];
      const waterItems = [
        ...(classifiedData.water?.hidrometro_entrada || []),
        ...(classifiedData.water?.banheiros || []),
        ...(classifiedData.water?.hidrometro_area_comum || []),
        ...(classifiedData.water?.hidrometro || []),
      ];
      const tempItems = [
        ...(classifiedData.temperature?.termostato || []),
        ...(classifiedData.temperature?.termostato_external || []),
      ];

      const energyTotal = energyItems.reduce(
        (sum, d) => sum + Number(d.value || d.val || d.consumption || 0),
        0
      );
      const waterTotal = waterItems.reduce((sum, d) => sum + Number(d.pulses || d.value || 0), 0);
      const tempValues = tempItems.map((d) => Number(d.temperature || 0)).filter((v) => v > 0);
      const tempAvg =
        tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : null;

      // Build tooltip status data
      const allEnergyDevices = [
        ...(classifiedData.energy?.equipments || []),
        ...(classifiedData.energy?.stores || []),
      ];
      const allWaterDevices = [
        ...(classifiedData.water?.hidrometro_entrada || []),
        ...(classifiedData.water?.banheiros || []),
        ...(classifiedData.water?.hidrometro_area_comum || []),
        ...(classifiedData.water?.hidrometro || []),
      ];
      const allTempDevices = [
        ...(classifiedData.temperature?.termostato || []),
        ...(classifiedData.temperature?.termostato_external || []),
      ];

      const energyByStatus = buildTooltipStatusData(allEnergyDevices);
      const waterByStatus = buildTooltipStatusData(allWaterDevices);
      const tempByStatus = buildTooltipStatusData(allTempDevices);

      // Get temperature limits
      const minTemp = Number(window.MyIOUtils?.temperatureLimits?.minTemperature ?? 18);
      const maxTemp = Number(window.MyIOUtils?.temperatureLimits?.maxTemperature ?? 26);

      // Dispatch energy event
      window.dispatchEvent(
        new CustomEvent('myio:energy-summary-ready', {
          detail: {
            customerTotal: energyTotal,
            unfilteredTotal: energyTotal,
            isFiltered: false,
            equipmentsTotal: (classifiedData.energy?.equipments || []).reduce(
              (sum, d) => sum + Number(d.value || 0),
              0
            ),
            lojasTotal: (classifiedData.energy?.stores || []).reduce(
              (sum, d) => sum + Number(d.value || 0),
              0
            ),
            totalDevices: allEnergyDevices.length,
            totalConsumption: energyTotal,
            byStatus: energyByStatus,
            byCategory: buildEnergyCategoryData(classifiedData),
            byShoppingTotal: buildEnergyCategoryDataByShopping(classifiedData),
            shoppingsEnergy: buildCustomersEnergyBreakdown(classifiedData),
            entityLabel: settings.goalsEntityLabel || 'Shopping',
            lastUpdated: new Date().toISOString(),
          },
        })
      );

      // Dispatch water event
      window.dispatchEvent(
        new CustomEvent('myio:water-summary-ready', {
          detail: {
            filteredTotal: waterTotal,
            unfilteredTotal: waterTotal,
            isFiltered: false,
            totalDevices: allWaterDevices.length,
            totalConsumption: waterTotal,
            byStatus: waterByStatus,
            byCategory: buildWaterCategoryData(classifiedData),
            byShoppingTotal: buildWaterCategoryDataByShopping(classifiedData),
            shoppingsWater: buildCustomersWaterBreakdown(classifiedData),
            entityLabel: settings.goalsEntityLabel || 'Shopping',
            lastUpdated: new Date().toISOString(),
          },
        })
      );

      // Build and dispatch temperature event
      const tempDevicesForTooltip = allTempDevices.map((d) => {
        const temp = Number(d.temperature || 0);
        let status = 'unknown';
        if (temp > 0) {
          status = temp >= minTemp && temp <= maxTemp ? 'ok' : 'warn';
        }
        return {
          name: d.labelOrName || d.name || d.label || 'Sensor',
          temp: temp,
          status: status,
        };
      });

      // Calculate shoppings temperature status (in range vs out of range)
      const tempShoppingsStatus = buildCustomersTemperatureStatus(classifiedData, minTemp, maxTemp);

      window.dispatchEvent(
        new CustomEvent('myio:temperature-data-ready', {
          detail: {
            globalAvg: tempAvg,
            isFiltered: false,
            shoppingsInRange: tempShoppingsStatus.shoppingsInRange,
            shoppingsOutOfRange: tempShoppingsStatus.shoppingsOutOfRange,
            totalDevices: allTempDevices.length,
            devices: tempDevicesForTooltip,
            temperatureMin: minTemp,
            temperatureMax: maxTemp,
            byStatus: tempByStatus,
            lastUpdated: new Date().toISOString(),
          },
        })
      );

      // Dispatch equipment count event
      const onlineEquipments = (classifiedData.energy?.equipments || []).filter((d) => {
        const status = (d.deviceStatus || d.status || '').toLowerCase();
        return !['offline', 'no_info', 'not_installed'].includes(status);
      }).length;

      window.dispatchEvent(
        new CustomEvent('myio:equipment-count-updated', {
          detail: {
            totalEquipments: (classifiedData.energy?.equipments || []).length,
            filteredEquipments: onlineEquipments,
            allShoppingsSelected: true,
            byStatus: energyByStatus,
            byCategory: buildEnergyCategoryData(classifiedData),
          },
        })
      );
    };

    // Start retry for Header data (non-blocking)
    waitForDataReadyWithRetry('Header KPIs', (classified) => {
      dispatchHeaderEventsFromClassified(classified);
    });
  }

  // === 6. RFC-0114: RENDER MENU COMPONENT ===
  const menuContainer = document.getElementById('menuContainer');
  let menuInstance = null;
  let telemetryGridInstance = null;
  let energyPanelInstance = null; // RFC-0132: Energy panel instance
  let waterPanelInstance = null; // RFC-0133: Water panel instance
  let operationalGridInstance = null; // RFC-0152 Phase 3: Operational equipment grid instance
  let operationalDashboardInstance = null; // RFC-0152 Phase 5: Operational dashboard instance
  let alarmsNotificationsPanelInstance = null; // RFC-0152 Phase 4: Alarms notifications panel instance
  // RFC-0117: now read by the data-ready / theme-change handlers to refresh the DOM-based temperature panel.
  let currentViewMode = 'telemetry'; // 'telemetry' | 'energy-panel' | 'water-panel' | 'temperature-panel' | 'operational-grid' | 'operational-dashboard' | 'alarms-panel'
  let currentTelemetryDomain = DOMAIN_ENERGY;
  let currentTelemetryContext = 'equipments';

  if (menuContainer && MyIOLibrary.createMenuComponent) {
    menuInstance = MyIOLibrary.createMenuComponent({
      container: menuContainer,
      ctx: self.ctx,
      themeMode: currentThemeMode,
      configTemplate: {
        tabSelecionadoBackgroundColor: settings.tabSelecionadoBackgroundColor || '#2F5848',
        tabSelecionadoFontColor: settings.tabSelecionadoFontColor || '#F2F2F2',
        tabNaoSelecionadoBackgroundColor: settings.tabNaoSelecionadoBackgroundColor || '#FFFFFF',
        tabNaoSelecionadoFontColor: settings.tabNaoSelecionadoFontColor || '#1C2743',
        shoppingFilterLabel: settings.shoppingFilterLabel,
        enableDebugMode: settings.enableDebugMode,
      },
      initialTab: DOMAIN_ENERGY,
      initialDateRange: {
        start: window.MyIOLibrary.getFirstDayOfMonth(),
        end: new Date(),
      },
      onTabChange: (tabId, contextId, target) => {
        LogHelper.log('[MAIN_UNIQUE] Tab changed:', tabId, contextId, target);
        // Issue 8 fix: Also handle tab change to update telemetry grid for water/temperature
        handleContextChange(tabId, contextId, target);
      },
      onContextChange: (tabId, contextId, target) => {
        LogHelper.log('[MAIN_UNIQUE] Context changed:', tabId, contextId, target);
        handleContextChange(tabId, contextId, target);
      },
      onDateRangeChange: (start, end) => {
        self.ctx.$scope.startDateISO = start.toISOString();
        self.ctx.$scope.endDateISO = end.toISOString();
        window.dispatchEvent(
          new CustomEvent('myio:update-date', {
            detail: { startISO: start.toISOString(), endISO: end.toISOString() },
          })
        );
      },
      onFilterApply: (selection) => {
        window.dispatchEvent(
          new CustomEvent('myio:filter-applied', {
            detail: { selection, ts: Date.now() },
          })
        );
      },
      onLoad: () => {
        window.dispatchEvent(new CustomEvent('myio:request-reload'));
      },
      onClear: () => {
        window.dispatchEvent(new CustomEvent('myio:force-refresh'));
      },
      onGoals: () => {
        window.dispatchEvent(new CustomEvent('myio:open-goals-panel'));
      },
    });

    // RFC-0126: Update module-level reference for early event handlers
    _menuInstanceRef = menuInstance;

    // Set initial date range to scope variables (for handleActionDashboard)
    const initialStart = window.MyIOLibrary.getFirstDayOfMonth();
    const initialEnd = new Date();
    self.ctx.$scope.startDateISO = initialStart.toISOString();
    self.ctx.$scope.endDateISO = initialEnd.toISOString();
    LogHelper.log('[MAIN_UNIQUE] Initial date range set:', {
      startDateISO: self.ctx.$scope.startDateISO,
      endDateISO: self.ctx.$scope.endDateISO,
    });

    // RFC-0126: If shoppings were cached before menu was created, update now
    if (_cachedShoppings.length > 0) {
      menuInstance.updateShoppings?.(_cachedShoppings);
      LogHelper.log(
        '[MAIN_UNIQUE] Shoppings loaded from cache after menu creation:',
        _cachedShoppings.length
      );
    }
  }

  // === 6.1 RFC-0121: RENDER TELEMETRY GRID COMPONENT ===
  const telemetryGridContainer = document.getElementById('telemetryGridContainer');

  if (telemetryGridContainer && MyIOLibrary.createTelemetryGridComponent) {
    // Get devices from orchestrator
    let initialDevices =
      window.MyIOOrchestrator?.getDevices?.(currentTelemetryDomain, currentTelemetryContext) || [];

    // Retry function: 5 attempts, 3 seconds interval, with toast feedback
    const retryGetDevicesWithToast = async (domain, context, maxRetries = 5, intervalMs = 3000) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const devices = window.MyIOOrchestrator?.getDevices?.(domain, context) || [];

        if (devices.length > 0) {
          LogHelper.log(`[MAIN_UNIQUE] Devices loaded on attempt ${attempt}:`, devices.length);
          if (attempt > 1) {
            // Show success toast if we had to retry
            MyIOLibrary.MyIOToast?.success?.(`Dados carregados com sucesso (tentativa ${attempt})`);
          }
          return devices;
        }

        if (attempt < maxRetries) {
          // Show warning toast with retry count
          MyIOLibrary.MyIOToast?.warning?.(
            `Aguardando dados do orchestrator... Tentativa ${attempt}/${maxRetries}`,
            intervalMs
          );
          LogHelper.log(
            `[MAIN_UNIQUE] Orchestrator not ready, retry ${attempt}/${maxRetries} in ${intervalMs}ms`
          );

          // Wait before next attempt
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }

      // All retries exhausted
      LogHelper.log('[MAIN_UNIQUE] All retries exhausted, no devices available');
      MyIOLibrary.MyIOToast?.error?.('Não foi possível carregar os dados. Tente recarregar a página.');
      return [];
    };

    // If no devices initially, start retry loop (non-blocking)
    if (initialDevices.length === 0) {
      LogHelper.log('[MAIN_UNIQUE] No devices from orchestrator, starting retry...');

      // Start retry in background and update grid when data arrives
      retryGetDevicesWithToast(currentTelemetryDomain, currentTelemetryContext).then((devices) => {
        if (devices.length > 0 && telemetryGridInstance) {
          LogHelper.log('[MAIN_UNIQUE] Updating TelemetryGrid with retried devices:', devices.length);
          telemetryGridInstance.updateDevices?.(devices);
        }
      });
    }

    telemetryGridInstance = MyIOLibrary.createTelemetryGridComponent({
      container: telemetryGridContainer,
      domain: currentTelemetryDomain,
      context: currentTelemetryContext,
      devices: initialDevices,
      themeMode: currentThemeMode,

      debugActive: settings.enableDebugMode,
      activeTooltipDebug: settings.activeTooltipDebug,
      useNewComponents: true,
      enableSelection: true,
      enableDragDrop: true,
      hideInfoMenuItem: true,

      configTemplate: {
        enableDebugMode: settings.enableDebugMode,
        activeTooltipDebug: settings.activeTooltipDebug,
        cardEquipamentosBackgroundColor: settings.cardEquipamentosBackgroundColor,
        cardEquipamentosFontColor: settings.cardEquipamentosFontColor,
        cardEnergiaBackgroundColor: settings.cardEnergiaBackgroundColor,
        cardEnergiaFontColor: settings.cardEnergiaFontColor,
        cardTemperaturaBackgroundColor: settings.cardTemperaturaBackgroundColor,
        cardTemperaturaFontColor: settings.cardTemperaturaFontColor,
        cardAguaBackgroundColor: settings.cardAguaBackgroundColor,
        cardAguaFontColor: settings.cardAguaFontColor,
      },

      // RFC-0121: Pass buildHeaderDevicesGrid and createFilterModal for header/filter rendering
      buildHeaderDevicesGrid: window.MyIOUtils?.buildHeaderDevicesGrid,
      createFilterModal: MyIOLibrary.createFilterModalComponent,

      onCardAction: (action, device) => {
        window.dispatchEvent(
          new CustomEvent('myio:telemetry-card-action', {
            detail: {
              action,
              device,
              domain: currentTelemetryDomain,
              context: currentTelemetryContext,
              ts: Date.now(),
            },
          })
        );
      },

      onStatsUpdate: (stats) => {
        window.dispatchEvent(
          new CustomEvent('myio:telemetry-stats', {
            detail: {
              stats,
              domain: currentTelemetryDomain,
              context: currentTelemetryContext,
              ts: Date.now(),
            },
          })
        );
      },
    });
  }

  // RFC-0126: Apply shopping filter from Header/Menu filter modal
  window.addEventListener('myio:filter-applied', (e) => {
    const selection = e.detail?.selection || [];
    // Include both value (UUID) AND name (shopping name) for matching
    // Devices have ownerName as lowercase name (e.g., 'mestre álvaro'), not UUID
    const shoppingIds = Array.isArray(selection)
      ? selection.flatMap((s) => [s?.value, s?.name, s?.name?.toLowerCase()].filter(Boolean))
      : [];

    // RFC-0126: Store in global state for backward compatibility with legacy widgets
    window.custumersSelected = selection;
    window.STATE = window.STATE || {};
    window.STATE.selectedShoppingIds = shoppingIds;

    LogHelper.log('[MAIN_UNIQUE] myio:filter-applied received:', shoppingIds.length, 'shoppings selected');
    LogHelper.log('[MAIN_UNIQUE] Filter shoppingIds values:', shoppingIds);
    if (selection.length > 0) {
      LogHelper.log('[MAIN_UNIQUE] Filter selection sample:', {
        name: selection[0]?.name,
        value: selection[0]?.value,
        customerId: selection[0]?.customerId,
        ingestionId: selection[0]?.ingestionId,
      });
    }

    // 1. Apply filter to TelemetryGrid
    if (telemetryGridInstance) {
      telemetryGridInstance.applyFilter(shoppingIds);
    }

    // 2. Calculate filtered stats and update Header
    const classified = window.MyIOOrchestratorData?.classified;
    if (classified && headerInstance) {
      // Build filtered classified structure (used by tooltip/category breakdowns)
      // Filter devices by selected shoppingIds (match by customerId, ingestionId, customerName, or ownerName)
      const filterDevices = (devices) => {
        if (shoppingIds.length === 0) return devices; // No filter = all
        return devices.filter(
          (d) =>
            shoppingIds.includes(d.customerId) ||
            shoppingIds.includes(d.ingestionId) ||
            shoppingIds.includes(d.customerName) ||
            shoppingIds.includes(d.ownerName)
        );
      };

      const filteredClassified = {
        energy: {
          equipments: filterDevices(classified.energy?.equipments || []),
          stores: filterDevices(classified.energy?.stores || []),
          entrada: filterDevices(classified.energy?.entrada || []),
        },
        water: {
          hidrometro_entrada: filterDevices(classified.water?.hidrometro_entrada || []),
          banheiros: filterDevices(classified.water?.banheiros || []),
          hidrometro_area_comum: filterDevices(classified.water?.hidrometro_area_comum || []),
          hidrometro: filterDevices(classified.water?.hidrometro || []),
        },
        temperature: {
          termostato: filterDevices(classified.temperature?.termostato || []),
          termostato_external: filterDevices(classified.temperature?.termostato_external || []),
        },
      };

      // Calculate filtered totals for each domain
      const allEnergyItems = [...(classified.energy?.equipments || []), ...(classified.energy?.stores || [])];
      const allWaterItems = [
        ...(classified.water?.hidrometro_entrada || []),
        ...(classified.water?.banheiros || []),
        ...(classified.water?.hidrometro_area_comum || []),
        ...(classified.water?.hidrometro || []),
      ];
      const allTempItems = [
        ...(classified.temperature?.termostato || []),
        ...(classified.temperature?.termostato_external || []),
      ];

      const filteredEnergy = filterDevices(allEnergyItems);
      const filteredWater = filterDevices(allWaterItems);
      const filteredTemp = filterDevices(allTempItems);

      // Calculate totals
      const unfilteredEnergyTotal = allEnergyItems.reduce(
        (sum, d) => sum + Number(d.value || d.consumption || 0),
        0
      );
      const unfilteredWaterTotal = allWaterItems.reduce(
        (sum, d) => sum + Number(d.value || d.pulses || 0),
        0
      );

      const filteredEnergyTotal = filteredEnergy.reduce(
        (sum, d) => sum + Number(d.value || d.consumption || 0),
        0
      );
      const filteredWaterTotal = filteredWater.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0);

      // Temperature average
      const tempValues = filteredTemp.map((d) => Number(d.temperature || 0)).filter((v) => v > 0);
      const tempAvg =
        tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : null;

      const isFiltered = shoppingIds.length > 0;

      // RFC-0126: Build full tooltip payloads (so tooltips don't regress to zeros)
      const energyByStatus = buildTooltipStatusData(filteredEnergy);
      const waterByStatus = buildTooltipStatusData(filteredWater);
      const tempByStatus = buildTooltipStatusData(filteredTemp);

      // Get temperature limits from MyIOUtils (populated from customer attributes)
      const minTemp = Number(window.MyIOUtils?.temperatureLimits?.minTemperature ?? 18);
      const maxTemp = Number(window.MyIOUtils?.temperatureLimits?.maxTemperature ?? 26);

      const tempDevicesForTooltip = filteredTemp.map((d) => {
        const temp = Number(d.temperature || 0);
        let status = 'unknown';
        if (temp > 0) {
          status = temp >= minTemp && temp <= maxTemp ? 'ok' : 'warn';
        }
        return {
          name: d.labelOrName || d.name || d.label || 'Sensor',
          temp: temp,
          status: status,
        };
      });

      const filteredEnergyEquipmentsTotal = filteredClassified.energy.equipments.reduce(
        (sum, d) => sum + Number(d.value || d.consumption || 0),
        0
      );
      const filteredEnergyStoresTotal = filteredClassified.energy.stores.reduce(
        (sum, d) => sum + Number(d.value || d.consumption || 0),
        0
      );

      // Dispatch filtered summary events for Header component (include tooltip fields)
      window.dispatchEvent(
        new CustomEvent('myio:energy-summary-ready', {
          detail: {
            customerTotal: filteredEnergyTotal,
            unfilteredTotal: unfilteredEnergyTotal,
            isFiltered: isFiltered,
            equipmentsTotal: filteredEnergyEquipmentsTotal,
            lojasTotal: filteredEnergyStoresTotal,
            totalDevices: filteredEnergy.length,
            totalConsumption: filteredEnergyTotal,
            byStatus: energyByStatus,
            byCategory: buildEnergyCategoryData(filteredClassified),
            byShoppingTotal: buildEnergyCategoryDataByShopping(filteredClassified),
            shoppingsEnergy: buildCustomersEnergyBreakdown(filteredClassified),
            entityLabel: settings.goalsEntityLabel || 'Shopping',
            lastUpdated: new Date().toISOString(),
          },
        })
      );

      window.dispatchEvent(
        new CustomEvent('myio:water-summary-ready', {
          detail: {
            filteredTotal: filteredWaterTotal,
            unfilteredTotal: unfilteredWaterTotal,
            isFiltered: isFiltered,
            totalDevices: filteredWater.length,
            totalConsumption: filteredWaterTotal,
            byStatus: waterByStatus,
            byCategory: buildWaterCategoryData(filteredClassified),
            byShoppingTotal: buildWaterCategoryDataByShopping(filteredClassified),
            shoppingsWater: buildCustomersWaterBreakdown(filteredClassified),
            entityLabel: settings.goalsEntityLabel || 'Shopping',
            lastUpdated: new Date().toISOString(),
          },
        })
      );

      // Calculate shoppings temperature status for filtered data
      const filteredTempShoppingsStatus = buildCustomersTemperatureStatus(
        filteredClassified,
        minTemp,
        maxTemp
      );

      window.dispatchEvent(
        new CustomEvent('myio:temperature-data-ready', {
          detail: {
            globalAvg: tempAvg,
            isFiltered: isFiltered,
            shoppingsInRange: filteredTempShoppingsStatus.shoppingsInRange,
            shoppingsOutOfRange: filteredTempShoppingsStatus.shoppingsOutOfRange,
            totalDevices: filteredTemp.length,
            devices: tempDevicesForTooltip,
            temperatureMin: minTemp,
            temperatureMax: maxTemp,
            byStatus: tempByStatus,
            lastUpdated: new Date().toISOString(),
          },
        })
      );

      const equipmentOnlyClassified = {
        energy: { equipments: filteredClassified.energy.equipments, stores: [], entrada: [] },
      };
      const equipmentByStatus = buildTooltipStatusData(filteredClassified.energy.equipments);

      const allEquipments = classified.energy?.equipments || [];
      const filteredEquipmentsList = filterDevices(allEquipments);
      const onlineEquipments = filteredEquipmentsList.filter((device) => {
        const status = (device.deviceStatus || '').toLowerCase();
        return !['offline', 'no_info', 'not_installed'].includes(status);
      }).length;

      window.dispatchEvent(
        new CustomEvent('myio:equipment-count-updated', {
          detail: {
            totalEquipments: allEquipments.length,
            filteredEquipments: onlineEquipments,
            allShoppingsSelected: !isFiltered,
            byStatus: equipmentByStatus,
            byCategory: buildEnergyCategoryData(equipmentOnlyClassified),
          },
        })
      );

      LogHelper.log('[MAIN_UNIQUE] Filter applied - Updated header with filtered stats');
    }

    // 3. Update Welcome modal cards if visible
    if (welcomeModal && classified) {
      const updatedCards = updateCustomerCardsWithRealCounts(classified);
      updateWelcomeModalCustomersCards(welcomeModal, updatedCards);
    }
  });

  // === 7. RFC-0115: RENDER FOOTER COMPONENT ===
  const footerContainer = document.getElementById('footerContainer');
  let footerInstance = null;

  if (footerContainer && MyIOLibrary.createFooterComponent) {
    // chartsBaseUrl was captured at the top of onInit and exposed on
    // window.MyIOUtils — read from there so future setting changes flow
    // through without editing this call site. If unset, surface a toast
    // so the operator sees the misconfiguration explicitly.
    const footerChartsBaseUrl = window.MyIOUtils?.chartsBaseUrl;
    if (!footerChartsBaseUrl) {
      const msg =
        '[MAIN_UNIQUE] chartsBaseUrl não configurado. Defina em widget settings → "Charts SDK Base URL".';
      LogHelper.error(msg);
      if (MyIOLibrary?.MyIOToast?.error) MyIOLibrary.MyIOToast.error(msg, 8000);
    }

    footerInstance = MyIOLibrary.createFooterComponent({
      container: footerContainer,
      ctx: self.ctx,
      themeMode: currentThemeMode,
      theme: currentThemeMode,
      maxSelections: 6,
      getDateRange: () => ({
        start: self.ctx.$scope.startDateISO,
        end: self.ctx.$scope.endDateISO,
      }),
      // Issue 5 fix: Add required params for comparison modal
      dataApiHost: DATA_API_HOST,
      chartsBaseUrl: footerChartsBaseUrl,
      getIngestionToken: async () => {
        const myIOAuth = window.MyIOUtils?.myIOAuth;
        if (myIOAuth && typeof myIOAuth.getToken === 'function') {
          return await myIOAuth.getToken();
        }
        return null;
      },
      onCompareClick: (entities, unitType) => {
        LogHelper.log('[MAIN_UNIQUE] Compare clicked:', entities.length, unitType);
      },
      onSelectionChange: (entities) => {
        LogHelper.log('[MAIN_UNIQUE] Selection changed:', entities.length);
      },
    });
  }

  // === 8. INITIALIZE ORCHESTRATOR ===
  await initializeOrchestrator();

  // === 9. LISTEN FOR DATA READY EVENT (additional handlers) ===
  // NOTE: Shoppings are handled by module-level handlers (lines ~100-130)
  // This handler updates components that use local variables
  window.addEventListener('myio:data-ready', (e) => {
    const { deviceCounts, apiEnriched } = e.detail;

    // Update header KPIs (header listens to event automatically)
    if (headerInstance && deviceCounts) {
      LogHelper.log('[MAIN_UNIQUE] Header will update via event listeners');
    }

    // Update telemetry grid devices for current domain/context
    if (telemetryGridInstance) {
      const devices =
        window.MyIOOrchestrator?.getDevices?.(currentTelemetryDomain, currentTelemetryContext) || [];
      telemetryGridInstance.updateDevices(devices);
      // Only hide spinner after API enrichment (/totals) completes.
      // The first myio:data-ready fires right after TB classification (no consumption data yet).
      // apiEnriched=true is set only after enrichDevicesWithConsumption() returns.
      if (devices.length > 0 && apiEnriched) {
        hideMenuBusy();
      }
    }

    // RFC-0132/0133: Refresh open Energy/Water panels with the freshly classified
    // summary. Panels capture initialSummary at creation; this keeps them current
    // when data-ready re-fires (e.g. after API enrichment or a filter change).
    if (energyPanelInstance) {
      const es = window.MyIOOrchestrator?.getEnergySummary?.();
      if (es) energyPanelInstance.updateSummary(es);
      // Entrada REAL (medidores canônicos) pode ter mudado de período — recalcula async
      window.MyIOUtils?.refreshRealEntradaSummary?.();
    }
    if (waterPanelInstance) {
      const ws = window.MyIOOrchestrator?.getWaterSummary?.();
      if (ws) waterPanelInstance.updateSummary(ws);
    }
    // RFC-0117: Temperature panel is DOM-based — re-render in place when open.
    if (currentViewMode === 'temperature-panel') {
      const tc = document.getElementById('telemetryGridContainer');
      if (tc) switchToTemperaturePanel(tc);
    }
  });

  // === 10. LISTEN FOR PANEL MODAL REQUESTS ===
  window.addEventListener('myio:panel-modal-request', (e) => {
    const { domain, panelType } = e.detail;
    handlePanelModalRequest(domain, panelType);
  });

  // === 11. LISTEN FOR GLOBAL THEME CHANGES (from Menu or Welcome) ===
  // RFC-0120: Centralized theme change handler
  window.addEventListener('myio:theme-change', (e) => {
    const themeMode = e.detail?.themeMode;
    if (!themeMode) return;

    LogHelper.log('Global theme change received:', themeMode);
    currentThemeMode = themeMode;

    // RFC-0120: Sync to MyIOUtils for child widgets (TELEMETRY, etc.)
    if (window.MyIOUtils) {
      window.MyIOUtils.currentThemeMode = themeMode;
    }

    // Apply to main wrapper with background
    const wrap = document.getElementById('mainUniqueWrap');
    if (wrap) {
      wrap.setAttribute('data-theme', themeMode);
    }

    // RFC-0121: Apply background to entire page
    applyBackgroundToPage(themeMode);

    // Update all components with new theme
    if (headerInstance) headerInstance.setThemeMode?.(themeMode);
    if (menuInstance) menuInstance.setThemeMode?.(themeMode);
    if (footerInstance) footerInstance.setThemeMode?.(themeMode);
    if (welcomeModal) welcomeModal.setThemeMode?.(themeMode);
    if (telemetryGridInstance) telemetryGridInstance.setThemeMode?.(themeMode);
    // RFC-0132/RFC-0133: Update panel themes
    if (energyPanelInstance) energyPanelInstance.setTheme?.(themeMode);
    if (waterPanelInstance) waterPanelInstance.setTheme?.(themeMode);
    // RFC-0117: Temperature panel is DOM-based — re-render in new theme.
    if (currentViewMode === 'temperature-panel') {
      const tc = document.getElementById('telemetryGridContainer');
      if (tc) switchToTemperaturePanel(tc);
    }
    // RFC-0152: Update operational component themes
    if (operationalDashboardInstance) operationalDashboardInstance.setThemeMode?.(themeMode);
    if (alarmsNotificationsPanelInstance) alarmsNotificationsPanelInstance.setThemeMode?.(themeMode);
    if (operationalGridInstance) operationalGridInstance.setThemeMode?.(themeMode);
  });

  // === RFC-0152: LISTEN FOR MENU NAVIGATION TO OPERATIONAL PANELS ===
  window.addEventListener('myio:switch-main-state', (e) => {
    // MenuController sends targetStateId, not stateId
    const stateId = e.detail?.targetStateId || e.detail?.stateId || '';
    LogHelper.log('[MAIN_UNIQUE] RFC-0152: switch-main-state received:', stateId);

    clearSelectionStore();

    const telemetryContainer = document.getElementById('telemetryGridContainer');
    if (!telemetryContainer) {
      LogHelper.warn('[MAIN_UNIQUE] RFC-0152: telemetryGridContainer not found');
      return;
    }

    if (stateId === 'operational_dashboard') {
      renderOperationalDashboard(telemetryContainer);
    } else if (stateId === 'operational_general_list') {
      renderOperationalGeneralList(telemetryContainer);
    } else if (stateId === 'operational_alarms') {
      renderAlarmsNotificationsPanel(telemetryContainer);
    }
  });

  // === 12. Issue 6 fix: LISTEN FOR CARD ACTIONS (dashboard/report/settings) ===
  window.addEventListener('myio:telemetry-card-action', async (e) => {
    const { action, device, domain } = e.detail || {};
    if (!action || !device) return;

    LogHelper.log(`[MAIN_UNIQUE] Card action: ${action} for device ${device.entityId}, domain: ${domain}`);

    const myIOAuth = window.MyIOUtils?.myIOAuth;
    const tbToken = localStorage.getItem('jwt_token');

    try {
      switch (action) {
        case 'dashboard': {
          // RFC-0189: When the temperature API gate is on, temperature cards open the dedicated
          // temperature modal fed by the ingestion API. Gate off (default) keeps the legacy
          // openDashboardPopupEnergy path below untouched.
          const effectiveDomain = domain || currentTelemetryDomain;
          if (
            effectiveDomain === DOMAIN_TEMPERATURE &&
            window.MyIOUtils?.enableTemperatureApiDataFetch &&
            device.ingestionId &&
            typeof MyIOLibrary.openTemperatureModal === 'function'
          ) {
            try {
              if (!tbToken) {
                throw new Error('JWT token nao encontrado');
              }

              const creds = window.MyIOUtils?.getCredentials?.();
              if (!creds?.clientId || !creds?.clientSecret) {
                throw new Error('Missing credentials for ingestion API');
              }

              const ingestionId = device.ingestionId;
              const dataApiHost = creds.dataApiHost; // includes /api/v1
              const tempAuth = MyIOLibrary.buildMyioIngestionAuth({
                dataApiHost: dataApiHost,
                clientId: creds.clientId,
                clientSecret: creds.clientSecret,
              });

              const ingestionDataFetcher = async (fetchStartTs, fetchEndTs) => {
                const ingestionToken = await tempAuth.getToken();
                const url = new URL(`${dataApiHost}/telemetry/devices/${ingestionId}/temperature`);
                url.searchParams.set('startTime', new Date(fetchStartTs).toISOString());
                url.searchParams.set('endTime', new Date(fetchEndTs).toISOString());
                url.searchParams.set('granularity', '1h');
                url.searchParams.set('deep', '0');

                const res = await fetch(url.toString(), {
                  headers: { Authorization: `Bearer ${ingestionToken}` },
                });
                if (!res.ok) throw new Error(`Ingestion API error: ${res.status}`);

                const json = await res.json();
                const rows = Array.isArray(json) ? json : [];
                const row = rows.find((r) => r.id === ingestionId) || rows[0] || null;
                if (!row || !Array.isArray(row.consumption)) return [];

                // Transform to TemperatureTelemetry[] format: { ts: number, value: number }
                return row.consumption
                  .filter((e) => e && e.timestamp !== undefined && e.value !== undefined)
                  .map((e) => ({ ts: new Date(e.timestamp).getTime(), value: Number(e.value) }));
              };

              // Temperature range/status — priority: device attributes > global customer
              // limits (window.MyIOUtils.temperatureLimits), mirroring production TELEMETRY v5
              const tempMinRange =
                device.temperatureMin ??
                device.minTemperature ??
                window.MyIOUtils?.temperatureLimits?.minTemperature ??
                null;
              const tempMaxRange =
                device.temperatureMax ??
                device.maxTemperature ??
                window.MyIOUtils?.temperatureLimits?.maxTemperature ??
                null;
              const tempStatus = device.temperatureStatus || null;

              // Customer-level clamp range if configured, else library default (production parity)
              const customerClampRange = window.MyIOUtils?.temperatureClampRange;
              const clampRange =
                customerClampRange?.min !== undefined && customerClampRange?.max !== undefined
                  ? { min: customerClampRange.min, max: customerClampRange.max }
                  : undefined;

              LogHelper.log(
                `[MAIN_UNIQUE] RFC-0189: opening temperature modal via ingestion API (ingestionId: ${ingestionId})`,
                { tempMinRange, tempMaxRange, tempStatus, clampRange }
              );

              MyIOLibrary.openTemperatureModal({
                token: tbToken,
                deviceId: device.entityId,
                startDate:
                  self.ctx.$scope.startDateISO || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                endDate: self.ctx.$scope.endDateISO || new Date().toISOString(),
                label: device.labelOrName || device.label || 'Sensor de Temperatura',
                currentTemperature: Number(device.temperature ?? 0),
                temperatureMin: tempMinRange,
                temperatureMax: tempMaxRange,
                temperatureStatus: tempStatus,
                theme: currentThemeMode,
                locale: 'pt-BR',
                granularity: 'hour',
                ...(clampRange ? { clampRange } : {}),
                dataFetcher: ingestionDataFetcher,
                onClose: () => {
                  LogHelper.log('[MAIN_UNIQUE] Temperature modal closed');
                },
              });
              break; // handled — skip legacy popup
            } catch (tempErr) {
              LogHelper.warn(
                '[MAIN_UNIQUE] RFC-0189: temperature modal via ingestion API failed, falling back to legacy popup:',
                tempErr.message
              );
              // Fall through to legacy openDashboardPopupEnergy path below
            }
          }

          if (!myIOAuth || typeof myIOAuth.getToken !== 'function') {
            LogHelper.error('[MAIN_UNIQUE] myIOAuth not available');
            window.alert('Autenticacao nao disponivel. Recarregue a pagina.');
            return;
          }

          const ingestionToken = await myIOAuth.getToken();
          if (!tbToken) {
            throw new Error('JWT token nao encontrado');
          }

          MyIOLibrary.openDashboardPopupEnergy({
            deviceId: device.entityId,
            readingType: domain || currentTelemetryDomain,
            startDate: self.ctx.$scope.startDateISO,
            endDate: self.ctx.$scope.endDateISO,
            tbJwtToken: tbToken,
            ingestionToken: ingestionToken,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
          });
          break;
        }

        case 'report': {
          if (!myIOAuth || typeof myIOAuth.getToken !== 'function') {
            LogHelper.error('[MAIN_UNIQUE] myIOAuth not available for report');
            window.alert('Autenticacao nao disponivel.');
            return;
          }

          const ingestionToken = await myIOAuth.getToken();
          if (!ingestionToken) throw new Error('No ingestion token');

          await MyIOLibrary.openDashboardPopupReport({
            ingestionId: device.ingestionId,
            identifier: device.deviceIdentifier,
            label: device.labelOrName,
            domain: domain || currentTelemetryDomain,
            api: {
              dataApiBaseUrl: DATA_API_HOST,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              ingestionToken,
            },
          });
          break;
        }

        case 'settings': {
          if (!tbToken) {
            LogHelper.error('[MAIN_UNIQUE] JWT token not found');
            window.alert('Token nao encontrado');
            return;
          }

          await MyIOLibrary.openDashboardPopupSettings({
            deviceId: device.entityId,
            label: device.labelOrName,
            jwtToken: tbToken,
            domain: domain || currentTelemetryDomain,
            deviceType: device.deviceType,
            deviceProfile: device.deviceProfile,
            customerName: device.customerName,
            customerId: device.customerId, // RFC-0080: Required for GLOBAL mapInstantaneousPower fetch
            // RFC-0171: Pass userEmail for superadmin check (allows editing identifier field)
            userEmail: window.MyIOUtils?.currentUserEmail || null,
            connectionData: {
              centralName: device.centralName || device.customerName,
              connectionStatusTime: device.lastConnectTime,
              timeVal: device.lastActivityTime || new Date('1970-01-01').getTime(),
              deviceStatus: ['power_off', 'not_installed'].includes(device.deviceStatus)
                ? 'power_off'
                : 'power_on',
              lastDisconnectTime: device.lastDisconnectTime || 0,
            },
            ui: { title: 'Configuracoes', width: 900 },
            mapInstantaneousPower: device.mapInstantaneousPower,
            onSaved: (payload) => {
              LogHelper.log('[MAIN_UNIQUE] Settings saved:', payload);

              // Show success toast
              if (typeof MyIOLibrary.showToast === 'function') {
                MyIOLibrary.showToast({
                  message: 'Configuracoes salvas com sucesso!',
                  type: 'success',
                  duration: 3000,
                });
              }

              // Update device label in cache if changed
              if (payload.entity?.ok && payload.entity?.updated?.includes('label')) {
                const newLabel = payload.entity?.label || payload.entity?.updatedLabel;
                if (newLabel && device.labelOrName !== newLabel) {
                  LogHelper.log('[MAIN_UNIQUE] Updating device label in cache:', newLabel);
                  device.labelOrName = newLabel;
                  // Trigger refresh to update displayed label
                  window.dispatchEvent(new CustomEvent('myio:request-reload'));
                }
              }
            },
          });
          break;
        }

        default:
          LogHelper.warn(`[MAIN_UNIQUE] Unknown card action: ${action}`);
      }
    } catch (err) {
      LogHelper.error(`[MAIN_UNIQUE] Error handling card action ${action}:`, err);
      window.alert(`Erro ao executar acao: ${err?.message || err}`);
    }
  });

  // === 13. Issue 7 fix: LISTEN FOR DATE UPDATE / RELOAD REQUESTS ===
  window.addEventListener('myio:update-date', async (e) => {
    const { startISO, endISO, startDate, endDate } = e.detail || {};
    const start = startISO || startDate;
    const end = endISO || endDate;

    LogHelper.log('[MAIN_UNIQUE] Date update requested:', { start, end });

    if (start) self.ctx.$scope.startDateISO = start;
    if (end) self.ctx.$scope.endDateISO = end;

    // Re-enrich data with new date range
    await reloadDataWithNewDateRange();
  });

  window.addEventListener('myio:request-reload', async () => {
    LogHelper.log('[MAIN_UNIQUE] Reload requested');
    await reloadDataWithNewDateRange();
  });

  let _isReloading = false;

  async function reloadDataWithNewDateRange() {
    // Guard: prevent concurrent reload calls (e.g. myio:update-date + myio:request-reload firing together)
    if (_isReloading) {
      LogHelper.log('[MAIN_UNIQUE] Reload already in progress, skipping duplicate call');
      return;
    }

    const classified = window.MyIOOrchestratorData?.classified;
    if (!classified) {
      LogHelper.warn('[MAIN_UNIQUE] No classified data to reload');
      return;
    }

    _isReloading = true;
    showMenuBusy('reload', 'Atualizando dados...');

    try {
      LogHelper.log('[MAIN_UNIQUE] Re-enriching data with current date range...');

      // Re-enrich devices with new date range
      const enriched = await enrichDevicesWithConsumption(classified);

      // Update cache
      const energyItems = [
        ...enriched.energy.equipments,
        ...enriched.energy.stores,
        ...enriched.energy.entrada,
      ];
      const waterItems = [
        ...enriched.water.hidrometro_entrada,
        ...enriched.water.banheiros,
        ...enriched.water.hidrometro_area_comum,
        ...enriched.water.hidrometro,
      ];
      const temperatureItems = [
        ...enriched.temperature.termostato,
        ...enriched.temperature.termostato_external,
      ];

      window.MyIOOrchestratorData.classified = enriched;
      window.MyIOOrchestratorData.energy = { items: energyItems, timestamp: Date.now() };
      window.MyIOOrchestratorData.water = { items: waterItems, timestamp: Date.now() };
      window.MyIOOrchestratorData.temperature = { items: temperatureItems, timestamp: Date.now() };

      // Update telemetry grid
      if (telemetryGridInstance) {
        const devices =
          window.MyIOOrchestrator?.getDevices?.(currentTelemetryDomain, currentTelemetryContext) || [];
        telemetryGridInstance.updateDevices(devices);
      }

      // Dispatch updated events for header
      const energyTotal = energyItems.reduce((sum, d) => sum + Number(d.value || d.consumption || 0), 0);
      const waterTotal = waterItems.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0);
      const tempValues = temperatureItems.map((d) => Number(d.temperature || 0)).filter((v) => v > 0);
      const tempAvg =
        tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : null;

      window.dispatchEvent(
        new CustomEvent('myio:energy-summary-ready', {
          detail: {
            customerTotal: energyTotal,
            totalDevices: energyItems.length,
            totalConsumption: energyTotal,
            byStatus: buildTooltipStatusData(energyItems),
            lastUpdated: new Date().toISOString(),
          },
        })
      );

      window.dispatchEvent(
        new CustomEvent('myio:water-summary-ready', {
          detail: {
            filteredTotal: waterTotal,
            totalDevices: waterItems.length,
            totalConsumption: waterTotal,
            byStatus: buildTooltipStatusData(waterItems),
            byCategory: buildWaterCategoryData(enriched),
            byShoppingTotal: buildWaterCategoryDataByShopping(enriched),
            lastUpdated: new Date().toISOString(),
          },
        })
      );

      window.dispatchEvent(
        new CustomEvent('myio:temperature-data-ready', {
          detail: {
            globalAvg: tempAvg,
            totalDevices: temperatureItems.length,
            lastUpdated: new Date().toISOString(),
          },
        })
      );

      LogHelper.log('[MAIN_UNIQUE] Data reload complete');
      hideMenuBusy();
      MyIOLibrary.MyIOToast?.success?.('Dados atualizados com sucesso');
    } catch (err) {
      LogHelper.error('[MAIN_UNIQUE] Error reloading data:', err);
      hideMenuBusy({ immediate: true });
      MyIOLibrary.MyIOToast?.error?.('Erro ao atualizar dados');
    } finally {
      _isReloading = false;
    }
  }

  // === 14. Issue 1 fix: LISTEN FOR GOALS PANEL REQUESTS ===
  // Head office (UNIQUE): metas pertencem a cada shopping filho — cada um com seu próprio
  // gcdrCustomerId/gcdrApiKey no SERVER_SCOPE. O clique abre um seletor de shopping e o
  // GoalsPanel é aberto com as credenciais GCDR do shopping escolhido.

  // ── Paleta do painel de Metas ──────────────────────────────────────────────
  // Propaga as cores do dashboard (settingsSchema: Menu Tab Colors / Header Card
  // Colors / tema) para o painel Metas × Consumo, GoalsPanel e pickers — mantém a
  // identidade visual do head office (ex.: verde Sá Cavalcante) em vez do roxo
  // fixo MyIO. Fallbacks preservam o visual atual quando nada está configurado.
  const goalsPalette = () => {
    const mode =
      (window.MyIOUtils?.currentThemeMode || currentThemeMode) === 'dark' ? 'darkMode' : 'lightMode';
    const themeCfg = settings?.[mode] || {};
    const accent = settings?.tabSelecionadoBackgroundColor || themeCfg.primaryColor || '#6a1b9a';
    const accentDark = settings?.cardEnergiaBackgroundColor || themeCfg.secondaryColor || '#4a148c';
    const accentText = settings?.tabSelecionadoFontColor || '#ffffff';
    // Tons translúcidos/claros p/ bordas, hovers e chips (color-mix: Chrome 111+)
    const tint = (pct) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`;
    const lighten = (pct) => `color-mix(in srgb, ${accent} ${100 - pct}%, #fff)`;
    // Tons SÓLIDOS derivados do accent (hex, p/ séries de gráfico — canvas não
    // aceita color-mix): alterna clareamentos e escurecimentos progressivos.
    // Mantém a identidade monocromática da paleta do dashboard em séries múltiplas.
    const mixHex = (hexA, hexB, pctB) => {
      const n = (h) => parseInt(h.slice(1), 16);
      const a = n(hexA);
      const b = n(hexB);
      const ch = (sa, sb) => Math.round(sa + (sb - sa) * pctB);
      const r = ch((a >> 16) & 255, (b >> 16) & 255);
      const g = ch((a >> 8) & 255, (b >> 8) & 255);
      const bl = ch(a & 255, b & 255);
      return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
    };
    const tones = (count) => {
      if (!/^#[0-9a-f]{6}$/i.test(accent)) return null; // accent fora do padrão hex → paleta default
      return Array.from({ length: count }, (_, i) => {
        if (i === 0) return accent;
        const step = Math.ceil(i / 2);
        const pct = Math.min(0.72, 0.08 + 0.21 * step);
        return i % 2 === 1 ? mixHex(accent, '#ffffff', pct) : mixHex(accent, '#0f172a', pct);
      });
    };
    return { accent, accentDark, accentText, tint, lighten, tones };
  };

  const _goalsToastError = (msg) => {
    if (MyIOLibrary?.MyIOToast?.error) MyIOLibrary.MyIOToast.error(msg);
    else window.alert(msg);
  };

  // Abre o GoalsPanel para um customer TB específico (shopping filho ou, em fallback,
  // o próprio customer do dashboard). Busca os attrs SERVER_SCOPE na hora — a chave
  // GCDR é per-customer, não pode reutilizar a do head office.
  const openGoalsForCustomer = async (customerTbId, customerTitle) => {
    const attrs = await fetchCustomerServerScopeAttrs(customerTbId).catch(() => ({}));

    // openGoalsPanel chama GET/PUT /customers/:id/goals no GCDR — o :id é o UUID do
    // customer NO GCDR (attr SERVER_SCOPE gcdrCustomerId), não o UUID do ThingsBoard.
    const gcdrCustomerId = attrs?.gcdrCustomerId || '';
    if (!gcdrCustomerId) {
      LogHelper.error('[MAIN_UNIQUE] gcdrCustomerId missing for', customerTitle, customerTbId);
      _goalsToastError(
        `"${customerTitle}" não está vinculado ao GCDR: defina o atributo gcdrCustomerId no customer (SERVER_SCOPE) — o GCDR Sync faz esse vínculo.`
      );
      return;
    }

    // Metas vêm do GCDR (RFC-0046): auth via X-API-Key + base URL das settings
    // (GCDR_API_BASE lido no onInit a partir de settings.gcdrApiBaseUrl).
    const gcdrBaseUrl =
      GCDR_API_BASE ||
      window.MyIOOrchestrator?.gcdrApiBaseUrl ||
      window.GCDR_API_HOST ||
      window.DATA_API_HOST;
    // X-API-Key: overrides manuais (dev) primeiro; depois a chave DO SHOPPING (SERVER_SCOPE
    // gcdrApiKey — a chave é per-customer); por fim os fallbacks do widget/head office.
    const gcdrApiKey =
      window.GCDR_CUSTOMER_API_KEY ||
      localStorage.getItem('gcdr_customer_api_key') ||
      attrs?.gcdrApiKey ||
      GCDR_API_KEY ||
      window.MyIOOrchestrator?.gcdrApiKey ||
      settings.gcdrApiKey ||
      '';
    if (!gcdrBaseUrl || !gcdrApiKey) {
      LogHelper.error('[MAIN_UNIQUE] GCDR credentials missing for', customerTitle, customerTbId);
      _goalsToastError(
        `Configuração do GCDR ausente para "${customerTitle}": defina o atributo gcdrApiKey no customer (SERVER_SCOPE) ou o setting "GCDR API Key" do widget.`
      );
      return;
    }

    LogHelper.log('[MAIN_UNIQUE] Opening Goals Panel (GCDR):', { customerTitle, gcdrCustomerId });

    MyIOLibrary.openGoalsPanel({
      customerId: gcdrCustomerId,
      apiKey: gcdrApiKey,
      baseUrl: gcdrBaseUrl,
      domain: 'ENERGY',
      locale: 'pt-BR',
      onSaved: async (writeResult) => {
        LogHelper.log('[MAIN_UNIQUE] Goals saved (GCDR):', writeResult?.version);
        window.dispatchEvent(
          new CustomEvent('myio:goals-updated', {
            detail: { writeResult, customerId: gcdrCustomerId, timestamp: Date.now() },
          })
        );
      },
      onClose: () => {
        LogHelper.log('[MAIN_UNIQUE] Goals Panel closed');
      },
      styles: {
        primaryColor: goalsPalette().accent,
        errorColor: '#dc3545',
        borderRadius: '8px',
        zIndex: 10000,
      },
    });
  };

  // Seletor de shopping: overlay leve no padrão dos modais premium (Nunito, accent roxo).
  // Resolve com { tbId, title } ou null (Esc / backdrop / ✕).
  const pickGoalsCustomer = (shoppings) =>
    new Promise((resolve) => {
      const prev = document.getElementById('myio-goals-shopping-picker');
      if (prev) prev.remove();

      const overlay = document.createElement('div');
      overlay.id = 'myio-goals-shopping-picker';
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;font-family:Nunito,sans-serif;';

      const items = shoppings
        .map(
          (s, i) =>
            `<button type="button" data-idx="${i}" style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font:600 14px Nunito,sans-serif;color:#1e293b;text-align:left;">🏢 <span>${String(s.title || _entS()).replace(/</g, '&lt;')}</span></button>`
        )
        .join('');

      overlay.innerHTML = `
        <div role="dialog" aria-label="Selecionar ${_escHtml(_entSLow())}" style="background:#fff;border-radius:12px;max-width:420px;width:calc(100% - 32px);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:${goalsPalette().accent};color:${goalsPalette().accentText};">
            <strong style="font:700 15px Nunito,sans-serif;">🎯 Metas — selecione: ${_escHtml(_entS())}</strong>
            <button type="button" data-close="1" aria-label="Fechar" style="border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer;line-height:1;">✕</button>
          </div>
          <div style="padding:16px 18px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;">${items}</div>
        </div>`;

      const done = (result) => {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') done(null);
      };
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-close]')) return done(null);
        const btn = e.target.closest('[data-idx]');
        if (btn) done(shoppings[Number(btn.dataset.idx)]);
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);
    });

  // ── Metas × Consumo (head office): painel único comparando todos os shoppings ──
  // Fiel ao fluxo do v-5.2.0 (MENU → Metas → GoalsModal), mas multi-customer: metas
  // mensais do GCDR (per-shopping gcdrApiKey) × consumo do endpoint agregado do Data
  // API (/telemetry/customers/{ingestionId}/{domain}/ — mesma fonte do GoalsModal).

  const _gcdrV1 = (base) => {
    const b = String(base || '').replace(/\/+$/, '');
    return /\/api\/v1$/.test(b) ? b : `${b}/api/v1`;
  };

  const _shoppingAttrsCache = new Map(); // customerTbId -> attrs SERVER_SCOPE
  const getCustomerAttrs = async (tbId) => {
    if (!_shoppingAttrsCache.has(tbId)) {
      _shoppingAttrsCache.set(tbId, await fetchCustomerServerScopeAttrs(tbId).catch(() => ({})));
    }
    return _shoppingAttrsCache.get(tbId);
  };

  const _escHtml = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const _fmtNum = (n) =>
    n == null || Number.isNaN(Number(n))
      ? '—'
      : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  // Energia: >= 1.000 kWh exibe em MWh (>= 1.000.000 em GWh). Demais unidades (m³) passam direto.
  const _fmtQtyStr = (v, unit) => {
    const n = Number(v);
    if (v == null || Number.isNaN(n)) return '—';
    if (unit === 'kWh') {
      if (Math.abs(n) >= 1e6) return `${_fmtNum(n / 1e6)} GWh`;
      if (Math.abs(n) >= 1000) return `${_fmtNum(n / 1000)} MWh`;
    }
    return `${_fmtNum(n)} ${unit}`;
  };

  // Metas do shopping no GCDR — devolve o `data` COMPLETO do GET /goals:
  //   { tree, version, granularity, devices[], hoursCovered, coverageGaps, ... }
  // (Addendum A 2026-07: granularity 'CUSTOMER'|'DEVICE', devices[] por medidor de
  // entrada e coverageGaps quando a cobertura < 100% — parsing tolerante, anos
  // CUSTOMER legados seguem idênticos). Chaves da tree por granularidade (mesmo
  // formato que o GoalsModal v-5.2.0 lê): month → tree.monthly["01".."12"];
  // day → tree.daily["MM-DD"]; hour → tree.hourly["MM-DDThh"].
  // `deviceId` (opcional) estreita a tree para UM medidor de um ano DEVICE (?deviceId=).
  // Cache por (customer, domínio, ano, gran, deviceId) e guarda a PROMISE (não o
  // resultado): chamadores concorrentes — gráfico e sidebar carregam em paralelo —
  // compartilham o mesmo fetch em voo em vez de disparar requests GCDR duplicados.
  const _goalsTreeCache = new Map();
  const fetchCustomerGoalsTree = (attrs, gcdrDomain, year, gran = 'month', deviceId = null) => {
    const gcdrCustomerId = attrs?.gcdrCustomerId || '';
    const apiKey = attrs?.gcdrApiKey || GCDR_API_KEY || settings.gcdrApiKey || '';
    if (!gcdrCustomerId || !apiKey) return Promise.resolve(null);
    const cacheKey = `${gcdrCustomerId}|${gcdrDomain}|${year}|${gran}|${deviceId || ''}`;
    if (_goalsTreeCache.has(cacheKey)) return _goalsTreeCache.get(cacheKey);
    const promise = (async () => {
      const base = _gcdrV1(GCDR_API_BASE || window.MyIOOrchestrator?.gcdrApiBaseUrl || '');
      const res = await fetch(
        `${base}/customers/${encodeURIComponent(gcdrCustomerId)}/goals?domain=${gcdrDomain}&year=${year}&granularity=${gran}` +
          (deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ''),
        { headers: { 'X-API-Key': apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) }
      );
      // !ok (ex.: 404 sem meta) fica cacheado como null — mesmo comportamento anterior.
      if (!res.ok) return null;
      const json = await res.json();
      return json?.data?.tree ? json.data : null;
    })().catch((err) => {
      // Falha transitória (timeout/rede) NÃO pode ficar cacheada — remove para
      // permitir retry na próxima abertura; resolve null p/ não quebrar chamadores.
      _goalsTreeCache.delete(cacheKey);
      LogHelper?.warn?.('[MAIN_UNIQUE] fetchCustomerGoalsTree falhou:', err);
      return null;
    });
    _goalsTreeCache.set(cacheKey, promise);
    return promise;
  };

  // ── Coverage gaps (Addendum A) → texto pt-BR do warning ⚠ ──────────────────
  // Refs compactos do GET: mês "YYYY-MM" → "Fev"; dia "YYYY-MM-DD" → "15 Abr";
  // hora "YYYY-MM-DDThh" → "15 Abr 08h". `truncated` vira reticências.
  const GOALS_MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const _gapRefPt = (ref) => {
    const s = String(ref || '');
    let m = /^(\d{4})-(\d{2})$/.exec(s);
    if (m) return GOALS_MONTHS_PT[Number(m[2]) - 1] || s;
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return `${Number(m[3])} ${GOALS_MONTHS_PT[Number(m[2]) - 1] || m[2]}`;
    m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(s);
    if (m) return `${Number(m[3])} ${GOALS_MONTHS_PT[Number(m[2]) - 1] || m[2]} ${m[4]}h`;
    return s;
  };
  const _gapsTextPt = (gaps) => {
    const refs = (gaps?.missing || []).map(_gapRefPt);
    const hours = Number(gaps?.missingHours) || 0;
    const list = refs.join(', ') + (gaps?.truncated ? '…' : '');
    const hoursTxt = hours > 0 ? ` (~${hours.toLocaleString('pt-BR')}h)` : '';
    const missTxt = list ? ` Faltam: ${list}${hoursTxt}` : hoursTxt ? ` Faltam${hoursTxt}` : '';
    return `A meta GERAL deste domínio/ano não cobre 100% dos dias e horas.${missTxt}`;
  };
  const _hasGaps = (g) => !!(g && ((g.missing && g.missing.length) || Number(g.missingHours) > 0));

  // Consumo de TODOS os shoppings numa ÚNICA chamada: /devices/totals do customer
  // head-office (deep=1), agrupado pelo customerId (ingestion) que a própria API devolve
  // por device. Muito mais rápido que 1 chamada por shopping (~17s vs 2min+ cada) e
  // inclui medidores fora do datasource TB (ex.: trafos de entrada).
  // Retorna Map<ingestionCustomerId, total>.
  const fetchAllCustomersConsumption = async (apiDomain, startISO, endISO) => {
    const creds = window.MyIOUtils?.getCredentials?.();
    if (!creds?.clientId || !creds?.customerId || !MyIOLibrary?.buildMyioIngestionAuth) return null;
    const auth = MyIOLibrary.buildMyioIngestionAuth({
      dataApiHost: creds.dataApiHost,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    });
    const token = await auth.getToken();
    if (!token) return null;
    const url = new URL(
      `${creds.dataApiHost}/telemetry/customers/${creds.customerId}/${apiDomain}/devices/totals`
    );
    url.searchParams.set('startTime', startISO);
    url.searchParams.set('endTime', endISO);
    url.searchParams.set('deep', '1');
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(150000),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const arr = Array.isArray(payload) ? payload : (payload?.data ?? []);
    const byCustomer = new Map();
    for (const d of arr) {
      const cid = d.customerId || d.customer_id || '';
      if (!cid) continue;
      byCustomer.set(cid, (byCustomer.get(cid) || 0) + (Number(d.total_value ?? d.value) || 0));
    }
    return byCustomer;
  };

  // ── ENERGIA: as metas são definidas contra os medidores de ENTRADA (mesma semântica
  // do grupo Entrada usado pelo GoalsModal do v-5.2.0) — somar todos os devices conta
  // duplicado (entrada + sub-medidores ≈ 2× a meta). Curadoria dos medidores de entrada:
  // profile de trafo/agregador + "ENTRADA" no nome, excluindo CAG (trafos de climatização
  // compartilham o mesmo profile). Se a plataforma expuser curadoria explícita
  // (grupo/attr por shopping), substituir este heurístico aqui.
  const ENTRADA_PROFILE_ID = 'afe5c9ba-3ade-4bb8-b703-c53c2c190cf9';
  // Medidor de ENTRADA = APENAS o deviceProfile ENTRADA (autoridade única).
  // O nome NÃO é mais testado: engana — há trafos de entrada válidos como
  // TRAFO_ENTRADA_CAG (tem "CAG") e MEDICAO_GERAL (não tem "ENTRADA" nem "CAG").
  // deviceProfile é a fonte de verdade da classificação.
  const _isEntradaDevice = (d) => d.profileId === ENTRADA_PROFILE_ID;

  let _entradaDevicesPromise = null; // cache da sessão: [{id, customerId, name}]
  const getEntradaDevices = () => {
    if (_entradaDevicesPromise) return _entradaDevicesPromise;
    _entradaDevicesPromise = (async () => {
      // 1) CURADORIA EXPLÍCITA (auditoria 2026-07-07): attr SERVER_SCOPE
      //    `entradaIngestionIds` (array de ingestion ids) em cada shopping — mesma
      //    régua das colunas Entrada dos dashboards próprios. Fonte da verdade.
      const curated = [];
      const uncovered = new Set(); // ingestion ids de shoppings SEM o attr → fallback heurístico
      const cards = (_currentCustomersCards || []).filter(
        (c) => c.entityType === 'CUSTOMER' && (c.customerId || c.entityId)
      );
      await Promise.all(
        cards.map(async (c) => {
          const attrs = await getCustomerAttrs(c.customerId || c.entityId).catch(() => ({}));
          const ing = attrs?.ingestionId;
          if (!ing) return;
          let ids = attrs?.entradaIngestionIds;
          if (typeof ids === 'string') {
            try {
              ids = JSON.parse(ids);
            } catch {
              ids = null;
            }
          }
          if (Array.isArray(ids) && ids.length) {
            ids.forEach((id) => curated.push({ id, customerId: ing, name: `entrada:${c.title || ing}` }));
          } else {
            uncovered.add(ing);
          }
        })
      );
      // 2) Listagem via devices/totals do head-office (range de 24h — serve só
      //    para LISTAR): (a) enriquece a CURADORIA com o label/nome REAL de cada
      //    medidor (o attr entradaIngestionIds só tem ids — sem isso os cards
      //    por dispositivo mostravam "Entrada #1/#2"); (b) fallback heurístico
      //    (profile de trafo + "ENTRADA" no nome − CAG) para shoppings sem attr.
      const finish = (apiById) => {
        if (curated.length) {
          LogHelper.log(
            '[MAIN_UNIQUE] entrada curada:',
            curated.length,
            'medidores (attr entradaIngestionIds)'
          );
        }
        return curated.map((d) => {
          const api = apiById?.get(d.id);
          return api ? { ...d, name: api.label || api.name || d.name } : d;
        });
      };
      const creds = window.MyIOUtils?.getCredentials?.();
      if (!creds?.clientId || !creds?.customerId || !MyIOLibrary?.buildMyioIngestionAuth) return finish(null);
      const auth = MyIOLibrary.buildMyioIngestionAuth({
        dataApiHost: creds.dataApiHost,
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
      });
      const token = await auth.getToken();
      if (!token) return finish(null);
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 3600 * 1000);
      const url = new URL(
        `${creds.dataApiHost}/telemetry/customers/${creds.customerId}/energy/devices/totals`
      );
      url.searchParams.set('startTime', start.toISOString());
      url.searchParams.set('endTime', end.toISOString());
      url.searchParams.set('deep', '1');
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(120000),
      }).catch(() => null);
      if (!res?.ok) return finish(null);
      const payload = await res.json();
      const arr = Array.isArray(payload) ? payload : (payload?.data ?? []);
      const apiById = new Map(arr.filter((d) => d?.id).map((d) => [d.id, d]));
      if (curated.length && uncovered.size === 0) return finish(apiById);
      const heuristic = arr
        .filter(_isEntradaDevice)
        .filter((d) => (curated.length ? uncovered.has(d.customerId) : true))
        .map((d) => ({ id: d.id, customerId: d.customerId, name: d.label || d.name }));
      return [...finish(apiById), ...heuristic];
    })().catch(() => {
      _entradaDevicesPromise = null;
      return [];
    });
    return _entradaDevicesPromise;
  };

  // Série de UM device (~1s) — base do consumo de entrada. A Data API dá 500
  // intermitente em ranges longos: 1 retry após 800ms antes de desistir.
  const fetchDeviceSeries = async (deviceId, apiDomain, startISO, endISO, granularity, _retry = true) => {
    const creds = window.MyIOUtils?.getCredentials?.();
    if (!creds?.clientId || !MyIOLibrary?.buildMyioIngestionAuth) return [];
    const auth = MyIOLibrary.buildMyioIngestionAuth({
      dataApiHost: creds.dataApiHost,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    });
    const token = await auth.getToken();
    if (!token) return [];
    const url = new URL(`${creds.dataApiHost}/telemetry/devices/${deviceId}/${apiDomain}`);
    url.searchParams.set('startTime', startISO);
    url.searchParams.set('endTime', endISO);
    url.searchParams.set('granularity', granularity);
    url.searchParams.set('deep', '0');
    let res;
    try {
      res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(60000),
      });
    } catch (err) {
      if (_retry) {
        await new Promise((r) => setTimeout(r, 800));
        return fetchDeviceSeries(deviceId, apiDomain, startISO, endISO, granularity, false);
      }
      throw err;
    }
    if (!res.ok) {
      if (_retry && res.status >= 500) {
        await new Promise((r) => setTimeout(r, 800));
        return fetchDeviceSeries(deviceId, apiDomain, startISO, endISO, granularity, false);
      }
      return []; // 4xx (ex.: 403 em ano sem dados do device) → sem pontos
    }
    const body = await res.json();
    const ent = Array.isArray(body) ? body[0] : body;
    return ent?.consumption || [];
  };

  // Consumo de ENTRADA por shopping (energia): série 1d de cada medidor de entrada,
  // somada por customer (~8 devices em paralelo, ~2s). Retorna Map<ingestionCustomerId, total>.
  const fetchEntradaTotalsByCustomer = async (startISO, endISO) => {
    const devices = await getEntradaDevices();
    if (!devices.length) return null;
    const byCustomer = new Map();
    await Promise.all(
      devices.map(async (d) => {
        const pts = await fetchDeviceSeries(d.id, 'energy', startISO, endISO, '1d').catch(() => []);
        const total = pts.reduce((s, pt) => s + (Number(pt?.value) || 0), 0);
        byCustomer.set(d.customerId, (byCustomer.get(d.customerId) || 0) + total);
      })
    );
    return byCustomer;
  };

  // ── Entrada REAL para o painel Geral (Energia) ──
  // O datasource TB do head-office só contém parte dos medidores de entrada (3 de 8 na
  // auditoria 2026-07-07) → o painel mostrava Entrada ~294 MWh vs ~1.000 reais, com
  // Área Comum 0 e percentuais sem sentido. Aqui buscamos o total dos medidores
  // CANÔNICOS (curadoria/heurístico acima) no período do dashboard e publicamos em
  // window.MyIOUtils.realEntrada — buildEnergyPanelSummary usa isso no lugar da soma
  // parcial do datasource.
  let _realEntradaKey = '';
  const refreshRealEntradaSummary = async () => {
    try {
      const scopeStart = self.ctx?.$scope?.startDateISO;
      const scopeEnd = self.ctx?.$scope?.endDateISO;
      const fallback =
        typeof MyIOLibrary?.getDefaultPeriodCurrentMonthSoFar === 'function'
          ? MyIOLibrary.getDefaultPeriodCurrentMonthSoFar()
          : null;
      const startISO = scopeStart || fallback?.startISO;
      const endISO = scopeEnd || fallback?.endISO;
      if (!startISO || !endISO) return;
      const key = `${startISO}|${endISO}`;
      if (_realEntradaKey === key && window.MyIOUtils?.realEntrada?.total > 0) return; // período já calculado
      const byCust = await fetchEntradaTotalsByCustomer(startISO, endISO);
      if (!byCust) return;
      let total = 0;
      byCust.forEach((v) => {
        total += Number(v) || 0;
      });
      if (!(total > 0)) return;
      const devices = await getEntradaDevices();
      _realEntradaKey = key;
      window.MyIOUtils = window.MyIOUtils || {};
      window.MyIOUtils.realEntrada = { total, count: devices.length, startISO, endISO };
      LogHelper.log(
        '[MAIN_UNIQUE] realEntrada:',
        Math.round(total),
        'kWh em',
        devices.length,
        'medidores canônicos'
      );
      if (energyPanelInstance) {
        const es = window.MyIOOrchestrator?.getEnergySummary?.();
        if (es) energyPanelInstance.updateSummary(es);
      }
    } catch (err) {
      LogHelper.warn('[MAIN_UNIQUE] refreshRealEntradaSummary falhou:', err?.message || err);
    }
  };
  // Bridge: handlers registrados antes desta definição chamam via MyIOUtils (evita TDZ)
  window.MyIOUtils = window.MyIOUtils || {};
  window.MyIOUtils.refreshRealEntradaSummary = refreshRealEntradaSummary;

  // ── Skin premium dos cards do painel Geral (Energia) ──
  // Dentro do ThingsBoard, `.tb-default h3 {font-size:2rem}` vence a classe da lib
  // (especificidade 0,1,1 > 0,1,0) e os cards ficam gigantes. Este override usa o id
  // do container (especificidade de ID) e de quebra aplica o visual premium compacto:
  // grid responsivo, ícone em chip tintado por categoria, título uppercase discreto,
  // valor em destaque e % em pill — com suporte a dark mode.
  const injectEnergyPanelPremiumStyles = () => {
    if (document.getElementById('myio-energy-panel-premium')) return;
    const s = document.createElement('style');
    s.id = 'myio-energy-panel-premium';
    s.textContent = `
#telemetryGridContainer .energy-panel__cards{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px;margin-bottom:14px;}
@media (max-width:1500px){#telemetryGridContainer .energy-panel__cards{grid-template-columns:repeat(4,minmax(0,1fr));}}
@media (max-width:820px){#telemetryGridContainer .energy-panel__cards{grid-template-columns:repeat(2,minmax(0,1fr));}}
#telemetryGridContainer .energy-panel__card{position:relative;display:flex;flex-direction:column;gap:3px;padding:8px 10px 8px 13px;border-radius:10px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(15,23,42,.05);transition:box-shadow .2s ease,transform .2s ease,border-color .2s ease;overflow:hidden;min-width:0;will-change:transform;}
#telemetryGridContainer .energy-panel__card::before{content:'';position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--epc,#6a1b9a);}
#telemetryGridContainer .energy-panel__card:hover{transform:translateY(-3px) scale(1.08);box-shadow:0 10px 26px rgba(15,23,42,.18);border-color:var(--epc,#6a1b9a);z-index:5;}
#telemetryGridContainer .energy-panel__card[data-type="entrada"]{--epc:#6a1b9a;}
#telemetryGridContainer .energy-panel__card[data-type="lojas"]{--epc:#eab308;}
#telemetryGridContainer .energy-panel__card[data-type="climatizacao"]{--epc:#0ea5e9;}
#telemetryGridContainer .energy-panel__card[data-type="elevadores"]{--epc:#8b5cf6;}
#telemetryGridContainer .energy-panel__card[data-type="escadas"]{--epc:#ec4899;}
#telemetryGridContainer .energy-panel__card[data-type="outros"]{--epc:#64748b;}
#telemetryGridContainer .energy-panel__card[data-type="areaComum"]{--epc:#22c55e;}
#telemetryGridContainer .energy-panel__card[data-type="total"]{--epc:#3e1a7d;}
#telemetryGridContainer .energy-panel__card-header{display:flex;align-items:center;gap:5px;margin:0;min-width:0;}
#telemetryGridContainer .energy-panel__card-icon{font-size:11px;line-height:1;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:color-mix(in srgb,var(--epc,#6a1b9a) 12%,transparent);flex-shrink:0;}
#telemetryGridContainer h3.energy-panel__card-title{font:700 9.5px/1.2 Nunito,sans-serif !important;letter-spacing:.05em;text-transform:uppercase;color:#7c8aa0;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;}
#telemetryGridContainer .energy-panel__card-tooltip{font-size:9px;opacity:.5;}
#telemetryGridContainer .energy-panel__card-body{display:flex;align-items:baseline;gap:5px;margin:0;flex-wrap:wrap;}
#telemetryGridContainer .energy-panel__card-value{font:800 14px/1.1 Nunito,sans-serif;color:#1e293b;font-variant-numeric:tabular-nums;white-space:nowrap;}
#telemetryGridContainer .energy-panel__card-perc{font:700 9px Nunito,sans-serif;color:#64748b;background:#f1f5f9;border-radius:999px;padding:1px 6px;white-space:nowrap;}
#telemetryGridContainer .energy-panel-wrap[data-theme="dark"] .energy-panel__card{background:#1e293b;border-color:#334155;}
#telemetryGridContainer .energy-panel-wrap[data-theme="dark"] h3.energy-panel__card-title{color:#94a3b8;}
#telemetryGridContainer .energy-panel-wrap[data-theme="dark"] .energy-panel__card-value{color:#e2e8f0;}
#telemetryGridContainer .energy-panel-wrap[data-theme="dark"] .energy-panel__card-perc{background:#0f172a;color:#94a3b8;}
`;
    document.head.appendChild(s);
  };

  // ── Fetchers REAIS dos gráficos do painel Geral (Energia) ──
  // Sem eles o EnergyPanelView cai nos mocks de fábrica (Shopping Aricanduva/Interlagos/
  // Tucuruvi/Penha). Consumo diário = entrada canônica por shopping; distribuição =
  // devices classificados (RFC-0128) agrupados por shopping, com o consumo do período
  // do dashboard já enriquecido.
  const fetchEnergyPanelConsumption = async (periodDays) => {
    const days = Math.max(1, Number(periodDays) || 7);
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1), 0, 0, 0);
    const byCust =
      (await fetchEntradaPointsByCustomer(start.toISOString(), end.toISOString(), '1d')) || new Map();

    // Sem medidores de entrada identificáveis (ex.: Soul Malls — sem attr
    // entradaIngestionIds e heurístico sem match): fallback para TODOS os devices
    // de energia do datasource por shopping (mesma régua do header), senão o
    // gráfico do painel Geral fica vazio.
    if (byCust.size === 0) {
      const classified = window.MyIOOrchestratorData?.classified;
      const allowed = new Set();
      ['entrada', 'equipments', 'stores'].forEach((ctx) =>
        (classified?.energy?.[ctx] || []).forEach((d) => d.ingestionId && allowed.add(d.ingestionId))
      );
      LogHelper.warn(
        '[MAIN_UNIQUE] Geral(Energia): sem medidores de entrada — fallback p/ todos os devices de energia'
      );
      return fetchDailyConsumptionByCustomer('energy', days, allowed);
    }

    // ingestionId → título do shopping (cards do datasource)
    const names = {};
    const cards = (_currentCustomersCards || []).filter(
      (c) => c.entityType === 'CUSTOMER' && (c.customerId || c.entityId)
    );
    await Promise.all(
      cards.map(async (c) => {
        const attrs = await getCustomerAttrs(c.customerId || c.entityId).catch(() => ({}));
        if (attrs?.ingestionId) names[attrs.ingestionId] = c.title || attrs.ingestionId;
      })
    );

    const labels = [];
    const idxByKey = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
      labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
      idxByKey.set(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, i);
    }
    const shoppingData = {};
    const shoppingNames = {};
    const dailyTotals = Array(days).fill(0);
    byCust.forEach((pts, cust) => {
      const arr = Array(days).fill(0);
      (pts || []).forEach((pt) => {
        const idx = idxByKey.get(String(pt.timestamp).slice(5, 10));
        if (idx !== undefined) arr[idx] += Number(pt.value) || 0;
      });
      shoppingData[cust] = arr;
      shoppingNames[cust] = names[cust] || cust;
      arr.forEach((v, i) => {
        dailyTotals[i] += v;
      });
    });
    return { labels, dailyTotals, shoppingData, shoppingNames, fetchTimestamp: Date.now() };
  };

  const fetchEnergyPanelDistribution = async (mode) => {
    const classified = window.MyIOOrchestratorData?.classified;
    if (!classified) return {};
    const val = (d) => Number(d.value ?? d.consumption ?? 0) || 0;

    if (mode === 'groups') {
      const bc = window.MyIOOrchestrator?.getEnergySummary?.()?.byCategory;
      if (!bc) return {};
      return {
        Lojas: bc.lojas?.total || 0,
        Climatização: bc.climatizacao?.total || 0,
        Elevadores: bc.elevadores?.total || 0,
        'Escadas Rolantes': bc.escadas?.total || 0,
        Outros: bc.outros?.total || 0,
      };
    }

    const sumByShopping = (devices) => {
      const out = {};
      (devices || []).forEach((d) => {
        const s = d.customerName || d.ownerName || '—';
        out[s] = (out[s] || 0) + val(d);
      });
      return Object.fromEntries(
        Object.entries(out)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
      );
    };
    if (mode === 'stores') return sumByShopping(classified.energy?.stores);
    const catByMode = {
      hvac: 'climatizacao',
      elevators: 'elevadores',
      escalators: 'escadas_rolantes',
      others: 'outros',
    };
    const cat = catByMode[mode];
    if (!cat) return {};
    const equipments = classified.energy?.equipments || [];
    if (typeof MyIOLibrary?.classifyEquipment !== 'function') return {};
    return sumByShopping(equipments.filter((d) => MyIOLibrary.classifyEquipment(d) === cat));
  };

  // ── Série diária por shopping (genérica): 1 devices/totals por dia, filtrada a um
  // conjunto de ingestionIds e agrupada pelo customerId/customerName da própria API.
  // Usada pelo gráfico do Água > Resumo e como fallback do gráfico de energia quando
  // não há medidores de entrada identificáveis (ex.: Soul Malls).
  const _dailyTotalsCache = new Map(); // 'domain|YYYY-MM-DD' -> Map<custId, {name, total}>
  const fetchDailyConsumptionByCustomer = async (apiDomain, periodDays, allowedIds) => {
    const empty = {
      labels: [],
      dailyTotals: [],
      shoppingData: {},
      shoppingNames: {},
      fetchTimestamp: Date.now(),
    };
    const days = Math.max(1, Number(periodDays) || 7);
    const creds = window.MyIOUtils?.getCredentials?.();
    if (!creds?.clientId || !creds?.customerId || !MyIOLibrary?.buildMyioIngestionAuth) return empty;
    const auth = MyIOLibrary.buildMyioIngestionAuth({
      dataApiHost: creds.dataApiHost,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    });
    const token = await auth.getToken();
    if (!token) return empty;

    const today = new Date();
    const dayList = [];
    for (let i = days - 1; i >= 0; i--) {
      dayList.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i, 12));
    }
    const labels = dayList.map((d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    const perDay = Array(days).fill(null);

    const fetchDay = async (d, idx) => {
      const key = `${apiDomain}|${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (_dailyTotalsCache.has(key)) {
        perDay[idx] = _dailyTotalsCache.get(key);
        return;
      }
      const dateStr = key.split('|')[1];
      const url = new URL(
        `${creds.dataApiHost}/telemetry/customers/${creds.customerId}/${apiDomain}/devices/totals`
      );
      url.searchParams.set('startTime', `${dateStr}T00:00:00-03:00`);
      url.searchParams.set('endTime', `${dateStr}T23:59:59-03:00`);
      url.searchParams.set('deep', '1');
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(120000),
      }).catch(() => null);
      if (!res || !res.ok) return;
      const payload = await res.json();
      const arr = Array.isArray(payload) ? payload : (payload?.data ?? []);
      const m = new Map();
      for (const dev of arr) {
        if (!dev.customerId) continue;
        // se há filtro, respeita; sem filtro (classified vazio), aceita todos
        if (allowedIds?.size && !allowedIds.has(dev.id)) continue;
        const cur = m.get(dev.customerId) || { name: dev.customerName || dev.customerId, total: 0 };
        cur.total += Number(dev.total_value ?? dev.value) || 0;
        m.set(dev.customerId, cur);
      }
      perDay[idx] = m;
      if (d.toDateString() !== today.toDateString()) _dailyTotalsCache.set(key, m); // hoje ainda cresce
    };
    for (let b = 0; b < dayList.length; b += 4) {
      await Promise.all(dayList.slice(b, b + 4).map((d, j) => fetchDay(d, b + j)));
    }

    const shoppingData = {};
    const shoppingNames = {};
    const dailyTotals = Array(days).fill(0);
    perDay.forEach((m, i) => {
      if (!m) return;
      m.forEach((v, cust) => {
        if (!shoppingData[cust]) {
          shoppingData[cust] = Array(days).fill(0);
          shoppingNames[cust] = v.name;
        }
        shoppingData[cust][i] = v.total;
        dailyTotals[i] += v.total;
      });
    });
    return { labels, dailyTotals, shoppingData, shoppingNames, fetchTimestamp: Date.now() };
  };

  // Gráfico do Água > Resumo: só hidrômetros de Lojas + Área Comum + Banheiros
  // (exclui entradas — a entrada da Ilha subconta), fiel às abas do HO.
  const fetchWaterPanelConsumption = async (periodDays) => {
    const classified = window.MyIOOrchestratorData?.classified;
    const allowed = new Set();
    ['hidrometro', 'hidrometro_area_comum', 'banheiros'].forEach((ctx) =>
      (classified?.water?.[ctx] || []).forEach((d) => d.ingestionId && allowed.add(d.ingestionId))
    );
    return fetchDailyConsumptionByCustomer('water', periodDays, allowed);
  };

  // (distribuição de água já é injetada inline no createWaterPanelComponent — RFC-0133)

  // Séries de entrada POR SHOPPING (energia) — Map<ingestionCustomerId, pontos[]>.
  // Base do gráfico único (consolidado soma os customers; por shopping usa cada um).
  const fetchEntradaPointsByCustomer = async (startISO, endISO, granularity) => {
    const devices = await getEntradaDevices();
    if (!devices.length) return null;
    const byCust = new Map();
    await Promise.all(
      devices.map(async (d) => {
        const pts = await fetchDeviceSeries(d.id, 'energy', startISO, endISO, granularity).catch(() => []);
        const list = byCust.get(d.customerId) || [];
        list.push(...pts);
        byCust.set(d.customerId, list);
      })
    );
    return byCust;
  };

  // Série temporal agregada do head-office (todos os shoppings somados) — endpoint
  // /{domain}/ com granularity 1d|1h. LENTO em ranges grandes (~1-2min p/ um mês);
  // usado na Evolução × Meta de ÁGUA (energia usa fetchEntradaPointsByCustomer, rápida).
  // Retorna [{timestamp, value}] somado por ts.
  const fetchHeadOfficeSeries = async (
    apiDomain,
    startISO,
    endISO,
    granularity,
    customerIngestionId = null
  ) => {
    const creds = window.MyIOUtils?.getCredentials?.();
    if (!creds?.clientId || !creds?.customerId || !MyIOLibrary?.buildMyioIngestionAuth) return null;
    const auth = MyIOLibrary.buildMyioIngestionAuth({
      dataApiHost: creds.dataApiHost,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    });
    const token = await auth.getToken();
    if (!token) return null;
    const url = new URL(
      `${creds.dataApiHost}/telemetry/customers/${customerIngestionId || creds.customerId}/${apiDomain}/`
    );
    url.searchParams.set('startTime', startISO);
    url.searchParams.set('endTime', endISO);
    url.searchParams.set('deep', '1');
    url.searchParams.set('granularity', granularity);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(180000),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const arr = Array.isArray(payload) ? payload : (payload?.data ?? []);
    const byTs = new Map();
    for (const ent of arr)
      for (const pt of ent?.consumption || []) {
        if (!pt) continue;
        byTs.set(pt.timestamp, (byTs.get(pt.timestamp) || 0) + (Number(pt.value) || 0));
      }
    return Array.from(byTs, ([timestamp, value]) => ({ timestamp, value }));
  };

  const GOALS_COMPARE_DOMAINS = {
    energy: { label: '⚡ Energia', gcdr: 'ENERGY', api: 'energy', unit: 'kWh' },
    water: { label: '💧 Água', gcdr: 'WATER', api: 'water', unit: 'm³' },
  };

  const openGoalsCompare = (shoppings) => {
    const prevRoot = document.getElementById('myio-goals-compare-root');
    if (prevRoot) prevRoot.remove();

    // Dt. Inauguração ('YYYY-MM-DD') → timestamp; ausente/inválida → null (vai pro fim)
    const parseInaugDate = (s) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '').trim());
      if (!m) return null;
      const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
      return Number.isFinite(t) ? t : null;
    };
    // Comparador Dt. Inauguração: data asc (mais antiga primeiro) × dir; SEM data
    // sempre por último (independe da direção), ordenados por nome entre si.
    const cmpInauguration = (a, b, dir = 1) => {
      const da = parseInaugDate(a.inaugurationDate);
      const db = parseInaugDate(b.inaugurationDate);
      if (da != null && db != null) return (da - db) * dir;
      if (da != null) return -1;
      if (db != null) return 1;
      return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
    };
    // Ordem BASE do modal = Dt. Inauguração (default do controle "Ordenar:") —
    // vale para a sidebar (ordem original), gráficos por shopping e o modo Cards.
    shoppings = [...(shoppings || [])].sort((a, b) => cmpInauguration(a, b, 1));

    let domainKey = 'energy';
    // Período selecionado (createDateRangePicker da lib) — default: mês corrente até agora
    let period = (typeof MyIOLibrary?.getDefaultPeriodCurrentMonthSoFar === 'function'
      ? MyIOLibrary.getDefaultPeriodCurrentMonthSoFar()
      : null) || {
      startISO: `${new Date().toISOString().slice(0, 8)}01T00:00:00-03:00`,
      endISO: new Date().toISOString(),
    };
    let reqSeq = 0; // descarta respostas de um load antigo (troca rápida de domínio/período)

    // Dia local (fuso do navegador) de um ISO — endISO pode vir em UTC e "virar" o dia
    const isoLocalDay = (iso) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Dias (com ano) cobertos pelo período — base p/ meta diária somada e labels da view Dia
    const daysInPeriod = () => {
      const days = [];
      const d = new Date(`${isoLocalDay(period.startISO)}T12:00:00`);
      const end = new Date(`${isoLocalDay(period.endISO)}T12:00:00`);
      while (d <= end && days.length < 370) {
        days.push({
          y: String(d.getFullYear()),
          key: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        });
        d.setDate(d.getDate() + 1);
      }
      return days;
    };
    const periodLabel = () => {
      const s = isoLocalDay(period.startISO);
      const e = isoLocalDay(period.endISO);
      return `${s.slice(8, 10)}/${s.slice(5, 7)}–${e.slice(8, 10)}/${e.slice(5, 7)}/${e.slice(0, 4)}`;
    };

    // Meta do shopping no período = soma das metas diárias (tree.daily) dos dias do
    // range. Também devolve os metadados Addendum A do(s) ano(s) carregado(s):
    // coverageGaps agregado (⚠ da sidebar), granularity DEVICE e nº de medidores.
    const metaForPeriod = async (attrs, cfgD) => {
      const days = daysInPeriod();
      const years = [...new Set(days.map((dd) => dd.y))];
      const goalsByYear = {};
      for (const y of years) {
        goalsByYear[y] = await fetchCustomerGoalsTree(attrs, cfgD.gcdr, y, 'day').catch(() => null);
      }
      // Dois totais por período: Orçado (value cru) e Meta (adjustedValue, margem
      // RFC-0052 — cai no value quando margem 0/ausente). Somados dia-a-dia.
      let sumOrcado = 0;
      let sumMeta = 0;
      let has = false;
      for (const dd of days) {
        const node = goalsByYear[dd.y]?.tree?.daily?.[dd.key];
        const v = node?.value;
        if (v != null) {
          sumOrcado += Number(v) || 0;
          const adj = node?.adjustedValue ?? node?.value;
          sumMeta += Number(adj) || 0;
          has = true;
        }
      }
      // Agregação dos metadados por ano (o range pode cruzar a virada do ano)
      const gaps = { missing: [], truncated: false, missingHours: 0 };
      let granularity = null;
      let devicesCount = 0;
      for (const y of years) {
        const g = goalsByYear[y];
        if (!g) continue;
        if (g.granularity === 'DEVICE') {
          granularity = 'DEVICE';
          devicesCount = Math.max(devicesCount, Array.isArray(g.devices) ? g.devices.length : 0);
        }
        const cg = g.coverageGaps;
        if (_hasGaps(cg)) {
          gaps.missing.push(...(cg.missing || []));
          gaps.missingHours += Number(cg.missingHours) || 0;
          gaps.truncated = gaps.truncated || !!cg.truncated;
        }
      }
      return {
        orcado: has ? sumOrcado : null, // value cru
        meta: has ? sumMeta : null, // adjustedValue (Meta)
        value: has ? sumOrcado : null, // alias retrocompat (chamadores antigos)
        gaps: _hasGaps(gaps) ? gaps : null,
        granularity,
        devicesCount,
      };
    };

    // Paleta do dashboard propagada para o chrome do painel (header, tabs, pills…)
    const GP = goalsPalette();
    // Cor da linha de Orçado (value cru) nos cards — igual ao default do
    // CustomerGoalsCard: Orçado LARANJA tracejado; Meta AZUL tracejada.
    const CGC_REALIZADO_COLOR = '#2563eb'; // Realizado — AZUL fixo (não segue o accent do dashboard)
    const CGC_PREV_COLOR = '#94a3b8'; // A-1 (ano anterior) — CINZA
    const CGC_ORCADO_COLOR = '#f59e0b'; // Orçado (value cru) — LARANJA
    const CGC_META_COLOR = '#7c3aed'; // Meta (adjustedValue) — ROXO

    const overlay = document.createElement('div');
    overlay.id = 'myio-goals-compare-root';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;font-family:Nunito,sans-serif;';
    // Cores tematizáveis via CSS vars (--gc-*) setadas no overlay por applyModalTheme()
    const hdrBtn =
      'border:1px solid rgba(255,255,255,.5);border-radius:8px;background:rgba(255,255,255,.12);color:#fff;padding:6px 12px;cursor:pointer;font:700 12px Nunito,sans-serif;';
    overlay.innerHTML = `
      <div role="dialog" data-gc-dialog aria-label="Metas × Consumo" style="background:var(--gc-surface);border-radius:14px;width:min(1520px,calc(100% - 32px));height:88vh;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 20px;background:linear-gradient(135deg,${GP.accentDark},${GP.accent});color:${GP.accentText};flex-shrink:0;">
          <strong style="font:700 16px Nunito,sans-serif;">📊 Metas × Consumo — ${_escHtml(_entP())}</strong>
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" data-thm title="Alternar tema claro/escuro" style="${hdrBtn}">🌙</button>
            <button type="button" data-max title="Maximizar" style="${hdrBtn}">⛶</button>
            <button type="button" data-pdf style="${hdrBtn}">⬇️ PDF</button>
            <button type="button" data-close="1" aria-label="Fechar" style="border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer;line-height:1;">✕</button>
          </div>
        </div>
        <div data-gc-body style="flex:1 1 auto;min-height:0;display:flex;overflow:hidden;">
          <div data-gc-col1 style="flex:1 1 560px;min-width:0;min-height:0;display:flex;flex-direction:column;padding:12px 20px 14px;overflow:hidden;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex-shrink:0;padding-bottom:10px;">
              <div data-tabs style="display:flex;gap:6px;">
                ${Object.entries(GOALS_COMPARE_DOMAINS)
                  .map(
                    ([k, d]) =>
                      `<button type="button" data-domain="${k}" style="border:1px solid ${GP.accent};border-radius:8px;padding:6px 14px;cursor:pointer;font:700 13px Nunito,sans-serif;">${d.label}</button>`
                  )
                  .join('')}
              </div>
              <label style="display:flex;align-items:center;gap:8px;font:600 13px Nunito,sans-serif;color:var(--gc-text2);">Período
                <input type="text" data-period readonly placeholder="Selecione o período" style="border:1px solid var(--gc-input-border);border-radius:8px;padding:6px 10px;font:600 13px Nunito,sans-serif;color:var(--gc-text);width:210px;cursor:pointer;background:var(--gc-surface);" />
              </label>
              <span data-status hidden style="display:none;"></span>
            </div>
            <div data-controls style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex-shrink:0;padding-bottom:10px;">
              <div data-evo-grans style="display:flex;gap:4px;background:var(--gc-chip);border-radius:8px;padding:3px;">
                <button type="button" data-gran="1y" title="Ajusta o período para o ano corrente (01/01 até hoje) e mostra a visão mensal" style="border:0;border-radius:6px;padding:5px 14px;cursor:pointer;font:700 12px Nunito,sans-serif;">Ano ${new Date().getFullYear()}</button>
                <button type="button" data-gran="1M" title="Meses dentro do período selecionado" style="border:0;border-radius:6px;padding:5px 14px;cursor:pointer;font:700 12px Nunito,sans-serif;">Mês</button>
                <button type="button" data-gran="1d" style="border:0;border-radius:6px;padding:5px 14px;cursor:pointer;font:700 12px Nunito,sans-serif;">Dia</button>
                <button type="button" data-gran="1h" style="border:0;border-radius:6px;padding:5px 14px;cursor:pointer;font:700 12px Nunito,sans-serif;">Hora</button>
              </div>
              <div data-evo-modes style="display:flex;gap:4px;background:var(--gc-chip);border-radius:8px;padding:3px;">
                <button type="button" data-mode="analytics" title="Tabela analítica do portfólio: Realizado, A-1, Orçado, variações e performance" style="border:0;border-radius:6px;padding:5px 12px;cursor:pointer;font:700 12px Nunito,sans-serif;">Resumo Analítico</button>
                <button type="button" data-mode="cons" style="border:0;border-radius:6px;padding:5px 12px;cursor:pointer;font:700 12px Nunito,sans-serif;">Consolidado</button>
                <button type="button" data-modegroup="sep" title="Um gráfico/card por ${_escHtml(_goalsEntityLabel.toLowerCase())}" style="border:0;border-radius:6px;padding:5px 12px;cursor:pointer;font:700 12px Nunito,sans-serif;">Por ${_escHtml(_goalsEntityLabel)}</button>
              </div>
              <div data-sep-submodes style="display:none;gap:4px;background:var(--gc-chip);border-radius:8px;padding:3px;">
                <button type="button" data-submode="stack" title="Séries empilhadas (${_escHtml(_entPLow())}); meta única (soma)" style="border:0;border-radius:6px;padding:5px 12px;cursor:pointer;font:700 12px Nunito,sans-serif;">Empilhados</button>
                <button type="button" data-submode="sep" title="Um par de barras e uma linha de meta por ${_escHtml(_entSLow())}" style="border:0;border-radius:6px;padding:5px 12px;cursor:pointer;font:700 12px Nunito,sans-serif;">Separados</button>
                <button type="button" data-submode="cards" title="Um card por ${_escHtml(_entSLow())}: Realizado × A-1 × Orçado (RFC-0217)" style="border:0;border-radius:6px;padding:5px 12px;cursor:pointer;font:700 12px Nunito,sans-serif;">Cards</button>
              </div>
              <button type="button" data-cards-settings title="Configurações dos cards (linha/barra, pontos)" style="display:none;border:1px solid ${GP.tint(45)};border-radius:8px;background:transparent;color:${GP.accent};padding:4px 9px;cursor:pointer;font:700 13px Nunito,sans-serif;">⚙️</button>
              <span data-evo-status style="margin-left:auto;font:600 12px Nunito,sans-serif;color:var(--gc-muted);"></span>
            </div>
            <div style="flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:10px;position:relative;">
              <div data-evo-loading style="display:none;position:absolute;inset:0;z-index:6;background:rgba(148,163,184,.08);align-items:center;justify-content:center;border-radius:8px;">
                <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                  <div style="width:34px;height:34px;border-radius:50%;border:3px solid ${GP.tint(25)};border-top-color:${GP.accent};animation:gcSpin .8s linear infinite;"></div>
                  <span style="font:700 12px Nunito,sans-serif;color:var(--gc-muted);">Carregando dados…</span>
                </div>
              </div>
              <style>@keyframes gcSpin{to{transform:rotate(360deg)}}
                /* Mesmo hover/zoom dos cards RFC-0217 (.myio-cgc) nas linhas da sidebar */
                #myio-goals-compare-root .gc-side-item{cursor:pointer;transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease;}
                #myio-goals-compare-root .gc-side-item:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 6px 18px rgba(15,23,42,.18);border-color:${GP.tint(45)};}
              </style>
              <div data-evo-wrap style="position:relative;flex:1 1 auto;min-height:150px;"><canvas data-evo-chart></canvas></div>
              <div data-cards-grid style="display:none;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:10px;flex:1 1 auto;min-height:0;overflow-y:auto;align-content:start;"></div>
              <div data-cards-legend style="display:none;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;font:600 11px Nunito,sans-serif;color:var(--gc-muted);padding:4px 2px 0;flex:0 0 auto;"></div>
              <div data-analytics style="display:none;overflow:auto;flex:1 1 auto;min-height:0;"></div>
              <div data-evo-legend style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;border-top:1px solid var(--gc-border);margin-top:2px;padding-top:8px;flex:0 0 auto;">
                <span data-year-toggles style="display:none;align-items:center;gap:10px;"></span>
              </div>
              <div data-caption style="font:600 11px Nunito,sans-serif;color:var(--gc-muted2);flex:0 0 auto;">Barras: consumo do período e do mesmo período no ano anterior · Linha(s): meta — consolidado/empilhado = soma (${_escHtml(_entPLow())}, linha única); separado = uma linha tracejada por ${_escHtml(_entSLow())} · Consumo Energia: medidores de ENTRADA (régua das metas) · Água: hidrômetros · Dia/Hora seguem o intervalo selecionado; Hora disponível para intervalos de até 15 dias · Gestão: 🎯 Metas → Gestão de Metas.</div>
            </div>
          </div>
          <aside style="flex:0 0 372px;min-height:0;max-width:100%;display:flex;flex-direction:column;gap:8px;border-left:1px solid var(--gc-border);padding:12px 20px 14px 16px;overflow:hidden;" data-side>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              <strong data-side-title style="margin-right:auto;font:700 13px Nunito,sans-serif;color:var(--gc-muted);white-space:nowrap;">Resumo por ${_escHtml(_goalsEntityLabel.toLowerCase())}</strong>
              <button type="button" data-pricing title="Precificação — R$/kWh por ${_escHtml(_entSLow())} × período" style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border:1px solid ${GP.tint(45)};border-radius:8px;background:transparent;color:${GP.accent};padding:4px 10px;cursor:pointer;font:800 14px Nunito,sans-serif;line-height:1.4;transition:background .15s, border-color .15s;" onmouseover="this.style.background='${GP.tint(8)}';this.style.borderColor='${GP.accent}'" onmouseout="this.style.background='transparent';this.style.borderColor='${GP.tint(45)}'">$</button>
              <button type="button" data-side-toggle title="Recolher resumo" style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid ${GP.tint(45)};border-radius:8px;background:transparent;color:${GP.accent};padding:4px 10px;cursor:pointer;font:700 11px Nunito,sans-serif;line-height:1.4;white-space:nowrap;transition:background .15s, border-color .15s;" onmouseover="this.style.background='${GP.tint(8)}';this.style.borderColor='${GP.accent}'" onmouseout="this.style.background='transparent';this.style.borderColor='${GP.tint(45)}'">Recolher ▶</button>
            </div>
            <div data-side-sort style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              <span style="font:600 10.5px Nunito,sans-serif;color:var(--gc-muted);flex:0 0 auto;">Ordem:</span>
              <button type="button" data-side-order title="Clique para inverter (crescente/decrescente)" style="flex:1 1 auto;min-width:0;text-align:left;border:1px solid var(--gc-border);border-radius:999px;background:transparent;color:var(--gc-muted);padding:3px 12px;cursor:pointer;font:700 10.5px Nunito,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Data de Inauguração ↑</button>
              <button type="button" data-side-filter title="Filtros & ordenação — buscar, excluir, filtros rápidos" style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border:1px solid ${GP.tint(45)};border-radius:8px;background:transparent;color:${GP.accent};padding:3px 9px;cursor:pointer;font:700 13px Nunito,sans-serif;">⚙️</button>
            </div>
            <div data-table style="display:flex;flex-direction:column;gap:8px;flex:1 1 auto;min-height:0;overflow-y:auto;"></div>
            <div data-side-total style="flex:0 0 auto;"></div>
          </aside>
        </div>
      </div>`;

    const periodInput = overlay.querySelector('[data-period]');
    const statusEl = overlay.querySelector('[data-status]');
    const tableEl = overlay.querySelector('[data-table]');
    const totalEl = overlay.querySelector('[data-side-total]');
    const evoStatusEl = overlay.querySelector('[data-evo-status]');
    const evoCanvas = overlay.querySelector('[data-evo-chart]');
    const dialogEl = overlay.querySelector('[data-gc-dialog]');

    // ── Tema (sincronizado com o dashboard via myio:theme-change / RFC-0120) ──
    const GC_THEMES = {
      light: {
        surface: '#ffffff',
        surface2: '#f8fafc',
        chip: '#f1f5f9',
        border: '#e2e8f0',
        text: '#1e293b',
        text2: '#334155',
        muted: '#64748b',
        muted2: '#94a3b8',
        inputBorder: '#cbd5e1',
        pillActiveBg: '#ffffff',
        pillActiveTx: GP.accent,
        tabIdleBg: '#ffffff',
        chartTick: '#475569',
        chartGrid: 'rgba(100,116,139,.15)',
      },
      dark: {
        surface: '#1e293b',
        surface2: '#273449',
        chip: '#0f172a',
        border: '#334155',
        text: '#e2e8f0',
        text2: '#cbd5e1',
        muted: '#94a3b8',
        muted2: '#64748b',
        inputBorder: '#475569',
        pillActiveBg: GP.accent,
        pillActiveTx: GP.accentText,
        tabIdleBg: '#1e293b',
        chartTick: '#cbd5e1',
        chartGrid: 'rgba(148,163,184,.15)',
      },
    };
    let modalTheme =
      (typeof currentThemeMode === 'string' ? currentThemeMode : window.MyIOUtils?.currentThemeMode) ===
      'dark'
        ? 'dark'
        : 'light';
    let isMax = false;
    let lastEvo = null; // {labels, datasets, stacked} — re-render no toggle de tema

    // — Gráfico único Metas × Consumo: esquema de cores padrão das Metas —
    // Realizado (consolidado) AZUL fixo #2563eb; A-1 cinza translúcido; Meta ROXO
    // #7c3aed; Orçado (cru) laranja. Contraste garantido em ambos os temas.
    const EVO_COLORS = {
      energy: { bar: CGC_REALIZADO_COLOR, goal: CGC_META_COLOR },
      water: { bar: CGC_REALIZADO_COLOR, goal: CGC_META_COLOR },
    };
    // Séries múltiplas (por shopping / por medidor): TONS do accent do dashboard
    // (settingsSchema) — monocromático segue a paleta do customer; fallback na
    // paleta multicolor MyIO quando o accent não é um hex válido.
    const GP_TONES = GP.tones(8);
    const SHOP_PALETTE = GP_TONES || [
      '#6c5ce7',
      '#0ea5e9',
      '#22c55e',
      '#eab308',
      '#ef4444',
      '#14b8a6',
      '#d946ef',
      '#f97316',
    ];
    const rgba = (hex, a) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    };
    const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    // Default 'Dia': o gráfico abre respeitando o intervalo do picker (Mês = visão anual, opt-in)
    let evoGran = '1d';
    // Modos: 'cons' | 'stack' | 'sep' | 'cards' (subcategorias de "Separados") | 'analytics'
    let evoMode = 'cons';
    let lastSepSubmode = 'stack'; // subcategoria lembrada ao reabrir o grupo Separados
    let showCurYear = true; // 👁 ano corrente
    let showPrevYear = true; // 👁 ano anterior (A-1)
    // 👁 por customer: tbIds ocultos → expurgados dos TOTAIS (sidebar) e de TODA a
    // agregação do gráfico/analítico/cards (loadEvo re-agrega sem eles). Default: todos visíveis.
    const hiddenCustomers = new Set(); // Set<tbId>
    const isCustHidden = (tbId) => hiddenCustomers.has(String(tbId));
    let cardsShowPoints = false; // ⚙️ dos cards — pontos na linha desligados por default
    let cardsChartType = 'bar'; // ⚙️ dos cards — barra é o default
    let cardsGroupBy = 'shopping'; // ⚙️ dos cards: 'shopping' (default) | 'device' (medidores lado a lado) | 'device-stack' (medidores empilhados)
    let cardsShowConsolidated = false; // ⚙️ dos cards — card "Consolidado" (todos os shoppings somados) como último card
    let evoChart = null;
    let evoTip = null; // tooltip premium tree-driven das barras (lib createGoalsBarTooltip)
    let evoSeq = 0;
    const evoConsCache = new Map(); // consumo por (domínio, gran, range) — troca de aba não refaz fetch

    const paintTabs = () => {
      const t = GC_THEMES[modalTheme];
      overlay.querySelectorAll('[data-domain]').forEach((b) => {
        const active = b.dataset.domain === domainKey;
        b.style.background = active ? GP.accent : t.tabIdleBg;
        b.style.color = active ? GP.accentText : modalTheme === 'dark' ? GP.lighten(55) : GP.accent;
      });
    };

    const CHIP_BASE =
      'border-radius:999px;padding:2px 10px;font:700 11px Nunito,sans-serif;white-space:nowrap;';
    // Limiar de "aprox. igual": |desvio| < 1% → ≈ (neutro/cinza)
    const APPROX_PCT = 1;
    // Chip de desvio unificado: `value` × `reference` → só SETA + %, sem palavras.
    // ↑ (value maior/pior, vermelho) · ↓ (value menor/melhor, verde) · ≈ (~igual,
    // cinza). Usado nas 3 linhas: 2026×2025, consumo×Orçado, consumo×Meta.
    const devChip = (value, reference) => {
      // undefined = ainda carregando (null = carregou e não há dado)
      if (value === undefined || reference === undefined)
        return `<span style="background:${GP.tint(14)};color:${GP.accent};${CHIP_BASE}">⏳</span>`;
      if (reference == null || reference <= 0 || value == null)
        return `<span style="background:#f1f5f9;color:#64748b;${CHIP_BASE}">—</span>`;
      const pct = ((value - reference) / reference) * 100;
      const txt = Math.abs(pct).toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      if (Math.abs(pct) < APPROX_PCT)
        return `<span style="background:#f1f5f9;color:#64748b;${CHIP_BASE}">&#8776; ${txt}%</span>`; // ≈
      if (pct > 0)
        return `<span style="background:#fee2e2;color:#b91c1c;${CHIP_BASE}">&#8593; ${txt}%</span>`; // ↑
      return `<span style="background:#dcfce7;color:#15803d;${CHIP_BASE}">&#8595; ${txt}%</span>`; // ↓
    };

    // Última renderização — fonte de dados do export PDF
    let lastRows = null;
    let lastUnit = '';

    // Ordenação do Resumo por shopping: null = ordem original; dir 1 asc / -1 desc
    // DEFAULT: Dt. Inauguração asc (mais antiga primeiro; sem data por último)
    let sideSortKey = 'inauguration'; // 'inauguration' | 'title' | 'consumo' | 'meta'
    let sideSortDir = 1;
    const SIDE_ORDER_LABELS = {
      inauguration: 'Data de Inauguração',
      title: 'Nome',
      consumo: 'Consumo',
      meta: 'Orçado',
    };
    const paintSideSort = () => {
      const btn = overlay.querySelector('[data-side-order]');
      if (!btn) return;
      const key = sideSortKey || 'inauguration';
      const arrow = sideSortDir === 1 ? '↑' : '↓';
      const quickTag =
        sideQuickFilter === 'over' ? ' · ↑ meta' : sideQuickFilter === 'under' ? ' · ↓ meta' : '';
      btn.textContent = `${SIDE_ORDER_LABELS[key]} ${arrow}${quickTag}`;
      const filtered = !!sideSortKey || sideQuickFilter !== 'all' || hiddenCustomers.size > 0;
      btn.style.color = filtered ? GP.accent : 'var(--gc-muted)';
      btn.style.borderColor = filtered ? GP.tint(45) : 'var(--gc-border)';
      const fbtn = overlay.querySelector('[data-side-filter]');
      if (fbtn)
        fbtn.style.background = sideQuickFilter !== 'all' || hiddenCustomers.size > 0 ? GP.tint(14) : 'transparent';
      // Enquanto os dados carregam, ordenar/filtrar não fazem sentido → desabilita.
      [btn, fbtn].forEach((b) => {
        if (!b) return;
        b.disabled = sideDataLoading;
        b.style.opacity = sideDataLoading ? '.45' : '';
        b.style.cursor = sideDataLoading ? 'not-allowed' : 'pointer';
        b.title = sideDataLoading
          ? 'Aguardando o carregamento dos dados…'
          : b.dataset.sideFilter != null
            ? 'Filtros & ordenação — buscar, excluir, filtros rápidos'
            : 'Clique para inverter (crescente/decrescente)';
      });
    };
    const sortSideRows = (rows) => {
      if (!sideSortKey) return rows;
      if (sideSortKey === 'inauguration')
        return [...rows].sort((a, b) => cmpInauguration(a, b, sideSortDir));
      const val = (r) => (sideSortKey === 'title' ? String(r.title || '') : r[sideSortKey]);
      return [...rows].sort((a, b) => {
        if (sideSortKey === 'title')
          return String(a.title).localeCompare(String(b.title), 'pt-BR') * sideSortDir;
        const va = Number.isFinite(Number(val(a))) && val(a) != null ? Number(val(a)) : -Infinity;
        const vb = Number.isFinite(Number(val(b))) && val(b) != null ? Number(val(b)) : -Infinity;
        return (va - vb) * sideSortDir;
      });
    };

    // Filtro rápido do Resumo por shopping (display da lista): 'all' | 'over' (consumo
    // acima da meta) | 'under' (abaixo). Meta efetiva = Meta (adjustedValue) quando
    // há margem RFC-0052, senão Orçado (value cru).
    let sideQuickFilter = 'all';
    let sideDataLoading = true; // enquanto os dados carregam, ordem/filtro ficam desabilitados
    const _refMetaOf = (r) => (r && r.metaAdj != null ? r.metaAdj : r && r.meta != null ? r.meta : null);
    const applySideQuickFilter = (rows) => {
      if (sideQuickFilter === 'all') return rows;
      return rows.filter((r) => {
        const ref = _refMetaOf(r);
        if (ref == null || r.consumo == null) return false;
        return sideQuickFilter === 'over' ? r.consumo > ref : r.consumo < ref;
      });
    };

    // Modal de filtros do Resumo por shopping: ordenar, filtro rápido, busca +
    // marcar/desmarcar customers (👁 = totais/gráfico). Theme via GP/--gc-*.
    const openSideFilterModal = () => {
      const rows = lastRows || [];
      const ORDERS = [
        ['inauguration', 'Data de Inauguração'],
        ['title', 'Nome'],
        ['consumo', 'Consumo'],
        ['meta', 'Orçado'],
      ];
      const _isOver = (r) => {
        const ref = _refMetaOf(r);
        return ref != null && r.consumo != null && r.consumo > ref;
      };
      const _isUnder = (r) => {
        const ref = _refMetaOf(r);
        return ref != null && r.consumo != null && r.consumo < ref;
      };
      const QUICK = [
        ['all', `Todos (${rows.length})`],
        ['over', `Estouraram a meta (${rows.filter(_isOver).length})`],
        ['under', `Abaixo da meta (${rows.filter(_isUnder).length})`],
      ];
      let lKey = sideSortKey || 'inauguration';
      let lDir = sideSortDir;
      let lQuick = hiddenCustomers.size ? '' : 'all';
      const lHidden = new Set(hiddenCustomers);
      const ov = document.createElement('div');
      ov.style.cssText =
        'position:fixed;inset:0;z-index:10001;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;font-family:Nunito,sans-serif;';
      // As CSS vars --gc-* são setadas no overlay do goals (applyModalTheme); como
      // este modal é anexado ao document.body, replicamos as vars aqui para que
      // background:var(--gc-surface) etc. resolvam (senão o modal fica invisível).
      for (let i = 0; i < overlay.style.length; i++) {
        const prop = overlay.style[i];
        if (prop.indexOf('--gc-') === 0) ov.style.setProperty(prop, overlay.style.getPropertyValue(prop));
      }
      const pill = (active) =>
        `border:1px solid ${active ? GP.tint(45) : 'var(--gc-border)'};border-radius:999px;background:${active ? GP.tint(12) : 'transparent'};color:${active ? GP.accent : 'var(--gc-muted)'};padding:4px 12px;cursor:pointer;font:700 11px Nunito,sans-serif;`;
      const render = () => {
        ov.innerHTML = `
          <div style="background:var(--gc-surface);color:var(--gc-text);border-radius:14px;width:min(460px,calc(100% - 32px));max-height:86vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;background:linear-gradient(135deg,${GP.accentDark},${GP.accent});color:${GP.accentText};">
              <strong style="font:700 14px Nunito,sans-serif;">⚙️ Filtros & Ordenação</strong>
              <button type="button" data-x aria-label="Fechar" style="border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer;line-height:1;">✕</button>
            </div>
            <div style="padding:14px 16px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;">
              <div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
                  <span style="font:700 11px Nunito,sans-serif;color:var(--gc-muted);">Ordenar por</span>
                  <button type="button" data-dir style="${pill(false)}">${lDir === 1 ? '↑ Crescente' : '↓ Decrescente'}</button>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${ORDERS.map(([k, l]) => `<button type="button" data-ord="${k}" style="${pill(lKey === k)}">${l}</button>`).join('')}
                </div>
              </div>
              <div>
                <div style="font:700 11px Nunito,sans-serif;color:var(--gc-muted);margin-bottom:6px;">Filtro rápido <span style="font-weight:600;">— seleciona os ${_escHtml(_entPLow())} do grupo</span></div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${QUICK.map(([k, l]) => `<button type="button" data-quick="${k}" style="${pill(lQuick === k)}">${l}</button>`).join('')}
                </div>
              </div>
              <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                  <span style="font:700 11px Nunito,sans-serif;color:var(--gc-muted);">Na visão (totais e gráfico)</span>
                  <button type="button" data-all style="border:0;background:transparent;color:${GP.accent};cursor:pointer;font:700 10.5px Nunito,sans-serif;">Marcar/desmarcar todos</button>
                </div>
                <input type="text" data-search placeholder="Buscar ${_escHtml(_entSLow())}…" style="width:100%;box-sizing:border-box;border:1px solid var(--gc-input-border);border-radius:8px;padding:6px 10px;font:600 12px Nunito,sans-serif;color:var(--gc-text);background:var(--gc-surface);margin-bottom:8px;" />
                <div data-cust-list style="display:flex;flex-direction:column;gap:4px;max-height:220px;overflow-y:auto;">
                  ${rows
                    .map(
                      (r) =>
                        `<label data-cust-row="${_escHtml(String(r.tbId))}" style="display:flex;align-items:center;gap:8px;padding:5px 8px;border:1px solid var(--gc-border);border-radius:8px;cursor:pointer;font:600 12px Nunito,sans-serif;color:var(--gc-text);">
                          <input type="checkbox" data-cust-cb="${_escHtml(String(r.tbId))}" ${lHidden.has(String(r.tbId)) ? '' : 'checked'} />
                          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏢 ${_escHtml(r.title || '')}</span>
                        </label>`
                    )
                    .join('')}
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-top:1px solid var(--gc-border);">
              <button type="button" data-clear style="border:1px solid var(--gc-border);border-radius:8px;background:transparent;color:var(--gc-muted);padding:7px 14px;cursor:pointer;font:700 12px Nunito,sans-serif;">Limpar</button>
              <div style="display:flex;gap:8px;">
                <button type="button" data-cancel style="border:1px solid var(--gc-border);border-radius:8px;background:transparent;color:var(--gc-text);padding:7px 14px;cursor:pointer;font:700 12px Nunito,sans-serif;">Cancelar</button>
                <button type="button" data-apply style="border:0;border-radius:8px;background:${GP.accent};color:${GP.accentText};padding:7px 18px;cursor:pointer;font:800 12px Nunito,sans-serif;">Aplicar</button>
              </div>
            </div>
          </div>`;
      };
      render();
      document.body.appendChild(ov);
      const closeOv = () => ov.remove();
      ov.addEventListener('input', (e) => {
        const t = e.target;
        if (t.dataset && t.dataset.search != null && t.tagName === 'INPUT' && t.type === 'text') {
          const q = t.value.toLowerCase();
          ov.querySelectorAll('[data-cust-row]').forEach((el) => {
            el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
          });
        }
        if (t.dataset && t.dataset.custCb != null) {
          const id = t.dataset.custCb;
          if (t.checked) lHidden.delete(id);
          else lHidden.add(id);
          lQuick = ''; // seleção manual desmarca o realce do filtro rápido
          ov.querySelectorAll('[data-quick]').forEach((b) => b.setAttribute('style', pill(false)));
        }
      });
      ov.addEventListener('click', (e) => {
        const ord = e.target.closest('[data-ord]');
        if (ord) {
          lKey = ord.dataset.ord;
          render();
          return;
        }
        if (e.target.closest('[data-dir]')) {
          lDir = -lDir;
          render();
          return;
        }
        const q = e.target.closest('[data-quick]');
        if (q) {
          lQuick = q.dataset.quick;
          // Filtro rápido = marca só os customers do grupo (estouraram/abaixo), desmarca o resto.
          lHidden.clear();
          if (lQuick === 'over') rows.forEach((r) => !_isOver(r) && lHidden.add(String(r.tbId)));
          else if (lQuick === 'under') rows.forEach((r) => !_isUnder(r) && lHidden.add(String(r.tbId)));
          render();
          return;
        }
        if (e.target.closest('[data-all]')) {
          const anyVisible = rows.some((r) => !lHidden.has(String(r.tbId)));
          rows.forEach((r) => {
            if (anyVisible) lHidden.add(String(r.tbId));
            else lHidden.delete(String(r.tbId));
          });
          lQuick = anyVisible ? '' : 'all';
          render();
          return;
        }
        if (e.target.closest('[data-clear]')) {
          lKey = 'inauguration';
          lDir = 1;
          lQuick = 'all';
          lHidden.clear();
          render();
          return;
        }
        if (e.target.closest('[data-cancel]') || e.target.closest('[data-x]') || e.target === ov) return closeOv();
        if (e.target.closest('[data-apply]')) {
          sideSortKey = lKey;
          sideSortDir = lDir;
          hiddenCustomers.clear();
          lHidden.forEach((id) => hiddenCustomers.add(id));
          if (lastRows) renderTable(lastRows, lastUnit);
          loadEvo();
          closeOv();
          return;
        }
      });
    };

    // Sidebar compacta: 1 card por shopping em 3 linhas, cada uma iniciada pelo ícone
    // do domínio + chip de desvio (só seta ↑/↓/≈ + %): L1 = ano-1×ano (consumo);
    // L2 = Orçado (r.meta = value cru); L3 = Meta (r.metaAdj = adjustedValue, omitida
    // quando == Orçado). Addendum A: ⚠ (InfoTooltip com os buracos de cobertura) na
    // linha do Orçado e badge "(N)" junto ao título quando DEVICE.
    const renderTable = (rows, unit) => {
      lastRows = rows;
      lastUnit = unit;
      const loading = rows.some(
        (r) => r.meta === undefined || r.consumo === undefined || r.consumoPrev === undefined
      );
      sideDataLoading = loading;
      // Total só soma os customers VISÍVEIS (👁 da sidebar) — ocultos ficam na lista
      // (esmaecidos), mas fora dos totais e do gráfico.
      const visRows = rows.filter((r) => !isCustHidden(r.tbId));
      const totalOrcado = visRows.reduce((s, r) => s + (r.meta || 0), 0);
      const totalMetaAdj = visRows.reduce((s, r) => s + (r.metaAdj || 0), 0);
      const totalCons = visRows.reduce((s, r) => s + (r.consumo || 0), 0);
      const totalConsPrev = visRows.reduce((s, r) => s + (r.consumoPrev || 0), 0);
      const fmtCell = (v) => (v === undefined ? '⏳' : _fmtQtyStr(v, unit));
      // Linha 1 = <ícone> <ano-1> <cons> · <ano> <cons> (2025 primeiro, 2026 depois;
      // UM ícone do domínio no começo — ⚡ energia / 💧 água). Linhas 2/3 idem ícone.
      const yCur = isoLocalDay(period.startISO).slice(0, 4);
      const yPrev = String(Number(yCur) - 1);
      const domIcon = domainKey === 'water' ? '💧' : '⚡';
      const gapWarn = (r, i) =>
        r && r.metaGaps
          ? `<span data-gap-row="${i}" title="Meta incompleta" style="cursor:help;font-size:11px;line-height:1;">⚠️</span>`
          : '';
      // Anos DEVICE-granular: "(N)" pequeno junto ao TÍTULO (N = medidores de
      // entrada) — substitui o antigo chip "Por medidor (N)" da linha do Orçado.
      const devCountBadge = (r) =>
        r && r.metaGranularity === 'DEVICE' && r.metaDevices > 0
          ? `<span title="Metas por medidor de entrada (granularidade DEVICE)" style="font:700 10px Nunito,sans-serif;color:var(--gc-muted);flex:0 0 auto;">(${r.metaDevices})</span>`
          : '';
      // Meta só ganha a 3ª linha/chip quando difere do Orçado (margem RFC-0052);
      // sem margem elas coincidem → linha omitida para não repetir o mesmo número.
      const metaDiffers = (orcado, metaAdj) =>
        metaAdj != null && orcado != null && Math.abs(Number(metaAdj) - Number(orcado)) > 0.5;
      const bval = (v) => `<b style="color:var(--gc-text2);">${fmtCell(v)}</b>`;
      const line = (leftHtml, chipHtml) => `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div style="font:600 11px Nunito,sans-serif;color:var(--gc-muted);display:flex;align-items:center;gap:5px;flex-wrap:nowrap;white-space:nowrap;overflow:hidden;min-width:0;">${leftHtml}</div>
            ${chipHtml}
          </div>`;
      // 👁 por customer: botão show/hide no canto superior direito, na linha do título.
      // Default = show (👁️). Oculto (🙈) → row esmaecida e fora dos totais/gráfico.
      const custEye = (r, bold) => {
        if (bold || r.tbId == null) return '';
        const hidden = isCustHidden(r.tbId);
        return `<button type="button" data-cust-eye="${_escHtml(String(r.tbId))}" title="${hidden ? 'Exibir' : 'Ocultar'} nos totais e no gráfico" style="margin-left:auto;flex:0 0 auto;border:0;background:transparent;cursor:pointer;padding:0 0 0 6px;font-size:13px;line-height:1;${hidden ? 'opacity:.55;' : ''}">${hidden ? '🙈' : '👁️'}</button>`;
      };
      const item = (title, r, bold, extras = '', bgStyle = '') => {
        const showMeta = metaDiffers(r.meta, r.metaAdj);
        const hidden = !bold && isCustHidden(r.tbId);
        // Linhas de shopping viram "card" com hover/zoom (classe gc-side-item);
        // a linha Total (bold) fica estática. bgStyle sobrepõe o fundo (Total usa
        // leve destaque do theme via GP.tint).
        const bg = bgStyle || (bold ? 'background:var(--gc-surface2);' : '');
        return `
        <div class="${bold ? '' : 'gc-side-item'}" style="border:1px solid var(--gc-border);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:5px;${bg}${hidden ? 'opacity:.5;' : ''}">
          <div style="display:flex;align-items:center;gap:4px;min-width:0;font:${bold ? 800 : 700} 12px Nunito,sans-serif;color:var(--gc-text);">
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">${bold ? '' : '🏢 '}${_escHtml(title)}</span>
            ${devCountBadge(r)}
            ${custEye(r, bold)}
          </div>
          ${line(`${domIcon} <span style="color:${CGC_PREV_COLOR};font-weight:700;">${yPrev}</span> ${bval(r.consumoPrev)}<span style="margin-left:8px;color:${CGC_REALIZADO_COLOR};font-weight:700;">${yCur}</span> ${bval(r.consumo)}`, devChip(r.consumo, r.consumoPrev))}
          ${line(`${domIcon} <span style="color:${CGC_ORCADO_COLOR};font-weight:700;">Orçado</span> ${bval(r.meta)}${extras}`, devChip(r.consumo, r.meta))}
          ${showMeta ? line(`${domIcon} <span style="color:${CGC_META_COLOR};font-weight:700;">Meta</span> ${bval(r.metaAdj)}`, devChip(r.consumo, r.metaAdj)) : ''}
        </div>`;
      };
      const sorted = sortSideRows(applySideQuickFilter(rows));
      tableEl.innerHTML = sorted.length
        ? sorted.map((r, i) => item(r.title, r, false, gapWarn(r, i))).join('')
        : `<div style="padding:14px 8px;text-align:center;font:600 11px Nunito,sans-serif;color:var(--gc-muted);">Nenhum ${_escHtml(_entSLow())} no filtro selecionado.</div>`;
      // Total fixo no rodapé da sidebar (fora da lista rolável), com leve destaque
      // do theme (GP.tint) — não some quando a lista rola.
      if (totalEl)
        totalEl.innerHTML = item(
          `Total${loading ? ' (parcial)' : ''}`,
          loading
            ? { consumo: undefined, consumoPrev: undefined, meta: undefined, metaAdj: undefined }
            : {
                consumo: totalCons || null,
                consumoPrev: totalConsPrev || null,
                meta: totalOrcado || null,
                metaAdj: totalMetaAdj || null,
              },
          true,
          '',
          `background:${GP.tint(14)};border-color:${GP.tint(45)};`
        );
      // ⚠ → InfoTooltip da lib com os refs faltantes (re-bind a cada render: o
      // innerHTML acima descarta o DOM anterior junto com os listeners).
      const IT = MyIOLibrary?.InfoTooltip;
      if (IT?.attach) {
        tableEl.querySelectorAll('[data-gap-row]').forEach((el) => {
          const r = sorted[Number(el.dataset.gapRow)];
          if (!r?.metaGaps) return;
          try {
            IT.attach(el, () => ({
              icon: '⚠️',
              title: `Meta incompleta — ${r.title || ''}`,
              content: `<div style="font-size:12px;line-height:1.55;color:#334155;">${_escHtml(_gapsTextPt(r.metaGaps))}</div>`,
            }));
          } catch {
            /* tooltip é enfeite — nunca pode quebrar a sidebar */
          }
        });
      }
      paintSideSort();
    };

    const load = async () => {
      const seq = ++reqSeq;
      const cfg = GOALS_COMPARE_DOMAINS[domainKey];
      const startISO = period.startISO;
      const endISO = period.endISO;
      paintTabs();

      // Render progressivo: sidebar aparece já com todos os shoppings em "carregando".
      // Metas (GCDR, rápidas) preenchem por card; consumo chega de uma vez.
      // undefined = carregando; null = sem dado.
      const rows = shoppings.map((s) => ({
        title: s.title,
        tbId: s.tbId != null ? String(s.tbId) : null, // chave do 👁 show/hide por customer
        meta: undefined, // Orçado (value cru)
        metaAdj: undefined, // Meta (adjustedValue)
        consumo: undefined, // Consumo do ano corrente
        consumoPrev: undefined, // Consumo A-1 (mesmo período, ano anterior)
        ingestionId: null,
        inaugurationDate: s.inaugurationDate || null, // ordenação default (Dt. Inauguração)
      }));
      // Mesmo período no ano-1 (A-1): desloca o ano de start/end (fiel ao loadEvo)
      const s0 = isoLocalDay(startISO);
      const e0 = isoLocalDay(endISO);
      const prevStartISO = `${Number(s0.slice(0, 4)) - 1}${s0.slice(4)}T00:00:00-03:00`;
      const prevEndISO = `${Number(e0.slice(0, 4)) - 1}${e0.slice(4)}T23:59:59-03:00`;
      const refresh = () => {
        const metasPend = rows.filter((r) => r.meta === undefined).length;
        const consPend = rows.some((r) => r.consumo === undefined);
        statusEl.textContent =
          metasPend || consPend
            ? `Carregando…${metasPend ? ` metas ${rows.length - metasPend}/${rows.length}` : ''}${consPend ? ' · consumo ⏳' : ''}`
            : cfg.label.replace(/^\S+\s/, ''); // período já aparece no calendário — não repetir
        renderTable(rows, cfg.unit);
      };
      refresh();

      // Attrs primeiro (cacheados após a 1ª vez): ingestionId casa consumo↔shopping
      await Promise.all(
        shoppings.map(async (s, i) => {
          const attrs = await getCustomerAttrs(s.tbId);
          rows[i].ingestionId = attrs?.ingestionId || null;
          rows[i]._attrs = attrs;
        })
      );

      if (seq !== reqSeq) return;

      // Meta do período = soma das metas diárias do range (createDateRangePicker)
      const goalsP = Promise.all(
        rows.map(async (row) => {
          const res = await metaForPeriod(row._attrs, cfg).catch(() => null);
          if (seq !== reqSeq) return;
          row.meta = res ? res.orcado : null; // Orçado (value cru)
          row.metaAdj = res ? res.meta : null; // Meta (adjustedValue, margem RFC-0052)
          // Addendum A: ⚠ cobertura incompleta + badge "(N)" no título da sidebar
          row.metaGaps = res?.gaps || null;
          row.metaGranularity = res?.granularity || null;
          row.metaDevices = res?.devicesCount || 0;
          refresh();
        })
      );
      // Energia: só medidores de ENTRADA (régua das metas); Água: todos os hidrômetros
      const consFetch = (a, b) =>
        domainKey === 'energy'
          ? fetchEntradaTotalsByCustomer(a, b)
          : fetchAllCustomersConsumption(cfg.api, a, b);
      const consP = consFetch(startISO, endISO)
        .catch(() => null)
        .then((byCustomer) => {
          if (seq !== reqSeq) return;
          rows.forEach((r) => {
            r.consumo = byCustomer ? (byCustomer.get(r.ingestionId) ?? null) : null;
          });
          refresh();
        });
      // A-1: mesmo período no ano anterior (chip "<ano> ↑/↓ %" da 1ª linha)
      const consPrevP = consFetch(prevStartISO, prevEndISO)
        .catch(() => null)
        .then((byCustomer) => {
          if (seq !== reqSeq) return;
          rows.forEach((r) => {
            r.consumoPrev = byCustomer ? (byCustomer.get(r.ingestionId) ?? null) : null;
          });
          refresh();
        });
      await Promise.all([goalsP, consP, consPrevP]);
    };

    const paintEvoGrans = () => {
      const t = GC_THEMES[modalTheme];
      const rangeDays = daysInPeriod().length;
      overlay.querySelectorAll('[data-gran]').forEach((b) => {
        const active = b.dataset.gran === evoGran;
        // Hora só para intervalos de até 15 dias (senão seriam centenas de buckets)
        const disabled = b.dataset.gran === '1h' && rangeDays > 15;
        b.disabled = disabled;
        b.title = disabled ? 'Hora: disponível para intervalos de até 15 dias' : '';
        b.style.opacity = disabled ? '.4' : '1';
        b.style.cursor = disabled ? 'not-allowed' : 'pointer';
        b.style.background = active ? t.pillActiveBg : 'transparent';
        b.style.color = active ? t.pillActiveTx : t.muted;
        b.style.boxShadow = active ? '0 1px 4px rgba(0,0,0,.15)' : 'none';
      });
      const isSepGroup = evoMode === 'stack' || evoMode === 'sep' || evoMode === 'cards';
      const paintPill = (b, active) => {
        b.style.background = active ? t.pillActiveBg : 'transparent';
        b.style.color = active ? t.pillActiveTx : t.muted;
        b.style.boxShadow = active ? '0 1px 4px rgba(0,0,0,.15)' : 'none';
      };
      overlay.querySelectorAll('[data-mode]').forEach((b) => paintPill(b, b.dataset.mode === evoMode));
      overlay.querySelectorAll('[data-modegroup]').forEach((b) => paintPill(b, isSepGroup));
      overlay.querySelectorAll('[data-submode]').forEach((b) => paintPill(b, b.dataset.submode === evoMode));
      const sub = overlay.querySelector('[data-sep-submodes]');
      if (sub) sub.style.display = isSepGroup ? 'flex' : 'none';
      const gear = overlay.querySelector('[data-cards-settings]');
      if (gear) gear.style.display = evoMode === 'cards' ? '' : 'none';
      // Granularidade não afeta a tabela analítica (totais do período)
      const grans = overlay.querySelector('[data-evo-grans]');
      if (grans) grans.style.display = evoMode === 'analytics' ? 'none' : 'flex';
    };

    // 👁 Toggles de visibilidade por ano (2026 × 2025) — filtram gráfico, cards e analítico
    // 👁 Toggles de ano dentro da LEGENDA do gráfico (linha de baixo). Formato:
    // 2025 <ícone> | 2026 <ícone> | <hint>. Divisória sutil = border-top do [data-evo-legend].
    const paintYearToggles = (yearCur, yearPrev) => {
      const box = overlay.querySelector('[data-year-toggles]');
      if (!box) return;
      box.style.display = 'inline-flex';
      const eye = (on) => (on ? '👁️' : '<span style="opacity:.55;">👁️</span>');
      const yearSpan = (label, on, key) =>
        `<button type="button" data-eye="${key}" title="${on ? 'Ocultar' : 'Exibir'} ${label}" style="border:0;background:transparent;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font:700 12px Nunito,sans-serif;color:var(--gc-text2);${on ? '' : 'opacity:.4;text-decoration:line-through;'}">${label} ${eye(on)}</button>`;
      const sep = `<span style="color:var(--gc-border);font-weight:400;">|</span>`;
      box.innerHTML =
        `${yearSpan(yearPrev, showPrevYear, 'prev')}${sep}${yearSpan(yearCur, showCurYear, 'cur')}${sep}` +
        `<span style="font:italic 600 10.5px Nunito,sans-serif;color:var(--gc-muted2);">clique no ano para exibir/ocultar</span>`;
    };

    // ── RFC-0217: modo Cards — small multiples por shopping (createCustomerGoalsCard) ──
    let goalsCards = [];
    let lastCardsRender = null; // { fn, args } — re-render dos cards sem refetch (⚙️ Exibir card Consolidado)
    const destroyGoalsCards = () => {
      goalsCards.forEach((c) => {
        try {
          c.destroy();
        } catch {
          /* já destruído */
        }
      });
      goalsCards = [];
    };
    // Controla qual superfície aparece: 'chart' (canvas único) | 'cards' | 'analytics'.
    // No analítico o aside (Resumo por shopping) some — a tabela já traz tudo.
    const showEvoSurface = (surface) => {
      const grid = overlay.querySelector('[data-cards-grid]');
      const legend = overlay.querySelector('[data-cards-legend]');
      const wrap = overlay.querySelector('[data-evo-wrap]');
      const analytics = overlay.querySelector('[data-analytics]');
      const aside = overlay.querySelector('[data-side]');
      const caption = overlay.querySelector('[data-caption]');
      if (grid) grid.style.display = surface === 'cards' ? 'grid' : 'none';
      if (legend) legend.style.display = surface === 'cards' ? 'flex' : 'none';
      if (wrap) wrap.style.display = surface === 'chart' ? '' : 'none';
      if (analytics) analytics.style.display = surface === 'analytics' ? '' : 'none';
      // Sidebar "Resumo por shopping" SEMPRE visível (inclusive no Resumo Analítico) —
      // é de lá que se comanda o 👁 show/hide por customer.
      if (aside) aside.style.display = '';
      if (caption) caption.style.display = surface === 'analytics' ? 'none' : '';
      if (surface !== 'cards') destroyGoalsCards();
    };
    const showCardsGrid = (on) => showEvoSurface(on ? 'cards' : 'chart');

    // Spinner de carregamento sobre a área do gráfico/cards/analítico
    const setEvoLoading = (on) => {
      const l = overlay.querySelector('[data-evo-loading]');
      if (l) l.style.display = on ? 'flex' : 'none';
    };
    const renderGoalsCardsGrid = (args) => {
      const {
        labels,
        shops,
        curBy,
        prevBy,
        goalOf,
        goalRawOf,
        trees,
        bucketize,
        yearCurLabel,
        yearPrevLabel,
        unit,
      } = args;
      lastCardsRender = { fn: renderGoalsCardsGrid, args };
      const grid = overlay.querySelector('[data-cards-grid]');
      const legend = overlay.querySelector('[data-cards-legend]');
      if (!grid) return;
      showCardsGrid(true);
      grid.innerHTML = '';
      if (!MyIOLibrary?.createCustomerGoalsCard) {
        grid.innerHTML =
          '<div style="font:600 12px Nunito,sans-serif;color:var(--gc-muted);padding:12px;">Modo Cards indisponível — atualize a myio-js-library (createCustomerGoalsCard).</div>';
        if (legend) legend.innerHTML = '';
        return;
      }
      const nullSeries = () => labels.map(() => null);
      const sumSeries = (arrs) =>
        arrs.reduce((acc, arr) => {
          (arr || []).forEach((v, i) => {
            if (v == null || Number.isNaN(Number(v))) return;
            acc[i] = (acc[i] || 0) + Number(v);
          });
          return acc;
        }, nullSeries());
      shops.forEach((s, i) => {
        if (isCustHidden(s.tbId)) return; // 👁 customer oculto → sem card
        goalsCards.push(
          MyIOLibrary.createCustomerGoalsCard({
            container: grid,
            title: s.title,
            unit,
            yearLabels: { current: yearCurLabel, previous: yearPrevLabel },
            themeMode: modalTheme,
            options: { chartType: cardsChartType, showPoints: cardsShowPoints, colors: { breakdownPalette: GP_TONES || undefined } },
            series: {
              labels,
              // 👁: ano oculto some dos dados (realized vira gaps; A-1 é omitida por completo)
              realized: showCurYear ? bucketize(curBy?.get(s.ingestionId)) : labels.map(() => null),
              previousYear: showPrevYear ? bucketize(prevBy?.get(s.ingestionId)) : undefined,
              budget: goalOf(trees[i]), // Meta (adjustedValue)
              orcado: goalRawOf ? goalRawOf(trees[i]) : undefined, // Orçado (value cru)
            },
          })
        );
      });
      // Consolidado respeita o 👁 por customer: só soma os shoppings visíveis
      const visShops = shops.filter((s) => !isCustHidden(s.tbId));
      const visTrees = trees.filter((_, i) => !isCustHidden(shops[i].tbId));
      // ⚙️ Exibir card Consolidado: soma de todos os shoppings como se fosse um
      // shopping — sempre o ÚLTIMO card da grid. Meta = soma das metas.
      if (cardsShowConsolidated) {
        goalsCards.push(
          MyIOLibrary.createCustomerGoalsCard({
            container: grid,
            title: 'Consolidado',
            unit,
            yearLabels: { current: yearCurLabel, previous: yearPrevLabel },
            themeMode: modalTheme,
            options: { chartType: cardsChartType, showPoints: cardsShowPoints, colors: { breakdownPalette: GP_TONES || undefined } },
            series: {
              labels,
              realized: showCurYear
                ? sumSeries(visShops.map((s) => bucketize(curBy?.get(s.ingestionId))))
                : nullSeries(),
              previousYear: showPrevYear
                ? sumSeries(visShops.map((s) => bucketize(prevBy?.get(s.ingestionId))))
                : undefined,
              budget: sumSeries((visTrees || []).map((t) => goalOf(t))), // Meta
              orcado: goalRawOf
                ? sumSeries((visTrees || []).map((t) => goalRawOf(t)))
                : undefined, // Orçado (value cru)
            },
          })
        );
      }
      // Legenda compartilhada (uma só, como no painel de referência) — respeita os 👁
      if (legend) {
        const item = (swatch, label) =>
          `<span style="display:inline-flex;align-items:center;gap:6px;">${swatch}<span>${label}</span></span>`;
        const dot = (color) =>
          `<span style="width:22px;height:0;border-top:3px solid ${color};border-radius:2px;display:inline-block;"></span>`;
        const dash = (color) =>
          `<span style="width:22px;height:0;border-top:3px dashed ${color};display:inline-block;"></span>`;
        legend.innerHTML =
          (showPrevYear ? item(dot('#94a3b8'), `A-1 (${yearPrevLabel})`) : '') +
          (showCurYear ? item(dot(CGC_REALIZADO_COLOR), `Realizado (${yearCurLabel})`) : '') +
          item(dash(CGC_META_COLOR), `Meta (${yearCurLabel})`) +
          (goalRawOf ? item(dash(CGC_ORCADO_COLOR), `Orçado (${yearCurLabel})`) : '');
      }
    };

    // ── Cards agrupados por DISPOSITIVO (⚙️ Agrupado por: Dispositivos) ──────────
    // SEMPRE 1 card por shopping (nunca 1 por medidor): a opção só quebra o
    // GRÁFICO por medidor de entrada (series.breakdown do CustomerGoalsCard —
    // energia: medidores curados; água: hidrômetros de entrada). A linha de
    // Orçado permanece — meta é do shopping, que continua sendo o card.
    // Labels de device do TB por customer (name → label), 1 REST por shopping,
    // cacheado na sessão. A API do INGESTION não tem conceito de label (só o
    // name técnico "3F SC..._Trafo_Entrada_L2 x1650 ..."), e o datasource do HO
    // não contém todos os medidores de entrada — o label amigável ("Medição
    // Geral") vive no device do ThingsBoard (ou no GCDR) do shopping filho.
    const _tbDeviceLabelCache = new Map(); // tbCustomerId -> Promise<Map<name, label>>
    const getTbDeviceLabelMap = (tbId) => {
      if (!tbId) return Promise.resolve(new Map());
      if (_tbDeviceLabelCache.has(tbId)) return _tbDeviceLabelCache.get(tbId);
      const p = (async () => {
        const jwt = localStorage.getItem('jwt_token') || '';
        const map = new Map();
        try {
          for (let page = 0; page < 3; page++) {
            const res = await fetch(`/api/customer/${tbId}/devices?pageSize=1000&page=${page}`, {
              headers: { 'X-Authorization': `Bearer ${jwt}` },
            });
            if (!res.ok) break;
            const pg = await res.json();
            (pg?.data || []).forEach((d) => {
              if (d?.name && d?.label) map.set(d.name, d.label);
            });
            if (!pg?.hasNext) break;
          }
        } catch {
          /* segue sem labels TB */
        }
        return map;
      })();
      _tbDeviceLabelCache.set(tbId, p);
      return p;
    };
    // Fallback: limpa o name técnico da API do Ingestion ("... x1650 x20A x90.5V" → sem sufixos)
    const cleanIngestionName = (n) =>
      String(n || '')
        .replace(/(\s+x[\d.,]+[A-Za-z.%]*)+$/i, '')
        .trim();
    // Convenção de troca de central: o device antigo vira "3.F.OLD <resto>" na
    // ingestion (e "<name>.old" no TB) — normaliza para casar com o device TB
    // atual e herdar o label amigável ("Medição Geral").
    const normOldName = (n) =>
      cleanIngestionName(n)
        .replace(/^3\.?F\.?OLD\s+/i, '3F ')
        .replace(/\.old$/i, '')
        .trim();

    const listCardDevices = async () => {
      if (domainKey === 'energy') {
        const devs = await getEntradaDevices();
        // 1) Label do datasource TB do HO — TODOS os domínios/grupos (o medidor
        //    pode estar classificado fora de energy.entrada)
        const nameByIng = new Map();
        const classified = window.MyIOOrchestratorData?.classified || {};
        for (const dom of Object.values(classified)) {
          for (const arr of Object.values(dom || {})) {
            (arr || []).forEach((d) => {
              if (d?.ingestionId && !nameByIng.has(d.ingestionId)) {
                nameByIng.set(d.ingestionId, d.labelOrName || d.label || d.name);
              }
            });
          }
        }
        // 2) Label do device no TB do shopping filho (REST por customer, cacheado)
        const tbIdByIng = new Map();
        const cards = (_currentCustomersCards || []).filter(
          (c) => c.entityType === 'CUSTOMER' && (c.customerId || c.entityId)
        );
        await Promise.all(
          cards.map(async (c) => {
            const attrs = await getCustomerAttrs(c.customerId || c.entityId).catch(() => ({}));
            if (attrs?.ingestionId) tbIdByIng.set(attrs.ingestionId, c.customerId || c.entityId);
          })
        );
        const labelMaps = new Map(); // tbId -> Map<name, label>
        await Promise.all(
          [...new Set(devs.map((d) => tbIdByIng.get(d.customerId)).filter(Boolean))].map(async (tbId) => {
            labelMaps.set(tbId, await getTbDeviceLabelMap(tbId));
          })
        );
        return devs.map((d, i) => {
          const tbMap = labelMaps.get(tbIdByIng.get(d.customerId));
          const name =
            nameByIng.get(d.id) ||
            tbMap?.get(d.name) ||
            tbMap?.get(cleanIngestionName(d.name)) ||
            tbMap?.get(normOldName(d.name)) ||
            cleanIngestionName(d.name) ||
            `Entrada ${i + 1}`;
          return { id: d.id, customerId: d.customerId || null, name };
        });
      }
      // Água: hidrômetros de entrada classificados (RFC-0111)
      return (window.MyIOOrchestratorData?.classified?.water?.hidrometro_entrada || [])
        .filter((d) => d.ingestionId)
        .map((d) => ({
          id: d.ingestionId,
          customerId: d.customerIngestionId || null,
          name: d.labelOrName || d.label || d.name || 'Hidrômetro',
        }));
    };

    const renderGoalsDeviceCardsGrid = (args) => {
      const {
        labels,
        devices,
        curDev,
        prevDev,
        bucketize,
        yearCurLabel,
        yearPrevLabel,
        unit,
        shops,
        trees,
        goalOf,
        goalRawOf,
        // Addendum A (anos DEVICE): GET /goals completo por shopping e trees por
        // medidor (?deviceId=) buscadas lazy no modo "Dispositivos separados".
        goalsAll,
        goalDevTrees,
      } = args;
      lastCardsRender = { fn: renderGoalsDeviceCardsGrid, args };
      const grid = overlay.querySelector('[data-cards-grid]');
      const legend = overlay.querySelector('[data-cards-legend]');
      if (!grid) return;
      showCardsGrid(true);
      grid.innerHTML = '';
      if (!MyIOLibrary?.createCustomerGoalsCard) {
        grid.innerHTML =
          '<div style="font:600 12px Nunito,sans-serif;color:var(--gc-muted);padding:12px;">Modo Cards indisponível — atualize a myio-js-library (createCustomerGoalsCard).</div>';
        if (legend) legend.innerHTML = '';
        return;
      }
      if (!devices.length) {
        grid.innerHTML = `<div style="font:600 12px Nunito,sans-serif;color:var(--gc-muted);padding:12px;">Sem dispositivos de entrada identificáveis neste domínio — use o agrupamento por ${_escHtml(_entSLow())}.</div>`;
        if (legend) legend.innerHTML = '';
        return;
      }
      // SEMPRE um card por shopping (paridade com o agrupamento por shopping);
      // "Dispositivos" muda só o GRÁFICO: uma série por medidor (breakdown) em
      // vez da consolidada. Meta (Orçado) volta ao card — ela é por shopping.
      const shopIdxByIng = new Map((shops || []).map((s, i) => [s.ingestionId, i]));
      const shopIdxByTitle = new Map(
        (shops || []).map((s, i) => [
          String(s.title || '')
            .trim()
            .toLowerCase(),
          i,
        ])
      );
      // Nome legível do medidor: curadoria "entrada:<Shopping>" vira "Entrada".
      const deviceLabel = (d) => {
        const m = String(d.name || '').match(/^entrada:(.+)$/i);
        return m ? 'Entrada' : String(d.name || 'Medidor');
      };
      // device → shopping: customerId; fallback pela curadoria "entrada:<título>"
      const shopIdxOf = (d) => {
        if (d.customerId != null && shopIdxByIng.has(d.customerId)) return shopIdxByIng.get(d.customerId);
        const m = String(d.name || '').match(/^entrada:(.+)$/i);
        if (m) {
          const idx = shopIdxByTitle.get(m[1].trim().toLowerCase());
          if (idx != null) return idx;
        }
        return null;
      };
      const byShop = new Map(); // shopIdx -> devices[]
      const orphans = [];
      devices.forEach((d) => {
        const idx = shopIdxOf(d);
        if (idx == null) orphans.push(d);
        else (byShop.get(idx) || byShop.set(idx, []).get(idx)).push(d);
      });

      const nullSeries = () => labels.map(() => null);
      const sumSeries = (arrs) =>
        arrs.reduce((acc, arr) => {
          (arr || []).forEach((v, i) => {
            if (v == null || Number.isNaN(Number(v))) return;
            acc[i] = (acc[i] || 0) + Number(v);
          });
          return acc;
        }, nullSeries());

      const makeCard = ({ title, devs, budget, orcado, shopIdx }) => {
        // Nomes deduplicados dentro do card (#1/#2 quando o shopping tem 2 medidores iguais)
        const names = devs.map(deviceLabel);
        const count = names.reduce((acc, n) => acc.set(n, (acc.get(n) || 0) + 1), new Map());
        const seen = new Map();
        const buckets = devs.map((d) => bucketize(curDev?.get(d.id)));
        const breakdown = devs.map((d, i) => {
          let name = names[i];
          if (count.get(name) > 1) {
            const n = (seen.get(name) || 0) + 1;
            seen.set(name, n);
            name = `${name} #${n}`;
          }
          return { name, values: buckets[i] };
        });
        // ── Addendum A: metas por medidor quando o ano do shopping é DEVICE ──
        // "Dispositivos separados" → uma linha de meta POR medidor (trees ?deviceId=);
        // "Dispositivos empilhados" → meta única + tooltip com o detalhamento por
        // medidor (anual ajustado de devices[], nota "(anual)"). Ano CUSTOMER (sem
        // devices[]) → comportamento atual inalterado nas duas opções.
        let budgetBreakdown;
        let budgetDetail;
        const g = shopIdx != null ? goalsAll?.[shopIdx] : null;
        if (g?.granularity === 'DEVICE' && Array.isArray(g.devices) && g.devices.length) {
          const devTrees = goalDevTrees?.get(shopIdx);
          if (cardsGroupBy === 'device' && devTrees?.length && goalOf) {
            budgetBreakdown = devTrees.map((e) => ({ name: e.name, values: goalOf(e.tree) }));
          } else if (cardsGroupBy === 'device-stack') {
            budgetDetail = g.devices.map((gd) => ({
              name: gd.label || gd.code || 'Medidor',
              annual: gd.annualAdjusted != null ? gd.annualAdjusted : gd.annual != null ? gd.annual : null,
            }));
          }
        }
        goalsCards.push(
          MyIOLibrary.createCustomerGoalsCard({
            container: grid,
            title,
            unit,
            yearLabels: { current: yearCurLabel, previous: yearPrevLabel },
            themeMode: modalTheme,
            options: {
              chartType: cardsChartType,
              showPoints: cardsShowPoints,
              breakdownStacked: cardsGroupBy === 'device-stack',
              colors: { breakdownPalette: GP_TONES || undefined },
            },
            series: {
              labels,
              realized: showCurYear ? sumSeries(buckets) : nullSeries(),
              // >1 medidor → gráfico quebrado por device; 1 medidor → consolidado clássico
              breakdown: showCurYear && breakdown.length > 1 ? breakdown : undefined,
              previousYear: showPrevYear
                ? sumSeries(devs.map((d) => bucketize(prevDev?.get(d.id))))
                : undefined,
              // budget (Meta) consolidado segue alimentando a faixa de totais mesmo
              // com budgetBreakdown (o componente troca só a(s) linha(s) do gráfico)
              budget,
              // Orçado (value cru): UMA linha consolidada — em anos DEVICE o
              // breakdown por medidor continua sendo só a Meta (Addendum A)
              orcado,
              budgetBreakdown,
              budgetDetail,
            },
          })
        );
      };

      (shops || []).forEach((s, i) => {
        if (isCustHidden(s.tbId)) return; // 👁 customer oculto → sem card/medidores
        const devs = byShop.get(i);
        if (!devs?.length) return; // shopping sem medidor identificável neste domínio
        makeCard({
          title: s.title,
          devs,
          budget: goalOf ? goalOf(trees?.[i]) : undefined,
          orcado: goalRawOf ? goalRawOf(trees?.[i]) : undefined,
          shopIdx: i,
        });
      });
      // Medidores sem shopping identificável: um card residual (não perder dado)
      if (orphans.length) {
        makeCard({ title: `Sem ${_entSLow()} identificado`, devs: orphans, budget: undefined });
      }
      // ⚙️ Exibir card Consolidado: todos os medidores somados (sem breakdown),
      // como se a visão consolidada fosse um shopping — sempre o ÚLTIMO card.
      if (cardsShowConsolidated) {
        // Consolidado respeita o 👁: só trees/medidores de shoppings visíveis
        const visTreesD = (trees || []).filter((_, i) => !isCustHidden(shops?.[i]?.tbId));
        const visDevicesD = devices.filter((d) => {
          const idx = shopIdxOf(d);
          return idx == null || !isCustHidden(shops?.[idx]?.tbId);
        });
        const budgetArrs = visTreesD.map((t) => (goalOf ? goalOf(t) : null));
        const orcadoArrs = visTreesD.map((t) => (goalRawOf ? goalRawOf(t) : null));
        goalsCards.push(
          MyIOLibrary.createCustomerGoalsCard({
            container: grid,
            title: 'Consolidado',
            unit,
            yearLabels: { current: yearCurLabel, previous: yearPrevLabel },
            themeMode: modalTheme,
            options: { chartType: cardsChartType, showPoints: cardsShowPoints, colors: { breakdownPalette: GP_TONES || undefined } },
            series: {
              labels,
              realized: showCurYear
                ? sumSeries(visDevicesD.map((d) => bucketize(curDev?.get(d.id))))
                : nullSeries(),
              previousYear: showPrevYear
                ? sumSeries(visDevicesD.map((d) => bucketize(prevDev?.get(d.id))))
                : undefined,
              budget: sumSeries(budgetArrs), // Meta
              orcado: goalRawOf ? sumSeries(orcadoArrs) : undefined, // Orçado (value cru)
            },
          })
        );
      }

      if (legend) {
        const item = (swatch, label) =>
          `<span style="display:inline-flex;align-items:center;gap:6px;">${swatch}<span>${label}</span></span>`;
        const dot = (color) =>
          `<span style="width:22px;height:0;border-top:3px solid ${color};border-radius:2px;display:inline-block;"></span>`;
        const dash = (color) =>
          `<span style="width:22px;height:0;border-top:3px dashed ${color};display:inline-block;"></span>`;
        legend.innerHTML =
          (showPrevYear ? item(dot('#94a3b8'), `A-1 (${yearPrevLabel})`) : '') +
          item(dash(CGC_META_COLOR), `Meta (${yearCurLabel})`) +
          (goalRawOf ? item(dash(CGC_ORCADO_COLOR), `Orçado (${yearCurLabel})`) : '') +
          (showCurYear
            ? `<span style="font-style:italic;">Realizado (${yearCurLabel}) quebrado por medidor — cores na legenda de cada card</span>`
            : '');
      }
    };

    // ── Resumo Analítico — tabela do portfólio fiel a logs/026-GolsAnalitcs.png ──
    // Colunas: Realizado / A-1 / Orçado (valor + % participação), Var. vs A-1 e vs
    // Orçado (valor + %) e Performance (vs Orçado). Linha TOTAL no rodapé.
    const renderAnalyticsTable = ({
      shops,
      curBy,
      prevBy,
      trees,
      goalOf,
      bucketize,
      yearCurLabel,
      yearPrevLabel,
      unit,
    }) => {
      const host = overlay.querySelector('[data-analytics]');
      if (!host) return;
      showEvoSurface('analytics');

      const sumArr = (arr) => {
        let s = 0;
        let has = false;
        for (const v of arr || []) {
          if (v == null) continue;
          s += Number(v) || 0;
          has = true;
        }
        return has ? s : null;
      };
      // 👁 por customer: linhas ocultas saem da tabela E dos totais do portfólio
      const rows = [];
      shops.forEach((s, i) => {
        if (isCustHidden(s.tbId)) return;
        rows.push({
          title: s.title,
          realized: sumArr(bucketize(curBy?.get(s.ingestionId))),
          prev: sumArr(bucketize(prevBy?.get(s.ingestionId))),
          budget: sumArr(goalOf(trees[i])),
        });
      });
      const tot = {
        realized: rows.some((r) => r.realized != null)
          ? rows.reduce((a, r) => a + (r.realized || 0), 0)
          : null,
        prev: rows.some((r) => r.prev != null) ? rows.reduce((a, r) => a + (r.prev || 0), 0) : null,
        budget: rows.some((r) => r.budget != null) ? rows.reduce((a, r) => a + (r.budget || 0), 0) : null,
      };

      const pctPart = (v, total) =>
        v == null || !total
          ? '—'
          : `${((v / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
      const varCells = (realized, ref) => {
        if (realized == null || ref == null || ref === 0)
          return `<td style="${tdR}color:var(--gc-muted);">—</td><td style="${tdR}color:var(--gc-muted);">—</td>`;
        const diff = realized - ref;
        const pct = (diff / ref) * 100;
        const color = diff > 0 ? '#ef4444' : '#16a34a';
        const arrow = diff > 0 ? '&#8593;' : '&#8595;';
        const pctTxt = `${Math.abs(pct).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
        return `<td style="${tdR}color:${color};font-weight:700;">${diff > 0 ? '+' : '−'}${_fmtQtyStr(Math.abs(diff), unit)}</td><td style="${tdR}color:${color};font-weight:700;">${arrow} ${pctTxt}</td>`;
      };
      const perfCell = (realized, budget) => {
        if (realized == null || budget == null || budget === 0)
          return `<td style="${tdR}color:var(--gc-muted);">—</td>`;
        const pct = (realized / budget) * 100;
        const color = pct <= 100 ? '#16a34a' : pct <= 105 ? '#f59e0b' : '#ef4444';
        return `<td style="${tdR}color:${color};font-weight:800;">${pct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>`;
      };

      const th =
        'padding:7px 10px;font:700 11px Nunito,sans-serif;color:var(--gc-muted);text-align:right;white-space:nowrap;border-bottom:1px solid var(--gc-border);';
      const thL = th.replace('text-align:right', 'text-align:left');
      const tdR =
        'padding:7px 10px;font:600 12px Nunito,sans-serif;color:var(--gc-text);text-align:right;white-space:nowrap;border-bottom:1px solid var(--gc-border);';
      const tdL = tdR.replace('text-align:right', 'text-align:left');

      const groupHead = (label, span, color) =>
        `<th colspan="${span}" style="${th}text-align:center;border-left:1px solid var(--gc-border);${color ? `color:${color};` : ''}">${label}</th>`;
      const bodyRow = (r, bold) => {
        const w = bold ? 'font-weight:800;' : '';
        let cells = `<td style="${tdL}${w}">${bold ? '' : '🏢 '}${_escHtml(r.title)}</td>`;
        if (showCurYear)
          cells += `<td style="${tdR}${w}">${_fmtQtyStr(r.realized, unit)}</td><td style="${tdR}${w}color:var(--gc-muted);">${pctPart(r.realized, tot.realized)}</td>`;
        if (showPrevYear)
          cells += `<td style="${tdR}${w}">${_fmtQtyStr(r.prev, unit)}</td><td style="${tdR}${w}color:var(--gc-muted);">${pctPart(r.prev, tot.prev)}</td>`;
        cells += `<td style="${tdR}${w}">${_fmtQtyStr(r.budget, unit)}</td><td style="${tdR}${w}color:var(--gc-muted);">${pctPart(r.budget, tot.budget)}</td>`;
        if (showCurYear && showPrevYear) cells += varCells(r.realized, r.prev);
        if (showCurYear) cells += varCells(r.realized, r.budget) + perfCell(r.realized, r.budget);
        return `<tr${bold ? ' style="background:var(--gc-surface2);"' : ''}>${cells}</tr>`;
      };

      let head2 = `<th style="${thL}">Unidade</th>`;
      let head1 = '<th style="border-bottom:0;"></th>';
      if (showCurYear) {
        head1 += groupHead(`Realizado (${yearCurLabel})`, 2, CGC_REALIZADO_COLOR);
        head2 += `<th style="${th}">Valor</th><th style="${th}">% Part.</th>`;
      }
      if (showPrevYear) {
        head1 += groupHead(`A-1 (${yearPrevLabel})`, 2, CGC_PREV_COLOR);
        head2 += `<th style="${th}">Valor</th><th style="${th}">% Part.</th>`;
      }
      head1 += groupHead(`Orçado (${yearCurLabel})`, 2, CGC_ORCADO_COLOR);
      head2 += `<th style="${th}">Valor</th><th style="${th}">% Part.</th>`;
      if (showCurYear && showPrevYear) {
        head1 += groupHead('Var. vs A-1', 2);
        head2 += `<th style="${th}">Valor</th><th style="${th}">%</th>`;
      }
      if (showCurYear) {
        head1 += groupHead('Var. vs Orçado', 2) + groupHead('Performance<br>(vs Orçado)', 1);
        head2 += `<th style="${th}">Valor</th><th style="${th}">%</th><th style="${th}"></th>`;
      }

      host.innerHTML = `
        <div style="border:1px solid var(--gc-border);border-radius:12px;overflow:auto;background:var(--gc-surface);">
          <div style="padding:10px 12px 4px;font:800 13px Nunito,sans-serif;color:var(--gc-text);">Resumo do Portfólio <span style="font:600 11px Nunito,sans-serif;color:var(--gc-muted);">| Realizado, A-1 e Orçado</span></div>
          <table style="border-collapse:collapse;width:100%;min-width:760px;">
            <thead><tr>${head1}</tr><tr>${head2}</tr></thead>
            <tbody>
              ${rows.map((r) => bodyRow(r, false)).join('')}
              ${bodyRow({ title: `TOTAL PORTFÓLIO`, realized: tot.realized, prev: tot.prev, budget: tot.budget }, true)}
            </tbody>
          </table>
        </div>`;
    };

    // ⚙️ dos cards: pontos on/off e linha|barra (aplica em todos os cards abertos)
    const openCardsSettings = () => {
      const prev = overlay.querySelector('[data-cards-settings-pop]');
      if (prev) return void prev.remove(); // toggle
      const gear = overlay.querySelector('[data-cards-settings]');
      const pop = document.createElement('div');
      pop.setAttribute('data-cards-settings-pop', '1');
      pop.style.cssText =
        'position:absolute;z-index:60;background:var(--gc-surface);border:1px solid var(--gc-border);border-radius:12px;padding:12px 14px;box-shadow:0 12px 32px rgba(2,6,23,.25);display:flex;flex-direction:column;gap:10px;font:600 12px Nunito,sans-serif;color:var(--gc-text2);min-width:320px;';
      pop.innerHTML = `
        <strong style="font:800 12px Nunito,sans-serif;color:var(--gc-text);">⚙️ Configurações dos cards</strong>
        <span style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">Agrupado por:
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="gcCgcGroupBy" value="shopping" ${cardsGroupBy === 'shopping' ? 'checked' : ''} style="accent-color:${GP.accent};"> ${_escHtml(_goalsEntityLabel)}</label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;" title="Um card por ${_escHtml(_goalsEntityLabel.toLowerCase())}, gráfico quebrado por medidor de entrada — séries lado a lado"><input type="radio" name="gcCgcGroupBy" value="device" ${cardsGroupBy === 'device' ? 'checked' : ''} style="accent-color:${GP.accent};"> Dispositivos separados</label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;" title="Um card por ${_escHtml(_goalsEntityLabel.toLowerCase())}, gráfico quebrado por medidor de entrada — séries empilhadas (stack)"><input type="radio" name="gcCgcGroupBy" value="device-stack" ${cardsGroupBy === 'device-stack' ? 'checked' : ''} style="accent-color:${GP.accent};"> Dispositivos empilhados</label>
        </span>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" data-opt-points ${cardsShowPoints ? 'checked' : ''} style="accent-color:${GP.accent};width:15px;height:15px;">
          Mostrar pontos na linha
        </label>
        <span style="display:flex;align-items:center;gap:12px;">Tipo:
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="gcCgcType" value="bar" ${cardsChartType === 'bar' ? 'checked' : ''} style="accent-color:${GP.accent};"> Barra</label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="gcCgcType" value="line" ${cardsChartType === 'line' ? 'checked' : ''} style="accent-color:${GP.accent};"> Linha</label>
        </span>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;" title="Renderiza como último card a visão consolidada de todos os ${_escHtml(_entPLow())}, como se fosse um ${_escHtml(_entSLow())}">
          <input type="checkbox" data-opt-consolidated ${cardsShowConsolidated ? 'checked' : ''} style="accent-color:${GP.accent};width:15px;height:15px;">
          Exibir card Consolidado
        </label>`;
      const controls = overlay.querySelector('[data-controls]');
      controls.style.position = 'relative';
      pop.style.top = `${gear.offsetTop + gear.offsetHeight + 6}px`;
      pop.style.left = `${gear.offsetLeft}px`;
      controls.appendChild(pop);
      const apply = () => {
        cardsShowPoints = pop.querySelector('[data-opt-points]').checked;
        cardsChartType = pop.querySelector('input[name="gcCgcType"]:checked').value;
        const cons = pop.querySelector('[data-opt-consolidated]')?.checked || false;
        const consChanged = cons !== cardsShowConsolidated;
        cardsShowConsolidated = cons;
        const gb = pop.querySelector('input[name="gcCgcGroupBy"]:checked')?.value || 'shopping';
        if (gb !== cardsGroupBy) {
          // shopping ↔ device* muda a FONTE dos dados — refaz o load. Entre os
          // dois modos device (separados ↔ empilhados) a fonte é a mesma: só o
          // layout do stack muda, resolvido via setOptions abaixo (sem refetch).
          const sameSource = gb !== 'shopping' && cardsGroupBy !== 'shopping';
          cardsGroupBy = gb;
          if (!sameSource) {
            loadEvo();
            return;
          }
          // Addendum A: com algum shopping em ano DEVICE, separados ↔ empilhados
          // também muda a FORMA da meta (linhas por medidor ↔ única + tooltip) e
          // "separados" precisa das trees por medidor (fetch lazy do loadEvo, com
          // cache de promise — a troca de volta não refaz requests já resolvidos).
          const hasDeviceGoals = (lastCardsRender?.args?.goalsAll || []).some(
            (g) => g?.granularity === 'DEVICE'
          );
          if (hasDeviceGoals) {
            loadEvo();
            return;
          }
        }
        if (consChanged && lastCardsRender) {
          // adiciona/remove o card Consolidado — re-render local com os mesmos dados
          destroyGoalsCards();
          lastCardsRender.fn(lastCardsRender.args);
          return;
        }
        goalsCards.forEach((c) =>
          c.setOptions?.({
            chartType: cardsChartType,
            showPoints: cardsShowPoints,
            breakdownStacked: cardsGroupBy === 'device-stack',
          })
        );
      };
      pop.addEventListener('change', apply);
      // Fecha ao clicar fora
      const closer = (ev) => {
        if (!pop.contains(ev.target) && !ev.target.closest('[data-cards-settings]')) {
          pop.remove();
          document.removeEventListener('click', closer, true);
        }
      };
      setTimeout(() => document.addEventListener('click', closer, true), 0);
    };

    const renderEvoChart = (labels, datasets, stacked = false, tipModel = null) => {
      showCardsGrid(false);
      if (typeof window.Chart !== 'function') return;
      lastEvo = { labels, datasets, stacked, tipModel }; // p/ re-render no toggle de tema
      if (evoChart) {
        evoChart.destroy();
        evoChart = null;
      }
      const t = GC_THEMES[modalTheme];
      const axis = { ticks: { color: t.chartTick }, grid: { color: t.chartGrid } };
      // Eixo Y e tooltips com conversão de unidade (kWh -> MWh/GWh quando grande)
      const chartUnit = GOALS_COMPARE_DOMAINS[domainKey].unit;
      const yTicks = { ...axis.ticks, callback: (val) => _fmtQtyStr(val, chartUnit) };
      const tooltipCb = {
        callbacks: {
          label: (c) => `${c.dataset.label}: ${c.parsed.y == null ? '—' : _fmtQtyStr(c.parsed.y, chartUnit)}`,
        },
      };
      // Tooltip premium (tree-driven) — criado uma vez, sob demanda. Fail-open: se a
      // lib não expõe createGoalsBarTooltip, cai no tooltip built-in do Chart.js.
      if (!evoTip && MyIOLibrary && typeof MyIOLibrary.createGoalsBarTooltip === 'function') {
        try { evoTip = MyIOLibrary.createGoalsBarTooltip({ accentColor: GP.accent }); }
        catch { evoTip = null; }
      }
      const externalTip = evoTip && tipModel
        ? (context) => {
            try {
              const tt = context && context.tooltip;
              if (!tt || tt.opacity === 0) { evoTip.hide(); return; }
              const dp = tt.dataPoints && tt.dataPoints[0];
              if (!dp) return;
              const idx = dp.dataIndex;
              const rect = context.chart.canvas.getBoundingClientRect();
              evoTip.show(
                { title: tipModel.title(idx), rows: tipModel.rows(idx, datasets), accentColor: tipModel.accent },
                { clientX: rect.left + tt.caretX, clientY: rect.top + tt.caretY }
              );
            } catch (_) { /* tooltip é enfeite — nunca quebra o chart */ }
          }
        : null;
      evoChart = new window.Chart(evoCanvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 10 }, color: t.chartTick } },
            tooltip: externalTip ? { enabled: false, external: externalTip } : tooltipCb,
          },
          scales: stacked
            ? {
                x: { stacked: true, ...axis },
                y: { stacked: true, beginAtZero: true, grid: axis.grid, ticks: yTicks },
              }
            : { x: { ...axis }, y: { beginAtZero: true, grid: axis.grid, ticks: yTicks } },
        },
      });
    };

    const loadEvo = async () => {
      const seq = ++evoSeq;
      const cfgD = GOALS_COMPARE_DOMAINS[domainKey];
      const isEnergy = domainKey === 'energy';
      const yearSel = Number(isoLocalDay(period.startISO).slice(0, 4));
      const periodDays = daysInPeriod();
      if (evoGran === '1h' && periodDays.length > 15) evoGran = '1d'; // Hora indisponível p/ ranges longos
      paintEvoGrans();
      paintYearToggles(String(yearSel), String(yearSel - 1));
      setEvoLoading(true);
      const nowD = new Date();
      const yearGoals = yearSel;

      const attrsList = await Promise.all(shoppings.map((s) => getCustomerAttrs(s.tbId)));
      if (seq !== evoSeq) return;
      const shops = shoppings.map((s, i) => ({
        title: s.title,
        tbId: s.tbId != null ? String(s.tbId) : null, // chave do 👁 show/hide por customer
        ingestionId: attrsList[i]?.ingestionId || null,
        attrs: attrsList[i],
      }));
      // 👁: ingestionIds visíveis — usado pela agregação consolidada (energia é por
      // customer; água consolidada '__ALL__' é uma série única e passa direto).
      const visIngSet = new Set(shops.filter((s) => !isCustHidden(s.tbId)).map((s) => s.ingestionId));

      const gcdrGran = evoGran === '1y' || evoGran === '1M' ? 'month' : evoGran === '1d' ? 'day' : 'hour';
      // GET /goals completo por shopping (Addendum A: granularity/devices junto da tree)
      const goalsAll = await Promise.all(
        shops.map((s) => fetchCustomerGoalsTree(s.attrs, cfgD.gcdr, yearGoals, gcdrGran).catch(() => null))
      );
      if (seq !== evoSeq) return;
      // A matemática do painel segue 100% na árvore CONSOLIDADA (inalterada).
      const trees = goalsAll.map((g) => g?.tree || null);

      // Labels, chave de meta por boundary e ranges (ano do período + mesmo período no ano-1)
      let labels;
      let idxByKey = null; // 1d: "MM-DD" → índice (alinha ano-1 no mesmo bucket)
      let monthIdxMap = null; // 1M: mês (1-12) → índice do bucket (meses do período)
      let goalKeyAt;
      let ranges;
      if (evoGran === '1y') {
        // Ano corrente inteiro, visão mensal Jan–Dez
        labels = MONTHS_PT;
        goalKeyAt = (i) => ['monthly', String(i + 1).padStart(2, '0')];
        const isCurYear = yearSel === nowD.getFullYear();
        ranges = {
          cur: [
            `${yearSel}-01-01T00:00:00-03:00`,
            isCurYear ? nowD.toISOString() : `${yearSel}-12-31T23:59:59-03:00`,
          ],
          prev: [`${yearSel - 1}-01-01T00:00:00-03:00`, `${yearSel - 1}-12-31T23:59:59-03:00`],
        };
      } else if (evoGran === '1M') {
        // Meses DENTRO do período do picker (ex.: 01–09/07 → só Julho)
        const s0 = isoLocalDay(period.startISO);
        const e0 = isoLocalDay(period.endISO);
        const mStart = Number(s0.slice(5, 7));
        const mEnd = Math.max(mStart, Number(e0.slice(5, 7)));
        const months = [];
        for (let m = mStart; m <= mEnd; m++) months.push(m);
        monthIdxMap = new Map(months.map((m, i) => [m, i]));
        labels = months.map((m) => MONTHS_PT[m - 1]);
        goalKeyAt = (i) => ['monthly', String(months[i]).padStart(2, '0')];
        ranges = {
          cur: [period.startISO, period.endISO],
          prev: [
            `${Number(s0.slice(0, 4)) - 1}${s0.slice(4)}T00:00:00-03:00`,
            `${Number(e0.slice(0, 4)) - 1}${e0.slice(4)}T23:59:59-03:00`,
          ],
        };
      } else {
        // Dia e Hora seguem o INTERVALO do picker; Hora = horas de cada dia do range
        const days = periodDays;
        idxByKey = new Map(days.map((dd, i) => [dd.key, i]));
        const s0 = isoLocalDay(period.startISO);
        const e0 = isoLocalDay(period.endISO);
        ranges = {
          cur: [period.startISO, period.endISO],
          prev: [
            `${Number(s0.slice(0, 4)) - 1}${s0.slice(4)}T00:00:00-03:00`,
            `${Number(e0.slice(0, 4)) - 1}${e0.slice(4)}T23:59:59-03:00`,
          ],
        };
        if (evoGran === '1d') {
          labels = days.map((dd) => dd.label);
          goalKeyAt = (i) => ['daily', days[i].key];
        } else {
          labels = days.flatMap((dd) => Array.from({ length: 24 }, (_, h) => `${dd.label} ${h}h`));
          goalKeyAt = (i) => ['hourly', `${days[Math.floor(i / 24)].key}T${String(i % 24).padStart(2, '0')}`];
        }
      }
      const size = labels.length;

      const bucketize = (points) => {
        const out = Array(size).fill(null);
        for (const pt of points || []) {
          const ts = String(pt.timestamp);
          let idx;
          if (evoGran === '1y') idx = Number(ts.slice(5, 7)) - 1;
          else if (evoGran === '1M') idx = monthIdxMap.get(Number(ts.slice(5, 7)));
          else if (evoGran === '1d') idx = idxByKey.get(ts.slice(5, 10));
          else {
            const dIdx = idxByKey.get(ts.slice(5, 10)); // dia do range (alinha ano-1 por MM-DD)
            idx = dIdx == null ? undefined : dIdx * 24 + Number(ts.slice(11, 13));
          }
          if (idx == null || idx < 0 || idx >= size) continue;
          out[idx] = (out[idx] || 0) + (Number(pt.value) || 0);
        }
        return out;
      };
      // RFC-0052 (GCDR): Meta = Orçado ajustado pela margem — a API entrega
      // adjustedValue em cada nó (igual a value quando a margem é 0/ausente).
      // Linha(s) "Meta" do gráfico e dos cards usam o AJUSTADO; o Resumo
      // Analítico e a sidebar seguem no Orçado cru (value).
      const goalNodeMeta = (n) => {
        const v = n?.adjustedValue ?? n?.value;
        return v == null ? null : Number(v) || 0;
      };
      const goalOf = (tree) =>
        labels.map((_, i) => {
          const [lv, k] = goalKeyAt(i);
          return goalNodeMeta(tree?.[lv]?.[k]);
        });
      // Orçado cru (value) — usado pelo Resumo Analítico
      const goalRawOf = (tree) =>
        labels.map((_, i) => {
          const [lv, k] = goalKeyAt(i);
          const v = tree?.[lv]?.[k]?.value;
          return v == null ? null : Number(v) || 0;
        });
      const goalSum = labels.map((_, i) => {
        const [lv, k] = goalKeyAt(i);
        let s = 0;
        let has = false;
        trees.forEach((t, si) => {
          if (isCustHidden(shops[si]?.tbId)) return; // 👁 customer oculto fora da meta somada
          const v = goalNodeMeta(t?.[lv]?.[k]);
          if (v != null) {
            s += v;
            has = true;
          }
        });
        return has ? s : null;
      });

      // Cards agrupados por DISPOSITIVO: séries por medidor (não por customer) —
      // busca própria + render próprio; não passa pelo fetch por shopping abaixo.
      if (evoMode === 'cards' && cardsGroupBy !== 'shopping') {
        evoStatusEl.textContent = 'Carregando medidores…';
        const seriesGranDev = evoGran === '1h' ? '1h' : '1d';
        const devices = await listCardDevices();
        if (seq !== evoSeq) return;
        const fetchDevRange = async (range) => {
          const ck = `dev|${domainKey}|${evoGran}|${range[0]}|${range[1]}`;
          if (evoConsCache.has(ck)) return evoConsCache.get(ck);
          const out = new Map();
          await Promise.all(
            devices.map(async (d) => {
              const pts = await fetchDeviceSeries(d.id, cfgD.api, range[0], range[1], seriesGranDev).catch(
                () => []
              );
              out.set(d.id, pts);
            })
          );
          if (new Date(range[1]) < nowD) evoConsCache.set(ck, out);
          return out;
        };
        const [curDev, prevDev] = await Promise.all([fetchDevRange(ranges.cur), fetchDevRange(ranges.prev)]);
        if (seq !== evoSeq) return;

        // ── Addendum A: metas POR MEDIDOR nos cards (anos com granularity DEVICE) ──
        // "Dispositivos separados": busca LAZY a tree de cada medidor de entrada via
        // ?deviceId= (só aqui — cards + separados + ano DEVICE), com o mesmo cache de
        // promise do fetchCustomerGoalsTree. Uma linha de meta por medidor no card.
        // "Dispositivos empilhados": mantém a linha de meta única (tree somada); o
        // detalhamento por medidor vai no tooltip via devices[] (anual ajustado).
        let goalDevTrees = null; // Map<shopIdx, [{ name, tree }]>
        if (cardsGroupBy === 'device') {
          const entries = await Promise.all(
            shops.map(async (s, i) => {
              const g = goalsAll[i];
              if (g?.granularity !== 'DEVICE' || !Array.isArray(g.devices) || !g.devices.length) return null;
              const perDev = await Promise.all(
                g.devices.map(async (gd) => {
                  const devKey = gd.deviceId || gd.id || gd.code;
                  if (!devKey) return null;
                  const dg = await fetchCustomerGoalsTree(
                    s.attrs,
                    cfgD.gcdr,
                    yearGoals,
                    gcdrGran,
                    devKey
                  ).catch(() => null);
                  if (!dg?.tree) return null;
                  return { name: gd.label || gd.code || 'Medidor', tree: dg.tree };
                })
              );
              const ok = perDev.filter(Boolean);
              return ok.length ? [i, ok] : null;
            })
          );
          if (seq !== evoSeq) return;
          goalDevTrees = new Map(entries.filter(Boolean));
        }

        renderGoalsDeviceCardsGrid({
          labels,
          devices,
          curDev,
          prevDev,
          bucketize,
          yearCurLabel: String(yearSel),
          yearPrevLabel: String(yearSel - 1),
          unit: cfgD.unit,
          shops,
          trees,
          goalOf,
          goalRawOf,
          goalsAll,
          goalDevTrees,
        });
        evoStatusEl.textContent = devices.length ? '' : 'Sem medidores de entrada';
        setEvoLoading(false);
        return;
      }

      // Consumo por customer (ano do período e ano-1). Energia: séries dos medidores de
      // entrada (~1s/device). Água: série agregada — consolidado 1 chamada; por shopping
      // 1 por customer (lentas ~2min, em paralelo).
      evoStatusEl.textContent = isEnergy
        ? 'Carregando consumo…'
        : 'Carregando consumo… (água pode levar ~2 min)';
      const seriesGran = evoGran === '1h' ? '1h' : '1d';
      const fetchByCustomer = async (range) => {
        // Água: 'stack' e 'sep' precisam da série POR shopping; consolidado usa 1 chamada head-office
        const perShopping = evoMode !== 'cons';
        const ck = `${domainKey}|${evoGran}|${perShopping && !isEnergy ? 'sep' : 'all'}|${range[0]}|${range[1]}`;
        if (evoConsCache.has(ck)) return evoConsCache.get(ck);
        let byCust = null;
        if (isEnergy) {
          byCust = await fetchEntradaPointsByCustomer(range[0], range[1], seriesGran).catch(() => null);
        } else if (perShopping) {
          byCust = new Map();
          await Promise.all(
            shops.map(async (s) => {
              if (!s.ingestionId) return;
              const pts = await fetchHeadOfficeSeries(
                cfgD.api,
                range[0],
                range[1],
                seriesGran,
                s.ingestionId
              ).catch(() => null);
              if (pts) byCust.set(s.ingestionId, pts);
            })
          );
          if (byCust.size === 0) byCust = null;
        } else {
          const pts = await fetchHeadOfficeSeries(cfgD.api, range[0], range[1], seriesGran).catch(() => null);
          byCust = pts ? new Map([['__ALL__', pts]]) : null;
        }
        // cache só quando o range já fechou (não toca o agora)
        if (byCust && new Date(range[1]) < nowD) evoConsCache.set(ck, byCust);
        return byCust;
      };
      const [curBy, prevBy] = await Promise.all([fetchByCustomer(ranges.cur), fetchByCustomer(ranges.prev)]);
      if (seq !== evoSeq) return;

      const yearCurLabel = String(yearSel);
      const yearPrevLabel = String(Number(yearCurLabel) - 1);

      // RFC-0217: modo Cards — um small-multiple por shopping em vez do canvas único
      if (evoMode === 'cards') {
        renderGoalsCardsGrid({
          labels,
          shops,
          curBy,
          prevBy,
          goalOf,
          goalRawOf,
          trees,
          bucketize,
          yearCurLabel,
          yearPrevLabel,
          unit: cfgD.unit,
        });
        evoStatusEl.textContent = curBy || prevBy ? '' : 'Falha ao carregar o consumo';
        setEvoLoading(false);
        return;
      }

      // Resumo Analítico — tabela do portfólio (sem gráfico e sem sidebar)
      if (evoMode === 'analytics') {
        renderAnalyticsTable({
          shops,
          curBy,
          prevBy,
          trees,
          goalOf: goalRawOf, // colunas "Orçado" da tabela usam o valor CRU (sem margem)
          bucketize,
          yearCurLabel,
          yearPrevLabel,
          unit: cfgD.unit,
        });
        evoStatusEl.textContent = curBy || prevBy ? '' : 'Falha ao carregar o consumo';
        setEvoLoading(false);
        return;
      }

      const datasets = [];
      if (evoMode === 'stack') {
        // Empilhado: 2 colunas por bucket (pilha do ano e pilha do ano-1, um segmento por
        // shopping) + UMA linha de meta = soma das metas de todos os shoppings
        shops.forEach((s, i) => {
          if (isCustHidden(s.tbId)) return; // 👁 customer oculto fora do empilhado
          const color = SHOP_PALETTE[i % SHOP_PALETTE.length];
          if (showCurYear)
            datasets.push({
              type: 'bar',
              label: `${s.title} ${yearCurLabel}`,
              data: bucketize(curBy?.get(s.ingestionId)),
              backgroundColor: color,
              stack: 'cur',
              order: 5,
            });
          if (showPrevYear)
            datasets.push({
              type: 'bar',
              label: `${s.title} ${yearPrevLabel}`,
              data: bucketize(prevBy?.get(s.ingestionId)),
              backgroundColor: rgba(color, 0.35),
              stack: 'prev',
              order: 4, // A-1 à ESQUERDA do ano corrente (padrão dos shoppings)
            });
        });
        datasets.push({
          type: 'line',
          label: 'Meta',
          data: goalSum,
          borderColor: (EVO_COLORS[domainKey] || EVO_COLORS.energy).goal,
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          spanGaps: true,
          tension: 0.4,
          order: 0,
        });
      } else if (evoMode === 'sep') {
        shops.forEach((s, i) => {
          if (isCustHidden(s.tbId)) return; // 👁 customer oculto fora do gráfico separado
          const color = SHOP_PALETTE[i % SHOP_PALETTE.length];
          if (showCurYear)
            datasets.push({
              type: 'bar',
              label: `${s.title} ${yearCurLabel}`,
              data: bucketize(curBy?.get(s.ingestionId)),
              backgroundColor: color,
              borderRadius: 2,
              order: 5,
            });
          if (showPrevYear)
            datasets.push({
              type: 'bar',
              label: `${s.title} ${yearPrevLabel}`,
              data: bucketize(prevBy?.get(s.ingestionId)),
              backgroundColor: rgba(color, 0.35),
              borderRadius: 2,
              order: 4, // A-1 à ESQUERDA do ano corrente (padrão dos shoppings)
            });
          datasets.push({
            type: 'line',
            label: `Meta ${s.title}`,
            data: goalOf(trees[i]),
            borderColor: color,
            backgroundColor: 'transparent',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 3,
            fill: false,
            spanGaps: true,
            tension: 0.4,
            order: 0,
          });
        });
      } else {
        const colors = EVO_COLORS[domainKey] || EVO_COLORS.energy;
        const sumAll = (byCust) => {
          if (!byCust) return labels.map(() => null);
          const all = [];
          // 👁: energia é por customer → soma só os visíveis; água consolidada usa a
          // série única '__ALL__' (não separável por customer) e entra sempre.
          byCust.forEach((pts, key) => {
            if (key === '__ALL__' || visIngSet.has(key)) all.push(...(pts || []));
          });
          return bucketize(all);
        };
        if (showCurYear)
          datasets.push({
            type: 'bar',
            label: `Consumo ${yearCurLabel}`,
            data: sumAll(curBy),
            backgroundColor: colors.bar,
            borderRadius: 3,
            order: 5,
          });
        if (showPrevYear)
          datasets.push({
            type: 'bar',
            label: `Consumo ${yearPrevLabel}`,
            data: sumAll(prevBy),
            backgroundColor: 'rgba(148,163,184,0.55)',
            borderRadius: 3,
            order: 4, // A-1 à ESQUERDA do ano corrente (padrão dos shoppings)
          });
        datasets.push({
          type: 'line',
          label: 'Meta',
          data: goalSum,
          borderColor: colors.goal,
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          spanGaps: true,
          tension: 0.4,
          order: 0,
        });
      }
      // ── Modelo do tooltip premium (tree-driven). Rows geradas a partir dos
      // datasets do gráfico; Realizado/A-1 consolidados expandem por shopping
      // (série por customer) e Meta expande por medidor quando há 1 shopping
      // visível com granularity DEVICE (pesos ANUAIS distribuídos sobre a meta do
      // bucket — não há meta por-medidor por-período). Orçado (cru) entra como
      // linha extra quando difere da Meta (margem de gestão aplicada).
      const tipUnit = cfgD.unit;
      const budgetSum = labels.map((_, i) => {
        const [lv, k] = goalKeyAt(i);
        let s = 0, has = false;
        trees.forEach((tr, si) => {
          if (isCustHidden(shops[si]?.tbId)) return;
          const v = tr?.[lv]?.[k]?.value;
          if (v != null) { s += Number(v) || 0; has = true; }
        });
        return has ? s : null;
      });
      const shopCurBk = shops.map((s) => bucketize(curBy?.get(s.ingestionId)));
      const shopPrevBk = shops.map((s) => bucketize(prevBy?.get(s.ingestionId)));
      const visShopIdx = shops.map((_, i) => i).filter((i) => !isCustHidden(shops[i].tbId));
      const perShopChildren = (buckets, idx, total) =>
        visShopIdx
          .map((i) => ({ i, v: buckets[i] ? buckets[i][idx] : null }))
          .filter((x) => x.v != null && x.v > 0)
          .map((x) => ({
            icon: '🏬',
            label: shops[x.i].title,
            valueText: _fmtQtyStr(x.v, tipUnit),
            pct: total ? (x.v / total) * 100 : null,
            color: SHOP_PALETTE ? SHOP_PALETTE[x.i % SHOP_PALETTE.length] : undefined,
          }));
      const metaDeviceChildren = (idx, metaVal) => {
        if (visShopIdx.length !== 1 || !(metaVal > 0)) return [];
        const g = goalsAll[visShopIdx[0]];
        const devs = g?.granularity === 'DEVICE' && Array.isArray(g.devices) ? g.devices : [];
        if (!devs.length) return [];
        const norm = devs.map((d) => ({
          label: d.label || d.code || 'Medidor',
          annual: Number(d.annualAdjusted ?? d.annual ?? 0) || 0,
        }));
        const tot = norm.reduce((a, d) => a + d.annual, 0);
        if (!(tot > 0)) return [];
        return norm.map((d) => {
          const w = d.annual / tot;
          return { icon: cfgD.icon || '⚡', label: d.label, valueText: _fmtQtyStr(metaVal * w, tipUnit), pct: w * 100 };
        });
      };
      const tipModel = {
        accent: GP.accent,
        title: (idx) => labels[idx] || '',
        rows: (idx, dss) => {
          const metaRef = goalSum[idx] != null && goalSum[idx] > 0 ? goalSum[idx] : null;
          let denom = metaRef;
          if (denom == null) {
            const vals = dss.map((d) => Number(d.data && d.data[idx])).filter((v) => isFinite(v) && v > 0);
            denom = vals.length ? Math.max(...vals) : null;
          }
          const pctOf = (v) => (v != null && denom ? (v / denom) * 100 : null);
          const rows = dss.map((ds) => {
            const v = ds.data ? ds.data[idx] : null;
            const lbl = ds.label || '';
            const isMeta = /^Meta/.test(lbl);
            const isConsCur = lbl === `Consumo ${yearCurLabel}`;
            const isConsPrev = lbl === `Consumo ${yearPrevLabel}`;
            const row = {
              icon: isMeta ? '🎯' : isConsPrev ? '🕓' : lbl.includes(yearPrevLabel) ? '🕓' : '📊',
              label: lbl,
              valueText: v == null ? '—' : _fmtQtyStr(v, tipUnit),
              color: ds.borderColor || ds.backgroundColor,
              pct: isMeta ? null : pctOf(Number(v)),
            };
            if (isMeta && v != null) {
              const kids = metaDeviceChildren(idx, Number(v));
              if (kids.length) row.children = kids;
            } else if (isConsCur && v != null && visShopIdx.length > 1) {
              const kids = perShopChildren(shopCurBk, idx, Number(v));
              if (kids.length) row.children = kids;
            } else if (isConsPrev && v != null && visShopIdx.length > 1) {
              const kids = perShopChildren(shopPrevBk, idx, Number(v));
              if (kids.length) row.children = kids;
            }
            return row;
          });
          // Orçado (cru) — só quando há Meta e difere dela (margem aplicada).
          if (budgetSum[idx] != null && goalSum[idx] != null && Math.abs(budgetSum[idx] - goalSum[idx]) > 1e-6) {
            rows.push({
              icon: '📋', label: 'Orçado', color: CGC_ORCADO_COLOR,
              valueText: _fmtQtyStr(budgetSum[idx], tipUnit), pct: pctOf(budgetSum[idx]),
            });
          }
          return rows;
        },
      };

      renderEvoChart(labels, datasets, evoMode === 'stack', tipModel);
      // Período/anos já aparecem no calendário e nos toggles 👁 — status só sinaliza falha
      evoStatusEl.textContent = curBy || prevBy ? '' : 'Falha ao carregar o consumo';
      setEvoLoading(false);
    };

    // ── Export PDF Premium: KPIs do período + tabela por shopping + snapshot do gráfico ──
    const ensureJsPdf = () =>
      new Promise((resolve, reject) => {
        if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = () =>
          window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF indisponível'));
        s.onerror = () => reject(new Error('falha ao carregar jsPDF'));
        document.head.appendChild(s);
      });

    const exportPdf = async () => {
      const btn = overlay.querySelector('[data-pdf]');
      try {
        btn.disabled = true;
        btn.textContent = '⏳ Gerando…';
        const JsPDF = await ensureJsPdf();
        const cfgD = GOALS_COMPARE_DOMAINS[domainKey];
        const unit = lastUnit || cfgD.unit;
        const rows = (lastRows || []).filter((r) => r.meta !== undefined || r.consumo !== undefined);
        const domLabel = cfgD.label.replace(/^\S+\s/, ''); // sem emoji (jsPDF não renderiza)
        const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const W = 210;
        const MX = 14;

        // Faixa de capa
        doc.setFillColor(74, 20, 140);
        doc.rect(0, 0, W, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.text(`Metas x Consumo — ${_entP()}`, MX, 13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(
          `${domLabel} · Período ${periodLabel()} · Gerado em ${new Date().toLocaleString('pt-BR')}`,
          MX,
          21
        );
        let y = 40;

        // KPIs do período
        const totalMeta = rows.reduce((s, r) => s + (r.meta || 0), 0);
        const totalCons = rows.reduce((s, r) => s + (r.consumo || 0), 0);
        const pctTotal = totalMeta > 0 ? (totalCons / totalMeta) * 100 : null;
        const kpis = [
          ['Orçado do período', _fmtQtyStr(totalMeta, unit)],
          ['Consumo do período', _fmtQtyStr(totalCons, unit)],
          [
            'vs Orçado',
            pctTotal == null
              ? '—'
              : `${Math.abs(100 - pctTotal).toFixed(1)}% ${pctTotal <= 100 ? 'abaixo' : 'acima'} do Orçado`,
          ],
          [_entP(), String(rows.length)],
        ];
        const boxW = (W - MX * 2 - 9) / 4;
        kpis.forEach(([label, value], i) => {
          const x = MX + i * (boxW + 3);
          doc.setDrawColor(226, 232, 240);
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(x, y, boxW, 19, 2, 2, 'FD');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(label, x + 3, y + 6);
          doc.setFontSize(11);
          doc.setTextColor(30, 41, 59);
          doc.setFont('helvetica', 'bold');
          doc.text(String(value), x + 3, y + 14);
          doc.setFont('helvetica', 'normal');
        });
        y += 28;

        // Tabela por shopping
        const situacao = (meta, consumo) => {
          if (meta == null || meta <= 0) return { txt: 'Sem Orçado', rgb: [100, 116, 139] };
          if (consumo == null) return { txt: 'Sem consumo', rgb: [100, 116, 139] };
          const p = (consumo / meta) * 100;
          const dev = Math.abs(100 - p).toFixed(1);
          if (p <= 90) return { txt: `${dev}% abaixo do Orçado`, rgb: [21, 128, 61] };
          if (p <= 100) return { txt: `${dev}% abaixo do Orçado`, rgb: [161, 98, 7] };
          return { txt: `${dev}% acima do Orçado`, rgb: [185, 28, 28] };
        };
        doc.setFontSize(13);
        doc.setTextColor(74, 20, 140);
        doc.setFont('helvetica', 'bold');
        doc.text(`Resumo por ${_goalsEntityLabel.toLowerCase()}`, MX, y);
        y += 7;
        const colX = [MX, MX + 68, MX + 108, MX + 148];
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(_entS(), colX[0], y);
        doc.setTextColor(245, 158, 11); // Orçado — LARANJA
        doc.text('Orçado', colX[1], y);
        doc.setTextColor(37, 99, 235); // Consumo (Realizado) — AZUL
        doc.text('Consumo', colX[2], y);
        doc.setTextColor(100, 116, 139);
        doc.text('Situação', colX[3], y);
        y += 2;
        doc.setDrawColor(226, 232, 240);
        doc.line(MX, y, W - MX, y);
        y += 6;
        doc.setFontSize(10);
        rows.forEach((r) => {
          doc.setTextColor(30, 41, 59);
          doc.text(String(r.title).slice(0, 34), colX[0], y);
          doc.text(_fmtQtyStr(r.meta, unit), colX[1], y);
          doc.text(_fmtQtyStr(r.consumo, unit), colX[2], y);
          const st = situacao(r.meta, r.consumo);
          doc.setTextColor(st.rgb[0], st.rgb[1], st.rgb[2]);
          doc.text(st.txt, colX[3], y);
          y += 6;
        });
        doc.setDrawColor(226, 232, 240);
        doc.line(MX, y - 3, W - MX, y - 3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Total', colX[0], y + 2);
        doc.text(_fmtQtyStr(totalMeta, unit), colX[1], y + 2);
        doc.text(_fmtQtyStr(totalCons, unit), colX[2], y + 2);
        const stT = situacao(totalMeta || null, totalCons || null);
        doc.setTextColor(stT.rgb[0], stT.rgb[1], stT.rgb[2]);
        doc.text(stT.txt, colX[3], y + 2);
        doc.setFont('helvetica', 'normal');
        y += 12;

        // Snapshot do gráfico (com fundo branco — canvas é transparente)
        // Cards/Analítico não têm canvas único — PDF sai com KPIs + tabela (RFC-0217 v1)
        if (evoMode !== 'cards' && evoMode !== 'analytics' && evoChart && evoCanvas.width > 0) {
          const granLbl =
            evoGran === '1y'
              ? 'anual (mensal)'
              : evoGran === '1M'
                ? 'mensal'
                : evoGran === '1d'
                  ? 'diário'
                  : 'horário';
          const modeLbl = evoMode === 'sep' ? `por ${_entSLow()}` : 'consolidado';
          const img = evoCanvas.toDataURL('image/png', 1.0);
          const iw = W - MX * 2;
          const ih = Math.min(iw * (evoCanvas.height / evoCanvas.width), 120);
          if (y + ih + 10 > 285) {
            doc.addPage();
            y = 14;
          }
          doc.setFontSize(13);
          doc.setTextColor(74, 20, 140);
          doc.setFont('helvetica', 'bold');
          doc.text(`Gráfico ${granLbl} (${modeLbl}) — ${evoStatusEl.textContent || ''}`, MX, y);
          doc.setFont('helvetica', 'normal');
          y += 4;
          doc.setFillColor(255, 255, 255);
          doc.rect(MX, y, iw, ih, 'F');
          doc.addImage(img, 'PNG', MX, y, iw, ih);
          y += ih + 6;
        }

        // Rodapé em todas as páginas
        const pages = doc.getNumberOfPages();
        for (let p = 1; p <= pages; p++) {
          doc.setPage(p);
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`Powered by MYIO Platform · Head Office · pág. ${p}/${pages}`, MX, 291);
        }
        doc.save(
          `metas-consumo-${cfgD.api}-${isoLocalDay(period.startISO)}-a-${isoLocalDay(period.endISO)}.pdf`
        );
        MyIOLibrary.MyIOToast?.success?.('PDF gerado com sucesso');
      } catch (err) {
        LogHelper.error('[GoalsCompare] export PDF falhou:', err);
        _goalsToastError(`Falha ao gerar o PDF: ${err?.message || err}`);
      } finally {
        btn.disabled = false;
        btn.textContent = '⬇️ PDF';
      }
    };

    // Aplica o tema no overlay (CSS vars) + repinta pills/tabs/sidebar/gráfico
    const applyModalTheme = () => {
      const t = GC_THEMES[modalTheme];
      overlay.style.setProperty('--gc-surface', t.surface);
      overlay.style.setProperty('--gc-surface2', t.surface2);
      overlay.style.setProperty('--gc-chip', t.chip);
      overlay.style.setProperty('--gc-border', t.border);
      overlay.style.setProperty('--gc-text', t.text);
      overlay.style.setProperty('--gc-text2', t.text2);
      overlay.style.setProperty('--gc-muted', t.muted);
      overlay.style.setProperty('--gc-muted2', t.muted2);
      overlay.style.setProperty('--gc-input-border', t.inputBorder);
      const thmBtn = overlay.querySelector('[data-thm]');
      if (thmBtn) thmBtn.textContent = modalTheme === 'dark' ? '☀️' : '🌙';
      paintTabs();
      paintEvoGrans();
      if (lastRows) renderTable(lastRows, lastUnit);
      if (evoMode === 'cards' && goalsCards.length) {
        // RFC-0217: retema os cards in-place (não re-renderiza o canvas único)
        goalsCards.forEach((c) => c.setThemeMode?.(modalTheme));
      } else if (evoMode === 'analytics') {
        // Tabela usa CSS vars (--gc-*) — o tema aplica sozinho; não trocar de superfície
      } else if (lastEvo) {
        renderEvoChart(lastEvo.labels, lastEvo.datasets, lastEvo.stacked, lastEvo.tipModel);
      }
    };

    const toggleMax = () => {
      isMax = !isMax;
      dialogEl.style.width = isMax ? '100vw' : 'min(1320px,calc(100% - 32px))';
      dialogEl.style.height = isMax ? '100vh' : '';
      dialogEl.style.maxHeight = isMax ? '100vh' : '92vh';
      dialogEl.style.borderRadius = isMax ? '0' : '14px';
      // Maximizado: o gráfico cresce e ocupa a altura livre da viewport
      // (~320px = header + toolbar + pills + legenda + nota + paddings). Usa minHeight
      // para não anular o flex:1 (o wrap já preenche a altura da coluna esquerda).
      const evoWrap = overlay.querySelector('[data-evo-wrap]');
      if (evoWrap) evoWrap.style.minHeight = isMax ? 'max(340px, calc(100vh - 320px))' : '340px';
      const mx = overlay.querySelector('[data-max]');
      if (mx) {
        mx.textContent = isMax ? '🗗' : '⛶';
        mx.title = isMax ? 'Restaurar' : 'Maximizar';
      }
      setTimeout(() => evoChart?.resize?.(), 60);
    };

    // Sidebar recolhível: recolhida vira só a setinha; o gráfico ganha a largura liberada
    let sideCollapsed = false;
    const toggleSide = () => {
      sideCollapsed = !sideCollapsed;
      const aside = overlay.querySelector('[data-side]');
      const table = overlay.querySelector('[data-table]');
      const btn = overlay.querySelector('[data-side-toggle]');
      const pricing = overlay.querySelector('[data-pricing]');
      aside.style.flex = sideCollapsed ? '0 0 auto' : '0 0 372px';
      table.style.display = sideCollapsed ? 'none' : 'flex';
      const totalRow = overlay.querySelector('[data-side-total]');
      if (totalRow) totalRow.style.display = sideCollapsed ? 'none' : '';
      const sortRow = overlay.querySelector('[data-side-sort]');
      if (sortRow) sortRow.style.display = sideCollapsed ? 'none' : 'flex';
      if (pricing) pricing.style.display = sideCollapsed ? 'none' : '';
      const sideTitle = overlay.querySelector('[data-side-title]');
      if (sideTitle) sideTitle.style.display = sideCollapsed ? 'none' : '';
      aside.style.borderLeftColor = sideCollapsed ? 'transparent' : 'var(--gc-border)';
      btn.textContent = sideCollapsed ? '◀' : 'Recolher ▶'; // recolhido = só a seta (largura mínima)
      btn.title = sideCollapsed ? 'Expandir resumo' : 'Recolher resumo';
      setTimeout(() => evoChart?.resize?.(), 60);
    };

    // Botão "$" — painel de precificação (R$/kWh por customer × período). O painel é
    // criado pela lib (window.MyIOLibrary.openPricingPanel, função nova). Aqui só
    // gate por usuário MyIO + guard de disponibilidade da lib.
    const openPricing = async () => {
      // Email do usuário logado: 1º window.MyIOUtils.currentUserEmail (setado no onInit
      // a partir de fetchCurrentUserInfo); fallback GET /api/auth/user (TB) quando vazio.
      let email = String(window.MyIOUtils?.currentUserEmail || '');
      if (!email) {
        try {
          const jwt = localStorage.getItem('jwt_token') || '';
          const res = await fetch('/api/auth/user', {
            headers: { 'X-Authorization': `Bearer ${jwt}` },
          });
          if (res.ok) {
            const u = await res.json();
            email = String(u?.email || '');
            if (email) {
              window.MyIOUtils = window.MyIOUtils || {};
              window.MyIOUtils.currentUserEmail = email;
              window.MyIOUtils.SuperAdmin = /@myio\.com\.br$/i.test(email);
            }
          }
        } catch (err) {
          LogHelper.warn('[GoalsCompare] fallback /api/auth/user falhou:', err?.message || err);
        }
      }
      const isMyio = /@myio\.com\.br$/i.test(email) || !!window.MyIOUtils?.SuperAdmin;
      if (!isMyio) {
        const msg = 'Funcionalidade disponível apenas para usuários MyIO.';
        if (MyIOLibrary?.MyIOToast?.warning) MyIOLibrary.MyIOToast.warning(msg);
        else _goalsToastError(msg);
        return;
      }
      if (typeof MyIOLibrary?.openPricingPanel !== 'function') {
        _goalsToastError('Painel de precificação indisponível — atualize a myio-js-library.');
        return;
      }
      try {
        // Theme do pricing panel derivado da paleta do próprio painel de Metas
        // (goalsPalette/GP) — não de window.MyIOUtils.theme (ausente na HO). Mapa
        // --myio-* plano que o openPricingPanel aplica no root .myio-pricing.
        const gp = goalsPalette();
        const isDark = (window.MyIOUtils?.currentThemeMode || currentThemeMode) === 'dark';
        const pricingTheme = {
          '--myio-brand-700': gp.accent,
          '--myio-brand-600': gp.accent,
          '--myio-brand-100': gp.lighten(85),
          '--myio-accent-text': gp.accentText,
          ...(isDark
            ? {
                '--myio-card': '#1e293b',
                '--myio-bg': '#0f172a',
                '--myio-text': '#e2e8f0',
                '--myio-text-muted': '#94a3b8',
                '--myio-border': '#334155',
              }
            : {}),
        };
        MyIOLibrary.openPricingPanel({
          customers: (shoppings || []).map((s) => ({
            tbId: s.tbId,
            title: s.title,
            gcdrCustomerId: s.gcdrCustomerId,
          })),
          currentUserEmail: email,
          domain: domainKey,
          theme: pricingTheme,
        });
      } catch (err) {
        LogHelper.error('[GoalsCompare] openPricingPanel falhou:', err);
        _goalsToastError(`Falha ao abrir precificação: ${err?.message || err}`);
      }
    };

    // Tema alterado em outro ponto do dashboard (menu/welcome) → modal acompanha
    const onGlobalTheme = (e) => {
      const tm = e.detail?.themeMode;
      if ((tm === 'dark' || tm === 'light') && tm !== modalTheme) {
        modalTheme = tm;
        applyModalTheme();
      }
    };
    window.addEventListener('myio:theme-change', onGlobalTheme);

    let periodPicker = null;
    const close = () => {
      if (evoChart) evoChart.destroy();
      if (evoTip) { try { evoTip.destroy(); } catch (_) { /* ignore */ } evoTip = null; }
      destroyGoalsCards(); // RFC-0217
      try {
        periodPicker?.destroy?.();
      } catch {
        /* picker já destruído */
      }
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('myio:theme-change', onGlobalTheme);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('[data-pdf]')) return void exportPdf();
      if (e.target.closest('[data-max]')) return toggleMax();
      // Pill de ordem: clique só inverte crescente/decrescente (mantém a chave atual).
      if (e.target.closest('[data-side-order]')) {
        if (sideDataLoading) return;
        if (!sideSortKey) sideSortKey = 'inauguration';
        sideSortDir = -sideSortDir;
        if (lastRows) renderTable(lastRows, lastUnit);
        else paintSideSort();
        return;
      }
      // Botão de filtro: abre a modal (ordenar, filtro rápido, busca, excluir customer).
      if (e.target.closest('[data-side-filter]')) {
        if (sideDataLoading) return;
        return void openSideFilterModal();
      }
      if (e.target.closest('[data-side-toggle]')) return toggleSide();
      if (e.target.closest('[data-pricing]')) return void openPricing();
      // 👁 show/hide por customer: expurga/reintegra o customer dos TOTAIS e do GRÁFICO.
      const custEyeBtn = e.target.closest('[data-cust-eye]');
      if (custEyeBtn) {
        const id = String(custEyeBtn.dataset.custEye);
        if (hiddenCustomers.has(id)) hiddenCustomers.delete(id);
        else hiddenCustomers.add(id);
        if (lastRows) renderTable(lastRows, lastUnit); // Total da sidebar
        loadEvo(); // re-agrega gráfico/analítico/cards sem os ocultos
        return;
      }
      if (e.target.closest('[data-thm]')) {
        modalTheme = modalTheme === 'dark' ? 'light' : 'dark';
        applyModalTheme();
        // Sincroniza o dashboard inteiro (RFC-0120) — o listener global aplica em todos os componentes
        window.dispatchEvent(new CustomEvent('myio:theme-change', { detail: { themeMode: modalTheme } }));
        return;
      }
      if (e.target === overlay || e.target.closest('[data-close]')) return close();
      const tab = e.target.closest('[data-domain]');
      if (tab && tab.dataset.domain !== domainKey) {
        domainKey = tab.dataset.domain;
        load();
        loadEvo();
        return;
      }
      const gran = e.target.closest('[data-gran]');
      if (gran && !gran.disabled) {
        if (gran.dataset.gran === '1y') {
          // Ano corrente: ajusta o PERÍODO para 01/01 até agora e mostra a visão mensal
          const Y = new Date().getFullYear();
          period = { startISO: `${Y}-01-01T00:00:00-03:00`, endISO: new Date().toISOString() };
          periodInput.value = periodLabel();
          evoGran = '1y';
          load();
          loadEvo();
          return;
        }
        if (gran.dataset.gran !== evoGran) {
          evoGran = gran.dataset.gran;
          loadEvo();
          return;
        }
        return;
      }
      const eye = e.target.closest('[data-eye]');
      if (eye) {
        if (eye.dataset.eye === 'cur') showCurYear = !showCurYear;
        else showPrevYear = !showPrevYear;
        // Nunca deixa os dois ocultos
        if (!showCurYear && !showPrevYear) {
          if (eye.dataset.eye === 'cur') showPrevYear = true;
          else showCurYear = true;
        }
        loadEvo();
        return;
      }
      if (e.target.closest('[data-cards-settings]')) return void openCardsSettings();
      const group = e.target.closest('[data-modegroup]');
      if (group) {
        if (evoMode !== 'stack' && evoMode !== 'sep' && evoMode !== 'cards') {
          evoMode = lastSepSubmode;
          loadEvo();
        }
        return;
      }
      const submode = e.target.closest('[data-submode]');
      if (submode && submode.dataset.submode !== evoMode) {
        evoMode = submode.dataset.submode;
        lastSepSubmode = evoMode;
        loadEvo();
        return;
      }
      const mode = e.target.closest('[data-mode]');
      if (mode && mode.dataset.mode !== evoMode) {
        evoMode = mode.dataset.mode;
        loadEvo();
      }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    applyModalTheme();

    // Período: createDateRangePicker da lib (mesmo componente do restante do dashboard)
    periodInput.value = periodLabel();
    (async () => {
      try {
        if (typeof MyIOLibrary?.createDateRangePicker === 'function') {
          periodPicker = await MyIOLibrary.createDateRangePicker(periodInput, {
            presetStart: isoLocalDay(period.startISO),
            presetEnd: isoLocalDay(period.endISO),
            maxRangeDays: 92,
            parentEl: overlay.querySelector('[role="dialog"]'),
            onApply: (result) => {
              if (result?.startISO && result?.endISO) {
                period = { startISO: result.startISO, endISO: result.endISO };
                // Novo período selecionado → gráfico muda p/ visão Dia (respeita o intervalo);
                // Mês (visão anual) e Hora continuam disponíveis nos botões
                evoGran = '1d';
                load();
                loadEvo();
              }
            },
          });
        }
      } catch (err) {
        LogHelper.warn('[GoalsCompare] createDateRangePicker indisponível:', err?.message || err);
      }
    })();

    load();
    loadEvo();
  };

  // Escolha da área ao clicar em 🎯 Metas: Gestão (GoalsPanel por shopping) ou
  // comparação Metas × Consumo de todos os shoppings. Resolve 'manage'|'compare'|null.
  const pickGoalsArea = () =>
    new Promise((resolve) => {
      const prev = document.getElementById('myio-goals-area-picker');
      if (prev) prev.remove();

      const overlay = document.createElement('div');
      overlay.id = 'myio-goals-area-picker';
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;font-family:Nunito,sans-serif;';
      const cardStyle =
        'flex:1;display:flex;flex-direction:column;gap:8px;padding:20px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;cursor:pointer;text-align:left;transition:border-color .15s;';
      overlay.innerHTML = `
        <div role="dialog" aria-label="Metas" style="background:#fff;border-radius:12px;max-width:560px;width:calc(100% - 32px);box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:${goalsPalette().accent};color:${goalsPalette().accentText};">
            <strong style="font:700 15px Nunito,sans-serif;">🎯 Metas de Consumo</strong>
            <button type="button" data-close="1" aria-label="Fechar" style="border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer;line-height:1;">✕</button>
          </div>
          <div style="display:flex;gap:12px;padding:18px;">
            <button type="button" data-area="manage" style="${cardStyle}">
              <span style="font-size:26px;">🛠️</span>
              <strong style="font:700 14px Nunito,sans-serif;color:#1e293b;">Gestão de Metas</strong>
              <span style="font:600 12px Nunito,sans-serif;color:#64748b;">Criar, atualizar e importar metas por ${_escHtml(_entSLow())} (planilha, histórico de versões).</span>
            </button>
            <button type="button" data-area="compare" style="${cardStyle}">
              <span style="font-size:26px;">📊</span>
              <strong style="font:700 14px Nunito,sans-serif;color:#1e293b;">Metas × Consumo</strong>
              <span style="font:600 12px Nunito,sans-serif;color:#64748b;">Comparar o consumo real (${_escHtml(_entPLow())}) com as metas, num único painel.</span>
            </button>
          </div>
        </div>`;

      const done = (result) => {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') done(null);
      };
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-close]')) return done(null);
        const btn = e.target.closest('[data-area]');
        if (btn) done(btn.dataset.area);
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);
    });

  window.addEventListener('myio:open-goals-panel', async () => {
    LogHelper.log('[MAIN_UNIQUE] Goals panel requested');

    if (!MyIOLibrary?.openGoalsPanel) {
      LogHelper.error('[MAIN_UNIQUE] MyIOLibrary.openGoalsPanel not available');
      _goalsToastError('Componente de Metas não está disponível.');
      return;
    }

    try {
      // Shoppings filhos vindos do datasource 'customers' (mesma fonte do welcome modal);
      // cards de fallback (ASSET, sem customerId) não têm metas próprias no GCDR.
      const shoppings = (_currentCustomersCards || [])
        .filter((c) => c.entityType === 'CUSTOMER' && (c.customerId || c.entityId))
        .map((c) => ({
          tbId: c.customerId || c.entityId,
          title: c.title || _entS(),
          inaugurationDate: c.inaugurationDate || null, // 'YYYY-MM-DD' — ordenação default do Metas × Consumo
        }));

      if (shoppings.length === 0) {
        // Dashboard sem shoppings filhos (single-customer): comportamento antigo,
        // metas do próprio customer do widget.
        LogHelper.warn('[MAIN_UNIQUE] No child shoppings; opening goals for the dashboard customer');
        await openGoalsForCustomer(getCustomerTB_ID(), 'este customer');
        return;
      }

      const area = await pickGoalsArea();
      if (!area) return; // cancelado

      if (area === 'compare') {
        openGoalsCompare(shoppings);
        return;
      }

      const selected = shoppings.length === 1 ? shoppings[0] : await pickGoalsCustomer(shoppings);
      if (!selected) return; // seleção cancelada

      await openGoalsForCustomer(selected.tbId, selected.title);
    } catch (err) {
      LogHelper.error('[MAIN_UNIQUE] Error opening Goals Panel:', err);
      _goalsToastError(`Erro ao abrir metas: ${err?.message || err}`);
    }
  });

  // === HELPER FUNCTIONS ===

  // RFC-0137: LoadingSpinner integration for MAIN_UNIQUE_DATASOURCE
  // Uses MyIOLibrary.createLoadingSpinner if available, falls back to legacy overlay
  const MENU_BUSY_OVERLAY_ID = 'myio-main-unique-busy-overlay';
  let menuBusyTimeoutId = null;
  let menuBusyVisible = false;

  // RFC-0137: Configurable delay before hiding spinner after data is confirmed loaded
  const SPINNER_HIDE_DELAY_MS = 2000; // 2 seconds delay after data confirmed

  // RFC-0137: LoadingSpinner instance (lazy initialized)
  let _loadingSpinnerInstance = null;
  let _pendingHideTimeoutId = null;

  /**
   * RFC-0137: Get or create LoadingSpinner instance
   * Uses MyIOLibrary.createLoadingSpinner if available, falls back to legacy overlay
   */
  function getLoadingSpinner() {
    if (_loadingSpinnerInstance) return _loadingSpinnerInstance;

    // Try to use new LoadingSpinner from myio-js-library
    const MyIOLibrary = window.MyIOLibrary;
    if (MyIOLibrary && typeof MyIOLibrary.createLoadingSpinner === 'function') {
      const _busyMode =
        (window.MyIOUtils?.currentThemeMode || currentThemeMode) === 'dark' ? 'darkMode' : 'lightMode';
      const _busyAccent =
        settings?.tabSelecionadoBackgroundColor || settings?.[_busyMode]?.primaryColor || undefined;
      _loadingSpinnerInstance = MyIOLibrary.createLoadingSpinner({
        minDisplayTime: 800, // Minimum 800ms to avoid flash
        maxTimeout: 25000, // 25 seconds max
        message: 'Carregando dados...',
        spinnerType: 'double',
        theme: 'dark',
        accentColor: _busyAccent, // segue a paleta do dashboard (fallback = roxo padrão)
        showProgress: true, // barra de progresso (indeterminada; setProgress p/ %)
        showTimer: false, // Set to true for debugging
        onTimeout: () => {
          console.warn('[MAIN_UNIQUE] RFC-0137: LoadingSpinner max timeout reached');
          menuBusyVisible = false;
        },
        onComplete: () => {
          console.log('[MAIN_UNIQUE] RFC-0137: LoadingSpinner hidden');
          menuBusyVisible = false;
        },
      });
      console.log('[MAIN_UNIQUE] RFC-0137: LoadingSpinner initialized from MyIOLibrary');
    } else {
      console.warn(
        '[MAIN_UNIQUE] RFC-0137: MyIOLibrary.createLoadingSpinner not available, using legacy overlay'
      );
    }

    return _loadingSpinnerInstance;
  }

  // Legacy busy overlay DOM (fallback when LoadingSpinner not available)
  function ensureMenuBusyDOM() {
    let el = document.getElementById(MENU_BUSY_OVERLAY_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = MENU_BUSY_OVERLAY_ID;
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'background:rgba(15,23,42,0.35)',
      'backdrop-filter:blur(2px)',
      'z-index:999999',
    ].join(';');

    el.innerHTML = `
      <div style="
        background:#0f172a;
        color:#e2e8f0;
        border:1px solid rgba(148,163,184,0.3);
        border-radius:14px;
        padding:18px 22px;
        min-width:260px;
        box-shadow:0 18px 50px rgba(0,0,0,0.45);
        font-family:system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="myio-menu-busy-spinner" style="
            width:20px;height:20px;border-radius:50%;
            border:3px solid rgba(226,232,240,0.35);
            border-top-color:#e2e8f0;animation:myioMenuSpin .9s linear infinite;">
          </div>
          <div id="${MENU_BUSY_OVERLAY_ID}-message" style="font-weight:600; font-size:14px;">
            Carregando dados...
          </div>
        </div>
      </div>
    `;

    if (!document.getElementById('myio-menu-busy-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'myio-menu-busy-style';
      styleEl.textContent =
        '@keyframes myioMenuSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }';
      document.head.appendChild(styleEl);
    }

    document.body.appendChild(el);
    return el;
  }

  /**
   * RFC-0137: Show busy overlay using LoadingSpinner component
   * Falls back to legacy overlay if LoadingSpinner not available
   */
  function showMenuBusy(_domain = 'unknown', message = 'Carregando dados...', timeoutMs = 25000) {
    // RFC-0137: Try to use new LoadingSpinner component
    const spinner = getLoadingSpinner();

    // Clear any pending hide timeout
    if (_pendingHideTimeoutId) {
      clearTimeout(_pendingHideTimeoutId);
      _pendingHideTimeoutId = null;
    }

    if (spinner) {
      // Use new LoadingSpinner component
      if (!menuBusyVisible) {
        spinner.show(message || 'Carregando dados...');
        menuBusyVisible = true;
        console.log(`[MAIN_UNIQUE] 🔄 RFC-0137: LoadingSpinner shown`);
      } else {
        // Update message if already showing
        spinner.updateMessage(message || 'Carregando dados...');
        console.log(`[MAIN_UNIQUE] 🔄 RFC-0137: LoadingSpinner message updated`);
      }
    } else {
      // Fallback to legacy overlay
      const el = ensureMenuBusyDOM();
      const messageEl = el.querySelector(`#${MENU_BUSY_OVERLAY_ID}-message`);
      if (messageEl) {
        messageEl.textContent = message || 'Carregando dados...';
      }

      if (!menuBusyVisible) {
        el.style.display = 'flex';
        menuBusyVisible = true;
      }
    }

    // Clear existing timeout
    if (menuBusyTimeoutId) {
      clearTimeout(menuBusyTimeoutId);
      menuBusyTimeoutId = null;
    }

    // Safety timeout (only for legacy overlay, LoadingSpinner has its own)
    if (!spinner) {
      menuBusyTimeoutId = setTimeout(() => {
        hideMenuBusy({ immediate: true });
      }, timeoutMs);
    }
  }

  /**
   * RFC-0137: Hide busy overlay with optional delay
   * Shows "Dados carregados!" message before hiding
   */
  function hideMenuBusy(options = {}) {
    const { immediate = false, skipDelay = false } = options;

    // Clear any pending hide timeout
    if (_pendingHideTimeoutId) {
      clearTimeout(_pendingHideTimeoutId);
      _pendingHideTimeoutId = null;
    }

    const spinner = getLoadingSpinner();

    // Function to actually perform the hide
    const performHide = () => {
      if (spinner && spinner.isShowing()) {
        spinner.hide();
        console.log(`[MAIN_UNIQUE] ✅ RFC-0137: LoadingSpinner hidden`);
      }

      // Also hide legacy overlay if exists
      const el = document.getElementById(MENU_BUSY_OVERLAY_ID);
      if (el) {
        el.style.display = 'none';
      }

      menuBusyVisible = false;

      if (menuBusyTimeoutId) {
        clearTimeout(menuBusyTimeoutId);
        menuBusyTimeoutId = null;
      }
    };

    // RFC-0137: Apply delay before hiding (unless immediate or skipDelay)
    if (immediate || skipDelay) {
      performHide();
    } else {
      // Show "Dados carregados!" message briefly before hiding
      if (spinner && spinner.isShowing()) {
        spinner.updateMessage('Dados carregados!');
        console.log(
          `[MAIN_UNIQUE] ✅ RFC-0137: Data confirmed, waiting ${SPINNER_HIDE_DELAY_MS}ms before hiding`
        );
      }

      _pendingHideTimeoutId = setTimeout(() => {
        performHide();
        _pendingHideTimeoutId = null;
      }, SPINNER_HIDE_DELAY_MS);
    }
  }

  function applyGlobalTheme(themeMode) {
    const wrap = document.getElementById('mainUniqueWrap');
    if (wrap) {
      wrap.setAttribute('data-theme', themeMode);
    }

    // RFC-0121: Apply background to entire page
    applyBackgroundToPage(themeMode);

    window.dispatchEvent(
      new CustomEvent('myio:theme-change', {
        detail: { themeMode },
      })
    );
  }

  // Issue 8 fix: Map Menu contextIds to classified data keys
  // Menu uses different naming than the classified data structure
  const MENU_TO_CLASSIFIED_CONTEXT_MAP = {
    // Water contexts
    water_common_area: 'hidrometro_area_comum',
    water_stores: 'hidrometro',
    // Temperature contexts
    temperature_sensors: 'termostato',
    temperature_sensors_external: 'termostato_external',
    // Energy contexts (already match)
    equipments: 'equipments',
    stores: 'stores',
    entrada: 'entrada',
  };

  function clearSelectionStore() {
    // NUNCA pode quebrar a navegação: com devices selecionados no footer, um throw
    // aqui matava o switch-main-state silenciosamente (menu mudava, view não —
    // reproduzido na Soul Malls). A API da lib variou: clearAll() (novas) × clear().
    try {
      const store = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
      if (store?.getSelectedIds?.().length > 0) {
        if (typeof store.clearAll === 'function') store.clearAll();
        else if (typeof store.clear === 'function') store.clear();
        LogHelper.log('[MAIN_UNIQUE] SelectionStore cleared on context change');
      }
    } catch (err) {
      LogHelper.warn('[MAIN_UNIQUE] clearSelectionStore falhou (ignorado):', err?.message || err);
    }
  }

  function handleContextChange(tabId, contextId, target) {
    const telemetryContainer = document.getElementById('telemetryGridContainer');

    clearSelectionStore();
    showMenuBusy(tabId, 'Carregando dados...');

    // RFC-0175: Operational tab is handled exclusively via myio:switch-main-state listener
    // (renderOperationalGeneralList / renderAlarmsNotificationsPanel / renderOperationalDashboard)
    if (tabId === 'operational') {
      hideMenuBusy();
    } else if (contextId === 'energy_general') {
      // RFC-0132/RFC-0133: Check if this is a panel view request
      // Show Energy Panel in telemetryGridContainer
      LogHelper.log('[MAIN_UNIQUE] Switching to Energy Panel view');
      switchToEnergyPanel(telemetryContainer);
      currentViewMode = 'energy-panel';
      hideMenuBusy();
    } else if (contextId === 'water_summary') {
      // Show Water Panel in telemetryGridContainer
      LogHelper.log('[MAIN_UNIQUE] Switching to Water Panel view');
      switchToWaterPanel(telemetryContainer);
      currentViewMode = 'water-panel';
      hideMenuBusy();
    } else if (contextId === 'temperature_summary' || contextId === 'temperature_comparison') {
      // RFC-0117: In-page temperature summary panel (replaces the empty-modal path).
      LogHelper.log('[MAIN_UNIQUE] Switching to Temperature Panel view');
      switchToTemperaturePanel(telemetryContainer);
      currentViewMode = 'temperature-panel';
      hideMenuBusy();
    } else {
      // Show Telemetry Grid (default view)
      switchToTelemetryGrid(telemetryContainer, tabId, contextId, target);
      currentViewMode = 'telemetry';
    }

    // Dispatch dashboard state for FOOTER
    window.dispatchEvent(
      new CustomEvent('myio:dashboard-state', {
        detail: { domain: tabId, stateId: target },
      })
    );
  }

  // RFC-0132: Switch to Energy Panel view
  function switchToEnergyPanel(container) {
    if (!container) return;

    // Destroy other views
    if (telemetryGridInstance) {
      telemetryGridInstance.destroy?.();
      telemetryGridInstance = null;
    }
    if (waterPanelInstance) {
      waterPanelInstance.destroy?.();
      waterPanelInstance = null;
    }
    // RFC-0152: Destroy operational grid if exists
    if (operationalGridInstance) {
      operationalGridInstance.destroy?.();
      operationalGridInstance = null;
    }

    // If energy panel already exists, just return
    if (energyPanelInstance) {
      LogHelper.log('[MAIN_UNIQUE] Energy Panel already active');
      return;
    }

    container.innerHTML = '';

    if (MyIOLibrary.createEnergyPanelComponent) {
      // Get summary from orchestrator if available
      const summary = window.MyIOOrchestrator?.getEnergySummary?.() || null;

      energyPanelInstance = MyIOLibrary.createEnergyPanelComponent({
        container: container,
        theme: currentThemeMode,
        period: 7,
        initialSummary: summary,
        showCards: true,
        showConsumptionChart: true,
        showDistributionChart: true,
        enableFullscreen: true,

        onMaximizeClick: () => {
          LogHelper.log('[MAIN_UNIQUE] Energy Panel maximize clicked');
          // Could open fullscreen modal here
        },

        onRefresh: () => {
          LogHelper.log('[MAIN_UNIQUE] Energy Panel refresh requested');
          const newSummary = window.MyIOOrchestrator?.getEnergySummary?.() || null;
          if (newSummary && energyPanelInstance) {
            energyPanelInstance.updateSummary(newSummary);
          }
        },

        onPeriodChange: (days) => {
          LogHelper.log('[MAIN_UNIQUE] Energy Panel period changed:', days);
        },

        onVizModeChange: (mode) => {
          LogHelper.log('[MAIN_UNIQUE] Energy Panel vizMode changed:', mode);
        },

        // Dados REAIS dos gráficos (sem eles a lib usa mocks Aricanduva/Interlagos/…):
        // consumo diário = medidores de entrada canônicos por shopping;
        // distribuição = devices classificados (RFC-0128) por shopping
        fetchConsumptionData: fetchEnergyPanelConsumption,
        fetchDistributionData: fetchEnergyPanelDistribution,
      });

      LogHelper.log('[MAIN_UNIQUE] Energy Panel created successfully');
      injectEnergyPanelPremiumStyles(); // corrige o h3 2rem do TB + visual premium compacto
      // Entrada REAL: busca async o total dos medidores canônicos no período e
      // re-renderiza o painel quando resolver (corrige Entrada/Área Comum/percentuais)
      window.MyIOUtils?.refreshRealEntradaSummary?.();
    } else {
      container.innerHTML =
        '<div style="padding:20px;text-align:center;color:#94a3b8;">EnergyPanel component not available</div>';
      LogHelper.log('[MAIN_UNIQUE] createEnergyPanelComponent not found in MyIOLibrary');
    }
  }

  // RFC-0133: Switch to Water Panel view
  function switchToWaterPanel(container) {
    if (!container) return;

    // Destroy other views
    if (telemetryGridInstance) {
      telemetryGridInstance.destroy?.();
      telemetryGridInstance = null;
    }
    if (energyPanelInstance) {
      energyPanelInstance.destroy?.();
      energyPanelInstance = null;
    }
    // RFC-0152: Destroy operational grid if exists
    if (operationalGridInstance) {
      operationalGridInstance.destroy?.();
      operationalGridInstance = null;
    }

    // If water panel already exists, just return
    if (waterPanelInstance) {
      LogHelper.log('[MAIN_UNIQUE] Water Panel already active');
      return;
    }

    container.innerHTML = '';

    if (MyIOLibrary.createWaterPanelComponent) {
      // Get summary from orchestrator if available
      const summary = window.MyIOOrchestrator?.getWaterSummary?.() || null;

      waterPanelInstance = MyIOLibrary.createWaterPanelComponent({
        container: container,
        theme: currentThemeMode,
        period: 7,
        initialSummary: summary,
        showCards: true,
        showConsumptionChart: true,
        showDistributionChart: true,
        enableFullscreen: true,

        // Gráfico diário REAL (sem isto o WaterPanelView usa o mock Aricanduva):
        // hidrômetros de Lojas + Área Comum + Banheiros por shopping, 1 devices/totals
        // por dia com cache — fiel às abas Água > Lojas/Area Comum (exclui entradas)
        fetchConsumptionData: fetchWaterPanelConsumption,

        // RFC-0133: Real distribution data (replaces the View's hardcoded mock).
        // groups = Lojas vs Área Comum; stores/common = per-shopping breakdown.
        fetchDistributionData: async (mode) => {
          const classified = window.MyIOOrchestratorData?.classified;
          if (!classified) return null;

          const valueOf = (d) => Number(d.value || d.pulses || d.consumption || 0);
          const sum = (arr) => (arr || []).reduce((s, d) => s + valueOf(d), 0);
          const sumByShopping = (arr) => {
            const m = {};
            (arr || []).forEach((d) => {
              const name = d.ownerName || d.customerName || 'Outros';
              m[name] = (m[name] || 0) + valueOf(d);
            });
            return m;
          };

          const stores = classified.water?.hidrometro || [];
          const common = [
            ...(classified.water?.hidrometro_area_comum || []),
            ...(classified.water?.banheiros || []),
          ];

          if (mode === 'groups') return { Lojas: sum(stores), 'Área Comum': sum(common) };
          if (mode === 'stores') return sumByShopping(stores);
          if (mode === 'common') return sumByShopping(common);
          return null;
        },

        onMaximizeClick: () => {
          LogHelper.log('[MAIN_UNIQUE] Water Panel maximize clicked');
        },

        onRefresh: () => {
          LogHelper.log('[MAIN_UNIQUE] Water Panel refresh requested');
          const newSummary = window.MyIOOrchestrator?.getWaterSummary?.() || null;
          if (newSummary && waterPanelInstance) {
            waterPanelInstance.updateSummary(newSummary);
          }
        },

        onPeriodChange: (days) => {
          LogHelper.log('[MAIN_UNIQUE] Water Panel period changed:', days);
        },

        onVizModeChange: (mode) => {
          LogHelper.log('[MAIN_UNIQUE] Water Panel vizMode changed:', mode);
        },
      });

      LogHelper.log('[MAIN_UNIQUE] Water Panel created successfully');
    } else {
      container.innerHTML =
        '<div style="padding:20px;text-align:center;color:#94a3b8;">WaterPanel component not available</div>';
      LogHelper.log('[MAIN_UNIQUE] createWaterPanelComponent not found in MyIOLibrary');
    }
  }

  // RFC-0117: Switch to Temperature summary panel (in-page).
  // Replaces the dead handlePanelModalRequest() path (which guarded on a non-existent
  // MyIOLibrary.createTemperaturePanel and only opened an empty modal). Renders the
  // shopping-level aggregation the legacy TEMPERATURE widget showed — KPI cards plus a
  // per-shopping list with min/avg/max — from the already-classified temperature data.
  function switchToTemperaturePanel(container) {
    if (!container) return;

    // Destroy other views sharing this container
    if (telemetryGridInstance) {
      telemetryGridInstance.destroy?.();
      telemetryGridInstance = null;
    }
    if (energyPanelInstance) {
      energyPanelInstance.destroy?.();
      energyPanelInstance = null;
    }
    if (waterPanelInstance) {
      waterPanelInstance.destroy?.();
      waterPanelInstance = null;
    }
    if (operationalGridInstance) {
      operationalGridInstance.destroy?.();
      operationalGridInstance = null;
    }

    const classified = window.MyIOOrchestratorData?.classified;
    const minTemp = Number(window.MyIOUtils?.temperatureLimits?.minTemperature ?? 18);
    const maxTemp = Number(window.MyIOUtils?.temperatureLimits?.maxTemperature ?? 26);
    const { shoppingsInRange, shoppingsOutOfRange } = buildCustomersTemperatureStatus(
      classified,
      minTemp,
      maxTemp
    );

    const allShoppings = [...shoppingsInRange, ...shoppingsOutOfRange].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const totalSensors =
      (classified?.temperature?.termostato || []).length +
      (classified?.temperature?.termostato_external || []).length;
    const globalAvg = allShoppings.length
      ? allShoppings.reduce((s, sh) => s + sh.avgTemp, 0) / allShoppings.length
      : 0;

    const dark = currentThemeMode === 'dark';
    const cardBg = dark ? '#1e293b' : '#ffffff';
    const pageBg = dark ? '#0f172a' : '#f8fafc';
    const txt = dark ? '#e2e8f0' : '#1e293b';
    const muted = dark ? '#94a3b8' : '#64748b';
    const border = dark ? '#334155' : '#e2e8f0';
    const fmt = (n) => Number(n || 0).toFixed(1);

    const kpi = (label, value, color) => `
      <div style="flex:1;min-width:160px;background:${cardBg};border:1px solid ${border};border-radius:12px;padding:16px;">
        <div style="font-size:12px;color:${muted};margin-bottom:6px;">${label}</div>
        <div style="font-size:26px;font-weight:700;color:${color || txt};">${value}</div>
      </div>`;

    const row = (sh) => {
      const inRange = sh.avgTemp >= minTemp && sh.avgTemp <= maxTemp;
      const pillColor = inRange ? '#10b981' : '#ef4444';
      const pillText = inRange ? 'Dentro da faixa' : 'Fora da faixa';
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid ${border};">
          <div style="flex:2;font-weight:600;color:${txt};">${sh.name}</div>
          <div style="flex:1;color:${muted};font-size:13px;">${sh.deviceCount} sensores</div>
          <div style="flex:1;color:${txt};">min ${fmt(sh.minTemp)}°</div>
          <div style="flex:1;font-weight:700;color:${txt};">méd ${fmt(sh.avgTemp)}°</div>
          <div style="flex:1;color:${txt};">máx ${fmt(sh.maxTemp)}°</div>
          <div style="flex:1;text-align:right;">
            <span style="background:${pillColor}1a;color:${pillColor};border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600;">${pillText}</span>
          </div>
        </div>`;
    };

    const listBody = allShoppings.length
      ? allShoppings.map(row).join('')
      : `<div style="padding:24px;text-align:center;color:${muted};">Nenhum sensor de temperatura com leitura válida.</div>`;

    container.innerHTML = `
      <div style="background:${pageBg};padding:16px;border-radius:12px;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
          ${kpi('Temperatura média', `${fmt(globalAvg)}°C`)}
          ${kpi('Sensores', String(totalSensors))}
          ${kpi(`${_entP()} na faixa`, String(shoppingsInRange.length), '#10b981')}
          ${kpi('Alertas (fora da faixa)', String(shoppingsOutOfRange.length), shoppingsOutOfRange.length ? '#ef4444' : undefined)}
        </div>
        <div style="background:${cardBg};border:1px solid ${border};border-radius:12px;overflow:hidden;">
          <div style="padding:12px 16px;font-weight:700;color:${txt};border-bottom:1px solid ${border};">
            Temperatura por ${_escHtml(_entS())} <span style="color:${muted};font-weight:400;font-size:12px;">(faixa ideal ${minTemp}°–${maxTemp}°C)</span>
          </div>
          ${listBody}
        </div>
      </div>`;

    LogHelper.log('[MAIN_UNIQUE] Temperature Panel rendered:', allShoppings.length, 'shoppings');
  }

  // RFC-0152 Phase 3: Switch to Operational Equipment Grid view
  // eslint-disable-next-line no-unused-vars -- parked: helper kept for re-enable
  function switchToOperationalGrid(container, contextId, target) {
    if (!container) return;

    LogHelper.log('[MAIN_UNIQUE] RFC-0152: switchToOperationalGrid called, context:', contextId);

    // Destroy other views
    if (telemetryGridInstance) {
      telemetryGridInstance.destroy?.();
      telemetryGridInstance = null;
    }
    if (energyPanelInstance) {
      energyPanelInstance.destroy?.();
      energyPanelInstance = null;
    }
    if (waterPanelInstance) {
      waterPanelInstance.destroy?.();
      waterPanelInstance = null;
    }

    // If operational grid already exists, just return
    if (operationalGridInstance) {
      LogHelper.log('[MAIN_UNIQUE] RFC-0152: Operational Grid already active');
      return;
    }

    container.innerHTML = '';

    if (MyIOLibrary.createOperationalGeneralListComponent) {
      // Generate mock equipment data for now (will be replaced with real API data later)
      const mockEquipment = generateMockOperationalEquipment();
      const normalizedEquipment = mockEquipment.map((eq) => ({
        ...eq,
        status: eq.status === 'warning' ? 'maintenance' : eq.status,
      }));

      const customers = Array.from(
        normalizedEquipment.reduce((map, eq) => {
          const id = eq.customerId || eq.customerName;
          if (id && eq.customerName) {
            map.set(id, eq.customerName);
          }
          return map;
        }, new Map())
      ).map(([id, name]) => ({ id, name }));

      operationalGridInstance = MyIOLibrary.createOperationalGeneralListComponent({
        container: container,
        themeMode: currentThemeMode,
        enableDebugMode: settings.enableDebugMode,
        equipment: normalizedEquipment,
        enableSelection: true,
        enableDragDrop: true,
        customers: customers,

        onCardClick: (equipment) => {
          LogHelper.log('[MAIN_UNIQUE] RFC-0152: Equipment clicked:', equipment.name);
        },

        onFilterChange: (filters) => {
          LogHelper.log('[MAIN_UNIQUE] RFC-0152: Operational list filters changed:', filters);
        },

        onStatsUpdate: (stats) => {
          LogHelper.log('[MAIN_UNIQUE] RFC-0152: Operational list stats updated:', stats);
        },
      });

      LogHelper.log('[MAIN_UNIQUE] RFC-0152: Operational General List created successfully');
    } else {
      container.innerHTML =
        '<div style="padding:20px;text-align:center;color:#94a3b8;">OperationalGeneralList component not available</div>';
      LogHelper.log('[MAIN_UNIQUE] RFC-0152: createOperationalGeneralListComponent not found in MyIOLibrary');
    }
  }

  // RFC-0175: Map DeviceAvailability API response to OperationalEquipment[]
  function mapAvailabilityToEquipment(byDevice) {
    LogHelper.log('[RFC-0175][mapAvailability] byDevice count:', (byDevice || []).length);
    if ((byDevice || []).length > 0) {
      const sample = byDevice[0];
      LogHelper.log('[RFC-0175][mapAvailability] SAMPLE raw API fields:', {
        deviceId: sample.deviceId,
        deviceName: sample.deviceName,
        deviceType: sample.deviceType,
        status: sample.status,
        availability: sample.availability,
        mtbfHours: sample.mtbfHours,
        mttrHours: sample.mttrHours,
        mtbf: sample.mtbf,
        mttr: sample.mttr,
        failureCount: sample.failureCount,
        totalDowntimeHours: sample.totalDowntimeHours,
      });
    }

    return (byDevice || []).map((d) => {
      // Infer equipment type from deviceType field or fallback to device name
      const nameLower = (d.deviceName || '').toLowerCase();
      const type =
        d.deviceType === 'ESCADA_ROLANTE'
          ? 'escada'
          : d.deviceType === 'ELEVADOR'
            ? 'elevador'
            : nameLower.includes('escada')
              ? 'escada'
              : nameLower.includes('elevad')
                ? 'elevador'
                : 'other';

      // Map API status ('healthy'|'degraded'|'critical') → EquipmentStatus
      const statusMap = { healthy: 'online', degraded: 'warning', critical: 'offline' };
      const status = statusMap[d.status] || d.status || 'offline';

      // Extract customerName: API field > parentheses in deviceName e.g. "Elevador-11 (Supervia DEODORO)"
      const customerNameFromApi = d.customerName || d.customer || '';
      const customerNameFromDeviceName = (() => {
        const match = (d.deviceName || '').match(/\(([^)]+)\)\s*$/);
        return match ? match[1].trim() : '';
      })();
      const customerName = customerNameFromApi || customerNameFromDeviceName;

      // Strip parenthesized customer suffix from device name for cleaner display
      const cleanDeviceName = customerNameFromDeviceName
        ? (d.deviceName || '').replace(/\s*\([^)]+\)\s*$/, '').trim()
        : d.deviceName || '';

      const mapped = {
        id: d.deviceId,
        name: cleanDeviceName,
        identifier: cleanDeviceName,
        type,
        status,
        customerId: d.customerId || '',
        customerName,
        location: d.location || '',
        availability: d.availability ?? 0,
        mtbf: d.mtbfHours ?? d.mtbf ?? 0,
        mttr: d.mttrHours ?? d.mttr ?? 0,
        hasReversal: d.hasReversal ?? false,
        recentAlerts: d.recentAlarmCount ?? 0,
        openAlarms: d.openAlarmCount ?? 0,
        lastActivityTime: d.lastActivityAt ? new Date(d.lastActivityAt).getTime() : undefined,
        lastMaintenanceTime: d.lastMaintenanceAt ? new Date(d.lastMaintenanceAt).getTime() : undefined,
      };

      LogHelper.log(
        `[RFC-0175][mapAvailability] ${d.deviceName}: availability=${mapped.availability} mtbf=${mapped.mtbf} mttr=${mapped.mttr} status=${mapped.status}`
      );
      return mapped;
    });
  }

  // RFC-0152 Phase 3: Generate mock operational equipment data
  function generateMockOperationalEquipment() {
    const shoppingNames = [
      'Mestre Alvaro',
      'Mont Serrat',
      'Moxuara',
      'Rio Poty',
      'Shopping da Ilha',
      'Metropole Para',
    ];
    const statuses = ['online', 'offline', 'maintenance', 'warning'];
    const locations = ['Piso 1', 'Piso 2', 'Piso 3', 'Torre A', 'Torre B', 'Bloco Central'];

    const equipment = [];

    shoppingNames.forEach((shopping, si) => {
      // Generate 2-4 escalators per shopping
      const escCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < escCount; i++) {
        equipment.push({
          id: `esc-${si}-${i}`,
          name: `ESC-${String(i + 1).padStart(2, '0')}`,
          identifier: `ESC-${shopping.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(2, '0')}`,
          type: 'escada',
          status: statuses[Math.floor(Math.random() * statuses.length)],
          customerId: `customer-${si}`,
          customerName: shopping,
          location: locations[Math.floor(Math.random() * locations.length)],
          availability: 75 + Math.floor(Math.random() * 25),
          mtbf: 100 + Math.floor(Math.random() * 400),
          mttr: 1 + Math.floor(Math.random() * 8),
          hasReversal: Math.random() < 0.1,
          recentAlerts: Math.floor(Math.random() * 5),
          openAlarms: Math.floor(Math.random() * 3),
        });
      }

      // Generate 1-3 elevators per shopping
      const elvCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < elvCount; i++) {
        equipment.push({
          id: `elv-${si}-${i}`,
          name: `ELV-${String(i + 1).padStart(2, '0')}`,
          identifier: `ELV-${shopping.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(2, '0')}`,
          type: 'elevador',
          status: statuses[Math.floor(Math.random() * statuses.length)],
          customerId: `customer-${si}`,
          customerName: shopping,
          location: locations[Math.floor(Math.random() * locations.length)],
          availability: 80 + Math.floor(Math.random() * 20),
          mtbf: 200 + Math.floor(Math.random() * 500),
          mttr: 2 + Math.floor(Math.random() * 6),
          hasReversal: false,
          recentAlerts: Math.floor(Math.random() * 3),
          openAlarms: Math.floor(Math.random() * 2),
        });
      }
    });

    LogHelper.log('[MAIN_UNIQUE] RFC-0152: Generated', equipment.length, 'mock equipment items');
    return equipment;
  }

  // RFC-0152 Phase 5: Render Operational Dashboard
  // RFC-0175 Phase 5: Render Operational Dashboard with real data
  async function renderOperationalDashboard(container) {
    if (!container) return;

    LogHelper.log('[MAIN_UNIQUE] RFC-0175: renderOperationalDashboard called');

    // Destroy other views
    destroyAllPanels();

    if (!MyIOLibrary?.createOperationalDashboardComponent) {
      container.innerHTML =
        '<div style="padding:20px;text-align:center;color:#94a3b8;">OperationalDashboard component not available</div>';
      LogHelper.warn('[MAIN_UNIQUE] RFC-0175: createOperationalDashboardComponent not found in MyIOLibrary');
      return;
    }

    container.innerHTML = '';
    currentViewMode = 'operational-dashboard';

    const defaultKPIs = {
      fleetAvailability: 0,
      availabilityTrend: 0,
      fleetMTBF: 0,
      fleetMTTR: 0,
      totalEquipment: 0,
      onlineCount: 0,
      offlineCount: 0,
      maintenanceCount: 0,
    };

    operationalDashboardInstance = MyIOLibrary.createOperationalDashboardComponent({
      container,
      themeMode: currentThemeMode,
      enableDebugMode: settings.enableDebugMode,
      initialPeriod: 'month',
      kpis: defaultKPIs,
      trendData: [],
      downtimeList: [],
      onPeriodChange: async (period) => {
        LogHelper.log('[MAIN_UNIQUE] RFC-0175: Dashboard period changed:', period);
        await fetchAndUpdateDashboard(period);
      },
      onRefresh: async () => {
        LogHelper.log('[MAIN_UNIQUE] RFC-0175: Dashboard refresh requested');
        const period = operationalDashboardInstance?.getPeriod?.() || 'month';
        MyIOLibrary.AlarmService?.clearCache?.();
        await fetchAndUpdateDashboard(period);
      },
    });

    // Initial data fetch
    await fetchAndUpdateDashboard('month');

    LogHelper.log('[MAIN_UNIQUE] RFC-0175: Operational Dashboard rendered');
  }

  // RFC-0175: Fetch real data and update the dashboard
  async function fetchAndUpdateDashboard(period) {
    const alarmService = MyIOLibrary?.AlarmService;
    const tenantId = GCDR_CUSTOMER_ID;

    if (!alarmService || !tenantId) {
      LogHelper.warn('[MAIN_UNIQUE] RFC-0175: AlarmService or tenantId not available — using TB data only');
      _updateDashboardFromTBOnly();
      return;
    }

    try {
      operationalDashboardInstance?.setLoading?.(true);

      // Map UI period to API parameters
      const apiPeriod = { today: 'day', week: 'week', month: 'month', quarter: 'month' }[period] || 'month';
      const groupBy = { today: 'hour', week: 'day', month: 'day', quarter: 'week' }[period] || 'day';

      const [alarmStats, trendData, topOffenders] = await Promise.all([
        alarmService.getAlarmStats(tenantId, apiPeriod),
        alarmService.getAlarmTrend(tenantId, apiPeriod, groupBy),
        alarmService.getTopDowntime(tenantId, new Map(), 5),
      ]);

      // Compute fleet KPIs from TB device cache + alarm stats
      // _cachedClassified is { energy: { equipments:[], stores:[] }, water:{}, temperature:{} } — flatten first
      const classifiedDevices = [
        ...(_cachedClassified?.energy?.equipments || []),
        ...(_cachedClassified?.energy?.stores || []),
      ];
      const operationalDevices = classifiedDevices.filter((d) => {
        const cat = MyIOLibrary.classifyEquipment?.(d);
        return cat === 'escadas_rolantes' || cat === 'elevadores';
      });

      const total = operationalDevices.length;
      const onlineCount = operationalDevices.filter((d) => {
        const s = MyIOLibrary.calculateDeviceStatusMasterRules?.(d) || '';
        return ['power_on', 'online', 'normal', 'ok', 'running', 'active'].includes(s);
      }).length;
      const offlineCount = total - onlineCount;

      const kpis = {
        fleetAvailability: total > 0 ? (onlineCount / total) * 100 : 0,
        availabilityTrend: 0,
        fleetMTBF: alarmStats.total > 0 ? Math.round((720 / alarmStats.total) * total) : 720,
        fleetMTTR: 0,
        totalEquipment: total,
        onlineCount,
        offlineCount,
        maintenanceCount: 0,
      };

      operationalDashboardInstance?.updateKPIs?.(kpis);
      if (trendData?.length) operationalDashboardInstance?.updateTrendData?.(trendData);
      if (topOffenders?.length) operationalDashboardInstance?.updateDowntimeList?.(topOffenders);

      LogHelper.log('[MAIN_UNIQUE] RFC-0175: Dashboard updated — period:', period, 'total:', total);
    } catch (error) {
      LogHelper.error('[MAIN_UNIQUE] RFC-0175: Failed to fetch dashboard data:', error);
      _updateDashboardFromTBOnly();
    } finally {
      operationalDashboardInstance?.setLoading?.(false);
    }
  }

  // RFC-0175: Fallback — populate dashboard using only ThingsBoard device data
  function _updateDashboardFromTBOnly() {
    // _cachedClassified is { energy: { equipments:[], stores:[] }, water:{}, temperature:{} } — flatten first
    const classifiedDevices = [
      ...(_cachedClassified?.energy?.equipments || []),
      ...(_cachedClassified?.energy?.stores || []),
    ];
    const operationalDevices = classifiedDevices.filter((d) => {
      const cat = MyIOLibrary.classifyEquipment?.(d);
      return cat === 'escadas_rolantes' || cat === 'elevadores';
    });

    const total = operationalDevices.length;
    const onlineCount = operationalDevices.filter((d) => {
      const s = MyIOLibrary.calculateDeviceStatusMasterRules?.(d) || '';
      return ['power_on', 'online', 'normal', 'ok', 'running', 'active'].includes(s);
    }).length;

    operationalDashboardInstance?.updateKPIs?.({
      fleetAvailability: total > 0 ? (onlineCount / total) * 100 : 0,
      availabilityTrend: 0,
      fleetMTBF: 0,
      fleetMTTR: 0,
      totalEquipment: total,
      onlineCount,
      offlineCount: total - onlineCount,
      maintenanceCount: 0,
    });
  }

  // RFC-0175: Render Operational General List with real data from Alarms Backend
  async function renderOperationalGeneralList(container) {
    if (!container) return;

    // Guard: prevent concurrent async renders triggered by duplicate myio:switch-main-state events
    if (_isRenderingOperationalGrid) {
      LogHelper.log(
        '[MAIN_UNIQUE] RFC-0175: renderOperationalGeneralList already in progress, skipping duplicate call'
      );
      return;
    }
    _isRenderingOperationalGrid = true;

    try {
      LogHelper.log('[MAIN_UNIQUE] RFC-0175: renderOperationalGeneralList called');

      // Destroy other views
      destroyAllPanels();

      if (!MyIOLibrary?.createDeviceOperationalCardGridComponent) {
        container.innerHTML =
          '<div style="padding:20px;text-align:center;color:#94a3b8;">DeviceOperationalCardGrid component not available</div>';
        LogHelper.warn(
          '[MAIN_UNIQUE] RFC-0175: createDeviceOperationalCardGridComponent not found in MyIOLibrary'
        );
        return;
      }

      container.innerHTML = '';
      currentViewMode = 'operational-grid';

      // Show loading message while fetching
      container.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:#94a3b8;font-size:14px;">Carregando dados de disponibilidade...</div>';

      const customerId = GCDR_CUSTOMER_ID;

      if (!customerId) {
        LogHelper.warn('[MAIN_UNIQUE] RFC-0175: GCDR_CUSTOMER_ID not set — cannot fetch availability data');
        container.innerHTML =
          '<div style="padding:20px;text-align:center;color:#94a3b8;">ID do cliente não configurado. Verifique as credenciais.</div>';
        return;
      }

      const alarmService = MyIOLibrary?.AlarmService;
      if (!alarmService) {
        LogHelper.warn('[MAIN_UNIQUE] RFC-0175: AlarmService not available in MyIOLibrary');
        container.innerHTML =
          '<div style="padding:20px;text-align:center;color:#94a3b8;">AlarmService não disponível.</div>';
        return;
      }

      // Last 30 days rolling window
      const now = new Date();
      const endAt = now.toISOString();
      const startAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      LogHelper.log('[MAIN_UNIQUE] RFC-0175: Fetching availability for customer:', customerId);
      const response = await alarmService.getAvailability(customerId, startAt, endAt);
      LogHelper.log('[MAIN_UNIQUE] RFC-0175: Received', response.byDevice?.length ?? 0, 'devices');

      const equipment = mapAvailabilityToEquipment(response.byDevice);
      LogHelper.log(
        '[RFC-0175] Equipment mapped count:',
        equipment.length,
        '— first item sample:',
        equipment[0]
          ? {
              id: equipment[0].id,
              availability: equipment[0].availability,
              mtbf: equipment[0].mtbf,
              mttr: equipment[0].mttr,
            }
          : 'none'
      );

      // Enrich customerName from classified devices (API doesn't return customerName)
      const classified = window.MyIOOrchestratorData?.classified;
      if (classified) {
        const deviceCustomerMap = new Map();
        const allClassified = [
          ...(classified.energy?.equipments || []),
          ...(classified.energy?.stores || []),
          ...(classified.water?.hidrometro || []),
          ...(classified.water?.hidrometro_area_comum || []),
          ...(classified.temperature?.termostato || []),
          ...(classified.temperature?.termostato_external || []),
        ];
        for (const d of allClassified) {
          const key = d.ingestionId || d.entityId || '';
          if (key) deviceCustomerMap.set(key, d.customerName || d.ownerName || '');
        }
        for (const eq of equipment) {
          if (!eq.customerName && eq.id) {
            eq.customerName = deviceCustomerMap.get(eq.id) || '';
          }
        }
        LogHelper.log(
          '[RFC-0175] customerName enriched from classified:',
          deviceCustomerMap.size,
          'devices in map'
        );
      }

      const customers = Array.from(
        equipment.reduce((map, eq) => {
          const id = eq.customerId || eq.customerName;
          if (id && eq.customerName) map.set(id, eq.customerName);
          return map;
        }, new Map())
      ).map(([id, name]) => ({ id, name }));

      container.innerHTML = '';

      operationalGridInstance = MyIOLibrary.createDeviceOperationalCardGridComponent({
        container,
        themeMode: currentThemeMode,
        enableDebugMode: settings.enableDebugMode,
        equipment,
        customers,
        includeSearch: true,
        includeFilters: true,
        includeStats: true,
        enableSelection: true,
        enableDragDrop: true,
        onEquipmentClick: (eq) => {
          LogHelper.log('[MAIN_UNIQUE] RFC-0175: Equipment clicked:', eq.name);
        },
        onEquipmentAction: (action, eq) => {
          LogHelper.log('[MAIN_UNIQUE] RFC-0175: Equipment action:', action, eq.name);
        },
      });

      LogHelper.log(
        '[MAIN_UNIQUE] RFC-0175: Operational General List rendered with',
        equipment.length,
        'devices'
      );
    } catch (err) {
      LogHelper.error('[MAIN_UNIQUE] RFC-0175: Failed to fetch availability data:', err);
      container.innerHTML =
        '<div style="padding:20px;text-align:center;color:#ef4444;">Erro ao carregar dados de disponibilidade. Tente novamente.</div>';
    } finally {
      _isRenderingOperationalGrid = false;
    }
  }

  // RFC-0175 Phase 4: Render Alarms & Notifications Panel with real data
  async function renderAlarmsNotificationsPanel(container) {
    if (!container) return;

    LogHelper.log('[MAIN_UNIQUE] RFC-0175: renderAlarmsNotificationsPanel called');

    // Destroy other views
    destroyAllPanels();

    if (!MyIOLibrary?.createAlarmsNotificationsPanelComponent) {
      container.innerHTML =
        '<div style="padding:20px;text-align:center;color:#94a3b8;">AlarmsNotificationsPanel component not available</div>';
      LogHelper.warn(
        '[MAIN_UNIQUE] RFC-0175: createAlarmsNotificationsPanelComponent not found in MyIOLibrary'
      );
      return;
    }

    container.innerHTML = '';
    currentViewMode = 'alarms-panel';

    const userEmail = window.MyIOUtils?.currentUser?.email || 'unknown';

    // Create component with empty data — real data fetched async below
    alarmsNotificationsPanelInstance = MyIOLibrary.createAlarmsNotificationsPanelComponent({
      container,
      themeMode: currentThemeMode,
      enableDebugMode: settings.enableDebugMode,
      alarmsApiBaseUrl: ALARMS_API_BASE,
      alarmsApiKey: GCDR_API_KEY || window.MyIOUtils?.ALARMS_API_KEY || ALARMS_API_KEY, // master key do HO
      gcdrApiBaseUrl: GCDR_API_BASE,
      alarms: [],
      onAlarmClick: (alarm) => {
        LogHelper.log('[MAIN_UNIQUE] RFC-0175: Alarm clicked:', alarm.title || alarm.id);
      },
      onAlarmAction: async (action, alarm) => {
        LogHelper.log('[MAIN_UNIQUE] RFC-0175: Alarm action:', action, alarm.id);
        const alarmService = MyIOLibrary?.AlarmService;
        if (alarmService) {
          try {
            if (action === 'acknowledge') await alarmService.acknowledgeAlarm(alarm.id, userEmail);
            else if (action === 'snooze') await alarmService.silenceAlarm(alarm.id, userEmail, '4h');
            else if (action === 'escalate') await alarmService.escalateAlarm(alarm.id, userEmail);
            else if (action === 'close') await alarmService.closeAlarm(alarm.id, userEmail);
            // Refresh alarm list after action
            await fetchAndUpdateAlarms();
          } catch (err) {
            LogHelper.error('[MAIN_UNIQUE] RFC-0175: Alarm action failed:', err);
          }
        }
      },
      onTabChange: (tab) => {
        LogHelper.log('[MAIN_UNIQUE] RFC-0175: Alarm tab changed:', tab);
      },
    });

    // Fetch real data
    await fetchAndUpdateAlarms();

    LogHelper.log('[MAIN_UNIQUE] RFC-0175: Alarms & Notifications Panel rendered');
  }

  // Build a Map<gcdrDeviceId, {label, customerName}> from the orchestrator device
  // items (energy/water/temperature). Used to resolve the friendly device label
  // and shopping name for alarms (AlarmService falls back to the raw GCDR
  // deviceId, e.g. "ff00047e-...", and the alarms API does not return
  // customerName). Each device carries gcdrDeviceId.
  function buildGcdrDeviceLabelMap() {
    const map = new Map();
    const orch = window.MyIOOrchestratorData || {};
    const buckets = [orch.energy?.items, orch.water?.items, orch.temperature?.items];
    for (const items of buckets) {
      if (!Array.isArray(items)) continue;
      for (const d of items) {
        const gid = d.gcdrDeviceId;
        if (!gid) continue;
        const label = d.labelOrName || d.label || d.name || '';
        const customerName = d.customerName || d.ownerName || '';
        if (label || customerName) map.set(String(gid), { label, customerName });
      }
    }
    return map;
  }

  // Build the authoritative Set<gcdrDeviceId> of devices orchestrated in THIS
  // dashboard. Source of truth: the `gcdrDeviceId` dataKey of the "AllDevices"
  // datasource (ctx.data) — race-proof, available as soon as the widget has data.
  // Also merges orchestrator items as a secondary source. Used to discard alarms
  // whose device isn't on this dashboard (master API key returns every customer).
  function buildOrchestratedGcdrIdSet() {
    const set = new Set();
    // Primary: AllDevices datasource gcdrDeviceId dataKey (ctx.data)
    try {
      const rows = self.ctx?.data || [];
      for (const row of rows) {
        if ((row?.datasource?.aliasName || '') !== 'AllDevices') continue;
        if ((row?.dataKey?.name || '') !== 'gcdrDeviceId') continue;
        const val = row?.data?.[0]?.[1];
        if (val) set.add(String(val));
      }
    } catch {
      /* noop */
    }
    // Secondary: orchestrator items (already carry gcdrDeviceId)
    const orch = window.MyIOOrchestratorData || {};
    [orch.energy?.items, orch.water?.items, orch.temperature?.items].forEach((items) => {
      if (Array.isArray(items))
        items.forEach((d) => {
          if (d.gcdrDeviceId) set.add(String(d.gcdrDeviceId));
        });
    });
    return set;
  }

  // Replace each alarm's `source` with the friendly device label when `source`
  // is actually a GCDR deviceId (match by gcdrDeviceId), and fill in
  // `customerName` (shopping chip in the alarm card) from the orchestrated
  // device. Alarms whose source is already a real device name are left untouched.
  function enrichAlarmsWithDeviceLabels(alarms, deviceByGcdrId) {
    if (!Array.isArray(alarms) || alarms.length === 0) return alarms;
    const map = deviceByGcdrId || buildGcdrDeviceLabelMap();
    if (map.size === 0) return alarms;
    let resolved = 0;
    const out = alarms.map((a) => {
      const key = String(a.deviceId ?? a.source ?? '');
      const dev = map.get(key);
      if (!dev) return a;
      const next = { ...a };
      if (dev.label && dev.label !== a.source) {
        next.source = dev.label;
        resolved++;
      }
      if (!next.customerName && dev.customerName) next.customerName = dev.customerName;
      return next;
    });
    LogHelper.log(
      `[MAIN_UNIQUE] RFC-0175: device labels resolved by gcdrDeviceId: ${resolved}/${alarms.length}`
    );
    return out;
  }

  // Recompute the panel summary from a filtered alarm list. The API summary
  // reflects the UNFILTERED dataset (master API key returns every customer),
  // so after discarding non-orchestrated alarms the counts must be rebuilt.
  function buildAlarmSummaryFromList(alarms) {
    const byState = {};
    const bySeverity = {};
    const byAlarmType = {};
    for (const a of alarms) {
      if (a.state) byState[a.state] = (byState[a.state] || 0) + 1;
      if (a.severity) bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
      const t = a.tags?.alarmType || a.alarmType;
      if (t) byAlarmType[t] = (byAlarmType[t] || 0) + 1;
    }
    return { total: alarms.length, byState, bySeverity, byAlarmType };
  }

  // RFC-0175: Fetch real alarm data and update the panel
  async function fetchAndUpdateAlarms() {
    const alarmService = MyIOLibrary?.AlarmService;

    if (!alarmService) {
      LogHelper.warn('[MAIN_UNIQUE] RFC-0175: AlarmService not available — cannot fetch alarms');
      return;
    }

    try {
      alarmsNotificationsPanelInstance?.setLoading?.(true);
      const tenantId = GCDR_CUSTOMER_ID;

      // RFC-0178: getAlarms now returns { data, summary }; summary replaces separate getAlarmStats
      // HEAD OFFICE: a chave master retorna alarmes de TODOS os customers do tenant —
      // NÃO passar customerId (o gcdrCustomerId do HO não tem devices → viria vazio);
      // o recorte é feito adiante pelo match com os gcdrDeviceIds orquestrados
      const [response, trend] = await Promise.all([
        alarmService.getAlarms({
          state: ['OPEN', 'ACK', 'ESCALATED', 'SNOOZED'],
          limit: 100,
        }),
        tenantId ? alarmService.getAlarmTrend(tenantId, 'week', 'day').catch(() => []) : Promise.resolve([]),
      ]);

      const deviceByGcdrId = buildGcdrDeviceLabelMap();

      // The head office uses a master API key, so the backend returns alarms
      // from EVERY customer. STRICT MATCH: only keep alarms whose device
      // (alarm.deviceId === gcdrDeviceId) is orchestrated in THIS dashboard
      // (AllDevices datasource). Everything else is discarded.
      const orchestratedIds = buildOrchestratedGcdrIdSet();
      let data = response.data;
      let summary = response.summary;
      const before = data.length;
      if (orchestratedIds.size > 0) {
        data = data.filter((a) => orchestratedIds.has(String(a.deviceId ?? a.source ?? '')));
        summary = buildAlarmSummaryFromList(data);
        LogHelper.log(
          `[MAIN_UNIQUE] RFC-0175: alarms matched by gcdrDeviceId: ${data.length}/${before} (orchestrated=${orchestratedIds.size})`
        );
      } else {
        // No orchestrated devices resolved yet → nothing to match. Render empty
        // instead of leaking every customer's alarms.
        data = [];
        summary = buildAlarmSummaryFromList(data);
        LogHelper.warn(
          '[MAIN_UNIQUE] RFC-0175: gcdrDeviceId set vazio (AllDevices ainda não carregou?) — nenhum alarme renderizado'
        );
      }

      // Resolve friendly device labels + customerName by matching alarm device → gcdrDeviceId
      const alarms = enrichAlarmsWithDeviceLabels(data, deviceByGcdrId);

      alarmsNotificationsPanelInstance?.updateAlarms?.(alarms);
      if (summary) alarmsNotificationsPanelInstance?.updateStats?.(summary);
      if (trend?.length) alarmsNotificationsPanelInstance?.updateTrendData?.(trend);

      LogHelper.log('[MAIN_UNIQUE] RFC-0175: Alarm panel updated with', alarms.length, 'alarms');
    } catch (error) {
      LogHelper.error('[MAIN_UNIQUE] RFC-0175: Failed to fetch alarms:', error);
    } finally {
      alarmsNotificationsPanelInstance?.setLoading?.(false);
    }
  }

  // RFC-0152: Destroy all panels helper
  function destroyAllPanels() {
    if (telemetryGridInstance) {
      telemetryGridInstance.destroy?.();
      telemetryGridInstance = null;
    }
    if (energyPanelInstance) {
      energyPanelInstance.destroy?.();
      energyPanelInstance = null;
    }
    if (waterPanelInstance) {
      waterPanelInstance.destroy?.();
      waterPanelInstance = null;
    }
    if (operationalGridInstance) {
      operationalGridInstance.destroy?.();
      operationalGridInstance = null;
    }
    if (operationalDashboardInstance) {
      operationalDashboardInstance.destroy?.();
      operationalDashboardInstance = null;
    }
    if (alarmsNotificationsPanelInstance) {
      alarmsNotificationsPanelInstance.destroy?.();
      alarmsNotificationsPanelInstance = null;
    }
  }

  // Switch back to Telemetry Grid view
  function switchToTelemetryGrid(container, tabId, contextId, _target) {
    if (!container) return;

    // Destroy panel views
    if (energyPanelInstance) {
      energyPanelInstance.destroy?.();
      energyPanelInstance = null;
    }
    if (waterPanelInstance) {
      waterPanelInstance.destroy?.();
      waterPanelInstance = null;
    }
    // RFC-0152: Destroy operational grid if exists
    if (operationalGridInstance) {
      operationalGridInstance.destroy?.();
      operationalGridInstance = null;
    }
    // RFC-0152: Destroy operational dashboard if exists
    if (operationalDashboardInstance) {
      operationalDashboardInstance.destroy?.();
      operationalDashboardInstance = null;
    }
    // RFC-0152: Destroy alarms panel if exists
    if (alarmsNotificationsPanelInstance) {
      alarmsNotificationsPanelInstance.destroy?.();
      alarmsNotificationsPanelInstance = null;
    }

    // Issue 8 fix: Map menu context to classified data key
    const classifiedContext = MENU_TO_CLASSIFIED_CONTEXT_MAP[contextId] || contextId;

    currentTelemetryDomain = tabId;
    currentTelemetryContext = classifiedContext;

    LogHelper.log(
      `[MAIN_UNIQUE] Context change: menu=${contextId} -> classified=${classifiedContext}, domain=${tabId}`
    );

    // Keep legacy event for backwards compatibility
    window.dispatchEvent(
      new CustomEvent('myio:telemetry-config-change', {
        detail: {
          domain: tabId,
          context: classifiedContext,
          timestamp: Date.now(),
        },
      })
    );

    // If telemetry grid doesn't exist, create it
    if (!telemetryGridInstance && MyIOLibrary.createTelemetryGridComponent) {
      container.innerHTML = '';
      const devices = window.MyIOOrchestrator?.getDevices?.(tabId, classifiedContext) || [];

      telemetryGridInstance = MyIOLibrary.createTelemetryGridComponent({
        container: container,
        domain: tabId,
        context: classifiedContext,
        devices: devices,
        themeMode: currentThemeMode,
        debugActive: settings.enableDebugMode,
        activeTooltipDebug: settings.activeTooltipDebug,
        useNewComponents: true,
        enableSelection: true,
        enableDragDrop: true,
        hideInfoMenuItem: true,
        configTemplate: {
          enableDebugMode: settings.enableDebugMode,
        },
        onDeviceClick: (device) => {
          LogHelper.log('[MAIN_UNIQUE] TelemetryGrid device clicked:', device?.entityLabel);
        },
      });

      LogHelper.log('[MAIN_UNIQUE] TelemetryGrid recreated for context:', classifiedContext);
      if (devices.length > 0) {
        hideMenuBusy();
      }
    } else if (telemetryGridInstance) {
      // Update existing telemetry grid
      const devices = window.MyIOOrchestrator?.getDevices?.(tabId, classifiedContext) || [];
      LogHelper.log(
        `[MAIN_UNIQUE] Updating telemetryGrid: domain=${tabId}, context=${classifiedContext}, devices=${devices.length}`
      );
      telemetryGridInstance.updateConfig(tabId, classifiedContext);
      telemetryGridInstance.updateDevices(devices);
      if (devices.length > 0) {
        hideMenuBusy();
      }
    }
  }

  function handlePanelModalRequest(domain, _panelType) {
    const container = document.getElementById('panelModalContainer');
    if (!container) return;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'myio-panel-modal-overlay';
    overlay.innerHTML = `
      <div class="myio-panel-modal">
        <button class="myio-panel-modal-close" aria-label="Fechar">×</button>
        <div class="myio-panel-modal-content"></div>
      </div>
    `;

    container.appendChild(overlay);

    const panelContent = overlay.querySelector('.myio-panel-modal-content');
    let panelInstance = null;

    // Create appropriate panel based on domain
    if (domain === DOMAIN_ENERGY && MyIOLibrary.createEnergyPanel) {
      panelInstance = MyIOLibrary.createEnergyPanel({
        container: panelContent,
        ctx: self.ctx,
        themeMode: currentThemeMode,
        configTemplate: { title: 'Gestao de Energia', defaultPeriod: 7 },
        fetchConsumptionData: async (period) => {
          // Fetch from orchestrator
          return window.MyIOOrchestrator?.fetchEnergyConsumption?.(period);
        },
        onError: (err) => console.error('[EnergyPanel]', err),
      });
    } else if (domain === DOMAIN_WATER && MyIOLibrary.createWaterPanel) {
      panelInstance = MyIOLibrary.createWaterPanel({
        container: panelContent,
        ctx: self.ctx,
        themeMode: currentThemeMode,
        configTemplate: { title: 'Gestao de Agua', defaultPeriod: 7 },
        fetchConsumptionData: async (period) => {
          return window.MyIOOrchestrator?.fetchWaterConsumption?.(period);
        },
        onError: (err) => console.error('[WaterPanel]', err),
      });
    } else if (domain === DOMAIN_TEMPERATURE && MyIOLibrary.createTemperaturePanel) {
      panelInstance = MyIOLibrary.createTemperaturePanel({
        container: panelContent,
        ctx: self.ctx,
        themeMode: currentThemeMode,
        configTemplate: { targetTemp: 23, targetTolerance: 2, defaultPeriod: 7 },
        onError: (err) => console.error('[TemperaturePanel]', err),
      });
    }

    // Close handler
    const closeBtn = overlay.querySelector('.myio-panel-modal-close');
    closeBtn.addEventListener('click', () => {
      panelInstance?.destroy?.();
      overlay.remove();
    });

    // ESC key handler
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        panelInstance?.destroy?.();
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        panelInstance?.destroy?.();
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }

  async function initializeOrchestrator() {
    // Initialize MyIOOrchestrator with AllDevices datasource
    if (!window.MyIOOrchestrator) {
      window.MyIOOrchestrator = {};
    }

    // Classify devices when data arrives
    // This will be called from onDataUpdated
  }

  // === 11. RFC-0127: PROCESS DATA AFTER INITIALIZATION ===
  // Wait for ThingsBoard to populate ctx.data, then process and dispatch events
  // Using setTimeout to ensure data is available after all async initialization
  const processDataWithRetry = (attempts = 0) => {
    const maxAttempts = 10;
    const delay = 500; // 500ms between attempts

    const allData = self.ctx?.data || [];
    if (allData.length === 0 && attempts < maxAttempts) {
      LogHelper.log(`[MAIN_UNIQUE] Waiting for data... attempt ${attempts + 1}/${maxAttempts}`);
      setTimeout(() => processDataWithRetry(attempts + 1), delay);
      return;
    }

    if (allData.length === 0) {
      LogHelper.warn('[MAIN_UNIQUE] No data available after max attempts');
      return;
    }

    // Process data and dispatch events
    const success = processDataAndDispatchEvents();
    if (success) {
      LogHelper.log('[MAIN_UNIQUE] Data processed successfully on init');

      // Update menu with shoppings
      if (_menuInstanceRef && _cachedShoppings.length > 0) {
        _menuInstanceRef.updateShoppings?.(_cachedShoppings);
      }
    }
  };

  // Start data processing after a short delay
  setTimeout(() => processDataWithRetry(), 100);

  // RFC-0140: Start API enrichment after data processing has had time to classify devices
  // This must be called from within onInit to ensure LogHelper is initialized
  setTimeout(() => {
    LogHelper.log('[MAIN_UNIQUE] RFC-0140: Starting API enrichment from onInit');
    triggerApiEnrichment();
  }, 3000);

  LogHelper.log('[MAIN_UNIQUE] onInit complete');
};

// ===================================================================
// onDataUpdated - Called when ThingsBoard datasource updates
// RFC-0111: Added data hash check to prevent infinite loop
// RFC-0111: Added throttle to max 4 calls
// ===================================================================
self.onDataUpdated = function () {
  // RFC-0127: onDataUpdated intentionally left empty
  // All data processing is done in onInit via processDataAndDispatchEvents()
  // This prevents timing issues with early event handlers caching stale data
};

// ===================================================================
// RFC-0127: Process data and dispatch events
// Called from onInit after data is available
// ===================================================================
function processDataAndDispatchEvents() {
  const allData = self.ctx.data || [];

  // RFC-0111: Filter to only use "AllDevices" datasource, ignore "customers" and others
  const data = allData.filter((row) => {
    const aliasName = row.datasource?.aliasName || '';
    return aliasName === 'AllDevices';
  });

  LogHelper.log(
    `[MAIN_UNIQUE] processDataAndDispatchEvents - Total rows: ${allData.length}, AllDevices rows: ${data.length}`
  );

  // Skip if no data from AllDevices
  if (data.length === 0) {
    LogHelper.log('[MAIN_UNIQUE] No data from AllDevices datasource - check alias configuration');
    return false;
  }

  // Classify all devices from AllDevices datasource
  const classified = classifyAllDevices(data);

  // Build shopping cards for welcome modal
  const shoppingCards = buildCustomerCards(classified);

  // Calculate device counts
  const deviceCounts = calculateDeviceCounts(classified);

  // Update module-level cache
  _cachedClassified = classified;
  _cachedDeviceCounts = deviceCounts;
  _cachedShoppings = buildCustomersList(allData);

  // Dispatch data ready event
  window.dispatchEvent(
    new CustomEvent('myio:data-ready', {
      detail: {
        classified,
        shoppingCards,
        deviceCounts,
        shoppings: _cachedShoppings,
        timestamp: Date.now(),
      },
    })
  );

  // RFC-0113: Dispatch initial summary events for header component
  const orch = window.MyIOOrchestratorData || {};
  const energyItems = orch.energy?.items || [];
  const waterItems = orch.water?.items || [];
  const temperatureItems = orch.temperature?.items || [];

  LogHelper.log('MyIOOrchestratorData.energy.items count:', energyItems.length);
  LogHelper.log('MyIOOrchestratorData.water.items count:', waterItems.length);

  // Calculate totals
  const energyTotal = energyItems.reduce((sum, d) => sum + Number(d.value || d.consumption || 0), 0);
  const waterTotal = waterItems.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0);
  const tempValues = temperatureItems.map((d) => Number(d.temperature || 0)).filter((v) => v > 0);
  const tempAvg = tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : null;

  // RFC-0126: Build tooltip status data for each domain
  const allEnergyDevices = [...(classified.energy.equipments || []), ...(classified.energy.stores || [])];
  const allWaterDevices = [
    ...(classified.water.hidrometro_entrada || []),
    ...(classified.water.banheiros || []),
    ...(classified.water.hidrometro_area_comum || []),
    ...(classified.water.hidrometro || []),
  ];
  const allTempDevices = [
    ...(classified.temperature.termostato || []),
    ...(classified.temperature.termostato_external || []),
  ];

  const energyByStatus = buildTooltipStatusData(allEnergyDevices);
  const waterByStatus = buildTooltipStatusData(allWaterDevices);
  const tempByStatus = buildTooltipStatusData(allTempDevices);

  // Get temperature limits from MyIOUtils
  const minTemp = Number(window.MyIOUtils?.temperatureLimits?.minTemperature ?? 18);
  const maxTemp = Number(window.MyIOUtils?.temperatureLimits?.maxTemperature ?? 26);

  // Energy summary event
  window.dispatchEvent(
    new CustomEvent('myio:energy-summary-ready', {
      detail: {
        customerTotal: energyTotal,
        unfilteredTotal: energyTotal,
        isFiltered: false,
        equipmentsTotal: classified.energy.equipments.reduce((sum, d) => sum + Number(d.value || 0), 0),
        lojasTotal: classified.energy.stores.reduce((sum, d) => sum + Number(d.value || 0), 0),
        totalDevices: allEnergyDevices.length,
        totalConsumption: energyTotal,
        byStatus: energyByStatus,
        byCategory: buildEnergyCategoryData(classified),
        byShoppingTotal: buildEnergyCategoryDataByShopping(classified),
        shoppingsEnergy: buildCustomersEnergyBreakdown(classified),
        entityLabel: _goalsEntityLabel,
        lastUpdated: new Date().toISOString(),
      },
    })
  );

  // Water summary event
  window.dispatchEvent(
    new CustomEvent('myio:water-summary-ready', {
      detail: {
        filteredTotal: waterTotal,
        unfilteredTotal: waterTotal,
        isFiltered: false,
        totalDevices: allWaterDevices.length,
        totalConsumption: waterTotal,
        byStatus: waterByStatus,
        byCategory: buildWaterCategoryData(classified),
        byShoppingTotal: buildWaterCategoryDataByShopping(classified),
        shoppingsWater: buildCustomersWaterBreakdown(classified),
        entityLabel: _goalsEntityLabel,
        lastUpdated: new Date().toISOString(),
      },
    })
  );

  // Temperature devices with proper status
  const tempDevicesForTooltip = allTempDevices.map((d) => {
    const temp = Number(d.temperature || 0);
    let status = 'unknown';
    if (temp > 0) {
      status = temp >= minTemp && temp <= maxTemp ? 'ok' : 'warn';
    }
    return {
      name: d.labelOrName || d.name || d.label || 'Sensor',
      temp: temp,
      status: status,
    };
  });

  // Calculate shoppings temperature status
  const tempShoppingsStatus = buildCustomersTemperatureStatus(classified, minTemp, maxTemp);

  // Temperature summary event
  window.dispatchEvent(
    new CustomEvent('myio:temperature-data-ready', {
      detail: {
        globalAvg: tempAvg,
        isFiltered: false,
        shoppingsInRange: tempShoppingsStatus.shoppingsInRange,
        shoppingsOutOfRange: tempShoppingsStatus.shoppingsOutOfRange,
        totalDevices: allTempDevices.length,
        devices: tempDevicesForTooltip,
        temperatureMin: minTemp,
        temperatureMax: maxTemp,
        byStatus: tempByStatus,
        lastUpdated: new Date().toISOString(),
      },
    })
  );

  // Equipment count
  const onlineEquipments = classified.energy.equipments.filter((device) => {
    const status = (device.deviceStatus || '').toLowerCase();
    return !['offline', 'no_info', 'not_installed'].includes(status);
  }).length;

  window.dispatchEvent(
    new CustomEvent('myio:equipment-count-updated', {
      detail: {
        totalEquipments: classified.energy.equipments.length,
        filteredEquipments: onlineEquipments,
        allShoppingsSelected: true,
        byStatus: energyByStatus,
        byCategory: buildEnergyCategoryData(classified),
      },
    })
  );

  LogHelper.log('Summary events dispatched');
  return true;
}

// ===================================================================
// RFC-0126: Tooltip Status Data Aggregation
// Builds byStatus structure expected by EnergySummaryTooltip, WaterSummaryTooltip
// ===================================================================
function buildTooltipStatusData(devices) {
  const byStatus = {
    waiting: 0,
    waitingDevices: [],
    weakConnection: 0,
    weakConnectionDevices: [],
    offline: 0,
    offlineDevices: [],
    normal: 0,
    normalDevices: [],
    alert: 0,
    alertDevices: [],
    failure: 0,
    failureDevices: [],
    standby: 0,
    standbyDevices: [],
    noConsumption: 0,
    noConsumptionDevices: [],
  };

  if (!Array.isArray(devices)) return byStatus;

  // RFC-0126 FIX: Define online statuses (from calculateDeviceStatusMasterRules)
  const ONLINE_STATUSES = ['power_on', 'online', 'normal', 'ok', 'running', 'active'];
  const OFFLINE_STATUSES = ['offline', 'no_info'];
  const WAITING_STATUSES = ['waiting', 'aguardando', 'not_installed', 'pending', 'connecting'];
  const WEAK_STATUSES = ['weak_connection', 'conexao_fraca', 'bad'];

  devices.forEach((d) => {
    const rawStatus = (d.deviceStatus || d.status || d.connectionStatus || '').toLowerCase();
    const value = Number(d.value || d.val || d.consumption || d.pulses || 0);
    const deviceInfo = {
      id: d.id || d.entityId || '',
      name: d.labelOrName || d.name || d.deviceName || '',
      value: value,
      customerName: d.customerName || d.ownerName || '',
    };

    // RFC-0126 FIX: Map deviceStatus from calculateDeviceStatusMasterRules to tooltip categories
    // Priority order matters!

    // 1. WAITING/NOT_INSTALLED (device pending installation)
    if (WAITING_STATUSES.includes(rawStatus)) {
      byStatus.waiting++;
      byStatus.waitingDevices.push(deviceInfo);
    }
    // 2. WEAK CONNECTION
    else if (WEAK_STATUSES.includes(rawStatus)) {
      byStatus.weakConnection++;
      byStatus.weakConnectionDevices.push(deviceInfo);
    }
    // 3. OFFLINE (device truly offline)
    else if (OFFLINE_STATUSES.includes(rawStatus)) {
      byStatus.offline++;
      byStatus.offlineDevices.push(deviceInfo);
    }
    // 4. ALERT status
    else if (rawStatus === 'alert' || rawStatus === 'alerta') {
      byStatus.alert++;
      byStatus.alertDevices.push(deviceInfo);
    }
    // 5. FAILURE status
    else if (rawStatus === 'failure' || rawStatus === 'falha') {
      byStatus.failure++;
      byStatus.failureDevices.push(deviceInfo);
    }
    // 6. STANDBY status
    else if (rawStatus === 'standby') {
      byStatus.standby++;
      byStatus.standbyDevices.push(deviceInfo);
    }
    // 7. ONLINE with ZERO consumption = noConsumption
    else if (ONLINE_STATUSES.includes(rawStatus) && value === 0) {
      byStatus.noConsumption++;
      byStatus.noConsumptionDevices.push(deviceInfo);
    }
    // 8. ONLINE with consumption = normal
    else if (ONLINE_STATUSES.includes(rawStatus) && value > 0) {
      byStatus.normal++;
      byStatus.normalDevices.push(deviceInfo);
    }
    // 9. Explicit noConsumption status
    else if (rawStatus === 'no_consumption' || rawStatus === 'sem_consumo') {
      byStatus.noConsumption++;
      byStatus.noConsumptionDevices.push(deviceInfo);
    }
    // 10. Default: check value to decide
    else {
      if (value === 0) {
        byStatus.noConsumption++;
        byStatus.noConsumptionDevices.push(deviceInfo);
      } else {
        byStatus.normal++;
        byStatus.normalDevices.push(deviceInfo);
      }
    }
  });

  return byStatus;
}

/**
 * RFC-0126: Build category data for energy tooltip
 * RFC-0128: Uses centralized equipment classification from library
 * Returns 7 categories: Entrada, Lojas, Climatizacao, Elevadores, Esc. Rolantes, Outros, Area Comum
 */
function buildEnergyCategoryData(classified) {
  // Collect all energy devices
  const allEnergyDevices = [
    ...(classified?.energy?.entrada || []),
    ...(classified?.energy?.equipments || []),
    ...(classified?.energy?.stores || []),
  ];

  // RFC-0128: Use library function for standardized classification (required)
  if (typeof MyIOLibrary?.buildEquipmentCategoryDataForTooltip === 'function') {
    return MyIOLibrary.buildEquipmentCategoryDataForTooltip(allEnergyDevices);
  }

  // Library function not available - show error toast
  if (typeof MyIOLibrary?.MyIOToast?.error === 'function') {
    MyIOLibrary.MyIOToast.error('buildEquipmentCategoryDataForTooltip not available in MyIOLibrary');
  } else {
    console.error('[MAIN_UNIQUE] buildEquipmentCategoryDataForTooltip not available in MyIOLibrary');
  }

  return [];
}

/**
 * RFC-0126: Build energy tooltip tree grouped by Shopping -> Categoria
 * This matches the legacy tooltip expectation (Shopping + Categoria).
 */
function buildEnergyCategoryDataByShopping(classified) {
  const equipments = classified?.energy?.equipments || [];
  const stores = classified?.energy?.stores || [];

  const allDevices = [...equipments, ...stores];
  const globalTotal = allDevices.reduce((sum, d) => sum + Number(d.value || d.consumption || 0), 0);

  const byShopping = new Map();

  const getShoppingName = (d) => d.ownerName || d.customerName || 'Unknown';

  const add = (bucket, d, kind) => {
    const value = Number(d.value || d.consumption || 0);
    bucket.totalConsumption += value;
    bucket.totalDevices += 1;

    if (kind === 'equipment') {
      bucket.equipDevices.push(d);
      bucket.equipConsumption += value;
    } else {
      bucket.storeDevices.push(d);
      bucket.storeConsumption += value;
    }
  };

  equipments.forEach((d) => {
    const name = getShoppingName(d);
    const key = name.toLowerCase().trim();
    if (!byShopping.has(key)) {
      byShopping.set(key, {
        name,
        totalDevices: 0,
        totalConsumption: 0,
        equipDevices: [],
        storeDevices: [],
        equipConsumption: 0,
        storeConsumption: 0,
      });
    }
    add(byShopping.get(key), d, 'equipment');
  });

  stores.forEach((d) => {
    const name = getShoppingName(d);
    const key = name.toLowerCase().trim();
    if (!byShopping.has(key)) {
      byShopping.set(key, {
        name,
        totalDevices: 0,
        totalConsumption: 0,
        equipDevices: [],
        storeDevices: [],
        equipConsumption: 0,
        storeConsumption: 0,
      });
    }
    add(byShopping.get(key), d, 'store');
  });

  const shoppings = Array.from(byShopping.values()).sort((a, b) => b.totalConsumption - a.totalConsumption);

  return shoppings.map((s) => {
    const total = s.totalConsumption;

    // Subcategories within Equipamentos (counts only; consumption not split at
    // this level) — pelo deviceProfile (deviceType em desuso)
    const elevatorsCount = s.equipDevices.filter((d) =>
      (d.deviceProfile || '').toLowerCase().includes('elevador')
    ).length;
    const escalatorsCount = s.equipDevices.filter((d) =>
      (d.deviceProfile || '').toLowerCase().includes('escada')
    ).length;
    const hvacCount = s.equipDevices.filter(
      (d) =>
        (d.deviceProfile || '').toLowerCase().includes('ar_condicionado') ||
        (d.deviceProfile || '').toLowerCase().includes('hvac')
    ).length;
    const othersCount = s.equipDevices.length - elevatorsCount - escalatorsCount - hvacCount;

    const equipmentNode = {
      id: 'equipamentos',
      name: 'Equipamentos',
      icon: 'ƒsT‹÷?',
      deviceCount: s.equipDevices.length,
      consumption: s.equipConsumption,
      percentage: total > 0 ? (s.equipConsumption / total) * 100 : 0,
      children: [
        {
          id: 'elevadores',
          name: 'Elevadores',
          icon: 'ÐY>-',
          deviceCount: elevatorsCount,
          consumption: 0,
          percentage: 0,
        },
        {
          id: 'escadas',
          name: 'Escadas Rolantes',
          icon: 'ÐYZ½',
          deviceCount: escalatorsCount,
          consumption: 0,
          percentage: 0,
        },
        { id: 'hvac', name: 'HVAC', icon: 'ƒ?"‹÷?', deviceCount: hvacCount, consumption: 0, percentage: 0 },
        {
          id: 'outros',
          name: 'Outros',
          icon: 'ƒsT‹÷?',
          deviceCount: Math.max(0, othersCount),
          consumption: 0,
          percentage: 0,
        },
      ].filter((c) => c.deviceCount > 0),
    };

    const storesNode = {
      id: 'lojas',
      name: 'Lojas',
      icon: 'ÐY?ª',
      deviceCount: s.storeDevices.length,
      consumption: s.storeConsumption,
      percentage: total > 0 ? (s.storeConsumption / total) * 100 : 0,
    };

    return {
      id: `shopping:${s.name.toLowerCase().trim()}`,
      name: s.name,
      icon: 'ÐY?¬',
      deviceCount: s.totalDevices,
      consumption: s.totalConsumption,
      percentage: globalTotal > 0 ? (s.totalConsumption / globalTotal) * 100 : 0,
      children: [equipmentNode, storesNode].filter((c) => c.deviceCount > 0),
    };
  });
}

/**
 * RFC-0126: Build category data for water tooltip
 * RFC-0111: Updated categories: Entrada, Banheiros, Área Comum, Pontos Não Mapeados, Lojas
 * FIXED: Use deviceCount (not count), add id and percentage
 */
function buildWaterCategoryData(classified) {
  const categories = [];

  const entradaDevices = classified?.water?.hidrometro_entrada || [];
  const banheirosDevices = classified?.water?.banheiros || [];
  const commonAreaDevices = classified?.water?.hidrometro_area_comum || [];
  const storeDevices = classified?.water?.hidrometro || [];

  // Calculate consumption for each category
  const entradaConsumption = entradaDevices.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0);
  const banheirosConsumption = banheirosDevices.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0);
  const commonConsumption = commonAreaDevices.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0);
  const storeConsumption = storeDevices.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0);

  // Pontos Não Mapeados = Entrada - (Banheiros + Área Comum + Lojas)
  const mappedConsumption = banheirosConsumption + commonConsumption + storeConsumption;
  const unmappedConsumption = Math.max(0, entradaConsumption - mappedConsumption);

  // Total = Entrada consumption (as reference) or sum of all categories
  const totalConsumption = entradaConsumption || mappedConsumption;

  // Entrada
  if (entradaDevices.length > 0) {
    categories.push({
      id: 'entrada',
      name: 'Entrada',
      icon: '📥',
      deviceCount: entradaDevices.length,
      consumption: entradaConsumption,
      percentage: totalConsumption > 0 ? (entradaConsumption / totalConsumption) * 100 : 0,
    });
  }

  // Banheiros
  if (banheirosDevices.length > 0) {
    categories.push({
      id: 'banheiros',
      name: 'Banheiros',
      icon: '🚻',
      deviceCount: banheirosDevices.length,
      consumption: banheirosConsumption,
      percentage: totalConsumption > 0 ? (banheirosConsumption / totalConsumption) * 100 : 0,
    });
  }

  // Área Comum
  if (commonAreaDevices.length > 0) {
    categories.push({
      id: 'areaComum',
      name: 'Área Comum',
      icon: '🏢',
      deviceCount: commonAreaDevices.length,
      consumption: commonConsumption,
      percentage: totalConsumption > 0 ? (commonConsumption / totalConsumption) * 100 : 0,
    });
  }

  // Pontos Não Mapeados (calculated, no devices directly)
  if (unmappedConsumption > 0) {
    categories.push({
      id: 'naoMapeados',
      name: 'Pontos Não Mapeados',
      icon: '❓',
      deviceCount: 0,
      consumption: unmappedConsumption,
      percentage: totalConsumption > 0 ? (unmappedConsumption / totalConsumption) * 100 : 0,
    });
  }

  // Lojas
  if (storeDevices.length > 0) {
    categories.push({
      id: 'lojas',
      name: 'Lojas',
      icon: '🏬',
      deviceCount: storeDevices.length,
      consumption: storeConsumption,
      percentage: totalConsumption > 0 ? (storeConsumption / totalConsumption) * 100 : 0,
    });
  }

  return categories;
}

/**
 * RFC-0126: Build water tooltip tree grouped by Shopping -> Categoria
 * RFC-0111: Updated categories: Entrada, Banheiros, Área Comum, Pontos Não Mapeados, Lojas
 */
function buildWaterCategoryDataByShopping(classified) {
  const entradaDevices = classified?.water?.hidrometro_entrada || [];
  const banheirosDevices = classified?.water?.banheiros || [];
  const commonAreaDevices = classified?.water?.hidrometro_area_comum || [];
  const storeDevices = classified?.water?.hidrometro || [];

  const allDevices = [...entradaDevices, ...banheirosDevices, ...commonAreaDevices, ...storeDevices];
  const globalTotal = allDevices.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0);

  const byShopping = new Map();
  const getShoppingName = (d) => d.ownerName || d.customerName || 'Unknown';

  const ensure = (name) => {
    const key = name.toLowerCase().trim();
    if (!byShopping.has(key)) {
      byShopping.set(key, {
        name,
        totalDevices: 0,
        totalConsumption: 0,
        entrada: { devices: [], consumption: 0 },
        banheiros: { devices: [], consumption: 0 },
        areaComum: { devices: [], consumption: 0 },
        lojas: { devices: [], consumption: 0 },
      });
    }
    return byShopping.get(key);
  };

  const add = (bucket, group, d) => {
    const value = Number(d.value || d.pulses || 0);
    bucket.totalDevices += 1;
    bucket.totalConsumption += value;
    bucket[group].devices.push(d);
    bucket[group].consumption += value;
  };

  entradaDevices.forEach((d) => add(ensure(getShoppingName(d)), 'entrada', d));
  banheirosDevices.forEach((d) => add(ensure(getShoppingName(d)), 'banheiros', d));
  commonAreaDevices.forEach((d) => add(ensure(getShoppingName(d)), 'areaComum', d));
  storeDevices.forEach((d) => add(ensure(getShoppingName(d)), 'lojas', d));

  const shoppings = Array.from(byShopping.values()).sort((a, b) => b.totalConsumption - a.totalConsumption);

  return shoppings.map((s) => {
    const total = s.totalConsumption;
    const entradaConsumption = s.entrada.consumption;
    const mappedConsumption = s.banheiros.consumption + s.areaComum.consumption + s.lojas.consumption;
    const unmappedConsumption = Math.max(0, entradaConsumption - mappedConsumption);

    const children = [
      {
        id: 'entrada',
        name: 'Entrada',
        icon: '📥',
        deviceCount: s.entrada.devices.length,
        consumption: s.entrada.consumption,
        percentage: total > 0 ? (s.entrada.consumption / total) * 100 : 0,
      },
      {
        id: 'banheiros',
        name: 'Banheiros',
        icon: '🚻',
        deviceCount: s.banheiros.devices.length,
        consumption: s.banheiros.consumption,
        percentage: total > 0 ? (s.banheiros.consumption / total) * 100 : 0,
      },
      {
        id: 'areaComum',
        name: 'Área Comum',
        icon: '🏢',
        deviceCount: s.areaComum.devices.length,
        consumption: s.areaComum.consumption,
        percentage: total > 0 ? (s.areaComum.consumption / total) * 100 : 0,
      },
      {
        id: 'naoMapeados',
        name: 'Pontos Não Mapeados',
        icon: '❓',
        deviceCount: 0,
        consumption: unmappedConsumption,
        percentage: total > 0 ? (unmappedConsumption / total) * 100 : 0,
      },
      {
        id: 'lojas',
        name: 'Lojas',
        icon: '🏬',
        deviceCount: s.lojas.devices.length,
        consumption: s.lojas.consumption,
        percentage: total > 0 ? (s.lojas.consumption / total) * 100 : 0,
      },
    ].filter((c) => c.deviceCount > 0 || c.consumption > 0);

    return {
      id: `shopping:${s.name.toLowerCase().trim()}`,
      name: s.name,
      icon: 'ÐY?¬',
      deviceCount: s.totalDevices,
      consumption: s.totalConsumption,
      percentage: globalTotal > 0 ? (s.totalConsumption / globalTotal) * 100 : 0,
      children,
    };
  });
}

/**
 * RFC-0126: Build shoppings energy breakdown for tooltip
 * Groups consumption by shopping (ownerName/customerName)
 */
function buildCustomersEnergyBreakdown(classified) {
  const shoppingMap = new Map();

  const allDevices = [...(classified?.energy?.equipments || []), ...(classified?.energy?.stores || [])];

  for (const device of allDevices) {
    const ownerName = device.ownerName || device.customerName || 'Unknown';
    const normalizedName = ownerName.toLowerCase().trim();

    if (!shoppingMap.has(normalizedName)) {
      shoppingMap.set(normalizedName, {
        id: normalizedName,
        name: ownerName,
        equipamentos: 0,
        lojas: 0,
      });
    }

    const entry = shoppingMap.get(normalizedName);
    const value = Number(device.value || device.consumption || 0);

    // Check if it's a store device — deviceProfile apenas (deviceType em desuso)
    const deviceProfile = (device.deviceProfile || '').toUpperCase();
    const isStore = deviceProfile.startsWith('3F_MEDIDOR');

    if (isStore) {
      entry.lojas += value;
    } else {
      entry.equipamentos += value;
    }
  }

  // Sort by total consumption descending
  return Array.from(shoppingMap.values()).sort(
    (a, b) => b.equipamentos + b.lojas - (a.equipamentos + a.lojas)
  );
}

/**
 * RFC-0126: Build shoppings water breakdown for tooltip
 * RFC-0111: Updated categories: Entrada, Banheiros, Área Comum, Pontos Não Mapeados, Lojas
 * Groups consumption by shopping (ownerName/customerName)
 */
function buildCustomersWaterBreakdown(classified) {
  const shoppingMap = new Map();

  const entradaDevices = classified?.water?.hidrometro_entrada || [];
  const banheirosDevices = classified?.water?.banheiros || [];
  const commonAreaDevices = classified?.water?.hidrometro_area_comum || [];
  const storeDevices = classified?.water?.hidrometro || [];

  const allDevices = [...entradaDevices, ...banheirosDevices, ...commonAreaDevices, ...storeDevices];

  for (const device of allDevices) {
    const ownerName = device.ownerName || device.customerName || 'Unknown';
    const normalizedName = ownerName.toLowerCase().trim();

    if (!shoppingMap.has(normalizedName)) {
      shoppingMap.set(normalizedName, {
        id: normalizedName,
        name: ownerName,
        entrada: 0,
        banheiros: 0,
        areaComum: 0,
        lojas: 0,
      });
    }

    const entry = shoppingMap.get(normalizedName);
    const value = Number(device.value || device.pulses || 0);

    // Check category based on device classification
    if (entradaDevices.includes(device)) {
      entry.entrada += value;
    } else if (banheirosDevices.includes(device)) {
      entry.banheiros += value;
    } else if (commonAreaDevices.includes(device)) {
      entry.areaComum += value;
    } else if (storeDevices.includes(device)) {
      entry.lojas += value;
    }
  }

  // Sort by total consumption descending
  return Array.from(shoppingMap.values())
    .map((entry) => {
      // Calculate Pontos Não Mapeados per shopping
      const mappedConsumption = entry.banheiros + entry.areaComum + entry.lojas;
      const naoMapeados = Math.max(0, entry.entrada - mappedConsumption);
      return { ...entry, naoMapeados };
    })
    .sort((a, b) => b.entrada - a.entrada);
}

/**
 * Calculate temperature shoppings status (in range vs out of range)
 * Groups temperature devices by shopping and determines if each shopping's
 * average temperature is within the defined min/max range.
 *
 * @param {Object} classified - Classified device data
 * @param {number} minTemp - Minimum acceptable temperature
 * @param {number} maxTemp - Maximum acceptable temperature
 * @returns {{ shoppingsInRange: Array, shoppingsOutOfRange: Array }}
 */
function buildCustomersTemperatureStatus(classified, minTemp, maxTemp) {
  const termostatoDevices = classified?.temperature?.termostato || [];
  const termostatoExternalDevices = classified?.temperature?.termostato_external || [];
  const allDevices = [...termostatoDevices, ...termostatoExternalDevices];

  if (allDevices.length === 0) {
    return { shoppingsInRange: [], shoppingsOutOfRange: [] };
  }

  // Group devices by shopping
  const shoppingMap = new Map();

  for (const device of allDevices) {
    const ownerName = device.ownerName || device.customerName || 'Unknown';
    const normalizedName = ownerName.toLowerCase().trim();
    const temp = Number(device.temperature || 0);

    if (temp <= 0) continue; // Skip devices with no valid temperature reading

    if (!shoppingMap.has(normalizedName)) {
      shoppingMap.set(normalizedName, {
        name: ownerName,
        temperatures: [],
        deviceCount: 0,
      });
    }

    const entry = shoppingMap.get(normalizedName);
    entry.temperatures.push(temp);
    entry.deviceCount++;
  }

  // Calculate average temperature per shopping and classify
  const shoppingsInRange = [];
  const shoppingsOutOfRange = [];

  for (const [, entry] of shoppingMap) {
    if (entry.temperatures.length === 0) continue;

    const avgTemp = entry.temperatures.reduce((a, b) => a + b, 0) / entry.temperatures.length;
    const isInRange = avgTemp >= minTemp && avgTemp <= maxTemp;

    const shoppingInfo = {
      name: entry.name,
      avgTemp: avgTemp,
      deviceCount: entry.deviceCount,
      minTemp: Math.min(...entry.temperatures),
      maxTemp: Math.max(...entry.temperatures),
    };

    if (isInRange) {
      shoppingsInRange.push(shoppingInfo);
    } else {
      shoppingsOutOfRange.push(shoppingInfo);
    }
  }

  // Sort by name
  shoppingsInRange.sort((a, b) => a.name.localeCompare(b.name));
  shoppingsOutOfRange.sort((a, b) => a.name.localeCompare(b.name));

  return { shoppingsInRange, shoppingsOutOfRange };
}

// ===================================================================
// Device Classification Logic
// ===================================================================
function classifyAllDevices(data) {
  // Guard: LogHelper not ready yet (onInit not complete)
  if (!LogHelper) return null;

  const classified = {
    // RFC-FIX: incluir bomba/motor para capturar BOMBA_HIDRAULICA, BOMBA_INCENDIO, BOMBA_CAG,
    // MOTOR etc. que detectContext retorna com contexto 'bomba'/'motor'. Após o loop esses
    // arrays são fundidos em equipments, mantendo a interface downstream inalterada.
    energy: { equipments: [], stores: [], entrada: [], bomba: [], motor: [] },
    water: { hidrometro_entrada: [], banheiros: [], hidrometro_area_comum: [], hidrometro: [] },
    temperature: { termostato: [], termostato_external: [] },
  };

  // RFC-0111: Group all rows by entityId - ThingsBoard sends 1 row per (device, dataKey)
  // We need to collect ALL dataKeys for each device to get deviceType AND deviceProfile
  const deviceRowsMap = new Map();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const entityId = row.datasource?.entityId || row.datasource?.entity?.id?.id;

    if (!entityId) continue;

    if (!deviceRowsMap.has(entityId)) {
      deviceRowsMap.set(entityId, []);
    }

    deviceRowsMap.get(entityId).push(row);
  }

  LogHelper.log(`Grouping: ${data.length} rows → ${deviceRowsMap.size} unique devices`);

  // Process each device with all its rows
  for (const rows of deviceRowsMap.values()) {
    const device = extractDeviceMetadataFromRows(rows);
    // deviceProfile é a ÚNICA autoridade (deviceType em desuso) — um hidrômetro
    // com deviceType=MOTOR errado tem que cair em water, não energy.
    // getDomainFromProfile é o nome canônico; fallback para o alias em libs antigas.
    const domain = (window.MyIOLibrary.getDomainFromProfile || window.MyIOLibrary.getDomainFromDeviceType)(
      device.deviceProfile
    );
    const context = window.MyIOLibrary.detectContext(device, domain);

    if (classified[domain]?.[context] !== undefined) {
      classified[domain][context].push(device);
    }
  }

  // RFC-FIX: Fundir bomba e motor em equipments — são subcategorias de equipamentos de energia.
  // detectContext retorna 'bomba'/'motor' para BAS, mas MAIN_UNIQUE trata tudo como 'equipments'.
  if (classified.energy.bomba.length || classified.energy.motor.length) {
    LogHelper.log(
      `[classifyAllDevices] Merging BAS equipment contexts into equipments: bomba=${classified.energy.bomba.length}, motor=${classified.energy.motor.length}`
    );
    classified.energy.equipments.push(...classified.energy.bomba, ...classified.energy.motor);
  }

  // Log classification summary - always log this for debugging
  const summary = {
    energy: {
      equipments: classified.energy.equipments.length,
      stores: classified.energy.stores.length,
      entrada: classified.energy.entrada.length,
    },
    water: {
      entrada: classified.water.hidrometro_entrada.length,
      banheiros: classified.water.banheiros.length,
      area_comum: classified.water.hidrometro_area_comum.length,
      lojas: classified.water.hidrometro.length,
    },
    temperature: {
      climatizado: classified.temperature.termostato.length,
      externo: classified.temperature.termostato_external.length,
    },
  };

  LogHelper.log('[MAIN_UNIQUE] Classification summary:', JSON.stringify(summary));

  // RFC-0111: Build flat items arrays for each domain (for tooltip compatibility)
  // Tooltip expects MyIOOrchestratorData[domain].items format
  const energyItems = [
    ...classified.energy.equipments,
    ...classified.energy.stores,
    ...classified.energy.entrada,
  ];

  const waterItems = [
    ...classified.water.hidrometro_entrada,
    ...classified.water.banheiros,
    ...classified.water.hidrometro_area_comum,
    ...classified.water.hidrometro,
  ];

  const temperatureItems = [
    ...classified.temperature.termostato,
    ...classified.temperature.termostato_external,
  ];

  // RFC-0113: Debug logging for tooltip - verify labels and status
  LogHelper.log(
    `Energy items total: ${energyItems.length} (equip: ${classified.energy.equipments.length}, stores: ${classified.energy.stores.length}, entrada: ${classified.energy.entrada.length})`
  );
  LogHelper.log(`Water items total: ${waterItems.length}`);
  LogHelper.log(`Temperature items total: ${temperatureItems.length}`);

  // Cache for getDevices and tooltip
  window.MyIOOrchestratorData = {
    classified,
    timestamp: Date.now(),
    // RFC-0111 FIX: Add domain-specific items arrays for tooltip compatibility
    energy: {
      items: energyItems,
      timestamp: Date.now(),
    },
    water: {
      items: waterItems,
      timestamp: Date.now(),
    },
    temperature: {
      items: temperatureItems,
      timestamp: Date.now(),
    },
  };

  return classified;
}

/**
 * Extract device metadata from a single row
 * Used by buildCustomersList where we iterate row by row
 */
function extractDeviceMetadataToBuildShoppingsList(row) {
  const datasource = row?.datasource || {};
  const entityId = datasource.entityId || null;
  const deviceName = datasource.entityName || 'SEM_NAME';

  // Get value from single row's data
  const getLatestValue = () => {
    if (row.data && row.data.length > 0) {
      const latestData = row.data[row.data.length - 1];

      if (Array.isArray(latestData) && latestData.length >= 2) {
        return latestData[1];
      }
    }

    return null;
  };

  const keyName = row.dataKey?.name;
  const value = getLatestValue();

  return {
    id: entityId,
    entityId: entityId,
    name: deviceName,
    aliasName: datasource.aliasName || '',
    deviceType: keyName === 'deviceType' ? value : '',
    deviceProfile: keyName === 'deviceProfile' ? value : '',
    ingestionId: keyName === 'ingestionId' ? value : '',
    customerId: datasource.entity?.customerId?.id || '',
    customerName: keyName === 'customerName' || keyName === 'ownerName' ? value : '',
  };
}

/**
 * Extract device metadata from ALL rows for a single device
 * ThingsBoard sends 1 row per (device, dataKey), so we need to merge all rows
 */
function extractDeviceMetadataFromRows(rows) {
  // Guard: LogHelper not ready yet (onInit not complete)
  if (!LogHelper) return null;
  if (!rows || rows.length === 0) return null;

  // Use first row for datasource info (same for all rows of same device)
  const firstRow = rows[0];
  const datasource = firstRow.datasource || {};
  const entityId = datasource.entityId;
  const deviceName = datasource.entityName || 'SEM_NAME';
  const entityLabel = datasource.entityLabel || 'SEM_ETIQUEPA';
  const dataKeyValues = {};
  const dataKeyTimestamps = {};

  for (const row of rows) {
    const keyName = row.dataKey?.name;

    if (keyName && row.data && row.data.length > 0) {
      const latestData = row.data[row.data.length - 1];

      if (Array.isArray(latestData) && latestData.length >= 2) {
        dataKeyTimestamps[keyName] = latestData[0]; // timestamp
        dataKeyValues[keyName] = latestData[1]; // value
      }
    }
  }

  // RFC-0111 (2026-07-14): classification is based ONLY on deviceProfile —
  // deviceType está EM DESUSO (chegava errado do provisionamento) e não entra
  // em NENHUMA decisão; o campo continua no item apenas por compat de payload.
  const deviceType = dataKeyValues['deviceType'] || '';
  const deviceProfile = dataKeyValues['deviceProfile'] || '';

  // RFC-0140 FIX: ThingsBoard 'consumption' is INSTANTANEOUS POWER (kW), NOT accumulated consumption (kWh)
  // consumption/val/value for cards should ONLY come from ingestion API enrichment
  // Here we only extract it for instantaneousPower display
  const instantaneousPowerFromTB = dataKeyValues['consumption'] || dataKeyValues['consumption_power'] || null;
  const deviceIdentifier = String(dataKeyValues['identifier'] || 'SEM IDENTIFICADOR').trim();
  const rawConnectionStatus = dataKeyValues['connectionStatus'] || 'no_info';
  const connectionStatus = window.MyIOLibrary.mapConnectionStatus(rawConnectionStatus);
  const labelFromDataKey = dataKeyValues['label'] || '';
  const deviceLabel = labelFromDataKey || entityLabel;
  const deviceMapInstaneousPower =
    dataKeyValues['deviceMapInstaneousPower'] || dataKeyValues['deviceMapInstantaneousPower'] || ''; // deviceMapInstaneousPower
  const consumptionTs = dataKeyTimestamps['consumption'] || null;
  const pulsesTs = dataKeyTimestamps['pulses'] || null;
  const temperatureTs = dataKeyTimestamps[DOMAIN_TEMPERATURE] || null;
  const waterLevelTs = dataKeyTimestamps['water_level'] || null;
  const isWater = deviceProfile.includes('HIDROMETRO');
  const isTemperature = deviceProfile.includes('TERMOSTATO');
  const domain = isWater ? DOMAIN_WATER : isTemperature ? DOMAIN_TEMPERATURE : DOMAIN_ENERGY;

  // RFC-0110: Get domain-specific telemetry timestamp
  let telemetryTimestamp = null;
  if (domain === DOMAIN_ENERGY) {
    telemetryTimestamp = consumptionTs;
  } else if (domain === DOMAIN_WATER) {
    telemetryTimestamp = pulsesTs || waterLevelTs;
  } else if (domain === DOMAIN_TEMPERATURE) {
    telemetryTimestamp = temperatureTs;
  }

  // RFC-0110: Calculate device status using master rules (required)
  const lib = window.MyIOLibrary;
  let deviceStatus = 'offline';

  if (lib?.calculateDeviceStatusMasterRules) {
    deviceStatus = lib.calculateDeviceStatusMasterRules({
      connectionStatus: connectionStatus,
      telemetryTimestamp: telemetryTimestamp,
      delayMins: 1440 * 60, // 24 hours
      domain: domain,
    });
  } else {
    // Library function not available - show error toast
    if (typeof lib?.MyIOToast?.error === 'function') {
      lib.MyIOToast.error('calculateDeviceStatusMasterRules not available in MyIOLibrary');
    } else {
      console.error('[MAIN_UNIQUE] calculateDeviceStatusMasterRules not available in MyIOLibrary');
    }
    deviceStatus = 'offline';
  }

  return {
    // Core IDs
    id: entityId,
    entityId: entityId,

    // RFC-0111 FIX: Names - use deviceLabel for display, keep name for compatibility
    name: deviceName,
    label: deviceLabel, // RFC-0111 FIX: Use proper label (entityLabel or dataKey label)
    labelOrName: deviceLabel, // RFC-0111 FIX: Card component expects labelOrName
    entityLabel: entityLabel, // For compatibility
    aliasName: datasource.aliasName || '',

    // Device classification
    deviceType: deviceType,
    deviceProfile: deviceProfile,

    // Identifiers
    ingestionId: dataKeyValues['ingestionId'] || '',
    identifier: deviceIdentifier,
    deviceIdentifier: deviceIdentifier, // Alias for card component
    centralName: dataKeyValues['centralName'] || '',
    slaveId: dataKeyValues['slaveId'] || '',
    centralId: dataKeyValues['centralId'] || '',
    gcdrDeviceId: dataKeyValues['gcdrDeviceId'] || '', // RFC-0180: GCDR device UUID for Alarms tab
    floor: dataKeyValues['floor'] || '',

    // Customer info
    customerId: dataKeyValues['customerId'] || datasource.entity?.customerId?.id || '',
    customerName: cleanOwnerName(dataKeyValues['customerName'] || dataKeyValues['ownerName'] || ''),
    ownerName: cleanOwnerName(dataKeyValues['ownerName'] || ''), // RFC-0111 FIX: Expose ownerName separately

    // Timestamps
    lastActivityTime: dataKeyValues['lastActivityTime'],
    lastConnectTime: dataKeyValues['lastConnectTime'],
    lastDisconnectTime: dataKeyValues['lastDisconnectTime'],

    // RFC-0140 FIX: Consumption values should ONLY come from ingestion API enrichment
    // ThingsBoard 'consumption' is actually instantaneous power (kW), NOT consumption (kWh)
    // Set to null initially - will be populated by enrichDevicesWithConsumption()
    consumption: null, // Will be set by API enrichment
    val: null, // Will be set by API enrichment - Card component expects val
    value: null, // Will be set by API enrichment
    apiEnriched: false, // Flag to indicate data has NOT been enriched yet

    // Water and temperature telemetry (these come directly from ThingsBoard)
    pulses: dataKeyValues['pulses'],
    temperature: dataKeyValues[DOMAIN_TEMPERATURE],
    water_level: dataKeyValues['water_level'],

    // RFC-0140: Real-time instantaneous power from ThingsBoard (this IS valid from TB)
    // This is the real-time power reading (kW) for display in cards
    instantaneousPower: instantaneousPowerFromTB,
    consumption_power: instantaneousPowerFromTB, // Alias for card component
    consumptionPower: instantaneousPowerFromTB, // Alias for EQUIPMENTS
    operationHours: dataKeyValues['operationHours'] || dataKeyValues['operation_hours'] || null,

    // RFC-0111 FIX: Power limits for EQUIPMENTS status calculation
    deviceMapInstaneousPower: deviceMapInstaneousPower,
    deviceMapInstantaneousPower: deviceMapInstaneousPower, // Alias with correct spelling

    // Status - RFC-0110
    connectionStatus: connectionStatus,
    deviceStatus: deviceStatus, // Calculated status using RFC-0110 rules

    // RFC-0110: Telemetry timestamps for status calculation
    consumptionTs: consumptionTs,
    consumptionTimestamp: consumptionTs, // Alias for EQUIPMENTS
    pulsesTs: pulsesTs,
    temperatureTs: temperatureTs,
    waterLevelTs: waterLevelTs,
    telemetryTimestamp: telemetryTimestamp, // Domain-specific timestamp used for status
    // RFC-0140: Timestamp for instantaneous power (used for stale value detection)
    // Note: ThingsBoard 'consumption' dataKey contains instantaneous power, so its timestamp is correct for power
    instantaneousPowerTs: dataKeyTimestamps['consumption'] || dataKeyTimestamps['consumption_power'] || null,
    consumption_powerTs: dataKeyTimestamps['consumption'] || dataKeyTimestamps['consumption_power'] || null,

    // Domain
    domain: domain,

    // Additional fields for card component
    valType: isWater ? 'water_m3' : 'power_w',
    unit: isWater ? 'm³' : 'kWh',
    icon: isWater ? DOMAIN_WATER : isTemperature ? DOMAIN_TEMPERATURE : DOMAIN_ENERGY,
  };
}

function buildCustomerCards(classified) {
  // Group by customer and build shopping cards
  const customerMap = new Map();

  Object.values(classified).forEach((domainDevices) => {
    Object.values(domainDevices).forEach((devices) => {
      devices.forEach((device) => {
        const customerId = device.customerId || 'unknown';

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            // Required fields for WelcomeModal ShoppingCard type
            title: device.customerName || device.ownerName || 'SEM ETIQUETA PARA O CLIENTE',
            dashboardId: device.dashboardId || 'default-dashboard',
            entityId: device.ingestionId || device.customerId || customerId,
            entityType: 'CUSTOMER',
            // Optional fields
            customerId,
            deviceCounts: { energy: 0, water: 0, temperature: 0 },
            metaCounts: { users: 0, alarms: 0, notifications: 0 },
          });
        }
      });
    });
  });

  // Count devices per domain per customer
  [DOMAIN_ENERGY, DOMAIN_WATER, DOMAIN_TEMPERATURE].forEach((domain) => {
    const domainDevices = classified[domain] || {};
    Object.values(domainDevices).forEach((devices) => {
      devices.forEach((device) => {
        const customerId = device.customerId || 'unknown';
        const card = customerMap.get(customerId);
        if (card) {
          card.deviceCounts[domain]++;
        }
      });
    });
  });

  return Array.from(customerMap.values());
}

function buildCustomersList(data) {
  // RFC-0126: Priority 1 - Extract from the aliasName='customers' datasource
  // This datasource contains customer entities directly with label, id, minTemperature, maxTemperature
  const fromAlias = buildCustomersListFromAlias(data);
  if (fromAlias.length > 0) {
    // RFC-0126: Expose temperature limits globally (like old MAIN controller)
    // Use the first customer with valid temperature limits
    const customerWithLimits = fromAlias.find((c) => c.minTemperature != null || c.maxTemperature != null);
    if (customerWithLimits) {
      if (!window.MyIOUtils) window.MyIOUtils = {};
      if (!window.MyIOUtils.temperatureLimits)
        window.MyIOUtils.temperatureLimits = { minTemperature: null, maxTemperature: null };
      if (
        customerWithLimits.minTemperature != null &&
        window.MyIOUtils.temperatureLimits.minTemperature !== customerWithLimits.minTemperature
      ) {
        window.MyIOUtils.temperatureLimits.minTemperature = customerWithLimits.minTemperature;
        LogHelper.log(
          `[buildCustomersList] Exposed global minTemperature: ${customerWithLimits.minTemperature}`
        );
      }
      if (
        customerWithLimits.maxTemperature != null &&
        window.MyIOUtils.temperatureLimits.maxTemperature !== customerWithLimits.maxTemperature
      ) {
        window.MyIOUtils.temperatureLimits.maxTemperature = customerWithLimits.maxTemperature;
        LogHelper.log(
          `[buildCustomersList] Exposed global maxTemperature: ${customerWithLimits.maxTemperature}`
        );
      }
    }
    return fromAlias;
  }

  // RFC-0126: Priority 2 - Use classified data from MyIOOrchestratorData
  const classified = window.MyIOOrchestratorData?.classified;
  if (classified) {
    return buildCustomersListFromClassified(classified);
  }

  // Fallback: try to extract from raw rows (less reliable)
  const customerMap = new Map();

  data.forEach((row) => {
    const device = extractDeviceMetadataToBuildShoppingsList(row);
    const customerId = device.customerId;

    if (customerId && !customerMap.has(customerId)) {
      customerMap.set(customerId, {
        name: device.customerName || 'Unknown',
        value: device.ingestionId || customerId,
        customerId: customerId,
        ingestionId: device.ingestionId || '',
      });
    }
  });

  return Array.from(customerMap.values());
}

/**
 * RFC-0126: Build customers list from the aliasName='customers' datasource
 * This is the preferred method as it contains customer entities directly
 */
function buildCustomersListFromAlias(data) {
  const customerMap = new Map();

  data.forEach((row) => {
    const aliasName = row?.datasource?.aliasName || '';
    // Contrato do dashboard: o alias dos customers filhos chama-se 'customers'
    // (neutro — vale para shoppings, estações, hospitais…)
    if (aliasName === 'customers') {
      const entityId = row?.datasource?.entityId || '';
      const entityLabel = row?.datasource?.entityLabel || '';
      const dataKey = row?.dataKey?.name || '';
      const latestValue = row?.data?.[row.data.length - 1]?.[1];

      // Initialize customer entry if not exists
      if (entityId && !customerMap.has(entityId)) {
        customerMap.set(entityId, {
          name: entityLabel || 'Unknown',
          value: entityId,
          customerId: entityId,
          ingestionId: '',
          minTemperature: null,
          maxTemperature: null,
        });
      }

      // Update customer with data key values
      const customer = customerMap.get(entityId);
      if (customer) {
        if (dataKey === 'ingestionId' && latestValue) {
          customer.ingestionId = latestValue;
          customer.value = latestValue; // Use ingestionId as value
        }
        if (dataKey === 'minTemperature' && latestValue != null) {
          customer.minTemperature = Number(latestValue);
        }
        if (dataKey === 'maxTemperature' && latestValue != null) {
          customer.maxTemperature = Number(latestValue);
        }
      }
    }
  });

  const result = Array.from(customerMap.values());
  if (result.length > 0) {
    LogHelper.log('[buildCustomersListFromAlias] Built customers list:', result.length, 'customers');
  }
  return result;
}

/**
 * Preenche card.dashboardId a partir do attr SERVER_SCOPE `customerDefaultDashboard`
 * (JSON {dashboardId, dashboardName, ...} gravado pelo modal ⚙️ "Dashboard Padrão").
 * Necessário porque o datasource `customers` dos head offices não tem dataKey
 * `dashboardId` — sem isso os cards do welcome não redirecionam.
 */
// customerId -> dashboardId resolvido do attr customerDefaultDashboard. Fica em
// escopo de módulo porque updateCustomerCardsWithRealCounts RECONSTRÓI os cards a
// cada myio:data-ready — sem esta memória o patch do enrichment era descartado
// pela reconstrução seguinte (corrida observada na Soul Malls).
const _defaultDashboardByCustomer = new Map();

function applyDefaultDashboardToCard(card) {
  if (card?.dashboardId || !card?.customerId) return card;
  const dashId = _defaultDashboardByCustomer.get(card.customerId);
  if (!dashId) return card;
  return { ...card, dashboardId: dashId, clickable: true };
}

async function enrichShoppingCardsWithDefaultDashboards(welcomeModal) {
  const cards = _currentCustomersCards || [];
  const pending = cards.filter(
    (c) => !c.dashboardId && c.customerId && !_defaultDashboardByCustomer.has(c.customerId)
  );
  const jwt = localStorage.getItem('jwt_token');
  if (!jwt) return;
  await Promise.all(
    pending.map(async (card) => {
      try {
        const res = await fetch(
          `/api/plugins/telemetry/CUSTOMER/${card.customerId}/values/attributes/SERVER_SCOPE?keys=customerDefaultDashboard`,
          { headers: { 'X-Authorization': `Bearer ${jwt}` } }
        );
        if (!res.ok) return;
        const attrs = await res.json();
        let v = (attrs || []).find((a) => a.key === 'customerDefaultDashboard')?.value;
        if (typeof v === 'string') {
          try {
            v = JSON.parse(v);
          } catch {
            v = null;
          }
        }
        const dashId = v?.dashboardId;
        if (dashId && String(dashId) !== 'null') {
          _defaultDashboardByCustomer.set(card.customerId, String(dashId));
        }
      } catch (err) {
        LogHelper.warn('[MAIN_UNIQUE] customerDefaultDashboard falhou p/', card.title, err?.message || err);
      }
    })
  );
  if (!_defaultDashboardByCustomer.size) return;
  // Aplica sobre o array CORRENTE (pode ter sido reconstruído durante os fetches)
  _currentCustomersCards = (_currentCustomersCards || []).map(applyDefaultDashboardToCard);
  if (welcomeModal?.updateShoppingCards) {
    welcomeModal.updateShoppingCards([..._currentCustomersCards]);
    LogHelper.log(
      '[MAIN_UNIQUE] Welcome cards enriquecidos com customerDefaultDashboard:',
      _defaultDashboardByCustomer.size
    );
  }
}

/**
 * Build shopping cards from 'customers' datasource with fallback to DEFAULT_SHOPPING_CARDS
 * Extracts: title, dashboardId, entityId, entityType, subtitle
 * Cards without dashboardId are not clickable
 */
function buildCustomerCardsFromDatasource(data) {
  const customerMap = new Map();

  data.forEach((row) => {
    const aliasName = row?.datasource?.aliasName || '';
    // Contrato do dashboard: alias 'customers' (neutro; não existe alias 'Shopping')
    if (aliasName === 'customers') {
      const entityId = row?.datasource?.entityId || '';
      const entityLabel = row?.datasource?.entityLabel || '';
      const entityType = row?.datasource?.entityType || 'CUSTOMER';
      const dataKey = row?.dataKey?.name || '';
      const latestValue = row?.data?.[row.data.length - 1]?.[1];

      // Initialize customer card if not exists
      if (entityId && !customerMap.has(entityId)) {
        customerMap.set(entityId, {
          title: entityLabel || 'Unknown',
          subtitle: 'Dashboard Principal',
          buttonId: `Shopping${entityLabel?.replace(/\s+/g, '') || entityId}`,
          dashboardId: null, // Will be populated from dataKey
          entityId: entityId,
          entityType: entityType,
          customerId: entityId,
          ingestionId: null,
          inaugurationDate: null, // dataKey 'inauguration_date' ('YYYY-MM-DD') — ordenação do Metas × Consumo
          clickable: false, // Default false, set to true if dashboardId is found
          deviceCounts: { energy: null, water: null, temperature: null },
          // null = loading spinner on the meta badges until enrichment resolves
          metaCounts: { users: null, alarms: null, annotations: null },
          metaProgress: 0,
        });
      }

      // Update customer card with data key values
      const card = customerMap.get(entityId);
      if (card) {
        if (dataKey === 'dashboardId' && latestValue) {
          card.dashboardId = latestValue;
          card.clickable = true; // Has dashboardId, so it's clickable
        }
        if (dataKey === 'ingestionId' && latestValue) {
          card.ingestionId = latestValue;
        }
        if (dataKey === 'subtitle' && latestValue) {
          card.subtitle = latestValue;
        }
        if (dataKey === 'inauguration_date' && latestValue) {
          // String 'YYYY-MM-DD' (pode faltar p/ alguns customers) — validada no consumo
          card.inaugurationDate = String(latestValue);
        }
      }
    }
  });

  const cards = Array.from(customerMap.values()).map(applyDefaultDashboardToCard);

  if (cards.length > 0) {
    LogHelper.log(
      '[buildCustomerCardsFromDatasource] Built shopping cards from datasource:',
      cards.length,
      'cards'
    );
    return cards;
  }

  // Fallback to DEFAULT_SHOPPING_CARDS
  LogHelper.log(
    '[buildCustomerCardsFromDatasource] No customers in datasource, using DEFAULT_SHOPPING_CARDS'
  );
  return DEFAULT_SHOPPING_CARDS;
}

/**
 * RFC-0126: Build shoppings list from classified device data
 * Uses the merged device objects which have complete metadata
 */
function buildCustomersListFromClassified(classified) {
  const customerMap = new Map();

  // Iterate through all domains and contexts
  [DOMAIN_ENERGY, DOMAIN_WATER, DOMAIN_TEMPERATURE].forEach((domain) => {
    const domainData = classified[domain] || {};

    Object.values(domainData).forEach((devices) => {
      if (!Array.isArray(devices)) return;

      devices.forEach((device) => {
        const customerId = device.customerId;
        const customerName = device.customerName || device.ownerName || device.centralName || '';
        const ingestionId = device.ingestionId || '';

        if (customerId && !customerMap.has(customerId)) {
          customerMap.set(customerId, {
            name: customerName || 'Unknown',
            value: ingestionId || customerId,
            customerId: customerId,
            ingestionId: ingestionId,
          });
        }
      });
    });
  });

  const result = Array.from(customerMap.values());
  LogHelper.log('[buildCustomersListFromClassified] Built shoppings list:', result.length, 'customers');
  return result;
}

function calculateDeviceCounts(classified) {
  let total = 0;
  let energyTotal = 0;
  let waterTotal = 0;
  let tempSum = 0;
  let tempCount = 0;

  Object.entries(classified).forEach(([domain, contexts]) => {
    Object.values(contexts).forEach((devices) => {
      total += devices.length;
      devices.forEach((device) => {
        if (domain === DOMAIN_ENERGY) {
          energyTotal += device.consumption || 0;
        } else if (domain === DOMAIN_WATER) {
          waterTotal += device.pulses || 0;
        } else if (domain === DOMAIN_TEMPERATURE) {
          if (device.temperature != null) {
            tempSum += device.temperature;
            tempCount++;
          }
        }
      });
    });
  });

  return {
    total,
    energyTotal,
    waterTotal,
    tempAvg: tempCount > 0 ? tempSum / tempCount : null,
  };
}

// ===================================================================
// RFC-0132/0133: Panel summary builders (initialSummary contract)
// Energy/Water panels expect a typed summary object (see energy-panel/types.ts
// EnergySummaryData and water-panel/types.ts WaterSummaryData). Without it the
// 3 water cards and the energy category cards render zeros. These builders derive
// the summary from the already-classified orchestrator data, reusing the same
// RFC-0128 subcategorization the tooltips use, so panels and tooltips stay in sync.
// ===================================================================

// Aggregate device connectivity into the {online, offline, waiting} shape the panels expect.
function summarizePanelStatus(devices) {
  const acc = { online: 0, offline: 0, waiting: 0 };
  (devices || []).forEach((d) => {
    const st = String(d.deviceStatus || d.status || '').toLowerCase();
    if (['offline', 'no_info'].includes(st)) acc.offline++;
    else if (['waiting', 'aguardando', 'not_installed', 'pending', 'connecting'].includes(st)) acc.waiting++;
    else acc.online++;
  });
  return acc;
}

// Build EnergySummaryData from classified energy devices (entrada/equipments/stores).
function buildEnergyPanelSummary(classified) {
  if (!classified) return null;

  const allEnergyDevices = [
    ...(classified.energy?.entrada || []),
    ...(classified.energy?.equipments || []),
    ...(classified.energy?.stores || []),
  ];
  const sum = (arr) => (arr || []).reduce((s, d) => s + Number(d.value || d.consumption || 0), 0);

  const storesTotal = sum(classified.energy?.stores);
  const equipmentsTotal = sum(classified.energy?.equipments);
  const entradaTotal = sum(classified.energy?.entrada);

  // RFC-0128: reuse the library subcategorization (same source as the header tooltip).
  let cat = null;
  if (typeof MyIOLibrary?.buildEquipmentCategorySummary === 'function') {
    cat = MyIOLibrary.buildEquipmentCategorySummary(allEnergyDevices);
  }
  const c = (k) =>
    cat?.[k]
      ? { total: cat[k].consumption || 0, count: cat[k].count || 0, percentage: cat[k].percentage || 0 }
      : { total: 0, count: 0, percentage: 0 };

  const byCategory = {
    entrada: c('entrada'),
    lojas: c('lojas'),
    climatizacao: c('climatizacao'),
    elevadores: c('elevadores'),
    escadas: c('escadas_rolantes'),
    outros: c('outros'),
    areaComum: c('area_comum'),
  };

  const consumidoresTotal =
    byCategory.lojas.total +
    byCategory.climatizacao.total +
    byCategory.elevadores.total +
    byCategory.escadas.total +
    byCategory.outros.total;

  // Entrada REAL (auditoria 2026-07-07): o datasource TB do head-office só tem parte
  // dos medidores de entrada (a soma parcial dava ~294 MWh vs ~1.000 reais, Área Comum
  // 0 e "Total Consumidores 340% da entrada"). Quando o controller publica o total dos
  // medidores CANÔNICOS (attr entradaIngestionIds por shopping, via Data API) em
  // window.MyIOUtils.realEntrada, ele substitui a soma parcial e Área Comum +
  // percentuais são recalculados sobre a entrada verdadeira.
  let entradaFinal = entradaTotal;
  const realEntrada = window.MyIOUtils?.realEntrada;
  if (realEntrada && Number(realEntrada.total) > 0) {
    entradaFinal = Number(realEntrada.total);
    byCategory.entrada = {
      total: entradaFinal,
      count: Number(realEntrada.count) || byCategory.entrada.count,
      percentage: 100,
    };
    const pct = (v) => (entradaFinal > 0 ? (v / entradaFinal) * 100 : 0);
    byCategory.lojas.percentage = pct(byCategory.lojas.total);
    byCategory.climatizacao.percentage = pct(byCategory.climatizacao.total);
    byCategory.elevadores.percentage = pct(byCategory.elevadores.total);
    byCategory.escadas.percentage = pct(byCategory.escadas.total);
    byCategory.outros.percentage = pct(byCategory.outros.total);
    const areaComumReal = Math.max(0, entradaFinal - consumidoresTotal);
    byCategory.areaComum = {
      total: areaComumReal,
      count: byCategory.areaComum.count,
      percentage: pct(areaComumReal),
    };
  }

  return {
    storesTotal,
    equipmentsTotal,
    entradaTotal: entradaFinal,
    areaComumTotal: byCategory.areaComum.total,
    consumidoresTotal,
    total: entradaFinal || consumidoresTotal,
    deviceCount: allEnergyDevices.length,
    byCategory,
    byStatus: summarizePanelStatus(allEnergyDevices),
  };
}

// Build WaterSummaryData from classified water devices (lojas vs área comum + banheiros).
function buildWaterPanelSummary(classified) {
  if (!classified) return null;

  const sum = (arr) => (arr || []).reduce((s, d) => s + Number(d.value || d.pulses || d.consumption || 0), 0);

  const storeDevices = classified.water?.hidrometro || [];
  // Área Comum mirrors getDevices('water','hidrometro_area_comum'): area comum + banheiros.
  const commonDevices = [
    ...(classified.water?.hidrometro_area_comum || []),
    ...(classified.water?.banheiros || []),
  ];

  const storesTotal = sum(storeDevices);
  const commonAreaTotal = sum(commonDevices);
  const total = storesTotal + commonAreaTotal;
  const deviceCount = storeDevices.length + commonDevices.length;

  return {
    storesTotal,
    commonAreaTotal,
    total,
    deviceCount,
    storesPercentage: total > 0 ? (storesTotal / total) * 100 : 0,
    commonAreaPercentage: total > 0 ? (commonAreaTotal / total) * 100 : 0,
    byStatus: summarizePanelStatus([...storeDevices, ...commonDevices]),
  };
}

// ===================================================================
// MyIOOrchestrator - For TELEMETRY to fetch devices and cache
// ===================================================================
window.MyIOOrchestrator = window.MyIOOrchestrator || {};
// RFC-0178/RFC-0180: Expose API base URLs — set inside onInit via ALARMS_API_BASE/GCDR_API_BASE constants

// Get devices by domain and context
window.MyIOOrchestrator.getDevices = function (domain, context) {
  const data = window.MyIOOrchestratorData?.classified;
  if (!data) return [];

  // Special case: water > area_comum should include hidrometro_area_comum + banheiros
  // (all water devices except lojas/entrada)
  if (domain === 'water' && context === 'hidrometro_area_comum') {
    return [...(data.water?.hidrometro_area_comum || []), ...(data.water?.banheiros || [])];
  }

  return data?.[domain]?.[context] || [];
};

// Get cache by domain key (energy, water, temperature)
window.MyIOOrchestrator.getCache = function (cacheKey) {
  const data = window.MyIOOrchestratorData?.classified;
  if (!data || !data[cacheKey]) return new Map();

  // Convert domain devices to Map format expected by TELEMETRY
  const cache = new Map();
  const domainData = data[cacheKey];

  // Flatten all contexts into single cache
  Object.values(domainData).forEach((devices) => {
    devices.forEach((device) => {
      if (device.id) {
        cache.set(device.id, device);
      }
    });
  });

  return cache;
};

// RFC-0132: Energy panel summary (EnergySummaryData) from classified data.
// Previously undefined — createEnergyPanelComponent received initialSummary: null,
// so the energy category cards rendered zeros.
window.MyIOOrchestrator.getEnergySummary = function () {
  return buildEnergyPanelSummary(window.MyIOOrchestratorData?.classified);
};

// RFC-0133: Water panel summary (WaterSummaryData) from classified data.
// Previously undefined — createWaterPanelComponent received initialSummary: null,
// so the 3 water cards (lojas/área comum/total) rendered zeros.
window.MyIOOrchestrator.getWaterSummary = function () {
  return buildWaterPanelSummary(window.MyIOOrchestratorData?.classified);
};

/**
 * RFC-0111: Enrich devices with consumption data from ingestion API
 * Calls /api/v1/telemetry/customers/{customerId}/{domain}/devices/totals
 * and matches results by ingestionId
 *
 * @param {Object} classified - Classified devices object from classifyAllDevices
 * @returns {Promise<Object>} - Enriched classified devices
 */
async function enrichDevicesWithConsumption(classified) {
  // Guard: LogHelper not ready yet (onInit not complete)
  if (!LogHelper) return classified;

  const utils = window.MyIOUtils;
  const lib = window.MyIOLibrary;

  if (!utils || !lib) {
    console.warn('[MAIN_UNIQUE] MyIOUtils or MyIOLibrary not available for enrichment');
    return classified;
  }

  // Get credentials
  const creds = utils.getCredentials?.();
  if (!creds || !creds.clientId || !creds.clientSecret || !creds.customerId) {
    console.warn('[MAIN_UNIQUE] Missing credentials for API enrichment');
    return classified;
  }

  const { clientId, clientSecret, customerId, dataApiHost } = creds;
  // dataApiHost includes /api/v1 — strip it for URL templates that append it manually
  const dataApiBase = dataApiHost.replace(/\/api\/v1\/?$/, '');
  LogHelper.log('Starting API enrichment with customerId:', customerId);

  // Create MyIOAuth instance
  let myIOAuth;
  try {
    myIOAuth = lib.buildMyioIngestionAuth({
      dataApiHost: dataApiHost || '',
      clientId: clientId,
      clientSecret: clientSecret,
    });
  } catch (err) {
    console.error('[MAIN_UNIQUE] Failed to create MyIOAuth:', err);
    return classified;
  }

  // Get token
  let token;
  try {
    token = await myIOAuth.getToken();

    if (!token) {
      console.warn('[MAIN_UNIQUE] Failed to get ingestion token');
      return classified;
    }
  } catch (err) {
    console.error('[MAIN_UNIQUE] Token fetch error:', err);
    return classified;
  }

  let period = window.MyIOLibrary.getDefaultPeriodCurrentMonthSoFar();
  const scopeStartDateISO = self.ctx.$scope.startDateISO;
  const scopeEndDateISO = self.ctx.$scope.endDateISO; // RFC-0140 FIX: Was incorrectly using startDateISO

  if (scopeStartDateISO && scopeEndDateISO) {
    period = {
      startISO: scopeStartDateISO,
      endISO: scopeEndDateISO,
    };
    LogHelper.log('[enrichDevicesWithConsumption] Using scope dates:', period);
  } else {
    LogHelper.log('[enrichDevicesWithConsumption] Using default period:', period);
  }

  // Build ingestionId maps for each domain (for quick lookup)
  const energyIngestionMap = new Map();
  const waterIngestionMap = new Map();

  // Collect all energy devices
  Object.values(classified.energy || {}).forEach((devices) => {
    devices.forEach((device) => {
      if (device.ingestionId) {
        energyIngestionMap.set(device.ingestionId, device);
      }
    });
  });

  // Collect all water devices
  Object.values(classified.water || {}).forEach((devices) => {
    devices.forEach((device) => {
      if (device.ingestionId) {
        waterIngestionMap.set(device.ingestionId, device);
      }
    });
  });

  LogHelper.log(`Energy devices with ingestionId: ${energyIngestionMap.size}`);
  LogHelper.log(`Water devices with ingestionId: ${waterIngestionMap.size}`);

  // Fetch and enrich energy domain
  if (energyIngestionMap.size > 0) {
    try {
      const energyUrl = new URL(
        `${dataApiBase}/api/v1/telemetry/customers/${customerId}/energy/devices/totals`
      );
      energyUrl.searchParams.set('startTime', period.startISO);
      energyUrl.searchParams.set('endTime', period.endISO);
      energyUrl.searchParams.set('deep', '1');

      LogHelper.log('Fetching energy totals from:', energyUrl.toString());

      const res = await fetch(energyUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        const rows = Array.isArray(json) ? json : (json?.data ?? []);

        LogHelper.log(`Energy API returned ${rows.length} rows`);

        // Match by ingestionId and update consumption
        let matchCount = 0;
        for (const row of rows) {
          const apiId = row.id; // ingestionId from API
          const device = energyIngestionMap.get(apiId);

          if (device) {
            const consumptionValue = Number(row.total_value || 0);
            device.consumption = consumptionValue;
            device.val = consumptionValue;
            device.apiEnriched = true;
            matchCount++;
          }
        }

        LogHelper.log(`Energy enrichment: matched ${matchCount}/${rows.length} API rows`);
      } else {
        console.warn(`[MAIN_UNIQUE] Energy API error: ${res.status}`);
      }
    } catch (err) {
      console.error('[MAIN_UNIQUE] Energy enrichment failed:', err);
    }
  }

  // Fetch and enrich water domain
  if (waterIngestionMap.size > 0) {
    try {
      const waterUrl = new URL(
        `${dataApiBase}/api/v1/telemetry/customers/${customerId}/water/devices/totals`
      );

      waterUrl.searchParams.set('startTime', period.startISO);
      waterUrl.searchParams.set('endTime', period.endISO);
      waterUrl.searchParams.set('deep', '1');

      LogHelper.log('Fetching water totals from:', waterUrl.toString());

      const res = await fetch(waterUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        const rows = Array.isArray(json) ? json : (json?.data ?? []);

        LogHelper.log(`Water API returned ${rows.length} rows`);

        // Match by ingestionId and update consumption
        let matchCount = 0;
        for (const row of rows) {
          const apiId = row.id; // ingestionId from API
          const device = waterIngestionMap.get(apiId);

          if (device) {
            const consumptionValue = Number(row.total_value || row.total_volume || row.total_pulses || 0);
            device.consumption = consumptionValue;
            device.val = consumptionValue;
            device.pulses = consumptionValue; // For water, also set pulses
            device.apiEnriched = true;
            matchCount++;
          }
        }

        LogHelper.log(`Water enrichment: matched ${matchCount}/${rows.length} API rows`);
      } else {
        console.warn(`[MAIN_UNIQUE] Water API error: ${res.status}`);
      }
    } catch (err) {
      console.error('[MAIN_UNIQUE] Water enrichment failed:', err);
    }
  }

  // RFC-0189: Temperature enrichment — per-device API fetch to derive lastTelemetryTs for
  // offline detection (RFC-0188). Card value stays ThingsBoard real-time; the API only supplies
  // the ingestion timestamp and last raw value. Disabled by default (enableTemperatureApiDataFetch).
  if (window.MyIOUtils?.enableTemperatureApiDataFetch) {
    try {
      const temperatureIngestionMap = new Map();

      // Collect all temperature devices
      Object.values(classified.temperature || {}).forEach((devices) => {
        devices.forEach((device) => {
          if (device.ingestionId) {
            temperatureIngestionMap.set(device.ingestionId, device);
          }
        });
      });

      if (temperatureIngestionMap.size > 0) {
        LogHelper.log(`Temperature devices with ingestionId: ${temperatureIngestionMap.size}`);

        // Fixed 72-hour window — independent of the dashboard period (we only need the most
        // recent data point, not the period consumption)
        const endTime = new Date().toISOString();
        const startTime = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
        const ingestionIds = [...temperatureIngestionMap.keys()];

        let matchCount = 0;

        // Throttle: head office has ~82 temperature devices — sequential batches of 10
        const BATCH_SIZE = 10;
        for (let i = 0; i < ingestionIds.length; i += BATCH_SIZE) {
          const batch = ingestionIds.slice(i, i + BATCH_SIZE);
          try {
            const results = await Promise.allSettled(
              batch.map(async (ingestionId) => {
                const url = new URL(`${dataApiBase}/api/v1/telemetry/devices/${ingestionId}/temperature`);
                url.searchParams.set('startTime', startTime);
                url.searchParams.set('endTime', endTime);
                url.searchParams.set('granularity', '1h');
                url.searchParams.set('deep', '0');

                const res = await fetch(url.toString(), {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return null;

                const json = await res.json();
                const rows = Array.isArray(json) ? json : [];
                const row = rows.find((r) => r.id === ingestionId) || rows[0] || null;

                if (!row || !Array.isArray(row.consumption) || row.consumption.length === 0) {
                  return null;
                }

                // Last entry = most recent data point from ingestion backend
                const lastEntry = row.consumption[row.consumption.length - 1];
                const lastTelemetryTs = lastEntry?.timestamp ? new Date(lastEntry.timestamp).getTime() : null;
                const lastValue =
                  lastEntry?.value !== undefined && lastEntry?.value !== null
                    ? Number(lastEntry.value)
                    : null;

                return lastTelemetryTs ? { ingestionId, lastTelemetryTs, lastValue } : null;
              })
            );

            for (const result of results) {
              if (result.status === 'fulfilled' && result.value) {
                const device = temperatureIngestionMap.get(result.value.ingestionId);
                if (!device) continue;

                device.lastTelemetryTs = result.value.lastTelemetryTs;
                if (Number.isFinite(result.value.lastValue)) {
                  // Do NOT overwrite device.temperature/val — card value stays ThingsBoard real-time
                  device.lastApiTemperature = result.value.lastValue;
                }
                device.apiEnriched = true;
                matchCount++;

                // RFC-0188: deviceStatus was computed in extractDeviceMetadataFromRows (before
                // enrichment) using only the ThingsBoard timestamp — recompute here so the
                // ingestion timestamp takes precedence for offline detection.
                if (lib.calculateDeviceStatusMasterRules) {
                  device.telemetryTimestamp = result.value.lastTelemetryTs;
                  device.deviceStatus = lib.calculateDeviceStatusMasterRules({
                    connectionStatus: device.connectionStatus,
                    telemetryTimestamp: device.telemetryTimestamp,
                    delayMins: 1440, // 24 hours in MINUTES (production v-5.2.0 semantics)
                    domain: DOMAIN_TEMPERATURE,
                  });
                }
              }
            }
          } catch (batchErr) {
            LogHelper.warn('[MAIN_UNIQUE] Temperature enrichment batch failed (RFC-0189):', batchErr);
          }
        }

        LogHelper.log(
          `Temperature enrichment (RFC-0189): lastTelemetryTs resolved for ${matchCount}/${temperatureIngestionMap.size} devices`
        );
      }
    } catch (err) {
      // Graceful fallback: temperature devices keep their ThingsBoard timestamps/status
      LogHelper.warn('[MAIN_UNIQUE] Temperature enrichment failed (RFC-0189):', err);
    }
  }

  return classified;
}

/**
 * Helper function to use cached enriched data
 * Dispatches all necessary events with cached data instead of fetching from API
 */
function useCachedEnrichedData(enriched) {
  // Rebuild flat items arrays for compatibility
  const energyItems = [...enriched.energy.equipments, ...enriched.energy.stores, ...enriched.energy.entrada];

  const waterItems = [
    ...enriched.water.hidrometro_entrada,
    ...enriched.water.banheiros,
    ...enriched.water.hidrometro_area_comum,
    ...enriched.water.hidrometro,
  ];

  const temperatureItems = [...enriched.temperature.termostato, ...enriched.temperature.termostato_external];

  // Update orchestrator data
  window.MyIOOrchestratorData.classified = enriched;
  window.MyIOOrchestratorData.apiEnrichedAt = Date.now();
  window.MyIOOrchestratorData.energy = { items: energyItems, timestamp: Date.now() };
  window.MyIOOrchestratorData.water = { items: waterItems, timestamp: Date.now() };
  window.MyIOOrchestratorData.temperature = { items: temperatureItems, timestamp: Date.now() };

  LogHelper.log('Using cached enriched data, dispatching events');

  // Dispatch enriched data event
  window.dispatchEvent(
    new CustomEvent('myio:data-enriched', {
      detail: { classified: enriched, timestamp: Date.now(), fromCache: true },
    })
  );

  // Dispatch data-ready event
  const deviceCounts = calculateDeviceCounts(enriched);
  window.dispatchEvent(
    new CustomEvent('myio:data-ready', {
      detail: {
        classified: enriched,
        deviceCounts,
        timestamp: Date.now(),
        apiEnriched: true,
        fromCache: true,
      },
    })
  );

  // Dispatch summary events
  const allEnergyDevices = [...energyItems];
  const allWaterDevices = [...waterItems];

  const energyTotal = allEnergyDevices.reduce((sum, d) => sum + Number(d.value || d.consumption || 0), 0);
  const waterTotal = allWaterDevices.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0);

  const energyByStatus = buildTooltipStatusData(allEnergyDevices);
  const waterByStatus = buildTooltipStatusData(allWaterDevices);

  window.dispatchEvent(
    new CustomEvent('myio:energy-summary-ready', {
      detail: {
        filteredTotal: energyTotal,
        unfilteredTotal: energyTotal,
        isFiltered: false,
        lojasTotal: enriched.energy.stores.reduce((sum, d) => sum + Number(d.value || 0), 0),
        totalDevices: allEnergyDevices.length,
        totalConsumption: energyTotal,
        byStatus: energyByStatus,
        byCategory: buildEnergyCategoryData(enriched),
        byShoppingTotal: buildEnergyCategoryDataByShopping(enriched),
        shoppingsEnergy: buildCustomersEnergyBreakdown(enriched),
        lastUpdated: new Date().toISOString(),
        fromCache: true,
      },
    })
  );

  window.dispatchEvent(
    new CustomEvent('myio:water-summary-ready', {
      detail: {
        filteredTotal: waterTotal,
        unfilteredTotal: waterTotal,
        isFiltered: false,
        totalDevices: allWaterDevices.length,
        totalConsumption: waterTotal,
        byStatus: waterByStatus,
        byCategory: buildWaterCategoryData(enriched),
        byShoppingTotal: buildWaterCategoryDataByShopping(enriched),
        lastUpdated: new Date().toISOString(),
        fromCache: true,
      },
    })
  );

  LogHelper.log('Cached data events dispatched (cache age:', _dataCache.getAge(), 's)');
}

/**
 * RFC-0111: Trigger API enrichment after initial classification
 * This is called asynchronously so it doesn't block the initial render
 */
async function triggerApiEnrichment() {
  // Guard: LogHelper not ready yet (onInit not complete)
  // RFC-0140: This function should only be called from onInit where LogHelper is available
  if (!LogHelper) {
    console.warn('[MAIN_UNIQUE] triggerApiEnrichment: LogHelper not available - this should not happen');
    return;
  }

  // Guard: Only run once
  if (_apiEnrichmentDone || _apiEnrichmentInProgress) {
    LogHelper.log('API enrichment already done or in progress, skipping');
    return;
  }

  // Wait for credentials to be set
  const utils = window.MyIOUtils;
  if (!utils?.getCredentials) {
    _credentialsRetryCount++;

    LogHelper.log(
      `Waiting for credentials to be available... (attempt ${_credentialsRetryCount}/${MAX_CREDENTIALS_RETRIES})`
    );

    if (_credentialsRetryCount >= MAX_CREDENTIALS_RETRIES) {
      LogHelper.log('Max retries exceeded for credentials availability');
      window.MyIOUtils?.handleDataLoadError?.(
        'credentials',
        'Failed to load credentials after 10 attempts - widget stuck in busy state'
      );

      return;
    }

    // Retry after 1 second
    setTimeout(triggerApiEnrichment, 1000);
    return;
  }

  const creds = utils.getCredentials();
  if (!creds?.clientId || !creds?.clientSecret || !creds?.customerId) {
    _credentialsRetryCount++;

    LogHelper.log(
      `Credentials not yet available, retrying... (attempt ${_credentialsRetryCount}/${MAX_CREDENTIALS_RETRIES})`
    );

    if (_credentialsRetryCount >= MAX_CREDENTIALS_RETRIES) {
      LogHelper.log('Max retries exceeded for credentials values');

      window.MyIOUtils?.handleDataLoadError?.(
        'credentials',
        'Credentials incomplete after 10 attempts - widget stuck in busy state'
      );

      return;
    }

    setTimeout(triggerApiEnrichment, 1000);

    return;
  }

  // Get current classified data - must exist before we can enrich
  const classified = window.MyIOOrchestratorData?.classified;
  if (!classified) {
    _classifiedRetryCount++;
    if (_classifiedRetryCount >= MAX_CLASSIFIED_RETRIES) {
      LogHelper.warn(
        `Classified data not available after ${MAX_CLASSIFIED_RETRIES} attempts - aborting API enrichment`
      );
      return;
    }
    LogHelper.log(
      `No classified data available for enrichment, retrying in 1s... (${_classifiedRetryCount}/${MAX_CLASSIFIED_RETRIES})`
    );
    // RFC-0140 FIX: Retry if classified data not ready yet
    setTimeout(triggerApiEnrichment, 1000);
    return;
  }

  // Set in-progress flag (only after classified is available)
  _apiEnrichmentInProgress = true;
  LogHelper.log('Credentials available, starting API enrichment');

  try {
    // ===================================================================
    // Check cache validity (5-minute TTL)
    // If cache is valid, use cached enriched data instead of calling API
    // ===================================================================
    if (_dataCache.isValid()) {
      LogHelper.log('Using cached data (age:', _dataCache.getAge(), 's)');
      const enriched = _dataCache.enrichedData;

      // Use cached enriched data - skip API call
      useCachedEnrichedData(enriched);

      _apiEnrichmentDone = true;
      _apiEnrichmentInProgress = false;
      return;
    }

    LogHelper.log('Cache miss or expired, fetching from API...');

    // Enrich with API data
    const enriched = await enrichDevicesWithConsumption(classified);

    // Save to cache for future use
    _dataCache.set(enriched, classified);

    // RFC-0111 FIX: Rebuild flat items arrays for tooltip compatibility
    const energyItems = [
      ...enriched.energy.equipments,
      ...enriched.energy.stores,
      ...enriched.energy.entrada,
    ];

    const waterItems = [
      ...enriched.water.hidrometro_entrada,
      ...enriched.water.banheiros,
      ...enriched.water.hidrometro_area_comum,
      ...enriched.water.hidrometro,
    ];

    const temperatureItems = [
      ...enriched.temperature.termostato,
      ...enriched.temperature.termostato_external,
    ];

    // Update cache with enriched data and domain items
    window.MyIOOrchestratorData.classified = enriched;
    window.MyIOOrchestratorData.apiEnrichedAt = Date.now();

    window.MyIOOrchestratorData.energy = {
      items: energyItems,
      timestamp: Date.now(),
    };

    window.MyIOOrchestratorData.water = {
      items: waterItems,
      timestamp: Date.now(),
    };

    window.MyIOOrchestratorData.temperature = {
      items: temperatureItems,
      timestamp: Date.now(),
    };

    LogHelper.log('API enrichment complete, dispatching updated event');

    // Dispatch enriched data event
    window.dispatchEvent(
      new CustomEvent('myio:data-enriched', {
        detail: {
          classified: enriched,
          timestamp: Date.now(),
        },
      })
    );

    // Also recalculate device counts and update welcome modal
    const deviceCounts = calculateDeviceCounts(enriched);
    window.dispatchEvent(
      new CustomEvent('myio:data-ready', {
        detail: {
          classified: enriched,
          deviceCounts,
          timestamp: Date.now(),
          apiEnriched: true,
        },
      })
    );

    // RFC-0113: Debug logging - verify item counts for tooltip
    LogHelper.log('MyIOOrchestratorData.energy.items count:', energyItems.length);
    LogHelper.log('MyIOOrchestratorData.water.items count:', waterItems.length);
    LogHelper.log('MyIOOrchestratorData.temperature.items count:', temperatureItems.length);

    // Sample device for debugging (check label and status)
    if (energyItems.length > 0) {
      const sample = energyItems[0];
      LogHelper.log('Sample energy item:', {
        id: sample.id,
        name: sample.name,
        label: sample.label,
        deviceStatus: sample.deviceStatus,
        connectionStatus: sample.connectionStatus,
        value: sample.value,
      });
    }

    // RFC-0113: Dispatch summary events for header component
    // Calculate totals from enriched data
    const energyTotal = energyItems.reduce((sum, d) => sum + Number(d.value || d.consumption || 0), 0);
    const waterTotal = waterItems.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0);
    const tempValues = temperatureItems.map((d) => Number(d.temperature || 0)).filter((v) => v > 0);
    const tempAvg = tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : null;

    // RFC-0126: Build tooltip payloads after enrichment (avoid overwriting with partial data)
    const allEnergyDevicesAfterEnrich = [
      ...(enriched.energy?.equipments || []),
      ...(enriched.energy?.stores || []),
    ];
    const allWaterDevicesAfterEnrich = [
      ...(enriched.water?.hidrometro_entrada || []),
      ...(enriched.water?.banheiros || []),
      ...(enriched.water?.hidrometro_area_comum || []),
      ...(enriched.water?.hidrometro || []),
    ];
    const allTempDevicesAfterEnrich = [
      ...(enriched.temperature?.termostato || []),
      ...(enriched.temperature?.termostato_external || []),
    ];

    const energyByStatusAfterEnrich = buildTooltipStatusData(allEnergyDevicesAfterEnrich);
    const waterByStatusAfterEnrich = buildTooltipStatusData(allWaterDevicesAfterEnrich);
    const tempByStatusAfterEnrich = buildTooltipStatusData(allTempDevicesAfterEnrich);

    const minTemp = Number(window.MyIOUtils?.temperatureLimits?.minTemperature ?? 18);
    const maxTemp = Number(window.MyIOUtils?.temperatureLimits?.maxTemperature ?? 26);

    const tempDevicesForTooltipAfterEnrich = allTempDevicesAfterEnrich.map((d) => {
      const temp = Number(d.temperature || 0);
      let status = 'unknown';
      if (temp > 0) {
        status = temp >= minTemp && temp <= maxTemp ? 'ok' : 'warn';
      }
      return {
        name: d.labelOrName || d.name || d.label || 'Sensor',
        temp: temp,
        status: status,
      };
    });

    // Energy summary event (include tooltip fields)
    window.dispatchEvent(
      new CustomEvent('myio:energy-summary-ready', {
        detail: {
          customerTotal: energyTotal,
          unfilteredTotal: energyTotal,
          isFiltered: false,
          equipmentsTotal: enriched.energy.equipments.reduce((sum, d) => sum + Number(d.value || 0), 0),
          lojasTotal: enriched.energy.stores.reduce((sum, d) => sum + Number(d.value || 0), 0),
          totalDevices: allEnergyDevicesAfterEnrich.length,
          totalConsumption: energyTotal,
          byStatus: energyByStatusAfterEnrich,
          byCategory: buildEnergyCategoryData(enriched),
          byShoppingTotal: buildEnergyCategoryDataByShopping(enriched),
          shoppingsEnergy: buildCustomersEnergyBreakdown(enriched),
          lastUpdated: new Date().toISOString(),
        },
      })
    );

    // Water summary event (include tooltip fields)
    window.dispatchEvent(
      new CustomEvent('myio:water-summary-ready', {
        detail: {
          filteredTotal: waterTotal,
          unfilteredTotal: waterTotal,
          isFiltered: false,
          totalDevices: allWaterDevicesAfterEnrich.length,
          totalConsumption: waterTotal,
          byStatus: waterByStatusAfterEnrich,
          byCategory: buildWaterCategoryData(enriched),
          byShoppingTotal: buildWaterCategoryDataByShopping(enriched),
          shoppingsWater: buildCustomersWaterBreakdown(enriched),
          lastUpdated: new Date().toISOString(),
        },
      })
    );

    // Calculate shoppings temperature status after enrichment
    const tempShoppingsStatusAfterEnrich = buildCustomersTemperatureStatus(enriched, minTemp, maxTemp);

    // Temperature summary event (include tooltip fields)
    window.dispatchEvent(
      new CustomEvent('myio:temperature-data-ready', {
        detail: {
          globalAvg: tempAvg,
          isFiltered: false,
          shoppingsInRange: tempShoppingsStatusAfterEnrich.shoppingsInRange,
          shoppingsOutOfRange: tempShoppingsStatusAfterEnrich.shoppingsOutOfRange,
          totalDevices: allTempDevicesAfterEnrich.length,
          devices: tempDevicesForTooltipAfterEnrich,
          temperatureMin: minTemp,
          temperatureMax: maxTemp,
          byStatus: tempByStatusAfterEnrich,
          lastUpdated: new Date().toISOString(),
        },
      })
    );

    // FIX: Calculate online equipment count (same logic as TELEMETRY header)
    const onlineEquipmentsAfterEnrich = enriched.energy.equipments.filter((device) => {
      const status = (device.deviceStatus || '').toLowerCase();
      return !['offline', 'no_info', 'not_installed'].includes(status);
    }).length;

    // Equipment count event (include tooltip fields)
    const equipmentOnlyClassifiedAfterEnrich = {
      energy: { equipments: enriched.energy.equipments, stores: [], entrada: [] },
    };
    const equipmentByStatusAfterEnrich = buildTooltipStatusData(enriched.energy.equipments);

    window.dispatchEvent(
      new CustomEvent('myio:equipment-count-updated', {
        detail: {
          totalEquipments: enriched.energy.equipments.length,
          filteredEquipments: onlineEquipmentsAfterEnrich, // FIX: Use online count, not total
          allShoppingsSelected: true,
          byStatus: equipmentByStatusAfterEnrich,
          byCategory: buildEnergyCategoryData(equipmentOnlyClassifiedAfterEnrich),
        },
      })
    );

    LogHelper.log('Summary events dispatched');

    // Mark as done
    _apiEnrichmentDone = true;
  } catch (err) {
    console.error('[MAIN_UNIQUE] API enrichment error:', err);
  } finally {
    _apiEnrichmentInProgress = false;
  }
}

// RFC-0140 FIX: Removed module-level setTimeout - triggerApiEnrichment is now called from onInit
// This ensures LogHelper is initialized before the function runs

self.onDestroy = function () {
  // Cleanup
};
