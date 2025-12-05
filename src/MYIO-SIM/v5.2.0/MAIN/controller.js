/* global self, window, document, localStorage, MyIOLibrary */

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
 * RFC-0094/RFC-0097: Fetch energy consumption for a customer within a time range
 * Used by ENERGY widget for chart and other consumption queries
 * @param {string} customerId - Customer ID for ingestion API
 * @param {number} startTs - Start timestamp in milliseconds
 * @param {number} endTs - End timestamp in milliseconds
 * @param {string} granularity - Data granularity: '1d' (day) or '1h' (hour). Default: '1d'
 * @returns {Promise<{devices: Array, total: number}>} - Devices list and total consumption
 */
async function fetchEnergyDayConsumption(customerId, startTs, endTs, granularity = '1d') {
  if (!customerId) {
    LogHelper.warn('[MAIN] fetchEnergyDayConsumption: Missing customerId');
    return { devices: [], total: 0 };
  }

  // Convert timestamps to ISO 8601 format with .000Z milliseconds (API requirement)
  const formatDateISO = (ts) => {
    const d = new Date(ts);
    d.setMilliseconds(0); // Zero out milliseconds for API compatibility
    return d.toISOString();
  };

  const startTimeISO = formatDateISO(startTs);
  const endTimeISO = formatDateISO(endTs);

  // RFC-0097: Use granularity parameter
  const url = `${getDataApiHost()}/api/v1/telemetry/customers/${customerId}/energy/?deep=1&granularity=${granularity}&startTime=${encodeURIComponent(
    startTimeISO
  )}&endTime=${encodeURIComponent(endTimeISO)}`;

  try {
    const TOKEN_INGESTION_EnergyDayConsumption = await myIOAuth.getToken();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TOKEN_INGESTION_EnergyDayConsumption}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      LogHelper.warn(`[MAIN] fetchEnergyDayConsumption: Failed with status ${response.status}`);
      return { devices: [], total: 0 };
    }

    const data = await response.json();

    // RFC-0097: API returns array directly, not { devices: [...] }
    // Format: [{ id, name, type, consumption: [{ timestamp, value }] }]
    const devices = Array.isArray(data) ? data : data?.devices || data?.data || [];
    let total = 0;

    if (Array.isArray(devices)) {
      devices.forEach((device) => {
        // Handle both formats: direct value or consumption array
        if (Array.isArray(device.consumption)) {
          device.consumption.forEach((entry) => {
            total += Number(entry.value) || 0;
          });
        } else {
          const value = device.total_value || device.value || 0;
          total += Number(value) || 0;
        }
      });
    }

    return { devices, total };
  } catch (error) {
    LogHelper.error('[MAIN] fetchEnergyDayConsumption: Error', error);
    return { devices: [], total: 0 };
  }
}

/**
 * Maps raw connection status to normalized status
 * @param {string} rawStatus - Raw status from ThingsBoard (e.g., 'ONLINE', 'ok', 'running', 'waiting', 'offline')
 * @returns {'online' | 'waiting' | 'offline'} - Normalized status
 */
function mapConnectionStatus(rawStatus) {
  const statusLower = String(rawStatus || '')
    .toLowerCase()
    .trim();

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
      .map(([_id, name]) => name)
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

  // RFC-0091: Skip extraction if deviceType is empty/invalid (avoids log spam)
  if (!deviceType || typeof deviceType !== 'string' || deviceType.trim() === '') {
    return null;
  }

  const telemetryConfig = powerLimitsJSON.limitsByInstantaneoustPowerType.find(
    (config) => config.telemetryType === telemetryType
  );

  if (!telemetryConfig) {
    LogHelper.log(`[RFC-0078] Telemetry type ${telemetryType} not found in JSON`);
    return null;
  }

  const deviceTypeUpper = deviceType.toUpperCase();
  const deviceConfig = telemetryConfig.itemsByDeviceType.find(
    (item) => item.deviceType === deviceType || item.deviceType === deviceTypeUpper
  );

  if (!deviceConfig) {
    // RFC-0091: Only log once per deviceType to avoid spam (use warn level for visibility)
    if (!extractLimitsFromJSON._warnedTypes) extractLimitsFromJSON._warnedTypes = new Set();
    if (!extractLimitsFromJSON._warnedTypes.has(deviceTypeUpper)) {
      extractLimitsFromJSON._warnedTypes.add(deviceTypeUpper);
      LogHelper.warn(`[RFC-0078] Device type "${deviceType}" not found for telemetry ${telemetryType}`);
    }
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
  //LogHelper.log(`[RFC-0078] Using HARDCODED defaults for ${deviceType} (TIER 3)`);
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
  consumptionEl.textContent =
    typeof MyIOLibrary !== 'undefined'
      ? MyIOLibrary.formatEnergy(totalConsumption)
      : formatEnergy(totalConsumption);
  zeroEl.textContent = zeroConsumptionCount.toString();

  LogHelper.log('[MAIN] Stats updated:', {
    connectivity: `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`,
    total: devices.length,
    consumptionFromOrchestrator: totalConsumption,
    zeroCount: zeroConsumptionCount,
  });
}

// ============================================
// RFC-0093: CENTRALIZED HEADER DEVICES GRID
// Reusable header component for EQUIPMENTS, STORES, WATER, TEMPERATURE widgets
// ============================================

/**
 * RFC-0093: Centralized CSS for header and filter modal
 * Injected once into document head
 */
const HEADER_AND_MODAL_CSS = `
/* ====== RFC-0093: CENTRALIZED HEADER STYLES ====== */
.equip-stats-header {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 16px;
  margin-bottom: 16px;
  border-bottom: 3px solid #cbd5e1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  width: 100%;
}

.equip-stats-header .stat-item {
  display: flex !important;
  flex-direction: column !important;
  gap: 2px;
  flex: 1;
  min-width: 0;
  text-align: center;
}

.equip-stats-header .stat-item.highlight {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-radius: 8px;
  padding: 6px 12px;
  border: 1px solid #93c5fd;
}

.equip-stats-header .stat-label {
  font-size: 12px;
  color: #6b7a90;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.equip-stats-header .stat-value {
  font-size: 16px;
  color: #1c2743;
  font-weight: 700;
}

.equip-stats-header .stat-item.highlight .stat-value {
  color: #1d4ed8;
  font-size: 20px;
}

/* ====== FILTER ACTIONS ====== */
.equip-stats-header .filter-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: auto;
}

.equip-stats-header .search-wrap {
  position: relative;
  width: 0;
  overflow: hidden;
  transition: width 0.3s ease;
}

.equip-stats-header .search-wrap.active {
  width: 200px;
}

.equip-stats-header .search-wrap input {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid #dde7f1;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
}

.equip-stats-header .search-wrap input:focus {
  border-color: #1f6fb5;
  box-shadow: 0 0 0 2px rgba(31, 111, 181, 0.1);
}

.equip-stats-header .icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #dde7f1;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.equip-stats-header .icon-btn:hover {
  background: #f8f9fa;
  border-color: #1f6fb5;
}

.equip-stats-header .icon-btn svg {
  fill: #1c2743;
}

/* ====== RFC-0090: CENTRALIZED FILTER MODAL STYLES ====== */
.myio-filter-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
  backdrop-filter: blur(4px);
  left: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  animation: myioFadeIn 0.2s ease-in;
}

.myio-filter-modal.hidden {
  display: none;
}

.myio-filter-modal-card {
  background: #fff;
  border-radius: 0;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: none;
  overflow: hidden;
}

@media (min-width: 768px) {
  .myio-filter-modal-card {
    border-radius: 16px;
    width: 90%;
    max-width: 900px;
    height: auto;
    max-height: 90vh;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
}

.myio-filter-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #dde7f1;
}

.myio-filter-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1c2743;
}

.myio-filter-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.myio-filter-modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid #dde7f1;
}

/* Filter Blocks */
.myio-filter-modal .filter-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.myio-filter-modal .block-label {
  font-size: 14px;
  font-weight: 600;
  color: #1c2743;
}

.myio-filter-modal .filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.myio-filter-modal .filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #dde7f1;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: #6b7a90;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.myio-filter-modal .filter-tab:hover {
  background: #f8f9fa;
  border-color: #1f6fb5;
  color: #1f6fb5;
}

.myio-filter-modal .filter-tab.active {
  background: rgba(31, 111, 181, 0.1);
  border-color: #1f6fb5;
  color: #1f6fb5;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(31, 111, 181, 0.15);
}

.myio-filter-modal .filter-search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #dde7f1;
  border-radius: 8px;
  padding: 8px 12px;
}

.myio-filter-modal .filter-search svg {
  width: 18px;
  height: 18px;
  fill: #6b7a90;
}

.myio-filter-modal .filter-search input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
}

.myio-filter-modal .filter-search .clear-x {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.myio-filter-modal .filter-search .clear-x:hover {
  opacity: 1;
}

/* Checklist */
.myio-filter-modal .checklist {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #dde7f1;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.myio-filter-modal .check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.myio-filter-modal .check-item:hover {
  background: #f8f9fa;
}

.myio-filter-modal .check-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.myio-filter-modal .check-item label,
.myio-filter-modal .check-item span {
  flex: 1;
  cursor: pointer;
  font-size: 13px;
  color: #1c2743;
}

/* Radio Grid */
.myio-filter-modal .radio-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.myio-filter-modal .radio-grid label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid #dde7f1;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.myio-filter-modal .radio-grid label:hover {
  background: #f8f9fa;
  border-color: #1f6fb5;
}

.myio-filter-modal .radio-grid input[type="radio"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.myio-filter-modal .muted {
  font-size: 12px;
  color: #6b7a90;
  margin: 0;
}

/* Buttons */
.myio-filter-modal .btn {
  padding: 10px 20px;
  border: 1px solid #dde7f1;
  background: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.myio-filter-modal .btn:hover {
  background: #f8f9fa;
}

.myio-filter-modal .btn.primary {
  background: #1f6fb5;
  color: #fff;
  border-color: #1f6fb5;
}

.myio-filter-modal .btn.primary:hover {
  background: #1a5a8f;
  border-color: #1a5a8f;
}

.myio-filter-modal .icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #dde7f1;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.myio-filter-modal .icon-btn:hover {
  background: #f8f9fa;
  border-color: #1f6fb5;
}

.myio-filter-modal .icon-btn svg {
  fill: #1c2743;
}

@keyframes myioFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Prevent body scroll when modal is open */
body.filter-modal-open {
  overflow: hidden !important;
}
`;

let headerAndModalCssInjected = false;

// RFC: Accumulator for water widget consumption totals
// The HEADER should show the sum of actual widgets (WATER_COMMON_AREA + WATER_STORES),
// NOT all devices from the API cache (which may include devices not in any widget)
const waterWidgetConsumption = {
  waterCommonArea: 0,
  waterStores: 0,
};

/**
 * Get total water consumption from widgets (not from API cache)
 * @returns {number} Total water consumption from WATER_COMMON_AREA + WATER_STORES
 */
function getTotalWaterConsumptionFromWidgets() {
  return waterWidgetConsumption.waterCommonArea + waterWidgetConsumption.waterStores;
}

// Expose globally for HEADER to use
window.MyIOUtils = window.MyIOUtils || {};
window.MyIOUtils.getTotalWaterConsumptionFromWidgets = getTotalWaterConsumptionFromWidgets;

/**
 * Inject centralized CSS for header and modal (once)
 */
function injectHeaderAndModalCSS() {
  if (headerAndModalCssInjected) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'myio-header-modal-css';
  styleEl.textContent = HEADER_AND_MODAL_CSS;
  document.head.appendChild(styleEl);

  headerAndModalCssInjected = true;
  LogHelper.log('[MAIN] RFC-0093: Centralized header and modal CSS injected');
}

/**
 * Configuration for header labels per domain
 */
const HEADER_DOMAIN_CONFIG = {
  energy: {
    totalLabel: 'Total de Equipamentos',
    consumptionLabel: 'Consumo Total',
    zeroLabel: 'Sem Consumo',
    formatValue: (val) =>
      typeof MyIOLibrary !== 'undefined' ? MyIOLibrary.formatEnergy(val) : `${val.toFixed(2)} kWh`,
  },
  stores: {
    totalLabel: 'Total de Lojas',
    consumptionLabel: 'Consumo Total',
    zeroLabel: 'Sem Consumo',
    formatValue: (val) =>
      typeof MyIOLibrary !== 'undefined' ? MyIOLibrary.formatEnergy(val) : `${val.toFixed(2)} kWh`,
  },
  water: {
    totalLabel: 'Total de Hidrômetros',
    consumptionLabel: 'Consumo Total',
    zeroLabel: 'Sem Consumo',
    formatValue: (val) =>
      typeof MyIOLibrary !== 'undefined' ? MyIOLibrary.formatWaterVolumeM3(val) : `${val.toFixed(2)} m³`,
  },
  temperature: {
    totalLabel: 'Total de Sensores',
    consumptionLabel: 'Média de Temperatura',
    zeroLabel: 'Sem Leitura',
    formatValue: (val) =>
      typeof MyIOLibrary !== 'undefined' ? MyIOLibrary.formatTemperature(val) : `${val.toFixed(1)}°C`,
  },
};

/**
 * Build and inject a centralized header for device grids
 * @param {Object} config - Configuration object
 * @param {HTMLElement|string} config.container - Container element or selector to inject header
 * @param {string} config.domain - Domain type: 'energy', 'stores', 'water', 'temperature'
 * @param {string} config.idPrefix - ID prefix for elements (e.g., 'equip', 'stores', 'water', 'temp')
 * @param {Object} [config.labels] - Optional custom labels override
 * @param {string} [config.labels.connectivity] - Custom connectivity label (default: 'Conectividade')
 * @param {string} [config.labels.total] - Custom total label
 * @param {string} [config.labels.consumption] - Custom consumption label
 * @param {string} [config.labels.zero] - Custom zero/no-data label
 * @param {boolean} [config.includeSearch=true] - Include search button
 * @param {boolean} [config.includeFilter=true] - Include filter button
 * @param {Function} [config.onSearchClick] - Callback for search button click
 * @param {Function} [config.onFilterClick] - Callback for filter button click
 * @returns {Object} Controller object with update methods
 */
function buildHeaderDevicesGrid(config) {
  // RFC-0093: Inject CSS once
  injectHeaderAndModalCSS();

  const {
    container,
    domain = 'energy',
    idPrefix = 'devices',
    labels = {},
    includeSearch = true,
    includeFilter = true,
    onSearchClick,
    onFilterClick,
  } = config;

  // Get container element
  const containerEl = typeof container === 'string' ? document.querySelector(container) : container;
  if (!containerEl) {
    LogHelper.error('[MAIN] buildHeaderDevicesGrid: Container not found');
    return null;
  }

  // Get domain config with fallback
  const domainConfig = HEADER_DOMAIN_CONFIG[domain] || HEADER_DOMAIN_CONFIG.energy;

  // Merge labels with domain defaults
  const finalLabels = {
    connectivity: labels.connectivity || 'Conectividade',
    total: labels.total || domainConfig.totalLabel,
    consumption: labels.consumption || domainConfig.consumptionLabel,
    zero: labels.zero || domainConfig.zeroLabel,
  };

  // Generate unique IDs
  const ids = {
    header: `${idPrefix}StatsHeader`,
    connectivity: `${idPrefix}StatsConnectivity`,
    total: `${idPrefix}StatsTotal`,
    consumption: `${idPrefix}StatsConsumption`,
    zero: `${idPrefix}StatsZero`,
    searchWrap: `${idPrefix}SearchWrap`,
    searchInput: `${idPrefix}Search`,
    btnSearch: `${idPrefix}BtnSearch`,
    btnFilter: `${idPrefix}BtnFilter`,
  };

  // Build HTML
  const searchButtonHTML = includeSearch
    ? `
    <button class="icon-btn" id="${ids.btnSearch}" title="Buscar" aria-label="Buscar">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5z"/>
      </svg>
    </button>`
    : '';

  const filterButtonHTML = includeFilter
    ? `
    <button class="icon-btn" id="${ids.btnFilter}" title="Filtros" aria-label="Filtros">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/>
      </svg>
    </button>`
    : '';

  const headerHTML = `
    <div class="equip-stats-header" id="${ids.header}" style="display: flex !important; flex-direction: row !important;">
      <div class="stat-item">
        <span class="stat-label">${finalLabels.connectivity}</span>
        <span class="stat-value" id="${ids.connectivity}">-</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">${finalLabels.total}</span>
        <span class="stat-value" id="${ids.total}">-</span>
      </div>
      <div class="stat-item highlight">
        <span class="stat-label">${finalLabels.consumption}</span>
        <span class="stat-value" id="${ids.consumption}">-</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">${finalLabels.zero}</span>
        <span class="stat-value" id="${ids.zero}">-</span>
      </div>
      <div class="filter-actions">
        <div class="search-wrap" id="${ids.searchWrap}">
          <input type="text" id="${ids.searchInput}" placeholder="Buscar..." autocomplete="off">
        </div>
        ${searchButtonHTML}
        ${filterButtonHTML}
      </div>
    </div>
  `;

  // Inject HTML
  containerEl.insertAdjacentHTML('afterbegin', headerHTML);

  // Setup event listeners
  if (includeSearch && onSearchClick) {
    const btnSearch = document.getElementById(ids.btnSearch);
    const searchWrap = document.getElementById(ids.searchWrap);
    if (btnSearch) {
      btnSearch.addEventListener('click', () => {
        if (searchWrap) {
          searchWrap.classList.toggle('active');
          if (searchWrap.classList.contains('active')) {
            const input = document.getElementById(ids.searchInput);
            if (input) input.focus();
          }
        }
        onSearchClick();
      });
    }
  }

  if (includeFilter && onFilterClick) {
    const btnFilter = document.getElementById(ids.btnFilter);
    if (btnFilter) {
      btnFilter.addEventListener('click', onFilterClick);
    }
  }

  // Return controller object
  const controller = {
    ids,
    domain,
    domainConfig,

    /**
     * Update header statistics
     * @param {Object} stats - Statistics object
     * @param {number} stats.online - Number of online devices
     * @param {number} stats.total - Total number of devices
     * @param {number} stats.consumption - Total consumption value
     * @param {number} stats.zeroCount - Number of devices with zero consumption
     */
    updateStats(stats) {
      const { online = 0, total = 0, consumption = 0, zeroCount = 0 } = stats;

      const connectivityEl = document.getElementById(ids.connectivity);
      const totalEl = document.getElementById(ids.total);
      const consumptionEl = document.getElementById(ids.consumption);
      const zeroEl = document.getElementById(ids.zero);

      if (!connectivityEl || !totalEl || !consumptionEl || !zeroEl) {
        LogHelper.warn(`[MAIN] buildHeaderDevicesGrid: Stats elements not found for ${idPrefix}`);
        return;
      }

      const percentage = total > 0 ? ((online / total) * 100).toFixed(1) : '0.0';

      connectivityEl.textContent = `${online}/${total} (${percentage}%)`;
      totalEl.textContent = total.toString();
      consumptionEl.textContent = domainConfig.formatValue(consumption);
      zeroEl.textContent = zeroCount.toString();

      // RFC: Update water widget consumption accumulator for HEADER
      if (domain === 'water' && idPrefix in waterWidgetConsumption) {
        waterWidgetConsumption[idPrefix] = consumption;
        LogHelper.log(
          `[MAIN] Water widget consumption updated: ${idPrefix} = ${consumption}, total = ${getTotalWaterConsumptionFromWidgets()}`
        );
      }

      LogHelper.log(`[MAIN] Header stats updated for ${idPrefix}:`, stats);
    },

    /**
     * Calculate and update stats from devices array
     * @param {Array} devices - Array of device objects
     * @param {Object} [options] - Options
     * @param {Map} [options.cache] - Energy/consumption cache
     * @param {Array} [options.ctxData] - ThingsBoard ctx.data for connection status
     */
    updateFromDevices(devices, options = {}) {
      const { cache, ctxData } = options;

      // Calculate online count from ctxData if available
      let online = 0;
      let totalWithStatus = 0;

      if (ctxData && Array.isArray(ctxData)) {
        const deviceMap = new Map();
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

        devices.forEach((device) => {
          const deviceData = deviceMap.get(device.entityId);
          if (deviceData && deviceData.hasConnectionStatus) {
            totalWithStatus++;
            if (deviceData.isOnline) online++;
          }
        });
      } else {
        // Fallback: count based on device status or consumption
        devices.forEach((device) => {
          const status = (device.connectionStatus || device.deviceStatus || '').toLowerCase();
          if (status === 'online' || status === 'power_on' || status === 'normal') {
            online++;
          }
        });
        totalWithStatus = devices.length;
      }

      // Calculate consumption
      let totalConsumption = 0;
      let zeroCount = 0;

      devices.forEach((device) => {
        let consumption = 0;

        // Try cache first
        if (cache && device.ingestionId) {
          const cached = cache.get(device.ingestionId);
          if (cached) {
            consumption = Number(cached.total_value) || 0;
          }
        }

        // Fallback to device value
        if (consumption === 0) {
          consumption = Number(device.val) || Number(device.value) || Number(device.lastValue) || 0;
        }

        totalConsumption += consumption;
        if (consumption === 0) zeroCount++;
      });

      this.updateStats({
        online,
        total: devices.length,
        consumption: totalConsumption,
        zeroCount,
      });
    },

    /**
     * Get search input element
     * @returns {HTMLInputElement|null}
     */
    getSearchInput() {
      return document.getElementById(ids.searchInput);
    },

    /**
     * Toggle search wrap visibility
     * @param {boolean} [active] - Force state
     */
    toggleSearch(active) {
      const searchWrap = document.getElementById(ids.searchWrap);
      if (searchWrap) {
        if (active !== undefined) {
          searchWrap.classList.toggle('active', active);
        } else {
          searchWrap.classList.toggle('active');
        }
      }
    },

    /**
     * Destroy the header (remove from DOM)
     */
    destroy() {
      const header = document.getElementById(ids.header);
      if (header) header.remove();
    },
  };

  LogHelper.log(`[MAIN] Header built for domain '${domain}' with prefix '${idPrefix}'`);

  return controller;
}

/**
 * Find a value in an array of objects by key/dataType
 * RFC-0091: Supports both ThingsBoard format {dataType, value} and generic {key, value}
 * @param {Array} values - Array of objects with key/value or dataType/value properties
 * @param {string} key - Key or dataType to search for
 * @param {*} defaultValue - Default value if not found
 * @returns {*} The found value or defaultValue
 */
function findValue(values, key, defaultValue = null) {
  if (!Array.isArray(values)) return defaultValue;
  // RFC-0091: Support both { key, value } and { dataType, value } formats
  const found = values.find((v) => v.key === key || v.dataType === key);
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

// ============================================
// RFC-0090: SHARED FILTER MODAL FACTORY
// Creates reusable filter modal for EQUIPMENTS and STORES widgets
// ============================================

/**
 * Factory function to create a filter modal with customizable filter tabs
 * @param {Object} config - Modal configuration
 * @param {string} config.widgetName - Widget identifier (e.g., 'EQUIPMENTS', 'STORES')
 * @param {string} config.containerId - Global container ID (e.g., 'equipmentsFilterModalGlobal')
 * @param {string} config.modalClass - CSS class for modal (e.g., 'equip-modal', 'shops-modal')
 * @param {string} config.primaryColor - Primary theme color (e.g., '#2563eb', '#3E1A7D')
 * @param {string} config.itemIdAttr - Data attribute for item ID (e.g., 'data-device-id', 'data-entity')
 * @param {Array} config.filterTabs - Array of filter tab configurations
 * @param {Function} config.getItemId - Function to get item ID from item object
 * @param {Function} config.getItemLabel - Function to get item label from item object
 * @param {Function} config.getItemValue - Function to get item consumption value
 * @param {Function} config.getItemSubLabel - Function to get secondary label (shopping name)
 * @param {Function} config.formatValue - Function to format consumption value
 * @param {Function} config.onApply - Callback when filters are applied
 * @param {Function} config.onReset - Callback when filters are reset
 * @param {Function} config.onClose - Callback when modal is closed
 * @returns {Object} Modal controller with open, close, and destroy methods
 */
function createFilterModal(config) {
  // RFC-0093: Inject centralized header and modal CSS
  injectHeaderAndModalCSS();

  const {
    widgetName = 'WIDGET',
    containerId,
    modalClass = 'filter-modal',
    primaryColor = '#2563eb',
    itemIdAttr = 'data-item-id',
    filterTabs = [],
    getItemId = (item) => item.id,
    getItemLabel = (item) => item.label || item.name,
    getItemValue = (item) => Number(item.value) || 0,
    getItemSubLabel = () => '',
    formatValue = (val) => val.toFixed(2),
    onApply = () => {},
    onReset = () => {},
    onClose = () => {},
  } = config;

  let globalContainer = null;
  let escHandler = null;

  // Generate CSS styles with customizable primary color
  function generateStyles() {
    return `
      /* RFC-0090: Shared Filter Modal Styles for ${widgetName} */
      #${containerId} .${modalClass} {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        backdrop-filter: blur(4px);
        animation: filterModalFadeIn 0.2s ease-in;
      }

      #${containerId} .${modalClass}.hidden {
        display: none;
      }

      #${containerId} .${modalClass}-card {
        background: #fff;
        border-radius: 0;
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        display: flex;
        flex-direction: column;
        box-shadow: none;
        overflow: hidden;
      }

      @media (min-width: 768px) {
        #${containerId} .${modalClass}-card {
          border-radius: 16px;
          width: 90%;
          max-width: 1000px;
          height: auto;
          max-height: 90vh;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
      }

      #${containerId} .${modalClass}-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #DDE7F1;
      }

      #${containerId} .${modalClass}-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: #1C2743;
      }

      #${containerId} .${modalClass}-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      #${containerId} .${modalClass}-footer {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        padding: 16px 20px;
        border-top: 1px solid #DDE7F1;
      }

      #${containerId} .filter-block {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      #${containerId} .block-label {
        font-size: 14px;
        font-weight: 600;
        color: #1C2743;
      }

      #${containerId} .filter-tabs {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 12px;
        padding-bottom: 10px;
        border-bottom: 2px solid #E6EEF5;
      }

      #${containerId} .filter-tab {
        border: 1px solid #DDE7F1;
        background: #fff;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.2px;
        cursor: pointer;
        transition: all 0.2s;
        color: #6b7a90;
        white-space: nowrap;
      }

      #${containerId} .filter-tab:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      }

      /* RFC-0095: Color-coded filter tabs */
      #${containerId} .filter-tab[data-filter="all"] {
        border-color: #9ca3af;
        color: #4b5563;
      }
      #${containerId} .filter-tab[data-filter="all"]:hover,
      #${containerId} .filter-tab[data-filter="all"].active {
        background: #6b7280;
        border-color: #6b7280;
        color: #fff;
      }

      #${containerId} .filter-tab[data-filter="online"] {
        border-color: #3b82f6;
        color: #2563eb;
      }
      #${containerId} .filter-tab[data-filter="online"]:hover,
      #${containerId} .filter-tab[data-filter="online"].active {
        background: #3b82f6;
        border-color: #3b82f6;
        color: #fff;
      }

      #${containerId} .filter-tab[data-filter="offline"] {
        border-color: #ef4444;
        color: #dc2626;
      }
      #${containerId} .filter-tab[data-filter="offline"]:hover,
      #${containerId} .filter-tab[data-filter="offline"].active {
        background: #ef4444;
        border-color: #ef4444;
        color: #fff;
      }

      #${containerId} .filter-tab[data-filter="withConsumption"] {
        border-color: #22c55e;
        color: #16a34a;
      }
      #${containerId} .filter-tab[data-filter="withConsumption"]:hover,
      #${containerId} .filter-tab[data-filter="withConsumption"].active {
        background: #22c55e;
        border-color: #22c55e;
        color: #fff;
      }

      #${containerId} .filter-tab[data-filter="noConsumption"] {
        border-color: #9ca3af;
        color: #6b7280;
      }
      #${containerId} .filter-tab[data-filter="noConsumption"]:hover,
      #${containerId} .filter-tab[data-filter="noConsumption"].active {
        background: #9ca3af;
        border-color: #9ca3af;
        color: #fff;
      }

      #${containerId} .filter-tab span {
        font-weight: 700;
      }

      #${containerId} .filter-search {
        position: relative;
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }

      #${containerId} .filter-search svg {
        position: absolute;
        left: 10px;
        width: 14px;
        height: 14px;
        fill: #6b7a90;
        pointer-events: none;
      }

      #${containerId} .filter-search input {
        width: 100%;
        padding: 8px 32px 8px 32px;
        border: 1px solid #DDE7F1;
        border-radius: 8px;
        font-size: 12px;
        outline: none;
        box-sizing: border-box;
      }

      #${containerId} .filter-search input:focus {
        border-color: ${primaryColor};
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
      }

      #${containerId} .filter-search .clear-x {
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        border: 0;
        background: #f3f4f6;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      #${containerId} .filter-search .clear-x:hover {
        background: #e5e7eb;
      }

      #${containerId} .filter-search .clear-x svg {
        position: static;
        width: 12px;
        height: 12px;
        fill: #6b7280;
      }

      /* RFC-0093: Inline actions (Select All / Clear) */
      #${containerId} .inline-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }

      #${containerId} .tiny-btn {
        padding: 6px 12px;
        border: 1px solid #DDE7F1;
        border-radius: 6px;
        background: #fff;
        font-size: 12px;
        font-weight: 500;
        color: #1C2743;
        cursor: pointer;
        transition: all 0.2s;
      }

      #${containerId} .tiny-btn:hover {
        background: #f0f4f8;
        border-color: ${primaryColor};
        color: ${primaryColor};
      }

      #${containerId} .tiny-btn:active {
        background: #e0e8f0;
      }

      #${containerId} .checklist {
        min-height: 120px;
        max-height: 340px;
        overflow-y: auto;
        border: 1px solid #DDE7F1;
        border-radius: 8px;
        padding: 4px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      #${containerId} .check-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 6px;
        border-radius: 4px;
        transition: background 0.2s;
      }

      #${containerId} .check-item:hover {
        background: #f8f9fa;
      }

      #${containerId} .check-item input[type="checkbox"] {
        width: 14px;
        height: 14px;
        cursor: pointer;
        flex-shrink: 0;
      }

      #${containerId} .check-item label {
        flex: 1;
        cursor: pointer;
        font-size: 11px;
        color: #1C2743;
        line-height: 1.3;
      }

      #${containerId} .check-item .item-sublabel {
        font-size: 9px;
        color: #6b7a90;
        margin-left: auto;
        flex-shrink: 0;
      }

      #${containerId} .radio-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }

      #${containerId} .radio-grid label {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        border: 1px solid #DDE7F1;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 11px;
        color: #1C2743;
      }

      #${containerId} .radio-grid label:hover {
        background: #f8f9fa;
        border-color: ${primaryColor};
      }

      #${containerId} .radio-grid input[type="radio"] {
        width: 12px;
        height: 12px;
        cursor: pointer;
        flex-shrink: 0;
      }

      #${containerId} .radio-grid input[type="radio"]:checked + span,
      #${containerId} .radio-grid label:has(input:checked) {
        background: rgba(37, 99, 235, 0.08);
        border-color: ${primaryColor};
        color: ${primaryColor};
        font-weight: 600;
      }

      #${containerId} .btn {
        padding: 10px 16px;
        border: 1px solid #DDE7F1;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      #${containerId} .btn:hover {
        background: #f8f9fa;
      }

      #${containerId} .btn.primary {
        background: ${primaryColor};
        color: #fff;
        border-color: ${primaryColor};
      }

      #${containerId} .btn.primary:hover {
        filter: brightness(0.9);
      }

      #${containerId} .icon-btn {
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background 0.2s;
      }

      #${containerId} .icon-btn:hover {
        background: #f0f0f0;
      }

      #${containerId} .icon-btn svg {
        width: 18px;
        height: 18px;
        fill: #1C2743;
      }

      @keyframes filterModalFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      body.filter-modal-open {
        overflow: hidden !important;
      }
    `;
  }

  // Generate filter tabs HTML
  function generateFilterTabsHTML(counts) {
    return filterTabs
      .map(
        (tab) => `
        <button class="filter-tab${tab.id === 'all' ? ' active' : ''}" data-filter="${tab.id}">
          ${tab.label} (<span id="count${tab.id.charAt(0).toUpperCase() + tab.id.slice(1)}">${
          counts[tab.id] || 0
        }</span>)
        </button>
      `
      )
      .join('');
  }

  // Generate modal HTML
  function generateModalHTML() {
    return `
      <div id="filterModal" class="${modalClass} hidden">
        <div class="${modalClass}-card">
          <div class="${modalClass}-header">
            <h3>Filtrar e Ordenar</h3>
            <button class="icon-btn" id="closeFilter">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
          <div class="${modalClass}-body">
            <!-- Filter Tabs -->
            <div class="filter-block">
              <div class="filter-tabs" id="filterTabsContainer"></div>
            </div>

            <!-- Search -->
            <div class="filter-block">
              <div class="filter-search">
                <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input type="text" id="filterDeviceSearch" placeholder="Buscar...">
                <button class="clear-x" id="filterDeviceClear">
                  <svg width="14" height="14" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="#6b7a90"/></svg>
                </button>
              </div>
              <!-- RFC-0093: Select All / Clear Selection buttons -->
              <div class="inline-actions" style="margin-bottom: 8px;">
                <button class="tiny-btn" id="selectAllItems">Selecionar Todos</button>
                <button class="tiny-btn" id="clearAllItems">Limpar Seleção</button>
              </div>
              <div class="checklist" id="deviceChecklist"></div>
            </div>

            <!-- Sort Options -->
            <div class="filter-block">
              <span class="block-label">Ordenar por</span>
              <div class="radio-grid">
                <label><input type="radio" name="sortMode" value="cons_desc" checked> Maior consumo</label>
                <label><input type="radio" name="sortMode" value="cons_asc"> Menor consumo</label>
                <label><input type="radio" name="sortMode" value="alpha_asc"> Nome A → Z</label>
                <label><input type="radio" name="sortMode" value="alpha_desc"> Nome Z → A</label>
                <label><input type="radio" name="sortMode" value="status_asc"> Status A → Z</label>
                <label><input type="radio" name="sortMode" value="status_desc"> Status Z → A</label>
                <label><input type="radio" name="sortMode" value="shopping_asc"> Shopping A → Z</label>
                <label><input type="radio" name="sortMode" value="shopping_desc"> Shopping Z → A</label>
              </div>
            </div>
          </div>
          <div class="${modalClass}-footer">
            <button class="btn" id="resetFilters">Fechar</button>
            <button class="btn primary" id="applyFilters">Ordenar</button>
          </div>
        </div>
      </div>
    `;
  }

  // Setup event handlers
  function setupHandlers(modal, items, _state) {
    // Close button
    const closeBtn = modal.querySelector('#closeFilter');
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }

    // Backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        close();
      }
    });

    // Apply filters
    const applyBtn = modal.querySelector('#applyFilters');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const checkboxes = modal.querySelectorAll(`#deviceChecklist input[type='checkbox']:checked`);
        const selectedSet = new Set();
        checkboxes.forEach((cb) => {
          const itemId = cb.getAttribute(itemIdAttr);
          if (itemId) selectedSet.add(itemId);
        });

        const sortRadio = modal.querySelector('input[name="sortMode"]:checked');
        const sortMode = sortRadio ? sortRadio.value : 'cons_desc';

        LogHelper.log(`[${widgetName}] Filters applied:`, {
          selectedCount: selectedSet.size,
          totalItems: items.length,
          sortMode,
        });

        onApply({
          selectedIds: selectedSet.size === items.length ? null : selectedSet,
          sortMode,
        });

        close();
      });
    }

    // RFC-0095: Close button (renamed from Reset Filters)
    const resetBtn = modal.querySelector('#resetFilters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        LogHelper.log(`[${widgetName}] Modal closed`);
        close();
      });
    }

    // RFC-0093: Select All button
    const selectAllBtn = modal.querySelector('#selectAllItems');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        const checkboxes = modal.querySelectorAll(`#deviceChecklist input[type='checkbox']`);
        checkboxes.forEach((cb) => {
          cb.checked = true;
        });
        LogHelper.log(`[${widgetName}] All items selected: ${checkboxes.length}`);
      });
    }

    // RFC-0093: Clear Selection button
    const clearAllBtn = modal.querySelector('#clearAllItems');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        const checkboxes = modal.querySelectorAll(`#deviceChecklist input[type='checkbox']`);
        checkboxes.forEach((cb) => {
          cb.checked = false;
        });
        LogHelper.log(`[${widgetName}] All items cleared`);
      });
    }

    // Filter tabs
    const filterTabsEl = modal.querySelectorAll('.filter-tab');
    filterTabsEl.forEach((tab) => {
      tab.addEventListener('click', () => {
        const filterType = tab.getAttribute('data-filter');

        // Update active state
        filterTabsEl.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');

        // Apply filter to checkboxes
        const checkboxes = modal.querySelectorAll(`#deviceChecklist input[type='checkbox']`);
        checkboxes.forEach((cb) => {
          const itemId = cb.getAttribute(itemIdAttr);
          const item = items.find((i) => getItemId(i) === itemId);

          if (!item) return;

          // Find the filter function for this tab
          const tabConfig = filterTabs.find((t) => t.id === filterType);
          cb.checked = tabConfig ? tabConfig.filter(item) : true;
        });

        const checkedCount = Array.from(checkboxes).filter((cb) => cb.checked).length;
        LogHelper.log(
          `[${widgetName}] Filter tab: ${filterType}, checked: ${checkedCount}/${checkboxes.length}`
        );
      });
    });

    // Search inside modal
    const searchInput = modal.querySelector('#filterDeviceSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = (e.target.value || '').trim().toLowerCase();
        const checkItems = modal.querySelectorAll('#deviceChecklist .check-item');

        checkItems.forEach((item) => {
          const label = item.querySelector('label');
          const text = (label?.textContent || '').toLowerCase();
          item.style.display = text.includes(query) ? 'flex' : 'none';
        });
      });
    }

    // Clear search
    const clearBtn = modal.querySelector('#filterDeviceClear');
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        const checkItems = modal.querySelectorAll('#deviceChecklist .check-item');
        checkItems.forEach((item) => (item.style.display = 'flex'));
        searchInput.focus();
      });
    }

    // ESC key handler
    escHandler = (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        close();
      }
    };
    document.addEventListener('keydown', escHandler);

    LogHelper.log(`[${widgetName}] Modal handlers bound`);
  }

  // Calculate counts for each filter tab
  function calculateCounts(items) {
    const counts = {};
    filterTabs.forEach((tab) => {
      counts[tab.id] = items.filter(tab.filter).length;
    });
    return counts;
  }

  // Populate checklist with items
  function populateChecklist(modal, items, selectedIds) {
    const checklist = modal.querySelector('#deviceChecklist');
    if (!checklist) return;

    checklist.innerHTML = '';

    // Sort items alphabetically
    const sortedItems = items
      .slice()
      .sort((a, b) =>
        (getItemLabel(a) || '').localeCompare(getItemLabel(b) || '', 'pt-BR', { sensitivity: 'base' })
      );

    sortedItems.forEach((item) => {
      const itemId = getItemId(item);
      const isChecked = !selectedIds || selectedIds.has(String(itemId));
      const subLabel = getItemSubLabel(item);
      const value = getItemValue(item);
      const formattedValue = formatValue(value);

      const div = document.createElement('div');
      div.className = 'check-item';
      div.innerHTML = `
        <input type="checkbox" id="check-${itemId}" ${isChecked ? 'checked' : ''} ${itemIdAttr}="${itemId}">
        <label for="check-${itemId}" style="flex: 1;">${getItemLabel(item)}</label>
        ${
          subLabel
            ? `<span style="color: #64748b; font-size: 11px; margin-right: 8px;">${subLabel}</span>`
            : ''
        }
        <span style="color: ${
          value > 0 ? '#16a34a' : '#94a3b8'
        }; font-size: 11px; font-weight: 600; min-width: 70px; text-align: right;">${formattedValue}</span>
      `;
      checklist.appendChild(div);
    });
  }

  // Open the modal
  function open(items, state = {}) {
    if (!items || items.length === 0) {
      LogHelper.warn(`[${widgetName}] No items to display in filter modal`);
      window.alert('Nenhum item encontrado. Por favor, aguarde o carregamento dos dados.');
      return;
    }

    LogHelper.log(`[${widgetName}] Opening filter modal with ${items.length} items`);

    // Create global container if needed
    if (!globalContainer) {
      globalContainer = document.getElementById(containerId);

      if (!globalContainer) {
        globalContainer = document.createElement('div');
        globalContainer.id = containerId;
        globalContainer.innerHTML = `<style>${generateStyles()}</style>${generateModalHTML()}`;
        document.body.appendChild(globalContainer);

        const modal = globalContainer.querySelector('#filterModal');
        if (modal) {
          setupHandlers(modal, items, state);
        }

        LogHelper.log(`[${widgetName}] Modal created and attached to document.body`);
      }
    }

    const modal = globalContainer.querySelector('#filterModal');
    if (!modal) return;

    // Calculate and update counts
    const counts = calculateCounts(items);
    const tabsContainer = modal.querySelector('#filterTabsContainer');
    if (tabsContainer) {
      tabsContainer.innerHTML = generateFilterTabsHTML(counts);

      // Re-bind tab click handlers after updating HTML
      const filterTabsEl = tabsContainer.querySelectorAll('.filter-tab');
      filterTabsEl.forEach((tab) => {
        tab.addEventListener('click', () => {
          const filterType = tab.getAttribute('data-filter');
          filterTabsEl.forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');

          const checkboxes = modal.querySelectorAll(`#deviceChecklist input[type='checkbox']`);
          checkboxes.forEach((cb) => {
            const itemId = cb.getAttribute(itemIdAttr);
            const item = items.find((i) => String(getItemId(i)) === String(itemId));
            if (!item) return;

            const tabConfig = filterTabs.find((t) => t.id === filterType);
            cb.checked = tabConfig ? tabConfig.filter(item) : true;
          });
        });
      });
    }

    // Populate checklist
    populateChecklist(modal, items, state.selectedIds);

    // Set sort mode
    const sortRadio = modal.querySelector(`input[name="sortMode"][value="${state.sortMode || 'cons_desc'}"]`);
    if (sortRadio) sortRadio.checked = true;

    // Show modal
    modal.classList.remove('hidden');
    document.body.classList.add('filter-modal-open');

    LogHelper.log(`[${widgetName}] Filter modal opened`);
  }

  // Close the modal
  function close() {
    if (!globalContainer) return;

    const modal = globalContainer.querySelector('#filterModal');
    if (modal) {
      modal.classList.add('hidden');
    }

    document.body.classList.remove('filter-modal-open');
    onClose();

    LogHelper.log(`[${widgetName}] Filter modal closed`);
  }

  // Destroy the modal
  function destroy() {
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }

    if (globalContainer) {
      globalContainer.remove();
      globalContainer = null;
    }

    document.body.classList.remove('filter-modal-open');

    LogHelper.log(`[${widgetName}] Filter modal destroyed`);
  }

  return { open, close, destroy };
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
  fetchEnergyDayConsumption,
  mapConnectionStatus,
  formatRelativeTime,
  formatarDuracao,
  findValue,

  // Credentials (getters - populated after onInit)
  getCustomerId: () => window.myioHoldingCustomerId,
  getClientId: () => window.__MYIO_CLIENT_ID__,
  getClientSecret: () => window.__MYIO_CLIENT_SECRET__,
  getCustomerIngestionId: () => window.__MYIO_CUSTOMER_INGESTION_ID__,

  // RFC-0091: Connection delay time getter (default 60 minutes)
  getDelayTimeConnectionInMins: () => window.__MYIO_DELAY_TIME_CONNECTION_MINS__ ?? 60,

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

  // RFC-0093: Centralized Header Builder
  buildHeaderDevicesGrid,
  HEADER_DOMAIN_CONFIG,

  // ThingsBoard API
  fetchCustomerServerScopeAttrs,

  // RFC-0090: Shared Filter Modal Factory
  createFilterModal,

  // RFC-0092: Temperature Utilities
  formatTemperature: (value) => {
    if (value === null || value === undefined || isNaN(value)) return '--';
    return `${Number(value).toFixed(1)}°C`;
  },
  getTemperatureStatus: (temp, min = 18, max = 26) => {
    if (temp === null || temp === undefined || isNaN(temp)) return 'no_info';
    if (temp < min) return 'cold';
    if (temp > max) return 'hot';
    return 'normal';
  },
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

  // ===== WATER: Registro de IDs válidos por categoria (vindos dos Aliases TB) =====
  // Os widgets WATER_COMMON_AREA e WATER_STORES registram seus IDs aqui
  // O Orchestrator só soma devices que existem nesses registros
  const waterValidIds = {
    commonArea: new Set(),  // IDs do alias 'HidrometrosAreaComum'
    stores: new Set(),      // IDs do alias 'Todos Hidrometros Lojas'
  };

  // Totais calculados apenas para IDs válidos
  let waterTotals = {
    commonArea: 0,
    stores: 0,
    total: 0,
  };

  /**
   * Widgets registram seus IDs válidos de água
   * @param {string} category - 'commonArea' ou 'stores'
   * @param {string[]} ids - Array de ingestionIds válidos
   */
  function registerWaterDeviceIds(category, ids) {
    if (category !== 'commonArea' && category !== 'stores') {
      LogHelper.warn(`[Orchestrator] Invalid water category: ${category}`);
      return;
    }

    waterValidIds[category] = new Set(ids.filter(Boolean));
    LogHelper.log(`[Orchestrator] Registered ${waterValidIds[category].size} valid IDs for water ${category}`);

    // Recalcular totais com IDs válidos
    recalculateWaterTotals();
  }

  /**
   * Calcula totais de água apenas para IDs válidos (dos Aliases TB)
   * IDs que não estão em nenhum alias são IGNORADOS
   */
  function recalculateWaterTotals() {
    let commonAreaTotal = 0;
    let storesTotal = 0;

    waterCache.forEach((device, id) => {
      const value = Number(device.total_value || 0);
      if (waterValidIds.commonArea.has(id)) {
        commonAreaTotal += value;
      } else if (waterValidIds.stores.has(id)) {
        storesTotal += value;
      }
      // IDs que não estão em nenhum alias são IGNORADOS (não somados)
    });

    waterTotals = {
      commonArea: commonAreaTotal,
      stores: storesTotal,
      total: commonAreaTotal + storesTotal,
    };

    LogHelper.log(`[Orchestrator] Water totals recalculated:`, waterTotals);
    LogHelper.log(`[Orchestrator] Valid IDs: commonArea=${waterValidIds.commonArea.size}, stores=${waterValidIds.stores.size}`);
    LogHelper.log(`[Orchestrator] Ignored devices: ${waterCache.size - waterValidIds.commonArea.size - waterValidIds.stores.size}`);

    // Disparar evento para atualizar HEADER e WATER
    window.dispatchEvent(new CustomEvent('myio:water-totals-updated', {
      detail: { ...waterTotals, timestamp: Date.now() }
    }));
  }

  /**
   * Retorna os totais de água calculados (apenas IDs válidos)
   */
  function getWaterTotals() {
    return { ...waterTotals };
  }

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
    // RFC-0093: Guard against undefined myIOAuth (widget destroyed or not initialized)
    if (!myIOAuth || typeof myIOAuth.getToken !== 'function') {
      LogHelper.warn('[MAIN] fetchEnergyData: myIOAuth not available, skipping');
      return energyCache;
    }

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
    // RFC-0093: Guard against undefined myIOAuth (widget destroyed or not initialized)
    if (!myIOAuth || typeof myIOAuth.getToken !== 'function') {
      LogHelper.warn('[MAIN] fetchWaterData: myIOAuth not available, skipping');
      return waterCache;
    }

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
      const isEquipment =
        equipmentsIngestionIds.size > 0
          ? equipmentsIngestionIds.has(ingestionId)
          : !lojasIngestionIds.has(ingestionId);

      if (isEquipment) {
        // Apply shopping filter
        if (shouldIncludeDevice(device)) {
          total += device.total_value || 0;
        }
      }
    });

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
   * @returns {object} - { customerTotal, unfilteredTotal, equipmentsTotal, lojasTotal, percentage, isFiltered }
   */
  function getEnergyWidgetData(totalConsumption = 0) {
    const equipmentsTotal = getTotalEquipmentsConsumption();
    const lojasTotal = getTotalLojasConsumption();

    // Total calculado = soma de equipamentos + lojas (dispositivos conhecidos)
    const calculatedTotal = equipmentsTotal + lojasTotal;

    // Se temos listas de IDs identificadas, usar o total calculado
    // Senão, usar o total vindo do HEADER (API completa)
    const hasIdentifiedDevices = equipmentsIngestionIds.size > 0 || lojasIngestionIds.size > 0;
    const effectiveTotal = hasIdentifiedDevices ? calculatedTotal : totalConsumption || calculatedTotal;

    // RFC-0093: Get unfiltered total for comparison display
    const unfilteredTotal = getUnfilteredTotalConsumption();
    const filtered = isFilterActive();

    // ✅ Equipamentos como % do total
    const percentage = effectiveTotal > 0 ? (equipmentsTotal / effectiveTotal) * 100 : 0;

    const result = {
      customerTotal: Number(effectiveTotal) || 0,
      unfilteredTotal: Number(unfilteredTotal) || 0, // RFC-0093: Total without filter for comparison
      equipmentsTotal: Number(equipmentsTotal) || 0,
      lojasTotal: Number(lojasTotal) || 0,
      difference: Number(lojasTotal) || 0, // Mantém compatibilidade (lojas = difference)
      percentage: Number(percentage) || 0,
      deviceCount: energyCache.size,
      isFiltered: filtered, // RFC-0093: Flag indicating filter is active
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
      LogHelper.log(
        '[MAIN] [Orchestrator] equipmentsIngestionIds set:',
        equipmentsIngestionIds.size,
        'equipments'
      );
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

    // ===== WATER: Funções para registro de IDs válidos =====
    registerWaterDeviceIds,
    getWaterTotals,
    recalculateWaterTotals,
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

// ✅ WATER widget → solicita dados de água do cache ou busca na API
window.addEventListener('myio:request-water-data', async (ev) => {
  LogHelper.log('[MAIN] Received myio:request-water-data from:', ev.detail?.requestor);

  // Check if orchestrator and auth are ready
  if (!window.MyIOOrchestrator || !CUSTOMER_INGESTION_ID) {
    LogHelper.warn('[MAIN] Orchestrator or credentials not ready for water data request');
    return;
  }

  // Get current period from global state
  const startDate = window.__MYIO_CURRENT_START_DATE__;
  const endDate = window.__MYIO_CURRENT_END_DATE__;

  if (!startDate || !endDate) {
    LogHelper.warn('[MAIN] No date range set for water data request');
    return;
  }

  try {
    // Fetch water data (will use cache if available)
    const waterCache = await window.MyIOOrchestrator.fetchWaterData(
      CUSTOMER_INGESTION_ID,
      startDate,
      endDate
    );

    LogHelper.log('[MAIN] Water data fetched/cached:', waterCache?.size || 0, 'devices');

    // Event is already dispatched by fetchWaterData, but dispatch again for late subscribers
    if (waterCache && waterCache.size > 0) {
      window.dispatchEvent(
        new CustomEvent('myio:water-data-ready', {
          detail: {
            cache: waterCache,
            totalDevices: waterCache.size,
            startDate,
            endDate,
            timestamp: Date.now(),
            fromCache: true,
          },
        })
      );
    }
  } catch (err) {
    LogHelper.error('[MAIN] Error fetching water data:', err);
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

window.addEventListener('myio:customers-ready', async (_ev) => {
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
  // RFC-0093: Guard against undefined myIOAuth (widget destroyed or not initialized)
  if (!myIOAuth || typeof myIOAuth.getToken !== 'function') {
    //LogHelper.warn('[MAIN] updateTotalConsumption: myIOAuth not available, skipping');
    return;
  }

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
  // RFC-0093: Guard against undefined myIOAuth (widget destroyed or not initialized)
  if (!myIOAuth || typeof myIOAuth.getToken !== 'function') {
    //LogHelper.warn('[MAIN] updateTotalWaterConsumption: myIOAuth not available, skipping');
    return;
  }

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

  // RFC-0091: Get delayTimeConnectionInMins from settings (default 60 minutes)
  const delayTimeConnectionInMins = self.ctx.settings.delayTimeConnectionInMins ?? 60;
  window.__MYIO_DELAY_TIME_CONNECTION_MINS__ = delayTimeConnectionInMins;
  LogHelper.log('[MAIN] [RFC-0091] delayTimeConnectionInMins:', delayTimeConnectionInMins);

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
      // Store dates globally for other widgets (WATER, etc.) to access
      window.__MYIO_CURRENT_START_DATE__ = startDate;
      window.__MYIO_CURRENT_END_DATE__ = endDate;

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

  // Store dates globally for other widgets (WATER, etc.) to access
  if (self.ctx.$scope.startDateISO && self.ctx.$scope.endDateISO) {
    window.__MYIO_CURRENT_START_DATE__ = self.ctx.$scope.startDateISO;
    window.__MYIO_CURRENT_END_DATE__ = self.ctx.$scope.endDateISO;
    LogHelper.log(
      '[MAIN] Global dates initialized:',
      window.__MYIO_CURRENT_START_DATE__,
      window.__MYIO_CURRENT_END_DATE__
    );
  }

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

  // RFC: Check if MENU already dispatched myio:update-date before we were ready
  // This handles the race condition where MENU fires the event before MAIN registers the listener
  if (window.myioDateRange && window.myioDateRange.startDate && window.myioDateRange.endDate) {
    LogHelper.log(
      '[MAIN] [Orchestrator] Found existing date range from MENU, triggering initial fetch:',
      window.myioDateRange
    );
    // Dispatch internal event to trigger fetch via existing listener
    window.dispatchEvent(
      new CustomEvent('myio:update-date', {
        detail: {
          startDate: window.myioDateRange.startDate,
          endDate: window.myioDateRange.endDate,
        },
      })
    );
  } else {
    LogHelper.log('[MAIN] [Orchestrator] Waiting for myio:update-date event from MENU to fetch data...');
  }
};

self.onDestroy = function () {
  if (self._onDateParams) {
    window.removeEventListener('myio:date-params', self._onDateParams);
  }
};
