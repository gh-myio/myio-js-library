/* global self, ctx, window, document, localStorage, MyIOLibrary */

// ============================================
// MYIO SHARED UTILITIES (exposed globally)
// ============================================

// Debug configuration - can be toggled at runtime via window.MyIOUtils.setDebug(true/false)
let DEBUG_ACTIVE = true;

// LogHelper utility - shared across all widgets
const LogHelper = {
  log: function (...args) {
    if (DEBUG_ACTIVE) {
      console.log(...args);
    }
  },
  warn: function (...args) {
    if (DEBUG_ACTIVE) {
      console.warn(...args);
    }
  },
  error: function (...args) {
    // Errors always logged regardless of DEBUG_ACTIVE
    console.error(...args);
  },
};

// RFC-0086: Get DATA_API_HOST from localStorage (set by WELCOME widget)
function getDataApiHost() {
  return localStorage.getItem('__MYIO_DATA_API_HOST__') || 'https://api.data.apps.myio-bas.com';
}

// Format energy value using MyIOLibrary or fallback
function formatEnergy(value) {
  if (typeof MyIOLibrary?.formatEnergy === 'function') {
    return MyIOLibrary.formatEnergy(value);
  }
  // Fallback formatting
  const num = Number(value) || 0;
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)} GWh`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)} MWh`;
  return `${num.toFixed(2)} kWh`;
}

// Format water value using MyIOLibrary or fallback
function formatWater(value) {
  if (typeof MyIOLibrary?.formatWater === 'function') {
    return MyIOLibrary.formatWater(value);
  }
  const num = Number(value) || 0;
  return `${num.toFixed(2)} m³`;
}

/**
 * Maps raw connection status to normalized status
 * @param {string} rawStatus - Raw status from ThingsBoard (e.g., 'ONLINE', 'ok', 'running', 'waiting', 'offline')
 * @returns {'online' | 'waiting' | 'offline'} - Normalized status
 */
function mapConnectionStatus(rawStatus) {
  const statusLower = String(rawStatus || '').toLowerCase().trim();

  // Online states
  if (statusLower === 'online' || statusLower === 'ok' || statusLower === 'running') {
    return 'online';
  }

  // Waiting/transitional states
  if (statusLower === 'waiting' || statusLower === 'connecting' || statusLower === 'pending') {
    return 'waiting';
  }

  // Default to offline
  return 'offline';
}

/**
 * Converte um timestamp em uma string de tempo relativo (ex: "há 5 minutos").
 * @param {number} timestamp - O timestamp em milissegundos.
 * @returns {string} A string formatada.
 */
function formatRelativeTime(timestamp) {
  if (!timestamp || timestamp <= 0) {
    return '—';
  }

  const now = Date.now();
  const diffSeconds = Math.round((now - timestamp) / 1000);

  if (diffSeconds < 10) {
    return 'agora';
  }
  if (diffSeconds < 60) {
    return `há ${diffSeconds}s`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes === 1) {
    return 'há 1 min';
  }
  if (diffMinutes < 60) {
    return `há ${diffMinutes} mins`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours === 1) {
    return 'há 1 hora';
  }
  if (diffHours < 24) {
    return `há ${diffHours} horas`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) {
    return 'ontem';
  }
  if (diffDays <= 30) {
    return `há ${diffDays} dias`;
  }

  return new Date(timestamp).toLocaleDateString('pt-BR');
}

/**
 * Formata duração em milissegundos para string legível (ex: "2d 5h", "3h 20m", "45s")
 * @param {number} ms - Duração em milissegundos
 * @returns {string} Duração formatada
 */
function formatarDuracao(ms) {
  if (typeof ms !== 'number' || ms < 0 || !isFinite(ms)) {
    return '0s';
  }
  if (ms === 0) {
    return '0s';
  }

  const segundos = Math.floor((ms / 1000) % 60);
  const minutos = Math.floor((ms / (1000 * 60)) % 60);
  const horas = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (dias > 0) {
    parts.push(`${dias}d`);
    if (horas > 0) {
      parts.push(`${horas}h`);
    }
  } else if (horas > 0) {
    parts.push(`${horas}h`);
    if (minutos > 0) {
      parts.push(`${minutos}m`);
    }
  } else if (minutos > 0) {
    parts.push(`${minutos}m`);
    if (segundos > 0) {
      parts.push(`${segundos}s`);
    }
  } else {
    parts.push(`${segundos}s`);
  }

  return parts.length > 0 ? parts.join(' ') : '0s';
}

/**
 * Shows/hides loading overlay for equipments widget
 * @param {boolean} show - Whether to show or hide the overlay
 */
function showLoadingOverlay(show) {
  const overlay = document.getElementById('equipments-loading-overlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

// ============================================
// RFC-0071: DEVICE PROFILE SYNCHRONIZATION
// ============================================

/**
 * Fetches all active device profiles from ThingsBoard
 * @returns {Promise<Map<string, string>>} Map of profileId -> profileName
 */
async function fetchDeviceProfiles() {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('[RFC-0071] JWT token not found');

  const url = '/api/deviceProfile/names?activeOnly=true';

  LogHelper.log('[MAIN] [RFC-0071] Fetching device profiles...');

  const response = await fetch(url, {
    headers: {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`[RFC-0071] Failed to fetch device profiles: ${response.status}`);
  }

  const profiles = await response.json();

  const profileMap = new Map();
  profiles.forEach((profile) => {
    const profileId = profile.id.id;
    const profileName = profile.name;
    profileMap.set(profileId, profileName);
  });

  LogHelper.log(
    `[MAIN] [RFC-0071] Loaded ${profileMap.size} device profiles:`,
    Array.from(profileMap.entries())
      .map(([id, name]) => name)
      .join(', ')
  );

  return profileMap;
}

/**
 * Fetches device details including deviceProfileId
 * @param {string} deviceId - Device entity ID
 * @returns {Promise<Object>}
 */
async function fetchDeviceDetails(deviceId) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('[RFC-0071] JWT token not found');

  const url = `/api/device/${deviceId}`;

  const response = await fetch(url, {
    headers: {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`[RFC-0071] Failed to fetch device ${deviceId}: ${response.status}`);
  }

  return await response.json();
}

/**
 * Saves deviceProfile as a server-scope attribute on the device
 * @param {string} deviceId - Device entity ID
 * @param {string} deviceProfile - Profile name (e.g., "MOTOR", "3F_MEDIDOR")
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function addDeviceProfileAttribute(deviceId, deviceProfile) {
  const t = Date.now();

  try {
    if (!deviceId) throw new Error('deviceId is required');
    if (deviceProfile == null || deviceProfile === '') {
      throw new Error('deviceProfile is required');
    }

    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error('jwt_token not found in localStorage');

    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token}`,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ deviceProfile }),
    });

    const bodyText = await res.text().catch(() => '');

    if (!res.ok) {
      throw new Error(`[RFC-0071] HTTP ${res.status} ${res.statusText} - ${bodyText}`);
    }

    let data = null;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      // Response may not be JSON
    }

    const dt = Date.now() - t;
    LogHelper.log(
      `[MAIN] [RFC-0071] ✅ Saved deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms`
    );

    return { ok: true, status: res.status, data };
  } catch (err) {
    const dt = Date.now() - t;
    LogHelper.error(
      `[MAIN] [RFC-0071] ❌ Failed to save deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms | error: ${
        err?.message || err
      }`
    );
    throw err;
  }
}

/**
 * Main synchronization function - syncs missing deviceProfile attributes
 * NOTE: Requires ctx.data to be available (call from widget context)
 * @param {Array} ctxData - The ctx.data array from widget context
 * @returns {Promise<{synced: number, skipped: number, errors: number}>}
 */
async function syncDeviceProfileAttributes(ctxData) {
  LogHelper.log('[MAIN] [RFC-0071] 🔄 Starting device profile synchronization...');

  try {
    const profileMap = await fetchDeviceProfiles();

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    const deviceMap = new Map();

    ctxData.forEach((data) => {
      const entityId = data.datasource?.entity?.id?.id;
      const existingProfile = data.datasource?.deviceProfile;

      if (!entityId) return;

      if (existingProfile) {
        skipped++;
        return;
      }

      if (!deviceMap.has(entityId)) {
        deviceMap.set(entityId, {
          entityLabel: data.datasource?.entityLabel,
          entityName: data.datasource?.entityName,
          name: data.datasource?.name,
        });
      }
    });

    LogHelper.log(`[MAIN] [RFC-0071] Found ${deviceMap.size} devices without deviceProfile attribute`);
    LogHelper.log(`[MAIN] [RFC-0071] Skipped ${skipped} devices that already have deviceProfile`);

    if (deviceMap.size === 0) {
      LogHelper.log('[MAIN] [RFC-0071] ✅ All devices already synchronized!');
      return { synced: 0, skipped, errors: 0 };
    }

    let processed = 0;
    for (const [entityId, deviceInfo] of deviceMap) {
      processed++;
      const deviceLabel = deviceInfo.entityLabel || deviceInfo.entityName || deviceInfo.name || entityId;

      try {
        LogHelper.log(`[MAIN] [RFC-0071] Processing ${processed}/${deviceMap.size}: ${deviceLabel}`);

        const deviceDetails = await fetchDeviceDetails(entityId);
        const deviceProfileId = deviceDetails.deviceProfileId?.id;

        if (!deviceProfileId) {
          LogHelper.warn(`[MAIN] [RFC-0071] ⚠️ Device ${deviceLabel} has no deviceProfileId`);
          errors++;
          continue;
        }

        const profileName = profileMap.get(deviceProfileId);

        if (!profileName) {
          LogHelper.warn(`[MAIN] [RFC-0071] ⚠️ Profile ID ${deviceProfileId} not found in map`);
          errors++;
          continue;
        }

        await addDeviceProfileAttribute(entityId, profileName);
        synced++;

        LogHelper.log(`[MAIN] [RFC-0071] ✅ Synced ${deviceLabel} -> ${profileName}`);

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        LogHelper.error(`[MAIN] [RFC-0071] ❌ Failed to sync device ${deviceLabel}:`, error);
        errors++;
      }
    }

    LogHelper.log(
      `[MAIN] [RFC-0071] 🎉 Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`
    );

    return { synced, skipped, errors };
  } catch (error) {
    LogHelper.error('[MAIN] [RFC-0071] ❌ Fatal error during sync:', error);
    throw error;
  }
}

// ============================================
// RFC-0078: UNIFIED JSON POWER LIMITS CONFIGURATION
// ============================================

/**
 * Default consumption ranges for each device type (TIER 3 - fallback)
 */
const DEFAULT_CONSUMPTION_RANGES = {
  ELEVADOR: {
    standbyRange: { down: 0, up: 150 },
    normalRange: { down: 151, up: 800 },
    alertRange: { down: 801, up: 1200 },
    failureRange: { down: 1201, up: 99999 },
  },
  ESCADA_ROLANTE: {
    standbyRange: { down: 0, up: 200 },
    normalRange: { down: 201, up: 1000 },
    alertRange: { down: 1001, up: 1500 },
    failureRange: { down: 1501, up: 99999 },
  },
  CHILLER: {
    standbyRange: { down: 0, up: 1000 },
    normalRange: { down: 1001, up: 6000 },
    alertRange: { down: 6001, up: 8000 },
    failureRange: { down: 8001, up: 99999 },
  },
  AR_CONDICIONADO: {
    standbyRange: { down: 0, up: 500 },
    normalRange: { down: 501, up: 3000 },
    alertRange: { down: 3001, up: 5000 },
    failureRange: { down: 5001, up: 99999 },
  },
  HVAC: {
    standbyRange: { down: 0, up: 500 },
    normalRange: { down: 501, up: 3000 },
    alertRange: { down: 3001, up: 5000 },
    failureRange: { down: 5001, up: 99999 },
  },
  MOTOR: {
    standbyRange: { down: 0, up: 200 },
    normalRange: { down: 201, up: 1000 },
    alertRange: { down: 1001, up: 1500 },
    failureRange: { down: 1501, up: 99999 },
  },
  BOMBA: {
    standbyRange: { down: 0, up: 200 },
    normalRange: { down: 201, up: 1000 },
    alertRange: { down: 1001, up: 1500 },
    failureRange: { down: 1501, up: 99999 },
  },
  DEFAULT: {
    standbyRange: { down: 0, up: 100 },
    normalRange: { down: 101, up: 1000 },
    alertRange: { down: 1001, up: 2000 },
    failureRange: { down: 2001, up: 99999 },
  },
};

// Cache for JSON power limits configuration
const powerLimitsJSONCache = new Map();
const POWER_LIMITS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * RFC-0078: Fetch unified JSON power limits from ThingsBoard entity
 * @param {string} entityId - Entity ID (device or customer)
 * @param {string} entityType - 'DEVICE' or 'CUSTOMER'
 * @returns {Promise<Object|null>} Parsed JSON configuration or null
 */
async function fetchInstantaneousPowerLimits(entityId, entityType = 'CUSTOMER') {
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    LogHelper.warn('[RFC-0078] JWT token not found');
    return null;
  }

  LogHelper.log('[RFC-0078] entityId', entityId);

  const url = `/api/plugins/telemetry/${entityType}/${entityId}/values/attributes/SERVER_SCOPE`;

  try {
    const response = await fetch(url, {
      headers: {
        'X-Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        LogHelper.log(`[RFC-0078] No attributes found for ${entityType} ${entityId}`);
        return null;
      }
      LogHelper.warn(`[RFC-0078] Failed to fetch ${entityType} attributes: ${response.status}`);
      return null;
    }

    const attributes = await response.json();

    LogHelper.log('[RFC-0078] attributes', attributes);

    const powerLimitsAttr = attributes.find((attr) => attr.key === 'mapInstantaneousPower');

    if (!powerLimitsAttr) {
      return null;
    }

    let limits;
    if (typeof powerLimitsAttr.value === 'string') {
      try {
        limits = JSON.parse(powerLimitsAttr.value);
      } catch (parseError) {
        LogHelper.error(`[RFC-0078] Failed to parse JSON for ${entityType} ${entityId}:`, parseError);
        return null;
      }
    } else {
      limits = powerLimitsAttr.value;
    }

    LogHelper.log(`[RFC-0078] ✅ Loaded mapInstantaneousPower from ${entityType} ${entityId}:`, {
      version: limits.version,
      telemetryTypes: limits.limitsByInstantaneoustPowerType?.length || 0,
    });

    return limits;
  } catch (error) {
    LogHelper.error(`[RFC-0078] Error fetching ${entityType} power limits:`, error);
    return null;
  }
}

/**
 * RFC-0078: Extract consumption ranges from unified JSON structure
 * @param {Object} powerLimitsJSON - The mapInstantaneousPower JSON object
 * @param {string} deviceType - Device type (e.g., 'ELEVADOR')
 * @param {string} telemetryType - Telemetry type (default: 'consumption')
 * @returns {Object|null} Range configuration or null
 */
function extractLimitsFromJSON(powerLimitsJSON, deviceType, telemetryType = 'consumption') {
  if (!powerLimitsJSON || !powerLimitsJSON.limitsByInstantaneoustPowerType) {
    return null;
  }

  const telemetryConfig = powerLimitsJSON.limitsByInstantaneoustPowerType.find(
    (config) => config.telemetryType === telemetryType
  );

  if (!telemetryConfig) {
    LogHelper.log(`[RFC-0078] Telemetry type ${telemetryType} not found in JSON`);
    return null;
  }

  const deviceConfig = telemetryConfig.itemsByDeviceType.find(
    (item) => item.deviceType === deviceType || item.deviceType === deviceType.toUpperCase()
  );

  if (!deviceConfig) {
    LogHelper.log(`[RFC-0078] Device type ${deviceType} not found for telemetry ${telemetryType}`);
    return null;
  }

  const ranges = {
    standbyRange: { down: 0, up: 0 },
    normalRange: { down: 0, up: 0 },
    alertRange: { down: 0, up: 0 },
    failureRange: { down: 0, up: 0 },
  };

  deviceConfig.limitsByDeviceStatus.forEach((status) => {
    const baseValue = status.limitsValues?.baseValue ?? status.limitsVales?.baseValue ?? 0;
    const topValue = status.limitsValues?.topValue ?? status.limitsVales?.topValue ?? 99999;

    switch (status.deviceStatusName) {
      case 'standBy':
        ranges.standbyRange = { down: baseValue, up: topValue };
        break;
      case 'normal':
        ranges.normalRange = { down: baseValue, up: topValue };
        break;
      case 'alert':
        ranges.alertRange = { down: baseValue, up: topValue };
        break;
      case 'failure':
        ranges.failureRange = { down: baseValue, up: topValue };
        break;
    }
  });

  return {
    ...ranges,
    source: 'json',
    tier: 2,
    metadata: {
      name: deviceConfig.name,
      description: deviceConfig.description,
      version: powerLimitsJSON.version,
      telemetryType: telemetryType,
    },
  };
}

/**
 * RFC-0078: Gets default ranges for a device type (TIER 3)
 * @param {string} deviceType - Device type
 * @returns {Object} Default ranges
 */
function getDefaultRanges(deviceType) {
  const upperDeviceType = deviceType.toUpperCase();
  return DEFAULT_CONSUMPTION_RANGES[upperDeviceType] || DEFAULT_CONSUMPTION_RANGES['DEFAULT'];
}

/**
 * RFC-0078: Gets cached or fetches power limits JSON
 * @param {string} entityId - Entity ID
 * @param {string} entityType - 'DEVICE' or 'CUSTOMER'
 * @param {Object} ctxData - Optional ctx.data array from widget context
 * @returns {Promise<Object|null>} JSON configuration
 */
async function getCachedPowerLimitsJSON(entityId, entityType = 'CUSTOMER', ctxData = null) {
  if (!entityId) return null;

  const cacheKey = `${entityType}:${entityId}`;
  const cached = powerLimitsJSONCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < POWER_LIMITS_CACHE_TTL_MS) {
    return cached.json;
  }

  let json = null;

  if (entityType === 'DEVICE' && ctxData) {
    const powerLimitsData = ctxData.find((d) => d.dataKey && d.dataKey.name === 'mapInstantaneousPower');

    if (powerLimitsData && powerLimitsData.data && powerLimitsData.data.length > 0) {
      const latestValue = powerLimitsData.data[powerLimitsData.data.length - 1];
      const rawValue = latestValue[1];

      if (typeof rawValue === 'string') {
        try {
          json = JSON.parse(rawValue);
          LogHelper.log(`[RFC-0078] ✅ Loaded mapInstantaneousPower from ctx.data for DEVICE ${entityId}:`, {
            version: json.version,
            telemetryTypes: json.limitsByInstantaneoustPowerType?.length || 0,
          });
        } catch (parseError) {
          LogHelper.warn(`[RFC-0078] Failed to parse DEVICE JSON from ctx.data:`, parseError);
          json = { version: '1.0.0', limitsByInstantaneoustPowerType: [] };
        }
      } else if (typeof rawValue === 'object') {
        json = rawValue;
        LogHelper.log(
          `[RFC-0078] ✅ Loaded mapInstantaneousPower (object) from ctx.data for DEVICE ${entityId}`
        );
      }
    } else {
      LogHelper.log(
        `[RFC-0078] mapInstantaneousPower not found in ctx.data for DEVICE ${entityId}, using empty fallback`
      );
      json = { version: '1.0.0', limitsByInstantaneoustPowerType: [] };
    }
  } else if (entityType === 'CUSTOMER') {
    LogHelper.log('[RFC-0078] entityId getCachedPowerLimitsJSON', entityId);
    json = await fetchInstantaneousPowerLimits(entityId, entityType);
  } else {
    json = { version: '1.0.0', limitsByInstantaneoustPowerType: [] };
  }

  powerLimitsJSONCache.set(cacheKey, {
    json: json,
    timestamp: now,
  });

  return json;
}

/**
 * RFC-0078: Gets consumption limits with hierarchical resolution
 * TIER 1: Device-level (highest priority)
 * TIER 2: Customer-level
 * TIER 3: Hardcoded defaults (fallback)
 *
 * @param {string} deviceId - Device entity ID
 * @param {string} deviceType - Device type
 * @param {Object} customerLimitsJSON - Pre-fetched customer JSON (TIER 2)
 * @param {string} telemetryType - Telemetry type (default: 'consumption')
 * @param {Object} ctxData - Optional ctx.data array
 * @returns {Promise<Object>} Consumption ranges with source indicator
 */
async function getConsumptionRangesHierarchical(
  deviceId,
  deviceType,
  customerLimitsJSON,
  telemetryType = 'consumption',
  ctxData = null
) {
  // TIER 1: Try device-level JSON first
  const deviceLimitsJSON = await getCachedPowerLimitsJSON(deviceId, 'DEVICE', ctxData);
  if (
    deviceLimitsJSON &&
    deviceLimitsJSON.limitsByInstantaneoustPowerType &&
    deviceLimitsJSON.limitsByInstantaneoustPowerType.length > 0
  ) {
    const deviceRanges = extractLimitsFromJSON(deviceLimitsJSON, deviceType, telemetryType);
    if (deviceRanges) {
      return { ...deviceRanges, source: 'device', tier: 1 };
    }
  }

  // TIER 2: Try customer-level JSON
  if (customerLimitsJSON) {
    const customerRanges = extractLimitsFromJSON(customerLimitsJSON, deviceType, telemetryType);
    if (customerRanges) {
      return { ...customerRanges, source: 'customer', tier: 2 };
    }
  }

  // TIER 3: Hardcoded defaults
  LogHelper.log(`[RFC-0078] Using HARDCODED defaults for ${deviceType} (TIER 3)`);
  const defaultRanges = getDefaultRanges(deviceType);
  return {
    ...defaultRanges,
    source: 'hardcoded',
    tier: 3,
    metadata: {
      name: `Default${deviceType}`,
      description: `System default for ${deviceType}`,
      version: '0.0.0',
      telemetryType: telemetryType,
    },
  };
}

/**
 * RFC-0078: Alias for backward compatibility
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object|null>} Customer power limits JSON
 */
async function getCachedConsumptionLimits(customerId) {
  LogHelper.log(`[RFC-0078] getCachedConsumptionLimits called for customer ${customerId}`);
  return getCachedPowerLimitsJSON(customerId, 'CUSTOMER');
}

// ============================================
// END RFC-0078
// ============================================

/**
 * RFC-0072: Get customer name for a device
 * @param {Object} device - Device object with customerId and ingestionId
 * @returns {string} Customer name or fallback
 */
function getCustomerNameForDevice(device) {
  // Priority 1: Check if customerId exists and look it up
  if (device.customerId && window.custumersSelected && Array.isArray(window.custumersSelected)) {
    const shopping = window.custumersSelected.find((c) => c.value === device.customerId);
    if (shopping) return shopping.name;
  }

  // Priority 2: Try to get from energyCache via ingestionId
  if (device.ingestionId) {
    const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
    if (orchestrator && typeof orchestrator.getEnergyCache === 'function') {
      const energyCache = orchestrator.getEnergyCache();
      const cached = energyCache.get(device.ingestionId);
      if (cached && cached.customerName) {
        return cached.customerName;
      }
    }
  }

  // Priority 3: Fallback to customerId substring
  if (device.customerId) {
    return `Shopping ${device.customerId.substring(0, 8)}...`;
  }

  return 'N/A';
}

/**
 * Update equipment statistics header
 * NOTE: This function expects DOM elements from EQUIPMENTS widget
 * @param {Array} devices - Array of device objects with consumption data
 * @param {Map} energyCache - Energy cache from MAIN orchestrator (optional)
 * @param {Array} ctxData - The ctx.data array from widget context
 */
function updateEquipmentStats(devices, energyCache = null, ctxData = null) {
  const connectivityEl = document.getElementById('equipStatsConnectivity');
  const totalEl = document.getElementById('equipStatsTotal');
  const consumptionEl = document.getElementById('equipStatsConsumption');
  const zeroEl = document.getElementById('equipStatsZero');

  if (!connectivityEl || !totalEl || !consumptionEl || !zeroEl) {
    LogHelper.warn('[MAIN] Stats header elements not found');
    return;
  }

  // Calculate connectivity (online vs total) from ctx.data
  const deviceMap = new Map();

  if (ctxData && Array.isArray(ctxData)) {
    ctxData.forEach((data) => {
      const entityId = data.datasource?.entityId;
      const dataKeyName = data.dataKey?.name;

      if (!entityId) return;

      if (!deviceMap.has(entityId)) {
        deviceMap.set(entityId, { hasConnectionStatus: false, isOnline: false });
      }

      if (dataKeyName === 'connectionStatus') {
        const status = String(data.data?.[0]?.[1] || '').toLowerCase();
        deviceMap.get(entityId).hasConnectionStatus = true;
        deviceMap.get(entityId).isOnline = status === 'online';
      }
    });
  }

  // Count online devices
  let onlineCount = 0;
  let totalWithStatus = 0;

  devices.forEach((device) => {
    const deviceData = deviceMap.get(device.entityId);
    if (deviceData && deviceData.hasConnectionStatus) {
      totalWithStatus++;
      if (deviceData.isOnline) {
        onlineCount++;
      }
    }
  });

  // Calculate consumption from FILTERED devices array
  let totalConsumption = 0;
  devices.forEach((device) => {
    const ingestionId = device.ingestionId;

    let consumption = 0;
    if (ingestionId && energyCache) {
      const cached = energyCache.get(ingestionId);
      if (cached) {
        consumption = Number(cached.total_value) || 0;
      }
    }

    if (consumption === 0) {
      consumption = Number(device.val) || Number(device.lastValue) || 0;
    }

    totalConsumption += consumption;
  });

  LogHelper.log(
    '[MAIN] Consumption calculated from',
    devices.length,
    'filtered devices:',
    totalConsumption,
    'kWh'
  );

  // Calculate zero consumption count
  let zeroConsumptionCount = 0;
  devices.forEach((device) => {
    const consumption = Number(device.val) || Number(device.lastValue) || 0;
    if (consumption === 0) {
      zeroConsumptionCount++;
    }
  });

  // Calculate connectivity percentage
  const connectivityPercentage =
    totalWithStatus > 0 ? ((onlineCount / totalWithStatus) * 100).toFixed(1) : '0.0';

  // Update UI
  connectivityEl.textContent = `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`;
  totalEl.textContent = devices.length.toString();
  consumptionEl.textContent = typeof MyIOLibrary !== 'undefined' ? MyIOLibrary.formatEnergy(totalConsumption) : formatEnergy(totalConsumption);
  zeroEl.textContent = zeroConsumptionCount.toString();

  LogHelper.log('[MAIN] Stats updated:', {
    connectivity: `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`,
    total: devices.length,
    consumptionFromOrchestrator: totalConsumption,
    zeroCount: zeroConsumptionCount,
  });
}

/**
 * Find a value in an array of {key, value} objects
 * @param {Array} values - Array of objects with key/value properties
 * @param {string} key - Key to search for
 * @param {*} defaultValue - Default value if not found
 * @returns {*} The found value or defaultValue
 */
function findValue(values, key, defaultValue = null) {
  if (!Array.isArray(values)) return defaultValue;
  const found = values.find((v) => v.key === key);
  return found ? found.value : defaultValue;
}

/**
 * Fetch customer server-scope attributes from ThingsBoard
 * @param {string} customerTbId - ThingsBoard customer ID
 * @returns {Promise<Object>} Map of attribute key -> value
 */
async function fetchCustomerServerScopeAttrs(customerTbId) {
  if (!customerTbId) return {};
  const tbToken = localStorage.getItem('jwt_token');
  if (!tbToken) throw new Error('JWT do ThingsBoard não encontrado (localStorage.jwt_token).');

  const url = `/api/plugins/telemetry/CUSTOMER/${customerTbId}/values/attributes/SERVER_SCOPE`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${tbToken}`,
    },
  });
  if (!res.ok) {
    LogHelper.warn(`[MAIN] [customer attrs] HTTP ${res.status}`);
    return {};
  }
  const payload = await res.json();

  const map = {};
  if (Array.isArray(payload)) {
    for (const it of payload) map[it.key] = it.value;
  } else if (payload && typeof payload === 'object') {
    for (const k of Object.keys(payload)) {
      const v = payload[k];
      if (Array.isArray(v) && v.length) map[k] = v[0]?.value ?? v[0];
    }
  }
  return map;
}

// ✅ Expose shared utilities globally for child widgets
window.MyIOUtils = {
  // Logging
  LogHelper,
  isDebugActive: () => DEBUG_ACTIVE,
  setDebug: (active) => {
    DEBUG_ACTIVE = !!active;
    console.log(`[MyIOUtils] Debug mode ${DEBUG_ACTIVE ? 'enabled' : 'disabled'}`);
  },

  // API & Formatting
  getDataApiHost,
  formatEnergy,
  formatWater,
  mapConnectionStatus,
  formatRelativeTime,
  formatarDuracao,
  findValue,

  // Credentials (getters - populated after onInit)
  getCustomerId: () => window.myioHoldingCustomerId,
  getClientId: () => window.__MYIO_CLIENT_ID__,
  getClientSecret: () => window.__MYIO_CLIENT_SECRET__,
  getCustomerIngestionId: () => window.__MYIO_CUSTOMER_INGESTION_ID__,

  // Convenience: get all credentials at once
  getCredentials: () => ({
    customerId: window.myioHoldingCustomerId,
    customerIngestionId: window.__MYIO_CUSTOMER_INGESTION_ID__,
    clientId: window.__MYIO_CLIENT_ID__,
    clientSecret: window.__MYIO_CLIENT_SECRET__,
    dataApiHost: getDataApiHost(),
  }),

  // RFC-0071: Device Profile Sync
  fetchDeviceProfiles,
  fetchDeviceDetails,
  addDeviceProfileAttribute,
  syncDeviceProfileAttributes,

  // RFC-0078: Power Limits
  DEFAULT_CONSUMPTION_RANGES,
  fetchInstantaneousPowerLimits,
  extractLimitsFromJSON,
  getDefaultRanges,
  getCachedPowerLimitsJSON,
  getConsumptionRangesHierarchical,
  getCachedConsumptionLimits,

  // UI Helpers
  showLoadingOverlay,
  updateEquipmentStats,
  getCustomerNameForDevice,

  // ThingsBoard API
  fetchCustomerServerScopeAttrs,
};

console.log('[MAIN] MyIOUtils exposed globally:', Object.keys(window.MyIOUtils));

let CUSTOMER_ID_TB; // ThingsBoard Customer ID
let CUSTOMER_INGESTION_ID; // Ingestion API Customer ID
let CLIENT_ID_INGESTION;
let CLIENT_SECRET_INGESTION;
let myIOAuth; // Instance of MyIO auth component

// NOTE: fetchCustomerServerScopeAttrs is defined above and exposed via MyIOUtils

// NOTE: Funções de rendering e device data removidas
// Essas responsabilidades agora pertencem aos widgets HEADER e EQUIPMENTS

// ===== ORCHESTRATOR: Energy Cache Management =====
const MyIOOrchestrator = (() => {
  // ========== BUSY OVERLAY MANAGEMENT ==========
  const BUSY_OVERLAY_ID = 'myio-orchestrator-busy-overlay';
  let globalBusyState = {
    isVisible: false,
    timeoutId: null,
    startTime: null,
    currentDomain: null,
    requestCount: 0,
  };

  function ensureOrchestratorBusyDOM() {
    let el = document.getElementById(BUSY_OVERLAY_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = BUSY_OVERLAY_ID;
    el.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(45, 20, 88, 0.6);
      backdrop-filter: blur(3px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      font-family: Inter, system-ui, sans-serif;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      background: #2d1458;
      color: #fff;
      border-radius: 18px;
      padding: 24px 32px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 320px;
    `;

    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255,255,255,0.25);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    `;

    const message = document.createElement('div');
    message.id = `${BUSY_OVERLAY_ID}-message`;
    message.style.cssText = `
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.2px;
    `;
    message.textContent = 'Carregando dados...';

    container.appendChild(spinner);
    container.appendChild(message);
    el.appendChild(container);
    document.body.appendChild(el);

    // Add CSS animation
    if (!document.querySelector('#myio-busy-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'myio-busy-styles';
      styleEl.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleEl);
    }

    return el;
  }

  function showGlobalBusy(domain = 'energy', message = 'Carregando dados de energia...') {
    LogHelper.log(`[Orchestrator] 🔄 showGlobalBusy() domain=${domain} message="${message}"`);

    const el = ensureOrchestratorBusyDOM();
    const messageEl = el.querySelector(`#${BUSY_OVERLAY_ID}-message`);

    if (messageEl) {
      messageEl.textContent = message;
    }

    // Clear existing timeout
    if (globalBusyState.timeoutId) {
      clearTimeout(globalBusyState.timeoutId);
      globalBusyState.timeoutId = null;
    }

    // Update state
    globalBusyState.isVisible = true;
    globalBusyState.currentDomain = domain;
    globalBusyState.startTime = Date.now();
    globalBusyState.requestCount++;

    el.style.display = 'flex';

    // Extended timeout (25s)
    globalBusyState.timeoutId = setTimeout(() => {
      LogHelper.warn(`[Orchestrator] ⚠️ BUSY TIMEOUT (25s) for domain ${domain}`);
      hideGlobalBusy();
      globalBusyState.timeoutId = null;
    }, 25000);

    LogHelper.log(`[Orchestrator] ✅ Global busy shown for ${domain}`);
  }

  function hideGlobalBusy() {
    LogHelper.log(`[Orchestrator] ⏸️ hideGlobalBusy() called`);

    const el = document.getElementById(BUSY_OVERLAY_ID);
    if (el) {
      el.style.display = 'none';
    }

    // Clear timeout
    if (globalBusyState.timeoutId) {
      clearTimeout(globalBusyState.timeoutId);
      globalBusyState.timeoutId = null;
    }

    // Update state
    globalBusyState.isVisible = false;
    globalBusyState.currentDomain = null;
    globalBusyState.startTime = null;

    LogHelper.log(`[Orchestrator] ✅ Global busy hidden`);
  }

  // RFC-0057: Simplified - memory-only cache (no localStorage)
  let energyCache = new Map(); // Map<ingestionId, energyData>
  let waterCache = new Map();
  let isFetching = false;
  let lastFetchParams = null;
  let lastFetchTimestamp = null;

  // ===== STATE para montar o resumo ENERGY =====
  let customerTotalConsumption = null; // total do cliente (vem do HEADER)
  let lojasIngestionIds = new Set(); // ingestionIds das lojas (3F_MEDIDOR) - vem do EQUIPMENTS
  let equipmentsIngestionIds = new Set(); // ingestionIds dos equipamentos - vem do EQUIPMENTS
  let selectedShoppingIds = []; // Shopping ingestionIds selecionados no filtro (vem do MENU)

  // ===== DEVICE-TO-SHOPPING MAPPING (Fallback for missing customerId) =====
  // Map<deviceIngestionId, shoppingIngestionId> - populated from EQUIPMENTS ctx.data
  window.myioDeviceToShoppingMap = window.myioDeviceToShoppingMap || new Map();

  function haveEquipments() {
    return energyCache && energyCache.size > 0;
  }
  function haveCustomerTotal() {
    return typeof customerTotalConsumption === 'number' && !Number.isNaN(customerTotalConsumption);
  }

  /**
   * Verifica se um device deve ser incluído no cálculo baseado no filtro de shoppings
   * @param {Object} device - Device data from energyCache
   * @returns {boolean} - True if device should be included
   */
  function shouldIncludeDevice(device) {
    // Se nenhum shopping foi selecionado (filtro vazio), inclui todos
    if (!selectedShoppingIds || selectedShoppingIds.length === 0) {
      return true;
    }

    // Tenta obter customerId do device ou do mapa de fallback
    let customerId = device.customerId;

    // Fallback: se não tem customerId, tenta buscar no mapa global
    if (!customerId && window.myioDeviceToShoppingMap) {
      customerId = window.myioDeviceToShoppingMap.get(device.ingestionId);
    }

    // Se ainda não tem customerId, inclui (safety - não filtra dispositivos sem mapeamento)
    if (!customerId) {
      return true;
    }

    // Verifica se o customerId do device está na lista de shoppings selecionados
    return selectedShoppingIds.includes(customerId);
  }

  function dispatchEnergySummaryIfReady(reason = 'unknown') {
    if (!haveEquipments() || !haveCustomerTotal()) {
      LogHelper.log(
        `[MAIN] [Orchestrator] Resumo ainda não pronto (equip=${haveEquipments()} total=${haveCustomerTotal()}) [${reason}]`
      );
      return;
    }
    const summary = getEnergyWidgetData(customerTotalConsumption);
    window.dispatchEvent(new CustomEvent('myio:energy-summary-ready', { detail: summary }));
    LogHelper.log(`[MAIN] [Orchestrator] 🔔 energy-summary-ready dispatched (${reason})`, summary);
  }

  function cacheKey(customerIngestionId, startDateISO, endDateISO) {
    return `energy:${customerIngestionId}:${startDateISO}:${endDateISO}`;
  }

  function invalidateCache(domain = 'all') {
    LogHelper.log(`[Orchestrator] Invalidating ${domain} cache`);

    if (domain === 'energy' || domain === 'all') {
      energyCache.clear();
    }
    if (domain === 'water' || domain === 'all') {
      waterCache.clear();
    }

    // Reseta o estado compartilhado
    lastFetchParams = null;
    lastFetchTimestamp = null;
  }

  async function fetchEnergyData(customerIngestionId, startDateISO, endDateISO) {
    const key = cacheKey(customerIngestionId, startDateISO, endDateISO);

    // RFC-0057: Check for duplicate fetches
    if (isFetching && lastFetchParams === key) {
      LogHelper.log('[MAIN] [Orchestrator] Fetch already in progress, skipping...');
      return energyCache;
    }

    // RFC-0057: Check memory cache (no localStorage)
    if (energyCache.size > 0 && lastFetchParams === key) {
      const cacheAge = lastFetchTimestamp ? Date.now() - lastFetchTimestamp : 0;
      const cacheTTL = 5 * 60 * 1000; // 5 minutes

      if (cacheAge < cacheTTL) {
        LogHelper.log(
          `[MAIN] [Orchestrator] Using cached data from memory (${
            energyCache.size
          } devices, age: ${Math.round(cacheAge / 1000)}s)`
        );

        // Emit event with cached data
        window.dispatchEvent(
          new CustomEvent('myio:energy-data-ready', {
            detail: {
              cache: energyCache,
              totalDevices: energyCache.size,
              startDate: startDateISO,
              endDate: endDateISO,
              timestamp: lastFetchTimestamp,
              fromCache: true,
            },
          })
        );

        return energyCache;
      } else {
        LogHelper.log(
          `[MAIN] [Orchestrator] Cache expired (age: ${Math.round(cacheAge / 1000)}s), fetching fresh data...`
        );
      }
    }

    isFetching = true;
    lastFetchParams = key;
    LogHelper.log('[MAIN] [Orchestrator] Fetching energy data from API...', {
      customerIngestionId,
      startDateISO,
      endDateISO,
    });

    // Show global busy modal
    showGlobalBusy('energy', 'Carregando dados de energia...');

    try {
      // Get token from MyIO auth component
      const TOKEN_INGESTION = await myIOAuth.getToken();

      const apiUrl = `${getDataApiHost()}/api/v1/telemetry/customers/${customerIngestionId}/energy/devices/totals?startTime=${encodeURIComponent(
        startDateISO
      )}&endTime=${encodeURIComponent(endDateISO)}&deep=1`;
      LogHelper.log('[MAIN] [Orchestrator] 🌐 API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${TOKEN_INGESTION}`,
          'Content-Type': 'application/json',
        },
      });

      LogHelper.log(`[MAIN] [Orchestrator] 📡 API Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.warn(`[MAIN] [Orchestrator] ❌ Failed to fetch energy: HTTP ${response.status}`);
        return energyCache;
      }

      const data = await response.json();
      LogHelper.log('[MAIN] [Orchestrator] 📦 API Response:', data);

      // Log summary if available
      if (data.summary) {
        LogHelper.log('[MAIN] [Orchestrator] 📊 API Summary:', data.summary);
      }

      // API returns { data: [...] }
      const devicesList = Array.isArray(data) ? data : data.data || [];
      LogHelper.log('[MAIN] [Orchestrator] 📋 Devices list extracted:', devicesList.length, 'devices');

      // Log first device if available for debugging
      if (devicesList.length > 0) {
        LogHelper.log('[MAIN] [Orchestrator] 🔍 First device sample:', devicesList[0]);
      } else {
        console.warn(
          '[MAIN] [Orchestrator] ⚠️ API returned ZERO devices! Check if data exists for this period.'
        );
      }

      // Clear and repopulate cache
      energyCache.clear();
      let count = 0;
      devicesList.forEach((device) => {
        if (device.id) {
          // Debug: check all possible customerId fields
          const customerId = device.customerId || device.customer_id || device.ownerId || null;

          if (count === 0) {
            // Log first device to see full structure
            LogHelper.log(
              '[MAIN] [Orchestrator] 🔍 Full first device structure:',
              JSON.stringify(device, null, 2)
            );
            LogHelper.log('[MAIN] [Orchestrator] 🔍 Extracted customerId:', customerId);
          }

          const cachedData = {
            ingestionId: device.id,
            customerId: customerId, // Shopping ingestionId
            customerName: device.customerName || device.customer_name || null, // Shopping friendly name
            name: device.name,
            deviceType: device.deviceType || device.device_type || '',
            deviceProfile: device.deviceProfile || device.device_profile || '',
            label: device.label || device.name || '',
            entityLabel: device.entityLabel || device.entity_label || device.label || device.name || '',
            entityName: device.entityName || device.entity_name || device.name || '',
            total_value: device.total_value || 0,
            timestamp: Date.now(),
          };

          energyCache.set(device.id, cachedData);
          count++;

          // Log first cached device to verify data structure
          if (count === 1) {
            LogHelper.log('[MAIN] [Orchestrator] 🔍 First cached device data:', cachedData);
            LogHelper.log('[MAIN] [Orchestrator] 🔍 customerName extracted:', cachedData.customerName);
          }
          //LogHelper.log(`[MAIN] [Orchestrator] Cached device: ${device.name} (${device.id}) = ${device.total_value} kWh`);
          // TODO Implementar uma função que
        }
      });

      LogHelper.log(`[MAIN] [Orchestrator] Energy cache updated: ${energyCache.size} devices`);

      // RFC-0057: Update timestamp for memory cache
      lastFetchTimestamp = Date.now();

      // Emit event with cached data
      window.dispatchEvent(
        new CustomEvent('myio:energy-data-ready', {
          detail: {
            cache: energyCache,
            totalDevices: energyCache.size,
            startDate: startDateISO,
            endDate: endDateISO,
            timestamp: Date.now(),
            fromCache: false,
          },
        })
      );
      // Se já temos o total do cliente, emita também o resumo para o ENERGY
      LogHelper.log('[MAIN] [Orchestrator] dispatchEnergySummaryIfReady >>> fetchEnergyData 001');
      dispatchEnergySummaryIfReady('fetchEnergyData');

      return energyCache;
    } catch (err) {
      console.error('[MAIN] [Orchestrator] Fatal error fetching energy data:', err);
      return energyCache;
    } finally {
      isFetching = false;
      // Hide global busy modal
      hideGlobalBusy();
    }
  }

  async function fetchWaterData(customerIngestionId, startDateISO, endDateISO) {
    // 1. A key de cache para ÁGUA.
    // (Note que estamos "re-implementando" a lógica da cacheKey aqui
    // para não ter que alterar a função original)
    const key = `water:${customerIngestionId}:${startDateISO}:${endDateISO}`;
    const cache = waterCache; // Usa o cache de ÁGUA

    // O resto é o "esqueleto" compartilhado
    if (isFetching && lastFetchParams === key) {
      LogHelper.log('[MAIN] [Orchestrator] Fetch (water) already in progress, skipping...');
      return cache;
    }

    if (cache.size > 0 && lastFetchParams === key) {
      const cacheAge = lastFetchTimestamp ? Date.now() - lastFetchTimestamp : 0;
      const cacheTTL = 5 * 60 * 1000;

      if (cacheAge < cacheTTL) {
        LogHelper.log(
          `[MAIN] [Orchestrator] Using cached (water) data (${cache.size} devices, age: ${Math.round(
            cacheAge / 1000
          )}s)`
        );

        window.dispatchEvent(
          new CustomEvent('myio:water-data-ready', {
            detail: {
              cache: cache,
              totalDevices: cache.size,
              startDate: startDateISO,
              endDate: endDateISO,
              timestamp: lastFetchTimestamp,
              fromCache: true,
            },
          })
        );
        return cache;
      } else {
        LogHelper.log(`[MAIN] [Orchestrator] Water cache expired, fetching...`);
      }
    }

    isFetching = true;
    lastFetchParams = key;
    LogHelper.log('[MAIN] [Orchestrator] Fetching water data from API...');

    showGlobalBusy('water', 'Carregando dados de água...');

    try {
      const TOKEN_INGESTION = await myIOAuth.getToken();

      // Endpoint da API de ÁGUA
      const apiUrl = `${getDataApiHost()}/api/v1/telemetry/customers/${customerIngestionId}/water/devices/totals?startTime=${encodeURIComponent(
        startDateISO
      )}&endTime=${encodeURIComponent(endDateISO)}&deep=1`;

      LogHelper.log('[MAIN] [Orchestrator] 🌐 API URL (Water):', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${TOKEN_INGESTION}`,
          'Content-Type': 'application/json',
        },
      });

      LogHelper.log(`[MAIN] [Orchestrator] 📡 API Status (Water): ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.warn(`[MAIN] [Orchestrator] ❌ Failed to fetch water: HTTP ${response.status}`);
        return cache;
      }

      const data = await response.json();
      const devicesList = Array.isArray(data) ? data : data.data || [];

      cache.clear(); // Limpa e repopula o cache de ÁGUA
      devicesList.forEach((device) => {
        if (device.id) {
          cache.set(device.id, {
            ingestionId: device.id,
            name: device.name,
            total_value: device.total_value || 0,
            customerId: device.customerId || device.customer_id || null, // For filtering by shopping
            timestamp: Date.now(),
          });
        }
      });

      LogHelper.log(`[MAIN] [Orchestrator] Water cache updated: ${cache.size} devices`);

      lastFetchTimestamp = Date.now();

      // Dispara o evento de ÁGUA
      window.dispatchEvent(
        new CustomEvent('myio:water-data-ready', {
          detail: {
            cache: cache,
            totalDevices: cache.size,
            startDate: startDateISO,
            endDate: endDateISO,
            timestamp: Date.now(),
            fromCache: false,
          },
        })
      );

      return cache;
    } catch (err) {
      console.error('[MAIN] [Orchestrator] Fatal error fetching water data:', err);
      return cache;
    } finally {
      isFetching = false;
      hideGlobalBusy();
    }
  }

  function getCache(domain = 'energy') {
    if (domain === 'water') {
      return waterCache;
    }
    return energyCache;
  }

  function getCachedDevice(ingestionId, domain = 'energy') {
    const cache = domain === 'water' ? waterCache : energyCache;
    return cache.get(ingestionId) || null;
  }
  // RFC-0057: invalidateCache already defined above (line 280), no duplicate needed

  /**
   * Calcula o total de consumo de EQUIPAMENTOS no cache
   * Usa equipmentsIngestionIds (do EQUIPMENTS) se disponível, senão exclui lojas
   * Considera filtro de shoppings se aplicado
   * @returns {number} - Total em kWh
   */
  function getTotalEquipmentsConsumption() {
    let total = 0;
    energyCache.forEach((device, ingestionId) => {
      // Se temos a lista de equipamentos, usa ela (mais preciso)
      // Senão, usa o fallback de excluir lojas
      const isEquipment = equipmentsIngestionIds.size > 0
        ? equipmentsIngestionIds.has(ingestionId)
        : !lojasIngestionIds.has(ingestionId);

      if (isEquipment) {
        // Apply shopping filter
        if (shouldIncludeDevice(device)) {
          total += device.total_value || 0;
        }
      }
    });
    /*
    LogHelper.log(
      `[MAIN] [Orchestrator] Total EQUIPMENTS consumption: ${total} kWh`
    );
    */
    return total;
  }

  /**
   * Calcula o total de consumo de LOJAS no cache (apenas 3F_MEDIDOR)
   * Considera filtro de shoppings se aplicado
   * @returns {number} - Total em kWh
   */
  function getTotalLojasConsumption() {
    let total = 0;

    energyCache.forEach((device, ingestionId) => {
      // Only lojas (3F_MEDIDOR)
      if (lojasIngestionIds.has(ingestionId)) {
        // Apply shopping filter
        if (shouldIncludeDevice(device)) {
          total += device.total_value || 0;
        }
      }
    });
    /*
    LogHelper.log(
      `[MAIN] [Orchestrator] Total LOJAS consumption (3F_MEDIDOR only): ${total} kWh (${count} devices, ${filtered} filtered out by shopping filter)`
    );
    */
    return total;
  }

  /**
   * Calcula o total GERAL de consumo (EQUIPAMENTOS + LOJAS)
   * Se temos IDs identificados, soma apenas esses dispositivos
   * Senão, soma todos os dispositivos da API
   * Considera filtro de shoppings se aplicado
   * @returns {number} - Total em kWh
   */
  function getTotalConsumption() {
    // Se temos dispositivos identificados, usar soma precisa
    const hasIdentifiedDevices = equipmentsIngestionIds.size > 0 || lojasIngestionIds.size > 0;

    if (hasIdentifiedDevices) {
      // Soma apenas equipamentos + lojas identificados
      return getTotalEquipmentsConsumption() + getTotalLojasConsumption();
    }

    // Fallback: soma todos da API (comportamento antigo)
    let total = 0;
    energyCache.forEach((device) => {
      if (shouldIncludeDevice(device)) {
        total += device.total_value || 0;
      }
    });
    return total;
  }

  /**
   * Calcula o total GERAL de consumo de ENERGIA SEM FILTRO de shopping
   * Se temos IDs identificados, soma apenas esses dispositivos (sem filtro de shopping)
   * @returns {number} - Total em kWh
   */
  function getUnfilteredTotalConsumption() {
    // Se temos dispositivos identificados, somar apenas eles (mas sem filtro de shopping)
    const hasIdentifiedDevices = equipmentsIngestionIds.size > 0 || lojasIngestionIds.size > 0;

    if (hasIdentifiedDevices) {
      let total = 0;
      // Equipamentos identificados (sem filtro de shopping)
      energyCache.forEach((device, ingestionId) => {
        if (equipmentsIngestionIds.has(ingestionId)) {
          total += device.total_value || 0;
        }
      });
      // Lojas identificadas (sem filtro de shopping)
      energyCache.forEach((device, ingestionId) => {
        if (lojasIngestionIds.has(ingestionId)) {
          total += device.total_value || 0;
        }
      });
      return total;
    }

    // Fallback: soma todos da API
    let total = 0;
    energyCache.forEach((device) => {
      total += device.total_value || 0;
    });
    return total;
  }

  /**
   * Calcula o total GERAL de consumo de ÁGUA COM FILTRO aplicado
   * @returns {number} - Total em m³
   */
  function getTotalWaterConsumption() {
    let total = 0;
    waterCache.forEach((device) => {
      if (shouldIncludeDevice(device)) {
        total += device.total_value || 0;
      }
    });
    return total;
  }

  /**
   * Calcula o total GERAL de consumo de ÁGUA SEM FILTRO (todos os devices)
   * @returns {number} - Total em m³
   */
  function getUnfilteredTotalWaterConsumption() {
    let total = 0;
    waterCache.forEach((device) => {
      total += device.total_value || 0;
    });
    return total;
  }

  /**
   * Verifica se há filtro de shoppings ativo
   * @returns {boolean} - True se há filtro aplicado
   */
  function isFilterActive() {
    return selectedShoppingIds && selectedShoppingIds.length > 0;
  }

  /**
   * Obtém dados agregados para o widget ENERGY
   * @param {number} totalConsumption - Consumo TOTAL (Equipamentos + Lojas) vindo do HEADER (fallback)
   * @returns {object} - { customerTotal, equipmentsTotal, lojasTotal, percentage }
   */
  function getEnergyWidgetData(totalConsumption = 0) {
    const equipmentsTotal = getTotalEquipmentsConsumption();
    const lojasTotal = getTotalLojasConsumption();

    // Total calculado = soma de equipamentos + lojas (dispositivos conhecidos)
    const calculatedTotal = equipmentsTotal + lojasTotal;

    // Se temos listas de IDs identificadas, usar o total calculado
    // Senão, usar o total vindo do HEADER (API completa)
    const hasIdentifiedDevices = equipmentsIngestionIds.size > 0 || lojasIngestionIds.size > 0;
    const effectiveTotal = hasIdentifiedDevices ? calculatedTotal : (totalConsumption || calculatedTotal);

    // ✅ Equipamentos como % do total
    const percentage = effectiveTotal > 0 ? (equipmentsTotal / effectiveTotal) * 100 : 0;

    const result = {
      customerTotal: Number(effectiveTotal) || 0,
      equipmentsTotal: Number(equipmentsTotal) || 0,
      lojasTotal: Number(lojasTotal) || 0,
      difference: Number(lojasTotal) || 0, // Mantém compatibilidade (lojas = difference)
      percentage: Number(percentage) || 0,
      deviceCount: energyCache.size,
    };

    LogHelper.log(`[MAIN] [Orchestrator] Energy widget data:`, {
      ...result,
      calculatedTotal,
      hasIdentifiedDevices,
      apiTotal: totalConsumption,
    });
    return result;
  }

  return {
    fetchEnergyData,
    fetchWaterData,
    getCache,
    getEnergyCache: getCache, // Alias for ENERGY widget compatibility
    getWaterCache: () => getCache('water'), // Alias for WATER widget compatibility
    getCachedDevice,
    invalidateCache,
    // RFC-0057: Removed clearStorageCache - no longer using localStorage
    showGlobalBusy,
    hideGlobalBusy,
    getBusyState: () => ({ ...globalBusyState }),
    getTotalEquipmentsConsumption,
    getTotalLojasConsumption,
    getTotalConsumption,
    getTotalWaterConsumption,
    getUnfilteredTotalConsumption,
    getUnfilteredTotalWaterConsumption,
    isFilterActive,
    getEnergyWidgetData,
    getLastFetchTimestamp: () => lastFetchTimestamp, // RFC: Expor timestamp para deduplicação
    requestSummary() {
      // Responde imediatamente com o que tiver no momento
      const total = haveCustomerTotal() ? customerTotalConsumption : 0;
      const summary = getEnergyWidgetData(total);
      window.dispatchEvent(new CustomEvent('myio:energy-summary-ready', { detail: summary }));
      LogHelper.log('[MAIN] [Orchestrator] ▶ requestSummary() dispatched', summary);
      return summary;
    },

    setCustomerTotal(total) {
      const n = Number(total);
      if (!Number.isFinite(n)) {
        console.warn('[MAIN] [Orchestrator] setCustomerTotal ignorado (valor inválido):', total);
        return;
      }
      customerTotalConsumption = n;
      LogHelper.log('[MAIN] [Orchestrator] customerTotalConsumption set to', n);
      dispatchEnergySummaryIfReady('setCustomerTotal');
    },

    setLojasIngestionIds(ids) {
      lojasIngestionIds = new Set(ids || []);
      LogHelper.log('[MAIN] [Orchestrator] lojasIngestionIds set:', lojasIngestionIds.size, 'lojas');
      // Recalculate and dispatch summary if ready
      dispatchEnergySummaryIfReady('setLojasIngestionIds');
    },

    getLojasIngestionIds() {
      return lojasIngestionIds;
    },

    setEquipmentsIngestionIds(ids) {
      equipmentsIngestionIds = new Set(ids || []);
      LogHelper.log('[MAIN] [Orchestrator] equipmentsIngestionIds set:', equipmentsIngestionIds.size, 'equipments');
      // Recalculate and dispatch summary if ready
      dispatchEnergySummaryIfReady('setEquipmentsIngestionIds');
    },

    getEquipmentsIngestionIds() {
      return equipmentsIngestionIds;
    },

    /**
     * Aplica filtro de shoppings selecionados
     * @param {Array<string>} shoppingIds - Array de ingestionIds dos shoppings
     */
    setSelectedShoppings(shoppingIds) {
      selectedShoppingIds = Array.isArray(shoppingIds) ? shoppingIds : [];
      LogHelper.log(
        '[MAIN] [Orchestrator] Shopping filter applied:',
        selectedShoppingIds.length === 0
          ? 'ALL (no filter)'
          : `${selectedShoppingIds.length} shoppings selected`
      );
      if (selectedShoppingIds.length > 0) {
        LogHelper.log('[MAIN] [Orchestrator] Selected shopping IDs:', selectedShoppingIds);
      }
      // Recalculate and dispatch summary with filter applied
      dispatchEnergySummaryIfReady('setSelectedShoppings');

      // Notify HEADER and other widgets that filter was updated in orchestrator
      window.dispatchEvent(
        new CustomEvent('myio:orchestrator-filter-updated', {
          detail: {
            selectedShoppingIds,
            isFiltered: selectedShoppingIds.length > 0,
          },
        })
      );
      LogHelper.log('[MAIN] [Orchestrator] ✅ Dispatched myio:orchestrator-filter-updated');
    },
  };
})();

// Expose globally
window.MyIOOrchestrator = MyIOOrchestrator;
// HEADER → informa total do cliente (use o evento que seu HEADER emitir)
window.addEventListener('myio:header-summary-ready', (ev) => {
  // Tenta chaves comuns
  const d = ev.detail || {};
  const candidate = d.customerTotal ?? d.total ?? d.totalConsumption ?? d.kwh ?? d.value;
  LogHelper.log('[MAIN] heard myio:header-summary-ready:', d, 'candidate=', candidate);
  if (typeof window.MyIOOrchestrator?.setCustomerTotal === 'function') {
    window.MyIOOrchestrator.setCustomerTotal(candidate);
  }
});

// Alternativa caso o HEADER use outro nome de evento
window.addEventListener('myio:customer-total-ready', (ev) => {
  const n = ev.detail?.total;
  LogHelper.log('[MAIN] heard myio:customer-total-ready:', ev.detail);
  if (typeof window.MyIOOrchestrator?.setCustomerTotal === 'function') {
    window.MyIOOrchestrator.setCustomerTotal(n);
  }
});

// ✅ HEADER emite myio:customer-total-consumption
window.addEventListener('myio:customer-total-consumption', (ev) => {
  const n = ev.detail?.customerTotal;
  LogHelper.log('[MAIN] heard myio:customer-total-consumption:', ev.detail, 'customerTotal=', n);
  if (typeof window.MyIOOrchestrator?.setCustomerTotal === 'function') {
    window.MyIOOrchestrator.setCustomerTotal(n);
  }
});

// ✅ MENU emite myio:filter-applied com shoppings selecionados
window.addEventListener('myio:filter-applied', (ev) => {
  LogHelper.log('[MAIN] heard myio:filter-applied:', ev.detail);

  // Extract shopping IDs from selection
  // ev.detail.selection is an array of { name, value } where value is the ingestionId
  const selection = ev.detail?.selection || [];
  LogHelper.log('selection', selection);

  const shoppingIds = selection.map((s) => s.value).filter((v) => v);

  LogHelper.log('[MAIN] Applying shopping filter:', shoppingIds.length === 0 ? 'ALL' : shoppingIds);

  if (typeof window.MyIOOrchestrator?.setSelectedShoppings === 'function') {
    window.MyIOOrchestrator.setSelectedShoppings(shoppingIds);
  }
});

// ENERGY → pode pedir o resumo explicitamente
window.addEventListener('myio:request-energy-summary', () => {
  if (typeof window.MyIOOrchestrator?.requestSummary === 'function') {
    window.MyIOOrchestrator.requestSummary();
  }
});

// ✅ EQUIPMENTS → informa quais devices são lojas (3F_MEDIDOR)
window.addEventListener('myio:lojas-identified', (ev) => {
  const ids = ev.detail?.lojasIngestionIds || [];
  LogHelper.log('[MAIN] heard myio:lojas-identified:', ev.detail);
  if (typeof window.MyIOOrchestrator?.setLojasIngestionIds === 'function') {
    window.MyIOOrchestrator.setLojasIngestionIds(ids);
  }
});

// ✅ EQUIPMENTS → informa quais devices são equipamentos
window.addEventListener('myio:equipments-identified', (ev) => {
  const ids = ev.detail?.equipmentsIngestionIds || [];
  LogHelper.log('[MAIN] heard myio:equipments-identified:', ev.detail);
  if (typeof window.MyIOOrchestrator?.setEquipmentsIngestionIds === 'function') {
    window.MyIOOrchestrator.setEquipmentsIngestionIds(ids);
  }
});

window.addEventListener('myio:customers-ready', async (ev) => {
  // TODO: implementar Cálculo de temperatura por customer
  // LogHelper.log("[MAIN] heard myio:customers-ready<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<:", ev.detail);
  // const devicesList = extractDevicesWithDetails(ctx.data);
  // const customersList = ev.detail?.customersList || [];
  // const TemperatureMap = getTemperatureReportByCustomer(devicesList, customersList);
});

LogHelper.log('[MyIOOrchestrator] Initialized');

// ✅ Check if filter was already applied before MAIN initialized
if (
  window.custumersSelected &&
  Array.isArray(window.custumersSelected) &&
  window.custumersSelected.length > 0
) {
  LogHelper.log('[MAIN] 🔄 Applying pre-existing filter:', window.custumersSelected.length, 'shoppings');
  const shoppingIds = window.custumersSelected.map((s) => s.value).filter((v) => v);
  if (typeof window.MyIOOrchestrator?.setSelectedShoppings === 'function') {
    window.MyIOOrchestrator.setSelectedShoppings(shoppingIds);
  }
}

// ===== RFC: updateTotalConsumption moved from MENU =====
/**
 * Atualiza o card de energia total com consumo dos customers selecionados
 * @param {Array} customersArray - Array de customers {name, value}
 * @param {string} startDateISO - Data início ISO
 * @param {string} endDateISO - Data fim ISO
 */
async function updateTotalConsumption(customersArray, startDateISO, endDateISO) {
  const energyTotal = document.getElementById('energy-kpi');
  if (!energyTotal) {
    LogHelper.warn('[MAIN] energy-kpi element not found');
    return;
  }

  energyTotal.innerHTML = `
    <svg style="width:28px; height:28px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#6c2fbf" stroke-width="5" stroke-linecap="round"
              stroke-dasharray="90,150" stroke-dashoffset="0">
      </circle>
    </svg>
  `;

  let totalConsumption = 0;

  for (const c of customersArray) {
    if (!c.value) continue;

    try {
      const TOKEN_INGESTION = await myIOAuth.getToken();

      const response = await fetch(
        `${getDataApiHost()}/api/v1/telemetry/customers/${
          c.value
        }/energy/total?startTime=${encodeURIComponent(startDateISO)}&endTime=${encodeURIComponent(
          endDateISO
        )}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${TOKEN_INGESTION}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
      const data = await response.json();

      totalConsumption += data.total_value;
    } catch (err) {
      console.error(`Falha ao buscar dados do customer ${c.value}:`, err);
    }
  }

  const percentDiference = document.getElementById('energy-trend');

  energyTotal.innerText = `${MyIOLibrary.formatEnergy(totalConsumption)}`;
  if (percentDiference) {
    percentDiference.innerText = `↑ 100%`;
    percentDiference.style.color = 'red';
  }

  //LogHelper.log('[MAIN] updateTotalConsumption completed:', totalConsumption);
}

// ===== RFC: Listen for request to update total consumption from MENU =====
window.addEventListener('myio:request-total-consumption', async (ev) => {
  //LogHelper.log('[MAIN] Received myio:request-total-consumption:', ev.detail);

  const { customersArray, startDateISO, endDateISO } = ev.detail || {};

  if (!customersArray || !startDateISO || !endDateISO) {
    LogHelper.warn('[MAIN] Invalid parameters for updateTotalConsumption');
    return;
  }

  await updateTotalConsumption(customersArray, startDateISO, endDateISO);
});

// ===== RFC: updateTotalWaterConsumption moved from HEADER =====
/**
 * Atualiza o card de água total com consumo dos customers selecionados
 * @param {Array} customersArray - Array de customers {name, value}
 * @param {string} startDateISO - Data início ISO
 * @param {string} endDateISO - Data fim ISO
 */
async function updateTotalWaterConsumption(customersArray, startDateISO, endDateISO) {
  const waterTotal = document.getElementById('water-kpi');
  if (!waterTotal) {
    LogHelper.warn('[MAIN] water-kpi element not found');
    return;
  }

  waterTotal.innerHTML = `
    <svg style="width:28px; height:28px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#6c2fbf" stroke-width="5" stroke-linecap="round"
              stroke-dasharray="90,150" stroke-dashoffset="0">
      </circle>
    </svg>
  `;

  let totalConsumption = 0;

  for (const c of customersArray) {
    if (!c.value) continue;

    try {
      const TOKEN_INGESTION = await myIOAuth.getToken();

      const response = await fetch(
        `${getDataApiHost()}/api/v1/telemetry/customers/${c.value}/water/total?startTime=${encodeURIComponent(
          startDateISO
        )}&endTime=${encodeURIComponent(endDateISO)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${TOKEN_INGESTION}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
      const data = await response.json();

      totalConsumption += data.total_value;
    } catch (err) {
      console.error(`Falha ao buscar dados de água do customer ${c.value}:`, err);
    }
  }

  waterTotal.innerText = `${MyIOLibrary.formatWaterVolumeM3(totalConsumption)}`;

  // RFC-0087: Dispatch water data to water widgets
  // Note: In the future, this should be split by common area vs stores
  window.dispatchEvent(
    new CustomEvent('myio:water-data-ready', {
      detail: {
        source: 'WATER_COMMON_AREA',
        data: {
          totalDevices: customersArray.length,
          totalConsumption: totalConsumption * 0.4, // Placeholder split - adjust based on actual API
          onlineDevices: customersArray.length,
          offlineDevices: 0,
        },
      },
    })
  );

  window.dispatchEvent(
    new CustomEvent('myio:water-data-ready', {
      detail: {
        source: 'WATER_STORES',
        data: {
          totalDevices: customersArray.length,
          totalConsumption: totalConsumption * 0.6, // Placeholder split - adjust based on actual API
          onlineDevices: customersArray.length,
          offlineDevices: 0,
        },
      },
    })
  );

  //LogHelper.log('[MAIN] RFC-0087: Water data dispatched to widgets, total:', totalConsumption);
}

// ===== RFC: Listen for request to update water consumption =====
window.addEventListener('myio:request-total-water-consumption', async (ev) => {
  //LogHelper.log('[MAIN] Received myio:request-total-water-consumption:', ev.detail);

  const { customersArray, startDateISO, endDateISO } = ev.detail || {};

  if (!customersArray || !startDateISO || !endDateISO) {
    LogHelper.warn('[MAIN] Invalid parameters for updateTotalWaterConsumption');
    return;
  }

  await updateTotalWaterConsumption(customersArray, startDateISO, endDateISO);
});

self.onInit = async function () {
  // ===== STEP 1: Get ThingsBoard Customer ID and fetch credentials =====
  CUSTOMER_ID_TB = self.ctx.settings.customerId;
  self.ctx.$scope.mainContentStateId = 'content_equipments';

  if (!CUSTOMER_ID_TB) {
    console.error('[MAIN] [Orchestrator] customerId não encontrado em settings');
    return;
  }

  // Expor customerId globalmente para outros widgets (ex: MENU)
  window.myioHoldingCustomerId = CUSTOMER_ID_TB;

  LogHelper.log('[MAIN] [Orchestrator] ThingsBoard Customer ID:', CUSTOMER_ID_TB);

  // Fetch customer attributes from ThingsBoard
  const customerAttrs = await fetchCustomerServerScopeAttrs(CUSTOMER_ID_TB);

  CUSTOMER_INGESTION_ID = customerAttrs.customerIngestionId || customerAttrs.ingestionId;
  CLIENT_ID_INGESTION = customerAttrs.clientIdIngestion || customerAttrs.client_id;
  CLIENT_SECRET_INGESTION = customerAttrs.clientSecretIngestion || customerAttrs.client_secret;

  if (!CUSTOMER_INGESTION_ID || !CLIENT_ID_INGESTION || !CLIENT_SECRET_INGESTION) {
    console.error('[MAIN] [Orchestrator] Credenciais de Ingestion não encontradas:', {
      customerIngestionId: CUSTOMER_INGESTION_ID,
      hasClientId: !!CLIENT_ID_INGESTION,
      hasClientSecret: !!CLIENT_SECRET_INGESTION,
    });
    return;
  }

  LogHelper.log('[MAIN] [Orchestrator] Ingestion credentials loaded:', {
    customerIngestionId: CUSTOMER_INGESTION_ID,
    clientId: CLIENT_ID_INGESTION,
  });

  // RFC-0058: Expose credentials globally for FOOTER widget
  window.__MYIO_CLIENT_ID__ = CLIENT_ID_INGESTION;
  window.__MYIO_CLIENT_SECRET__ = CLIENT_SECRET_INGESTION;
  window.__MYIO_CUSTOMER_INGESTION_ID__ = CUSTOMER_INGESTION_ID;
  // RFC-0086: DATA_API_HOST now comes from WELCOME widget

  // ===== STEP 2: Initialize MyIO Auth Component =====
  // Check if MyIOLibrary is available
  if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.buildMyioIngestionAuth) {
    console.error(
      '[MAIN] [Orchestrator] MyIOLibrary não está disponível. Verifique se a biblioteca foi carregada corretamente.'
    );
    return;
  }

  myIOAuth = MyIOLibrary.buildMyioIngestionAuth({
    dataApiHost: getDataApiHost(),
    clientId: CLIENT_ID_INGESTION,
    clientSecret: CLIENT_SECRET_INGESTION,
  });

  LogHelper.log('[MAIN] [Orchestrator] MyIO Auth initialized');

  // -- util: aplica no $scope e roda digest
  function applyParams(p) {
    self.ctx.$scope.startDateISO = p?.globalStartDateFilter || null;
    self.ctx.$scope.endDateISO = p?.globalEndDateFilter || null;
    if (self.ctx?.$scope?.$applyAsync) self.ctx.$scope.$applyAsync();
  }

  // -- util: espera até ter datas (evento + polling), sem bloquear
  function waitForDateParams({ pollMs = 300, timeoutMs = 15000 } = {}) {
    return new Promise((resolve) => {
      let resolved = false;
      let poller = null;
      let timer = null;

      const tryResolve = (p) => {
        const s = p?.globalStartDateFilter || null;
        const e = p?.globalEndDateFilter || null;
        if (s && e) {
          resolved = true;
          cleanup();
          applyParams(p);
          resolve({ start: s, end: e, from: 'state/event' });
          return true;
        }
        return false;
      };

      const onEvt = (ev) => {
        LogHelper.log('[MAIN] DATE-PARAMS', ev);
        tryResolve(ev.detail);
      };

      const cleanup = () => {
        window.removeEventListener('myio:date-params', onEvt);
        if (poller) clearInterval(poller);
        if (timer) clearTimeout(timer);
      };

      // 1) escuta evento do pai
      window.addEventListener('myio:date-params', onEvt);

      // 2) tenta estado atual imediatamente
      if (tryResolve(window.myioStateParams || {})) return;

      // 3) solicita explicitamente ao pai
      window.dispatchEvent(new CustomEvent('myio:request-date-params'));

      // 4) polling leve a cada 300ms
      poller = setInterval(() => {
        tryResolve(window.myioStateParams || {});
      }, pollMs);

      // 5) timeout de segurança -> usa fallback (últimos 7 dias)
      timer = setTimeout(() => {
        if (!resolved) {
          cleanup();
          // RFC: Fix - Usar início do dia (00:00:00) e fim do dia (23:59:59)
          const end = new Date();
          end.setHours(23, 59, 59, 999); // Fim do dia de hoje

          const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
          start.setHours(0, 0, 0, 0); // Início do dia 7 dias atrás

          const startISO = start.toISOString();
          const endISO = end.toISOString();
          applyParams({
            globalStartDateFilter: startISO,
            globalEndDateFilter: endISO,
          });
          resolve({ start: startISO, end: endISO, from: 'fallback-7d' });
        }
      }, timeoutMs);
    });
  }

  // ===== ORCHESTRATOR: Listen for date updates from MENU =====
  window.addEventListener('myio:update-date', async (ev) => {
    LogHelper.log('[MAIN] [Orchestrator] Date update received:', ev.detail);
    const { startDate, endDate } = ev.detail;

    if (startDate && endDate) {
      // Update scope
      applyParams({
        globalStartDateFilter: startDate,
        globalEndDateFilter: endDate,
      });

      // RFC: Deduplicação - só busca se não houver cache válido recente
      // Evita chamadas duplicadas quando MENU dispara evento E MAIN já fez fetch inicial
      if (CUSTOMER_INGESTION_ID) {
        const lastTimestamp = MyIOOrchestrator.getLastFetchTimestamp();
        const cacheAge = lastTimestamp ? Date.now() - lastTimestamp : Infinity;
        const CACHE_FRESHNESS_MS = 5000; // 5 segundos

        if (cacheAge > CACHE_FRESHNESS_MS) {
          LogHelper.log('[MAIN] [Orchestrator] Cache stale or missing, fetching data...');
          // Chamadas em sequência
          await MyIOOrchestrator.fetchEnergyData(CUSTOMER_INGESTION_ID, startDate, endDate);
          await MyIOOrchestrator.fetchWaterData(CUSTOMER_INGESTION_ID, startDate, endDate);
        } else {
          LogHelper.log(`[MAIN] [Orchestrator] Skipping fetch - cache is fresh (age: ${cacheAge}ms)`);
        }
      }
    }
  });

  window.addEventListener('myio:filter-params', (ev) => {
    LogHelper.log('[EQUIPAMENTS]filtro', ev.detail);
  });

  // RFC-0079: Listen for state switch requests from widgets (MENU, EQUIPMENTS sub-menu, etc.)
  window.addEventListener('myio:switch-main-state', (ev) => {
    LogHelper.log(`[MAIN] [RFC-0079] 🔔 Received myio:switch-main-state event:`, ev.detail);

    const targetStateId = ev.detail?.targetStateId;
    const source = ev.detail?.source || 'unknown';

    LogHelper.log(`[MAIN] [RFC-0079] State switch requested: ${targetStateId} (source: ${source})`);

    if (!targetStateId) {
      console.warn('[MAIN] [RFC-0079] ❌ No targetStateId provided in switch event');
      return;
    }

    const mainView = document.getElementById('mainView');
    if (!mainView) {
      console.error('[MAIN] [RFC-0079] ❌ mainView element not found');
      return;
    }

    LogHelper.log(`[MAIN] [RFC-0079] 📋 Found mainView element:`, mainView);

    // Hide all states
    const allStates = mainView.querySelectorAll('[data-content-state]');
    LogHelper.log(
      `[MAIN] [RFC-0079] 🔍 Found ${allStates.length} content states:`,
      Array.from(allStates).map((s) => s.getAttribute('data-content-state'))
    );

    allStates.forEach((stateDiv) => {
      const stateName = stateDiv.getAttribute('data-content-state');
      stateDiv.style.display = 'none';
      LogHelper.log(`[MAIN] [RFC-0079] 👁️ Hiding state: ${stateName}`);
    });

    // Show target state
    const targetState = mainView.querySelector(`[data-content-state="${targetStateId}"]`);
    LogHelper.log(
      `[MAIN] [RFC-0079] 🎯 Looking for state: ${targetStateId}`,
      targetState ? 'FOUND' : 'NOT FOUND'
    );

    if (targetState) {
      targetState.style.display = 'block';
      LogHelper.log(
        `[MAIN] [RFC-0079] ✅ Switched to state: ${targetStateId} (display: ${targetState.style.display})`
      );

      // Update scope if needed
      if (self.ctx?.$scope) {
        self.ctx.$scope.mainContentStateId = targetStateId;
        if (self.ctx.$scope.$applyAsync) {
          self.ctx.$scope.$applyAsync();
        }
        LogHelper.log(`[MAIN] [RFC-0079] 📝 Updated scope.mainContentStateId to: ${targetStateId}`);
      }
    } else {
      console.error(`[MAIN] [RFC-0079] ❌ Target state "${targetStateId}" not found in DOM`);
      LogHelper.log(
        `[MAIN] [RFC-0079] Available states:`,
        Array.from(allStates).map((s) => s.getAttribute('data-content-state'))
      );
    }
  });

  // ====== fluxo do widget ======
  // tenta aplicar o que já existir (não bloqueia)
  applyParams(window.myioStateParams || {});

  // garante sincronização inicial antes de continuar
  const datesFromParent = await waitForDateParams({
    pollMs: 300,
    timeoutMs: 15000,
  });

  LogHelper.log('[EQUIPMENTS] date params ready:', datesFromParent);

  // agora já pode carregar dados / inicializar UI dependente de datas
  if (typeof self.loadData === 'function') {
    await self.loadData(self.ctx.$scope.startDateISO, self.ctx.$scope.endDateISO);
  }

  //LogHelper.log("[EQUIPAMENTS] scope", scope.ctx)

  // mantém sincronizado em updates futuros do pai/irmão A
  self._onDateParams = (ev) => {
    applyParams(ev.detail);

    if (typeof self.loadData === 'function') {
      self.loadData(self.ctx.$scope.startDateISO, self.ctx.$scope.endDateISO);
    }
  };
  window.addEventListener('myio:date-params', self._onDateParams);

  // ===== ORCHESTRATOR: Initial setup =====
  LogHelper.log('[MAIN] [Orchestrator] Initial setup with Ingestion Customer ID:', CUSTOMER_INGESTION_ID);
  LogHelper.log('[MAIN] [Orchestrator] Date range:', {
    start: datesFromParent.start,
    end: datesFromParent.end,
  });

  // RFC: Removido fetch inicial - MENU sempre dispara myio:update-date no onInit
  // Isso evita chamadas duplicadas (MENU dispara evento → MAIN listener faz fetch)
  // Se precisar de dados imediatamente, o listener myio:update-date já cuidará disso

  LogHelper.log('[MAIN] [Orchestrator] Waiting for myio:update-date event from MENU to fetch data...');
};

self.onDestroy = function () {
  if (self._onDateParams) {
    window.removeEventListener('myio:date-params', self._onDateParams);
  }
};
