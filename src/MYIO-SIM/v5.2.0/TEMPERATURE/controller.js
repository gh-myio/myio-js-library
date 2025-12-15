/* global self, window, document, localStorage, MyIOLibrary, Chart */

/**
 * RFC-0092: TEMPERATURE Widget Controller (Head Office)
 *
 * Shopping-level temperature comparison panel.
 * Aggregates sensor data per shopping center and displays consolidated averages.
 */

// ============================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

const formatRelativeTime =
  window.MyIOUtils?.formatRelativeTime || ((ts) => (ts ? new Date(ts).toLocaleString() : '—'));

// ============================================
// WIDGET STATE
// ============================================
const STATE = {
  shoppingData: [],
  allSensors: [],
  selectedShoppingIds: [],
  dateRange: {
    start: null,
    end: null,
  },
  chartInstance: null,
  isLoading: false,
};

// RFC-0098: Chart configuration state for 7-day temperature chart
const chartConfig = {
  period: 7,
  startDate: null,
  endDate: null,
  vizMode: 'total',
  chartType: 'line',
};

// RFC-0098: Consumption 7 Days Chart instance
let consumptionChartInstance = null;
let cachedChartData = null;

// Settings defaults
const DEFAULT_SETTINGS = {
  useDemoData: false,
  targetTemp: 23,
  targetTol: 2,
};

LogHelper.log('[TEMPERATURE] RFC-0092: Widget script loaded');

// ============================================
// DEMO DATA (for preview mode)
// ============================================
function makeDemo() {
  const hours = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
  const mk = (arr) => arr.map((v, i) => ({ t: hours[i], v }));

  // Shopping-level aggregated data
  const shoppingSeries = [
    {
      label: 'Shopping Center A',
      data: mk([22.0, 21.7, 21.8, 22.3, 23.0, 23.6, 23.2, 22.5]),
      avgTemp: 22.4,
      sensorCount: 12,
    },
    {
      label: 'Shopping Center B',
      data: mk([22.2, 22.0, 22.1, 22.5, 23.2, 23.8, 23.4, 22.7]),
      avgTemp: 22.7,
      sensorCount: 8,
    },
    {
      label: 'Shopping Center C',
      data: mk([21.9, 21.6, 21.7, 22.1, 22.9, 23.4, 23.0, 22.3]),
      avgTemp: 22.1,
      sensorCount: 15,
    },
    {
      label: 'Shopping Center D',
      data: mk([23.2, 23.1, 23.3, 24.0, 24.5, 25.0, 24.6, 24.1]),
      avgTemp: 24.0,
      sensorCount: 10,
    },
  ];

  // KPIs
  const globalAvgTemp = 22.8;
  const totalSensors = 45;
  const shoppingsOnline = 4;
  const alertCount = 1;

  return { shoppingSeries, globalAvgTemp, totalSensors, shoppingsOnline, alertCount };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatTemperature(value) {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return `${Number(value).toFixed(1)}°C`;
}

function formatKW(value) {
  return `${Number(value || 0).toFixed(1)} kW`;
}

function formatOperationTime(minutes) {
  const min = Number(minutes || 0);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function getTemperatureStatus(avgTemp, target = 23, tolerance = 2) {
  if (avgTemp === null || avgTemp === undefined || isNaN(avgTemp)) return 'no_info';
  if (avgTemp < target - tolerance) return 'cold';
  if (avgTemp > target + tolerance) return 'hot';
  return 'normal';
}

function showLoadingOverlay(show) {
  const overlay = document.getElementById('temperature-loading-overlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

// ============================================
// KPIs RENDERING
// ============================================

function setKpis({ globalAvgTemp, totalSensors, shoppingsOnline, alertCount }) {
  const ctx = self.ctx;
  const target = Number(ctx.settings?.targetTemp ?? DEFAULT_SETTINGS.targetTemp);
  const tol = Number(ctx.settings?.targetTol ?? DEFAULT_SETTINGS.targetTol);

  // Average Temperature KPI
  const $avgTemp = document.getElementById('avgTemp');
  const $avgTempBar = document.getElementById('avgTempBar');
  const $avgTempTarget = document.getElementById('avgTempTarget');

  if ($avgTemp) $avgTemp.textContent = formatTemperature(globalAvgTemp);
  if ($avgTempTarget) $avgTempTarget.textContent = `Meta: ${target}°C +/- ${tol}°C`;
  if ($avgTempBar) {
    const span = Math.max(0, Math.min(100, ((globalAvgTemp - (target - tol)) / (2 * tol)) * 100));
    $avgTempBar.style.width = `${span}%`;
  }

  // Total Sensors KPI
  const $totalSensors = document.getElementById('totalSensors');
  if ($totalSensors) $totalSensors.textContent = totalSensors || 0;

  // Shoppings Online KPI
  const $shoppingsOnline = document.getElementById('shoppingsOnline');
  const $shoppingsBadge = document.getElementById('shoppingsBadge');
  if ($shoppingsOnline) $shoppingsOnline.textContent = shoppingsOnline || 0;
  if ($shoppingsBadge) $shoppingsBadge.classList.toggle('badge-on', shoppingsOnline > 0);

  // Alerts KPI
  const $alertCount = document.getElementById('alertCount');
  if ($alertCount) {
    $alertCount.textContent = alertCount || 0;
    $alertCount.classList.toggle('has-alerts', alertCount > 0);
  }
}

// ============================================
// CHART RENDERING
// ============================================

function renderComparisonChart(shoppingSeries) {
  const canvas = document.getElementById('tempChart');
  if (!canvas) {
    LogHelper.error('[TEMPERATURE] Chart canvas not found');
    return;
  }

  // Destroy existing chart
  if (STATE.chartInstance) {
    STATE.chartInstance.destroy();
    STATE.chartInstance = null;
  }

  if (!shoppingSeries || shoppingSeries.length === 0) {
    LogHelper.warn('[TEMPERATURE] No data for chart');
    return;
  }

  const labels = shoppingSeries[0]?.data?.map((p) => p.t) || [];

  // Color palette for shopping centers
  const colors = [
    { border: '#e65100', bg: 'rgba(230, 81, 0, 0.1)' },
    { border: '#1565c0', bg: 'rgba(21, 101, 192, 0.1)' },
    { border: '#2e7d32', bg: 'rgba(46, 125, 50, 0.1)' },
    { border: '#7b1fa2', bg: 'rgba(123, 31, 162, 0.1)' },
    { border: '#c62828', bg: 'rgba(198, 40, 40, 0.1)' },
    { border: '#00838f', bg: 'rgba(0, 131, 143, 0.1)' },
    { border: '#ef6c00', bg: 'rgba(239, 108, 0, 0.1)' },
    { border: '#6a1b9a', bg: 'rgba(106, 27, 154, 0.1)' },
  ];

  const datasets = shoppingSeries.map((series, i) => ({
    label: `${series.label} (${series.sensorCount || 0} sensores)`,
    data: series.data.map((p) => p.v),
    fill: false,
    tension: 0.35,
    borderWidth: 2,
    borderColor: colors[i % colors.length].border,
    backgroundColor: colors[i % colors.length].bg,
    pointRadius: 3,
    pointHoverRadius: 5,
  }));

  STATE.chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          grid: { color: 'rgba(28,39,67,0.08)', drawTicks: false },
          ticks: { font: { size: 11 } },
        },
        y: {
          grid: { color: 'rgba(28,39,67,0.08)' },
          suggestedMin: 18,
          suggestedMax: 30,
          ticks: {
            font: { size: 11 },
            callback: (value) => `${value}°C`,
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 15,
            font: { size: 11 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(28, 39, 67, 0.95)',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 12,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              return `${label}: ${formatTemperature(value)}`;
            },
          },
        },
      },
    },
  });

  LogHelper.log('[TEMPERATURE] Chart rendered with', shoppingSeries.length, 'shopping series');
}

// ============================================
// SHOPPING LIST RENDERING
// ============================================

function renderShoppingList(shoppingSeries) {
  const $list = document.getElementById('shoppingList');
  if (!$list) return;

  $list.innerHTML = '';

  if (!shoppingSeries || shoppingSeries.length === 0) {
    $list.innerHTML = `
      <div class="empty-list">
        <span>Nenhum shopping com sensores de temperatura</span>
      </div>
    `;
    return;
  }

  const ctx = self.ctx;
  const target = Number(ctx.settings?.targetTemp ?? DEFAULT_SETTINGS.targetTemp);
  const tol = Number(ctx.settings?.targetTol ?? DEFAULT_SETTINGS.targetTol);

  shoppingSeries.forEach((shopping) => {
    const status = getTemperatureStatus(shopping.avgTemp, target, tol);
    const statusLabels = {
      normal: 'Normal',
      cold: 'Frio',
      hot: 'Quente',
      no_info: 'Sem Dados',
    };

    const row = document.createElement('div');
    row.className = `shopping-row status-${status}`;
    row.innerHTML = `
      <div class="shopping-left">
        <span class="dot ${status}"></span>
        <div>
          <div class="shopping-name">${shopping.label}</div>
          <div class="shopping-sensors">${shopping.sensorCount || 0} sensores</div>
        </div>
      </div>
      <div class="ft">
        <div class="label">Temp. Media</div>
        <div class="value">${formatTemperature(shopping.avgTemp)}</div>
      </div>
      <div class="ft">
        <div class="label">Min / Max</div>
        <div class="value">${formatTemperature(shopping.minTemp)} / ${formatTemperature(
      shopping.maxTemp
    )}</div>
      </div>
      <div class="ft">
        <div class="label">Status</div>
        <div class="value status-badge ${status}">${statusLabels[status]}</div>
      </div>
    `;

    $list.appendChild(row);
  });

  LogHelper.log('[TEMPERATURE] Shopping list rendered with', shoppingSeries.length, 'items');
}

async function openShoppingTemperatureModal(shopping) {
  LogHelper.log('[TEMPERATURE] Opening modal for shopping:', shopping.label);

  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.openTemperatureComparisonModal) {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      LogHelper.error('[TEMPERATURE] JWT token not found');
      return;
    }

    // Get sensors for this shopping
    const shoppingSensors = STATE.allSensors.filter((s) => s.customerId === shopping.customerId);

    const devices = shoppingSensors.map((sensor) => ({
      id: sensor.id,
      label: sensor.label || sensor.name,
      customerName: shopping.label,
      temperatureMin: sensor.temperatureMin || 18,
      temperatureMax: sensor.temperatureMax || 26,
    }));

    if (devices.length === 0) {
      window.alert(`Nenhum sensor encontrado para ${shopping.label}`);
      return;
    }

    try {
      const dateRange = window.myioDateRange || {};
      const now = new Date();
      const startDate = dateRange.startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = dateRange.endDate || now.toISOString();

      await MyIOLibrary.openTemperatureComparisonModal({
        token: token,
        devices: devices,
        startDate: startDate,
        endDate: endDate,
        locale: 'pt-BR',
        theme: 'dark',
        onClose: () => {
          LogHelper.log('[TEMPERATURE] Shopping temperature modal closed');
        },
      });
    } catch (error) {
      LogHelper.error('[TEMPERATURE] Error opening temperature modal:', error);
    }
  } else {
    LogHelper.warn('[TEMPERATURE] openTemperatureComparisonModal not available');
    window.alert('Modal de temperatura não disponível');
  }
}

// ============================================
// DATA AGGREGATION
// ============================================

function aggregateByShoppingCenter(sensors) {
  const shoppingMap = new Map();

  sensors.forEach((sensor) => {
    const customerId = sensor.customerId || 'unknown';
    const customerName = sensor.customerName || 'Desconhecido';

    if (!shoppingMap.has(customerId)) {
      shoppingMap.set(customerId, {
        customerId,
        label: customerName,
        sensors: [],
        temperatures: [],
        avgTemp: null,
        minTemp: null,
        maxTemp: null,
        sensorCount: 0,
        lastUpdate: 0,
        data: [],
      });
    }

    const shopping = shoppingMap.get(customerId);
    shopping.sensors.push(sensor);

    if (sensor.temperature !== null && sensor.temperature !== undefined && !isNaN(sensor.temperature)) {
      shopping.temperatures.push(Number(sensor.temperature));
      shopping.lastUpdate = Math.max(shopping.lastUpdate, sensor.lastUpdate || 0);
    }
  });

  // Calculate aggregates
  const result = Array.from(shoppingMap.values()).map((shopping) => {
    const temps = shopping.temperatures;
    if (temps.length > 0) {
      shopping.avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      shopping.minTemp = Math.min(...temps);
      shopping.maxTemp = Math.max(...temps);
    }
    shopping.sensorCount = shopping.sensors.length;

    // Generate mock time series data for chart (in production, this would come from API)
    const hours = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
    shopping.data = hours.map((t) => ({
      t,
      v: shopping.avgTemp !== null ? shopping.avgTemp + (Math.random() - 0.5) * 2 : null,
    }));

    return shopping;
  });

  // Sort by average temperature descending
  result.sort((a, b) => (b.avgTemp || 0) - (a.avgTemp || 0));

  return result;
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchTemperatureData() {
  LogHelper.log('[TEMPERATURE] Fetching temperature data...');
  STATE.isLoading = true;
  showLoadingOverlay(true);

  try {
    const ctx = self.ctx;
    const useDemo = !!ctx.settings?.useDemoData;

    if (useDemo) {
      const demoData = makeDemo();
      return demoData;
    }

    // RFC-0100: Try to get data from orchestrator first
    const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
    if (orchestrator && typeof orchestrator.getTemperatureCache === 'function') {
      const tempCache = orchestrator.getTemperatureCache();
      if (tempCache && tempCache.allShoppingsData && tempCache.allShoppingsData.length > 0) {
        LogHelper.log('[TEMPERATURE] Using data from orchestrator:', tempCache.allShoppingsData.length, 'shoppings');

        // Transform orchestrator data to shoppingSeries format
        const shoppingSeries = tempCache.allShoppingsData.map((shop) => ({
          label: shop.name,
          shoppingId: shop.customerId,
          shoppingName: shop.name,
          avgTemp: shop.avg,
          sensorCount: shop.deviceCount || 0,
          data: [], // Historical data not available from orchestrator yet
        }));

        STATE.allSensors = tempCache.devices || [];
        STATE.shoppingData = shoppingSeries;
        STATE.orchestratorData = tempCache;

        return {
          shoppingSeries,
          globalAvgTemp: tempCache.globalAvg || tempCache.filteredAvg,
          totalSensors: tempCache.devices?.length || 0,
          shoppingsOnline: shoppingSeries.length,
          alertCount: tempCache.shoppingsOutOfRange?.length || 0,
        };
      }
    }

    // Fallback: Collect sensors from ctx.data
    const sensors = [];
    if (ctx && ctx.data) {
      ctx.data.forEach((data) => {
        if (data.datasource && data.datasource.aliasName !== 'Shopping') {
          const entityId = data.datasource.entity?.id?.id;
          const keyName = data.dataKey?.name;

          if (entityId && keyName === 'temperature') {
            const existingSensor = sensors.find((s) => s.id === entityId);
            if (!existingSensor) {
              sensors.push({
                id: entityId,
                name: data.datasource.name,
                label: data.datasource.entityLabel || data.datasource.name,
                temperature: data.data?.[0]?.[1] || null,
                lastUpdate: data.data?.[0]?.[0] || null,
                customerId: data.datasource.customerId || null,
                customerName: data.datasource.customerName || 'N/A',
                temperatureMin: 18,
                temperatureMax: 26,
              });
            } else {
              existingSensor.temperature = data.data?.[0]?.[1] || existingSensor.temperature;
              existingSensor.lastUpdate = data.data?.[0]?.[0] || existingSensor.lastUpdate;
            }
          }
        }
      });
    }

    STATE.allSensors = sensors;

    // Filter by selected shoppings
    let filteredSensors = sensors;
    if (STATE.selectedShoppingIds && STATE.selectedShoppingIds.length > 0) {
      filteredSensors = sensors.filter((s) => STATE.selectedShoppingIds.includes(s.customerId));
    }

    // Aggregate by shopping center
    const shoppingSeries = aggregateByShoppingCenter(filteredSensors);

    // Calculate global KPIs
    const allTemps = filteredSensors
      .filter((s) => s.temperature !== null && !isNaN(s.temperature))
      .map((s) => Number(s.temperature));

    const globalAvgTemp = allTemps.length > 0 ? allTemps.reduce((a, b) => a + b, 0) / allTemps.length : null;

    const ctx2 = self.ctx;
    const target = Number(ctx2.settings?.targetTemp ?? DEFAULT_SETTINGS.targetTemp);
    const tol = Number(ctx2.settings?.targetTol ?? DEFAULT_SETTINGS.targetTol);

    const alertCount = shoppingSeries.filter((s) => {
      const status = getTemperatureStatus(s.avgTemp, target, tol);
      return status === 'hot' || status === 'cold';
    }).length;

    return {
      shoppingSeries,
      globalAvgTemp,
      totalSensors: filteredSensors.length,
      shoppingsOnline: shoppingSeries.filter((s) => s.sensorCount > 0).length,
      alertCount,
    };
  } catch (error) {
    LogHelper.error('[TEMPERATURE] Error fetching data:', error);
    return makeDemo();
  } finally {
    STATE.isLoading = false;
    showLoadingOverlay(false);
  }
}

// ============================================
// MAIN UPDATE FUNCTION
// ============================================

async function updateAll() {
  const data = await fetchTemperatureData();

  if (!data) {
    LogHelper.warn('[TEMPERATURE] No data available, using demo');
    const demo = makeDemo();
    renderComparisonChart(demo.shoppingSeries);
    setKpis(demo);
    renderShoppingList(demo.shoppingSeries);
    return;
  }

  STATE.shoppingData = data.shoppingSeries;
  renderComparisonChart(data.shoppingSeries);
  setKpis(data);
  renderShoppingList(data.shoppingSeries);
}

// ============================================
// RFC-0098: TEMPERATURE 7-DAY CHART FUNCTIONS
// ============================================

/**
 * RFC-0098: Fetch real temperature day averages via orchestrator
 * Returns structured data with per-shopping breakdown
 */
async function fetch7DaysTemperature(period = 7) {
  LogHelper.log('[TEMPERATURE] [RFC-0098] Fetching real temperature data for', period, 'days');

  // Calculate time range
  const now = new Date();
  const endTs = now.getTime();
  const startTs = endTs - period * 24 * 60 * 60 * 1000;

  // Try to get data from orchestrator
  const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
  if (orchestrator && typeof orchestrator.fetchTemperatureDayAverages === 'function') {
    try {
      const data = await orchestrator.fetchTemperatureDayAverages(startTs, endTs);
      if (data && data.labels && data.labels.length > 0) {
        LogHelper.log('[TEMPERATURE] [RFC-0098] Got real data from orchestrator:', data.labels.length, 'days');
        return data;
      }
    } catch (err) {
      LogHelper.error('[TEMPERATURE] [RFC-0098] Error fetching from orchestrator:', err);
    }
  }

  // Fallback: Generate empty structure with date labels
  LogHelper.warn('[TEMPERATURE] [RFC-0098] Orchestrator not available, using empty data');
  const labels = [];
  for (let i = period - 1; i >= 0; i--) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() - i);
    labels.push(dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
  }

  return {
    labels,
    dailyTotals: new Array(period).fill(null),
    shoppingData: {},
    shoppingNames: {},
    fetchTimestamp: Date.now(),
  };
}

/**
 * RFC-0098: Data fetching adapter for the standardized Consumption7DaysChart component
 */
async function fetchTemperatureDataAdapter(period) {
  LogHelper.log('[TEMPERATURE] [RFC-0098] Fetching data via adapter for', period, 'days');

  // Update chartConfig period
  chartConfig.period = period;

  // Fetch temperature data
  const data = await fetch7DaysTemperature(period);

  return {
    labels: data.labels || [],
    dailyTotals: data.dailyTotals || [],
    shoppingData: data.shoppingData || {},
    shoppingNames: data.shoppingNames || {},
    fetchTimestamp: Date.now(),
  };
}

/**
 * RFC-0098: Initialize the 7-day temperature chart using the standardized component
 */
async function initializeTemperature7DaysChart() {
  // RFC-0098: Check for createConsumptionChartWidget first (it creates its own canvas)
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createConsumptionChartWidget) {
    LogHelper.log('[TEMPERATURE] [RFC-0098] Using createConsumptionChartWidget component');

    // Get widget container for ThingsBoard compatibility
    const $container = self.ctx?.$container || null;

    // Check if container exists (either via $container or document)
    const containerId = 'temperature-chart-widget';
    const containerEl = $container
      ? $container[0]?.querySelector?.(`#${containerId}`) || $container.find?.(`#${containerId}`)?.[0]
      : document.getElementById(containerId);

    if (!containerEl) {
      LogHelper.warn('[TEMPERATURE] [RFC-0098] Container temperature-chart-widget not found');
      return;
    }

    // Get customer attributes for ideal range
    const ctx = self.ctx;
    const minTemp = Number(ctx.settings?.minTemperature ?? 20);
    const maxTemp = Number(ctx.settings?.maxTemperature ?? 24);

    consumptionChartInstance = MyIOLibrary.createConsumptionChartWidget({
      domain: 'temperature',
      containerId: 'temperature-chart-widget',
      title: 'Temperatura - 7 dias',
      unit: '°C',
      decimalPlaces: 1,
      chartHeight: 280,
      defaultPeriod: chartConfig.period || 7,
      defaultChartType: chartConfig.chartType || 'line',
      defaultVizMode: chartConfig.vizMode || 'total',
      theme: 'light',
      $container: $container,

      // Ideal range from customer attributes
      idealRange:
        minTemp > 0 || maxTemp > 0
          ? {
              min: minTemp,
              max: maxTemp,
              color: 'rgba(34, 197, 94, 0.15)',
              borderColor: 'rgba(34, 197, 94, 0.4)',
              label: 'Faixa Ideal',
              enabled: true,
            }
          : null,

      // Data fetching via adapter
      fetchData: fetchTemperatureDataAdapter,

      // Callbacks
      onDataLoaded: (data) => {
        cachedChartData = data;
        LogHelper.log('[TEMPERATURE] [RFC-0098] Data loaded:', data.labels?.length, 'days');
      },
      onError: (error) => {
        LogHelper.error('[TEMPERATURE] [RFC-0098] Chart error:', error);
      },
    });

    // Render the chart
    await consumptionChartInstance.render();
    LogHelper.log('[TEMPERATURE] [RFC-0098] Temperature 7-day chart rendered successfully');
    return;
  }

  // Fallback: Legacy initialization (simplified)
  LogHelper.warn('[TEMPERATURE] [RFC-0098] createConsumptionChartWidget not available');
}

/**
 * RFC-0098: Setup chart tab handlers for temperature 7-day chart
 * NOTE: The createConsumptionChartWidget component now handles tabs internally.
 * This function is kept for backwards compatibility with external tabs if present.
 */
function setupTemperatureChartTabs() {
  // RFC-0098: The widget component injects its own tabs, so external tabs may not exist
  const vizTabs = document.querySelectorAll('.viz-mode-tabs .chart-tab');
  const typeTabs = document.querySelectorAll('.chart-type-tabs .chart-tab');

  if (vizTabs.length === 0 && typeTabs.length === 0) {
    LogHelper.log('[TEMPERATURE] [RFC-0098] No external tabs found - widget handles tabs internally');
    return;
  }

  // Setup external vizMode tabs (if present)
  vizTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      vizTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const newVizMode = tab.dataset.viz;
      chartConfig.vizMode = newVizMode;

      if (consumptionChartInstance && typeof consumptionChartInstance.setVizMode === 'function') {
        consumptionChartInstance.setVizMode(newVizMode);
      }
    });
  });

  // Setup external chartType tabs (if present)
  typeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      typeTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const newChartType = tab.dataset.type;
      chartConfig.chartType = newChartType;

      if (consumptionChartInstance && typeof consumptionChartInstance.setChartType === 'function') {
        consumptionChartInstance.setChartType(newChartType);
      }
    });
  });

  LogHelper.log('[TEMPERATURE] [RFC-0098] External tab handlers setup (if present)');
}

// ============================================
// EVENT HANDLERS
// ============================================

function bindEventListeners() {
  // Listen for shopping filter events
  self._onFilterApplied = (ev) => {
    LogHelper.log('[TEMPERATURE] heard myio:filter-applied:', ev.detail);

    const selection = ev.detail?.selection || [];
    const shoppingIds = selection.map((s) => s.value).filter((v) => v);

    STATE.selectedShoppingIds = shoppingIds;
    updateAll();
  };
  window.addEventListener('myio:filter-applied', self._onFilterApplied);

  // Listen for date range updates
  self._onDateUpdate = (ev) => {
    LogHelper.log('[TEMPERATURE] heard myio:update-date:', ev.detail);

    STATE.dateRange.start = ev.detail?.startDate;
    STATE.dateRange.end = ev.detail?.endDate;
    updateAll();
  };
  window.addEventListener('myio:update-date', self._onDateUpdate);

  // RFC-0100: Listen for temperature data from MAIN orchestrator
  self._onTemperatureDataReady = (ev) => {
    LogHelper.log('[TEMPERATURE] RFC-0100: Received myio:temperature-data-ready:', ev.detail);
    const data = ev.detail;
    if (data && data.allShoppingsData) {
      // Store data in STATE for use by chart and other components
      STATE.orchestratorData = data;

      // Transform orchestrator data to shoppingSeries format
      const shoppingSeries = data.allShoppingsData.map((shop) => ({
        label: shop.name,
        shoppingId: shop.customerId,
        shoppingName: shop.name,
        avgTemp: shop.avg,
        sensorCount: shop.deviceCount || 0,
        data: [], // Historical data not available from orchestrator yet
      }));

      STATE.shoppingData = shoppingSeries;
      STATE.allSensors = data.devices || [];

      // Update comparison chart with real data
      renderComparisonChart(shoppingSeries);
      setKpis({
        globalAvgTemp: data.globalAvg || data.filteredAvg,
        totalSensors: data.devices?.length || 0,
        shoppingsOnline: shoppingSeries.length,
        alertCount: data.shoppingsOutOfRange?.length || 0,
      });
      renderShoppingList(shoppingSeries);
    }
  };
  window.addEventListener('myio:temperature-data-ready', self._onTemperatureDataReady);
}

// ============================================
// WIDGET LIFECYCLE
// ============================================

self.onInit = function () {
  LogHelper.log('[TEMPERATURE] RFC-0092: onInit');
  const ctx = self.ctx;

  // Set target temp display
  const $avgTempTarget = document.getElementById('avgTempTarget');
  if ($avgTempTarget) {
    const target = Number(ctx.settings?.targetTemp ?? DEFAULT_SETTINGS.targetTemp);
    const tol = Number(ctx.settings?.targetTol ?? DEFAULT_SETTINGS.targetTol);
    $avgTempTarget.textContent = `Meta: ${target}°C +/- ${tol}°C`;
  }

  // Bind event listeners
  bindEventListeners();

  // RFC-0098: Setup tab handlers for 7-day chart
  setupTemperatureChartTabs();

  // RFC-0098: Initialize 7-day temperature chart (async)
  setTimeout(() => {
    initializeTemperature7DaysChart();
  }, 500);

  // Initial render
  updateAll();

  // RFC-0100: Request temperature data from MAIN orchestrator
  // The data will arrive via myio:temperature-data-ready event
  setTimeout(() => {
    const dateRange = window.myioGlobalDates || {};
    const startTs = dateRange.startMs || Date.now() - 7 * 24 * 60 * 60 * 1000;
    const endTs = dateRange.endMs || Date.now();

    window.dispatchEvent(
      new CustomEvent('myio:request-temperature-data', {
        detail: { startTs, endTs },
      })
    );
    LogHelper.log('[TEMPERATURE] RFC-0100: Requested temperature data from MAIN');
  }, 100);
};

self.onDataUpdated = function () {
  LogHelper.log('[TEMPERATURE] onDataUpdated');
  updateAll();
};

self.onResize = function () {
  // Chart.js handles resize automatically
  if (STATE.chartInstance) {
    STATE.chartInstance.resize();
  }
};

self.onDestroy = function () {
  // RFC-0098: Cleanup 7-day consumption chart instance
  if (consumptionChartInstance && typeof consumptionChartInstance.destroy === 'function') {
    LogHelper.log('[TEMPERATURE] [RFC-0098] Destroying consumption chart instance');
    consumptionChartInstance.destroy();
    consumptionChartInstance = null;
  }

  // Cleanup comparison chart
  if (STATE.chartInstance) {
    STATE.chartInstance.destroy();
    STATE.chartInstance = null;
  }

  // Remove event listeners
  if (self._onFilterApplied) {
    window.removeEventListener('myio:filter-applied', self._onFilterApplied);
  }
  if (self._onDateUpdate) {
    window.removeEventListener('myio:update-date', self._onDateUpdate);
  }
  if (self._onTemperatureDataReady) {
    window.removeEventListener('myio:temperature-data-ready', self._onTemperatureDataReady);
  }

  LogHelper.log('[TEMPERATURE] Widget destroyed');
};
