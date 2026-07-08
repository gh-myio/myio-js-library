/**
 * Device Item Factory
 * RFC-0109: Centralized device item creation for MYIO components
 *
 * This module provides a factory function to create standardized device item objects
 * used across MAIN_VIEW, TELEMETRY, and other widgets.
 *
 * @module deviceItem
 * @version 1.0.0
 */

import {
  DeviceStatusType,
  ConnectionStatusType,
  normalizeConnectionStatus,
  isTelemetryStale,
  isConnectionStale, // @deprecated - kept for backward compatibility
  calculateDeviceStatusWithRanges,
  calculateDeviceStatus,
} from './deviceStatus.js';

/**
 * Domain types enum
 * @enum {string}
 */
export const DomainType = {
  ENERGY: 'energy',
  WATER: 'water',
  TEMPERATURE: 'temperature',
};

/**
 * Device type categories
 * @enum {string}
 */
export const DeviceCategory = {
  ENERGY_METER: '3F_MEDIDOR',
  TANK: 'TANK',
  CAIXA_DAGUA: 'CAIXA_DAGUA',
  HIDROMETRO: 'HIDROMETRO',
  HIDROMETRO_AREA_COMUM: 'HIDROMETRO_AREA_COMUM',
  HIDROMETRO_SHOPPING: 'HIDROMETRO_SHOPPING',
  TERMOSTATO: 'TERMOSTATO',
  SENSOR_TEMP: 'SENSOR_TEMP',
};

/**
 * Checks if device type is a water tank
 * @param {string} deviceType - Device type string
 * @returns {boolean}
 */
export function isTankDevice(deviceType) {
  const dt = String(deviceType || '').toUpperCase();
  return dt === 'TANK' || dt === 'CAIXA_DAGUA';
}

/**
 * Checks if device type is a hydrometer
 * @param {string} deviceType - Device type string
 * @returns {boolean}
 */
export function isHydrometerDevice(deviceType) {
  const dt = String(deviceType || '').toUpperCase();
  return dt.startsWith('HIDROMETRO');
}

/**
 * Checks if device type is a solenoid valve (water infrastructure)
 * @param {string} deviceType - Device type string
 * @returns {boolean}
 */
export function isSolenoidDevice(deviceType) {
  const dt = String(deviceType || '').toUpperCase();
  return dt.includes('SOLENOIDE');
}

/**
 * Checks if device type is a temperature sensor
 * @param {string} deviceType - Device type string
 * @returns {boolean}
 */
export function isTemperatureDevice(deviceType) {
  const dt = String(deviceType || '').toUpperCase();
  return dt === 'TERMOSTATO' || dt === 'SENSOR_TEMP' || dt.includes('TEMP');
}

/**
 * Checks if device type is an energy device
 * RFC-0128: Includes all energy equipment categories
 * @param {string} deviceType - Device type or profile string
 * @returns {boolean}
 */
export function isEnergyDevice(deviceType) {
  const dt = String(deviceType || '').toUpperCase();

  // Explicitly exclude non-energy devices (lighting, remotes, solenoids)
  // RFC-0175: SOLENOIDE is a control device, not an energy meter
  if (dt.includes('LAMP') || dt.includes('REMOTE') || dt.includes('CONTROLE') || dt.includes('SOLENOIDE')) {
    return false;
  }

  // Energy meters
  if (dt === '3F_MEDIDOR' || dt.includes('3F') || dt.includes('MEDIDOR')) {
    return true;
  }

  // Entrada (main power entry)
  if (dt.includes('ENTRADA') || dt.includes('RELOGIO') || dt.includes('TRAFO') || dt.includes('SUBESTACAO')) {
    return true;
  }

  // HVAC / Climatization
  if (
    dt.includes('CHILLER') ||
    dt.includes('FANCOIL') ||
    dt.includes('HVAC') ||
    dt.includes('AR_CONDICIONADO') ||
    dt.includes('BOMBA_CAG') ||
    dt.includes('CAG')
  ) {
    return true;
  }

  // Motors, elevators, escalators
  if (dt.includes('MOTOR') || dt.includes('ELEVADOR') || dt.includes('ESCADA_ROLANTE')) {
    return true;
  }

  // Pumps (non-water), generators
  if (dt.includes('BOMBA') && !dt.includes('AGUA') && !dt.includes('HIDRO')) {
    return true;
  }
  if (dt.includes('GERADOR') || dt.includes('NOBREAK')) {
    return true;
  }

  return false;
}

/**
 * Determines the domain for a device based on its type
 * @param {string} deviceType - Device type string
 * @returns {string} Domain: 'energy', 'water', or 'temperature'
 */
export function getDomainFromDeviceType(deviceType) {
  if (isTankDevice(deviceType) || isHydrometerDevice(deviceType) || isSolenoidDevice(deviceType)) {
    return DomainType.WATER;
  }
  if (isTemperatureDevice(deviceType)) {
    return DomainType.TEMPERATURE;
  }
  return DomainType.ENERGY;
}

/**
 * Extracts power limits from mapInstantaneousPower JSON for a specific device type
 * @param {Object|string} mapInstantaneousPower - Map of device types to power limits
 * @param {string} deviceType - Device type to look up
 * @param {string} [mode='consumption'] - Mode: 'consumption' or 'instantaneous'
 * @returns {Object|null} Ranges object or null if not found
 */
export function extractPowerLimitsForDevice(mapInstantaneousPower, deviceType, mode = 'consumption') {
  if (!mapInstantaneousPower || !deviceType) {
    return null;
  }

  let map = mapInstantaneousPower;
  if (typeof map === 'string') {
    try {
      map = JSON.parse(map);
    } catch (e) {
      return null;
    }
  }

  const dt = String(deviceType).toUpperCase();

  // Try exact match first
  let limits = map[dt] || map[deviceType];

  // Try partial match
  if (!limits) {
    for (const key of Object.keys(map)) {
      if (dt.includes(key.toUpperCase()) || key.toUpperCase().includes(dt)) {
        limits = map[key];
        break;
      }
    }
  }

  if (!limits) {
    return null;
  }

  // Extract ranges based on mode
  const prefix = mode === 'consumption' ? 'consumption' : 'instantaneous';

  return {
    standbyRange: {
      down: limits[`${prefix}StandbyDown`] ?? limits.standbyDown ?? 0,
      up: limits[`${prefix}StandbyUp`] ?? limits.standbyUp ?? 150,
    },
    normalRange: {
      down: limits[`${prefix}NormalDown`] ?? limits.normalDown ?? 150,
      up: limits[`${prefix}NormalUp`] ?? limits.normalUp ?? 800,
    },
    alertRange: {
      down: limits[`${prefix}AlertDown`] ?? limits.alertDown ?? 800,
      up: limits[`${prefix}AlertUp`] ?? limits.alertUp ?? 1200,
    },
    failureRange: {
      down: limits[`${prefix}FailureDown`] ?? limits.failureDown ?? 1200,
      up: limits[`${prefix}FailureUp`] ?? limits.failureUp ?? 99999,
    },
    source: limits.source || 'unknown',
    tier: limits.tier || 3,
  };
}

/**
 * @typedef {Object} DeviceMetadata
 * @property {string} [ingestionId] - Ingestion ID from API
 * @property {string} [identifier] - Device identifier
 * @property {string} [label] - Device label/name
 * @property {string} [deviceType] - Device type (e.g., '3F_MEDIDOR', 'TANK')
 * @property {string} [deviceProfile] - Device profile
 * @property {string} [connectionStatus] - Raw connection status from ThingsBoard
 * @property {string} [centralId] - Central/gateway ID
 * @property {string} [centralName] - Central/gateway name
 * @property {string} [slaveId] - Slave/modbus ID
 * @property {number} [lastActivityTime] - Last activity timestamp (NOT used in v3)
 * @property {number} [lastConnectTime] - Last connect timestamp (deprecated)
 * @property {number} [lastDisconnectTime] - Last disconnect timestamp (deprecated)
 * @property {number} [consumptionTs] - RFC-0110 v3: Timestamp of consumption telemetry (energy devices)
 * @property {number} [pulsesTs] - RFC-0110 v3: Timestamp of pulses telemetry (hidrômetros)
 * @property {number} [temperatureTs] - RFC-0110 v3: Timestamp of temperature telemetry (temp sensors)
 * @property {number} [waterLevelTs] - RFC-0110 v3: Timestamp of water_level telemetry (tanks)
 * @property {number} [waterPercentageTs] - RFC-0110 v3: Timestamp of water_percentage telemetry (tanks)
 * @property {string} [log_annotations] - JSON string of annotations
 * @property {number} [temperature] - Temperature reading (for temp sensors)
 * @property {number} [waterLevel] - Water level (for tanks)
 * @property {number} [waterPercentage] - Water percentage 0-1 (for tanks)
 * @property {number} [consumption] - Consumption/power value
 * @property {string|Object} [deviceMapInstaneousPower] - Device-specific power limits (TIER 0)
 */

/**
 * @typedef {Object} DeviceItemOptions
 * @property {string} [domain] - Domain: 'energy', 'water', 'temperature'
 * @property {string} [labelWidget] - Widget label for grouping
 * @property {Object} [apiRow] - API response row with enriched data
 * @property {Object} [globalMapInstantaneousPower] - Global power limits from customer (TIER 2)
 * @property {Object} [temperatureLimits] - Global temperature limits { min, max }
 */

/**
 * @typedef {Object} DeviceItem
 * @property {string} id - Unique identifier
 * @property {string} tbId - ThingsBoard entity ID
 * @property {string|null} ingestionId - Ingestion ID for API matching
 * @property {string} identifier - Device identifier
 * @property {string} label - Display label
 * @property {string} entityLabel - Entity label
 * @property {string} name - Device name
 * @property {number} value - Current value (consumption, temperature, water level)
 * @property {number} perc - Percentage (for tanks)
 * @property {string} deviceType - Device type
 * @property {string|null} deviceProfile - Device profile
 * @property {string|null} effectiveDeviceType - Effective device type (profile or type)
 * @property {string} deviceStatus - Calculated device status
 * @property {string} connectionStatus - Normalized connection status
 * @property {string|null} slaveId - Slave/modbus ID
 * @property {string|null} centralId - Central/gateway ID
 * @property {string|null} centralName - Central/gateway name
 * @property {number|null} lastActivityTime - Last activity timestamp
 * @property {number|null} lastConnectTime - Last connect timestamp
 * @property {number|null} lastDisconnectTime - Last disconnect timestamp
 * @property {Object|null} log_annotations - Parsed annotations
 * @property {string|null} labelWidget - Widget grouping label
 * @property {string|null} groupLabel - Group label (alias for labelWidget)
 * @property {Object|null} deviceMapInstaneousPower - Device-specific power limits
 * @property {number|null} consumptionPower - Current consumption power
 * @property {number|null} temperature - Temperature reading
 * @property {number|null} temperatureMin - Min temperature limit
 * @property {number|null} temperatureMax - Max temperature limit
 * @property {string|null} temperatureStatus - Temperature status: 'ok', 'above', 'below'
 * @property {number|null} waterLevel - Water level (liters)
 * @property {number|null} waterPercentage - Water percentage (0-1)
 * @property {boolean} _hasMetadata - Flag indicating metadata presence
 * @property {boolean} _hasApiData - Flag indicating API data presence
 * @property {boolean} _isTankDevice - Flag for tank devices
 * @property {boolean} _isHidrometerDevice - Flag for hydrometer devices
 */

/**
 * Creates a standardized device item object
 *
 * @param {string} entityId - ThingsBoard entity ID
 * @param {DeviceMetadata} meta - Device metadata from datasource
 * @param {DeviceItemOptions} [options={}] - Additional options
 * @returns {DeviceItem} Standardized device item
 *
 * @example
 * // Create energy device item
 * const item = createDeviceItem('abc-123', {
 *   ingestionId: 'ing-456',
 *   identifier: 'METER-01',
 *   label: 'Main Meter',
 *   deviceType: '3F_MEDIDOR',
 *   connectionStatus: 'online',
 *   consumption: 500
 * }, {
 *   domain: 'energy',
 *   labelWidget: 'Lojas',
 *   globalMapInstantaneousPower: { '3F_MEDIDOR': { standbyUp: 100, normalUp: 800 } }
 * });
 *
 * @example
 * // Create temperature sensor item
 * const item = createDeviceItem('xyz-789', {
 *   identifier: 'TEMP-01',
 *   label: 'Cold Room',
 *   deviceType: 'TERMOSTATO',
 *   connectionStatus: 'online',
 *   temperature: 5.2
 * }, {
 *   domain: 'temperature',
 *   temperatureLimits: { min: 2, max: 8 }
 * });
 */
export function createDeviceItem(entityId, meta, options = {}) {
  const {
    domain,
    labelWidget = null,
    apiRow = null,
    globalMapInstantaneousPower = null,
    temperatureLimits = null,
    // RFC-0110: Configurable delay time for stale telemetry detection (default 1440 min = 24h)
    delayTimeConnectionInMins = 1440,
  } = options;

  // Normalize values
  const deviceType = meta.deviceType || meta.deviceProfile || '';
  const deviceProfile = meta.deviceProfile || deviceType || '';
  const effectiveDeviceType = deviceProfile || deviceType || null;
  const identifier = meta.identifier || '';
  const label = meta.label || identifier || entityId;

  // Detect device categories
  const _isTankDevice = isTankDevice(deviceType);
  const _isHidrometerDevice = isHydrometerDevice(deviceType);
  const _isTemperatureDevice = isTemperatureDevice(deviceType);
  const _isEnergyDevice = !_isTankDevice && !_isHidrometerDevice && !_isTemperatureDevice;

  // Determine domain if not provided
  const effectiveDomain = domain || getDomainFromDeviceType(deviceType);

  // Normalize connection status
  const rawConnectionStatus = meta.connectionStatus;
  const connectionStatus = normalizeConnectionStatus(rawConnectionStatus);

  // Calculate device status
  let deviceStatus = DeviceStatusType.NO_INFO;

  // RFC-0110 v3: Get domain-specific telemetry timestamp
  // IMPORTANT: Each device type has its OWN specific telemetry
  let telemetryTs = null;
  if (_isTankDevice) {
    // Tanks (caixa d'água) use water_level or water_percentage
    telemetryTs = meta.waterLevelTs ?? meta.waterPercentageTs ?? null;
  } else if (_isHidrometerDevice) {
    // Hidrômetros use pulses
    telemetryTs = meta.pulsesTs ?? null;
  } else if (_isTemperatureDevice) {
    // Temperature sensors use temperature
    telemetryTs = meta.temperatureTs ?? null;
  } else {
    // Energy devices use consumption
    telemetryTs = meta.consumptionTs ?? null;
  }

  if (_isEnergyDevice && effectiveDomain === DomainType.ENERGY) {
    // Energy devices use power ranges
    const deviceMapLimits = meta.deviceMapInstaneousPower
      ? extractPowerLimitsForDevice(meta.deviceMapInstaneousPower, effectiveDeviceType)
      : null;
    const globalLimits = globalMapInstantaneousPower
      ? extractPowerLimitsForDevice(globalMapInstantaneousPower, effectiveDeviceType)
      : null;

    const ranges = deviceMapLimits || globalLimits;
    const consumptionValue = meta.consumption ?? apiRow?.value ?? null;

    // RFC-0110 v3: Use unified calculateDeviceStatus with domain-specific telemetry timestamp
    deviceStatus = calculateDeviceStatus({
      connectionStatus: connectionStatus,
      domain: 'energy',
      telemetryValue: consumptionValue,
      telemetryTimestamp: telemetryTs,
      ranges: ranges,
      delayTimeConnectionInMins: delayTimeConnectionInMins,
    });
  } else {
    // Non-energy devices (TANK, TERMOSTATO, HIDROMETRO) - simple status
    // RFC-0110 v3: Domain-specific telemetry required + Dual threshold

    // 1. WAITING → NOT_INSTALLED (absolute priority)
    if (connectionStatus === 'waiting') {
      deviceStatus = DeviceStatusType.NOT_INSTALLED;
    }
    // 2. v3: No domain-specific telemetry → OFFLINE
    // NOTE: Timestamp 0 (epoch 1970) is treated as invalid/missing
    else if (telemetryTs === null || telemetryTs === undefined || telemetryTs <= 0) {
      deviceStatus = DeviceStatusType.OFFLINE;
    }
    // 3. Has domain-specific telemetry → apply dual threshold logic
    else {
      const SHORT_DELAY_MINS = 60;
      const hasRecentTelemetry = !isTelemetryStale(telemetryTs, SHORT_DELAY_MINS);
      const staleTelemetryLong = isTelemetryStale(telemetryTs, delayTimeConnectionInMins);

      if (connectionStatus === 'bad') {
        // RFC-0110 v3: bad + recent telemetry → treat as online (hide from client)
        // bad + stale telemetry → show WEAK_CONNECTION
        deviceStatus = hasRecentTelemetry ? DeviceStatusType.POWER_ON : DeviceStatusType.WEAK_CONNECTION;
      } else if (connectionStatus === 'offline') {
        // RFC-0110 v3: offline + recent telemetry (< 60 mins) → treat as online
        // offline + stale telemetry (> 60 mins) → OFFLINE
        deviceStatus = hasRecentTelemetry ? DeviceStatusType.POWER_ON : DeviceStatusType.OFFLINE;
      } else if (connectionStatus === 'online') {
        // RFC-0110 v3: online + stale telemetry (> 24h) → OFFLINE
        deviceStatus = staleTelemetryLong ? DeviceStatusType.OFFLINE : DeviceStatusType.POWER_ON;
      } else {
        deviceStatus = DeviceStatusType.POWER_ON;
      }
    }
  }

  // Calculate temperature status for temperature sensors
  let temperatureStatus = null;
  const temperature = meta.temperature ?? null;
  if (_isTemperatureDevice && temperature !== null && temperatureLimits) {
    const { min, max } = temperatureLimits;
    if (min !== null && max !== null) {
      if (temperature > max) {
        temperatureStatus = 'above';
      } else if (temperature < min) {
        temperatureStatus = 'below';
      } else {
        temperatureStatus = 'ok';
      }
    }
  }

  // Parse log_annotations if string
  let logAnnotations = null;
  if (meta.log_annotations) {
    if (typeof meta.log_annotations === 'string') {
      try {
        logAnnotations = JSON.parse(meta.log_annotations);
      } catch (e) {
        logAnnotations = null;
      }
    } else {
      logAnnotations = meta.log_annotations;
    }
  }

  // Determine value based on device type
  let value = 0;
  let perc = 0;

  if (_isTankDevice) {
    value = meta.waterLevel ?? 0;
    perc = (meta.waterPercentage ?? 0) * 100; // Convert 0-1 to 0-100
  } else if (_isTemperatureDevice) {
    value = temperature ?? 0;
  } else {
    value = meta.consumption ?? apiRow?.value ?? 0;
  }

  // Build the standardized item
  return {
    // Identifiers
    id: meta.ingestionId || entityId,
    tbId: entityId,
    ingestionId: meta.ingestionId || null,
    identifier: identifier,
    deviceIdentifier: identifier,

    // Display names
    label: label,
    entityLabel: label,
    name: apiRow?.name || label,

    // Values
    value: value,
    perc: perc,

    // Device classification
    deviceType: deviceType,
    deviceProfile: deviceProfile,
    effectiveDeviceType: effectiveDeviceType,

    // Status
    deviceStatus: deviceStatus,
    connectionStatus: connectionStatus,

    // Relationships
    slaveId: meta.slaveId ?? apiRow?.slaveId ?? null,
    centralId: meta.centralId ?? apiRow?.centralId ?? null,
    centralName: meta.centralName ?? null,
    gatewayId: apiRow?.gatewayId ?? null,
    customerId: apiRow?.customerId ?? null,
    assetId: apiRow?.assetId ?? null,
    assetName: apiRow?.assetName ?? null,
    customerName: meta.customerName ?? null,

    // Timestamps
    lastActivityTime: meta.lastActivityTime ?? null,
    lastConnectTime: meta.lastConnectTime ?? null,
    lastDisconnectTime: meta.lastDisconnectTime ?? null,
    connectionStatusTime: meta.lastConnectTime ?? null,
    timeVal: meta.lastActivityTime ?? null,
    // RFC-0110 v3: Domain-specific telemetry timestamps for offline detection
    consumptionTs: meta.consumptionTs ?? null,
    pulsesTs: meta.pulsesTs ?? null,
    temperatureTs: meta.temperatureTs ?? null,
    waterLevelTs: meta.waterLevelTs ?? null,
    waterPercentageTs: meta.waterPercentageTs ?? null,

    // Annotations
    log_annotations: logAnnotations,

    // Grouping
    labelWidget: labelWidget,
    groupLabel: labelWidget,

    // Power limits (for Settings modal and recalculation)
    mapInstantaneousPower: globalMapInstantaneousPower,
    deviceMapInstaneousPower: meta.deviceMapInstaneousPower ?? null,
    consumptionPower: meta.consumption ?? null,

    // Temperature fields
    temperature: _isTemperatureDevice ? temperature : null,
    temperatureMin: temperatureLimits?.min ?? null,
    temperatureMax: temperatureLimits?.max ?? null,
    temperatureStatus: temperatureStatus,

    // Water fields
    waterLevel: _isTankDevice ? (meta.waterLevel ?? null) : null,
    waterPercentage: _isTankDevice ? (meta.waterPercentage ?? null) : null,

    // Internal flags
    _hasMetadata: true,
    _hasApiData: apiRow !== null,
    _matchedBy: apiRow ? (meta.ingestionId ? 'ingestionId' : 'name') : null,
    _isTankDevice: _isTankDevice,
    _isHidrometerDevice: _isHidrometerDevice,
    _isTemperatureDevice: _isTemperatureDevice,
    _isEnergyDevice: _isEnergyDevice,

    // Placeholder for UI state
    updatedIdentifiers: {},
  };
}

/**
 * Creates multiple device items from a metadata map
 *
 * @param {Map<string, DeviceMetadata>} metadataMap - Map of entityId to metadata
 * @param {DeviceItemOptions} options - Options to apply to all items
 * @returns {DeviceItem[]} Array of device items
 */
export function createDeviceItemsFromMap(metadataMap, options = {}) {
  const items = [];

  for (const [entityId, meta] of metadataMap.entries()) {
    items.push(createDeviceItem(entityId, meta, options));
  }

  return items;
}

/**
 * Recalculates deviceStatus for an existing item (e.g., after data refresh)
 *
 * @param {DeviceItem} item - Existing device item
 * @param {Object} [newData] - New data to apply
 * @param {Object} [options] - Additional options
 * @returns {DeviceItem} Updated device item
 */
export function recalculateDeviceStatus(item, newData = {}, options = {}) {
  const updatedMeta = {
    ...item,
    ...newData,
    connectionStatus: newData.connectionStatus ?? item.connectionStatus,
    consumption: newData.value ?? newData.consumption ?? item.consumptionPower ?? item.value,
    deviceMapInstaneousPower: newData.deviceMapInstaneousPower ?? item.deviceMapInstaneousPower,
    // RFC-0110 v3: Ensure domain-specific telemetry timestamps are passed through
    consumptionTs: newData.consumptionTs ?? item.consumptionTs,
    pulsesTs: newData.pulsesTs ?? item.pulsesTs,
    temperatureTs: newData.temperatureTs ?? item.temperatureTs,
    waterLevelTs: newData.waterLevelTs ?? item.waterLevelTs,
    waterPercentageTs: newData.waterPercentageTs ?? item.waterPercentageTs,
    // v3: lastActivityTime is NOT used as fallback anymore
    lastActivityTime: newData.lastActivityTime ?? item.lastActivityTime,
    // @deprecated - kept for backward compatibility
    lastConnectTime: newData.lastConnectTime ?? item.lastConnectTime,
    lastDisconnectTime: newData.lastDisconnectTime ?? item.lastDisconnectTime,
  };

  const updatedOptions = {
    domain: options.domain ?? getDomainFromDeviceType(item.deviceType),
    labelWidget: item.labelWidget,
    globalMapInstantaneousPower: options.globalMapInstantaneousPower ?? item.mapInstantaneousPower,
    temperatureLimits: options.temperatureLimits ?? {
      min: item.temperatureMin,
      max: item.temperatureMax,
    },
    // RFC-0110: Pass delay time for stale telemetry detection (default 24h)
    delayTimeConnectionInMins: options.delayTimeConnectionInMins ?? 1440,
  };

  return createDeviceItem(item.tbId, updatedMeta, updatedOptions);
}
