/* global self, ctx */

const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
let CUSTOMER_ID;
let CLIENT_ID;
let CLIENT_SECRET;
let INGESTION_ID;

// RFC-0057: Removed unused utility functions: d(), clamp(), formatNumber(), formatHours(), escapeHtml(), isDanger()

// RFC: Global refresh counter to limit data updates to 3 times maximum
let _dataRefreshCount = 0;
const MAX_DATA_REFRESHES = 1;

// RFC-0071: Device Profile Synchronization
// Global flag to track if sync has been completed
let __deviceProfileSyncComplete = false;

// ============================================
// RFC-0071: DEVICE PROFILE SYNCHRONIZATION
// ============================================

/**
 * Fetches all active device profiles from ThingsBoard
 * @returns {Promise<Map<string, string>>} Map of profileId -> profileName
 */
async function fetchDeviceProfiles() {
  const token = localStorage.getItem("jwt_token");
  if (!token) throw new Error("[RFC-0071] JWT token not found");

  const url = "/api/deviceProfile/names?activeOnly=true";

  console.log("[EQUIPMENTS] [RFC-0071] Fetching device profiles...");

  const response = await fetch(url, {
    headers: {
      "X-Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`[RFC-0071] Failed to fetch device profiles: ${response.status}`);
  }

  const profiles = await response.json();

  // Build Map: profileId -> profileName
  const profileMap = new Map();
  profiles.forEach(profile => {
    const profileId = profile.id.id;
    const profileName = profile.name;
    profileMap.set(profileId, profileName);
  });

  console.log(`[EQUIPMENTS] [RFC-0071] Loaded ${profileMap.size} device profiles:`,
    Array.from(profileMap.entries()).map(([id, name]) => name).join(", "));

  return profileMap;
}

/**
 * Fetches device details including deviceProfileId
 * @param {string} deviceId - Device entity ID
 * @returns {Promise<Object>}
 */
async function fetchDeviceDetails(deviceId) {
  const token = localStorage.getItem("jwt_token");
  if (!token) throw new Error("[RFC-0071] JWT token not found");

  const url = `/api/device/${deviceId}`;

  const response = await fetch(url, {
    headers: {
      "X-Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
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
    if (!deviceId) throw new Error("deviceId is required");
    if (deviceProfile == null || deviceProfile === "") {
      throw new Error("deviceProfile is required");
    }

    const token = localStorage.getItem("jwt_token");
    if (!token) throw new Error("jwt_token not found in localStorage");

    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
    const headers = {
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${token}`,
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ deviceProfile }),
    });

    const bodyText = await res.text().catch(() => "");

    if (!res.ok) {
      throw new Error(
        `[RFC-0071] HTTP ${res.status} ${res.statusText} - ${bodyText}`
      );
    }

    let data = null;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      // Response may not be JSON
    }

    const dt = Date.now() - t;
    console.log(
      `[EQUIPMENTS] [RFC-0071] ✅ Saved deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms`
    );

    return { ok: true, status: res.status, data };
  } catch (err) {
    const dt = Date.now() - t;
    console.error(
      `[EQUIPMENTS] [RFC-0071] ❌ Failed to save deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms | error: ${err?.message || err}`
    );
    throw err;
  }
}

/**
 * Main synchronization function
 * Checks all devices and syncs missing deviceProfile attributes
 * @returns {Promise<{synced: number, skipped: number, errors: number}>}
 */
async function syncDeviceProfileAttributes() {
  console.log("[EQUIPMENTS] [RFC-0071] 🔄 Starting device profile synchronization...");

  try {
    // Step 1: Fetch all device profiles
    const profileMap = await fetchDeviceProfiles();

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Step 2: Build a map of devices that need sync
    const deviceMap = new Map();

    self.ctx.data.forEach((data) => {
      const entityId = data.datasource?.entity?.id?.id;
      const existingProfile = data.datasource?.deviceProfile;

      if (!entityId) return;

      // Skip if already has deviceProfile attribute
      if (existingProfile) {
        skipped++;
        return;
      }

      // Store for processing (deduplicate by entityId)
      if (!deviceMap.has(entityId)) {
        deviceMap.set(entityId, {
          entityLabel: data.datasource?.entityLabel,
          entityName: data.datasource?.entityName,
          name: data.datasource?.name,
        });
      }
    });

    console.log(`[EQUIPMENTS] [RFC-0071] Found ${deviceMap.size} devices without deviceProfile attribute`);
    console.log(`[EQUIPMENTS] [RFC-0071] Skipped ${skipped} devices that already have deviceProfile`);

    if (deviceMap.size === 0) {
      console.log("[EQUIPMENTS] [RFC-0071] ✅ All devices already synchronized!");
      return { synced: 0, skipped, errors: 0 };
    }

    // Step 3: Fetch device details and sync attributes
    let processed = 0;
    for (const [entityId, deviceInfo] of deviceMap) {
      processed++;
      const deviceLabel = deviceInfo.entityLabel || deviceInfo.entityName || deviceInfo.name || entityId;

      try {
        console.log(`[EQUIPMENTS] [RFC-0071] Processing ${processed}/${deviceMap.size}: ${deviceLabel}`);

        // Fetch device details to get deviceProfileId
        const deviceDetails = await fetchDeviceDetails(entityId);
        const deviceProfileId = deviceDetails.deviceProfileId?.id;

        if (!deviceProfileId) {
          console.warn(`[EQUIPMENTS] [RFC-0071] ⚠️ Device ${deviceLabel} has no deviceProfileId`);
          errors++;
          continue;
        }

        // Look up profile name from map
        const profileName = profileMap.get(deviceProfileId);

        if (!profileName) {
          console.warn(`[EQUIPMENTS] [RFC-0071] ⚠️ Profile ID ${deviceProfileId} not found in map`);
          errors++;
          continue;
        }

        // Save attribute
        await addDeviceProfileAttribute(entityId, profileName);
        synced++;

        console.log(`[EQUIPMENTS] [RFC-0071] ✅ Synced ${deviceLabel} -> ${profileName}`);

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[EQUIPMENTS] [RFC-0071] ❌ Failed to sync device ${deviceLabel}:`, error);
        errors++;
      }
    }

    console.log(`[EQUIPMENTS] [RFC-0071] 🎉 Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);

    return { synced, skipped, errors };

  } catch (error) {
    console.error("[EQUIPMENTS] [RFC-0071] ❌ Fatal error during sync:", error);
    throw error;
  }
}

// ============================================
// RFC-0078: UNIFIED JSON POWER LIMITS CONFIGURATION
// ============================================

/**
 * Default consumption ranges for each device type (TIER 3 - fallback)
 * Used when no device or customer JSON configuration exists
 */
const DEFAULT_CONSUMPTION_RANGES = {
  'ELEVADOR': {
    standbyRange: { down: 0, up: 150 },
    normalRange: { down: 151, up: 800 },
    alertRange: { down: 801, up: 1200 },
    failureRange: { down: 1201, up: 99999 }
  },
  'ESCADA_ROLANTE': {
    standbyRange: { down: 0, up: 200 },
    normalRange: { down: 201, up: 1000 },
    alertRange: { down: 1001, up: 1500 },
    failureRange: { down: 1501, up: 99999 }
  },
  'CHILLER': {
    standbyRange: { down: 0, up: 1000 },
    normalRange: { down: 1001, up: 6000 },
    alertRange: { down: 6001, up: 8000 },
    failureRange: { down: 8001, up: 99999 }
  },
  'AR_CONDICIONADO': {
    standbyRange: { down: 0, up: 500 },
    normalRange: { down: 501, up: 3000 },
    alertRange: { down: 3001, up: 5000 },
    failureRange: { down: 5001, up: 99999 }
  },
  'HVAC': {
    standbyRange: { down: 0, up: 500 },
    normalRange: { down: 501, up: 3000 },
    alertRange: { down: 3001, up: 5000 },
    failureRange: { down: 5001, up: 99999 }
  },
  'MOTOR': {
    standbyRange: { down: 0, up: 200 },
    normalRange: { down: 201, up: 1000 },
    alertRange: { down: 1001, up: 1500 },
    failureRange: { down: 1501, up: 99999 }
  },
  'BOMBA': {
    standbyRange: { down: 0, up: 200 },
    normalRange: { down: 201, up: 1000 },
    alertRange: { down: 1001, up: 1500 },
    failureRange: { down: 1501, up: 99999 }
  },
  'DEFAULT': {
    standbyRange: { down: 0, up: 100 },
    normalRange: { down: 101, up: 1000 },
    alertRange: { down: 1001, up: 2000 },
    failureRange: { down: 2001, up: 99999 }
  }
};

// Cache for JSON power limits configuration
// Map<entityId, {json: Object, timestamp: number}>
const powerLimitsJSONCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * RFC-0078: Fetch unified JSON power limits from ThingsBoard entity
 * @param {string} entityId - Entity ID (device or customer)
 * @param {string} entityType - 'DEVICE' or 'CUSTOMER'
 * @returns {Promise<Object|null>} Parsed JSON configuration or null
 */
async function fetchInstantaneousPowerLimits(entityId, entityType = 'CUSTOMER') {
  const token = localStorage.getItem("jwt_token");
  if (!token) {
    console.warn("[RFC-0078] JWT token not found");
    return null;
  }

  const url = `/api/plugins/telemetry/${entityType}/${entityId}/values/attributes/SERVER_SCOPE`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[RFC-0078] No attributes found for ${entityType} ${entityId}`);
        return null;
      }
      console.warn(`[RFC-0078] Failed to fetch ${entityType} attributes: ${response.status}`);
      return null;
    }

    const attributes = await response.json();

    // Find mapInstantaneousPower attribute
    const powerLimitsAttr = attributes.find(attr => attr.key === 'mapInstantaneousPower');

    if (!powerLimitsAttr) {
      //console.log(`[RFC-0078] mapInstantaneousPower not found on ${entityType} ${entityId}`);
      return null;
    }

    // Parse JSON value
    let limits;
    if (typeof powerLimitsAttr.value === 'string') {
      try {
        limits = JSON.parse(powerLimitsAttr.value);
      } catch (parseError) {
        console.error(`[RFC-0078] Failed to parse JSON for ${entityType} ${entityId}:`, parseError);
        return null;
      }
    } else {
      limits = powerLimitsAttr.value;
    }

    console.log(`[RFC-0078] ✅ Loaded mapInstantaneousPower from ${entityType} ${entityId}:`, {
      version: limits.version,
      telemetryTypes: limits.limitsByInstantaneoustPowerType?.length || 0
    });

    return limits;

  } catch (error) {
    console.error(`[RFC-0078] Error fetching ${entityType} power limits:`, error);
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

  // Find telemetry type configuration
  const telemetryConfig = powerLimitsJSON.limitsByInstantaneoustPowerType.find(
    config => config.telemetryType === telemetryType
  );

  if (!telemetryConfig) {
    console.log(`[RFC-0078] Telemetry type ${telemetryType} not found in JSON`);
    return null;
  }

  // Find device type configuration
  const deviceConfig = telemetryConfig.itemsByDeviceType.find(
    item => item.deviceType === deviceType || item.deviceType === deviceType.toUpperCase()
  );

  if (!deviceConfig) {
    console.log(`[RFC-0078] Device type ${deviceType} not found for telemetry ${telemetryType}`);
    return null;
  }

  // Extract ranges by status
  const ranges = {
    standbyRange: { down: 0, up: 0 },
    normalRange: { down: 0, up: 0 },
    alertRange: { down: 0, up: 0 },
    failureRange: { down: 0, up: 0 }
  };

  deviceConfig.limitsByDeviceStatus.forEach(status => {
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
    tier: 2, // Will be updated to 1 if from device
    metadata: {
      name: deviceConfig.name,
      description: deviceConfig.description,
      version: powerLimitsJSON.version,
      telemetryType: telemetryType
    }
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
 * For DEVICE: reads from ctx.data[] with dataKey = mapInstantaneousPower (no API call)
 * For CUSTOMER: fetches via API
 * @param {string} entityId - Entity ID
 * @param {string} entityType - 'DEVICE' or 'CUSTOMER'
 * @param {Object} ctxData - Optional ctx.data array from widget context (for DEVICE lookups)
 * @returns {Promise<Object|null>} JSON configuration
 */
async function getCachedPowerLimitsJSON(entityId, entityType = 'CUSTOMER', ctxData = null) {
  if (!entityId) return null;

  const cacheKey = `${entityType}:${entityId}`;
  const cached = powerLimitsJSONCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    //console.log(`[RFC-0078] Using cached JSON for ${entityType} ${entityId}`);
    return cached.json;
  }

  let json = null;

  if (entityType === 'DEVICE' && ctxData) {
    // RFC-0078: For DEVICE, read from ctx.data[] instead of API call
    // Device mapInstantaneousPower is available as dataKey in widget context
    const powerLimitsData = ctxData.find(d => d.dataKey && d.dataKey.name === 'mapInstantaneousPower');

    if (powerLimitsData && powerLimitsData.data && powerLimitsData.data.length > 0) {
      const latestValue = powerLimitsData.data[powerLimitsData.data.length - 1];
      const rawValue = latestValue[1]; // [timestamp, value]

      if (typeof rawValue === 'string') {
        try {
          json = JSON.parse(rawValue);
          console.log(`[RFC-0078] ✅ Loaded mapInstantaneousPower from ctx.data for DEVICE ${entityId}:`, {
            version: json.version,
            telemetryTypes: json.limitsByInstantaneoustPowerType?.length || 0
          });
        } catch (parseError) {
          console.warn(`[RFC-0078] Failed to parse DEVICE JSON from ctx.data:`, parseError);
          // Fallback: return empty structure to indicate device has no config
          json = { version: '1.0.0', limitsByInstantaneoustPowerType: [] };
        }
      } else if (typeof rawValue === 'object') {
        json = rawValue;
        console.log(`[RFC-0078] ✅ Loaded mapInstantaneousPower (object) from ctx.data for DEVICE ${entityId}`);
      }
    } else {
      // Device doesn't have mapInstantaneousPower - return empty structure
      console.log(`[RFC-0078] mapInstantaneousPower not found in ctx.data for DEVICE ${entityId}, using empty fallback`);
      json = { version: '1.0.0', limitsByInstantaneoustPowerType: [] };
    }
  } else if (entityType === 'CUSTOMER') {
    // For CUSTOMER, fetch via API
    json = await fetchInstantaneousPowerLimits(entityId, entityType);
  } else {
    // Fallback: fetch via API (old behavior, commented for reference)
    // json = await fetchInstantaneousPowerLimits(entityId, entityType);
    console.warn(`[RFC-0078] DEVICE lookup without ctxData, returning empty structure`);
    json = { version: '1.0.0', limitsByInstantaneoustPowerType: [] };
  }

  // Cache even null/empty results to avoid repeated lookups
  powerLimitsJSONCache.set(cacheKey, {
    json: json,
    timestamp: now
  });

  return json;
}

/**
 * RFC-0078: Gets consumption limits with hierarchical resolution using JSON structure
 * TIER 1: Device-level mapInstantaneousPower (highest priority)
 * TIER 2: Customer-level mapInstantaneousPower
 * TIER 3: Hardcoded defaults (fallback)
 *
 * @param {string} deviceId - Device entity ID
 * @param {string} deviceType - Device type (for config lookup)
 * @param {Object} customerLimitsJSON - Pre-fetched customer JSON (TIER 2)
 * @param {string} telemetryType - Telemetry type (default: 'consumption')
 * @param {Object} ctxData - Optional ctx.data array from widget context (for DEVICE lookups)
 * @returns {Promise<Object>} Consumption ranges with source indicator
 */
async function getConsumptionRangesHierarchical(deviceId, deviceType, customerLimitsJSON, telemetryType = 'consumption', ctxData = null) {
  //console.log(`[RFC-0078] Resolving limits for device ${deviceId}, type ${deviceType}, telemetry ${telemetryType}`);

  // TIER 1: Try device-level JSON first (highest priority)
  // Reads from ctx.data[] if available, no API call needed
  const deviceLimitsJSON = await getCachedPowerLimitsJSON(deviceId, 'DEVICE', ctxData);
  if (deviceLimitsJSON && deviceLimitsJSON.limitsByInstantaneoustPowerType && deviceLimitsJSON.limitsByInstantaneoustPowerType.length > 0) {
    const deviceRanges = extractLimitsFromJSON(deviceLimitsJSON, deviceType, telemetryType);
    if (deviceRanges) {
      //console.log(`[RFC-0078] ✅ Using DEVICE-level JSON for ${deviceId} (TIER 1)`);
      return { ...deviceRanges, source: 'device', tier: 1 };
    }
  }

  // TIER 2: Try customer-level JSON
  if (customerLimitsJSON) {
    const customerRanges = extractLimitsFromJSON(customerLimitsJSON, deviceType, telemetryType);
    if (customerRanges) {
      //console.log(`[RFC-0078] ✅ Using CUSTOMER-level JSON for ${deviceType} (TIER 2)`);
      return { ...customerRanges, source: 'customer', tier: 2 };
    }
  }

  // TIER 3: Hardcoded defaults
  console.log(`[RFC-0078] Using HARDCODED defaults for ${deviceType} (TIER 3)`);
  const defaultRanges = getDefaultRanges(deviceType);
  return {
    ...defaultRanges,
    source: 'hardcoded',
    tier: 3,
    metadata: {
      name: `Default${deviceType}`,
      description: `System default for ${deviceType}`,
      version: '0.0.0',
      telemetryType: telemetryType
    }
  };
}

/**
 * RFC-0078: Validate JSON structure before saving (for future UI integration)
 * @param {Object} json - The JSON to validate
 * @returns {Array<string>} Array of error messages (empty if valid)
 */
function validateInstantaneousPowerJSON(json) {
  const errors = [];

  // Check version
  if (!json.version || typeof json.version !== 'string') {
    errors.push('Missing or invalid version field');
  }

  // Check main array
  if (!Array.isArray(json.limitsByInstantaneoustPowerType)) {
    errors.push('Missing or invalid limitsByInstantaneoustPowerType array');
    return errors;
  }

  // Validate each telemetry type
  json.limitsByInstantaneoustPowerType.forEach((telemetryConfig, tIndex) => {
    if (!telemetryConfig.telemetryType) {
      errors.push(`Telemetry config at index ${tIndex} missing telemetryType`);
    }

    if (!Array.isArray(telemetryConfig.itemsByDeviceType)) {
      errors.push(`Telemetry ${telemetryConfig.telemetryType} missing itemsByDeviceType array`);
      return;
    }

    // Validate each device type
    telemetryConfig.itemsByDeviceType.forEach((deviceConfig, dIndex) => {
      if (!deviceConfig.deviceType) {
        errors.push(`Device config at ${tIndex}/${dIndex} missing deviceType`);
      }

      if (!Array.isArray(deviceConfig.limitsByDeviceStatus)) {
        errors.push(`Device ${deviceConfig.deviceType} missing limitsByDeviceStatus array`);
        return;
      }

      // Validate status limits
      const requiredStatuses = ['standBy', 'normal', 'alert', 'failure'];
      const foundStatuses = deviceConfig.limitsByDeviceStatus.map(s => s.deviceStatusName);

      requiredStatuses.forEach(status => {
        if (!foundStatuses.includes(status)) {
          errors.push(`Device ${deviceConfig.deviceType} missing ${status} configuration`);
        }
      });

      // Validate value ranges
      deviceConfig.limitsByDeviceStatus.forEach(status => {
        const values = status.limitsValues || status.limitsVales;
        if (!values) {
          errors.push(`Status ${status.deviceStatusName} missing limitsValues`);
          return;
        }

        const base = values.baseValue;
        const top = values.topValue;

        if (typeof base !== 'number' || typeof top !== 'number') {
          errors.push(`Status ${status.deviceStatusName} has invalid numeric values`);
        }

        if (base > top) {
          errors.push(`Status ${status.deviceStatusName} has baseValue > topValue`);
        }
      });
    });
  });

  return errors;
}

// Store customer limits JSON globally for the widget session
window.__customerPowerLimitsJSON = null;

/**
 * RFC-0078: Alias for backward compatibility with RFC-0077 calls
 */
async function getCachedConsumptionLimits(customerId) {
  return getCachedPowerLimitsJSON(customerId, 'CUSTOMER');
}

// ============================================
// END RFC-0078
// ============================================

const MyIOAuth = (() => {
  // ==== CONFIG ====
  const AUTH_URL = new URL(`${DATA_API_HOST}/api/v1/auth`);

  // ⚠️ Substitua pelos seus valores:

  // Margem para renovar o token antes de expirar (em segundos)
  const RENEW_SKEW_S = 60; // 1 min
  // Em caso de erro, re-tenta com backoff simples
  const RETRY_BASE_MS = 500;
  const RETRY_MAX_ATTEMPTS = 3;

  // Cache em memória (por aba). Se quiser compartilhar entre widgets/abas,
  // você pode trocar por localStorage (com os devidos cuidados de segurança).
  let _token = null; // string
  let _expiresAt = 0; // epoch em ms
  let _inFlight = null; // Promise em andamento para evitar corridas

  function _now() {
    return Date.now();
  }

  function _aboutToExpire() {
    // true se não temos token ou se falta pouco para expirar
    if (!_token) return true;
    const skewMs = RENEW_SKEW_S * 1000;
    return _now() >= _expiresAt - skewMs;
  }

  async function _sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async function _requestNewToken() {
    const body = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    };

    let attempt = 0;
    while (true) {
      try {
        const resp = await fetch(AUTH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(
            `Auth falhou: HTTP ${resp.status} ${resp.statusText} ${text}`
          );
        }

        const json = await resp.json();
        // Espera formato:
        // { access_token, token_type, expires_in, scope }
        if (!json || !json.access_token || !json.expires_in) {
          throw new Error("Resposta de auth não contem campos esperados.");
        }

        _token = json.access_token;
        // Define expiração absoluta (agora + expires_in)
        _expiresAt = _now() + Number(json.expires_in) * 1000;

        // Logs úteis para depuração (não imprimem o token)
        console.log(
          "[equipaments] [MyIOAuth] Novo token obtido. Expira em ~",
          Math.round(Number(json.expires_in) / 60),
          "min"
        );

        return _token;
      } catch (err) {
        attempt++;
        console.warn(
          `[equipaments] [MyIOAuth] Erro ao obter token (tentativa ${attempt}/${RETRY_MAX_ATTEMPTS}):`,
          err?.message || err
        );
        if (attempt >= RETRY_MAX_ATTEMPTS) {
          throw err;
        }
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await _sleep(backoff);
      }
    }
  }

  async function getToken() {
    // Evita múltiplas chamadas paralelas de renovação
    if (_inFlight) {
      return _inFlight;
    }

    if (_aboutToExpire()) {
      _inFlight = _requestNewToken().finally(() => {
        _inFlight = null;
      });
      return _inFlight;
    }

    return _token;
  }

  function clearCache() {
    _token = null;
    _expiresAt = 0;
    _inFlight = null;
  }

  // RFC-0057: Removed unused getExpiryInfo()

  return {
    getToken,
    clearCache,
  };
})();

async function fetchCustomerServerScopeAttrs(customerTbId) {
  if (!customerTbId) return {};
  const tbToken = localStorage.getItem("jwt_token");
  if (!tbToken)
    throw new Error(
      "JWT do ThingsBoard não encontrado (localStorage.jwt_token)."
    );

  const url = `/api/plugins/telemetry/CUSTOMER/${customerTbId}/values/attributes/SERVER_SCOPE`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${tbToken}`,
    },
  });
  if (!res.ok) {
    console.warn(`[equipaments] [customer attrs] HTTP ${res.status}`);
    return {};
  }
  const payload = await res.json();

  // Pode vir como array [{key,value}] OU como objeto { key: [{value}] }
  const map = {};
  if (Array.isArray(payload)) {
    for (const it of payload) map[it.key] = it.value;
  } else if (payload && typeof payload === "object") {
    for (const k of Object.keys(payload)) {
      const v = payload[k];
      if (Array.isArray(v) && v.length) map[k] = v[0]?.value ?? v[0];
    }
  }
  return map;
}

// RFC-0057: Removed unused functions: toSpOffsetNoMs(), getTimeWindowRange()

/**
 * Converte um timestamp em uma string de tempo relativo (ex: "há 5 minutos").
 * @param {number} timestamp - O timestamp em milissegundos.
 * @returns {string} A string formatada.
 */
function formatRelativeTime(timestamp) {
  if (!timestamp || timestamp <= 0) {
    return "—"; // Retorna um traço se não houver timestamp válido
  }

  const now = Date.now();
  const diffSeconds = Math.round((now - timestamp) / 1000);

  if (diffSeconds < 10) {
    return "agora";
  }
  if (diffSeconds < 60) {
    return `há ${diffSeconds}s`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes === 1) {
    return "há 1 min";
  }
  if (diffMinutes < 60) {
    return `há ${diffMinutes} mins`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours === 1) {
    return "há 1 hora";
  }
  if (diffHours < 24) {
    return `há ${diffHours} horas`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) {
    return "ontem";
  }
  if (diffDays <= 30) {
    return `há ${diffDays} dias`;
  }

  // Se for mais antigo, mostra a data
  return new Date(timestamp).toLocaleDateString("pt-BR");
}

/**
 * Função MOCK para simular a busca do último valor de temperatura de um dispositivo no ThingsBoard.
 * Ela imita uma chamada de API assíncrona, retornando uma Promise.
 *
 * @param {string} deviceId - O ID do dispositivo que você quer consultar.
 * @returns {Promise<Array<{ts: number, value: number}>>} Uma promise que resolve com um array contendo
 * o dado de telemetria mais recente (timestamp e valor).
 */
async function getDeviceTemperature(deviceId, token) {
  // 1. Validação básica da entrada
  if (!deviceId) {
    return Promise.reject(new Error("O ID do dispositivo não pode ser nulo."));
  }

  // 2. Simula um atraso de rede (entre 300ms e 1000ms)
  const networkDelay = Math.random() * 700 + 300;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 3. Simula uma chance de sucesso
      const isSuccess = true;

      if (isSuccess) {
        // Gera um valor de temperatura aleatório entre 18.0 e 32.0
        const mockTemperature = (Math.random() * 14 + 18).toFixed(2);
        const mockTimestamp = Date.now();

        // 4. Monta a resposta em um formato similar ao da API do ThingsBoard
        // A API geralmente retorna um array de objetos, mesmo para o valor mais recente.
        const responseData = [
          {
            ts: mockTimestamp,
            value: parseFloat(mockTemperature), // A API retorna um número
          },
        ];

        resolve(responseData);
      } else {
        // 5. Simula um erro de API
        const errorMessage = `[MOCK] Erro: Não foi possível encontrar o dispositivo com ID ${deviceId}.`;
        console.error(errorMessage);
        reject(new Error(errorMessage));
      }
    }, networkDelay);
  });
}

// RFC-0057: Removed unused functions: isValidUUID(), updateTotalConsumption(), fetchWithAuth(), latestNumber(), resolveEntityValue(), getKeyByValue()

// Log function
function log(message, type = "info") {
  const logOutput = document.getElementById("log-output");
  const time = new Date().toLocaleTimeString("pt-BR");
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<span class="log-time">${time}</span>${message}`;
}

function formatarDuracao(ms) {
  // 1. Lida com casos de entrada inválida ou zero.
  if (typeof ms !== "number" || ms < 0 || !isFinite(ms)) {
    return "0s";
  }
  if (ms === 0) {
    return "0s";
  }

  // 2. Calcula cada componente da duração.
  const segundos = Math.floor((ms / 1000) % 60);
  const minutos = Math.floor((ms / (1000 * 60)) % 60);
  const horas = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));

  // 3. Monta a string de resultado de forma inteligente.
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

  // 4. Retorna a string final, ou "0s" se for muito pequena.
  return parts.length > 0 ? parts.join(" ") : "0s";
}

// RFC-0057: Removed unused function: fetchLastConnectTime() (was commented out in usage anyway)

// Show/hide loading overlay
function showLoadingOverlay(show) {
  const overlay = document.getElementById("equipments-loading-overlay");
  if (overlay) {
    overlay.style.display = show ? "flex" : "none";
  }
}

/**
 * Update equipment statistics header
 * @param {Array} devices - Array of device objects with consumption data
 */
function updateEquipmentStats(devices) {
  const connectivityEl = document.getElementById("equipStatsConnectivity");
  const totalEl = document.getElementById("equipStatsTotal");
  const consumptionEl = document.getElementById("equipStatsConsumption");
  const zeroEl = document.getElementById("equipStatsZero");

  if (!connectivityEl || !totalEl || !consumptionEl || !zeroEl) {
    console.warn("[EQUIPMENTS] Stats header elements not found");
    return;
  }

  // Calculate connectivity (online vs total) from ctx.data
  // Group by entityId to count each device only once
  const deviceMap = new Map(); // entityId -> { hasConnectionStatus: bool, isOnline: bool }

  if (self.ctx && Array.isArray(self.ctx.data)) {
    self.ctx.data.forEach((data) => {
      const entityId = data.datasource?.entityId;
      const dataKeyName = data.dataKey?.name;

      if (!entityId) return;

      // Initialize device entry if doesn't exist
      if (!deviceMap.has(entityId)) {
        deviceMap.set(entityId, { hasConnectionStatus: false, isOnline: false });
      }

      // Check if this is the connectionStatus dataKey
      if (dataKeyName === "connectionStatus") {
        const status = String(data.data?.[0]?.[1] || '').toLowerCase();
        deviceMap.get(entityId).hasConnectionStatus = true;
        deviceMap.get(entityId).isOnline = (status === "online");
      }
    });
  }

  // Count online devices (only EQUIPMENTS, exclude lojas)
  let onlineCount = 0;
  let totalWithStatus = 0;

  devices.forEach(device => {
    const deviceData = deviceMap.get(device.entityId);
    if (deviceData && deviceData.hasConnectionStatus) {
      totalWithStatus++;
      if (deviceData.isOnline) {
        onlineCount++;
      }
    }
  });

  // RFC-0076: Calculate consumption from FILTERED devices array
  // IMPORTANT: Always calculate locally to respect filter selections
  let totalConsumption = 0;
  devices.forEach(device => {
    // Try to get consumption from energyCache first (most reliable)
    const ingestionIdItem = device.values?.find(v => v.dataType === "ingestionId");
    const ingestionId = ingestionIdItem?.value || ingestionIdItem?.val;

    let consumption = 0;
    if (ingestionId && energyCacheFromMain) {
      const cached = energyCacheFromMain.get(ingestionId);
      if (cached) {
        consumption = Number(cached.total_value) || 0;
      }
    }

    // Fallback to device's own value if cache lookup failed
    if (consumption === 0) {
      consumption = Number(device.val) || Number(device.lastValue) || 0;
    }

    totalConsumption += consumption;
  });

  console.log("[EQUIPMENTS] Consumption calculated from", devices.length, "filtered devices:", totalConsumption, "kWh");

  // Calculate zero consumption count locally (not available in orchestrator)
  let zeroConsumptionCount = 0;
  devices.forEach(device => {
    const consumption = Number(device.val) || Number(device.lastValue) || 0;
    if (consumption === 0) {
      zeroConsumptionCount++;
    }
  });

  // Calculate connectivity percentage
  const connectivityPercentage = totalWithStatus > 0
    ? ((onlineCount / totalWithStatus) * 100).toFixed(1)
    : "0.0";

  // Update UI
  connectivityEl.textContent = `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`;
  totalEl.textContent = devices.length.toString();
  consumptionEl.textContent = MyIOLibrary.formatEnergy(totalConsumption);
  zeroEl.textContent = zeroConsumptionCount.toString();

  console.log("[EQUIPMENTS] Stats updated:", {
    connectivity: `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`,
    total: devices.length,
    consumptionFromOrchestrator: totalConsumption,
    zeroCount: zeroConsumptionCount
  });
}

// ============================================
// RFC-0072: MODAL MANAGEMENT UTILITIES
// ============================================

/**
 * Creates a proper modal backdrop
 * @returns {HTMLElement} The backdrop element
 */
function createModalBackdrop() {
  const backdrop = document.createElement('div');
  backdrop.className = 'dashboard-modal-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 9998;
    animation: fadeIn 0.2s ease-in;
  `;

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeExistingModals();
    }
  });

  return backdrop;
}

/**
 * Closes any existing modal instances to prevent conflicts
 */
function closeExistingModals() {
  // Close any existing energy dashboards
  const existingModals = document.querySelectorAll('.energy-dashboard-modal, .dashboard-popup, .myio-modal-overlay');
  existingModals.forEach(modal => {
    modal.remove();
  });

  // Remove backdrops
  const backdrops = document.querySelectorAll('.dashboard-modal-backdrop, .modal-backdrop');
  backdrops.forEach(backdrop => {
    backdrop.remove();
  });

  console.log("[EQUIPMENTS] [RFC-0072] Cleaned up existing modals");
}

/**
 * RFC-0072: Get customer name for a device
 * @param {Object} device - Device object
 * @returns {string} Customer name or fallback
 */
function getCustomerNameForDevice(device) {
  // Priority 1: Check if customerId exists and look it up
  if (device.customerId && window.custumersSelected && Array.isArray(window.custumersSelected)) {
    const shopping = window.custumersSelected.find(c => c.value === device.customerId);
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

// ============================================
// END RFC-0072 MODAL UTILITIES
// ============================================

// Initialize cards
function initializeCards(devices) {
  const grid = document.getElementById("cards-grid");

  grid.innerHTML = "";

  devices.forEach((device, index) => {
    const container = document.createElement("div");
    //console.log("[EQUIPMENTS] Rendering device:", device);
    grid.appendChild(container);
    

    const valNum = Number(device.value || 0);
    const connectionStatus = valNum > 0 ? "power_on" : "power_off";

    // Garantir que o deviceStatus existe (fallback para no_info se não existir)
    if (!device.deviceStatus) {
      device.deviceStatus = device.connectionStatus;
    }
    
    const customerName = getCustomerNameForDevice(device);
    device.customerName = customerName;

    /*
    console.log("[EQUIPMENTS] Device customerName set:", {
      labelOrName: device.labelOrName,
      customerName: device.customerName,
      customerId: device.customerId,
      ingestionId: device.ingestionId
    });
    */

    if (device.labelOrName && device.labelOrName.toUpperCase().includes("ELEVADOR")) {
      //console.log("[EQUIPMENTS] Rendering card for Chiller 1 device:", device);
    } 

    const handle = MyIOLibrary.renderCardComponentHeadOffice(container, {
      entityObject: device,
      handleActionDashboard: async () => {
        // RFC-0072: Enhanced modal handling to prevent corruption
        console.log("[EQUIPMENTS] [RFC-0072] Opening energy dashboard for:", device.entityId);

        try {
          // 1. Ensure component is available
          if (typeof MyIOLibrary.openDashboardPopupEnergy !== 'function') {
            console.error("[EQUIPMENTS] [RFC-0072] openDashboardPopupEnergy component not loaded");
            alert("Dashboard component não disponível");
            return;
          }

          // 2. Clean up any existing modal state
          closeExistingModals();

          // 3. Get tokens
          const tokenIngestionDashBoard = await MyIOAuth.getToken();
          const myTbTokenDashBoard = localStorage.getItem("jwt_token");

          if (!myTbTokenDashBoard) {
            throw new Error("JWT token não encontrado");
          }

          // 4. Inject backdrop first
          const backdrop = createModalBackdrop();
          document.body.appendChild(backdrop);

          // 5. Wait for next frame to ensure DOM is ready
          await new Promise(resolve => requestAnimationFrame(resolve));

          // 6. Open modal with proper error handling
          const modal = MyIOLibrary.openDashboardPopupEnergy({
            deviceId: device.entityId,
            readingType: "energy",
            startDate: self.ctx.$scope.startDateISO,
            endDate: self.ctx.$scope.endDateISO,
            tbJwtToken: myTbTokenDashBoard,
            ingestionToken: tokenIngestionDashBoard,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            onOpen: (context) => {
              console.log("[EQUIPMENTS] [RFC-0072] Modal opened:", context);
            },
            onError: (error) => {
              console.error("[EQUIPMENTS] [RFC-0072] Modal error:", error);
              backdrop.remove();
              alert(`Erro: ${error.message}`);
            },
            onClose: () => {
              backdrop.remove();
              const overlay = document.querySelector(".myio-modal-overlay");
              if (overlay) {
                overlay.remove();
              }
              console.log("[EQUIPMENTS] [RFC-0072] Energy dashboard closed");
            },
          });

          // 7. Verify modal was created
          if (!modal) {
            console.error("[EQUIPMENTS] [RFC-0072] Modal failed to initialize");
            backdrop.remove();
            alert("Erro ao abrir dashboard");
            return;
          }

          console.log("[EQUIPMENTS] [RFC-0072] Energy dashboard opened successfully");

        } catch (err) {
          console.error("[EQUIPMENTS] [RFC-0072] Error opening energy dashboard:", err);
          closeExistingModals();
          alert("Credenciais ainda carregando. Tente novamente em instantes.");
        }
      },

      handleActionReport: async () => {
        try {
          const ingestionToken = await MyIOAuth.getToken();

          if (!ingestionToken) throw new Error("No ingestion token");

          await MyIOLibrary.openDashboardPopupReport({
            ingestionId: device.ingestionId,
            identifier: device.deviceIdentifier,
            label: device.labelOrName,
            domain: "energy",
            api: {
              dataApiBaseUrl: DATA_API_HOST,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              ingestionToken,
            },
          });
        } catch (err) {
          console.warn(
            "[DeviceCards] Report open blocked:",
            err?.message || err
          );
          alert("Credenciais ainda carregando. Tente novamente em instantes.");
        } finally {
        }
      },

      handleActionSettings: async () => {
        // RFC-0072: Standardized settings handler following TELEMETRY pattern
        console.log("[EQUIPMENTS] [RFC-0072] Opening settings for device:", device.entityId);

        const jwt = localStorage.getItem("jwt_token");
        if (!jwt) {
          console.error("[EQUIPMENTS] [RFC-0072] JWT token not found");
          alert("Token de autenticação não encontrado");
          return;
        }

        //console.log("[EQUIPMENTS] ", device.deviceStatus);
        console.log("[EQUIPMENTS] device.deviceStatus:", device.deviceStatus);
        console.log('[EQUIPMENTS] device.lastConnectTime:', device.lastConnectTime);
        

        try {
          // RFC-0072: Following exact TELEMETRY pattern with domain and connectionData
          // RFC-0077: Added customerName and deviceType parameters
          // RFC-0076: Added deviceProfile for 3F_MEDIDOR fallback rule
          await MyIOLibrary.openDashboardPopupSettings({
            deviceId: device.entityId, // TB deviceId
            label: device.labelOrName,
            jwtToken: jwt,
            domain: "energy", // Same as TELEMETRY WIDGET_DOMAIN
            deviceType: device.deviceType, // RFC-0077: Pass deviceType for Power Limits feature
            deviceProfile: device.deviceProfile, // RFC-0076: Pass deviceProfile for 3F_MEDIDOR fallback
            customerName: device.customerName || getCustomerNameForDevice(device), // RFC-0077: Pass shopping name
            connectionData: {
              centralName: device.centralName || getCustomerNameForDevice(device),
              connectionStatusTime: device.lastConnectTime,
              timeVal: device.lastActivityTime || new Date('1970-01-01').getTime(),
              deviceStatus: device.deviceStatus || 'offline',
              lastDisconnectTime: device.lastDisconnectTime || 0,
            },
            ui: { title: "Configurações", width: 900 },
            onSaved: (payload) => {
              console.log("[EQUIPMENTS] [RFC-0072] Settings saved:", payload);
              // Mostra modal global de sucesso com contador e reload
              showGlobalSuccessModal(6);
            },
            onClose: () => {
              $(".myio-settings-modal-overlay").remove();
              const overlay = document.querySelector(".myio-modal-overlay");
              if (overlay) {
                overlay.remove();
              }
              console.log("[EQUIPMENTS] [RFC-0072] Settings modal closed");
            },
          });
        } catch (e) {
          console.error("[EQUIPMENTS] [RFC-0072] Error opening settings:", e);
          alert("Erro ao abrir configurações");
        }
      },
      handleSelect: (checked, entity) => {
        log(
          `Selection ${checked ? "checked" : "unchecked"}: ${
            entity.labelOrName
          }`
        );
      },
      handleClickCard: (ev, entity) => {
        log(`Card clicked: ${entity.labelOrName} - Power: ${entity.val}kWh`);
      },
      useNewComponents: true,
      enableSelection: true,
      enableDragDrop: true,
      // RFC-0072: Disable "More Information" menu item (redundant with card click)
      hideInfoMenuItem: true,
    });

    // O componente renderCardComponentHeadOffice agora gerencia o estilo baseado em deviceStatus
    // Não é mais necessário aplicar classes manualmente
  });

  log("Cards initialized successfully");
}

self.onInit = async function () {
  console.log("[EQUIPMENTS] onInit - ctx:", self.ctx);
    // ⭐ CRITICAL FIX: Show loading IMMEDIATELY before setTimeout
    showLoadingOverlay(true);

    setTimeout(async () => {
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
          resolve({ start: s, end: e, from: "state/event" });
          return true;
        }
        return false;
      };

      const onEvt = (ev) => {
        tryResolve(ev.detail);
      };

      const cleanup = () => {
        window.removeEventListener("myio:date-params", onEvt);
        if (poller) clearInterval(poller);
        if (timer) clearTimeout(timer);
      };

      // 1) escuta evento do pai
      window.addEventListener("myio:date-params", onEvt);

      // 2) tenta estado atual imediatamente
      if (tryResolve(window.myioStateParams || {})) return;

      // 3) solicita explicitamente ao pai
      window.dispatchEvent(new CustomEvent("myio:request-date-params"));

      // 4) polling leve a cada 300ms
      poller = setInterval(() => {
        tryResolve(window.myioStateParams || {});
      }, pollMs);

      // 5) timeout de segurança -> usa fallback (últimos 7 dias)
      timer = setTimeout(() => {
        if (!resolved) {
          cleanup();
          const end = new Date();
          const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
          const startISO = start.toISOString();
          const endISO = end.toISOString();
          applyParams({
            globalStartDateFilter: startISO,
            globalEndDateFilter: endISO,
          });
          resolve({ start: startISO, end: endISO, from: "fallback-7d" });
        }
      }, timeoutMs);
    });
  }

  // ====== fluxo do widget ======
  // tenta aplicar o que já existir (não bloqueia)
  applyParams(window.myioStateParams || {});

  // garante sincronização inicial antes de continuar
  const datesFromParent = await waitForDateParams({
    pollMs: 300,
    timeoutMs: 15000,
  });
  console.log("[EQUIPMENTS] date params ready:", datesFromParent);

  // agora já pode carregar dados / inicializar UI dependente de datas
  if (typeof self.loadData === "function") {
    await self.loadData(
      self.ctx.$scope.startDateISO,
      self.ctx.$scope.endDateISO
    );
  }

  //console.log("[EQUIPAMENTS] scope", scope.ctx)

  // mantém sincronizado em updates futuros do pai/irmão A
  self._onDateParams = (ev) => {
    applyParams(ev.detail);
    if (typeof self.loadData === "function") {
      self.loadData(self.ctx.$scope.startDateISO, self.ctx.$scope.endDateISO);
    }
  };
  window.addEventListener("myio:date-params", self._onDateParams);

  // ✅ Listen for shopping filter from MENU
  self._onFilterApplied = (ev) => {
    console.log("[EQUIPMENTS] heard myio:filter-applied:", ev.detail);

    // Extract shopping IDs from selection
    const selection = ev.detail?.selection || [];
    const shoppingIds = selection.map(s => s.value).filter(v => v);

    console.log("[EQUIPMENTS] Applying shopping filter:", shoppingIds.length === 0 ? "ALL" : `${shoppingIds.length} shoppings`);

    // Update STATE and reflow cards
    STATE.selectedShoppingIds = shoppingIds;

    // Render shopping filter chips
    renderShoppingFilterChips(selection);

    reflowCards();
  };
  window.addEventListener("myio:filter-applied", self._onFilterApplied);

  // Function to render shopping filter chips in toolbar
  function renderShoppingFilterChips(selection) {
    const chipsContainer = document.getElementById("shoppingFilterChips");
    if (!chipsContainer) return;

    chipsContainer.innerHTML = "";

    if (!selection || selection.length === 0) {
      return; // No filter applied, hide chips
    }

    selection.forEach(shopping => {
      const chip = document.createElement("span");
      chip.className = "filter-chip";
      chip.innerHTML = `<span class="filter-chip-icon">🏬</span><span>${shopping.name}</span>`;
      chipsContainer.appendChild(chip);
    });

    console.log("[EQUIPMENTS] 📍 Rendered", selection.length, "shopping filter chips");
  }

  //  console.log("[equipaments] self.ctx:", self.ctx);
  CUSTOMER_ID = self.ctx.settings.customerId || " ";
  // console.log("[equipaments] CUSTOMER_ID:", CUSTOMER_ID);

  // Objeto principal para armazenar os dados dos dispositivos
  const devices = {};

  // 🗺️ NOVO: Mapa para conectar o ingestionId ao ID da entidade do ThingsBoard
  const ingestionIdToEntityIdMap = new Map();

  // --- FASE 1: Monta o objeto inicial e o mapa de IDs ---
  self.ctx.data.forEach((data) => {
    if (data.datasource.aliasName !== "Shopping") {
      const entityId = data.datasource.entity.id.id;

      // Cria o objeto do dispositivo se for a primeira vez
      if (!devices[entityId]) {
        devices[entityId] = {
          name: data.datasource.name,
          label: data.datasource.entityLabel,
          values: [],
        };
      }

      // Adiciona o valor atual ao array
      devices[entityId].values.push({
        dataType: data.dataKey.name,
        value: data.data[0][1],
        ts: data.data[0][0],
      });

      //console.log(`[EQUIPMENTS] Device ${entityId} - Added dataKey: ${data.dataKey.name} with value: ${data.data[0][1]}`);
      //console.log(`[EQUIPMENTS] Current device values:`, devices[entityId].values);

      // ✅ LÓGICA DO MAPA: Se o dado for o ingestionId, guardamos a relação
      if (data.dataKey.name === "ingestionId" && data.data[0][1]) {
        const ingestionId = data.data[0][1];
        ingestionIdToEntityIdMap.set(ingestionId, entityId);
      }
    }
  });

  const boolExecSync = false;

  // RFC-0071: Trigger device profile synchronization (runs once)
  if (!__deviceProfileSyncComplete && boolExecSync) {
    try {
      console.log("[EQUIPMENTS] [RFC-0071] Triggering device profile sync...");
      const syncResult = await syncDeviceProfileAttributes();
      __deviceProfileSyncComplete = true;

      if (syncResult.synced > 0) {
        console.log("[EQUIPMENTS] [RFC-0071] ⚠️ Widget reload recommended to load new deviceProfile attributes");
        console.log("[EQUIPMENTS] [RFC-0071] You may need to refresh the dashboard to see deviceProfile in ctx.data");
      }
    } catch (error) {
      console.error("[EQUIPMENTS] [RFC-0071] Sync failed, continuing without it:", error);
      // Don't block widget initialization if sync fails
    }
  }

  const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_ID);

  CLIENT_ID = customerCredentials.client_id || " ";
  CLIENT_SECRET = customerCredentials.client_secret || " ";
  INGESTION_ID = customerCredentials.ingestionId || " ";

  // 🚨 RFC-0077: Fetch customer consumption limits ONCE before processing devices
  // This will be used by getConsumptionRangesHierarchical as TIER 2 fallback
  console.log("[EQUIPMENTS] [RFC-0077] Fetching customer consumption limits for CUSTOMER_ID:", CUSTOMER_ID);
  try {
    window.__customerConsumptionLimits = await getCachedConsumptionLimits(CUSTOMER_ID);
    console.log("[EQUIPMENTS] [RFC-0077] Customer consumption limits loaded:", window.__customerConsumptionLimits);
  } catch (error) {
    console.error("[EQUIPMENTS] [RFC-0077] Failed to fetch customer consumption limits, will use hardcoded defaults:", error);
    window.__customerConsumptionLimits = null;
  }

  // ✅ Loading overlay already shown at start of onInit (moved up for better UX)
   async function renderDeviceCards() {
    const promisesDeCards = Object.entries(devices)
      .filter(([entityId, device]) =>
        device.values.some((valor) => valor.dataType === "total_consumption")
      )
      .map(async ([entityId, device]) => {
        const tbToken = localStorage.getItem("jwt_token");
              
        const lastConnectTimestamp = findValue(device.values, "lastConnectTime", "");
        const lastDisconnectTimestamp = findValue(device.values, "lastDisconnectTime", "");

        let operationHoursFormatted = "0s";

        if (lastConnectTimestamp) {
          const nowMs = new Date().getTime();
          const durationMs = nowMs - lastConnectTimestamp;
          operationHoursFormatted = formatarDuracao(durationMs > 0 ? durationMs : 0);
        }

        const deviceTemperature = await getDeviceTemperature(entityId, tbToken);
        const latestTimestamp = Math.max(...device.values.map((v) => v.ts || 0));
        const updatedFormatted = formatRelativeTime(latestTimestamp);

        const rawConnectionStatus = findValue(device.values, "connectionStatus", "offline");
        const consumptionValue = findValue(device.values, "total_consumption", 0);

        let mappedConnectionStatus = "offline";
        const statusLower = String(rawConnectionStatus).toLowerCase();
        
        if (statusLower === "online" || statusLower === "ok" || statusLower === "running") {
          mappedConnectionStatus = "online";
        } else if (statusLower === "waiting") {
          mappedConnectionStatus = "waiting";
        }

        const deviceProfile = findValue(device.values, "deviceProfile", "").toUpperCase();
        let deviceType = findValue(device.values, "deviceType", "").toUpperCase();

        if (deviceType === "3F_MEDIDOR" && deviceProfile !== "N/D") {
          deviceType = deviceProfile;
        }

        // 🚨 RFC-0077: HARDCODED SWITCH ELIMINATED!
        // Now using hierarchical resolution: Device → Customer → Hardcoded defaults

        // Get deviceId for TIER 1 lookup
        const deviceId = entityId;

        // Get consumption ranges using hierarchical resolution
        const rangesWithSource = await getConsumptionRangesHierarchical(
          deviceId,
          deviceType,
          window.__customerConsumptionLimits // Will be set below
        );

        // Calculate device status using range-based calculation
        const deviceStatus = MyIOLibrary.calculateDeviceStatusWithRanges({
          connectionStatus: mappedConnectionStatus,
          lastConsumptionValue: Number(consumptionValue) || null,
          ranges: rangesWithSource
        });

        const ingestionId = findValue(device.values, "ingestionId", null);
        let customerId = findValue(device.values, "customerId", null);

        // Fallback: Try to get customerId from MAIN's energyCache (API has it, ctx.data doesn't)
        if (!customerId && ingestionId && energyCacheFromMain && energyCacheFromMain.has(ingestionId)) {
          customerId = energyCacheFromMain.get(ingestionId).customerId;
        }

        // Populate global device-to-shopping map for filter fallback
        if (ingestionId && customerId) {
          if (!window.myioDeviceToShoppingMap) {
            window.myioDeviceToShoppingMap = new Map();
          }
          window.myioDeviceToShoppingMap.set(ingestionId, customerId);
        }

        return {
          entityId: entityId,
          labelOrName: device.label,
          val: consumptionValue,
          deviceIdentifier: findValue(device.values, "identifier"),
          centralName: findValue(device.values, "centralName", null),
          ingestionId: ingestionId,
          customerId: customerId, // Shopping ingestionId for filtering
          deviceType: deviceType,
          deviceStatus: deviceStatus,
          valType: "power_kw",
          perc: Math.floor(Math.random() * (95 - 70 + 1)) + 70,
          temperatureC: deviceTemperature[0].value,
          operationHours: operationHoursFormatted || 0,
          updated: updatedFormatted,
          lastDisconnectTime: lastDisconnectTimestamp,
          lastConnectTime: lastConnectTimestamp,
          lastActivityTime: findValue(device.values, "lastActivityTime", null),
          // RFC-0058: Add properties for MyIOSelectionStore (FOOTER)
          id: entityId,                    // Alias for entityId
          name: device.label,              // Alias for labelOrName
          lastValue: consumptionValue,     // Alias for val
          unit: 'kWh',                     // Energy unit
          icon: 'energy'                   // Domain identifier for SelectionStore
        };
      });

    const devicesFormatadosParaCards = await Promise.all(promisesDeCards);

    /**
     * TODO: TEMPORARY FIX - Remove when backend data is corrected
     * Some devices have deviceType = 3F_MEDIDOR but are actually equipment.
     * Check label for equipment keywords to properly classify them.
     */
    function isActuallyEquipment(device) {
      if (device.deviceType !== "3F_MEDIDOR") {
        return true; // Not 3F_MEDIDOR, definitely equipment
      }

      // Check if label contains equipment keywords
      /*
      const label = String(device.labelOrName || "").toLowerCase();
      const equipmentKeywords = ["elevador", "chiller", "bomba", "escada", "casa de m"];

      return equipmentKeywords.some(keyword => label.includes(keyword));
      */

      const deviceTypeEquipmentKeywords = ["MOTOR", "ELEVADOR", "ESCADA_ROLANTE"];

      return deviceTypeEquipmentKeywords.some(keyword => device.deviceType.toLowerCase().includes(keyword));      
    }

    // ✅ Separate lojas from equipments based on deviceType AND label validation
    const lojasDevices = devicesFormatadosParaCards.filter(d => !isActuallyEquipment(d));
    const equipmentDevices = devicesFormatadosParaCards.filter(d => isActuallyEquipment(d));

    // Debug: Log 3F_MEDIDOR devices classified as equipment (TODO: temporary)
    const medidorAsEquipment = equipmentDevices.filter(d => d.deviceType === "3F_MEDIDOR");
    if (medidorAsEquipment.length > 0) {
      console.warn("[EQUIPMENTS] ⚠️ Found", medidorAsEquipment.length, "3F_MEDIDOR devices classified as equipment (based on label):");
      medidorAsEquipment.forEach(d => {
        console.log("  -", d.labelOrName, "(deviceType:", d.deviceType, ")");
      });
    }

    console.log("[EQUIPMENTS] Total devices:", devicesFormatadosParaCards.length);
    console.log("[EQUIPMENTS] Equipment devices:", equipmentDevices.length);
    console.log("[EQUIPMENTS] Lojas (actual 3F_MEDIDOR stores):", lojasDevices.length);

    // ✅ Emit event to inform MAIN about lojas ingestionIds
    const lojasIngestionIds = lojasDevices.map(d => d.ingestionId).filter(id => id); // Remove nulls

    window.dispatchEvent(new CustomEvent('myio:lojas-identified', {
      detail: {
        lojasIngestionIds,
        lojasCount: lojasIngestionIds.length,
        timestamp: Date.now()
      }
    }));

    console.log("[EQUIPMENTS] ✅ Emitted myio:lojas-identified:", {
      lojasCount: lojasIngestionIds.length,
      lojasIngestionIds
    });

    // ✅ Save ONLY equipment devices to global STATE for filtering
    STATE.allDevices = equipmentDevices;

    // Log device-to-shopping mapping stats
    if (window.myioDeviceToShoppingMap) {
      console.log(`[EQUIPMENTS] 🗺️ Device-to-shopping map populated: ${window.myioDeviceToShoppingMap.size} devices mapped`);

      // Debug: show sample mappings
      if (window.myioDeviceToShoppingMap.size > 0) {
        const samples = Array.from(window.myioDeviceToShoppingMap.entries()).slice(0, 3);
        console.log(`[EQUIPMENTS] 📋 Sample mappings:`, samples.map(([deviceId, shopId]) => `${deviceId.substring(0, 8)}... → ${shopId.substring(0, 8)}...`));
      }
    }

    initializeCards(equipmentDevices);

    // Update statistics header (only equipments)
    updateEquipmentStats(equipmentDevices);

    // RFC: Emit initial equipment count to HEADER
    emitEquipmentCountEvent(equipmentDevices);

    // Hide loading after rendering
    showLoadingOverlay(false);
  }

  // Function to render all available shoppings as chips (default: all selected)
  function renderAllShoppingsChips(customers) {
    if (!customers || !Array.isArray(customers) || customers.length === 0) {
      console.warn("[EQUIPMENTS] ⚠️ No customers provided to render as chips");
      return;
    }

    console.log(`[EQUIPMENTS] 🏬 Rendering ${customers.length} shoppings as pre-selected`);

    // Render chips with all customers
    renderShoppingFilterChips(customers);
  }

  // ✅ Listen for customers ready event from MENU
  self._onCustomersReady = (ev) => {
    console.log("[EQUIPMENTS] 🔔 heard myio:customers-ready:", ev.detail);

    const customers = ev.detail?.customers || [];
    if (customers.length > 0) {
      // RFC: Save total shoppings count for HEADER card logic
      STATE.totalShoppings = customers.length;
      console.log(`[EQUIPMENTS] 📊 Total shoppings available: ${STATE.totalShoppings}`);

      renderAllShoppingsChips(customers);
    }
  };
  window.addEventListener("myio:customers-ready", self._onCustomersReady);

    function enrichDevicesWithConsumption() {
    if (!energyCacheFromMain) {
      console.warn("[EQUIPMENTS] No energy from MAIN available yet");
      return;
    }

    console.log("[EQUIPMENTS] Enriching devices with consumption from MAIN...");

    // Iterate through devices and add consumption from cache
    Object.entries(devices).forEach(([entityId, device]) => {
      // Find ingestionId for this device
      const ingestionIdItem = device.values.find(v => v.dataType === "ingestionId");
      if (ingestionIdItem && ingestionIdItem.value) {
        const ingestionId = ingestionIdItem.value;
        const cached = energyCacheFromMain.get(ingestionId);

        if (cached) {
          // Remove old consumption data if exists
          const consumptionIndex = device.values.findIndex(v => v.dataType === "total_consumption");
          if (consumptionIndex >= 0) {
            device.values[consumptionIndex] = {
              val: cached.total_value,
              ts: cached.timestamp,
              dataType: "total_consumption",
            };
          } else {
            device.values.push({
              val: cached.total_value,
              ts: cached.timestamp,
              dataType: "total_consumption",
            });
          }
        }
      }
    });

    // RFC-0076: CRITICAL FIX - Enrich energyCache with full device metadata
    // This ensures ENERGY widget can classify elevators correctly
    console.log("[EQUIPMENTS] 🔧 Enriching energyCache with device metadata (deviceType, deviceProfile)...");

    let enrichedCount = 0;
    Object.entries(devices).forEach(([entityId, device]) => {
      const ingestionIdItem = device.values.find(v => v.dataType === "ingestionId");
      if (ingestionIdItem && ingestionIdItem.value) {
        const ingestionId = ingestionIdItem.value;
        const cached = energyCacheFromMain.get(ingestionId);

        if (cached) {
          // Get metadata from device.values
          const deviceType = findValue(device.values, "type", "");
          const deviceProfile = findValue(device.values, "deviceProfile", "");
          const deviceIdentifier = findValue(device.values, "deviceIdentifier", "");
          const deviceName = findValue(device.values, "name", "");

          // RFC-0076: Enrich cache with full metadata
          cached.deviceType = deviceType;
          cached.deviceProfile = deviceProfile;
          cached.deviceIdentifier = deviceIdentifier;
          cached.name = cached.name || deviceName;

          enrichedCount++;

          // RFC-0076: Log elevators specifically (by deviceProfile OR deviceType OR name)
          if (deviceType === "ELEVADOR" ||
              deviceProfile === "ELEVADOR" ||  // ← FIXED: Check deviceProfile independently!
              (deviceType === "3F_MEDIDOR" && deviceProfile === "ELEVADOR") ||
              (deviceName && deviceName.toUpperCase().includes("ELV"))) {
                /*
            console.log(`[EQUIPMENTS] ⚡ ELEVATOR enriched:`, {
              ingestionId,
              name: deviceName,
              deviceType: deviceType || "(empty)",
              deviceProfile,
              deviceIdentifier,
              consumption: cached.total_value
            });
            */
          }
        }
      }
    });

    console.log(`[EQUIPMENTS] ✅ Enriched ${enrichedCount} devices in energyCache with metadata`);

    // RFC-0076: Force update on ENERGY widget by re-emitting the cache
    const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
    if (orchestrator) {
      console.log("[EQUIPMENTS] 🔄 Forcing ENERGY widget update...");
      window.dispatchEvent(new CustomEvent('myio:equipment-metadata-enriched', {
        detail: {
          cache: energyCacheFromMain,
          deviceCount: enrichedCount,
          timestamp: Date.now()
        }
      }));
    }

    // Re-render cards and hide loading
    renderDeviceCards().then(() => {
      showLoadingOverlay(false);
    });
  }

    const findValue = (values, dataType, defaultValue = "N/D") => {
    const item = values.find((v) => v.dataType === dataType);
    if (!item) return defaultValue;
    // Retorna a propriedade 'val' (da nossa API) ou 'value' (do ThingsBoard)
    return item.val !== undefined ? item.val : item.value;
  };

  async function waitForOrchestrator(timeoutMs = 15000) {
  return new Promise((resolve) => {
    let interval;
    const timeout = setTimeout(() => {
      clearInterval(interval);
      console.error("[EQUIPMENTS] Timeout: MyIOOrchestrator não foi encontrado na window.");
      resolve(null);
    }, timeoutMs);

    interval = setInterval(() => {
      // RFC-0057: No longer checking window.parent - not using iframes
      const orchestrator = window.MyIOOrchestrator;
      if (orchestrator) {
        clearTimeout(timeout);
        clearInterval(interval);
        console.log("[EQUIPMENTS] MyIOOrchestrator encontrado!");
        resolve(orchestrator);
      }
    }, 100); // Verifica a cada 100ms
  });
}


  // ===== EQUIPMENTS: Listen for energy cache from MAIN orchestrator =====
     let energyCacheFromMain = null;

    // Função para processar os dados recebidos e renderizar
    async function processAndRender(cache) {
      if (!cache || cache.size === 0) {
        console.warn("[EQUIPMENTS] Cache de energia está vazio. Nenhum card será renderizado.");
        showLoadingOverlay(false);
        return;
      }
      
      energyCacheFromMain = cache;
      enrichDevicesWithConsumption(); // A sua função original é chamada aqui
      await renderDeviceCards();      // E a sua outra função original é chamada aqui
    }

    // Lógica principal: "verificar-depois-ouvir"
const orchestrator = await waitForOrchestrator();

if (orchestrator) {
  const existingCache = orchestrator.getCache();

  if (existingCache && existingCache.size > 0) {
    // CAMINHO 1: (Navegação de volta)
    console.log("[EQUIPMENTS] Cache do Orquestrador já existe. Usando-o diretamente.");
    await processAndRender(existingCache);
  } else {
    // CAMINHO 2: (Primeiro carregamento)
    console.log("[EQUIPMENTS] Cache vazio. Aguardando evento 'myio:energy-data-ready'...");
    const waitForEnergyCache = new Promise((resolve) => {
      const handlerTimeout = setTimeout(() => {
        console.warn("[EQUIPMENTS] Timeout esperando pelo evento de cache.");
        resolve(null);
      }, 15000);

      const handler = (ev) => {
        clearTimeout(handlerTimeout);
        window.removeEventListener('myio:energy-data-ready', handler);
        resolve(ev.detail.cache);
      };
      window.addEventListener('myio:energy-data-ready', handler);
    });
    
    const initialCache = await waitForEnergyCache;
    await processAndRender(initialCache);
  }
} else {
  // O erro do timeout já terá sido logado pela função 'waitForOrchestrator'
  showLoadingOverlay(false);
}
  // RFC-0072: Zoom controls removed - use browser native zoom instead
  // Zoom functionality commented out to reduce complexity and rely on browser zoom
  /*
  const wrap = document.getElementById("equipWrap");
  const key = `tb-font-scale:${ctx?.widget?.id || "equip"}`;
  const saved = +localStorage.getItem(key);
  if (saved && saved >= 0.8 && saved <= 1.4)
    wrap.style.setProperty("--fs", saved);

  const getScale = () => +getComputedStyle(wrap).getPropertyValue("--fs") || 1;
  const setScale = (v) => {
    const s = Math.min(1.3, Math.max(0.8, +v.toFixed(2)));
    wrap.style.setProperty("--fs", s);
    localStorage.setItem(key, s);
  };

  document
    .getElementById("fontMinus")
    ?.addEventListener("click", () => setScale(getScale() - 0.06));
  document
    .getElementById("fontPlus")
    ?.addEventListener("click", () => setScale(getScale() + 0.06));
  */
    }, 0)

  // ====== FILTER & SEARCH LOGIC ======
  bindFilterEvents();
};

// Global state for filters
const STATE = {
  allDevices: [],
  searchActive: false,
  searchTerm: "",
  selectedIds: null,
  sortMode: 'cons_desc',
  selectedShoppingIds: [], // Shopping filter from MENU
  totalShoppings: 0 // Total number of shoppings available
};

/**
 * RFC: Emit event to update HEADER equipment card
 * Sends total equipment count and filtered count
 */
function emitEquipmentCountEvent(filteredDevices) {
  const totalEquipments = STATE.allDevices.length;
  const filteredEquipments = filteredDevices.length;

  // Check if all shoppings are selected (no filter or all selected)
  const allShoppingsSelected = STATE.selectedShoppingIds.length === 0 ||
                                STATE.selectedShoppingIds.length === STATE.totalShoppings;

  const eventData = {
    totalEquipments,
    filteredEquipments,
    allShoppingsSelected,
    timestamp: Date.now()
  };

  window.dispatchEvent(new CustomEvent('myio:equipment-count-updated', {
    detail: eventData
  }));

  console.log("[EQUIPMENTS] ✅ Emitted myio:equipment-count-updated:", eventData);
}

/**
 * Apply filters and sorting to devices
 */
function applyFilters(devices, searchTerm, selectedIds, sortMode) {
  let filtered = devices.slice();

  // Apply shopping filter (from MENU)
  if (STATE.selectedShoppingIds && STATE.selectedShoppingIds.length > 0) {
    const before = filtered.length;
    filtered = filtered.filter(d => {
      // If device has no customerId, include it (safety)
      if (!d.customerId) return true;
      // Check if device's customerId is in the selected shoppings
      return STATE.selectedShoppingIds.includes(d.customerId);
    });
    console.log(`[EQUIPMENTS] Shopping filter applied: ${before} -> ${filtered.length} devices (${before - filtered.length} filtered out)`);
  }

  // Apply multiselect filter
  if (selectedIds && selectedIds.size > 0) {
    filtered = filtered.filter(d => selectedIds.has(d.entityId));
  }

  // Apply search filter
  const query = (searchTerm || "").trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(d =>
      String(d.labelOrName || "").toLowerCase().includes(query) ||
      String(d.deviceIdentifier || "").toLowerCase().includes(query) ||
      String(d.deviceType || "").toLowerCase().includes(query)
    );
  }

  // Apply sorting
  filtered.sort((a, b) => {
    const valA = Number(a.val) || Number(a.lastValue) || 0;
    const valB = Number(b.val) || Number(b.lastValue) || 0;
    const nameA = String(a.labelOrName || "").toLowerCase();
    const nameB = String(b.labelOrName || "").toLowerCase();

    switch (sortMode) {
      case 'cons_desc':
        return valB !== valA ? valB - valA : nameA.localeCompare(nameB);
      case 'cons_asc':
        return valA !== valB ? valA - valB : nameA.localeCompare(nameB);
      case 'alpha_asc':
        return nameA.localeCompare(nameB);
      case 'alpha_desc':
        return nameB.localeCompare(nameA);
      default:
        return 0;
    }
  });

  return filtered;
}

/**
 * Re-render cards with current filters
 */
function reflowCards() {
  const filtered = applyFilters(STATE.allDevices, STATE.searchTerm, STATE.selectedIds, STATE.sortMode);

  console.log("[EQUIPMENTS] Reflow with filters:", {
    total: STATE.allDevices.length,
    filtered: filtered.length,
    searchTerm: STATE.searchTerm,
    selectedCount: STATE.selectedIds?.size || 0,
    sortMode: STATE.sortMode
  });

  initializeCards(filtered);
  updateEquipmentStats(filtered);

  // RFC: Emit event to update HEADER card
  emitEquipmentCountEvent(filtered);
}

/**
 * RFC-0072: Setup modal handlers (called once when modal is moved to document.body)
 */
function setupModalCloseHandlers(modal) {
  // Close button
  const closeBtn = modal.querySelector("#closeFilter");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeFilterModal);
  }

  // Backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeFilterModal();
    }
  });

  // Apply filters button
  const applyBtn = modal.querySelector("#applyFilters");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      // Get selected devices
      const checkboxes = modal.querySelectorAll("#deviceChecklist input[type='checkbox']:checked");
      const selectedSet = new Set();
      checkboxes.forEach(cb => {
        const deviceId = cb.getAttribute("data-device-id");
        if (deviceId) selectedSet.add(deviceId);
      });

      // If all devices are selected, treat as "no filter"
      STATE.selectedIds = selectedSet.size === STATE.allDevices.length ? null : selectedSet;

      // Get sort mode
      const sortRadio = modal.querySelector('input[name="sortMode"]:checked');
      if (sortRadio) {
        STATE.sortMode = sortRadio.value;
      }

      // Apply filters and close modal with cleanup
      reflowCards();
      closeFilterModal();

      console.log("[EQUIPMENTS] [RFC-0072] Filters applied:", {
        selectedCount: STATE.selectedIds?.size || STATE.allDevices.length,
        sortMode: STATE.sortMode
      });
    });
  }

  // Reset filters button
  const resetBtn = modal.querySelector("#resetFilters");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      // Reset state
      STATE.selectedIds = null;
      STATE.sortMode = 'cons_desc';
      STATE.searchTerm = "";
      STATE.searchActive = false;

      // Reset UI
      const searchInput = document.getElementById("equipSearch");
      const searchWrap = document.getElementById("searchWrap");
      if (searchInput) searchInput.value = "";
      if (searchWrap) searchWrap.classList.remove("active");

      // Apply and close with cleanup
      reflowCards();
      closeFilterModal();

      console.log("[EQUIPMENTS] [RFC-0072] Filters reset");
    });
  }

  console.log("[EQUIPMENTS] [RFC-0072] Modal handlers bound (close, apply, reset)");
}

/**
 * RFC-0072: Open filter modal with full-screen support and ESC key handling
 * Following MENU widget pattern: modal attached to document.body
 */
function openFilterModal() {
  console.log("[EQUIPMENTS] [RFC-0072] Opening full-screen filter modal");

  // RFC-0072: Get or create global modal container (like MENU widget)
  let globalContainer = document.getElementById("equipmentsFilterModalGlobal");

  if (!globalContainer) {
    // Modal doesn't exist, move it from widget to document.body
    const widgetModal = document.getElementById("filterModal");
    if (widgetModal) {
      // Extract modal from widget and wrap in global container
      globalContainer = document.createElement("div");
      globalContainer.id = "equipmentsFilterModalGlobal";

      // RFC-0072: Inject styles inline (like MENU widget) so they work outside widget scope
      globalContainer.innerHTML = `
        <style>
          /* RFC-0072: EQUIPMENTS Filter Modal Styles (injected for document.body scope) */
          #equipmentsFilterModalGlobal .equip-modal {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            backdrop-filter: blur(4px);
            animation: fadeIn 0.2s ease-in;
          }

          #equipmentsFilterModalGlobal .equip-modal.hidden {
            display: none;
          }

          #equipmentsFilterModalGlobal .equip-modal-card {
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
            #equipmentsFilterModalGlobal .equip-modal-card {
              border-radius: 16px;
              width: 90%;
              max-width: 1125px; /* 900px + 25% = 1125px */
              height: auto;
              max-height: 90vh;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
          }

          #equipmentsFilterModalGlobal .equip-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid #DDE7F1;
          }

          #equipmentsFilterModalGlobal .equip-modal-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #1C2743;
          }

          #equipmentsFilterModalGlobal .equip-modal-body {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          #equipmentsFilterModalGlobal .equip-modal-footer {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            padding: 16px 20px;
            border-top: 1px solid #DDE7F1;
          }

          #equipmentsFilterModalGlobal .filter-block {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          #equipmentsFilterModalGlobal .block-label {
            font-size: 14px;
            font-weight: 600;
            color: #1C2743;
          }

          /* RFC: Filter tabs header with counts */
          #equipmentsFilterModalGlobal .filter-tabs {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 2px solid #E6EEF5;
          }

          #equipmentsFilterModalGlobal .filter-tab {
            border: 1px solid #DDE7F1;
            background: #fff;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.3px;
            cursor: pointer;
            transition: all 0.2s;
            color: #6b7a90;
            white-space: nowrap;
          }

          #equipmentsFilterModalGlobal .filter-tab:hover {
            background: #f7fbff;
            border-color: #2563eb;
            color: #1C2743;
          }

          #equipmentsFilterModalGlobal .filter-tab.active {
            background: #2563eb;
            border-color: #2563eb;
            color: #fff;
          }

          #equipmentsFilterModalGlobal .filter-tab span {
            font-weight: 700;
          }

          #equipmentsFilterModalGlobal .inline-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          #equipmentsFilterModalGlobal .tiny-btn {
            border: 1px solid #DDE7F1;
            background: #fff;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          #equipmentsFilterModalGlobal .tiny-btn:hover {
            background: #f8f9fa;
            border-color: #1f6fb5;
          }

          #equipmentsFilterModalGlobal .filter-search {
            position: relative;
            display: flex;
            align-items: center;
            margin-bottom: 12px;
          }

          #equipmentsFilterModalGlobal .filter-search svg {
            position: absolute;
            left: 12px;
            width: 18px;
            height: 18px;
            fill: #6b7a90;
          }

          #equipmentsFilterModalGlobal .filter-search input {
            width: 100%;
            padding: 10px 12px 10px 40px;
            border: 2px solid #DDE7F1;
            border-radius: 10px;
            font-size: 14px;
            outline: none;
          }

          #equipmentsFilterModalGlobal .filter-search input:focus {
            border-color: #1f6fb5;
          }

          #equipmentsFilterModalGlobal .filter-search .clear-x {
            position: absolute;
            right: 12px;
            border: 0;
            background: transparent;
            cursor: pointer;
            padding: 4px;
          }

          #equipmentsFilterModalGlobal .checklist {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #DDE7F1;
            border-radius: 10px;
            padding: 8px;
          }

          #equipmentsFilterModalGlobal .check-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-radius: 6px;
            transition: background 0.2s;
          }

          #equipmentsFilterModalGlobal .check-item:hover {
            background: #f8f9fa;
          }

          #equipmentsFilterModalGlobal .check-item input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          #equipmentsFilterModalGlobal .check-item label {
            flex: 1;
            cursor: pointer;
            font-size: 14px;
            color: #1C2743;
          }

          #equipmentsFilterModalGlobal .radio-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          #equipmentsFilterModalGlobal .radio-grid label {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px;
            border: 1px solid #DDE7F1;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          }

          #equipmentsFilterModalGlobal .radio-grid label:hover {
            background: #f8f9fa;
            border-color: #1f6fb5;
          }

          #equipmentsFilterModalGlobal .radio-grid input[type="radio"] {
            width: 16px;
            height: 16px;
            cursor: pointer;
          }

          #equipmentsFilterModalGlobal .muted {
            font-size: 12px;
            color: #6b7a90;
            margin-top: 4px;
          }

          #equipmentsFilterModalGlobal .btn {
            padding: 10px 16px;
            border: 1px solid #DDE7F1;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          #equipmentsFilterModalGlobal .btn:hover {
            background: #f8f9fa;
          }

          #equipmentsFilterModalGlobal .btn.primary {
            background: #1f6fb5;
            color: #fff;
            border-color: #1f6fb5;
          }

          #equipmentsFilterModalGlobal .btn.primary:hover {
            background: #1a5a8f;
            border-color: #1a5a8f;
          }

          #equipmentsFilterModalGlobal .icon-btn {
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

          #equipmentsFilterModalGlobal .icon-btn:hover {
            background: #f0f0f0;
          }

          #equipmentsFilterModalGlobal .icon-btn svg {
            width: 18px;
            height: 18px;
            fill: #1C2743;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          body.modal-open {
            overflow: hidden !important;
          }
        </style>
      `;

      // Move modal content to global container (after styles)
      widgetModal.remove();
      globalContainer.appendChild(widgetModal);

      // Attach to document.body (like MENU widget)
      document.body.appendChild(globalContainer);

      // RFC-0072: Bind close handlers now that modal is in document.body
      setupModalCloseHandlers(widgetModal);

      console.log("[EQUIPMENTS] [RFC-0072] Modal moved to document.body with inline styles and handlers");
    } else {
      console.error("[EQUIPMENTS] [RFC-0072] Filter modal not found in template");
      return;
    }
  }

  const modal = globalContainer.querySelector("#filterModal");
  if (!modal) return;

  modal.classList.remove("hidden");

  // RFC-0072: Add body class to prevent scrolling
  document.body.classList.add('modal-open');

  // RFC: Calculate counts for filter tabs
  const counts = {
    all: STATE.allDevices.length,
    withConsumption: 0,
    noConsumption: 0,
    elevators: 0,
    escalators: 0,
    hvac: 0,
    others: 0
  };

  STATE.allDevices.forEach(device => {
    const consumption = Number(device.val) || Number(device.lastValue) || 0;
    const deviceType = (device.deviceType || '').toUpperCase();
    const deviceProfile = (device.deviceProfile || '').toUpperCase();
    const identifier = (device.deviceIdentifier || '').toUpperCase();
    const labelOrName = (device.labelOrName || '').toUpperCase();

    // Count consumption status
    if (consumption > 0) {
      counts.withConsumption++;
    } else {
      counts.noConsumption++;
    }

    // RFC: Check if device has CAG in identifier or labelOrName (climatização)
    const hasCAG = identifier.includes('CAG') || labelOrName.includes('CAG');

    // Count by type (using same classification logic as the rest of the widget)
    if (deviceType === 'ELEVADOR' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ELEVADOR')) {
      counts.elevators++;
    } else if (deviceType === 'ESCADA_ROLANTE' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ESCADA_ROLANTE')) {
      counts.escalators++;
    } else if (hasCAG || deviceType === 'CHILLER' || deviceType === 'FANCOIL' || deviceType === 'AR_CONDICIONADO' ||
               deviceType === 'BOMBA' || deviceType === 'HVAC' ||
               (deviceType === '3F_MEDIDOR' && (deviceProfile === 'CHILLER' || deviceProfile === 'FANCOIL' ||
                deviceProfile === 'AR_CONDICIONADO' || deviceProfile === 'BOMBA' || deviceProfile === 'HVAC'))) {
      counts.hvac++;
    } else {
      counts.others++;
    }
  });

  // Update count displays
  document.getElementById('countAll').textContent = counts.all;
  document.getElementById('countWithConsumption').textContent = counts.withConsumption;
  document.getElementById('countNoConsumption').textContent = counts.noConsumption;
  document.getElementById('countElevators').textContent = counts.elevators;
  document.getElementById('countEscalators').textContent = counts.escalators;
  document.getElementById('countHvac').textContent = counts.hvac;
  document.getElementById('countOthers').textContent = counts.others;

  // Populate device checklist
  const checklist = document.getElementById("deviceChecklist");
  if (!checklist) return;

  checklist.innerHTML = "";

  STATE.allDevices.forEach(device => {
    const isChecked = !STATE.selectedIds || STATE.selectedIds.has(device.entityId);

    const item = document.createElement("div");
    item.className = "check-item";
    item.innerHTML = `
      <input type="checkbox" id="check-${device.entityId}" ${isChecked ? 'checked' : ''} data-device-id="${device.entityId}">
      <label for="check-${device.entityId}">${device.labelOrName || device.deviceIdentifier || device.entityId}</label>
    `;

    checklist.appendChild(item);
  });

  // Set current sort mode
  const sortRadios = modal.querySelectorAll('input[name="sortMode"]');
  sortRadios.forEach(radio => {
    radio.checked = radio.value === STATE.sortMode;
  });

  // RFC-0072: Add ESC key handler
  if (!modal._escHandler) {
    modal._escHandler = (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeFilterModal();
      }
    };
    document.addEventListener('keydown', modal._escHandler);
  }
}

/**
 * RFC-0072: Close filter modal and cleanup
 */
function closeFilterModal() {
  // RFC-0072: Modal is now in document.body, not in widget
  const globalContainer = document.getElementById("equipmentsFilterModalGlobal");
  if (!globalContainer) return;

  const modal = globalContainer.querySelector("#filterModal");
  if (!modal) return;

  console.log("[EQUIPMENTS] [RFC-0072] Closing filter modal");

  modal.classList.add("hidden");

  // RFC-0072: Remove body class to restore scrolling
  document.body.classList.remove('modal-open');

  // RFC-0072: Remove ESC handler
  if (modal._escHandler) {
    document.removeEventListener('keydown', modal._escHandler);
    modal._escHandler = null;
  }
}

/**
 * Bind all filter-related events
 */
function bindFilterEvents() {
  // Search button toggle
  const btnSearch = document.getElementById("btnSearch");
  const searchWrap = document.getElementById("searchWrap");
  const searchInput = document.getElementById("equipSearch");

  if (btnSearch && searchWrap && searchInput) {
    btnSearch.addEventListener("click", () => {
      STATE.searchActive = !STATE.searchActive;
      searchWrap.classList.toggle("active", STATE.searchActive);
      if (STATE.searchActive) {
        setTimeout(() => searchInput.focus(), 100);
      }
    });

    searchInput.addEventListener("input", (e) => {
      STATE.searchTerm = e.target.value || "";
      reflowCards();
    });
  }

  // Filter button (opens modal which will be moved to document.body on first open)
  const btnFilter = document.getElementById("btnFilter");
  if (btnFilter) {
    btnFilter.addEventListener("click", openFilterModal);
  }

  // RFC-0072: Close handlers are now set up in setupModalCloseHandlers()
  // when modal is moved to document.body

  // RFC: Filter tab click handlers
  const filterTabs = document.querySelectorAll(".filter-tab");
  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const filterType = tab.getAttribute("data-filter");

      // Update active state
      filterTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // Filter checkboxes based on selected tab
      const checkboxes = document.querySelectorAll("#deviceChecklist input[type='checkbox']");
      checkboxes.forEach(cb => {
        const deviceId = cb.getAttribute("data-device-id");
        const device = STATE.allDevices.find(d => d.entityId === deviceId);

        if (!device) return;

        const consumption = Number(device.val) || Number(device.lastValue) || 0;
        const deviceType = (device.deviceType || '').toUpperCase();
        const deviceProfile = (device.deviceProfile || '').toUpperCase();
        const identifier = (device.deviceIdentifier || '').toUpperCase();
        const labelOrName = (device.labelOrName || '').toUpperCase();

        // RFC: Check if device has CAG in identifier or labelOrName (climatização)
        const hasCAG = identifier.includes('CAG') || labelOrName.includes('CAG');        // Get connection status for online/offline filters
        const connectionStatus = (device.connectionStatus || 'offline').toLowerCase();


        let shouldCheck = false;

        switch (filterType) {
          case 'all':
            shouldCheck = true;
            break;
                      case 'online':
            shouldCheck = connectionStatus === 'online';
            break;
          case 'offline':
            shouldCheck = connectionStatus !== 'online'; // includes offline, waiting, and any other non-online status
            break;
          case 'with-consumption':
            shouldCheck = consumption > 0;
            break;
          case 'no-consumption':
            shouldCheck = consumption === 0;
            break;
          case 'elevators':
            shouldCheck = deviceType === 'ELEVADOR' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ELEVADOR');
            break;
          case 'escalators':
            shouldCheck = deviceType === 'ESCADA_ROLANTE' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ESCADA_ROLANTE');
            break;
          case 'hvac':
            shouldCheck = hasCAG || deviceType === 'CHILLER' || deviceType === 'FANCOIL' || deviceType === 'AR_CONDICIONADO' ||
                         deviceType === 'BOMBA' || deviceType === 'HVAC' ||
                         (deviceType === '3F_MEDIDOR' && (deviceProfile === 'CHILLER' || deviceProfile === 'FANCOIL' ||
                          deviceProfile === 'AR_CONDICIONADO' || deviceProfile === 'BOMBA' || deviceProfile === 'HVAC'));
            break;
          case 'others':
            shouldCheck = !(
              hasCAG ||
              deviceType === 'ELEVADOR' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ELEVADOR') ||
              deviceType === 'ESCADA_ROLANTE' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ESCADA_ROLANTE') ||
              deviceType === 'CHILLER' || deviceType === 'FANCOIL' || deviceType === 'AR_CONDICIONADO' ||
              deviceType === 'BOMBA' || deviceType === 'HVAC' ||
              (deviceType === '3F_MEDIDOR' && (deviceProfile === 'CHILLER' || deviceProfile === 'FANCOIL' ||
               deviceProfile === 'AR_CONDICIONADO' || deviceProfile === 'BOMBA' || deviceProfile === 'HVAC'))
            );
            break;
        }

        cb.checked = shouldCheck;
      });

      console.log(`[EQUIPMENTS] Filter tab selected: ${filterType}`);
    });
  });

  // Filter device search inside modal
  const filterDeviceSearch = document.getElementById("filterDeviceSearch");
  if (filterDeviceSearch) {
    filterDeviceSearch.addEventListener("input", (e) => {
      const query = (e.target.value || "").trim().toLowerCase();
      const checkItems = document.querySelectorAll("#deviceChecklist .check-item");

      checkItems.forEach(item => {
        const label = item.querySelector("label");
        const text = (label?.textContent || "").toLowerCase();
        item.style.display = text.includes(query) ? "flex" : "none";
      });
    });
  }

  // Clear filter search button
  const filterDeviceClear = document.getElementById("filterDeviceClear");
  if (filterDeviceClear && filterDeviceSearch) {
    filterDeviceClear.addEventListener("click", () => {
      filterDeviceSearch.value = "";
      const checkItems = document.querySelectorAll("#deviceChecklist .check-item");
      checkItems.forEach(item => item.style.display = "flex");
      filterDeviceSearch.focus();
    });
  }

  // RFC-0072: Apply and Reset handlers are now in setupModalCloseHandlers()
  // when modal is moved to document.body
}

self.onDestroy = function () {
  if (self._onDateParams) {
    window.removeEventListener("myio:date-params", self._onDateParams);
  }
  if (self._onFilterApplied) {
    window.removeEventListener("myio:filter-applied", self._onFilterApplied);
  }
  if (self._onCustomersReady) {
    window.removeEventListener("myio:customers-ready", self._onCustomersReady);
  }

  // RFC-0072: Cleanup filter modal ESC handler
  const globalContainer = document.getElementById("equipmentsFilterModalGlobal");
  if (globalContainer) {
    const modal = globalContainer.querySelector("#filterModal");
    if (modal && modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
      modal._escHandler = null;
    }

    // RFC-0072: Remove global modal container from document.body
    globalContainer.remove();
    console.log("[EQUIPMENTS] [RFC-0072] Global modal container removed on destroy");
  }

  // RFC-0072: Remove modal-open class if widget is destroyed with modal open
  document.body.classList.remove('modal-open');
};
