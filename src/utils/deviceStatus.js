/**
 * Device Status Utilities
 * Centralized device status management for MYIO components
 *
 * @module deviceStatus
 * @version 1.0.0
 */

/**
 * Device status types enum
 * @enum {string}
 */
export const DeviceStatusType = {
  POWER_ON: "power_on",
  STANDBY: "standby",
  POWER_OFF: "power_off",
  WARNING: "warning",
  FAILURE: "failure",
  MAINTENANCE: "maintenance",
  NO_INFO: "no_info",
  NOT_INSTALLED: "not_installed",
  OFFLINE: "offline",
  WEAK_CONNECTION: "weak_connection", // RFC-0109: Device with unstable/bad connection
};

/**
 * Connection status types enum
 * Maps raw ThingsBoard connectionStatus values to normalized status
 * @enum {string}
 */
export const ConnectionStatusType = {
  ONLINE: "online",
  CONNECTED: "connected", // alias for online
  OFFLINE: "offline",
  WAITING: "waiting",
  BAD: "bad", // RFC-0109: Weak/unstable connection
};

/**
 * Device status icons mapping
 * @type {Object.<string, string>}
 */
export const deviceStatusIcons = {
  [DeviceStatusType.POWER_ON]: "⚡",
  [DeviceStatusType.STANDBY]: "🔌",
  [DeviceStatusType.POWER_OFF]: "⚫",
  [DeviceStatusType.WARNING]: "⚠️",
  [DeviceStatusType.FAILURE]: "🚨",
  [DeviceStatusType.MAINTENANCE]: "🛠️",
  [DeviceStatusType.NO_INFO]: "❓️",
  [DeviceStatusType.NOT_INSTALLED]: "📦",
  [DeviceStatusType.OFFLINE]: "🔴",
  [DeviceStatusType.WEAK_CONNECTION]: "📶", // RFC-0109: Weak signal icon
};

/**
 * Water device status icons mapping (for TANK/CAIXA_DAGUA)
 * @type {Object.<string, string>}
 */
export const waterDeviceStatusIcons = {
  [DeviceStatusType.POWER_ON]: "💧",
  [DeviceStatusType.STANDBY]: "🚰",
  [DeviceStatusType.POWER_OFF]: "⚫",
  [DeviceStatusType.WARNING]: "⚠️",
  [DeviceStatusType.FAILURE]: "🚨",
  [DeviceStatusType.MAINTENANCE]: "🛠️",
  [DeviceStatusType.NO_INFO]: "❓️",
  [DeviceStatusType.NOT_INSTALLED]: "📦",
  [DeviceStatusType.OFFLINE]: "🔴",
  [DeviceStatusType.WEAK_CONNECTION]: "📶", // RFC-0109: Weak signal icon
};

/**
 * Temperature device status icons mapping (for TERMOSTATO)
 * @type {Object.<string, string>}
 */
export const temperatureDeviceStatusIcons = {
  [DeviceStatusType.POWER_ON]: "🌡️",
  [DeviceStatusType.STANDBY]: "🌡️",
  [DeviceStatusType.POWER_OFF]: "⚫",
  [DeviceStatusType.WARNING]: "⚠️",
  [DeviceStatusType.FAILURE]: "🚨",
  [DeviceStatusType.MAINTENANCE]: "🛠️",
  [DeviceStatusType.NO_INFO]: "❓️",
  [DeviceStatusType.NOT_INSTALLED]: "📦",
  [DeviceStatusType.OFFLINE]: "🔴",
  [DeviceStatusType.WEAK_CONNECTION]: "📶", // RFC-0109: Weak signal icon
};

/**
 * Connection status icons mapping
 * @type {Object.<string, string>}
 */
export const connectionStatusIcons = {
  [ConnectionStatusType.ONLINE]: "🟢",
  [ConnectionStatusType.CONNECTED]: "🟢",
  [ConnectionStatusType.OFFLINE]: "🚫",
  [ConnectionStatusType.WAITING]: "🟡",
  [ConnectionStatusType.BAD]: "🟠", // RFC-0109: Weak connection icon (orange)
};

/**
 * Maps device status to connection status
 * @param {string} deviceStatus - The device status
 * @returns {string} The connection status
 */
export function mapDeviceToConnectionStatus(deviceStatus) {
  if (deviceStatus === DeviceStatusType.NO_INFO || deviceStatus === DeviceStatusType.OFFLINE) {
    return ConnectionStatusType.OFFLINE;
  }
  if (deviceStatus === DeviceStatusType.WEAK_CONNECTION) {
    return ConnectionStatusType.BAD;
  }
  if (deviceStatus === DeviceStatusType.NOT_INSTALLED) {
    return ConnectionStatusType.WAITING;
  }
  return ConnectionStatusType.ONLINE;
}

/**
 * RFC-0109: Normalizes raw connection status string from ThingsBoard
 * @param {string|boolean} rawStatus - Raw status from ThingsBoard
 * @returns {'online' | 'waiting' | 'bad' | 'offline'} - Normalized status
 */
export function normalizeConnectionStatus(rawStatus) {
  if (rawStatus === null || rawStatus === undefined || rawStatus === '') {
    return 'offline';
  }

  const statusLower = String(rawStatus).toLowerCase().trim();

  // Online states
  if (['online', 'ok', 'running', 'true', 'connected', 'active', '1'].includes(statusLower)) {
    return 'online';
  }

  // Waiting/transitional states
  if (['waiting', 'connecting', 'pending'].includes(statusLower)) {
    return 'waiting';
  }

  // RFC-0109: Bad/weak connection states
  if (['bad', 'weak', 'unstable', 'poor', 'degraded'].includes(statusLower)) {
    return 'bad';
  }

  // Default to offline
  return 'offline';
}

/**
 * RFC-0110: Check if telemetry timestamp indicates stale connection
 * Uses telemetry timestamp as the primary source of truth (not connectionStatusTs).
 *
 * Rationale: ThingsBoard updates connectionStatusTs frequently (~1min) even when
 * device is offline. Telemetry (consumption/pulses/temperature) only updates when
 * the device actually sends data, making it a reliable indicator of activity.
 *
 * @param {number|Date|null} telemetryTimestamp - Primary: timestamp from telemetry data
 * @param {number|Date|null} lastActivityTime - Fallback: ThingsBoard lastActivityTime
 * @param {number} [delayMins=1440] - Threshold in minutes (default: 24 hours)
 * @returns {boolean} true if telemetry is stale (device should be considered offline)
 *
 * @example
 * // Recent telemetry (30 min ago) → not stale
 * isTelemetryStale(Date.now() - 30 * 60 * 1000, null, 1440); // false
 *
 * @example
 * // Old telemetry (25 hours ago) → stale
 * isTelemetryStale(Date.now() - 25 * 60 * 60 * 1000, null, 1440); // true
 */
export function isTelemetryStale(telemetryTimestamp, lastActivityTime = null, delayMins = 1440) {
  // Use telemetryTimestamp or lastActivityTime as fallback
  const timestamp = telemetryTimestamp || lastActivityTime;

  // No timestamp available = assume not stale (conservative approach)
  if (!timestamp) {
    return false;
  }

  const lastUpdate = new Date(timestamp);
  const now = new Date();
  const delayMs = delayMins * 60 * 1000;

  const timeSinceUpdate = now.getTime() - lastUpdate.getTime();

  return timeSinceUpdate > delayMs;
}

/**
 * @deprecated Use isTelemetryStale() instead. This function is kept for backward compatibility.
 *
 * RFC-0110: Verifica se a conexão está obsoleta baseado no timestamp do connectionStatus
 * DEPRECATED: connectionStatusTs is unreliable - ThingsBoard updates it even when device is offline.
 *
 * @param {Object} params
 * @param {number|Date|null} params.connectionStatusTs - Timestamp do connectionStatus do ThingsBoard
 * @param {number|Date|null} params.lastActivityTime - Fallback: timestamp da última atividade
 * @param {number} [params.delayTimeConnectionInMins=1440] - Tempo em minutos para considerar conexão obsoleta
 * @returns {boolean} true se conexão está obsoleta (deve ser considerado offline)
 */
export function isConnectionStale({
  connectionStatusTs = null,
  lastActivityTime = null,
  delayTimeConnectionInMins = 1440,
} = {}) {
  // Delegate to new function
  return isTelemetryStale(connectionStatusTs, lastActivityTime, delayTimeConnectionInMins);
}

/**
 * @deprecated Use normalizeConnectionStatus instead
 */
export function mapConnectionStatus(rawStatus) {
  return normalizeConnectionStatus(rawStatus);
}

/**
 * Maps device status to a simplified card status
 * Used for styling and visual representation
 *
 * @param {string} deviceStatus - The device status
 * @returns {string} Simplified status: 'ok', 'alert', 'fail', 'weak', 'unknown', 'offline', 'not_installed'
 */
export function mapDeviceStatusToCardStatus(deviceStatus) {
  const statusMap = {
    [DeviceStatusType.POWER_ON]: 'ok',
    [DeviceStatusType.STANDBY]: 'alert',
    [DeviceStatusType.POWER_OFF]: 'fail',
    [DeviceStatusType.WARNING]: 'alert',
    [DeviceStatusType.FAILURE]: 'fail',
    [DeviceStatusType.MAINTENANCE]: 'alert',
    [DeviceStatusType.NO_INFO]: 'unknown',
    [DeviceStatusType.NOT_INSTALLED]: 'not_installed',
    [DeviceStatusType.OFFLINE]: 'offline',
    [DeviceStatusType.WEAK_CONNECTION]: 'weak', // RFC-0109
  };
  return statusMap[deviceStatus] || 'unknown';
}

/**
 * Checks if device status should trigger a flashing icon
 *
 * @param {string} deviceStatus - The device status
 * @returns {boolean} True if icon should flash
 */
export function shouldFlashIcon(deviceStatus) {
  return (
    deviceStatus === DeviceStatusType.POWER_OFF ||
    deviceStatus === DeviceStatusType.WARNING ||
    deviceStatus === DeviceStatusType.FAILURE ||
    deviceStatus === DeviceStatusType.MAINTENANCE ||
    deviceStatus === DeviceStatusType.OFFLINE ||
    deviceStatus === DeviceStatusType.WEAK_CONNECTION // RFC-0109
  );
}

/**
 * Checks if device is offline based on device status
 *
 * @param {string} deviceStatus - The device status
 * @returns {boolean} True if device is offline
 */
export function isDeviceOffline(deviceStatus) {
  return deviceStatus === DeviceStatusType.NO_INFO || deviceStatus === DeviceStatusType.OFFLINE;
}

/**
 * Gets the appropriate icon for a device status
 *
 * @param {string} deviceStatus - The device status
 * @param {string} deviceType - The device type (optional, for water/temperature devices)
 * @returns {string} The icon emoji/character
 */
export function getDeviceStatusIcon(deviceStatus, deviceType = null) {
  // Normalize device type for comparison
  const normalizedType = deviceType?.toUpperCase() || '';

  // Use water icons for TANK/CAIXA_DAGUA/HIDROMETRO devices (including subtypes)
  const isWaterDevice =
    normalizedType === 'TANK' ||
    normalizedType === 'CAIXA_DAGUA' ||
    normalizedType === 'HIDROMETRO' ||
    normalizedType === 'HIDROMETRO_AREA_COMUM' ||
    normalizedType === 'HIDROMETRO_SHOPPING' ||
    normalizedType.startsWith('HIDROMETRO_');

  // Use temperature icons for TERMOSTATO devices
  const isTemperatureDevice = normalizedType === 'TERMOSTATO';

  let iconMap;
  if (isWaterDevice) {
    iconMap = waterDeviceStatusIcons;
  } else if (isTemperatureDevice) {
    iconMap = temperatureDeviceStatusIcons;
  } else {
    iconMap = deviceStatusIcons;
  }

  return iconMap[deviceStatus] || iconMap[DeviceStatusType.POWER_ON];
}

/**
 * Gets the appropriate icon for a connection status
 *
 * @param {string} connectionStatus - The connection status
 * @returns {string} The icon emoji/character
 */
export function getConnectionStatusIcon(connectionStatus) {
  return connectionStatusIcons[connectionStatus] || connectionStatusIcons[ConnectionStatusType.OFFLINE];
}

/**
 * Validates if a given status is a valid device status
 *
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid
 */
export function isValidDeviceStatus(status) {
  return Object.values(DeviceStatusType).includes(status);
}

/**
 * Validates if a given status is a valid connection status
 *
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid
 */
export function isValidConnectionStatus(status) {
  return Object.values(ConnectionStatusType).includes(status);
}

/**
 * Gets a complete status object with all derived information
 *
 * @param {string} deviceStatus - The device status
 * @returns {Object} Status object with all derived properties
 */
export function getDeviceStatusInfo(deviceStatus) {
  const connectionStatus = mapDeviceToConnectionStatus(deviceStatus);

  return {
    deviceStatus,
    connectionStatus,
    cardStatus: mapDeviceStatusToCardStatus(deviceStatus),
    deviceIcon: getDeviceStatusIcon(deviceStatus),
    connectionIcon: getConnectionStatusIcon(connectionStatus),
    shouldFlash: shouldFlashIcon(deviceStatus),
    isOffline: isDeviceOffline(deviceStatus),
    isValid: isValidDeviceStatus(deviceStatus)
  };
}

/**
 * RFC-0110 v3: Unified device status calculation based on DOMAIN-SPECIFIC telemetry timestamps.
 *
 * This function determines device status using:
 * 1. connectionStatus for immediate states (waiting)
 * 2. DOMAIN-SPECIFIC telemetryTimestamp - REQUIRED (if null → OFFLINE)
 * 3. telemetryTimestamp for stale/offline detection (dual threshold)
 * 4. telemetryValue for operational status (standby, power_on, warning, failure)
 *
 * IMPORTANT v3: telemetryTimestamp MUST be the domain-specific timestamp:
 * - Energy: consumptionTs
 * - Water (hidrômetro): pulsesTs
 * - Water (caixa d'água): waterLevelTs or waterPercentageTs
 * - Temperature: temperatureTs
 *
 * DO NOT use lastActivityTime or connectionStatusTs as telemetryTimestamp!
 *
 * @param {Object} params - Configuration object
 * @param {string} params.connectionStatus - Connection status: "waiting", "offline", "bad", or "online"
 * @param {string} [params.domain='energy'] - Device domain: 'energy', 'water', or 'temperature'
 * @param {number|null} [params.telemetryValue] - Telemetry value (consumption/pulses/temperature)
 * @param {number|null} [params.telemetryTimestamp] - Unix timestamp (ms) of DOMAIN-SPECIFIC telemetry (REQUIRED in v3)
 * @param {number|null} [params.lastActivityTime] - NOT USED in v3 (kept for backward compat)
 * @param {Object} [params.ranges] - Consumption ranges for status calculation
 * @param {number} [params.delayTimeConnectionInMins=1440] - Long threshold for 'online' status (default: 24h)
 * @param {number} [params.shortDelayMins=60] - Short threshold for 'offline'/'bad' status (default: 60 mins)
 * @param {number|null} [params.lastConsumptionValue] - @deprecated Use telemetryValue instead
 * @param {number} [params.limitOfPowerOnStandByWatts] - @deprecated Use ranges instead
 * @param {number} [params.limitOfPowerOnAlertWatts] - @deprecated Use ranges instead
 * @param {number} [params.limitOfPowerOnFailureWatts] - @deprecated Use ranges instead
 * @returns {string} Device status from DeviceStatusType enum
 *
 * @example
 * // RFC-0110 v3: Domain-specific telemetry required
 * calculateDeviceStatus({
 *   connectionStatus: "online",
 *   domain: "energy",
 *   telemetryValue: 500,
 *   telemetryTimestamp: consumptionTs, // MUST be consumptionTs, NOT lastActivityTime
 *   ranges: { ... },
 *   delayTimeConnectionInMins: 1440
 * }); // Returns "power_on" or "offline" if no consumptionTs
 */
export function calculateDeviceStatus({
  connectionStatus,
  // RFC-0110: New parameters
  domain = 'energy',
  telemetryValue = null,
  telemetryTimestamp = null, // v3: MUST be domain-specific (consumptionTs, pulsesTs, etc.)
  lastActivityTime = null, // v3: NOT USED as fallback anymore
  ranges = null,
  // RFC-0110 v2: Dual threshold configuration
  delayTimeConnectionInMins = 1440, // For 'online' status (24h default)
  shortDelayMins = 60, // For 'offline'/'bad' status (60 mins default)
  // Legacy parameters (backward compatibility)
  lastConsumptionValue = null,
  limitOfPowerOnStandByWatts = null,
  limitOfPowerOnAlertWatts = null,
  limitOfPowerOnFailureWatts = null,
  // @deprecated - kept for backward compatibility
  lastConnectTime = null,
  lastDisconnectTime = null,
}) {
  // RFC-0109: Normalize connectionStatus first
  const normalizedStatus = normalizeConnectionStatus(connectionStatus);

  // 1. WAITING → NOT_INSTALLED (absolute priority)
  if (normalizedStatus === "waiting") {
    return DeviceStatusType.NOT_INSTALLED;
  }

  // 2. RFC-0110 v3: Check if domain-specific telemetry timestamp exists
  // If device NEVER received domain-specific telemetry → OFFLINE
  // IMPORTANT: We only check telemetryTimestamp, NOT lastActivityTime
  if (telemetryTimestamp === null || telemetryTimestamp === undefined) {
    // console.log(`[RFC-0110 v3] Device has NO domain-specific telemetry (${domain}) → OFFLINE`);
    return DeviceStatusType.OFFLINE;
  }

  // 3. BAD → Check telemetry (60 mins threshold)
  // If recent telemetry, treat as online (hide weak_connection from client)
  // If stale telemetry, show WEAK_CONNECTION
  if (normalizedStatus === "bad") {
    const hasRecentTelemetry = !isTelemetryStale(telemetryTimestamp, null, shortDelayMins);
    if (hasRecentTelemetry) {
      // Device is working fine, continue to value-based calculation
    } else {
      return DeviceStatusType.WEAK_CONNECTION;
    }
  }

  // 4. OFFLINE → Check telemetry (60 mins threshold)
  // If recent telemetry (< 60 mins), treat as online
  // If stale telemetry (> 60 mins), mark as OFFLINE
  if (normalizedStatus === "offline") {
    const hasRecentTelemetry = !isTelemetryStale(telemetryTimestamp, null, shortDelayMins);
    if (!hasRecentTelemetry) {
      return DeviceStatusType.OFFLINE;
    }
    // Has recent telemetry - continue to value-based calculation
  }

  // 5. ONLINE → Check telemetry (24h threshold)
  // If stale telemetry (> 24h), mark as OFFLINE
  if (normalizedStatus === "online") {
    const telemetryStale = isTelemetryStale(telemetryTimestamp, null, delayTimeConnectionInMins);
    if (telemetryStale) {
      return DeviceStatusType.OFFLINE;
    }
  }

  // 6. Device is effectively online - calculate status from telemetry value
  // Support both new (telemetryValue) and legacy (lastConsumptionValue) parameters
  const value = telemetryValue ?? lastConsumptionValue;

  // If no value data, return POWER_ON for online devices
  if (value === null || value === undefined) {
    return DeviceStatusType.POWER_ON;
  }

  const consumption = Number(value);

  // Check if value is valid
  if (isNaN(consumption)) {
    return DeviceStatusType.MAINTENANCE;
  }

  // If ranges provided, use range-based calculation
  if (ranges && ranges.standbyRange && ranges.normalRange && ranges.alertRange && ranges.failureRange) {
    const { standbyRange, normalRange, alertRange, failureRange } = ranges;

    if (consumption >= standbyRange.down && consumption <= standbyRange.up) {
      return DeviceStatusType.STANDBY;
    }
    if (consumption >= normalRange.down && consumption <= normalRange.up) {
      return DeviceStatusType.POWER_ON;
    }
    if (consumption >= alertRange.down && consumption <= alertRange.up) {
      return DeviceStatusType.WARNING;
    }
    if (consumption >= failureRange.down || consumption > failureRange.up) {
      return DeviceStatusType.FAILURE;
    }
    if (consumption < standbyRange.down) {
      return DeviceStatusType.MAINTENANCE;
    }
  }

  // Legacy limit-based calculation (backward compatibility)
  if (limitOfPowerOnStandByWatts !== null) {
    if (consumption >= 0 && consumption <= limitOfPowerOnStandByWatts) {
      return DeviceStatusType.STANDBY;
    }
    if (consumption > limitOfPowerOnStandByWatts && consumption <= limitOfPowerOnAlertWatts) {
      return DeviceStatusType.POWER_ON;
    }
    if (consumption > limitOfPowerOnAlertWatts && consumption <= limitOfPowerOnFailureWatts) {
      return DeviceStatusType.WARNING;
    }
    if (consumption > limitOfPowerOnFailureWatts) {
      return DeviceStatusType.FAILURE;
    }
  }

  // Fallback
  return DeviceStatusType.MAINTENANCE;
}

/**
 * @deprecated Use calculateDeviceStatus() with ranges parameter instead.
 *
 * RFC-0077: Calculates device status based on connection status and consumption ranges
 * This function uses range-based thresholds instead of single limit values.
 *
 * NOTE: This is now a wrapper around calculateDeviceStatus() for backward compatibility.
 *
 * @param {Object} params - Configuration object
 * @param {string} params.connectionStatus - Connection status: "waiting", "offline", or "online"
 * @param {number|null} params.lastConsumptionValue - Last power consumption value in watts
 * @param {Object} params.ranges - Consumption ranges object
 * @param {number|null} [params.telemetryTimestamp] - RFC-0110: Timestamp of telemetry
 * @param {number|null} [params.lastActivityTime] - RFC-0110: Fallback timestamp
 * @param {number} [params.delayTimeConnectionInMins=1440] - RFC-0110: Stale threshold (default 24h)
 * @returns {string} Device status from DeviceStatusType enum
 */
export function calculateDeviceStatusWithRanges({
  connectionStatus,
  lastConsumptionValue,
  ranges,
  // RFC-0110: New parameters
  telemetryTimestamp = null,
  lastActivityTime = null,
  delayTimeConnectionInMins = 1440,
  // @deprecated - kept for backward compatibility
  lastConnectTime = null,
  lastDisconnectTime = null,
}) {
  // Delegate to unified calculateDeviceStatus function
  return calculateDeviceStatus({
    connectionStatus,
    domain: 'energy',
    telemetryValue: lastConsumptionValue,
    telemetryTimestamp: telemetryTimestamp || lastConnectTime || lastDisconnectTime,
    lastActivityTime,
    ranges,
    delayTimeConnectionInMins,
  });
}
