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
  comparisonChartType: 'bar', // RFC-0159: 'bar' or 'line' for comparison chart
  // RFC-0159: Orchestrator data cache for consistent alert counts with HEADER
  orchestratorAlertCount: null,
  shoppingsOutOfRange: [],
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

function renderComparisonChart(shoppingSeries, chartType) {
  const canvas = document.getElementById('tempChart');
  if (!canvas) {
    LogHelper.error('[TEMPERATURE] Chart canvas not found');
    return;
  }

  // Use provided chartType or fall back to STATE
  const type = chartType || STATE.comparisonChartType || 'bar';

  // Destroy existing chart
  if (STATE.chartInstance) {
    STATE.chartInstance.destroy();
    STATE.chartInstance = null;
  }

  if (!shoppingSeries || shoppingSeries.length === 0) {
    LogHelper.warn('[TEMPERATURE] No data for chart');
    return;
  }

  // Get target temperature settings for ideal range
  const ctx = self.ctx;
  const target = Number(ctx.settings?.targetTemp ?? DEFAULT_SETTINGS.targetTemp);
  const tol = Number(ctx.settings?.targetTol ?? DEFAULT_SETTINGS.targetTol);
  const minIdeal = target - tol;
  const maxIdeal = target + tol;

  // Sort by name for line chart (alphabetical), by avgTemp for bar chart
  const sortedSeries = type === 'line'
    ? [...shoppingSeries].sort((a, b) => (a.label || '').localeCompare(b.label || ''))
    : [...shoppingSeries].sort((a, b) => (b.avgTemp || 0) - (a.avgTemp || 0));

  // Labels are shopping names
  const labels = sortedSeries.map((s) => s.label || 'Desconhecido');

  // Color based on temperature status
  const backgroundColors = sortedSeries.map((s) => {
    const status = getTemperatureStatus(s.avgTemp, target, tol);
    if (status === 'hot') return 'rgba(198, 40, 40, 0.8)'; // Red
    if (status === 'cold') return 'rgba(21, 101, 192, 0.8)'; // Blue
    return 'rgba(46, 125, 50, 0.8)'; // Green for normal
  });

  const borderColors = sortedSeries.map((s) => {
    const status = getTemperatureStatus(s.avgTemp, target, tol);
    if (status === 'hot') return '#c62828';
    if (status === 'cold') return '#1565c0';
    return '#2e7d32';
  });

  // RFC-0159: Build chart configuration based on type
  if (type === 'line') {
    // RFC-0159: LINE CHART with multiple datasets (one line per shopping)
    // Define distinct colors for each shopping
    const lineColors = [
      { bg: 'rgba(230, 81, 0, 0.2)', border: '#e65100' },    // Orange
      { bg: 'rgba(21, 101, 192, 0.2)', border: '#1565c0' },  // Blue
      { bg: 'rgba(46, 125, 50, 0.2)', border: '#2e7d32' },   // Green
      { bg: 'rgba(156, 39, 176, 0.2)', border: '#9c27b0' },  // Purple
      { bg: 'rgba(0, 150, 136, 0.2)', border: '#009688' },   // Teal
      { bg: 'rgba(255, 87, 34, 0.2)', border: '#ff5722' },   // Deep Orange
      { bg: 'rgba(63, 81, 181, 0.2)', border: '#3f51b5' },   // Indigo
      { bg: 'rgba(233, 30, 99, 0.2)', border: '#e91e63' },   // Pink
    ];

    // Create one dataset per shopping (each shopping gets its own "line")
    // X-axis shows a single label "Temperatura Atual"
    const datasets = sortedSeries.map((shopping, index) => {
      const colorSet = lineColors[index % lineColors.length];
      const status = getTemperatureStatus(shopping.avgTemp, target, tol);

      return {
        label: shopping.label || `Shopping ${index + 1}`,
        data: [shopping.avgTemp !== null ? Number(shopping.avgTemp.toFixed(1)) : null],
        backgroundColor: colorSet.bg,
        borderColor: colorSet.border,
        borderWidth: 2,
        fill: false,
        tension: 0,
        pointBackgroundColor: colorSet.border,
        pointBorderColor: colorSet.border,
        pointRadius: 8,
        pointHoverRadius: 10,
        pointStyle: 'circle',
        // Store metadata for tooltip
        _shopping: shopping,
        _status: status,
      };
    });

    STATE.chartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['Temperatura Atual'],
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: true,
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 12, weight: 'bold' },
            },
          },
          y: {
            grid: { color: 'rgba(28,39,67,0.08)' },
            suggestedMin: 15,
            suggestedMax: 35,
            ticks: {
              font: { size: 11 },
              callback: (value) => `${value}°C`,
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(28, 39, 67, 0.95)',
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            padding: 12,
            callbacks: {
              title: (items) => {
                if (items.length === 0) return '';
                return items[0].dataset.label || 'Shopping';
              },
              label: (context) => {
                const dataset = context.dataset;
                const shopping = dataset._shopping;
                const value = context.parsed.y;
                const sensorCount = shopping?.sensorCount || 0;
                const status = dataset._status;
                const statusText = status === 'hot' ? '🔴 Acima' : status === 'cold' ? '🔵 Abaixo' : '🟢 Normal';
                return [
                  `Temperatura: ${formatTemperature(value)}`,
                  `Sensores: ${sensorCount}`,
                  `Status: ${statusText}`,
                  `Faixa ideal: ${minIdeal}°C - ${maxIdeal}°C`,
                ];
              },
            },
          },
          // Annotation for ideal range (horizontal band)
          annotation: {
            annotations: {
              idealRange: {
                type: 'box',
                yMin: minIdeal,
                yMax: maxIdeal,
                backgroundColor: 'rgba(46, 125, 50, 0.1)',
                borderColor: 'rgba(46, 125, 50, 0.3)',
                borderWidth: 1,
              },
              idealRangeMinLine: {
                type: 'line',
                yMin: minIdeal,
                yMax: minIdeal,
                borderColor: 'rgba(46, 125, 50, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
              },
              idealRangeMaxLine: {
                type: 'line',
                yMin: maxIdeal,
                yMax: maxIdeal,
                borderColor: 'rgba(46, 125, 50, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
              },
            },
          },
        },
      },
    });
    LogHelper.log('[TEMPERATURE] Chart rendered with', shoppingSeries.length, 'shopping series (line chart - multi dataset)');
  } else {
    // BAR CHART configuration (horizontal)
    STATE.chartInstance = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Temperatura Média (°C)',
          data: sortedSeries.map((s) => s.avgTemp !== null ? Number(s.avgTemp.toFixed(1)) : null),
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 4,
          barThickness: 28,
        }],
      },
      options: {
        indexAxis: 'y', // Horizontal bar chart
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            grid: { color: 'rgba(28,39,67,0.08)' },
            suggestedMin: 15,
            suggestedMax: 35,
            ticks: {
              font: { size: 11 },
              callback: (value) => `${value}°C`,
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 11 },
              autoSkip: false,
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgba(28, 39, 67, 0.95)',
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            padding: 12,
            callbacks: {
              label: (context) => {
                const series = sortedSeries[context.dataIndex];
                const value = context.parsed.x;
                const sensorCount = series?.sensorCount || 0;
                const status = getTemperatureStatus(value, target, tol);
                const statusText = status === 'hot' ? '🔴 Acima' : status === 'cold' ? '🔵 Abaixo' : '🟢 Normal';
                return [
                  `Temperatura: ${formatTemperature(value)}`,
                  `Sensores: ${sensorCount}`,
                  `Status: ${statusText}`,
                  `Faixa ideal: ${minIdeal}°C - ${maxIdeal}°C`,
                ];
              },
            },
          },
          // Annotation for ideal range (vertical lines)
          annotation: {
            annotations: {
              idealRangeMin: {
                type: 'line',
                xMin: minIdeal,
                xMax: minIdeal,
                borderColor: 'rgba(46, 125, 50, 0.5)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  display: true,
                  content: `Min: ${minIdeal}°C`,
                  position: 'start',
                  font: { size: 10 },
                },
              },
              idealRangeMax: {
                type: 'line',
                xMin: maxIdeal,
                xMax: maxIdeal,
                borderColor: 'rgba(46, 125, 50, 0.5)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  display: true,
                  content: `Max: ${maxIdeal}°C`,
                  position: 'start',
                  font: { size: 10 },
                },
              },
            },
          },
        },
      },
    });
    LogHelper.log('[TEMPERATURE] Chart rendered with', shoppingSeries.length, 'shopping series (bar chart)');
  }
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
    // RFC-0159: Compact card layout for 2-column grid
    row.innerHTML = `
      <div class="shopping-left">
        <span class="dot ${status}"></span>
        <div>
          <div class="shopping-name">${shopping.label}</div>
          <div class="shopping-sensors">${shopping.sensorCount || 0} sensores</div>
        </div>
      </div>
      <div class="shopping-stats">
        <div class="ft">
          <span class="label">Média:</span>
          <span class="value">${formatTemperature(shopping.avgTemp)}</span>
        </div>
        <div class="ft">
          <span class="label">Min/Max:</span>
          <span class="value">${formatTemperature(shopping.minTemp)}/${formatTemperature(shopping.maxTemp)}</span>
        </div>
        <span class="status-badge ${status}">${statusLabels[status]}</span>
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
    // RFC-0159 FIX: Support both customerId/customerName and ownerId/ownerName
    const customerId = sensor.customerId || sensor.ownerId || sensor.ownerName || 'unknown';
    const customerName = sensor.customerName || sensor.ownerName || 'Desconhecido';

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
        LogHelper.log(
          '[TEMPERATURE] Using data from orchestrator:',
          tempCache.allShoppingsData.length,
          'shoppings'
        );

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
  // RFC-0159 FIX: Skip if we already have data rendered from provide-data event
  // This prevents onDataUpdated from clearing data that was already rendered
  if (STATE.allSensors && STATE.allSensors.length > 0 && STATE.shoppingData && STATE.shoppingData.length > 0) {
    LogHelper.log('[TEMPERATURE] Skipping updateAll - data already rendered from events');
    return;
  }

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
 * RFC-0159: Currently returns empty data - historical temperature API not implemented
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
        LogHelper.log(
          '[TEMPERATURE] [RFC-0098] Got real data from orchestrator:',
          data.labels.length,
          'days'
        );
        return data;
      }
    } catch (err) {
      LogHelper.error('[TEMPERATURE] [RFC-0098] Error fetching from orchestrator:', err);
    }
  }

  // RFC-0159: Return null to indicate data is not available
  // This allows the chart initialization to show a proper message
  LogHelper.warn('[TEMPERATURE] [RFC-0159] fetchTemperatureDayAverages not implemented in orchestrator');
  return null;
}

/**
 * RFC-0098: Data fetching adapter for the standardized Consumption7DaysChart component
 * RFC-0159: Returns null if historical data is not available
 */
async function fetchTemperatureDataAdapter(period) {
  LogHelper.log('[TEMPERATURE] [RFC-0098] Fetching data via adapter for', period, 'days');

  // Update chartConfig period
  chartConfig.period = period;

  // Fetch temperature data
  const data = await fetch7DaysTemperature(period);

  // RFC-0159: If data is null, return empty structure to indicate no data
  if (!data) {
    LogHelper.warn('[TEMPERATURE] [RFC-0159] No historical temperature data available');
    return {
      labels: [],
      dailyTotals: [],
      shoppingData: {},
      shoppingNames: {},
      fetchTimestamp: Date.now(),
      noDataAvailable: true,
    };
  }

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
 * RFC-0159: Now uses fetchTemperatureDayAverages from orchestrator
 */
async function initializeTemperature7DaysChart() {
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

  // RFC-0159: Show loading state while waiting for data
  containerEl.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 280px;
      background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
      border: 1px solid #e6eef5;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
    ">
      <div style="font-size: 32px; margin-bottom: 12px; animation: pulse 1.5s ease-in-out infinite;">🌡️</div>
      <p style="margin: 0; font-size: 13px; color: #6b7a90;">Carregando histórico de temperatura...</p>
    </div>
    <style>
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    </style>
  `;

  // RFC-0098: Check for createConsumptionChartWidget first (it creates its own canvas)
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createConsumptionChartWidget) {
    LogHelper.log('[TEMPERATURE] [RFC-0098] Using createConsumptionChartWidget component');

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
// RFC-0159: COMPARISON CHART TABS
// ============================================

/**
 * RFC-0159: Setup event handlers for comparison chart type tabs (bar/line)
 */
function setupComparisonChartTabs() {
  const tabsContainer = document.getElementById('comparisonChartTabs');
  if (!tabsContainer) {
    LogHelper.warn('[TEMPERATURE] Comparison chart tabs container not found');
    return;
  }

  const tabs = tabsContainer.querySelectorAll('.chart-tab-btn');
  if (tabs.length === 0) {
    LogHelper.warn('[TEMPERATURE] No comparison chart tab buttons found');
    return;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      // Update active state
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      // Get chart type from data attribute
      const chartType = tab.dataset.chartType;
      if (!chartType) return;

      LogHelper.log('[TEMPERATURE] RFC-0159: Switching comparison chart to', chartType);

      // Update state
      STATE.comparisonChartType = chartType;

      // Re-render chart with new type
      if (STATE.shoppingData && STATE.shoppingData.length > 0) {
        renderComparisonChart(STATE.shoppingData, chartType);
      }
    });
  });

  LogHelper.log('[TEMPERATURE] RFC-0159: Comparison chart tabs setup complete');
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
    if (data) {
      // Store data in STATE for use by chart and other components
      STATE.orchestratorData = data;

      // RFC-0159: Cache orchestrator's alert data for consistent display with HEADER
      STATE.shoppingsOutOfRange = data.shoppingsOutOfRange || [];
      STATE.orchestratorAlertCount = data.shoppingsOutOfRange?.length || 0;
      LogHelper.log('[TEMPERATURE] RFC-0159: Cached orchestrator alert count:', STATE.orchestratorAlertCount);

      if (data.allShoppingsData) {
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
          alertCount: STATE.orchestratorAlertCount,
        });
        renderShoppingList(shoppingSeries);
      } else {
        // Event has shoppingsOutOfRange but no allShoppingsData - just update KPIs
        setKpis({
          globalAvgTemp: data.globalAvg || data.filteredAvg,
          totalSensors: data.devices?.length || STATE.allSensors?.length || 0,
          shoppingsOnline: (data.shoppingsInRange?.length || 0) + (data.shoppingsOutOfRange?.length || 0),
          alertCount: STATE.orchestratorAlertCount,
        });
      }
    }
  };
  window.addEventListener('myio:temperature-data-ready', self._onTemperatureDataReady);

  // RFC-0159 FIX: Listen for provide-data event from orchestrator
  self._onProvideData = (ev) => {
    const detail = ev?.detail || {};
    if (detail.domain !== 'temperature') return;

    const items = detail.items || [];
    if (!items || items.length === 0) return;

    LogHelper.log('[TEMPERATURE] RFC-0159: Received provide-data for temperature:', items.length, 'items');

    // Store sensors in STATE
    STATE.allSensors = items;

    // Aggregate by shopping center
    const shoppingSeries = aggregateByShoppingCenter(items);

    // Calculate global average temperature
    const allTemps = items
      .filter((s) => s.temperature !== null && s.temperature !== undefined && !isNaN(s.temperature))
      .map((s) => Number(s.temperature));

    const globalAvgTemp = allTemps.length > 0 ? allTemps.reduce((a, b) => a + b, 0) / allTemps.length : null;

    // RFC-0159: Use orchestrator's alert count if available (for consistency with HEADER)
    // Otherwise fall back to local calculation
    let alertCount = STATE.orchestratorAlertCount;
    if (alertCount === null || alertCount === undefined) {
      // Fallback: Calculate locally using widget settings
      const ctx = self.ctx;
      const target = Number(ctx.settings?.targetTemp ?? DEFAULT_SETTINGS.targetTemp);
      const tol = Number(ctx.settings?.targetTol ?? DEFAULT_SETTINGS.targetTol);

      alertCount = shoppingSeries.filter((s) => {
        const status = getTemperatureStatus(s.avgTemp, target, tol);
        return status === 'hot' || status === 'cold';
      }).length;
      LogHelper.log('[TEMPERATURE] RFC-0159: Using local alert calculation:', alertCount);
    } else {
      LogHelper.log('[TEMPERATURE] RFC-0159: Using orchestrator alert count:', alertCount);
    }

    STATE.shoppingData = shoppingSeries;

    // Update UI
    renderComparisonChart(shoppingSeries);
    setKpis({
      globalAvgTemp,
      totalSensors: items.length,
      shoppingsOnline: shoppingSeries.filter((s) => s.sensorCount > 0).length,
      alertCount,
    });
    renderShoppingList(shoppingSeries);

    LogHelper.log('[TEMPERATURE] RFC-0159: Updated with', items.length, 'sensors,', shoppingSeries.length, 'shoppings');
  };
  window.addEventListener('myio:telemetry:provide-data', self._onProvideData);
}

// ============================================
// RFC-0159: FORCE SCROLL IN THINGSBOARD
// ============================================

/**
 * RFC-0159: Force scroll on ThingsBoard parent containers
 * ThingsBoard sets overflow:hidden on .tb-widget which blocks scrolling
 */
function forceScrollOnParentContainers() {
  const root = document.querySelector('.tb-temp-root');
  if (!root) return;

  // Walk up the DOM tree and force overflow:auto on parents
  let parent = root.parentElement;
  let depth = 0;
  const maxDepth = 10;

  while (parent && depth < maxDepth) {
    const tagName = parent.tagName?.toLowerCase() || '';
    const className = parent.className || '';

    // Target ThingsBoard widget containers
    if (tagName === 'tb-widget-container' ||
        className.includes('tb-widget-container') ||
        className.includes('tb-widget')) {
      parent.style.overflow = 'auto';
      parent.style.position = 'relative';
      LogHelper.log(`[TEMPERATURE] RFC-0159: Forced scroll on ${tagName}.${className}`);
    }

    // Also target the direct div.tb-widget inside tb-widget-container
    if (className.includes('tb-widget') && !className.includes('tb-widget-container')) {
      parent.style.overflow = 'auto';
      LogHelper.log(`[TEMPERATURE] RFC-0159: Forced scroll on .tb-widget`);
    }

    parent = parent.parentElement;
    depth++;
  }
}

// ============================================
// WIDGET LIFECYCLE
// ============================================

self.onInit = function () {
  LogHelper.log('[TEMPERATURE] RFC-0092: onInit');
  const ctx = self.ctx;

  // RFC-0159: Force scroll on ThingsBoard containers
  setTimeout(() => forceScrollOnParentContainers(), 100);

  // Set target temp display
  const $avgTempTarget = document.getElementById('avgTempTarget');
  if ($avgTempTarget) {
    const target = Number(ctx.settings?.targetTemp ?? DEFAULT_SETTINGS.targetTemp);
    const tol = Number(ctx.settings?.targetTol ?? DEFAULT_SETTINGS.targetTol);
    $avgTempTarget.textContent = `Meta: ${target}°C +/- ${tol}°C`;
  }

  // Bind event listeners
  bindEventListeners();

  // RFC-0159: Setup tab handlers for comparison chart (bar/line)
  setupComparisonChartTabs();

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
  if (self._onProvideData) {
    window.removeEventListener('myio:telemetry:provide-data', self._onProvideData);
  }

  LogHelper.log('[TEMPERATURE] Widget destroyed');
};
