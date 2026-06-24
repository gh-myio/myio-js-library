/* global self, window, document, localStorage */

/**
 * RFC-0150: Shopping Dashboard - MAIN Controller (Slim Version)
 *
 * This is a refactored, slim version of the shopping dashboard controller.
 * It uses MyIOLibrary components instead of embedded logic.
 *
 * Components used:
 * - createHeaderShoppingComponent (RFC-0146)
 * - createMenuShoppingComponent (RFC-0147)
 * - createTelemetryGridShoppingComponent (RFC-0145)
 * - createFooterComponent (RFC-0149)
 */

// ============================================================================
// Configuration
// ============================================================================

const DEBUG_ACTIVE = true;
// Endpoints resolved from widget settings in onInit (no hard-coded URLs).
let THINGSBOARD_URL = '';
let DATA_API_HOST = '';

// Domain catalog (metadata only) — loaded entirely from the lib in onInit
// (window.MyIOLibrary.exportMapDomain). Empty until then; never hard-codes a domain.
let DOMAIN = {};

// ============================================================================
// LogHelper
// ============================================================================
const LogHelper = {
  log: (...args) => DEBUG_ACTIVE && console.log('[MAIN]', ...args),
  warn: (...args) => DEBUG_ACTIVE && console.warn('[MAIN]', ...args),
  error: (...args) => console.error('[MAIN]', ...args),
};

// Error toast helper. The only fallback is window.alert (when MyIOToast is unavailable).
function toastError(message) {
  const toast = window.MyIOLibrary?.MyIOToast;
  if (toast?.error) toast.error(message);
  else window.alert(message);
}

// ============================================================================
// Global State Setup
// ============================================================================
window.MyIOUtils = window.MyIOUtils || {};
Object.assign(window.MyIOUtils, {
  LogHelper,
  DATA_API_HOST, // resolved from settings in onInit (empty until then)
  isDebugActive: () => DEBUG_ACTIVE,
  customerAttrs: {}, // generic passthrough of customer SERVER_SCOPE attributes
  mapInstantaneousPower: null,
  SuperAdmin: false,
  currentUserEmail: null,
  enableAnnotationsOnboarding: false,
  currentTheme: 'light',
  setTheme: (theme) => {
    window.MyIOUtils.currentTheme = theme;
    window.dispatchEvent(new CustomEvent('myio:theme-changed', { detail: { theme } }));
  },
  getTheme: () => window.MyIOUtils.currentTheme || 'light',
});

// ============================================================================
// Module State
// ============================================================================
let _headerInstance = null;
let _menuInstance = null;
let _footerInstance = null;
let _credentials = null;
let _dataProcessedOnce = false;

// Classification tree (domains → columns → deviceProfiles) from the GCDR entities
// endpoint (RFC-0047). The dashboard derives EVERYTHING from this — no hard-coded domain.
let _classificationTree = null;
// Devices loaded from the GCDR /devices endpoint (the dashboard's device source — not ThingsBoard).
let _gcdrDevices = [];
// Dynamic grid instances, keyed by `${domainCode}::${columnKey}`.
const _grids = new Map();
// Dynamic info (breakdown) instances, keyed by domainCode.
const _infoInstances = new Map();
// Info container elements, keyed by domainCode (component is created lazily on first show).
const _infoEls = new Map();

// Map a classified device (DeviceMeta) to the grid's TelemetryDevice shape.
// The grid's own STATE self-extract uses a fixed context map that does not know the
// agnostic tree column keys, so the controller feeds the grid directly instead.
function toTelemetryDevice(item) {
  return {
    entityId: item.entityId || item.id || item.tbId || '',
    ingestionId: item.ingestionId || item.id || '',
    labelOrName: item.labelOrName || item.label || item.name || '',
    name: item.name || item.label || '',
    deviceIdentifier: item.deviceIdentifier || item.identifier || item.label || '',
    deviceType: item.deviceType || '',
    deviceProfile: item.deviceProfile || '',
    deviceStatus: item.deviceStatus || item.connectionStatus || '',
    connectionStatus: item.connectionStatus || '',
    customerId: item.customerId || '',
    centralName: item.centralName || '',
    ownerName: item.ownerName || '',
    val: typeof item.val === 'number' ? item.val : (typeof item.value === 'number' ? item.value : null),
    unit: item.unit || undefined,
    lastActivityTime: item.lastActivityTime,
    lastConnectTime: item.lastConnectTime,
    gcdrDeviceId: item.gcdrDeviceId || undefined,
    centralId: item.centralId || undefined,
    slaveId: item.slaveId || undefined,
    identifier: item.identifier || undefined,
    domain: item.domain || undefined,
  };
}

// ============================================================================
// GCDR device → DeviceMeta + classification by deviceProfile (tree-driven, agnostic).
// Devices come from the GCDR /devices endpoint (not ThingsBoard datasource rows).
// ============================================================================
function gcdrDeviceToMeta(dev) {
  const raw = (dev.connectivityStatus || dev.status || '').toString().toLowerCase();
  const deviceStatus = raw === 'online' ? 'online' : raw === 'offline' ? 'offline' : 'no_info';
  return {
    id: dev.metadata?.tbId || dev.id,
    entityId: dev.metadata?.tbId || dev.id,
    gcdrDeviceId: dev.id,
    ingestionId: dev.ingestionId || '',
    name: dev.name || '',
    label: dev.label || dev.displayName || dev.name || '',
    labelOrName: dev.label || dev.displayName || dev.name || '',
    deviceType: dev.deviceType || '',
    deviceProfile: dev.deviceProfile || dev.deviceType || '',
    identifier: dev.identifier || '',
    slaveId: dev.slaveId != null ? String(dev.slaveId) : '',
    centralId: dev.centralId || '',
    customerId: dev.customerId || '',
    connectionStatus: deviceStatus,
    deviceStatus,
    // The device registry carries no live telemetry value; readings come later from the Data Apps API.
    value: null,
    val: null,
    consumption: null,
    domain: '',
  };
}

// Route GCDR devices into byDomainColumn using the tree's profileIndex (deviceProfile → {domain, column}).
function classifyGcdrDevices(devices, tree) {
  const byDomainColumn = {};
  for (const d of tree?.domains || []) {
    byDomainColumn[d.code] = {};
    for (const c of d.columns) byDomainColumn[d.code][c.key] = [];
  }
  const unknown = [];
  const pidx = tree?.profileIndex || {};
  for (const dev of devices || []) {
    const meta = gcdrDeviceToMeta(dev);
    const key = String(meta.deviceProfile || '').trim().toUpperCase();
    const loc = pidx[key];
    if (loc && byDomainColumn[loc.domain]) {
      (byDomainColumn[loc.domain][loc.column] ||= []).push(meta);
    } else {
      unknown.push(meta);
    }
  }
  return { byDomainColumn, unknown };
}

// ============================================================================
// Device Classification (RFC-0209) — moved to the lib (single source).
// Use window.MyIOLibrary.{extractDeviceMetadataFromRows, classifyAllDevices, buildByStatusFromDevices}.
// ============================================================================

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Process data from AllDevices datasource and dispatch events
 */
function processDataAndDispatchEvents() {
  // Device source = GCDR /devices (fetched in onInit), NOT the ThingsBoard datasource.
  const devices = _gcdrDevices || [];
  LogHelper.log(`Processing ${devices.length} GCDR devices`);
  if (devices.length === 0) return false;

  // Classify by deviceProfile via the tree's profileIndex (agnostic, no fallback bucket).
  const { byDomainColumn: classified, unknown } = classifyGcdrDevices(devices, _classificationTree);
  if (unknown.length) {
    toastError(
      `[MAIN_VIEW v5.4.0] ${unknown.length} dispositivo(s) com deviceProfile não mapeado na árvore de classificação.`
    );
  }

  // Store global state + dispatch one summary per domain — structure from the GCDR tree.
  window.STATE = window.STATE || {};
  window.STATE.classified = classified;

  for (const d of _classificationTree?.domains || []) {
    const code = d.code;
    const byColumn = classified[code] || {};
    const stateForDomain = {};
    const allDevices = [];
    for (const c of d.columns) {
      const items = byColumn[c.key] || [];
      stateForDomain[c.key] = { items };
      allDevices.push(...items);
      // Feed the grid directly (agnostic) — independent of the grid's fixed context→STATE map.
      const grid = _grids.get(`${code}::${c.key}`);
      grid?.updateDevices?.(items.map(toTelemetryDevice));
    }
    window.STATE[code] = stateForDomain;

    const numeric = allDevices.map((x) => Number(x.value || 0));
    const total = numeric.reduce((s, n) => s + n, 0);
    const positives = numeric.filter((n) => n > 0);
    const globalAvg = positives.length
      ? positives.reduce((a, b) => a + b, 0) / positives.length
      : null;

    const desc = DOMAIN[code] || {};
    const evt = desc.summaryEvent || `myio:${code}-summary-ready`;
    window.dispatchEvent(
      new CustomEvent(evt, {
        detail: {
          domain: code,
          totalDevices: allDevices.length,
          totalConsumption: total,
          globalAvg,
          byStatus: window.MyIOLibrary.buildByStatusFromDevices(allDevices),
        },
      })
    );
  }

  window.dispatchEvent(
    new CustomEvent('myio:data-ready', { detail: { classified, timestamp: Date.now() } })
  );

  // Update TelemetryInfo components with category data
  updateTelemetryInfoComponents(classified);

  LogHelper.log('Events dispatched');
  _dataProcessedOnce = true;
  return true;
}

/**
 * Update TelemetryInfo components with category breakdown data
 */
function updateTelemetryInfoComponents(classified) {
  for (const d of _classificationTree?.domains || []) updateOneInfo(d, classified);
}

function updateOneInfo(d, classified) {
  const inst = _infoInstances.get(d.code);
  if (!inst) return;
  const sumOf = (arr) => arr.reduce((s, x) => s + Number(x.value || x.consumption || 0), 0);
  // Generic per-column summary { [columnKey]: { total } } — keyed by the tree's columns.
  const summary = {};
  for (const c of d.columns) summary[c.key] = { total: sumOf(classified?.[d.code]?.[c.key] || []) };
  // Computed setter name from the domain code (e.g. set<Code>Data) — no literal; falls back to setData/update.
  const cap = d.code.charAt(0).toUpperCase() + d.code.slice(1);
  const setter = inst[`set${cap}Data`] || inst.setData || inst.update;
  if (typeof setter === 'function') {
    setter.call(inst, summary);
    LogHelper.log(`Info component updated for ${d.code}`);
  }
}

// Lazily create a domain's TelemetryInfo component the first time its section is shown.
// Creating it while the section is display:none gives a 0x0 chart container → infinite retry loop.
function ensureInfoInstance(code) {
  if (_infoInstances.has(code)) return;
  const lib = window.MyIOLibrary;
  const infoEl = _infoEls.get(code);
  if (!lib?.createTelemetryInfoShoppingComponent || !infoEl) return;
  _infoInstances.set(
    code,
    lib.createTelemetryInfoShoppingComponent({
      container: infoEl,
      domain: code,
      themeMode: _currentThemeMode,
      showChart: true,
      showExpandButton: true,
      debugActive: DEBUG_ACTIVE,
    })
  );
  const d = (_classificationTree?.domains || []).find((x) => x.code === code);
  if (d) updateOneInfo(d, window.STATE?.classified || {});
}

// ============================================================================
// Credentials Fetching
// ============================================================================
async function fetchCredentials(customerTbId) {
  const jwt = self.ctx?.http?.getServerCredentials?.()?.token;
  if (!jwt) {
    LogHelper.error('No JWT token');
    return null;
  }

  try {
    const url = `${THINGSBOARD_URL}/api/plugins/telemetry/CUSTOMER/${customerTbId}/values/attributes/SERVER_SCOPE`;
    const response = await fetch(url, {
      headers: { 'X-Authorization': `Bearer ${jwt}` },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const attrs = await response.json();
    const get = (key) => attrs.find((a) => a.key === key)?.value;

    return {
      clientId: get('clientId') || '',
      clientSecret: get('clientSecret') || '',
      ingestionId: get('customerId') || '',
      gcdrCustomerId: get('gcdrCustomerId') || get('gcdrId') || '',
      gcdrTenantId: get('gcdrTenantId') || '',
    };
  } catch (err) {
    LogHelper.error('Failed to fetch credentials:', err);
    return null;
  }
}

// ============================================================================
// Alarms Pre-fetching (RFC-0180)
// ============================================================================
/**
 * RFC-0180: Pre-fetch all customer alarms so AlarmsTab can filter without a per-device call.
 * Runs non-blocking — result stored in window.MyIOOrchestrator.customerAlarms.
 */
async function _prefetchCustomerAlarms(gcdrCustomerId, gcdrTenantId, alarmsBaseUrl) {
  try {
    const ALARMS_API_KEY = window.MyIOOrchestrator?.alarmsApiKey || '';
    if (!ALARMS_API_KEY) {
      toastError('[v5.4.0] alarmsApiKey não configurado. Configure em Widget Settings → alarmsApiKey.');
      return;
    }
    const url = `${alarmsBaseUrl}/alarms?state=OPEN,ACK,ESCALATED,SNOOZED&customerId=${encodeURIComponent(gcdrCustomerId)}&limit=100`;
    const response = await fetch(url, {
      headers: {
        'X-API-Key': ALARMS_API_KEY,
        'X-Tenant-ID': gcdrTenantId || '',
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      LogHelper.warn('[MAIN] _prefetchCustomerAlarms failed:', response.status);
      return;
    }
    const json = await response.json();
    const alarms = Array.isArray(json.data) ? json.data : (json.items ?? json.data?.items ?? []);
    if (window.MyIOOrchestrator) window.MyIOOrchestrator.customerAlarms = alarms;
    LogHelper.log('[MAIN] RFC-0180: customerAlarms pre-fetched:', alarms.length, 'alarms');
  } catch (err) {
    LogHelper.warn('[MAIN] _prefetchCustomerAlarms error:', err);
  }
}

// ============================================================================
// User Info Fetching
// ============================================================================
/**
 * Get user info from ThingsBoard context and update menu component
 */
async function fetchAndUpdateUserInfo() {
  // First try to get user from ThingsBoard widget context (fastest)
  const ctxUser = self.ctx?.currentUser;

  if (ctxUser) {
    const fullName =
      `${ctxUser.firstName || ''} ${ctxUser.lastName || ''}`.trim() || ctxUser.name || 'Usuário';
    const isAdmin = ctxUser.authority === 'TENANT_ADMIN' || window.MyIOUtils.SuperAdmin;

    // RFC-0171: Store currentUserEmail for use in Settings modal
    window.MyIOUtils.currentUserEmail = (ctxUser.email || '').toLowerCase().trim();

    if (_menuInstance) {
      _menuInstance.updateUserInfo({
        name: fullName,
        email: ctxUser.email || '',
        isAdmin: isAdmin,
      });
      LogHelper.log('Menu user info updated from context');
    }
    return;
  }

  // Fallback: Fetch from API if context not available
  const jwt = self.ctx?.http?.getServerCredentials?.()?.token || localStorage.getItem('jwt_token');
  if (!jwt) {
    LogHelper.warn('No JWT token for user info fetch');
    if (_menuInstance) {
      _menuInstance.updateUserInfo({ name: 'Usuário', email: '', isAdmin: false });
    }
    return;
  }

  try {
    const response = await fetch(`${THINGSBOARD_URL}/api/auth/user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${jwt}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const user = await response.json();
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Usuário';
    const isAdmin = user.authority === 'TENANT_ADMIN' || window.MyIOUtils.SuperAdmin;

    // RFC-0171: Store currentUserEmail for use in Settings modal
    window.MyIOUtils.currentUserEmail = (user.email || '').toLowerCase().trim();

    if (_menuInstance) {
      _menuInstance.updateUserInfo({
        name: fullName,
        email: user.email || '',
        isAdmin: isAdmin,
      });
      LogHelper.log('Menu user info updated from API');
    }
  } catch (err) {
    LogHelper.error('Failed to fetch user info:', err);
    if (_menuInstance) {
      _menuInstance.updateUserInfo({ name: 'Usuário', email: '', isAdmin: false });
    }
  }
}

// ============================================================================
// Component Creation
// ============================================================================
/**
 * Handle menu collapse toggle - adds/removes menu-compact class on #myio-root
 */
function handleMenuCollapse(collapsed) {
  const root = document.getElementById('myio-root');
  if (!root) return;

  if (collapsed) {
    root.classList.add('menu-compact');
  } else {
    root.classList.remove('menu-compact');
  }
  LogHelper.log('Menu collapsed:', collapsed);
}

function createComponents() {
  const lib = window.MyIOLibrary;
  if (!lib) {
    LogHelper.error('MyIOLibrary not available');
    return;
  }

  const settings = self.ctx?.settings || {};
  const customerTbId = settings.customerTB_ID || '';

  // Create Menu with collapse handler
  const menuContainer = document.getElementById('menuContainer');
  if (menuContainer && lib.createMenuShoppingComponent) {
    _menuInstance = lib.createMenuShoppingComponent({
      container: menuContainer,
      themeMode: _currentThemeMode,
      configTemplate: { initialDomain: _classificationTree?.domains?.[0]?.code || '' },
      onTabChange: (domain) => {
        LogHelper.log('Tab changed:', domain);
        switchContentState(domain);
      },
      onToggleCollapse: handleMenuCollapse,
    });
    LogHelper.log('Menu created with theme:', _currentThemeMode);
  }

  // Create Header
  const headerContainer = document.getElementById('headerContainer');
  if (headerContainer && lib.createHeaderShoppingComponent) {
    _headerInstance = lib.createHeaderShoppingComponent({
      container: headerContainer,
      themeMode: _currentThemeMode,
      credentials: _credentials,
      configTemplate: { timezone: 'America/Sao_Paulo' },
      onLoad: (period) => {
        LogHelper.log('Load clicked, period:', period);
        window.dispatchEvent(new CustomEvent('myio:update-date', { detail: { period } }));
      },
    });
    LogHelper.log('Header created with theme:', _currentThemeMode);
  }

  // Create all domain sections + grids dynamically from the GCDR tree.
  createDomainSectionsAndGrids(lib);

  // Create Footer
  const footerContainer = document.getElementById('footerContainer');
  if (footerContainer && lib.createFooterComponent) {
    _footerInstance = lib.createFooterComponent({
      container: footerContainer,
      themeMode: _currentThemeMode,
      customerTbId,
      credentials: _credentials,
    });
    LogHelper.log('Footer created with theme:', _currentThemeMode);
  }
}

/**
 * Create all domain sections + grids dynamically from the GCDR classification tree.
 * No fixed domains/columns — one <section> per domain, one grid per column.
 */
function createDomainSectionsAndGrids(lib) {
  const root = document.getElementById('domainContentRoot');
  if (!root) return;
  root.innerHTML = '';
  _grids.clear();
  _infoInstances.clear();

  for (const d of _classificationTree?.domains || []) {
    const code = d.code;

    const section = document.createElement('div');
    section.setAttribute('data-content-state', `${code}_content`);
    section.className = 'myio-content-4col';
    section.style.display = 'none';
    root.appendChild(section);

    for (const col of d.columns) {
      const colEl = document.createElement('section');
      colEl.className = 'myio-grid-column';
      colEl.dataset.column = col.key;
      section.appendChild(colEl);
      if (lib.createTelemetryGridShoppingComponent) {
        _grids.set(
          `${code}::${col.key}`,
          lib.createTelemetryGridShoppingComponent({
            container: colEl,
            domain: code,
            context: col.key,
            devices: [],
            themeMode: _currentThemeMode,
            labelWidget: col.label,
            debugActive: DEBUG_ACTIVE,
          })
        );
      }
    }

    if (lib.createTelemetryInfoShoppingComponent) {
      const infoEl = document.createElement('section');
      infoEl.className = 'myio-info-column';
      section.appendChild(infoEl);
      // Defer component creation until the section is shown (ensureInfoInstance) to avoid the 0x0 chart loop.
      _infoEls.set(code, infoEl);
    }
  }
  LogHelper.log('Domain sections + grids created:', _grids.size, 'grids');
}

// ============================================================================
// Content State Switching
// ============================================================================
function switchContentState(domain) {
  // Content-state id = `${domainCode}_content` (sections generated dynamically) or 'alarm_content'.
  const targetState = `${domain}_content`;

  // Hide all states
  document.querySelectorAll('[data-content-state]').forEach((el) => {
    el.style.display = 'none';
  });

  // Show target state
  const targetEl = document.querySelector(`[data-content-state="${targetState}"]`);
  if (targetEl) {
    targetEl.style.display = 'grid';
    ensureInfoInstance(domain); // create the info view now that its container has dimensions
  }

  LogHelper.log('Switched content state to:', targetState);

  // Dispatch state change event
  window.dispatchEvent(
    new CustomEvent('myio:dashboard-state', {
      detail: { tab: domain },
    })
  );
}

// ============================================================================
// Extract Customer Attributes from datasource
// ============================================================================
function extractCustomerAttributes(data) {
  // Generic passthrough: stash every customer attribute under MyIOUtils.customerAttrs
  // (domain-specific consumers — e.g. limit ranges — read what they need from here).
  window.MyIOUtils.customerAttrs = window.MyIOUtils.customerAttrs || {};
  for (const row of data) {
    const alias = (row.datasource?.aliasName || '').toLowerCase();
    if (alias !== 'customer') continue;

    const keyName = (row.dataKey?.name || '').toLowerCase();
    const value = row.data?.[0]?.[1];
    if (value == null) continue;

    if (keyName === 'mapinstantaneouspower') {
      try {
        window.MyIOUtils.mapInstantaneousPower = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        // Ignore parse errors - keep existing value
      }
    } else {
      window.MyIOUtils.customerAttrs[keyName] = value;
    }
  }
}

// ============================================================================
// Theme & Background Management
// ============================================================================

let _currentThemeMode = 'light';

/**
 * Apply background to page based on theme settings
 */
function applyBackgroundToPage(themeMode, settings) {
  const themeSettings = themeMode === 'dark' ? settings.darkMode : settings.lightMode;
  const backgroundType = themeSettings?.backgroundType || 'gradient';

  let backgroundStyle;
  if (backgroundType === 'image' && themeSettings?.backgroundUrl) {
    backgroundStyle = `url('${themeSettings.backgroundUrl}') center center / cover no-repeat fixed`;
  } else if (backgroundType === 'gradient' && themeSettings?.backgroundGradient) {
    backgroundStyle = themeSettings.backgroundGradient;
  } else {
    // Default to a light purple gradient for light mode, dark purple for dark
    if (themeMode === 'dark') {
      backgroundStyle =
        themeSettings?.backgroundColor || 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)';
    } else {
      backgroundStyle =
        themeSettings?.backgroundColor || 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 50%, #c4b5fd 100%)';
    }
  }

  // Apply to body
  document.body.style.background = backgroundStyle;

  // Apply to ThingsBoard dashboard containers
  const tbContainers = [
    '.tb-dashboard-page',
    '.tb-dashboard-page-content',
    '.tb-absolute-fill',
    '.mat-drawer-content',
    '.mat-sidenav-content',
    '.tb-dashboard-container',
    '.tb-widget-container',
    '.tb-widget',
    'tb-dashboard-state',
  ];

  tbContainers.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.style.background = 'transparent';
      el.style.backgroundColor = 'transparent';
    });
  });

  // Apply to #myio-root
  const myioRoot = document.getElementById('myio-root');
  if (myioRoot) {
    myioRoot.style.background = backgroundStyle;
    myioRoot.setAttribute('data-theme', themeMode);

    // Apply CSS variables from settings
    if (themeSettings) {
      if (themeSettings.panelColor) {
        myioRoot.style.setProperty('--myio-panel', themeSettings.panelColor);
      }
      if (themeSettings.borderColor) {
        myioRoot.style.setProperty('--myio-border', themeSettings.borderColor);
      }
      if (themeSettings.textColor) {
        myioRoot.style.setProperty('--myio-text', themeSettings.textColor);
      }
    }
  }

  LogHelper.log('Background applied:', { themeMode, backgroundType, backgroundStyle });
}

/**
 * Toggle theme mode
 */
// eslint-disable-next-line no-unused-vars -- parked: theme toggler kept for re-enable
function toggleTheme(settings) {
  _currentThemeMode = _currentThemeMode === 'light' ? 'dark' : 'light';
  applyBackgroundToPage(_currentThemeMode, settings);

  // Dispatch event for components to update
  window.dispatchEvent(
    new CustomEvent('myio:theme-change', {
      detail: { mode: _currentThemeMode },
    })
  );

  LogHelper.log('Theme toggled to:', _currentThemeMode);
}

// Listen for theme toggle from header
window.addEventListener('myio:theme-change', (e) => {
  const newMode = e.detail?.mode;
  if (newMode && newMode !== _currentThemeMode) {
    _currentThemeMode = newMode;
    const settings = self.ctx?.settings || {};
    applyBackgroundToPage(_currentThemeMode, settings);
  }
});

// ============================================================================
// Classification Tree (GCDR RFC-0047)
// ============================================================================
/**
 * Load the domain/column/profile tree from the GCDR entities registry and parse
 * it (via the lib adapter) into _classificationTree. The dashboard derives every
 * domain/column from this — no fallback, no hard-coded structure.
 */
async function fetchClassificationTree(gcdrApiBaseUrl, gcdrCustomerId) {
  if (!gcdrApiBaseUrl || !gcdrCustomerId) {
    toastError(
      '[MAIN_VIEW v5.4.0] gcdrApiBaseUrl/gcdrCustomerId ausentes — árvore de classificação não carregada.'
    );
    return;
  }
  if (!window.MyIOLibrary?.parseClassificationEntities) {
    toastError('[MAIN_VIEW v5.4.0] MyIOLibrary.parseClassificationEntities indisponível.');
    return;
  }
  try {
    const apiKey =
      window.MyIOOrchestrator?.gcdrApiKey || window.MyIOUtils?.customerAttrs?.gcdrapikey || '';
    const url = `${gcdrApiBaseUrl}/entities?parentId=null&deep=all&customerId=${encodeURIComponent(gcdrCustomerId)}`;
    const headers = { Accept: 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    _classificationTree = window.MyIOLibrary.parseClassificationEntities(json);
    if (!_classificationTree?.domains?.length) {
      toastError('[MAIN_VIEW v5.4.0] Árvore de classificação vazia no GCDR.');
    } else {
      LogHelper.log('Classification tree loaded:', _classificationTree.domains.length, 'domains');
    }
  } catch (err) {
    LogHelper.error('Failed to load classification tree:', err);
    toastError('[MAIN_VIEW v5.4.0] Falha ao carregar a árvore de classificação do GCDR.');
  }
}

/**
 * Load the customer's devices from the GCDR /devices endpoint (paginated). This is the
 * dashboard's device source — ThingsBoard is no longer queried for the device list.
 */
async function fetchDevices(gcdrApiBaseUrl, gcdrCustomerId) {
  if (!gcdrApiBaseUrl || !gcdrCustomerId) {
    toastError('[MAIN_VIEW v5.4.0] gcdrApiBaseUrl/gcdrCustomerId ausentes — devices não carregados.');
    return [];
  }
  const apiKey =
    window.MyIOOrchestrator?.gcdrApiKey || window.MyIOUtils?.customerAttrs?.gcdrapikey || '';
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const all = [];
  const limit = 500;
  let offset = 0;
  try {
    for (let guard = 0; guard < 1000; guard++) {
      const url = `${gcdrApiBaseUrl}/devices?customerId=${encodeURIComponent(gcdrCustomerId)}&limit=${limit}&offset=${offset}`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const items = json?.data?.items || [];
      all.push(...items);
      if (!json?.data?.pagination?.hasMore) break;
      offset += limit;
    }
    LogHelper.log('GCDR devices loaded:', all.length);
    return all;
  } catch (err) {
    LogHelper.error('Failed to load GCDR devices:', err);
    toastError('[MAIN_VIEW v5.4.0] Falha ao carregar a lista de devices do GCDR.');
    return [];
  }
}

// ============================================================================
// ThingsBoard Widget Lifecycle
// ============================================================================

self.onInit = async function () {
  LogHelper.log('onInit starting...');

  const settings = self.ctx?.settings || {};
  const customerTbId = settings.customerTB_ID || '';
  window.MyIOUtils.customerTB_ID = customerTbId;

  // RFC-0122: upgrade LogHelper to the lib's contextual logger; console LogHelper stays as fallback.
  if (window.MyIOLibrary?.createLogHelper) {
    Object.assign(
      LogHelper,
      window.MyIOLibrary.createLogHelper({ debugActive: DEBUG_ACTIVE, config: { widget: 'MAIN' } })
    );
  }
  window.MyIOUtils.LogHelper = LogHelper;

  // Domain map from the lib (single source); bootstrap codes stay as fallback.
  if (window.MyIOLibrary?.exportMapDomain) {
    DOMAIN = window.MyIOLibrary.exportMapDomain();
  }
  window.MyIOUtils.DOMAIN = DOMAIN;

  // Endpoints from widget settings (no hard-coded URLs); toast on misconfiguration.
  THINGSBOARD_URL = settings.thingsboardUrl || '';
  DATA_API_HOST = (settings.dataApiHost || '').replace(/\/api\/v1\/?$/, '');
  window.MyIOUtils.DATA_API_HOST = DATA_API_HOST;
  if (!THINGSBOARD_URL) {
    toastError(
      '[MAIN_VIEW v5.4.0] thingsboardUrl não configurado nas settings do widget. Configure em Widget Settings → thingsboardUrl.'
    );
  }
  if (!DATA_API_HOST) {
    toastError(
      '[MAIN_VIEW v5.4.0] dataApiHost não configurado nas settings do widget. Configure em Widget Settings → dataApiHost.'
    );
  }

  // Apply initial theme and background
  _currentThemeMode = settings.defaultThemeMode || 'light';
  window.MyIOUtils.currentTheme = _currentThemeMode;
  LogHelper.log(
    'Initial theme mode from settings:',
    _currentThemeMode,
    '(settings.defaultThemeMode:',
    settings.defaultThemeMode,
    ')'
  );
  applyBackgroundToPage(_currentThemeMode, settings);

  // RFC-0144: Load annotations onboarding setting
  const enableAnnotationsOnboarding = settings.enableAnnotationsOnboarding ?? false;
  window.MyIOUtils.enableAnnotationsOnboarding = enableAnnotationsOnboarding;
  LogHelper.log('RFC-0144: enableAnnotationsOnboarding:', enableAnnotationsOnboarding);

  // RFC-0178: Alarms API config from settings (no hard-coded URLs; toast on misconfiguration)
  const alarmsApiBaseUrl = settings.alarmsApiBaseUrl || '';
  if (!alarmsApiBaseUrl) {
    toastError(
      '[MAIN_VIEW v5.4.0] alarmsApiBaseUrl não configurado nas settings do widget. Configure em Widget Settings → alarmsApiBaseUrl.'
    );
  }
  const alarmsApiKey = settings.alarmsApiKey || '';
  if (!alarmsApiKey) {
    toastError(
      '[MAIN_VIEW v5.4.0] alarmsApiKey não configurado nas settings do widget. Configure em Widget Settings → alarmsApiKey.'
    );
  }

  // RFC-0180: GCDR IDs — primary from widget settings, fallback from TB attrs below
  let gcdrCustomerId = settings.gcdrCustomerId || '';
  let gcdrTenantId = settings.gcdrTenantId || '';
  const gcdrApiBaseUrl = settings.gcdrApiBaseUrl || '';
  if (!gcdrApiBaseUrl) {
    toastError(
      '[MAIN_VIEW v5.4.0] gcdrApiBaseUrl não configurado nas settings do widget. Configure em Widget Settings → gcdrApiBaseUrl.'
    );
  }

  // Detect SuperAdmin from context (quick check; currentUserEmail refined later via fetchAndUpdateUserInfo)
  const userEmail = self.ctx?.currentUser?.email || '';
  window.MyIOUtils.SuperAdmin = userEmail.includes('@myio.com.br') && !userEmail.includes('alarme');
  if (userEmail) window.MyIOUtils.currentUserEmail = userEmail.toLowerCase().trim();

  // RFC-0051.2: Expose orchestrator stub IMMEDIATELY before createComponents()
  // so TELEMETRY grids and Settings modal can reference it during initialization
  if (!window.MyIOOrchestrator) {
    window.MyIOOrchestrator = {
      isReady: false,
      customerTB_ID: customerTbId,
      alarmsApiBaseUrl: alarmsApiBaseUrl,
      alarmsApiKey: alarmsApiKey,
      gcdrCustomerId: gcdrCustomerId,
      gcdrTenantId: gcdrTenantId,
      gcdrApiBaseUrl: gcdrApiBaseUrl,
      customerAlarms: null,
      getCurrentPeriod: () => null,
      getCredentials: () => null,
      setCredentials: async (_customerId, _clientId, _clientSecret) => {
        LogHelper.warn('[MAIN] setCredentials called before orchestrator is ready');
      },
      tokenManager: {
        setToken: (_key, _token) => {
          LogHelper.warn('[MAIN] tokenManager.setToken called before orchestrator is ready');
        },
      },
      inFlight: {},
    };
    LogHelper.log('[MAIN] MyIOOrchestrator stub created');
  } else {
    // Orchestrator already exists (e.g. from another widget) — update relevant fields
    window.MyIOOrchestrator.customerTB_ID = customerTbId;
    window.MyIOOrchestrator.alarmsApiBaseUrl = alarmsApiBaseUrl;
    window.MyIOOrchestrator.alarmsApiKey = alarmsApiKey;
  }

  // Fetch credentials
  if (customerTbId) {
    _credentials = await fetchCredentials(customerTbId);
    if (_credentials) {
      LogHelper.log('Credentials fetched');

      // RFC-0180: Fallback GCDR IDs from TB attrs when not set in widget settings
      if (!gcdrCustomerId) gcdrCustomerId = _credentials.gcdrCustomerId || '';
      if (!gcdrTenantId) gcdrTenantId = _credentials.gcdrTenantId || '';

      // Set credentials in orchestrator
      if (window.MyIOOrchestrator?.setCredentials) {
        window.MyIOOrchestrator.setCredentials(
          _credentials.ingestionId,
          _credentials.clientId,
          _credentials.clientSecret
        );
      }
    }
  }

  // RFC-0180: Publish final GCDR identifiers to orchestrator
  if (window.MyIOOrchestrator) {
    window.MyIOOrchestrator.gcdrCustomerId = gcdrCustomerId;
    window.MyIOOrchestrator.gcdrTenantId = gcdrTenantId;
    window.MyIOOrchestrator.gcdrApiBaseUrl = gcdrApiBaseUrl;
  }
  LogHelper.log('[MAIN] RFC-0180: gcdrCustomerId:', gcdrCustomerId || '(empty)');

  // RFC-0180: Pre-fetch all customer alarms (non-blocking)
  if (gcdrCustomerId) {
    _prefetchCustomerAlarms(gcdrCustomerId, gcdrTenantId, alarmsApiBaseUrl);
  }

  // Load the classification tree (domains → columns → deviceProfiles) from the GCDR registry.
  await fetchClassificationTree(gcdrApiBaseUrl, gcdrCustomerId);

  // Load the device list from the GCDR /devices endpoint — the device source (not ThingsBoard).
  _gcdrDevices = await fetchDevices(gcdrApiBaseUrl, gcdrCustomerId);

  // Create components (sections + grids are generated from the tree)
  createComponents();

  // Classify the GCDR devices → feed grids/info + dispatch per-domain summaries.
  processDataAndDispatchEvents();

  // Fetch user info and update menu
  fetchAndUpdateUserInfo();

  // Show the default domain (first from the tree). switchContentState also dispatches myio:dashboard-state
  // and lazily creates that domain's info view (avoids the 0x0 chart loop on hidden sections).
  setTimeout(() => {
    const first = _classificationTree?.domains?.[0]?.code;
    if (first) switchContentState(first);
  }, 200);

  LogHelper.log('onInit complete');
};

self.onDataUpdated = function () {
  // Devices come from GCDR (fetched in onInit), not the TB datasource. The TB datasource may still
  // carry customer-scope attributes, so extract those when present.
  const data = self.ctx?.data || [];
  if (data.length) extractCustomerAttributes(data);

  // Process the GCDR device list (once per cycle). Already done in onInit; this is a safety net.
  if (!_dataProcessedOnce) {
    processDataAndDispatchEvents();
  }
};

self.onResize = function () {
  // Components handle their own resize
};

self.onDestroy = function () {
  LogHelper.log('onDestroy');

  // Destroy main components
  _headerInstance?.destroy?.();
  _menuInstance?.destroy?.();
  _footerInstance?.destroy?.();

  // Destroy all dynamic grids + info instances
  for (const g of _grids.values()) g?.destroy?.();
  for (const i of _infoInstances.values()) i?.destroy?.();
  _grids.clear();
  _infoInstances.clear();

  // Reset references
  _headerInstance = null;
  _menuInstance = null;
  _footerInstance = null;
};
