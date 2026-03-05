/* global self, window, document, localStorage */

/**
 * RFC-0177: Alarm Widget — Single-Shopping ThingsBoard Widget
 *
 * Renders alarms scoped to a single shopping customer.
 * Uses:
 *   - MyIOLibrary.createAlarmsNotificationsPanelComponent  (RFC-0152 Phase 4)
 *   - MyIOLibrary.AlarmService  (RFC-0175)
 *   - MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage
 *
 * Does NOT make direct API calls.
 * Does NOT depend on MAIN_UNIQUE_DATASOURCE being co-loaded.
 */

/* eslint-disable no-undef, no-unused-vars */

// ============================================================================
// Maintenance mode flag — set to true to display maintenance overlay
// ============================================================================

const _MAINTENANCE_MODE = false;

// ============================================================================
// Module-level state (reset on every onInit)
// ============================================================================

let _panelInstance          = null;
let _refreshTimer           = null;
let _fetchDebounceTimer     = null;
let _customerIngId          = '';
let _gcdrTenantId           = ''; // RFC-0179: from TB SERVER_SCOPE attr gcdrTenantId
let _maxAlarms              = 100;
let _activeTab              = 'list';
let _isRefreshing           = false;
let _currentTheme           = 'light';
let _themeChangeHandler     = null;
let _filterChangeHandler    = null;
let _activationHandler      = null;
let _activeFilters          = {}; // { from?, to? }
let _closedAlarmsMode       = false; // true = fetch CLOSED alarms (history mode)
let _closedAlarmsHandler    = null;

let LogHelper = {
  log:   (...a) => {},
  warn:  (...a) => console.warn('[ALARM]', ...a),
  error: (...a) => console.error('[ALARM]', ...a),
};

// ============================================================================
// onInit
// ============================================================================

self.onInit = async function () {
  'use strict';

  // --- Reset state ---
  _panelInstance       = null;
  _refreshTimer        = null;
  clearTimeout(_fetchDebounceTimer);
  _fetchDebounceTimer  = null;
  _customerIngId       = '';
  _gcdrTenantId        = '';
  _isRefreshing        = false;
  _activeFilters       = {};
  _closedAlarmsMode    = false;

  // --- Library reference ---
  const MyIOLibrary = window.MyIOLibrary;
  if (!MyIOLibrary) {
    console.error('[ALARM] window.MyIOLibrary not found — widget cannot load');
    return;
  }

  // --- Settings ---
  const settings               = self.ctx.settings || {};
  const labelWidget            = settings.labelWidget            || 'Alarmes e Notificações';
  const customerTB_ID          = window.MyIOOrchestrator?.customerTB_ID || '';
  const defaultTab             = settings.defaultTab             || 'list';
  const showCustomerName       = settings.showCustomerName       ?? false;
  const refreshIntervalSeconds = settings.refreshIntervalSeconds ?? 180;
  const cacheIntervalSeconds   = settings.cacheIntervalSeconds   ?? 180;
  const enableDebugMode        = settings.enableDebugMode        ?? false;
  // API credentials: from MAIN_VIEW orchestrator (configured in MAIN_VIEW settingsSchema)
  const alarmsApiBaseUrl = window.MyIOOrchestrator?.alarmsApiBaseUrl || '';
  const alarmsApiKey     = window.MyIOOrchestrator?.alarmsApiKey     || '';
  if (!alarmsApiKey) {
    MyIOLibrary.MyIOToast?.error('[ALARM] alarmsApiKey não encontrado em window.MyIOOrchestrator. Configure em MAIN_VIEW Widget Settings → alarmsApiKey.');
  }

  // Read theme from dashboard orchestrator; fallback to light
  _currentTheme = window.MyIOOrchestrator?.currentTheme || 'light';

  // Expose TB base URL globally for AlarmDetailsModal annotation persistence
  const _tbBaseUrl = settings.tbBaseUrl || self.ctx?.settings?.tbBaseUrl || '';
  if (_tbBaseUrl) window.__myioTbBaseUrl = _tbBaseUrl;

  _maxAlarms  = settings.maxAlarmsVisible ?? 100;
  _activeTab  = defaultTab;

  // --- Logger ---
  if (MyIOLibrary.createLogHelper) {
    LogHelper = MyIOLibrary.createLogHelper({
      debugActive: enableDebugMode,
      config: { widget: 'ALARM' },
    });
  } else if (enableDebugMode) {
    LogHelper = {
      log:   (...a) => console.log('[ALARM]',  ...a),
      warn:  (...a) => console.warn('[ALARM]', ...a),
      error: (...a) => console.error('[ALARM]',...a),
    };
  }

  LogHelper.log('onInit — settings:', { labelWidget, defaultTab, showCustomerName, refreshIntervalSeconds, theme: _currentTheme });

  // --- Apply theme and sync with dashboard ---
  const root = document.getElementById('alarmWidgetRoot');
  if (root) root.setAttribute('data-theme', _currentTheme);

  _themeChangeHandler = (ev) => {
    const theme = ev.detail?.theme;
    if (theme !== 'dark' && theme !== 'light') return;
    _currentTheme = theme;
    if (root) root.setAttribute('data-theme', theme);
    _panelInstance?.setTheme?.(theme);
    LogHelper.log('Theme updated:', theme);
  };
  window.addEventListener('myio:theme-changed', _themeChangeHandler);

  // --- Configure AlarmService — credentials + TTL always from settings/orchestrator ---
  MyIOLibrary.AlarmService?.configure?.(alarmsApiBaseUrl, cacheIntervalSeconds * 1000, alarmsApiKey);
  LogHelper.log('AlarmService configured — baseUrl:', alarmsApiBaseUrl || '(missing!)', '— cacheTTL:', cacheIntervalSeconds + 's');

  // --- RFC-0178: Listen for alarm filter changes from HEADER ---
  _filterChangeHandler = (ev) => {
    _activeFilters = {
      from: ev.detail?.from || null,
      to:   ev.detail?.to   || null,
    };
    LogHelper.log('Alarm filter changed:', _activeFilters);
    MyIOLibrary?.AlarmService?.clearCache?.();
    _debouncedFetchAndUpdate(400);
  };
  window.addEventListener('myio:alarm-filter-change', _filterChangeHandler);

  // --- RFC-0178: Refresh when alarm view is activated (tab switch) ---
  _activationHandler = () => {
    LogHelper.log('Alarm view activated — refreshing data');
    _debouncedFetchAndUpdate(300);
  };
  window.addEventListener('myio:alarm-content-activated', _activationHandler);

  // --- Closed alarms history mode — toggled from AlarmsNotificationsPanelView ---
  _closedAlarmsHandler = (ev) => {
    _closedAlarmsMode = !!ev.detail?.enabled;
    LogHelper.log('Closed alarms mode:', _closedAlarmsMode ? 'ENABLED' : 'DISABLED');
    window.MyIOLibrary?.AlarmService?.clearCache?.();
    _debouncedFetchAndUpdate(200);
  };
  window.addEventListener('myio:closed-alarms-toggle', _closedAlarmsHandler);

  // NOTE: myio:alarms-updated is NOT handled here.
  // The ALARM widget fetches directly from the API on its own timer (_refreshTimer).
  // Reacting to myio:alarms-updated would create a loop:
  //   _fetchAndUpdate → ASO.refresh() → myio:alarms-updated → _fetchAndUpdate → …

  // --- Label ---
  const labelEl = document.getElementById('labelWidgetId');
  if (labelEl) labelEl.textContent = labelWidget;

  // --- RFC-0180: GCDR IDs are resolved by MAIN_VIEW and stored in window.MyIOOrchestrator ---
  _customerIngId = window.MyIOOrchestrator?.gcdrCustomerId || '';
  _gcdrTenantId  = window.MyIOOrchestrator?.gcdrTenantId  || '';
  LogHelper.log('gcdrCustomerId (from orchestrator):', _customerIngId || '(empty — will retry on fetch)');
  LogHelper.log('gcdrTenantId   (from orchestrator):', _gcdrTenantId  || '(empty)');

  // --- Mount AlarmsNotificationsPanel component ---
  const container = document.getElementById('alarmPanelContainer');
  if (!container) {
    LogHelper.error('#alarmPanelContainer not found in template');
    return;
  }

  if (!MyIOLibrary.createAlarmsNotificationsPanelComponent) {
    LogHelper.error('createAlarmsNotificationsPanelComponent not available in MyIOLibrary');
    _renderError(container, 'Componente de alarmes não disponível.');
    return;
  }

  const userEmail = window.MyIOUtils?.currentUserEmail || '';

  _panelInstance = MyIOLibrary.createAlarmsNotificationsPanelComponent({
    container,
    themeMode: _currentTheme,
    enableDebugMode,
    alarms: [],
    showCustomerName: showCustomerName,
    alarmsApiBaseUrl,
    alarmsApiKey,

    onAlarmClick: (alarm) => {
      LogHelper.log('Alarm clicked:', alarm.title || alarm.id);
      MyIOLibrary.openAlarmDetailsModal?.(alarm);
    },

    onAcknowledge: async (alarmIds) => {
      LogHelper.log('Batch acknowledge:', alarmIds.length, 'alarms');
      await _handleBatchAction('acknowledge', alarmIds, userEmail);
    },

    onEscalate: async (alarmIds) => {
      LogHelper.log('Batch escalate:', alarmIds.length, 'alarms');
      await _handleBatchAction('escalate', alarmIds, userEmail);
    },

    onSnooze: async (alarmIds, until) => {
      LogHelper.log('Batch snooze:', alarmIds.length, 'alarms until', until);
      await _handleBatchAction('snooze', alarmIds, userEmail, { until });
    },

    onClose: async (alarmIds, reason) => {
      LogHelper.log('Batch close:', alarmIds.length, 'alarms');
      await _handleBatchAction('close', alarmIds, userEmail, { reason });
    },

    onTabChange: (tab) => {
      LogHelper.log('Internal tab changed:', tab);
    },
  });

  // --- Activate default tab ---
  _switchTab(defaultTab);

  // --- Initial data fetch ---
  await _fetchAndUpdate();

  // --- Auto-refresh timer ---
  if (refreshIntervalSeconds > 0) {
    _refreshTimer = setInterval(_fetchAndUpdate, refreshIntervalSeconds * 1000);
    LogHelper.log('Auto-refresh set to', refreshIntervalSeconds, 'seconds');
  }

  // --- Bind header buttons ---
  _bindHeaderButtons();

  // --- Maintenance overlay ---
  if (_MAINTENANCE_MODE) _showMaintenanceOverlay();

  LogHelper.log('onInit complete');
};

// ============================================================================
// Maintenance overlay
// ============================================================================

function _showMaintenanceOverlay() {
  const OVERLAY_ID = 'alarm-maintenance-overlay';
  if (document.getElementById(OVERLAY_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = [
    'position:absolute', 'inset:0', 'z-index:9999',
    'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
    'background:rgba(255,255,255,0.92)', 'backdrop-filter:blur(3px)',
    'border-radius:inherit', 'pointer-events:all',
  ].join(';');

  overlay.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px;opacity:.7">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
    <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#475569;letter-spacing:.01em">Em manutenção</p>
    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;max-width:220px;line-height:1.5">
      Este widget está em atualização.<br>Aguarde alguns instantes.
    </p>
    <button id="alarm-maintenance-unlock"
      title="Desbloquear"
      style="position:absolute;bottom:10px;right:12px;background:none;border:none;cursor:pointer;padding:4px;opacity:.15;transition:opacity .2s;line-height:0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </button>
  `;

  // Position relative to the widget root
  const root = document.getElementById('alarmWidgetRoot') || document.body;
  const parent = root.parentElement || root;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  parent.appendChild(overlay);

  const unlockBtn = overlay.querySelector('#alarm-maintenance-unlock');
  if (unlockBtn) {
    unlockBtn.addEventListener('mouseenter', () => { unlockBtn.style.opacity = '0.6'; });
    unlockBtn.addEventListener('mouseleave', () => { unlockBtn.style.opacity = '0.15'; });
    unlockBtn.addEventListener('click', () => { overlay.remove(); });
  }
}

// ============================================================================
// onDestroy
// ============================================================================

self.onDestroy = function () {
  if (_themeChangeHandler) {
    window.removeEventListener('myio:theme-changed', _themeChangeHandler);
    _themeChangeHandler = null;
  }
  if (_filterChangeHandler) {
    window.removeEventListener('myio:alarm-filter-change', _filterChangeHandler);
    _filterChangeHandler = null;
  }
  if (_activationHandler) {
    window.removeEventListener('myio:alarm-content-activated', _activationHandler);
    _activationHandler = null;
  }
  if (_closedAlarmsHandler) {
    window.removeEventListener('myio:closed-alarms-toggle', _closedAlarmsHandler);
    _closedAlarmsHandler = null;
  }
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
  clearTimeout(_fetchDebounceTimer);
  _fetchDebounceTimer = null;
  if (_panelInstance?.destroy) {
    _panelInstance.destroy();
  }
  _panelInstance = null;
  LogHelper.log('onDestroy — cleanup complete');
};

// ============================================================================
// onDataUpdated — no-op (data comes from AlarmService, not TB datasource)
// ============================================================================

self.onDataUpdated = function () {};

// ============================================================================
// Internal helpers
// ============================================================================

function _debouncedFetchAndUpdate(delayMs = 300) {
  clearTimeout(_fetchDebounceTimer);
  _fetchDebounceTimer = setTimeout(() => _fetchAndUpdate(), delayMs);
}

/**
 * Returns the active date range:
 * 1. Explicit filter from myio:alarm-filter-change (HEADER alarm domain)
 * 2. Current period from MyIOOrchestrator.getCurrentPeriod()
 * 3. window.__myioInitialPeriod fallback
 */
function _getActiveDates() {
  if (_activeFilters.from && _activeFilters.to) {
    return { from: _activeFilters.from, to: _activeFilters.to };
  }
  const period = window.MyIOOrchestrator?.getCurrentPeriod?.()
    || window.__myioInitialPeriod;
  if (period?.startISO && period?.endISO) {
    return { from: period.startISO, to: period.endISO };
  }
  return { from: null, to: null };
}

/**
 * Enriches alarm source fields with TB device names.
 * RFC-0179: Only enriches when source is an opaque identifier (UUID or gcdr: short-code).
 * If source is already a human-readable device name (from GCDR deviceName field), it is
 * left unchanged to avoid wrong overrides from stale/cross-customer map data.
 */
function _enrichAlarms(rawAlarms) {
  const gcdrMap = window.MyIOOrchestrator?.gcdrDeviceNameMap;
  const nameMap = window.MyIOOrchestrator?.entityNameToLabelMap;
  const UUID_RE     = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const SHORTCODE_RE = /^gcdr:[0-9a-f]{8}/;
  return rawAlarms.map((a) => {
    const src = a.source || '';
    // Only attempt lookup when source is an opaque ID, not a human-readable device name.
    const isOpaqueId = UUID_RE.test(src) || SHORTCODE_RE.test(src);
    const tbName = isOpaqueId
      ? (gcdrMap?.get(src) || nameMap?.get(src) || null)
      : null;
    return {
      ...a,
      ...(tbName ? { source: tbName } : {}),
      firstOccurrence: a.firstOccurrence || a.raisedAt || '',
      lastOccurrence:  a.lastOccurrence  || a.lastUpdatedAt || a.raisedAt || '',
    };
  });
}

/**
 * Unified fetch: always uses date range from _getActiveDates().
 * @param {string} resolvedCustomerId
 * @param {string[]} states — alarm states to fetch
 */
async function _fetchAlarmsAndUpdate(resolvedCustomerId, states) {
  const AlarmService = window.MyIOLibrary?.AlarmService;
  if (!AlarmService) {
    LogHelper.warn('[ALARM] AlarmService not available');
    return;
  }

  // Filtro de data só faz sentido para histórico (alarms CLOSED).
  // Alarms ativos (OPEN/ACK/SNOOZED/ESCALATED) devem aparecer sempre, independente de quando foram abertos.
  const isClosedQuery = states.length === 1 && states[0] === 'CLOSED';
  const { from, to } = isClosedQuery ? _getActiveDates() : { from: null, to: null };
  LogHelper.log('[ALARM] Fetching alarms — states:', states, '| from:', from ?? '(sem filtro)', '| to:', to ?? '(sem filtro)');

  const response = await AlarmService.getAlarms({
    state:      states,
    limit:      _maxAlarms,
    customerId: resolvedCustomerId,
    from:       from || undefined,
    to:         to   || undefined,
  });

  const alarms  = _enrichAlarms(response.data ?? []);
  const summary = response.summary;

  const byState = { OPEN: 0, ACK: 0, SNOOZED: 0, ESCALATED: 0, CLOSED: 0 };
  for (const a of alarms) { if (a.state in byState) byState[a.state]++; }

  _panelInstance?.updateAlarms?.(alarms);
  _panelInstance?.updateStats?.(summary || { byState });

  const openCount = byState.OPEN + byState.ESCALATED;
  _updateCountBadge(openCount);

  LogHelper.log('[ALARM] Panel updated —', alarms.length, 'alarms | open:', openCount);
}

async function _fetchAndUpdate() {
  if (_isRefreshing) return;
  _isRefreshing = true;

  const resolvedCustomerId = _customerIngId || window.MyIOOrchestrator?.gcdrCustomerId || '';
  if (!resolvedCustomerId) {
    LogHelper.error('_fetchAndUpdate aborted: gcdrCustomerId is empty');
    _isRefreshing = false;
    return;
  }

  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) btnRefresh.classList.add('is-spinning');
  _panelInstance?.setLoading?.(true);

  try {
    const states = _closedAlarmsMode
      ? ['CLOSED']
      : ['OPEN', 'ACK', 'SNOOZED', 'ESCALATED'];

    await _fetchAlarmsAndUpdate(resolvedCustomerId, states);

    if (!_closedAlarmsMode) {
      // Fire-and-forget ASO refresh so TELEMETRY badge counts stay in sync
      window.AlarmServiceOrchestrator?.refresh?.().catch(() => {});

      // Trend fetch (non-blocking)
      const AlarmService = window.MyIOLibrary?.AlarmService;
      if (AlarmService) {
        AlarmService.getAlarmTrend(resolvedCustomerId, 'week', 'day')
          .then((trend) => { if (trend?.length) _panelInstance?.updateTrendData?.(trend); })
          .catch(() => {});
      }
    }
  } catch (err) {
    LogHelper.error('_fetchAndUpdate failed:', err);
  } finally {
    _panelInstance?.setLoading?.(false);
    if (btnRefresh) btnRefresh.classList.remove('is-spinning');
    _isRefreshing = false;
  }
}

async function _handleBatchAction(action, alarmIds, userEmail, opts) {
  const AlarmService = window.MyIOLibrary?.AlarmService;
  if (!AlarmService) return;

  const email = userEmail || window.MyIOUtils?.currentUserEmail || 'unknown';

  try {
    let result;
    if      (action === 'acknowledge') result = await AlarmService.batchAcknowledge(alarmIds, email);
    else if (action === 'snooze')      result = await AlarmService.batchSilence(alarmIds, email, opts?.until || '4h');
    else if (action === 'escalate')    result = await AlarmService.batchEscalate(alarmIds, email);
    else if (action === 'close')       result = await AlarmService.batchClose(alarmIds, email, opts?.reason);
    else {
      LogHelper.warn('Unknown alarm action:', action);
      return;
    }

    if (result?.failureCount > 0) {
      LogHelper.warn('Batch action partial failure:', action, result.failureCount, 'failed', result.failed);
    }
    LogHelper.log('Batch action completed:', action, `${result?.successCount ?? 0}/${alarmIds.length} succeeded`);

    // Trigger MAIN to re-fetch and rebuild ASO → myio:alarms-updated → all components update
    AlarmService.clearCache?.();
    const ASO = window.AlarmServiceOrchestrator;
    if (ASO) {
      await ASO.refresh(); // fires myio:alarms-updated → updates panel, TELEMETRY badges, AlarmsTab
    } else {
      await _fetchAndUpdate();
    }
  } catch (err) {
    LogHelper.error('Batch action failed:', action, err);
  }
}

function _switchTab(tabId) {
  _activeTab = tabId;

  // Update tab button styles
  document.querySelectorAll('.alarm-tab-btn').forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  // Delegate to the panel component's internal tab switch
  if (tabId === 'list') {
    _panelInstance?.showListTab?.() || _panelInstance?.setActiveTab?.('list');
  } else if (tabId === 'dashboard') {
    _panelInstance?.showDashboardTab?.() || _panelInstance?.setActiveTab?.('dashboard');
  }

  LogHelper.log('Tab switched to:', tabId);
}

function _updateCountBadge(count) {
  const badge = document.getElementById('alarmCountBadge');
  if (!badge) return;

  badge.textContent = count > 99 ? '99+' : String(count);
  badge.style.display = 'inline-flex';
  badge.classList.toggle('is-zero', count === 0);
}

function _bindHeaderButtons() {
  // RFC-0179: GCDR Alarm Bundle Map button
  const btnBundleMap = document.getElementById('btnAlarmBundleMap');
  if (btnBundleMap) {
    btnBundleMap.addEventListener('click', () => {
      const MyIOLibrary = window.MyIOLibrary;
      if (!MyIOLibrary?.openAlarmBundleMapModal) {
        LogHelper.warn('openAlarmBundleMapModal not available in MyIOLibrary');
        return;
      }

      const customerTB_ID = window.MyIOOrchestrator?.customerTB_ID || '';
      const gcdrTenantId  = _gcdrTenantId || window.MyIOOrchestrator?.gcdrTenantId || '';
      const gcdrApiBaseUrl = window.MyIOOrchestrator?.gcdrApiBaseUrl || 'https://gcdr-api.a.myio-bas.com';

      if (!customerTB_ID) {
        LogHelper.warn('btnAlarmBundleMap: customerTB_ID not available in orchestrator');
        return;
      }

      MyIOLibrary.openAlarmBundleMapModal({
        customerTB_ID,
        gcdrTenantId,
        gcdrApiBaseUrl,
        themeMode: _currentTheme,
      });
    });
  }

  // Refresh button
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      window.MyIOLibrary?.AlarmService?.clearCache?.();
      await _fetchAndUpdate();
    });
  }

  // Tab buttons
  document.querySelectorAll('.alarm-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      if (tabId && tabId !== _activeTab) {
        _switchTab(tabId);
      }
    });
  });
}

function _renderError(container, message) {
  if (!container) return;
  container.innerHTML = `
    <div style="
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      height:160px; gap:10px; color:#94a3b8; font-size:13px; text-align:center;
      padding:20px;
    ">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="#ef4444" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <span>${message}</span>
    </div>
  `;
}
