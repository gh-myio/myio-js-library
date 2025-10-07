// === Botões premium do popup (reforço por JS, independe da ordem de CSS) ===

// Debug configuration
const DEBUG_ACTIVE = false;

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

// MyIO Authentication instance - will be initialized after credentials are loaded
let MyIOAuth = null;

// RFC-0042: Track current domain from MENU widget
let currentDomain = 'energy'; // default to energy

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

  const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
  const CUSTOMER_ID = self.ctx.settings.customerId || " ";
  const tbToken = localStorage.getItem("jwt_token");
  const customerCredentials = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(CUSTOMER_ID, tbToken);
  const CLIENT_ID = customerCredentials.client_id || " ";
  const CLIENT_SECRET = customerCredentials.client_secret || " ";
  const INGESTION_ID = customerCredentials.ingestionId || " ";

  MyIOAuth = MyIOLibrary.buildMyioIngestionAuth({
    dataApiHost: DATA_API_HOST, 
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET
  });
  
  LogHelper.log("[MyIOAuth] Initialized with extracted component");

  // Initialize MyIOLibrary DateRangePicker
  var $inputStart = $('input[name="startDatetimes"]');

  LogHelper.log("[DateRangePicker] Using MyIOLibrary.createDateRangePicker");

  // Initialize the createDateRangePicker component
  MyIOLibrary.createDateRangePicker($inputStart[0], {
    presetStart: presetStart,
    presetEnd: presetEnd,
    onApply: function (result) {
      LogHelper.log("[DateRangePicker] Applied:", result);

      // Update internal dates for compatibility
      self.ctx.$scope.startTs = result.startISO;
      self.ctx.$scope.endTs = result.endISO;

      // The input display is automatically handled by the component
    },
  }).then(function (picker) {
      dateRangePicker = picker;
      LogHelper.log("[DateRangePicker] Successfully initialized");
  }).catch(function (error) {
      LogHelper.error("[DateRangePicker] Failed to initialize:", error);
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
        LogHelper.warn(e);
      }
    });

  const fireCE = (name, detail) => self.ctx.$container[0].dispatchEvent(new CustomEvent(name, { detail }));

  // RFC-0042: Utility functions (reuse from MAIN_VIEW if available, otherwise define locally)
  const toISO = window.toISO || function(dt, tz = 'America/Sao_Paulo') {
    const d = (typeof dt === 'number') ? new Date(dt)
            : (dt instanceof Date) ? dt
            : new Date(String(dt));
    if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
    const offset = -d.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetMins = Math.abs(offset) % 60;
    const offsetStr = `${offset >= 0 ? '+' : '-'}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetStr}`;
  };

  const calcGranularity = window.calcGranularity || function(startISO, endISO) {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    if (diffDays > 92) return 'month';
    if (diffDays > 3) return 'day';
    return 'hour';
  };

  // estado
  self.__range = { start: null, end: null };

  // helpers
  const displayFmt = "DD/MM/YYYY HH:mm";
  const fmtDateOnly = (m) => m.format("YYYY-MM-DD"); // compat
  const fmtFullISO = (m) => m.format("YYYY-MM-DD HH:mm:ss"); // com hora

  // filtros (expostos)
  self.getFilters = () => {
    const s = self.__range.start, e = self.__range.end;
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
    // RFC-0042: Listen for dashboard state changes from MENU
    window.addEventListener('myio:dashboard-state', (ev) => {
      const { tab } = ev.detail;
      LogHelper.log(`[HEADER] Dashboard state changed to: ${tab}`);
      currentDomain = tab;

      // Enable/disable btnGen based on domain (only energy and water supported)
      if (btnGen) {
        const isSupported = tab === 'energy' || tab === 'water';
        btnGen.disabled = !isSupported;
        LogHelper.log(`[HEADER] Relatório Geral button ${isSupported ? 'enabled' : 'disabled'} for domain: ${tab}`);
      }
    });

    btnLoad?.addEventListener("click", () => {
      // RFC-0042: Standardized period emission
      const startISO = toISO(self.ctx.$scope.startTs || inputStart.value + "T00:00:00", 'America/Sao_Paulo');
      const endISO = toISO(self.ctx.$scope.endTs || inputEnd.value + "T23:59:00", 'America/Sao_Paulo');

      const period = {
        startISO,
        endISO,
        granularity: calcGranularity(startISO, endISO),
        tz: 'America/Sao_Paulo'
      };

      LogHelper.log("[HEADER] Emitting standardized period:", period);

      // RFC-0042: Cross-context emission (parent + all iframes)
      function emitToAllContexts(eventName, detail) {
        // 1. Emit to current window (for MAIN_VIEW orchestrator)
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
        LogHelper.log(`[HEADER] ✅ Emitted ${eventName} to current window`);

        // 2. Emit to parent window (if in iframe)
        if (window.parent && window.parent !== window) {
          try {
            window.parent.dispatchEvent(new CustomEvent(eventName, { detail }));
            LogHelper.log(`[HEADER] ✅ Emitted ${eventName} to parent window`);
          } catch (e) {
            LogHelper.warn(`[HEADER] ⚠️ Cannot emit ${eventName} to parent:`, e.message);
          }
        }

        // 3. Emit to all iframes (for TELEMETRY widgets)
        try {
          const iframes = document.querySelectorAll('iframe');
          LogHelper.log(`[HEADER] Found ${iframes.length} iframes`);
          iframes.forEach((iframe, idx) => {
            try {
              iframe.contentWindow.dispatchEvent(new CustomEvent(eventName, { detail }));
              LogHelper.log(`[HEADER] ✅ Emitted ${eventName} to iframe ${idx}`);
            } catch (e) {
              LogHelper.warn(`[HEADER] ⚠️ Cannot emit ${eventName} to iframe ${idx}:`, e.message);
            }
          });
        } catch (e) {
          LogHelper.warn(`[HEADER] ⚠️ Cannot access iframes:`, e.message);
        }
      }

      // Emit standardized event to all contexts
      emitToAllContexts("myio:update-date", { period });

      // Backward compatibility: also emit old format
      emitToAllContexts("myio:update-date-legacy", { startDate: startISO, endDate: endISO });
    });

    btnGen?.addEventListener("click", async () => {
      const p = payload();
      fireCE("tbx:report:general", p);
      emitTo(listeners.general, p);

      try {
        const ingestionAuthToken = await MyIOAuth.getToken();

        // RFC-0042: Use current domain to determine correct datasource and cache
        const domain = currentDomain || 'energy';
        LogHelper.log(`[HEADER] Opening All Report for domain: ${domain}`);

        // RFC-0042: Check orchestrator cache if available
        let itemsListTB;
        if (window.MyIOOrchestrator && window.MyIOOrchestrator.getCurrentPeriod()) {
          const currentPeriod = window.MyIOOrchestrator.getCurrentPeriod();
          const cacheKey = window.cacheKey ? window.cacheKey(domain, currentPeriod) : null;

          if (cacheKey && window.MyIOOrchestrator.memCache) {
            const cached = window.MyIOOrchestrator.memCache.get(cacheKey);
            if (cached && cached.data) {
              LogHelper.log(`[HEADER] Using cached items from orchestrator for domain: ${domain}`);
              itemsListTB = cached.data;
            }
          }
        }

        // Fallback: build from TB datasources
        // IMPORTANT: Widget HEADER must have TWO datasources configured:
        // datasources[0]: Alias "Lojas" (for energy)
        // datasources[1]: Alias "Todos Hidrometros" (for water)
        if (!itemsListTB || itemsListTB.length === 0) {
          // Select correct datasource based on domain
          const datasourceIndex = domain === 'energy' ? 0 : domain === 'water' ? 1 : 0;
          const selectedDatasource = self.ctx.datasources[datasourceIndex];

          console.log("[HEADER] self.ctx.datasources >>>" , self.ctx.datasources);

          if (!selectedDatasource) {
            LogHelper.error(`[HEADER] No datasource found at index ${datasourceIndex} for domain ${domain}`);
            console.log(`[HEADER] No datasource found at index ${datasourceIndex} for domain ${domain}`);
            throw new Error(`Datasource not configured for domain: ${domain}`);
          }

          LogHelper.log(`[HEADER] Using datasource[${datasourceIndex}] (${selectedDatasource.name || selectedDatasource.entityAliasId || 'unnamed'}) for domain: ${domain}`);

          // Build items from the selected datasource only
          itemsListTB = MyIOLibrary.buildListItemsThingsboardByUniqueDatasource([selectedDatasource], self.ctx.data);
          LogHelper.log(`[HEADER] Built ${itemsListTB.length} items for domain ${domain}`);
        }

        const modal = MyIOLibrary.openDashboardPopupAllReport({
          customerId: INGESTION_ID,
          domain: domain, // ← NEW: pass domain ('energy' or 'water')
          debug: 0,
          api: {
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            dataApiBaseUrl: DATA_API_HOST,
            ingestionToken: ingestionAuthToken,
          },
          itemsList: itemsListTB,
          ui: { theme: "light" },
        });
      } catch (err) {
        LogHelper.error("[HEADER] Failed to open All-Report modal:", err);
        alert("Erro ao abrir relatório geral. Tente novamente.");
      }
    });

    // Compat com actionsApi
    if (self.ctx.actionsApi && self.ctx.actionsApi.onCustomAction) {
      self.ctx.actionsApi.onCustomAction((act) => {
        if (act && act.action === "load") btnLoad?.click();
      });
    }

    LogHelper.log("[tbx] DRP pronto:", self.getFilters());
  })();
};

self.onDataUpdated = function () {};
self.onResize = function () {};
self.onDestroy = function () {};
