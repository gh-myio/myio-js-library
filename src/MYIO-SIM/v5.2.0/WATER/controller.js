/* global self, window, document, Chart, MyIOLibrary */
// ============================================
// MYIO-SIM 1.0.0 - WATER Widget Controller
// RFC-0087: Water Consumption Dashboard
// Based on ENERGY widget structure
// ============================================

// ============================================
// CACHE CONFIGURATION
// ============================================

let totalConsumptionCache = {
  data: null,
  storesTotal: 0,
  commonAreaTotal: 0,
  timestamp: null,
};

const TOTAL_CONSUMPTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// ============================================
// RFC-0097: CHART CONFIGURATION STATE
// ============================================

const chartConfig = {
  period: 7, // days: 7, 14, 30, or 0 (custom)
  startDate: null, // ISO string for custom period
  endDate: null, // ISO string for custom period
  granularity: '1d', // '1d' (day) or '1h' (hour)
  vizMode: 'total', // 'total' or 'separate'
  chartType: 'line', // 'line' or 'bar'
};

// RFC-0097: Cache for chart data (avoid re-fetch when switching vizMode/chartType)
let cachedChartData = null;

// RFC-0097: Fullscreen state
let isChartFullscreen = false;
let fullscreenChartInstance = null;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verifica cache de consumo total
 */
function getCachedTotalConsumption() {
  if (!totalConsumptionCache.data) return null;

  const age = Date.now() - totalConsumptionCache.timestamp;
  if (age > TOTAL_CONSUMPTION_CACHE_TTL) {
    console.log('[WATER] Total consumption cache expired');
    return null;
  }

  console.log('[WATER] Using cached total consumption data');
  return totalConsumptionCache.data;
}

/**
 * Armazena dados de consumo total no cache
 */
function cacheTotalConsumption(storesTotal, commonAreaTotal, totalGeral) {
  totalConsumptionCache = {
    data: {
      storesTotal,
      commonAreaTotal,
      totalGeral,
    },
    storesTotal,
    commonAreaTotal,
    timestamp: Date.now(),
  };
  console.log('[WATER] Total consumption data cached:', totalConsumptionCache.data);
}

/**
 * Formata volume de água em m³
 */
function formatWaterVolume(value) {
  if (value == null || isNaN(value)) return '- m³';
  if (value >= 1000) {
    return (value / 1000).toFixed(2).replace('.', ',') + 'k m³';
  }
  return value.toFixed(1).replace('.', ',') + ' m³';
}

// ============================================
// WIDGET CONTAINER HELPER
// ============================================

/**
 * Gets element by ID within the widget container (not global document)
 * This is required for ThingsBoard widgets to work correctly
 */
function $id(id) {
  if (self.ctx && self.ctx.$container) {
    return self.ctx.$container[0].querySelector(`#${id}`);
  }
  // Fallback to global document (should not happen in ThingsBoard context)
  return document.getElementById(id);
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

/**
 * Renderiza a UI do card de consumo de LOJAS
 */
function renderStoresConsumptionUI(data, valueEl, trendEl, infoEl) {
  console.log('[WATER] renderStoresConsumptionUI called:', { data, hasValueEl: !!valueEl });
  if (!data) {
    console.log('[WATER] renderStoresConsumptionUI: data is null/undefined, returning');
    return;
  }

  const totalGeral = data.totalGeral || 0;
  const storesTotal = data.storesTotal || 0;
  const storesPercentage = totalGeral > 0 ? (storesTotal / totalGeral) * 100 : 0;

  if (valueEl) {
    console.log('[WATER] Setting stores value to:', formatWaterVolume(storesTotal));
    valueEl.textContent = formatWaterVolume(storesTotal);
  } else {
    console.log('[WATER] WARNING: valueEl is null for stores card!');
  }

  if (trendEl) {
    trendEl.textContent = `${storesPercentage.toFixed(1)}% do total`;
    trendEl.className = 'trend neutral';
  }

  if (infoEl) {
    infoEl.textContent = 'Hidrômetros de lojas';
  }

  console.log('[WATER] Card de Lojas atualizado:', { storesTotal, storesPercentage });
}

/**
 * Renderiza a UI do card de consumo de ÁREA COMUM
 */
function renderCommonAreaConsumptionUI(data, valueEl, trendEl, infoEl) {
  if (!data) return;

  const totalGeral = data.totalGeral || 0;
  const commonAreaTotal = data.commonAreaTotal || 0;
  const commonAreaPercentage = totalGeral > 0 ? (commonAreaTotal / totalGeral) * 100 : 0;

  if (valueEl) {
    valueEl.textContent = formatWaterVolume(commonAreaTotal);
  }

  if (trendEl) {
    trendEl.textContent = `${commonAreaPercentage.toFixed(1)}% do total`;
    trendEl.className = 'trend neutral';
  }

  if (infoEl) {
    infoEl.textContent = 'Hidrômetros de áreas comuns';
  }

  console.log('[WATER] Card de Área Comum atualizado:', { commonAreaTotal, commonAreaPercentage });
}

/**
 * Renderiza a UI do card de consumo TOTAL
 */
function renderTotalConsumptionUI(data, valueEl, trendEl, infoEl) {
  if (!data) return;

  const totalGeral = data.totalGeral || 0;

  if (valueEl) {
    valueEl.textContent = formatWaterVolume(totalGeral);
  }

  if (trendEl) {
    trendEl.textContent = 'Lojas + Área Comum';
    trendEl.className = 'trend neutral';
  }

  if (infoEl) {
    const storesTotal = data.storesTotal || 0;
    const commonAreaTotal = data.commonAreaTotal || 0;
    infoEl.textContent = `${formatWaterVolume(storesTotal)} lojas | ${formatWaterVolume(
      commonAreaTotal
    )} área comum`;
  }

  console.log('[WATER] Card Total atualizado:', { totalGeral });
}

/**
 * Inicializa cards com estado de loading
 */
function initializeCards() {
  const loadingSpinner = `
    <svg class="loading-spinner" style="width:24px; height:24px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#0288d1" stroke-width="5" stroke-linecap="round"
              stroke-dasharray="90,150" stroke-dashoffset="0">
      </circle>
    </svg>
  `;

  // Stores card
  const storesValueEl = $id('total-consumption-stores-value');
  const storesTrendEl = $id('total-consumption-stores-trend');
  if (storesValueEl) storesValueEl.innerHTML = loadingSpinner;
  if (storesTrendEl) {
    storesTrendEl.textContent = 'Aguardando dados...';
    storesTrendEl.className = 'trend neutral';
  }

  // Common Area card
  const commonAreaValueEl = $id('total-consumption-common-area-value');
  const commonAreaTrendEl = $id('total-consumption-common-area-trend');
  if (commonAreaValueEl) commonAreaValueEl.innerHTML = loadingSpinner;
  if (commonAreaTrendEl) {
    commonAreaTrendEl.textContent = 'Aguardando dados...';
    commonAreaTrendEl.className = 'trend neutral';
  }

  // Total card
  const totalValueEl = $id('total-consumption-value');
  const totalTrendEl = $id('total-consumption-trend');
  if (totalValueEl) totalValueEl.innerHTML = loadingSpinner;
  if (totalTrendEl) {
    totalTrendEl.textContent = 'Aguardando dados...';
    totalTrendEl.className = 'trend neutral';
  }

  console.log('[WATER] Cards initialized with loading state');
}

/**
 * Atualiza todos os cards com dados
 */
function updateAllCards(data) {
  console.log('[WATER] Updating all cards with data:', data);

  // Stores
  renderStoresConsumptionUI(
    data,
    $id('total-consumption-stores-value'),
    $id('total-consumption-stores-trend'),
    $id('total-consumption-stores-info')
  );

  // Common Area
  renderCommonAreaConsumptionUI(
    data,
    $id('total-consumption-common-area-value'),
    $id('total-consumption-common-area-trend'),
    $id('total-consumption-common-area-info')
  );

  // Total
  renderTotalConsumptionUI(
    data,
    $id('total-consumption-value'),
    $id('total-consumption-trend'),
    $id('total-consumption-info')
  );
}

// ============================================
// CHART FUNCTIONS
// ============================================

let lineChartInstance = null;
let pieChartInstance = null;

// RFC-0098: Consumption 7 Days Chart instance (new standardized component)
let consumptionChartInstance = null;

/**
 * RFC-0097: Busca o consumo dos últimos N dias (mock)
 * Returns structured data with per-shopping breakdown for vizMode support
 */
async function fetch7DaysConsumption(period = 7) {
  const labels = [];
  const dailyTotals = [];
  const shoppingData = {};
  const shoppingNames = {};
  const now = new Date();

  // Mock shopping list
  const mockShoppings = [
    { id: 'shop-001', name: 'Shopping Morumbi' },
    { id: 'shop-002', name: 'Shopping Eldorado' },
    { id: 'shop-003', name: 'Shopping Iguatemi' },
  ];

  // Initialize shopping data arrays
  mockShoppings.forEach((shop) => {
    shoppingData[shop.id] = [];
    shoppingNames[shop.id] = shop.name;
  });

  for (let i = period - 1; i >= 0; i--) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() - i);
    dayDate.setHours(0, 0, 0, 0);

    const dayOfWeek = dayDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Format date label
    labels.push(dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

    // Generate per-shopping consumption
    let dayTotal = 0;
    mockShoppings.forEach((shop, index) => {
      const baseConsumption = 80 + index * 30 + Math.random() * 40; // Different base per shopping
      const weekendFactor = isWeekend ? 0.7 : 1.0;
      const consumption = baseConsumption * weekendFactor;
      shoppingData[shop.id].push(Math.round(consumption * 10) / 10);
      dayTotal += consumption;
    });

    dailyTotals.push(Math.round(dayTotal * 10) / 10);
  }

  const result = {
    labels,
    dailyTotals,
    shoppingData,
    shoppingNames,
    fetchTimestamp: Date.now(),
  };

  console.log('[WATER] [RFC-0097] 7 days consumption data:', result);
  return result;
}

/**
 * RFC-0098: Data fetching adapter for the standardized Consumption7DaysChart component
 * Wraps existing fetch logic to conform to the component's expected interface
 * @param {number} period - Number of days to fetch
 * @returns {Promise<object>} - Consumption7DaysData formatted data
 */
async function fetchWaterConsumptionDataAdapter(period) {
  console.log('[WATER] [RFC-0098] Fetching data via adapter for', period, 'days');

  // Update chartConfig period for compatibility with existing modal
  chartConfig.period = period;

  // Use existing fetch logic
  const data = await fetch7DaysConsumption(period);

  return {
    labels: data.labels || [],
    dailyTotals: data.dailyTotals || [],
    shoppingData: data.shoppingData || {},
    shoppingNames: data.shoppingNames || {},
    fetchTimestamp: Date.now(),
  };
}

/**
 * RFC-0098: Inicializa o gráfico de linha (7 dias)
 * Uses standardized Consumption7DaysChart component
 */
async function initializeLineChart() {
  const canvas = $id('lineChart');
  if (!canvas) {
    console.warn('[WATER] lineChart canvas not found');
    return;
  }

  // FIX: Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    console.error('[WATER] Chart.js not loaded, cannot initialize line chart');
    return;
  }

  // RFC-0098: Use standardized component if available
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createConsumption7DaysChart) {
    console.log('[WATER] [RFC-0098] Using createConsumption7DaysChart component');

    // Get widget container for ThingsBoard compatibility
    const $container = self.ctx?.$container || null;

    consumptionChartInstance = MyIOLibrary.createConsumption7DaysChart({
      domain: 'water',
      containerId: 'lineChart',
      unit: 'm³',
      decimalPlaces: 1,
      defaultPeriod: chartConfig.period || 7,
      defaultChartType: chartConfig.chartType || 'line',
      defaultVizMode: chartConfig.vizMode || 'total',
      theme: 'light',
      $container: $container,

      // Colors matching the water domain
      colors: {
        primary: '#0288d1',
        background: 'rgba(2, 136, 209, 0.1)',
        pointBackground: '#0288d1',
        pointBorder: '#ffffff',
      },

      // Data fetching via adapter
      fetchData: fetchWaterConsumptionDataAdapter,

      // Button IDs for handlers
      settingsButtonId: 'configureChartBtn',
      maximizeButtonId: 'maximizeChartBtn',
      titleElementId: 'lineChartTitle',

      // Callbacks
      onSettingsClick: () => {
        console.log('[WATER] [RFC-0098] Settings button clicked');
        openChartConfigModal();
      },
      onMaximizeClick: () => {
        console.log('[WATER] [RFC-0098] Maximize button clicked');
        toggleChartFullscreen();
      },
      onDataLoaded: (data) => {
        // Update cache for fullscreen and other features
        cachedChartData = data;
        console.log('[WATER] [RFC-0098] Data loaded:', data.labels?.length, 'days');
      },
      onError: (error) => {
        console.error('[WATER] [RFC-0098] Chart error:', error);
      },
    });

    // Render the chart
    await consumptionChartInstance.render();
    console.log('[WATER] [RFC-0098] Consumption chart rendered successfully');

    // Store reference for compatibility with existing code
    lineChartInstance = consumptionChartInstance.getChartInstance();
    return;
  }

  // Fallback: Legacy Chart.js initialization
  console.warn('[WATER] [RFC-0098] createConsumption7DaysChart not available, using legacy init');

  const ctx = canvas.getContext('2d');

  // Destroy existing instance
  if (lineChartInstance) {
    lineChartInstance.destroy();
  }

  // Fetch data and cache it
  const data = await fetch7DaysConsumption(chartConfig.period);
  cachedChartData = data;

  // Build datasets based on vizMode
  let datasets = [];
  const colors = ['#0288d1', '#06b6d4', '#0891b2', '#22d3ee', '#67e8f9', '#0369a1', '#0c4a6e'];

  if (chartConfig.vizMode === 'separate' && data.shoppingData && Object.keys(data.shoppingData).length > 1) {
    let colorIndex = 0;
    for (const [shoppingId, values] of Object.entries(data.shoppingData)) {
      const shoppingName = data.shoppingNames?.[shoppingId] || `Shopping ${shoppingId.slice(0, 8)}`;
      datasets.push({
        label: shoppingName,
        data: values,
        borderColor: colors[colorIndex % colors.length],
        backgroundColor:
          chartConfig.chartType === 'line'
            ? `${colors[colorIndex % colors.length]}20`
            : colors[colorIndex % colors.length],
        fill: chartConfig.chartType === 'line',
        tension: 0.4,
        borderWidth: 2,
        pointRadius: chartConfig.chartType === 'line' ? 4 : 0,
        pointBackgroundColor: colors[colorIndex % colors.length],
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        borderRadius: chartConfig.chartType === 'bar' ? 4 : 0,
      });
      colorIndex++;
    }
  } else {
    datasets.push({
      label: 'Consumo (m³)',
      data: data.dailyTotals,
      borderColor: '#0288d1',
      backgroundColor: chartConfig.chartType === 'line' ? 'rgba(2, 136, 209, 0.1)' : '#0288d1',
      fill: chartConfig.chartType === 'line',
      tension: 0.4,
      borderWidth: 2,
      pointRadius: chartConfig.chartType === 'line' ? 4 : 0,
      pointBackgroundColor: '#0288d1',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      borderRadius: chartConfig.chartType === 'bar' ? 4 : 0,
    });
  }

  // Calculate Y-axis max
  const allValues = datasets.flatMap((ds) => ds.data);
  const maxValue = Math.max(...allValues, 0);
  const yAxisMax = maxValue > 0 ? Math.ceil((maxValue * 1.1) / 50) * 50 : 250;

  lineChartInstance = new Chart(ctx, {
    type: chartConfig.chartType,
    data: {
      labels: data.labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // FIX: Disable animation to prevent infinite growth
      plugins: {
        legend: {
          display: chartConfig.vizMode === 'separate',
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} m³`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: yAxisMax, // FIX: Fixed max to prevent animation loop
          title: {
            display: true,
            text: 'm³',
          },
          ticks: {
            callback: function (value) {
              return `${value.toFixed(0)}`;
            },
          },
        },
      },
    },
  });

  console.log(
    '[WATER] [RFC-0097] Line chart initialized with yAxisMax:',
    yAxisMax,
    'vizMode:',
    chartConfig.vizMode,
    'chartType:',
    chartConfig.chartType
  );
}

/**
 * Inicializa o gráfico de barras (distribuição) - igual ao ENERGY
 */
function initializePieChart(data) {
  const canvas = $id('pieChart');
  if (!canvas) {
    console.warn('[WATER] pieChart canvas not found');
    return;
  }

  // FIX: Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    console.error('[WATER] Chart.js not loaded, cannot initialize bar chart');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Destroy existing instance
  if (pieChartInstance) {
    pieChartInstance.destroy();
  }

  const storesTotal = data?.storesTotal || 0;
  const commonAreaTotal = data?.commonAreaTotal || 0;

  // FIX: Calculate fixed X-axis max to prevent infinite growth (horizontal bar)
  const barValues = [storesTotal, commonAreaTotal];
  const maxBarValue = Math.max(...barValues, 0);
  const xAxisMax = maxBarValue > 0 ? Math.ceil((maxBarValue * 1.1) / 100) * 100 : 500;

  pieChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Lojas', 'Área Comum'],
      datasets: [
        {
          label: 'Consumo (m³)',
          data: barValues,
          backgroundColor: ['#06b6d4', '#0288d1'],
          borderColor: ['#0891b2', '#0277bd'],
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // FIX: Disable animation to prevent issues
      indexAxis: 'y', // Horizontal bar chart (same as ENERGY)
      plugins: {
        legend: {
          display: false, // Hide legend for bar chart
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.parsed.x || 0;
              const dataset = context.dataset;
              const total = dataset.data.reduce((sum, val) => sum + val, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${value.toFixed(1)} m³ (${percentage}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max: xAxisMax, // FIX: Fixed max to prevent animation loop
          ticks: {
            callback: function (value) {
              return `${value.toFixed(0)} m³`;
            },
          },
        },
        y: {
          ticks: {
            font: {
              size: 12,
            },
          },
        },
      },
    },
  });

  console.log('[WATER] Bar chart initialized with xAxisMax:', xAxisMax);

  console.log('[WATER] Pie chart initialized');
}

/**
 * Atualiza o gráfico de pizza com novo modo
 */
function updatePieChartMode(mode) {
  console.log('[WATER] Updating pie chart mode:', mode);

  // For now, just reinitialize with current data
  const data = getCachedTotalConsumption();
  initializePieChart(data);
}

// ============================================
// ZOOM CONTROLS
// ============================================

let currentZoom = 100;
const MIN_ZOOM = 70;
const MAX_ZOOM = 130;

function setupZoomControls() {
  const fontMinus = $id('fontMinus');
  const fontPlus = $id('fontPlus');
  const dashboard = document.querySelector('.water-dashboard');

  if (fontMinus) {
    fontMinus.addEventListener('click', () => {
      if (currentZoom > MIN_ZOOM) {
        currentZoom -= 10;
        if (dashboard) {
          dashboard.style.fontSize = `${currentZoom}%`;
        }
        console.log('[WATER] Zoom decreased to:', currentZoom);
      }
    });
  }

  if (fontPlus) {
    fontPlus.addEventListener('click', () => {
      if (currentZoom < MAX_ZOOM) {
        currentZoom += 10;
        if (dashboard) {
          dashboard.style.fontSize = `${currentZoom}%`;
        }
        console.log('[WATER] Zoom increased to:', currentZoom);
      }
    });
  }

  console.log('[WATER] Zoom controls initialized');
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handler para dados de água vindos do MAIN
 * Suporta dois formatos:
 * 1. cache Map - quando MAIN envia dados agregados do waterCache
 * 2. source/data - quando MAIN envia dados específicos por categoria
 */
function handleWaterDataReady(event) {
  const { source, data, cache } = event.detail || {};
  console.log('[WATER] Received water data:', { source, hasCache: !!cache, hasData: !!data });

  // Atualiza cache local
  const cached = getCachedTotalConsumption() || { storesTotal: 0, commonAreaTotal: 0, totalGeral: 0 };

  // PRIORIDADE 1: Usar totais calculados pelo Orchestrator (apenas IDs válidos dos Aliases TB)
  const orchestratorTotals = window.MyIOOrchestrator?.getWaterTotals?.();
  if (orchestratorTotals && orchestratorTotals.total > 0) {
    cached.storesTotal = orchestratorTotals.stores;
    cached.commonAreaTotal = orchestratorTotals.commonArea;
    cached.totalGeral = orchestratorTotals.total;

    console.log('[WATER] Using Orchestrator totals (valid TB aliases):', {
      total: cached.totalGeral,
      stores: cached.storesTotal,
      commonArea: cached.commonAreaTotal,
    });
  }
  // FALLBACK: Formato 1 - cache Map do MAIN (dados agregados - NÃO RECOMENDADO)
  else if (cache instanceof Map && cache.size > 0) {
    let totalFromCache = 0;
    cache.forEach((device) => {
      totalFromCache += Number(device.total_value || 0);
    });

    // FALLBACK: Estima split 60/40 (será corrigido quando widgets registrarem IDs)
    cached.storesTotal = totalFromCache * 0.6;
    cached.commonAreaTotal = totalFromCache * 0.4;
    cached.totalGeral = totalFromCache;

    console.log('[WATER] FALLBACK: Using estimated 60/40 split (waiting for valid IDs):', {
      total: totalFromCache,
      stores: cached.storesTotal,
      commonArea: cached.commonAreaTotal,
      devices: cache.size,
    });
  }
  // Formato 2: source/data específico por categoria
  else if (source === 'WATER_COMMON_AREA' && data) {
    cached.commonAreaTotal = data.totalConsumption || 0;
    cached.totalGeral = cached.storesTotal + cached.commonAreaTotal;
  } else if (source === 'WATER_STORES' && data) {
    cached.storesTotal = data.totalConsumption || 0;
    cached.totalGeral = cached.storesTotal + cached.commonAreaTotal;
  }

  // Atualiza cache
  cacheTotalConsumption(cached.storesTotal, cached.commonAreaTotal, cached.totalGeral);

  // Atualiza UI
  updateAllCards(cached);

  // Atualiza pie chart
  initializePieChart(cached);
}

/**
 * Handler para mudança de filtro/data
 */
function handleDateUpdate(event) {
  console.log('[WATER] Date update received:', event.detail);

  // Show loading state
  initializeCards();

  // Request fresh data from MAIN
  window.dispatchEvent(
    new CustomEvent('myio:request-water-data', {
      detail: { requestor: 'WATER' },
    })
  );
}

// ============================================
// RFC-0097: FULLSCREEN CHART FUNCTIONS
// ============================================

/**
 * RFC-0097: Toggle fullscreen mode for water chart
 */
function toggleChartFullscreen() {
  const maximizeBtn = $id('maximizeChartBtn');

  isChartFullscreen = !isChartFullscreen;

  if (isChartFullscreen) {
    openFullscreenChart();
    if (maximizeBtn) {
      maximizeBtn.innerHTML = '✕';
      maximizeBtn.title = 'Sair da tela cheia';
    }
  } else {
    closeFullscreenChart();
    if (maximizeBtn) {
      maximizeBtn.innerHTML = '⛶';
      maximizeBtn.title = 'Maximizar para tela toda';
    }
  }

  console.log('[WATER] [RFC-0097] Fullscreen toggled:', isChartFullscreen);
}

/**
 * RFC-0097: Open fullscreen chart overlay
 */
function openFullscreenChart() {
  // Get parent document (outside iframe/widget)
  const parentDoc = window.parent?.document || document;

  // Remove existing fullscreen if any
  const existing = parentDoc.getElementById('water-fullscreen-chart');
  if (existing) existing.remove();

  // Create fullscreen container
  const container = parentDoc.createElement('div');
  container.id = 'water-fullscreen-chart';
  container.innerHTML = `
    <div class="fullscreen-overlay">
      <div class="fullscreen-content">
        <div class="fullscreen-header">
          <div class="fullscreen-title-group">
            <button class="fullscreen-config-btn" id="fullscreenConfigBtn" title="Configurar período">⚙️</button>
            <h3 id="fullscreenChartTitle">Consumo de Água - Últimos ${chartConfig.period} dias</h3>
          </div>
          <button class="fullscreen-close-btn" title="Fechar">✕</button>
        </div>
        <div class="fullscreen-controls">
          <div class="fullscreen-tabs" id="fullscreenVizTabs">
            <button class="fullscreen-tab active" data-viz="total">Consolidado</button>
            <button class="fullscreen-tab" data-viz="separate">Por Shopping</button>
          </div>
          <div class="fullscreen-tabs" id="fullscreenTypeTabs">
            <button class="fullscreen-tab active" data-type="line">Linhas</button>
            <button class="fullscreen-tab" data-type="bar">Barras</button>
          </div>
        </div>
        <div class="fullscreen-chart-container">
          <canvas id="fullscreenWaterChart"></canvas>
        </div>
      </div>
    </div>
    <style>
      #water-fullscreen-chart {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 99999;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #water-fullscreen-chart .fullscreen-overlay {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #water-fullscreen-chart .fullscreen-content {
        width: 90%;
        max-width: 1400px;
        height: 85vh;
        background: white;
        border-radius: 16px;
        padding: 24px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }
      #water-fullscreen-chart .fullscreen-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      #water-fullscreen-chart .fullscreen-title-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      #water-fullscreen-chart .fullscreen-config-btn {
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.2s;
      }
      #water-fullscreen-chart .fullscreen-config-btn:hover {
        background: #e0f2fe;
        border-color: #0288d1;
      }
      #water-fullscreen-chart .fullscreen-header h3 {
        font-size: 1.5rem;
        color: #0288d1;
        margin: 0;
      }
      #water-fullscreen-chart .fullscreen-close-btn {
        background: #f3f4f6;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #water-fullscreen-chart .fullscreen-close-btn:hover {
        background: #e5e7eb;
      }
      #water-fullscreen-chart .fullscreen-controls {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
      }
      #water-fullscreen-chart .fullscreen-tabs {
        display: flex;
        background: #f3f4f6;
        border-radius: 8px;
        padding: 4px;
      }
      #water-fullscreen-chart .fullscreen-tab {
        padding: 8px 16px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        color: #4b5563;
        transition: all 0.2s;
      }
      #water-fullscreen-chart .fullscreen-tab:hover {
        background: #e5e7eb;
      }
      #water-fullscreen-chart .fullscreen-tab.active {
        background: white;
        color: #0288d1;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      #water-fullscreen-chart .fullscreen-chart-container {
        flex: 1;
        min-height: 0;
        position: relative;
      }
      #water-fullscreen-chart .fullscreen-chart-container canvas {
        width: 100% !important;
        height: 100% !important;
      }
    </style>
  `;

  parentDoc.body.appendChild(container);

  // Setup close button
  const closeBtn = container.querySelector('.fullscreen-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      isChartFullscreen = false;
      closeFullscreenChart();
      const maximizeBtn = $id('maximizeChartBtn');
      if (maximizeBtn) {
        maximizeBtn.innerHTML = '⛶';
        maximizeBtn.title = 'Maximizar para tela toda';
      }
    });
  }

  // Setup config button in fullscreen
  const configBtn = container.querySelector('#fullscreenConfigBtn');
  if (configBtn) {
    configBtn.addEventListener('click', () => {
      console.log('[WATER] [RFC-0097] Opening config modal from fullscreen');
      openChartConfigModal();
    });
  }

  // Setup viz tabs
  const vizTabs = container.querySelectorAll('#fullscreenVizTabs .fullscreen-tab');
  vizTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      vizTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      chartConfig.vizMode = tab.dataset.viz;

      // Sync with main widget tabs
      const mainVizTabs = document.querySelectorAll('.viz-mode-tabs .chart-tab');
      mainVizTabs.forEach((t) => t.classList.toggle('active', t.dataset.viz === chartConfig.vizMode));

      rebuildFullscreenChart(container);
    });
  });

  // Setup type tabs
  const typeTabs = container.querySelectorAll('#fullscreenTypeTabs .fullscreen-tab');
  typeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      typeTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      chartConfig.chartType = tab.dataset.type;

      // Sync with main widget tabs
      const mainTypeTabs = document.querySelectorAll('.chart-type-tabs .chart-tab');
      mainTypeTabs.forEach((t) => t.classList.toggle('active', t.dataset.type === chartConfig.chartType));

      rebuildFullscreenChart(container);
    });
  });

  // Sync initial tab states
  vizTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.viz === chartConfig.vizMode));
  typeTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.type === chartConfig.chartType));

  // Add ESC key handler
  parentDoc.addEventListener('keydown', handleFullscreenEsc);

  // Build initial chart
  rebuildFullscreenChart(container);
}

/**
 * RFC-0097: Close fullscreen chart
 */
function closeFullscreenChart() {
  const parentDoc = window.parent?.document || document;
  const container = parentDoc.getElementById('water-fullscreen-chart');
  if (container) {
    container.remove();
  }

  if (fullscreenChartInstance) {
    fullscreenChartInstance.destroy();
    fullscreenChartInstance = null;
  }

  parentDoc.removeEventListener('keydown', handleFullscreenEsc);
}

/**
 * RFC-0097: Handle ESC key in fullscreen
 */
function handleFullscreenEsc(e) {
  if (e.key === 'Escape' && isChartFullscreen) {
    toggleChartFullscreen();
  }
}

/**
 * RFC-0097: Rebuild fullscreen chart with current config
 */
function rebuildFullscreenChart(container) {
  const canvas = container.querySelector('#fullscreenWaterChart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (fullscreenChartInstance) {
    fullscreenChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  const data = cachedChartData || { labels: [], dailyTotals: [], shoppingData: null, shoppingNames: null };

  // Build datasets based on vizMode
  let datasets = [];
  const colors = ['#0288d1', '#06b6d4', '#0891b2', '#22d3ee', '#67e8f9', '#0369a1', '#0c4a6e'];

  if (chartConfig.vizMode === 'separate' && data.shoppingData && Object.keys(data.shoppingData).length > 1) {
    let colorIndex = 0;
    for (const [shoppingId, values] of Object.entries(data.shoppingData)) {
      const shoppingName = data.shoppingNames?.[shoppingId] || `Shopping ${shoppingId.slice(0, 8)}`;
      datasets.push({
        label: shoppingName,
        data: values,
        borderColor: colors[colorIndex % colors.length],
        backgroundColor:
          chartConfig.chartType === 'line'
            ? `${colors[colorIndex % colors.length]}20`
            : colors[colorIndex % colors.length],
        fill: chartConfig.chartType === 'line',
        tension: 0.4,
        borderWidth: 2,
        pointRadius: chartConfig.chartType === 'line' ? 4 : 0,
        borderRadius: chartConfig.chartType === 'bar' ? 4 : 0,
      });
      colorIndex++;
    }
  } else {
    datasets.push({
      label: 'Consumo (m³)',
      data: data.dailyTotals,
      borderColor: '#0288d1',
      backgroundColor: chartConfig.chartType === 'line' ? 'rgba(2, 136, 209, 0.1)' : '#0288d1',
      fill: chartConfig.chartType === 'line',
      tension: 0.4,
      borderWidth: 2,
      pointRadius: chartConfig.chartType === 'line' ? 4 : 0,
      borderRadius: chartConfig.chartType === 'bar' ? 4 : 0,
    });
  }

  // Calculate Y-axis max
  const allValues = datasets.flatMap((ds) => ds.data);
  const maxValue = Math.max(...allValues, 0);
  const yAxisMax = maxValue > 0 ? Math.ceil((maxValue * 1.1) / 50) * 50 : 250;

  fullscreenChartInstance = new Chart(ctx, {
    type: chartConfig.chartType,
    data: {
      labels: data.labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: chartConfig.vizMode === 'separate',
          position: 'top',
          labels: { font: { size: 13 } },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} m³`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: yAxisMax,
          title: { display: true, text: 'm³', font: { size: 14 } },
        },
        x: {
          ticks: { font: { size: 12 } },
        },
      },
    },
  });

  console.log('[WATER] [RFC-0097] Fullscreen chart rebuilt');
}

/**
 * RFC-0097: Setup maximize button handler
 */
function setupMaximizeButton() {
  const maximizeBtn = $id('maximizeChartBtn');
  if (!maximizeBtn) {
    console.warn('[WATER] [RFC-0097] Maximize button not found');
    return;
  }

  maximizeBtn.addEventListener('click', toggleChartFullscreen);
  console.log('[WATER] [RFC-0097] Maximize button handler setup complete');
}

/**
 * RFC-0097: Setup chart tab handlers (vizMode and chartType)
 */
function setupChartTabHandlers() {
  // TABs vizMode (Consolidado/Por Shopping)
  const vizTabs = document.querySelectorAll('.viz-mode-tabs .chart-tab');
  vizTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      vizTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const newVizMode = tab.dataset.viz;
      chartConfig.vizMode = newVizMode;
      console.log('[WATER] [RFC-0097] vizMode changed to:', chartConfig.vizMode);

      // RFC-0098: Use component API if available
      if (consumptionChartInstance && typeof consumptionChartInstance.setVizMode === 'function') {
        console.log('[WATER] [RFC-0098] Setting vizMode via component:', newVizMode);
        consumptionChartInstance.setVizMode(newVizMode);
      } else {
        // Fallback to legacy re-render
        rerenderLineChart();
      }
    });
  });

  // TABs chartType (Linhas/Barras)
  const typeTabs = document.querySelectorAll('.chart-type-tabs .chart-tab');
  typeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      typeTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const newChartType = tab.dataset.type;
      chartConfig.chartType = newChartType;
      console.log('[WATER] [RFC-0097] chartType changed to:', chartConfig.chartType);

      // RFC-0098: Use component API if available
      if (consumptionChartInstance && typeof consumptionChartInstance.setChartType === 'function') {
        console.log('[WATER] [RFC-0098] Setting chartType via component:', newChartType);
        consumptionChartInstance.setChartType(newChartType);
      } else {
        // Fallback to legacy re-render
        rerenderLineChart();
      }
    });
  });

  console.log('[WATER] [RFC-0097] Chart tab handlers setup complete');
}

/**
 * RFC-0097: Re-render chart from cached data
 */
function rerenderLineChart() {
  if (!cachedChartData) {
    console.warn('[WATER] [RFC-0097] No cached data for re-render');
    return;
  }

  console.log('[WATER] [RFC-0097] Re-rendering chart from cache', {
    vizMode: chartConfig.vizMode,
    chartType: chartConfig.chartType,
  });

  const canvas = $id('lineChart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (lineChartInstance) {
    lineChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  const data = cachedChartData;

  // Build datasets based on vizMode
  let datasets = [];
  const colors = ['#0288d1', '#06b6d4', '#0891b2', '#22d3ee', '#67e8f9', '#0369a1', '#0c4a6e'];

  if (chartConfig.vizMode === 'separate' && data.shoppingData && Object.keys(data.shoppingData).length > 1) {
    let colorIndex = 0;
    for (const [shoppingId, values] of Object.entries(data.shoppingData)) {
      const shoppingName = data.shoppingNames?.[shoppingId] || `Shopping ${shoppingId.slice(0, 8)}`;
      datasets.push({
        label: shoppingName,
        data: values,
        borderColor: colors[colorIndex % colors.length],
        backgroundColor:
          chartConfig.chartType === 'line'
            ? `${colors[colorIndex % colors.length]}20`
            : colors[colorIndex % colors.length],
        fill: chartConfig.chartType === 'line',
        tension: 0.4,
        borderWidth: 2,
        pointRadius: chartConfig.chartType === 'line' ? 4 : 0,
        pointBackgroundColor: colors[colorIndex % colors.length],
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        borderRadius: chartConfig.chartType === 'bar' ? 4 : 0,
      });
      colorIndex++;
    }
  } else {
    datasets.push({
      label: 'Consumo (m³)',
      data: data.dailyTotals,
      borderColor: '#0288d1',
      backgroundColor: chartConfig.chartType === 'line' ? 'rgba(2, 136, 209, 0.1)' : '#0288d1',
      fill: chartConfig.chartType === 'line',
      tension: 0.4,
      borderWidth: 2,
      pointRadius: chartConfig.chartType === 'line' ? 4 : 0,
      pointBackgroundColor: '#0288d1',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      borderRadius: chartConfig.chartType === 'bar' ? 4 : 0,
    });
  }

  // Calculate Y-axis max
  const allValues = datasets.flatMap((ds) => ds.data);
  const maxValue = Math.max(...allValues, 0);
  const yAxisMax = maxValue > 0 ? Math.ceil((maxValue * 1.1) / 50) * 50 : 250;

  lineChartInstance = new Chart(ctx, {
    type: chartConfig.chartType,
    data: {
      labels: data.labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: chartConfig.vizMode === 'separate',
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} m³`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: yAxisMax,
          title: { display: true, text: 'm³' },
          ticks: {
            callback: function (value) {
              return `${value.toFixed(0)}`;
            },
          },
        },
      },
    },
  });

  console.log('[WATER] [RFC-0097] Chart re-rendered with yAxisMax:', yAxisMax);
}

// ============================================
// RFC-0097: CHART CONFIG MODAL
// ============================================

let dateRangePickerInstance = null;

/**
 * RFC-0097: Setup chart configuration button
 */
function setupChartConfigButton() {
  const configBtn = $id('configureChartBtn');
  if (!configBtn) {
    console.warn('[WATER] [RFC-0097] Chart configuration button not found');
    return;
  }

  console.log('[WATER] [RFC-0097] Setting up chart configuration button');
  configBtn.addEventListener('click', () => {
    console.log('[WATER] [RFC-0097] Opening chart configuration modal');
    openChartConfigModal();
  });
}

/**
 * RFC-0097: Open chart configuration modal with DateRangePicker
 */
function openChartConfigModal() {
  console.log('[WATER] [RFC-0097] Opening chart configuration modal');

  // Get parent document for modal injection
  const parentDoc = window.parent?.document || document;
  let globalContainer = parentDoc.getElementById('waterChartConfigModalGlobal');

  if (!globalContainer) {
    globalContainer = parentDoc.createElement('div');
    globalContainer.id = 'waterChartConfigModalGlobal';

    globalContainer.innerHTML = `
      <style>
        /* RFC-0097: WATER Chart Config Modal Styles */
        #waterChartConfigModalGlobal .chart-config-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          backdrop-filter: blur(4px);
          animation: waterFadeIn 0.2s ease-in;
        }

        #waterChartConfigModalGlobal .chart-config-modal.hidden {
          display: none;
        }

        #waterChartConfigModalGlobal .modal-card {
          background: #fff;
          border-radius: 16px;
          width: 90%;
          max-width: 700px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          overflow: hidden;
        }

        #waterChartConfigModalGlobal .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #e0f2fe;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        }

        #waterChartConfigModalGlobal .modal-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #0c4a6e;
        }

        #waterChartConfigModalGlobal .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        #waterChartConfigModalGlobal .modal-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 16px 24px;
          border-top: 1px solid #e0f2fe;
        }

        #waterChartConfigModalGlobal .config-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        #waterChartConfigModalGlobal .section-label {
          font-size: 14px;
          font-weight: 600;
          color: #0c4a6e;
          margin-bottom: 4px;
        }

        #waterChartConfigModalGlobal .period-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }

        #waterChartConfigModalGlobal .period-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border: 2px solid #e0f2fe;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          background: #fff;
        }

        #waterChartConfigModalGlobal .period-option:hover {
          border-color: #0288d1;
          background: #f0f9ff;
        }

        #waterChartConfigModalGlobal .period-option input[type="radio"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: #0288d1;
        }

        #waterChartConfigModalGlobal .period-option.selected {
          border-color: #0288d1;
          background: #e0f2fe;
        }

        #waterChartConfigModalGlobal .date-range-container {
          margin-top: 12px;
        }

        #waterChartConfigModalGlobal .date-range-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e0f2fe;
          border-radius: 10px;
          font-size: 14px;
          color: #0c4a6e;
          background: #fff;
          cursor: pointer;
          outline: none;
          transition: all 0.2s;
        }

        #waterChartConfigModalGlobal .date-range-input:hover {
          border-color: #0288d1;
        }

        #waterChartConfigModalGlobal .date-range-input:focus {
          border-color: #0288d1;
          box-shadow: 0 0 0 3px rgba(2, 136, 209, 0.15);
        }

        #waterChartConfigModalGlobal .btn {
          padding: 10px 20px;
          border: 1px solid #bae6fd;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: #fff;
          color: #0c4a6e;
        }

        #waterChartConfigModalGlobal .btn:hover {
          background: #f0f9ff;
        }

        #waterChartConfigModalGlobal .btn.primary {
          background: #0288d1;
          color: #fff;
          border-color: #0288d1;
        }

        #waterChartConfigModalGlobal .btn.primary:hover {
          background: #0277bd;
          border-color: #0277bd;
        }

        #waterChartConfigModalGlobal .close-btn {
          border: 0;
          background: transparent;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: background 0.2s;
        }

        #waterChartConfigModalGlobal .close-btn:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        #waterChartConfigModalGlobal .close-btn svg {
          width: 20px;
          height: 20px;
          fill: #0c4a6e;
        }

        @keyframes waterFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      </style>

      <div id="waterChartConfigModal" class="chart-config-modal hidden">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Configuração do Gráfico</h3>
            <button class="close-btn" id="closeWaterChartConfig" title="Fechar">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>

          <div class="modal-body">
            <!-- Period Selection -->
            <div class="config-section">
              <div class="section-label">Período</div>
              <div class="period-grid">
                <label class="period-option">
                  <input type="radio" name="waterChartPeriod" value="7" checked>
                  <span>7 dias</span>
                </label>
                <label class="period-option">
                  <input type="radio" name="waterChartPeriod" value="14">
                  <span>14 dias</span>
                </label>
                <label class="period-option">
                  <input type="radio" name="waterChartPeriod" value="30">
                  <span>30 dias</span>
                </label>
                <label class="period-option">
                  <input type="radio" name="waterChartPeriod" value="custom">
                  <span>Personalizado</span>
                </label>
              </div>

              <!-- DateRangePicker container (hidden by default) -->
              <div id="waterChartDateRangeContainer" class="date-range-container" style="display: none;">
                <input type="text" id="waterChartDateRangeInput" class="date-range-input" placeholder="Selecione o período" readonly>
              </div>
            </div>

            <!-- Granularity Selection -->
            <div class="config-section">
              <div class="section-label">Granularidade</div>
              <div class="period-grid">
                <label class="period-option">
                  <input type="radio" name="waterChartGranularity" value="1d" checked>
                  <span>Por Dia</span>
                </label>
                <label class="period-option">
                  <input type="radio" name="waterChartGranularity" value="1h">
                  <span>Por Hora</span>
                </label>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn" id="resetWaterChartConfig">Restaurar Padrão</button>
            <button class="btn primary" id="applyWaterChartConfig">Aplicar</button>
          </div>
        </div>
      </div>
    `;

    parentDoc.body.appendChild(globalContainer);
  }

  // Show modal
  const modal = parentDoc.getElementById('waterChartConfigModal');
  if (modal) {
    modal.classList.remove('hidden');
    parentDoc.body.classList.add('modal-open');
  }

  // Setup modal event handlers
  setupChartConfigModalHandlers(parentDoc, globalContainer);

  // Sync current config with modal
  syncModalWithConfig(parentDoc);
}

/**
 * RFC-0097: Setup modal event handlers
 */
function setupChartConfigModalHandlers(parentDoc, container) {
  // Close button
  const closeBtn = parentDoc.getElementById('closeWaterChartConfig');
  if (closeBtn) {
    closeBtn.onclick = () => closeChartConfigModal(parentDoc);
  }

  // Click outside to close
  const modal = parentDoc.getElementById('waterChartConfigModal');
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeChartConfigModal(parentDoc);
    };
  }

  // Period radio buttons
  const periodRadios = container.querySelectorAll('input[name="waterChartPeriod"]');
  const dateRangeContainer = parentDoc.getElementById('waterChartDateRangeContainer');

  periodRadios.forEach((radio) => {
    radio.onchange = () => {
      // Update visual state
      container.querySelectorAll('.period-option').forEach((opt) => {
        opt.classList.toggle('selected', opt.querySelector('input')?.checked);
      });

      // Show/hide date range picker
      if (radio.value === 'custom' && dateRangeContainer) {
        dateRangeContainer.style.display = 'block';
        initDateRangePicker(parentDoc);
      } else if (dateRangeContainer) {
        dateRangeContainer.style.display = 'none';
      }
    };
  });

  // Granularity radio buttons visual update
  const granularityRadios = container.querySelectorAll('input[name="waterChartGranularity"]');
  granularityRadios.forEach((radio) => {
    radio.onchange = () => {
      const section = radio.closest('.config-section');
      section?.querySelectorAll('.period-option').forEach((opt) => {
        opt.classList.toggle('selected', opt.querySelector('input')?.checked);
      });
    };
  });

  // Apply button
  const applyBtn = parentDoc.getElementById('applyWaterChartConfig');
  if (applyBtn) {
    applyBtn.onclick = () => {
      saveChartConfig(parentDoc);
      closeChartConfigModal(parentDoc);
      // Re-fetch data with new config
      initializeLineChart();
    };
  }

  // Reset button
  const resetBtn = parentDoc.getElementById('resetWaterChartConfig');
  if (resetBtn) {
    resetBtn.onclick = () => resetChartConfig(parentDoc);
  }
}

/**
 * RFC-0097: Initialize DateRangePicker for custom period
 */
async function initDateRangePicker(parentDoc) {
  const input = parentDoc.getElementById('waterChartDateRangeInput');
  if (!input || dateRangePickerInstance) return;

  // Check if MyIOLibrary is available
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createDateRangePicker) {
    try {
      dateRangePickerInstance = await MyIOLibrary.createDateRangePicker(input, {
        maxRangeDays: 90,
        parentEl: parentDoc.body,
        onApply: (result) => {
          console.log('[WATER] [RFC-0097] DateRange selected:', result);
          chartConfig.startDate = result.startDate;
          chartConfig.endDate = result.endDate;
        },
      });
      console.log('[WATER] [RFC-0097] DateRangePicker initialized');
    } catch (err) {
      console.warn('[WATER] [RFC-0097] Failed to init DateRangePicker:', err);
    }
  } else {
    // Fallback: simple date inputs
    console.warn('[WATER] [RFC-0097] createDateRangePicker not available, using fallback');
    input.type = 'date';
    input.readOnly = false;
  }
}

/**
 * RFC-0097: Sync modal inputs with current chartConfig
 */
function syncModalWithConfig(parentDoc) {
  // Sync period
  const periodRadio = parentDoc.querySelector(
    `input[name="waterChartPeriod"][value="${chartConfig.period}"]`
  );
  if (periodRadio) {
    periodRadio.checked = true;
    periodRadio.closest('.period-option')?.classList.add('selected');
  }

  // Sync granularity
  const granularityRadio = parentDoc.querySelector(
    `input[name="waterChartGranularity"][value="${chartConfig.granularity}"]`
  );
  if (granularityRadio) {
    granularityRadio.checked = true;
    granularityRadio.closest('.period-option')?.classList.add('selected');
  }

  // Show date range container if custom
  const dateRangeContainer = parentDoc.getElementById('waterChartDateRangeContainer');
  if (chartConfig.period === 0 || chartConfig.period === 'custom') {
    dateRangeContainer.style.display = 'block';
    initDateRangePicker(parentDoc);
  }
}

/**
 * RFC-0097: Save chart config from modal
 */
function saveChartConfig(parentDoc) {
  const periodRadio = parentDoc.querySelector('input[name="waterChartPeriod"]:checked');
  const granularityRadio = parentDoc.querySelector('input[name="waterChartGranularity"]:checked');

  if (periodRadio) {
    const value = periodRadio.value;
    chartConfig.period = value === 'custom' ? 0 : parseInt(value);
  }

  if (granularityRadio) {
    chartConfig.granularity = granularityRadio.value;
  }

  // Update title
  const titleEl = $id('lineChartTitle');
  if (titleEl) {
    if (chartConfig.period === 0) {
      titleEl.textContent = 'Consumo - Período Personalizado';
    } else {
      titleEl.textContent = `Consumo dos últimos ${chartConfig.period} dias`;
    }
  }

  console.log('[WATER] [RFC-0097] Chart config saved:', chartConfig);
}

/**
 * RFC-0097: Reset chart config to defaults
 */
function resetChartConfig(parentDoc) {
  chartConfig.period = 7;
  chartConfig.granularity = '1d';
  chartConfig.startDate = null;
  chartConfig.endDate = null;
  chartConfig.vizMode = 'total';
  chartConfig.chartType = 'line';

  // Reset radio buttons
  const period7 = parentDoc.querySelector('input[name="waterChartPeriod"][value="7"]');
  if (period7) {
    period7.checked = true;
    parentDoc.querySelectorAll('.period-option').forEach((opt) => opt.classList.remove('selected'));
    period7.closest('.period-option')?.classList.add('selected');
  }

  const granularity1d = parentDoc.querySelector('input[name="waterChartGranularity"][value="1d"]');
  if (granularity1d) {
    granularity1d.checked = true;
    granularity1d.closest('.period-option')?.classList.add('selected');
  }

  // Hide date range
  const dateRangeContainer = parentDoc.getElementById('waterChartDateRangeContainer');
  if (dateRangeContainer) {
    dateRangeContainer.style.display = 'none';
  }

  // Reset main widget tabs
  document.querySelectorAll('.viz-mode-tabs .chart-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.viz === 'total');
  });
  document.querySelectorAll('.chart-type-tabs .chart-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.type === 'line');
  });

  // Update title
  const titleEl = $id('lineChartTitle');
  if (titleEl) {
    titleEl.textContent = 'Consumo dos últimos 7 dias';
  }

  console.log('[WATER] [RFC-0097] Chart config reset to defaults');
}

/**
 * RFC-0097: Close chart config modal
 */
function closeChartConfigModal(parentDoc) {
  const modal = parentDoc.getElementById('waterChartConfigModal');
  if (modal) {
    modal.classList.add('hidden');
    parentDoc.body.classList.remove('modal-open');
  }
}

// ============================================
// INITIALIZATION
// ============================================

// RFC-0093: Function to render shopping filter chips in toolbar
function renderShoppingFilterChips(selection) {
  const chipsContainer = $id('waterShoppingFilterChips');
  if (!chipsContainer) return;

  chipsContainer.innerHTML = '';

  if (!selection || selection.length === 0) {
    return; // No filter applied, hide chips
  }

  selection.forEach((shopping) => {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.innerHTML = `<span class="filter-chip-icon">💧</span><span>${shopping.name}</span>`;
    chipsContainer.appendChild(chip);
  });

  console.log('[WATER] 📍 Rendered', selection.length, 'shopping filter chips');
}

function setupEventListeners() {
  // Listen for water data from MAIN
  window.addEventListener('myio:water-data-ready', handleWaterDataReady);

  // Listen for water totals calculated from valid TB aliases (Orchestrator)
  window.addEventListener('myio:water-totals-updated', (ev) => {
    const { commonArea, stores, total } = ev.detail || {};
    console.log('[WATER] 💧 heard myio:water-totals-updated:', { commonArea, stores, total });

    if (total > 0) {
      // Atualiza com totais reais do Orchestrator
      cacheTotalConsumption(stores, commonArea, total);

      // Atualiza UI
      const cached = { storesTotal: stores, commonAreaTotal: commonArea, totalGeral: total };
      updateAllCards(cached);
      initializePieChart(cached);

      console.log('[WATER] ✅ Updated with Orchestrator totals:', cached);
    }
  });

  // Listen for date/filter updates
  window.addEventListener('myio:update-date', handleDateUpdate);

  // RFC-0093: Listen for shopping filter changes
  window.addEventListener('myio:filter-applied', (ev) => {
    const selection = ev.detail?.selection || [];
    console.log('[WATER] 🔥 heard myio:filter-applied:', selection.length, 'shoppings');
    renderShoppingFilterChips(selection);
  });

  // RFC-0093: Check for pre-existing filter when WATER initializes
  if (
    window.custumersSelected &&
    Array.isArray(window.custumersSelected) &&
    window.custumersSelected.length > 0
  ) {
    console.log('[WATER] 🔄 Applying pre-existing filter:', window.custumersSelected.length, 'shoppings');
    renderShoppingFilterChips(window.custumersSelected);
  }

  // Distribution mode selector
  const distributionSelect = $id('distributionMode');
  if (distributionSelect) {
    distributionSelect.addEventListener('change', (e) => {
      updatePieChartMode(e.target.value);
    });
  }

  console.log('[WATER] Event listeners setup complete');
}

function cleanup() {
  window.removeEventListener('myio:water-data-ready', handleWaterDataReady);
  window.removeEventListener('myio:update-date', handleDateUpdate);

  // RFC-0098: Cleanup consumption chart instance first
  if (consumptionChartInstance && typeof consumptionChartInstance.destroy === 'function') {
    console.log('[WATER] [RFC-0098] Destroying consumption chart instance');
    consumptionChartInstance.destroy();
    consumptionChartInstance = null;
  }

  if (lineChartInstance) {
    lineChartInstance.destroy();
    lineChartInstance = null;
  }

  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }
}

// ============================================
// THINGSBOARD WIDGET HOOKS
// ============================================

self.onInit = function () {
  console.log('[WATER] Widget initialized');
  console.log('[WATER] DEBUG: Chart.js available?', typeof Chart !== 'undefined');
  console.log('[WATER] DEBUG: lineChart canvas?', !!$id('lineChart'));
  console.log('[WATER] DEBUG: pieChart canvas?', !!$id('pieChart'));

  // Initialize cards with loading state
  initializeCards();

  // Setup zoom controls
  setupZoomControls();

  // Setup event listeners
  setupEventListeners();

  // RFC-0097: Setup chart tab handlers (vizMode and chartType)
  setupChartTabHandlers();

  // RFC-0097: Setup maximize button for fullscreen
  setupMaximizeButton();

  // RFC-0097: Setup chart config button (settings)
  setupChartConfigButton();

  // Initialize charts with empty/loading state
  setTimeout(() => {
    console.log('[WATER] DEBUG setTimeout: Chart.js available?', typeof Chart !== 'undefined');
    console.log('[WATER] DEBUG setTimeout: lineChart canvas?', !!$id('lineChart'));
    console.log('[WATER] DEBUG setTimeout: pieChart canvas?', !!$id('pieChart'));

    initializeLineChart();

    // FIX: Check Orchestrator totals FIRST (may already be available)
    const orchestratorTotals = window.MyIOOrchestrator?.getWaterTotals?.();
    if (orchestratorTotals && orchestratorTotals.total > 0) {
      console.log('[WATER] Using Orchestrator totals on init:', orchestratorTotals);
      const data = {
        storesTotal: orchestratorTotals.stores,
        commonAreaTotal: orchestratorTotals.commonArea,
        totalGeral: orchestratorTotals.total,
      };
      cacheTotalConsumption(data.storesTotal, data.commonAreaTotal, data.totalGeral);
      initializePieChart(data);
      updateAllCards(data);
    } else {
      // Check if we already have cached data from MAIN
      const cached = getCachedTotalConsumption();
      if (cached) {
        console.log('[WATER] Using cached data on init:', cached);
        initializePieChart(cached);
        updateAllCards(cached);
      } else {
        // Initialize with zeros while waiting for real data
        const emptyData = {
          storesTotal: 0,
          commonAreaTotal: 0,
          totalGeral: 0,
        };
        initializePieChart(emptyData);
        // Keep loading state on cards
      }
    }
  }, 500);

  // Request data from MAIN immediately
  setTimeout(() => {
    console.log('[WATER] Requesting water data from MAIN...');
    window.dispatchEvent(
      new CustomEvent('myio:request-water-data', {
        detail: { requestor: 'WATER' },
      })
    );
  }, 200);

  // FIX: Retry request after 2 seconds if cards still show loading
  setTimeout(() => {
    const storesValueEl = $id('total-consumption-stores-value');
    const hasSpinner = storesValueEl?.querySelector('.loading-spinner');
    if (hasSpinner) {
      console.log('[WATER] Cards still loading, retrying data request...');

      // Check Orchestrator totals again
      const orchestratorTotals = window.MyIOOrchestrator?.getWaterTotals?.();
      if (orchestratorTotals && orchestratorTotals.total > 0) {
        console.log('[WATER] Retry: Found Orchestrator totals:', orchestratorTotals);
        const data = {
          storesTotal: orchestratorTotals.stores,
          commonAreaTotal: orchestratorTotals.commonArea,
          totalGeral: orchestratorTotals.total,
        };
        cacheTotalConsumption(data.storesTotal, data.commonAreaTotal, data.totalGeral);
        updateAllCards(data);
        initializePieChart(data);
      } else {
        // Request from MAIN again
        window.dispatchEvent(
          new CustomEvent('myio:request-water-data', {
            detail: { requestor: 'WATER', retry: true },
          })
        );
      }
    }
  }, 2000);

  // FIX: Final retry after 5 seconds - last attempt before giving up
  setTimeout(() => {
    const storesValueEl = $id('total-consumption-stores-value');
    const hasSpinner = storesValueEl?.querySelector('.loading-spinner');
    if (hasSpinner) {
      console.log('[WATER] Final retry - cards still loading after 5s...');

      const orchestratorTotals = window.MyIOOrchestrator?.getWaterTotals?.();
      if (orchestratorTotals && orchestratorTotals.total > 0) {
        console.log('[WATER] Final retry: Found Orchestrator totals:', orchestratorTotals);
        const data = {
          storesTotal: orchestratorTotals.stores,
          commonAreaTotal: orchestratorTotals.commonArea,
          totalGeral: orchestratorTotals.total,
        };
        cacheTotalConsumption(data.storesTotal, data.commonAreaTotal, data.totalGeral);
        updateAllCards(data);
        initializePieChart(data);
      } else {
        // Show zero values instead of infinite loading
        console.log('[WATER] No data available, showing zero values');
        const emptyData = {
          storesTotal: 0,
          commonAreaTotal: 0,
          totalGeral: 0,
        };
        updateAllCards(emptyData);
        initializePieChart(emptyData);
      }
    }
  }, 5000);
};

self.onDataUpdated = function () {
  // Data updates handled via custom events
};

self.onResize = function () {
  // Charts auto-resize
};

self.onDestroy = function () {
  console.log('[WATER] Widget destroyed');
  cleanup();
};
