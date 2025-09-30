// === Botões premium do popup (reforço por JS, independe da ordem de CSS) ===
const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
let CLIENT_ID;
let CLIENT_SECRET;
let INGESTION_ID;
let CUSTOMER_ID;

// MyIO Authentication instance - will be initialized after credentials are loaded
let MyIOAuth = null;

async function fetchCustomerServerScopeAttrs() {
  const tbToken = localStorage.getItem("jwt_token");

  if (!tbToken)
    throw new Error("JWT do ThingsBoard não encontrado (localStorage.jwt_token).");

  const url = `/api/plugins/telemetry/CUSTOMER/${CUSTOMER_ID}/values/attributes/SERVER_SCOPE`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${tbToken}`,
    },
  });

  if (!res.ok) {
    console.warn(`[customer attrs] HTTP ${res.status}`);
    return {};
  }

  const payload = await res.json();

  // Pode vir como array [{key,value}] OU como objeto { key: [{value}] }
  const map = {};

  if (Array.isArray(payload)) {
    for (const it of payload) map[it.key] = it.value;
  } else if (payload && typeof payload === "object") {
    for (const k of Object.keys(payload)) {
      const v = payload[k];

      if (Array.isArray(v) && v.length) map[k] = v[0]?.value ?? v[0];
    }
  }

  return map;
}

/* ==== Tooltip premium (global no <body>) ==== */
function setupTooltipPremium(target, text) {
  if (!target) return;

  let tip = document.getElementById("tbx-global-tooltip");

  if (!tip) {
    tip = document.createElement("div");
    tip.id = "tbx-global-tooltip";
    document.body.appendChild(tip);
  }

  tip.textContent = text;

  const pad = 10;

  function position(ev) {
    let x = ev.clientX + 12, y = ev.clientY - 36;
    const vw = window.innerWidth, rect = tip.getBoundingClientRect();

    if (x + rect.width + pad > vw) x = vw - rect.width - pad;
    if (y < pad) y = ev.clientY + 18;

    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  function show(ev) {
    if (ev) position(ev);
    tip.classList.add("show");
  }

  function hide() {
    tip.classList.remove("show");
  }

  target.addEventListener("mouseenter", show);
  target.addEventListener("mousemove", position);
  target.addEventListener("mouseleave", hide);
  target.addEventListener("focus", (e) => {
    const r = e.target.getBoundingClientRect();
    show({ clientX: r.left + 20, clientY: r.top - 8 });
  });
  target.addEventListener("blur", hide);

  // Se abrir o calendário, esconda a tooltip
  if (window.jQuery) {
    window.jQuery(target).on("show.daterangepicker", hide);
  }
}

self.onInit = async function ({ strt: presetStart, end: presetEnd } = {}) {
  const q = (sel) => self.ctx.$container[0].querySelector(sel);

  CUSTOMER_ID = self.ctx.settings.customerId || " ";

  const customerCredentials = await fetchCustomerServerScopeAttrs();

  CLIENT_ID = customerCredentials.client_id || " ";
  CLIENT_SECRET = customerCredentials.client_secret || " ";
  INGESTION_ID = customerCredentials.ingestionId || " ";

  // Initialize MyIO Authentication with extracted component
  if (typeof MyIOLibrary?.buildMyioIngestionAuth === 'function') {
    MyIOAuth = MyIOLibrary.buildMyioIngestionAuth({
      dataApiHost: DATA_API_HOST, 
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET
    });
    console.log("[MyIOAuth] Initialized with extracted component");
  } else {
    console.warn("[MyIOAuth] buildMyioIngestionAuth not available, using fallback");
    // Fallback: create a simple auth object for compatibility
    MyIOAuth = {
      getToken: async () => {
        throw new Error("Authentication component not available");
      },
      clearCache: () => {},
      isTokenValid: () => false
    };
  }

  // Initialize MyIOLibrary DateRangePicker
  var $inputStart = $('input[name="startDatetimes"]');

  console.log("[DateRangePicker] Using MyIOLibrary.createDateRangePicker");

  // Initialize the createDateRangePicker component
  MyIOLibrary.createDateRangePicker($inputStart[0], {
    presetStart: presetStart,
    presetEnd: presetEnd,
    onApply: function (result) {
      console.log("[DateRangePicker] Applied:", result);

      // Update internal dates for compatibility
      self.ctx.$scope.startTs = result.startISO;
      self.ctx.$scope.endTs = result.endISO;

      // The input display is automatically handled by the component
    },
  }).then(function (picker) {
      dateRangePicker = picker;
      console.log("[DateRangePicker] Successfully initialized");
  }).catch(function (error) {
      console.error("[DateRangePicker] Failed to initialize:", error);
  });

  // elementos
  const inputStart = q("#tbx-date-start"); // compat
  const inputEnd = q("#tbx-date-end"); // compat
  const inputRange = q("#tbx-date-range");
  const btnLoad = q("#tbx-btn-load");
  const btnGen = q("#tbx-btn-report-general");

  setupTooltipPremium( inputRange, "📅 Clique para alterar o intervalo de datas");

  // layout (garantia de 50/50)
  const row = self.ctx.$container[0].querySelector(".tbx-row");

  if (row) row.style.flexWrap = "nowrap";

  // handlers externos (compat)
  const listeners = { load: new Set(), general: new Set() };

  self.onLoad = (fn) => listeners.load.add(fn);
  self.onReportGeneral = (fn) => listeners.general.add(fn);

  const emitTo = (set, payload) =>
    set.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.warn(e);
      }
    });
  const fireCE = (name, detail) =>
    self.ctx.$container[0].dispatchEvent(new CustomEvent(name, { detail }));

  // estado
  self.__range = { start: null, end: null };

  // helpers
  const displayFmt = "DD/MM/YYYY HH:mm";
  const fmtDateOnly = (m) => m.format("YYYY-MM-DD"); // compat
  const fmtFullISO = (m) => m.format("YYYY-MM-DD HH:mm:ss"); // com hora

  // filtros (expostos)
  self.getFilters = () => {
    const s = self.__range.start,
      e = self.__range.end;
    return {
      startDate: inputStart?.value || null, // YYYY-MM-DD (compat)
      endDate: inputEnd?.value || null, // YYYY-MM-DD (compat)
      startAt: s ? fmtFullISO(s) : null, // YYYY-MM-DD HH:mm:ss
      endAt: e ? fmtFullISO(e) : null,
      _displayRange:
        s && e ? `📅 ${s.format(displayFmt)} - ${e.format(displayFmt)}` : null,
    };
  };

  // defaults: 1º do mês 00:00 → hoje 23:59
  function defaults(moment) {
    const now = moment();
    const start = moment({
      year: now.year(),
      month: now.month(),
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    });
    const end = moment({
      year: now.year(),
      month: now.month(),
      day: now.date(),
      hour: 23,
      minute: 59,
      second: 0,
    });
    return { start, end };
  }

  // boot
  (async () => {
    const $ = window.jQuery;
    const m = window.moment;

    const def = defaults(m);
    self.__range.start = def.start.clone();
    self.__range.end = def.end.clone();

    if (inputStart) inputStart.value = fmtDateOnly(def.start);
    if (inputEnd) inputEnd.value = fmtDateOnly(def.end);
    if (inputRange) inputRange.value = `📅 ${def.start.format(displayFmt)} - ${def.end.format(displayFmt)}`;

    // Botões
    const payload = () => self.getFilters();
    btnLoad?.addEventListener("click", () => {
      const startDate = self.ctx.$scope.startTs || inputStart.value + "T00:00:00-03:00";
      const endDate = self.ctx.$scope.endTs || inputEnd.value + "T23:59:00-03:00";

      console.log( "Filho enviando para o pai -> start:", startDate,
        "end:", endDate);

      // Dispara evento global
      window.dispatchEvent(
        new CustomEvent("myio:update-date", {detail: { startDate, endDate }, })
      );
    });

    btnGen?.addEventListener("click", async () => {
      const p = payload();
      fireCE("tbx:report:general", p);
      emitTo(listeners.general, p);

      const tbToken = await MyIOAuth.getToken();
      // Use the extracted utility function from MyIOLibrary
      const itemsListTB = MyIOLibrary.buildListItemsThingsboardByUniqueDatasource(self.ctx.datasources, self.ctx.data);
      console.log("[header] itemsListTB >>> ", itemsListTB);

      const modal = MyIOLibrary.openDashboardPopupAllReport({
        customerId: INGESTION_ID,
        debug: 0,
        api: {
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          dataApiBaseUrl: DATA_API_HOST,
          ingestionToken: tbToken,
        },
        itemsList: itemsListTB,
        ui: { theme: "light" },
      });
    });

    // Compat com actionsApi
    if (self.ctx.actionsApi && self.ctx.actionsApi.onCustomAction) {
      self.ctx.actionsApi.onCustomAction((act) => {
        if (act && act.action === "load") btnLoad?.click();
      });
    }

    console.log("[tbx] DRP pronto:", self.getFilters());
  })();
};

self.onDataUpdated = function () {};
self.onResize = function () {};
self.onDestroy = function () {};
