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
  // RFC-0106: Global mapInstantaneousPower from customer's parent entity
  // Used for deviceStatus calculation with power ranges
  mapInstantaneousPower: null,
  // RFC-XXXX: SuperAdmin flag - user with @myio.com.br email (except alarme/alarmes)
  // Populated by detectSuperAdmin() in onInit
  SuperAdmin: false,

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
      LogHelper.log('[MyIOUtils] RFC-0108: Measurement settings updated:', window.MyIOUtils.measurementSettings);
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
    const MAX_RETRIES = 5;

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
  classifyDevice,
  classifyDeviceByDeviceType,
  classifyDeviceByIdentifier,
  categoryToLabelWidget,
  inferLabelWidget,
  isStoreDevice,
  EQUIPMENT_EXCLUSION_PATTERN,
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
  // SuperAdmin = user with @myio.com.br email EXCEPT alarme@myio.com.br or alarmes@myio.com.br
  async function detectSuperAdmin() {
    const jwt = localStorage.getItem('jwt_token');
    if (!jwt) {
      window.MyIOUtils.SuperAdmin = false;
      LogHelper.log('[MAIN_VIEW] SuperAdmin: false (no JWT token)');
      return;
    }

    try {
      const response = await fetch('/api/auth/user', {
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

    widgetSettings.debugMode = self.ctx.settings?.debugMode ?? false;
    widgetSettings.domainsEnabled = self.ctx.settings?.domainsEnabled ?? {
      energy: true,
      water: true,
      temperature: true,
    };
    widgetSettings.excludeDevicesAtCountSubtotalCAG =
      self.ctx.settings?.excludeDevicesAtCountSubtotalCAG ?? [];

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
        console.warn(`[STATE] 🔄 Shopping changed from ${this._customerTB_ID} to ${customerTB_ID} - CLEARING ALL CACHES`);

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
        ['energy', 'water', 'temperature'].forEach(domain => {
          window.dispatchEvent(new CustomEvent('myio:telemetry:clear', {
            detail: { domain, reason: 'customer_changed', fromCustomer: this._customerTB_ID, toCustomer: customerTB_ID }
          }));
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
async function fetchDeviceCountAttributes(entityId, entityType = 'CUSTOMER') {
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    LogHelper.warn('[RFC-0107] JWT token not found');
    return null;
  }

  const url = `/api/plugins/telemetry/${entityType}/${entityId}/values/attributes/SERVER_SCOPE`;

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
    const deviceProfile = toStr(item.deviceProfile);

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
 * RFC-0106: Categorize water items into 4 groups: entrada, lojas, banheiros, areacomum
 *
 * RULE ORDER:
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
  const BANHEIRO_PATTERNS = ['BANHEIRO', 'WC', 'SANITARIO', 'TOALETE', 'LAVABO'];
  const ENTRADA_PATTERNS = ['ENTRADA', 'PRINCIPAL', 'RELOGIO', 'NASCENTE'];

  const entrada = [];
  const lojas = [];
  const banheiros = [];
  const areacomum = [];
  const caixadagua = []; // RFC-0107: Category for tanks

  // Helper to safely convert to uppercase string (handles objects, arrays, numbers, etc.)
  const toStr = (val) => String(val || '').toUpperCase();

  for (const item of items) {
    const dt = toStr(item.deviceType);
    const dp = toStr(item.deviceProfile);
    const identifier = toStr(item.identifier);
    const label = toStr(item.label);
    const lw = toStr(item.labelWidget);
    const combined = `${identifier} ${label} ${lw}`;

    // ========== PRIMARY RULES: Based on deviceType AND deviceProfile ==========

    // Rule 1: ENTRADA - deviceType = HIDROMETRO_SHOPPING OR (deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_SHOPPING)
    // RFC-0107: Also check for _isHidrometerDevice flag (from ctx.data hidrometro items)
    if (dt === 'HIDROMETRO_SHOPPING' || (dt === 'HIDROMETRO' && dp === 'HIDROMETRO_SHOPPING') || item._isHidrometerDevice) {
      entrada.push(item);
      continue;
    }

    // Rule 2: AREACOMUM - deviceType = HIDROMETRO_AREA_COMUM OR (deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO_AREA_COMUM)
    // NOTE: Banheiros with deviceType HIDROMETRO_AREA_COMUM go here too - they are extracted later by TELEMETRY widget
    if (dt === 'HIDROMETRO_AREA_COMUM' || (dt === 'HIDROMETRO' && dp === 'HIDROMETRO_AREA_COMUM')) {
      areacomum.push(item);
      continue;
    }

    // Rule 3: BANHEIROS - check identifier for bathroom patterns (only for HIDROMETRO devices not in areacomum)
    // These are standalone bathroom meters with deviceType = HIDROMETRO
    if (BANHEIRO_PATTERNS.some((p) => identifier.includes(p) || label.includes(p))) {
      banheiros.push(item);
      continue;
    }

    // Rule 4: LOJAS - deviceType = HIDROMETRO AND (deviceProfile = HIDROMETRO OR deviceProfile is empty/missing)
    if (dt === 'HIDROMETRO' && (dp === 'HIDROMETRO' || dp === '')) {
      lojas.push(item);
      continue;
    }

    // Rule 5: CAIXA D'ÁGUA - tanks (deviceType = TANK or CAIXA_DAGUA, or labelWidget = "Caixa D'Água")
    if (dt === 'TANK' || dt === 'CAIXA_DAGUA' || lw === "CAIXA D'ÁGUA" || item._isTankDevice) {
      caixadagua.push(item);
      continue;
    }

    // ========== FALLBACK RULES: Pattern matching for other deviceTypes ==========

    // Fallback 1: ENTRADA - main water entry points
    if (ENTRADA_PATTERNS.some((p) => combined.includes(p))) {
      entrada.push(item);
      continue;
    }

    // Fallback 2: AREACOMUM - everything else
    areacomum.push(item);
  }

  return { entrada, lojas, banheiros, areacomum, caixadagua };
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
    const dp = toStr(item.deviceProfile);
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

    // RFC-0109: Check connectivity categories FIRST (mutually exclusive)

    // 1. WAITING (not_installed) - highest priority
    const isWaiting = deviceStatus === 'not_installed' ||
                      connectionStatus === 'waiting' ||
                      ['waiting', 'connecting', 'pending'].includes(String(connectionStatus).toLowerCase());
    if (isWaiting) {
      result.waiting++;
      result.waitingDevices.push(deviceInfo);
      continue; // Don't count in consumption categories
    }

    // 2. WEAK CONNECTION
    const isWeakConnection = deviceStatus === 'weak_connection' ||
                              ['bad', 'weak', 'unstable', 'poor', 'degraded'].includes(String(connectionStatus).toLowerCase());
    if (isWeakConnection) {
      result.weakConnection++;
      result.weakConnectionDevices.push(deviceInfo);
      // weakConnection devices CAN also have consumption status - continue to count below
    }

    // 3. OFFLINE
    const isOffline = ['no_info', 'offline', 'maintenance', 'power_off'].includes(deviceStatus) ||
                      ['offline', 'disconnected'].includes(String(connectionStatus).toLowerCase());
    if (isOffline && !isWeakConnection) {
      result.offline++;
      result.offlineDevices.push(deviceInfo);
      // Offline devices can also be in noConsumption
      if (Math.abs(value) < NO_CONSUMPTION_THRESHOLD) {
        result.noConsumption++;
        result.noConsumptionDevices.push(deviceInfo);
      }
      continue;
    }

    // 4. ONLINE devices - check consumption status
    const isOnline = !isOffline && !isWaiting;
    if (isOnline) {
      // Check for "no consumption" (online but zero value)
      if (Math.abs(value) < NO_CONSUMPTION_THRESHOLD) {
        result.noConsumption++;
        result.noConsumptionDevices.push(deviceInfo);
        // Don't continue - also count in consumption category based on deviceStatus
      }

      // Map to consumption category
      const consumptionCategory = consumptionStatusMapping[deviceStatus];
      if (consumptionCategory) {
        result[consumptionCategory]++;
        result[`${consumptionCategory}Devices`].push(deviceInfo);
      } else {
        // Unknown status for online device - default to normal
        result.normal++;
        result.normalDevices.push(deviceInfo);
      }
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
 */
function periodKey(domain, period) {
  const customerTbId = widgetSettings.customerTB_ID;
  return `${customerTbId}:${domain}:${period.startISO}:${period.endISO}:${period.granularity}`;
}

// ========== ORCHESTRATOR SINGLETON ==========

const MyIOOrchestrator = (() => {
  // ========== PHASE 1: BUSY OVERLAY MANAGEMENT (RFC-0044/RFC-0054) ==========
  const BUSY_OVERLAY_ID = 'myio-orchestrator-busy-overlay';
  let globalBusyState = {
    isVisible: false,
    timeoutId: null,
    startTime: null,
    currentDomain: null,
    requestCount: 0,
  };

  // RFC-0054: contador por dom�nio e cooldown p�s-provide
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

  // PHASE 1: Centralized busy management with extended timeout
  function showGlobalBusy(domain = 'unknown', message = 'Carregando dados...', timeoutMs = 25000) {
    // RFC-0054: cooldown - n�o reabrir modal se acabou de prover dados
    const lp = lastProvide.get(domain);
    if (lp && Date.now() - lp.at < 30000) {
      LogHelper.log(`[Orchestrator] ?? Cooldown active for ${domain}, skipping showGlobalBusy()`);
      return;
    }
    const totalBefore = getActiveTotal();
    const prev = activeRequests.get(domain) || 0;
    activeRequests.set(domain, prev + 1);
    LogHelper.log(
      `[Orchestrator] ?? Active requests for ${domain}: ${prev + 1} (totalBefore=${totalBefore})`
    );

    const el = ensureOrchestratorBusyDOM();
    const messageEl = el.querySelector(`#${BUSY_OVERLAY_ID}-message`);

    if (messageEl) {
      // Mensagem gen�rica para evitar r�tulo incorreto ao alternar abas
      messageEl.textContent = 'Carregando dados...';
    }

    // Clear existing timeout
    if (globalBusyState.timeoutId) {
      clearTimeout(globalBusyState.timeoutId);
      globalBusyState.timeoutId = null;
    }

    // Mostrar overlay apenas quando saiu de 0 ? 1
    if (totalBefore === 0) {
      globalBusyState.isVisible = true;
      globalBusyState.currentDomain = domain;
      globalBusyState.startTime = Date.now();
      globalBusyState.requestCount++;
      el.style.display = 'flex';
    }

    // RFC-0048: Start widget monitoring (will be stopped by hideGlobalBusy)
    // This is defined later in the orchestrator initialization
    if (window.MyIOOrchestrator?.widgetBusyMonitor) {
      window.MyIOOrchestrator.widgetBusyMonitor.startMonitoring(domain);
    }

    // PHASE 1: Extended timeout (25s instead of 10s)
    globalBusyState.timeoutId = setTimeout(() => {
      LogHelper.warn(`[Orchestrator] ?? BUSY TIMEOUT (25s) for domain ${domain} - implementing recovery`);

      // Check if still actually busy
      if (globalBusyState.isVisible && el.style.display !== 'none') {
        // PHASE 3: Circuit breaker pattern - try graceful recovery
        try {
          // Emit recovery event
          window.dispatchEvent(
            new CustomEvent('myio:busy-timeout-recovery', {
              detail: { domain, duration: Date.now() - globalBusyState.startTime },
            })
          );

          // Hide busy and show user-friendly message
          hideGlobalBusy(domain);

          // Non-intrusive notification
          showRecoveryNotification();
        } catch (err) {
          LogHelper.error(`[Orchestrator] ❌ Error in timeout recovery:`, err);
          hideGlobalBusy(domain);
        }
      }

      globalBusyState.timeoutId = null;
    }, timeoutMs); // 25 seconds (Phase 1 requirement)

    if (totalBefore === 0) {
      LogHelper.log(`[Orchestrator] ? Global busy shown (domain=${domain})`);
    } else {
      LogHelper.log(`[Orchestrator] ?? Busy already visible (domain=${domain})`);
    }
  }

  function hideGlobalBusy(domain = null) {
    // RFC-0054: decremento por dom�nio; se domain for nulo, for�a limpeza
    if (domain) {
      const prev = activeRequests.get(domain) || 0;
      const next = Math.max(0, prev - 1);
      activeRequests.set(domain, next);
      LogHelper.log(
        `[Orchestrator] ? hideGlobalBusy(${domain}) -> ${prev}?${next}, total=${getActiveTotal()}`
      );
      if (getActiveTotal() > 0) return; // mant�m overlay enquanto houver ativas
    } else {
      activeRequests.clear();
    }

    // RFC-0048: Stop widget monitoring for current domain
    if (window.MyIOOrchestrator?.widgetBusyMonitor) {
      window.MyIOOrchestrator.widgetBusyMonitor.stopAll();
    }

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

    LogHelper.log(`[Orchestrator] ? Global busy hidden`);
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
  function convertConnectionStatusToDeviceStatus(connectionStatus, options = {}) {
    const lib = window.MyIOLibrary;

    // RFC-0109: Normalize connection status first
    const normalizedStatus = lib?.normalizeConnectionStatus
      ? lib.normalizeConnectionStatus(connectionStatus)
      : String(connectionStatus || '').toLowerCase().trim();

    // RFC-0109: Waiting states → not_installed (ABSOLUTE PRIORITY)
    const isWaiting = normalizedStatus === 'waiting' || ['waiting', 'connecting', 'pending'].includes(normalizedStatus);
    if (isWaiting) {
      LogHelper.log(`[Orchestrator] ✅ RFC-0109 convertConnectionStatusToDeviceStatus: connectionStatus='${connectionStatus}' → 'not_installed'`);
      return 'not_installed';
    }

    // RFC-0109: Bad/weak connection states → weak_connection
    if (normalizedStatus === 'bad' || ['bad', 'weak', 'unstable', 'poor', 'degraded'].includes(normalizedStatus)) {
      return 'weak_connection';
    }

    // RFC-0110: Check if connection is stale based on timestamps
    const delayMins = window.MyIOUtils?.getDelayTimeConnectionInMins?.() ?? 60;
    const connectionStale = lib?.isConnectionStale
      ? lib.isConnectionStale({
          lastConnectTime: options.lastConnectTime,
          lastDisconnectTime: options.lastDisconnectTime,
          delayTimeConnectionInMins: delayMins,
        })
      : true; // Fallback: assume stale if library not available

    // RFC-0110: Offline status check
    const isOfflineStatus = normalizedStatus === 'offline' ||
      ['offline', 'disconnected', 'false', '0'].includes(normalizedStatus) ||
      connectionStatus === null || connectionStatus === undefined || connectionStatus === '';

    // RFC-0110: Device is truly offline only if status says offline AND connection is stale
    if (isOfflineStatus && connectionStale) {
      return 'offline';
    }

    // RFC-0110: Device with "offline" status but fresh timestamp → treat as online
    // Also handles normal online states
    return 'power_on';
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
    // RFC-0109 + RFC-0110: Calculate deviceStatus with timestamp verification
    const deviceStatus = convertConnectionStatusToDeviceStatus(meta.connectionStatus, {
      lastConnectTime: meta.lastConnectTime,
      lastDisconnectTime: meta.lastDisconnectTime,
    });

    // DEBUG: Forced tracking for specific device
    const debugLabel = meta.label || meta.identifier || overrides.label || '';
    const isDebugDevice = debugLabel.includes('3F SCMAL3L4304ABC') || debugLabel.includes('SCMAL3L4304ABC');
    if (isDebugDevice) {
      const lib = window.MyIOLibrary;
      const delayMins = window.MyIOUtils?.getDelayTimeConnectionInMins?.() ?? 60;
      const connectionStale = lib?.isConnectionStale
        ? lib.isConnectionStale({
            lastConnectTime: meta.lastConnectTime,
            lastDisconnectTime: meta.lastDisconnectTime,
            delayTimeConnectionInMins: delayMins,
          })
        : 'N/A (lib not available)';
      console.warn(`🔴 [DEBUG MAIN_VIEW] createOrchestratorItem for "${debugLabel}":`, {
        entityId,
        connectionStatus: meta.connectionStatus,
        calculatedDeviceStatus: deviceStatus,
        lastConnectTime: meta.lastConnectTime,
        lastDisconnectTime: meta.lastDisconnectTime,
        lastConnectTimeFormatted: meta.lastConnectTime ? new Date(meta.lastConnectTime).toISOString() : 'N/A',
        lastDisconnectTimeFormatted: meta.lastDisconnectTime ? new Date(meta.lastDisconnectTime).toISOString() : 'N/A',
        connectionStale,
        delayMins,
        now: new Date().toISOString(),
      });
    }

    // RFC-0109: LOG for tracking waiting devices
    if (meta.connectionStatus === 'waiting' || String(meta.connectionStatus).toLowerCase() === 'waiting') {
      LogHelper.log(`[Orchestrator] 📦 RFC-0109 createOrchestratorItem WAITING:`, {
        entityId: entityId,
        label: meta.label || meta.identifier,
        connectionStatus: meta.connectionStatus,
        calculatedDeviceStatus: deviceStatus,
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
      lastActivityTime: meta.lastActivityTime || null,
      lastConnectTime: meta.lastConnectTime || null,
      lastDisconnectTime: meta.lastDisconnectTime || null,

      // Annotations
      log_annotations: meta.log_annotations || null,

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
      }
      else if (keyName === 'lastactivitytime') meta.lastActivityTime = val;
      else if (keyName === 'lastconnecttime') meta.lastConnectTime = val;
      else if (keyName === 'lastdisconnecttime') meta.lastDisconnectTime = val;
      else if (keyName === 'log_annotations') meta.log_annotations = val;
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
        meta.consumptionTs = (ts && ts > 0) ? ts : null;

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
        meta.pulsesTs = (ts && ts > 0) ? ts : null;
      }
      else if (keyName === 'litersperpulse') meta.litersPerPulse = val;
      else if (keyName === 'volume') meta.volume = val;
      // Tank-specific fields (TANK/CAIXA_DAGUA)
      else if (keyName === 'water_level') {
        meta.waterLevel = val;
        // RFC-0110: Extract timestamp for telemetry-based offline detection
        // NOTE: Timestamp 0 (epoch 1970) is invalid - ThingsBoard returns 0 when no data
        const ts = row?.data?.[0]?.[0];
        meta.waterLevelTs = (ts && ts > 0) ? ts : null;
      }
      else if (keyName === 'water_percentage') {
        meta.waterPercentage = val;
        // RFC-0110: Extract timestamp for telemetry-based offline detection
        // NOTE: Timestamp 0 (epoch 1970) is invalid - ThingsBoard returns 0 when no data
        const ts = row?.data?.[0]?.[0];
        meta.waterPercentageTs = (ts && ts > 0) ? ts : null;
      }
      // Temperature-specific fields
      else if (keyName === 'temperature') {
        meta.temperature = val;
        // RFC-0110: Extract timestamp for telemetry-based offline detection
        // NOTE: Timestamp 0 (epoch 1970) is invalid - ThingsBoard returns 0 when no data
        const ts = row?.data?.[0]?.[0];
        meta.temperatureTs = (ts && ts > 0) ? ts : null;
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

    // RFC-0108 DEBUG: Log ALL ingestionIds for water domain to diagnose matching issues
    if (domain === 'water' && metadataByEntityId.size > 0) {
      const allIngestionIds = [];
      for (const [entityId, meta] of metadataByEntityId.entries()) {
        allIngestionIds.push({
          label: meta.label || meta.entityName || entityId.substring(0, 8),
          ingestionId: meta.ingestionId || 'MISSING',
          tbId: entityId.substring(0, 8),
        });
      }
      // Log devices with VACINA in name or entityName
      const vacinaDevices = [];
      for (const [entityId, meta] of metadataByEntityId.entries()) {
        const labelUpper = (meta.label || '').toUpperCase();
        const entityNameUpper = (meta.entityName || '').toUpperCase();
        if (labelUpper.includes('VACINA') || labelUpper.includes('VACINAÇÃO') ||
            entityNameUpper.includes('VACINA') || entityNameUpper.includes('VACINAÇÃO')) {
          vacinaDevices.push({
            label: meta.label,
            entityName: meta.entityName,
            ingestionId: meta.ingestionId || 'MISSING',
            deviceType: meta.deviceType || 'MISSING',
            deviceProfile: meta.deviceProfile || 'MISSING',
            tbId: entityId,
          });
        }
      }
      if (vacinaDevices.length > 0) {
        LogHelper.log(`[RFC-0108 DEBUG] VACINA devices in metadata:`, JSON.stringify(vacinaDevices, null, 2));
      }
      // Log first 10 ingestionIds for reference
      LogHelper.log(`[RFC-0108 DEBUG] First 10 ingestionIds:`, allIngestionIds.slice(0, 10));
    }

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
        // Use cache if less than 30 seconds old
        if (cacheAge < 30000) {
          LogHelper.log(
            `[Orchestrator] ✅ Using cached data for ${domain}: ${cachedData.items.length} items (age: ${cacheAge}ms)`
          );

          // RFC-0108 DEBUG: Analyze cached data for ingestionId issues (water domain)
          if (domain === 'water') {
            const items = cachedData.items;
            const withIngestionId = items.filter(i => i.ingestionId).length;
            const withApiData = items.filter(i => i._hasApiData).length;
            const withZeroValue = items.filter(i => i.value === 0 || i.value === null || i.value === undefined).length;
            const entradaDevices = items.filter(i => i.labelWidget === 'Entrada');

            LogHelper.log(`[RFC-0108 CACHE DEBUG] Water cache analysis:`, {
              total: items.length,
              withIngestionId,
              withoutIngestionId: items.length - withIngestionId,
              withApiData,
              withZeroValue,
              entradaCount: entradaDevices.length,
            });

            // Log devices with labelWidget='Entrada' to diagnose VACINACAO issue
            if (entradaDevices.length > 0) {
              LogHelper.log(`[RFC-0108 CACHE DEBUG] Entrada devices:`, entradaDevices.map(d => ({
                label: d.label,
                value: d.value,
                ingestionId: d.ingestionId || 'MISSING',
                hasApiData: d._hasApiData,
                tbId: d.tbId?.substring(0, 8),
              })));
            }

            // Log devices with value=0 but might have API data
            const suspiciousDevices = items.filter(i => i.value === 0 && !i._hasApiData);
            if (suspiciousDevices.length > 0) {
              LogHelper.log(`[RFC-0108 CACHE DEBUG] Devices with value=0 and no API match (first 5):`,
                suspiciousDevices.slice(0, 5).map(d => ({
                  label: d.label,
                  ingestionId: d.ingestionId || 'MISSING',
                  deviceType: d.deviceType,
                  labelWidget: d.labelWidget,
                })));
            }
          }

          return cachedData.items;
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
          const temperatureValue = Number(meta.temperature || 0);

          // RFC-0111: Use centralized factory
          items.push(createOrchestratorItem({
            entityId,
            meta,
            overrides: {
              label: meta.label || meta.identifier || 'Sensor',
              entityLabel: meta.label || meta.identifier || 'Sensor',
              name: meta.label || meta.identifier || 'Sensor',
              value: temperatureValue,
              temperature: temperatureValue,
              deviceType: meta.deviceType || 'TERMOSTATO',
            },
          }));
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
            hidrometroItems.push(createOrchestratorItem({
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
            }));
            continue;
          }

          if (isTankByType || hasWaterLevelData) {
            const waterLevel = Number(meta.waterLevel || 0);
            const waterPercentage = Number(meta.waterPercentage || 0);

            // RFC-0111: Use centralized factory
            tankItems.push(createOrchestratorItem({
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
            }));
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
        LogHelper.warn(`[Orchestrator] ⚠️ Metadata map is empty - no devices found in ctx.data`);
        ctxDataWasEmpty = true;

        // RFC-0106: Show toast and reload page when metadata map is empty
        window.MyIOUtils?.handleDataLoadError(domain, 'no devices found in datasource');

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

      // RFC-0108 DEBUG: Log raw JSON structure for water
      if (domain === 'water') {
        LogHelper.log(`[RFC-0108 DEBUG] Water API JSON structure:`, {
          isArray: Array.isArray(json),
          hasData: !!json?.data,
          hasSummary: !!json?.summary,
          topLevelKeys: Object.keys(json || {}),
          summaryTotal: json?.summary?.totalValue,
        });
      }

      const rows = Array.isArray(json) ? json : json?.data ?? [];

      // RFC-0108 DEBUG: Log raw API response for water domain
      if (domain === 'water' && rows.length > 0) {
        LogHelper.log(`[RFC-0108 DEBUG] Water API first row with total_value:`, {
          id: rows[0].id,
          name: rows[0].name,
          total_value: rows[0].total_value,
          typeof_total_value: typeof rows[0].total_value,
        });
        LogHelper.log(`[RFC-0108 DEBUG] Water API total rows: ${rows.length}`);
      }

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
          // RFC-0108 DEBUG: Log first few water API rows to diagnose value extraction
          if (!getValueFromRow._loggedWater) {
            getValueFromRow._loggedWater = 0;
          }
          if (getValueFromRow._loggedWater < 3) {
            LogHelper.log(`[RFC-0108 DEBUG] Water API row FULL:`, JSON.stringify(row, null, 2));
            LogHelper.log(`[RFC-0108 DEBUG] Water API keys: ${Object.keys(row).join(', ')}`);
            LogHelper.log(`[RFC-0108 DEBUG] Extracted value: ${val}`);
            getValueFromRow._loggedWater++;
          }
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
      LogHelper.log(`[Orchestrator] 📊 API data map: ${apiDataMap.size} items by ID, ${apiDataByName.size} by name`);

      // RFC-0108 DEBUG: Compare metadata ingestionIds with API ids
      if (domain === 'water') {
        const metaIngestionIds = new Set();
        for (const [, meta] of metadataByEntityId.entries()) {
          if (meta.ingestionId) metaIngestionIds.add(meta.ingestionId);
        }
        const apiIds = new Set(apiDataMap.keys());

        // Find IDs in API but not in metadata
        const apiOnly = [...apiIds].filter(id => !metaIngestionIds.has(id));
        // Find IDs in metadata but not in API
        const metaOnly = [...metaIngestionIds].filter(id => !apiIds.has(id));

        LogHelper.log(`[RFC-0108 DEBUG] Water ID comparison:`, {
          metadataCount: metaIngestionIds.size,
          apiCount: apiIds.size,
          apiOnlyCount: apiOnly.length,
          metaOnlyCount: metaOnly.length,
        });
        if (apiOnly.length > 0) {
          LogHelper.log(`[RFC-0108 DEBUG] API IDs NOT in metadata (first 5):`, apiOnly.slice(0, 5));
        }
        if (metaOnly.length > 0) {
          LogHelper.log(`[RFC-0108 DEBUG] Metadata IDs NOT in API (first 5):`, metaOnly.slice(0, 5));
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
            LogHelper.log(`[RFC-0108 DEBUG] Name-based match for "${meta.label}": found API data with value ${getValueFromRow(apiRow)}`);
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
        items.push(createOrchestratorItem({
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
            // Power limits and instantaneous power
            deviceMapInstaneousPower: meta.deviceMapInstaneousPower || null,
            consumptionPower: meta.consumption || null,
            labelWidget: labelWidget,
            groupLabel: labelWidget,
            _hasApiData: hasApiData,
            _matchedBy: matchedBy,
          },
        }));
      }

      LogHelper.log(
        `[Orchestrator] 📊 RFC-0108: Created ${items.length} items from metadata. API match: ${matchedCount} matched (${nameMatchedCount} by name), ${unmatchedCount} with value=0`
      );

      // DEBUG: Log sample items
      if (items.length > 0) {
        const sampleWithApi = items.find(i => i._hasApiData);
        const sampleWithoutApi = items.find(i => !i._hasApiData);
        if (sampleWithApi) {
          LogHelper.log(`[Orchestrator] 🔍 Sample item WITH API data:`, {
            id: sampleWithApi.id,
            label: sampleWithApi.label,
            value: sampleWithApi.value,
            deviceType: sampleWithApi.deviceType,
            labelWidget: sampleWithApi.labelWidget,
            matchedBy: sampleWithApi._matchedBy,
          });
        }
        if (sampleWithoutApi) {
          LogHelper.log(`[Orchestrator] 🔍 Sample item WITHOUT API data (value=0):`, {
            id: sampleWithoutApi.id,
            label: sampleWithoutApi.label,
            value: sampleWithoutApi.value,
            deviceType: sampleWithoutApi.deviceType,
            labelWidget: sampleWithoutApi.labelWidget,
            ingestionId: sampleWithoutApi.ingestionId || 'MISSING',
          });
        }

        // RFC-0108 DEBUG: Log VACINA device specifically after enrichment (regardless of classification)
        if (domain === 'water') {
          const vacinaItems = items.filter(i => {
            const label = (i.label || '').toUpperCase();
            const name = (i.name || '').toUpperCase();
            return label.includes('VACINA') || name.includes('VACINA');
          });
          if (vacinaItems.length > 0) {
            LogHelper.log(`[RFC-0108 DEBUG] VACINA device AFTER ENRICHMENT:`, JSON.stringify(vacinaItems.map(d => ({
              label: d.label,
              value: d.value,
              ingestionId: d.ingestionId,
              hasApiData: d._hasApiData,
              matchedBy: d._matchedBy,
              labelWidget: d.labelWidget,
              deviceType: d.deviceType,
              deviceProfile: d.deviceProfile,
            })), null, 2));
          }

          const entradaDevices = items.filter(i => i.labelWidget === 'Entrada');
          if (entradaDevices.length > 0) {
            LogHelper.log(`[RFC-0108 DEBUG] Entrada devices after enrichment:`, entradaDevices.map(d => ({
              label: d.label,
              value: d.value,
              hasApiData: d._hasApiData,
              matchedBy: d._matchedBy,
              ingestionId: d.ingestionId || 'MISSING',
            })));
          }

          // Log all devices that have no match and value=0
          const unmatchedDevices = items.filter(i => !i._hasApiData && i.value === 0);
          if (unmatchedDevices.length > 0 && unmatchedDevices.length <= 20) {
            LogHelper.log(`[RFC-0108 DEBUG] ALL unmatched devices (value=0):`, unmatchedDevices.map(d => ({
              label: d.label,
              ingestionId: d.ingestionId || 'MISSING',
              labelWidget: d.labelWidget,
            })));
          } else if (unmatchedDevices.length > 20) {
            LogHelper.log(`[RFC-0108 DEBUG] Too many unmatched devices: ${unmatchedDevices.length} - showing first 10:`, unmatchedDevices.slice(0, 10).map(d => ({
              label: d.label,
              ingestionId: d.ingestionId || 'MISSING',
              labelWidget: d.labelWidget,
            })));
          }
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

        // Merge API values into hidrometroItems (preserving pulses but using API total_value)
        let mergedCount = 0;
        for (const hidro of hidrometroItems) {
          const enrichedItem = enrichedItemsMap.get(hidro.tbId);
          if (enrichedItem && enrichedItem._hasApiData) {
            hidro.value = enrichedItem.value; // Use API total_value
            hidro._hasApiData = true;
            hidro._matchedBy = enrichedItem._matchedBy;
            mergedCount++;
          }
        }

        if (mergedCount > 0) {
          LogHelper.log(`[Orchestrator] 🔄 RFC-0108: Merged API values into ${mergedCount}/${hidrometroItems.length} hidrometros`);

          // DEBUG: Log VACINA device after merge
          const vacinaHidro = hidrometroItems.find(h => {
            const label = (h.label || '').toUpperCase();
            return label.includes('VACINA');
          });
          if (vacinaHidro) {
            LogHelper.log(`[RFC-0108 DEBUG] VACINA hidrometro AFTER MERGE:`, JSON.stringify({
              label: vacinaHidro.label,
              value: vacinaHidro.value,
              pulses: vacinaHidro.pulses,
              hasApiData: vacinaHidro._hasApiData,
              matchedBy: vacinaHidro._matchedBy,
            }, null, 2));
          }
        }

        // Create set of IDs already processed as tanks or hidrometros
        const waterDeviceIds = new Set([
          ...tankItems.map(i => i.tbId),
          ...hidrometroItems.map(i => i.tbId)
        ]);
        // Filter items to exclude duplicates
        const itemsWithoutWaterDevices = items.filter(i => !waterDeviceIds.has(i.tbId));
        finalItems = [...itemsWithoutWaterDevices, ...tankItems, ...hidrometroItems];
        LogHelper.log(
          `[Orchestrator] 🚰 Combined ${itemsWithoutWaterDevices.length} metadata items + ${tankItems.length} tanks + ${hidrometroItems.length} hidrometros = ${finalItems.length} total (filtered ${items.length - itemsWithoutWaterDevices.length} duplicates)`
        );
      }

      LogHelper.log(
        `[Orchestrator] fetchAndEnrich: fetched ${finalItems.length} items for domain ${domain}`
      );
      return finalItems;
    } catch (error) {
      LogHelper.error(`[Orchestrator] fetchAndEnrich error for domain ${domain}:`, error);
      return [];
    }
  }

  // Fetch data for a domain and period
  async function hydrateDomain(domain, period) {
    const key = periodKey(domain, period);
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
    currentPeriod = ev.detail.period;

    // Cross-context emission removed - HEADER already handles this
    // No need to re-emit here as it creates infinite loop

    if (visibleTab && currentPeriod) {
      LogHelper.log(`[Orchestrator] 📅 myio:update-date → hydrateDomain(${visibleTab})`);
      hydrateDomain(visibleTab, currentPeriod);
    }
  });

  window.addEventListener('myio:dashboard-state', (ev) => {
    const tab = ev.detail.tab;
    try {
      hideGlobalBusy(tab);
    } catch (_e) {
      // Silently ignore - busy indicator may not exist yet
    }
    visibleTab = tab;
    if (visibleTab && currentPeriod) {
      LogHelper.log(`[Orchestrator] ?? myio:dashboard-state ? hydrateDomain(${visibleTab})`);
      hydrateDomain(visibleTab, currentPeriod);
    } else {
      LogHelper.log(
        `[Orchestrator] ?? myio:dashboard-state skipped (visibleTab=${visibleTab}, currentPeriod=${!!currentPeriod})`
      );
    }
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

  // Telemetry reporting
  if (!config?.debugMode && typeof window.tbClient !== 'undefined') {
    setInterval(() => {
      try {
        window.tbClient.sendTelemetry(metrics.generateTelemetrySummary());
      } catch (e) {
        LogHelper.warn('[Orchestrator] Failed to send telemetry:', e);
      }
    }, 5 * 60 * 1000);
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
