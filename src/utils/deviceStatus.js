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
  // RFC-0110 v3: Treat timestamp 0 or negative as invalid
  const timestamp = (telemetryTimestamp && telemetryTimestamp > 0) ? telemetryTimestamp :
                    (lastActivityTime && lastActivityTime > 0) ? lastActivityTime : null;

  // No valid timestamp available = assume not stale (conservative approach)
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
 * RFC-0110 v5: Unified device status calculation based on telemetry timestamps with fallback.
 *
 * This function determines device status using:
 * 1. connectionStatus for immediate states (waiting)
 * 2. telemetryTimestamp (domain-specific) or lastActivityTime as fallback
 * 3. Dual threshold for stale/offline detection
 * 4. telemetryValue for operational status (standby, power_on, warning, failure)
 *
 * MASTER RULES (RFC-0110 v5):
 * - WAITING → NOT_INSTALLED (absolute, no discussion)
 * - BAD + recent telemetry (< 60 mins) → POWER_ON, else WEAK_CONNECTION
 * - OFFLINE + recent telemetry (< 60 mins) → POWER_ON, else OFFLINE
 * - ONLINE + no effective timestamp → OFFLINE
 * - ONLINE + stale (> 24h) → OFFLINE
 * - ONLINE + fresh (< 24h) → continue to value-based calculation
 *
 * Timestamp priority:
 * 1. telemetryTimestamp (domain-specific: consumptionTs, pulsesTs, etc.)
 * 2. lastActivityTime (fallback when no domain telemetry)
 *
 * @param {Object} params - Configuration object
 * @param {string} params.connectionStatus - Connection status: "waiting", "offline", "bad", or "online"
 * @param {string} [params.domain='energy'] - Device domain: 'energy', 'water', or 'temperature'
 * @param {number|null} [params.telemetryValue] - Telemetry value (consumption/pulses/temperature)
 * @param {number|null} [params.telemetryTimestamp] - Unix timestamp (ms) of domain-specific telemetry
 * @param {number|null} [params.lastActivityTime] - Fallback timestamp when no domain telemetry
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
 * // RFC-0110 v5: With domain telemetry
 * calculateDeviceStatus({
 *   connectionStatus: "online",
 *   domain: "energy",
 *   telemetryValue: 500,
 *   telemetryTimestamp: consumptionTs, // Primary: domain-specific timestamp
 *   lastActivityTime: lastActivityTime, // Fallback if consumptionTs is null
 *   ranges: { ... },
 *   delayTimeConnectionInMins: 1440
 * }); // Returns "power_on" if fresh telemetry, "offline" if stale/missing
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

  // 2. RFC-0110 v5: Calculate timestamps for status detection
  // Timestamp must exist AND be valid (> 0, since 0 = epoch 1970 = invalid)
  const hasTelemetryTs = telemetryTimestamp !== null && telemetryTimestamp !== undefined && telemetryTimestamp > 0;
  const hasLastActivityTime = lastActivityTime !== null && lastActivityTime !== undefined && lastActivityTime > 0;

  // RFC-0110 v5 FIX: For BAD/OFFLINE recovery, use lastActivityTime as fallback
  // For ONLINE → OFFLINE stale detection, use ONLY telemetryTimestamp (no fallback)
  const effectiveTimestampForRecovery = hasTelemetryTs ? telemetryTimestamp : (hasLastActivityTime ? lastActivityTime : null);
  const hasEffectiveTimestampForRecovery = effectiveTimestampForRecovery !== null;

  // 3. RFC-0110 v5: If no effective timestamp at all → OFFLINE (for ONLINE status)
  // For BAD/OFFLINE, we check below with short threshold

  // 4. BAD → Check telemetry (60 mins threshold)
  // If recent telemetry, treat as online (hide weak_connection from client)
  // If stale telemetry or no timestamp, show WEAK_CONNECTION
  if (normalizedStatus === "bad") {
    const hasRecentTelemetry = hasEffectiveTimestampForRecovery && !isTelemetryStale(effectiveTimestampForRecovery, null, shortDelayMins);
    if (hasRecentTelemetry) {
      // Device is working fine, continue to value-based calculation
    } else {
      return DeviceStatusType.WEAK_CONNECTION;
    }
  }

  // 5. OFFLINE → Check telemetry (60 mins threshold)
  // If recent telemetry (< 60 mins), treat as online
  // If stale telemetry (> 60 mins) or no timestamp, mark as OFFLINE
  if (normalizedStatus === "offline") {
    const hasRecentTelemetry = hasEffectiveTimestampForRecovery && !isTelemetryStale(effectiveTimestampForRecovery, null, shortDelayMins);
    if (!hasRecentTelemetry) {
      return DeviceStatusType.OFFLINE;
    }
    // Has recent telemetry - continue to value-based calculation
  }

  // 6. ONLINE → Check telemetry (24h threshold)
  // RFC-0110 v5 FIX: Use ONLY telemetryTimestamp for ONLINE → OFFLINE stale detection
  // lastActivityTime is updated by keepalive/heartbeat, not actual domain telemetry
  // So a device can have recent lastActivityTime but stale/missing domain-specific telemetry
  if (normalizedStatus === "online") {
    // No domain-specific telemetry timestamp = device is not sending actual data = OFFLINE
    if (!hasTelemetryTs) {
      return DeviceStatusType.OFFLINE;
    }
    // Has telemetry timestamp but it's stale (> 24h) = OFFLINE
    const telemetryStale = isTelemetryStale(telemetryTimestamp, null, delayTimeConnectionInMins);
    if (telemetryStale) {
      return DeviceStatusType.OFFLINE;
    }
  }

  // 7. Device is effectively online - calculate status from telemetry value
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
