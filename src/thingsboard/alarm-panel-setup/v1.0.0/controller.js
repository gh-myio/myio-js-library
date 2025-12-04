/* global self, window */
/* alarm-profiles-panel.js - API-Driven (RFC-0096) */

// Debug configuration - can be toggled at runtime via window.AlarmProfilesPanel.setDebug(true/false)
var DEBUG_ACTIVE = true;

// LogHelper utility
var LogHelper = {
  log: function () {
    if (DEBUG_ACTIVE) {
      console.log.apply(console, ['[AlarmProfilesPanel]'].concat(Array.prototype.slice.call(arguments)));
    }
  },
  warn: function () {
    if (DEBUG_ACTIVE) {
      console.warn.apply(console, ['[AlarmProfilesPanel]'].concat(Array.prototype.slice.call(arguments)));
    }
  },
  error: function () {
    // Errors always logged regardless of DEBUG_ACTIVE
    console.error.apply(console, ['[AlarmProfilesPanel]'].concat(Array.prototype.slice.call(arguments)));
  },
  table: function (data, label) {
    if (DEBUG_ACTIVE) {
      console.log('[AlarmProfilesPanel]', label || 'Table:');
      console.table(data);
    }
  },
};

// Expose debug toggle globally
if (typeof window !== 'undefined') {
  window.AlarmProfilesPanel = window.AlarmProfilesPanel || {};
  window.AlarmProfilesPanel.setDebug = function (enabled) {
    DEBUG_ACTIVE = !!enabled;
    console.log('[AlarmProfilesPanel] Debug mode:', DEBUG_ACTIVE ? 'ON' : 'OFF');
  };
  window.AlarmProfilesPanel.getDebug = function () {
    return DEBUG_ACTIVE;
  };
}

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
self.filters = {
  dateFromStr: null,
  dateToStr: null,
  statuses: { ACTIVE: true, CLEARED: false, ACKNOWLEDGED: false },
};

// Pre-bind methods (will be re-assigned in onInit)
self.toggleProfileSelection = function () {};
self.isProfileSelected = function () {
  return false;
};
self.setViewMode = function () {};
self.getDevicesForSelectedProfiles = function () {
  return [];
};
self.getFilteredAlarms = function () {
  return [];
};
self.openProfileDetails = function () {};
self.closeProfileDetails = function () {};
self.toggleStatusFilter = function () {};
self.onDateFilterChange = function () {};
self.getProfileDisplayName = function () {
  return '';
};
self.getProfileRuleChainLabel = function () {
  return '';
};
self.getSeverityBadgeClass = function () {
  return 'ap-badge-none';
};
self.getStatusBadgeClass = function () {
  return 'ap-status-normal';
};
self.refresh = function () {};
self.getProfilesList = function () {
  return [];
};

self.onInit = function () {
  LogHelper.log('onInit() called');

  var ctx = self.ctx;
  if (!ctx) {
    LogHelper.warn('onInit: ctx is undefined, aborting');
    return;
  }

  var $scope = ctx.$scope;
  if (!$scope) {
    LogHelper.warn('onInit: $scope is undefined, aborting');
    return;
  }

  var vm = self;
  $scope.vm = vm;

  // Expose ctx to template
  vm.ctx = ctx;

  vm.settings = normalizeSettings(ctx.settings || {});
  LogHelper.log('Settings normalized:', vm.settings);

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
  LogHelper.log('onDataUpdated() called');

  var ctx = self.ctx;
  if (!ctx) {
    LogHelper.warn('onDataUpdated: ctx is undefined, aborting');
    return;
  }

  var vm = self;
  if (!vm.settings) {
    LogHelper.warn('onDataUpdated: vm.settings is undefined, aborting');
    return;
  }

  vm.loading = true;
  vm.error = null;

  // Extract customers from datasource
  LogHelper.log('Extracting customers from datasource...');
  vm.customers = extractCustomersFromDatasource(ctx);
  LogHelper.log('Customers extracted:', vm.customers.length, 'customer(s)');
  LogHelper.table(vm.customers, 'Customers');

  if (vm.customers.length === 0) {
    vm.loading = false;
    vm.error = 'No customers found in datasource. Please configure a Customer entity datasource.';
    LogHelper.warn('No customers found in datasource');
    ctx.detectChanges();
    return;
  }

  // Start API fetch chain
  LogHelper.log('Starting API fetch chain...');
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
  LogHelper.log('extractCustomersFromDatasource() called');
  var customers = [];
  var data = ctx.data || [];

  LogHelper.log('ctx.data length:', data.length);
  LogHelper.log('ctx.data raw:', data);

  data.forEach(function (dsData, index) {
    LogHelper.log('Processing datasource item', index, ':', dsData);

    var ds = dsData.datasource || {};
    var entity = ds.entity || {};

    LogHelper.log('  datasource:', ds);
    LogHelper.log('  entity:', entity);

    if (entity.id && entity.id.entityType === 'CUSTOMER') {
      LogHelper.log('  Found CUSTOMER (structure 1):', entity.id.id);
      customers.push({
        id: entity.id.id,
        entityId: entity.id,
        name: entity.name || 'Unknown Customer',
        label: entity.label || '',
      });
    } else if (entity.id && entity.entityType === 'CUSTOMER') {
      // Alternative structure
      LogHelper.log('  Found CUSTOMER (structure 2):', entity.id);
      customers.push({
        id: entity.id,
        entityId: { entityType: 'CUSTOMER', id: entity.id },
        name: entity.name || 'Unknown Customer',
        label: entity.label || '',
      });
    } else {
      LogHelper.warn(
        '  Not a CUSTOMER entity, skipping. entityType:',
        entity.entityType || (entity.id && entity.id.entityType)
      );
    }
  });

  LogHelper.log('Customers before dedup:', customers.length);

  // Deduplicate by ID
  var seen = {};
  var result = customers.filter(function (c) {
    if (seen[c.id]) return false;
    seen[c.id] = true;
    return true;
  });

  LogHelper.log('Customers after dedup:', result.length);
  return result;
}

/* =========================
 * API Fetching
 * =======================*/

function fetchAllData(vm, ctx) {
  LogHelper.log('fetchAllData() started');

  var customerIds = vm.customers.map(function (c) {
    return c.id;
  });
  LogHelper.log('Customer IDs to fetch:', customerIds);

  // Reset data
  vm.devices = [];
  vm.deviceProfiles = {};
  vm.alarms = [];

  // Fetch devices for all customers
  LogHelper.log('Fetching devices for', customerIds.length, 'customer(s)...');
  var devicePromises = customerIds.map(function (customerId) {
    return fetchDevicesForCustomer(ctx, customerId, vm.settings.api.devicesPageSize);
  });

  Promise.all(devicePromises)
    .then(function (results) {
      // Flatten all devices
      results.forEach(function (devices) {
        vm.devices = vm.devices.concat(devices);
      });
      LogHelper.log('Total devices fetched:', vm.devices.length);
      LogHelper.table(vm.devices.slice(0, 10), 'Devices (first 10)');

      // Extract unique device profile IDs
      var profileIds = extractUniqueProfileIds(vm.devices);
      LogHelper.log('Unique device profile IDs:', profileIds.length, profileIds);

      // Fetch device profiles
      LogHelper.log('Fetching', profileIds.length, 'device profile(s)...');
      var profilePromises = profileIds.map(function (profileId) {
        return fetchDeviceProfile(ctx, profileId);
      });

      return Promise.all(profilePromises);
    })
    .then(function (profiles) {
      // Store profiles by ID
      var validProfiles = 0;
      profiles.forEach(function (profile) {
        if (profile && profile.id && profile.id.id) {
          vm.deviceProfiles[profile.id.id] = profile;
          validProfiles++;
        }
      });
      LogHelper.log('Device profiles stored:', validProfiles);
      LogHelper.log(
        'Profile names:',
        Object.keys(vm.deviceProfiles).map(function (id) {
          return vm.deviceProfiles[id].name;
        })
      );

      // Fetch alarms
      var statusList = getActiveStatusList(vm.filters);
      LogHelper.log('Fetching alarms with status:', statusList);
      return fetchAlarms(ctx, vm.settings.api.alarmsPageSize, statusList);
    })
    .then(function (alarms) {
      vm.alarms = alarms;
      LogHelper.log('Alarms fetched:', vm.alarms.length);
      LogHelper.table(vm.alarms.slice(0, 10), 'Alarms (first 10)');

      vm.loading = false;
      LogHelper.log('fetchAllData() completed successfully');
      ctx.detectChanges();
    })
    .catch(function (error) {
      LogHelper.error('API fetch error:', error);
      vm.error = 'Error fetching data: ' + (error.message || error.statusText || 'Unknown error');
      vm.loading = false;
      ctx.detectChanges();
    });
}

function fetchDevicesForCustomer(ctx, customerId, pageSize) {
  var url = '/api/customer/' + customerId + '/devices?pageSize=' + (pageSize || 1000) + '&page=0';
  LogHelper.log('API GET:', url);

  return ctx.http
    .get(url)
    .toPromise()
    .then(function (response) {
      var devices = response.data || [];
      LogHelper.log('Customer', customerId, '- devices received:', devices.length);

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
      LogHelper.error('Error fetching devices for customer', customerId, ':', error);
      return []; // Return empty array on error, don't fail entire chain
    });
}

function fetchDeviceProfile(ctx, profileId) {
  var url = '/api/deviceProfile/' + profileId + '?inlineImages=false';
  LogHelper.log('API GET:', url);

  return ctx.http
    .get(url)
    .toPromise()
    .then(function (response) {
      LogHelper.log('Profile', profileId, '- received:', response.name);
      var alarmCount =
        response.profileData && response.profileData.alarms ? response.profileData.alarms.length : 0;
      LogHelper.log('Profile', profileId, '- alarm rules:', alarmCount);
      return response;
    })
    .catch(function (error) {
      LogHelper.error('Error fetching device profile', profileId, ':', error);
      return null; // Return null on error
    });
}

function fetchAlarms(ctx, pageSize, statusList) {
  var url =
    '/api/v2/alarms?pageSize=' +
    (pageSize || 500) +
    '&page=0&sortProperty=createdTime&sortOrder=DESC&statusList=' +
    statusList;
  LogHelper.log('API GET:', url);

  return ctx.http
    .get(url)
    .toPromise()
    .then(function (response) {
      var alarms = response.data || [];
      LogHelper.log('Alarms received:', alarms.length, '- Total available:', response.totalElements);

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
      LogHelper.error('Error fetching alarms:', error);
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
    LogHelper.log('Profile selected:', profileId, '- Total selected:', vm.selectedProfileIds.length);
  } else {
    vm.selectedProfileIds.splice(idx, 1);
    LogHelper.log('Profile deselected:', profileId, '- Total selected:', vm.selectedProfileIds.length);
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
  return devices.filter(function (d) {
    return d.deviceProfileId === profileId;
  }).length;
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
    if (filters.statuses.CLEARED && (st === 'CLEARED' || st === 'CLEARED_ACK' || st === 'CLEARED_UNACK'))
      statusMatch = true;
    if (
      filters.statuses.ACKNOWLEDGED &&
      (st === 'ACKNOWLEDGED' || st === 'ACTIVE_ACK' || st === 'CLEARED_ACK')
    )
      statusMatch = true;

    if (
      !statusMatch &&
      (filters.statuses.ACTIVE || filters.statuses.CLEARED || filters.statuses.ACKNOWLEDGED)
    ) {
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
  if (st === 'CLEARED' || st === 'CLEARED_ACK' || st === 'CLEARED_UNACK')
    return vm.settings.statusStyle.clearedClass;
  if (st === 'ACKNOWLEDGED' || st === 'ACTIVE_ACK') return vm.settings.statusStyle.acknowledgedClass;

  return vm.settings.statusStyle.normalClass;
}

function refresh() {
  LogHelper.log('refresh() called - Manual refresh triggered');
  var vm = self;
  var ctx = vm.ctx;
  if (!ctx) {
    LogHelper.warn('refresh: ctx is undefined, aborting');
    return;
  }

  vm.loading = true;
  vm.error = null;
  ctx.detectChanges();

  fetchAllData(vm, ctx);
}
