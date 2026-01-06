/* global self, window, document, MyIOLibrary, Chart */

// ============================================
// MYIO-SIM 5.2.0 - ENERGY Widget Controller
// ============================================

// ============================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================
// Use shared utilities from MAIN, with fallback to console
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log('[ENERGY]', ...args),
  warn: (...args) => console.warn('[ENERGY]', ...args),
  error: (...args) => console.error('[ENERGY]', ...args),
};

// Log script load
LogHelper.log('Script loaded, using shared utilities:', !!window.MyIOUtils?.LogHelper);

// ============================================
// DEBUG FLAGS
// ============================================

/**
 * RFC-0073: Debug flag to use mock data for day total consumption
 * Set to true to bypass API calls and return mock data for 7-day chart
 */
const MOCK_DEBUG_DAY_CONSUMPTION = false;

// ============================================
// CACHE CONFIGURATION
// ============================================

// RFC-0097: Chart configuration state
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
const CHART_CACHE_TTL = 60 * 1000; // 1 minute cache TTL

/**
 * Renderiza a UI do card de consumo total com dados
 */
// NOVO CÓDIGO PARA O WIDGET ENERGY

/**
 * Renderiza a UI do card de consumo de LOJAS (sem equipamentos)
 * @param {object} energyData - O objeto de resumo completo vindo do MAIN.
 */
function renderTotalConsumptionStoresUI(energyData, valueEl, trendEl, infoEl) {
  if (!energyData) return;

  const totalGeral = energyData.customerTotal;
  const lojasTotal = energyData.difference; // Lojas = customerTotal - equipmentsTotal

  const lojasPercentage = totalGeral > 0 ? (lojasTotal / totalGeral) * 100 : 0;
  const lojasFormatted = MyIOLibrary.formatEnergy(lojasTotal);

  if (valueEl) {
    valueEl.textContent = lojasFormatted;
  }

  if (trendEl) {
    trendEl.textContent = `${lojasPercentage.toFixed(1)}% do total`;
    trendEl.className = 'trend neutral';
  }

  if (infoEl) {
    infoEl.textContent = 'Apenas lojas';
  }

  LogHelper.log('[ENERGY] Card de Lojas atualizado:', { lojasTotal, lojasFormatted, lojasPercentage });
}

/**
 * Renderiza a UI do card de consumo de EQUIPAMENTOS
 * @param {object} energyData - O objeto de resumo completo vindo do MAIN.
 */
function renderTotalConsumptionEquipmentsUI(energyData, valueEl, trendEl, infoEl) {
  if (!energyData) return;

  const totalGeral = energyData.customerTotal;
  const equipamentosTotal = energyData.equipmentsTotal;

  const equipamentosPercentage = totalGeral > 0 ? (equipamentosTotal / totalGeral) * 100 : 0;
  const equipamentosFormatted = MyIOLibrary.formatEnergy(equipamentosTotal);

  if (valueEl) {
    valueEl.textContent = equipamentosFormatted;
  }

  if (trendEl) {
    trendEl.textContent = `${equipamentosPercentage.toFixed(1)}% do total`;
    trendEl.className = 'trend neutral';
  }

  if (infoEl) {
    infoEl.textContent = 'Elevadores, escadas, HVAC, etc.';
  }

  LogHelper.log('[ENERGY] Card de Equipamentos atualizado:', {
    equipamentosTotal,
    equipamentosFormatted,
    equipamentosPercentage,
  });
}

/**
 * Inicializa o card de consumo total de LOJAS com estado de loading
 */
function initializeTotalConsumptionStoresCard() {
  const valueEl = document.getElementById('total-consumption-stores-value');
  const trendEl = document.getElementById('total-consumption-stores-trend');

  // Show loading state
  if (valueEl) {
    valueEl.innerHTML = `
      <svg class="loading-spinner" style="width:24px; height:24px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#6c2fbf" stroke-width="5" stroke-linecap="round"
                stroke-dasharray="90,150" stroke-dashoffset="0">
        </circle>
      </svg>
    `;
  }

  if (trendEl) {
    trendEl.textContent = 'Aguardando dados...';
    trendEl.className = 'trend neutral';
  }

  LogHelper.log('[ENERGY] Stores consumption card initialized with loading state');
}

/**
 * Inicializa o card de consumo total de EQUIPAMENTOS com estado de loading
 */
function initializeTotalConsumptionEquipmentsCard() {
  const valueEl = document.getElementById('total-consumption-equipments-value');
  const trendEl = document.getElementById('total-consumption-equipments-trend');

  // Show loading state
  if (valueEl) {
    valueEl.innerHTML = `
      <svg class="loading-spinner" style="width:24px; height:24px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#6c2fbf" stroke-width="5" stroke-linecap="round"
                stroke-dasharray="90,150" stroke-dashoffset="0">
        </circle>
      </svg>
    `;
  }

  if (trendEl) {
    trendEl.textContent = 'Aguardando dados...';
    trendEl.className = 'trend neutral';
  }

  LogHelper.log('[ENERGY] Equipments consumption card initialized with loading state');
}

/**
 * Atualiza o card de consumo total de LOJAS
 * @param {object} summary - O objeto de resumo calculado pelo widget MAIN.
 */
function updateTotalConsumptionStoresCard(summary) {
  LogHelper.log('[ENERGY] Atualizando card de consumo de LOJAS:', summary);

  if (!summary) return;

  const valueEl = document.getElementById('total-consumption-stores-value');
  const trendEl = document.getElementById('total-consumption-stores-trend');
  const infoEl = document.getElementById('total-consumption-stores-info');

  renderTotalConsumptionStoresUI(summary, valueEl, trendEl, infoEl);
}

/**
 * Atualiza o card de consumo total de EQUIPAMENTOS
 * @param {object} summary - O objeto de resumo calculado pelo widget MAIN.
 */
function updateTotalConsumptionEquipmentsCard(summary) {
  LogHelper.log('[ENERGY] Atualizando card de consumo de EQUIPAMENTOS:', summary);

  if (!summary) return;

  const valueEl = document.getElementById('total-consumption-equipments-value');
  const trendEl = document.getElementById('total-consumption-equipments-trend');
  const infoEl = document.getElementById('total-consumption-equipments-info');

  renderTotalConsumptionEquipmentsUI(summary, valueEl, trendEl, infoEl);
}

/**
 * DEPRECATED: Inicializa o card de consumo total com estado de loading
 */
function initializeTotalConsumptionCard() {
  const valueEl = document.getElementById('total-consumption-value');
  const trendEl = document.getElementById('total-consumption-trend');
  const infoEl = document.getElementById('total-consumption-info');

  // Show loading state
  if (valueEl) {
    valueEl.innerHTML = `
      <svg class="loading-spinner" style="width:24px; height:24px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#6c2fbf" stroke-width="5" stroke-linecap="round"
                stroke-dasharray="90,150" stroke-dashoffset="0">
        </circle>
      </svg>
    `;
  }

  if (trendEl) {
    trendEl.textContent = 'Aguardando dados...';
    trendEl.className = 'trend neutral';
  }

  if (infoEl) {
    infoEl.textContent = '';
  }

  LogHelper.log('[ENERGY] Total consumption card initialized with loading state');
}

/**
 * RFC-0073: Get selected shopping IDs (ingestionIds) from filter
 * RFC-0096: Fixed - window.custumersSelected already contains only selected items
 *           Each item has: { name, value (ingestionId), customerId, ingestionId }
 */
function getSelectedShoppingIds() {
  // Check if there are selected customers from MENU filter
  if (
    window.custumersSelected &&
    Array.isArray(window.custumersSelected) &&
    window.custumersSelected.length > 0
  ) {
    // RFC-0096: All items in custumersSelected are already selected, no need to filter by .selected
    // Use ingestionId if available, fallback to value (which is also ingestionId)
    const selectedIds = window.custumersSelected.map((c) => c.ingestionId || c.value).filter(Boolean);

    if (selectedIds.length > 0) {
      LogHelper.log('[ENERGY] [RFC-0096] Using filtered shopping ingestionIds:', selectedIds);
      return selectedIds;
    }
  }

  // Fallback: return empty array (will use widget's customerId)
  LogHelper.log('[ENERGY] [RFC-0096] No shopping filter active, using widget customerId');
  return [];
}

/**
 * Get selected shopping ingestionIds from filter for energyCache filtering
 * The energyCache stores customerId as the shopping's ingestionId (not ThingsBoard customerId)
 * @returns {string[]} - Array of ingestionIds from selected shoppings, or empty if no filter/all selected
 */
function getSelectedShoppingCustomerIds() {
  // Check if there are selected customers from MENU filter
  if (
    window.custumersSelected &&
    Array.isArray(window.custumersSelected) &&
    window.custumersSelected.length > 0
  ) {
    // Check if ALL shoppings are selected (no real filter)
    // Compare with total available customers from ctx.$scope.custumer
    const totalCustomers = self.ctx?.$scope?.custumer?.length || 0;
    if (totalCustomers > 0 && window.custumersSelected.length >= totalCustomers) {
      LogHelper.log('[ENERGY] All shoppings selected - no filter applied');
      return []; // No filter when all are selected
    }

    // Use ingestionId (or value which is also ingestionId) to match energyCache.customerId
    // Note: energyCache stores the shopping's ingestionId as customerId, not ThingsBoard customerId
    const ingestionIds = window.custumersSelected.map((c) => c.ingestionId || c.value).filter(Boolean);

    if (ingestionIds.length > 0) {
      LogHelper.log('[ENERGY] Using filtered shopping ingestionIds for energyCache:', ingestionIds);
      return ingestionIds;
    }
  }

  // Fallback: return empty array (no filter active)
  return [];
}

// ============================================
// CHART FUNCTIONS
// ============================================

// Global chart references for later updates
let lineChartInstance = null;
let pieChartInstance = null; // Legacy reference (kept for backwards compatibility)

// RFC-0098: Consumption 7 Days Chart instance (new standardized component)
let consumptionChartInstance = null;

// RFC-0102: Distribution Chart instance (new standardized component)
let distributionChartInstance = null;

// RFC-0097: Fullscreen state
let isChartFullscreen = false;

// RFC-0098: Line chart update state (prevents concurrent updates)
let isUpdatingLineChart = false;
let pendingLineChartUpdate = null;

/**
 * RFC-0097: Show loading overlay on energy chart
 */
function showChartLoading() {
  const overlay = document.getElementById('lineChartLoading');
  if (overlay) {
    overlay.style.display = 'flex';
  }
}

/**
 * RFC-0097: Hide loading overlay on energy chart
 */
function hideChartLoading() {
  const overlay = document.getElementById('lineChartLoading');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// RFC-0098: Reference to fullscreen modal instance
let fullscreenModalInstance = null;

/**
 * RFC-0098: Open fullscreen modal using createConsumptionModal
 * Replaces legacy fullscreen chart code with standardized component
 */
async function openFullscreenModal() {
  if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.createConsumptionModal) {
    LogHelper.error('[ENERGY] [RFC-0098] createConsumptionModal not available');
    return;
  }

  LogHelper.log('[ENERGY] [RFC-0098] Opening fullscreen modal...');

  // RFC-0098: Get cached data from the consumption chart widget for instant display
  const initialData = cachedChartData || consumptionChartInstance?.getCachedData?.() || null;
  if (initialData) {
    LogHelper.log('[ENERGY] [RFC-0098] Using cached data for modal (instant display)');
  }

  fullscreenModalInstance = MyIOLibrary.createConsumptionModal({
    domain: 'energy',
    title: 'Consumo de Energia',
    unit: 'kWh',
    unitLarge: 'MWh',
    thresholdForLargeUnit: 1000,
    decimalPlaces: 1,
    defaultPeriod: chartConfig.period || 7,
    defaultChartType: chartConfig.chartType || 'line',
    defaultVizMode: chartConfig.vizMode || 'total',
    theme: 'light',
    showSettingsButton: false, // Settings configured in widget before maximizing
    fetchData: fetchConsumptionDataAdapter,
    initialData: initialData, // RFC-0098: Pass cached data for instant display
    onClose: () => {
      LogHelper.log('[ENERGY] [RFC-0098] Fullscreen modal closed');
      fullscreenModalInstance = null;
      isChartFullscreen = false;
    },
  });

  isChartFullscreen = true;
  await fullscreenModalInstance.open();
}

// ============================================
// LEGACY FULLSCREEN CODE - DEPRECATED (RFC-0098)
// Kept temporarily for backwards compatibility
// ============================================

/**
 * @deprecated Use openFullscreenModal() instead
 */
function toggleChartFullscreen() {
  // RFC-0098: Redirect to new modal-based fullscreen
  openFullscreenModal();
}

/**
 * RFC-0097: Opens fullscreen chart overlay in parent document (like filter modal)
 */
function openFullscreenChart() {
  // Get target document (parent if in iframe, otherwise current)
  const targetDoc = window.parent?.document || document;
  const targetBody = targetDoc.body;

  // Check if already exists
  let container = targetDoc.getElementById('energyChartFullscreenGlobal');
  if (container) {
    container.style.display = 'flex';
    rebuildFullscreenChart(container);
    return;
  }

  // Create fullscreen container with injected styles
  container = targetDoc.createElement('div');
  container.id = 'energyChartFullscreenGlobal';
  container.innerHTML = `
    <style>
      #energyChartFullscreenGlobal {
        position: fixed;
        inset: 0;
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        padding: 24px;
        box-sizing: border-box;
      }
      #energyChartFullscreenGlobal .fullscreen-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      #energyChartFullscreenGlobal .fullscreen-title-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      #energyChartFullscreenGlobal .fullscreen-header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #166534;
        font-family: 'Inter', sans-serif;
      }
      #energyChartFullscreenGlobal .fullscreen-config-btn {
        background: #fff;
        border: 1px solid #86efac;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #energyChartFullscreenGlobal .fullscreen-config-btn:hover {
        background: #dcfce7;
        border-color: #22c55e;
      }
      #energyChartFullscreenGlobal .fullscreen-close-btn {
        background: #fff;
        border: 1px solid #86efac;
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 500;
        color: #166534;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #energyChartFullscreenGlobal .fullscreen-close-btn:hover {
        background: #dcfce7;
        border-color: #22c55e;
      }
      #energyChartFullscreenGlobal .fullscreen-chart-container {
        flex: 1;
        background: #fff;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      #energyChartFullscreenGlobal .fullscreen-controls {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      #energyChartFullscreenGlobal .fullscreen-tabs {
        display: inline-flex;
        gap: 2px;
        background: #f1f5f9;
        border-radius: 8px;
        padding: 2px;
      }
      #energyChartFullscreenGlobal .fullscreen-tab {
        padding: 8px 16px;
        border: none;
        background: transparent;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s;
      }
      #energyChartFullscreenGlobal .fullscreen-tab:hover {
        color: #1e293b;
      }
      #energyChartFullscreenGlobal .fullscreen-tab.active {
        background: #fff;
        color: #166534;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      #energyChartFullscreenGlobal .fullscreen-canvas-wrap {
        flex: 1;
        position: relative;
        min-height: 0;
      }
      #energyChartFullscreenGlobal canvas {
        width: 100% !important;
        height: 100% !important;
      }
    </style>
    <div class="fullscreen-header">
      <div class="fullscreen-title-group">
        <button class="fullscreen-config-btn" id="fullscreenConfigBtn" title="Configurar período">⚙️</button>
        <h3 id="fullscreenChartTitle">Consumo dos últimos 7 dias</h3>
      </div>
      <button class="fullscreen-close-btn" id="closeFullscreenChart">
        <span>✕</span> Fechar
      </button>
    </div>
    <div class="fullscreen-chart-container">
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
      <div class="fullscreen-canvas-wrap">
        <canvas id="fullscreenLineChart"></canvas>
      </div>
    </div>
  `;

  targetBody.appendChild(container);
  targetBody.style.overflow = 'hidden';

  // Setup event handlers
  setupFullscreenHandlers(container, targetDoc);

  // Render chart in fullscreen
  rebuildFullscreenChart(container);

  // ESC key handler
  targetDoc.addEventListener('keydown', handleFullscreenEsc);
}

/**
 * RFC-0097: Setup fullscreen chart event handlers
 */
function setupFullscreenHandlers(container, targetDoc) {
  // Close button
  const closeBtn = container.querySelector('#closeFullscreenChart');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      isChartFullscreen = false;
      closeFullscreenChart();
      const maximizeBtn = document.getElementById('maximizeChartBtn');
      if (maximizeBtn) {
        maximizeBtn.innerHTML = '⛶';
        maximizeBtn.title = 'Maximizar para tela toda';
      }
    });
  }

  // RFC-0098: Config button removed from fullscreen - settings handled by main component
  // The fullscreen view inherits settings from the main chart

  // Viz mode tabs
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

  // Chart type tabs
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
}

// Reference to fullscreen chart instance
let fullscreenChartInstance = null;

/**
 * RFC-0097: Rebuild chart in fullscreen container
 */
function rebuildFullscreenChart(container) {
  if (!cachedChartData) {
    LogHelper.warn('[ENERGY] [RFC-0097] No cached data for fullscreen chart');
    return;
  }

  // Update title
  const titleEl = container.querySelector('#fullscreenChartTitle');
  if (titleEl) {
    const mainTitle = document.getElementById('lineChartTitle');
    titleEl.textContent = mainTitle?.textContent || 'Consumo de Energia';
  }

  // Get canvas
  const canvas = container.querySelector('#fullscreenLineChart');
  if (!canvas) return;

  // Destroy previous instance
  if (fullscreenChartInstance) {
    fullscreenChartInstance.destroy();
    fullscreenChartInstance = null;
  }

  const { labels, dailyTotals, shoppingData, shoppingNames } = cachedChartData;

  // Calculate max Y value
  let maxValue = 0;
  if (dailyTotals && dailyTotals.length > 0) {
    maxValue = Math.max(...dailyTotals);
  }
  if (shoppingData) {
    Object.values(shoppingData).forEach((values) => {
      if (Array.isArray(values)) {
        const shoppingMax = Math.max(...values);
        if (shoppingMax > maxValue) maxValue = shoppingMax;
      }
    });
  }
  const yAxisMax = maxValue > 0 ? Math.ceil((maxValue * 1.1) / 1000) * 1000 : 10000;

  let datasets = [];
  const colors = ['#166534', '#2563eb', '#16a34a', '#ea580c', '#dc2626', '#8b5cf6', '#0891b2', '#65a30d'];

  if (chartConfig.vizMode === 'separate' && shoppingData && Object.keys(shoppingData).length > 1) {
    let colorIndex = 0;
    for (const [shoppingId, values] of Object.entries(shoppingData)) {
      const shoppingName = shoppingNames?.[shoppingId] || `Shopping ${shoppingId.slice(0, 8)}`;
      const color = colors[colorIndex % colors.length];
      datasets.push({
        label: shoppingName,
        data: values,
        borderColor: color,
        backgroundColor: chartConfig.chartType === 'bar' ? color + '80' : color + '20',
        fill: chartConfig.chartType === 'line',
        tension: 0.3,
        pointRadius: chartConfig.chartType === 'line' ? 5 : 0,
        pointBackgroundColor: color,
        borderWidth: 2,
      });
      colorIndex++;
    }
  } else {
    datasets.push({
      label: 'Consumo Total (kWh)',
      data: dailyTotals,
      borderColor: '#166534',
      backgroundColor: chartConfig.chartType === 'bar' ? '#16653480' : 'rgba(22, 101, 52, 0.1)',
      fill: chartConfig.chartType === 'line',
      tension: 0.3,
      pointRadius: chartConfig.chartType === 'line' ? 5 : 0,
      pointBackgroundColor: '#166534',
      borderWidth: 3,
    });
  }

  fullscreenChartInstance = new Chart(canvas, {
    type: chartConfig.chartType,
    data: { labels, datasets },
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
            label: (context) => {
              const value = context.parsed.y || 0;
              if (value >= 1000) {
                return `${context.dataset.label}: ${(value / 1000).toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                })} MWh`;
              }
              return `${context.dataset.label}: ${value.toLocaleString('pt-BR', {
                maximumFractionDigits: 2,
              })} kWh`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: yAxisMax,
          title: {
            display: true,
            text: yAxisMax >= 1000 ? 'Consumo (MWh)' : 'Consumo (kWh)',
            font: { size: 14 },
          },
          ticks: {
            font: { size: 12 },
            callback: function (value) {
              if (yAxisMax >= 1000) return (value / 1000).toFixed(1);
              return value.toFixed(0);
            },
          },
        },
        x: {
          title: {
            display: true,
            text: chartConfig.granularity === '1h' ? 'Hora' : 'Data',
            font: { size: 14 },
          },
          ticks: { font: { size: 12 } },
        },
      },
    },
  });

  LogHelper.log('[ENERGY] [RFC-0097] Fullscreen chart rebuilt');
}

/**
 * RFC-0097: Close fullscreen chart overlay
 */
function closeFullscreenChart() {
  const targetDoc = window.parent?.document || document;
  const container = targetDoc.getElementById('energyChartFullscreenGlobal');

  if (container) {
    container.style.display = 'none';
  }

  targetDoc.body.style.overflow = '';
  targetDoc.removeEventListener('keydown', handleFullscreenEsc);

  // Destroy fullscreen chart instance
  if (fullscreenChartInstance) {
    fullscreenChartInstance.destroy();
    fullscreenChartInstance = null;
  }

  // RFC-0098: Sync main chart via component API
  if (consumptionChartInstance && typeof consumptionChartInstance.refresh === 'function') {
    consumptionChartInstance.refresh();
  }

  LogHelper.log('[ENERGY] [RFC-0097] Fullscreen closed');
}

/**
 * RFC-0097: ESC key handler for fullscreen mode
 */
function handleFullscreenEsc(e) {
  if (e.key === 'Escape' && isChartFullscreen) {
    toggleChartFullscreen();
  }
}

/**
 * RFC-0097: Setup maximize button handler
 */
function setupMaximizeButton() {
  const maximizeBtn = document.getElementById('maximizeChartBtn');
  if (!maximizeBtn) {
    LogHelper.warn('[ENERGY] [RFC-0097] Maximize button not found');
    return;
  }

  maximizeBtn.addEventListener('click', toggleChartFullscreen);
  LogHelper.log('[ENERGY] [RFC-0097] Maximize button handler setup complete');
}

/**
 * RFC-0097: Fetches consumption for a period and groups by day
 * Fetches in batches of 3 with delay between batches to avoid rate limiting.
 * @param {string} customerId - Customer ID
 * @param {number} startTs - Start timestamp (unused, we use dayBoundaries)
 * @param {number} endTs - End timestamp (unused, we use dayBoundaries)
 * @param {Array} dayBoundaries - Array of { label, startTs, endTs }
 * @returns {Promise<number[]>} - Array of daily totals
 */
async function fetchPeriodConsumptionByDay(customerId, startTs, endTs, dayBoundaries) {
  try {
    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 500; // 500ms delay between batches
    const dailyTotals = [];

    // Process in batches of 3
    for (let i = 0; i < dayBoundaries.length; i += BATCH_SIZE) {
      const batch = dayBoundaries.slice(i, i + BATCH_SIZE);

      // Fetch batch in parallel
      const batchPromises = batch.map(async (day) => {
        try {
          const result = await window.MyIOUtils.fetchEnergyDayConsumption(customerId, day.startTs, day.endTs);
          return result?.total || 0;
        } catch (dayError) {
          LogHelper.warn(`[ENERGY] [RFC-0097] Error fetching day ${day.label}:`, dayError);
          return 0;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      dailyTotals.push(...batchResults);

      // Add delay before next batch (except for last batch)
      if (i + BATCH_SIZE < dayBoundaries.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    LogHelper.log(
      `[ENERGY] [RFC-0097] Period consumption for ${customerId.slice(0, 8)}:`,
      dailyTotals.map((v) => v.toFixed(2))
    );
    return dailyTotals;
  } catch (error) {
    LogHelper.error('[ENERGY] Error fetching period consumption:', error);
    return new Array(dayBoundaries.length).fill(0);
  }
}

/**
 * Busca o consumo total de todos os devices para um dia específico
 * @param {string} customerId - ID do customer
 * @param {number} startTs - Início do dia em ms
 * @param {number} endTs - Fim do dia em ms
 * @returns {Promise<number>} - Total de consumo em kWh
 */
async function fetchDayTotalConsumption(customerId, startTs, endTs) {
  // RFC-0073: Debug mock data
  if (MOCK_DEBUG_DAY_CONSUMPTION) {
    const dayDate = new Date(startTs);
    const dayOfWeek = dayDate.getDay(); // 0 = Sunday, 6 = Saturday

    // Generate realistic consumption patterns
    // Weekends have lower consumption, weekdays higher
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Base consumption varies by customer (use customerId to generate deterministic values)
    const customerSeed = customerId ? Math.abs(customerId.charCodeAt(0)) : 50;
    const baseConsumption = 8000 + (customerSeed % 4000); // 8000-12000 kWh base

    // Weekend reduction (20-30% less)
    const weekendFactor = isWeekend ? 0.7 + Math.random() * 0.1 : 1.0;

    // Daily variation (±15%)
    const variation = 0.85 + Math.random() * 0.3;

    const mockConsumption = baseConsumption * weekendFactor * variation;

    LogHelper.log(
      `[ENERGY] [MOCK] Day total (${dayDate.toLocaleDateString()}): ${mockConsumption.toFixed(2)} kWh`
    );

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    return mockConsumption;
  }

  try {
    const result = await window.MyIOUtils.fetchEnergyDayConsumption(customerId, startTs, endTs, '1d');

    // RFC-0097: API returns array directly or { devices: [...] }
    // Format: [{ id, name, type, consumption: [{ timestamp, value }] }]
    let total = 0;
    const devices = Array.isArray(result) ? result : result?.devices || result?.data || [];

    if (Array.isArray(devices)) {
      devices.forEach((device) => {
        // Check for new API format with consumption array
        if (Array.isArray(device.consumption)) {
          device.consumption.forEach((entry) => {
            total += Number(entry.value) || 0;
          });
        } else {
          // Fallback for old format with total_value
          total += Number(device.total_value) || Number(device.value) || 0;
        }
      });
    }

    // If no devices processed, use the pre-calculated total
    if (total === 0 && result.total > 0) {
      total = result.total;
    }

    LogHelper.log(`[ENERGY] Day total (${new Date(startTs).toLocaleDateString()}): ${total.toFixed(2)} kWh`);
    return total;
  } catch (error) {
    LogHelper.error('[ENERGY] Error fetching day total:', error);
    return 0;
  }
}

/**
 * Classifica EQUIPAMENTOS (não lojas) em categorias
 * IMPORTANTE: Lojas são identificadas pelo lojasIngestionIds do orchestrator
 * Esta função APENAS classifica equipamentos
 *
 * REGRAS (mesma lógica do EQUIPMENTS):
 * 1. Se deviceType = "3F_MEDIDOR" E deviceProfile existe → usa deviceProfile como deviceType
 * 2. Classifica baseado no deviceType (não no label):
 *    - ELEVADOR/ELEVATOR → Elevadores
 *    - ESCADA_ROLANTE → Escadas Rolantes
 *    - CHILLER, AR_CONDICIONADO, AC → Climatização
 *    - Resto → Outros Equipamentos
 */
function classifyEquipmentDetailed(device) {
  let deviceType = (device.deviceType || '').toUpperCase();
  const deviceProfile = (device.deviceProfile || '').toUpperCase();
  const identifier = (device.deviceIdentifier || device.name || '').toUpperCase();
  const labelOrName = (device.labelOrName || device.label || device.name || '').toUpperCase();

  // RFC-0076: REGRA 1: Se é 3F_MEDIDOR e tem deviceProfile válido, usa o deviceProfile como deviceType
  if (deviceType === '3F_MEDIDOR' && deviceProfile && deviceProfile !== 'N/D') {
    deviceType = deviceProfile;
  }

  // RFC-0076: REGRA 2 (CRITICAL FIX): Se deviceType está vazio mas há deviceProfile, usa deviceProfile
  if (!deviceType && deviceProfile && deviceProfile !== 'N/D') {
    deviceType = deviceProfile;
  }

  // RFC-0076: Priority 1 - ELEVATORS
  // Check deviceType first (now includes deviceProfile!), then fallback to name patterns
  if (deviceType === 'ELEVADOR' || deviceType === 'ELEVATOR') {
    return 'Elevadores';
  }
  // Fallback: Check name patterns for elevators
  if (
    labelOrName.includes('ELEVADOR') ||
    labelOrName.includes('ELEVATOR') ||
    labelOrName.includes(' ELV') ||
    labelOrName.includes('ELV ') ||
    (labelOrName.includes('ELV.') && !labelOrName.includes('ESRL'))
  ) {
    return 'Elevadores';
  }

  // RFC-0076: Priority 2 - ESCALATORS
  // Check deviceType first, then fallback to name patterns
  if (deviceType === 'ESCADA_ROLANTE' || deviceType === 'ESCALATOR') {
    return 'Escadas Rolantes';
  }
  // Fallback: Check name patterns for escalators
  if (
    labelOrName.includes('ESCADA') ||
    labelOrName.includes('ESCALATOR') ||
    labelOrName.includes('ESRL') ||
    labelOrName.includes('ESC.ROL')
  ) {
    return 'Escadas Rolantes';
  }

  // RFC-0076: Priority 3 - CLIMATIZAÇÃO (HVAC)
  // Check for CAG in identifier or labelOrName (same as EQUIPMENTS widget)
  const hasCAG = identifier.includes('CAG') || labelOrName.includes('CAG');

  const hvacTypes = ['CHILLER', 'FANCOIL', 'AR_CONDICIONADO', 'AC', 'HVAC', 'BOMBA'];
  const hvacNamePatterns =
    labelOrName.includes('FANCOIL') ||
    labelOrName.includes('CHILLER') ||
    labelOrName.includes('CAG') ||
    labelOrName.includes('HVAC') ||
    labelOrName.includes('BOMBA') ||
    labelOrName.includes('AR COND') ||
    labelOrName.includes('MOTR');

  if (hasCAG || hvacTypes.includes(deviceType) || hvacNamePatterns) {
    return 'Climatização';
  }

  // RFC-0076: Default - Everything else is "Outros Equipamentos"
  // This includes: MOTOR and any other equipment type
  return 'Outros Equipamentos';
}

/**
 * Calcula distribuição baseada no modo selecionado
 * @param {string} mode - Modo de visualização (groups, elevators, escalators, hvac, others, stores)
 * @returns {Object} - Distribuição {label: consumption}
 */
async function calculateDistributionByMode(mode) {
  try {
    const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;

    if (!orchestrator || typeof orchestrator.getEnergyCache !== 'function') {
      LogHelper.warn('[ENERGY] Orchestrator not available');
      return null;
    }

    const energyCache = orchestrator.getEnergyCache();

    if (!energyCache || energyCache.size === 0) {
      LogHelper.warn('[ENERGY] Energy cache is empty');
      return null;
    }

    // Get filtered shopping customerIds (if filter is active)
    const filteredCustomerIds = getSelectedShoppingCustomerIds();
    const hasFilter = filteredCustomerIds.length > 0;

    LogHelper.log(
      `[ENERGY] Calculating distribution for mode: ${mode}${
        hasFilter ? ` (filtered by ${filteredCustomerIds.length} shoppings)` : ' (all shoppings)'
      }`
    );

    // Create a filtered view of energyCache if filter is active
    const filteredEnergyCache = new Map();
    if (hasFilter) {
      energyCache.forEach((deviceData, ingestionId) => {
        if (filteredCustomerIds.includes(deviceData.customerId)) {
          filteredEnergyCache.set(ingestionId, deviceData);
        }
      });
      LogHelper.log(
        `[ENERGY] Filtered energyCache: ${filteredEnergyCache.size} devices (from ${energyCache.size} total)`
      );
    } else {
      // No filter - use all devices
      energyCache.forEach((deviceData, ingestionId) => {
        filteredEnergyCache.set(ingestionId, deviceData);
      });
    }

    // Use filteredEnergyCache for all calculations
    const workingCache = filteredEnergyCache;

    if (mode === 'groups') {
      // Por grupos de equipamentos (padrão)
      const groups = {
        Elevadores: 0,
        'Escadas Rolantes': 0,
        Climatização: 0,
        'Outros Equipamentos': 0,
        Lojas: 0,
      };

      // RFC-0076: Device counters for debugging
      const deviceCounters = {
        Elevadores: 0,
        'Escadas Rolantes': 0,
        Climatização: 0,
        'Outros Equipamentos': 0,
        Lojas: 0,
      };

      // Get lojas IDs from orchestrator (same logic as MAIN uses)
      const lojasIngestionIds = orchestrator.getLojasIngestionIds?.() || new Set();
      LogHelper.log(`[ENERGY] Using lojasIngestionIds from orchestrator: ${lojasIngestionIds.size} lojas`);

      let sampleCount = 0;
      workingCache.forEach((deviceData, ingestionId) => {
        const consumption = Number(deviceData.total_value) || 0;

        // Priority 1: Check if it's a LOJA (using same logic as MAIN)
        if (lojasIngestionIds.has(ingestionId)) {
          groups['Lojas'] += consumption;
          deviceCounters['Lojas']++;

          if (sampleCount < 10) {
            LogHelper.log(`[ENERGY] 🔍 Device classification sample #${sampleCount + 1}:`, {
              name: deviceData.name,
              ingestionId: ingestionId,
              classified: 'Lojas (from lojasIngestionIds)',
              consumption: consumption,
            });
            sampleCount++;
          }
          return; // Skip further classification
        }

        // RFC-0076: Priority 2: Classify EQUIPMENTS (everything that's not a loja)
        const label = String(
          deviceData.label || deviceData.entityLabel || deviceData.entityName || deviceData.name || ''
        ).toLowerCase();

        // RFC-0076: CRITICAL FIX - Get metadata from energyCache deviceData
        // The energyCache should have all fields from ThingsBoard entity
        const device = {
          deviceType: deviceData.deviceType || deviceData.type || '',
          deviceProfile: deviceData.deviceProfile || deviceData.additionalInfo?.deviceProfile || '',
          deviceIdentifier:
            deviceData.deviceIdentifier ||
            deviceData.additionalInfo?.deviceIdentifier ||
            deviceData.name ||
            '',
          name: deviceData.name || deviceData.entityName || '',
          labelOrName: label,
          label: label,
        };

        const type = classifyEquipmentDetailed(device);
        groups[type] = (groups[type] || 0) + consumption;
        deviceCounters[type] = (deviceCounters[type] || 0) + 1;

        // RFC-0076: Enhanced logging - Log ALL devices that could be elevators
        const couldBeElevator =
          deviceData.deviceType === '3F_MEDIDOR' ||
          deviceData.type === '3F_MEDIDOR' ||
          deviceData.deviceType === 'ELEVADOR' ||
          deviceData.type === 'ELEVADOR' ||
          (deviceData.deviceProfile && deviceData.deviceProfile.toUpperCase() === 'ELEVADOR') ||
          (deviceData.additionalInfo?.deviceProfile &&
            deviceData.additionalInfo.deviceProfile.toUpperCase() === 'ELEVADOR') ||
          (deviceData.name && deviceData.name.toUpperCase().includes('ELV'));

        // RFC-0076: Log first 30 devices for debugging (increased from 10)
        if (sampleCount < 30 || couldBeElevator) {
          LogHelper.log(
            `[ENERGY] 🔍 Device classification ${couldBeElevator ? '⚡ ELEVATOR CANDIDATE' : 'sample'} #${
              sampleCount + 1
            }:`,
            {
              name: deviceData.name,
              ingestionId: ingestionId,
              deviceType: deviceData.deviceType,
              deviceProfile: deviceData.deviceProfile,
              deviceIdentifier: deviceData.deviceIdentifier,
              additionalInfo: deviceData.additionalInfo,
              label: label,
              classified: type,
              consumption: consumption,
              deviceObject: device,
              namePattern: {
                hasELV: label.toUpperCase().includes('ELV'),
                hasELEVADOR: label.toUpperCase().includes('ELEVADOR'),
                hasESRL: label.toUpperCase().includes('ESRL'),
                hasESCADA: label.toUpperCase().includes('ESCADA'),
                hasCAG:
                  (deviceData.name || '').toUpperCase().includes('CAG') ||
                  label.toUpperCase().includes('CAG'),
                hasMOTR: label.toUpperCase().includes('MOTR'),
              },
            }
          );
          if (!couldBeElevator) sampleCount++;
        }

        // RFC-0076: Log Elevadores and Escadas Rolantes specifically
        if (type === 'Elevadores' || type === 'Escadas Rolantes') {
          LogHelper.log(`[ENERGY] ✅ Found ${type}:`, {
            name: deviceData.name,
            deviceType: deviceData.deviceType,
            deviceProfile: deviceData.deviceProfile,
            consumption: consumption,
            classifiedBy: 'name-pattern',
          });
        }
      });

      // RFC-0076: Enhanced logging for debugging
      LogHelper.log('[ENERGY] ============================================');
      LogHelper.log('[ENERGY] Distribution by groups (RFC-0076):');
      LogHelper.log(
        '[ENERGY] - Total devices processed:',
        workingCache.size,
        hasFilter ? `(filtered from ${energyCache.size})` : ''
      );
      LogHelper.log('[ENERGY] - Lojas from orchestrator:', lojasIngestionIds.size);
      LogHelper.log('[ENERGY] Device counts by category:');
      Object.entries(deviceCounters).forEach(([cat, count]) => {
        LogHelper.log(`[ENERGY]   - ${cat}: ${count} devices, ${groups[cat].toFixed(2)} kWh`);
      });
      LogHelper.log('[ENERGY] Distribution breakdown (consumption):', groups);

      // RFC-0076: Warning and diagnostic info if no elevators found
      if (deviceCounters['Elevadores'] === 0) {
        LogHelper.warn('[ENERGY] ⚠️  No elevators detected in energyCache. Possible causes:');
        LogHelper.warn('[ENERGY]     1. Elevators may not have energy measurement devices');
        LogHelper.warn('[ENERGY]     2. Elevator devices may not be included in /energy/devices/totals API');
        LogHelper.warn('[ENERGY]     3. deviceType/deviceProfile metadata may be missing from energyCache');
        LogHelper.warn('[ENERGY]     4. Elevator naming convention may differ from expected patterns');
        LogHelper.warn("[ENERGY]     Expected patterns: 'ELEVADOR', 'ELEVATOR', 'ELV' in device name/label");

        // Print sample of "Outros Equipamentos" to help identify misclassified elevators
        LogHelper.log("[ENERGY] 📋 Sample of 'Outros Equipamentos' (first 20 devices):");
        let othersCount = 0;
        workingCache.forEach((deviceData, ingestionId) => {
          if (!lojasIngestionIds.has(ingestionId) && othersCount < 20) {
            const label = String(
              deviceData.label || deviceData.entityLabel || deviceData.entityName || deviceData.name || ''
            ).toLowerCase();
            const device = {
              deviceType: deviceData.deviceType || '',
              deviceProfile: deviceData.deviceProfile || '',
              deviceIdentifier: deviceData.deviceIdentifier || '',
              name: deviceData.name || '',
              labelOrName: label,
              label: label,
            };
            const classification = classifyEquipmentDetailed(device);
            if (classification === 'Outros Equipamentos') {
              LogHelper.log(
                `[ENERGY]    - "${deviceData.name || label}" (deviceType: ${device.deviceType}, profile: ${
                  device.deviceProfile
                })`
              );
              othersCount++;
            }
          }
        });
      }

      LogHelper.log('[ENERGY] ============================================');

      return groups;
    } else {
      // Por shopping para tipo específico
      let equipmentType;
      switch (mode) {
        case 'elevators':
          equipmentType = 'Elevadores';
          break;
        case 'escalators':
          equipmentType = 'Escadas Rolantes';
          break;
        case 'hvac':
          equipmentType = 'Climatização';
          break;
        case 'others':
          equipmentType = 'Outros Equipamentos';
          break;
        case 'stores':
          equipmentType = 'Lojas';
          break;
        default:
          equipmentType = 'Elevadores';
      }

      // Get lojas IDs from orchestrator (same logic as MAIN uses)
      const lojasIngestionIds = orchestrator.getLojasIngestionIds?.() || new Set();

      // Agrupar por shopping
      const shoppingDistribution = {};

      workingCache.forEach((deviceData, ingestionId) => {
        const consumption = Number(deviceData.total_value) || 0;
        let type;

        // RFC-0076: Check if it's a loja first (using same logic as MAIN)
        if (lojasIngestionIds.has(ingestionId)) {
          type = 'Lojas';
        } else {
          // Classify equipment (includes deviceProfile, deviceIdentifier and name)
          const label = String(
            deviceData.label || deviceData.entityLabel || deviceData.entityName || deviceData.name || ''
          ).toLowerCase();
          const device = {
            deviceType: deviceData.deviceType || '',
            deviceProfile: deviceData.deviceProfile || '',
            deviceIdentifier: deviceData.deviceIdentifier || '',
            name: deviceData.name || '',
            labelOrName: label,
            label: label,
          };
          type = classifyEquipmentDetailed(device);
        }

        // Só incluir se for do tipo selecionado
        if (type === equipmentType) {
          const customerId = deviceData.customerId;
          const shoppingName = getShoppingName(customerId);

          shoppingDistribution[shoppingName] = (shoppingDistribution[shoppingName] || 0) + consumption;
        }
      });

      LogHelper.log(
        `[ENERGY] Distribution by ${mode}${hasFilter ? ' (filtered)' : ''}:`,
        shoppingDistribution
      );
      return shoppingDistribution;
    }
  } catch (error) {
    LogHelper.error('[ENERGY] Error calculating distribution by mode:', error);
    return null;
  }
}

/**
 * Obtém o nome do shopping pelo customerId
 */
function getShoppingName(customerId) {
  if (!customerId) return 'Sem Shopping';

  // Priority 1: Try to get from energyCache (has customerName from API /totals)
  const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
  if (orchestrator && typeof orchestrator.getEnergyCache === 'function') {
    const energyCache = orchestrator.getEnergyCache();

    // Find any device with this customerId and get customerName
    for (const [ingestionId, deviceData] of energyCache) {
      if (deviceData.customerId === customerId && deviceData.customerName) {
        return deviceData.customerName;
      }
    }
  }

  // Priority 2: Tentar buscar dos customers carregados
  if (window.custumersSelected && Array.isArray(window.custumersSelected)) {
    const shopping = window.custumersSelected.find((c) => c.value === customerId);
    if (shopping) return shopping.name;
  }

  // Priority 3: Tentar buscar do ctx
  if (self.ctx.$scope?.custumer && Array.isArray(self.ctx.$scope.custumer)) {
    const shopping = self.ctx.$scope.custumer.find((c) => c.value === customerId);
    if (shopping) return shopping.name;
  }

  // Fallback
  return `Shopping ${customerId.substring(0, 8)}...`;
}

/**
 * RFC-0098: Data fetching adapter for the standardized Consumption7DaysChart component
 * Wraps existing fetch logic to conform to the component's expected interface
 * @param {number} period - Number of days to fetch
 * @returns {Promise<object>} - Consumption7DaysData formatted data
 */
async function fetchConsumptionDataAdapter(period) {
  LogHelper.log('[ENERGY] [RFC-0098] Fetching data via adapter for', period, 'days');

  // Get customer ID from MAIN_VIEW (exposed via window.MyIOUtils.customerTB_ID)
  const customerId = window.MyIOUtils?.customerTB_ID || window.myioHoldingCustomerId;
  if (!customerId) {
    LogHelper.error(
      '[ENERGY] [RFC-0098] ❌ customerId not found - MAIN_VIEW has not initialized window.MyIOUtils.customerTB_ID'
    );
    return { labels: [], dailyTotals: [], shoppingData: {}, shoppingNames: {} };
  }

  // Get filtered shopping IDs or use widget's customerId
  const selectedShoppingIds = getSelectedShoppingIds();
  const customerIds = selectedShoppingIds.length > 0 ? selectedShoppingIds : [customerId];

  // Update chartConfig period for compatibility with existing modal
  chartConfig.period = period;

  // Use existing fetch logic
  const data = await fetch7DaysConsumptionFiltered(customerIds, true);

  return {
    labels: data.labels || [],
    dailyTotals: data.dailyTotals || [],
    shoppingData: data.shoppingData || {},
    shoppingNames: data.shoppingNames || {},
    fetchTimestamp: Date.now(),
    customerIds: customerIds,
  };
}

/**
 * Inicializa os gráficos com dados reais
 * RFC-0098: Now uses createConsumption7DaysChart for the line chart
 */
async function initializeCharts() {
  LogHelper.log('[ENERGY] [RFC-0098] Initializing charts with standardized component...');

  // Get customer ID from MAIN_VIEW (exposed via window.MyIOUtils.customerTB_ID)
  const customerId = window.MyIOUtils?.customerTB_ID || window.myioHoldingCustomerId;

  if (!customerId) {
    LogHelper.error(
      '[ENERGY] [RFC-0098] ❌ customerId not found - MAIN_VIEW has not initialized window.MyIOUtils.customerTB_ID'
    );
    return;
  }

  LogHelper.log('[ENERGY] Customer ID (from MAIN_VIEW):', customerId);

  // Get widget container for ThingsBoard compatibility (shared by all widgets)
  const $container = self.ctx?.$container || null;

  // RFC-0098: Initialize line chart using the standardized widget component
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createConsumptionChartWidget) {
    LogHelper.log('[ENERGY] [RFC-0098] Using createConsumptionChartWidget component');

    consumptionChartInstance = MyIOLibrary.createConsumptionChartWidget({
      domain: 'energy',
      containerId: 'energy-chart-widget',
      title: 'Consumo de Energia - 7 dias',
      unit: 'kWh',
      unitLarge: 'MWh',
      thresholdForLargeUnit: 1000,
      decimalPlaces: 1,
      chartHeight: 280,
      defaultPeriod: chartConfig.period || 7,
      defaultChartType: chartConfig.chartType || 'line',
      defaultVizMode: chartConfig.vizMode || 'total',
      theme: 'light',
      $container: $container,

      // Data fetching via adapter
      fetchData: fetchConsumptionDataAdapter,

      // Callbacks
      onMaximizeClick: () => {
        LogHelper.log('[ENERGY] [RFC-0098] Maximize button clicked');
        openFullscreenModal();
      },
      onDataLoaded: (data) => {
        // Update cache for fullscreen and other features
        cachedChartData = data;
        LogHelper.log('[ENERGY] [RFC-0098] Data loaded:', data.labels?.length, 'days');
      },
      onError: (error) => {
        LogHelper.error('[ENERGY] [RFC-0098] Chart error:', error);
      },
    });

    // Render the chart
    await consumptionChartInstance.render();
    LogHelper.log('[ENERGY] [RFC-0098] Consumption chart rendered successfully');

    // Store reference for compatibility with existing code
    lineChartInstance = consumptionChartInstance.getChartInstance();
  } else {
    LogHelper.error('[ENERGY] [RFC-0098] createConsumptionChartWidget not available in MyIOLibrary!');
    return;
  }

  // RFC-0102: Initialize distribution chart using createDistributionChartWidget
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createDistributionChartWidget) {
    LogHelper.log('[ENERGY] [RFC-0102] Initializing distribution chart widget...');

    distributionChartInstance = MyIOLibrary.createDistributionChartWidget({
      domain: 'energy',
      containerId: 'energy-distribution-widget',
      title: 'Distribuição de Energia',
      unit: 'kWh',
      unitLarge: 'MWh',
      thresholdForLargeUnit: 1000,
      decimalPlaces: 2,
      chartHeight: 300,
      theme: 'light',
      $container: $container,

      // Visualization modes
      modes: [
        { value: 'groups', label: 'Por Grupos de Equipamentos' },
        { value: 'elevators', label: 'Elevadores por Shopping' },
        { value: 'escalators', label: 'Escadas Rolantes por Shopping' },
        { value: 'hvac', label: 'Climatização por Shopping' },
        { value: 'others', label: 'Outros Equipamentos por Shopping' },
        { value: 'stores', label: 'Lojas por Shopping' },
      ],
      defaultMode: 'groups',

      // Data fetching - uses existing calculateDistributionByMode function
      fetchDistribution: async (mode) => {
        LogHelper.log(`[ENERGY] [RFC-0102] Fetching distribution for mode: ${mode}`);
        return await calculateDistributionByMode(mode);
      },

      // Get shopping colors from orchestrator for consistency
      getShoppingColors: () => {
        const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
        return orchestrator?.getShoppingColors?.() || null;
      },

      // Callbacks
      onModeChange: (mode) => {
        LogHelper.log(`[ENERGY] [RFC-0102] Distribution mode changed to: ${mode}`);
      },
      onDataLoaded: (data) => {
        LogHelper.log('[ENERGY] [RFC-0102] Distribution data loaded:', Object.keys(data).length, 'items');
      },
      onError: (error) => {
        LogHelper.error('[ENERGY] [RFC-0102] Distribution chart error:', error);
      },
    });

    // Render the distribution chart after a delay to ensure orchestrator is ready
    setTimeout(async () => {
      try {
        await distributionChartInstance.render();
        LogHelper.log('[ENERGY] [RFC-0102] Distribution chart rendered successfully');

        // Store legacy reference for backwards compatibility
        pieChartInstance = distributionChartInstance.getChartInstance();
      } catch (error) {
        LogHelper.error('[ENERGY] [RFC-0102] Failed to render distribution chart:', error);
      }

      // RFC-0098: Setup chart tab handlers (now using component API)
      setupChartTabHandlersRFC0098();
    }, 2000); // Delay to ensure orchestrator is ready
  } else {
    LogHelper.error('[ENERGY] [RFC-0102] createDistributionChartWidget not available in MyIOLibrary!');
  }
}

/**
 * RFC-0098: Setup chart tab handlers
 * NOTE: The createConsumptionChartWidget component now handles tabs internally.
 * This function is kept for backwards compatibility with external tabs if present.
 */
function setupChartTabHandlersRFC0098() {
  // RFC-0098: The widget component injects its own tabs, so external tabs may not exist
  // If external tabs are present, sync them with the widget API
  const vizTabs = document.querySelectorAll('.viz-mode-tabs .chart-tab');
  const typeTabs = document.querySelectorAll('.chart-type-tabs .chart-tab');

  if (vizTabs.length === 0 && typeTabs.length === 0) {
    LogHelper.log('[ENERGY] [RFC-0098] No external tabs found - widget handles tabs internally');
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

  LogHelper.log('[ENERGY] [RFC-0098] External tab handlers setup (if present)');
}

/**
 * RFC-0097: Fetch consumption for configured period (respects shopping filter and chart config)
 * Returns data structured for caching and re-rendering
 * OPTIMIZED: Makes only N API calls (one per shopping) instead of N x Days
 */
async function fetch7DaysConsumptionFiltered(customerIds, forceRefresh = false) {
  if (!customerIds || customerIds.length === 0) {
    return { labels: [], dailyTotals: [], shoppingData: {}, shoppingNames: {} };
  }

  // RFC-0097: Use configured period or default to 7 days
  const period = chartConfig.period || 7;
  const granularity = chartConfig.granularity || '1d';

  // RFC-0097: Check if cache is valid (same customerIds and not expired)
  if (!forceRefresh && cachedChartData && cachedChartData.fetchTimestamp) {
    const cacheAge = Date.now() - cachedChartData.fetchTimestamp;
    const sameCustomers =
      cachedChartData.customerIds &&
      cachedChartData.customerIds.length === customerIds.length &&
      cachedChartData.customerIds.every((id) => customerIds.includes(id));

    if (cacheAge < CHART_CACHE_TTL && sameCustomers) {
      LogHelper.log('[ENERGY] [RFC-0097] Using cached data (age:', Math.round(cacheAge / 1000), 's)');
      return cachedChartData;
    }
  }

  LogHelper.log(
    '[ENERGY] [RFC-0097] Fetching',
    period,
    'days with granularity',
    granularity,
    'for customers:',
    customerIds
  );

  const shoppingData = {}; // { customerId: [values per day...] }
  const shoppingNames = {}; // { customerId: name }

  // Initialize shopping data
  customerIds.forEach((cid) => {
    shoppingData[cid] = [];
    shoppingNames[cid] = getShoppingNameForFilter(cid);
  });

  // Calculate period start/end timestamps (full period, not per day)
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(now.getDate() - (period - 1));
  periodStart.setHours(0, 0, 0, 0);
  const startTs = periodStart.getTime();

  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);
  const endTs = periodEnd.getTime();

  // Build day labels and day boundaries for grouping
  const dayBoundaries = []; // { label, startTs, endTs }
  for (let i = 0; i < period; i++) {
    const dayDate = new Date(periodStart);
    dayDate.setDate(periodStart.getDate() + i);
    dayDate.setHours(0, 0, 0, 0);

    const dayStart = dayDate.getTime();
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    const label = dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    dayBoundaries.push({ label, startTs: dayStart, endTs: dayEnd.getTime() });
  }

  const labels = dayBoundaries.map((d) => d.label);

  // OPTIMIZATION: Only N API calls (one per shopping for entire period)
  LogHelper.log('[ENERGY] [RFC-0097] Executing', customerIds.length, 'API calls (one per shopping)...');

  const fetchPromises = customerIds.map((customerId) =>
    fetchPeriodConsumptionByDay(customerId, startTs, endTs, dayBoundaries)
  );

  const results = await Promise.all(fetchPromises);

  // Process results - each result is an array of daily totals for that shopping
  results.forEach((dailyValues, idx) => {
    const customerId = customerIds[idx];
    shoppingData[customerId] = dailyValues;
  });

  // Calculate daily totals (sum across all shoppings)
  const dailyTotals = [];
  for (let dayIdx = 0; dayIdx < period; dayIdx++) {
    let dayTotal = 0;
    for (const customerId of customerIds) {
      dayTotal += shoppingData[customerId][dayIdx] || 0;
    }
    dailyTotals.push(dayTotal);
  }

  // RFC-0097: Store in cache for re-rendering
  cachedChartData = {
    labels,
    dailyTotals,
    shoppingData,
    shoppingNames,
    customerIds,
    fetchTimestamp: Date.now(),
  };

  LogHelper.log('[ENERGY] [RFC-0097] Data cached:', {
    days: period,
    shoppings: customerIds.length,
    totalPoints: labels.length,
    parallelCalls: fetchPromises.length,
  });

  return cachedChartData;
}

/**
 * RFC-0073: Helper to get shopping name for chart label
 */
function getShoppingNameForFilter(customerId) {
  if (window.custumersSelected && Array.isArray(window.custumersSelected)) {
    const shopping = window.custumersSelected.find((c) => c.value === customerId);
    if (shopping) return shopping.name;
  }
  return 'Shopping';
}

/**
 * RFC-0102: Atualiza o gráfico de distribuição usando o novo componente
 * @param {string} mode - Mode to display: "groups", "elevators", "escalators", "hvac", "others", "stores"
 * @deprecated Use distributionChartInstance.setMode() or distributionChartInstance.refresh() instead
 */
async function updatePieChart(mode = 'groups') {
  // RFC-0102: Use the new distribution chart widget API
  if (distributionChartInstance) {
    try {
      LogHelper.log(`[ENERGY] [RFC-0102] Updating distribution chart with mode: ${mode}`);
      await distributionChartInstance.setMode(mode);
    } catch (error) {
      LogHelper.error('[ENERGY] [RFC-0102] Error updating distribution chart:', error);
    }
    return;
  }

  // Legacy fallback (should not be reached if component is initialized)
  LogHelper.warn('[ENERGY] [RFC-0102] Distribution chart instance not available, legacy code path');
}

/**
 * RFC-0102: Distribution mode selector is now handled by the component internally
 * @deprecated The createDistributionChartWidget component handles mode selection internally
 */
function setupDistributionModeSelector() {
  // RFC-0102: Mode selector is now handled by createDistributionChartWidget component
  // This function is kept for backwards compatibility but does nothing
  LogHelper.log(
    '[ENERGY] [RFC-0102] Distribution mode selector handled by component - skipping legacy setup'
  );
}

// RFC-0098: Legacy chart functions removed - now using createConsumption7DaysChart component
// RFC-0098: Legacy modal functions removed (openChartConfigModal, closeChartConfigModal, etc.) - settings handled by component
// RFC-0098: initializeMockCharts removed - chart requires customerId and component

// ============================================
// MAIN INITIALIZATION
// ============================================

// RFC-0097: Guard to prevent multiple initializations and store handlers for cleanup
let energyWidgetInitialized = false;
let registeredHandlers = {
  handleEnergySummary: null,
  handleFilterApplied: null,
  handleEquipmentMetadataEnriched: null,
};

/**
 * RFC-0097: Cleanup function to remove all event listeners
 */
function cleanupEventListeners() {
  if (registeredHandlers.handleEnergySummary) {
    window.removeEventListener('myio:energy-summary-ready', registeredHandlers.handleEnergySummary);
    if (window.parent !== window) {
      window.parent.removeEventListener('myio:energy-summary-ready', registeredHandlers.handleEnergySummary);
    }
  }
  if (registeredHandlers.handleFilterApplied) {
    window.removeEventListener('myio:filter-applied', registeredHandlers.handleFilterApplied);
    if (window.parent !== window) {
      window.parent.removeEventListener('myio:filter-applied', registeredHandlers.handleFilterApplied);
    }
  }
  if (registeredHandlers.handleEquipmentMetadataEnriched) {
    window.removeEventListener(
      'myio:equipment-metadata-enriched',
      registeredHandlers.handleEquipmentMetadataEnriched
    );
    if (window.parent !== window) {
      window.parent.removeEventListener(
        'myio:equipment-metadata-enriched',
        registeredHandlers.handleEquipmentMetadataEnriched
      );
    }
  }
  LogHelper.log('[ENERGY] [RFC-0097] Event listeners cleaned up');
}

// ============================================
// WIDGET ENERGY - FUNÇÃO DE INICIALIZAÇÃO COMPLETA
// ============================================
self.onInit = async function () {
  // RFC-0097: Prevent multiple initializations
  if (energyWidgetInitialized) {
    LogHelper.log('[ENERGY] [RFC-0097] Widget already initialized, skipping...');
    return;
  }

  LogHelper.log('[ENERGY] Initializing energy charts and consumption cards...');

  // RFC-0097: Cleanup any existing listeners before adding new ones
  cleanupEventListeners();

  // 1. INICIALIZA A UI: Mostra os spinners de "loading" para o usuário.
  // -----------------------------------------------------------------
  initializeCharts();
  initializeTotalConsumptionStoresCard(); // Novo: card de lojas
  initializeTotalConsumptionEquipmentsCard(); // Novo: card de equipamentos
  // initializePeakDemandCard(); // DESABILITADO TEMPORARIAMENTE

  // 2. LÓGICA DO CARD "CONSUMO TOTAL": Pede os dados ao MAIN.
  //    Este é o novo fluxo corrigido que resolve o problema do loading.
  // -----------------------------------------------------------------

  // Primeiro, prepara o "ouvinte" que vai receber os dados quando o MAIN responder.
  // ✅ Listen on both window and window.parent to support both iframe and non-iframe contexts
  registeredHandlers.handleEnergySummary = (ev) => {
    LogHelper.log('[ENERGY] Resumo de energia recebido do orquestrador!', ev.detail);
    // Chama as funções que atualizam os cards na tela com os dados recebidos.
    updateTotalConsumptionStoresCard(ev.detail); // Novo: card de lojas
    updateTotalConsumptionEquipmentsCard(ev.detail); // Novo: card de equipamentos
  };

  window.addEventListener('myio:energy-summary-ready', registeredHandlers.handleEnergySummary);

  if (window.parent !== window) {
    window.parent.addEventListener('myio:energy-summary-ready', registeredHandlers.handleEnergySummary);
  }

  // RFC-0073: Listen to shopping filter changes and update charts
  registeredHandlers.handleFilterApplied = async (ev) => {
    LogHelper.log('[ENERGY] [RFC-0073] Shopping filter applied, updating charts...', ev.detail);

    // Invalidate cache when filter changes
    cachedChartData = null;

    // RFC-0102: Update distribution chart to reflect filtered data
    if (distributionChartInstance) {
      LogHelper.log('[ENERGY] [RFC-0102] Refreshing distribution chart after filter change');
      await distributionChartInstance.refresh();
    }

    // RFC-0098: Update line chart using component API if available
    if (consumptionChartInstance && typeof consumptionChartInstance.refresh === 'function') {
      LogHelper.log('[ENERGY] [RFC-0098] Refreshing chart via component API');
      await consumptionChartInstance.refresh(true); // Force refresh to bypass cache
    } else {
      LogHelper.error('[ENERGY] [RFC-0098] Component not available for refresh');
    }
  };

  window.addEventListener('myio:filter-applied', registeredHandlers.handleFilterApplied);

  if (window.parent !== window) {
    window.parent.addEventListener('myio:filter-applied', registeredHandlers.handleFilterApplied);
  }

  // RFC-0076: Listen to equipment metadata enrichment from EQUIPMENTS widget
  // This forces chart updates when EQUIPMENTS finishes enriching the cache with deviceType/deviceProfile
  registeredHandlers.handleEquipmentMetadataEnriched = async (ev) => {
    LogHelper.log('[ENERGY] [RFC-0076] 🔧 Equipment metadata enriched! Forcing chart update...', ev.detail);

    // RFC-0102: Force immediate update of distribution chart to pick up elevator classifications
    if (distributionChartInstance) {
      LogHelper.log('[ENERGY] [RFC-0102] Refreshing distribution chart after metadata enrichment');
      await distributionChartInstance.refresh();
    }

    LogHelper.log('[ENERGY] [RFC-0076] [RFC-0102] Charts updated with enriched metadata');
  };

  window.addEventListener(
    'myio:equipment-metadata-enriched',
    registeredHandlers.handleEquipmentMetadataEnriched
  );

  if (window.parent !== window) {
    window.parent.addEventListener(
      'myio:equipment-metadata-enriched',
      registeredHandlers.handleEquipmentMetadataEnriched
    );
  }

  // RFC-0097: Mark widget as initialized
  energyWidgetInitialized = true;

  // DEPOIS (NOVO CÓDIGO PARA O onInit DO WIDGET ENERGY)

  // Em seguida, inicia um "vigia" que espera o Orquestrador ficar pronto.
  const waitForOrchestratorAndRequestSummary = () => {
    let attempts = 0;
    const maxAttempts = 50; // Tenta por 10 segundos (50 * 200ms)

    const intervalId = setInterval(() => {
      attempts++;

      // ✅ CORREÇÃO: Procura no "quarto" (window) E na "sala principal" (window.parent)
      const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;

      // VERIFICA SE O ORQUESTRADOR FOI ENCONTRADO EM UM DOS DOIS LUGARES
      if (orchestrator && typeof orchestrator.requestSummary === 'function') {
        // SUCESSO! Orquestrador encontrado.
        clearInterval(intervalId); // Para de vigiar
        LogHelper.log(`[ENERGY] Orquestrador encontrado após ${attempts} tentativas. Solicitando resumo.`);

        // Chama a função do orquestrador encontrado
        orchestrator.requestSummary();
      } else if (attempts >= maxAttempts) {
        // FALHA: Timeout
        clearInterval(intervalId); // Para de vigiar
        LogHelper.error(
          '[ENERGY] TIMEOUT: Orquestrador não foi encontrado após 10 segundos. O card não será carregado.'
        );
      }
    }, 200); // Verifica a cada 200ms
  };

  // Inicia o "vigia"
  waitForOrchestratorAndRequestSummary();

  // 4. OUTROS LISTENERS (Bônus): Mantém a robustez do widget.
  // -----------------------------------------------------------------

  // Limpa os caches se um evento global de limpeza for disparado.
  window.addEventListener('myio:telemetry:clear', (ev) => {
    LogHelper.log('[ENERGY] Evento de limpeza de cache recebido.', ev.detail);

    // Reinicializa os cards para o estado de loading
    initializeTotalConsumptionCard();
    //initializePeakDemandCard();
  });
};

// ============================================
// WIDGET ENERGY - CLEANUP ON DESTROY
// ============================================

self.onDestroy = function () {
  LogHelper.log('[ENERGY] [RFC-0073] Widget destroying, cleaning up modals');

  // RFC-0073: Remove chart configuration modal if it exists
  const globalContainer = document.getElementById('energyChartConfigModalGlobal');
  if (globalContainer) {
    const modal = globalContainer.querySelector('#chartConfigModal');
    if (modal && modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
      modal._escHandler = null;
    }

    // Remove global modal container from document.body
    globalContainer.remove();
    LogHelper.log('[ENERGY] [RFC-0073] Global modal container removed on destroy');
  }

  // Remove modal-open class if widget is destroyed with modal open
  document.body.classList.remove('modal-open');

  // RFC-0097: Cleanup fullscreen mode if active
  if (isChartFullscreen) {
    closeFullscreenChart();
    isChartFullscreen = false;
  }

  // RFC-0097: Remove fullscreen container from parent document
  const targetDoc = window.parent?.document || document;
  const fullscreenContainer = targetDoc.getElementById('energyChartFullscreenGlobal');
  if (fullscreenContainer) {
    fullscreenContainer.remove();
    LogHelper.log('[ENERGY] [RFC-0097] Fullscreen container removed on destroy');
  }

  // RFC-0097: Cleanup event listeners and reset initialization flag
  cleanupEventListeners();
  energyWidgetInitialized = false;
  cachedChartData = null;
  isUpdatingLineChart = false;
  pendingLineChartUpdate = null;

  // RFC-0098: Cleanup consumption chart instance
  if (consumptionChartInstance && typeof consumptionChartInstance.destroy === 'function') {
    LogHelper.log('[ENERGY] [RFC-0098] Destroying consumption chart instance');
    consumptionChartInstance.destroy();
    consumptionChartInstance = null;
  }

  LogHelper.log('[ENERGY] [RFC-0097] Widget destroyed, state reset');
};
