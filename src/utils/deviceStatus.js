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
};

/**
 * Connection status types enum
 * @enum {string}
 */
export const ConnectionStatusType = {
  CONNECTED: "connected",
  OFFLINE: "offline"
};

/**
 * Device status icons mapping
 * @type {Object.<string, string>}
 */
export const deviceStatusIcons = {
  [DeviceStatusType.POWER_ON]: "⚡",
  [DeviceStatusType.STANDBY]: "🔌",
  [DeviceStatusType.POWER_OFF]: "🔴",
  [DeviceStatusType.WARNING]: "⚠️",
  [DeviceStatusType.FAILURE]: "🚨",
  [DeviceStatusType.MAINTENANCE]: "🛠️",
  [DeviceStatusType.NO_INFO]: "❓️",
  [DeviceStatusType.NOT_INSTALLED]: "📦",
};

/**
 * Water device status icons mapping (for TANK/CAIXA_DAGUA)
 * @type {Object.<string, string>}
 */
export const waterDeviceStatusIcons = {
  [DeviceStatusType.POWER_ON]: "💧",
  [DeviceStatusType.STANDBY]: "🚰",
  [DeviceStatusType.POWER_OFF]: "🔴",
  [DeviceStatusType.WARNING]: "⚠️",
  [DeviceStatusType.FAILURE]: "🚨",
  [DeviceStatusType.MAINTENANCE]: "🛠️",
  [DeviceStatusType.NO_INFO]: "❓️",
  [DeviceStatusType.NOT_INSTALLED]: "📦",
};

/**
 * Connection status icons mapping
 * @type {Object.<string, string>}
 */
export const connectionStatusIcons = {
  [ConnectionStatusType.CONNECTED]: "🟢",
  [ConnectionStatusType.OFFLINE]: "🚫"
};

/**
 * Maps device status to connection status
 * If device status is NO_INFO, the device is considered offline
 * Otherwise, it's connected
 *
 * @param {string} deviceStatus - The device status
 * @returns {string} The connection status (connected or offline)
 */
export function mapDeviceToConnectionStatus(deviceStatus) {
  if (deviceStatus === DeviceStatusType.NO_INFO) {
    return ConnectionStatusType.OFFLINE;
  }
  return ConnectionStatusType.CONNECTED;
}

/**
 * Maps device status to a simplified card status
 * Used for styling and visual representation
 *
 * @param {string} deviceStatus - The device status
 * @returns {string} Simplified status: 'ok', 'alert', 'fail', or 'unknown'
 */
export function mapDeviceStatusToCardStatus(deviceStatus) {
  const statusMap = {
    [DeviceStatusType.POWER_ON]: 'ok',
    [DeviceStatusType.STANDBY]: 'alert',
    [DeviceStatusType.POWER_OFF]: 'fail',
    [DeviceStatusType.WARNING]: 'alert',
    [DeviceStatusType.FAILURE]: 'fail',
    [DeviceStatusType.MAINTENANCE]: 'alert',
    [DeviceStatusType.NO_INFO]: 'unknown'
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
    deviceStatus === DeviceStatusType.MAINTENANCE
  );
}

/**
 * Checks if device is offline based on device status
 *
 * @param {string} deviceStatus - The device status
 * @returns {boolean} True if device is offline
 */
export function isDeviceOffline(deviceStatus) {
  return deviceStatus === DeviceStatusType.NO_INFO;
}

/**
 * Gets the appropriate icon for a device status
 *
 * @param {string} deviceStatus - The device status
 * @param {string} deviceType - The device type (optional, for water devices like TANK/CAIXA_DAGUA)
 * @returns {string} The icon emoji/character
 */
export function getDeviceStatusIcon(deviceStatus, deviceType = null) {
  // Use water icons for TANK/CAIXA_DAGUA devices
  const isWaterDevice = deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA';
  const iconMap = isWaterDevice ? waterDeviceStatusIcons : deviceStatusIcons;

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
  limitOfPowerOnFailureWatts
}) {
  // Validate connectionStatus
  const validConnectionStatuses = ["waiting", "offline", "online"];
  if (!validConnectionStatuses.includes(connectionStatus)) {
    return DeviceStatusType.MAINTENANCE;
  }

  // If waiting for installation
  if (connectionStatus === "waiting") {
    return DeviceStatusType.NOT_INSTALLED;
  }

  // If offline
  if (connectionStatus === "offline") {
    return DeviceStatusType.NO_INFO;
  }

  // If online but no consumption data
  if (connectionStatus === "online" && (lastConsumptionValue === null || lastConsumptionValue === undefined)) {
    return DeviceStatusType.POWER_ON;
  }

  // If online with consumption data
  if (connectionStatus === "online" && lastConsumptionValue !== null && lastConsumptionValue !== undefined) {
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
  ranges
}) {
  // Validate connectionStatus
  const validConnectionStatuses = ["waiting", "offline", "online"];
  if (!validConnectionStatuses.includes(connectionStatus)) {
    return DeviceStatusType.MAINTENANCE;
  }

  // If waiting for installation
  if (connectionStatus === "waiting") {
    return DeviceStatusType.NOT_INSTALLED;
  }

  // If offline
  if (connectionStatus === "offline") {
    return DeviceStatusType.NO_INFO;
  }

  // If online but no consumption data
  if (connectionStatus === "online" && (lastConsumptionValue === null || lastConsumptionValue === undefined)) {
    return DeviceStatusType.POWER_ON;
  }

  // Validate ranges object
  if (!ranges || !ranges.standbyRange || !ranges.normalRange || !ranges.alertRange || !ranges.failureRange) {
    console.error('[RFC-0077] Invalid ranges object:', ranges);
    return DeviceStatusType.MAINTENANCE;
  }

  // If online with consumption data
  if (connectionStatus === "online" && lastConsumptionValue !== null && lastConsumptionValue !== undefined) {
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
