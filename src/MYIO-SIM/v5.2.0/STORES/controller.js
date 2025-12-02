/* =========================================================================
 * ThingsBoard Widget: Device Cards with Totals & Percentages (MyIO)
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
    console.error('[STORES] getDataApiHost not available - MAIN widget not loaded');
    return localStorage.getItem('__MYIO_DATA_API_HOST__') || 'https://api.data.apps.myio-bas.com';
  });

// RFC-0071: Device Profile functions (from MAIN)
const fetchDeviceProfiles =
  window.MyIOUtils?.fetchDeviceProfiles ||
  (() => {
    console.error('[STORES] fetchDeviceProfiles not available - MAIN widget not loaded');
    return Promise.resolve(new Map());
  });

const fetchDeviceDetails =
  window.MyIOUtils?.fetchDeviceDetails ||
  (() => {
    console.error('[STORES] fetchDeviceDetails not available - MAIN widget not loaded');
    return Promise.resolve({});
  });

const addDeviceProfileAttribute =
  window.MyIOUtils?.addDeviceProfileAttribute ||
  (() => {
    console.error('[STORES] addDeviceProfileAttribute not available - MAIN widget not loaded');
    return Promise.resolve({ ok: false, status: 0, data: null });
  });

const syncDeviceProfileAttributes =
  window.MyIOUtils?.syncDeviceProfileAttributes ||
  (() => {
    console.error('[STORES] syncDeviceProfileAttributes not available - MAIN widget not loaded');
    return Promise.resolve({ synced: 0, skipped: 0, errors: 0 });
  });

// RFC-0090: UI Helper from MAIN (replaces local getCustomerNameForDevice)
const getCustomerNameForDevice =
  window.MyIOUtils?.getCustomerNameForDevice ||
  ((device) => {
    console.error('[STORES] getCustomerNameForDevice not available - MAIN widget not loaded');
    return device?.customerId ? `ID: ${device.customerId.substring(0, 8)}...` : 'N/A';
  });

// RFC-0091: Device status calculation functions from MAIN
const getConsumptionRangesHierarchical = window.MyIOUtils?.getConsumptionRangesHierarchical;
const mapConnectionStatus = window.MyIOUtils?.mapConnectionStatus || ((status) => status || 'offline');

// RFC-0091: formatarDuracao for operationHours calculation (from MAIN)
const formatarDuracao = window.MyIOUtils?.formatarDuracao || ((ms) => `${Math.round(ms / 1000)}s`);

// RFC-0091: Global MAP_INSTANTANEOUS_POWER (will be loaded from settings if available)
let MAP_INSTANTANEOUS_POWER = null;

LogHelper.log('🚀 [STORES] Controller loaded - VERSION WITH ORCHESTRATOR SUPPORT');

const MAX_FIRST_HYDRATES = 1;

let __deviceProfileSyncComplete = false;

// RFC-0093: Centralized header controller
let storesHeaderController = null;

// RFC-0090: getData REMOVED - was defined but never used in STORES

let dateUpdateHandler = null;
let dataProvideHandler = null; // RFC-0042: Orchestrator data listener
//let DEVICE_TYPE = "energy";
let MyIO = null;
let hasRequestedInitialData = false; // Flag to prevent duplicate initial requests
let lastProcessedPeriodKey = null; // Track last processed periodKey to prevent duplicate processing
let busyTimeoutId = null; // Timeout ID for busy fallback

// RFC-0042: Widget configuration (from settings)
let WIDGET_DOMAIN = 'energy'; // Will be set in onInit

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
const $list = () => $root().find('#shopsList');
const $count = () => $root().find('#shopsCount');
const $total = () => $root().find('#shopsTotal');
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
  LogHelper.log(`[TELEMETRY] 🔄 showBusy() called with message: "${message || 'default'}"`);

  // Prevent multiple simultaneous busy calls
  if (window.busyInProgress) {
    LogHelper.log(`[TELEMETRY] ⏭️ Skipping duplicate showBusy() call`);
    return;
  }

  window.busyInProgress = true;

  // Centralized busy with enhanced synchronization
  const safeShowBusy = () => {
    try {
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.showGlobalBusy === 'function') {
        const text = (message && String(message).trim()) || 'Carregando dados...';
        window.MyIOOrchestrator.showGlobalBusy(WIDGET_DOMAIN, text, timeoutMs);
        LogHelper.log(`[TELEMETRY] ✅ Using centralized busy for domain: ${WIDGET_DOMAIN}`);
      } else {
        LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator not available, using fallback busy`);
        const $m = ensureBusyModalDOM();
        const text = (message && String(message).trim()) || 'aguarde.. carregando os dados...';
        $m.find(`#${BUSY_ID}-msg`).text(text);
        $m.css('display', 'flex');
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY] ❌ Error in showBusy:`, err);
    } finally {
      // Always reset busy flag after a short delay
      setTimeout(() => {
        window.busyInProgress = false;
      }, 500);
    }
  };
}

function hideBusy() {
  LogHelper.log(`[TELEMETRY] ⏸️ hideBusy() called`);

  const safeHideBusy = () => {
    try {
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.hideGlobalBusy === 'function') {
        window.MyIOOrchestrator.hideGlobalBusy();
        LogHelper.log(`[TELEMETRY] ✅ Using centralized hideBusy`);
      } else {
        LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator not available, using fallback hideBusy`);
        $root().find(`#${BUSY_ID}`).css('display', 'none');
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY] ❌ Error in hideBusy:`, err);
    } finally {
      window.busyInProgress = false;
    }
  };

  // RFC-0051.3: Check if orchestrator exists and is ready
  const checkOrchestratorReady = async () => {
    // First, check if orchestrator exists and is ready
    if (window.MyIOOrchestrator?.isReady) {
      safeHideBusy();
      return;
    }

    // Wait for orchestrator ready event (with timeout)
    const ready = await new Promise((resolve) => {
      let timeout;
      let interval;

      // Listen for ready event
      const handler = () => {
        clearTimeout(timeout);
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        resolve(true);
      };

      window.addEventListener('myio:orchestrator:ready', handler);

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        LogHelper.warn('[TELEMETRY] ⚠️ Orchestrator ready timeout after 5s, using fallback');
        resolve(false);
      }, 5000);

      // Also poll isReady flag (fallback if event is missed)
      interval = setInterval(() => {
        if (window.MyIOOrchestrator?.isReady) {
          clearInterval(interval);
          clearTimeout(timeout);
          window.removeEventListener('myio:orchestrator:ready', handler);
          resolve(true);
        }
      }, 100);
    });

    safeHideBusy();
  };

  checkOrchestratorReady();
}

// RFC-0090: findValue REMOVED - was defined but never used in STORES

/** ===================== GLOBAL SUCCESS MODAL (fora do widget) ===================== **/
const G_SUCCESS_ID = 'myio-global-success-modal';
let gSuccessTimer = null;

function ensureGlobalSuccessModalDOM() {
  let el = document.getElementById(G_SUCCESS_ID);
  if (el) return el;

  const wrapper = document.createElement('div');
  wrapper.id = G_SUCCESS_ID;
  wrapper.setAttribute(
    'style',
    `
    position: fixed; inset: 0; display: none;
    z-index: 999999; 
    background: rgba(150,132,181,0.45); /* #9684B5 com transparência */
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  `
  );

  // container central
  const center = document.createElement('div');
  center.setAttribute(
    'style',
    `
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: #2d1458; color: #fff;
    border-radius: 20px; padding: 26px 30px; min-width: 360px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 14px 44px rgba(0,0,0,.35);
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;
    text-align: center;
  `
  );

  const icon = document.createElement('div');
  icon.innerHTML = `
    <div style="
      width:56px;height:56px;margin:0 auto 10px auto;border-radius:50%;
      background: rgba(255,255,255,.12); display:flex;align-items:center;justify-content:center;
      ">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17L4 12" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;

  const title = document.createElement('div');
  title.id = `${G_SUCCESS_ID}-title`;
  title.textContent = 'os dados foram salvos com sucesso';
  title.setAttribute('style', `font-size:16px;font-weight:700;letter-spacing:.2px;margin-bottom:6px;`);

  const sub = document.createElement('div');
  sub.id = `${G_SUCCESS_ID}-sub`;
  sub.innerHTML = `recarregando em <b id="${G_SUCCESS_ID}-count">6</b>s...`;
  sub.setAttribute('style', `opacity:.9;font-size:13px;`);

  center.appendChild(icon);
  center.appendChild(title);
  center.appendChild(sub);
  wrapper.appendChild(center);
  document.body.appendChild(wrapper);
  return wrapper;
}

function showGlobalSuccessModal(seconds = 6) {
  const el = ensureGlobalSuccessModalDOM();
  // reset contador
  const countEl = el.querySelector(`#${G_SUCCESS_ID}-count`);
  if (countEl) countEl.textContent = String(seconds);

  el.style.display = 'block';

  if (gSuccessTimer) {
    clearInterval(gSuccessTimer);
    gSuccessTimer = null;
  }

  let left = seconds;
  gSuccessTimer = setInterval(() => {
    left -= 1;
    if (countEl) countEl.textContent = String(left);
    if (left <= 0) {
      clearInterval(gSuccessTimer);
      gSuccessTimer = null;
      try {
        window.location.reload();
      } catch (_e) {
        /* ignore reload errors */
      }
    }
  }, 1000);
}

function hideGlobalSuccessModal() {
  const el = document.getElementById(G_SUCCESS_ID);
  if (el) el.style.display = 'none';
  if (gSuccessTimer) {
    clearInterval(gSuccessTimer);
    gSuccessTimer = null;
  }
}

/** ===================== UTILS ===================== **/
// RFC-0090: escapeHtml REMOVED - was defined but never used in STORES
// RFC-0090: toSpOffsetNoMs REMOVED - was defined but never used in STORES (no longer calling fetchApiTotals)

function isValidUUID(v) {
  if (!v || typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function mustGetDateRange() {
  const s = self.ctx?.scope?.startDateISO;
  const e = self.ctx?.scope?.endDateISO;

  if (s && e) return { startISO: s, endISO: e };
  throw new Error('DATE_RANGE_REQUIRED');
}

const isAuthReady = () => !!(MyIOAuth && typeof MyIOAuth.getToken === 'function');
async function ensureAuthReady(maxMs = 6000, stepMs = 150) {
  const start = Date.now();

  while (!isAuthReady()) {
    if (Date.now() - start > maxMs) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }

  return true;
}

/** ===================== TB INDEXES ===================== **/
function buildTbAttrIndex() {
  // RFC-0091: Extended to include deviceMapInstaneousPower, lastDisconnectTime, customerId, connectionStatus
  const byTbId = new Map(); // tbId -> { slaveId, centralId, deviceType, centralName, lastConnectTime, lastActivityTime, ... }
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];

  for (const row of rows) {
    const key = String(row?.dataKey?.name || '').toLowerCase();
    const tbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val = row?.data?.[0]?.[1];

    if (!tbId || val == null) continue;
    if (!byTbId.has(tbId))
      byTbId.set(tbId, {
        slaveId: null,
        centralId: null,
        deviceType: null,
        deviceProfile: null,
        centralName: null,
        lastConnectTime: null,
        lastActivityTime: null,
        // RFC-0091: Added for proper deviceStatus calculation
        lastDisconnectTime: null,
        deviceMapInstaneousPower: null,
        customerId: null,
        connectionStatus: null,
        consumption_power: null, // Instantaneous power
      });

    const slot = byTbId.get(tbId);

    if (key === 'slaveid') slot.slaveId = val;
    if (key === 'centralid') slot.centralId = val;
    if (key === 'devicetype') slot.deviceType = val;
    if (key === 'deviceprofile') slot.deviceProfile = val;
    if (key === 'centralname') slot.centralName = val;
    if (key === 'lastconnecttime') slot.lastConnectTime = val;
    if (key === 'lastactivitytime') slot.lastActivityTime = val;
    // RFC-0091: New attributes for proper deviceStatus calculation
    if (key === 'lastdisconnecttime') slot.lastDisconnectTime = val;
    if (key === 'devicemapinstaneouspower') slot.deviceMapInstaneousPower = val;
    if (key === 'customerid') slot.customerId = val;
    if (key === 'connectionstatus') slot.connectionStatus = val;
    if (key === 'consumption_power') slot.consumption_power = val;
  }
  return byTbId;
}
function buildTbIdIndexes() {
  const byIdentifier = new Map(); // identifier -> tbId
  const byIngestion = new Map(); // ingestionId -> tbId

  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
  for (const row of rows) {
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
  // items da LIB: [{ id: ingestionId, identifier, label }, ...]
  const base = MyIO.buildListItemsThingsboardByUniqueDatasource(self.ctx.datasources, self.ctx.data) || [];
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
    const deviceProfile = attrs.deviceProfile || 'N/D';
    let deviceTypeToDisplay = attrs.deviceType || '3F_MEDIDOR';

    if (deviceTypeToDisplay === '3F_MEDIDOR' && deviceProfile !== 'N/D') {
      deviceTypeToDisplay = deviceProfile;
    }

    // RFC-0093: Get customerId with fallback to global map or Orchestrator cache
    let customerId = attrs.customerId ?? null;

    // Fallback 1: Try global device-to-shopping map (populated by EQUIPMENTS)
    if (!customerId && ingestionId && window.myioDeviceToShoppingMap) {
      customerId = window.myioDeviceToShoppingMap.get(ingestionId) || null;
    }

    // Fallback 2: Try Orchestrator energy cache
    if (!customerId && ingestionId && window.MyIOOrchestrator?.getEnergyCache) {
      const energyCache = window.MyIOOrchestrator.getEnergyCache();
      if (energyCache && energyCache.has(ingestionId)) {
        customerId = energyCache.get(ingestionId).customerId || null;
      }
    }

    // Populate global map for other widgets to use
    if (ingestionId && customerId) {
      if (!window.myioDeviceToShoppingMap) {
        window.myioDeviceToShoppingMap = new Map();
      }
      window.myioDeviceToShoppingMap.set(ingestionId, customerId);
    }

    return {
      id: tbId || ingestionId, // para seleção/toggle
      tbId, // ThingsBoard deviceId (Settings)
      ingestionId, // join key API (totals/Report)
      identifier: r.identifier,
      label: r.label,
      slaveId: attrs.slaveId ?? null,
      centralId: attrs.centralId ?? null,
      centralName: attrs.centralName ?? null,
      deviceType: deviceTypeToDisplay,
      deviceProfile: deviceProfile, // RFC-0091: Added for Settings
      updatedIdentifiers: {},
      connectionStatusTime: attrs.lastConnectTime ?? null,
      timeVal: attrs.lastActivityTime ?? null,
      // RFC-0091: Added for proper deviceStatus calculation and Settings
      lastDisconnectTime: attrs.lastDisconnectTime ?? null,
      lastConnectTime: attrs.lastConnectTime ?? null,
      deviceMapInstaneousPower: attrs.deviceMapInstaneousPower ?? null,
      customerId: customerId, // RFC-0093: With fallback from global map or Orchestrator
      connectionStatus: attrs.connectionStatus ?? 'offline',
      consumption_power: attrs.consumption_power ?? null, // Instantaneous power
    };
  });

  return mapped;
}

// RFC-0090: fetchApiTotals REMOVED - now using Orchestrator cache
// The Orchestrator already fetches data once for all widgets,
// so STORES just uses the cached data instead of making redundant API calls

function enrichItemsWithTotals(items, apiMap) {
  return items.map((it) => {
    let raw = 0;

    if (it.ingestionId && isValidUUID(it.ingestionId)) {
      const row = apiMap.get(String(it.ingestionId));
      raw = Number(row?.total_value ?? 0);
    }

    const value = Number(raw || 0);

    return { ...it, value, perc: 0 };
  });
}

/** ===================== FILTERS / SORT / PERC ===================== **/
function applyFilters(enriched, searchTerm, selectedIds, sortMode) {
  let v = enriched.slice();

  // RFC-0093: Apply shopping filter (from MENU) - same logic as EQUIPMENTS
  if (STATE.selectedShoppingIds && STATE.selectedShoppingIds.length > 0) {
    const before = v.length;
    v = v.filter((x) => {
      // If device has no customerId, include it (safety)
      if (!x.customerId) return true;
      // Check if device's customerId is in the selected shoppings
      return STATE.selectedShoppingIds.includes(x.customerId);
    });
    LogHelper.log(
      `[STORES] Shopping filter applied: ${before} -> ${v.length} stores (${before - v.length} filtered out)`
    );
  }

  if (selectedIds && selectedIds.size) {
    v = v.filter((x) => selectedIds.has(x.id));
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

// RFC-0090: getCustomerNameForDevice REMOVED - now using getCustomerNameForDevice from MAIN

/** ===================== RENDER ===================== **/

/**
 * Update stores statistics header (Conectividade, Total de Lojas, etc)
 * RFC-0093: Aligned with EQUIPMENTS/MAIN logic for consistent stats
 * @param {Array} stores - Array of store items to calculate stats from
 */
function updateStoresStats(stores) {
  // Use $root() to find elements within widget scope (not document.getElementById)
  const $widget = $root();
  const connectivityEl = $widget.find('#storesStatsConnectivity')[0];
  const totalEl = $widget.find('#storesStatsTotal')[0];
  const consumptionEl = $widget.find('#storesStatsConsumption')[0];
  const zeroEl = $widget.find('#storesStatsZero')[0];

  if (!connectivityEl || !totalEl || !consumptionEl || !zeroEl) {
    LogHelper.warn('[STORES] Stats header elements not found in widget scope');
    return;
  }

  // RFC-0093: Calculate connectivity from connectionStatus (same as EQUIPMENTS)
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

  // Update UI
  connectivityEl.textContent = `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`;
  totalEl.textContent = stores.length.toString();
  consumptionEl.textContent =
    WIDGET_DOMAIN === 'energy' ? MyIO.formatEnergy(totalConsumption) : totalConsumption.toFixed(2);
  zeroEl.textContent = zeroConsumptionCount.toString();

  LogHelper.log('[STORES] Stats updated:', {
    connectivity: `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`,
    total: stores.length,
    consumption: totalConsumption,
    zeroCount: zeroConsumptionCount,
  });
}

function renderHeader(count, groupSum) {
  $count().text(`(${count})`);

  // Format based on widget domain
  let formattedTotal = groupSum.toFixed(2);
  if (WIDGET_DOMAIN === 'energy') {
    formattedTotal = MyIO.formatEnergy(groupSum);
  } else if (WIDGET_DOMAIN === 'water') {
    formattedTotal = MyIO.formatWaterVolumeM3(groupSum);
  } else if (WIDGET_DOMAIN === 'tank') {
    formattedTotal = MyIO.formatTankHeadFromCm(groupSum);
  }

  $total().text(formattedTotal);
}

async function renderList(visible) {
  const listElement = $list()[0];
  if (!listElement) {
    console.error('[STORES] shopsList element not found via $list()');
    return;
  }

  listElement.innerHTML = '';

  // 1. Carrega índices para garantir UUID do ThingsBoard
  const idx = buildTbIdIndexes();

  // RFC-0091: Process items with async deviceStatus calculation
  for (const it of visible) {
    const container = document.createElement('div');
    listElement.appendChild(container);

    const valNum = Number(it.value || 0);

    // RFC-0091: Proper connectionStatus mapping using MAIN utility
    const rawConnectionStatus = it.connectionStatus || 'offline';
    const mappedConnectionStatus = mapConnectionStatus(rawConnectionStatus);

    // ... (lógica de identifier mantida igual) ...
    let deviceIdentifierToDisplay = 'N/A';
    if (it.identifier) {
      if (String(it.identifier).includes('Sem Identificador identificado')) {
        const label = String(it.label || '').toLowerCase();
        deviceIdentifierToDisplay = label.includes('fancoil') ? 'FANCOIL' : 'CAG';
      } else {
        deviceIdentifierToDisplay = it.identifier;
      }
    } else {
      const label = String(it.label || '').toLowerCase();
      if (label.includes('fancoil')) {
        deviceIdentifierToDisplay = 'FANCOIL';
      } else if (label.includes('cag')) {
        deviceIdentifierToDisplay = 'CAG';
      } else if (label.includes('elevador') || label.includes('elv')) {
        deviceIdentifierToDisplay = 'ELV';
      } else if (label.includes('escada')) {
        deviceIdentifierToDisplay = 'ESC';
      } else {
        deviceIdentifierToDisplay = 'N/A';
      }
    }

    const customerName = getCustomerNameForDevice(it);

    // 2. Resolução Robusta do UUID (TB ID)
    let resolvedTbId = it.tbId;
    if (!resolvedTbId || !isValidUUID(resolvedTbId)) {
      resolvedTbId =
        (it.ingestionId && idx.byIngestion.get(it.ingestionId)) ||
        (it.identifier && idx.byIdentifier.get(it.identifier)) ||
        it.id;
    }

    const deviceType = it.label.includes('dministra') ? '3F_MEDIDOR' : it.deviceType;

    // RFC-0091: Calculate deviceStatus using hierarchical ranges (same as EQUIPMENTS)
    let deviceStatus = mappedConnectionStatus === 'online' ? 'power_on' : 'power_off';

    // Parse deviceMapInstaneousPower if available (TIER 0 - highest priority)
    let deviceMapLimits = null;
    if (it.deviceMapInstaneousPower && typeof it.deviceMapInstaneousPower === 'string') {
      try {
        deviceMapLimits = JSON.parse(it.deviceMapInstaneousPower);
        //LogHelper.log(`[RFC-0091] ✅ Found deviceMapInstaneousPower in ctx.data for ${resolvedTbId}`);
      } catch (e) {
        LogHelper.warn(`[RFC-0091] Failed to parse deviceMapInstaneousPower for ${resolvedTbId}:`, e.message);
      }
    }

    // Get instantaneous power from item data
    const instantaneousPower = Number(it.consumption_power) || null;

    // RFC-0091: Calculate operationHours (same as EQUIPMENTS)
    let operationHoursFormatted = '0s';
    const lastConnectTimestamp = it.lastConnectTime ? Number(it.lastConnectTime) : null;
    if (lastConnectTimestamp) {
      const nowMs = Date.now();
      const durationMs = nowMs - lastConnectTimestamp;
      operationHoursFormatted = formatarDuracao(durationMs > 0 ? durationMs : 0);
    }

    // Calculate deviceStatus using ranges if available
    if (
      getConsumptionRangesHierarchical &&
      typeof MyIOLibrary.calculateDeviceStatusWithRanges === 'function'
    ) {
      try {
        const rangesWithSource = await getConsumptionRangesHierarchical(
          resolvedTbId,
          deviceType,
          deviceMapLimits || window.__customerConsumptionLimits, // TIER 0 (deviceMap) > TIER 2 (customer)
          'consumption',
          null
        );

        // If deviceMapLimits was used, update the source to reflect it
        if (deviceMapLimits && rangesWithSource.source === 'customer') {
          rangesWithSource.source = 'deviceMap';
          rangesWithSource.tier = 0;
          LogHelper.log(`[RFC-0091] Using deviceMapInstaneousPower (TIER 0) for ${resolvedTbId}`);
        }

        // Calculate device status using range-based calculation
        deviceStatus = MyIOLibrary.calculateDeviceStatusWithRanges({
          connectionStatus: mappedConnectionStatus,
          lastConsumptionValue: instantaneousPower,
          ranges: rangesWithSource,
        });
      } catch (e) {
        LogHelper.warn(`[RFC-0091] Failed to calculate deviceStatus for ${resolvedTbId}:`, e.message);
      }
    }

    // 3. Montagem do Objeto idêntico ao widget de Equipamentos
    const entityObject = {
      // Identificadores
      entityId: resolvedTbId,
      id: resolvedTbId, // Crucial para o DragDrop

      // Labels e Nomes
      labelOrName: it.label,
      name: it.label,
      customerName: customerName,
      centralName: it.centralName || 'N/A',
      deviceIdentifier: deviceIdentifierToDisplay,

      // Valores e Tipos
      val: valNum,
      value: valNum,
      lastValue: valNum,
      valType: 'power_kw', // <--- DIFERENÇA 1: Adicionado (igual Equipamentos)
      unit: 'kWh',
      icon: 'energy',
      domain: 'energy',

      // Metadados
      deviceType: deviceType,
      deviceProfile: it.deviceProfile || 'N/D', // RFC-0091: Added for Settings
      deviceStatus: deviceStatus, // RFC-0091: Now properly calculated
      perc: it.perc ?? 0,

      // IDs secundários
      slaveId: it.slaveId || 'N/A',
      ingestionId: it.ingestionId || 'N/A',
      centralId: it.centralId || 'N/A',
      customerId: it.customerId || null, // RFC-0091: Added for Settings

      updatedIdentifiers: it.updatedIdentifiers || {},
      connectionStatusTime: it.connectionStatusTime || Date.now(),
      timeVal: it.timeVal || Date.now(),

      // RFC-0091: Additional data for Settings modal and card display
      lastDisconnectTime: it.lastDisconnectTime || 0,
      lastConnectTime: it.lastConnectTime || 0,
      lastActivityTime: it.timeVal || null,
      instantaneousPower: instantaneousPower, // Potência instantânea (kW)
      operationHours: operationHoursFormatted, // Tempo em operação (formatado)
      temperatureC: 0, // Temperatura (não disponível para lojas)
      mapInstantaneousPower: MAP_INSTANTANEOUS_POWER, // Global map from settings
      deviceMapInstaneousPower: it.deviceMapInstaneousPower || null, // Device-specific map
    };

    // RFC-0091: delayTimeConnectionInMins - configurable via MAIN settings (default 60 minutes)
    const handle = MyIOLibrary.renderCardComponentHeadOffice(container, {
      entityObject: entityObject,
      delayTimeConnectionInMins: window.MyIOUtils?.getDelayTimeConnectionInMins?.() ?? 60,

      // --- DIFERENÇA 2: Callback de clique (mesmo que apenas logue) ---
      // Isso muitas vezes ativa o wrapper interativo do card
      handleClickCard: (ev, entity) => {
        console.log(`[STORES] Card clicked: ${entity.name}`);
      },

      handleActionDashboard: async () => {
        // ... (seu código existente do dashboard mantido igual)
        console.log('[STORES] [RFC-0072] Opening energy dashboard for:', entityObject.entityId);
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
          // RFC-0093: Guard against undefined MyIOAuth
          if (!MyIOAuth || typeof MyIOAuth.getToken !== 'function') {
            LogHelper.error('[STORES] MyIOAuth not available');
            alert('Autenticação não disponível. Recarregue a página.');
            return;
          }
          const tokenIngestionDashBoard = await MyIOAuth.getToken();
          const myTbTokenDashBoard = localStorage.getItem('jwt_token');

          MyIOLibrary.openDashboardPopupEnergy({
            deviceId: entityObject.entityId,
            readingType: 'energy',
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
        // ... (seu código existente do report mantido igual)
        try {
          // RFC-0093: Guard against undefined MyIOAuth
          if (!MyIOAuth || typeof MyIOAuth.getToken !== 'function') {
            LogHelper.error('[STORES] MyIOAuth not available for report');
            alert('Autenticação não disponível. Recarregue a página.');
            return;
          }
          const ingestionToken = await MyIOAuth.getToken();
          await MyIOLibrary.openDashboardPopupReport({
            ingestionId: it.ingestionId,
            identifier: it.identifier,
            label: it.label,
            domain: 'energy',
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
        // RFC-0091: Standardized settings handler following EQUIPMENTS pattern
        const jwt = localStorage.getItem('jwt_token');

        if (!jwt) {
          LogHelper.error('[STORES] [RFC-0091] JWT token not found');
          window.alert('Token de autenticação não encontrado');
          return;
        }

        const tbId = entityObject.entityId;
        if (!tbId || tbId === it.ingestionId) {
          alert('ID inválido');
          return;
        }

        try {
          // RFC-0091: Following exact EQUIPMENTS pattern with all parameters
          await MyIOLibrary.openDashboardPopupSettings({
            deviceId: tbId, // TB deviceId
            label: it.label,
            jwtToken: jwt,
            domain: WIDGET_DOMAIN, // Same as EQUIPMENTS
            deviceType: entityObject.deviceType, // RFC-0091: Pass deviceType for Power Limits feature
            deviceProfile: entityObject.deviceProfile, // RFC-0091: Pass deviceProfile for 3F_MEDIDOR fallback
            customerName: entityObject.customerName, // RFC-0091: Pass shopping name
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
            mapInstantaneousPower: entityObject.mapInstantaneousPower, // RFC-0091: Pass global map if available
            onSaved: (payload) => {
              LogHelper.log('[STORES] [RFC-0091] Settings saved:', payload);
              showGlobalSuccessModal(6);
            },
            onClose: () => {
              $('.myio-settings-modal-overlay').remove();
              const overlay = document.querySelector('.myio-modal-overlay');
              if (overlay) {
                overlay.remove();
              }
              LogHelper.log('[STORES] [RFC-0091] Settings modal closed');
            },
          });
        } catch (e) {
          LogHelper.error('[STORES] [RFC-0091] Error opening settings:', e);
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

  console.log(`[STORES] Rendered ${visible.length} store cards`);
}

/** ===================== UI BINDINGS ===================== **/
/**
 * RFC-0093: Search and filter button events are now handled by buildHeaderDevicesGrid
 * This function is kept for backwards compatibility but the main logic is in the header controller
 */
function bindHeader() {
  // RFC-0093: Events are now managed by storesHeaderController in onInit
  LogHelper.log('[STORES] bindHeader - events managed by header controller');
}

// ============================================
// RFC-0090: STORES FILTER MODAL (using shared factory from MAIN)
// ============================================

// Helper function to get store consumption value
function getStoreConsumption(store) {
  return Number(store.value) || Number(store.consumption) || Number(store.val) || 0;
}

// Filter modal instance (lazy initialized)
let storesFilterModal = null;

/**
 * RFC-0090: Initialize filter modal using shared factory from MAIN
 */
function initFilterModal() {
  const createFilterModal = window.MyIOUtils?.createFilterModal;

  if (!createFilterModal) {
    LogHelper.error('[STORES] createFilterModal not available from MAIN');
    return null;
  }

  return createFilterModal({
    widgetName: 'STORES',
    containerId: 'storesFilterModalGlobal',
    modalClass: 'shops-modal',
    primaryColor: '#3E1A7D',
    itemIdAttr: 'data-entity',

    // Filter tabs configuration - specific for STORES (simpler than EQUIPMENTS)
    filterTabs: [
      { id: 'all', label: 'Todos', filter: () => true },
      { id: 'online', label: 'Online', filter: (s) => getStoreConsumption(s) > 0 },
      { id: 'offline', label: 'Offline', filter: (s) => getStoreConsumption(s) === 0 },
      { id: 'withConsumption', label: 'Com Consumo', filter: (s) => getStoreConsumption(s) > 0 },
      { id: 'noConsumption', label: 'Sem Consumo', filter: (s) => getStoreConsumption(s) === 0 },
    ],

    // Data accessors
    getItemId: (store) => store.id,
    getItemLabel: (store) => store.label || store.identifier || store.id,
    getItemValue: getStoreConsumption,
    getItemSubLabel: (store) => getCustomerNameForDevice(store),
    formatValue: (val) => (WIDGET_DOMAIN === 'energy' ? MyIO.formatEnergy(val) : val.toFixed(2)),

    // Callbacks
    onApply: ({ selectedIds, sortMode }) => {
      STATE.selectedIds = selectedIds;
      STATE.sortMode = sortMode;
      reflowFromState();
      LogHelper.log('[STORES] [RFC-0090] Filters applied via shared modal');
    },

    onReset: () => {
      STATE.selectedIds = null;
      STATE.sortMode = 'cons_desc';
      STATE.searchTerm = '';
      STATE.searchActive = false;

      // RFC-0093: Reset UI via header controller
      if (storesHeaderController) {
        const searchInput = storesHeaderController.getSearchInput();
        if (searchInput) searchInput.value = '';
        storesHeaderController.toggleSearch(false);
      }

      reflowFromState();
      LogHelper.log('[STORES] [RFC-0090] Filters reset via shared modal');
    },

    onClose: () => {
      LogHelper.log('[STORES] [RFC-0090] Filter modal closed');
    },
  });
}

/**
 * RFC-0090: Open filter modal
 */
function openFilterModal() {
  // Lazy initialize modal
  if (!storesFilterModal) {
    storesFilterModal = initFilterModal();
  }

  if (!storesFilterModal) {
    LogHelper.error('[STORES] Failed to initialize filter modal');
    window.alert('Erro ao inicializar modal de filtros. Verifique se o widget MAIN foi carregado.');
    return;
  }

  // Use itemsEnriched if available (has consumption values), otherwise itemsBase
  const items =
    STATE.itemsEnriched && STATE.itemsEnriched.length > 0 ? STATE.itemsEnriched : STATE.itemsBase || [];

  // Open with current stores and state
  storesFilterModal.open(items, {
    selectedIds: STATE.selectedIds,
    sortMode: STATE.sortMode,
  });
}

/**
 * RFC-0090: Close filter modal (for backward compatibility)
 */
function closeFilterModal() {
  if (storesFilterModal) {
    storesFilterModal.close();
  }
}

function bindModal() {
  // RFC-0090: Modal is now handled by shared factory, but keep legacy bindings for fallback
  $root().on('click', '#closeFilter', closeFilterModal);

  $root().on('click', '#selectAll', (ev) => {
    ev.preventDefault();
    $modal().find('.check-item input[type="checkbox"]').prop('checked', true);
    syncChecklistSelectionVisual();
  });

  $root().on('click', '#clearAll', (ev) => {
    ev.preventDefault();
    $modal().find('.check-item input[type="checkbox"]').prop('checked', false);
    syncChecklistSelectionVisual();
  });

  $root().on('click', '#resetFilters', (ev) => {
    ev.preventDefault();
    STATE.selectedIds = null;
    STATE.sortMode = 'cons_desc';
    $modal().find('.check-item input[type="checkbox"]').prop('checked', true);
    $modal().find('input[name="sortMode"][value="cons_desc"]').prop('checked', true);
    syncChecklistSelectionVisual();
    reflowFromState();
  });

  $root().on('click', '#applyFilters', (ev) => {
    ev.preventDefault();
    const set = new Set();
    $modal()
      .find('.check-item input[type="checkbox"]:checked')
      .each((_, el) => {
        const id = $(el).data('entity');
        if (id) set.add(id);
      });

    STATE.selectedIds = set.size === 0 || set.size === STATE.itemsBase.length ? null : set;
    STATE.sortMode = String($modal().find('input[name="sortMode"]:checked').val() || 'cons_desc');

    reflowFromState();
    closeFilterModal();
  });

  $root().on('input', '#filterDeviceSearch', (ev) => {
    const q = (ev.target.value || '').trim().toLowerCase();
    $modal()
      .find('.check-item')
      .each((_, node) => {
        const txt = $(node).text().trim().toLowerCase();
        $(node).toggle(txt.includes(q));
      });
  });

  $root().on('click', '#filterDeviceClear', (ev) => {
    ev.preventDefault();
    const $inp = $modal().find('#filterDeviceSearch');
    $inp.val('');
    $modal().find('.check-item').show();
    $inp.trigger('focus');
  });

  $root().on('click', '#deviceChecklist .check-item', function (ev) {
    if (ev.target && ev.target.tagName && ev.target.tagName.toLowerCase() === 'input') return;
    ev.preventDefault();
    ev.stopPropagation();
    const $chk = $(this).find('input[type="checkbox"]');
    $chk.prop('checked', !$chk.prop('checked')).trigger('change');
  });

  $root().on('change', '#deviceChecklist input[type="checkbox"]', function () {
    const $wrap = $(this).closest('.check-item');
    const on = this.checked;
    $wrap.toggleClass('selected', on).attr('data-checked', on ? 'true' : 'false');
    $wrap.css(
      on
        ? {
            background: 'rgba(62,26,125,.08)',
            borderColor: '#3E1A7D',
            boxShadow: '0 8px 18px rgba(62,26,125,.15)',
          }
        : {
            background: '#fff',
            borderColor: '#D6E1EC',
            boxShadow: '0 6px 14px rgba(0,0,0,.05)',
          }
    );
  });
}

function syncChecklistSelectionVisual() {
  $modal()
    .find('.check-item')
    .each(function () {
      const $el = $(this);
      const on = $el.find('input[type="checkbox"]').prop('checked');
      $el.toggleClass('selected', on).attr('data-checked', on ? 'true' : 'false');
      $el.css(
        on
          ? {
              background: 'rgba(62,26,125,.08)',
              borderColor: '#3E1A7D',
              boxShadow: '0 8px 18px rgba(62,26,125,.15)',
            }
          : {
              background: '#fff',
              borderColor: '#D6E1EC',
              boxShadow: '0 6px 14px rgba(0,0,0,.05)',
            }
      );
    });
}

/** ===================== RFC-0056 FIX v1.1: EMISSION ===================== **/

/**
 * Normaliza valor de kWh para MWh com 2 decimais
 * @param {number} kWhValue - valor em kWh
 * @returns {number} valor em MWh arredondado
 */
function normalizeToMWh(kWhValue) {
  if (typeof kWhValue !== 'number' || isNaN(kWhValue)) return 0;
  return Math.round((kWhValue / 1000) * 100) / 100;
}

/**
 * Normaliza label de dispositivo para classificação consistente
 * @param {string} str - label do dispositivo
 * @returns {string} label normalizado
 */
function normalizeLabel(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Dispatcher: determina tipo de widget e emite evento apropriado
 * RFC-0056 FIX v1.1: Consolidação em myio:telemetry:update
 */
function emitTelemetryUpdate() {
  try {
    // Determinar tipo de widget pelo datasource alias
    const widgetType = detectWidgetType();

    if (!widgetType) {
      LogHelper.log('[RFC-0056] Widget type not detected - skipping emission');
      return;
    }

    // Construir periodKey a partir do filtro atual
    const periodKey = buildPeriodKey();

    // RFC-0002: Domain-specific emission
    if (WIDGET_DOMAIN === 'water') {
      emitWaterTelemetry(widgetType, periodKey);
    } else {
      // Default: energy domain
      if (widgetType === 'lojas') {
        emitLojasTotal(periodKey);
      } else if (widgetType === 'areacomum') {
        emitAreaComumBreakdown(periodKey);
      }
    }
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitTelemetryUpdate:', err);
  }
}

/**
 * Detecta tipo de widget baseado no datasource alias
 * RFC-0002: Added 'entrada' detection for water domain
 * @returns {'lojas'|'areacomum'|'entrada'|null}
 */
function detectWidgetType() {
  try {
    LogHelper.log('🔍 [detectWidgetType] Iniciando detecção de tipo de widget...');

    const datasources = ctx.datasources || [];
    LogHelper.log(`[detectWidgetType] Total de datasources detectados: ${datasources.length}`);

    if (!datasources.length) {
      LogHelper.warn('[detectWidgetType] Nenhum datasource encontrado em ctx.datasources!');
      return null;
    }

    // Percorrer todos os datasources
    for (let i = 0; i < datasources.length; i++) {
      const ds = datasources[i];
      const alias = (ds.aliasName || '').toString().toLowerCase().trim();

      LogHelper.log(`🔸 [detectWidgetType] Verificando datasource[${i}]`);
      LogHelper.log(`    ↳ aliasName:     ${ds.aliasName || '(vazio)'}`);
      LogHelper.log(`    ↳ entityName:    ${ds.entityName || '(vazio)'}`);
      LogHelper.log(`    ↳ alias normalizado: "${alias}"`);

      if (!alias) {
        LogHelper.warn(`[detectWidgetType] ⚠️ Alias vazio ou indefinido no datasource[${i}].`);
        continue;
      }

      // RFC-0002: Check for entrada (water domain)
      // Use word boundary matching to avoid false positives like "bomba entrada"
      if (/\bentrada\b/.test(alias) || alias === 'entrada' || alias.includes('entrada')) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "entrada" (com base no alias "${alias}")`);
        return 'entrada';
      }

      // Match "lojas" as standalone word or at end of alias
      // AVOID false positives like "Bomba Lojas", "Subestação Lojas"
      // ACCEPT: "lojas", "widget-lojas", "telemetry-lojas", "consumidores lojas"
      if (/\blojas\b/.test(alias) && !/bomba|subesta|entrada|chiller|elevador|escada/i.test(alias)) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "lojas" (com base no alias "${alias}")`);
        return 'lojas';
      }

      // Match area comum with flexible separators
      if (/\barea\s*comum\b/.test(alias) || alias.includes('areacomum') || alias.includes('area_comum')) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "areacomum" (com base no alias "${alias}")`);
        return 'areacomum';
      }
    }

    LogHelper.warn('[detectWidgetType] ⚠️ Nenhum tipo de widget correspondente encontrado.');
    return null;
  } catch (err) {
    LogHelper.error('[detectWidgetType] ❌ Erro durante detecção de tipo de widget:', err);
    return null;
  }
}

/**
 * Constrói periodKey do filtro atual
 * Formato: "YYYY-MM-DD_YYYY-MM-DD" ou "realtime"
 */
function buildPeriodKey() {
  const timewindow = ctx.defaultSubscription?.subscriptionTimewindow;

  if (!timewindow || timewindow.realtimeWindowMs) {
    return 'realtime';
  }

  const startMs = timewindow.fixedWindow?.startTimeMs || Date.now() - 86400000;
  const endMs = timewindow.fixedWindow?.endTimeMs || Date.now();

  const startDate = new Date(startMs).toISOString().split('T')[0];
  const endDate = new Date(endMs).toISOString().split('T')[0];

  return `${startDate}_${endDate}`;
}

/**
 * Emite evento lojas_total
 * RFC-0056 FIX v1.1: TELEMETRY (Lojas) → TELEMETRY_INFO
 */
function emitLojasTotal(periodKey) {
  try {
    // Calcular total de Lojas a partir dos itens enriquecidos
    const lojasTotal = STATE.itemsEnriched.reduce((sum, item) => {
      return sum + (item.value || 0);
    }, 0);

    const totalMWh = normalizeToMWh(lojasTotal);

    const payload = {
      type: 'lojas_total',
      domain: 'energy',
      periodKey: periodKey,
      timestamp: Date.now(),
      source: 'TELEMETRY_Lojas',
      data: {
        total_kWh: lojasTotal,
        total_MWh: totalMWh,
        device_count: STATE.itemsEnriched.length,
      },
    };

    // Cache em sessionStorage
    const cacheKey = `myio:telemetry:lojas_${periodKey}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
      LogHelper.warn('[RFC-0056] sessionStorage write failed:', e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent('myio:telemetry:update', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);
    LogHelper.log(
      `[RFC-0056] ✅ Emitted lojas_total: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices)`
    );
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitLojasTotal:', err);
  }
}

/**
 * RFC-0063: Classify device by identifier attribute
 * @param {string} identifier - Device identifier (e.g., "CAG", "Fancoil", "ELV", etc.)
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'|null}
 */
function classifyDeviceByIdentifier(identifier = '') {
  // RFC-0063: Safe guard against null/undefined/empty
  if (!identifier || identifier === 'N/A' || identifier === 'null' || identifier === 'undefined') {
    return null;
  }

  const id = String(identifier).trim().toUpperCase();

  // Ignore "Sem Identificador identificado" marker
  if (id.includes('SEM IDENTIFICADOR')) {
    return null;
  }

  // Climatização: CAG, Fancoil
  if (id === 'CAG' || id === 'FANCOIL' || id.startsWith('CAG-') || id.startsWith('FANCOIL-')) {
    return 'climatizacao';
  }

  // Elevadores: ELV, Elevador
  if (id === 'ELV' || id === 'ELEVADOR' || id.startsWith('ELV-') || id.startsWith('ELEVADOR-')) {
    return 'elevadores';
  }

  // Escadas Rolantes: ESC, Escada
  if (id === 'ESC' || id === 'ESCADA' || id.startsWith('ESC-') || id.startsWith('ESCADA')) {
    return 'escadas_rolantes';
  }

  // Outros: qualquer outro identifier não reconhecido
  return 'outros';
}

/**
 * RFC-0063: Classify device by label (legacy method)
 * @param {string} label - Device label/name
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDeviceByLabel(label = '') {
  // RFC-0063: Safe guard against null/undefined
  if (!label) {
    return 'outros';
  }

  const normalized = normalizeLabel(label);

  // Climatização patterns
  if (
    normalized.includes('climatizacao') ||
    normalized.includes('hvac') ||
    normalized.includes('ar condicionado') ||
    normalized.includes('chiller') ||
    normalized.includes('bomba cag') ||
    normalized.includes('fancoil') ||
    normalized.includes('casa de máquina ar') ||
    normalized.includes('bomba primaria') ||
    normalized.includes('bomba secundaria') ||
    normalized.includes('bombas condensadoras') ||
    normalized.includes('bombas condensadora') ||
    normalized.includes('bomba condensadora') ||
    normalized.includes('bombas primarias') ||
    normalized.includes('bombas secundarias')
  ) {
    return 'climatizacao';
  }

  // Elevadores patterns
  if (normalized.includes('elevador')) {
    return 'elevadores';
  }

  // Escadas Rolantes patterns
  if (normalized.includes('escada') && normalized.includes('rolante')) {
    return 'escadas_rolantes';
  }

  // Default: outros
  return 'outros';
}

/**
 * RFC-0063: Classify device using configured mode
 * @param {Object} item - Device item with identifier and label
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDevice(item) {
  // RFC-0063: Safe guard - ensure item exists
  if (!item) {
    LogHelper.warn('[RFC-0063] classifyDevice called with null/undefined item');
    return 'outros';
  }

  // Mode 1: Identifier only (new method)
  if (
    (USE_IDENTIFIER_CLASSIFICATION && !USE_HYBRID_CLASSIFICATION) ||
    item.identifier === 'ESCADASROLANTES'
  ) {
    const category = classifyDeviceByIdentifier(item.identifier);
    if (category) {
      LogHelper.log(`[RFC-0063] Device classified by identifier: "${item.identifier}" → ${category}`);
      return category;
    }
    // Fallback to 'outros' if identifier doesn't match any category
    const reason = !item.identifier
      ? 'no identifier attribute'
      : `identifier "${item.identifier}" not recognized`;
    LogHelper.log(`[RFC-0063] Device ${reason} → outros`);
    return 'outros';
  }

  // Mode 2: Hybrid (identifier with label fallback)
  if (USE_IDENTIFIER_CLASSIFICATION && USE_HYBRID_CLASSIFICATION) {
    const categoryByIdentifier = classifyDeviceByIdentifier(item.identifier);
    if (categoryByIdentifier && categoryByIdentifier !== 'outros') {
      LogHelper.log(
        `[RFC-0063 Hybrid] Device classified by identifier: "${item.identifier}" → ${categoryByIdentifier}`
      );
      return categoryByIdentifier;
    }
    // Fallback to label classification
    const categoryByLabel = classifyDeviceByLabel(item.label || item.name);
    const fallbackReason = !item.identifier
      ? 'no identifier'
      : `identifier "${item.identifier}" not recognized`;
    LogHelper.log(
      `[RFC-0063 Hybrid] Device (${fallbackReason}) classified by label fallback: "${item.label}" → ${categoryByLabel}`
    );
    return categoryByLabel;
  }

  // Mode 3: Legacy (label only - default)
  return classifyDeviceByLabel(item.label || item.name);
}

/**
 * Emite evento areacomum_breakdown
 * RFC-0056 FIX v1.1: TELEMETRY (AreaComum) → TELEMETRY_INFO
 * RFC-0063: Enhanced with identifier-based classification
 */
function emitAreaComumBreakdown(periodKey) {
  try {
    LogHelper.log(
      `[RFC-0063] emitAreaComumBreakdown: mode=${
        USE_IDENTIFIER_CLASSIFICATION ? (USE_HYBRID_CLASSIFICATION ? 'HYBRID' : 'IDENTIFIER') : 'LEGACY'
      }`
    );

    // Classificar dispositivos por categoria
    const breakdown = {
      climatizacao: 0,
      elevadores: 0,
      escadas_rolantes: 0,
      outros: 0,
    };

    STATE.itemsEnriched.forEach((item) => {
      const energia = item.value || 0;
      const category = classifyDevice(item);

      breakdown[category] += energia;

      // Debug log for first 5 items
      if (STATE.itemsEnriched.indexOf(item) < 5) {
        LogHelper.log(
          `[RFC-0063] Item classified: id="${item.identifier}", label="${
            item.label
          }" → ${category} (${energia.toFixed(2)} kWh)`
        );
      }
    });

    const payload = {
      type: 'areacomum_breakdown',
      domain: 'energy',
      periodKey: periodKey,
      timestamp: Date.now(),
      source: 'TELEMETRY_AreaComum',
      data: {
        climatizacao_kWh: breakdown.climatizacao,
        climatizacao_MWh: normalizeToMWh(breakdown.climatizacao),
        elevadores_kWh: breakdown.elevadores,
        elevadores_MWh: normalizeToMWh(breakdown.elevadores),
        escadas_rolantes_kWh: breakdown.escadas_rolantes,
        escadas_rolantes_MWh: normalizeToMWh(breakdown.escadas_rolantes),
        outros_kWh: breakdown.outros,
        outros_MWh: normalizeToMWh(breakdown.outros),
        device_count: STATE.itemsEnriched.length,
      },
    };

    // Cache em sessionStorage
    const cacheKey = `myio:telemetry:areacomum_${periodKey}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
      LogHelper.warn('[RFC-0056] sessionStorage write failed:', e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent('myio:telemetry:update', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);

    const totalMWh = normalizeToMWh(
      breakdown.climatizacao + breakdown.elevadores + breakdown.escadas_rolantes + breakdown.outros
    );
    LogHelper.log(
      `[RFC-0056] ✅ Emitted areacomum_breakdown: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices)`
    );
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitAreaComumBreakdown:', err);
  }
}

/**
 * RFC-0002: Emit water telemetry data
 * Emits myio:telemetry:provide-water for TELEMETRY_INFO to consume
 * @param {string} widgetType - 'entrada', 'lojas', or 'areacomum' (detected from alias)
 * @param {string} periodKey - Period identifier
 */
function emitWaterTelemetry(widgetType, periodKey) {
  try {
    // Map widgetType to water context (direct mapping)
    let context = null;
    if (widgetType === 'entrada') {
      context = 'entrada';
    } else if (widgetType === 'lojas') {
      context = 'lojas';
    } else if (widgetType === 'areacomum') {
      context = 'areaComum';
    }

    if (!context) {
      LogHelper.warn(`[RFC-0002 Water] Unknown widget type: ${widgetType}`);
      return;
    }

    // Calculate total in m³
    const totalM3 = STATE.itemsEnriched.reduce((sum, item) => sum + (item.value || 0), 0);

    // Build device list
    const devices = STATE.itemsEnriched.map((item) => ({
      id: item.id || item.entityId || '',
      label: item.label || item.name || '',
      value: item.value || 0,
      deviceType: item.deviceType || 'HIDROMETRO',
    }));

    const payload = {
      context: context,
      domain: 'water',
      total: totalM3,
      devices: devices,
      periodKey: periodKey,
      timestamp: new Date().toISOString(),
    };

    // Dispatch water event
    const event = new CustomEvent('myio:telemetry:provide-water', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);

    LogHelper.log(
      `[RFC-0002 Water] ✅ Emitted water telemetry: context=${context}, total=${totalM3.toFixed(
        2
      )} m³, devices=${devices.length}`
    );
  } catch (err) {
    LogHelper.error('[RFC-0002 Water] Error in emitWaterTelemetry:', err);
  }
}

/** ===================== RECOMPUTE (local only) ===================== **/
async function reflowFromState() {
  const visible = applyFilters(STATE.itemsEnriched, STATE.searchTerm, STATE.selectedIds, STATE.sortMode);
  const { visible: withPerc, groupSum } = recomputePercentages(visible);
  renderHeader(withPerc.length, groupSum);
  await renderList(withPerc); // RFC-0091: renderList is now async

  // RFC-0093: Update stats header via centralized controller
  // Use all enriched items for stats, not just visible/filtered ones
  if (STATE.itemsEnriched && STATE.itemsEnriched.length > 0) {
    if (storesHeaderController) {
      storesHeaderController.updateFromDevices(STATE.itemsEnriched, {});
    } else {
      // Fallback to old function if header controller not available
      updateStoresStats(STATE.itemsEnriched);
    }
  }
}

/** ===================== HYDRATE (end-to-end) ===================== **/
async function hydrateAndRender() {
  if (hydrating) return;
  hydrating = true;

  // Mostra modal durante todo o processo (mensagem fixa)
  showBusy();

  try {
    // 0) Datas: obrigatórias
    let range;
    try {
      range = mustGetDateRange();
    } catch (_e) {
      LogHelper.warn('[STORES] Aguardando intervalo de datas (startDateISO/endDateISO).');
      return;
    }

    // 1) Auth
    const okAuth = await ensureAuthReady(6000, 150);
    if (!okAuth) {
      LogHelper.warn('[STORES] Auth not ready; adiando hidratação.');
      return;
    }

    // 2) Lista autoritativa
    STATE.itemsBase = buildAuthoritativeItems();

    // 3) RFC-0090: Use Orchestrator cache instead of direct API fetch
    // The Orchestrator already fetches data for all widgets, so we just use its cache
    let apiMap = new Map();
    const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;

    if (orchestrator && typeof orchestrator.getCache === 'function') {
      const energyCache = orchestrator.getCache(WIDGET_DOMAIN);
      if (energyCache && energyCache.size > 0) {
        // Convert cache to apiMap format expected by enrichItemsWithTotals
        energyCache.forEach((item, ingestionId) => {
          apiMap.set(ingestionId, {
            id: ingestionId,
            total_value: item.total_value || item.value || 0,
            ...item,
          });
        });
        LogHelper.log(`[STORES] Using ${apiMap.size} items from Orchestrator cache`);
      } else {
        LogHelper.warn('[STORES] Orchestrator cache is empty, waiting for data...');
        // RFC-0093: Show toast to reload page after a delay if still no data
        setTimeout(() => {
          if (apiMap.size === 0) {
            const MyIOToast = MyIOLibrary?.MyIOToast || window.MyIOToast;
            if (MyIOToast) {
              MyIOToast.warning('Dados não carregados. Por favor, recarregue a página.', { duration: 8000 });
            }
          }
        }, 5000); // Wait 5 seconds before showing toast
      }
    } else {
      LogHelper.warn('[STORES] Orchestrator not available, data will come via provide-data event');
    }

    // 4) Enrich + render
    STATE.itemsEnriched = enrichItemsWithTotals(STATE.itemsBase, apiMap);

    // 5) Sanitiza seleção
    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map((x) => x.id));
      const next = new Set([...STATE.selectedIds].filter((id) => valid.has(id)));
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
    overflow: 'auto', // RFC-0093: Changed from 'hidden' to allow vertical scroll
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  });

  MyIO = (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) ||
    (typeof window !== 'undefined' && window.MyIOLibrary) || {
      showAlert: function () {
        alert('A Bliblioteca Myio não foi carregada corretamente!');
      },
    };

  $root().find('#labelWidgetId').text(self.ctx.settings?.labelWidget);

  // RFC-0042: Set widget configuration from settings FIRST
  WIDGET_DOMAIN = self.ctx.settings?.DOMAIN || 'energy';
  LogHelper.log(`[TELEMETRY] Configured EARLY: domain=${WIDGET_DOMAIN}`);

  // RFC-0093: Build centralized header via buildHeaderDevicesGrid
  const buildHeaderDevicesGrid = window.MyIOUtils?.buildHeaderDevicesGrid;
  if (buildHeaderDevicesGrid) {
    storesHeaderController = buildHeaderDevicesGrid({
      container: '#storesHeaderContainer',
      domain: 'stores',
      idPrefix: 'stores',
      labels: {
        total: 'Total de Lojas',
        consumption: 'Consumo Total de Todas Lojas',
      },
      includeSearch: true,
      includeFilter: true,
      onSearchClick: () => {
        STATE.searchActive = !STATE.searchActive;
        if (STATE.searchActive) {
          const input = storesHeaderController?.getSearchInput();
          if (input) setTimeout(() => input.focus(), 100);
        }
      },
      onFilterClick: () => {
        openFilterModal();
      },
    });

    // Setup search input listener
    const searchInput = storesHeaderController?.getSearchInput();
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        STATE.searchTerm = e.target.value || '';
        filterAndRender();
      });
    }

    LogHelper.log('[STORES] RFC-0093: Header built via buildHeaderDevicesGrid');
  } else {
    LogHelper.warn('[STORES] RFC-0093: buildHeaderDevicesGrid not available');
  }

  // RFC-0063: Load classification mode configuration
  USE_IDENTIFIER_CLASSIFICATION = self.ctx.settings?.USE_IDENTIFIER_CLASSIFICATION || false;
  USE_HYBRID_CLASSIFICATION = self.ctx.settings?.USE_HYBRID_CLASSIFICATION || false;
  LogHelper.log(
    `[RFC-0063] Classification mode: ${
      USE_IDENTIFIER_CLASSIFICATION
        ? USE_HYBRID_CLASSIFICATION
          ? 'HYBRID (identifier + label fallback)'
          : 'IDENTIFIER ONLY'
        : 'LEGACY (label only)'
    }`
  );

  // RFC-0042: Request data from orchestrator (defined early for use in handlers)
  function requestDataFromOrchestrator() {
    if (!self.ctx.scope?.startDateISO || !self.ctx.scope?.endDateISO) {
      LogHelper.warn('[TELEMETRY] No date range set, cannot request data');
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

    LogHelper.log(`[TELEMETRY] Requesting data for domain=${WIDGET_DOMAIN}, period:`, period);

    // RFC-0053: Single window context - emit to current window only
    window.dispatchEvent(
      new CustomEvent('myio:telemetry:request-data', {
        detail: { domain: WIDGET_DOMAIN, period },
      })
    );
  }

  dateUpdateHandler = function (ev) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ DATE UPDATE EVENT RECEIVED!`, ev.detail);

    try {
      // Pega as datas do evento (formato antigo ou novo)
      let startISO, endISO;
      if (ev.detail?.period) {
        startISO = ev.detail.period.startISO;
        endISO = ev.detail.period.endISO;
      } else {
        // Fallback para formato antigo
        const { startDate, endDate } = ev.detail || {};
        startISO = new Date(startDate).toISOString();
        endISO = new Date(endDate).toISOString();
      }

      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Date range updated:`, startISO, endISO);

      // Atualiza o scope
      self.ctx.scope = self.ctx.scope || {};
      self.ctx.scope.startDateISO = startISO;
      self.ctx.scope.endDateISO = endISO;

      // CHAMA A FUNÇÃO DE FETCH LOCAL (a que já existe neste widget)
      // Em vez de chamar o orquestrador.
      hydrateAndRender();
    } catch (err) {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] dateUpdateHandler error:`, err);
      hideBusy();
    }
  };

  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 Registering myio:update-date listener...`);
  window.addEventListener('myio:update-date', dateUpdateHandler);
  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ myio:update-date listener registered!`);

  // RFC-0042: Listen for clear event from HEADER (when user clicks "Limpar" button)
  window.addEventListener('myio:telemetry:clear', (ev) => {
    const { domain } = ev.detail;

    // Only clear if it's for my domain
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Ignoring clear event for domain: ${domain}`);
      return;
    }

    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧹 Received clear event - clearing visual content`);

    try {
      // Clear the items list
      STATE.itemsBase = [];
      STATE.itemsEnriched = [];
      STATE.selectedIds = null;

      // IMPORTANT: Use $root() to get elements within THIS widget's scope
      const $widget = $root();

      // Clear the visual list
      const $shopsList = $widget.find('#shopsList');
      if ($shopsList.length > 0) {
        $shopsList.empty();
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsList cleared`);
      }

      // Reset counts to 0
      const $shopsCount = $widget.find('#shopsCount');
      const $shopsTotal = $widget.find('#shopsTotal');

      if ($shopsCount.length > 0) {
        $shopsCount.text('(0)');
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsCount reset to 0`);
      }

      if ($shopsTotal.length > 0) {
        $shopsTotal.text('0,00');
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsTotal reset to 0,00`);
      }

      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧹 Clear completed successfully`);
    } catch (err) {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] ❌ Error during clear:`, err);
    }
  });

  // RFC-0093: Function to render shopping filter chips in toolbar (same as EQUIPMENTS)
  function renderShoppingFilterChips(selection) {
    const chipsContainer = document.getElementById('storesShoppingFilterChips');
    if (!chipsContainer) return;

    chipsContainer.innerHTML = '';

    if (!selection || selection.length === 0) {
      return; // No filter applied, hide chips
    }

    selection.forEach((shopping) => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip';
      chip.innerHTML = `<span class="filter-chip-icon">🏬</span><span>${shopping.name}</span>`;
      chipsContainer.appendChild(chip);
    });

    LogHelper.log('[STORES] 📍 Rendered', selection.length, 'shopping filter chips');
  }

  // RFC-0093: Listen for shopping filter changes
  window.addEventListener('myio:filter-applied', (ev) => {
    const selection = ev.detail?.selection || [];
    LogHelper.log('[STORES] 🔥 heard myio:filter-applied:', selection.length, 'shoppings');

    // Extract shopping IDs (ingestionIds) from selection
    const shoppingIds = selection.map((s) => s.value).filter((v) => v);

    LogHelper.log(
      '[STORES] Applying shopping filter:',
      shoppingIds.length === 0 ? 'ALL' : `${shoppingIds.length} shoppings`
    );

    // Update STATE and reflow cards
    STATE.selectedShoppingIds = shoppingIds;

    // Render shopping filter chips
    renderShoppingFilterChips(selection);

    // Reflow to apply filter
    reflowFromState();
  });

  // RFC-0093: Check for pre-existing filter when STORES initializes
  // This handles the case where user filtered in MENU, then navigated to STORES
  if (
    window.custumersSelected &&
    Array.isArray(window.custumersSelected) &&
    window.custumersSelected.length > 0
  ) {
    LogHelper.log('[STORES] 🔄 Applying pre-existing filter:', window.custumersSelected.length, 'shoppings');
    const shoppingIds = window.custumersSelected.map((s) => s.value).filter((v) => v);
    STATE.selectedShoppingIds = shoppingIds;
    renderShoppingFilterChips(window.custumersSelected);
    // Note: reflowFromState will be called later when data is loaded
  }

  // Test if listener is working
  setTimeout(() => {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧪 Testing listener registration...`);
    const testEvent = new CustomEvent('myio:update-date', {
      detail: {
        period: {
          startISO: '2025-09-26T00:00:00-03:00',
          endISO: '2025-10-02T23:59:59-03:00',
          granularity: 'day',
          tz: 'America/Sao_Paulo',
        },
      },
    });
    // Don't dispatch, just check if handler exists
    if (typeof dateUpdateHandler === 'function') {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ dateUpdateHandler is defined and ready`);
    } else {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] ❌ dateUpdateHandler is NOT defined!`);
    }
  }, 100);

  // RFC-0045 FIX: Store pending provide-data events that arrive before update-date
  let pendingProvideData = null;

  // RFC-0042: Listen for data provision from orchestrator
  dataProvideHandler = function (ev) {
    LogHelper.log(
      `[TELEMETRY ${WIDGET_DOMAIN}] 📦 Received provide-data event for domain ${
        ev.detail.domain
      }, periodKey: ${ev.detail.periodKey}, items: ${ev.detail.items?.length || 0}`
    );
    const { domain, periodKey, items } = ev.detail;

    // Only process if it's for my domain
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] ⏭️ Ignoring event for domain ${domain}, my domain is ${WIDGET_DOMAIN}`
      );
      return;
    }

    // IMPORTANT: Prevent duplicate processing of the same periodKey
    // The Orchestrator retries emission after 1s, so we need to deduplicate
    if (lastProcessedPeriodKey === periodKey) {
      LogHelper.log(`[TELEMETRY] ⏭️ Skipping duplicate provide-data for periodKey: ${periodKey}`);
      return;
    }

    // Validate current period matches
    const myPeriod = {
      startISO: self.ctx.scope?.startDateISO,
      endISO: self.ctx.scope?.endDateISO,
    };

    // RFC-0045 FIX: If period not set yet, STORE the event and wait for myio:update-date
    if (!myPeriod.startISO || !myPeriod.endISO) {
      LogHelper.warn(`[TELEMETRY] ⏸️ Period not set yet, storing provide-data event for later processing`);
      pendingProvideData = { domain, periodKey, items };
      // DON'T call hideBusy() here - wait for update-date to process the data
      return;
    }

    // Mark this periodKey as processed ONLY when actually processing
    lastProcessedPeriodKey = periodKey;

    // IMPORTANT: Do NOT call showBusy() here - it was already called in dateUpdateHandler
    // Calling it again creates a NEW timeout that won't be properly cancelled
    LogHelper.log(`[TELEMETRY] 🔄 Processing data from orchestrator...`);
    LogHelper.log(`[TELEMETRY] Received ${items.length} items from orchestrator for domain ${domain}`);

    // Extract my datasource IDs
    const myDatasourceIds = extractDatasourceIds(self.ctx.datasources);

    // RFC-0042: Filter items by datasource IDs
    // ThingsBoard datasource entityId should match API item id (ingestionId)
    const datasourceIdSet = new Set(myDatasourceIds);
    let filtered = items.filter((item) => {
      // Check if item.id (from API) matches any datasource entityId
      return datasourceIdSet.has(item.id) || datasourceIdSet.has(item.tbId);
    });

    LogHelper.log(
      `[TELEMETRY] Filtered ${items.length} items down to ${filtered.length} items matching datasources`
    );

    // If no matches, log warning and use all items (temporary fallback)
    if (filtered.length === 0) {
      LogHelper.warn(`[TELEMETRY] No items match datasource IDs! Using all items as fallback.`);
      LogHelper.warn(`[TELEMETRY] Sample datasource ID:`, myDatasourceIds[0]);
      LogHelper.warn(`[TELEMETRY] Sample API item ID:`, items[0]?.id);
      filtered = items;
    }

    // Convert orchestrator items to TELEMETRY widget format
    filtered = filtered.map((item) => ({
      id: item.tbId || item.id,
      tbId: item.tbId || item.id,
      ingestionId: item.ingestionId || item.id,
      identifier: item.identifier || item.id,
      label: item.label || item.identifier || item.id,
      value: Number(item.value || 0),
      perc: 0,
      deviceType: item.deviceType || 'energy',
      slaveId: item.slaveId || null,
      centralId: item.centralId || null,
      updatedIdentifiers: {},
    }));

    // DEBUG: Log sample item with value
    if (filtered.length > 0 && filtered[0].value > 0) {
      LogHelper.log(`[TELEMETRY] 🔍 Sample orchestrator item after mapping:`, {
        ingestionId: filtered[0].ingestionId,
        label: filtered[0].label,
        value: filtered[0].value,
      });
    }

    LogHelper.log(`[TELEMETRY] Using ${filtered.length} items after processing`);

    // IMPORTANT: Merge orchestrator data with existing TB data
    // Keep original labels/identifiers from TB, only update values from orchestrator
    if (!STATE.itemsBase || STATE.itemsBase.length === 0) {
      // First load: build from TB data
      LogHelper.log(`[TELEMETRY] Building itemsBase from TB data...`);
      STATE.itemsBase = buildAuthoritativeItems();
      LogHelper.log(`[TELEMETRY] Built ${STATE.itemsBase.length} items from TB`);
    }

    // Create map of orchestrator values by ingestionId
    const orchestratorValues = new Map();
    filtered.forEach((item) => {
      if (item.ingestionId) {
        const value = Number(item.value || 0);
        orchestratorValues.set(item.ingestionId, value);
      }
    });
    LogHelper.log(`[TELEMETRY] Orchestrator values map size: ${orchestratorValues.size}`);

    // Update values in existing items
    STATE.itemsEnriched = STATE.itemsBase.map((tbItem) => {
      const orchestratorValue = orchestratorValues.get(tbItem.ingestionId);

      return {
        ...tbItem,
        value: orchestratorValue !== undefined ? orchestratorValue : tbItem.value || 0,
        perc: 0,
      };
    });

    LogHelper.log(`[TELEMETRY] Enriched ${STATE.itemsEnriched.length} items with orchestrator values`);

    // RFC-0056 FIX v1.1: Emit telemetry update after enrichment
    emitTelemetryUpdate();

    // Sanitize selection
    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map((x) => x.id));
      const next = new Set([...STATE.selectedIds].filter((id) => valid.has(id)));
      STATE.selectedIds = next.size ? next : null;
    }

    reflowFromState();

    // RFC-0044: ALWAYS hide busy when data is provided, regardless of source
    LogHelper.log(`[TELEMETRY] 🏁 Data processed successfully - ensuring busy is hidden`);

    // Force hide busy with minimal delay to ensure UI update
    setTimeout(() => {
      hideBusy();
      // Double-check: if orchestrator busy is still showing, force hide it
      if (window.MyIOOrchestrator && window.MyIOOrchestrator.getBusyState) {
        const busyState = window.MyIOOrchestrator.getBusyState();
        if (busyState.isVisible) {
          LogHelper.warn(
            `[TELEMETRY] ⚠️ Orchestrator busy still visible after data processing - force hiding`
          );
          window.MyIOOrchestrator.hideGlobalBusy();
        }
      }
    }, 100); // Reduced to 100ms for faster response
  };

  /**
   * Extracts ingestionIds from ThingsBoard ctx.data (not datasource entityIds).
   * Each device has 6 keys (slaveId, centralId, ingestionId, connectionStatus, deviceType, identifier).
   * We need to extract the ingestionId values to match with API data.
   */
  function extractDatasourceIds(datasources) {
    // Build index from ctx.data to get ingestionId for each device
    const ingestionIds = new Set();
    const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];

    for (const row of rows) {
      const key = String(row?.dataKey?.name || '').toLowerCase();
      const val = row?.data?.[0]?.[1];

      if (key === 'ingestionid' && val && isValidUUID(String(val))) {
        ingestionIds.add(String(val));
      }
    }

    return Array.from(ingestionIds);
  }

  window.addEventListener('myio:telemetry:provide-data', dataProvideHandler);

  // RFC-0056 FIX v1.1: Listen for request_refresh from TELEMETRY_INFO
  let requestRefreshHandler = function (ev) {
    const { type, domain, periodKey } = ev.detail || {};

    if (type !== 'request_refresh') return;
    if (domain !== WIDGET_DOMAIN) return;

    LogHelper.log(`[RFC-0056] Received request_refresh for domain ${domain}, periodKey ${periodKey}`);

    // Re-emit telemetry data
    const currentPeriodKey = buildPeriodKey();
    if (currentPeriodKey === periodKey) {
      LogHelper.log(`[RFC-0056] Re-emitting data for current period`);
      emitTelemetryUpdate();
    } else {
      LogHelper.warn(`[RFC-0056] Period mismatch: requested ${periodKey}, current ${currentPeriodKey}`);
    }
  };

  window.addEventListener('myio:telemetry:update', requestRefreshHandler);

  // RFC-0091: Use credentials from MAIN via MyIOUtils (already fetched by MAIN)
  const jwt = localStorage.getItem('jwt_token');

  // Try to get credentials from MAIN first
  const mainCredentials = window.MyIOUtils?.getCredentials?.();
  if (mainCredentials?.clientId && mainCredentials?.clientSecret) {
    CLIENT_ID = mainCredentials.clientId;
    CLIENT_SECRET = mainCredentials.clientSecret;
    CUSTOMER_ING_ID = mainCredentials.customerIngestionId || '';
    LogHelper.log('[STORES] Using credentials from MAIN (MyIOUtils)');
  } else {
    // Fallback: fetch credentials directly if MAIN not ready
    LogHelper.log('[STORES] MAIN credentials not available, fetching directly...');
    const customerTB_ID = window.MyIOUtils?.getCustomerId?.() || self.ctx.settings?.customerTB_ID || '';

    try {
      const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
      CLIENT_ID = attrs?.client_id || '';
      CLIENT_SECRET = attrs?.client_secret || '';
      CUSTOMER_ING_ID = attrs?.ingestionId || '';
    } catch (err) {
      LogHelper.error('[STORES] Failed to fetch credentials:', err);
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

      LogHelper.log('[STORES] Auth init OK');
      try {
        await MyIOAuth.getToken();
      } catch (_e) {
        /* ignore token errors */
      }
    } catch (err) {
      LogHelper.error('[STORES] Auth init FAIL', err);
    }
  } else {
    LogHelper.warn('[STORES] No credentials available for auth initialization');
  }

  // Bind UI
  bindHeader();
  bindModal();

  // ---------- Datas iniciais: "Current Month So Far" ----------
  if (!self.ctx?.scope?.startDateISO || !self.ctx?.scope?.endDateISO) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0); // 1º dia 00:00
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 0); // hoje 23:59:59
    self.ctx.scope = self.ctx.scope || {};
    self.ctx.scope.startDateISO = start.toISOString();
    self.ctx.scope.endDateISO = end.toISOString();
  }
  // ------------------------------------------------------------

  const hasData = Array.isArray(self.ctx.data) && self.ctx.data.length > 0;
  // RFC-0042: Removed direct API fetch - now using orchestrator
  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] onInit - Waiting for orchestrator data...`);

  // Build initial itemsBase from ThingsBoard data
  if (hasData && (!STATE.itemsBase || STATE.itemsBase.length === 0)) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Building itemsBase from TB data in onInit...`);
    STATE.itemsBase = buildAuthoritativeItems();
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Built ${STATE.itemsBase.length} items from TB`);

    // Initial render with zero values (will be updated by orchestrator)
    STATE.itemsEnriched = STATE.itemsBase.map((item) => ({
      ...item,
      value: 0,
      perc: 0,
    }));
    reflowFromState();
  }

  // Only show busy if we have a date range defined
  if (self.ctx?.scope?.startDateISO && self.ctx?.scope?.endDateISO) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Initial period defined, showing busy...`);
    showBusy();
  } else {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] No initial period, waiting for myio:update-date event...`);
  }

  // RFC-0042: OLD CODE - Direct API fetch (now handled by orchestrator)
  if (hasData) {
    STATE.firstHydrates++;
    if (STATE.firstHydrates <= MAX_FIRST_HYDRATES) {
      await hydrateAndRender();
    }
  } else {
    // Aguardar datasource chegar
    const waiter = setInterval(async () => {
      if (Array.isArray(self.ctx.data) && self.ctx.data.length > 0) {
        clearInterval(waiter);
        STATE.firstHydrates++;
        if (STATE.firstHydrates <= MAX_FIRST_HYDRATES) await hydrateAndRender();
      }
    }, 200);
  }
};

// onDataUpdated removido (no-op por ora)
self.onDataUpdated = function () {
  /* no-op */
};

self.onResize = function () {};
self.onDestroy = function () {
  if (dateUpdateHandler) {
    window.removeEventListener('myio:update-date', dateUpdateHandler);
    LogHelper.log("[DeviceCards] Event listener 'myio:update-date' removido.");
  }
  if (dataProvideHandler) {
    window.removeEventListener('myio:telemetry:provide-data', dataProvideHandler);
    LogHelper.log("[DeviceCards] Event listener 'myio:telemetry:provide-data' removido.");
  }
  // RFC-0056 FIX v1.1: Remove request_refresh listener
  if (requestRefreshHandler) {
    window.removeEventListener('myio:telemetry:update', requestRefreshHandler);
    LogHelper.log("[RFC-0056] Event listener 'myio:telemetry:update' removido.");
  }

  // RFC-0093: Cleanup header controller
  if (storesHeaderController) {
    storesHeaderController.destroy();
    storesHeaderController = null;
    LogHelper.log('[STORES] [RFC-0093] Header controller destroyed');
  }

  // RFC-0090: Cleanup filter modal using shared factory
  if (storesFilterModal) {
    storesFilterModal.destroy();
    storesFilterModal = null;
    LogHelper.log('[STORES] [RFC-0090] Filter modal destroyed');
  }

  try {
    $root().off();
  } catch (_e) {
    /* ignore cleanup errors */
  }
  hideBusy();
  hideGlobalSuccessModal();
};
