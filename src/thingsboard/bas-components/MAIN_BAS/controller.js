/* global self, window, MyIOLibrary, document */
/**
 * MAIN_BAS Controller
 * RFC-0158: Building Automation System (BAS) Dashboard Controller
 *
 * Datasources:
 *   1. "Ambientes" → Lista lateral (EntityListPanel) - Assets que representam ambientes
 *   2. "AllDevices" → Dispositivos em árvore (Assets → Assets → Devices)
 *                     Assets são containers, Devices são classificados por domain
 *
 * Classification: By deviceProfile and deviceType attributes
 *
 * Template layout (template.html) — CSS Grid 4 cols × 2 rows:
 *
 *   col:  20%          40%            20%           20%
 *  row 1  EntityList  | Water cards  | Ambientes   | Bombas e Motores
 *         50%h        | 50%h         | 100%h       | 100%h
 *  row 2  Chart (spans col 1–2)     | (continues) | (continues)
 *         50%h  60%w                 |             |
 *
 *   #bas-dashboard-root
 *     #bas-header
 *     .bas-content-layout (CSS Grid)
 *       #bas-sidebar-host    (col 1,   row 1)   ← EntityListPanel (Ambientes list)
 *       #bas-water-host      (col 2,   row 1)   ← CardGridPanel (water)
 *       #bas-charts-host     (col 1-2, row 2)   ← Tab bar + Consumption7DaysChart
 *       #bas-ambientes-host  (col 3,   row 1-2) ← CardGridPanel (HVAC)
 *       #bas-motors-host     (col 4,   row 1-2) ← CardGridPanel (motores)
 *
 * Datakeys Required:
 *   Attributes: deviceType, deviceProfile, identifier, active
 *   Timeseries: consumption, temperature, setpoint, level, state
 */

// ============================================================================
// Classification Constants (RFC-0142)
// Domains: energy | water | temperature (NO motor domain - motors are energy)
// ============================================================================

var OCULTOS_PATTERNS = ['ARQUIVADO', 'SEM_DADOS', 'DESATIVADO', 'REMOVIDO', 'INATIVO'];

var ENTRADA_TYPES = ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'];

// Motor/pump types are ENERGY domain, context 'bomba' or 'motor'
var MOTOR_TYPES = ['BOMBA', 'MOTOR', 'BOMBA_HIDRAULICA', 'BOMBA_INCENDIO', 'BOMBA_CAG'];

var HVAC_TYPES = ['TERMOSTATO', 'CHILLER', 'FANCOIL', 'HVAC', 'AR_CONDICIONADO'];

var WATER_TYPES = ['HIDROMETRO', 'CAIXA_DAGUA', 'SOLENOIDE', 'TANQUE'];

// ============================================================================
// Module-level references
// ============================================================================

let _ambientesListPanel = null;
let _waterPanel = null;
let _ambientesPanel = null;
let _motorsPanel = null;
let _chartInstance = null;
let _currentChartDomain = 'energy';
let _selectedAmbiente = null;
let _ctx = null;
let _settings = null;
let _currentAmbientes = [];
let _currentClassified = null;
let _dataUpdatedCount = 0; // Counter to limit onDataUpdated calls (max 3)

// Chart domain configuration
var CHART_DOMAIN_CONFIG = {
  energy: { unit: 'kWh', unitLarge: 'MWh', threshold: 10000, label: 'Energia' },
  water: { unit: 'L', unitLarge: 'm\u00B3', threshold: 1000, label: '\u00C1gua' },
  temperature: { unit: '\u00B0C', unitLarge: '\u00B0C', threshold: 999, label: 'Temperatura' },
};

/**
 * Extract settings from widget configuration
 */
function getSettings(ctx) {
  const widgetSettings = ctx?.widget?.config?.settings || {};

  return {
    enableDebugMode: widgetSettings.enableDebugMode ?? false,
    defaultThemeMode: widgetSettings.defaultThemeMode ?? 'light',
    dashboardTitle: widgetSettings.dashboardTitle ?? 'DASHBOARD',
    sidebarLabel: widgetSettings.sidebarLabel ?? 'Locais',
    environmentsLabel: widgetSettings.environmentsLabel ?? 'Ambientes',
    pumpsMotorsLabel: widgetSettings.pumpsMotorsLabel ?? 'Energia',
    temperatureChartTitle:
      widgetSettings.temperatureChartTitle ?? 'Temperatura do dia atual de todos os ambientes',
    consumptionChartTitle:
      widgetSettings.consumptionChartTitle ?? 'Consumo do dia atual de todos os ambientes',
    showSidebar: widgetSettings.showSidebar ?? true,
    showWaterInfrastructure: widgetSettings.showWaterInfrastructure ?? true,
    showEnvironments: widgetSettings.showEnvironments ?? true,
    showPumpsMotors: widgetSettings.showPumpsMotors ?? true,
    showCharts: widgetSettings.showCharts ?? true,
    primaryColor: widgetSettings.primaryColor ?? '#2F5848',
    warningColor: widgetSettings.warningColor ?? '#f57c00',
    errorColor: widgetSettings.errorColor ?? '#c62828',
    successColor: widgetSettings.successColor ?? '#2e7d32',
    cardCustomStyle: widgetSettings.cardCustomStyle ?? undefined,
    // Panel backgrounds
    mainBackground: widgetSettings.mainBackground ?? '#0b1220',
    mainBackgroundImage: widgetSettings.mainBackgroundImage ?? undefined,
    sidebarBackground: widgetSettings.sidebarBackground ?? '#faf8f1',
    sidebarBackgroundImage: widgetSettings.sidebarBackgroundImage ?? undefined,
    cardGridGap: widgetSettings.cardGridGap ?? '20px',
    waterPanelBackground: widgetSettings.waterPanelBackground ?? '#e8f4fc',
    environmentsPanelBackground: widgetSettings.environmentsPanelBackground ?? '#fef7e8',
    motorsPanelBackground: widgetSettings.motorsPanelBackground ?? '#f0f4e8',
    chartPanelBackground: widgetSettings.chartPanelBackground ?? '#ffffff',
  };
}

// ============================================================================
// Classification Functions
// ============================================================================

/**
 * Check if device is "ocultos" (hidden/archived)
 */
function isOcultosDevice(deviceProfile) {
  var profile = String(deviceProfile || '').toUpperCase();
  for (var i = 0; i < OCULTOS_PATTERNS.length; i++) {
    if (profile.includes(OCULTOS_PATTERNS[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Detect domain from deviceType
 * Domains: energy | water | temperature (NO motor domain)
 * Motors/pumps are classified as 'energy' domain
 */
function detectDomain(deviceType) {
  var dt = String(deviceType || '').toUpperCase();
  var i;

  // Check water types FIRST
  for (i = 0; i < WATER_TYPES.length; i++) {
    if (dt.includes(WATER_TYPES[i])) {
      return 'water';
    }
  }

  // Check HVAC/temperature types
  for (i = 0; i < HVAC_TYPES.length; i++) {
    if (dt.includes(HVAC_TYPES[i])) {
      return 'temperature';
    }
  }

  // Everything else is energy (including MOTOR_TYPES)
  return 'energy';
}

/**
 * Detect context within domain
 * Uses MyIOLibrary.detectContext for standard contexts,
 * with additional BAS-specific handling for motors (bomba/motor) and water (caixadagua, solenoide)
 *
 * Domains: energy | water | temperature
 * Motors/pumps are energy domain with context 'bomba' or 'motor'
 */
function detectContextForBAS(deviceType, deviceProfile, identifier, domain) {
  var dt = String(deviceType || '').toUpperCase();
  var dp = String(deviceProfile || '').toUpperCase();

  // Water domain: check BAS-specific contexts first (caixadagua, solenoide)
  if (domain === 'water') {
    if (dt.includes('CAIXA_DAGUA')) {
      return 'caixadagua';
    }
    if (dt.includes('SOLENOIDE')) {
      return 'solenoide';
    }
  }

  // Energy domain: check for motor/pump types (BAS-specific contexts)
  if (domain === 'energy') {
    // Check if it's a motor/pump type
    for (var i = 0; i < MOTOR_TYPES.length; i++) {
      if (dt.includes(MOTOR_TYPES[i]) || dp.includes(MOTOR_TYPES[i])) {
        // Specific pump types
        if (dt.includes('BOMBA') || dp.includes('BOMBA')) {
          return 'bomba';
        }
        return 'motor';
      }
    }
  }

  // Use library for standard water/temperature/energy contexts
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.detectContext) {
    var deviceObj = {
      deviceType: deviceType,
      deviceProfile: deviceProfile,
      identifier: identifier,
    };
    return MyIOLibrary.detectContext(deviceObj, domain);
  }

  // Fallback if library not available
  return 'equipments';
}

/**
 * Get last value from dataKey array
 */
function getLastValue(dataKeys, key) {
  var arr = dataKeys[key];
  if (Array.isArray(arr) && arr.length > 0) {
    return arr[arr.length - 1][1];
  }
  return null;
}

/**
 * Get the first available value from row.data
 *
 * ThingsBoard widget data format (observed from logs):
 *   row.data['0'] = [timestamp, actualValue, [ts, ts]]
 *
 * The actual value is at position [1], not in nested arrays.
 */
function getFirstDataValue(rowData) {
  if (!rowData) return null;
  var keys = Object.keys(rowData);
  if (keys.length === 0) return null;
  var entry = rowData[keys[0]];

  // Format: [timestamp, actualValue, [ts, ts]]
  if (Array.isArray(entry) && entry.length >= 2) {
    return entry[1]; // The actual value is at position [1]
  }

  // Fallback: direct value
  return entry;
}

/**
 * Parse datasource data into classified structure
 *
 * ThingsBoard Data Format:
 *   - Each row represents ONE dataKey for ONE entity
 *   - datasource.dataKeys[0].name = the key name (e.g., 'deviceType', 'temperature')
 *   - row.data['0'] or row.data[keyName] = [[timestamp, value], ...]
 *   - Must group rows by entityId to collect all dataKey values
 *
 * Datasources:
 *   1. "Ambientes" → Lista lateral (EntityListPanel)
 *   2. "AllDevices" → Dispositivos em árvore (Assets → Assets → Devices)
 */
function parseDevicesFromData(data) {
  var classified = {
    water: {
      hidrometro_entrada: [],
      banheiros: [],
      hidrometro_area_comum: [],
      hidrometro: [],
      caixadagua: [],
      solenoide: [],
    },
    temperature: {
      termostato: [],
      termostato_external: [],
    },
    energy: {
      entrada: [],
      stores: [],
      equipments: [],
      bomba: [], // Motors/pumps are ENERGY domain
      motor: [], // Motors are ENERGY domain
    },
    ocultos: [],
  };

  var ambientes = [];
  var devices = [];

  if (!data || !Array.isArray(data)) {
    return { classified: classified, ambientes: [], devices: [] };
  }

  console.log('[MAIN_BAS] ============ PARSING DATA ============');
  console.log('[MAIN_BAS] Total rows:', data.length);

  // Phase 1: Group rows by entityId and collect all dataKey values
  // Maps: entityId -> { datasource, collectedData: { keyName: value } }
  //
  // ThingsBoard data format: Each row = ONE dataKey for ONE entity
  // For an entity with 6 dataKeys, it appears in 6 consecutive rows.
  // The dataKey index is determined by tracking occurrence count per entity.
  var ambientesMap = {};
  var devicesMap = {};
  var entityOccurrenceCount = {}; // Track how many times we've seen each entity

  data.forEach(function (row, index) {
    var datasource = row?.datasource || {};
    var aliasName = datasource.aliasName || datasource.name || '';
    var entityType = datasource.entityType || '';
    var entityId = datasource.entityId || '';
    var entityLabel = datasource.entityLabel || datasource.entityName || datasource.name || '';
    var rowData = row?.data || {};

    // Track occurrence count for this entity
    var mapKey = aliasName + ':' + entityId;
    if (!entityOccurrenceCount[mapKey]) {
      entityOccurrenceCount[mapKey] = 0;
    }
    var occurrenceIndex = entityOccurrenceCount[mapKey];
    entityOccurrenceCount[mapKey]++;

    // Get the dataKey name for this row based on occurrence index
    // Each consecutive row for same entity represents the next dataKey
    var dataKeysArray = datasource.dataKeys || [];
    var dataKeyDef = dataKeysArray[occurrenceIndex];
    var keyName = dataKeyDef?.name || dataKeyDef?.label || null;

    // Get the value from row.data (usually under '0' or the keyName)
    var value = getFirstDataValue(rowData);

    // DEBUG: Log first few rows with full structure, and also DEVICE rows
    var isDevice = entityType === 'DEVICE';
    if (index < 15 || (isDevice && index < 150)) {
      // Also log raw data structure for devices
      var rawDataKeys = Object.keys(rowData);
      var rawFirstEntry = rawDataKeys.length > 0 ? rowData[rawDataKeys[0]] : null;

      console.log(
        '[MAIN_BAS] Row ' +
          index +
          ': ' +
          JSON.stringify({
            aliasName: aliasName,
            entityType: entityType,
            entityId: entityId.substring(0, 8) + '...',
            entityLabel: entityLabel,
            occurrenceIndex: occurrenceIndex,
            dataKeyName: keyName,
            value: value,
            totalDataKeys: dataKeysArray.length,
            rawDataKeys: rawDataKeys,
            rawFirstEntry: rawFirstEntry,
          })
      );
    }

    // ========================================
    // DATASOURCE: Ambientes (for sidebar list)
    // ========================================
    if (aliasName === 'Ambientes' || aliasName.toLowerCase().includes('ambiente')) {
      if (!ambientesMap[entityId]) {
        ambientesMap[entityId] = {
          datasource: datasource,
          entityId: entityId,
          entityLabel: entityLabel,
          entityType: entityType,
          aliasName: aliasName,
          collectedData: {},
        };
      }
      if (keyName) {
        ambientesMap[entityId].collectedData[keyName] = value;
      }
      return;
    }

    // ========================================
    // DATASOURCE: AllDevices (tree structure)
    // ========================================
    if (aliasName === 'AllDevices' || aliasName.toLowerCase().includes('device')) {
      // Skip ASSETs - they are containers, not displayed as cards
      if (entityType === 'ASSET') {
        return;
      }

      // Process DEVICEs
      if (entityType === 'DEVICE') {
        if (!devicesMap[entityId]) {
          devicesMap[entityId] = {
            datasource: datasource,
            entityId: entityId,
            entityLabel: entityLabel,
            entityType: entityType,
            aliasName: aliasName,
            collectedData: {},
          };
        }
        if (keyName) {
          devicesMap[entityId].collectedData[keyName] = value;
        }
      }
    }
  });

  console.log('[MAIN_BAS] Phase 1 complete:');
  console.log('[MAIN_BAS]   Unique Ambientes:', Object.keys(ambientesMap).length);
  console.log('[MAIN_BAS]   Unique Devices:', Object.keys(devicesMap).length);

  // Phase 2: Process grouped Ambientes
  Object.keys(ambientesMap).forEach(function (entityId) {
    var entity = ambientesMap[entityId];
    ambientes.push({
      id: entityId,
      name: entity.entityLabel,
      entityType: entity.entityType,
      aliasName: entity.aliasName,
      data: entity.collectedData,
    });
  });

  console.log(
    '[MAIN_BAS] Ambientes processed:',
    ambientes.map(function (a) {
      return a.name;
    })
  );

  // Phase 3: Process grouped Devices with classification
  Object.keys(devicesMap).forEach(function (entityId) {
    var entity = devicesMap[entityId];
    var cd = entity.collectedData;

    // Get classification attributes from collected data
    var deviceType = cd.deviceType || cd.type || '';
    var deviceProfile = cd.deviceProfile || cd.profile || '';
    var identifier = cd.identifier || cd.id || '';
    // Use label from collected data, fallback to entityLabel
    var deviceLabel = cd.label || entity.entityLabel || entityId;
    // Determine if device is online via connectionStatus attribute (values: 'online' | 'offline')
    var connectionStatus = (cd.connectionStatus || '').toLowerCase();
    var isOnline = connectionStatus === 'online';

    console.log(
      '[MAIN_BAS] Device "' +
        deviceLabel +
        '": ' +
        JSON.stringify({
          deviceType: deviceType,
          deviceProfile: deviceProfile,
          identifier: identifier,
          connectionStatus: connectionStatus,
          isOnline: isOnline,
          allKeys: Object.keys(cd),
        })
    );

    // Check if device is hidden/archived (RFC-0142)
    if (isOcultosDevice(deviceProfile)) {
      classified.ocultos.push({
        id: entityId,
        name: deviceLabel,
        deviceType: deviceType,
        deviceProfile: deviceProfile,
      });
      return;
    }

    // Detect domain and context
    var domain = detectDomain(deviceType);
    var context = detectContextForBAS(deviceType, deviceProfile, identifier, domain);

    // Build device object based on domain
    var device = {
      id: entityId,
      name: deviceLabel,
      deviceType: deviceType,
      deviceProfile: deviceProfile,
      domain: domain,
      context: context,
      status: isOnline ? 'online' : 'offline',
      lastUpdate: Date.now(),
      rawData: cd, // Keep collected data for reference
    };

    // Add domain-specific properties
    if (domain === 'water') {
      if (context === 'caixadagua') {
        device.value = parseFloat(cd.level || cd.waterLevel || 0);
        device.unit = '%';
        device.type = 'tank';
      } else if (context === 'solenoide') {
        var state = cd.state || cd.status;
        device.value = state === 'on' || state === true ? 1 : 0;
        device.unit = '';
        device.type = 'solenoid';
        device.status = state === 'on' || state === true ? 'online' : 'offline';
      } else {
        device.value = parseFloat(cd.consumption || cd.volume || cd.totalVolume || 0);
        device.unit = 'm3';
        device.type = 'hydrometer';
      }
    } else if (domain === 'temperature') {
      device.temperature = parseFloat(cd.temperature || cd.temp || 0) || null;
      device.setpoint = parseFloat(cd.setpoint || cd.setPoint || 0) || null;
      device.consumption = parseFloat(cd.consumption || 0) || null;
      device.status = isOnline ? 'active' : 'inactive';
    } else {
      // Energy domain (includes motors/pumps)
      device.consumption = parseFloat(cd.consumption || cd.energy || cd.power || 0);

      // Motors/pumps are energy domain with context 'bomba' or 'motor'
      if (context === 'bomba' || context === 'motor') {
        device.status = device.consumption > 0 ? 'running' : 'stopped';
        device.type = context === 'bomba' ? 'pump' : 'motor';
      }
    }

    // Add device to devices list
    devices.push(device);
    console.log('[MAIN_BAS] Added:', device.name, '| domain:', domain, '| context:', context);

    // Add to classified structure
    if (classified[domain] && classified[domain][context]) {
      classified[domain][context].push(device);
    } else {
      console.log('[MAIN_BAS] WARNING: No bucket for domain:', domain, 'context:', context);
    }
  });

  console.log('[MAIN_BAS] ============ PARSE COMPLETE ============');
  console.log('[MAIN_BAS] Ambientes:', ambientes.length);
  console.log('[MAIN_BAS] Devices:', devices.length);
  console.log('[MAIN_BAS] Classification:', {
    water: Object.keys(classified.water).map(function (k) {
      return k + ':' + classified.water[k].length;
    }),
    temperature: Object.keys(classified.temperature).map(function (k) {
      return k + ':' + classified.temperature[k].length;
    }),
    energy: Object.keys(classified.energy).map(function (k) {
      return k + ':' + classified.energy[k].length;
    }),
    ocultos: classified.ocultos.length,
  });

  return {
    classified: classified,
    ambientes: ambientes,
    devices: devices,
  };
}

/**
 * Icons for each ambiente by prefix code
 * Used to display visual indicators in EntityListPanel
 */
var AMBIENTE_ICONS = {
  '001': '🌊', // Deck
  '002': '⚡', // Sala do Nobreak
  '003': '🎤', // Auditório
  '004': '👥', // Staff Rio de Janeiro
  '005': '💧', // Bombas
  '006': '🚰', // Água
  '007': '⚙️', // Configuração
  '008': '🔗', // Integrações
};

/**
 * Extract prefix code from label (e.g., "(001)-Deck" -> "001")
 */
function getAmbientePrefixCode(label) {
  var match = String(label || '').match(/^\((\d{3})\)-/);
  return match ? match[1] : null;
}

/**
 * Get icon for an ambiente based on its label prefix
 */
function getAmbienteIcon(label) {
  var code = getAmbientePrefixCode(label);
  return code && AMBIENTE_ICONS[code] ? AMBIENTE_ICONS[code] : null;
}

/**
 * Map of action handlers per ambiente label pattern
 * Key is the label prefix (e.g., '(001)-Deck')
 * Value is a function that receives the ambiente object
 *
 * Labels:
 *   (001)-Deck
 *   (002)-Sala do Nobreak
 *   (003)-Auditório
 *   (004)-Staff Rio de Janeiro
 *   (005)-Bombas
 *   (006)-Água
 *   (007)-Configuração
 *   (008)-Integrações
 */
var AMBIENTE_ACTION_MAP = {
  '(001)-Deck': function (ambiente) {
    console.log('[MAIN_BAS] Action: Deck ->', ambiente.id);
    // Navigate to Deck dashboard state
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('deck', { entityId: ambiente.id });
    }
  },
  '(002)-Sala do Nobreak': function (ambiente) {
    console.log('[MAIN_BAS] Action: Sala do Nobreak ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('nobreak', { entityId: ambiente.id });
    }
  },
  '(003)-Auditório': function (ambiente) {
    console.log('[MAIN_BAS] Action: Auditório ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('auditorio', { entityId: ambiente.id });
    }
  },
  '(004)-Staff Rio de Janeiro': function (ambiente) {
    console.log('[MAIN_BAS] Action: Staff Rio de Janeiro ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('staff', { entityId: ambiente.id });
    }
  },
  '(005)-Bombas': function (ambiente) {
    console.log('[MAIN_BAS] Action: Bombas ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('bombas', { entityId: ambiente.id });
    }
  },
  '(006)-Água': function (ambiente) {
    console.log('[MAIN_BAS] Action: Água ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('agua', { entityId: ambiente.id });
    }
  },
  '(007)-Configuração': function (ambiente) {
    console.log('[MAIN_BAS] Action: Configuração ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('config', { entityId: ambiente.id });
    }
  },
  '(008)-Integrações': function (ambiente) {
    console.log('[MAIN_BAS] Action: Integrações ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('integracoes', { entityId: ambiente.id });
    }
  },
};

/**
 * Get action handler for an ambiente from the action map
 * Matches by label (e.g., '(001)-Deck') since that's what the map uses
 */
function getAmbienteActionHandler(ambiente) {
  var label = ambiente.name || ambiente.label || '';

  // Check exact label match first
  if (AMBIENTE_ACTION_MAP[label]) {
    return function () {
      AMBIENTE_ACTION_MAP[label](ambiente);
    };
  }

  // Check prefix patterns (keys ending with '-')
  for (var key in AMBIENTE_ACTION_MAP) {
    if (key.endsWith('-') && label.startsWith(key)) {
      return function () {
        AMBIENTE_ACTION_MAP[key](ambiente);
      };
    }
  }

  // Default: navigate to ThingsBoard state if stateController available
  if (self.ctx && self.ctx.stateController) {
    return function () {
      console.log('[MAIN_BAS] Navigate to ambiente:', ambiente.id, label);
      self.ctx.stateController.openState('ambiente', { entityId: ambiente.id, entityName: label });
    };
  }

  return undefined;
}

/**
 * Build EntityListPanel items from ambiente devices
 * Each device in the "Ambientes" datasource becomes a list item
 */
function buildAmbienteItems(ambientes) {
  return ambientes.map(function (ambiente) {
    var label = ambiente.name || ambiente.label || ambiente.id;
    return {
      id: ambiente.id,
      label: label,
      icon: getAmbienteIcon(label),
      handleActionClick: getAmbienteActionHandler(ambiente),
    };
  });
}

// ============================================================================
// Water device type/status mappings
// ============================================================================

var WATER_TYPE_MAP = {
  hydrometer: 'HIDROMETRO',
  cistern: 'CAIXA_DAGUA',
  tank: 'TANK',
  solenoid: 'BOMBA_HIDRAULICA',
};

var WATER_STATUS_MAP = {
  online: 'online',
  offline: 'offline',
  unknown: 'no_info',
};

/**
 * Convert a water device to an entityObject for renderCardComponentV6
 */
function waterDeviceToEntityObject(device) {
  var deviceType = WATER_TYPE_MAP[device.type] || 'HIDROMETRO';
  var deviceStatus = WATER_STATUS_MAP[device.status] || 'no_info';
  // Use rawData.identifier with fallback to 'Sem ID'
  var identifier = (device.rawData && device.rawData.identifier) || 'Sem ID';

  return {
    entityId: device.id,
    labelOrName: device.name,
    deviceIdentifier: identifier,
    deviceType: deviceType,
    val: device.value,
    deviceStatus: deviceStatus,
    perc: 0,
    waterLevel: device.type === 'tank' ? device.value : undefined,
    waterPercentage: device.type === 'tank' ? device.value / 100 : undefined,
  };
}

/**
 * Get all water devices from classified structure
 */
function getWaterDevicesFromClassified(classified) {
  if (!classified || !classified.water) return [];
  var water = classified.water;
  return [].concat(
    water.hidrometro_entrada || [],
    water.banheiros || [],
    water.hidrometro_area_comum || [],
    water.hidrometro || [],
    water.caixadagua || [],
    water.solenoide || []
  );
}

/**
 * Get all HVAC devices from classified structure
 */
function getHVACDevicesFromClassified(classified) {
  if (!classified || !classified.temperature) return [];
  var temp = classified.temperature;
  return [].concat(temp.termostato || [], temp.termostato_external || []);
}

/**
 * Get all energy equipment devices from classified structure
 * Energy domain contexts: entrada, stores, equipments (+ bomba, motor)
 * For the Energia panel, we show: entrada, stores, equipments
 */
function getEnergyEquipmentDevicesFromClassified(classified) {
  if (!classified || !classified.energy) return [];
  var energy = classified.energy;
  return [].concat(energy.entrada || [], energy.stores || [], energy.equipments || []);
}

/**
 * Build CardGridPanel items from water devices
 * @param {Object} classified - Classified device structure
 * @param {string|null} selectedAmbienteId - ID of selected ambiente to filter, or null for all
 */
function buildWaterCardItems(classified, selectedAmbienteId) {
  var waterDevices = getWaterDevicesFromClassified(classified);
  var filtered = waterDevices;
  if (selectedAmbienteId) {
    filtered = waterDevices.filter(function (d) {
      return d.id === selectedAmbienteId;
    });
  }

  return filtered.map(function (device) {
    return {
      id: device.id,
      entityObject: waterDeviceToEntityObject(device),
      source: device,
    };
  });
}

// ============================================================================
// HVAC device type/status mappings
// ============================================================================

var HVAC_STATUS_MAP = {
  active: 'online',
  inactive: 'offline',
  no_reading: 'no_info',
};

/**
 * Convert an HVAC device to an entityObject for renderCardComponentV6
 */
function hvacDeviceToEntityObject(device) {
  var deviceStatus = HVAC_STATUS_MAP[device.status] || 'no_info';
  // Use rawData.identifier with fallback to 'Sem ID'
  var identifier = (device.rawData && device.rawData.identifier) || 'Sem ID';

  return {
    entityId: device.id,
    labelOrName: device.name,
    deviceIdentifier: identifier,
    deviceType: 'TERMOSTATO',
    val: device.temperature != null ? device.temperature : 0,
    deviceStatus: deviceStatus,
    perc: 0,
    temperature: device.temperature,
    temperatureMin: device.setpoint ? device.setpoint - 2 : 18,
    temperatureMax: device.setpoint ? device.setpoint + 2 : 26,
    consumption: device.consumption,
  };
}

/**
 * Build CardGridPanel items from HVAC devices
 * @param {Object} classified - Classified device structure
 * @param {string|null} selectedAmbienteId - ID of selected ambiente to filter, or null for all
 */
function buildHVACCardItems(classified, selectedAmbienteId) {
  var hvacDevices = getHVACDevicesFromClassified(classified);
  var filtered = hvacDevices;
  if (selectedAmbienteId) {
    filtered = hvacDevices.filter(function (d) {
      return d.id === selectedAmbienteId;
    });
  }

  return filtered.map(function (device) {
    return {
      id: device.id,
      entityObject: hvacDeviceToEntityObject(device),
      source: device,
    };
  });
}

// ============================================================================
// Energy device type/status mappings
// ============================================================================

var ENERGY_TYPE_MAP = {
  entrada: 'ENTRADA',
  store: '3F_MEDIDOR',
  equipment: '3F_MEDIDOR',
};

var ENERGY_STATUS_MAP = {
  online: 'online',
  offline: 'offline',
  no_info: 'no_info',
};

/**
 * Convert an energy device to an entityObject for renderCardComponentV6
 * Uses library's isEntradaDevice, isStoreDevice, isEquipmentDevice for classification
 */
function energyDeviceToEntityObject(device) {
  var deviceType = device.deviceType || '3F_MEDIDOR';
  var deviceStatus = ENERGY_STATUS_MAP[device.status] || 'no_info';
  // Use rawData.identifier with fallback to 'Sem ID'
  var identifier = (device.rawData && device.rawData.identifier) || 'Sem ID';

  // Determine category for display
  var category = 'equipment';
  if (device.context === 'entrada') {
    category = 'entrada';
    deviceType = device.deviceType || 'ENTRADA';
  } else if (device.context === 'stores') {
    category = 'store';
  }

  return {
    entityId: device.id,
    labelOrName: device.name,
    deviceIdentifier: identifier,
    deviceType: deviceType,
    val: device.consumption,
    deviceStatus: deviceStatus,
    perc: 0,
    category: category,
  };
}

/**
 * Build CardGridPanel items from energy equipment devices
 * Shows: entrada, stores, equipments
 * @param {Object} classified - Classified device structure
 * @param {string|null} selectedAmbienteId - ID of selected ambiente to filter, or null for all
 */
function buildEnergyCardItems(classified, selectedAmbienteId) {
  var energyDevices = getEnergyEquipmentDevicesFromClassified(classified);
  var filtered = energyDevices;
  if (selectedAmbienteId) {
    filtered = energyDevices.filter(function (d) {
      return d.id === selectedAmbienteId;
    });
  }

  return filtered.map(function (device) {
    return {
      id: device.id,
      entityObject: energyDeviceToEntityObject(device),
      source: device,
    };
  });
}

// ============================================================================
// Maximize overlay state
// ============================================================================

let _maximizeOverlay = null;
let _maximizedPanel = null;

// Theme colors for maximize modal
var MAXIMIZE_THEME = {
  light: {
    overlayBg: 'rgba(255, 255, 255, 0.85)',
    panelBg: '#ffffff',
    panelShadow: '0 25px 80px rgba(0, 0, 0, 0.2)',
    panelBorder: '1px solid #e2e8f0',
    closeBtnBg: 'rgba(0, 0, 0, 0.05)',
    closeBtnBgHover: 'rgba(0, 0, 0, 0.1)',
    closeBtnColor: '#475569',
  },
  dark: {
    overlayBg: 'rgba(0, 0, 0, 0.75)',
    panelBg: '#1a1f2e',
    panelShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
    panelBorder: '1px solid rgba(255, 255, 255, 0.1)',
    closeBtnBg: 'rgba(255, 255, 255, 0.1)',
    closeBtnBgHover: 'rgba(255, 255, 255, 0.2)',
    closeBtnColor: '#e2e8f0',
  },
};

/**
 * Get current theme mode (default: light)
 */
function getMaximizeTheme() {
  var mode = (_settings && _settings.defaultThemeMode) || 'light';
  return MAXIMIZE_THEME[mode] || MAXIMIZE_THEME.light;
}

/**
 * Create maximize overlay with blur background
 */
function createMaximizeOverlay() {
  if (_maximizeOverlay) return _maximizeOverlay;

  var theme = getMaximizeTheme();

  var overlay = document.createElement('div');
  overlay.className = 'bas-maximize-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: ${theme.overlayBg};
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  `;

  // Close on overlay click (outside content)
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      closeMaximizedPanel();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && _maximizedPanel) {
      closeMaximizedPanel();
    }
  });

  document.body.appendChild(overlay);
  _maximizeOverlay = overlay;
  return overlay;
}

/**
 * Show panel in maximized mode with blur background
 * Supports light/dark theme based on settings.defaultThemeMode (default: light)
 *
 * @param {HTMLElement} panelElement - The panel to maximize
 * @param {string} panelTitle - Title for debugging
 * @param {Object} options - Additional options
 * @param {boolean} options.isChart - If true, recreate chart instead of cloning canvas
 * @param {string} options.chartDomain - Chart domain for recreating (energy|water|temperature)
 */
function showMaximizedPanel(panelElement, panelTitle, options) {
  var opts = options || {};
  var theme = getMaximizeTheme();

  // Recreate overlay with current theme
  if (_maximizeOverlay) {
    _maximizeOverlay.remove();
    _maximizeOverlay = null;
  }
  var overlay = createMaximizeOverlay();

  // Create panel container
  var panelContainer = document.createElement('div');
  panelContainer.className = 'bas-maximize-panel';
  panelContainer.style.cssText = `
    width: 90vw;
    height: 85vh;
    max-width: 1400px;
    max-height: 900px;
    background: ${theme.panelBg};
    border-radius: 16px;
    box-shadow: ${theme.panelShadow};
    border: ${theme.panelBorder};
    overflow: hidden;
    transform: scale(0.95);
    transition: transform 0.2s ease;
    position: relative;
    display: flex;
    flex-direction: column;
  `;

  // For charts, we need to recreate the structure instead of cloning
  if (opts.isChart) {
    // Clone header only
    var originalHeader = panelElement.querySelector('.bas-chart-header');
    if (originalHeader) {
      var headerClone = originalHeader.cloneNode(true);
      headerClone.style.flexShrink = '0';

      // Re-bind tab click handlers
      var tabs = headerClone.querySelectorAll('.bas-chart-tab');
      tabs.forEach(function (tab) {
        var newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        newTab.addEventListener('click', function () {
          var domain = newTab.dataset.domain;
          if (!domain) return;

          // Update active state in header
          headerClone.querySelectorAll('.bas-chart-tab').forEach(function (t) {
            t.classList.remove('bas-chart-tab--active');
          });
          newTab.classList.add('bas-chart-tab--active');

          // Recreate chart with new domain
          var chartArea = panelContainer.querySelector('.bas-maximize-chart-area');
          if (chartArea) {
            switchChartDomainInContainer(domain, chartArea);
          }
        });
      });

      panelContainer.appendChild(headerClone);
    }

    // Create new chart area
    var chartArea = document.createElement('div');
    chartArea.className = 'bas-maximize-chart-area';
    chartArea.style.cssText = `
      flex: 1;
      min-height: 0;
      padding: 16px;
      background: ${(_settings && _settings.chartPanelBackground) || '#ffffff'};
      border-radius: 0 0 12px 12px;
      overflow: hidden;
    `;
    panelContainer.appendChild(chartArea);

    // Create a separate chart instance for the maximized view
    var chartDomain = opts.chartDomain || _currentChartDomain;
    switchChartDomainInContainer(chartDomain, chartArea);
  } else {
    // Standard panel - just clone
    var clone = panelElement.cloneNode(true);
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.maxWidth = 'none';
    clone.style.maxHeight = 'none';
    panelContainer.appendChild(clone);
  }

  // Add close button
  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    border: none;
    background: ${theme.closeBtnBg};
    color: ${theme.closeBtnColor};
    font-size: 24px;
    line-height: 1;
    border-radius: 8px;
    cursor: pointer;
    z-index: 10;
    transition: background 0.15s ease;
  `;
  closeBtn.addEventListener('mouseenter', function () {
    closeBtn.style.background = theme.closeBtnBgHover;
  });
  closeBtn.addEventListener('mouseleave', function () {
    closeBtn.style.background = theme.closeBtnBg;
  });
  closeBtn.addEventListener('click', closeMaximizedPanel);
  panelContainer.appendChild(closeBtn);

  // Wrap in container for positioning
  var container = document.createElement('div');
  container.style.cssText =
    'position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;';
  container.appendChild(panelContainer);

  overlay.innerHTML = '';
  overlay.appendChild(container);

  // Show overlay with animation
  overlay.style.pointerEvents = 'auto';
  window.requestAnimationFrame(function () {
    overlay.style.opacity = '1';
    panelContainer.style.transform = 'scale(1)';
  });

  _maximizedPanel = { overlay: overlay, panel: panelContainer, title: panelTitle, isChart: opts.isChart };

  if (_settings && _settings.enableDebugMode) {
    console.log(
      '[MAIN_BAS] Panel maximized:',
      panelTitle,
      '| theme:',
      (_settings && _settings.defaultThemeMode) || 'light',
      '| isChart:',
      !!opts.isChart
    );
  }
}

/**
 * Create a chart instance in a specific container (for maximized view)
 */
var _maximizedChartInstance = null;

function switchChartDomainInContainer(domain, container) {
  // Destroy existing maximized chart
  if (_maximizedChartInstance) {
    _maximizedChartInstance.destroy();
    _maximizedChartInstance = null;
  }

  // Clear container and create canvas
  container.innerHTML = '';
  var canvas = document.createElement('canvas');
  canvas.id = 'bas-chart-canvas-maximized';
  canvas.style.cssText = 'width: 100%; height: 100%;';
  container.appendChild(canvas);

  var cfg = CHART_DOMAIN_CONFIG[domain];
  if (!cfg) return;

  if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.createConsumption7DaysChart) {
    if (_settings && _settings.enableDebugMode) {
      console.warn('[MAIN_BAS] MyIOLibrary.createConsumption7DaysChart not available');
    }
    return;
  }

  _maximizedChartInstance = MyIOLibrary.createConsumption7DaysChart({
    domain: domain,
    containerId: 'bas-chart-canvas-maximized',
    unit: cfg.unit,
    unitLarge: cfg.unitLarge,
    thresholdForLargeUnit: cfg.threshold,
    fetchData: createMockFetchData(domain),
    defaultPeriod: 7,
    defaultChartType: domain === 'temperature' ? 'line' : 'bar',
    theme: (_settings && _settings.defaultThemeMode) || 'dark',
    showLegend: true,
    fill: domain === 'temperature',
  });

  _maximizedChartInstance.render();
}

/**
 * Close maximized panel view
 */
function closeMaximizedPanel() {
  if (!_maximizedPanel || !_maximizeOverlay) return;

  _maximizeOverlay.style.opacity = '0';
  _maximizeOverlay.style.pointerEvents = 'none';

  // Clean up maximized chart instance
  if (_maximizedChartInstance) {
    _maximizedChartInstance.destroy();
    _maximizedChartInstance = null;
  }

  setTimeout(function () {
    _maximizeOverlay.innerHTML = '';
    _maximizedPanel = null;
  }, 200);

  if (_settings && _settings.enableDebugMode) {
    console.log('[MAIN_BAS] Panel minimize');
  }
}

// ============================================================================
// Filter modal state
// ============================================================================

let _activeFilterModal = null;

/**
 * Open filter modal for a panel
 * Uses the new FilterModalComponent for category-based filtering
 */
function openFilterModal(panelType, devices, currentFilter, onApply) {
  // Close any existing modal
  if (_activeFilterModal) {
    _activeFilterModal.destroy();
    _activeFilterModal = null;
  }

  if (!MyIOLibrary.FilterModalComponent) {
    console.warn('[MAIN_BAS] MyIOLibrary.FilterModalComponent not available');
    return;
  }

  // Build categories based on panel type
  var categories = [];
  var sortOptions = [];

  if (panelType === 'water') {
    // Water categories by device type
    var hidroCount = devices.filter(function (d) {
      return d.type === 'hydrometer';
    }).length;
    var tankCount = devices.filter(function (d) {
      return d.type === 'tank';
    }).length;
    var solenoidCount = devices.filter(function (d) {
      return d.type === 'solenoid';
    }).length;

    categories = [
      { id: 'HIDROMETRO', label: 'Hidrômetros', icon: '💧', count: hidroCount, selected: true },
      { id: 'CAIXA_DAGUA', label: "Caixas d'Água", icon: '🛢️', count: tankCount, selected: true },
      { id: 'SOLENOIDE', label: 'Solenoides', icon: '🔌', count: solenoidCount, selected: true },
    ];
    sortOptions = MyIOLibrary.WATER_SORT_OPTIONS || [];
  } else if (panelType === 'hvac') {
    // HVAC categories
    var thermostatCount = devices.filter(function (d) {
      return d.context === 'termostato';
    }).length;
    var externalCount = devices.filter(function (d) {
      return d.context === 'termostato_external';
    }).length;

    categories = [
      { id: 'termostato', label: 'Termostatos', icon: '🌡️', count: thermostatCount, selected: true },
      {
        id: 'termostato_external',
        label: 'Sensores Externos',
        icon: '📡',
        count: externalCount,
        selected: true,
      },
    ];
    sortOptions = MyIOLibrary.TEMPERATURE_SORT_OPTIONS || [];
  } else if (panelType === 'energy') {
    // Energy categories: entrada, stores, equipments
    var entradaCount = devices.filter(function (d) {
      return d.context === 'entrada';
    }).length;
    var storesCount = devices.filter(function (d) {
      return d.context === 'stores';
    }).length;
    var equipmentsCount = devices.filter(function (d) {
      return d.context === 'equipments';
    }).length;

    categories = [
      { id: 'entrada', label: 'Entradas', icon: '📥', count: entradaCount, selected: true },
      { id: 'stores', label: 'Lojas', icon: '🏬', count: storesCount, selected: true },
      { id: 'equipments', label: 'Equipamentos', icon: '⚙️', count: equipmentsCount, selected: true },
    ];
    sortOptions = MyIOLibrary.ENERGY_SORT_OPTIONS || [];
  }

  // Remove empty categories
  categories = categories.filter(function (c) {
    return c.count > 0;
  });

  if (categories.length === 0) {
    console.log('[MAIN_BAS] No categories to filter');
    return;
  }

  var modal = new MyIOLibrary.FilterModalComponent({
    title: 'Filtrar ' + (panelType === 'water' ? 'Água' : panelType === 'hvac' ? 'Ambientes' : 'Energia'),
    icon: panelType === 'water' ? '💧' : panelType === 'hvac' ? '🌡️' : '⚡',
    categories: categories,
    sortOptions: sortOptions,
    selectedSortId: currentFilter?.sortId || null,
    themeMode: (_settings && _settings.defaultThemeMode) || 'light',
    onApply: function (selectedCategories, sortOption) {
      if (_settings && _settings.enableDebugMode) {
        console.log('[MAIN_BAS] Filter applied:', {
          panelType: panelType,
          categories: selectedCategories,
          sort: sortOption,
        });
      }
      onApply(selectedCategories, sortOption);
    },
    onClose: function () {
      _activeFilterModal = null;
    },
  });

  modal.show();
  _activeFilterModal = modal;
}

// ============================================================================
// Panel mount functions
// ============================================================================

/**
 * Mount CardGridPanel into #bas-water-host
 */
function mountWaterPanel(waterHost, settings, classified) {
  console.log('[MAIN_BAS] mountWaterPanel called, CardGridPanel available:', !!MyIOLibrary.CardGridPanel);
  if (!MyIOLibrary.CardGridPanel) {
    console.warn('[MAIN_BAS] MyIOLibrary.CardGridPanel not available');
    return null;
  }

  var waterItems = buildWaterCardItems(classified, null);
  var waterDevices = getWaterDevicesFromClassified(classified);
  var currentFilter = { categories: null, sortId: null };

  var panel = new MyIOLibrary.CardGridPanel({
    title: 'Infraestrutura Hidrica',
    icon: '💧',
    quantity: waterItems.length,
    items: waterItems,
    panelBackground: settings.waterPanelBackground,
    cardCustomStyle: settings.cardCustomStyle || { height: '90px' },
    titleStyle: {
      fontSize: '0.7rem',
      fontWeight: '600',
      padding: '8px 12px 6px 12px',
      letterSpacing: '0.5px',
    },
    gridMinCardWidth: '180px',
    gridGap: settings.cardGridGap,
    emptyMessage: 'Nenhum dispositivo',
    showSearch: true,
    searchPlaceholder: 'Buscar...',
    showFilter: true,
    showMaximize: true,
    handleActionFilter: function () {
      openFilterModal('water', waterDevices, currentFilter, function (selectedCategories, sortOption) {
        currentFilter.categories = selectedCategories;
        currentFilter.sortId = sortOption ? sortOption.id : null;
        // Filter and sort items
        var filteredItems = buildWaterCardItems(classified, _selectedAmbiente).filter(function (item) {
          if (!selectedCategories || selectedCategories.length === 0) return true;
          var deviceType = item.source?.type || '';
          var typeMap = { hydrometer: 'HIDROMETRO', tank: 'CAIXA_DAGUA', solenoid: 'SOLENOIDE' };
          return selectedCategories.includes(typeMap[deviceType] || deviceType.toUpperCase());
        });
        if (sortOption) {
          filteredItems.sort(function (a, b) {
            var valA = a.source?.[sortOption.field] || a.source?.value || 0;
            var valB = b.source?.[sortOption.field] || b.source?.value || 0;
            if (sortOption.field === 'label') {
              valA = a.source?.name || '';
              valB = b.source?.name || '';
              return sortOption.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortOption.direction === 'desc' ? valB - valA : valA - valB;
          });
        }
        panel.setItems(filteredItems);
        panel.setQuantity(filteredItems.length);
      });
    },
    onMaximizeToggle: function (isMaximized) {
      if (isMaximized) {
        showMaximizedPanel(panel.getElement(), 'Infraestrutura Hidrica');
      } else {
        closeMaximizedPanel();
      }
    },
    handleClickCard: function (item) {
      if (settings.enableDebugMode) {
        console.log('[MAIN_BAS] Water device clicked:', item.source);
      }
      window.dispatchEvent(new CustomEvent('bas:device-clicked', { detail: { device: item.source } }));
    },
  });

  waterHost.appendChild(panel.getElement());
  return panel;
}

/**
 * Mount CardGridPanel into #bas-ambientes-host (HVAC devices)
 */
function mountAmbientesPanel(host, settings, classified) {
  console.log('[MAIN_BAS] mountAmbientesPanel called, CardGridPanel available:', !!MyIOLibrary.CardGridPanel);
  if (!MyIOLibrary.CardGridPanel) {
    console.warn('[MAIN_BAS] MyIOLibrary.CardGridPanel not available');
    return null;
  }

  var hvacItems = buildHVACCardItems(classified, null);
  var hvacDevices = getHVACDevicesFromClassified(classified);
  var currentFilter = { categories: null, sortId: null };

  var panel = new MyIOLibrary.CardGridPanel({
    title: settings.environmentsLabel,
    icon: '🌡️',
    quantity: hvacItems.length,
    items: hvacItems,
    panelBackground: settings.environmentsPanelBackground,
    cardCustomStyle: settings.cardCustomStyle || { height: '90px' },
    titleStyle: {
      fontSize: '0.7rem',
      fontWeight: '600',
      padding: '8px 12px 6px 12px',
      letterSpacing: '0.5px',
    },
    gridMinCardWidth: '140px',
    gridGap: settings.cardGridGap,
    emptyMessage: 'Nenhum ambiente',
    showSearch: true,
    searchPlaceholder: 'Buscar...',
    showFilter: true,
    showMaximize: true,
    handleActionFilter: function () {
      openFilterModal('hvac', hvacDevices, currentFilter, function (selectedCategories, sortOption) {
        currentFilter.categories = selectedCategories;
        currentFilter.sortId = sortOption ? sortOption.id : null;
        // Filter and sort items
        var filteredItems = buildHVACCardItems(classified, _selectedAmbiente).filter(function (item) {
          if (!selectedCategories || selectedCategories.length === 0) return true;
          var context = item.source?.context || '';
          return selectedCategories.includes(context);
        });
        if (sortOption) {
          filteredItems.sort(function (a, b) {
            var valA, valB;
            if (sortOption.field === 'label') {
              valA = a.source?.name || '';
              valB = b.source?.name || '';
              return sortOption.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            valA = a.source?.[sortOption.field] || a.source?.temperature || 0;
            valB = b.source?.[sortOption.field] || b.source?.temperature || 0;
            return sortOption.direction === 'desc' ? valB - valA : valA - valB;
          });
        }
        panel.setItems(filteredItems);
        panel.setQuantity(filteredItems.length);
      });
    },
    onMaximizeToggle: function (isMaximized) {
      if (isMaximized) {
        showMaximizedPanel(panel.getElement(), settings.environmentsLabel);
      } else {
        closeMaximizedPanel();
      }
    },
    handleClickCard: function (item) {
      if (settings.enableDebugMode) {
        console.log('[MAIN_BAS] HVAC device clicked:', item.source);
      }
      window.dispatchEvent(new CustomEvent('bas:device-clicked', { detail: { device: item.source } }));
    },
  });

  host.appendChild(panel.getElement());
  return panel;
}

/**
 * Mount CardGridPanel into #bas-motors-host (Energy: entrada, stores, equipments)
 */
function mountEnergyPanel(host, settings, classified) {
  console.log('[MAIN_BAS] mountEnergyPanel called, CardGridPanel available:', !!MyIOLibrary.CardGridPanel);
  if (!MyIOLibrary.CardGridPanel) {
    console.warn('[MAIN_BAS] MyIOLibrary.CardGridPanel not available');
    return null;
  }

  var energyItems = buildEnergyCardItems(classified, null);
  var energyDevices = getEnergyEquipmentDevicesFromClassified(classified);
  var currentFilter = { categories: null, sortId: null };

  // Use 'Energia' as default label if pumpsMotorsLabel is the old default
  var panelLabel = settings.pumpsMotorsLabel;
  if (panelLabel === 'Bombas e Motores') {
    panelLabel = 'Energia';
  }

  var panel = new MyIOLibrary.CardGridPanel({
    title: panelLabel,
    icon: '⚡',
    quantity: energyItems.length,
    items: energyItems,
    panelBackground: settings.motorsPanelBackground,
    cardCustomStyle: settings.cardCustomStyle || { height: '90px' },
    titleStyle: {
      fontSize: '0.7rem',
      fontWeight: '600',
      padding: '8px 12px 6px 12px',
      letterSpacing: '0.5px',
    },
    gridMinCardWidth: '140px',
    gridGap: settings.cardGridGap,
    emptyMessage: 'Nenhum equipamento',
    showSearch: true,
    searchPlaceholder: 'Buscar...',
    showFilter: true,
    showMaximize: true,
    handleActionFilter: function () {
      openFilterModal('energy', energyDevices, currentFilter, function (selectedCategories, sortOption) {
        currentFilter.categories = selectedCategories;
        currentFilter.sortId = sortOption ? sortOption.id : null;
        // Filter and sort items
        var filteredItems = buildEnergyCardItems(classified, _selectedAmbiente).filter(function (item) {
          if (!selectedCategories || selectedCategories.length === 0) return true;
          var context = item.source?.context || '';
          return selectedCategories.includes(context);
        });
        if (sortOption) {
          filteredItems.sort(function (a, b) {
            var valA, valB;
            if (sortOption.field === 'label') {
              valA = a.source?.name || '';
              valB = b.source?.name || '';
              return sortOption.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            valA = a.source?.[sortOption.field] || a.source?.consumption || 0;
            valB = b.source?.[sortOption.field] || b.source?.consumption || 0;
            return sortOption.direction === 'desc' ? valB - valA : valA - valB;
          });
        }
        panel.setItems(filteredItems);
        panel.setQuantity(filteredItems.length);
      });
    },
    onMaximizeToggle: function (isMaximized) {
      if (isMaximized) {
        showMaximizedPanel(panel.getElement(), panelLabel);
      } else {
        closeMaximizedPanel();
      }
    },
    handleClickCard: function (item) {
      if (settings.enableDebugMode) {
        console.log('[MAIN_BAS] Energy device clicked:', item.source);
      }
      window.dispatchEvent(new CustomEvent('bas:device-clicked', { detail: { device: item.source } }));
    },
  });

  host.appendChild(panel.getElement());
  return panel;
}

/**
 * Mount EntityListPanel into #bas-sidebar-host
 * Displays list of ambientes from datasource
 */
function mountSidebarPanel(sidebarHost, settings, ambientes) {
  // DEBUG: Log sidebar host dimensions
  console.log('[MAIN_BAS] mountSidebarPanel called');
  console.log('[MAIN_BAS] sidebarHost element:', sidebarHost);
  console.log('[MAIN_BAS] sidebarHost dimensions:', {
    offsetHeight: sidebarHost?.offsetHeight,
    offsetWidth: sidebarHost?.offsetWidth,
    clientHeight: sidebarHost?.clientHeight,
    clientWidth: sidebarHost?.clientWidth,
    style: sidebarHost?.style?.cssText,
    computedHeight: sidebarHost ? window.getComputedStyle(sidebarHost).height : null,
    computedGridRow: sidebarHost ? window.getComputedStyle(sidebarHost).gridRow : null,
  });
  console.log('[MAIN_BAS] ambientes count:', ambientes?.length);
  console.log('[MAIN_BAS] ambientes data:', ambientes);

  if (!MyIOLibrary.EntityListPanel) {
    console.warn('[MAIN_BAS] MyIOLibrary.EntityListPanel not available');
    return null;
  }

  var items = buildAmbienteItems(ambientes);
  console.log('[MAIN_BAS] Built ambiente items:', items);

  var panel = new MyIOLibrary.EntityListPanel({
    title: settings.sidebarLabel,
    icon: '📍',
    quantity: items.length,
    subtitle: 'Nome \u2191',
    items: items,
    panelBackground: settings.sidebarBackground,
    backgroundImage: settings.sidebarBackgroundImage || undefined,
    searchPlaceholder: 'Buscar...',
    selectedId: null,
    showAllOption: true,
    allLabel: 'HOME',
    sortOrder: 'asc',
    excludePartOfLabel: '^\\(\\d{3}\\)-\\s*', // Remove (001)- prefix from labels
    titleStyle: { fontSize: '0.7rem', fontWeight: '600', padding: '8px 12px 0 12px', letterSpacing: '0.5px' },
    showFilter: true,
    showMaximize: true,
    onMaximizeToggle: function (isMaximized) {
      if (isMaximized) {
        showMaximizedPanel(panel.getElement(), settings.sidebarLabel);
      } else {
        closeMaximizedPanel();
      }
    },
    handleClickAll: function () {
      console.log('[MAIN_BAS] Ambiente selected: all');
      _selectedAmbiente = null;
      if (_waterPanel) {
        _waterPanel.setItems(buildWaterCardItems(_currentClassified, null));
      }
      if (_ambientesPanel) {
        _ambientesPanel.setItems(buildHVACCardItems(_currentClassified, null));
      }
      if (_motorsPanel) {
        _motorsPanel.setItems(buildEnergyCardItems(_currentClassified, null));
      }
      if (panel) panel.setSelectedId(null);
      window.dispatchEvent(new CustomEvent('bas:ambiente-changed', { detail: { ambiente: null } }));
    },
    handleClickItem: function (item) {
      console.log('[MAIN_BAS] Ambiente selected:', item.id, item.label);
      _selectedAmbiente = item.id;
      if (_waterPanel) {
        _waterPanel.setItems(buildWaterCardItems(_currentClassified, item.id));
      }
      if (_ambientesPanel) {
        _ambientesPanel.setItems(buildHVACCardItems(_currentClassified, item.id));
      }
      if (_motorsPanel) {
        _motorsPanel.setItems(buildEnergyCardItems(_currentClassified, item.id));
      }
      if (panel) panel.setSelectedId(item.id);
      window.dispatchEvent(new CustomEvent('bas:ambiente-changed', { detail: { ambiente: item.id } }));
    },
  });

  var panelElement = panel.getElement();
  console.log('[MAIN_BAS] Panel element created:', panelElement);

  sidebarHost.appendChild(panelElement);

  // DEBUG: Log after append
  setTimeout(function () {
    console.log('[MAIN_BAS] After append - sidebarHost dimensions:', {
      offsetHeight: sidebarHost?.offsetHeight,
      offsetWidth: sidebarHost?.offsetWidth,
      scrollHeight: sidebarHost?.scrollHeight,
    });
    console.log('[MAIN_BAS] After append - panelElement dimensions:', {
      offsetHeight: panelElement?.offsetHeight,
      offsetWidth: panelElement?.offsetWidth,
      scrollHeight: panelElement?.scrollHeight,
    });
  }, 100);

  return panel;
}

// ============================================================================
// Chart functions
// ============================================================================

/**
 * Generate mock fetchData for a given chart domain
 */
function createMockFetchData(domain) {
  return function fetchData(period) {
    var labels = [];
    var values = [];
    var now = new Date();

    for (var i = period - 1; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

      if (domain === 'energy') {
        values.push(Math.random() * 800 + 200);
      } else if (domain === 'water') {
        values.push(Math.random() * 50 + 10);
      } else {
        values.push(Math.random() * 8 + 18);
      }
    }

    return Promise.resolve({
      labels: labels,
      dailyTotals: values,
    });
  };
}

/**
 * Switch chart to a different domain — destroys old chart + creates fresh canvas
 */
function switchChartDomain(domain, chartContainer) {
  // Destroy existing chart
  if (_chartInstance) {
    _chartInstance.destroy();
    _chartInstance = null;
  }

  _currentChartDomain = domain;

  // Replace canvas (Chart.js needs a fresh canvas)
  chartContainer.innerHTML = '';
  var canvas = document.createElement('canvas');
  canvas.id = 'bas-chart-canvas';
  chartContainer.appendChild(canvas);

  var cfg = CHART_DOMAIN_CONFIG[domain];
  if (!cfg) return;

  if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.createConsumption7DaysChart) {
    if (_settings && _settings.enableDebugMode) {
      console.warn('[MAIN_BAS] MyIOLibrary.createConsumption7DaysChart not available');
    }
    return;
  }

  _chartInstance = MyIOLibrary.createConsumption7DaysChart({
    domain: domain,
    containerId: 'bas-chart-canvas',
    unit: cfg.unit,
    unitLarge: cfg.unitLarge,
    thresholdForLargeUnit: cfg.threshold,
    fetchData: createMockFetchData(domain),
    defaultPeriod: 7,
    defaultChartType: domain === 'temperature' ? 'line' : 'bar',
    theme: (_settings && _settings.defaultThemeMode) || 'dark',
    showLegend: true,
    fill: domain === 'temperature',
  });

  _chartInstance.render();
}

// SVG icons for chart header buttons
var CHART_ICON_FILTER = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
var CHART_ICON_MAXIMIZE = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

/**
 * Mount chart panel with header (tabs + actions) + chart container
 */
function mountChartPanel(hostEl, settings) {
  if (!hostEl) return;

  var domains = ['energy', 'water', 'temperature'];

  // Create panel wrapper
  var panelWrapper = document.createElement('div');
  panelWrapper.className = 'bas-chart-panel';

  // Build header with tabs and action buttons
  var header = document.createElement('div');
  header.className = 'bas-chart-header';

  // Left side: Icon + Title
  var headerLeft = document.createElement('div');
  headerLeft.className = 'bas-chart-header__left';
  headerLeft.innerHTML = '<span class="bas-chart-header__icon">📊</span><span class="bas-chart-header__title">Consumo</span>';

  // Center: Tabs
  var tabBar = document.createElement('div');
  tabBar.className = 'bas-chart-tabs';

  domains.forEach(function (domain) {
    var btn = document.createElement('button');
    btn.className = 'bas-chart-tab' + (domain === _currentChartDomain ? ' bas-chart-tab--active' : '');
    btn.textContent = CHART_DOMAIN_CONFIG[domain].label;
    btn.dataset.domain = domain;
    btn.addEventListener('click', function () {
      // Update active tab
      var allTabs = tabBar.querySelectorAll('.bas-chart-tab');
      allTabs.forEach(function (t) {
        t.classList.remove('bas-chart-tab--active');
      });
      btn.classList.add('bas-chart-tab--active');

      // Switch chart
      switchChartDomain(domain, chartCard);
    });
    tabBar.appendChild(btn);
  });

  // Right side: Action buttons (Filter + Maximize)
  var headerRight = document.createElement('div');
  headerRight.className = 'bas-chart-header__actions';

  // Filter button
  var filterBtn = document.createElement('button');
  filterBtn.className = 'bas-chart-header__btn';
  filterBtn.title = 'Filtrar';
  filterBtn.innerHTML = CHART_ICON_FILTER;
  filterBtn.addEventListener('click', function () {
    // Open chart filter modal (period selection, chart type, etc.)
    if (_settings && _settings.enableDebugMode) {
      console.log('[MAIN_BAS] Chart filter clicked');
    }
    // TODO: Implement chart-specific filter modal
  });
  headerRight.appendChild(filterBtn);

  // Maximize button
  var maxBtn = document.createElement('button');
  maxBtn.className = 'bas-chart-header__btn';
  maxBtn.title = 'Maximizar';
  maxBtn.innerHTML = CHART_ICON_MAXIMIZE;
  maxBtn.addEventListener('click', function () {
    showMaximizedPanel(panelWrapper, 'Consumo', { isChart: true, chartDomain: _currentChartDomain });
  });
  headerRight.appendChild(maxBtn);

  // Assemble header
  header.appendChild(headerLeft);
  header.appendChild(tabBar);
  header.appendChild(headerRight);

  // Build chart card container
  var chartCard = document.createElement('div');
  chartCard.className = 'bas-chart-card';

  // Apply chart panel background
  if (settings && settings.chartPanelBackground) {
    chartCard.style.backgroundColor = settings.chartPanelBackground;
  }

  // Assemble panel
  panelWrapper.appendChild(header);
  panelWrapper.appendChild(chartCard);
  hostEl.appendChild(panelWrapper);

  // Render default domain chart
  switchChartDomain(_currentChartDomain, chartCard);
}

// ============================================================================
// Dashboard initialization
// ============================================================================

/**
 * Show error state
 */
function showError(container, message) {
  container.innerHTML =
    '<div class="bas-dashboard-error"><div class="error-icon">!</div><div class="error-message">' +
    message +
    '</div></div>';
}

/**
 * Initialize the BAS dashboard — mounts all 5 panels into their grid slots
 */
async function initializeDashboard(
  ctx,
  sidebarHost,
  waterHost,
  chartsHost,
  ambientesHost,
  motorsHost,
  settings
) {
  try {
    // DEBUG: Log raw data from ThingsBoard
    console.log('[MAIN_BAS] ============ INIT START ============');
    console.log('[MAIN_BAS] ctx.data (raw):', ctx.data);
    console.log('[MAIN_BAS] ctx.data length:', ctx.data?.length);

    // Log each datasource row
    if (ctx.data && Array.isArray(ctx.data)) {
      ctx.data.forEach(function (row, index) {
        console.log('[MAIN_BAS] Row ' + index + ':', {
          aliasName: row?.datasource?.aliasName,
          entityId: row?.datasource?.entityId,
          entityLabel: row?.datasource?.entityLabel,
          dataKeys: Object.keys(row?.data || {}),
        });
      });
    }

    // Check if MyIOLibrary is available
    if (typeof MyIOLibrary === 'undefined') {
      throw new Error('MyIOLibrary nao esta disponivel. Verifique se a biblioteca foi carregada.');
    }

    // Parse initial data using datasource "Ambientes" with classification
    var parsed = parseDevicesFromData(ctx.data);
    _currentClassified = parsed.classified;
    _currentAmbientes = parsed.ambientes;

    console.log('[MAIN_BAS] Parsed result:', {
      ambientesCount: parsed.ambientes?.length,
      ambientes: parsed.ambientes,
      classified: parsed.classified,
    });

    // Mount sidebar EntityListPanel (col 1, row 1-2 full height)
    console.log('[MAIN_BAS] settings.showSidebar:', settings.showSidebar);
    console.log('[MAIN_BAS] sidebarHost exists:', !!sidebarHost);

    if (settings.showSidebar && sidebarHost) {
      _ambientesListPanel = mountSidebarPanel(sidebarHost, settings, parsed.ambientes);
    } else if (sidebarHost) {
      sidebarHost.style.display = 'none';
    }

    // Mount water CardGridPanel (col 2, row 1)
    console.log('[MAIN_BAS] Mounting water panel:', {
      show: settings.showWaterInfrastructure,
      hostExists: !!waterHost,
    });
    if (settings.showWaterInfrastructure && waterHost) {
      _waterPanel = mountWaterPanel(waterHost, settings, _currentClassified);
      console.log('[MAIN_BAS] Water panel mounted:', !!_waterPanel);
    } else if (waterHost) {
      waterHost.style.display = 'none';
    }

    // Mount chart panel (col 1–2, row 2)
    console.log('[MAIN_BAS] Mounting chart panel:', { show: settings.showCharts, hostExists: !!chartsHost });
    if (settings.showCharts && chartsHost) {
      mountChartPanel(chartsHost, settings);
      console.log('[MAIN_BAS] Chart panel mounted');
    } else if (chartsHost) {
      chartsHost.style.display = 'none';
    }

    // Mount ambientes CardGridPanel (col 3, row 1–2)
    console.log('[MAIN_BAS] Mounting ambientes panel:', {
      show: settings.showEnvironments,
      hostExists: !!ambientesHost,
    });
    if (settings.showEnvironments && ambientesHost) {
      _ambientesPanel = mountAmbientesPanel(ambientesHost, settings, _currentClassified);
      console.log('[MAIN_BAS] Ambientes panel mounted:', !!_ambientesPanel);
    } else if (ambientesHost) {
      ambientesHost.style.display = 'none';
    }

    // Mount motors CardGridPanel (col 4, row 1–2)
    console.log('[MAIN_BAS] Mounting motors panel:', {
      show: settings.showPumpsMotors,
      hostExists: !!motorsHost,
    });
    if (settings.showPumpsMotors && motorsHost) {
      _motorsPanel = mountEnergyPanel(motorsHost, settings, _currentClassified);
      console.log('[MAIN_BAS] Motors panel mounted:', !!_motorsPanel);
    } else if (motorsHost) {
      motorsHost.style.display = 'none';
    }

    if (settings.enableDebugMode) {
      var waterDevices = getWaterDevicesFromClassified(_currentClassified);
      var hvacDevices = getHVACDevicesFromClassified(_currentClassified);
      var energyDevices = getEnergyEquipmentDevicesFromClassified(_currentClassified);

      console.log('[MAIN_BAS] Dashboard initialized with:', {
        ambientes: parsed.ambientes.length,
        waterDevices: waterDevices.length,
        hvacDevices: hvacDevices.length,
        energyDevices: energyDevices.length,
        ocultosDevices: _currentClassified.ocultos.length,
        classified: _currentClassified,
        sidebarMounted: !!_ambientesListPanel,
        waterPanelMounted: !!_waterPanel,
        ambientesPanelMounted: !!_ambientesPanel,
        energyPanelMounted: !!_motorsPanel,
        chartMounted: !!_chartInstance,
        chartDomain: _currentChartDomain,
      });
    }
  } catch (error) {
    console.error('[MAIN_BAS] Error initializing dashboard:', error);
    // Show error in the first available container
    var errorHost = ambientesHost || motorsHost || waterHost;
    if (errorHost) {
      showError(errorHost, error.message);
    }
  }
}

// ============================================================================
// ThingsBoard Layout Fix
// ============================================================================

/**
 * Fix container heights for ThingsBoard widget context.
 * ThingsBoard's widget containers often don't have explicit heights set,
 * which breaks percentage-based layouts. This function ensures the entire
 * parent chain has proper height inheritance.
 */
function fixContainerHeights(root) {
  if (!root) return;

  // Walk up the DOM tree and ensure all parents have proper height
  var el = root.parentElement;
  var maxDepth = 15; // Prevent infinite loops
  var depth = 0;

  while (el && depth < maxDepth) {
    // Skip html and body elements
    if (el.tagName === 'HTML' || el.tagName === 'BODY') {
      el = el.parentElement;
      depth++;
      continue;
    }

    var style = window.getComputedStyle(el);
    var currentHeight = style.height;
    var currentDisplay = style.display;

    // If height is 'auto' or '0px', try to fix it
    if (currentHeight === 'auto' || currentHeight === '0px' || parseInt(currentHeight) === 0) {
      el.style.height = '100%';
      el.style.minHeight = '0';
    }

    // Ensure overflow is handled
    if (style.overflow === 'visible') {
      el.style.overflow = 'hidden';
    }

    el = el.parentElement;
    depth++;
  }

  // Also ensure the root container itself has explicit height
  root.style.height = '100%';
  root.style.width = '100%';
  root.style.minHeight = '0';

  // Force a layout recalculation
  void root.offsetHeight;

  console.log('[MAIN_BAS] Container heights fixed, depth traversed:', depth);
}

// ============================================================================
// ThingsBoard Widget Lifecycle
// ============================================================================

self.onInit = async function () {
  _ctx = self.ctx;
  _settings = getSettings(_ctx);

  var root = _ctx.$container[0].querySelector('#bas-dashboard-root');
  if (!root) {
    console.error('[MAIN_BAS] Container #bas-dashboard-root not found');
    return;
  }

  // Fix ThingsBoard container heights before mounting components
  fixContainerHeights(root);

  // Apply main dashboard background (color or image)
  if (_settings.mainBackgroundImage) {
    root.style.backgroundImage = "url('" + _settings.mainBackgroundImage + "')";
    root.style.backgroundSize = 'cover';
    root.style.backgroundPosition = 'center';
    root.style.backgroundRepeat = 'no-repeat';
  } else if (_settings.mainBackground) {
    root.style.backgroundColor = _settings.mainBackground;
  }

  // Also fix the $container itself
  if (_ctx.$container && _ctx.$container[0]) {
    _ctx.$container[0].style.height = '100%';
    _ctx.$container[0].style.overflow = 'hidden';
  }

  var sidebarHost = root.querySelector('#bas-sidebar-host');
  var waterHost = root.querySelector('#bas-water-host');
  var chartsHost = root.querySelector('#bas-charts-host');
  var ambientesHost = root.querySelector('#bas-ambientes-host');
  var motorsHost = root.querySelector('#bas-motors-host');

  // Always log layout containers for debugging
  console.log('[MAIN_BAS] Layout containers:', {
    sidebarHost: !!sidebarHost,
    waterHost: !!waterHost,
    chartsHost: !!chartsHost,
    ambientesHost: !!ambientesHost,
    motorsHost: !!motorsHost,
  });
  console.log('[MAIN_BAS] Settings visibility:', {
    showSidebar: _settings.showSidebar,
    showWaterInfrastructure: _settings.showWaterInfrastructure,
    showCharts: _settings.showCharts,
    showEnvironments: _settings.showEnvironments,
    showPumpsMotors: _settings.showPumpsMotors,
  });

  if (_settings.enableDebugMode) {
    console.log('[MAIN_BAS] onInit - Full Settings:', _settings);
  }

  // Initialize all panels
  await initializeDashboard(_ctx, sidebarHost, waterHost, chartsHost, ambientesHost, motorsHost, _settings);
};

self.onDataUpdated = function () {
  if (!_ctx) return;

  // Limit onDataUpdated to run max 3 times
  _dataUpdatedCount++;
  if (_dataUpdatedCount > 3) {
    if (_settings && _settings.enableDebugMode) {
      console.log('[MAIN_BAS] onDataUpdated - SKIPPED (limit of 3 calls reached)');
    }
    return;
  }
  console.log('[MAIN_BAS] onDataUpdated - Call #' + _dataUpdatedCount + ' of 3');

  var parsed = parseDevicesFromData(_ctx.data);
  _currentClassified = parsed.classified;

  if (_settings && _settings.enableDebugMode) {
    var waterDevices = getWaterDevicesFromClassified(_currentClassified);
    var hvacDevices = getHVACDevicesFromClassified(_currentClassified);
    var energyDevices = getEnergyEquipmentDevicesFromClassified(_currentClassified);

    console.log('[MAIN_BAS] onDataUpdated - Devices:', {
      ambientes: parsed.ambientes.length,
      water: waterDevices.length,
      hvac: hvacDevices.length,
      energy: energyDevices.length,
      ocultos: _currentClassified.ocultos.length,
    });
  }

  // Update ambientes list if changed
  if (
    _ambientesListPanel &&
    JSON.stringify(
      parsed.ambientes.map(function (a) {
        return a.id;
      })
    ) !==
      JSON.stringify(
        _currentAmbientes.map(function (a) {
          return a.id;
        })
      )
  ) {
    _currentAmbientes = parsed.ambientes;
    _ambientesListPanel.setItems(buildAmbienteItems(parsed.ambientes));
  }

  // Update water panel
  if (_waterPanel) {
    _waterPanel.setItems(buildWaterCardItems(_currentClassified, _selectedAmbiente));
  }

  // Update ambientes panel (HVAC cards)
  if (_ambientesPanel) {
    _ambientesPanel.setItems(buildHVACCardItems(_currentClassified, _selectedAmbiente));
  }

  // Update motors panel
  if (_motorsPanel) {
    _motorsPanel.setItems(buildEnergyCardItems(_currentClassified, _selectedAmbiente));
  }
};

self.onResize = function () {
  // Re-fix container heights on resize (ThingsBoard may recalculate layouts)
  if (_ctx && _ctx.$container && _ctx.$container[0]) {
    var root = _ctx.$container[0].querySelector('#bas-dashboard-root');
    if (root) {
      fixContainerHeights(root);
    }
  }
};

self.onDestroy = function () {
  // Clean up filter modal
  if (_activeFilterModal && _activeFilterModal.destroy) {
    _activeFilterModal.destroy();
  }
  _activeFilterModal = null;

  // Clean up maximize overlay and maximized chart
  if (_maximizedChartInstance && _maximizedChartInstance.destroy) {
    _maximizedChartInstance.destroy();
  }
  _maximizedChartInstance = null;

  if (_maximizeOverlay) {
    _maximizeOverlay.remove();
  }
  _maximizeOverlay = null;
  _maximizedPanel = null;

  // Clean up panels
  if (_chartInstance && _chartInstance.destroy) {
    _chartInstance.destroy();
  }
  if (_ambientesListPanel && _ambientesListPanel.destroy) {
    _ambientesListPanel.destroy();
  }
  if (_waterPanel && _waterPanel.destroy) {
    _waterPanel.destroy();
  }
  if (_ambientesPanel && _ambientesPanel.destroy) {
    _ambientesPanel.destroy();
  }
  if (_motorsPanel && _motorsPanel.destroy) {
    _motorsPanel.destroy();
  }
  _chartInstance = null;
  _currentChartDomain = 'energy';
  _ambientesListPanel = null;
  _waterPanel = null;
  _ambientesPanel = null;
  _motorsPanel = null;
  _selectedAmbiente = null;
  _ctx = null;
  _settings = null;
  _currentAmbientes = [];
  _currentClassified = null;
  _dataUpdatedCount = 0; // Reset counter on destroy
};

self.typeParameters = function () {
  return {
    maxDatasources: -1,
    maxDataKeys: -1,
    singleEntity: false,
    hasDataPageLink: false,
    warnOnPageDataOverflow: false,
    dataKeysOptional: true,
  };
};
