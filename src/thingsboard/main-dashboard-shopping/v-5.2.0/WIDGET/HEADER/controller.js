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
// VERSION: 2025-10-23-v2
if (!window.__myioCurrentDomain) {
  window.__myioCurrentDomain = null;
  console.log('[HEADER] VERSION: 2025-10-23-v2 - Global currentDomain initialized');
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

  // Style the contract status container
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
    if (!contractState || !contractState.isLoaded) {
      contractStatusEl.style.display = 'none';
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

    // Show the container
    contractStatusEl.style.display = 'flex';

    LogHelper.log('[HEADER] Contract status updated:', {
      total: totalDevices,
      isValid: contractState.isValid,
    });
  }

  // Click handler to show ContractSummaryTooltip
  contractStatusEl.addEventListener('click', (event) => {
    event.stopPropagation();

    const ContractSummaryTooltip = window.MyIOLibrary?.ContractSummaryTooltip;
    if (!ContractSummaryTooltip) {
      LogHelper.warn('[HEADER] ContractSummaryTooltip not available in library');
      return;
    }

    // Build tooltip data from window.CONTRACT_STATE
    const contractState = window.CONTRACT_STATE;
    if (!contractState || !contractState.isLoaded) {
      LogHelper.warn('[HEADER] Contract state not loaded');
      return;
    }

    // Create tooltip instance and show
    const tooltip = new ContractSummaryTooltip();
    const data = tooltip.buildFromGlobalState();

    if (data) {
      tooltip.show(contractStatusEl, data);
      LogHelper.log('[HEADER] ContractSummaryTooltip shown');
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
  const q = (sel) => self.ctx.$container[0].querySelector(sel);

  // RFC-0091: Use shared DATA_API_HOST from MAIN widget via window.MyIOUtils
  const DATA_API_HOST = window.MyIOUtils?.DATA_API_HOST;
  if (!DATA_API_HOST) {
    console.error('[HEADER] DATA_API_HOST not available from window.MyIOUtils - MAIN widget must load first');
  }
  // RFC-0091: Use shared customerTB_ID from MAIN widget via window.MyIOUtils
  const CUSTOMER_ID = window.MyIOUtils?.customerTB_ID;
  if (!CUSTOMER_ID) {
    console.error('[HEADER] customerTB_ID not available from window.MyIOUtils - MAIN widget must load first');
  }
  const tbToken = localStorage.getItem('jwt_token');
  const customerCredentials = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(
    CUSTOMER_ID,
    tbToken
  );
  const CLIENT_ID = customerCredentials.client_id || ' ';
  const CLIENT_SECRET = customerCredentials.client_secret || ' ';
  const INGESTION_ID = customerCredentials.ingestionId || ' ';

  MyIOAuth = MyIOLibrary.buildMyioIngestionAuth({
    dataApiHost: DATA_API_HOST,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  });

  LogHelper.log('[MyIOAuth] Initialized with extracted component');

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
    onApply: function (result) {
      LogHelper.log('[DateRangePicker] Applied:', result);

      // Update internal dates for compatibility
      self.ctx.$scope.startTs = result.startISO;
      self.ctx.$scope.endTs = result.endISO;

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
      second: 0,
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
      const domainLabels = {
        energy: 'Relatório Consumo Geral de Energia por Loja',
        water: 'Relatório Consumo Geral de Água por Loja',
      };

      // Only energy and water are supported for all controls
      const isSupported = domain === 'energy' || domain === 'water';

      // Update report button text and state
      if (btnGen) {
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
      LogHelper.log(`[HEADER] Dashboard state changed to: ${tab} (previous: ${currentDomain.value})`);
      currentDomain.value = tab;
      LogHelper.log(`[HEADER] currentDomain is now: ${currentDomain.value}`);
      updateControlsState(tab);

      // RFC-0045 FIX: Emit initial period when domain is set for the first time
      // This ensures orchestrator has currentPeriod set immediately
      if (!hasEmittedInitialPeriod && (tab === 'energy' || tab === 'water')) {
        hasEmittedInitialPeriod = true;

        // Wait for dateRangePicker to be ready
        setTimeout(() => {
          if (self.__range.start && self.__range.end) {
            const startISO = toISO(self.__range.start.toDate(), 'America/Sao_Paulo');
            const endISO = toISO(self.__range.end.toDate(), 'America/Sao_Paulo');

            const initialPeriod = {
              startISO,
              endISO,
              granularity: calcGranularity(startISO, endISO),
              tz: 'America/Sao_Paulo',
            };

            LogHelper.log(`[HEADER] 🚀 Emitting initial period for domain ${tab}:`, initialPeriod);
            emitToAllContexts('myio:update-date', { period: initialPeriod });
          } else {
            LogHelper.warn(`[HEADER] ⚠️ Cannot emit initial period - dateRangePicker not ready yet`);
          }
        }, 300); // Small delay to ensure dateRangePicker is initialized
      }
    });

    // RFC-0096 FIX: Check if domain was already set before listener was registered (race condition fix)
    // MENU may fire myio:dashboard-state before HEADER's onInit completes
    if (currentDomain.value && (currentDomain.value === 'energy' || currentDomain.value === 'water')) {
      LogHelper.log(`[HEADER] 🔧 Race condition fix: Domain already set to ${currentDomain.value}, enabling controls`);
      updateControlsState(currentDomain.value);
    }

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

      // Emit standardized event to all contexts (use shared function)
      emitToAllContexts('myio:update-date', { period });

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

        // Show success message only for manual clicks
        if (!isProgrammatic) {
          const MyIOToast = window.MyIOLibrary?.MyIOToast;
          if (MyIOToast) {
            MyIOToast.success("Cache limpo com sucesso! Clique em 'Carregar' para buscar dados atualizados.", 5000);
          }
        }

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
            dataApiBaseUrl: DATA_API_HOST,
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
