/* =========================================================================
 * RFC-0143: STORES Widget - Refactored using DeviceGridWidgetFactory
 *
 * This widget displays store (loja) devices with energy consumption data.
 * Reduced from ~2,500 lines to ~120 lines using the factory pattern.
 *
 * Device Filter: deviceType === '3F_MEDIDOR' AND deviceProfile === '3F_MEDIDOR'
 * Status: Always 'online' (RFC-0140 - stores represent allocation, not physical meters)
 * =========================================================================*/

/* eslint-disable no-undef */

// ============================================================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================================================
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log('[STORES]', ...args),
  warn: (...args) => console.warn('[STORES]', ...args),
  error: (...args) => console.error('[STORES]', ...args),
};

LogHelper.log('🚀 [STORES] RFC-0143 Controller loaded - Factory Pattern');

// ============================================================================
// DEVICE FILTER: Store devices have deviceType AND deviceProfile = '3F_MEDIDOR'
// ============================================================================
function isStoreDevice(device) {
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase();
  return deviceType === '3F_MEDIDOR' && deviceProfile === '3F_MEDIDOR';
}

// ============================================================================
// VALUE FORMATTER: Energy consumption in kWh
// ============================================================================
function formatEnergyValue(value) {
  const MyIO = window.MyIOLibrary;
  if (MyIO?.formatEnergy) {
    return MyIO.formatEnergy(value);
  }
  // Fallback formatter
  const num = Number(value) || 0;
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)} GWh`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)} MWh`;
  return `${num.toFixed(2)} kWh`;
}

// ============================================================================
// FILTER TABS: Standard tabs for filtering devices
// ============================================================================
function getConsumption(device) {
  return Number(device?.value) || Number(device?.consumption) || Number(device?.total_value) || 0;
}

const STORES_FILTER_TABS = [
  { id: 'all', label: 'Todos', filter: () => true },
  { id: 'withConsumption', label: 'Com Consumo', filter: (d) => getConsumption(d) > 0 },
  { id: 'noConsumption', label: 'Sem Consumo', filter: (d) => getConsumption(d) === 0 },
];

// ============================================================================
// WIDGET CONFIGURATION
// ============================================================================
const STORES_CONFIG = {
  // Identity
  widgetName: 'STORES',
  idPrefix: 'stores',

  // Domain & Context
  domain: 'energy',
  context: 'stores',

  // Device Classification
  deviceFilter: isStoreDevice,
  statusCalculation: 'always_online', // RFC-0140: Stores always online

  // Value Formatting
  formatValue: formatEnergyValue,
  unit: 'kWh',
  valType: 'power_kw',
  icon: 'energy',

  // UI Configuration
  primaryColor: '#3E1A7D',
  listElementId: 'shopsList',
  headerContainerId: 'storesHeaderContainer',

  // Filter Tabs
  filterTabs: STORES_FILTER_TABS,

  // Header Labels
  headerLabels: {
    total: 'Total de Lojas',
    consumption: 'Consumo Total de Todas Lojas',
  },

  // Feature Flags
  hasRealTimeMode: false,
  hasEquipmentCategories: false,

  // Timing
  delayTimeConnectionInMins: 86400, // RFC-0140: 24 hours (essentially always online)

  // Event Names
  summaryReadyEvent: 'myio:energy-summary-ready',
};

// ============================================================================
// CREATE CONTROLLER FROM FACTORY
// ============================================================================
let factoryController = null;

self.onInit = async function () {
  LogHelper.log('[STORES] RFC-0143 onInit - Using DeviceGridWidgetFactory');

  // Apply container styles
  $(self.ctx.$container).css({
    height: '100%',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  });

  // Get factory from MyIOLibrary
  const DeviceGridWidgetFactory = window.MyIOLibrary?.DeviceGridWidgetFactory ||
                                   window.DeviceGridWidgetFactory ||
                                   window.MyIOUtils?.DeviceGridWidgetFactory;

  if (!DeviceGridWidgetFactory) {
    LogHelper.error('[STORES] DeviceGridWidgetFactory not available - ensure MyIOLibrary is loaded');
    return;
  }

  try {
    // Create controller from factory
    factoryController = DeviceGridWidgetFactory.createWidgetController(STORES_CONFIG);

    // Initialize the controller
    await factoryController.onInit();

    LogHelper.log('[STORES] RFC-0143 Factory controller initialized successfully');
  } catch (error) {
    LogHelper.error('[STORES] Failed to initialize factory controller:', error);
  }
};

self.onDataUpdated = function () {
  // No-op - data comes via events from MAIN/Orchestrator
  if (factoryController?.onDataUpdated) {
    factoryController.onDataUpdated();
  }
};

self.onDestroy = function () {
  LogHelper.log('[STORES] RFC-0143 onDestroy');

  if (factoryController?.onDestroy) {
    factoryController.onDestroy();
  }

  factoryController = null;
};
