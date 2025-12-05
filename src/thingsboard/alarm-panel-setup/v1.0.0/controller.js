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
  filters: { statuses: { ACTIVE: true, CLEARED: false, ACKNOWLEDGED: false } },
  showModal: false,
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
    .ap-grid { border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
    .ap-grid-header { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; background: #f5f5f5; padding: 10px; font-weight: bold; font-size: 12px; border-bottom: 1px solid #ddd; }
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
    .ap-alarm-card { border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 8px; }
    .ap-alarm-header { display: flex; justify-content: space-between; }
    .ap-alarm-device { font-weight: 500; }
    .ap-alarm-type { font-size: 12px; color: #666; }
    .ap-alarm-time { font-size: 11px; color: #999; }
    .ap-alarm-badges { display: flex; gap: 6px; margin-top: 4px; }
    .ap-filters { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
    .ap-filter-group { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .ap-filter-group label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
    .ap-modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; }
    .ap-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; width: 90%; max-width: 600px; max-height: 80vh; overflow: auto; z-index: 1001; }
    .ap-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #ddd; }
    .ap-modal-title { font-weight: bold; font-size: 16px; }
    .ap-modal-close { background: none; border: none; font-size: 20px; cursor: pointer; }
    .ap-modal-body { padding: 16px; }
    .ap-modal-section { margin-bottom: 16px; }
    .ap-modal-footer { padding: 16px; border-top: 1px solid #ddd; text-align: right; }
    .ap-empty { padding: 20px; text-align: center; color: #999; font-style: italic; }
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
    html += '<button class="ap-btn ap-btn-secondary" onclick="AlarmPanel.refresh()">Refresh</button>';
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

  // Modal
  if (state.showModal && state.activeProfile) {
    html += renderModal();
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
  return html;
}

function renderAlarms() {
  var alarms = getFilteredAlarms();
  var html = '<div class="ap-alarms-header"><span class="ap-section-title">Alarms</span>';
  html += '<span class="ap-count">' + alarms.length + ' alarm(s)</span></div>';

  // Filters
  html += '<div class="ap-filters">';
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
  html += '</div></div>';

  if (alarms.length === 0) {
    html += '<div class="ap-empty">No alarms found.</div>';
    return html;
  }

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

  return html;
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
  html +=
    '<div class="ap-modal-section"><strong>Alarm Rules:</strong> ' +
    (p.alarmRules ? p.alarmRules.length : 0) +
    '</div>';
  html += '</div>';
  html +=
    '<div class="ap-modal-footer"><button class="ap-btn ap-btn-primary" onclick="AlarmPanel.closeModal()">Close</button></div>';
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

  return state.alarms.filter(function (a) {
    if (state.selectedProfileIds.length > 0 && !deviceIds[a.originatorId]) return false;
    var st = (a.status || '').toUpperCase();
    if (state.filters.statuses.ACTIVE && st.indexOf('ACTIVE') >= 0) return true;
    if (state.filters.statuses.CLEARED && st.indexOf('CLEARED') >= 0) return true;
    if (state.filters.statuses.ACKNOWLEDGED && st.indexOf('ACK') >= 0) return true;
    return false;
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
