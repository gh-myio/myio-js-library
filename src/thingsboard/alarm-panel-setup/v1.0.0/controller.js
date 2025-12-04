/* global self */
/* alarm-profiles-panel.js - API-Driven (RFC-0096) */

// Pre-initialize to avoid undefined errors during widget validation
self.settings = null;
self.customers = [];
self.devices = [];
self.deviceProfiles = {};
self.alarms = [];
self.selectedProfileIds = [];
self.viewMode = 'devices';
self.loading = true;
self.error = null;
self.showProfileDetailsModal = false;
self.activeProfileDetails = null;
self.filters = { dateFromStr: null, dateToStr: null, statuses: { ACTIVE: true, CLEARED: false, ACKNOWLEDGED: false } };

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
self.getProfilesList = function () { return []; };

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
  vm.customers = [];
  vm.devices = [];
  vm.deviceProfiles = {}; // { [profileId]: ProfileData }
  vm.alarms = [];

  // UI state
  vm.loading = true;
  vm.error = null;

  vm.selectedProfileIds = [];
  vm.viewMode = 'devices'; // 'devices' | 'alarms'

  vm.filters = {
    dateFromStr: null,
    dateToStr: null,
    statuses: {
      ACTIVE: true,
      CLEARED: false,
      ACKNOWLEDGED: false,
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
  vm.getProfilesList = getProfilesList;
};

self.onDataUpdated = function () {
  var ctx = self.ctx;
  if (!ctx) return;

  var vm = self;
  if (!vm.settings) return;

  vm.loading = true;
  vm.error = null;

  // Extract customers from datasource
  vm.customers = extractCustomersFromDatasource(ctx);

  if (vm.customers.length === 0) {
    vm.loading = false;
    vm.error = 'No customers found in datasource. Please configure a Customer entity datasource.';
    ctx.detectChanges();
    return;
  }

  // Start API fetch chain
  fetchAllData(vm, ctx);
};

self.onDestroy = function () {
  // cleanup if needed
};

self.onResize = function () {
  // adjust layout if needed
};

/* =========================
 * Data Extraction
 * =======================*/

function extractCustomersFromDatasource(ctx) {
  var customers = [];
  var data = ctx.data || [];

  data.forEach(function (dsData) {
    var ds = dsData.datasource || {};
    var entity = ds.entity || {};

    if (entity.id && entity.id.entityType === 'CUSTOMER') {
      customers.push({
        id: entity.id.id,
        entityId: entity.id,
        name: entity.name || 'Unknown Customer',
        label: entity.label || '',
      });
    } else if (entity.id && entity.entityType === 'CUSTOMER') {
      // Alternative structure
      customers.push({
        id: entity.id,
        entityId: { entityType: 'CUSTOMER', id: entity.id },
        name: entity.name || 'Unknown Customer',
        label: entity.label || '',
      });
    }
  });

  // Deduplicate by ID
  var seen = {};
  return customers.filter(function (c) {
    if (seen[c.id]) return false;
    seen[c.id] = true;
    return true;
  });
}

/* =========================
 * API Fetching
 * =======================*/

function fetchAllData(vm, ctx) {
  var customerIds = vm.customers.map(function (c) { return c.id; });

  // Reset data
  vm.devices = [];
  vm.deviceProfiles = {};
  vm.alarms = [];

  // Fetch devices for all customers
  var devicePromises = customerIds.map(function (customerId) {
    return fetchDevicesForCustomer(ctx, customerId, vm.settings.api.devicesPageSize);
  });

  Promise.all(devicePromises)
    .then(function (results) {
      // Flatten all devices
      results.forEach(function (devices) {
        vm.devices = vm.devices.concat(devices);
      });

      // Extract unique device profile IDs
      var profileIds = extractUniqueProfileIds(vm.devices);

      // Fetch device profiles
      var profilePromises = profileIds.map(function (profileId) {
        return fetchDeviceProfile(ctx, profileId);
      });

      return Promise.all(profilePromises);
    })
    .then(function (profiles) {
      // Store profiles by ID
      profiles.forEach(function (profile) {
        if (profile && profile.id && profile.id.id) {
          vm.deviceProfiles[profile.id.id] = profile;
        }
      });

      // Fetch alarms
      return fetchAlarms(ctx, vm.settings.api.alarmsPageSize, getActiveStatusList(vm.filters));
    })
    .then(function (alarms) {
      vm.alarms = alarms;
      vm.loading = false;
      ctx.detectChanges();
    })
    .catch(function (error) {
      console.error('[AlarmProfilesPanel] API fetch error:', error);
      vm.error = 'Error fetching data: ' + (error.message || error.statusText || 'Unknown error');
      vm.loading = false;
      ctx.detectChanges();
    });
}

function fetchDevicesForCustomer(ctx, customerId, pageSize) {
  var url = '/api/customer/' + customerId + '/devices?pageSize=' + (pageSize || 1000) + '&page=0';

  return ctx.http.get(url).toPromise()
    .then(function (response) {
      var devices = response.data || [];

      // Map to internal structure
      return devices.map(function (device) {
        return {
          id: device.id ? device.id.id : null,
          entityId: device.id,
          name: device.name || 'Unknown Device',
          label: device.label || '',
          type: device.type || '',
          customerId: device.customerId ? device.customerId.id : null,
          deviceProfileId: device.deviceProfileId ? device.deviceProfileId.id : null,
          createdTime: device.createdTime,
        };
      });
    })
    .catch(function (error) {
      console.error('[AlarmProfilesPanel] Error fetching devices for customer ' + customerId + ':', error);
      return []; // Return empty array on error, don't fail entire chain
    });
}

function fetchDeviceProfile(ctx, profileId) {
  var url = '/api/deviceProfile/' + profileId + '?inlineImages=false';

  return ctx.http.get(url).toPromise()
    .then(function (response) {
      return response;
    })
    .catch(function (error) {
      console.error('[AlarmProfilesPanel] Error fetching device profile ' + profileId + ':', error);
      return null; // Return null on error
    });
}

function fetchAlarms(ctx, pageSize, statusList) {
  var url = '/api/v2/alarms?pageSize=' + (pageSize || 500) +
    '&page=0&sortProperty=createdTime&sortOrder=DESC&statusList=' + statusList;

  return ctx.http.get(url).toPromise()
    .then(function (response) {
      var alarms = response.data || [];

      // Map to internal structure
      return alarms.map(function (alarm) {
        return {
          alarmId: alarm.id ? alarm.id.id : null,
          entityId: alarm.id,
          type: alarm.type || alarm.name || 'Unknown Alarm',
          name: alarm.name || alarm.type || 'Unknown Alarm',
          severity: alarm.severity || 'INDETERMINATE',
          status: mapAlarmStatus(alarm),
          acknowledged: alarm.acknowledged || false,
          cleared: alarm.cleared || false,
          originatorId: alarm.originator ? alarm.originator.id : null,
          originatorType: alarm.originator ? alarm.originator.entityType : null,
          originatorName: alarm.originatorName || '',
          originatorLabel: alarm.originatorLabel || '',
          customerId: alarm.customerId ? alarm.customerId.id : null,
          startTs: alarm.startTs,
          endTs: alarm.endTs,
          ackTs: alarm.ackTs,
          clearTs: alarm.clearTs,
          details: alarm.details || {},
        };
      });
    })
    .catch(function (error) {
      console.error('[AlarmProfilesPanel] Error fetching alarms:', error);
      return []; // Return empty array on error
    });
}

function extractUniqueProfileIds(devices) {
  var ids = {};
  devices.forEach(function (device) {
    if (device.deviceProfileId) {
      ids[device.deviceProfileId] = true;
    }
  });
  return Object.keys(ids);
}

function getActiveStatusList(filters) {
  var statuses = [];
  if (filters.statuses.ACTIVE) statuses.push('ACTIVE');
  if (filters.statuses.CLEARED) statuses.push('CLEARED');
  if (filters.statuses.ACKNOWLEDGED) statuses.push('ACK');
  if (statuses.length === 0) statuses.push('ACTIVE'); // Default
  return statuses.join(',');
}

function mapAlarmStatus(alarm) {
  if (alarm.cleared) {
    return alarm.acknowledged ? 'CLEARED_ACK' : 'CLEARED';
  }
  return alarm.acknowledged ? 'ACKNOWLEDGED' : 'ACTIVE';
}

/* =========================
 * Settings Normalization
 * =======================*/

function normalizeSettings(settings) {
  settings = settings || {};
  var api = settings.api || {};
  var appearance = settings.appearance || {};
  var severityStyle = settings.severityStyle || {};
  var statusStyle = settings.statusStyle || {};

  return {
    api: {
      devicesPageSize: api.devicesPageSize || 1000,
      alarmsPageSize: api.alarmsPageSize || 500,
      defaultAlarmStatuses: api.defaultAlarmStatuses || 'ACTIVE',
    },
    appearance: {
      showHeader: appearance.showHeader !== false,
      headerTitle: appearance.headerTitle || 'Alarm Profiles Panel',
      compactMode: !!appearance.compactMode,
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

/* =========================
 * UI Methods
 * =======================*/

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

function getProfilesList() {
  var vm = self;
  var profiles = [];

  Object.keys(vm.deviceProfiles).forEach(function (profileId) {
    var profile = vm.deviceProfiles[profileId];
    if (profile) {
      profiles.push({
        id: profileId,
        name: profile.name || 'Unknown Profile',
        description: profile.description || '',
        ruleChainId: profile.defaultRuleChainId ? profile.defaultRuleChainId.id : null,
        alarmRules: profile.profileData && profile.profileData.alarms ? profile.profileData.alarms : [],
        deviceCount: countDevicesForProfile(vm.devices, profileId),
      });
    }
  });

  return profiles;
}

function countDevicesForProfile(devices, profileId) {
  return devices.filter(function (d) { return d.deviceProfileId === profileId; }).length;
}

function getDevicesForSelectedProfiles() {
  var vm = self;
  if (!vm.selectedProfileIds || vm.selectedProfileIds.length === 0) {
    return vm.devices; // Return all if none selected
  }

  return vm.devices.filter(function (device) {
    return vm.selectedProfileIds.indexOf(device.deviceProfileId) !== -1;
  });
}

function getFilteredAlarms() {
  var vm = self;
  var selectedProfiles = vm.selectedProfileIds || [];
  var filters = vm.filters || {};

  // Get device IDs for selected profiles
  var deviceIds = {};
  if (selectedProfiles.length > 0) {
    vm.devices.forEach(function (device) {
      if (selectedProfiles.indexOf(device.deviceProfileId) !== -1) {
        deviceIds[device.id] = true;
      }
    });
  }

  // Date boundaries
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
    // Filter by profile (via device)
    if (selectedProfiles.length > 0 && !deviceIds[alarm.originatorId]) {
      return false;
    }

    // Filter by status
    var st = (alarm.status || '').toUpperCase();
    var statusMatch = false;
    if (filters.statuses.ACTIVE && (st === 'ACTIVE' || st === 'ACTIVE_UNACK')) statusMatch = true;
    if (filters.statuses.CLEARED && (st === 'CLEARED' || st === 'CLEARED_ACK' || st === 'CLEARED_UNACK')) statusMatch = true;
    if (filters.statuses.ACKNOWLEDGED && (st === 'ACKNOWLEDGED' || st === 'ACTIVE_ACK' || st === 'CLEARED_ACK')) statusMatch = true;

    if (!statusMatch && (filters.statuses.ACTIVE || filters.statuses.CLEARED || filters.statuses.ACKNOWLEDGED)) {
      return false;
    }

    // Filter by date
    if (fromMs !== null && alarm.startTs && alarm.startTs < fromMs) {
      return false;
    }
    if (toMs !== null && alarm.startTs && alarm.startTs > toMs) {
      return false;
    }

    return true;
  });

  // Sort by timestamp desc
  result.sort(function (a, b) {
    var ta = a.startTs || 0;
    var tb = b.startTs || 0;
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
  // Placeholder for additional logic
}

function getProfileDisplayName(profile) {
  if (!profile) return '';
  return profile.name || '';
}

function getProfileRuleChainLabel(profile) {
  if (!profile) return '';
  if (profile.ruleChainId) {
    return 'Rule Chain: ' + profile.ruleChainId;
  }
  return '';
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
  if (sev === 'INDETERMINATE' || sev === 'INFO') return vm.settings.severityStyle.infoClass;

  return vm.settings.severityStyle.noneClass;
}

function getStatusBadgeClass(status) {
  var vm = self;
  if (!vm.settings || !vm.settings.statusStyle) {
    return 'ap-status-normal';
  }
  if (!status) return vm.settings.statusStyle.normalClass;

  var st = ('' + status).toUpperCase();
  if (st === 'ACTIVE' || st === 'ACTIVE_UNACK') return vm.settings.statusStyle.activeClass;
  if (st === 'CLEARED' || st === 'CLEARED_ACK' || st === 'CLEARED_UNACK') return vm.settings.statusStyle.clearedClass;
  if (st === 'ACKNOWLEDGED' || st === 'ACTIVE_ACK') return vm.settings.statusStyle.acknowledgedClass;

  return vm.settings.statusStyle.normalClass;
}

function refresh() {
  var vm = self;
  var ctx = vm.ctx;
  if (!ctx) return;

  vm.loading = true;
  vm.error = null;
  ctx.detectChanges();

  fetchAllData(vm, ctx);
}
