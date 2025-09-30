// === Botões premium do popup (reforço por JS, independe da ordem de CSS) ===
const DATA_API_HOST = "https://api.data.apps.myio-bas.com";

// Import the extracted utility function
// Note: In a ThingsBoard widget context, we'll load this as a script tag or use the global function
// For now, we'll assume the utility is available globally

let CUSTOMER_TB_ID;
let CLIENT_ID;
let CLIENT_SECRET;
let INGESTION_ID;
let CUSTOMER_ID;

const MyIOAuth = (() => {
  // ==== CONFIG ====
  const AUTH_URL = new URL(`${DATA_API_HOST}/api/v1/auth`);

  // ⚠️ Substitua pelos seus valores:

  // Margem para renovar o token antes de expirar (em segundos)
  const RENEW_SKEW_S = 60; // 1 min
  // Em caso de erro, re-tenta com backoff simples
  const RETRY_BASE_MS = 500;
  const RETRY_MAX_ATTEMPTS = 3;

  // Cache em memória (por aba). Se quiser compartilhar entre widgets/abas,
  // você pode trocar por localStorage (com os devidos cuidados de segurança).
  let _token = null; // string
  let _expiresAt = 0; // epoch em ms
  let _inFlight = null; // Promise em andamento para evitar corridas

  function _now() {
    return Date.now();
  }

  function _aboutToExpire() {
    // true se não temos token ou se falta pouco para expirar
    if (!_token) return true;
    const skewMs = RENEW_SKEW_S * 1000;
    return _now() >= _expiresAt - skewMs;
  }

  async function _sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async function _requestNewToken() {
    const body = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    };

    let attempt = 0;
    while (true) {
      try {
        const resp = await fetch(AUTH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(
            `Auth falhou: HTTP ${resp.status} ${resp.statusText} ${text}`
          );
        }

        const json = await resp.json();
        // Espera formato:
        // { access_token, token_type, expires_in, scope }
        if (!json || !json.access_token || !json.expires_in) {
          throw new Error("Resposta de auth não contem campos esperados.");
        }

        _token = json.access_token;
        // Define expiração absoluta (agora + expires_in)
        _expiresAt = _now() + Number(json.expires_in) * 1000;

        // Logs úteis para depuração (não imprimem o token)
        console.log(
          "[MyIOAuth] Novo token obtido. Expira em ~",
          Math.round(Number(json.expires_in) / 60),
          "min"
        );

        return _token;
      } catch (err) {
        attempt++;
        console.warn(
          `[MyIOAuth] Erro ao obter token (tentativa ${attempt}/${RETRY_MAX_ATTEMPTS}):`,
          err?.message || err
        );
        if (attempt >= RETRY_MAX_ATTEMPTS) {
          throw err;
        }
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await _sleep(backoff);
      }
    }
  }

  async function getToken() {
    // Evita múltiplas chamadas paralelas de renovação
    if (_inFlight) {
      return _inFlight;
    }

    if (_aboutToExpire()) {
      _inFlight = _requestNewToken().finally(() => {
        _inFlight = null;
      });
      return _inFlight;
    }

    return _token;
  }

  // Helpers opcionais
  function getExpiryInfo() {
    return {
      expiresAt: _expiresAt,
      expiresInSeconds: Math.max(0, Math.floor((_expiresAt - _now()) / 1000)),
    };
  }

  function clearCache() {
    _token = null;
    _expiresAt = 0;
    _inFlight = null;
  }

  return {
    getToken,
    getExpiryInfo,
    clearCache,
  };
})();

async function fetchCustomerServerScopeAttrs() {
  const tbToken = localStorage.getItem("jwt_token");

  if (!tbToken)
    throw new Error(
      "JWT do ThingsBoard não encontrado (localStorage.jwt_token)."
    );

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
    let x = ev.clientX + 12,
      y = ev.clientY - 36;
    const vw = window.innerWidth,
      rect = tip.getBoundingClientRect();
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
  })
    .then(function (picker) {
      dateRangePicker = picker;
      console.log("[DateRangePicker] Successfully initialized");
    })
    .catch(function (error) {
      console.error("[DateRangePicker] Failed to initialize:", error);
    });

  // elementos
  const inputStart = q("#tbx-date-start"); // compat
  const inputEnd = q("#tbx-date-end"); // compat
  const inputRange = q("#tbx-date-range");
  const btnLoad = q("#tbx-btn-load");
  const btnGen = q("#tbx-btn-report-general");

  setupTooltipPremium(
    inputRange,
    "📅 Clique para alterar o intervalo de datas"
  );

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
    //const ok = await waitFor(libsReady);
    // if (!ok){
    //   console.error('[tbx] DateRangePicker não carregou. Confira Resources e ordem dos scripts.');
    //   return;
    // }

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

      console.log(
        "Filho enviando para o pai -> start:",
        startDate,
        "end:",
        endDate
      );

      // Dispara evento global
      window.dispatchEvent(
        new CustomEvent("myio:update-date", {
          detail: { startDate, endDate },
        })
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
