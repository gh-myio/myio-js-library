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
 * @returns {string} The icon emoji/character
 */
export function getDeviceStatusIcon(deviceStatus) {
  return deviceStatusIcons[deviceStatus] || deviceStatusIcons[DeviceStatusType.POWER_ON];
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
