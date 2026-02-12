/* global self, window, MyIOLibrary, document, localStorage, sessionStorage */
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
// Debug Configuration
// ============================================================================

var DEBUG_ACTIVE = true; // Default true, controlled by settings.enableDebugMode

// LogHelper instance - created in onInit using MyIOLibrary.createLogHelper
// Fallback for early calls before onInit completes
var LogHelper = {
  log: function (...args) {
    if (DEBUG_ACTIVE) console.log('[MAIN_BAS]', ...args);
  },
  warn: function (...args) {
    if (DEBUG_ACTIVE) console.warn('[MAIN_BAS]', ...args);
  },
  error: function (...args) {
    if (DEBUG_ACTIVE) console.error('[MAIN_BAS]', ...args);
  },
};

// ============================================================================
// Classification Constants (RFC-0142)
// Domains: energy | water | temperature (NO motor domain - motors are energy)
// ============================================================================

var OCULTOS_PATTERNS = ['ARQUIVADO', 'SEM_DADOS', 'DESATIVADO', 'REMOVIDO', 'INATIVO'];

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
let _sidebarMenu = null; // RFC-0173: Premium sidebar menu instance

// ============================================================================
// RFC-0161: Ambiente Hierarchy Caches
// ============================================================================

// Hierarchical tree: ambienteId -> { asset info, children: [], devices: [] }
var _ambienteHierarchy = {};

// Flat device-to-ambiente mapping for quick lookups: deviceId -> ambienteId
var _deviceToAmbienteMap = {};

// Ambiente details cache: ambienteId -> { id, name, parentId, level, ... }
var _ambientesCache = {};

// Parsed devices and ambientes maps from initial parsing (shared with hierarchy builder)
var _devicesMap = {};
var _ambientesMap = {};

// ============================================================================
// RFC-0161: ThingsBoard Relations API Functions
// ============================================================================

/**
 * Fetch ALL parent assets for a device via ThingsBoard Relations API
 * A device can have multiple parent ASSETs via "Contains" relations
 * @param {Object} deviceEntityId - { id: string, entityType: 'DEVICE' }
 * @returns {Promise<Object[]>} Array of parent assets [{ id, entityType: 'ASSET' }, ...]
 */
function getAllParentAssetsViaHttp(deviceEntityId) {
  return new Promise(function (resolve, reject) {
    if (!deviceEntityId || !deviceEntityId.id || !deviceEntityId.entityType) {
      return reject('entityId inválido!');
    }

    var url = '/api/relations?toId=' + deviceEntityId.id + '&toType=' + deviceEntityId.entityType;

    self.ctx.http.get(url).subscribe({
      next: function (relations) {
        // Get ALL parent assets (not just the first one)
        var assetRelations = relations.filter(function (r) {
          return r.from && r.from.entityType === 'ASSET' && r.type === 'Contains';
        });

        if (assetRelations.length === 0) {
          return reject('Nenhum asset pai encontrado para: ' + deviceEntityId.id);
        }

        // Return all parent assets
        var parentAssets = assetRelations.map(function (rel) {
          return rel.from;
        });

        resolve(parentAssets);
      },
      error: function (err) {
        reject('Erro HTTP: ' + JSON.stringify(err));
      },
    });
  });
}

/**
 * Fetch asset names for ambiente IDs (batch-friendly)
 * @param {string[]} ambienteIds - Array of ambiente IDs to fetch names for
 * @returns {Promise<void>} Resolves when all names are fetched
 */
function fetchAmbienteNames(ambienteIds) {
  var promises = ambienteIds.map(function (ambienteId) {
    var url = '/api/asset/' + ambienteId;

    return new Promise(function (resolve) {
      self.ctx.http.get(url).subscribe({
        next: function (asset) {
          if (_ambienteHierarchy[ambienteId]) {
            // Prefer label (user-friendly) over name (internal identifier)
            _ambienteHierarchy[ambienteId].name =
              asset.label || asset.name || 'Ambiente ' + ambienteId.slice(0, 8);
          }
          resolve();
        },
        error: function () {
          // Fallback name
          if (_ambienteHierarchy[ambienteId]) {
            _ambienteHierarchy[ambienteId].name = 'Ambiente ' + ambienteId.slice(0, 8);
          }
          resolve();
        },
      });
    });
  });

  return Promise.all(promises);
}

/**
 * Calculate aggregated data for an ambiente from its child devices
 * @param {Object[]} devices - Array of device objects
 * @returns {Object} Aggregated data { temperature, consumption, hasRemote, isRemoteOn, onlineCount, offlineCount, totalDevices }
 */
function calculateAmbienteAggregates(devices) {
  var temps = [];
  var consumptionTotal = 0;
  var consumptionCount = 0;
  var hasRemote = false;
  var isRemoteOn = false;
  var onlineCount = 0;
  var offlineCount = 0;

  devices.forEach(function (device) {
    // Status
    if (device.status === 'online' || device.status === 'active') {
      onlineCount++;
    } else {
      offlineCount++;
    }

    // Temperature (from rawData or direct property)
    var temp = (device.rawData && device.rawData.temperature) || device.temperature;
    if (temp != null && !isNaN(temp)) {
      temps.push(parseFloat(temp));
    }

    // Consumption
    var consumption = (device.rawData && device.rawData.consumption) || device.consumption;
    if (consumption != null && !isNaN(consumption)) {
      consumptionTotal += parseFloat(consumption);
      consumptionCount++;
    }

    // Remote control
    var deviceHasRemote = (device.rawData && device.rawData.hasRemote) || device.hasRemote;
    if (deviceHasRemote) {
      hasRemote = true;
      var deviceIsOn = (device.rawData && device.rawData.isOn) || device.isOn;
      if (deviceIsOn) {
        isRemoteOn = true;
      }
    }
  });

  return {
    temperature:
      temps.length > 0
        ? {
            min: Math.min.apply(null, temps),
            max: Math.max.apply(null, temps),
            avg:
              temps.reduce(function (a, b) {
                return a + b;
              }, 0) / temps.length,
            count: temps.length,
          }
        : null,
    consumption:
      consumptionCount > 0
        ? {
            total: consumptionTotal,
            count: consumptionCount,
          }
        : null,
    hasRemote: hasRemote,
    isRemoteOn: isRemoteOn,
    onlineCount: onlineCount,
    offlineCount: offlineCount,
    totalDevices: devices.length,
  };
}

/**
 * Build the ambiente hierarchy map from devices
 * Fetches parent asset for each device and organizes into tree structure
 * @param {Object} classifiedDevices - Classified devices by domain/context
 * @returns {Promise<Object>} Hierarchy map { ambienteId -> ambiente node }
 */
function buildAmbienteHierarchy(classifiedDevices) {
  return new Promise(function (resolve, reject) {
    LogHelper.log('[MAIN_BAS] ============ BUILDING HIERARCHY ============');

    // Reset hierarchy caches
    _ambienteHierarchy = {};
    _deviceToAmbienteMap = {};

    // Get all devices as flat array for parent lookups
    var allDevices = [];
    Object.keys(classifiedDevices).forEach(function (domain) {
      if (domain === 'ocultos') return; // Skip hidden devices
      var domainData = classifiedDevices[domain];
      if (typeof domainData !== 'object') return;

      Object.keys(domainData).forEach(function (context) {
        var devices = domainData[context];
        if (Array.isArray(devices)) {
          allDevices = allDevices.concat(devices);
        }
      });
    });

    LogHelper.log('[MAIN_BAS] Devices to process:', allDevices.length);

    if (allDevices.length === 0) {
      LogHelper.log('[MAIN_BAS] No devices to process, skipping hierarchy build');
      resolve(_ambienteHierarchy);
      return;
    }

    // Step 1: Fetch ALL parent assets for each device (a device can have multiple parents)
    var promises = allDevices.map(function (device) {
      return getAllParentAssetsViaHttp({ id: device.id, entityType: 'DEVICE' })
        .then(function (parentAssets) {
          // Store device-to-parent mapping (first parent for backwards compatibility)
          _deviceToAmbienteMap[device.id] = parentAssets[0].id;

          // Add device to ALL of its parent ASSETs
          parentAssets.forEach(function (parentAsset) {
            // Create or update ambiente node
            if (!_ambienteHierarchy[parentAsset.id]) {
              _ambienteHierarchy[parentAsset.id] = {
                id: parentAsset.id,
                name: null, // Will fetch later
                entityType: 'ASSET',
                parentId: null,
                level: 1, // Default level, will be updated if parent is found
                children: [],
                devices: [],
                aggregatedData: null,
              };
            }

            // Add device to ambiente
            _ambienteHierarchy[parentAsset.id].devices.push(device);

            LogHelper.log('[MAIN_BAS] Device "' + device.name + '" -> Parent: ' + parentAsset.id);
          });

          return { device: device, parentIds: parentAssets.map(function (p) { return p.id; }) };
        })
        .catch(function (err) {
          LogHelper.warn('[MAIN_BAS] No parent for device:', device.name, err);
          return { device: device, parentIds: [] };
        });
    });

    Promise.all(promises)
      .then(function (results) {
        // Step 2: Fetch ambiente names for all discovered ambientes
        return fetchAmbienteNames(Object.keys(_ambienteHierarchy));
      })
      .then(function () {
        // Step 3: Calculate aggregates for each ambiente
        Object.keys(_ambienteHierarchy).forEach(function (ambienteId) {
          var ambiente = _ambienteHierarchy[ambienteId];
          ambiente.aggregatedData = calculateAmbienteAggregates(ambiente.devices);
        });

        LogHelper.log('[MAIN_BAS] ============ HIERARCHY COMPLETE ============');
        LogHelper.log('[MAIN_BAS]   Leaf Ambientes:', Object.keys(_ambienteHierarchy).length);
        LogHelper.log('[MAIN_BAS]   Devices mapped:', Object.keys(_deviceToAmbienteMap).length);

        // Log ambiente details for debugging
        Object.keys(_ambienteHierarchy).forEach(function (ambienteId) {
          var ambiente = _ambienteHierarchy[ambienteId];
          LogHelper.log(
            '[MAIN_BAS]   Ambiente "' + ambiente.name + '": ' + ambiente.devices.length + ' devices'
          );
        });

        resolve(_ambienteHierarchy);
      })
      .catch(function (err) {
        LogHelper.error('[MAIN_BAS] Error building hierarchy:', err);
        reject(err);
      });
  });
}

// ============================================================================
// RFC-0168: ASSET_AMBIENT Hierarchy Building
// ============================================================================

// Module-level cache for ASSET_AMBIENT hierarchy
var _assetAmbientHierarchy = {};

/**
 * RFC-0168: Remove "(NNN)-" prefix pattern from ambiente labels
 * Examples:
 *   "(002)-Sala do Nobreak" → "Sala do Nobreak"
 *   "(001)-Deck" → "Deck"
 *   "Deck - Climatização" → "Deck - Climatização" (no change)
 *
 * @param {string} label - The label to process
 * @returns {string} Label without the prefix pattern
 */
function removeAmbientePrefixFromLabel(label) {
  if (!label || typeof label !== 'string') return label || '';
  // Match pattern: (NNN)- where NNN is one or more digits
  return label.replace(/^\(\d+\)-\s*/, '');
}

/**
 * RFC-0168: Build ASSET_AMBIENT hierarchy from parsed ambientes and device hierarchy
 *
 * Filters _ambienteHierarchy to include only ASSET_AMBIENT type assets and enriches
 * them with displayLabel (prefix removed) and hasSetupWarning flags.
 *
 * @param {Object[]} parsedAmbientes - Array of ambiente objects from parseDevicesFromData
 * @returns {Object} Map of ambienteId -> AssetAmbientNode
 *
 * AssetAmbientNode structure:
 * {
 *   id: string,
 *   name: string,
 *   assetType: 'ASSET_AMBIENT',
 *   originalLabel: string,      // "(002)-Sala do Nobreak"
 *   displayLabel: string,       // "Sala do Nobreak"
 *   devices: Device[],
 *   hasSetupWarning: boolean,   // true if devices.length === 0
 *   aggregatedData: AggregatedData | null
 * }
 */
function buildAssetAmbientHierarchy(parsedAmbientes) {
  _assetAmbientHierarchy = {};

  LogHelper.log('[MAIN_BAS] ============ BUILDING ASSET_AMBIENT HIERARCHY ============');

  // Step 1: Get ASSET_AMBIENT type ambientes from parsed ambientes
  var assetAmbients = parsedAmbientes.filter(function (amb) {
    return amb.type === 'ASSET_AMBIENT';
  });

  LogHelper.log('[MAIN_BAS] ASSET_AMBIENT ambientes found:', assetAmbients.length);

  // Step 2: For each ASSET_AMBIENT, find its devices from _ambienteHierarchy
  assetAmbients.forEach(function (amb) {
    var hierarchyNode = _ambienteHierarchy[amb.id];
    var devices = hierarchyNode ? hierarchyNode.devices : [];

    _assetAmbientHierarchy[amb.id] = {
      id: amb.id,
      name: amb.name,
      assetType: 'ASSET_AMBIENT',
      originalLabel: amb.label,
      displayLabel: removeAmbientePrefixFromLabel(amb.label),
      devices: devices,
      hasSetupWarning: devices.length === 0,
      aggregatedData: hierarchyNode ? hierarchyNode.aggregatedData : null,
      // Keep reference to original parsed ambiente for additional data
      _sourceAmbiente: amb,
    };

    LogHelper.log(
      '[MAIN_BAS] ASSET_AMBIENT "' +
        _assetAmbientHierarchy[amb.id].displayLabel +
        '": ' +
        devices.length +
        ' devices' +
        (_assetAmbientHierarchy[amb.id].hasSetupWarning ? ' (SETUP WARNING)' : '')
    );
  });

  LogHelper.log('[MAIN_BAS] ============ ASSET_AMBIENT HIERARCHY COMPLETE ============');
  LogHelper.log('[MAIN_BAS]   Total ASSET_AMBIENTs:', Object.keys(_assetAmbientHierarchy).length);

  return _assetAmbientHierarchy;
}

// ============================================================================
// RFC-0161: Leaf Node Detection & Sidebar Rendering
// ============================================================================

/**
 * Check if an ambiente is a "leaf" node (has devices but no sub-ambientes)
 * @param {Object} ambiente - Ambiente node from hierarchy
 * @returns {boolean} True if leaf node
 */
function isLeafAmbiente(ambiente) {
  return ambiente.devices.length > 0 && ambiente.children.length === 0;
}

/**
 * Get all leaf ambientes from hierarchy (for sidebar rendering)
 * @returns {Object[]} Array of leaf ambiente nodes
 */
function getLeafAmbientes() {
  var leaves = [];

  function walkTree(ambiente) {
    if (isLeafAmbiente(ambiente)) {
      leaves.push(ambiente);
    } else {
      // Recurse into children
      ambiente.children.forEach(walkTree);
    }
  }

  Object.values(_ambienteHierarchy).forEach(function (rootAmbiente) {
    walkTree(rootAmbiente);
  });

  return leaves;
}

/**
 * Get devices for a specific ambiente (leaf nodes only have direct devices)
 * @param {string|null} ambienteId - Ambiente ID or null for all devices
 * @param {string} [domain] - Optional domain filter (water, temperature, energy)
 * @returns {Object[]|null} Array of devices or null if no filter
 */
function getDevicesForAmbiente(ambienteId, domain) {
  if (!ambienteId) return null; // No filter, return null to indicate all

  var ambiente = _ambienteHierarchy[ambienteId];
  if (!ambiente) return null;

  var devices = ambiente.devices;

  // Filter by domain if specified
  if (domain) {
    return devices.filter(function (d) {
      return d.domain === domain;
    });
  }

  return devices;
}

/**
 * Generate sublabel showing available data
 * e.g., "22°C • 1.5kW" or "22°C" or "1.5kW"
 * @param {Object} aggregates - Aggregated data from calculateAmbienteAggregates
 * @returns {string} Sublabel text
 */
function buildAmbienteSublabel(aggregates) {
  var parts = [];

  if (aggregates && aggregates.temperature) {
    parts.push(aggregates.temperature.avg.toFixed(1) + '°C');
  }
  if (aggregates && aggregates.consumption) {
    parts.push(aggregates.consumption.total.toFixed(1) + 'kW');
  }

  return parts.join(' • ') || '';
}

/**
 * Get icon based on what devices are present in ambiente
 * @param {Object} aggregates - Aggregated data from calculateAmbienteAggregates
 * @returns {string} Icon emoji
 */
function getAmbienteIconForAggregates(aggregates) {
  if (aggregates && aggregates.hasRemote) return '🎛️';
  if (aggregates && aggregates.temperature) return '🌡️';
  if (aggregates && aggregates.consumption) return '⚡';
  return '📍';
}

/**
 * Build sidebar items from leaf ambientes only
 * @returns {Object[]} Array of items for EntityListPanel
 */
function buildSidebarItemsFromHierarchy() {
  var leaves = getLeafAmbientes();

  return leaves.map(function (ambiente) {
    var aggregates = ambiente.aggregatedData || {};

    return {
      id: ambiente.id,
      label: ambiente.name,
      sublabel: buildAmbienteSublabel(aggregates),
      icon: getAmbienteIconForAggregates(aggregates),
      data: ambiente,
      // Generate action handler for the ambiente
      handleActionClick: function () {
        LogHelper.log('[MAIN_BAS] Hierarchy ambiente action:', ambiente.id, ambiente.name);
        if (self.ctx && self.ctx.stateController) {
          self.ctx.stateController.openState('ambiente', {
            entityId: ambiente.id,
            entityName: ambiente.name,
          });
        }
      },
    };
  });
}

// Customer credentials map for API integration
var MAP_CUSTOMER_CREDENTIALS = {
  customer_TB_Id: null,
  customer_Ingestion_Id: null,
  customer_Ingestion_Cliente_Id: null,
  customer_Ingestion_Secret: null,
};

// Customer telemetry settings map
var CUSTOMER_TELEMETRY_SETTINGS = {
  mapInstantaneousPower: null,
  minTemperature: null,
  maxTemperature: null,
};

// Chart domain configuration
var CHART_DOMAIN_CONFIG = {
  energy: { unit: 'kWh', unitLarge: 'MWh', threshold: 10000, label: 'Energia', icon: '⚡' },
  water: { unit: 'L', unitLarge: 'm\u00B3', threshold: 1000, label: '\u00C1gua', icon: '💧' },
  temperature: { unit: '\u00B0C', unitLarge: '\u00B0C', threshold: 999, label: 'Temperatura', icon: '🌡️' },
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
    waterCardMinWidth: widgetSettings.waterCardMinWidth ?? '160px',
    waterCardMaxWidth: widgetSettings.waterCardMaxWidth ?? '200px',
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

  LogHelper.log('[MAIN_BAS] ============ PARSING DATA ============');
  LogHelper.log('[MAIN_BAS] Total rows:', data.length);

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
    var entityName = datasource.entityName || datasource.name || ''; // The asset/device name (e.g., "Melicidade-Deck")
    var entityLabel = datasource.entityLabel || entityName || ''; // The label (e.g., "(001)-Deck")
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

      LogHelper.log(
        '[MAIN_BAS] Row ' +
          index +
          ': ' +
          JSON.stringify({
            aliasName: aliasName,
            entityType: entityType,
            entityId: entityId.substring(0, 8) + '...',
            entityName: entityName,
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
          entityName: entityName, // The asset name (e.g., "Melicidade-Deck")
          entityLabel: entityLabel, // The label (e.g., "(001)-Deck")
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
            entityName: entityName, // The device name (e.g., "Termostato-Auditorio")
            entityLabel: entityLabel, // The label (if configured)
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

  LogHelper.log('[MAIN_BAS] Phase 1 complete:');
  LogHelper.log('[MAIN_BAS]   Unique Ambientes:', Object.keys(ambientesMap).length);
  LogHelper.log('[MAIN_BAS]   Unique Devices:', Object.keys(devicesMap).length);

  // Phase 2: Process grouped Ambientes
  // RFC-0168: Capture 'type' attribute from collectedData for ASSET_AMBIENT filtering
  Object.keys(ambientesMap).forEach(function (entityId) {
    var entity = ambientesMap[entityId];
    ambientes.push({
      id: entityId,
      name: entity.entityName, // The asset name (e.g., "Melicidade-Deck")
      label: entity.entityLabel, // The label (e.g., "(001)-Deck")
      type: entity.collectedData.type || null, // RFC-0168: Asset type (e.g., "ASSET_AMBIENT")
      entityType: entity.entityType,
      aliasName: entity.aliasName,
      data: entity.collectedData,
    });
  });

  LogHelper.log(
    '[MAIN_BAS] Ambientes processed:',
    ambientes.map(function (a) {
      return { name: a.name, label: a.label };
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
    // Use label from collected data, fallback to entityLabel, then entityName, finally entityId
    var deviceLabel = cd.label || entity.entityLabel || entity.entityName || entityId;
    // Determine if device is online via connectionStatus attribute (values: 'online' | 'offline')
    var connectionStatus = (cd.connectionStatus || '').toLowerCase();
    var isOnline = connectionStatus === 'online';

    LogHelper.log(
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
          labelSources: {
            cdLabel: cd.label,
            entityLabel: entity.entityLabel,
            entityName: entity.entityName,
            entityId: entityId,
          },
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

    // Detect domain and context (using library functions per RFC-0111)
    // RFC-0171: Validate devices using deviceProfile (primary) and deviceType (fallback)
    // Use deviceProfile for domain detection as it's more reliable
    var effectiveType = deviceProfile || deviceType;
    var domain = window.MyIOLibrary.getDomainFromDeviceType(effectiveType);

    // RFC-0171: If domain is 'energy' (default), validate it's actually an energy device
    // Energy devices must pass isEnergyDevice check on deviceProfile (3F_MEDIDOR, MEDIDOR, etc.)
    // or be a valid motor/pump (BOMBA, MOTOR)
    if (domain === 'energy') {
      var profileUpper = deviceProfile.toUpperCase();
      var typeUpper = deviceType.toUpperCase();

      var isValidEnergy = window.MyIOLibrary.isEnergyDevice
        ? window.MyIOLibrary.isEnergyDevice(deviceProfile) || window.MyIOLibrary.isEnergyDevice(deviceType)
        : false;
      var isMotorPump =
        profileUpper.includes('BOMBA') ||
        profileUpper.includes('MOTOR') ||
        typeUpper.includes('BOMBA') ||
        typeUpper.includes('MOTOR');
      var isEntrada =
        profileUpper.includes('ENTRADA') ||
        profileUpper.includes('RELOGIO') ||
        profileUpper.includes('TRAFO') ||
        profileUpper.includes('SUBESTACAO');

      if (!isValidEnergy && !isMotorPump && !isEntrada) {
        LogHelper.log(
          '[MAIN_BAS] Skipping invalid energy device (deviceProfile not energy):',
          deviceLabel,
          'deviceProfile:',
          deviceProfile,
          'deviceType:',
          deviceType
        );
        return; // Skip this device - not a valid energy device
      }
    }

    var context = window.MyIOLibrary.detectContext(
      { deviceType: deviceType, deviceProfile: deviceProfile, identifier: identifier },
      domain
    );

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
      // Energy domain (includes motors/pumps) - already validated above
      device.consumption = parseFloat(cd.consumption || cd.energy || cd.power || 0);

      // Motors/pumps are energy domain with context 'bomba' or 'motor'
      if (context === 'bomba' || context === 'motor') {
        device.status = device.consumption > 0 ? 'running' : 'stopped';
        device.type = context === 'bomba' ? 'pump' : 'motor';
      }
    }

    // Add device to devices list
    devices.push(device);
    LogHelper.log('[MAIN_BAS] Added:', device.name, '| domain:', domain, '| context:', context);

    // Add to classified structure
    if (classified[domain] && classified[domain][context]) {
      classified[domain][context].push(device);
    } else {
      LogHelper.log('[MAIN_BAS] WARNING: No bucket for domain:', domain, 'context:', context);
    }
  });

  LogHelper.log('[MAIN_BAS] ============ PARSE COMPLETE ============');
  LogHelper.log('[MAIN_BAS] Ambientes:', ambientes.length);
  LogHelper.log('[MAIN_BAS] Devices:', devices.length);
  LogHelper.log('[MAIN_BAS] Classification:', {
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
 * Map ambiente prefix codes to SIDEBAR_ICONS keys
 * Uses professional SVG icons instead of emojis
 */
var AMBIENTE_ICON_MAP = {
  '001': 'deck', // Deck
  '002': 'nobreak', // Sala do Nobreak
  '003': 'auditorium', // Auditório
  '004': 'staff', // Staff Rio de Janeiro
  '005': 'pump', // Bombas
  '006': 'water', // Água
  '007': 'settings', // Configuração
  '008': 'link', // Integrações
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
 * Returns SVG icon from SIDEBAR_ICONS or null
 */
function getAmbienteIcon(label) {
  var code = getAmbientePrefixCode(label);
  if (!code || !AMBIENTE_ICON_MAP[code]) return null;
  var iconKey = AMBIENTE_ICON_MAP[code];
  return MyIOLibrary.SIDEBAR_ICONS?.[iconKey] || null;
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
    LogHelper.log('[MAIN_BAS] Action: Deck ->', ambiente.id);
    // Navigate to Deck dashboard state
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('deck', { entityId: ambiente.id });
    }
  },
  '(002)-Sala do Nobreak': function (ambiente) {
    LogHelper.log('[MAIN_BAS] Action: Sala do Nobreak ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('nobreak', { entityId: ambiente.id });
    }
  },
  '(003)-Auditório': function (ambiente) {
    LogHelper.log('[MAIN_BAS] Action: Auditório ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('auditorio', { entityId: ambiente.id });
    }
  },
  '(004)-Staff Rio de Janeiro': function (ambiente) {
    LogHelper.log('[MAIN_BAS] Action: Staff Rio de Janeiro ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('staff', { entityId: ambiente.id });
    }
  },
  '(005)-Bombas': function (ambiente) {
    LogHelper.log('[MAIN_BAS] Action: Bombas ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('bombas', { entityId: ambiente.id });
    }
  },
  '(006)-Água': function (ambiente) {
    LogHelper.log('[MAIN_BAS] Action: Água ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('agua', { entityId: ambiente.id });
    }
  },
  '(007)-Configuração': function (ambiente) {
    LogHelper.log('[MAIN_BAS] Action: Configuração ->', ambiente.id);
    if (self.ctx && self.ctx.stateController) {
      self.ctx.stateController.openState('config', { entityId: ambiente.id });
    }
  },
  '(008)-Integrações': function (ambiente) {
    LogHelper.log('[MAIN_BAS] Action: Integrações ->', ambiente.id);
    // RFC-0174: Open integrations modal with iframe tabs
    if (MyIOLibrary.openIntegrationsModal) {
      MyIOLibrary.openIntegrationsModal({
        theme: _settings?.themeMode || 'light',
        onClose: function () {
          LogHelper.log('[MAIN_BAS] Integrations modal closed');
        },
      });
    } else {
      LogHelper.warn('[MAIN_BAS] openIntegrationsModal not available in MyIOLibrary');
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
      LogHelper.log('[MAIN_BAS] Navigate to ambiente:', ambiente.id, label);
      self.ctx.stateController.openState('ambiente', { entityId: ambiente.id, entityName: label });
    };
  }

  return undefined;
}

/**
 * Build EntityListPanel items from ambiente assets
 * RFC-0168: Only include items with label pattern "(NNN)-" at the start
 * Examples: "(001)-Deck", "(002)-Sala do Nobreak", "(010)-Auditório"
 * This pattern identifies ASSET_AMBIENT items in the datasource
 */
function buildAmbienteItems(ambientes) {
  // RFC-0168: Filter to include only items with label pattern "(NNN)-"
  // Pattern matches: (001)-, (002)-, (010)-, (123)-, etc.
  var ambienteLabelPattern = /^\(\d{3}\)-/;

  var filteredAmbientes = ambientes.filter(function (ambiente) {
    var label = ambiente.label || '';
    var hasValidPattern = ambienteLabelPattern.test(label);

    if (!hasValidPattern) {
      LogHelper.log(
        '[MAIN_BAS] buildAmbienteItems: filtered out (no (NNN)- pattern):',
        ambiente.name || ambiente.id,
        'label:',
        label
      );
    }

    return hasValidPattern;
  });

  LogHelper.log('[MAIN_BAS] buildAmbienteItems: filtered', filteredAmbientes.length, 'of', ambientes.length, 'ambientes');

  return filteredAmbientes.map(function (ambiente) {
    // Use label (e.g., "(001)-Deck") for display, fallback to name (e.g., "Melicidade-Deck")
    var displayLabel = ambiente.label || ambiente.name || ambiente.id;
    return {
      id: ambiente.id,
      label: displayLabel,
      name: ambiente.name, // Keep the entity name for reference
      type: ambiente.type, // Keep type for debugging
      icon: getAmbienteIcon(displayLabel),
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
 * Build CardGridPanel items from HVAC devices (legacy device cards)
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

/**
 * Convert an HVAC device to ambienteData for renderCardAmbienteV6
 * Ambiente can contain: temperature sensor, 3F meter, remote control
 */
function hvacDeviceToAmbienteData(device) {
  var identifier = (device.rawData && device.rawData.identifier) || 'Sem ID';
  var status = device.status === 'online' ? 'online' : 'offline';

  LogHelper.log('[MAIN_BAS] hvacDeviceToAmbienteData:', {
    deviceId: device.id,
    deviceName: device.name,
    temperature: device.temperature,
    status: status,
  });

  // Build devices array from available data
  var devices = [];

  // Temperature device
  if (device.temperature != null) {
    devices.push({
      id: device.id + '_temp',
      type: 'temperature',
      deviceType: 'TERMOSTATO',
      status: status,
      value: device.temperature,
    });
  }

  // Energy device (if has consumption)
  if (device.consumption != null) {
    devices.push({
      id: device.id + '_energy',
      type: 'energy',
      deviceType: '3F_MEDIDOR',
      status: status,
      value: device.consumption,
    });
  }

  // Remote device (if has remote control capability)
  var hasRemote = device.rawData?.hasRemote || device.hasRemote || false;
  var isOn = device.rawData?.isOn || device.isOn || false;
  if (hasRemote) {
    devices.push({
      id: device.id + '_remote',
      type: 'remote',
      deviceType: 'REMOTE',
      status: status,
      value: isOn ? 1 : 0,
    });
  }

  return {
    id: device.id,
    label: device.name,
    identifier: identifier,
    temperature: device.temperature,
    consumption: device.consumption,
    isOn: isOn,
    hasRemote: hasRemote,
    status: status,
    devices: devices,
  };
}

/**
 * RFC-0168: Convert an ASSET_AMBIENT hierarchy node to AmbienteData for renderCardAmbienteV6
 *
 * Aggregates data from multiple child devices:
 * - Temperature & Humidity from TERMOSTATO devices
 * - Consumption from 3F_MEDIDOR, FANCOIL, AR_CONDICIONADO_SPLIT devices
 * - Remote control from REMOTE devices
 *
 * @param {Object} hierarchyNode - ASSET_AMBIENT node from buildAssetAmbientHierarchy
 * @returns {Object} AmbienteData for card rendering
 */
function assetAmbientToAmbienteData(hierarchyNode) {
  var devices = hierarchyNode.devices || [];
  var aggregatedData = hierarchyNode.aggregatedData || {};

  // Find temperature and humidity from TERMOSTATO devices
  var temperature = null;
  var humidity = null;
  var termostatoDevice = devices.find(function (d) {
    var dt = (d.deviceType || '').toUpperCase();
    return dt.includes('TERMOSTATO');
  });

  if (termostatoDevice) {
    // Get temperature from rawData or direct property
    temperature =
      (termostatoDevice.rawData && termostatoDevice.rawData.temperature) ||
      termostatoDevice.temperature;
    // Get humidity from rawData or direct property
    humidity =
      (termostatoDevice.rawData && termostatoDevice.rawData.humidity) ||
      termostatoDevice.humidity;
  } else if (aggregatedData.temperature) {
    // Fallback to aggregated temperature average
    temperature = aggregatedData.temperature.avg;
  }

  // Helper function to check if a device is a REMOTE/LAMP control device
  // Check deviceType, deviceProfile, AND type attribute (from rawData or collectedData)
  // RFC-0172: LAMP has same behavior as REMOTE
  function isRemoteDevice(d) {
    var dt = (d.deviceType || '').toUpperCase();
    var dp = (d.deviceProfile || '').toUpperCase();
    var typeAttr = ((d.rawData && d.rawData.type) || d.type || '').toUpperCase();
    return (
      dt.includes('REMOTE') ||
      dt.includes('CONTROLE') ||
      dt.includes('LAMP') ||
      dp.includes('REMOTE') ||
      dp.includes('CONTROLE') ||
      dp.includes('LAMP') ||
      typeAttr === 'REMOTE' ||
      typeAttr === 'LAMP' ||
      typeAttr.includes('CONTROLE')
    );
  }

  // Collect individual energy devices (3F_MEDIDOR, FANCOIL, AR_CONDICIONADO_SPLIT)
  // EXCLUDE devices that are REMOTE controls
  var energyDevices = [];
  var consumptionTotal = 0;
  var hasConsumption = false;
  devices.forEach(function (d) {
    // Skip REMOTE devices - they are not energy meters
    if (isRemoteDevice(d)) {
      return;
    }

    var dt = (d.deviceType || '').toUpperCase();
    if (
      dt.includes('3F_MEDIDOR') ||
      dt.includes('FANCOIL') ||
      dt.includes('AR_CONDICIONADO') ||
      dt.includes('MEDIDOR')
    ) {
      var consumption = (d.rawData && d.rawData.consumption) || d.consumption;
      var consumptionValue = consumption != null && !isNaN(consumption) ? parseFloat(consumption) : null;
      if (consumptionValue != null) {
        consumptionTotal += consumptionValue;
        hasConsumption = true;
      }
      // Add individual energy device info
      energyDevices.push({
        id: d.id,
        name: d.name || d.label || 'Medidor',
        label: (d.rawData && d.rawData.label) || d.label || d.name || 'Medidor',
        deviceType: d.deviceType,
        consumption: consumptionValue,
        status: d.status || 'offline',
      });
    }
  });

  // Collect ALL remote control devices
  var remoteDevices = [];
  devices.forEach(function (d) {
    if (isRemoteDevice(d)) {
      // Get the state from various possible sources
      var state = (d.rawData && d.rawData.state) || d.state || 'off';
      var isDeviceOn =
        state === 'on' ||
        state === 'ON' ||
        state === true ||
        state === 1 ||
        (d.rawData && d.rawData.isOn === true) ||
        d.isOn === true;

      remoteDevices.push({
        id: d.id,
        name: d.name || d.label || 'Controle',
        label: (d.rawData && d.rawData.label) || d.label || d.name || 'Controle',
        deviceType: d.deviceType || 'REMOTE',
        isOn: isDeviceOn,
        state: state,
        status: d.status || 'offline',
      });
    }
  });

  var hasRemote = remoteDevices.length > 0;
  var isOn = remoteDevices.some(function (r) { return r.isOn; });

  // Determine overall status
  var onlineCount = aggregatedData.onlineCount || 0;
  var offlineCount = aggregatedData.offlineCount || 0;
  var status = 'offline';
  if (hierarchyNode.hasSetupWarning) {
    status = 'warning';
  } else if (onlineCount > 0 && offlineCount === 0) {
    status = 'online';
  } else if (onlineCount > 0) {
    status = 'online'; // Mixed state, show as online
  }

  // Build devices array for the card
  var cardDevices = [];

  // Add temperature device if available
  if (temperature != null) {
    cardDevices.push({
      id: termostatoDevice ? termostatoDevice.id + '_temp' : hierarchyNode.id + '_temp',
      type: 'temperature',
      deviceType: 'TERMOSTATO',
      status: termostatoDevice ? termostatoDevice.status : status,
      value: temperature,
    });
  }

  // Add energy device if available
  if (hasConsumption) {
    cardDevices.push({
      id: hierarchyNode.id + '_energy',
      type: 'energy',
      deviceType: '3F_MEDIDOR',
      status: status,
      value: consumptionTotal,
    });
  }

  // Add remote devices to cardDevices array
  remoteDevices.forEach(function (remote) {
    cardDevices.push({
      id: remote.id + '_remote',
      type: 'remote',
      deviceType: 'REMOTE',
      status: remote.status,
      value: remote.isOn ? 1 : 0,
    });
  });

  LogHelper.log('[MAIN_BAS] assetAmbientToAmbienteData:', {
    id: hierarchyNode.id,
    displayLabel: hierarchyNode.displayLabel,
    temperature: temperature,
    humidity: humidity,
    consumption: hasConsumption ? consumptionTotal : null,
    energyDevices: energyDevices,
    remoteDevices: remoteDevices,
    hasRemote: hasRemote,
    isOn: isOn,
    status: status,
    hasSetupWarning: hierarchyNode.hasSetupWarning,
    deviceCount: devices.length,
  });

  return {
    id: hierarchyNode.id,
    label: hierarchyNode.displayLabel,
    identifier: hierarchyNode.name,
    temperature: temperature,
    humidity: humidity, // RFC-0168: New field
    consumption: hasConsumption ? consumptionTotal : null,
    energyDevices: energyDevices, // Individual energy devices for card display
    remoteDevices: remoteDevices, // Individual remote control devices
    isOn: isOn,
    hasRemote: hasRemote,
    status: status,
    hasSetupWarning: hierarchyNode.hasSetupWarning, // RFC-0168: New field
    devices: cardDevices,
    childDeviceCount: devices.length,
  };
}

/**
 * RFC-0168: Build CardGridPanel items for ambiente cards from ASSET_AMBIENT hierarchy
 *
 * Changed from using HVAC devices directly to using ASSET_AMBIENT hierarchy.
 * Each ASSET_AMBIENT becomes a card with aggregated data from its child devices.
 *
 * @param {Object} assetAmbientHierarchy - ASSET_AMBIENT hierarchy from buildAssetAmbientHierarchy
 * @param {string|null} selectedAmbienteId - ID of selected ambiente to filter, or null for all
 */
function buildAmbienteCardItems(assetAmbientHierarchy, selectedAmbienteId) {
  var hierarchyNodes = Object.values(assetAmbientHierarchy || {});
  var filtered = hierarchyNodes;

  if (selectedAmbienteId) {
    filtered = hierarchyNodes.filter(function (node) {
      return node.id === selectedAmbienteId;
    });
  }

  return filtered.map(function (node) {
    return {
      id: node.id,
      ambienteData: assetAmbientToAmbienteData(node),
      source: node,
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
 * RFC-0171: Filter to include only devices that pass isEnergyDevice check
 * @param {Object} classified - Classified device structure
 * @param {string|null} selectedAmbienteId - ID of selected ambiente to filter, or null for all
 */
function buildEnergyCardItems(classified, selectedAmbienteId) {
  var energyDevices = getEnergyEquipmentDevicesFromClassified(classified);

  // RFC-0171: Filter to include only valid energy devices
  // Use MyIOLibrary.isEnergyDevice to validate deviceType/deviceProfile
  var validEnergyDevices = energyDevices.filter(function (device) {
    var deviceType = device.deviceType || device.deviceProfile || '';
    var isValid = MyIOLibrary.isEnergyDevice ? MyIOLibrary.isEnergyDevice(deviceType) : true;

    if (!isValid) {
      LogHelper.log(
        '[MAIN_BAS] buildEnergyCardItems: filtered out non-energy device:',
        device.name,
        'deviceType:',
        deviceType
      );
    }

    return isValid;
  });

  LogHelper.log(
    '[MAIN_BAS] buildEnergyCardItems: filtered',
    validEnergyDevices.length,
    'of',
    energyDevices.length,
    'devices'
  );

  var filtered = validEnergyDevices;
  if (selectedAmbienteId) {
    filtered = validEnergyDevices.filter(function (d) {
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
      display: flex;
      flex-direction: column;
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

  // Wrap in container for positioning (close button goes here, outside panelContainer's overflow:hidden)
  var container = document.createElement('div');
  container.style.cssText =
    'position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;';
  container.appendChild(panelContainer);

  // Add close button with fixed position (avoids panelContainer's overflow:hidden clipping)
  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 44px;
    height: 44px;
    border: 2px solid #ffffff;
    background: #dc2626;
    color: #ffffff;
    font-size: 26px;
    line-height: 1;
    border-radius: 50%;
    cursor: pointer;
    z-index: 10001;
    transition: background 0.15s ease, transform 0.15s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.addEventListener('mouseenter', function () {
    closeBtn.style.background = '#b91c1c';
    closeBtn.style.transform = 'scale(1.1)';
  });
  closeBtn.addEventListener('mouseleave', function () {
    closeBtn.style.background = '#dc2626';
    closeBtn.style.transform = 'scale(1)';
  });
  closeBtn.addEventListener('click', closeMaximizedPanel);
  container.appendChild(closeBtn);

  overlay.innerHTML = '';
  overlay.appendChild(container);

  // Show overlay with animation
  overlay.style.pointerEvents = 'auto';
  window.requestAnimationFrame(function () {
    overlay.style.opacity = '1';
    panelContainer.style.transform = 'scale(1)';
  });

  _maximizedPanel = { overlay: overlay, panel: panelContainer, title: panelTitle, isChart: opts.isChart };

  LogHelper.log(
    '[MAIN_BAS] Panel maximized:',
    panelTitle,
    '| theme:',
    (_settings && _settings.defaultThemeMode) || 'light',
    '| isChart:',
    !!opts.isChart
  );
}

/**
 * Create a chart instance in a specific container (for maximized view)
 * RFC-0098: Updated to use createConsumptionChartWidget
 */
var _maximizedChartInstance = null;

function switchChartDomainInContainer(domain, container) {
  // Destroy existing maximized chart
  if (_maximizedChartInstance) {
    if (typeof _maximizedChartInstance.destroy === 'function') {
      _maximizedChartInstance.destroy();
    }
    _maximizedChartInstance = null;
  }

  // Clear container and create widget container
  container.innerHTML = '';
  var widgetContainer = document.createElement('div');
  var containerId = 'bas-chart-widget-maximized-' + domain + '-' + Date.now(); // Unique ID
  widgetContainer.id = containerId;
  widgetContainer.style.cssText = 'width: 100%; height: 100%; flex: 1; min-height: 0; display: flex; flex-direction: column;';
  container.appendChild(widgetContainer);

  var cfg = CHART_DOMAIN_CONFIG[domain];
  if (!cfg) return;

  // RFC-0098: Use createConsumptionChartWidget for maximized view
  // Wait for container to be in DOM before creating widget
  setTimeout(function () {
    // Verify container is in DOM
    if (!document.getElementById(containerId)) {
      LogHelper.error('[MAIN_BAS] Maximized container not found in DOM:', containerId);
      return;
    }

    if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createConsumptionChartWidget) {
      LogHelper.log('[MAIN_BAS] Using createConsumptionChartWidget for maximized view, domain:', domain);

      _maximizedChartInstance = MyIOLibrary.createConsumptionChartWidget({
        domain: domain,
        containerId: containerId,
        title: cfg.label + ' - Últimos 7 dias',
        unit: cfg.unit,
        unitLarge: cfg.unitLarge,
        thresholdForLargeUnit: cfg.threshold,
        decimalPlaces: domain === 'temperature' ? 1 : 2,
        chartHeight: '100%',
        fullHeight: true, // Enable full height mode for maximized view
        defaultPeriod: 7,
        defaultChartType: domain === 'temperature' ? 'line' : 'bar',
        defaultVizMode: 'total',
        theme: (_settings && _settings.defaultThemeMode) || 'light',
        showSettingsButton: false,
        showMaximizeButton: false,
        showVizModeTabs: true,
        showChartTypeTabs: true,

        // Compact header styles for maximized view
        headerStyles: {
          padding: '8px 14px',
          gap: '10px',
          titleFontSize: '12px',
          tabPadding: '4px 10px',
          tabFontSize: '11px',
        },

        // Data fetching
        fetchData: createRealFetchData(domain, { preferCache: true, maxAgeMs: 15 * 60 * 1000 }),

        // Callbacks
        onDataLoaded: function (data) {
          LogHelper.log('[MAIN_BAS] Maximized chart data loaded for', domain, ':', data.labels?.length, 'days');
        },
        onError: function (error) {
          LogHelper.error('[MAIN_BAS] Maximized chart error for', domain, ':', error);
        },
      });

      _maximizedChartInstance.render().catch(function (err) {
        LogHelper.error('[MAIN_BAS] Failed to render maximized chart widget:', err);
      });
    } else if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createConsumption7DaysChart) {
      // Fallback
      LogHelper.warn('[MAIN_BAS] createConsumptionChartWidget not available for maximized view, using fallback');

      container.innerHTML = '';
      var canvas = document.createElement('canvas');
      canvas.id = 'bas-chart-canvas-maximized';
      canvas.style.cssText = 'width: 100%; height: 100%;';
      container.appendChild(canvas);

      _maximizedChartInstance = MyIOLibrary.createConsumption7DaysChart({
        domain: domain,
        containerId: 'bas-chart-canvas-maximized',
        unit: cfg.unit,
        unitLarge: cfg.unitLarge,
        thresholdForLargeUnit: cfg.threshold,
        fetchData: createRealFetchData(domain, { preferCache: true, maxAgeMs: 15 * 60 * 1000 }),
        defaultPeriod: 7,
        defaultChartType: domain === 'temperature' ? 'line' : 'bar',
        theme: (_settings && _settings.defaultThemeMode) || 'dark',
        showLegend: true,
        fill: domain === 'temperature',
      });

      _maximizedChartInstance.render();
    } else {
      LogHelper.warn('[MAIN_BAS] No chart library available for maximized view');
    }
  }, 100); // Wait 100ms for DOM to be ready
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

  LogHelper.log('[MAIN_BAS] Panel minimize');
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
    LogHelper.warn('[MAIN_BAS] MyIOLibrary.FilterModalComponent not available');
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
    LogHelper.log('[MAIN_BAS] No categories to filter');
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
      LogHelper.log('[MAIN_BAS] Filter applied:', {
        panelType: panelType,
        categories: selectedCategories,
        sort: sortOption,
      });
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
  LogHelper.log('[MAIN_BAS] mountWaterPanel called, CardGridPanel available:', !!MyIOLibrary.CardGridPanel);
  if (!MyIOLibrary.CardGridPanel) {
    LogHelper.warn('[MAIN_BAS] MyIOLibrary.CardGridPanel not available');
    return null;
  }

  // Apply water card size CSS variables to the host
  if (settings.waterCardMinWidth) {
    waterHost.style.setProperty('--bas-water-card-width', settings.waterCardMinWidth);
  }
  if (settings.waterCardMaxWidth) {
    waterHost.style.setProperty('--bas-water-card-max-width', settings.waterCardMaxWidth);
  }

  var waterItems = buildWaterCardItems(classified, null);
  var waterDevices = getWaterDevicesFromClassified(classified);
  var currentFilter = { categories: null, sortId: null };
  var currentWaterTab = 'all'; // Track selected tab: 'all', 'tank', 'hydrometer', 'solenoid'

  // Helper to filter items by tab
  function filterWaterItemsByTab(items, tabId) {
    if (tabId === 'all') return items;
    return items.filter(function (item) {
      var type = item.source?.type || '';
      return type === tabId;
    });
  }

  // Water tab configuration
  var waterTabs = [
    {
      id: 'all',
      label: 'Todos',
      selected: true,
      handleClick: function () {
        currentWaterTab = 'all';
        var filtered = filterWaterItemsByTab(waterItems, 'all');
        panel.setItems(filtered);
        panel.setQuantity(filtered.length);
      },
    },
    {
      id: 'tank',
      label: "Caixa d'Água",
      selected: false,
      handleClick: function () {
        currentWaterTab = 'tank';
        var filtered = filterWaterItemsByTab(waterItems, 'tank');
        panel.setItems(filtered);
        panel.setQuantity(filtered.length);
      },
    },
    {
      id: 'hydrometer',
      label: 'Hidrômetro',
      selected: false,
      handleClick: function () {
        currentWaterTab = 'hydrometer';
        var filtered = filterWaterItemsByTab(waterItems, 'hydrometer');
        panel.setItems(filtered);
        panel.setQuantity(filtered.length);
      },
    },
    {
      id: 'solenoid',
      label: 'Solenóide',
      selected: false,
      handleClick: function () {
        currentWaterTab = 'solenoid';
        var filtered = filterWaterItemsByTab(waterItems, 'solenoid');
        panel.setItems(filtered);
        panel.setQuantity(filtered.length);
      },
    },
  ];

  // Use premium green header style from library
  var waterHeaderStyle = MyIOLibrary.HEADER_STYLE_PREMIUM_GREEN || {
    height: '36px',
    fontSize: '0.7rem',
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    backgroundColor: 'linear-gradient(135deg, #2F5848 0%, #3d7a62 100%)',
    topBorderColor: 'transparent',
    bottomBorderColor: 'transparent',
    iconColor: '#a7d4c0',
    quantityBackground: 'rgba(255, 255, 255, 0.2)',
    quantityColor: '#ffffff',
    buttonColor: 'rgba(255, 255, 255, 0.7)',
    buttonHoverBackground: 'rgba(255, 255, 255, 0.15)',
    buttonHoverColor: '#ffffff',
    searchBackground: 'rgba(255, 255, 255, 0.15)',
    searchColor: '#ffffff',
    searchPlaceholderColor: 'rgba(255, 255, 255, 0.5)',
  };

  var panel = new MyIOLibrary.CardGridPanel({
    title: 'Infraestrutura Hidrica',
    icon: '💧',
    quantity: waterItems.length,
    items: waterItems,
    tabs: waterTabs,
    panelBackground: settings.waterPanelBackground,
    cardCustomStyle: settings.cardCustomStyle || { height: '90px' },
    titleStyle: waterHeaderStyle,
    gridMinCardWidth: settings.waterCardMinWidth || '160px',
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
      LogHelper.log('[MAIN_BAS] Water device clicked:', item.source);
      window.dispatchEvent(new CustomEvent('bas:device-clicked', { detail: { device: item.source } }));

      var deviceProfile = (item.source?.deviceProfile || item.source?.deviceType || '').toUpperCase();

      // RFC-0167: Check if this is an On/Off device (solenoid, switch, relay, pump)
      if (isOnOffDeviceProfile(deviceProfile)) {
        // RFC-0167: Open On/Off Device modal
        openOnOffDeviceModal(item.source, settings);
      } else if (isHidrometerDevice(deviceProfile)) {
        // RFC-0172: Open BAS Water modal for HIDROMETRO devices
        openBASWaterModal(item.source, settings);
      } else {
        // Fallback: Log warning for unhandled water device type
        LogHelper.warn('[MAIN_BAS] Unhandled water device type:', deviceProfile);
      }
    },
  });

  waterHost.appendChild(panel.getElement());
  return panel;
}

/**
 * Mount CardGridPanel into #bas-ambientes-host (HVAC devices as Ambiente cards)
 */
/**
 * RFC-0168: Mount Ambientes Panel using ASSET_AMBIENT hierarchy
 *
 * Changed to receive ASSET_AMBIENT hierarchy instead of classified devices.
 * Each ASSET_AMBIENT becomes a card with aggregated data from its child devices.
 *
 * @param {HTMLElement} host - Container element
 * @param {Object} settings - Widget settings
 * @param {Object} assetAmbientHierarchy - ASSET_AMBIENT hierarchy from buildAssetAmbientHierarchy
 */
function mountAmbientesPanel(host, settings, assetAmbientHierarchy) {
  LogHelper.log(
    '[MAIN_BAS] mountAmbientesPanel called, CardGridPanel available:',
    !!MyIOLibrary.CardGridPanel
  );
  LogHelper.log('[MAIN_BAS] ASSET_AMBIENT hierarchy count:', Object.keys(assetAmbientHierarchy || {}).length);

  if (!MyIOLibrary.CardGridPanel) {
    LogHelper.warn('[MAIN_BAS] MyIOLibrary.CardGridPanel not available');
    return null;
  }

  // RFC-0168: Build items from ASSET_AMBIENT hierarchy
  var ambienteItems = buildAmbienteCardItems(assetAmbientHierarchy, null);
  var currentFilter = { categories: null, sortId: null };

  // Use premium green header style from library
  var headerStyle = MyIOLibrary.HEADER_STYLE_PREMIUM_GREEN || {
    height: '36px',
    fontSize: '0.7rem',
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    backgroundColor: 'linear-gradient(135deg, #2F5848 0%, #3d7a62 100%)',
    topBorderColor: 'transparent',
    bottomBorderColor: 'transparent',
    iconColor: '#a7d4c0',
    quantityBackground: 'rgba(255, 255, 255, 0.2)',
    quantityColor: '#ffffff',
    buttonColor: 'rgba(255, 255, 255, 0.7)',
    buttonHoverBackground: 'rgba(255, 255, 255, 0.15)',
    buttonHoverColor: '#ffffff',
    searchBackground: 'rgba(255, 255, 255, 0.15)',
    searchColor: '#ffffff',
    searchPlaceholderColor: 'rgba(255, 255, 255, 0.5)',
  };

  var panel = new MyIOLibrary.CardGridPanel({
    title: settings.environmentsLabel,
    icon: '🌡️',
    quantity: ambienteItems.length,
    items: ambienteItems,
    cardType: 'ambiente',
    panelBackground: settings.environmentsPanelBackground,
    cardCustomStyle: settings.cardCustomStyle || { height: '90px' },
    titleStyle: headerStyle,
    gridMinCardWidth: '140px',
    gridGap: settings.cardGridGap,
    emptyMessage: 'Nenhum ambiente',
    showSearch: true,
    searchPlaceholder: 'Buscar...',
    showFilter: true,
    showMaximize: true,
    handleActionFilter: function () {
      // RFC-0168: For filtering, extract devices from all ASSET_AMBIENTs
      var allDevices = [];
      Object.values(assetAmbientHierarchy || {}).forEach(function (node) {
        allDevices = allDevices.concat(node.devices || []);
      });

      openFilterModal('hvac', allDevices, currentFilter, function (selectedCategories, sortOption) {
        currentFilter.categories = selectedCategories;
        currentFilter.sortId = sortOption ? sortOption.id : null;

        // RFC-0168: Filter ASSET_AMBIENTs based on their devices' contexts
        var filteredItems = buildAmbienteCardItems(assetAmbientHierarchy, _selectedAmbiente).filter(
          function (item) {
            if (!selectedCategories || selectedCategories.length === 0) return true;
            // Check if any device in this ambiente matches the selected categories
            var devices = item.source?.devices || [];
            return devices.some(function (d) {
              var context = d.context || '';
              return selectedCategories.includes(context);
            });
          }
        );

        if (sortOption) {
          filteredItems.sort(function (a, b) {
            var valA, valB;
            if (sortOption.field === 'label') {
              valA = a.ambienteData?.label || '';
              valB = b.ambienteData?.label || '';
              return sortOption.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            valA = a.ambienteData?.temperature || 0;
            valB = b.ambienteData?.temperature || 0;
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
      LogHelper.log('[MAIN_BAS] Ambiente clicked:', item.ambienteData);
      window.dispatchEvent(
        new CustomEvent('bas:ambiente-clicked', {
          detail: { ambiente: item.ambienteData, source: item.source },
        })
      );

      // RFC-0168: Open Ambiente Detail Modal
      openAmbienteDetailModal(item.ambienteData, item.source, settings);
    },
    handleToggleRemote: function (isOn, item) {
      LogHelper.log('[MAIN_BAS] Ambiente remote toggle:', isOn, item.ambienteData);
      window.dispatchEvent(
        new CustomEvent('bas:ambiente-remote-toggle', {
          detail: { isOn: isOn, ambiente: item.ambienteData, source: item.source },
        })
      );
    },
  });

  host.appendChild(panel.getElement());
  return panel;
}

/**
 * RFC-0165: Open BAS Device Modal with automation control panel
 * @param {Object} device - Device data from classified
 * @param {Object} settings - Widget settings
 */
function openBASDeviceModal(device, settings) {
  if (!MyIOLibrary.openDashboardPopupEnergy) {
    LogHelper.warn('[MAIN_BAS] openDashboardPopupEnergy not available');
    return;
  }

  // Build BAS device data from classified device
  var deviceType = device.deviceType || device.deviceProfile || '';
  var hasRemote =
    deviceType.toUpperCase().includes('REMOTE') ||
    device.hasRemote === true ||
    (device.rawData && device.rawData.remote_available === true);

  var basDevice = {
    id: device.id || device.deviceId,
    entityId: device.entityId || device.id,
    label: device.name || device.label || 'Dispositivo',
    deviceType: deviceType,
    deviceProfile: device.deviceProfile,
    hasRemote: hasRemote,
    isRemoteOn: device.isOn || device.rawData?.remote_status === 'on',
    status: device.connectionStatus || device.deviceStatus || 'unknown',
    telemetry: {
      power: device.rawData?.power || device.rawData?.potencia,
      current: device.rawData?.current || device.rawData?.corrente,
      voltage: device.rawData?.voltage || device.rawData?.tensao,
      temperature: device.rawData?.temperature || device.rawData?.temperatura,
      consumption: device.consumption || device.val || device.rawData?.consumption,
      lastUpdate: Date.now(),
    },
  };

  // Get date range (last 7 days default)
  var endDate = new Date();
  var startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  var startDateStr = startDate.toISOString().split('T')[0];
  var endDateStr = endDate.toISOString().split('T')[0];

  LogHelper.log('[MAIN_BAS] Opening BAS modal for device:', basDevice);

  // Get JWT token from localStorage or widget context
  var jwtToken = localStorage.getItem('jwt_token');
  if (!jwtToken && _ctx && _ctx.http && _ctx.http.token) {
    jwtToken = _ctx.http.token;
  }

  if (!jwtToken) {
    LogHelper.warn('[MAIN_BAS] No JWT token available for BAS modal');
  }

  // Get ingestion token using MyIO.buildMyioIngestionAuth
  var clientId = MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Cliente_Id;
  var clientSecret = MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Secret;

  if (!clientId || !clientSecret) {
    LogHelper.warn('[MAIN_BAS] No client credentials available for BAS modal - chart data may not load');
  }

  // Build auth and get token
  var myIOAuth = MyIOLibrary.buildMyioIngestionAuth({
    dataApiHost: 'https://api.data.apps.myio-bas.com',
    clientId: clientId,
    clientSecret: clientSecret,
  });

  myIOAuth
    .getToken()
    .then(function (ingestionToken) {
      LogHelper.log('[MAIN_BAS] Ingestion token obtained successfully');

      // Open modal in BAS mode
      MyIOLibrary.openDashboardPopupEnergy({
        basMode: true,
        basDevice: basDevice,
        deviceId: basDevice.entityId,
        deviceLabel: basDevice.label,
        startDate: startDateStr,
        endDate: endDateStr,
        tbJwtToken: jwtToken,
        ingestionToken: ingestionToken,
        clientId: clientId,
        clientSecret: clientSecret,
        readingType: 'energy',
        granularity: '1d',
        theme: 'dark',
        telemetryRefreshInterval: 10000,
        onRemoteCommand: function (command, dev) {
          return sendRemoteCommand(dev.entityId, command);
        },
        onTelemetryRefresh: function (dev) {
          return fetchDeviceTelemetry(dev.entityId);
        },
        onClose: function () {
          LogHelper.log('[MAIN_BAS] BAS modal closed');
        },
        onError: function (err) {
          LogHelper.error('[MAIN_BAS] BAS modal error:', err);
        },
      });
    })
    .catch(function (err) {
      LogHelper.error('[MAIN_BAS] Failed to get ingestion token:', err);
    });
}

/**
 * RFC-0172: Open BAS Water Modal for HIDROMETRO devices
 * Shows water telemetry (m3, pulses = liters)
 * @param {Object} device - Device data from classified
 * @param {Object} settings - Widget settings
 */
function openBASWaterModal(device, settings) {
  if (!MyIOLibrary.openDashboardPopupEnergy) {
    LogHelper.warn('[MAIN_BAS] openDashboardPopupEnergy not available for water modal');
    return;
  }

  // Build water device data
  var deviceType = device.deviceType || device.deviceProfile || 'HIDROMETRO';
  var deviceProfile = device.deviceProfile || device.deviceType || 'HIDROMETRO';

  var waterDevice = {
    id: device.id || device.deviceId,
    entityId: device.entityId || device.id,
    label: device.name || device.label || 'Hidrômetro',
    deviceType: deviceType,
    deviceProfile: deviceProfile,
    status: device.connectionStatus || device.deviceStatus || device.status || 'unknown',
    telemetry: {
      // Water-specific telemetry (m3, pulses = liters)
      volume: device.rawData?.volume || device.rawData?.m3 || device.value || device.val || 0,
      pulses: device.rawData?.pulses || device.rawData?.pulsos || 0,
      flowRate: device.rawData?.flow_rate || device.rawData?.vazao || 0,
      consumption: device.consumption || device.value || device.val || 0,
      lastUpdate: Date.now(),
    },
  };

  // Get date range (last 7 days default)
  var endDate = new Date();
  var startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  var startDateStr = startDate.toISOString().split('T')[0];
  var endDateStr = endDate.toISOString().split('T')[0];

  LogHelper.log('[MAIN_BAS] Opening BAS Water modal for device:', waterDevice);

  // Get JWT token from localStorage or widget context
  var jwtToken = localStorage.getItem('jwt_token');
  if (!jwtToken && _ctx && _ctx.http && _ctx.http.token) {
    jwtToken = _ctx.http.token;
  }

  if (!jwtToken) {
    LogHelper.warn('[MAIN_BAS] No JWT token available for BAS Water modal');
  }

  // Get ingestion token using MyIO.buildMyioIngestionAuth
  var clientId = MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Cliente_Id;
  var clientSecret = MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Secret;

  if (!clientId || !clientSecret) {
    LogHelper.warn('[MAIN_BAS] No client credentials available for BAS Water modal - chart data may not load');
  }

  // Build auth and get token
  var myIOAuth = MyIOLibrary.buildMyioIngestionAuth({
    dataApiHost: 'https://api.data.apps.myio-bas.com',
    clientId: clientId,
    clientSecret: clientSecret,
  });

  myIOAuth
    .getToken()
    .then(function (ingestionToken) {
      LogHelper.log('[MAIN_BAS] Ingestion token obtained for water modal');

      // Open modal with water readingType
      MyIOLibrary.openDashboardPopupEnergy({
        basMode: true,
        basDevice: waterDevice,
        deviceId: waterDevice.entityId,
        deviceLabel: waterDevice.label,
        startDate: startDateStr,
        endDate: endDateStr,
        tbJwtToken: jwtToken,
        ingestionToken: ingestionToken,
        clientId: clientId,
        clientSecret: clientSecret,
        readingType: 'water', // RFC-0172: Water domain
        granularity: '1d',
        theme: 'dark',
        telemetryRefreshInterval: 10000,
        // Water-specific telemetry keys
        telemetryKeys: ['volume', 'm3', 'pulses', 'pulsos', 'flow_rate', 'vazao', 'consumption'],
        onTelemetryRefresh: function (dev) {
          return fetchDeviceTelemetry(dev.entityId);
        },
        onClose: function () {
          LogHelper.log('[MAIN_BAS] BAS Water modal closed');
        },
        onError: function (err) {
          LogHelper.error('[MAIN_BAS] BAS Water modal error:', err);
        },
      });
    })
    .catch(function (err) {
      LogHelper.error('[MAIN_BAS] Failed to get ingestion token for water modal:', err);
    });
}

/**
 * RFC-0172: Check if device profile is HIDROMETRO (water meter)
 */
function isHidrometerDevice(deviceProfile) {
  var profile = (deviceProfile || '').toUpperCase();
  return profile.includes('HIDROMETRO') || profile.includes('HYDROMETER') || profile === 'WATER_METER';
}

/**
 * RFC-0167: On/Off device profiles that use the specialized modal
 */
var ON_OFF_DEVICE_PROFILES = ['SOLENOIDE', 'INTERRUPTOR', 'RELE', 'BOMBA'];

/**
 * RFC-0167: Check if a device profile is an On/Off device
 * @param {string} deviceProfile - Device profile string
 * @returns {boolean}
 */
function isOnOffDeviceProfile(deviceProfile) {
  var profile = (deviceProfile || '').toUpperCase();
  return ON_OFF_DEVICE_PROFILES.indexOf(profile) !== -1;
}

/**
 * RFC-0170: Check if an ASSET_AMBIENT node is a leaf (has no sub-ambientes)
 * A node is a leaf if no other node's name starts with its name + "-"
 * @param {Object} node - The node to check
 * @param {Object[]} allNodes - All nodes in the hierarchy
 * @returns {boolean} True if this is a leaf node
 */
function isAssetAmbientLeaf(node, allNodes) {
  var nodeName = node.name || '';
  if (!nodeName) return true;

  // Check if any other node's name starts with this node's name + "-"
  // e.g., "Melicidade-Deck-Climatização" is NOT a leaf because
  // "Melicidade-Deck-Climatização-Direita" starts with it
  for (var i = 0; i < allNodes.length; i++) {
    var otherNode = allNodes[i];
    if (otherNode.id === node.id) continue;
    var otherName = otherNode.name || '';
    if (otherName.startsWith(nodeName + '-')) {
      return false;
    }
  }
  return true;
}

/**
 * RFC-0170: Find sub-ambientes for a given parent ambiente
 * Matches by label prefix or name pattern, returns ONLY LEAF nodes
 * @param {Object} parentItem - Parent item from sidebar
 * @returns {Array} Array of sub-ambiente items (only leaves)
 */
function findSubAmbientesForParent(parentItem) {
  if (!_assetAmbientHierarchy) return [];

  // Get the display label without prefix (e.g., "Deck" from "(001)-Deck")
  var parentLabel = removeAmbientePrefixFromLabel(parentItem.label || '');
  var parentName = parentItem.name || '';

  LogHelper.log('[MAIN_BAS] Finding sub-ambientes for:', parentLabel, parentName);

  var allMatchingNodes = [];
  var hierarchyNodes = Object.values(_assetAmbientHierarchy);

  // Step 1: Find all nodes that match the parent pattern
  hierarchyNodes.forEach(function (node) {
    var nodeLabel = removeAmbientePrefixFromLabel(node.displayLabel || node.originalLabel || '');

    // Check if this node matches the parent or is a child of the parent
    // Match patterns:
    // 1. Exact match: "Deck" === "Deck"
    // 2. Child match: "Deck - Climatização" starts with "Deck"
    // 3. Name-based match: node.name starts with parentName
    var isMatch = nodeLabel === parentLabel ||
                  nodeLabel.startsWith(parentLabel + ' - ') ||
                  nodeLabel.startsWith(parentLabel + ' ') ||
                  (parentName && node.name && node.name.startsWith(parentName + '-'));

    if (isMatch) {
      allMatchingNodes.push(node);
    }
  });

  LogHelper.log('[MAIN_BAS] Found matching nodes:', allMatchingNodes.length);

  // Step 2: Filter to keep only LEAF nodes (no sub-ambientes)
  var subAmbientes = [];
  allMatchingNodes.forEach(function (node) {
    var isLeaf = isAssetAmbientLeaf(node, allMatchingNodes);

    if (isLeaf) {
      var ambienteData = assetAmbientToAmbienteData(node);
      var nodeLabel = removeAmbientePrefixFromLabel(node.displayLabel || node.originalLabel || '');
      subAmbientes.push({
        id: node.id,
        label: node.displayLabel || nodeLabel,
        name: node.name,
        ambienteData: ambienteData,
        source: node,
      });
      LogHelper.log('[MAIN_BAS]   LEAF: ' + node.name);
    } else {
      LogHelper.log('[MAIN_BAS]   NOT LEAF (has children): ' + node.name);
    }
  });

  LogHelper.log('[MAIN_BAS] Found leaf sub-ambientes:', subAmbientes.length);
  return subAmbientes;
}

/**
 * RFC-0170: Open Ambiente Group Modal
 * Shows aggregated view of multiple sub-ambientes
 * @param {Object} parentItem - Parent item from sidebar
 * @param {Object} settings - Widget settings
 */
function openAmbienteGroupModal(parentItem, settings) {
  if (!MyIOLibrary.openAmbienteGroupModal) {
    LogHelper.warn('[MAIN_BAS] openAmbienteGroupModal not available');
    return;
  }

  // Find all sub-ambientes for this parent
  var subAmbientes = findSubAmbientesForParent(parentItem);

  if (subAmbientes.length === 0) {
    LogHelper.log('[MAIN_BAS] No sub-ambientes found, opening detail modal if single ambiente');
    // If no sub-ambientes found but we have hierarchy data for this item, open detail modal
    if (_assetAmbientHierarchy && _assetAmbientHierarchy[parentItem.id]) {
      var node = _assetAmbientHierarchy[parentItem.id];
      var ambienteData = assetAmbientToAmbienteData(node);
      openAmbienteDetailModal(ambienteData, node, settings);
    }
    return;
  }

  // If only 1 sub-ambiente and it matches exactly, open detail modal instead
  if (subAmbientes.length === 1) {
    var singleSub = subAmbientes[0];
    var singleLabel = removeAmbientePrefixFromLabel(singleSub.label);
    var parentLabel = removeAmbientePrefixFromLabel(parentItem.label || '');
    if (singleLabel === parentLabel) {
      LogHelper.log('[MAIN_BAS] Single exact match, opening detail modal');
      openAmbienteDetailModal(singleSub.ambienteData, singleSub.source, settings);
      return;
    }
  }

  // Build group data
  var groupLabel = removeAmbientePrefixFromLabel(parentItem.label || parentItem.name || 'Grupo');
  var groupData = MyIOLibrary.buildAmbienteGroupData
    ? MyIOLibrary.buildAmbienteGroupData(parentItem.id, groupLabel, parentItem.name || '', subAmbientes)
    : {
        id: parentItem.id,
        label: groupLabel,
        name: parentItem.name || '',
        metrics: {
          temperatureAvg: null,
          temperatureMin: null,
          temperatureMax: null,
          humidityAvg: null,
          consumptionTotal: null,
          deviceCount: 0,
          onlineCount: 0,
          offlineCount: 0,
          subAmbienteCount: subAmbientes.length,
        },
        subAmbientes: subAmbientes,
        status: 'offline',
      };

  LogHelper.log('[MAIN_BAS] Opening Ambiente Group modal:', groupData);

  // Open the group modal
  MyIOLibrary.openAmbienteGroupModal(groupData, {
    themeMode: 'light',
    onSubAmbienteClick: function (subAmbiente) {
      LogHelper.log('[MAIN_BAS] Sub-ambiente clicked:', subAmbiente);
      // Open detail modal for this sub-ambiente
      openAmbienteDetailModal(subAmbiente.ambienteData, subAmbiente.source, settings);
    },
    onRemoteToggle: function (isOn, subAmbiente, remoteId) {
      LogHelper.log('[MAIN_BAS] Group remote toggle:', isOn, subAmbiente, remoteId);
      window.dispatchEvent(
        new CustomEvent('bas:ambiente-remote-toggle', {
          detail: { isOn: isOn, ambiente: subAmbiente.ambienteData, remoteId: remoteId, source: subAmbiente.source },
        })
      );
    },
    onClose: function () {
      LogHelper.log('[MAIN_BAS] Ambiente Group modal closed');
    },
  });
}

/**
 * RFC-0168: Open Ambiente Detail Modal
 * @param {Object} ambienteData - Ambiente data from card click
 * @param {Object} source - Source hierarchy node
 * @param {Object} settings - Widget settings
 */
function openAmbienteDetailModal(ambienteData, source, settings) {
  if (!MyIOLibrary.openAmbienteDetailModal) {
    LogHelper.warn('[MAIN_BAS] openAmbienteDetailModal not available');
    return;
  }

  LogHelper.log('[MAIN_BAS] Opening Ambiente Detail modal:', ambienteData);

  // Get JWT token from localStorage or widget context
  var jwtToken = localStorage.getItem('jwt_token');
  if (!jwtToken && _ctx && _ctx.http && _ctx.http.token) {
    jwtToken = _ctx.http.token;
  }

  // Open the Ambiente Detail modal
  MyIOLibrary.openAmbienteDetailModal(ambienteData, source, {
    themeMode: 'light',
    jwtToken: jwtToken,
    showTimelineChart: false,
    onRemoteToggle: function (isOn, remote) {
      LogHelper.log('[MAIN_BAS] Ambiente remote toggle from modal:', isOn, remote);
      // Dispatch event for external handling
      window.dispatchEvent(
        new CustomEvent('bas:ambiente-remote-toggle', {
          detail: { isOn: isOn, ambiente: ambienteData, remote: remote, source: source },
        })
      );
    },
    onClose: function () {
      LogHelper.log('[MAIN_BAS] Ambiente Detail modal closed');
    },
  });
}

/**
 * RFC-0167: Open On/Off Device Modal for solenoids, switches, relays, pumps
 * @param {Object} device - Device data from classified
 * @param {Object} settings - Widget settings
 */
function openOnOffDeviceModal(device, settings) {
  if (!MyIOLibrary.openOnOffDeviceModal) {
    LogHelper.warn('[MAIN_BAS] openOnOffDeviceModal not available');
    // Fallback to BAS modal
    openBASDeviceModal(device, settings);
    return;
  }

  // Build device data for the On/Off modal
  var deviceData = {
    id: device.id || device.deviceId,
    entityId: device.entityId || device.id,
    label: device.name || device.label || 'Dispositivo',
    name: device.name || device.label,
    deviceType: device.deviceType || device.deviceProfile || '',
    deviceProfile: device.deviceProfile || device.deviceType || '',
    status: device.connectionStatus || device.deviceStatus || 'unknown',
    attributes: device.attributes || {},
    rawData: device.rawData || {},
  };

  // Get JWT token from localStorage or widget context
  var jwtToken = localStorage.getItem('jwt_token');
  if (!jwtToken && _ctx && _ctx.http && _ctx.http.token) {
    jwtToken = _ctx.http.token;
  }

  LogHelper.log('[MAIN_BAS] Opening On/Off Device modal for device:', deviceData);

  // Open the On/Off Device modal
  MyIOLibrary.openOnOffDeviceModal(deviceData, {
    themeMode: 'dark',
    jwtToken: jwtToken,
    centralId: device.centralId || device.rawData?.centralId,
    enableDebugMode: false,
    onStateChange: function (deviceId, state) {
      LogHelper.log('[MAIN_BAS] On/Off device state changed:', deviceId, state);
      // Dispatch event for external handling
      window.dispatchEvent(
        new CustomEvent('bas:device-state-changed', {
          detail: { deviceId: deviceId, state: state },
        })
      );
    },
    onScheduleSave: function (deviceId, schedules) {
      LogHelper.log('[MAIN_BAS] On/Off device schedules saved:', deviceId, schedules);
      // Dispatch event for external handling
      window.dispatchEvent(
        new CustomEvent('bas:device-schedules-saved', {
          detail: { deviceId: deviceId, schedules: schedules },
        })
      );
    },
    onClose: function () {
      LogHelper.log('[MAIN_BAS] On/Off Device modal closed');
    },
  });
}

/**
 * RFC-0165: Send remote command to device via ThingsBoard RPC
 * @param {string} entityId - Device entity ID
 * @param {string} command - 'on' or 'off'
 * @returns {Promise<void>}
 */
function sendRemoteCommand(entityId, command) {
  return new Promise(function (resolve, reject) {
    LogHelper.log('[MAIN_BAS] Sending remote command:', command, 'to device:', entityId);

    // Try to use ThingsBoard widget context for RPC
    if (_ctx && _ctx.controlApi) {
      var rpcMethod = command === 'on' ? 'setRemoteOn' : 'setRemoteOff';
      _ctx.controlApi
        .sendOneWayCommand(rpcMethod, { state: command === 'on' })
        .then(function () {
          LogHelper.log('[MAIN_BAS] Remote command sent successfully');
          resolve();
        })
        .catch(function (err) {
          LogHelper.error('[MAIN_BAS] Remote command failed:', err);
          reject(err);
        });
    } else {
      // Fallback: dispatch event for external handling
      window.dispatchEvent(
        new CustomEvent('bas:remote-command', {
          detail: { entityId: entityId, command: command },
        })
      );
      // Simulate success after dispatch
      setTimeout(resolve, 500);
    }
  });
}

/**
 * RFC-0165: Fetch device telemetry from ThingsBoard
 * @param {string} entityId - Device entity ID
 * @returns {Promise<Object>} Telemetry data
 */
function fetchDeviceTelemetry(entityId) {
  return new Promise(function (resolve, reject) {
    LogHelper.log('[MAIN_BAS] Fetching telemetry for device:', entityId);

    // Try to use ThingsBoard widget context for telemetry
    if (_ctx && _ctx.http) {
      var url =
        '/api/plugins/telemetry/DEVICE/' +
        entityId +
        '/values/timeseries?keys=power,current,voltage,temperature,consumption';
      // ThingsBoard http.get returns an Observable, use subscribe instead of then
      _ctx.http.get(url).subscribe({
        next: function (response) {
          var telemetry = {};
          if (response) {
            Object.keys(response).forEach(function (key) {
              var values = response[key];
              if (values && values.length > 0) {
                telemetry[key] = parseFloat(values[0].value);
              }
            });
          }
          telemetry.lastUpdate = Date.now();
          LogHelper.log('[MAIN_BAS] Telemetry fetched:', telemetry);
          resolve(telemetry);
        },
        error: function (err) {
          LogHelper.error('[MAIN_BAS] Telemetry fetch failed:', err);
          reject(err);
        },
      });
    } else {
      // Fallback: return mock data
      resolve({
        power: Math.random() * 5,
        current: Math.random() * 10,
        voltage: 220 + Math.random() * 10,
        consumption: Math.random() * 100,
        lastUpdate: Date.now(),
      });
    }
  });
}

/**
 * Mount CardGridPanel into #bas-motors-host (Energy: entrada, stores, equipments)
 */
function mountEnergyPanel(host, settings, classified) {
  LogHelper.log('[MAIN_BAS] mountEnergyPanel called, CardGridPanel available:', !!MyIOLibrary.CardGridPanel);
  if (!MyIOLibrary.CardGridPanel) {
    LogHelper.warn('[MAIN_BAS] MyIOLibrary.CardGridPanel not available');
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

  // Use premium green header style from library
  var energyHeaderStyle = MyIOLibrary.HEADER_STYLE_PREMIUM_GREEN || {
    height: '36px',
    fontSize: '0.7rem',
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    backgroundColor: 'linear-gradient(135deg, #2F5848 0%, #3d7a62 100%)',
    topBorderColor: 'transparent',
    bottomBorderColor: 'transparent',
    iconColor: '#a7d4c0',
    quantityBackground: 'rgba(255, 255, 255, 0.2)',
    quantityColor: '#ffffff',
    buttonColor: 'rgba(255, 255, 255, 0.7)',
    buttonHoverBackground: 'rgba(255, 255, 255, 0.15)',
    buttonHoverColor: '#ffffff',
    searchBackground: 'rgba(255, 255, 255, 0.15)',
    searchColor: '#ffffff',
    searchPlaceholderColor: 'rgba(255, 255, 255, 0.5)',
  };

  var panel = new MyIOLibrary.CardGridPanel({
    title: panelLabel,
    icon: '⚡',
    quantity: energyItems.length,
    items: energyItems,
    panelBackground: settings.motorsPanelBackground,
    cardCustomStyle: settings.cardCustomStyle || { height: '90px' },
    titleStyle: energyHeaderStyle,
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
      LogHelper.log('[MAIN_BAS] Energy device clicked:', item.source);
      window.dispatchEvent(new CustomEvent('bas:device-clicked', { detail: { device: item.source } }));

      // RFC-0167: Check if this is an On/Off device (solenoid, switch, relay, pump)
      var deviceProfile = (item.source?.deviceProfile || '').toUpperCase();
      if (isOnOffDeviceProfile(deviceProfile)) {
        // RFC-0167: Open On/Off Device modal
        openOnOffDeviceModal(item.source, settings);
      } else {
        // RFC-0165: Open BAS modal with device details and chart
        openBASDeviceModal(item.source, settings);
      }
    },
  });

  host.appendChild(panel.getElement());
  return panel;
}

/**
 * Mount EntityListPanel into #bas-sidebar-host
 * Displays list of ambientes from datasource or hierarchy
 * RFC-0161: When hierarchyAvailable is true, uses leaf ambientes from hierarchy tree
 * @param {HTMLElement} sidebarHost - Container element
 * @param {Object} settings - Widget settings
 * @param {Object[]} ambientes - Ambientes from datasource (fallback)
 * @param {boolean} hierarchyAvailable - Whether hierarchy is available
 */
function mountSidebarPanel(sidebarHost, settings, ambientes, hierarchyAvailable) {
  // DEBUG: Log sidebar host dimensions
  LogHelper.log('[MAIN_BAS] mountSidebarPanel called');
  LogHelper.log('[MAIN_BAS] sidebarHost element:', sidebarHost);
  LogHelper.log('[MAIN_BAS] sidebarHost dimensions:', {
    offsetHeight: sidebarHost?.offsetHeight,
    offsetWidth: sidebarHost?.offsetWidth,
    clientHeight: sidebarHost?.clientHeight,
    clientWidth: sidebarHost?.clientWidth,
    style: sidebarHost?.style?.cssText,
    computedHeight: sidebarHost ? window.getComputedStyle(sidebarHost).height : null,
    computedGridRow: sidebarHost ? window.getComputedStyle(sidebarHost).gridRow : null,
  });
  LogHelper.log('[MAIN_BAS] ambientes count:', ambientes?.length);
  LogHelper.log('[MAIN_BAS] ambientes data:', ambientes);
  LogHelper.log('[MAIN_BAS] hierarchyAvailable:', hierarchyAvailable);

  if (!MyIOLibrary.EntityListPanel) {
    LogHelper.warn('[MAIN_BAS] MyIOLibrary.EntityListPanel not available');
    return null;
  }

  // Always use datasource ambientes for sidebar display
  // The hierarchy is used for device filtering, not for sidebar display
  // This ensures EntityListPanel shows the same items as the "Ambientes" datasource
  var items = buildAmbienteItems(ambientes);
  LogHelper.log('[MAIN_BAS] Built sidebar items from datasource:', items.length);
  LogHelper.log('[MAIN_BAS] Built ambiente items:', items);

  // Use premium green header style from library
  var sidebarHeaderStyle = MyIOLibrary.HEADER_STYLE_PREMIUM_GREEN || {
    height: '36px',
    fontSize: '0.7rem',
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    backgroundColor: 'linear-gradient(135deg, #2F5848 0%, #3d7a62 100%)',
    topBorderColor: 'transparent',
    bottomBorderColor: 'transparent',
    iconColor: '#a7d4c0',
    quantityBackground: 'rgba(255, 255, 255, 0.2)',
    quantityColor: '#ffffff',
    buttonColor: 'rgba(255, 255, 255, 0.7)',
    buttonHoverBackground: 'rgba(255, 255, 255, 0.15)',
    buttonHoverColor: '#ffffff',
    searchBackground: 'rgba(255, 255, 255, 0.15)',
    searchColor: '#ffffff',
    searchPlaceholderColor: 'rgba(255, 255, 255, 0.5)',
  };

  var panel = new MyIOLibrary.EntityListPanel({
    title: settings.sidebarLabel,
    icon: '📍',
    quantity: items.length,
    subtitle: null, // Removed subtitle line
    items: items,
    panelBackground: settings.sidebarBackground,
    backgroundImage: settings.sidebarBackgroundImage || undefined,
    searchPlaceholder: 'Buscar...',
    selectedId: null,
    showAllOption: true,
    allLabel: 'HOME',
    sortOrder: 'asc',
    //excludePartOfLabel: hierarchyAvailable ? undefined : '^\\(\\d{3}\\)-\\s*', // Remove (001)- prefix from labels (datasource only)
    excludePartOfLabel: '^\\(\\d{3}\\)-\\s*', // Remove (001)- prefix from labels (datasource only)
    titleStyle: sidebarHeaderStyle,
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
      LogHelper.log('[MAIN_BAS] Ambiente selected: all');
      _selectedAmbiente = null;
      // RFC-0161: Clear filter - show all devices
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
      LogHelper.log('[MAIN_BAS] Ambiente selected:', item.id, item.label);
      _selectedAmbiente = item.id;

      // RFC-0170: Open Ambiente Group Modal for aggregated view
      openAmbienteGroupModal(item, settings);

      // RFC-0161: Filter devices based on selection
      // If hierarchy is available, filter using _deviceToAmbienteMap
      // Otherwise, use the old filtering by entityId match
      if (hierarchyAvailable) {
        // Get devices for this ambiente from hierarchy
        var ambienteDevices = getDevicesForAmbiente(item.id);
        if (ambienteDevices) {
          // Filter card items by deviceId
          var deviceIds = ambienteDevices.map(function (d) {
            return d.id;
          });

          if (_waterPanel) {
            var waterItems = buildWaterCardItems(_currentClassified, null).filter(function (cardItem) {
              return deviceIds.includes(cardItem.id);
            });
            _waterPanel.setItems(waterItems);
          }
          if (_ambientesPanel) {
            var hvacItems = buildHVACCardItems(_currentClassified, null).filter(function (cardItem) {
              return deviceIds.includes(cardItem.id);
            });
            _ambientesPanel.setItems(hvacItems);
          }
          if (_motorsPanel) {
            var energyItems = buildEnergyCardItems(_currentClassified, null).filter(function (cardItem) {
              return deviceIds.includes(cardItem.id);
            });
            _motorsPanel.setItems(energyItems);
          }
        }
      } else {
        // Legacy filtering by ambiente ID
        if (_waterPanel) {
          _waterPanel.setItems(buildWaterCardItems(_currentClassified, item.id));
        }
        if (_ambientesPanel) {
          _ambientesPanel.setItems(buildHVACCardItems(_currentClassified, item.id));
        }
        if (_motorsPanel) {
          _motorsPanel.setItems(buildEnergyCardItems(_currentClassified, item.id));
        }
      }

      if (panel) panel.setSelectedId(item.id);
      window.dispatchEvent(
        new CustomEvent('bas:ambiente-changed', {
          detail: { ambiente: item.id, hierarchyMode: hierarchyAvailable },
        })
      );
    },
  });

  var panelElement = panel.getElement();
  LogHelper.log('[MAIN_BAS] Panel element created:', panelElement);

  sidebarHost.appendChild(panelElement);

  // DEBUG: Log after append
  setTimeout(function () {
    LogHelper.log('[MAIN_BAS] After append - sidebarHost dimensions:', {
      offsetHeight: sidebarHost?.offsetHeight,
      offsetWidth: sidebarHost?.offsetWidth,
      scrollHeight: sidebarHost?.scrollHeight,
    });
    LogHelper.log('[MAIN_BAS] After append - panelElement dimensions:', {
      offsetHeight: panelElement?.offsetHeight,
      offsetWidth: panelElement?.offsetWidth,
      scrollHeight: panelElement?.scrollHeight,
    });
  }, 100);

  return panel;
}

// ============================================================================
// RFC-0173: Premium Sidebar Menu
// ============================================================================

/**
 * Mount the premium sidebar menu (RFC-0173)
 * Provides navigation, filtering, and quick actions
 * @param {HTMLElement} host - Container element
 * @param {Object} settings - Widget settings
 * @param {Object} classified - Classified devices data
 * @returns {Object|null} Sidebar menu instance
 */
function mountSidebarMenu(host, settings, classified) {
  LogHelper.log('[MAIN_BAS] mountSidebarMenu called');

  if (!host) {
    LogHelper.warn('[MAIN_BAS] Sidebar menu host not found');
    return null;
  }

  if (!MyIOLibrary.createSidebarMenu) {
    LogHelper.warn('[MAIN_BAS] MyIOLibrary.createSidebarMenu not available');
    return null;
  }

  // Count devices by domain
  var waterCount = classified?.water?.length || 0;
  var energyCount = classified?.energy?.length || 0;
  var temperatureCount = classified?.temperature?.length || 0;

  // Build ambientes items from _currentAmbientes (migrated from EntityListPanel)
  // Sort by (NNN)- prefix numerically and display clean labels without prefix
  var ambienteLabelPattern = /^\(\d{3}\)-/;
  var ambienteItems = (_currentAmbientes || [])
    .filter(function (ambiente) {
      var label = ambiente.label || '';
      return ambienteLabelPattern.test(label);
    })
    .sort(function (a, b) {
      // Sort by the (NNN) prefix numerically
      var labelA = a.label || '';
      var labelB = b.label || '';
      var matchA = labelA.match(/^\((\d{3})\)-/);
      var matchB = labelB.match(/^\((\d{3})\)-/);
      var numA = matchA ? parseInt(matchA[1], 10) : 999;
      var numB = matchB ? parseInt(matchB[1], 10) : 999;
      return numA - numB;
    })
    .map(function (ambiente) {
      var displayLabel = ambiente.label || ambiente.name || ambiente.id;
      // Remove the (NNN)- prefix for cleaner display
      var cleanLabel = displayLabel.replace(/^\(\d{3}\)-\s*/, '');
      // Use ambiente-specific icon from AMBIENTE_ICONS map, fallback to building
      var ambienteIcon = getAmbienteIcon(displayLabel) || MyIOLibrary.SIDEBAR_ICONS?.building || '🏢';
      return {
        id: 'ambiente:' + ambiente.id,
        label: cleanLabel,
        icon: ambienteIcon,
        data: { ambienteId: ambiente.id, originalLabel: displayLabel },
      };
    });

  LogHelper.log('[MAIN_BAS] Built', ambienteItems.length, 'ambiente items for sidebar menu (sorted by prefix)');

  // Build unified navigation items: Dashboard first, then sorted ambientes
  var navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: MyIOLibrary.SIDEBAR_ICONS?.home || '🏠' },
  ].concat(ambienteItems);

  // Build menu sections - single unified navigation section (no title header)
  var sections = [
    {
      id: 'navigation',
      title: null, // No section title - items flow directly
      items: navigationItems,
    },
  ];

  // Clear any stale localStorage state to ensure menu starts expanded
  try {
    localStorage.removeItem('myio-bas-sidebar-menu-state');
  } catch (e) {
    // Ignore localStorage errors
  }

  var sidebarMenu = MyIOLibrary.createSidebarMenu(host, {
    themeMode: settings.themeMode || 'dark',
    initialState: 'expanded',
    persistState: true,
    storageKey: 'myio-bas-sidebar-menu-state',
    showSearch: false,
    header: {
      logo: settings.logoUrl || MyIOLibrary.SIDEBAR_ICONS?.logo || undefined,
      title: settings.sidebarMenuTitle || 'MYIO BAS',
      subtitle: settings.customerName || '',
      showThemeToggle: true,
      userInfo: {
        name: 'Carregando...',
        email: '',
      },
    },
    sections: sections,
    footer: {
      showLogout: true,
      logoutLabel: 'Sair',
      showVersion: true,
      version: MyIOLibrary.version || '0.1.374',
    },
    onItemClick: function (item, section) {
      LogHelper.log('[MAIN_BAS] Sidebar menu item clicked:', item.id, 'section:', section.id);
      handleSidebarMenuNavigation(item.id, item);
    },
    onStateChange: function (state) {
      LogHelper.log('[MAIN_BAS] Sidebar menu state changed:', state);
      window.dispatchEvent(new CustomEvent('bas:sidebar-menu-state', { detail: { state: state } }));
    },
    onThemeToggle: function (newTheme) {
      LogHelper.log('[MAIN_BAS] Theme toggled to:', newTheme);
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('myio:theme-changed', { detail: { theme: newTheme } }));
    },
    onLogout: function () {
      LogHelper.log('[MAIN_BAS] Logout clicked');
      handleSidebarLogout();
    },
  });

  // Fetch user info and update sidebar menu
  fetchUserInfoForSidebar(sidebarMenu);

  // Set dashboard as active by default
  sidebarMenu.setActiveItem('dashboard');

  LogHelper.log('[MAIN_BAS] Sidebar menu mounted successfully');
  return sidebarMenu;
}

/**
 * Fetch user info from ThingsBoard API and update sidebar menu
 * @param {Object} sidebarMenu - Sidebar menu instance
 */
async function fetchUserInfoForSidebar(sidebarMenu) {
  try {
    var token = localStorage.getItem('jwt_token');
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Authorization'] = 'Bearer ' + token;

    var response = await fetch('/api/auth/user', {
      method: 'GET',
      headers: headers,
      credentials: 'include',
    });

    if (!response.ok) {
      LogHelper.warn('[MAIN_BAS] Failed to fetch user info:', response.status);
      return;
    }

    var user = await response.json();
    LogHelper.log('[MAIN_BAS] User info fetched:', user.email);

    var fullName = ((user.firstName || '') + ' ' + (user.lastName || '')).trim() || user.name || 'Usuário';

    sidebarMenu.updateUserInfo({
      name: fullName,
      email: user.email || '',
    });
  } catch (err) {
    LogHelper.error('[MAIN_BAS] Error fetching user info:', err);
    sidebarMenu.updateUserInfo({
      name: 'Usuário',
      email: '',
    });
  }
}

/**
 * Handle logout from sidebar menu
 */
async function handleSidebarLogout() {
  var confirmed = window.confirm('Tem certeza que deseja sair?');
  if (!confirmed) {
    LogHelper.log('[MAIN_BAS] Logout cancelled by user');
    return;
  }

  try {
    var token = localStorage.getItem('jwt_token');
    var response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': 'Bearer ' + token,
      },
      credentials: 'include',
    });

    LogHelper.log('[MAIN_BAS] Logout response:', response.status);

    // Clear local storage
    localStorage.removeItem('jwt_token');
    sessionStorage.clear();

    // Redirect to login
    window.location.href = '/login';
  } catch (err) {
    LogHelper.error('[MAIN_BAS] Logout error:', err);
    // Force redirect even on error
    localStorage.removeItem('jwt_token');
    sessionStorage.clear();
    window.location.href = '/login';
  }
}

/**
 * Handle navigation from sidebar menu
 * @param {string} itemId - Menu item ID
 * @param {Object} item - Full menu item object (optional)
 */
function handleSidebarMenuNavigation(itemId, item) {
  // Handle ambiente selection (items starting with 'ambiente:')
  if (itemId.startsWith('ambiente:')) {
    var ambienteId = itemId.replace('ambiente:', '');
    handleAmbienteSelection(ambienteId, item);
    return;
  }

  switch (itemId) {
    case 'dashboard':
      // Reset filters - show all devices
      _selectedAmbiente = null;
      if (_waterPanel) _waterPanel.setItems(buildWaterCardItems(_currentClassified, null));
      if (_ambientesPanel) _ambientesPanel.setItems(buildHVACCardItems(_currentClassified, null));
      if (_motorsPanel) _motorsPanel.setItems(buildEnergyCardItems(_currentClassified, null));
      if (_sidebarMenu) _sidebarMenu.setActiveItem('dashboard');
      break;

    case 'water':
      scrollToElement('bas-water-host');
      break;

    case 'energy':
      scrollToElement('bas-motors-host');
      // Switch chart to energy domain
      if (_currentChartDomain !== 'energy') {
        var chartCard = document.querySelector('.bas-chart-card');
        if (chartCard) switchChartDomain('energy', chartCard);
      }
      break;

    case 'hvac':
      scrollToElement('bas-ambientes-host');
      // Switch chart to temperature domain
      if (_currentChartDomain !== 'temperature') {
        var chartCardHvac = document.querySelector('.bas-chart-card');
        if (chartCardHvac) switchChartDomain('temperature', chartCardHvac);
      }
      break;

    case 'settings':
      // TODO: Open settings modal when implemented
      LogHelper.log('[MAIN_BAS] Settings - not implemented yet');
      break;

    case 'profile':
      // TODO: Open profile modal when implemented
      LogHelper.log('[MAIN_BAS] Profile - not implemented yet');
      break;

    case 'help':
      // Open help modal if available
      if (MyIOLibrary.openOnboardModal) {
        MyIOLibrary.openOnboardModal({ mode: 'help' });
      } else {
        LogHelper.log('[MAIN_BAS] Help modal not available');
      }
      break;

    default:
      LogHelper.log('[MAIN_BAS] Unknown menu item:', itemId);
  }
}

/**
 * Handle ambiente selection from sidebar menu
 * Filters all panels to show only devices from selected ambiente
 * @param {string} ambienteId - Selected ambiente ID
 * @param {Object} item - Menu item with data
 */
function handleAmbienteSelection(ambienteId, item) {
  LogHelper.log('[MAIN_BAS] Ambiente selected from menu:', ambienteId, item?.label);

  _selectedAmbiente = ambienteId;

  // Update active state in sidebar menu
  if (_sidebarMenu) {
    _sidebarMenu.setActiveItem('ambiente:' + ambienteId);
  }

  // RFC-0170: Open Ambiente Group Modal for aggregated view
  var ambienteData = _currentAmbientes.find(function (a) {
    return a.id === ambienteId;
  });

  if (ambienteData) {
    var modalItem = {
      id: ambienteId,
      label: item?.label || ambienteData.label || ambienteData.name,
      name: ambienteData.name,
    };
    openAmbienteGroupModal(modalItem, _settings);
  }

  // Filter panels based on hierarchy if available
  var hierarchyAvailable = Object.keys(_ambienteHierarchy).length > 0;

  if (hierarchyAvailable) {
    var ambienteDevices = getDevicesForAmbiente(ambienteId);
    if (ambienteDevices) {
      var deviceIds = ambienteDevices.map(function (d) {
        return d.id;
      });

      if (_waterPanel) {
        var waterItems = buildWaterCardItems(_currentClassified, null).filter(function (cardItem) {
          return deviceIds.includes(cardItem.id);
        });
        _waterPanel.setItems(waterItems);
      }
      if (_ambientesPanel) {
        var hvacItems = buildHVACCardItems(_currentClassified, null).filter(function (cardItem) {
          return deviceIds.includes(cardItem.id);
        });
        _ambientesPanel.setItems(hvacItems);
      }
      if (_motorsPanel) {
        var energyItems = buildEnergyCardItems(_currentClassified, null).filter(function (cardItem) {
          return deviceIds.includes(cardItem.id);
        });
        _motorsPanel.setItems(energyItems);
      }
    }
  } else {
    // Legacy filtering by ambiente ID
    if (_waterPanel) _waterPanel.setItems(buildWaterCardItems(_currentClassified, ambienteId));
    if (_ambientesPanel) _ambientesPanel.setItems(buildHVACCardItems(_currentClassified, ambienteId));
    if (_motorsPanel) _motorsPanel.setItems(buildEnergyCardItems(_currentClassified, ambienteId));
  }

  // Dispatch event for other components
  window.dispatchEvent(
    new CustomEvent('bas:ambiente-changed', {
      detail: { ambiente: ambienteId, hierarchyMode: hierarchyAvailable },
    })
  );
}

/**
 * Scroll to element by ID with smooth animation
 * @param {string} elementId - Element ID to scroll to
 */
function scrollToElement(elementId) {
  var element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Add visual feedback
    element.style.outline = '2px solid rgba(47, 136, 80, 0.5)';
    setTimeout(function () {
      element.style.outline = '';
    }, 1500);
  }
}

/**
 * Update sidebar menu badges with current device counts
 * @param {Object} classified - Classified devices data
 */
function updateSidebarMenuBadges(classified) {
  if (!_sidebarMenu) return;

  var waterCount = classified?.water?.length || 0;
  var energyCount = classified?.energy?.length || 0;
  var temperatureCount = classified?.temperature?.length || 0;

  _sidebarMenu.updateItemBadge('water', waterCount || null);
  _sidebarMenu.updateItemBadge('energy', energyCount || null);
  _sidebarMenu.updateItemBadge('hvac', temperatureCount || null);
}

// ============================================================================
// Chart functions
// ============================================================================

/**
 * Data API host for ingestion API calls
 */
var DATA_API_HOST = 'https://api.data.apps.myio-bas.com';

// Chart data cache to avoid unnecessary refetches (e.g., on maximize)
// Keyed by domain, stores last result per period
var _chartDataCache = {};

/**
 * Create real fetchData function for chart - fetches from ingestion API
 * @param {string} domain - 'energy', 'water', or 'temperature'
 * @param {Object} [options] - Cache options
 * @param {boolean} [options.preferCache=false] - If true, return cached data when available
 * @param {number} [options.maxAgeMs=300000] - Cache max age in ms for normal use
 * @returns {function} fetchData function that returns { labels, dailyTotals }
 */
function createRealFetchData(domain, options) {
  var opts = options || {};
  var preferCache = !!opts.preferCache;
  var maxAgeMs = typeof opts.maxAgeMs === 'number' ? opts.maxAgeMs : 5 * 60 * 1000;

  return async function fetchData(period) {
    var cacheKey = domain;
    var cached = _chartDataCache[cacheKey];
    if (cached && cached.period === period) {
      var ageMs = Date.now() - cached.timestamp;
      if (preferCache || ageMs <= maxAgeMs) {
        return cached.data;
      }
    }

    var labels = [];
    var now = new Date();

    // Calculate date range
    var endTs = now.getTime();
    var startTs = endTs - period * 24 * 60 * 60 * 1000;

    // Generate labels for all days
    for (var i = period - 1; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    }

    // Get credentials
    var customerId = MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Id;
    var clientId = MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Cliente_Id;
    var clientSecret = MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Secret;

    if (!customerId || !clientId || !clientSecret) {
      LogHelper.warn('[MAIN_BAS] Chart: No credentials available, returning empty data');
      return { labels: labels, dailyTotals: new Array(period).fill(0), shoppingData: {}, shoppingNames: {} };
    }

    try {
      var result;
      if (domain === 'temperature') {
        // Temperature: fetch from ThingsBoard telemetry API
        var values = await fetchTemperatureData(period, startTs, endTs);
        result = { dailyTotals: values, shoppingData: {}, shoppingNames: {} };
      } else {
        // Energy/Water: fetch from ingestion API with per-customer breakdown
        result = await fetchIngestionData(domain, customerId, clientId, clientSecret, period, startTs, endTs);
      }

      LogHelper.log('[MAIN_BAS] Chart data fetched for', domain, ':', result.dailyTotals.length, 'points,', Object.keys(result.shoppingData).length, 'shoppings');
      var resultData = {
        labels: labels,
        dailyTotals: result.dailyTotals,
        shoppingData: result.shoppingData || {},
        shoppingNames: result.shoppingNames || {},
        fetchTimestamp: Date.now(),
      };
      _chartDataCache[cacheKey] = { period: period, timestamp: Date.now(), data: resultData };
      return resultData;
    } catch (error) {
      LogHelper.error('[MAIN_BAS] Chart fetch error for', domain, ':', error);
      var errorData = { labels: labels, dailyTotals: new Array(period).fill(0), shoppingData: {}, shoppingNames: {} };
      _chartDataCache[cacheKey] = { period: period, timestamp: Date.now(), data: errorData };
      return errorData;
    }
  };
}

/**
 * Fetch energy/water data from ingestion API
 * Makes one API call per day (same pattern as ENERGY widget)
 * Returns: { dailyTotals, shoppingData, shoppingNames }
 * Note: MAIN_BAS splits by DEVICE (not customer) since there's typically only one customer
 * shoppingData = { deviceId: [values per day] }
 * shoppingNames = { deviceId: "Device Label" }
 */
async function fetchIngestionData(domain, customerId, clientId, clientSecret, period, startTs, endTs) {
  var emptyResult = { dailyTotals: new Array(period).fill(0), shoppingData: {}, shoppingNames: {} };

  if (!MyIOLibrary || !MyIOLibrary.buildMyioIngestionAuth) {
    LogHelper.warn('[MAIN_BAS] MyIOLibrary.buildMyioIngestionAuth not available');
    return emptyResult;
  }

  // Build auth and get token
  var myIOAuth = MyIOLibrary.buildMyioIngestionAuth({
    dataApiHost: DATA_API_HOST,
    clientId: clientId,
    clientSecret: clientSecret,
  });

  var token = await myIOAuth.getToken();
  if (!token) {
    LogHelper.error('[MAIN_BAS] Failed to get ingestion token');
    return emptyResult;
  }

  var endpoint = domain === 'energy' ? 'energy' : 'water';
  var dailyTotals = [];
  var shoppingData = {}; // { deviceId: [values per day] } - split by device
  var shoppingNames = {}; // { deviceId: "Device Label" }
  var dayMs = 24 * 60 * 60 * 1000;

  // Calculate day boundaries (same pattern as ENERGY widget)
  var dayBoundaries = [];
  for (var i = 0; i < period; i++) {
    var dayStart = new Date(startTs + i * dayMs);
    dayStart.setUTCHours(0, 0, 0, 0);
    var dayEnd = new Date(dayStart.getTime() + dayMs - 1);
    dayBoundaries.push({
      startTs: dayStart.getTime(),
      endTs: dayEnd.getTime(),
      label: dayStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    });
  }

  LogHelper.log('[MAIN_BAS] Fetching', domain, 'chart data for', period, 'days...');

  // Make one API call per day
  for (var j = 0; j < dayBoundaries.length; j++) {
    var day = dayBoundaries[j];
    var dayIndex = j;

    try {
      var url = new URL(DATA_API_HOST + '/api/v1/telemetry/customers/' + customerId + '/' + endpoint + '/devices/totals');
      url.searchParams.set('startTime', new Date(day.startTs).toISOString());
      url.searchParams.set('endTime', new Date(day.endTs).toISOString());
      url.searchParams.set('deep', '1');
      url.searchParams.set('granularity', '1d');

      var response = await fetch(url.toString(), {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      });

      if (!response.ok) {
        LogHelper.warn('[MAIN_BAS] API error for day', day.label, ':', response.status);
        dailyTotals.push(0);
        continue;
      }

      var json = await response.json();
      var devices = Array.isArray(json) ? json : json?.data || [];

      // Sum all device values for this day AND collect per-device data
      var dayTotal = 0;

      devices.forEach(function (device) {
        var deviceValue = 0;
        if (Array.isArray(device.consumption)) {
          // New API format with consumption array
          device.consumption.forEach(function (entry) {
            deviceValue += Number(entry.value) || 0;
          });
        } else {
          // Old format with total_value
          deviceValue = Number(device.total_value) || Number(device.value) || 0;
        }

        dayTotal += deviceValue;

        // Split by DEVICE instead of customer
        var deviceId = device.id || device.deviceId || device.device_id;
        var deviceName = device.label || device.name || device.deviceName || device.device_name || deviceId;

        if (deviceId && deviceValue > 0) {
          // Initialize device array if needed
          if (!shoppingData[deviceId]) {
            shoppingData[deviceId] = new Array(period).fill(0);
          }
          shoppingData[deviceId][dayIndex] = deviceValue;

          // Store device name (truncate if too long)
          if (!shoppingNames[deviceId]) {
            shoppingNames[deviceId] = deviceName.length > 25 ? deviceName.substring(0, 22) + '...' : deviceName;
          }
        }
      });

      // Fallback to summary total if available
      if (dayTotal === 0 && json?.summary?.totalValue) {
        dayTotal = json.summary.totalValue;
      }

      dailyTotals.push(dayTotal);
      LogHelper.log('[MAIN_BAS]', domain, 'day', day.label, ':', dayTotal.toFixed(2), '(' + devices.length + ' devices)');
    } catch (err) {
      LogHelper.warn('[MAIN_BAS] Error fetching', domain, 'for day', day.label, ':', err.message);
      dailyTotals.push(0);
    }
  }

  LogHelper.log('[MAIN_BAS]', domain, 'chart: Total devices tracked:', Object.keys(shoppingData).length);
  return { dailyTotals: dailyTotals, shoppingData: shoppingData, shoppingNames: shoppingNames };
}

/**
 * Fetch temperature data from ThingsBoard telemetry API
 */
async function fetchTemperatureData(period, startTs, endTs) {
  var jwt = localStorage.getItem('jwt_token');
  if (!jwt) {
    LogHelper.warn('[MAIN_BAS] No JWT token for temperature fetch');
    return new Array(period).fill(null);
  }

  // Get temperature devices from current classified data
  var tempDevices = [];
  if (_currentClassified && _currentClassified.temperature) {
    tempDevices = _currentClassified.temperature.items || [];
  }

  if (tempDevices.length === 0) {
    LogHelper.warn('[MAIN_BAS] No temperature devices found');
    return new Array(period).fill(null);
  }

  var dayMs = 24 * 60 * 60 * 1000;
  var dailySums = new Array(period).fill(0);
  var dailyCounts = new Array(period).fill(0);

  // Fetch data for up to 10 devices to limit API calls
  var devicesToFetch = tempDevices.slice(0, 10);

  for (var i = 0; i < devicesToFetch.length; i++) {
    var device = devicesToFetch[i];
    var deviceId = device.tbId || device.id;
    if (!deviceId) continue;

    try {
      var url = '/api/plugins/telemetry/DEVICE/' + deviceId + '/values/timeseries?keys=temperature&startTs=' + startTs + '&endTs=' + endTs + '&agg=AVG&interval=' + dayMs;

      var response = await fetch(url, {
        headers: {
          Authorization: 'Bearer ' + jwt,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) continue;

      var data = await response.json();
      var readings = data?.temperature || [];

      readings.forEach(function (reading) {
        var dayIndex = Math.floor((reading.ts - startTs) / dayMs);
        if (dayIndex >= 0 && dayIndex < period && reading.value !== null) {
          var value = Number(reading.value);
          if (!isNaN(value)) {
            dailySums[dayIndex] += value;
            dailyCounts[dayIndex]++;
          }
        }
      });
    } catch (err) {
      LogHelper.warn('[MAIN_BAS] Error fetching temperature device', deviceId, ':', err.message);
    }
  }

  // Calculate daily averages
  var dailyTotals = dailySums.map(function (sum, idx) {
    if (dailyCounts[idx] === 0) return null;
    return Number((sum / dailyCounts[idx]).toFixed(1));
  });

  return dailyTotals;
}

/**
 * Aggregate ingestion API data by day
 */
/**
 * Generate mock fetchData for a given chart domain (FALLBACK)
 * @deprecated Use createRealFetchData instead
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
 * Switch chart to a different domain — destroys old widget + creates new one
 * RFC-0098: Now uses createConsumptionChartWidget with full tab controls
 */
function switchChartDomain(domain, chartContainer) {
  // Destroy existing chart widget
  if (_chartInstance) {
    if (typeof _chartInstance.destroy === 'function') {
      _chartInstance.destroy();
    }
    _chartInstance = null;
  }

  _currentChartDomain = domain;

  // Clear container and create widget container
  chartContainer.innerHTML = '';
  var widgetContainer = document.createElement('div');
  widgetContainer.id = 'bas-chart-widget-' + domain;
  widgetContainer.style.width = '100%';
  widgetContainer.style.height = '100%';
  chartContainer.appendChild(widgetContainer);

  var cfg = CHART_DOMAIN_CONFIG[domain];
  if (!cfg) return;

  // RFC-0098: Use createConsumptionChartWidget for full functionality (tabs, viz modes, etc.)
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createConsumptionChartWidget) {
    LogHelper.log('[MAIN_BAS] Using createConsumptionChartWidget for domain:', domain);

    _chartInstance = MyIOLibrary.createConsumptionChartWidget({
      domain: domain,
      containerId: 'bas-chart-widget-' + domain,
      title: cfg.label + ' - Últimos 7 dias',
      unit: cfg.unit,
      unitLarge: cfg.unitLarge,
      thresholdForLargeUnit: cfg.threshold,
      decimalPlaces: domain === 'temperature' ? 1 : 2,
      chartHeight: '100%',
      fullHeight: true, // Use all available height
      defaultPeriod: 7,
      defaultChartType: domain === 'temperature' ? 'line' : 'bar',
      defaultVizMode: 'total',
      theme: (_settings && _settings.defaultThemeMode) || 'light',
      showSettingsButton: false, // Settings handled by BAS header
      showMaximizeButton: false, // Maximize handled by BAS header
      showVizModeTabs: true, // Show Total/Por Shopping tabs
      showChartTypeTabs: true, // Show Bar/Line tabs

      // Compact header styles for BAS panel
      headerStyles: {
        padding: '6px 12px',
        gap: '8px',
        titleFontSize: '11px',
        tabPadding: '3px 8px',
        tabFontSize: '10px',
      },

      // Data fetching
      fetchData: createRealFetchData(domain),

      // Callbacks
      onDataLoaded: function (data) {
        LogHelper.log('[MAIN_BAS] Chart data loaded for', domain, ':', data.labels?.length, 'days');
      },
      onError: function (error) {
        LogHelper.error('[MAIN_BAS] Chart error for', domain, ':', error);
      },
    });

    // Render the widget
    _chartInstance.render().catch(function (err) {
      LogHelper.error('[MAIN_BAS] Failed to render chart widget:', err);
    });
  } else if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createConsumption7DaysChart) {
    // Fallback to simple chart if widget not available
    LogHelper.warn('[MAIN_BAS] createConsumptionChartWidget not available, using fallback');

    var canvas = document.createElement('canvas');
    canvas.id = 'bas-chart-canvas';
    chartContainer.innerHTML = '';
    chartContainer.appendChild(canvas);

    _chartInstance = MyIOLibrary.createConsumption7DaysChart({
      domain: domain,
      containerId: 'bas-chart-canvas',
      unit: cfg.unit,
      unitLarge: cfg.unitLarge,
      thresholdForLargeUnit: cfg.threshold,
      fetchData: createRealFetchData(domain),
      defaultPeriod: 7,
      defaultChartType: domain === 'temperature' ? 'line' : 'bar',
      theme: (_settings && _settings.defaultThemeMode) || 'dark',
      showLegend: true,
      fill: domain === 'temperature',
    });

    _chartInstance.render();
  } else {
    LogHelper.warn('[MAIN_BAS] No chart library available');
  }
}

// SVG icons for chart header buttons
var CHART_ICON_FILTER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
var CHART_ICON_MAXIMIZE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

/**
 * Mount chart panel using CardGridPanel with tabs feature
 * RFC-0174: Uses standardized CardGridPanel tabs for consistency
 */
function mountChartPanel(hostEl, settings) {
  if (!hostEl) return;

  var domains = ['energy', 'water', 'temperature'];

  // Build tabs configuration for CardGridPanel
  var chartTabs = domains.map(function (domain) {
    var config = CHART_DOMAIN_CONFIG[domain];
    return {
      id: domain,
      label: config.icon + ' ' + config.label,
      selected: domain === _currentChartDomain,
      handleClick: function () {
        // Switch chart on tab click
        var chartCard = hostEl.querySelector('.bas-chart-card');
        if (chartCard) {
          switchChartDomain(domain, chartCard);
          _currentChartDomain = domain;
        }
      },
    };
  });

  // Create panel wrapper using standard CardGridPanel structure
  var panelWrapper = document.createElement('div');
  panelWrapper.className = 'myio-cgp bas-chart-panel';
  panelWrapper.style.background = '#faf8f1';

  // Use HeaderPanelComponent for consistent header
  if (MyIOLibrary.HeaderPanelComponent) {
    var headerComponent = new MyIOLibrary.HeaderPanelComponent({
      title: 'Consumo',
      icon: '📊',
      style: MyIOLibrary.HEADER_STYLE_PREMIUM_GREEN,
      showBottomBorder: false,
      showTopBorder: true,
      showFilter: true,
      handleActionFilter: function () {
        LogHelper.log('[MAIN_BAS] Chart filter clicked');
        // TODO: Implement chart-specific filter modal
      },
      showMaximize: true,
      onMaximizeToggle: function () {
        showMaximizedPanel(panelWrapper, 'Consumo', { isChart: true, chartDomain: _currentChartDomain });
      },
    });
    panelWrapper.appendChild(headerComponent.getElement());
  }

  // Add tabs wrapper using CardGridPanel tab styles
  var tabsWrapper = document.createElement('div');
  tabsWrapper.className = 'myio-cgp__tabs-wrapper';

  // Left scroll button (hidden unless 3+ tabs)
  var leftBtn = document.createElement('button');
  leftBtn.className = 'myio-cgp__tabs-scroll-btn';
  leftBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
  leftBtn.title = 'Rolar esquerda';
  leftBtn.disabled = true;
  if (chartTabs.length >= 3) {
    leftBtn.classList.add('myio-cgp__tabs-scroll-btn--visible');
  }
  tabsWrapper.appendChild(leftBtn);

  // Tabs container
  var tabsContainer = document.createElement('div');
  tabsContainer.className = 'myio-cgp__tabs-container';

  chartTabs.forEach(function (tab) {
    var tabEl = document.createElement('button');
    tabEl.className = 'myio-cgp__tab' + (tab.selected ? ' myio-cgp__tab--selected' : '');
    tabEl.dataset.tabId = tab.id;
    tabEl.textContent = tab.label;

    tabEl.addEventListener('click', function () {
      // Update all tabs selection state
      tabsContainer.querySelectorAll('.myio-cgp__tab').forEach(function (t) {
        t.classList.remove('myio-cgp__tab--selected');
      });
      tabEl.classList.add('myio-cgp__tab--selected');

      // Call tab handler
      if (tab.handleClick) tab.handleClick();
    });

    tabsContainer.appendChild(tabEl);
  });

  tabsWrapper.appendChild(tabsContainer);

  // Right scroll button (hidden unless 3+ tabs)
  var rightBtn = document.createElement('button');
  rightBtn.className = 'myio-cgp__tabs-scroll-btn';
  rightBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  rightBtn.title = 'Rolar direita';
  if (chartTabs.length >= 3) {
    rightBtn.classList.add('myio-cgp__tabs-scroll-btn--visible');
  }
  tabsWrapper.appendChild(rightBtn);

  // Scroll button handlers
  if (chartTabs.length >= 3) {
    var scrollAmount = 120;

    leftBtn.addEventListener('click', function () {
      tabsContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });

    rightBtn.addEventListener('click', function () {
      tabsContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

    var updateScrollButtons = function () {
      leftBtn.disabled = tabsContainer.scrollLeft <= 0;
      rightBtn.disabled = tabsContainer.scrollLeft + tabsContainer.clientWidth >= tabsContainer.scrollWidth - 1;
    };

    tabsContainer.addEventListener('scroll', updateScrollButtons);
    window.requestAnimationFrame(updateScrollButtons);
  }

  panelWrapper.appendChild(tabsWrapper);

  // Build chart card container
  var chartCard = document.createElement('div');
  chartCard.className = 'bas-chart-card myio-cgp__content';
  chartCard.style.flex = '1';
  chartCard.style.overflow = 'hidden';

  // Apply chart panel background
  if (settings && settings.chartPanelBackground) {
    chartCard.style.backgroundColor = settings.chartPanelBackground;
  }

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
 * Initialize the BAS dashboard — mounts all panels into their grid slots
 * RFC-0173: Added sidebarMenuHost for premium retractable sidebar menu
 */
async function initializeDashboard(
  ctx,
  sidebarMenuHost,
  sidebarHost,
  waterHost,
  chartsHost,
  ambientesHost,
  motorsHost,
  settings
) {
  try {
    // DEBUG: Log raw data from ThingsBoard
    LogHelper.log('[MAIN_BAS] ============ INIT START ============');
    LogHelper.log('[MAIN_BAS] ctx.data (raw):', ctx.data);
    LogHelper.log('[MAIN_BAS] ctx.data length:', ctx.data?.length);

    // Log each datasource row
    if (ctx.data && Array.isArray(ctx.data)) {
      ctx.data.forEach(function (row, index) {
        LogHelper.log('[MAIN_BAS] Row ' + index + ':', {
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

    LogHelper.log('[MAIN_BAS] Parsed result:', {
      ambientesCount: parsed.ambientes?.length,
      ambientes: parsed.ambientes,
      classified: parsed.classified,
    });

    // RFC-0161: Build ambiente hierarchy from device parent relations
    // This fetches parent assets for each device and builds a hierarchical map
    var hierarchyAvailable = false;
    try {
      await buildAmbienteHierarchy(_currentClassified);
      hierarchyAvailable = Object.keys(_ambienteHierarchy).length > 0;
      LogHelper.log('[MAIN_BAS] Hierarchy available:', hierarchyAvailable);
    } catch (hierarchyErr) {
      LogHelper.warn('[MAIN_BAS] Hierarchy build failed, using datasource ambientes:', hierarchyErr);
      hierarchyAvailable = false;
    }

    // RFC-0168: Build ASSET_AMBIENT hierarchy from parsed ambientes
    // This filters ASSET_AMBIENT type assets and enriches them with devices from _ambienteHierarchy
    var assetAmbientHierarchy = {};
    try {
      assetAmbientHierarchy = buildAssetAmbientHierarchy(parsed.ambientes);
      LogHelper.log('[MAIN_BAS] ASSET_AMBIENT hierarchy built:', Object.keys(assetAmbientHierarchy).length);
    } catch (assetAmbientErr) {
      LogHelper.warn('[MAIN_BAS] ASSET_AMBIENT hierarchy build failed:', assetAmbientErr);
    }

    // RFC-0173: Mount premium sidebar menu (retractable navigation)
    LogHelper.log('[MAIN_BAS] sidebarMenuHost exists:', !!sidebarMenuHost);
    LogHelper.log('[MAIN_BAS] settings.showSidebarMenu:', settings.showSidebarMenu);

    if (settings.showSidebarMenu !== false && sidebarMenuHost) {
      _sidebarMenu = mountSidebarMenu(sidebarMenuHost, settings, _currentClassified);
    } else if (sidebarMenuHost) {
      sidebarMenuHost.style.display = 'none';
    }

    // Mount sidebar EntityListPanel (col 1, row 1-2 full height)
    LogHelper.log('[MAIN_BAS] settings.showSidebar:', settings.showSidebar);
    LogHelper.log('[MAIN_BAS] sidebarHost exists:', !!sidebarHost);

    if (settings.showSidebar && sidebarHost) {
      // RFC-0161: Use hierarchy-based sidebar items if available
      _ambientesListPanel = mountSidebarPanel(sidebarHost, settings, parsed.ambientes, hierarchyAvailable);
    } else if (sidebarHost) {
      sidebarHost.style.display = 'none';
    }

    // Mount water CardGridPanel (col 2, row 1)
    LogHelper.log('[MAIN_BAS] Mounting water panel:', {
      show: settings.showWaterInfrastructure,
      hostExists: !!waterHost,
    });
    if (settings.showWaterInfrastructure && waterHost) {
      _waterPanel = mountWaterPanel(waterHost, settings, _currentClassified);
      LogHelper.log('[MAIN_BAS] Water panel mounted:', !!_waterPanel);
    } else if (waterHost) {
      waterHost.style.display = 'none';
    }

    // Mount chart panel (col 1–2, row 2)
    LogHelper.log('[MAIN_BAS] Mounting chart panel:', {
      show: settings.showCharts,
      hostExists: !!chartsHost,
    });
    if (settings.showCharts && chartsHost) {
      mountChartPanel(chartsHost, settings);
      LogHelper.log('[MAIN_BAS] Chart panel mounted');
    } else if (chartsHost) {
      chartsHost.style.display = 'none';
    }

    // RFC-0168: Mount ambientes CardGridPanel using ASSET_AMBIENT hierarchy (col 3, row 1–2)
    LogHelper.log('[MAIN_BAS] Mounting ambientes panel:', {
      show: settings.showEnvironments,
      hostExists: !!ambientesHost,
      assetAmbientCount: Object.keys(assetAmbientHierarchy).length,
    });
    if (settings.showEnvironments && ambientesHost) {
      _ambientesPanel = mountAmbientesPanel(ambientesHost, settings, assetAmbientHierarchy);
      LogHelper.log('[MAIN_BAS] Ambientes panel mounted:', !!_ambientesPanel);
    } else if (ambientesHost) {
      ambientesHost.style.display = 'none';
    }

    // Mount motors CardGridPanel (col 4, row 1–2)
    LogHelper.log('[MAIN_BAS] Mounting motors panel:', {
      show: settings.showPumpsMotors,
      hostExists: !!motorsHost,
    });
    if (settings.showPumpsMotors && motorsHost) {
      _motorsPanel = mountEnergyPanel(motorsHost, settings, _currentClassified);
      LogHelper.log('[MAIN_BAS] Motors panel mounted:', !!_motorsPanel);
    } else if (motorsHost) {
      motorsHost.style.display = 'none';
    }

    var waterDevices = getWaterDevicesFromClassified(_currentClassified);
    var hvacDevices = getHVACDevicesFromClassified(_currentClassified);
    var energyDevices = getEnergyEquipmentDevicesFromClassified(_currentClassified);

    LogHelper.log('[MAIN_BAS] Dashboard initialized with:', {
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
  } catch (error) {
    LogHelper.error('[MAIN_BAS] Error initializing dashboard:', error);
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

  LogHelper.log('[MAIN_BAS] Container heights fixed, depth traversed:', depth);
}

// ============================================================================
// ThingsBoard Widget Lifecycle
// ============================================================================

self.onInit = async function () {
  _ctx = self.ctx;

  console.log('[MAIN_BAS] onInit called, ctx:', _ctx);

  // Enable debug mode from settings (default: true, set false to disable)
  DEBUG_ACTIVE = self.ctx.settings?.enableDebugMode !== false;

  // Create LogHelper instance using library function
  LogHelper = window.MyIOLibrary.createLogHelper({
    debugActive: DEBUG_ACTIVE,
    config: { widget: 'MAIN_BAS' },
  });

  // Load customer TB ID from settings
  MAP_CUSTOMER_CREDENTIALS.customer_TB_Id = self.ctx.settings?.customerTB_ID || null;

  // Fetch customer attributes from ThingsBoard if customer ID is available
  if (
    MAP_CUSTOMER_CREDENTIALS.customer_TB_Id &&
    window.MyIOLibrary?.fetchThingsboardCustomerAttrsFromStorage
  ) {
    const jwt = localStorage.getItem('jwt_token');
    if (!jwt) {
      LogHelper.warn('[MAIN_BAS] JWT token not found in localStorage');
    } else {
      try {
        const attrs = await window.MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(
          MAP_CUSTOMER_CREDENTIALS.customer_TB_Id,
          jwt
        );

        // Populate customer credentials
        MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Id = attrs?.ingestionId || null;
        MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Cliente_Id = attrs?.client_id || null;
        MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Secret = attrs?.client_secret || null;

        // Populate telemetry settings
        CUSTOMER_TELEMETRY_SETTINGS.mapInstantaneousPower = attrs?.mapInstantaneousPower || null;
        CUSTOMER_TELEMETRY_SETTINGS.minTemperature = attrs?.minTemperature || null;
        CUSTOMER_TELEMETRY_SETTINGS.maxTemperature = attrs?.maxTemperature || null;

        LogHelper.log('[MAIN_BAS] Customer credentials loaded:', {
          hasIngestionId: !!MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Id,
          hasClientId: !!MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Cliente_Id,
          hasClientSecret: !!MAP_CUSTOMER_CREDENTIALS.customer_Ingestion_Secret,
        });
        LogHelper.log('[MAIN_BAS] Customer telemetry settings loaded:', CUSTOMER_TELEMETRY_SETTINGS);
      } catch (error) {
        LogHelper.error('[MAIN_BAS] Error fetching customer attributes:', error);
      }
    }
  }

  _settings = getSettings(_ctx);

  var root = _ctx.$container[0].querySelector('#bas-dashboard-root');
  if (!root) {
    LogHelper.error('[MAIN_BAS] Container #bas-dashboard-root not found');
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

  // RFC-0173: Get sidebar menu host (premium retractable menu)
  var sidebarMenuHost = root.querySelector('#bas-sidebar-menu-host');
  var sidebarHost = root.querySelector('#bas-sidebar-host');
  var waterHost = root.querySelector('#bas-water-host');
  var chartsHost = root.querySelector('#bas-charts-host');
  var ambientesHost = root.querySelector('#bas-ambientes-host');
  var motorsHost = root.querySelector('#bas-motors-host');

  // Always log layout containers for debugging
  LogHelper.log('[MAIN_BAS] Layout containers:', {
    sidebarMenuHost: !!sidebarMenuHost,
    sidebarHost: !!sidebarHost,
    waterHost: !!waterHost,
    chartsHost: !!chartsHost,
    ambientesHost: !!ambientesHost,
    motorsHost: !!motorsHost,
  });
  LogHelper.log('[MAIN_BAS] Settings visibility:', {
    showSidebar: _settings.showSidebar,
    showWaterInfrastructure: _settings.showWaterInfrastructure,
    showCharts: _settings.showCharts,
    showEnvironments: _settings.showEnvironments,
    showPumpsMotors: _settings.showPumpsMotors,
  });

  LogHelper.log('[MAIN_BAS] onInit - Full Settings:', _settings);

  // Initialize all panels (RFC-0173: added sidebarMenuHost)
  await initializeDashboard(_ctx, sidebarMenuHost, sidebarHost, waterHost, chartsHost, ambientesHost, motorsHost, _settings);
};

self.onDataUpdated = function () {
  if (!_ctx) return;

  // Limit onDataUpdated to run max 3 times
  _dataUpdatedCount++;
  if (_dataUpdatedCount > 1) {
    LogHelper.log('[MAIN_BAS] onDataUpdated - SKIPPED (limit of 1 calls reached)');
    return;
  }
  LogHelper.log('[MAIN_BAS] onDataUpdated - Call #' + _dataUpdatedCount + ' of 3');

  var parsed = parseDevicesFromData(_ctx.data);
  _currentClassified = parsed.classified;

  var waterDevices = getWaterDevicesFromClassified(_currentClassified);
  var hvacDevices = getHVACDevicesFromClassified(_currentClassified);
  var energyDevices = getEnergyEquipmentDevicesFromClassified(_currentClassified);

  LogHelper.log('[MAIN_BAS] onDataUpdated - Devices:', {
    ambientes: parsed.ambientes.length,
    water: waterDevices.length,
    hvac: hvacDevices.length,
    energy: energyDevices.length,
    ocultos: _currentClassified.ocultos.length,
  });

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

  // RFC-0168: Update ambientes panel using ASSET_AMBIENT hierarchy
  if (_ambientesPanel) {
    // Rebuild ASSET_AMBIENT hierarchy with updated data
    // Note: _ambienteHierarchy should be updated by buildAmbienteHierarchy if called
    var assetAmbientHierarchy = buildAssetAmbientHierarchy(parsed.ambientes);
    _ambientesPanel.setItems(buildAmbienteCardItems(assetAmbientHierarchy, _selectedAmbiente));
  }

  // Update motors panel
  if (_motorsPanel) {
    _motorsPanel.setItems(buildEnergyCardItems(_currentClassified, _selectedAmbiente));
  }

  // RFC-0173: Update sidebar menu badges
  updateSidebarMenuBadges(_currentClassified);
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
  // RFC-0173: Clean up sidebar menu
  if (_sidebarMenu && _sidebarMenu.destroy) {
    _sidebarMenu.destroy();
  }
  _chartInstance = null;
  _currentChartDomain = 'energy';
  _ambientesListPanel = null;
  _waterPanel = null;
  _ambientesPanel = null;
  _motorsPanel = null;
  _sidebarMenu = null;
  _selectedAmbiente = null;
  _ctx = null;
  _settings = null;
  _currentAmbientes = [];
  _currentClassified = null;
  _dataUpdatedCount = 0; // Reset counter on destroy

  // RFC-0161: Clean up hierarchy caches
  _ambienteHierarchy = {};
  _deviceToAmbienteMap = {};
  _ambientesCache = {};
  _devicesMap = {};
  _ambientesMap = {};
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
