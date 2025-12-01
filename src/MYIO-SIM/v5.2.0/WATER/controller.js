// ============================================
// MYIO-SIM 1.0.0 - WATER Widget Controller
// RFC-0087: Water Consumption Dashboard
// Based on ENERGY widget structure
// ============================================

// ============================================
// DEBUG FLAGS
// ============================================

const MOCK_DEBUG_WATER_CONSUMPTION = true;

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
// UI UPDATE FUNCTIONS
// ============================================

/**
 * Renderiza a UI do card de consumo de LOJAS
 */
function renderStoresConsumptionUI(data, valueEl, trendEl, infoEl) {
  if (!data) return;

  const totalGeral = data.totalGeral || 0;
  const storesTotal = data.storesTotal || 0;
  const storesPercentage = totalGeral > 0 ? (storesTotal / totalGeral) * 100 : 0;

  if (valueEl) {
    valueEl.textContent = formatWaterVolume(storesTotal);
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
    infoEl.textContent = `${formatWaterVolume(storesTotal)} lojas | ${formatWaterVolume(commonAreaTotal)} área comum`;
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
  const storesValueEl = document.getElementById('total-consumption-stores-value');
  const storesTrendEl = document.getElementById('total-consumption-stores-trend');
  if (storesValueEl) storesValueEl.innerHTML = loadingSpinner;
  if (storesTrendEl) {
    storesTrendEl.textContent = 'Aguardando dados...';
    storesTrendEl.className = 'trend neutral';
  }

  // Common Area card
  const commonAreaValueEl = document.getElementById('total-consumption-common-area-value');
  const commonAreaTrendEl = document.getElementById('total-consumption-common-area-trend');
  if (commonAreaValueEl) commonAreaValueEl.innerHTML = loadingSpinner;
  if (commonAreaTrendEl) {
    commonAreaTrendEl.textContent = 'Aguardando dados...';
    commonAreaTrendEl.className = 'trend neutral';
  }

  // Total card
  const totalValueEl = document.getElementById('total-consumption-value');
  const totalTrendEl = document.getElementById('total-consumption-trend');
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
    document.getElementById('total-consumption-stores-value'),
    document.getElementById('total-consumption-stores-trend'),
    document.getElementById('total-consumption-stores-info')
  );

  // Common Area
  renderCommonAreaConsumptionUI(
    data,
    document.getElementById('total-consumption-common-area-value'),
    document.getElementById('total-consumption-common-area-trend'),
    document.getElementById('total-consumption-common-area-info')
  );

  // Total
  renderTotalConsumptionUI(
    data,
    document.getElementById('total-consumption-value'),
    document.getElementById('total-consumption-trend'),
    document.getElementById('total-consumption-info')
  );
}

// ============================================
// CHART FUNCTIONS
// ============================================

let lineChartInstance = null;
let pieChartInstance = null;

/**
 * Busca o consumo dos últimos 7 dias (mock)
 */
async function fetch7DaysConsumption() {
  const results = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() - i);
    dayDate.setHours(0, 0, 0, 0);

    const dayOfWeek = dayDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Mock consumption pattern
    const baseConsumption = 150 + Math.random() * 50; // 150-200 m³
    const weekendFactor = isWeekend ? 0.7 : 1.0;
    const consumption = baseConsumption * weekendFactor;

    results.push({
      date: dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      consumption: consumption,
    });
  }

  console.log('[WATER] 7 days consumption data:', results);
  return results;
}

/**
 * Inicializa o gráfico de linha (7 dias)
 */
async function initializeLineChart() {
  const canvas = document.getElementById('lineChart');
  if (!canvas) {
    console.warn('[WATER] lineChart canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Destroy existing instance
  if (lineChartInstance) {
    lineChartInstance.destroy();
  }

  // Fetch data
  const data = await fetch7DaysConsumption();

  lineChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map((d) => d.date),
      datasets: [
        {
          label: 'Consumo (m³)',
          data: data.map((d) => d.consumption),
          borderColor: '#0288d1',
          backgroundColor: 'rgba(2, 136, 209, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: '#0288d1',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.parsed.y.toFixed(1)} m³`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'm³',
          },
        },
      },
    },
  });

  console.log('[WATER] Line chart initialized');
}

/**
 * Inicializa o gráfico de pizza (distribuição)
 */
function initializePieChart(data) {
  const canvas = document.getElementById('pieChart');
  if (!canvas) {
    console.warn('[WATER] pieChart canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Destroy existing instance
  if (pieChartInstance) {
    pieChartInstance.destroy();
  }

  const storesTotal = data?.storesTotal || 60;
  const commonAreaTotal = data?.commonAreaTotal || 40;

  pieChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Lojas', 'Área Comum'],
      datasets: [
        {
          data: [storesTotal, commonAreaTotal],
          backgroundColor: ['#06b6d4', '#0288d1'],
          borderColor: ['#fff', '#fff'],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return `${context.label}: ${context.parsed.toFixed(1)} m³ (${percentage}%)`;
            },
          },
        },
      },
    },
  });

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
  const fontMinus = document.getElementById('fontMinus');
  const fontPlus = document.getElementById('fontPlus');
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
 */
function handleWaterDataReady(event) {
  const { source, data } = event.detail || {};
  console.log('[WATER] Received water data from:', source, data);

  // Atualiza cache local
  const cached = getCachedTotalConsumption() || { storesTotal: 0, commonAreaTotal: 0, totalGeral: 0 };

  if (source === 'WATER_COMMON_AREA' && data) {
    cached.commonAreaTotal = data.totalConsumption || 0;
  } else if (source === 'WATER_STORES' && data) {
    cached.storesTotal = data.totalConsumption || 0;
  }

  cached.totalGeral = cached.storesTotal + cached.commonAreaTotal;

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
// INITIALIZATION
// ============================================

function setupEventListeners() {
  // Listen for water data from MAIN
  window.addEventListener('myio:water-data-ready', handleWaterDataReady);

  // Listen for date/filter updates
  window.addEventListener('myio:update-date', handleDateUpdate);

  // Distribution mode selector
  const distributionSelect = document.getElementById('distributionMode');
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

  // Initialize cards with loading state
  initializeCards();

  // Setup zoom controls
  setupZoomControls();

  // Setup event listeners
  setupEventListeners();

  // Initialize charts
  setTimeout(() => {
    initializeLineChart();

    // Mock initial data for pie chart
    const mockData = {
      storesTotal: 120,
      commonAreaTotal: 80,
      totalGeral: 200,
    };

    initializePieChart(mockData);
    updateAllCards(mockData);
    cacheTotalConsumption(mockData.storesTotal, mockData.commonAreaTotal, mockData.totalGeral);
  }, 500);

  // Request data from MAIN
  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent('myio:request-water-data', {
        detail: { requestor: 'WATER' },
      })
    );
  }, 1000);
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
