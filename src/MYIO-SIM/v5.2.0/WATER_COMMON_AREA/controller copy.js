/* =========================================================================
 * RFC-0143: WATER_COMMON_AREA Widget - Refactored using DeviceGridWidgetFactory
 *
 * This widget displays water meter devices for common areas with volume data.
 * Reduced from ~2,200 lines to ~150 lines using the factory pattern.
 *
 * Device Filter: aliasName === 'HidrometrosAreaComum'
 * Status: Calculated via master rules (RFC-0110)
 * =========================================================================*/

/* eslint-disable no-undef */

// ============================================================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================================================
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log('[WATER_COMMON_AREA]', ...args),
  warn: (...args) => console.warn('[WATER_COMMON_AREA]', ...args),
  error: (...args) => console.error('[WATER_COMMON_AREA]', ...args),
};

// RFC-0110: Status calculation function from MAIN
const calculateDeviceStatusMasterRules =
  window.MyIOUtils?.calculateDeviceStatusMasterRules ||
  (() => 'no_info');

LogHelper.log('[WATER_COMMON_AREA] RFC-0143 Controller loaded - Factory Pattern');

// ============================================================================
// DEVICE FILTER: Water meters for common areas have aliasName = 'HidrometrosAreaComum'
// ============================================================================
function isWaterCommonAreaDevice(device) {
  // Check aliasName from datasource
  const aliasName = device?.aliasName || device?.datasource?.aliasName || '';
  if (aliasName === 'HidrometrosAreaComum') return true;

  // Fallback: Check context indicates common area
  const context = String(device?.context || '').toLowerCase();
  if (context === 'hidrometro_area_comum') return true;

  // Check deviceType contains HIDROMETRO and has area_comum indicator
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const identifier = String(device?.identifier || '').toLowerCase();
  return deviceType.includes('HIDROMETRO') && (
    identifier.includes('area_comum') ||
    identifier.includes('areacomum') ||
    identifier.includes('comum')
  );
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
// STATUS HELPER: Get device status using master rules
// ============================================================================
function getDeviceStatus(device) {
  return calculateDeviceStatusMasterRules({
    connectionStatus: device?.connectionStatus,
    lastConnectTime: device?.lastConnectTime || device?.lastActivityTime,
    lastDisconnectTime: device?.lastDisconnectTime,
    lastActivityTime: device?.lastActivityTime,
  });
}

// ============================================================================
// FILTER TABS: Standard tabs for filtering devices (includes status tabs)
// ============================================================================
function getConsumption(device) {
  return Number(device?.value) || Number(device?.consumption) || Number(device?.pulses) || Number(device?.total_value) || 0;
}

const WATER_COMMON_AREA_FILTER_TABS = [
  { id: 'all', label: 'Todos', filter: () => true },
  { id: 'online', label: 'Online', filter: (d) => !['offline', 'no_info', 'not_installed'].includes(getDeviceStatus(d)) },
  { id: 'offline', label: 'Offline', filter: (d) => ['offline', 'no_info'].includes(getDeviceStatus(d)) },
  { id: 'notInstalled', label: 'Não Instalado', filter: (d) => getDeviceStatus(d) === 'not_installed' },
  { id: 'withConsumption', label: 'Com Consumo', filter: (d) => getConsumption(d) > 0 },
  { id: 'noConsumption', label: 'Sem Consumo', filter: (d) => getConsumption(d) === 0 },
];

// ============================================================================
// WIDGET CONFIGURATION
// ============================================================================
const WATER_COMMON_AREA_CONFIG = {
  // Identity
  widgetName: 'WATER_COMMON_AREA',
  idPrefix: 'waterCommonArea',

  // Domain & Context
  domain: 'water',
  context: 'hidrometro_area_comum',

  // Device Classification
  deviceFilter: isWaterCommonAreaDevice,
  statusCalculation: 'master_rules', // RFC-0110: Uses master rules for status

  // Value Formatting
  formatValue: formatWaterValue,
  unit: 'm³',
  valType: 'volume_m3',
  icon: 'water',

  // UI Configuration
  primaryColor: '#0288D1', // Blue for water
  listElementId: 'waterCommonAreaList',
  headerContainerId: 'waterCommonAreaHeaderContainer',

  // Filter Tabs
  filterTabs: WATER_COMMON_AREA_FILTER_TABS,

  // Header Labels
  headerLabels: {
    total: 'Total de Hidrômetros',
    consumption: 'Consumo Total (m³)',
  },

  // Feature Flags
  hasRealTimeMode: false,
  hasEquipmentCategories: false,

  // Timing - RFC-0110: Standard delay for master rules calculation
  delayTimeConnectionInMins: 1440, // 24 hours threshold for offline detection

  // Event Names
  summaryReadyEvent: 'myio:water-summary-ready',

  // Data Source Configuration
  aliasName: 'HidrometrosAreaComum',
};

// ============================================================================
// CREATE CONTROLLER FROM FACTORY
// ============================================================================
let factoryController = null;

self.onInit = async function () {
  LogHelper.log('[WATER_COMMON_AREA] RFC-0143 onInit - Using DeviceGridWidgetFactory');

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
    LogHelper.error('[WATER_COMMON_AREA] DeviceGridWidgetFactory not available - ensure MyIOLibrary is loaded');
    return;
  }

  try {
    // Create controller from factory
    factoryController = DeviceGridWidgetFactory.createWidgetController(WATER_COMMON_AREA_CONFIG);

    // Initialize the controller
    await factoryController.onInit();

    LogHelper.log('[WATER_COMMON_AREA] RFC-0143 Factory controller initialized successfully');
  } catch (error) {
    LogHelper.error('[WATER_COMMON_AREA] Failed to initialize factory controller:', error);
  }
};

self.onDataUpdated = function () {
  // No-op - data comes via events from MAIN/Orchestrator
  if (factoryController?.onDataUpdated) {
    factoryController.onDataUpdated();
  }
};

self.onDestroy = function () {
  LogHelper.log('[WATER_COMMON_AREA] RFC-0143 onDestroy');

  if (factoryController?.onDestroy) {
    factoryController.onDestroy();
  }

  factoryController = null;
};
