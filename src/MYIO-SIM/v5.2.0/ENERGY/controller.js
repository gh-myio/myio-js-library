/* global self, window, document, MyIOLibrary, Chart */

// ============================================
// MYIO-SIM 1.0.0 - ENERGY Widget Controller
// ============================================

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

  console.log('[ENERGY] Card de Lojas atualizado:', { lojasTotal, lojasFormatted, lojasPercentage });
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

  console.log('[ENERGY] Card de Equipamentos atualizado:', {
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

  console.log('[ENERGY] Stores consumption card initialized with loading state');
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

  console.log('[ENERGY] Equipments consumption card initialized with loading state');
}

/**
 * Atualiza o card de consumo total de LOJAS
 * @param {object} summary - O objeto de resumo calculado pelo widget MAIN.
 */
function updateTotalConsumptionStoresCard(summary) {
  console.log('[ENERGY] Atualizando card de consumo de LOJAS:', summary);

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
  console.log('[ENERGY] Atualizando card de consumo de EQUIPAMENTOS:', summary);

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

  console.log('[ENERGY] Total consumption card initialized with loading state');
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
      console.log('[ENERGY] [RFC-0096] Using filtered shopping ingestionIds:', selectedIds);
      return selectedIds;
    }
  }

  // Fallback: return empty array (will use widget's customerId)
  console.log('[ENERGY] [RFC-0096] No shopping filter active, using widget customerId');
  return [];
}

// ============================================
// CHART FUNCTIONS
// ============================================

// Global chart references for later updates
let lineChartInstance = null;
let pieChartInstance = null;

// RFC-0097: Fullscreen state
let isChartFullscreen = false;

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

/**
 * RFC-0097: Toggle fullscreen mode for energy chart
 * Uses the same pattern as filter modal - injects into parent document for true fullscreen
 */
function toggleChartFullscreen() {
  const maximizeBtn = document.getElementById('maximizeChartBtn');

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

  console.log('[ENERGY] [RFC-0097] Chart fullscreen:', isChartFullscreen);
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
      #energyChartFullscreenGlobal .fullscreen-header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #166534;
        font-family: 'Inter', sans-serif;
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
      <h3 id="fullscreenChartTitle">Consumo dos últimos 7 dias</h3>
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
    console.warn('[ENERGY] [RFC-0097] No cached data for fullscreen chart');
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
  const yAxisMax = maxValue > 0 ? Math.ceil(maxValue * 1.1 / 1000) * 1000 : 10000;

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
                return `${context.dataset.label}: ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MWh`;
              }
              return `${context.dataset.label}: ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kWh`;
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

  console.log('[ENERGY] [RFC-0097] Fullscreen chart rebuilt');
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

  // Sync main chart with any changes made in fullscreen
  rerenderLineChart();

  console.log('[ENERGY] [RFC-0097] Fullscreen closed');
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
    console.warn('[ENERGY] [RFC-0097] Maximize button not found');
    return;
  }

  maximizeBtn.addEventListener('click', toggleChartFullscreen);
  console.log('[ENERGY] [RFC-0097] Maximize button handler setup complete');
}

/**
 * RFC-0097: Fetches consumption for a period and groups by day
 * Makes ONE API call per shopping and returns array of daily totals
 * API returns: [{ id, name, type, consumption: [{ timestamp, value }] }]
 * @param {string} customerId - ID do customer
 * @param {number} startTs - Start of period in ms
 * @param {number} endTs - End of period in ms
 * @param {Array} dayBoundaries - Array of { label, startTs, endTs } for each day
 * @returns {Promise<number[]>} - Array of daily consumption totals
 */
async function fetchPeriodConsumptionByDay(customerId, startTs, endTs, dayBoundaries) {
  try {
    // Single API call for the entire period with granularity from chartConfig
    const granularity = chartConfig.granularity || '1d';
    const result = await window.MyIOUtils.fetchEnergyDayConsumption(customerId, startTs, endTs, granularity);

    // Initialize daily totals with zeros
    const dailyTotals = new Array(dayBoundaries.length).fill(0);

    // API returns array directly, not { devices: [...] }
    // Format: [{ id, name, type, consumption: [{ timestamp, value }] }]
    const items = Array.isArray(result) ? result : result?.devices || result?.data || [];

    if (items.length > 0) {
      console.log(`[ENERGY] [RFC-0097] API returned ${items.length} items for ${customerId.slice(0, 8)}`);
    }

    items.forEach((item) => {
      // Each item has consumption array with timestamp and value
      if (Array.isArray(item.consumption)) {
        item.consumption.forEach((entry) => {
          const timestamp = entry.timestamp || entry.ts;
          const value = Number(entry.value) || 0;

          if (timestamp && value > 0) {
            // Parse timestamp (ISO string like "2025-11-29T00:00:00+00:00")
            const entryTs = new Date(timestamp).getTime();

            // Find which day this timestamp belongs to
            for (let dayIdx = 0; dayIdx < dayBoundaries.length; dayIdx++) {
              const day = dayBoundaries[dayIdx];
              if (entryTs >= day.startTs && entryTs <= day.endTs) {
                dailyTotals[dayIdx] += value;
                break;
              }
            }
          }
        });
      }
    });

    console.log(
      `[ENERGY] [RFC-0097] Period consumption for ${customerId.slice(0, 8)}:`,
      dailyTotals.map((v) => v.toFixed(0))
    );
    return dailyTotals;
  } catch (error) {
    console.error('[ENERGY] Error fetching period consumption:', error);
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

    console.log(
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

    console.log(`[ENERGY] Day total (${new Date(startTs).toLocaleDateString()}): ${total.toFixed(2)} kWh`);
    return total;
  } catch (error) {
    console.error('[ENERGY] Error fetching day total:', error);
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
      console.warn('[ENERGY] Orchestrator not available');
      return null;
    }

    const energyCache = orchestrator.getEnergyCache();

    if (!energyCache || energyCache.size === 0) {
      console.warn('[ENERGY] Energy cache is empty');
      return null;
    }

    console.log(`[ENERGY] Calculating distribution for mode: ${mode}`);

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
      console.log(`[ENERGY] Using lojasIngestionIds from orchestrator: ${lojasIngestionIds.size} lojas`);

      let sampleCount = 0;
      energyCache.forEach((deviceData, ingestionId) => {
        const consumption = Number(deviceData.total_value) || 0;

        // Priority 1: Check if it's a LOJA (using same logic as MAIN)
        if (lojasIngestionIds.has(ingestionId)) {
          groups['Lojas'] += consumption;
          deviceCounters['Lojas']++;

          if (sampleCount < 10) {
            console.log(`[ENERGY] 🔍 Device classification sample #${sampleCount + 1}:`, {
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
          console.log(
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
          console.log(`[ENERGY] ✅ Found ${type}:`, {
            name: deviceData.name,
            deviceType: deviceData.deviceType,
            deviceProfile: deviceData.deviceProfile,
            consumption: consumption,
            classifiedBy: 'name-pattern',
          });
        }
      });

      // RFC-0076: Enhanced logging for debugging
      console.log('[ENERGY] ============================================');
      console.log('[ENERGY] Distribution by groups (RFC-0076):');
      console.log('[ENERGY] - Total devices processed:', energyCache.size);
      console.log('[ENERGY] - Lojas from orchestrator:', lojasIngestionIds.size);
      console.log('[ENERGY] Device counts by category:');
      Object.entries(deviceCounters).forEach(([cat, count]) => {
        console.log(`[ENERGY]   - ${cat}: ${count} devices, ${groups[cat].toFixed(2)} kWh`);
      });
      console.log('[ENERGY] Distribution breakdown (consumption):', groups);

      // RFC-0076: Warning and diagnostic info if no elevators found
      if (deviceCounters['Elevadores'] === 0) {
        console.warn('[ENERGY] ⚠️  No elevators detected in energyCache. Possible causes:');
        console.warn('[ENERGY]     1. Elevators may not have energy measurement devices');
        console.warn('[ENERGY]     2. Elevator devices may not be included in /energy/devices/totals API');
        console.warn('[ENERGY]     3. deviceType/deviceProfile metadata may be missing from energyCache');
        console.warn('[ENERGY]     4. Elevator naming convention may differ from expected patterns');
        console.warn("[ENERGY]     Expected patterns: 'ELEVADOR', 'ELEVATOR', 'ELV' in device name/label");

        // Print sample of "Outros Equipamentos" to help identify misclassified elevators
        console.log("[ENERGY] 📋 Sample of 'Outros Equipamentos' (first 20 devices):");
        let othersCount = 0;
        energyCache.forEach((deviceData, ingestionId) => {
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
              console.log(
                `[ENERGY]    - "${deviceData.name || label}" (deviceType: ${device.deviceType}, profile: ${
                  device.deviceProfile
                })`
              );
              othersCount++;
            }
          }
        });
      }

      console.log('[ENERGY] ============================================');

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

      energyCache.forEach((deviceData, ingestionId) => {
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

      console.log(`[ENERGY] Distribution by ${mode}:`, shoppingDistribution);
      return shoppingDistribution;
    }
  } catch (error) {
    console.error('[ENERGY] Error calculating distribution by mode:', error);
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
 * Inicializa os gráficos com dados reais
 */
async function initializeCharts() {
  console.log('[ENERGY] Initializing charts with real data...');

  // Get customer ID
  const customerId = self.ctx?.settings?.customerId;

  if (!customerId) {
    console.error('[ENERGY] Customer ID not found, using mock data');
    initializeMockCharts();
    return;
  }

  console.log('[ENERGY] Customer ID:', customerId);

  // Initialize line chart with 7 days data
  const lineCtx = document.getElementById('lineChart').getContext('2d');

  // Show loading state
  lineChartInstance = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: ['Carregando...'],
      datasets: [
        {
          label: 'Consumo (kWh)',
          data: [0],
          borderColor: '#2563eb',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function (context) {
              const val = context.parsed.y || 0;
              if (val >= 1000) {
                return `Consumo: ${(val / 1000).toFixed(2)} MWh`;
              }
              return `Consumo: ${val.toFixed(2)} kWh`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(1)} MWh`;
              }
              return `${value.toFixed(0)} kWh`;
            },
          },
        },
      },
    },
  });

  // Initialize bar chart with loading state
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  pieChartInstance = new Chart(pieCtx, {
    type: 'bar',
    data: {
      labels: ['Carregando...'],
      datasets: [
        {
          label: 'Consumo (kWh)',
          data: [1],
          backgroundColor: ['#e5e7eb'],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: 'y', // Horizontal bar chart
      plugins: {
        legend: {
          display: false, // Hide legend for bar chart (not needed)
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.parsed.x || 0;

              // Calculate percentage
              const dataset = context.dataset;
              const total = dataset.data.reduce((sum, val) => sum + val, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;

              // Format energy value
              let energyStr;
              if (value >= 1000) {
                energyStr = `${(value / 1000).toFixed(2)} MWh`;
              } else {
                energyStr = `${value.toFixed(2)} kWh`;
              }

              return `${energyStr} (${percentage}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(1)} MWh`;
              }
              return `${value.toFixed(0)} kWh`;
            },
          },
        },
        y: {
          ticks: {
            font: {
              size: 11,
            },
          },
        },
      },
    },
  });

  // Fetch real data and update charts
  setTimeout(async () => {
    console.log('[ENERGY] Starting chart updates...');
    await updateLineChart(customerId);
    await updatePieChart('groups'); // Initialize with default mode

    // Setup distribution mode selector
    setupDistributionModeSelector();

    // RFC-0073 Problem 1: Setup chart configuration button
    setupChartConfigButton();

    // RFC-0097: Setup chart tab handlers (vizMode and chartType)
    setupChartTabHandlers();

    // RFC-0097: Setup maximize button for fullscreen
    setupMaximizeButton();
  }, 2000); // Increased timeout to ensure orchestrator is ready
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
      console.log('[ENERGY] [RFC-0097] Using cached data (age:', Math.round(cacheAge / 1000), 's)');
      return cachedChartData;
    }
  }

  console.log(
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
  console.log('[ENERGY] [RFC-0097] Executing', customerIds.length, 'API calls (one per shopping)...');

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

  console.log('[ENERGY] [RFC-0097] Data cached:', {
    days: period,
    shoppings: customerIds.length,
    totalPoints: labels.length,
    parallelCalls: fetchPromises.length,
  });

  return cachedChartData;
}

// RFC-0097: Guard to prevent concurrent updateLineChart calls
let isUpdatingLineChart = false;
let pendingLineChartUpdate = null;

/**
 * RFC-0097: Atualiza o gráfico de linha com dados reais
 * Fetches data and uses cache for rendering
 * Includes debounce guard to prevent multiple concurrent calls
 */
async function updateLineChart(customerId) {
  // Prevent concurrent calls - if already updating, queue the latest request
  if (isUpdatingLineChart) {
    console.log('[ENERGY] [RFC-0097] updateLineChart already in progress, queuing...');
    pendingLineChartUpdate = customerId;
    return;
  }

  isUpdatingLineChart = true;

  // RFC-0097: Show loading overlay
  showChartLoading();

  try {
    console.log('[ENERGY] [RFC-0097] Fetching consumption data with config:', chartConfig);

    // RFC-0097: Get filtered shopping IDs or use widget's customerId
    const selectedShoppingIds = getSelectedShoppingIds();
    const customerIds = selectedShoppingIds.length > 0 ? selectedShoppingIds : [customerId];

    // RFC-0097: Fetch data (this also populates the cache)
    await fetch7DaysConsumptionFiltered(customerIds);

    // RFC-0097: Update chart title
    updateChartTitle();

    // RFC-0097: Render from cache
    if (cachedChartData) {
      updateLineChartFromCache(cachedChartData);
      console.log('[ENERGY] [RFC-0097] Line chart updated from cache');
    }
  } catch (error) {
    console.error('[ENERGY] Error updating line chart:', error);
  } finally {
    // RFC-0097: Hide loading overlay
    hideChartLoading();

    isUpdatingLineChart = false;

    // Process any pending update request
    if (pendingLineChartUpdate) {
      const pendingCustomerId = pendingLineChartUpdate;
      pendingLineChartUpdate = null;
      console.log('[ENERGY] [RFC-0097] Processing queued updateLineChart...');
      await updateLineChart(pendingCustomerId);
    }
  }
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
 * Atualiza o gráfico de pizza com distribuição por tipo de equipamento ou por shopping
 * @param {string} mode - Mode to display: "groups", "elevators", "escalators", "hvac", "others", "stores"
 */
async function updatePieChart(mode = 'groups') {
  try {
    console.log(`[ENERGY] Calculating distribution for mode: ${mode}...`);

    // Wait for orchestrator to be ready
    let attempts = 0;
    const maxAttempts = 20;

    const waitForOrchestrator = () => {
      return new Promise((resolve) => {
        const intervalId = setInterval(() => {
          attempts++;
          const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;

          if (orchestrator && typeof orchestrator.getEnergyCache === 'function') {
            clearInterval(intervalId);
            resolve(true);
          } else if (attempts >= maxAttempts) {
            clearInterval(intervalId);
            resolve(false);
          }
        }, 200);
      });
    };

    const ready = await waitForOrchestrator();

    if (!ready) {
      console.warn('[ENERGY] Orchestrator not ready, using mock distribution');
      return;
    }

    // Use new distribution calculation based on mode
    const distribution = await calculateDistributionByMode(mode);

    if (!distribution || !pieChartInstance) {
      console.error('[ENERGY] Unable to calculate distribution or chart not found');
      return;
    }

    // Filter out zero values and prepare data
    const labels = [];
    const data = [];

    // Calculate total for percentage calculation
    const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);

    // Color palette for equipment groups
    const groupColors = {
      Elevadores: '#3b82f6',
      'Escadas Rolantes': '#8b5cf6',
      Climatização: '#f59e0b',
      'Outros Equipamentos': '#ef4444',
      Lojas: '#10b981',
    };

    // Color palette for shoppings (rotating colors)
    const shoppingColors = [
      '#3b82f6',
      '#8b5cf6',
      '#f59e0b',
      '#ef4444',
      '#10b981',
      '#06b6d4',
      '#ec4899',
      '#14b8a6',
      '#f97316',
      '#a855f7',
    ];

    const backgroundColors = [];
    let colorIndex = 0;

    Object.entries(distribution).forEach(([type, value]) => {
      if (value > 0) {
        const formatted = MyIOLibrary.formatEnergy(value);
        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
        labels.push(`${type} (${formatted} - ${percentage}%)`);
        data.push(value);

        // Use group colors for "groups" mode, shopping colors for other modes
        if (mode === 'groups') {
          backgroundColors.push(groupColors[type] || '#94a3b8');
        } else {
          backgroundColors.push(shoppingColors[colorIndex % shoppingColors.length]);
          colorIndex++;
        }
      }
    });

    // Update chart
    pieChartInstance.data.labels = labels;
    pieChartInstance.data.datasets[0].data = data;
    pieChartInstance.data.datasets[0].backgroundColor = backgroundColors;
    pieChartInstance.data.datasets[0].label = 'Consumo'; // Bar chart label
    pieChartInstance.update();

    console.log(`[ENERGY] Bar chart updated with ${mode} distribution`);
  } catch (error) {
    console.error('[ENERGY] Error updating pie chart:', error);
  }
}

/**
 * Configura o seletor de modo de distribuição
 */
function setupDistributionModeSelector() {
  const distributionModeSelect = document.getElementById('distributionMode');

  if (!distributionModeSelect) {
    console.warn('[ENERGY] Distribution mode selector not found');
    return;
  }

  console.log('[ENERGY] Setting up distribution mode selector');

  distributionModeSelect.addEventListener('change', async (e) => {
    const mode = e.target.value;
    console.log(`[ENERGY] Distribution mode changed to: ${mode}`);

    // Update pie chart with new mode
    await updatePieChart(mode);
  });
}

/**
 * RFC-0073 Problem 1: Configura o botão de configuração do gráfico de 7 dias
 */
function setupChartConfigButton() {
  const configBtn = document.getElementById('configureChartBtn');

  if (!configBtn) {
    console.warn('[ENERGY] [RFC-0073] Chart configuration button not found');
    return;
  }

  console.log('[ENERGY] [RFC-0073] Setting up chart configuration button');

  configBtn.addEventListener('click', () => {
    console.log('[ENERGY] [RFC-0073] Opening chart configuration modal');
    openChartConfigModal();
  });
}

/**
 * RFC-0097: Configura os handlers das TABs do gráfico
 * - TABs de vizMode: Consolidado / Por Shopping
 * - TABs de chartType: Linhas / Barras
 */
function setupChartTabHandlers() {
  // TABs vizMode (Consolidado/Por Shopping)
  const vizTabs = document.querySelectorAll('.viz-mode-tabs .chart-tab');
  vizTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      vizTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      chartConfig.vizMode = tab.dataset.viz;
      console.log('[ENERGY] [RFC-0097] vizMode changed to:', chartConfig.vizMode);
      // Re-renderiza sem recarregar dados
      rerenderLineChart();
    });
  });

  // TABs chartType (Linhas/Barras)
  const typeTabs = document.querySelectorAll('.chart-type-tabs .chart-tab');
  typeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      typeTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      chartConfig.chartType = tab.dataset.type;
      console.log('[ENERGY] [RFC-0097] chartType changed to:', chartConfig.chartType);
      // Re-renderiza sem recarregar dados
      rerenderLineChart();
    });
  });

  console.log('[ENERGY] [RFC-0097] Chart tab handlers setup complete');
}

/**
 * RFC-0097: Re-renderiza o gráfico com dados em cache
 * Usado quando o usuário troca vizMode ou chartType via TABs
 */
function rerenderLineChart() {
  if (!cachedChartData) {
    console.warn('[ENERGY] [RFC-0097] No cached data to re-render');
    return;
  }

  console.log('[ENERGY] [RFC-0097] Re-rendering chart from cache', {
    vizMode: chartConfig.vizMode,
    chartType: chartConfig.chartType,
  });

  updateLineChartFromCache(cachedChartData);
}

/**
 * RFC-0097: Atualiza o gráfico de linhas/barras a partir de dados em cache
 * @param {object} data - Dados em cache do gráfico
 */
function updateLineChartFromCache(data) {
  const ctx = document.getElementById('lineChart');
  if (!ctx) return;

  // Destroy existing chart instance
  if (lineChartInstance) {
    lineChartInstance.destroy();
    lineChartInstance = null;
  }

  const { labels, dailyTotals, shoppingData, shoppingNames } = data;

  // RFC-0097: Calculate max Y value to fix axis and prevent animation loop
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
  // Add 10% padding and round to nice number
  const yAxisMax = maxValue > 0 ? Math.ceil(maxValue * 1.1 / 1000) * 1000 : 10000;

  let datasets = [];

  if (chartConfig.vizMode === 'separate' && shoppingData && Object.keys(shoppingData).length > 1) {
    // Separate lines per shopping
    const colors = ['#6c2fbf', '#2563eb', '#16a34a', '#ea580c', '#dc2626', '#8b5cf6', '#0891b2', '#65a30d'];

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
        pointRadius: chartConfig.chartType === 'line' ? 4 : 0,
        pointBackgroundColor: color,
        borderWidth: 2,
      });
      colorIndex++;
    }
  } else {
    // Single consolidated line
    datasets.push({
      label: 'Consumo Total (kWh)',
      data: dailyTotals,
      borderColor: '#6c2fbf',
      backgroundColor: chartConfig.chartType === 'bar' ? '#6c2fbf80' : 'rgba(108, 47, 191, 0.1)',
      fill: chartConfig.chartType === 'line',
      tension: 0.3,
      pointRadius: chartConfig.chartType === 'line' ? 4 : 0,
      pointBackgroundColor: '#6c2fbf',
      borderWidth: 2,
    });
  }

  lineChartInstance = new Chart(ctx, {
    type: chartConfig.chartType,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // RFC-0097: Completely disable all animations to prevent requestAnimationFrame loop
      animation: false,
      animations: {
        colors: false,
        x: false,
        y: false,
      },
      transitions: {
        active: { animation: { duration: 0 } },
        resize: { animation: { duration: 0 } },
        show: { animation: { duration: 0 } },
        hide: { animation: { duration: 0 } },
      },
      plugins: {
        legend: {
          display: chartConfig.vizMode === 'separate',
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y || 0;
              if (value >= 1000) {
                return `${context.dataset.label}: ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MWh`;
              }
              return `${context.dataset.label}: ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kWh`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: yAxisMax, // RFC-0097: Fix max to prevent animation loop
          title: {
            display: true,
            text: yAxisMax >= 1000 ? 'Consumo (MWh)' : 'Consumo (kWh)',
          },
          ticks: {
            callback: function (value) {
              if (yAxisMax >= 1000) {
                return (value / 1000).toFixed(1);
              }
              return value.toFixed(0);
            },
          },
        },
        x: {
          title: {
            display: true,
            text: chartConfig.granularity === '1h' ? 'Hora' : 'Data',
          },
        },
      },
    },
  });

  console.log('[ENERGY] [RFC-0097] Chart created with fixed Y-axis max:', yAxisMax, yAxisMax >= 1000 ? 'MWh' : 'kWh');
}

/**
 * RFC-0073 Problem 2: Abre a modal de configuração avançada do gráfico
 */
function openChartConfigModal() {
  console.log('[ENERGY] [RFC-0073] Opening chart configuration modal');

  let globalContainer = document.getElementById('energyChartConfigModalGlobal');

  if (!globalContainer) {
    // Create modal structure
    globalContainer = document.createElement('div');
    globalContainer.id = 'energyChartConfigModalGlobal';

    // RFC-0073: Inject styles inline (following EQUIPMENTS pattern)
    globalContainer.innerHTML = `
      <style>
        /* RFC-0073: ENERGY Chart Config Modal Styles */
        #energyChartConfigModalGlobal .chart-config-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease-in;
        }

        #energyChartConfigModalGlobal .chart-config-modal.hidden {
          display: none;
        }

        #energyChartConfigModalGlobal .modal-card {
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

        #energyChartConfigModalGlobal .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #e6eef5;
        }

        #energyChartConfigModalGlobal .modal-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #1c2743;
        }

        #energyChartConfigModalGlobal .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        #energyChartConfigModalGlobal .modal-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 16px 24px;
          border-top: 1px solid #e6eef5;
        }

        #energyChartConfigModalGlobal .config-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        #energyChartConfigModalGlobal .section-label {
          font-size: 14px;
          font-weight: 600;
          color: #1c2743;
          margin-bottom: 4px;
        }

        #energyChartConfigModalGlobal .period-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }

        #energyChartConfigModalGlobal .period-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border: 2px solid #e6eef5;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          background: #fff;
        }

        #energyChartConfigModalGlobal .period-option:hover {
          border-color: #2563eb;
          background: #f7fbff;
        }

        #energyChartConfigModalGlobal .period-option input[type="radio"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        #energyChartConfigModalGlobal .period-option.selected {
          border-color: #2563eb;
          background: #eff6ff;
        }

        /* RFC-0097: DateRangePicker input styles */
        #energyChartConfigModalGlobal .date-range-container {
          margin-top: 12px;
        }

        #energyChartConfigModalGlobal .date-range-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e6eef5;
          border-radius: 10px;
          font-size: 14px;
          color: #1c2743;
          background: #fff;
          cursor: pointer;
          outline: none;
          transition: all 0.2s;
        }

        #energyChartConfigModalGlobal .date-range-input:hover {
          border-color: #2563eb;
        }

        #energyChartConfigModalGlobal .date-range-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        #energyChartConfigModalGlobal .checkbox-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border: 1px solid #e6eef5;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        #energyChartConfigModalGlobal .checkbox-option:hover {
          background: #f8f9fa;
          border-color: #2563eb;
        }

        #energyChartConfigModalGlobal .checkbox-option input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        #energyChartConfigModalGlobal .checkbox-option label {
          flex: 1;
          cursor: pointer;
          font-size: 14px;
          color: #1c2743;
        }

        #energyChartConfigModalGlobal .viz-mode-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        #energyChartConfigModalGlobal .btn {
          padding: 10px 20px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: #fff;
        }

        #energyChartConfigModalGlobal .btn:hover {
          background: #f8f9fa;
        }

        #energyChartConfigModalGlobal .btn.primary {
          background: #2563eb;
          color: #fff;
          border-color: #2563eb;
        }

        #energyChartConfigModalGlobal .btn.primary:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
        }

        #energyChartConfigModalGlobal .close-btn {
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

        #energyChartConfigModalGlobal .close-btn:hover {
          background: #f0f0f0;
        }

        #energyChartConfigModalGlobal .close-btn svg {
          width: 20px;
          height: 20px;
          fill: #1c2743;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        body.modal-open {
          overflow: hidden !important;
        }
      </style>

      <div id="chartConfigModal" class="chart-config-modal hidden">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Configuração do Gráfico</h3>
            <button class="close-btn" id="closeChartConfig" title="Fechar">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>

          <div class="modal-body">
            <!-- RFC-0097: Period Selection -->
            <div class="config-section">
              <div class="section-label">Período</div>
              <div class="period-grid">
                <label class="period-option">
                  <input type="radio" name="chartPeriod" value="7" checked>
                  <span>7 dias</span>
                </label>
                <label class="period-option">
                  <input type="radio" name="chartPeriod" value="14">
                  <span>14 dias</span>
                </label>
                <label class="period-option">
                  <input type="radio" name="chartPeriod" value="30">
                  <span>30 dias</span>
                </label>
                <label class="period-option">
                  <input type="radio" name="chartPeriod" value="custom">
                  <span>Personalizado</span>
                </label>
              </div>

              <!-- RFC-0097: DateRangePicker container (hidden by default) -->
              <div id="chartDateRangeContainer" class="date-range-container" style="display: none; margin-top: 12px;">
                <input type="text" id="chartDateRangeInput" class="date-range-input" placeholder="Selecione o período" readonly>
              </div>
            </div>

            <!-- RFC-0097: Granularity Selection -->
            <div class="config-section">
              <div class="section-label">Granularidade</div>
              <div class="period-grid">
                <label class="period-option">
                  <input type="radio" name="chartGranularity" value="1d" checked>
                  <span>Por Dia</span>
                </label>
                <label class="period-option">
                  <input type="radio" name="chartGranularity" value="1h">
                  <span>Por Hora</span>
                </label>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn" id="resetChartConfig">Restaurar Padrão</button>
            <button class="btn primary" id="applyChartConfig">Aplicar</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(globalContainer);
    setupChartConfigModalHandlers();
  }

  const modal = globalContainer.querySelector('#chartConfigModal');
  if (!modal) return;

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  // Setup ESC key handler
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeChartConfigModal();
    }
  };
  document.addEventListener('keydown', escHandler);
  modal._escHandler = escHandler;
}

/**
 * RFC-0097: Configura os handlers da modal de configuração
 */
function setupChartConfigModalHandlers() {
  const modal = document.getElementById('chartConfigModal');
  if (!modal) return;

  // Close button
  const closeBtn = document.getElementById('closeChartConfig');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeChartConfigModal);
  }

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeChartConfigModal();
    }
  });

  // RFC-0097: Period selection handlers
  const periodRadios = modal.querySelectorAll('input[name="chartPeriod"]');
  const dateRangeContainer = document.getElementById('chartDateRangeContainer');

  periodRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      // Update selected styling
      modal.querySelectorAll('.period-option').forEach((opt) => opt.classList.remove('selected'));
      e.target.closest('.period-option').classList.add('selected');

      // Show/hide DateRangePicker container
      if (e.target.value === 'custom') {
        dateRangeContainer.style.display = 'block';
        initChartDateRangePicker();
      } else {
        dateRangeContainer.style.display = 'none';
      }
    });
  });

  // RFC-0097: Granularity selection handlers
  const granularityRadios = modal.querySelectorAll('input[name="chartGranularity"]');
  granularityRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      modal.querySelectorAll('.period-option').forEach((opt) => {
        if (opt.querySelector('input[name="chartGranularity"]')) {
          opt.classList.remove('selected');
        }
      });
      e.target.closest('.period-option').classList.add('selected');
    });
  });

  // Apply button
  const applyBtn = document.getElementById('applyChartConfig');
  if (applyBtn) {
    applyBtn.addEventListener('click', applyChartConfiguration);
  }

  // Reset button
  const resetBtn = document.getElementById('resetChartConfig');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetChartConfiguration);
  }
}

/**
 * RFC-0097: Inicializa o DateRangePicker para período customizado
 */
let chartDatePickerInstance = null;
let chartCustomDates = { start: null, end: null };

function initChartDateRangePicker() {
  const inputElement = document.getElementById('chartDateRangeInput');
  if (!inputElement) return;

  // Se já inicializou, não faz nada
  if (chartDatePickerInstance) return;

  // Datas padrão: últimos 7 dias
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 7);

  const startISO = startDate.toISOString();
  const endISO = now.toISOString();

  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createDateRangePicker) {
    MyIOLibrary.createDateRangePicker(inputElement, {
      presetStart: startISO,
      presetEnd: endISO,
      maxRangeDays: 90,
      onApply: (result) => {
        chartCustomDates.start = result.startISO;
        chartCustomDates.end = result.endISO;
        console.log('[ENERGY] [RFC-0097] Custom date range selected:', chartCustomDates);
      },
    })
      .then((picker) => {
        chartDatePickerInstance = picker;
        console.log('[ENERGY] [RFC-0097] DateRangePicker initialized');
      })
      .catch((err) => {
        console.error('[ENERGY] [RFC-0097] Error initializing DateRangePicker:', err);
      });
  } else {
    console.warn('[ENERGY] [RFC-0097] MyIOLibrary.createDateRangePicker not available');
  }
}

/**
 * RFC-0073 Problem 2: Fecha a modal de configuração
 */
function closeChartConfigModal() {
  const globalContainer = document.getElementById('energyChartConfigModalGlobal');
  if (!globalContainer) return;

  const modal = globalContainer.querySelector('#chartConfigModal');
  if (!modal) return;

  console.log('[ENERGY] [RFC-0073] Closing chart config modal');

  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');

  // Remove ESC handler
  if (modal._escHandler) {
    document.removeEventListener('keydown', modal._escHandler);
    modal._escHandler = null;
  }
}

/**
 * RFC-0097: Aplica a configuração do gráfico
 */
async function applyChartConfiguration() {
  console.log('[ENERGY] [RFC-0097] Applying chart configuration');

  const modal = document.getElementById('chartConfigModal');
  if (!modal) return;

  // Get selected period
  const periodRadio = modal.querySelector('input[name="chartPeriod"]:checked');
  const period = periodRadio ? periodRadio.value : '7';

  // RFC-0097: Get selected granularity
  const granularityRadio = modal.querySelector('input[name="chartGranularity"]:checked');
  const granularity = granularityRadio ? granularityRadio.value : '1d';

  // Get dates
  let startDate, endDate;
  if (period === 'custom') {
    // Use dates from DateRangePicker
    if (!chartCustomDates.start || !chartCustomDates.end) {
      window.alert('Por favor, selecione o período no calendário');
      return;
    }
    startDate = chartCustomDates.start;
    endDate = chartCustomDates.end;
  } else {
    // Calculate dates based on period
    const now = new Date();
    endDate = now.toISOString();
    const startDateObj = new Date(now);
    startDateObj.setDate(now.getDate() - parseInt(period));
    startDate = startDateObj.toISOString();
  }

  // RFC-0097: Save configuration to global state
  chartConfig.period = period === 'custom' ? 0 : parseInt(period);
  chartConfig.startDate = startDate;
  chartConfig.endDate = endDate;
  chartConfig.granularity = granularity;
  // vizMode and chartType are controlled by TABs, not modal

  console.log('[ENERGY] [RFC-0097] Chart config saved:', chartConfig);

  // Update chart title
  updateChartTitle();

  // Close the modal
  closeChartConfigModal();

  // Clear cache to force re-fetch with new config
  cachedChartData = null;

  // Update the chart with new configuration
  const customerId = self.ctx.settings?.customerId;
  if (customerId) {
    await updateLineChart(customerId);
  }
}

/**
 * RFC-0097: Atualiza o título do gráfico baseado na configuração
 */
function updateChartTitle() {
  const titleEl = document.getElementById('lineChartTitle');
  if (!titleEl) return;

  let title = 'Consumo';
  if (chartConfig.period > 0) {
    title = `Consumo dos últimos ${chartConfig.period} dias`;
  } else if (chartConfig.startDate && chartConfig.endDate) {
    const start = new Date(chartConfig.startDate);
    const end = new Date(chartConfig.endDate);
    const formatDate = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    title = `Consumo de ${formatDate(start)} a ${formatDate(end)}`;
  }

  if (chartConfig.granularity === '1h') {
    title += ' (por hora)';
  }

  titleEl.textContent = title;
}

/**
 * RFC-0097: Restaura configuração padrão
 */
function resetChartConfiguration() {
  console.log('[ENERGY] [RFC-0097] Resetting chart configuration to defaults');

  const modal = document.getElementById('chartConfigModal');
  if (!modal) return;

  // Reset period to 7 days
  const period7Radio = modal.querySelector('input[name="chartPeriod"][value="7"]');
  if (period7Radio) {
    period7Radio.checked = true;
    period7Radio.dispatchEvent(new Event('change'));
  }

  // RFC-0097: Reset granularity to 1d
  const granularity1dRadio = modal.querySelector('input[name="chartGranularity"][value="1d"]');
  if (granularity1dRadio) {
    granularity1dRadio.checked = true;
  }

  // Hide date range container
  const dateRangeContainer = document.getElementById('chartDateRangeContainer');
  if (dateRangeContainer) {
    dateRangeContainer.style.display = 'none';
  }

  // Clear custom dates
  chartCustomDates = { start: null, end: null };

  // RFC-0097: Reset TABs to defaults
  const vizTabs = document.querySelectorAll('.viz-mode-tabs .chart-tab');
  vizTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.viz === 'total');
  });

  const typeTabs = document.querySelectorAll('.chart-type-tabs .chart-tab');
  typeTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.type === 'line');
  });

  // Reset chartConfig
  chartConfig.vizMode = 'total';
  chartConfig.chartType = 'line';
  chartConfig.granularity = '1d';
}

/**
 * Inicializa gráficos com dados mock (fallback)
 */
function initializeMockCharts() {
  const lineCtx = document.getElementById('lineChart').getContext('2d');
  lineChartInstance = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: ['01/01', '02/01', '03/01', '04/01', '05/01', '06/01', '07/01'],
      datasets: [
        {
          label: 'Consumo (kWh)',
          data: [1200, 1150, 1300, 1250, 1400, 1350, 1300],
          borderColor: '#2563eb',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: true } },
    },
  });

  const pieCtx = document.getElementById('pieChart').getContext('2d');
  pieChartInstance = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: ['Chiller', 'Fancoil', 'AR', 'Bombas', 'Lojas', 'Elevadores', 'Outros'],
      datasets: [
        {
          data: [35, 20, 15, 10, 12, 5, 3],
          backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#a3e635', '#94a3b8'],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { position: 'right', labels: { usePointStyle: true } },
      },
      cutout: '70%',
    },
  });
}

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
  console.log('[ENERGY] [RFC-0097] Event listeners cleaned up');
}

// ============================================
// WIDGET ENERGY - FUNÇÃO DE INICIALIZAÇÃO COMPLETA
// ============================================
self.onInit = async function () {
  // RFC-0097: Prevent multiple initializations
  if (energyWidgetInitialized) {
    console.log('[ENERGY] [RFC-0097] Widget already initialized, skipping...');
    return;
  }

  console.log('[ENERGY] Initializing energy charts and consumption cards...');

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
    console.log('[ENERGY] Resumo de energia recebido do orquestrador!', ev.detail);
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
    console.log('[ENERGY] [RFC-0073] Shopping filter applied, updating charts...', ev.detail);

    // Invalidate cache when filter changes
    cachedChartData = null;

    // Also update pie chart to reflect filtered data
    const currentMode = document.getElementById('distributionMode')?.value || 'groups';
    await updatePieChart(currentMode);

    // RFC-0073 Problem 1: Update 7-day line chart with filtered data
    const customerId = self.ctx.settings?.customerId;
    if (customerId) {
      await updateLineChart(customerId);
    }
  };

  window.addEventListener('myio:filter-applied', registeredHandlers.handleFilterApplied);

  if (window.parent !== window) {
    window.parent.addEventListener('myio:filter-applied', registeredHandlers.handleFilterApplied);
  }

  // RFC-0076: Listen to equipment metadata enrichment from EQUIPMENTS widget
  // This forces chart updates when EQUIPMENTS finishes enriching the cache with deviceType/deviceProfile
  registeredHandlers.handleEquipmentMetadataEnriched = async (ev) => {
    console.log('[ENERGY] [RFC-0076] 🔧 Equipment metadata enriched! Forcing chart update...', ev.detail);

    // Force immediate update of pie chart to pick up elevator classifications
    const currentMode = document.getElementById('distributionMode')?.value || 'groups';
    await updatePieChart(currentMode);

    console.log('[ENERGY] [RFC-0076] ✅ Charts updated with enriched metadata');
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
        console.log(`[ENERGY] Orquestrador encontrado após ${attempts} tentativas. Solicitando resumo.`);

        // Chama a função do orquestrador encontrado
        orchestrator.requestSummary();
      } else if (attempts >= maxAttempts) {
        // FALHA: Timeout
        clearInterval(intervalId); // Para de vigiar
        console.error(
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
    console.log('[ENERGY] Evento de limpeza de cache recebido.', ev.detail);

    // Reinicializa os cards para o estado de loading
    initializeTotalConsumptionCard();
    //initializePeakDemandCard();
  });
};

// ============================================
// WIDGET ENERGY - CLEANUP ON DESTROY
// ============================================

self.onDestroy = function () {
  console.log('[ENERGY] [RFC-0073] Widget destroying, cleaning up modals');

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
    console.log('[ENERGY] [RFC-0073] Global modal container removed on destroy');
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
    console.log('[ENERGY] [RFC-0097] Fullscreen container removed on destroy');
  }

  // RFC-0097: Cleanup event listeners and reset initialization flag
  cleanupEventListeners();
  energyWidgetInitialized = false;
  cachedChartData = null;
  isUpdatingLineChart = false;
  pendingLineChartUpdate = null;

  console.log('[ENERGY] [RFC-0097] Widget destroyed, state reset');
};
