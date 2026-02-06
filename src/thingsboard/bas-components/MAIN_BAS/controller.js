/* global self, window, MyIOLibrary */
/**
 * MAIN_BAS Controller
 * RFC-0158: Building Automation System (BAS) Dashboard Controller
 *
 * Template layout (template.html) — CSS Grid 4 cols × 2 rows:
 *
 *   col:  20%          40%            20%           20%
 *  row 1  EntityList  | Water cards  | Ambientes   | Bombas e Motores
 *         50%h        | 50%h         | 100%h       | 100%h
 *  row 2  Chart (spans col 1–2)     | (continues) | (continues)
 *         50%h  60%w                 |             |
 *
 *   #bas-dashboard-root
 *     #bas-header
 *     .bas-content-layout (CSS Grid)
 *       #bas-sidebar-host    (col 1,   row 1)   ← EntityListPanel
 *       #bas-water-host      (col 2,   row 1)   ← CardGridPanel (water)
 *       #bas-charts-host     (col 1–2, row 2)   ← Tab bar + Consumption7DaysChart
 *       #bas-ambientes-host  (col 3,   row 1–2) ← CardGridPanel (HVAC)
 *       #bas-motors-host     (col 4,   row 1–2) ← CardGridPanel (motores)
 */

// Module-level references
let _floorListPanel = null;
let _waterPanel = null;
let _ambientesPanel = null;
let _motorsPanel = null;
let _chartInstance = null;
let _currentChartDomain = 'energy';
let _selectedFloor = null;
let _ctx = null;
let _settings = null;
let _currentFloors = [];
let _currentWaterDevices = [];
let _currentHVACDevices = [];
let _currentMotorDevices = [];

// Chart domain configuration
var CHART_DOMAIN_CONFIG = {
  energy: { unit: 'kWh', unitLarge: 'MWh', threshold: 10000, label: 'Energia' },
  water: { unit: 'L', unitLarge: 'm\u00B3', threshold: 1000, label: '\u00C1gua' },
  temperature: { unit: '\u00B0C', unitLarge: '\u00B0C', threshold: 999, label: 'Temperatura' },
};

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
    temperatureChartTitle:
      widgetSettings.temperatureChartTitle ?? 'Temperatura do dia atual de todos os ambientes',
    consumptionChartTitle:
      widgetSettings.consumptionChartTitle ?? 'Consumo do dia atual de todos os ambientes',
    showFloorsSidebar: widgetSettings.showFloorsSidebar ?? true,
    showWaterInfrastructure: widgetSettings.showWaterInfrastructure ?? true,
    showEnvironments: widgetSettings.showEnvironments ?? true,
    showPumpsMotors: widgetSettings.showPumpsMotors ?? true,
    showCharts: widgetSettings.showCharts ?? true,
    primaryColor: widgetSettings.primaryColor ?? '#2F5848',
    warningColor: widgetSettings.warningColor ?? '#f57c00',
    errorColor: widgetSettings.errorColor ?? '#c62828',
    successColor: widgetSettings.successColor ?? '#2e7d32',
    cardCustomStyle: widgetSettings.cardCustomStyle ?? undefined,
    sidebarBackgroundImage: widgetSettings.sidebarBackgroundImage ?? undefined,
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
        lastUpdate: Date.now(),
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
        lastUpdate: Date.now(),
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
        lastUpdate: Date.now(),
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
        lastUpdate: Date.now(),
      });
    } else if (aliasName.includes('hvac') || aliasName.includes('air') || aliasName.includes('ambiente')) {
      hvacDevices.push({
        id: entityId,
        name: entityLabel,
        floor: floor || 'N/A',
        temperature: parseFloat(getValue('temperature') || 0) || null,
        consumption: parseFloat(getValue('consumption') || getValue('power') || 0) || null,
        status: getValue('active') ? 'active' : 'inactive',
        setpoint: parseFloat(getValue('setpoint') || 0) || null,
      });
    } else if (aliasName.includes('motor') || aliasName.includes('pump') || aliasName.includes('bomba')) {
      const consumption = parseFloat(getValue('consumption') || getValue('power') || 0);
      motorDevices.push({
        id: entityId,
        name: entityLabel,
        floor: floor,
        consumption: consumption,
        status: consumption > 0 ? 'running' : 'stopped',
        type: aliasName.includes('pump') || aliasName.includes('bomba') ? 'pump' : 'motor',
      });
    }
  });

  return {
    waterDevices,
    hvacDevices,
    motorDevices,
    floors: Array.from(floors).sort(),
  };
}

/**
 * Extract floor number from device label
 */
function extractFloorFromLabel(label) {
  if (!label) return null;
  const match = label.match(/(\d+)|andar\s*(\d+)|floor\s*(\d+)/i);
  if (match) {
    return match[1] || match[2] || match[3];
  }
  return null;
}

/**
 * Build EntityListPanel items from floor strings
 */
function buildFloorItems(floors) {
  return floors.map(function (floor) {
    return { id: floor, label: floor + '\u00B0 andar' };
  });
}

// ============================================================================
// Water device type/status mappings
// ============================================================================

var WATER_TYPE_MAP = {
  hydrometer: 'HIDROMETRO',
  cistern: 'CAIXA_DAGUA',
  tank: 'TANK',
  solenoid: 'BOMBA_HIDRAULICA',
};

var WATER_STATUS_MAP = {
  online: 'online',
  offline: 'offline',
  unknown: 'no_info',
};

/**
 * Convert a water device to an entityObject for renderCardComponentV6
 */
function waterDeviceToEntityObject(device) {
  var deviceType = WATER_TYPE_MAP[device.type] || 'HIDROMETRO';
  var deviceStatus = WATER_STATUS_MAP[device.status] || 'no_info';

  return {
    entityId: device.id,
    labelOrName: device.name,
    deviceIdentifier: device.id,
    deviceType: deviceType,
    val: device.value,
    deviceStatus: deviceStatus,
    perc: 0,
    waterLevel: device.type === 'tank' ? device.value : undefined,
    waterPercentage: device.type === 'tank' ? device.value / 100 : undefined,
  };
}

/**
 * Build CardGridPanel items from water devices
 */
function buildWaterCardItems(waterDevices, selectedFloor) {
  var filtered = waterDevices;
  if (selectedFloor) {
    filtered = waterDevices.filter(function (d) {
      return d.floor === selectedFloor;
    });
  }

  return filtered.map(function (device) {
    return {
      id: device.id,
      entityObject: waterDeviceToEntityObject(device),
      source: device,
    };
  });
}

// ============================================================================
// HVAC device type/status mappings
// ============================================================================

var HVAC_STATUS_MAP = {
  active: 'online',
  inactive: 'offline',
  no_reading: 'no_info',
};

/**
 * Convert an HVAC device to an entityObject for renderCardComponentV6
 */
function hvacDeviceToEntityObject(device) {
  var deviceStatus = HVAC_STATUS_MAP[device.status] || 'no_info';

  return {
    entityId: device.id,
    labelOrName: device.name,
    deviceIdentifier: device.id,
    deviceType: 'TERMOSTATO',
    val: device.temperature != null ? device.temperature : 0,
    deviceStatus: deviceStatus,
    perc: 0,
    temperature: device.temperature,
    temperatureMin: device.setpoint ? device.setpoint - 2 : 18,
    temperatureMax: device.setpoint ? device.setpoint + 2 : 26,
    consumption: device.consumption,
  };
}

/**
 * Build CardGridPanel items from HVAC devices
 */
function buildHVACCardItems(hvacDevices, selectedFloor) {
  var filtered = hvacDevices;
  if (selectedFloor) {
    filtered = hvacDevices.filter(function (d) {
      return d.floor === selectedFloor;
    });
  }

  return filtered.map(function (device) {
    return {
      id: device.id,
      entityObject: hvacDeviceToEntityObject(device),
      source: device,
    };
  });
}

// ============================================================================
// Motor device type/status mappings
// ============================================================================

var MOTOR_TYPE_MAP = {
  pump: 'BOMBA_HIDRAULICA',
  motor: 'MOTOR',
  other: 'MOTOR',
};

var MOTOR_STATUS_MAP = {
  running: 'online',
  stopped: 'offline',
  unknown: 'no_info',
};

/**
 * Convert a motor device to an entityObject for renderCardComponentV6
 */
function motorDeviceToEntityObject(device) {
  var deviceType = MOTOR_TYPE_MAP[device.type] || 'MOTOR';
  var deviceStatus = MOTOR_STATUS_MAP[device.status] || 'no_info';

  return {
    entityId: device.id,
    labelOrName: device.name,
    deviceIdentifier: device.id,
    deviceType: deviceType,
    val: device.consumption,
    deviceStatus: deviceStatus,
    perc: 0,
  };
}

/**
 * Build CardGridPanel items from motor devices
 */
function buildMotorCardItems(motorDevices, selectedFloor) {
  var filtered = motorDevices;
  if (selectedFloor) {
    filtered = motorDevices.filter(function (d) {
      return d.floor === selectedFloor;
    });
  }

  return filtered.map(function (device) {
    return {
      id: device.id,
      entityObject: motorDeviceToEntityObject(device),
      source: device,
    };
  });
}

// ============================================================================
// Panel mount functions
// ============================================================================

/**
 * Mount CardGridPanel into #bas-water-host
 */
function mountWaterPanel(waterHost, settings, waterDevices) {
  if (!MyIOLibrary.CardGridPanel) {
    if (settings.enableDebugMode) {
      console.warn('[MAIN_BAS] MyIOLibrary.CardGridPanel not available');
    }
    return null;
  }

  var panel = new MyIOLibrary.CardGridPanel({
    title: 'Infraestrutura Hidrica',
    items: buildWaterCardItems(waterDevices, null),
    cardCustomStyle: settings.cardCustomStyle || undefined,
    gridMinCardWidth: '140px',
    emptyMessage: 'Nenhum dispositivo',
    handleClickCard: function (item) {
      if (settings.enableDebugMode) {
        console.log('[MAIN_BAS] Water device clicked:', item.source);
      }
      window.dispatchEvent(new CustomEvent('bas:device-clicked', { detail: { device: item.source } }));
    },
  });

  waterHost.appendChild(panel.getElement());
  return panel;
}

/**
 * Mount CardGridPanel into #bas-ambientes-host (HVAC devices)
 */
function mountAmbientesPanel(host, settings, hvacDevices) {
  if (!MyIOLibrary.CardGridPanel) {
    if (settings.enableDebugMode) {
      console.warn('[MAIN_BAS] MyIOLibrary.CardGridPanel not available');
    }
    return null;
  }

  var panel = new MyIOLibrary.CardGridPanel({
    title: settings.environmentsLabel,
    items: buildHVACCardItems(hvacDevices, null),
    cardCustomStyle: settings.cardCustomStyle || undefined,
    gridMinCardWidth: '140px',
    emptyMessage: 'Nenhum ambiente',
    handleClickCard: function (item) {
      if (settings.enableDebugMode) {
        console.log('[MAIN_BAS] HVAC device clicked:', item.source);
      }
      window.dispatchEvent(new CustomEvent('bas:device-clicked', { detail: { device: item.source } }));
    },
  });

  host.appendChild(panel.getElement());
  return panel;
}

/**
 * Mount DeviceGridV6 into #bas-motors-host (pumps & motors)
 */
function mountMotorsPanel(host, settings, motorDevices) {
  if (!MyIOLibrary.createDeviceGridV6) {
    if (settings.enableDebugMode) {
      console.warn('[MAIN_BAS] MyIOLibrary.createDeviceGridV6 not available');
    }
    return null;
  }

  var panel = MyIOLibrary.createDeviceGridV6({
    container: host,
    title: settings.pumpsMotorsLabel,
    items: buildMotorCardItems(motorDevices, null),
    cardCustomStyle: settings.cardCustomStyle || undefined,
    gridMinCardWidth: '140px',
    emptyMessage: 'Nenhum equipamento',
    debugActive: settings.enableDebugMode,
    handleClickCard: function (item) {
      if (settings.enableDebugMode) {
        console.log('[MAIN_BAS] Motor device clicked:', item.source);
      }
      window.dispatchEvent(new CustomEvent('bas:device-clicked', { detail: { device: item.source } }));
    },
  });

  return panel;
}

/**
 * Mount EntityListPanel into #bas-sidebar-host
 */
function mountSidebarPanel(sidebarHost, settings, floors) {
  if (!MyIOLibrary.EntityListPanel) {
    if (settings.enableDebugMode) {
      console.warn('[MAIN_BAS] MyIOLibrary.EntityListPanel not available');
    }
    return null;
  }

  var panel = new MyIOLibrary.EntityListPanel({
    title: settings.floorsLabel,
    subtitle: 'Nome do andar \u2191',
    items: buildFloorItems(floors),
    backgroundImage: settings.sidebarBackgroundImage || undefined,
    searchPlaceholder: 'Buscar andar...',
    selectedId: null,
    showAllOption: true,
    allLabel: 'Todos',
    handleClickAll: function () {
      if (settings.enableDebugMode) {
        console.log('[MAIN_BAS] Floor selected: all');
      }
      _selectedFloor = null;
      if (_waterPanel) {
        _waterPanel.setItems(buildWaterCardItems(_currentWaterDevices, null));
      }
      if (_ambientesPanel) {
        _ambientesPanel.setItems(buildHVACCardItems(_currentHVACDevices, null));
      }
      if (_motorsPanel) {
        _motorsPanel.updateItems(buildMotorCardItems(_currentMotorDevices, null));
      }
      if (panel) panel.setSelectedId(null);
      window.dispatchEvent(new CustomEvent('bas:floor-changed', { detail: { floor: null } }));
    },
    handleClickItem: function (item) {
      if (settings.enableDebugMode) {
        console.log('[MAIN_BAS] Floor selected:', item.id);
      }
      _selectedFloor = item.id;
      if (_waterPanel) {
        _waterPanel.setItems(buildWaterCardItems(_currentWaterDevices, item.id));
      }
      if (_ambientesPanel) {
        _ambientesPanel.setItems(buildHVACCardItems(_currentHVACDevices, item.id));
      }
      if (_motorsPanel) {
        _motorsPanel.updateItems(buildMotorCardItems(_currentMotorDevices, item.id));
      }
      if (panel) panel.setSelectedId(item.id);
      window.dispatchEvent(new CustomEvent('bas:floor-changed', { detail: { floor: item.id } }));
    },
  });

  sidebarHost.appendChild(panel.getElement());
  return panel;
}

// ============================================================================
// Chart functions
// ============================================================================

/**
 * Generate mock fetchData for a given chart domain
 */
function createMockFetchData(domain) {
  return function fetchData(period) {
    var labels = [];
    var values = [];
    var now = new Date();

    for (var i = period - 1; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

      if (domain === 'energy') {
        values.push(Math.random() * 800 + 200);
      } else if (domain === 'water') {
        values.push(Math.random() * 50 + 10);
      } else {
        values.push(Math.random() * 8 + 18);
      }
    }

    return Promise.resolve({
      labels: labels,
      dailyTotals: values,
    });
  };
}

/**
 * Switch chart to a different domain — destroys old chart + creates fresh canvas
 */
function switchChartDomain(domain, chartContainer) {
  // Destroy existing chart
  if (_chartInstance) {
    _chartInstance.destroy();
    _chartInstance = null;
  }

  _currentChartDomain = domain;

  // Replace canvas (Chart.js needs a fresh canvas)
  chartContainer.innerHTML = '';
  var canvas = document.createElement('canvas');
  canvas.id = 'bas-chart-canvas';
  chartContainer.appendChild(canvas);

  var cfg = CHART_DOMAIN_CONFIG[domain];
  if (!cfg) return;

  if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.createConsumption7DaysChart) {
    if (_settings && _settings.enableDebugMode) {
      console.warn('[MAIN_BAS] MyIOLibrary.createConsumption7DaysChart not available');
    }
    return;
  }

  _chartInstance = MyIOLibrary.createConsumption7DaysChart({
    domain: domain,
    containerId: 'bas-chart-canvas',
    unit: cfg.unit,
    unitLarge: cfg.unitLarge,
    thresholdForLargeUnit: cfg.threshold,
    fetchData: createMockFetchData(domain),
    defaultPeriod: 7,
    defaultChartType: domain === 'temperature' ? 'line' : 'bar',
    theme: (_settings && _settings.defaultThemeMode) || 'dark',
    showLegend: true,
    fill: domain === 'temperature',
  });

  _chartInstance.render();
}

/**
 * Mount chart tab bar + chart container into #bas-charts-host
 */
function mountChartPanel(hostEl) {
  if (!hostEl) return;

  var domains = ['energy', 'water', 'temperature'];

  // Build tab bar
  var tabBar = window.document.createElement('div');
  tabBar.className = 'bas-chart-tabs';

  domains.forEach(function (domain) {
    var btn = window.document.createElement('button');
    btn.className = 'bas-chart-tab' + (domain === _currentChartDomain ? ' bas-chart-tab--active' : '');
    btn.textContent = CHART_DOMAIN_CONFIG[domain].label;
    btn.dataset.domain = domain;
    btn.addEventListener('click', function () {
      // Update active tab
      var allTabs = tabBar.querySelectorAll('.bas-chart-tab');
      allTabs.forEach(function (t) {
        t.classList.remove('bas-chart-tab--active');
      });
      btn.classList.add('bas-chart-tab--active');

      // Switch chart
      switchChartDomain(domain, chartCard);
    });
    tabBar.appendChild(btn);
  });

  // Build chart card container
  var chartCard = document.createElement('div');
  chartCard.className = 'bas-chart-card';

  hostEl.appendChild(tabBar);
  hostEl.appendChild(chartCard);

  // Render default domain chart
  switchChartDomain(_currentChartDomain, chartCard);
}

// ============================================================================
// Dashboard initialization
// ============================================================================

/**
 * Show error state
 */
function showError(container, message) {
  container.innerHTML =
    '<div class="bas-dashboard-error"><div class="error-icon">!</div><div class="error-message">' +
    message +
    '</div></div>';
}

/**
 * Initialize the BAS dashboard — mounts all 5 panels into their grid slots
 */
async function initializeDashboard(ctx, sidebarHost, waterHost, chartsHost, ambientesHost, motorsHost, settings) {
  try {
    // Check if MyIOLibrary is available
    if (typeof MyIOLibrary === 'undefined') {
      throw new Error(
        'MyIOLibrary nao esta disponivel. Verifique se a biblioteca foi carregada.'
      );
    }

    // Parse initial data
    const devices = parseDevicesFromData(ctx.data);
    _currentFloors = devices.floors;

    // Mount sidebar EntityListPanel (col 1, row 1)
    if (settings.showFloorsSidebar && sidebarHost) {
      _floorListPanel = mountSidebarPanel(sidebarHost, settings, devices.floors);
    } else if (sidebarHost) {
      sidebarHost.style.display = 'none';
    }

    // Mount water CardGridPanel (col 2, row 1)
    _currentWaterDevices = devices.waterDevices;
    if (settings.showWaterInfrastructure && waterHost) {
      _waterPanel = mountWaterPanel(waterHost, settings, devices.waterDevices);
    } else if (waterHost) {
      waterHost.style.display = 'none';
    }

    // Mount chart panel (col 1–2, row 2)
    if (settings.showCharts && chartsHost) {
      mountChartPanel(chartsHost);
    } else if (chartsHost) {
      chartsHost.style.display = 'none';
    }

    // Mount ambientes CardGridPanel (col 3, row 1–2)
    _currentHVACDevices = devices.hvacDevices;
    if (settings.showEnvironments && ambientesHost) {
      _ambientesPanel = mountAmbientesPanel(ambientesHost, settings, devices.hvacDevices);
    } else if (ambientesHost) {
      ambientesHost.style.display = 'none';
    }

    // Mount motors CardGridPanel (col 4, row 1–2)
    _currentMotorDevices = devices.motorDevices;
    if (settings.showPumpsMotors && motorsHost) {
      _motorsPanel = mountMotorsPanel(motorsHost, settings, devices.motorDevices);
    } else if (motorsHost) {
      motorsHost.style.display = 'none';
    }

    if (settings.enableDebugMode) {
      console.log('[MAIN_BAS] Dashboard initialized with:', {
        waterDevices: devices.waterDevices.length,
        hvacDevices: devices.hvacDevices.length,
        motorDevices: devices.motorDevices.length,
        floors: devices.floors,
        sidebarMounted: !!_floorListPanel,
        waterPanelMounted: !!_waterPanel,
        ambientesPanelMounted: !!_ambientesPanel,
        motorsPanelMounted: !!_motorsPanel,
        chartMounted: !!_chartInstance,
        chartDomain: _currentChartDomain,
      });
    }
  } catch (error) {
    console.error('[MAIN_BAS] Error initializing dashboard:', error);
    // Show error in the first available container
    var errorHost = ambientesHost || motorsHost || waterHost;
    if (errorHost) {
      showError(errorHost, error.message);
    }
  }
}

// ============================================================================
// ThingsBoard Widget Lifecycle
// ============================================================================

self.onInit = async function () {
  _ctx = self.ctx;
  _settings = getSettings(_ctx);

  var root = _ctx.$container[0].querySelector('#bas-dashboard-root');
  if (!root) {
    console.error('[MAIN_BAS] Container #bas-dashboard-root not found');
    return;
  }

  var sidebarHost = root.querySelector('#bas-sidebar-host');
  var waterHost = root.querySelector('#bas-water-host');
  var chartsHost = root.querySelector('#bas-charts-host');
  var ambientesHost = root.querySelector('#bas-ambientes-host');
  var motorsHost = root.querySelector('#bas-motors-host');

  if (_settings.enableDebugMode) {
    console.log('[MAIN_BAS] onInit - Settings:', _settings);
    console.log('[MAIN_BAS] Layout containers:', {
      sidebarHost: !!sidebarHost,
      waterHost: !!waterHost,
      chartsHost: !!chartsHost,
      ambientesHost: !!ambientesHost,
      motorsHost: !!motorsHost,
    });
  }

  // Initialize all panels
  await initializeDashboard(_ctx, sidebarHost, waterHost, chartsHost, ambientesHost, motorsHost, _settings);
};

self.onDataUpdated = function () {
  if (!_ctx) return;

  var devices = parseDevicesFromData(_ctx.data);

  if (_settings && _settings.enableDebugMode) {
    console.log('[MAIN_BAS] onDataUpdated - Devices:', {
      water: devices.waterDevices.length,
      hvac: devices.hvacDevices.length,
      motors: devices.motorDevices.length,
    });
  }

  // Update floor list if floors changed
  if (_floorListPanel && JSON.stringify(devices.floors) !== JSON.stringify(_currentFloors)) {
    _currentFloors = devices.floors;
    _floorListPanel.setItems(buildFloorItems(devices.floors));
  }

  // Update water panel
  _currentWaterDevices = devices.waterDevices;
  if (_waterPanel) {
    _waterPanel.setItems(buildWaterCardItems(devices.waterDevices, _selectedFloor));
  }

  // Update ambientes panel
  _currentHVACDevices = devices.hvacDevices;
  if (_ambientesPanel) {
    _ambientesPanel.setItems(buildHVACCardItems(devices.hvacDevices, _selectedFloor));
  }

  // Update motors panel
  _currentMotorDevices = devices.motorDevices;
  if (_motorsPanel) {
    _motorsPanel.updateItems(buildMotorCardItems(devices.motorDevices, _selectedFloor));
  }
};

self.onResize = function () {
  // CardGridPanel handles its own resize
};

self.onDestroy = function () {
  if (_chartInstance && _chartInstance.destroy) {
    _chartInstance.destroy();
  }
  if (_floorListPanel && _floorListPanel.destroy) {
    _floorListPanel.destroy();
  }
  if (_waterPanel && _waterPanel.destroy) {
    _waterPanel.destroy();
  }
  if (_ambientesPanel && _ambientesPanel.destroy) {
    _ambientesPanel.destroy();
  }
  if (_motorsPanel && _motorsPanel.destroy) {
    _motorsPanel.destroy();
  }
  _chartInstance = null;
  _currentChartDomain = 'energy';
  _floorListPanel = null;
  _waterPanel = null;
  _ambientesPanel = null;
  _motorsPanel = null;
  _selectedFloor = null;
  _ctx = null;
  _settings = null;
  _currentFloors = [];
  _currentWaterDevices = [];
  _currentHVACDevices = [];
  _currentMotorDevices = [];
};

self.typeParameters = function () {
  return {
    maxDatasources: -1,
    maxDataKeys: -1,
    singleEntity: false,
    hasDataPageLink: false,
    warnOnPageDataOverflow: false,
    dataKeysOptional: true,
  };
};
