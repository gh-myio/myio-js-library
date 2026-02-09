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
// ============================================================================

var OCULTOS_PATTERNS = ['ARQUIVADO', 'SEM_DADOS', 'DESATIVADO', 'REMOVIDO', 'INATIVO'];

var ENTRADA_TYPES = ['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'];

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
    sidebarLabel: widgetSettings.sidebarLabel ?? 'Ambientes',
    environmentsLabel: widgetSettings.environmentsLabel ?? 'Ambientes',
    pumpsMotorsLabel: widgetSettings.pumpsMotorsLabel ?? 'Bombas e Motores',
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
    sidebarBackgroundImage: widgetSettings.sidebarBackgroundImage ?? undefined,
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
 * Order matters: Check water types FIRST, then HVAC/temperature, then motors
 */
function detectDomain(deviceType) {
  var dt = String(deviceType || '').toUpperCase();
  var i;

  // Check water types FIRST (before energy default)
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

  // Check for motor types
  for (i = 0; i < MOTOR_TYPES.length; i++) {
    if (dt.includes(MOTOR_TYPES[i])) {
      return 'motor';
    }
  }

  return 'energy';
}

/**
 * Detect context within domain
 */
function detectContext(deviceType, deviceProfile, identifier, domain) {
  var dt = String(deviceType || '').toUpperCase();
  var dp = String(deviceProfile || '').toUpperCase();
  var id = String(identifier || '').toUpperCase();

  if (domain === 'water') {
    if (dt.includes('HIDROMETRO_SHOPPING') || dp.includes('HIDROMETRO_SHOPPING')) {
      return 'hidrometro_entrada';
    }
    if (dp === 'HIDROMETRO_AREA_COMUM' && id === 'BANHEIROS') {
      return 'banheiros';
    }
    if (dt === 'HIDROMETRO' && dp === 'HIDROMETRO_AREA_COMUM') {
      return 'hidrometro_area_comum';
    }
    if (dt.includes('CAIXA_DAGUA')) {
      return 'caixadagua';
    }
    if (dt.includes('SOLENOIDE')) {
      return 'solenoide';
    }
    return 'hidrometro';
  }

  if (domain === 'temperature') {
    if (dt.includes('TERMOSTATO_EXTERNAL') || dp.includes('EXTERNAL')) {
      return 'termostato_external';
    }
    return 'termostato';
  }

  if (domain === 'motor') {
    if (dt.includes('BOMBA') || dp.includes('BOMBA')) {
      return 'bomba';
    }
    return 'motor';
  }

  // Energy domain
  for (var i = 0; i < ENTRADA_TYPES.length; i++) {
    if (dt.includes(ENTRADA_TYPES[i]) || dp.includes(ENTRADA_TYPES[i])) {
      return 'entrada';
    }
  }
  if (dt === '3F_MEDIDOR' && dp === '3F_MEDIDOR') {
    return 'stores';
  }
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
    motor: {
      bomba: [],
      motor: [],
    },
    energy: {
      entrada: [],
      stores: [],
      equipments: [],
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

      console.log('[MAIN_BAS] Row ' + index + ': ' + JSON.stringify({
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
      }));
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
  Object.keys(ambientesMap).forEach(function(entityId) {
    var entity = ambientesMap[entityId];
    ambientes.push({
      id: entityId,
      name: entity.entityLabel,
      entityType: entity.entityType,
      aliasName: entity.aliasName,
      data: entity.collectedData,
    });
  });

  console.log('[MAIN_BAS] Ambientes processed:', ambientes.map(function(a) { return a.name; }));

  // Phase 3: Process grouped Devices with classification
  Object.keys(devicesMap).forEach(function(entityId) {
    var entity = devicesMap[entityId];
    var cd = entity.collectedData;

    // Get classification attributes from collected data
    var deviceType = cd.deviceType || cd.type || '';
    var deviceProfile = cd.deviceProfile || cd.profile || '';
    var identifier = cd.identifier || cd.id || '';
    var active = cd.active;

    console.log('[MAIN_BAS] Device "' + entity.entityLabel + '": ' + JSON.stringify({
      deviceType: deviceType,
      deviceProfile: deviceProfile,
      identifier: identifier,
      active: active,
      allKeys: Object.keys(cd),
    }));

    // Check if device is hidden/archived (RFC-0142)
    if (isOcultosDevice(deviceProfile)) {
      classified.ocultos.push({
        id: entityId,
        name: entity.entityLabel,
        deviceType: deviceType,
        deviceProfile: deviceProfile,
      });
      return;
    }

    // Detect domain and context
    var domain = detectDomain(deviceType);
    var context = detectContext(deviceType, deviceProfile, identifier, domain);

    // Build device object based on domain
    var device = {
      id: entityId,
      name: entity.entityLabel,
      deviceType: deviceType,
      deviceProfile: deviceProfile,
      domain: domain,
      context: context,
      status: active ? 'online' : 'offline',
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
      device.status = active ? 'active' : 'inactive';
    } else if (domain === 'motor') {
      device.consumption = parseFloat(cd.consumption || cd.power || 0);
      device.status = device.consumption > 0 ? 'running' : 'stopped';
      device.type = context === 'bomba' ? 'pump' : 'motor';
    } else {
      // Energy
      device.consumption = parseFloat(cd.consumption || cd.energy || cd.power || 0);
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
    water: Object.keys(classified.water).map(function(k) { return k + ':' + classified.water[k].length; }),
    temperature: Object.keys(classified.temperature).map(function(k) { return k + ':' + classified.temperature[k].length; }),
    motor: Object.keys(classified.motor).map(function(k) { return k + ':' + classified.motor[k].length; }),
    energy: Object.keys(classified.energy).map(function(k) { return k + ':' + classified.energy[k].length; }),
    ocultos: classified.ocultos.length,
  });

  return {
    classified: classified,
    ambientes: ambientes,
    devices: devices,
  };
}

/**
 * Build EntityListPanel items from ambiente devices
 * Each device in the "Ambientes" datasource becomes a list item
 */
function buildAmbienteItems(ambientes) {
  return ambientes.map(function (ambiente) {
    return {
      id: ambiente.id,
      label: ambiente.name || ambiente.label || ambiente.id,
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

  return {
    entityId: device.id,
    labelOrName: device.name,
    deviceIdentifier: device.id,
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
 * Get all motor devices from classified structure
 */
function getMotorDevicesFromClassified(classified) {
  if (!classified || !classified.motor) return [];
  var motor = classified.motor;
  return [].concat(motor.bomba || [], motor.motor || []);
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

  return {
    entityId: device.id,
    labelOrName: device.name,
    deviceIdentifier: device.id,
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
// Motor device type/status mappings
// ============================================================================

var MOTOR_TYPE_MAP = {
  pump: 'BOMBA_HIDRAULICA',
  motor: 'MOTOR',
  other: 'MOTOR',
};

var MOTOR_STATUS_MAP = {
  running: 'online',
  stopped: 'offline',
  unknown: 'no_info',
};

/**
 * Convert a motor device to an entityObject for renderCardComponentV6
 */
function motorDeviceToEntityObject(device) {
  var deviceType = MOTOR_TYPE_MAP[device.type] || 'MOTOR';
  var deviceStatus = MOTOR_STATUS_MAP[device.status] || 'no_info';

  return {
    entityId: device.id,
    labelOrName: device.name,
    deviceIdentifier: device.id,
    deviceType: deviceType,
    val: device.consumption,
    deviceStatus: deviceStatus,
    perc: 0,
  };
}

/**
 * Build CardGridPanel items from motor devices
 * @param {Object} classified - Classified device structure
 * @param {string|null} selectedAmbienteId - ID of selected ambiente to filter, or null for all
 */
function buildMotorCardItems(classified, selectedAmbienteId) {
  var motorDevices = getMotorDevicesFromClassified(classified);
  var filtered = motorDevices;
  if (selectedAmbienteId) {
    filtered = motorDevices.filter(function (d) {
      return d.id === selectedAmbienteId;
    });
  }

  return filtered.map(function (device) {
    return {
      id: device.id,
      entityObject: motorDeviceToEntityObject(device),
      source: device,
    };
  });
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

  var panel = new MyIOLibrary.CardGridPanel({
    title: 'Infraestrutura Hidrica',
    items: buildWaterCardItems(classified, null),
    cardCustomStyle: settings.cardCustomStyle || undefined,
    gridMinCardWidth: '140px',
    emptyMessage: 'Nenhum dispositivo',
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

  var panel = new MyIOLibrary.CardGridPanel({
    title: settings.environmentsLabel,
    items: buildHVACCardItems(classified, null),
    cardCustomStyle: settings.cardCustomStyle || undefined,
    gridMinCardWidth: '140px',
    emptyMessage: 'Nenhum ambiente',
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
 * Mount CardGridPanel into #bas-motors-host (pumps & motors)
 */
function mountMotorsPanel(host, settings, classified) {
  console.log('[MAIN_BAS] mountMotorsPanel called, CardGridPanel available:', !!MyIOLibrary.CardGridPanel);
  if (!MyIOLibrary.CardGridPanel) {
    console.warn('[MAIN_BAS] MyIOLibrary.CardGridPanel not available');
    return null;
  }

  var panel = new MyIOLibrary.CardGridPanel({
    title: settings.pumpsMotorsLabel,
    items: buildMotorCardItems(classified, null),
    cardCustomStyle: settings.cardCustomStyle || undefined,
    gridMinCardWidth: '140px',
    emptyMessage: 'Nenhum equipamento',
    handleClickCard: function (item) {
      if (settings.enableDebugMode) {
        console.log('[MAIN_BAS] Motor device clicked:', item.source);
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
    subtitle: 'Nome \u2191',
    items: items,
    backgroundImage: settings.sidebarBackgroundImage || undefined,
    searchPlaceholder: 'Buscar...',
    selectedId: null,
    showAllOption: true,
    allLabel: 'Todos',
    sortOrder: 'asc',
    excludePartOfLabel: '^\\(\\d{3}\\)-\\s*',  // Remove (001)- prefix from labels
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
        _motorsPanel.setItems(buildMotorCardItems(_currentClassified, null));
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
        _motorsPanel.setItems(buildMotorCardItems(_currentClassified, item.id));
      }
      if (panel) panel.setSelectedId(item.id);
      window.dispatchEvent(new CustomEvent('bas:ambiente-changed', { detail: { ambiente: item.id } }));
    },
  });

  var panelElement = panel.getElement();
  console.log('[MAIN_BAS] Panel element created:', panelElement);

  sidebarHost.appendChild(panelElement);

  // DEBUG: Log after append
  setTimeout(function() {
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

/**
 * Mount chart tab bar + chart container into #bas-charts-host
 */
function mountChartPanel(hostEl) {
  if (!hostEl) return;

  var domains = ['energy', 'water', 'temperature'];

  // Build tab bar
  var tabBar = window.document.createElement('div');
  tabBar.className = 'bas-chart-tabs';

  domains.forEach(function (domain) {
    var btn = window.document.createElement('button');
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

  // Build chart card container
  var chartCard = document.createElement('div');
  chartCard.className = 'bas-chart-card';

  hostEl.appendChild(tabBar);
  hostEl.appendChild(chartCard);

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
      ctx.data.forEach(function(row, index) {
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
    console.log('[MAIN_BAS] Mounting water panel:', { show: settings.showWaterInfrastructure, hostExists: !!waterHost });
    if (settings.showWaterInfrastructure && waterHost) {
      _waterPanel = mountWaterPanel(waterHost, settings, _currentClassified);
      console.log('[MAIN_BAS] Water panel mounted:', !!_waterPanel);
    } else if (waterHost) {
      waterHost.style.display = 'none';
    }

    // Mount chart panel (col 1–2, row 2)
    console.log('[MAIN_BAS] Mounting chart panel:', { show: settings.showCharts, hostExists: !!chartsHost });
    if (settings.showCharts && chartsHost) {
      mountChartPanel(chartsHost);
      console.log('[MAIN_BAS] Chart panel mounted');
    } else if (chartsHost) {
      chartsHost.style.display = 'none';
    }

    // Mount ambientes CardGridPanel (col 3, row 1–2)
    console.log('[MAIN_BAS] Mounting ambientes panel:', { show: settings.showEnvironments, hostExists: !!ambientesHost });
    if (settings.showEnvironments && ambientesHost) {
      _ambientesPanel = mountAmbientesPanel(ambientesHost, settings, _currentClassified);
      console.log('[MAIN_BAS] Ambientes panel mounted:', !!_ambientesPanel);
    } else if (ambientesHost) {
      ambientesHost.style.display = 'none';
    }

    // Mount motors CardGridPanel (col 4, row 1–2)
    console.log('[MAIN_BAS] Mounting motors panel:', { show: settings.showPumpsMotors, hostExists: !!motorsHost });
    if (settings.showPumpsMotors && motorsHost) {
      _motorsPanel = mountMotorsPanel(motorsHost, settings, _currentClassified);
      console.log('[MAIN_BAS] Motors panel mounted:', !!_motorsPanel);
    } else if (motorsHost) {
      motorsHost.style.display = 'none';
    }

    if (settings.enableDebugMode) {
      var waterDevices = getWaterDevicesFromClassified(_currentClassified);
      var hvacDevices = getHVACDevicesFromClassified(_currentClassified);
      var motorDevices = getMotorDevicesFromClassified(_currentClassified);

      console.log('[MAIN_BAS] Dashboard initialized with:', {
        ambientes: parsed.ambientes.length,
        waterDevices: waterDevices.length,
        hvacDevices: hvacDevices.length,
        motorDevices: motorDevices.length,
        ocultosDevices: _currentClassified.ocultos.length,
        classified: _currentClassified,
        sidebarMounted: !!_ambientesListPanel,
        waterPanelMounted: !!_waterPanel,
        ambientesPanelMounted: !!_ambientesPanel,
        motorsPanelMounted: !!_motorsPanel,
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

  var parsed = parseDevicesFromData(_ctx.data);
  _currentClassified = parsed.classified;

  if (_settings && _settings.enableDebugMode) {
    var waterDevices = getWaterDevicesFromClassified(_currentClassified);
    var hvacDevices = getHVACDevicesFromClassified(_currentClassified);
    var motorDevices = getMotorDevicesFromClassified(_currentClassified);

    console.log('[MAIN_BAS] onDataUpdated - Devices:', {
      ambientes: parsed.ambientes.length,
      water: waterDevices.length,
      hvac: hvacDevices.length,
      motors: motorDevices.length,
      ocultos: _currentClassified.ocultos.length,
    });
  }

  // Update ambientes list if changed
  if (_ambientesListPanel && JSON.stringify(parsed.ambientes.map(function(a) { return a.id; })) !== JSON.stringify(_currentAmbientes.map(function(a) { return a.id; }))) {
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
    _motorsPanel.setItems(buildMotorCardItems(_currentClassified, _selectedAmbiente));
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
