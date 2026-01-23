/* global self, window, document, Chart, MyIOLibrary */
// ============================================
// MYIO-SIM 1.0.0 - WATER Widget Controller
// RFC-0087: Water Consumption Dashboard
// RFC-0131: Minimalist refactor using MyIOUtils
// ============================================

// ============================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log('[WATER]', ...args),
  warn: (...args) => console.warn('[WATER]', ...args),
  error: (...args) => console.error('[WATER]', ...args),
};

// RFC-0131: Element selector using shared utility
const $id = (id) => window.MyIOUtils?.$id?.(self.ctx, id) || document.getElementById(id);

// RFC-0131: Cleanup functions registry
let cleanupFns = [];
function cleanupAll() {
  cleanupFns.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      /* ignore */
    }
  });
  cleanupFns = [];
}

LogHelper.log('Script loaded, using shared utilities:', !!window.MyIOUtils?.LogHelper);

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
    LogHelper.log('Total consumption cache expired');
    return null;
  }

  LogHelper.log('Using cached total consumption data');
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
  LogHelper.log('Total consumption data cached:', totalConsumptionCache.data);
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

// RFC-0131: $id function is now defined at the top of the file using MyIOUtils

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

/**
 * Renderiza a UI do card de consumo de LOJAS
 */
function renderStoresConsumptionUI(data, valueEl, trendEl, infoEl) {
  LogHelper.log(' renderStoresConsumptionUI called:', { data, hasValueEl: !!valueEl });
  if (!data) {
    LogHelper.log(' renderStoresConsumptionUI: data is null/undefined, returning');
    return;
  }

  const totalGeral = data.totalGeral || 0;
  const storesTotal = data.storesTotal || 0;
  const storesPercentage = totalGeral > 0 ? (storesTotal / totalGeral) * 100 : 0;

  if (valueEl) {
    LogHelper.log(' Setting stores value to:', formatWaterVolume(storesTotal));
    valueEl.textContent = formatWaterVolume(storesTotal);
  } else {
    LogHelper.log(' WARNING: valueEl is null for stores card!');
  }

  if (trendEl) {
    trendEl.textContent = `${storesPercentage.toFixed(1)}% do total`;
    trendEl.className = 'trend neutral';
  }

  if (infoEl) {
    infoEl.textContent = 'Hidrômetros de lojas';
  }

  LogHelper.log(' Card de Lojas atualizado:', { storesTotal, storesPercentage });
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

  LogHelper.log(' Card de Área Comum atualizado:', { commonAreaTotal, commonAreaPercentage });
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

  LogHelper.log(' Card Total atualizado:', { totalGeral });
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

  LogHelper.log(' Cards initialized with loading state');
}

/**
 * Atualiza todos os cards com dados
 */
function updateAllCards(data) {
  LogHelper.log(' Updating all cards with data:', data);

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
let distributionChartRendered = false; // FIX: Flag to track if chart has rendered

// RFC-0098: Cache TTL for chart data (5 minutes)
const CHART_CACHE_TTL = 5 * 60 * 1000;

/**
 * RFC-0098: Get shopping name from multiple sources (same pattern as ENERGY)
 */
function getShoppingNameForFilter(customerId) {
  if (!customerId) return 'Sem Shopping';

  // Priority 1: Try to get from waterCache (has customerName from API /totals)
  const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
  if (orchestrator && typeof orchestrator.getWaterCache === 'function') {
    const waterCache = orchestrator.getWaterCache();

    // Find any device with this customerId and get customerName
    for (const [ingestionId, deviceData] of waterCache) {
      if (deviceData.customerId === customerId && deviceData.customerName) {
        return deviceData.customerName;
      }
    }
  }

  // Priority 2: Try from window.custumersSelected (MENU filter)
  if (window.custumersSelected && Array.isArray(window.custumersSelected)) {
    const shopping = window.custumersSelected.find(
      (c) => c.value === customerId || c.ingestionId === customerId
    );
    if (shopping && shopping.name) return shopping.name;
  }

  // Priority 3: Try from ctx.$scope.custumer
  if (self.ctx?.$scope?.custumer && Array.isArray(self.ctx.$scope.custumer)) {
    const shopping = self.ctx.$scope.custumer.find((c) => c.value === customerId);
    if (shopping && shopping.name) return shopping.name;
  }

  // Fallback
  return `Shopping ${customerId.substring(0, 8)}...`;
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
    // FIX: Include BOTH value (ThingsBoard customerId) and ingestionId (myIO ingestionId)
    // Water devices have customerId which matches 'value', not 'ingestionId'
    const selectedIds = [];
    window.custumersSelected.forEach((c) => {
      // value = ThingsBoard customer UUID (used by water devices as customerId)
      if (c.value) selectedIds.push(c.value);
      // ingestionId = myIO ingestion ID (used by energy API)
      if (c.ingestionId && c.ingestionId !== c.value) selectedIds.push(c.ingestionId);
    });

    if (selectedIds.length > 0) {
      LogHelper.log(' [RFC-0098] Using filtered shopping IDs (value + ingestionId):', selectedIds.length);
      return selectedIds;
    }
  }

  // Fallback: return empty array (will use widget's customerId)
  LogHelper.log(' [RFC-0098] No shopping filter active, using widget customerId');
  return [];
}

/**
 * RFC-0098: Fetch water consumption for a period, grouped by day
 * Water API (/water/devices/totals) returns total_value per device (not consumption array like energy)
 * So we need to make one API call per day to get daily breakdown.
 * Fetches in batches of 3 with delay between batches to avoid rate limiting.
 * @param {string} customerId - Customer ID (may be holding ID which returns all shoppings)
 * @param {number} startTs - Start timestamp (unused, we use dayBoundaries)
 * @param {number} endTs - End timestamp (unused, we use dayBoundaries)
 * @param {Array} dayBoundaries - Array of { label, startTs, endTs }
 * @returns {Promise<{dailyTotals: number[], byCustomerPerDay: Object[]}>} - Daily totals and per-customer breakdown
 */
async function fetchWaterPeriodConsumptionByDay(customerId, startTs, endTs, dayBoundaries) {
  try {
    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 500;
    const dailyTotals = [];
    const byCustomerPerDay = [];

    // Process in batches of 3
    for (let i = 0; i < dayBoundaries.length; i += BATCH_SIZE) {
      const batch = dayBoundaries.slice(i, i + BATCH_SIZE);

      // Fetch batch in parallel
      const batchPromises = batch.map(async (day) => {
        try {
          const result = await window.MyIOUtils.fetchWaterDayConsumption(customerId, day.startTs, day.endTs);
          return {
            total: result?.total || 0,
            byCustomer: result?.byCustomer || {},
          };
        } catch (dayError) {
          console.warn(`[WATER] [RFC-0098] Error fetching day ${day.label}:`, dayError);
          return { total: 0, byCustomer: {} };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach((res) => {
        dailyTotals.push(res.total);
        byCustomerPerDay.push(res.byCustomer);
      });

      // Add delay before next batch (except for last batch)
      if (i + BATCH_SIZE < dayBoundaries.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    console.log(
      `[WATER] [RFC-0098] Period consumption for ${customerId.slice(0, 8)}:`,
      dailyTotals.map((v) => v.toFixed(2))
    );
    return { dailyTotals, byCustomerPerDay };
  } catch (error) {
    LogHelper.error(' Error fetching period consumption:', error);
    return {
      dailyTotals: new Array(dayBoundaries.length).fill(0),
      byCustomerPerDay: new Array(dayBoundaries.length).fill({}),
    };
  }
}

/**
 * RFC-0098: Fetch water consumption for N days with real API data
 * Returns structured data with per-shopping breakdown for vizMode support
 */
async function fetch7DaysConsumption(period = 7, fallbackCustomerId = null) {
  // Get filtered shopping IDs (used to filter results AFTER API call)
  const selectedShoppingIds = getSelectedShoppingIds();
  const hasFilter = selectedShoppingIds.length > 0;

  // ALWAYS use holding CUSTOMER_ING_ID for API call (with deep=1, returns all shoppings)
  const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
  const creds = orchestrator?.getCredentials?.();
  const holdingCustomerId = creds?.CUSTOMER_ING_ID || fallbackCustomerId || window.myioHoldingCustomerId;

  if (!holdingCustomerId) {
    LogHelper.warn(' [RFC-0098] No holding customer ID available');
    return { labels: [], dailyTotals: [], shoppingData: {}, shoppingNames: {} };
  }

  // Check cache (invalidate if filter changed)
  const cacheKey = hasFilter ? selectedShoppingIds.sort().join(',') : holdingCustomerId;
  if (cachedChartData && cachedChartData.fetchTimestamp) {
    const cacheAge = Date.now() - cachedChartData.fetchTimestamp;
    if (cacheAge < CHART_CACHE_TTL && cachedChartData.cacheKey === cacheKey) {
      LogHelper.log(' [RFC-0098] Using cached data (age:', Math.round(cacheAge / 1000), 's)');
      return cachedChartData;
    }
  }

  LogHelper.log(
    ' [RFC-0098] Fetching',
    period,
    'days for holding:',
    holdingCustomerId,
    hasFilter ? `(filter: ${selectedShoppingIds.length} shoppings)` : ''
  );

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

  // Fetch data using HOLDING ID - API with deep=1 returns all shoppings
  LogHelper.log(' [RFC-0098] Fetching data for', period, 'days using holding ID...');
  const { dailyTotals: rawDailyTotals, byCustomerPerDay } = await fetchWaterPeriodConsumptionByDay(
    holdingCustomerId,
    startTs,
    endTs,
    dayBoundaries
  );

  // Build shoppingData from byCustomerPerDay
  const shoppingData = {};
  const shoppingNames = {};

  // Collect all unique customer IDs from all days
  const allCustomerIds = new Set();
  byCustomerPerDay.forEach((dayData) => {
    Object.keys(dayData).forEach((custId) => allCustomerIds.add(custId));
  });

  // Filter by selected shoppings if filter is active
  const filteredCustomerIds = hasFilter
    ? Array.from(allCustomerIds).filter((custId) => selectedShoppingIds.includes(custId))
    : Array.from(allCustomerIds);

  LogHelper.log(
    ' [RFC-0098] Customers from API:',
    allCustomerIds.size,
    'filtered to:',
    filteredCustomerIds.length
  );

  // Build per-shopping arrays (only for filtered customers)
  filteredCustomerIds.forEach((custId) => {
    shoppingData[custId] = [];
    // Get name from first day that has this customer
    const firstDayWithCustomer = byCustomerPerDay.find((dayData) => dayData[custId]);
    shoppingNames[custId] = firstDayWithCustomer?.[custId]?.name || getShoppingNameForFilter(custId);

    // Build daily values for this customer
    dayBoundaries.forEach((_, dayIdx) => {
      const dayData = byCustomerPerDay[dayIdx] || {};
      shoppingData[custId].push(dayData[custId]?.total || 0);
    });
  });

  // Recalculate daily totals based on filtered customers
  const dailyTotals = [];
  for (let dayIdx = 0; dayIdx < period; dayIdx++) {
    let dayTotal = 0;
    for (const custId of filteredCustomerIds) {
      dayTotal += shoppingData[custId]?.[dayIdx] || 0;
    }
    dailyTotals.push(dayTotal);
  }

  const result = {
    labels,
    dailyTotals,
    shoppingData,
    shoppingNames,
    holdingCustomerId,
    customerIds: filteredCustomerIds,
    cacheKey,
    fetchTimestamp: Date.now(),
  };

  // Update cache
  cachedChartData = result;

  LogHelper.log(' [RFC-0098] Data fetched:', {
    days: period,
    shoppings: allCustomerIds.size,
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
  LogHelper.log(' [RFC-0098] Fetching data via adapter for', period, 'days');

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
    LogHelper.log(' [RFC-0098] Using createConsumptionChartWidget component');

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
        LogHelper.log(' [RFC-0098] Maximize button clicked');
        openFullscreenModal();
      },
      onDataLoaded: (data) => {
        // Update cache for fullscreen and other features
        cachedChartData = data;
        LogHelper.log(' [RFC-0098] Data loaded:', data.labels?.length, 'days');
      },
      onError: (error) => {
        LogHelper.error(' [RFC-0098] Chart error:', error);
      },
    });

    // Render the chart
    await consumptionChartInstance.render();
    LogHelper.log(' [RFC-0098] Consumption chart rendered successfully');

    // Store reference for compatibility with existing code
    lineChartInstance = consumptionChartInstance.getChartInstance();
    return;
  }

  // RFC-0098: Component is required - no fallback to legacy canvas
  LogHelper.error(' [RFC-0098] createConsumptionChartWidget not available');
}

/**
 * RFC-0102: Inicializa o gráfico de distribuição usando createDistributionChartWidget
 * @deprecated Use distributionChartInstance API instead
 */
async function initializePieChart(data) {
  // RFC-0102: Distribution chart is now initialized via createDistributionChartWidget
  // This function is kept for backwards compatibility

  // FIX: Only refresh if chart has been rendered (prevents "canvas not found" error)
  if (!distributionChartRendered) {
    LogHelper.log(' [RFC-0102] Distribution chart not yet rendered, skipping refresh');
    return;
  }

  if (distributionChartInstance) {
    LogHelper.log(' [RFC-0102] Refreshing distribution chart');
    await distributionChartInstance.refresh();
    return;
  }
  LogHelper.warn(' [RFC-0102] Distribution chart instance not available');
}

/**
 * RFC-0102: Initialize distribution chart widget
 */
async function initializeDistributionChartWidget() {
  if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.createDistributionChartWidget) {
    LogHelper.error(' [RFC-0102] createDistributionChartWidget not available');
    return;
  }

  LogHelper.log(' [RFC-0102] Initializing distribution chart widget...');

  // Calculate distribution data for water using REAL data from orchestrator
  // FIX: Now respects customer filter from MENU (myio:filter-applied)
  const calculateWaterDistribution = async (mode) => {
    const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;

    // FIX: Get selected shopping IDs to filter data
    const selectedShoppingIds = getSelectedShoppingIds();
    const hasFilter = selectedShoppingIds.length > 0;

    if (mode === 'groups') {
      // Lojas vs Área Comum
      // FIX: When filter is active, recalculate from waterCache filtering by selected customers
      if (hasFilter) {
        LogHelper.log(
          ' [RFC-0102] Distribution groups mode with filter:',
          selectedShoppingIds.length,
          'shoppings'
        );

        if (!orchestrator || typeof orchestrator.getWaterCache !== 'function') {
          LogHelper.warn(' Orchestrator not available for filtered distribution calculation');
          return null;
        }

        const waterCache = orchestrator.getWaterCache();
        const waterValidIds = orchestrator.getWaterValidIds?.() || {
          stores: new Set(),
          commonArea: new Set(),
        };

        if (!waterCache || waterCache.size === 0) {
          LogHelper.warn(' Water cache is empty');
          return null;
        }

        let storesTotal = 0;
        let commonAreaTotal = 0;

        waterCache.forEach((deviceData, ingestionId) => {
          const customerId = deviceData.customerId;

          // FIX: Filter by selected shopping IDs
          if (!selectedShoppingIds.includes(customerId)) {
            return;
          }

          const consumption = Number(deviceData.value) || Number(deviceData.total_value) || 0;

          if (waterValidIds.stores?.has(ingestionId)) {
            storesTotal += consumption;
          } else if (waterValidIds.commonArea?.has(ingestionId)) {
            commonAreaTotal += consumption;
          }
        });

        LogHelper.log(' [RFC-0102] Distribution (filtered):', {
          stores: storesTotal,
          commonArea: commonAreaTotal,
        });
        return {
          Lojas: storesTotal,
          'Área Comum': commonAreaTotal,
        };
      }

      // No filter - use pre-aggregated data
      const waterClassified =
        window.MyIOOrchestratorData?.waterClassified || window.parent?.MyIOOrchestratorData?.waterClassified;
      if (waterClassified) {
        const storesTotal = waterClassified.stores?.total || 0;
        const commonAreaTotal = waterClassified.commonArea?.total || 0;
        LogHelper.log(' [RFC-0102] Distribution using waterClassified:', {
          stores: storesTotal,
          commonArea: commonAreaTotal,
        });
        return {
          Lojas: storesTotal,
          'Área Comum': commonAreaTotal,
        };
      }
      // Fallback to local cache
      const cachedData = getCachedTotalConsumption();
      LogHelper.log(' [RFC-0102] Distribution using cached totals:', cachedData);
      return {
        Lojas: cachedData?.storesTotal || 0,
        'Área Comum': cachedData?.commonAreaTotal || 0,
      };
    } else if (mode === 'stores' || mode === 'common') {
      // Aggregate consumption by shopping using real data from waterCache
      if (!orchestrator || typeof orchestrator.getWaterCache !== 'function') {
        LogHelper.warn(' Orchestrator not available for distribution calculation');
        return null;
      }

      const waterCache = orchestrator.getWaterCache();
      const waterValidIds = orchestrator.getWaterValidIds?.() || { stores: new Set(), commonArea: new Set() };

      if (!waterCache || waterCache.size === 0) {
        LogHelper.warn(' Water cache is empty');
        return null;
      }

      // Select the target category based on mode
      const targetIds = mode === 'stores' ? waterValidIds.stores : waterValidIds.commonArea;

      console.log(
        `[WATER] Calculating distribution for mode: ${mode}, valid IDs: ${targetIds.size}, filter active: ${hasFilter}`
      );

      // Aggregate by shopping (customerId)
      const shoppingDistribution = {};

      waterCache.forEach((deviceData, ingestionId) => {
        // Only include devices from the selected category
        if (!targetIds.has(ingestionId)) {
          return;
        }

        const customerId = deviceData.customerId;

        // FIX: Filter by selected shopping IDs when filter is active
        if (hasFilter && !selectedShoppingIds.includes(customerId)) {
          return;
        }

        // RFC-0131: waterClassified items use 'value', not 'total_value'
        const consumption = Number(deviceData.value) || Number(deviceData.total_value) || 0;
        const shoppingName = deviceData.ownerName || getShoppingNameForFilter(customerId);

        shoppingDistribution[shoppingName] = (shoppingDistribution[shoppingName] || 0) + consumption;
      });

      console.log(`[WATER] Distribution by ${mode}:`, shoppingDistribution);
      return shoppingDistribution;
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
      Lojas: '#10b981',
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
      LogHelper.log(' [RFC-0102] Distribution data loaded:', Object.keys(data).length, 'items');
    },
    onError: (error) => {
      LogHelper.error(' [RFC-0102] Distribution chart error:', error);
    },
  });

  // Render the distribution chart after a delay to ensure orchestrator is ready
  // (Same pattern as ENERGY widget)
  setTimeout(async () => {
    try {
      await distributionChartInstance.render();
      distributionChartRendered = true; // FIX: Mark chart as rendered
      LogHelper.log(' [RFC-0102] Distribution chart rendered successfully');

      // Store legacy reference for backwards compatibility
      pieChartInstance = distributionChartInstance.getChartInstance();
    } catch (error) {
      LogHelper.error(' [RFC-0102] Failed to render distribution chart:', error);
    }
  }, 2000); // Delay to ensure orchestrator is ready
}

/**
 * RFC-0102: Atualiza o gráfico de distribuição com novo modo
 * @deprecated Use distributionChartInstance.setMode() instead
 */
async function updatePieChartMode(mode) {
  LogHelper.log(' [RFC-0102] Updating distribution chart mode:', mode);

  if (distributionChartInstance) {
    await distributionChartInstance.setMode(mode);
  } else {
    LogHelper.warn(' [RFC-0102] Distribution chart instance not available');
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
        LogHelper.log(' Zoom decreased to:', currentZoom);
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
        LogHelper.log(' Zoom increased to:', currentZoom);
      }
    });
  }

  LogHelper.log(' Zoom controls initialized');
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
  LogHelper.log(' Received water data:', { source, hasCache: !!cache, hasData: !!data });

  // Atualiza cache local
  const cached = getCachedTotalConsumption() || { storesTotal: 0, commonAreaTotal: 0, totalGeral: 0 };

  // PRIORIDADE 1: Usar totais calculados pelo Orchestrator (apenas IDs válidos dos Aliases TB)
  const orchestratorTotals = window.MyIOOrchestrator?.getWaterTotals?.();
  if (orchestratorTotals && orchestratorTotals.total > 0) {
    cached.storesTotal = orchestratorTotals.stores;
    cached.commonAreaTotal = orchestratorTotals.commonArea;
    cached.totalGeral = orchestratorTotals.total;

    LogHelper.log(' Using Orchestrator totals (valid TB aliases):', {
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

    LogHelper.log(' FALLBACK: Using estimated 60/40 split (waiting for valid IDs):', {
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
  LogHelper.log(' Date update received:', event.detail);

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
    LogHelper.error(' [RFC-0098] createConsumptionModal not available');
    return;
  }

  LogHelper.log(' [RFC-0098] Opening fullscreen modal...');

  // RFC-0098: Get cached data from the consumption chart widget for instant display
  const initialData = cachedChartData || consumptionChartInstance?.getCachedData?.() || null;
  if (initialData) {
    LogHelper.log(' [RFC-0098] Using cached data for modal (instant display)');
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
      LogHelper.log(' [RFC-0098] Fullscreen modal closed');
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

  LogHelper.log(' [RFC-0097] Fullscreen chart rebuilt');
}

/**
 * RFC-0097: Setup maximize button handler
 */
function setupMaximizeButton() {
  const maximizeBtn = $id('maximizeChartBtn');
  if (!maximizeBtn) {
    LogHelper.warn('[RFC-0097] Maximize button not found');
    return;
  }

  maximizeBtn.addEventListener('click', openFullscreenModal);
  LogHelper.log('[RFC-0097] Maximize button handler setup complete');
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
    LogHelper.log(' [RFC-0098] No external tabs found - widget handles tabs internally');
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

  LogHelper.log(' [RFC-0098] External tab handlers setup (if present)');
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

  LogHelper.log(' 📍 Rendered', selection.length, 'shopping filter chips');
}

// RFC-0131: Guard to prevent multiple initializations
let waterWidgetInitialized = false;

// ============================================
// THINGSBOARD WIDGET HOOKS
// RFC-0131: Minimalist refactor using MyIOUtils
// ============================================

self.onInit = async function () {
  // RFC-0131: Prevent multiple initializations
  if (waterWidgetInitialized) {
    LogHelper.log('[RFC-0131] Widget already initialized, skipping...');
    return;
  }

  LogHelper.log('[RFC-0131] Initializing water charts and consumption cards...');

  // RFC-0131: Cleanup any existing listeners before adding new ones
  cleanupAll();

  // Initialize cards with loading state
  initializeCards();

  // Setup zoom controls
  setupZoomControls();

  // RFC-0131: Register event listeners using addListenerBoth (auto-cleanup)
  const addListener =
    window.MyIOUtils?.addListenerBoth ||
    ((ev, handler) => {
      window.addEventListener(ev, handler);
      return () => window.removeEventListener(ev, handler);
    });

  // Listen for water data from MAIN
  cleanupFns.push(addListener('myio:water-data-ready', handleWaterDataReady));

  // Listen for water totals calculated from valid TB aliases (Orchestrator)
  cleanupFns.push(
    addListener('myio:water-totals-updated', (ev) => {
      const { commonArea, stores, total } = ev.detail || {};
      LogHelper.log('Water totals updated:', { commonArea, stores, total });

      if (total > 0) {
        cacheTotalConsumption(stores, commonArea, total);
        const cached = { storesTotal: stores, commonAreaTotal: commonArea, totalGeral: total };
        updateAllCards(cached);
        initializePieChart(cached);
      }
    })
  );

  // Listen for water summary from orchestrator (RFC-0131)
  cleanupFns.push(
    addListener('myio:water-summary-ready', (ev) => {
      const { stores, commonArea, filteredTotal } = ev.detail || {};
      LogHelper.log('Water summary ready:', { stores, commonArea, filteredTotal });

      cacheTotalConsumption(stores || 0, commonArea || 0, filteredTotal || 0);
      const data = {
        storesTotal: stores || 0,
        commonAreaTotal: commonArea || 0,
        totalGeral: filteredTotal || 0,
      };
      updateAllCards(data);
      initializePieChart(data);
    })
  );

  // Listen for date/filter updates
  cleanupFns.push(addListener('myio:update-date', handleDateUpdate));

  // Listen for shopping filter changes
  cleanupFns.push(
    addListener('myio:filter-applied', async (ev) => {
      const selection = ev.detail?.selection || [];
      LogHelper.log('Filter applied:', selection.length, 'shoppings');
      renderShoppingFilterChips(selection);

      // Invalidate cache and refresh charts
      cachedChartData = null;
      if (consumptionChartInstance?.refresh) {
        await consumptionChartInstance.refresh(true);
      }
      if (distributionChartInstance?.refresh) {
        await distributionChartInstance.refresh();
      }

      // FIX: Also recalculate and update consumption cards when filter changes
      const selectedShoppingIds = getSelectedShoppingIds();
      const hasFilter = selectedShoppingIds.length > 0;

      if (hasFilter) {
        // Recalculate totals from waterCache filtering by selected customers
        const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
        if (orchestrator && typeof orchestrator.getWaterCache === 'function') {
          const waterCache = orchestrator.getWaterCache();
          const waterValidIds = orchestrator.getWaterValidIds?.() || {
            stores: new Set(),
            commonArea: new Set(),
          };

          if (waterCache && waterCache.size > 0) {
            let filteredStoresTotal = 0;
            let filteredCommonAreaTotal = 0;

            waterCache.forEach((deviceData, ingestionId) => {
              const customerId = deviceData.customerId;

              // Filter by selected shopping IDs
              if (!selectedShoppingIds.includes(customerId)) {
                return;
              }

              const consumption = Number(deviceData.value) || Number(deviceData.total_value) || 0;

              if (waterValidIds.stores?.has(ingestionId)) {
                filteredStoresTotal += consumption;
              } else if (waterValidIds.commonArea?.has(ingestionId)) {
                filteredCommonAreaTotal += consumption;
              }
            });

            const filteredData = {
              storesTotal: filteredStoresTotal,
              commonAreaTotal: filteredCommonAreaTotal,
              totalGeral: filteredStoresTotal + filteredCommonAreaTotal,
            };

            LogHelper.log('Filter applied - updating cards with filtered totals:', filteredData);
            cacheTotalConsumption(filteredStoresTotal, filteredCommonAreaTotal, filteredData.totalGeral);
            updateAllCards(filteredData);
          }
        }
      } else {
        // No filter - request fresh data from orchestrator
        const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
        if (orchestrator?.requestWaterSummary) {
          orchestrator.requestWaterSummary();
        } else if (orchestrator?.getWaterTotals) {
          const totals = orchestrator.getWaterTotals();
          if (totals?.total > 0) {
            const data = {
              storesTotal: totals.stores,
              commonAreaTotal: totals.commonArea,
              totalGeral: totals.total,
            };
            cacheTotalConsumption(data.storesTotal, data.commonAreaTotal, data.totalGeral);
            updateAllCards(data);
          }
        }
      }
    })
  );

  // Check for pre-existing filter
  if (window.custumersSelected?.length > 0) {
    renderShoppingFilterChips(window.custumersSelected);
  }

  // Distribution mode selector
  const distributionSelect = $id('distributionMode');
  if (distributionSelect) {
    distributionSelect.addEventListener('change', (e) => updatePieChartMode(e.target.value));
  }

  // Setup chart tab handlers and maximize button
  setupChartTabHandlers();
  setupMaximizeButton();

  // RFC-0131: Mark widget as initialized
  waterWidgetInitialized = true;

  // Initialize charts immediately (await to ensure proper error handling)
  await initializeLineChart();
  await initializeDistributionChartWidget();

  // RFC-0131: Wait for orchestrator using onOrchestratorReady (no polling)
  const onReady = window.MyIOUtils?.onOrchestratorReady;
  if (onReady) {
    cleanupFns.push(
      onReady(
        (orch) => {
          LogHelper.log('[RFC-0131] Orchestrator ready, requesting water summary...');
          orch.requestWaterSummary?.();
        },
        { timeoutMs: 10000 }
      )
    );
  } else {
    // Fallback: simple retry with toast warning
    LogHelper.warn('MyIOUtils.onOrchestratorReady not available, using fallback');
    setTimeout(() => {
      const orch = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
      if (orch?.requestWaterSummary) {
        orch.requestWaterSummary();
      } else if (orch?.getWaterTotals) {
        // Legacy fallback
        const totals = orch.getWaterTotals();
        if (totals?.total > 0) {
          const data = {
            storesTotal: totals.stores,
            commonAreaTotal: totals.commonArea,
            totalGeral: totals.total,
          };
          cacheTotalConsumption(data.storesTotal, data.commonAreaTotal, data.totalGeral);
          updateAllCards(data);
          initializePieChart(data);
        }
      } else {
        LogHelper.error('Orchestrator not found after timeout');
      }
    }, 2000);
  }
};

self.onDataUpdated = function () {
  // Data updates handled via custom events
};

self.onResize = function () {
  // Charts auto-resize
};

self.onDestroy = function () {
  LogHelper.log('[RFC-0131] Widget destroying...');

  // RFC-0131: Cleanup all registered listeners
  cleanupAll();

  // Close fullscreen modal if open
  if (fullscreenModalInstance) {
    fullscreenModalInstance.close?.();
    fullscreenModalInstance = null;
  }

  // Cleanup chart instances
  if (consumptionChartInstance?.destroy) {
    consumptionChartInstance.destroy();
    consumptionChartInstance = null;
  }
  if (distributionChartInstance?.destroy) {
    distributionChartInstance.destroy();
    distributionChartInstance = null;
  }
  if (lineChartInstance?.destroy) {
    lineChartInstance.destroy();
    lineChartInstance = null;
  }
  if (pieChartInstance?.destroy) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }

  // Reset state
  waterWidgetInitialized = false;
  cachedChartData = null;
  isChartFullscreen = false;
  distributionChartRendered = false; // FIX: Reset flag on destroy

  LogHelper.log('[RFC-0131] Widget destroyed');
};
