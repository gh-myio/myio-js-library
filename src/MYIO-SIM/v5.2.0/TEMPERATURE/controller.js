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
    { label: 'Shopping Center A', data: mk([22.0, 21.7, 21.8, 22.3, 23.0, 23.6, 23.2, 22.5]), avgTemp: 22.4, sensorCount: 12 },
    { label: 'Shopping Center B', data: mk([22.2, 22.0, 22.1, 22.5, 23.2, 23.8, 23.4, 22.7]), avgTemp: 22.7, sensorCount: 8 },
    { label: 'Shopping Center C', data: mk([21.9, 21.6, 21.7, 22.1, 22.9, 23.4, 23.0, 22.3]), avgTemp: 22.1, sensorCount: 15 },
    { label: 'Shopping Center D', data: mk([23.2, 23.1, 23.3, 24.0, 24.5, 25.0, 24.6, 24.1]), avgTemp: 24.0, sensorCount: 10 },
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
        <div class="value">${formatTemperature(shopping.minTemp)} / ${formatTemperature(shopping.maxTemp)}</div>
      </div>
      <div class="ft">
        <div class="label">Status</div>
        <div class="value status-badge ${status}">${statusLabels[status]}</div>
      </div>
      <button class="shopping-action" title="Ver detalhes" aria-label="Ver detalhes">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
      </button>
    `;

    // Add click handler for details
    row.querySelector('.shopping-action').addEventListener('click', (e) => {
      e.stopPropagation();
      openShoppingTemperatureModal(shopping);
    });

    row.addEventListener('click', () => {
      openShoppingTemperatureModal(shopping);
    });

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
      alert(`Nenhum sensor encontrado para ${shopping.label}`);
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
    alert('Modal de temperatura não disponível');
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

    // Collect sensors from ctx.data
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

  // Initial render
  updateAll();
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
  // Cleanup chart
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

  LogHelper.log('[TEMPERATURE] Widget destroyed');
};
