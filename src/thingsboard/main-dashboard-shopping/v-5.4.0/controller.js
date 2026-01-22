/* global self, window, document, MyIOLibrary, localStorage */

/**
 * RFC-0150: Shopping Dashboard - MAIN Controller (Slim Version)
 *
 * This is a refactored, slim version of the shopping dashboard controller.
 * It uses MyIOLibrary components instead of embedded logic.
 *
 * Components used:
 * - createHeaderShoppingComponent (RFC-0146)
 * - createMenuShoppingComponent (RFC-0147)
 * - createTelemetryGridShoppingComponent (RFC-0145)
 * - createFooterComponent (RFC-0149)
 */

// ============================================================================
// Configuration
// ============================================================================

const DEBUG_ACTIVE = true;
const THINGSBOARD_URL = 'https://dashboard.myio-bas.com';
const DATA_API_HOST = 'https://api.data.apps.myio-bas.com';

// Domain constants
const DOMAIN_ENERGY = 'energy';
const DOMAIN_WATER = 'water';
const DOMAIN_TEMPERATURE = 'temperature';

// ============================================================================
// LogHelper
// ============================================================================

const LogHelper = {
  log: (...args) => DEBUG_ACTIVE && console.log('[MAIN]', ...args),
  warn: (...args) => DEBUG_ACTIVE && console.warn('[MAIN]', ...args),
  error: (...args) => console.error('[MAIN]', ...args),
};

// ============================================================================
// Global State Setup
// ============================================================================

window.MyIOUtils = window.MyIOUtils || {};
Object.assign(window.MyIOUtils, {
  LogHelper,
  DATA_API_HOST,
  isDebugActive: () => DEBUG_ACTIVE,
  temperatureLimits: { minTemperature: 18, maxTemperature: 26 },
  mapInstantaneousPower: null,
  SuperAdmin: false,
  currentTheme: 'light',
  setTheme: (theme) => {
    window.MyIOUtils.currentTheme = theme;
    window.dispatchEvent(new CustomEvent('myio:theme-changed', { detail: { theme } }));
  },
  getTheme: () => window.MyIOUtils.currentTheme || 'light',
});

// ============================================================================
// Module State
// ============================================================================

let _headerInstance = null;
let _menuInstance = null;
let _footerInstance = null;
let _currentDomain = DOMAIN_ENERGY;
let _credentials = null;
let _dataProcessedOnce = false;

// Energy grid instances (3 groups)
let _energyGridEntrada = null;
let _energyGridAreaComum = null;
let _energyGridLojas = null;
let _energyInfoInstance = null;

// Water grid instances (3 groups)
let _waterGridEntrada = null;
let _waterGridAreaComum = null;
let _waterGridLojas = null;
let _waterInfoInstance = null;

// Temperature grid instance
let _temperatureGridLojas = null;

// ============================================================================
// Device Classification (RFC-0111)
// ============================================================================

/**
 * Extract device metadata from all rows for a single device
 */
function extractDeviceMetadataFromRows(rows) {
  if (!rows || rows.length === 0) return null;

  const firstRow = rows[0];
  const datasource = firstRow.datasource || {};
  const entityId = datasource.entityId;
  const deviceName = datasource.entityName || '';
  const entityLabel = datasource.entityLabel || '';

  const dataKeyValues = {};
  const dataKeyTimestamps = {};

  for (const row of rows) {
    const keyName = row.dataKey?.name;
    if (keyName && row.data && row.data.length > 0) {
      const latestData = row.data[row.data.length - 1];
      if (Array.isArray(latestData) && latestData.length >= 2) {
        dataKeyTimestamps[keyName] = latestData[0];
        dataKeyValues[keyName] = latestData[1];
      }
    }
  }

  const deviceType = dataKeyValues['deviceType'] || '';
  const deviceProfile = dataKeyValues['deviceProfile'] || deviceType;
  const connectionStatus = dataKeyValues['connectionStatus'] || 'no_info';

  // Domain detection
  const isWater = deviceType.toUpperCase().includes('HIDROMETRO');
  const isTemperature = deviceType.toUpperCase().includes('TERMOSTATO');
  const domain = isWater ? DOMAIN_WATER : isTemperature ? DOMAIN_TEMPERATURE : DOMAIN_ENERGY;

  // Calculate device status
  let deviceStatus = 'offline';
  if (window.MyIOLibrary?.calculateDeviceStatusMasterRules) {
    const telemetryTs =
      domain === DOMAIN_ENERGY
        ? dataKeyTimestamps['consumption']
        : domain === DOMAIN_WATER
        ? dataKeyTimestamps['pulses']
        : dataKeyTimestamps['temperature'];
    deviceStatus = window.MyIOLibrary.calculateDeviceStatusMasterRules({
      connectionStatus,
      telemetryTimestamp: telemetryTs,
      delayMins: 1440,
      domain,
    });
  }

  return {
    id: entityId,
    entityId,
    name: deviceName,
    label: dataKeyValues['label'] || entityLabel,
    labelOrName: dataKeyValues['label'] || entityLabel || deviceName,
    deviceType,
    deviceProfile,
    identifier: dataKeyValues['identifier'] || '',
    centralName: dataKeyValues['centralName'] || '',
    slaveId: dataKeyValues['slaveId'] || '',
    centralId: dataKeyValues['centralId'] || '',
    customerId: dataKeyValues['customerId'] || '',
    ownerName: dataKeyValues['ownerName'] || '',
    ingestionId: dataKeyValues['ingestionId'] || '',
    consumption: dataKeyValues['consumption'] || null,
    val: dataKeyValues['consumption'] || dataKeyValues['pulses'] || dataKeyValues['temperature'] || null,
    value: dataKeyValues['consumption'] || dataKeyValues['pulses'] || dataKeyValues['temperature'] || null,
    pulses: dataKeyValues['pulses'],
    temperature: dataKeyValues['temperature'],
    connectionStatus,
    deviceStatus,
    domain,
    lastActivityTime: dataKeyValues['lastActivityTime'],
    lastConnectTime: dataKeyValues['lastConnectTime'],
  };
}

/**
 * Classify all devices from datasource
 */
function classifyAllDevices(data) {
  const classified = {
    energy: { equipments: [], stores: [], entrada: [] },
    water: { hidrometro_entrada: [], banheiros: [], hidrometro_area_comum: [], hidrometro: [] },
    temperature: { termostato: [], termostato_external: [] },
  };

  // Group rows by entityId
  const deviceRowsMap = new Map();
  for (const row of data) {
    const entityId = row.datasource?.entityId || row.datasource?.entity?.id?.id;
    if (!entityId) continue;
    if (!deviceRowsMap.has(entityId)) deviceRowsMap.set(entityId, []);
    deviceRowsMap.get(entityId).push(row);
  }

  LogHelper.log(`Grouped ${data.length} rows → ${deviceRowsMap.size} devices`);

  // Process each device
  for (const rows of deviceRowsMap.values()) {
    const device = extractDeviceMetadataFromRows(rows);
    if (!device) continue;

    const domain = window.MyIOLibrary?.detectDomain?.(device) || device.domain;
    const context = window.MyIOLibrary?.detectContext?.(device, domain) || 'equipments';

    if (classified[domain]?.[context]) {
      classified[domain][context].push(device);
    }
  }

  return classified;
}

/**
 * Build status aggregation from devices
 */
function buildByStatusFromDevices(devices) {
  const byStatus = {
    waiting: 0,
    offline: 0,
    normal: 0,
    alert: 0,
    failure: 0,
    weakConnection: 0,
    standby: 0,
    noConsumption: 0,
  };

  const ONLINE = ['power_on', 'online', 'normal', 'ok', 'running', 'active'];
  const OFFLINE = ['offline', 'no_info'];
  const WAITING = ['waiting', 'aguardando', 'not_installed', 'pending'];

  for (const d of devices) {
    const status = (d.deviceStatus || d.connectionStatus || '').toLowerCase();
    const value = Number(d.value || d.val || 0);

    if (WAITING.includes(status)) byStatus.waiting++;
    else if (OFFLINE.includes(status)) byStatus.offline++;
    else if (status === 'alert') byStatus.alert++;
    else if (status === 'failure') byStatus.failure++;
    else if (ONLINE.includes(status) && value === 0) byStatus.noConsumption++;
    else if (ONLINE.includes(status)) byStatus.normal++;
    else byStatus.offline++;
  }

  return byStatus;
}

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Process data from AllDevices datasource and dispatch events
 */
function processDataAndDispatchEvents() {
  const allData = self.ctx?.data || [];

  // Filter for AllDevices datasource
  const data = allData.filter((row) => {
    const alias = (row.datasource?.aliasName || '').toLowerCase();
    return alias.includes('alldevices') || alias.includes('all3fs') || alias === '';
  });

  LogHelper.log(`Processing ${data.length} rows from AllDevices`);
  if (data.length === 0) return false;

  // Classify devices
  const classified = classifyAllDevices(data);

  // Store in global state
  window.STATE = window.STATE || {};
  window.STATE.classified = classified;
  window.STATE.energy = {
    lojas: { items: classified.energy.stores },
    areacomum: { items: classified.energy.equipments },
    entrada: { items: classified.energy.entrada },
  };
  window.STATE.water = {
    lojas: { items: classified.water.hidrometro },
    areacomum: { items: classified.water.hidrometro_area_comum },
    entrada: { items: classified.water.hidrometro_entrada },
    banheiros: { items: classified.water.banheiros },
  };
  window.STATE.temperature = {
    lojas: { items: classified.temperature.termostato },
  };

  // Build flat arrays
  const allEnergy = [
    ...classified.energy.equipments,
    ...classified.energy.stores,
    ...classified.energy.entrada,
  ];
  const allWater = [
    ...classified.water.hidrometro_entrada,
    ...classified.water.banheiros,
    ...classified.water.hidrometro_area_comum,
    ...classified.water.hidrometro,
  ];
  const allTemp = [...classified.temperature.termostato, ...classified.temperature.termostato_external];

  // Calculate totals
  const energyTotal = allEnergy.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const waterTotal = allWater.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const tempValues = allTemp.map((d) => Number(d.temperature || 0)).filter((v) => v > 0);
  const tempAvg = tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : null;

  // Dispatch events
  window.dispatchEvent(
    new CustomEvent('myio:data-ready', {
      detail: { classified, timestamp: Date.now() },
    })
  );

  window.dispatchEvent(
    new CustomEvent('myio:energy-summary-ready', {
      detail: {
        totalDevices: allEnergy.length,
        totalConsumption: energyTotal,
        byStatus: buildByStatusFromDevices(allEnergy),
      },
    })
  );

  window.dispatchEvent(
    new CustomEvent('myio:water-summary-ready', {
      detail: {
        totalDevices: allWater.length,
        totalConsumption: waterTotal,
        byStatus: buildByStatusFromDevices(allWater),
      },
    })
  );

  window.dispatchEvent(
    new CustomEvent('myio:temperature-data-ready', {
      detail: {
        totalDevices: allTemp.length,
        globalAvg: tempAvg,
        temperatureMin: window.MyIOUtils.temperatureLimits.minTemperature,
        temperatureMax: window.MyIOUtils.temperatureLimits.maxTemperature,
        byStatus: buildByStatusFromDevices(allTemp),
      },
    })
  );

  // Update TelemetryInfo components with category data
  updateTelemetryInfoComponents(classified);

  LogHelper.log('Events dispatched');
  _dataProcessedOnce = true;
  return true;
}

/**
 * Update TelemetryInfo components with category breakdown data
 */
function updateTelemetryInfoComponents(classified) {
  const lib = window.MyIOLibrary;

  // Build energy summary for TelemetryInfo
  if (_energyInfoInstance) {
    const allEnergyDevices = [
      ...classified.energy.equipments,
      ...classified.energy.stores,
      ...classified.energy.entrada,
    ];

    // Calculate totals from classified arrays
    const sumValues = (arr) => arr.reduce((sum, d) => sum + Number(d.value || d.consumption || 0), 0);

    // Use library's buildEquipmentCategorySummary for detailed breakdown
    let energySummary;
    if (lib?.buildEquipmentCategorySummary) {
      const catSummary = lib.buildEquipmentCategorySummary(allEnergyDevices);
      LogHelper.log('Category summary from library:', catSummary);

      energySummary = {
        entrada: { total: catSummary.entrada?.consumption || 0 },
        lojas: { total: catSummary.lojas?.consumption || 0 },
        climatizacao: { total: catSummary.climatizacao?.consumption || 0 },
        elevadores: { total: catSummary.elevadores?.consumption || 0 },
        escadasRolantes: { total: catSummary.escadas_rolantes?.consumption || 0 },
        outros: { total: catSummary.outros?.consumption || 0 },
      };
    } else {
      // Fallback: use basic classification
      const entradaTotal = sumValues(classified.energy.entrada);
      const lojasTotal = sumValues(classified.energy.stores);
      const equipTotal = sumValues(classified.energy.equipments);

      energySummary = {
        entrada: { total: entradaTotal },
        lojas: { total: lojasTotal },
        climatizacao: { total: 0 },
        elevadores: { total: 0 },
        escadasRolantes: { total: 0 },
        outros: { total: equipTotal },
      };
    }

    LogHelper.log('Energy summary for TelemetryInfo:', energySummary);

    _energyInfoInstance.setEnergyData(energySummary);
    LogHelper.log('Energy TelemetryInfo updated');
  }

  // Build water summary for TelemetryInfo
  if (_waterInfoInstance) {
    const sumWaterValues = (arr) => arr.reduce((sum, d) => sum + Number(d.value || d.consumption || 0), 0);

    const waterSummary = {
      entrada: { total: sumWaterValues(classified.water.hidrometro_entrada || []) },
      lojas: { total: sumWaterValues(classified.water.hidrometro || []) },
      banheiros: { total: sumWaterValues(classified.water.banheiros || []) },
      areaComum: { total: sumWaterValues(classified.water.hidrometro_area_comum || []) },
    };

    LogHelper.log('Water summary for TelemetryInfo:', waterSummary);
    _waterInfoInstance.setWaterData(waterSummary);
    LogHelper.log('Water TelemetryInfo updated');
  }
}

// ============================================================================
// Credentials Fetching
// ============================================================================

async function fetchCredentials(customerTbId) {
  const jwt = self.ctx?.http?.getServerCredentials?.()?.token;
  if (!jwt) {
    LogHelper.error('No JWT token');
    return null;
  }

  try {
    const url = `${THINGSBOARD_URL}/api/plugins/telemetry/CUSTOMER/${customerTbId}/values/attributes/SERVER_SCOPE`;
    const response = await fetch(url, {
      headers: { 'X-Authorization': `Bearer ${jwt}` },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const attrs = await response.json();
    const get = (key) => attrs.find((a) => a.key === key)?.value;

    return {
      clientId: get('clientId') || '',
      clientSecret: get('clientSecret') || '',
      ingestionId: get('customerId') || '',
    };
  } catch (err) {
    LogHelper.error('Failed to fetch credentials:', err);
    return null;
  }
}

// ============================================================================
// User Info Fetching
// ============================================================================

/**
 * Get user info from ThingsBoard context and update menu component
 */
async function fetchAndUpdateUserInfo() {
  // First try to get user from ThingsBoard widget context (fastest)
  const ctxUser = self.ctx?.currentUser;

  if (ctxUser) {
    const fullName =
      `${ctxUser.firstName || ''} ${ctxUser.lastName || ''}`.trim() || ctxUser.name || 'Usuário';
    const isAdmin = ctxUser.authority === 'TENANT_ADMIN' || window.MyIOUtils.SuperAdmin;

    if (_menuInstance) {
      _menuInstance.updateUserInfo({
        name: fullName,
        email: ctxUser.email || '',
        isAdmin: isAdmin,
      });
      LogHelper.log('Menu user info updated from context');
    }
    return;
  }

  // Fallback: Fetch from API if context not available
  const jwt = self.ctx?.http?.getServerCredentials?.()?.token || localStorage.getItem('jwt_token');
  if (!jwt) {
    LogHelper.warn('No JWT token for user info fetch');
    if (_menuInstance) {
      _menuInstance.updateUserInfo({ name: 'Usuário', email: '', isAdmin: false });
    }
    return;
  }

  try {
    const response = await fetch(`${THINGSBOARD_URL}/api/auth/user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${jwt}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const user = await response.json();
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Usuário';
    const isAdmin = user.authority === 'TENANT_ADMIN' || window.MyIOUtils.SuperAdmin;

    if (_menuInstance) {
      _menuInstance.updateUserInfo({
        name: fullName,
        email: user.email || '',
        isAdmin: isAdmin,
      });
      LogHelper.log('Menu user info updated from API');
    }
  } catch (err) {
    LogHelper.error('Failed to fetch user info:', err);
    if (_menuInstance) {
      _menuInstance.updateUserInfo({ name: 'Usuário', email: '', isAdmin: false });
    }
  }
}

// ============================================================================
// Component Creation
// ============================================================================

/**
 * Handle menu collapse toggle - adds/removes menu-compact class on #myio-root
 */
function handleMenuCollapse(collapsed) {
  const root = document.getElementById('myio-root');
  if (!root) return;

  if (collapsed) {
    root.classList.add('menu-compact');
  } else {
    root.classList.remove('menu-compact');
  }
  LogHelper.log('Menu collapsed:', collapsed);
}

function createComponents() {
  const lib = window.MyIOLibrary;
  if (!lib) {
    LogHelper.error('MyIOLibrary not available');
    return;
  }

  const settings = self.ctx?.settings || {};
  const customerTbId = settings.customerTB_ID || '';

  // Create Menu with collapse handler
  const menuContainer = document.getElementById('menuContainer');
  if (menuContainer && lib.createMenuShoppingComponent) {
    _menuInstance = lib.createMenuShoppingComponent({
      container: menuContainer,
      themeMode: 'dark',
      configTemplate: { initialDomain: 'energy' },
      onTabChange: (domain, tabId) => {
        LogHelper.log('Tab changed:', domain);
        _currentDomain = domain;
        switchContentState(domain);
      },
      onToggleCollapse: handleMenuCollapse,
    });
    LogHelper.log('Menu created');
  }

  // Create Header
  const headerContainer = document.getElementById('headerContainer');
  if (headerContainer && lib.createHeaderShoppingComponent) {
    _headerInstance = lib.createHeaderShoppingComponent({
      container: headerContainer,
      themeMode: 'dark',
      credentials: _credentials,
      configTemplate: { timezone: 'America/Sao_Paulo' },
      onLoad: (period) => {
        LogHelper.log('Load clicked, period:', period);
        window.dispatchEvent(new CustomEvent('myio:update-date', { detail: { period } }));
      },
    });
    LogHelper.log('Header created');
  }

  // Create Energy grids (3 groups)
  createEnergyGrids(lib);

  // Create Water grids (3 groups)
  createWaterGrids(lib);

  // Create Temperature grid
  createTemperatureGrids(lib);

  // Create Footer
  const footerContainer = document.getElementById('footerContainer');
  if (footerContainer && lib.createFooterComponent) {
    _footerInstance = lib.createFooterComponent({
      container: footerContainer,
      themeMode: 'dark',
      customerTbId,
      credentials: _credentials,
    });
    LogHelper.log('Footer created');
  }
}

/**
 * Create Energy domain grids: Entrada, Área Comum, Lojas + Info
 */
function createEnergyGrids(lib) {
  // Entrada (Entrada de energia)
  const entradaContainer = document.getElementById('energyEntradaContainer');
  if (entradaContainer && lib.createTelemetryGridShoppingComponent) {
    _energyGridEntrada = lib.createTelemetryGridShoppingComponent({
      container: entradaContainer,
      domain: 'energy',
      context: 'entrada',
      devices: [],
      themeMode: 'dark',
      labelWidget: 'Entrada',
      debugActive: DEBUG_ACTIVE,
    });
    LogHelper.log('Energy Entrada grid created');
  }

  // Área Comum (Equipamentos)
  const areaComumContainer = document.getElementById('energyAreaComumContainer');
  if (areaComumContainer && lib.createTelemetryGridShoppingComponent) {
    _energyGridAreaComum = lib.createTelemetryGridShoppingComponent({
      container: areaComumContainer,
      domain: 'energy',
      context: 'equipments',
      devices: [],
      themeMode: 'dark',
      labelWidget: 'Área Comum',
      debugActive: DEBUG_ACTIVE,
    });
    LogHelper.log('Energy Área Comum grid created');
  }

  // Lojas (Stores)
  const lojasContainer = document.getElementById('energyLojasContainer');
  if (lojasContainer && lib.createTelemetryGridShoppingComponent) {
    _energyGridLojas = lib.createTelemetryGridShoppingComponent({
      container: lojasContainer,
      domain: 'energy',
      context: 'stores',
      devices: [],
      themeMode: 'dark',
      labelWidget: 'Lojas',
      debugActive: DEBUG_ACTIVE,
    });
    LogHelper.log('Energy Lojas grid created');
  }

  // Energy Info (pie chart)
  const infoContainer = document.getElementById('energyInfoContainer');
  if (infoContainer && lib.createTelemetryInfoShoppingComponent) {
    _energyInfoInstance = lib.createTelemetryInfoShoppingComponent({
      container: infoContainer,
      domain: 'energy',
      themeMode: 'dark',
      showChart: true,
      showExpandButton: true,
      debugActive: DEBUG_ACTIVE,
    });
    LogHelper.log('Energy Info created');
  }
}

/**
 * Create Water domain grids: Entrada, Área Comum, Lojas + Info
 */
function createWaterGrids(lib) {
  // Entrada (Hidrômetro de entrada)
  const entradaContainer = document.getElementById('waterEntradaContainer');
  if (entradaContainer && lib.createTelemetryGridShoppingComponent) {
    _waterGridEntrada = lib.createTelemetryGridShoppingComponent({
      container: entradaContainer,
      domain: 'water',
      context: 'hidrometro_entrada',
      devices: [],
      themeMode: 'dark',
      labelWidget: 'Entrada',
      debugActive: DEBUG_ACTIVE,
    });
    LogHelper.log('Water Entrada grid created');
  }

  // Área Comum (Hidrômetro área comum)
  const areaComumContainer = document.getElementById('waterAreaComumContainer');
  if (areaComumContainer && lib.createTelemetryGridShoppingComponent) {
    _waterGridAreaComum = lib.createTelemetryGridShoppingComponent({
      container: areaComumContainer,
      domain: 'water',
      context: 'hidrometro_area_comum',
      devices: [],
      themeMode: 'dark',
      labelWidget: 'Área Comum',
      debugActive: DEBUG_ACTIVE,
    });
    LogHelper.log('Water Área Comum grid created');
  }

  // Lojas (Hidrômetro lojas)
  const lojasContainer = document.getElementById('waterLojasContainer');
  if (lojasContainer && lib.createTelemetryGridShoppingComponent) {
    _waterGridLojas = lib.createTelemetryGridShoppingComponent({
      container: lojasContainer,
      domain: 'water',
      context: 'hidrometro',
      devices: [],
      themeMode: 'dark',
      labelWidget: 'Lojas',
      debugActive: DEBUG_ACTIVE,
    });
    LogHelper.log('Water Lojas grid created');
  }

  // Water Info (pie chart)
  const infoContainer = document.getElementById('waterInfoContainer');
  if (infoContainer && lib.createTelemetryInfoShoppingComponent) {
    _waterInfoInstance = lib.createTelemetryInfoShoppingComponent({
      container: infoContainer,
      domain: 'water',
      themeMode: 'dark',
      showChart: true,
      showExpandButton: true,
      debugActive: DEBUG_ACTIVE,
    });
    LogHelper.log('Water Info created');
  }
}

/**
 * Create Temperature domain grid
 */
function createTemperatureGrids(lib) {
  const lojasContainer = document.getElementById('temperatureLojasContainer');
  if (lojasContainer && lib.createTelemetryGridShoppingComponent) {
    _temperatureGridLojas = lib.createTelemetryGridShoppingComponent({
      container: lojasContainer,
      domain: 'temperature',
      context: 'termostato',
      devices: [],
      themeMode: 'dark',
      labelWidget: 'Termostatos',
      debugActive: DEBUG_ACTIVE,
    });
    LogHelper.log('Temperature Lojas grid created');
  }
}

// ============================================================================
// Content State Switching
// ============================================================================

function switchContentState(domain) {
  const stateMap = {
    energy: 'telemetry_content',
    water: 'water_content',
    temperature: 'temperature_content',
    alarm: 'alarm_content',
  };

  const targetState = stateMap[domain] || 'telemetry_content';

  // Hide all states
  document.querySelectorAll('[data-content-state]').forEach((el) => {
    el.style.display = 'none';
  });

  // Show target state - all use grid display (4col for energy/water, 1col for temp/alarm)
  const targetEl = document.querySelector(`[data-content-state="${targetState}"]`);
  if (targetEl) {
    targetEl.style.display = 'grid';
  }

  LogHelper.log('Switched content state to:', targetState);

  // Dispatch state change event
  window.dispatchEvent(
    new CustomEvent('myio:dashboard-state', {
      detail: { tab: domain },
    })
  );
}

// ============================================================================
// Extract Customer Attributes from datasource
// ============================================================================

function extractCustomerAttributes(data) {
  for (const row of data) {
    const alias = (row.datasource?.aliasName || '').toLowerCase();
    if (alias !== 'customer') continue;

    const keyName = (row.dataKey?.name || '').toLowerCase();
    const value = row.data?.[0]?.[1];

    if (keyName === 'mintemperature' && value != null) {
      window.MyIOUtils.temperatureLimits.minTemperature = Number(value);
    }
    if (keyName === 'maxtemperature' && value != null) {
      window.MyIOUtils.temperatureLimits.maxTemperature = Number(value);
    }
    if (keyName === 'mapinstantaneouspower' && value != null) {
      try {
        window.MyIOUtils.mapInstantaneousPower = typeof value === 'string' ? JSON.parse(value) : value;
      } catch (_e) {
        // Ignore parse errors - keep existing value
      }
    }
  }
}

// ============================================================================
// ThingsBoard Widget Lifecycle
// ============================================================================

self.onInit = async function () {
  LogHelper.log('onInit starting...');

  const settings = self.ctx?.settings || {};
  const customerTbId = settings.customerTB_ID || '';
  window.MyIOUtils.customerTB_ID = customerTbId;

  // Detect SuperAdmin
  const userEmail = self.ctx?.currentUser?.email || '';
  window.MyIOUtils.SuperAdmin = userEmail.includes('@myio.com.br') && !userEmail.includes('alarme');

  // Fetch credentials
  if (customerTbId) {
    _credentials = await fetchCredentials(customerTbId);
    if (_credentials) {
      LogHelper.log('Credentials fetched');

      // Set in orchestrator if available
      if (window.MyIOOrchestrator?.setCredentials) {
        window.MyIOOrchestrator.setCredentials(
          _credentials.ingestionId,
          _credentials.clientId,
          _credentials.clientSecret
        );
      }
    }
  }

  // Create components
  createComponents();

  // Fetch user info and update menu
  fetchAndUpdateUserInfo();

  // Dispatch initial state
  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent('myio:dashboard-state', {
        detail: { tab: 'energy' },
      })
    );
  }, 200);

  LogHelper.log('onInit complete');
};

self.onDataUpdated = function () {
  const data = self.ctx?.data || [];
  if (data.length === 0) return;

  // Extract customer attributes (temperature limits, etc.)
  extractCustomerAttributes(data);

  // Process AllDevices datasource (only once per update cycle)
  if (!_dataProcessedOnce) {
    processDataAndDispatchEvents();
  }
};

self.onResize = function () {
  // Components handle their own resize
};

self.onDestroy = function () {
  LogHelper.log('onDestroy');

  // Destroy main components
  _headerInstance?.destroy?.();
  _menuInstance?.destroy?.();
  _footerInstance?.destroy?.();

  // Destroy energy grids and info
  _energyGridEntrada?.destroy?.();
  _energyGridAreaComum?.destroy?.();
  _energyGridLojas?.destroy?.();
  _energyInfoInstance?.destroy?.();

  // Destroy water grids and info
  _waterGridEntrada?.destroy?.();
  _waterGridAreaComum?.destroy?.();
  _waterGridLojas?.destroy?.();
  _waterInfoInstance?.destroy?.();

  // Destroy temperature grid
  _temperatureGridLojas?.destroy?.();

  // Reset references
  _headerInstance = null;
  _menuInstance = null;
  _footerInstance = null;
  _energyGridEntrada = null;
  _energyGridAreaComum = null;
  _energyGridLojas = null;
  _energyInfoInstance = null;
  _waterGridEntrada = null;
  _waterGridAreaComum = null;
  _waterGridLojas = null;
  _waterInfoInstance = null;
  _temperatureGridLojas = null;
};
