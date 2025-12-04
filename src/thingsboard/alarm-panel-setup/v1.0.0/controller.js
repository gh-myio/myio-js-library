/* global self */
/* alarm-profiles-panel.js */

// Pre-initialize to avoid undefined errors during widget validation
self.settings = null;
self.profiles = [];
self.devicesByProfile = {};
self.alarms = [];
self.selectedProfileIds = [];
self.viewMode = 'devices';
self.loading = true;
self.error = null;
self.showProfileDetailsModal = false;
self.activeProfileDetails = null;
self.filters = { dateFromStr: null, dateToStr: null, statuses: {} };

// Pre-bind methods (will be re-assigned in onInit)
self.toggleProfileSelection = function () {};
self.isProfileSelected = function () { return false; };
self.setViewMode = function () {};
self.getDevicesForSelectedProfiles = function () { return []; };
self.getFilteredAlarms = function () { return []; };
self.openProfileDetails = function () {};
self.closeProfileDetails = function () {};
self.toggleStatusFilter = function () {};
self.onDateFilterChange = function () {};
self.getProfileDisplayName = function () { return ''; };
self.getProfileRuleChainLabel = function () { return ''; };
self.getSeverityBadgeClass = function () { return 'ap-badge-none'; };
self.getStatusBadgeClass = function () { return 'ap-status-normal'; };
self.refresh = function () {};

self.onInit = function () {
  var ctx = self.ctx;
  if (!ctx) return;

  var $scope = ctx.$scope;
  if (!$scope) return;

  var vm = self;
  $scope.vm = vm;

  // Expose ctx to template
  vm.ctx = ctx;

  vm.settings = normalizeSettings(ctx.settings || {});

  // Data containers
  vm.profiles = []; // [{ id, name, code, ruleChainName, ... }]
  vm.devicesByProfile = {}; // { [profileId]: [devices] }
  vm.alarms = []; // [{ alarmId, profileId, deviceId, ... }]

  // UI state
  vm.loading = true;
  vm.error = null;

  vm.selectedProfileIds = [];
  vm.viewMode = 'devices'; // 'devices' | 'alarms'

  vm.filters = {
    dateFromStr: null, // 'YYYY-MM-DD'
    dateToStr: null, // 'YYYY-MM-DD'
    statuses: {
      ACTIVE: true,
      CLEARED: true,
      ACKNOWLEDGED: true,
    },
  };

  // Profile details modal
  vm.showProfileDetailsModal = false;
  vm.activeProfileDetails = null;

  // Exposed methods
  vm.toggleProfileSelection = toggleProfileSelection;
  vm.isProfileSelected = isProfileSelected;
  vm.setViewMode = setViewMode;

  vm.getDevicesForSelectedProfiles = getDevicesForSelectedProfiles;
  vm.getFilteredAlarms = getFilteredAlarms;

  vm.openProfileDetails = openProfileDetails;
  vm.closeProfileDetails = closeProfileDetails;

  vm.toggleStatusFilter = toggleStatusFilter;
  vm.onDateFilterChange = onDateFilterChange;

  vm.getProfileDisplayName = getProfileDisplayName;
  vm.getProfileRuleChainLabel = getProfileRuleChainLabel;
  vm.getSeverityBadgeClass = getSeverityBadgeClass;
  vm.getStatusBadgeClass = getStatusBadgeClass;

  vm.refresh = refresh;
};

self.onDataUpdated = function () {
  var ctx = self.ctx;
  if (!ctx) return;

  var vm = self;
  if (!vm.settings) return;

  vm.loading = true;
  vm.error = null;

  vm.profiles = [];
  vm.devicesByProfile = {};
  vm.alarms = [];

  try {
    var data = ctx.data || [];

    data.forEach(function (dsData) {
      var dsIndex = dsData.datasourceIndex;
      var ds = dsData.datasource || {};
      var entity = ds.entity || {};
      var entityId = entity && entity.id ? entity.id : null;

      // Build key-value map from dataKeys
      var kv = {};
      (dsData.data || []).forEach(function (dk) {
        if (!dk || !dk.dataKey || !dk.dataKey.name) return;
        var key = dk.dataKey.name;
        var value = dk.data && dk.data.length ? dk.data[0][1] : null;
        kv[key] = value;
      });

      if (dsIndex === 0) {
        // DEVICE PROFILES
        var profileId = entityId || kv[vm.settings.profiles.profileIdKey];
        if (!profileId) return;

        var profile = {
          id: profileId,
          entityId: entityId,
          name: kv[vm.settings.profiles.profileNameKey] || entity.name || 'Unnamed profile',
          code: kv[vm.settings.profiles.profileCodeKey] || null,
          descriptionShort: kv[vm.settings.profiles.profileDescriptionShortKey] || '',
          descriptionLong: kv[vm.settings.profiles.profileDescriptionLongKey] || '',
          alarmRulesJson: parseJsonSafe(kv[vm.settings.profiles.alarmRulesKey]),
          ruleChainId: kv[vm.settings.profiles.ruleChainIdKey] || null,
          ruleChainName: kv[vm.settings.profiles.ruleChainNameKey] || '',
          rawKv: kv,
        };
        vm.profiles.push(profile);
      } else if (dsIndex === 1) {
        // DEVICES
        var deviceProfileId = kv[vm.settings.devices.deviceProfileIdKey] || null;
        if (!deviceProfileId) return;

        var device = {
          id: entityId,
          entityId: entityId,
          name: kv[vm.settings.devices.deviceNameKey] || entity.name,
          label: kv[vm.settings.devices.deviceLabelKey] || entity.label || '',
          location: kv[vm.settings.devices.locationKey] || '',
          currentAlarmSeverity: kv[vm.settings.devices.severityKey] || 'NONE',
          alarmStatus: kv[vm.settings.devices.statusKey] || 'NORMAL',
          lastAlarmTs: kv[vm.settings.devices.lastAlarmTsKey] || null,
          profileId: deviceProfileId,
          rawKv: kv,
        };

        if (!vm.devicesByProfile[deviceProfileId]) {
          vm.devicesByProfile[deviceProfileId] = [];
        }
        vm.devicesByProfile[deviceProfileId].push(device);
      } else if (dsIndex === 2) {
        // ALARMS
        var alarmProfileId =
          kv[vm.settings.alarms.profileIdKey] || kv[vm.settings.devices.deviceProfileIdKey] || null;
        if (!alarmProfileId) return;

        var alarmTsRaw = kv[vm.settings.alarms.alarmTsKey];
        var alarmTsMs = null;
        if (alarmTsRaw) {
          // try parse as number ms or ISO
          if (!isNaN(alarmTsRaw)) {
            alarmTsMs = Number(alarmTsRaw);
          } else {
            var parsed = Date.parse(alarmTsRaw);
            if (!isNaN(parsed)) {
              alarmTsMs = parsed;
            }
          }
        }

        var alarm = {
          alarmId: kv[vm.settings.alarms.alarmIdKey] || entityId || null,
          deviceId: kv[vm.settings.alarms.deviceIdKey] || null,
          deviceName: kv[vm.settings.alarms.deviceNameKey] || entity.name || '',
          profileId: alarmProfileId,
          profileName: kv[vm.settings.alarms.profileNameKey] || '',
          ruleChainName: kv[vm.settings.alarms.ruleChainNameKey] || '',
          alarmTsMs: alarmTsMs,
          alarmTsRaw: alarmTsRaw,
          status: kv[vm.settings.alarms.statusKey] || 'ACTIVE',
          severity: kv[vm.settings.alarms.severityKey] || 'NONE',
          ruleName: kv[vm.settings.alarms.ruleNameKey] || '',
          reason: kv[vm.settings.alarms.reasonKey] || '',
          rawKv: kv,
        };

        vm.alarms.push(alarm);
      }
    });

    vm.loading = false;
    self.ctx.detectChanges();
  } catch (e) {
    vm.error = 'Error while processing widget data: ' + e.message;
    vm.loading = false;
    console.error('[AlarmProfilesPanel] onDataUpdated error:', e);
    self.ctx.detectChanges();
  }
};

self.onDestroy = function () {
  // no-op for now
};

self.onResize = function () {
  // could be used to adjust layout if needed
};

/* =========================
 * Helpers & View-Model logic
 * =======================*/

function normalizeSettings(settings) {
  settings = settings || {};
  var appearance = settings.appearance || {};
  var profiles = settings.profiles || {};
  var devices = settings.devices || {};
  var alarms = settings.alarms || {};
  var severityStyle = settings.severityStyle || {};
  var statusStyle = settings.statusStyle || {};

  return {
    appearance: {
      showHeader: appearance.showHeader !== false,
      headerTitle: appearance.headerTitle || 'Alarm Profiles Panel',
      compactMode: !!appearance.compactMode,
    },
    profiles: {
      profileIdKey: profiles.profileIdKey || 'profileId',
      profileNameKey: profiles.profileNameKey || 'profileName',
      profileCodeKey: profiles.profileCodeKey || 'profileCode',
      profileDescriptionShortKey: profiles.profileDescriptionShortKey || 'profileDescriptionShort',
      profileDescriptionLongKey: profiles.profileDescriptionLongKey || 'profileDescriptionLong',
      alarmRulesKey: profiles.alarmRulesKey || 'alarmRules',
      ruleChainIdKey: profiles.ruleChainIdKey || 'ruleChainId',
      ruleChainNameKey: profiles.ruleChainNameKey || 'ruleChainName',
    },
    devices: {
      deviceProfileIdKey: devices.deviceProfileIdKey || 'deviceProfileId',
      deviceNameKey: devices.deviceNameKey || 'deviceName',
      deviceLabelKey: devices.deviceLabelKey || 'deviceLabel',
      locationKey: devices.locationKey || 'location',
      severityKey: devices.severityKey || 'currentAlarmSeverity',
      statusKey: devices.statusKey || 'alarmStatus',
      lastAlarmTsKey: devices.lastAlarmTsKey || 'lastAlarmTs',
    },
    alarms: {
      profileIdKey: alarms.profileIdKey || 'deviceProfileId',
      alarmIdKey: alarms.alarmIdKey || 'alarmId',
      deviceIdKey: alarms.deviceIdKey || 'deviceId',
      deviceNameKey: alarms.deviceNameKey || 'deviceName',
      profileNameKey: alarms.profileNameKey || 'deviceProfileName',
      ruleChainNameKey: alarms.ruleChainNameKey || 'ruleChainName',
      alarmTsKey: alarms.alarmTsKey || 'alarmTs',
      statusKey: alarms.statusKey || 'status',
      severityKey: alarms.severityKey || 'severity',
      ruleNameKey: alarms.ruleNameKey || 'ruleName',
      reasonKey: alarms.reasonKey || 'reason',
    },
    severityStyle: {
      criticalClass: severityStyle.criticalClass || 'ap-badge-critical',
      majorClass: severityStyle.majorClass || 'ap-badge-major',
      minorClass: severityStyle.minorClass || 'ap-badge-minor',
      warningClass: severityStyle.warningClass || 'ap-badge-warning',
      infoClass: severityStyle.infoClass || 'ap-badge-info',
      noneClass: severityStyle.noneClass || 'ap-badge-none',
    },
    statusStyle: {
      activeClass: statusStyle.activeClass || 'ap-status-active',
      clearedClass: statusStyle.clearedClass || 'ap-status-cleared',
      acknowledgedClass: statusStyle.acknowledgedClass || 'ap-status-ack',
      normalClass: statusStyle.normalClass || 'ap-status-normal',
    },
  };
}

function toggleProfileSelection(profileId) {
  var vm = self;
  var idx = vm.selectedProfileIds.indexOf(profileId);
  if (idx === -1) {
    vm.selectedProfileIds.push(profileId);
  } else {
    vm.selectedProfileIds.splice(idx, 1);
  }
}

function isProfileSelected(profileId) {
  var vm = self;
  return vm.selectedProfileIds.indexOf(profileId) !== -1;
}

function setViewMode(mode) {
  var vm = self;
  if (mode === 'devices' || mode === 'alarms') {
    vm.viewMode = mode;
  }
}

function getDevicesForSelectedProfiles() {
  var vm = self;
  var result = [];

  vm.selectedProfileIds.forEach(function (profileId) {
    var list = vm.devicesByProfile[profileId] || [];
    result = result.concat(list);
  });

  return result;
}

function getFilteredAlarms() {
  var vm = self;
  var selectedProfiles = vm.selectedProfileIds;
  var filters = vm.filters;
  var statuses = filters.statuses || {};

  // date boundaries
  var fromMs = null;
  var toMs = null;

  if (filters.dateFromStr) {
    var fromStr = filters.dateFromStr + 'T00:00:00';
    var parsedFrom = Date.parse(fromStr);
    if (!isNaN(parsedFrom)) {
      fromMs = parsedFrom;
    }
  }
  if (filters.dateToStr) {
    var toStr = filters.dateToStr + 'T23:59:59';
    var parsedTo = Date.parse(toStr);
    if (!isNaN(parsedTo)) {
      toMs = parsedTo;
    }
  }

  var result = vm.alarms.filter(function (alarm) {
    // filter by profile
    if (selectedProfiles.length > 0 && selectedProfiles.indexOf(alarm.profileId) === -1) {
      return false;
    }

    // filter by status
    var st = (alarm.status || '').toUpperCase();
    if (Object.keys(statuses).length > 0 && !statuses[st]) {
      return false;
    }

    // filter by date
    if (fromMs !== null && alarm.alarmTsMs !== null && alarm.alarmTsMs < fromMs) {
      return false;
    }
    if (toMs !== null && alarm.alarmTsMs !== null && alarm.alarmTsMs > toMs) {
      return false;
    }

    return true;
  });

  // sort by timestamp desc
  result.sort(function (a, b) {
    var ta = a.alarmTsMs || 0;
    var tb = b.alarmTsMs || 0;
    return tb - ta;
  });

  return result;
}

function openProfileDetails(profile) {
  var vm = self;
  vm.activeProfileDetails = profile;
  vm.showProfileDetailsModal = true;
}

function closeProfileDetails() {
  var vm = self;
  vm.showProfileDetailsModal = false;
  vm.activeProfileDetails = null;
}

function toggleStatusFilter(statusKey) {
  var vm = self;
  if (!vm.filters.statuses) {
    vm.filters.statuses = {};
  }
  var current = !!vm.filters.statuses[statusKey];
  vm.filters.statuses[statusKey] = !current;
}

function onDateFilterChange() {
  // placeholder in case we want extra logic on change
}

function getProfileDisplayName(profile) {
  if (!profile) return '';
  var base = profile.name || '';
  if (profile.code) {
    base += ' [' + profile.code + ']';
  }
  return base;
}

function getProfileRuleChainLabel(profile) {
  if (!profile || !profile.ruleChainName) return '';
  return profile.ruleChainName;
}

function getSeverityBadgeClass(severity) {
  var vm = self;
  if (!vm.settings || !vm.settings.severityStyle) {
    return 'ap-badge-none';
  }
  if (!severity) {
    return vm.settings.severityStyle.noneClass;
  }
  var sev = ('' + severity).toUpperCase();

  if (sev === 'CRITICAL') return vm.settings.severityStyle.criticalClass;
  if (sev === 'MAJOR') return vm.settings.severityStyle.majorClass;
  if (sev === 'MINOR') return vm.settings.severityStyle.minorClass;
  if (sev === 'WARNING') return vm.settings.severityStyle.warningClass;
  if (sev === 'INFO') return vm.settings.severityStyle.infoClass;

  return vm.settings.severityStyle.noneClass;
}

function getStatusBadgeClass(status) {
  var vm = self;
  if (!vm.settings || !vm.settings.statusStyle) {
    return 'ap-status-normal';
  }
  if (!status) return vm.settings.statusStyle.normalClass;

  var st = ('' + status).toUpperCase();
  if (st === 'ACTIVE') return vm.settings.statusStyle.activeClass;
  if (st === 'CLEARED') return vm.settings.statusStyle.clearedClass;
  if (st === 'ACKNOWLEDGED') return vm.settings.statusStyle.acknowledgedClass;

  return vm.settings.statusStyle.normalClass;
}

function parseJsonSafe(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

function refresh() {
  var vm = self;
  if (!vm || !vm.ctx) return;
  var ctx = vm.ctx;
  if (ctx.datasources && ctx.datasources.length > 0) {
    ctx.updateWidgetParams();
  }
}
