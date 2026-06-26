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

// Load the MyIO standard font (Nunito) once. In the ThingsBoard runtime there is no host
// HTML we control, so the widget injects the Google Fonts <link> itself (idempotent by id).
// styles.css applies it via #myio-root { font-family: var(--myio-font) }; components default to it.
function injectNunitoFont() {
  if (typeof document === 'undefined') return;
  const id = 'myio-font-nunito';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(link);
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
// Active consumption period { startISO, endISO }. Default = current month; updated by the
// header date picker (myio:update-date). Drives the Data Apps consumption/temperature fetch.
let _currentPeriod = null;
// Domains whose values come from the per-device temperature time-series endpoint instead of
// the customer consumption-totals endpoint (the Data Apps totals readingType is energy|water).
const TEMPERATURE_DOMAIN_CODES = ['temperature'];

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
// RFC-0211: behavior restored from the working v-5.2.0 widgets (reuses the
// existing toastError() helper above — no duplicate definitions).
// ============================================================================

// --- RFC-0211-footer: ingestion token for the comparison modal ---
// Charts SDK base URL — resolved from widget settings in onInit (parity with v-5.2.0).
// Default to PRODUCTION; never hard-code a staging URL here (controller ethos: no hard-coded URLs).
let CHARTS_BASE_URL = '';
let _ingestionToken = null;
let _ingestionTokenInFlight = null;
// The ingestion token is only needed lazily, when the user opens the footer
// comparison modal. Building it eagerly in onInit (and toasting on absent
// SERVER_SCOPE clientId/clientSecret) produces a spurious error in mock/showcase
// runs where those attrs aren't seeded. Pass { silent: true } for the best-effort
// onInit warm-up (logs only); the footer's getIngestionToken triggers a real,
// toast-on-failure build on demand.
async function buildIngestionToken({ silent = false } = {}) {
  const lib = window.MyIOLibrary;
  if (!lib?.buildMyioIngestionAuth) {
    if (!silent)
      toastError('Não foi possível inicializar a autenticação de ingestão (biblioteca indisponível).');
    else LogHelper.warn('[RFC-0211-footer] buildMyioIngestionAuth indisponível — token adiado.');
    return null;
  }
  if (!_credentials?.clientId || !_credentials?.clientSecret) {
    if (!silent)
      toastError('Credenciais de ingestão ausentes (clientId/clientSecret). Verifique os atributos do cliente.');
    else
      LogHelper.warn(
        '[RFC-0211-footer] clientId/clientSecret ausentes no SERVER_SCOPE — token de ingestão adiado (será tentado ao abrir a comparação).'
      );
    return null;
  }
  try {
    const auth = lib.buildMyioIngestionAuth({
      dataApiHost: DATA_API_HOST,
      clientId: _credentials.clientId,
      clientSecret: _credentials.clientSecret,
    });
    _ingestionToken = await auth.getToken();
    if (window.MyIOOrchestrator?.tokenManager?.setToken) {
      window.MyIOOrchestrator.tokenManager.setToken('ingestionToken', _ingestionToken);
    }
    LogHelper.log('[RFC-0211-footer] Ingestion token built');
    return _ingestionToken;
  } catch (err) {
    _ingestionToken = null;
    toastError('Falha ao obter o token de ingestão. Tente novamente mais tarde.');
    LogHelper.error('[RFC-0211-footer] buildIngestionToken error:', err);
    return null;
  }
}

// --- RFC-0211-menu: shopping/customer name resolution + settings modal (domain-agnostic) ---
let _shoppingName = '';
function resolveShoppingName() {
  const ctx = self.ctx || {};
  const title =
    ctx.dashboard?.title || ctx.dashboard?.dashboard?.title ||
    ctx.dashboard?.config?.title || ctx.dashboard?.configuration?.title || null;
  if (title && String(title).trim()) return String(title).trim();
  try {
    const ds = ctx.datasources?.[0];
    if (ds?.entityLabel && String(ds.entityLabel).trim()) return String(ds.entityLabel).trim();
    if (ds?.name && String(ds.name).trim()) return String(ds.name).trim();
  } catch (_e) {
    /* ignore datasource access errors */
  }
  const cu = ctx.currentUser || {};
  if (cu.customerTitle && String(cu.customerTitle).trim()) return String(cu.customerTitle).trim();
  if (cu.customerName && String(cu.customerName).trim()) return String(cu.customerName).trim();
  return '';
}
function updateMenuShoppingName() {
  const name = resolveShoppingName();
  if (name) _shoppingName = name;
  if (_menuInstance?.setShoppingName) _menuInstance.setShoppingName(_shoppingName || '');
}
function openSettings() {
  const lib = window.MyIOLibrary;
  if (!lib?.openMeasurementSetupModal) {
    toastError('Componente de configurações não disponível.');
    return;
  }
  const jwtToken =
    self.ctx?.http?.getServerCredentials?.()?.token || localStorage.getItem('jwt_token');
  if (!jwtToken) {
    toastError('Token de autenticação não encontrado. Faça login novamente.');
    return;
  }
  const customerId = window.MyIOOrchestrator?.customerTB_ID || window.MyIOUtils?.customerTB_ID;
  if (!customerId) {
    toastError('ID do cliente não encontrado. Verifique a configuração do dashboard.');
    return;
  }
  const existingSettings = window.MyIOOrchestrator?.measurementDisplaySettings || null;
  lib
    .openMeasurementSetupModal({
      token: jwtToken,
      customerId,
      existingSettings,
      onSave: (newSettings) => {
        LogHelper.log('Settings saved:', newSettings);
        if (window.MyIOOrchestrator) window.MyIOOrchestrator.measurementDisplaySettings = newSettings;
        window.dispatchEvent(
          new CustomEvent('myio:measurement-settings-updated', { detail: newSettings })
        );
      },
      onClose: () => LogHelper.log('Settings modal closed'),
    })
    .catch((err) => toastError('Erro ao abrir configurações: ' + (err?.message || 'desconhecido')));
}

// --- RFC-0211-grid: card actions (dashboard/report/settings) + selection/drag-to-footer ---
function _resolveCardDeviceId(device) {
  return device?.entityId || device?.tbId || device?.id || device?.ingestionId || null;
}
function handleGridCardAction(action, device) {
  const lib = window.MyIOLibrary;
  if (!lib) {
    toastError('Biblioteca de componentes indisponível.');
    return;
  }
  const jwtToken = localStorage.getItem('jwt_token');
  if (!jwtToken) {
    toastError('Autenticação necessária. Faça login novamente.');
    return;
  }
  const deviceId = _resolveCardDeviceId(device);
  if (!deviceId) {
    toastError('Não foi possível identificar o dispositivo.');
    return;
  }
  const startDateISO = self.ctx?.scope?.startDateISO || null;
  const endDateISO = self.ctx?.scope?.endDateISO || null;
  const apiConfig = {
    tbBaseUrl: THINGSBOARD_URL,
    dataApiBaseUrl: DATA_API_HOST,
    ingestionToken: _credentials?.ingestionId || undefined,
    clientId: _credentials?.clientId || undefined,
    clientSecret: _credentials?.clientSecret || undefined,
  };
  try {
    if (action === 'settings') {
      if (!lib.openDashboardPopupSettings) {
        toastError('Configurações indisponíveis nesta versão.');
        return;
      }
      lib.openDashboardPopupSettings({
        deviceId,
        jwtToken,
        api: apiConfig,
        seed: {
          label: device?.labelOrName || device?.name || undefined,
          identifier: device?.deviceIdentifier || device?.identifier || undefined,
        },
        onSaved: (result) => {
          if (result?.ok) LogHelper.log('[RFC-0211-grid] settings saved', deviceId);
        },
        onError: (err) => toastError(err?.message || 'Erro ao salvar configurações.'),
      });
      return;
    }
    if (action === 'report') {
      if (!lib.openDashboardPopupReport) {
        toastError('Relatório indisponível nesta versão.');
        return;
      }
      lib.openDashboardPopupReport({
        deviceId,
        ingestionId: device?.ingestionId || undefined,
        label: device?.labelOrName || device?.name || undefined,
        deviceType: device?.deviceType || device?.deviceProfile || undefined,
        jwtToken,
        api: apiConfig,
        startDate: startDateISO,
        endDate: endDateISO,
      });
      return;
    }
    if (action === 'dashboard') {
      if (!lib.openDashboardPopup) {
        toastError('Dashboard indisponível nesta versão.');
        return;
      }
      lib.openDashboardPopup({
        deviceId,
        ingestionId: device?.ingestionId || undefined,
        label: device?.labelOrName || device?.name || undefined,
        deviceType: device?.deviceType || device?.deviceProfile || undefined,
        jwtToken,
        api: apiConfig,
        startDate: startDateISO,
        endDate: endDateISO,
      });
      return;
    }
    LogHelper.warn('[RFC-0211-grid] Unknown card action:', action);
  } catch (err) {
    LogHelper.error('[RFC-0211-grid] card action failed:', action, err);
    toastError('Falha ao executar a ação do card.');
  }
}
function gridCardWiring() {
  return { enableSelection: true, enableDragDrop: true, onCardAction: handleGridCardAction };
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

    dispatchDomainSummary(code, allDevices);
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
 * Dispatch one per-domain summary event (KPIs + status). Reused by the initial
 * render and by the consumption-enrichment pass so the header/tooltips refresh
 * once real consumption values arrive.
 */
function dispatchDomainSummary(code, allDevices) {
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
// Consumption / value enrichment (Data Apps API)
// ----------------------------------------------------------------------------
// The GCDR /devices registry carries NO telemetry value (gcdrDeviceToMeta sets value:null).
// Real consumption is fetched separately from the Data Apps API and joined by ingestionId:
//   - energy/water  → GET /telemetry/customers/{custId}/{domain}/devices/totals  (one call/domain)
//   - temperature   → GET /telemetry/devices/{ingestionId}/temperature           (per device, latest)
// Mirrors the v-5.2.0 fetchEnergyDayConsumption / fetchGoalsTemperature behavior.
// ============================================================================

/** Current-month period (1st 00:00 → now), parity with the v-5.2.0 default. */
function defaultMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: now.toISOString() };
}

/** Get a fresh ingestion bearer token (shares buildMyioIngestionAuth's global cache). */
async function getIngestionBearer() {
  const lib = window.MyIOLibrary;
  if (!lib?.buildMyioIngestionAuth) return null;
  if (!_credentials?.clientId || !_credentials?.clientSecret) {
    LogHelper.warn('[consumption] clientId/clientSecret ausentes — consumo não buscado.');
    return null;
  }
  try {
    const auth = lib.buildMyioIngestionAuth({
      dataApiHost: DATA_API_HOST, // already carries /api/v1 → token endpoint is /api/v1/auth
      clientId: _credentials.clientId,
      clientSecret: _credentials.clientSecret,
    });
    return await auth.getToken();
  } catch (err) {
    LogHelper.error('[consumption] token error:', err);
    return null;
  }
}

// A value resolver returned by the fetchers: get(deviceMeta) → number|null, plus `size`
// (how many rows the API returned) for logging. Hides the join strategy from enrichDomainValues.

/**
 * energy/water: one call per domain → value resolver.
 * The ingestion totals response keys each device by (slaveId + gatewayId); the GCDR device
 * carries the same pair as (slaveId + centralId). That composite is the authoritative join —
 * the bare ingestion `id` is only a fallback. Response envelope is `{ data: [...] }`.
 */
async function fetchDomainTotals(domainCode, period, token) {
  // The Data Apps API keys customers by the INGESTION customer id (GCDR customer.metadata.ingestionId),
  // NOT the GCDR customer id. fetchGcdrCustomerCredentials captured it into _credentials.ingestionId.
  const ingestionCustomerId = _credentials?.ingestionId || '';
  if (!ingestionCustomerId) {
    throw new Error('ingestionCustomerId ausente (customer.metadata.ingestionId não resolvido)');
  }
  const url = new URL(`${DATA_API_HOST}/telemetry/customers/${ingestionCustomerId}/${domainCode}/devices/totals`);
  url.searchParams.set('startTime', period.startISO);
  url.searchParams.set('endTime', period.endISO);
  url.searchParams.set('deep', '1');
  url.searchParams.set('granularity', '1d');
  const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  // Envelope is `{ data: [...] }`; tolerate `{ devices: [...] }` and a bare array.
  const rows = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.devices)
      ? json.devices
      : Array.isArray(json)
        ? json
        : [];
  const byComposite = new Map(); // `${slaveId}::${gatewayId}` → value (authoritative)
  const byId = new Map(); // ingestion device id → value (fallback)
  for (const row of rows) {
    const val = row.total_value ?? row.totalValue ?? row.total ?? null;
    if (val == null) continue;
    const num = Number(val);
    const id = row.id ?? row.deviceId ?? row.ingestionId;
    if (id != null) byId.set(String(id), num);
    const slaveId = row.slaveId;
    const gatewayId = row.gatewayId ?? row.gateway_id ?? row.centralId;
    if (slaveId != null && gatewayId) byComposite.set(`${slaveId}::${gatewayId}`, num);
  }
  return {
    size: rows.length,
    get(dev) {
      // Primary: (slaveId + centralId) ↔ (slaveId + gatewayId).
      if (dev.slaveId != null && dev.slaveId !== '' && dev.centralId) {
        const v = byComposite.get(`${dev.slaveId}::${dev.centralId}`);
        if (v != null) return v;
      }
      // Fallback: GCDR ingestionId ↔ ingestion device id.
      if (dev.ingestionId) {
        const v = byId.get(String(dev.ingestionId));
        if (v != null) return v;
      }
      return null;
    },
  };
}

/** temperature: per-device latest reading → value resolver keyed by the device's ingestionId. */
async function fetchDomainTemperature(devices, period, token) {
  const byId = new Map();
  const targets = devices.filter((d) => d.ingestionId);
  await Promise.all(
    targets.map(async (dev) => {
      try {
        const url = new URL(`${DATA_API_HOST}/telemetry/devices/${dev.ingestionId}/temperature`);
        url.searchParams.set('startTime', period.startISO);
        url.searchParams.set('endTime', period.endISO);
        url.searchParams.set('granularity', '1h');
        url.searchParams.set('deep', '0');
        const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) return;
        const data = await resp.json();
        const deviceData = Array.isArray(data?.data) ? data.data[0] : Array.isArray(data) ? data[0] : data;
        const points = deviceData?.consumption || deviceData?.readings || [];
        const last = points.length ? points[points.length - 1] : null;
        const v = last?.value ?? last?.consumption ?? null;
        if (v != null) byId.set(String(dev.ingestionId), Number(v));
      } catch {
        /* skip this sensor */
      }
    })
  );
  return {
    size: byId.size,
    get: (dev) => (dev.ingestionId ? byId.get(String(dev.ingestionId)) ?? null : null),
  };
}

/**
 * Fetch real values for every domain for `period`, join them into the classified
 * device metas (window.STATE.classified), then re-feed grids + info + re-dispatch
 * the per-domain summaries. Cards render first (value 0) and fill in when this resolves.
 */
async function enrichDomainValues(period) {
  if (!period || !_classificationTree?.domains?.length) return;
  const token = await getIngestionBearer();
  if (!token) {
    LogHelper.warn('[consumption] sem token de ingestão — valores de consumo não carregados.');
    return;
  }
  const classified = window.STATE?.classified || {};

  for (const d of _classificationTree.domains) {
    const code = d.code;
    const domainDevices = [];
    for (const c of d.columns) domainDevices.push(...(classified[code]?.[c.key] || []));
    if (!domainDevices.length) continue;

    let resolver;
    try {
      resolver = TEMPERATURE_DOMAIN_CODES.includes(code)
        ? await fetchDomainTemperature(domainDevices, period, token)
        : await fetchDomainTotals(code, period, token);
    } catch (err) {
      LogHelper.error(`[consumption] falha ao buscar valores de ${code}:`, err);
      toastError(`Falha ao carregar consumo de ${DOMAIN[code]?.name || code}.`);
      continue;
    }

    // Join into the classified metas (resolver matches by slaveId+centralId, id fallback).
    let applied = 0;
    for (const dev of domainDevices) {
      const v = resolver.get(dev);
      if (v != null) {
        dev.value = v;
        dev.val = v;
        dev.consumption = v;
        applied++;
      }
    }

    // Re-feed grids + breakdown + KPIs with the enriched values.
    for (const c of d.columns) {
      const items = classified[code]?.[c.key] || [];
      _grids.get(`${code}::${c.key}`)?.updateDevices?.(items.map(toTelemetryDevice));
    }
    updateOneInfo(d, classified);
    dispatchDomainSummary(code, domainDevices);
    LogHelper.log(
      `[consumption] ${code}: ${applied}/${domainDevices.length} devices com valor (API retornou ${resolver.size} linhas)`
    );
  }
}

// ============================================================================
// Credentials Fetching
// ============================================================================
async function fetchCredentials(customerTbId) {
  const jwt = self.ctx?.http?.getServerCredentials?.()?.token;
  LogHelper.log(
    '[SERVER_SCOPE] fetchCredentials → customerTB_ID:', customerTbId || '(vazio)',
    '· THINGSBOARD_URL:', THINGSBOARD_URL || '(vazio)',
    '· JWT:', jwt ? '✅ presente' : '❌ ausente'
  );
  if (!customerTbId) {
    LogHelper.error('[SERVER_SCOPE] customerTB_ID ausente — chamada de atributos NÃO será feita.');
    return null;
  }
  if (!jwt) {
    LogHelper.error('[SERVER_SCOPE] JWT ausente (ctx.http.getServerCredentials) — não é possível buscar atributos.');
    return null;
  }

  try {
    const url = `${THINGSBOARD_URL}/api/plugins/telemetry/CUSTOMER/${customerTbId}/values/attributes/SERVER_SCOPE`;
    LogHelper.log('[SERVER_SCOPE] GET', url);
    const response = await fetch(url, {
      headers: { 'X-Authorization': `Bearer ${jwt}` },
    });
    LogHelper.log('[SERVER_SCOPE] resposta:', response.status, response.ok ? 'OK' : 'FALHA');

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const attrs = await response.json();
    const get = (key) => attrs.find((a) => a.key === key)?.value;
    // Log WHICH keys resolved (presence only — never the secret values).
    const present = (Array.isArray(attrs) ? attrs : []).map((a) => a.key);
    LogHelper.log(
      '[SERVER_SCOPE] atributos recebidos:', present.length, '→', present.join(', ') || '(nenhum)'
    );
    const creds = {
      clientId: get('clientId') || '',
      clientSecret: get('clientSecret') || '',
      ingestionId: get('customerId') || '',
      gcdrCustomerId: get('gcdrCustomerId') || get('gcdrId') || '',
      gcdrTenantId: get('gcdrTenantId') || '',
      // RFC-0047: X-API-Key for the GCDR reads (entities/resolve, devices, customers).
      gcdrApiKey: get('gcdrApiKey') || '',
    };
    LogHelper.log(
      '[SERVER_SCOPE] resolvido:',
      'gcdrApiKey', creds.gcdrApiKey ? '✅' : '❌',
      '· gcdrCustomerId', creds.gcdrCustomerId ? '✅' : '❌',
      '· gcdrTenantId', creds.gcdrTenantId ? '✅' : '❌',
      '· clientId', creds.clientId ? '✅' : '❌',
      '· clientSecret', creds.clientSecret ? '✅' : '❌'
    );
    return creds;
  } catch (err) {
    LogHelper.error('[SERVER_SCOPE] Failed to fetch credentials:', err);
    return null;
  }
}

// Ingestion clientId/clientSecret now live in the GCDR customer's `metadata`
// (no longer TB SERVER_SCOPE). GET ${gcdrApiBaseUrl}/customers/:id (X-API-Key)
// and read metadata.client_id / metadata.client_secret. Accepts the common
// envelope shapes ({...}, {data:{...}}, {items:[{...}]}) and snake/camel keys.
async function fetchGcdrCustomerCredentials(gcdrApiBaseUrl, gcdrCustomerId) {
  if (!gcdrApiBaseUrl || !gcdrCustomerId) {
    LogHelper.warn(
      '[RFC-0211-footer] gcdrApiBaseUrl/gcdrCustomerId ausentes — credenciais de ingestão não buscadas no GCDR.'
    );
    return null;
  }
  const apiKey =
    window.MyIOOrchestrator?.gcdrApiKey || window.MyIOUtils?.customerAttrs?.gcdrapikey || '';
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    const url = `${gcdrApiBaseUrl}/customers/${encodeURIComponent(gcdrCustomerId)}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    const customer =
      body?.data || (Array.isArray(body?.items) ? body.items[0] : null) || body || {};
    const md = customer.metadata || {};
    const creds = {
      clientId: md.client_id || md.clientId || '',
      clientSecret: md.client_secret || md.clientSecret || '',
      ingestionId:
        md.ingestionId || md.ingestion_id || md.customerId || md.customer_id || '',
    };
    LogHelper.log(
      '[RFC-0211-footer] GCDR customer credentials:',
      creds.clientId ? 'clientId ok' : 'clientId AUSENTE',
      creds.clientSecret ? '· clientSecret ok' : '· clientSecret AUSENTE'
    );
    return creds;
  } catch (err) {
    LogHelper.error('[RFC-0211-footer] Failed to fetch GCDR customer credentials:', err);
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
    updateMenuShoppingName(); // RFC-0211-menu: refresh name (customerTitle may now be available)
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
    if (user.customerTitle && !_shoppingName) _shoppingName = String(user.customerTitle).trim();
    updateMenuShoppingName(); // RFC-0211-menu: refresh name after API user resolve
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
  // Reuse the customerTB_ID resolved in onInit (setting → TB context), not just the raw setting.
  const customerTbId = window.MyIOUtils?.customerTB_ID || settings.customerTB_ID || '';

  // Create Menu with collapse handler
  const menuContainer = document.getElementById('menuContainer');
  if (menuContainer && lib.createMenuShoppingComponent) {
    _menuInstance = lib.createMenuShoppingComponent({
      container: menuContainer,
      themeMode: _currentThemeMode,
      // RFC-0047: menu tabs driven by the GCDR tree (ACTIVE domains only — the adapter already
      // dropped isActive:false roots). No hard-coded energy/water/temperature.
      configTemplate: {
        initialDomain: _classificationTree?.domains?.[0]?.code || '',
        tabs: (_classificationTree?.domains || []).map((d) => ({
          id: `tab-${d.code}`,
          domain: d.code,
          label: d.label || DOMAIN[d.code]?.name || d.code,
          icon: DOMAIN[d.code]?.icon || '•',
          enabled: true,
        })),
      },
      // RFC-0211-menu: real shopping name instead of the "Trocar Shopping" placeholder
      shoppingName: resolveShoppingName(),
      onTabChange: (domain) => {
        LogHelper.log('Tab changed:', domain);
        switchContentState(domain);
      },
      onToggleCollapse: handleMenuCollapse,
      // RFC-0211-menu: open the settings modal on "Configurações" click
      onSettingsClick: openSettings,
      // RFC-0211-menu: shopping selector — emit event so a future picker can react
      onShoppingSelectorClick: () => {
        window.dispatchEvent(new CustomEvent('myio:shopping-selector-click'));
      },
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
      // RFC-0211-footer: ingestion token + API hosts the comparison modal needs (mirrors v-5.2.0 FOOTER)
      dataApiHost: DATA_API_HOST,
      chartsBaseUrl: CHARTS_BASE_URL,
      // Lazy build on first comparison: if the eager warm-up was skipped (creds
      // arrived late / absent at init), kick off a real toast-on-failure build now.
      getIngestionToken: () => {
        if (!_ingestionToken && !_ingestionTokenInFlight) {
          _ingestionTokenInFlight = buildIngestionToken().finally(() => {
            _ingestionTokenInFlight = null;
          });
        }
        return _ingestionToken || undefined;
      },
      // RFC-0211-footer: surface failures via toast instead of only console
      onError: (err) => {
        toastError(`Não foi possível abrir a comparação: ${err?.message || err}`);
      },
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
            ...gridCardWiring(), // RFC-0211-grid: card actions + selection + drag-to-footer
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

// Header date picker → re-fetch consumption for the chosen period and re-render.
// The header emits { period: { startISO, endISO, granularity } } (also tolerate a bare period).
window.addEventListener('myio:update-date', (e) => {
  const p = e.detail?.period || e.detail || {};
  if (!p.startISO || !p.endISO) return;
  _currentPeriod = { startISO: p.startISO, endISO: p.endISO };
  LogHelper.log('[consumption] período atualizado:', _currentPeriod.startISO, '→', _currentPeriod.endISO);
  enrichDomainValues(_currentPeriod).catch((err) =>
    LogHelper.error('[consumption] enrichment por período falhou:', err)
  );
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
    const headers = { Accept: 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    const enc = encodeURIComponent(gcdrCustomerId);
    // RFC-0047: prefer /entities/resolve (effective taxonomy — system fallback when the customer
    // has no override). Some deployments (older prod) don't expose /resolve yet (404) → fall back
    // to the raw list endpoint, which returns the customer's own rows (works when the customer
    // already has its own tree). 401/403 are NOT a fallback case (that's the X-API-Key).
    const resolveUrl = `${gcdrApiBaseUrl}/entities/resolve?customerId=${enc}&deep=all`;
    const listUrl = `${gcdrApiBaseUrl}/entities?parentId=null&deep=all&customerId=${enc}`;
    let resp = await fetch(resolveUrl, { headers });
    let usedFallback = false;
    if (resp.status === 404) {
      LogHelper.warn('[classification] /entities/resolve 404 — usando fallback /entities?parentId=null');
      resp = await fetch(listUrl, { headers });
      usedFallback = true;
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status} (${usedFallback ? 'list' : 'resolve'})`);
    const json = await resp.json();
    // /resolve → { data: { source, version, roots } }; list → { data: [...] } | { data: { items } }.
    // The adapter handles all of these; normalize roots defensively for the current dist bundle.
    const treeInput = json?.data?.roots ? { items: json.data.roots } : json;
    _classificationTree = window.MyIOLibrary.parseClassificationEntities(treeInput);
    LogHelper.log(
      '[classification]', usedFallback ? 'list' : '/resolve',
      '· source:', json?.data?.source || '(n/a)',
      '· roots:', json?.data?.roots?.length ?? (Array.isArray(json?.data) ? json.data.length : '?')
    );
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

// The null-customer placeholder TB uses for tenant scope ("no customer").
const TB_NULL_CUSTOMER = '13814000-1dd2-11b2-8080-808080808080';

/**
 * Resolve the customer's ThingsBoard id (key to the SERVER_SCOPE attributes):
 *   1) widget setting customerTB_ID;
 *   2) the logged-in user's customerId (customer dashboards);
 *   3) a CUSTOMER-typed datasource entity bound to the dashboard state.
 * Returns '' when none applies (e.g. a tenant admin with no selected customer).
 */
function resolveCustomerTbId(settings) {
  const fromSettings = (settings?.customerTB_ID || '').trim();
  if (fromSettings) return fromSettings;

  const cu = self.ctx?.currentUser || {};
  const cuId = typeof cu.customerId === 'object' ? cu.customerId?.id : cu.customerId;
  if (cuId && cuId !== TB_NULL_CUSTOMER) return String(cuId);

  for (const ds of self.ctx?.datasources || []) {
    if ((ds?.entityType || '').toUpperCase() === 'CUSTOMER' && ds.entityId) return String(ds.entityId);
  }
  return '';
}

self.onInit = async function () {
  LogHelper.log('onInit starting...');

  // Load the MyIO standard font (Nunito) before anything renders.
  injectNunitoFont();

  const settings = self.ctx?.settings || {};
  // customerTB_ID is the key to fetch the customer SERVER_SCOPE (gcdrApiKey, gcdrCustomerId, …).
  // Primary: widget setting. Fallback: the TB context (logged-in customer user, or the bound
  // datasource entity) — so a customer-facing dashboard works even without the explicit setting.
  // Without it, fetchCredentials never runs → no SERVER_SCOPE → GCDR calls 401.
  const customerTbId = resolveCustomerTbId(settings);
  window.MyIOUtils.customerTB_ID = customerTbId;
  // HARD STOP: customerTB_ID is the linchpin — without it there is no SERVER_SCOPE, hence no
  // gcdrApiKey/gcdrCustomerId, hence no tree/devices/consumption. Abort onInit with ONE clear
  // error instead of letting the flow degrade and emit a cascade of follow-up toasts.
  if (!customerTbId) {
    LogHelper.error('[MAIN_VIEW v5.4.0] customerTB_ID ausente — abortando onInit.');
    toastError(
      '[MAIN_VIEW v5.4.0] customerTB_ID não configurado. Defina o "Customer ThingsBoard ID" nas settings do widget (ou abra o dashboard como usuário do customer). O dashboard não pode carregar sem ele.'
    );
    return;
  }
  LogHelper.log('customerTB_ID resolvido:', customerTbId);

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
  // DATA_API_HOST must carry the /api/v1 suffix (parity with v-5.2.0 getDataApiHost()):
  // buildMyioIngestionAuth appends '/auth' → '/api/v1/auth', and the footer/popup fetchers
  // strip /api/v1 themselves when they need the bare base. Normalize so the suffix is always
  // present whether the setting is entered with or without it (the old code STRIPPED it,
  // sending the auth call to '.../auth' instead of '.../api/v1/auth').
  const _rawDataApiHost = (settings.dataApiHost || '').replace(/\/+$/, '');
  DATA_API_HOST = _rawDataApiHost ? _rawDataApiHost.replace(/\/api\/v1$/, '') + '/api/v1' : '';
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

  // RFC-0211-footer: Charts SDK base URL from settings (parity with v-5.2.0); default PRODUCTION.
  // The footer comparison modal loads the EnergyChartSDK UMD/iframes from here.
  CHARTS_BASE_URL = settings.chartsBaseUrl || 'https://graphs.apps.myio-bas.com';

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

  // Fetch credentials (TB SERVER_SCOPE) — still the source for the GCDR id/tenant
  // fallback and the ingestion customerId. clientId/clientSecret were MOVED to the
  // GCDR customer metadata (see below); SERVER_SCOPE values, if any, are only a fallback.
  // customerTbId is guaranteed non-empty here (onInit aborts above otherwise).
  LogHelper.log('[SERVER_SCOPE] iniciando busca de atributos do customer', customerTbId, '…');
  _credentials = await fetchCredentials(customerTbId);
  if (_credentials) {
    LogHelper.log('Credentials fetched (TB SERVER_SCOPE)');

    // RFC-0180: Fallback GCDR IDs from TB attrs when not set in widget settings
    if (!gcdrCustomerId) gcdrCustomerId = _credentials.gcdrCustomerId || '';
    if (!gcdrTenantId) gcdrTenantId = _credentials.gcdrTenantId || '';
  } else {
    LogHelper.error('[SERVER_SCOPE] fetchCredentials retornou null — atributos do customer NÃO carregados (ver logs acima).');
  }

  // RFC-0047: publish the GCDR X-API-Key BEFORE any GCDR fetch (resolve/devices/customers read
  // MyIOOrchestrator.gcdrApiKey first). Source: widget settings → SERVER_SCOPE attr (parity with
  // v-5.2.0). Without this the onInit fetches run with an empty key → 401. Mirror to customerAttrs
  // so the secondary fallback in the fetchers also resolves.
  const _gcdrApiKey = settings.gcdrApiKey || _credentials?.gcdrApiKey || '';
  if (window.MyIOOrchestrator) window.MyIOOrchestrator.gcdrApiKey = _gcdrApiKey;
  window.MyIOUtils.customerAttrs = window.MyIOUtils.customerAttrs || {};
  if (_gcdrApiKey) window.MyIOUtils.customerAttrs.gcdrapikey = _gcdrApiKey;
  if (!_gcdrApiKey) {
    toastError(
      '[MAIN_VIEW v5.4.0] gcdrApiKey ausente (settings + SERVER_SCOPE). As chamadas GCDR retornarão 401.'
    );
  }

  // Ingestion clientId/clientSecret now come from the GCDR customer metadata.
  // Fetch them once gcdrCustomerId is resolved; GCDR values win over any legacy
  // SERVER_SCOPE values (which migrate away). Merge into _credentials so the rest
  // of the flow (orchestrator + footer token) is unchanged.
  if (gcdrCustomerId) {
    const gcdrCreds = await fetchGcdrCustomerCredentials(gcdrApiBaseUrl, gcdrCustomerId);
    if (gcdrCreds && (gcdrCreds.clientId || gcdrCreds.clientSecret || gcdrCreds.ingestionId)) {
      _credentials = {
        ...(_credentials || {}),
        clientId: gcdrCreds.clientId || _credentials?.clientId || '',
        clientSecret: gcdrCreds.clientSecret || _credentials?.clientSecret || '',
        ingestionId: gcdrCreds.ingestionId || _credentials?.ingestionId || '',
      };
    }
  }

  // Set credentials in orchestrator (after the GCDR merge so it carries the real creds)
  if (_credentials && window.MyIOOrchestrator?.setCredentials) {
    window.MyIOOrchestrator.setCredentials(
      _credentials.ingestionId,
      _credentials.clientId,
      _credentials.clientSecret
    );
  }

  // RFC-0211-footer: expose credentials to the lib (ComparisonHandler reads MyIOUtils.getCredentials)
  // and build the ingestion token used by the footer comparison modal.
  if (_credentials) {
    window.MyIOUtils.getCredentials = () => ({
      clientId: _credentials.clientId,
      clientSecret: _credentials.clientSecret,
      ingestionId: _credentials.ingestionId,
    });
    // Best-effort warm-up only — never toast here (creds may legitimately be
    // absent in mock/showcase). The footer builds on demand with error surfacing.
    await buildIngestionToken({ silent: true });
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

  // Fetch real consumption (Data Apps API) for the default period (current month) and join
  // it into the cards. Non-blocking: cards render immediately (value 0), then fill in.
  _currentPeriod = defaultMonthPeriod();
  enrichDomainValues(_currentPeriod).catch((err) =>
    LogHelper.error('[consumption] enrichment inicial falhou:', err)
  );

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
