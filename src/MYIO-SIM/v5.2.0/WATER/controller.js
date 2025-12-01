/* ============ RFC-0087: WATER Summary Widget Controller ============ */
/* Aggregates water consumption data from Common Area and Stores hydrometers */

const LOG_PREFIX = '[WATER]';

// ─── State ───────────────────────────────────────────────────────────────────
let waterData = {
  commonArea: {
    devices: 0,
    consumption: 0,
    online: 0,
    offline: 0,
  },
  stores: {
    devices: 0,
    consumption: 0,
    online: 0,
    offline: 0,
  },
};

let currentPeriod = 'Mês atual';

// ─── DOM References ──────────────────────────────────────────────────────────
const DOM = {
  // Header stats
  totalDevices: () => document.getElementById('waterTotalDevices'),
  totalConsumption: () => document.getElementById('waterTotalConsumption'),
  period: () => document.getElementById('waterPeriod'),

  // Common Area card
  commonAreaValue: () => document.getElementById('commonAreaValue'),
  commonAreaPct: () => document.getElementById('commonAreaPct'),
  commonAreaBar: () => document.getElementById('commonAreaBar'),
  commonAreaDevices: () => document.getElementById('commonAreaDevices'),

  // Stores card
  storesValue: () => document.getElementById('storesValue'),
  storesPct: () => document.getElementById('storesPct'),
  storesBar: () => document.getElementById('storesBar'),
  storesDevices: () => document.getElementById('storesDevices'),

  // Pie chart
  pieTotal: () => document.getElementById('pieTotal'),
  legendCommonArea: () => document.getElementById('legendCommonArea'),
  legendStores: () => document.getElementById('legendStores'),
  pieCommonArea: () => document.querySelector('.pie-segment.common-area'),
  pieStores: () => document.querySelector('.pie-segment.stores'),

  // Loading overlay
  loadingOverlay: () => document.getElementById('water-summary-loading'),

  // Detail buttons
  detailButtons: () => document.querySelectorAll('.view-details-btn'),
};

// ─── Format Helpers ──────────────────────────────────────────────────────────
function formatConsumption(value) {
  if (value == null || isNaN(value)) return '-';
  if (value >= 1000) {
    return (value / 1000).toFixed(2).replace('.', ',') + 'k';
  }
  return value.toFixed(1).replace('.', ',');
}

function formatPercentage(value) {
  if (value == null || isNaN(value)) return '-%';
  return value.toFixed(1).replace('.', ',') + '%';
}

// ─── UI Update Functions ─────────────────────────────────────────────────────
function updateUI() {
  const totalDevices = waterData.commonArea.devices + waterData.stores.devices;
  const totalConsumption = waterData.commonArea.consumption + waterData.stores.consumption;

  // Calculate percentages
  const commonAreaPct = totalConsumption > 0 ? (waterData.commonArea.consumption / totalConsumption) * 100 : 0;
  const storesPct = totalConsumption > 0 ? (waterData.stores.consumption / totalConsumption) * 100 : 0;

  // Update header stats
  const totalDevicesEl = DOM.totalDevices();
  if (totalDevicesEl) totalDevicesEl.textContent = totalDevices;

  const totalConsumptionEl = DOM.totalConsumption();
  if (totalConsumptionEl) totalConsumptionEl.textContent = formatConsumption(totalConsumption) + ' m³';

  const periodEl = DOM.period();
  if (periodEl) periodEl.textContent = currentPeriod;

  // Update Common Area card
  const commonAreaValueEl = DOM.commonAreaValue();
  if (commonAreaValueEl) commonAreaValueEl.textContent = formatConsumption(waterData.commonArea.consumption);

  const commonAreaPctEl = DOM.commonAreaPct();
  if (commonAreaPctEl) commonAreaPctEl.textContent = formatPercentage(commonAreaPct);

  const commonAreaBarEl = DOM.commonAreaBar();
  if (commonAreaBarEl) commonAreaBarEl.style.width = commonAreaPct + '%';

  const commonAreaDevicesEl = DOM.commonAreaDevices();
  if (commonAreaDevicesEl) commonAreaDevicesEl.textContent = waterData.commonArea.devices;

  // Update Stores card
  const storesValueEl = DOM.storesValue();
  if (storesValueEl) storesValueEl.textContent = formatConsumption(waterData.stores.consumption);

  const storesPctEl = DOM.storesPct();
  if (storesPctEl) storesPctEl.textContent = formatPercentage(storesPct);

  const storesBarEl = DOM.storesBar();
  if (storesBarEl) storesBarEl.style.width = storesPct + '%';

  const storesDevicesEl = DOM.storesDevices();
  if (storesDevicesEl) storesDevicesEl.textContent = waterData.stores.devices;

  // Update pie chart
  updatePieChart(commonAreaPct, storesPct, totalConsumption);
}

function updatePieChart(commonAreaPct, storesPct, totalConsumption) {
  const circumference = 2 * Math.PI * 40; // r=40 in SVG viewBox

  // Update pie center total
  const pieTotalEl = DOM.pieTotal();
  if (pieTotalEl) pieTotalEl.textContent = formatConsumption(totalConsumption);

  // Update legend values
  const legendCommonAreaEl = DOM.legendCommonArea();
  if (legendCommonAreaEl) legendCommonAreaEl.textContent = formatConsumption(waterData.commonArea.consumption) + ' m³';

  const legendStoresEl = DOM.legendStores();
  if (legendStoresEl) legendStoresEl.textContent = formatConsumption(waterData.stores.consumption) + ' m³';

  // Update pie segments
  const commonAreaSegment = DOM.pieCommonArea();
  const storesSegment = DOM.pieStores();

  if (commonAreaSegment && storesSegment) {
    const commonAreaDash = (commonAreaPct / 100) * circumference;
    const storesDash = (storesPct / 100) * circumference;

    // Common area starts at 0
    commonAreaSegment.style.strokeDasharray = `${commonAreaDash} ${circumference}`;
    commonAreaSegment.style.strokeDashoffset = '0';

    // Stores starts after common area
    storesSegment.style.strokeDasharray = `${storesDash} ${circumference}`;
    storesSegment.style.strokeDashoffset = `-${commonAreaDash}`;
  }
}

function showLoading(show) {
  const overlay = DOM.loadingOverlay();
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function navigateToWidget(target) {
  console.log(LOG_PREFIX, 'Navigating to:', target);
  // Dispatch navigation event for MyIOOrchestrator
  window.dispatchEvent(
    new CustomEvent('myio:navigate-widget', {
      detail: { target },
    })
  );
}

// ─── Event Handlers ──────────────────────────────────────────────────────────
function handleWaterDataReady(event) {
  const { source, data } = event.detail || {};
  console.log(LOG_PREFIX, 'Received water data from:', source, data);

  if (source === 'WATER_COMMON_AREA' && data) {
    waterData.commonArea = {
      devices: data.totalDevices || 0,
      consumption: data.totalConsumption || 0,
      online: data.onlineDevices || 0,
      offline: data.offlineDevices || 0,
    };
  } else if (source === 'WATER_STORES' && data) {
    waterData.stores = {
      devices: data.totalDevices || 0,
      consumption: data.totalConsumption || 0,
      online: data.onlineDevices || 0,
      offline: data.offlineDevices || 0,
    };
  }

  updateUI();
  showLoading(false);
}

function handleOrchestratorFilterUpdated(event) {
  const { period } = event.detail || {};
  console.log(LOG_PREFIX, 'Filter updated, period:', period);

  if (period) {
    currentPeriod = period;
    const periodEl = DOM.period();
    if (periodEl) periodEl.textContent = currentPeriod;
  }

  // Show loading while data refreshes
  showLoading(true);
}

function handleWaterSummaryRequest() {
  // Request data from both widgets
  window.dispatchEvent(
    new CustomEvent('myio:request-water-data', {
      detail: { requestor: 'WATER' },
    })
  );
}

// ─── Initialization ──────────────────────────────────────────────────────────
function setupEventListeners() {
  // Listen for water data from child widgets
  window.addEventListener('myio:water-data-ready', handleWaterDataReady);

  // Listen for filter updates
  window.addEventListener('myio:orchestrator-filter-updated', handleOrchestratorFilterUpdated);

  // Setup navigation buttons
  DOM.detailButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (target) navigateToWidget(target);
    });
  });
}

function cleanup() {
  window.removeEventListener('myio:water-data-ready', handleWaterDataReady);
  window.removeEventListener('myio:orchestrator-filter-updated', handleOrchestratorFilterUpdated);
}

// ─── ThingsBoard Widget Hooks ────────────────────────────────────────────────
self.onInit = function () {
  console.log(LOG_PREFIX, 'Widget initialized');
  showLoading(true);
  setupEventListeners();

  // Request initial data after short delay to allow other widgets to initialize
  setTimeout(() => {
    handleWaterSummaryRequest();
  }, 500);
};

self.onDataUpdated = function () {
  // Data updates handled via custom events
};

self.onResize = function () {
  // Pie chart is SVG-based, auto-resizes
};

self.onDestroy = function () {
  console.log(LOG_PREFIX, 'Widget destroyed');
  cleanup();
};
