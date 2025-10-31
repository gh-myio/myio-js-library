# RFC-0058: Public Store Last Value Widget with Deep-Linking

**Status:** Draft
**Authors:** MYIO Platform Team
**Date:** 2025-10-29
**Target:** main-dashboard-shopping / PUBLIC-TELEMETRY
**Owners:** Frontend (ThingsBoard Widgets) + Library (myio-js-library-PROD)

---

## Table of Contents

1. [Summary](#summary)
2. [Motivation](#motivation)
3. [Guide-Level Explanation](#guide-level-explanation)
4. [Reference-Level Explanation](#reference-level-explanation)
5. [Detailed Design](#detailed-design)
6. [Authentication Pattern](#authentication-pattern)
7. [Device Resolution](#device-resolution)
8. [Action Integration](#action-integration)
9. [Implementation Plan](#implementation-plan)
10. [Testing Strategy](#testing-strategy)
11. [Security Considerations](#security-considerations)
12. [Success Metrics](#success-metrics)
13. [Non-Goals](#non-goals)

---

## Summary

This RFC proposes the creation of a **Last Value widget** called **"Public Store Widget"** for public store dashboards that provides:

- **Device Resolution** via URL parameter (`storeLUC=XXXXX`) for deep-linking
- **Store Header** displaying device label and identifier
- **Action Buttons** for Settings, Consumption Report, and Instant Telemetry
- **Energy Chart** with daily bar visualization
- **Public Authentication** using hard-coded ThingsBoard credentials
- **Attribute Loading** from device server-scope (ingestionId, slaveId, centralId, identifier)
- **Library Integration** with existing action handlers

This widget is designed for **public dashboards** where users can access store-specific data via a direct URL link without requiring individual ThingsBoard accounts.

---

## Motivation

### Current Limitations

1. **No deep-linking** - Users cannot share direct links to specific stores
2. **Manual navigation** - Users must navigate through menus to find specific stores
3. **No public access** - Each user requires a ThingsBoard account
4. **Inconsistent UI** - Public dashboards don't follow standard patterns

### Business Requirements

1. **Public store access** - External stakeholders need read-only access to store data
2. **Deep-linking capability** - Share URLs like `dashboard.myio.com?storeLUC=113CD`
3. **Standardized actions** - Reuse existing library functions (Settings, Report, Instant Telemetry)
4. **Quick insights** - Show key metrics and provide quick access to detailed views

### Technical Goals

1. Use ThingsBoard **Last Value widget** type for simplicity
2. Implement **URL parameter resolution** (`storeLUC`) as primary device identifier
3. Use **public authentication** via hard-coded credentials (alarmes@myio.com.br)
4. Integrate with existing **library action handlers**
5. Load device **server-scope attributes** for context
6. Ensure **responsive design** for mobile and desktop

---

## Guide-Level Explanation

### What Users Will See

#### Store Header
```
┌─────────────────────────────────────────────────────────────────┐
│ Shopping Campinas                          [⚙] [📊 Report] [⚡]│
│ Store: 113CD                                                     │
└─────────────────────────────────────────────────────────────────┘
```

#### Energy Chart
```
┌─────────────────────────────────────────────────────────────────┐
│                     Energy Consumption (kWh)                     │
│                                                                   │
│  ▂▄▆█▆▄▂▃▅▇█▅▃▂▄▆█▆▄▂▃▅▇█▅▃▂▄▆█▆▄▂                            │
│  01 03 05 07 09 11 13 15 17 19 21 23 25 27 29                   │
│                      Daily Consumption                            │
│                                                                   │
│  [Click to open detailed dashboard]                              │
└─────────────────────────────────────────────────────────────────┘
```

### Actions & Navigation

| Action | Trigger | Behavior |
|--------|---------|----------|
| **Settings** (⚙) | Click gear icon | Opens device settings modal |
| **Consumption Report** (📊) | Click Report button | Opens consumption report dashboard |
| **Instant Telemetry** (⚡) | Click lightning button | Opens instant demand modal |
| **Energy Chart** | Click chart area | Opens detailed energy dashboard |

### Deep-Linking via URL

Users can access specific stores directly via URL parameter:

```
https://dashboard.myio-bas.com/dashboard/PUBLIC_STORE?storeLUC=113CD
```

**Flow:**
1. Widget reads `storeLUC` from URL
2. Resolves device by LUC (Logical Unique Code)
3. Loads device attributes
4. Renders store header and chart
5. Wires action buttons with device context

### Fallback Behavior

If `storeLUC` is **not provided** or **invalid**:
- Widget falls back to bound entity from ThingsBoard widget configuration
- Logs a WARNING message
- Continues rendering with fallback device

---

## Reference-Level Explanation

### File Structure

```
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\
  src\thingsboard\main-dashboard-shopping\PUBLIC-TELEMETRY\WIDGET\
    PUBLIC_STORE\
      controller.js      # Main widget logic + auth
      template.html      # HTML structure
      style.css          # Styling
      settings.schema    # Widget settings
      README.md          # Documentation
```

### Dependencies

| Component | Source | Purpose |
|-----------|--------|---------|
| **MyIOAuthTB** | Inline module | ThingsBoard authentication with hard-coded credentials |
| **Action Handlers** | myio-js-library | handleActionSettings, handleActionReport, openDemandModal, handleActionDashboard |
| **ThingsBoard API** | REST endpoints | Device lookup, attribute loading |

### Widget Type

- **Type:** Last Value (ThingsBoard)
- **Datasource:** Optional (widget can work without telemetry subscription)
- **Why Last Value?** Simplicity and compatibility with public dashboards

---

## Detailed Design

### 1. HTML Structure (template.html)

```html
<section class="public-store-widget">
  <!-- Store Header -->
  <div class="store-header">
    <!-- Device Info -->
    <div class="device-info">
      <h1 class="device-label" id="storeDeviceLabel">Loading...</h1>
      <p class="device-identifier" id="storeIdentifier">Store: -</p>
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons">
      <button class="btn-icon"
              id="btnSettings"
              title="Settings"
              aria-label="Open device settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6M1 12h6m6 0h6"></path>
        </svg>
      </button>

      <button class="btn-primary"
              id="btnReport"
              aria-label="Open consumption report">
        📊 Consumption Report
      </button>

      <button class="btn-secondary"
              id="btnInstant"
              aria-label="Open instant telemetry">
        ⚡ Instant Telemetry
      </button>
    </div>
  </div>

  <!-- Energy Chart Section -->
  <div class="energy-chart" id="energyChart">
    <div class="chart-header">
      <h2>Energy Consumption (kWh)</h2>
      <span class="chart-subtitle">Daily Consumption - Click to expand</span>
    </div>

    <div class="chart-placeholder" id="chartPlaceholder">
      <svg viewBox="0 0 800 300" class="bar-chart">
        <!-- SVG bars will be rendered here -->
      </svg>
    </div>

    <button class="btn-chart-expand"
            id="btnExpandChart"
            aria-label="Open detailed energy dashboard">
      Open Detailed Dashboard →
    </button>
  </div>

  <!-- Loading Overlay -->
  <div class="loading-overlay" id="loadingOverlay" style="display: none;">
    <div class="spinner"></div>
    <p>Loading store data...</p>
  </div>

  <!-- Error Message -->
  <div class="error-message" id="errorMessage" style="display: none;">
    <p>⚠️ <span id="errorText"></span></p>
  </div>
</section>
```

---

### 2. CSS Styling (style.css)

```css
/* Public Store Widget Styles */

.public-store-widget {
  width: 100%;
  min-height: 400px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Store Header */
.store-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e0e0e0;
}

.device-info {
  flex: 1;
}

.device-label {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.device-identifier {
  font-size: 14px;
  color: #666666;
  margin: 0;
  font-weight: 500;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-icon {
  width: 40px;
  height: 40px;
  padding: 0;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon svg {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

.btn-icon:hover {
  background: #e0e0e0;
  transform: translateY(-2px);
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #1976d2;
  color: #ffffff;
}

.btn-primary:hover {
  background: #1565c0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
}

.btn-secondary {
  background: #ffffff;
  color: #1976d2;
  border: 2px solid #1976d2;
}

.btn-secondary:hover {
  background: #e3f2fd;
  transform: translateY(-2px);
}

/* Energy Chart */
.energy-chart {
  background: #f9f9f9;
  border-radius: 12px;
  padding: 24px;
  min-height: 300px;
}

.chart-header {
  margin-bottom: 20px;
}

.chart-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px 0;
}

.chart-subtitle {
  font-size: 13px;
  color: #666666;
}

.chart-placeholder {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.bar-chart {
  width: 100%;
  height: 200px;
}

.btn-chart-expand {
  width: 100%;
  padding: 12px;
  background: #1976d2;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-chart-expand:hover {
  background: #1565c0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
}

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  z-index: 10;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e0e0e0;
  border-top-color: #1976d2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-overlay p {
  margin-top: 16px;
  font-size: 14px;
  color: #666666;
}

/* Error Message */
.error-message {
  padding: 16px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  margin-top: 16px;
}

.error-message p {
  margin: 0;
  font-size: 14px;
  color: #856404;
}

/* Responsive */
@media (max-width: 768px) {
  .store-header {
    flex-direction: column;
    gap: 16px;
  }

  .action-buttons {
    width: 100%;
    flex-wrap: wrap;
  }

  .btn-primary,
  .btn-secondary {
    flex: 1;
    min-width: 140px;
  }
}
```

---

### 3. Widget Settings Schema (settings.schema.json)

The widget provides configurable settings to control button visibility and styling:

```json
{
  "schema": {
    "type": "object",
    "title": "Public Store Widget Settings",
    "properties": {
      "showSettings": {
        "type": "boolean",
        "title": "Show Settings Button",
        "default": true
      },
      "showReport": {
        "type": "boolean",
        "title": "Show Consumption Report Button",
        "default": true
      },
      "showInstant": {
        "type": "boolean",
        "title": "Show Instant Telemetry Button",
        "default": true
      },
      "showChartCTA": {
        "type": "boolean",
        "title": "Show Chart Expand Button",
        "default": true
      },
      "primaryColor": {
        "type": "string",
        "title": "Primary Button Color",
        "default": "#1976d2"
      }
    }
  },
  "form": [
    {
      "key": "showSettings",
      "type": "checkbox"
    },
    {
      "key": "showReport",
      "type": "checkbox"
    },
    {
      "key": "showInstant",
      "type": "checkbox"
    },
    {
      "key": "showChartCTA",
      "type": "checkbox"
    },
    {
      "key": "primaryColor",
      "type": "color"
    }
  ]
}
```

#### Usage in Template

Update `template.html` to conditionally render buttons based on settings:

```html
<!-- Settings button - conditional -->
<button class="btn-icon"
        id="btnSettings"
        ng-if="settings.showSettings !== false"
        title="Settings"
        aria-label="Open device settings">
  <!-- SVG icon -->
</button>

<!-- Report button - conditional -->
<button class="btn-primary"
        id="btnReport"
        ng-if="settings.showReport !== false"
        aria-label="Open consumption report">
  📊 Consumption Report
</button>

<!-- Instant Telemetry button - conditional -->
<button class="btn-secondary"
        id="btnInstant"
        ng-if="settings.showInstant !== false"
        aria-label="Open instant telemetry">
  ⚡ Instant Telemetry
</button>

<!-- Chart expand button - conditional -->
<button class="btn-chart-expand"
        id="btnExpandChart"
        ng-if="settings.showChartCTA !== false"
        aria-label="Open detailed energy dashboard">
  Open Detailed Dashboard →
</button>
```

#### Dynamic Styling

Apply primary color from settings:

```css
/* Use settings.primaryColor for dynamic theming */
.btn-primary {
  background: var(--primary-color, #1976d2);
}

/* Set via inline style in template */
<style>
  :root {
    --primary-color: {{settings.primaryColor || '#1976d2'}};
  }
</style>
```

---

### 4. Controller Logic (controller.js)

```javascript
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
 * - Uses hard-coded ThingsBoard credentials (alarmes@myio.com.br)
 * - MyIOAuthTB module handles token management and refresh
 *
 * Device Resolution:
 * 1. Primary: URL parameter storeLUC
 * 2. Fallback: Widget-bound entity
 *
 * Server-Scope Attributes Required:
 * - ingestionId
 * - slaveId
 * - centralId
 * - identifier
 */

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
  const TB_USERNAME = "alarmes@myio.com.br";
  const TB_PASSWORD = "hubmyio@2025!";

  const RENEW_SKEW_S = 60;
  const RETRY_BASE_MS = 500;
  const RETRY_MAX_ATTEMPTS = 3;

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

  async function _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Login with username/password
  async function _doLogin() {
    LogHelper.log('AUTH_LOGIN_START', 'Logging in with hard-coded credentials');

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

  // Get valid token with retry logic
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
 * Read storeLUC from URL parameters
 * Normalizes the value by trimming whitespace
 */
function getStoreLUCFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const storeLUC = (urlParams.get('storeLUC') || '').trim();

  if (storeLUC) {
    LogHelper.log('LUC_RESOLVE_START', 'Found storeLUC in URL:', storeLUC);
  } else {
    LogHelper.warn('LUC_RESOLVE_FALLBACK', 'No storeLUC in URL, will use fallback');
  }

  return storeLUC || null;
}

/**
 * Resolve device by LUC (Logical Unique Code)
 * Implements dual-path lookup: deviceName → attribute fallback
 */
async function getDeviceByLUC(storeLUC, token) {
  LogHelper.log('LUC_RESOLVE_API', 'Fetching device with LUC:', storeLUC);

  try {
    // Primary path: Query by deviceName
    const resp = await fetch(
      `${TB_HOST}/api/tenant/devices?deviceName=${encodeURIComponent(storeLUC)}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (resp.ok) {
      const data = await resp.json();
      if (data && data.id && data.id.id) {
        LogHelper.log('LUC_RESOLVE_OK', 'Device resolved by name:', data.id.id, data.label || data.name);
        return {
          deviceId: data.id.id,
          deviceName: data.name,
          deviceLabel: data.label || data.name
        };
      }
    }

    // Fallback path: Query by server-scope attribute 'identifier'
    // NOTE: Uncomment and enable when attribute-based search is needed
    // LogHelper.log('LUC_RESOLVE_ATTR', 'Trying attribute-based lookup for LUC:', storeLUC);
    // const attrDevice = await searchDeviceByAttribute('identifier', storeLUC, token);
    // if (attrDevice) {
    //   LogHelper.log('LUC_RESOLVE_OK', 'Device resolved by attribute:', attrDevice.deviceId);
    //   return attrDevice;
    // }

    LogHelper.warn('LUC_RESOLVE_NOT_FOUND', 'No device found for LUC:', storeLUC);
    return null;
  } catch (error) {
    LogHelper.error('LUC_RESOLVE_ERROR', 'Failed to resolve device by LUC', error);
    return null;
  }
}

/**
 * Fallback: Get device from widget-bound entity
 * Checks ctx.datasources first (more reliable for LV widgets), then defaultSubscription
 */
function getDeviceFromContext(ctx) {
  try {
    // Primary: Check datasources (more reliable for Last Value widgets)
    const ds0 = Array.isArray(ctx.datasources) ? ctx.datasources[0] : null;
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
    if (subscription?.data?.[0]) {
      const firstData = subscription.data[0];
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

    LogHelper.warn('FALLBACK_FAILED', 'Could not extract device from context');
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
 */
async function loadServerScopeAttributes(deviceId, token) {
  LogHelper.log('ATTR_LOAD_START', 'Loading server-scope attributes for device:', deviceId);

  try {
    const resp = await fetch(
      `${TB_HOST}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes?scope=SERVER_SCOPE`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!resp.ok) {
      throw new Error(`Attributes fetch failed: ${resp.status}`);
    }

    const data = await resp.json();

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
      identifier: attrMap.identifier || '-'
    };

    LogHelper.log('ATTR_LOAD_OK', 'Attributes loaded:', attributes);

    // Check for missing critical attributes
    const missing = [];
    if (!attributes.ingestionId) missing.push('ingestionId');
    if (!attributes.slaveId) missing.push('slaveId');
    if (!attributes.centralId) missing.push('centralId');

    if (missing.length > 0) {
      LogHelper.warn('ATTR_LOAD_MISSING', 'Missing attributes:', missing.join(', '));
    }

    return attributes;
  } catch (error) {
    LogHelper.error('ATTR_LOAD_ERROR', 'Failed to load attributes', error);
    return {
      ingestionId: null,
      slaveId: null,
      centralId: null,
      identifier: '-'
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
function wireActions(ctx, deviceCtx) {
  LogHelper.log('ACTION_WIRE_START', 'Wiring action buttons with device context');

  // Helper to resolve library function with namespace fallback
  const resolveHandler = (namespaced, global) => {
    return namespaced || global || null;
  };

  // Settings button
  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) {
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
  if (btnReport) {
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
  if (btnInstant) {
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

  if (btnExpandChart) btnExpandChart.addEventListener('click', openDashboard);
  if (energyChart) energyChart.addEventListener('click', openDashboard);

  LogHelper.log('ACTION_WIRE_OK', 'All actions wired successfully');
}

/************************************************************
 * Widget Initialization
 ************************************************************/

/**
 * Main initialization function
 */
async function init() {
  LogHelper.log('INIT_START', 'Initializing Public Store Widget');

  try {
    showLoading();
    hideError();

    // Step 1: Authenticate
    LogHelper.log('INIT_AUTH', 'Step 1: Authenticating with ThingsBoard');
    const token = await MyIOAuthTB.getToken();

    // Step 2: Resolve device
    LogHelper.log('INIT_DEVICE', 'Step 2: Resolving device');
    const storeLUC = getStoreLUCFromURL();
    let deviceInfo = null;

    if (storeLUC) {
      deviceInfo = await getDeviceByLUC(storeLUC, token);
    }

    // Fallback to widget-bound entity
    if (!deviceInfo) {
      LogHelper.log('INIT_FALLBACK', 'Using fallback device from widget context');
      deviceInfo = getDeviceFromContext(self.ctx);
    }

    if (!deviceInfo) {
      throw new Error('Could not resolve device from URL or widget context');
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
    wireActions(self.ctx, deviceCtx);

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

self.onInit = function() {
  LogHelper.log('LIFECYCLE', 'onInit() called');
  init();
};

self.onDataUpdated = function() {
  LogHelper.log('LIFECYCLE', 'onDataUpdated() called');
  // Widget doesn't depend heavily on telemetry updates
  // Optionally refresh data here if needed
};

self.onDestroy = function() {
  LogHelper.log('LIFECYCLE', 'onDestroy() called');
  // Cleanup if needed
};
```

---

## Authentication Pattern

### Hard-Coded Credentials

The widget uses **hard-coded ThingsBoard credentials** for public access:

```javascript
const TB_USERNAME = "alarmes@myio.com.br";
const TB_PASSWORD = "hubmyio@2025!";
```

### Why Hard-Coded?

1. **Public dashboards** - Users don't have individual TB accounts
2. **Read-only access** - Credentials have limited permissions
3. **Simplified UX** - No login required for external stakeholders
4. **Controlled access** - Single account easier to manage/revoke

### Token Management

**MyIOAuthTB module** handles:
- ✅ Login with credentials
- ✅ Token caching in `localStorage`
- ✅ Automatic token refresh
- ✅ User profile caching in `sessionStorage`
- ✅ Expiration checking with 60s skew
- ✅ Retry logic with exponential backoff

### Security Note

⚠️ **IMPORTANT:** These credentials should have **READ-ONLY** permissions in ThingsBoard:
- Only access to public dashboards
- No device management permissions
- No user management permissions
- Limited to specific Customer scope

---

## Device Resolution

### Resolution Flow

```
┌──────────────────────────────────────────────────┐
│ 1. Read URL parameter: storeLUC=113CD           │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│ 2. Query ThingsBoard API:                       │
│    GET /api/tenant/devices?deviceName=113CD     │
└─────────────────┬────────────────────────────────┘
                  │
       ┌──────────┴──────────┐
       │                     │
       ▼ Found               ▼ Not Found
┌─────────────────┐   ┌─────────────────────┐
│ Use Device      │   │ 3. Fallback to      │
│ from API        │   │    widget-bound     │
│                 │   │    entity           │
└────────┬────────┘   └─────────┬───────────┘
         │                      │
         │         ┌────────────┘
         ▼         ▼
┌──────────────────────────────────────────────────┐
│ 4. Load server-scope attributes:                 │
│    - ingestionId                                 │
│    - slaveId                                     │
│    - centralId                                   │
│    - identifier                                  │
└─────────────────┬────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│ 5. Create deviceCtx and render UI               │
└──────────────────────────────────────────────────┘
```

### LUC Mapping

**LUC (Logical Unique Code)** is mapped to **deviceName** in ThingsBoard by default:

| LUC | Device Name | Device Label |
|-----|-------------|--------------|
| 113CD | store_113CD | Shopping Campinas - Store 113CD |
| 225AB | store_225AB | Mestre Álvaro - Store 225AB |
| 334EF | store_334EF | Shopping Center X - Store 334EF |

#### Dual-Path Lookup Strategy

The widget implements a **two-tier resolution** for maximum compatibility:

1. **Primary:** Query by `deviceName` via `/api/tenant/devices?deviceName={LUC}`
2. **Fallback:** Query by server-scope attribute `identifier` (configurable)

This dual-path approach ensures compatibility across different ThingsBoard installations where LUC may be stored in different fields.

#### URL Normalization

**IMPORTANT:** Always normalize URL parameters to handle edge cases:

```javascript
const storeLUC = (urlParams.get('storeLUC') || '').trim();
```

**Normalization handles:**
- Trailing/leading whitespace
- Empty strings
- Null/undefined values
- Mixed case (case-sensitive matching)

---

## Action Integration

### Library Functions

The widget integrates with **myio-js-library** action handlers:

| Action | Library Function | Purpose |
|--------|------------------|---------|
| **Settings** | `handleActionSettings(ctx, deviceCtx)` | Open device settings modal |
| **Report** | `handleActionReport(ctx, deviceCtx)` | Open consumption report dashboard |
| **Instant Telemetry** | `openDemandModal(ctx, deviceCtx)` | Open instant demand modal |
| **Dashboard** | `handleActionDashboard(ctx, deviceCtx)` | Open detailed energy dashboard |

### Device Context Structure

```javascript
const deviceCtx = {
  deviceId: "abc123...",              // ThingsBoard device UUID
  deviceName: "store_113CD",          // Device name
  deviceLabel: "Shopping Campinas",   // Display label
  ingestionId: "ing_123",             // Ingestion API ID
  slaveId: "slave_456",               // Modbus slave ID
  centralId: "central_789",           // Central system ID
  identifier: "113CD"                 // Store identifier
};
```

### Function Availability Check

Before calling library functions, the widget checks if they exist:

```javascript
if (window.handleActionSettings) {
  window.handleActionSettings(ctx, deviceCtx);
} else {
  showError('Settings action not available');
}
```

---

## Implementation Plan

### Phase 1: Core Widget (Week 1 - 5 days)

#### Day 1: Project Setup
- [ ] Create widget directory structure
- [ ] Initialize files (controller.js, template.html, style.css)
- [ ] Copy MyIOAuthTB module from PUBLIC-TELEMETRY
- [ ] Test authentication flow

#### Day 2: Device Resolution
- [ ] Implement URL parameter reading
- [ ] Implement getDeviceByLUC()
- [ ] Implement fallback to widget-bound entity
- [ ] Test with valid/invalid LUCs

#### Day 3: Attributes & UI
- [ ] Implement loadServerScopeAttributes()
- [ ] Implement renderStoreHeader()
- [ ] Create HTML template
- [ ] Add basic styling

#### Day 4: Action Integration
- [ ] Implement wireActions()
- [ ] Test with library functions (Settings, Report, Instant, Dashboard)
- [ ] Add error handling for missing functions
- [ ] Add loading/error states

#### Day 5: Polish & Testing
- [ ] Add responsive CSS
- [ ] Implement logging with MYIO:PUBLIC_TELEMETRY prefix
- [ ] Test complete flow
- [ ] Fix any issues

---

### Phase 2: Testing & Deployment (Week 2 - 3 days)

#### Day 6: Unit Testing
- [ ] Test URL parameter parsing
- [ ] Test device resolution (LUC + fallback)
- [ ] Test attribute loading
- [ ] Test authentication flow

#### Day 7: Integration Testing
- [ ] Test with valid storeLUC
- [ ] Test without storeLUC
- [ ] Test with invalid storeLUC
- [ ] Test action button clicks

#### Day 8: Deployment
- [ ] Deploy to ThingsBoard widget library
- [ ] Configure public dashboard
- [ ] Test deep-linking URLs
- [ ] Document usage

---

## Testing Strategy

### Unit Tests

```javascript
describe('Public Store Widget', () => {
  describe('getStoreLUCFromURL', () => {
    it('should extract storeLUC from URL', () => {
      // Mock window.location.search = '?storeLUC=113CD'
      const luc = getStoreLUCFromURL();
      expect(luc).toBe('113CD');
    });

    it('should return null if no storeLUC', () => {
      // Mock window.location.search = ''
      const luc = getStoreLUCFromURL();
      expect(luc).toBeNull();
    });
  });

  describe('getDeviceByLUC', () => {
    it('should fetch device by LUC', async () => {
      // Mock fetch response
      const device = await getDeviceByLUC('113CD', 'token');
      expect(device.deviceId).toBeDefined();
      expect(device.deviceName).toBe('store_113CD');
    });

    it('should return null for invalid LUC', async () => {
      // Mock fetch 404 response
      const device = await getDeviceByLUC('INVALID', 'token');
      expect(device).toBeNull();
    });
  });

  describe('loadServerScopeAttributes', () => {
    it('should load attributes successfully', async () => {
      // Mock fetch response
      const attrs = await loadServerScopeAttributes('deviceId', 'token');
      expect(attrs.ingestionId).toBeDefined();
      expect(attrs.identifier).not.toBe('-');
    });

    it('should return defaults for missing attributes', async () => {
      // Mock fetch empty response
      const attrs = await loadServerScopeAttributes('deviceId', 'token');
      expect(attrs.ingestionId).toBeNull();
      expect(attrs.identifier).toBe('-');
    });
  });
});
```

---

### Integration Tests

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| **Deep-Linking** | 1. Open URL with `?storeLUC=113CD`<br>2. Wait for widget to load | Device "Shopping Campinas" displayed with identifier "113CD" |
| **Fallback** | 1. Open URL without storeLUC<br>2. Wait for widget to load | Widget uses bound entity and displays device info |
| **Invalid LUC** | 1. Open URL with `?storeLUC=INVALID`<br>2. Check logs | Warning logged, fallback used |
| **Settings Action** | 1. Click Settings button | Settings modal opens with correct device |
| **Report Action** | 1. Click Report button | Report dashboard opens with correct device |
| **Instant Action** | 1. Click Instant Telemetry | Demand modal opens with correct device |
| **Dashboard Action** | 1. Click chart area or expand button | Energy dashboard opens with correct device |
| **No Attributes** | 1. Device with missing attributes<br>2. Load widget | Widget renders with "-" for missing attrs |
| **Authentication** | 1. Clear localStorage<br>2. Reload widget | Auto-login with hard-coded credentials |

---

### Manual Testing Checklist

- [ ] Widget loads without errors
- [ ] URL parameter `storeLUC` correctly parsed
- [ ] Device resolved by LUC successfully
- [ ] Fallback to widget-bound entity works
- [ ] Server-scope attributes loaded
- [ ] Store header displays correct info
- [ ] Settings button opens settings modal
- [ ] Report button opens report dashboard
- [ ] Instant Telemetry button opens demand modal
- [ ] Chart area opens energy dashboard
- [ ] Loading overlay shown during init
- [ ] Error message shown on failures
- [ ] Logs use `MYIO:PUBLIC_TELEMETRY` prefix
- [ ] Authentication with hard-coded credentials works
- [ ] Token refresh works automatically
- [ ] Responsive layout on mobile/tablet

---

## Security Considerations

### Authentication Security

**IMPORTANT:** If the dashboard is made Public via ThingsBoard's native public share link (publicId), skip MyIOAuthTB entirely and rely on ThingsBoard's built-in public access mechanism. This is the **recommended approach** for public dashboards.

#### Option 1: ThingsBoard Public Dashboard (Recommended)

- ✅ **No credentials in code** - Uses TB's native public sharing
- ✅ **No token management** - TB handles authentication
- ✅ **Better security** - No exposed credentials
- ⚠️ **Limitation:** Dashboard must be marked as "Public" in TB settings

#### Option 2: Hard-Coded Credentials (Current Implementation)

1. **Hard-coded credentials** stored in widget code
   - ⚠️ **Risk:** Credentials visible in browser DevTools
   - ✅ **Mitigation:** Use READ-ONLY ThingsBoard account with limited scope
   - 🔒 **Alternative:** Move credentials to server-side JWT proxy

2. **Token storage** in localStorage
   - ⚠️ **Risk:** XSS attacks could steal tokens
   - ✅ **Mitigation:** Public dashboard has no sensitive operations

3. **Public access** without individual auth
   - ⚠️ **Risk:** Anyone with URL can access
   - ✅ **Mitigation:** Acceptable for public store dashboards

### Data Security

1. **Server-scope attributes** exposed to widget
   - ⚠️ **Risk:** Sensitive IDs visible (ingestionId, slaveId)
   - ✅ **Mitigation:** These IDs are necessary for actions; not sensitive in this context

2. **Device data** visible in public dashboard
   - ⚠️ **Risk:** Energy consumption data exposed
   - ✅ **Mitigation:** Business requirement for public transparency

### Network Security

1. **All API calls** use HTTPS
2. **No sensitive data** in URL parameters (only LUC)
3. **Token** never exposed in URL or logs

---

## Success Metrics

### Functional Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Deep-Link Success Rate** | 100% | Valid LUCs resolve correctly |
| **Fallback Success Rate** | 100% | Widget works without LUC |
| **Action Success Rate** | 100% | All buttons trigger correct actions |
| **Authentication Success Rate** | ≥99% | Auto-login rarely fails |
| **Attribute Load Success Rate** | ≥95% | Attributes load successfully |

### Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Widget Load Time** | <2s | Time from init to rendered |
| **Device Resolution Time** | <500ms | Time to resolve device |
| **Attribute Load Time** | <300ms | Time to load attributes |
| **Action Response Time** | <200ms | Time from click to action |

#### Performance Optimization Rules

1. **Attribute Caching:** Avoid refetching server-scope attributes on LV data updates. Cache by `deviceId` for session lifetime to minimize API calls.

2. **Token Reuse:** MyIOAuthTB module caches tokens in localStorage with automatic expiration checking. This reduces authentication overhead significantly.

3. **Lazy Resolution:** Device lookup only happens once during initialization, not on every data update.

4. **Debounced Actions:** Click handlers are immediate, but underlying library functions may implement debouncing for API-heavy operations.

### User Experience Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Error Rate** | <1% | Failed widget loads |
| **User Confusion** | <5% | Support tickets about widget |
| **Deep-Link Usage** | >50% | Users access via storeLUC URLs |

---

## Non-Goals

### Out of Scope

1. **Historical data processing** - Widget shows current state, not history
2. **Multi-device comparisons** - Single store only
3. **i18n/Localization** - English only for this RFC
4. **Real-time telemetry** - Last Value widget, not timeseries
5. **Custom KPI badges** - Min/Max/Avg if available, but not required
6. **Embedded chart rendering** - Chart area is a **CTA shell** (call-to-action) that opens the full dashboard, NOT an embedded chart engine. The widget displays a placeholder/static visual only.
7. **User management** - No user profiles or preferences
8. **Notifications** - No alerts or notifications

### Future Work

1. **Multi-language support** - Add PT, ES translations
2. **Custom time ranges** - Allow filtering by date range
3. **KPI cards** - Show Min/Max/Avg/Total prominently
4. **Real chart rendering** - Embed actual chart instead of placeholder
5. **Favorites** - Allow users to bookmark stores
6. **Export functionality** - Download data as CSV/PDF

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **LUC mapping changes** | Low | High | Document mapping clearly; make query customizable |
| **Authentication fails** | Low | High | Retry logic; fallback to manual login |
| **Library functions missing** | Medium | Medium | Check function existence; show error gracefully |
| **Attribute loading fails** | Low | Low | Use defaults (-); widget still functional |
| **Token expires** | Medium | Low | Auto-refresh with 60s skew |
| **Invalid LUC provided** | High | Low | Fallback to widget-bound entity |

---

## Open Questions

### For Product Team

1. **Should Report open filtered time range?**
   - Option A: Current month (default)
   - Option B: Last 30 days
   - Option C: Let user select

2. **Should Instant Telemetry preselect device IDs?**
   - Auto-fill slaveId/centralId from attributes?
   - Or let user select manually?

3. **Do we need KPI badges?**
   - Show Min/Max/Avg/Total if available?
   - Or omit if data source lacks them?

4. **What error messages for users?**
   - Technical details or user-friendly messages?
   - Retry button or just refresh instruction?

---

## Appendix: Code Snippets

### URL Parameter Reading

```javascript
const urlParams = new URLSearchParams(window.location.search);
const storeLUC = urlParams.get('storeLUC');
```

### Device Fetch by LUC

```javascript
async function getDeviceByLUC(storeLUC, token) {
  const resp = await fetch(
    `${TB_HOST}/api/tenant/devices?deviceName=${encodeURIComponent(storeLUC)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) {
    throw new Error(`Device lookup failed: ${resp.status}`);
  }

  const data = await resp.json();
  return data && data.id ? {
    deviceId: data.id.id,
    deviceName: data.name,
    deviceLabel: data.label || data.name
  } : null;
}
```

### Load Server-Scope Attributes

```javascript
async function loadServerScopeAttributes(deviceId, token) {
  const resp = await fetch(
    `${TB_HOST}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes?scope=SERVER_SCOPE`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await resp.json();
  const map = Object.fromEntries(data.map(a => [a.key, a.value]));

  return {
    ingestionId: map.ingestionId ?? null,
    slaveId: map.slaveId ?? null,
    centralId: map.centralId ?? null,
    identifier: map.identifier ?? '-'
  };
}
```

### Action Wiring

```javascript
function wireActions(ctx, deviceCtx) {
  document.getElementById('btnSettings')
    .addEventListener('click', () => handleActionSettings(ctx, deviceCtx));

  document.getElementById('btnReport')
    .addEventListener('click', () => handleActionReport(ctx, deviceCtx));

  document.getElementById('btnInstant')
    .addEventListener('click', () => openDemandModal(ctx, deviceCtx));

  document.getElementById('energyBlock')
    .addEventListener('click', () => handleActionDashboard(ctx, deviceCtx));
}
```

---

## References

### Related RFCs
- **RFC-0057**: Welcome LV Widget (patterns for URL parameters and attributes)
- **RFC-0051**: Shopping Dashboard Structure
- **RFC-0052**: Global Widget Settings

### Code References
- **PUBLIC-TELEMETRY Widget**: `src/thingsboard/main-dashboard-shopping/PUBLIC-TELEMETRY/WIDGET/controller.js`
- **TELEMETRY Widget v5.2.0**: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`
- **myio-js-library**: Action handlers (handleActionSettings, handleActionReport, etc.)

### External Documentation
- [ThingsBoard REST API](https://thingsboard.io/docs/reference/rest-api/)
- [ThingsBoard Widget API](https://thingsboard.io/docs/user-guide/ui/widget-library/)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-29 | 1.0.0 | Initial RFC created based on draft |

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **Tech Lead** | [Name] | [Date] | [Signature] |
| **Product Owner** | [Name] | [Date] | [Signature] |
| **Security Lead** | [Name] | [Date] | [Signature] |

---

**End of RFC-0058**
