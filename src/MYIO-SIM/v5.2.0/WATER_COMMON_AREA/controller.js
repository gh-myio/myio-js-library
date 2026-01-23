/* global self, window, document, localStorage, MyIOLibrary, $ */

/* =========================================================================
 * ThingsBoard Widget: Water Common Area - Device Cards for Water Meters (MyIO)
 * RFC-0094: Aligned with WATER_STORES pattern using buildHeaderDevicesGrid and createFilterModal
 * - Filters devices by aliasName = 'HidrometrosAreaComum'
 * - Uses domain='water' for M³ formatting
 * - Datas obrigatórias: startDateISO / endDateISO
 * - Se ausentes no onInit: usa "current month so far" (1º dia 00:00 → hoje 23:59)
 * - Modal premium (busy) no widget durante carregamentos
 * - Modal premium global (fora do widget) para sucesso, com contador e reload
 * - onDataUpdated: no-op
 * - Evento (myio:update-date): mostra modal + atualiza
 * =========================================================================*/

// ============================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

const getDataApiHost = () => {
  const host = window.MyIOUtils?.DATA_API_HOST;
  if (!host) {
    console.error('[WATER_COMMON_AREA] DATA_API_HOST not available - MAIN widget not loaded');
  }
  return host || '';
};

// RFC-0071: Device Profile functions (from MAIN)

// RFC-0094: UI Helper from MAIN (replaces local getCustomerNameForDevice)
const getCustomerNameForDevice =
  window.MyIOUtils?.getCustomerNameForDevice ||
  ((device) => {
    console.error('[WATER_COMMON_AREA] getCustomerNameForDevice not available - MAIN widget not loaded');
    return device?.customerId ? `ID: ${device.customerId.substring(0, 8)}...` : 'N/A';
  });

// RFC-0094: Device status calculation functions from MAIN
const mapConnectionStatus = window.MyIOUtils?.mapConnectionStatus || ((status) => status || 'offline');

// RFC-0110: Centralized functions from MAIN for device status calculation
const calculateDeviceStatusMasterRules =
  window.MyIOUtils?.calculateDeviceStatusMasterRules || (() => 'no_info');

const createStandardFilterTabs =
  window.MyIOUtils?.createStandardFilterTabs || (() => [{ id: 'all', label: 'Todos', filter: () => true }]);

const clearValueIfOffline = window.MyIOUtils?.clearValueIfOffline || ((value, status) => value);

const calculateOperationTime =
  window.MyIOUtils?.calculateOperationTime || ((lastConnectTime) => ({ durationMs: 0, formatted: '-' }));

// RFC-0094: formatarDuracao for operationHours calculation (from MAIN)
const formatarDuracao = window.MyIOUtils?.formatarDuracao || ((ms) => `${Math.round(ms / 1000)}s`);

// RFC-0094: Global MAP_INSTANTANEOUS_POWER (will be loaded from settings if available)
let MAP_INSTANTANEOUS_POWER = null;

LogHelper.log('🚀 [WATER_COMMON_AREA] Controller loaded - VERSION WITH RFC-0094 PATTERN');

const MAX_FIRST_HYDRATES = 1;

// RFC-0094: Centralized header controller
let waterCommonAreaHeaderController = null;

let dateUpdateHandler = null;
let dataProvideHandler = null; // RFC-0042: Orchestrator data listener
let waterDataReadyHandler = null; // FIX: Handler for myio:water-data-ready from MAIN
let waterTbDataHandler = null; // Handler for myio:water-tb-data-ready from MAIN (centralized datasources)
let MyIO = null;

// Cache para dados recebidos do MAIN (datasources centralizados)
let mainWaterData = {
  datasources: [],
  data: [],
  ids: [],
  loaded: false,
};

let lastProcessedPeriodKey = null; // Track last processed periodKey to prevent duplicate processing

// RFC-0094: Widget configuration (from settings) - WATER DOMAIN
let WIDGET_DOMAIN = 'water';

// Card rendering options (from settings, with defaults)
let USE_NEW_COMPONENTS = true;
let ENABLE_SELECTION = true;
let ENABLE_DRAG_DROP = true;
let HIDE_INFO_MENU_ITEM = true;
let DEBUG_ACTIVE = false;
let ACTIVE_TOOLTIP_DEBUG = false;

/** ===================== STATE ===================== **/
let CLIENT_ID = '';
let CLIENT_SECRET = '';
let CUSTOMER_ING_ID = '';
let MyIOAuth = null;

const STATE = {
  itemsBase: [], // lista autoritativa (TB)
  itemsEnriched: [], // lista com totals + perc
  dataFromMain: false, // RFC-0109: Flag to indicate data came from MAIN (skip hydrateAndRender)
  searchActive: false,
  searchTerm: '',
  selectedIds: /** @type {Set<string> | null} */ (null),
  sortMode:
    /** @type {'cons_desc'|'cons_asc'|'alpha_asc'|'alpha_desc'|'status_asc'|'status_desc'|'shopping_asc'|'shopping_desc'} */ (
      'cons_desc'
    ),
  firstHydrates: 0,
  selectedShoppingIds: [], // RFC-0093: Shopping filter from MENU
};

let hydrating = false;

/** ===================== HELPERS (DOM) ===================== **/
const $root = () => $(self.ctx.$container[0]);
const $list = () => $root().find('#waterCommonAreaList');

/** ===================== BUSY MODAL (no widget) ===================== **/
const BUSY_ID = 'myio-busy-modal';
function ensureBusyModalDOM() {
  let $m = $root().find(`#${BUSY_ID}`);
  if ($m.length) return $m;

  const html = `
  <div id="${BUSY_ID}" style="
      position:absolute; inset:0; display:none;
      background: rgba(150,132,181,0.45); /* #9684B5 com transparência */
      backdrop-filter: blur(5px);
      z-index:9999; align-items:center; justify-content:center;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;">
    <div style="
        background:#2d1458; color:#fff;
        border:1px solid rgba(255,255,255,0.10);
        box-shadow:0 12px 40px rgba(0,0,0,.35);
        border-radius:18px; padding:22px 26px; min-width:320px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="spinner" style="
            width:22px;height:22px;border-radius:50%;
            border:3px solid rgba(255,255,255,.25);
            border-top-color:#ffffff; animation:spin .9s linear infinite;"></div>
        <div id="${BUSY_ID}-msg" style="font-weight:600; font-size:14px; letter-spacing:.2px;">
          aguarde.. carregando os dados...
        </div>
      </div>
    </div>
  </div>
  <style>
    @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  </style>`;
  $root().css('position', 'relative'); // garante overlay correto
  $root().append(html);
  return $root().find(`#${BUSY_ID}`);
}

// RFC-0044: Use centralized busy management
function showBusy(message, timeoutMs = 35000) {
  LogHelper.log(`[WATER_COMMON_AREA] 🔄 showBusy() called with message: "${message || 'default'}"`);

  // Prevent multiple simultaneous busy calls
  if (window.busyInProgress) {
    LogHelper.log(`[WATER_COMMON_AREA] ⏭️ Skipping duplicate showBusy() call`);
    return;
  }

  window.busyInProgress = true;

  // Centralized busy with enhanced synchronization
  const safeShowBusy = () => {
    try {
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.showGlobalBusy === 'function') {
        const text = (message && String(message).trim()) || 'Carregando dados...';
        window.MyIOOrchestrator.showGlobalBusy(WIDGET_DOMAIN, text, timeoutMs);
        LogHelper.log(`[WATER_COMMON_AREA] ✅ Using centralized busy for domain: ${WIDGET_DOMAIN}`);
      } else {
        LogHelper.warn(`[WATER_COMMON_AREA] ⚠️ Orchestrator not available, using fallback busy`);
        const $m = ensureBusyModalDOM();
        const text = (message && String(message).trim()) || 'aguarde.. carregando os dados...';
        $m.find(`#${BUSY_ID}-msg`).text(text);
        $m.css('display', 'flex');
      }
    } catch (err) {
      LogHelper.error(`[WATER_COMMON_AREA] ❌ Error in showBusy:`, err);
    } finally {
      // Always reset busy flag after a short delay
      setTimeout(() => {
        window.busyInProgress = false;
      }, 500);
    }
  };

  safeShowBusy();
}

function hideBusy() {
  LogHelper.log(`[WATER_COMMON_AREA] ✅ hideBusy() called`);

  // RFC-0044: Use centralized busy management
  if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.hideGlobalBusy === 'function') {
    window.MyIOOrchestrator.hideGlobalBusy(WIDGET_DOMAIN);
  }

  // Also hide local fallback
  const $m = $root().find(`#${BUSY_ID}`);
  if ($m.length) $m.css('display', 'none');
}

/** ===================== GLOBAL SUCCESS MODAL ===================== **/
const SUCCESS_MODAL_ID = 'myio-global-success-modal';
function showGlobalSuccessModal(countdown = 5) {
  LogHelper.log('[WATER_COMMON_AREA] showGlobalSuccessModal');
  let $m = $(document.body).find(`#${SUCCESS_MODAL_ID}`);
  if (!$m.length) {
    const html = `
    <div id="${SUCCESS_MODAL_ID}" style="
        position:fixed; inset:0; display:flex;
        background:rgba(0,0,0,.5); backdrop-filter:blur(6px);
        z-index:999999; align-items:center; justify-content:center;
        font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif;">
      <div style="background:#fff;border-radius:18px;padding:28px 36px;
          min-width:420px;box-shadow:0 15px 50px rgba(0,0,0,.3);text-align:center;">
        <div style="font-size:48px; margin-bottom:14px;">✅</div>
        <div style="font-weight:700;font-size:20px;color:#1C2743;margin-bottom:8px;">Tudo certo!</div>
        <div style="font-size:14px;color:#555;margin-bottom:22px;">
          Configurações salvas com sucesso.<br>
          Recarregando em <span id="${SUCCESS_MODAL_ID}-counter">${countdown}</span>s...
        </div>
        <button id="${SUCCESS_MODAL_ID}-btn" style="
            padding:10px 28px; font-size:15px; font-weight:600;
            border-radius:10px; border:none; cursor:pointer;
            background:#3E1A7D; color:#fff;">
          Recarregar agora
        </button>
      </div>
    </div>`;
    $(document.body).append(html);
    $m = $(document.body).find(`#${SUCCESS_MODAL_ID}`);
    $m.find(`#${SUCCESS_MODAL_ID}-btn`).on('click', () => {
      window.location.reload();
    });
  }
  $m.css('display', 'flex');

  let sec = countdown;
  const $c = $m.find(`#${SUCCESS_MODAL_ID}-counter`);
  const iv = setInterval(() => {
    sec--;
    $c.text(sec);
    if (sec <= 0) {
      clearInterval(iv);
      window.location.reload();
    }
  }, 1000);
}

function hideGlobalSuccessModal() {
  const $m = $(document.body).find(`#${SUCCESS_MODAL_ID}`);
  if ($m.length) $m.remove();
}

/** ===================== HELPERS ===================== **/
function isValidUUID(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
}

function toSpOffsetNoMs(iso, isEndDate = false) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const tzOffsetMs = -3 * 60 * 60 * 1000;
  const localMs = d.getTime() + tzOffsetMs;
  const localDate = new Date(localMs);
  const YYYY = localDate.getUTCFullYear();
  const MM = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const DD = String(localDate.getUTCDate()).padStart(2, '0');
  let HH, mm, ss;
  if (isEndDate) {
    HH = '23';
    mm = '59';
    ss = '59';
  } else {
    HH = String(localDate.getUTCHours()).padStart(2, '0');
    mm = String(localDate.getUTCMinutes()).padStart(2, '0');
    ss = String(localDate.getUTCSeconds()).padStart(2, '0');
  }
  return `${YYYY}-${MM}-${DD}T${HH}:${mm}:${ss}-03:00`;
}

function mustGetDateRange() {
  const startISO = self.ctx.$scope?.startDateISO || self.ctx?.scope?.startDateISO;
  const endISO = self.ctx.$scope?.endDateISO || self.ctx?.scope?.endDateISO;
  if (!startISO || !endISO) {
    throw new Error('Missing start/end date');
  }
  return { startISO, endISO };
}

/** ===================== TB INDEXES ===================== **/
function buildTbAttrIndex() {
  const byTbId = new Map();

  // Use centralized data from MAIN if available, otherwise use local ctx.data
  const rows =
    mainWaterData.loaded && mainWaterData.data.length > 0
      ? mainWaterData.data
      : Array.isArray(self.ctx?.data)
      ? self.ctx.data
      : [];

  for (const row of rows) {
    // RFC-0094: Filter by aliasName = 'HidrometrosAreaComum'
    const aliasName = row?.datasource?.aliasName || '';
    if (aliasName !== 'HidrometrosAreaComum') continue;

    const key = String(row?.dataKey?.name || '').toLowerCase();
    const tbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val = row?.data?.[0]?.[1];
    if (!tbId || val == null) continue;
    if (!byTbId.has(tbId))
      byTbId.set(tbId, {
        slaveId: null,
        centralId: null,
        deviceType: null,
        centralName: null,
        lastConnectTime: null,
        lastActivityTime: null,
        lastDisconnectTime: null,
        deviceMapInstaneousPower: null,
        customerId: null,
        connectionStatus: null,
        pulses: null, // FIX: Water meters use pulses (litros), not consumption_power
        ingestionId: null,
        identifier: null,
        label: null,
        deviceProfile: null,
      });
    const slot = byTbId.get(tbId);
    if (key === 'slaveid') slot.slaveId = val;
    if (key === 'centralid') slot.centralId = val;
    if (key === 'devicetype') slot.deviceType = val;
    if (key === 'deviceprofile') slot.deviceProfile = val;
    if (key === 'centralname') slot.centralName = val;
    if (key === 'lastconnecttime') slot.lastConnectTime = val;
    if (key === 'lastactivitytime') slot.lastActivityTime = val;
    if (key === 'lastdisconnecttime') slot.lastDisconnectTime = val;
    if (key === 'devicemapinstaneouspower') slot.deviceMapInstaneousPower = val;
    if (key === 'customerid') slot.customerId = val;
    if (key === 'connectionstatus') slot.connectionStatus = val;
    if (key === 'pulses') slot.pulses = val; // FIX: Water meters use pulses (litros)
    if (key === 'ingestionid') slot.ingestionId = val;
    if (key === 'identifier') slot.identifier = val;
    if (key === 'label') slot.label = val;
  }
  return byTbId;
}

function buildTbIdIndexes() {
  const byIdentifier = new Map(); // identifier -> tbId
  const byIngestion = new Map(); // ingestionId -> tbId

  // Use centralized data from MAIN if available, otherwise use local ctx.data
  const rows =
    mainWaterData.loaded && mainWaterData.data.length > 0
      ? mainWaterData.data
      : Array.isArray(self.ctx?.data)
      ? self.ctx.data
      : [];

  for (const row of rows) {
    // RFC-0094: Filter by aliasName = 'HidrometrosAreaComum'
    const aliasName = row?.datasource?.aliasName || '';
    if (aliasName !== 'HidrometrosAreaComum') continue;

    const key = String(row?.dataKey?.name || '').toLowerCase();
    const tbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val = row?.data?.[0]?.[1];
    if (!tbId || val == null) continue;
    if (key === 'identifier') byIdentifier.set(String(val), tbId);
    if (key === 'ingestionid') byIngestion.set(String(val), tbId);
  }
  return { byIdentifier, byIngestion };
}

/** ===================== CORE: DATA PIPELINE ===================== **/
function buildAuthoritativeItems() {
  // FIX: ALWAYS use local widget datasources filtered by aliasName = 'HidrometrosAreaComum'
  // This ensures only area comum devices are shown, regardless of MAIN's classification
  let filteredDatasources = [];
  let filteredData = [];

  const allDatasources = self.ctx.datasources || [];
  const allAliases = [...new Set(allDatasources.map((ds) => ds.aliasName))];
  LogHelper.log(`[WATER_COMMON_AREA] DEBUG: Available aliases in widget: ${JSON.stringify(allAliases)}`);
  LogHelper.log(
    `[WATER_COMMON_AREA] DEBUG: Total datasources: ${allDatasources.length}, Total data rows: ${
      (self.ctx.data || []).length
    }`
  );

  // FIX: ALWAYS filter by aliasName = 'HidrometrosAreaComum' (ThingsBoard pre-filtered)
  // This is the ONLY reliable way to ensure only area comum devices are shown
  filteredDatasources = (self.ctx.datasources || []).filter((ds) => ds.aliasName === 'HidrometrosAreaComum');
  filteredData = (self.ctx.data || []).filter((d) => d?.datasource?.aliasName === 'HidrometrosAreaComum');

  LogHelper.log(
    `[WATER_COMMON_AREA] FIX: Using ONLY local datasources filtered by 'HidrometrosAreaComum': ${filteredDatasources.length} datasources, ${filteredData.length} data rows`
  );

  LogHelper.log(
    `[WATER_COMMON_AREA] buildAuthoritativeItems: Filtered ${filteredDatasources.length} datasources, ${filteredData.length} data rows for 'HidrometrosAreaComum'`
  );

  // items da LIB: [{ id: ingestionId, identifier, label }, ...]
  const base = MyIO.buildListItemsThingsboardByUniqueDatasource(filteredDatasources, filteredData) || [];
  const ok = Array.isArray(base) ? base.filter((x) => x && x.id) : [];

  const tbIdIdx = buildTbIdIndexes(); // { byIdentifier, byIngestion }
  const attrsByTb = buildTbAttrIndex(); // tbId -> { slaveId, centralId, deviceType }

  const mapped = ok.map((r) => {
    const ingestionId = r.id;
    const tbFromIngestion = ingestionId ? tbIdIdx.byIngestion.get(ingestionId) : null;
    const tbFromIdentifier = r.identifier ? tbIdIdx.byIdentifier.get(r.identifier) : null;

    let tbId = tbFromIngestion || tbFromIdentifier || null;
    if (tbFromIngestion && tbFromIdentifier && tbFromIngestion !== tbFromIdentifier) {
      tbId = tbFromIngestion;
    }

    const attrs = tbId ? attrsByTb.get(tbId) || {} : {};
    const deviceProfile = attrs.deviceProfile || 'HIDROMETRO';
    let deviceTypeToDisplay = attrs.deviceType || 'HIDROMETRO';

    if (deviceTypeToDisplay === '3F_MEDIDOR' && deviceProfile !== 'N/D') {
      deviceTypeToDisplay = deviceProfile;
    }

    return {
      id: tbId || ingestionId, // para seleção/toggle
      tbId, // ThingsBoard deviceId (Settings)
      ingestionId, // join key API (totals/Report)
      identifier: r.identifier,
      label: attrs.label || r.label,
      slaveId: attrs.slaveId ?? null,
      centralId: attrs.centralId ?? null,
      centralName: attrs.centralName ?? null,
      deviceType: deviceTypeToDisplay,
      deviceProfile: deviceProfile,
      updatedIdentifiers: {},
      connectionStatusTime: attrs.lastConnectTime ?? null,
      timeVal: attrs.lastActivityTime ?? null,
      lastDisconnectTime: attrs.lastDisconnectTime ?? null,
      lastConnectTime: attrs.lastConnectTime ?? null,
      deviceMapInstaneousPower: attrs.deviceMapInstaneousPower ?? null,
      customerId: attrs.customerId ?? null,
      connectionStatus: attrs.connectionStatus ?? 'offline',
      pulses: attrs.pulses ?? null, // FIX: Water meters use pulses (litros instantâneos)
    };
  });

  LogHelper.log(`[WATER_COMMON_AREA] buildAuthoritativeItems: Built ${mapped.length} water meter items`);

  // NOTA: O registro de IDs no Orchestrator agora é feito pelo MAIN
  // que centraliza os datasources HidrometrosAreaComum e Todos Hidrometros Lojas

  return mapped;
}

function enrichItemsWithTotals(items, apiMap) {
  return items.map((it) => {
    let raw = 0;
    let cachedCustomerId = null; // [NOVO] Variável para guardar o ID vindo da API

    if (it.ingestionId && isValidUUID(it.ingestionId)) {
      const row = apiMap.get(String(it.ingestionId));

      // 1. Recupera o valor
      raw = Number(row?.total_value ?? 0);

      // 2. [NOVO] Tenta recuperar o customerId do cache se disponível
      // A API pode retornar como 'customerId' ou 'customer_id'
      cachedCustomerId = row?.customerId || row?.customer_id || null;
    }

    const value = Number(raw || 0);

    // 3. [NOVO] Prioriza o ID que já existia (TB), senão usa o do Cache (API)
    const finalCustomerId = it.customerId || cachedCustomerId;

    return {
      ...it,
      value,
      perc: 0,
      customerId: finalCustomerId, // [NOVO] Atualiza o objeto com o ID encontrado
    };
  });
}

/** ===================== FILTERS / SORT / PERC ===================== **/
function applyFilters(enriched, searchTerm, selectedIds, sortMode) {
  let v = enriched.slice();

  // RFC-0093: Apply shopping filter (from MENU) - same logic as EQUIPMENTS/STORES
  if (STATE.selectedShoppingIds && STATE.selectedShoppingIds.length > 0) {
    const before = v.length;
    v = v.filter((x) => {
      // If device has no customerId, include it (safety)
      if (!x.customerId) return true;
      // Check if device's customerId is in the selected shoppings
      return STATE.selectedShoppingIds.includes(x.customerId);
    });
    LogHelper.log(
      `[WATER_COMMON_AREA] Shopping filter applied: ${before} -> ${v.length} devices (${
        before - v.length
      } filtered out)`
    );
  }

  if (selectedIds && selectedIds.size) {
    v = v.filter((x) => selectedIds.has(String(x.id)));
  }

  const q = (searchTerm || '').trim().toLowerCase();
  if (q) {
    v = v.filter(
      (x) =>
        (x.label || '').toLowerCase().includes(q) ||
        String(x.identifier || '')
          .toLowerCase()
          .includes(q)
    );
  }

  v.sort((a, b) => {
    if (sortMode === 'cons_desc') {
      if (a.value !== b.value) return b.value - a.value;
      return (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      });
    }
    if (sortMode === 'cons_asc') {
      if (a.value !== b.value) return a.value - b.value;
      return (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      });
    }
    if (sortMode === 'alpha_desc') {
      return (
        (b.label || '').localeCompare(a.label || '', 'pt-BR', {
          sensitivity: 'base',
        }) || b.value - a.value
      );
    }
    // RFC-0095: Status sorting
    if (sortMode === 'status_asc') {
      const statusA = (a.connectionStatus || 'offline').toLowerCase();
      const statusB = (b.connectionStatus || 'offline').toLowerCase();
      const cmp = statusA.localeCompare(statusB, 'pt-BR', { sensitivity: 'base' });
      return cmp !== 0 ? cmp : (a.label || '').localeCompare(b.label || '', 'pt-BR', { sensitivity: 'base' });
    }
    if (sortMode === 'status_desc') {
      const statusA = (a.connectionStatus || 'offline').toLowerCase();
      const statusB = (b.connectionStatus || 'offline').toLowerCase();
      const cmp = statusB.localeCompare(statusA, 'pt-BR', { sensitivity: 'base' });
      return cmp !== 0 ? cmp : (a.label || '').localeCompare(b.label || '', 'pt-BR', { sensitivity: 'base' });
    }
    // RFC-0095: Shopping sorting
    if (sortMode === 'shopping_asc') {
      const shopA = getCustomerNameForDevice(a) || '';
      const shopB = getCustomerNameForDevice(b) || '';
      const cmp = shopA.localeCompare(shopB, 'pt-BR', { sensitivity: 'base' });
      return cmp !== 0 ? cmp : (a.label || '').localeCompare(b.label || '', 'pt-BR', { sensitivity: 'base' });
    }
    if (sortMode === 'shopping_desc') {
      const shopA = getCustomerNameForDevice(a) || '';
      const shopB = getCustomerNameForDevice(b) || '';
      const cmp = shopB.localeCompare(shopA, 'pt-BR', { sensitivity: 'base' });
      return cmp !== 0 ? cmp : (a.label || '').localeCompare(b.label || '', 'pt-BR', { sensitivity: 'base' });
    }
    // Default: alpha_asc
    return (
      (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      }) || a.value - b.value
    );
  });

  return v;
}

function recomputePercentages(visible) {
  const groupSum = visible.reduce((acc, x) => acc + (x.value || 0), 0);
  const updated = visible.map((x) => ({
    ...x,
    perc: groupSum > 0 ? (x.value / groupSum) * 100 : 0,
  }));
  return { visible: updated, groupSum };
}

/** ===================== RENDER ===================== **/

/**
 * Update water common area statistics header (Conectividade, Total, etc)
 * RFC-0094: Aligned with WATER_STORES logic for consistent stats
 * @param {Array} items - Array of water meter items to calculate stats from
 */
function updateWaterCommonAreaStats(items) {
  // Use $root() to find elements within widget scope (not document.getElementById)
  const $widget = $root();
  const connectivityEl = $widget.find('#waterCommonAreaStatsConnectivity')[0];
  const totalEl = $widget.find('#waterCommonAreaStatsTotal')[0];
  const consumptionEl = $widget.find('#waterCommonAreaStatsConsumption')[0];
  const zeroEl = $widget.find('#waterCommonAreaStatsZero')[0];

  if (!connectivityEl || !totalEl || !consumptionEl || !zeroEl) {
    LogHelper.warn('[WATER_COMMON_AREA] Stats header elements not found in widget scope');
    return;
  }

  // RFC-0110: Calculate connectivity using MASTER RULES (same as card rendering)
  let onlineCount = 0;
  let offlineCount = 0;
  let notInstalledCount = 0;
  let totalConsumption = 0;
  let zeroConsumptionCount = 0;

  items.forEach((item) => {
    // RFC-0110: Get telemetry timestamp for status calculation
    // RFC-0110: Use ONLY pulsesTs/waterVolumeTs for water domain - NOT lastActivityTime!
    const telemetryTimestamp = item.pulsesTs || item.waterVolumeTs || null;
    const mappedStatus = mapConnectionStatus(item.connectionStatus || 'offline');

    // RFC-0110: Calculate device status using MASTER RULES (same as card rendering)
    const deviceStatus = calculateDeviceStatusMasterRules({
      connectionStatus: mappedStatus,
      telemetryTimestamp: telemetryTimestamp,
      delayMins: 1440, // 24h threshold for stale telemetry
      domain: 'water',
    });

    // RFC-0110: Count by calculated deviceStatus
    if (deviceStatus === 'not_installed') {
      notInstalledCount++;
    } else if (deviceStatus === 'offline' || deviceStatus === 'no_info') {
      offlineCount++;
    } else {
      onlineCount++;
    }

    // Consumption calculation - RFC-0140: Do NOT clear for water domain
    // API provides accumulated totals that are valid regardless of current connection status
    const consumption = Number(item.value) || Number(item.val) || 0;
    totalConsumption += consumption;

    if (consumption === 0) {
      zeroConsumptionCount++;
    }
  });

  const totalWithStatus = items.length;

  // Calculate connectivity percentage
  const connectivityPercentage =
    totalWithStatus > 0 ? ((onlineCount / totalWithStatus) * 100).toFixed(1) : '0.0';

  // Update UI - RFC-0094: Use M³ formatting for water domain
  connectivityEl.textContent = `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`;
  totalEl.textContent = items.length.toString();
  consumptionEl.textContent = MyIO.formatWaterVolumeM3(totalConsumption);
  zeroEl.textContent = zeroConsumptionCount.toString();

  LogHelper.log('[WATER_COMMON_AREA] Stats updated:', {
    connectivity: `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`,
    total: items.length,
    consumption: totalConsumption,
    zeroCount: zeroConsumptionCount,
  });
}

/**
 * RFC-0094: Render list of water meter cards
 * Follows WATER_STORES pattern with renderCardComponentHeadOffice
 */
async function renderList(visible) {
  const listElement = $list()[0];
  if (!listElement) {
    console.error('[WATER_COMMON_AREA] waterCommonAreaList element not found via $list()');
    return;
  }

  listElement.innerHTML = '';

  for (const it of visible) {
    const container = document.createElement('div');
    listElement.appendChild(container);

    const valNum = Number(it.value || 0);

    // RFC-0110: Get telemetry timestamp for water domain
    // For water, use pulsesTs, waterVolumeTs, or timeVal/lastActivityTime as fallback
    // RFC-0110: Use ONLY pulsesTs/waterVolumeTs for water domain - NOT lastActivityTime!
    const telemetryTimestamp = it.pulsesTs || it.waterVolumeTs || null;

    // RFC-0110: Calculate device status using MASTER RULES
    const mappedConnectionStatus = mapConnectionStatus(it.connectionStatus || 'offline');
    let deviceStatus = calculateDeviceStatusMasterRules({
      connectionStatus: mappedConnectionStatus,
      telemetryTimestamp: telemetryTimestamp,
      delayMins: 1440, // 24h threshold for stale telemetry
      domain: 'water',
    });

    // RFC-0140: Do NOT clear consumption value for water domain
    // API provides accumulated totals that are valid regardless of current connection status
    // This matches EQUIPMENTS behavior which also doesn't clear consumption values
    // The device status is still shown for informational purposes
    const finalValue = valNum;

    // RFC-0094: Resolve TB id
    let resolvedTbId = it.tbId;
    if (!resolvedTbId || !isValidUUID(resolvedTbId)) {
      const idx = buildTbIdIndexes();
      resolvedTbId =
        (it.ingestionId && idx.byIngestion.get(it.ingestionId)) ||
        (it.identifier && idx.byIdentifier.get(it.identifier)) ||
        null;
    }

    // RFC-0094: Safe identifier handling
    let deviceIdentifierToDisplay = 'HIDROMETRO';
    if (it.identifier) {
      if (String(it.identifier).includes('Sem Identificador')) {
        deviceIdentifierToDisplay = 'HIDROMETRO';
      } else {
        deviceIdentifierToDisplay = it.identifier;
      }
    }

    // Get customer name for this device
    const customerName = getCustomerNameForDevice(it);

    // RFC-0094: Calculate operationHours based on lastConnectTime (like EQUIPMENTS)
    let operationHoursFormatted = '-';
    const lastConnectTimestamp = it.lastConnectTime || 0;
    if (lastConnectTimestamp > 0) {
      const nowMs = Date.now();
      const durationMs = nowMs - lastConnectTimestamp;
      operationHoursFormatted = formatarDuracao(durationMs > 0 ? durationMs : 0);
    }

    // RFC-0094: Build entity object following WATER_STORES pattern
    // RFC-0140: Ensure consumption value is available in multiple properties for card rendering
    const entityObject = {
      // Identificadores
      entityId: resolvedTbId,
      id: resolvedTbId,

      // Labels e Nomes
      labelOrName: it.label,
      name: it.label,
      customerName: customerName,
      centralName: it.centralName || 'N/A',
      deviceIdentifier: deviceIdentifierToDisplay,

      // Valores e Tipos - RFC-0094: Water domain uses M³
      // RFC-0110: Use finalValue (cleared for offline devices)
      // RFC-0140: Set consumption in multiple properties for card component compatibility
      val: finalValue,
      value: finalValue,
      lastValue: finalValue,
      consumption: finalValue, // RFC-0140: Explicit consumption property for card rendering
      consumptionValue: finalValue, // RFC-0140: Alternative consumption property
      valType: 'volume_m3',
      unit: 'm³',
      icon: 'water',
      domain: 'water',
      pulses: it.pulses || 0,

      // Metadados
      deviceType: it.deviceType || 'HIDROMETRO',
      deviceProfile: it.deviceProfile || 'HIDROMETRO',
      deviceStatus: deviceStatus,
      perc: it.perc ?? 0,

      // IDs secundários
      slaveId: it.slaveId || 'N/A',
      ingestionId: it.ingestionId || 'N/A',
      centralId: it.centralId || 'N/A',
      customerId: it.customerId || null,

      updatedIdentifiers: it.updatedIdentifiers || {},
      connectionStatusTime: it.connectionStatusTime || Date.now(),
      timeVal: it.timeVal || Date.now(),

      // Additional data for Settings modal and card display
      // RFC-0110 FIX: Use lastActivityTime as fallback for lastConnectTime
      // If lastConnectTime is 0/undefined, verifyOfflineStatus() would mark device as offline
      lastDisconnectTime: it.lastDisconnectTime || 0,
      lastConnectTime: it.lastConnectTime || it.lastActivityTime || it.timeVal || Date.now(),
      lastActivityTime: it.timeVal || it.lastActivityTime || null,
      instantaneousPower: 0, // Not applicable for water meters
      operationHours: operationHoursFormatted, // RFC-0094: Calculated from lastConnectTime
      temperatureC: 0,
      mapInstantaneousPower: MAP_INSTANTANEOUS_POWER,
      deviceMapInstaneousPower: it.deviceMapInstaneousPower || null,
    };

    // RFC-0094: Use renderCardComponentHeadOffice like WATER_STORES
    // RFC-0110: Use 1440 (24h) to match RFC-0110 master rules for consistency
    MyIOLibrary.renderCardComponentHeadOffice(container, {
      entityObject: entityObject,
      delayTimeConnectionInMins: 1440, // RFC-0110: 24h threshold for consistency

      handleClickCard: (ev, entity) => {
        console.log(`[WATER_COMMON_AREA] Card clicked: ${entity.name}`);
      },

      handleActionDashboard: async () => {
        console.log('[WATER_COMMON_AREA] [RFC-0094] Opening water dashboard for:', entityObject.entityId);
        try {
          if (typeof MyIOLibrary.openDashboardPopupEnergy !== 'function') {
            window.alert('Dashboard component não disponível');
            return;
          }
          const startDate = self.ctx.scope?.startDateISO;
          const endDate = self.ctx.scope?.endDateISO;
          if (!startDate || !endDate) {
            window.alert('Período de datas não definido.');
            return;
          }
          if (!MyIOAuth || typeof MyIOAuth.getToken !== 'function') {
            LogHelper.error('[WATER_COMMON_AREA] MyIOAuth not available');
            window.alert('Autenticação não disponível. Recarregue a página.');
            return;
          }
          const tokenIngestionDashBoard = await MyIOAuth.getToken();
          const myTbTokenDashBoard = localStorage.getItem('jwt_token');

          MyIOLibrary.openDashboardPopupEnergy({
            deviceId: entityObject.entityId,
            readingType: 'water', // RFC-0094: Water reading type
            startDate,
            endDate,
            tbJwtToken: myTbTokenDashBoard,
            ingestionToken: tokenIngestionDashBoard,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            onClose: () => {
              const o = document.querySelector('.myio-modal-overlay');
              if (o) o.remove();
            },
          });
        } catch (err) {
          console.error(err);
          window.alert('Erro ao abrir dashboard');
        }
      },

      handleActionReport: async () => {
        try {
          if (!MyIOAuth || typeof MyIOAuth.getToken !== 'function') {
            LogHelper.error('[WATER_COMMON_AREA] MyIOAuth not available for report');
            window.alert('Autenticação não disponível. Recarregue a página.');
            return;
          }
          const ingestionToken = await MyIOAuth.getToken();
          await MyIOLibrary.openDashboardPopupReport({
            ingestionId: it.ingestionId,
            identifier: it.identifier,
            label: it.label,
            domain: 'water', // RFC-0094: Water domain
            api: {
              dataApiBaseUrl: getDataApiHost(),
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              ingestionToken,
            },
          });
        } catch (err) {
          window.alert('Erro ao abrir relatório');
        }
      },

      handleActionSettings: async () => {
        const jwt = localStorage.getItem('jwt_token');

        if (!jwt) {
          LogHelper.error('[WATER_COMMON_AREA] [RFC-0094] JWT token not found');
          window.alert('Token de autenticação não encontrado');
          return;
        }

        const tbId = entityObject.entityId;
        if (!tbId || tbId === it.ingestionId) {
          window.alert('ID inválido');
          return;
        }

        try {
          await MyIOLibrary.openDashboardPopupSettings({
            deviceId: tbId,
            label: it.label,
            jwtToken: jwt,
            domain: WIDGET_DOMAIN,
            deviceType: entityObject.deviceType,
            deviceProfile: entityObject.deviceProfile,
            customerName: entityObject.customerName,
            connectionData: {
              centralName: entityObject.centralName,
              connectionStatusTime: entityObject.connectionStatusTime,
              timeVal: entityObject.timeVal || new Date('1970-01-01').getTime(),
              deviceStatus:
                entityObject.deviceStatus !== 'power_off' && entityObject.deviceStatus !== 'not_installed'
                  ? 'power_on'
                  : 'power_off',
              lastDisconnectTime: entityObject.lastDisconnectTime || 0,
            },
            ui: { title: 'Configurações', width: 900 },
            mapInstantaneousPower: entityObject.mapInstantaneousPower,
            onSaved: (payload) => {
              LogHelper.log('[WATER_COMMON_AREA] [RFC-0094] Settings saved:', payload);
              showGlobalSuccessModal(6);
            },
            onClose: () => {
              $('.myio-settings-modal-overlay').remove();
              const overlay = document.querySelector('.myio-modal-overlay');
              if (overlay) {
                overlay.remove();
              }
              LogHelper.log('[WATER_COMMON_AREA] [RFC-0094] Settings modal closed');
            },
          });
        } catch (e) {
          LogHelper.error('[WATER_COMMON_AREA] [RFC-0094] Error opening settings:', e);
          window.alert('Erro ao abrir configurações');
        }
      },

      handleSelect: (checked, entity) => {
        const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
        if (MyIOSelectionStore) {
          if (checked) {
            if (MyIOSelectionStore.registerEntity) MyIOSelectionStore.registerEntity(entity);
            MyIOSelectionStore.add(entity.entityId || entity.id);
          } else {
            MyIOSelectionStore.remove(entity.entityId || entity.id);
          }
        }
      },

      useNewComponents: USE_NEW_COMPONENTS,
      enableSelection: ENABLE_SELECTION,
      enableDragDrop: ENABLE_DRAG_DROP,
      hideInfoMenuItem: HIDE_INFO_MENU_ITEM,
      debugActive: DEBUG_ACTIVE,
      activeTooltipDebug: ACTIVE_TOOLTIP_DEBUG,
    });
  }

  console.log(`[WATER_COMMON_AREA] Rendered ${visible.length} water meter cards`);
}

/** ===================== UI BINDINGS ===================== **/
/**
 * RFC-0094: Search and filter button events are now handled by buildHeaderDevicesGrid
 * This function is kept for backwards compatibility but the main logic is in the header controller
 */
function bindHeader() {
  // RFC-0094: Events are now managed by waterCommonAreaHeaderController in onInit
  LogHelper.log('[WATER_COMMON_AREA] bindHeader - events managed by header controller');
}

// ============================================
// RFC-0094: WATER_COMMON_AREA FILTER MODAL (using shared factory from MAIN)
// ============================================

// Helper function to get item consumption value
function getItemConsumption(item) {
  return Number(item.value) || Number(item.consumption) || Number(item.val) || 0;
}

// Helper function to get item status (for filter tabs)
// RFC-0110: Calculate deviceStatus using MASTER RULES for consistent filtering
function getItemStatus(item) {
  // If deviceStatus is already calculated (from updateFromDevices), use it
  if (item.deviceStatus) {
    return item.deviceStatus.toLowerCase();
  }
  // Otherwise, calculate it using RFC-0110 rules
  const telemetryTimestamp =
    item.pulsesTs || item.waterVolumeTs || item.timeVal || item.lastActivityTime || null;
  const mappedStatus = mapConnectionStatus(item.connectionStatus || 'offline');
  return calculateDeviceStatusMasterRules({
    connectionStatus: mappedStatus,
    telemetryTimestamp: telemetryTimestamp,
    delayMins: 1440, // 24h threshold for stale telemetry
    domain: 'water',
  });
}

// Filter modal instance (lazy initialized)
let waterCommonAreaFilterModal = null;

/**
 * RFC-0094: Initialize filter modal using shared factory from MAIN
 */
function initFilterModal() {
  const createFilterModal = window.MyIOUtils?.createFilterModal;

  if (!createFilterModal) {
    LogHelper.error('[WATER_COMMON_AREA] createFilterModal not available from MAIN');
    return null;
  }

  return createFilterModal({
    widgetName: 'WATER_COMMON_AREA',
    containerId: 'waterCommonAreaFilterModalGlobal',
    modalClass: 'water-common-area-modal',
    primaryColor: '#0288D1', // Blue for water
    itemIdAttr: 'data-entity',

    // Filter tabs configuration - specific for WATER_COMMON_AREA
    // RFC-0110: Include not_installed status and ensure consistent filtering
    filterTabs: [
      { id: 'all', label: 'Todos', filter: () => true },
      {
        id: 'online',
        label: 'Online',
        filter: (s) => !['offline', 'no_info', 'not_installed'].includes(getItemStatus(s)),
      },
      { id: 'offline', label: 'Offline', filter: (s) => ['offline', 'no_info'].includes(getItemStatus(s)) },
      { id: 'notInstalled', label: 'Não Instalado', filter: (s) => getItemStatus(s) === 'not_installed' },
      { id: 'withConsumption', label: 'Com Consumo', filter: (s) => getItemConsumption(s) > 0 },
      { id: 'noConsumption', label: 'Sem Consumo', filter: (s) => getItemConsumption(s) === 0 },
    ],

    // Data accessors
    getItemId: (item) => item.id,
    getItemLabel: (item) => item.label || item.identifier || item.id,
    getItemValue: getItemConsumption,
    getItemSubLabel: (item) => getCustomerNameForDevice(item),
    formatValue: (val) => MyIO.formatWaterVolumeM3(val), // RFC-0094: M³ formatting

    // Callbacks
    onApply: ({ selectedIds, sortMode }) => {
      STATE.selectedIds = selectedIds;
      STATE.sortMode = sortMode;
      reflowFromState();
      LogHelper.log('[WATER_COMMON_AREA] [RFC-0094] Filters applied via shared modal');
    },

    onReset: () => {
      STATE.selectedIds = null;
      STATE.sortMode = 'cons_desc';
      STATE.searchTerm = '';
      STATE.searchActive = false;

      // RFC-0094: Reset UI via header controller
      if (waterCommonAreaHeaderController) {
        const searchInput = waterCommonAreaHeaderController.getSearchInput();
        if (searchInput) searchInput.value = '';
        waterCommonAreaHeaderController.toggleSearch(false);
      }

      reflowFromState();
      LogHelper.log('[WATER_COMMON_AREA] [RFC-0094] Filters reset via shared modal');
    },

    onClose: () => {
      LogHelper.log('[WATER_COMMON_AREA] [RFC-0094] Filter modal closed');
    },
  });
}

/**
 * RFC-0094: Open filter modal
 */
function openFilterModal() {
  // Lazy initialize modal
  if (!waterCommonAreaFilterModal) {
    waterCommonAreaFilterModal = initFilterModal();
  }

  if (!waterCommonAreaFilterModal) {
    LogHelper.error('[WATER_COMMON_AREA] Failed to initialize filter modal');
    window.alert('Erro ao inicializar modal de filtros. Verifique se o widget MAIN foi carregado.');
    return;
  }

  // Use itemsEnriched if available (has consumption values), otherwise itemsBase
  const items =
    STATE.itemsEnriched && STATE.itemsEnriched.length > 0 ? STATE.itemsEnriched : STATE.itemsBase || [];

  // RFC-0110: Calculate deviceStatus for each item before opening modal
  // This ensures getItemStatus() will have deviceStatus available
  const itemsWithDeviceStatus = items.map((item) => {
    if (item.deviceStatus) return item; // Already calculated
    // RFC-0110: Use ONLY pulsesTs/waterVolumeTs for water domain - NOT lastActivityTime!
    const telemetryTimestamp = item.pulsesTs || item.waterVolumeTs || null;
    const mappedStatus = mapConnectionStatus(item.connectionStatus || 'offline');
    const deviceStatus = calculateDeviceStatusMasterRules({
      connectionStatus: mappedStatus,
      telemetryTimestamp: telemetryTimestamp,
      delayMins: 1440,
      domain: 'water',
    });
    return { ...item, deviceStatus };
  });

  // Open with current items and state
  waterCommonAreaFilterModal.open(itemsWithDeviceStatus, {
    selectedIds: STATE.selectedIds,
    sortMode: STATE.sortMode,
  });
}

/**
 * RFC-0094: Close filter modal (for backward compatibility)
 */
function closeFilterModal() {
  if (waterCommonAreaFilterModal) {
    waterCommonAreaFilterModal.close();
  }
}

function bindModal() {
  // RFC-0094: Modal is now handled by shared factory, but keep legacy bindings for fallback
  $root().on('click', '#closeFilter', closeFilterModal);
}

/** ===================== RECOMPUTE (local only) ===================== **/
async function filterAndRender() {
  const visible = applyFilters(STATE.itemsEnriched, STATE.searchTerm, STATE.selectedIds, STATE.sortMode);
  const { visible: withPerc } = recomputePercentages(visible);
  await renderList(withPerc);

  // RFC-0094: Update stats header via centralized controller
  // RFC-0110: Calculate deviceStatus for each item before passing to updateFromDevices
  if (STATE.itemsEnriched && STATE.itemsEnriched.length > 0) {
    // RFC-0110: Map items with calculated deviceStatus for accurate stats
    const itemsWithDeviceStatus = STATE.itemsEnriched.map((item) => {
      // RFC-0110: Use ONLY pulsesTs/waterVolumeTs for water domain - NOT lastActivityTime!
      const telemetryTimestamp = item.pulsesTs || item.waterVolumeTs || null;
      const mappedStatus = mapConnectionStatus(item.connectionStatus || 'offline');
      const deviceStatus = calculateDeviceStatusMasterRules({
        connectionStatus: mappedStatus,
        telemetryTimestamp: telemetryTimestamp,
        delayMins: 1440, // 24h threshold for stale telemetry
        domain: 'water',
      });
      return { ...item, deviceStatus };
    });

    if (waterCommonAreaHeaderController) {
      waterCommonAreaHeaderController.updateFromDevices(itemsWithDeviceStatus, {});
    } else {
      updateWaterCommonAreaStats(STATE.itemsEnriched);
    }
  }
}

function reflowFromState() {
  filterAndRender();
}

/** ===================== AUTH ===================== **/
function isAuthReady() {
  return !!CLIENT_ID && !!CLIENT_SECRET && !!MyIOAuth;
}

async function ensureAuthReady(timeout = 5000, interval = 100) {
  const start = Date.now();
  while (!isAuthReady()) {
    if (Date.now() - start > timeout) {
      LogHelper.warn('[WATER_COMMON_AREA] Auth timeout waiting for credentials');
      return false;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return true;
}

/** ===================== HYDRATE (end-to-end) ===================== **/
async function fetchApiTotals(startISO, endISO) {
  if (!isAuthReady()) throw new Error('Auth not ready');
  const token = await MyIOAuth.getToken();
  if (!token) throw new Error('No ingestion token');

  // RFC-0094: Use water endpoint
  const url = new URL(
    `${getDataApiHost()}/api/v1/telemetry/customers/${CUSTOMER_ING_ID}/water/devices/totals`
  );
  url.searchParams.set('startTime', toSpOffsetNoMs(startISO));
  url.searchParams.set('endTime', toSpOffsetNoMs(endISO, true));
  url.searchParams.set('deep', '1');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    LogHelper.warn('[WATER_COMMON_AREA] API fetch failed:', res.status);
    return new Map();
  }

  const json = await res.json();
  const rows = Array.isArray(json) ? json : json?.data ?? [];
  const map = new Map();
  for (const r of rows) if (r && r.id) map.set(String(r.id), r);
  return map;
}

async function hydrateAndRender() {
  if (hydrating) return;
  hydrating = true;

  showBusy();

  try {
    // 0) Datas: obrigatórias
    let range;
    try {
      range = mustGetDateRange();
    } catch (_e) {
      LogHelper.warn('[WATER_COMMON_AREA] Aguardando intervalo de datas (startDateISO/endDateISO).');
      return;
    }

    // 1) Auth
    const okAuth = await ensureAuthReady(6000, 150);
    if (!okAuth) {
      LogHelper.warn('[WATER_COMMON_AREA] Auth not ready; adiando hidratação.');
      return;
    }

    // 2) Lista autoritativa
    // RFC-0109: Don't overwrite valid cached data with empty data from buildAuthoritativeItems
    const newItemsBase = buildAuthoritativeItems();
    if (newItemsBase.length > 0) {
      STATE.itemsBase = newItemsBase;
      LogHelper.log(
        `[WATER_COMMON_AREA] hydrateAndRender: using ${newItemsBase.length} items from buildAuthoritativeItems`
      );
    } else if (STATE.itemsBase.length > 0) {
      LogHelper.log(
        `[WATER_COMMON_AREA] hydrateAndRender: buildAuthoritativeItems returned 0 items, keeping ${STATE.itemsBase.length} cached items`
      );
    } else {
      STATE.itemsBase = newItemsBase; // Both are empty, just set it
      LogHelper.warn(
        `[WATER_COMMON_AREA] hydrateAndRender: no items available (buildAuthoritativeItems=0, cache=0)`
      );
    }

    // 3) Totais na API
    let apiMap = new Map();
    try {
      apiMap = await fetchApiTotals(range.startISO, range.endISO);
    } catch (err) {
      LogHelper.error('[WATER_COMMON_AREA] API error:', err);
      apiMap = new Map();
    }

    // 4) Enrich + render
    STATE.itemsEnriched = enrichItemsWithTotals(STATE.itemsBase, apiMap);

    // 5) Sanitiza seleção
    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map((x) => String(x.id)));
      const next = new Set([...STATE.selectedIds].filter((id) => valid.has(String(id))));
      STATE.selectedIds = next.size ? next : null;
    }

    reflowFromState();
  } finally {
    hydrating = false;
    hideBusy();
  }
}

/** ===================== TB LIFE CYCLE ===================== **/
self.onInit = async function () {
  $(self.ctx.$container).css({
    height: '100%',
    overflow: 'auto', // FIX: Same as STORES - allows vertical scroll
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  });

  MyIO = (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) ||
    (typeof window !== 'undefined' && window.MyIOLibrary) || {
      showAlert: function () {
        window.alert('A Biblioteca Myio não foi carregada corretamente!');
      },
    };

  // RFC-0094: Set widget configuration from settings FIRST - WATER DOMAIN
  WIDGET_DOMAIN = self.ctx.settings?.DOMAIN || 'water';
  USE_NEW_COMPONENTS = self.ctx.settings?.useNewComponents ?? true;
  ENABLE_SELECTION = self.ctx.settings?.enableSelection ?? true;
  ENABLE_DRAG_DROP = self.ctx.settings?.enableDragDrop ?? true;
  HIDE_INFO_MENU_ITEM = self.ctx.settings?.hideInfoMenuItem ?? true;
  DEBUG_ACTIVE = self.ctx.settings?.debugActive ?? false;
  ACTIVE_TOOLTIP_DEBUG = self.ctx.settings?.activeTooltipDebug ?? false;
  LogHelper.log(
    `[WATER_COMMON_AREA] Configured EARLY: domain=${WIDGET_DOMAIN}, debugActive=${DEBUG_ACTIVE}, activeTooltipDebug=${ACTIVE_TOOLTIP_DEBUG}`
  );

  // RFC-0094: Build centralized header via buildHeaderDevicesGrid
  const buildHeaderDevicesGrid = window.MyIOUtils?.buildHeaderDevicesGrid;
  if (buildHeaderDevicesGrid) {
    // FIX: Use $root().find() to get container within widget scope, not document.querySelector
    const headerContainerEl = $root().find('#waterCommonAreaHeaderContainer')[0];
    if (headerContainerEl) {
      waterCommonAreaHeaderController = buildHeaderDevicesGrid({
        container: headerContainerEl, // Pass element directly, not selector string
        domain: 'water',
        idPrefix: 'waterCommonArea',
        labels: {
          total: 'Total de Hidrômetros',
          consumption: 'Consumo Total (m³)',
        },
        includeSearch: true,
        includeFilter: true,
        onSearchClick: () => {
          STATE.searchActive = !STATE.searchActive;
          if (STATE.searchActive) {
            const input = waterCommonAreaHeaderController?.getSearchInput();
            if (input) setTimeout(() => input.focus(), 100);
          }
        },
        onFilterClick: () => {
          openFilterModal();
        },
      });

      // Setup search input listener
      const searchInput = waterCommonAreaHeaderController?.getSearchInput();
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          STATE.searchTerm = e.target.value || '';
          filterAndRender();
        });
      }

      LogHelper.log('[WATER_COMMON_AREA] [RFC-0094] Header controller initialized');
    } else {
      LogHelper.warn('[WATER_COMMON_AREA] Header container element not found in widget scope');
    }
  } else {
    LogHelper.warn('[WATER_COMMON_AREA] buildHeaderDevicesGrid not available - using fallback');
  }

  dateUpdateHandler = function (ev) {
    LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] ✅ DATE UPDATE EVENT RECEIVED!`, ev.detail);

    try {
      let startISO, endISO;
      if (ev.detail?.period) {
        startISO = ev.detail.period.startISO;
        endISO = ev.detail.period.endISO;
      } else {
        const { startDate, endDate } = ev.detail || {};
        startISO = new Date(startDate).toISOString();
        endISO = new Date(endDate).toISOString();
      }

      LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] Date range updated:`, startISO, endISO);

      self.ctx.scope = self.ctx.scope || {};
      self.ctx.scope.startDateISO = startISO;
      self.ctx.scope.endDateISO = endISO;

      // RFC-0109: Don't call hydrateAndRender() - MAIN will emit new data via events
      // Clear current data and show busy while waiting for MAIN to provide new data
      STATE.dataFromMain = false;
      showBusy('Carregando dados de água...');
      LogHelper.log(
        `[WATER_COMMON_AREA ${WIDGET_DOMAIN}] Waiting for MAIN to provide new water data for updated period`
      );
    } catch (err) {
      LogHelper.error(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] dateUpdateHandler error:`, err);
      hideBusy();
    }
  };

  LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] 📡 Registering myio:update-date listener...`);
  window.addEventListener('myio:update-date', dateUpdateHandler);
  LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] ✅ myio:update-date listener registered!`);

  // RFC-0042: Listen for clear event from HEADER (when user clicks "Limpar" button)
  window.addEventListener('myio:telemetry:clear', (ev) => {
    const { domain } = ev.detail;

    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] Ignoring clear event for domain: ${domain}`);
      return;
    }

    LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] 🧹 Received clear event - clearing visual content`);

    try {
      STATE.itemsBase = [];
      STATE.itemsEnriched = [];
      STATE.selectedIds = null;

      const $widget = $root();
      const $waterCommonAreaList = $widget.find('#waterCommonAreaList');
      if ($waterCommonAreaList.length > 0) {
        $waterCommonAreaList.empty();
        LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] ✅ waterCommonAreaList cleared`);
      }

      LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] 🧹 Clear completed successfully`);
    } catch (err) {
      LogHelper.error(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] ❌ Error during clear:`, err);
    }
  });

  // RFC-0093: Function to render shopping filter chips in toolbar (same as EQUIPMENTS/STORES)
  function renderShoppingFilterChips(selection) {
    const chipsContainer = document.getElementById('waterCommonAreaShoppingFilterChips');
    if (!chipsContainer) return;

    chipsContainer.innerHTML = '';

    if (!selection || selection.length === 0) {
      return; // No filter applied, hide chips
    }

    selection.forEach((shopping) => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip';
      chip.innerHTML = `<span class="filter-chip-icon">💧</span><span>${shopping.name}</span>`;
      chipsContainer.appendChild(chip);
    });

    LogHelper.log('[WATER_COMMON_AREA] 📍 Rendered', selection.length, 'shopping filter chips');
  }

  // RFC-0093: Listen for shopping filter changes
  window.addEventListener('myio:filter-applied', (ev) => {
    const selection = ev.detail?.selection || [];
    LogHelper.log('[WATER_COMMON_AREA] 🔥 heard myio:filter-applied:', selection.length, 'shoppings');

    // Extract shopping IDs (ingestionIds) from selection
    const shoppingIds = selection.map((s) => s.value).filter((v) => v);

    LogHelper.log(
      '[WATER_COMMON_AREA] Applying shopping filter:',
      shoppingIds.length === 0 ? 'ALL' : `${shoppingIds.length} shoppings`
    );

    // Update STATE and reflow cards
    STATE.selectedShoppingIds = shoppingIds;

    // Render shopping filter chips
    renderShoppingFilterChips(selection);

    // Reflow to apply filter
    reflowFromState();
  });

  // RFC-0093: Check for pre-existing filter when WATER_COMMON_AREA initializes
  if (
    window.custumersSelected &&
    Array.isArray(window.custumersSelected) &&
    window.custumersSelected.length > 0
  ) {
    LogHelper.log(
      '[WATER_COMMON_AREA] 🔄 Applying pre-existing filter:',
      window.custumersSelected.length,
      'shoppings'
    );
    const shoppingIds = window.custumersSelected.map((s) => s.value).filter((v) => v);
    STATE.selectedShoppingIds = shoppingIds;
    renderShoppingFilterChips(window.custumersSelected);
  }

  // Test if listener is working
  setTimeout(() => {
    LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] 🧪 Testing listener registration...`);
    if (typeof dateUpdateHandler === 'function') {
      LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] ✅ dateUpdateHandler is defined and ready`);
    } else {
      LogHelper.error(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] ❌ dateUpdateHandler is NOT defined!`);
    }
  }, 100);

  dataProvideHandler = function (ev) {
    LogHelper.log(
      `[WATER_COMMON_AREA ${WIDGET_DOMAIN}] 📦 Received provide-data event for domain ${
        ev.detail.domain
      }, periodKey: ${ev.detail.periodKey}, items: ${ev.detail.items?.length || 0}`
    );
    const { domain, periodKey, items } = ev.detail;

    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(
        `[WATER_COMMON_AREA ${WIDGET_DOMAIN}] ⏭️ Ignoring event for domain ${domain}, my domain is ${WIDGET_DOMAIN}`
      );
      return;
    }

    if (lastProcessedPeriodKey === periodKey) {
      LogHelper.log(`[WATER_COMMON_AREA] ⏭️ Skipping duplicate provide-data for periodKey: ${periodKey}`);
      return;
    }

    const myPeriod = {
      startISO: self.ctx.scope?.startDateISO,
      endISO: self.ctx.scope?.endDateISO,
    };

    if (!myPeriod.startISO || !myPeriod.endISO) {
      LogHelper.warn(
        `[WATER_COMMON_AREA] ⏸️ Period not set yet, storing provide-data event for later processing`
      );
      return;
    }

    lastProcessedPeriodKey = periodKey;

    LogHelper.log(`[WATER_COMMON_AREA] 🔄 Processing data from orchestrator...`);
    LogHelper.log(
      `[WATER_COMMON_AREA] Received ${items.length} items from orchestrator for domain ${domain}`
    );

    const myDatasourceIds = extractDatasourceIds(self.ctx.datasources);
    const datasourceIdSet = new Set(myDatasourceIds);
    let filtered = items.filter((item) => {
      return datasourceIdSet.has(item.id) || datasourceIdSet.has(item.tbId);
    });

    LogHelper.log(
      `[WATER_COMMON_AREA] Filtered ${items.length} items down to ${filtered.length} items matching datasources`
    );

    if (filtered.length === 0) {
      LogHelper.warn(`[WATER_COMMON_AREA] No items match datasource IDs! Using all items as fallback.`);
      filtered = items;
    }

    filtered = filtered.map((item) => ({
      id: item.tbId || item.id,
      tbId: item.tbId || item.id,
      ingestionId: item.ingestionId || item.id,
      identifier: item.identifier || item.id,
      label: item.label || item.identifier || item.id,
      value: Number(item.value || 0),
      perc: 0,
      deviceType: item.deviceType || 'HIDROMETRO',
      slaveId: item.slaveId || null,
      centralId: item.centralId || null,
      updatedIdentifiers: {},
    }));

    LogHelper.log(`[WATER_COMMON_AREA] Using ${filtered.length} items after processing`);

    if (!STATE.itemsBase || STATE.itemsBase.length === 0) {
      LogHelper.log(`[WATER_COMMON_AREA] Building itemsBase from TB data...`);
      STATE.itemsBase = buildAuthoritativeItems();
      LogHelper.log(`[WATER_COMMON_AREA] Built ${STATE.itemsBase.length} items from TB`);
    }

    const orchestratorValues = new Map();
    filtered.forEach((item) => {
      if (item.ingestionId) {
        const value = Number(item.value || 0);
        orchestratorValues.set(item.ingestionId, value);
      }
    });
    LogHelper.log(`[WATER_COMMON_AREA] Orchestrator values map size: ${orchestratorValues.size}`);

    STATE.itemsEnriched = STATE.itemsBase.map((tbItem) => {
      const orchestratorValue = orchestratorValues.get(tbItem.ingestionId);

      return {
        ...tbItem,
        value: orchestratorValue !== undefined ? orchestratorValue : tbItem.value || 0,
        perc: 0,
      };
    });

    LogHelper.log(
      `[WATER_COMMON_AREA] Enriched ${STATE.itemsEnriched.length} items with orchestrator values`
    );

    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map((x) => String(x.id)));
      const next = new Set([...STATE.selectedIds].filter((id) => valid.has(String(id))));
      STATE.selectedIds = next.size ? next : null;
    }

    reflowFromState();

    LogHelper.log(`[WATER_COMMON_AREA] 🏁 Data processed successfully - ensuring busy is hidden`);

    setTimeout(() => {
      hideBusy();
      if (window.MyIOOrchestrator && window.MyIOOrchestrator.getBusyState) {
        const busyState = window.MyIOOrchestrator.getBusyState();
        if (busyState.isVisible) {
          LogHelper.warn(
            `[WATER_COMMON_AREA] ⚠️ Orchestrator busy still visible after data processing - force hiding`
          );
          window.MyIOOrchestrator.hideGlobalBusy();
        }
      }
    }, 100);
  };

  /**
   * Extracts ingestionIds from ThingsBoard ctx.data
   * RFC-0094: Only extracts from 'HidrometrosAreaComum' alias
   */
  function extractDatasourceIds(datasources) {
    const ingestionIds = new Set();
    const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];

    for (const row of rows) {
      // RFC-0094: Filter by aliasName = 'HidrometrosAreaComum'
      const aliasName = row?.datasource?.aliasName || '';
      if (aliasName !== 'HidrometrosAreaComum') continue;

      const key = String(row?.dataKey?.name || '').toLowerCase();
      const val = row?.data?.[0]?.[1];

      if (key === 'ingestionid' && val && isValidUUID(String(val))) {
        ingestionIds.add(String(val));
      }
    }

    return Array.from(ingestionIds);
  }

  window.addEventListener('myio:telemetry:provide-data', dataProvideHandler);

  // FIX: Add handler for myio:water-data-ready from MAIN waterCache
  waterDataReadyHandler = function (ev) {
    const { cache, fromCache } = ev.detail || {};

    // Only process if cache is a Map with data
    if (!(cache instanceof Map) || cache.size === 0) {
      LogHelper.log('[WATER_COMMON_AREA] Ignoring water-data-ready: no cache or empty');
      return;
    }

    LogHelper.log(
      `[WATER_COMMON_AREA] 📦 Received water-data-ready: ${cache.size} devices (fromCache: ${fromCache})`
    );

    // Check if widget has items to enrich
    if (!STATE.itemsBase || STATE.itemsBase.length === 0) {
      LogHelper.log('[WATER_COMMON_AREA] No itemsBase yet, building...');
      STATE.itemsBase = buildAuthoritativeItems();
    }

    if (STATE.itemsBase.length === 0) {
      LogHelper.warn('[WATER_COMMON_AREA] Still no items after buildAuthoritativeItems, skipping');
      return;
    }

    // Enrich items with data from MAIN waterCache
    STATE.itemsEnriched = enrichItemsWithTotals(STATE.itemsBase, cache);
    LogHelper.log(`[WATER_COMMON_AREA] Enriched ${STATE.itemsEnriched.length} items from MAIN waterCache`);

    // Render
    reflowFromState();
  };

  window.addEventListener('myio:water-data-ready', waterDataReadyHandler);

  // FIX: Listen for myio:water-summary-ready event from MAIN (this event is actually emitted!)
  // When this event fires, the classified data is already in the cache
  let waterSummaryHandler = null;
  waterSummaryHandler = () => {
    const cachedWater = window.MyIOOrchestratorData?.classified?.water;
    if (cachedWater?.hidrometro_area_comum?.length > 0 && STATE.itemsBase.length === 0) {
      LogHelper.log(`[WATER_COMMON_AREA] 📡 water-summary-ready received, loading from cache...`);
      waterTbDataHandler({ detail: { classified: { water: cachedWater } } });
    }
  };
  window.addEventListener('myio:water-summary-ready', waterSummaryHandler);

  // RFC-0109: Listener para dados classificados do MAIN (items já classificados por deviceType/deviceProfile)
  // FIX: MAIN stores data in window.MyIOOrchestratorData.classified.water.hidrometro_area_comum
  waterTbDataHandler = (ev) => {
    LogHelper.log(
      `[WATER_COMMON_AREA] 📨 waterTbDataHandler called with event:`,
      ev?.detail ? 'has detail' : 'no detail'
    );

    // FIX: Support both formats - old (commonArea) and new (classified.water)
    let commonAreaItems = [];
    let classification = ev.detail?.classification || {};

    // Try new format first (from classified.water)
    if (ev.detail?.classified?.water?.hidrometro_area_comum) {
      commonAreaItems = ev.detail.classified.water.hidrometro_area_comum;
      LogHelper.log(`[WATER_COMMON_AREA] Using new format: classified.water.hidrometro_area_comum`);
    }
    // Fallback to old format (commonArea)
    else if (ev.detail?.commonArea?.items) {
      commonAreaItems = ev.detail.commonArea.items;
      LogHelper.log(`[WATER_COMMON_AREA] Using old format: commonArea.items`);
    }
    // Try getting from global cache
    else if (window.MyIOOrchestratorData?.classified?.water?.hidrometro_area_comum) {
      commonAreaItems = window.MyIOOrchestratorData.classified.water.hidrometro_area_comum;
      LogHelper.log(
        `[WATER_COMMON_AREA] Using global cache: MyIOOrchestratorData.classified.water.hidrometro_area_comum`
      );
    }

    LogHelper.log(`[WATER_COMMON_AREA] 📦 Found ${commonAreaItems.length} items from MAIN`);

    // FIX: Do NOT override local datasource data with MAIN's data
    // MAIN's classification is unreliable - always prefer ThingsBoard's pre-filtered alias
    if (STATE.itemsBase.length > 0) {
      LogHelper.log(
        `[WATER_COMMON_AREA] FIX: Ignoring MAIN data - already have ${STATE.itemsBase.length} items from local 'HidrometrosAreaComum' datasource`
      );
      return;
    }

    // RFC-0109: Only use MAIN data if we have NO local data
    if (commonAreaItems && commonAreaItems.length > 0) {
      const commonArea = {
        items: commonAreaItems,
        total: commonAreaItems.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0),
      };
      LogHelper.log(
        `[WATER_COMMON_AREA] Received classified data from MAIN: ${commonArea.items.length} items, total: ${
          commonArea.total?.toFixed(2) || 0
        } m³`
      );
      LogHelper.log(`[WATER_COMMON_AREA] Classification breakdown: ${JSON.stringify(classification || {})}`);

      // RFC-0109/RFC-0131: Use items directly from MAIN (already classified as areacomum)
      // RFC-0140: Ensure consumption value is properly copied from MAIN's enriched data
      // Copy ALL telemetry fields for proper status calculation and card rendering
      STATE.itemsBase = commonArea.items.map((item) => {
        // RFC-0140: Prioritize API-enriched value over TB pulses
        const consumptionValue = item.value || item.consumption || item.pulses || 0;
        LogHelper.log(
          `[WATER_COMMON_AREA] Building item: ${item.label}, value=${item.value}, consumption=${item.consumption}, pulses=${item.pulses}, final=${consumptionValue}`
        );

        return {
          id: item.tbId || item.ingestionId,
          tbId: item.tbId,
          ingestionId: item.ingestionId,
          identifier: item.identifier,
          label: item.label,
          slaveId: item.slaveId || null,
          centralId: item.centralId || null,
          centralName: item.centralName || null,
          deviceType: item.deviceType || 'HIDROMETRO_AREA_COMUM',
          deviceProfile: item.deviceProfile || 'HIDROMETRO_AREA_COMUM',
          updatedIdentifiers: {},
          connectionStatusTime: item.lastConnectTime || null,
          timeVal: item.lastActivityTime || null,
          lastDisconnectTime: item.lastDisconnectTime || null,
          lastConnectTime: item.lastConnectTime || item.lastActivityTime || null,
          lastActivityTime: item.lastActivityTime || null,
          deviceMapInstaneousPower: item.deviceMapInstaneousPower || null,
          customerId: item.customerId || null,
          connectionStatus: item.connectionStatus || 'offline',
          // RFC-0131: Copy telemetry fields for status calculation
          pulses: item.pulses || item.consumption || 0,
          pulsesTs: item.pulsesTs || item.lastActivityTime || null,
          waterVolumeTs: item.waterVolumeTs || item.lastActivityTime || null,
          // RFC-0140: Ensure consumption is properly set from MAIN's enriched data
          consumption: consumptionValue,
          ownerName: item.ownerName || null,
          // RFC-0140: Use the resolved consumption value
          value: consumptionValue,
        };
      });

      LogHelper.log(`[WATER_COMMON_AREA] Built ${STATE.itemsBase.length} items from MAIN classified data`);
      STATE.dataFromMain = true; // RFC-0109: Mark that data came from MAIN

      // RFC-0131: MAIN now enriches water data with API values before emitting
      // Check if data is already API-enriched (has apiEnriched flag)
      const isApiEnriched = ev.detail?.apiEnriched || false;
      LogHelper.log(`[WATER_COMMON_AREA] RFC-0131: Data from MAIN (apiEnriched: ${isApiEnriched})`);

      // Use values directly from MAIN (already enriched or will be re-emitted when enriched)
      STATE.itemsEnriched = STATE.itemsBase.map((item) => {
        const sourceItem = commonArea.items.find(
          (i) => i.tbId === item.tbId || i.ingestionId === item.ingestionId
        );
        return {
          ...item,
          value: sourceItem?.value || sourceItem?.consumption || item.value || 0,
          pulses: sourceItem?.pulses || sourceItem?.consumption || item.pulses || 0,
          perc: 0,
        };
      });

      reflowFromState();
      hideBusy();
    }
  };
  window.addEventListener('myio:water-tb-data-ready', waterTbDataHandler);

  // RFC-0109: Check for cached classified data (event may have fired before widget loaded)
  // FIX: MAIN stores data in window.MyIOOrchestratorData.classified.water (not waterClassified)
  LogHelper.log(`[WATER_COMMON_AREA] 🔍 Checking for cached classified data...`);
  const cachedClassified = window.MyIOOrchestratorData?.classified?.water;
  const cachedTimestamp =
    window.MyIOOrchestratorData?.apiEnrichedAt || window.MyIOOrchestratorData?.classified?.timestamp;

  if (!window.MyIOOrchestratorData) {
    LogHelper.warn(`[WATER_COMMON_AREA] ⚠️ window.MyIOOrchestratorData is not available`);
  } else if (!cachedClassified) {
    LogHelper.warn(
      `[WATER_COMMON_AREA] ⚠️ classified.water not found in MyIOOrchestratorData. Available keys: ${Object.keys(
        window.MyIOOrchestratorData
      ).join(', ')}`
    );
  } else {
    LogHelper.log(
      `[WATER_COMMON_AREA] 📦 Found classified.water: hidrometro_area_comum=${
        cachedClassified.hidrometro_area_comum?.length || 0
      }, hidrometro=${cachedClassified.hidrometro?.length || 0}`
    );
  }

  if (cachedClassified?.hidrometro_area_comum?.length > 0) {
    const cacheAge = Date.now() - (cachedTimestamp || 0);
    LogHelper.log(`[WATER_COMMON_AREA] 🕐 Cache age: ${cacheAge}ms (threshold: 60000ms)`);
    if (cacheAge < 60000) {
      // Use cache if less than 60 seconds old
      LogHelper.log(
        `[WATER_COMMON_AREA] ✅ Found cached classified data (${cachedClassified.hidrometro_area_comum.length} items, age: ${cacheAge}ms) - using it!`
      );
      // Simulate event with cached data in new format
      waterTbDataHandler({ detail: { classified: { water: cachedClassified } } });
    } else {
      LogHelper.warn(
        `[WATER_COMMON_AREA] ⏰ Cache too old (${cacheAge}ms > 60000ms), waiting for fresh data`
      );
    }
  } else if (cachedClassified) {
    LogHelper.warn(`[WATER_COMMON_AREA] ⚠️ Cache exists but hidrometro_area_comum is empty or missing`);
  }

  // RFC-0109: Fallback - retry cache check after 2s in case of timing issues
  if (!cachedClassified || !cachedClassified?.hidrometro_area_comum?.length) {
    setTimeout(() => {
      const retryCache = window.MyIOOrchestratorData?.classified?.water;
      const retryTimestamp = window.MyIOOrchestratorData?.apiEnrichedAt || Date.now();
      if (retryCache?.hidrometro_area_comum?.length > 0 && STATE.itemsBase.length === 0) {
        const cacheAge = Date.now() - retryTimestamp;
        if (cacheAge < 120000) {
          // Extended threshold for retry
          LogHelper.log(
            `[WATER_COMMON_AREA] 🔄 Retry found cached data (${retryCache.hidrometro_area_comum.length} items, age: ${cacheAge}ms)`
          );
          waterTbDataHandler({ detail: { classified: { water: retryCache } } });
        }
      }
    }, 2000);
  }

  // RFC-0094: Use credentials from MAIN via MyIOUtils (already fetched by MAIN)
  const jwt = localStorage.getItem('jwt_token');

  const mainCredentials = window.MyIOUtils?.getCredentials?.();
  if (mainCredentials?.clientId && mainCredentials?.clientSecret) {
    CLIENT_ID = mainCredentials.clientId;
    CLIENT_SECRET = mainCredentials.clientSecret;
    CUSTOMER_ING_ID = mainCredentials.customerIngestionId || '';
    LogHelper.log('[WATER_COMMON_AREA] Using credentials from MAIN (MyIOUtils)');
  } else {
    LogHelper.log('[WATER_COMMON_AREA] MAIN credentials not available, fetching directly...');
    const customerTB_ID = window.MyIOUtils?.getCustomerId?.() || self.ctx.settings?.customerTB_ID || '';

    try {
      const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
      CLIENT_ID = attrs?.client_id || '';
      CLIENT_SECRET = attrs?.client_secret || '';
      CUSTOMER_ING_ID = attrs?.ingestionId || '';
    } catch (err) {
      LogHelper.error('[WATER_COMMON_AREA] Failed to fetch credentials:', err);
    }
  }

  // Initialize auth if we have credentials
  if (CLIENT_ID && CLIENT_SECRET) {
    try {
      MyIOAuth = MyIO.buildMyioIngestionAuth({
        dataApiHost: getDataApiHost(),
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
      });

      LogHelper.log('[WATER_COMMON_AREA] Auth init OK');
      try {
        await MyIOAuth.getToken();
      } catch (_e) {
        /* ignore token errors */
      }
    } catch (err) {
      LogHelper.error('[WATER_COMMON_AREA] Auth init FAIL', err);
    }
  } else {
    LogHelper.warn('[WATER_COMMON_AREA] No credentials available for auth initialization');
  }

  // Bind UI
  bindHeader();
  bindModal();

  // ---------- Datas iniciais: "Current Month So Far" ----------
  if (!self.ctx?.scope?.startDateISO || !self.ctx?.scope?.endDateISO) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 0);
    self.ctx.scope = self.ctx.scope || {};
    self.ctx.scope.startDateISO = start.toISOString();
    self.ctx.scope.endDateISO = end.toISOString();
  }

  // RFC-0109: WATER_COMMON_AREA relies on MAIN for data, not local datasources
  // We wait for myio:water-tb-data-ready event or use cached waterClassified data
  LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] onInit - Waiting for water data from MAIN...`);

  if (self.ctx?.scope?.startDateISO && self.ctx?.scope?.endDateISO) {
    LogHelper.log(`[WATER_COMMON_AREA ${WIDGET_DOMAIN}] Initial period defined, showing busy...`);
    showBusy();
  } else {
    LogHelper.log(
      `[WATER_COMMON_AREA ${WIDGET_DOMAIN}] No initial period, waiting for myio:update-date event...`
    );
  }

  // RFC-0109: WATER_COMMON_AREA relies ONLY on data from MAIN (like EQUIPMENTS pattern)
  // We don't use buildAuthoritativeItems() or hydrateAndRender() since widget has no datasources
  if (STATE.dataFromMain || STATE.itemsBase.length > 0) {
    // Data already loaded from MAIN cache or event
    LogHelper.log(
      `[WATER_COMMON_AREA] ✅ Data from MAIN ready: ${STATE.itemsBase.length} items (dataFromMain: ${STATE.dataFromMain})`
    );
    hideBusy();
  } else {
    // Wait for data from MAIN via event (similar to EQUIPMENTS pattern)
    LogHelper.log(`[WATER_COMMON_AREA] ⏳ Waiting for water data from MAIN...`);

    const waterDataTimeout = setTimeout(() => {
      if (STATE.itemsBase.length === 0) {
        LogHelper.warn(`[WATER_COMMON_AREA] ⚠️ Timeout waiting for water data from MAIN`);
        hideBusy();

        // Show toast to reload page
        const MyIOToast = MyIOLibrary?.MyIOToast || window.MyIOToast;
        if (MyIOToast) {
          MyIOToast.warning('Dados de água não carregados. Por favor, recarregue a página.', {
            duration: 8000,
          });
        }
      }
    }, 15000);

    // The waterTbDataHandler listener is already registered and will handle the event
    // When it receives data, it will set STATE.itemsBase, STATE.dataFromMain=true, and call reflowFromState()

    // Also set up a watcher for cached data in case event was missed
    const cacheWatcher = setInterval(() => {
      const retryCache = window.MyIOOrchestratorData?.waterClassified;
      if (retryCache?.commonArea?.items?.length > 0 && STATE.itemsBase.length === 0) {
        clearInterval(cacheWatcher);
        clearTimeout(waterDataTimeout);
        LogHelper.log(
          `[WATER_COMMON_AREA] 🔄 CacheWatcher found data: ${retryCache.commonArea.items.length} items`
        );
        waterTbDataHandler({ detail: retryCache });
      } else if (STATE.itemsBase.length > 0) {
        clearInterval(cacheWatcher);
        clearTimeout(waterDataTimeout);
        LogHelper.log(`[WATER_COMMON_AREA] ✅ CacheWatcher: Data already loaded, stopping`);
        hideBusy();
      }
    }, 500);
  }
};

self.onDataUpdated = function () {
  /* no-op */
};

self.onResize = function () {};

self.onDestroy = function () {
  if (dateUpdateHandler) {
    window.removeEventListener('myio:update-date', dateUpdateHandler);
    LogHelper.log("[WATER_COMMON_AREA] Event listener 'myio:update-date' removido.");
  }
  if (dataProvideHandler) {
    window.removeEventListener('myio:telemetry:provide-data', dataProvideHandler);
    LogHelper.log("[WATER_COMMON_AREA] Event listener 'myio:telemetry:provide-data' removido.");
  }
  if (waterDataReadyHandler) {
    window.removeEventListener('myio:water-data-ready', waterDataReadyHandler);
    LogHelper.log("[WATER_COMMON_AREA] Event listener 'myio:water-data-ready' removido.");
  }
  if (waterTbDataHandler) {
    window.removeEventListener('myio:water-tb-data-ready', waterTbDataHandler);
    LogHelper.log("[WATER_COMMON_AREA] Event listener 'myio:water-tb-data-ready' removido.");
  }

  // FIX: Remove water-summary-ready listener (added for cache sync)
  window.removeEventListener('myio:water-summary-ready', () => {});
  LogHelper.log("[WATER_COMMON_AREA] Event listener 'myio:water-summary-ready' removido.");

  // RFC-0094: Cleanup header controller
  if (waterCommonAreaHeaderController) {
    waterCommonAreaHeaderController.destroy();
    waterCommonAreaHeaderController = null;
    LogHelper.log('[WATER_COMMON_AREA] [RFC-0094] Header controller destroyed');
  }

  // RFC-0094: Cleanup filter modal using shared factory
  if (waterCommonAreaFilterModal) {
    waterCommonAreaFilterModal.destroy();
    waterCommonAreaFilterModal = null;
    LogHelper.log('[WATER_COMMON_AREA] [RFC-0094] Filter modal destroyed');
  }

  try {
    $root().off();
  } catch (_e) {
    /* ignore cleanup errors */
  }
  hideBusy();
  hideGlobalSuccessModal();
};
