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
    const hasExistingData = existingData && (
      existingData.summary?.total > 0 ||
      existingData.entrada?.total > 0 ||
      existingData.lojas?.total > 0 ||
      existingData._raw?.length > 0
    );

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
          window.dispatchEvent(new CustomEvent('myio:telemetry:request-data', {
            detail: {
              domain: domain,
              isRetry: true,
              retryAttempt: retryCount + 1,
            },
          }));
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
 * RFC-0106: Classify device by deviceProfile attribute
 * Single datasource approach - classification based on deviceProfile
 *
 * Rules:
 * - Lojas: deviceType === '3F_MEDIDOR' AND deviceProfile === '3F_MEDIDOR'
 * - Others: classify by deviceProfile using DEVICE_CLASSIFICATION_CONFIG
 *
 * @param {Object} item - Device item with deviceType, deviceProfile and identifier properties
 * @returns {'lojas'|'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDeviceByDeviceType(item) {
  if (!item) return 'outros';

  const deviceType = String(item.deviceType || '').toUpperCase();
  const deviceProfile = String(item.deviceProfile || '').toUpperCase();

  // RFC-0106: Lojas = deviceType === '3F_MEDIDOR' AND deviceProfile === '3F_MEDIDOR'
  if (deviceType === '3F_MEDIDOR' && deviceProfile === '3F_MEDIDOR') {
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
 * 1. LOJAS: ONLY when deviceType = '3F_MEDIDOR' AND deviceProfile = '3F_MEDIDOR' (both must match)
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

  // Skip domain values (not real deviceTypes)
  const DOMAIN_VALUES = new Set(['ENERGY', 'WATER', 'TEMPERATURE', '']);

  // ==========================================================================
  // RULE 1: LOJAS - ONLY when BOTH deviceType AND deviceProfile = '3F_MEDIDOR'
  // ==========================================================================
  if (deviceType === '3F_MEDIDOR' && deviceProfile === '3F_MEDIDOR') {
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

        // Credential management (will be populated later)
        setCredentials: async (customerId, clientId, clientSecret) => {
          LogHelper.warn('[Orchestrator] ⚠️ setCredentials called before orchestrator is ready');
        },

        // Token manager stub
        tokenManager: {
          setToken: (key, token) => {
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
 * Categorize items into 3 groups: lojas, entrada, areacomum
 * Rules:
 * - LOJAS: deviceType = '3F_MEDIDOR' AND deviceProfile = '3F_MEDIDOR'
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

    // Rule 1: LOJAS - both deviceType AND deviceProfile = '3F_MEDIDOR'
    if (deviceType === '3F_MEDIDOR' && deviceProfile === '3F_MEDIDOR') {
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
    if (dt === 'HIDROMETRO_SHOPPING' || (dt === 'HIDROMETRO' && dp === 'HIDROMETRO_SHOPPING')) {
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

    // ========== FALLBACK RULES: Pattern matching for other deviceTypes ==========

    // Fallback 1: ENTRADA - main water entry points
    if (ENTRADA_PATTERNS.some((p) => combined.includes(p))) {
      entrada.push(item);
      continue;
    }

    // Fallback 2: AREACOMUM - everything else
    areacomum.push(item);
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
        `[buildSummary] 🚫 Excluded ${excludedFromCAG.length} devices from CAG subtotal (${excludedTotal.toFixed(2)} kWh):`,
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

  // Premium alert for missing credentials
  function showCredentialsAlert() {
    const overlay = document.createElement('div');
    overlay.id = 'myio-credentials-alert';
    overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(45, 20, 88, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: Inter, system-ui, sans-serif;
  `;

    const alertBox = document.createElement('div');
    alertBox.style.cssText = `
    background: linear-gradient(135deg, #2d1458 0%, #1a0b33 100%);
    color: #fff;
    border-radius: 20px;
    padding: 40px 48px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    border: 2px solid rgba(255,255,255,0.1);
    max-width: 500px;
    text-align: center;
    animation: slideIn 0.3s ease-out;
  `;

    alertBox.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
    <h2 style="
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 16px 0;
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    ">Credenciais Não Encontradas</h2>
    <p style="
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 24px 0;
      color: rgba(255,255,255,0.85);
    ">
      As credenciais de autenticação não foram configuradas no sistema.
      <br><br>
      <strong>Credenciais necessárias:</strong>
      <br>• CLIENT_ID
      <br>• CLIENT_SECRET
      <br>• CUSTOMER_ING_ID
      <br><br>
      Entre em contato com o administrador para configurar as credenciais necessárias.
    </p>
    <button id="credentials-alert-close" style="
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      border: none;
      padding: 14px 32px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
      transition: all 0.2s ease;
    ">Fechar</button>
  `;

    overlay.appendChild(alertBox);
    document.body.appendChild(overlay);

    // Add CSS animation
    if (!document.querySelector('#myio-credentials-alert-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'myio-credentials-alert-styles';
      styleEl.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      #credentials-alert-close:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(245, 158, 11, 0.5);
      }

      #credentials-alert-close:active {
        transform: translateY(0);
      }
    `;
      document.head.appendChild(styleEl);
    }

    // Close button handler
    const closeBtn = document.getElementById('credentials-alert-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      });
    }

    LogHelper.error('[MAIN_VIEW] Credentials alert displayed - system halted');
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
  function abortInflight(key) {
    const ac = abortControllers.get(key);
    if (ac) {
      ac.abort();
      abortControllers.delete(key);
    }
  }

  function abortAllInflight() {
    for (const [key, ac] of abortControllers.entries()) {
      ac.abort();
    }
    abortControllers.clear();
    inFlight.clear();
  }

  /**
   * RFC-0106: Convert ThingsBoard connectionStatus to deviceStatus
   * ThingsBoard connectionStatus can be: 'true'/'false', 'ONLINE'/'OFFLINE', true/false, 'CONNECTED'/'DISCONNECTED'
   * @param {string|boolean|null} connectionStatus - Raw status from ThingsBoard
   * @returns {string} deviceStatus: 'power_on', 'offline', or 'no_info'
   */
  function convertConnectionStatusToDeviceStatus(connectionStatus) {
    if (connectionStatus === null || connectionStatus === undefined || connectionStatus === '') {
      return 'no_info';
    }

    const statusStr = String(connectionStatus).toLowerCase().trim();

    // Online/connected states → power_on
    const ONLINE_VALUES = ['true', 'online', 'connected', '1', 'active', 'yes'];
    if (ONLINE_VALUES.includes(statusStr)) {
      return 'power_on';
    }

    // Offline/disconnected states → offline
    const OFFLINE_VALUES = ['false', 'offline', 'disconnected', '0', 'inactive', 'no'];
    if (OFFLINE_VALUES.includes(statusStr)) {
      return 'offline';
    }

    // Unknown status → no_info
    return 'no_info';
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
      else if (keyName === 'connectionstatus') meta.connectionStatus = val;
      else if (keyName === 'lastactivitytime') meta.lastActivityTime = val;
      else if (keyName === 'lastconnecttime') meta.lastConnectTime = val;
      else if (keyName === 'lastdisconnecttime') meta.lastDisconnectTime = val;
      else if (keyName === 'log_annotations') meta.log_annotations = val;
      else if (keyName === 'label') meta.label = val;
      // Energy-specific fields
      else if (keyName === 'devicemapinstaneouspower') meta.deviceMapInstaneousPower = val;
      else if (keyName === 'consumption') meta.consumption = val;
      // Water-specific fields
      else if (keyName === 'pulses') meta.pulses = val;
      else if (keyName === 'litersperpulse') meta.litersPerPulse = val;
      else if (keyName === 'volume') meta.volume = val;
      // Temperature-specific fields
      else if (keyName === 'temperature') meta.temperature = val;
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
          LogHelper.log(`[Orchestrator] ✅ Using cached temperature data: ${cachedData?.items?.length || 0} items`);
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
          const deviceStatus = convertConnectionStatusToDeviceStatus(meta.connectionStatus);

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
            deviceType: meta.deviceType || 'SENSOR_TEMP',
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
        LogHelper.log(`[Orchestrator] ✅ Using cached ${domain} data: ${cachedData?.items?.length || 0} items`);
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

      if (metadataMap.size === 0) {
        LogHelper.warn(`[Orchestrator] ⚠️ Metadata map is empty - no devices found in ctx.data`);
        ctxDataWasEmpty = true;

        // RFC-0106: Show toast and reload page when metadata map is empty
        window.MyIOUtils?.handleDataLoadError(domain, 'no devices found in datasource');

        return []; // No metadata = no point calling API
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
      const rows = Array.isArray(json) ? json : json?.data ?? [];

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
        const label = meta.label || 'SEM ETIQUETA';

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
          deviceStatus:
            convertConnectionStatusToDeviceStatus(meta.connectionStatus) || row.deviceStatus || 'no_info',
          slaveId: meta.slaveId || row.slaveId || null,
          centralId: meta.centralId || row.centralId || null,
          centralName: meta.centralName || null,
          gatewayId: row.gatewayId || null,
          customerId: row.customerId || null,
          customerName: row.customerName || null,
          assetId: row.assetId || null,
          assetName: row.assetName || null,
          lastActivityTime: meta.lastActivityTime || null,
          lastConnectTime: meta.lastConnectTime || null,
          lastDisconnectTime: meta.lastDisconnectTime || null,
          log_annotations: meta.log_annotations || null,
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

  /**
   * Extracts period from key, ignoring customerTB_ID prefix.
   * @param {string} key - Ex: 'null:energy:2025-10-01...:day' ou '20b93da0:energy:2025-10-01...:day'
   * @returns {string} Ex: 'energy:2025-10-01...:day'
   */
  function extractPeriod(key) {
    if (!key) return '';
    const parts = key.split(':');
    return parts.slice(1).join(':'); // Remove primeiro segmento (customerTB_ID)
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
    } catch (e) {
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
    } catch (e) {
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
        } catch (e) {
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
} else {
  // Fallback: no stub exists (shouldn't happen but be safe)
  window.MyIOOrchestrator = MyIOOrchestrator;
  window.MyIOOrchestrator.isReady = true;
  window.MyIOOrchestrator.credentialsSet = false;

  LogHelper.log('[MyIOOrchestrator] Initialized (no stub found)');
}
