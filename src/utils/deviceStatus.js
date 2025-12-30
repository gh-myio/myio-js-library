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
 * RFC-0110: Verifica se a conexão está obsoleta baseado em timestamps
 * Usado para determinar se um device realmente está offline, mesmo que
 * connectionStatus indique online (timestamp muito antigo).
 *
 * @param {Object} params
 * @param {number|Date|null} params.lastConnectTime - Timestamp da última conexão
 * @param {number|Date|null} params.lastDisconnectTime - Timestamp da última desconexão
 * @param {number} [params.delayTimeConnectionInMins=60] - Tempo em minutos para considerar conexão obsoleta
 * @returns {boolean} true se conexão está obsoleta (deve ser considerado offline)
 *
 * @example
 * // Device com conexão antiga (> 60 min) → offline
 * isConnectionStale({
 *   lastConnectTime: Date.now() - 90 * 60 * 1000, // 90 min atrás
 *   delayTimeConnectionInMins: 60
 * }); // Returns true
 *
 * @example
 * // Device com conexão recente → online
 * isConnectionStale({
 *   lastConnectTime: Date.now() - 30 * 60 * 1000, // 30 min atrás
 *   delayTimeConnectionInMins: 60
 * }); // Returns false
 *
 * @example
 * // Device que desconectou depois de conectar → offline
 * isConnectionStale({
 *   lastConnectTime: Date.now() - 10 * 60 * 1000, // 10 min atrás
 *   lastDisconnectTime: Date.now() - 5 * 60 * 1000, // 5 min atrás (mais recente)
 * }); // Returns true
 */
export function isConnectionStale({
  lastConnectTime = null,
  lastDisconnectTime = null,
  delayTimeConnectionInMins = 60,
} = {}) {
  // Se não há timestamp de conexão, não podemos verificar - assume online
  if (!lastConnectTime) {
    return false;
  }

  const lastConnect = new Date(lastConnectTime);
  const lastDisconnect = lastDisconnectTime ? new Date(lastDisconnectTime) : null;
  const now = new Date();
  const delayMs = delayTimeConnectionInMins * 60 * 1000;

  // RFC-0110: Determinar o timestamp mais recente de atividade
  // Se desconectou depois de conectar, usar lastDisconnectTime como referência
  // Se conectou depois de desconectar (ou nunca desconectou), usar lastConnectTime
  let mostRecentActivity = lastConnect;
  if (lastDisconnect && lastDisconnect.getTime() > lastConnect.getTime()) {
    mostRecentActivity = lastDisconnect;
  }

  // RFC-0110: Verificar se a atividade mais recente está dentro do delay
  const timeSinceActivity = now.getTime() - mostRecentActivity.getTime();
  if (timeSinceActivity > delayMs) {
    // Última atividade foi há mais de [delay] minutos → stale/offline
    return true;
  }

  // Atividade recente (dentro do delay) → não é stale
  return false;
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
 * Calculates device status based on connection status and power consumption
 *
 * @param {Object} params - Configuration object
 * @param {string} params.connectionStatus - Connection status: "waiting", "offline", or "online"
 * @param {number|null} params.lastConsumptionValue - Last power consumption value in watts
 * @param {number} params.limitOfPowerOnStandByWatts - Upper limit for standby mode in watts
 * @param {number} params.limitOfPowerOnAlertWatts - Upper limit for warning mode in watts
 * @param {number} params.limitOfPowerOnFailureWatts - Upper limit for failure mode in watts
 * @returns {string} Device status from DeviceStatusType enum
 *
 * @example
 * // Device is waiting for installation
 * calculateDeviceStatus({
 *   connectionStatus: "waiting",
 *   lastConsumptionValue: null,
 *   limitOfPowerOnStandByWatts: 100,
 *   limitOfPowerOnAlertWatts: 1000,
 *   limitOfPowerOnFailureWatts: 2000
 * }); // Returns "not_installed"
 *
 * @example
 * // Device is offline
 * calculateDeviceStatus({
 *   connectionStatus: "offline",
 *   lastConsumptionValue: null,
 *   limitOfPowerOnStandByWatts: 100,
 *   limitOfPowerOnAlertWatts: 1000,
 *   limitOfPowerOnFailureWatts: 2000
 * }); // Returns "no_info"
 *
 * @example
 * // Device is online but no consumption data
 * calculateDeviceStatus({
 *   connectionStatus: "online",
 *   lastConsumptionValue: null,
 *   limitOfPowerOnStandByWatts: 100,
 *   limitOfPowerOnAlertWatts: 1000,
 *   limitOfPowerOnFailureWatts: 2000
 * }); // Returns "power_on"
 *
 * @example
 * // Device in standby mode
 * calculateDeviceStatus({
 *   connectionStatus: "online",
 *   lastConsumptionValue: 50,
 *   limitOfPowerOnStandByWatts: 100,
 *   limitOfPowerOnAlertWatts: 1000,
 *   limitOfPowerOnFailureWatts: 2000
 * }); // Returns "standby"
 *
 * @example
 * // Device with normal operation (power_on)
 * calculateDeviceStatus({
 *   connectionStatus: "online",
 *   lastConsumptionValue: 500,
 *   limitOfPowerOnStandByWatts: 100,
 *   limitOfPowerOnAlertWatts: 1000,
 *   limitOfPowerOnFailureWatts: 2000
 * }); // Returns "power_on"
 *
 * @example
 * // Device with warning consumption
 * calculateDeviceStatus({
 *   connectionStatus: "online",
 *   lastConsumptionValue: 1500,
 *   limitOfPowerOnStandByWatts: 100,
 *   limitOfPowerOnAlertWatts: 1000,
 *   limitOfPowerOnFailureWatts: 2000
 * }); // Returns "warning"
 *
 * @example
 * // Device with failure consumption
 * calculateDeviceStatus({
 *   connectionStatus: "online",
 *   lastConsumptionValue: 2500,
 *   limitOfPowerOnStandByWatts: 100,
 *   limitOfPowerOnAlertWatts: 1000,
 *   limitOfPowerOnFailureWatts: 2000
 * }); // Returns "failure"
 */
export function calculateDeviceStatus({
  connectionStatus,
  lastConsumptionValue,
  limitOfPowerOnStandByWatts,
  limitOfPowerOnAlertWatts,
  limitOfPowerOnFailureWatts,
  // RFC-0110: Optional timestamp parameters for stale connection detection
  lastConnectTime = null,
  lastDisconnectTime = null,
  delayTimeConnectionInMins = 60,
}) {
  // RFC-0109: Normalize connectionStatus first
  const normalizedStatus = normalizeConnectionStatus(connectionStatus);

  // If waiting for installation
  if (normalizedStatus === "waiting") {
    return DeviceStatusType.NOT_INSTALLED;
  }

  // RFC-0109: If bad/weak connection
  if (normalizedStatus === "bad") {
    return DeviceStatusType.WEAK_CONNECTION;
  }

  // RFC-0110: Check if connection is stale (timestamp too old)
  const connectionStale = isConnectionStale({
    lastConnectTime,
    lastDisconnectTime,
    delayTimeConnectionInMins,
  });

  // RFC-0110: Device is truly offline only if connectionStatus says "offline" AND timestamp is stale
  if (normalizedStatus === "offline") {
    if (connectionStale) {
      // Stale timestamp - truly offline
      return DeviceStatusType.OFFLINE;
    }
    // Fresh timestamp - device recently connected, continue to consumption-based calculation
    // (treat as effectively online)
  }

  // RFC-0110: If "online" but timestamp is stale → offline
  if (connectionStale && normalizedStatus === "online") {
    return DeviceStatusType.OFFLINE;
  }

  // Device is effectively online (either connectionStatus=online, or offline with fresh timestamp)
  // If no consumption data
  if (lastConsumptionValue === null || lastConsumptionValue === undefined) {
    return DeviceStatusType.POWER_ON;
  }

  // With consumption data
  if (lastConsumptionValue !== null && lastConsumptionValue !== undefined) {
    const consumption = Number(lastConsumptionValue);

    // Check if consumption is valid
    if (isNaN(consumption)) {
      return DeviceStatusType.MAINTENANCE;
    }

    // Standby: 0 <= consumption <= limitOfPowerOnStandByWatts
    if (consumption >= 0 && consumption <= limitOfPowerOnStandByWatts) {
      return DeviceStatusType.STANDBY;
    }

    // Power On (Normal): consumption > limitOfPowerOnStandByWatts && consumption <= limitOfPowerOnAlertWatts
    if (consumption > limitOfPowerOnStandByWatts && consumption <= limitOfPowerOnAlertWatts) {
      return DeviceStatusType.POWER_ON;
    }

    // Warning: consumption > limitOfPowerOnAlertWatts && consumption <= limitOfPowerOnFailureWatts
    if (consumption > limitOfPowerOnAlertWatts && consumption <= limitOfPowerOnFailureWatts) {
      return DeviceStatusType.WARNING;
    }

    // Failure: consumption > limitOfPowerOnFailureWatts
    if (consumption > limitOfPowerOnFailureWatts) {
      return DeviceStatusType.FAILURE;
    }
  }

  // Fallback
  return DeviceStatusType.MAINTENANCE;
}

/**
 * RFC-0077: Calculates device status based on connection status and consumption ranges
 * This function uses range-based thresholds instead of single limit values
 *
 * @param {Object} params - Configuration object
 * @param {string} params.connectionStatus - Connection status: "waiting", "offline", or "online"
 * @param {number|null} params.lastConsumptionValue - Last power consumption value in watts
 * @param {Object} params.ranges - Consumption ranges object with standbyRange, normalRange, alertRange, failureRange
 * @param {Object} params.ranges.standbyRange - Standby range: { down: number, up: number }
 * @param {Object} params.ranges.normalRange - Normal range: { down: number, up: number }
 * @param {Object} params.ranges.alertRange - Alert range: { down: number, up: number }
 * @param {Object} params.ranges.failureRange - Failure range: { down: number, up: number }
 * @param {string} [params.ranges.source] - Optional source indicator: "device", "customer", or "hardcoded"
 * @param {number} [params.ranges.tier] - Optional tier number: 1 (device), 2 (customer), or 3 (hardcoded)
 * @returns {string} Device status from DeviceStatusType enum
 *
 * @example
 * // Device is waiting for installation
 * calculateDeviceStatusWithRanges({
 *   connectionStatus: "waiting",
 *   lastConsumptionValue: null,
 *   ranges: {
 *     standbyRange: { down: 0, up: 150 },
 *     normalRange: { down: 150, up: 800 },
 *     alertRange: { down: 800, up: 1200 },
 *     failureRange: { down: 1200, up: 99999 }
 *   }
 * }); // Returns "not_installed"
 *
 * @example
 * // Device in standby mode
 * calculateDeviceStatusWithRanges({
 *   connectionStatus: "online",
 *   lastConsumptionValue: 50,
 *   ranges: {
 *     standbyRange: { down: 0, up: 150 },
 *     normalRange: { down: 150, up: 800 },
 *     alertRange: { down: 800, up: 1200 },
 *     failureRange: { down: 1200, up: 99999 }
 *   }
 * }); // Returns "standby"
 *
 * @example
 * // Device with normal operation (power_on)
 * calculateDeviceStatusWithRanges({
 *   connectionStatus: "online",
 *   lastConsumptionValue: 500,
 *   ranges: {
 *     standbyRange: { down: 0, up: 150 },
 *     normalRange: { down: 150, up: 800 },
 *     alertRange: { down: 800, up: 1200 },
 *     failureRange: { down: 1200, up: 99999 }
 *   }
 * }); // Returns "power_on"
 *
 * @example
 * // Device with warning consumption
 * calculateDeviceStatusWithRanges({
 *   connectionStatus: "online",
 *   lastConsumptionValue: 1000,
 *   ranges: {
 *     standbyRange: { down: 0, up: 150 },
 *     normalRange: { down: 150, up: 800 },
 *     alertRange: { down: 800, up: 1200 },
 *     failureRange: { down: 1200, up: 99999 }
 *   }
 * }); // Returns "warning"
 *
 * @example
 * // Device with failure consumption
 * calculateDeviceStatusWithRanges({
 *   connectionStatus: "online",
 *   lastConsumptionValue: 2500,
 *   ranges: {
 *     standbyRange: { down: 0, up: 150 },
 *     normalRange: { down: 150, up: 800 },
 *     alertRange: { down: 800, up: 1200 },
 *     failureRange: { down: 1200, up: 99999 },
 *     source: "device",
 *     tier: 1
 *   }
 * }); // Returns "failure"
 */
export function calculateDeviceStatusWithRanges({
  connectionStatus,
  lastConsumptionValue,
  ranges,
  // RFC-0110: Optional timestamp parameters for stale connection detection
  lastConnectTime = null,
  lastDisconnectTime = null,
  delayTimeConnectionInMins = 60,
}) {
  // RFC-0109: Normalize connectionStatus first
  const normalizedStatus = normalizeConnectionStatus(connectionStatus);

  // If waiting for installation
  if (normalizedStatus === "waiting") {
    return DeviceStatusType.NOT_INSTALLED;
  }

  // RFC-0109: If bad/weak connection
  if (normalizedStatus === "bad") {
    return DeviceStatusType.WEAK_CONNECTION;
  }

  // RFC-0110: Check if connection is stale (timestamp too old)
  const connectionStale = isConnectionStale({
    lastConnectTime,
    lastDisconnectTime,
    delayTimeConnectionInMins,
  });

  // RFC-0110: Device is truly offline only if connectionStatus says "offline" AND timestamp is stale
  if (normalizedStatus === "offline") {
    if (connectionStale) {
      // Stale timestamp - truly offline
      return DeviceStatusType.OFFLINE;
    }
    // Fresh timestamp - device recently connected, continue to consumption-based calculation
    // (treat as effectively online)
  }

  // RFC-0110: If "online" but timestamp is stale → offline
  if (connectionStale && normalizedStatus === "online") {
    return DeviceStatusType.OFFLINE;
  }

  // Device is effectively online (either connectionStatus=online, or offline with fresh timestamp)
  // If no consumption data
  if (lastConsumptionValue === null || lastConsumptionValue === undefined) {
    return DeviceStatusType.POWER_ON;
  }

  // Validate ranges object - if no ranges, return POWER_ON for online devices
  if (!ranges || !ranges.standbyRange || !ranges.normalRange || !ranges.alertRange || !ranges.failureRange) {
    return DeviceStatusType.POWER_ON;
  }

  // With consumption data
  if (lastConsumptionValue !== null && lastConsumptionValue !== undefined) {
    const consumption = Number(lastConsumptionValue);

    // Check if consumption is valid
    if (isNaN(consumption)) {
      return DeviceStatusType.MAINTENANCE;
    }

    // Extract ranges
    const { standbyRange, normalRange, alertRange, failureRange } = ranges;

    // Standby: consumption is within standbyRange
    if (consumption >= standbyRange.down && consumption <= standbyRange.up) {
      return DeviceStatusType.STANDBY;
    }

    // Power On (Normal): consumption is within normalRange
    if (consumption >= normalRange.down && consumption <= normalRange.up) {
      return DeviceStatusType.POWER_ON;
    }

    // Warning: consumption is within alertRange
    if (consumption >= alertRange.down && consumption <= alertRange.up) {
      return DeviceStatusType.WARNING;
    }

    // Failure: consumption is within failureRange
    if (consumption >= failureRange.down && consumption <= failureRange.up) {
      return DeviceStatusType.FAILURE;
    }

    // If consumption doesn't fit any range, check if it's above failure range
    if (consumption > failureRange.up) {
      return DeviceStatusType.FAILURE;
    }

    // If consumption is below standby range (negative or unexpected)
    if (consumption < standbyRange.down) {
      return DeviceStatusType.MAINTENANCE;
    }
  }

  // Fallback
  return DeviceStatusType.MAINTENANCE;
}
