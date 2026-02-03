/* =========================================================================
 * RFC-0143: WATER_STORES Widget - Refactored using DeviceGridWidgetFactory
 *
 * This widget displays water meter devices for stores (lojas) with volume data.
 * Reduced from ~1,900 lines to ~130 lines using the factory pattern.
 *
 * Device Filter: aliasName === 'Todos Hidrometros Lojas'
 * Status: Always 'online' (RFC-0140 - stores represent allocation, not physical meters)
 * =========================================================================*/

/* eslint-disable no-undef */

// ============================================================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================================================
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log('[WATER_STORES]', ...args),
  warn: (...args) => console.warn('[WATER_STORES]', ...args),
  error: (...args) => console.error('[WATER_STORES]', ...args),
};

LogHelper.log('[WATER_STORES] RFC-0143 Controller loaded - Factory Pattern');

// ============================================================================
// DEVICE FILTER: Water meters for stores have aliasName = 'Todos Hidrometros Lojas'
// ============================================================================
function isWaterStoreDevice(device) {
  // Check aliasName from datasource
  const aliasName = device?.aliasName || device?.datasource?.aliasName || '';
  if (aliasName === 'Todos Hidrometros Lojas') return true;

  // RFC-0143 FIX: WATER_STORES = deviceType === 'HIDROMETRO' AND deviceProfile === 'HIDROMETRO' (exact match)
  // This excludes HIDROMETRO_AREA_COMUM devices which have deviceProfile = 'HIDROMETRO_AREA_COMUM'
  const deviceType = String(device?.deviceType || '').toUpperCase();
  // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
  const deviceProfile = String(device?.deviceProfile || device?.deviceType || '').toUpperCase();
  return deviceType === 'HIDROMETRO' && deviceProfile === 'HIDROMETRO';
}

// ============================================================================
// VALUE FORMATTER: Water volume in M³
// ============================================================================
function formatWaterValue(value) {
  const MyIO = window.MyIOLibrary;
  if (MyIO?.formatWaterVolumeM3) {
    return MyIO.formatWaterVolumeM3(value);
  }
  // Fallback formatter
  const num = Number(value) || 0;
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)} Mm³`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)} km³`;
  return `${num.toFixed(2)} m³`;
}

// ============================================================================
// FILTER TABS: Standard tabs for filtering devices
// ============================================================================
function getConsumption(device) {
  return (
    Number(device?.value) ||
    Number(device?.consumption) ||
    Number(device?.pulses) ||
    Number(device?.total_value) ||
    0
  );
}

const WATER_STORES_FILTER_TABS = [
  { id: 'all', label: 'Todos', filter: () => true },
  { id: 'withConsumption', label: 'Com Consumo', filter: (d) => getConsumption(d) > 0 },
  { id: 'noConsumption', label: 'Sem Consumo', filter: (d) => getConsumption(d) === 0 },
];

// ============================================================================
// WIDGET CONFIGURATION
// ============================================================================
const WATER_STORES_CONFIG = {
  // Identity
  widgetName: 'WATER_STORES',
  idPrefix: 'waterStores',

  // Domain & Context
  domain: 'water',
  context: 'hidrometro',

  // Device Classification
  deviceFilter: isWaterStoreDevice,
  statusCalculation: 'always_online', // RFC-0140: Stores always online

  // Value Formatting
  formatValue: formatWaterValue,
  unit: 'm³',
  valType: 'volume_m3',
  icon: 'water',

  // UI Configuration
  primaryColor: '#0288D1', // Blue for water
  listElementId: 'waterStoresList',
  headerContainerId: 'waterStoresHeaderContainer',

  // Filter Tabs
  filterTabs: WATER_STORES_FILTER_TABS,

  // Header Labels
  headerLabels: {
    total: 'Total de Hidrômetros',
    consumption: 'Consumo Total (m³)',
  },

  // Feature Flags
  hasRealTimeMode: false,
  hasEquipmentCategories: false,

  // Timing
  delayTimeConnectionInMins: 7776000000, // RFC-0140: 24 hours (essentially always online)

  // Event Names
  summaryReadyEvent: 'myio:water-summary-ready',

  // Data Source Configuration
  aliasName: 'Todos Hidrometros Lojas',
};

// ============================================================================
// CREATE CONTROLLER FROM FACTORY
// ============================================================================
let factoryController = null;
let waterStoresHeaderController = null;
let waterStoresSummaryHandler = null;
let waterStoresTbDataHandler = null;
let waterStoresProvideHandler = null;

self.onInit = async function () {
  LogHelper.log('[WATER_STORES] RFC-0143 onInit - Using DeviceGridWidgetFactory');

  // RFC-0140 FIX: Check if ctx is available
  if (!self.ctx || !self.ctx.$container) {
    LogHelper.error(
      '[WATER_STORES] ctx or $container not available - widget may not be properly initialized'
    );
    return;
  }

  // Apply container styles
  $(self.ctx.$container).css({
    height: '100%',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  });

  // Get factory from MyIOLibrary
  const DeviceGridWidgetFactory =
    window.MyIOLibrary?.DeviceGridWidgetFactory ||
    window.DeviceGridWidgetFactory ||
    window.MyIOUtils?.DeviceGridWidgetFactory;

  if (!DeviceGridWidgetFactory) {
    LogHelper.error('[WATER_STORES] DeviceGridWidgetFactory not available - ensure MyIOLibrary is loaded');
    return;
  }

  try {
    // RFC-0159: Build header BEFORE factory (like WATER_COMMON_AREA)
    const $root = () => $(self.ctx.$container[0]);
    const buildHeaderDevicesGrid = window.MyIOUtils?.buildHeaderDevicesGrid;

    if (buildHeaderDevicesGrid) {
      const headerContainerEl = $root().find('#waterStoresHeaderContainer')[0];
      if (headerContainerEl) {
        waterStoresHeaderController = buildHeaderDevicesGrid({
          container: headerContainerEl,
          domain: 'water',
          idPrefix: 'waterStores',
          labels: {
            total: 'Total de Hidrômetros',
            consumption: 'Consumo Total (m³)',
          },
          includeSearch: true,
          includeFilter: true,
          onSearchClick: () => {
            const state = factoryController?.getState();
            if (state) {
              state.searchActive = !state.searchActive;
              if (state.searchActive) {
                const input = waterStoresHeaderController?.getSearchInput();
                if (input) setTimeout(() => input.focus(), 100);
              }
            }
          },
          onFilterClick: () => {
            const filterModal = factoryController?.getFilterModalController?.();
            if (filterModal?.open) {
              filterModal.open();
            } else if (filterModal?.show) {
              filterModal.show();
            }
          },
          onSortChange: (mode) => {
            const state = factoryController?.getState();
            if (state) {
              state.sortMode = mode;
              factoryController.reflow();
            }
          },
          onSearchChange: (term) => {
            const state = factoryController?.getState();
            if (state) {
              state.searchTerm = term;
              state.searchActive = term.length > 0;
              factoryController.reflow();
            }
          },
        });

        // Setup search input listener
        const searchInput = waterStoresHeaderController?.getSearchInput();
        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            const state = factoryController?.getState();
            if (state) {
              state.searchTerm = e.target.value || '';
              factoryController.reflow();
            }
          });
        }

        LogHelper.log('[WATER_STORES] RFC-0159 Header controller initialized');
      } else {
        LogHelper.warn('[WATER_STORES] Header container element not found');
      }
    } else {
      LogHelper.warn('[WATER_STORES] buildHeaderDevicesGrid not available');
    }

    // Create factory config with header controller reference
    const configWithHeader = {
      ...WATER_STORES_CONFIG,
      headerController: waterStoresHeaderController,
    };

    // Create controller from factory
    factoryController = DeviceGridWidgetFactory.createWidgetController(configWithHeader);

    // Initialize the controller - pass self.ctx for container access
    await factoryController.onInit(self.ctx);

    LogHelper.log('[WATER_STORES] RFC-0143 Factory controller initialized successfully');

    // Force refresh on new data emissions (Carregar / period refresh)
    waterStoresSummaryHandler = (ev) => {
      LogHelper.log('[WATER_STORES] water-summary-ready received. Refreshing grid...', ev?.detail);
      factoryController?.onDataUpdated?.();
    };
    waterStoresTbDataHandler = (ev) => {
      LogHelper.log('[WATER_STORES] water-tb-data-ready received. Refreshing grid...', ev?.detail);
      factoryController?.onDataUpdated?.();
    };
    waterStoresProvideHandler = (ev) => {
      const detail = ev?.detail || {};
      if (detail.domain !== 'water') return;
      LogHelper.log('[WATER_STORES] provide-data (water) received. Refreshing grid...', detail);
      factoryController?.onDataUpdated?.();
    };

    window.addEventListener('myio:water-summary-ready', waterStoresSummaryHandler);
    window.addEventListener('myio:water-tb-data-ready', waterStoresTbDataHandler);
    window.addEventListener('myio:telemetry:provide-data', waterStoresProvideHandler);
  } catch (error) {
    LogHelper.error('[WATER_STORES] Failed to initialize factory controller:', error);
  }
};

self.onDataUpdated = function () {
  // No-op - data comes via events from MAIN/Orchestrator
  if (factoryController?.onDataUpdated) {
    factoryController.onDataUpdated();
  }
};

self.onDestroy = function () {
  LogHelper.log('[WATER_STORES] RFC-0143 onDestroy');

  if (waterStoresSummaryHandler) {
    window.removeEventListener('myio:water-summary-ready', waterStoresSummaryHandler);
    waterStoresSummaryHandler = null;
  }
  if (waterStoresTbDataHandler) {
    window.removeEventListener('myio:water-tb-data-ready', waterStoresTbDataHandler);
    waterStoresTbDataHandler = null;
  }
  if (waterStoresProvideHandler) {
    window.removeEventListener('myio:telemetry:provide-data', waterStoresProvideHandler);
    waterStoresProvideHandler = null;
  }

  // RFC-0159: Destroy header controller
  if (waterStoresHeaderController?.destroy) {
    waterStoresHeaderController.destroy();
  }
  waterStoresHeaderController = null;

  if (factoryController?.onDestroy) {
    factoryController.onDestroy();
  }
  factoryController = null;
};
