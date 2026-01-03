// ===================================================================
// RFC-0111: MAIN_UNIQUE_DATASOURCE Controller
// Single Datasource Architecture - Head Office Dashboard
// ===================================================================

/* eslint-disable no-undef */
/* global self, window, document */

// Global throttle counter for onDataUpdated (max 4 calls)
let _onDataUpdatedCallCount = 0;
const MAX_DATA_UPDATED_CALLS = 4;

// RFC-0111: Default shopping cards with correct dashboard IDs (from WELCOME controller)
// Using deviceCounts to show energy/water/temperature icons instead of subtitle text
const DEFAULT_SHOPPING_CARDS = [
  {
    title: 'Mestre Álvaro',
    buttonId: 'ShoppingMestreAlvaro',
    dashboardId: '6c188a90-b0cc-11f0-9722-210aa9448abc',
    entityId: '6c188a90-b0cc-11f0-9722-210aa9448abc',
    entityType: 'ASSET',
    deviceCounts: { energy: 45, water: 12, temperature: 8 },
  },
  {
    title: 'Mont Serrat',
    buttonId: 'ShoppingMontSerrat',
    dashboardId: '39e4ca30-b503-11f0-be7f-e760d1498268',
    entityId: '39e4ca30-b503-11f0-be7f-e760d1498268',
    entityType: 'ASSET',
    deviceCounts: { energy: 38, water: 10, temperature: 6 },
  },
  {
    title: 'Moxuara',
    buttonId: 'ShoppingMoxuara',
    dashboardId: '4b53bbb0-b5a7-11f0-be7f-e760d1498268',
    entityId: '4b53bbb0-b5a7-11f0-be7f-e760d1498268',
    entityType: 'ASSET',
    deviceCounts: { energy: 52, water: 15, temperature: 10 },
  },
  {
    title: 'Rio Poty',
    buttonId: 'ShoppingRioPoty',
    dashboardId: 'd432db90-cee9-11f0-998e-25174baff087',
    entityId: 'd432db90-cee9-11f0-998e-25174baff087',
    entityType: 'ASSET',
    deviceCounts: { energy: 33, water: 8, temperature: 5 },
  },
  {
    title: 'Shopping da Ilha',
    buttonId: 'ShoppingDaIlha',
    dashboardId: 'd2754480-b668-11f0-be7f-e760d1498268',
    entityId: 'd2754480-b668-11f0-be7f-e760d1498268',
    entityType: 'ASSET',
    deviceCounts: { energy: 41, water: 11, temperature: 7 },
  },
  {
    title: 'Metrópole Ananindeua',
    buttonId: 'ShoppingMetropoleAnanindeua',
    dashboardId: 'aaa21b80-d6e9-11f0-998e-25174baff087',
    entityId: 'aaa21b80-d6e9-11f0-998e-25174baff087',
    entityType: 'ASSET',
    deviceCounts: { energy: 29, water: 7, temperature: 4 },
  },
];

self.onInit = async function () {
  'use strict';

  console.log('[MAIN_UNIQUE] onInit called', self.ctx);

  // Debug helper function - stored on self for access from onDataUpdated
  self._logDebug = self.ctx.settings?.enableDebugMode
    ? (...args) => console.log('[MAIN_UNIQUE]', ...args)
    : () => {};

  const logDebug = self._logDebug;

  // === 1. CONFIGURATION ===
  const settings = self.ctx.settings || {};
  let currentThemeMode = settings.defaultThemeMode || 'dark';

  // === 2. LIBRARY REFERENCE ===
  const MyIOLibrary = window.MyIOLibrary;
  if (!MyIOLibrary) {
    console.error('[MAIN_UNIQUE] MyIOLibrary not found');
    return;
  }

  // === 2.1 CREDENTIALS AND UTILITIES FOR TELEMETRY WIDGET ===
  // RFC-0111: TELEMETRY widget depends on these utilities from MAIN
  const DATA_API_HOST = settings.dataApiHost || 'https://api.data.apps.myio-bas.com';

  // Credentials will be fetched from ThingsBoard customer attributes
  let CLIENT_ID = '';
  let CLIENT_SECRET = '';
  let CUSTOMER_ING_ID = '';

  const LogHelper = {
    log: (...args) => console.log('[MAIN_UNIQUE]', ...args),
    warn: (...args) => console.warn('[MAIN_UNIQUE]', ...args),
    error: (...args) => console.error('[MAIN_UNIQUE]', ...args),
  };

  // Get ThingsBoard customer ID and JWT token
  const getCustomerTB_ID = () => {
    // Primary: from settings
    if (settings.customerTB_ID) {
      return settings.customerTB_ID;
    }
    // Fallback: try from ThingsBoard context
    const ctx = self.ctx;
    if (ctx?.stateController?.getStateParams?.()?.entityId?.id) {
      return ctx.stateController.getStateParams().entityId.id;
    }
    if (ctx?.defaultSubscription?.options?.stateParams?.entityId?.id) {
      return ctx.defaultSubscription.options.stateParams.entityId.id;
    }
    // Try from datasource
    const data = ctx?.data || [];
    for (const row of data) {
      if (row?.datasource?.entity?.id?.id) {
        return row.datasource.entity.id.id;
      }
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
    } catch (e) {
      // Fallback methods
    }
    // Try from localStorage
    return localStorage.getItem('jwt_token') || '';
  };

  // Fetch credentials from ThingsBoard customer attributes (like old MAIN)
  const fetchCredentialsFromThingsBoard = async () => {
    const customerTB_ID = getCustomerTB_ID();
    const jwt = getJwtToken();

    logDebug('Fetching credentials for customer:', customerTB_ID);

    if (!customerTB_ID || !jwt) {
      LogHelper.warn('Missing customerTB_ID or JWT token');
      return;
    }

    try {
      // Use MyIOLibrary function to fetch customer attrs
      if (MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage) {
        const attrs = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
        logDebug('Received attrs:', attrs);

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

        logDebug('Credentials updated:', { CLIENT_ID: CLIENT_ID ? '***' : '', CUSTOMER_ING_ID });
      } else {
        LogHelper.error('fetchThingsboardCustomerAttrsFromStorage not available in MyIOLibrary');
      }
    } catch (error) {
      LogHelper.error('Failed to fetch credentials:', error);
    }
  };

  // Utility functions for device status calculation
  const calculateDeviceStatusMasterRules = (device, options = {}) => {
    const now = Date.now();
    const lastActivity = device.lastActivityTime || device.lastConnectTime || 0;
    const offlineThreshold = options.offlineThresholdMs || 30 * 60 * 1000; // 30 min default

    if (!lastActivity) return 'no_info';
    if (now - lastActivity > offlineThreshold) return 'offline';
    if (device.consumption === 0 || device.pulses === 0) return 'no_consumption';
    return 'normal';
  };

  const mapConnectionStatus = (status) => {
    const statusMap = {
      connected: 'online',
      disconnected: 'offline',
      unknown: 'no_info',
    };
    return statusMap[status?.toLowerCase()] || status || 'offline';
  };

  const formatRelativeTime = (ts) => {
    if (!ts) return '—';
    const now = Date.now();
    const diff = now - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return `${days}d atrás`;
  };

  const formatarDuracao = (ms) => {
    if (!ms || isNaN(ms)) return '—';
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}min`;
    if (mins > 0) return `${mins}min`;
    return `${secs}s`;
  };

  const getCustomerNameForDevice = (device) => {
    return device?.customerName || device?.ownerName || device?.customerId || 'N/A';
  };

  const findValue = (values, key, defaultValue = null) => {
    if (!Array.isArray(values)) return defaultValue;
    const found = values.find((v) => v.key === key || v.dataType === key);
    return found ? found.value : defaultValue;
  };

  const fetchCustomerServerScopeAttrs = async (customerId) => {
    logDebug('fetchCustomerServerScopeAttrs called for:', customerId);
    const jwt = getJwtToken();
    if (MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage && customerId && jwt) {
      return await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(customerId, jwt);
    }
    return {};
  };

  const buildHeaderDevicesGrid = (container, devices, options) => {
    logDebug('buildHeaderDevicesGrid called with', devices?.length, 'devices');
    return null;
  };

  // RFC-0111: Fetch logged-in user info from ThingsBoard API
  const fetchUserInfo = async () => {
    try {
      const tbToken = localStorage.getItem('jwt_token');
      const headers = { 'Content-Type': 'application/json' };
      if (tbToken) {
        headers['X-Authorization'] = `Bearer ${tbToken}`;
      }

      const response = await fetch('/api/auth/user', {
        method: 'GET',
        headers: headers,
        credentials: 'include',
      });

      if (!response.ok) {
        logDebug('Failed to fetch user info:', response.status);
        return null;
      }

      const user = await response.json();
      logDebug('User data from API:', user);

      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Usuário';
      return {
        fullName,
        email: user.email || '',
      };
    } catch (error) {
      LogHelper.error('Error fetching user info:', error);
      return null;
    }
  };

  // Expose utilities globally for TELEMETRY widget (initial state)
  window.MyIOUtils = {
    DATA_API_HOST,
    CLIENT_ID,
    CLIENT_SECRET,
    CUSTOMER_ING_ID,
    LogHelper,
    calculateDeviceStatusMasterRules,
    mapConnectionStatus,
    formatRelativeTime,
    formatarDuracao,
    getCustomerNameForDevice,
    findValue,
    fetchCustomerServerScopeAttrs,
    buildHeaderDevicesGrid,
    getConsumptionRangesHierarchical: () => null,
    getCachedConsumptionLimits: () => null,
    getCredentials: () => ({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      customerId: CUSTOMER_ING_ID,
      dataApiHost: DATA_API_HOST,
    }),
    customerTB_ID: getCustomerTB_ID(),
  };

  logDebug('MyIOUtils exposed globally (credentials pending fetch)');

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
  // Fetch user info for display in the modal
  const userInfo = await fetchUserInfo();
  logDebug('User info fetched:', userInfo);

  const welcomeModal = MyIOLibrary.openWelcomeModal({
    ctx: self.ctx,
    themeMode: currentThemeMode,
    showThemeToggle: true,
    showUserMenu: true, // Explicitly enable user menu
    configTemplate: welcomeConfig,
    shoppingCards: DEFAULT_SHOPPING_CARDS, // Use hardcoded cards with correct dashboardIds
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
      console.log('[MAIN_UNIQUE] Welcome modal closed');
    },
    onCardClick: (card) => {
      console.log('[MAIN_UNIQUE] Shopping card clicked:', card.title);
      // Handle shopping selection if needed
    },
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
  }

  // === 6. RFC-0114: RENDER MENU COMPONENT ===
  const menuContainer = document.getElementById('menuContainer');
  let menuInstance = null;

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
      initialTab: 'energy',
      initialDateRange: {
        start: getFirstDayOfMonth(),
        end: new Date(),
      },
      onTabChange: (tabId, contextId, target) => {
        console.log('[MAIN_UNIQUE] Tab changed:', tabId, contextId, target);
      },
      onContextChange: (tabId, contextId, target) => {
        console.log('[MAIN_UNIQUE] Context changed:', tabId, contextId, target);
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
  }

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
        console.log('[MAIN_UNIQUE] Compare clicked:', entities.length, unitType);
      },
      onSelectionChange: (entities) => {
        console.log('[MAIN_UNIQUE] Selection changed:', entities.length);
      },
    });
  }

  // === 8. INITIALIZE ORCHESTRATOR ===
  await initializeOrchestrator();

  // === 9. LISTEN FOR DATA READY EVENT ===
  window.addEventListener('myio:data-ready', (e) => {
    const { deviceCounts } = e.detail;

    // NOTE: We use DEFAULT_SHOPPING_CARDS with hardcoded dashboardIds
    // Do NOT update shopping cards from dynamically generated data
    // The hardcoded cards have the correct navigation dashboardIds

    // Update header KPIs
    // NOTE: RFC-0113 header updates via events, not direct method calls
    // The header component listens to 'myio:data-ready' event automatically
    if (headerInstance && deviceCounts) {
      logDebug('[MAIN_UNIQUE] Header will update via event listeners');
    }

    // Update menu shoppings
    if (menuInstance && e.detail.shoppings) {
      menuInstance.updateShoppings?.(e.detail.shoppings);
    }
  });

  // === 10. LISTEN FOR PANEL MODAL REQUESTS ===
  window.addEventListener('myio:panel-modal-request', (e) => {
    const { domain, panelType } = e.detail;
    handlePanelModalRequest(domain, panelType);
  });

  // === HELPER FUNCTIONS ===

  function applyGlobalTheme(themeMode) {
    const wrap = document.getElementById('mainUniqueWrap');
    if (wrap) {
      wrap.setAttribute('data-theme', themeMode);
    }
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
      // Dispatch config change to TELEMETRY
      window.dispatchEvent(
        new CustomEvent('myio:telemetry-config-change', {
          detail: {
            domain: tabId,
            context: contextId,
            timestamp: Date.now(),
          },
        })
      );

      // Also dispatch dashboard state for FOOTER
      window.dispatchEvent(
        new CustomEvent('myio:dashboard-state', {
          detail: { domain: tabId, stateId: target },
        })
      );
    }
  }

  function handlePanelModalRequest(domain, panelType) {
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
    if (domain === 'energy' && MyIOLibrary.createEnergyPanel) {
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
    } else if (domain === 'water' && MyIOLibrary.createWaterPanel) {
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
    } else if (domain === 'temperature' && MyIOLibrary.createTemperaturePanel) {
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

  function getFirstDayOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  function formatEnergy(value) {
    if (!value || isNaN(value)) return '- kWh';
    if (value >= 1000) return (value / 1000).toFixed(1) + ' MWh';
    return value.toFixed(0) + ' kWh';
  }

  function formatTemperature(value) {
    if (!value || isNaN(value)) return '- °C';
    return value.toFixed(1) + ' °C';
  }

  function formatWater(value) {
    if (!value || isNaN(value)) return '- m³';
    return value.toFixed(1) + ' m³';
  }
};

// ===================================================================
// onDataUpdated - Called when ThingsBoard datasource updates
// RFC-0111: Added data hash check to prevent infinite loop
// RFC-0111: Added throttle to max 4 calls
// ===================================================================
self.onDataUpdated = function () {
  // Throttle: only allow MAX_DATA_UPDATED_CALLS calls
  _onDataUpdatedCallCount++;
  if (_onDataUpdatedCallCount > MAX_DATA_UPDATED_CALLS) {
    if (_onDataUpdatedCallCount === MAX_DATA_UPDATED_CALLS + 1) {
      console.log('[MAIN_UNIQUE] onDataUpdated throttled - max calls reached:', MAX_DATA_UPDATED_CALLS);
    }
    return;
  }

  console.log('[MAIN_UNIQUE] onDataUpdated call #' + _onDataUpdatedCallCount);

  const allData = self.ctx.data || [];

  // RFC-0111: Filter to only use "AllDevices" datasource, ignore "customers" and others
  const data = allData.filter((row) => {
    const aliasName = row.datasource?.aliasName || '';
    return aliasName === 'AllDevices' || aliasName === 'allDevices' || aliasName === 'all_devices';
  });

  console.log(`[MAIN_UNIQUE] Total rows: ${allData.length}, AllDevices rows: ${data.length}`);

  // Skip if no data from AllDevices
  if (data.length === 0) {
    console.log('[MAIN_UNIQUE] No data from AllDevices datasource - check alias configuration');
    return;
  }

  // Create a hash of the data to detect changes
  // Only process if data actually changed
  const dataHash = data
    .map((row) => {
      const ds = row.datasource || {};
      const firstValue = row.data?.[0]?.data?.[0]?.[1] || '';
      return `${ds.entityId || ''}:${firstValue}`;
    })
    .join('|')
    .substring(0, 500); // Limit hash size

  if (self._lastDataHash === dataHash) {
    // Data hasn't changed, skip processing
    return;
  }
  self._lastDataHash = dataHash;

  // Classify all devices from AllDevices datasource (pass logDebug for debug output)
  const classified = classifyAllDevices(data, self._logDebug);

  // Build shopping cards for welcome modal
  const shoppingCards = buildShoppingCards(classified);

  // Calculate device counts
  const deviceCounts = calculateDeviceCounts(classified);

  // Dispatch data ready event
  window.dispatchEvent(
    new CustomEvent('myio:data-ready', {
      detail: {
        classified,
        shoppingCards,
        deviceCounts,
        shoppings: buildShoppingsList(data),
        timestamp: Date.now(),
      },
    })
  );
};

// ===================================================================
// Device Classification Logic
// ===================================================================
function classifyAllDevices(data, logDebug) {
  const classified = {
    energy: { equipments: [], stores: [], entrada: [] },
    water: { hidrometro_area_comum: [], hidrometro: [], entrada: [] },
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

  if (logDebug) {
    logDebug(`Grouping: ${data.length} rows → ${deviceRowsMap.size} unique devices`);
  }

  // Debug: log first device's rows structure
  if (deviceRowsMap.size > 0 && logDebug) {
    const firstDeviceRows = deviceRowsMap.values().next().value;
    const dataKeysFound = firstDeviceRows.map((r) => r.dataKey?.name).filter(Boolean);
    logDebug('First device dataKeys:', dataKeysFound);
  }

  // Process each device with all its rows
  let deviceIndex = 0;
  for (const [entityId, rows] of deviceRowsMap) {
    const device = extractDeviceMetadataFromRows(rows, logDebug);

    // Debug: log first 3 devices
    if (deviceIndex < 3 && logDebug) {
      logDebug(`Device ${deviceIndex}:`, {
        id: device.id,
        name: device.name,
        deviceType: device.deviceType,
        deviceProfile: device.deviceProfile,
      });
    }

    const domain = detectDomain(device);
    const context = detectContext(device, domain);

    if (classified[domain]?.[context]) {
      classified[domain][context].push(device);
    }

    deviceIndex++;
  }

  // Log classification summary - always log this for debugging
  const summary = {
    energy: {
      equipments: classified.energy.equipments.length,
      stores: classified.energy.stores.length,
      entrada: classified.energy.entrada.length,
    },
    water: {
      area_comum: classified.water.hidrometro_area_comum.length,
      lojas: classified.water.hidrometro.length,
      entrada: classified.water.entrada.length,
    },
    temperature: {
      climatizado: classified.temperature.termostato.length,
      externo: classified.temperature.termostato_external.length,
    },
  };
  console.log('[MAIN_UNIQUE] Classification summary:', JSON.stringify(summary));

  // Debug: Log sample of energy/equipments devices to understand why there are so many
  if (classified.energy.equipments.length > 0 && logDebug) {
    // Count by deviceType
    const typeCounts = {};
    classified.energy.equipments.forEach((d) => {
      const t = d.deviceType || '(empty)';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    logDebug('Energy/equipments by deviceType:', typeCounts);

    const sampleSize = Math.min(10, classified.energy.equipments.length);
    const samples = classified.energy.equipments.slice(0, sampleSize).map((d) => ({
      name: d.name,
      deviceType: d.deviceType || '(empty)',
      deviceProfile: d.deviceProfile || '(empty)',
    }));
    logDebug('Sample energy/equipments devices (first ' + sampleSize + '):', samples);
  }

  // Cache for getDevices
  window.MyIOOrchestratorData = { classified, timestamp: Date.now() };

  return classified;
}

/**
 * Extract device metadata from ALL rows for a single device
 * ThingsBoard sends 1 row per (device, dataKey), so we need to merge all rows
 */
function extractDeviceMetadataFromRows(rows, logDebug) {
  if (!rows || rows.length === 0) return null;

  // Use first row for datasource info (same for all rows of same device)
  const firstRow = rows[0];
  const datasource = firstRow.datasource || {};

  // Extract entityId
  const extractEntityId = (entityIdObj) => {
    if (!entityIdObj) return null;
    if (typeof entityIdObj === 'string') return entityIdObj;
    return entityIdObj.id || null;
  };

  const entityId =
    extractEntityId(datasource.entity?.id) ||
    extractEntityId(datasource.entityId) ||
    datasource.entity?.id?.id ||
    null;

  const deviceName = datasource.entityName || datasource.entity?.name || 'Unknown';

  // Build a map of dataKey values from all rows
  const dataKeyValues = {};
  for (const row of rows) {
    const keyName = row.dataKey?.name;
    if (keyName && row.data && row.data.length > 0) {
      // Get the latest value (last element in data array, index [1] is the value)
      const latestData = row.data[row.data.length - 1];
      if (Array.isArray(latestData) && latestData.length >= 2) {
        dataKeyValues[keyName] = latestData[1];
      }
    }
  }

  // Extract deviceType from dataKey values
  let deviceType = dataKeyValues['deviceType'] || dataKeyValues['type'] || '';

  // Skip generic entity types
  if (deviceType === 'DEVICE' || deviceType === 'CUSTOMER' || deviceType === 'ASSET') {
    deviceType = '';
  }

  // RFC-0111: Infer deviceType from device name if not available
  if (!deviceType && deviceName) {
    const nameLower = deviceName.toLowerCase();

    // Water detection
    if (
      nameLower.includes('hidr') ||
      nameLower.includes('hidro') ||
      nameLower.includes('água') ||
      nameLower.includes('water')
    ) {
      deviceType = 'HIDROMETRO';
    }
    // Temperature detection
    else if (nameLower.includes('termo') || nameLower.includes('temp') || nameLower.includes('sensor')) {
      deviceType = 'TERMOSTATO';
    }
    // Energy - Equipment detection (transformers, substations, main meters)
    else if (
      nameLower.includes('trafo') ||
      nameLower.includes('transformador') ||
      nameLower.includes('subestacao') ||
      nameLower.includes('sub_') ||
      nameLower.includes('entrada') ||
      nameLower.includes('de_entrada') ||
      nameLower.includes('relogio') ||
      nameLower.includes('geral') ||
      nameLower.includes('total') ||
      nameLower.includes('principal')
    ) {
      deviceType = 'ENTRADA';
    }
    // Energy - Store meters (3F_MEDIDOR)
    else if (
      nameLower.includes('loja') ||
      nameLower.includes('luc') ||
      nameLower.includes('medidor') ||
      nameLower.includes('energia') ||
      nameLower.includes('kwh') ||
      nameLower.includes('3f') ||
      /^\d{1,4}[a-z]?[_-]?[a-z]?\d*$/i.test(deviceName) ||
      /^[a-z]{1,3}\d{1,4}$/i.test(deviceName)
    ) {
      deviceType = '3F_MEDIDOR';
    }
  }

  // Extract deviceProfile from dataKey values
  const deviceProfile = dataKeyValues['deviceProfile'] || dataKeyValues['profile'] || '';

  return {
    id: entityId,
    entityId: entityId,
    name: deviceName,
    aliasName: datasource.aliasName || '',
    deviceType: deviceType,
    deviceProfile: deviceProfile,
    ingestionId: dataKeyValues['ingestionId'] || '',
    customerId: dataKeyValues['customerId'] || datasource.entity?.customerId?.id || '',
    customerName: dataKeyValues['customerName'] || dataKeyValues['ownerName'] || '',
    lastActivityTime: dataKeyValues['lastActivityTime'],
    lastConnectTime: dataKeyValues['lastConnectTime'],
    lastDisconnectTime: dataKeyValues['lastDisconnectTime'],
    consumption: dataKeyValues['consumption'],
    pulses: dataKeyValues['pulses'],
    temperature: dataKeyValues['temperature'],
    water_level: dataKeyValues['water_level'],
  };
}

function detectDomain(device) {
  const deviceType = String(device?.deviceType || '').toUpperCase();

  // Water detection: HIDROMETRO or HIDROMETRO_AREA_COMUM
  if (deviceType.includes('HIDROMETRO') || deviceType.includes('HIDRO')) {
    return 'water';
  }

  // Temperature detection: TERMOSTATO or TERMOSTATO_EXTERNAL
  if (deviceType.includes('TERMOSTATO')) {
    return 'temperature';
  }

  // Default: Energy (3F_MEDIDOR, ENTRADA, RELOGIO, TRAFO, SUBESTACAO, etc.)
  return 'energy';
}

/**
 * RFC-0111: Detect device context based on deviceType and deviceProfile
 *
 * WATER Rules:
 * - deviceType = deviceProfile = HIDROMETRO → STORE (hidrometro)
 * - deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_AREA_COMUM → AREA_COMUM
 * - deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_SHOPPING → ENTRADA WATER
 * - deviceType = HIDROMETRO_AREA_COMUM → AREA_COMUM
 *
 * ENERGY Rules:
 * - deviceType = deviceProfile = 3F_MEDIDOR → STORE (stores)
 * - deviceType = 3F_MEDIDOR AND deviceProfile != 3F_MEDIDOR → equipments
 * - deviceType != 3F_MEDIDOR AND NOT (ENTRADA/RELOGIO/TRAFO/SUBESTACAO) → equipments
 * - deviceType = ENTRADA/RELOGIO/TRAFO/SUBESTACAO → ENTRADA ENERGY
 *
 * TEMPERATURE Rules:
 * - deviceType = deviceProfile = TERMOSTATO → termostato (climatized)
 * - deviceType = TERMOSTATO AND deviceProfile = TERMOSTATO_EXTERNAL → termostato_external
 * - deviceType = TERMOSTATO_EXTERNAL → termostato_external
 */
function detectContext(device, domain) {
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase();

  // ENTRADA types - main shopping meters (not individual stores or equipment)
  const entradaTypes = ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO', 'DE_ENTRADA'];
  const isEntrada = entradaTypes.some((t) => deviceType.includes(t) || deviceProfile.includes(t));

  if (domain === 'water') {
    // RFC-0111: HIDROMETRO_SHOPPING → ENTRADA WATER (main water meter for shopping)
    if (deviceProfile.includes('HIDROMETRO_SHOPPING') || deviceProfile.includes('SHOPPING')) {
      return 'entrada';
    }
    // HIDROMETRO_AREA_COMUM in deviceType or deviceProfile → area comum
    if (
      deviceType.includes('HIDROMETRO_AREA_COMUM') ||
      deviceType.includes('AREA_COMUM') ||
      deviceProfile.includes('AREA_COMUM')
    ) {
      return 'hidrometro_area_comum';
    }
    // deviceType = deviceProfile = HIDROMETRO → store (hidrometro)
    if (deviceType.includes('HIDROMETRO') && deviceProfile.includes('HIDROMETRO')) {
      return 'hidrometro'; // Store
    }
    // Default for water: hidrometro (store)
    return 'hidrometro';
  }

  if (domain === 'energy') {
    // RFC-0111: ENTRADA/RELOGIO/TRAFO/SUBESTACAO → ENTRADA ENERGY (main meters)
    if (isEntrada) {
      return 'entrada';
    }
    // RFC-0111: deviceType = deviceProfile = 3F_MEDIDOR → STORE (stores)
    if (deviceType === '3F_MEDIDOR' && deviceProfile === '3F_MEDIDOR') {
      return 'stores';
    }
    // RFC-0111: deviceType = 3F_MEDIDOR AND deviceProfile != 3F_MEDIDOR → equipments
    if (deviceType === '3F_MEDIDOR' && deviceProfile !== '3F_MEDIDOR') {
      return 'equipments';
    }
    // RFC-0111: deviceType != 3F_MEDIDOR → equipments
    return 'equipments';
  }

  if (domain === 'temperature') {
    // TERMOSTATO_EXTERNAL in deviceType → external (non-climatized)
    if (deviceType.includes('TERMOSTATO_EXTERNAL') || deviceType.includes('EXTERNAL')) {
      return 'termostato_external';
    }
    // deviceType = TERMOSTATO AND deviceProfile = TERMOSTATO_EXTERNAL → external
    if (deviceType.includes('TERMOSTATO') && deviceProfile.includes('EXTERNAL')) {
      return 'termostato_external';
    }
    // deviceType = deviceProfile = TERMOSTATO → climatized
    if (
      deviceType.includes('TERMOSTATO') &&
      deviceProfile.includes('TERMOSTATO') &&
      !deviceProfile.includes('EXTERNAL')
    ) {
      return 'termostato'; // Climatized
    }
    // Default for temperature
    return 'termostato';
  }

  return 'equipments'; // Default
}

/**
 * Extract device metadata from a single row
 * Used by buildShoppingsList where we iterate row by row
 */
function extractDeviceMetadata(row) {
  const datasource = row?.datasource || {};

  const extractEntityId = (entityIdObj) => {
    if (!entityIdObj) return null;
    if (typeof entityIdObj === 'string') return entityIdObj;
    return entityIdObj.id || null;
  };

  const entityId =
    extractEntityId(datasource.entity?.id) ||
    extractEntityId(datasource.entityId) ||
    datasource.entity?.id?.id ||
    null;

  const deviceName = datasource.entityName || datasource.entity?.name || 'Unknown';

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
            title: device.customerName || 'Shopping',
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
  ['energy', 'water', 'temperature'].forEach((domain) => {
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
  const customerMap = new Map();

  data.forEach((row) => {
    const device = extractDeviceMetadata(row);
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

function calculateDeviceCounts(classified) {
  let total = 0;
  let energyTotal = 0;
  let waterTotal = 0;
  let tempTotal = 0;
  let tempSum = 0;
  let tempCount = 0;

  Object.entries(classified).forEach(([domain, contexts]) => {
    Object.values(contexts).forEach((devices) => {
      total += devices.length;
      devices.forEach((device) => {
        if (domain === 'energy') {
          energyTotal += device.consumption || 0;
        } else if (domain === 'water') {
          waterTotal += device.pulses || 0;
        } else if (domain === 'temperature') {
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

self.onDestroy = function () {
  // Cleanup
};
