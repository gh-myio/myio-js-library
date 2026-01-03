// ===================================================================
// RFC-0111: MAIN_UNIQUE_DATASOURCE Controller
// Single Datasource Architecture - Head Office Dashboard
// ===================================================================

/* eslint-disable no-undef */
/* global self, window, document */

self.onInit = async function () {
  'use strict';

  // Debug helper function
  const logDebug = self.ctx.settings?.enableDebugMode
    ? (...args) => console.log('[MAIN_UNIQUE]', ...args)
    : () => {};

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

  // === 4. RFC-0112: OPEN WELCOME MODAL (LOADING STATE) ===
  const welcomeModal = MyIOLibrary.openWelcomeModal({
    ctx: self.ctx,
    themeMode: currentThemeMode,
    showThemeToggle: true,
    configTemplate: welcomeConfig,
    shoppingCards: [], // Empty initially - loading state
    ctaLabel: 'Aguarde...',
    ctaDisabled: true,
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
    const { shoppingCards, deviceCounts } = e.detail;

    // Update welcome modal with shopping cards
    if (welcomeModal && shoppingCards) {
      welcomeModal.updateShoppingCards?.(shoppingCards);
      welcomeModal.setCtaLabel?.('ACESSAR PAINEL');
      welcomeModal.setCtaDisabled?.(false);
    }

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
// ===================================================================
self.onDataUpdated = function () {
  const data = self.ctx.data || [];

  // Skip if no data
  if (data.length === 0) {
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

  // Classify all devices from single datasource
  const classified = classifyAllDevices(data);

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
function classifyAllDevices(data) {
  const classified = {
    energy: { equipments: [], stores: [] },
    water: { hidrometro_area_comum: [], hidrometro: [] },
    temperature: { termostato: [], termostato_external: [] },
  };

  data.forEach((row) => {
    const device = extractDeviceMetadata(row);
    const domain = detectDomain(device);
    const context = detectContext(device, domain);

    if (classified[domain]?.[context]) {
      classified[domain][context].push(device);
    }
  });

  // Cache for getDevices
  window.MyIOOrchestratorData = { classified, timestamp: Date.now() };

  return classified;
}

function extractDeviceMetadata(row) {
  // Extract device info from ThingsBoard data row
  const datasource = row.datasource || {};
  return {
    id: datasource.entityId || row.entityId,
    name: datasource.entityName || datasource.name || 'Unknown',
    aliasName: datasource.aliasName || '',
    deviceType: findDataValue(row, 'deviceType') || datasource.entityType,
    deviceProfile: findDataValue(row, 'deviceProfile') || '',
    ingestionId: findDataValue(row, 'ingestionId') || '',
    customerId: findDataValue(row, 'customerId') || '',
    customerName: findDataValue(row, 'customerName') || findDataValue(row, 'ownerName') || '',
    lastActivityTime: findDataValue(row, 'lastActivityTime'),
    lastConnectTime: findDataValue(row, 'lastConnectTime'),
    lastDisconnectTime: findDataValue(row, 'lastDisconnectTime'),
    // Domain-specific values
    consumption: findDataValue(row, 'consumption'),
    pulses: findDataValue(row, 'pulses'),
    temperature: findDataValue(row, 'temperature'),
    water_level: findDataValue(row, 'water_level'),
  };
}

function findDataValue(row, key) {
  if (!row.data) return null;
  for (const d of row.data) {
    if (d.dataKey?.name === key || d.dataKey?.label === key) {
      return d.data?.[0]?.[1];
    }
  }
  return null;
}

function detectDomain(device) {
  const aliasName = (device.aliasName || '').toLowerCase();
  const deviceType = (device.deviceType || '').toLowerCase();
  const deviceProfile = (device.deviceProfile || '').toLowerCase();

  // Water detection
  if (
    aliasName.includes('hidro') ||
    aliasName.includes('water') ||
    deviceType.includes('hidro') ||
    deviceProfile.includes('hidro')
  ) {
    return 'water';
  }

  // Temperature detection
  if (
    aliasName.includes('temp') ||
    aliasName.includes('sensor') ||
    deviceType.includes('termo') ||
    deviceProfile.includes('termo') ||
    deviceType.includes('clima')
  ) {
    return 'temperature';
  }

  // Default: Energy
  return 'energy';
}

function detectContext(device, domain) {
  const aliasName = (device.aliasName || '').toLowerCase();
  const deviceType = (device.deviceType || '').toUpperCase();
  const deviceProfile = (device.deviceProfile || '').toUpperCase();

  if (domain === 'energy') {
    // Check if store device (3F_MEDIDOR)
    if (deviceProfile === '3F_MEDIDOR' || deviceType === '3F_MEDIDOR') {
      return 'stores';
    }
    return 'equipments';
  }

  if (domain === 'water') {
    // Check alias for common area vs stores
    if (aliasName.includes('comum') || aliasName.includes('common')) {
      return 'hidrometro_area_comum';
    }
    return 'hidrometro';
  }

  if (domain === 'temperature') {
    // Check if climatized environment
    if (deviceType.includes('CLIMA') || deviceProfile.includes('CLIMA')) {
      return 'termostato';
    }
    return 'termostato_external';
  }

  return 'equipments'; // Default
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
