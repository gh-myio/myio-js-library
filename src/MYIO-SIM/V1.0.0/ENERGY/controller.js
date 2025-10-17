// ============================================
// MYIO-SIM 1.0.0 - ENERGY Widget Controller
// ============================================

// Cache para pico de demanda
let peakDemandCache = {
  data: null,
  startTs: null,
  endTs: null,
  timestamp: null
};

const PEAK_DEMAND_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Cache para consumo total
let totalConsumptionCache = {
  data: null,
  customerTotal: 0,
  equipmentsTotal: 0,
  difference: 0,
  timestamp: null
};

const TOTAL_CONSUMPTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// ✅ DEBOUNCE: Prevent infinite loops
let isUpdatingTotalConsumption = false;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verifica cache de pico de demanda
 */
function getCachedPeakDemand(startTs, endTs) {
  if (!peakDemandCache.data) return null;

  // Check if cache is for same period
  if (peakDemandCache.startTs !== startTs || peakDemandCache.endTs !== endTs) {
    return null;
  }

  // Check if cache is fresh
  const age = Date.now() - peakDemandCache.timestamp;
  if (age > PEAK_DEMAND_CACHE_TTL) {
    console.log("[ENERGY] Peak demand cache expired");
    return null;
  }

  console.log("[ENERGY] Using cached peak demand data");
  return peakDemandCache.data;
}

/**
 * Armazena dados no cache
 */
function cachePeakDemand(data, startTs, endTs) {
  peakDemandCache = {
    data,
    startTs,
    endTs,
    timestamp: Date.now()
  };
  console.log("[ENERGY] Peak demand data cached");
}

/**
 * Verifica cache de consumo total
 */
function getCachedTotalConsumption() {
  if (!totalConsumptionCache.data) return null;

  // Check if cache is fresh (5 minutos)
  const age = Date.now() - totalConsumptionCache.timestamp;
  if (age > TOTAL_CONSUMPTION_CACHE_TTL) {
    console.log("[ENERGY] Total consumption cache expired");
    return null;
  }

  console.log("[ENERGY] Using cached total consumption data");
  return totalConsumptionCache.data;
}

/**
 * Armazena dados de consumo total no cache
 */
function cacheTotalConsumption(customerTotal, equipmentsTotal, difference, percentage, deviceCount) {
  totalConsumptionCache = {
    data: {
      customerTotal,
      equipmentsTotal,
      difference,
      percentage,
      deviceCount
    },
    customerTotal,
    equipmentsTotal,
    difference,
    timestamp: Date.now()
  };
  console.log("[ENERGY] Total consumption data cached:", totalConsumptionCache.data);
}

/**
 * Extrai IDs dos devices do ctx.data
 */
function extractDeviceIds(ctxData) {
  const deviceIds = new Set();

  if (!Array.isArray(ctxData)) {
    console.warn("[ENERGY] ctxData is not an array");
    return [];
  }

  ctxData.forEach(data => {
    // Skip customer/shopping entries
    if (data.datasource?.aliasName === "Shopping") {
      return;
    }

    const entityId = data.datasource?.entityId?.id || data.datasource?.entity?.id?.id;
    if (entityId) {
      deviceIds.add(entityId);
    }
  });

  console.log(`[ENERGY] Extracted ${deviceIds.size} device IDs`);
  return Array.from(deviceIds);
}

/**
 * Busca nome do device por ID
 */
function getDeviceNameById(deviceId) {
  if (!self.ctx?.data) {
    return null;
  }

  const deviceData = self.ctx.data.find(d => {
    const id = d.datasource?.entityId?.id || d.datasource?.entity?.id?.id;
    return id === deviceId;
  });

  return deviceData?.datasource?.entityLabel ||
         deviceData?.datasource?.entityName ||
         deviceData?.datasource?.name ||
         null;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Busca o pico de demanda iterando por todos os devices do customer
 * @param {string} customerId - ID do customer no ThingsBoard
 * @param {number} startTs - Timestamp início em ms
 * @param {number} endTs - Timestamp fim em ms
 * @returns {Promise<{peakValue: number, timestamp: number, deviceId: string, deviceName: string}>}
 */
async function fetchCustomerPeakDemand(customerId, startTs, endTs) {
  // Try cache first
  const cached = getCachedPeakDemand(startTs, endTs);
  if (cached) {
    return cached;
  }

  const tbToken = localStorage.getItem("jwt_token");

  if (!tbToken) {
    throw new Error("JWT do ThingsBoard não encontrado");
  }

  try {
    // ✅ DEVICE-BY-DEVICE APPROACH
    const devices = extractDeviceIds(self.ctx.data);

    if (devices.length === 0) {
      console.warn("[ENERGY] No devices found for peak demand calculation");
      const result = { peakValue: 0, timestamp: Date.now(), deviceId: null, deviceName: 'Sem devices' };
      cachePeakDemand(result, startTs, endTs);
      return result;
    }

    console.log(`[ENERGY] Fetching peak demand for ${devices.length} devices`);

    const peakResults = [];

    // Iterate through each device
    for (const deviceId of devices) {
      try {
        // Build URL with power and demand keys
        const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?` +
          `keys=power,demand,consumption&startTs=${startTs}&endTs=${endTs}&agg=MAX&limit=1`;

        console.log(`[ENERGY] Fetching peak for device ${deviceId}`);

        const response = await fetch(url, {
          headers: {
            "X-Authorization": `Bearer ${tbToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.warn(`[ENERGY] Failed to fetch demand for device ${deviceId}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        console.log(`[ENERGY] Device ${deviceId} response:`, data);

        // Data format: { "power": [{ts: 123, value: 456}], "demand": [...], "consumption": [...] }
        const powerData = data.power || [];
        const demandData = data.demand || [];
        const consumptionData = data.consumption || [];

        // Collect all peak values from different keys
        if (powerData.length > 0) {
          peakResults.push({
            deviceId,
            value: Number(powerData[0].value) || 0,  // ✅ Convert to number
            timestamp: powerData[0].ts,
            key: 'power'
          });
        }

        if (demandData.length > 0) {
          peakResults.push({
            deviceId,
            value: Number(demandData[0].value) || 0,  // ✅ Convert to number
            timestamp: demandData[0].ts,
            key: 'demand'
          });
        }

        if (consumptionData.length > 0) {
          peakResults.push({
            deviceId,
            value: Number(consumptionData[0].value) || 0,  // ✅ Convert to number
            timestamp: consumptionData[0].ts,
            key: 'consumption'
          });
        }

      } catch (err) {
        console.error(`[ENERGY] Error fetching demand for device ${deviceId}:`, err);
        // Continue to next device
      }
    }

    // Encontrar o maior pico entre todos os devices
    if (peakResults.length === 0) {
      console.log("[ENERGY] No peak data found across all devices");
      const result = { peakValue: 0, timestamp: Date.now(), deviceId: null, deviceName: 'Sem dados' };
      cachePeakDemand(result, startTs, endTs);
      return result;
    }

    // Find maximum peak
    const maxPeak = peakResults.reduce((max, current) =>
      current.value > max.value ? current : max
    );

    console.log("[ENERGY] Maximum peak found:", maxPeak);

    // Buscar nome do device
    const deviceName = getDeviceNameById(maxPeak.deviceId);

    const result = {
      peakValue: Number(maxPeak.value) || 0,  // ✅ Convert to number
      timestamp: maxPeak.timestamp,
      deviceId: maxPeak.deviceId,
      deviceName: deviceName || 'Desconhecido'
    };

    console.log("[ENERGY] Peak demand result:", result);

    // Cache the result
    cachePeakDemand(result, startTs, endTs);

    return result;

  } catch (err) {
    console.error(`[ENERGY] Error fetching customer peak demand:`, err);

    // Return fallback result
    const result = { peakValue: 0, timestamp: Date.now(), deviceId: null, deviceName: 'Erro' };
    cachePeakDemand(result, startTs, endTs);
    return result;
  }
}

/**
 * Calcula a tendência de pico comparando com período anterior
 * @param {number} currentPeak - Pico atual
 * @param {number} startTs - Início do período atual
 * @param {number} endTs - Fim do período atual
 */
async function calculatePeakTrend(currentPeak, startTs, endTs) {
  try {
    // Calcular período anterior (mesmo intervalo)
    const periodDuration = endTs - startTs;
    const previousStartTs = startTs - periodDuration;
    const previousEndTs = startTs;

    const customerId = self.ctx.settings?.customerId;

    if (!customerId) {
      console.warn("[ENERGY] Customer ID not available for trend calculation");
      return {
        direction: 'neutral',
        percentChange: 0,
        label: '—'
      };
    }

    const previousPeak = await fetchCustomerPeakDemand(customerId, previousStartTs, previousEndTs);

    if (!previousPeak || previousPeak.peakValue === 0) {
      return {
        direction: 'neutral',
        percentChange: 0,
        label: '— sem dados anteriores'
      };
    }

    const percentChange = ((currentPeak - previousPeak.peakValue) / previousPeak.peakValue) * 100;

    return {
      direction: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'neutral',
      percentChange: Math.abs(percentChange),
      label: percentChange > 0
        ? `▲ +${percentChange.toFixed(1)}% vs período anterior`
        : percentChange < 0
        ? `▼ ${percentChange.toFixed(1)}% vs período anterior`
        : '— sem alteração'
    };
  } catch (error) {
    console.error("[ENERGY] Error calculating peak trend:", error);
    return {
      direction: 'neutral',
      percentChange: 0,
      label: '— erro no cálculo'
    };
  }
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

/**
 * Renderiza a UI do card de consumo total com dados
 */
function renderTotalConsumptionUI(energyData, valueEl, trendEl, infoEl) {
  // Format value (diferença = customer total - equipments total)
  const differenceFormatted = energyData.difference >= 1000
    ? `${(energyData.difference / 1000).toFixed(2)} MWh`
    : `${energyData.difference.toFixed(2)} kWh`;

  // Update value
  if (valueEl) {
    valueEl.textContent = differenceFormatted;
  }

  // Update info with breakdown
  if (infoEl) {
    const customerFormatted = energyData.customerTotal >= 1000
      ? `${(energyData.customerTotal / 1000).toFixed(2)} MWh`
      : `${energyData.customerTotal.toFixed(2)} kWh`;

    const equipmentsFormatted = energyData.equipmentsTotal >= 1000
      ? `${(energyData.equipmentsTotal / 1000).toFixed(2)} MWh`
      : `${energyData.equipmentsTotal.toFixed(2)} kWh`;

    infoEl.textContent = `Total: ${customerFormatted} | Equipamentos: ${equipmentsFormatted}`;
  }

  // Update trend with percentage
  if (trendEl) {
    const percentage = energyData.percentage.toFixed(1);
    trendEl.textContent = `${percentage}% do total (${energyData.deviceCount} equipamentos)`;
    trendEl.className = "trend neutral";
  }
}

/**
 * Inicializa o card de consumo total com estado de loading
 */
function initializeTotalConsumptionCard() {
  const valueEl = document.getElementById("total-consumption-value");
  const trendEl = document.getElementById("total-consumption-trend");
  const infoEl = document.getElementById("total-consumption-info");

  // ✅ Try to use cache first
  const cached = getCachedTotalConsumption();
  if (cached) {
    console.log("[ENERGY] Initializing with cached total consumption data");
    renderTotalConsumptionUI(cached, valueEl, trendEl, infoEl);
    return;
  }

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
    trendEl.textContent = "Aguardando dados...";
    trendEl.className = "trend neutral";
  }

  if (infoEl) {
    infoEl.textContent = "";
  }

  console.log("[ENERGY] Total consumption card initialized with loading state");
}

/**
 * Atualiza o card de consumo total
 */
function updateTotalConsumptionCard() {
  // ✅ PREVENT INFINITE LOOPS: Check if already updating
  if (isUpdatingTotalConsumption) {
    console.log("[ENERGY] Update already in progress, skipping...");
    return;
  }

  isUpdatingTotalConsumption = true;

  try {
    const valueEl = document.getElementById("total-consumption-value");
    const trendEl = document.getElementById("total-consumption-trend");
    const infoEl = document.getElementById("total-consumption-info");

    // ✅ Try cache first
    const cached = getCachedTotalConsumption();
    if (cached) {
      console.log("[ENERGY] Using cached total consumption");
      renderTotalConsumptionUI(cached, valueEl, trendEl, infoEl);
      return;
    }

    if (!window.MyIOOrchestrator) {
      console.warn("[ENERGY] MyIOOrchestrator not available");
      return;
    }

    // Pega dados do orquestrador
    const customerTotal = totalConsumptionCache.customerTotal || 0;
    const energyData = window.MyIOOrchestrator.getEnergyWidgetData(customerTotal);

    console.log("[ENERGY] Total consumption data:", energyData);

    // ✅ Cache the data
    cacheTotalConsumption(
      energyData.customerTotal,
      energyData.equipmentsTotal,
      energyData.difference,
      energyData.percentage,
      energyData.deviceCount
    );

    // Render UI
    renderTotalConsumptionUI(energyData, valueEl, trendEl, infoEl);

    console.log("[ENERGY] Total consumption card updated successfully");

  } catch (error) {
    console.error("[ENERGY] Error updating total consumption card:", error);

    const valueEl = document.getElementById("total-consumption-value");
    const trendEl = document.getElementById("total-consumption-trend");
    const infoEl = document.getElementById("total-consumption-info");

    // Show error state
    if (valueEl) {
      valueEl.textContent = "Erro";
    }
    if (trendEl) {
      trendEl.textContent = "Falha ao carregar dados";
      trendEl.className = "trend neutral";
    }
    if (infoEl) {
      infoEl.textContent = "";
    }
  } finally {
    // ✅ Reset flag after a short delay to allow DOM updates
    setTimeout(() => {
      isUpdatingTotalConsumption = false;
    }, 100);
  }
}

/**
 * Inicializa o card de pico de demanda com estado de loading
 */
function initializePeakDemandCard() {
  const valueEl = document.getElementById("peak-demand-value");
  const trendEl = document.getElementById("peak-demand-trend");
  const deviceEl = document.getElementById("peak-demand-device");

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
    trendEl.textContent = "Aguardando dados...";
    trendEl.className = "trend neutral";
  }

  if (deviceEl) {
    deviceEl.textContent = "";
  }

  console.log("[ENERGY] Peak demand card initialized with loading state");
}

/**
 * Atualiza o card de pico de demanda com dados reais
 */
async function updatePeakDemandCard(startTs, endTs) {
  const valueEl = document.getElementById("peak-demand-value");
  const trendEl = document.getElementById("peak-demand-trend");
  const deviceEl = document.getElementById("peak-demand-device");

  try {
    console.log("[ENERGY] Fetching peak demand data...", { startTs, endTs });

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

    const customerId = self.ctx.settings?.customerId;

    if (!customerId) {
      throw new Error("Customer ID não encontrado");
    }

    // Fetch peak demand
    const peakData = await fetchCustomerPeakDemand(customerId, startTs, endTs);

    console.log("[ENERGY] Peak demand data received:", peakData);

    // Handle no data case
    if (!peakData || peakData.peakValue === 0) {
      if (valueEl) {
        valueEl.textContent = "— kW";
      }
      if (trendEl) {
        trendEl.textContent = "Sem dados disponíveis";
        trendEl.className = "trend neutral";
      }
      if (deviceEl) {
        deviceEl.textContent = "";
      }
      return;
    }

    // Format peak value
    const peakValueFormatted = peakData.peakValue >= 1000
      ? `${(peakData.peakValue / 1000).toFixed(3)} MW`
      : `${peakData.peakValue.toFixed(0)} kW`;

    // Update value
    if (valueEl) {
      valueEl.textContent = peakValueFormatted;
    }

    // Calculate and update trend
    const trendData = await calculatePeakTrend(peakData.peakValue, startTs, endTs);

    if (trendEl) {
      trendEl.textContent = trendData.label;
      trendEl.className = `trend ${trendData.direction}`;
    }

    // Update device info
    if (deviceEl && peakData.deviceName) {
      const peakDate = new Date(peakData.timestamp);
      const peakTime = peakDate.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      deviceEl.textContent = `${peakData.deviceName} às ${peakTime}`;
    }

    console.log("[ENERGY] Peak demand card updated successfully");

  } catch (error) {
    console.error("[ENERGY] Error updating peak demand card:", error);

    // Show error state
    if (valueEl) {
      valueEl.textContent = "Erro";
    }
    if (trendEl) {
      trendEl.textContent = "Falha ao carregar dados";
      trendEl.className = "trend neutral";
    }
    if (deviceEl) {
      deviceEl.textContent = "";
    }
  }
}

// ============================================
// CHART FUNCTIONS (Original)
// ============================================

function initializeCharts() {
  // Mock data (pode substituir com telemetria real do ThingsBoard)
  const lineCtx = document.getElementById("lineChart").getContext("2d");
  new Chart(lineCtx, {
    type: "line",
    data: {
      labels: ["00:00","02:00","04:00","06:00","08:00","10:00","12:00","14:00","16:00","18:00","20:00","22:00"],
      datasets: [{
        label: "Consumo Real",
        data: [900,750,650,700,1100,1400,1600,1900,1700,1500,1200,1000],
        borderColor: "#2563eb",
        backgroundColor: "transparent",
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 3
      },{
        label: "Meta",
        data: [850,700,600,680,1000,1300,1500,1800,1600,1400,1150,950],
        borderColor: "#9fc131",
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [5,5],
        tension: 0.3,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });

  const pieCtx = document.getElementById("pieChart").getContext("2d");
  new Chart(pieCtx, {
    type: "doughnut",
    data: {
      labels: ["HVAC 35%","Lojas 25%","Elevadores 15%","Equipamentos 10%","Iluminação 10%","Área Comum 5%"],
      datasets: [{
        data: [35,25,15,10,10,5],
        backgroundColor: ["#3b82f6","#8b5cf6","#f59e0b","#ef4444","#10b981","#a3e635"]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "right",
          labels: { usePointStyle: true }
        }
      },
      cutout: "70%"
    }
  });
}

// ============================================
// MAIN INITIALIZATION
// ============================================

self.onInit = async function() {
  // ✅ Check active domain
  const currentDomain = window.MyIOOrchestrator?.getActiveDomain?.() || 'energy';

  if (currentDomain !== 'energy') {
    console.log(`[ENERGY] Widget disabled for domain: ${currentDomain}`);
    return;
  }

  console.log("[ENERGY] Initializing energy charts and consumption cards...");

  // Initialize charts with mock data
  initializeCharts();

  // ===== Initialize Cards =====
  initializeTotalConsumptionCard();
  initializePeakDemandCard();

  // ===== TRY TO FETCH INITIAL DATA =====
  // Try to get initial date range from global storage set by MENU widget
  setTimeout(async () => {
    // Try to get from global window object (set by MENU)
    let startDateISO, endDateISO;

    // Option 1: Check if MENU set dates in window
    if (window.myioDateRange?.startDate && window.myioDateRange?.endDate) {
      startDateISO = window.myioDateRange.startDate;
      endDateISO = window.myioDateRange.endDate;
      console.log("[ENERGY] Found dates from window.myioDateRange:", { startDateISO, endDateISO });
    }
    // Option 2: Try localStorage as fallback
    else {
      const storedRange = localStorage.getItem('myio:date-range');
      if (storedRange) {
        try {
          const parsed = JSON.parse(storedRange);
          startDateISO = parsed.startDate;
          endDateISO = parsed.endDate;
          console.log("[ENERGY] Found dates from localStorage:", { startDateISO, endDateISO });
        } catch (e) {
          console.warn("[ENERGY] Failed to parse stored date range:", e);
        }
      }
    }

    if (startDateISO && endDateISO) {
      const startMs = new Date(startDateISO).getTime();
      const endMs = new Date(endDateISO).getTime();

      if (startMs && endMs && !isNaN(startMs) && !isNaN(endMs)) {
        console.log("[ENERGY] Fetching initial peak demand data");
        await updatePeakDemandCard(startMs, endMs);
      } else {
        console.warn("[ENERGY] Invalid date conversion:", { startMs, endMs });
      }
    } else {
      console.log("[ENERGY] No initial dates found, waiting for myio:update-date event");
    }
  }, 1000); // Wait 1s for MENU to initialize and set dates

  // ===== LISTEN FOR CUSTOMER TOTAL CONSUMPTION FROM HEADER =====
  window.addEventListener('myio:customer-total-consumption', (ev) => {
    console.log("[ENERGY] Received customer total consumption from HEADER:", ev.detail);
    // ✅ Store in cache
    totalConsumptionCache.customerTotal = ev.detail.customerTotal || 0;
    updateTotalConsumptionCard();
  });

  // ===== LISTEN FOR ENERGY DATA FROM ORCHESTRATOR =====
  window.addEventListener('myio:energy-data-ready', (ev) => {
    console.log("[ENERGY] Received energy data from orchestrator:", ev.detail);
    const { cache } = ev.detail;

    // ✅ NOTE: We don't call updateTotalConsumptionCard() here to avoid loops
    // The card will be updated when HEADER emits 'myio:customer-total-consumption'
    // This event is only for future chart updates

    // TODO: Update charts with real data when orchestrator sends it
    // updateCharts(cache);
  });

  // ===== LISTEN FOR DATE CHANGES =====
  window.addEventListener('myio:update-date', async (ev) => {
    console.log("[ENERGY] Date range updated:", ev.detail);

    // MENU sends startDate/endDate (ISO strings) or startMs/endMs (timestamps)
    let startMs, endMs;

    if (ev.detail.startMs && ev.detail.endMs) {
      startMs = ev.detail.startMs;
      endMs = ev.detail.endMs;
    } else if (ev.detail.startDate && ev.detail.endDate) {
      // Convert ISO strings to timestamps
      startMs = new Date(ev.detail.startDate).getTime();
      endMs = new Date(ev.detail.endDate).getTime();
    }

    if (startMs && endMs && !isNaN(startMs) && !isNaN(endMs)) {
      console.log("[ENERGY] Fetching peak demand for period:", { startMs, endMs });
      await updatePeakDemandCard(startMs, endMs);
    } else {
      console.warn("[ENERGY] Invalid date range in event:", ev.detail);
    }
  });

  // ===== LISTEN FOR TAB SWITCH TO ENERGY =====
  window.addEventListener('myio:switch-main-state', async (ev) => {
    if (ev.detail?.targetStateId === 'content_energy') {
      console.log("[ENERGY] Energy tab activated, checking for data");

      // Try to fetch data if we have dates from global storage
      if (window.myioDateRange?.startDate && window.myioDateRange?.endDate) {
        const startMs = new Date(window.myioDateRange.startDate).getTime();
        const endMs = new Date(window.myioDateRange.endDate).getTime();

        if (startMs && endMs && !isNaN(startMs) && !isNaN(endMs)) {
          console.log("[ENERGY] Tab activated - fetching peak demand");
          await updatePeakDemandCard(startMs, endMs);
        }
      }
    }
  });

  // ===== LISTEN FOR CACHE CLEAR EVENTS =====
  window.addEventListener('myio:telemetry:clear', (ev) => {
    console.log("[ENERGY] Cache clear event received:", ev.detail);

    // Clear peak demand cache
    peakDemandCache = {
      data: null,
      startTs: null,
      endTs: null,
      timestamp: null
    };

    // Clear total consumption cache
    totalConsumptionCache = {
      data: null,
      customerTotal: 0,
      equipmentsTotal: 0,
      difference: 0,
      timestamp: null
    };

    // Reinitialize cards
    initializeTotalConsumptionCard();
    initializePeakDemandCard();
  });
}
