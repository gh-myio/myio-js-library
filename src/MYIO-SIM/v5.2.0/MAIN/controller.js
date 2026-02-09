/* global self, window, document, localStorage, MyIOLibrary, ResizeObserver */

/*********************************************************
 * MYIO – Container 2 states (menu/content)
 * - Ajusta alturas automaticamente
 * - Suporta "menu compacto" via evento global
 * - Mantém simples: os tb-dashboard-state renderizam os
 * dashboards configurados no próprio ThingsBoard.
 *********************************************************/

// Debug configuration - can be toggled at runtime via window.MyIOUtils.setDebug(true/false)
let DEBUG_ACTIVE = true;

// LogHelper utility - shared across all widgets in this context
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

// RFC-0144: Use periodKey from myio-js-library (exported in src/utils/periodUtils)
const periodKey = (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.periodKey) || (() => {
  console.error('[MAIN] periodKey not available from MyIOLibrary - library not loaded correctly');
  return '';
});

// RFC-0091: Expose shared utilities globally for child widgets (TELEMETRY, etc.)
// RFC-0091: Shared constants across all widgets
const DATA_API_HOST = 'https://api.data.apps.myio-bas.com';
const THINGSBOARD_URL = 'https://dashboard.myio-bas.com';

window.MyIOUtils = window.MyIOUtils || {};
Object.assign(window.MyIOUtils, {
  LogHelper,
  DATA_API_HOST,
  isDebugActive: () => DEBUG_ACTIVE,
  setDebug: (active) => {
    DEBUG_ACTIVE = !!active;
    console.log(`[MyIOUtils] Debug mode ${DEBUG_ACTIVE ? 'enabled' : 'disabled'}`);
  },
  // RFC-0091: Get delay time for connection status (configurable via settings)
  getDelayTimeConnectionInMins: () => {
    return widgetSettings.delayTimeConnectionInMins ?? 60;
  },
  // RFC-0091: Stub for getCachedConsumptionLimits - EQUIPMENTS expects this
  // Returns null to indicate no cached limits available (EQUIPMENTS will use defaults)
  getCachedConsumptionLimits: async (_customerId) => {
    LogHelper.log(
      '[MyIOUtils] getCachedConsumptionLimits called - returning null (not implemented in MYIO-SIM)'
    );
    return null;
  },
  // RFC-0091: Proxy getCredentials to MyIOOrchestrator - EQUIPMENTS expects this
  getCredentials: () => {
    const creds = window.MyIOOrchestrator?.getCredentials?.() || {};
    return {
      customerId: creds.CUSTOMER_ING_ID || null,
      clientId: creds.CLIENT_ID || null,
      clientSecret: creds.CLIENT_SECRET || null,
    };
  },
  // RFC-0102: Stub for updateEquipmentStats - EQUIPMENTS expects this as fallback
  // This is a no-op in MYIO-SIM since equipHeaderController handles stats
  updateEquipmentStats: (devices, cache) => {
    LogHelper.log(
      `[MyIOUtils] updateEquipmentStats called with ${devices?.length || 0} devices (no-op stub)`
    );
  },
  // RFC-0102: findValue helper for EQUIPMENTS - finds value in values array by key/dataType
  findValue: (values, key, defaultValue = null) => {
    if (!Array.isArray(values)) return defaultValue;
    const found = values.find((v) => v.key === key || v.dataType === key);
    return found ? found.value : defaultValue;
  },
  // RFC-0078: getConsumptionRangesHierarchical stub for EQUIPMENTS
  // Returns default ranges when no customer limits are available
  // NOTE: Uses 'down' and 'up' properties as expected by calculateDeviceStatusWithRanges
  getConsumptionRangesHierarchical: async (deviceId, deviceType, limits, metric, fallback) => {
    // Return default ranges for MYIO-SIM (no hierarchical resolution implemented)
    // Using 999999999 instead of Infinity because JSON doesn't support Infinity
    return {
      standbyRange: { down: 0, up: 500 },
      normalRange: { down: 500, up: 10000 },
      alertRange: { down: 10000, up: 50000 },
      failureRange: { down: 50000, up: 999999999 },
      source: 'default',
      tier: 3,
    };
  },
  // RFC-0102: mapConnectionStatus - maps raw connection status to display status
  mapConnectionStatus: (rawStatus) => {
    if (!rawStatus) return 'offline';
    const status = String(rawStatus).toLowerCase();
    if (status === 'connected' || status === 'online' || status === 'true') return 'online';
    if (status === 'disconnected' || status === 'offline' || status === 'false') return 'offline';
    return status; // Return as-is if unknown
  },
  // RFC-0102: formatRelativeTime - formats timestamp to relative time string
  formatRelativeTime: (ts) => {
    if (!ts) return '—';
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins} min atrás`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d atrás`;
  },
  // RFC-0102: formatarDuracao - formats duration in milliseconds to readable string
  formatarDuracao: (ms) => {
    if (!ms || ms < 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  },
  // RFC-0102: getCustomerNameForDevice - gets the customer/shopping name for a device
  getCustomerNameForDevice: (device) => {
    // Priority: ownerName (from ctx.data) > assetName > centralName > customerName > customerId
    // ownerName is the customer name in ThingsBoard (from ctx.data datakeyname)
    return device.ownerName || device.customerName || 'N/A';
  },
  // Temperature domain: global min/max temperature limits (populated by onDataUpdated)
  temperatureLimits: {
    minTemperature: null,
    maxTemperature: null,
  },
  // RFC-0106: Global mapInstantaneousPower from customer's parent entity
  // Used for deviceStatus calculation with power ranges
  mapInstantaneousPower: null,
  // RFC-XXXX: SuperAdmin flag - user with @myio.com.br email (except alarme/alarmes)
  // Populated by detectSuperAdmin() in onInit
  SuperAdmin: false,
  /**
   * Handle 401 Unauthorized errors globally
   * Shows toast message and reloads the page
   * @param {string} context - Context description for logging (e.g., 'TemperatureSettingsModal')
   */
  handleUnauthorizedError: (context = 'API') => {
    LogHelper.error(`[MyIOUtils] 401 Unauthorized in ${context} - session expired`);

    // Get MyIOToast from library
    const MyIOToast = window.MyIOLibrary?.MyIOToast;
    if (MyIOToast) {
      MyIOToast.error('Sessão expirada. Recarregando página...', 3000);
    } else {
      console.error('[MyIOUtils] Sessão expirada. Recarregando página...');
    }

    // Reload page after toast displays
    setTimeout(() => {
      window.location.reload();
    }, 2500);
  },

  /**
   * RFC-0106: Handle data loading errors (ctx.data timeout, no datasources, etc.)
   * Shows toast message and reloads the page to try again
   * ONLY reloads if there's no existing data displayed (prevents unnecessary reloads when cache is available)
   * Now includes RETRY logic: tries to refetch data before reloading the page
   * @param {string} domain - Domain that failed to load (e.g., 'energy', 'water')
   * @param {string} reason - Reason for the failure
   */
  handleDataLoadError: (domain = 'unknown', reason = 'timeout') => {
    LogHelper.error(`[MyIOUtils] Data load error for ${domain}: ${reason}`);

    // Check if we already have data in window.STATE for this domain
    // If we have cached/existing data, don't reload - just log the error
    const existingData = window.STATE?.[domain];
    const hasExistingData =
      existingData &&
      (existingData.summary?.total > 0 ||
        existingData.entrada?.total > 0 ||
        existingData.lojas?.total > 0 ||
        existingData._raw?.length > 0);

    if (hasExistingData) {
      LogHelper.warn(`[MyIOUtils] Data load failed but existing data found for ${domain} - skipping reload`);
      // Silent skip - don't show toast when we have cached data to display
      // User doesn't need to know about background refresh failures
      return; // Don't reload - we have data to show
    }

    // Track retry attempts per domain
    window._dataLoadRetryAttempts = window._dataLoadRetryAttempts || {};
    const retryCount = window._dataLoadRetryAttempts[domain] || 0;
    const MAX_RETRIES = 2;

    if (retryCount < MAX_RETRIES) {
      // Increment retry counter
      window._dataLoadRetryAttempts[domain] = retryCount + 1;

      const MyIOToast = window.MyIOLibrary?.MyIOToast;
      const retryMessage = `Tentativa ${retryCount + 1}/${MAX_RETRIES}: Recarregando dados (${domain})...`;

      LogHelper.warn(`[MyIOUtils] Retry ${retryCount + 1}/${MAX_RETRIES} for ${domain}`);

      if (MyIOToast) {
        MyIOToast.warning(retryMessage, 3000);
      }

      // Try to trigger a refetch by clicking the "Carregar" button after a short delay
      setTimeout(() => {
        LogHelper.log(`[MyIOUtils] Triggering retry fetch for ${domain}...`);

        // Clear any cached period key to force a fresh fetch
        if (window.MyIOOrchestrator?.clearCache) {
          window.MyIOOrchestrator.clearCache(domain);
        }

        // Try to click the "Carregar" button from HEADER widget
        // This is more reliable because it uses the exact same flow as user interaction
        const btnLoad = document.querySelector('#tbx-btn-load');
        if (btnLoad && !btnLoad.disabled) {
          LogHelper.log(`[MyIOUtils] 🔄 Clicking "Carregar" button for retry...`);
          btnLoad.click();
        } else {
          // Fallback: emit request event directly if button not available
          LogHelper.log(`[MyIOUtils] ⚠️ Carregar button not found, emitting request event directly...`);
          window.dispatchEvent(
            new CustomEvent('myio:telemetry:request-data', {
              detail: {
                domain: domain,
                isRetry: true,
                retryAttempt: retryCount + 1,
              },
            })
          );
        }
      }, 2000);

      return; // Don't reload yet - wait for retry
    }

    // Max retries exceeded - must reload
    LogHelper.error(`[MyIOUtils] Max retries (${MAX_RETRIES}) exceeded for ${domain} - reloading page`);

    // Reset retry counter before reload
    window._dataLoadRetryAttempts[domain] = 0;

    const MyIOToast = window.MyIOLibrary?.MyIOToast;
    const message = `Erro ao carregar dados (${domain}). Recarregando página...`;

    if (MyIOToast) {
      MyIOToast.error(message, 4000);
    } else {
      console.error(`[MyIOUtils] ${message}`);
      // Fallback: show alert if toast not available
      window.alert(message);
    }

    // Reload page after toast displays
    setTimeout(() => {
      window.location.reload();
    }, 3500);
  },

  /**
   * RFC-0091: Fetch customer SERVER_SCOPE attributes from ThingsBoard
   * Used by EQUIPMENTS and other widgets to get credentials and configuration
   * @param {string} customerId - Customer entity ID
   * @returns {Promise<Object>} Object with client_id, client_secret, mapInstantaneousPower, etc.
   */
  fetchCustomerServerScopeAttrs: async (customerId) => {
    const token = localStorage.getItem('jwt_token');
    if (!token || !customerId) {
      LogHelper.warn('[MyIOUtils] fetchCustomerServerScopeAttrs: missing token or customerId');
      return {};
    }

    const url = `${THINGSBOARD_URL}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE`;

    try {
      LogHelper.log(`[MyIOUtils] Fetching SERVER_SCOPE attributes for customer: ${customerId}`);

      const response = await fetch(url, {
        headers: {
          'X-Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        LogHelper.warn(`[MyIOUtils] Failed to fetch SERVER_SCOPE: ${response.status}`);
        return {};
      }

      const attributes = await response.json();
      LogHelper.log('[MyIOUtils] SERVER_SCOPE attributes received:', attributes.length, 'items');

      // Convert array of {key, value} to object
      const result = {};
      for (const attr of attributes) {
        const key = attr.key;
        let value = attr.value;

        // Parse JSON values if needed
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if parse fails
          }
        }

        result[key] = value;
      }

      LogHelper.log('[MyIOUtils] Parsed SERVER_SCOPE result:', Object.keys(result));
      return result;
    } catch (error) {
      LogHelper.error('[MyIOUtils] Error fetching SERVER_SCOPE:', error);
      return {};
    }
  },

  /**
   * RFC-0097: Fetch energy consumption for a specific day/period
   * Used by ENERGY widget for chart data
   * @param {string} customerId - Customer ID (ingestion ID)
   * @param {number} startTs - Start timestamp in ms
   * @param {number} endTs - End timestamp in ms
   * @param {string} granularity - Granularity ('1d', '1h', etc.) - default '1d'
   * @returns {Promise<Array>} Array of device consumption data
   */
  fetchEnergyDayConsumption: async (customerId, startTs, endTs, granularity = '1d') => {
    try {
      // Get credentials from orchestrator
      const creds = window.MyIOOrchestrator?.getCredentials?.();
      if (!creds?.CLIENT_ID || !creds?.CLIENT_SECRET) {
        LogHelper.error('[MyIOUtils] fetchEnergyDayConsumption: No credentials available');
        return [];
      }

      // Build auth client - use MyIOLibrary.buildMyioIngestionAuth directly
      const MyIOLib = (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) || window.MyIOLibrary;
      if (!MyIOLib || !MyIOLib.buildMyioIngestionAuth) {
        LogHelper.error(
          '[MyIOUtils] fetchEnergyDayConsumption: MyIOLibrary.buildMyioIngestionAuth not available'
        );
        return [];
      }

      const myIOAuth = MyIOLib.buildMyioIngestionAuth({
        dataApiHost: DATA_API_HOST,
        clientId: creds.CLIENT_ID,
        clientSecret: creds.CLIENT_SECRET,
      });

      // Get token
      const token = await myIOAuth.getToken();
      if (!token) {
        LogHelper.error('[MyIOUtils] fetchEnergyDayConsumption: Failed to get token');
        return [];
      }

      // Format timestamps to ISO
      const startISO = new Date(startTs).toISOString();
      const endISO = new Date(endTs).toISOString();

      // Build API URL
      // RFC-FIX: Add profileIds to filter only 3F_MEDIDOR devices (lojas)
      const ENERGY_PROFILE_ID = '696be74a-a978-44ce-b50f-5b724e7effb8'; // 3F_MEDIDOR profile
      const url = new URL(`${DATA_API_HOST}/api/v1/telemetry/customers/${customerId}/energy/devices/totals`);
      url.searchParams.set('startTime', startISO);
      url.searchParams.set('endTime', endISO);
      url.searchParams.set('deep', '1');
      url.searchParams.set('profileIds', ENERGY_PROFILE_ID);
      if (granularity) {
        url.searchParams.set('granularity', granularity);
      }

      LogHelper.log(`[MyIOUtils] fetchEnergyDayConsumption: ${url.toString()}`);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store', // RFC-0001: Always fetch fresh data
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.MyIOUtils?.handleUnauthorizedError?.('fetchEnergyDayConsumption');
        }
        throw new Error(`API error: ${res.status}`);
      }

      const json = await res.json();
      // RFC-0130: API returns { data: [...], summary: { totalDevices, totalValue } }
      const devices = Array.isArray(json) ? json : json?.data || [];
      const totalValue =
        json?.summary?.totalValue || devices.reduce((sum, d) => sum + (d.total_value || 0), 0);

      // RFC-0130: Aggregate by customer for separate view mode
      const byCustomer = {};
      devices.forEach((d) => {
        const custId = d.customerId;
        if (custId) {
          if (!byCustomer[custId]) {
            byCustomer[custId] = { name: d.customerName || custId, total: 0, deviceCount: 0 };
          }
          byCustomer[custId].total += d.total_value || 0;
          byCustomer[custId].deviceCount++;
        }
      });

      LogHelper.log(
        `[MyIOUtils] fetchEnergyDayConsumption: Got ${devices.length} devices, total: ${totalValue.toFixed(
          2
        )} kWh, customers: ${Object.keys(byCustomer).length}`
      );

      // Return object with devices, total, and byCustomer for chart flexibility
      return {
        devices,
        total: totalValue,
        byCustomer,
        summary: json?.summary || { totalDevices: devices.length, totalValue },
      };
    } catch (error) {
      LogHelper.error('[MyIOUtils] fetchEnergyDayConsumption error:', error);
      return { devices: [], total: 0, byCustomer: {}, summary: { totalDevices: 0, totalValue: 0 } };
    }
  },

  /**
   * RFC-0130: Fetch water consumption data for a specific period
   * Similar to fetchEnergyDayConsumption but for water domain
   * @param {string} customerId - Customer ingestion ID
   * @param {number} startTs - Start timestamp in ms
   * @param {number} endTs - End timestamp in ms
   * @param {string} granularity - Granularity ('1d', '1h', etc.) - default '1d'
   * @returns {Promise<Object>} { devices, total, byCustomer, summary }
   */
  fetchWaterDayConsumption: async (customerId, startTs, endTs, granularity = '1d') => {
    try {
      // Get credentials from orchestrator
      const creds = window.MyIOOrchestrator?.getCredentials?.();
      if (!creds?.CLIENT_ID || !creds?.CLIENT_SECRET) {
        LogHelper.error('[MyIOUtils] fetchWaterDayConsumption: No credentials available');
        return { devices: [], total: 0, byCustomer: {}, summary: { totalDevices: 0, totalValue: 0 } };
      }

      // Build auth client
      const MyIOLib = (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) || window.MyIOLibrary;
      if (!MyIOLib || !MyIOLib.buildMyioIngestionAuth) {
        LogHelper.error(
          '[MyIOUtils] fetchWaterDayConsumption: MyIOLibrary.buildMyioIngestionAuth not available'
        );
        return { devices: [], total: 0, byCustomer: {}, summary: { totalDevices: 0, totalValue: 0 } };
      }

      const myIOAuth = MyIOLib.buildMyioIngestionAuth({
        dataApiHost: DATA_API_HOST,
        clientId: creds.CLIENT_ID,
        clientSecret: creds.CLIENT_SECRET,
      });

      // Get token
      const token = await myIOAuth.getToken();
      if (!token) {
        LogHelper.error('[MyIOUtils] fetchWaterDayConsumption: Failed to get token');
        return { devices: [], total: 0, byCustomer: {}, summary: { totalDevices: 0, totalValue: 0 } };
      }

      // Format timestamps to ISO
      const startISO = new Date(startTs).toISOString();
      const endISO = new Date(endTs).toISOString();

      // Build URL for water API
      // RFC-FIX: Add profileIds to filter only HIDROMETRO devices
      const WATER_PROFILE_ID = '526275a7-55cd-4e40-a9b8-0b08b7db6cdc'; // HIDROMETRO profile
      const url = new URL(`${DATA_API_HOST}/api/v1/telemetry/customers/${customerId}/water/devices/totals`);
      url.searchParams.set('startTime', startISO);
      url.searchParams.set('endTime', endISO);
      url.searchParams.set('deep', '1');
      url.searchParams.set('profileIds', WATER_PROFILE_ID);
      if (granularity) {
        url.searchParams.set('granularity', granularity);
      }

      LogHelper.log(`[MyIOUtils] fetchWaterDayConsumption: ${url.toString()}`);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store', // RFC-0001: Always fetch fresh data
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.MyIOUtils?.handleUnauthorizedError?.('fetchWaterDayConsumption');
        }
        throw new Error(`API error: ${res.status}`);
      }

      const json = await res.json();
      // RFC-0130: API returns { data: [...], summary: { totalDevices, totalValue } }
      const devices = Array.isArray(json) ? json : json?.data || [];
      const totalValue =
        json?.summary?.totalValue || devices.reduce((sum, d) => sum + (d.total_value || 0), 0);

      // RFC-0130: Aggregate by customer for separate view mode
      const byCustomer = {};
      devices.forEach((d) => {
        const custId = d.customerId;
        if (custId) {
          if (!byCustomer[custId]) {
            byCustomer[custId] = { name: d.customerName || custId, total: 0, deviceCount: 0 };
          }
          byCustomer[custId].total += d.total_value || 0;
          byCustomer[custId].deviceCount++;
        }
      });

      LogHelper.log(
        `[MyIOUtils] fetchWaterDayConsumption: Got ${devices.length} devices, total: ${totalValue.toFixed(
          2
        )} m³, customers: ${Object.keys(byCustomer).length}`
      );

      return {
        devices,
        total: totalValue,
        byCustomer,
        summary: json?.summary || { totalDevices: devices.length, totalValue },
      };
    } catch (error) {
      LogHelper.error('[MyIOUtils] fetchWaterDayConsumption error:', error);
      return { devices: [], total: 0, byCustomer: {}, summary: { totalDevices: 0, totalValue: 0 } };
    }
  },

  /**
   * RFC-0130: Calculate device consumption trends for predictive insights
   * Analyzes historical consumption patterns to identify usage trends
   * @param {Array} historicalData - Array of { timestamp, value } objects
   * @param {Object} options - Analysis options
   * @returns {Object} Trend analysis results
   */
  calculateConsumptionTrends: (historicalData, options = {}) => {
    if (!Array.isArray(historicalData) || historicalData.length < 2) {
      LogHelper.warn('[MyIOUtils] calculateConsumptionTrends: Insufficient historical data');
      return { trend: 'insufficient_data', confidence: 0, slope: 0, changePercent: 0 };
    }

    const {
      minDataPoints = 7, // At least 7 data points for meaningful analysis
      recentWindow = 3, // Last 3 points for recent trend
    } = options;

    if (historicalData.length < minDataPoints) {
      return { trend: 'insufficient_data', confidence: 0, slope: 0, changePercent: 0 };
    }

    // Calculate linear regression for overall trend
    const validPoints = historicalData.filter(
      (d) => d.value !== null && d.value !== undefined && !isNaN(d.value)
    );
    if (validPoints.length < minDataPoints) {
      return { trend: 'insufficient_data', confidence: 0, slope: 0, changePercent: 0 };
    }

    const n = validPoints.length;
    const sumX = validPoints.reduce((sum, _, i) => sum + i, 0);
    const sumY = validPoints.reduce((sum, d) => sum + d.value, 0);
    const sumXY = validPoints.reduce((sum, d, i) => sum + i * d.value, 0);
    const sumXX = validPoints.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate recent trend (last recentWindow points)
    const recentPoints = validPoints.slice(-recentWindow);
    if (recentPoints.length >= 2) {
      const recentStartIndex = n - recentPoints.length;
      const recentSumX = recentPoints.reduce((sum, _, i) => sum + (recentStartIndex + i), 0);
      const recentSumY = recentPoints.reduce((sum, d) => sum + d.value, 0);
      const recentSumXY = recentPoints.reduce((sum, d, i) => sum + (recentStartIndex + i) * d.value, 0);
      const recentSumXX = recentPoints.reduce(
        (sum, _, i) => sum + (recentStartIndex + i) * (recentStartIndex + i),
        0
      );

      const recentN = recentPoints.length;
      const recentSlope =
        (recentN * recentSumXY - recentSumX * recentSumY) /
        (recentN * recentSumXX - recentSumX * recentSumXX);

      // Compare overall and recent slopes to determine trend
      const recentAvgValue = recentPoints.reduce((sum, d) => sum + d.value, 0) / recentPoints.length;
      const overallAvgValue = validPoints.reduce((sum, d) => sum + d.value, 0) / validPoints.length;

      const changePercent = ((recentAvgValue - overallAvgValue) / overallAvgValue) * 100;
      const isIncreasing = recentSlope > 0.01; // Small threshold to avoid noise
      const isDecreasing = recentSlope < -0.01;
      const isStable = !isIncreasing && !isDecreasing;

      // Calculate confidence based on data consistency
      const values = validPoints.map((d) => d.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = mean !== 0 ? stdDev / Math.abs(mean) : 0;
      const confidence = Math.max(0, Math.min(100, (1 - coefficientOfVariation) * 100));

      let trend = 'stable';
      if (isIncreasing) trend = 'increasing';
      else if (isDecreasing) trend = 'decreasing';

      return {
        trend,
        confidence: Math.round(confidence),
        slope,
        recentSlope,
        changePercent: Math.round(changePercent * 100) / 100,
        overallAvg: overallAvgValue,
        recentAvg: recentAvgValue,
        dataPoints: n,
      };
    }

    // Fallback for insufficient recent data
    return {
      trend: 'stable',
      confidence: 30,
      slope,
      recentSlope: 0,
      changePercent: 0,
      overallAvg: validPoints.reduce((sum, d) => sum + d.value, 0) / validPoints.length,
      recentAvg: validPoints[validPoints.length - 1].value,
      dataPoints: n,
    };
  },

  /**
   * RFC-0130: Optimize energy usage based on current consumption patterns
   * Provides recommendations for energy conservation
   * @param {Array} consumptionData - Array of consumption records
   * @param {Object} deviceInfo - Device metadata
   * @returns {Array} Array of optimization recommendations
   */
  optimizeEnergyUsage: (consumptionData, deviceInfo = {}) => {
    if (!Array.isArray(consumptionData) || consumptionData.length === 0) {
      LogHelper.warn('[MyIOUtils] optimizeEnergyUsage: No consumption data provided');
      return [];
    }

    const recommendations = [];
    const trends = window.MyIOUtils.calculateConsumptionTrends(consumptionData, { minDataPoints: 3 });

    // Analyze trends for specific recommendations
    if (trends.trend === 'increasing' && trends.changePercent > 10) {
      recommendations.push({
        type: 'high_consumption_trend',
        priority: 'high',
        message: `${deviceInfo.label || 'Equipamento'} apresenta tendência de aumento de ${
          trends.changePercent
        }% no consumo nos últimos dias.`,
        suggestion: 'Verificar possíveis vazamentos ou uso ineficiente.',
        potentialSavings: 'Até 15% de redução possível',
        confidence: trends.confidence,
      });
    }

    // Check for abnormal spikes in recent consumption
    const recentData = consumptionData.slice(-7); // Last 7 days
    if (recentData.length >= 3) {
      const avgConsumption = recentData.reduce((sum, d) => sum + (d.value || 0), 0) / recentData.length;
      const maxValue = Math.max(...recentData.map((d) => d.value || 0));
      const spikeRatio = maxValue / avgConsumption;

      if (spikeRatio > 2.0) {
        recommendations.push({
          type: 'consumption_spike',
          priority: 'medium',
          message: `Pico de consumo detectado (${(spikeRatio * 100).toFixed(0)}% acima da média).`,
          suggestion: 'Investigar causa do pico de consumo.',
          potentialSavings: 'Redução de picos pode economizar até 10%',
          confidence: 80,
        });
      }
    }

    // Check for potential nighttime usage (waste)
    const hasTimestamps = consumptionData.every((d) => d.timestamp);
    if (hasTimestamps) {
      const nighttimeUsage = consumptionData.filter((d) => {
        const hour = new Date(d.timestamp).getHours();
        return hour >= 22 || hour <= 6; // 10 PM to 6 AM
      });

      if (nighttimeUsage.length > 0) {
        const totalNightUsage = nighttimeUsage.reduce((sum, d) => sum + (d.value || 0), 0);
        const avgNightUsage = totalNightUsage / nighttimeUsage.length;
        const totalDayUsage = consumptionData.reduce((sum, d) => sum + (d.value || 0), 0) - totalNightUsage;
        const avgDayUsage =
          consumptionData.length > nighttimeUsage.length
            ? totalDayUsage / (consumptionData.length - nighttimeUsage.length)
            : 0;

        if (avgNightUsage > avgDayUsage * 0.5) {
          recommendations.push({
            type: 'nighttime_usage',
            priority: 'low',
            message: 'Consumo elevado detectado durante período noturno.',
            suggestion: 'Verificar se equipamentos podem ser desligados à noite.',
            potentialSavings: 'Até 20% de redução se otimizado',
            confidence: 70,
          });
        }
      }
    }

    // Generic efficiency recommendations based on device type
    const deviceType = (deviceInfo.deviceType || '').toLowerCase();
    if (deviceType.includes('bomba') || deviceType.includes('motor')) {
      recommendations.push({
        type: 'pump_efficiency',
        priority: 'medium',
        message: 'Verificar eficiência de bombas e motores.',
        suggestion: 'Considerar manutenção preventiva para reduzir consumo.',
        potentialSavings: '5-10% de economia possível',
        confidence: 60,
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  },

  // ============================================
  // RFC-0131: Refactoring Utilities (ENERGY/WATER shared)
  // ============================================

  /**
   * RFC-0131: ThingsBoard-compatible element selector
   * Searches within widget container first, fallback to document
   * @param {Object} ctx - ThingsBoard widget context (self.ctx)
   * @param {string} id - Element ID to find
   * @returns {HTMLElement|null} Found element or null
   */
  $id: (ctx, id) => {
    const container = ctx?.$container?.[0];
    if (container?.querySelector) return container.querySelector(`#${id}`);
    return document.getElementById(id);
  },

  /**
   * RFC-0131: Register event listener on both window and window.parent
   * Returns cleanup function to remove both listeners
   * @param {string} eventName - Event name to listen for
   * @param {Function} handler - Event handler function
   * @param {Object} options - addEventListener options
   * @returns {Function} Cleanup function to remove listeners
   */
  addListenerBoth: (eventName, handler, options) => {
    window.addEventListener(eventName, handler, options);
    if (window.parent && window.parent !== window) {
      window.parent.addEventListener(eventName, handler, options);
    }
    return () => {
      window.removeEventListener(eventName, handler, options);
      if (window.parent && window.parent !== window) {
        window.parent.removeEventListener(eventName, handler, options);
      }
    };
  },

  /**
   * RFC-0131: Wait for orchestrator to be ready
   * Uses myio:orchestrator:ready event + isReady check
   * Replaces polling patterns in ENERGY and WATER
   * @param {Function} cb - Callback when orchestrator is ready
   * @param {Object} opts - Options { timeoutMs: 10000 }
   * @returns {Function} Cleanup function
   */
  onOrchestratorReady: (cb, { timeoutMs = 10000 } = {}) => {
    const getOrch = () => window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;

    // Already ready?
    const orch = getOrch();
    if (orch?.isReady) {
      try {
        cb(orch);
      } catch (e) {
        LogHelper.error('[MyIOUtils] onOrchestratorReady callback error:', e);
      }
      return () => {};
    }

    let done = false;
    let cleanup;

    const onReady = () => {
      if (done) return;
      done = true;
      if (cleanup) cleanup();
      const orch2 = getOrch();
      if (orch2) {
        try {
          cb(orch2);
        } catch (e) {
          LogHelper.error('[MyIOUtils] onOrchestratorReady callback error:', e);
        }
      }
    };

    const off = window.MyIOUtils.addListenerBoth('myio:orchestrator:ready', onReady);
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      if (cleanup) cleanup();
      LogHelper.warn(`[MyIOUtils] onOrchestratorReady timeout after ${timeoutMs}ms`);
    }, timeoutMs);

    cleanup = () => {
      clearTimeout(timer);
      off();
    };

    return cleanup;
  },

  /**
   * RFC-0131: Open consumption fullscreen modal (unified for all domains)
   * Removes duplication of openFullscreenModal() in ENERGY and WATER
   * @param {Object} params - Modal configuration
   * @returns {Promise<{modal}>} Promise resolving to modal instance
   */
  openConsumptionFullscreen: async ({
    domain,
    title,
    unit,
    unitLarge,
    thresholdForLargeUnit,
    decimalPlaces = 1,
    chartConfig,
    cachedChartData,
    consumptionChartInstance,
    fetchData,
    theme = 'light',
    showSettingsButton = false,
    onClose,
  }) => {
    const MyIOLib = window.MyIOLibrary || (typeof MyIOLibrary !== 'undefined' ? MyIOLibrary : null);
    if (!MyIOLib?.createConsumptionModal) {
      throw new Error('MyIOLibrary.createConsumptionModal not available');
    }

    const initialData = cachedChartData || consumptionChartInstance?.getCachedData?.() || null;

    const modal = MyIOLib.createConsumptionModal({
      domain,
      title,
      unit,
      unitLarge,
      thresholdForLargeUnit,
      decimalPlaces,
      defaultPeriod: chartConfig?.period || 7,
      defaultChartType: chartConfig?.chartType || 'line',
      defaultVizMode: chartConfig?.vizMode || 'total',
      theme,
      showSettingsButton,
      fetchData,
      initialData,
      onClose,
    });

    await modal.open();
    return { modal };
  },

  /**
   * RFC-0131: Create a TTL (time-to-live) cache
   * Useful for caching data with automatic expiration
   * @param {number} ttlMs - Time-to-live in milliseconds
   * @returns {Object} Cache object with get/set/clear methods
   */
  createTTLCache: (ttlMs) => {
    let value = null;
    let ts = 0;

    return {
      get: () => (value && Date.now() - ts < ttlMs ? value : null),
      set: (v) => {
        value = v;
        ts = Date.now();
      },
      clear: () => {
        value = null;
        ts = 0;
      },
    };
  },

  /**
   * RFC-0130: Calculate carbon footprint estimation from energy consumption
   * Useful for environmental impact reporting
   * @param {number} energyConsumptionKwh - Energy consumption in kWh
   * @param {number} carbonIntensity - Carbon intensity factor (gCO2/kWh) - default: 250g/kWh (Brazil average)
   * @returns {Object} Carbon footprint calculations
   */
  calculateCarbonFootprint: (energyConsumptionKwh, carbonIntensity = 250) => {
    if (!energyConsumptionKwh || energyConsumptionKwh <= 0) {
      return { co2Grams: 0, co2Kg: 0, co2Tonnes: 0, equivalentKmDriven: 0 };
    }

    const co2Grams = energyConsumptionKwh * carbonIntensity;
    const co2Kg = co2Grams / 1000;
    const co2Tonnes = co2Kg / 1000;

    // Equivalent of km driven by an average car (120g CO2/km)
    const equivalentKmDriven = co2Grams / 120;

    return {
      co2Grams: Math.round(co2Grams),
      co2Kg: Math.round(co2Kg * 100) / 100,
      co2Tonnes: Math.round(co2Tonnes * 1000) / 1000,
      equivalentKmDriven: Math.round(equivalentKmDriven),
      carbonIntensityUsed: carbonIntensity,
      assumptions: 'Based on Brazilian grid average carbon intensity',
    };
  },
});
// Expose customerTB_ID via getter (reads from MyIOOrchestrator when available)
// Check if property already exists to avoid "Cannot redefine property" error
if (!Object.prototype.hasOwnProperty.call(window.MyIOUtils, 'customerTB_ID')) {
  Object.defineProperty(window.MyIOUtils, 'customerTB_ID', {
    get: () => window.MyIOOrchestrator?.customerTB_ID || null,
    enumerable: true,
    configurable: true, // Allow redefinition if needed
  });
}

// RFC-0051.1: Global widget settings (will be populated in onInit)
// IMPORTANT: customerTB_ID must NEVER be 'default' - it must always be a valid ThingsBoard ID
let widgetSettings = {
  customerTB_ID: null, // MUST be set in onInit
  debugMode: false,
  domainsEnabled: { energy: true, water: true, temperature: true },
  excludeDevicesAtCountSubtotalCAG: [], // Entity IDs to exclude from CAG subtotal calculation
  delayTimeConnectionInMins: 60, // RFC-0091: Default delay time for connection status
};

// Config object (populated in onInit from widgetSettings)
let config = null;

// ============================================================================
// RFC-0106: Device Classification (moved from TELEMETRY)
// Centralized classification logic for device categorization
// ============================================================================

/**
 * RFC-0097/RFC-0106: Centralized device classification configuration
 * All deviceType → category mapping rules are defined here
 */
const DEVICE_CLASSIFICATION_CONFIG = {
  // DeviceTypes que pertencem à categoria Climatização
  // Baseado em src/MYIO-SIM/v5.2.0/mapPower.json
  climatizacao: {
    // DeviceTypes que são SEMPRE climatização (independente do identifier)
    deviceTypes: ['CHILLER', 'AR_CONDICIONADO', 'HVAC', 'FANCOIL'],
    // DeviceTypes genéricos que só são climatização SE tiverem identifier de climatização
    conditionalDeviceTypes: ['BOMBA', 'MOTOR'],
    // Identifiers que indicam climatização (usado para deviceTypes condicionais)
    identifiers: ['CAG', 'FANCOIL'],
    identifierPrefixes: ['CAG-', 'FANCOIL-'],
  },
  // DeviceTypes que pertencem à categoria Elevadores
  elevadores: {
    deviceTypes: ['ELEVADOR'],
    identifiers: ['ELV', 'ELEVADOR', 'ELEVADORES'],
    identifierPrefixes: ['ELV-', 'ELEVADOR-'],
  },
  // DeviceTypes que pertencem à categoria Escadas Rolantes
  escadas_rolantes: {
    deviceTypes: ['ESCADA_ROLANTE'],
    identifiers: ['ESC', 'ESCADA', 'ESCADASROLANTES'],
    identifierPrefixes: ['ESC-', 'ESCADA-', 'ESCADA_'],
  },
};

// Sets pré-computados para lookup rápido
const CLIMATIZACAO_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceTypes);
const CLIMATIZACAO_CONDITIONAL_TYPES_SET = new Set(
  DEVICE_CLASSIFICATION_CONFIG.climatizacao.conditionalDeviceTypes || []
);
const ELEVADORES_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.elevadores.deviceTypes);
const ESCADAS_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.deviceTypes);

const CLIMATIZACAO_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.climatizacao.identifiers);
const ELEVADORES_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.elevadores.identifiers);
const ESCADAS_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.identifiers);

const ALLOWED_EQUIPMENT_PROFILES_SET = new Set([
  'CHILLER',
  'FANCOIL',
  'ELEVADOR',
  'ESCADA_ROLANTE',
  'MOTOR',
  'BOMBA_HIDRAULICA',
  'BOMBA_INCENDIO',
  'BOMBA_CAG',
]);

// RFC-0097: Regex para excluir equipamentos ao detectar widget "lojas"
// Construído dinamicamente a partir do config
const EQUIPMENT_EXCLUSION_PATTERN = new RegExp(
  [
    ...DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceTypes,
    ...DEVICE_CLASSIFICATION_CONFIG.elevadores.deviceTypes,
    ...DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.deviceTypes,
    'bomba',
    'subesta',
    'entrada',
  ]
    .map((t) => t.toLowerCase())
    .join('|'),
  'i'
);

function getEffectiveDeviceProfile(item) {
  if (!item || typeof item !== 'object') return '';
  return String(item.effectiveDeviceType || item.deviceProfile || item.deviceType || '').toUpperCase();
}

function isAllowedEquipmentProfile(item) {
  const profile = getEffectiveDeviceProfile(item);
  return ALLOWED_EQUIPMENT_PROFILES_SET.has(profile);
}

/**
 * RFC-0106: Check if device is a store (loja)
 * A device is considered a store when BOTH deviceType AND deviceProfile equal '3F_MEDIDOR'
 *
 * @param {Object|string} itemOrDeviceProfile - Device item with deviceProfile/deviceType properties, or deviceProfile string directly
 * @returns {boolean} True if device is a store
 */
function isStoreDevice(itemOrDeviceProfile) {
  if (typeof itemOrDeviceProfile === 'string') {
    // If only a string is passed, assume it's deviceProfile and return true if it matches
    return String(itemOrDeviceProfile || '').toUpperCase() === '3F_MEDIDOR';
  }

  if (!itemOrDeviceProfile || typeof itemOrDeviceProfile !== 'object') {
    return false;
  }

  const deviceType = String(itemOrDeviceProfile.deviceType || '').toUpperCase();
  // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
  const deviceProfile = String(
    itemOrDeviceProfile.deviceProfile || itemOrDeviceProfile.deviceType || ''
  ).toUpperCase();

  // A device is a store only if BOTH deviceType AND deviceProfile are '3F_MEDIDOR'
  return deviceProfile === '3F_MEDIDOR' && deviceType === '3F_MEDIDOR';
}

/**
 * RFC-FIX: Check if device is an ENTRADA device (main meters, transformers)
 * These devices should be excluded from the customerTotal calculation in the header
 * because they represent total building consumption, not individual stores/equipment
 *
 * Rule: deviceProfile = 'ENTRADA' OR name contains: Trafo, Entrada, Geral (case insensitive)
 *
 * @param {Object} item - Device item with deviceProfile, name, label properties
 * @returns {boolean} True if device is an ENTRADA device
 */
function isEntradaDevice(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }

  // Check deviceProfile = 'ENTRADA'
  const deviceProfile = String(item.deviceProfile || '').toUpperCase();
  if (deviceProfile === 'ENTRADA') {
    return true;
  }

  // Check name/label for entrada patterns (case insensitive)
  const name = String(item.name || item.label || item.entityLabel || '').toUpperCase();
  const entradaPatterns = ['TRAFO', 'ENTRADA', 'GERAL'];

  for (const pattern of entradaPatterns) {
    if (name.includes(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * RFC-0109: Simplified water meter classification
 *
 * New rule:
 * - STORE (loja): deviceType = deviceProfile = HIDROMETRO (both must be exactly "HIDROMETRO")
 * - AREA_COMUM: everything else
 *
 * @param {Object} item - Device item with deviceType and deviceProfile properties
 * @returns {boolean} True if device is a water store (loja)
 */
function isWaterStoreDevice(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const dt = String(item.deviceType || '').toUpperCase();
  // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
  const dp = String(item.deviceProfile || item.deviceType || '').toUpperCase();

  // LOJA: deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO
  return dt === 'HIDROMETRO' && dp === 'HIDROMETRO';
}

/**
 * RFC-0109: Water meter classification
 * Returns classification: 'loja', 'areacomum', or 'entrada'
 *
 * Rules:
 * - LOJA: deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO
 * - AREA_COMUM:
 *   - deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_AREA_COMUM
 *   - OR deviceType = HIDROMETRO_AREA_COMUM (deviceProfile não importa)
 * - ENTRADA:
 *   - deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_SHOPPING
 *   - OR deviceType = HIDROMETRO_SHOPPING (deviceProfile não importa)
 *
 * @param {Object} item - Device item with deviceType and deviceProfile properties
 * @returns {'loja'|'areacomum'|'entrada'}
 */
function classifyWaterMeterDevice(item) {
  if (!item || typeof item !== 'object') {
    return 'areacomum';
  }

  const dt = String(item.deviceType || '').toUpperCase();
  // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
  const dp = String(item.deviceProfile || item.deviceType || '').toUpperCase();

  // LOJA: deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO
  if (dt === 'HIDROMETRO' && dp === 'HIDROMETRO') {
    return 'loja';
  }

  // ENTRADA: deviceType = HIDROMETRO_SHOPPING OR (deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_SHOPPING)
  if (dt === 'HIDROMETRO_SHOPPING' || (dt === 'HIDROMETRO' && dp === 'HIDROMETRO_SHOPPING')) {
    return 'entrada';
  }

  // AREA_COMUM: deviceType = HIDROMETRO_AREA_COMUM OR (deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_AREA_COMUM)
  // Also default for any other combination
  return 'areacomum';
}

/**
 * RFC-0109: Check if device is a water entrada (shopping entrance)
 * ENTRADA: deviceType = HIDROMETRO_SHOPPING OR (deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_SHOPPING)
 *
 * @param {Object} item - Device item with deviceType and deviceProfile properties
 * @returns {boolean} True if device is a water entrada
 */
function isWaterEntradaDevice(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const dt = String(item.deviceType || '').toUpperCase();
  // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
  const dp = String(item.deviceProfile || item.deviceType || '').toUpperCase();

  // ENTRADA: deviceType = HIDROMETRO_SHOPPING OR (deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_SHOPPING)
  return dt === 'HIDROMETRO_SHOPPING' || (dt === 'HIDROMETRO' && dp === 'HIDROMETRO_SHOPPING');
}

/**
 * RFC-0106: Classify device by deviceProfile attribute
 * Single datasource approach - classification based on deviceProfile
 *
 * Rules:
 * - Lojas: deviceProfile === '3F_MEDIDOR' (uses isStoreDevice)
 * - Others: classify by deviceProfile using DEVICE_CLASSIFICATION_CONFIG
 *
 * @param {Object} item - Device item with deviceType, deviceProfile and identifier properties
 * @returns {'lojas'|'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDeviceByDeviceType(item) {
  if (!item) return 'outros';

  // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
  const deviceProfile = String(item.deviceProfile || item.deviceType || '').toUpperCase();

  // RFC-0106: Lojas - use centralized isStoreDevice
  if (isStoreDevice(item)) {
    return 'lojas';
  }

  // RFC-0106: For all other classifications, use deviceProfile directly
  if (!deviceProfile || deviceProfile === 'N/D') {
    return 'outros';
  }

  // DeviceProfiles que são SEMPRE climatização (CHILLER, FANCOIL, etc.)
  if (CLIMATIZACAO_DEVICE_TYPES_SET.has(deviceProfile)) {
    return 'climatizacao';
  }

  // DeviceProfiles condicionais (BOMBA, MOTOR) - só climatização se identifier for CAG, etc.
  if (CLIMATIZACAO_CONDITIONAL_TYPES_SET.has(deviceProfile)) {
    const identifier = String(item.identifier || '')
      .toUpperCase()
      .trim();

    // Verificar se o identifier indica climatização
    if (CLIMATIZACAO_IDENTIFIERS_SET.has(identifier)) {
      return 'climatizacao';
    }
    // Verificar prefixos (CAG-, FANCOIL-, etc.)
    for (const prefix of DEVICE_CLASSIFICATION_CONFIG.climatizacao.identifierPrefixes) {
      if (identifier.startsWith(prefix.toUpperCase())) {
        return 'climatizacao';
      }
    }
    // BOMBA/MOTOR sem identifier de climatização → outros
    return 'outros';
  }

  if (ELEVADORES_DEVICE_TYPES_SET.has(deviceProfile)) {
    return 'elevadores';
  }

  if (ESCADAS_DEVICE_TYPES_SET.has(deviceProfile)) {
    return 'escadas_rolantes';
  }

  // Default: outros
  return 'outros';
}

/**
 * RFC-0097: Classify device by identifier attribute
 * Uses centralized DEVICE_CLASSIFICATION_CONFIG
 * @param {string} identifier - Device identifier (e.g., "CAG", "Fancoil", "ELV", etc.)
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'|null}
 */
function classifyDeviceByIdentifier(identifier = '') {
  // Safe guard against null/undefined/empty
  if (!identifier || identifier === 'N/A' || identifier === 'null' || identifier === 'undefined') {
    return null;
  }

  const id = String(identifier).trim().toUpperCase();

  // Ignore "Sem Identificador identificado" marker
  if (id.includes('SEM IDENTIFICADOR')) {
    return null;
  }

  // Check each category using centralized config
  // Climatização
  if (CLIMATIZACAO_IDENTIFIERS_SET.has(id)) {
    return 'climatizacao';
  }
  for (const prefix of DEVICE_CLASSIFICATION_CONFIG.climatizacao.identifierPrefixes) {
    if (id.startsWith(prefix.toUpperCase())) return 'climatizacao';
  }

  // Elevadores
  if (ELEVADORES_IDENTIFIERS_SET.has(id)) {
    return 'elevadores';
  }
  for (const prefix of DEVICE_CLASSIFICATION_CONFIG.elevadores.identifierPrefixes) {
    if (id.startsWith(prefix.toUpperCase())) return 'elevadores';
  }

  // Escadas Rolantes
  if (ESCADAS_IDENTIFIERS_SET.has(id)) {
    return 'escadas_rolantes';
  }
  for (const prefix of DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.identifierPrefixes) {
    if (id.startsWith(prefix.toUpperCase())) return 'escadas_rolantes';
  }

  // Outros: qualquer outro identifier não reconhecido
  return 'outros';
}

/**
 * RFC-0097/RFC-0106: Classify device using deviceType as primary method
 * @param {Object} item - Device item with deviceType, deviceProfile, identifier, and label
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDevice(item) {
  // Safe guard - ensure item exists
  if (!item) {
    LogHelper.warn('[RFC-0106] classifyDevice called with null/undefined item');
    return 'outros';
  }

  // RFC-0097: Primary classification by deviceType (or deviceProfile when deviceType = 3F_MEDIDOR)
  const category = classifyDeviceByDeviceType(item);

  // Return if we got a specific category (not 'outros')
  if (category !== 'outros') {
    return category;
  }

  // Fallback: try identifier-based classification for special cases (e.g., ESCADASROLANTES)
  if (item.identifier) {
    const categoryByIdentifier = classifyDeviceByIdentifier(item.identifier);
    if (categoryByIdentifier && categoryByIdentifier !== 'outros') {
      return categoryByIdentifier;
    }
  }

  // Default: outros
  return 'outros';
}

/**
 * RFC-0106: Map equipment category to labelWidget for widget filtering
 * @param {string} category - Device category ('lojas', 'climatizacao', 'elevadores', 'escadas_rolantes', 'outros')
 * @returns {string} labelWidget value for filtering
 */
function categoryToLabelWidget(category) {
  const mapping = {
    lojas: 'Lojas',
    climatizacao: 'Climatização',
    elevadores: 'Elevadores',
    escadas_rolantes: 'Escadas Rolantes',
    outros: '',
  };
  return mapping[category] || '';
}

/**
 * RFC-0106: Infer labelWidget from deviceType AND deviceProfile
 * Classification based on BOTH deviceType and deviceProfile from ThingsBoard datasource
 *
 * Rules (priority order):
 * 1. LOJAS: deviceProfile = '3F_MEDIDOR' (uses isStoreDevice)
 * 2. ENTRADA: deviceType OR deviceProfile contains ENTRADA/TRAFO/SUBESTACAO
 * 3. For other categories, check deviceProfile first, then deviceType:
 *    - CHILLER, FANCOIL, HVAC, AR_CONDICIONADO → 'Climatização'
 *    - ELEVADOR → 'Elevadores'
 *    - ESCADA_ROLANTE → 'Escadas Rolantes'
 *    - BOMBA, MOTOR, etc → 'Área Comum'
 * 4. Default: 'Área Comum' (if no classification matches)
 *
 * @param {Object} row - Item with deviceType, deviceProfile, identifier, name
 * @returns {string} labelWidget for widget filtering
 */
function inferLabelWidget(row) {
  // First try groupType from API (takes precedence)
  const groupType = row.groupType || row.group_type || '';
  if (groupType) {
    return groupType;
  }

  // Get deviceType and deviceProfile from ThingsBoard datasource
  const deviceType = String(row.deviceType || '').toUpperCase();
  // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
  const deviceProfile = String(row.deviceProfile || row.deviceType || '').toUpperCase();

  // ==========================================================================
  // RULE 1: LOJAS - use centralized isStoreDevice
  // ==========================================================================
  if (isStoreDevice(row)) {
    return 'Lojas';
  }

  // ==========================================================================
  // RULE 2: ENTRADA - deviceType OR deviceProfile contains ENTRADA/TRAFO/SUBESTACAO
  // ==========================================================================
  const ENTRADA_PATTERNS = ['ENTRADA', 'TRAFO', 'SUBESTACAO'];
  const isEntradaByType = ENTRADA_PATTERNS.some((p) => deviceType.includes(p));
  const isEntradaByProfile = ENTRADA_PATTERNS.some((p) => deviceProfile.includes(p));
  if (isEntradaByType || isEntradaByProfile) {
    return 'Entrada';
  }

  // ==========================================================================
  // RULE 3: Check deviceProfile FIRST for other categories, then deviceType
  // ==========================================================================

  // Climatização: CHILLER, FANCOIL, HVAC, AR_CONDICIONADO, COMPRESSOR, VENTILADOR
  const CLIMATIZACAO_PATTERNS = [
    'CHILLER',
    'FANCOIL',
    'HVAC',
    'AR_CONDICIONADO',
    'COMPRESSOR',
    'VENTILADOR',
    'CLIMATIZA',
  ];
  if (
    CLIMATIZACAO_PATTERNS.some((p) => deviceProfile.includes(p)) ||
    CLIMATIZACAO_PATTERNS.some((p) => deviceType.includes(p))
  ) {
    return 'Climatização';
  }

  // Elevadores: ELEVADOR, ELV
  const ELEVADOR_PATTERNS = ['ELEVADOR', 'ELV'];
  if (
    ELEVADOR_PATTERNS.some((p) => deviceProfile.includes(p)) ||
    ELEVADOR_PATTERNS.some((p) => deviceType.includes(p))
  ) {
    return 'Elevadores';
  }

  // Escadas Rolantes: ESCADA_ROLANTE, ESCADA
  const ESCADA_PATTERNS = ['ESCADA_ROLANTE', 'ESCADA'];
  if (
    ESCADA_PATTERNS.some((p) => deviceProfile.includes(p)) ||
    ESCADA_PATTERNS.some((p) => deviceType.includes(p))
  ) {
    return 'Escadas Rolantes';
  }

  // Área Comum: BOMBA, MOTOR, RELOGIO, HIDROMETRO, etc
  const AREA_COMUM_PATTERNS = [
    'BOMBA',
    'MOTOR',
    'RELOGIO',
    'HIDROMETRO',
    'CAIXA_DAGUA',
    'TANK',
    'ILUMINACAO',
    'LUZ',
  ];
  if (
    AREA_COMUM_PATTERNS.some((p) => deviceProfile.includes(p)) ||
    AREA_COMUM_PATTERNS.some((p) => deviceType.includes(p))
  ) {
    return 'Área Comum';
  }

  // Temperature types
  if (deviceProfile.includes('TERMOSTATO') || deviceType.includes('TERMOSTATO')) {
    return 'Temperatura';
  }

  // ==========================================================================
  // RULE 4: Default - if nothing matched, default to Área Comum
  // (deviceType = 3F_MEDIDOR but deviceProfile != 3F_MEDIDOR means it's equipment)
  // ==========================================================================
  return 'Área Comum';
}

// Expose classification utilities globally for TELEMETRY and other widgets
window.MyIOUtils = window.MyIOUtils || {};
Object.assign(window.MyIOUtils, {
  DEVICE_CLASSIFICATION_CONFIG,
  classifyDevice,
  classifyDeviceByDeviceType,
  classifyDeviceByIdentifier,
  categoryToLabelWidget,
  inferLabelWidget,
  isStoreDevice,
  isWaterStoreDevice, // RFC-0109: Water meter classification
  isWaterEntradaDevice, // RFC-0109: Water meter classification (entrada/shopping)
  classifyWaterMeterDevice, // RFC-0109: Water meter classification
  EQUIPMENT_EXCLUSION_PATTERN,
});

// ============================================================================
// End RFC-0106: Device Classification
// ============================================================================

// ============================================================================
// RFC-0093: CENTRALIZED HEADER AND MODAL CSS + FUNCTIONS (restored from 503771a)
// ============================================================================

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
 * RFC-0093: Build and inject a centralized header for device grids
 * @param {Object} config - Configuration object
 * @returns {Object} Controller object with update methods
 */
function buildHeaderDevicesGrid(config) {
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

  const containerEl = typeof container === 'string' ? document.querySelector(container) : container;
  if (!containerEl) {
    LogHelper.error('[MAIN] buildHeaderDevicesGrid: Container not found');
    return null;
  }

  const domainConfig = HEADER_DOMAIN_CONFIG[domain] || HEADER_DOMAIN_CONFIG.energy;

  const finalLabels = {
    connectivity: labels.connectivity || 'Conectividade',
    total: labels.total || domainConfig.totalLabel,
    consumption: labels.consumption || domainConfig.consumptionLabel,
    zero: labels.zero || domainConfig.zeroLabel,
  };

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

  containerEl.insertAdjacentHTML('afterbegin', headerHTML);

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

  const controller = {
    ids,
    domain,
    domainConfig,

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

      LogHelper.log(`[MAIN] Header stats updated for ${idPrefix}:`, stats);
    },

    updateFromDevices(devices, options = {}) {
      const { cache } = options;

      let online = 0;
      let totalWithStatus = 0;

      // RFC-0110 v5 FIX: ALWAYS use deviceStatus from devices array, not connectionStatus from ctxData
      // The deviceStatus was calculated using RFC-0110 logic (stale telemetry detection)
      // Using connectionStatus from ctxData would bypass this logic
      // NOTE: not_installed is now a separate category - only offline/no_info count as offline
      devices.forEach((device) => {
        const devStatus = (device.deviceStatus || '').toLowerCase();
        // Count as online if deviceStatus is NOT one of the offline states
        // not_installed is separate, so we only check offline and no_info
        const isOffline = ['offline', 'no_info'].includes(devStatus);
        const isNotInstalled = devStatus === 'not_installed';
        if (!isOffline && !isNotInstalled) {
          online++;
        }
      });
      totalWithStatus = devices.length;

      let totalConsumption = 0;
      let zeroCount = 0;

      devices.forEach((device) => {
        let consumption = 0;

        if (cache && device.ingestionId) {
          const cached = cache.get(device.ingestionId);
          if (cached) {
            consumption = Number(cached.total_value) || 0;
          }
        }

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

    getSearchInput() {
      return document.getElementById(ids.searchInput);
    },

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

    destroy() {
      const header = document.getElementById(ids.header);
      if (header) header.remove();
    },
  };

  LogHelper.log(`[MAIN] Header built for domain '${domain}' with prefix '${idPrefix}'`);

  return controller;
}

/**
 * RFC-0090: Factory function to create a filter modal with customizable filter tabs
 * RFC-0103: Three-column layout - filters (left) | checklist (center) | sort (right)
 * @param {Object} config - Modal configuration
 * @returns {Object} Modal controller with open, close, and destroy methods
 */
function createFilterModal(config) {
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

  // RFC-0103: Filter tab icons
  const filterTabIcons = {
    online: '⚡',
    normal: '⚡',
    offline: '🔴',
    notInstalled: '📦',
    standby: '🔌',
    alert: '⚠️',
    failure: '🚨',
    withConsumption: '✓',
    noConsumption: '○',
    elevators: '🏙',
    escalators: '📶',
    hvac: '❄️',
    others: '⚙️',
    commonArea: '💧',
    stores: '🏪',
    all: '📊',
  };

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
      #${containerId} .${modalClass}.hidden { display: none; }
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
          max-width: 1200px;
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
      /* RFC-0103: Three-column layout */
      #${containerId} .${modalClass}-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: row;
        gap: 20px;
      }
      #${containerId} .filter-sidebar {
        width: 220px;
        min-width: 220px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        border-right: 1px solid #E6EEF5;
        padding-right: 20px;
      }
      #${containerId} .filter-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        border-right: 1px solid #E6EEF5;
        padding-right: 20px;
      }
      #${containerId} .filter-sortbar {
        width: 160px;
        min-width: 160px;
        display: flex;
        flex-direction: column;
        gap: 12px;
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
      /* RFC-0103: Vertical filter tabs in sidebar */
      #${containerId} .filter-tabs {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      #${containerId} .filter-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #${containerId} .filter-group-all {
        padding-bottom: 10px;
        border-bottom: 1px solid #E6EEF5;
        margin-bottom: 4px;
      }
      #${containerId} .filter-group-all .filter-tab {
        width: 100%;
        justify-content: center;
      }
      #${containerId} .filter-group-label {
        font-size: 11px;
        font-weight: 600;
        color: #6b7a90;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
      }
      #${containerId} .filter-group-tabs {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      /* RFC-0103: Filter tabs styled like card chips */
      #${containerId} .filter-tab {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        gap: 4px;
        border: none;
        opacity: 0.5;
      }
      #${containerId} .filter-tab:hover { opacity: 0.8; transform: translateY(-1px); }
      #${containerId} .filter-tab.active { opacity: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
      #${containerId} .filter-tab[data-filter="all"] { background: #e2e8f0; color: #475569; }
      #${containerId} .filter-tab[data-filter="online"],
      #${containerId} .filter-tab[data-filter="normal"] { background: #dbeafe; color: #1d4ed8; }
      #${containerId} .filter-tab[data-filter="offline"] { background: #e2e8f0; color: #475569; }
      #${containerId} .filter-tab[data-filter="notInstalled"] { background: #fef3c7; color: #92400e; }
      #${containerId} .filter-tab[data-filter="standby"],
      #${containerId} .filter-tab[data-filter="withConsumption"] { background: #dcfce7; color: #15803d; }
      #${containerId} .filter-tab[data-filter="alert"] { background: #fef3c7; color: #b45309; }
      #${containerId} .filter-tab[data-filter="failure"] { background: #fee2e2; color: #b91c1c; }
      #${containerId} .filter-tab[data-filter="noConsumption"] { background: #e2e8f0; color: #475569; }
      #${containerId} .filter-tab[data-filter="elevators"] { background: #e9d5ff; color: #7c3aed; }
      #${containerId} .filter-tab[data-filter="escalators"] { background: #fce7f3; color: #db2777; }
      #${containerId} .filter-tab[data-filter="hvac"] { background: #cffafe; color: #0891b2; }
      #${containerId} .filter-tab[data-filter="others"] { background: #e7e5e4; color: #57534e; }
      #${containerId} .filter-tab[data-filter="commonArea"] { background: #e0f2fe; color: #0284c7; }
      #${containerId} .filter-tab[data-filter="stores"] { background: #f3e8ff; color: #9333ea; }
      /* RFC-0110: Expand button (+) for device list tooltip */
      #${containerId} .filter-tab-expand {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: none;
        background: rgba(0, 0, 0, 0.1);
        color: inherit;
        font-size: 10px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-left: 4px;
        transition: all 0.15s ease;
        flex-shrink: 0;
        opacity: 0.7;
      }
      #${containerId} .filter-tab-expand:hover {
        background: rgba(0, 0, 0, 0.25);
        transform: scale(1.1);
        opacity: 1;
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
      #${containerId} .filter-search .clear-x:hover { background: #e5e7eb; }
      #${containerId} .filter-search .clear-x svg { position: static; width: 12px; height: 12px; fill: #6b7280; }
      #${containerId} .inline-actions { display: flex; gap: 8px; margin-top: 8px; }
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
      #${containerId} .tiny-btn:hover { background: #f0f4f8; border-color: ${primaryColor}; color: ${primaryColor}; }
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
      #${containerId} .check-item:hover { background: #f8f9fa; }
      #${containerId} .check-item input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; flex-shrink: 0; }
      #${containerId} .check-item label { flex: 1; cursor: pointer; font-size: 11px; color: #1C2743; line-height: 1.3; }
      #${containerId} .radio-grid { display: flex; flex-direction: column; gap: 4px; }
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
      #${containerId} .radio-grid label:hover { background: #f8f9fa; border-color: ${primaryColor}; }
      #${containerId} .radio-grid input[type="radio"] { width: 12px; height: 12px; cursor: pointer; flex-shrink: 0; }
      #${containerId} .radio-grid label:has(input:checked) { background: rgba(37, 99, 235, 0.08); border-color: ${primaryColor}; color: ${primaryColor}; font-weight: 600; }
      #${containerId} .btn {
        padding: 10px 16px;
        border: 1px solid #DDE7F1;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      #${containerId} .btn:hover { background: #f8f9fa; }
      #${containerId} .btn.primary { background: ${primaryColor}; color: #fff; border-color: ${primaryColor}; }
      #${containerId} .btn.primary:hover { filter: brightness(0.9); }
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
      #${containerId} .icon-btn:hover { background: #f0f0f0; }
      #${containerId} .icon-btn svg { width: 18px; height: 18px; fill: #1C2743; }
      @keyframes filterModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
      body.filter-modal-open { overflow: hidden !important; }
    `;
  }

  // RFC-0103: Generate grouped filter tabs HTML
  function generateFilterTabsHTML(counts) {
    const filterGroups = [
      { id: 'connectivity', label: 'Conectividade', filters: ['online', 'offline', 'notInstalled'] },
      { id: 'status', label: 'Status', filters: ['normal', 'standby', 'alert', 'failure'] },
      { id: 'consumption', label: 'Consumo', filters: ['withConsumption', 'noConsumption'] },
      {
        id: 'type',
        label: 'Tipo',
        filters: ['elevators', 'escalators', 'hvac', 'others', 'commonArea', 'stores'],
      },
    ];

    const allTab = filterTabs.find((t) => t.id === 'all');
    let html = '';
    if (allTab) {
      const icon = filterTabIcons['all'] || '';
      html += `
        <div class="filter-group filter-group-all">
          <button class="filter-tab active" data-filter="all">
            ${icon} ${allTab.label} (<span id="countAll">${counts['all'] || 0}</span>)
          </button>
        </div>
      `;
    }

    filterGroups.forEach((group) => {
      const groupTabs = filterTabs.filter((t) => group.filters.includes(t.id));
      if (groupTabs.length === 0) return;
      html += `
        <div class="filter-group">
          <span class="filter-group-label">${group.label}</span>
          <div class="filter-group-tabs">
            ${groupTabs
              .map((tab) => {
                const icon = filterTabIcons[tab.id] || '';
                const count = counts[tab.id] || 0;
                // RFC-0110: Add expand button (+) if count > 0
                const expandBtn =
                  count > 0
                    ? `<button class="filter-tab-expand" data-expand-filter="${tab.id}" title="Ver dispositivos">+</button>`
                    : '';
                return `
              <button class="filter-tab active" data-filter="${tab.id}">
                ${icon} ${tab.label} (<span id="count${
                  tab.id.charAt(0).toUpperCase() + tab.id.slice(1)
                }">${count}</span>)${expandBtn}
              </button>
            `;
              })
              .join('')}
          </div>
        </div>
      `;
    });
    return html;
  }

  // RFC-0103: Three-column layout
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
            <!-- LEFT COLUMN: Filters -->
            <div class="filter-sidebar">
              <div class="filter-tabs" id="filterTabsContainer"></div>
            </div>
            <!-- CENTER COLUMN: Search + Checklist -->
            <div class="filter-content">
              <div class="filter-block">
                <div class="filter-search">
                  <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                  <input type="text" id="filterDeviceSearch" placeholder="Buscar...">
                  <button class="clear-x" id="filterDeviceClear">
                    <svg width="14" height="14" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="#6b7a90"/></svg>
                  </button>
                </div>
                <div class="inline-actions" style="margin-bottom: 8px;">
                  <button class="tiny-btn" id="selectAllItems">Selecionar Todos</button>
                  <button class="tiny-btn" id="clearAllItems">Limpar Seleção</button>
                </div>
                <div class="checklist" id="deviceChecklist"></div>
              </div>
            </div>
            <!-- RIGHT COLUMN: Sort Options -->
            <div class="filter-sortbar">
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
          </div>
          <div class="${modalClass}-footer">
            <button class="btn" id="resetFilters">Fechar</button>
            <button class="btn primary" id="applyFilters">Aplicar</button>
          </div>
        </div>
      </div>
    `;
  }

  function calculateCounts(items) {
    const counts = {};
    filterTabs.forEach((tab) => {
      counts[tab.id] = items.filter(tab.filter).length;
    });
    return counts;
  }

  function populateChecklist(modal, items, selectedIds) {
    const checklist = modal.querySelector('#deviceChecklist');
    if (!checklist) return;
    checklist.innerHTML = '';

    // Use global filter if available
    const globalSelection = window.custumersSelected || [];
    const isFiltered = globalSelection.length > 0;
    let itemsProcessing = items.slice();
    if (isFiltered) {
      // RFC-FIX: Use customerId from selection (ThingsBoard UUID), not value (ingestionId)
      // Shopping interface: value = ingestionId, customerId = ThingsBoard customer UUID
      const allowedCustomerIds = globalSelection.map((c) => c.customerId).filter(Boolean);
      const allowedIngestionIds = globalSelection.map((c) => c.value).filter(Boolean);
      itemsProcessing = itemsProcessing.filter(
        (item) => {
          // Match by ThingsBoard customerId OR by ingestionId for backward compatibility
          const matchByCustomerId = item.customerId && allowedCustomerIds.includes(item.customerId);
          const matchByIngestionId = item.ingestionId && allowedIngestionIds.includes(item.ingestionId);
          return matchByCustomerId || matchByIngestionId;
        }
      );
    }

    const sortedItems = itemsProcessing.sort((a, b) =>
      (getItemLabel(a) || '').localeCompare(getItemLabel(b) || '', 'pt-BR', { sensitivity: 'base' })
    );

    if (sortedItems.length === 0) {
      checklist.innerHTML =
        '<div style="padding:10px; color:#666; font-size:12px; text-align:center;">Nenhum dispositivo encontrado.</div>';
      return;
    }

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

  function setupHandlers(modal, items, _state) {
    const closeBtn = modal.querySelector('#closeFilter');
    if (closeBtn) closeBtn.addEventListener('click', close);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

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
        onApply({ selectedIds: selectedSet.size === items.length ? null : selectedSet, sortMode });
        close();
      });
    }

    const resetBtn = modal.querySelector('#resetFilters');
    if (resetBtn) resetBtn.addEventListener('click', close);

    const selectAllBtn = modal.querySelector('#selectAllItems');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        modal
          .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
          .forEach((cb) => (cb.checked = true));
      });
    }

    const clearAllBtn = modal.querySelector('#clearAllItems');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        modal
          .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
          .forEach((cb) => (cb.checked = false));
      });
    }

    const searchInput = modal.querySelector('#filterDeviceSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = (e.target.value || '').trim().toLowerCase();
        modal.querySelectorAll('#deviceChecklist .check-item').forEach((item) => {
          const label = item.querySelector('label');
          const text = (label?.textContent || '').toLowerCase();
          item.style.display = text.includes(query) ? 'flex' : 'none';
        });
      });
    }

    const clearBtn = modal.querySelector('#filterDeviceClear');
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        modal
          .querySelectorAll('#deviceChecklist .check-item')
          .forEach((item) => (item.style.display = 'flex'));
        searchInput.focus();
      });
    }

    escHandler = (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
    };
    document.addEventListener('keydown', escHandler);
  }

  function bindFilterTabHandlers(modal, items) {
    const filterTabsEl = modal.querySelectorAll('.filter-tab');
    const filterGroups = [
      { name: 'connectivity', ids: ['online', 'offline', 'notInstalled'] },
      { name: 'status', ids: ['normal', 'standby', 'alert', 'failure'] },
      { name: 'consumption', ids: ['withConsumption', 'noConsumption'] },
      { name: 'type', ids: ['elevators', 'escalators', 'hvac', 'others', 'commonArea', 'stores'] },
    ];

    const getFilterFn = (filterId) => {
      const tabConfig = filterTabs.find((t) => t.id === filterId);
      return tabConfig ? tabConfig.filter : () => false;
    };

    const applyActiveFilters = () => {
      const itemPassesGroup = (item, groupActiveFilters) => {
        if (groupActiveFilters.length === 0) return true;
        return groupActiveFilters.some((filterId) => getFilterFn(filterId)(item));
      };

      let filteredItems = [...items];
      for (let i = 0; i < filterGroups.length; i++) {
        const group = filterGroups[i];
        const activeInGroup = Array.from(filterTabsEl)
          .filter((t) => group.ids.includes(t.getAttribute('data-filter')) && t.classList.contains('active'))
          .map((t) => t.getAttribute('data-filter'));
        if (activeInGroup.length > 0) {
          filteredItems = filteredItems.filter((item) => itemPassesGroup(item, activeInGroup));
        }
        for (let j = i + 1; j < filterGroups.length; j++) {
          const nextGroup = filterGroups[j];
          nextGroup.ids.forEach((filterId) => {
            const tab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === filterId);
            if (!tab) return;
            const filterFn = getFilterFn(filterId);
            const hasMatchingItems = filteredItems.some((item) => filterFn(item));
            if (!hasMatchingItems && tab.classList.contains('active')) tab.classList.remove('active');
          });
        }
      }

      const activeFilters = Array.from(filterTabsEl)
        .filter((t) => t.classList.contains('active') && t.getAttribute('data-filter') !== 'all')
        .map((t) => t.getAttribute('data-filter'));

      const activeByGroup = {};
      filterGroups.forEach((group) => {
        const activeInGroup = activeFilters.filter((id) => group.ids.includes(id));
        if (activeInGroup.length > 0) activeByGroup[group.name] = activeInGroup;
      });

      const checkboxes = modal.querySelectorAll(`#deviceChecklist input[type='checkbox']`);
      checkboxes.forEach((cb) => {
        const itemId = cb.getAttribute(itemIdAttr);
        const item = items.find((i) => String(getItemId(i)) === String(itemId));
        if (!item) return;
        if (activeFilters.length === 0) {
          cb.checked = true;
        } else {
          cb.checked = Object.entries(activeByGroup).every(([_groupName, groupFilterIds]) => {
            return groupFilterIds.some((filterId) => getFilterFn(filterId)(item));
          });
        }
      });
    };

    const statusToConnectivity = {
      normal: 'online',
      standby: 'online',
      alert: 'online',
      failure: 'online',
      offline: 'offline',
    };

    const getFilteredItems = () => {
      let filteredItems = [...items];
      filterGroups.forEach((group) => {
        const activeInGroup = Array.from(filterTabsEl)
          .filter((t) => group.ids.includes(t.getAttribute('data-filter')) && t.classList.contains('active'))
          .map((t) => t.getAttribute('data-filter'));
        if (activeInGroup.length > 0) {
          filteredItems = filteredItems.filter((item) =>
            activeInGroup.some((filterId) => getFilterFn(filterId)(item))
          );
        }
      });
      return filteredItems;
    };

    const updateFilterCounts = (filteredItems) => {
      filterTabs.forEach((tabConfig) => {
        if (tabConfig.id === 'all') {
          const countEl = modal.querySelector('#countAll');
          if (countEl) countEl.textContent = filteredItems.length;
        } else {
          const count = filteredItems.filter(tabConfig.filter).length;
          const countEl = modal.querySelector(
            `#count${tabConfig.id.charAt(0).toUpperCase() + tabConfig.id.slice(1)}`
          );
          if (countEl) countEl.textContent = count;
        }
      });
    };

    const syncTodosButton = () => {
      const allTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === 'all');
      const otherTabs = Array.from(filterTabsEl).filter((t) => t.getAttribute('data-filter') !== 'all');
      const allOthersActive = otherTabs.every((t) => t.classList.contains('active'));
      if (allTab) allTab.classList.toggle('active', allOthersActive);
    };

    filterTabsEl.forEach((tab) => {
      tab.addEventListener('click', () => {
        const filterType = tab.getAttribute('data-filter');
        const otherTabs = Array.from(filterTabsEl).filter((t) => t.getAttribute('data-filter') !== 'all');
        const allTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === 'all');

        if (filterType === 'all') {
          const allOthersActive = otherTabs.every((t) => t.classList.contains('active'));
          if (allOthersActive) {
            otherTabs.forEach((t) => t.classList.remove('active'));
            if (allTab) allTab.classList.remove('active');
            modal
              .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
              .forEach((cb) => (cb.checked = false));
          } else {
            otherTabs.forEach((t) => t.classList.add('active'));
            if (allTab) allTab.classList.add('active');
            modal
              .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
              .forEach((cb) => (cb.checked = true));
          }
          return;
        }

        tab.classList.toggle('active');
        const isNowActive = tab.classList.contains('active');

        if (isNowActive) {
          const impliedConnectivity = statusToConnectivity[filterType];
          if (impliedConnectivity) {
            const connectivityTab = Array.from(filterTabsEl).find(
              (t) => t.getAttribute('data-filter') === impliedConnectivity
            );
            if (connectivityTab && !connectivityTab.classList.contains('active'))
              connectivityTab.classList.add('active');
          }
          const filteredItems = getFilteredItems();
          const typeIds = ['elevators', 'escalators', 'hvac', 'others', 'commonArea', 'stores'];
          typeIds.forEach((typeId) => {
            const typeTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === typeId);
            if (!typeTab) return;
            const typeFilterFn = getFilterFn(typeId);
            const hasItems = filteredItems.some((item) => typeFilterFn(item));
            if (hasItems && !typeTab.classList.contains('active')) typeTab.classList.add('active');
          });
          const consumptionIds = ['withConsumption', 'noConsumption'];
          consumptionIds.forEach((consId) => {
            const consTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === consId);
            if (!consTab) return;
            const consFilterFn = getFilterFn(consId);
            const hasItems = filteredItems.some((item) => consFilterFn(item));
            if (hasItems && !consTab.classList.contains('active')) consTab.classList.add('active');
          });
        }

        applyActiveFilters();
        const filteredItems = getFilteredItems();
        updateFilterCounts(filteredItems);
        syncTodosButton();
      });
    });

    // RFC-0110: Setup expand button (+) event listeners for device list tooltip
    setupExpandButtonListeners(modal, items, filterTabs, filterTabIcons, getItemLabel, getItemSubLabel);
  }

  // RFC-0110: Device list tooltip for expand buttons (+)
  // Uses InfoTooltip from library for consistent UX (draggable, PIN, maximize, delayed hide)

  function showDeviceTooltip(
    triggerEl,
    filterId,
    devices,
    filterTabs,
    filterTabIcons,
    getItemLabel,
    getItemSubLabel
  ) {
    // Get InfoTooltip from library (try multiple paths)
    const InfoTooltip = window.MyIOLibrary?.InfoTooltip || window.MyIO?.InfoTooltip || window.InfoTooltip;

    if (!InfoTooltip) {
      LogHelper.warn('[MAIN] InfoTooltip not available');
      return;
    }

    // Get icon and label for the filter
    const filterTabConfig = filterTabs.find((t) => t.id === filterId);
    const label = filterTabConfig?.label || filterId;
    const icon = filterTabIcons[filterId] || '📋';

    // Build device list HTML with customerName using InfoTooltip styles
    let devicesHtml = '';
    if (devices.length === 0) {
      devicesHtml = `
        <div class="myio-info-tooltip__section">
          <div style="text-align: center; padding: 16px 0; color: #94a3b8; font-style: italic;">
            Nenhum dispositivo
          </div>
        </div>
      `;
    } else {
      // Get status dot color based on filter
      const dotColors = {
        online: '#22c55e',
        offline: '#6b7280',
        notInstalled: '#92400e',
        normal: '#3b82f6',
        standby: '#22c55e',
        alert: '#f59e0b',
        failure: '#ef4444',
        elevators: '#7c3aed',
        escalators: '#db2777',
        hvac: '#0891b2',
        others: '#57534e',
        commonArea: '#0284c7',
        stores: '#9333ea',
      };
      const dotColor = dotColors[filterId] || '#94a3b8';

      const deviceItems = devices
        .slice(0, 50)
        .map((device) => {
          const deviceLabel = getItemLabel(device) || 'Sem nome';
          const customerName = getItemSubLabel ? getItemSubLabel(device) : '';
          const displayLabel = customerName ? `${deviceLabel} (${customerName})` : deviceLabel;
          return `
          <div class="myio-info-tooltip__row" style="padding: 6px 0; gap: 8px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0;"></span>
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px;" title="${displayLabel}">${displayLabel}</span>
          </div>
        `;
        })
        .join('');

      const moreText =
        devices.length > 50
          ? `<div style="font-style: italic; color: #94a3b8; font-size: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0; margin-top: 8px;">... e mais ${
              devices.length - 50
            } dispositivos</div>`
          : '';

      devicesHtml = `
        <div class="myio-info-tooltip__section">
          <div class="myio-info-tooltip__section-title">
            Dispositivos (${devices.length})
          </div>
          <div style="max-height: 280px; overflow-y: auto;">
            ${deviceItems}
            ${moreText}
          </div>
        </div>
      `;
    }

    // Show using InfoTooltip
    InfoTooltip.show(triggerEl, {
      icon: icon,
      title: `${label} (${devices.length})`,
      content: devicesHtml,
    });
  }

  function hideDeviceTooltip() {
    const InfoTooltip = window.MyIOLibrary?.InfoTooltip;
    if (InfoTooltip) {
      InfoTooltip.startDelayedHide();
    }
  }

  function setupExpandButtonListeners(
    modal,
    items,
    filterTabs,
    filterTabIcons,
    getItemLabel,
    getItemSubLabel
  ) {
    const expandBtns = modal.querySelectorAll('.filter-tab-expand');

    expandBtns.forEach((btn) => {
      const filterId = btn.getAttribute('data-expand-filter');
      if (!filterId) return;

      // Get the filter function for this filter
      const filterTabConfig = filterTabs.find((t) => t.id === filterId);
      const filterFn = filterTabConfig?.filter || (() => false);

      btn.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        // Filter devices matching this filter
        const matchingDevices = items.filter(filterFn);
        showDeviceTooltip(
          btn,
          filterId,
          matchingDevices,
          filterTabs,
          filterTabIcons,
          getItemLabel,
          getItemSubLabel
        );
      });

      btn.addEventListener('mouseleave', (e) => {
        e.stopPropagation();
        hideDeviceTooltip();
      });

      // Prevent click from toggling the filter tab
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Also show tooltip on click for better UX
        const matchingDevices = items.filter(filterFn);
        showDeviceTooltip(
          btn,
          filterId,
          matchingDevices,
          filterTabs,
          filterTabIcons,
          getItemLabel,
          getItemSubLabel
        );
      });
    });
  }

  function open(items, state = {}) {
    if (!items || items.length === 0) {
      LogHelper.warn(`[${widgetName}] No items to display in filter modal`);
      window.alert('Nenhum item encontrado. Por favor, aguarde o carregamento dos dados.');
      return;
    }
    LogHelper.log(`[${widgetName}] Opening filter modal with ${items.length} items`);

    if (!globalContainer) {
      globalContainer = document.getElementById(containerId);
      if (!globalContainer) {
        globalContainer = document.createElement('div');
        globalContainer.id = containerId;
        globalContainer.innerHTML = `<style>${generateStyles()}</style>${generateModalHTML()}`;
        document.body.appendChild(globalContainer);
        const modal = globalContainer.querySelector('#filterModal');
        if (modal) setupHandlers(modal, items, state);
        LogHelper.log(`[${widgetName}] Modal created and attached to document.body`);
      }
    }

    const modal = globalContainer.querySelector('#filterModal');
    if (!modal) return;

    const counts = calculateCounts(items);
    const tabsContainer = modal.querySelector('#filterTabsContainer');
    if (tabsContainer) {
      tabsContainer.innerHTML = generateFilterTabsHTML(counts);
      bindFilterTabHandlers(modal, items);
    }

    populateChecklist(modal, items, state.selectedIds);

    const sortRadio = modal.querySelector(`input[name="sortMode"][value="${state.sortMode || 'cons_desc'}"]`);
    if (sortRadio) sortRadio.checked = true;

    modal.classList.remove('hidden');
    document.body.classList.add('filter-modal-open');
  }

  function close() {
    if (globalContainer) {
      const modal = globalContainer.querySelector('#filterModal');
      if (modal) modal.classList.add('hidden');
    }
    document.body.classList.remove('filter-modal-open');
    if (typeof onClose === 'function') onClose();
  }

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

// Expose buildHeaderDevicesGrid and createFilterModal to MyIOUtils
Object.assign(window.MyIOUtils, {
  buildHeaderDevicesGrid,
  createFilterModal,
  HEADER_DOMAIN_CONFIG,
});

// ============================================================================
// End RFC-0093: CENTRALIZED HEADER AND MODAL
// ============================================================================

// ============================================================================
// RFC-0110: SHARED WIDGET UTILITIES
// Centralized functions for all domain widgets (STORES, WATER, TEMPERATURE, etc.)
// ============================================================================

/**
 * RFC-0110: MASTER RULES for device status calculation
 * Applies consistent status logic across all domains
 *
 * @param {Object} options
 * @param {string} options.connectionStatus - Raw connectionStatus from ThingsBoard
 * @param {number|null} options.telemetryTimestamp - Timestamp of last telemetry data
 * @param {number} options.delayMins - Threshold in minutes for stale telemetry (default: 1440 = 24h)
 * @param {string} options.domain - Domain type: 'energy', 'water', 'temperature'
 * @returns {string} Calculated deviceStatus: 'online', 'offline', 'not_installed', 'standby', etc.
 */
function calculateDeviceStatusMasterRules(options = {}) {
  const {
    connectionStatus = '',
    telemetryTimestamp = null,
    delayMins = 1440, // 24 hours default
    domain = 'energy',
  } = options;

  const normalizedStatus = (connectionStatus || '').toLowerCase().trim();

  // 1. WAITING → NOT_INSTALLED (absolute, no discussion)
  const isWaitingStatus =
    normalizedStatus === 'waiting' || ['waiting', 'connecting', 'pending'].includes(normalizedStatus);
  if (isWaitingStatus) {
    return 'not_installed';
  }

  // 2. Check telemetry staleness
  const now = Date.now();
  const hasTelemetryTs = telemetryTimestamp && telemetryTimestamp > 0;
  const telemetryAgeMs = hasTelemetryTs ? now - telemetryTimestamp : Infinity;
  const telemetryAgeMins = telemetryAgeMs / 60000;
  const isTelemetryStale = telemetryAgeMins > delayMins;
  const isTelemetryRecent = hasTelemetryTs && telemetryAgeMins <= 60; // < 60 mins = recent

  // 3. BAD → WEAK_CONNECTION or POWER_ON (based on telemetry)
  // RFC-0110 v2: Return 'power_on' instead of 'online' to match MyIOLibrary expected values
  if (normalizedStatus === 'bad') {
    return isTelemetryRecent ? 'power_on' : 'weak_connection';
  }

  // 4. OFFLINE → Check telemetry for recovery
  if (normalizedStatus === 'offline') {
    return isTelemetryRecent ? 'power_on' : 'offline';
  }

  // 5. ONLINE → Check for stale telemetry
  if (normalizedStatus === 'online') {
    if (!hasTelemetryTs || isTelemetryStale) {
      return 'offline'; // ONLINE + no/stale telemetry = actually OFFLINE
    }
    return 'power_on'; // RFC-0110 v2: Use 'power_on' to match MyIOLibrary expected values
  }

  // 6. Default fallback
  return normalizedStatus || 'offline';
}

/**
 * RFC-0110: Check if device is offline based on deviceStatus
 * @param {string} deviceStatus - Calculated device status
 * @returns {boolean}
 */
function isDeviceStatusOffline(deviceStatus) {
  const status = (deviceStatus || '').toLowerCase();
  return ['offline', 'no_info'].includes(status);
}

/**
 * RFC-0110: Check if device is not installed (waiting)
 * @param {string} deviceStatus - Calculated device status
 * @returns {boolean}
 */
function isDeviceStatusNotInstalled(deviceStatus) {
  const status = (deviceStatus || '').toLowerCase();
  return status === 'not_installed';
}

/**
 * RFC-0110: Check if device is online
 * @param {string} deviceStatus - Calculated device status
 * @returns {boolean}
 */
function isDeviceStatusOnline(deviceStatus) {
  const status = (deviceStatus || '').toLowerCase();
  return !isDeviceStatusOffline(status) && !isDeviceStatusNotInstalled(status);
}

/**
 * RFC-0110: Create standard filter tabs for any domain widget
 * @param {Object} config
 * @param {string} config.domain - 'energy', 'water', 'temperature'
 * @param {Function} config.getItemStatus - Function to get item status
 * @param {Function} config.getItemConsumption - Function to get item consumption/value
 * @param {boolean} config.includeTypeFilters - Include type filters (elevators, hvac, etc.)
 * @returns {Array} Array of filterTab configurations
 */
function createStandardFilterTabs(config = {}) {
  const {
    domain = 'energy',
    getItemStatus = (item) => (item.deviceStatus || item.status || '').toLowerCase(),
    getItemConsumption = (item) => Number(item.value) || 0,
    includeTypeFilters = false,
  } = config;

  const isOnline = (item) => isDeviceStatusOnline(getItemStatus(item));
  const isOffline = (item) => isDeviceStatusOffline(getItemStatus(item));
  const isNotInstalled = (item) => isDeviceStatusNotInstalled(getItemStatus(item));

  const baseTabs = [
    { id: 'all', label: 'Todos', filter: () => true },
    { id: 'online', label: 'Online', filter: isOnline },
    { id: 'offline', label: 'Offline', filter: isOffline },
    { id: 'notInstalled', label: 'Não Instalado', filter: isNotInstalled },
    { id: 'withConsumption', label: 'Com Consumo', filter: (item) => getItemConsumption(item) > 0 },
    { id: 'noConsumption', label: 'Sem Consumo', filter: (item) => getItemConsumption(item) === 0 },
  ];

  // Domain-specific status tabs
  if (domain === 'temperature') {
    baseTabs.push(
      { id: 'normal', label: 'Normal', filter: (item) => isOnline(item) && getItemStatus(item) === 'normal' },
      {
        id: 'alert',
        label: 'Alerta',
        filter: (item) => isOnline(item) && ['hot', 'cold', 'warning', 'alert'].includes(getItemStatus(item)),
      }
    );
  } else {
    // energy/water domains
    baseTabs.push(
      {
        id: 'normal',
        label: 'Normal',
        filter: (item) => isOnline(item) && ['power_on', 'normal', 'running'].includes(getItemStatus(item)),
      },
      {
        id: 'standby',
        label: 'Stand By',
        filter: (item) => isOnline(item) && getItemStatus(item) === 'standby',
      },
      {
        id: 'alert',
        label: 'Alerta',
        filter: (item) => isOnline(item) && ['warning', 'alert', 'maintenance'].includes(getItemStatus(item)),
      },
      {
        id: 'failure',
        label: 'Falha',
        filter: (item) => isOnline(item) && ['failure', 'power_off'].includes(getItemStatus(item)),
      }
    );
  }

  // Type filters for energy domain (equipment types)
  if (includeTypeFilters && domain === 'energy') {
    const isElevator = (item) => {
      const cat = (item.category || item.labelWidget || '').toLowerCase();
      return cat.includes('elevator') || cat.includes('elevador');
    };
    const isEscalator = (item) => {
      const cat = (item.category || item.labelWidget || '').toLowerCase();
      return cat.includes('escada') || cat.includes('escalator');
    };
    const isHVAC = (item) => {
      const cat = (item.category || item.labelWidget || '').toLowerCase();
      return cat.includes('climatiza') || cat.includes('hvac') || cat.includes('ar condicionado');
    };

    baseTabs.push(
      { id: 'elevators', label: 'Elevadores', filter: isElevator },
      { id: 'escalators', label: 'Escadas', filter: isEscalator },
      { id: 'hvac', label: 'Climatização', filter: isHVAC },
      {
        id: 'others',
        label: 'Outros',
        filter: (item) => !isElevator(item) && !isEscalator(item) && !isHVAC(item),
      }
    );
  }

  return baseTabs;
}

/**
 * RFC-0110: Calculate operation time from lastConnectTime
 * @param {string|number} lastConnectTime - Timestamp or ISO string
 * @returns {Object} { durationMs, formatted }
 */
function calculateOperationTime(lastConnectTime) {
  if (!lastConnectTime) {
    return { durationMs: 0, formatted: '-' };
  }

  const connectTs =
    typeof lastConnectTime === 'string' ? new Date(lastConnectTime).getTime() : lastConnectTime;

  if (isNaN(connectTs) || connectTs <= 0) {
    return { durationMs: 0, formatted: '-' };
  }

  const now = Date.now();
  const durationMs = now - connectTs;

  if (durationMs < 0) {
    return { durationMs: 0, formatted: '-' };
  }

  // Use formatarDuracao if available, otherwise format manually
  const formatarDuracao =
    window.MyIOUtils?.formatarDuracao ||
    ((ms) => {
      const totalMins = Math.floor(ms / 60000);
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return `${days}d ${remainingHours}h`;
      }
      if (hours > 0) {
        return `${hours}h ${mins}min`;
      }
      return `${mins}min`;
    });

  return {
    durationMs,
    formatted: formatarDuracao(durationMs),
  };
}

/**
 * RFC-0110: Calculate header stats for any domain
 * @param {Array} items - Array of device items
 * @param {Object} config
 * @param {Function} config.getItemStatus - Function to get item status
 * @param {Function} config.getItemConsumption - Function to get item consumption
 * @returns {Object} { online, offline, notInstalled, total, withConsumption, zeroConsumption, totalConsumption }
 */
function calculateHeaderStats(items, config = {}) {
  const {
    getItemStatus = (item) => (item.deviceStatus || item.status || '').toLowerCase(),
    getItemConsumption = (item) => Number(item.value) || 0,
  } = config;

  let online = 0;
  let offline = 0;
  let notInstalled = 0;
  let withConsumption = 0;
  let zeroConsumption = 0;
  let totalConsumption = 0;

  items.forEach((item) => {
    const status = getItemStatus(item);
    const consumption = getItemConsumption(item);

    if (isDeviceStatusNotInstalled(status)) {
      notInstalled++;
    } else if (isDeviceStatusOffline(status)) {
      offline++;
    } else {
      online++;
    }

    if (consumption > 0) {
      withConsumption++;
      totalConsumption += consumption;
    } else {
      zeroConsumption++;
    }
  });

  const total = items.length;
  const onlinePercentage = total > 0 ? ((online / total) * 100).toFixed(1) : '0.0';

  return {
    online,
    offline,
    notInstalled,
    total,
    withConsumption,
    zeroConsumption,
    totalConsumption,
    onlinePercentage,
    connectivityText: `${online}/${total} (${onlinePercentage}%)`,
  };
}

/**
 * RFC-0110: Clear instantaneous power/value for offline devices
 * @param {*} value - The value to check
 * @param {string} deviceStatus - The device status
 * @returns {*} The value or null if device is offline/not_installed
 */
function clearValueIfOffline(value, deviceStatus) {
  const status = (deviceStatus || '').toLowerCase();
  if (isDeviceStatusOffline(status) || isDeviceStatusNotInstalled(status)) {
    return null;
  }
  return value;
}

// Expose shared widget utilities globally
Object.assign(window.MyIOUtils, {
  // RFC-0110: Master status rules
  calculateDeviceStatusMasterRules,
  isDeviceStatusOffline,
  isDeviceStatusNotInstalled,
  isDeviceStatusOnline,

  // RFC-0110: Shared widget functions
  createStandardFilterTabs,
  calculateOperationTime,
  calculateHeaderStats,
  clearValueIfOffline,
});

// ============================================================================
// End RFC-0110: SHARED WIDGET UTILITIES
// ============================================================================

(function () {
  // Utilitários DOM
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  let rootEl;

  // Atualiza a altura útil do conteúdo e garante que os elementos estão bem posicionados
  function applySizing() {
    try {
      // Força recálculo do layout se necessário
      if (rootEl) {
        rootEl.style.display = 'grid';

        // Garante que os tb-child elementos do MENU n�o tenham overflow issues
        const menu = $('.myio-menu', rootEl);
        if (menu) {
          const menuChildren = $$('.tb-child', menu);
          menuChildren.forEach((child) => {
            child.style.overflow = 'hidden';
            child.style.width = '100%';
            child.style.height = '100%';
          });
        }

        // Especial tratamento para o conte�do principal - permite scroll nos widgets
        const content = $('.myio-content', rootEl);
        if (content) {
          // Primeiro: container direto do content deve ter overflow auto para controlar scroll
          const contentChild = $('.tb-child', content);
          if (contentChild) {
            contentChild.style.overflow = 'auto'; // Mudado de 'visible' para 'auto'
            contentChild.style.height = '100%';
            contentChild.style.width = '100%';
          }

          // Segundo: dentro dos states, os widgets individuais tamb�m precisam de scroll
          const stateContainers = $$('[data-content-state]', content);
          LogHelper.log(`[MAIN_VIEW] Found ${stateContainers.length} state containers`);
          stateContainers.forEach((stateContainer, idx) => {
            const widgetsInState = $$('.tb-child', stateContainer);
            LogHelper.log(`[MAIN_VIEW] State ${idx}: ${widgetsInState.length} widgets found`, {
              state: stateContainer.getAttribute('data-content-state'),
              display: stateContainer.style.display,
            });
            widgetsInState.forEach((widget, widgetIdx) => {
              const before = widget.style.overflow;
              widget.style.overflow = 'auto';
              widget.style.width = '100%';
              widget.style.height = '100%';
              LogHelper.log(`[MAIN_VIEW]   Widget ${widgetIdx}: overflow ${before} ? auto`);
            });
          });

          // Diagnóstico: logar dimensões do container visível
          const visible = Array.from(content.querySelectorAll('[data-content-state]')).find(
            (div) => div.style.display !== 'none'
          );
          if (visible) {
            const r1 = content.getBoundingClientRect();
            const r2 = visible.getBoundingClientRect();
            const r3 = contentChild ? contentChild.getBoundingClientRect() : null;
            LogHelper.log('[MAIN_VIEW] sizing content dims', {
              content: { w: r1.width, h: r1.height },
              visible: { w: r2.width, h: r2.height },
              child: r3 ? { w: r3.width, h: r3.height } : null,
            });
          }
        }
      }
    } catch (e) {
      LogHelper.warn('[myio-container] sizing warn:', e);
    }
  }

  // Alterna o modo "menu compacto" acrescentando/removendo classe no root
  function setMenuCompact(compact) {
    if (!rootEl) return;
    rootEl.classList.toggle('menu-compact', !!compact);

    // Força recálculo após mudança de modo
    setTimeout(() => {
      applySizing();
    }, 50);
  }

  // Exponha dois eventos globais simples (opcionais):
  // window.dispatchEvent(new CustomEvent('myio:menu-compact', { detail: { compact: true } }))
  // window.dispatchEvent(new CustomEvent('myio:menu-expand'))
  function registerGlobalEvents() {
    on(window, 'myio:menu-compact', (ev) => {
      setMenuCompact(ev?.detail?.compact ?? true);
    });
    on(window, 'myio:menu-expand', () => {
      setMenuCompact(false);
    });

    // Adiciona suporte para toggle via evento
    on(window, 'myio:menu-toggle', () => {
      const isCompact = rootEl?.classList.contains('menu-compact');
      setMenuCompact(!isCompact);
    });
  }

  // Detecta mudanças de viewport para aplicar sizing
  function setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined' && rootEl) {
      const resizeObserver = new ResizeObserver(() => {
        applySizing();
      });
      resizeObserver.observe(rootEl);
    }
  }

  // RFC-XXXX: SuperAdmin detection
  // SuperAdmin = user with @myio.com.br email EXCEPT alarme@myio.com.br or alarmes@myio.com.br
  async function detectSuperAdmin() {
    const jwt = localStorage.getItem('jwt_token');
    if (!jwt) {
      window.MyIOUtils.SuperAdmin = false;
      LogHelper.log('[MAIN_VIEW] SuperAdmin: false (no JWT token)');
      return;
    }

    try {
      const urlAuthUserThingsboard = `${THINGSBOARD_URL}/api/auth/user`;
      const response = await fetch(urlAuthUserThingsboard, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': `Bearer ${jwt}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        window.MyIOUtils.SuperAdmin = false;
        LogHelper.warn('[MAIN_VIEW] SuperAdmin: false (API error:', response.status, ')');
        return;
      }

      const user = await response.json();
      const email = (user.email || '').toLowerCase().trim();

      // Check: email ends with @myio.com.br AND is NOT alarme@ or alarmes@
      const isSuperAdmin =
        email.endsWith('@myio.com.br') && !email.startsWith('alarme@') && !email.startsWith('alarmes@');

      window.MyIOUtils.SuperAdmin = isSuperAdmin;
      LogHelper.log(`[MAIN_VIEW] SuperAdmin detection: ${email} -> ${isSuperAdmin}`);
    } catch (err) {
      LogHelper.error('[MAIN_VIEW] SuperAdmin detection failed:', err);
      window.MyIOUtils.SuperAdmin = false;
    }
  }

  // ThingsBoard lifecycle
  self.onInit = async function () {
    rootEl = $('#myio-root');

    // Populate global widget settings early to avoid undefined errors
    // These settings are available globally to all functions

    // CRITICAL: customerTB_ID MUST be set - abort if missing
    const customerTB_ID = self.ctx.settings?.customerTB_ID;
    if (!customerTB_ID) {
      LogHelper.error('[Orchestrator] ❌ CRITICAL: customerTB_ID is missing from widget settings!');
      LogHelper.error(
        '[Orchestrator] Widget cannot function without customerTB_ID. Please configure it in widget settings.'
      );
      throw new Error('customerTB_ID is required but not found in widget settings');
    }

    widgetSettings.customerTB_ID = customerTB_ID;

    // RFC-0085: Expose customerTB_ID globally for MENU and other widgets
    if (window.MyIOOrchestrator) {
      window.MyIOOrchestrator.customerTB_ID = customerTB_ID;
    }

    widgetSettings.debugMode = self.ctx.settings?.debugMode ?? false;
    widgetSettings.domainsEnabled = self.ctx.settings?.domainsEnabled ?? {
      energy: true,
      water: true,
      temperature: true,
    };
    widgetSettings.excludeDevicesAtCountSubtotalCAG =
      self.ctx.settings?.excludeDevicesAtCountSubtotalCAG ?? [];
    // RFC-0091: Read delay time for connection status from settings
    widgetSettings.delayTimeConnectionInMins = self.ctx.settings?.delayTimeConnectionInMins ?? 60;

    LogHelper.log('[Orchestrator] 📋 Widget settings captured:', {
      customerTB_ID: widgetSettings.customerTB_ID,
      debugMode: widgetSettings.debugMode,
      delayTimeConnectionInMins: widgetSettings.delayTimeConnectionInMins,
      excludeDevicesAtCountSubtotalCAG: widgetSettings.excludeDevicesAtCountSubtotalCAG,
    });

    // Initialize config from widgetSettings
    config = {
      debugMode: widgetSettings.debugMode,
      domainsEnabled: widgetSettings.domainsEnabled,
    };

    LogHelper.log('[Orchestrator] 🔧 Config initialized from settings:', config);

    // RFC-0107: Initialize contract loading now that customerTB_ID is available
    // This fetches device counts from SERVER_SCOPE and shows the contract loading modal
    initializeContractLoading();

    // RFC-0051.2: Expose orchestrator stub IMMEDIATELY
    // This prevents race conditions with TELEMETRY widgets that check for orchestrator
    // We expose a stub with isReady flag that will be set to true when fully initialized
    if (!window.MyIOOrchestrator) {
      window.MyIOOrchestrator = {
        // Status flags
        isReady: false,
        credentialsSet: false,

        // Customer ID from settings (for MENU and other widgets)
        customerTB_ID: null,

        // Data access methods (will be populated later)
        getCurrentPeriod: () => null,
        getCredentials: () => null,
        // RFC-0091: getCache - for compatibility with EQUIPMENTS (stub version)
        getCache: () => {
          const energyData = window.MyIOOrchestratorData?.energy;
          if (energyData?.items?.length > 0) {
            const cache = new Map();
            energyData.items.forEach((item) => {
              // Add by tbId for ThingsBoard entity lookup
              if (item.tbId) cache.set(item.tbId, item);
              // Also add by ingestionId for API/enrichment lookup
              if (item.ingestionId && item.ingestionId !== item.tbId) cache.set(item.ingestionId, item);
              // Fallback to id if neither exists
              if (!item.tbId && !item.ingestionId && item.id) cache.set(item.id, item);
            });
            return cache;
          }
          return new Map();
        },
        getCacheStats: () => ({ size: 0, hits: 0, misses: 0 }),

        // RFC-0102: Device classification state (stub version)
        isDevicesClassified: () => {
          // Check if energy data exists in MyIOOrchestratorData
          const energyData = window.MyIOOrchestratorData?.energy;
          return !!(energyData?.items?.length > 0);
        },

        // RFC-0102: Get equipment devices (not stores) - stub version
        getEquipmentDevices: () => {
          const energyData = window.MyIOOrchestratorData?.energy;
          if (!energyData?.items?.length) return [];
          // Filter out stores and keep only allowed equipment profiles
          return energyData.items.filter((item) => {
            const edt = getEffectiveDeviceProfile(item);
            return edt !== '3F_MEDIDOR' && isAllowedEquipmentProfile(item);
          });
        },

        // RFC-0102: Extract and emit devices metadata
        extractEnergyDevicesMetadata: () => {
          LogHelper.log(
            '[Orchestrator] extractEnergyDevicesMetadata called (stub - checking for existing data)'
          );
          const energyData = window.MyIOOrchestratorData?.energy;
          if (energyData?.items?.length > 0) {
            // Data already exists, emit classification event
            window.dispatchEvent(
              new CustomEvent('myio:devices-classified', {
                detail: { timestamp: Date.now(), count: energyData.items.length },
              })
            );
          }
        },

        // RFC-0102: Consumption aggregation functions for HEADER widget
        getTotalConsumption: () => {
          const energyData = window.MyIOOrchestratorData?.energy;
          if (!energyData?.items?.length) return 0;
          return energyData.items.reduce((sum, item) => sum + (item.value || 0), 0);
        },

        getUnfilteredTotalConsumption: () => {
          const energyData = window.MyIOOrchestratorData?.energy;
          if (!energyData?.items?.length) return 0;
          return energyData.items.reduce((sum, item) => sum + (item.value || 0), 0);
        },

        getTotalWaterConsumption: () => {
          const waterData = window.MyIOOrchestratorData?.water;
          if (!waterData?.items?.length) return 0;
          return waterData.items.reduce((sum, item) => sum + (item.value || 0), 0);
        },

        isFilterActive: () => {
          // Check if shopping filter is active
          return window.STATE?.selectedShoppingIds?.length > 0;
        },

        getEnergyCache: () => {
          const energyData = window.MyIOOrchestratorData?.energy;
          if (!energyData?.items?.length) return new Map();
          const cache = new Map();
          energyData.items.forEach((item) => {
            if (item.tbId) cache.set(item.tbId, item);
            if (item.ingestionId) cache.set(item.ingestionId, item);
          });
          return cache;
        },

        getWaterCache: () => {
          const waterClassified = window.MyIOOrchestratorData?.waterClassified;
          if (!waterClassified?.all?.items?.length) return new Map();
          const cache = new Map();
          waterClassified.all.items.forEach((item) => {
            if (item.ingestionId) cache.set(item.ingestionId, item);
          });
          return cache;
        },

        // Credential management (will be populated later)
        setCredentials: async (_customerId, _clientId, _clientSecret) => {
          LogHelper.warn('[Orchestrator] ⚠️ setCredentials called before orchestrator is ready');
        },

        // Token manager stub
        tokenManager: {
          setToken: (_key, _token) => {
            LogHelper.warn('[Orchestrator] ⚠️ tokenManager.setToken called before orchestrator is ready');
          },
        },

        // Internal state (will be populated later)
        inFlight: {},
      };

      LogHelper.log('[Orchestrator] ⚡ Exposed to window.MyIOOrchestrator EARLY (stub mode)');
    }

    registerGlobalEvents();
    setupResizeObserver();

    // RFC-XXXX: Detect SuperAdmin early (async, non-blocking)
    detectSuperAdmin();

    // Initialize MyIO Library and Authentication
    const MyIO =
      (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) ||
      (typeof window !== 'undefined' && window.MyIOLibrary) ||
      null;

    if (MyIO) {
      try {
        // RFC-0051.1: Use widgetSettings from closure
        const customerTB_ID = widgetSettings.customerTB_ID !== 'default' ? widgetSettings.customerTB_ID : '';
        const jwt = localStorage.getItem('jwt_token');

        LogHelper.log('[MAIN_VIEW] 🔍 Credentials fetch starting...');
        LogHelper.log(
          '[MAIN_VIEW] customerTB_ID:',
          customerTB_ID ? customerTB_ID : '❌ NOT FOUND IN SETTINGS'
        );
        LogHelper.log('[MAIN_VIEW] jwt token:', jwt ? '✅ FOUND' : '❌ NOT FOUND IN localStorage');

        let CLIENT_ID = '';
        let CLIENT_SECRET = '';
        let CUSTOMER_ING_ID = '';

        if (customerTB_ID && jwt) {
          try {
            LogHelper.log('[MAIN_VIEW] 📡 Fetching customer attributes from ThingsBoard...');
            // Fetch customer attributes
            const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);

            LogHelper.log('[MAIN_VIEW] 📦 Received attrs:', attrs);

            CLIENT_ID = attrs?.client_id || '';
            CLIENT_SECRET = attrs?.client_secret || '';
            CUSTOMER_ING_ID = attrs?.ingestionId || '';

            LogHelper.log('[MAIN_VIEW] 🔑 Parsed credentials:');
            LogHelper.log('[MAIN_VIEW]   CLIENT_ID:', CLIENT_ID ? '✅ ' + CLIENT_ID : '❌ EMPTY');
            LogHelper.log(
              '[MAIN_VIEW]   CLIENT_SECRET:',
              CLIENT_SECRET ? '✅ ' + CLIENT_SECRET.substring(0, 10) + '...' : '❌ EMPTY'
            );
            LogHelper.log(
              '[MAIN_VIEW]   CUSTOMER_ING_ID:',
              CUSTOMER_ING_ID ? '✅ ' + CUSTOMER_ING_ID : '❌ EMPTY'
            );
          } catch (err) {
            LogHelper.error('[MAIN_VIEW] ❌ Failed to fetch customer attributes:', err);
            LogHelper.error('[MAIN_VIEW] Error details:', {
              message: err.message,
              stack: err.stack,
              name: err.name,
            });
          }
        } else {
          LogHelper.warn('[MAIN_VIEW] ⚠️ Cannot fetch credentials - missing required data:');
          if (!customerTB_ID) LogHelper.warn('[MAIN_VIEW]   - customerTB_ID is missing from settings');
          if (!jwt) LogHelper.warn('[MAIN_VIEW]   - JWT token is missing from localStorage');
        }

        // Check if credentials are present
        if (!CLIENT_ID || !CLIENT_SECRET || !CUSTOMER_ING_ID) {
          LogHelper.warn(
            '[MAIN_VIEW] Missing credentials - CLIENT_ID, CLIENT_SECRET, or CUSTOMER_ING_ID not found'
          );
          LogHelper.warn(
            "[MAIN_VIEW] Orchestrator will be available but won't be able to fetch data without credentials"
          );

          // RFC-0054 FIX: Dispatch initial tab event even without credentials (with delay)
          // This enables HEADER controls, even though data fetch will fail
          LogHelper.log(
            '[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...'
          );
          setTimeout(() => {
            LogHelper.log(
              '[MAIN_VIEW] Dispatching initial tab event for default state: energy (no credentials)'
            );
            window.dispatchEvent(
              new CustomEvent('myio:dashboard-state', {
                detail: { tab: 'energy' },
              })
            );
          }, 100);
        } else {
          // Set credentials in orchestrator (only if present)
          LogHelper.log('[MAIN_VIEW] 🔐 Calling MyIOOrchestrator.setCredentials...');
          LogHelper.log('[MAIN_VIEW] 🔐 Arguments:', {
            customerId: CUSTOMER_ING_ID,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET.substring(0, 10) + '...',
          });

          MyIOOrchestrator.setCredentials(CUSTOMER_ING_ID, CLIENT_ID, CLIENT_SECRET);

          LogHelper.log('[MAIN_VIEW] 🔐 setCredentials completed, verifying...');
          // Verify credentials were set
          const currentCreds = MyIOOrchestrator.getCredentials?.();
          if (currentCreds) {
            LogHelper.log('[MAIN_VIEW] ✅ Credentials verified in orchestrator:', currentCreds);
          } else {
            LogHelper.warn('[MAIN_VIEW] ⚠️ Orchestrator does not have getCredentials method');
          }

          // Build auth and get token
          const myIOAuth = MyIO.buildMyioIngestionAuth({
            dataApiHost: DATA_API_HOST,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
          });

          // Get token and set it in token manager
          const ingestionToken = await myIOAuth.getToken();
          MyIOOrchestrator.tokenManager.setToken('ingestionToken', ingestionToken);

          LogHelper.log('[MAIN_VIEW] Auth initialized successfully with CLIENT_ID:', CLIENT_ID);

          // Dispatch initial tab event AFTER credentials AND with delay
          // Delay ensures HEADER has time to register its listener
          LogHelper.log(
            '[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...'
          );
          setTimeout(() => {
            LogHelper.log(
              '[MAIN_VIEW] Dispatching initial tab event for default state: energy (after credentials + delay)'
            );
            window.dispatchEvent(
              new CustomEvent('myio:dashboard-state', {
                detail: { tab: 'energy' },
              })
            );
          }, 100);
        }
      } catch (err) {
        LogHelper.error('[MAIN_VIEW] Auth initialization failed:', err);

        // RFC-0054 FIX: Dispatch initial tab event even on error (with delay)
        // This enables HEADER controls, even though data fetch will fail
        LogHelper.log(
          '[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...'
        );
        setTimeout(() => {
          LogHelper.log('[MAIN_VIEW] Dispatching initial tab event for default state: energy (after error)');
          window.dispatchEvent(
            new CustomEvent('myio:dashboard-state', {
              detail: { tab: 'energy' },
            })
          );
        }, 100);
      }
    } else {
      LogHelper.warn('[MAIN_VIEW] MyIOLibrary not available');

      // RFC-0054 FIX: Dispatch initial tab event even without MyIOLibrary (with delay)
      // This enables HEADER controls, even though data fetch will fail
      LogHelper.log(
        '[MAIN_VIEW] Will dispatch initial tab event for default state: energy after 100ms delay...'
      );
      setTimeout(() => {
        LogHelper.log('[MAIN_VIEW] Dispatching initial tab event for default state: energy (no MyIOLibrary)');
        window.dispatchEvent(
          new CustomEvent('myio:dashboard-state', {
            detail: { tab: 'energy' },
          })
        );
      }, 100);
    }

    // NOTE: Temperature limits (minTemperature, maxTemperature) are extracted in onDataUpdated
    // because onInit runs before the customer datasource data is available
  };

  self.onResize = function () {
    applySizing();
  };

  // RFC-0106: Extract temperature limits when data arrives from customer datasource
  // This must be in onDataUpdated because onInit runs before data is available
  self.onDataUpdated = function () {
    const ctxDataRows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
    for (const row of ctxDataRows) {
      // Look for customer datasource (aliasName = 'customer')
      const aliasName = (row?.datasource?.aliasName || row?.datasource?.name || '').toLowerCase();
      if (aliasName !== 'customer') {
        continue;
      }

      const keyName = (row?.dataKey?.name || '').toLowerCase();
      const rawValue = row?.data?.[0]?.[1];

      if (keyName === 'mintemperature' && rawValue !== undefined && rawValue !== null) {
        const val = Number(rawValue);
        if (!isNaN(val) && window.MyIOUtils.temperatureLimits.minTemperature !== val) {
          window.MyIOUtils.temperatureLimits.minTemperature = val;
          LogHelper.log(`[MAIN_VIEW] Exposed global minTemperature from customer: ${val}`);
        }
      }

      if (keyName === 'maxtemperature' && rawValue !== undefined && rawValue !== null) {
        const val = Number(rawValue);
        if (!isNaN(val) && window.MyIOUtils.temperatureLimits.maxTemperature !== val) {
          window.MyIOUtils.temperatureLimits.maxTemperature = val;
          LogHelper.log(`[MAIN_VIEW] Exposed global maxTemperature from customer: ${val}`);
        }
      }

      // RFC-0106: Extract mapInstantaneousPower from customer datasource
      // This is used for deviceStatus calculation with power ranges
      if (keyName === 'mapinstantaneouspower' && rawValue !== undefined && rawValue !== null) {
        try {
          const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
          if (parsed && window.MyIOUtils.mapInstantaneousPower !== parsed) {
            window.MyIOUtils.mapInstantaneousPower = parsed;
            LogHelper.log(`[MAIN_VIEW] Exposed global mapInstantaneousPower from customer`);
          }
        } catch (err) {
          LogHelper.warn(`[MAIN_VIEW] Failed to parse mapInstantaneousPower: ${err.message}`);
        }
      }
    }
  };

  self.onDestroy = function () {
    // Limpa event listeners se necessário
    if (typeof window !== 'undefined') {
      // Remove custom event listeners se foram adicionados
    }

    // Destroy orchestrator
    if (window.MyIOOrchestrator) {
      window.MyIOOrchestrator.destroy();
    }
  };
})();

// ========== ORCHESTRATOR IMPLEMENTATION ==========

/**
 * Global shared state for widget coordination
 * Prevents race conditions and ensures first widget priority
 */
if (!window.MyIOOrchestratorState) {
  window.MyIOOrchestratorState = {
    // Widget registration and priority
    widgetPriority: [],
    widgetRegistry: new Map(), // widgetId -> {domain, registeredAt}

    // Loading state per domain
    loading: {},

    // Pending listeners for late-joining widgets
    pendingListeners: {},

    // Last emission timestamp per domain (deduplication)
    lastEmission: {},

    // Lock to prevent concurrent requests
    locks: {},
  };

  LogHelper.log('[Orchestrator] 🌍 Global state initialized:', window.MyIOOrchestratorState);
}

const OrchestratorState = window.MyIOOrchestratorState;

// ============================================================================
// RFC-0106: Global STATE for pre-computed data by domain and group
// ============================================================================
/**
 * window.STATE structure:
 * {
 *   energy: {
 *     lojas: { items: [], total: 0, count: 0 },
 *     entrada: { items: [], total: 0, count: 0 },
 *     areacomum: { items: [], total: 0, count: 0 },
 *     summary: { total: 0, byGroup: {...}, percentages: {...}, periodKey: '' }
 *   },
 *   water: { ... },
 *   temperature: { ... }
 * }
 */
if (!window.STATE) {
  window.STATE = {
    energy: null,
    water: null,
    temperature: null,
    _lastUpdate: {},

    // Helper: Get items for a specific domain and group
    // Usage: window.STATE.get('energy', 'lojas') => { items: [...], total: 0, count: 0 }
    get(domain, group) {
      const domainData = this[domain];
      if (!domainData) return null;
      if (group === 'summary') return domainData.summary;
      return domainData[group] || null;
    },

    // Helper: Get items array directly
    // Usage: window.STATE.getItems('energy', 'lojas') => [...]
    getItems(domain, group) {
      const data = this.get(domain, group);
      return data?.items || [];
    },

    // Helper: Get summary for a domain
    // Usage: window.STATE.getSummary('energy') => { total, byGroup, percentages, formatted }
    getSummary(domain) {
      return this[domain]?.summary || null;
    },

    // Helper: Check if data is ready for a domain
    // Usage: window.STATE.isReady('energy') => true/false
    isReady(domain) {
      return this[domain] !== null && this._lastUpdate[domain] !== undefined;
    },
  };
  LogHelper.log('[Orchestrator] 🗄️ window.STATE initialized with helpers');
}

/**
 * RFC-0107: Global contract state
 * Stores device counts from SERVER_SCOPE attributes for HEADER widget access
 *
 * This state is populated during dashboard initialization when contract
 * attributes are fetched from the ThingsBoard SERVER_SCOPE API.
 *
 * The HEADER widget listens for 'myio:contract:loaded' event to display
 * the contract status icon with tooltip.
 */
if (!window.CONTRACT_STATE) {
  window.CONTRACT_STATE = {
    isLoaded: false,
    isValid: false,
    timestamp: null,
    energy: {
      total: 0,
      entries: 0, // qtDevices3f-Entries
      commonArea: 0, // qtDevices3f-CommonArea
      stores: 0, // qtDevices3f-Stores
    },
    water: {
      total: 0,
      entries: 0, // qtDevicesHidr-Entries
      commonArea: 0, // qtDevicesHidr-CommonArea
      stores: 0, // qtDevicesHidr-Stores
    },
    temperature: {
      total: 0,
      internal: 0, // qtDevicesTemp-Internal (climate-controlled)
      stores: 0, // qtDevicesTemp-Stores (non-climate-controlled)
    },
  };
  LogHelper.log('[RFC-0107] 📋 window.CONTRACT_STATE initialized');
}

/**
 * RFC-0107: Device count attribute keys from SERVER_SCOPE
 * These attributes are set by the backend during customer provisioning
 */
const DEVICE_COUNT_KEYS = {
  energy: {
    total: 'qtDevices3f',
    entries: 'qtDevices3f-Entries',
    commonArea: 'qtDevices3f-CommonArea',
    stores: 'qtDevices3f-Stores',
  },
  water: {
    total: 'qtDevicesHidr',
    entries: 'qtDevicesHidr-Entries',
    commonArea: 'qtDevicesHidr-CommonArea',
    stores: 'qtDevicesHidr-Stores',
  },
  temperature: {
    total: 'qtDevicesTemp',
    internal: 'qtDevicesTemp-Internal',
    stores: 'qtDevicesTemp-Stores',
  },
};

/**
 * RFC-0107: Parses SERVER_SCOPE attributes into device count structure
 * @param {Array} attributes - Raw attributes from ThingsBoard API
 * @returns {Object} Parsed device counts by domain and group
 */
function parseDeviceCountAttributes(attributes) {
  const getAttrValue = (key) => {
    const attr = attributes.find((a) => a.key === key);
    if (!attr) return 0;
    const value = typeof attr.value === 'string' ? parseInt(attr.value, 10) : attr.value;
    return isNaN(value) ? 0 : value;
  };

  return {
    energy: {
      total: getAttrValue(DEVICE_COUNT_KEYS.energy.total),
      entries: getAttrValue(DEVICE_COUNT_KEYS.energy.entries),
      commonArea: getAttrValue(DEVICE_COUNT_KEYS.energy.commonArea),
      stores: getAttrValue(DEVICE_COUNT_KEYS.energy.stores),
    },
    water: {
      total: getAttrValue(DEVICE_COUNT_KEYS.water.total),
      entries: getAttrValue(DEVICE_COUNT_KEYS.water.entries),
      commonArea: getAttrValue(DEVICE_COUNT_KEYS.water.commonArea),
      stores: getAttrValue(DEVICE_COUNT_KEYS.water.stores),
    },
    temperature: {
      total: getAttrValue(DEVICE_COUNT_KEYS.temperature.total),
      internal: getAttrValue(DEVICE_COUNT_KEYS.temperature.internal),
      stores: getAttrValue(DEVICE_COUNT_KEYS.temperature.stores),
    },
  };
}

/**
 * RFC-0107: Fetches device count attributes from SERVER_SCOPE
 * Reference pattern: MYIO-SIM/v5.2.0/MAIN/controller.js - fetchInstantaneousPowerLimits()
 *
 * @param {string} entityId - The customer entity ID (customerTB_ID)
 * @param {string} entityType - Entity type (default: 'CUSTOMER')
 * @returns {Promise<Object|null>} Device counts object or null on error
 */
async function fetchDeviceCountAttributes(entityId, entityType = 'CUSTOMER') {
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    LogHelper.warn('[RFC-0107] JWT token not found');
    return null;
  }

  const url = `${THINGSBOARD_URL}/api/plugins/telemetry/${entityType}/${entityId}/values/attributes/SERVER_SCOPE`;

  try {
    LogHelper.log(`[RFC-0107] Fetching device counts from SERVER_SCOPE: ${url}`);

    const response = await fetch(url, {
      headers: {
        'X-Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        LogHelper.log(`[RFC-0107] No attributes found for ${entityType} ${entityId}`);
        return null;
      }
      LogHelper.warn(`[RFC-0107] Failed to fetch ${entityType} attributes: ${response.status}`);
      return null;
    }

    const attributes = await response.json();
    LogHelper.log('[RFC-0107] SERVER_SCOPE attributes received:', attributes.length, 'items');

    return parseDeviceCountAttributes(attributes);
  } catch (error) {
    LogHelper.error('[RFC-0107] Error fetching device counts:', error);
    return null;
  }
}

/**
 * RFC-0107: Validates SERVER_SCOPE device counts against window.STATE
 * Called after all domains have loaded to verify contract integrity
 *
 * @param {Object} serverCounts - Counts from SERVER_SCOPE attributes
 * @returns {Object} Validation result with status and discrepancies
 */
function validateDeviceCounts(serverCounts) {
  const state = window.STATE;
  const discrepancies = [];

  // Validate Energy
  if (state?.energy) {
    const stateEnergyTotal =
      (state.energy.lojas?.count || 0) +
      (state.energy.entrada?.count || 0) +
      (state.energy.areacomum?.count || 0);

    if (serverCounts.energy.total > 0 && stateEnergyTotal !== serverCounts.energy.total) {
      discrepancies.push({
        domain: 'energy',
        expected: serverCounts.energy.total,
        actual: stateEnergyTotal,
      });
    }
  }

  // Validate Water
  if (state?.water) {
    const stateWaterTotal =
      (state.water.lojas?.count || 0) +
      (state.water.entrada?.count || 0) +
      (state.water.areacomum?.count || 0);

    if (serverCounts.water.total > 0 && stateWaterTotal !== serverCounts.water.total) {
      discrepancies.push({
        domain: 'water',
        expected: serverCounts.water.total,
        actual: stateWaterTotal,
      });
    }
  }

  // Validate Temperature
  if (state?.temperature) {
    const stateTempTotal =
      (state.temperature.lojas?.count || 0) +
      (state.temperature.entrada?.count || 0) +
      (state.temperature.areacomum?.count || 0);

    if (serverCounts.temperature.total > 0 && stateTempTotal !== serverCounts.temperature.total) {
      discrepancies.push({
        domain: 'temperature',
        expected: serverCounts.temperature.total,
        actual: stateTempTotal,
      });
    }
  }

  const isValid = discrepancies.length === 0;
  if (!isValid) {
    LogHelper.warn('[RFC-0107] Device count validation failed:', discrepancies);
  } else {
    LogHelper.log('[RFC-0107] Device count validation passed');
  }

  return { isValid, discrepancies };
}

/**
 * RFC-0107: Stores contract state in window.CONTRACT_STATE and dispatches event
 * This function is called after device counts are fetched and validated
 *
 * @param {Object} deviceCounts - Device counts from SERVER_SCOPE
 * @param {Object} validationResult - Validation result (optional, defaults to valid)
 */
function storeContractState(deviceCounts, validationResult = { isValid: true, discrepancies: [] }) {
  window.CONTRACT_STATE = {
    isLoaded: true,
    isValid: validationResult.isValid,
    discrepancies: validationResult.discrepancies || [],
    timestamp: new Date().toISOString(),
    energy: {
      total: deviceCounts.energy.total,
      entries: deviceCounts.energy.entries,
      commonArea: deviceCounts.energy.commonArea,
      stores: deviceCounts.energy.stores,
    },
    water: {
      total: deviceCounts.water.total,
      entries: deviceCounts.water.entries,
      commonArea: deviceCounts.water.commonArea,
      stores: deviceCounts.water.stores,
    },
    temperature: {
      total: deviceCounts.temperature.total,
      internal: deviceCounts.temperature.internal,
      stores: deviceCounts.temperature.stores,
    },
  };

  // Dispatch event for HEADER widget to listen
  window.dispatchEvent(
    new CustomEvent('myio:contract:loaded', {
      detail: window.CONTRACT_STATE,
    })
  );

  LogHelper.log('[RFC-0107] 📋 CONTRACT_STATE stored and event dispatched:', window.CONTRACT_STATE);
}

/**
 * Categorize items into 3 groups: lojas, entrada, areacomum
 * Rules:
 * - LOJAS: deviceProfile = '3F_MEDIDOR' (uses isStoreDevice)
 * - ENTRADA: (deviceType = '3F_MEDIDOR' AND deviceProfile in [TRAFO, ENTRADA, RELOGIO, SUBESTACAO])
 *            OR deviceType in [TRAFO, ENTRADA, RELOGIO, SUBESTACAO]
 * - AREACOMUM: everything else
 */
function categorizeItemsByGroup(items) {
  const ENTRADA_PROFILES = new Set(['TRAFO', 'ENTRADA', 'RELOGIO', 'SUBESTACAO']);
  const ENTRADA_TYPES = new Set(['TRAFO', 'ENTRADA', 'RELOGIO', 'SUBESTACAO']);

  const lojas = [];
  const entrada = [];
  const areacomum = [];

  // Helper to safely convert to uppercase string (handles objects, arrays, numbers, etc.)
  const toStr = (val) => String(val || '').toUpperCase();

  for (const item of items) {
    const deviceType = toStr(item.deviceType);
    // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
    const deviceProfile = toStr(item.deviceProfile || item.deviceType);

    // Rule 1: LOJAS - use centralized isStoreDevice
    if (isStoreDevice(item)) {
      lojas.push(item);
      continue;
    }

    // Rule 2: ENTRADA - deviceType = 3F_MEDIDOR with entrada profile, OR deviceType is entrada type
    const isEntradaByProfile = deviceType === '3F_MEDIDOR' && ENTRADA_PROFILES.has(deviceProfile);
    const isEntradaByType = ENTRADA_TYPES.has(deviceType);
    if (isEntradaByProfile || isEntradaByType) {
      entrada.push(item);
      continue;
    }

    // Rule 3: AREACOMUM - everything else
    areacomum.push(item);
  }

  return { lojas, entrada, areacomum };
}

/**
 * RFC-0109: Water categorization into 3 groups: lojas, areacomum, entrada
 *
 * Rules:
 * - LOJAS: deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO
 * - ENTRADA:
 *   - deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_SHOPPING
 *   - OR deviceType = HIDROMETRO_SHOPPING (deviceProfile não importa)
 * - AREACOMUM:
 *   - deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_AREA_COMUM
 *   - OR deviceType = HIDROMETRO_AREA_COMUM (deviceProfile não importa)
 *   - OR any other combination (default)
 */
function categorizeItemsByGroupWater(items) {
  const entrada = [];
  const lojas = [];
  const banheiros = []; // Kept for backward compatibility but not populated
  const areacomum = [];

  // Helper to safely convert to uppercase string (handles objects, arrays, numbers, etc.)
  const toStr = (val) => String(val || '').toUpperCase();

  for (const item of items) {
    const dt = toStr(item.deviceType);
    // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
    const dp = toStr(item.deviceProfile || item.deviceType);

    // LOJAS: deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO
    if (dt === 'HIDROMETRO' && dp === 'HIDROMETRO') {
      lojas.push(item);
      continue;
    }

    // ENTRADA: deviceType = HIDROMETRO_SHOPPING OR (deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_SHOPPING)
    if (dt === 'HIDROMETRO_SHOPPING' || (dt === 'HIDROMETRO' && dp === 'HIDROMETRO_SHOPPING')) {
      entrada.push(item);
      continue;
    }

    // AREACOMUM: ONLY devices explicitly marked as area comum
    // - deviceType = HIDROMETRO_AREA_COMUM (any deviceProfile)
    // - OR deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_AREA_COMUM
    // This prevents unclassified devices from appearing in area comum
    if (
      dt === 'HIDROMETRO_AREA_COMUM' ||
      dt.includes('AREA_COMUM') ||
      (dt === 'HIDROMETRO' && (dp === 'HIDROMETRO_AREA_COMUM' || dp.includes('AREA_COMUM')))
    ) {
      areacomum.push(item);
      continue;
    }

    // Devices that don't match any category are NOT added to any group
    // This prevents HIDROMETRO without deviceProfile from appearing in areacomum
    // RFC-0140: Log warn for unclassified devices
    LogHelper.warn(
      `[categorizeItemsByGroupWater] ⚠️ UNCLASSIFIED water device: "${item.label}" (deviceType=${dt || 'NULL'}, deviceProfile=${dp || 'NULL'})`
    );
  }

  return { entrada, lojas, banheiros, areacomum };
}

/**
 * Build group data with items, total, and count
 */
function buildGroupData(items) {
  const total = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  return {
    items: items,
    total: total,
    count: items.length,
  };
}

/**
 * Build summary for TELEMETRY_INFO (pie chart, cards, tooltips)
 * RFC-0106: Pre-compute ALL tooltip data so TELEMETRY_INFO just reads it
 */
function buildSummary(lojas, entrada, areacomum, periodKey) {
  // ============ TOTALS ============
  const lojasTotal = lojas.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const entradaTotal = entrada.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const areacomumTotal = areacomum.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const grandTotal = lojasTotal + entradaTotal + areacomumTotal;

  // ============ PERCENTAGE HELPER ============
  const calcPerc = (value) => (grandTotal > 0 ? (value / grandTotal) * 100 : 0);
  const calcPercStr = (value) => calcPerc(value).toFixed(1);

  // ============ SUBCATEGORIZE AREACOMUM ============
  const CLIMATIZACAO_PATTERNS = [
    'CHILLER',
    'FANCOIL',
    'HVAC',
    'AR_CONDICIONADO',
    'COMPRESSOR',
    'VENTILADOR',
    'CLIMATIZA',
    'BOMBA_HIDRAULICA',
    'BOMBASHIDRAULICAS',
  ];
  const ELEVADOR_PATTERNS = ['ELEVADOR'];
  const ESCADA_PATTERNS = ['ESCADA', 'ROLANTE'];

  // Outros equipment patterns
  const ILUMINACAO_PATTERNS = ['ILUMINA', 'LUZ', 'LAMPADA', 'LED'];
  const BOMBA_INCENDIO_PATTERNS = ['INCENDIO', 'INCÊNDIO', 'BOMBA_INCENDIO'];
  const GERADOR_PATTERNS = ['GERADOR', 'NOBREAK', 'UPS'];

  const climatizacaoItems = [];
  const elevadoresItems = [];
  const escadasRolantesItems = [];
  const outrosItems = [];

  // Subcategories within climatizacao
  const chillerItems = [];
  const fancoilItems = [];
  const bombaHidraulicaItems = [];
  const cagItems = [];
  const hvacOutrosItems = [];

  // Subcategories within outros
  const iluminacaoItems = [];
  const bombaIncendioItems = [];
  const geradorItems = [];
  const outrosGeralItems = [];

  // Helper to safely convert to uppercase string (handles objects, arrays, numbers, etc.)
  const toStr = (val) => String(val || '').toUpperCase();

  for (const item of areacomum) {
    const lw = toStr(item.labelWidget);
    const dt = toStr(item.deviceType);
    // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
    const dp = toStr(item.deviceProfile || item.deviceType);
    const label = toStr(item.label);
    const combined = `${lw} ${dt} ${dp} ${label}`;

    if (ELEVADOR_PATTERNS.some((p) => combined.includes(p))) {
      elevadoresItems.push(item);
    } else if (ESCADA_PATTERNS.some((p) => combined.includes(p))) {
      escadasRolantesItems.push(item);
    } else if (CLIMATIZACAO_PATTERNS.some((p) => combined.includes(p))) {
      climatizacaoItems.push(item);
      // Sub-classify within climatizacao
      if (combined.includes('CHILLER')) chillerItems.push(item);
      else if (combined.includes('FANCOIL')) fancoilItems.push(item);
      else if (
        combined.includes('BOMBA_HIDRAULICA') ||
        combined.includes('BOMBASHIDRAULICAS') ||
        (combined.includes('BOMBA') && !BOMBA_INCENDIO_PATTERNS.some((p) => combined.includes(p)))
      ) {
        bombaHidraulicaItems.push(item);
      } else if (combined.includes('CAG') || combined.includes('CENTRAL')) cagItems.push(item);
      else hvacOutrosItems.push(item);
    } else {
      outrosItems.push(item);
      // Sub-classify within outros
      if (ILUMINACAO_PATTERNS.some((p) => combined.includes(p))) {
        iluminacaoItems.push(item);
      } else if (BOMBA_INCENDIO_PATTERNS.some((p) => combined.includes(p))) {
        bombaIncendioItems.push(item);
      } else if (GERADOR_PATTERNS.some((p) => combined.includes(p))) {
        geradorItems.push(item);
      } else {
        outrosGeralItems.push(item);
      }
    }
  }

  // ============ FILTER EXCLUDED DEVICES FROM CAG ============
  // RFC: excludeDevicesAtCountSubtotalCAG - remove specified entity IDs from CAG calculation
  const excludeIds = widgetSettings.excludeDevicesAtCountSubtotalCAG || [];
  const excludeIdsSet = new Set(excludeIds.map((id) => String(id).trim().toLowerCase()));

  let cagItemsFiltered = cagItems;
  let excludedFromCAG = [];

  if (excludeIdsSet.size > 0) {
    cagItemsFiltered = cagItems.filter((item) => {
      const itemId = String(item.id || '').toLowerCase();
      const isExcluded = excludeIdsSet.has(itemId);
      if (isExcluded) {
        excludedFromCAG.push(item);
      }
      return !isExcluded;
    });

    if (excludedFromCAG.length > 0) {
      const excludedTotal = excludedFromCAG.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
      LogHelper.log(
        `[buildSummary] 🚫 Excluded ${
          excludedFromCAG.length
        } devices from CAG subtotal (${excludedTotal.toFixed(2)} kWh):`,
        excludedFromCAG.map((i) => ({ id: i.id, label: i.label, value: i.value }))
      );
    }
  }

  // ============ CALCULATE SUB-TOTALS ============
  const climatizacaoTotal = climatizacaoItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const elevadoresTotal = elevadoresItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const escadasRolantesTotal = escadasRolantesItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const outrosTotal = outrosItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);

  // Climatizacao subcategories totals (CAG uses filtered list)
  const chillerTotal = chillerItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const fancoilTotal = fancoilItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const bombaHidraulicaTotal = bombaHidraulicaItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const cagTotal = cagItemsFiltered.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const hvacOutrosTotal = hvacOutrosItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);

  // Outros subcategories totals
  const iluminacaoTotal = iluminacaoItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const bombaIncendioTotal = bombaIncendioItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const geradorTotal = geradorItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
  const outrosGeralTotal = outrosGeralItems.reduce((sum, i) => sum + (Number(i.value) || 0), 0);

  // ============ DEVICE STATUS AGGREGATION ============
  const allItems = [...lojas, ...entrada, ...areacomum];
  const statusAggregation = aggregateDeviceStatus(allItems);

  // ============ BUILD TOOLTIP-READY STRUCTURE ============
  const buildCategorySummary = (items, total, name) => ({
    summary: {
      total: total,
      count: items.length,
      perc: calcPerc(total),
      percStr: calcPercStr(total) + '%',
      formatted: total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    details: {
      devices: items.map((i) => ({
        id: i.id,
        label: i.label || i.name,
        value: i.value,
        deviceStatus: i.deviceStatus,
      })),
      name: name,
    },
  });

  return {
    total: grandTotal,
    periodKey: periodKey,

    // Legacy structure (backwards compatibility)
    byGroup: {
      lojas: { total: lojasTotal, count: lojas.length },
      entrada: { total: entradaTotal, count: entrada.length },
      areacomum: { total: areacomumTotal, count: areacomum.length },
    },
    percentages: {
      lojas: calcPercStr(lojasTotal),
      entrada: calcPercStr(entradaTotal),
      areacomum: calcPercStr(areacomumTotal),
    },
    formatted: {
      lojas: lojasTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      entrada: entradaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      areacomum: areacomumTotal.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      total: grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },

    // ============ TOOLTIP-READY DATA ============
    // Each category has .summary (totals) and .details (device list)
    entrada: buildCategorySummary(entrada, entradaTotal, 'Entrada'),
    lojas: buildCategorySummary(lojas, lojasTotal, 'Lojas'),
    climatizacao: {
      ...buildCategorySummary(climatizacaoItems, climatizacaoTotal, 'Climatização'),
      subcategories: {
        chillers: buildCategorySummary(chillerItems, chillerTotal, 'Chillers'),
        fancoils: buildCategorySummary(fancoilItems, fancoilTotal, 'Fancoils'),
        bombasHidraulicas: buildCategorySummary(
          bombaHidraulicaItems,
          bombaHidraulicaTotal,
          'Bombas Hidráulicas'
        ),
        cag: buildCategorySummary(cagItemsFiltered, cagTotal, 'CAG'),
        hvacOutros: buildCategorySummary(hvacOutrosItems, hvacOutrosTotal, 'Outros HVAC'),
      },
    },
    elevadores: buildCategorySummary(elevadoresItems, elevadoresTotal, 'Elevadores'),
    escadasRolantes: buildCategorySummary(escadasRolantesItems, escadasRolantesTotal, 'Escadas Rolantes'),
    outros: {
      ...buildCategorySummary(outrosItems, outrosTotal, 'Outros'),
      subcategories: {
        iluminacao: buildCategorySummary(iluminacaoItems, iluminacaoTotal, 'Iluminação'),
        bombasIncendio: buildCategorySummary(bombaIncendioItems, bombaIncendioTotal, 'Bombas de Incêndio'),
        geradores: buildCategorySummary(geradorItems, geradorTotal, 'Geradores/Nobreaks'),
        geral: buildCategorySummary(outrosGeralItems, outrosGeralTotal, 'Outros Equipamentos'),
      },
    },
    areaComum: buildCategorySummary(areacomum, areacomumTotal, 'Área Comum'),

    // ============ RESUMO GERAL (GRAND TOTAL + STATUS) ============
    resumo: {
      summary: {
        total: grandTotal,
        count: allItems.length,
        perc: 100,
        percStr: '100%',
        formatted: grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      },
      details: {
        byCategory: {
          entrada: { count: entrada.length, total: entradaTotal },
          lojas: { count: lojas.length, total: lojasTotal },
          climatizacao: { count: climatizacaoItems.length, total: climatizacaoTotal },
          elevadores: { count: elevadoresItems.length, total: elevadoresTotal },
          escadasRolantes: { count: escadasRolantesItems.length, total: escadasRolantesTotal },
          outros: { count: outrosItems.length, total: outrosTotal },
        },
        byStatus: statusAggregation,
      },
    },

    // ============ DEVICE STATUS AGGREGATION (for tooltip) ============
    deviceStatusAggregation: statusAggregation,

    // ============ EXCLUDED DEVICES FROM CAG SUBTOTAL ============
    // RFC: excludeDevicesAtCountSubtotalCAG - list of devices excluded from CAG calculation
    excludedFromCAG: excludedFromCAG.map((item) => ({
      id: item.id,
      label: item.label || item.name || item.deviceIdentifier || item.id,
      value: item.value || 0,
    })),
  };
}

/**
 * Aggregate device status from items
 * Returns counts and device lists for each status
 */
function aggregateDeviceStatus(items) {
  const NO_CONSUMPTION_THRESHOLD = 0.01;

  const result = {
    hasData: items.length > 0,
    normal: 0,
    alert: 0,
    failure: 0,
    standby: 0,
    offline: 0,
    noConsumption: 0,
    normalDevices: [],
    alertDevices: [],
    failureDevices: [],
    standbyDevices: [],
    offlineDevices: [],
    noConsumptionDevices: [],
  };

  const statusMapping = {
    power_on: 'normal',
    warning: 'alert',
    failure: 'failure',
    standby: 'standby',
    power_off: 'offline',
    maintenance: 'offline',
    no_info: 'offline',
    not_installed: 'offline',
    offline: 'offline',
  };

  for (const item of items) {
    const deviceInfo = {
      id: item.id,
      label: item.label || item.name || item.identifier || '',
      name: item.name || '',
    };

    const deviceStatus = item.deviceStatus || 'no_info';
    const value = Number(item.value || 0);

    // Check for "no consumption" (online but zero value)
    const isOnline = !['no_info', 'offline', 'not_installed', 'maintenance', 'power_off'].includes(
      deviceStatus
    );
    if (isOnline && Math.abs(value) < NO_CONSUMPTION_THRESHOLD) {
      result.noConsumption++;
      result.noConsumptionDevices.push(deviceInfo);
      continue;
    }

    // Map to status category
    const mappedStatus = statusMapping[deviceStatus] || 'offline';
    result[mappedStatus]++;
    result[`${mappedStatus}Devices`].push(deviceInfo);
  }

  return result;
}

/**
 * RFC-0106: Build summary for water domain (TELEMETRY_INFO water)
 * Similar to buildSummary but with water-specific categories
 */
function buildSummaryWater(entrada, lojas, banheiros, areacomum, periodKey) {
  // ============ TOTALS ============
  const entradaTotal = entrada.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const lojasTotal = lojas.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const banheirosTotal = banheiros.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const areacomumTotal = areacomum.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const consumidoresTotal = lojasTotal + banheirosTotal + areacomumTotal;
  const grandTotal = entradaTotal; // Entrada is the reference

  // ============ PERCENTAGE HELPER ============
  const calcPerc = (value) => (grandTotal > 0 ? (value / grandTotal) * 100 : 0);
  const calcPercStr = (value) => calcPerc(value).toFixed(1);

  // ============ PONTOS NÃO MAPEADOS ============
  // Calculated as difference between entrada and sum of consumers
  const pontosNaoMapeadosTotal = Math.max(0, entradaTotal - consumidoresTotal);
  const hasInconsistency = consumidoresTotal > entradaTotal * 1.05; // 5% tolerance

  // ============ DEVICE STATUS AGGREGATION ============
  const allItems = [...entrada, ...lojas, ...banheiros, ...areacomum];
  const statusAggregation = aggregateDeviceStatus(allItems);

  // ============ BUILD TOOLTIP-READY STRUCTURE ============
  const buildCategorySummary = (items, total, name) => ({
    summary: {
      total: total,
      count: items.length,
      perc: calcPerc(total),
      percStr: calcPercStr(total) + '%',
      formatted:
        total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m³',
    },
    details: {
      devices: items.map((i) => ({
        id: i.id,
        label: i.label || i.name,
        value: i.value,
        deviceStatus: i.deviceStatus,
      })),
      name: name,
    },
  });

  return {
    total: grandTotal,
    periodKey: periodKey,
    unit: 'm³',

    // Legacy structure (backwards compatibility)
    byGroup: {
      entrada: { total: entradaTotal, count: entrada.length },
      lojas: { total: lojasTotal, count: lojas.length },
      banheiros: { total: banheirosTotal, count: banheiros.length },
      areacomum: { total: areacomumTotal, count: areacomum.length },
      pontosNaoMapeados: { total: pontosNaoMapeadosTotal, count: 0, isCalculated: true },
    },
    percentages: {
      entrada: '100.0',
      lojas: calcPercStr(lojasTotal),
      banheiros: calcPercStr(banheirosTotal),
      areacomum: calcPercStr(areacomumTotal),
      pontosNaoMapeados: calcPercStr(pontosNaoMapeadosTotal),
    },
    formatted: {
      entrada:
        entradaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m³',
      lojas:
        lojasTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m³',
      banheiros:
        banheirosTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        ' m³',
      areacomum:
        areacomumTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        ' m³',
      total:
        grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m³',
    },

    // ============ TOOLTIP-READY DATA ============
    entrada: buildCategorySummary(entrada, entradaTotal, 'Entrada'),
    lojas: buildCategorySummary(lojas, lojasTotal, 'Lojas'),
    banheiros: buildCategorySummary(banheiros, banheirosTotal, 'Banheiros'),
    areaComum: buildCategorySummary(areacomum, areacomumTotal, 'Área Comum'),
    pontosNaoMapeados: {
      summary: {
        total: pontosNaoMapeadosTotal,
        count: 0,
        perc: calcPerc(pontosNaoMapeadosTotal),
        percStr: calcPercStr(pontosNaoMapeadosTotal) + '%',
        formatted:
          pontosNaoMapeadosTotal.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) + ' m³',
        isCalculated: true,
        hasInconsistency: hasInconsistency,
      },
      details: {
        devices: [],
        name: 'Pontos Não Mapeados',
        description: 'Diferença entre entrada e soma dos consumidores',
      },
    },

    // ============ RESUMO GERAL (GRAND TOTAL + STATUS) ============
    resumo: {
      summary: {
        total: grandTotal,
        count: allItems.length,
        perc: 100,
        percStr: '100%',
        formatted:
          grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m³',
      },
      details: {
        byCategory: {
          entrada: { count: entrada.length, total: entradaTotal },
          lojas: { count: lojas.length, total: lojasTotal },
          banheiros: { count: banheiros.length, total: banheirosTotal },
          areacomum: { count: areacomum.length, total: areacomumTotal },
          pontosNaoMapeados: { count: 0, total: pontosNaoMapeadosTotal, isCalculated: true },
        },
        byStatus: statusAggregation,
        hasInconsistency: hasInconsistency,
      },
    },

    // ============ DEVICE STATUS AGGREGATION (for tooltip) ============
    deviceStatusAggregation: statusAggregation,
  };
}

/**
 * Populate window.STATE for a domain with categorized data
 * RFC-0106: Now supports both energy and water domains with specific categorization
 */
function populateState(domain, items, periodKey) {
  if (domain === 'water') {
    // Water domain: entrada, lojas, banheiros, areacomum
    const { entrada, lojas, banheiros, areacomum } = categorizeItemsByGroupWater(items);

    window.STATE[domain] = {
      entrada: buildGroupData(entrada),
      lojas: buildGroupData(lojas),
      banheiros: buildGroupData(banheiros),
      areacomum: buildGroupData(areacomum),
      summary: buildSummaryWater(entrada, lojas, banheiros, areacomum, periodKey),
      _raw: items,
    };

    window.STATE._lastUpdate[domain] = Date.now();

    LogHelper.log(`[Orchestrator] 🗄️ window.STATE.${domain} populated:`, {
      entrada: entrada.length,
      lojas: lojas.length,
      banheiros: banheiros.length,
      areacomum: areacomum.length,
      total: items.length,
    });
  } else {
    // Energy domain (default): lojas, entrada, areacomum
    const { lojas, entrada, areacomum } = categorizeItemsByGroup(items);

    window.STATE[domain] = {
      lojas: buildGroupData(lojas),
      entrada: buildGroupData(entrada),
      areacomum: buildGroupData(areacomum),
      summary: buildSummary(lojas, entrada, areacomum, periodKey),
      _raw: items,
    };

    window.STATE._lastUpdate[domain] = Date.now();

    LogHelper.log(`[Orchestrator] 🗄️ window.STATE.${domain} populated:`, {
      lojas: lojas.length,
      entrada: entrada.length,
      areacomum: areacomum.length,
      total: items.length,
    });
  }

  // Emit state-ready event for widgets that prefer to read from STATE
  window.dispatchEvent(
    new CustomEvent('myio:state:ready', {
      detail: { domain, periodKey },
    })
  );
}

/**
 * RFC-0106: Populate window.STATE.temperature with sensor data
 * Temperature domain is simpler - no categorization, just a flat list of sensors
 * @param {Array} items - Temperature sensor items from ctx.data
 */
function populateStateTemperature(items) {
  // Get temperature limits from MyIOUtils (set by customer attributes)
  const minTemp = window.MyIOUtils?.temperatureLimits?.minTemperature ?? 18;
  const maxTemp = window.MyIOUtils?.temperatureLimits?.maxTemperature ?? 27;

  // Categorize sensors by status
  const normal = [];
  const warning = [];
  const critical = [];
  const offline = [];

  for (const item of items) {
    const temp = Number(item.temperature || item.value || 0);
    const status = item.deviceStatus || item.connectionStatus || 'unknown';

    // Check if device is offline first
    if (status === 'offline' || status === 'no_info') {
      offline.push(item);
      continue;
    }

    // Categorize by temperature value
    if (temp < minTemp || temp > maxTemp) {
      critical.push(item);
    } else if (temp <= minTemp + 2 || temp >= maxTemp - 2) {
      // Within 2 degrees of limits = warning
      warning.push(item);
    } else {
      normal.push(item);
    }
  }

  // Calculate aggregates
  const allTemps = items.filter((i) => i.deviceStatus !== 'offline').map((i) => Number(i.temperature || 0));
  const avgTemp = allTemps.length > 0 ? allTemps.reduce((a, b) => a + b, 0) / allTemps.length : 0;
  const minValue = allTemps.length > 0 ? Math.min(...allTemps) : 0;
  const maxValue = allTemps.length > 0 ? Math.max(...allTemps) : 0;

  window.STATE.temperature = {
    items: items,
    normal: normal,
    warning: warning,
    critical: critical,
    offline: offline,
    summary: {
      total: items.length,
      normalCount: normal.length,
      warningCount: warning.length,
      criticalCount: critical.length,
      offlineCount: offline.length,
      avgTemperature: avgTemp,
      minTemperature: minValue,
      maxTemperature: maxValue,
      limits: { min: minTemp, max: maxTemp },
    },
    _raw: items,
  };

  window.STATE._lastUpdate.temperature = Date.now();

  LogHelper.log(`[Orchestrator] 🌡️ window.STATE.temperature populated:`, {
    total: items.length,
    normal: normal.length,
    warning: warning.length,
    critical: critical.length,
    offline: offline.length,
    avgTemp: avgTemp.toFixed(1),
  });

  // Emit state-ready event
  window.dispatchEvent(
    new CustomEvent('myio:state:ready', {
      detail: { domain: 'temperature', periodKey: 'realtime' },
    })
  );

  // RFC-0102: Group temperature items by shopping for tooltip display
  const shoppingTempMap = new Map();
  // Filter to online devices only - check connectionStatus (deviceStatus may be undefined)
  const onlineItems = items.filter((i) => {
    const connStatus = (i.connectionStatus || '').toLowerCase();
    const devStatus = (i.deviceStatus || '').toLowerCase();
    return connStatus !== 'offline' && devStatus !== 'offline' && devStatus !== 'no_info';
  });

  LogHelper.log(
    `[Orchestrator] 🌡️ Temperature grouping: ${items.length} total items, ${onlineItems.length} online items`
  );

  onlineItems.forEach((item) => {
    const shoppingName = item.ownerName || item.customerName || 'Desconhecido';
    if (!shoppingTempMap.has(shoppingName)) {
      shoppingTempMap.set(shoppingName, { name: shoppingName, temps: [], min: minTemp, max: maxTemp });
    }
    const temp = Number(item.temperature || 0);
    if (!isNaN(temp) && temp > 0) {
      shoppingTempMap.get(shoppingName).temps.push(temp);
    }
  });

  LogHelper.log(`[Orchestrator] 🌡️ Temperature shoppings found: ${shoppingTempMap.size}`);

  // Calculate averages and categorize shoppings
  const shoppingsInRange = [];
  const shoppingsOutOfRange = [];
  const shoppingsUnknownRange = [];

  shoppingTempMap.forEach((data) => {
    if (data.temps.length === 0) return;
    const avg = data.temps.reduce((a, b) => a + b, 0) / data.temps.length;
    const shoppingInfo = {
      name: data.name,
      avg,
      min: data.min,
      max: data.max,
      deviceCount: data.temps.length,
    };

    if (avg >= data.min && avg <= data.max) {
      shoppingsInRange.push(shoppingInfo);
    } else {
      shoppingsOutOfRange.push(shoppingInfo);
    }
  });

  // Sort by name for consistent display
  shoppingsInRange.sort((a, b) => a.name.localeCompare(b.name));
  shoppingsOutOfRange.sort((a, b) => a.name.localeCompare(b.name));

  // RFC-0102: Emit temperature-data-ready event for HEADER widget
  window.dispatchEvent(
    new CustomEvent('myio:temperature-data-ready', {
      detail: {
        globalAvg: avgTemp,
        filteredAvg: avgTemp,
        isFiltered: false,
        inRangeCount: normal.length,
        outOfRangeCount: critical.length + warning.length,
        unknownCount: offline.length,
        shoppingsInRange,
        shoppingsOutOfRange,
        shoppingsUnknownRange,
        limits: { min: minTemp, max: maxTemp },
      },
    })
  );
  LogHelper.log(
    `[Orchestrator] 🌡️ Emitted myio:temperature-data-ready for HEADER (${shoppingsInRange.length} in-range, ${shoppingsOutOfRange.length} out-of-range)`
  );
}

/**
 * Generates a unique key from domain and period for request deduplication.
 */

// ========== ORCHESTRATOR SINGLETON ==========

const MyIOOrchestrator = (() => {
  // ========== PHASE 1: BUSY OVERLAY MANAGEMENT (RFC-0044/RFC-0054) ==========
  // RFC-0137: Using LoadingSpinner component instead of custom busy overlay
  const BUSY_OVERLAY_ID = 'myio-orchestrator-busy-overlay'; // Kept for backwards compatibility

  // RFC-0137: LoadingSpinner instance (lazy initialized)
  let _loadingSpinnerInstance = null;

  /**
   * RFC-0137: Get or create LoadingSpinner instance
   * Uses MyIOLibrary.createLoadingSpinner if available, falls back to legacy overlay
   */
  function getLoadingSpinner() {
    if (_loadingSpinnerInstance) return _loadingSpinnerInstance;

    // Try to use new LoadingSpinner from myio-js-library
    const MyIOLibrary = window.MyIOLibrary;
    if (MyIOLibrary && typeof MyIOLibrary.createLoadingSpinner === 'function') {
      _loadingSpinnerInstance = MyIOLibrary.createLoadingSpinner({
        minDisplayTime: 800, // Minimum 800ms to avoid flash
        maxTimeout: 25000, // 25 seconds max (matches existing timeout)
        message: 'Carregando dados...',
        spinnerType: 'double',
        theme: 'dark',
        showTimer: false, // Set to true for debugging
        onTimeout: () => {
          LogHelper.warn('[Orchestrator] RFC-0137: LoadingSpinner max timeout reached');
          // Emit recovery event for other widgets to handle
          window.dispatchEvent(
            new CustomEvent('myio:busy-timeout-recovery', {
              detail: { domain: globalBusyState.currentDomain, duration: 25000 },
            })
          );
          showRecoveryNotification();
        },
        onComplete: () => {
          LogHelper.log('[Orchestrator] RFC-0137: LoadingSpinner hidden');
        },
      });
      LogHelper.log('[Orchestrator] RFC-0137: LoadingSpinner initialized from MyIOLibrary');
    } else {
      LogHelper.warn(
        '[Orchestrator] RFC-0137: MyIOLibrary.createLoadingSpinner not available, using legacy overlay'
      );
    }

    return _loadingSpinnerInstance;
  }

  let globalBusyState = {
    isVisible: false,
    timeoutId: null,
    startTime: null,
    currentDomain: null,
    requestCount: 0,
  };

  // RFC-0054: contador por domínio e cooldown pós-provide
  const activeRequests = new Map(); // domain -> count
  const lastProvide = new Map(); // domain -> { periodKey, at }

  function getActiveTotal() {
    let total = 0;
    activeRequests.forEach((v) => {
      total += v || 0;
    });
    return total;
  }

  /**
   * RFC-0107: Creates the contract loading modal DOM with domain breakdown
   * Shows loading progress for Energy, Water, and Temperature domains
   * with expandable details for each group (entries, common area, stores)
   */
  function ensureOrchestratorBusyDOM() {
    let el = document.getElementById(BUSY_OVERLAY_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = BUSY_OVERLAY_ID;
    el.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(150, 132, 181, 0.45);
    backdrop-filter: blur(5px);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;
  `;

    const container = document.createElement('div');
    container.id = `${BUSY_OVERLAY_ID}-container`;
    container.style.cssText = `
    background: #2d1458;
    color: #fff;
    border-radius: 18px;
    padding: 28px 32px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.1);
    min-width: 400px;
    max-width: 500px;
  `;

    // RFC-0107: Contract loading modal with domain details
    container.innerHTML = `
      <!-- Header with spinner -->
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
        <div class="contract-spinner" style="
            width:22px;height:22px;border-radius:50%;
            border:3px solid rgba(255,255,255,.25);
            border-top-color:#ffffff; animation:spin .9s linear infinite;"></div>
        <div id="${BUSY_OVERLAY_ID}-message" style="font-weight:600; font-size:16px; letter-spacing:.2px;">
          Carregando contrato...
        </div>
      </div>

      <!-- Domain sections -->
      <div id="${BUSY_OVERLAY_ID}-domains" style="display:flex; flex-direction:column; gap:10px;">

        <!-- Energy Domain -->
        <div class="domain-section" data-domain="energy" style="
            background:rgba(255,255,255,0.08); border-radius:12px; overflow:hidden;">
          <div class="domain-header" style="
              display:flex; align-items:center; justify-content:space-between;
              padding:12px 14px; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:20px;">⚡</span>
              <span style="font-weight:500;">Energia</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="domain-status" style="
                  width:18px; height:18px; border-radius:50%;
                  border:2px solid rgba(255,255,255,0.3);
                  display:flex; align-items:center; justify-content:center;
                  font-size:10px;"></span>
              <span class="domain-count" style="font-size:13px; opacity:0.7;">--</span>
              <span class="expand-arrow" style="font-size:12px; transition:transform 0.2s;">▼</span>
            </div>
          </div>
          <div class="domain-details">
            <div class="detail-row" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:12px; opacity:0.8;">Entradas</span>
              <span class="detail-entries" style="font-size:12px; font-weight:500;">--</span>
            </div>
            <div class="detail-row" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:12px; opacity:0.8;">Área Comum</span>
              <span class="detail-commonArea" style="font-size:12px; font-weight:500;">--</span>
            </div>
            <div class="detail-row" style="display:flex; justify-content:space-between; padding:8px 0;">
              <span style="font-size:12px; opacity:0.8;">Lojas</span>
              <span class="detail-stores" style="font-size:12px; font-weight:500;">--</span>
            </div>
          </div>
        </div>

        <!-- Water Domain -->
        <div class="domain-section" data-domain="water" style="
            background:rgba(255,255,255,0.08); border-radius:12px; overflow:hidden;">
          <div class="domain-header" style="
              display:flex; align-items:center; justify-content:space-between;
              padding:12px 14px; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:20px;">💧</span>
              <span style="font-weight:500;">Água</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="domain-status" style="
                  width:18px; height:18px; border-radius:50%;
                  border:2px solid rgba(255,255,255,0.3);
                  display:flex; align-items:center; justify-content:center;
                  font-size:10px;"></span>
              <span class="domain-count" style="font-size:13px; opacity:0.7;">--</span>
              <span class="expand-arrow" style="font-size:12px; transition:transform 0.2s;">▼</span>
            </div>
          </div>
          <div class="domain-details">
            <div class="detail-row" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:12px; opacity:0.8;">Entradas</span>
              <span class="detail-entries" style="font-size:12px; font-weight:500;">--</span>
            </div>
            <div class="detail-row" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:12px; opacity:0.8;">Área Comum</span>
              <span class="detail-commonArea" style="font-size:12px; font-weight:500;">--</span>
            </div>
            <div class="detail-row" style="display:flex; justify-content:space-between; padding:8px 0;">
              <span style="font-size:12px; opacity:0.8;">Lojas</span>
              <span class="detail-stores" style="font-size:12px; font-weight:500;">--</span>
            </div>
          </div>
        </div>

        <!-- Temperature Domain -->
        <div class="domain-section" data-domain="temperature" style="
            background:rgba(255,255,255,0.08); border-radius:12px; overflow:hidden;">
          <div class="domain-header" style="
              display:flex; align-items:center; justify-content:space-between;
              padding:12px 14px; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:20px;">🌡️</span>
              <span style="font-weight:500;">Temperatura</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="domain-status" style="
                  width:18px; height:18px; border-radius:50%;
                  border:2px solid rgba(255,255,255,0.3);
                  display:flex; align-items:center; justify-content:center;
                  font-size:10px;"></span>
              <span class="domain-count" style="font-size:13px; opacity:0.7;">--</span>
              <span class="expand-arrow" style="font-size:12px; transition:transform 0.2s;">▼</span>
            </div>
          </div>
          <div class="domain-details">
            <div class="detail-row" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:12px; opacity:0.8;">Climatizados</span>
              <span class="detail-internal" style="font-size:12px; font-weight:500;">--</span>
            </div>
            <div class="detail-row" style="display:flex; justify-content:space-between; padding:8px 0;">
              <span style="font-size:12px; opacity:0.8;">Lojas</span>
              <span class="detail-stores" style="font-size:12px; font-weight:500;">--</span>
            </div>
          </div>
        </div>

      </div>

      <!-- Validation status (hidden by default) -->
      <div id="${BUSY_OVERLAY_ID}-status" style="
          margin-top:16px; padding:12px 14px; border-radius:10px;
          background:rgba(255,255,255,0.05); display:none;">
      </div>

      <!-- Action buttons -->
      <div id="${BUSY_OVERLAY_ID}-actions" style="
          display:flex; gap:10px; margin-top:16px; justify-content:flex-end;">
        <button class="contract-pause-btn" style="
            padding:8px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.2);
            background:rgba(255,255,255,0.1); color:#fff; font-size:13px;
            cursor:pointer; display:flex; align-items:center; gap:6px;
            transition:all 0.2s ease;">
          <span class="pause-icon">⏸</span>
          <span class="pause-text">Pausar</span>
        </button>
        <button class="contract-close-btn" style="
            padding:8px 16px; border-radius:8px; border:none;
            background:#81c784; color:#1a1a2e; font-size:13px; font-weight:500;
            cursor:not-allowed; opacity:0.5; display:flex; align-items:center; gap:6px;
            transition:all 0.2s ease;" disabled>
          <span>✓</span>
          <span>Fechar</span>
        </button>
      </div>
    `;

    el.appendChild(container);
    document.body.appendChild(el);

    // Add CSS animation and expand styles
    if (!document.querySelector('#myio-busy-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'myio-busy-styles';
      styleEl.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      #${BUSY_OVERLAY_ID} .domain-section .domain-details {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease-out, padding 0.3s ease-out;
        padding: 0 14px;
        background: rgba(0,0,0,0.15);
      }
      #${BUSY_OVERLAY_ID} .domain-section.expanded .domain-details {
        max-height: 200px;
        padding: 8px 14px 12px 14px;
      }
      #${BUSY_OVERLAY_ID} .domain-section.expanded .expand-arrow {
        transform: rotate(180deg);
      }
      #${BUSY_OVERLAY_ID} .domain-section .domain-header {
        user-select: none;
      }
      #${BUSY_OVERLAY_ID} .domain-section.loaded .domain-status {
        background: rgba(76,175,80,0.3);
        border-color: #81c784;
        color: #81c784;
      }
      #${BUSY_OVERLAY_ID} .domain-section.loaded .domain-count {
        opacity: 1;
        color: #81c784;
      }
      #${BUSY_OVERLAY_ID} .domain-section.error .domain-status {
        background: rgba(244,67,54,0.3);
        border-color: #ef5350;
        color: #ef5350;
      }
      #${BUSY_OVERLAY_ID} .domain-section.error .domain-count {
        opacity: 1;
        color: #ef5350;
      }
      #${BUSY_OVERLAY_ID} .contract-pause-btn:hover {
        background: rgba(255,255,255,0.2);
        border-color: rgba(255,255,255,0.4);
      }
      #${BUSY_OVERLAY_ID} .contract-pause-btn.paused {
        background: rgba(239,83,80,0.2);
        border-color: #ef5350;
      }
      #${BUSY_OVERLAY_ID} .contract-close-btn:not(:disabled):hover {
        background: #66bb6a;
      }
    `;
      document.head.appendChild(styleEl);
    }

    // RFC-0107: Set up button event listeners
    setupContractModalButtons(el);

    return el;
  }

  /**
   * RFC-0107: Sets up event listeners for pause, close buttons and domain expand
   */
  function setupContractModalButtons(modalEl) {
    const pauseBtn = modalEl.querySelector('.contract-pause-btn');
    const closeBtn = modalEl.querySelector('.contract-close-btn');

    // Initialize pause state
    window._contractModalPaused = false;

    // Domain header expand/collapse handlers
    const domainHeaders = modalEl.querySelectorAll('.domain-header');
    domainHeaders.forEach((header) => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        section.classList.toggle('expanded');
        LogHelper.log(
          `[RFC-0107] Domain ${section.dataset.domain} ${
            section.classList.contains('expanded') ? 'expanded' : 'collapsed'
          }`
        );
      });
    });

    // Pause button handler
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        window._contractModalPaused = !window._contractModalPaused;
        const icon = pauseBtn.querySelector('.pause-icon');
        const text = pauseBtn.querySelector('.pause-text');

        if (window._contractModalPaused) {
          // Paused state
          icon.textContent = '▶';
          text.textContent = 'Retomar';
          pauseBtn.classList.add('paused');
          LogHelper.log('[RFC-0107] Contract modal auto-close paused');

          // Clear auto-close timeout
          if (window._contractModalAutoCloseId) {
            clearTimeout(window._contractModalAutoCloseId);
            window._contractModalAutoCloseId = null;
          }
        } else {
          // Resumed state
          icon.textContent = '⏸';
          text.textContent = 'Pausar';
          pauseBtn.classList.remove('paused');
          LogHelper.log('[RFC-0107] Contract modal auto-close resumed');

          // Restart auto-close timer (15 seconds)
          window._contractModalAutoCloseId = setTimeout(() => {
            if (!window._contractModalPaused && window.MyIOOrchestrator?.hideGlobalBusy) {
              LogHelper.log('[RFC-0107] Auto-closing contract modal');
              window.MyIOOrchestrator.hideGlobalBusy();
            }
          }, 15000);
        }
      });
    }

    // Close button handler
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (!closeBtn.disabled) {
          LogHelper.log('[RFC-0107] Contract modal closed by user');
          if (window._contractModalAutoCloseId) {
            clearTimeout(window._contractModalAutoCloseId);
            window._contractModalAutoCloseId = null;
          }
          if (window.MyIOOrchestrator?.hideGlobalBusy) {
            window.MyIOOrchestrator.hideGlobalBusy();
          }
        }
      });
    }
  }

  /**
   * RFC-0107: Updates a domain section in the contract loading modal
   * @param {string} domain - Domain name (energy, water, temperature)
   * @param {Object} counts - Device counts object
   * @param {boolean} isLoaded - Whether domain data is loaded
   * @param {boolean} hasError - Whether there's a validation error
   */
  function updateContractModalDomain(domain, counts, isLoaded = false, hasError = false) {
    const el = document.getElementById(BUSY_OVERLAY_ID);
    if (!el) return;

    const section = el.querySelector(`.domain-section[data-domain="${domain}"]`);
    if (!section) return;

    // Update total count
    const totalCount = counts?.total || 0;
    const countEl = section.querySelector('.domain-count');
    if (countEl) {
      countEl.textContent = `${totalCount} dispositivos`;
    }

    // Update status icon
    const statusEl = section.querySelector('.domain-status');
    if (statusEl && isLoaded) {
      statusEl.textContent = hasError ? '!' : '✓';
    }

    // Update detail rows based on domain
    if (domain === 'energy' || domain === 'water') {
      const entriesEl = section.querySelector('.detail-entries');
      const commonAreaEl = section.querySelector('.detail-commonArea');
      const storesEl = section.querySelector('.detail-stores');
      if (entriesEl) entriesEl.textContent = counts?.entries || 0;
      if (commonAreaEl) commonAreaEl.textContent = counts?.commonArea || 0;
      if (storesEl) storesEl.textContent = counts?.stores || 0;
    } else if (domain === 'temperature') {
      const internalEl = section.querySelector('.detail-internal');
      const storesEl = section.querySelector('.detail-stores');
      if (internalEl) internalEl.textContent = counts?.internal || 0;
      if (storesEl) storesEl.textContent = counts?.stores || 0;
    }

    // Add loaded/error class
    section.classList.remove('loaded', 'error');
    if (isLoaded) {
      section.classList.add(hasError ? 'error' : 'loaded');
    }
  }

  /**
   * RFC-0107: Updates the validation status in the contract loading modal
   * @param {boolean} isValid - Validation result
   * @param {string} message - Status message
   */
  function updateContractModalStatus(isValid, message) {
    const el = document.getElementById(BUSY_OVERLAY_ID);
    if (!el) return;

    const statusEl = el.querySelector(`#${BUSY_OVERLAY_ID}-status`);
    if (!statusEl) return;

    statusEl.style.display = 'block';

    if (isValid) {
      statusEl.style.background = 'rgba(76,175,80,0.2)';
      statusEl.innerHTML = `<span style="color:#81c784; font-size:13px;">✓ ${
        message || 'Contrato validado com sucesso'
      }</span>`;
    } else {
      statusEl.style.background = 'rgba(244,67,54,0.2)';
      statusEl.innerHTML = `<span style="color:#ef5350; font-size:13px;">⚠ ${
        message || 'Problemas detectados na validação'
      }</span>`;
    }
  }

  // RFC-0137: Configurable delay before hiding spinner after data is confirmed loaded
  const SPINNER_HIDE_DELAY_MS = 2000; // 2 seconds delay after data confirmed

  // PHASE 1: Centralized busy management with extended timeout
  // RFC-0137: Now uses LoadingSpinner component from myio-js-library
  function showGlobalBusy(domain = 'unknown', message = 'Carregando dados...', timeoutMs = 25000) {
    // RFC-0054: cooldown - não reabrir modal se acabou de prover dados
    const lp = lastProvide.get(domain);
    if (lp && Date.now() - lp.at < 30000) {
      LogHelper.log(`[Orchestrator] ⏸️ Cooldown active for ${domain}, skipping showGlobalBusy()`);
      return;
    }
    const totalBefore = getActiveTotal();
    const prev = activeRequests.get(domain) || 0;
    activeRequests.set(domain, prev + 1);
    LogHelper.log(
      `[Orchestrator] 📊 Active requests for ${domain}: ${prev + 1} (totalBefore=${totalBefore})`
    );

    // RFC-0137: Try to use new LoadingSpinner component
    const spinner = getLoadingSpinner();

    if (spinner) {
      // Use new LoadingSpinner component
      if (totalBefore === 0) {
        globalBusyState.isVisible = true;
        globalBusyState.currentDomain = domain;
        globalBusyState.startTime = Date.now();
        globalBusyState.requestCount++;

        // Show spinner with Portuguese message
        spinner.show(message || 'Carregando dados...');
        LogHelper.log(`[Orchestrator] 🔄 RFC-0137: LoadingSpinner shown for ${domain}`);
      } else {
        // Update message if already showing
        spinner.updateMessage(message || 'Carregando dados...');
        LogHelper.log(`[Orchestrator] 🔄 RFC-0137: LoadingSpinner message updated (already showing)`);
      }
    } else {
      // Fallback to legacy busy overlay
      const el = ensureOrchestratorBusyDOM();
      const messageEl = el.querySelector(`#${BUSY_OVERLAY_ID}-message`);

      if (messageEl) {
        messageEl.textContent = message || 'Carregando dados...';
      }

      if (totalBefore === 0) {
        globalBusyState.isVisible = true;
        globalBusyState.currentDomain = domain;
        globalBusyState.startTime = Date.now();
        globalBusyState.requestCount++;
        el.style.display = 'flex';
      }
    }

    // Clear existing timeout
    if (globalBusyState.timeoutId) {
      clearTimeout(globalBusyState.timeoutId);
      globalBusyState.timeoutId = null;
    }

    // RFC-0048: Start widget monitoring (will be stopped by hideGlobalBusy)
    if (window.MyIOOrchestrator?.widgetBusyMonitor) {
      window.MyIOOrchestrator.widgetBusyMonitor.startMonitoring(domain);
    }

    // PHASE 1: Extended timeout (25s instead of 10s)
    // Note: LoadingSpinner has its own maxTimeout, this is backup for legacy overlay
    if (!spinner) {
      globalBusyState.timeoutId = setTimeout(() => {
        LogHelper.warn(`[Orchestrator] ⏰ BUSY TIMEOUT (25s) for domain ${domain} - implementing recovery`);

        const el = document.getElementById(BUSY_OVERLAY_ID);
        if (globalBusyState.isVisible && el && el.style.display !== 'none') {
          try {
            window.dispatchEvent(
              new CustomEvent('myio:busy-timeout-recovery', {
                detail: { domain, duration: Date.now() - globalBusyState.startTime },
              })
            );
            hideGlobalBusy(domain);
            showRecoveryNotification();
          } catch (err) {
            LogHelper.error(`[Orchestrator] ❌ Error in timeout recovery:`, err);
            hideGlobalBusy(domain);
          }
        }
        globalBusyState.timeoutId = null;
      }, timeoutMs);
    }

    if (totalBefore === 0) {
      LogHelper.log(`[Orchestrator] 🔄 Global busy shown (domain=${domain})`);
    } else {
      LogHelper.log(`[Orchestrator] ⏳ Busy already visible (domain=${domain})`);
    }
  }

  // RFC-0137: Track pending hide timeout for delayed hide
  let _pendingHideTimeoutId = null;

  function hideGlobalBusy(domain = null, options = {}) {
    // RFC-0137: Options for controlling hide behavior
    const { immediate = false, skipDelay = false } = options;

    // RFC-0054: decremento por domínio; se domain for nulo, força limpeza
    if (domain) {
      const prev = activeRequests.get(domain) || 0;
      const next = Math.max(0, prev - 1);
      activeRequests.set(domain, next);
      LogHelper.log(
        `[Orchestrator] ✅ hideGlobalBusy(${domain}) -> ${prev}→${next}, total=${getActiveTotal()}`
      );
      if (getActiveTotal() > 0) return; // mantém overlay enquanto houver ativas
    } else {
      activeRequests.clear();
    }

    // RFC-0048: Stop widget monitoring for current domain
    if (window.MyIOOrchestrator?.widgetBusyMonitor) {
      window.MyIOOrchestrator.widgetBusyMonitor.stopAll();
    }

    // Clear any pending hide timeout
    if (_pendingHideTimeoutId) {
      clearTimeout(_pendingHideTimeoutId);
      _pendingHideTimeoutId = null;
    }

    // RFC-0137: Use LoadingSpinner if available
    const spinner = getLoadingSpinner();

    // Function to actually perform the hide
    const performHide = () => {
      if (spinner && spinner.isShowing()) {
        spinner.hide();
        LogHelper.log(`[Orchestrator] ✅ RFC-0137: LoadingSpinner hidden`);
      }

      // Also hide legacy overlay if exists
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
    };

    // RFC-0137: Apply delay before hiding (unless immediate or skipDelay)
    if (immediate || skipDelay) {
      performHide();
    } else {
      // Show "Dados carregados!" message briefly before hiding
      if (spinner && spinner.isShowing()) {
        spinner.updateMessage('Dados carregados!');
        LogHelper.log(
          `[Orchestrator] ✅ RFC-0137: Data confirmed, waiting ${SPINNER_HIDE_DELAY_MS}ms before hiding`
        );
      }

      _pendingHideTimeoutId = setTimeout(() => {
        performHide();
        _pendingHideTimeoutId = null;
      }, SPINNER_HIDE_DELAY_MS);
    }
  }

  // PHASE 4: Non-intrusive recovery notification
  function showRecoveryNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f97316;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    font-family: Inter, system-ui, sans-serif;
  `;
    notification.textContent = 'Dados recarregados automaticamente';
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);
  }

  // PHASE 2: Shared state management for widgets coordination
  let sharedWidgetState = {
    activePeriod: null,
    lastProcessedPeriodKey: null,
    busyWidgets: new Set(),
    mutexMap: new Map(), // RFC-0054 FIX: Mutex por dom�nio (n�o global)
  };

  // State
  const inFlight = new Map();
  const abortControllers = new Map();

  // Config will be initialized in onInit() after widgetSettings are populated
  let config = null;

  let visibleTab = 'energy';
  let currentPeriod = null;
  let CUSTOMER_ING_ID = '';
  let CLIENT_ID = '';
  let CLIENT_SECRET = '';

  // Credentials promise resolver for async wait
  let credentialsResolver = null;
  let credentialsPromise = new Promise((resolve) => {
    credentialsResolver = resolve;
  });

  // Metrics
  const metrics = {
    hydrationTimes: [],
    totalRequests: 0,
    errorCounts: {},

    recordHydration(domain, duration) {
      this.hydrationTimes.push({ domain, duration, timestamp: Date.now() });
      this.totalRequests++;

      if (config?.debugMode) {
        LogHelper.log(`[Orchestrator] ${domain} hydration: ${duration}ms`);
      }
    },

    recordError(domain, error) {
      this.errorCounts[domain] = (this.errorCounts[domain] || 0) + 1;
      LogHelper.error(`[Orchestrator] ${domain} error:`, error);
    },

    generateTelemetrySummary() {
      const sum = this.hydrationTimes.reduce((acc, h) => acc + h.duration, 0);
      const avg = this.hydrationTimes.length > 0 ? Math.round(sum / this.hydrationTimes.length) : 0;

      return {
        orchestrator_total_requests: this.totalRequests,
        orchestrator_avg_hydration_ms: avg,
        orchestrator_errors_total: Object.values(this.errorCounts).reduce((a, b) => a + b, 0),
      };
    },
  };

  // Request management
  function abortAllInflight() {
    for (const [key, ac] of abortControllers.entries()) {
      ac.abort();
    }
    abortControllers.clear();
    inFlight.clear();
  }

  /**
   * RFC-0109 + RFC-0110 v2: Convert connectionStatus to deviceStatus
   * Uses centralized library function for consistent status across all widgets.
   *
   * RFC-0110 v2 Dual Threshold Logic:
   * - waiting, connecting, pending → 'not_installed' (RFC-0109: ABSOLUTE PRIORITY)
   * - bad + recent telemetry (60 mins) → 'power_on' (hide weak_connection from client)
   * - bad + stale telemetry (60 mins) → 'weak_connection'
   * - offline + recent telemetry (60 mins) → 'power_on' (treat as online)
   * - offline + stale telemetry (60 mins) → 'offline'
   * - online + stale telemetry (24h) → 'offline'
   * - online + fresh telemetry (24h) → 'power_on'
   *
   * @param {string|boolean|null} connectionStatus - Raw status from ThingsBoard
   * @param {object} [options] - Optional parameters for calculation
   * @param {number|null} [options.lastConnectTime] - Timestamp of last connection
   * @param {number|null} [options.lastDisconnectTime] - Timestamp of last disconnection
   * @returns {string} deviceStatus: 'power_on', 'offline', 'weak_connection', 'not_installed'
   */
  function convertConnectionStatusToDeviceStatus(connectionStatus, options = {}) {
    const lib = window.MyIOLibrary;

    // RFC-0110 v5: Use library's calculateDeviceStatus if available
    if (lib?.calculateDeviceStatus) {
      // RFC-0110 v5: FORCE 24h (1440 min) threshold for ONLINE → OFFLINE stale detection
      // Widget setting (delayTimeConnectionInMins) may be configured for other purposes (alerts, notifications)
      // but for device status, RFC-0110 v5 mandates 24h threshold
      const delayMins = 1440; // RFC-0110 v5: Always 24h for stale telemetry detection
      const shortDelayMins = 60; // 60 mins for BAD/OFFLINE recovery

      // RFC-0110 v5: Determine domain and telemetry timestamp
      const deviceType = (options.deviceType || options.deviceProfile || '').toUpperCase();
      const isTankDevice = deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA';
      const isHidrometerDevice = deviceType.startsWith('HIDROMETRO') || deviceType.includes('WATER');
      const isTemperatureDevice = deviceType === 'TERMOSTATO' || deviceType.includes('TEMP');

      const domain =
        isTankDevice || isHidrometerDevice ? 'water' : isTemperatureDevice ? 'temperature' : 'energy';
      const telemetryTimestamp = isTankDevice
        ? (options.waterLevelTs ?? options.waterPercentageTs ?? null)
        : isHidrometerDevice
          ? (options.pulsesTs ?? null)
          : isTemperatureDevice
            ? (options.temperatureTs ?? null)
            : (options.consumptionTs ?? null);

      // DEBUG RFC-0110: Log calculation inputs for stale telemetry detection
      if (!window._debugDeviceStatusLogged) window._debugDeviceStatusLogged = 0;
      if (window._debugDeviceStatusLogged < 10) {
        window._debugDeviceStatusLogged++;
        const now = Date.now();
        //const telemetryAgeMs = telemetryTimestamp ? now - telemetryTimestamp : 'N/A';
        const telemetryAgeMins = telemetryTimestamp ? Math.round((now - telemetryTimestamp) / 60000) : 'N/A';
        LogHelper.log(
          `[Orchestrator] 🔍 RFC-0110 DEBUG deviceStatus #${window._debugDeviceStatusLogged}: connectionStatus='${connectionStatus}', domain='${domain}', telemetryTimestamp=${telemetryTimestamp}, telemetryAge=${telemetryAgeMins} mins, consumptionTs=${options.consumptionTs}, lastActivityTime=${options.lastActivityTime}, delayMins=${delayMins}`
        );
      }

      const status = lib.calculateDeviceStatus({
        connectionStatus: connectionStatus,
        domain: domain,
        telemetryTimestamp: telemetryTimestamp,
        lastActivityTime: options.lastActivityTime || null,
        delayTimeConnectionInMins: delayMins,
        shortDelayMins: shortDelayMins,
      });

      // Log for WAITING devices
      if (status === 'not_installed') {
        LogHelper.log(
          `[MYIO-SIM Orchestrator] ✅ RFC-0109 convertConnectionStatusToDeviceStatus: connectionStatus='${connectionStatus}' → 'not_installed'`
        );
      }

      // DEBUG RFC-0110: Log when online device should be offline due to stale telemetry
      if (connectionStatus === 'online' && status === 'offline') {
        if (!window._debugStaleLogged) window._debugStaleLogged = 0;
        if (window._debugStaleLogged < 5) {
          window._debugStaleLogged++;
          LogHelper.log(
            `[Orchestrator] 🔍 RFC-0110 DEBUG stale #${window._debugStaleLogged}: ONLINE with stale telemetry → OFFLINE`
          );
        }
      }

      return status;
    }

    // Fallback: Simple mapping if library not available
    const normalizedStatus = String(connectionStatus || '')
      .toLowerCase()
      .trim();

    if (['waiting', 'connecting', 'pending'].includes(normalizedStatus)) {
      LogHelper.log(
        `[MYIO-SIM Orchestrator] ✅ RFC-0109 convertConnectionStatusToDeviceStatus: connectionStatus='${connectionStatus}' → 'not_installed'`
      );
      return 'not_installed';
    }

    if (['bad', 'weak', 'unstable', 'poor', 'degraded'].includes(normalizedStatus)) {
      return 'weak_connection';
    }

    if (['offline', 'disconnected', 'false', '0'].includes(normalizedStatus) || !connectionStatus) {
      return 'offline';
    }

    return 'power_on';
  }

  /**
   * RFC-0106: Datasource alias whitelist by domain
   * Each domain has a specific datasource that contains device metadata
   * RFC-0091: Updated for MYIO-SIM context (different aliases than shopping)
   */
  const ALLOWED_ALIASES_BY_DOMAIN = {
    energy: 'equipamentos e lojas', // MYIO-SIM: Equipamentos e Lojas datasource
    water: 'allhidrodevices', // MYIO-SIM: AllHidroDevices datasource (lowercase for matching)
    temperature: 'alltemperaturedevices', // MYIO-SIM: AllTemperatureDevices datasource
  };

  /**
   * RFC-0106: Build metadata map from self.ctx.data
   * Reads ThingsBoard datasource data and groups by entityId
   * Returns map: ingestionId → { deviceType, deviceProfile, identifier, label, ... }
   * @param {string} domain - Domain to filter datasources ('energy' or 'water')
   */
  function buildMetadataMapFromCtxData(domain = 'energy') {
    const metadataByIngestion = new Map();
    const metadataByEntityId = new Map();

    const rows = Array.isArray(self?.ctx?.data) ? self.ctx.data : [];

    // DEBUG: Log datasources configured in widget
    const datasources = Array.isArray(self?.ctx?.datasources) ? self.ctx.datasources : [];
    LogHelper.log(`[Orchestrator] 📋 Widget datasources configured: ${datasources.length}`);
    if (datasources.length > 0) {
      const dsInfo = datasources.map((ds) => ({
        aliasName: ds.aliasName || ds.name || 'unknown',
        entityCount: ds.dataKeys?.length || 0,
        type: ds.type || 'unknown',
      }));
      LogHelper.log(`[Orchestrator] 📋 Datasource details:`, JSON.stringify(dsInfo));
    }

    if (rows.length === 0) {
      LogHelper.warn(
        `[Orchestrator] ⚠️ self.ctx.data is empty - no metadata available (${datasources.length} datasources configured)`
      );
      return { byIngestion: metadataByIngestion, byEntityId: metadataByEntityId };
    }

    // RFC-0106: Use whitelist approach - only include the specific datasource for this domain
    const allowedAlias = ALLOWED_ALIASES_BY_DOMAIN[domain] || ALLOWED_ALIASES_BY_DOMAIN.energy;
    LogHelper.log(`[Orchestrator] 📋 Using whitelist for domain '${domain}': only alias '${allowedAlias}'`);

    // DEBUG: Log all unique aliasNames found in ctx.data
    const allAliases = new Set();
    for (const row of rows) {
      const alias = row?.datasource?.aliasName || row?.datasource?.name || 'unknown';
      allAliases.add(alias);
    }
    LogHelper.log(`[Orchestrator] 📋 Datasource aliases found: ${Array.from(allAliases).join(', ')}`);

    // DEBUG: Log sample items from the allowed alias datasource
    const aliasRows = rows.filter((r) => {
      const alias = (r?.datasource?.aliasName || r?.datasource?.name || '').toLowerCase();
      return alias === allowedAlias;
    });
    if (aliasRows.length > 0) {
      // Get unique entityIds from this alias
      const entityIds = [
        ...new Set(aliasRows.map((r) => r?.datasource?.entityId?.id || r?.datasource?.entityId)),
      ].filter(Boolean);
      LogHelper.log(
        `[Orchestrator] 🔍 DEBUG: Found ${entityIds.length} unique entities in '${allowedAlias}' datasource`
      );

      // Sample: first + 2 random
      const sampleIds = [entityIds[0]];
      if (entityIds.length > 1) sampleIds.push(entityIds[Math.floor(entityIds.length / 3)]);
      if (entityIds.length > 2) sampleIds.push(entityIds[Math.floor((entityIds.length * 2) / 3)]);

      for (const sampleId of sampleIds) {
        const sampleRows = aliasRows.filter(
          (r) => (r?.datasource?.entityId?.id || r?.datasource?.entityId) === sampleId
        );
        const sampleData = {};
        for (const sr of sampleRows) {
          const key = sr?.dataKey?.name || 'unknown';
          sampleData[key] = sr?.data?.[0]?.[1] ?? null;
        }
        sampleData._entityId = sampleId;
        sampleData._entityName = sampleRows[0]?.datasource?.entityName || 'N/A';
        LogHelper.log(
          `[Orchestrator] 🔍 DEBUG Sample from '${allowedAlias}':`,
          JSON.stringify(sampleData, null, 2)
        );
      }
    }

    // Group by entityId first - only process rows from allowed alias
    for (const row of rows) {
      // Check aliasName - only include allowed datasource (whitelist approach)
      const aliasName = (row?.datasource?.aliasName || row?.datasource?.name || '').toLowerCase();
      if (aliasName !== allowedAlias) {
        continue;
      }

      const entityId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
      const keyName = String(row?.dataKey?.name || '').toLowerCase();
      const val = row?.data?.[0]?.[1] ?? null;
      // RFC-0110 v5: Capture timestamp for telemetry
      // NOTE: Timestamp 0 (epoch 1970) is invalid - ThingsBoard returns 0 when no data
      const rawTs = row?.data?.[0]?.[0];
      const ts = rawTs && rawTs > 0 ? rawTs : null;

      if (!entityId) continue;

      // Get or create metadata entry
      if (!metadataByEntityId.has(entityId)) {
        metadataByEntityId.set(entityId, {
          tbId: entityId,
          entityName: row?.datasource?.entityName || row?.datasource?.name || '',
          label: row?.datasource?.entityLabel || row?.datasource?.entityName || '',
        });
      }

      const meta = metadataByEntityId.get(entityId);

      // Map dataKey values - common fields
      if (keyName === 'devicetype') meta.deviceType = val;
      else if (keyName === 'deviceprofile') meta.deviceProfile = val;
      else if (keyName === 'identifier') meta.identifier = val;
      else if (keyName === 'ingestionid') meta.ingestionId = val;
      else if (keyName === 'slaveid') meta.slaveId = val;
      else if (keyName === 'centralid') meta.centralId = val;
      else if (keyName === 'centralname') meta.centralName = val;
      else if (keyName === 'ownername')
        meta.ownerName = val; // RFC-0102: customerName from ThingsBoard
      else if (keyName === 'assetname')
        meta.assetName = val; // RFC-0102: assetName fallback
      else if (keyName === 'connectionstatus') meta.connectionStatus = val;
      else if (keyName === 'lastactivitytime') meta.lastActivityTime = val;
      else if (keyName === 'lastconnecttime') meta.lastConnectTime = val;
      else if (keyName === 'lastdisconnecttime') meta.lastDisconnectTime = val;
      else if (keyName === 'log_annotations') meta.log_annotations = val;
      else if (keyName === 'label') meta.label = val;
      // Energy-specific fields (RFC-0110 v5: capture timestamp for telemetry)
      else if (keyName === 'devicemapinstaneouspower') meta.deviceMapInstaneousPower = val;
      else if (keyName === 'consumption') {
        meta.consumption = val;
        meta.consumptionTs = ts;
        // DEBUG RFC-0110: Log consumption timestamp capture
        if (!window._debugConsumptionTsLogged) window._debugConsumptionTsLogged = 0;
        if (window._debugConsumptionTsLogged < 5) {
          window._debugConsumptionTsLogged++;
          LogHelper.log(
            `[Orchestrator] 🔍 RFC-0110 DEBUG consumption #${window._debugConsumptionTsLogged}: label='${
              meta.label || meta.entityName
            }', consumption=${val}, ts=${ts}, rawTs=${rawTs}`
          );
        }
      }
      // Water-specific fields (RFC-0110 v5: capture timestamp for telemetry)
      else if (keyName === 'pulses') {
        meta.pulses = val;
        meta.pulsesTs = ts;
      } else if (keyName === 'litersperpulse') meta.litersPerPulse = val;
      else if (keyName === 'volume') meta.volume = val;
      // Tank-specific fields (TANK/CAIXA_DAGUA) (RFC-0110 v5: capture timestamp for telemetry)
      else if (keyName === 'water_level') {
        meta.waterLevel = val;
        meta.waterLevelTs = ts;
      } else if (keyName === 'water_percentage') {
        meta.waterPercentage = val;
        meta.waterPercentageTs = ts;
      }
      // Temperature-specific fields (RFC-0110 v5: capture timestamp for telemetry)
      else if (keyName === 'temperature') {
        meta.temperature = val;
        meta.temperatureTs = ts;
      }
      // RFC-FIX: Temperature offset - used to adjust displayed temperature value
      // The offset is added to the raw temperature reading to get the corrected value
      else if (
        keyName === 'offsettemperature' ||
        keyName === 'offset_temperature' ||
        keyName === 'offSetTemperature'
      ) {
        meta.offSetTemperature = Number(val) || 0;
        LogHelper.log(
          `[Orchestrator] 🌡️ Found offSetTemperature for "${meta.label || meta.entityName}": ${meta.offSetTemperature}`
        );
      }
    }

    // Build map by ingestionId
    for (const [entityId, meta] of metadataByEntityId.entries()) {
      const ingestionId = meta.ingestionId;
      if (ingestionId) {
        metadataByIngestion.set(ingestionId, meta);
      }
    }

    LogHelper.log(
      `[Orchestrator] 📋 Built metadata map: ${metadataByEntityId.size} entities, ${metadataByIngestion.size} with ingestionId`
    );

    // DEBUG RFC-0107: Log deviceTypes of all entities in metadataByEntityId
    if (metadataByEntityId.size > 0) {
      const deviceTypes = [];
      for (const [entityId, meta] of metadataByEntityId.entries()) {
        deviceTypes.push(`${meta.label || entityId.substring(0, 8)}:${meta.deviceType || 'N/A'}`);
      }
      LogHelper.log(`[Orchestrator] 📋 RFC-0107 Device types in metadata: ${deviceTypes.join(', ')}`);
    }

    // DEBUG: Log all dataKeys found in ctx.data
    const allDataKeys = new Set();
    for (const row of rows) {
      const keyName = row?.dataKey?.name;
      if (keyName) allDataKeys.add(keyName);
    }
    LogHelper.log(`[Orchestrator] 📋 DataKeys found in ctx.data:`, Array.from(allDataKeys).join(', '));

    // DEBUG: Log sample metadata with ALL fields
    if (metadataByIngestion.size > 0) {
      const firstEntry = metadataByIngestion.values().next().value;
      LogHelper.log(`[Orchestrator] 🔍 Sample metadata (ALL fields):`, JSON.stringify(firstEntry, null, 2));
    }

    return { byIngestion: metadataByIngestion, byEntityId: metadataByEntityId };
  }

  /**
   * RFC-0106: Wait for ctx.data to be populated with datasources
   * This prevents the timing issue where API is called before ThingsBoard loads datasources
   */
  async function waitForCtxData(maxWaitMs = 20000, checkIntervalMs = 200, domain = null) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const datasources = Array.isArray(self?.ctx?.datasources) ? self.ctx.datasources : [];
      const rows = Array.isArray(self?.ctx?.data) ? self.ctx.data : [];

      // Check if we have datasources configured AND data rows
      if (datasources.length > 0 && rows.length > 0) {
        LogHelper.log(
          `[Orchestrator] ✅ ctx.data ready: ${datasources.length} datasources, ${rows.length} rows`
        );
        return true;
      }

      // RFC-0106 FIX: Check if another call already fetched data for this domain
      // This prevents duplicate waiting when data is already available
      if (domain) {
        const cachedData = window.MyIOOrchestratorData?.[domain];
        if (cachedData && cachedData.items && cachedData.items.length > 0) {
          const cacheAge = Date.now() - (cachedData.timestamp || 0);
          if (cacheAge < 30000) {
            LogHelper.log(
              `[Orchestrator] ✅ Data already available in cache for ${domain} (${cachedData.items.length} items, age: ${cacheAge}ms) - exiting wait`
            );
            return 'cached'; // Special return to indicate cached data is available
          }
        }
      }

      // Log progress every second
      const elapsed = Date.now() - startTime;
      if (elapsed % 1000 < checkIntervalMs) {
        LogHelper.log(
          `[Orchestrator] ⏳ Waiting for ctx.data... ${Math.round(elapsed / 1000)}s (${
            datasources.length
          } datasources, ${rows.length} rows)`
        );
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
    }

    // Timeout - check one more time if cache is available before failing
    if (domain) {
      const cachedData = window.MyIOOrchestratorData?.[domain];
      if (cachedData && cachedData.items && cachedData.items.length > 0) {
        LogHelper.log(
          `[Orchestrator] ✅ Timeout but cache available for ${domain} (${cachedData.items.length} items)`
        );
        return 'cached';
      }
    }

    // Timeout - proceed anyway but log warning
    const datasources = Array.isArray(self?.ctx?.datasources) ? self.ctx.datasources : [];
    const rows = Array.isArray(self?.ctx?.data) ? self.ctx.data : [];
    LogHelper.warn(
      `[Orchestrator] ⚠️ ctx.data wait timeout after ${maxWaitMs}ms: ${datasources.length} datasources, ${rows.length} rows`
    );
    return false;
  }

  // RFC-0106: Track if we need to re-fetch when ctx.data becomes available
  let ctxDataWasEmpty = false;
  let lastFetchDomain = null;
  let lastFetchPeriod = null;

  /**
   * RFC-0106: Check if ctx.data has new data and trigger re-fetch if needed
   */
  function checkAndRefetchIfNeeded() {
    if (!ctxDataWasEmpty || !lastFetchDomain || !lastFetchPeriod) return;

    const rows = Array.isArray(self?.ctx?.data) ? self.ctx.data : [];
    if (rows.length > 0) {
      LogHelper.log(
        `[Orchestrator] 🔄 ctx.data now available (${rows.length} rows) - triggering re-fetch for ${lastFetchDomain}`
      );
      ctxDataWasEmpty = false;

      // Clear cache and re-fetch
      inFlight.clear();
      hydrateDomain(lastFetchDomain, lastFetchPeriod);
    }
  }

  // Check periodically if ctx.data becomes available
  setInterval(checkAndRefetchIfNeeded, 2000);

  async function fetchAndEnrich(domain, period) {
    try {
      LogHelper.log(`[Orchestrator] 🔍 fetchAndEnrich called for ${domain}`);

      // RFC-0106 FIX: Check if fresh data is already available in MyIOOrchestratorData
      // This prevents duplicate hydrateDomain calls (with different keys) from waiting for ctx.data
      // when data was already successfully fetched by another call
      const cachedData = window.MyIOOrchestratorData?.[domain];
      if (cachedData && cachedData.items && cachedData.items.length > 0) {
        const cacheAge = Date.now() - (cachedData.timestamp || 0);
        // RFC-FIX: Also validate that the cached data is for the same period
        // Guard: Only call periodKey if CUSTOMER_ING_ID is available
        const currentPeriodKey = CUSTOMER_ING_ID ? periodKey(CUSTOMER_ING_ID, domain, period) : `${domain}-no-customer`;
        const cachedPeriodKey = cachedData.periodKey;
        const periodMatches = currentPeriodKey === cachedPeriodKey;

        // Use cache if less than 30 seconds old AND period matches
        if (cacheAge < 30000 && periodMatches) {
          LogHelper.log(
            `[Orchestrator] ✅ Using cached data for ${domain}: ${cachedData.items.length} items (age: ${cacheAge}ms, periodKey matches)`
          );
          return cachedData.items;
        } else if (cacheAge < 30000 && !periodMatches) {
          LogHelper.log(
            `[Orchestrator] ⚠️ Cache exists but periodKey mismatch: cached=${cachedPeriodKey}, current=${currentPeriodKey} - fetching fresh data`
          );
        }
      }

      // Temperature domain: uses ctx.data directly (no API call) - realtime data from ThingsBoard
      if (domain === 'temperature') {
        LogHelper.log(`[Orchestrator] 🌡️ Temperature domain - using ctx.data directly (no API)`);

        // Wait for ctx.data to be populated (pass domain to check cache during wait)
        const ctxDataReady = await waitForCtxData(20000, 200, domain);

        // If cached data is available, return it directly
        if (ctxDataReady === 'cached') {
          const cachedData = window.MyIOOrchestratorData?.[domain];
          LogHelper.log(
            `[Orchestrator] ✅ Using cached temperature data: ${cachedData?.items?.length || 0} items`
          );
          return cachedData?.items || [];
        }

        if (!ctxDataReady) {
          LogHelper.warn(`[Orchestrator] ⚠️ ctx.data not ready for temperature`);
          window.MyIOUtils?.handleDataLoadError(domain, 'ctx.data timeout - datasources not loaded');
          return [];
        }

        // Build metadata map from AllTempDevices datasource
        const { byIngestion: metadataMap, byEntityId: metadataByEntityId } =
          buildMetadataMapFromCtxData(domain);

        if (metadataByEntityId.size === 0) {
          LogHelper.warn(`[Orchestrator] ⚠️ No temperature devices found in ctx.data`);
          return [];
        }

        LogHelper.log(`[Orchestrator] 🌡️ Found ${metadataByEntityId.size} temperature devices`);

        // Build items directly from metadata (value = temperature reading)
        const items = [];
        for (const [entityId, meta] of metadataByEntityId.entries()) {
          // RFC-FIX: Apply temperature offset if available
          // The offset is added to the raw temperature to get the corrected/calibrated value
          const rawTemperature = Number(meta.temperature || 0);
          const tempOffset = Number(meta.offSetTemperature || 0);
          const temperatureValue = rawTemperature + tempOffset;

          // Debug log if offset is applied
          if (tempOffset !== 0) {
            LogHelper.log(
              `[Orchestrator] 🌡️ Applying temperature offset for "${meta.label || meta.identifier}": raw=${rawTemperature}, offset=${tempOffset}, adjusted=${temperatureValue}`
            );
          }

          // RFC-0110 v5: Pass telemetry timestamp and lastActivityTime for proper status calculation
          const deviceStatus = convertConnectionStatusToDeviceStatus(meta.connectionStatus, {
            deviceType: meta.deviceType,
            deviceProfile: meta.deviceProfile,
            temperatureTs: meta.temperatureTs,
            lastActivityTime: meta.lastActivityTime,
          });

          items.push({
            id: entityId,
            tbId: entityId,
            ingestionId: meta.ingestionId || null,
            identifier: meta.identifier || '',
            label: meta.label || meta.identifier || 'Sensor',
            entityLabel: meta.label || meta.identifier || 'Sensor',
            name: meta.label || meta.identifier || 'Sensor',
            value: temperatureValue,
            temperature: temperatureValue,
            rawTemperature: rawTemperature, // RFC-FIX: Keep raw value for reference
            offSetTemperature: tempOffset, // RFC-FIX: Keep offset for reference
            deviceType: meta.deviceType || 'TERMOSTATO',
            deviceProfile: meta.deviceProfile || '',
            deviceStatus: deviceStatus,
            connectionStatus: meta.connectionStatus || 'unknown',
            centralId: meta.centralId || null,
            centralName: meta.centralName || '',
            slaveId: meta.slaveId || null,
            lastActivityTime: meta.lastActivityTime || null,
            lastConnectTime: meta.lastConnectTime || null,
            lastDisconnectTime: meta.lastDisconnectTime || null,
            log_annotations: meta.log_annotations || null,
            // RFC-0108: Include ownerName for shopping grouping in tooltips
            ownerName: meta.ownerName || null,
            customerName: meta.ownerName || null,
          });
        }

        // Populate window.STATE.temperature
        populateStateTemperature(items);

        LogHelper.log(`[Orchestrator] 🌡️ Temperature items built: ${items.length}`);
        return items;
      }

      // RFC-0106: MUST wait for ctx.data to be populated BEFORE calling API
      // The flow is: ctx.data (metadata) → API (consumption) → match by ingestionId
      // Track domain/period for potential re-fetch if ctx.data loads later
      lastFetchDomain = domain;
      lastFetchPeriod = period;

      const ctxDataReady = await waitForCtxData(20000, 200, domain);

      // If cached data is available, return it directly (another call already fetched)
      if (ctxDataReady === 'cached') {
        const cachedData = window.MyIOOrchestratorData?.[domain];
        LogHelper.log(
          `[Orchestrator] ✅ Using cached ${domain} data: ${cachedData?.items?.length || 0} items`
        );
        return cachedData?.items || [];
      }

      if (!ctxDataReady) {
        // Mark that ctx.data was empty - will trigger re-fetch when data arrives
        ctxDataWasEmpty = true;
        LogHelper.warn(
          `[Orchestrator] ⚠️ ctx.data not ready - skipping API call, will auto-refetch when available`
        );

        // RFC-0106: Show toast and reload page when ctx.data fails to load
        window.MyIOUtils?.handleDataLoadError(domain, 'ctx.data timeout - datasources not loaded');

        return []; // DO NOT call API without metadata
      }

      // RFC-0106: Build metadata map FIRST from ctx.data (filtered by domain's datasource)
      const { byIngestion: metadataMap, byEntityId: metadataByEntityId } =
        buildMetadataMapFromCtxData(domain);

      // RFC-0107: For water domain, check for tank devices that don't need ingestionId
      // TANK/CAIXA_DAGUA get data directly from ThingsBoard (water_level, water_percentage)
      let tankItems = [];
      if (domain === 'water' && metadataByEntityId.size > 0) {
        // DEBUG: Log all water device types
        const waterDeviceTypes = [];
        for (const [, meta] of metadataByEntityId.entries()) {
          waterDeviceTypes.push(meta.deviceType || 'N/A');
        }
        LogHelper.log(`[Orchestrator] 🔍 DEBUG Water device types: ${waterDeviceTypes.join(', ')}`);

        for (const [entityId, meta] of metadataByEntityId.entries()) {
          const deviceType = String(meta.deviceType || '').toUpperCase();
          if (deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA') {
            const waterLevel = Number(meta.waterLevel || 0);
            const waterPercentage = Number(meta.waterPercentage || 0);
            // RFC-0110 v5: Pass telemetry timestamp and lastActivityTime for proper status calculation
            const deviceStatus = convertConnectionStatusToDeviceStatus(meta.connectionStatus, {
              deviceType: meta.deviceType,
              deviceProfile: meta.deviceProfile,
              waterLevelTs: meta.waterLevelTs,
              waterPercentageTs: meta.waterPercentageTs,
              lastActivityTime: meta.lastActivityTime,
            });

            tankItems.push({
              id: entityId,
              tbId: entityId,
              ingestionId: meta.ingestionId || null,
              identifier: meta.identifier || '',
              label: meta.label || meta.identifier || "Caixa d'água",
              entityLabel: meta.label || meta.identifier || "Caixa d'água",
              name: meta.label || meta.identifier || "Caixa d'água",
              value: waterLevel, // water_level in liters
              waterLevel: waterLevel,
              waterPercentage: waterPercentage, // 0-1 range
              deviceType: deviceType,
              deviceProfile: meta.deviceProfile || deviceType,
              effectiveDeviceType: meta.deviceProfile || deviceType,
              deviceStatus: deviceStatus,
              connectionStatus: meta.connectionStatus || 'unknown',
              centralId: meta.centralId || null,
              centralName: meta.centralName || '',
              slaveId: meta.slaveId || null,
              lastActivityTime: meta.lastActivityTime || null,
              lastConnectTime: meta.lastConnectTime || null,
              lastDisconnectTime: meta.lastDisconnectTime || null,
              log_annotations: meta.log_annotations || null,
              labelWidget: 'Área Comum', // Tanks go to area comum
              groupLabel: 'Área Comum',
              _hasMetadata: true,
              _isTankDevice: true,
            });
          }
        }

        if (tankItems.length > 0) {
          LogHelper.log(
            `[Orchestrator] 🚰 Found ${tankItems.length} tank devices (TANK/CAIXA_DAGUA) in water domain`
          );
        }
      }

      if (metadataMap.size === 0 && tankItems.length === 0) {
        LogHelper.warn(`[Orchestrator] ⚠️ Metadata map is empty - no devices found in ctx.data`);
        ctxDataWasEmpty = true;

        // RFC-0106: Show toast and reload page when metadata map is empty
        window.MyIOUtils?.handleDataLoadError(domain, 'no devices found in datasource');

        return []; // No metadata = no point calling API
      }

      // If we only have tank devices and no devices with ingestionId, return tank items directly
      if (metadataMap.size === 0 && tankItems.length > 0) {
        LogHelper.log(
          `[Orchestrator] 🚰 Only tank devices found - skipping API call, returning ${tankItems.length} items`
        );
        const tankPeriodKey = `tank:${domain}:${period.startISO}:${period.endISO}:${period.granularity}`;
        populateState(domain, tankItems, tankPeriodKey);
        return tankItems;
      }

      LogHelper.log(`[Orchestrator] ✅ Metadata map built: ${metadataMap.size} devices with ingestionId`);

      // Wait for credentials promise and refresh from global state
      // Don't trust local scope variables - they may be stale
      LogHelper.log(`[Orchestrator] Credentials check: flag=${window.MyIOOrchestrator?.credentialsSet}`);

      // If credentials flag is not set, wait for them with timeout
      if (!window.MyIOOrchestrator?.credentialsSet) {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Credentials timeout after 10s')), 10000)
        );

        try {
          LogHelper.log(`[Orchestrator] ⏳ Waiting for credentials to be set...`);
          await Promise.race([credentialsPromise, timeoutPromise]);
          LogHelper.log(`[Orchestrator] ✅ Credentials promise resolved`);
        } catch (err) {
          LogHelper.error(`[Orchestrator] ⚠️ Credentials timeout - ${err.message}`);
          throw new Error('Credentials not available - initialization timeout');
        }
      } else {
        LogHelper.log(`[Orchestrator] ✅ Credentials flag already set`);
      }

      // RFC-0082 FIX: Always refresh credentials from global state after waiting
      // This ensures we have the latest values, not stale closure variables
      const latestCreds = window.MyIOOrchestrator?.getCredentials?.();

      if (!latestCreds || !latestCreds.CLIENT_ID || !latestCreds.CLIENT_SECRET) {
        LogHelper.error(`[Orchestrator] ❌ Credentials validation failed after wait:`, {
          hasGetCredentials: !!window.MyIOOrchestrator?.getCredentials,
          credentialsReturned: !!latestCreds,
          CLIENT_ID: latestCreds?.CLIENT_ID || 'MISSING',
          CLIENT_SECRET_exists: !!latestCreds?.CLIENT_SECRET,
          CUSTOMER_ING_ID: latestCreds?.CUSTOMER_ING_ID || 'MISSING',
        });
        throw new Error('Missing CLIENT_ID or CLIENT_SECRET - credentials not properly set');
      }

      const clientId = latestCreds.CLIENT_ID;
      const clientSecret = latestCreds.CLIENT_SECRET;

      LogHelper.log(`[Orchestrator] 🔍 Using credentials:`, {
        CLIENT_ID: clientId?.substring(0, 10) + '...',
        CLIENT_SECRET_length: clientSecret?.length || 0,
        CUSTOMER_ING_ID: latestCreds.CUSTOMER_ING_ID,
      });

      // Create fresh MyIOAuth instance every time (like TELEMETRY widget)
      const MyIO =
        (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) ||
        (typeof window !== 'undefined' && window.MyIOLibrary) ||
        null;

      if (!MyIO) {
        throw new Error('MyIOLibrary not available');
      }

      const myIOAuth = MyIO.buildMyioIngestionAuth({
        dataApiHost: DATA_API_HOST,
        clientId: clientId,
        clientSecret: clientSecret,
      });

      // Get fresh token
      const token = await myIOAuth.getToken();
      if (!token) {
        throw new Error('Failed to get ingestion token');
      }

      // Validate customer ID exists
      if (!latestCreds.CUSTOMER_ING_ID) {
        throw new Error('Missing CUSTOMER_ING_ID - customer not configured');
      }

      const customerId = latestCreds.CUSTOMER_ING_ID;

      // Build API URL based on domain
      const url = new URL(
        `${DATA_API_HOST}/api/v1/telemetry/customers/${customerId}/${domain}/devices/totals`
      );
      url.searchParams.set('startTime', period.startISO);
      url.searchParams.set('endTime', period.endISO);
      url.searchParams.set('deep', '1');

      LogHelper.log(`[Orchestrator] Fetching from: ${url.toString()}`);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store', // RFC-0001: Always fetch fresh data
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          emitTokenExpired();
        }
        throw new Error(`API error: ${res.status}`);
      }

      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json?.data ?? []);

      // Debug first row to see available fields
      if (rows.length > 0) {
        //LogHelper.log(`[Orchestrator] Sample API row (full):`, JSON.stringify(rows[0], null, 2));
        //LogHelper.log(`[Orchestrator] Sample API row groupType field:`, rows[0].groupType);
      }

      // RFC-0106: metadataMap was already built BEFORE API call (line ~1755)
      // Now combine metadata (ctx.data) with consumption values (API)
      // Match by ingestionId: metadata.ingestionId === api.id
      // NO FALLBACK: deviceType, identifier, label ONLY from ctx.data

      // RFC-0106: Value field differs by domain:
      // - energy: total_value (kWh)
      // - water: total_value (m³) - API returns total_value for both domains
      const getValueFromRow = (row) => {
        // Both energy and water use total_value from API
        // Water API may also return total_volume or total_pulses as alternatives
        if (domain === 'water') {
          return Number(row.total_value || row.total_volume || row.total_pulses || 0);
        }
        // Energy: total_value
        return Number(row.total_value || 0);
      };

      const items = rows.map((row) => {
        const apiId = row.id; // This is the ingestionId from API
        const meta = metadataMap.get(apiId) || {}; // Get metadata by ingestionId
        const name = row.name || '';

        // Use metadata from ThingsBoard datasource (ctx.data) - NO FALLBACKS for deviceType
        // deviceType: ONLY from ctx.data where datakey = deviceType, NO fallback
        // identifier: ONLY from ctx.data where datakey = identifier, fallback = 'N/A'
        // label: ONLY from ctx.data where datakey = label, fallback = 'SEM ETIQUETA'
        const rawDeviceType = meta.deviceType || null;
        const deviceProfile = meta.deviceProfile || null;

        // MASTER RULE for deviceType:
        // - If deviceType = deviceProfile = '3F_MEDIDOR' → keep as '3F_MEDIDOR' (it's a loja)
        // - If deviceType = '3F_MEDIDOR' AND deviceProfile != '3F_MEDIDOR' → force deviceType = deviceProfile
        let deviceType = rawDeviceType;
        if (rawDeviceType === '3F_MEDIDOR' && deviceProfile && deviceProfile !== '3F_MEDIDOR') {
          deviceType = deviceProfile;
          LogHelper.log(
            `[Orchestrator] 🔄 Master rule applied: deviceType changed from 3F_MEDIDOR to ${deviceProfile} for ${
              meta.label || row.name
            }`
          );
        }
        const identifier = meta.identifier || 'N/A';
        const label = meta.label || name || 'SEM ETIQUETA';

        // Infer labelWidget from deviceType/deviceProfile
        const labelWidget = inferLabelWidget({
          deviceType: deviceType,
          deviceProfile: deviceProfile,
          identifier: identifier,
          name: name,
        });

        return {
          id: apiId,
          tbId: meta.tbId || apiId,
          ingestionId: apiId,
          identifier: identifier,
          deviceIdentifier: identifier,
          label: label,
          entityLabel: label,
          name: name,
          value: getValueFromRow(row),
          perc: 0,
          deviceType: deviceType,
          deviceProfile: deviceProfile,
          effectiveDeviceType: deviceProfile || deviceType || null,
          // RFC-0110 v5: Pass telemetry timestamp and lastActivityTime for proper status calculation
          deviceStatus: convertConnectionStatusToDeviceStatus(meta.connectionStatus, {
            deviceType: meta.deviceType,
            deviceProfile: meta.deviceProfile,
            consumptionTs: meta.consumptionTs,
            lastActivityTime: meta.lastActivityTime,
          }),
          connectionStatus: meta.connectionStatus || 'unknown',
          slaveId: meta.slaveId || row.slaveId || null,
          centralId: meta.centralId || row.centralId || null,
          centralName: meta.centralName || null,
          ownerName: meta.ownerName || null, // RFC-0102: customerName from ThingsBoard ctx.data
          gatewayId: row.gatewayId || null,
          customerId: row.customerId || null,
          assetId: row.assetId || null,
          assetName: meta.assetName || row.assetName || null, // RFC-0102: assetName from ctx.data or API
          lastActivityTime: meta.lastActivityTime || null,
          lastConnectTime: meta.lastConnectTime || null,
          lastDisconnectTime: meta.lastDisconnectTime || null,
          log_annotations: meta.log_annotations || null,
          // Power limits and instantaneous power (for deviceStatus calculation)
          // consumption from datasource = instantaneous power in Watts
          deviceMapInstaneousPower: meta.deviceMapInstaneousPower || null,
          consumptionPower: meta.consumption || null,
          // RFC-0110 v5: Include consumptionTs for EQUIPMENTS to use correct timestamp
          consumptionTs: meta.consumptionTs || null,
          labelWidget: labelWidget,
          groupLabel: labelWidget,
          // Flag to indicate if metadata was found
          _hasMetadata: !!meta.tbId,
        };
      });

      // Filter out invalid items:
      // 1. Items with deviceType = domain name (placeholder from API - 'energy' or 'water')
      // 2. Items with effectiveDeviceType = domain name (no proper deviceType/deviceProfile)
      // 3. Items without metadata (_hasMetadata = false) - these exist in API but not in ThingsBoard datasource
      const itemsBeforeFilter = items.length;
      const domainLower = domain.toLowerCase(); // 'energy' or 'water'
      const filteredItems = items.filter((item) => {
        const dt = (item.deviceType || '').toLowerCase();
        const edt = (item.effectiveDeviceType || '').toLowerCase();

        // Discard items with deviceType = domain (placeholder from API)
        if (dt === domainLower) {
          LogHelper.log(
            `[Orchestrator] 🗑️ Discarding item with deviceType='${domain}': ${item.label || item.name}`
          );
          return false;
        }

        // Discard items with effectiveDeviceType = domain (no proper classification)
        if (edt === domainLower) {
          LogHelper.log(
            `[Orchestrator] 🗑️ Discarding item with effectiveDeviceType='${domain}': ${
              item.label || item.name
            }`
          );
          return false;
        }

        // Discard items without metadata (exist in API but not in ThingsBoard datasource)
        if (!item._hasMetadata) {
          LogHelper.log(
            `[Orchestrator] 🗑️ Discarding item without metadata: ${item.label || item.name} (id: ${item.id})`
          );
          return false;
        }

        return true;
      });
      const discardedCount = itemsBeforeFilter - filteredItems.length;
      if (discardedCount > 0) {
        LogHelper.log(
          `[Orchestrator] 🗑️ Discarded ${discardedCount} invalid items (no metadata or deviceType='${domain}')`
        );

        // DEBUG: Show first 3 discarded items with their API IDs for debugging
        const discardedItems = items.filter((item) => !item._hasMetadata).slice(0, 3);
        if (discardedItems.length > 0) {
          LogHelper.log(`[Orchestrator] 🔍 DEBUG: Sample discarded items (API ID not found in datasource):`);
          discardedItems.forEach((item) => {
            LogHelper.log(`  - API id: ${item.id}, name: ${item.name || item.label}`);
          });

          // Show sample ingestionIds that ARE in the metadataMap
          const metaIds = Array.from(metadataMap.keys()).slice(0, 3);
          LogHelper.log(`[Orchestrator] 🔍 DEBUG: Sample ingestionIds in metadataMap: ${metaIds.join(', ')}`);
        }
      }

      // DEBUG: Log sample item and metadata match stats
      const itemsWithMeta = filteredItems.filter((i) => i._hasMetadata).length;
      const itemsWithoutMeta = filteredItems.filter((i) => !i._hasMetadata).length;
      LogHelper.log(
        `[Orchestrator] 📊 Metadata match: ${itemsWithMeta} with metadata, ${itemsWithoutMeta} without`
      );

      if (filteredItems.length > 0) {
        LogHelper.log(`[Orchestrator] 🔍 Sample API row:`, JSON.stringify(rows[0], null, 2));
        LogHelper.log(`[Orchestrator] 🔍 Sample mapped item:`, {
          id: filteredItems[0].id,
          label: filteredItems[0].label,
          identifier: filteredItems[0].identifier,
          value: filteredItems[0].value,
          deviceType: filteredItems[0].deviceType,
          deviceProfile: filteredItems[0].deviceProfile,
          labelWidget: filteredItems[0].labelWidget,
          _hasMetadata: filteredItems[0]._hasMetadata,
        });
      }

      LogHelper.log(
        `[Orchestrator] fetchAndEnrich: fetched ${filteredItems.length} items for domain ${domain}`
      );
      return filteredItems;
    } catch (error) {
      LogHelper.error(`[Orchestrator] fetchAndEnrich error for domain ${domain}:`, error);
      return [];
    }
  }

  // Fetch data for a domain and period
  async function hydrateDomain(domain, period) {
    // Guard: Only call periodKey if CUSTOMER_ING_ID is available
    const key = CUSTOMER_ING_ID ? periodKey(CUSTOMER_ING_ID, domain, period) : `${domain}-${period?.startDate || 'no-period'}`;
    const startTime = Date.now();

    LogHelper.log(`[Orchestrator] hydrateDomain called for ${domain}:`, { key, inFlight: inFlight.has(key) });

    // Coalesce duplicate requests
    if (inFlight.has(key)) {
      LogHelper.log(`[Orchestrator] ⏭️ Coalescing duplicate request for ${key}`);
      return inFlight.get(key);
    }

    // Show busy overlay
    showGlobalBusy(domain, 'Carregando dados...');

    // Set mutex for coordination
    sharedWidgetState.mutexMap.set(domain, true);
    sharedWidgetState.activePeriod = period;

    const fetchPromise = (async () => {
      try {
        const items = await fetchAndEnrich(domain, period);

        emitHydrated(domain, key, items.length);

        // Emit data to widgets
        emitProvide(domain, key, items);
        LogHelper.log(`[Orchestrator] 📡 Emitted provide-data for ${domain} with ${items.length} items`);

        const duration = Date.now() - startTime;
        metrics.recordHydration(domain, duration);

        LogHelper.log(`[Orchestrator] ✅ Data fetched for ${domain} in ${duration}ms`);
        return items;
      } catch (error) {
        LogHelper.error(`[Orchestrator] ❌ Error fetching ${domain}:`, error);
        metrics.recordError(domain, error);
        emitError(domain, error);

        // RFC-0106: Show toast and reload page on fetch errors
        window.MyIOUtils?.handleDataLoadError(domain, error.message || 'fetch error');

        throw error;
      } finally {
        // Hide busy overlay
        LogHelper.log(`[Orchestrator] 🔄 Finally block - hiding busy for ${domain}`);
        hideGlobalBusy(domain);

        // Release mutex
        sharedWidgetState.mutexMap.set(domain, false);
        LogHelper.log(`[Orchestrator] 🔓 Mutex released for ${domain}`);

        // RFC-0107: Dispatch event to signal fetch completion (for contract modal timer)
        window.dispatchEvent(
          new CustomEvent('myio:domain:fetch-complete', {
            detail: { domain },
          })
        );
        LogHelper.log(`[Orchestrator] 📡 Dispatched myio:domain:fetch-complete for ${domain}`);
      }
    })().finally(() => {
      inFlight.delete(key);
      LogHelper.log(`[Orchestrator] 🧹 Cleaned up inFlight for ${key}`);
    });

    inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  // Emit data to widgets
  function emitProvide(domain, pKey, items) {
    const now = Date.now();
    const key = `${domain}_${pKey}`;

    // Don't emit empty arrays
    if (!items || items.length === 0) {
      LogHelper.warn(`[Orchestrator] ⚠️ Skipping emitProvide for ${domain} - no items to emit`);
      return;
    }

    // RFC-FIX: Always sort items by consumption value (highest first) regardless of status
    // This ensures the biggest consumers are always shown first in all widgets
    const sortedItems = [...items].sort((a, b) => {
      const valueA = a.value || a.total_value || a.consumption || 0;
      const valueB = b.value || b.total_value || b.consumption || 0;
      return valueB - valueA; // Descending order (highest first)
    });
    items = sortedItems;

    // Prevent duplicate emissions (< 100ms)
    if (OrchestratorState.lastEmission[key]) {
      const timeSinceLastEmit = now - OrchestratorState.lastEmission[key];
      if (timeSinceLastEmit < 100) {
        LogHelper.log(
          `[Orchestrator] ⏭️ Skipping duplicate emission for ${domain} (${timeSinceLastEmit}ms ago)`
        );
        return;
      }
    }

    OrchestratorState.lastEmission[key] = now;

    // RFC-0106: Populate window.STATE with categorized data BEFORE emitting
    // This allows widgets to read directly from window.STATE instead of events
    populateState(domain, items, pKey);

    // RFC-0106 FIX: Store in MyIOOrchestratorData for late-initializing widgets
    // This ensures widgets that miss the event can still find the data
    if (!window.MyIOOrchestratorData) {
      window.MyIOOrchestratorData = {};
    }
    window.MyIOOrchestratorData[domain] = {
      periodKey: pKey,
      items: items,
      timestamp: now,
      version: (window.MyIOOrchestratorData[domain]?.version || 0) + 1,
    };
    LogHelper.log(
      `[Orchestrator] 📦 MyIOOrchestratorData updated for ${domain}: ${items.length} items (v${window.MyIOOrchestratorData[domain].version})`
    );

    // Emit event to all widgets (kept for backwards compatibility)
    const eventDetail = { domain, periodKey: pKey, items };
    window.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', { detail: eventDetail }));

    // RFC-0091: Emit domain-specific event for EQUIPMENTS compatibility
    // EQUIPMENTS widget listens for myio:energy-data-ready with cache
    if (domain === 'energy') {
      // Create a Map cache from items for EQUIPMENTS compatibility
      // RFC-0110 v5 FIX: Add entries by BOTH tbId AND ingestionId (EQUIPMENTS looks up by ingestionId)
      const energyCache = new Map();
      items.forEach((item) => {
        // Add by tbId for ThingsBoard entity lookup
        if (item.tbId) {
          energyCache.set(item.tbId, item);
        }
        // Add by ingestionId for EQUIPMENTS lookup (CRITICAL for RFC-0110 consumptionTs)
        if (item.ingestionId && item.ingestionId !== item.tbId) {
          energyCache.set(item.ingestionId, item);
        }
        // Fallback to id if neither exists
        if (!item.tbId && !item.ingestionId && item.id) {
          energyCache.set(item.id, item);
        }
      });
      window.dispatchEvent(
        new CustomEvent('myio:energy-data-ready', {
          detail: { cache: energyCache, items, periodKey: pKey },
        })
      );
      LogHelper.log(
        `[Orchestrator] 📡 Emitted myio:energy-data-ready for EQUIPMENTS (${energyCache.size} items)`
      );

      // RFC-0102: Emit devices-classified event for EQUIPMENTS RFC-0102 compatibility
      window.dispatchEvent(
        new CustomEvent('myio:devices-classified', {
          detail: { timestamp: Date.now(), count: items.length },
        })
      );
      LogHelper.log(`[Orchestrator] 📢 Emitted myio:devices-classified (${items.length} items)`);

      // RFC-0103: Emit energy-summary-ready for HEADER widget with breakdown
      // RFC-FIX: Exclude ENTRADA devices (main meters, transformers) from customerTotal
      // These devices represent total building consumption, not individual stores/equipment
      const entradaItems = items.filter((item) => isEntradaDevice(item));
      const nonEntradaItems = items.filter((item) => !isEntradaDevice(item));
      const entradaTotal = entradaItems.reduce((sum, item) => sum + (item.value || item.total_value || 0), 0);

      if (entradaItems.length > 0) {
        LogHelper.log(
          `[Orchestrator] ⚡ Excluding ${entradaItems.length} ENTRADA devices from customerTotal (${entradaTotal.toFixed(2)} kWh)`
        );
      }

      // Calculate customerTotal from non-ENTRADA items only
      const customerTotal = nonEntradaItems.reduce(
        (sum, item) => sum + (item.value || item.total_value || 0),
        0
      );

      // Calculate breakdown by type using isStoreDevice (3F_MEDIDOR = loja)
      const lojaItems = nonEntradaItems.filter((item) => isStoreDevice(item));
      const equipmentItems = nonEntradaItems.filter(
        (item) => !isStoreDevice(item) && isAllowedEquipmentProfile(item)
      );
      const lojasTotal = lojaItems.reduce((sum, item) => sum + (item.value || item.total_value || 0), 0);
      const equipmentsTotal = equipmentItems.reduce(
        (sum, item) => sum + (item.value || item.total_value || 0),
        0
      );

      // Calculate breakdown by shopping using customerId or ownerName (excluding ENTRADA)
      const shoppingMap = new Map();
      const customerList = window.custumersSelected || window.customersList || [];
      nonEntradaItems.forEach((item) => {
        // Use customerId if available, otherwise try to match by ownerName
        const customerId = item.customerId;
        const ownerName = item.ownerName || item.customerName;
        if (!customerId && !ownerName) return;

        const mapKey = customerId || ownerName;
        if (!shoppingMap.has(mapKey)) {
          // Try to find customer name from list or use ownerName
          const customer = customerId ? customerList.find?.((c) => c.value === customerId) : null;
          shoppingMap.set(mapKey, {
            id: customerId || mapKey,
            name: customer?.name || ownerName || item.customerName || 'Shopping',
            equipamentos: 0,
            lojas: 0,
          });
        }
        const entry = shoppingMap.get(mapKey);
        const value = item.value || item.total_value || 0;
        if (isStoreDevice(item)) {
          entry.lojas += value;
        } else {
          entry.equipamentos += value;
        }
      });
      // RFC-FIX: Sort shoppings by total consumption (highest first)
      const shoppingsEnergy = Array.from(shoppingMap.values()).sort((a, b) => {
        const totalA = (a.equipamentos || 0) + (a.lojas || 0);
        const totalB = (b.equipamentos || 0) + (b.lojas || 0);
        return totalB - totalA;
      });

      const energySummary = {
        customerTotal,
        unfilteredTotal: customerTotal,
        isFiltered: false,
        deviceCount: items.length,
        equipmentsTotal,
        lojasTotal,
        shoppingsEnergy,
      };
      window.dispatchEvent(
        new CustomEvent('myio:energy-summary-ready', {
          detail: energySummary,
        })
      );
      LogHelper.log(
        `[Orchestrator] 📊 Emitted myio:energy-summary-ready (total: ${customerTotal.toFixed(
          2
        )} kWh, equip: ${equipmentsTotal.toFixed(2)}, lojas: ${lojasTotal.toFixed(2)})`
      );

      // RFC-0103: Also emit initial water-summary-ready from ctx.data when energy loads
      // This ensures HEADER gets water data without waiting for water tab to be selected
      try {
        const waterAliases = ['allhidrodevices']; // RFC-0109: Single datasource with all water meters
        const waterDevicesMap = new Map(); // entityId -> { ownerName, consumption, pulses, aliasName }
        const ownerNameMap = new Map(); // entityId -> ownerName (from ownername dataKey)
        const ctxData = self?.ctx?.data || [];

        LogHelper.log(
          `[Orchestrator] 💧 Checking ctx.data for water devices (${ctxData.length} datasources)`
        );

        // RFC-0108: First pass - collect ownerName for each entity from ownername dataKey (all datasources)
        ctxData.forEach((ds) => {
          const entityId = ds.datasource?.entityId;
          if (!entityId) return;

          const dataKeyName = ds.dataKey?.name?.toLowerCase();
          const hasData = ds.data?.length > 0;

          if (dataKeyName === 'ownername' && hasData) {
            const latestData = ds.data[ds.data.length - 1];
            const ownerName = latestData?.[1];
            if (ownerName && typeof ownerName === 'string') {
              ownerNameMap.set(entityId, ownerName);
            }
          }
        });

        LogHelper.log(`[Orchestrator] 💧 Found ${ownerNameMap.size} entities with ownerName`);

        // Second pass: collect all water devices and their values + ownerName/customerId from water datasource
        const waterDataKeys = new Set(); // RFC-0108: Debug - collect all dataKeys for water devices
        ctxData.forEach((ds) => {
          const aliasName = (ds.datasource?.aliasName || '').toLowerCase();
          if (!waterAliases.some((wa) => aliasName.includes(wa))) return;

          const entityId = ds.datasource?.entityId;
          if (!entityId) return;

          const dataKeyName = ds.dataKey?.name?.toLowerCase();
          const hasData = ds.data?.length > 0;

          // RFC-0108: Debug - collect dataKey names for water devices
          if (dataKeyName) waterDataKeys.add(dataKeyName);

          if (!waterDevicesMap.has(entityId)) {
            waterDevicesMap.set(entityId, {
              tbId: entityId,
              // RFC-0108: ownerName will be filled in from water datasource's ownername key or customerId lookup
              ownerName: ownerNameMap.get(entityId) || null,
              customerId: null,
              consumption: 0,
              pulses: 0,
              _aliasName: aliasName,
              // RFC-0109: deviceType/deviceProfile for proper classification
              deviceType: null,
              deviceProfile: null,
              identifier: null,
              label: ds.datasource?.entityName || ds.datasource?.entityLabel || null,
            });
          }

          const device = waterDevicesMap.get(entityId);

          // RFC-0108: Collect ownerName from water datasource itself
          if (dataKeyName === 'ownername' && hasData) {
            const latestData = ds.data[ds.data.length - 1];
            const ownerName = latestData?.[1];
            if (ownerName && typeof ownerName === 'string') {
              device.ownerName = ownerName;
            }
          }

          // RFC-0108: Collect customerId from water datasource for shopping lookup
          if (dataKeyName === 'customerid' && hasData) {
            const latestData = ds.data[ds.data.length - 1];
            const customerId = latestData?.[1];
            if (customerId && typeof customerId === 'string') {
              device.customerId = customerId;
            }
          }

          // Get value from latest data point for consumption or pulses
          if (hasData && (dataKeyName === 'consumption' || dataKeyName === 'pulses')) {
            const latestData = ds.data[ds.data.length - 1];
            const value = Number(latestData?.[1]) || 0;
            if (dataKeyName === 'consumption') {
              device.consumption = value;
            } else if (dataKeyName === 'pulses') {
              device.pulses = value;
            }
          }

          // RFC-0109: Collect deviceType, deviceProfile, identifier for classification
          if (dataKeyName === 'devicetype' && hasData) {
            const latestData = ds.data[ds.data.length - 1];
            device.deviceType = latestData?.[1] || null;
          }
          if (dataKeyName === 'deviceprofile' && hasData) {
            const latestData = ds.data[ds.data.length - 1];
            device.deviceProfile = latestData?.[1] || null;
          }
          if (dataKeyName === 'identifier' && hasData) {
            const latestData = ds.data[ds.data.length - 1];
            device.identifier = latestData?.[1] || null;
          }
          if (dataKeyName === 'ingestionid' && hasData) {
            const latestData = ds.data[ds.data.length - 1];
            device.ingestionId = latestData?.[1] || null;
          }
          if (dataKeyName === 'label' && hasData) {
            const latestData = ds.data[ds.data.length - 1];
            device.label = latestData?.[1] || device.label;
          }
        });

        // RFC-0108: Final pass - resolve ownerName from customerId via customers list
        const customersList = window.custumersSelected || window.customersList || [];
        let withOwnerName = 0;
        let withoutOwnerName = 0;
        waterDevicesMap.forEach((device) => {
          // If no ownerName but has customerId, look up shopping name from customers list
          if (!device.ownerName && device.customerId && customersList.length > 0) {
            const customer = customersList.find((c) => c.value === device.customerId);
            if (customer?.name) {
              device.ownerName = customer.name;
            }
          }
          if (device.ownerName) {
            withOwnerName++;
          } else {
            withoutOwnerName++;
            device.ownerName = 'Desconhecido';
          }
        });
        LogHelper.log(`[Orchestrator] 💧 Water dataKeys: ${Array.from(waterDataKeys).join(', ')}`);
        LogHelper.log(
          `[Orchestrator] 💧 Water devices: ${withOwnerName} with ownerName, ${withoutOwnerName} without (customersList: ${customersList.length})`
        );

        // RFC-0109: Water meter classification
        // FIX: Use aliasName as PRIMARY classification (more reliable than deviceType/deviceProfile)
        // Fallback to deviceType/deviceProfile if aliasName doesn't match
        let classificationDebugLog = { byAlias: {}, byType: {}, defaults: [] };
        const classifyWaterMeter = (device) => {
          const aliasName = String(device._aliasName || '').toLowerCase();

          // PRIMARY: Classification by aliasName (from ThingsBoard alias)
          // 'todos hidrometros lojas' or similar -> loja
          if (aliasName.includes('loja')) {
            classificationDebugLog.byAlias['loja'] = (classificationDebugLog.byAlias['loja'] || 0) + 1;
            return 'loja';
          }
          // 'hidrometros entrada' or 'hidrometro shopping' -> entrada
          if (aliasName.includes('entrada') || aliasName.includes('shopping')) {
            classificationDebugLog.byAlias['entrada'] = (classificationDebugLog.byAlias['entrada'] || 0) + 1;
            return 'entrada';
          }
          // 'hidrometros area comum' -> areacomum
          if (aliasName.includes('area') || aliasName.includes('comum')) {
            classificationDebugLog.byAlias['areacomum'] =
              (classificationDebugLog.byAlias['areacomum'] || 0) + 1;
            return 'areacomum';
          }

          // FALLBACK: Classification by deviceType/deviceProfile (if aliasName didn't match)
          const dt = String(device.deviceType || '').toUpperCase();
          // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
          const dp = String(device.deviceProfile || device.deviceType || '').toUpperCase();

          // LOJA: deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO
          if (dt === 'HIDROMETRO' && dp === 'HIDROMETRO') {
            classificationDebugLog.byType['loja'] = (classificationDebugLog.byType['loja'] || 0) + 1;
            return 'loja';
          }

          // ENTRADA: deviceType = HIDROMETRO_SHOPPING OR (deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_SHOPPING)
          if (dt === 'HIDROMETRO_SHOPPING' || (dt === 'HIDROMETRO' && dp === 'HIDROMETRO_SHOPPING')) {
            classificationDebugLog.byType['entrada'] = (classificationDebugLog.byType['entrada'] || 0) + 1;
            return 'entrada';
          }

          // AREA_COMUM: Check for explicit HIDROMETRO_AREA_COMUM types
          if (dt.includes('AREA_COMUM') || dp.includes('AREA_COMUM')) {
            classificationDebugLog.byType['areacomum_explicit'] =
              (classificationDebugLog.byType['areacomum_explicit'] || 0) + 1;
            return 'areacomum';
          }

          // RFC-0140 FIX: Do NOT default to areacomum - unclassified devices should be excluded
          // This prevents HIDROMETRO without deviceProfile from appearing in area comum
          classificationDebugLog.byType['unclassified'] =
            (classificationDebugLog.byType['unclassified'] || 0) + 1;

          // Log warn for unclassified devices (first 10 only to avoid spam)
          if (classificationDebugLog.defaults.length < 10) {
            classificationDebugLog.defaults.push({
              label: device.label,
              aliasName: device._aliasName,
              dt: dt || 'NULL',
              dp: dp || 'NULL',
            });
            LogHelper.warn(
              `[Orchestrator] ⚠️ UNCLASSIFIED water device: "${device.label}" (aliasName=${device._aliasName || 'N/A'}, deviceType=${dt || 'NULL'}, deviceProfile=${dp || 'NULL'})`
            );
          }

          return 'unclassified';
        };

        // Convert map to array and calculate water value (prefer consumption, fallback to pulses)
        const waterItems = Array.from(waterDevicesMap.values())
          .map((d) => {
            const classification = classifyWaterMeter(d);
            return {
              ...d,
              value: d.consumption > 0 ? d.consumption : d.pulses,
              _isStore: classification === 'loja',
              _classification: classification,
            };
          })
          .filter((d) => d.value > 0);

        LogHelper.log(
          `[Orchestrator] 💧 Found ${waterDevicesMap.size} water devices, ${waterItems.length} with values`
        );

        // RFC-0109: Log classification breakdown
        const classificationCounts = waterItems.reduce((acc, item) => {
          acc[item._classification] = (acc[item._classification] || 0) + 1;
          return acc;
        }, {});
        LogHelper.log(`[Orchestrator] 💧 Classification breakdown: ${JSON.stringify(classificationCounts)}`);
        LogHelper.log(
          `[Orchestrator] 💧 Classification DEBUG: byAlias=${JSON.stringify(
            classificationDebugLog.byAlias
          )}, byType=${JSON.stringify(classificationDebugLog.byType)}`
        );
        if (classificationDebugLog.defaults.length > 0) {
          LogHelper.log(
            `[Orchestrator] 💧 DEFAULT samples (first 5): ${JSON.stringify(classificationDebugLog.defaults)}`
          );
        }

        if (waterItems.length > 0) {
          const storeWaterItems = waterItems.filter((item) => item._classification === 'loja');
          const commonAreaItems = waterItems.filter((item) => item._classification === 'areacomum');
          const entradaItems = waterItems.filter((item) => item._classification === 'entrada');

          // RFC-0109: Exclude entrada items from calculations (no screen for entrada yet)
          // RFC-0140: Also exclude unclassified items
          const itemsForCalculation = waterItems.filter(
            (item) => item._classification !== 'entrada' && item._classification !== 'unclassified'
          );
          const waterTotal = itemsForCalculation.reduce((sum, item) => sum + (item.value || 0), 0);
          const storesTotal = storeWaterItems.reduce((sum, item) => sum + (item.value || 0), 0);
          const commonAreaTotal = commonAreaItems.reduce((sum, item) => sum + (item.value || 0), 0);

          // Group by shopping (excluding entrada items)
          const waterShoppingMap = new Map();
          itemsForCalculation.forEach((item) => {
            const name = item.ownerName;
            if (!waterShoppingMap.has(name)) {
              waterShoppingMap.set(name, { name, areaComum: 0, lojas: 0 });
            }
            const entry = waterShoppingMap.get(name);
            if (item._isStore) {
              entry.lojas += item.value || 0;
            } else {
              entry.areaComum += item.value || 0;
            }
          });

          const waterSummary = {
            filteredTotal: waterTotal,
            unfilteredTotal: waterTotal,
            isFiltered: false,
            deviceCount: itemsForCalculation.length, // Exclude entrada from count
            commonArea: commonAreaTotal,
            stores: storesTotal,
            // RFC-FIX: Sort shoppings by total consumption (highest first)
            shoppingsWater: Array.from(waterShoppingMap.values()).sort((a, b) => {
              const totalA = (a.commonArea || 0) + (a.stores || 0);
              const totalB = (b.commonArea || 0) + (b.stores || 0);
              return totalB - totalA;
            }),
          };

          window.dispatchEvent(new CustomEvent('myio:water-summary-ready', { detail: waterSummary }));
          LogHelper.log(
            `[Orchestrator] 💧 Initial water-summary-ready from ctx.data (total: ${waterTotal.toFixed(
              2
            )} m³, area: ${commonAreaTotal.toFixed(2)}, lojas: ${storesTotal.toFixed(2)})`
          );

          // RFC-0109: Emit myio:water-tb-data-ready for WATER_COMMON_AREA and WATER_STORES widgets
          // This provides the classified devices directly to the widgets
          const entradaTotal = entradaItems.reduce((sum, item) => sum + (item.value || 0), 0);

          // RFC-0109: Store classified data in window for late-loading widgets
          const waterClassifiedData = {
            commonArea: {
              items: commonAreaItems,
              total: commonAreaTotal,
              count: commonAreaItems.length,
            },
            stores: {
              items: storeWaterItems,
              total: storesTotal,
              count: storeWaterItems.length,
            },
            entrada: {
              items: entradaItems,
              total: entradaTotal,
              count: entradaItems.length,
            },
            all: {
              items: itemsForCalculation, // Exclude entrada from "all"
              total: waterTotal,
              count: itemsForCalculation.length,
            },
            classification: classificationCounts,
            timestamp: Date.now(),
          };

          // Store in global for late-loading widgets
          // RFC-0109: Only store if we have valid data (don't overwrite with empty)
          window.MyIOOrchestratorData = window.MyIOOrchestratorData || {};
          const existingWaterClassified = window.MyIOOrchestratorData.waterClassified;
          const newItemCount = itemsForCalculation.length; // Exclude entrada from count
          const existingItemCount = existingWaterClassified?.all?.count || 0;

          // Only update if we have MORE items or if there's no existing data
          if (newItemCount > 0 && (newItemCount >= existingItemCount || !existingWaterClassified)) {
            window.MyIOOrchestratorData.waterClassified = waterClassifiedData;
            LogHelper.log(
              `[Orchestrator] 💧 Stored waterClassified data in window.MyIOOrchestratorData (${newItemCount} items, replaced ${existingItemCount}, ignored ${entradaItems.length} entrada)`
            );
          } else if (newItemCount > 0) {
            LogHelper.log(
              `[Orchestrator] 💧 Skipped storing waterClassified - existing has more items (${existingItemCount} vs ${newItemCount})`
            );
          }

          window.dispatchEvent(
            new CustomEvent('myio:water-tb-data-ready', {
              detail: waterClassifiedData,
            })
          );
          LogHelper.log(
            `[Orchestrator] 💧 Emitted myio:water-tb-data-ready (commonArea: ${commonAreaItems.length}, stores: ${storeWaterItems.length}, entrada: ${entradaItems.length} ignored)`
          );

          // RFC-0131: Enrich water data with API totals (async)
          // This allows child widgets to receive API-enriched data without making their own API calls
          // RFC-0140 FIX: Retry logic if period not available yet
          const enrichWaterWithApi = async (retryCount = 0) => {
            try {
              // RFC-0140 FIX: Use currentPeriod from orchestrator or fallback to scope
              const period = window.MyIOOrchestrator?.getCurrentPeriod?.();
              const startISO =
                period?.startISO || self.ctx?.scope?.startDateISO || self.ctx?.$scope?.startDateISO;
              const endISO = period?.endISO || self.ctx?.scope?.endDateISO || self.ctx?.$scope?.endDateISO;

              if (!startISO || !endISO) {
                // RFC-0140: Retry up to 5 times with 1s delay
                if (retryCount < 5) {
                  LogHelper.log(
                    `[Orchestrator] 💧 RFC-0131: No date range yet, retry ${retryCount + 1}/5 in 1s...`
                  );
                  setTimeout(() => enrichWaterWithApi(retryCount + 1), 1000);
                  return;
                }
                LogHelper.log(
                  '[Orchestrator] 💧 RFC-0131: No date range after 5 retries, skipping API enrichment'
                );
                return;
              }

              const creds = window.MyIOOrchestrator?.getCredentials?.();
              if (!creds?.CLIENT_ID || !creds?.CLIENT_SECRET || !creds?.CUSTOMER_ING_ID) {
                LogHelper.log('[Orchestrator] 💧 RFC-0131: No credentials, skipping API enrichment');
                return;
              }

              // Build auth and fetch API totals
              const MyIOLib = (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) || window.MyIOLibrary;
              if (!MyIOLib?.buildMyioIngestionAuth) {
                LogHelper.warn('[Orchestrator] 💧 RFC-0131: MyIOLibrary not available');
                return;
              }

              const myIOAuth = MyIOLib.buildMyioIngestionAuth({
                dataApiHost: DATA_API_HOST,
                clientId: creds.CLIENT_ID,
                clientSecret: creds.CLIENT_SECRET,
              });

              const token = await myIOAuth.getToken();
              if (!token) {
                LogHelper.warn('[Orchestrator] 💧 RFC-0131: Failed to get token');
                return;
              }

              // Fetch water API totals
              const url = new URL(
                `${DATA_API_HOST}/api/v1/telemetry/customers/${creds.CUSTOMER_ING_ID}/water/devices/totals`
              );
              url.searchParams.set('startTime', startISO);
              url.searchParams.set('endTime', endISO);
              url.searchParams.set('deep', '1');

              LogHelper.log(`[Orchestrator] 💧 RFC-0131: Fetching water API totals...`);
              const res = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store', // RFC-0001: Always fetch fresh data
              });

              if (!res.ok) {
                LogHelper.warn(`[Orchestrator] 💧 RFC-0131: API returned ${res.status}`);
                return;
              }

              const json = await res.json();
              const apiDevices = Array.isArray(json) ? json : json?.data || [];

              if (apiDevices.length === 0) {
                LogHelper.log('[Orchestrator] 💧 RFC-0131: API returned no devices');
                return;
              }

              // Build lookup map by ingestionId
              const apiMap = new Map();
              apiDevices.forEach((d) => {
                if (d.id) apiMap.set(d.id, d);
              });

              LogHelper.log(`[Orchestrator] 💧 RFC-0131: Got ${apiMap.size} devices from API`);

              // Enrich items with API values
              // RFC-0140 FIX: Also copy customerId and customerName from API for shopping filter
              const enrichItem = (item) => {
                const apiData = apiMap.get(item.ingestionId);
                if (apiData) {
                  return {
                    ...item,
                    value: Number(apiData.total_value || apiData.total_volume || 0),
                    customerId: apiData.customerId || item.customerId || null,
                    customerName: apiData.customerName || item.customerName || null,
                    apiEnriched: true,
                  };
                }
                return item;
              };

              const enrichedCommonArea = commonAreaItems.map(enrichItem);
              const enrichedStores = storeWaterItems.map(enrichItem);
              const enrichedAll = itemsForCalculation.map(enrichItem);

              // Recalculate totals
              const newCommonAreaTotal = enrichedCommonArea.reduce((sum, i) => sum + (i.value || 0), 0);
              const newStoresTotal = enrichedStores.reduce((sum, i) => sum + (i.value || 0), 0);
              const newWaterTotal = newCommonAreaTotal + newStoresTotal;

              // Build enriched data
              const enrichedWaterClassified = {
                commonArea: {
                  items: enrichedCommonArea,
                  total: newCommonAreaTotal,
                  count: enrichedCommonArea.length,
                },
                stores: {
                  items: enrichedStores,
                  total: newStoresTotal,
                  count: enrichedStores.length,
                },
                entrada: waterClassifiedData.entrada, // Keep entrada as-is
                all: {
                  items: enrichedAll,
                  total: newWaterTotal,
                  count: enrichedAll.length,
                },
                classification: classificationCounts,
                timestamp: Date.now(),
                apiEnriched: true,
              };

              // Update global cache
              window.MyIOOrchestratorData.waterClassified = enrichedWaterClassified;

              // Re-emit with enriched data
              window.dispatchEvent(
                new CustomEvent('myio:water-tb-data-ready', {
                  detail: enrichedWaterClassified,
                })
              );

              LogHelper.log(
                `[Orchestrator] 💧 RFC-0131: Re-emitted myio:water-tb-data-ready with API values (total: ${newWaterTotal.toFixed(
                  2
                )} m³, stores: ${newStoresTotal.toFixed(2)}, commonArea: ${newCommonAreaTotal.toFixed(2)})`
              );

              // Also update water-summary-ready
              const enrichedWaterSummary = {
                filteredTotal: newWaterTotal,
                unfilteredTotal: newWaterTotal,
                isFiltered: false,
                deviceCount: enrichedAll.length,
                commonArea: newCommonAreaTotal,
                stores: newStoresTotal,
                apiEnriched: true,
              };
              window.dispatchEvent(
                new CustomEvent('myio:water-summary-ready', { detail: enrichedWaterSummary })
              );
            } catch (err) {
              LogHelper.warn(`[Orchestrator] 💧 RFC-0131: API enrichment failed: ${err.message}`);
            }
          };
          // Start the enrichment (with retry if period not available)
          enrichWaterWithApi();
        }
      } catch (err) {
        LogHelper.warn(`[Orchestrator] Failed to emit initial water-summary-ready: ${err.message}`);
      }
    }

    // RFC-0102: Emit water-data-ready event for HEADER and WATER widgets
    if (domain === 'water') {
      const waterCache = new Map();
      items.forEach((item) => {
        if (item.tbId || item.id) {
          waterCache.set(item.tbId || item.id, item);
        }
        if (item.ingestionId) {
          waterCache.set(item.ingestionId, item);
        }
      });
      window.dispatchEvent(
        new CustomEvent('myio:water-data-ready', {
          detail: { cache: waterCache, items, periodKey: pKey },
        })
      );
      LogHelper.log(`[Orchestrator] 💧 Emitted myio:water-data-ready for HEADER (${waterCache.size} items)`);

      // RFC-0103: Emit water-summary-ready for HEADER widget with breakdown
      // RFC-0109: Exclude entrada items from calculations
      const itemsExcludingEntrada = items.filter(
        (item) => !isWaterEntradaDevice(item) && item._classification !== 'entrada'
      );
      const filteredTotal = itemsExcludingEntrada.reduce(
        (sum, item) => sum + (item.value || item.total_value || 0),
        0
      );
      // RFC-0109: Calculate breakdown by type using isWaterStoreDevice for water domain
      const storeItems = itemsExcludingEntrada.filter((item) => item._isStore || isWaterStoreDevice(item));
      const commonAreaItems = itemsExcludingEntrada.filter(
        (item) => !item._isStore && !isWaterStoreDevice(item)
      );
      const stores = storeItems.reduce((sum, item) => sum + (item.value || item.total_value || 0), 0);
      const commonArea = commonAreaItems.reduce(
        (sum, item) => sum + (item.value || item.total_value || 0),
        0
      );

      // Calculate breakdown by shopping using customerId or ownerName (excluding entrada)
      const waterShoppingMap = new Map();
      const waterCustomerList = window.custumersSelected || window.customersList || [];
      itemsExcludingEntrada.forEach((item) => {
        const customerId = item.customerId;
        const ownerName = item.ownerName || item.customerName;
        if (!customerId && !ownerName) return;

        const mapKey = customerId || ownerName;
        if (!waterShoppingMap.has(mapKey)) {
          const customer = customerId ? waterCustomerList.find?.((c) => c.value === customerId) : null;
          waterShoppingMap.set(mapKey, {
            id: customerId || mapKey,
            name: customer?.name || ownerName || item.customerName || 'Shopping',
            areaComum: 0,
            lojas: 0,
          });
        }
        const entry = waterShoppingMap.get(mapKey);
        const value = item.value || item.total_value || 0;
        // RFC-0109: Use isWaterStoreDevice for water domain classification
        if (item._isStore || isWaterStoreDevice(item)) {
          entry.lojas += value;
        } else {
          entry.areaComum += value;
        }
      });
      // RFC-FIX: Sort shoppings by total consumption (highest first)
      const shoppingsWater = Array.from(waterShoppingMap.values()).sort((a, b) => {
        const totalA = (a.commonArea || 0) + (a.stores || 0);
        const totalB = (b.commonArea || 0) + (b.stores || 0);
        return totalB - totalA;
      });

      const waterSummary = {
        filteredTotal,
        unfilteredTotal: filteredTotal,
        isFiltered: false,
        deviceCount: itemsExcludingEntrada.length,
        commonArea,
        stores,
        shoppingsWater,
      };
      window.dispatchEvent(
        new CustomEvent('myio:water-summary-ready', {
          detail: waterSummary,
        })
      );
      LogHelper.log(
        `[Orchestrator] 💧 Emitted myio:water-summary-ready (total: ${filteredTotal.toFixed(
          2
        )} m³, area: ${commonArea.toFixed(2)}, lojas: ${stores.toFixed(2)})`
      );
    }

    try {
      lastProvide.set(domain, { periodKey: pKey, at: Date.now() });
      hideGlobalBusy(domain);
    } catch (_e) {
      // Silently ignore
    }

    // Mark as not loading
    OrchestratorState.loading[domain] = false;

    // Process pending listeners (widgets that arrived late)
    if (OrchestratorState.pendingListeners[domain]) {
      LogHelper.log(
        `[Orchestrator] 🔔 Processing ${OrchestratorState.pendingListeners[domain].length} pending listeners for ${domain}`
      );

      OrchestratorState.pendingListeners[domain].forEach((callback) => {
        try {
          callback({ detail: eventDetail });
        } catch (err) {
          LogHelper.error(`[Orchestrator] Error calling pending listener:`, err);
        }
      });

      delete OrchestratorState.pendingListeners[domain];
    }

    LogHelper.log(`[Orchestrator] 📡 Emitted provide-data for ${domain} with ${items.length} items`);
  }

  function emitHydrated(domain, periodKey, count) {
    window.dispatchEvent(
      new CustomEvent('myio:orchestrator:data-hydrated', {
        detail: { domain, periodKey, count },
      })
    );
  }

  function emitError(domain, error) {
    window.dispatchEvent(
      new CustomEvent('myio:orchestrator:error', {
        detail: {
          domain,
          error: error.message || String(error),
          code: error.status || 500,
        },
      })
    );
  }

  let tokenExpiredDebounce = 0;
  function emitTokenExpired() {
    const now = Date.now();
    if (now - tokenExpiredDebounce < 60_000) return;

    tokenExpiredDebounce = now;
    window.dispatchEvent(new CustomEvent('myio:token-expired', { detail: {} }));
  }

  // Token manager
  const tokenManager = {
    tokens: {},

    updateTokens(newTokens) {
      this.tokens = { ...this.tokens, ...newTokens };

      // Abort in-flight requests when tokens are rotated
      abortAllInflight();

      window.dispatchEvent(new CustomEvent('myio:token-rotated', { detail: {} }));

      if (config?.debugMode) LogHelper.log('[Orchestrator] Tokens rotated');
    },

    getToken(type) {
      return this.tokens[type] || null;
    },

    setToken(type, value) {
      this.tokens[type] = value;
    },
  };

  // Widget registration system for priority management
  /**
   * Registra widget com prioridade baseada na ordem de inicialização
   */
  function registerWidget(widgetId, domain) {
    if (!OrchestratorState.widgetPriority.includes(widgetId)) {
      OrchestratorState.widgetPriority.push(widgetId);

      const priority = OrchestratorState.widgetPriority.indexOf(widgetId) + 1;

      // Store in registry with metadata
      OrchestratorState.widgetRegistry.set(widgetId, {
        domain,
        registeredAt: Date.now(),
        priority,
      });

      LogHelper.log(
        `[Orchestrator] 📝 Widget registered: ${widgetId} (domain: ${domain}, priority: ${priority})`
      );
    }
  }

  /**
   * Listener para widgets se registrarem
   */
  window.addEventListener('myio:widget:register', (ev) => {
    const { widgetId, domain } = ev.detail;
    registerWidget(widgetId, domain);
  });

  // Event listeners
  window.addEventListener('myio:update-date', (ev) => {
    LogHelper.log('[Orchestrator] 📅 Received myio:update-date event', ev.detail);

    // RFC-FIX: Handle forceRefresh flag from MENU "Carregar" button
    // When user clicks "Carregar", we must clear cache and fetch fresh data
    if (ev.detail.forceRefresh) {
      LogHelper.log('[Orchestrator] 🔄 forceRefresh=true, clearing cache for all domains');
      // Clear the application-level cache for all domains
      if (window.MyIOOrchestratorData) {
        ['energy', 'water', 'temperature'].forEach((domain) => {
          if (window.MyIOOrchestratorData[domain]) {
            window.MyIOOrchestratorData[domain] = null;
            LogHelper.log(`[Orchestrator] 🗑️ Cleared cache for ${domain}`);
          }
        });
      }
      // Also clear inFlight to allow new fetches
      inFlight.clear();
      LogHelper.log('[Orchestrator] 🗑️ Cleared inFlight map');
      // Clear lastProvide cooldown so the loading modal will show
      lastProvide.clear();
      LogHelper.log('[Orchestrator] 🗑️ Cleared lastProvide cooldown - loading modal will show');
    }

    // RFC-0091 FIX: Handle both period object and startDate/endDate format from MENU
    if (ev.detail.period) {
      currentPeriod = ev.detail.period;
    } else if (ev.detail.startDate && ev.detail.endDate) {
      // Construct period from startDate/endDate (MENU format)
      currentPeriod = {
        startISO: ev.detail.startDate,
        endISO: ev.detail.endDate,
        granularity: 'HOUR', // Default granularity
        startMs: ev.detail.startMs || new Date(ev.detail.startDate).getTime(),
        endMs: ev.detail.endMs || new Date(ev.detail.endDate).getTime(),
      };
      LogHelper.log('[Orchestrator] 📅 Constructed period from startDate/endDate:', currentPeriod);
    }

    // Cross-context emission removed - HEADER already handles this
    // No need to re-emit here as it creates infinite loop

    if (visibleTab && currentPeriod) {
      LogHelper.log(`[Orchestrator] 📅 myio:update-date → hydrateDomain(${visibleTab})`);
      hydrateDomain(visibleTab, currentPeriod);
    }
  });

  window.addEventListener('myio:dashboard-state', (ev) => {
    // FIX: Accept both 'tab' and 'domain' fields for backwards compatibility
    // MENU sends 'domain', while internal dispatches use 'tab'
    const tab = ev.detail.tab || ev.detail.domain;
    try {
      hideGlobalBusy(tab);
    } catch (_e) {
      // Silently ignore - busy indicator may not exist yet
    }
    visibleTab = tab;
    LogHelper.log(`[Orchestrator] 📊 myio:dashboard-state received: tab=${tab}, visibleTab=${visibleTab}`);
    if (visibleTab && currentPeriod) {
      LogHelper.log(`[Orchestrator] 📊 myio:dashboard-state → hydrateDomain(${visibleTab})`);
      hydrateDomain(visibleTab, currentPeriod);
    } else {
      LogHelper.log(
        `[Orchestrator] 📊 myio:dashboard-state skipped (visibleTab=${visibleTab}, currentPeriod=${!!currentPeriod})`
      );
    }
  });

  // RFC-0103: Listen for shopping filter changes and emit summary events with filtered data
  window.addEventListener('myio:filter-applied', (ev) => {
    LogHelper.log('[Orchestrator] 🔥 Received myio:filter-applied:', ev.detail);

    const selection = ev.detail?.selection || [];
    // RFC-FIX: Include both ingestionId (value) AND customerId (ThingsBoard entityId) for matching
    // The selection has: { name, value (ingestionId), customerId (TB entityId), ingestionId }
    const selectedIngestionIds = selection.map((s) => s.value).filter((v) => v);
    const selectedCustomerIds = selection.map((s) => s.customerId).filter((v) => v);
    const selectedIds = [...new Set([...selectedIngestionIds, ...selectedCustomerIds])]; // Combine and dedupe
    const isFiltered = selection.length > 0;

    LogHelper.log(
      '[Orchestrator] 🔍 Filter IDs - ingestionIds:',
      selectedIngestionIds,
      'customerIds:',
      selectedCustomerIds
    );

    // Store in global state for other functions to use
    window.STATE = window.STATE || {};
    window.STATE.selectedShoppingIds = selectedIds;

    // Get energy data and calculate filtered/unfiltered totals
    const energyData = window.MyIOOrchestratorData?.energy;
    if (energyData?.items?.length) {
      // RFC-FIX: First exclude ENTRADA devices from all calculations
      const allItems = energyData.items.filter((item) => !isEntradaDevice(item));

      // RFC-0131: Build set of selected shopping names from selection array for matching
      const selectedEnergyShoppingNames = new Set(
        selection.map((s) => (s.name || '').toLowerCase()).filter(Boolean)
      );

      // RFC-0131: Filter by shopping - match customerId OR ingestionId OR ownerName against selection
      const filteredItems = isFiltered
        ? allItems.filter((item) => {
            const itemCustomerId = item.customerId || '';
            const itemIngestionId = item.ingestionId || '';
            const ownerName = (item.ownerName || item.customerName || '').toLowerCase();
            return (
              selectedIds.includes(itemCustomerId) ||
              selectedIds.includes(itemIngestionId) ||
              selectedEnergyShoppingNames.has(ownerName)
            );
          })
        : allItems;

      LogHelper.log(
        `[Orchestrator] 📊 Energy filter: ${allItems.length} total (excl. ENTRADA) → ${filteredItems.length} filtered (${selectedEnergyShoppingNames.size} shopping names)`
      );

      const unfilteredTotal = allItems.reduce((sum, item) => sum + (item.value || item.total_value || 0), 0);
      const filteredTotal = filteredItems.reduce(
        (sum, item) => sum + (item.value || item.total_value || 0),
        0
      );

      // Calculate breakdown by type using isStoreDevice (3F_MEDIDOR = loja)
      const lojaItems = filteredItems.filter((item) => isStoreDevice(item));
      const equipmentItems = filteredItems.filter(
        (item) => !isStoreDevice(item) && isAllowedEquipmentProfile(item)
      );
      const lojasTotal = lojaItems.reduce((sum, item) => sum + (item.value || item.total_value || 0), 0);
      const equipmentsTotal = equipmentItems.reduce(
        (sum, item) => sum + (item.value || item.total_value || 0),
        0
      );

      // Calculate breakdown by shopping using customerId or ownerName
      const shoppingMap = new Map();
      const customerList = window.custumersSelected || [];
      filteredItems.forEach((item) => {
        const customerId = item.customerId;
        const ownerName = item.ownerName || item.customerName;
        if (!customerId && !ownerName) return;

        const mapKey = customerId || ownerName;
        if (!shoppingMap.has(mapKey)) {
          const customer = customerId ? customerList.find((c) => c.value === customerId) : null;
          shoppingMap.set(mapKey, {
            id: customerId || mapKey,
            name: customer?.name || ownerName || item.customerName || 'Shopping',
            equipamentos: 0,
            lojas: 0,
          });
        }
        const entry = shoppingMap.get(mapKey);
        const value = item.value || item.total_value || 0;
        if (isStoreDevice(item)) {
          entry.lojas += value;
        } else {
          entry.equipamentos += value;
        }
      });
      // RFC-FIX: Sort shoppings by total consumption (highest first)
      const shoppingsEnergy = Array.from(shoppingMap.values()).sort((a, b) => {
        const totalA = (a.equipamentos || 0) + (a.lojas || 0);
        const totalB = (b.equipamentos || 0) + (b.lojas || 0);
        return totalB - totalA; // Descending order
      });

      const energySummary = {
        customerTotal: filteredTotal,
        unfilteredTotal,
        isFiltered,
        deviceCount: filteredItems.length,
        totalDeviceCount: allItems.length,
        equipmentsTotal,
        lojasTotal,
        shoppingsEnergy,
      };

      window.dispatchEvent(new CustomEvent('myio:energy-summary-ready', { detail: energySummary }));
      LogHelper.log(
        `[Orchestrator] 📊 Filter applied - energy-summary-ready (filtered: ${filteredTotal.toFixed(
          2
        )} / total: ${unfilteredTotal.toFixed(2)} kWh, equip: ${equipmentsTotal.toFixed(
          2
        )}, lojas: ${lojasTotal.toFixed(2)})`
      );
    }

    // Get water data and calculate filtered/unfiltered totals
    // RFC-FIX: Use waterClassified instead of water - data is stored in waterClassified.all.items
    const waterClassified = window.MyIOOrchestratorData?.waterClassified;
    const waterData = window.MyIOOrchestratorData?.water;
    // Try waterClassified first (preferred), fallback to water.items
    const waterItems = waterClassified?.all?.items || waterData?.items;
    if (waterItems?.length) {
      // RFC-0109: Exclude entrada items from calculations (waterClassified.all already excludes entrada)
      const allItems = waterClassified?.all?.items
        ? waterItems // waterClassified.all already excludes entrada
        : waterItems.filter((item) => !isWaterEntradaDevice(item) && item._classification !== 'entrada');

      // Build set of selected shopping names from selection array for matching
      const selectedWaterShoppingNames = new Set(selection.map((s) => s.name?.toLowerCase()).filter(Boolean));

      // RFC-FIX: Filter by shopping - match ownerName, customerId, or ingestionId against selection
      const filteredItems = isFiltered
        ? allItems.filter((item) => {
            const ownerName = (item.ownerName || item.customerName || '').toLowerCase();
            const itemCustomerId = item.customerId || '';
            const itemIngestionId = item.ingestionId || '';
            return (
              selectedWaterShoppingNames.has(ownerName) ||
              selectedIds.includes(itemCustomerId) ||
              selectedIds.includes(itemIngestionId)
            );
          })
        : allItems;

      const unfilteredTotal = allItems.reduce((sum, item) => sum + (item.value || item.total_value || 0), 0);
      const filteredTotal = filteredItems.reduce(
        (sum, item) => sum + (item.value || item.total_value || 0),
        0
      );

      // RFC-0109: Calculate breakdown by type using isWaterStoreDevice for water domain
      const storeItems = filteredItems.filter((item) => item._isStore || isWaterStoreDevice(item));
      const commonAreaItems = filteredItems.filter((item) => !item._isStore && !isWaterStoreDevice(item));
      const stores = storeItems.reduce((sum, item) => sum + (item.value || item.total_value || 0), 0);
      const commonArea = commonAreaItems.reduce(
        (sum, item) => sum + (item.value || item.total_value || 0),
        0
      );

      // Calculate breakdown by shopping using customerId or ownerName (excluding entrada)
      const waterShoppingMap = new Map();
      filteredItems.forEach((item) => {
        const customerId = item.customerId;
        const ownerName = item.ownerName || item.customerName;
        if (!customerId && !ownerName) return;

        const mapKey = customerId || ownerName;
        if (!waterShoppingMap.has(mapKey)) {
          const customer = customerId ? selection.find((c) => c.value === customerId) : null;
          waterShoppingMap.set(mapKey, {
            id: customerId || mapKey,
            name: customer?.name || ownerName || item.customerName || 'Shopping',
            areaComum: 0,
            lojas: 0,
          });
        }
        const entry = waterShoppingMap.get(mapKey);
        const value = item.value || item.total_value || 0;
        // RFC-0109: Use isWaterStoreDevice for water domain classification
        if (item._isStore || isWaterStoreDevice(item)) {
          entry.lojas += value;
        } else {
          entry.areaComum += value;
        }
      });
      // RFC-FIX: Sort shoppings by total consumption (highest first)
      const shoppingsWater = Array.from(waterShoppingMap.values()).sort((a, b) => {
        const totalA = (a.commonArea || 0) + (a.stores || 0);
        const totalB = (b.commonArea || 0) + (b.stores || 0);
        return totalB - totalA;
      });

      const waterSummary = {
        filteredTotal,
        unfilteredTotal,
        isFiltered,
        deviceCount: filteredItems.length,
        totalDeviceCount: allItems.length,
        commonArea,
        stores,
        shoppingsWater,
      };

      window.dispatchEvent(new CustomEvent('myio:water-summary-ready', { detail: waterSummary }));
      LogHelper.log(
        `[Orchestrator] 💧 Filter applied - water-summary-ready (filtered: ${filteredTotal.toFixed(
          2
        )} / total: ${unfilteredTotal.toFixed(2)} m³, area: ${commonArea.toFixed(2)}, lojas: ${stores.toFixed(
          2
        )})`
      );
    }

    // Get temperature data from STATE and calculate filtered averages
    const tempState = window.STATE?.temperature;
    if (tempState?.items?.length) {
      const allItems = tempState.items;
      const limits = tempState.summary?.limits || { min: 20, max: 25 };

      // Build set of selected shopping names from selection array for matching
      // RFC-0108: selection contains { value: ingestionId, name: 'Shopping Name' } (not 'text')
      const selectedShoppingNames = new Set(selection.map((s) => s.name?.toLowerCase()).filter(Boolean));

      // RFC-FIX: Filter by shopping - match ownerName, customerId, or ingestionId against selected shopping
      const filteredItems = isFiltered
        ? allItems.filter((item) => {
            const ownerName = (item.ownerName || item.customerName || '').toLowerCase();
            const itemCustomerId = item.customerId || '';
            const itemIngestionId = item.ingestionId || '';
            return (
              selectedShoppingNames.has(ownerName) ||
              selectedIds.includes(itemCustomerId) ||
              selectedIds.includes(itemIngestionId)
            );
          })
        : allItems;

      LogHelper.log(
        `[Orchestrator] 🌡️ Temperature filter: ${allItems.length} total → ${filteredItems.length} filtered (${selectedShoppingNames.size} shopping names)`
      );

      // Calculate averages (only online devices)
      const calcAvg = (items) => {
        const onlineItems = items.filter(
          (i) => i.connectionStatus !== 'offline' && i.deviceStatus !== 'offline'
        );
        const withTemp = onlineItems.filter(
          (i) => typeof i.temperature === 'number' && !isNaN(i.temperature) && i.temperature > 0
        );
        return withTemp.length > 0 ? withTemp.reduce((s, i) => s + i.temperature, 0) / withTemp.length : null;
      };

      const globalAvg = calcAvg(allItems);
      const filteredAvg = calcAvg(filteredItems);

      // Group by shopping for tooltip
      const shoppingTempMap = new Map();
      const onlineFiltered = filteredItems.filter(
        (i) => i.connectionStatus !== 'offline' && i.deviceStatus !== 'offline'
      );
      onlineFiltered.forEach((item) => {
        const shoppingName = item.ownerName || item.customerName || 'Desconhecido';
        if (!shoppingTempMap.has(shoppingName)) {
          shoppingTempMap.set(shoppingName, {
            name: shoppingName,
            temps: [],
            min: limits.min,
            max: limits.max,
          });
        }
        const temp = Number(item.temperature || 0);
        if (!isNaN(temp) && temp > 0) {
          shoppingTempMap.get(shoppingName).temps.push(temp);
        }
      });

      // Calculate averages and categorize shoppings
      const shoppingsInRange = [];
      const shoppingsOutOfRange = [];

      shoppingTempMap.forEach((data) => {
        if (data.temps.length === 0) return;
        const avg = data.temps.reduce((a, b) => a + b, 0) / data.temps.length;
        const shoppingInfo = {
          name: data.name,
          avg,
          min: data.min,
          max: data.max,
          deviceCount: data.temps.length,
        };

        if (avg >= data.min && avg <= data.max) {
          shoppingsInRange.push(shoppingInfo);
        } else {
          shoppingsOutOfRange.push(shoppingInfo);
        }
      });

      // Sort by name
      shoppingsInRange.sort((a, b) => a.name.localeCompare(b.name));
      shoppingsOutOfRange.sort((a, b) => a.name.localeCompare(b.name));

      const tempSummary = {
        globalAvg,
        filteredAvg: isFiltered ? filteredAvg : globalAvg,
        isFiltered,
        inRangeCount: shoppingsInRange.reduce((s, sh) => s + sh.deviceCount, 0),
        outOfRangeCount: shoppingsOutOfRange.reduce((s, sh) => s + sh.deviceCount, 0),
        shoppingsInRange,
        shoppingsOutOfRange,
        shoppingsUnknownRange: [],
        limits,
      };

      window.dispatchEvent(new CustomEvent('myio:temperature-data-ready', { detail: tempSummary }));
      LogHelper.log(
        `[Orchestrator] 🌡️ Filter applied - temperature-data-ready (filtered avg: ${
          filteredAvg?.toFixed(1) || 'N/A'
        }°C, ${shoppingsInRange.length} in-range, ${shoppingsOutOfRange.length} out-of-range)`
      );
    }

    // Emit orchestrator-filter-updated for backwards compatibility
    window.dispatchEvent(
      new CustomEvent('myio:orchestrator-filter-updated', { detail: { selectedIds, isFiltered } })
    );
    LogHelper.log('[Orchestrator] 🔄 Emitted myio:orchestrator-filter-updated');
  });

  // Request-data listener with pending listeners support
  window.addEventListener('myio:telemetry:request-data', async (ev) => {
    const { domain, period, widgetId, priority } = ev.detail;

    LogHelper.log(
      `[Orchestrator] 📨 Received data request from widget ${widgetId} (domain: ${domain}, priority: ${priority})`
    );

    // Check if already loading
    if (OrchestratorState.loading[domain]) {
      LogHelper.log(`[Orchestrator] ⏳ Already loading ${domain}, adding to pending listeners`);

      // Add pending listener
      if (!OrchestratorState.pendingListeners[domain]) {
        OrchestratorState.pendingListeners[domain] = [];
      }

      OrchestratorState.pendingListeners[domain].push((data) => {
        window.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', { detail: data.detail }));
        try {
          lastProvide.set(domain, { periodKey: data.detail.periodKey, at: Date.now() });
          hideGlobalBusy(domain);
        } catch (_e) {
          // Silently ignore
        }
      });

      return;
    }

    // Fetch fresh data
    OrchestratorState.loading[domain] = true;

    try {
      const p = period || currentPeriod;
      if (p) {
        LogHelper.log(`[Orchestrator] 📡 myio:telemetry:request-data → hydrateDomain(${domain})`);
        await hydrateDomain(domain, p);
      } else {
        LogHelper.log(`[Orchestrator] 📡 myio:telemetry:request-data skipped (no period)`);
        OrchestratorState.loading[domain] = false;
      }
    } catch (error) {
      LogHelper.error(`[Orchestrator] Error hydrating ${domain}:`, error);
      OrchestratorState.loading[domain] = false;
    }
  });

  // RFC-0103: Listen for temperature data request from HEADER widget
  // HEADER emits this event in onDataUpdated to populate the temperature card
  window.addEventListener('myio:request-temperature-data', async (ev) => {
    LogHelper.log('[Orchestrator] 🌡️ Received myio:request-temperature-data from HEADER:', ev.detail);

    // Use current period if available, or construct from event detail
    const period = currentPeriod || {
      startISO: new Date(ev.detail?.startTs || Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endISO: new Date(ev.detail?.endTs || Date.now()).toISOString(),
      granularity: 'HOUR',
    };

    if (!period) {
      LogHelper.warn('[Orchestrator] ⚠️ Cannot fetch temperature - no period available');
      return;
    }

    try {
      // Fetch temperature data
      const items = await fetchAndEnrich('temperature', period);

      if (items && items.length > 0) {
        LogHelper.log(`[Orchestrator] 🌡️ Temperature data fetched: ${items.length} items`);
        // populateStateTemperature already emits myio:temperature-data-ready
      } else {
        LogHelper.warn('[Orchestrator] ⚠️ No temperature items returned');
      }
    } catch (error) {
      LogHelper.error('[Orchestrator] ❌ Error fetching temperature data:', error);
    }
  });

  // Telemetry reporting
  if (!config?.debugMode && typeof window.tbClient !== 'undefined') {
    setInterval(
      () => {
        try {
          window.tbClient.sendTelemetry(metrics.generateTelemetrySummary());
        } catch (e) {
          LogHelper.warn('[Orchestrator] Failed to send telemetry:', e);
        }
      },
      5 * 60 * 1000
    );
  }

  // RFC-0048: Widget Busy Monitor - Detects stuck widgets showing busy for too long
  const widgetBusyMonitor = {
    timers: new Map(), // domain -> timeoutId
    TIMEOUT_MS: 30000, // 30 seconds

    startMonitoring(domain) {
      // Clear existing timer if any
      this.stopMonitoring(domain);

      const timerId = setTimeout(() => {
        LogHelper.error(
          `[WidgetMonitor] ⚠️ Widget ${domain} has been showing busy for more than ${
            this.TIMEOUT_MS / 1000
          }s!`
        );
        LogHelper.error(`[WidgetMonitor] Possible issues:`);
        LogHelper.error(`[WidgetMonitor] 1. Widget não recebeu dados do orchestrator`);
        LogHelper.error(`[WidgetMonitor] 2. Widget recebeu dados vazios mas não chamou hideBusy()`);
        LogHelper.error(`[WidgetMonitor] 3. Erro silencioso impedindo processamento`);

        // Log current busy state
        const busyState = globalBusyState;
        LogHelper.error(`[WidgetMonitor] Current busy state:`, busyState);

        // Attempt auto-recovery: force hide busy for stuck widget
        LogHelper.warn(`[WidgetMonitor] 🔧 Attempting auto-recovery: forcing hideBusy for ${domain}`);
        hideGlobalBusy(domain);

        // RFC-0106: Show toast and reload page when widget is stuck
        window.MyIOUtils?.handleDataLoadError(domain, 'widget stuck in busy state for 30s');
      }, this.TIMEOUT_MS);

      this.timers.set(domain, timerId);
      LogHelper.log(`[WidgetMonitor] ✅ Started monitoring ${domain} (timeout: ${this.TIMEOUT_MS / 1000}s)`);
    },

    stopMonitoring(domain) {
      const timerId = this.timers.get(domain);
      if (timerId) {
        clearTimeout(timerId);
        this.timers.delete(domain);
        LogHelper.log(`[WidgetMonitor] ✅ Stopped monitoring ${domain}`);
      }
    },

    stopAll() {
      for (const [domain, timerId] of this.timers.entries()) {
        clearTimeout(timerId);
        LogHelper.log(`[WidgetMonitor] ✅ Stopped monitoring ${domain}`);
      }
      this.timers.clear();
    },
  };

  // Public API
  return {
    hydrateDomain,
    setVisibleTab: (tab) => {
      visibleTab = tab;
    },
    getVisibleTab: () => visibleTab,
    getCurrentPeriod: () => currentPeriod,
    getStats: () => ({
      totalRequests: metrics.totalRequests,
      inFlightCount: inFlight.size,
    }),
    tokenManager,
    metrics,
    config,

    // Expose centralized busy management
    showGlobalBusy,
    hideGlobalBusy,

    // RFC-0107: Contract loading modal functions
    updateContractModalDomain,
    updateContractModalStatus,

    // Expose shared state
    getSharedWidgetState: () => sharedWidgetState,
    setSharedPeriod: (period) => {
      sharedWidgetState.activePeriod = period;
    },

    // Expose busy state for debugging
    getBusyState: () => ({ ...globalBusyState }),

    // Expose widget busy monitor
    widgetBusyMonitor,

    setCredentials: (customerId, clientId, clientSecret) => {
      LogHelper.log(`[Orchestrator] 🔐 setCredentials called with:`, {
        customerId,
        clientId,
        clientSecretLength: clientSecret?.length || 0,
      });

      CUSTOMER_ING_ID = customerId;
      CLIENT_ID = clientId;
      CLIENT_SECRET = clientSecret;

      LogHelper.log(`[Orchestrator] ✅ Credentials set successfully:`, {
        CUSTOMER_ING_ID,
        CLIENT_ID,
        CLIENT_SECRET_length: CLIENT_SECRET?.length || 0,
      });

      // RFC-0051.2: Mark credentials as set
      if (window.MyIOOrchestrator) {
        window.MyIOOrchestrator.credentialsSet = true;
      }

      // Resolve the promise to unblock waiting fetchAndEnrich calls
      if (credentialsResolver) {
        credentialsResolver();
        LogHelper.log(`[Orchestrator] ✅ Credentials promise resolved - unblocking pending requests`);
      }
    },

    getCredentials: () => {
      return {
        CUSTOMER_ING_ID,
        CLIENT_ID,
        CLIENT_SECRET,
      };
    },

    // RFC-0091: getCache - returns energy data as Map for EQUIPMENTS compatibility
    getCache: () => {
      // Check if we have energy data in MyIOOrchestratorData
      const energyData = window.MyIOOrchestratorData?.energy;
      if (energyData && energyData.items && energyData.items.length > 0) {
        const cache = new Map();
        energyData.items.forEach((item) => {
          // Add by tbId for ThingsBoard entity lookup
          if (item.tbId) {
            cache.set(item.tbId, item);
          }
          // Also add by ingestionId for API/enrichment lookup
          if (item.ingestionId && item.ingestionId !== item.tbId) {
            cache.set(item.ingestionId, item);
          }
          // Fallback to id if neither exists
          if (!item.tbId && !item.ingestionId && item.id) {
            cache.set(item.id, item);
          }
        });
        return cache;
      }
      return new Map();
    },

    // RFC-0130: getEnergyCache - alias for ENERGY widget compatibility
    getEnergyCache: () => {
      const energyData = window.MyIOOrchestratorData?.energy;
      if (energyData && energyData.items && energyData.items.length > 0) {
        const cache = new Map();
        energyData.items.forEach((item) => {
          if (item.ingestionId) cache.set(item.ingestionId, item);
          if (item.tbId && item.tbId !== item.ingestionId) cache.set(item.tbId, item);
        });
        return cache;
      }
      return new Map();
    },

    // RFC-0131: getWaterCache - uses waterClassified for WATER widget
    getWaterCache: () => {
      const waterClassified = window.MyIOOrchestratorData?.waterClassified;
      if (waterClassified?.all?.items?.length > 0) {
        const cache = new Map();
        waterClassified.all.items.forEach((item) => {
          if (item.ingestionId) cache.set(item.ingestionId, item);
          if (item.tbId && item.tbId !== item.ingestionId) cache.set(item.tbId, item);
        });
        return cache;
      }
      return new Map();
    },

    // RFC-0131: getWaterValidIds - returns Sets of ingestionIds by classification
    getWaterValidIds: () => {
      const waterClassified = window.MyIOOrchestratorData?.waterClassified;
      const stores = new Set();
      const commonArea = new Set();

      if (waterClassified?.stores?.items) {
        waterClassified.stores.items.forEach((item) => {
          if (item.ingestionId) stores.add(item.ingestionId);
        });
      }
      if (waterClassified?.commonArea?.items) {
        waterClassified.commonArea.items.forEach((item) => {
          if (item.ingestionId) commonArea.add(item.ingestionId);
        });
      }

      LogHelper.log(`[Orchestrator] getWaterValidIds: stores=${stores.size}, commonArea=${commonArea.size}`);
      return { stores, commonArea };
    },

    // RFC-0091: Stub for getCacheStats - for compatibility with EQUIPMENTS
    getCacheStats: () => {
      return { size: 0, hits: 0, misses: 0 };
    },

    // RFC-0102: Check if energy devices have been classified
    isDevicesClassified: () => {
      const energyData = window.MyIOOrchestratorData?.energy;
      return !!(energyData?.items?.length > 0);
    },

    // RFC-0102: Get equipment devices (not stores) for EQUIPMENTS widget
    getEquipmentDevices: () => {
      const energyData = window.MyIOOrchestratorData?.energy;
      if (!energyData?.items?.length) return [];
      // Filter out stores and keep only allowed equipment profiles
      return energyData.items.filter((item) => {
        const edt = getEffectiveDeviceProfile(item);
        return edt !== '3F_MEDIDOR' && isAllowedEquipmentProfile(item);
      });
    },

    // RFC-0102: Extract devices metadata and emit classification event
    extractEnergyDevicesMetadata: () => {
      LogHelper.log('[Orchestrator] extractEnergyDevicesMetadata called');
      const energyData = window.MyIOOrchestratorData?.energy;
      if (energyData?.items?.length > 0) {
        // Data already exists, emit classification event
        window.dispatchEvent(
          new CustomEvent('myio:devices-classified', {
            detail: { timestamp: Date.now(), count: energyData.items.length },
          })
        );
        LogHelper.log(`[Orchestrator] 📢 Emitted myio:devices-classified (${energyData.items.length} items)`);
      }
    },

    /**
     * RFC-0097: Calculate and dispatch energy summary for ENERGY widget
     * Called by ENERGY widget's waitForOrchestratorAndRequestSummary
     * Calculates customerTotal, equipmentsTotal, lojasTotal from cached data
     */
    requestSummary: () => {
      LogHelper.log('[Orchestrator] requestSummary called by ENERGY widget');

      const cachedData = window.MyIOOrchestratorData?.energy;
      if (!cachedData || !cachedData.items || cachedData.items.length === 0) {
        LogHelper.warn('[Orchestrator] requestSummary: No energy data cached yet');
        return;
      }

      const items = cachedData.items;

      // RFC-FIX: Exclude ENTRADA devices from customerTotal calculation
      const nonEntradaItems = items.filter((item) => !isEntradaDevice(item));

      let customerTotal = 0;
      let equipmentsTotal = 0;
      let lojasTotal = 0;

      nonEntradaItems.forEach((item) => {
        const value = Number(item.value) || Number(item.consumption) || 0;
        customerTotal += value;

        const isStore = isStoreDevice(item);

        if (isStore) {
          lojasTotal += value;
        } else if (isAllowedEquipmentProfile(item)) {
          equipmentsTotal += value;
        }
      });

      const energySummary = {
        customerTotal,
        unfilteredTotal: customerTotal,
        isFiltered: false,
        deviceCount: nonEntradaItems.length,
        equipmentsTotal,
        lojasTotal,
        difference: lojasTotal, // For backwards compatibility
      };

      LogHelper.log(
        `[Orchestrator] 📊 Emitting myio:energy-summary-ready (total: ${customerTotal.toFixed(
          2
        )} kWh, equip: ${equipmentsTotal.toFixed(2)}, lojas: ${lojasTotal.toFixed(2)})`
      );

      window.dispatchEvent(
        new CustomEvent('myio:energy-summary-ready', {
          detail: energySummary,
        })
      );
    },

    /**
     * RFC-0131: Request water summary (mirrors requestSummary for energy)
     * Called by WATER widget to get summary data on demand
     * Recalculates and emits myio:water-summary-ready
     */
    requestWaterSummary: () => {
      LogHelper.log('[Orchestrator] requestWaterSummary called by WATER widget');

      // RFC-0131: Use waterClassified which has stores/commonArea pre-calculated
      const waterClassified = window.MyIOOrchestratorData?.waterClassified;

      if (waterClassified) {
        // Fast path: use pre-calculated totals from waterClassified
        const stores = waterClassified.stores?.total || 0;
        const commonArea = waterClassified.commonArea?.total || 0;
        const total = waterClassified.all?.total || stores + commonArea;
        const deviceCount = waterClassified.all?.count || 0;

        const waterSummary = {
          filteredTotal: total,
          unfilteredTotal: total,
          isFiltered: false,
          deviceCount,
          commonArea,
          stores,
          shoppingsWater: [],
        };

        window.dispatchEvent(new CustomEvent('myio:water-summary-ready', { detail: waterSummary }));
        LogHelper.log(
          `[Orchestrator] requestWaterSummary: emitted from waterClassified (total: ${total.toFixed(
            2
          )} m³, stores: ${stores.toFixed(2)}, commonArea: ${commonArea.toFixed(2)})`
        );
        return;
      }

      // Fallback: calculate from water.items if waterClassified not available
      const waterData = window.MyIOOrchestratorData?.water;
      const items = waterData?.items;

      if (!Array.isArray(items) || items.length === 0) {
        LogHelper.warn('[Orchestrator] requestWaterSummary: No water data cached yet');
        return;
      }

      // Exclude entrada items (same as existing logic)
      const itemsExcludingEntrada = items.filter(
        (item) => !isWaterEntradaDevice(item) && item._classification !== 'entrada'
      );

      // Calculate totals by classification
      let commonArea = 0;
      let stores = 0;

      itemsExcludingEntrada.forEach((item) => {
        const value = Number(item.value) || 0;
        if (item._classification === 'loja') {
          stores += value;
        } else {
          commonArea += value;
        }
      });

      const total = commonArea + stores;

      // Build shopping breakdown
      const shoppingMap = new Map();
      itemsExcludingEntrada.forEach((item) => {
        const name = item.ownerName || 'Desconhecido';
        if (!shoppingMap.has(name)) {
          shoppingMap.set(name, { name, areaComum: 0, lojas: 0 });
        }
        const entry = shoppingMap.get(name);
        const value = Number(item.value) || 0;
        if (item._classification === 'loja') {
          entry.lojas += value;
        } else {
          entry.areaComum += value;
        }
      });

      // RFC-FIX: Sort shoppings by total consumption (highest first)
      const shoppingsWater = Array.from(shoppingMap.values()).sort((a, b) => {
        const totalA = (a.commonArea || 0) + (a.stores || 0);
        const totalB = (b.commonArea || 0) + (b.stores || 0);
        return totalB - totalA;
      });

      const waterSummary = {
        filteredTotal: total,
        unfilteredTotal: total,
        isFiltered: false,
        deviceCount: itemsExcludingEntrada.length,
        commonArea,
        stores,
        shoppingsWater,
      };

      LogHelper.log(
        `[Orchestrator] 💧 requestWaterSummary: emitted (total: ${total.toFixed(
          2
        )} m³, area: ${commonArea.toFixed(2)}, lojas: ${stores.toFixed(2)})`
      );

      window.dispatchEvent(
        new CustomEvent('myio:water-summary-ready', {
          detail: waterSummary,
        })
      );
    },

    /**
     * RFC-0159: Fetch temperature day averages for 7-day chart
     * Retrieves historical temperature data from ThingsBoard API
     * @param {number} startTs - Start timestamp in milliseconds
     * @param {number} endTs - End timestamp in milliseconds
     * @returns {Promise<Object>} Chart data with labels, dailyTotals, shoppingData
     */
    fetchTemperatureDayAverages: async (startTs, endTs) => {
      LogHelper.log(`[Orchestrator] 🌡️ fetchTemperatureDayAverages: ${new Date(startTs).toISOString()} to ${new Date(endTs).toISOString()}`);

      try {
        // Get temperature devices from cache
        const tempData = window.MyIOOrchestratorData?.temperature || window.STATE?.temperature;
        const devices = tempData?.items || [];

        if (!devices || devices.length === 0) {
          LogHelper.warn('[Orchestrator] fetchTemperatureDayAverages: No temperature devices found');
          return null;
        }

        LogHelper.log(`[Orchestrator] fetchTemperatureDayAverages: Found ${devices.length} temperature devices`);

        // Get JWT token for ThingsBoard API
        const token = localStorage.getItem('jwt_token');
        if (!token) {
          LogHelper.error('[Orchestrator] fetchTemperatureDayAverages: No JWT token');
          return null;
        }

        // Calculate number of days and interval
        const dayMs = 24 * 60 * 60 * 1000;
        const numDays = Math.ceil((endTs - startTs) / dayMs);
        const interval = dayMs; // 1 day aggregation

        // Generate date labels
        const labels = [];
        for (let i = 0; i < numDays; i++) {
          const dayDate = new Date(startTs + i * dayMs);
          labels.push(dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        }

        // Group devices by shopping
        const shoppingDevicesMap = new Map();
        devices.forEach((device) => {
          const shoppingName = device.ownerName || device.customerName || 'Desconhecido';
          const shoppingId = device.ownerId || device.customerId || shoppingName;
          if (!shoppingDevicesMap.has(shoppingId)) {
            shoppingDevicesMap.set(shoppingId, {
              name: shoppingName,
              devices: [],
            });
          }
          shoppingDevicesMap.get(shoppingId).devices.push(device);
        });

        LogHelper.log(`[Orchestrator] fetchTemperatureDayAverages: ${shoppingDevicesMap.size} shoppings`);

        // Fetch historical data for each device (batch by shopping to limit API calls)
        const shoppingData = {};
        const shoppingNames = {};
        const globalDailyTotals = new Array(numDays).fill(null);
        const globalDailyCounts = new Array(numDays).fill(0);

        // Process each shopping
        for (const [shoppingId, shoppingInfo] of shoppingDevicesMap) {
          shoppingNames[shoppingId] = shoppingInfo.name;
          shoppingData[shoppingId] = new Array(numDays).fill(null);
          const dailySums = new Array(numDays).fill(0);
          const dailyCounts = new Array(numDays).fill(0);

          // Fetch historical data for up to 5 devices per shopping (to limit API calls)
          const devicesToFetch = shoppingInfo.devices.slice(0, 5);

          for (const device of devicesToFetch) {
            const deviceId = device.tbId || device.id;
            if (!deviceId) continue;

            try {
              // ThingsBoard timeseries API with daily aggregation
              const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=temperature&startTs=${startTs}&endTs=${endTs}&agg=AVG&interval=${interval}`;

              const response = await fetch(url, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                LogHelper.warn(`[Orchestrator] fetchTemperatureDayAverages: Failed to fetch device ${deviceId}`);
                continue;
              }

              const data = await response.json();
              const tempReadings = data?.temperature || [];

              // Process readings into daily buckets
              tempReadings.forEach((reading) => {
                const dayIndex = Math.floor((reading.ts - startTs) / dayMs);

                if (dayIndex >= 0 && dayIndex < numDays && reading.value !== null) {
                  const value = Number(reading.value);
                  if (!isNaN(value)) {
                    dailySums[dayIndex] += value;
                    dailyCounts[dayIndex]++;
                  }
                }
              });
            } catch (err) {
              LogHelper.warn(`[Orchestrator] fetchTemperatureDayAverages: Error fetching device ${deviceId}:`, err.message);
            }
          }

          // Calculate daily averages for this shopping
          for (let i = 0; i < numDays; i++) {
            if (dailyCounts[i] > 0) {
              const avg = dailySums[i] / dailyCounts[i];
              shoppingData[shoppingId][i] = Number(avg.toFixed(1));
              // Accumulate for global average
              if (globalDailyTotals[i] === null) globalDailyTotals[i] = 0;
              globalDailyTotals[i] += avg;
              globalDailyCounts[i]++;
            }
          }
        }

        // Calculate global daily averages
        const dailyTotals = globalDailyTotals.map((sum, i) => {
          if (sum === null || globalDailyCounts[i] === 0) return null;
          return Number((sum / globalDailyCounts[i]).toFixed(1));
        });

        LogHelper.log(`[Orchestrator] 🌡️ fetchTemperatureDayAverages: Completed - ${labels.length} days, ${Object.keys(shoppingData).length} shoppings`);

        return {
          labels,
          dailyTotals,
          shoppingData,
          shoppingNames,
          fetchTimestamp: Date.now(),
        };
      } catch (error) {
        LogHelper.error('[Orchestrator] fetchTemperatureDayAverages: Error:', error);
        return null;
      }
    },

    destroy: () => {
      // Abort all in-flight requests
      abortAllInflight();

      // Stop all widget monitors
      widgetBusyMonitor.stopAll();

      // Clean up busy overlay
      hideGlobalBusy();
      const busyEl = document.getElementById(BUSY_OVERLAY_ID);
      if (busyEl && busyEl.parentNode) {
        busyEl.parentNode.removeChild(busyEl);
      }
    },
  };
})();

// RFC-0051.2: Update stub with real implementation and mark as ready
if (window.MyIOOrchestrator && !window.MyIOOrchestrator.isReady) {
  // Merge real implementation with stub
  Object.assign(window.MyIOOrchestrator, MyIOOrchestrator);

  // Mark as ready
  window.MyIOOrchestrator.isReady = true;
  window.MyIOOrchestrator.credentialsSet = false; // Will be set by setCredentials()

  LogHelper.log('[Orchestrator] ✅ Orchestrator fully initialized and ready');

  // Emit ready event for widgets that are waiting
  window.dispatchEvent(
    new CustomEvent('myio:orchestrator:ready', {
      detail: { timestamp: Date.now() },
    })
  );

  LogHelper.log('[Orchestrator] 📢 Emitted myio:orchestrator:ready event');

  // RFC-0107: Contract loading will be initialized from self.onInit after customerTB_ID is set
} else {
  // Fallback: no stub exists (shouldn't happen but be safe)
  window.MyIOOrchestrator = MyIOOrchestrator;
  window.MyIOOrchestrator.isReady = true;
  window.MyIOOrchestrator.credentialsSet = false;

  LogHelper.log('[MyIOOrchestrator] Initialized (no stub found)');

  // RFC-0107: Contract loading will be initialized from self.onInit after customerTB_ID is set
}

/**
 * RFC-0107: Initializes the contract loading modal and fetches device counts
 * This function is called when the orchestrator becomes ready
 */
async function initializeContractLoading() {
  const customerTB_ID = widgetSettings.customerTB_ID;
  if (!customerTB_ID) {
    LogHelper.warn('[RFC-0107] customerTB_ID not available, skipping contract initialization');
    return;
  }

  LogHelper.log('[RFC-0107] 📋 Initializing contract loading...');

  // Show the contract loading modal immediately
  if (window.MyIOOrchestrator?.showGlobalBusy) {
    window.MyIOOrchestrator.showGlobalBusy('contract', 'Carregando contrato...', 60000);
    LogHelper.log('[RFC-0107] Contract loading modal shown');
  }

  try {
    // Fetch device counts from SERVER_SCOPE
    const deviceCounts = await fetchDeviceCountAttributes(customerTB_ID);

    if (deviceCounts) {
      LogHelper.log('[RFC-0107] Device counts fetched:', deviceCounts);

      // Update the loading modal with expected counts (modal DOM should exist now)
      if (window.MyIOOrchestrator?.updateContractModalDomain) {
        window.MyIOOrchestrator.updateContractModalDomain('energy', deviceCounts.energy, false);
        window.MyIOOrchestrator.updateContractModalDomain('water', deviceCounts.water, false);
        window.MyIOOrchestrator.updateContractModalDomain('temperature', deviceCounts.temperature, false);
        LogHelper.log('[RFC-0107] Modal domains updated with expected counts');
      }

      // Store counts in CONTRACT_STATE (initial, not validated yet)
      window.CONTRACT_STATE = {
        ...window.CONTRACT_STATE,
        energy: deviceCounts.energy,
        water: deviceCounts.water,
        temperature: deviceCounts.temperature,
        timestamp: new Date().toISOString(),
      };

      // Listen for domain data loaded events to update modal and validate
      setupContractValidationListeners(deviceCounts);
    } else {
      LogHelper.warn('[RFC-0107] No device counts available from SERVER_SCOPE');
    }
  } catch (error) {
    LogHelper.error('[RFC-0107] Error initializing contract loading:', error);
  }
}

/**
 * RFC-0107: Sets up listeners to track domain loading and validate contract
 * @param {Object} expectedCounts - Device counts from SERVER_SCOPE
 */
function setupContractValidationListeners(expectedCounts) {
  // FIX: Only track domains that are actually enabled in widgetSettings
  const enabledDomains = widgetSettings.domainsEnabled || { energy: true, water: true, temperature: true };
  const activeDomains = ['energy', 'water', 'temperature'].filter((d) => enabledDomains[d]);

  LogHelper.log('[RFC-0107] Active domains for validation:', activeDomains);

  const domainsLoaded = {};
  const domainsFetchComplete = {};
  activeDomains.forEach((d) => {
    domainsLoaded[d] = false;
    domainsFetchComplete[d] = false;
  });

  let validationFinalized = false;

  // Listen for domain state-ready events (data is in STATE)
  const handleStateReady = (event) => {
    const { domain } = event.detail || {};
    if (!domain || !activeDomains.includes(domain)) return;

    LogHelper.log(`[RFC-0107] Domain ${domain} data ready`);
    domainsLoaded[domain] = true;

    // Check for validation discrepancies
    const state = window.STATE;
    let hasError = false;

    if (domain === 'energy' && state?.energy) {
      const actual =
        (state.energy.lojas?.count || 0) +
        (state.energy.entrada?.count || 0) +
        (state.energy.areacomum?.count || 0);
      hasError = expectedCounts.energy.total > 0 && actual !== expectedCounts.energy.total;
    } else if (domain === 'water' && state?.water) {
      const actual =
        (state.water.lojas?.count || 0) +
        (state.water.entrada?.count || 0) +
        (state.water.areacomum?.count || 0);
      hasError = expectedCounts.water.total > 0 && actual !== expectedCounts.water.total;
    } else if (domain === 'temperature' && state?.temperature) {
      const actual =
        (state.temperature.lojas?.count || 0) +
        (state.temperature.entrada?.count || 0) +
        (state.temperature.areacomum?.count || 0);
      hasError = expectedCounts.temperature.total > 0 && actual !== expectedCounts.temperature.total;
    }

    // Update modal domain status
    if (window.MyIOOrchestrator?.updateContractModalDomain) {
      window.MyIOOrchestrator.updateContractModalDomain(
        domain,
        expectedCounts[domain],
        true, // isLoaded
        hasError
      );
    }

    // Check if all domains are loaded and fetch complete
    checkAllComplete();
  };

  // RFC-0107 FIX: Listen for fetch-complete events (after Finally block)
  const handleFetchComplete = (event) => {
    const { domain } = event.detail || {};
    if (!domain || !activeDomains.includes(domain)) return;

    LogHelper.log(`[RFC-0107] Domain ${domain} fetch complete (finally block done)`);
    domainsFetchComplete[domain] = true;

    // Check if all domains are loaded and fetch complete
    checkAllComplete();
  };

  // Check if all domains have both state-ready and fetch-complete
  const checkAllComplete = () => {
    if (validationFinalized) return;

    const allStateReady = Object.values(domainsLoaded).every((loaded) => loaded);
    const allFetchComplete = Object.values(domainsFetchComplete).every((complete) => complete);

    LogHelper.log(
      `[RFC-0107] checkAllComplete: stateReady=${allStateReady}, fetchComplete=${allFetchComplete}`
    );

    if (allStateReady && allFetchComplete) {
      validationFinalized = true;
      LogHelper.log('[RFC-0107] All domains loaded AND fetch complete - finalizing validation');
      finalizeContractValidation(expectedCounts);
      window.removeEventListener('myio:state:ready', handleStateReady);
      window.removeEventListener('myio:domain:fetch-complete', handleFetchComplete);
    }
  };

  window.addEventListener('myio:state:ready', handleStateReady);
  window.addEventListener('myio:domain:fetch-complete', handleFetchComplete);

  // Also check for already-loaded domains (in case events were missed)
  setTimeout(() => {
    activeDomains.forEach((domain) => {
      if (!domainsLoaded[domain] && window.STATE?.isReady?.(domain)) {
        handleStateReady({ detail: { domain } });
      }
    });
  }, 100);
}

/**
 * RFC-0107: Finalizes contract validation and stores state
 * @param {Object} expectedCounts - Device counts from SERVER_SCOPE
 */
function finalizeContractValidation(expectedCounts) {
  LogHelper.log('[RFC-0107] All domains loaded, finalizing contract validation...');

  // Validate all domains
  const validationResult = validateDeviceCounts(expectedCounts);

  // Store final CONTRACT_STATE
  storeContractState(expectedCounts, validationResult);

  // Update modal status
  if (window.MyIOOrchestrator?.updateContractModalStatus) {
    const totalExpected =
      expectedCounts.energy.total + expectedCounts.water.total + expectedCounts.temperature.total;

    if (validationResult.isValid) {
      window.MyIOOrchestrator.updateContractModalStatus(
        true,
        `${totalExpected} dispositivos carregados com sucesso`
      );
    } else {
      const discrepancyDomains = validationResult.discrepancies.map((d) => d.domain).join(', ');
      window.MyIOOrchestrator.updateContractModalStatus(
        false,
        `Divergências detectadas em: ${discrepancyDomains}`
      );
    }
  }

  LogHelper.log('[RFC-0107] ✅ Contract validation complete:', validationResult);

  // RFC-0107: Auto-close the contract loading modal after 15 seconds (if not paused)
  window._contractModalAutoCloseId = setTimeout(() => {
    if (window._contractModalPaused) {
      LogHelper.log('[RFC-0107] Auto-close skipped - modal is paused');
      return;
    }
    if (window.MyIOOrchestrator?.hideGlobalBusy) {
      LogHelper.log('[RFC-0107] Auto-closing contract loading modal after 15 seconds');
      window.MyIOOrchestrator.hideGlobalBusy();
    }
  }, 15000);

  // Enable close button now that loading is complete
  const closeBtn = document.querySelector('#myio-orchestrator-busy-overlay .contract-close-btn');
  if (closeBtn) {
    closeBtn.disabled = false;
    closeBtn.style.opacity = '1';
    closeBtn.style.cursor = 'pointer';
  }
}

// ============================================================================
// RFC-0143: Device Grid Widget Factory
// Re-export from MyIOLibrary for child widgets (EQUIPMENTS, STORES, etc.)
// ============================================================================
(function () {
  // Re-export DeviceGridWidgetFactory from MyIOLibrary
  if (window.MyIOLibrary?.DeviceGridWidgetFactory) {
    window.DeviceGridWidgetFactory = window.MyIOLibrary.DeviceGridWidgetFactory;

    // Also expose via MyIOUtils for backwards compatibility
    if (window.MyIOUtils) {
      window.MyIOUtils.DeviceGridWidgetFactory = window.DeviceGridWidgetFactory;
    }

    LogHelper.log('[RFC-0143] DeviceGridWidgetFactory loaded from MyIOLibrary');
  } else {
    LogHelper.warn(
      '[RFC-0143] DeviceGridWidgetFactory not found in MyIOLibrary - ensure library is loaded first'
    );
  }
})();
