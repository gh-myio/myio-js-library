/* global self, window, document, Chart */
/* inventory-panel.js - Device Inventory Management Widget (RFC-0001) */

var DEBUG_ACTIVE = true;

var LogHelper = {
  log: function () {
    if (DEBUG_ACTIVE)
      console.log.apply(console, ['[InventoryPanel]'].concat(Array.prototype.slice.call(arguments)));
  },
  warn: function () {
    if (DEBUG_ACTIVE)
      console.warn.apply(console, ['[InventoryPanel]'].concat(Array.prototype.slice.call(arguments)));
  },
  error: function () {
    console.error.apply(console, ['[InventoryPanel]'].concat(Array.prototype.slice.call(arguments)));
  },
};

// ============================================================
// STATE
// ============================================================
var state = {
  loading: true,
  error: null,
  activeTab: 'devices', // 'devices' | 'dashboard'

  // Data
  devices: [],
  customers: [],
  deviceProfiles: [],

  // Devices Tab
  groupBy: 'customer', // 'customer' | 'type' | 'profile' | 'none'
  searchText: '',
  expandedGroups: {},
  selectedDeviceIds: [],

  // Filters (multiselect)
  filters: {
    status: [], // ['active', 'inactive'] - empty = all
    customers: [], // customer IDs - empty = all
    types: [], // device types - empty = all
  },
  showFilterDropdown: null, // 'status' | 'customers' | 'types' | null

  // Dashboard Stats
  stats: {
    total: 0,
    active: 0,
    inactive: 0,
    byCustomer: {},
    byType: {},
    byProfile: {},
  },

  // Export
  showExportModal: false,
  exportOptions: {
    includeInactive: true,
    format: 'csv',
  },
  exportGenerating: false,

  // Settings
  settings: {
    title: 'Inventory Panel',
    defaultTab: 'devices',
    defaultGroupBy: 'customer',
    pageSize: 1000,
    showExportButton: true,
    refreshInterval: 0,
  },
};

var rootEl = null;
var ctx = null;
var chartInstances = {};
var librariesLoaded = { chart: false, jspdf: false };

// ============================================================
// LIBRARY LOADING
// ============================================================
function loadScript(src, checkFn, name) {
  return new Promise(function (resolve, reject) {
    // Check if already loaded
    if (checkFn()) {
      LogHelper.log(name + ' already loaded');
      resolve();
      return;
    }

    // Check if script is already being loaded
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      // Wait for existing script to load
      var checkInterval = setInterval(function () {
        if (checkFn()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(function () {
        clearInterval(checkInterval);
        if (!checkFn()) {
          reject(new Error(name + ' load timeout'));
        }
      }, 5000);
      return;
    }

    var script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = function () {
      LogHelper.log(name + ' loaded successfully');
      resolve();
    };
    script.onerror = function () {
      LogHelper.error('Failed to load ' + name);
      reject(new Error('Failed to load ' + name));
    };
    document.head.appendChild(script);
  });
}

function loadChartJS() {
  if (librariesLoaded.chart) return Promise.resolve();

  return loadScript(
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    function () { return !!window.Chart; },
    'Chart.js'
  ).then(function () {
    librariesLoaded.chart = true;
  }).catch(function (err) {
    LogHelper.warn('Chart.js not available:', err.message);
  });
}

function loadJsPDF() {
  if (librariesLoaded.jspdf) return Promise.resolve();

  return loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    function () { return !!window.jspdf; },
    'jsPDF'
  ).then(function () {
    librariesLoaded.jspdf = true;
  }).catch(function (err) {
    LogHelper.warn('jsPDF not available:', err.message);
  });
}

function loadExternalLibraries() {
  return Promise.all([loadChartJS(), loadJsPDF()]);
}

// ============================================================
// CSS INJECTION
// ============================================================
function injectStyles() {
  if (document.getElementById('inventory-panel-styles')) return;

  var css = `
    .ip-root { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; padding: 16px; background: #f8fafc; min-height: 100%; }
    .ip-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
    .ip-title { margin: 0; font-size: 20px; font-weight: 600; color: #1e293b; }
    .ip-header-actions { display: flex; gap: 8px; }
    .ip-btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
    .ip-btn-primary { background: #3b82f6; color: white; }
    .ip-btn-primary:hover { background: #2563eb; }
    .ip-btn-secondary { background: #e2e8f0; color: #475569; }
    .ip-btn-secondary:hover { background: #cbd5e1; }
    .ip-btn-icon { padding: 8px; }

    /* Tabs */
    .ip-tabs { display: flex; gap: 4px; margin-bottom: 16px; background: #e2e8f0; padding: 4px; border-radius: 8px; width: fit-content; }
    .ip-tab { padding: 8px 20px; border: none; background: transparent; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; color: #64748b; transition: all 0.2s; }
    .ip-tab:hover { color: #1e293b; }
    .ip-tab.active { background: white; color: #1e293b; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    /* States */
    .ip-state { padding: 60px 40px; text-align: center; color: #64748b; }
    .ip-state-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
    .ip-error { color: #dc2626; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; }
    .ip-spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: ip-spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes ip-spin { to { transform: rotate(360deg); } }

    /* Devices Tab */
    .ip-toolbar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
    .ip-search { flex: 1; min-width: 200px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: white; }
    .ip-search:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .ip-select { padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: white; cursor: pointer; }
    .ip-select:focus { outline: none; border-color: #3b82f6; }

    /* Filter Dropdowns */
    .ip-filters-row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .ip-filter-wrapper { position: relative; }
    .ip-filter-btn { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; font-size: 13px; color: #475569; cursor: pointer; transition: all 0.2s; }
    .ip-filter-btn:hover { border-color: #cbd5e1; background: #f8fafc; }
    .ip-filter-btn.has-selection { border-color: #3b82f6; background: #eff6ff; color: #1d4ed8; }
    .ip-filter-btn .ip-filter-count { background: #3b82f6; color: white; font-size: 11px; padding: 1px 6px; border-radius: 10px; margin-left: 4px; }
    .ip-filter-dropdown { position: absolute; top: 100%; left: 0; margin-top: 4px; min-width: 220px; max-height: 300px; overflow-y: auto; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); z-index: 100; }
    .ip-filter-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    .ip-filter-title { font-weight: 600; font-size: 12px; color: #1e293b; }
    .ip-filter-clear { font-size: 11px; color: #3b82f6; cursor: pointer; background: none; border: none; }
    .ip-filter-clear:hover { text-decoration: underline; }
    .ip-filter-search { width: 100%; padding: 8px 12px; border: none; border-bottom: 1px solid #e2e8f0; font-size: 13px; outline: none; }
    .ip-filter-options { padding: 6px 0; }
    .ip-filter-option { display: flex; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer; transition: background 0.15s; }
    .ip-filter-option:hover { background: #f8fafc; }
    .ip-filter-checkbox { width: 16px; height: 16px; border: 2px solid #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; }
    .ip-filter-option.selected .ip-filter-checkbox { background: #3b82f6; border-color: #3b82f6; }
    .ip-filter-option.selected .ip-filter-checkbox::after { content: ''; width: 5px; height: 8px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); margin-bottom: 2px; }
    .ip-filter-label { font-size: 13px; color: #334155; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ip-filter-option-count { font-size: 11px; color: #94a3b8; }
    .ip-filter-empty { padding: 16px; text-align: center; color: #94a3b8; font-size: 13px; }
    .ip-filter-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99; }

    /* Tree View */
    .ip-tree { background: white; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .ip-tree-group { border-bottom: 1px solid #e2e8f0; }
    .ip-tree-group:last-child { border-bottom: none; }
    .ip-tree-header { display: flex; align-items: center; padding: 12px 16px; cursor: pointer; background: #f8fafc; transition: background 0.2s; }
    .ip-tree-header:hover { background: #f1f5f9; }
    .ip-tree-arrow { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; margin-right: 8px; transition: transform 0.2s; }
    .ip-tree-arrow.expanded { transform: rotate(90deg); }
    .ip-tree-label { font-weight: 500; color: #1e293b; flex: 1; }
    .ip-tree-count { font-size: 12px; color: #64748b; background: #e2e8f0; padding: 2px 8px; border-radius: 10px; }
    .ip-tree-items { display: none; }
    .ip-tree-items.expanded { display: block; }

    /* Device Row */
    .ip-device-row { display: flex; align-items: center; padding: 10px 16px 10px 44px; border-top: 1px solid #f1f5f9; transition: background 0.2s; }
    .ip-device-row:hover { background: #f8fafc; }
    .ip-device-status { width: 8px; height: 8px; border-radius: 50%; margin-right: 12px; }
    .ip-device-status.active { background: #22c55e; }
    .ip-device-status.inactive { background: #ef4444; }
    .ip-device-name { flex: 1; font-weight: 500; color: #1e293b; cursor: pointer; }
    .ip-device-name:hover { color: #3b82f6; }
    .ip-device-type { font-size: 12px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; margin-left: 12px; }
    .ip-device-customer { font-size: 12px; color: #64748b; margin-left: 12px; }

    /* Dashboard Tab */
    .ip-dashboard { display: grid; gap: 16px; }
    .ip-stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
    .ip-stat-card { background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; text-align: center; }
    .ip-stat-value { font-size: 32px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
    .ip-stat-value.active { color: #22c55e; }
    .ip-stat-value.inactive { color: #ef4444; }
    .ip-stat-label { font-size: 13px; color: #64748b; }

    .ip-charts-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .ip-chart-card { background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; }
    .ip-chart-title { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 16px; }
    .ip-chart-container { position: relative; height: 250px; }

    /* Export Modal */
    .ip-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .ip-modal { background: white; border-radius: 12px; padding: 24px; width: 400px; max-width: 90%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .ip-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .ip-modal-title { font-size: 18px; font-weight: 600; color: #1e293b; }
    .ip-modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; }
    .ip-modal-body { margin-bottom: 20px; }
    .ip-checkbox-group { display: flex; flex-direction: column; gap: 12px; }
    .ip-checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: #475569; }
    .ip-checkbox-label input { width: 16px; height: 16px; }
    .ip-modal-footer { display: flex; justify-content: flex-end; gap: 12px; }

    /* Flat List Mode */
    .ip-flat-list { background: white; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .ip-flat-header { display: grid; grid-template-columns: 40px 1fr 120px 150px 100px; padding: 12px 16px; background: #f8fafc; font-weight: 600; font-size: 12px; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
    .ip-flat-row { display: grid; grid-template-columns: 40px 1fr 120px 150px 100px; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; align-items: center; }
    .ip-flat-row:last-child { border-bottom: none; }
    .ip-flat-row:hover { background: #f8fafc; }

    /* Empty State */
    .ip-empty { padding: 60px 20px; text-align: center; color: #64748b; }
    .ip-empty-icon { font-size: 64px; margin-bottom: 16px; opacity: 0.3; }
    .ip-empty-text { font-size: 16px; margin-bottom: 8px; }
    .ip-empty-subtext { font-size: 13px; opacity: 0.7; }
  `;

  var style = document.createElement('style');
  style.id = 'inventory-panel-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

// ============================================================
// API FUNCTIONS (using ctx.http from ThingsBoard)
// ============================================================
function fetchAllDevices(pageSize) {
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
            id: d.id || { id: null, entityType: 'DEVICE' },
            name: d.name || 'Unknown',
            label: d.label || '',
            type: d.type || '',
            customerId: d.ownerId || d.customerId || null,
            customerTitle: d.ownerName || d.customerTitle || '',
            deviceProfileId: d.deviceProfileId || null,
            deviceProfileName: d.deviceProfileName || '',
            active: d.active !== false,
            createdTime: d.createdTime || 0,
            additionalInfo: d.additionalInfo || {},
          };
        });
        all = all.concat(devices);
        if (res.hasNext) return fetchPage(page + 1);
        LogHelper.log('Fetched', all.length, 'devices');
        return all;
      });
  }

  return fetchPage(0);
}

function fetchCustomers() {
  var url = '/api/customers?pageSize=1000&page=0&sortProperty=title&sortOrder=ASC';

  return ctx.http
    .get(url)
    .toPromise()
    .then(function (res) {
      var customers = res.data || [];
      LogHelper.log('Fetched', customers.length, 'customers');
      return customers;
    })
    .catch(function (err) {
      LogHelper.warn('Failed to fetch customers:', err);
      return [];
    });
}

function fetchDeviceProfiles() {
  var url = '/api/deviceProfiles?pageSize=1000&page=0&sortProperty=name&sortOrder=ASC';

  return ctx.http
    .get(url)
    .toPromise()
    .then(function (res) {
      var profiles = res.data || [];
      LogHelper.log('Fetched', profiles.length, 'device profiles');
      return profiles;
    })
    .catch(function (err) {
      LogHelper.warn('Failed to fetch device profiles:', err);
      return [];
    });
}

// ============================================================
// DATA PROCESSING
// ============================================================
function calculateStats(devices) {
  var stats = {
    total: devices.length,
    active: 0,
    inactive: 0,
    byCustomer: {},
    byType: {},
    byProfile: {},
  };

  devices.forEach(function (device) {
    // Active/Inactive
    if (device.active) {
      stats.active++;
    } else {
      stats.inactive++;
    }

    // By Customer
    var customerId = device.customerId?.id || 'unassigned';
    var customerName = device.customerTitle || 'Unassigned';
    if (!stats.byCustomer[customerId]) {
      stats.byCustomer[customerId] = { name: customerName, count: 0, active: 0 };
    }
    stats.byCustomer[customerId].count++;
    if (device.active) stats.byCustomer[customerId].active++;

    // By Type
    var type = device.type || 'Unknown';
    if (!stats.byType[type]) {
      stats.byType[type] = { count: 0, active: 0 };
    }
    stats.byType[type].count++;
    if (device.active) stats.byType[type].active++;

    // By Profile
    var profileId = device.deviceProfileId?.id || 'unknown';
    var profileName = device.deviceProfileName || 'Unknown';
    if (!stats.byProfile[profileId]) {
      stats.byProfile[profileId] = { name: profileName, count: 0, active: 0 };
    }
    stats.byProfile[profileId].count++;
    if (device.active) stats.byProfile[profileId].active++;
  });

  return stats;
}

function buildTreeData(devices, groupBy) {
  var groups = {};

  devices.forEach(function (device) {
    var key, label;

    switch (groupBy) {
      case 'customer':
        key = device.customerId?.id || 'unassigned';
        label = device.customerTitle || 'Unassigned';
        break;
      case 'type':
        key = device.type || 'unknown';
        label = device.type || 'Unknown';
        break;
      case 'profile':
        key = device.deviceProfileId?.id || 'unknown';
        label = device.deviceProfileName || 'Unknown';
        break;
      default:
        key = 'all';
        label = 'All Devices';
    }

    if (!groups[key]) {
      groups[key] = { key: key, label: label, devices: [] };
    }
    groups[key].devices.push(device);
  });

  // Sort groups by label
  var result = Object.values(groups).sort(function (a, b) {
    return a.label.localeCompare(b.label);
  });

  // Sort devices within each group
  result.forEach(function (group) {
    group.devices.sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });
  });

  return result;
}

function filterDevices(devices, searchText, filters) {
  var result = devices;

  // Filter by status
  if (filters && filters.status && filters.status.length > 0) {
    result = result.filter(function (device) {
      var deviceStatus = device.active ? 'active' : 'inactive';
      return filters.status.includes(deviceStatus);
    });
  }

  // Filter by customer
  if (filters && filters.customers && filters.customers.length > 0) {
    result = result.filter(function (device) {
      var customerId = device.customerId?.id || device.customerId || 'unassigned';
      return filters.customers.includes(customerId);
    });
  }

  // Filter by type
  if (filters && filters.types && filters.types.length > 0) {
    result = result.filter(function (device) {
      return filters.types.includes(device.type || 'Unknown');
    });
  }

  // Filter by search text
  if (searchText && searchText.trim()) {
    var search = searchText.toLowerCase().trim();
    result = result.filter(function (device) {
      return (
        (device.name || '').toLowerCase().includes(search) ||
        (device.type || '').toLowerCase().includes(search) ||
        (device.label || '').toLowerCase().includes(search) ||
        (device.customerTitle || '').toLowerCase().includes(search) ||
        (device.deviceProfileName || '').toLowerCase().includes(search)
      );
    });
  }

  return result;
}

// Get unique filter options from devices
function getFilterOptions(devices) {
  var customers = {};
  var types = {};

  devices.forEach(function (device) {
    // Customers
    var customerId = device.customerId?.id || device.customerId || 'unassigned';
    var customerName = device.customerTitle || 'Unassigned';
    if (!customers[customerId]) {
      customers[customerId] = { id: customerId, name: customerName, count: 0 };
    }
    customers[customerId].count++;

    // Types
    var type = device.type || 'Unknown';
    if (!types[type]) {
      types[type] = { id: type, name: type, count: 0 };
    }
    types[type].count++;
  });

  return {
    customers: Object.values(customers).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    }),
    types: Object.values(types).sort(function (a, b) {
      return b.count - a.count;
    }),
  };
}

// ============================================================
// EXPORT FUNCTIONS
// ============================================================
function exportToCSV(devices) {
  var headers = ['Name', 'Type', 'Profile', 'Customer', 'Status', 'Created'];
  var rows = devices.map(function (device) {
    return [
      device.name || '',
      device.type || '',
      device.deviceProfileName || '',
      device.customerTitle || '',
      device.active ? 'Active' : 'Inactive',
      device.createdTime ? new Date(device.createdTime).toLocaleDateString() : '',
    ];
  });

  var csvContent = [headers.join(',')].concat(
    rows.map(function (row) {
      return row.map(function (cell) {
        return '"' + String(cell).replace(/"/g, '""') + '"';
      }).join(',');
    })
  ).join('\n');

  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'device-inventory-' + new Date().toISOString().split('T')[0] + '.csv';
  link.click();
}

function exportToPDF(devices, stats) {
  function generatePDF() {
    var doc = new window.jspdf.jsPDF();
    var pageWidth = doc.internal.pageSize.width;
    var pageHeight = doc.internal.pageSize.height;

    // ========== PAGE 1: DASHBOARD ==========
    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('Device Inventory Report', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Generated: ' + new Date().toLocaleString(), pageWidth / 2, 32, { align: 'center' });

    var y = 55;
    doc.setTextColor(0, 0, 0);

    // Dashboard Title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Dashboard Overview', 14, y);
    doc.setFont(undefined, 'normal');
    y += 15;

    // Stats Cards Row
    var cardWidth = 42;
    var cardHeight = 25;
    var cardGap = 6;
    var startX = 14;

    // Card 1: Total
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(startX, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(String(stats.total), startX + cardWidth / 2, y + 12, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Total Devices', startX + cardWidth / 2, y + 20, { align: 'center' });

    // Card 2: Active
    var x2 = startX + cardWidth + cardGap;
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(x2, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text(String(stats.active), x2 + cardWidth / 2, y + 12, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Active', x2 + cardWidth / 2, y + 20, { align: 'center' });

    // Card 3: Inactive
    var x3 = x2 + cardWidth + cardGap;
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(x3, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text(String(stats.inactive), x3 + cardWidth / 2, y + 12, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Inactive', x3 + cardWidth / 2, y + 20, { align: 'center' });

    // Card 4: Customers
    var x4 = x3 + cardWidth + cardGap;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x4, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(String(Object.keys(stats.byCustomer).length), x4 + cardWidth / 2, y + 12, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Customers', x4 + cardWidth / 2, y + 20, { align: 'center' });

    y += cardHeight + 15;

    // Devices by Customer (Top 10)
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Devices by Customer (Top 10)', 14, y);
    doc.setFont(undefined, 'normal');
    y += 8;

    var customerData = Object.values(stats.byCustomer)
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 10);

    if (customerData.length > 0) {
      var maxCount = customerData[0].count;
      var barMaxWidth = 100;

      customerData.forEach(function (customer, index) {
        var barWidth = (customer.count / maxCount) * barMaxWidth;
        var rowY = y + (index * 8);

        // Customer name
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text((customer.name || 'Unknown').substring(0, 20), 16, rowY + 5);

        // Bar
        doc.setFillColor(59, 130, 246);
        doc.roundedRect(70, rowY + 1, barWidth, 5, 1, 1, 'F');

        // Count
        doc.setTextColor(100, 116, 139);
        doc.text(String(customer.count), 175, rowY + 5);
      });

      y += customerData.length * 8 + 10;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('No customer data available', 16, y + 5);
      y += 15;
    }

    // Devices by Type (Top 8)
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Devices by Type', 14, y);
    doc.setFont(undefined, 'normal');
    y += 8;

    var typeData = Object.entries(stats.byType)
      .sort(function (a, b) { return b[1].count - a[1].count; })
      .slice(0, 8);

    var typeColors = [
      [59, 130, 246], [34, 197, 94], [245, 158, 11], [239, 68, 68],
      [139, 92, 246], [236, 72, 153], [6, 182, 212], [132, 204, 22]
    ];

    if (typeData.length > 0) {
      typeData.forEach(function (typeEntry, index) {
        var rowY = y + (index * 8);
        var color = typeColors[index] || [100, 116, 139];

        // Color indicator
        doc.setFillColor(color[0], color[1], color[2]);
        doc.circle(20, rowY + 3, 2, 'F');

        // Type name
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text((typeEntry[0] || 'Unknown').substring(0, 25), 26, rowY + 5);

        // Count and percentage
        var percentage = ((typeEntry[1].count / stats.total) * 100).toFixed(1);
        doc.setTextColor(100, 116, 139);
        doc.text(typeEntry[1].count + ' (' + percentage + '%)', 140, rowY + 5);
      });

      y += typeData.length * 8 + 10;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('No type data available', 16, y + 5);
      y += 15;
    }

    // ========== PAGE 2+: DEVICE LIST ==========
    doc.addPage();

    // Page Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('Device List', pageWidth / 2, 16, { align: 'center' });

    y = 35;

    // Table Header
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(248, 250, 252);
    doc.rect(14, y - 5, pageWidth - 28, 10, 'F');
    doc.setTextColor(71, 85, 105);
    doc.text('Name', 16, y + 2);
    doc.text('Type', 75, y + 2);
    doc.text('Customer', 120, y + 2);
    doc.text('Status', 175, y + 2);
    doc.setFont(undefined, 'normal');
    y += 12;

    // Device Rows
    doc.setFontSize(8);
    devices.forEach(function (device, index) {
      if (y > pageHeight - 20) {
        doc.addPage();
        // Mini header for continuation
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text('Device List (continued)', 14, 10);
        y = 25;
        doc.setFontSize(8);
      }

      // Alternate row background
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(14, y - 4, pageWidth - 28, 7, 'F');
      }

      doc.setTextColor(30, 41, 59);
      doc.text((device.name || '').substring(0, 28), 16, y);
      doc.setTextColor(100, 116, 139);
      doc.text((device.type || '').substring(0, 18), 75, y);
      doc.text((device.customerTitle || '').substring(0, 22), 120, y);

      // Status with color
      if (device.active) {
        doc.setTextColor(34, 197, 94);
        doc.text('Active', 175, y);
      } else {
        doc.setTextColor(239, 68, 68);
        doc.text('Inactive', 175, y);
      }

      y += 7;
    });

    // Footer with total count
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Total: ' + devices.length + ' devices', 14, y);

    doc.save('device-inventory-' + new Date().toISOString().split('T')[0] + '.pdf');
    LogHelper.log('PDF exported successfully with', devices.length, 'devices');
  }

  if (!window.jspdf) {
    LogHelper.log('jsPDF not loaded, attempting to load...');
    loadJsPDF().then(function () {
      if (window.jspdf) {
        generatePDF();
      } else {
        alert('PDF library could not be loaded. Please try CSV export.');
      }
    }).catch(function () {
      alert('PDF library could not be loaded. Please try CSV export.');
    });
    return;
  }

  generatePDF();
}

// ============================================================
// CHART RENDERING
// ============================================================
function renderCharts() {
  if (state.activeTab !== 'dashboard') return;

  // Check if Chart.js is available
  if (!window.Chart) {
    LogHelper.warn('Chart.js not loaded - charts will not render');
    return;
  }

  // Use filtered stats if available, otherwise use global stats
  var stats = state._filteredStats || state.stats;

  LogHelper.log('Rendering charts...', {
    byCustomer: Object.keys(stats.byCustomer).length,
    byType: Object.keys(stats.byType).length,
    usingFiltered: !!state._filteredStats
  });

  // Destroy existing charts
  Object.values(chartInstances).forEach(function (chart) {
    if (chart) chart.destroy();
  });
  chartInstances = {};

  // Customer Chart
  var customerCanvas = rootEl.querySelector('#ip-chart-customers');
  LogHelper.log('Customer canvas found:', !!customerCanvas);

  if (customerCanvas) {
    var customerData = Object.values(stats.byCustomer)
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 10);

    LogHelper.log('Customer data for chart:', customerData.length, 'items');

    if (customerData.length > 0) {
      try {
        chartInstances.customers = new Chart(customerCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: customerData.map(function (c) { return (c.name || 'Unknown').substring(0, 15); }),
            datasets: [{
              label: 'Devices',
              data: customerData.map(function (c) { return c.count; }),
              backgroundColor: '#3b82f6',
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } },
          },
        });
        LogHelper.log('Customer chart created successfully');
      } catch (e) {
        LogHelper.error('Failed to create customer chart:', e);
      }
    } else {
      LogHelper.warn('No customer data available for chart');
    }
  }

  // Type Chart
  var typeCanvas = rootEl.querySelector('#ip-chart-types');
  LogHelper.log('Type canvas found:', !!typeCanvas);

  if (typeCanvas) {
    var typeData = Object.entries(stats.byType)
      .sort(function (a, b) { return b[1].count - a[1].count; })
      .slice(0, 8);

    LogHelper.log('Type data for chart:', typeData.length, 'items');

    if (typeData.length > 0) {
      var colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

      try {
        chartInstances.types = new Chart(typeCanvas.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: typeData.map(function (t) { return t[0] || 'Unknown'; }),
            datasets: [{
              data: typeData.map(function (t) { return t[1].count; }),
              backgroundColor: colors.slice(0, typeData.length),
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { boxWidth: 12 } },
            },
          },
        });
        LogHelper.log('Type chart created successfully');
      } catch (e) {
        LogHelper.error('Failed to create type chart:', e);
      }
    } else {
      LogHelper.warn('No type data available for chart');
    }
  }
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================
function render() {
  if (!rootEl) return;

  var html = '<div class="ip-root">';

  // Header
  html += '<div class="ip-header">';
  html += '<h2 class="ip-title">' + escapeHtml(state.settings.title) + '</h2>';
  html += '<div class="ip-header-actions">';
  if (state.settings.showExportButton) {
    html += '<button class="ip-btn ip-btn-secondary" onclick="window.ipExport()">Export</button>';
  }
  html += '<button class="ip-btn ip-btn-primary" onclick="window.ipRefresh()">Refresh</button>';
  html += '</div>';
  html += '</div>';

  // Tabs
  html += '<div class="ip-tabs">';
  html += '<button class="ip-tab' + (state.activeTab === 'devices' ? ' active' : '') + '" onclick="window.ipSetTab(\'devices\')">Devices</button>';
  html += '<button class="ip-tab' + (state.activeTab === 'dashboard' ? ' active' : '') + '" onclick="window.ipSetTab(\'dashboard\')">Dashboard</button>';
  html += '</div>';

  // Content
  if (state.loading) {
    html += renderLoading();
  } else if (state.error) {
    html += renderError();
  } else if (state.activeTab === 'devices') {
    html += renderDevicesTab();
  } else {
    html += renderDashboardTab();
  }

  // Export Modal
  if (state.showExportModal) {
    html += renderExportModal();
  }

  html += '</div>';

  rootEl.innerHTML = html;

  // Render charts after DOM update - use requestAnimationFrame for better timing
  if (state.activeTab === 'dashboard' && !state.loading) {
    requestAnimationFrame(function () {
      setTimeout(renderCharts, 50);
    });
  }
}

function renderLoading() {
  return '<div class="ip-state"><div class="ip-spinner"></div><div>Loading inventory data...</div></div>';
}

function renderError() {
  return '<div class="ip-state ip-error"><div class="ip-state-icon">!</div><div>' + escapeHtml(state.error) + '</div></div>';
}

function renderDevicesTab() {
  var filteredDevices = filterDevices(state.devices, state.searchText, state.filters);
  var filterOptions = getFilterOptions(state.devices);
  var html = '';

  // Backdrop for closing dropdowns
  if (state.showFilterDropdown) {
    html += '<div class="ip-filter-backdrop" onclick="window.ipCloseFilterDropdown()"></div>';
  }

  // Filters Row
  html += '<div class="ip-filters-row">';

  // Status Filter
  html += '<div class="ip-filter-wrapper">';
  html += '<button class="ip-filter-btn' + (state.filters.status.length > 0 ? ' has-selection' : '') + '" onclick="window.ipToggleFilterDropdown(\'status\')">';
  html += 'Status';
  if (state.filters.status.length > 0) {
    html += '<span class="ip-filter-count">' + state.filters.status.length + '</span>';
  }
  html += '</button>';
  if (state.showFilterDropdown === 'status') {
    html += renderStatusFilterDropdown();
  }
  html += '</div>';

  // Customer Filter
  html += '<div class="ip-filter-wrapper">';
  html += '<button class="ip-filter-btn' + (state.filters.customers.length > 0 ? ' has-selection' : '') + '" onclick="window.ipToggleFilterDropdown(\'customers\')">';
  html += 'Customer';
  if (state.filters.customers.length > 0) {
    html += '<span class="ip-filter-count">' + state.filters.customers.length + '</span>';
  }
  html += '</button>';
  if (state.showFilterDropdown === 'customers') {
    html += renderCustomerFilterDropdown(filterOptions.customers);
  }
  html += '</div>';

  // Type Filter
  html += '<div class="ip-filter-wrapper">';
  html += '<button class="ip-filter-btn' + (state.filters.types.length > 0 ? ' has-selection' : '') + '" onclick="window.ipToggleFilterDropdown(\'types\')">';
  html += 'Type';
  if (state.filters.types.length > 0) {
    html += '<span class="ip-filter-count">' + state.filters.types.length + '</span>';
  }
  html += '</button>';
  if (state.showFilterDropdown === 'types') {
    html += renderTypeFilterDropdown(filterOptions.types);
  }
  html += '</div>';

  // Clear all filters
  var hasAnyFilter = state.filters.status.length > 0 || state.filters.customers.length > 0 || state.filters.types.length > 0;
  if (hasAnyFilter) {
    html += '<button class="ip-btn ip-btn-secondary" onclick="window.ipClearAllFilters()" style="padding:8px 12px;font-size:12px;">Clear All</button>';
  }

  html += '</div>';

  // Toolbar
  html += '<div class="ip-toolbar">';
  html += '<input type="text" class="ip-search" placeholder="Search devices..." value="' + escapeHtml(state.searchText) + '" oninput="window.ipSearch(this.value)">';
  html += '<select class="ip-select" onchange="window.ipGroupBy(this.value)">';
  html += '<option value="customer"' + (state.groupBy === 'customer' ? ' selected' : '') + '>Group by Customer</option>';
  html += '<option value="type"' + (state.groupBy === 'type' ? ' selected' : '') + '>Group by Type</option>';
  html += '<option value="profile"' + (state.groupBy === 'profile' ? ' selected' : '') + '>Group by Profile</option>';
  html += '<option value="none"' + (state.groupBy === 'none' ? ' selected' : '') + '>No Grouping</option>';
  html += '</select>';
  html += '<span style="color:#64748b;font-size:13px;">' + filteredDevices.length + ' of ' + state.devices.length + ' devices</span>';
  html += '</div>';

  if (filteredDevices.length === 0) {
    html += '<div class="ip-empty"><div class="ip-empty-text">No devices found</div><div class="ip-empty-subtext">Try adjusting your filters or search criteria</div></div>';
    return html;
  }

  if (state.groupBy === 'none') {
    html += renderFlatList(filteredDevices);
  } else {
    html += renderTreeView(filteredDevices);
  }

  return html;
}

function renderStatusFilterDropdown() {
  var html = '<div class="ip-filter-dropdown" onclick="event.stopPropagation()">';
  html += '<div class="ip-filter-header"><span class="ip-filter-title">Filter by Status</span>';
  html += '<button class="ip-filter-clear" onclick="window.ipSelectAllFilter(\'status\')">Select All</button></div>';
  html += '<div class="ip-filter-options">';

  var statuses = [
    { id: 'active', name: 'Active', count: state.stats.active },
    { id: 'inactive', name: 'Inactive', count: state.stats.inactive }
  ];

  // Empty array = all selected (showing all)
  var isShowingAll = state.filters.status.length === 0;

  statuses.forEach(function (status) {
    // If filter is empty, all are selected; otherwise check if in array
    var isSelected = isShowingAll || state.filters.status.includes(status.id);
    html += '<div class="ip-filter-option' + (isSelected ? ' selected' : '') + '" onclick="window.ipToggleFilter(\'status\', \'' + status.id + '\', [\'active\', \'inactive\'])">';
    html += '<div class="ip-filter-checkbox"></div>';
    html += '<span class="ip-filter-label">' + escapeHtml(status.name) + '</span>';
    html += '<span class="ip-filter-option-count">' + status.count + '</span>';
    html += '</div>';
  });

  html += '</div></div>';
  return html;
}

function renderCustomerFilterDropdown(customers) {
  var html = '<div class="ip-filter-dropdown" onclick="event.stopPropagation()">';
  html += '<div class="ip-filter-header"><span class="ip-filter-title">Filter by Customer</span>';
  html += '<button class="ip-filter-clear" onclick="window.ipSelectAllFilter(\'customers\')">Select All</button></div>';
  html += '<div class="ip-filter-options">';

  if (customers.length === 0) {
    html += '<div class="ip-filter-empty">No customers found</div>';
  } else {
    // Empty array = all selected (showing all)
    var isShowingAll = state.filters.customers.length === 0;
    // Store all customer IDs for toggle logic
    var allCustomerIds = customers.map(function(c) { return c.id; });

    customers.forEach(function (customer) {
      var isSelected = isShowingAll || state.filters.customers.includes(customer.id);
      html += '<div class="ip-filter-option' + (isSelected ? ' selected' : '') + '" onclick="window.ipToggleFilter(\'customers\', \'' + escapeHtml(customer.id) + '\')">';
      html += '<div class="ip-filter-checkbox"></div>';
      html += '<span class="ip-filter-label">' + escapeHtml(customer.name) + '</span>';
      html += '<span class="ip-filter-option-count">' + customer.count + '</span>';
      html += '</div>';
    });
  }

  html += '</div></div>';
  return html;
}

function renderTypeFilterDropdown(types) {
  var html = '<div class="ip-filter-dropdown" onclick="event.stopPropagation()">';
  html += '<div class="ip-filter-header"><span class="ip-filter-title">Filter by Type</span>';
  html += '<button class="ip-filter-clear" onclick="window.ipSelectAllFilter(\'types\')">Select All</button></div>';
  html += '<div class="ip-filter-options">';

  if (types.length === 0) {
    html += '<div class="ip-filter-empty">No types found</div>';
  } else {
    // Empty array = all selected (showing all)
    var isShowingAll = state.filters.types.length === 0;

    types.forEach(function (type) {
      var isSelected = isShowingAll || state.filters.types.includes(type.id);
      html += '<div class="ip-filter-option' + (isSelected ? ' selected' : '') + '" onclick="window.ipToggleFilter(\'types\', \'' + escapeHtml(type.id) + '\')">';
      html += '<div class="ip-filter-checkbox"></div>';
      html += '<span class="ip-filter-label">' + escapeHtml(type.name) + '</span>';
      html += '<span class="ip-filter-option-count">' + type.count + '</span>';
      html += '</div>';
    });
  }

  html += '</div></div>';
  return html;
}

function renderTreeView(devices) {
  var tree = buildTreeData(devices, state.groupBy);
  var html = '<div class="ip-tree">';

  tree.forEach(function (group) {
    var isExpanded = state.expandedGroups[group.key];
    html += '<div class="ip-tree-group">';
    html += '<div class="ip-tree-header" onclick="window.ipToggleGroup(\'' + group.key + '\')">';
    html += '<div class="ip-tree-arrow' + (isExpanded ? ' expanded' : '') + '">▶</div>';
    html += '<div class="ip-tree-label">' + escapeHtml(group.label) + '</div>';
    html += '<div class="ip-tree-count">' + group.devices.length + '</div>';
    html += '</div>';
    html += '<div class="ip-tree-items' + (isExpanded ? ' expanded' : '') + '">';

    group.devices.forEach(function (device) {
      html += renderDeviceRow(device);
    });

    html += '</div>';
    html += '</div>';
  });

  html += '</div>';
  return html;
}

function renderFlatList(devices) {
  var html = '<div class="ip-flat-list">';
  html += '<div class="ip-flat-header">';
  html += '<div></div><div>Name</div><div>Type</div><div>Customer</div><div>Status</div>';
  html += '</div>';

  devices.forEach(function (device) {
    html += '<div class="ip-flat-row">';
    html += '<div><span class="ip-device-status ' + (device.active ? 'active' : 'inactive') + '"></span></div>';
    html += '<div class="ip-device-name" onclick="window.ipNavigateToDevice(\'' + device.id.id + '\')">' + escapeHtml(device.name || 'Unnamed') + '</div>';
    html += '<div class="ip-device-type">' + escapeHtml(device.type || '-') + '</div>';
    html += '<div>' + escapeHtml(device.customerTitle || '-') + '</div>';
    html += '<div>' + (device.active ? 'Active' : 'Inactive') + '</div>';
    html += '</div>';
  });

  html += '</div>';
  return html;
}

function renderDeviceRow(device) {
  var html = '<div class="ip-device-row">';
  html += '<span class="ip-device-status ' + (device.active ? 'active' : 'inactive') + '"></span>';
  html += '<span class="ip-device-name" onclick="window.ipNavigateToDevice(\'' + device.id.id + '\')">' + escapeHtml(device.name || 'Unnamed') + '</span>';
  html += '<span class="ip-device-type">' + escapeHtml(device.type || '') + '</span>';

  if (state.groupBy !== 'customer') {
    html += '<span class="ip-device-customer">' + escapeHtml(device.customerTitle || '') + '</span>';
  }

  html += '</div>';
  return html;
}

function renderDashboardTab() {
  var filteredDevices = filterDevices(state.devices, '', state.filters);
  var filteredStats = calculateStats(filteredDevices);
  var filterOptions = getFilterOptions(state.devices);
  var html = '';

  // Backdrop for closing dropdowns
  if (state.showFilterDropdown) {
    html += '<div class="ip-filter-backdrop" onclick="window.ipCloseFilterDropdown()"></div>';
  }

  html += '<div class="ip-dashboard">';

  // Filters Row (same as Devices tab)
  html += '<div class="ip-filters-row" style="margin-bottom:16px;">';

  // Status Filter
  html += '<div class="ip-filter-wrapper">';
  html += '<button class="ip-filter-btn' + (state.filters.status.length > 0 ? ' has-selection' : '') + '" onclick="window.ipToggleFilterDropdown(\'status\')">';
  html += 'Status';
  if (state.filters.status.length > 0) {
    html += '<span class="ip-filter-count">' + state.filters.status.length + '</span>';
  }
  html += '</button>';
  if (state.showFilterDropdown === 'status') {
    html += renderStatusFilterDropdown();
  }
  html += '</div>';

  // Customer Filter
  html += '<div class="ip-filter-wrapper">';
  html += '<button class="ip-filter-btn' + (state.filters.customers.length > 0 ? ' has-selection' : '') + '" onclick="window.ipToggleFilterDropdown(\'customers\')">';
  html += 'Customer';
  if (state.filters.customers.length > 0) {
    html += '<span class="ip-filter-count">' + state.filters.customers.length + '</span>';
  }
  html += '</button>';
  if (state.showFilterDropdown === 'customers') {
    html += renderCustomerFilterDropdown(filterOptions.customers);
  }
  html += '</div>';

  // Type Filter
  html += '<div class="ip-filter-wrapper">';
  html += '<button class="ip-filter-btn' + (state.filters.types.length > 0 ? ' has-selection' : '') + '" onclick="window.ipToggleFilterDropdown(\'types\')">';
  html += 'Type';
  if (state.filters.types.length > 0) {
    html += '<span class="ip-filter-count">' + state.filters.types.length + '</span>';
  }
  html += '</button>';
  if (state.showFilterDropdown === 'types') {
    html += renderTypeFilterDropdown(filterOptions.types);
  }
  html += '</div>';

  // Clear all filters
  var hasAnyFilter = state.filters.status.length > 0 || state.filters.customers.length > 0 || state.filters.types.length > 0;
  if (hasAnyFilter) {
    html += '<button class="ip-btn ip-btn-secondary" onclick="window.ipClearAllFilters()" style="padding:8px 12px;font-size:12px;">Clear All</button>';
    html += '<span style="color:#64748b;font-size:13px;margin-left:8px;">' + filteredDevices.length + ' of ' + state.devices.length + ' devices</span>';
  }

  html += '</div>';

  // Stats Cards (using filtered stats)
  html += '<div class="ip-stats-row">';
  html += '<div class="ip-stat-card"><div class="ip-stat-value">' + filteredStats.total + '</div><div class="ip-stat-label">Total Devices</div></div>';
  html += '<div class="ip-stat-card"><div class="ip-stat-value active">' + filteredStats.active + '</div><div class="ip-stat-label">Active</div></div>';
  html += '<div class="ip-stat-card"><div class="ip-stat-value inactive">' + filteredStats.inactive + '</div><div class="ip-stat-label">Inactive</div></div>';
  html += '<div class="ip-stat-card"><div class="ip-stat-value">' + Object.keys(filteredStats.byCustomer).length + '</div><div class="ip-stat-label">Customers</div></div>';
  html += '</div>';

  // Charts
  html += '<div class="ip-charts-row">';
  html += '<div class="ip-chart-card"><div class="ip-chart-title">Devices by Customer (Top 10)</div><div class="ip-chart-container"><canvas id="ip-chart-customers"></canvas></div></div>';
  html += '<div class="ip-chart-card"><div class="ip-chart-title">Devices by Type</div><div class="ip-chart-container"><canvas id="ip-chart-types"></canvas></div></div>';
  html += '</div>';

  // Export Buttons
  html += '<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px;">';
  html += '<button class="ip-btn ip-btn-secondary" onclick="window.ipExportCSV()">Export CSV</button>';
  html += '<button class="ip-btn ip-btn-secondary" onclick="window.ipExportPDF()">Export PDF</button>';
  html += '</div>';

  html += '</div>';

  // Store filtered stats for chart rendering
  state._filteredStats = filteredStats;

  return html;
}

function renderExportModal() {
  var html = '<div class="ip-modal-overlay" onclick="window.ipCloseExport()">';
  html += '<div class="ip-modal" onclick="event.stopPropagation()">';
  html += '<div class="ip-modal-header">';
  html += '<div class="ip-modal-title">Export Options</div>';
  html += '<button class="ip-modal-close" onclick="window.ipCloseExport()">&times;</button>';
  html += '</div>';
  html += '<div class="ip-modal-body">';
  html += '<div class="ip-checkbox-group">';
  html += '<label class="ip-checkbox-label"><input type="checkbox" ' + (state.exportOptions.includeInactive ? 'checked' : '') + ' onchange="window.ipToggleExportOption(\'includeInactive\')"> Include inactive devices</label>';
  html += '</div>';
  html += '<div style="margin-top:16px;">';
  html += '<label style="font-size:13px;color:#64748b;">Format:</label>';
  html += '<select class="ip-select" style="width:100%;margin-top:8px;" onchange="window.ipSetExportFormat(this.value)">';
  html += '<option value="csv"' + (state.exportOptions.format === 'csv' ? ' selected' : '') + '>CSV</option>';
  html += '<option value="pdf"' + (state.exportOptions.format === 'pdf' ? ' selected' : '') + '>PDF</option>';
  html += '</select>';
  html += '</div>';
  html += '</div>';
  html += '<div class="ip-modal-footer">';
  html += '<button class="ip-btn ip-btn-secondary" onclick="window.ipCloseExport()">Cancel</button>';
  html += '<button class="ip-btn ip-btn-primary" onclick="window.ipDoExport()">Export</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}

function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
// GLOBAL HANDLERS
// ============================================================
window.ipSetTab = function (tab) {
  state.activeTab = tab;
  render();
};

window.ipSearch = function (text) {
  state.searchText = text;
  render();
};

window.ipGroupBy = function (groupBy) {
  state.groupBy = groupBy;
  state.expandedGroups = {};
  render();
};

window.ipToggleGroup = function (key) {
  state.expandedGroups[key] = !state.expandedGroups[key];
  render();
};

window.ipNavigateToDevice = function (deviceId) {
  if (ctx && ctx.stateController) {
    ctx.stateController.openState('device', { id: deviceId, entityType: 'DEVICE' });
  } else {
    LogHelper.warn('Cannot navigate: state controller not available');
  }
};

window.ipRefresh = function () {
  loadData();
};

window.ipExport = function () {
  state.showExportModal = true;
  render();
};

window.ipCloseExport = function () {
  state.showExportModal = false;
  render();
};

window.ipToggleExportOption = function (option) {
  state.exportOptions[option] = !state.exportOptions[option];
  render();
};

window.ipSetExportFormat = function (format) {
  state.exportOptions.format = format;
  render();
};

window.ipDoExport = function () {
  var devices = state.devices;
  if (!state.exportOptions.includeInactive) {
    devices = devices.filter(function (d) { return d.active; });
  }

  if (state.exportOptions.format === 'csv') {
    exportToCSV(devices);
  } else {
    exportToPDF(devices, state.stats);
  }

  state.showExportModal = false;
  render();
};

window.ipExportCSV = function () {
  // Export filtered devices if filters are applied
  var devices = filterDevices(state.devices, '', state.filters);
  exportToCSV(devices);
};

window.ipExportPDF = function () {
  // Export filtered devices if filters are applied
  var devices = filterDevices(state.devices, '', state.filters);
  var stats = calculateStats(devices);
  exportToPDF(devices, stats);
};

// Filter Handlers
window.ipToggleFilterDropdown = function (type) {
  if (state.showFilterDropdown === type) {
    state.showFilterDropdown = null;
  } else {
    state.showFilterDropdown = type;
  }
  render();
};

window.ipCloseFilterDropdown = function () {
  state.showFilterDropdown = null;
  render();
};

// Get all available options for a filter type
function getAllFilterOptions(filterType) {
  if (filterType === 'status') {
    return ['active', 'inactive'];
  } else if (filterType === 'customers') {
    var customers = {};
    state.devices.forEach(function (device) {
      var customerId = device.customerId?.id || device.customerId || 'unassigned';
      customers[customerId] = true;
    });
    return Object.keys(customers);
  } else if (filterType === 'types') {
    var types = {};
    state.devices.forEach(function (device) {
      var type = device.type || 'Unknown';
      types[type] = true;
    });
    return Object.keys(types);
  }
  return [];
}

window.ipToggleFilter = function (filterType, value) {
  var filters = state.filters[filterType];

  // If filter is empty (showing all), clicking should DESELECT the clicked item
  // This means: populate with all items EXCEPT the clicked one
  if (filters.length === 0) {
    var allOptions = getAllFilterOptions(filterType);
    state.filters[filterType] = allOptions.filter(function (opt) {
      return opt !== value;
    });
  } else {
    // Normal toggle behavior
    var index = filters.indexOf(value);
    if (index === -1) {
      // Add to selection
      filters.push(value);
      // If all options are now selected, clear the array (show all)
      var allOptions = getAllFilterOptions(filterType);
      if (filters.length === allOptions.length) {
        state.filters[filterType] = [];
      }
    } else {
      // Remove from selection
      filters.splice(index, 1);
      // If nothing selected, this would show nothing - prevent this by showing all
      if (filters.length === 0) {
        // Keep at least one - don't allow empty selection after manual deselect
        // Actually, empty means "show all", so this case shouldn't happen
        // But if user deselects all, we should reset to "show all"
        state.filters[filterType] = [];
      }
    }
  }
  render();
};

// Select all = reset filter to empty (which means show all)
window.ipSelectAllFilter = function (filterType) {
  state.filters[filterType] = [];
  render();
};

window.ipClearFilter = function (filterType) {
  state.filters[filterType] = [];
  render();
};

window.ipClearAllFilters = function () {
  state.filters.status = [];
  state.filters.customers = [];
  state.filters.types = [];
  state.showFilterDropdown = null;
  render();
};

// ============================================================
// DATA LOADING
// ============================================================
async function loadData() {
  state.loading = true;
  state.error = null;
  render();

  try {
    // Load external libraries and data in parallel
    var results = await Promise.all([
      fetchAllDevices(state.settings.pageSize),
      fetchCustomers(),
      fetchDeviceProfiles(),
      loadExternalLibraries(), // Load Chart.js and jsPDF
    ]);

    state.devices = results[0];
    state.customers = results[1];
    state.deviceProfiles = results[2];
    state.stats = calculateStats(state.devices);
    state.loading = false;

    LogHelper.log('Data loaded:', state.devices.length, 'devices');
    LogHelper.log('Stats calculated:', {
      total: state.stats.total,
      active: state.stats.active,
      inactive: state.stats.inactive,
      customerCount: Object.keys(state.stats.byCustomer).length,
      typeCount: Object.keys(state.stats.byType).length
    });
  } catch (err) {
    LogHelper.error('Failed to load data:', err);
    state.error = 'Failed to load inventory data: ' + (err.message || 'Unknown error');
    state.loading = false;
  }

  render();
}

// ============================================================
// LIFECYCLE
// ============================================================
self.onInit = function () {
  LogHelper.log('Initializing Inventory Panel...');

  ctx = self.ctx;
  rootEl = ctx.$container[0];

  // Apply settings
  if (ctx.settings) {
    Object.assign(state.settings, ctx.settings);
  }
  state.activeTab = state.settings.defaultTab || 'devices';
  state.groupBy = state.settings.defaultGroupBy || 'customer';

  injectStyles();
  loadData();

  // Auto-refresh
  if (state.settings.refreshInterval > 0) {
    setInterval(loadData, state.settings.refreshInterval * 1000);
  }
};

self.onDataUpdated = function () {
  // Widget doesn't use datasources directly
};

self.onDestroy = function () {
  LogHelper.log('Destroying Inventory Panel...');
  Object.values(chartInstances).forEach(function (chart) {
    if (chart) chart.destroy();
  });
  chartInstances = {};
};
