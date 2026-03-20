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

// RFC-0130: Retry configuration for resilient data loading
const RETRY_CONFIG = {
  maxRetries: 15,
  intervalMs: 1800,
  domains: ['energy', 'water', 'temperature'],
};

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

// RFC-0091: Expose shared utilities globally for child widgets (TELEMETRY, etc.)
// RFC-0091: Shared constants across all widgets
const DATA_API_HOST = 'https://api.data.apps.myio-bas.com';

window.MyIOUtils = window.MyIOUtils || {};
Object.assign(window.MyIOUtils, {
  LogHelper,
  DATA_API_HOST,
  isDebugActive: () => DEBUG_ACTIVE,
  setDebug: (active) => {
    DEBUG_ACTIVE = !!active;
    console.log(`[MyIOUtils] Debug mode ${DEBUG_ACTIVE ? 'enabled' : 'disabled'}`);
  },
  // Temperature domain: global min/max temperature limits (populated by onDataUpdated)
  temperatureLimits: {
    minTemperature: null,
    maxTemperature: null,
  },
  // Outlier clamp range for temperature chart/CSV (superadmin-only, from SERVER_SCOPE)
  temperatureClampRange: null, // { min, max } or null → falls back to DEFAULT_CLAMP_RANGE (15–40)
  // RFC-0106: Global mapInstantaneousPower from customer's parent entity
  // Used for deviceStatus calculation with power ranges
  mapInstantaneousPower: null,
  // RFC-XXXX: SuperAdmin flag - user with @myio.com.br email (except alarme/alarmes)
  // Populated by detectSuperAdmin() in onInit
  SuperAdmin: false,
  // RFC-0171: Current user email - used for superadmin check in modals
  currentUserEmail: null,

  // RFC-0139: Global theme state management
  // Default theme is 'light', MAIN is the single source of truth
  currentTheme: 'light',

  /**
   * RFC-0139: Set global theme and notify all listeners
   * @param {'light' | 'dark'} theme - Theme to set
   */
  setTheme: (theme) => {
    if (theme !== 'light' && theme !== 'dark') {
      LogHelper.warn(`[MyIOUtils] RFC-0139: Invalid theme: ${theme}. Using 'light'.`);
      theme = 'light';
    }

    if (window.MyIOUtils.currentTheme === theme) {
      LogHelper.log(`[MyIOUtils] RFC-0139: Theme already set to ${theme}`);
      return;
    }

    window.MyIOUtils.currentTheme = theme;
    LogHelper.log(`[MyIOUtils] RFC-0139: Theme changed to ${theme}`);

    // Emit event to notify all theme-aware components (MENU, etc.)
    window.dispatchEvent(
      new CustomEvent('myio:theme-changed', {
        detail: { theme },
      })
    );
  },

  /**
   * RFC-0139: Get current theme
   * @returns {'light' | 'dark'} Current theme
   */
  getTheme: () => {
    return window.MyIOUtils.currentTheme || 'light';
  },

  /**
   * RFC-0139: Toggle theme between light and dark
   * @returns {'light' | 'dark'} New theme after toggle
   */
  toggleTheme: () => {
    const newTheme = window.MyIOUtils.currentTheme === 'dark' ? 'light' : 'dark';
    window.MyIOUtils.setTheme(newTheme);
    return newTheme;
  },

  // RFC-0108: Measurement display settings (units, decimal places)
  // Default values - can be overridden by user via MeasurementSetupModal
  measurementSettings: {
    water: { unit: 'm3', decimalPlaces: 3, autoScale: true },
    energy: { unit: 'auto', decimalPlaces: 3, forceUnit: false },
    temperature: { unit: 'celsius', decimalPlaces: 1 },
  },

  /**
   * RFC-0108: Format a number with Brazilian locale (1.234,56)
   * @param {number} value - The number to format
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted number string
   */
  formatNumberBR: (value, decimals = 2) => {
    const parts = value.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decimals > 0 ? parts.join(',') : parts[0];
  },

  /**
   * RFC-0108: Format energy value based on measurement settings
   * @param {number} valueKwh - Energy value in kWh
   * @returns {string} Formatted value with unit (e.g., "1.234,567 kWh" or "1,234 MWh")
   */
  formatEnergyWithSettings: (valueKwh) => {
    const settings = window.MyIOUtils?.measurementSettings?.energy || {
      unit: 'auto',
      decimalPlaces: 3,
      forceUnit: false,
    };
    const formatNum = window.MyIOUtils?.formatNumberBR || ((v, d) => v.toFixed(d));

    let displayValue = valueKwh;
    let unit = 'kWh';

    if (settings.unit === 'mwh') {
      displayValue = valueKwh / 1000;
      unit = 'MWh';
    } else if (settings.unit === 'auto' && !settings.forceUnit && valueKwh >= 1000) {
      displayValue = valueKwh / 1000;
      unit = 'MWh';
    }

    return `${formatNum(displayValue, settings.decimalPlaces)} ${unit}`;
  },

  /**
   * RFC-0108: Format water value based on measurement settings
   * @param {number} valueM3 - Water volume in cubic meters
   * @returns {string} Formatted value with unit (e.g., "1.234,567 m³" or "1.234.567,000 L")
   */
  formatWaterWithSettings: (valueM3) => {
    const settings = window.MyIOUtils?.measurementSettings?.water || {
      unit: 'm3',
      decimalPlaces: 3,
      autoScale: true,
    };
    const formatNum = window.MyIOUtils?.formatNumberBR || ((v, d) => v.toFixed(d));

    let displayValue = valueM3;
    let unit = 'm³';

    if (settings.unit === 'liters') {
      displayValue = valueM3 * 1000;
      unit = 'L';
    }

    return `${formatNum(displayValue, settings.decimalPlaces)} ${unit}`;
  },

  /**
   * RFC-0108: Format temperature value based on measurement settings
   * @param {number} valueCelsius - Temperature in Celsius
   * @returns {string} Formatted value with unit (e.g., "23,5 °C" or "74,3 °F")
   */
  formatTemperatureWithSettings: (valueCelsius) => {
    const settings = window.MyIOUtils?.measurementSettings?.temperature || {
      unit: 'celsius',
      decimalPlaces: 1,
    };
    const formatNum = window.MyIOUtils?.formatNumberBR || ((v, d) => v.toFixed(d));

    let displayValue = valueCelsius;
    let unit = '°C';

    if (settings.unit === 'fahrenheit') {
      displayValue = (valueCelsius * 9) / 5 + 32;
      unit = '°F';
    }

    return `${formatNum(displayValue, settings.decimalPlaces)} ${unit}`;
  },

  /**
   * RFC-0108: Update measurement settings (called by MENU after modal save)
   * @param {object} newSettings - New measurement settings object
   */
  updateMeasurementSettings: (newSettings) => {
    if (newSettings) {
      if (newSettings.water) window.MyIOUtils.measurementSettings.water = newSettings.water;
      if (newSettings.energy) window.MyIOUtils.measurementSettings.energy = newSettings.energy;
      if (newSettings.temperature) window.MyIOUtils.measurementSettings.temperature = newSettings.temperature;
      LogHelper.log(
        '[MyIOUtils] RFC-0108: Measurement settings updated:',
        window.MyIOUtils.measurementSettings
      );
    }
  },

  // RFC-0130: Delay time settings for connection status by device type
  // Populated from widget settings in onInit
  delayTimeSettings: {
    stores: 86400, // 60 days for energy stores (3F_MEDIDOR)
    equipment: 1440, // 24h for energy equipment (non-3F_MEDIDOR)
    water: 2880, // 48h for water devices (HIDROMETRO*)
    temperature: 1440, // 24h for temperature devices (TERMOSTATO*)
  },

  /**
   * RFC-0130: Get delay time in minutes based on device profile
   * @param {string} deviceProfile - Device profile (e.g., '3F_MEDIDOR', 'HIDROMETRO', 'TERMOSTATO')
   * @returns {number} Delay time in minutes
   */
  getDelayTimeConnectionInMins: (deviceProfile) => {
    const profile = (deviceProfile || '').toUpperCase();
    const settings = window.MyIOUtils?.delayTimeSettings || {};

    // Temperature devices
    if (profile.includes('TERMOSTATO') || profile.includes('TEMPERATURE')) {
      return settings.temperature ?? 1440; // 24h default
    }

    // Water devices
    if (profile.includes('HIDROMETRO') || profile.includes('TANK') || profile.includes('CAIXA')) {
      return settings.water ?? 2880; // 48h default
    }

    // Energy devices - check if store (3F_MEDIDOR) or equipment
    if (profile === '3F_MEDIDOR') {
      return settings.stores ?? 86400; // 60 days for stores
    }

    // Energy equipment (CHILLER, FANCOIL, ELEVADOR, ESCADA_ROLANTE, MOTOR, etc.)
    return settings.equipment ?? 1440; // 24h default
  },

  /**
   * RFC-0130: Update delay time settings (called from onInit with widget settings)
   * @param {object} newSettings - New delay time settings
   */
  updateDelayTimeSettings: (newSettings) => {
    if (newSettings) {
      const settings = window.MyIOUtils.delayTimeSettings;
      if (newSettings.stores !== undefined) settings.stores = newSettings.stores;
      if (newSettings.equipment !== undefined) settings.equipment = newSettings.equipment;
      if (newSettings.water !== undefined) settings.water = newSettings.water;
      if (newSettings.temperature !== undefined) settings.temperature = newSettings.temperature;
      LogHelper.log('[MyIOUtils] RFC-0130: Delay time settings updated:', settings);
    }
  },

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
      MyIOToast.error('Sessão expirada. Recarregando página...', 6000);
    } else {
      console.error('[MyIOUtils] Sessão expirada. Recarregando página...');
    }

    // Reload page after toast displays
    setTimeout(() => {
      window.location.reload();
    }, 6000);
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

    // Stop retry loop after final error for this domain
    window._dataLoadRetryLocked = window._dataLoadRetryLocked || {};
    if (window._dataLoadRetryLocked[domain]) {
      return;
    }

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

    const maxRetries = RETRY_CONFIG.maxRetries;
    const intervalMs = RETRY_CONFIG.intervalMs;

    if (retryCount < maxRetries) {
      // Increment retry counter
      window._dataLoadRetryAttempts[domain] = retryCount + 1;

      const MyIOToast = window.MyIOLibrary?.MyIOToast;
      const retryMessage = `Tentativa ${retryCount + 1}/${maxRetries}: Recarregando dados (${domain})...`;

      LogHelper.warn(`[MyIOUtils] Retry ${retryCount + 1}/${maxRetries} for ${domain}`);

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
      }, intervalMs);

      return; // Don't reload yet - wait for retry
    }

    // Max retries exceeded - must reload
    LogHelper.error(`[MyIOUtils] Max retries (${maxRetries}) exceeded for ${domain} - reloading page`);

    // Lock retries for this domain to avoid looping after error
    window._dataLoadRetryLocked[domain] = true;

    const MyIOToast = window.MyIOLibrary?.MyIOToast;
    const message = `Erro ao carregar dados (${domain}). Recarregue a página...`;

    if (MyIOToast) {
      MyIOToast.error(message, 8000);
    } else {
      console.error(`[MyIOUtils] ${message}`);
      // Fallback: show alert if toast not available
      window.alert(message);
    }

    // Reload page after toast displays
    //setTimeout(() => {
    //window.location.reload();
    //}, 6000);
  },

  /**
   * RFC-0097: Fetch energy consumption for a specific day/period
   * Used by ENERGY widget for chart data
   * @param {string} customerId - Customer ID
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
      const url = new URL(`${DATA_API_HOST}/api/v1/telemetry/customers/${customerId}/energy/devices/totals`);
      url.searchParams.set('startTime', startISO);
      url.searchParams.set('endTime', endISO);
      url.searchParams.set('deep', '1');
      if (granularity) {
        url.searchParams.set('granularity', granularity);
      }

      LogHelper.log(`[MyIOUtils] fetchEnergyDayConsumption: ${url.toString()}`);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.MyIOUtils?.handleUnauthorizedError('fetchEnergyDayConsumption');
        }
        throw new Error(`API error: ${res.status}`);
      }

      const json = await res.json();
      LogHelper.log(`[MyIOUtils] fetchEnergyDayConsumption: Got ${json?.length || 0} devices`);
      return json;
    } catch (error) {
      LogHelper.error('[MyIOUtils] fetchEnergyDayConsumption error:', error);
      return [];
    }
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
  enableAnnotationsOnboarding: false, // RFC-0144: Enable/disable annotations onboarding in settings modal
  enableReportButton: false, // Enable/disable Report button in HEADER (default: disabled)
};

// Exclusão de Grupos: group exclusion config loaded from CUSTOMER SERVER_SCOPE via SettingsModal
// { enabled: boolean, groups: { entrada, lojas, climatizacao, elevadores, escadas_rolantes, outros, area_comum } }
let _excludeGroupsTotals = null;

/**
 * Normalize legacy excludedGroups format to the current groups-object format.
 * Legacy: { enabled, excludedGroups: ["entrada", "esc_rolantes", ...] }
 * Current: { enabled, groups: { entrada: true, lojas: false, ... } }
 */
function normalizeExcludeGroupsTotals(raw) {
  if (!raw || raw.enabled === undefined) return null;
  if (raw.groups && typeof raw.groups === 'object') return raw;
  if (Array.isArray(raw.excludedGroups)) {
    const ALL_KEYS = [
      'entrada',
      'lojas',
      'climatizacao',
      'elevadores',
      'escadas_rolantes',
      'outros',
      'area_comum',
    ];
    const keyMap = { esc_rolantes: 'escadas_rolantes' };
    const excludedSet = new Set(raw.excludedGroups.map((g) => keyMap[g] ?? g));
    const groups = {};
    for (const k of ALL_KEYS) groups[k] = excludedSet.has(k);
    return { enabled: raw.enabled, groups };
  }
  return raw;
}

// Config object (populated in onInit from widgetSettings)
let config = null;

// RFC-0111: Added throttle to max 15 calls
let _onDataUpdatedCallCount = 0;

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

/**
 * RFC-0142: Patterns that indicate device should be hidden (ocultos)
 * These devices are archived, inactive, or have no data
 */
const OCULTOS_PATTERNS = ['ARQUIVADO', 'SEM_DADOS', 'DESATIVADO', 'REMOVIDO', 'INATIVO'];

/**
 * RFC-0142: Check if device should be classified as "ocultos" (hidden)
 * Devices with these patterns in deviceProfile should go to a separate hidden group:
 * - ARQUIVADO (archived devices)
 * - SEM_DADOS (devices without data)
 * - DESATIVADO (deactivated devices)
 * - REMOVIDO (removed devices)
 * - INATIVO (inactive devices)
 *
 * @param {Object|string} itemOrDeviceProfile - Device item with deviceProfile property, or deviceProfile string directly
 * @returns {boolean} True if device should be in the "ocultos" group
 */
function isOcultosDevice(itemOrDeviceProfile) {
  let deviceProfile;

  if (typeof itemOrDeviceProfile === 'string') {
    deviceProfile = itemOrDeviceProfile;
  } else if (itemOrDeviceProfile && typeof itemOrDeviceProfile === 'object') {
    deviceProfile = itemOrDeviceProfile.deviceProfile;
  } else {
    return false;
  }

  const profile = String(deviceProfile || '').toUpperCase();

  for (const pattern of OCULTOS_PATTERNS) {
    if (profile.includes(pattern)) {
      return true;
    }
  }

  return false;
}

// RFC-0142: Alias for backwards compatibility
const shouldExcludeDevice = isOcultosDevice;

/**
 * RFC-0106: Check if device is a store (loja)
 * Centralized logic: deviceProfile === '3F_MEDIDOR'
 *
 * @param {Object|string} itemOrDeviceProfile - Device item with deviceProfile property, or deviceProfile string directly
 * @returns {boolean} True if device is a store
 */
function isStoreDevice(itemOrDeviceProfile) {
  let deviceProfile;

  if (typeof itemOrDeviceProfile === 'string') {
    deviceProfile = itemOrDeviceProfile;
  } else if (itemOrDeviceProfile && typeof itemOrDeviceProfile === 'object') {
    deviceProfile = itemOrDeviceProfile.deviceProfile;
  } else {
    return false;
  }

  return String(deviceProfile || '').toUpperCase() === '3F_MEDIDOR';
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

  const deviceProfile = String(item.deviceProfile || '').toUpperCase();

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
 * RFC-0142: 0. OCULTOS - archived/inactive devices go to hidden group
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
  // RFC-0142: RULE 0 - Classify archived/inactive devices as "Ocultos"
  if (isOcultosDevice(row)) {
    return 'Ocultos';
  }

  // First try groupType from API (takes precedence)
  const groupType = row.groupType || row.group_type || '';
  if (groupType) {
    return groupType;
  }

  // Get deviceType and deviceProfile from ThingsBoard datasource
  const deviceType = String(row.deviceType || '').toUpperCase();
  const deviceProfile = String(row.deviceProfile || '').toUpperCase();

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

  // ==========================================================================
  // RFC-0108 FIX: Water domain - HIDROMETRO_SHOPPING and HIDROMETRO_AREA_COMUM
  // Must be checked BEFORE generic HIDROMETRO pattern in AREA_COMUM_PATTERNS
  // ==========================================================================
  if (deviceType.includes('HIDROMETRO_SHOPPING') || deviceProfile.includes('HIDROMETRO_SHOPPING')) {
    return 'Entrada';
  }
  if (deviceType.includes('HIDROMETRO_AREA_COMUM') || deviceProfile.includes('HIDROMETRO_AREA_COMUM')) {
    return 'Área Comum';
  }
  // Generic HIDROMETRO (without specific profile) → Lojas (for water domain)
  if (deviceType === 'HIDROMETRO' && (deviceProfile === 'HIDROMETRO' || !deviceProfile)) {
    return 'Lojas';
  }

  // Área Comum: BOMBA, MOTOR, RELOGIO, etc (but NOT generic HIDROMETRO)
  const AREA_COMUM_PATTERNS = [
    'BOMBA',
    'MOTOR',
    'RELOGIO',
    // 'HIDROMETRO', - REMOVED: Now handled specifically above
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
  // RFC-0142: Expose ocultos detection for child widgets
  OCULTOS_PATTERNS,
  isOcultosDevice,
  shouldExcludeDevice, // Alias for backwards compatibility
  isStoreDevice,
  classifyDevice,
  classifyDeviceByDeviceType,
  classifyDeviceByIdentifier,
  categoryToLabelWidget,
  inferLabelWidget,
  EQUIPMENT_EXCLUSION_PATTERN,
  // RFC-0182: Expose categorization helpers so MENU/TELEMETRY can split items by group
  categorizeItemsByGroup,
  categorizeItemsByGroupWater,
  categorizeItemsByGroupTemperature,
});

// ============================================================================
// End RFC-0106: Device Classification
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

    // RFC-0108: Listen for measurement settings updates from MENU
    on(window, 'myio:measurement-settings-updated', (ev) => {
      const settings = ev?.detail;
      if (settings) {
        // Update MyIOUtils shared settings
        if (window.MyIOUtils?.updateMeasurementSettings) {
          window.MyIOUtils.updateMeasurementSettings(settings);
        }
        // Also store in orchestrator for persistence
        if (window.MyIOOrchestrator) {
          window.MyIOOrchestrator.measurementDisplaySettings = settings;
        }
        LogHelper.log('[MAIN_VIEW] RFC-0108: Measurement settings updated:', settings);
      }
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
  // RFC-0171: Also stores currentUserEmail for use in modals (openDashboardPopupSettings)
  // RFC-0152: currentUserEmail is also used as the annotation author in alarm annotation panels
  // SuperAdmin = user with @myio.com.br email EXCEPT alarme@myio.com.br or alarmes@myio.com.br
  async function detectSuperAdmin() {
    const jwt = localStorage.getItem('jwt_token');
    if (!jwt) {
      window.MyIOUtils.SuperAdmin = false;
      window.MyIOUtils.currentUserEmail = null;
      LogHelper.log('[MAIN_VIEW] SuperAdmin: false (no JWT token)');
      return;
    }

    try {
      const tbBase = self.ctx?.settings?.tbBaseUrl || '';
      const response = await fetch(`${tbBase}/api/auth/user`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': `Bearer ${jwt}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        window.MyIOUtils.SuperAdmin = false;
        window.MyIOUtils.currentUserEmail = null;
        LogHelper.warn('[MAIN_VIEW] SuperAdmin: false (API error:', response.status, ')');
        return;
      }

      const user = await response.json();
      const email = (user.email || '').toLowerCase().trim();

      // RFC-0171: Store email for use in modals
      window.MyIOUtils.currentUserEmail = email;

      // Check: email ends with @myio.com.br AND is NOT alarme@ or alarmes@
      const isSuperAdmin =
        email.endsWith('@myio.com.br') && !email.startsWith('alarme@') && !email.startsWith('alarmes@');

      window.MyIOUtils.SuperAdmin = isSuperAdmin;
      LogHelper.log(`[MAIN_VIEW] SuperAdmin detection: ${email} -> ${isSuperAdmin}`);

      // RFC-0171: Dispatch event for other widgets (MENU, etc.)
      window.dispatchEvent(
        new CustomEvent('myio:user-info-ready', {
          detail: {
            email: email,
            isSuperAdmin: isSuperAdmin,
            ts: Date.now(),
          },
        })
      );
    } catch (err) {
      LogHelper.error('[MAIN_VIEW] SuperAdmin detection failed:', err);
      window.MyIOUtils.SuperAdmin = false;
      window.MyIOUtils.currentUserEmail = null;
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

    // RFC-0130: Expose customerTB_ID globally immediately for periodKey function
    window.__myioCustomerTB_ID = customerTB_ID;

    // Triple-check: Validate that cached data belongs to current shopping
    // If shopping changed, clear all cached data to prevent stale data display
    const shoppingChanged = window.STATE?.validateCustomer?.(customerTB_ID);
    if (shoppingChanged) {
      LogHelper.warn('[Orchestrator] 🔄 Shopping changed - cache cleared, will reload all data');
    }

    // RFC-0085: Expose customerTB_ID globally for MENU and other widgets
    if (window.MyIOOrchestrator) {
      window.MyIOOrchestrator.customerTB_ID = customerTB_ID;
    }

    // RFC-0178: alarmsApiBaseUrl from settings (URL config); alarms auth uses gcdrApiKey (SERVER_SCOPE)
    const alarmsApiBaseUrl = self.ctx.settings?.alarmsApiBaseUrl || 'https://alarms-api.a.myio-bas.com';
    if (window.MyIOOrchestrator) {
      window.MyIOOrchestrator.alarmsApiBaseUrl = alarmsApiBaseUrl;
    }
    LogHelper.log('[Orchestrator] RFC-0178: alarmsApiBaseUrl:', alarmsApiBaseUrl);

    widgetSettings.debugMode = self.ctx.settings?.debugMode ?? false;
    widgetSettings.domainsEnabled = self.ctx.settings?.domainsEnabled ?? {
      energy: true,
      water: true,
      temperature: true,
    };
    widgetSettings.excludeDevicesAtCountSubtotalCAG =
      self.ctx.settings?.excludeDevicesAtCountSubtotalCAG ?? [];

    // RFC-0188: Short delay threshold (minutes) to rescue offline devices with recent telemetry
    SHORT_DELAY_IN_MINS_TO_BYPASS_OFFLINE_STATUS =
      self.ctx.settings?.shortDelayMinsToBypassOfflineStatus ?? 60;
    widgetSettings.shortDelayMinsToBypassOfflineStatus = SHORT_DELAY_IN_MINS_TO_BYPASS_OFFLINE_STATUS;
    LogHelper.log(
      '[Orchestrator] RFC-0188: shortDelayMinsToBypassOfflineStatus:',
      SHORT_DELAY_IN_MINS_TO_BYPASS_OFFLINE_STATUS
    );

    // RFC-0189: Temperature API fetch for offline detection + modal data source
    widgetSettings.enableTemperatureApiDataFetch = self.ctx.settings?.enableTemperatureApiDataFetch ?? false;
    // Expose via window.MyIOUtils for TELEMETRY widget (modal data source)
    window.MyIOUtils.enableTemperatureApiDataFetch = widgetSettings.enableTemperatureApiDataFetch;

    // RFC-0152: Device data export to console (TB↔GCDR mapping audit)
    widgetSettings.enableDeviceDataExport = self.ctx.settings?.enableDeviceDataExport ?? false;
    window.MyIOUtils.enableDeviceDataExport = widgetSettings.enableDeviceDataExport;
    LogHelper.log('[Orchestrator] RFC-0152: enableDeviceDataExport:', widgetSettings.enableDeviceDataExport);

    // RFC-0144: Load annotations onboarding setting
    widgetSettings.enableAnnotationsOnboarding = self.ctx.settings?.enableAnnotationsOnboarding ?? false;
    // Expose via window.MyIOUtils for TELEMETRY widget
    window.MyIOUtils.enableAnnotationsOnboarding = widgetSettings.enableAnnotationsOnboarding;
    LogHelper.log(
      '[Orchestrator] RFC-0144: enableAnnotationsOnboarding:',
      widgetSettings.enableAnnotationsOnboarding
    );

    // Load enableReportButton setting and expose via window.MyIOUtils for HEADER widget
    widgetSettings.enableReportButton = self.ctx.settings?.enableReportButton ?? false;
    window.MyIOUtils.enableReportButton = widgetSettings.enableReportButton;
    LogHelper.log('[Orchestrator] enableReportButton:', widgetSettings.enableReportButton);

    // RFC-0182: Load enabledReportItems and expose for MENU widget
    const rawItems = self.ctx.settings?.enabledReportItems || {};
    const REPORT_ITEM_DEFAULTS = {
      energy_lojas: true,
      energy_entrada: false,
      energy_area_comum: false,
      energy_todos: false,
      water_lojas: false,
      water_entrada: false,
      water_area_comum: false,
      water_todos: false,
      temperature_climatizavel: false,
      temperature_nao_climatizavel: false,
      temperature_todos: false,
      alarms_por_dispositivo: false,
      alarms_dispositivo_x_alarme: false,
      alarms_por_tipo: false,
    };
    window.MyIOUtils.enabledReportItems = Object.fromEntries(
      Object.entries(REPORT_ITEM_DEFAULTS).map(([k, def]) => [k, rawItems[k] ?? def])
    );
    LogHelper.log('[Orchestrator] RFC-0182: enabledReportItems:', window.MyIOUtils.enabledReportItems);

    // RFC-0130: Load delay time settings from widget settings
    const delaySettings = {
      stores: self.ctx.settings?.delayTimeConnectionInMinsToStore ?? 86400, // 60 days default
      equipment: self.ctx.settings?.delayTimeConnectionInMinsToEquipment ?? 1440, // 24h default
      water: self.ctx.settings?.delayTimeConnectionInMinsToWater ?? 2880, // 48h default
      temperature: self.ctx.settings?.delayTimeConnectionInMinsToTemperature ?? 1440, // 24h default
    };
    window.MyIOUtils?.updateDelayTimeSettings?.(delaySettings);
    LogHelper.log('[Orchestrator] RFC-0130: Delay time settings loaded:', delaySettings);

    LogHelper.log('[Orchestrator] 📋 Widget settings captured:', {
      customerTB_ID: widgetSettings.customerTB_ID,
      debugMode: widgetSettings.debugMode,
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

    // Resetar mapas de enriquecimento a cada onInit para evitar contaminação cross-customer.
    // O guard abaixo cria o objeto apenas uma vez, mas os mapas acumulam entre reloads sem esse reset.
    if (window.MyIOOrchestrator) {
      window.MyIOOrchestrator.gcdrDeviceNameMap = new Map();
      window.MyIOOrchestrator.entityNameToLabelMap = new Map();
      // RFC-0194: reset to avoid stale config when switching customers
      window.MyIOOrchestrator.defaultDashboardId = null;
      window.MyIOOrchestrator.defaultDashboardCfg = null;
    }
    // RFC-0193: Resetar estado de alarmes a cada onInit — evita dados do customer anterior
    // aparecerem no badge/tooltip/toasts até o novo fetch retornar.
    _lastKnownAlarmIds = null;
    _lastKnownAlarmMap = null;
    _alarmDayMap = new Map();
    if (window.MyIOOrchestrator?.alarmDayMap) {
      // Zera o mapa exposto publicamente para badge e tooltip não mostrarem dados velhos
      window.MyIOOrchestrator.alarmDayMap = {
        listAll: () => [],
        listByStatus: () => [],
        add: () => {},
        remove: () => {},
        count: () => 0,
      };
    }

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

        // RFC-0178: Alarms API base URL (for ALARM widget)
        alarmsApiBaseUrl: null,

        // RFC-0108: Measurement display settings (units, decimal places)
        // Populated by MENU when user opens MeasurementSetupModal
        measurementDisplaySettings: null,

        // Data access methods (will be populated later)
        getCurrentPeriod: () => null,
        getCredentials: () => null,

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

        // RFC-0180: GCDR API method stubs (replaced by real impl after merge)
        gcdrFetchCustomerRules: async () => {
          LogHelper.warn('[Orchestrator] ⚠️ gcdrFetchCustomerRules called before orchestrator is ready');
          return [];
        },
        gcdrPostAlarmAction: async () => {
          LogHelper.warn('[Orchestrator] ⚠️ gcdrPostAlarmAction called before orchestrator is ready');
          return false;
        },
        gcdrPatchRuleScope: async () => {
          LogHelper.warn('[Orchestrator] ⚠️ gcdrPatchRuleScope called before orchestrator is ready');
          return false;
        },
        gcdrPatchRuleValue: async () => {
          LogHelper.warn('[Orchestrator] ⚠️ gcdrPatchRuleValue called before orchestrator is ready');
          return false;
        },
        gcdrEnqueueCloseAlarms: async () => {
          LogHelper.warn('[Orchestrator] ⚠️ gcdrEnqueueCloseAlarms called before orchestrator is ready');
          return false;
        }, // RFC-0191

        // RFC-0194: customer default dashboard (populated after SERVER_SCOPE fetch)
        defaultDashboardId: null,
        defaultDashboardCfg: null,

        // Internal state (will be populated later)
        inFlight: {},
      };

      LogHelper.log('[Orchestrator] ⚡ Exposed to window.MyIOOrchestrator EARLY (stub mode)');
    }

    registerGlobalEvents();
    setupResizeObserver();

    // RFC-XXXX: Detect SuperAdmin early (async, non-blocking)
    detectSuperAdmin();

    // Determine the initial tab to dispatch — use the first enabled domain so that
    // water-only / temperature-only dashboards don't trigger an energy retry-loop.
    const _initialTab =
      widgetSettings.domainsEnabled?.energy !== false
        ? 'energy'
        : widgetSettings.domainsEnabled?.water !== false
          ? 'water'
          : widgetSettings.domainsEnabled?.temperature !== false
            ? 'temperature'
            : 'energy';
    LogHelper.log('[MAIN_VIEW] Initial tab derived from domainsEnabled:', _initialTab);

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

        // RFC-0180: GCDR IDs and API keys — exclusively from TB SERVER_SCOPE attrs (see attrs block below)
        let gcdrCustomerId = '';
        let gcdrTenantId = '';
        let gcdrApiKey = '';
        let alarmNotificationsEnabled = true; // RFC-0193: default enabled; read from SERVER_SCOPE below
        let defaultDashboardCfg = null; // RFC-0194: CustomerDefaultDashboard from SERVER_SCOPE
        const gcdrApiBaseUrl = self.ctx.settings?.gcdrApiBaseUrl || 'https://gcdr-api.a.myio-bas.com';

        if (customerTB_ID && jwt) {
          try {
            LogHelper.log('[MAIN_VIEW] 📡 Fetching customer attributes from ThingsBoard...');
            // Fetch customer attributes
            const tbBase = self.ctx?.settings?.tbBaseUrl || '';
            const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt, tbBase);

            LogHelper.log('[MAIN_VIEW] 📦 Received attrs:', attrs);

            CLIENT_ID = attrs?.client_id || '';
            CLIENT_SECRET = attrs?.client_secret || '';
            CUSTOMER_ING_ID = attrs?.ingestionId || '';

            // RFC-0180: GCDR IDs and API keys from SERVER_SCOPE attrs (single source of truth)
            gcdrCustomerId = attrs?.gcdrCustomerId || '';
            gcdrTenantId = attrs?.gcdrTenantId || '';
            gcdrApiKey = attrs?.gcdrApiKey || '';
            // RFC-0193: read alarm notifications toggle from SERVER_SCOPE (undefined → enabled)
            alarmNotificationsEnabled = attrs?.alarmNotificationsEnabled !== false;
            // RFC-0194: customer default dashboard config (full object stored for management UI)
            defaultDashboardCfg = attrs?.customerDefaultDashboard || null;

            // Exclusão de Grupos: read from CUSTOMER SERVER_SCOPE (saved by SettingsModal)
            const _rawExcludeGroups = attrs?.exclude_groups_totals;
            if (_rawExcludeGroups) {
              const _parsed =
                typeof _rawExcludeGroups === 'string' ? JSON.parse(_rawExcludeGroups) : _rawExcludeGroups;
              _excludeGroupsTotals = normalizeExcludeGroupsTotals(_parsed);
              LogHelper.log('[MAIN_VIEW] exclude_groups_totals loaded:', _excludeGroupsTotals);
            }

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

        // RFC-0180: Publish GCDR identifiers + API keys to orchestrator for ALARM and SETTINGS widgets
        if (window.MyIOOrchestrator) {
          window.MyIOOrchestrator.gcdrCustomerId = gcdrCustomerId;
          window.MyIOOrchestrator.gcdrTenantId = gcdrTenantId;
          window.MyIOOrchestrator.gcdrApiBaseUrl = gcdrApiBaseUrl;
          window.MyIOOrchestrator.gcdrApiKey = gcdrApiKey;
          // true only when both customerId and apiKey are present — used by tooltip/modal to gate alarm UI
          window.MyIOOrchestrator.alarmsConfigured = !!(gcdrCustomerId && gcdrApiKey);
          // RFC-0193: alarm notifications toggle — default true (undefined treated as enabled)
          window.MyIOOrchestrator.alarmNotificationsEnabled = alarmNotificationsEnabled;
          // RFC-0194: stable default dashboard ID + full config for management UI
          window.MyIOOrchestrator.defaultDashboardId = defaultDashboardCfg?.dashboardId ?? null;
          window.MyIOOrchestrator.defaultDashboardCfg = defaultDashboardCfg;
        }
        if (!gcdrApiKey)
          LogHelper.warn('[MAIN_VIEW] gcdrApiKey não encontrado nos atributos SERVER_SCOPE do customer.');
        LogHelper.log('[MAIN_VIEW] RFC-0180: gcdrCustomerId:', gcdrCustomerId || '(empty)');
        LogHelper.log('[MAIN_VIEW] RFC-0180: gcdrTenantId:', gcdrTenantId || '(empty)');
        LogHelper.log('[MAIN_VIEW] RFC-0180: gcdrApiKey:', gcdrApiKey ? '✅ set' : '❌ empty');

        // RFC-0180: Pre-fetch all customer alarms (non-blocking) so AlarmsTab can use them
        // without a per-device fetch when the Settings modal is opened.
        if (gcdrCustomerId) {
          _prefetchCustomerAlarms(
            gcdrCustomerId,
            gcdrTenantId,
            window.MyIOOrchestrator?.alarmsApiBaseUrl || 'https://alarms-api.a.myio-bas.com'
          );
          _fetchAlarmDayMap(); // RFC-0193: populate today's alarm history map (all states)
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
            `[MAIN_VIEW] Will dispatch initial tab event for default state: ${_initialTab} after 100ms delay...`
          );
          setTimeout(() => {
            LogHelper.log(
              `[MAIN_VIEW] Dispatching initial tab event for default state: ${_initialTab} (no credentials)`
            );
            window.dispatchEvent(
              new CustomEvent('myio:dashboard-state', {
                detail: { tab: _initialTab },
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
            dataApiHost: 'https://api.data.apps.myio-bas.com',
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
            `[MAIN_VIEW] Will dispatch initial tab event for default state: ${_initialTab} after 100ms delay...`
          );
          setTimeout(() => {
            LogHelper.log(
              `[MAIN_VIEW] Dispatching initial tab event for default state: ${_initialTab} (after credentials + delay)`
            );
            window.dispatchEvent(
              new CustomEvent('myio:dashboard-state', {
                detail: { tab: _initialTab },
              })
            );
          }, 100);
        }
      } catch (err) {
        LogHelper.error('[MAIN_VIEW] Auth initialization failed:', err);

        // RFC-0054 FIX: Dispatch initial tab event even on error (with delay)
        // This enables HEADER controls, even though data fetch will fail
        LogHelper.log(
          `[MAIN_VIEW] Will dispatch initial tab event for default state: ${_initialTab} after 100ms delay...`
        );
        setTimeout(() => {
          LogHelper.log(
            `[MAIN_VIEW] Dispatching initial tab event for default state: ${_initialTab} (after error)`
          );
          window.dispatchEvent(
            new CustomEvent('myio:dashboard-state', {
              detail: { tab: _initialTab },
            })
          );
        }, 100);
      }
    } else {
      LogHelper.warn('[MAIN_VIEW] MyIOLibrary not available');

      // RFC-0054 FIX: Dispatch initial tab event even without MyIOLibrary (with delay)
      // This enables HEADER controls, even though data fetch will fail
      LogHelper.log(
        `[MAIN_VIEW] Will dispatch initial tab event for default state: ${_initialTab} after 100ms delay...`
      );
      setTimeout(() => {
        LogHelper.log(
          `[MAIN_VIEW] Dispatching initial tab event for default state: ${_initialTab} (no MyIOLibrary)`
        );
        window.dispatchEvent(
          new CustomEvent('myio:dashboard-state', {
            detail: { tab: _initialTab },
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

    // RFC-0111: Limit calls to handle captured attributes
    if (_onDataUpdatedCallCount >= RETRY_CONFIG.maxRetries) {
      return;
    }
    _onDataUpdatedCallCount++;

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

      if (keyName === 'temperatureclampmin' && rawValue !== undefined && rawValue !== null) {
        const val = Number(rawValue);
        if (!isNaN(val)) {
          if (!window.MyIOUtils.temperatureClampRange) window.MyIOUtils.temperatureClampRange = {};
          window.MyIOUtils.temperatureClampRange.min = val;
          LogHelper.log(`[MAIN_VIEW] Exposed temperatureClampMin from customer: ${val}`);
        }
      }

      if (keyName === 'temperatureclampmax' && rawValue !== undefined && rawValue !== null) {
        const val = Number(rawValue);
        if (!isNaN(val)) {
          if (!window.MyIOUtils.temperatureClampRange) window.MyIOUtils.temperatureClampRange = {};
          window.MyIOUtils.temperatureClampRange.max = val;
          LogHelper.log(`[MAIN_VIEW] Exposed temperatureClampMax from customer: ${val}`);
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

    // RFC-0179: Build enrichment maps for ALARM widget device name resolution.
    if (window.MyIOOrchestrator) {
      // Map 1: gcdrDeviceId (UUID) → human-readable label
      // Also indexed by short code "gcdr:<first8>" for old alarm format.
      const gcdrMap =
        window.MyIOOrchestrator.gcdrDeviceNameMap instanceof Map
          ? window.MyIOOrchestrator.gcdrDeviceNameMap
          : new Map();

      // Map 2: TB entityName ("3F SCMOXUARAAC_EL7_L2") → entityLabel ("Elevador 7 L2")
      // Built from ALL datasource rows — no specific datakey needed.
      const nameMap =
        window.MyIOOrchestrator.entityNameToLabelMap instanceof Map
          ? window.MyIOOrchestrator.entityNameToLabelMap
          : new Map();

      let gcdrChanged = false;
      let nameChanged = false;

      for (const row of ctxDataRows) {
        const entityName = row?.datasource?.entityName || '';
        const entityLabel = row?.datasource?.entityLabel || '';
        // Prefer entityLabel (human-readable) over entityName (raw TB name)
        const label = entityLabel || entityName;

        // Map 2: entityName → label (for any row that has both values different)
        if (entityName && label && entityName !== label && !nameMap.has(entityName)) {
          nameMap.set(entityName, label);
          nameChanged = true;
        }

        // Map 1: gcdrDeviceId rows only
        const keyName = (row?.dataKey?.name || '').toLowerCase();
        if (keyName !== 'gcdrdeviceid') continue;
        const gcdrId = row?.data?.[0]?.[1];
        if (!gcdrId || !label) continue;
        const gcdrKey = String(gcdrId);
        if (!gcdrMap.has(gcdrKey)) {
          gcdrMap.set(gcdrKey, label);
          // Also index by short code "gcdr:<first8>" for old-format alarm sources
          const shortCode = 'gcdr:' + gcdrKey.substring(0, 8);
          if (!gcdrMap.has(shortCode)) gcdrMap.set(shortCode, label);
          gcdrChanged = true;
        }
      }

      if (gcdrChanged) {
        window.MyIOOrchestrator.gcdrDeviceNameMap = gcdrMap;
        LogHelper.log(`[MAIN_VIEW] gcdrDeviceNameMap updated: ${gcdrMap.size} entries`);
      }
      if (nameChanged) {
        window.MyIOOrchestrator.entityNameToLabelMap = nameMap;
        LogHelper.log(`[MAIN_VIEW] entityNameToLabelMap updated: ${nameMap.size} entries`);
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
    _customerTB_ID: null, // Track current shopping to detect navigation

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

    /**
     * Triple-check: Validate that data belongs to current shopping
     * If customerTB_ID changed, clear all cached data
     * @param {string} customerTB_ID - Current shopping ID
     * @returns {boolean} true if data was cleared due to shopping change
     */
    validateCustomer(customerTB_ID) {
      if (!customerTB_ID) return false;

      if (this._customerTB_ID && this._customerTB_ID !== customerTB_ID) {
        // Shopping changed! Clear ALL cached data aggressively
        console.warn(
          `[STATE] 🔄 Shopping changed from ${this._customerTB_ID} to ${customerTB_ID} - CLEARING ALL CACHES`
        );

        // RFC-0130: Update global customerTB_ID immediately
        window.__myioCustomerTB_ID = customerTB_ID;

        // Clear window.STATE
        this.energy = null;
        this.water = null;
        this.temperature = null;
        this._lastUpdate = {};

        // HARD: Clear window.MyIOOrchestratorData completely
        if (window.MyIOOrchestratorData) {
          console.warn('[STATE] 🧹 Clearing window.MyIOOrchestratorData');
          delete window.MyIOOrchestratorData.energy;
          delete window.MyIOOrchestratorData.water;
          delete window.MyIOOrchestratorData.temperature;
        }

        // HARD: Clear CONTRACT_STATE
        if (window.CONTRACT_STATE) {
          console.warn('[STATE] 🧹 Resetting window.CONTRACT_STATE');
          window.CONTRACT_STATE.isLoaded = false;
          window.CONTRACT_STATE.isValid = false;
          window.CONTRACT_STATE.energy = { total: 0, entries: 0, commonArea: 0, stores: 0 };
          window.CONTRACT_STATE.water = { total: 0, entries: 0, commonArea: 0, stores: 0 };
          window.CONTRACT_STATE.temperature = { total: 0, internal: 0, stores: 0 };
        }

        // HARD: Dispatch clear event for all widgets
        ['energy', 'water', 'temperature'].forEach((domain) => {
          window.dispatchEvent(
            new CustomEvent('myio:telemetry:clear', {
              detail: {
                domain,
                reason: 'customer_changed',
                fromCustomer: this._customerTB_ID,
                toCustomer: customerTB_ID,
              },
            })
          );
        });

        this._customerTB_ID = customerTB_ID;
        return true; // Data was cleared
      }

      // First time or same shopping
      this._customerTB_ID = customerTB_ID;
      return false;
    },

    /**
     * Force clear all data (for manual refresh)
     */
    clearAll() {
      console.log('[STATE] 🧹 Clearing all cached data');
      this.energy = null;
      this.water = null;
      this.temperature = null;
      this._lastUpdate = {};

      // HARD: Also clear MyIOOrchestratorData
      if (window.MyIOOrchestratorData) {
        delete window.MyIOOrchestratorData.energy;
        delete window.MyIOOrchestratorData.water;
        delete window.MyIOOrchestratorData.temperature;
      }
      // Keep _customerTB_ID to avoid unnecessary reloads
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
// ── RFC-0192: New-alarm notification toast ────────────────────────────────
// ── RFC-0193: Closed-alarm notification toast ─────────────────────────────
// Tracks alarm IDs seen in the last ASO build so we can diff and surface only
// truly new alarms on subsequent refreshes (first load never notifies).
// _lastKnownAlarmMap also stores the full alarm objects so closed-alarm details
// (title, deviceName) can be shown in the closure toast.
let _lastKnownAlarmIds = null; // null = first load not yet done
let _lastKnownAlarmMap = null; // Map<id, alarm>
let _alarmNotificationTimer = null;
let _alarmClosedNotifTimer = null;
let _alarmDayMap = new Map(); // id → alarm (all states, today only — RFC-0193)

/**
 * Show a floating notification toast when new alarms are detected.
 * Managed entirely by MAIN_VIEW — no widget dependency.
 *
 * @param {Array} newAlarms - Array of new GCDRAlarm objects
 */
function _showNewAlarmNotification(newAlarms) {
  if (!newAlarms || newAlarms.length === 0) return;
  // RFC-0193: Respect notification toggle (default: enabled)
  if (window.MyIOOrchestrator?.alarmNotificationsEnabled === false) return;

  // Dismiss any existing notification
  const existing = document.getElementById('myio-alarm-notification');
  if (existing) existing.remove();
  if (_alarmNotificationTimer) {
    clearTimeout(_alarmNotificationTimer);
    _alarmNotificationTimer = null;
  }

  // Determine severity accent color (highest priority among new alarms)
  const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const SEVERITY_COLORS = { CRITICAL: '#dc2626', HIGH: '#f59e0b', MEDIUM: '#3b82f6', LOW: '#6b7280' };
  const topAlarm = [...newAlarms].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
  )[0];
  const accentColor = SEVERITY_COLORS[topAlarm?.severity] || '#f59e0b';

  const count = newAlarms.length;
  const label = count === 1 ? 'novo alarme detectado' : `novos alarmes detectados`;
  const firstTitle = topAlarm?.title || topAlarm?.alarmType || 'Alarme';
  const deviceName = topAlarm?.deviceName || '';

  const el = document.createElement('div');
  el.id = 'myio-alarm-notification';
  el.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    min-width: 365px;
    max-width: 468px;
    background: #1e293b;
    border-radius: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.45);
    border-left: 5px solid ${accentColor};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    animation: myio-notif-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both;
  `;

  el.innerHTML = `
    <style>
      @keyframes myio-notif-in {
        from { opacity: 0; transform: translateX(60px) scale(0.95); }
        to   { opacity: 1; transform: translateX(0)   scale(1);    }
      }
      @keyframes myio-notif-out {
        to { opacity: 0; transform: translateX(60px) scale(0.95); }
      }
      @keyframes myio-notif-bar {
        from { width: 100%; }
        to   { width: 0%;   }
      }
      #myio-alarm-notification .notif-body {
        display: flex; align-items: flex-start; gap: 13px; padding: 18px 18px 13px;
      }
      #myio-alarm-notification .notif-icon {
        font-size: 26px; flex-shrink: 0; line-height: 1.2;
      }
      #myio-alarm-notification .notif-content { flex: 1; min-width: 0; }
      #myio-alarm-notification .notif-device {
        font-size: 16px; font-weight: 700; color: #f1f5f9;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        margin-bottom: 3px;
      }
      #myio-alarm-notification .notif-count {
        font-size: 14px; font-weight: 700; color: ${accentColor}; margin-bottom: 2px;
      }
      #myio-alarm-notification .notif-title {
        font-size: 12px; font-weight: 500; color: #94a3b8;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #myio-alarm-notification .notif-close {
        background: none; border: none; color: #64748b; font-size: 21px;
        cursor: pointer; padding: 0 2px; line-height: 1; flex-shrink: 0;
        align-self: flex-start; transition: color 0.15s;
      }
      #myio-alarm-notification .notif-close:hover { color: #f1f5f9; }
      #myio-alarm-notification .notif-progress {
        height: 4px; background: ${accentColor}; opacity: 0.7;
        animation: myio-notif-bar 6s linear forwards;
      }
    </style>
    <div class="notif-body">
      <div class="notif-icon">🔔</div>
      <div class="notif-content">
        ${deviceName ? `<div class="notif-device">${deviceName}</div>` : ''}
        <div class="notif-count">${count} ${label}</div>
        <div class="notif-title">${firstTitle}</div>
      </div>
      <button class="notif-close" title="Fechar">✕</button>
    </div>
    <div class="notif-progress"></div>
  `;

  const dismiss = () => {
    el.style.animation = 'myio-notif-out 0.2s ease forwards';
    setTimeout(() => el.remove(), 200);
    if (_alarmNotificationTimer) {
      clearTimeout(_alarmNotificationTimer);
      _alarmNotificationTimer = null;
    }
  };

  el.querySelector('.notif-close').addEventListener('click', dismiss);
  document.body.appendChild(el);
  _alarmNotificationTimer = setTimeout(dismiss, 6000);
}
// ── RFC-0193: Closed-alarm notification toast ─────────────────────────────

/**
 * Show a floating notification toast when alarms disappear from the active queue
 * (i.e., they were resolved/closed since the last refresh cycle).
 *
 * @param {Array} closedAlarms - Array of GCDRAlarm objects no longer in the active list
 */
function _showClosedAlarmNotification(closedAlarms) {
  if (!closedAlarms || closedAlarms.length === 0) return;
  // RFC-0193: Respect notification toggle (default: enabled)
  if (window.MyIOOrchestrator?.alarmNotificationsEnabled === false) return;

  // Dismiss any existing closed-alarm notification
  const existing = document.getElementById('myio-alarm-closed-notification');
  if (existing) existing.remove();
  if (_alarmClosedNotifTimer) {
    clearTimeout(_alarmClosedNotifTimer);
    _alarmClosedNotifTimer = null;
  }

  // If a new-alarm toast is already visible, stack below it
  const newAlarmEl = document.getElementById('myio-alarm-notification');
  const topOffset = newAlarmEl ? newAlarmEl.offsetHeight + 28 : 20;

  const GREEN = '#10b981';
  const count = closedAlarms.length;
  const label = count === 1 ? 'alarme encerrado' : 'alarmes encerrados';
  // Use the first closed alarm for the detail line
  const topAlarm = closedAlarms[0];
  const firstTitle = topAlarm?.title || topAlarm?.alarmType || 'Alarme';
  const deviceName = topAlarm?.deviceName || '';

  const el = document.createElement('div');
  el.id = 'myio-alarm-closed-notification';
  el.style.cssText = `
    position: fixed;
    top: ${topOffset}px;
    right: 20px;
    z-index: 999999;
    min-width: 365px;
    max-width: 468px;
    background: #1e293b;
    border-radius: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.45);
    border-left: 5px solid ${GREEN};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    animation: myio-notif-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both;
  `;

  el.innerHTML = `
    <style>
      #myio-alarm-closed-notification .notif-body {
        display: flex; align-items: flex-start; gap: 13px; padding: 18px 18px 13px;
      }
      #myio-alarm-closed-notification .notif-icon {
        font-size: 26px; flex-shrink: 0; line-height: 1.2;
      }
      #myio-alarm-closed-notification .notif-content { flex: 1; min-width: 0; }
      #myio-alarm-closed-notification .notif-device {
        font-size: 16px; font-weight: 700; color: #f1f5f9;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        margin-bottom: 3px;
      }
      #myio-alarm-closed-notification .notif-count {
        font-size: 14px; font-weight: 700; color: ${GREEN}; margin-bottom: 2px;
      }
      #myio-alarm-closed-notification .notif-title {
        font-size: 12px; font-weight: 500; color: #94a3b8;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #myio-alarm-closed-notification .notif-close {
        background: none; border: none; color: #64748b; font-size: 21px;
        cursor: pointer; padding: 0 2px; line-height: 1; flex-shrink: 0;
        align-self: flex-start; transition: color 0.15s;
      }
      #myio-alarm-closed-notification .notif-close:hover { color: #f1f5f9; }
      #myio-alarm-closed-notification .notif-progress {
        height: 4px; background: ${GREEN}; opacity: 0.7;
        animation: myio-notif-bar 5s linear forwards;
      }
    </style>
    <div class="notif-body">
      <div class="notif-icon">✅</div>
      <div class="notif-content">
        ${deviceName ? `<div class="notif-device">${deviceName}</div>` : ''}
        <div class="notif-count">${count} ${label}</div>
        <div class="notif-title">${firstTitle}</div>
      </div>
      <button class="notif-close" title="Fechar">✕</button>
    </div>
    <div class="notif-progress"></div>
  `;

  const dismiss = () => {
    el.style.animation = 'myio-notif-out 0.2s ease forwards';
    setTimeout(() => el.remove(), 200);
    if (_alarmClosedNotifTimer) {
      clearTimeout(_alarmClosedNotifTimer);
      _alarmClosedNotifTimer = null;
    }
  };

  el.querySelector('.notif-close').addEventListener('click', dismiss);
  document.body.appendChild(el);
  _alarmClosedNotifTimer = setTimeout(dismiss, 5000);
}
// ── RFC-0193: Alarm Day Map ────────────────────────────────────────────────

/**
 * Rebuild window.MyIOOrchestrator.alarmDayMap from today's alarm list.
 * Exposes .listAll(), .listByStatus(status|string[]), .add(alarm), .remove(id), .count()
 */
function _buildAlarmDayMap(alarms) {
  _alarmDayMap = new Map((alarms || []).filter((a) => a.id).map((a) => [a.id, a]));
  if (!window.MyIOOrchestrator) return;
  window.MyIOOrchestrator.alarmDayMap = {
    listAll: () => [..._alarmDayMap.values()],
    listByStatus: (status) => {
      if (!status) return [..._alarmDayMap.values()];
      const states = Array.isArray(status) ? status : [status];
      return [..._alarmDayMap.values()].filter((a) => states.includes(a.state));
    },
    add: (alarm) => {
      if (alarm?.id) _alarmDayMap.set(alarm.id, alarm);
    },
    remove: (id) => {
      _alarmDayMap.delete(id);
    },
    count: () => _alarmDayMap.size,
  };
}

/**
 * Fetch all of today's alarms (no state filter) and populate alarmDayMap.
 */
async function _fetchAlarmDayMap() {
  const orch = window.MyIOOrchestrator;
  const gcdrCustomerId = orch?.gcdrCustomerId;
  const gcdrApiKey = orch?.gcdrApiKey;
  const gcdrTenantId = orch?.gcdrTenantId || '';
  const alarmsBaseUrl = orch?.alarmsApiBaseUrl || 'https://alarms-api.a.myio-bas.com';
  if (!gcdrCustomerId || !gcdrApiKey) {
    LogHelper.warn('[MAIN_VIEW] _fetchAlarmDayMap: missing gcdrCustomerId or gcdrApiKey');
    return;
  }
  // Limpa imediatamente antes do fetch — badge vai a 0 enquanto os dados do novo customer chegam
  _buildAlarmDayMap([]);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const from = encodeURIComponent(todayStart.toISOString());
  const to = encodeURIComponent(now.toISOString());
  const baseUrl = `${alarmsBaseUrl}/api/v1/alarms?customerId=${encodeURIComponent(gcdrCustomerId)}&from=${from}&to=${to}&limit=100`;
  const headers = { 'X-API-Key': gcdrApiKey, 'X-Tenant-ID': gcdrTenantId, Accept: 'application/json' };
  try {
    let allAlarms = [];
    let page = 1;
    let totalPages = 1;
    do {
      const resp = await fetch(`${baseUrl}&page=${page}`, { headers });
      if (!resp.ok) {
        LogHelper.warn('[MAIN_VIEW] _fetchAlarmDayMap failed:', resp.status);
        break;
      }
      const json = await resp.json();
      const pageAlarms = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.items)
          ? json.items
          : Array.isArray(json.data?.items)
            ? json.data.items
            : [];
      allAlarms = allAlarms.concat(pageAlarms);
      if (page === 1) {
        totalPages = json.pagination?.totalPages ?? 1;
      }
      page++;
    } while (page <= totalPages);
    _buildAlarmDayMap(allAlarms);
    LogHelper.log(
      '[MAIN_VIEW] alarmDayMap populated:',
      allAlarms.length,
      'alarms for today (pages:',
      totalPages,
      ')'
    );
  } catch (err) {
    LogHelper.warn('[MAIN_VIEW] _fetchAlarmDayMap error:', err);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// RFC-0180: Pre-fetch all customer alarms so AlarmsTab can filter without a per-device call.
// Runs non-blocking — result stored in window.MyIOOrchestrator.customerAlarms.
async function _prefetchCustomerAlarms(gcdrCustomerId, gcdrTenantId, alarmsBaseUrl) {
  try {
    const gcdrApiKey = window.MyIOOrchestrator?.gcdrApiKey || '';
    const url = `${alarmsBaseUrl}/api/v1/alarms?state=OPEN,ACK,ESCALATED,SNOOZED&customerId=${encodeURIComponent(gcdrCustomerId)}&limit=100`;
    const response = await fetch(url, {
      headers: {
        'X-API-Key': gcdrApiKey,
        'X-Tenant-ID': gcdrTenantId || '',
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      LogHelper.warn('[MAIN_VIEW] _prefetchCustomerAlarms failed:', response.status);
      return;
    }
    const json = await response.json();
    const alarms = Array.isArray(json.data) ? json.data : (json.items ?? json.data?.items ?? []);
    if (window.MyIOOrchestrator) window.MyIOOrchestrator.customerAlarms = alarms;
    LogHelper.log('[MAIN_VIEW] RFC-0180: customerAlarms pre-fetched:', alarms.length, 'alarms');
    _buildAlarmServiceOrchestrator(alarms);
  } catch (err) {
    LogHelper.warn('[MAIN_VIEW] _prefetchCustomerAlarms error:', err);
  }
}

// RFC-0183: Build window.AlarmServiceOrchestrator — device-keyed alarm maps.
function _buildAlarmServiceOrchestrator(alarms) {
  // Normalize: set source = deviceId (GCDR UUID) so _updatePanelFromASO can resolve
  // the display name via gcdrDeviceNameMap.get(source). The API returns deviceId but not
  // a "source" field, so without this step source is undefined and the enrichment falls
  // through to the stateMap gateway-key fallback (which returns a wrong device name).
  const normalizedAlarms = (alarms || []).map((a) => ({
    ...a,
    source: a.source || a.deviceId || '',
  }));

  // Map: gcdrDeviceId → GCDRAlarm[]
  const deviceAlarmMap = new Map();
  for (const alarm of normalizedAlarms) {
    const did = alarm.deviceId;
    if (!did) continue;
    if (!deviceAlarmMap.has(did)) deviceAlarmMap.set(did, []);
    deviceAlarmMap.get(did).push(alarm);
  }

  // Map: gcdrDeviceId → Set<alarmType>
  const deviceAlarmTypes = new Map();
  deviceAlarmMap.forEach((devAlarms, did) => {
    deviceAlarmTypes.set(did, new Set(devAlarms.map((a) => a.alarmType || a.title || 'unknown')));
  });

  window.AlarmServiceOrchestrator = {
    /** Array of all raw customer alarms (source normalized to deviceId) */
    alarms: normalizedAlarms,

    /** Map<gcdrDeviceId, GCDRAlarm[]> */
    deviceAlarmMap,

    /** Map<gcdrDeviceId, Set<alarmType>> */
    deviceAlarmTypes,

    /** Returns alarm count for a device */
    getAlarmCountForDevice(gcdrDeviceId) {
      return deviceAlarmMap.get(gcdrDeviceId)?.length ?? 0;
    },

    /** Returns alarm array for a device */
    getAlarmsForDevice(gcdrDeviceId) {
      return deviceAlarmMap.get(gcdrDeviceId) ?? [];
    },

    /** Returns Set of alarm types for a device */
    getAlarmTypesForDevice(gcdrDeviceId) {
      return deviceAlarmTypes.get(gcdrDeviceId) ?? new Set();
    },

    /** Re-fetches from server and rebuilds maps */
    async refresh() {
      const orch = window.MyIOOrchestrator;
      const gcdrCustomerId = orch?.gcdrCustomerId || '';
      const gcdrTenantId = orch?.gcdrTenantId || '';
      const alarmsBaseUrl = orch?.alarmsApiBaseUrl || '';
      await _prefetchCustomerAlarms(gcdrCustomerId, gcdrTenantId, alarmsBaseUrl);
    },
  };

  LogHelper.log(
    '[AlarmServiceOrchestrator] Built —',
    deviceAlarmMap.size,
    'devices with alarms,',
    normalizedAlarms.length,
    'total alarms'
  );

  // ── Contamination detector ──────────────────────────────────────────────
  // Scans STATE.itemsBase for TB devices that share the same gcdrDeviceId.
  // If multiple TB items have the same gcdrDeviceId that matches an active alarm,
  // ALL those cards show the badge even though only 1 GCDR device has the alarm.
  // Root cause: GCDR sync re-match bug (fixed via consumedGcdrDeviceIds).
  // Resolution: Force Clear + re-sync the customer in GCDR-Upsell-Setup widget.
  if (window.STATE) {
    const gcdrIdToItems = new Map(); // gcdrDeviceId → [{tbId, label}]
    for (const domain of ['energy', 'water', 'temperature']) {
      const items = window.STATE[domain]?._raw || [];
      for (const item of items) {
        const gid = item.gcdrDeviceId;
        if (!gid || !deviceAlarmMap.has(gid)) continue; // only care about alarm-matched IDs
        if (!gcdrIdToItems.has(gid)) gcdrIdToItems.set(gid, []);
        gcdrIdToItems
          .get(gid)
          .push({ tbId: item.id || item.tbId || '?', label: item.label || item.name || '?' });
      }
    }
    let extraBadges = 0;
    gcdrIdToItems.forEach((items, gid) => {
      if (items.length > 1) {
        extraBadges += items.length - 1;
        LogHelper.warn(
          `[AlarmServiceOrchestrator] ⚠️ gcdrDeviceId contamination detected: "${gid}" is shared by ${items.length} TB devices.`,
          'Expected 1, found:',
          items.map((i) => `${i.label} (${i.tbId})`).join(', '),
          '→ Run Force Clear + re-sync to fix.'
        );
      }
    });
    if (extraBadges > 0) {
      LogHelper.warn(
        `[AlarmServiceOrchestrator] ⚠️ ${extraBadges} extra badge(s) will appear in TELEMETRY due to contamination.`
      );
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  // RFC-0192/RFC-0193: Diff against the previous known set to detect new and closed alarms.
  // First call (_lastKnownAlarmIds === null) only populates the structures — no toast.
  const currentIds = new Set(normalizedAlarms.map((a) => a.id).filter(Boolean));
  const currentMap = new Map(normalizedAlarms.filter((a) => a.id).map((a) => [a.id, a]));
  if (_lastKnownAlarmIds !== null) {
    const newAlarms = normalizedAlarms.filter((a) => a.id && !_lastKnownAlarmIds.has(a.id));
    const closedAlarms = [..._lastKnownAlarmMap.values()].filter((a) => !currentIds.has(a.id));
    if (newAlarms.length > 0) {
      LogHelper.log('[AlarmServiceOrchestrator] RFC-0192: detected', newAlarms.length, 'new alarm(s)');
      _showNewAlarmNotification(newAlarms);
    }
    if (closedAlarms.length > 0) {
      LogHelper.log('[AlarmServiceOrchestrator] RFC-0193: detected', closedAlarms.length, 'closed alarm(s)');
      _showClosedAlarmNotification(closedAlarms);
    }
  }
  _lastKnownAlarmIds = currentIds;
  _lastKnownAlarmMap = currentMap;

  // Notify all subscribers that alarm data is fresh.
  // Receivers: ALARM widget (panel update), TELEMETRY (badge refresh), AlarmsTab (device grid).
  window.dispatchEvent(
    new CustomEvent('myio:alarms-updated', {
      detail: { alarms: normalizedAlarms, count: normalizedAlarms.length },
    })
  );
}

async function fetchDeviceCountAttributes(entityId, entityType = 'CUSTOMER', tbBaseUrl = '') {
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    LogHelper.warn('[RFC-0107] JWT token not found');
    return null;
  }

  const tbBase = tbBaseUrl || self.ctx?.settings?.tbBaseUrl || '';
  const url = `${tbBase}/api/plugins/telemetry/${entityType}/${entityId}/values/attributes/SERVER_SCOPE`;

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

  function pushIf(domain, category, expected, actual) {
    if (expected > 0 && actual !== expected) {
      discrepancies.push({ domain, category, expected, actual });
    }
  }

  // Validate Energy — total + per-category
  if (state?.energy) {
    const lojas = state.energy.lojas?.count || 0;
    const entrada = state.energy.entrada?.count || 0;
    const area = state.energy.areacomum?.count || 0;

    pushIf('energy', 'total', serverCounts.energy.total, lojas + entrada + area);
    pushIf('energy', 'stores', serverCounts.energy.stores, lojas);
    pushIf('energy', 'entries', serverCounts.energy.entries, entrada);
    pushIf('energy', 'commonArea', serverCounts.energy.commonArea, area);
  }

  // Validate Water — total + per-category
  if (state?.water) {
    const lojas = state.water.lojas?.count || 0;
    const entrada = state.water.entrada?.count || 0;
    const area = state.water.areacomum?.count || 0;

    pushIf('water', 'total', serverCounts.water.total, lojas + entrada + area);
    pushIf('water', 'stores', serverCounts.water.stores, lojas);
    pushIf('water', 'entries', serverCounts.water.entries, entrada);
    pushIf('water', 'commonArea', serverCounts.water.commonArea, area);
  }

  // Validate Temperature — total only (no sub-categories stored in STATE)
  if (state?.temperature) {
    const total =
      (state.temperature.lojas?.count || 0) +
      (state.temperature.entrada?.count || 0) +
      (state.temperature.areacomum?.count || 0);

    pushIf('temperature', 'total', serverCounts.temperature.total, total);
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
 * Categorize items into 4 groups: lojas, entrada, areacomum, ocultos
 * Rules:
 * - RFC-0142: OCULTOS - devices with ARQUIVADO, SEM_DADOS, etc. in deviceProfile (hidden group)
 * - LOJAS: deviceProfile = '3F_MEDIDOR' (uses isStoreDevice)
 * - ENTRADA: (deviceType = '3F_MEDIDOR' AND deviceProfile in [TRAFO, ENTRADA, RELOGIO, SUBESTACAO])
 *            OR deviceType in [TRAFO, ENTRADA, RELOGIO, SUBESTACAO]
 * - AREACOMUM: everything else
 */
function categorizeItemsByGroup(items) {
  const ENTRADA_PROFILES = new Set(['TRAFO', 'ENTRADA', 'RELOGIO', 'SUBESTACAO']);

  const lojas = [];
  const entrada = [];
  const areacomum = [];
  const ocultos = [];

  const toStr = (val) => String(val || '').toUpperCase();

  for (const item of items) {
    // RULE 0: ocultos
    if (isOcultosDevice(item)) {
      ocultos.push(item);
      continue;
    }

    const dp = toStr(item.deviceProfile);

    // Rule 1: LOJAS — deviceProfile = 3F_MEDIDOR
    if (dp === '3F_MEDIDOR') {
      lojas.push(item);
      continue;
    }

    // Rule 2: ENTRADA — deviceProfile ∈ {TRAFO, ENTRADA, RELOGIO, SUBESTACAO}
    if (ENTRADA_PROFILES.has(dp)) {
      entrada.push(item);
      continue;
    }

    // Rule 3: AREACOMUM — everything else
    areacomum.push(item);
  }

  if (ocultos.length > 0) {
    LogHelper.log(
      `[RFC-0142] Classified ${ocultos.length} devices as "ocultos" (hidden):`,
      ocultos.map((d) => `${d.label || d.name || d.id} (${d.deviceProfile})`).slice(0, 5)
    );
  }

  return { lojas, entrada, areacomum, ocultos };
}

/**
 * RFC-0106: Categorize water items into 5 groups: entrada, lojas, banheiros, areacomum, ocultos
 *
 * RULE ORDER:
 * RFC-0142: 0. OCULTOS - devices with ARQUIVADO, SEM_DADOS, etc. in deviceProfile (hidden group)
 * 1. ENTRADA: deviceType = HIDROMETRO_SHOPPING OR (deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_SHOPPING)
 * 2. AREACOMUM: deviceType = HIDROMETRO_AREA_COMUM OR (deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_AREA_COMUM)
 *    NOTE: Banheiros with HIDROMETRO_AREA_COMUM go here - they are extracted by TELEMETRY widget for TELEMETRY_INFO
 * 3. BANHEIROS: identifier/label contains BANHEIRO, WC, SANITARIO, TOALETE, LAVABO (for standalone bathroom meters)
 * 4. LOJAS: deviceType = HIDROMETRO AND (deviceProfile = HIDROMETRO OR empty)
 *
 * Fallback rules (for items not matching primary rules):
 * - ENTRADA: label/identifier contains ENTRADA, PRINCIPAL, RELOGIO
 * - AREACOMUM: everything else
 */
function categorizeItemsByGroupWater(items) {
  const entrada = [];
  const lojas = [];
  const banheiros = [];
  const areacomum = [];
  const caixadagua = [];
  const ocultos = [];

  const toStr = (val) => String(val || '').toUpperCase();

  for (const item of items) {
    // RULE 0: ocultos
    if (isOcultosDevice(item)) {
      ocultos.push(item);
      continue;
    }

    const dp = toStr(item.deviceProfile);

    // Rule 1: ENTRADA — deviceProfile = HIDROMETRO_SHOPPING
    if (dp === 'HIDROMETRO_SHOPPING') {
      entrada.push(item);
      continue;
    }

    // Rule 2: ÁREA COMUM — deviceProfile = HIDROMETRO_AREA_COMUM
    if (dp === 'HIDROMETRO_AREA_COMUM') {
      areacomum.push(item);
      continue;
    }

    // Rule 3: LOJAS — deviceProfile = HIDROMETRO
    if (dp === 'HIDROMETRO') {
      lojas.push(item);
      continue;
    }

    // Rule 4: CAIXA D'ÁGUA — deviceProfile = TANK or CAIXA_DAGUA
    if (dp === 'TANK' || dp === 'CAIXA_DAGUA') {
      caixadagua.push(item);
      continue;
    }

    // Fallback: tudo que não encaixou vai para areacomum
    areacomum.push(item);
  }

  if (ocultos.length > 0) {
    LogHelper.log(
      `[RFC-0142] Classified ${ocultos.length} water devices as "ocultos" (hidden):`,
      ocultos.map((d) => `${d.label || d.name || d.id} (${d.deviceProfile})`).slice(0, 5)
    );
  }

  return { entrada, lojas, banheiros, areacomum, caixadagua, ocultos };
}

/**
 * RFC-0182: Categorize temperature items into groups by deviceProfile
 *
 * RULE ORDER:
 * 0. OCULTOS  - deviceProfile contains ARQUIVADO, SEM_DADOS, etc.
 * 1. NAO_CLIMATIZAVEL - deviceProfile === 'TERMOSTATO_EXTERNAL'
 * 2. CLIMATIZAVEL     - deviceProfile === 'TERMOSTATO' (or any remaining termostato variant)
 */
function categorizeItemsByGroupTemperature(items) {
  const climatizavel = [];
  const nao_climatizavel = [];
  const ocultos = [];

  const toStr = (val) => String(val || '').toUpperCase();

  for (const item of items) {
    if (isOcultosDevice(item)) {
      ocultos.push(item);
      continue;
    }
    const dp = toStr(item.deviceProfile);
    if (dp === 'TERMOSTATO_EXTERNAL') {
      nao_climatizavel.push(item);
    } else {
      climatizavel.push(item); // TERMOSTATO or any other termostato variant
    }
  }

  return { climatizavel, nao_climatizavel, ocultos };
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
  // --- HELPER INTELIGENTE (Lê o JSON do próprio device) ---
  // Se o device manda excluir deste grupo, retorna 0 para a soma, mas não oculta o card.
  const getValorEfetivo = (item, nomeDoGrupo) => {
    const val = Number(item.value) || 0;
    if (!item.excludeGroupsTotals) return val; // Se não tem a flag no device, soma normal

    try {
      const parsed =
        typeof item.excludeGroupsTotals === 'string'
          ? JSON.parse(item.excludeGroupsTotals)
          : item.excludeGroupsTotals;
      if (parsed && parsed.enabled && Array.isArray(parsed.excludedGroups)) {
        // Padroniza para minúsculo para evitar bugs de digitação
        const gruposExcluidos = parsed.excludedGroups.map((g) => String(g).toLowerCase());
        if (gruposExcluidos.includes(nomeDoGrupo.toLowerCase()) || gruposExcluidos.includes('all')) {
          return 0; // O card continua existindo, mas vale ZERO para o totalizador!
        }
      } else if (parsed && parsed.enabled && parsed.groups && typeof parsed.groups === 'object') {
        if (parsed.groups[nomeDoGrupo] === true) return 0;
      }
    } catch (e) {
      console.warn('Erro ao ler exclude_groups_totals do dispositivo', item.label, e);
    }
    return val;
  };
  // --------------------------------------------------------

  // ============ TOTALS (Usando o Helper) ============
  const lojasTotal = lojas.reduce((sum, item) => sum + getValorEfetivo(item, 'lojas'), 0);
  const entradaTotal = entrada.reduce((sum, item) => sum + getValorEfetivo(item, 'entrada'), 0);
  const areacomumTotal = areacomum.reduce((sum, item) => sum + getValorEfetivo(item, 'area_comum'), 0);

  let grandTotal = lojasTotal + entradaTotal + areacomumTotal;

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

  const chillerItems = [];
  const fancoilItems = [];
  const bombaHidraulicaItems = [];
  const cagItems = [];
  const hvacOutrosItems = [];

  const iluminacaoItems = [];
  const bombaIncendioItems = [];
  const geradorItems = [];
  const outrosGeralItems = [];

  const toStr = (val) => String(val || '').toUpperCase();

  for (const item of areacomum) {
    const lw = toStr(item.labelWidget);
    const dt = toStr(item.deviceType);
    const dp = toStr(item.deviceProfile);
    const label = toStr(item.label);
    const combined = `${lw} ${dt} ${dp} ${label}`;

    if (ELEVADOR_PATTERNS.some((p) => combined.includes(p))) {
      elevadoresItems.push(item);
    } else if (ESCADA_PATTERNS.some((p) => combined.includes(p))) {
      escadasRolantesItems.push(item);
    } else if (CLIMATIZACAO_PATTERNS.some((p) => combined.includes(p))) {
      climatizacaoItems.push(item);
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
  }

  // ============ CALCULATE SUB-TOTAIS (Usando o Helper) ============
  const climatizacaoTotal = climatizacaoItems.reduce((sum, i) => sum + getValorEfetivo(i, 'climatizacao'), 0);
  const elevadoresTotal = elevadoresItems.reduce((sum, i) => sum + getValorEfetivo(i, 'elevadores'), 0);
  const escadasRolantesTotal = escadasRolantesItems.reduce(
    (sum, i) => sum + getValorEfetivo(i, 'esc_rolantes'),
    0
  );
  const outrosTotal = outrosItems.reduce((sum, i) => sum + getValorEfetivo(i, 'outros'), 0);

  // Climatizacao subcategories totals (O Helper usa 'climatizacao' para herdar a regra do pai)
  const chillerTotal = chillerItems.reduce((sum, i) => sum + getValorEfetivo(i, 'climatizacao'), 0);
  const fancoilTotal = fancoilItems.reduce((sum, i) => sum + getValorEfetivo(i, 'climatizacao'), 0);
  const bombaHidraulicaTotal = bombaHidraulicaItems.reduce(
    (sum, i) => sum + getValorEfetivo(i, 'climatizacao'),
    0
  );
  const cagTotal = cagItemsFiltered.reduce((sum, i) => sum + getValorEfetivo(i, 'climatizacao'), 0);
  const hvacOutrosTotal = hvacOutrosItems.reduce((sum, i) => sum + getValorEfetivo(i, 'climatizacao'), 0);

  // Outros subcategories totals (O Helper usa 'outros' para herdar a regra do pai)
  const iluminacaoTotal = iluminacaoItems.reduce((sum, i) => sum + getValorEfetivo(i, 'outros'), 0);
  const bombaIncendioTotal = bombaIncendioItems.reduce((sum, i) => sum + getValorEfetivo(i, 'outros'), 0);
  const geradorTotal = geradorItems.reduce((sum, i) => sum + getValorEfetivo(i, 'outros'), 0);
  const outrosGeralTotal = outrosGeralItems.reduce((sum, i) => sum + getValorEfetivo(i, 'outros'), 0);

  // ============ EXCLUSÃO DE GRUPOS DE CÁLCULO GLOBAIS ============
  // Lê a configuração do Shopping (SettingsModal) e se sobrepõe
  const _exclEnabled = _excludeGroupsTotals?.enabled === true;
  if (_exclEnabled) {
    const _exclGroups = _excludeGroupsTotals.groups || {};
    const _lojasEff = _exclGroups.lojas ? 0 : lojasTotal;
    const _entradaEff = _exclGroups.entrada ? 0 : entradaTotal;
    const _climatizacaoEff = _exclGroups.climatizacao ? 0 : climatizacaoTotal;
    const _elevadoresEff = _exclGroups.elevadores ? 0 : elevadoresTotal;
    const _escadasEff = _exclGroups.escadas_rolantes ? 0 : escadasRolantesTotal;
    const _outrosEff = _exclGroups.outros ? 0 : outrosTotal;
    const _areacomumSubtot = climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + outrosTotal;
    const _areacomumResidual = Math.max(0, areacomumTotal - _areacomumSubtot);
    const _residualEff = _exclGroups.area_comum ? 0 : _areacomumResidual;
    const _areacomumEff = _climatizacaoEff + _elevadoresEff + _escadasEff + _outrosEff + _residualEff;

    grandTotal = _lojasEff + _entradaEff + _areacomumEff;
  }

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
      devices: items.map((i) => {
        const baseLabel = i.label || i.name || '';
        const identifier = i.identifier || '';
        const displayLabel =
          identifier && identifier !== baseLabel ? `${baseLabel} (${identifier})` : baseLabel;
        return {
          id: i.id,
          label: displayLabel,
          value: i.value, // Mantém o valor original para exibição no card
          deviceStatus: i.deviceStatus,
        };
      }),
      name: name,
    },
  });

  return {
    total: grandTotal,
    periodKey: periodKey,
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
    deviceStatusAggregation: statusAggregation,
    excludedFromCAG: excludedFromCAG.map((item) => ({
      id: item.id,
      label: item.label || item.name || item.deviceIdentifier || item.id,
      value: item.value || 0,
    })),
    excludedGroups: _exclEnabled
      ? Object.entries(_excludeGroupsTotals?.groups || {})
          .filter(([, v]) => v)
          .map(([k]) => k)
      : [],
    exclusionGroupsEnabled: _exclEnabled,
  };
}

/**
 * Aggregate device status from items
 * Returns counts and device lists for each status
 * RFC-0109: Added waiting and weakConnection categories
 */
function aggregateDeviceStatus(items) {
  const NO_CONSUMPTION_THRESHOLD = 0.01;

  const result = {
    hasData: items.length > 0,
    // RFC-0109: Connectivity status categories
    waiting: 0,
    weakConnection: 0,
    offline: 0,
    // Consumption status categories
    normal: 0,
    alert: 0,
    failure: 0,
    standby: 0,
    noConsumption: 0,
    // Device lists for connectivity
    waitingDevices: [],
    weakConnectionDevices: [],
    offlineDevices: [],
    // Device lists for consumption
    normalDevices: [],
    alertDevices: [],
    failureDevices: [],
    standbyDevices: [],
    noConsumptionDevices: [],
  };

  // RFC-0109: Status mapping for consumption categories (online devices only)
  const consumptionStatusMapping = {
    power_on: 'normal',
    warning: 'alert',
    failure: 'failure',
    standby: 'standby',
  };

  for (const item of items) {
    const deviceInfo = {
      id: item.id,
      label: item.label || item.name || item.identifier || '',
      name: item.name || '',
    };

    const deviceStatus = item.deviceStatus || 'no_info';
    const connectionStatus = item.connectionStatus || '';
    const value = Number(item.value || 0);

    // RFC-0109: MUTUALLY EXCLUSIVE categories - device appears in exactly ONE
    // Priority: waiting > weakConnection > offline > noConsumption > consumption status

    // 1. WAITING (not_installed) - highest priority
    const isWaiting =
      deviceStatus === 'not_installed' ||
      connectionStatus === 'waiting' ||
      ['waiting', 'connecting', 'pending'].includes(String(connectionStatus).toLowerCase());
    if (isWaiting) {
      result.waiting++;
      result.waitingDevices.push(deviceInfo);
      continue;
    }

    // 2. WEAK CONNECTION
    const isWeakConnection =
      deviceStatus === 'weak_connection' ||
      ['bad', 'weak', 'unstable', 'poor', 'degraded'].includes(String(connectionStatus).toLowerCase());
    if (isWeakConnection) {
      result.weakConnection++;
      result.weakConnectionDevices.push(deviceInfo);
      continue;
    }

    // 3. OFFLINE
    const isOffline =
      ['no_info', 'offline', 'maintenance', 'power_off'].includes(deviceStatus) ||
      ['offline', 'disconnected'].includes(String(connectionStatus).toLowerCase());
    if (isOffline) {
      result.offline++;
      result.offlineDevices.push(deviceInfo);
      continue;
    }

    // 4. ONLINE device - check consumption value first
    // If no consumption (value ~= 0), goes to noConsumption category
    if (Math.abs(value) < NO_CONSUMPTION_THRESHOLD) {
      result.noConsumption++;
      result.noConsumptionDevices.push(deviceInfo);
      continue;
    }

    // 5. ONLINE device with consumption - map to status category
    const consumptionCategory = consumptionStatusMapping[deviceStatus];
    if (consumptionCategory) {
      result[consumptionCategory]++;
      result[`${consumptionCategory}Devices`].push(deviceInfo);
    } else {
      // Unknown status for online device with consumption - default to normal
      result.normal++;
      result.normalDevices.push(deviceInfo);
    }
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
    // Water domain: entrada, lojas, banheiros, areacomum, caixadagua
    const { entrada, lojas, banheiros, areacomum, caixadagua } = categorizeItemsByGroupWater(items);

    window.STATE[domain] = {
      entrada: buildGroupData(entrada),
      lojas: buildGroupData(lojas),
      banheiros: buildGroupData(banheiros),
      areacomum: buildGroupData(areacomum),
      caixadagua: buildGroupData(caixadagua), // RFC-0107: Tanks
      summary: buildSummaryWater(entrada, lojas, banheiros, areacomum, periodKey),
      _raw: items,
    };

    window.STATE._lastUpdate[domain] = Date.now();

    LogHelper.log(`[Orchestrator] 🗄️ window.STATE.${domain} populated:`, {
      entrada: entrada.length,
      lojas: lojas.length,
      banheiros: banheiros.length,
      areacomum: areacomum.length,
      caixadagua: caixadagua.length,
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

  // Expose unique centralIds from all domains for child widgets (e.g. PresetupGateway)
  if (window.MyIOOrchestrator) {
    const allRaw = [
      ...(window.STATE.energy?._raw || []),
      ...(window.STATE.water?._raw || []),
      ...(window.STATE.temperature?._raw || []),
    ];
    const centralIdSet = new Set(allRaw.map((i) => i.centralId).filter(Boolean));
    window.MyIOOrchestrator.centralIds = Array.from(centralIdSet).sort();
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
}

/**
 * @typedef {'hour'|'day'|'month'} Granularity
 * @typedef {'energy'|'water'|'temperature'} Domain
 */

/**
 * @typedef {Object} Period
 * @property {string} startISO - ISO 8601 with timezone
 * @property {string} endISO - ISO 8601 with timezone
 * @property {Granularity} granularity - Data aggregation level
 * @property {string} tz - IANA timezone
 */

/**
 * @typedef {Object} EnrichedItem
 * @property {string} id - ThingsBoard entityId (single source of truth)
 * @property {string} tbId - ThingsBoard deviceId
 * @property {string} ingestionId - Data Ingestion API UUID
 * @property {string} identifier - Human-readable ID
 * @property {string} label - Display name
 * @property {number} value - Consumption total
 * @property {number} perc - Percentage of group total
 * @property {string|null} slaveId - Modbus slave ID
 * @property {string|null} centralId - Central unit ID
 * @property {string} deviceType - Device type
 */

// ========== UTILITIES ==========

/**
 * Generates a unique key from domain and period for request deduplication.
 * RFC-0130: Uses customerTB_ID from multiple sources with fallback
 */
function periodKey(domain, period) {
  // RFC-0130: Get customerTB_ID from multiple sources with fallback
  const customerTbId =
    widgetSettings.customerTB_ID ||
    window.MyIOOrchestrator?.customerTB_ID ||
    window.__myioCustomerTB_ID ||
    'default';
  return `${customerTbId}:${domain}:${period.startISO}:${period.endISO}:${period.granularity}`;
}

let SHORT_DELAY_IN_MINS_TO_BYPASS_OFFLINE_STATUS = 60; // overridden in onInit from settingsSchema
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
  function showGlobalBusy(
    domain = 'unknown',
    message = 'Carregando dados...',
    timeoutMs = 25000,
    options = {}
  ) {
    // RFC-0137: Support force flag to bypass cooldown (for user-initiated actions)
    const { force = false } = options;

    // RFC-0054: cooldown - não reabrir modal se acabou de prover dados
    // RFC-0137: Skip cooldown check if force=true (user clicked "Carregar")
    if (!force) {
      const lp = lastProvide.get(domain);
      if (lp && Date.now() - lp.at < 30000) {
        LogHelper.log(`[Orchestrator] ⏸️ Cooldown active for ${domain}, skipping showGlobalBusy()`);
        return;
      }
    } else {
      LogHelper.log(`[Orchestrator] 🔓 RFC-0137: Force flag set, bypassing cooldown for ${domain}`);
      // Clear lastProvide to reset cooldown state
      lastProvide.delete(domain);
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
    // Only monitor real data domains — 'contract' and other UI-only domains must not trigger hydrateDomain
    const REAL_DATA_DOMAINS = ['energy', 'water', 'temperature'];
    if (window.MyIOOrchestrator?.widgetBusyMonitor && REAL_DATA_DOMAINS.includes(domain)) {
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

  // RFC-0130: Track pending retry attempts per domain
  const pendingRetries = new Map();

  /**
   * RFC-0130: Get default period from library or build one
   * Uses same pattern as MAIN_UNIQUE_DATASOURCE
   */
  function getDefaultPeriod() {
    // Try to get from library first
    if (window.MyIOLibrary?.getDefaultPeriodCurrentMonthSoFar) {
      const period = window.MyIOLibrary.getDefaultPeriodCurrentMonthSoFar();
      LogHelper.log('[Orchestrator] 📅 Using default period from MyIOLibrary:', period);
      return period;
    }

    // Fallback: build period for last 7 days
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const formatISO = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}T00:00:00-03:00`;
    };

    const formatISOEnd = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}T23:59:59-03:00`;
    };

    const period = {
      startISO: formatISO(startOfMonth),
      endISO: formatISOEnd(now),
      granularity: 'day',
      tz: 'America/Sao_Paulo',
    };

    LogHelper.log('[Orchestrator] 📅 Built fallback default period:', period);
    return period;
  }

  /**
   * RFC-0130: Wait for period with retry and toast feedback
   * Inspired by MAIN_UNIQUE_DATASOURCE retry pattern
   * @param {string} domain - Domain to wait for
   * @param {number} maxRetries - Maximum retry attempts (default: 5)
   * @param {number} intervalMs - Interval between retries in ms (default: 3000)
   * @returns {Promise<object|null>} - Returns period object or null if timeout
   */
  async function waitForPeriodWithRetry(
    domain,
    maxRetries = RETRY_CONFIG.maxRetries,
    intervalMs = RETRY_CONFIG.intervalMs
  ) {
    const MyIOToast = window.MyIOLibrary?.MyIOToast;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Check if period is now available
      if (currentPeriod) {
        LogHelper.log(`[Orchestrator] ✅ Period available on attempt ${attempt}:`, currentPeriod);
        if (attempt > 1 && MyIOToast) {
          MyIOToast.success(`Dados carregados com suesso (tentativa ${attempt})`, 2000);
        }
        return currentPeriod;
      }

      // Check if HEADER has emitted initial period
      const headerPeriod = window.__myioInitialPeriod;
      if (headerPeriod) {
        LogHelper.log(`[Orchestrator] ✅ Found __myioInitialPeriod on attempt ${attempt}:`, headerPeriod);
        currentPeriod = headerPeriod;
        return headerPeriod;
      }

      if (attempt < maxRetries) {
        LogHelper.log(`[Orchestrator] ⏳ Waiting for period, attempt ${attempt}/${maxRetries}...`);

        // Force click no elemento energia
        const energiaElement = document.querySelector('a.menu-item.active[id="link0"][data-icon="⚡"]');
        if (energiaElement) {
          energiaElement.click();
          LogHelper.log(`[Orchestrator] 🖱️ Force clicked energia element on attempt ${attempt}`);
        }

        if (MyIOToast) {
          MyIOToast.warning(
            `Aguardando configuração de período... Tentativa ${attempt}/${maxRetries}`,
            intervalMs - 500
          );
        }

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    // RFC-0130: After all retries failed, use default period as final fallback
    LogHelper.warn(
      `[Orchestrator] ⚠️ Period not available after ${maxRetries} attempts - using default period`
    );
    const defaultPeriod = getDefaultPeriod();
    currentPeriod = defaultPeriod;
    window.__myioInitialPeriod = defaultPeriod;

    // Emit the default period so other widgets know
    window.dispatchEvent(
      new CustomEvent('myio:update-date', {
        detail: { period: defaultPeriod },
      })
    );

    return defaultPeriod;
  }

  /**
   * RFC-0130: Request data with automatic retry if period is not yet available
   * @param {string} domain - Domain to request data for
   * @param {object} providedPeriod - Period object (optional)
   */
  async function requestDataWithRetry(domain, providedPeriod = null) {
    // Prevent duplicate retry loops for same domain
    if (pendingRetries.has(domain)) {
      LogHelper.log(`[Orchestrator] ⏭️ Retry already in progress for ${domain}`);
      return;
    }

    pendingRetries.set(domain, true);

    try {
      let period = providedPeriod || currentPeriod;

      // If no period, wait for it with retry (will use default period as fallback)
      if (!period) {
        LogHelper.log(`[Orchestrator] 🔄 No period for ${domain}, starting retry loop...`);
        period = await waitForPeriodWithRetry(domain);
        // waitForPeriodWithRetry always returns a period (uses default as fallback)
      }

      // Now hydrate with the period
      LogHelper.log(`[Orchestrator] 📡 requestDataWithRetry → hydrateDomain(${domain})`);
      await hydrateDomain(domain, period);
    } finally {
      pendingRetries.delete(domain);
    }
  }

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
   * RFC-0109 + RFC-0110: Device status calculation using centralized library function
   * Uses MyIOLibrary for consistent status across all widgets.
   *
   * Status mapping:
   * - waiting, connecting, pending → 'not_installed' (RFC-0109)
   * - bad, weak, unstable → 'weak_connection' (RFC-0109)
   * - offline + stale timestamp → 'offline' (RFC-0110)
   * - offline + fresh timestamp → 'power_on' (treat as online) (RFC-0110)
   * - online, connected, active → 'power_on' (default, TELEMETRY may override with ranges)
   *
   * @param {string|boolean|null} connectionStatus - Raw status from ThingsBoard
   * @param {object} [options] - Optional parameters for calculation
   * @param {number|null} [options.lastConnectTime] - Timestamp of last connection
   * @param {number|null} [options.lastDisconnectTime] - Timestamp of last disconnection
   * @returns {string} deviceStatus: 'power_on', 'offline', 'weak_connection', 'not_installed'
   */
  function convertConnectionStatusToDeviceStatus(connectionStatus, deviceName, options = {}) {
    const lib = window.MyIOLibrary;

    // RFC-0110 v5: Use library's calculateDeviceStatus if available
    if (lib?.calculateDeviceStatus) {
      // RFC-0130: Get delay based on device profile (stores=60d, equipment=24h, water=48h, temp=24h)
      const deviceProfile = options.deviceProfile || options.deviceType || '';
      const delayMins = window.MyIOUtils?.getDelayTimeConnectionInMins?.(deviceProfile);
      const shortDelayMins = SHORT_DELAY_IN_MINS_TO_BYPASS_OFFLINE_STATUS;
      const isDebugDevice = deviceName.includes('HIDR. SCMP110A') || deviceName.includes('HIDR. SCMP110A');

      if (isDebugDevice) {
        console.log('[DEBUG] >>> convertConnectionStatusToDeviceStatus called with:', {
          connectionStatus,
          options,
          deviceName,
          delayMins,
          shortDelayMins,
        });
      }

      const status = lib.calculateDeviceStatus({
        connectionStatus: connectionStatus,
        domain: options.domain || 'energy',
        telemetryTimestamp: options.telemetryTimestamp || null,
        lastActivityTime: options.lastActivityTime || null,
        delayTimeConnectionInMins: delayMins,
        shortDelayMins: shortDelayMins,
      });

      return status;
    }

    // Fallback: Simple mapping if library not available
    const normalizedStatus = String(connectionStatus || '')
      .toLowerCase()
      .trim();

    if (['waiting', 'connecting', 'pending'].includes(normalizedStatus)) {
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
   * RFC-0078: Extract power limits from mapInstantaneousPower JSON
   * Resolves inconsistencies between TB names and JSON keys with intelligent fallback
   * @param {Object} powerLimitsJSON - mapInstantaneousPower configuration
   * @param {string} deviceType - Device type to find limits for
   * @param {string} telemetryType - Telemetry type (default 'consumption')
   * @returns {Object|null} Range configuration or null
   */
  function extractLimitsFromJSON(powerLimitsJSON, deviceType, telemetryType = 'consumption') {
    if (!powerLimitsJSON || !powerLimitsJSON.limitsByInstantaneoustPowerType) {
      return null;
    }

    const telemetryConfig = powerLimitsJSON.limitsByInstantaneoustPowerType.find(
      (config) => config.telemetryType === telemetryType
    );

    if (!telemetryConfig) return null;

    // Normalize type to avoid space/case issues
    const typeUpper = String(deviceType || '')
      .toUpperCase()
      .trim();

    // 1. EXACT MATCH (ideal)
    let deviceConfig = telemetryConfig.itemsByDeviceType.find(
      (item) => String(item.deviceType).toUpperCase().trim() === typeUpper
    );

    // 2. ALIAS MATCHING
    if (!deviceConfig) {
      if (typeUpper.includes('ESCADA') || typeUpper === 'ESCADASROLANTES' || typeUpper.includes('ER ')) {
        deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'ESCADA_ROLANTE');
      } else if (typeUpper.includes('ELEVADOR') || typeUpper.includes('ELV')) {
        deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'ELEVADOR');
      } else if (typeUpper.includes('BOMBA')) {
        deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'BOMBA');
      } else if (typeUpper.includes('CHILLER')) {
        deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'CHILLER');
        if (!deviceConfig)
          deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'MOTOR');
      } else if (typeUpper.includes('FANCOIL'))
        deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'FANCOIL');
      else if (typeUpper.includes('HVAC'))
        deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'HVAC');
    }

    // 3. UNIVERSAL FALLBACK (CATCH-ALL)
    if (!deviceConfig) {
      deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === '3F_MEDIDOR');
      if (!deviceConfig)
        deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'MOTOR');
    }

    if (!deviceConfig) return null;

    // 4. Extract ranges
    const ranges = {
      standbyRange: { down: 0, up: 0 },
      normalRange: { down: 0, up: 0 },
      alertRange: { down: 0, up: 0 },
      failureRange: { down: 0, up: 0 },
    };

    if (deviceConfig.limitsByDeviceStatus) {
      deviceConfig.limitsByDeviceStatus.forEach((status) => {
        const vals = status.limitsValues || status.limitsVales || {};
        const baseValue = vals.baseValue ?? 0;
        const topValue = vals.topValue ?? 99999999;

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
    }

    return {
      ...ranges,
      source: 'json',
      metadata: {
        name: deviceConfig.name,
        matchedType: deviceConfig.deviceType,
      },
    };
  }

  /**
   * RFC-0111: Factory function to create orchestrator items with centralized deviceStatus logic
   *
   * This function creates a standardized item object with:
   * 1. Common base fields (id, tbId, timestamps, etc.)
   * 2. Automatic deviceStatus calculation using RFC-0109/0110 logic
   * 3. Domain-specific overrides
   *
   * @param {Object} params - Parameters for item creation
   * @param {string} params.entityId - ThingsBoard entity ID
   * @param {Object} params.meta - Metadata from ctx.data
   * @param {Object} [params.apiRow] - Optional API row data for enrichment
   * @param {Object} [params.overrides] - Domain-specific field overrides
   * @returns {Object} Orchestrator item object
   */
  function createOrchestratorItem({ entityId, meta, apiRow = null, overrides = {} }) {
    let debugLabel = meta.label || meta.identifier || overrides.label || '';

    // RFC-0110 v5: Determine domain and telemetry timestamp for device status calculation
    const effectiveDeviceType = (meta.deviceProfile || meta.deviceType || '').toLowerCase();
    const isWaterDevice =
      effectiveDeviceType.includes('hidrometro') ||
      effectiveDeviceType.includes('water') ||
      effectiveDeviceType.includes('tank');
    const isTempDevice =
      effectiveDeviceType.includes('termostato') || effectiveDeviceType.includes('temperature');
    const domain = isWaterDevice ? 'water' : isTempDevice ? 'temperature' : 'energy';
    // RFC-0188: Prefer lastTelemetryTs from Data Apps API (ingestion backend) over TB broker timestamps.
    // Priority: apiRow.lastTelemetryTs (direct, water/energy) → overrides.lastTelemetryTs (temperature RFC-0189) → meta timestamps
    const apiRowLastTs = apiRow?.lastTelemetryTs ? new Date(apiRow.lastTelemetryTs).getTime() : null;
    const apiLastTs = apiRowLastTs ?? overrides?.lastTelemetryTs ?? null;
    const telemetryTimestamp =
      apiLastTs ??
      (isWaterDevice
        ? meta.pulsesTs || meta.waterLevelTs || meta.waterPercentageTs
        : isTempDevice
          ? meta.temperatureTs
          : meta.consumptionTs);

    // RFC-0109 + RFC-0110 v5: Calculate deviceStatus with telemetry timestamp and lastActivityTime fallback
    // RFC-0130: Pass deviceProfile for delay time calculation
    const deviceProfile = meta.deviceProfile || meta.deviceType || '';
    let deviceStatus = convertConnectionStatusToDeviceStatus(meta.connectionStatus, debugLabel, {
      domain: domain,
      deviceProfile: deviceProfile,
      telemetryTimestamp: telemetryTimestamp || null,
      lastActivityTime: meta.lastActivityTime,
    });

    // RFC-0188: Log offline/bad decisions for water devices so we can trace bypass
    if ((meta.connectionStatus === 'offline' || meta.connectionStatus === 'bad') && domain === 'water') {
      const shortDelayMins = SHORT_DELAY_IN_MINS_TO_BYPASS_OFFLINE_STATUS;
      LogHelper.log(
        `[RFC-0188] Water device "${debugLabel}" connectionStatus=${meta.connectionStatus} → deviceStatus=${deviceStatus}`,
        {
          apiRowLastTs: apiRowLastTs ? new Date(apiRowLastTs).toISOString() : null,
          overridesLastTs: overrides?.lastTelemetryTs
            ? new Date(overrides.lastTelemetryTs).toISOString()
            : null,
          metaPulsesTs: meta.pulsesTs ? new Date(meta.pulsesTs).toISOString() : null,
          telemetryTimestamp: telemetryTimestamp ? new Date(telemetryTimestamp).toISOString() : null,
          shortDelayMins,
          apiRow: apiRow ? '✅ present' : '❌ null',
        }
      );
    }

    // RFC-0078: For energy devices with 'power_on' status, refine using power ranges
    const isEnergyDevice = domain === 'energy';
    if (isEnergyDevice && deviceStatus === 'power_on' && meta.consumption !== undefined) {
      // Use device-level limits (TIER 0) first, then customer-level (TIER 2)
      const deviceMapLimits = meta.deviceMapInstaneousPower
        ? typeof meta.deviceMapInstaneousPower === 'string'
          ? JSON.parse(meta.deviceMapInstaneousPower)
          : meta.deviceMapInstaneousPower
        : null;
      const customerLimits = window.MyIOUtils?.mapInstantaneousPower || null;
      const limitsToUse = deviceMapLimits || customerLimits;

      if (limitsToUse) {
        const deviceTypeForRanges = meta.deviceProfile || meta.deviceType || '3F_MEDIDOR';
        const ranges = extractLimitsFromJSON(limitsToUse, deviceTypeForRanges, 'consumption');

        if (ranges && typeof window.MyIOLibrary?.calculateDeviceStatusWithRanges === 'function') {
          const delayMins = window.MyIOUtils?.getDelayTimeConnectionInMins?.(deviceProfile) ?? 1440;
          deviceStatus = window.MyIOLibrary.calculateDeviceStatusWithRanges({
            connectionStatus: meta.connectionStatus,
            lastConsumptionValue: meta.consumption,
            ranges: ranges,
            telemetryTimestamp: telemetryTimestamp,
            delayTimeConnectionInMins: delayMins,
          });
        }
      }
    }

    // DEBUG: Forced tracking for specific device
    debugLabel = meta.label || meta.identifier || overrides.label || '';
    const isDebugDevice = debugLabel.includes('3F SCMAL3L4304ABC') || debugLabel.includes('SCMAL3L4304ABC');
    if (isDebugDevice) {
      const lib = window.MyIOLibrary;
      const delayMins = window.MyIOUtils?.getDelayTimeConnectionInMins?.(deviceProfile) ?? 1440;
      const shortDelayMins = 60;
      const telemetryStale = lib?.isTelemetryStale
        ? lib.isTelemetryStale(telemetryTimestamp, delayMins)
        : 'N/A (lib not available)';
      console.warn(`🔴 [DEBUG MAIN_VIEW RFC-0110 v5] createOrchestratorItem for "${debugLabel}":`, {
        entityId,
        connectionStatus: meta.connectionStatus,
        calculatedDeviceStatus: deviceStatus,
        // RFC-0110 v5: Domain and timestamp info
        domain,
        telemetryTimestamp,
        telemetryTimestampFormatted: telemetryTimestamp ? new Date(telemetryTimestamp).toISOString() : 'N/A',
        lastActivityTime: meta.lastActivityTime,
        lastActivityTimeFormatted: meta.lastActivityTime
          ? new Date(meta.lastActivityTime).toISOString()
          : 'N/A',
        telemetryStale,
        delayMins,
        shortDelayMins,
        now: new Date().toISOString(),
      });
    }

    // Base item with common fields
    const baseItem = {
      // Identifiers
      id: entityId,
      tbId: entityId,
      ingestionId: meta.ingestionId || null,
      identifier: meta.identifier || '',

      // Labels
      label: meta.label || meta.identifier || '',
      entityLabel: meta.label || meta.identifier || '',
      name: meta.label || meta.identifier || '',

      // Device classification
      deviceType: meta.deviceType || '',
      deviceProfile: meta.deviceProfile || '',
      effectiveDeviceType: meta.deviceProfile || meta.deviceType || null,

      // Status (RFC-0109 + RFC-0110)
      deviceStatus: deviceStatus,
      connectionStatus: meta.connectionStatus || 'unknown',

      // Central/gateway info
      centralId: meta.centralId || apiRow?.centralId || null,
      centralName: meta.centralName || null,
      slaveId: meta.slaveId || apiRow?.slaveId || null,

      // Timestamps
      createdTime: meta.createdTime || null,
      lastActivityTime: meta.lastActivityTime || null,
      lastConnectTime: meta.lastConnectTime || null,
      lastDisconnectTime: meta.lastDisconnectTime || null,

      // RFC-0110 v5: Telemetry timestamps for offline detection
      consumptionTs: meta.consumptionTs || null,
      pulsesTs: meta.pulsesTs || null,
      waterLevelTs: meta.waterLevelTs || null,
      waterPercentageTs: meta.waterPercentageTs || null,
      temperatureTs: meta.temperatureTs || null,

      // Temperature offset - used to adjust displayed temperature value
      offSetTemperature: meta.offSetTemperature || 0,

      // Annotations
      log_annotations: meta.log_annotations || null,
      excludeGroupsTotals: meta.excludeGroupsTotals || null,

      // RFC-0183: GCDR device UUID for AlarmServiceOrchestrator badge lookup
      gcdrDeviceId: meta.gcdrDeviceId || null,
      // RFC-0152: Per-device GCDR mapping fields (server_scope attrs for TB↔GCDR sync audit)
      gcdrCustomerId: meta.gcdrCustomerId || null,
      gcdrAssetId: meta.gcdrAssetId || null,
      gcdrSyncAt: meta.gcdrSyncAt || null,
      // ThingsBoard entity name (raw, before label override)
      entityName: meta.entityName || '',

      // Metadata flags
      _hasMetadata: true,
    };

    // Merge with domain-specific overrides
    return { ...baseItem, ...overrides };
  }

  /**
   * RFC-0106: Datasource alias whitelist by domain
   * Each domain has a specific datasource that contains device metadata
   */
  const ALLOWED_ALIASES_BY_DOMAIN = {
    energy: 'all3fs', // Energy domain: All3Fs datasource
    water: 'allhidrosdevices', // Water domain: AllHidrosDevices datasource
    temperature: 'alltempdevices', // Temperature domain: AllTempDevices datasource
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

    // DEBUG: Counter for consumption timestamp debugging
    let _debugConsumptionCount = 0;
    const _debugConsumptionMax = 8;

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
      else if (keyName === 'connectionstatus') {
        meta.connectionStatus = val;
        // RFC-0110: Extract timestamp of connectionStatus for stale check
        meta.connectionStatusTs = row?.data?.[0]?.[0] ?? null;
      } else if (keyName === 'lastactivitytime') meta.lastActivityTime = val;
      else if (keyName === 'createdtime') meta.createdTime = val;
      else if (keyName === 'lastconnecttime') meta.lastConnectTime = val;
      else if (keyName === 'lastdisconnecttime') meta.lastDisconnectTime = val;
      else if (keyName === 'log_annotations') meta.log_annotations = val;
      else if (keyName === 'exclude_groups_totals') meta.excludeGroupsTotals = val;
      // RFC-0183: GCDR device UUID — needed for AlarmServiceOrchestrator badge lookup
      else if (keyName === 'gcdrdeviceid') meta.gcdrDeviceId = val;
      // RFC-0152: Per-device GCDR mapping fields (server_scope attrs for TB↔GCDR sync audit)
      else if (keyName === 'gcdrcustomerid') meta.gcdrCustomerId = val;
      else if (keyName === 'gcdrassetid') meta.gcdrAssetId = val;
      else if (keyName === 'gcdrsyncat') meta.gcdrSyncAt = val;
      // Only override label if dataKey has a non-empty value
      // Otherwise keep the entityLabel/entityName fallback from initialization
      else if (keyName === 'label' && val && String(val).trim() !== '') meta.label = val;
      // Energy-specific fields
      else if (keyName === 'devicemapinstaneouspower') meta.deviceMapInstaneousPower = val;
      else if (keyName === 'consumption') {
        meta.consumption = val; // instantaneous power in Watts
        // RFC-0110: Extract timestamp for telemetry-based offline detection
        // NOTE: Timestamp 0 (epoch 1970) is invalid - ThingsBoard returns 0 when no data
        const ts = row?.data?.[0]?.[0];
        meta.consumptionTs = ts && ts > 0 ? ts : null;

        // DEBUG: Log first 8 consumption timestamps
        if (_debugConsumptionCount < _debugConsumptionMax) {
          _debugConsumptionCount++;
          console.log(`🔍 [DEBUG RFC-0110] consumption timestamp #${_debugConsumptionCount}:`, {
            entityName: meta.entityName || meta.label,
            consumption: val,
            'row.data': row?.data,
            'row.data[0]': row?.data?.[0],
            'row.data[0][0] (ts)': ts,
            'consumptionTs (final)': meta.consumptionTs,
          });
        }
      }
      // Water-specific fields
      else if (keyName === 'pulses') {
        meta.pulses = val;
        // RFC-0110: Extract timestamp for telemetry-based offline detection
        // NOTE: Timestamp 0 (epoch 1970) is invalid - ThingsBoard returns 0 when no data
        const ts = row?.data?.[0]?.[0];
        meta.pulsesTs = ts && ts > 0 ? ts : null;
      } else if (keyName === 'litersperpulse') meta.litersPerPulse = val;
      else if (keyName === 'volume') meta.volume = val;
      // Tank-specific fields (TANK/CAIXA_DAGUA)
      else if (keyName === 'water_level') {
        meta.waterLevel = val;
        // RFC-0110: Extract timestamp for telemetry-based offline detection
        // NOTE: Timestamp 0 (epoch 1970) is invalid - ThingsBoard returns 0 when no data
        const ts = row?.data?.[0]?.[0];
        meta.waterLevelTs = ts && ts > 0 ? ts : null;
      } else if (keyName === 'water_percentage') {
        meta.waterPercentage = val;
        // RFC-0110: Extract timestamp for telemetry-based offline detection
        // NOTE: Timestamp 0 (epoch 1970) is invalid - ThingsBoard returns 0 when no data
        const ts = row?.data?.[0]?.[0];
        meta.waterPercentageTs = ts && ts > 0 ? ts : null;
      }
      // Temperature-specific fields
      else if (keyName === 'temperature') {
        meta.temperature = val;
        // RFC-0110: Extract timestamp for telemetry-based offline detection
        // NOTE: Timestamp 0 (epoch 1970) is invalid - ThingsBoard returns 0 when no data
        const ts = row?.data?.[0]?.[0];
        meta.temperatureTs = ts && ts > 0 ? ts : null;
      }
      // Temperature offset field - used to adjust displayed temperature
      else if (
        keyName === 'offsettemperature' ||
        keyName === 'offSetTemperature' ||
        keyName === 'offset_temperature'
      ) {
        meta.offSetTemperature = Number(val) || 0;
        console.warn(
          `🌡️ [MAIN_VIEW] Found offSetTemperature for device "${meta.label || meta.entityName}": ${meta.offSetTemperature}`
        );
      }
    }

    // DEBUG: Log all unique dataKeys found for temperature domain
    if (domain === 'temperature') {
      const allDataKeys = new Set();
      for (const row of rows) {
        const aliasName = (row?.datasource?.aliasName || row?.datasource?.name || '').toLowerCase();
        if (aliasName === allowedAlias) {
          allDataKeys.add(row?.dataKey?.name || 'unknown');
        }
      }
      console.warn(
        `🌡️ [MAIN_VIEW DEBUG] All dataKeys found for temperature domain:`,
        Array.from(allDataKeys)
      );
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

    return { byIngestion: metadataByIngestion, byEntityId: metadataByEntityId };
  }

  /**
   * RFC-0106: Wait for ctx.data to be populated with datasources
   * This prevents the timing issue where API is called before ThingsBoard loads datasources
   * RFC-0138: Now also validates period when checking cache
   */
  async function waitForCtxData(maxWaitMs = 20000, checkIntervalMs = 200, domain = null, period = null) {
    const startTime = Date.now();
    // RFC-0138: Compute expected period key for cache validation
    const expectedPeriodKey = domain && period ? periodKey(domain, period) : null;

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
      // RFC-0138 FIX: Also verify period matches before returning cached data
      if (domain) {
        const cachedData = window.MyIOOrchestratorData?.[domain];
        if (cachedData && cachedData.items && cachedData.items.length > 0) {
          const cacheAge = Date.now() - (cachedData.timestamp || 0);
          const periodMatches = !expectedPeriodKey || cachedData.periodKey === expectedPeriodKey;

          if (cacheAge < 30000 && periodMatches) {
            LogHelper.log(
              `[Orchestrator] ✅ Data already available in cache for ${domain} (${cachedData.items.length} items, age: ${cacheAge}ms, period: matched) - exiting wait`
            );
            return 'cached'; // Special return to indicate cached data is available
          } else if (cacheAge < 30000 && !periodMatches) {
            LogHelper.log(
              `[Orchestrator] 🔄 RFC-0138: Cache exists but period mismatch in waitForCtxData - will fetch fresh data`
            );
            // Don't return cached, continue waiting for ctx.data or timeout
          }
        }
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
    }

    // Timeout - check one more time if cache is available before failing
    // RFC-0138: Also verify period matches
    if (domain) {
      const cachedData = window.MyIOOrchestratorData?.[domain];
      if (cachedData && cachedData.items && cachedData.items.length > 0) {
        const periodMatches = !expectedPeriodKey || cachedData.periodKey === expectedPeriodKey;
        if (periodMatches) {
          LogHelper.log(
            `[Orchestrator] ✅ Timeout but cache available for ${domain} (${cachedData.items.length} items, period: matched)`
          );
          return 'cached';
        } else {
          LogHelper.log(
            `[Orchestrator] 🔄 RFC-0138: Timeout, cache exists but period mismatch for ${domain}`
          );
        }
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

    // RFC-0140 FIX: Check if retry is locked for this domain to prevent infinite loop
    // When metadataMap.size === 0 persists, don't keep retrying
    if (window._dataLoadRetryLocked?.[lastFetchDomain]) {
      LogHelper.log(
        `[Orchestrator] ⏭️ checkAndRefetchIfNeeded: retry locked for ${lastFetchDomain}, stopping`
      );
      ctxDataWasEmpty = false;
      lastFetchDomain = null;
      lastFetchPeriod = null;
      return;
    }

    // RFC-0140 FIX: Also check if data already exists in cache (another call succeeded)
    const cachedData = window.MyIOOrchestratorData?.[lastFetchDomain];
    if (cachedData?.items?.length > 0) {
      LogHelper.log(
        `[Orchestrator] ✅ checkAndRefetchIfNeeded: data already in cache for ${lastFetchDomain} (${cachedData.items.length} items), skipping re-fetch`
      );
      ctxDataWasEmpty = false;
      lastFetchDomain = null;
      lastFetchPeriod = null;
      return;
    }

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
      // RFC-0138 FIX: Also verify periodKey matches to avoid returning stale data for different period
      const cachedData = window.MyIOOrchestratorData?.[domain];
      const currentPeriodKey = periodKey(domain, period);
      if (cachedData && cachedData.items && cachedData.items.length > 0) {
        const cacheAge = Date.now() - (cachedData.timestamp || 0);
        const periodMatches = cachedData.periodKey === currentPeriodKey;

        // Use cache if less than 30 seconds old AND period matches
        if (cacheAge < 30000 && periodMatches) {
          LogHelper.log(
            `[Orchestrator] ✅ Using cached data for ${domain}: ${cachedData.items.length} items (age: ${cacheAge}ms, period: matched)`
          );

          return cachedData.items;
        } else if (cachedData && !periodMatches) {
          // RFC-0138: Cache exists but period doesn't match - will fetch fresh data
          LogHelper.log(
            `[Orchestrator] 🔄 RFC-0138: Cache period mismatch for ${domain}, fetching fresh data`,
            { cachedPeriod: cachedData.periodKey, requestedPeriod: currentPeriodKey }
          );
        }
      }

      // Temperature domain: uses ctx.data (real-time) + optional Data Apps API for lastTelemetryTs
      if (domain === 'temperature') {
        const useApi = widgetSettings.enableTemperatureApiDataFetch ?? false;
        LogHelper.log(
          `[Orchestrator] 🌡️ Temperature domain - ctx.data${useApi ? ' + API (RFC-0189)' : ' only'}`
        );

        // RFC-0138: Pass period to validate cache
        const ctxDataReady = await waitForCtxData(20000, 200, domain, period);

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

        // RFC-0189: Per-device API calls over the last 72h to derive lastTelemetryTs and last temperature value
        // Key: ingestionId → Unix ms timestamp / raw sensor value of last consumption entry
        const apiTsMap = new Map();
        const apiValueMap = new Map(); // ingestionId → last temperature value (°C, raw before offset)

        if (useApi) {
          try {
            const latestCreds = window.MyIOOrchestrator?.getCredentials?.();
            if (!latestCreds?.CLIENT_ID || !latestCreds?.CLIENT_SECRET) {
              throw new Error('Missing CLIENT_ID or CLIENT_SECRET for temperature API fetch');
            }
            const MyIO =
              (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) ||
              (typeof window !== 'undefined' && window.MyIOLibrary) ||
              null;
            if (!MyIO) throw new Error('MyIOLibrary not available');
            const myIOAuth = MyIO.buildMyioIngestionAuth({
              dataApiHost: DATA_API_HOST,
              clientId: latestCreds.CLIENT_ID,
              clientSecret: latestCreds.CLIENT_SECRET,
            });
            const token = await myIOAuth.getToken();

            // Fixed 72-hour window — independent of the dashboard period
            const endTime = new Date().toISOString();
            const startTime = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

            const devicesWithIngestionId = [...metadataByEntityId.values()].filter(
              (meta) => !!meta.ingestionId
            );

            LogHelper.log(
              `[Orchestrator] 🌡️ RFC-0189: Fetching temperature API for ${devicesWithIngestionId.length} devices (last 72h)`
            );

            const results = await Promise.allSettled(
              devicesWithIngestionId.map(async (meta) => {
                const url = new URL(
                  `${DATA_API_HOST}/api/v1/telemetry/devices/${meta.ingestionId}/temperature`
                );
                url.searchParams.set('startTime', startTime);
                url.searchParams.set('endTime', endTime);
                url.searchParams.set('granularity', '1h');
                url.searchParams.set('deep', '0');

                const res = await fetch(url.toString(), {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return null;

                const json = await res.json();
                const rows = Array.isArray(json) ? json : [];
                const row = rows.find((r) => r.id === meta.ingestionId) || rows[0] || null;

                if (!row || !Array.isArray(row.consumption) || row.consumption.length === 0) {
                  return null;
                }

                // Last entry = most recent data point from ingestion backend
                const lastEntry = row.consumption[row.consumption.length - 1];
                const lastTelemetryTs = lastEntry?.timestamp ? new Date(lastEntry.timestamp).getTime() : null;
                const lastValue =
                  lastEntry?.value !== undefined && lastEntry?.value !== null
                    ? Number(lastEntry.value)
                    : null;

                return lastTelemetryTs ? { ingestionId: meta.ingestionId, lastTelemetryTs, lastValue } : null;
              })
            );

            for (const result of results) {
              if (result.status === 'fulfilled' && result.value) {
                apiTsMap.set(result.value.ingestionId, result.value.lastTelemetryTs);
                if (result.value.lastValue !== null) {
                  apiValueMap.set(result.value.ingestionId, result.value.lastValue);
                }
              }
            }

            LogHelper.log(
              `[Orchestrator] 🌡️ RFC-0189: lastTelemetryTs resolved for ${apiTsMap.size}/${devicesWithIngestionId.length} devices`
            );
          } catch (err) {
            LogHelper.warn('[Orchestrator] 🌡️ RFC-0189: Temperature API fetch failed:', err.message);
            // apiTsMap stays empty → all devices fall back to meta.temperatureTs
          }
        }

        // Build items from metadata (value = meta.temperature from ctx.data — ThingsBoard real-time)
        const items = [];
        for (const [entityId, meta] of metadataByEntityId.entries()) {
          const temperatureValue = Number(meta.temperature || 0);
          const tempOffset = Number(meta.offSetTemperature || 0);

          // Debug: Log if offset is found
          if (tempOffset !== 0) {
            console.warn(`🌡️ [MAIN_VIEW] Creating temperature item with offset:`, {
              label: meta.label || meta.identifier,
              rawTemperature: temperatureValue,
              offSetTemperature: tempOffset,
              adjustedTemperature: temperatureValue + tempOffset,
            });
          }

          // RFC-0189: inject lastTelemetryTs from API when available; null falls back to meta.temperatureTs via RFC-0188
          const lastTelemetryTs = meta.ingestionId ? (apiTsMap.get(meta.ingestionId) ?? null) : null;

          // RFC-0111: Use centralized factory
          items.push(
            createOrchestratorItem({
              entityId,
              meta,
              overrides: {
                label: meta.label || meta.identifier || 'Sensor',
                entityLabel: meta.label || meta.identifier || 'Sensor',
                name: meta.label || meta.identifier || 'Sensor',
                value: temperatureValue, // RFC-0189: API last value when enabled, else ctx.data
                temperature: temperatureValue,
                deviceType: meta.deviceType || 'TERMOSTATO',
                offSetTemperature: tempOffset,
                lastTelemetryTs, // RFC-0189 + RFC-0188: null when API disabled/unavailable (graceful fallback)
              },
            })
          );
        }

        // Populate window.STATE.temperature
        populateStateTemperature(items);

        LogHelper.log(
          `[Orchestrator] 🌡️ Temperature items: ${items.length}` +
            (useApi ? ` | API ts enriched: ${apiTsMap.size}` : ' | ctx.data only')
        );
        return items;
      }

      // RFC-0106: MUST wait for ctx.data to be populated BEFORE calling API
      // The flow is: ctx.data (metadata) → API (consumption) → match by ingestionId
      // Track domain/period for potential re-fetch if ctx.data loads later
      lastFetchDomain = domain;
      lastFetchPeriod = period;

      // RFC-0138: Pass period to validate cache
      const ctxDataReady = await waitForCtxData(20000, 200, domain, period);

      // If cached data is available, return it directly (another call already fetched)
      // RFC-0138: This is now safe because waitForCtxData validates period
      if (ctxDataReady === 'cached') {
        const cachedData = window.MyIOOrchestratorData?.[domain];
        LogHelper.log(
          `[Orchestrator] ✅ Using cached ${domain} data: ${cachedData?.items?.length || 0} items`
        );
        return cachedData?.items || [];
      }

      if (!ctxDataReady) {
        // RFC-0140 FIX: Only mark for re-fetch if not already locked
        if (!window._dataLoadRetryLocked?.[domain]) {
          // Mark that ctx.data was empty - will trigger re-fetch when data arrives
          ctxDataWasEmpty = true;
          LogHelper.warn(
            `[Orchestrator] ⚠️ ctx.data not ready - skipping API call, will auto-refetch when available`
          );

          // RFC-0106: Show toast and reload page when ctx.data fails to load
          window.MyIOUtils?.handleDataLoadError(domain, 'ctx.data timeout - datasources not loaded');
        } else {
          LogHelper.warn(
            `[Orchestrator] ⚠️ ctx.data not ready but retry locked for ${domain} - not retrying`
          );
        }

        return []; // DO NOT call API without metadata
      }

      // RFC-0106: Build metadata map FIRST from ctx.data (filtered by domain's datasource)
      const { byIngestion: metadataMap, byEntityId: metadataByEntityId } =
        buildMetadataMapFromCtxData(domain);

      // RFC-0107: For water domain, check for tank and hidrometro devices from ctx.data
      // TANK/CAIXA_DAGUA get data directly from ThingsBoard (water_level, water_percentage)
      // HIDROMETRO devices also need to be included from ctx.data (they have pulses)
      let tankItems = [];
      let hidrometroItems = [];
      if (domain === 'water' && metadataByEntityId.size > 0) {
        // DEBUG: Log all water device types
        const waterDeviceTypes = [];
        for (const [, meta] of metadataByEntityId.entries()) {
          waterDeviceTypes.push(meta.deviceType || 'N/A');
        }
        LogHelper.log(`[Orchestrator] 🔍 DEBUG Water device types: ${waterDeviceTypes.join(', ')}`);

        for (const [entityId, meta] of metadataByEntityId.entries()) {
          const deviceType = String(meta.deviceType || '').toUpperCase();
          const deviceProfile = String(meta.deviceProfile || '').toUpperCase();
          // RFC-0107: Detect tank devices by:
          // 1. deviceType = TANK or CAIXA_DAGUA
          // 2. OR has water_level/water_percentage data (even without deviceType)
          // BUT EXCLUDE hidrometers (devices with pulses data or HIDROMETRO deviceType)
          const hasWaterLevelData = meta.waterLevel !== undefined || meta.waterPercentage !== undefined;
          const isTankByType = deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA';
          // Check for hidrometers: deviceType contains HIDROMETRO
          const isHidrometer = deviceType.includes('HIDROMETRO');

          // RFC-0107: Build HIDROMETRO items from ctx.data
          // Categorization based on deviceType AND deviceProfile:
          // - HIDROMETRO_SHOPPING → Entrada (main water meter)
          // - HIDROMETRO_AREA_COMUM → Área Comum (common area meters)
          // - HIDROMETRO with profile = HIDROMETRO or empty → Lojas (store meters)
          if (isHidrometer) {
            const pulses = Number(meta.pulses || 0);
            const dp = (deviceProfile || '').toUpperCase();
            const dt = deviceType.toUpperCase();

            // Determine labelWidget based on deviceType and deviceProfile
            let labelWidget = 'Lojas'; // Default: store meters
            let isEntradaDevice = false;

            if (dt === 'HIDROMETRO_SHOPPING' || dp === 'HIDROMETRO_SHOPPING') {
              labelWidget = 'Entrada';
              isEntradaDevice = true;
            } else if (dt === 'HIDROMETRO_AREA_COMUM' || dp === 'HIDROMETRO_AREA_COMUM') {
              labelWidget = 'Área Comum';
            }
            // else: HIDROMETRO with profile = HIDROMETRO or empty → Lojas

            // RFC-0111: Use centralized factory
            hidrometroItems.push(
              createOrchestratorItem({
                entityId,
                meta,
                overrides: {
                  label: meta.label || meta.identifier || 'Hidrômetro',
                  entityLabel: meta.label || meta.identifier || 'Hidrômetro',
                  name: meta.label || meta.identifier || 'Hidrômetro',
                  value: 0, // RFC-0108 FIX: Use 0 as placeholder - real value comes from API enrichment
                  pulses: pulses,
                  deviceType: deviceType,
                  deviceProfile: deviceProfile || deviceType,
                  effectiveDeviceType: deviceProfile || deviceType,
                  labelWidget: labelWidget,
                  groupLabel: labelWidget,
                  _isHidrometerDevice: isEntradaDevice,
                },
              })
            );
            continue;
          }

          if (isTankByType || hasWaterLevelData) {
            const waterLevel = Number(meta.waterLevel || 0);
            const waterPercentage = Number(meta.waterPercentage || 0);

            // RFC-0111: Use centralized factory
            tankItems.push(
              createOrchestratorItem({
                entityId,
                meta,
                overrides: {
                  label: meta.label || meta.identifier || "Caixa d'água",
                  entityLabel: meta.label || meta.identifier || "Caixa d'água",
                  name: meta.label || meta.identifier || "Caixa d'água",
                  value: waterLevel,
                  waterLevel: waterLevel,
                  waterPercentage: waterPercentage,
                  deviceType: deviceType || 'TANK',
                  deviceProfile: meta.deviceProfile || deviceType || 'TANK',
                  effectiveDeviceType: meta.deviceProfile || deviceType || 'TANK',
                  labelWidget: "Caixa D'Água",
                  groupLabel: "Caixa D'Água",
                  _isTankDevice: true,
                },
              })
            );
          }
        }

        if (tankItems.length > 0) {
          LogHelper.log(
            `[Orchestrator] 🚰 Found ${tankItems.length} tank devices (TANK/CAIXA_DAGUA) in water domain`
          );
        }
        if (hidrometroItems.length > 0) {
          LogHelper.log(
            `[Orchestrator] 🚿 Found ${hidrometroItems.length} hidrometro devices in water domain`
          );
        }
      }

      // RFC-0107: Combine water devices from ctx.data (tanks + hidrometros)
      const waterDevicesFromCtx = [...tankItems, ...hidrometroItems];

      if (metadataMap.size === 0 && waterDevicesFromCtx.length === 0) {
        // RFC-0140 FIX: Check if we have devices in metadataByEntityId (but without ingestionId)
        // If so, create basic items without API enrichment instead of failing
        if (metadataByEntityId.size > 0) {
          LogHelper.warn(
            `[Orchestrator] ⚠️ RFC-0140: No devices with ingestionId, but found ${metadataByEntityId.size} devices in ctx.data - creating basic items without API enrichment`
          );

          // Create basic items from metadataByEntityId
          const basicItems = [];
          for (const [entityId, meta] of metadataByEntityId.entries()) {
            const item = createOrchestratorItem({
              entityId,
              meta,
              apiRow: null, // No API data available
              overrides: {
                // RFC-0140: Use "-" (null) for consumption when no API enrichment
                // This indicates "no data available" instead of showing 0
                value: null,
                consumption: null,
                _noApiEnrich: true, // Flag to indicate no API enrichment
              },
            });
            basicItems.push(item);
          }

          LogHelper.log(
            `[Orchestrator] ✅ RFC-0140: Created ${basicItems.length} basic items from ctx.data (no API enrichment)`
          );

          // Populate state and return
          const basicPeriodKey = `${domain}:${period.startISO}:${period.endISO}:${period.granularity}:basic`;
          populateState(domain, basicItems, basicPeriodKey);
          return basicItems;
        }

        LogHelper.warn(`[Orchestrator] ⚠️ Metadata map is empty - no devices found in ctx.data`);
        // RFC-0140 FIX: Do NOT set ctxDataWasEmpty = true here!
        // When metadataMap is empty but ctx.data has rows, it means the whitelist/alias
        // filtering is not finding the expected datasource. Retrying won't help.
        // Setting ctxDataWasEmpty would cause checkAndRefetchIfNeeded to loop infinitely.

        // RFC-0106: Show toast and reload page when metadata map is empty
        // RFC-0140 FIX: Only call handleDataLoadError if not already locked
        if (!window._dataLoadRetryLocked?.[domain]) {
          window.MyIOUtils?.handleDataLoadError(domain, 'no devices found in datasource');
        }

        return []; // No metadata = no point calling API
      }

      // If we only have water devices from ctx.data and no devices with ingestionId, return them directly
      if (metadataMap.size === 0 && waterDevicesFromCtx.length > 0) {
        LogHelper.log(
          `[Orchestrator] 🚰 Only water devices from ctx.data found - skipping API call, returning ${waterDevicesFromCtx.length} items (${tankItems.length} tanks, ${hidrometroItems.length} hidrometros)`
        );
        const waterPeriodKey = `water:${domain}:${period.startISO}:${period.endISO}:${period.granularity}`;
        populateState(domain, waterDevicesFromCtx, waterPeriodKey);
        return waterDevicesFromCtx;
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
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          emitTokenExpired();
        }
        throw new Error(`API error: ${res.status}`);
      }

      const json = await res.json();

      const rows = Array.isArray(json) ? json : (json?.data ?? []);

      // RFC-0108: Use METADATA as base, enrich with API data
      // If no API match found, keep item with value=0 (don't discard)
      // This ensures all devices from ThingsBoard datasource are displayed

      // RFC-0106: Value field differs by domain:
      // - energy: total_value (kWh)
      // - water: total_value (m³) - API returns total_value for both domains
      const getValueFromRow = (row) => {
        if (!row) return 0;
        // Both energy and water use total_value from API
        // Water API may also return total_volume or total_pulses as alternatives
        if (domain === 'water') {
          const val = Number(row.total_value ?? row.total_volume ?? row.total_pulses ?? 0);
          return val;
        }
        // Energy: total_value
        return Number(row.total_value || 0);
      };

      // RFC-0108: Build API data map by ingestionId for quick lookup
      const apiDataMap = new Map();
      // RFC-0108 FIX: Also build name-based map as fallback for devices without ingestionId
      const apiDataByName = new Map();
      for (const row of rows) {
        if (row.id) {
          apiDataMap.set(row.id, row);
        }
        // Build normalized name map (lowercase, trimmed) for fallback matching
        if (row.name) {
          const normalizedName = String(row.name).toLowerCase().trim();
          if (!apiDataByName.has(normalizedName)) {
            apiDataByName.set(normalizedName, row);
          }
        }
      }
      LogHelper.log(
        `[Orchestrator] 📊 API data map: ${apiDataMap.size} items by ID, ${apiDataByName.size} by name`
      );

      // RFC-0108: Compare metadata ingestionIds with API ids
      if (domain === 'water') {
        const metaIngestionIds = new Set();
        for (const [, meta] of metadataByEntityId.entries()) {
          if (meta.ingestionId) metaIngestionIds.add(meta.ingestionId);
        }
        const apiIds = new Set(apiDataMap.keys());

        // Find IDs in API but not in metadata
        const apiOnly = [...apiIds].filter((id) => !metaIngestionIds.has(id));
        // Find IDs in metadata but not in API
        const metaOnly = [...metaIngestionIds].filter((id) => !apiIds.has(id));

        if (apiOnly.length > 0 || metaOnly.length > 0) {
          LogHelper.log(
            `[RFC-0108] Water ID mismatch: ${apiOnly.length} API-only, ${metaOnly.length} meta-only`
          );
        }
      }

      // RFC-0108: Create items from METADATA (ctx.data) as base
      // Enrich with API data if available, otherwise value=0
      const domainLower = domain.toLowerCase();
      const items = [];
      let matchedCount = 0;
      let unmatchedCount = 0;

      let nameMatchedCount = 0;

      for (const [entityId, meta] of metadataByEntityId.entries()) {
        // Skip if no ingestionId in metadata
        const ingestionId = meta.ingestionId;

        // Try to find API data by ingestionId first
        let apiRow = ingestionId ? apiDataMap.get(ingestionId) : null;
        let matchedBy = apiRow ? 'ingestionId' : null;

        // RFC-0108 FIX: Fallback to name-based matching if ingestionId doesn't match
        if (!apiRow && domain === 'water') {
          const metaLabel = (meta.label || meta.entityName || '').toLowerCase().trim();
          if (metaLabel && apiDataByName.has(metaLabel)) {
            apiRow = apiDataByName.get(metaLabel);
            matchedBy = 'name';
            nameMatchedCount++;
          }
        }

        const hasApiData = !!apiRow;

        if (hasApiData) {
          matchedCount++;
        } else {
          unmatchedCount++;
        }

        // Use metadata from ThingsBoard datasource (ctx.data) - NO FALLBACKS for deviceType
        const rawDeviceType = meta.deviceType || null;
        const deviceProfile = meta.deviceProfile || null;

        // MASTER RULE for deviceType:
        // - If deviceType = deviceProfile = '3F_MEDIDOR' → keep as '3F_MEDIDOR' (it's a loja)
        // - If deviceType = '3F_MEDIDOR' AND deviceProfile != '3F_MEDIDOR' → force deviceType = deviceProfile
        let deviceType = rawDeviceType;
        if (rawDeviceType === '3F_MEDIDOR' && deviceProfile && deviceProfile !== '3F_MEDIDOR') {
          deviceType = deviceProfile;
        }

        // Skip items with deviceType = domain (placeholder)
        const dt = (deviceType || '').toLowerCase();
        if (dt === domainLower) {
          continue;
        }

        const identifier = meta.identifier || 'N/A';
        // RFC-0108: Use label from datasource, fallback to entityName without customer suffix
        // entityName format: "Device Name (Customer Name)" → extract just "Device Name"
        // Also clean meta.label if it has the suffix (when entityLabel was not set)
        let entityNameClean = meta.entityName || '';
        if (entityNameClean.includes(' (') && entityNameClean.endsWith(')')) {
          entityNameClean = entityNameClean.substring(0, entityNameClean.lastIndexOf(' ('));
        }
        let labelClean = meta.label || '';
        if (labelClean.includes(' (') && labelClean.endsWith(')')) {
          labelClean = labelClean.substring(0, labelClean.lastIndexOf(' ('));
        }
        const label = labelClean || entityNameClean || 'SEM ETIQUETA';
        const name = apiRow?.name || entityNameClean || '';

        // Infer labelWidget from deviceType/deviceProfile
        const labelWidget = inferLabelWidget({
          deviceType: deviceType,
          deviceProfile: deviceProfile,
          identifier: identifier,
          name: name,
        });

        // RFC-0111: Use centralized factory
        items.push(
          createOrchestratorItem({
            entityId,
            meta,
            apiRow,
            overrides: {
              id: ingestionId || entityId,
              identifier: identifier,
              deviceIdentifier: identifier,
              label: label,
              entityLabel: label,
              name: name,
              value: getValueFromRow(apiRow),
              perc: 0,
              deviceType: deviceType,
              deviceProfile: deviceProfile,
              effectiveDeviceType: deviceProfile || deviceType || null,
              // API-specific fields
              gatewayId: apiRow?.gatewayId || null,
              customerId: apiRow?.customerId || null,
              assetId: apiRow?.assetId || null,
              assetName: apiRow?.assetName || null,
              // RFC-0188: authoritative offline timestamp from ingestion backend (ISO-8601 → Unix ms)
              lastTelemetryTs: apiRow?.lastTelemetryTs ? new Date(apiRow.lastTelemetryTs).getTime() : null,
              // Power limits and instantaneous power
              deviceMapInstaneousPower: meta.deviceMapInstaneousPower || null,
              consumptionPower: meta.consumption || null,
              labelWidget: labelWidget,
              groupLabel: labelWidget,
              _hasApiData: hasApiData,
              _matchedBy: matchedBy,
            },
          })
        );
      }

      LogHelper.log(
        `[Orchestrator] 📊 RFC-0108: Created ${items.length} items from metadata. API match: ${matchedCount} matched (${nameMatchedCount} by name), ${unmatchedCount} with value=0`
      );

      // Log unmatched devices (diagnostically useful when there are mismatches)
      if (domain === 'water') {
        const unmatchedDevices = items.filter((i) => !i._hasApiData && i.value === 0);
        if (unmatchedDevices.length > 0) {
          LogHelper.log(
            `[RFC-0108] Water: ${unmatchedDevices.length} unmatched devices (no API data, value=0)`,
            unmatchedDevices.slice(0, 5).map((d) => ({
              label: d.label,
              ingestionId: d.ingestionId || 'MISSING',
              labelWidget: d.labelWidget,
            }))
          );
        }
      }

      // RFC-0107: Combine with water devices from ctx.data (tanks + hidrometros)
      // RFC-0108 FIX: Merge API values from enriched items into hidrometroItems before combining
      let finalItems = items;
      if (tankItems.length > 0 || hidrometroItems.length > 0) {
        // Create map from tbId to enriched item data (API values)
        const enrichedItemsMap = new Map();
        for (const item of items) {
          if (item.tbId) {
            enrichedItemsMap.set(item.tbId, item);
          }
        }

        // Merge API values and deviceStatus into hidrometroItems
        // RFC-0188 FIX: hidrometroItems are built BEFORE the API call (no apiRow → deviceStatus = offline).
        // The enriched items (main loop) have the correct deviceStatus computed from apiRow.lastTelemetryTs.
        // We must copy deviceStatus + lastTelemetryTs (and related fields) from the enriched item.
        let mergedCount = 0;
        for (const hidro of hidrometroItems) {
          const enrichedItem = enrichedItemsMap.get(hidro.tbId);
          if (enrichedItem && enrichedItem._hasApiData) {
            // Copy API consumption value
            hidro.value = enrichedItem.value;
            hidro._hasApiData = true;
            hidro._matchedBy = enrichedItem._matchedBy;
            // RFC-0188 FIX: copy deviceStatus computed with correct apiRow.lastTelemetryTs
            const prevStatus = hidro.deviceStatus;
            hidro.deviceStatus = enrichedItem.deviceStatus;
            hidro.lastTelemetryTs = enrichedItem.lastTelemetryTs;
            hidro.lastTelemetryTsFormatted = enrichedItem.lastTelemetryTs
              ? new Date(enrichedItem.lastTelemetryTs).toISOString()
              : null;
            LogHelper.log(
              `[RFC-0188] Hidrometro merge "${hidro.label}": deviceStatus ${prevStatus} → ${hidro.deviceStatus}` +
                `, lastTelemetryTs=${hidro.lastTelemetryTsFormatted || 'null'}`
            );
            mergedCount++;
          } else {
            LogHelper.log(
              `[RFC-0188] Hidrometro "${hidro.label}" (tbId=${hidro.tbId}): no API match → deviceStatus kept as ${hidro.deviceStatus}`
            );
          }
        }

        if (mergedCount > 0) {
          LogHelper.log(
            `[Orchestrator] 🔄 RFC-0108/RFC-0188: Merged API values+status into ${mergedCount}/${hidrometroItems.length} hidrometros`
          );
        }

        // Create set of IDs already processed as tanks or hidrometros
        const waterDeviceIds = new Set([
          ...tankItems.map((i) => i.tbId),
          ...hidrometroItems.map((i) => i.tbId),
        ]);
        // Filter items to exclude duplicates
        const itemsWithoutWaterDevices = items.filter((i) => !waterDeviceIds.has(i.tbId));
        finalItems = [...itemsWithoutWaterDevices, ...tankItems, ...hidrometroItems];
        LogHelper.log(
          `[Orchestrator] 🚰 Combined ${itemsWithoutWaterDevices.length} metadata items + ${
            tankItems.length
          } tanks + ${hidrometroItems.length} hidrometros = ${finalItems.length} total (filtered ${
            items.length - itemsWithoutWaterDevices.length
          } duplicates)`
        );
      }

      LogHelper.log(`[Orchestrator] fetchAndEnrich: fetched ${finalItems.length} items for domain ${domain}`);
      return finalItems;
    } catch (error) {
      LogHelper.error(`[Orchestrator] fetchAndEnrich error for domain ${domain}:`, error);
      return [];
    }
  }

  // Fetch data for a domain and period
  // RFC-0138: Added options.force to bypass cooldown when switching domains via MENU
  async function hydrateDomain(domain, period, options = {}) {
    const { force = false } = options;
    const key = periodKey(domain, period);
    const startTime = Date.now();

    LogHelper.log(`[Orchestrator] hydrateDomain called for ${domain}:`, {
      key,
      inFlight: inFlight.has(key),
      force,
    });

    // Coalesce duplicate requests
    if (inFlight.has(key)) {
      LogHelper.log(`[Orchestrator] ⏭️ Coalescing duplicate request for ${key}`);
      return inFlight.get(key);
    }

    // Show busy overlay - pass force flag to bypass cooldown
    showGlobalBusy(domain, 'Carregando dados...', 25000, { force });

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

        // RFC-0048 FIX: Always stop this domain's monitor regardless of other active domains.
        // hideGlobalBusy returns early when total > 0 (e.g. 'contract' still active),
        // which would leave the energy/water/temperature monitor running and fire 30s later.
        widgetBusyMonitor.stopMonitoring(domain);

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
   * RFC-0130: Prover dados do cache imediatamente ao registrar tardiamente
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

      // RFC-0130: Se já temos dados em cache para este domínio, fornecer imediatamente ao widget "atrasado"
      const cached = window.MyIOOrchestratorData?.[domain];
      if (cached && cached.items && cached.items.length > 0) {
        const age = Date.now() - cached.timestamp;
        if (age < 120000) {
          // Aumentado para 2 minutos para maior resiliência em transições lentas
          LogHelper.log(
            `[Orchestrator] 🚀 Prover dados do cache (${Math.round(
              age / 1000
            )}s) para widget recém registrado: ${widgetId}`
          );
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('myio:telemetry:provide-data', {
                detail: {
                  domain,
                  periodKey: cached.periodKey,
                  items: cached.items,
                  isFromCache: true,
                  widgetId: widgetId,
                },
              })
            );
          }, 150); // Pequeno delay para garantir que o widget terminou de processar seu listener
        } else {
          LogHelper.log(
            `[Orchestrator] ⏭️ Cache stale (${Math.round(
              age / 1000
            )}s) para ${domain}, não enviando para ${widgetId}`
          );
        }
      }
    }
  }

  /**
   * Listener para widgets se registrarem
   */
  window.addEventListener('myio:widget:register', (ev) => {
    const { widgetId, domain } = ev.detail;
    registerWidget(widgetId, domain);
  });

  /**
   * RFC-0136: Listener for late-arriving widgets that are ready to receive data
   * When a widget signals it's ready, re-emit provide-data if we have cached data
   * This solves the race condition where widgets miss the initial provide-data event
   */
  window.addEventListener('myio:widget:ready', (ev) => {
    const { widgetId, domain, labelWidget, timestamp } = ev.detail;

    LogHelper.log(
      `[Orchestrator] 📡 RFC-0136: Widget ready - ${widgetId} (domain: ${domain}, labelWidget: ${labelWidget})`
    );

    // Check if we have cached data for this domain
    const cachedData = window.MyIOOrchestratorData?.[domain];
    if (!cachedData || !cachedData.items || cachedData.items.length === 0) {
      return;
    }

    // Validate cache freshness (60 seconds max)
    const age = Date.now() - (cachedData.timestamp || 0);
    if (age > 60000) {
      LogHelper.log(
        `[Orchestrator] ⚠️ RFC-0136: Cached data for ${domain} is stale (${Math.round(
          age / 1000
        )}s), not re-emitting`
      );
      return;
    }

    // Validate customer match
    const currentCustomerId = window.MyIOUtils?.customerTB_ID;
    const cachedPeriodKey = cachedData.periodKey || '';
    const cachedCustomerId = cachedPeriodKey.split(':')[0];

    if (currentCustomerId && cachedCustomerId && cachedCustomerId !== currentCustomerId) {
      LogHelper.warn(
        `[Orchestrator] 🚫 RFC-0136: Customer mismatch (cached: ${cachedCustomerId}, current: ${currentCustomerId})`
      );
      return;
    }

    // Re-emit provide-data event for this specific widget
    // Small delay to ensure widget's event listener is fully registered
    setTimeout(() => {
      LogHelper.log(
        `[Orchestrator] 📡 RFC-0136: Re-emitting provide-data for ${domain} (${cachedData.items.length} items) - triggered by ${widgetId}`
      );

      window.dispatchEvent(
        new CustomEvent('myio:telemetry:provide-data', {
          detail: {
            domain: domain,
            periodKey: cachedData.periodKey,
            items: cachedData.items,
            _reemit: true, // Flag to indicate this is a re-emission
            _triggeredBy: widgetId,
          },
        })
      );
    }, 50); // 50ms delay to ensure listener is ready
  });

  // Event listeners
  window.addEventListener('myio:update-date', (ev) => {
    LogHelper.log('[Orchestrator] 📅 Received myio:update-date event', ev.detail);

    // RFC-0130: Check if period changed - if so, clear cache for this domain
    const newPeriod = ev.detail.period;
    const periodChanged =
      !currentPeriod ||
      currentPeriod.startISO !== newPeriod?.startISO ||
      currentPeriod.endISO !== newPeriod?.endISO;

    if (periodChanged && visibleTab) {
      LogHelper.log(`[Orchestrator] 🔄 RFC-0130: Period changed, clearing cache for ${visibleTab}`);

      // Clear MyIOOrchestratorData cache
      if (window.MyIOOrchestratorData && window.MyIOOrchestratorData[visibleTab]) {
        delete window.MyIOOrchestratorData[visibleTab];
        LogHelper.log(`[Orchestrator] 🗑️ RFC-0130: Cleared MyIOOrchestratorData for ${visibleTab}`);
      }

      // Clear inFlight to allow new request
      inFlight.clear();
      LogHelper.log('[Orchestrator] 🗑️ RFC-0130: Cleared inFlight cache');
    }

    currentPeriod = newPeriod;

    // Cross-context emission removed - HEADER already handles this
    // No need to re-emit here as it creates infinite loop

    if (visibleTab && currentPeriod) {
      // RFC-0138: Pass force=true when period changed to bypass cooldown and show spinner
      const shouldForce = periodChanged;
      LogHelper.log(
        `[Orchestrator] 📅 myio:update-date → hydrateDomain(${visibleTab}, force=${shouldForce})`
      );
      hydrateDomain(visibleTab, currentPeriod, { force: shouldForce });
    }
  });

  window.addEventListener('myio:dashboard-state', (ev) => {
    const tab = ev.detail.tab;

    // Alarm view — activate alarm panel and skip domain hydration
    // Accept both 'alarm' (RFC-0178) and null/falsy (legacy, when MENU is not yet updated)
    if (tab === 'alarm' || !tab) {
      visibleTab = 'alarm';
      LogHelper.log('[Orchestrator] 🔔 myio:dashboard-state → alarm view activated');
      window.dispatchEvent(new CustomEvent('myio:alarm-content-activated'));
      return;
    }

    try {
      hideGlobalBusy(tab);
    } catch (_e) {
      // Silently ignore - busy indicator may not exist yet
    }

    // RFC-0130: Detect logic switch
    const stateChanged = visibleTab !== tab;
    visibleTab = tab;

    // RFC-0130: Check if cached data for this domain has 0 items (failed previous load)
    // If so, clear it to force a fresh fetch
    const cachedData = window.MyIOOrchestratorData?.[tab];
    if (cachedData && cachedData.items && cachedData.items.length === 0) {
      LogHelper.log(`[Orchestrator] 🗑️ RFC-0130: Clearing empty cache for ${tab} (previous load failed)`);
      delete window.MyIOOrchestratorData[tab];
      // Also clear inFlight to allow new request
      inFlight.clear();
    }

    if (visibleTab && currentPeriod) {
      // RFC-0130: Se trocou de tab e já temos dados em cache fresco, emitir imediatamente para atualizar UI antes de hidratar
      if (stateChanged && cachedData && cachedData.items && cachedData.items.length > 0) {
        const age = Date.now() - (cachedData.timestamp || 0);
        if (age < 120000) {
          LogHelper.log(
            `[Orchestrator] ⚡ Emitindo dados do cache fresco (${Math.round(
              age / 1000
            )}s) para tab ${visibleTab}`
          );
          emitProvide(visibleTab, cachedData.periodKey, cachedData.items);
        }
      }

      // RFC-0138: Pass force=true to bypass cooldown and show spinner when switching domains via MENU
      LogHelper.log(`[Orchestrator] 🔄 myio:dashboard-state → hydrateDomain(${visibleTab}, force=true)`);
      hydrateDomain(visibleTab, currentPeriod, { force: true });
    } else if (visibleTab && !currentPeriod) {
      // RFC-0130: No period yet - start retry loop to wait for period
      LogHelper.log(
        `[Orchestrator] ⏳ RFC-0130: myio:dashboard-state - no period, starting retry for ${visibleTab}`
      );
      requestDataWithRetry(visibleTab, null);
    } else {
      LogHelper.log(
        `[Orchestrator] ⏭️ myio:dashboard-state skipped (visibleTab=${visibleTab}, currentPeriod=${!!currentPeriod})`
      );
    }
  });

  // Exclusão de Grupos: runtime update from SettingsModal (no page refresh needed)
  window.addEventListener('myio:exclusion-groups-updated', (ev) => {
    _excludeGroupsTotals = ev.detail?.exclude_groups_totals ?? null;
    LogHelper.log('[MAIN_VIEW] exclusion groups updated:', _excludeGroupsTotals);
    const cachedEnergy = window.MyIOOrchestratorData?.energy;
    if (cachedEnergy && cachedEnergy.items && cachedEnergy.items.length > 0) {
      LogHelper.log(
        '[MAIN_VIEW] rebuilding energy summary from cache (' + cachedEnergy.items.length + ' items)'
      );
      emitProvide('energy', cachedEnergy.periodKey, cachedEnergy.items);
    } else if (currentPeriod) {
      hydrateDomain('energy', currentPeriod, { force: true });
    }
  });

  // Request-data listener with pending listeners support
  // RFC-0130: Enhanced with retry logic for resilient data loading
  window.addEventListener('myio:telemetry:request-data', async (ev) => {
    const { domain, period, widgetId, priority, isRetry } = ev.detail;

    LogHelper.log(
      `[Orchestrator] 📨 Received data request from widget ${widgetId} (domain: ${domain}, priority: ${priority}, isRetry: ${!!isRetry})`
    );

    // Skip disabled domains — prevents spurious retry loops when, e.g., an energy TELEMETRY
    // widget or handleDataLoadError emits this event on a water-only/temperature-only dashboard.
    if (widgetSettings.domainsEnabled && widgetSettings.domainsEnabled[domain] === false) {
      LogHelper.log(`[Orchestrator] ⏭️ Domain ${domain} is disabled (domainsEnabled), ignoring request`);
      return;
    }

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
        // RFC-0130: No period available - use retry mechanism
        LogHelper.log(
          `[Orchestrator] 📡 myio:telemetry:request-data - no period, starting retry for ${domain}`
        );
        OrchestratorState.loading[domain] = false;

        // Start retry in background (non-blocking)
        requestDataWithRetry(domain, null);
      }
    } catch (error) {
      LogHelper.error(`[Orchestrator] Error hydrating ${domain}:`, error);
      OrchestratorState.loading[domain] = false;
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

    // RFC-0130: Expose retry functions for external use
    requestDataWithRetry,
    waitForPeriodWithRetry,

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

    // RFC-0181: Return classified groups from cached domain data
    // Returns { lojas, entrada, areacomum, ocultos } for energy
    // Returns { lojas, entrada, areacomum, banheiros, ocultos } for water
    getEnergyGroups: () => {
      const items = window.MyIOOrchestratorData?.energy?.items || [];
      return categorizeItemsByGroup(items);
    },
    getWaterGroups: () => {
      const items = window.MyIOOrchestratorData?.water?.items || [];
      return categorizeItemsByGroupWater(items);
    },
    getTemperatureGroups: () => {
      const items = window.MyIOOrchestratorData?.temperature?.items || [];
      return categorizeItemsByGroupTemperature(items);
    },

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
      let customerTotal = 0;
      let equipmentsTotal = 0;
      let lojasTotal = 0;

      items.forEach((item) => {
        const value = Number(item.value) || Number(item.consumption) || 0;
        customerTotal += value;

        // Check if it's a store device (both deviceType AND deviceProfile are '3F_MEDIDOR')
        const deviceProfile = String(item.deviceProfile || '').toUpperCase();
        const deviceType = String(item.deviceType || '').toUpperCase();
        const isStore = deviceProfile === '3F_MEDIDOR' && deviceType === '3F_MEDIDOR';

        if (isStore) {
          lojasTotal += value;
        } else {
          equipmentsTotal += value;
        }
      });

      // Note: lojasTotal is calculated directly, not as difference
      // For backwards compatibility with old ENERGY widget, also provide 'difference'
      const energySummary = {
        customerTotal,
        unfilteredTotal: customerTotal,
        isFiltered: false,
        deviceCount: items.length,
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

    // ── RFC-0180: GCDR API methods ───────────────────────────────────────────
    // Owned by the orchestrator so widgets (AlarmsTab, etc.) don't carry
    // URL / API-key config — they always use the authoritative orchestrator state.

    async gcdrFetchCustomerRules() {
      const orch = window.MyIOOrchestrator;
      const url = `${orch.gcdrApiBaseUrl}/api/v1/customers/${encodeURIComponent(orch.gcdrCustomerId)}/rules`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': orch.gcdrApiKey,
          'X-Tenant-ID': orch.gcdrTenantId,
          Accept: 'application/json',
        },
      });
      if (response.status === 404) return [];
      if (!response.ok) throw new Error(`GCDR rules HTTP ${response.status}: ${response.statusText}`);
      const json = await response.json();
      return json.items ?? json.data?.items ?? [];
    },

    async gcdrPostAlarmAction(alarmId, action) {
      const orch = window.MyIOOrchestrator;
      const response = await fetch(
        `${orch.alarmsApiBaseUrl}/api/v1/alarms/${encodeURIComponent(alarmId)}/${action}`,
        {
          method: 'POST',
          headers: {
            'X-API-Key': orch.gcdrApiKey,
            'X-Tenant-ID': orch.gcdrTenantId,
          },
        }
      );
      return response.ok;
    },

    async gcdrPatchRuleScope(ruleId, entityIds) {
      const orch = window.MyIOOrchestrator;
      const response = await fetch(`${orch.gcdrApiBaseUrl}/api/v1/rules/${encodeURIComponent(ruleId)}`, {
        method: 'PATCH',
        headers: {
          'X-API-Key': orch.gcdrApiKey,
          'X-Tenant-ID': orch.gcdrTenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope: { type: 'DEVICE', entityIds } }),
      });
      return response.ok;
    },

    async gcdrPatchRuleValue(ruleId, alarmConfig) {
      const orch = window.MyIOOrchestrator;
      const response = await fetch(`${orch.gcdrApiBaseUrl}/api/v1/rules/${encodeURIComponent(ruleId)}`, {
        method: 'PATCH',
        headers: {
          'X-API-Key': orch.gcdrApiKey,
          'X-Tenant-ID': orch.gcdrTenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alarmConfig }),
      });
      return response.ok;
    },

    // ── RFC-0191: Enqueue-Close Alarms on Rule Unassignment ───────────────────
    /**
     * Enqueue a close job for all alarms matching the given rule × device pair.
     * Called by AlarmsTab when the user confirms removal of a pre-checked rule.
     *
     * POST {alarmsApiBaseUrl}/api/v1/alarms/enqueue-close
     * Body: { customerId, ruleId, deviceId }
     * 202 → { data: { alarmId, jobId, message } }
     *
     * Fire-and-forget: a non-202 response is logged as a warning but does NOT
     * block the subsequent gcdrPatchRuleScope call.
     *
     * @param {string} ruleId   - GCDR rule UUID
     * @param {string} deviceId - GCDR device UUID (gcdrDeviceId)
     * @returns {Promise<boolean>} true if the job was accepted (HTTP 202)
     */
    async gcdrEnqueueCloseAlarms(ruleId, deviceId) {
      const orch = window.MyIOOrchestrator;
      const url = `${orch.alarmsApiBaseUrl}/api/v1/alarms/enqueue-close`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': orch.gcdrTenantId || '',
            'X-API-KEY': orch.gcdrApiKey || '',
          },
          body: JSON.stringify({
            customerId: orch.gcdrCustomerId,
            ruleId,
            deviceId,
          }),
        });
        if (response.status === 202) {
          const json = await response.json().catch(() => ({}));
          LogHelper.log('[Orchestrator] RFC-0191 enqueue-close accepted:', json?.data);
          return true;
        }
        LogHelper.warn('[Orchestrator] RFC-0191 enqueue-close unexpected status:', response.status);
        return false;
      } catch (err) {
        LogHelper.warn('[Orchestrator] RFC-0191 enqueue-close network error:', err);
        return false;
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

  // RFC-0130: Auto-trigger data fetch when both orchestrator is ready AND period is available
  // This solves the "data doesn't load automatically" issue
  // FIX: do NOT fall back to 'energy' when no tab is visible yet — water-only/temperature-only
  // customers would start an energy retry loop (handleDataLoadError → 15 retries × 20s timeout).
  // myio:dashboard-state from MENU and myio:update-date from HEADER are the primary triggers
  // and will fire shortly after, so skipping the auto-trigger here is safe.
  setTimeout(() => {
    const domain = window.MyIOOrchestrator?.getVisibleTab?.();
    if (!domain) {
      LogHelper.log(
        '[Orchestrator] ⏳ RFC-0130: No visible tab yet, skipping auto-trigger (MENU will fire myio:dashboard-state)'
      );
      return;
    }
    const period = window.MyIOOrchestrator?.getCurrentPeriod?.();

    if (period) {
      LogHelper.log(`[Orchestrator] 🚀 RFC-0130: Auto-triggering data fetch for ${domain} after ready`);
      window.MyIOOrchestrator?.hydrateDomain?.(domain, period);
    } else {
      LogHelper.log(`[Orchestrator] ⏳ RFC-0130: No period yet, will wait for myio:update-date event`);
      // Start retry loop for visible domain
      if (window.MyIOOrchestrator?.requestDataWithRetry) {
        window.MyIOOrchestrator.requestDataWithRetry(domain, null);
      }
    }
  }, 500);

  // RFC-0107: Contract loading will be initialized from self.onInit after customerTB_ID is set
} else {
  // Fallback: no stub exists (shouldn't happen but be safe)
  window.MyIOOrchestrator = MyIOOrchestrator;
  window.MyIOOrchestrator.isReady = true;
  window.MyIOOrchestrator.credentialsSet = false;

  LogHelper.log('[MyIOOrchestrator] Initialized (no stub found)');

  // RFC-0130: Auto-trigger for fallback case
  // FIX: same as primary path — skip if no tab visible yet
  setTimeout(() => {
    const domain = window.MyIOOrchestrator?.getVisibleTab?.();
    if (!domain) return;
    const period = window.MyIOOrchestrator?.getCurrentPeriod?.();

    if (period) {
      LogHelper.log(`[Orchestrator] 🚀 RFC-0130: Auto-triggering data fetch for ${domain} (fallback)`);
      window.MyIOOrchestrator?.hydrateDomain?.(domain, period);
    }
  }, 500);

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
    const deviceCounts = await fetchDeviceCountAttributes(
      customerTB_ID,
      'CUSTOMER',
      self.ctx?.settings?.tbBaseUrl || ''
    );

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
  // FIX: Only track domains that are enabled AND have configured devices (total > 0)
  const enabledDomains = widgetSettings.domainsEnabled || { energy: true, water: true, temperature: true };
  const activeDomains = ['energy', 'water', 'temperature'].filter((d) => {
    const isEnabled = enabledDomains[d];
    const hasDevices = expectedCounts[d]?.total > 0;
    if (isEnabled && !hasDevices) {
      LogHelper.log(
        `[RFC-0107] Domain ${d} enabled but has no configured devices (total=0), skipping validation`
      );
    }
    return isEnabled && hasDevices;
  });

  LogHelper.log('[RFC-0107] Active domains for validation:', activeDomains);

  // If no domains have configured devices, finalize immediately with current state
  if (activeDomains.length === 0) {
    LogHelper.log(
      '[RFC-0107] No domains with configured devices, finalizing contract validation immediately'
    );
    storeContractState(expectedCounts, { isValid: true, discrepancies: [] });
    return;
  }

  const domainsLoaded = {};
  const domainsFetchComplete = {};
  activeDomains.forEach((d) => {
    domainsLoaded[d] = false;
    domainsFetchComplete[d] = false;
  });

  let validationFinalized = false;
  let validationTimeoutId = null;

  // RFC-0107 FIX: Fallback timeout - finalize validation after 15 seconds even if not all domains reported
  // This prevents the user from having to navigate through all tabs to enable contract status
  const VALIDATION_TIMEOUT_MS = 15000;

  const finalizeWithTimeout = () => {
    if (validationFinalized) return;

    const loadedDomains = Object.entries(domainsLoaded)
      .filter(([_, loaded]) => loaded)
      .map(([d]) => d);
    const pendingDomains = Object.entries(domainsLoaded)
      .filter(([_, loaded]) => !loaded)
      .map(([d]) => d);

    LogHelper.warn(
      `[RFC-0107] Validation timeout after ${VALIDATION_TIMEOUT_MS}ms - finalizing with partial data`
    );
    LogHelper.log(
      `[RFC-0107] Loaded domains: [${loadedDomains.join(', ')}], Pending: [${pendingDomains.join(', ')}]`
    );

    validationFinalized = true;
    window.removeEventListener('myio:state:ready', handleStateReady);
    window.removeEventListener('myio:domain:fetch-complete', handleFetchComplete);

    // Finalize with whatever data we have - skip validation for pending domains
    storeContractState(expectedCounts, {
      isValid: true,
      discrepancies: [],
      partialLoad: pendingDomains.length > 0,
    });
  };

  validationTimeoutId = setTimeout(finalizeWithTimeout, VALIDATION_TIMEOUT_MS);

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
      // Clear the fallback timeout since validation completed normally
      if (validationTimeoutId) {
        clearTimeout(validationTimeoutId);
        validationTimeoutId = null;
      }
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
