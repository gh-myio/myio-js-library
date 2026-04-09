/* global self, window, document, localStorage, MyIOLibrary, $ */

// === Botões premium do popup (reforço por JS, independe da ordem de CSS) ===

// RFC-0091: Use shared LogHelper from MAIN widget via window.MyIOUtils
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log('[HEADER]', ...args),
  warn: (...args) => console.warn('[HEADER]', ...args),
  error: (...args) => console.error('[HEADER]', ...args),
};

// MyIO Authentication instance - will be initialized after credentials are loaded
let MyIOAuth = null;

// RFC-0054 FIX: Use global variable to share state across multiple HEADER instances
// This prevents race conditions when multiple widgets are loaded
// VERSION: 2026-03-17-rfc-0152
if (!window.__myioCurrentDomain) {
  window.__myioCurrentDomain = null;
  console.log('[HEADER] VERSION: 2026-03-17-rfc-0152 - Global currentDomain initialized');
}

// RFC-0042: Track current domain from MENU widget (use global reference)
let currentDomain = {
  get value() {
    return window.__myioCurrentDomain;
  },
  set value(v) {
    window.__myioCurrentDomain = v;
  },
};

// RFC-0152: Suppress TB "No data to display on widget" overlay at MODULE SCOPE.
// This runs even if onInit is never called (e.g., when TB datasource resolves to
// 0 entities — ThingsBoard may skip onInit in that case, showing the overlay
// which blocks the date-picker controls).
(function suppressTbNoDataOverlayEarly() {
  const styleId = 'myio-header-no-data-fix';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = '.tb-no-data-text, .tb-widget-no-data-text { display: none !important; }';
    document.head.appendChild(s);
    console.log('[HEADER] RFC-0152: No-data overlay suppressed (module scope)');
  }
})();

// RFC-0152 FALLBACK: If ThingsBoard does not call onInit (empty datasource scenario),
// this module-scope listener emits a default period when myio:dashboard-state arrives,
// preventing the orchestrator from waiting 20s before its own fallback kicks in.
// onInit sets window.__myioHeaderOnInitRan = true to disable this fallback.
window.__myioHeaderOnInitRan = false;
(function installHeaderFallbackPeriodEmitter() {
  // Only install once (guard against multiple HEADER instances)
  if (window.__myioHeaderFallbackInstalled) return;
  window.__myioHeaderFallbackInstalled = true;

  function _fallbackHandler(e) {
    // Give onInit 800ms to mark itself as started
    setTimeout(function () {
      if (window.__myioHeaderOnInitRan) {
        window.removeEventListener('myio:dashboard-state', _fallbackHandler);
        return;
      }
      const domain = e && e.detail && e.detail.tab;
      if (domain !== 'energy' && domain !== 'water') return;

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endDate   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 0);
      const fallbackPeriod = {
        startISO:    startDate.toISOString(),
        endISO:      endDate.toISOString(),
        granularity: 'day',
        tz:          'America/Sao_Paulo',
      };
      window.__myioInitialPeriod = fallbackPeriod;
      console.warn(
        '[HEADER] ⚠️ RFC-0152 FALLBACK: onInit not called — emitting default period for domain:',
        domain, fallbackPeriod
      );
      window.dispatchEvent(new CustomEvent('myio:update-date', { detail: { period: fallbackPeriod } }));
      window.removeEventListener('myio:dashboard-state', _fallbackHandler);
    }, 800);
  }

  window.addEventListener('myio:dashboard-state', _fallbackHandler);
  console.log('[HEADER] RFC-0152: Fallback period emitter installed (module scope)');
})();

/* ==== RFC-0107: Contract Status Icon Management ==== */

/**
 * RFC-0107: Initializes the contract status icon in HEADER
 * Listens for myio:contract:loaded event from MAIN widget
 * Uses ContractSummaryTooltip from library for detailed view
 */
function initContractStatusIcon() {
  // Get the contract status container
  const contractStatusEl = document.getElementById('tbx-contract-status');
  if (!contractStatusEl) {
    LogHelper.warn('[HEADER] Contract status element not found');
    return;
  }

  const iconEl = contractStatusEl.querySelector('.tbx-contract-icon');
  const countEl = contractStatusEl.querySelector('.tbx-contract-count');

  // Style the contract status container (always visible)
  contractStatusEl.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(45, 20, 88, 0.9);
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid rgba(255,255,255,0.15);
    margin-right: 8px;
    transition: all 0.2s ease;
    font-size: 13px;
    color: #fff;
  `;

  // Hover effect
  contractStatusEl.addEventListener('mouseenter', () => {
    contractStatusEl.style.background = 'rgba(45, 20, 88, 1)';
    contractStatusEl.style.borderColor = 'rgba(255,255,255,0.3)';
  });
  contractStatusEl.addEventListener('mouseleave', () => {
    contractStatusEl.style.background = 'rgba(45, 20, 88, 0.9)';
    contractStatusEl.style.borderColor = 'rgba(255,255,255,0.15)';
  });

  /**
   * Updates the contract status icon based on CONTRACT_STATE
   * @param {Object} contractState - The contract state from window.CONTRACT_STATE
   */
  function updateContractStatus(contractState) {
    // Always keep visible, just update content
    if (!contractState || !contractState.isLoaded) {
      // Show loading/waiting state
      if (iconEl) {
        iconEl.textContent = '⏳';
        iconEl.style.cssText = `
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(158, 158, 158, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9e9e9e;
          font-size: 11px;
        `;
      }
      if (countEl) {
        countEl.textContent = 'Carregando...';
        countEl.style.color = '#9e9e9e';
      }
      return;
    }

    const totalDevices =
      (contractState.energy?.total || 0) +
      (contractState.water?.total || 0) +
      (contractState.temperature?.total || 0);

    // Update icon based on validation status
    if (iconEl) {
      if (contractState.isValid) {
        iconEl.textContent = '✓';
        iconEl.style.cssText = `
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(76, 175, 80, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #81c784;
          font-size: 11px;
          font-weight: bold;
        `;
      } else {
        iconEl.textContent = '!';
        iconEl.style.cssText = `
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(244, 67, 54, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef5350;
          font-size: 11px;
          font-weight: bold;
        `;
      }
    }

    // Update count text
    if (countEl) {
      countEl.textContent = `${totalDevices} disp.`;
      countEl.style.color = contractState.isValid ? '#81c784' : '#ef5350';
    }

    LogHelper.log('[HEADER] Contract status updated:', {
      total: totalDevices,
      isValid: contractState.isValid,
    });
  }

  // Click handler to show ContractSummaryTooltip
  contractStatusEl.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();

    LogHelper.log('[HEADER] Contract status clicked, checking ContractSummaryTooltip...');

    const ContractSummaryTooltip = window.MyIOLibrary?.ContractSummaryTooltip;
    if (!ContractSummaryTooltip) {
      LogHelper.error(
        '[HEADER] ContractSummaryTooltip not available in library. Available exports:',
        Object.keys(window.MyIOLibrary || {})
      );
      return;
    }

    // Build tooltip data from window.CONTRACT_STATE
    const contractState = window.CONTRACT_STATE;
    if (!contractState || !contractState.isLoaded) {
      LogHelper.warn('[HEADER] Contract state not loaded yet. CONTRACT_STATE:', contractState);
      return;
    }

    // Build data from global state and show tooltip
    // ContractSummaryTooltip is an object with static methods, not a class
    try {
      const data = ContractSummaryTooltip.buildFromGlobalState();

      if (data) {
        ContractSummaryTooltip.show(contractStatusEl, data);
        LogHelper.log('[HEADER] ContractSummaryTooltip.show() called successfully');
      } else {
        LogHelper.warn(
          '[HEADER] buildFromGlobalState() returned null. CONTRACT_STATE:',
          window.CONTRACT_STATE
        );
      }
    } catch (err) {
      LogHelper.error('[HEADER] Error showing ContractSummaryTooltip:', err);
    }
  });

  // Listen for contract loaded event from MAIN
  window.addEventListener('myio:contract:loaded', (event) => {
    LogHelper.log('[HEADER] Received myio:contract:loaded event:', event.detail);
    updateContractStatus(event.detail);
  });

  // Check if contract already loaded (page refresh scenario)
  if (window.CONTRACT_STATE?.isLoaded) {
    LogHelper.log('[HEADER] Contract already loaded, updating status');
    updateContractStatus(window.CONTRACT_STATE);
  }

  LogHelper.log('[HEADER] Contract status icon initialized');
}

/* ==== Tooltip premium (global no <body>) ==== */
function setupTooltipPremium(target, text) {
  if (!target) return;

  let tip = document.getElementById('tbx-global-tooltip');

  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'tbx-global-tooltip';
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

    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  function show(ev) {
    if (ev) position(ev);
    tip.classList.add('show');
  }

  function hide() {
    tip.classList.remove('show');
  }

  target.addEventListener('mouseenter', show);
  target.addEventListener('mousemove', position);
  target.addEventListener('mouseleave', hide);
  target.addEventListener('focus', (e) => {
    const r = e.target.getBoundingClientRect();
    show({ clientX: r.left + 20, clientY: r.top - 8 });
  });
  target.addEventListener('blur', hide);

  // Se abrir o calendário, esconda a tooltip
  if (window.jQuery) {
    window.jQuery(target).on('show.daterangepicker', hide);
  }
}

self.onInit = async function ({ strt: presetStart, end: presetEnd } = {}) {
  // Signal to the module-scope fallback emitter that onInit IS running
  window.__myioHeaderOnInitRan = true;

  const q = (sel) => self.ctx.$container[0].querySelector(sel);

  // RFC-0152 FIX: Suppress ThingsBoard "No data to display on widget" overlay (also runs at module scope).
  // HEADER does not consume TB datasource rows — it works entirely via custom window events.
  // For water-only / temperature-only customers the TB datasource may have 0 rows, causing
  // the overlay to cover the date-picker controls and make them inaccessible.
  (function suppressTbNoDataOverlay() {
    const styleId = 'myio-header-no-data-fix';
    if (!document.getElementById(styleId)) {
      const s = document.createElement('style');
      s.id = styleId;
      // Target common TB no-data overlay class names across versions
      s.textContent = '.tb-no-data-text, .tb-widget-no-data-text { display: none !important; }';
      document.head.appendChild(s);
    }
  })();

  // RFC-0091: DATA_API_HOST is read at call time via window.MyIOUtils.getDataApiHost()
  // No local snapshot — always gets the live value set by MAIN widget onInit.
  // RFC-0091: Use shared customerTB_ID from MAIN widget via window.MyIOUtils
  const CUSTOMER_ID = window.MyIOUtils?.customerTB_ID;
  if (!CUSTOMER_ID) {
    console.error('[HEADER] customerTB_ID not available from window.MyIOUtils - MAIN widget must load first');
  }
  const tbToken = localStorage.getItem('jwt_token');
  let customerCredentials = {};
  try {
    customerCredentials = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(
      CUSTOMER_ID,
      tbToken
    );
  } catch (credErr) {
    LogHelper.warn(
      '[HEADER] ⚠️ Could not fetch customer credentials from ThingsBoard:',
      credErr?.message
    );
    // Continue without credentials — controls will still be enabled via custom events
  }
  const CLIENT_ID = customerCredentials.client_id || ' ';
  const CLIENT_SECRET = customerCredentials.client_secret || ' ';
  const INGESTION_ID = customerCredentials.ingestionId || ' ';

  try {
    MyIOAuth = MyIOLibrary.buildMyioIngestionAuth({
      dataApiHost: window.MyIOUtils?.getDataApiHost?.(),
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
    LogHelper.log('[MyIOAuth] Initialized with extracted component');
  } catch (err) {
    LogHelper.error('[HEADER] Auth init FAIL', err);
  }

  // RFC-0107: Initialize contract status icon
  initContractStatusIcon();

  // RFC-0049: FIX - Ensure default period is always set
  // Calculate default period: 1st of month 00:00 → today 23:59
  if (!presetStart || !presetEnd) {
    const now = new Date();
    presetStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    presetEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);

    LogHelper.log('[HEADER] 🔧 FIX - Using calculated default period:', {
      start: presetStart.toISOString(),
      end: presetEnd.toISOString(),
    });
  } else {
    LogHelper.log('[HEADER] Using provided preset period:', {
      start: presetStart,
      end: presetEnd,
    });
  }

  // Initialize MyIOLibrary DateRangePicker
  let dateRangePicker = null;
  var $inputStart = $('input[name="startDatetimes"]');

  LogHelper.log('[DateRangePicker] Using MyIOLibrary.createDateRangePicker');

  // Initialize the createDateRangePicker component with guaranteed presets
  MyIOLibrary.createDateRangePicker($inputStart[0], {
    presetStart: presetStart,
    presetEnd: presetEnd,
    maxRangeDays: 90,
    includeTime: true,
    timePrecision: 'hour',
    onApply: function (result) {
      LogHelper.log('[DateRangePicker] Applied:', result);

      // Update internal dates for compatibility
      self.ctx.$scope.startTs = result.startISO;
      self.ctx.$scope.endTs = result.endISO;

      // RFC-0138 FIX: Update self.__range so domain switch emits correct dates
      // Convert ISO strings back to moment objects
      if (result.startISO && result.endISO && window.moment) {
        self.__range.start = window.moment(result.startISO);
        self.__range.end = window.moment(result.endISO);
        LogHelper.log('[DateRangePicker] Updated self.__range:', {
          start: self.__range.start.format('YYYY-MM-DD'),
          end: self.__range.end.format('YYYY-MM-DD'),
        });
      }

      // The input display is automatically handled by the component
    },
  })
    .then(function (picker) {
      dateRangePicker = picker;
      LogHelper.log('[DateRangePicker] Successfully initialized with period');
    })
    .catch(function (error) {
      LogHelper.error('[DateRangePicker] Failed to initialize:', error);
    });

  // elementos
  const inputStart = q('#tbx-date-start'); // compat
  const inputEnd = q('#tbx-date-end'); // compat
  const inputRange = q('#tbx-date-range');
  const btnLoad = q('#tbx-btn-load');
  const btnForceRefresh = q('#tbx-btn-force-refresh');
  const btnGen = q('#tbx-btn-report-general');
  setupTooltipPremium(inputRange, '📅 Clique para alterar o intervalo de datas');

  // layout (garantia de 50/50)
  const row = self.ctx.$container[0].querySelector('.tbx-row');

  if (row) row.style.flexWrap = 'nowrap';

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
  const toISO =
    window.toISO ||
    function (dt, tz = 'America/Sao_Paulo') {
      const d = typeof dt === 'number' ? new Date(dt) : dt instanceof Date ? dt : new Date(String(dt));
      if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
      const offset = -d.getTimezoneOffset();
      const offsetHours = Math.floor(Math.abs(offset) / 60);
      const offsetMins = Math.abs(offset) % 60;
      const offsetStr = `${offset >= 0 ? '+' : '-'}${String(offsetHours).padStart(2, '0')}:${String(
        offsetMins
      ).padStart(2, '0')}`;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');
      const second = String(d.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetStr}`;
    };

  const calcGranularity =
    window.calcGranularity ||
    function (startISO, endISO) {
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
  const displayFmt = 'DD/MM/YYYY HH:mm';
  const fmtDateOnly = (m) => m.format('YYYY-MM-DD'); // compat
  const fmtFullISO = (m) => m.format('YYYY-MM-DD HH:mm:ss'); // com hora

  // filtros (expostos)
  self.getFilters = () => {
    const s = self.__range.start,
      e = self.__range.end;
    return {
      startDate: inputStart?.value || null, // YYYY-MM-DD (compat)
      endDate: inputEnd?.value || null, // YYYY-MM-DD (compat)
      startAt: s ? fmtFullISO(s) : null, // YYYY-MM-DD HH:mm:ss
      endAt: e ? fmtFullISO(e) : null,
      _displayRange: s && e ? `📅 ${s.format(displayFmt)} - ${e.format(displayFmt)}` : null,
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
      second: 59,
    });
    return { start, end };
  }

  // boot
  (async () => {
    const m = window.moment;

    const def = defaults(m);
    self.__range.start = def.start.clone();
    self.__range.end = def.end.clone();

    if (inputStart) inputStart.value = fmtDateOnly(def.start);
    if (inputEnd) inputEnd.value = fmtDateOnly(def.end);
    if (inputRange) inputRange.value = `📅 ${def.start.format(displayFmt)} - ${def.end.format(displayFmt)}`;

    // Botões
    const payload = () => self.getFilters();

    // Helper function to update controls state based on domain
    const updateControlsState = (domain) => {
      const btnText = document.getElementById('tbx-btn-report-general-text');

      // RFC-0178: Alarm domain — enable date controls, swap report buttons
      if (domain === 'alarm') {
        if (inputRange)      inputRange.disabled      = false;
        if (btnLoad)         btnLoad.disabled         = false;
        if (btnForceRefresh) btnForceRefresh.disabled = false;

        // Hide general report button for alarm domain
        if (btnGen) btnGen.style.display = 'none';

        LogHelper.log('[HEADER] alarm domain — date controls enabled');
        return;
      }

      // Read enableReportButton flag from MAIN_VIEW (default: false = hidden)
      const enableReportButton = window.MyIOUtils?.enableReportButton ?? false;

      // Show/hide general report for non-alarm domains
      if (btnGen) btnGen.style.display = enableReportButton ? '' : 'none';

      const domainLabels = {
        energy: 'Relatório Consumo Geral de Energia por Loja',
        water: 'Relatório Consumo Geral de Água por Loja',
      };

      // Only energy and water are supported for all controls
      const isSupported = domain === 'energy' || domain === 'water';

      // Update report button text and state (only when visible)
      if (btnGen && enableReportButton) {
        if (btnText && domainLabels[domain]) {
          btnText.textContent = domainLabels[domain];
          btnGen.title = domainLabels[domain];
        } else if (btnText) {
          btnText.textContent = 'Relatório Consumo Geral';
          btnGen.title = 'Relatório Consumo Geral';
        }

        btnGen.disabled = !isSupported;
        LogHelper.log(
          `[HEADER] Relatório Geral button ${btnGen.disabled ? 'disabled' : 'enabled'} for domain: ${domain}`
        );
      }

      // Update date range input and load button state (same rule as report button)
      if (inputRange) {
        inputRange.disabled = !isSupported;
        LogHelper.log(
          `[HEADER] Date range input ${isSupported ? 'enabled' : 'disabled'} for domain: ${domain}`
        );
      }

      if (btnLoad) {
        btnLoad.disabled = !isSupported;
        LogHelper.log(
          `[HEADER] Carregar button ${isSupported ? 'enabled' : 'disabled'} for domain: ${domain}`
        );
      }

      if (btnForceRefresh) {
        btnForceRefresh.disabled = !isSupported;
        LogHelper.log(
          `[HEADER] Force Refresh button ${isSupported ? 'enabled' : 'disabled'} for domain: ${domain}`
        );
      }
    };

    // RFC-0042: Track if we already emitted initial period
    let hasEmittedInitialPeriod = false;

    // RFC-0042: Listen for dashboard state changes from MENU
    window.addEventListener('myio:dashboard-state', (ev) => {
      const { tab } = ev.detail;
      const previousDomain = currentDomain.value;
      LogHelper.log(`[HEADER] Dashboard state changed to: ${tab} (previous: ${previousDomain})`);
      currentDomain.value = tab;
      LogHelper.log(`[HEADER] currentDomain is now: ${currentDomain.value}`);
      updateControlsState(tab);

      // RFC-0045 FIX: Emit period when domain changes to energy or water
      // RFC-0138 FIX: Always re-emit dates on domain switch to ensure sync
      // This ensures orchestrator has currentPeriod set correctly when switching domains
      if (tab === 'energy' || tab === 'water') {
        hasEmittedInitialPeriod = true;

        // Wait for dateRangePicker to be ready
        setTimeout(() => {
          if (self.__range.start && self.__range.end) {
            const startISO = toISO(self.__range.start.toDate(), 'America/Sao_Paulo');
            const endISO = toISO(self.__range.end.toDate(), 'America/Sao_Paulo');

            const currentPeriod = {
              startISO,
              endISO,
              granularity: calcGranularity(startISO, endISO),
              tz: 'America/Sao_Paulo',
            };

            // RFC-0130: Store period globally for retry mechanism
            window.__myioInitialPeriod = currentPeriod;

            LogHelper.log(`[HEADER] 🚀 RFC-0138: Emitting current period for domain ${tab}:`, currentPeriod);
            emitToAllContexts('myio:update-date', { period: currentPeriod });
          } else {
            LogHelper.warn(`[HEADER] ⚠️ Cannot emit period - dateRangePicker not ready yet`);
          }
        }, 300); // Small delay to ensure dateRangePicker is initialized
      }
    });

    // RFC-0096 FIX: Check if domain was already set before listener was registered (race condition fix)
    // MENU may fire myio:dashboard-state before HEADER's onInit completes
    if (currentDomain.value && (currentDomain.value === 'energy' || currentDomain.value === 'water')) {
      const raceDomain = currentDomain.value;
      LogHelper.log(
        `[HEADER] 🔧 RFC-0096 Race fix: Domain already set to ${raceDomain}, enabling controls and emitting period`
      );
      updateControlsState(raceDomain);
      hasEmittedInitialPeriod = true;

      // Also emit period since we missed the myio:dashboard-state event.
      // Without this the orchestrator waits ~20 s for its 15-attempt retry to exhaust
      // before falling back to the default period.
      setTimeout(() => {
        if (self.__range.start && self.__range.end) {
          const startISO = toISO(self.__range.start.toDate(), 'America/Sao_Paulo');
          const endISO   = toISO(self.__range.end.toDate(), 'America/Sao_Paulo');
          const racePeriod = {
            startISO,
            endISO,
            granularity: calcGranularity(startISO, endISO),
            tz: 'America/Sao_Paulo',
          };
          window.__myioInitialPeriod = racePeriod;
          LogHelper.log(`[HEADER] 🚀 RFC-0096 Race fix: Emitting period for domain ${raceDomain}:`, racePeriod);
          emitToAllContexts('myio:update-date', { period: racePeriod });
        } else {
          LogHelper.warn(`[HEADER] ⚠️ RFC-0096 Race fix: date range not ready, orchestrator will use its own fallback`);
        }
      }, 300);
    }

    // RFC-0130: Listen for data-ready events to enable controls after retry mechanism loads data
    // This ensures the "Relatório" button is enabled even if data loads after initial load
    window.addEventListener('myio:energy-summary-ready', () => {
      if (currentDomain.value === 'energy') {
        LogHelper.log('[HEADER] RFC-0130: Energy data loaded, ensuring controls are enabled');
        updateControlsState('energy');
      }
    });

    window.addEventListener('myio:water-summary-ready', () => {
      if (currentDomain.value === 'water') {
        LogHelper.log('[HEADER] RFC-0130: Water data loaded, ensuring controls are enabled');
        updateControlsState('water');
      }
    });

    // RFC-0130: Also listen for generic data-ready event
    window.addEventListener('myio:data-ready', (ev) => {
      const domain = currentDomain.value;
      if (domain === 'energy' || domain === 'water') {
        LogHelper.log(
          `[HEADER] RFC-0130: Data ready event received, ensuring controls are enabled for ${domain}`
        );
        updateControlsState(domain);
      }
    });

    // RFC-0130: Listen for telemetry provide-data event (from MAIN_VIEW Orchestrator)
    // This ensures controls are enabled after retry mechanism successfully loads data
    window.addEventListener('myio:telemetry:provide-data', (ev) => {
      const domain = ev.detail?.domain || currentDomain.value;
      if (domain === 'energy' || domain === 'water') {
        LogHelper.log(
          `[HEADER] RFC-0130: Telemetry data provided for ${domain}, ensuring controls are enabled`
        );
        updateControlsState(domain);
      }
    });

    // RFC-0178: When user switches to "Histórico Fechados" in the alarm panel, auto-emit
    // the current HEADER date range so the ALARM controller can filter CLOSED alarms
    // by the selected period without requiring a manual "Carregar" click.
    window.addEventListener('myio:closed-alarms-toggle', (ev) => {
      if (currentDomain.value !== 'alarm') return;
      if (!ev.detail?.enabled) return; // only emit when entering historical mode
      const filters = self.getFilters();
      if (filters.startAt && filters.endAt) {
        LogHelper.log('[HEADER] Auto-emitting alarm-filter-change for closed-alarms-toggle:', filters.startAt, '→', filters.endAt);
        window.dispatchEvent(new CustomEvent('myio:alarm-filter-change', {
          detail: { from: filters.startAt, to: filters.endAt },
        }));
      } else {
        LogHelper.warn('[HEADER] closed-alarms-toggle: no date range available, ALARM will use fallback period');
      }
    });

    // ── RFC-0193: Alarm Notification Tooltip ──────────────────────────────────

    const ALARM_NOTIF_CSS = `
.ant-tooltip {
  position: fixed; z-index: 99999;
  pointer-events: none; opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: translateY(8px);
}
.ant-tooltip.visible  { opacity: 1; transform: translateY(0); pointer-events: auto; }
.ant-tooltip.closing  { opacity: 0; transform: translateY(8px); transition: opacity 0.4s ease, transform 0.4s ease; pointer-events: none; }
.ant-tooltip.dragging { transition: none !important; cursor: move; }
.ant-tooltip.maximized {
  top: 20px !important; left: 20px !important;
  right: 20px !important; bottom: 20px !important;
  width: auto !important; max-width: none !important;
}
.ant-tooltip.maximized .ant-content { width: 100%; height: 100%; max-width: none; max-height: none; display: flex; flex-direction: column; font-size: 14px; }
.ant-tooltip.maximized .ant-body    { flex: 1; overflow-y: auto; min-height: 0; }
.ant-tooltip.maximized .ant-header-title { font-size: 16px; }
.ant-tooltip.maximized .ant-toggle-label { font-size: 14px; }
.ant-tooltip.maximized .ant-toggle-sub  { font-size: 12px; }
.ant-tooltip.maximized .ant-summary-num { font-size: 22px; }
.ant-tooltip.maximized .ant-summary-label { font-size: 13px; }
.ant-tooltip.maximized .ant-section-hdr  { font-size: 13px; }
.ant-tooltip.maximized .ant-alarm-device { font-size: 13px; }
.ant-tooltip.maximized .ant-alarm-title  { font-size: 12px; }
.ant-tooltip.maximized .ant-alarm-time   { font-size: 11px; }
.ant-tooltip.maximized .ant-footer-label { font-size: 13px; }
.ant-tooltip.maximized .ant-footer-value { font-size: 20px; }
.ant-tooltip.pinned { box-shadow: 0 0 0 2px #0a6d5e, 0 10px 40px rgba(0,0,0,0.2); }
.ant-content {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15), 0 2px 10px rgba(0,0,0,0.08);
  width: 1008px; max-width: 95vw; max-height: 82vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px; color: #1e293b; overflow: hidden;
  display: flex; flex-direction: column;
}
.ant-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: linear-gradient(90deg, #e6f4f1 0%, #c3e6e2 100%);
  border-bottom: 1px solid #7ecfc8; border-radius: 12px 12px 0 0;
  cursor: move; user-select: none;
}
.ant-header-icon  { font-size: 18px; }
.ant-header-title { font-weight: 700; font-size: 14px; color: #0a4f45; flex: 1; }
.ant-header-ts    { font-size: 10px; color: #6b7280; margin-right: 8px; }
.ant-header-actions { display: flex; align-items: center; gap: 4px; }
.ant-hbtn {
  width: 24px; height: 24px; border: none; background: rgba(255,255,255,0.6);
  border-radius: 4px; cursor: pointer; display: flex; align-items: center;
  justify-content: center; transition: all 0.15s; color: #64748b;
}
.ant-hbtn:hover { background: rgba(255,255,255,0.9); color: #1e293b; }
.ant-hbtn.pinned { background: #0a6d5e; color: #fff; }
.ant-hbtn.pinned:hover { background: #084f44; color: #fff; }
.ant-hbtn svg { width: 14px; height: 14px; }
.ant-body { padding: 14px; overflow-y: auto; flex: 1; min-height: 0; }

/* Toggle row */
.ant-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; background: #f8faf9; border-radius: 8px;
  margin-bottom: 12px; border: 1px solid #e0eceb;
}
.ant-toggles-inline { display: flex; gap: 8px; margin-bottom: 12px; }
.ant-toggles-inline .ant-toggle-row { flex: 1; margin-bottom: 0; }
.ant-toggle-label { font-weight: 600; font-size: 12px; color: #1e293b; }
.ant-toggle-sub   { font-size: 10px; color: #64748b; margin-top: 1px; }
.ant-switch {
  position: relative; display: inline-block; width: 36px; height: 20px;
  cursor: pointer; flex-shrink: 0;
}
.ant-switch input { opacity: 0; width: 0; height: 0; }
.ant-switch-track {
  position: absolute; inset: 0; background: #cbd5e1; border-radius: 20px;
  transition: background 0.2s;
}
.ant-switch input:checked + .ant-switch-track { background: #0a6d5e; }
.ant-switch-thumb {
  position: absolute; top: 3px; left: 3px; width: 14px; height: 14px;
  background: #fff; border-radius: 50%; transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.ant-switch input:checked ~ .ant-switch-thumb { transform: translateX(16px); }

/* Summary bar */
.ant-summary {
  display: flex; gap: 8px; margin-bottom: 12px;
}
.ant-summary-item {
  flex: 1; text-align: center; padding: 8px 4px;
  background: #f8faf9; border: 1px solid #e0eceb; border-radius: 8px;
}
.ant-summary-num   { font-size: 20px; font-weight: 700; color: #0a6d5e; line-height: 1; }
.ant-summary-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }

/* Section headers */
.ant-section-hdr {
  font-size: 10px; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.5px;
  margin: 12px 0 6px; padding-bottom: 4px;
  border-bottom: 1px solid #e2e8f0;
}

/* Summary cards row — primary */
.ant-summary-primary { display: flex; gap: 8px; margin-bottom: 10px; }
.ant-summary-card {
  flex: 1; text-align: center; padding: 10px 6px; border-radius: 10px;
  border: 1px solid #e0eceb;
}
.ant-summary-card.open   { background: #fff5f5; border-color: #fca5a5; }
.ant-summary-card.closed { background: #f0fdf4; border-color: #6ee7b7; }
.ant-summary-card-num   { font-size: 26px; font-weight: 800; line-height: 1; }
.ant-summary-card.open   .ant-summary-card-num { color: #dc2626; }
.ant-summary-card.closed .ant-summary-card-num { color: #059669; }
.ant-summary-card-lbl   { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 3px; }

/* Active breakdown grid */
.ant-breakdown { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
.ant-breakdown-item {
  padding: 7px 10px; border-radius: 8px; border: 1px solid #e2e8f0;
  background: #f8faf9; display: flex; align-items: center; gap: 8px;
}
.ant-breakdown-dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
}
.ant-breakdown-dot.CRITICAL { background: #dc2626; }
.ant-breakdown-dot.HIGH     { background: #f59e0b; }
.ant-breakdown-dot.MEDIUM   { background: #3b82f6; }
.ant-breakdown-dot.LOW      { background: #6b7280; }
.ant-breakdown-dot.INFO     { background: #a78bfa; }
.ant-breakdown-dot.ACK      { background: #0891b2; }
.ant-breakdown-dot.SNOOZED  { background: #8b5cf6; }
.ant-breakdown-dot.ESCALATED{ background: #ea580c; }
.ant-breakdown-info { flex: 1; min-width: 0; }
.ant-breakdown-name { font-size: 11px; font-weight: 600; color: #374151; }
.ant-breakdown-count{ font-size: 16px; font-weight: 800; color: #1e293b; line-height: 1; }

/* First / last alarm highlight */
.ant-firstlast { display: flex; gap: 6px; margin-bottom: 10px; }
.ant-fl-card {
  flex: 1; padding: 8px 10px; border-radius: 8px;
  background: #f8faf9; border: 1px solid #e2e8f0;
}
.ant-fl-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
.ant-fl-title { font-size: 11px; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ant-fl-device{ font-size: 10px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ant-fl-time  { font-size: 10px; color: #94a3b8; margin-top: 2px; }

/* Severity chips */
.ant-sev-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.ant-sev-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 700;
}
.ant-sev-chip.CRITICAL { background: #fee2e2; color: #b91c1c; }
.ant-sev-chip.HIGH     { background: #fef3c7; color: #b45309; }
.ant-sev-chip.MEDIUM   { background: #dbeafe; color: #1d4ed8; }
.ant-sev-chip.LOW      { background: #f3f4f6; color: #6b7280; }

/* Alarm list */
.ant-alarm-list { display: flex; flex-direction: column; gap: 4px; }
.ant-alarm-row {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 6px 8px; border-radius: 6px; background: #f8faf9;
  border: 1px solid #f1f5f9; transition: background 0.12s;
}
.ant-alarm-row:hover { background: #f0f9f7; border-color: #c3e6e2; }
.ant-alarm-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 3px;
}
.ant-alarm-dot.CRITICAL { background: #dc2626; }
.ant-alarm-dot.HIGH     { background: #f59e0b; }
.ant-alarm-dot.MEDIUM   { background: #3b82f6; }
.ant-alarm-dot.LOW      { background: #6b7280; }
.ant-alarm-dot.CLOSED   { background: #10b981; }
.ant-alarm-info { flex: 1; min-width: 0; }
.ant-alarm-device {
  font-size: 12px; font-weight: 700; color: #1e293b;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ant-alarm-title {
  font-size: 11px; color: #64748b;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ant-alarm-time { font-size: 10px; color: #94a3b8; flex-shrink: 0; margin-top: 2px; }
.ant-empty { text-align: center; color: #94a3b8; font-size: 12px; padding: 12px 0; }
/* Collapsible sections */
.ant-collapse { margin-bottom: 10px; }
.ant-collapse summary {
  font-size: 10px; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.5px;
  padding: 6px 0 4px; border-bottom: 1px solid #e2e8f0;
  cursor: pointer; list-style: none; display: flex; align-items: center;
  justify-content: space-between; user-select: none;
}
.ant-collapse summary::-webkit-details-marker { display: none; }
.ant-collapse summary::after {
  content: '▸'; font-size: 12px; color: #94a3b8; transition: transform 0.2s;
}
.ant-collapse[open] summary::after { transform: rotate(90deg); }
.ant-collapse summary:hover { color: #0a4f45; }
.ant-collapse-body { padding-top: 8px; }
.ant-footer {
  padding: 10px 14px; border-top: 1px solid #e8ecef;
  background: linear-gradient(135deg, #0a6d5e 0%, #0d8570 100%);
  border-radius: 0 0 11px 11px;
  display: flex; align-items: center; justify-content: space-between;
}
.ant-footer-label { font-size: 11px; color: rgba(255,255,255,0.85); font-weight: 600; }
.ant-footer-value { font-size: 16px; font-weight: 700; color: #fff; }
.ant-footer-btn {
  padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.15); color: #fff; font-size: 11px; font-weight: 600;
  cursor: pointer; display: flex; align-items: center; gap: 5px;
  transition: background 0.15s;
}
.ant-footer-btn:hover { background: rgba(255,255,255,0.28); }
/* Locked / not-configured state */
.ant-locked {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 30px; gap: 14px; text-align: center;
}
.ant-locked-icon { font-size: 48px; line-height: 1; }
.ant-locked-title { font-size: 15px; font-weight: 700; color: #374151; }
.ant-locked-sub   { font-size: 12px; color: #6b7280; max-width: 260px; line-height: 1.5; }
    `;

    let _antCssInjected = false;
    function _antInjectCSS() {
      if (_antCssInjected) return;
      const id = 'myio-ant-styles';
      if (!document.getElementById(id)) {
        const s = document.createElement('style');
        s.id = id; s.textContent = ALARM_NOTIF_CSS;
        document.head.appendChild(s);
      }
      _antCssInjected = true;
    }

    function _antFmtTime(iso) {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } catch { return ''; }
    }

    function _antFmtNow() {
      try {
        return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } catch { return ''; }
    }

    const _OFFLINE_TYPES = ['DEVICE OFFLINE', 'DISPOSITIVO OFFLINE'];
    function _isOfflineAlarm(a) {
      const t = (a.title ?? '').toUpperCase();
      return _OFFLINE_TYPES.some((ex) => t.startsWith(ex)) || a.alarmType === 'connectivity';
    }

    const AlarmNotificationTooltip = {
      containerId: 'myio-ant-tooltip',
      _hideTimer: null,
      _forceHideTimer: null,
      _isMouseOver: false,
      _isPinned: false,
      _isMaximized: false,
      _isDragging: false,
      _dragOffset: { x: 0, y: 0 },
      _savedPosition: null,

      getContainer() {
        _antInjectCSS();
        let c = document.getElementById(this.containerId);
        if (!c) {
          c = document.createElement('div');
          c.id = this.containerId;
          c.className = 'ant-tooltip';
          document.body.appendChild(c);
        }
        return c;
      },

      renderHTML() {
        // Gate: if alarms API not configured for this customer, show locked state
        if (!window.MyIOOrchestrator?.alarmsConfigured) {
          return `
            <div class="ant-content">
              <div class="ant-header" data-drag-handle>
                <span class="ant-header-icon">🔔</span>
                <span class="ant-header-title">Notificações de Alarme</span>
                <div class="ant-header-actions">
                  <button class="ant-hbtn" data-action="close" title="Fechar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="ant-locked">
                <div class="ant-locked-icon">🔒</div>
                <div class="ant-locked-title">Funcionalidade de Alarmes não está ativada</div>
                <div class="ant-locked-sub">Este cliente não possui a integração de alarmes configurada. Entre em contato com o suporte MYIO para habilitar.</div>
              </div>
            </div>`;
        }

        const adm = window.MyIOOrchestrator?.alarmDayMap;
        const enabled = window.MyIOOrchestrator?.alarmNotificationsEnabled !== false;
        const showOffline = window.MyIOOrchestrator?.showOfflineAlarms === true;
        const _email = (window.MyIOUtils?.currentUserEmail || '').toLowerCase();
        const isMyioUser = _email.endsWith('@myio.com.br') && !_email.startsWith('alarme@') && !_email.startsWith('alarmes@');
        const isInternalSupportRule = window.MyIOOrchestrator?.isInternalSupportRule !== false;

        const _offlineFilter = (a) => showOffline || !_isOfflineAlarm(a);

        const all     = (adm ? adm.listAll() : []).filter(_offlineFilter);
        const closed  = (adm ? adm.listByStatus('CLOSED') : []).filter(_offlineFilter);

        // "Ativos agora" = same source as the badge (customerAlarms = _prefetchCustomerAlarms result)
        // alarmDayMap only covers today's date range — would under-count older open alarms
        const customerAlarms = window.MyIOOrchestrator?.customerAlarms || [];
        const active = (customerAlarms.length > 0
          ? customerAlarms
          : (adm ? adm.listByStatus(['OPEN','ACK','ESCALATED','SNOOZED']) : [])
        ).filter(_offlineFilter);

        // Severity breakdown of active alarms
        const sevCount   = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
        const stateCount = { ACK: 0, SNOOZED: 0, ESCALATED: 0 };
        for (const a of active) {
          const s = a.severity || 'LOW';
          if (s in sevCount) sevCount[s]++;
          const st = a.state || '';
          if (st in stateCount) stateCount[st]++;
        }

        const sevLabels   = { CRITICAL: 'Crítico', HIGH: 'Alto', MEDIUM: 'Médio', LOW: 'Baixo', INFO: 'Info' };
        const stateLabels = { ACK: 'Reconhecido', SNOOZED: 'Adiado', ESCALATED: 'Escalado' };

        const mkBreakdown = (key, label, dotCls) => `
          <div class="ant-breakdown-item">
            <div class="ant-breakdown-dot ${dotCls}"></div>
            <div class="ant-breakdown-info">
              <div class="ant-breakdown-name">${label}</div>
              <div class="ant-breakdown-count">${sevCount[key] ?? stateCount[key] ?? 0}</div>
            </div>
          </div>`;

        const sevGrid   = Object.keys(sevCount).map(k => mkBreakdown(k, sevLabels[k], k)).join('');
        const stateGrid = Object.keys(stateCount).map(k => mkBreakdown(k, stateLabels[k], k)).join('');

        // First and last alarm of the day
        const sortedAll = [...all].sort((a,b) => {
          const ta = new Date(a.firstOccurrence || a.raisedAt || 0).getTime();
          const tb = new Date(b.firstOccurrence || b.raisedAt || 0).getTime();
          return ta - tb;
        });
        const firstAlarm = sortedAll[0] || null;
        const lastAlarm  = sortedAll[sortedAll.length - 1] || null;

        const gcdrMap = window.MyIOOrchestrator?.gcdrDeviceNameMap;
        const _resolveAlarmDeviceLabel = (alarm) => {
          const label   = gcdrMap?.get(alarm.deviceId || alarm.source || '') || null;
          const rawName = alarm.deviceName || '';
          if (label && rawName && label !== rawName) return `${label} (${rawName})`;
          return label || rawName || alarm.source || '';
        };

        const mkFlCard = (label, alarm) => {
          if (!alarm) return `<div class="ant-fl-card"><div class="ant-fl-label">${label}</div><div class="ant-fl-title" style="color:#94a3b8">—</div></div>`;
          const title  = alarm.title || alarm.alarmType || 'Alarme';
          const device = _resolveAlarmDeviceLabel(alarm);
          const ts     = label === 'Primeiro' ? (alarm.firstOccurrence || alarm.raisedAt) : (alarm.lastOccurrence || alarm.lastUpdatedAt || alarm.raisedAt);
          return `
            <div class="ant-fl-card">
              <div class="ant-fl-label">${label}</div>
              <div class="ant-fl-title">${title}</div>
              ${device ? `<div class="ant-fl-device">${device}</div>` : ''}
              <div class="ant-fl-time">${_antFmtTime(ts)}</div>
            </div>`;
        };

        // Row renderer shared by both lists
        const mkAlarmRow = (a) => {
          const sev    = a.severity || 'LOW';
          const state  = a.state || '';
          const dotCls = state === 'CLOSED' ? 'CLOSED' : sev;
          const device = _resolveAlarmDeviceLabel(a);
          const title  = a.title || a.alarmType || 'Alarme';
          const time   = _antFmtTime(a.lastOccurrence || a.lastUpdatedAt || a.raisedAt);
          return `
            <div class="ant-alarm-row">
              <div class="ant-alarm-dot ${dotCls}"></div>
              <div class="ant-alarm-info">
                ${device ? `<div class="ant-alarm-device">${device}</div>` : ''}
                <div class="ant-alarm-title">${title}</div>
              </div>
              ${time ? `<div class="ant-alarm-time">${time}</div>` : ''}
            </div>`;
        };

        // Active alarms list (Ativos do Dia)
        const activeSorted = [...active].sort((a,b) => {
          const ta = new Date(a.lastOccurrence || a.lastUpdatedAt || a.raisedAt || 0).getTime();
          const tb = new Date(b.lastOccurrence || b.lastUpdatedAt || b.raisedAt || 0).getTime();
          return tb - ta;
        });
        const activeSection = active.length > 0 ? `
          <details class="ant-collapse">
            <summary>Ativos (${active.length})</summary>
            <div class="ant-collapse-body">
              <div class="ant-alarm-list">${activeSorted.map(mkAlarmRow).join('')}</div>
            </div>
          </details>` : '';

        // History list (Histórico do Dia — all, most recent first, max 40)
        const sorted = [...all].sort((a,b) => {
          const ta = new Date(a.lastOccurrence || a.lastUpdatedAt || a.raisedAt || 0).getTime();
          const tb = new Date(b.lastOccurrence || b.lastUpdatedAt || b.raisedAt || 0).getTime();
          return tb - ta;
        }).slice(0, 40);
        const histSection = all.length > 0 ? `
          <details class="ant-collapse">
            <summary>Histórico do Dia (${all.length})</summary>
            <div class="ant-collapse-body">
              <div class="ant-alarm-list">${sorted.map(mkAlarmRow).join('')}</div>
            </div>
          </details>` : '';

        return `
          <div class="ant-content">
            <div class="ant-header" data-drag-handle>
              <span class="ant-header-icon">🔔</span>
              <span class="ant-header-title">Notificações de Alarme</span>
              <span class="ant-header-ts">${_antFmtNow()}</span>
              <div class="ant-header-actions">
                <button class="ant-hbtn" data-action="pin" title="Fixar na tela">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
                    <line x1="12" y1="16" x2="12" y2="21"/>
                    <line x1="8" y1="4" x2="16" y2="4"/>
                  </svg>
                </button>
                <button class="ant-hbtn" data-action="maximize" title="Maximizar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                  </svg>
                </button>
                <button class="ant-hbtn" data-action="close" title="Fechar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="ant-body">
              <div class="ant-toggles-inline">
                <div class="ant-toggle-row">
                  <div>
                    <div class="ant-toggle-label">Notificações de Alarmes no Painel</div>
                    <div class="ant-toggle-sub">Ativar/desativar notificações flutuantes</div>
                  </div>
                  <label class="ant-switch" title="Ativar/desativar notificações">
                    <input type="checkbox" id="ant-notif-toggle" ${enabled ? 'checked' : ''}>
                    <span class="ant-switch-track"></span>
                    <span class="ant-switch-thumb"></span>
                  </label>
                </div>
                <div class="ant-toggle-row">
                  <div>
                    <div class="ant-toggle-label">Alarmes de Dispositivos Offline</div>
                    <div class="ant-toggle-sub">Ativar/desativar exibição de alarmes offline</div>
                  </div>
                  <label class="ant-switch" title="Ativar/desativar alarmes offline">
                    <input type="checkbox" id="ant-offline-toggle" ${showOffline ? 'checked' : ''}>
                    <span class="ant-switch-track"></span>
                    <span class="ant-switch-thumb"></span>
                  </label>
                </div>
                ${isMyioUser ? `
                <div class="ant-toggle-row">
                  <div>
                    <div class="ant-toggle-label">Regras Internas MyIO</div>
                    <div class="ant-toggle-sub">Incluir regras de suporte interno nas consultas</div>
                  </div>
                  <label class="ant-switch" title="Regras internas MyIO (visível apenas @myio.com.br)">
                    <input type="checkbox" id="ant-internal-rule-toggle" ${isInternalSupportRule ? 'checked' : ''}>
                    <span class="ant-switch-track"></span>
                    <span class="ant-switch-thumb"></span>
                  </label>
                </div>` : ''}
              </div>

              <div class="ant-summary-primary">
                <div class="ant-summary-card open">
                  <div class="ant-summary-card-num">${active.length}</div>
                  <div class="ant-summary-card-lbl">Ativos agora</div>
                </div>
                <div class="ant-summary-card closed">
                  <div class="ant-summary-card-num">${closed.length}</div>
                  <div class="ant-summary-card-lbl">Encerrados hoje</div>
                </div>
              </div>

              <div class="ant-section-hdr">Ativos por Severidade</div>
              <div class="ant-breakdown">${sevGrid}</div>

              <div class="ant-section-hdr">Ativos por Estado</div>
              <div class="ant-breakdown">${stateGrid}</div>

              <details class="ant-collapse">
                <summary>Primeiro e Último Alarme do Dia</summary>
                <div class="ant-collapse-body">
                  <div class="ant-firstlast">
                    ${mkFlCard('Primeiro', firstAlarm)}
                    ${mkFlCard('Último', lastAlarm)}
                  </div>
                </div>
              </details>

              ${activeSection}
              ${histSection}
            </div>
            <div class="ant-footer">
              <span class="ant-footer-label">Alarmes hoje</span>
              <span class="ant-footer-value">${all.length}</span>
              <button class="ant-footer-btn" data-action="open-alarm-map">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
                Regras de Alarmes
              </button>
            </div>
          </div>`;
      },

      show(triggerElement) {
        if (this._hideTimer)  { clearTimeout(this._hideTimer);  this._hideTimer  = null; }
        if (this._forceHideTimer) { clearTimeout(this._forceHideTimer); this._forceHideTimer = null; }
        const container = this.getContainer();
        container.innerHTML = this.renderHTML();
        this._bindEvents(container);
        this._setupDrag(container);
        container.classList.remove('closing');
        // Position after layout so offsetWidth is available; then show
        setTimeout(() => {
          if (!this._isPinned) this._position(triggerElement);
          container.classList.add('visible');
        }, 0);

        container.addEventListener('mouseenter', () => {
          this._isMouseOver = true;
          if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
        });
        container.addEventListener('mouseleave', () => {
          this._isMouseOver = false;
          if (!this._isPinned) this.hide();
        });
      },

      hide(immediate) {
        if (this._isPinned && !immediate) return;
        if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
        this._hideTimer = setTimeout(() => {
          const container = document.getElementById(this.containerId);
          if (!container) return;
          container.classList.add('closing');
          container.classList.remove('visible');
          this._hideTimer = null;
        }, immediate ? 0 : 300);
      },

      _position(triggerElement) {
        const container = document.getElementById(this.containerId);
        if (!container || !triggerElement) return;
        const rect = triggerElement.getBoundingClientRect();
        const vw   = window.innerWidth;
        const vh   = window.innerHeight;
        container.style.position = 'fixed';
        container.style.removeProperty('right');
        container.style.removeProperty('bottom');
        // Use actual rendered width so it works regardless of CSS changes
        const cw   = container.offsetWidth || 720;
        let top  = rect.bottom + 8;
        // Align right edge of tooltip to right edge of trigger, then clamp to viewport
        let left = rect.right - cw;
        if (left + cw > vw - 8) left = vw - cw - 8;
        if (left < 8) left = 8;
        if (top + 500 > vh) top = rect.top - 510;
        if (top < 8) top = 8;
        container.style.top  = `${top}px`;
        container.style.left = `${left}px`;
      },

      _bindEvents(container) {
        // Pin
        container.querySelector('[data-action="pin"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._isPinned = !this._isPinned;
          container.classList.toggle('pinned', this._isPinned);
          e.currentTarget.classList.toggle('pinned', this._isPinned);
        });
        // Maximize
        container.querySelector('[data-action="maximize"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._isMaximized = !this._isMaximized;
          container.classList.toggle('maximized', this._isMaximized);
        });
        // Close
        container.querySelector('[data-action="close"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._isPinned = false;
          this.hide(true);
        });
        // Open Alarm Bundle Map modal
        container.querySelector('[data-action="open-alarm-map"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!window.MyIOOrchestrator?.alarmsConfigured) {
            LogHelper.warn('[HEADER] open-alarm-map: alarms not configured for this customer');
            return;
          }
          const MyIOLibrary = window.MyIOLibrary;
          if (!MyIOLibrary?.openAlarmBundleMapModal) {
            LogHelper.warn('[HEADER] openAlarmBundleMapModal not available in MyIOLibrary');
            return;
          }
          const customerTB_ID  = window.MyIOOrchestrator?.customerTB_ID || '';
          const gcdrTenantId   = window.MyIOOrchestrator?.gcdrTenantId  || '';
          const gcdrApiBaseUrl = window.MyIOOrchestrator?.gcdrApiBaseUrl || 'https://gcdr-api.a.myio-bas.com';
          if (!customerTB_ID) {
            LogHelper.warn('[HEADER] open-alarm-map: customerTB_ID not available');
            return;
          }
          MyIOLibrary.openAlarmBundleMapModal({ customerTB_ID, gcdrTenantId, gcdrApiBaseUrl });
        });

        // Notification toggle
        const toggle = container.querySelector('#ant-notif-toggle');
        if (toggle) {
          toggle.addEventListener('change', async () => {
            const enabled = toggle.checked;
            // Optimistically update in memory
            if (window.MyIOOrchestrator) window.MyIOOrchestrator.alarmNotificationsEnabled = enabled;
            // Persist to ThingsBoard SERVER_SCOPE
            try {
              const jwt = localStorage.getItem('jwt_token');
              const customerId = window.MyIOOrchestrator?.customerTB_ID;
              const tbBase = self.ctx?.settings?.tbBaseUrl || '';
              if (jwt && customerId) {
                await fetch(`${tbBase}/api/plugins/telemetry/CUSTOMER/${customerId}/attributes/SERVER_SCOPE`, {
                  method: 'POST',
                  headers: {
                    'X-Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ alarmNotificationsEnabled: enabled }),
                });
              }
            } catch (err) {
              LogHelper.warn('[HEADER] Failed to save alarmNotificationsEnabled:', err);
            }
          });
        }

        // Offline alarms toggle
        const offlineToggle = container.querySelector('#ant-offline-toggle');
        if (offlineToggle) {
          offlineToggle.addEventListener('change', async () => {
            const show = offlineToggle.checked;
            if (window.MyIOOrchestrator) window.MyIOOrchestrator.showOfflineAlarms = show;
            window.dispatchEvent(new CustomEvent('myio:offline-alarms-toggle', { detail: { show } }));
            try {
              const jwt = localStorage.getItem('jwt_token');
              const customerId = window.MyIOOrchestrator?.customerTB_ID;
              const tbBase = self.ctx?.settings?.tbBaseUrl || '';
              if (jwt && customerId) {
                await fetch(`${tbBase}/api/plugins/telemetry/CUSTOMER/${customerId}/attributes/SERVER_SCOPE`, {
                  method: 'POST',
                  headers: {
                    'X-Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ showOfflineAlarms: show }),
                });
              }
            } catch (err) {
              LogHelper.warn('[HEADER] Failed to save showOfflineAlarms:', err);
            }
          });
        }

        // Internal support rule toggle (only rendered for @myio.com.br users)
        const internalRuleToggle = container.querySelector('#ant-internal-rule-toggle');
        if (internalRuleToggle) {
          internalRuleToggle.addEventListener('change', async () => {
            const value = internalRuleToggle.checked;
            if (window.MyIOOrchestrator) window.MyIOOrchestrator.isInternalSupportRule = value;
            window.dispatchEvent(new CustomEvent('myio:internal-support-rule-changed', { detail: { value } }));
            LogHelper.log('[HEADER] isInternalSupportRule →', value);
            try {
              const jwt = localStorage.getItem('jwt_token');
              const customerId = window.MyIOOrchestrator?.customerTB_ID;
              const tbBase = self.ctx?.settings?.tbBaseUrl || '';
              if (jwt && customerId) {
                await fetch(`${tbBase}/api/plugins/telemetry/CUSTOMER/${customerId}/attributes/SERVER_SCOPE`, {
                  method: 'POST',
                  headers: {
                    'X-Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ isInternalSupportRule: value }),
                });
              }
            } catch (err) {
              LogHelper.warn('[HEADER] Failed to save isInternalSupportRule:', err);
            }
          });
        }
      },

      _setupDrag(container) {
        const handle = container.querySelector('[data-drag-handle]');
        if (!handle) return;
        const onDown = (e) => {
          if (e.target.closest('[data-action]')) return; // don't drag when clicking buttons
          this._isDragging = true;
          const rect = container.getBoundingClientRect();
          this._dragOffset.x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
          this._dragOffset.y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
          container.classList.add('dragging');
          this._isPinned = true;
          container.classList.add('pinned');
          container.querySelector('[data-action="pin"]')?.classList.add('pinned');
        };
        const onMove = (e) => {
          if (!this._isDragging) return;
          const cx = e.clientX || e.touches?.[0]?.clientX;
          const cy = e.clientY || e.touches?.[0]?.clientY;
          container.style.left = `${cx - this._dragOffset.x}px`;
          container.style.top  = `${cy - this._dragOffset.y}px`;
        };
        const onUp = () => {
          this._isDragging = false;
          container.classList.remove('dragging');
        };
        handle.addEventListener('mousedown', onDown);
        handle.addEventListener('touchstart', onDown, { passive: true });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend',  onUp);
      },
    };

    // ── RFC-0198: Ticket Notification Tooltip ────────────────────────────────

    const TICKET_NOTIF_CSS = `
.tnt-tooltip {
  position: fixed; z-index: 99999;
  pointer-events: none; opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: translateY(8px);
}
.tnt-tooltip.visible  { opacity: 1; transform: translateY(0); pointer-events: auto; }
.tnt-tooltip.closing  { opacity: 0; transform: translateY(8px); transition: opacity 0.4s ease, transform 0.4s ease; pointer-events: none; }
.tnt-tooltip.dragging { transition: none !important; cursor: move; }
.tnt-tooltip.pinned   { box-shadow: 0 0 0 2px #0891b2, 0 10px 40px rgba(0,0,0,0.2); }
.tnt-tooltip.maximized {
  top: 16px !important; left: 16px !important;
  right: 16px !important; bottom: 16px !important;
  width: auto !important; max-width: none !important;
}
.tnt-tooltip.maximized .tnt-content { width: 100%; height: 100%; max-width: none; max-height: none; display: flex; flex-direction: column; }
.tnt-tooltip.maximized .tnt-body    { flex: 1; overflow-y: auto; min-height: 0; }
.tnt-tooltip.maximized .tnt-header-title { font-size: 16px; }
.tnt-tooltip.maximized .tnt-summary-card-num { font-size: 32px; }
.tnt-tooltip.maximized .tnt-section-hdr { font-size: 13px; }
.tnt-tooltip.maximized .tnt-ticket-subject { font-size: 13px; }
.tnt-tooltip.maximized .tnt-footer-value { font-size: 20px; }
.tnt-content {
  background: #fff; border: 1px solid #a5f3fc; border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15), 0 2px 10px rgba(0,0,0,0.08);
  width: 420px; max-width: 95vw; max-height: 80vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px; color: #1e293b; overflow: hidden; display: flex; flex-direction: column;
}
.tnt-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: linear-gradient(90deg, #ecfeff 0%, #cffafe 100%);
  border-bottom: 1px solid #67e8f9; border-radius: 12px 12px 0 0;
  cursor: move; user-select: none;
}
.tnt-header-icon  { display: flex; align-items: center; color: #0891b2; }
.tnt-header-icon svg { width: 18px; height: 18px; }
.tnt-header-title { font-weight: 700; font-size: 14px; color: #0e7490; flex: 1; }
.tnt-header-ts    { font-size: 10px; color: #6b7280; margin-right: 8px; }
.tnt-header-actions { display: flex; align-items: center; gap: 4px; }
.tnt-hbtn {
  width: 24px; height: 24px; border: none; background: rgba(255,255,255,0.6);
  border-radius: 4px; cursor: pointer; display: flex; align-items: center;
  justify-content: center; transition: all 0.15s; color: #64748b;
}
.tnt-hbtn:hover { background: rgba(255,255,255,0.9); color: #1e293b; }
.tnt-hbtn.pinned { background: #0891b2; color: #fff; }
.tnt-hbtn.pinned:hover { background: #0e7490; color: #fff; }
.tnt-hbtn svg { width: 14px; height: 14px; }
.tnt-body { padding: 14px; overflow-y: auto; flex: 1; min-height: 0; }
.tnt-summary-primary { display: flex; gap: 8px; margin-bottom: 12px; }
.tnt-summary-card {
  flex: 1; text-align: center; padding: 10px 6px; border-radius: 10px; border: 1px solid #e0eceb;
}
.tnt-summary-card.open    { background: #fff5f5; border-color: #fca5a5; }
.tnt-summary-card.pending { background: #fffbeb; border-color: #fcd34d; }
.tnt-summary-card.waiting { background: #f5f3ff; border-color: #c4b5fd; }
.tnt-summary-card-num { font-size: 26px; font-weight: 800; line-height: 1; }
.tnt-summary-card.open    .tnt-summary-card-num { color: #dc2626; }
.tnt-summary-card.pending .tnt-summary-card-num { color: #d97706; }
.tnt-summary-card.waiting .tnt-summary-card-num { color: #7c3aed; }
.tnt-summary-card-lbl { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 3px; }
.tnt-section-hdr {
  font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;
  letter-spacing: 0.5px; margin: 12px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0;
}
.tnt-breakdown { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.tnt-breakdown-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 5px 10px; border-radius: 6px; background: #ecfeff; border: 1px solid #a5f3fc;
}
.tnt-breakdown-id    { font-size: 11px; font-weight: 600; color: #0e7490; }
.tnt-breakdown-count { font-size: 11px; font-weight: 700; color: #0891b2; }
.tnt-collapse summary {
  font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;
  letter-spacing: 0.5px; padding: 6px 0; border-bottom: 1px solid #e2e8f0;
  cursor: pointer; list-style: none; display: flex; align-items: center; gap: 4px;
}
.tnt-collapse summary::-webkit-details-marker { display: none; }
.tnt-collapse summary::before { content: "▶"; font-size: 8px; }
.tnt-collapse[open] summary::before { content: "▼"; }
.tnt-collapse-body { padding-top: 6px; }
.tnt-ticket-list   { display: flex; flex-direction: column; gap: 4px; }
.tnt-ticket-row {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 7px 8px; border-radius: 6px; background: #fafafa; border: 1px solid #f3f4f6;
}
.tnt-ticket-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }
.tnt-ticket-info    { flex: 1; min-width: 0; }
.tnt-ticket-device  { font-size: 10px; font-weight: 700; color: #0891b2; }
.tnt-ticket-subject { font-size: 11px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tnt-ticket-meta   { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.tnt-ticket-status { font-size: 10px; font-weight: 600; }
.tnt-ticket-time   { font-size: 10px; color: #94a3b8; }
.tnt-empty { text-align: center; padding: 20px; color: #94a3b8; font-style: italic; font-size: 13px; }
.tnt-locked { padding: 24px; text-align: center; }
.tnt-locked-icon  { font-size: 40px; margin-bottom: 10px; }
.tnt-locked-title { font-size: 13px; font-weight: 700; color: #0e7490; margin-bottom: 6px; }
.tnt-locked-sub   { font-size: 11px; color: #64748b; line-height: 1.5; }
.tnt-footer {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  border-top: 1px solid #e2e8f0; background: #fafafa;
  border-radius: 0 0 12px 12px; flex-shrink: 0;
}
.tnt-footer-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
.tnt-footer-value { font-size: 18px; font-weight: 800; color: #0891b2; margin-left: 4px; }
.tnt-footer-btn {
  margin-left: auto; display: flex; align-items: center; gap: 5px;
  padding: 5px 10px; background: #ecfeff; border: 1px solid #a5f3fc;
  border-radius: 6px; font-size: 11px; font-weight: 600; color: #0e7490;
  cursor: pointer; transition: background 0.15s;
}
.tnt-footer-btn:hover { background: #cffafe; }
`;

    let _tntCSSInjected = false;
    function _tntInjectCSS() {
      if (_tntCSSInjected || document.getElementById('myio-tnt-styles')) { _tntCSSInjected = true; return; }
      const s = document.createElement('style');
      s.id = 'myio-tnt-styles';
      s.textContent = TICKET_NOTIF_CSS;
      document.head.appendChild(s);
      _tntCSSInjected = true;
    }

    function _tntFmtTs(iso) {
      if (!iso) return '';
      try {
        const d   = new Date(iso);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        if (isToday) return time;
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + time;
      } catch { return ''; }
    }

    const TicketNotificationTooltip = {
      containerId: 'myio-tnt-tooltip',
      _hideTimer:  null,
      _isMouseOver: false,
      _isPinned:   false,
      _isMaximized: false,
      _isDragging: false,
      _dragOffset: { x: 0, y: 0 },

      getContainer() {
        _tntInjectCSS();
        let c = document.getElementById(this.containerId);
        if (!c) {
          c = document.createElement('div');
          c.id = this.containerId;
          c.className = 'tnt-tooltip';
          document.body.appendChild(c);
        }
        return c;
      },

      renderHTML() {
        const tso    = window.TicketServiceOrchestrator;
        const domain = window.MyIOUtils?.freshdeskDomain || 'myiocom.freshdesk.com';

        if (!tso) {
          return `
            <div class="tnt-content">
              <div class="tnt-header" data-drag-handle>
                <span class="tnt-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg></span>
                <span class="tnt-header-title">Chamados</span>
                <div class="tnt-header-actions">
                  <button class="tnt-hbtn" data-action="close" title="Fechar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="tnt-locked">
                <div class="tnt-locked-icon">🔒</div>
                <div class="tnt-locked-title">FreshDesk não configurado</div>
                <div class="tnt-locked-sub">Configure a chave de API FreshDesk nas configurações do widget para ativar o painel de chamados.</div>
              </div>
            </div>`;
        }

        const allTickets = tso.tickets || [];
        const byStatus   = { 2: 0, 3: 0, 6: 0 };
        for (const t of allTickets) { if (t.status in byStatus) byStatus[t.status]++; }

        const deviceMap     = tso.deviceTicketMap || new Map();
        const deviceEntries = [...deviceMap.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 6);

        const recentTickets = [...allTickets]
          .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
          .slice(0, 10);

        const statusColors = { 2: '#dc2626', 3: '#d97706', 6: '#7c3aed' };
        const statusLabels = { 2: 'Aberto',  3: 'Pendente', 6: 'Aguardando' };

        const deviceRows = deviceEntries.map(([id, tickets]) => `
          <div class="tnt-breakdown-item">
            <div class="tnt-breakdown-id">${id}</div>
            <div class="tnt-breakdown-count">${tickets.length} chamado${tickets.length !== 1 ? 's' : ''}</div>
          </div>`).join('');

        const ticketRows = recentTickets.map((t) => {
          const color   = statusColors[t.status] || '#6b7280';
          const label   = statusLabels[t.status] || String(t.status);
          const device  = t.custom_fields?.cf_device_identifier || '';
          const subj    = (t.subject || `#${t.id}`);
          const subject = subj.length > 48 ? subj.slice(0, 46) + '…' : subj;
          const ts      = _tntFmtTs(t.updated_at);
          return `
            <div class="tnt-ticket-row" data-ticket-id="${t.id}" style="cursor:pointer;" title="Ver detalhes">
              <div class="tnt-ticket-dot" style="background:${color}"></div>
              <div class="tnt-ticket-info">
                ${device ? `<div class="tnt-ticket-device">${device}</div>` : ''}
                <div class="tnt-ticket-subject">${subject}</div>
              </div>
              <div class="tnt-ticket-meta">
                <span class="tnt-ticket-status" style="color:${color}">${label}</span>
                ${ts ? `<span class="tnt-ticket-time">${ts}</span>` : ''}
              </div>
            </div>`;
        }).join('');

        const deviceSection = deviceEntries.length > 0 ? `
          <div class="tnt-section-hdr">Dispositivos com chamados</div>
          <div class="tnt-breakdown">${deviceRows}</div>` : '';

        const ticketsSection = recentTickets.length > 0
          ? `<details class="tnt-collapse" open>
               <summary>Chamados recentes (${recentTickets.length})</summary>
               <div class="tnt-collapse-body">
                 <div class="tnt-ticket-list">${ticketRows}</div>
               </div>
             </details>`
          : `<div class="tnt-empty">Nenhum chamado aberto no momento.</div>`;

        return `
          <div class="tnt-content">
            <div class="tnt-header" data-drag-handle>
              <span class="tnt-header-icon">🎫</span>
              <span class="tnt-header-title">Chamados</span>
              <span class="tnt-header-ts">${_antFmtNow()}</span>
              <div class="tnt-header-actions">
                <button class="tnt-hbtn" data-action="maximize" title="Expandir">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <polyline points="9 21 3 21 3 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/>
                    <line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                </button>
                <button class="tnt-hbtn" data-action="pin" title="Fixar na tela">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
                    <line x1="12" y1="16" x2="12" y2="21"/>
                    <line x1="8" y1="4" x2="16" y2="4"/>
                  </svg>
                </button>
                <button class="tnt-hbtn" data-action="close" title="Fechar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="tnt-body">
              <div class="tnt-summary-primary">
                <div class="tnt-summary-card open">
                  <div class="tnt-summary-card-num">${byStatus[2]}</div>
                  <div class="tnt-summary-card-lbl">Abertos</div>
                </div>
                <div class="tnt-summary-card pending">
                  <div class="tnt-summary-card-num">${byStatus[3]}</div>
                  <div class="tnt-summary-card-lbl">Pendentes</div>
                </div>
                <div class="tnt-summary-card waiting">
                  <div class="tnt-summary-card-num">${byStatus[6]}</div>
                  <div class="tnt-summary-card-lbl">Aguardando</div>
                </div>
              </div>
              ${deviceSection}
              ${ticketsSection}
            </div>
            <div class="tnt-footer">
              <span class="tnt-footer-label">Total</span>
              <span class="tnt-footer-value">${allTickets.length}</span>
              <button class="tnt-footer-btn" data-action="open-freshdesk">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Novo Chamado
              </button>
            </div>
          </div>`;
      },

      show(triggerElement) {
        if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
        const container = this.getContainer();
        container.innerHTML = this.renderHTML();
        this._bindEvents(container);
        this._setupDrag(container);
        container.classList.remove('closing');
        setTimeout(() => {
          if (!this._isPinned) this._position(triggerElement);
          container.classList.add('visible');
        }, 0);
        container.addEventListener('mouseenter', () => {
          this._isMouseOver = true;
          if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
        });
        container.addEventListener('mouseleave', () => {
          this._isMouseOver = false;
          if (!this._isPinned) this.hide();
        });
      },

      _position(triggerElement) {
        const container = document.getElementById(this.containerId);
        if (!container || !triggerElement) return;
        const rect = triggerElement.getBoundingClientRect();
        const vw   = window.innerWidth;
        const vh   = window.innerHeight;
        container.style.position = 'fixed';
        container.style.removeProperty('right');
        container.style.removeProperty('bottom');
        const cw  = container.offsetWidth || 420;
        let top   = rect.bottom + 8;
        let left  = rect.right - cw;
        if (left + cw > vw - 8) left = vw - cw - 8;
        if (left < 8) left = 8;
        if (top + 480 > vh) top = rect.top - 488;
        if (top < 8) top = 8;
        container.style.top  = `${top}px`;
        container.style.left = `${left}px`;
      },

      _bindEvents(container) {
        container.querySelector('[data-action="maximize"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._isMaximized = !this._isMaximized;
          container.classList.toggle('maximized', this._isMaximized);
          if (this._isMaximized) {
            this._isPinned = true;
            container.classList.add('pinned');
          }
        });
        container.querySelector('[data-action="pin"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._isPinned = !this._isPinned;
          container.classList.toggle('pinned', this._isPinned);
          e.currentTarget.classList.toggle('pinned', this._isPinned);
        });
        container.querySelector('[data-action="close"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._isPinned = false;
          this._isMaximized = false;
          this.hide(true);
        });
        container.querySelector('[data-action="open-freshdesk"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          _openNewTicketWizard();
        });
        // Click on a ticket row → open TicketDetailModal
        container.querySelectorAll('.tnt-ticket-row[data-ticket-id]').forEach((row) => {
          row.addEventListener('click', (e) => {
            e.stopPropagation();
            const ticketId = parseInt(row.getAttribute('data-ticket-id'), 10);
            const tso = window.TicketServiceOrchestrator;
            const ticket = tso?.tickets?.find(t => t.id === ticketId);
            if (!ticket) return;
            _openTicketDetail(ticket);
          });
        });
      },

      _setupDrag(container) {
        const handle = container.querySelector('[data-drag-handle]');
        if (!handle) return;
        const onDown = (e) => {
          if (e.target.closest('[data-action]')) return;
          this._isDragging = true;
          const rect = container.getBoundingClientRect();
          this._dragOffset.x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
          this._dragOffset.y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
          container.classList.add('dragging');
          this._isPinned = true;
          container.classList.add('pinned');
          container.querySelector('[data-action="pin"]')?.classList.add('pinned');
        };
        const onMove = (e) => {
          if (!this._isDragging) return;
          const cx = e.clientX || e.touches?.[0]?.clientX;
          const cy = e.clientY || e.touches?.[0]?.clientY;
          container.style.left = `${cx - this._dragOffset.x}px`;
          container.style.top  = `${cy - this._dragOffset.y}px`;
        };
        const onUp = () => {
          this._isDragging = false;
          container.classList.remove('dragging');
        };
        handle.addEventListener('mousedown', onDown);
        handle.addEventListener('touchstart', onDown, { passive: true });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend',  onUp);
      },

      hide(immediate) {
        if (this._isPinned && !immediate) return;
        if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
        this._hideTimer = setTimeout(() => {
          const container = document.getElementById(this.containerId);
          if (!container) return;
          container.classList.add('closing');
          container.classList.remove('visible');
          this._hideTimer = null;
        }, immediate ? 0 : 300);
      },
    };

    // RFC-0198: Wire up the ticket / chamados button
    const btnTicketNotif = document.getElementById('tbx-btn-ticket-notif');

    /**
     * Inject the FreshWorks Widget script once and hide their default launcher.
     * After load, `window.FreshworksWidget('open')` opens the widget programmatically.
     */
    function _initFreshworksWidget(widgetId) {
      if (!widgetId) return;
      if (document.getElementById('freshworks-widget-script')) return; // already injected

      // Stub required before the script loads (matches FreshWorks boilerplate)
      window.fwSettings = { widget_id: Number(widgetId) };
      if (typeof window.FreshworksWidget !== 'function') {
        const n = function() { n.q.push(arguments); };
        n.q = [];
        window.FreshworksWidget = n;
      }

      const script = document.createElement('script');
      script.id   = 'freshworks-widget-script';
      script.type = 'text/javascript';
      script.src  = `https://widget.freshworks.com/widgets/${widgetId}.js`;
      script.async = true;
      script.defer = true;
      // Hide their floating launcher — we open the widget via our own button
      script.onload = () => {
        if (typeof window.FreshworksWidget === 'function') {
          window.FreshworksWidget('hide', 'launcher');
        }
      };
      document.head.appendChild(script);
      LogHelper.log('[HEADER] RFC-0198: FreshWorks Widget script injected, widget_id:', widgetId);
    }

    /** Open the FreshWorks Widget. No-op if widget not yet loaded. */
    function _openFreshworksWidget() {
      if (typeof window.FreshworksWidget === 'function') {
        window.FreshworksWidget('open');
      } else {
        console.warn('[MYIO] FreshworksWidget not loaded yet.');
      }
    }

    /**
     * RFC-0198 Phase 7: NewTicketWizard — lazy singleton.
     * Returns the wizard instance (creates on first call).
     */
    let _ticketWizard = null;
    function _getTicketWizard() {
      if (_ticketWizard) return _ticketWizard;
      const Lib = window.MyIOLibrary;
      if (!Lib?.createNewTicketWizard) return null;
      _ticketWizard = Lib.createNewTicketWizard({
        freshdeskDomain:  window.MyIOUtils?.freshdeskDomain   || 'myiocom.freshdesk.com',
        freshdeskApiKey:  window.MyIOUtils?.freshdeskApiKey   || '',
        requesterEmail:   window.MyIOUtils?.freshdeskRequesterEmail || '',
        getDevices: () => {
          const data = window.MyIOOrchestratorData || {};
          const toW = (d, domain) => ({
            identifier:    d.identifier    || '',
            label:         d.label         || d.identifier || '',
            domain,
            deviceProfile: d.deviceProfile || d.deviceType  || '',
          });
          return [
            ...(data.energy?.items      || []).map(d => toW(d, 'energy')),
            ...(data.water?.items       || []).map(d => toW(d, 'water')),
            ...(data.temperature?.items || []).map(d => toW(d, 'temperature')),
          ];
        },
      });
      return _ticketWizard;
    }

    /** Opens the NewTicketWizard; falls back to FreshWorks Widget if library not loaded. */
    function _openNewTicketWizard() {
      const wizard = _getTicketWizard();
      if (wizard) {
        TicketNotificationTooltip.hide(true);
        wizard.open();
      } else {
        _openFreshworksWidget();
      }
    }

    /**
     * RFC-0198: Open TicketDetailModal for a specific ticket.
     * Each click creates a fresh modal instance (no singleton — multiple tickets can be viewed).
     */
    function _openTicketDetail(ticket) {
      const Lib = window.MyIOLibrary;
      if (!Lib?.createTicketDetailModal) {
        console.warn('[HEADER] createTicketDetailModal not found in MyIOLibrary');
        return;
      }
      const modal = Lib.createTicketDetailModal({
        freshdeskDomain: window.MyIOUtils?.freshdeskDomain  || 'myiocom.freshdesk.com',
        freshdeskApiKey: window.MyIOUtils?.freshdeskApiKey  || '',
        ticket,
        onTicketCancelled: () => {
          // Refresh TSO so badge counts update
          window.TicketServiceOrchestrator?.refresh?.();
        },
        onNoteAdded: () => {
          window.TicketServiceOrchestrator?.refresh?.();
        },
      });
      modal.open();
    }

    // Setup ticket button: show + bind events. Idempotent via data-bound guard.
    function _setupTicketButton() {
      const apiKey   = window.MyIOUtils?.freshdeskApiKey   || '';
      const widgetId = window.MyIOUtils?.freshdeskWidgetId || '';
      if (!apiKey || window.MyIOUtils?.ticketsEnabled !== true || !btnTicketNotif) return;

      btnTicketNotif.style.display = '';

      // Bind events only once
      if (!btnTicketNotif.dataset.bound) {
        btnTicketNotif.dataset.bound = '1';
        _initFreshworksWidget(widgetId);
        btnTicketNotif.addEventListener('click', () => _openNewTicketWizard());
        btnTicketNotif.addEventListener('mouseenter', () => {
          TicketNotificationTooltip.show(btnTicketNotif);
        });
        btnTicketNotif.addEventListener('mouseleave', () => {
          if (!TicketNotificationTooltip._isMouseOver && !TicketNotificationTooltip._isPinned) {
            TicketNotificationTooltip.hide();
          }
        });
      }
    }
    // Fast path: already enabled at init time (e.g. cached from previous onDataUpdated)
    _setupTicketButton();

    function _updateTicketNotifBadge(count) {
      const badge = document.getElementById('tbx-ticket-notif-badge');
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }

    // Listen for tickets-ready (fired by TicketServiceOrchestrator after prefetch)
    window.addEventListener('myio:tickets-ready', (e) => {
      const ticketMap = e.detail?.ticketMap;
      if (!ticketMap) return;
      let total = 0;
      ticketMap.forEach((tickets) => { total += tickets.length; });
      _updateTicketNotifBadge(total);
      // Show button now that FreshDesk data is available
      if (total > 0 && btnTicketNotif) btnTicketNotif.style.display = '';
    });

    // React to tickets gate changes (tickets_only_to_myio evaluated after user email is known)
    window.addEventListener('myio:tickets-gate-changed', (e) => {
      if (!btnTicketNotif) return;
      const enabled = e.detail?.ticketsEnabled === true;
      if (!enabled) {
        btnTicketNotif.style.display = 'none';
      } else {
        // Run full setup (idempotent — data-bound guard prevents duplicate event listeners)
        _setupTicketButton();
      }
    });

    // Seed badge if TicketServiceOrchestrator already built before this listener registered
    const _tso = window.TicketServiceOrchestrator;
    if (_tso) {
      let _seedTotal = 0;
      _tso.deviceTicketMap?.forEach((t) => { _seedTotal += t.length; });
      if (_seedTotal > 0) _updateTicketNotifBadge(_seedTotal);
    }

    // Inject active-state style for alarm filter button
    if (!document.getElementById('myio-alarm-filter-btn-style')) {
      const _s = document.createElement('style');
      _s.id = 'myio-alarm-filter-btn-style';
      _s.textContent = [
        '.tbx-btn-alarm-notif.alarm-filter-active{background:#fff3e0!important;border:1px solid #fb8c00!important;color:#e65100!important;box-shadow:0 0 0 2px #fb8c0044}',
        '.tbx-btn-alarm-notif.alarm-filter-active .tbx-ico{filter:none}',
      ].join('');
      document.head.appendChild(_s);
    }

    // Wire up the bell button: hover (tooltip) + click (global alarm filter)
    let _alarmFilterActive = false;
    const btnAlarmNotif = document.getElementById('tbx-btn-alarm-notif');
    if (btnAlarmNotif) {
      btnAlarmNotif.addEventListener('mouseenter', () => {
        AlarmNotificationTooltip.show(btnAlarmNotif);
      });
      btnAlarmNotif.addEventListener('mouseleave', () => {
        if (!AlarmNotificationTooltip._isMouseOver && !AlarmNotificationTooltip._isPinned) {
          AlarmNotificationTooltip.hide();
        }
      });
      btnAlarmNotif.addEventListener('click', () => {
        // Only activate filter if there are visible alarms (respects showOfflineAlarms flag).
        // If deactivating (_alarmFilterActive already true), always allow.
        if (!_alarmFilterActive) {
          if (!window.MyIOOrchestrator?.alarmsConfigured) return;
          const visibleCount = _countVisible(window.MyIOOrchestrator?.customerAlarms || []);
          if (visibleCount === 0) {
            LogHelper.log('[HEADER] alarm filter suppressed — no visible alarms (showOfflineAlarms=false or no alarms)');
            return;
          }
        }
        _alarmFilterActive = !_alarmFilterActive;
        btnAlarmNotif.classList.toggle('alarm-filter-active', _alarmFilterActive);
        const mode = _alarmFilterActive ? 'apenas_ativados' : 'ativado';
        window.dispatchEvent(new CustomEvent('myio:global-alarm-filter', { detail: { mode } }));
        LogHelper.log('[HEADER] global alarm filter →', mode);
      });
    }

    // Reverse: TELEMETRY changed filter manually → sync header button state
    window.addEventListener('myio:telemetry-alarm-filter-changed', (ev) => {
      const mode = ev.detail?.mode || 'ativado';
      _alarmFilterActive = mode === 'apenas_ativados';
      if (btnAlarmNotif) btnAlarmNotif.classList.toggle('alarm-filter-active', _alarmFilterActive);
    });

    // Update alarm badge count on every alarms-updated event
    let _lastAlarmList = [];
    function _countVisible(alarms) {
      const showOffline = window.MyIOOrchestrator?.showOfflineAlarms === true;
      return showOffline ? alarms.length : alarms.filter((a) => !_isOfflineAlarm(a)).length;
    }
    function _updateAlarmNotifBadge(count) {
      const badge = document.getElementById('tbx-alarm-notif-badge');
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
    window.addEventListener('myio:alarms-updated', (e) => {
      _lastAlarmList = e.detail?.alarms || [];
      _updateAlarmNotifBadge(_countVisible(_lastAlarmList));
    });
    // Re-compute badge when offline toggle changes
    window.addEventListener('myio:offline-alarms-toggle', () => {
      _updateAlarmNotifBadge(_countVisible(_lastAlarmList));
    });
    // Seed badge if myio:alarms-updated already fired before this listener was registered
    const _cachedAlarms = window.MyIOOrchestrator?.customerAlarms || [];
    _lastAlarmList = _cachedAlarms;
    if (_cachedAlarms.length > 0) _updateAlarmNotifBadge(_countVisible(_cachedAlarms));

    // ─────────────────────────────────────────────────────────────────────────
    // RFC-0045 FIX: Track last emission to prevent duplicates
    let lastEmission = {};

    // RFC-0042: Helper function to emit period to all contexts
    // RFC-0053: Simplified event emission (no iframes!)
    function emitToAllContexts(eventName, detail) {
      // RFC-0045 FIX: Prevent duplicate emissions within 200ms
      const now = Date.now();
      const key = `${eventName}:${JSON.stringify(detail)}`;

      if (lastEmission[key] && now - lastEmission[key] < 200) {
        LogHelper.warn(
          `[HEADER] ⏭️ Skipping duplicate ${eventName} emission (${now - lastEmission[key]}ms ago)`
        );
        return;
      }

      lastEmission[key] = now;

      // RFC-0053: Single window context - all widgets in same window
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
      LogHelper.log(`[HEADER] ✅ RFC-0053: Emitted ${eventName} (single context)`);
    }

    btnLoad?.addEventListener('click', () => {
      LogHelper.log('[HEADER] 🔄 Carregar button clicked');
      LogHelper.log(
        `[HEADER] 🔍 currentDomain value: ${currentDomain.value} (type: ${typeof currentDomain.value})`
      );

      // RFC-0054: Validate current domain
      const MyIOToast = window.MyIOLibrary?.MyIOToast;
      if (!currentDomain.value) {
        LogHelper.warn('[HEADER] ⚠️ currentDomain is null - attempting to auto-select energy');

        // Try to auto-select energy domain before showing error
        try {
          // Set domain directly
          currentDomain.value = 'energy';

          // Dispatch event to notify other widgets
          window.dispatchEvent(
            new CustomEvent('myio:dashboard-state', {
              detail: { tab: 'energy' },
            })
          );

          LogHelper.log('[HEADER] ✅ Auto-selected energy domain');

          // If still null after setting (edge case), show error
          if (!currentDomain.value) {
            throw new Error('Failed to set domain');
          }
        } catch (err) {
          LogHelper.error('[HEADER] ❌ Cannot load - failed to auto-select domain:', err);
          if (MyIOToast) {
            MyIOToast.error('Erro: Domínio atual não definido. Por favor, selecione uma aba no menu.', 5000);
          }
          return;
        }
      }

      // RFC-0178: Alarm domain — emit alarm filter change event
      if (currentDomain.value === 'alarm') {
        const filters = self.getFilters();
        LogHelper.log('[HEADER] RFC-0178: Emitting myio:alarm-filter-change:', filters);
        window.dispatchEvent(new CustomEvent('myio:alarm-filter-change', {
          detail: {
            from: filters.startAt,  // ISO 8601
            to:   filters.endAt,    // ISO 8601
          },
        }));
        return;
      }

      if (currentDomain.value !== 'energy' && currentDomain.value !== 'water') {
        LogHelper.warn(`[HEADER] ⚠️ Cannot load - domain ${currentDomain.value} not supported`);
        if (MyIOToast) {
          MyIOToast.warning(`Domínio "${currentDomain.value}" não suporta carregamento de dados.`, 5000);
        }
        return;
      }

      // RFC-0042: Standardized period emission
      const startISO = toISO(self.ctx.$scope.startTs || inputStart.value + 'T00:00:00', 'America/Sao_Paulo');
      const endISO = toISO(self.ctx.$scope.endTs || inputEnd.value + 'T23:59:00', 'America/Sao_Paulo');

      const period = {
        startISO,
        endISO,
        granularity: calcGranularity(startISO, endISO),
        tz: 'America/Sao_Paulo',
      };

      LogHelper.log('[HEADER] Emitting standardized period:', period);

      // RFC-0130: Show busy overlay when loading data
      // RFC-0137: Use force=true to bypass cooldown when user explicitly clicks "Carregar"
      try {
        const orchestrator = window.MyIOOrchestrator;
        if (orchestrator?.showGlobalBusy) {
          orchestrator.showGlobalBusy(currentDomain.value, 'Carregando dados...', 25000, { force: true });
          LogHelper.log(`[HEADER] RFC-0137: Showing busy overlay for ${currentDomain.value} (force=true)`);
        }
      } catch (busyErr) {
        LogHelper.warn('[HEADER] Failed to show busy overlay:', busyErr);
      }

      // RFC-0130: Invalidate orchestrator cache before fetching new data
      // This ensures that when date range changes, fresh data is always fetched
      try {
        const orchestrator = window.MyIOOrchestrator;
        if (orchestrator) {
          // Clear inFlight cache to force new requests
          if (orchestrator.getSharedWidgetState) {
            const state = orchestrator.getSharedWidgetState();
            if (state && state.lastProcessedPeriodKey) {
              state.lastProcessedPeriodKey = null;
              LogHelper.log('[HEADER] 🔄 RFC-0130: Cleared lastProcessedPeriodKey');
            }
          }

          // Clear MyIOOrchestratorData cache for current domain
          if (window.MyIOOrchestratorData && window.MyIOOrchestratorData[currentDomain.value]) {
            delete window.MyIOOrchestratorData[currentDomain.value];
            LogHelper.log(
              `[HEADER] 🔄 RFC-0130: Cleared MyIOOrchestratorData cache for ${currentDomain.value}`
            );
          }
        }
      } catch (cacheErr) {
        LogHelper.warn('[HEADER] ⚠️ RFC-0130: Error clearing cache:', cacheErr);
      }

      // Emit standardized event to all contexts (use shared function)
      emitToAllContexts('myio:update-date', { period });

      // Store period globally for retry mechanism
      window.__myioInitialPeriod = period;

      // Backward compatibility: also emit old format
      emitToAllContexts('myio:update-date-legacy', { startDate: startISO, endDate: endISO });
    });

    // RFC-0042: Force Refresh button - clears all cache and reloads data
    btnForceRefresh?.addEventListener('click', (event) => {
      LogHelper.log('[HEADER] 🔄 Force Refresh clicked');

      // Check if this is a programmatic click (from TELEMETRY timeout) or user click
      const isProgrammatic = event.isTrusted === false;

      if (!isProgrammatic) {
        // Only show confirmation for manual user clicks
        const confirmed = window.confirm('Isso vai limpar todo o cache e recarregar os dados. Continuar?');
        if (!confirmed) {
          LogHelper.log('[HEADER] Force Refresh cancelled by user');
          return;
        }
      } else {
        LogHelper.log('[HEADER] Force Refresh triggered programmatically (auto-recovery)');
      }

      try {
        // RFC-0047: Enhanced cache clearing with TB_ID support
        // Cache keys format: myio:cache:TB_ID:domain:startISO:endISO:granularity
        // RFC-0091: Use shared customerTB_ID from MAIN widget via window.MyIOUtils
        const customerTbId = window.MyIOUtils?.customerTB_ID || 'default';

        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;

          // RFC-0047: Match new cache key format with TB_ID
          const energyPrefix = `myio:cache:${customerTbId}:energy:`;
          const waterPrefix = `myio:cache:${customerTbId}:water:`;

          if (key.startsWith(energyPrefix) || key.startsWith(waterPrefix)) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach((key) => {
          localStorage.removeItem(key);
          LogHelper.log(`[HEADER] 🗑️ Removed localStorage key: ${key}`);
        });

        LogHelper.log(`[HEADER] ✅ LocalStorage cache cleared (${keysToRemove.length} keys removed)`);

        // Invalidate orchestrator cache if available
        if (window.MyIOOrchestrator && window.MyIOOrchestrator.invalidateCache) {
          window.MyIOOrchestrator.invalidateCache('energy');
          window.MyIOOrchestrator.invalidateCache('water');
          LogHelper.log('[HEADER] ✅ Orchestrator cache invalidated');
        }

        // IMPORTANT: Clear visual content of TELEMETRY widgets for current domain
        // RFC-0053: Single window context - no iframe emission needed
        const clearEvent = new CustomEvent('myio:telemetry:clear', {
          detail: { domain: currentDomain.value },
        });

        window.dispatchEvent(clearEvent);
        LogHelper.log(
          `[HEADER] ✅ RFC-0053: Emitted clear event for domain: ${currentDomain.value} (single context)`
        );

        LogHelper.log('[HEADER] 🔄 Force Refresh — cache cleared, triggering load...');

        // After clearing, automatically trigger load so the user doesn't need to click "Carregar".
        // Use a short delay to let the clear events propagate before fetching new data.
        setTimeout(() => {
          if (btnLoad && !btnLoad.disabled) {
            LogHelper.log('[HEADER] 🔄 Auto-triggering Carregar after Limpar');
            btnLoad.click();
          } else {
            // btnLoad disabled (unsupported domain) — just notify the user
            const MyIOToast = window.MyIOLibrary?.MyIOToast;
            if (MyIOToast && !isProgrammatic) {
              MyIOToast.success('Cache limpo com sucesso!', 3000);
            }
          }
        }, 150);

        LogHelper.log('[HEADER] 🔄 Force Refresh completed successfully');
      } catch (err) {
        LogHelper.error('[HEADER] ❌ Error during Force Refresh:', err);
        if (!isProgrammatic) {
          const MyIOToast = window.MyIOLibrary?.MyIOToast;
          if (MyIOToast) {
            MyIOToast.error('Erro ao limpar cache. Consulte o console para detalhes.', 5000);
          }
        }
      }
    });

    btnGen?.addEventListener('click', async () => {
      const p = payload();
      fireCE('tbx:report:general', p);
      emitTo(listeners.general, p);

      try {
        const ingestionAuthToken = await MyIOAuth.getToken();

        // RFC-0042: Use current domain to determine correct datasource and cache
        const domain = currentDomain.value;

        // Safety check: button should be disabled if domain is not supported
        if (!domain || (domain !== 'energy' && domain !== 'water')) {
          LogHelper.error(`[HEADER] Invalid domain: ${domain}. Button should be disabled.`);
          const MyIOToast = window.MyIOLibrary?.MyIOToast;
          if (MyIOToast) {
            MyIOToast.error('Domínio inválido. Por favor, selecione Energia ou Água no menu.', 5000);
          }
          return;
        }

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
        // - Alias "Lojas" (for energy)
        // - Alias "Todos Hidrometros" (for water)
        if (!itemsListTB || itemsListTB.length === 0) {
          LogHelper.log('[HEADER] self.ctx.datasources >>>', self.ctx.datasources);

          // Build items from ALL datasources (function unifies them)
          const allItems = MyIOLibrary.buildListItemsThingsboardByUniqueDatasource(
            self.ctx.datasources,
            self.ctx.data
          );
          LogHelper.log(`[HEADER] Built ${allItems.length} total items from all datasources`);

          // Determine which datasource alias to filter by based on domain
          const targetAliasName =
            domain === 'energy' ? 'Lojas' : domain === 'water' ? 'Todos Hidrometros Lojas' : null;

          if (!targetAliasName) {
            LogHelper.error(`[HEADER] No alias mapping for domain: ${domain}`);
            throw new Error(`Domain not supported: ${domain}`);
          }

          LogHelper.log(`[HEADER] Filtering items by aliasName: ${targetAliasName}`);

          console.log('[HEADER] self.ctx.datasources >>> ', self.ctx.datasources);

          // Filter items by matching datasource alias
          itemsListTB = allItems.filter((item) => {
            // Find which datasource this item belongs to
            const itemDatasource = self.ctx.datasources.find((ds) => {
              // Check if this datasource contains this item's ID
              return self.ctx.data.some((dataRow) => {
                const rowDatasourceEntityAliasId = dataRow?.datasource?.entityAliasId;
                const rowEntityId = dataRow?.datasource?.entityId?.id || dataRow?.datasource?.entityId;
                const dsEntityAliasId = ds?.entityAliasId;

                // Match by datasource entityAliasId and item ID
                return (
                  rowDatasourceEntityAliasId === dsEntityAliasId &&
                  (rowEntityId === item.id || dataRow?.data?.[0]?.[1] === item.id)
                );
              });
            });

            // Check if this datasource matches the target alias
            const matchesAlias = itemDatasource?.aliasName === targetAliasName;

            if (matchesAlias) {
              LogHelper.log(`[HEADER] Item ${item.label} matches alias ${targetAliasName}`);
            }

            return matchesAlias;
          });

          LogHelper.log(
            `[HEADER] Filtered to ${itemsListTB.length} items for domain ${domain} (alias: ${targetAliasName})`
          );

          if (itemsListTB.length === 0) {
            LogHelper.warn(
              `[HEADER] No items found for alias ${targetAliasName}. Available datasources:`,
              self.ctx.datasources.map((ds) => ({ name: ds.name, entityAliasId: ds.entityAliasId }))
            );
          }
        }

        MyIOLibrary.openDashboardPopupAllReport({
          customerId: INGESTION_ID,
          domain: domain, // ← NEW: pass domain ('energy' or 'water')
          debug: 0,
          api: {
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            dataApiBaseUrl: window.MyIOUtils?.getDataApiHost?.(),
            ingestionToken: ingestionAuthToken,
          },
          itemsList: itemsListTB,
          ui: { theme: 'light' },
        });
      } catch (err) {
        LogHelper.error('[HEADER] Failed to open All-Report modal:', err);
        const MyIOToast = window.MyIOLibrary?.MyIOToast;
        if (MyIOToast) {
          MyIOToast.error('Erro ao abrir relatório geral. Tente novamente.', 5000);
        }
      }
    });

    // Compat com actionsApi
    if (self.ctx.actionsApi && self.ctx.actionsApi.onCustomAction) {
      self.ctx.actionsApi.onCustomAction((act) => {
        if (act && act.action === 'load') btnLoad?.click();
      });
    }

    LogHelper.log('[tbx] DRP pronto:', self.getFilters());
  })();
};

self.onDataUpdated = function () {};
self.onResize = function () {};
self.onDestroy = function () {};
