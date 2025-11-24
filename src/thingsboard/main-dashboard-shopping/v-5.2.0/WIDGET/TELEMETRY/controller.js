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
    if (DEBUG_ACTIVE) {
      console.error(...args);
    }
  },
};

LogHelper.log(
  "🚀 [TELEMETRY] Controller loaded - VERSION WITH ORCHESTRATOR SUPPORT"
);

const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
const MAX_FIRST_HYDRATES = 1;
let MAP_INSTANTANEOUS_POWER;

let __deviceProfileSyncComplete = false;

async function fetchDeviceProfiles() {
  const token = localStorage.getItem("jwt_token");
  if (!token) throw new Error("[RFC-0071] JWT token not found");

  const url = "/api/deviceProfile/names?activeOnly=true";

  console.log("[EQUIPMENTS] [RFC-0071] Fetching device profiles...");

  const response = await fetch(url, {
    headers: {
      "X-Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `[RFC-0071] Failed to fetch device profiles: ${response.status}`
    );
  }

  const profiles = await response.json();

  // Build Map: profileId -> profileName
  const profileMap = new Map();
  profiles.forEach((profile) => {
    const profileId = profile.id.id;
    const profileName = profile.name;
    profileMap.set(profileId, profileName);
  });

  console.log(
    `[EQUIPMENTS] [RFC-0071] Loaded ${profileMap.size} device profiles:`,
    Array.from(profileMap.entries())
      .map(([id, name]) => name)
      .join(", ")
  );

  return profileMap;
}

/**
 * Fetches device details including deviceProfileId
 * @param {string} deviceId - Device entity ID
 * @returns {Promise<Object>}
 */
async function fetchDeviceDetails(deviceId) {
  const token = localStorage.getItem("jwt_token");
  if (!token) throw new Error("[RFC-0071] JWT token not found");

  const url = `/api/device/${deviceId}`;

  const response = await fetch(url, {
    headers: {
      "X-Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `[RFC-0071] Failed to fetch device ${deviceId}: ${response.status}`
    );
  }

  return await response.json();
}

/**
 * Saves deviceProfile as a server-scope attribute on the device
 * @param {string} deviceId - Device entity ID
 * @param {string} deviceProfile - Profile name (e.g., "MOTOR", "3F_MEDIDOR")
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function addDeviceProfileAttribute(deviceId, deviceProfile) {
  const t = Date.now();

  try {
    if (!deviceId) throw new Error("deviceId is required");
    if (deviceProfile == null || deviceProfile === "") {
      throw new Error("deviceProfile is required");
    }

    const token = localStorage.getItem("jwt_token");
    if (!token) throw new Error("jwt_token not found in localStorage");

    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
    const headers = {
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${token}`,
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ deviceProfile }),
    });

    const bodyText = await res.text().catch(() => "");

    if (!res.ok) {
      throw new Error(
        `[RFC-0071] HTTP ${res.status} ${res.statusText} - ${bodyText}`
      );
    }

    let data = null;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      // Response may not be JSON
    }

    const dt = Date.now() - t;
    console.log(
      `[EQUIPMENTS] [RFC-0071] ✅ Saved deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms`
    );

    return { ok: true, status: res.status, data };
  } catch (err) {
    const dt = Date.now() - t;
    console.error(
      `[EQUIPMENTS] [RFC-0071] ❌ Failed to save deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms | error: ${
        err?.message || err
      }`
    );
    throw err;
  }
}

/**
 * Main synchronization function
 * Checks all devices and syncs missing deviceProfile attributes
 * @returns {Promise<{synced: number, skipped: number, errors: number}>}
 */
async function syncDeviceProfileAttributes() {
  console.log(
    "[EQUIPMENTS] [RFC-0071] 🔄 Starting device profile synchronization..."
  );

  try {
    // Step 1: Fetch all device profiles
    const profileMap = await fetchDeviceProfiles();

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Step 2: Build a map of devices that need sync
    const deviceMap = new Map();

    self.ctx.data.forEach((data) => {
      const entityId = data.datasource?.entity?.id?.id;
      const existingProfile = data.datasource?.deviceProfile;

      if (!entityId) return;

      // Skip if already has deviceProfile attribute
      if (existingProfile) {
        skipped++;
        return;
      }

      // Store for processing (deduplicate by entityId)
      if (!deviceMap.has(entityId)) {
        deviceMap.set(entityId, {
          entityLabel: data.datasource?.entityLabel,
          entityName: data.datasource?.entityName,
          name: data.datasource?.name,
        });
      }
    });

    console.log(
      `[EQUIPMENTS] [RFC-0071] Found ${deviceMap.size} devices without deviceProfile attribute`
    );
    console.log(
      `[EQUIPMENTS] [RFC-0071] Skipped ${skipped} devices that already have deviceProfile`
    );

    if (deviceMap.size === 0) {
      console.log(
        "[EQUIPMENTS] [RFC-0071] ✅ All devices already synchronized!"
      );
      return { synced: 0, skipped, errors: 0 };
    }

    // Step 3: Fetch device details and sync attributes
    let processed = 0;
    for (const [entityId, deviceInfo] of deviceMap) {
      processed++;
      const deviceLabel =
        deviceInfo.entityLabel ||
        deviceInfo.entityName ||
        deviceInfo.name ||
        entityId;

      try {
        console.log(
          `[EQUIPMENTS] [RFC-0071] Processing ${processed}/${deviceMap.size}: ${deviceLabel}`
        );

        // Fetch device details to get deviceProfileId
        const deviceDetails = await fetchDeviceDetails(entityId);
        const deviceProfileId = deviceDetails.deviceProfileId?.id;

        if (!deviceProfileId) {
          console.warn(
            `[EQUIPMENTS] [RFC-0071] ⚠️ Device ${deviceLabel} has no deviceProfileId`
          );
          errors++;
          continue;
        }

        // Look up profile name from map
        const profileName = profileMap.get(deviceProfileId);

        if (!profileName) {
          console.warn(`[EQUIPMENTS] [RFC-0071] ⚠️ Profile ID ${deviceProfileId} not found in map`);
          errors++;
          continue;
        }

        // Save attribute
        await addDeviceProfileAttribute(entityId, profileName);
        synced++;

        console.log(`[EQUIPMENTS] [RFC-0071] ✅ Synced ${deviceLabel} -> ${profileName}`);

        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[EQUIPMENTS] [RFC-0071] ❌ Failed to sync device ${deviceLabel}:`, error);
        errors++;
      }
    }

    console.log(`[EQUIPMENTS] [RFC-0071] 🎉 Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);

    return { synced, skipped, errors };
  } catch (error) {
    console.error("[EQUIPMENTS] [RFC-0071] ❌ Fatal error during sync:", error);
    throw error;
  }
}

/**
 * Get telemetry data by dataKey name from self.ctx.data
 * @param {string} dataKeyName - The dataKey name to search for
 * @returns {*} The value of the data point, or null if not found
 */
function getData(dataKeyName) {
  if (!self?.ctx?.data) {
    LogHelper.warn("[getData] No ctx.data available");
    return null;
  }

  for (const device of self.ctx.data) {
    if (device.dataKey && device.dataKey.name === dataKeyName) {
      // Return the most recent value (last item in data array)
      if (device.data && device.data.length > 0) {
        const lastDataPoint = device.data[device.data.length - 1];
        return lastDataPoint[1]; // [timestamp, value]
      }
    }
  }

  LogHelper.warn(`[getData] DataKey "${dataKeyName}" not found in ctx.data`);
  return null;
}

let dateUpdateHandler = null;
let dataProvideHandler = null; // RFC-0042: Orchestrator data listener
//let DEVICE_TYPE = "energy";
let MyIO = null;
let hasRequestedInitialData = false; // Flag to prevent duplicate initial requests
let lastProcessedPeriodKey = null; // Track last processed periodKey to prevent duplicate processing
let busyTimeoutId = null; // Timeout ID for busy fallback

// RFC-0042: Widget configuration (from settings)
let WIDGET_DOMAIN = "energy"; // Will be set in onInit

// RFC-0063: Classification mode configuration
let USE_IDENTIFIER_CLASSIFICATION = false; // Flag to enable identifier-based classification
let USE_HYBRID_CLASSIFICATION = false; // Flag to enable hybrid mode (identifier + labels)

/** ===================== STATE ===================== **/
let CLIENT_ID = "";
let CLIENT_SECRET = "";
let CUSTOMER_ING_ID = "";
let MyIOAuth = null;

const STATE = {
  itemsBase: [], // lista autoritativa (TB)
  itemsEnriched: [], // lista com totals + perc
  searchActive: false,
  searchTerm: "",
  selectedIds: /** @type {Set<string> | null} */ (null),
  sortMode: /** @type {'cons_desc'|'cons_asc'|'alpha_asc'|'alpha_desc'} */ (
    "cons_desc"
  ),
  firstHydrates: 0,
};

let hydrating = false;

/** ===================== HELPERS (DOM) ===================== **/
const $root = () => $(self.ctx.$container[0]);
const $list = () => $root().find("#shopsList");
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
  $root().css("position", "relative"); // garante overlay correto
  $root().append(html);
  return $root().find(`#${BUSY_ID}`);
}
// RFC-0044: Use centralized busy management
function showBusy(message, timeoutMs = 35000) {
  LogHelper.log(
    `[TELEMETRY] 🔄 showBusy() called with message: "${message || "default"}"`
  );

  // Prevent multiple simultaneous busy calls
  if (window.busyInProgress) {
    LogHelper.log(`[TELEMETRY] ⏭️ Skipping duplicate showBusy() call`);
    return;
  }

  window.busyInProgress = true;

  // Centralized busy with enhanced synchronization
  const safeShowBusy = () => {
    try {
      if (
        window.MyIOOrchestrator &&
        typeof window.MyIOOrchestrator.showGlobalBusy === "function"
      ) {
        const text =
          (message && String(message).trim()) || "Carregando dados...";
        window.MyIOOrchestrator.showGlobalBusy(WIDGET_DOMAIN, text, timeoutMs);
        LogHelper.log(`[TELEMETRY] ✅ Using centralized busy for domain: ${WIDGET_DOMAIN}`);
      } else {
        LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator not available, using fallback busy`);
        const $m = ensureBusyModalDOM();
        const text = (message && String(message).trim()) || "aguarde.. carregando os dados...";
        $m.find(`#${BUSY_ID}-msg`).text(text);
        $m.css("display", "flex");
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

  // RFC-0051.3: Check if orchestrator exists and is ready
  const checkOrchestratorReady = async () => {
    // First, check if orchestrator exists and is ready
    if (window.MyIOOrchestrator?.isReady) {
      safeShowBusy();
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
        window.removeEventListener("myio:orchestrator:ready", handler);
        resolve(true);
      };

      window.addEventListener("myio:orchestrator:ready", handler);

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        clearInterval(interval);
        window.removeEventListener("myio:orchestrator:ready", handler);
        LogHelper.warn("[TELEMETRY] ⚠️ Orchestrator ready timeout after 5s, using fallback");
        resolve(false);
      }, 5000);

      // Also poll isReady flag (fallback if event is missed)
      interval = setInterval(() => {
        if (window.MyIOOrchestrator?.isReady) {
          clearInterval(interval);
          clearTimeout(timeout);
          window.removeEventListener("myio:orchestrator:ready", handler);
          resolve(true);
        }
      }, 100);
    });

    safeShowBusy();
  };

  checkOrchestratorReady();
}

function hideBusy() {
  LogHelper.log(`[TELEMETRY] ⏸️ hideBusy() called`);

  const safeHideBusy = () => {
    try {
      if (
        window.MyIOOrchestrator &&
        typeof window.MyIOOrchestrator.hideGlobalBusy === "function"
      ) {
        window.MyIOOrchestrator.hideGlobalBusy();
        LogHelper.log(`[TELEMETRY] ✅ Using centralized hideBusy`);
      } else {
        LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator not available, using fallback hideBusy`);
        $root().find(`#${BUSY_ID}`).css("display", "none");
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
        window.removeEventListener("myio:orchestrator:ready", handler);
        resolve(true);
      };

      window.addEventListener("myio:orchestrator:ready", handler);

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        clearInterval(interval);
        window.removeEventListener("myio:orchestrator:ready", handler);
        LogHelper.warn("[TELEMETRY] ⚠️ Orchestrator ready timeout after 5s, using fallback");
        resolve(false);
      }, 5000);

      // Also poll isReady flag (fallback if event is missed)
      interval = setInterval(() => {
        if (window.MyIOOrchestrator?.isReady) {
          clearInterval(interval);
          clearTimeout(timeout);
          window.removeEventListener("myio:orchestrator:ready", handler);
          resolve(true);
        }
      }, 100);
    });

    safeHideBusy();
  };

  checkOrchestratorReady();
}

const findValue = (values, dataType, defaultValue = "N/D") => {
  const item = values.find((v) => v.dataType === dataType);
  if (!item) return defaultValue;
  // Retorna a propriedade 'val' (da nossa API) ou 'value' (do ThingsBoard)
  return item.val !== undefined ? item.val : item.value;
};

/** ===================== GLOBAL SUCCESS MODAL (fora do widget) ===================== **/
const G_SUCCESS_ID = "myio-global-success-modal";
let gSuccessTimer = null;

function ensureGlobalSuccessModalDOM() {
  let el = document.getElementById(G_SUCCESS_ID);
  if (el) return el;

  const wrapper = document.createElement("div");
  wrapper.id = G_SUCCESS_ID;
  wrapper.setAttribute(
    "style",
    `
    position: fixed; inset: 0; display: none;
    z-index: 999999; 
    background: rgba(150,132,181,0.45); /* #9684B5 com transparência */
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  `
  );

  // container central
  const center = document.createElement("div");
  center.setAttribute(
    "style",
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
  title.setAttribute(
    "style",
    `font-size:16px;font-weight:700;letter-spacing:.2px;margin-bottom:6px;`
  );

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
      try {
        window.location.reload();
      } catch (_) {}
    }
  }, 1000);
}

function hideGlobalSuccessModal() {
  const el = document.getElementById(G_SUCCESS_ID);
  if (el) el.style.display = "none";
  if (gSuccessTimer) {
    clearInterval(gSuccessTimer);
    gSuccessTimer = null;
  }
}

/** ===================== UTILS ===================== **/
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidUUID(v) {
  if (!v || typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    v
  );
}

function toSpOffsetNoMs(dt, endOfDay = false) {
  const d =
    typeof dt === "number"
      ? new Date(dt)
      : dt instanceof Date
      ? dt
      : new Date(String(dt));
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(
    2,
    "0"
  )}:${String(d.getMinutes()).padStart(2, "0")}:${String(
    d.getSeconds()
  ).padStart(2, "0")}-03:00`;
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

  return Number(raw || 0);
}
function mustGetDateRange() {
  const s = self.ctx?.scope?.startDateISO;
  const e = self.ctx?.scope?.endDateISO;
  if (s && e) return { startISO: s, endISO: e };
  throw new Error("DATE_RANGE_REQUIRED");
}

const isAuthReady = () =>
  !!(MyIOAuth && typeof MyIOAuth.getToken === "function");
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
  const byTbId = new Map(); // tbId -> { slaveId, centralId, deviceType, centralName, lastConnectTime, lastActivityTime, connectionStatus }
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
  for (const row of rows) {
    const key = String(row?.dataKey?.name || "").toLowerCase();
    const tbId =
      row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val = row?.data?.[0]?.[1];
    if (!tbId || val == null) continue;
    if (!byTbId.has(tbId))
      byTbId.set(tbId, {
        slaveId: null,
        centralId: null,
        deviceType: null,
        deviceProfile: null,
        centralName: null,
        customerName: null,
        lastConnectTime: null,
        lastActivityTime: null,
        connectionStatus: null,
      });
    const slot = byTbId.get(tbId);
    if (key === "slaveid") slot.slaveId = val;
    if (key === "centralid") slot.centralId = val;
    if (key === "devicetype") slot.deviceType = val;
    if (key === "deviceprofile") slot.deviceProfile = val;
    if (key === "centralname") slot.centralName = val;
    if (key === "customername") slot.customerName = val;
    if (key === "lastconnecttime") slot.lastConnectTime = val;
    if (key === "lastactivitytime") slot.lastActivityTime = val;
    if (key === "connectionstatus") slot.connectionStatus = String(val).toLowerCase();
  }
  return byTbId;
}
function buildTbIdIndexes() {
  const byIdentifier = new Map(); // identifier -> tbId
  const byIngestion = new Map(); // ingestionId -> tbId
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
  for (const row of rows) {
    const key = String(row?.dataKey?.name || "").toLowerCase();
    const tbId =
      row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val = row?.data?.[0]?.[1];
    if (!tbId || val == null) continue;
    if (key === "identifier") byIdentifier.set(String(val), tbId);
    if (key === "ingestionid") byIngestion.set(String(val), tbId);
  }
  return { byIdentifier, byIngestion };
}

/** ===================== CORE: DATA PIPELINE ===================== **/
function buildAuthoritativeItems() {
  // items da LIB: [{ id: ingestionId, identifier, label }, ...]
  const base =
    MyIO.buildListItemsThingsboardByUniqueDatasource(
      self.ctx.datasources,
      self.ctx.data
    ) || [];

  //LogHelper.log("[TELEMETRY][buildAuthoritativeItems] base: ", base);

  const ok = Array.isArray(base) ? base.filter((x) => x && x.id) : [];

  const tbIdIdx = buildTbIdIndexes(); // { byIdentifier, byIngestion }
  const attrsByTb = buildTbAttrIndex(); // tbId -> { slaveId, centralId, deviceType }

  const mapped = ok.map((r) => {
    //LogHelper.log("[TELEMETRY][buildAuthoritativeItems] ok.map: ", r);

    const ingestionId = r.id;
    const tbFromIngestion = ingestionId
      ? tbIdIdx.byIngestion.get(ingestionId)
      : null;
    const tbFromIdentifier = r.identifier
      ? tbIdIdx.byIdentifier.get(r.identifier)
      : null;

    let tbId = tbFromIngestion || tbFromIdentifier || null;
    if (
      tbFromIngestion &&
      tbFromIdentifier &&
      tbFromIngestion !== tbFromIdentifier
    ) {
      /*
      LogHelper.warn("[DeviceCards] TB id mismatch for item", {
        label: r.label, identifier: r.identifier, ingestionId, tbFromIngestion, tbFromIdentifier
      });
      */
      tbId = tbFromIngestion;
    }

    const attrs = tbId ? attrsByTb.get(tbId) || {} : {};
    const deviceProfile = attrs.deviceProfile || "N/D";
    let deviceTypeToDisplay = attrs.deviceType || "3F_MEDIDOR";

    if (deviceTypeToDisplay === "3F_MEDIDOR" && deviceProfile !== "N/D") {
      deviceTypeToDisplay = deviceProfile;
    }

    // Extract telemetry data from ThingsBoard ctx.data
    // - TANK/CAIXA_DAGUA: water_level, water_percentage
    // - ENERGY devices: consumption (most recent value)
    let waterLevel = null;
    let waterPercentage = null;
    let consumption = null;
    const isTankDevice = deviceTypeToDisplay === "TANK" || deviceTypeToDisplay === "CAIXA_DAGUA";

    if (tbId) {
      // Search for telemetry in ctx.data for this specific device
      const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
      for (const row of rows) {
        const rowTbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
        if (rowTbId === tbId) {
          const key = String(row?.dataKey?.name || "").toLowerCase();
          const val = row?.data?.[0]?.[1]; // Most recent value

          // TANK specific telemetry
          if (key === "water_level") waterLevel = Number(val) || 0;
          if (key === "water_percentage") waterPercentage = Number(val) || 0;

          // ENERGY/WATER devices: consumption (most recent)
          if (key === "consumption") consumption = Number(val) || 0;
        }
      }
    }

    // Calculate deviceStatus based on connectionStatus and current telemetry value
    // connectionStatus comes from TB attribute: "online" or "offline"
    const tbConnectionStatus = attrs.connectionStatus; // "online" or "offline" from TB

    console.log('tbConnectionStatus', tbConnectionStatus);
    
    
    let deviceStatus = "no_info"; // default

    if (tbConnectionStatus === "offline") {
      deviceStatus = "no_info"; // offline = no_info
    } else if (tbConnectionStatus === "online") {
      // If online, check if device has recent consumption/level > 0
      // let currentValue = 0;
      // if (isTankDevice) {
      //   currentValue = waterLevel || 0;
      // } else {
      //   currentValue = consumption || 0;
      // }
      // console.log('consumption', consumption);
      
      // console.log('currentValue', currentValue);
      
      //deviceStatus = currentValue > 0 ? "power_on" : "power_off";
      deviceStatus = "power_on"; // Simplified logic: if online, consider power_on
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
      customerName: attrs.customerName ?? null,
      deviceType: deviceTypeToDisplay,
      updatedIdentifiers: {},
      connectionStatusTime: attrs.lastConnectTime ?? null,
      timeVal: attrs.lastActivityTime ?? null,
      deviceStatus: deviceStatus, // Calculated based on connectionStatus + value
      // TANK/CAIXA_DAGUA specific fields
      waterLevel: waterLevel,
      waterPercentage: waterPercentage,
      mapInstantaneousPower: MAP_INSTANTANEOUS_POWER,
      // Use waterLevel as the value for TANK devices (instead of from /totals API)
      value: isTankDevice ? (waterLevel || 0) : 0,
      perc: isTankDevice ? (waterPercentage || 0) : 0,
    };
  });

  //LogHelper.log(`[DeviceCards] TB items: ${mapped.length}`);
  return mapped;
}

async function fetchApiTotals(startISO, endISO) {
  if (!isAuthReady()) throw new Error("Auth not ready");
  const token = await MyIOAuth.getToken();
  if (!token) throw new Error("No ingestion token");

  const url = new URL(
    `${DATA_API_HOST}/api/v1/telemetry/customers/${CUSTOMER_ING_ID}/energy/devices/totals`
  );
  url.searchParams.set("startTime", toSpOffsetNoMs(startISO));
  url.searchParams.set("endTime", toSpOffsetNoMs(endISO, true));
  url.searchParams.set("deep", "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    LogHelper.warn("[DeviceCards] API fetch failed:", res.status);
    return new Map();
  }

  const json = await res.json();
  const rows = Array.isArray(json) ? json : json?.data ?? [];
  const map = new Map();
  for (const r of rows) if (r && r.id) map.set(String(r.id), r);
  //LogHelper.log(`[DeviceCards] API rows: ${rows.length}, map keys: ${map.size}`);
  return map;
}

function enrichItemsWithTotals(items, apiMap) {
  return items.map((it) => {
    let raw = 0;

    if (it.ingestionId && isValidUUID(it.ingestionId)) {
      const row = apiMap.get(String(it.ingestionId));
      raw = Number(row?.total_value ?? 0);
    }

    const value = Number(raw || 0); // toTargetUnit(raw); TODO verificar se ainda precisa dessa chamada

    return { ...it, value, perc: 0 };
  });
}

/** ===================== FILTERS / SORT / PERC ===================== **/
function applyFilters(enriched, searchTerm, selectedIds, sortMode) {
  let v = enriched.slice();

  if (selectedIds && selectedIds.size) {
    v = v.filter((x) => selectedIds.has(x.id));
  }

  const q = (searchTerm || "").trim().toLowerCase();
  if (q) {
    v = v.filter(
      (x) =>
        (x.label || "").toLowerCase().includes(q) ||
        String(x.identifier || "")
          .toLowerCase()
          .includes(q)
    );
  }

  v.sort((a, b) => {
    if (sortMode === "cons_desc") {
      if (a.value !== b.value) return b.value - a.value;
      return (a.label || "").localeCompare(b.label || "", "pt-BR", {
        sensitivity: "base",
      });
    }
    if (sortMode === "cons_asc") {
      if (a.value !== b.value) return a.value - b.value;
      return (a.label || "").localeCompare(b.label || "", "pt-BR", {
        sensitivity: "base",
      });
    }
    if (sortMode === "alpha_desc") {
      return (
        (b.label || "").localeCompare(a.label || "", "pt-BR", {
          sensitivity: "base",
        }) || b.value - a.value
      );
    }
    return (
      (a.label || "").localeCompare(b.label || "", "pt-BR", {
        sensitivity: "base",
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
function renderHeader(count, groupSum) {
  $count().text(`(${count})`);

  // Format based on widget domain
  let formattedTotal = groupSum.toFixed(2);
  if (WIDGET_DOMAIN === "energy") {
    formattedTotal = MyIO.formatEnergy(groupSum);
  } else if (WIDGET_DOMAIN === "water") {
    formattedTotal = MyIO.formatWaterVolumeM3(groupSum);
  } else if (WIDGET_DOMAIN === "tank") {
    formattedTotal = MyIO.formatTankHeadFromCm(groupSum);
  }

  $total().text(formattedTotal);
}

function renderList(visible) {
  const $ul = $list().empty();

  visible.forEach((it) => {
    const valNum = Number(it.value || 0);
    
    // Note: deviceStatus comes from buildAuthoritativeItems (based on TB connectionStatus + telemetry)
    // Don't recalculate here - it would be incorrect for ENERGY devices

    // RFC-0063: Safe identifier handling with fallbacks
    let deviceIdentifierToDisplay = "N/A";
    if (it.identifier) {
      // Has identifier attribute
      if (String(it.identifier).includes("Sem Identificador identificado")) {
        // Identifier exists but is marked as "unknown" - infer from label
        const label = String(it.label || "").toLowerCase();
        deviceIdentifierToDisplay = label.includes("fancoil")
          ? "FANCOIL"
          : "CAG";
      } else {
        // Valid identifier
        deviceIdentifierToDisplay = it.identifier;
      }
    } else {
      // No identifier attribute - try to infer from label
      const label = String(it.label || "").toLowerCase();
      if (label.includes("fancoil")) {
        deviceIdentifierToDisplay = "FANCOIL";
      } else if (label.includes("cag")) {
        deviceIdentifierToDisplay = "CAG";
      } else if (label.includes("elevador") || label.includes("elv")) {
        deviceIdentifierToDisplay = "ELV";
      } else if (label.includes("escada")) {
        deviceIdentifierToDisplay = "ESC";
      } else {
        deviceIdentifierToDisplay = "N/A";
      }
    }
    

    const entityObject = {
      entityId: it.tbId || it.id, // preferir TB deviceId
      labelOrName: it.label.toUpperCase(),
      deviceType: it.label.includes("dministra") ? "3F_MEDIDOR" : it.deviceType,
      val: valNum, // TODO verificar ESSE MULTIPLICADOR PQ PRECISA DELE ?
      perc: it.perc ?? 0,
      deviceStatus: it.deviceStatus || "no_info", // Use from buildAuthoritativeItems (based on TB connectionStatus + telemetry)
      entityType: "DEVICE",
      deviceIdentifier: deviceIdentifierToDisplay,
      slaveId: it.slaveId || "N/A",
      ingestionId: it.ingestionId || "N/A",
      centralId: it.centralId || "N/A",
      centralName: it.centralName || "",
      customerName: it.customerName || null,
      updatedIdentifiers: it.updatedIdentifiers || {},
      connectionStatusTime: it.connectionStatusTime || Date.now(),
      timeVal: it.timeVal || Date.now(),
      // TANK/CAIXA_DAGUA specific fields
      waterLevel: it.waterLevel || null,
      waterPercentage: it.waterPercentage || null,
    };

    if (it.label === "Allegria") {
      //LogHelper.log("RENDER CARD ALLEGRIA >>> it.value: " , it.value);
    }

    const myTbToken = localStorage.getItem("jwt_token");
    let cachedIngestionToken = null;

    MyIOAuth.getToken()
      .then((token) => {
        cachedIngestionToken = token;
      })
      .catch((err) => LogHelper.warn("Token cache failed:", err));

    const $card = MyIO.renderCardComponentV5({
      entityObject,
      useNewComponents: true, // Habilitar novos componentes
      enableSelection: true, // Habilitar seleção
      enableDragDrop: true, // Habilitar drag and drop

      handleActionDashboard: async () => {
        const jwtToken = localStorage.getItem("jwt_token");
        const MyIOToast = MyIOLibrary?.MyIOToast || window.MyIOToast;

        if (!jwtToken) {
          if (MyIOToast) {
            MyIOToast.error("Authentication required. Please login again.");
          } else {
            alert("Authentication required. Please login again.");
          }
          return;
        }

        const startTs = self.ctx?.scope?.startTs || Date.now() - 86400000;
        const endTs = self.ctx?.scope?.endTs || Date.now();
        const deviceType = it.deviceType || entityObject.deviceType;
        const isWaterTank = deviceType === "TANK" || deviceType === "CAIXA_DAGUA";

        LogHelper.log(
          "[TELEMETRY v5] Opening dashboard for deviceType:",
          deviceType,
          "isWaterTank:",
          isWaterTank,
          "deviceId:",
          it.id,
          "tbId:",
          it.tbId,
          "startTs:",
          startTs,
          "endTs:",
          endTs
        );

        // Show loading toast
        let loadingToast = null;
        if (MyIOToast) {
          loadingToast = MyIOToast.info(
            isWaterTank
              ? "Loading water tank data..."
              : "Loading energy data...",
            0 // No auto-hide
          );
        }

        try {
          if (isWaterTank) {
            // Water Tank Modal Path
            LogHelper.log("[TELEMETRY v5] 🌊 Entering TANK device modal path...");

            LogHelper.log(
              "[TELEMETRY v5] MyIOLibrary available:",
              typeof MyIOLibrary !== 'undefined',
              "openDashboardPopupWaterTank exists:",
              typeof MyIOLibrary?.openDashboardPopupWaterTank
            );

            if (typeof MyIOLibrary?.openDashboardPopupWaterTank !== "function") {
              const errorMsg = "Water tank modal not available. Please update MyIO library.";
              LogHelper.error("[TELEMETRY v5] ❌", errorMsg);
              throw new Error(errorMsg);
            }

            // For TANK/CAIXA_DAGUA: get water level from telemetry
            const waterLevel = getData("water_level");
            const waterPercentage = getData("water_percentage");
            const currentLevel = waterPercentage || it.perc || it.val || 0;

            LogHelper.log("[TELEMETRY v5] Water tank telemetry data:", {
              water_level: waterLevel,
              water_percentage: waterPercentage,
              currentLevel: currentLevel,
              it_perc: it.perc,
              it_val: it.val
            });

            LogHelper.log(
              "[TELEMETRY v5] Calling openDashboardPopupWaterTank with params:",
              {
                deviceId: it.id,
                deviceType: deviceType,
                startTs:
                  typeof startTs === "number"
                    ? startTs
                    : new Date(startTs).getTime(),
                endTs:
                  typeof endTs === "number" ? endTs : new Date(endTs).getTime(),
                label: it.label || it.name || "Water Tank",
                currentLevel: currentLevel,
              }
            );

            LogHelper.log("[TELEMETRY v5] ⏳ About to call openDashboardPopupWaterTank...");

            const modalHandle = await MyIOLibrary.openDashboardPopupWaterTank({
              deviceId: it.id,
              deviceType: deviceType,
              tbJwtToken: jwtToken,
              startTs: typeof startTs === "number" ? startTs : new Date(startTs).getTime(),
              endTs: typeof endTs === "number" ? endTs : new Date(endTs).getTime(),
              label: it.label || it.name || "Water Tank",
              currentLevel: currentLevel,
              slaveId: it.slaveId,
              centralId: it.centralId,
              timezone: self.ctx?.timeWindow?.timezone || "America/Sao_Paulo",
              telemetryKeys: [
                "water_level",
                "water_percentage",
                "waterLevel",
                "nivel",
                "level",
              ],
              onOpen: (context) => {
                LogHelper.log( "[TELEMETRY v5] ✅ Water tank modal opened successfully!", context);
                if (loadingToast) loadingToast.hide();
                hideBusy();
              },
              onClose: () => {
                LogHelper.log("[TELEMETRY v5] 🚪 Water tank modal onClose callback triggered");
              },
              onError: (error) => {
                LogHelper.error("[TELEMETRY v5] ❌ Water tank modal error:", error);
                if (loadingToast) loadingToast.hide();
                hideBusy();
                if (MyIOToast) {
                  MyIOToast.error(`Error: ${error.message}`);
                } else {
                  alert(`Error: ${error.message}`);
                }
              },
            });

            LogHelper.log("[TELEMETRY v5] ✅ Water tank modal handle received:", modalHandle);
          } else {
            // Energy/Water/Temperature Modal Path (Ingestion API)
            LogHelper.log("[TELEMETRY v5] Opening energy modal...");
            const tokenIngestionDashBoard = await MyIOAuth.getToken();
            const modal = MyIO.openDashboardPopupEnergy({
              deviceId: it.id,
              readingType: WIDGET_DOMAIN, // 'energy', 'water', or 'tank'
              startDate: self.ctx.scope.startDateISO,
              endDate: self.ctx.scope.endDateISO,
              tbJwtToken: jwtToken,
              ingestionToken: tokenIngestionDashBoard,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              onOpen: (context) => {
                LogHelper.log("[TELEMETRY v5] Energy modal opened:", context);
                if (loadingToast) loadingToast.hide();
                hideBusy();
              },
              onError: (error) => {
                LogHelper.error("[TELEMETRY v5] Energy modal error:", error);
                if (loadingToast) loadingToast.hide();
                hideBusy();
                if (MyIOToast) {
                  MyIOToast.error(`Erro: ${error.message}`);
                } else {
                  alert(`Erro: ${error.message}`);
                }
              },
              onClose: () => {
                LogHelper.log("[TELEMETRY v5] Energy modal closed");
              },
            });
          }
        } catch (err) {
          LogHelper.error(
            "[TELEMETRY v5] Dashboard action failed:",
            err?.message || err,
            err
          );

          if (loadingToast) loadingToast.hide();
          hideBusy();

          if (MyIOToast) {
            MyIOToast.error(err?.message || "Failed to open dashboard");
          } else {
            alert(err?.message || "Failed to open dashboard");
          }
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
              ingestionToken,
            },
          });
        } catch (err) {
          LogHelper.warn("[DeviceCards] Report open blocked:", err?.message || err);
          alert("Credenciais ainda carregando. Tente novamente em instantes.");
        } finally {
          hideBusy();
        }
      },

      handleActionSettings: async () => {
        showBusy(null, 3000); // mensagem fixa
        // resolve TB id “fresh”
        let tbId = it.tbId;
        if (!tbId || !isValidUUID(tbId)) {
          const idx = buildTbIdIndexes();
          tbId = (it.ingestionId && idx.byIngestion.get(it.ingestionId)) || (it.identifier && idx.byIdentifier.get(it.identifier)) || null;
        }
        if (!tbId || tbId === it.ingestionId) {
          LogHelper.warn("[DeviceCards] Missing/ambiguous TB id for Settings", {
            label: it.label,
            identifier: it.identifier,
            ingestionId: it.ingestionId,
            tbId,
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
            domain: WIDGET_DOMAIN,
            deviceType: it.deviceType,
            connectionData: {
              centralName: it.centralName,
              connectionStatusTime: it.connectionStatusTime || Date.now(),
              timeVal: it.timeVal || Date.now(),
              deviceStatus: it.deviceStatus || "no_info",
            },
            ui: { title: "Configurações", width: 900 },
            mapInstantaneousPower: it.mapInstantaneousPower, // RFC-0078: Pass existing map if available
            onSaved: (payload) => {
              LogHelper.log("[Settings Saved]", payload);
              //hideBusy();
              // Mostra modal global de sucesso com contador e reload
              // showGlobalSuccessModal(6);
            },
            onClose: () => {
              $(".myio-settings-modal-overlay").remove();
              hideBusy();
            },
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

    if (STATE.searchActive)
      setTimeout(() => $root().find("#shopsSearch").trigger("focus"), 30);
  });

  $root().on("input", "#shopsSearch", (ev) => {
    STATE.searchTerm = ev.target.value || "";
    reflowFromState();
  });

  $root().on("click", "#btnFilter", () => openFilterModal());
}

function openFilterModal() {
  const $m = $modal();
  const $cl = $m.find("#deviceChecklist").empty();

  const list = (STATE.itemsBase || []).slice().sort((a, b) =>
    (a.label || "").localeCompare(b.label || "", "pt-BR", {
      sensitivity: "base",
    })
  );

  if (!list.length) {
    $cl.html('<div class="muted">Nenhuma loja carregada.</div>');
    $m.removeClass("hidden");
    return;
  }

  const selected = STATE.selectedIds;
  const frag = document.createDocumentFragment();

  for (const it of list) {
    const safeId =
      String(it.id || "")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 60) || "id" + Math.random().toString(36).slice(2);
    const checked = !selected || !selected.size || selected.has(it.id);

    const label = document.createElement("label");
    label.className = "check-item";
    label.setAttribute("role", "option");
    label.innerHTML = `
      <input type="checkbox" id="chk-${safeId}" data-entity="${escapeHtml(
      it.id
    )}" ${checked ? "checked" : ""}>
      <span>${escapeHtml(it.label || it.identifier || it.id)}</span>
    `;
    frag.appendChild(label);
  }

  $cl[0].appendChild(frag);
  $m.find(`input[name="sortMode"][value="${STATE.sortMode}"]`).prop(
    "checked",
    true
  );

  const $footer = $m.find(".shops-modal-footer");
  if ($footer.length)
    $footer.show().find("#applyFilters, #resetFilters").show();

  syncChecklistSelectionVisual();
  $m.removeClass("hidden");
}
function closeFilterModal() {
  $modal().addClass("hidden");
}

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
    $modal()
      .find('input[name="sortMode"][value="cons_desc"]')
      .prop("checked", true);
    syncChecklistSelectionVisual();
    reflowFromState();
  });

  $root().on("click", "#applyFilters", (ev) => {
    ev.preventDefault();
    const set = new Set();
    $modal()
      .find('.check-item input[type="checkbox"]:checked')
      .each((_, el) => {
        const id = $(el).data("entity");
        if (id) set.add(id);
      });

    STATE.selectedIds =
      set.size === 0 || set.size === STATE.itemsBase.length ? null : set;
    STATE.sortMode = String(
      $modal().find('input[name="sortMode"]:checked').val() || "cons_desc"
    );

    reflowFromState();
    closeFilterModal();
  });

  $root().on("input", "#filterDeviceSearch", (ev) => {
    const q = (ev.target.value || "").trim().toLowerCase();
    $modal()
      .find(".check-item")
      .each((_, node) => {
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
    if (
      ev.target &&
      ev.target.tagName &&
      ev.target.tagName.toLowerCase() === "input"
    )
      return;
    ev.preventDefault();
    ev.stopPropagation();
    const $chk = $(this).find('input[type="checkbox"]');
    $chk.prop("checked", !$chk.prop("checked")).trigger("change");
  });

  $root().on("change", '#deviceChecklist input[type="checkbox"]', function () {
    const $wrap = $(this).closest(".check-item");
    const on = this.checked;
    $wrap
      .toggleClass("selected", on)
      .attr("data-checked", on ? "true" : "false");
    $wrap.css(
      on
        ? {
            background: "rgba(62,26,125,.08)",
            borderColor: "#3E1A7D",
            boxShadow: "0 8px 18px rgba(62,26,125,.15)",
          }
        : {
            background: "#fff",
            borderColor: "#D6E1EC",
            boxShadow: "0 6px 14px rgba(0,0,0,.05)",
          }
    );
  });
}

function syncChecklistSelectionVisual() {
  $modal()
    .find(".check-item")
    .each(function () {
      const $el = $(this);
      const on = $el.find('input[type="checkbox"]').prop("checked");
      $el
        .toggleClass("selected", on)
        .attr("data-checked", on ? "true" : "false");
      $el.css(
        on
          ? {
              background: "rgba(62,26,125,.08)",
              borderColor: "#3E1A7D",
              boxShadow: "0 8px 18px rgba(62,26,125,.15)",
            }
          : {
              background: "#fff",
              borderColor: "#D6E1EC",
              boxShadow: "0 6px 14px rgba(0,0,0,.05)",
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
  if (typeof kWhValue !== "number" || isNaN(kWhValue)) return 0;
  return Math.round((kWhValue / 1000) * 100) / 100;
}

/**
 * Normaliza label de dispositivo para classificação consistente
 * @param {string} str - label do dispositivo
 * @returns {string} label normalizado
 */
function normalizeLabel(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
      LogHelper.log("[RFC-0056] Widget type not detected - skipping emission");
      return;
    }

    // Construir periodKey a partir do filtro atual
    const periodKey = buildPeriodKey();

    // RFC-0002: Domain-specific emission
    if (WIDGET_DOMAIN === "water") {
      emitWaterTelemetry(widgetType, periodKey);
    } else {
      // Default: energy domain
      if (widgetType === "lojas") {
        emitLojasTotal(periodKey);
      } else if (widgetType === "areacomum") {
        emitAreaComumBreakdown(periodKey);
      }
    }
  } catch (err) {
    LogHelper.error("[RFC-0056] Error in emitTelemetryUpdate:", err);
  }
}

/**
 * Detecta tipo de widget baseado no datasource alias
 * RFC-0002: Added 'entrada' detection for water domain
 * @returns {'lojas'|'areacomum'|'entrada'|null}
 */
function detectWidgetType() {
  try {
    LogHelper.log(
      "🔍 [detectWidgetType] Iniciando detecção de tipo de widget..."
    );

    const datasources = ctx.datasources || [];
    LogHelper.log(`[detectWidgetType] Total de datasources detectados: ${datasources.length}`);

    if (!datasources.length) {
      LogHelper.warn("[detectWidgetType] Nenhum datasource encontrado em ctx.datasources!");
      return null;
    }

    // Percorrer todos os datasources
    for (let i = 0; i < datasources.length; i++) {
      const ds = datasources[i];
      const alias = (ds.aliasName || "").toString().toLowerCase().trim();

      LogHelper.log(`🔸 [detectWidgetType] Verificando datasource[${i}]`);
      LogHelper.log(`    ↳ aliasName:     ${ds.aliasName || "(vazio)"}`);
      LogHelper.log(`    ↳ entityName:    ${ds.entityName || "(vazio)"}`);
      LogHelper.log(`    ↳ alias normalizado: "${alias}"`);

      if (!alias) {
        LogHelper.warn(`[detectWidgetType] ⚠️ Alias vazio ou indefinido no datasource[${i}].`);
        continue;
      }

      // RFC-0002: Check for entrada (water domain)
      // Use word boundary matching to avoid false positives like "bomba entrada"
      if (/\bentrada\b/.test(alias) || alias === "entrada" || alias.includes("entrada")) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "entrada" (com base no alias "${alias}")`);
        return "entrada";
      }

      // Match "lojas" as standalone word or at end of alias
      // AVOID false positives like "Bomba Lojas", "Subestação Lojas"
      // ACCEPT: "lojas", "widget-lojas", "telemetry-lojas", "consumidores lojas"
      if (
        /\blojas\b/.test(alias) &&
        !/bomba|subesta|entrada|chiller|elevador|escada/i.test(alias)
      ) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "lojas" (com base no alias "${alias}")`);
        return "lojas";
      }

      // Match area comum with flexible separators
      if (
        /\barea\s*comum\b/.test(alias) ||
        alias.includes("areacomum") ||
        alias.includes("area_comum")
      ) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "areacomum" (com base no alias "${alias}")`);
        return "areacomum";
      }
    }

    LogHelper.warn("[detectWidgetType] ⚠️ Nenhum tipo de widget correspondente encontrado.");
    return null;
  } catch (err) {
    LogHelper.error("[detectWidgetType] ❌ Erro durante detecção de tipo de widget:", err);
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
    return "realtime";
  }

  const startMs = timewindow.fixedWindow?.startTimeMs || Date.now() - 86400000;
  const endMs = timewindow.fixedWindow?.endTimeMs || Date.now();

  const startDate = new Date(startMs).toISOString().split("T")[0];
  const endDate = new Date(endMs).toISOString().split("T")[0];

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
      type: "lojas_total",
      domain: "energy",
      periodKey: periodKey,
      timestamp: Date.now(),
      source: "TELEMETRY_Lojas",
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
      LogHelper.warn("[RFC-0056] sessionStorage write failed:", e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent("myio:telemetry:update", {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);
    LogHelper.log(`[RFC-0056] ✅ Emitted lojas_total: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices)`);
  } catch (err) {
    LogHelper.error("[RFC-0056] Error in emitLojasTotal:", err);
  }
}

/**
 * RFC-0063: Classify device by identifier attribute
 * @param {string} identifier - Device identifier (e.g., "CAG", "Fancoil", "ELV", etc.)
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'|null}
 */
function classifyDeviceByIdentifier(identifier = "") {
  // RFC-0063: Safe guard against null/undefined/empty
  if (
    !identifier ||
    identifier === "N/A" ||
    identifier === "null" ||
    identifier === "undefined"
  ) {
    return null;
  }

  const id = String(identifier).trim().toUpperCase();

  // Ignore "Sem Identificador identificado" marker
  if (id.includes("SEM IDENTIFICADOR")) {
    return null;
  }

  // Climatização: CAG, Fancoil
  if (
    id === "CAG" ||
    id === "FANCOIL" ||
    id.startsWith("CAG-") ||
    id.startsWith("FANCOIL-")
  ) {
    return "climatizacao";
  }

  // Elevadores: ELV, Elevador
  if (
    id === "ELV" ||
    id === "ELEVADOR" ||
    id.startsWith("ELV-") ||
    id.startsWith("ELEVADOR-")
  ) {
    return "elevadores";
  }

  // Escadas Rolantes: ESC, Escada
  if (
    id === "ESC" ||
    id === "ESCADA" ||
    id.startsWith("ESC-") ||
    id.startsWith("ESCADA")
  ) {
    return "escadas_rolantes";
  }

  // Outros: qualquer outro identifier não reconhecido
  return "outros";
}

/**
 * RFC-0063: Classify device by label (legacy method)
 * @param {string} label - Device label/name
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDeviceByLabel(label = "") {
  // RFC-0063: Safe guard against null/undefined
  if (!label) {
    return "outros";
  }

  const normalized = normalizeLabel(label);

  // Climatização patterns
  if (
    normalized.includes("climatizacao") ||
    normalized.includes("hvac") ||
    normalized.includes("ar condicionado") ||
    normalized.includes("chiller") ||
    normalized.includes("bomba cag") ||
    normalized.includes("fancoil") ||
    normalized.includes("casa de máquina ar") ||
    normalized.includes("bomba primaria") ||
    normalized.includes("bomba secundaria") ||
    normalized.includes("bombas condensadoras") ||
    normalized.includes("bombas condensadora") ||
    normalized.includes("bomba condensadora") ||
    normalized.includes("bombas primarias") ||
    normalized.includes("bombas secundarias")
  ) {
    return "climatizacao";
  }

  // Elevadores patterns
  if (normalized.includes("elevador")) {
    return "elevadores";
  }

  // Escadas Rolantes patterns
  if (normalized.includes("escada") && normalized.includes("rolante")) {
    return "escadas_rolantes";
  }

  // Default: outros
  return "outros";
}

/**
 * RFC-0063: Classify device using configured mode
 * @param {Object} item - Device item with identifier and label
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDevice(item) {
  // RFC-0063: Safe guard - ensure item exists
  if (!item) {
    LogHelper.warn("[RFC-0063] classifyDevice called with null/undefined item");
    return "outros";
  }

  // Mode 1: Identifier only (new method)
  if (USE_IDENTIFIER_CLASSIFICATION && !USE_HYBRID_CLASSIFICATION || item.identifier === "ESCADASROLANTES") {
    const category = classifyDeviceByIdentifier(item.identifier);
    if (category) {
      LogHelper.log(
        `[RFC-0063] Device classified by identifier: "${item.identifier}" → ${category}`
      );
      return category;
    }
    // Fallback to 'outros' if identifier doesn't match any category
    const reason = !item.identifier
      ? "no identifier attribute"
      : `identifier "${item.identifier}" not recognized`;
    LogHelper.log(`[RFC-0063] Device ${reason} → outros`);
    return "outros";
  }

  // Mode 2: Hybrid (identifier with label fallback)
  if (USE_IDENTIFIER_CLASSIFICATION && USE_HYBRID_CLASSIFICATION) {
    const categoryByIdentifier = classifyDeviceByIdentifier(item.identifier);
    
    if (categoryByIdentifier && categoryByIdentifier !== "outros") {
      LogHelper.log(`[RFC-0063 Hybrid] Device classified by identifier: "${item.identifier}" → ${categoryByIdentifier}`);
      return categoryByIdentifier;
    }

    // Fallback to label classification
    const categoryByLabel = classifyDeviceByLabel(item.label || item.name);
    const fallbackReason = !item.identifier ? "no identifier" : `identifier "${item.identifier}" not recognized`;

    LogHelper.log(`[RFC-0063 Hybrid] Device (${fallbackReason}) classified by label fallback: "${item.label}" → ${categoryByLabel}`);

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
        USE_IDENTIFIER_CLASSIFICATION
          ? USE_HYBRID_CLASSIFICATION
            ? "HYBRID"
            : "IDENTIFIER"
          : "LEGACY"
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
      type: "areacomum_breakdown",
      domain: "energy",
      periodKey: periodKey,
      timestamp: Date.now(),
      source: "TELEMETRY_AreaComum",
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
      LogHelper.warn("[RFC-0056] sessionStorage write failed:", e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent("myio:telemetry:update", {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);

    const totalMWh = normalizeToMWh(
      breakdown.climatizacao +
        breakdown.elevadores +
        breakdown.escadas_rolantes +
        breakdown.outros
    );
    LogHelper.log(
      `[RFC-0056] ✅ Emitted areacomum_breakdown: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices)`
    );
  } catch (err) {
    LogHelper.error("[RFC-0056] Error in emitAreaComumBreakdown:", err);
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
    if (widgetType === "entrada") {
      context = "entrada";
    } else if (widgetType === "lojas") {
      context = "lojas";
    } else if (widgetType === "areacomum") {
      context = "areaComum";
    }

    if (!context) {
      LogHelper.warn(`[RFC-0002 Water] Unknown widget type: ${widgetType}`);
      return;
    }

    // Calculate total in m³
    const totalM3 = STATE.itemsEnriched.reduce(
      (sum, item) => sum + (item.value || 0),
      0
    );

    // Build device list
    const devices = STATE.itemsEnriched.map((item) => ({
      id: item.id || item.entityId || "",
      label: item.label || item.name || "",
      value: item.value || 0,
      deviceType: item.deviceType || "HIDROMETRO",
    }));

    const payload = {
      context: context,
      domain: "water",
      total: totalM3,
      devices: devices,
      periodKey: periodKey,
      timestamp: new Date().toISOString(),
    };

    // Dispatch water event
    const event = new CustomEvent("myio:telemetry:provide-water", {
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
    LogHelper.error("[RFC-0002 Water] Error in emitWaterTelemetry:", err);
  }
}

/** ===================== RECOMPUTE (local only) ===================== **/
function reflowFromState() {
  const visible = applyFilters(
    STATE.itemsEnriched,
    STATE.searchTerm,
    STATE.selectedIds,
    STATE.sortMode
  );
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
      LogHelper.warn(
        "[DeviceCards] Aguardando intervalo de datas (startDateISO/endDateISO)."
      );
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
      const valid = new Set(STATE.itemsBase.map((x) => x.id));
      const next = new Set(
        [...STATE.selectedIds].filter((id) => valid.has(id))
      );
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
    position: "relative",
  });

  MyIO = (typeof MyIOLibrary !== "undefined" && MyIOLibrary) ||
    (typeof window !== "undefined" && window.MyIOLibrary) || {
      showAlert: function () {
        alert("A Bliblioteca Myio não foi carregada corretamente!");
      },
    };

  $root().find("#labelWidgetId").text(self.ctx.settings?.labelWidget);

  // RFC-0042: Set widget configuration from settings FIRST
  WIDGET_DOMAIN = self.ctx.settings?.DOMAIN || "energy";
  LogHelper.log(`[TELEMETRY] Configured EARLY: domain=${WIDGET_DOMAIN}`);

  // RFC-0063: Load classification mode configuration
  USE_IDENTIFIER_CLASSIFICATION = self.ctx.settings?.USE_IDENTIFIER_CLASSIFICATION || false;
  USE_HYBRID_CLASSIFICATION = self.ctx.settings?.USE_HYBRID_CLASSIFICATION || false;
  LogHelper.log(
    `[RFC-0063] Classification mode: ${
      USE_IDENTIFIER_CLASSIFICATION
        ? USE_HYBRID_CLASSIFICATION
          ? "HYBRID (identifier + label fallback)"
          : "IDENTIFIER ONLY"
        : "LEGACY (label only)"
    }`
  );

  // RFC-0042: Request data from orchestrator (defined early for use in handlers)
  function requestDataFromOrchestrator() {
    if (!self.ctx.scope?.startDateISO || !self.ctx.scope?.endDateISO) {
      LogHelper.warn("[TELEMETRY] No date range set, cannot request data");
      return;
    }

    const period = {
      startISO: self.ctx.scope.startDateISO,
      endISO: self.ctx.scope.endDateISO,
      granularity: window.calcGranularity
        ? window.calcGranularity(
            self.ctx.scope.startDateISO,
            self.ctx.scope.endDateISO
          )
        : "day",
      tz: "America/Sao_Paulo",
    };

    LogHelper.log(`[TELEMETRY] Requesting data for domain=${WIDGET_DOMAIN}, period:`, period);

    // RFC-0053: Single window context - emit to current window only
    window.dispatchEvent(
      new CustomEvent("myio:telemetry:request-data", {
        detail: { domain: WIDGET_DOMAIN, period },
      })
    );
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
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] Using NEW format (period object)`
        );
      } else {
        // Old format (backward compatibility)
        const { startDate, endDate } = ev.detail || {};
        startISO = new Date(startDate).toISOString();
        endISO = new Date(endDate).toISOString();
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] Using OLD format (startDate/endDate)`
        );
      }

      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] Date range updated:`,
        startISO,
        endISO
      );

      // Datas mandatórias salvas no scope
      self.ctx.scope = self.ctx.scope || {};
      self.ctx.scope.startDateISO = startISO;
      self.ctx.scope.endDateISO = endISO;

      // IMPORTANT: Reset lastProcessedPeriodKey when new date range is selected
      // This allows processing fresh data for the new period
      lastProcessedPeriodKey = null;
      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] 🔄 Reset lastProcessedPeriodKey for new date range`
      );

      // Exibe modal
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔄 Calling showBusy()...`);
      showBusy();
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ showBusy() called`);

      // RFC-0045 FIX: Check if there's a pending provide-data event waiting for this period
      if (pendingProvideData) {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ Found pending provide-data event, processing now...`);
        const pending = pendingProvideData;
        pendingProvideData = null; // Clear pending event

        // Process the pending event immediately
        dataProvideHandler({ detail: pending });
        return; // Don't request data again, we already have it
      }

      // RFC-0053: Direct access to orchestrator (single window context)
      const orchestrator = window.MyIOOrchestrator;

      if (orchestrator) {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ RFC-0053: Requesting data from orchestrator (single window)`);

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
      const $shopsList = $widget.find("#shopsList");
      if ($shopsList.length > 0) {
        $shopsList.empty();
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsList cleared`);
      }

      // Reset counts to 0
      const $shopsCount = $widget.find("#shopsCount");
      const $shopsTotal = $widget.find("#shopsTotal");

      if ($shopsCount.length > 0) {
        $shopsCount.text("(0)");
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsCount reset to 0`);
      }

      if ($shopsTotal.length > 0) {
        $shopsTotal.text("0,00");
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
    const testEvent = new CustomEvent("myio:update-date", {
      detail: {
        period: {
          startISO: "2025-09-26T00:00:00-03:00",
          endISO: "2025-10-02T23:59:59-03:00",
          granularity: "day",
          tz: "America/Sao_Paulo",
        },
      },
    });
    // Don't dispatch, just check if handler exists
    if (typeof dateUpdateHandler === "function") {
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
      }, periodKey: ${ev.detail.periodKey}, items: ${
        ev.detail.items?.length || 0
      }`
    );
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
    let filtered = items.filter((item) => {
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
    filtered = filtered.map((item) => ({
      id: item.tbId || item.id,
      tbId: item.tbId || item.id,
      ingestionId: item.ingestionId || item.id,
      identifier: item.identifier || item.id,
      label: item.label || item.identifier || item.id,
      value: Number(item.value || 0),
      perc: 0,
      deviceType: item.deviceType || "energy",
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

        // Debug: log non-zero values from API
        if (value > 0) {
          //LogHelper.log(`[TELEMETRY] ✅ Orchestrator has data: ${item.label} (${item.ingestionId}) = ${value}`);
        }
      }
    });
    LogHelper.log(`[TELEMETRY] Orchestrator values map size: ${orchestratorValues.size}`);

    // Update values in existing items
    STATE.itemsEnriched = STATE.itemsBase.map((tbItem) => {
      const orchestratorValue = orchestratorValues.get(tbItem.ingestionId);

      // TANK/CAIXA_DAGUA devices: use telemetry data from TB, NOT from orchestrator API
      const isTankDevice = tbItem.deviceType === "TANK" || tbItem.deviceType === "CAIXA_DAGUA";

      // DEBUG: Log matching process for all items
      if (orchestratorValue !== undefined && orchestratorValue > 0) {
        //LogHelper.log(`[TELEMETRY] ✅ MATCH FOUND: ${tbItem.label} (ingestionId: ${tbItem.ingestionId}) = ${orchestratorValue}`);
      } else {
        //LogHelper.warn(`[TELEMETRY] ❌ NO MATCH: ${tbItem.label} (ingestionId: ${tbItem.ingestionId}), orchestrator=${orchestratorValue}, TB=${tbItem.value}`);
      }

      // For TANK devices, preserve the telemetry values (don't overwrite with API)
      if (isTankDevice) {
        return {
          ...tbItem,
          // Keep ALL values from buildAuthoritativeItems (waterLevel, waterPercentage, value, perc)
          value: tbItem.value || 0,
          perc: tbItem.perc || 0,
          waterLevel: tbItem.waterLevel || 0,
          waterPercentage: tbItem.waterPercentage || 0,
        };
      }

      // For other devices, use orchestrator API values
      return {
        ...tbItem,
        value:
          orchestratorValue !== undefined
            ? orchestratorValue
            : tbItem.value || 0,
        perc: 0,
      };
    });

    LogHelper.log(`[TELEMETRY] Enriched ${STATE.itemsEnriched.length} items with orchestrator values`);

    // RFC-0056 FIX v1.1: Emit telemetry update after enrichment
    emitTelemetryUpdate();

    // Sanitize selection
    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map((x) => x.id));
      const next = new Set(
        [...STATE.selectedIds].filter((id) => valid.has(id))
      );
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

  window.addEventListener("myio:telemetry:provide-data", dataProvideHandler);

  // RFC-0056 FIX v1.1: Listen for request_refresh from TELEMETRY_INFO
  let requestRefreshHandler = function (ev) {
    const { type, domain, periodKey } = ev.detail || {};

    if (type !== "request_refresh") return;
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

  window.addEventListener("myio:telemetry:update", requestRefreshHandler);

  // RFC: REMOVED - Fix selection integration with FOOTER
  //
  // PROBLEMA ENCONTRADO: Este listener estava causando logs triplicados porque os 3 widgets TELEMETRY
  // (energy, water, temperature) estavam todos escutando o evento global 'myio:device-params' emitido
  // quando qualquer checkbox era marcado (veja template-card-v5.js).
  //
  // SOLUÇÃO: O registro da entidade já é feito no template-card-v5.js via:
  //   MyIOSelectionStore.registerEntity(cardEntity);
  // E a adição/remoção já é feita no template-card-v5.js via checkbox event handler:
  //   MyIOSelectionStore.add(entityId) / MyIOSelectionStore.remove(entityId);
  //
  // Portanto, NÃO precisamos deste listener aqui - ele estava causando registros e logs duplicados!
  //
  // Se precisar reagir a mudanças de seleção, use:
  //   MyIOSelectionStore.on('selection:change', handler);
  //
  /*
  window.addEventListener('myio:device-params', (ev) => {
    try {
      LogHelper.log("[TELEMETRY] Card selected:", ev.detail);
      // ... código removido ...
    }
  });

  window.addEventListener('myio:device-params-remove', (ev) => {
    try {
      LogHelper.log("[TELEMETRY] Card deselected:", ev.detail);
      // ... código removido ...
    }
  });
  */
  // Check for stored data from orchestrator (in case we missed the event)
  setTimeout(() => {
    // RFC-0053: Direct access to orchestrator data (single window context)
    const orchestratorData = window.MyIOOrchestratorData;

    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔍 Checking for stored orchestrator data...`);

    // First, try stored data
    if (orchestratorData && orchestratorData[WIDGET_DOMAIN]) {
      const storedData = orchestratorData[WIDGET_DOMAIN];
      const age = Date.now() - storedData.timestamp;

      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] Found stored data: ${
          storedData.items?.length || 0
        } items, age: ${age}ms`
      );

      // Use stored data if it's less than 30 seconds old AND has items
      if (age < 30000 && storedData.items && storedData.items.length > 0) {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ RFC-0053: Using stored orchestrator data (single window)`);
        dataProvideHandler({
          detail: {
            domain: WIDGET_DOMAIN,
            periodKey: storedData.periodKey,
            items: storedData.items,
          },
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

  const boolExecSync = false;

  // RFC-0071: Trigger device profile synchronization (runs once)
  if (!__deviceProfileSyncComplete && boolExecSync) {
    try {
      console.log("[EQUIPMENTS] [RFC-0071] Triggering device profile sync...");
      const syncResult = await syncDeviceProfileAttributes();
      __deviceProfileSyncComplete = true;

      if (syncResult.synced > 0) {
        console.log("[EQUIPMENTS] [RFC-0071] ⚠️ Widget reload recommended to load new deviceProfile attributes");
        console.log("[EQUIPMENTS] [RFC-0071] You may need to refresh the dashboard to see deviceProfile in ctx.data");
      }
    } catch (error) {
      console.error("[EQUIPMENTS] [RFC-0071] Sync failed, continuing without it:", error);
      // Don't block widget initialization if sync fails
    }
  }

  try {
    const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(
      customerTB_ID,
      jwt
    );
    CLIENT_ID = attrs?.client_id || "";
    CLIENT_SECRET = attrs?.client_secret || "";
    CUSTOMER_ING_ID = attrs?.ingestionId || "";
    MAP_INSTANTANEOUS_POWER = attrs?.mapInstantaneousPower ? JSON.parse(attrs?.mapInstantaneousPower) : null;
    
    

    // Expõe credenciais globalmente para uso no FOOTER (modal de comparação)
    window.__MYIO_CLIENT_ID__ = CLIENT_ID;
    window.__MYIO_CLIENT_SECRET__ = CLIENT_SECRET;
    window.__MYIO_CUSTOMER_ING_ID__ = CUSTOMER_ING_ID;

    MyIOAuth = MyIO.buildMyioIngestionAuth({
      dataApiHost: DATA_API_HOST,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });

    LogHelper.log("[DeviceCards] Auth init OK");
    try {
      await MyIOAuth.getToken();
    } catch (_) {}
  } catch (err) {
    LogHelper.error("[DeviceCards] Auth init FAIL", err);
  }

  // Bind UI
  bindHeader();
  bindModal();

  // ---------- Datas iniciais: "Current Month So Far" ----------
  if (!self.ctx?.scope?.startDateISO || !self.ctx?.scope?.endDateISO) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0); // 1º dia 00:00
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      0
    ); // hoje 23:59:59
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
self.onDataUpdated = function () {
  /* no-op */
};

self.onResize = function () {};
self.onDestroy = function () {
  if (dateUpdateHandler) {
    window.removeEventListener("myio:update-date", dateUpdateHandler);
    LogHelper.log("[DeviceCards] Event listener 'myio:update-date' removido.");
  }
  if (dataProvideHandler) {
    window.removeEventListener(
      "myio:telemetry:provide-data",
      dataProvideHandler
    );
    LogHelper.log("[DeviceCards] Event listener 'myio:telemetry:provide-data' removido.");
  }
  // RFC-0056 FIX v1.1: Remove request_refresh listener
  if (requestRefreshHandler) {
    window.removeEventListener("myio:telemetry:update", requestRefreshHandler);
    LogHelper.log("[RFC-0056] Event listener 'myio:telemetry:update' removido.");
  }
  try {
    $root().off();
  } catch (_e) {}

  hideBusy();
  hideGlobalSuccessModal();
};
