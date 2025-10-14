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
// Debug configuration
const DEBUG_ACTIVE = true; // Set to false to disable debug logs

// LogHelper utility
const LogHelper = {
  log: function(...args) {
    if (DEBUG_ACTIVE) {
      console.log(...args);
    }
  },
  warn: function(...args) {
    if (DEBUG_ACTIVE) {
      console.warn(...args);
    }
  },
  error: function(...args) {
    if (DEBUG_ACTIVE) {
      console.error(...args);
    }
  }
};

LogHelper.log("🚀 [TELEMETRY] Controller loaded - VERSION WITH ORCHESTRATOR SUPPORT");

const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
const MAX_FIRST_HYDRATES = 1;

let dateUpdateHandler = null;
let dataProvideHandler = null; // RFC-0042: Orchestrator data listener
//let DEVICE_TYPE = "energy";
let MyIO = null;
let hasRequestedInitialData = false; // Flag to prevent duplicate initial requests
let lastProcessedPeriodKey = null; // Track last processed periodKey to prevent duplicate processing
let busyTimeoutId = null; // Timeout ID for busy fallback

// RFC-0042: Widget configuration (from settings)
let WIDGET_DOMAIN = 'energy'; // Will be set in onInit

/** ===================== STATE ===================== **/
let CLIENT_ID       = "";
let CLIENT_SECRET   = "";
let CUSTOMER_ING_ID = "";
let MyIOAuth        = null;

const STATE = {
  itemsBase:     [],     // lista autoritativa (TB)
  itemsEnriched: [],     // lista com totals + perc
  searchActive:  false,
  searchTerm:    "",
  selectedIds:   /** @type {Set<string> | null} */(null),
  sortMode:      /** @type {'cons_desc'|'cons_asc'|'alpha_asc'|'alpha_desc'} */('cons_desc'),
  firstHydrates: 0
};

let hydrating = false;

/** ===================== HELPERS (DOM) ===================== **/
const $root  = () => $(self.ctx.$container[0]);
const $list  = () => $root().find("#shopsList");
const $count = () => $root().find("#shopsCount");
const $total = () => $root().find("#shopsTotal");
const $modal = () => $root().find("#filterModal");

/** ===================== BUSY MODAL (no widget) ===================== **/
const BUSY_ID = "myio-busy-modal";
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
  $root().css("position","relative"); // garante overlay correto
  $root().append(html);
  return $root().find(`#${BUSY_ID}`);
}
// RFC-0044: Use centralized busy management
function showBusy(message) {
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
        const text = (message && String(message).trim()) || "Carregando dados...";
        window.MyIOOrchestrator.showGlobalBusy(WIDGET_DOMAIN, text);
        LogHelper.log(`[TELEMETRY] ✅ Using centralized busy for domain: ${WIDGET_DOMAIN}`);
      } else {
        LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator not available, using fallback busy`);
        const $m = ensureBusyModalDOM();
        const text = (message && String(message).trim()) || "aguarde.. carregando os dados...";
        $m.find(`#${BUSY_ID}-msg`).text(text);
        $m.css("display","flex");
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

  // Ensure orchestrator is ready before showing busy (max 30 attempts = 3 seconds)
  let attempts = 0;
  const maxAttempts = 30;
  const checkOrchestratorReady = () => {
    attempts++;
    if (window.MyIOOrchestrator) {
      safeShowBusy();
    } else if (attempts >= maxAttempts) {
      LogHelper.warn(`[TELEMETRY] Orchestrator not available after ${maxAttempts} attempts, using fallback`);
      safeShowBusy(); // Use fallback
    } else {
      setTimeout(checkOrchestratorReady, 100);
    }
  };

  checkOrchestratorReady();
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
        $root().find(`#${BUSY_ID}`).css("display","none");
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY] ❌ Error in hideBusy:`, err);
    } finally {
      window.busyInProgress = false;
    }
  };

  // Ensure orchestrator is ready before hiding busy (max 30 attempts = 3 seconds)
  let attempts = 0;
  const maxAttempts = 30;
  const checkOrchestratorReady = () => {
    attempts++;
    if (window.MyIOOrchestrator) {
      safeHideBusy();
    } else if (attempts >= maxAttempts) {
      LogHelper.warn(`[TELEMETRY] Orchestrator not available after ${maxAttempts} attempts, using fallback`);
      safeHideBusy(); // Use fallback
    } else {
      setTimeout(checkOrchestratorReady, 100);
    }
  };

  checkOrchestratorReady();
}

/** ===================== GLOBAL SUCCESS MODAL (fora do widget) ===================== **/
const G_SUCCESS_ID = "myio-global-success-modal";
let gSuccessTimer = null;

function ensureGlobalSuccessModalDOM() {
  let el = document.getElementById(G_SUCCESS_ID);
  if (el) return el;

  const wrapper = document.createElement("div");
  wrapper.id = G_SUCCESS_ID;
  wrapper.setAttribute("style", `
    position: fixed; inset: 0; display: none;
    z-index: 999999; 
    background: rgba(150,132,181,0.45); /* #9684B5 com transparência */
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  `);

  // container central
  const center = document.createElement("div");
  center.setAttribute("style", `
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: #2d1458; color: #fff;
    border-radius: 20px; padding: 26px 30px; min-width: 360px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 14px 44px rgba(0,0,0,.35);
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;
    text-align: center;
  `);

  const icon = document.createElement("div");
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

  const title = document.createElement("div");
  title.id = `${G_SUCCESS_ID}-title`;
  title.textContent = "os dados foram salvos com sucesso";
  title.setAttribute("style", `font-size:16px;font-weight:700;letter-spacing:.2px;margin-bottom:6px;`);

  const sub = document.createElement("div");
  sub.id = `${G_SUCCESS_ID}-sub`;
  sub.innerHTML = `recarregando em <b id="${G_SUCCESS_ID}-count">6</b>s...`;
  sub.setAttribute("style", `opacity:.9;font-size:13px;`);

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

  el.style.display = "block";

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
      try { window.location.reload(); } catch (_) {}
    }
  }, 1000);
}

function hideGlobalSuccessModal() {
  const el = document.getElementById(G_SUCCESS_ID);
  if (el) el.style.display = "none";
  if (gSuccessTimer) { clearInterval(gSuccessTimer); gSuccessTimer = null; }
}

/** ===================== UTILS ===================== **/
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function isValidUUID(v) {
  if (!v || typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function toSpOffsetNoMs(dt, endOfDay=false) {
  const d = (typeof dt === "number") ? new Date(dt)
          : (dt instanceof Date) ? dt
          : new Date(String(dt));
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  if (endOfDay) d.setHours(23,59,59,999);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}-03:00`;
}

// converts raw API value to the UI target unit
function toTargetUnit(raw) {
  /*
  const x = Number(raw || 0);

  if (DEVICE_TYPE === "energy") {
    return MyIO.formatEnergy(x);
  }

  if (DEVICE_TYPE === "water") {
    return MyIO.formatWaterVolumeM3(x);
  }

  if (DEVICE_TYPE === "tank") {
    return MyIO.formatTankHeadFromCm(x);
  }

  // Default fallback for temperature or unknown types
  return x;
  */
  // TODO Trecho comentado, pois já faz o tratamento no componente

  return Number(raw || 0)
}
function mustGetDateRange() {
  const s = self.ctx?.scope?.startDateISO;
  const e = self.ctx?.scope?.endDateISO;
  if (s && e) return { startISO: s, endISO: e };
  throw new Error("DATE_RANGE_REQUIRED");
}

const isAuthReady = () => !!(MyIOAuth && typeof MyIOAuth.getToken === "function");
async function ensureAuthReady(maxMs = 6000, stepMs = 150) {
  const start = Date.now();
  while (!isAuthReady()) {
    if (Date.now() - start > maxMs) return false;
    await new Promise(r => setTimeout(r, stepMs));
  }
  return true;
}

/** ===================== TB INDEXES ===================== **/
function buildTbAttrIndex() {
  const byTbId = new Map(); // tbId -> { slaveId, centralId, deviceType, centralName }
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
  for (const row of rows) {
    const key = String(row?.dataKey?.name || "").toLowerCase();
    const tbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val  = row?.data?.[0]?.[1];
    if (!tbId || val == null) continue;
    if (!byTbId.has(tbId)) byTbId.set(tbId, { slaveId: null, centralId: null, deviceType: null, centralName: null });
    const slot = byTbId.get(tbId);
    if (key === "slaveid")     slot.slaveId     = val;
    if (key === "centralid")   slot.centralId   = val;
    if (key === "devicetype")  slot.deviceType  = val;
    if (key === "centralname") slot.centralName = val;
  }
  return byTbId;
}
function buildTbIdIndexes() {
  const byIdentifier = new Map(); // identifier -> tbId
  const byIngestion  = new Map(); // ingestionId -> tbId
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
  for (const row of rows) {
    const key = String(row?.dataKey?.name || "").toLowerCase();
    const tbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val  = row?.data?.[0]?.[1];
    if (!tbId || val == null) continue;
    if (key === "identifier")  byIdentifier.set(String(val), tbId);
    if (key === "ingestionid") byIngestion.set(String(val),   tbId);
  }
  return { byIdentifier, byIngestion };
}

/** ===================== CORE: DATA PIPELINE ===================== **/
function buildAuthoritativeItems() {
  // items da LIB: [{ id: ingestionId, identifier, label }, ...]
  const base = MyIO.buildListItemsThingsboardByUniqueDatasource(self.ctx.datasources, self.ctx.data) || [];

  //LogHelper.log("[TELEMETRY][buildAuthoritativeItems] base: ", base);

  const ok   = Array.isArray(base) ? base.filter(x => x && x.id) : [];

  const tbIdIdx   = buildTbIdIndexes();   // { byIdentifier, byIngestion }
  const attrsByTb = buildTbAttrIndex();   // tbId -> { slaveId, centralId, deviceType }

  const mapped = ok.map(r => {
    //LogHelper.log("[TELEMETRY][buildAuthoritativeItems] ok.map: ", r);

    const ingestionId = r.id;
    const tbFromIngestion  = ingestionId ? tbIdIdx.byIngestion.get(ingestionId) : null;
    const tbFromIdentifier = r.identifier ? tbIdIdx.byIdentifier.get(r.identifier) : null;

    let tbId = tbFromIngestion || tbFromIdentifier || null;
    if (tbFromIngestion && tbFromIdentifier && tbFromIngestion !== tbFromIdentifier) {
      /*
      LogHelper.warn("[DeviceCards] TB id mismatch for item", {
        label: r.label, identifier: r.identifier, ingestionId, tbFromIngestion, tbFromIdentifier
      });
      */
      tbId = tbFromIngestion;
    }

    const attrs = tbId ? (attrsByTb.get(tbId) || {}) : {};
    return {
      id: tbId || ingestionId,     // para seleção/toggle
      tbId,                        // ThingsBoard deviceId (Settings)
      ingestionId,                 // join key API (totals/Report)
      identifier: r.identifier,
      label: r.label,
      slaveId: attrs.slaveId ?? null,
      centralId: attrs.centralId ?? null,
      centralName: attrs.centralName ?? null,
      deviceType: attrs.deviceType || "energy",
      updatedIdentifiers: {}
    };
  });

  //LogHelper.log(`[DeviceCards] TB items: ${mapped.length}`);
  return mapped;
}

async function fetchApiTotals(startISO, endISO) {
  if (!isAuthReady()) throw new Error("Auth not ready");
  const token = await MyIOAuth.getToken();
  if (!token) throw new Error("No ingestion token");

  const url = new URL(`${DATA_API_HOST}/api/v1/telemetry/customers/${CUSTOMER_ING_ID}/energy/devices/totals`);
  url.searchParams.set("startTime", toSpOffsetNoMs(startISO));
  url.searchParams.set("endTime",   toSpOffsetNoMs(endISO, true));
  url.searchParams.set("deep",      "1");

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    LogHelper.warn("[DeviceCards] API fetch failed:", res.status);
    return new Map();
  }

  const json = await res.json();
  const rows = Array.isArray(json) ? json : (json?.data ?? []);
  const map = new Map();
  for (const r of rows) if (r && r.id) map.set(String(r.id), r);
  //LogHelper.log(`[DeviceCards] API rows: ${rows.length}, map keys: ${map.size}`);
  return map;
}

function enrichItemsWithTotals(items, apiMap) {
  return items.map(it => {
    let raw = 0;
    
    if (it.ingestionId && isValidUUID(it.ingestionId)) {
        const row = apiMap.get(String(it.ingestionId));
        raw = Number(row?.total_value ?? 0);
    }
    
    const value = Number(raw || 0) ; // toTargetUnit(raw); TODO verificar se ainda precisa dessa chamada
    
    return { ...it, value, perc: 0 };
  });
}

/** ===================== FILTERS / SORT / PERC ===================== **/
function applyFilters(enriched, searchTerm, selectedIds, sortMode) {
  let v = enriched.slice();

  if (selectedIds && selectedIds.size) {
    v = v.filter(x => selectedIds.has(x.id));
  }

  const q = (searchTerm || "").trim().toLowerCase();
  if (q) {
    v = v.filter(x =>
      (x.label || "").toLowerCase().includes(q) ||
      String(x.identifier || "").toLowerCase().includes(q) 
    );
  }

  v.sort((a, b) => {
    if (sortMode === "cons_desc") {
      if (a.value !== b.value) return b.value - a.value;
      return (a.label || "").localeCompare((b.label || ""), "pt-BR", { sensitivity: "base" });
    }
    if (sortMode === "cons_asc") {
      if (a.value !== b.value) return a.value - b.value;
      return (a.label || "").localeCompare((b.label || ""), "pt-BR", { sensitivity: "base" });
    }
    if (sortMode === "alpha_desc") {
      return (b.label || "").localeCompare((a.label || ""), "pt-BR", { sensitivity: "base" }) || (b.value - a.value);
    }
    return (a.label || "").localeCompare((b.label || ""), "pt-BR", { sensitivity: "base" }) || (a.value - b.value);
  });

  return v;
}

function recomputePercentages(visible) {
  const groupSum = visible.reduce((acc, x) => acc + (x.value || 0), 0);
  const updated  = visible.map(x => ({ ...x, perc: groupSum > 0 ? (x.value / groupSum) * 100 : 0 }));
  return { visible: updated, groupSum };
}

/** ===================== RENDER ===================== **/
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

function renderList(visible) {

  const $ul = $list().empty();

  visible.forEach(it => {
    const valNum = Number(it.value || 0);
    const connectionStatus = valNum > 0 ? "power_on" : "power_off";

    const entityObject = {
      entityId: it.tbId || it.id,            // preferir TB deviceId
      labelOrName: it.label,
      deviceType: it.deviceType,
      val: valNum, // TODO verificar ESSE MULTIPLICADOR PQ PRECISA DELE ?
      perc: it.perc ?? 0,
      deviceStatus: connectionStatus,        // "power_on" | "power_off"
      entityType: "DEVICE",
      deviceIdentifier: it.identifier,
      slaveId: it.slaveId || "N/A",
      ingestionId: it.ingestionId || "N/A",
      centralId: it.centralId || "N/A",
      centralName: it.centralName || "N/A",
      updatedIdentifiers: it.updatedIdentifiers || {},
      handInfo: true,
      connectionStatusTime: Date.now(),
      timaVal: Date.now()
    };
    
    if (it.label === 'Allegria') {
        //LogHelper.log("RENDER CARD ALLEGRIA >>> it.value: " , it.value);
    }
    
    const myTbToken = localStorage.getItem("jwt_token");
    let cachedIngestionToken = null;
    
    MyIOAuth.getToken().then(token => {
      cachedIngestionToken = token;
    }).catch(err => LogHelper.warn('Token cache failed:', err));

    const $card = MyIO.renderCardComponentV2({
      entityObject,
      handInfo: true,
      useNewComponents: true,  // Habilitar novos componentes
      enableSelection: true,   // Habilitar seleção
      enableDragDrop: true,    // Habilitar drag and drop

      handleActionDashboard: async () => {
       try {
        const tokenIngestionDashBoard = await MyIOAuth.getToken();
        const myTbTokenDashBoard = localStorage.getItem("jwt_token");
        const modal = MyIO.openDashboardPopupEnergy({
          deviceId: it.id, // Use actual device ID
          readingType: WIDGET_DOMAIN, // 'energy', 'water', or 'tank'
          startDate: self.ctx.scope.startDateISO,
          endDate: self.ctx.scope.endDateISO,
          tbJwtToken: myTbTokenDashBoard,
          ingestionToken: tokenIngestionDashBoard,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          onOpen: (context) => {
            LogHelper.log('Modal opened:', context);
            hideBusy(); // Hide loading when modal opens
          },
          onError: (error) => {
            LogHelper.error('Modal error:', error);
            hideBusy();
            alert(`Erro: ${error.message}`);
          },
          onClose: () => {
            LogHelper.log('Modal closed');
          }
        });
       } catch (err) {
          LogHelper.warn("[DeviceCards] Report open blocked:", err?.message || err);
          alert("Credenciais ainda carregando. Tente novamente em instantes.");
        } finally {
          hideBusy();
        }
      },

      handleActionReport: async () => {
        try {
          showBusy(); // mensagem fixa

          if (!isAuthReady()) throw new Error("Auth not ready");

          const ingestionToken = await MyIOAuth.getToken();

          if (!ingestionToken) throw new Error("No ingestion token");

          await MyIO.openDashboardPopupReport({
            ingestionId: it.ingestionId, // sempre ingestionId
            identifier: it.identifier,
            label: it.label,
            domain: WIDGET_DOMAIN, // 'energy', 'water', or 'temperature'
            api: {
              dataApiBaseUrl: DATA_API_HOST,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              ingestionToken
            }
          });
        } catch (err) {
          LogHelper.warn("[DeviceCards] Report open blocked:", err?.message || err);
          alert("Credenciais ainda carregando. Tente novamente em instantes.");
        } finally {
          hideBusy();
        }
      },

      handleActionSettings: async () => {
        showBusy(); // mensagem fixa
        // resolve TB id “fresh”
        let tbId = it.tbId;
        if (!tbId || !isValidUUID(tbId)) {
          const idx = buildTbIdIndexes();
          tbId =
            (it.ingestionId && idx.byIngestion.get(it.ingestionId)) ||
            (it.identifier && idx.byIdentifier.get(it.identifier)) ||
            null;
        }
        if (!tbId || tbId === it.ingestionId) {
          LogHelper.warn("[DeviceCards] Missing/ambiguous TB id for Settings", {
            label: it.label, identifier: it.identifier, ingestionId: it.ingestionId, tbId
          });
          hideBusy();
          alert("Não foi possível identificar o deviceId do ThingsBoard para este card.");
          return;
        }
        const jwt = localStorage.getItem("jwt_token");
        try {
          await MyIO.openDashboardPopupSettings({
            deviceId: tbId, // TB deviceId
            label: it.label,
            jwtToken: jwt,
            ui: { title: "Configurações", width: 900 },
            onSaved: (payload) => {
              LogHelper.log("[Settings Saved]", payload);
              hideBusy();
              // Mostra modal global de sucesso com contador e reload
              showGlobalSuccessModal(6);
            },
            onClose: () => {
              $(".myio-settings-modal-overlay").remove();
              hideBusy();
            }
          });
        } catch (e) {
          hideBusy();
        }
      },
      
      handleClickCard: () => {
        //LogHelper.log("Card clicado:", entityObject);
      },

      handleSelect: (entityObj) => {
        // NOTE: This callback is called during card rendering, NOT during user selection
        // Entity registration is handled by the 'myio:device-params' event listener instead
        // which is only triggered when the user actually clicks the checkbox
        LogHelper.log("[TELEMETRY] handleSelect called (no-op):", entityObj.labelOrName);
      },
    });

    $ul.append($card);
  });
}

/** ===================== UI BINDINGS ===================== **/
function bindHeader() {
  $root().on("click", "#btnSearch", () => {
    STATE.searchActive = !STATE.searchActive;
    $root().find("#searchWrap").toggleClass("active", STATE.searchActive);
    if (STATE.searchActive) setTimeout(() => $root().find("#shopsSearch").trigger("focus"), 30);
  });

  $root().on("input", "#shopsSearch", (ev) => {
    STATE.searchTerm = ev.target.value || "";
    reflowFromState();
  });

  $root().on("click", "#btnFilter", () => openFilterModal());
}

function openFilterModal() {
  const $m  = $modal();
  const $cl = $m.find("#deviceChecklist").empty();

  const list = (STATE.itemsBase || []).slice().sort((a, b) =>
    (a.label || "").localeCompare((b.label || ""), "pt-BR", { sensitivity: "base" })
  );

  if (!list.length) {
    $cl.html('<div class="muted">Nenhuma loja carregada.</div>');
    $m.removeClass("hidden");
    return;
  }

  const selected = STATE.selectedIds;
  const frag = document.createDocumentFragment();

  for (const it of list) {
    const safeId  = String(it.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || ("id" + Math.random().toString(36).slice(2));
    const checked = !selected || !selected.size || selected.has(it.id);

    const label = document.createElement("label");
    label.className = "check-item";
    label.setAttribute("role", "option");
    label.innerHTML = `
      <input type="checkbox" id="chk-${safeId}" data-entity="${escapeHtml(it.id)}" ${checked ? "checked" : ""}>
      <span>${escapeHtml(it.label || it.identifier || it.id)}</span>
    `;
    frag.appendChild(label);
  }

  $cl[0].appendChild(frag);
  $m.find(`input[name="sortMode"][value="${STATE.sortMode}"]`).prop("checked", true);

  const $footer = $m.find(".shops-modal-footer");
  if ($footer.length) $footer.show().find("#applyFilters, #resetFilters").show();

  syncChecklistSelectionVisual();
  $m.removeClass("hidden");
}
function closeFilterModal() { $modal().addClass("hidden"); }

function bindModal() {
  $root().on("click", "#closeFilter", closeFilterModal);

  $root().on("click", "#selectAll", (ev) => {
    ev.preventDefault();
    $modal().find('.check-item input[type="checkbox"]').prop("checked", true);
    syncChecklistSelectionVisual();
  });

  $root().on("click", "#clearAll", (ev) => {
    ev.preventDefault();
    $modal().find('.check-item input[type="checkbox"]').prop("checked", false);
    syncChecklistSelectionVisual();
  });

  $root().on("click", "#resetFilters", (ev) => {
    ev.preventDefault();
    STATE.selectedIds = null;
    STATE.sortMode = "cons_desc";
    $modal().find('.check-item input[type="checkbox"]').prop("checked", true);
    $modal().find('input[name="sortMode"][value="cons_desc"]').prop("checked", true);
    syncChecklistSelectionVisual();
    reflowFromState();
  });

  $root().on("click", "#applyFilters", (ev) => {
    ev.preventDefault();
    const set = new Set();
    $modal().find('.check-item input[type="checkbox"]:checked').each((_, el) => {
      const id = $(el).data("entity");
      if (id) set.add(id);
    });

    STATE.selectedIds = (set.size === 0 || set.size === STATE.itemsBase.length) ? null : set;
    STATE.sortMode = String($modal().find('input[name="sortMode"]:checked').val() || "cons_desc");

    reflowFromState();
    closeFilterModal();
  });

  $root().on("input", "#filterDeviceSearch", (ev) => {
    const q = (ev.target.value || "").trim().toLowerCase();
    $modal().find(".check-item").each((_, node) => {
      const txt = $(node).text().trim().toLowerCase();
      $(node).toggle(txt.includes(q));
    });
  });

  $root().on("click", "#filterDeviceClear", (ev) => {
    ev.preventDefault();
    const $inp = $modal().find("#filterDeviceSearch");
    $inp.val("");
    $modal().find(".check-item").show();
    $inp.trigger("focus");
  });

  $root().on("click", "#deviceChecklist .check-item", function (ev) {
    if (ev.target && ev.target.tagName && ev.target.tagName.toLowerCase() === "input") return;
    ev.preventDefault();
    ev.stopPropagation();
    const $chk = $(this).find('input[type="checkbox"]');
    $chk.prop("checked", !$chk.prop("checked")).trigger("change");
  });

  $root().on("change", '#deviceChecklist input[type="checkbox"]', function () {
    const $wrap = $(this).closest(".check-item");
    const on = this.checked;
    $wrap.toggleClass("selected", on).attr("data-checked", on ? "true" : "false");
    $wrap.css(on
      ? { background:"rgba(62,26,125,.08)", borderColor:"#3E1A7D", boxShadow:"0 8px 18px rgba(62,26,125,.15)" }
      : { background:"#fff", borderColor:"#D6E1EC", boxShadow:"0 6px 14px rgba(0,0,0,.05)" }
    );
  });
}

function syncChecklistSelectionVisual() {
  $modal().find(".check-item").each(function () {
    const $el = $(this);
    const on = $el.find('input[type="checkbox"]').prop("checked");
    $el.toggleClass("selected", on).attr("data-checked", on ? "true" : "false");
    $el.css(on
      ? { background:"rgba(62,26,125,.08)", borderColor:"#3E1A7D", boxShadow:"0 8px 18px rgba(62,26,125,.15)" }
      : { background:"#fff", borderColor:"#D6E1EC", boxShadow:"0 6px 14px rgba(0,0,0,.05)" }
    );
  });
}

/** ===================== RECOMPUTE (local only) ===================== **/
function reflowFromState() {
  const visible = applyFilters(STATE.itemsEnriched, STATE.searchTerm, STATE.selectedIds, STATE.sortMode);
  const { visible: withPerc, groupSum } = recomputePercentages(visible);
  renderHeader(withPerc.length, groupSum);
  renderList(withPerc);
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
      LogHelper.warn("[DeviceCards] Aguardando intervalo de datas (startDateISO/endDateISO).");
      return;
    }

    // 1) Auth
    const okAuth = await ensureAuthReady(6000, 150);
    if (!okAuth) {
      LogHelper.warn("[DeviceCards] Auth not ready; adiando hidratação.");
      return;
    }

    // 2) Lista autoritativa
    STATE.itemsBase = buildAuthoritativeItems();

    // 3) Totais na API
    let apiMap = new Map();
    try {
      apiMap = await fetchApiTotals(range.startISO, range.endISO);
    } catch (err) {
      LogHelper.error("[DeviceCards] API error:", err);
      apiMap = new Map();
    }

    // 4) Enrich + render
    STATE.itemsEnriched = enrichItemsWithTotals(STATE.itemsBase, apiMap);

    // 5) Sanitiza seleção
    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map(x => x.id));
      const next = new Set([...STATE.selectedIds].filter(id => valid.has(id)));
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
    height: "100%",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    position: "relative"
  });

  MyIO = (typeof MyIOLibrary !== "undefined" && MyIOLibrary)
         || (typeof window !== "undefined" && window.MyIOLibrary)
         || {
              showAlert: function() {
                alert("A Bliblioteca Myio não foi carregada corretamente!");
              }
            };
  
  $root().find("#labelWidgetId").text(self.ctx.settings?.labelWidget);

  // RFC-0042: Set widget configuration from settings FIRST
  WIDGET_DOMAIN = self.ctx.settings?.DOMAIN || 'energy';
  LogHelper.log(`[TELEMETRY] Configured EARLY: domain=${WIDGET_DOMAIN}`);

  // RFC-0042: Request data from orchestrator (defined early for use in handlers)
  function requestDataFromOrchestrator() {
    if (!self.ctx.scope?.startDateISO || !self.ctx.scope?.endDateISO) {
      LogHelper.warn('[TELEMETRY] No date range set, cannot request data');
      return;
    }

    const period = {
      startISO: self.ctx.scope.startDateISO,
      endISO: self.ctx.scope.endDateISO,
      granularity: window.calcGranularity ? window.calcGranularity(self.ctx.scope.startDateISO, self.ctx.scope.endDateISO) : 'day',
      tz: 'America/Sao_Paulo'
    };

    LogHelper.log(`[TELEMETRY] Requesting data for domain=${WIDGET_DOMAIN}, period:`, period);

    // RFC-0042: Emit request event to parent window (where Orchestrator lives)
    const targetWindow = window.parent || window;
    targetWindow.dispatchEvent(new CustomEvent('myio:telemetry:request-data', {
      detail: { domain: WIDGET_DOMAIN, period }
    }));
  }

  // Listener com modal: evento externo de mudança de data
  dateUpdateHandler = function (ev) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ DATE UPDATE EVENT RECEIVED!`, ev.detail);

    try {
      // RFC-0042: Handle both old and new format
      let startISO, endISO;

      if (ev.detail?.period) {
        // New format from HEADER
        startISO = ev.detail.period.startISO;
        endISO = ev.detail.period.endISO;
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Using NEW format (period object)`);
      } else {
        // Old format (backward compatibility)
        const { startDate, endDate } = ev.detail || {};
        startISO = new Date(startDate).toISOString();
        endISO = new Date(endDate).toISOString();
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Using OLD format (startDate/endDate)`);
      }

      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Date range updated:`, startISO, endISO);

      // Datas mandatórias salvas no scope
      self.ctx.scope = self.ctx.scope || {};
      self.ctx.scope.startDateISO = startISO;
      self.ctx.scope.endDateISO = endISO;

      // IMPORTANT: Reset lastProcessedPeriodKey when new date range is selected
      // This allows processing fresh data for the new period
      lastProcessedPeriodKey = null;
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔄 Reset lastProcessedPeriodKey for new date range`);

      // Exibe modal
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔄 Calling showBusy()...`);
      showBusy();
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ showBusy() called`);

      // RFC-0042: Request data from orchestrator (check parent window if in iframe)
      const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;

      if (orchestrator) {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ Requesting data from orchestrator (${window.MyIOOrchestrator ? 'current' : 'parent'} window)`);

        // IMPORTANT: Mark as requested BEFORE calling requestDataFromOrchestrator
        // This prevents the setTimeout(500ms) from making a duplicate request
        hasRequestedInitialData = true;

        requestDataFromOrchestrator();
      } else {
        // Fallback to old behavior
        LogHelper.warn(`[TELEMETRY ${WIDGET_DOMAIN}] ⚠️ Orchestrator not available, using legacy fetch`);
        if (typeof hydrateAndRender === "function") {
          hydrateAndRender();
        } else {
          LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] hydrateAndRender não encontrada.`);
        }
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] dateUpdateHandler error:`, err);
      hideBusy();
    }
  };

  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 Registering myio:update-date listener...`);
  window.addEventListener("myio:update-date", dateUpdateHandler);
  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ myio:update-date listener registered!`);

  // RFC-0042: Listen for clear event from HEADER (when user clicks "Limpar" button)
  window.addEventListener("myio:telemetry:clear", (ev) => {
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

  // Test if listener is working
  setTimeout(() => {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧪 Testing listener registration...`);
    const testEvent = new CustomEvent('myio:update-date', {
      detail: {
        period: {
          startISO: '2025-09-26T00:00:00-03:00',
          endISO: '2025-10-02T23:59:59-03:00',
          granularity: 'day',
          tz: 'America/Sao_Paulo'
        }
      }
    });
    // Don't dispatch, just check if handler exists
    if (typeof dateUpdateHandler === 'function') {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ dateUpdateHandler is defined and ready`);
    } else {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] ❌ dateUpdateHandler is NOT defined!`);
    }
  }, 100);

  // RFC-0042: Listen for data provision from orchestrator
  dataProvideHandler = function (ev) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📦 Received provide-data event for domain ${ev.detail.domain}, periodKey: ${ev.detail.periodKey}, items: ${ev.detail.items?.length || 0}`);
    const { domain, periodKey, items } = ev.detail;

    // Only process if it's for my domain
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ⏭️ Ignoring event for domain ${domain}, my domain is ${WIDGET_DOMAIN}`);
      return;
    }

    // IMPORTANT: Prevent duplicate processing of the same periodKey
    // The Orchestrator retries emission after 1s, so we need to deduplicate
    if (lastProcessedPeriodKey === periodKey) {
      LogHelper.log(`[TELEMETRY] ⏭️ Skipping duplicate provide-data for periodKey: ${periodKey}`);
      return;
    }

    // Mark this periodKey as processed
    lastProcessedPeriodKey = periodKey;

    // Validate current period matches
    const myPeriod = {
      startISO: self.ctx.scope?.startDateISO,
      endISO: self.ctx.scope?.endDateISO
    };

    if (!myPeriod.startISO || !myPeriod.endISO) {
      LogHelper.warn(`[TELEMETRY] No period set, ignoring data provision and hiding busy`);
      hideBusy(); // IMPORTANT: Hide busy before returning
      return;
    }

    // IMPORTANT: Do NOT call showBusy() here - it was already called in dateUpdateHandler
    // Calling it again creates a NEW timeout that won't be properly cancelled
    LogHelper.log(`[TELEMETRY] 🔄 Processing data from orchestrator...`);

    LogHelper.log(`[TELEMETRY] Received ${items.length} items from orchestrator for domain ${domain}`);

    // Extract my datasource IDs
    const myDatasourceIds = extractDatasourceIds(self.ctx.datasources);
    //LogHelper.log(`[TELEMETRY] My datasource IDs:`, myDatasourceIds);
    //LogHelper.log(`[TELEMETRY] Sample orchestrator items:`, items.slice(0, 3));

    // RFC-0042: Debug datasources structure to understand the mapping
    /*
    if (self.ctx.datasources && self.ctx.datasources.length > 0) {
      LogHelper.log(`[TELEMETRY] Datasource[0] keys:`, Object.keys(self.ctx.datasources[0]));
      LogHelper.log(`[TELEMETRY] Datasource[0] entityId:`, self.ctx.datasources[0].entityId);
      LogHelper.log(`[TELEMETRY] Datasource[0] entityName:`, self.ctx.datasources[0].entityName);
      LogHelper.log(`[TELEMETRY] Datasource[0] full:`, JSON.stringify(self.ctx.datasources[0], null, 2));
    }
    if (self.ctx.data && self.ctx.data.length > 0) {
      LogHelper.log(`[TELEMETRY] Data[0] keys:`, Object.keys(self.ctx.data[0]));
      LogHelper.log(`[TELEMETRY] Data[0] full:`, JSON.stringify(self.ctx.data[0], null, 2));
    }
      */

    // Data filtering is done by datasource IDs (ThingsBoard handles grouping)

    // RFC-0042: Filter items by datasource IDs
    // ThingsBoard datasource entityId should match API item id (ingestionId)
    const datasourceIdSet = new Set(myDatasourceIds);
    let filtered = items.filter(item => {
      // Check if item.id (from API) matches any datasource entityId
      return datasourceIdSet.has(item.id) || datasourceIdSet.has(item.tbId);
    });

    LogHelper.log(`[TELEMETRY] Filtered ${items.length} items down to ${filtered.length} items matching datasources`);

    // If no matches, log warning and use all items (temporary fallback)
    if (filtered.length === 0) {
      LogHelper.warn(`[TELEMETRY] No items match datasource IDs! Using all items as fallback.`);
      LogHelper.warn(`[TELEMETRY] Sample datasource ID:`, myDatasourceIds[0]);
      LogHelper.warn(`[TELEMETRY] Sample API item ID:`, items[0]?.id);
      filtered = items;
    }

    // Convert orchestrator items to TELEMETRY widget format
    filtered = filtered.map(item => ({
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
      updatedIdentifiers: {}
    }));

    // DEBUG: Log sample item with value
    if (filtered.length > 0 && filtered[0].value > 0) {
      LogHelper.log(`[TELEMETRY] 🔍 Sample orchestrator item after mapping:`, {
        ingestionId: filtered[0].ingestionId,
        label: filtered[0].label,
        value: filtered[0].value
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
    filtered.forEach(item => {
      if (item.ingestionId) {
        const value = Number(item.value || 0);
        orchestratorValues.set(item.ingestionId, value);

        // Debug: log non-zero values from API
        if (value > 0) {
          LogHelper.log(`[TELEMETRY] ✅ Orchestrator has data: ${item.label} (${item.ingestionId}) = ${value}`);
        }
      }
    });
    LogHelper.log(`[TELEMETRY] Orchestrator values map size: ${orchestratorValues.size}`);

    // Update values in existing items
    STATE.itemsEnriched = STATE.itemsBase.map(tbItem => {
      const orchestratorValue = orchestratorValues.get(tbItem.ingestionId);

      // DEBUG: Log matching process for all items
      if (orchestratorValue !== undefined && orchestratorValue > 0) {
        LogHelper.log(`[TELEMETRY] ✅ MATCH FOUND: ${tbItem.label} (ingestionId: ${tbItem.ingestionId}) = ${orchestratorValue}`);
      } else {
        LogHelper.warn(`[TELEMETRY] ❌ NO MATCH: ${tbItem.label} (ingestionId: ${tbItem.ingestionId}), orchestrator=${orchestratorValue}, TB=${tbItem.value}`);
      }

      return {
        ...tbItem,
        value: orchestratorValue !== undefined ? orchestratorValue : (tbItem.value || 0),
        perc: 0
      };
    });

    LogHelper.log(`[TELEMETRY] Enriched ${STATE.itemsEnriched.length} items with orchestrator values`);

    // Sanitize selection
    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map(x => x.id));
      const next = new Set([...STATE.selectedIds].filter(id => valid.has(id)));
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
          LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator busy still visible after data processing - force hiding`);
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
      const key = String(row?.dataKey?.name || "").toLowerCase();
      const val = row?.data?.[0]?.[1];

      if (key === "ingestionid" && val && isValidUUID(String(val))) {
        ingestionIds.add(String(val));
      }
    }

    return Array.from(ingestionIds);
  }

  window.addEventListener('myio:telemetry:provide-data', dataProvideHandler);


  // RFC: Fix selection integration with FOOTER
  // When a card is selected, register entity and add it to MyIOSelectionStore so FOOTER can display it
  window.addEventListener('myio:device-params', (ev) => {
    try {
      LogHelper.log("[TELEMETRY] Card selected:", ev.detail);

      // IMPORTANT: Don't let selection errors break the main widget flow
      if (!ev.detail || !ev.detail.id) {
        LogHelper.warn("[TELEMETRY] Invalid card selection event, skipping SelectionStore");
        return;
      }

      // Try both MyIO.MyIOSelectionStore and window.MyIOSelectionStore
      const MyIOSelectionStore = MyIO?.MyIOSelectionStore || window.MyIOSelectionStore;

      if (MyIOSelectionStore) {
        // First, register the entity with full metadata from the card event
        const cardEntity = {
          id: ev.detail.id,
          name: ev.detail.name || 'Dispositivo',
          icon: ev.detail.icon || 'generic',
          group: ev.detail.deviceIdentifier || ev.detail.group || 'Dispositivo',
          lastValue: Number(ev.detail.total_value) || 0,
          unit: ev.detail.unit || (WIDGET_DOMAIN === 'energy' ? 'kWh' : WIDGET_DOMAIN === 'water' ? 'm³' : ''),
          status: ev.detail.status || 'unknown'
        };

        MyIOSelectionStore.registerEntity(cardEntity);
        LogHelper.log("[TELEMETRY] Entity registered in SelectionStore:", cardEntity);

        // Then add to selection (triggers events to FOOTER)
        MyIOSelectionStore.add(ev.detail.id);
        LogHelper.log("[TELEMETRY] Added to SelectionStore:", ev.detail.id);
      } else {
        LogHelper.warn("[TELEMETRY] MyIOSelectionStore not available, selection disabled");
      }

      // Also emit global event for backward compatibility
      window.dispatchEvent(new CustomEvent('myio:device-params-global', {
        detail: {
          id: ev.detail.id,
          name: ev.detail.name
        }
      }));
    } catch (err) {
      LogHelper.error("[TELEMETRY] Error in device-params listener (non-fatal):", err);
      // Don't rethrow - we don't want selection errors to break the widget
    }
  });

  // RFC: Handle card deselection
  window.addEventListener('myio:device-params-remove', (ev) => {
    try {
      LogHelper.log("[TELEMETRY] Card deselected:", ev.detail);

      if (!ev.detail || !ev.detail.id) {
        LogHelper.warn("[TELEMETRY] Invalid card deselection event, skipping");
        return;
      }

      // Try both MyIO.MyIOSelectionStore and window.MyIOSelectionStore
      const MyIOSelectionStore = MyIO?.MyIOSelectionStore || window.MyIOSelectionStore;

      // Remove from SelectionStore so FOOTER receives the selection:change event
      if (MyIOSelectionStore) {
        MyIOSelectionStore.remove(ev.detail.id);
        LogHelper.log("[TELEMETRY] Removed from SelectionStore:", ev.detail.id);
      } else {
        LogHelper.warn("[TELEMETRY] MyIOSelectionStore not available, selection disabled");
      }
    } catch (err) {
      LogHelper.error("[TELEMETRY] Error in device-params-remove listener (non-fatal):", err);
      // Don't rethrow - we don't want selection errors to break the widget
    }
  });
  // Check for stored data from orchestrator (in case we missed the event)
  setTimeout(() => {
    // RFC-0042: Check parent window for orchestrator data (if in iframe)
    const orchestratorData = window.MyIOOrchestratorData || window.parent?.MyIOOrchestratorData;

    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔍 Checking for stored orchestrator data...`);

    // First, try stored data
    if (orchestratorData && orchestratorData[WIDGET_DOMAIN]) {
      const storedData = orchestratorData[WIDGET_DOMAIN];
      const age = Date.now() - storedData.timestamp;

      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Found stored data: ${storedData.items?.length || 0} items, age: ${age}ms`);

      // Use stored data if it's less than 30 seconds old AND has items
      if (age < 30000 && storedData.items && storedData.items.length > 0) {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ Using stored orchestrator data (${window.MyIOOrchestratorData ? 'current' : 'parent'} window)`);
        dataProvideHandler({
          detail: {
            domain: WIDGET_DOMAIN,
            periodKey: storedData.periodKey,
            items: storedData.items
          }
        });
        return;
      } else {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ⚠️ Stored data is too old or empty, ignoring`);
      }
    } else {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ℹ️ No stored data found for domain ${WIDGET_DOMAIN}`);
    }

    // If no stored data AND we haven't requested yet, request fresh data
    if (!hasRequestedInitialData) {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 Requesting fresh data from orchestrator...`);
      requestDataFromOrchestrator();
    } else {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ⏭️ Skipping duplicate request (already requested via event)`);
    }
  }, 500); // Wait 500ms for widget to fully initialize

  // Auth do cliente/ingestion
  const customerTB_ID = self.ctx.settings?.customerTB_ID || "";
  //DEVICE_TYPE = self.ctx.settings?.DEVICE_TYPE || "energy";
  const jwt = localStorage.getItem("jwt_token");

  try {
    const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
    CLIENT_ID       = attrs?.client_id     || "";
    CLIENT_SECRET   = attrs?.client_secret || "";
    CUSTOMER_ING_ID = attrs?.ingestionId   || "";

    MyIOAuth = MyIO.buildMyioIngestionAuth({
      dataApiHost: DATA_API_HOST,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET
    });

    LogHelper.log("[DeviceCards] Auth init OK");
    try { await MyIOAuth.getToken(); } catch (_) {}
  } catch (err) {
    LogHelper.error("[DeviceCards] Auth init FAIL", err);
  }

  // Bind UI
  bindHeader();
  bindModal();

  // ---------- Datas iniciais: "Current Month So Far" ----------
  if (!self.ctx?.scope?.startDateISO || !self.ctx?.scope?.endDateISO) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);           // 1º dia 00:00
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 0); // hoje 23:59:59
    self.ctx.scope = self.ctx.scope || {};
    self.ctx.scope.startDateISO = start.toISOString();
    self.ctx.scope.endDateISO   = end.toISOString();
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
    STATE.itemsEnriched = STATE.itemsBase.map(item => ({ ...item, value: 0, perc: 0 }));
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
  /*
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
  */
};

// onDataUpdated removido (no-op por ora)
self.onDataUpdated = function () { /* no-op */ };

self.onResize = function () {};
self.onDestroy = function () {
  if (dateUpdateHandler) {
    window.removeEventListener("myio:update-date", dateUpdateHandler);
    LogHelper.log("[DeviceCards] Event listener 'myio:update-date' removido.");
  }
  if (dataProvideHandler) {
    window.removeEventListener('myio:telemetry:provide-data', dataProvideHandler);
    LogHelper.log("[DeviceCards] Event listener 'myio:telemetry:provide-data' removido.");
  }
  try { $root().off(); } catch (_e) {}
  hideBusy();
  hideGlobalSuccessModal();
};
