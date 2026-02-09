/* global self, window, document, localStorage, MyIOLibrary, $ */

/* =========================================================================
 * ThingsBoard Widget: Water Common Area - Device Cards for Water Meters (MyIO)
 * RFC-0094: Aligned with WATER_STORES pattern using buildHeaderDevicesGrid and createFilterModal
 * - Filters devices by aliasName = 'HidrometrosLojas'
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
    console.error('[WATER_STORES] DATA_API_HOST not available - MAIN widget not loaded');
  }
  return host || '';
};

// RFC-0071: Device Profile functions (from MAIN)

// RFC-0094: UI Helper from MAIN (replaces local getCustomerNameForDevice)
const getCustomerNameForDevice =
  window.MyIOUtils?.getCustomerNameForDevice ||
  ((device) => {
    console.error('[WATER_STORES] getCustomerNameForDevice not available - MAIN widget not loaded');
    return device?.customerId ? `ID: ${device.customerId.substring(0, 8)}...` : 'N/A';
  });

// RFC-0094: formatarDuracao for operationHours calculation (from MAIN)
const formatarDuracao = window.MyIOUtils?.formatarDuracao || ((ms) => `${Math.round(ms / 1000)}s`);

// RFC-0094: Global MAP_INSTANTANEOUS_POWER (will be loaded from settings if available)
let MAP_INSTANTANEOUS_POWER = null;

LogHelper.log('🚀 [WATER_STORES] Controller loaded - VERSION WITH RFC-0094 PATTERN');

// RFC-0094: Centralized header controller
let waterStoresHeaderController = null;

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
let lastProcessedVersion = null; // Track orchestrator version to allow refresh on same period

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

/** ===================== HELPERS (DOM) ===================== **/
const $root = () => $(self.ctx.$container[0]);
const $list = () => $root().find('#waterStoresList');

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
  LogHelper.log(`[WATER_STORES] 🔄 showBusy() called with message: "${message || 'default'}"`);

  // Prevent multiple simultaneous busy calls
  if (window.busyInProgress) {
    LogHelper.log(`[WATER_STORES] ⏭️ Skipping duplicate showBusy() call`);
    return;
  }

  window.busyInProgress = true;

  // Centralized busy with enhanced synchronization
  const safeShowBusy = () => {
    try {
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.showGlobalBusy === 'function') {
        const text = (message && String(message).trim()) || 'Carregando dados...';
        window.MyIOOrchestrator.showGlobalBusy(WIDGET_DOMAIN, text, timeoutMs);
        LogHelper.log(`[WATER_STORES] ✅ Using centralized busy for domain: ${WIDGET_DOMAIN}`);
      } else {
        LogHelper.warn(`[WATER_STORES] ⚠️ Orchestrator not available, using fallback busy`);
        const $m = ensureBusyModalDOM();
        const text = (message && String(message).trim()) || 'aguarde.. carregando os dados...';
        $m.find(`#${BUSY_ID}-msg`).text(text);
        $m.css('display', 'flex');
      }
    } catch (err) {
      LogHelper.error(`[WATER_STORES] ❌ Error in showBusy:`, err);
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
  LogHelper.log(`[WATER_STORES] ✅ hideBusy() called`);

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
  LogHelper.log('[WATER_STORES] showGlobalSuccessModal');
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
    // RFC-0094: Filter by aliasName = 'HidrometrosLojas'
    const aliasName = row?.datasource?.aliasName || '';
    if (aliasName !== 'HidrometrosLojas') continue;

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
    // RFC-0094: Filter by aliasName = 'HidrometrosLojas'
    const aliasName = row?.datasource?.aliasName || '';
    if (aliasName !== 'HidrometrosLojas') continue;

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
  // FIX: ALWAYS use local widget datasources filtered by aliasName = 'HidrometrosLojas'
  // This ensures only lojas devices are shown, regardless of MAIN's classification
  let filteredDatasources = [];
  let filteredData = [];

  const allDatasources = self.ctx.datasources || [];
  const allAliases = [...new Set(allDatasources.map((ds) => ds.aliasName))];
  LogHelper.log(`[WATER_STORES] DEBUG: Available aliases in widget: ${JSON.stringify(allAliases)}`);
  LogHelper.log(
    `[WATER_STORES] DEBUG: Total datasources: ${allDatasources.length}, Total data rows: ${
      (self.ctx.data || []).length
    }`
  );

  // FIX: ALWAYS filter by aliasName = 'HidrometrosLojas' (ThingsBoard pre-filtered)
  // This is the ONLY reliable way to ensure only lojas devices are shown
  filteredDatasources = (self.ctx.datasources || []).filter((ds) => ds.aliasName === 'HidrometrosLojas');
  filteredData = (self.ctx.data || []).filter((d) => d?.datasource?.aliasName === 'HidrometrosLojas');

  LogHelper.log(
    `[WATER_STORES] FIX: Using ONLY local datasources filtered by 'HidrometrosLojas': ${filteredDatasources.length} datasources, ${filteredData.length} data rows`
  );

  LogHelper.log(
    `[WATER_STORES] buildAuthoritativeItems: Filtered ${filteredDatasources.length} datasources, ${filteredData.length} data rows for 'HidrometrosLojas'`
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
    // RFC-0140 FIX: Default to hidrometro_lojas since this is the WATER_STORES widget
    // If deviceProfile is not set in ThingsBoard, assume it's lojas (not area comum)
    const deviceProfile = attrs.deviceProfile || 'hidrometro_lojas';
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
      connectionStatus: 'online', // RFC-0144: Force connectionStatus to 'online' for water lojas (always_online)
      pulses: attrs.pulses ?? null, // FIX: Water meters use pulses (litros instantâneos)
    };
  });

  // RFC-0140 FIX: Filter to include ONLY LOJAS devices
  // Rules:
  // - deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO (exact match = loja)
  // - OR deviceType contains LOJA
  // This excludes HIDROMETRO_AREA_COMUM from appearing in WATER_STORES
  const filtered = mapped.filter((item) => {
    const dt = String(item.deviceType || '').toUpperCase();
    // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
    const dp = String(item.deviceProfile || item.deviceType || '').toUpperCase();

    // Accept if deviceType contains LOJA
    if (dt.includes('LOJA')) {
      return true;
    }

    // Accept if deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO (both same = loja)
    if (dt === 'HIDROMETRO' && dp === 'HIDROMETRO') {
      return true;
    }

    // Reject AREA_COMUM devices
    if (dt.includes('AREA_COMUM') || dp.includes('AREA_COMUM')) {
      LogHelper.log(
        `[WATER_STORES] Filtering out area comum device: ${item.label} (deviceType=${dt}, deviceProfile=${dp})`
      );
      return false;
    }

    // Accept other HIDROMETRO devices as lojas by default
    if (dt === 'HIDROMETRO') {
      return true;
    }

    LogHelper.log(
      `[WATER_STORES] Filtering out device: ${item.label} (deviceType=${dt}, deviceProfile=${dp})`
    );
    return false;
  });

  LogHelper.log(
    `[WATER_STORES] buildAuthoritativeItems: Built ${mapped.length} items, filtered to ${filtered.length} lojas devices`
  );

  // NOTA: O registro de IDs no Orchestrator agora é feito pelo MAIN
  // que centraliza os datasources HidrometrosLojas e Todos Hidrometros Lojas

  return filtered;
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

    // RFC-0144: Preserve existing non-zero values if API returns 0
    // This prevents overwriting good data with zeros
    const currentValue = Number(it.value || 0);
    const apiValue = Number(raw || 0);

    // Use API value if it's > 0, otherwise keep existing value
    const finalValue = apiValue > 0 ? apiValue : currentValue;

    // 3. [NOVO] Prioriza o ID que já existia (TB), senão usa o do Cache (API)
    const finalCustomerId = it.customerId || cachedCustomerId;

    return {
      ...it,
      value: finalValue,
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
      `[WATER_STORES] Shopping filter applied: ${before} -> ${v.length} devices (${
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
function updateWaterStoresStats(items) {
  // Use $root() to find elements within widget scope (not document.getElementById)
  const $widget = $root();
  const connectivityEl = $widget.find('#waterStoresStatsConnectivity')[0];
  const totalEl = $widget.find('#waterStoresStatsTotal')[0];
  const consumptionEl = $widget.find('#waterStoresStatsConsumption')[0];
  const zeroEl = $widget.find('#waterStoresStatsZero')[0];

  if (!connectivityEl || !totalEl || !consumptionEl || !zeroEl) {
    LogHelper.warn('[WATER_STORES] Stats header elements not found in widget scope');
    return;
  }

  // RFC-0144: Force all devices as online (same as WATER_STORES)
  // Water meters show accumulated totals, not real-time data
  let totalConsumption = 0;
  let zeroConsumptionCount = 0;

  items.forEach((item) => {
    // Consumption calculation - RFC-0140: Do NOT clear for water domain
    // API provides accumulated totals that are valid regardless of current connection status
    const consumption = Number(item.value) || Number(item.val) || 0;
    totalConsumption += consumption;

    if (consumption === 0) {
      zeroConsumptionCount++;
    }
  });

  // RFC-0144: All devices are considered online for water lojas
  const onlineCount = items.length;
  const totalWithStatus = items.length;

  // Calculate connectivity percentage
  const connectivityPercentage =
    totalWithStatus > 0 ? ((onlineCount / totalWithStatus) * 100).toFixed(1) : '0.0';

  // Update UI - RFC-0094: Use M³ formatting for water domain
  connectivityEl.textContent = `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`;
  totalEl.textContent = items.length.toString();
  consumptionEl.textContent = MyIO.formatWaterVolumeM3(totalConsumption);
  zeroEl.textContent = zeroConsumptionCount.toString();

  LogHelper.log('[WATER_STORES] Stats updated:', {
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
    console.error('[WATER_STORES] waterStoresList element not found via $list()');
    return;
  }

  listElement.innerHTML = '';

  for (const it of visible) {
    const container = document.createElement('div');
    listElement.appendChild(container);

    const valNum = Number(it.value || 0);

    // RFC-0144: Force status to 'power_on' for WATER_STORES
    // Water meters show accumulated totals, not real-time data, so connection status is not relevant
    // Using 'power_on' as it's a valid DeviceStatusType that maps to "Em operação" for water domain
    const deviceStatus = 'power_on';

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
      connectionStatus: 'online', // RFC-0144: Force connectionStatus to 'online' for water lojas
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

    // RFC-0140 FORCE CHECK: Skip rendering if device is NOT a loja
    // This is the final safety check before rendering
    const dtCheck = String(it.deviceType || '').toUpperCase();
    // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
    const dpCheck = String(it.deviceProfile || it.deviceType || '').toUpperCase();

    // Check if it's a LOJA device (HIDROMETRO + HIDROMETRO or contains LOJA)
    const isLoja =
      dtCheck.includes('LOJA') ||
      (dtCheck === 'HIDROMETRO' && dpCheck === 'HIDROMETRO') ||
      (dtCheck === 'HIDROMETRO' && !dpCheck.includes('AREA_COMUM'));

    // Skip AREA_COMUM devices
    const isAreaComum = dtCheck.includes('AREA_COMUM') || dpCheck.includes('AREA_COMUM');

    if (!isLoja || isAreaComum) {
      LogHelper.warn(
        `[WATER_STORES] FORCE CHECK: Skipping non-loja device: ${it.label} (deviceType=${dtCheck}, deviceProfile=${dpCheck})`
      );
      container.remove(); // Remove the empty container
      continue;
    }

    // RFC-0094: Use renderCardComponentHeadOffice like WATER_STORES
    // RFC-0110: Use 1440 (24h) to match RFC-0110 master rules for consistency
    MyIOLibrary.renderCardComponentHeadOffice(container, {
      entityObject: entityObject,
      delayTimeConnectionInMins: 1440, // RFC-0110: 24h threshold for consistency

      handleClickCard: (ev, entity) => {
        console.log(`[WATER_STORES] Card clicked: ${entity.name}`);
      },

      handleActionDashboard: async () => {
        console.log('[WATER_STORES] [RFC-0094] Opening water dashboard for:', entityObject.entityId);
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
            LogHelper.error('[WATER_STORES] MyIOAuth not available');
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
            LogHelper.error('[WATER_STORES] MyIOAuth not available for report');
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
          LogHelper.error('[WATER_STORES] [RFC-0094] JWT token not found');
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
              LogHelper.log('[WATER_STORES] [RFC-0094] Settings saved:', payload);
              showGlobalSuccessModal(6);
            },
            onClose: () => {
              $('.myio-settings-modal-overlay').remove();
              const overlay = document.querySelector('.myio-modal-overlay');
              if (overlay) {
                overlay.remove();
              }
              LogHelper.log('[WATER_STORES] [RFC-0094] Settings modal closed');
            },
          });
        } catch (e) {
          LogHelper.error('[WATER_STORES] [RFC-0094] Error opening settings:', e);
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

  console.log(`[WATER_STORES] Rendered ${visible.length} water meter cards`);
}

// ============================================
// RFC-0094: WATER_STORES FILTER MODAL (using shared factory from MAIN)
// ============================================

// Helper function to get item consumption value
function getItemConsumption(item) {
  return Number(item.value) || Number(item.consumption) || Number(item.val) || 0;
}

// Helper function to get item status (for filter tabs)
// RFC-0144: Force all devices as online for WATER_STORES
// Water meters show accumulated totals, not real-time data, so connection status is not relevant
function getItemStatus(item) {
  // RFC-0144: Always return 'online' for water lojas devices
  return 'online';
}

// Filter modal instance (lazy initialized)
let waterStoresFilterModal = null;

/**
 * RFC-0094: Initialize filter modal using shared factory from MAIN
 */
function initFilterModal() {
  const createFilterModal = window.MyIOUtils?.createFilterModal;

  if (!createFilterModal) {
    LogHelper.error('[WATER_STORES] createFilterModal not available from MAIN');
    return null;
  }

  return createFilterModal({
    widgetName: 'WATER_STORES',
    containerId: 'waterStoresFilterModalGlobal',
    modalClass: 'water-stores-modal',
    primaryColor: '#0288D1', // Blue for water
    itemIdAttr: 'data-entity',

    // Filter tabs configuration - specific for WATER_STORES
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
      LogHelper.log('[WATER_STORES] [RFC-0094] Filters applied via shared modal');
    },

    onReset: () => {
      STATE.selectedIds = null;
      STATE.sortMode = 'cons_desc';
      STATE.searchTerm = '';
      STATE.searchActive = false;

      // RFC-0094: Reset UI via header controller
      if (waterStoresHeaderController) {
        const searchInput = waterStoresHeaderController.getSearchInput();
        if (searchInput) searchInput.value = '';
        waterStoresHeaderController.toggleSearch(false);
      }

      reflowFromState();
      LogHelper.log('[WATER_STORES] [RFC-0094] Filters reset via shared modal');
    },

    onClose: () => {
      LogHelper.log('[WATER_STORES] [RFC-0094] Filter modal closed');
    },
  });
}

/**
 * RFC-0094: Open filter modal
 */
function openFilterModal() {
  // Lazy initialize modal
  if (!waterStoresFilterModal) {
    waterStoresFilterModal = initFilterModal();
  }

  if (!waterStoresFilterModal) {
    LogHelper.error('[WATER_STORES] Failed to initialize filter modal');
    window.alert('Erro ao inicializar modal de filtros. Verifique se o widget MAIN foi carregado.');
    return;
  }

  // Use itemsEnriched if available (has consumption values), otherwise itemsBase
  const items =
    STATE.itemsEnriched && STATE.itemsEnriched.length > 0 ? STATE.itemsEnriched : STATE.itemsBase || [];

  // RFC-0144: Force deviceStatus to 'online' for water lojas (always_online like WATER_STORES)
  // This ensures getItemStatus() will have deviceStatus available
  const itemsWithDeviceStatus = items.map((item) => {
    // RFC-0144: Always return 'online' for water lojas devices
    return { ...item, deviceStatus: 'online' };
  });

  // Open with current items and state
  waterStoresFilterModal.open(itemsWithDeviceStatus, {
    selectedIds: STATE.selectedIds,
    sortMode: STATE.sortMode,
  });
}

/**
 * RFC-0094: Close filter modal (for backward compatibility)
 */
function closeFilterModal() {
  if (waterStoresFilterModal) {
    waterStoresFilterModal.close();
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
  // RFC-0140 FIX: Use 'visible' (filtered items) instead of STATE.itemsEnriched for accurate stats
  if (visible && visible.length > 0) {
    // RFC-0144: Force deviceStatus to 'online' for water lojas (always_online like WATER_STORES)
    const itemsWithDeviceStatus = visible.map((item) => {
      // RFC-0144: Always return 'online' for water lojas devices
      return { ...item, deviceStatus: 'online' };
    });

    if (waterStoresHeaderController) {
      waterStoresHeaderController.updateFromDevices(itemsWithDeviceStatus, {});
    } else {
      // RFC-0140 FIX: Use 'visible' (filtered items) for accurate stats
      updateWaterStoresStats(visible);
    }
  }
}

function reflowFromState() {
  filterAndRender();
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
    `[WATER_STORES] Configured EARLY: domain=${WIDGET_DOMAIN}, debugActive=${DEBUG_ACTIVE}, activeTooltipDebug=${ACTIVE_TOOLTIP_DEBUG}`
  );

  // RFC-0094: Build centralized header via buildHeaderDevicesGrid
  const buildHeaderDevicesGrid = window.MyIOUtils?.buildHeaderDevicesGrid;
  if (buildHeaderDevicesGrid) {
    // FIX: Use $root().find() to get container within widget scope, not document.querySelector
    const headerContainerEl = $root().find('#waterStoresHeaderContainer')[0];
    if (headerContainerEl) {
      waterStoresHeaderController = buildHeaderDevicesGrid({
        container: headerContainerEl, // Pass element directly, not selector string
        domain: 'water',
        idPrefix: 'waterStores',
        labels: {
          total: 'Total de Hidrômetros',
          consumption: 'Consumo Total (m³)',
        },
        includeSearch: true,
        includeFilter: true,
        onSearchClick: () => {
          STATE.searchActive = !STATE.searchActive;
          if (STATE.searchActive) {
            const input = waterStoresHeaderController?.getSearchInput();
            if (input) setTimeout(() => input.focus(), 100);
          }
        },
        onFilterClick: () => {
          openFilterModal();
        },
      });

      // Setup search input listener
      const searchInput = waterStoresHeaderController?.getSearchInput();
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          STATE.searchTerm = e.target.value || '';
          filterAndRender();
        });
      }

      LogHelper.log('[WATER_STORES] [RFC-0094] Header controller initialized');
    } else {
      LogHelper.warn('[WATER_STORES] Header container element not found in widget scope');
    }
  } else {
    LogHelper.warn('[WATER_STORES] buildHeaderDevicesGrid not available - using fallback');
  }

  dateUpdateHandler = function (ev) {
    LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] ✅ DATE UPDATE EVENT RECEIVED!`, ev.detail);

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

      LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] Date range updated:`, startISO, endISO);

      self.ctx.scope = self.ctx.scope || {};
      self.ctx.scope.startDateISO = startISO;
      self.ctx.scope.endDateISO = endISO;

      // RFC-0109: Don't call hydrateAndRender() - MAIN will emit new data via events
      // Clear current data and show busy while waiting for MAIN to provide new data
      STATE.dataFromMain = false;
      showBusy('Carregando dados de água...');
      LogHelper.log(
        `[WATER_STORES ${WIDGET_DOMAIN}] Waiting for MAIN to provide new water data for updated period`
      );
    } catch (err) {
      LogHelper.error(`[WATER_STORES ${WIDGET_DOMAIN}] dateUpdateHandler error:`, err);
      hideBusy();
    }
  };

  LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] 📡 Registering myio:update-date listener...`);
  window.addEventListener('myio:update-date', dateUpdateHandler);
  LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] ✅ myio:update-date listener registered!`);

  // RFC-0042: Listen for clear event from HEADER (when user clicks "Limpar" button)
  window.addEventListener('myio:telemetry:clear', (ev) => {
    const { domain } = ev.detail;

    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] Ignoring clear event for domain: ${domain}`);
      return;
    }

    LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] 🧹 Received clear event - clearing visual content`);

    try {
      STATE.itemsBase = [];
      STATE.itemsEnriched = [];
      STATE.selectedIds = null;

      const $widget = $root();
      const $waterStoresList = $widget.find('#waterStoresList');
      if ($waterStoresList.length > 0) {
        $waterStoresList.empty();
        LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] ✅ waterStoresList cleared`);
      }

      LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] 🧹 Clear completed successfully`);
    } catch (err) {
      LogHelper.error(`[WATER_STORES ${WIDGET_DOMAIN}] ❌ Error during clear:`, err);
    }
  });

  // RFC-0093: Function to render shopping filter chips in toolbar (same as EQUIPMENTS/STORES)
  function renderShoppingFilterChips(selection) {
    const chipsContainer = document.getElementById('waterStoresShoppingFilterChips');
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

    LogHelper.log('[WATER_STORES] 📍 Rendered', selection.length, 'shopping filter chips');
  }

  // RFC-0093: Listen for shopping filter changes
  window.addEventListener('myio:filter-applied', (ev) => {
    const selection = ev.detail?.selection || [];
    LogHelper.log('[WATER_STORES] 🔥 heard myio:filter-applied:', selection.length, 'shoppings');

    // Extract shopping IDs (ingestionIds) from selection
    const shoppingIds = selection.map((s) => s.value).filter((v) => v);

    LogHelper.log(
      '[WATER_STORES] Applying shopping filter:',
      shoppingIds.length === 0 ? 'ALL' : `${shoppingIds.length} shoppings`
    );

    // Update STATE and reflow cards
    STATE.selectedShoppingIds = shoppingIds;

    // Render shopping filter chips
    renderShoppingFilterChips(selection);

    // Reflow to apply filter
    reflowFromState();
  });

  // RFC-0093: Check for pre-existing filter when WATER_STORES initializes
  if (
    window.custumersSelected &&
    Array.isArray(window.custumersSelected) &&
    window.custumersSelected.length > 0
  ) {
    LogHelper.log(
      '[WATER_STORES] 🔄 Applying pre-existing filter:',
      window.custumersSelected.length,
      'shoppings'
    );
    const shoppingIds = window.custumersSelected.map((s) => s.value).filter((v) => v);
    STATE.selectedShoppingIds = shoppingIds;
    renderShoppingFilterChips(window.custumersSelected);
  }

  // Test if listener is working
  setTimeout(() => {
    LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] 🧪 Testing listener registration...`);
    if (typeof dateUpdateHandler === 'function') {
      LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] ✅ dateUpdateHandler is defined and ready`);
    } else {
      LogHelper.error(`[WATER_STORES ${WIDGET_DOMAIN}] ❌ dateUpdateHandler is NOT defined!`);
    }
  }, 100);

  dataProvideHandler = function (ev) {
    const eventVersion = window.MyIOOrchestratorData?.[ev.detail?.domain]?.version || null;
    LogHelper.log(
      `[WATER_STORES ${WIDGET_DOMAIN}] 📦 Received provide-data event for domain ${
        ev.detail.domain
      }, periodKey: ${ev.detail.periodKey}, version: ${eventVersion ?? 'N/A'}, items: ${
        ev.detail.items?.length || 0
      }`
    );
    const { domain, periodKey, items } = ev.detail;

    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(
        `[WATER_STORES ${WIDGET_DOMAIN}] ⏭️ Ignoring event for domain ${domain}, my domain is ${WIDGET_DOMAIN}`
      );
      return;
    }

    if (lastProcessedPeriodKey === periodKey && eventVersion === lastProcessedVersion) {
      LogHelper.log(
        `[WATER_STORES] ⏭️ Skipping duplicate provide-data for periodKey: ${periodKey} (version: ${
          eventVersion ?? 'N/A'
        })`
      );
      return;
    }

    const myPeriod = {
      startISO: self.ctx.scope?.startDateISO,
      endISO: self.ctx.scope?.endDateISO,
    };

    if (!myPeriod.startISO || !myPeriod.endISO) {
      LogHelper.warn(
        `[WATER_STORES] ⏸️ Period not set yet, storing provide-data event for later processing`
      );
      return;
    }

    lastProcessedPeriodKey = periodKey;
    lastProcessedVersion = eventVersion;

    LogHelper.log(`[WATER_STORES] 🔄 Processing data from orchestrator...`);
    LogHelper.log(
      `[WATER_STORES] Received ${items.length} items from orchestrator for domain ${domain}`
    );

    const myDatasourceIds = extractDatasourceIds(self.ctx.datasources);
    const datasourceIdSet = new Set(myDatasourceIds);
    let filtered = items.filter((item) => {
      return datasourceIdSet.has(item.id) || datasourceIdSet.has(item.tbId);
    });

    LogHelper.log(
      `[WATER_STORES] Filtered ${items.length} items down to ${filtered.length} items matching datasources`
    );

    if (filtered.length === 0) {
      LogHelper.warn(`[WATER_STORES] No items match datasource IDs! Using all items as fallback.`);
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

    LogHelper.log(`[WATER_STORES] Using ${filtered.length} items after processing`);

    if (!STATE.itemsBase || STATE.itemsBase.length === 0) {
      LogHelper.log(`[WATER_STORES] Building itemsBase from TB data...`);
      STATE.itemsBase = buildAuthoritativeItems();
      LogHelper.log(`[WATER_STORES] Built ${STATE.itemsBase.length} items from TB`);
    }

    const orchestratorValues = new Map();
    filtered.forEach((item) => {
      if (item.ingestionId) {
        const value = Number(item.value || 0);
        orchestratorValues.set(item.ingestionId, value);
      }
    });
    LogHelper.log(`[WATER_STORES] Orchestrator values map size: ${orchestratorValues.size}`);

    // RFC-0144: Only update values if orchestrator has a BETTER (non-zero) value
    // This prevents provide-data from overwriting good values with zeros
    STATE.itemsEnriched = STATE.itemsBase.map((tbItem) => {
      const orchestratorValue = orchestratorValues.get(tbItem.ingestionId);
      const currentValue = tbItem.value || 0;

      // RFC-0144: Prioritize non-zero values
      // If orchestrator has a value > 0, use it
      // If orchestrator value is 0 or undefined, keep existing value
      let finalValue = currentValue;
      if (orchestratorValue !== undefined && orchestratorValue > 0) {
        finalValue = orchestratorValue;
      } else if (currentValue === 0 && orchestratorValue !== undefined) {
        // Only use orchestrator's zero if we have no value at all
        finalValue = orchestratorValue;
      }

      return {
        ...tbItem,
        value: finalValue,
        perc: 0,
      };
    });

    LogHelper.log(
      `[WATER_STORES] Enriched ${STATE.itemsEnriched.length} items with orchestrator values (preserved non-zero values)`
    );

    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map((x) => String(x.id)));
      const next = new Set([...STATE.selectedIds].filter((id) => valid.has(String(id))));
      STATE.selectedIds = next.size ? next : null;
    }

    reflowFromState();

    LogHelper.log(`[WATER_STORES] 🏁 Data processed successfully - ensuring busy is hidden`);

    setTimeout(() => {
      hideBusy();
      if (window.MyIOOrchestrator && window.MyIOOrchestrator.getBusyState) {
        const busyState = window.MyIOOrchestrator.getBusyState();
        if (busyState.isVisible) {
          LogHelper.warn(
            `[WATER_STORES] ⚠️ Orchestrator busy still visible after data processing - force hiding`
          );
          window.MyIOOrchestrator.hideGlobalBusy();
        }
      }
    }, 100);
  };

  /**
   * Extracts ingestionIds from ThingsBoard ctx.data
   * RFC-0094: Only extracts from 'HidrometrosLojas' alias
   */
  function extractDatasourceIds(datasources) {
    const ingestionIds = new Set();
    const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];

    for (const row of rows) {
      // RFC-0094: Filter by aliasName = 'HidrometrosLojas'
      const aliasName = row?.datasource?.aliasName || '';
      if (aliasName !== 'HidrometrosLojas') continue;

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
      LogHelper.log('[WATER_STORES] Ignoring water-data-ready: no cache or empty');
      return;
    }

    LogHelper.log(
      `[WATER_STORES] 📦 Received water-data-ready: ${cache.size} devices (fromCache: ${fromCache})`
    );

    // Check if widget has items to enrich
    if (!STATE.itemsBase || STATE.itemsBase.length === 0) {
      LogHelper.log('[WATER_STORES] No itemsBase yet, building...');
      STATE.itemsBase = buildAuthoritativeItems();
    }

    if (STATE.itemsBase.length === 0) {
      LogHelper.warn('[WATER_STORES] Still no items after buildAuthoritativeItems, skipping');
      return;
    }

    // Enrich items with data from MAIN waterCache
    STATE.itemsEnriched = enrichItemsWithTotals(STATE.itemsBase, cache);
    LogHelper.log(`[WATER_STORES] Enriched ${STATE.itemsEnriched.length} items from MAIN waterCache`);

    // Render
    reflowFromState();
  };

  window.addEventListener('myio:water-data-ready', waterDataReadyHandler);

  // FIX: Listen for myio:water-summary-ready event from MAIN (this event is actually emitted!)
  // When this event fires, the classified data is already in the cache
  // RFC-0144: Always try to enrich when summary is ready, not just when itemsBase is empty
  let waterSummaryHandler = null;
  waterSummaryHandler = () => {
    const cachedWater = window.MyIOOrchestratorData?.classified?.water;
    if (cachedWater?.hidrometro_lojas?.length > 0) {
      LogHelper.log(
        `[WATER_STORES] 📡 water-summary-ready received, enriching with ${cachedWater.hidrometro_lojas.length} items from cache...`
      );
      waterTbDataHandler({ detail: { classified: { water: cachedWater } } });
    }
  };
  window.addEventListener('myio:water-summary-ready', waterSummaryHandler);

  // RFC-0109: Listener para dados classificados do MAIN (items já classificados por deviceType/deviceProfile)
  // FIX: MAIN stores data in window.MyIOOrchestratorData.classified.water.hidrometro_lojas
  waterTbDataHandler = (ev) => {
    LogHelper.log(
      `[WATER_STORES] 📨 waterTbDataHandler called with event:`,
      ev?.detail ? 'has detail' : 'no detail'
    );

    // FIX: Support both formats - old (commonArea) and new (classified.water)
    let storesItems = [];
    let classification = ev.detail?.classification || {};

    // Try new format first (from classified.water)
    if (ev.detail?.classified?.water?.hidrometro_lojas) {
      storesItems = ev.detail.classified.water.hidrometro_lojas;
      LogHelper.log(`[WATER_STORES] Using new format: classified.water.hidrometro_lojas`);
    }
    // Fallback to old format (stores)
    else if (ev.detail?.stores?.items) {
      storesItems = ev.detail.stores.items;
      LogHelper.log(`[WATER_STORES] Using old format: stores.items`);
    }
    // Try getting from global cache
    else if (window.MyIOOrchestratorData?.classified?.water?.hidrometro_lojas) {
      storesItems = window.MyIOOrchestratorData.classified.water.hidrometro_lojas;
      LogHelper.log(
        `[WATER_STORES] Using global cache: MyIOOrchestratorData.classified.water.hidrometro_lojas`
      );
    }

    LogHelper.log(`[WATER_STORES] 📦 Found ${storesItems.length} items from MAIN`);

    // RFC-0144 FIX: When we have local datasource data, ENRICH it with API values from MAIN
    // instead of ignoring the MAIN data entirely
    if (STATE.itemsBase.length > 0 && storesItems.length > 0) {
      LogHelper.log(
        `[WATER_STORES] RFC-0144: Enriching ${STATE.itemsBase.length} local items with API values from MAIN (${storesItems.length} items)`
      );

      // Build a map of MAIN items by ingestionId for quick lookup
      const mainItemsMap = new Map();
      storesItems.forEach((item) => {
        if (item.ingestionId) mainItemsMap.set(item.ingestionId, item);
        if (item.tbId) mainItemsMap.set(item.tbId, item);
        if (item.id) mainItemsMap.set(item.id, item);
      });

      // Enrich local items with API values from MAIN
      STATE.itemsEnriched = STATE.itemsBase.map((localItem) => {
        // Try to find matching MAIN item
        const mainItem =
          mainItemsMap.get(localItem.ingestionId) ||
          mainItemsMap.get(localItem.tbId) ||
          mainItemsMap.get(localItem.id);

        // Get consumption value from MAIN (API-enriched) or fallback to local pulses
        const consumptionValue =
          mainItem?.value || mainItem?.consumption || localItem.pulses || localItem.value || 0;

        if (mainItem) {
          LogHelper.log(
            `[WATER_STORES] RFC-0144: Enriched ${localItem.label}: mainValue=${mainItem?.value}, mainConsumption=${mainItem?.consumption}, localPulses=${localItem.pulses}, final=${consumptionValue}`
          );
        }

        return {
          ...localItem,
          value: consumptionValue,
          consumption: consumptionValue,
          pulses: mainItem?.pulses || localItem.pulses || 0,
          perc: 0,
        };
      });

      LogHelper.log(
        `[WATER_STORES] RFC-0144: Enriched ${STATE.itemsEnriched.length} items, total value: ${STATE.itemsEnriched.reduce((sum, i) => sum + (i.value || 0), 0).toFixed(2)} m³`
      );

      reflowFromState();
      hideBusy();
      return;
    }

    // RFC-0109: Only use MAIN data structure if we have NO local data
    if (storesItems && storesItems.length > 0 && STATE.itemsBase.length === 0) {
      const storesData = {
        items: storesItems,
        total: storesItems.reduce((sum, d) => sum + Number(d.value || d.pulses || 0), 0),
      };
      LogHelper.log(
        `[WATER_STORES] Received classified data from MAIN: ${storesItems.length} items, total: ${
          storesData.total?.toFixed(2) || 0
        } m³`
      );
      LogHelper.log(`[WATER_STORES] Classification breakdown: ${JSON.stringify(classification || {})}`);

      // RFC-0109/RFC-0131: Use items directly from MAIN (already classified as lojas)
      // RFC-0140: Ensure consumption value is properly copied from MAIN's enriched data
      // Copy ALL telemetry fields for proper status calculation and card rendering
      const mappedItems = storesItems.map((item) => {
        // RFC-0140: Prioritize API-enriched value over TB pulses
        const consumptionValue = item.value || item.consumption || item.pulses || 0;
        LogHelper.log(
          `[WATER_STORES] Building item: ${item.label}, value=${item.value}, consumption=${item.consumption}, pulses=${item.pulses}, final=${consumptionValue}`
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
          deviceType: item.deviceType || 'hidrometro_lojas',
          deviceProfile: item.deviceProfile || 'hidrometro_lojas',
          updatedIdentifiers: {},
          connectionStatusTime: item.lastConnectTime || null,
          timeVal: item.lastActivityTime || null,
          lastDisconnectTime: item.lastDisconnectTime || null,
          lastConnectTime: item.lastConnectTime || item.lastActivityTime || null,
          lastActivityTime: item.lastActivityTime || null,
          deviceMapInstaneousPower: item.deviceMapInstaneousPower || null,
          customerId: item.customerId || null,
          connectionStatus: 'online', // RFC-0144: Force connectionStatus to 'online' for water lojas
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

      // RFC-0140 FIX: Filter to include ONLY LOJAS devices (same logic as buildAuthoritativeItems)
      // This ensures consistency even when data comes from MAIN
      STATE.itemsBase = mappedItems.filter((item) => {
        const dt = String(item.deviceType || '').toUpperCase();
        // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
        const dp = String(item.deviceProfile || item.deviceType || '').toUpperCase();

        // Reject AREA_COMUM devices
        if (dt.includes('AREA_COMUM') || dp.includes('AREA_COMUM')) {
          LogHelper.log(
            `[WATER_STORES] Filtering out area comum MAIN item: ${item.label} (deviceType=${dt}, deviceProfile=${dp})`
          );
          return false;
        }

        // Accept if deviceType contains LOJA
        if (dt.includes('LOJA')) {
          return true;
        }

        // Accept if deviceType = HIDROMETRO AND deviceProfile = HIDROMETRO (both same = loja)
        if (dt === 'HIDROMETRO' && dp === 'HIDROMETRO') {
          return true;
        }

        // Accept other HIDROMETRO devices as lojas by default
        if (dt === 'HIDROMETRO') {
          return true;
        }

        LogHelper.log(
          `[WATER_STORES] Filtering out MAIN item: ${item.label} (deviceType=${dt}, deviceProfile=${dp})`
        );
        return false;
      });

      LogHelper.log(
        `[WATER_STORES] Built ${mappedItems.length} items from MAIN, filtered to ${STATE.itemsBase.length} lojas devices`
      );
      STATE.dataFromMain = true; // RFC-0109: Mark that data came from MAIN

      // RFC-0131: MAIN now enriches water data with API values before emitting
      // Check if data is already API-enriched (has apiEnriched flag)
      const isApiEnriched = ev.detail?.apiEnriched || false;
      LogHelper.log(`[WATER_STORES] RFC-0131: Data from MAIN (apiEnriched: ${isApiEnriched})`);

      // Use values directly from MAIN (already enriched or will be re-emitted when enriched)
      STATE.itemsEnriched = STATE.itemsBase.map((item) => {
        const sourceItem = storesItems.find(
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
  LogHelper.log(`[WATER_STORES] 🔍 Checking for cached classified data...`);
  const cachedClassified = window.MyIOOrchestratorData?.classified?.water;
  const cachedTimestamp =
    window.MyIOOrchestratorData?.apiEnrichedAt || window.MyIOOrchestratorData?.classified?.timestamp;

  if (!window.MyIOOrchestratorData) {
    LogHelper.warn(`[WATER_STORES] ⚠️ window.MyIOOrchestratorData is not available`);
  } else if (!cachedClassified) {
    LogHelper.warn(
      `[WATER_STORES] ⚠️ classified.water not found in MyIOOrchestratorData. Available keys: ${Object.keys(
        window.MyIOOrchestratorData
      ).join(', ')}`
    );
  } else {
    LogHelper.log(
      `[WATER_STORES] 📦 Found classified.water: hidrometro_lojas=${
        cachedClassified.hidrometro_lojas?.length || 0
      }, hidrometro=${cachedClassified.hidrometro?.length || 0}`
    );
  }

  if (cachedClassified?.hidrometro_lojas?.length > 0) {
    const cacheAge = Date.now() - (cachedTimestamp || 0);
    LogHelper.log(`[WATER_STORES] 🕐 Cache age: ${cacheAge}ms (threshold: 60000ms)`);
    if (cacheAge < 60000) {
      // Use cache if less than 60 seconds old
      LogHelper.log(
        `[WATER_STORES] ✅ Found cached classified data (${cachedClassified.hidrometro_lojas.length} items, age: ${cacheAge}ms) - using it!`
      );
      // Simulate event with cached data in new format
      waterTbDataHandler({ detail: { classified: { water: cachedClassified } } });
    } else {
      LogHelper.warn(
        `[WATER_STORES] ⏰ Cache too old (${cacheAge}ms > 60000ms), waiting for fresh data`
      );
    }
  } else if (cachedClassified) {
    LogHelper.warn(`[WATER_STORES] ⚠️ Cache exists but hidrometro_lojas is empty or missing`);
  }

  // RFC-0109: Fallback - retry cache check after 2s in case of timing issues
  // RFC-0144: Also retry when we have items but no enriched values (all zeros)
  const needsEnrichment =
    !cachedClassified?.hidrometro_lojas?.length ||
    (STATE.itemsEnriched.length > 0 && STATE.itemsEnriched.every((i) => (i.value || 0) === 0));

  if (needsEnrichment) {
    setTimeout(() => {
      const retryCache = window.MyIOOrchestratorData?.classified?.water;
      const retryTimestamp = window.MyIOOrchestratorData?.apiEnrichedAt || Date.now();
      // RFC-0144: Always try to enrich if we have cache data (not just when itemsBase is empty)
      if (retryCache?.hidrometro_lojas?.length > 0) {
        const cacheAge = Date.now() - retryTimestamp;
        if (cacheAge < 120000) {
          // Extended threshold for retry
          LogHelper.log(
            `[WATER_STORES] 🔄 Retry found cached data (${retryCache.hidrometro_lojas.length} items, age: ${cacheAge}ms)`
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
    LogHelper.log('[WATER_STORES] Using credentials from MAIN (MyIOUtils)');
  } else {
    LogHelper.log('[WATER_STORES] MAIN credentials not available, fetching directly...');
    const customerTB_ID = window.MyIOUtils?.getCustomerId?.() || self.ctx.settings?.customerTB_ID || '';

    try {
      const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
      CLIENT_ID = attrs?.client_id || '';
      CLIENT_SECRET = attrs?.client_secret || '';
      CUSTOMER_ING_ID = attrs?.ingestionId || '';
    } catch (err) {
      LogHelper.error('[WATER_STORES] Failed to fetch credentials:', err);
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

      LogHelper.log('[WATER_STORES] Auth init OK');
      try {
        await MyIOAuth.getToken();
      } catch (_e) {
        /* ignore token errors */
      }
    } catch (err) {
      LogHelper.error('[WATER_STORES] Auth init FAIL', err);
    }
  } else {
    LogHelper.warn('[WATER_STORES] No credentials available for auth initialization');
  }

  // Bind UI
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

  // RFC-0109: WATER_STORES relies on MAIN for data, not local datasources
  // We wait for myio:water-tb-data-ready event or use cached waterClassified data
  LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] onInit - Waiting for water data from MAIN...`);

  if (self.ctx?.scope?.startDateISO && self.ctx?.scope?.endDateISO) {
    LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] Initial period defined, showing busy...`);
    showBusy();
  } else {
    LogHelper.log(
      `[WATER_STORES ${WIDGET_DOMAIN}] No initial period, waiting for myio:update-date event...`
    );
  }

  // RFC-0109: WATER_STORES relies ONLY on data from MAIN (like EQUIPMENTS pattern)
  // We don't use buildAuthoritativeItems() or hydrateAndRender() since widget has no datasources
  if (STATE.dataFromMain || STATE.itemsBase.length > 0) {
    // Data already loaded from MAIN cache or event
    LogHelper.log(
      `[WATER_STORES] ✅ Data from MAIN ready: ${STATE.itemsBase.length} items (dataFromMain: ${STATE.dataFromMain})`
    );
    hideBusy();
  } else {
    // Wait for data from MAIN via event (similar to EQUIPMENTS pattern)
    LogHelper.log(`[WATER_STORES] ⏳ Waiting for water data from MAIN...`);

    const waterDataTimeout = setTimeout(() => {
      if (STATE.itemsBase.length === 0) {
        LogHelper.warn(`[WATER_STORES] ⚠️ Timeout waiting for water data from MAIN`);
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
    // RFC-0144: Check if items need enrichment (all values are zero)
    const cacheWatcher = setInterval(() => {
      const retryCache = window.MyIOOrchestratorData?.waterClassified;
      const classifiedCache = window.MyIOOrchestratorData?.classified?.water;

      // RFC-0144: Check if we need enrichment (no items OR all values are zero)
      const needsEnrichment =
        STATE.itemsBase.length === 0 ||
        (STATE.itemsEnriched.length > 0 && STATE.itemsEnriched.every((i) => (i.value || 0) === 0));

      // Try waterClassified format first
      if (retryCache?.stores?.items?.length > 0 && needsEnrichment) {
        clearInterval(cacheWatcher);
        clearTimeout(waterDataTimeout);
        LogHelper.log(
          `[WATER_STORES] 🔄 CacheWatcher found waterClassified data: ${retryCache.stores.items.length} items`
        );
        waterTbDataHandler({ detail: retryCache });
      }
      // Try classified.water format
      else if (classifiedCache?.hidrometro_lojas?.length > 0 && needsEnrichment) {
        clearInterval(cacheWatcher);
        clearTimeout(waterDataTimeout);
        LogHelper.log(
          `[WATER_STORES] 🔄 CacheWatcher found classified.water data: ${classifiedCache.hidrometro_lojas.length} items`
        );
        waterTbDataHandler({ detail: { classified: { water: classifiedCache } } });
      }
      // Stop if we have enriched items with actual values
      else if (STATE.itemsEnriched.length > 0 && STATE.itemsEnriched.some((i) => (i.value || 0) > 0)) {
        clearInterval(cacheWatcher);
        clearTimeout(waterDataTimeout);
        LogHelper.log(`[WATER_STORES] ✅ CacheWatcher: Data enriched with values, stopping`);
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
    LogHelper.log("[WATER_STORES] Event listener 'myio:update-date' removido.");
  }
  if (dataProvideHandler) {
    window.removeEventListener('myio:telemetry:provide-data', dataProvideHandler);
    LogHelper.log("[WATER_STORES] Event listener 'myio:telemetry:provide-data' removido.");
  }
  if (waterDataReadyHandler) {
    window.removeEventListener('myio:water-data-ready', waterDataReadyHandler);
    LogHelper.log("[WATER_STORES] Event listener 'myio:water-data-ready' removido.");
  }
  if (waterTbDataHandler) {
    window.removeEventListener('myio:water-tb-data-ready', waterTbDataHandler);
    LogHelper.log("[WATER_STORES] Event listener 'myio:water-tb-data-ready' removido.");
  }

  // FIX: Remove water-summary-ready listener (added for cache sync)
  window.removeEventListener('myio:water-summary-ready', () => {});
  LogHelper.log("[WATER_STORES] Event listener 'myio:water-summary-ready' removido.");

  // RFC-0094: Cleanup header controller
  if (waterStoresHeaderController) {
    waterStoresHeaderController.destroy();
    waterStoresHeaderController = null;
    LogHelper.log('[WATER_STORES] [RFC-0094] Header controller destroyed');
  }

  // RFC-0094: Cleanup filter modal using shared factory
  if (waterStoresFilterModal) {
    waterStoresFilterModal.destroy();
    waterStoresFilterModal = null;
    LogHelper.log('[WATER_STORES] [RFC-0094] Filter modal destroyed');
  }

  try {
    $root().off();
  } catch (_e) {
    /* ignore cleanup errors */
  }
  hideBusy();
  hideGlobalSuccessModal();
};
