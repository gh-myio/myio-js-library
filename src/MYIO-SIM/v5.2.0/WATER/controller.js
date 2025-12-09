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
let pieChartInstance = null; // Legacy reference (kept for backwards compatibility)

// RFC-0098: Consumption 7 Days Chart instance (new standardized component)
let consumptionChartInstance = null;

// RFC-0102: Distribution Chart instance (new standardized component)
let distributionChartInstance = null;

// RFC-0098: Cache TTL for chart data (5 minutes)
const CHART_CACHE_TTL = 5 * 60 * 1000;

/**
 * RFC-0098: Get shopping name from Orchestrator or fallback
 */
function getShoppingNameForFilter(customerId) {
  const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
  if (orchestrator?.getCustomers) {
    const customers = orchestrator.getCustomers();
    const customer = customers.find((c) => c.id?.id === customerId || c.customerId === customerId);
    if (customer) {
      return customer.name || customer.title || customerId.slice(0, 8);
    }
  }
  return customerId.slice(0, 8);
}

/**
 * RFC-0098: Get selected shopping IDs (ingestionIds) from filter
 * Same pattern as ENERGY - uses window.custumersSelected from MENU filter
 */
function getSelectedShoppingIds() {
  // Check if there are selected customers from MENU filter
  if (
    window.custumersSelected &&
    Array.isArray(window.custumersSelected) &&
    window.custumersSelected.length > 0
  ) {
    // Use ingestionId if available, fallback to value (which is also ingestionId)
    const selectedIds = window.custumersSelected.map((c) => c.ingestionId || c.value).filter(Boolean);

    if (selectedIds.length > 0) {
      console.log('[WATER] [RFC-0098] Using filtered shopping ingestionIds:', selectedIds);
      return selectedIds;
    }
  }

  // Fallback: return empty array (will use widget's customerId)
  console.log('[WATER] [RFC-0098] No shopping filter active, using widget customerId');
  return [];
}

/**
 * RFC-0098: Fetch water consumption for a period, grouped by day
 * @param {string} customerId - Customer ID
 * @param {number} startTs - Start timestamp
 * @param {number} endTs - End timestamp
 * @param {Array} dayBoundaries - Array of { label, startTs, endTs }
 * @returns {Promise<number[]>} - Array of daily totals
 */
async function fetchWaterPeriodConsumptionByDay(customerId, startTs, endTs, dayBoundaries) {
  try {
    const granularity = chartConfig.granularity || '1d';
    const result = await window.MyIOUtils.fetchWaterDayConsumption(customerId, startTs, endTs, granularity);

    const dailyTotals = new Array(dayBoundaries.length).fill(0);
    const items = Array.isArray(result) ? result : result?.devices || result?.data || [];

    if (items.length > 0) {
      console.log(`[WATER] [RFC-0098] API returned ${items.length} items for ${customerId.slice(0, 8)}`);
    }

    items.forEach((item) => {
      if (Array.isArray(item.consumption)) {
        item.consumption.forEach((entry) => {
          const timestamp = entry.timestamp || entry.ts;
          const value = Number(entry.value) || 0;

          if (timestamp && value > 0) {
            const entryTs = new Date(timestamp).getTime();
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

    console.log(`[WATER] [RFC-0098] Period consumption for ${customerId.slice(0, 8)}:`, dailyTotals.map((v) => v.toFixed(2)));
    return dailyTotals;
  } catch (error) {
    console.error('[WATER] Error fetching period consumption:', error);
    return new Array(dayBoundaries.length).fill(0);
  }
}

/**
 * RFC-0098: Fetch water consumption for N days with real API data
 * Returns structured data with per-shopping breakdown for vizMode support
 */
async function fetch7DaysConsumption(period = 7, fallbackCustomerId = null) {
  // Get filtered shopping IDs or use fallback customerId
  const selectedShoppingIds = getSelectedShoppingIds();

  // Use fallback from MAIN if no filter active
  const fallbackId = fallbackCustomerId || window.myioHoldingCustomerId;
  const customerIds = selectedShoppingIds.length > 0 ? selectedShoppingIds : (fallbackId ? [fallbackId] : []);

  if (!customerIds || customerIds.length === 0) {
    console.warn('[WATER] [RFC-0098] No customer IDs available');
    return { labels: [], dailyTotals: [], shoppingData: {}, shoppingNames: {} };
  }

  // Check cache
  if (cachedChartData && cachedChartData.fetchTimestamp) {
    const cacheAge = Date.now() - cachedChartData.fetchTimestamp;
    const sameCustomers = cachedChartData.customerIds?.length === customerIds.length &&
      cachedChartData.customerIds?.every((id) => customerIds.includes(id));

    if (cacheAge < CHART_CACHE_TTL && sameCustomers) {
      console.log('[WATER] [RFC-0098] Using cached data (age:', Math.round(cacheAge / 1000), 's)');
      return cachedChartData;
    }
  }

  console.log('[WATER] [RFC-0098] Fetching', period, 'days for customers:', customerIds);

  const shoppingData = {};
  const shoppingNames = {};

  customerIds.forEach((cid) => {
    shoppingData[cid] = [];
    shoppingNames[cid] = getShoppingNameForFilter(cid);
  });

  // Calculate period boundaries
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(now.getDate() - (period - 1));
  periodStart.setHours(0, 0, 0, 0);
  const startTs = periodStart.getTime();

  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);
  const endTs = periodEnd.getTime();

  // Build day boundaries
  const dayBoundaries = [];
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

  // Fetch data for all customers in parallel
  console.log('[WATER] [RFC-0098] Executing', customerIds.length, 'API calls (one per shopping)...');
  const fetchPromises = customerIds.map((customerId) =>
    fetchWaterPeriodConsumptionByDay(customerId, startTs, endTs, dayBoundaries)
  );

  const results = await Promise.all(fetchPromises);

  results.forEach((dailyValues, idx) => {
    const customerId = customerIds[idx];
    shoppingData[customerId] = dailyValues;
  });

  // Calculate daily totals
  const dailyTotals = [];
  for (let dayIdx = 0; dayIdx < period; dayIdx++) {
    let dayTotal = 0;
    for (const customerId of customerIds) {
      dayTotal += shoppingData[customerId][dayIdx] || 0;
    }
    dailyTotals.push(dayTotal);
  }

  const result = {
    labels,
    dailyTotals,
    shoppingData,
    shoppingNames,
    customerIds,
    fetchTimestamp: Date.now(),
  };

  // Update cache
  cachedChartData = result;

  console.log('[WATER] [RFC-0098] Data fetched:', {
    days: period,
    shoppings: customerIds.length,
    totalPoints: labels.length,
  });

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
  // RFC-0098: Use standardized widget component if available (preferred)
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createConsumptionChartWidget) {
    console.log('[WATER] [RFC-0098] Using createConsumptionChartWidget component');

    // Get widget container for ThingsBoard compatibility
    const $container = self.ctx?.$container || null;

    consumptionChartInstance = MyIOLibrary.createConsumptionChartWidget({
      domain: 'water',
      containerId: 'water-chart-widget',
      title: 'Consumo de Água - 7 dias',
      unit: 'm³',
      decimalPlaces: 1,
      chartHeight: 280,
      defaultPeriod: chartConfig.period || 7,
      defaultChartType: chartConfig.chartType || 'line',
      defaultVizMode: chartConfig.vizMode || 'total',
      theme: 'light',
      $container: $container,

      // Data fetching via adapter
      fetchData: fetchWaterConsumptionDataAdapter,

      // Callbacks
      onMaximizeClick: () => {
        console.log('[WATER] [RFC-0098] Maximize button clicked');
        openFullscreenModal();
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

  // RFC-0098: Component is required - no fallback to legacy canvas
  console.error('[WATER] [RFC-0098] createConsumptionChartWidget not available');
}

/**
 * RFC-0102: Inicializa o gráfico de distribuição usando createDistributionChartWidget
 * @deprecated Use distributionChartInstance API instead
 */
async function initializePieChart(data) {
  // RFC-0102: Distribution chart is now initialized via createDistributionChartWidget
  // This function is kept for backwards compatibility
  if (distributionChartInstance) {
    console.log('[WATER] [RFC-0102] Refreshing distribution chart');
    await distributionChartInstance.refresh();
    return;
  }
  console.warn('[WATER] [RFC-0102] Distribution chart instance not available');
}

/**
 * RFC-0102: Initialize distribution chart widget
 */
async function initializeDistributionChartWidget() {
  if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.createDistributionChartWidget) {
    console.error('[WATER] [RFC-0102] createDistributionChartWidget not available');
    return;
  }

  console.log('[WATER] [RFC-0102] Initializing distribution chart widget...');

  // Calculate distribution data for water
  const calculateWaterDistribution = async (mode) => {
    const cachedData = getCachedTotalConsumption();

    if (mode === 'groups') {
      // Lojas vs Área Comum
      return {
        'Lojas': cachedData?.storesTotal || 0,
        'Área Comum': cachedData?.commonAreaTotal || 0,
      };
    } else if (mode === 'stores') {
      // Lojas por Shopping - mock data for now
      const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
      const customers = orchestrator?.getCustomers?.() || [];

      const result = {};
      customers.forEach((c, i) => {
        const name = c.name || c.title || `Shopping ${i + 1}`;
        result[name] = (cachedData?.storesTotal || 0) * (0.2 + Math.random() * 0.3);
      });

      if (Object.keys(result).length === 0) {
        result['Shopping 1'] = (cachedData?.storesTotal || 0) * 0.4;
        result['Shopping 2'] = (cachedData?.storesTotal || 0) * 0.35;
        result['Shopping 3'] = (cachedData?.storesTotal || 0) * 0.25;
      }

      return result;
    } else if (mode === 'common') {
      // Área Comum por Shopping - mock data for now
      const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
      const customers = orchestrator?.getCustomers?.() || [];

      const result = {};
      customers.forEach((c, i) => {
        const name = c.name || c.title || `Shopping ${i + 1}`;
        result[name] = (cachedData?.commonAreaTotal || 0) * (0.2 + Math.random() * 0.3);
      });

      if (Object.keys(result).length === 0) {
        result['Shopping 1'] = (cachedData?.commonAreaTotal || 0) * 0.4;
        result['Shopping 2'] = (cachedData?.commonAreaTotal || 0) * 0.35;
        result['Shopping 3'] = (cachedData?.commonAreaTotal || 0) * 0.25;
      }

      return result;
    }

    return null;
  };

  // Get widget container for ThingsBoard compatibility
  const $container = self.ctx?.$container || null;

  distributionChartInstance = MyIOLibrary.createDistributionChartWidget({
    domain: 'water',
    containerId: 'water-distribution-widget',
    title: 'Distribuição de Consumo de Água',
    unit: 'm³',
    decimalPlaces: 1,
    chartHeight: 300,
    theme: 'light',
    $container: $container,

    // Visualization modes for water
    modes: [
      { value: 'groups', label: 'Lojas vs Área Comum' },
      { value: 'stores', label: 'Lojas por Shopping' },
      { value: 'common', label: 'Área Comum por Shopping' },
    ],
    defaultMode: 'groups',

    // Custom group colors for water
    groupColors: {
      'Lojas': '#10b981',
      'Área Comum': '#0288d1',
    },

    // Data fetching
    fetchDistribution: calculateWaterDistribution,

    // Get shopping colors from orchestrator for consistency
    getShoppingColors: () => {
      const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
      return orchestrator?.getShoppingColors?.() || null;
    },

    // Callbacks
    onModeChange: (mode) => {
      console.log(`[WATER] [RFC-0102] Distribution mode changed to: ${mode}`);
    },
    onDataLoaded: (data) => {
      console.log('[WATER] [RFC-0102] Distribution data loaded:', Object.keys(data).length, 'items');
    },
    onError: (error) => {
      console.error('[WATER] [RFC-0102] Distribution chart error:', error);
    },
  });

  try {
    await distributionChartInstance.render();
    console.log('[WATER] [RFC-0102] Distribution chart rendered successfully');

    // Store legacy reference for backwards compatibility
    pieChartInstance = distributionChartInstance.getChartInstance();
  } catch (error) {
    console.error('[WATER] [RFC-0102] Failed to render distribution chart:', error);
  }
}

/**
 * RFC-0102: Atualiza o gráfico de distribuição com novo modo
 * @deprecated Use distributionChartInstance.setMode() instead
 */
async function updatePieChartMode(mode) {
  console.log('[WATER] [RFC-0102] Updating distribution chart mode:', mode);

  if (distributionChartInstance) {
    await distributionChartInstance.setMode(mode);
  } else {
    console.warn('[WATER] [RFC-0102] Distribution chart instance not available');
  }
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
// RFC-0098: FULLSCREEN MODAL FUNCTIONS
// ============================================

// RFC-0098: Reference to fullscreen modal instance
let fullscreenModalInstance = null;

/**
 * RFC-0098: Open fullscreen modal using createConsumptionModal
 * Replaces legacy fullscreen chart code with standardized component
 */
async function openFullscreenModal() {
  if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.createConsumptionModal) {
    console.error('[WATER] [RFC-0098] createConsumptionModal not available');
    return;
  }

  console.log('[WATER] [RFC-0098] Opening fullscreen modal...');

  // RFC-0098: Get cached data from the consumption chart widget for instant display
  const initialData = cachedChartData || consumptionChartInstance?.getCachedData?.() || null;
  if (initialData) {
    console.log('[WATER] [RFC-0098] Using cached data for modal (instant display)');
  }

  fullscreenModalInstance = MyIOLibrary.createConsumptionModal({
    domain: 'water',
    title: 'Consumo de Água',
    unit: 'm³',
    decimalPlaces: 1,
    defaultPeriod: chartConfig.period || 7,
    defaultChartType: chartConfig.chartType || 'line',
    defaultVizMode: chartConfig.vizMode || 'total',
    theme: 'light',
    showSettingsButton: false, // Settings configured in widget before maximizing
    fetchData: fetchWaterConsumptionDataAdapter,
    initialData: initialData, // RFC-0098: Pass cached data for instant display
    onClose: () => {
      console.log('[WATER] [RFC-0098] Fullscreen modal closed');
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

  // RFC-0098: Config button removed from fullscreen - settings handled by main component

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
 * RFC-0098: Setup chart tab handlers
 * NOTE: The createConsumptionChartWidget component now handles tabs internally.
 * This function is kept for backwards compatibility with external tabs if present.
 */
function setupChartTabHandlers() {
  // RFC-0098: The widget component injects its own tabs, so external tabs may not exist
  const vizTabs = document.querySelectorAll('.viz-mode-tabs .chart-tab');
  const typeTabs = document.querySelectorAll('.chart-type-tabs .chart-tab');

  if (vizTabs.length === 0 && typeTabs.length === 0) {
    console.log('[WATER] [RFC-0098] No external tabs found - widget handles tabs internally');
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

  console.log('[WATER] [RFC-0098] External tab handlers setup (if present)');
}

// RFC-0098: Legacy chart functions removed (rerenderLineChart, openChartConfigModal, etc.) - settings handled by component

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

  // RFC-0102: Cleanup distribution chart instance
  if (distributionChartInstance && typeof distributionChartInstance.destroy === 'function') {
    console.log('[WATER] [RFC-0102] Destroying distribution chart instance');
    distributionChartInstance.destroy();
    distributionChartInstance = null;
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
  console.log('[WATER] DEBUG: MyIOLibrary available?', typeof MyIOLibrary !== 'undefined');
  console.log('[WATER] DEBUG: water-chart-widget container?', !!$id('water-chart-widget'));
  console.log('[WATER] DEBUG: water-distribution-widget container?', !!$id('water-distribution-widget'));

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

  // RFC-0098: Chart config button handled by createConsumption7DaysChart component via settingsButtonId and onSettingsClick

  // Initialize charts with empty/loading state
  setTimeout(() => {
    console.log('[WATER] DEBUG setTimeout: Initializing charts...');

    initializeLineChart();

    // RFC-0102: Initialize distribution chart widget
    initializeDistributionChartWidget();

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
