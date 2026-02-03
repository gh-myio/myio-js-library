/**
 * MAIN_BAS Controller
 * RFC-0158: Building Automation System (BAS) Dashboard Controller
 *
 * This widget serves as the unified controller for the BAS operational dashboard.
 * It delegates rendering to MyIOLibrary.createBASDashboard which handles:
 * - Water Infrastructure (Hydrometers, Cisterns, Tanks, Solenoids)
 * - HVAC Environments
 * - Pumps & Motors
 * - Daily Charts
 * - Floor-based filtering
 */

// Module-level references
let _basInstance = null;
let _ctx = null;
let _settings = null;

/**
 * Extract settings from widget configuration
 */
function getSettings(ctx) {
  const widgetSettings = ctx?.widget?.config?.settings || {};

  return {
    enableDebugMode: widgetSettings.enableDebugMode ?? false,
    defaultThemeMode: widgetSettings.defaultThemeMode ?? 'light',
    dashboardTitle: widgetSettings.dashboardTitle ?? 'DASHBOARD',
    floorsLabel: widgetSettings.floorsLabel ?? 'Andares',
    environmentsLabel: widgetSettings.environmentsLabel ?? 'Ambientes',
    pumpsMotorsLabel: widgetSettings.pumpsMotorsLabel ?? 'Bombas e Motores',
    temperatureChartTitle: widgetSettings.temperatureChartTitle ?? 'Temperatura do dia atual de todos os ambientes',
    consumptionChartTitle: widgetSettings.consumptionChartTitle ?? 'Consumo do dia atual de todos os ambientes',
    showFloorsSidebar: widgetSettings.showFloorsSidebar ?? true,
    showWaterInfrastructure: widgetSettings.showWaterInfrastructure ?? true,
    showEnvironments: widgetSettings.showEnvironments ?? true,
    showPumpsMotors: widgetSettings.showPumpsMotors ?? true,
    showCharts: widgetSettings.showCharts ?? true,
    primaryColor: widgetSettings.primaryColor ?? '#2F5848',
    warningColor: widgetSettings.warningColor ?? '#f57c00',
    errorColor: widgetSettings.errorColor ?? '#c62828',
    successColor: widgetSettings.successColor ?? '#2e7d32'
  };
}

/**
 * Parse datasource data into device arrays
 */
function parseDevicesFromData(data) {
  const waterDevices = [];
  const hvacDevices = [];
  const motorDevices = [];
  const floors = new Set();

  if (!data || !Array.isArray(data)) {
    return { waterDevices, hvacDevices, motorDevices, floors: [] };
  }

  data.forEach((row) => {
    const aliasName = row?.datasource?.aliasName || '';
    const entityId = row?.datasource?.entityId || '';
    const entityLabel = row?.datasource?.entityLabel || row?.datasource?.name || '';

    // Extract telemetry values
    const dataKeys = row?.data || {};
    const getValue = (key) => {
      const arr = dataKeys[key];
      if (Array.isArray(arr) && arr.length > 0) {
        return arr[arr.length - 1][1];
      }
      return null;
    };

    // Extract floor from device attributes or label
    const floor = getValue('floor') || extractFloorFromLabel(entityLabel);
    if (floor) floors.add(floor);

    // Classify device by alias or type
    if (aliasName.includes('hidrometro') || aliasName.includes('water_meter')) {
      waterDevices.push({
        id: entityId,
        name: entityLabel,
        type: 'hydrometer',
        floor: floor,
        value: parseFloat(getValue('consumption') || getValue('value') || 0),
        unit: 'm3',
        status: getValue('active') ? 'online' : 'offline',
        lastUpdate: Date.now()
      });
    } else if (aliasName.includes('cisterna') || aliasName.includes('cistern')) {
      waterDevices.push({
        id: entityId,
        name: entityLabel,
        type: 'cistern',
        floor: floor,
        value: parseFloat(getValue('level') || getValue('percentage') || 0),
        unit: '%',
        status: getValue('active') ? 'online' : 'offline',
        lastUpdate: Date.now()
      });
    } else if (aliasName.includes('caixa') || aliasName.includes('tank')) {
      waterDevices.push({
        id: entityId,
        name: entityLabel,
        type: 'tank',
        floor: floor,
        value: parseFloat(getValue('level') || getValue('percentage') || 0),
        unit: '%',
        status: getValue('active') ? 'online' : 'offline',
        lastUpdate: Date.now()
      });
    } else if (aliasName.includes('solenoide') || aliasName.includes('solenoid')) {
      const state = getValue('state') || getValue('status');
      waterDevices.push({
        id: entityId,
        name: entityLabel,
        type: 'solenoid',
        floor: floor,
        value: state === 'on' || state === true ? 1 : 0,
        unit: '',
        status: state === 'on' || state === true ? 'online' : 'offline',
        lastUpdate: Date.now()
      });
    } else if (aliasName.includes('hvac') || aliasName.includes('air') || aliasName.includes('ambiente')) {
      hvacDevices.push({
        id: entityId,
        name: entityLabel,
        floor: floor || 'N/A',
        temperature: parseFloat(getValue('temperature') || 0) || null,
        consumption: parseFloat(getValue('consumption') || getValue('power') || 0) || null,
        status: getValue('active') ? 'active' : 'inactive',
        setpoint: parseFloat(getValue('setpoint') || 0) || null
      });
    } else if (aliasName.includes('motor') || aliasName.includes('pump') || aliasName.includes('bomba')) {
      const consumption = parseFloat(getValue('consumption') || getValue('power') || 0);
      motorDevices.push({
        id: entityId,
        name: entityLabel,
        floor: floor,
        consumption: consumption,
        status: consumption > 0 ? 'running' : 'stopped',
        type: aliasName.includes('pump') || aliasName.includes('bomba') ? 'pump' : 'motor'
      });
    }
  });

  return {
    waterDevices,
    hvacDevices,
    motorDevices,
    floors: Array.from(floors).sort()
  };
}

/**
 * Extract floor number from device label
 */
function extractFloorFromLabel(label) {
  if (!label) return null;
  // Match patterns like "01", "1", "Andar 1", "Floor 1", etc.
  const match = label.match(/(\d+)|andar\s*(\d+)|floor\s*(\d+)/i);
  if (match) {
    return match[1] || match[2] || match[3];
  }
  return null;
}

/**
 * Show loading state
 */
function showLoading(container) {
  container.innerHTML = '<div class="bas-dashboard-loading"><div class="spinner"></div><span>Carregando dashboard...</span></div>';
}

/**
 * Show error state
 */
function showError(container, message) {
  container.innerHTML = '<div class="bas-dashboard-error"><div class="error-icon">!</div><div class="error-message">' + message + '</div></div>';
}

/**
 * Initialize the BAS dashboard
 */
async function initializeDashboard(ctx, container, settings) {
  try {
    // Check if MyIOLibrary is available
    if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.createBASDashboard) {
      throw new Error('MyIOLibrary.createBASDashboard nao esta disponivel. Verifique se a biblioteca foi carregada.');
    }

    // Parse initial data
    const devices = parseDevicesFromData(ctx.data);

    // Create the dashboard
    _basInstance = MyIOLibrary.createBASDashboard(container, {
      settings: settings,
      waterDevices: devices.waterDevices,
      hvacDevices: devices.hvacDevices,
      motorDevices: devices.motorDevices,
      floors: devices.floors,
      themeMode: settings.defaultThemeMode,
      onFloorSelect: function(floor) {
        if (settings.enableDebugMode) {
          console.log('[MAIN_BAS] Floor selected:', floor);
        }
        // Dispatch event for other widgets
        window.dispatchEvent(new CustomEvent('bas:floor-changed', {
          detail: { floor: floor }
        }));
      },
      onDeviceClick: function(device) {
        if (settings.enableDebugMode) {
          console.log('[MAIN_BAS] Device clicked:', device);
        }
        // Dispatch event for other widgets
        window.dispatchEvent(new CustomEvent('bas:device-clicked', {
          detail: { device: device }
        }));
      }
    });

    if (settings.enableDebugMode) {
      console.log('[MAIN_BAS] Dashboard initialized with:', {
        waterDevices: devices.waterDevices.length,
        hvacDevices: devices.hvacDevices.length,
        motorDevices: devices.motorDevices.length,
        floors: devices.floors
      });
    }

  } catch (error) {
    console.error('[MAIN_BAS] Error initializing dashboard:', error);
    showError(container, error.message);
  }
}

// ============================================================================
// ThingsBoard Widget Lifecycle
// ============================================================================

self.onInit = async function() {
  _ctx = self.ctx;
  _settings = getSettings(_ctx);

  var container = _ctx.$container[0].querySelector('#bas-dashboard-root');
  if (!container) {
    console.error('[MAIN_BAS] Container #bas-dashboard-root not found');
    return;
  }

  if (_settings.enableDebugMode) {
    console.log('[MAIN_BAS] onInit - Settings:', _settings);
  }

  // Show loading state
  showLoading(container);

  // Initialize dashboard
  await initializeDashboard(_ctx, container, _settings);
};

self.onDataUpdated = function() {
  if (!_basInstance || !_ctx) return;

  var devices = parseDevicesFromData(_ctx.data);

  if (_settings && _settings.enableDebugMode) {
    console.log('[MAIN_BAS] onDataUpdated - Devices:', {
      water: devices.waterDevices.length,
      hvac: devices.hvacDevices.length,
      motors: devices.motorDevices.length
    });
  }

  // Update the dashboard with new data
  if (_basInstance.updateData) {
    _basInstance.updateData({
      waterDevices: devices.waterDevices,
      hvacDevices: devices.hvacDevices,
      motorDevices: devices.motorDevices,
      floors: devices.floors
    });
  }
};

self.onResize = function() {
  if (_basInstance && _basInstance.resize) {
    _basInstance.resize();
  }
};

self.onDestroy = function() {
  if (_basInstance && _basInstance.destroy) {
    _basInstance.destroy();
  }
  _basInstance = null;
  _ctx = null;
  _settings = null;
};

self.typeParameters = function() {
  return {
    maxDatasources: -1,
    maxDataKeys: -1,
    singleEntity: false,
    hasDataPageLink: false,
    warnOnPageDataOverflow: false,
    dataKeysOptional: true
  };
};
