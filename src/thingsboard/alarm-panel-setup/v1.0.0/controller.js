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
self.profiles = [];
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

  // Expose self to template via $scope
  $scope.self = self;

  // Initialize $scope properties for template binding (fallback)
  $scope.loading = true;
  $scope.error = null;
  $scope.profiles = [];
  $scope.devices = [];
  $scope.alarms = [];
  $scope.selectedProfileIds = [];
  $scope.viewMode = 'devices';
  $scope.filters = vm.filters;
  $scope.settings = null;

  // Expose ctx to template
  vm.ctx = ctx;

  vm.settings = normalizeSettings(ctx.settings || {});
  $scope.settings = vm.settings; // Sync to $scope
  LogHelper.log('Settings normalized:', vm.settings);

  // Data containers
  vm.customers = [];
  vm.devices = [];
  vm.deviceProfiles = {}; // { [profileId]: ProfileData }
  vm.profiles = []; // Profiles array for template binding
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

  // Extract customers from datasources (available at onInit)
  LogHelper.log('Extracting customers from ctx.datasources...');
  LogHelper.log('ctx.datasources:', ctx.datasources);

  vm.customers = extractCustomersFromDatasources(ctx);
  LogHelper.log('Customers extracted:', vm.customers.length, 'customer(s)');
  LogHelper.table(vm.customers, 'Customers');

  if (vm.customers.length === 0) {
    vm.loading = false;
    vm.error = 'No customers found in datasource. Please configure a Customer entity datasource.';
    LogHelper.warn('No customers found in datasource');
    if (ctx.detectChanges) ctx.detectChanges();
    return;
  }

  // Start API fetch chain
  LogHelper.log('Starting API fetch chain from onInit...');
  fetchAllData(vm, ctx);
  self.ctx.detectChanges();
};

self.onDataUpdated = function () {
  // No-op - all logic is handled in onInit
  self.ctx.detectChanges();
  LogHelper.log('onDataUpdated() called - ignored (using onInit approach)');
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

function extractCustomersFromDatasources(ctx) {
  LogHelper.log('extractCustomersFromDatasources() called');
  var customers = [];

  // Try to get from ctx.datasources first
  var datasources = ctx.datasources || [];
  LogHelper.log('ctx.datasources length:', datasources.length);

  datasources.forEach(function (ds, index) {
    LogHelper.log('Processing datasource', index, ':', ds);

    var entity = ds.entity || {};
    LogHelper.log('  entity:', entity);

    if (entity.id && entity.id.entityType === 'CUSTOMER') {
      LogHelper.log('  Found CUSTOMER:', entity.id.id);
      customers.push({
        id: entity.id.id,
        entityId: entity.id,
        name: entity.name || 'Unknown Customer',
        label: entity.label || '',
      });
    }
  });

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
  LogHelper.log('Customer IDs from datasource:', customerIds);

  // Reset data
  vm.devices = [];
  vm.deviceProfiles = {};
  vm.profiles = [];
  vm.alarms = [];

  // Fetch ALL devices with pagination, then filter by customer IDs
  LogHelper.log('Fetching ALL devices with pagination...');
  fetchAllDevicesWithPagination(ctx, vm.settings.api.devicesPageSize)
    .then(function (allDevices) {
      LogHelper.log('Total devices fetched from API:', allDevices.length);

      // Debug: Show unique owner IDs found in devices
      var uniqueOwnerIds = {};
      allDevices.forEach(function (d) {
        if (d.ownerId) {
          uniqueOwnerIds[d.ownerId] = (uniqueOwnerIds[d.ownerId] || 0) + 1;
        }
      });
      LogHelper.log('Unique owner IDs in devices:', Object.keys(uniqueOwnerIds).length);
      LogHelper.log('Looking for customer/owner IDs:', customerIds);

      // Check if our customer ID exists in any device's ownerId
      customerIds.forEach(function (cid) {
        var count = uniqueOwnerIds[cid] || 0;
        LogHelper.log('Owner', cid, '- devices found:', count);
      });

      // Filter by ownerId matching customer IDs from datasource
      vm.devices = allDevices.filter(function (device) {
        return device.ownerId && customerIds.indexOf(device.ownerId) !== -1;
      });
      LogHelper.log('Devices after filtering by owner IDs:', vm.devices.length);
      LogHelper.table(vm.devices.slice(0, 10), 'Filtered Devices (first 10)');

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

      // Build profiles array for template binding
      vm.profiles = getProfilesList();
      LogHelper.log('vm.profiles built:', vm.profiles.length);
      LogHelper.table(vm.profiles, 'Profiles list');

      // Set loading to false
      vm.loading = false;
      LogHelper.log('fetchAllData() completed successfully');
      LogHelper.log('vm.loading:', vm.loading);
      LogHelper.log('vm.devices.length:', vm.devices.length);
      LogHelper.log('vm.profiles.length:', vm.profiles.length);

      // Force update using ngZone
      updateView(ctx, 'Data loaded successfully');
    })
    .catch(function (error) {
      LogHelper.error('API fetch error:', error);
      vm.error = 'Error fetching data: ' + (error.message || error.statusText || 'Unknown error');
      vm.loading = false;
      updateView(ctx, 'Error occurred');
    });
}

function updateView(ctx, reason) {
  LogHelper.log('updateView() called - reason:', reason);
  LogHelper.log('self.loading:', self.loading, 'self.profiles.length:', self.profiles.length);

  var $scope = ctx.$scope;

  // Sync all properties to $scope
  function syncScope() {
    if ($scope) {
      $scope.self = self;
      $scope.loading = self.loading;
      $scope.error = self.error;
      $scope.profiles = self.profiles;
      $scope.devices = self.devices;
      $scope.alarms = self.alarms;
      $scope.selectedProfileIds = self.selectedProfileIds;
      $scope.viewMode = self.viewMode;
      $scope.filters = self.filters;
      $scope.settings = self.settings;
    }
  }

  syncScope();
  LogHelper.log('$scope synced - loading:', $scope ? $scope.loading : 'no $scope', 'profiles:', $scope && $scope.profiles ? $scope.profiles.length : 0);

  // Method 1: Use ngZone.run() for Angular change detection
  if (ctx.ngZone && ctx.ngZone.run) {
    ctx.ngZone.run(function() {
      LogHelper.log('ngZone.run() executing...');
      syncScope();
      if (ctx.detectChanges) {
        ctx.detectChanges();
        LogHelper.log('detectChanges inside ngZone.run()');
      }
    });
  }

  // Method 2: Direct detectChanges
  if (ctx.detectChanges) {
    ctx.detectChanges();
    LogHelper.log('detectChanges executed');
  }

  // Method 3: setTimeout with ngZone
  setTimeout(function() {
    LogHelper.log('setTimeout callback (50ms) executing...');
    syncScope();

    if (ctx.ngZone && ctx.ngZone.run) {
      ctx.ngZone.run(function() {
        if (ctx.detectChanges) {
          ctx.detectChanges();
          LogHelper.log('detectChanges inside ngZone.run() (setTimeout 50ms)');
        }
      });
    } else if (ctx.detectChanges) {
      ctx.detectChanges();
      LogHelper.log('detectChanges (setTimeout 50ms)');
    }
  }, 50);

  // Method 4: Longer delay fallback
  setTimeout(function() {
    LogHelper.log('setTimeout callback (300ms) executing...');
    syncScope();

    if (ctx.ngZone && ctx.ngZone.run) {
      ctx.ngZone.run(function() {
        if (ctx.detectChanges) {
          ctx.detectChanges();
          LogHelper.log('detectChanges inside ngZone.run() (setTimeout 300ms)');
        }
      });
    } else if (ctx.detectChanges) {
      ctx.detectChanges();
      LogHelper.log('detectChanges (setTimeout 300ms)');
    }
  }, 300);
}

function fetchAllDevicesWithPagination(ctx, pageSize) {
  var allDevices = [];
  var ps = pageSize || 300;

  function fetchPage(page) {
    var url =
      '/api/deviceInfos/all?pageSize=' +
      ps +
      '&page=' +
      page +
      '&includeCustomers=true&sortProperty=name&sortOrder=ASC';
    LogHelper.log('API GET:', url);

    return ctx.http
      .get(url)
      .toPromise()
      .then(function (response) {
        var devices = response.data || [];
        LogHelper.log('Page', page, '- devices received:', devices.length, '- hasNext:', response.hasNext);

        // Map to internal structure
        var mappedDevices = devices.map(function (device) {
          return {
            id: device.id ? device.id.id : null,
            entityId: device.id,
            name: device.name || 'Unknown Device',
            label: device.label || '',
            type: device.type || '',
            ownerName: device.ownerName || 'N/A',
            ownerId: device.ownerId ? device.ownerId.id : null,
            ownerType: device.ownerId ? device.ownerId.entityType : null,
            customerId: device.customerId ? device.customerId.id : null,
            deviceProfileId: device.deviceProfileId ? device.deviceProfileId.id : null,
            createdTime: device.createdTime,
            active: device.active || false,
            groups: device.groups || [],
          };
        });

        allDevices = allDevices.concat(mappedDevices);

        // Continue pagination if more pages
        if (response.hasNext) {
          return fetchPage(page + 1);
        }

        LogHelper.log('Pagination complete. Total devices:', allDevices.length);
        return allDevices;
      })
      .catch(function (error) {
        LogHelper.error('Error fetching devices page', page, ':', error);
        return allDevices; // Return what we have so far
      });
  }

  return fetchPage(0);
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
  var ctx = vm.ctx;
  var idx = vm.selectedProfileIds.indexOf(profileId);
  if (idx === -1) {
    vm.selectedProfileIds.push(profileId);
    LogHelper.log('Profile selected:', profileId, '- Total selected:', vm.selectedProfileIds.length);
  } else {
    vm.selectedProfileIds.splice(idx, 1);
    LogHelper.log('Profile deselected:', profileId, '- Total selected:', vm.selectedProfileIds.length);
  }
  if (ctx && ctx.detectChanges) {
    ctx.detectChanges();
  }
}

function isProfileSelected(profileId) {
  var vm = self;
  return vm.selectedProfileIds.indexOf(profileId) !== -1;
}

function setViewMode(mode) {
  var vm = self;
  var ctx = vm.ctx;
  if (mode === 'devices' || mode === 'alarms') {
    vm.viewMode = mode;
    LogHelper.log('View mode changed to:', mode);
    if (ctx && ctx.detectChanges) {
      ctx.detectChanges();
    }
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
  var ctx = vm.ctx;
  vm.activeProfileDetails = profile;
  vm.showProfileDetailsModal = true;
  if (ctx && ctx.detectChanges) {
    ctx.detectChanges();
  }
}

function closeProfileDetails() {
  var vm = self;
  var ctx = vm.ctx;
  vm.showProfileDetailsModal = false;
  vm.activeProfileDetails = null;
  if (ctx && ctx.detectChanges) {
    ctx.detectChanges();
  }
}

function toggleStatusFilter(statusKey) {
  var vm = self;
  var ctx = vm.ctx;
  if (!vm.filters.statuses) {
    vm.filters.statuses = {};
  }
  var current = !!vm.filters.statuses[statusKey];
  vm.filters.statuses[statusKey] = !current;
  if (ctx && ctx.detectChanges) {
    ctx.detectChanges();
  }
}

function onDateFilterChange() {
  var vm = self;
  var ctx = vm.ctx;
  if (ctx && ctx.detectChanges) {
    ctx.detectChanges();
  }
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
  updateView(ctx, 'Refresh started');

  fetchAllData(vm, ctx);
}
