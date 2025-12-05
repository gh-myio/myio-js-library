/* global self, window, document */
/* alarm-profiles-panel.js - API-Driven (RFC-0096) - Pure JS Rendering */

var DEBUG_ACTIVE = true;

var LogHelper = {
  log: function () {
    if (DEBUG_ACTIVE)
      console.log.apply(console, ['[AlarmPanel]'].concat(Array.prototype.slice.call(arguments)));
  },
  warn: function () {
    if (DEBUG_ACTIVE)
      console.warn.apply(console, ['[AlarmPanel]'].concat(Array.prototype.slice.call(arguments)));
  },
  error: function () {
    console.error.apply(console, ['[AlarmPanel]'].concat(Array.prototype.slice.call(arguments)));
  },
};

// ============================================================
// STATE
// ============================================================
var state = {
  loading: true,
  error: null,
  viewMode: 'devices',
  profiles: [],
  devices: [],
  alarms: [],
  selectedProfileIds: [],
  filters: {
    statuses: { ACTIVE: true, CLEARED: false, ACKNOWLEDGED: false },
    searchText: '',
    selectedDeviceIds: [],
    severities: { CRITICAL: true, MAJOR: true, MINOR: true, WARNING: true },
  },
  showModal: false,
  showFilterModal: false,
  showExportModal: false,
  exportOptions: {
    deviceProfiles: true,
    deviceMap: true,
    alarmList: true,
  },
  exportGenerating: false,
  activeProfile: null,
  settings: {
    appearance: { showHeader: true, headerTitle: 'Alarm Profiles Panel', compactMode: false },
    api: { devicesPageSize: 1000, alarmsPageSize: 500 },
  },
  customers: [],
  deviceProfiles: {},
};

var rootEl = null;
var ctx = null;

// ============================================================
// CSS INJECTION
// ============================================================
function injectStyles() {
  if (document.getElementById('alarm-panel-styles')) return;

  var css = `
    .ap-root { font-family: Arial, sans-serif; padding: 16px; }
    .ap-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #ddd; padding-bottom: 12px; }
    .ap-title { margin: 0; font-size: 18px; color: #333; }
    .ap-subtitle { font-size: 12px; color: #666; }
    .ap-btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
    .ap-btn-primary { background: #1976d2; color: white; }
    .ap-btn-secondary { background: #e0e0e0; color: #333; }
    .ap-btn:hover { opacity: 0.9; }
    .ap-state { padding: 40px; text-align: center; color: #666; }
    .ap-error { color: #d32f2f; background: #ffebee; border-radius: 4px; }
    .ap-section-title { font-weight: bold; font-size: 14px; }
    .ap-count { font-size: 12px; color: #666; margin-left: 8px; }
    .ap-profiles-header, .ap-devices-header, .ap-alarms-header { display: flex; align-items: center; margin-bottom: 12px; }
    .ap-profiles-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .ap-profile-pill { display: flex; align-items: center; background: #f5f5f5; border: 2px solid transparent; border-radius: 20px; padding: 6px 12px; cursor: pointer; transition: all 0.2s; }
    .ap-profile-pill:hover { background: #e3f2fd; }
    .ap-profile-pill.selected { background: #bbdefb; border-color: #1976d2; }
    .ap-profile-name { font-weight: 500; margin-right: 6px; }
    .ap-profile-count { font-size: 11px; color: #666; }
    .ap-profile-info { margin-left: 8px; background: #1976d2; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 11px; cursor: pointer; }
    .ap-view-toggle { display: flex; gap: 4px; margin-bottom: 16px; }
    .ap-toggle-btn { padding: 8px 20px; border: 1px solid #ddd; background: white; cursor: pointer; }
    .ap-toggle-btn.active { background: #1976d2; color: white; border-color: #1976d2; }
    .ap-toggle-btn:first-child { border-radius: 4px 0 0 4px; }
    .ap-toggle-btn:last-child { border-radius: 0 4px 4px 0; }
    .ap-grid { border: 1px solid #ddd; border-radius: 4px; display: flex; flex-direction: column; max-height: 400px; }
    .ap-grid-header { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; background: #f5f5f5; padding: 10px; font-weight: bold; font-size: 12px; border-bottom: 1px solid #ddd; flex-shrink: 0; }
    .ap-grid-body { overflow-y: auto; flex: 1; }
    .ap-grid-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
    .ap-grid-row:hover { background: #fafafa; }
    .ap-device-name { font-weight: 500; }
    .ap-device-label { font-size: 11px; color: #666; }
    .ap-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; }
    .ap-badge-critical { background: #ffcdd2; color: #c62828; }
    .ap-badge-major { background: #ffe0b2; color: #e65100; }
    .ap-badge-minor { background: #fff9c4; color: #f9a825; }
    .ap-badge-warning { background: #fff3e0; color: #ff8f00; }
    .ap-badge-none { background: #e0e0e0; color: #616161; }
    .ap-status-active { background: #ffcdd2; color: #c62828; }
    .ap-status-cleared { background: #c8e6c9; color: #2e7d32; }
    .ap-status-ack { background: #bbdefb; color: #1565c0; }
    .ap-alarms-container { display: flex; flex-direction: column; max-height: 450px; border: 1px solid #ddd; border-radius: 4px; }
    .ap-alarms-list { overflow-y: auto; flex: 1; padding: 8px; }
    .ap-alarm-card { border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 8px; background: white; }
    .ap-alarm-card:last-child { margin-bottom: 0; }
    .ap-alarm-header { display: flex; justify-content: space-between; }
    .ap-alarm-device { font-weight: 500; }
    .ap-alarm-type { font-size: 12px; color: #666; }
    .ap-alarm-time { font-size: 11px; color: #999; }
    .ap-alarm-badges { display: flex; gap: 6px; margin-top: 4px; }
    .ap-filters { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
    .ap-filter-group { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .ap-filter-group label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
    .ap-search-box { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px; }
    .ap-search-input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
    .ap-search-input:focus { outline: none; border-color: #1976d2; }
    .ap-filter-btn { display: flex; align-items: center; gap: 4px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; font-size: 13px; }
    .ap-filter-btn:hover { background: #f5f5f5; }
    .ap-filter-btn.has-filters { border-color: #1976d2; background: #e3f2fd; }
    .ap-filter-icon { font-size: 14px; }
    .ap-filter-badge { background: #1976d2; color: white; border-radius: 10px; padding: 2px 6px; font-size: 10px; margin-left: 4px; }
    .ap-filter-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; width: 90%; max-width: 500px; max-height: 80vh; overflow: auto; z-index: 1001; }
    .ap-filter-section { margin-bottom: 16px; }
    .ap-filter-section-title { font-weight: bold; font-size: 13px; margin-bottom: 8px; color: #333; }
    .ap-checkbox-list { display: flex; flex-direction: column; gap: 6px; max-height: 150px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; padding: 8px; }
    .ap-checkbox-item { display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; }
    .ap-checkbox-item:hover { background: #f5f5f5; }
    .ap-select-all { font-size: 11px; color: #1976d2; cursor: pointer; margin-left: 8px; }
    .ap-select-all:hover { text-decoration: underline; }
    .ap-active-filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .ap-active-filter-tag { display: flex; align-items: center; gap: 4px; background: #e3f2fd; border: 1px solid #1976d2; border-radius: 12px; padding: 4px 8px; font-size: 11px; }
    .ap-active-filter-tag button { background: none; border: none; cursor: pointer; font-size: 12px; color: #666; padding: 0; line-height: 1; }
    .ap-active-filter-tag button:hover { color: #d32f2f; }
    .ap-modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; }
    .ap-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; width: 90%; max-width: 600px; max-height: 80vh; overflow: auto; z-index: 1001; }
    .ap-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #ddd; }
    .ap-modal-title { font-weight: bold; font-size: 16px; }
    .ap-modal-close { background: none; border: none; font-size: 20px; cursor: pointer; }
    .ap-modal-body { padding: 16px; }
    .ap-modal-section { margin-bottom: 16px; }
    .ap-modal-footer { padding: 16px; border-top: 1px solid #ddd; text-align: right; }
    .ap-empty { padding: 20px; text-align: center; color: #999; font-style: italic; }
    .ap-alarm-rules-header { margin-bottom: 12px; font-size: 14px; }
    .ap-alarm-rules-list { border: 1px solid #e0e0e0; border-radius: 4px; background: #fafafa; }
    .ap-alarm-rules-empty { padding: 12px; color: #666; font-style: italic; }
    .ap-alarm-rule-item { padding: 12px; border-bottom: 1px solid #e0e0e0; }
    .ap-alarm-rule-item:last-child { border-bottom: none; }
    .ap-alarm-rule-title { font-weight: bold; font-size: 14px; color: #1976d2; margin-bottom: 8px; }
    .ap-alarm-rule-create { margin-left: 12px; margin-bottom: 8px; }
    .ap-alarm-rule-severity { font-size: 13px; margin-bottom: 4px; }
    .ap-alarm-rule-condition { font-size: 12px; color: #333; margin-left: 12px; margin-bottom: 2px; }
    .ap-alarm-rule-default { font-size: 12px; color: #666; margin-left: 12px; margin-bottom: 2px; }
    .ap-alarm-rule-schedule { font-size: 12px; color: #666; margin-left: 12px; margin-bottom: 4px; }
    .ap-alarm-rule-nocreate { font-size: 12px; color: #999; margin-left: 12px; font-style: italic; }
    .ap-alarm-rule-clear { font-size: 12px; color: #2e7d32; margin-left: 12px; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #ccc; }
    .ap-alarm-rule-propagate { font-size: 11px; color: #666; margin-left: 12px; margin-top: 4px; }
    .ap-export-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; width: 90%; max-width: 450px; z-index: 1001; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
    .ap-export-option { display: flex; align-items: flex-start; gap: 12px; padding: 12px; border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; }
    .ap-export-option:hover { background: #f5f5f5; border-color: #1976d2; }
    .ap-export-option.selected { background: #e3f2fd; border-color: #1976d2; }
    .ap-export-option input[type="checkbox"] { margin-top: 2px; width: 18px; height: 18px; cursor: pointer; }
    .ap-export-option-content { flex: 1; }
    .ap-export-option-title { font-weight: 500; font-size: 14px; color: #333; margin-bottom: 4px; }
    .ap-export-option-desc { font-size: 12px; color: #666; }
    .ap-export-generating { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 20px; }
    .ap-spinner { width: 24px; height: 24px; border: 3px solid #e0e0e0; border-top-color: #1976d2; border-radius: 50%; animation: ap-spin 1s linear infinite; }
    @keyframes ap-spin { to { transform: rotate(360deg); } }
    .ap-btn-export { background: #4caf50; color: white; }
    .ap-btn-export:hover { background: #43a047; }
    .ap-btn-export:disabled { background: #ccc; cursor: not-allowed; }
  `;

  var style = document.createElement('style');
  style.id = 'alarm-panel-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================
function render() {
  if (!rootEl) return;

  var html = '<div class="ap-root">';

  // Header
  if (state.settings.appearance.showHeader) {
    html += '<div class="ap-header">';
    html += '<div><h3 class="ap-title">' + escapeHtml(state.settings.appearance.headerTitle) + '</h3>';
    html += '<div class="ap-subtitle">Select profiles, then view Devices or Alarms.</div></div>';
    html += '<div style="display: flex; gap: 8px;">';
    html += '<button class="ap-btn ap-btn-export" onclick="AlarmPanel.openExportModal()" title="Exportar PDF">&#128196; PDF</button>';
    html += '<button class="ap-btn ap-btn-secondary" onclick="AlarmPanel.refresh()">Refresh</button>';
    html += '</div>';
    html += '</div>';
  }

  // Loading / Error
  if (state.loading) {
    html += '<div class="ap-state">Loading data...</div>';
  } else if (state.error) {
    html += '<div class="ap-state ap-error">' + escapeHtml(state.error) + '</div>';
  } else {
    html += renderContent();
  }

  html += '</div>';

  // Profile Modal
  if (state.showModal && state.activeProfile) {
    html += renderModal();
  }

  // Filter Modal
  if (state.showFilterModal) {
    html += renderFilterModal();
  }

  // Export Modal
  if (state.showExportModal) {
    html += renderExportModal();
  }

  rootEl.innerHTML = html;
}

function renderContent() {
  var html = '';

  // Profiles
  html += '<div class="ap-profiles-header"><span class="ap-section-title">Device Profiles</span>';
  html += '<span class="ap-count">' + state.profiles.length + ' profile(s)</span></div>';

  if (state.profiles.length === 0) {
    html += '<div class="ap-empty">No device profiles loaded.</div>';
  } else {
    html += '<div class="ap-profiles-list">';
    state.profiles.forEach(function (p) {
      var sel = state.selectedProfileIds.indexOf(p.id) !== -1 ? ' selected' : '';
      html += '<div class="ap-profile-pill' + sel + '" onclick="AlarmPanel.toggleProfile(\'' + p.id + '\')">';
      html += '<span class="ap-profile-name">' + escapeHtml(p.name) + '</span>';
      html += '<span class="ap-profile-count">(' + p.deviceCount + ')</span>';
      html +=
        '<button class="ap-profile-info" onclick="event.stopPropagation(); AlarmPanel.showProfile(\'' +
        p.id +
        '\')">i</button>';
      html += '</div>';
    });
    html += '</div>';
  }

  // View Toggle
  html += '<div class="ap-view-toggle">';
  html +=
    '<button class="ap-toggle-btn' +
    (state.viewMode === 'devices' ? ' active' : '') +
    '" onclick="AlarmPanel.setView(\'devices\')">Devices</button>';
  html +=
    '<button class="ap-toggle-btn' +
    (state.viewMode === 'alarms' ? ' active' : '') +
    '" onclick="AlarmPanel.setView(\'alarms\')">Alarms</button>';
  html += '</div>';

  // Content
  if (state.viewMode === 'devices') {
    html += renderDevices();
  } else {
    html += renderAlarms();
  }

  return html;
}

function renderDevices() {
  var devices = getFilteredDevices();
  var html = '<div class="ap-devices-header"><span class="ap-section-title">Devices</span>';
  html += '<span class="ap-count">' + devices.length + ' device(s)</span></div>';

  if (devices.length === 0) {
    html += '<div class="ap-empty">No devices found. Select profiles above.</div>';
    return html;
  }

  html += '<div class="ap-grid">';
  html +=
    '<div class="ap-grid-header"><div>Device</div><div>Location</div><div>Severity</div><div>Status</div><div>Last Alarm</div></div>';

  html += '<div class="ap-grid-body">';
  devices.forEach(function (d) {
    html += '<div class="ap-grid-row">';
    html += '<div><div class="ap-device-name">' + escapeHtml(d.name) + '</div>';
    if (d.label) html += '<div class="ap-device-label">' + escapeHtml(d.label) + '</div>';
    html += '</div>';
    html += '<div>' + escapeHtml(d.location || '—') + '</div>';
    html +=
      '<div><span class="ap-badge ' +
      getSeverityClass(d.currentAlarmSeverity) +
      '">' +
      (d.currentAlarmSeverity || 'NONE') +
      '</span></div>';
    html +=
      '<div><span class="ap-badge ' +
      getStatusClass(d.alarmStatus) +
      '">' +
      (d.alarmStatus || 'NORMAL') +
      '</span></div>';
    html += '<div>' + formatDate(d.lastAlarmTs) + '</div>';
    html += '</div>';
  });
  html += '</div>';

  html += '</div>';
  return html;
}

function renderAlarms() {
  var alarms = getFilteredAlarms();
  var html = '<div class="ap-alarms-header"><span class="ap-section-title">Alarms</span>';
  html += '<span class="ap-count">' + alarms.length + ' alarm(s)</span></div>';

  // Search and Filter Bar
  html += '<div class="ap-filters">';

  // Search Box
  html += '<div class="ap-search-box">';
  html += '<input type="text" class="ap-search-input" placeholder="Buscar alarmes..." value="' + escapeHtml(state.filters.searchText) + '" onkeyup="AlarmPanel.onSearchChange(event)" />';
  html += '</div>';

  // Filter Button
  var activeFilterCount = getActiveFilterCount();
  html += '<button class="ap-filter-btn' + (activeFilterCount > 0 ? ' has-filters' : '') + '" onclick="AlarmPanel.openFilterModal()">';
  html += '<span class="ap-filter-icon">&#128269;</span> Filtros';
  if (activeFilterCount > 0) {
    html += '<span class="ap-filter-badge">' + activeFilterCount + '</span>';
  }
  html += '</button>';

  // Quick Status Toggles
  html += '<div class="ap-filter-group"><span>Status:</span>';
  html +=
    '<label><input type="checkbox" ' +
    (state.filters.statuses.ACTIVE ? 'checked' : '') +
    ' onchange="AlarmPanel.toggleFilter(\'ACTIVE\')"> ACTIVE</label>';
  html +=
    '<label><input type="checkbox" ' +
    (state.filters.statuses.CLEARED ? 'checked' : '') +
    ' onchange="AlarmPanel.toggleFilter(\'CLEARED\')"> CLEARED</label>';
  html +=
    '<label><input type="checkbox" ' +
    (state.filters.statuses.ACKNOWLEDGED ? 'checked' : '') +
    ' onchange="AlarmPanel.toggleFilter(\'ACKNOWLEDGED\')"> ACK</label>';
  html += '</div>';

  html += '</div>';

  // Active Filters Tags
  html += renderActiveFilterTags();

  if (alarms.length === 0) {
    html += '<div class="ap-empty">Nenhum alarme encontrado.</div>';
    return html;
  }

  // Alarms Container with Scroll
  html += '<div class="ap-alarms-container">';
  html += '<div class="ap-alarms-list">';
  alarms.forEach(function (a) {
    html += '<div class="ap-alarm-card">';
    html += '<div class="ap-alarm-header"><div>';
    html += '<div class="ap-alarm-device">' + escapeHtml(a.originatorName || 'Unknown') + '</div>';
    html += '<div class="ap-alarm-type">' + escapeHtml(a.type || a.name || 'Unknown') + '</div>';
    html += '</div><div>';
    html += '<div class="ap-alarm-time">' + formatDate(a.startTs) + '</div>';
    html += '<div class="ap-alarm-badges">';
    html +=
      '<span class="ap-badge ' + getSeverityClass(a.severity) + '">' + (a.severity || 'NONE') + '</span>';
    html += '<span class="ap-badge ' + getStatusClass(a.status) + '">' + (a.status || 'ACTIVE') + '</span>';
    html += '</div></div></div>';
    html += '</div>';
  });
  html += '</div>';
  html += '</div>';

  return html;
}

function getActiveFilterCount() {
  var count = 0;
  if (state.filters.selectedDeviceIds.length > 0) count++;
  if (!state.filters.severities.CRITICAL || !state.filters.severities.MAJOR ||
      !state.filters.severities.MINOR || !state.filters.severities.WARNING) count++;
  return count;
}

function renderActiveFilterTags() {
  var html = '';
  var tags = [];

  // Device filters
  if (state.filters.selectedDeviceIds.length > 0) {
    var deviceNames = state.filters.selectedDeviceIds.map(function(id) {
      var device = state.devices.find(function(d) { return d.id === id; });
      return device ? device.name : id;
    });
    if (deviceNames.length <= 2) {
      tags.push({ label: 'Devices: ' + deviceNames.join(', '), type: 'devices' });
    } else {
      tags.push({ label: 'Devices: ' + deviceNames.length + ' selecionados', type: 'devices' });
    }
  }

  // Severity filters
  var activeSeverities = [];
  ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING'].forEach(function(sev) {
    if (state.filters.severities[sev]) activeSeverities.push(sev);
  });
  if (activeSeverities.length < 4 && activeSeverities.length > 0) {
    tags.push({ label: 'Severidade: ' + activeSeverities.join(', '), type: 'severities' });
  }

  if (tags.length === 0) return '';

  html += '<div class="ap-active-filters">';
  tags.forEach(function(tag) {
    html += '<div class="ap-active-filter-tag">';
    html += '<span>' + escapeHtml(tag.label) + '</span>';
    html += '<button onclick="AlarmPanel.clearFilterTag(\'' + tag.type + '\')">&times;</button>';
    html += '</div>';
  });
  html += '</div>';

  return html;
}

function renderFilterModal() {
  var html = '<div class="ap-modal-backdrop" onclick="AlarmPanel.closeFilterModal()"></div>';
  html += '<div class="ap-filter-modal">';
  html += '<div class="ap-modal-header"><span class="ap-modal-title">Filtros Avançados</span>';
  html += '<button class="ap-modal-close" onclick="AlarmPanel.closeFilterModal()">×</button></div>';
  html += '<div class="ap-modal-body">';

  // Devices Section
  html += '<div class="ap-filter-section">';
  html += '<div class="ap-filter-section-title">Devices <span class="ap-select-all" onclick="AlarmPanel.selectAllDevices()">Selecionar todos</span> <span class="ap-select-all" onclick="AlarmPanel.clearAllDevices()">Limpar</span></div>';
  html += '<div class="ap-checkbox-list">';

  var filteredDevices = getFilteredDevices();
  filteredDevices.forEach(function(d) {
    var checked = state.filters.selectedDeviceIds.indexOf(d.id) !== -1 ? 'checked' : '';
    html += '<label class="ap-checkbox-item">';
    html += '<input type="checkbox" ' + checked + ' onchange="AlarmPanel.toggleDeviceFilter(\'' + d.id + '\')" />';
    html += '<span>' + escapeHtml(d.name) + '</span>';
    html += '</label>';
  });

  html += '</div>';
  html += '</div>';

  // Severity Section
  html += '<div class="ap-filter-section">';
  html += '<div class="ap-filter-section-title">Severidade</div>';
  html += '<div class="ap-checkbox-list" style="max-height: none;">';

  ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING'].forEach(function(sev) {
    var checked = state.filters.severities[sev] ? 'checked' : '';
    html += '<label class="ap-checkbox-item">';
    html += '<input type="checkbox" ' + checked + ' onchange="AlarmPanel.toggleSeverityFilter(\'' + sev + '\')" />';
    html += '<span class="ap-badge ' + getSeverityClass(sev) + '">' + sev + '</span>';
    html += '</label>';
  });

  html += '</div>';
  html += '</div>';

  html += '</div>';
  html += '<div class="ap-modal-footer">';
  html += '<button class="ap-btn ap-btn-secondary" onclick="AlarmPanel.resetFilters()" style="margin-right: 8px;">Resetar</button>';
  html += '<button class="ap-btn ap-btn-primary" onclick="AlarmPanel.closeFilterModal()">Aplicar</button>';
  html += '</div>';
  html += '</div>';

  return html;
}

function renderExportModal() {
  var html = '<div class="ap-modal-backdrop" onclick="AlarmPanel.closeExportModal()"></div>';
  html += '<div class="ap-export-modal">';
  html += '<div class="ap-modal-header"><span class="ap-modal-title">Exportar Relatório PDF</span>';
  html += '<button class="ap-modal-close" onclick="AlarmPanel.closeExportModal()">×</button></div>';
  html += '<div class="ap-modal-body">';

  if (state.exportGenerating) {
    html += '<div class="ap-export-generating">';
    html += '<div class="ap-spinner"></div>';
    html += '<span>Gerando PDF...</span>';
    html += '</div>';
  } else {
    html += '<p style="margin-bottom: 16px; color: #666;">Selecione o conteúdo do relatório:</p>';

    // Device Profiles option
    html += '<label class="ap-export-option' + (state.exportOptions.deviceProfiles ? ' selected' : '') + '" onclick="AlarmPanel.toggleExportOption(\'deviceProfiles\')">';
    html += '<input type="checkbox" ' + (state.exportOptions.deviceProfiles ? 'checked' : '') + ' />';
    html += '<div class="ap-export-option-content">';
    html += '<div class="ap-export-option-title">Device Profiles e Regras de Alarmes</div>';
    html += '<div class="ap-export-option-desc">Inclui: perfis, regras de criação/limpeza, agendamentos</div>';
    html += '</div></label>';

    // Device Map option
    html += '<label class="ap-export-option' + (state.exportOptions.deviceMap ? ' selected' : '') + '" onclick="AlarmPanel.toggleExportOption(\'deviceMap\')">';
    html += '<input type="checkbox" ' + (state.exportOptions.deviceMap ? 'checked' : '') + ' />';
    html += '<div class="ap-export-option-content">';
    html += '<div class="ap-export-option-title">Mapa de Devices</div>';
    html += '<div class="ap-export-option-desc">Tabela com devices, localização, severidade e status</div>';
    html += '</div></label>';

    // Alarm List option
    html += '<label class="ap-export-option' + (state.exportOptions.alarmList ? ' selected' : '') + '" onclick="AlarmPanel.toggleExportOption(\'alarmList\')">';
    html += '<input type="checkbox" ' + (state.exportOptions.alarmList ? 'checked' : '') + ' />';
    html += '<div class="ap-export-option-content">';
    html += '<div class="ap-export-option-title">Lista de Alarmes</div>';
    html += '<div class="ap-export-option-desc">Alarmes conforme filtros atuais (' + getFilteredAlarms().length + ' alarmes)</div>';
    html += '</div></label>';
  }

  html += '</div>';
  html += '<div class="ap-modal-footer">';
  if (!state.exportGenerating) {
    var hasSelection = state.exportOptions.deviceProfiles || state.exportOptions.deviceMap || state.exportOptions.alarmList;
    html += '<button class="ap-btn ap-btn-secondary" onclick="AlarmPanel.closeExportModal()" style="margin-right: 8px;">Cancelar</button>';
    html += '<button class="ap-btn ap-btn-export" onclick="AlarmPanel.generatePDF()"' + (hasSelection ? '' : ' disabled') + '>Gerar PDF</button>';
  }
  html += '</div>';
  html += '</div>';

  return html;
}

// ============================================================
// PDF GENERATION
// ============================================================
var pdfLibLoaded = false;

function loadPDFLibrary() {
  return new Promise(function(resolve, reject) {
    if (pdfLibLoaded && window.jspdf) {
      resolve();
      return;
    }

    var jspdfScript = document.createElement('script');
    jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    jspdfScript.onload = function() {
      var autoTableScript = document.createElement('script');
      autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js';
      autoTableScript.onload = function() {
        pdfLibLoaded = true;
        resolve();
      };
      autoTableScript.onerror = function() {
        reject(new Error('Falha ao carregar jspdf-autotable'));
      };
      document.head.appendChild(autoTableScript);
    };
    jspdfScript.onerror = function() {
      reject(new Error('Falha ao carregar jsPDF'));
    };
    document.head.appendChild(jspdfScript);
  });
}

function generatePDFDocument() {
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF('p', 'mm', 'a4');
  var pageWidth = doc.internal.pageSize.getWidth();
  var pageHeight = doc.internal.pageSize.getHeight();
  var margin = 15;
  var yPos = margin;

  // Helper function to check and add new page
  function checkNewPage(neededHeight) {
    if (yPos + neededHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  }

  // Header
  doc.setFillColor(25, 118, 210);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE ALARMES', pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), pageWidth / 2, 20, { align: 'center' });

  yPos = 35;
  doc.setTextColor(0, 0, 0);

  // Customer info
  if (state.customers.length > 0) {
    doc.setFontSize(11);
    doc.text('Cliente: ' + state.customers.map(function(c) { return c.name; }).join(', '), margin, yPos);
    yPos += 10;
  }

  // Section 1: Device Profiles
  if (state.exportOptions.deviceProfiles && state.profiles.length > 0) {
    checkNewPage(20);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DEVICE PROFILES E REGRAS DE ALARMES', margin + 2, yPos);
    yPos += 10;

    state.profiles.forEach(function(profile, idx) {
      checkNewPage(30);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 118, 210);
      doc.text((idx + 1) + '. ' + profile.name, margin, yPos);
      yPos += 6;

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Devices: ' + profile.deviceCount + ' | Regras: ' + (profile.alarmRules ? profile.alarmRules.length : 0), margin + 5, yPos);
      yPos += 6;

      // Alarm rules
      if (profile.alarmRules && profile.alarmRules.length > 0) {
        profile.alarmRules.forEach(function(rule, ruleIdx) {
          checkNewPage(20);

          doc.setTextColor(0, 0, 0);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('  [' + (ruleIdx + 1) + '] ' + rule.alarmType, margin + 5, yPos);
          yPos += 5;

          // Create rules
          if (rule.createRules) {
            Object.keys(rule.createRules).forEach(function(severity) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              var createRule = rule.createRules[severity];
              var conditionText = formatCondition(createRule.condition);
              var scheduleText = formatSchedule(createRule.schedule);

              doc.text('    Criação (' + severity + '): ' + conditionText.substring(0, 80), margin + 5, yPos);
              yPos += 4;
              if (conditionText.length > 80) {
                doc.text('      ' + conditionText.substring(80, 160), margin + 5, yPos);
                yPos += 4;
              }
              doc.text('    Agenda: ' + scheduleText.substring(0, 80), margin + 5, yPos);
              yPos += 4;
            });
          }

          // Clear rule
          doc.setFontSize(8);
          if (rule.clearRule && rule.clearRule.condition) {
            doc.text('    Clear: ' + formatCondition(rule.clearRule.condition).substring(0, 80), margin + 5, yPos);
          } else {
            doc.setTextColor(150, 150, 150);
            doc.text('    Clear: não configurado', margin + 5, yPos);
          }
          doc.setTextColor(0, 0, 0);
          yPos += 6;
        });
      }
      yPos += 4;
    });
  }

  // Section 2: Device Map
  if (state.exportOptions.deviceMap && state.devices.length > 0) {
    checkNewPage(30);
    yPos += 5;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('MAPA DE DEVICES', margin + 2, yPos);
    yPos += 10;

    var deviceData = getFilteredDevices().map(function(d) {
      var profileName = state.profiles.find(function(p) { return p.id === d.deviceProfileId; });
      return [
        d.name || '-',
        d.label || '-',
        profileName ? profileName.name.substring(0, 20) : '-',
        d.currentAlarmSeverity || 'NONE',
        d.alarmStatus || 'NORMAL'
      ];
    });

    doc.autoTable({
      startY: yPos,
      head: [['Device', 'Label', 'Perfil', 'Severidade', 'Status']],
      body: deviceData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [25, 118, 210], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 30 },
        2: { cellWidth: 40 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 }
      }
    });

    yPos = doc.lastAutoTable.finalY + 10;
  }

  // Section 3: Alarm List
  if (state.exportOptions.alarmList) {
    var alarms = getFilteredAlarms();
    if (alarms.length > 0) {
      checkNewPage(30);
      yPos += 5;
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('LISTA DE ALARMES (' + alarms.length + ')', margin + 2, yPos);
      yPos += 10;

      var alarmData = alarms.map(function(a, idx) {
        return [
          (idx + 1).toString(),
          a.originatorName || '-',
          (a.type || a.name || '-').substring(0, 30),
          a.severity || '-',
          a.status || '-',
          formatDate(a.startTs)
        ];
      });

      doc.autoTable({
        startY: yPos,
        head: [['#', 'Device', 'Tipo', 'Severidade', 'Status', 'Início']],
        body: alarmData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [25, 118, 210], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 35 },
          2: { cellWidth: 45 },
          3: { cellWidth: 22 },
          4: { cellWidth: 22 },
          5: { cellWidth: 35 }
        }
      });
    }
  }

  // Footer on each page
  var totalPages = doc.internal.getNumberOfPages();
  for (var i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Página ' + i + ' de ' + totalPages, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('Gerado por Alarm Profiles Panel', margin, pageHeight - 10);
  }

  // Generate filename
  var dateStr = new Date().toISOString().split('T')[0];
  var filename = 'relatorio-alarmes-' + dateStr + '.pdf';

  doc.save(filename);
}

function renderModal() {
  var p = state.activeProfile;
  var html = '<div class="ap-modal-backdrop" onclick="AlarmPanel.closeModal()"></div>';
  html += '<div class="ap-modal">';
  html += '<div class="ap-modal-header"><span class="ap-modal-title">' + escapeHtml(p.name) + '</span>';
  html += '<button class="ap-modal-close" onclick="AlarmPanel.closeModal()">×</button></div>';
  html += '<div class="ap-modal-body">';
  html += '<div class="ap-modal-section"><strong>ID:</strong> ' + p.id + '</div>';
  html += '<div class="ap-modal-section"><strong>Devices:</strong> ' + p.deviceCount + '</div>';
  if (p.ruleChainId)
    html += '<div class="ap-modal-section"><strong>Rule Chain:</strong> ' + p.ruleChainId + '</div>';
  if (p.description)
    html +=
      '<div class="ap-modal-section"><strong>Description:</strong> ' + escapeHtml(p.description) + '</div>';

  // Alarm Rules Section with Details
  html += '<div class="ap-modal-section">';
  html += '<div class="ap-alarm-rules-header"><strong>Regras de Alarme:</strong> ' + (p.alarmRules ? p.alarmRules.length : 0) + '</div>';
  html += renderAlarmRulesDetail(p.alarmRules);
  html += '</div>';

  html += '</div>';
  html +=
    '<div class="ap-modal-footer"><button class="ap-btn ap-btn-primary" onclick="AlarmPanel.closeModal()">Fechar</button></div>';
  html += '</div>';
  return html;
}

// ============================================================
// HELPERS
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(ts) {
  if (!ts) return '—';
  var d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function getSeverityClass(sev) {
  if (!sev) return 'ap-badge-none';
  var s = sev.toUpperCase();
  if (s === 'CRITICAL') return 'ap-badge-critical';
  if (s === 'MAJOR') return 'ap-badge-major';
  if (s === 'MINOR') return 'ap-badge-minor';
  if (s === 'WARNING') return 'ap-badge-warning';
  return 'ap-badge-none';
}

function getStatusClass(status) {
  if (!status) return 'ap-badge-none';
  var s = status.toUpperCase();
  if (s.indexOf('ACTIVE') >= 0) return 'ap-status-active';
  if (s.indexOf('CLEARED') >= 0) return 'ap-status-cleared';
  if (s.indexOf('ACK') >= 0) return 'ap-status-ack';
  return 'ap-badge-none';
}

// ============================================================
// ALARM RULE FORMATTING HELPERS
// ============================================================
function formatOperation(operation) {
  var ops = {
    EQUAL: 'igual a',
    NOT_EQUAL: 'diferente de',
    GREATER: 'maior que',
    LESS: 'menor que',
    GREATER_OR_EQUAL: 'maior ou igual a',
    LESS_OR_EQUAL: 'menor ou igual a',
    STARTS_WITH: 'começar com',
    ENDS_WITH: 'terminar com',
    CONTAINS: 'conter',
    NOT_CONTAINS: 'não conter',
  };
  return ops[operation] || operation;
}

function formatValueType(valueType) {
  var types = {
    NUMERIC: 'numérico',
    STRING: 'texto',
    BOOLEAN: 'booleano',
    DATE_TIME: 'data/hora',
  };
  return types[valueType] || valueType;
}

function formatKeyType(keyType) {
  var types = {
    TIME_SERIES: 'telemetria',
    ATTRIBUTE: 'atributo',
    ENTITY_FIELD: 'campo da entidade',
    CONSTANT: 'constante',
  };
  return types[keyType] || keyType;
}

function formatConditionValue(predicate) {
  if (!predicate || !predicate.value) return '(valor não definido)';

  var val = predicate.value;
  var dynamicValue = val.dynamicValue;
  var defaultValue = val.defaultValue;

  if (dynamicValue && dynamicValue.sourceAttribute) {
    var source = dynamicValue.sourceType === 'CURRENT_DEVICE' ? 'DEVICE' : dynamicValue.sourceType;
    return 'atributo "' + dynamicValue.sourceAttribute + '" do ' + source;
  }

  if (defaultValue !== null && defaultValue !== undefined) {
    if (typeof defaultValue === 'string') {
      return '"' + defaultValue + '"';
    }
    return String(defaultValue);
  }

  return '(valor não definido)';
}

function formatCondition(condition) {
  if (!condition || !condition.condition || !Array.isArray(condition.condition)) {
    return 'Condição não definida';
  }

  var parts = [];
  condition.condition.forEach(function (cond, idx) {
    var keyType = formatKeyType(cond.key ? cond.key.type : 'UNKNOWN');
    var keyName = cond.key ? cond.key.key : 'unknown';
    var operation = formatOperation(cond.predicate ? cond.predicate.operation : 'UNKNOWN');
    var value = formatConditionValue(cond.predicate);

    parts.push('Quando a ' + keyType + ' "' + keyName + '" for ' + operation + ' ' + value);
  });

  return parts.join(' E ');
}

function formatDayOfWeek(day) {
  var days = {
    1: 'Domingo',
    2: 'Segunda',
    3: 'Terça',
    4: 'Quarta',
    5: 'Quinta',
    6: 'Sexta',
    7: 'Sábado',
  };
  return days[day] || 'Dia ' + day;
}

function formatTimeFromMs(ms) {
  var totalMinutes = Math.floor(ms / 60000);
  var hours = Math.floor(totalMinutes / 60);
  var minutes = totalMinutes % 60;
  var period = hours >= 12 ? 'PM' : 'AM';
  var displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return String(displayHours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ' ' + period;
}

function formatSchedule(schedule) {
  if (!schedule) return 'Sem agenda definida';

  if (schedule.type === 'ANY_TIME') {
    return 'Ativo a qualquer momento';
  }

  if (schedule.type === 'SPECIFIC_TIME') {
    return 'Horário específico: ' + formatTimeFromMs(schedule.startsOn) + ' às ' + formatTimeFromMs(schedule.endsOn);
  }

  if (schedule.type === 'CUSTOM' && schedule.items && Array.isArray(schedule.items)) {
    var timezone = schedule.timezone || 'UTC';
    var activeDays = [];

    schedule.items.forEach(function (item) {
      if (item.enabled) {
        var day = formatDayOfWeek(item.dayOfWeek);
        var start = formatTimeFromMs(item.startsOn);
        var end = formatTimeFromMs(item.endsOn);
        activeDays.push(day + ' ' + start + ' - ' + end);
      }
    });

    if (activeDays.length === 0) return 'Agenda personalizada (nenhum dia ativo)';
    return 'Agenda: ' + timezone + ' | ' + activeDays.join(', ');
  }

  return 'Tipo de agenda: ' + schedule.type;
}

function renderAlarmRulesDetail(alarmRules) {
  if (!alarmRules || alarmRules.length === 0) {
    return '<div class="ap-alarm-rules-empty">Nenhuma regra de alarme configurada</div>';
  }

  var html = '<div class="ap-alarm-rules-list">';

  alarmRules.forEach(function (rule, ruleIdx) {
    var ruleNum = ruleIdx + 1;
    html += '<div class="ap-alarm-rule-item">';
    html += '<div class="ap-alarm-rule-title">[' + ruleNum + ' - ' + escapeHtml(rule.alarmType) + ']</div>';

    // Create Rules
    if (rule.createRules && Object.keys(rule.createRules).length > 0) {
      var severities = Object.keys(rule.createRules);
      severities.forEach(function (severity, sevIdx) {
        var createRule = rule.createRules[severity];
        var subNum = ruleNum + '.' + (sevIdx + 1);

        html += '<div class="ap-alarm-rule-create">';
        html += '<div class="ap-alarm-rule-severity">' + subNum + ' - Setup de Criação: <span class="ap-badge ' + getSeverityClass(severity) + '">' + severity + '</span></div>';

        // Condition
        if (createRule.condition) {
          html += '<div class="ap-alarm-rule-condition">' + subNum + '.1 - REGRA: ' + escapeHtml(formatCondition(createRule.condition)) + '</div>';

          // Default value
          if (createRule.condition.condition && createRule.condition.condition[0]) {
            var firstCond = createRule.condition.condition[0];
            if (firstCond.predicate && firstCond.predicate.value && firstCond.predicate.value.defaultValue !== null) {
              html += '<div class="ap-alarm-rule-default">' + subNum + '.2 - Valor padrão: ' + firstCond.predicate.value.defaultValue + '</div>';
            }
          }
        }

        // Schedule
        html += '<div class="ap-alarm-rule-schedule">' + subNum + '.' + (createRule.condition ? '3' : '2') + ' - ' + escapeHtml(formatSchedule(createRule.schedule)) + '</div>';

        html += '</div>';
      });
    } else {
      html += '<div class="ap-alarm-rule-nocreate">- Create: não configurado</div>';
    }

    // Clear Rule
    html += '<div class="ap-alarm-rule-clear">';
    if (rule.clearRule && rule.clearRule.condition) {
      html += '- Clear: ' + escapeHtml(formatCondition(rule.clearRule.condition));
      if (rule.clearRule.schedule) {
        html += ' | ' + escapeHtml(formatSchedule(rule.clearRule.schedule));
      }
    } else {
      html += '- Clear: não configurado';
    }
    html += '</div>';

    // Propagation
    if (rule.propagate || rule.propagateToOwner || rule.propagateToTenant) {
      html += '<div class="ap-alarm-rule-propagate">- Propagação: ';
      var props = [];
      if (rule.propagate) props.push('Geral');
      if (rule.propagateToOwner) props.push('Para Owner');
      if (rule.propagateToOwnerHierarchy) props.push('Hierarquia Owner');
      if (rule.propagateToTenant) props.push('Para Tenant');
      html += props.join(', ') + '</div>';
    }

    html += '</div>';
  });

  html += '</div>';
  return html;
}

function getFilteredDevices() {
  if (state.selectedProfileIds.length === 0) return state.devices;
  return state.devices.filter(function (d) {
    return state.selectedProfileIds.indexOf(d.deviceProfileId) !== -1;
  });
}

function getFilteredAlarms() {
  var deviceIds = {};
  if (state.selectedProfileIds.length > 0) {
    state.devices.forEach(function (d) {
      if (state.selectedProfileIds.indexOf(d.deviceProfileId) !== -1) {
        deviceIds[d.id] = true;
      }
    });
  }

  var searchText = (state.filters.searchText || '').toLowerCase().trim();

  return state.alarms.filter(function (a) {
    // Filter by selected profiles
    if (state.selectedProfileIds.length > 0 && !deviceIds[a.originatorId]) return false;

    // Filter by selected devices (from filter modal)
    if (state.filters.selectedDeviceIds.length > 0) {
      if (state.filters.selectedDeviceIds.indexOf(a.originatorId) === -1) return false;
    }

    // Filter by severity
    var sev = (a.severity || '').toUpperCase();
    if (sev && !state.filters.severities[sev]) return false;

    // Filter by status
    var st = (a.status || '').toUpperCase();
    var statusMatch = false;
    if (state.filters.statuses.ACTIVE && st.indexOf('ACTIVE') >= 0) statusMatch = true;
    if (state.filters.statuses.CLEARED && st.indexOf('CLEARED') >= 0) statusMatch = true;
    if (state.filters.statuses.ACKNOWLEDGED && st.indexOf('ACK') >= 0) statusMatch = true;
    if (!statusMatch) return false;

    // Filter by search text
    if (searchText) {
      var deviceName = (a.originatorName || '').toLowerCase();
      var alarmType = (a.type || a.name || '').toLowerCase();
      if (deviceName.indexOf(searchText) === -1 && alarmType.indexOf(searchText) === -1) {
        return false;
      }
    }

    return true;
  });
}

// ============================================================
// GLOBAL API (for onclick handlers)
// ============================================================
window.AlarmPanel = {
  toggleProfile: function (id) {
    var idx = state.selectedProfileIds.indexOf(id);
    if (idx === -1) state.selectedProfileIds.push(id);
    else state.selectedProfileIds.splice(idx, 1);
    render();
  },
  showProfile: function (id) {
    state.activeProfile = state.profiles.find(function (p) {
      return p.id === id;
    });
    state.showModal = true;
    render();
  },
  closeModal: function () {
    state.showModal = false;
    state.activeProfile = null;
    render();
  },
  setView: function (mode) {
    state.viewMode = mode;
    render();
  },
  toggleFilter: function (key) {
    state.filters.statuses[key] = !state.filters.statuses[key];
    render();
  },
  refresh: function () {
    state.loading = true;
    state.error = null;
    render();
    fetchAllData();
  },
  // Search functionality
  onSearchChange: function (event) {
    state.filters.searchText = event.target.value;
    render();
  },
  // Filter Modal
  openFilterModal: function () {
    state.showFilterModal = true;
    render();
  },
  closeFilterModal: function () {
    state.showFilterModal = false;
    render();
  },
  // Device filters
  toggleDeviceFilter: function (deviceId) {
    var idx = state.filters.selectedDeviceIds.indexOf(deviceId);
    if (idx === -1) {
      state.filters.selectedDeviceIds.push(deviceId);
    } else {
      state.filters.selectedDeviceIds.splice(idx, 1);
    }
    render();
  },
  selectAllDevices: function () {
    var filteredDevices = getFilteredDevices();
    state.filters.selectedDeviceIds = filteredDevices.map(function (d) {
      return d.id;
    });
    render();
  },
  clearAllDevices: function () {
    state.filters.selectedDeviceIds = [];
    render();
  },
  // Severity filters
  toggleSeverityFilter: function (severity) {
    state.filters.severities[severity] = !state.filters.severities[severity];
    render();
  },
  // Clear filter tags
  clearFilterTag: function (type) {
    if (type === 'devices') {
      state.filters.selectedDeviceIds = [];
    } else if (type === 'severities') {
      state.filters.severities = { CRITICAL: true, MAJOR: true, MINOR: true, WARNING: true };
    }
    render();
  },
  // Reset all filters
  resetFilters: function () {
    state.filters.searchText = '';
    state.filters.selectedDeviceIds = [];
    state.filters.severities = { CRITICAL: true, MAJOR: true, MINOR: true, WARNING: true };
    render();
  },
  // Export Modal
  openExportModal: function () {
    state.showExportModal = true;
    state.exportGenerating = false;
    render();
  },
  closeExportModal: function () {
    state.showExportModal = false;
    state.exportGenerating = false;
    render();
  },
  toggleExportOption: function (option) {
    state.exportOptions[option] = !state.exportOptions[option];
    render();
  },
  generatePDF: function () {
    state.exportGenerating = true;
    render();

    loadPDFLibrary()
      .then(function () {
        generatePDFDocument();
        state.exportGenerating = false;
        state.showExportModal = false;
        render();
        LogHelper.log('PDF gerado com sucesso');
      })
      .catch(function (err) {
        LogHelper.error('Erro ao gerar PDF:', err);
        state.exportGenerating = false;
        state.error = 'Erro ao gerar PDF: ' + err.message;
        render();
      });
  },
};

// ============================================================
// DATA FETCHING
// ============================================================
function fetchAllData() {
  LogHelper.log('fetchAllData started');

  var customerIds = state.customers.map(function (c) {
    return c.id;
  });
  var filteredDevices = [];

  fetchAllDevicesWithPagination(state.settings.api.devicesPageSize)
    .then(function (allDevices) {
      LogHelper.log('Devices fetched:', allDevices.length);

      filteredDevices = allDevices.filter(function (d) {
        return d.ownerId && customerIds.indexOf(d.ownerId) !== -1;
      });
      LogHelper.log('Filtered devices:', filteredDevices.length);

      var profileIds = [];
      filteredDevices.forEach(function (d) {
        if (d.deviceProfileId && profileIds.indexOf(d.deviceProfileId) === -1) {
          profileIds.push(d.deviceProfileId);
        }
      });

      return Promise.all(profileIds.map(fetchDeviceProfile));
    })
    .then(function (profiles) {
      profiles.forEach(function (p) {
        if (p && p.id && p.id.id) state.deviceProfiles[p.id.id] = p;
      });
      LogHelper.log('Profiles fetched:', Object.keys(state.deviceProfiles).length);

      return fetchAlarms(state.settings.api.alarmsPageSize);
    })
    .then(function (alarms) {
      LogHelper.log('Alarms fetched:', alarms.length);

      // Build profiles list
      state.profiles = [];
      Object.keys(state.deviceProfiles).forEach(function (id) {
        var p = state.deviceProfiles[id];
        state.profiles.push({
          id: id,
          name: p.name || 'Unknown',
          description: p.description || '',
          ruleChainId: p.defaultRuleChainId ? p.defaultRuleChainId.id : null,
          alarmRules: p.profileData && p.profileData.alarms ? p.profileData.alarms : [],
          deviceCount: filteredDevices.filter(function (d) {
            return d.deviceProfileId === id;
          }).length,
        });
      });

      state.devices = filteredDevices;
      state.alarms = alarms;
      state.loading = false;
      state.error = null;

      LogHelper.log(
        'Data loaded. Profiles:',
        state.profiles.length,
        'Devices:',
        state.devices.length,
        'Alarms:',
        state.alarms.length
      );
      render();
    })
    .catch(function (err) {
      LogHelper.error('Fetch error:', err);
      state.error = 'Error: ' + (err.message || 'Unknown');
      state.loading = false;
      render();
    });
}

function fetchAllDevicesWithPagination(pageSize) {
  var all = [];
  var ps = pageSize || 1000;

  function fetchPage(page) {
    var url =
      '/api/deviceInfos/all?pageSize=' +
      ps +
      '&page=' +
      page +
      '&includeCustomers=true&sortProperty=name&sortOrder=ASC';
    return ctx.http
      .get(url)
      .toPromise()
      .then(function (res) {
        var devices = (res.data || []).map(function (d) {
          return {
            id: d.id ? d.id.id : null,
            name: d.name || 'Unknown',
            label: d.label || '',
            ownerId: d.ownerId ? d.ownerId.id : null,
            deviceProfileId: d.deviceProfileId ? d.deviceProfileId.id : null,
            location: '',
            currentAlarmSeverity: null,
            alarmStatus: null,
            lastAlarmTs: null,
          };
        });
        all = all.concat(devices);
        if (res.hasNext) return fetchPage(page + 1);
        return all;
      });
  }

  return fetchPage(0);
}

function fetchDeviceProfile(profileId) {
  var url = '/api/deviceProfile/' + profileId + '?inlineImages=false';
  return ctx.http
    .get(url)
    .toPromise()
    .catch(function () {
      return null;
    });
}

function fetchAlarms(pageSize) {
  var statuses = [];
  if (state.filters.statuses.ACTIVE) statuses.push('ACTIVE');
  if (state.filters.statuses.CLEARED) statuses.push('CLEARED');
  if (state.filters.statuses.ACKNOWLEDGED) statuses.push('ACK');
  if (statuses.length === 0) statuses.push('ACTIVE');

  var url =
    '/api/v2/alarms?pageSize=' +
    (pageSize || 500) +
    '&page=0&sortProperty=createdTime&sortOrder=DESC&statusList=' +
    statuses.join(',');
  return ctx.http
    .get(url)
    .toPromise()
    .then(function (res) {
      return (res.data || []).map(function (a) {
        return {
          alarmId: a.id ? a.id.id : null,
          type: a.type || a.name || 'Unknown',
          name: a.name || a.type || 'Unknown',
          severity: a.severity || 'INDETERMINATE',
          status: a.cleared
            ? a.acknowledged
              ? 'CLEARED_ACK'
              : 'CLEARED'
            : a.acknowledged
            ? 'ACKNOWLEDGED'
            : 'ACTIVE',
          originatorId: a.originator ? a.originator.id : null,
          originatorName: a.originatorName || '',
          startTs: a.startTs,
        };
      });
    })
    .catch(function () {
      return [];
    });
}

function extractCustomers() {
  var customers = [];
  (ctx.datasources || []).forEach(function (ds) {
    var entity = ds.entity || {};
    if (entity.id && entity.id.entityType === 'CUSTOMER') {
      customers.push({ id: entity.id.id, name: entity.name || 'Unknown' });
    }
  });
  // Dedupe
  var seen = {};
  return customers.filter(function (c) {
    if (seen[c.id]) return false;
    seen[c.id] = true;
    return true;
  });
}

// ============================================================
// WIDGET LIFECYCLE
// ============================================================
self.onInit = function () {
  LogHelper.log('onInit');
  ctx = self.ctx;

  // Inject styles
  injectStyles();

  // Get root element
  rootEl = ctx.$container
    ? ctx.$container[0].querySelector('#alarm-panel-root')
    : document.querySelector('#alarm-panel-root');
  if (!rootEl) {
    LogHelper.error('Root element not found');
    return;
  }

  // Normalize settings
  var s = ctx.settings || {};
  if (s.appearance) {
    state.settings.appearance = Object.assign({}, state.settings.appearance, s.appearance);
  }
  if (s.api) {
    state.settings.api = Object.assign({}, state.settings.api, s.api);
  }

  // Extract customers
  state.customers = extractCustomers();
  LogHelper.log('Customers:', state.customers.length);

  if (state.customers.length === 0) {
    state.loading = false;
    state.error = 'No customers found. Configure a Customer entity datasource.';
    render();
    return;
  }

  // Initial render
  render();

  // Fetch data
  fetchAllData();
};

self.onDataUpdated = function () {
  LogHelper.log('onDataUpdated');
};

self.onDestroy = function () {
  LogHelper.log('onDestroy');
};

self.onResize = function () {
  // No-op
};
