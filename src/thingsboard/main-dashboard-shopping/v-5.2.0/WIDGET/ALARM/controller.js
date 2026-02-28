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
let _alarmsUpdatedHandler   = null; // receives myio:alarms-updated from MAIN_VIEW

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

  // Read theme from dashboard orchestrator; fallback to light
  _currentTheme = window.MyIOOrchestrator?.currentTheme || 'light';

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

  // --- myio:alarms-updated — fired by MAIN_VIEW after each ASO rebuild ---
  // In normal (active) mode, this is the authoritative alarm update.
  // Closed-history mode ignores this event (its own fetch supplies the data).
  _alarmsUpdatedHandler = () => {
    if (_closedAlarmsMode) return; // closed mode manages its own fetch
    LogHelper.log('[ALARM] myio:alarms-updated received — refreshing panel from ASO');
    _updatePanelFromASO();
  };
  window.addEventListener('myio:alarms-updated', _alarmsUpdatedHandler);

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

  LogHelper.log('onInit complete');
};

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
  if (_alarmsUpdatedHandler) {
    window.removeEventListener('myio:alarms-updated', _alarmsUpdatedHandler);
    _alarmsUpdatedHandler = null;
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
    if (_closedAlarmsMode) {
      // ── Closed-history mode: direct API call (MAIN does not cache CLOSED alarms) ──
      await _fetchClosedAlarmsAndUpdate(resolvedCustomerId);
    } else {
      // ── Normal mode: MAIN is the single source of truth ──
      // ASO.refresh() → _prefetchCustomerAlarms → _buildAlarmServiceOrchestrator
      //   → dispatches myio:alarms-updated → _updatePanelFromASO() via event handler.
      // We also await it directly so the panel is ready before the spinner stops.
      const ASO = window.AlarmServiceOrchestrator;
      if (ASO) {
        await ASO.refresh();
        // _updatePanelFromASO() already called by the myio:alarms-updated handler,
        // but also call directly here to handle the trend fetch result.
      } else {
        LogHelper.warn('[ALARM] AlarmServiceOrchestrator not available yet — skipping refresh');
      }

      // Trend is independent of state — fetch separately (non-blocking for panel)
      const AlarmService = window.MyIOLibrary?.AlarmService;
      if (AlarmService && resolvedCustomerId) {
        AlarmService.getAlarmTrend(resolvedCustomerId, 'week', 'day')
          .then((trend) => { if (trend?.length) _panelInstance?.updateTrendData?.(trend); })
          .catch(() => { /* non-blocking */ });
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

/**
 * Called by myio:alarms-updated event (normal mode) and directly after ASO.refresh().
 * Reads from AlarmServiceOrchestrator, enriches device names, and updates the panel.
 */
function _updatePanelFromASO() {
  const ASO = window.AlarmServiceOrchestrator;
  if (!ASO || !_panelInstance) return;

  const rawAlarms = ASO.alarms || [];

  // RFC-0179: Enrich alarm sources with TB device names (four-layer strategy).
  const gcdrMap = window.MyIOOrchestrator?.gcdrDeviceNameMap;
  const nameMap = window.MyIOOrchestrator?.entityNameToLabelMap;

  const stateMap = new Map();
  if (window.STATE) {
    for (const domain of ['energy', 'water', 'temperature']) {
      const raw = window.STATE[domain]?._raw || [];
      for (const item of raw) {
        const name = item.label || item.name || '';
        if (name && item.centralId) stateMap.set(String(item.centralId), name);
      }
    }
  }

  const alarms = rawAlarms.map((a) => {
    const isNumericSrc = /^\d+$/.test(a.source);
    const tbName = gcdrMap?.get(a.source)
      || (isNumericSrc ? gcdrMap?.get(a.centralId) : null)
      || stateMap.get(a.centralId)
      || nameMap?.get(a.source);
    // Normalize GCDR date fields → Alarm interface (firstOccurrence / lastOccurrence)
    return {
      ...a,
      ...(tbName ? { source: tbName } : {}),
      firstOccurrence: a.firstOccurrence || a.raisedAt || '',
      lastOccurrence:  a.lastOccurrence  || a.lastUpdatedAt || a.raisedAt || '',
    };
  });

  // Compute summary from the alarm array (MAIN does not return a pre-built summary object)
  const byState = { OPEN: 0, ACK: 0, SNOOZED: 0, ESCALATED: 0, CLOSED: 0 };
  for (const a of alarms) { if (a.state in byState) byState[a.state]++; }
  const summary = { byState };

  _panelInstance.updateAlarms?.(alarms);
  _panelInstance.updateStats?.(summary);

  const openCount = byState.OPEN + byState.ESCALATED;
  _updateCountBadge(openCount);

  LogHelper.log('[ALARM] Panel updated from ASO —', alarms.length, 'alarms, open:', openCount);
}

/**
 * Closed-history mode: fetches CLOSED alarms directly from alarms-api
 * using the date range supplied by the HEADER widget (stored in _activeFilters).
 */
async function _fetchClosedAlarmsAndUpdate(resolvedCustomerId) {
  const AlarmService = window.MyIOLibrary?.AlarmService;
  if (!AlarmService) {
    LogHelper.warn('[ALARM] AlarmService not available — cannot fetch closed alarms');
    return;
  }

  const response = await AlarmService.getAlarms({
    state:      ['CLOSED'],
    limit:      _maxAlarms,
    customerId: resolvedCustomerId,
    from:       _activeFilters.from || undefined,
    to:         _activeFilters.to   || undefined,
  });

  const rawAlarms = response.data ?? [];
  const summary   = response.summary;

  const gcdrMap = window.MyIOOrchestrator?.gcdrDeviceNameMap;
  const nameMap = window.MyIOOrchestrator?.entityNameToLabelMap;
  const stateMap = new Map();
  if (window.STATE) {
    for (const domain of ['energy', 'water', 'temperature']) {
      const raw = window.STATE[domain]?._raw || [];
      for (const item of raw) {
        const name = item.label || item.name || '';
        if (name && item.centralId) stateMap.set(String(item.centralId), name);
      }
    }
  }

  const alarms = rawAlarms.map((a) => {
    const isNumericSrc = /^\d+$/.test(a.source);
    const tbName = gcdrMap?.get(a.source)
      || (isNumericSrc ? gcdrMap?.get(a.centralId) : null)
      || stateMap.get(a.centralId)
      || nameMap?.get(a.source);
    // Normalize GCDR date fields → Alarm interface (firstOccurrence / lastOccurrence)
    return {
      ...a,
      ...(tbName ? { source: tbName } : {}),
      firstOccurrence: a.firstOccurrence || a.raisedAt || '',
      lastOccurrence:  a.lastOccurrence  || a.lastUpdatedAt || a.raisedAt || '',
    };
  });

  _panelInstance?.updateAlarms?.(alarms);
  if (summary) _panelInstance?.updateStats?.(summary);
  _updateCountBadge(alarms.length);

  LogHelper.log('[ALARM] Closed alarms fetched —', alarms.length, 'total');
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
