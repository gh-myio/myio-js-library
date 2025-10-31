/* global self, ctx */

/**
 * RFC-0058: Public Store Widget
 *
 * Purpose: Public dashboard widget for individual stores with deep-linking
 *
 * URL Parameters:
 * - storeLUC: Logical Unique Code for direct store access
 *   Example: ?storeLUC=113CD
 *
 * Authentication:
 * - Option 1 (Recommended): Use ThingsBoard Public Dashboard (no auth needed)
 * - Option 2: Use hard-coded credentials via MyIOAuthTB module (alarmes@myio.com.br)
 *
 * Device Resolution:
 * 1. Primary: URL parameter storeLUC
 * 2. Fallback: Widget-bound entity (ctx.datasources → defaultSubscription)
 *
 * Server-Scope Attributes Required:
 * - ingestionId
 * - slaveId
 * - centralId
 * - identifier
 */

// Immediate log to confirm script loaded
console.log('🚀 [MYIO:PUBLIC_STORE] Controller script loaded at', new Date().toISOString());
console.log('🚀 [MYIO:PUBLIC_STORE] URL:', window.location.href);

// Configuration
const TB_HOST = "https://dashboard.myio-bas.com";
const DEBUG_ACTIVE = true;

// Logger
const LogHelper = {
  prefix: 'MYIO:PUBLIC_TELEMETRY',
  log: function(context, ...args) {
    if (DEBUG_ACTIVE) {
      console.log(`[${this.prefix}:${context}]`, ...args);
    }
  },
  warn: function(context, ...args) {
    if (DEBUG_ACTIVE) {
      console.warn(`[${this.prefix}:${context}]`, ...args);
    }
  },
  error: function(context, ...args) {
    if (DEBUG_ACTIVE) {
      console.error(`[${this.prefix}:${context}]`, ...args);
    }
  }
};

/************************************************************
 * MyIOAuthTB - ThingsBoard Authentication Module
 *
 * NOTE: This module is OPTIONAL. Only include if NOT using
 * ThingsBoard's native Public Dashboard feature.
 *
 * Features:
 * - Hard-coded credentials for public access
 * - Token caching in localStorage
 * - Automatic token refresh
 * - User profile caching in sessionStorage
 ************************************************************/
const MyIOAuthTB = (() => {
  const LOGIN_URL = new URL("/api/auth/login", TB_HOST).toString();
  const REFRESH_URL = new URL("/api/auth/token", TB_HOST).toString();
  const ME_URL = new URL("/api/auth/user", TB_HOST).toString();

  // Hard-coded credentials for public access
  // WARNING: Move to environment config for production
  const TB_USERNAME = "alarmes@myio.com.br";
  const TB_PASSWORD = "hubmyio@2025!";

  const RENEW_SKEW_S = 60;

  // Storage keys
  const LS_AUTH_KEY = "tb_auth_public";
  const SS_USER_KEY = "tb_user_public";

  // In-memory cache
  let _token = null;
  let _refresh = null;
  let _expiresAtMs = 0;
  let _inFlight = null;

  const _now = () => Date.now();
  const _aboutToExpire = () =>
    !_token || _now() >= _expiresAtMs - RENEW_SKEW_S * 1000;

  // Storage helpers
  function _saveAuthToLocalStorage() {
    try {
      localStorage.setItem(
        LS_AUTH_KEY,
        JSON.stringify({
          token: _token,
          refreshToken: _refresh,
          expiresAtMs: _expiresAtMs,
        })
      );
    } catch (e) {
      LogHelper.warn('AUTH_SAVE', 'Failed to save auth to localStorage', e);
    }
  }

  function _loadAuthFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_AUTH_KEY);
      if (!raw) return false;

      const { token, refreshToken, expiresAtMs } = JSON.parse(raw);
      if (typeof token === "string" && typeof expiresAtMs === "number") {
        _token = token;
        _refresh = refreshToken || null;
        _expiresAtMs = expiresAtMs;
        return true;
      }
    } catch (e) {
      LogHelper.warn('AUTH_LOAD', 'Failed to load auth from localStorage', e);
    }
    return false;
  }

  function _clearAuthStorage() {
    try {
      localStorage.removeItem(LS_AUTH_KEY);
    } catch {}
  }

  function _saveUserToSession(userObj) {
    try {
      sessionStorage.setItem(SS_USER_KEY, JSON.stringify(userObj));
    } catch {}
  }

  function _loadUserFromSession() {
    try {
      const raw = sessionStorage.getItem(SS_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function _clearUserSession() {
    try {
      sessionStorage.removeItem(SS_USER_KEY);
    } catch {}
  }

  // JWT decoder
  function _decodeJwtExpMillis(jwt) {
    try {
      const parts = jwt.split(".");
      if (parts.length !== 3) return 0;

      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
      );
      return payload && typeof payload.exp === "number"
        ? payload.exp * 1000
        : 0;
    } catch {
      return 0;
    }
  }

  // Login with username/password
  async function _doLogin() {
    LogHelper.log('AUTH_LOGIN_START', 'Logging in with credentials');

    const resp = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: TB_USERNAME,
        password: TB_PASSWORD,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Login failed: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json();
    _token = data.token;
    _refresh = data.refreshToken || null;
    _expiresAtMs = _decodeJwtExpMillis(_token);

    _saveAuthToLocalStorage();
    LogHelper.log('AUTH_LOGIN_OK', 'Login successful, token expires at', new Date(_expiresAtMs));

    return _token;
  }

  // Refresh token
  async function _doRefresh() {
    if (!_refresh) {
      LogHelper.warn('AUTH_REFRESH_NO_TOKEN', 'No refresh token available, doing full login');
      return await _doLogin();
    }

    LogHelper.log('AUTH_REFRESH_START', 'Refreshing token');

    const resp = await fetch(REFRESH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: _refresh }),
    });

    if (!resp.ok) {
      LogHelper.warn('AUTH_REFRESH_FAILED', 'Token refresh failed, doing full login');
      _clearAuthStorage();
      return await _doLogin();
    }

    const data = await resp.json();
    _token = data.token;
    _refresh = data.refreshToken || _refresh;
    _expiresAtMs = _decodeJwtExpMillis(_token);

    _saveAuthToLocalStorage();
    LogHelper.log('AUTH_REFRESH_OK', 'Token refreshed successfully');

    return _token;
  }

  // Get valid token
  async function getToken() {
    // Return cached token if valid
    if (_token && !_aboutToExpire()) {
      return _token;
    }

    // Deduplicate concurrent requests
    if (_inFlight) {
      return await _inFlight;
    }

    _inFlight = (async () => {
      try {
        // Try to load from storage first
        if (_loadAuthFromLocalStorage() && !_aboutToExpire()) {
          LogHelper.log('AUTH_CACHED', 'Using cached token from localStorage');
          return _token;
        }

        // Try refresh if available
        if (_refresh) {
          return await _doRefresh();
        }

        // Full login
        return await _doLogin();
      } catch (error) {
        LogHelper.error('AUTH_ERROR', 'Authentication failed', error);
        throw error;
      } finally {
        _inFlight = null;
      }
    })();

    return await _inFlight;
  }

  // Get current user
  async function getCurrentUser() {
    // Check session cache
    let cached = _loadUserFromSession();
    if (cached) {
      LogHelper.log('USER_CACHED', 'Using cached user from sessionStorage');
      return cached;
    }

    // Fetch from API
    const token = await getToken();
    const resp = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      throw new Error(`Get user failed: ${resp.status}`);
    }

    const user = await resp.json();
    _saveUserToSession(user);
    LogHelper.log('USER_LOADED', 'User profile loaded', user.email);

    return user;
  }

  // Logout
  function logout() {
    _clearAuthStorage();
    _clearUserSession();
    _token = null;
    _refresh = null;
    _expiresAtMs = 0;
    LogHelper.log('AUTH_LOGOUT', 'Logged out successfully');
  }

  return {
    getToken,
    getCurrentUser,
    logout
  };
})();

/************************************************************
 * Device Resolution
 ************************************************************/

/**
 * Alternative robust URL parameter reader
 * Handles edge cases with ThingsBoard public dashboards
 */
function getUrlParameter(name) {
  // Try multiple methods to read URL parameter

  // Method 1: URLSearchParams
  const urlParams = new URLSearchParams(window.location.search);
  let value = urlParams.get(name);
  if (value) {
    LogHelper.log('URL_PARAM_METHOD', 'Found via URLSearchParams:', name, '=', value);
    return value.trim();
  }

  // Method 2: Manual regex parsing
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
  const results = regex.exec(window.location.href);
  if (results && results[2]) {
    value = decodeURIComponent(results[2].replace(/\+/g, ' '));
    LogHelper.log('URL_PARAM_METHOD', 'Found via regex:', name, '=', value);
    return value.trim();
  }

  // Method 3: Split and parse manually
  const queryString = window.location.search.substring(1);
  const pairs = queryString.split('&');
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].split('=');
    if (decodeURIComponent(pair[0]) === name) {
      value = decodeURIComponent(pair[1] || '');
      LogHelper.log('URL_PARAM_METHOD', 'Found via manual parse:', name, '=', value);
      return value.trim();
    }
  }

  LogHelper.warn('URL_PARAM_METHOD', 'Not found via any method:', name);
  return null;
}

/**
 * Read storeLUC from URL parameters
 * Normalizes the value by trimming whitespace
 *
 * TESTING FALLBACK: If not found in URL, uses hardcoded value for testing
 */
function getStoreLUCFromURL() {
  // Debug: Log full URL
  LogHelper.log('LUC_URL_DEBUG', 'Full URL:', window.location.href);
  LogHelper.log('LUC_URL_DEBUG', 'Search params:', window.location.search);
  LogHelper.log('LUC_URL_DEBUG', 'Hash:', window.location.hash);

  // Try robust parameter reader
  let storeLUC = getUrlParameter('storeLUC');

  if (storeLUC) {
    LogHelper.log('LUC_RESOLVE_START', '✅ Found storeLUC in URL:', storeLUC);
    return storeLUC;
  }

  LogHelper.warn('LUC_RESOLVE_FALLBACK', '⚠️ No storeLUC in URL, checking all methods...');

  // Debug: Log all parameters using URLSearchParams
  const urlParams = new URLSearchParams(window.location.search);
  LogHelper.log('LUC_URL_DEBUG', 'All URL params:', Array.from(urlParams.entries()));

  // TESTING FALLBACK: Hardcoded value for testing
  // TODO: Remove this fallback after testing
  const TESTING_FALLBACK_LUC = '103D';
  storeLUC = TESTING_FALLBACK_LUC;
  LogHelper.warn('LUC_TESTING_FALLBACK', '⚠️⚠️⚠️ Using TESTING fallback LUC:', storeLUC);
  LogHelper.warn('LUC_TESTING_FALLBACK', '⚠️⚠️⚠️ Remove this hardcoded fallback after testing!');
  LogHelper.warn('LUC_TESTING_FALLBACK', '⚠️⚠️⚠️ This should ONLY be used for debugging!');

  return storeLUC || null;
}

/**
 * Search for device by server-scope attribute
 * Note: This is a workaround since TB doesn't have a direct API for attribute search
 * We query all tenant devices and filter by attribute
 */
async function searchDeviceByAttribute(attributeKey, attributeValue, token) {
  LogHelper.log('ATTR_SEARCH_START', `Searching devices by ${attributeKey}=${attributeValue}`);

  try {
    // Query tenant devices (paginated)
    // Note: This might be slow for large tenants with many devices
    const pageSize = 100;
    const resp = await fetch(
      `${TB_HOST}/api/tenant/devices?pageSize=${pageSize}&page=0`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!resp.ok) {
      LogHelper.warn('ATTR_SEARCH_API_ERROR', `Failed to query devices: ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const devices = data.data || [];
    LogHelper.log('ATTR_SEARCH_API', `Found ${devices.length} devices to check`);

    // Search through devices for matching attribute
    let matchedDevices = [];
    for (const device of devices) {
      try {
        // Fetch server-scope attributes for this device
        const attrResp = await fetch(
          `${TB_HOST}/api/plugins/telemetry/DEVICE/${device.id.id}/values/attributes?scope=SERVER_SCOPE&keys=${attributeKey}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (attrResp.ok) {
          const attrs = await attrResp.json();
          const attr = attrs.find(a => a.key === attributeKey);

          if (attr && attr.value) {
            const attrValueStr = attr.value.toString().trim();
            const searchValueStr = attributeValue.toString().trim();

            // Debug: Log found identifiers
            LogHelper.log('ATTR_SEARCH_DEBUG', `Device "${device.name}" has ${attributeKey}="${attrValueStr}"`);
            matchedDevices.push({ name: device.name, value: attrValueStr });

            // Case-insensitive comparison
            if (attrValueStr.toLowerCase() === searchValueStr.toLowerCase()) {
              LogHelper.log('ATTR_SEARCH_FOUND', `✅ Found device: ${device.name} (${device.id.id})`);
              return {
                deviceId: device.id.id,
                deviceName: device.name,
                deviceLabel: device.label || device.name
              };
            }
          }
        }
      } catch (attrError) {
        // Skip this device and continue
        LogHelper.warn('ATTR_SEARCH_SKIP', `Skipping device ${device.name}:`, attrError.message);
      }
    }

    // Debug: Show all devices with identifier attribute
    if (matchedDevices.length > 0) {
      LogHelper.log('ATTR_SEARCH_SUMMARY', `Found ${matchedDevices.length} devices with ${attributeKey} attribute:`,
        matchedDevices.slice(0, 10).map(d => `${d.name}="${d.value}"`).join(', '));
    } else {
      LogHelper.warn('ATTR_SEARCH_SUMMARY', `No devices found with ${attributeKey} attribute in first 100 devices`);
    }

    LogHelper.warn('ATTR_SEARCH_NOT_FOUND', `No device found with ${attributeKey}=${attributeValue}`);
    return null;
  } catch (error) {
    LogHelper.error('ATTR_SEARCH_ERROR', 'Attribute search failed:', error);
    return null;
  }
}

/**
 * Resolve device by LUC (Logical Unique Code)
 * Implements dual-path lookup: deviceName → attribute fallback
 */
async function getDeviceByLUC(storeLUC, token) {
  LogHelper.log('LUC_RESOLVE_API', 'Fetching device with LUC:', storeLUC, 'Token available:', !!token);

  // Check if authentication succeeded
  if (!token) {
    LogHelper.error('LUC_RESOLVE_NO_TOKEN', '❌ No token available - authentication may have failed');
    LogHelper.error('LUC_RESOLVE_NO_TOKEN', 'Cannot query device by API without authentication');
    return null;
  }

  try {
    // Primary path: Query by deviceName
    LogHelper.log('LUC_RESOLVE_API', 'Querying device by name:', `${TB_HOST}/api/tenant/devices?deviceName=${encodeURIComponent(storeLUC)}`);

    const resp = await fetch(
      `${TB_HOST}/api/tenant/devices?deviceName=${encodeURIComponent(storeLUC)}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    LogHelper.log('LUC_RESOLVE_API', 'API response status:', resp.status, resp.statusText);

    if (resp.ok) {
      const data = await resp.json();
      LogHelper.log('LUC_RESOLVE_API', 'API response data:', data);

      if (data && data.id && data.id.id) {
        LogHelper.log('LUC_RESOLVE_OK', '✅ Device resolved by name:', data.id.id, data.label || data.name);
        return {
          deviceId: data.id.id,
          deviceName: data.name,
          deviceLabel: data.label || data.name
        };
      }
    } else {
      LogHelper.warn('LUC_RESOLVE_API', 'API returned non-OK status:', resp.status);
    }

    // Fallback path: Query by server-scope attribute 'identifier'
    LogHelper.log('LUC_RESOLVE_ATTR', 'Trying attribute-based lookup for LUC:', storeLUC);
    const attrDevice = await searchDeviceByAttribute('identifier', storeLUC, token);
    if (attrDevice) {
      LogHelper.log('LUC_RESOLVE_OK', '✅ Device resolved by identifier attribute:', attrDevice.deviceId);
      return attrDevice;
    }

    LogHelper.warn('LUC_RESOLVE_NOT_FOUND', '⚠️ No device found for LUC:', storeLUC);
    LogHelper.warn('LUC_RESOLVE_NOT_FOUND', 'Tried deviceName and identifier attribute searches');
    return null;
  } catch (error) {
    LogHelper.error('LUC_RESOLVE_ERROR', '❌ Failed to resolve device by LUC', error);
    return null;
  }
}

/**
 * Fallback: Get device from widget-bound entity
 * Checks ctx.datasources first (more reliable for LV widgets), then defaultSubscription
 */
function getDeviceFromContext(ctx) {
  try {
    // Debug: Log entire context structure
    LogHelper.log('FALLBACK_DEBUG', 'ctx keys:', Object.keys(ctx));
    LogHelper.log('FALLBACK_DEBUG', 'ctx.datasources:', ctx.datasources);
    LogHelper.log('FALLBACK_DEBUG', 'ctx.defaultSubscription:', ctx.defaultSubscription);
    LogHelper.log('FALLBACK_DEBUG', 'ctx.data:', ctx.data);

    // Primary: Check datasources (more reliable for Last Value widgets)
    const ds0 = Array.isArray(ctx.datasources) ? ctx.datasources[0] : null;
    LogHelper.log('FALLBACK_DEBUG', 'ds0:', ds0);

    if (ds0?.entity?.id?.id) {
      LogHelper.log('FALLBACK_DS_OK', 'Using datasource entity:', ds0.entity.id.id);
      return {
        deviceId: ds0.entity.id.id,
        deviceName: ds0.entityName || 'Unknown',
        deviceLabel: ds0.entityLabel || ds0.entityName || 'Unknown Device'
      };
    }

    // Legacy: Check defaultSubscription as fallback
    const subscription = ctx.defaultSubscription;
    LogHelper.log('FALLBACK_DEBUG', 'subscription:', subscription);

    if (subscription?.data?.[0]) {
      const firstData = subscription.data[0];
      LogHelper.log('FALLBACK_DEBUG', 'firstData:', firstData);

      const entityId = firstData?.dataKey?.entityId;
      const entityLabel = firstData?.dataKey?.label;
      const entityName = firstData?.dataKey?.name;

      if (entityId) {
        LogHelper.log('FALLBACK_SUB_OK', 'Using subscription entity:', entityId);
        return {
          deviceId: entityId,
          deviceName: entityName || 'Unknown',
          deviceLabel: entityLabel || entityName || 'Unknown Device'
        };
      }
    }

    // Try to extract from ctx.data directly (some widget types use this)
    if (Array.isArray(ctx.data) && ctx.data.length > 0) {
      LogHelper.log('FALLBACK_DEBUG', 'Trying ctx.data[0]:', ctx.data[0]);
      const dataItem = ctx.data[0];
      if (dataItem?.datasource?.entity?.id) {
        LogHelper.log('FALLBACK_DATA_OK', 'Using ctx.data entity:', dataItem.datasource.entity.id);
        return {
          deviceId: dataItem.datasource.entity.id,
          deviceName: dataItem.datasource.entityName || 'Unknown',
          deviceLabel: dataItem.datasource.entityLabel || dataItem.datasource.entityName || 'Unknown Device'
        };
      }
    }

    LogHelper.warn('FALLBACK_FAILED', 'Could not extract device from context');
    LogHelper.warn('FALLBACK_FAILED', '⚠️ CONFIGURE A DATASOURCE IN WIDGET SETTINGS!');
    LogHelper.warn('FALLBACK_FAILED', '⚠️ Public dashboards need a datasource/entity configured!');
    return null;
  } catch (error) {
    LogHelper.error('FALLBACK_ERROR', 'Error extracting device from context', error);
    return null;
  }
}

/************************************************************
 * Server-Scope Attributes
 ************************************************************/

/**
 * Load server-scope attributes for device
 * Caches by deviceId for session lifetime (performance optimization)
 */
const _attributeCache = {};

async function loadServerScopeAttributes(deviceId, token) {
  // Check cache first
  if (_attributeCache[deviceId]) {
    LogHelper.log('ATTR_CACHED', 'Using cached attributes for device:', deviceId);
    return _attributeCache[deviceId];
  }

  LogHelper.log('ATTR_LOAD_START', 'Loading server-scope attributes for device:', deviceId, 'Token available:', !!token);

  // Check if authentication succeeded
  if (!token) {
    LogHelper.error('ATTR_NO_TOKEN', '❌ No token available - authentication may have failed');
    LogHelper.error('ATTR_NO_TOKEN', 'Cannot fetch attributes via API without authentication');

    const defaultAttrs = {
      ingestionId: null,
      slaveId: null,
      centralId: null,
      identifier: null
    };

    // Cache defaults
    _attributeCache[deviceId] = defaultAttrs;
    return defaultAttrs;
  }

  try {
    LogHelper.log('ATTR_LOAD_API', 'Querying attributes:', `${TB_HOST}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes?scope=SERVER_SCOPE`);

    const resp = await fetch(
      `${TB_HOST}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes?scope=SERVER_SCOPE`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    LogHelper.log('ATTR_LOAD_API', 'API response status:', resp.status, resp.statusText);

    if (!resp.ok) {
      throw new Error(`Attributes fetch failed: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json();
    LogHelper.log('ATTR_LOAD_API', 'API response data:', data);

    // Convert array to object
    const attrMap = {};
    if (Array.isArray(data)) {
      data.forEach(attr => {
        attrMap[attr.key] = attr.value;
      });
    }

    const attributes = {
      ingestionId: attrMap.ingestionId || null,
      slaveId: attrMap.slaveId || null,
      centralId: attrMap.centralId || null,
      identifier: attrMap.identifier || null
    };

    LogHelper.log('ATTR_LOAD_OK', '✅ Attributes loaded successfully:', attributes);

    // Check for missing critical attributes
    const missing = [];
    if (!attributes.ingestionId) missing.push('ingestionId');
    if (!attributes.slaveId) missing.push('slaveId');
    if (!attributes.centralId) missing.push('centralId');

    if (missing.length > 0) {
      LogHelper.warn('ATTR_LOAD_MISSING', '⚠️ Missing critical attributes:', missing.join(', '));
    }

    // Cache for session
    _attributeCache[deviceId] = attributes;

    return attributes;
  } catch (error) {
    LogHelper.error('ATTR_LOAD_ERROR', '❌ Failed to load attributes:', error);
    return {
      ingestionId: null,
      slaveId: null,
      centralId: null,
      identifier: null
    };
  }
}

/************************************************************
 * UI Rendering
 ************************************************************/

/**
 * Pick best identifier for display
 * Prefers server-scope attribute, falls back to storeLUC, then '-'
 */
function pickIdentifier(attrs, storeLUC) {
  const attrValue = attrs.identifier?.toString().trim();
  return attrValue || (storeLUC || '-');
}

/**
 * Show loading overlay
 */
function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

/**
 * Show error message
 */
function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');

  if (errorEl && errorText) {
    errorText.textContent = message;
    errorEl.style.display = 'block';
  }

  LogHelper.error('UI_ERROR', message);
}

/**
 * Hide error message
 */
function hideError() {
  const errorEl = document.getElementById('errorMessage');
  if (errorEl) errorEl.style.display = 'none';
}

/**
 * Show user-facing toast notification
 */
function showToast(message, duration = 5000) {
  const toast = document.getElementById('toastNotification');
  const toastText = document.getElementById('toastText');

  if (toast && toastText) {
    toastText.textContent = message;
    toast.style.display = 'block';
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.style.display = 'none';
      }, 300);
    }, duration);
  }
}

/**
 * Render store header
 */
function renderStoreHeader(deviceLabel, identifier) {
  const labelEl = document.getElementById('storeDeviceLabel');
  const identifierEl = document.getElementById('storeIdentifier');

  if (labelEl) labelEl.textContent = deviceLabel;
  if (identifierEl) identifierEl.textContent = `Store: ${identifier}`;

  LogHelper.log('UI_RENDER_HEADER', 'Header rendered:', deviceLabel, identifier);
}

/**
 * Create device context object for library actions
 */
function createDeviceContext(deviceInfo, attributes) {
  return {
    deviceId: deviceInfo.deviceId,
    deviceName: deviceInfo.deviceName,
    deviceLabel: deviceInfo.deviceLabel,
    ingestionId: attributes.ingestionId,
    slaveId: attributes.slaveId,
    centralId: attributes.centralId,
    identifier: attributes.identifier
  };
}

/************************************************************
 * Action Handlers
 ************************************************************/

/**
 * Wire action buttons to library functions
 * Checks for library namespace first, then falls back to window globals
 */
function wireActions(ctx, deviceCtx, settings) {
  LogHelper.log('ACTION_WIRE_START', 'Wiring action buttons with device context');

  // Helper to resolve library function with namespace fallback
  const resolveHandler = (namespaced, global) => {
    return namespaced || global || null;
  };

  // Settings button
  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings && settings.showSettings !== false) {
    btnSettings.addEventListener('click', () => {
      LogHelper.log('ACTION_INVOKE', 'Settings clicked');
      try {
        const handler = resolveHandler(
          window.MyIOLib?.handleActionSettings,
          window.handleActionSettings
        );
        if (handler) {
          handler(ctx, deviceCtx);
        } else {
          showError('Settings action not available');
        }
      } catch (error) {
        LogHelper.error('ACTION_ERROR', 'Settings action failed', error);
        showError('Failed to open settings');
      }
    });
  }

  // Report button
  const btnReport = document.getElementById('btnReport');
  if (btnReport && settings.showReport !== false) {
    btnReport.addEventListener('click', () => {
      LogHelper.log('ACTION_INVOKE', 'Report clicked');
      try {
        const handler = resolveHandler(
          window.MyIOLib?.handleActionReport,
          window.handleActionReport
        );
        if (handler) {
          handler(ctx, deviceCtx);
        } else {
          showError('Report action not available');
        }
      } catch (error) {
        LogHelper.error('ACTION_ERROR', 'Report action failed', error);
        showError('Failed to open report');
      }
    });
  }

  // Instant Telemetry button
  const btnInstant = document.getElementById('btnInstant');
  if (btnInstant && settings.showInstant !== false) {
    btnInstant.addEventListener('click', () => {
      LogHelper.log('ACTION_INVOKE', 'Instant telemetry clicked');
      try {
        const handler = resolveHandler(
          window.MyIOLib?.openDemandModal,
          window.openDemandModal
        );
        if (handler) {
          handler(ctx, deviceCtx);
        } else {
          showError('Instant telemetry not available');
        }
      } catch (error) {
        LogHelper.error('ACTION_ERROR', 'Instant telemetry failed', error);
        showError('Failed to open instant telemetry');
      }
    });
  }

  // Energy Chart / Dashboard button
  const btnExpandChart = document.getElementById('btnExpandChart');
  const energyChart = document.getElementById('energyChart');

  const openDashboard = () => {
    LogHelper.log('ACTION_INVOKE', 'Dashboard clicked');
    try {
      const handler = resolveHandler(
        window.MyIOLib?.handleActionDashboard,
        window.handleActionDashboard
      );
      if (handler) {
        handler(ctx, deviceCtx);
      } else {
        showError('Dashboard action not available');
      }
    } catch (error) {
      LogHelper.error('ACTION_ERROR', 'Dashboard action failed', error);
      showError('Failed to open dashboard');
    }
  };

  if (btnExpandChart && settings.showChartCTA !== false) {
    btnExpandChart.addEventListener('click', openDashboard);
  }
  if (energyChart) {
    energyChart.addEventListener('click', openDashboard);
  }

  LogHelper.log('ACTION_WIRE_OK', 'All actions wired successfully');
}

/************************************************************
 * Widget Initialization
 ************************************************************/

/**
 * Get authentication token
 * ALWAYS authenticates using hardcoded credentials for silent auth
 * This allows querying devices by API even in public dashboards
 */
async function getAuthToken() {
  LogHelper.log('AUTH_START', '🔐 Authenticating with MyIOAuthTB (silent auth)');
  LogHelper.log('AUTH_START', 'Using hardcoded credentials for public access');

  try {
    const token = await MyIOAuthTB.getToken();
    LogHelper.log('AUTH_SUCCESS', '✅ Authentication successful, token obtained');
    return token;
  } catch (error) {
    LogHelper.error('AUTH_ERROR', '❌ Authentication failed:', error);
    LogHelper.error('AUTH_ERROR', 'Widget will not be able to query devices by storeLUC');
    return null;
  }
}

/**
 * Main initialization function
 */
async function init() {
  LogHelper.log('INIT_START', '🚀 Initializing Public Store Widget');
  LogHelper.log('INIT_DEBUG', 'window.location.href:', window.location.href);
  LogHelper.log('INIT_DEBUG', 'self.ctx available:', !!self.ctx);

  try {
    showLoading();
    hideError();

    // Get settings
    const settings = self.ctx.settings || {};
    LogHelper.log('INIT_DEBUG', 'Settings:', settings);

    // Step 1: Authenticate (only if private dashboard)
    LogHelper.log('INIT_AUTH', 'Step 1: Checking authentication');
    const token = await getAuthToken();

    // Step 2: Resolve device
    LogHelper.log('INIT_DEVICE', 'Step 2: Resolving device');
    const storeLUC = getStoreLUCFromURL();
    let deviceInfo = null;
    let usedFallback = false;

    if (storeLUC) {
      deviceInfo = await getDeviceByLUC(storeLUC, token);
    }

    // Fallback to widget-bound entity
    if (!deviceInfo) {
      LogHelper.log('INIT_FALLBACK', 'Using fallback device from widget context');
      deviceInfo = getDeviceFromContext(self.ctx);
      usedFallback = true;
    }

    if (!deviceInfo) {
      throw new Error('Could not resolve device from URL or widget context');
    }

    // Show toast if fallback was used
    if (usedFallback && storeLUC) {
      showToast("We're showing the store bound to this widget because the link code was not found.");
    }

    // Step 3: Load attributes
    LogHelper.log('INIT_ATTRS', 'Step 3: Loading device attributes');
    const attributes = await loadServerScopeAttributes(deviceInfo.deviceId, token);

    // Step 4: Render UI
    LogHelper.log('INIT_RENDER', 'Step 4: Rendering UI');
    const displayIdentifier = pickIdentifier(attributes, storeLUC);
    renderStoreHeader(deviceInfo.deviceLabel, displayIdentifier);

    // Step 5: Wire actions
    LogHelper.log('INIT_ACTIONS', 'Step 5: Wiring action buttons');
    const deviceCtx = createDeviceContext(deviceInfo, attributes);
    wireActions(self.ctx, deviceCtx, settings);

    hideLoading();
    LogHelper.log('INIT_COMPLETE', '✅ Widget initialized successfully');

  } catch (error) {
    hideLoading();
    LogHelper.error('INIT_ERROR', 'Widget initialization failed', error);
    showError('Failed to load store data. Please try refreshing the page.');
  }
}

/************************************************************
 * Widget Lifecycle Hooks
 ************************************************************/

// Log before defining lifecycle hooks
console.log('🔧 [MYIO:PUBLIC_STORE] Defining lifecycle hooks...');
console.log('🔧 [MYIO:PUBLIC_STORE] self available:', typeof self !== 'undefined');
console.log('🔧 [MYIO:PUBLIC_STORE] typeof self:', typeof self);

self.onInit = function() {
  try {
    console.log('🎬 [MYIO:PUBLIC_STORE] ✅ onInit() called by ThingsBoard!');
    window.__PUBLIC_STORE_INITIALIZED = true; // Mark as initialized

    LogHelper.log('LIFECYCLE', '🎬 onInit() called');
    LogHelper.log('LIFECYCLE_DEBUG', 'self:', !!self);
    LogHelper.log('LIFECYCLE_DEBUG', 'ctx:', !!self.ctx);
    LogHelper.log('LIFECYCLE_DEBUG', 'typeof init:', typeof init);

    init().catch(err => {
      LogHelper.error('LIFECYCLE_INIT_ERROR', '❌ Init promise rejected:', err);
      LogHelper.error('LIFECYCLE_INIT_ERROR', 'Stack:', err.stack);
      hideLoading();
      showError('Widget initialization failed. Check console for details.');
    });
  } catch (err) {
    LogHelper.error('LIFECYCLE_CATCH', '❌ onInit() threw error:', err);
    LogHelper.error('LIFECYCLE_CATCH', 'Stack:', err.stack);
    hideLoading();
    showError('Widget failed to start. Check console for details.');
  }
};

console.log('🔧 [MYIO:PUBLIC_STORE] self.onInit defined:', typeof self.onInit);

self.onDataUpdated = function() {
  console.log('📊 [MYIO:PUBLIC_STORE] onDataUpdated() called');
  LogHelper.log('LIFECYCLE', 'onDataUpdated() called');
  // Widget doesn't depend heavily on telemetry updates
  // Attribute cache prevents unnecessary refetches
};

console.log('🔧 [MYIO:PUBLIC_STORE] self.onDataUpdated defined:', typeof self.onDataUpdated);

self.onDestroy = function() {
  console.log('🗑️ [MYIO:PUBLIC_STORE] onDestroy() called');
  LogHelper.log('LIFECYCLE', 'onDestroy() called');
  // Cleanup if needed
};

console.log('🔧 [MYIO:PUBLIC_STORE] self.onDestroy defined:', typeof self.onDestroy);
console.log('✅ [MYIO:PUBLIC_STORE] All lifecycle hooks defined successfully');
console.log('⏳ [MYIO:PUBLIC_STORE] Waiting for ThingsBoard to call onInit()...');

// WORKAROUND: In public dashboards, ThingsBoard may not call onInit()
// Auto-initialize after a short delay to ensure self.ctx is available
console.log('🔧 [MYIO:PUBLIC_STORE] Setting up auto-initialization fallback...');

setTimeout(() => {
  console.log('⏰ [MYIO:PUBLIC_STORE] Auto-init timeout triggered');

  // Check if onInit was already called
  if (window.__PUBLIC_STORE_INITIALIZED) {
    console.log('✅ [MYIO:PUBLIC_STORE] Already initialized via onInit() - skipping auto-init');
    return;
  }

  console.warn('⚠️ [MYIO:PUBLIC_STORE] onInit() was NOT called by ThingsBoard');
  console.warn('⚠️ [MYIO:PUBLIC_STORE] Triggering manual initialization...');

  // Check if context is available
  if (typeof self !== 'undefined' && self.ctx) {
    console.log('🚀 [MYIO:PUBLIC_STORE] Calling onInit() manually...');
    try {
      self.onInit();
      window.__PUBLIC_STORE_INITIALIZED = true;
    } catch (err) {
      console.error('❌ [MYIO:PUBLIC_STORE] Manual onInit() failed:', err);
    }
  } else {
    console.error('❌ [MYIO:PUBLIC_STORE] Cannot auto-initialize: self.ctx not available');
    console.error('❌ [MYIO:PUBLIC_STORE] self:', typeof self);
    console.error('❌ [MYIO:PUBLIC_STORE] self.ctx:', typeof self !== 'undefined' ? typeof self.ctx : 'N/A');
  }
}, 1000); // Wait 1 second for ThingsBoard to set up context

console.log('✅ [MYIO:PUBLIC_STORE] Auto-initialization fallback scheduled for 1000ms');
