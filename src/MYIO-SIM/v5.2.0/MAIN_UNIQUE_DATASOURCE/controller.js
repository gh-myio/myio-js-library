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

// RFC-0127: Event handler for menu requesting shoppings
// Responds with cached data when menu component requests it
window.addEventListener('myio:request-shoppings', () => {
  console.log('[MAIN_UNIQUE] myio:request-shoppings received, cached:', _cachedShoppings.length);
  if (_menuInstanceRef && _cachedShoppings.length > 0) {
    _menuInstanceRef.updateShoppings?.(_cachedShoppings);
    console.log('[MAIN_UNIQUE] Shoppings sent to menu on request');
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
  const DATA_API_HOST = settings.dataApiHost || 'https://api.data.apps.myio-bas.com';

  // Credentials will be fetched from ThingsBoard customer attributes
  let CLIENT_ID = '';
  let CLIENT_SECRET = '';
  let CUSTOMER_ING_ID = '';

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

        // Update MyIOUtils with fetched credentials
        window.MyIOUtils.CLIENT_ID = CLIENT_ID;
        window.MyIOUtils.CLIENT_SECRET = CLIENT_SECRET;
        window.MyIOUtils.CUSTOMER_ING_ID = CUSTOMER_ING_ID;
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

        LogHelper.log('Credentials updated:', { CLIENT_ID: CLIENT_ID ? '***' : '', CUSTOMER_ING_ID });
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

          if (cache && device.ingestionId) {
            const cached = cache.get(device.ingestionId);
            if (cached) {
              consumption = Number(cached.total_value) || 0;
            }
          }

          if (consumption === 0) {
            consumption = Number(device.val) || Number(device.value) || Number(device.lastValue) || 0;
          }

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

  /**
   * RFC-0090: Create a centralized filter modal for device grids
   * @param {Object} config - Configuration object
   * @returns {Object} Modal controller with open, close, and destroy methods
   */
  window.MyIOUtils.createFilterModal = (config) => {
    const {
      widgetName = 'WIDGET',
      containerId,
      modalClass = 'filter-modal',
      primaryColor = '#2563eb',
      itemIdAttr = 'data-item-id',
      filterTabs = [],
      getItemId = (item) => item.id,
      getItemLabel = (item) => item.label || item.name,
      getItemValue = (item) => Number(item.value) || 0,
      getItemSubLabel = () => '',
      formatValue = (val) => val.toFixed(2),
      onApply = () => {},
      onClose = () => {},
    } = config;

    let globalContainer = null;
    let escHandler = null;

    // RFC-0103: Filter tab icons
    const filterTabIcons = {
      online: '⚡',
      normal: '⚡',
      offline: '🔴',
      notInstalled: '📦',
      standby: '🔌',
      alert: '⚠️',
      failure: '🚨',
      withConsumption: '✓',
      noConsumption: '○',
      elevators: '🏙',
      escalators: '📶',
      hvac: '❄️',
      others: '⚙️',
      commonArea: '💧',
      stores: '🏪',
      all: '📊',
    };

    // Generate CSS styles with customizable primary color
    const generateStyles = () => {
      return `
        /* RFC-0090: Shared Filter Modal Styles for ${widgetName} */
        #${containerId} .${modalClass} {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          backdrop-filter: blur(4px);
          animation: filterModalFadeIn 0.2s ease-in;
        }
        #${containerId} .${modalClass}.hidden { display: none; }
        #${containerId} .${modalClass}-card {
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
          #${containerId} .${modalClass}-card {
            border-radius: 16px;
            width: 90%;
            max-width: 1200px;
            height: auto;
            max-height: 90vh;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }
        }
        /* RFC-0121: MyIO Premium Header Style */
        #${containerId} .${modalClass}-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #3e1a7d;
          color: white;
          border-radius: 16px 16px 0 0;
          min-height: 32px;
          user-select: none;
        }
        #${containerId} .${modalClass}-header__left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        #${containerId} .${modalClass}-header__icon {
          font-size: 18px;
        }
        #${containerId} .${modalClass}-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: white;
          line-height: 1.4;
        }
        #${containerId} .${modalClass}-header__actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        #${containerId} .${modalClass}-header__btn {
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.8);
          transition: background-color 0.2s, color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          min-height: 28px;
          line-height: 1;
        }
        #${containerId} .${modalClass}-header__btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }
        #${containerId} .${modalClass}-header__btn--close:hover {
          background: rgba(239, 68, 68, 0.3);
          color: #fecaca;
        }
        /* Light theme header */
        #${containerId} .${modalClass}-header--light {
          background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 100%);
          border-bottom: 1px solid #cbd5e1;
        }
        #${containerId} .${modalClass}-header--light h3 {
          color: #475569;
        }
        #${containerId} .${modalClass}-header--light .${modalClass}-header__btn {
          color: rgba(71, 85, 105, 0.8);
        }
        #${containerId} .${modalClass}-header--light .${modalClass}-header__btn:hover {
          background: rgba(0, 0, 0, 0.08);
          color: #1e293b;
        }
        /* Maximized state */
        #${containerId} .${modalClass}-card.maximized {
          max-width: 100%;
          width: 100%;
          max-height: 100vh;
          height: 100vh;
          border-radius: 0;
        }
        #${containerId} .${modalClass}-card.maximized .${modalClass}-header {
          border-radius: 0;
        }
        /* RFC-0103: Three-column layout */
        #${containerId} .${modalClass}-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: row;
          gap: 20px;
        }
        #${containerId} .filter-sidebar {
          width: 220px;
          min-width: 220px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          border-right: 1px solid #E6EEF5;
          padding-right: 20px;
        }
        #${containerId} .filter-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          border-right: 1px solid #E6EEF5;
          padding-right: 20px;
        }
        #${containerId} .filter-sortbar {
          width: 160px;
          min-width: 160px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        #${containerId} .${modalClass}-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 16px 20px;
          border-top: 1px solid #DDE7F1;
        }
        #${containerId} .filter-block {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        #${containerId} .block-label {
          font-size: 14px;
          font-weight: 600;
          color: #1C2743;
        }
        /* RFC-0103: Vertical filter tabs in sidebar */
        #${containerId} .filter-tabs {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        #${containerId} .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        #${containerId} .filter-group-all {
          padding-bottom: 10px;
          border-bottom: 1px solid #E6EEF5;
          margin-bottom: 4px;
        }
        #${containerId} .filter-group-all .filter-tab {
          width: 100%;
          justify-content: center;
        }
        #${containerId} .filter-group-label {
          font-size: 11px;
          font-weight: 600;
          color: #6b7a90;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }
        #${containerId} .filter-group-tabs {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        /* RFC-0103: Filter tabs styled like card chips */
        #${containerId} .filter-tab {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          gap: 4px;
          border: none;
          opacity: 0.5;
        }
        #${containerId} .filter-tab:hover { opacity: 0.8; transform: translateY(-1px); }
        #${containerId} .filter-tab.active { opacity: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
        #${containerId} .filter-tab[data-filter="all"] { background: #e2e8f0; color: #475569; }
        #${containerId} .filter-tab[data-filter="online"],
        #${containerId} .filter-tab[data-filter="normal"] { background: #dbeafe; color: #1d4ed8; }
        #${containerId} .filter-tab[data-filter="offline"] { background: #e2e8f0; color: #475569; }
        #${containerId} .filter-tab[data-filter="notInstalled"] { background: #fef3c7; color: #92400e; }
        #${containerId} .filter-tab[data-filter="standby"],
        #${containerId} .filter-tab[data-filter="withConsumption"] { background: #dcfce7; color: #15803d; }
        #${containerId} .filter-tab[data-filter="alert"] { background: #fef3c7; color: #b45309; }
        #${containerId} .filter-tab[data-filter="failure"] { background: #fee2e2; color: #b91c1c; }
        #${containerId} .filter-tab[data-filter="noConsumption"] { background: #e2e8f0; color: #475569; }
        #${containerId} .filter-tab[data-filter="elevators"] { background: #e9d5ff; color: #7c3aed; }
        #${containerId} .filter-tab[data-filter="escalators"] { background: #fce7f3; color: #db2777; }
        #${containerId} .filter-tab[data-filter="hvac"] { background: #cffafe; color: #0891b2; }
        #${containerId} .filter-tab[data-filter="others"] { background: #e7e5e4; color: #57534e; }
        #${containerId} .filter-tab[data-filter="commonArea"] { background: #e0f2fe; color: #0284c7; }
        #${containerId} .filter-tab[data-filter="stores"] { background: #f3e8ff; color: #9333ea; }
        /* RFC-0110: Expand button (+) for device list tooltip */
        #${containerId} .filter-tab-expand {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: none;
          background: rgba(0, 0, 0, 0.1);
          color: inherit;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: 4px;
          transition: all 0.15s ease;
          flex-shrink: 0;
          opacity: 0.7;
        }
        #${containerId} .filter-tab-expand:hover {
          background: rgba(0, 0, 0, 0.25);
          transform: scale(1.1);
          opacity: 1;
        }
        #${containerId} .filter-search {
          position: relative;
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        #${containerId} .filter-search svg {
          position: absolute;
          left: 10px;
          width: 14px;
          height: 14px;
          fill: #6b7a90;
          pointer-events: none;
        }
        #${containerId} .filter-search input {
          width: 100%;
          padding: 8px 32px 8px 32px;
          border: 1px solid #DDE7F1;
          border-radius: 8px;
          font-size: 12px;
          outline: none;
          box-sizing: border-box;
        }
        #${containerId} .filter-search input:focus {
          border-color: ${primaryColor};
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }
        #${containerId} .filter-search .clear-x {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          border: 0;
          background: #f3f4f6;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        #${containerId} .filter-search .clear-x:hover { background: #e5e7eb; }
        #${containerId} .filter-search .clear-x svg { position: static; width: 12px; height: 12px; fill: #6b7280; }
        #${containerId} .inline-actions { display: flex; gap: 8px; margin-top: 8px; }
        #${containerId} .tiny-btn {
          padding: 6px 12px;
          border: 1px solid #DDE7F1;
          border-radius: 6px;
          background: #fff;
          font-size: 12px;
          font-weight: 500;
          color: #1C2743;
          cursor: pointer;
          transition: all 0.2s;
        }
        #${containerId} .tiny-btn:hover { background: #f0f4f8; border-color: ${primaryColor}; color: ${primaryColor}; }
        #${containerId} .checklist {
          min-height: 120px;
          max-height: 340px;
          overflow-y: auto;
          border: 1px solid #DDE7F1;
          border-radius: 8px;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        #${containerId} .check-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 6px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        #${containerId} .check-item:hover { background: #f8f9fa; }
        #${containerId} .check-item input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; flex-shrink: 0; }
        #${containerId} .check-item label { flex: 1; cursor: pointer; font-size: 11px; color: #1C2743; line-height: 1.3; }
        #${containerId} .radio-grid { display: flex; flex-direction: column; gap: 4px; }
        #${containerId} .radio-grid label {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border: 1px solid #DDE7F1;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 11px;
          color: #1C2743;
        }
        #${containerId} .radio-grid label:hover { background: #f8f9fa; border-color: ${primaryColor}; }
        #${containerId} .radio-grid input[type="radio"] { width: 12px; height: 12px; cursor: pointer; flex-shrink: 0; }
        #${containerId} .radio-grid label:has(input:checked) { background: rgba(37, 99, 235, 0.08); border-color: ${primaryColor}; color: ${primaryColor}; font-weight: 600; }
        #${containerId} .btn {
          padding: 10px 16px;
          border: 1px solid #DDE7F1;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        #${containerId} .btn:hover { background: #f8f9fa; }
        #${containerId} .btn.primary { background: ${primaryColor}; color: #fff; border-color: ${primaryColor}; }
        #${containerId} .btn.primary:hover { filter: brightness(0.9); }
        #${containerId} .icon-btn {
          border: 0;
          background: transparent;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: background 0.2s;
        }
        #${containerId} .icon-btn:hover { background: #f0f0f0; }
        #${containerId} .icon-btn svg { width: 18px; height: 18px; fill: #1C2743; }
        @keyframes filterModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        body.filter-modal-open { overflow: hidden !important; }

        /* ========== DARK THEME SUPPORT ========== */
        /* RFC-0115: data-theme is set directly on the container */
        #${containerId}[data-theme="dark"] .${modalClass}-card {
          background: #1e293b;
          border-color: #334155;
        }
        #${containerId}[data-theme="dark"] .${modalClass}-header {
          border-bottom-color: #334155;
        }
        #${containerId}[data-theme="dark"] .${modalClass}-header h3 {
          color: #f1f5f9;
        }
        #${containerId}[data-theme="dark"] .${modalClass}-footer {
          border-top-color: #334155;
        }
        #${containerId}[data-theme="dark"] .filter-sidebar {
          border-right-color: #334155;
        }
        #${containerId}[data-theme="dark"] .filter-content {
          border-right-color: #334155;
        }
        #${containerId}[data-theme="dark"] .block-label {
          color: #f1f5f9;
        }
        #${containerId}[data-theme="dark"] .filter-group-label {
          color: #94a3b8;
        }
        #${containerId}[data-theme="dark"] .filter-group-all {
          border-bottom-color: #334155;
        }
        #${containerId}[data-theme="dark"] .filter-search input {
          background: #0f172a;
          border-color: #334155;
          color: #f1f5f9;
        }
        #${containerId}[data-theme="dark"] .filter-search input::placeholder {
          color: #64748b;
        }
        #${containerId}[data-theme="dark"] .filter-search input:focus {
          border-color: ${primaryColor};
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
        }
        #${containerId}[data-theme="dark"] .filter-search svg {
          fill: #94a3b8;
        }
        #${containerId}[data-theme="dark"] .filter-search .clear-x {
          background: #334155;
        }
        #${containerId}[data-theme="dark"] .filter-search .clear-x:hover {
          background: #475569;
        }
        #${containerId}[data-theme="dark"] .filter-search .clear-x svg {
          fill: #94a3b8;
        }
        #${containerId}[data-theme="dark"] .checklist {
          background: #0f172a;
          border-color: #334155;
        }
        #${containerId}[data-theme="dark"] .check-item:hover {
          background: #334155;
        }
        #${containerId}[data-theme="dark"] .check-item label {
          color: #e2e8f0;
        }
        #${containerId}[data-theme="dark"] .radio-grid label {
          border-color: #334155;
          color: #e2e8f0;
          background: #0f172a;
        }
        #${containerId}[data-theme="dark"] .radio-grid label:hover {
          background: #1e293b;
          border-color: ${primaryColor};
        }
        #${containerId}[data-theme="dark"] .radio-grid label:has(input:checked) {
          background: rgba(37, 99, 235, 0.15);
          border-color: ${primaryColor};
          color: #60a5fa;
        }
        #${containerId}[data-theme="dark"] .tiny-btn {
          background: #0f172a;
          border-color: #334155;
          color: #e2e8f0;
        }
        #${containerId}[data-theme="dark"] .tiny-btn:hover {
          background: #1e293b;
          border-color: ${primaryColor};
          color: #60a5fa;
        }
        #${containerId}[data-theme="dark"] .btn {
          border-color: #334155;
          color: #e2e8f0;
          background: #0f172a;
        }
        #${containerId}[data-theme="dark"] .btn:hover {
          background: #1e293b;
        }
        #${containerId}[data-theme="dark"] .btn.primary {
          background: ${primaryColor};
          color: #fff;
          border-color: ${primaryColor};
        }
        #${containerId}[data-theme="dark"] .icon-btn:hover {
          background: #334155;
        }
        #${containerId}[data-theme="dark"] .icon-btn svg {
          fill: #f1f5f9;
        }
        #${containerId}[data-theme="dark"] .filter-tab-expand {
          background: rgba(255, 255, 255, 0.1);
        }
        #${containerId}[data-theme="dark"] .filter-tab-expand:hover {
          background: rgba(255, 255, 255, 0.25);
        }
        /* RFC-0115: Customer name styling */
        #${containerId}[data-theme="dark"] .check-item .customer-name {
          color: #38bdf8 !important;
        }
      `;
    };

    // RFC-0103: Generate grouped filter tabs HTML
    const generateFilterTabsHTML = (counts) => {
      const filterGroups = [
        { id: 'connectivity', label: 'Conectividade', filters: ['online', 'offline', 'notInstalled'] },
        { id: 'status', label: 'Status', filters: ['normal', 'standby', 'alert', 'failure'] },
        { id: 'consumption', label: 'Consumo', filters: ['withConsumption', 'noConsumption'] },
        {
          id: 'type',
          label: 'Tipo',
          filters: ['elevators', 'escalators', 'hvac', 'others', 'commonArea', 'stores'],
        },
      ];

      const allTab = filterTabs.find((t) => t.id === 'all');
      let html = '';
      if (allTab) {
        const icon = filterTabIcons['all'] || '';
        html += `
          <div class="filter-group filter-group-all">
            <button class="filter-tab active" data-filter="all">
              ${icon} ${allTab.label} (<span id="countAll">${counts['all'] || 0}</span>)
            </button>
          </div>
        `;
      }

      filterGroups.forEach((group) => {
        const groupTabs = filterTabs.filter((t) => group.filters.includes(t.id));
        if (groupTabs.length === 0) return;
        html += `
          <div class="filter-group">
            <span class="filter-group-label">${group.label}</span>
            <div class="filter-group-tabs">
              ${groupTabs
                .map((tab) => {
                  const icon = filterTabIcons[tab.id] || '';
                  const count = counts[tab.id] || 0;
                  // RFC-0110: Add expand button (+) if count > 0
                  const expandBtn =
                    count > 0
                      ? `<button class="filter-tab-expand" data-expand-filter="${tab.id}" title="Ver dispositivos">+</button>`
                      : '';
                  return `
                <button class="filter-tab active" data-filter="${tab.id}">
                  ${icon} ${tab.label} (<span id="count${
                    tab.id.charAt(0).toUpperCase() + tab.id.slice(1)
                  }">${count}</span>)${expandBtn}
                </button>
              `;
                })
                .join('')}
            </div>
          </div>
        `;
      });
      return html;
    };

    // RFC-0103: Three-column layout
    const generateModalHTML = () => {
      return `
        <div id="filterModal" class="${modalClass} hidden">
          <div class="${modalClass}-card">
            <!-- RFC-0121: MyIO Premium Header Style -->
            <div class="${modalClass}-header" id="${containerId}Header">
              <div class="${modalClass}-header__left">
                <span class="${modalClass}-header__icon">🔍</span>
                <h3>Filtrar e Ordenar</h3>
              </div>
              <div class="${modalClass}-header__actions">
                <button class="${modalClass}-header__btn" id="${containerId}ThemeToggle" title="Alternar tema">☀️</button>
                <button class="${modalClass}-header__btn" id="${containerId}Maximize" title="Maximizar">🗖</button>
                <button class="${modalClass}-header__btn ${modalClass}-header__btn--close" id="closeFilter" title="Fechar">&times;</button>
              </div>
            </div>
            <div class="${modalClass}-body">
              <!-- LEFT COLUMN: Filters -->
              <div class="filter-sidebar">
                <div class="filter-tabs" id="filterTabsContainer"></div>
              </div>
              <!-- CENTER COLUMN: Search + Checklist -->
              <div class="filter-content">
                <div class="filter-block">
                  <div class="filter-search">
                    <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                    <input type="text" id="filterDeviceSearch" placeholder="Buscar...">
                    <button class="clear-x" id="filterDeviceClear">
                      <svg width="14" height="14" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="#6b7a90"/></svg>
                    </button>
                  </div>
                  <div class="inline-actions" style="margin-bottom: 8px;">
                    <button class="tiny-btn" id="selectAllItems">Selecionar Todos</button>
                    <button class="tiny-btn" id="clearAllItems">Limpar Seleção</button>
                  </div>
                  <div class="checklist" id="deviceChecklist"></div>
                </div>
              </div>
              <!-- RIGHT COLUMN: Sort Options -->
              <div class="filter-sortbar">
                <div class="filter-block">
                  <span class="block-label">Ordenar por</span>
                  <div class="radio-grid">
                    <label><input type="radio" name="sortMode" value="cons_desc" checked> Maior consumo</label>
                    <label><input type="radio" name="sortMode" value="cons_asc"> Menor consumo</label>
                    <label><input type="radio" name="sortMode" value="alpha_asc"> Nome A → Z</label>
                    <label><input type="radio" name="sortMode" value="alpha_desc"> Nome Z → A</label>
                    <label><input type="radio" name="sortMode" value="status_asc"> Status A → Z</label>
                    <label><input type="radio" name="sortMode" value="status_desc"> Status Z → A</label>
                    <label><input type="radio" name="sortMode" value="shopping_asc"> Shopping A → Z</label>
                    <label><input type="radio" name="sortMode" value="shopping_desc"> Shopping Z → A</label>
                  </div>
                </div>
              </div>
            </div>
            <div class="${modalClass}-footer">
              <button class="btn" id="resetFilters">Fechar</button>
              <button class="btn primary" id="applyFilters">Aplicar</button>
            </div>
          </div>
        </div>
      `;
    };

    const calculateCounts = (items) => {
      const counts = {};
      filterTabs.forEach((tab) => {
        counts[tab.id] = items.filter(tab.filter).length;
      });
      return counts;
    };

    const populateChecklist = (modal, items, selectedIds) => {
      const checklist = modal.querySelector('#deviceChecklist');
      if (!checklist) return;
      checklist.innerHTML = '';

      // Use global filter if available
      const globalSelection = window.custumersSelected || [];
      const isFiltered = globalSelection.length > 0;
      let itemsProcessing = items.slice();
      if (isFiltered) {
        const allowedShoppingIds = globalSelection.map((c) => c.value);
        itemsProcessing = itemsProcessing.filter(
          (item) => item.customerId && allowedShoppingIds.includes(item.customerId)
        );
      }

      const sortedItems = itemsProcessing.sort((a, b) =>
        (getItemLabel(a) || '').localeCompare(getItemLabel(b) || '', 'pt-BR', { sensitivity: 'base' })
      );

      if (sortedItems.length === 0) {
        checklist.innerHTML =
          '<div style="padding:10px; color:#666; font-size:12px; text-align:center;">Nenhum dispositivo encontrado.</div>';
        return;
      }

      sortedItems.forEach((item) => {
        const itemId = getItemId(item);
        const isChecked = !selectedIds || selectedIds.has(String(itemId));
        const subLabel = getItemSubLabel(item);
        const value = getItemValue(item);
        const formattedValue = formatValue(value);
        // RFC-0115: Get customer name for display
        const customerName = item.customerName || item.ownerName || '';

        const div = document.createElement('div');
        div.className = 'check-item';
        div.innerHTML = `
          <input type="checkbox" id="check-${itemId}" ${isChecked ? 'checked' : ''} ${itemIdAttr}="${itemId}">
          <label for="check-${itemId}" style="flex: 1;">${getItemLabel(item)}</label>
          ${
            customerName
              ? `<span class="customer-name" style="color: #0ea5e9; font-size: 10px; margin-right: 8px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${customerName}">${customerName}</span>`
              : ''
          }
          ${
            subLabel
              ? `<span style="color: #64748b; font-size: 11px; margin-right: 8px;">${subLabel}</span>`
              : ''
          }
          <span style="color: ${
            value > 0 ? '#16a34a' : '#94a3b8'
          }; font-size: 11px; font-weight: 600; min-width: 70px; text-align: right;">${formattedValue}</span>
        `;
        checklist.appendChild(div);
      });
    };

    const setupHandlers = (modal, items, _state) => {
      const closeBtn = modal.querySelector('#closeFilter');
      if (closeBtn) closeBtn.addEventListener('click', close);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
      });

      // RFC-0121: Theme toggle button
      let modalTheme = 'dark';
      const themeToggleBtn = modal.querySelector(`#${containerId}ThemeToggle`);
      const headerEl = modal.querySelector(`#${containerId}Header`);
      if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          modalTheme = modalTheme === 'dark' ? 'light' : 'dark';
          themeToggleBtn.textContent = modalTheme === 'dark' ? '☀️' : '🌙';
          if (headerEl) {
            headerEl.classList.toggle(`${modalClass}-header--light`, modalTheme === 'light');
          }
          LogHelper.log('[FilterModal] Theme toggled:', modalTheme);
        });
      }

      // RFC-0121: Maximize button
      let isMaximized = false;
      const maximizeBtn = modal.querySelector(`#${containerId}Maximize`);
      const cardEl = modal.querySelector(`.${modalClass}-card`);
      if (maximizeBtn) {
        maximizeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          isMaximized = !isMaximized;
          maximizeBtn.textContent = isMaximized ? '🗗' : '🗖';
          maximizeBtn.title = isMaximized ? 'Restaurar' : 'Maximizar';
          if (cardEl) {
            cardEl.classList.toggle('maximized', isMaximized);
          }
          LogHelper.log('[FilterModal] Maximized:', isMaximized);
        });
      }

      const applyBtn = modal.querySelector('#applyFilters');
      if (applyBtn) {
        applyBtn.addEventListener('click', () => {
          const checkboxes = modal.querySelectorAll(`#deviceChecklist input[type='checkbox']:checked`);
          const selectedSet = new Set();
          checkboxes.forEach((cb) => {
            const itemId = cb.getAttribute(itemIdAttr);
            if (itemId) selectedSet.add(itemId);
          });
          const sortRadio = modal.querySelector('input[name="sortMode"]:checked');
          const sortMode = sortRadio ? sortRadio.value : 'cons_desc';
          LogHelper.log(`[${widgetName}] Filters applied:`, {
            selectedCount: selectedSet.size,
            totalItems: items.length,
            sortMode,
          });
          onApply({ selectedIds: selectedSet.size === items.length ? null : selectedSet, sortMode });
          close();
        });
      }

      const resetBtn = modal.querySelector('#resetFilters');
      if (resetBtn) resetBtn.addEventListener('click', close);

      const selectAllBtn = modal.querySelector('#selectAllItems');
      if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
          modal
            .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
            .forEach((cb) => (cb.checked = true));
        });
      }

      const clearAllBtn = modal.querySelector('#clearAllItems');
      if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
          modal
            .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
            .forEach((cb) => (cb.checked = false));
        });
      }

      const searchInput = modal.querySelector('#filterDeviceSearch');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const query = (e.target.value || '').trim().toLowerCase();
          modal.querySelectorAll('#deviceChecklist .check-item').forEach((item) => {
            const label = item.querySelector('label');
            const text = (label?.textContent || '').toLowerCase();
            item.style.display = text.includes(query) ? 'flex' : 'none';
          });
        });
      }

      const clearBtn = modal.querySelector('#filterDeviceClear');
      if (clearBtn && searchInput) {
        clearBtn.addEventListener('click', () => {
          searchInput.value = '';
          modal
            .querySelectorAll('#deviceChecklist .check-item')
            .forEach((item) => (item.style.display = 'flex'));
          searchInput.focus();
        });
      }

      escHandler = (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
      };
      document.addEventListener('keydown', escHandler);
    };

    const bindFilterTabHandlers = (modal, items) => {
      const filterTabsEl = modal.querySelectorAll('.filter-tab');
      const filterGroups = [
        { name: 'connectivity', ids: ['online', 'offline', 'notInstalled'] },
        { name: 'status', ids: ['normal', 'standby', 'alert', 'failure'] },
        { name: 'consumption', ids: ['withConsumption', 'noConsumption'] },
        { name: 'type', ids: ['elevators', 'escalators', 'hvac', 'others', 'commonArea', 'stores'] },
      ];

      const getFilterFn = (filterId) => {
        const tabConfig = filterTabs.find((t) => t.id === filterId);
        return tabConfig ? tabConfig.filter : () => false;
      };

      const applyActiveFilters = () => {
        const itemPassesGroup = (item, groupActiveFilters) => {
          if (groupActiveFilters.length === 0) return true;
          return groupActiveFilters.some((filterId) => getFilterFn(filterId)(item));
        };

        let filteredItems = [...items];
        for (let i = 0; i < filterGroups.length; i++) {
          const group = filterGroups[i];
          const activeInGroup = Array.from(filterTabsEl)
            .filter(
              (t) => group.ids.includes(t.getAttribute('data-filter')) && t.classList.contains('active')
            )
            .map((t) => t.getAttribute('data-filter'));
          if (activeInGroup.length > 0) {
            filteredItems = filteredItems.filter((item) => itemPassesGroup(item, activeInGroup));
          }
          for (let j = i + 1; j < filterGroups.length; j++) {
            const nextGroup = filterGroups[j];
            nextGroup.ids.forEach((filterId) => {
              const tab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === filterId);
              if (!tab) return;
              const filterFn = getFilterFn(filterId);
              const hasMatchingItems = filteredItems.some((item) => filterFn(item));
              if (!hasMatchingItems && tab.classList.contains('active')) tab.classList.remove('active');
            });
          }
        }

        const activeFilters = Array.from(filterTabsEl)
          .filter((t) => t.classList.contains('active') && t.getAttribute('data-filter') !== 'all')
          .map((t) => t.getAttribute('data-filter'));

        const activeByGroup = {};
        filterGroups.forEach((group) => {
          const activeInGroup = activeFilters.filter((id) => group.ids.includes(id));
          if (activeInGroup.length > 0) activeByGroup[group.name] = activeInGroup;
        });

        const checkboxes = modal.querySelectorAll(`#deviceChecklist input[type='checkbox']`);
        checkboxes.forEach((cb) => {
          const itemId = cb.getAttribute(itemIdAttr);
          const item = items.find((i) => String(getItemId(i)) === String(itemId));
          if (!item) return;
          if (activeFilters.length === 0) {
            cb.checked = true;
          } else {
            cb.checked = Object.entries(activeByGroup).every(([_groupName, groupFilterIds]) => {
              return groupFilterIds.some((filterId) => getFilterFn(filterId)(item));
            });
          }
        });
      };

      const statusToConnectivity = {
        normal: 'online',
        standby: 'online',
        alert: 'online',
        failure: 'online',
        offline: 'offline',
      };

      const getFilteredItems = () => {
        let filteredItems = [...items];
        filterGroups.forEach((group) => {
          const activeInGroup = Array.from(filterTabsEl)
            .filter(
              (t) => group.ids.includes(t.getAttribute('data-filter')) && t.classList.contains('active')
            )
            .map((t) => t.getAttribute('data-filter'));
          if (activeInGroup.length > 0) {
            filteredItems = filteredItems.filter((item) =>
              activeInGroup.some((filterId) => getFilterFn(filterId)(item))
            );
          }
        });
        return filteredItems;
      };

      const updateFilterCounts = (filteredItems) => {
        filterTabs.forEach((tabConfig) => {
          if (tabConfig.id === 'all') {
            const countEl = modal.querySelector('#countAll');
            if (countEl) countEl.textContent = filteredItems.length;
          } else {
            const count = filteredItems.filter(tabConfig.filter).length;
            const countEl = modal.querySelector(
              `#count${tabConfig.id.charAt(0).toUpperCase() + tabConfig.id.slice(1)}`
            );
            if (countEl) countEl.textContent = count;
          }
        });
      };

      const syncTodosButton = () => {
        const allTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === 'all');
        const otherTabs = Array.from(filterTabsEl).filter((t) => t.getAttribute('data-filter') !== 'all');
        const allOthersActive = otherTabs.every((t) => t.classList.contains('active'));
        if (allTab) allTab.classList.toggle('active', allOthersActive);
      };

      filterTabsEl.forEach((tab) => {
        tab.addEventListener('click', () => {
          const filterType = tab.getAttribute('data-filter');
          const otherTabs = Array.from(filterTabsEl).filter((t) => t.getAttribute('data-filter') !== 'all');
          const allTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === 'all');

          if (filterType === 'all') {
            const allOthersActive = otherTabs.every((t) => t.classList.contains('active'));
            if (allOthersActive) {
              otherTabs.forEach((t) => t.classList.remove('active'));
              if (allTab) allTab.classList.remove('active');
              modal
                .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
                .forEach((cb) => (cb.checked = false));
            } else {
              otherTabs.forEach((t) => t.classList.add('active'));
              if (allTab) allTab.classList.add('active');
              modal
                .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
                .forEach((cb) => (cb.checked = true));
            }
            return;
          }

          tab.classList.toggle('active');
          const isNowActive = tab.classList.contains('active');

          if (isNowActive) {
            const impliedConnectivity = statusToConnectivity[filterType];
            if (impliedConnectivity) {
              const connectivityTab = Array.from(filterTabsEl).find(
                (t) => t.getAttribute('data-filter') === impliedConnectivity
              );
              if (connectivityTab && !connectivityTab.classList.contains('active'))
                connectivityTab.classList.add('active');
            }
            const filteredItems = getFilteredItems();
            const typeIds = ['elevators', 'escalators', 'hvac', 'others', 'commonArea', 'stores'];
            typeIds.forEach((typeId) => {
              const typeTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === typeId);
              if (!typeTab) return;
              const typeFilterFn = getFilterFn(typeId);
              const hasItems = filteredItems.some((item) => typeFilterFn(item));
              if (hasItems && !typeTab.classList.contains('active')) typeTab.classList.add('active');
            });
            const consumptionIds = ['withConsumption', 'noConsumption'];
            consumptionIds.forEach((consId) => {
              const consTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === consId);
              if (!consTab) return;
              const consFilterFn = getFilterFn(consId);
              const hasItems = filteredItems.some((item) => consFilterFn(item));
              if (hasItems && !consTab.classList.contains('active')) consTab.classList.add('active');
            });
          }

          applyActiveFilters();
          const filteredItems = getFilteredItems();
          updateFilterCounts(filteredItems);
          syncTodosButton();
        });
      });

      // RFC-0110: Setup expand button (+) event listeners for device list tooltip
      setupExpandButtonListeners(modal, items, filterTabs, filterTabIcons, getItemLabel, getItemSubLabel);
    };

    // RFC-0110: Device list tooltip for expand buttons (+)
    const showDeviceTooltip = (
      triggerEl,
      filterId,
      devices,
      _filterTabs,
      _filterTabIcons,
      _getItemLabel,
      _getItemSubLabel
    ) => {
      const InfoTooltip = window.MyIOLibrary?.InfoTooltip || window.MyIO?.InfoTooltip || window.InfoTooltip;

      if (!InfoTooltip) {
        LogHelper.warn('[MAIN_UNIQUE] InfoTooltip not available');
        return;
      }

      const filterTabConfig = filterTabs.find((t) => t.id === filterId);
      const label = filterTabConfig?.label || filterId;
      const icon = filterTabIcons[filterId] || '📋';

      let devicesHtml = '';
      if (devices.length === 0) {
        devicesHtml = `
          <div class="myio-info-tooltip__section">
            <div style="text-align: center; padding: 16px 0; color: #94a3b8; font-style: italic;">
              Nenhum dispositivo
            </div>
          </div>
        `;
      } else {
        const dotColors = {
          online: '#22c55e',
          offline: '#6b7280',
          notInstalled: '#92400e',
          normal: '#3b82f6',
          standby: '#22c55e',
          alert: '#f59e0b',
          failure: '#ef4444',
          elevators: '#7c3aed',
          escalators: '#db2777',
          hvac: '#0891b2',
          others: '#57534e',
          commonArea: '#0284c7',
          stores: '#9333ea',
        };
        const dotColor = dotColors[filterId] || '#94a3b8';

        const deviceItems = devices
          .slice(0, 50)
          .map((device) => {
            const deviceLabel = getItemLabel(device) || 'Sem nome';
            const customerName = getItemSubLabel ? getItemSubLabel(device) : '';
            const displayLabel = customerName ? `${deviceLabel} (${customerName})` : deviceLabel;
            return `
            <div class="myio-info-tooltip__row" style="padding: 6px 0; gap: 8px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0;"></span>
              <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px;" title="${displayLabel}">${displayLabel}</span>
            </div>
          `;
          })
          .join('');

        const moreText =
          devices.length > 50
            ? `<div style="font-style: italic; color: #94a3b8; font-size: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0; margin-top: 8px;">... e mais ${
                devices.length - 50
              } dispositivos</div>`
            : '';

        devicesHtml = `
          <div class="myio-info-tooltip__section">
            <div class="myio-info-tooltip__section-title">
              Dispositivos (${devices.length})
            </div>
            <div style="max-height: 280px; overflow-y: auto;">
              ${deviceItems}
              ${moreText}
            </div>
          </div>
        `;
      }

      InfoTooltip.show(triggerEl, {
        icon: icon,
        title: `${label} (${devices.length})`,
        content: devicesHtml,
      });
    };

    const hideDeviceTooltip = () => {
      const InfoTooltip = window.MyIOLibrary?.InfoTooltip;
      if (InfoTooltip) {
        InfoTooltip.startDelayedHide();
      }
    };

    const setupExpandButtonListeners = (
      modal,
      items,
      _filterTabs,
      _filterTabIcons,
      _getItemLabel,
      _getItemSubLabel
    ) => {
      const expandBtns = modal.querySelectorAll('.filter-tab-expand');

      expandBtns.forEach((btn) => {
        const filterId = btn.getAttribute('data-expand-filter');
        if (!filterId) return;

        const filterTabConfig = filterTabs.find((t) => t.id === filterId);
        const filterFn = filterTabConfig?.filter || (() => false);

        btn.addEventListener('mouseenter', (e) => {
          e.stopPropagation();
          const matchingDevices = items.filter(filterFn);
          showDeviceTooltip(
            btn,
            filterId,
            matchingDevices,
            filterTabs,
            filterTabIcons,
            getItemLabel,
            getItemSubLabel
          );
        });

        btn.addEventListener('mouseleave', (e) => {
          e.stopPropagation();
          hideDeviceTooltip();
        });

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const matchingDevices = items.filter(filterFn);
          showDeviceTooltip(
            btn,
            filterId,
            matchingDevices,
            filterTabs,
            filterTabIcons,
            getItemLabel,
            getItemSubLabel
          );
        });
      });
    };

    const open = (items, state = {}) => {
      if (!items || items.length === 0) {
        LogHelper.warn(`[${widgetName}] No items to display in filter modal`);
        window.alert('Nenhum item encontrado. Por favor, aguarde o carregamento dos dados.');
        return;
      }
      LogHelper.log(`[${widgetName}] Opening filter modal with ${items.length} items`);

      // RFC-0115: Get current theme from mainUniqueWrap
      const currentTheme = document.getElementById('mainUniqueWrap')?.getAttribute('data-theme') || 'light';

      if (!globalContainer) {
        globalContainer = document.getElementById(containerId);
        if (!globalContainer) {
          globalContainer = document.createElement('div');
          globalContainer.id = containerId;
          globalContainer.innerHTML = `<style>${generateStyles()}</style>${generateModalHTML()}`;
          document.body.appendChild(globalContainer);
          const modal = globalContainer.querySelector('#filterModal');
          if (modal) setupHandlers(modal, items, state);
          LogHelper.log(`[${widgetName}] Modal created and attached to document.body`);
        }
      }

      // RFC-0115: Apply current theme to modal container
      globalContainer.setAttribute('data-theme', currentTheme);

      const modal = globalContainer.querySelector('#filterModal');
      if (!modal) return;

      const counts = calculateCounts(items);
      const tabsContainer = modal.querySelector('#filterTabsContainer');
      if (tabsContainer) {
        tabsContainer.innerHTML = generateFilterTabsHTML(counts);
        bindFilterTabHandlers(modal, items);
      }

      populateChecklist(modal, items, state.selectedIds);

      const sortRadio = modal.querySelector(
        `input[name="sortMode"][value="${state.sortMode || 'cons_desc'}"]`
      );
      if (sortRadio) sortRadio.checked = true;

      modal.classList.remove('hidden');
      document.body.classList.add('filter-modal-open');
    };

    const close = () => {
      if (globalContainer) {
        const modal = globalContainer.querySelector('#filterModal');
        if (modal) modal.classList.add('hidden');
      }
      document.body.classList.remove('filter-modal-open');
      if (typeof onClose === 'function') onClose();
    };

    const destroy = () => {
      if (escHandler) {
        document.removeEventListener('keydown', escHandler);
        escHandler = null;
      }
      if (globalContainer) {
        globalContainer.remove();
        globalContainer = null;
      }
      document.body.classList.remove('filter-modal-open');
      LogHelper.log(`[${widgetName}] Filter modal destroyed`);
    };

    return { open, close, destroy };
  };

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

    return DEFAULT_SHOPPING_CARDS.map((card) => {
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
    CLIENT_ID,
    CLIENT_SECRET,
    CUSTOMER_ING_ID,
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

  // === 3. EXTRACT WELCOME CONFIG FROM SETTINGS ===
  const welcomeConfig = {
    enableDebugMode: settings.enableDebugMode,
    defaultHeroTitle: settings.defaultHeroTitle,
    defaultHeroDescription: settings.defaultHeroDescription,
    defaultPrimaryLabel: settings.defaultPrimaryLabel,
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

  const welcomeModal = MyIOLibrary.openWelcomeModal({
    ctx: self.ctx,
    themeMode: currentThemeMode,
    showThemeToggle: true,
    showUserMenu: true, // Explicitly enable user menu
    configTemplate: welcomeConfig,
    shoppingCards: DEFAULT_SHOPPING_CARDS, // Initial with zeros, updated async below
    cardVersion: 'v1', // Use original card style (not Metro UI v2)
    userInfo: userInfo, // Pass user info for display
    ctaLabel: welcomeConfig.defaultPrimaryLabel || 'ACESSAR PAINEL',
    ctaDisabled: false,
    closeOnCtaClick: true,
    closeOnCardClick: true,
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
  const waitForDataReadyWithRetry = async (componentName, onDataReceived, maxRetries = 10, intervalMs = 3000) => {
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
        await new Promise(resolve => setTimeout(resolve, intervalMs));
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
            byCategory: buildEnergyCategoryDataByShopping(classifiedData),
            shoppingsEnergy: buildShoppingsEnergyBreakdown(classifiedData),
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
            byCategory: buildWaterCategoryDataByShopping(classifiedData),
            shoppingsWater: buildShoppingsWaterBreakdown(classifiedData),
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

      window.dispatchEvent(
        new CustomEvent('myio:temperature-data-ready', {
          detail: {
            globalAvg: tempAvg,
            isFiltered: false,
            shoppingsInRange: [],
            shoppingsOutOfRange: [],
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
        enableDebugMode: settings.enableDebugMode,
      },
      initialTab: DOMAIN_ENERGY,
      initialDateRange: {
        start: window.MyIOLibrary.getFirstDayOfMonth(),
        end: new Date(),
      },
      onTabChange: (tabId, contextId, target) => {
        LogHelper.log('[MAIN_UNIQUE] Tab changed:', tabId, contextId, target);
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
          LogHelper.log(`[MAIN_UNIQUE] Orchestrator not ready, retry ${attempt}/${maxRetries} in ${intervalMs}ms`);

          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, intervalMs));
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
      retryGetDevicesWithToast(currentTelemetryDomain, currentTelemetryContext).then(devices => {
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
      createFilterModal: window.MyIOUtils?.createFilterModal,

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
    const shoppingIds = Array.isArray(selection) ? selection.map((s) => s?.value).filter(Boolean) : [];

    // RFC-0126: Store in global state for backward compatibility with legacy widgets
    window.custumersSelected = selection;
    window.STATE = window.STATE || {};
    window.STATE.selectedShoppingIds = shoppingIds;

    LogHelper.log('[MAIN_UNIQUE] myio:filter-applied received:', shoppingIds.length, 'shoppings selected');

    // 1. Apply filter to TelemetryGrid
    if (telemetryGridInstance) {
      telemetryGridInstance.applyFilter(shoppingIds);
    }

    // 2. Calculate filtered stats and update Header
    const classified = window.MyIOOrchestratorData?.classified;
    if (classified && headerInstance) {
      // Build filtered classified structure (used by tooltip/category breakdowns)
      // Filter devices by selected shoppingIds (match by customerId or ingestionId)
      const filterDevices = (devices) => {
        if (shoppingIds.length === 0) return devices; // No filter = all
        return devices.filter(
          (d) => shoppingIds.includes(d.customerId) || shoppingIds.includes(d.ingestionId)
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
            byCategory: buildEnergyCategoryDataByShopping(filteredClassified),
            shoppingsEnergy: buildShoppingsEnergyBreakdown(filteredClassified),
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
            byCategory: buildWaterCategoryDataByShopping(filteredClassified),
            shoppingsWater: buildShoppingsWaterBreakdown(filteredClassified),
            lastUpdated: new Date().toISOString(),
          },
        })
      );

      window.dispatchEvent(
        new CustomEvent('myio:temperature-data-ready', {
          detail: {
            globalAvg: tempAvg,
            isFiltered: isFiltered,
            shoppingsInRange: [],
            shoppingsOutOfRange: [],
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
      maxSelections: 6,
      getDateRange: () => ({
        start: self.ctx.$scope.startDateISO,
        end: self.ctx.$scope.endDateISO,
      }),
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
    const { deviceCounts } = e.detail;

    // Update header KPIs (header listens to event automatically)
    if (headerInstance && deviceCounts) {
      LogHelper.log('[MAIN_UNIQUE] Header will update via event listeners');
    }

    // Update telemetry grid devices for current domain/context
    if (telemetryGridInstance) {
      const devices =
        window.MyIOOrchestrator?.getDevices?.(currentTelemetryDomain, currentTelemetryContext) || [];
      telemetryGridInstance.updateDevices(devices);
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
  });

  // === HELPER FUNCTIONS ===

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

  function handleContextChange(tabId, contextId, target) {
    // Check if this is a panel modal request (Geral, Resumo, Resumo Geral)
    const panelContexts = ['energy_general', 'water_summary', 'temperature_summary'];

    if (panelContexts.includes(contextId)) {
      // Open panel modal instead of switching TELEMETRY
      handlePanelModalRequest(tabId, 'summary');
    } else {
      currentTelemetryDomain = tabId;
      currentTelemetryContext = contextId;

      // Keep legacy event for backwards compatibility (TELEMETRY widget and any external listeners)
      window.dispatchEvent(
        new CustomEvent('myio:telemetry-config-change', {
          detail: {
            domain: tabId,
            context: contextId,
            timestamp: Date.now(),
          },
        })
      );

      if (telemetryGridInstance) {
        const devices = window.MyIOOrchestrator?.getDevices?.(tabId, contextId) || [];
        telemetryGridInstance.updateConfig(tabId, contextId);
        telemetryGridInstance.updateDevices(devices);
      }

      // Also dispatch dashboard state for FOOTER
      window.dispatchEvent(
        new CustomEvent('myio:dashboard-state', {
          detail: { domain: tabId, stateId: target },
        })
      );
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
        byCategory: buildEnergyCategoryDataByShopping(classified),
        shoppingsEnergy: buildShoppingsEnergyBreakdown(classified),
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
        byCategory: buildWaterCategoryDataByShopping(classified),
        shoppingsWater: buildShoppingsWaterBreakdown(classified),
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

  // Temperature summary event
  window.dispatchEvent(
    new CustomEvent('myio:temperature-data-ready', {
      detail: {
        globalAvg: tempAvg,
        isFiltered: false,
        shoppingsInRange: [],
        shoppingsOutOfRange: [],
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
    const deviceProfile = (device.deviceProfile || '').toUpperCase();
    const deviceType = (device.deviceType || '').toUpperCase();
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

// ===================================================================
// Device Classification Logic
// ===================================================================
function classifyAllDevices(data) {
  // Guard: LogHelper not ready yet (onInit not complete)
  if (!LogHelper) return null;

  const classified = {
    energy: { equipments: [], stores: [], entrada: [] },
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
    const domain = window.MyIOLibrary.detectDomain(device);
    const context = window.MyIOLibrary.detectContext(device, domain);

    if (classified[domain]?.[context]) {
      classified[domain][context].push(device);
    }
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
  const consumptionValue = dataKeyValues['consumption'] || null;
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
      delayMins: 1440, // 24 hours
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

    // Customer info
    customerId: dataKeyValues['customerId'] || datasource.entity?.customerId?.id || '',
    customerName: dataKeyValues['customerName'] || dataKeyValues['ownerName'] || '',
    ownerName: dataKeyValues['ownerName'] || '', // RFC-0111 FIX: Expose ownerName separately

    // Timestamps
    lastActivityTime: dataKeyValues['lastActivityTime'],
    lastConnectTime: dataKeyValues['lastConnectTime'],
    lastDisconnectTime: dataKeyValues['lastDisconnectTime'],

    // Telemetry values - include both formats for compatibility
    consumption: consumptionValue,
    consumptionPower: consumptionValue, // RFC-0111 FIX: Alias for EQUIPMENTS
    val: consumptionValue, // RFC-0111: Card component expects val
    value: consumptionValue, // RFC-0111 FIX: Another alias used by some components
    pulses: dataKeyValues['pulses'],
    temperature: dataKeyValues[DOMAIN_TEMPERATURE],
    water_level: dataKeyValues['water_level'],

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

// Get devices by domain and context
window.MyIOOrchestrator.getDevices = function (domain, context) {
  const data = window.MyIOOrchestratorData?.classified;
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
  LogHelper.log('Starting API enrichment with customerId:', customerId);

  // Create MyIOAuth instance
  let myIOAuth;
  try {
    myIOAuth = lib.buildMyioIngestionAuth({
      dataApiHost: dataApiHost || 'https://api.data.apps.myio-bas.com',
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

  const period = window.MyIOLibrary.getDefaultPeriodCurrentMonthSoFar();

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
        `${dataApiHost}/api/v1/telemetry/customers/${customerId}/energy/devices/totals`
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
        const rows = Array.isArray(json) ? json : json?.data ?? [];

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
        `${dataApiHost}/api/v1/telemetry/customers/${customerId}/water/devices/totals`
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
        const rows = Array.isArray(json) ? json : json?.data ?? [];

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
 * RFC-0111: Trigger API enrichment after initial classification
 * This is called asynchronously so it doesn't block the initial render
 */
async function triggerApiEnrichment() {
  // Guard: LogHelper not ready yet (onInit not complete)
  if (!LogHelper) return;

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

  // Set in-progress flag
  _apiEnrichmentInProgress = true;
  LogHelper.log('Credentials available, starting API enrichment');

  // Get current classified data
  const classified = window.MyIOOrchestratorData?.classified;
  if (!classified) {
    LogHelper.log('No classified data available for enrichment');
    _apiEnrichmentInProgress = false;
    return;
  }

  try {
    // Enrich with API data
    const enriched = await enrichDevicesWithConsumption(classified);

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
          byCategory: buildEnergyCategoryDataByShopping(enriched),
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
          byCategory: buildWaterCategoryDataByShopping(enriched),
          shoppingsWater: buildShoppingsWaterBreakdown(enriched),
          lastUpdated: new Date().toISOString(),
        },
      })
    );

    // Temperature summary event (include tooltip fields)
    window.dispatchEvent(
      new CustomEvent('myio:temperature-data-ready', {
        detail: {
          globalAvg: tempAvg,
          isFiltered: false,
          shoppingsInRange: [],
          shoppingsOutOfRange: [],
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

// Start API enrichment after a short delay (to allow credentials to load)
setTimeout(triggerApiEnrichment, 2000);

self.onDestroy = function () {
  // Cleanup
};
