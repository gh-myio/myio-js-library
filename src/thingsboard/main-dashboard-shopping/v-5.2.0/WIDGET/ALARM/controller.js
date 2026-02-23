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
let _customerIngId          = '';
let _gcdrTenantId           = ''; // RFC-0179: from TB SERVER_SCOPE attr gcdrTenantId
let _maxAlarms              = 50;
let _activeTab              = 'list';
let _isRefreshing           = false;
let _currentTheme           = 'light';
let _themeChangeHandler     = null;
let _filterChangeHandler    = null;
let _activationHandler      = null;
let _activeFilters          = {}; // { from?, to? }

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
  _customerIngId       = '';
  _gcdrTenantId        = '';
  _isRefreshing        = false;
  _activeFilters       = {};

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
  const refreshIntervalSeconds = settings.refreshIntervalSeconds ?? 60;
  const enableDebugMode        = settings.enableDebugMode        ?? false;

  // Read theme from dashboard orchestrator; fallback to light
  _currentTheme = window.MyIOOrchestrator?.currentTheme || 'light';

  _maxAlarms  = settings.maxAlarmsVisible ?? 50;
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

  // --- RFC-0178: Configure AlarmService base URL from orchestrator ---
  const alarmsUrl = window.MyIOOrchestrator?.alarmsApiBaseUrl;
  if (alarmsUrl) {
    MyIOLibrary.AlarmService?.configure?.(alarmsUrl);
    LogHelper.log('AlarmService configured with base URL:', alarmsUrl);
  }

  // --- RFC-0178: Listen for alarm filter changes from HEADER ---
  _filterChangeHandler = (ev) => {
    _activeFilters = {
      from: ev.detail?.from || null,
      to:   ev.detail?.to   || null,
    };
    LogHelper.log('Alarm filter changed:', _activeFilters);
    MyIOLibrary?.AlarmService?.clearCache?.();
    _fetchAndUpdate();
  };
  window.addEventListener('myio:alarm-filter-change', _filterChangeHandler);

  // --- RFC-0178: Refresh when alarm view is activated (tab switch) ---
  _activationHandler = () => {
    LogHelper.log('Alarm view activated — refreshing data');
    _fetchAndUpdate();
  };
  window.addEventListener('myio:alarm-content-activated', _activationHandler);

  // --- Label ---
  const labelEl = document.getElementById('labelWidgetId');
  if (labelEl) labelEl.textContent = labelWidget;

  // --- Fetch gcdrCustomerId from TB SERVER_SCOPE attributes ---
  const jwt = localStorage.getItem('jwt_token') || '';
  if (!jwt) {
    LogHelper.warn('JWT token not found in localStorage');
  }

  try {
    if (MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage) {
      const attrs = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
      _customerIngId = attrs?.gcdrCustomerId || attrs?.gcdrId || '';
      _gcdrTenantId  = attrs?.gcdrTenantId || '';
      LogHelper.log('gcdrCustomerId resolved:', _customerIngId || '(empty)');
      LogHelper.log('GCDR Tenant ID resolved:', _gcdrTenantId || '(empty)');
    } else {
      LogHelper.warn('fetchThingsboardCustomerAttrsFromStorage not available in MyIOLibrary');
    }
  } catch (err) {
    LogHelper.error('Failed to fetch customer attributes:', err);
  }

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

    onAlarmClick: (alarm) => {
      LogHelper.log('Alarm clicked:', alarm.title || alarm.id);
      // RFC-0152 Phase 4: Open alarm details modal
      MyIOLibrary.openAlarmDetailsModal?.(alarm);
    },

    onAlarmAction: async (action, alarm) => {
      LogHelper.log('Alarm action:', action, alarm.id);
      await _handleAlarmAction(action, alarm, userEmail);
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
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
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

async function _fetchAndUpdate() {
  if (_isRefreshing) return;
  _isRefreshing = true;

  const AlarmService = window.MyIOLibrary?.AlarmService;

  if (!AlarmService) {
    LogHelper.warn('AlarmService not available in MyIOLibrary');
    _isRefreshing = false;
    return;
  }

  // RFC-0178: customerId is mandatory — abort if empty
  if (!_customerIngId) {
    LogHelper.error('_fetchAndUpdate aborted: gcdrCustomerId is empty (check TB SERVER_SCOPE attr gcdrCustomerId)');
    _isRefreshing = false;
    return;
  }

  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) btnRefresh.classList.add('is-spinning');

  try {
    _panelInstance?.setLoading?.(true);

    // RFC-0178: Single getAlarms call with summary + parallel trend fetch
    const [response, trend] = await Promise.all([
      AlarmService.getAlarms({
        state:      ['OPEN', 'ACK', 'ESCALATED', 'SNOOZED'],
        limit:      _maxAlarms,
        customerId: _customerIngId,                    // always required
        from:       _activeFilters.from || undefined,
        to:         _activeFilters.to   || undefined,
      }),
      AlarmService.getAlarmTrend(_customerIngId, 'week', 'day'),
    ]);

    const alarms  = response.data;
    const summary = response.summary;

    _panelInstance?.updateAlarms?.(alarms);
    if (summary) _panelInstance?.updateStats?.(summary);
    if (trend?.length) _panelInstance?.updateTrendData?.(trend);

    // Count badge: open + escalated from embedded summary
    const openCount = (summary?.byState?.OPEN ?? 0) + (summary?.byState?.ESCALATED ?? 0);
    _updateCountBadge(openCount);

    LogHelper.log('Panel updated —', alarms.length, 'alarms, openCount:', openCount);
  } catch (err) {
    LogHelper.error('_fetchAndUpdate failed:', err);
  } finally {
    _panelInstance?.setLoading?.(false);
    if (btnRefresh) btnRefresh.classList.remove('is-spinning');
    _isRefreshing = false;
  }
}

async function _handleAlarmAction(action, alarm, userEmail) {
  const AlarmService = window.MyIOLibrary?.AlarmService;
  if (!AlarmService) return;

  const email = userEmail || window.MyIOUtils?.currentUserEmail || 'unknown';

  try {
    if      (action === 'acknowledge') await AlarmService.acknowledgeAlarm(alarm.id, email);
    else if (action === 'snooze')      await AlarmService.silenceAlarm(alarm.id, email, '4h');
    else if (action === 'escalate')    await AlarmService.escalateAlarm(alarm.id, email);
    else if (action === 'close')       await AlarmService.closeAlarm(alarm.id, email);
    else {
      LogHelper.warn('Unknown alarm action:', action);
      return;
    }

    // Invalidate cache so fresh data is fetched
    AlarmService.clearCache?.();
    await _fetchAndUpdate();
  } catch (err) {
    LogHelper.error('Alarm action failed:', action, err);
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
