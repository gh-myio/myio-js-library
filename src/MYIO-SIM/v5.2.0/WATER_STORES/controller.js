/* =========================================================================
 * ThingsBoard Widget: Water Stores - Device Cards for Water Meters (MyIO)
 * RFC-0094: Aligned with STORES pattern using buildHeaderDevicesGrid and createFilterModal
 * - Filters devices by aliasName = 'Todos Hidrometros Lojas'
 * - Uses domain='water' for M³ formatting
 * - Datas obrigatórias: startDateISO / endDateISO
 * - Se ausentes no onInit: usa "current month so far" (1º dia 00:00 → hoje 23:59)
 * - Modal premium (busy) no widget durante carregamentos
 * - Modal premium global (fora do widget) para sucesso, com contador e reload
 * - onDataUpdated: no-op
 * - Evento (myio:update-date): mostra modal + atualiza
 * =========================================================================*/

/* eslint-disable no-undef, no-unused-vars */

// ============================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

const getDataApiHost =
  window.MyIOUtils?.getDataApiHost ||
  (() => {
    console.error('[WATER_STORES] getDataApiHost not available - MAIN widget not loaded');
    return localStorage.getItem('__MYIO_DATA_API_HOST__') || 'https://api.data.apps.myio-bas.com';
  });

// RFC-0071: Device Profile functions (from MAIN)
const fetchDeviceProfiles =
  window.MyIOUtils?.fetchDeviceProfiles ||
  (() => {
    console.error('[WATER_STORES] fetchDeviceProfiles not available - MAIN widget not loaded');
    return Promise.resolve(new Map());
  });

const fetchDeviceDetails =
  window.MyIOUtils?.fetchDeviceDetails ||
  (() => {
    console.error('[WATER_STORES] fetchDeviceDetails not available - MAIN widget not loaded');
    return Promise.resolve({});
  });

const addDeviceProfileAttribute =
  window.MyIOUtils?.addDeviceProfileAttribute ||
  (() => {
    console.error('[WATER_STORES] addDeviceProfileAttribute not available - MAIN widget not loaded');
    return Promise.resolve({ ok: false, status: 0, data: null });
  });

const syncDeviceProfileAttributes =
  window.MyIOUtils?.syncDeviceProfileAttributes ||
  (() => {
    console.error('[WATER_STORES] syncDeviceProfileAttributes not available - MAIN widget not loaded');
    return Promise.resolve({ synced: 0, skipped: 0, errors: 0 });
  });

// RFC-0094: UI Helper from MAIN (replaces local getCustomerNameForDevice)
const getCustomerNameForDevice =
  window.MyIOUtils?.getCustomerNameForDevice ||
  ((device) => {
    console.error('[WATER_STORES] getCustomerNameForDevice not available - MAIN widget not loaded');
    return device?.customerId ? `ID: ${device.customerId.substring(0, 8)}...` : 'N/A';
  });

// RFC-0094: Device status calculation functions from MAIN
const getConsumptionRangesHierarchical = window.MyIOUtils?.getConsumptionRangesHierarchical;
const mapConnectionStatus = window.MyIOUtils?.mapConnectionStatus || ((status) => status || 'offline');

// RFC-0094: formatarDuracao for operationHours calculation (from MAIN)
const formatarDuracao = window.MyIOUtils?.formatarDuracao || ((ms) => `${Math.round(ms / 1000)}s`);

// RFC-0094: Global MAP_INSTANTANEOUS_POWER (will be loaded from settings if available)
let MAP_INSTANTANEOUS_POWER = null;

LogHelper.log('🚀 [WATER_STORES] Controller loaded - VERSION WITH RFC-0094 PATTERN');

const MAX_FIRST_HYDRATES = 1;

let __deviceProfileSyncComplete = false;

// RFC-0094: Centralized header controller
let waterStoresHeaderController = null;

let dateUpdateHandler = null;
let dataProvideHandler = null; // RFC-0042: Orchestrator data listener
let waterDataReadyHandler = null; // FIX: Handler for myio:water-data-ready from MAIN
let MyIO = null;
let hasRequestedInitialData = false; // Flag to prevent duplicate initial requests
let lastProcessedPeriodKey = null; // Track last processed periodKey to prevent duplicate processing
let busyTimeoutId = null; // Timeout ID for busy fallback

// RFC-0094: Widget configuration (from settings) - WATER DOMAIN
let WIDGET_DOMAIN = 'water';

// RFC-0063: Classification mode configuration
let USE_IDENTIFIER_CLASSIFICATION = false; // Flag to enable identifier-based classification
let USE_HYBRID_CLASSIFICATION = false; // Flag to enable hybrid mode (identifier + labels)

/** ===================== STATE ===================== **/
let CLIENT_ID = '';
let CLIENT_SECRET = '';
let CUSTOMER_ING_ID = '';
let MyIOAuth = null;

const STATE = {
  itemsBase: [], // lista autoritativa (TB)
  itemsEnriched: [], // lista com totals + perc
  searchActive: false,
  searchTerm: '',
  selectedIds: /** @type {Set<string> | null} */ (null),
  sortMode: /** @type {'cons_desc'|'cons_asc'|'alpha_asc'|'alpha_desc'} */ ('cons_desc'),
  firstHydrates: 0,
  selectedShoppingIds: [], // RFC-0093: Shopping filter from MENU
};

let hydrating = false;

/** ===================== HELPERS (DOM) ===================== **/
const $root = () => $(self.ctx.$container[0]);
const $list = () => $root().find('#waterStoresList');
const $count = () => $root().find('#waterStoresCount');
const $total = () => $root().find('#waterStoresTotal');
const $modal = () => $root().find('#filterModal');

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
      location.reload();
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
      location.reload();
    }
  }, 1000);
}

function hideGlobalSuccessModal() {
  const $m = $(document.body).find(`#${SUCCESS_MODAL_ID}`);
  if ($m.length) $m.remove();
}

/** ===================== ESCAPE HTML ===================== **/
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
  for (const row of rows) {
    // RFC-0094: Filter by aliasName = 'Todos Hidrometros Lojas'
    const aliasName = row?.datasource?.aliasName || '';
    if (aliasName !== 'Todos Hidrometros Lojas') continue;

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
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
  for (const row of rows) {
    // RFC-0094: Filter by aliasName = 'Todos Hidrometros Lojas'
    const aliasName = row?.datasource?.aliasName || '';
    if (aliasName !== 'Todos Hidrometros Lojas') continue;

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
  // RFC-0094: Filter datasources by aliasName = 'Todos Hidrometros Lojas'
  const filteredDatasources = (self.ctx.datasources || []).filter(
    (ds) => ds.aliasName === 'Todos Hidrometros Lojas'
  );
  const filteredData = (self.ctx.data || []).filter(
    (d) => d?.datasource?.aliasName === 'Todos Hidrometros Lojas'
  );

  LogHelper.log(`[WATER_STORES] buildAuthoritativeItems: Filtered ${filteredDatasources.length} datasources, ${filteredData.length} data rows for 'Todos Hidrometros Lojas'`);

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

  LogHelper.log(`[WATER_STORES] buildAuthoritativeItems: Built ${mapped.length} water meter items`);
  return mapped;
}

function enrichItemsWithTotals(items, apiMap) {
  return items.map((it) => {
    let raw = 0;
    let cachedCustomerId = null; // Variável para guardar o ID vindo da API

    if (it.ingestionId && isValidUUID(it.ingestionId)) {
      const row = apiMap.get(String(it.ingestionId));
      
      // 1. Recupera o valor
      raw = Number(row?.total_value ?? 0);
      
      // 2. FIX: Tenta recuperar o customerId do cache se disponível
      // A API pode retornar como 'customerId' ou 'customer_id' dependendo do endpoint
      cachedCustomerId = row?.customerId || row?.customer_id || null;
    }

    const value = Number(raw || 0);

    // 3. FIX: Prioriza o ID que já existia (TB), senão usa o do Cache (API)
    const finalCustomerId = it.customerId || cachedCustomerId;

    return { 
        ...it, 
        value, 
        perc: 0,
        customerId: finalCustomerId // Atualiza o objeto com o ID encontrado
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
      `[WATER_STORES] Shopping filter applied: ${before} -> ${v.length} devices (${before - v.length} filtered out)`
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
 * Update water stores statistics header (Conectividade, Total, etc)
 * RFC-0094: Aligned with STORES/EQUIPMENTS logic for consistent stats
 * @param {Array} stores - Array of store items to calculate stats from
 */
function updateWaterStoresStats(stores) {
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

  // RFC-0094: Calculate connectivity from connectionStatus (same as STORES)
  let onlineCount = 0;
  let totalWithStatus = 0;
  let totalConsumption = 0;
  let zeroConsumptionCount = 0;

  stores.forEach((store) => {
    // Connectivity: based on connectionStatus, not consumption
    const status = (store.connectionStatus || '').toLowerCase();
    if (status) {
      totalWithStatus++;
      if (status === 'online') {
        onlineCount++;
      }
    }

    // Consumption calculation
    const consumption = Number(store.value) || Number(store.val) || 0;
    totalConsumption += consumption;

    if (consumption === 0) {
      zeroConsumptionCount++;
    }
  });

  // If no connectionStatus available, fallback to total count
  if (totalWithStatus === 0) {
    totalWithStatus = stores.length;
  }

  // Calculate connectivity percentage
  const connectivityPercentage =
    totalWithStatus > 0 ? ((onlineCount / totalWithStatus) * 100).toFixed(1) : '0.0';

  // Update UI - RFC-0094: Use M³ formatting for water domain
  connectivityEl.textContent = `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`;
  totalEl.textContent = stores.length.toString();
  consumptionEl.textContent = MyIO.formatWaterVolumeM3(totalConsumption);
  zeroEl.textContent = zeroConsumptionCount.toString();

  LogHelper.log('[WATER_STORES] Stats updated:', {
    connectivity: `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`,
    total: stores.length,
    consumption: totalConsumption,
    zeroCount: zeroConsumptionCount,
  });
}

/**
 * RFC-0094: Render list of water meter cards
 * Follows STORES pattern with renderCardComponentHeadOffice
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

    // RFC-0094: Calculate device status using STORES pattern
    let deviceStatus = 'power_off';
    if (it.connectionStatus) {
      const status = mapConnectionStatus(it.connectionStatus);
      deviceStatus = status === 'online' ? 'power_on' : 'power_off';
    } else if (valNum > 0) {
      deviceStatus = 'power_on';
    }

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

    // RFC-0094: Build entity object following STORES pattern
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
      val: valNum,
      value: valNum,
      lastValue: valNum,
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
      lastDisconnectTime: it.lastDisconnectTime || 0,
      lastConnectTime: it.lastConnectTime || 0,
      lastActivityTime: it.timeVal || null,
      instantaneousPower: 0, // Not applicable for water meters
      operationHours: operationHoursFormatted, // RFC-0094: Calculated from lastConnectTime
      temperatureC: 0,
      mapInstantaneousPower: MAP_INSTANTANEOUS_POWER,
      deviceMapInstaneousPower: it.deviceMapInstaneousPower || null,
    };
    

    // RFC-0094: Use renderCardComponentHeadOffice like STORES
    const handle = MyIOLibrary.renderCardComponentHeadOffice(container, {
      entityObject: entityObject,
      delayTimeConnectionInMins: window.MyIOUtils?.getDelayTimeConnectionInMins?.() ?? 60,

      handleClickCard: (ev, entity) => {
        console.log(`[WATER_STORES] Card clicked: ${entity.name}`);
      },

      handleActionDashboard: async () => {
        console.log('[WATER_STORES] [RFC-0094] Opening water dashboard for:', entityObject.entityId);
        try {
          if (typeof MyIOLibrary.openDashboardPopupEnergy !== 'function') {
            alert('Dashboard component não disponível');
            return;
          }
          const startDate = self.ctx.scope?.startDateISO;
          const endDate = self.ctx.scope?.endDateISO;
          if (!startDate || !endDate) {
            alert('Período de datas não definido.');
            return;
          }
          if (!MyIOAuth || typeof MyIOAuth.getToken !== 'function') {
            LogHelper.error('[WATER_STORES] MyIOAuth not available');
            alert('Autenticação não disponível. Recarregue a página.');
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
          alert('Erro ao abrir dashboard');
        }
      },

      handleActionReport: async () => {
        try {
          if (!MyIOAuth || typeof MyIOAuth.getToken !== 'function') {
            LogHelper.error('[WATER_STORES] MyIOAuth not available for report');
            alert('Autenticação não disponível. Recarregue a página.');
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
          alert('Erro ao abrir relatório');
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
          alert('ID inválido');
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

      useNewComponents: true,
      enableSelection: true,
      enableDragDrop: true,
      hideInfoMenuItem: true,
    });
  }

  console.log(`[WATER_STORES] Rendered ${visible.length} water meter cards`);
}

/** ===================== UI BINDINGS ===================== **/
/**
 * RFC-0094: Search and filter button events are now handled by buildHeaderDevicesGrid
 * This function is kept for backwards compatibility but the main logic is in the header controller
 */
function bindHeader() {
  // RFC-0094: Events are now managed by waterStoresHeaderController in onInit
  LogHelper.log('[WATER_STORES] bindHeader - events managed by header controller');
}

// ============================================
// RFC-0094: WATER_STORES FILTER MODAL (using shared factory from MAIN)
// ============================================

// Helper function to get store consumption value
function getStoreConsumption(store) {
  return Number(store.value) || Number(store.consumption) || Number(store.val) || 0;
}

// Helper function to get store status (for filter tabs)
function getStoreStatus(store) {
  return (store.deviceStatus || '').toLowerCase();
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
    filterTabs: [
      { id: 'all', label: 'Todos', filter: () => true },
      { id: 'online', label: 'Online', filter: (s) => !['offline', 'no_info'].includes(getStoreStatus(s)) },
      { id: 'offline', label: 'Offline', filter: (s) => ['offline', 'no_info'].includes(getStoreStatus(s)) },
      { id: 'withConsumption', label: 'Com Consumo', filter: (s) => getStoreConsumption(s) > 0 },
      { id: 'noConsumption', label: 'Sem Consumo', filter: (s) => getStoreConsumption(s) === 0 },
    ],

    // Data accessors
    getItemId: (store) => store.id,
    getItemLabel: (store) => store.label || store.identifier || store.id,
    getItemValue: getStoreConsumption,
    getItemSubLabel: (store) => getCustomerNameForDevice(store),
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

  // Open with current stores and state
  waterStoresFilterModal.open(items, {
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
  const { visible: withPerc, groupSum } = recomputePercentages(visible);
  await renderList(withPerc);

  // RFC-0094: Update stats header via centralized controller
  if (STATE.itemsEnriched && STATE.itemsEnriched.length > 0) {
    if (waterStoresHeaderController) {
      waterStoresHeaderController.updateFromDevices(STATE.itemsEnriched, {});
    } else {
      updateWaterStoresStats(STATE.itemsEnriched);
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
      LogHelper.warn('[WATER_STORES] Auth timeout waiting for credentials');
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
  const url = new URL(`${getDataApiHost()}/api/v1/telemetry/customers/${CUSTOMER_ING_ID}/water/devices/totals`);
  url.searchParams.set('startTime', toSpOffsetNoMs(startISO));
  url.searchParams.set('endTime', toSpOffsetNoMs(endISO, true));
  url.searchParams.set('deep', '1');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    LogHelper.warn('[WATER_STORES] API fetch failed:', res.status);
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
      LogHelper.warn('[WATER_STORES] Aguardando intervalo de datas (startDateISO/endDateISO).');
      return;
    }

    // 1) Auth
    const okAuth = await ensureAuthReady(6000, 150);
    if (!okAuth) {
      LogHelper.warn('[WATER_STORES] Auth not ready; adiando hidratação.');
      return;
    }

    // 2) Lista autoritativa
    STATE.itemsBase = buildAuthoritativeItems();

    // 3) Totais na API
    let apiMap = new Map();
    try {
      apiMap = await fetchApiTotals(range.startISO, range.endISO);
    } catch (err) {
      LogHelper.error('[WATER_STORES] API error:', err);
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
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  });

  MyIO = (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) ||
    (typeof window !== 'undefined' && window.MyIOLibrary) || {
      showAlert: function () {
        alert('A Biblioteca Myio não foi carregada corretamente!');
      },
    };

  // RFC-0094: Set widget configuration from settings FIRST - WATER DOMAIN
  WIDGET_DOMAIN = self.ctx.settings?.DOMAIN || 'water';
  LogHelper.log(`[WATER_STORES] Configured EARLY: domain=${WIDGET_DOMAIN}`);

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

  // RFC-0042: Request data from orchestrator (defined early for use in handlers)
  function requestDataFromOrchestrator() {
    if (!self.ctx.scope?.startDateISO || !self.ctx.scope?.endDateISO) {
      LogHelper.warn('[WATER_STORES] No date range set, cannot request data');
      return;
    }

    const period = {
      startISO: self.ctx.scope.startDateISO,
      endISO: self.ctx.scope.endDateISO,
      granularity: window.calcGranularity
        ? window.calcGranularity(self.ctx.scope.startDateISO, self.ctx.scope.endDateISO)
        : 'day',
      tz: 'America/Sao_Paulo',
    };

    LogHelper.log(`[WATER_STORES] Requesting data for domain=${WIDGET_DOMAIN}, period:`, period);

    window.dispatchEvent(
      new CustomEvent('myio:telemetry:request-data', {
        detail: { domain: WIDGET_DOMAIN, period },
      })
    );
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

      hydrateAndRender();
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
    LogHelper.log('[WATER_STORES] 🔄 Applying pre-existing filter:', window.custumersSelected.length, 'shoppings');
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

  let pendingProvideData = null;

  dataProvideHandler = function (ev) {
    LogHelper.log(
      `[WATER_STORES ${WIDGET_DOMAIN}] 📦 Received provide-data event for domain ${
        ev.detail.domain
      }, periodKey: ${ev.detail.periodKey}, items: ${ev.detail.items?.length || 0}`
    );
    const { domain, periodKey, items } = ev.detail;

    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(
        `[WATER_STORES ${WIDGET_DOMAIN}] ⏭️ Ignoring event for domain ${domain}, my domain is ${WIDGET_DOMAIN}`
      );
      return;
    }

    if (lastProcessedPeriodKey === periodKey) {
      LogHelper.log(`[WATER_STORES] ⏭️ Skipping duplicate provide-data for periodKey: ${periodKey}`);
      return;
    }

    const myPeriod = {
      startISO: self.ctx.scope?.startDateISO,
      endISO: self.ctx.scope?.endDateISO,
    };

    if (!myPeriod.startISO || !myPeriod.endISO) {
      LogHelper.warn(`[WATER_STORES] ⏸️ Period not set yet, storing provide-data event for later processing`);
      pendingProvideData = { domain, periodKey, items };
      return;
    }

    lastProcessedPeriodKey = periodKey;

    LogHelper.log(`[WATER_STORES] 🔄 Processing data from orchestrator...`);
    LogHelper.log(`[WATER_STORES] Received ${items.length} items from orchestrator for domain ${domain}`);

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

    STATE.itemsEnriched = STATE.itemsBase.map((tbItem) => {
      const orchestratorValue = orchestratorValues.get(tbItem.ingestionId);

      return {
        ...tbItem,
        value: orchestratorValue !== undefined ? orchestratorValue : tbItem.value || 0,
        perc: 0,
      };
    });

    LogHelper.log(`[WATER_STORES] Enriched ${STATE.itemsEnriched.length} items with orchestrator values`);

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
   * RFC-0094: Only extracts from 'Todos Hidrometros Lojas' alias
   */
  function extractDatasourceIds(datasources) {
    const ingestionIds = new Set();
    const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];

    for (const row of rows) {
      // RFC-0094: Filter by aliasName = 'Todos Hidrometros Lojas'
      const aliasName = row?.datasource?.aliasName || '';
      if (aliasName !== 'Todos Hidrometros Lojas') continue;

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
    const { cache, totalDevices, fromCache } = ev.detail || {};

    // Only process if cache is a Map with data
    if (!(cache instanceof Map) || cache.size === 0) {
      LogHelper.log('[WATER_STORES] Ignoring water-data-ready: no cache or empty');
      return;
    }

    LogHelper.log(`[WATER_STORES] 📦 Received water-data-ready: ${cache.size} devices (fromCache: ${fromCache})`);

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

  const hasData = Array.isArray(self.ctx.data) && self.ctx.data.length > 0;
  LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] onInit - Waiting for orchestrator data...`);

  if (hasData && (!STATE.itemsBase || STATE.itemsBase.length === 0)) {
    LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] Building itemsBase from TB data in onInit...`);
    STATE.itemsBase = buildAuthoritativeItems();
    LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] Built ${STATE.itemsBase.length} items from TB`);

    STATE.itemsEnriched = STATE.itemsBase.map((item) => ({
      ...item,
      value: 0,
      perc: 0,
    }));
    reflowFromState();
  }

  if (self.ctx?.scope?.startDateISO && self.ctx?.scope?.endDateISO) {
    LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] Initial period defined, showing busy...`);
    showBusy();
  } else {
    LogHelper.log(`[WATER_STORES ${WIDGET_DOMAIN}] No initial period, waiting for myio:update-date event...`);
  }

  if (hasData) {
    STATE.firstHydrates++;
    if (STATE.firstHydrates <= MAX_FIRST_HYDRATES) {
      await hydrateAndRender();
    }
  } else {
    const waiter = setInterval(async () => {
      if (Array.isArray(self.ctx.data) && self.ctx.data.length > 0) {
        clearInterval(waiter);
        STATE.firstHydrates++;
        if (STATE.firstHydrates <= MAX_FIRST_HYDRATES) await hydrateAndRender();
      }
    }, 200);
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
