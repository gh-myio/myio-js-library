// ===================================================================
// RFC-0111: MAIN_UNIQUE_DATASOURCE Controller
// Single Datasource Architecture - Head Office Dashboard
// ===================================================================

/* eslint-disable no-undef */
/* global self, window, document */

// Debug configuration - set from settings.enableDebugMode in onInit
let DEBUG_ACTIVE = false;

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
const MAX_CREDENTIALS_RETRIES = 10;

// RFC-0126: Module-level variables for event handlers
// These must be declared before self.onInit so handlers can be registered immediately
let _onDataUpdatedCallCount = null;
let _cachedShoppings = [];
let _cachedClassified = null;
let _cachedDeviceCounts = null;
let _menuInstanceRef = null;
let _welcomeModalRef = null;
let _headerInstanceRef = null;
let _currentShoppingCards = null; // Shopping cards from datasource or DEFAULT_SHOPPING_CARDS
let _forceRemovePartialOwnerName = ''; // Prefix to remove from ownerName
let _goalsEntityLabel = 'Shopping'; // Set from settings.goalsEntityLabel in onInit

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

  // RFC-0122: Initialize LogHelper from library
  if (!MyIOLibrary.createLogHelper) {
    showToast('Erro: biblioteca não carregada (createLogHelper)', 'error');
    return;
  }

  LogHelper = MyIOLibrary.createLogHelper({
    debugActive: DEBUG_ACTIVE,
    config: { widget: 'MAIN_UNIQUE_DATASOURCE' },
  });

  LogHelper.log('[MAIN_UNIQUE] onInit called', self.ctx);

  // === 2. CREDENTIALS AND UTILITIES FOR TELEMETRY WIDGET ===
  // RFC-0111: TELEMETRY widget depends on these utilities from MAIN
  const DATA_API_HOST     = settings.dataApiHost     || '';
  if (!DATA_API_HOST) {
    const msg = 'dataApiHost não configurado. Verifique as configurações do widget.';
    LogHelper.warn('[MAIN_UNIQUE_DATASOURCE]', msg);
    if (MyIOLibrary?.MyIOToast?.error) { MyIOLibrary.MyIOToast.error(msg); }
  }
  // Base URL for direct fetch calls that append /api/v1 manually
  const DATA_API_BASE = DATA_API_HOST.replace(/\/api\/v1\/?$/, '');
  const ALARMS_API_BASE   = settings.alarmsApiBaseUrl || 'https://alarms-api.a.myio-bas.com';
  const ALARMS_API_KEY    = settings.alarmsApiKey    || '';
  const GCDR_API_BASE     = settings.gcdrApiBaseUrl   || 'https://gcdr-api.a.myio-bas.com';

  // RFC-0178: Configure AlarmService with the correct base URL and API key from settings
  if (MyIOLibrary?.AlarmService?.configure) {
    MyIOLibrary.AlarmService.configure(ALARMS_API_BASE, undefined, ALARMS_API_KEY);
    LogHelper.log('[MAIN_UNIQUE] AlarmService configured with baseUrl:', ALARMS_API_BASE);
  }

  // RFC-0178/RFC-0180: Expose API base URLs on MyIOOrchestrator for components (e.g. btnAlarmBundleMap)
  if (window.MyIOOrchestrator) {
    window.MyIOOrchestrator.alarmsApiBaseUrl = ALARMS_API_BASE;
    window.MyIOOrchestrator.gcdrApiBaseUrl   = GCDR_API_BASE;
  }

  // Credentials will be fetched from ThingsBoard customer attributes
  let CLIENT_ID = '';
  let CLIENT_SECRET = '';
  let CUSTOMER_ING_ID = '';
  let GCDR_CUSTOMER_ID = ''; // customer SERVER_SCOPE attr: gcdrCustomerId

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

        // Update MyIOUtils with fetched credentials
        window.MyIOUtils.CLIENT_ID = CLIENT_ID;
        window.MyIOUtils.CLIENT_SECRET = CLIENT_SECRET;
        window.MyIOUtils.CUSTOMER_ING_ID = CUSTOMER_ING_ID;
        window.MyIOUtils.GCDR_CUSTOMER_ID = GCDR_CUSTOMER_ID;
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

        LogHelper.log('Credentials updated:', { CLIENT_ID: CLIENT_ID ? '***' : '', CUSTOMER_ING_ID, GCDR_CUSTOMER_ID });
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
      window.dispatchEvent(new CustomEvent('myio:operational-indicators-access', { detail: { enabled: false } }));
      window.dispatchEvent(new CustomEvent('myio:domains-access', { detail: { energy: true, water: true, temperature: true, showGoalsButton: true, energySubTabs: { equipments: true, stores: true, dashboard: true } } }));
      return { showOperationalPanels: false };
    }

    try {
      if (MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage) {
        const attrs = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);

        const showOperationalPanels  = attrs?.['show-indicators-operational-panels'] === 'true';
        const showEnergyTab          = attrs?.['show-energy-tab']              !== 'false'; // default true
        const showWaterTab           = attrs?.['show-water-tab']               !== 'false'; // default true
        const showTemperatureTab     = attrs?.['show-temperature-tab']         !== 'false'; // default true
        const showGoalsButton        = attrs?.['show-goals-button']            !== 'false'; // default true
        const showEnergyEquipments   = attrs?.['show-energy-tab.equipments']   !== 'false'; // default true
        const showEnergyStores       = attrs?.['show-energy-tab.stores']       !== 'false'; // default true
        const showEnergyDashboard    = attrs?.['show-energy-tab.dashboard']    !== 'false'; // default true
        const apiKeyGcdr             = attrs?.['apiKeyGcdr']                   || '';

        LogHelper.log('RFC-0152: Feature flags:', {
          showOperationalPanels, showEnergyTab, showWaterTab, showTemperatureTab, showGoalsButton,
          showEnergyEquipments, showEnergyStores, showEnergyDashboard,
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
        window.dispatchEvent(new CustomEvent('myio:operational-indicators-access', { detail: { enabled: showOperationalPanels } }));
        window.dispatchEvent(new CustomEvent('myio:domains-access', { detail: domainsAccess }));

        return { showOperationalPanels };
      }
    } catch (error) {
      LogHelper.error('RFC-0152: Failed to fetch feature flags:', error);
    }

    // Fallback defaults on error
    window.dispatchEvent(new CustomEvent('myio:operational-indicators-access', { detail: { enabled: false } }));
    window.dispatchEvent(new CustomEvent('myio:domains-access', { detail: { energy: true, water: true, temperature: true, showGoalsButton: true, energySubTabs: { equipments: true, stores: true, dashboard: true } } }));
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
   * RFC-0111/RFC-0112: Update DEFAULT_SHOPPING_CARDS with real counts and consumption from classified data
   * Matches by shopping card title to device ownerName
   * @param {Object} classified - Classified device data
   * @returns {Array} Updated shopping cards with real device counts and consumption values
   */
  const updateShoppingCardsWithRealCounts = (classified) => {
    // RFC-0112: Use calculateShoppingDeviceStats to get counts AND consumption values
    const statsByOwnerName = MyIOLibrary.calculateShoppingDeviceStats(DOMAIN_ALL_LIST, classified);

    LogHelper.log('Device stats by ownerName:', Object.fromEntries(statsByOwnerName));

    // Use current shopping cards (from datasource) with fallback to defaults
    const baseCards = _currentShoppingCards || DEFAULT_SHOPPING_CARDS;

    return baseCards.map((card) => {
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
  };

  /**
   * RFC-0111: Update shopping cards in welcome modal with real device counts
   * @param {Object} welcomeModal - Welcome modal instance
   * @param {Array} updatedCards - Shopping cards with real device counts
   */
  const updateWelcomeModalShoppingCards = (welcomeModal, updatedCards) => {
    if (welcomeModal && welcomeModal.updateShoppingCards) {
      welcomeModal.updateShoppingCards(updatedCards);
      LogHelper.log('Welcome modal updated with real device counts');
      return;
    }

    // Fallback: Update DOM directly
    LogHelper.log('Updating shopping cards DOM directly');
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

  // Build shopping cards from datasource with fallback to DEFAULT_SHOPPING_CARDS
  _currentShoppingCards = buildShoppingCardsFromDatasource(self.ctx.data || []);
  LogHelper.log('Initial shopping cards:', _currentShoppingCards.length, 'cards');

  const welcomeModal = MyIOLibrary.openWelcomeModal({
    ctx: self.ctx,
    themeMode: currentThemeMode,
    showThemeToggle: true,
    showUserMenu: true, // Explicitly enable user menu
    configTemplate: welcomeConfig,
    shoppingCards: _currentShoppingCards, // From datasource or fallback to defaults
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
    const updatedCards = updateShoppingCardsWithRealCounts(classified);
    updateWelcomeModalShoppingCards(welcomeModal, updatedCards);
  });

  // RFC-0126: Listen for update event from early handler (handles future updates)
  const updateWelcomeHandler = (event) => {
    const { classified, shoppingCards: dynamicCards } = event.detail || {};
    LogHelper.log('Update welcome modal event received');

    if (classified) {
      const updatedCards = updateShoppingCardsWithRealCounts(classified);
      updateWelcomeModalShoppingCards(welcomeModal, updatedCards);
    } else if (dynamicCards && dynamicCards.length > 0) {
      updateWelcomeModalShoppingCards(welcomeModal, dynamicCards);
    }
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

  // === 5. RFC-0113: RENDER HEADER COMPONENT ===
  const headerContainer = document.getElementById('headerContainer');
  let headerInstance = null;

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
            shoppingsEnergy: buildShoppingsEnergyBreakdown(classifiedData),
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
            shoppingsWater: buildShoppingsWaterBreakdown(classifiedData),
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
      const tempShoppingsStatus = buildShoppingsTemperatureStatus(classifiedData, minTemp, maxTemp);

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
  let currentViewMode = 'telemetry'; // 'telemetry' | 'energy-panel' | 'water-panel' | 'operational-grid' | 'operational-dashboard' | 'alarms-panel'
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
            shoppingsEnergy: buildShoppingsEnergyBreakdown(filteredClassified),
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
            shoppingsWater: buildShoppingsWaterBreakdown(filteredClassified),
            entityLabel: settings.goalsEntityLabel || 'Shopping',
            lastUpdated: new Date().toISOString(),
          },
        })
      );

      // Calculate shoppings temperature status for filtered data
      const filteredTempShoppingsStatus = buildShoppingsTemperatureStatus(
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
      const updatedCards = updateShoppingCardsWithRealCounts(classified);
      updateWelcomeModalShoppingCards(welcomeModal, updatedCards);
    }
  });

  // === 7. RFC-0115: RENDER FOOTER COMPONENT ===
  const footerContainer = document.getElementById('footerContainer');
  let footerInstance = null;

  if (footerContainer && MyIOLibrary.createFooterComponent) {
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
      chartsBaseUrl: 'https://graphs.staging.apps.myio-bas.com',
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
  window.addEventListener('myio:open-goals-panel', () => {
    LogHelper.log('[MAIN_UNIQUE] Goals panel requested');

    if (!MyIOLibrary?.openGoalsPanel) {
      LogHelper.error('[MAIN_UNIQUE] MyIOLibrary.openGoalsPanel not available');
      window.alert('Componente de Metas nao esta disponivel.');
      return;
    }

    try {
      const customerId = getCustomerTB_ID();
      if (!customerId) {
        LogHelper.error('[MAIN_UNIQUE] customerId not found');
        window.alert('Customer ID nao disponivel. Aguarde o carregamento completo.');
        return;
      }

      const token = localStorage.getItem('jwt_token');
      if (!token) {
        LogHelper.error('[MAIN_UNIQUE] JWT token not found');
        window.alert('Token de autenticacao nao encontrado.');
        return;
      }

      // Build shopping list from cached shoppings
      const shoppingList = (_cachedShoppings || [])
        .filter((c) => c.value && c.name && c.name.trim() !== c.value.trim())
        .map((c) => ({
          value: c.value,
          name: c.name,
        }));

      LogHelper.log('[MAIN_UNIQUE] Opening Goals Panel:', {
        customerId,
        shoppingCount: shoppingList.length,
      });

      MyIOLibrary.openGoalsPanel({
        customerId: customerId,
        token: token,
        api: {
          baseUrl: window.location.origin,
        },
        shoppingList: shoppingList,
        locale: 'pt-BR',
        entityLabel: settings.goalsEntityLabel || 'Shopping',
        onSave: async (goalsData) => {
          LogHelper.log('[MAIN_UNIQUE] Goals saved:', goalsData?.version);
          window.dispatchEvent(
            new CustomEvent('myio:goals-updated', {
              detail: { goalsData, customerId, timestamp: Date.now() },
            })
          );
        },
        onClose: () => {
          LogHelper.log('[MAIN_UNIQUE] Goals Panel closed');
        },
        styles: {
          primaryColor: '#6a1b9a',
          accentColor: '#FFC107',
          successColor: '#28a745',
          errorColor: '#dc3545',
          borderRadius: '8px',
          zIndex: 10000,
        },
      });
    } catch (err) {
      LogHelper.error('[MAIN_UNIQUE] Error opening Goals Panel:', err);
      window.alert(`Erro ao abrir metas: ${err?.message || err}`);
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
      _loadingSpinnerInstance = MyIOLibrary.createLoadingSpinner({
        minDisplayTime: 800, // Minimum 800ms to avoid flash
        maxTimeout: 25000, // 25 seconds max
        message: 'Carregando dados...',
        spinnerType: 'double',
        theme: 'dark',
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
    const store = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
    if (store?.getSelectedIds?.().length > 0) {
      store.clearAll();
      LogHelper.log('[MAIN_UNIQUE] SelectionStore cleared on context change');
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
      // Temperature panels still use modal for now
      handlePanelModalRequest(tabId, 'summary');
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
      });

      LogHelper.log('[MAIN_UNIQUE] Energy Panel created successfully');
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

  // RFC-0152 Phase 3: Switch to Operational Equipment Grid view
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
        d.deviceType === 'ESCADA_ROLANTE' ? 'escada'
        : d.deviceType === 'ELEVADOR' ? 'elevador'
        : nameLower.includes('escada') ? 'escada'
        : nameLower.includes('elevad') ? 'elevador'
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
        : (d.deviceName || '');

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

      LogHelper.log(`[RFC-0175][mapAvailability] ${d.deviceName}: availability=${mapped.availability} mtbf=${mapped.mtbf} mttr=${mapped.mttr} status=${mapped.status}`);
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
    const types = ['escada', 'elevador'];
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
      LogHelper.log('[MAIN_UNIQUE] RFC-0175: renderOperationalGeneralList already in progress, skipping duplicate call');
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
        LogHelper.warn('[MAIN_UNIQUE] RFC-0175: createDeviceOperationalCardGridComponent not found in MyIOLibrary');
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
      LogHelper.log('[RFC-0175] Equipment mapped count:', equipment.length, '— first item sample:', equipment[0] ? { id: equipment[0].id, availability: equipment[0].availability, mtbf: equipment[0].mtbf, mttr: equipment[0].mttr } : 'none');

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
        LogHelper.log('[RFC-0175] customerName enriched from classified:', deviceCustomerMap.size, 'devices in map');
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

      LogHelper.log('[MAIN_UNIQUE] RFC-0175: Operational General List rendered with', equipment.length, 'devices');
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
      LogHelper.warn('[MAIN_UNIQUE] RFC-0175: createAlarmsNotificationsPanelComponent not found in MyIOLibrary');
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
      alarmsApiKey: window.MyIOUtils?.ALARMS_API_KEY || ALARMS_API_KEY,
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
      const [response, trend] = await Promise.all([
        alarmService.getAlarms({
          state:      ['OPEN', 'ACK', 'ESCALATED', 'SNOOZED'],
          limit:      100,
          customerId: tenantId || undefined,
        }),
        tenantId ? alarmService.getAlarmTrend(tenantId, 'week', 'day') : Promise.resolve([]),
      ]);

      const alarms  = response.data;
      const summary = response.summary;

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
  function switchToTelemetryGrid(container, tabId, contextId, target) {
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
  const shoppingCards = buildShoppingCards(classified);

  // Calculate device counts
  const deviceCounts = calculateDeviceCounts(classified);

  // Update module-level cache
  _cachedClassified = classified;
  _cachedDeviceCounts = deviceCounts;
  _cachedShoppings = buildShoppingsList(allData);

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
        shoppingsEnergy: buildShoppingsEnergyBreakdown(classified),
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
        shoppingsWater: buildShoppingsWaterBreakdown(classified),
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
  const tempShoppingsStatus = buildShoppingsTemperatureStatus(classified, minTemp, maxTemp);

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

    // Subcategories within Equipamentos (counts only; consumption not split at this level)
    const elevatorsCount = s.equipDevices.filter((d) =>
      (d.deviceType || '').toLowerCase().includes('elevador')
    ).length;
    const escalatorsCount = s.equipDevices.filter((d) =>
      (d.deviceType || '').toLowerCase().includes('escada')
    ).length;
    const hvacCount = s.equipDevices.filter(
      (d) =>
        (d.deviceType || '').toLowerCase().includes('ar_condicionado') ||
        (d.deviceType || '').toLowerCase().includes('hvac')
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
function buildShoppingsEnergyBreakdown(classified) {
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

    // Check if it's a store device (3F_MEDIDOR)
    const deviceType = (device.deviceType || '').toUpperCase();
    // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
    const deviceProfile = (device.deviceProfile || device.deviceType || '').toUpperCase();
    const isStore = deviceProfile === '3F_MEDIDOR' && deviceType === '3F_MEDIDOR';

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
function buildShoppingsWaterBreakdown(classified) {
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
function buildShoppingsTemperatureStatus(classified, minTemp, maxTemp) {
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
    const domain = window.MyIOLibrary.getDomainFromDeviceType(device.deviceType);
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
 * Used by buildShoppingsList where we iterate row by row
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

  // RFC-0111: Classification is based ONLY on deviceType from ThingsBoard
  // No name-based inference - deviceType must be properly configured in ThingsBoard
  const deviceType = dataKeyValues['deviceType'] || 'SEM_DEVICE_TYPE';
  const deviceProfile = dataKeyValues['deviceProfile'] || deviceType;

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
  const isWater = deviceType.includes('HIDROMETRO');
  const isTemperature = deviceType.includes('TERMOSTATO');
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

function buildShoppingCards(classified) {
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

function buildShoppingsList(data) {
  // RFC-0126: Priority 1 - Extract from aliasName='Shopping' or 'customers' datasource
  // This datasource contains customer entities directly with label, id, minTemperature, maxTemperature
  const fromAlias = buildShoppingsListFromAlias(data);
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
          `[buildShoppingsList] Exposed global minTemperature: ${customerWithLimits.minTemperature}`
        );
      }
      if (
        customerWithLimits.maxTemperature != null &&
        window.MyIOUtils.temperatureLimits.maxTemperature !== customerWithLimits.maxTemperature
      ) {
        window.MyIOUtils.temperatureLimits.maxTemperature = customerWithLimits.maxTemperature;
        LogHelper.log(
          `[buildShoppingsList] Exposed global maxTemperature: ${customerWithLimits.maxTemperature}`
        );
      }
    }
    return fromAlias;
  }

  // RFC-0126: Priority 2 - Use classified data from MyIOOrchestratorData
  const classified = window.MyIOOrchestratorData?.classified;
  if (classified) {
    return buildShoppingsListFromClassified(classified);
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
 * RFC-0126: Build shoppings list from aliasName='Shopping' or 'customers' datasource
 * This is the preferred method as it contains customer entities directly
 */
function buildShoppingsListFromAlias(data) {
  const customerMap = new Map();

  data.forEach((row) => {
    const aliasName = row?.datasource?.aliasName || '';
    // Check for 'Shopping' or 'customers' alias
    if (aliasName === 'Shopping' || aliasName === 'customers') {
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
    LogHelper.log('[buildShoppingsListFromAlias] Built shoppings list:', result.length, 'customers');
  }
  return result;
}

/**
 * Build shopping cards from 'customers' datasource with fallback to DEFAULT_SHOPPING_CARDS
 * Extracts: title, dashboardId, entityId, entityType, subtitle
 * Cards without dashboardId are not clickable
 */
function buildShoppingCardsFromDatasource(data) {
  const customerMap = new Map();

  data.forEach((row) => {
    const aliasName = row?.datasource?.aliasName || '';
    // Check for 'Shopping' or 'customers' alias
    if (aliasName === 'Shopping' || aliasName === 'customers') {
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
          clickable: false, // Default false, set to true if dashboardId is found
          deviceCounts: { energy: null, water: null, temperature: null },
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
      }
    }
  });

  const cards = Array.from(customerMap.values());

  if (cards.length > 0) {
    LogHelper.log(
      '[buildShoppingCardsFromDatasource] Built shopping cards from datasource:',
      cards.length,
      'cards'
    );
    return cards;
  }

  // Fallback to DEFAULT_SHOPPING_CARDS
  LogHelper.log(
    '[buildShoppingCardsFromDatasource] No customers in datasource, using DEFAULT_SHOPPING_CARDS'
  );
  return DEFAULT_SHOPPING_CARDS;
}

/**
 * RFC-0126: Build shoppings list from classified device data
 * Uses the merged device objects which have complete metadata
 */
function buildShoppingsListFromClassified(classified) {
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
  LogHelper.log('[buildShoppingsListFromClassified] Built shoppings list:', result.length, 'customers');
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

  // Note: Temperature does not need API enrichment - it uses real-time ThingsBoard data

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
        shoppingsEnergy: buildShoppingsEnergyBreakdown(enriched),
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
    LogHelper.log('No classified data available for enrichment, retrying in 1s...');
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
          shoppingsEnergy: buildShoppingsEnergyBreakdown(enriched),
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
          shoppingsWater: buildShoppingsWaterBreakdown(enriched),
          lastUpdated: new Date().toISOString(),
        },
      })
    );

    // Calculate shoppings temperature status after enrichment
    const tempShoppingsStatusAfterEnrich = buildShoppingsTemperatureStatus(enriched, minTemp, maxTemp);

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
