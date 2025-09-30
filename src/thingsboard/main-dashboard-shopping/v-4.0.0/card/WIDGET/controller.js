/* =========================================================================
 * ThingsBoard Widget: Device Cards with Totals & Percentages (MyIO)
 * =========================================================================*/

/** ===================== CONFIG ===================== **/
const DATA_API_HOST = "https://api.data.apps.myio-bas.com";

let dateUpdateHandler = null;

// alvo de exibição (unidade da UI) e unidade da API (ajuste se necessário)
const UNIT_TARGET = "MWh";   // "MWh" ou "kWh"
const API_UNIT    = "kWh";   // o endpoint costuma retornar em kWh
const DECIMALS    = 2;

// evita re-hidratações múltiplas na largada
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
let CLIENT_ID         = "";
let CLIENT_SECRET     = "";
let CUSTOMER_ING_ID   = "";
let MyIOAuth          = null;

const STATE = {
  itemsBase:        /** @type {TBItem[]} */ ([]),          // datasource autoritativo
  itemsEnriched:    /** @type {EnrichedItem[]} */ ([]),    // com value/perc calculados
  searchActive:     false,
  searchTerm:       "",
  selectedIds:      /** @type {Set<string> | null} */ (null),
  sortMode:         /** @type {'cons_desc'|'cons_asc'|'alpha_asc'|'alpha_desc'} */ ('cons_desc'),
  firstHydrates:    0
};

let hydrating = false; // lock de hidratação

/** ===================== TYPES (doc) ===================== **/
// TBItem: { id: string, identifier: string, label: string }
// EnrichedItem: TBItem & { value: number, perc: number }

/** ===================== HELPERS (DOM) ===================== **/
const $root  = () => $(self.ctx.$container[0]);
const $list  = () => $root().find("#shopsList");
const $count = () => $root().find("#shopsCount");
const $total = () => $root().find("#shopsTotal");
const $modal = () => $root().find("#filterModal");

/** ===================== UTILS ===================== **/
// Indexa atributos por TB deviceId (entityId do ThingsBoard)
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

// Indexa TB deviceId a partir do ctx.data
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

// converte valor bruto da API para a unidade-alvo da UI
function toTargetUnit(raw) {
  const x = Number(raw || 0);
  if (UNIT_TARGET === "MWh" && API_UNIT === "kWh") return x / 1000;
  return x;
}

// data range: usa ctx.$scope.startDateISO/endDateISO quando existir; senão últimos 7 dias
function getDateRange() {
  const s = self.ctx?.$scope?.startDateISO;
  const e = self.ctx?.$scope?.endDateISO;
  if (s && e) return { startISO: s, endISO: e };

  const now = new Date();
  const end = new Date(now); end.setHours(23,59,59,999);
  const start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0,0,0,0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
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

/** ===================== CORE: DATA PIPELINE ===================== **/
// 1) Lista autoritativa (ThingsBoard datasource)
function buildAuthoritativeItems() {
  // items da LIB: [{ id: ingestionId, identifier, label }, ...]
  const base = MyIO.buildListItemsThingsboardByUniqueDatasource(self.ctx.datasources, self.ctx.data) || [];
  const ok   = Array.isArray(base) ? base.filter(x => x && x.id) : [];

  const tbIdIdx    = buildTbIdIndexes();   // { byIdentifier, byIngestion }
  const attrsByTb  = buildTbAttrIndex();   // tbId -> { slaveId, centralId, deviceType }

  const mapped = ok.map(r => {
    const ingestionId = r.id;

    // ★ prioridade por ingestionId
    const tbFromIngestion   = ingestionId ? tbIdIdx.byIngestion.get(ingestionId) : null;
    const tbFromIdentifier  = r.identifier ? tbIdIdx.byIdentifier.get(r.identifier) : null;

    let tbId = tbFromIngestion || tbFromIdentifier || null;

    // se houver conflito, loga e fica com o do ingestionId
    if (tbFromIngestion && tbFromIdentifier && tbFromIngestion !== tbFromIdentifier) {
      console.warn("[DeviceCards] TB id mismatch for item",
        { label: r.label, identifier: r.identifier, ingestionId, tbFromIngestion, tbFromIdentifier }
      );
      tbId = tbFromIngestion;
    }

    const attrs = tbId ? (attrsByTb.get(tbId) || {}) : {};

    return {
      id: tbId || ingestionId,     // para seleção interna; prioriza TB id
      tbId,                        // ThingsBoard deviceId (para Settings)
      ingestionId,                 // join key da API (para totals/report)
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


// 2) Busca totais na API (requer auth pronta)
async function fetchApiTotals(startISO, endISO) {
  if (!isAuthReady()) throw new Error("Auth not ready");
  const token = await MyIOAuth.getToken();
  if (!token) throw new Error("No ingestion token");

  const url = new URL(`${DATA_API_HOST}/api/v1/telemetry/customers/${CUSTOMER_ING_ID}/energy/devices/totals`);
  url.searchParams.set("startTime", toSpOffsetNoMs(startISO));
  url.searchParams.set("endTime",   toSpOffsetNoMs(endISO, true));
  url.searchParams.set("deep",      "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

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

// 3) Enriquecer items com valores (value) a partir do mapa da API
function enrichItemsWithTotals(items, apiMap) {
  return items.map((it) => {
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
    // alpha_asc
    return (a.label || "").localeCompare((b.label || ""), "pt-BR", { sensitivity: "base" }) || (a.value - b.value);
  });

  return v;
}

function recomputePercentages(visible) {
  const groupSum = visible.reduce((acc, x) => acc + (x.value || 0), 0);
  const updated  = visible.map(x => ({
    ...x,
    perc: groupSum > 0 ? (x.value / groupSum) * 100 : 0
  }));
  return { visible: updated, groupSum };
}

/** ===================== RENDER ===================== **/
function renderHeader(count, groupSum) {
  $count().text(`(${count})`);
  $total().text(MyIO.formatEnergy(groupSum));
}

function renderList(visible) {
  const $ul = $list().empty();

  visible.forEach((it) => {
    const valNum = Number(it.value || 0);
    const connectionStatus = valNum > 0 ? "power_on" : "power_off";

    // entityObject exatamente no formato solicitado
    const entityObject = {
      entityId: it.tbId || it.id,                     // TB deviceId preferencialmente
      labelOrName: it.label,
      deviceType: it.deviceType || "energy",
      val: valNum,
      valType: "ENERGY",
      perc: it.perc ?? 0,
      deviceStatus: connectionStatus,                 // "power_on" | "power_off"
      entityType: "DEVICE",
      deviceIdentifier: it.identifier,
      slaveId: it.slaveId || "N/A",
      ingestionId: it.ingestionId || "N/A",          // join p/ API/report
      centralId: it.centralId || "N/A",
      updatedIdentifiers: it.updatedIdentifiers || {},
      handInfo: true,
      centralName: "N/A",
      connectionStatusTime: Date.now(),
      timaVal: Date.now()
    };

    // >>> AQUI ESTÁ O FIX: passar UM ÚNICO OBJETO com { entityObject, ...handlers }
    const $card = MyIO.renderCardComponentV2({
      entityObject,
      handInfo: true, // mantém compat com versões que olham no nível raiz

      handleActionDashboard: () => {
        console.log("[DeviceCards] dashboard:", it.label);
      },

      handleActionReport: async () => {
        try {
          if (!isAuthReady()) throw new Error("Auth not ready");
          const ingestionToken = await MyIOAuth.getToken();
          if (!ingestionToken) throw new Error("No ingestion token");
          return MyIO.openDashboardPopupReport({
            ingestionId: it.ingestionId,   // sempre ingestionId no Report
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
        }
      },

      handleActionSettings: async () => {
        // tenta usar o tbId já calculado
        let tbId = it.tbId;

        // resolve “na hora” se estiver ausente/duvidoso
        if (!tbId || !isValidUUID(tbId)) {
          const idx = buildTbIdIndexes(); // mapeia do ctx.data atual
          tbId =
            (it.ingestionId && idx.byIngestion.get(it.ingestionId)) ||
            (it.identifier && idx.byIdentifier.get(it.identifier)) ||
            null;
        }

        // nunca use ingestionId como fallback para Settings!
        if (!tbId || tbId === it.ingestionId) {
          console.warn("[DeviceCards] Missing/ambiguous TB id for Settings", {
            label: it.label, identifier: it.identifier, ingestionId: it.ingestionId, tbId
          });
          alert("Não foi possível identificar o deviceId do ThingsBoard para este card. Atualize a página ou verifique os atributos (ingestionId/identifier) deste device.");
          return;
        }

        const jwt = localStorage.getItem("jwt_token");
        return MyIO.openDashboardPopupSettings({
          deviceId: tbId, // ✅ sempre TB id correto aqui
          label: it.label,
          jwtToken: jwt,
          ui: { title: "Configurações", width: 900 },
          onSaved: (payload) => console.log("[Settings Saved]", payload),
          onClose: () => $(".myio-settings-modal-overlay").remove()
        });
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
    if (STATE.searchActive) {
      setTimeout(() => $root().find("#shopsSearch").trigger("focus"), 30);
    }
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
    const safeId = String(it.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || ("id" + Math.random().toString(36).slice(2));
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
  if ($footer.length) {
    $footer.show().find("#applyFilters, #resetFilters").show();
  }

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

  // busca dentro do modal
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

  // clique em linha para alternar checkbox
  $root().on("click", "#deviceChecklist .check-item", function (ev) {
    if (ev.target && ev.target.tagName && ev.target.tagName.toLowerCase() === "input") return;
    ev.preventDefault();
    ev.stopPropagation();
    const $chk = $(this).find('input[type="checkbox"]');
    $chk.prop("checked", !$chk.prop("checked")).trigger("change");
  });

  // estilização ao marcar/desmarcar
  $root().on("change", '#deviceChecklist input[type="checkbox"]', function () {
    const $wrap = $(this).closest(".check-item");
    const on = this.checked;
    $wrap.toggleClass("selected", on).attr("data-checked", on ? "true" : "false");
    $wrap.css(on
      ? { background: "rgba(62,26,125,.08)", borderColor: "#3E1A7D", boxShadow: "0 8px 18px rgba(62,26,125,.15)" }
      : { background: "#fff", borderColor: "#D6E1EC", boxShadow: "0 6px 14px rgba(0,0,0,.05)" }
    );
  });
}

function syncChecklistSelectionVisual() {
  $modal().find(".check-item").each(function () {
    const $el = $(this);
    const on = $el.find('input[type="checkbox"]').prop("checked");
    $el.toggleClass("selected", on).attr("data-checked", on ? "true" : "false");
    $el.css(on
      ? { background: "rgba(62,26,125,.08)", borderColor: "#3E1A7D", boxShadow: "0 8px 18px rgba(62,26,125,.15)" }
      : { background: "#fff", borderColor: "#D6E1EC", boxShadow: "0 6px 14px rgba(0,0,0,.05)" }
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

  try {
    // exige auth pronta
    const okAuth = await ensureAuthReady(6000, 150);
    if (!okAuth) {
      console.warn("[DeviceCards] Auth not ready; skipping hydrate this tick.");
      return;
    }

    // 1) lista autoritativa
    STATE.itemsBase = buildAuthoritativeItems();

    // 2) período
    const { startISO, endISO } = getDateRange();

    // 3) API totals
    let apiMap = new Map();
    try {
      apiMap = await fetchApiTotals(startISO, endISO);
    } catch (err) {
      console.error("[DeviceCards] API error:", err);
      apiMap = new Map();
    }

    // 4) enrich + primeira renderização
    STATE.itemsEnriched = enrichItemsWithTotals(STATE.itemsBase, apiMap);

    // manter selectedIds válido
    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map(x => x.id));
      const next = new Set([...STATE.selectedIds].filter(id => valid.has(id)));
      STATE.selectedIds = next.size ? next : null;
    }

    reflowFromState();
  } finally {
    hydrating = false;
  }
}

/** ===================== TB LIFE CYCLE ===================== **/
self.onInit = async function () {
  $(self.ctx.$container).css({
    height: "100%",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column"
  });

    dateUpdateHandler = function(event) {

      const { startDate, endDate } = event.detail;

      console.log("[DeviceCards] Data range updated:", startDate, endDate);

      self.ctx.scope.startDateISO = new Date(startDate).toISOString();
      self.ctx.scope.endDateISO = new Date(endDate).toISOString();

      if (typeof hydrateAndRender === 'function') {
          hydrateAndRender();
      } else {
          console.error("[DeviceCards] Função hydrateAndRender não encontrada para atualizar com novas datas!");
      }
  };

  window.addEventListener('myio:update-date', dateUpdateHandler);

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

    // opcional: aquece o token (não obrigatório)
    try { await MyIOAuth.getToken(); } catch (_) {}
  } catch (err) {
    console.error("[DeviceCards] Auth init FAIL", err);
  }

  // bind UI
  bindHeader();
  bindModal();

  // hidratação inicial (espera ctx.data se vier atrasado)
  if (Array.isArray(self.ctx.data) && self.ctx.data.length > 0) {
    STATE.firstHydrates++;
    if (STATE.firstHydrates <= MAX_FIRST_HYDRATES) await hydrateAndRender();
  } else {
    const waiter = setInterval(async () => {
      if (Array.isArray(self.ctx.data) && self.ctx.data.length > 0) {
        clearInterval(waiter);
        STATE.firstHydrates++;
        if (STATE.firstHydrates <= MAX_FIRST_HYDRATES) await hydrateAndRender();
      }
    }, 150);
  }
};

self.onDataUpdated = async function () {
  // Só hidrata quando auth pronta; senão apenas aguarda próximos ticks
  if (!isAuthReady()) return;
  if (STATE.firstHydrates === 0 && Array.isArray(self.ctx.data) && self.ctx.data.length > 0) {
    STATE.firstHydrates++;
    if (STATE.firstHydrates <= MAX_FIRST_HYDRATES) await hydrateAndRender();
  } else {
    // reflow local (sem API) quando só filtros mudarem
    reflowFromState();
  }
};

self.onResize = function () {};
self.onDestroy = function () {
  if (dateUpdateHandler) {
    window.removeEventListener('myio:update-date', dateUpdateHandler);
    console.log("[DeviceCards] Event listener 'myio:update-date' removido.");
  }

  try { $root().off(); } catch (_e) {}
};

/* ===================== END ===================== */
