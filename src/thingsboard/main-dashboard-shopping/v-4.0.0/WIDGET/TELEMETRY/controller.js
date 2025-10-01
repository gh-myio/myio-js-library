/* =========================================================================
 * ThingsBoard Widget: Device Cards with Totals & Percentages (MyIO)
 * - Datas obrigatórias: startDateISO / endDateISO
 * - Se ausentes no onInit: usa "current month so far" (1º dia 00:00 → hoje 23:59)
 * - Modal premium (busy) no widget durante carregamentos
 * - Modal premium global (fora do widget) para sucesso, com contador e reload
 * - onDataUpdated: no-op
 * - Evento (myio:update-date): mostra modal + atualiza
 * =========================================================================*/

const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
let dateUpdateHandler = null;

 let UNIT_TARGET = null;
 let API_UNIT    = null;
 let DECIMALS    = null;

const MAX_FIRST_HYDRATES = 1;

/** ============== MyIO (fallbacks seguros) ============== **/
const MyIO = (typeof MyIOLibrary !== "undefined" && MyIOLibrary)
         || (typeof window !== "undefined" && window.MyIOLibrary)
         || {
              formatNumberReadable: (n, d=2) => Number(n ?? 0).toLocaleString("pt-BR", {
                minimumFractionDigits: d, maximumFractionDigits: d
              }),
              formatEnergy: (n) => `${Number(n || 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2, maximumFractionDigits: 2
              })} ${UNIT_TARGET}`
            };

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
function showBusy(message) {
  const $m = ensureBusyModalDOM();
  const text = (message && String(message).trim()) || "aguarde.. carregando os dados...";
  $m.find(`#${BUSY_ID}-msg`).text(text);
  $m.css("display","flex");
}
function hideBusy() {
  $root().find(`#${BUSY_ID}`).css("display","none");
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
function toTargetUnit(raw) {
  const x = Number(raw || 0);
  if (UNIT_TARGET === "MWh" && API_UNIT === "kWh") return x / 1000;
  return x;
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
  const byTbId = new Map(); // tbId -> { slaveId, centralId, deviceType }
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];
  for (const row of rows) {
    const key = String(row?.dataKey?.name || "").toLowerCase();
    const tbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val  = row?.data?.[0]?.[1];
    if (!tbId || val == null) continue;
    if (!byTbId.has(tbId)) byTbId.set(tbId, { slaveId: null, centralId: null, deviceType: null });
    const slot = byTbId.get(tbId);
    if (key === "slaveid")    slot.slaveId    = val;
    if (key === "centralid")  slot.centralId  = val;
    if (key === "devicetype") slot.deviceType = val;
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
  const ok   = Array.isArray(base) ? base.filter(x => x && x.id) : [];

  const tbIdIdx   = buildTbIdIndexes();   // { byIdentifier, byIngestion }
  const attrsByTb = buildTbAttrIndex();   // tbId -> { slaveId, centralId, deviceType }

  const mapped = ok.map(r => {
    const ingestionId = r.id;
    const tbFromIngestion  = ingestionId ? tbIdIdx.byIngestion.get(ingestionId) : null;
    const tbFromIdentifier = r.identifier ? tbIdIdx.byIdentifier.get(r.identifier) : null;

    let tbId = tbFromIngestion || tbFromIdentifier || null;
    if (tbFromIngestion && tbFromIdentifier && tbFromIngestion !== tbFromIdentifier) {
      console.warn("[DeviceCards] TB id mismatch for item", {
        label: r.label, identifier: r.identifier, ingestionId, tbFromIngestion, tbFromIdentifier
      });
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
      deviceType: attrs.deviceType || "energy",
      updatedIdentifiers: {}
    };
  });

  console.log(`[DeviceCards] TB items: ${mapped.length}`);
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
    console.warn("[DeviceCards] API fetch failed:", res.status);
    return new Map();
  }

  const json = await res.json();
  const rows = Array.isArray(json) ? json : (json?.data ?? []);
  const map = new Map();
  for (const r of rows) if (r && r.id) map.set(String(r.id), r);
  console.log(`[DeviceCards] API rows: ${rows.length}, map keys: ${map.size}`);
  return map;
}

function enrichItemsWithTotals(items, apiMap) {
  return items.map(it => {
    let raw = 0;
    if (it.ingestionId && isValidUUID(it.ingestionId)) {
      const row = apiMap.get(String(it.ingestionId));
      raw = Number(row?.total_value ?? 0);
    }
    const value = toTargetUnit(raw);
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
      (x.identifier || "").toLowerCase().includes(q)
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
  $total().text(MyIO.formatEnergy(groupSum));
}

function renderList(visible) {
  const $ul = $list().empty();

  visible.forEach(it => {
    const valNum = Number(it.value || 0);
    const connectionStatus = valNum > 0 ? "power_on" : "power_off";

    const entityObject = {
      entityId: it.tbId || it.id,            // preferir TB deviceId
      labelOrName: it.label,
      deviceType: it.deviceType || "energy",
      val: valNum,
      valType: "ENERGY",
      perc: it.perc ?? 0,
      deviceStatus: connectionStatus,        // "power_on" | "power_off"
      entityType: "DEVICE",
      deviceIdentifier: it.identifier,
      slaveId: it.slaveId || "N/A",
      ingestionId: it.ingestionId || "N/A",
      centralId: it.centralId || "N/A",
      updatedIdentifiers: it.updatedIdentifiers || {},
      handInfo: true,
      centralName: "N/A",
      connectionStatusTime: Date.now(),
      timaVal: Date.now()
    };
    
    const myTbToken = localStorage.getItem("jwt_token");
    let cachedIngestionToken = null;
    
    MyIOAuth.getToken().then(token => {
      cachedIngestionToken = token;
    }).catch(err => console.warn('Token cache failed:', err));

    const $card = MyIO.renderCardComponentV2({
      entityObject,
      handInfo: true,

      handleActionDashboard: async () => {
       try {
        console.log("handleActionDashboard >>> it: " , it);
        const tokenIngestionDashBoard = await MyIOAuth.getToken();
        const myTbTokenDashBoard = localStorage.getItem("jwt_token");
        const modal = MyIO.openDashboardPopupEnergy({
          deviceId: it.id, // Use actual device ID
          startDate: self.ctx.scope.startDateISO,
          endDate: self.ctx.scope.endDateISO,
          tbJwtToken: myTbTokenDashBoard,
          ingestionToken: tokenIngestionDashBoard,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          onOpen: (context) => {
            console.log('Modal opened:', context);
            hideBusy(); // Hide loading when modal opens
          },
          onError: (error) => {
            console.error('Modal error:', error);
            hideBusy();
            alert(`Erro: ${error.message}`);
          },
          onClose: () => {
            console.log('Modal closed');
          }
        });
       } catch (err) {
          console.warn("[DeviceCards] Report open blocked:", err?.message || err);
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
            api: {
              dataApiBaseUrl: DATA_API_HOST,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              ingestionToken
            }
          });
        } catch (err) {
          console.warn("[DeviceCards] Report open blocked:", err?.message || err);
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
          console.warn("[DeviceCards] Missing/ambiguous TB id for Settings", {
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
              console.log("[Settings Saved]", payload);
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

      handleSelect: () => {},
      handleClickCard: () => {}
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
      console.warn("[DeviceCards] Aguardando intervalo de datas (startDateISO/endDateISO).");
      return;
    }

    // 1) Auth
    const okAuth = await ensureAuthReady(6000, 150);
    if (!okAuth) {
      console.warn("[DeviceCards] Auth not ready; adiando hidratação.");
      return;
    }

    // 2) Lista autoritativa
    STATE.itemsBase = buildAuthoritativeItems();

    // 3) Totais na API
    let apiMap = new Map();
    try {
      apiMap = await fetchApiTotals(range.startISO, range.endISO);
    } catch (err) {
      console.error("[DeviceCards] API error:", err);
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
  
  $root().find("#labelWidgetId").text(self.ctx.settings?.labelWidget);
  
  // Unidade alvo (UI) e unidade da API
       UNIT_TARGET = self.ctx.settings?.UNIT_TARGET;
       API_UNIT    = self.ctx.settings?.API_UNIT;
       DECIMALS    = self.ctx.settings?.DECIMALS;

  // Listener com modal: evento externo de mudança de data
  dateUpdateHandler = function (ev) {
    try {
      const { startDate, endDate } = ev.detail || {};
      console.log("[DeviceCards] Data range updated:", startDate, endDate);

      // Datas mandatórias salvas no scope
      self.ctx.scope = self.ctx.scope || {};
      self.ctx.scope.startDateISO = new Date(startDate).toISOString();
      self.ctx.scope.endDateISO   = new Date(endDate).toISOString();

      // Exibe modal e atualiza
      showBusy(); // mensagem fixa
      if (typeof hydrateAndRender === "function") {
        hydrateAndRender();
      } else {
        console.error("[DeviceCards] hydrateAndRender não encontrada.");
      }
    } catch (err) {
      console.error("[DeviceCards] dateUpdateHandler error:", err);
    }
  };
  window.addEventListener("myio:update-date", dateUpdateHandler);

  // Auth do cliente/ingestion
  const customerTB_ID = self.ctx.settings?.customerTB_ID || "";
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

    console.log("[DeviceCards] Auth init OK");
    try { await MyIOAuth.getToken(); } catch (_) {}
  } catch (err) {
    console.error("[DeviceCards] Auth init FAIL", err);
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
  showBusy(); // mensagem fixa

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
self.onDataUpdated = function () { /* no-op */ };

self.onResize = function () {};
self.onDestroy = function () {
  if (dateUpdateHandler) {
    window.removeEventListener("myio:update-date", dateUpdateHandler);
    console.log("[DeviceCards] Event listener 'myio:update-date' removido.");
  }
  try { $root().off(); } catch (_e) {}
  hideBusy();
  hideGlobalSuccessModal();
};
