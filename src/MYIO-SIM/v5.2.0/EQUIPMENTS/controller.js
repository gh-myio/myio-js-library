/* =========================================================================
 * RFC-0143: EQUIPMENTS Widget - Refactored using DeviceGridWidgetFactory
 *
 * This widget displays equipment devices (HVAC, Elevators, Escalators, Others)
 * with energy consumption data and real-time monitoring.
 * Reduced from ~2,800 lines to ~250 lines using the factory pattern.
 *
 * Device Filter: Equipment devices (NOT stores - excludes 3F_MEDIDOR === 3F_MEDIDOR)
 * Status: Calculated via master rules (RFC-0110)
 * Features: Real-time mode (WebSocket/REST), Equipment categories
 * =========================================================================*/

/* eslint-disable no-undef */

// ============================================================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================================================
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log('[EQUIPMENTS]', ...args),
  warn: (...args) => console.warn('[EQUIPMENTS]', ...args),
  error: (...args) => console.error('[EQUIPMENTS]', ...args),
};

// RFC-0110: Status calculation function from MAIN
const calculateDeviceStatusMasterRules =
  window.MyIOUtils?.calculateDeviceStatusMasterRules ||
  (() => 'no_info');

LogHelper.log('[EQUIPMENTS] RFC-0143 Controller loaded - Factory Pattern');

// ============================================================================
// EQUIPMENT CATEGORY DETECTION FUNCTIONS
// ============================================================================

/**
 * Check if device is HVAC/Climatization equipment
 */
function isHVAC(device) {
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase();
  const identifier = String(device?.identifier || '').toUpperCase();

  // Direct HVAC types
  if (['CHILLER', 'FANCOIL', 'AR_CONDICIONADO', 'BOMBA', 'HVAC'].includes(deviceType)) {
    return true;
  }

  // 3F_MEDIDOR with HVAC profile
  if (deviceType === '3F_MEDIDOR') {
    if (['CHILLER', 'FANCOIL', 'AR_CONDICIONADO', 'BOMBA', 'HVAC', 'BOMBA_CAG'].includes(deviceProfile)) {
      return true;
    }
  }

  // Identifier-based detection (CAG = Central de Água Gelada)
  if (identifier.includes('CAG') || identifier.includes('CHILLER')) {
    return true;
  }

  return false;
}

/**
 * Check if device is an Elevator
 */
function isElevator(device) {
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase();
  const identifier = String(device?.identifier || '').toUpperCase();

  if (deviceType === 'ELEVADOR') return true;
  if (deviceType === '3F_MEDIDOR' && deviceProfile === 'ELEVADOR') return true;
  if (identifier.startsWith('ELV-') || identifier.startsWith('ELEV')) return true;

  return false;
}

/**
 * Check if device is an Escalator
 */
function isEscalator(device) {
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase();
  const identifier = String(device?.identifier || '').toUpperCase();

  if (deviceType === 'ESCADA_ROLANTE') return true;
  if (deviceType === '3F_MEDIDOR' && deviceProfile === 'ESCADA_ROLANTE') return true;
  if (identifier.startsWith('ESC-') || identifier.startsWith('ESCADA')) return true;

  return false;
}

/**
 * Check if device is a Store (3F_MEDIDOR with 3F_MEDIDOR profile)
 * These should be EXCLUDED from EQUIPMENTS widget
 */
function isStore(device) {
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase();
  return deviceType === '3F_MEDIDOR' && deviceProfile === '3F_MEDIDOR';
}

/**
 * Check if device is an Entrada (Input meter)
 * These should be EXCLUDED from EQUIPMENTS widget (shown in HEADER)
 */
function isEntrada(device) {
  const deviceType = String(device?.deviceType || '').toUpperCase();
  const deviceProfile = String(device?.deviceProfile || '').toUpperCase();

  const entradaTypes = ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'];
  return entradaTypes.includes(deviceType) || entradaTypes.includes(deviceProfile);
}

// ============================================================================
// DEVICE FILTER: Equipment devices (excludes stores and entrada)
// ============================================================================
function isEquipmentDevice(device) {
  // Exclude stores (3F_MEDIDOR with 3F_MEDIDOR profile)
  if (isStore(device)) return false;

  // Exclude entrada meters
  if (isEntrada(device)) return false;

  // Must have consumption data
  const deviceType = String(device?.deviceType || '').toUpperCase();

  // Accept specific equipment types
  const equipmentTypes = [
    'CHILLER', 'FANCOIL', 'AR_CONDICIONADO', 'BOMBA', 'HVAC',
    'ELEVADOR', 'ESCADA_ROLANTE',
    'COMPRESSOR', 'VENTILADOR', 'MOTOR',
  ];

  if (equipmentTypes.includes(deviceType)) return true;

  // Accept 3F_MEDIDOR with equipment-like profiles
  if (deviceType === '3F_MEDIDOR') {
    const deviceProfile = String(device?.deviceProfile || '').toUpperCase();
    if (deviceProfile && deviceProfile !== '3F_MEDIDOR' && deviceProfile !== 'N/D') {
      return true;
    }
  }

  return false;
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
// FILTER TABS: Category-based filtering for equipment
// ============================================================================
function getConsumption(device) {
  return Number(device?.value) || Number(device?.consumption) || Number(device?.total_value) || 0;
}

const EQUIPMENTS_FILTER_TABS = [
  { id: 'all', label: 'Todos', filter: () => true },
  { id: 'hvac', label: 'Climatização', filter: (d) => isHVAC(d), icon: '❄️' },
  { id: 'elevators', label: 'Elevadores', filter: (d) => isElevator(d), icon: '🛗' },
  { id: 'escalators', label: 'Escadas', filter: (d) => isEscalator(d), icon: '📶' },
  { id: 'others', label: 'Outros', filter: (d) => !isHVAC(d) && !isElevator(d) && !isEscalator(d), icon: '⚙️' },
  { id: 'online', label: 'Online', filter: (d) => !['offline', 'no_info', 'not_installed'].includes(getDeviceStatus(d)) },
  { id: 'offline', label: 'Offline', filter: (d) => ['offline', 'no_info'].includes(getDeviceStatus(d)) },
  { id: 'withConsumption', label: 'Com Consumo', filter: (d) => getConsumption(d) > 0 },
  { id: 'noConsumption', label: 'Sem Consumo', filter: (d) => getConsumption(d) === 0 },
];

// ============================================================================
// WIDGET CONFIGURATION
// ============================================================================
const EQUIPMENTS_CONFIG = {
  // Identity
  widgetName: 'EQUIPMENTS',
  idPrefix: 'equip',

  // Domain & Context
  domain: 'energy',
  context: 'equipments',

  // Device Classification
  deviceFilter: isEquipmentDevice,
  statusCalculation: 'master_rules', // RFC-0110: Uses master rules for status

  // Value Formatting
  formatValue: formatEnergyValue,
  unit: 'kWh',
  valType: 'power_kw',
  icon: 'energy',

  // UI Configuration
  primaryColor: '#3E1A7D', // Purple for energy
  listElementId: 'cards-grid',
  headerContainerId: 'equipHeaderContainer',

  // Filter Tabs
  filterTabs: EQUIPMENTS_FILTER_TABS,

  // Header Labels
  headerLabels: {
    total: 'Total de Equipamentos',
    consumption: 'Consumo Total de Equipamentos',
  },

  // Feature Flags
  hasRealTimeMode: true, // EQUIPMENTS supports real-time WebSocket/REST
  hasEquipmentCategories: true, // Has HVAC, Elevators, Escalators, Others

  // Timing - RFC-0110: Standard delay for master rules calculation
  delayTimeConnectionInMins: 1440, // 24 hours threshold for offline detection

  // Event Names
  summaryReadyEvent: 'myio:energy-summary-ready',

  // Equipment Category Functions (for header breakdown)
  categoryFunctions: {
    isHVAC,
    isElevator,
    isEscalator,
    isStore,
    isEntrada,
  },
};

// ============================================================================
// CREATE CONTROLLER FROM FACTORY
// ============================================================================
let factoryController = null;

self.onInit = async function () {
  LogHelper.log('[EQUIPMENTS] RFC-0143 onInit - Using DeviceGridWidgetFactory');

  // RFC-0091: Protection against duplicate onInit calls
  if (window.__EQUIPMENTS_INITIALIZED__) {
    LogHelper.log('[EQUIPMENTS] onInit - already initialized, skipping duplicate call');
    return;
  }
  window.__EQUIPMENTS_INITIALIZED__ = true;

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
    LogHelper.error('[EQUIPMENTS] DeviceGridWidgetFactory not available - ensure MyIOLibrary is loaded');
    return;
  }

  try {
    // Create controller from factory
    factoryController = DeviceGridWidgetFactory.createWidgetController(EQUIPMENTS_CONFIG);

    // Initialize the controller
    await factoryController.onInit();

    LogHelper.log('[EQUIPMENTS] RFC-0143 Factory controller initialized successfully');
  } catch (error) {
    LogHelper.error('[EQUIPMENTS] Failed to initialize factory controller:', error);
  }
};

self.onDataUpdated = function () {
  // No-op - data comes via events from MAIN/Orchestrator
  if (factoryController?.onDataUpdated) {
    factoryController.onDataUpdated();
  }
};

self.onDestroy = function () {
  LogHelper.log('[EQUIPMENTS] RFC-0143 onDestroy');

  // Clear initialization flag
  window.__EQUIPMENTS_INITIALIZED__ = false;

  if (factoryController?.onDestroy) {
    factoryController.onDestroy();
  }

  factoryController = null;
};
