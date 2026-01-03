/* =========================================================================
 * ThingsBoard Widget: TELEMETRY - Unified Device Cards Widget
 * RFC-0110: Unified widget replacing EQUIPMENTS, STORES, WATER_COMMON_AREA, WATER_STORES
 *
 * Configuration via Settings:
 * - domain: 'energy' | 'water' | 'temperature'
 * - context: 'entry' | 'common_area' | 'stores'
 *
 * Color Themes:
 * - energy: Orange/Amber (#f59e0b)
 * - water: Blue/Cyan (#0ea5e9)
 * - temperature: Red/Rose (#f43f5e)
 * =========================================================================*/

/* global self, window, document, localStorage, MyIOLibrary, requestAnimationFrame, $ */

// ============================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log('[TELEMETRY]', ...args),
  warn: (...args) => console.warn('[TELEMETRY]', ...args),
  error: (...args) => console.error('[TELEMETRY]', ...args),
};

const getDataApiHost = () => {
  const host = window.MyIOUtils?.DATA_API_HOST;
  if (!host) {
    LogHelper.error('DATA_API_HOST not available - MAIN widget not loaded');
  }
  return host || '';
};

// RFC-0110: Centralized functions from MAIN
const calculateDeviceStatusMasterRules =
  window.MyIOUtils?.calculateDeviceStatusMasterRules || (() => 'no_info');

const mapConnectionStatus = window.MyIOUtils?.mapConnectionStatus || ((status) => status || 'offline');

const getConsumptionRangesHierarchical = window.MyIOUtils?.getConsumptionRangesHierarchical;

const getCachedConsumptionLimits = window.MyIOUtils?.getCachedConsumptionLimits;

const formatRelativeTime =
  window.MyIOUtils?.formatRelativeTime || ((ts) => (ts ? new Date(ts).toLocaleString() : '—'));

const formatarDuracao = window.MyIOUtils?.formatarDuracao || ((ms) => `${Math.round(ms / 1000)}s`);

const getCustomerNameForDevice =
  window.MyIOUtils?.getCustomerNameForDevice || ((device) => device.customerId || 'N/A');

const findValue =
  window.MyIOUtils?.findValue ||
  ((values, key, defaultValue = null) => {
    if (!Array.isArray(values)) return defaultValue;
    const found = values.find((v) => v.key === key || v.dataType === key);
    return found ? found.value : defaultValue;
  });

const fetchCustomerServerScopeAttrs =
  window.MyIOUtils?.fetchCustomerServerScopeAttrs ||
  (() => {
    LogHelper.error('fetchCustomerServerScopeAttrs not available - MAIN widget not loaded');
    return {};
  });

// ============================================
// DOMAIN CONFIGURATION
// Defines behavior and formatting per domain
// ============================================
const DOMAIN_CONFIG = {
  energy: {
    unit: 'kWh',
    unitInstant: 'kW',
    formatValue: (val) => {
      if (val == null || isNaN(val)) return '-';
      const num = Number(val);
      if (num >= 1000000) return `${(num / 1000000).toFixed(2)} GWh`;
      if (num >= 1000) return `${(num / 1000).toFixed(2)} MWh`;
      return `${num.toFixed(2)} kWh`;
    },
    formatInstant: (val) => {
      if (val == null || isNaN(val)) return '-';
      const num = Number(val);
      if (num >= 1000) return `${(num / 1000).toFixed(2)} MW`;
      return `${num.toFixed(2)} kW`;
    },
    telemetryTimestampField: 'consumptionTs',
    valueField: 'consumption_power',
    cacheKey: 'energy',
    eventReady: 'myio:energy-data-ready',
    loadingText: 'Carregando dados de energia...',
    headerLabel: 'Consumo Total',
    icon: 'energy',
    delayMins: 1440, // 24h for stale detection
  },
  water: {
    unit: 'm³',
    unitInstant: 'L',
    formatValue: (val) => {
      if (val == null || isNaN(val)) return '-';
      const num = Number(val);
      // Convert liters to m³ (1000L = 1m³)
      const m3 = num / 1000;
      if (m3 >= 1000) return `${(m3 / 1000).toFixed(2)} dam³`;
      return `${m3.toFixed(3)} m³`;
    },
    formatInstant: (val) => {
      if (val == null || isNaN(val)) return '-';
      return `${Number(val).toFixed(0)} L`;
    },
    telemetryTimestampField: 'pulsesTs',
    telemetryTimestampFieldAlt: 'waterVolumeTs',
    valueField: 'pulses',
    cacheKey: 'water',
    eventReady: 'myio:water-tb-data-ready',
    loadingText: 'Carregando dados de agua...',
    headerLabel: 'Volume Total',
    icon: 'water',
    delayMins: 1440,
  },
  temperature: {
    unit: '°C',
    unitInstant: '°C',
    formatValue: (val) => {
      if (val == null || isNaN(val)) return '-';
      return `${Number(val).toFixed(1)}°C`;
    },
    formatInstant: (val) => {
      if (val == null || isNaN(val)) return '-';
      return `${Number(val).toFixed(1)}°C`;
    },
    telemetryTimestampField: 'temperatureTs',
    valueField: 'temperature',
    cacheKey: 'temperature',
    eventReady: 'myio:temperature-data-ready',
    loadingText: 'Carregando dados de temperatura...',
    headerLabel: 'Temperatura Media',
    icon: 'temperature',
    delayMins: 60, // 1h for temperature sensors
  },
};

// ============================================
// CONTEXT CONFIGURATION
// RFC-0111: Simplified - only presentation properties
// Classification is done in MAIN_UNIQUE_DATASOURCE
// ============================================
const CONTEXT_CONFIG = {
  // === ENERGY CONTEXTS ===
  equipments: {
    headerLabel: 'Total de Equipamentos',
    idPrefix: 'equipments',
    widgetName: 'TELEMETRY_EQUIPMENTS',
    filterChipIcon: '⚡',
  },
  stores: {
    headerLabel: 'Total de Lojas',
    idPrefix: 'stores',
    widgetName: 'TELEMETRY_STORES',
    filterChipIcon: '🏪',
  },

  // === WATER CONTEXTS (RFC-0111) ===
  hidrometro_area_comum: {
    headerLabel: 'Total Area Comum',
    idPrefix: 'hidrometro_area_comum',
    widgetName: 'TELEMETRY_WATER_COMMON_AREA',
    filterChipIcon: '🏢',
  },
  hidrometro: {
    headerLabel: 'Total de Lojas',
    idPrefix: 'hidrometro',
    widgetName: 'TELEMETRY_WATER_STORES',
    filterChipIcon: '🏪',
  },

  // === TEMPERATURE CONTEXTS (RFC-0111) ===
  termostato: {
    headerLabel: 'Ambientes Climatizaveis',
    idPrefix: 'termostato',
    widgetName: 'TELEMETRY_TEMP_CLIMATIZED',
    filterChipIcon: '❄️',
  },
  termostato_external: {
    headerLabel: 'Ambientes Nao Climatizaveis',
    idPrefix: 'termostato_external',
    widgetName: 'TELEMETRY_TEMP_NOT_CLIMATIZED',
    filterChipIcon: '🌡️',
  },

  // === LEGACY CONTEXTS (for backward compatibility) ===
  entry: {
    headerLabel: 'Total de Equipamentos',
    idPrefix: 'entry',
    widgetName: 'TELEMETRY_ENTRY',
    filterChipIcon: '⚙️',
  },
  common_area: {
    headerLabel: 'Total Area Comum',
    idPrefix: 'common',
    widgetName: 'TELEMETRY_COMMON_AREA',
    filterChipIcon: '🏢',
  },
  head_office: {
    headerLabel: 'Total Sede/Matriz',
    idPrefix: 'head_office',
    widgetName: 'TELEMETRY_HEAD_OFFICE',
    filterChipIcon: '🏬',
  },
  with_climate_control: {
    headerLabel: 'Sensores c/ Climatizacao',
    idPrefix: 'temp_climate',
    widgetName: 'TELEMETRY_TEMP_WITH_CLIMATE',
    filterChipIcon: '❄️',
  },
  without_climate_control: {
    headerLabel: 'Sensores s/ Climatizacao',
    idPrefix: 'temp_no_climate',
    widgetName: 'TELEMETRY_TEMP_WITHOUT_CLIMATE',
    filterChipIcon: '🌡️',
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * RFC-0111: Map legacy context names to orchestrator context names
 * The classification logic is in MAIN_UNIQUE_DATASOURCE.
 * TELEMETRY just uses pre-classified data from the orchestrator.
 */
function mapContextToOrchestrator(context, domain) {
  const contextMap = {
    // Energy legacy contexts
    head_office: 'equipments',
    entry: 'equipments',
    common_area: 'equipments',
    // Water legacy contexts
    water_common_area: 'hidrometro_area_comum',
    water_stores: 'hidrometro',
    // Temperature legacy contexts
    with_climate_control: 'termostato',
    without_climate_control: 'termostato_external',
  };
  return contextMap[context] || context;
}

/**
 * Get telemetry timestamp based on domain configuration
 */
function getTelemetryTimestamp(device, domainConfig) {
  const primaryField = domainConfig.telemetryTimestampField;
  const altField = domainConfig.telemetryTimestampFieldAlt;

  let timestamp = device[primaryField] || null;
  if (!timestamp && altField) {
    timestamp = device[altField] || null;
  }
  return timestamp;
}

/**
 * Apply domain color theme to widget wrapper
 */
function applyDomainTheme(domain) {
  const wrapper = document.getElementById('telemetryWrap');
  if (wrapper) {
    wrapper.setAttribute('data-domain', domain);
    LogHelper.log(`Applied ${domain} theme`);
  }
}

/**
 * Apply context attribute to widget wrapper
 */
function applyContextAttribute(context) {
  const wrapper = document.getElementById('telemetryWrap');
  if (wrapper) {
    wrapper.setAttribute('data-context', context);
    LogHelper.log(`Applied ${context} context`);
  }
}

/**
 * Apply light/dark theme mode to widget wrapper
 */
function applyThemeMode(themeMode) {
  const wrapper = document.getElementById('telemetryWrap');
  if (wrapper) {
    wrapper.setAttribute('data-theme', themeMode);
    LogHelper.log(`Applied ${themeMode} theme mode`);
  }
}

// ============================================
// WIDGET STATE
// ============================================
let WIDGET_DOMAIN = 'energy';
let WIDGET_CONTEXT = 'stores';
let CUSTOMER_ID;
let CLIENT_ID;
let CLIENT_SECRET;
let MAP_INSTANTANEOUS_POWER;
let myIOAuth;
let activeCardComponents = [];
let telemetryHeaderController = null;

// Card rendering options (from settings, with defaults)
let USE_NEW_COMPONENTS = true;
let ENABLE_SELECTION = true;
let ENABLE_DRAG_DROP = true;
let HIDE_INFO_MENU_ITEM = true;
let DEBUG_ACTIVE = false;
let ACTIVE_TOOLTIP_DEBUG = false;

// Global state for filters
const STATE = {
  allDevices: [],
  searchActive: false,
  searchTerm: '',
  selectedIds: null,
  sortMode: 'cons_desc',
  selectedShoppingIds: [],
  totalShoppings: 0,
};

// ============================================
// LOADING OVERLAY
// ============================================
function showLoadingOverlay(show, message) {
  const overlay = document.getElementById('telemetry-loading-overlay');
  const textEl = document.getElementById('telemetry-loading-text');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
    if (textEl && message) {
      textEl.textContent = message;
    }
  }
}

// ============================================
// FILTER DEVICES BY DOMAIN AND CONTEXT
// RFC-0111: Simplified - data comes pre-classified from MAIN_UNIQUE_DATASOURCE
// ============================================
function filterDevicesByConfig(devices) {
  const contextConfig = CONTEXT_CONFIG[WIDGET_CONTEXT];

  if (!contextConfig) {
    LogHelper.warn(`Unknown context: ${WIDGET_CONTEXT}`);
  }

  // RFC-0111: Data comes pre-classified from MAIN_UNIQUE_DATASOURCE orchestrator
  // No filtering needed in TELEMETRY
  return devices;
}

// ============================================
// CALCULATE DEVICE STATUS (RFC-0110)
// ============================================
function calculateDeviceStatus(device) {
  const domainConfig = DOMAIN_CONFIG[WIDGET_DOMAIN];
  const telemetryTs = getTelemetryTimestamp(device, domainConfig);

  // Use centralized RFC-0110 function from MAIN
  return calculateDeviceStatusMasterRules({
    connectionStatus: device.connectionStatus,
    telemetryTimestamp: telemetryTs,
    delayMins: domainConfig.delayMins,
    domain: WIDGET_DOMAIN,
  });
}

// ============================================
// INITIALIZE CARDS
// ============================================
function initializeCards(devices) {
  // Cleanup old card instances
  if (Array.isArray(activeCardComponents)) {
    activeCardComponents.forEach((comp) => {
      if (comp && typeof comp.destroy === 'function') {
        comp.destroy();
      }
    });
    activeCardComponents = [];
  }

  const grid = document.getElementById('cards-grid');
  if (!grid) {
    LogHelper.error('Cards grid container not found');
    return;
  }
  grid.innerHTML = '';

  const domainConfig = DOMAIN_CONFIG[WIDGET_DOMAIN];
  const delayTimeConnectionInMins =
    window.MyIOUtils?.getDelayTimeConnectionInMins?.() || domainConfig.delayMins;

  devices.forEach((device) => {
    const container = document.createElement('div');
    grid.appendChild(container);

    // Ensure deviceStatus exists
    if (!device.deviceStatus) {
      device.deviceStatus = calculateDeviceStatus(device);
    }

    const customerName = getCustomerNameForDevice(device);
    device.customerName = customerName;
    device.domain = WIDGET_DOMAIN;

    const cardInstance = MyIOLibrary.renderCardComponentHeadOffice(container, {
      entityObject: device,
      debugActive: DEBUG_ACTIVE,
      activeTooltipDebug: ACTIVE_TOOLTIP_DEBUG,
      delayTimeConnectionInMins,

      isSelected: (() => {
        const store = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
        return store ? store.getSelectedIds().includes(device.entityId) : false;
      })(),

      handleActionDashboard: async () => {
        LogHelper.log('Opening dashboard for:', device.entityId);
        try {
          if (!myIOAuth || typeof myIOAuth.getToken !== 'function') {
            LogHelper.error('myIOAuth not available');
            window.alert('Autenticacao nao disponivel. Recarregue a pagina.');
            return;
          }

          const tokenIngestion = await myIOAuth.getToken();
          const tbToken = localStorage.getItem('jwt_token');

          if (!tbToken) {
            throw new Error('JWT token nao encontrado');
          }

          // Domain-specific dashboard popup
          if (WIDGET_DOMAIN === 'energy') {
            MyIOLibrary.openDashboardPopupEnergy({
              deviceId: device.entityId,
              readingType: 'energy',
              startDate: self.ctx.$scope.startDateISO,
              endDate: self.ctx.$scope.endDateISO,
              tbJwtToken: tbToken,
              ingestionToken: tokenIngestion,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
            });
          } else if (WIDGET_DOMAIN === 'water') {
            MyIOLibrary.openDashboardPopupWater?.({
              deviceId: device.entityId,
              startDate: self.ctx.$scope.startDateISO,
              endDate: self.ctx.$scope.endDateISO,
              tbJwtToken: tbToken,
              ingestionToken: tokenIngestion,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
            });
          } else if (WIDGET_DOMAIN === 'temperature') {
            MyIOLibrary.openDashboardPopupTemperature?.({
              deviceId: device.entityId,
              tbJwtToken: tbToken,
            });
          }
        } catch (err) {
          LogHelper.error('Error opening dashboard:', err);
          window.alert('Erro ao abrir dashboard.');
        }
      },

      handleActionReport: async () => {
        try {
          if (!myIOAuth || typeof myIOAuth.getToken !== 'function') {
            LogHelper.error('myIOAuth not available for report');
            window.alert('Autenticacao nao disponivel.');
            return;
          }
          const ingestionToken = await myIOAuth.getToken();
          if (!ingestionToken) throw new Error('No ingestion token');

          await MyIOLibrary.openDashboardPopupReport({
            ingestionId: device.ingestionId,
            identifier: device.deviceIdentifier,
            label: device.labelOrName,
            domain: WIDGET_DOMAIN,
            api: {
              dataApiBaseUrl: getDataApiHost(),
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              ingestionToken,
            },
          });
        } catch (err) {
          LogHelper.warn('Report open blocked:', err?.message || err);
          window.alert('Erro ao abrir relatorio.');
        }
      },

      handleActionSettings: async () => {
        const jwt = localStorage.getItem('jwt_token');
        if (!jwt) {
          LogHelper.error('JWT token not found');
          window.alert('Token nao encontrado');
          return;
        }

        try {
          await MyIOLibrary.openDashboardPopupSettings({
            deviceId: device.entityId,
            label: device.labelOrName,
            jwtToken: jwt,
            domain: WIDGET_DOMAIN,
            deviceType: device.deviceType,
            deviceProfile: device.deviceProfile,
            customerName: device.customerName,
            connectionData: {
              centralName: device.centralName || customerName,
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
              LogHelper.log('Settings saved:', payload);
            },
            onClose: () => {
              $('.myio-settings-modal-overlay').remove();
              const overlay = document.querySelector('.myio-modal-overlay');
              if (overlay) overlay.remove();
              LogHelper.log('Settings modal closed');
            },
          });
        } catch (e) {
          LogHelper.error('Error opening settings:', e);
          window.alert('Erro ao abrir configuracoes');
        }
      },

      handleSelect: (checked, entity) => {
        const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
        if (MyIOSelectionStore) {
          if (checked) {
            if (MyIOSelectionStore.registerEntity) {
              MyIOSelectionStore.registerEntity(entity);
            }
            MyIOSelectionStore.add(entity.entityId || entity.id);
          } else {
            MyIOSelectionStore.remove(entity.entityId || entity.id);
          }
        }
      },

      handleClickCard: (ev, entity) => {
        LogHelper.log(`Card clicked: ${entity.labelOrName}`);
      },

      useNewComponents: USE_NEW_COMPONENTS,
      enableSelection: ENABLE_SELECTION,
      enableDragDrop: ENABLE_DRAG_DROP,
      hideInfoMenuItem: HIDE_INFO_MENU_ITEM,
    });

    activeCardComponents.push(cardInstance);
  });

  LogHelper.log(`Cards initialized: ${devices.length} ${WIDGET_DOMAIN} devices (${WIDGET_CONTEXT} context)`);
}

// ============================================
// REFLOW CARDS (filter/sort/search)
// ============================================
function reflowCards() {
  let filtered = STATE.allDevices.slice();

  // Apply search filter
  if (STATE.searchTerm) {
    const term = STATE.searchTerm.toLowerCase();
    filtered = filtered.filter(
      (d) =>
        (d.labelOrName || '').toLowerCase().includes(term) ||
        (d.deviceIdentifier || '').toLowerCase().includes(term)
    );
  }

  // Apply shopping filter
  if (STATE.selectedShoppingIds.length > 0) {
    filtered = filtered.filter((d) => STATE.selectedShoppingIds.includes(d.customerId));
  }

  // Apply selected IDs filter
  if (STATE.selectedIds && STATE.selectedIds.size > 0) {
    filtered = filtered.filter((d) => STATE.selectedIds.has(d.entityId));
  }

  // Apply sort
  filtered.sort((a, b) => {
    switch (STATE.sortMode) {
      case 'cons_desc':
        return (b.val || 0) - (a.val || 0);
      case 'cons_asc':
        return (a.val || 0) - (b.val || 0);
      case 'alpha_asc':
        return (a.labelOrName || '').localeCompare(b.labelOrName || '');
      case 'alpha_desc':
        return (b.labelOrName || '').localeCompare(a.labelOrName || '');
      default:
        return 0;
    }
  });

  initializeCards(filtered);

  // Update header
  if (telemetryHeaderController) {
    telemetryHeaderController.updateFromDevices(filtered, {});
  }
}

// ============================================
// FILTER MODAL
// ============================================
let telemetryFilterModal = null;

function initFilterModal() {
  const createFilterModal = window.MyIOUtils?.createFilterModal;
  if (!createFilterModal) {
    LogHelper.error('createFilterModal not available from MAIN');
    return null;
  }

  const contextConfig = CONTEXT_CONFIG[WIDGET_CONTEXT];
  const domainConfig = DOMAIN_CONFIG[WIDGET_DOMAIN];

  return createFilterModal({
    widgetName: contextConfig.widgetName,
    containerId: `${contextConfig.idPrefix}FilterModalGlobal`,
    modalClass: 'telemetry-modal',
    primaryColor: getCSSVariableValue('--telemetry-primary') || '#f59e0b',
    itemIdAttr: 'data-device-id',
    getItems: () => STATE.allDevices,
    getItemStatus: (item) => item.deviceStatus || calculateDeviceStatus(item),
    filterTabs: [
      { id: 'all', label: 'Todos', filter: () => true },
      { id: 'online', label: 'Online', filter: (d) => d.deviceStatus === 'power_on' },
      { id: 'offline', label: 'Offline', filter: (d) => d.deviceStatus === 'offline' },
      { id: 'notInstalled', label: 'Nao Instalado', filter: (d) => d.deviceStatus === 'not_installed' },
    ],
    sortOptions: [
      { id: 'cons_desc', label: `${domainConfig.headerLabel} (maior)`, icon: '↓' },
      { id: 'cons_asc', label: `${domainConfig.headerLabel} (menor)`, icon: '↑' },
      { id: 'alpha_asc', label: 'Nome (A-Z)', icon: 'A' },
      { id: 'alpha_desc', label: 'Nome (Z-A)', icon: 'Z' },
    ],
    onFilterChange: (selectedIds) => {
      STATE.selectedIds = selectedIds;
      reflowCards();
    },
    onSortChange: (sortMode) => {
      STATE.sortMode = sortMode;
      reflowCards();
    },
  });
}

function openFilterModal() {
  if (!telemetryFilterModal) {
    telemetryFilterModal = initFilterModal();
  }
  if (telemetryFilterModal) {
    // Recalculate device status before opening modal
    STATE.allDevices.forEach((device) => {
      device.deviceStatus = calculateDeviceStatus(device);
    });
    telemetryFilterModal.open(STATE.allDevices);
  }
}

function getCSSVariableValue(varName) {
  try {
    const wrapper = document.getElementById('telemetryWrap');
    if (wrapper && window.getComputedStyle) {
      return window.getComputedStyle(wrapper).getPropertyValue(varName).trim();
    }
  } catch (e) {
    LogHelper.warn('getCSSVariableValue error:', e);
  }
  return null;
}

// ============================================
// SHOPPING FILTER CHIPS
// ============================================
function renderShoppingFilterChips(selection) {
  const chipsContainer = document.getElementById('shoppingFilterChips');
  if (!chipsContainer) return;

  chipsContainer.innerHTML = '';

  if (!selection || selection.length === 0) {
    return;
  }

  const contextConfig = CONTEXT_CONFIG[WIDGET_CONTEXT];

  selection.forEach((shopping) => {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.innerHTML = `<span class="filter-chip-icon">${contextConfig.filterChipIcon}</span><span>${shopping.name}</span>`;
    chipsContainer.appendChild(chip);
  });

  LogHelper.log('Rendered', selection.length, 'shopping filter chips');
}

// ============================================
// PROCESS DEVICES FROM ORCHESTRATOR/CACHE
// ============================================
async function processAndRenderDevices(cache) {
  const domainConfig = DOMAIN_CONFIG[WIDGET_DOMAIN];
  const contextConfig = CONTEXT_CONFIG[WIDGET_CONTEXT];

  if (!cache || cache.size === 0) {
    LogHelper.warn('Cache is empty. No cards will be rendered.');
    showLoadingOverlay(false);
    return;
  }

  // Transform cache to devices array
  const allDevices = [];
  cache.forEach((item, ingestionId) => {
    // Calculate device status using RFC-0110
    const telemetryTs = getTelemetryTimestamp(item, domainConfig);
    const deviceStatus = calculateDeviceStatusMasterRules({
      connectionStatus: item.connectionStatus || 'offline',
      telemetryTimestamp: telemetryTs,
      delayMins: domainConfig.delayMins,
      domain: WIDGET_DOMAIN,
    });

    // Clear value if device is offline
    const isOfflineDevice = ['offline', 'no_info', 'not_installed'].includes(deviceStatus);
    const displayValue = isOfflineDevice ? null : item.value ?? item.total_value ?? 0;

    // RFC-0115: Calculate operationHours from lastConnectTime (same as EQUIPMENTS)
    const lastConnectTimestamp = item.lastConnectTime || item.lastActivityTime || null;
    let operationHoursFormatted = '-';
    if (lastConnectTimestamp && !isOfflineDevice) {
      const nowMs = Date.now();
      const durationMs = nowMs - lastConnectTimestamp;
      operationHoursFormatted = formatarDuracao(durationMs > 0 ? durationMs : 0);
    }

    // RFC-0115: Get instantaneousPower for energy cards (same as EQUIPMENTS)
    let instantaneousPower = item.consumptionPower ?? item.consumption ?? item.value ?? null;
    if (isOfflineDevice) {
      instantaneousPower = null; // Clear for offline devices
    }

    allDevices.push({
      entityId: item.tbId || item.entityId || ingestionId,
      ingestionId: ingestionId,
      labelOrName: item.label || item.name || 'Unknown',
      deviceIdentifier: item.identifier || 'Sem identificador',
      val: displayValue,
      deviceType: item.deviceType || '',
      deviceProfile: item.deviceProfile || '',
      deviceStatus: deviceStatus,
      connectionStatus: item.connectionStatus || 'offline',
      customerId: item.customerId || null,
      centralName: item.centralName || null,
      ownerName: item.ownerName || null,
      lastConnectTime: lastConnectTimestamp,
      lastActivityTime: item.lastActivityTime || null,
      lastDisconnectTime: item.lastDisconnectTime || null,
      aliasName: item.aliasName || '',
      domain: WIDGET_DOMAIN,
      // Timestamps for RFC-0110
      consumptionTs: item.consumptionTs || null,
      pulsesTs: item.pulsesTs || null,
      waterVolumeTs: item.waterVolumeTs || null,
      temperatureTs: item.temperatureTs || null,
      // RFC-0115: Footer metrics - operationHours and instantaneousPower
      operationHours: operationHoursFormatted,
      instantaneousPower: instantaneousPower,
      consumption_power: instantaneousPower, // Alias for card component
      pulses: item.pulses ?? 0, // For water domain
      mapInstantaneousPower: item.deviceMapInstantaneousPower || item.deviceMapInstaneousPower || '',
    });
  });

  LogHelper.log(`Total devices from cache: ${allDevices.length}`);

  // Filter by domain and context
  const filteredDevices = filterDevicesByConfig(allDevices);
  LogHelper.log(`Filtered devices (${WIDGET_DOMAIN}/${WIDGET_CONTEXT}): ${filteredDevices.length}`);

  // Save to state and render
  STATE.allDevices = filteredDevices;
  initializeCards(filteredDevices);

  // Update header
  if (telemetryHeaderController) {
    telemetryHeaderController.updateFromDevices(filteredDevices, { cache });
  }

  // Debug: Log status distribution
  const statusCounts = {};
  filteredDevices.forEach((d) => {
    const status = d.deviceStatus || 'undefined';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  LogHelper.log('RFC-0110 deviceStatus distribution:', JSON.stringify(statusCounts));

  showLoadingOverlay(false);
}

// ============================================
// WAIT FOR ORCHESTRATOR
// ============================================
async function waitForOrchestrator(timeoutMs = 15000) {
  return new Promise((resolve) => {
    let interval;
    const timeout = setTimeout(() => {
      clearInterval(interval);
      LogHelper.error('Timeout: MyIOOrchestrator not found');
      resolve(null);
    }, timeoutMs);

    interval = setInterval(() => {
      const orchestrator = window.MyIOOrchestrator;
      if (orchestrator) {
        clearTimeout(timeout);
        clearInterval(interval);
        LogHelper.log('MyIOOrchestrator found!');
        resolve(orchestrator);
      }
    }, 100);
  });
}

// ============================================
// WAIT FOR DATE PARAMS
// ============================================
function waitForDateParams({ pollMs = 300, timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    let poller = null;
    let timer = null;

    const tryResolve = (p) => {
      const s = p?.globalStartDateFilter || null;
      const e = p?.globalEndDateFilter || null;
      if (s && e) {
        resolved = true;
        cleanup();
        self.ctx.$scope.startDateISO = s;
        self.ctx.$scope.endDateISO = e;
        if (self.ctx?.$scope?.$applyAsync) self.ctx.$scope.$applyAsync();
        resolve({ start: s, end: e, from: 'state/event' });
        return true;
      }
      return false;
    };

    const onEvt = (ev) => {
      tryResolve(ev.detail);
    };

    const cleanup = () => {
      window.removeEventListener('myio:date-params', onEvt);
      if (poller) clearInterval(poller);
      if (timer) clearTimeout(timer);
    };

    window.addEventListener('myio:date-params', onEvt);
    if (tryResolve(window.myioStateParams || {})) return;
    window.dispatchEvent(new CustomEvent('myio:request-date-params'));

    poller = setInterval(() => {
      tryResolve(window.myioStateParams || {});
    }, pollMs);

    timer = setTimeout(() => {
      if (!resolved) {
        cleanup();
        const end = new Date();
        const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startISO = start.toISOString();
        const endISO = end.toISOString();
        self.ctx.$scope.startDateISO = startISO;
        self.ctx.$scope.endDateISO = endISO;
        if (self.ctx?.$scope?.$applyAsync) self.ctx.$scope.$applyAsync();
        resolve({ start: startISO, end: endISO, from: 'fallback-7d' });
      }
    }, timeoutMs);
  });
}

// ============================================
// onInit - WIDGET INITIALIZATION
// ============================================
self.onInit = async function () {
  const widgetId = `TELEMETRY_${Date.now()}`;
  if (window[`__${widgetId}_INITIALIZED__`]) {
    LogHelper.log('onInit - already initialized, skipping');
    return;
  }
  window[`__${widgetId}_INITIALIZED__`] = true;

  LogHelper.log('onInit - starting...');

  // Load settings
  WIDGET_DOMAIN = self.ctx.settings?.domain || 'energy';
  WIDGET_CONTEXT = self.ctx.settings?.context || 'stores';
  USE_NEW_COMPONENTS = self.ctx.settings?.useNewComponents ?? true;
  ENABLE_SELECTION = self.ctx.settings?.enableSelection ?? true;
  ENABLE_DRAG_DROP = self.ctx.settings?.enableDragDrop ?? true;
  HIDE_INFO_MENU_ITEM = self.ctx.settings?.hideInfoMenuItem ?? true;
  DEBUG_ACTIVE = self.ctx.settings?.debugActive ?? false;
  ACTIVE_TOOLTIP_DEBUG = self.ctx.settings?.activeTooltipDebug ?? false;

  LogHelper.log(`Configuration: domain=${WIDGET_DOMAIN}, context=${WIDGET_CONTEXT}`);

  const domainConfig = DOMAIN_CONFIG[WIDGET_DOMAIN];
  const contextConfig = CONTEXT_CONFIG[WIDGET_CONTEXT];

  if (!domainConfig || !contextConfig) {
    LogHelper.error(`Invalid configuration: domain=${WIDGET_DOMAIN}, context=${WIDGET_CONTEXT}`);
    return;
  }

  // Apply theme and context
  applyDomainTheme(WIDGET_DOMAIN);
  applyContextAttribute(WIDGET_CONTEXT);

  // Build header via buildHeaderDevicesGrid
  const buildHeaderDevicesGrid = window.MyIOUtils?.buildHeaderDevicesGrid;
  if (buildHeaderDevicesGrid) {
    telemetryHeaderController = buildHeaderDevicesGrid({
      container: '#telemetryHeaderContainer',
      domain: WIDGET_DOMAIN,
      idPrefix: contextConfig.idPrefix,
      labels: {
        total: contextConfig.headerLabel,
        consumption: `${domainConfig.headerLabel} ${contextConfig.headerLabel}`,
      },
      includeSearch: true,
      includeFilter: true,
      onSearchClick: () => {
        STATE.searchActive = !STATE.searchActive;
        if (STATE.searchActive) {
          const input = telemetryHeaderController?.getSearchInput();
          if (input) setTimeout(() => input.focus(), 100);
        }
      },
      onFilterClick: () => {
        openFilterModal();
      },
    });

    // Setup search input listener
    const searchInput = telemetryHeaderController?.getSearchInput();
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        STATE.searchTerm = e.target.value || '';
        reflowCards();
      });
    }

    LogHelper.log('Header built via buildHeaderDevicesGrid');
  } else {
    LogHelper.warn('buildHeaderDevicesGrid not available');
  }

  // Show loading overlay
  showLoadingOverlay(true, domainConfig.loadingText);

  setTimeout(async () => {
    // Wait for date params
    const datesFromParent = await waitForDateParams();
    LogHelper.log('Date params ready:', datesFromParent);

    // Get credentials from MAIN
    const mainCredentials = window.MyIOUtils?.getCredentials?.() || {};
    CUSTOMER_ID = mainCredentials.customerId || window.myioHoldingCustomerId || '';
    const CUSTOMER_TB_ID = window.MyIOOrchestrator?.customerTB_ID || window.MyIOUtils?.customerTB_ID || '';

    if (mainCredentials.clientId && mainCredentials.clientSecret) {
      CLIENT_ID = mainCredentials.clientId;
      CLIENT_SECRET = mainCredentials.clientSecret;
      LogHelper.log('Using credentials from MAIN');

      const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_TB_ID);
      MAP_INSTANTANEOUS_POWER = customerCredentials.mapInstantaneousPower;
    } else {
      LogHelper.log('MAIN credentials not available, fetching directly...');
      const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_TB_ID);
      CLIENT_ID = customerCredentials.client_id || '';
      CLIENT_SECRET = customerCredentials.client_secret || '';
      MAP_INSTANTANEOUS_POWER = customerCredentials.mapInstantaneousPower;
    }

    // Initialize MyIO Auth
    if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.buildMyioIngestionAuth) {
      myIOAuth = MyIOLibrary.buildMyioIngestionAuth({
        dataApiHost: getDataApiHost(),
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
      });
      LogHelper.log('MyIO Auth initialized');
    } else {
      LogHelper.error('MyIOLibrary not available');
    }

    // Wait for orchestrator and get pre-classified devices
    const orchestrator = await waitForOrchestrator();

    if (orchestrator) {
      // RFC-0111: Use getDevices to get pre-classified data from MAIN_UNIQUE_DATASOURCE
      const mappedContext = mapContextToOrchestrator(WIDGET_CONTEXT, WIDGET_DOMAIN);
      const devices = orchestrator.getDevices?.(WIDGET_DOMAIN, mappedContext) || [];

      LogHelper.log(`Total devices from cache: ${window.MyIOOrchestratorData?.classified?.[WIDGET_DOMAIN]?.[mappedContext]?.length || 0}`);
      LogHelper.log(`Filtered devices (${WIDGET_DOMAIN}/${mappedContext}): ${devices.length}`);

      if (devices.length > 0) {
        LogHelper.log(`Using pre-classified devices: ${devices.length} items for ${WIDGET_DOMAIN}/${mappedContext}`);
        STATE.allDevices = devices;
        initializeCards(devices);
        showLoadingOverlay(false);
      } else {
        LogHelper.log(`No pre-classified devices found, waiting for ${domainConfig.eventReady} event...`);

        const waitForData = new Promise((resolve) => {
          const handlerTimeout = setTimeout(() => {
            LogHelper.warn('Timeout waiting for data event');
            resolve(null);
          }, 15000);

          // Listen for myio:data-ready from orchestrator
          const handler = (ev) => {
            clearTimeout(handlerTimeout);
            window.removeEventListener('myio:data-ready', handler);
            const newDevices = orchestrator.getDevices?.(WIDGET_DOMAIN, mappedContext) || [];
            resolve(newDevices);
          };
          window.addEventListener('myio:data-ready', handler);
        });

        const dataDevices = await waitForData;
        if (dataDevices && dataDevices.length > 0) {
          STATE.allDevices = dataDevices;
          initializeCards(dataDevices);
        }
        showLoadingOverlay(false);
      }
    } else {
      showLoadingOverlay(false);
    }

    // Listen for filter events from MENU
    self._onFilterApplied = (ev) => {
      LogHelper.log('Received myio:filter-applied:', ev.detail);
      const selection = ev.detail?.selection || [];
      const shoppingIds = selection.map((s) => s.value).filter((v) => v);
      STATE.selectedShoppingIds = shoppingIds;
      renderShoppingFilterChips(selection);
      reflowCards();
    };
    window.addEventListener('myio:filter-applied', self._onFilterApplied);

    // Listen for date params updates
    self._onDateParams = (ev) => {
      self.ctx.$scope.startDateISO = ev.detail?.globalStartDateFilter || null;
      self.ctx.$scope.endDateISO = ev.detail?.globalEndDateFilter || null;
      if (self.ctx?.$scope?.$applyAsync) self.ctx.$scope.$applyAsync();
      // Reload data with new dates if needed
    };
    window.addEventListener('myio:date-params', self._onDateParams);

    // RFC-0111: Listen for config changes from MENU component
    self._onTelemetryConfigChange = (ev) => {
      const { domain, context } = ev.detail || {};

      LogHelper.log('Received myio:telemetry-config-change:', domain, context);

      // Validate config
      if (!DOMAIN_CONFIG[domain]) {
        LogHelper.error('Invalid domain received:', domain);
        return;
      }
      if (!CONTEXT_CONFIG[context]) {
        LogHelper.error('Invalid context received:', context);
        return;
      }

      // Update widget configuration
      WIDGET_DOMAIN = domain;
      WIDGET_CONTEXT = context;

      // Apply visual theme
      applyDomainTheme(domain);
      applyContextAttribute(context);

      // Get devices from orchestrator
      const devices = window.MyIOOrchestrator?.getDevices?.(domain, context) || [];

      LogHelper.log('Got devices from orchestrator:', devices.length);

      // Update state and re-render
      STATE.allDevices = devices;

      // Re-initialize cards with new devices
      if (devices.length > 0) {
        initializeCards(devices);
      } else {
        LogHelper.warn(`No devices found for ${domain}/${context}`);
        // Clear cards if no devices
        STATE.allDevices = [];
        initializeCards([]);
      }

      // Update header stats
      if (telemetryHeaderController) {
        telemetryHeaderController.updateFromDevices(STATE.allDevices, {});
      }
    };
    window.addEventListener('myio:telemetry-config-change', self._onTelemetryConfigChange);

    LogHelper.log('RFC-0111: myio:telemetry-config-change listener registered');

    // Listen for theme changes from MAIN (dark/light mode)
    self._onThemeChange = (ev) => {
      const themeMode = ev.detail?.themeMode;
      if (themeMode) {
        LogHelper.log('Received myio:theme-change:', themeMode);
        applyThemeMode(themeMode);
      }
    };
    window.addEventListener('myio:theme-change', self._onThemeChange);
    LogHelper.log('myio:theme-change listener registered');

    // RFC-0115: Listen for API enrichment completion to refresh header with consumption values
    self._onDataEnriched = (ev) => {
      LogHelper.log('Received myio:data-enriched - refreshing devices and header');

      // Get updated devices from orchestrator
      const mappedContext = mapContextToOrchestrator(WIDGET_CONTEXT, WIDGET_DOMAIN);
      const newDevices = window.MyIOOrchestrator?.getDevices?.(WIDGET_DOMAIN, mappedContext) || [];

      if (newDevices.length > 0) {
        // Re-process and render with updated consumption values
        STATE.allDevices = newDevices.map((device) => {
          // Ensure val is set from API enriched value
          const val = device.val ?? device.value ?? device.consumption ?? 0;
          const isOffline = ['offline', 'no_info', 'not_installed'].includes(device.deviceStatus);

          // Calculate operationHours
          const lastConnectTimestamp = device.lastConnectTime || device.lastActivityTime || null;
          let operationHoursFormatted = '-';
          if (lastConnectTimestamp && !isOffline) {
            const nowMs = Date.now();
            const durationMs = nowMs - lastConnectTimestamp;
            operationHoursFormatted = formatarDuracao(durationMs > 0 ? durationMs : 0);
          }

          return {
            ...device,
            val: isOffline ? null : val,
            operationHours: operationHoursFormatted,
            instantaneousPower: isOffline ? null : (device.consumptionPower ?? device.consumption ?? device.value ?? null),
            consumption_power: isOffline ? null : (device.consumptionPower ?? device.consumption ?? device.value ?? null),
            pulses: device.pulses ?? 0,
            domain: WIDGET_DOMAIN,
          };
        });

        // Re-render cards
        initializeCards(STATE.allDevices);

        // Update header with new consumption values
        if (telemetryHeaderController) {
          telemetryHeaderController.updateFromDevices(STATE.allDevices, {});
        }
      }
    };
    window.addEventListener('myio:data-enriched', self._onDataEnriched);
    LogHelper.log('myio:data-enriched listener registered');
  }, 0);
};

// ============================================
// onDataUpdated - Handle ThingsBoard data updates
// ============================================
self.onDataUpdated = function () {
  // For now, data comes from orchestrator cache via events
  // This can be enhanced to process ctx.data for temperature sensors
  LogHelper.log('onDataUpdated called');
};

// ============================================
// onDestroy - Cleanup
// ============================================
self.onDestroy = function () {
  LogHelper.log('onDestroy - cleaning up...');

  // Cleanup card components
  if (Array.isArray(activeCardComponents)) {
    activeCardComponents.forEach((comp) => {
      if (comp && typeof comp.destroy === 'function') {
        comp.destroy();
      }
    });
    activeCardComponents = [];
  }

  // Remove event listeners
  if (self._onFilterApplied) {
    window.removeEventListener('myio:filter-applied', self._onFilterApplied);
  }
  if (self._onDateParams) {
    window.removeEventListener('myio:date-params', self._onDateParams);
  }
  // RFC-0111: Cleanup config change listener
  if (self._onTelemetryConfigChange) {
    window.removeEventListener('myio:telemetry-config-change', self._onTelemetryConfigChange);
  }
  // Cleanup theme change listener
  if (self._onThemeChange) {
    window.removeEventListener('myio:theme-change', self._onThemeChange);
  }
  // RFC-0115: Cleanup data-enriched listener
  if (self._onDataEnriched) {
    window.removeEventListener('myio:data-enriched', self._onDataEnriched);
  }
};
