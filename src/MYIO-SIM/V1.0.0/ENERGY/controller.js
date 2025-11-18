// ============================================
// MYIO-SIM 1.0.0 - ENERGY Widget Controller
// ============================================

// ============================================
// DEBUG FLAGS
// ============================================

/**
 * RFC-0073: Debug flag to use mock data for peak demand
 * Set to true to bypass API calls and return mock data
 */
const MOCK_DEBUG_PEAK_DEMAND = true;

/**
 * RFC-0073: Debug flag to use mock data for day total consumption
 * Set to true to bypass API calls and return mock data for 7-day chart
 */
const MOCK_DEBUG_DAY_CONSUMPTION = true;

// ============================================
// CACHE CONFIGURATION
// ============================================

// Cache para pico de demanda
let peakDemandCache = {
  data: null,
  startTs: null,
  endTs: null,
  timestamp: null,
};

const PEAK_DEMAND_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Cache para consumo total
let totalConsumptionCache = {
  data: null,
  customerTotal: 0,
  equipmentsTotal: 0,
  difference: 0,
  timestamp: null,
};

const TOTAL_CONSUMPTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// ✅ DEBOUNCE: Prevent infinite loops
let isUpdatingTotalConsumption = false;

// ============================================
// MOCK DATA GENERATORS (RFC-0073)
// ============================================

/**
 * RFC-0073: Generate mock peak demand data for testing
 * @param {string} customerId - Customer ID (used for deterministic mock selection)
 * @returns {Object} Mock peak demand object
 */
function generateMockPeakDemand(customerId) {
  const mockPeakValues = [
    { value: 1250.5, device: "Chiller Principal - Torre Norte", shopping: "Shopping Iguatemi SP" },
    { value: 980.3, device: "HVAC Central - Piso 2", shopping: "Shopping Eldorado" },
    { value: 1450.7, device: "Ar Condicionado - Food Court", shopping: "Shopping JK Iguatemi" },
    { value: 720.2, device: "Sistema Climatização - Ala A", shopping: "Shopping Villa Lobos" },
    { value: 1100.0, device: "Chiller Backup - Subsolo", shopping: "Shopping Morumbi" }
  ];

  // Select mock based on customerId (deterministic)
  const mockIndex = customerId
    ? Math.abs(customerId.charCodeAt(0)) % mockPeakValues.length
    : 0;

  const selectedMock = mockPeakValues[mockIndex];

  // Generate timestamp (recent, within last hour)
  const now = Date.now();
  const mockTimestamp = now - Math.floor(Math.random() * 3600000); // Random within last hour

  return {
    peakValue: selectedMock.value,
    deviceName: selectedMock.device,
    timestamp: mockTimestamp,
    deviceId: `mock-device-${mockIndex}`,
    customerId: customerId || null,
    shoppingName: selectedMock.shopping
  };
}

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
    timestamp: Date.now(),
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
function cacheTotalConsumption(
  customerTotal,
  equipmentsTotal,
  difference,
  percentage,
  deviceCount
) {
  totalConsumptionCache = {
    data: {
      customerTotal,
      equipmentsTotal,
      difference,
      percentage,
      deviceCount,
    },
    customerTotal,
    equipmentsTotal,
    difference,
    timestamp: Date.now(),
  };
  console.log(
    "[ENERGY] Total consumption data cached:",
    totalConsumptionCache.data
  );
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

  ctxData.forEach((data) => {
    // Skip customer/shopping entries
    if (data.datasource?.aliasName === "Shopping") {
      return;
    }

    const entityId =
      data.datasource?.entityId?.id || data.datasource?.entity?.id?.id;
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

  const deviceData = self.ctx.data.find((d) => {
    const id = d.datasource?.entityId?.id || d.datasource?.entity?.id?.id;
    return id === deviceId;
  });

  return (
    deviceData?.datasource?.entityLabel ||
    deviceData?.datasource?.entityName ||
    deviceData?.datasource?.name ||
    null
  );
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
  // RFC-0073: Check mock flag first
  if (MOCK_DEBUG_PEAK_DEMAND) {
    console.log("[ENERGY] [RFC-0073] [MOCK] fetchCustomerPeakDemand bypassed - using mock");
    return generateMockPeakDemand(customerId);
  }

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
      const result = {
        peakValue: 0,
        timestamp: Date.now(),
        deviceId: null,
        deviceName: "Sem devices",
      };
      cachePeakDemand(result, startTs, endTs);
      return result;
    }

    console.log(`[ENERGY] Fetching peak demand for ${devices.length} devices`);

    const peakResults = [];

    // Iterate through each device
    for (const deviceId of devices) {
      try {
        // Build URL with power and demand keys
        const url =
          `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?` +
          `keys=power,demand,consumption&startTs=${startTs}&endTs=${endTs}&agg=MAX&limit=1`;

        const response = await fetch(url, {
          headers: {
            "X-Authorization": `Bearer ${tbToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.warn(
            `[ENERGY] Failed to fetch demand for device ${deviceId}: ${response.status}`
          );
          continue;
        }

        const data = await response.json();

        // Data format: { "power": [{ts: 123, value: 456}], "demand": [...], "consumption": [...] }
        const powerData = data.power || [];
        const demandData = data.demand || [];
        const consumptionData = data.consumption || [];

        // Collect all peak values from different keys
        if (powerData.length > 0) {
          peakResults.push({
            deviceId,
            value: Number(powerData[0].value) || 0, // ✅ Convert to number
            timestamp: powerData[0].ts,
            key: "power",
          });
        }

        if (demandData.length > 0) {
          peakResults.push({
            deviceId,
            value: Number(demandData[0].value) || 0, // ✅ Convert to number
            timestamp: demandData[0].ts,
            key: "demand",
          });
        }

        if (consumptionData.length > 0) {
          peakResults.push({
            deviceId,
            value: Number(consumptionData[0].value) || 0, // ✅ Convert to number
            timestamp: consumptionData[0].ts,
            key: "consumption",
          });
        }
      } catch (err) {
        console.error(
          `[ENERGY] Error fetching demand for device ${deviceId}:`,
          err
        );
        // Continue to next device
      }
    }

    // Encontrar o maior pico entre todos os devices
    if (peakResults.length === 0) {
      console.log("[ENERGY] No peak data found across all devices");
      const result = {
        peakValue: 0,
        timestamp: Date.now(),
        deviceId: null,
        deviceName: "Sem dados",
      };
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
      peakValue: Number(maxPeak.value) || 0, // ✅ Convert to number
      timestamp: maxPeak.timestamp,
      deviceId: maxPeak.deviceId,
      deviceName: deviceName || "Desconhecido",
    };

    console.log("[ENERGY] Peak demand result:", result);

    // Cache the result
    cachePeakDemand(result, startTs, endTs);

    return result;
  } catch (err) {
    console.error(`[ENERGY] Error fetching customer peak demand:`, err);

    // Return fallback result
    const result = {
      peakValue: 0,
      timestamp: Date.now(),
      deviceId: null,
      deviceName: "Erro",
    };
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
        direction: "neutral",
        percentChange: 0,
        label: "—",
      };
    }

    const previousPeak = await fetchCustomerPeakDemand(
      customerId,
      previousStartTs,
      previousEndTs
    );

    if (!previousPeak || previousPeak.peakValue === 0) {
      return {
        direction: "neutral",
        percentChange: 0,
        label: "— sem dados anteriores",
      };
    }

    const percentChange =
      ((currentPeak - previousPeak.peakValue) / previousPeak.peakValue) * 100;

    return {
      direction:
        percentChange > 0 ? "up" : percentChange < 0 ? "down" : "neutral",
      percentChange: Math.abs(percentChange),
      label:
        percentChange > 0
          ? `▲ +${percentChange.toFixed(1)}% vs período anterior`
          : percentChange < 0
          ? `▼ ${percentChange.toFixed(1)}% vs período anterior`
          : "— sem alteração",
    };
  } catch (error) {
    console.error("[ENERGY] Error calculating peak trend:", error);
    return {
      direction: "neutral",
      percentChange: 0,
      label: "— erro no cálculo",
    };
  }
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

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

  const lojasPercentage = totalGeral > 0 ? ((lojasTotal / totalGeral) * 100) : 0;
  const lojasFormatted = MyIOLibrary.formatEnergy(lojasTotal);

  if (valueEl) {
    valueEl.textContent = lojasFormatted;
  }

  if (trendEl) {
    trendEl.textContent = `${lojasPercentage.toFixed(1)}% do total`;
    trendEl.className = "trend neutral";
  }

  if (infoEl) {
    infoEl.textContent = "Apenas lojas";
  }

  console.log("[ENERGY] Card de Lojas atualizado:", { lojasTotal, lojasFormatted, lojasPercentage });
}

/**
 * Renderiza a UI do card de consumo de EQUIPAMENTOS
 * @param {object} energyData - O objeto de resumo completo vindo do MAIN.
 */
function renderTotalConsumptionEquipmentsUI(energyData, valueEl, trendEl, infoEl) {
  if (!energyData) return;

  const totalGeral = energyData.customerTotal;
  const equipamentosTotal = energyData.equipmentsTotal;

  const equipamentosPercentage = totalGeral > 0 ? ((equipamentosTotal / totalGeral) * 100) : 0;
  const equipamentosFormatted = MyIOLibrary.formatEnergy(equipamentosTotal);

  if (valueEl) {
    valueEl.textContent = equipamentosFormatted;
  }

  if (trendEl) {
    trendEl.textContent = `${equipamentosPercentage.toFixed(1)}% do total`;
    trendEl.className = "trend neutral";
  }

  if (infoEl) {
    infoEl.textContent = "Elevadores, escadas, HVAC, etc.";
  }

  console.log("[ENERGY] Card de Equipamentos atualizado:", { equipamentosTotal, equipamentosFormatted, equipamentosPercentage });
}

/**
 * DEPRECATED: Renderiza a UI do card de consumo usando os dados do pacote de resumo.
 * @param {object} energyData - O objeto de resumo completo vindo do MAIN.
 */
function renderTotalConsumptionUI(energyData, valueEl, trendEl, infoEl) {
  if (!energyData) return;

  // RFC-0073: Calculate percentages for Lojas vs Equipamentos
  const totalGeral = energyData.customerTotal;
  const lojasTotal = energyData.difference;
  const equipamentosTotal = energyData.equipmentsTotal;

  const lojasPercentage = totalGeral > 0 ? ((lojasTotal / totalGeral) * 100) : 0;
  const equipamentosPercentage = totalGeral > 0 ? ((equipamentosTotal / totalGeral) * 100) : 0;

  // RFC-0073: Main value shows "Consumo Total Lojas" with percentage
  const lojasFormatted = MyIOLibrary.formatEnergy(lojasTotal);

  if (valueEl) {
    valueEl.textContent = `${lojasFormatted} (${lojasPercentage.toFixed(1)}%)`;
  }

  // RFC-0073: Info line shows "Equipamentos: XX%"
  if (infoEl) {
    infoEl.textContent = `Equipamentos: ${equipamentosPercentage.toFixed(1)}%`;
  }

  // RFC-0073: Trend line shows total context
  if (trendEl && totalGeral > 0) {
    const totalFormatted = MyIOLibrary.formatEnergy(totalGeral);
    trendEl.textContent = `Total geral: ${totalFormatted}`;
  }
}

/**
 * Inicializa o card de consumo total de LOJAS com estado de loading
 */
function initializeTotalConsumptionStoresCard() {
  const valueEl = document.getElementById("total-consumption-stores-value");
  const trendEl = document.getElementById("total-consumption-stores-trend");
  const infoEl = document.getElementById("total-consumption-stores-info");

  // ✅ Try to use cache first
  const cached = getCachedTotalConsumption();

  if (cached) {
    console.log("[ENERGY] Initializing STORES card with cached data");
    renderTotalConsumptionStoresUI(cached, valueEl, trendEl, infoEl);
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

  console.log("[ENERGY] Stores consumption card initialized with loading state");
}

/**
 * Inicializa o card de consumo total de EQUIPAMENTOS com estado de loading
 */
function initializeTotalConsumptionEquipmentsCard() {
  const valueEl = document.getElementById("total-consumption-equipments-value");
  const trendEl = document.getElementById("total-consumption-equipments-trend");
  const infoEl = document.getElementById("total-consumption-equipments-info");

  // ✅ Try to use cache first
  const cached = getCachedTotalConsumption();

  if (cached) {
    console.log("[ENERGY] Initializing EQUIPMENTS card with cached data");
    renderTotalConsumptionEquipmentsUI(cached, valueEl, trendEl, infoEl);
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

  console.log("[ENERGY] Equipments consumption card initialized with loading state");
}

/**
 * Atualiza o card de consumo total de LOJAS
 * @param {object} summary - O objeto de resumo calculado pelo widget MAIN.
 */
function updateTotalConsumptionStoresCard(summary) {
  console.log("[ENERGY] Atualizando card de consumo de LOJAS:", summary);

  if (!summary) return;

  const valueEl = document.getElementById("total-consumption-stores-value");
  const trendEl = document.getElementById("total-consumption-stores-trend");
  const infoEl = document.getElementById("total-consumption-stores-info");

  renderTotalConsumptionStoresUI(summary, valueEl, trendEl, infoEl);
}

/**
 * Atualiza o card de consumo total de EQUIPAMENTOS
 * @param {object} summary - O objeto de resumo calculado pelo widget MAIN.
 */
function updateTotalConsumptionEquipmentsCard(summary) {
  console.log("[ENERGY] Atualizando card de consumo de EQUIPAMENTOS:", summary);

  if (!summary) return;

  const valueEl = document.getElementById("total-consumption-equipments-value");
  const trendEl = document.getElementById("total-consumption-equipments-trend");
  const infoEl = document.getElementById("total-consumption-equipments-info");

  renderTotalConsumptionEquipmentsUI(summary, valueEl, trendEl, infoEl);
}

/**
 * DEPRECATED: Inicializa o card de consumo total com estado de loading
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
 * DEPRECATED: Apenas chama a função que desenha o card na tela.
 * @param {object} summary - O objeto de resumo calculado pelo widget MAIN.
 */
function updateTotalConsumptionCard(summary) {
  console.log(
    "[ENERGY] Atualizando card de consumo total com dados recebidos: >>>>>>>>>>>>>>>>>>>>>>>",
    summary
  );

  if (!summary) {
    return; // Não faz nada se não houver dados
  }

  const valueEl = document.getElementById("total-consumption-value");
  const trendEl = document.getElementById("total-consumption-trend");
  const infoEl = document.getElementById("total-consumption-info");

  // A única responsabilidade desta função é chamar a que renderiza a UI.
  renderTotalConsumptionUI(summary, valueEl, trendEl, infoEl);
}

/**
 * DESABILITADO TEMPORARIAMENTE: Inicializa o card de pico de demanda com estado de loading
 */
/*
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
*/

/**
 * RFC-0073: Get selected shopping IDs from filter
 */
function getSelectedShoppingIds() {
  // Check if there are selected customers from MENU filter
  if (window.custumersSelected && Array.isArray(window.custumersSelected)) {
    const selectedIds = window.custumersSelected
      .filter(c => c.selected === true)
      .map(c => c.value);

    if (selectedIds.length > 0) {
      console.log("[ENERGY] [RFC-0073] Using filtered shopping IDs:", selectedIds);
      return selectedIds;
    }
  }

  // Fallback: return empty array (will use widget's customerId)
  console.log("[ENERGY] [RFC-0073] No shopping filter active, using widget customerId");
  return [];
}

/**
 * RFC-0073: Fetch peak demand for multiple customers (respects shopping filter)
 */
async function fetchFilteredPeakDemand(customerIds, startTs, endTs) {
  // RFC-0073: Debug mock data
  if (MOCK_DEBUG_PEAK_DEMAND) {
    console.log("[ENERGY] [RFC-0073] [MOCK] Using mock peak demand data");

    // Generate mock data based on number of customers
    const mockPeakValues = [
      { value: 1250.5, device: "Chiller Principal - Torre Norte", shopping: "Shopping Iguatemi SP" },
      { value: 980.3, device: "HVAC Central - Piso 2", shopping: "Shopping Eldorado" },
      { value: 1450.7, device: "Ar Condicionado - Food Court", shopping: "Shopping JK Iguatemi" },
      { value: 720.2, device: "Sistema Climatização - Ala A", shopping: "Shopping Villa Lobos" },
      { value: 1100.0, device: "Chiller Backup - Subsolo", shopping: "Shopping Morumbi" }
    ];

    // Select random mock based on customerIds
    const mockIndex = customerIds.length > 0
      ? Math.abs(customerIds[0].charCodeAt(0)) % mockPeakValues.length
      : 0;

    const selectedMock = mockPeakValues[mockIndex];

    // Calculate a timestamp within the requested period
    const mockTimestamp = startTs + Math.floor((endTs - startTs) * 0.6); // 60% into period

    return {
      peakValue: selectedMock.value,
      deviceName: selectedMock.device,
      timestamp: mockTimestamp,
      customerId: customerIds[0] || null,
      shoppingName: selectedMock.shopping
    };
  }

  if (!customerIds || customerIds.length === 0) {
    return { peakValue: 0, deviceName: null, timestamp: null };
  }

  console.log("[ENERGY] [RFC-0073] Fetching peak demand for customers:", customerIds);

  // Fetch peak demand for each customer and find the highest
  const peakPromises = customerIds.map(customerId =>
    fetchCustomerPeakDemand(customerId, startTs, endTs)
  );

  const allPeaks = await Promise.all(peakPromises);

  // Find the overall peak across all customers
  const overallPeak = allPeaks.reduce((highest, current) => {
    if (!current || current.peakValue === 0) return highest;
    if (!highest || current.peakValue > highest.peakValue) return current;
    return highest;
  }, null);

  console.log("[ENERGY] [RFC-0073] Overall peak across filtered customers:", overallPeak);

  return overallPeak || { peakValue: 0, deviceName: null, timestamp: null };
}

/**
 * DESABILITADO TEMPORARIAMENTE: Atualiza o card de pico de demanda com dados reais
 * RFC-0073: Now respects shopping filters
 */
/*
async function updatePeakDemandCard(startTs, endTs) {
  const valueEl = document.getElementById("peak-demand-value");
  const trendEl = document.getElementById("peak-demand-trend");
  const deviceEl = document.getElementById("peak-demand-device");

  try {
    console.log("[ENERGY] [RFC-0073] Fetching peak demand data...", { startTs, endTs });

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

    // RFC-0073: Get filtered shopping IDs or use widget's customerId
    const selectedShoppingIds = getSelectedShoppingIds();
    const customerIds = selectedShoppingIds.length > 0
      ? selectedShoppingIds
      : [customerId];

    // RFC-0073: Fetch peak demand respecting filters
    const peakData = await fetchFilteredPeakDemand(customerIds, startTs, endTs);

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
    const peakValueFormatted =
      peakData.peakValue >= 1000
        ? `${(peakData.peakValue / 1000).toFixed(3)} MW`
        : `${peakData.peakValue.toFixed(0)} kW`;

    // Update value
    if (valueEl) {
      valueEl.textContent = peakValueFormatted;
    }

    // Calculate and update trend
    const trendData = await calculatePeakTrend(
      peakData.peakValue,
      startTs,
      endTs
    );

    if (trendEl) {
      trendEl.textContent = trendData.label;
      trendEl.className = `trend ${trendData.direction}`;
    }

    // Update device info
    if (deviceEl && peakData.deviceName) {
      const peakDate = new Date(peakData.timestamp);
      const peakTime = peakDate.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
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
*/

// ============================================
// CHART FUNCTIONS
// ============================================

// Global chart references for later updates
let lineChartInstance = null;
let pieChartInstance = null;

/**
 * Classifica o tipo de equipamento baseado no deviceType e label
 * Similar à lógica em EQUIPMENTS
 */
function classifyEquipmentType(device) {
  const deviceType = device.deviceType || "";
  const label = String(device.labelOrName || device.label || "").toLowerCase();

  console.log(`[ENERGY] Classifying device:`, { deviceType, label });

  // Lojas: 3F_MEDIDOR que não são equipamentos
  if (deviceType === "3F_MEDIDOR") {
    const equipmentKeywords = ["elevador", "chiller", "bomba", "escada", "casa de m"];
    const isEquipment = equipmentKeywords.some(keyword => label.includes(keyword));
    if (!isEquipment) {
      console.log(`[ENERGY] Classified as Lojas (3F_MEDIDOR without equipment keywords)`);
      return "Lojas";
    }
  }

  // Classificação por tipo de equipamento
  if (label.includes("chiller")) {
    console.log(`[ENERGY] Classified as Chiller`);
    return "Chiller";
  }
  if (label.includes("fancoil") || label.includes("fan coil") || label.includes("fan-coil")) {
    console.log(`[ENERGY] Classified as Fancoil`);
    return "Fancoil";
  }
  if (label.includes("ar condicionado") || label.includes("ar-condicionado") || label.includes("split") || label.includes(" ar ")) {
    console.log(`[ENERGY] Classified as AR`);
    return "AR";
  }
  if (label.includes("bomba")) {
    console.log(`[ENERGY] Classified as Bombas`);
    return "Bombas";
  }
  if (label.includes("elevador") || label.includes("escada")) {
    console.log(`[ENERGY] Classified as Elevadores`);
    return "Elevadores";
  }

  // Outros equipamentos
  console.log(`[ENERGY] Classified as Outros (no match found)`);
  return "Outros";
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

    console.log(`[ENERGY] [MOCK] Day total (${dayDate.toLocaleDateString()}): ${mockConsumption.toFixed(2)} kWh`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));

    return mockConsumption;
  }

  const tbToken = localStorage.getItem("jwt_token");

  if (!tbToken) {
    console.error("[ENERGY] JWT token not found");
    return 0;
  }

  try {
    const url = `/api/v1/telemetry/customers/${customerId}/energy/devices/totals?startTime=${startTs}&endTime=${endTs}`;

    const response = await fetch(url, {
      headers: {
        "X-Authorization": `Bearer ${tbToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[ENERGY] Failed to fetch day total: ${response.status}`);
      return 0;
    }

    const data = await response.json();

    // Sum all device consumption
    let total = 0;
    if (Array.isArray(data)) {
      data.forEach(device => {
        total += Number(device.total_value) || 0;
      });
    }

    console.log(`[ENERGY] Day total (${new Date(startTs).toLocaleDateString()}): ${total} kWh`);
    return total;
  } catch (error) {
    console.error("[ENERGY] Error fetching day total:", error);
    return 0;
  }
}

/**
 * Busca o consumo dos últimos 7 dias
 * @param {string} customerId - ID do customer
 * @returns {Promise<Array>} - Array com {date, consumption} para cada dia
 */
async function fetch7DaysConsumption(customerId) {
  const results = [];
  const now = new Date();

  // Iterate through last 7 days
  for (let i = 6; i >= 0; i--) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() - i);
    dayDate.setHours(0, 0, 0, 0);

    const startTs = dayDate.getTime();
    const endDate = new Date(dayDate);
    endDate.setHours(23, 59, 59, 999);
    const endTs = endDate.getTime();

    const consumption = await fetchDayTotalConsumption(customerId, startTs, endTs);

    results.push({
      date: dayDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      consumption: consumption,
    });
  }

  console.log("[ENERGY] 7 days consumption data:", results);
  return results;
}

/**
 * Calcula a distribuição de consumo por tipo de equipamento
 * Usa o cache do orchestrador + classificação por tipo
 */
async function calculateEquipmentDistribution() {
  try {
    // Get energy cache from orchestrator
    const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;

    if (!orchestrator || typeof orchestrator.getEnergyCache !== 'function') {
      console.warn("[ENERGY] Orchestrator not available for distribution calculation");
      return null;
    }

    const energyCache = orchestrator.getEnergyCache();

    if (!energyCache || energyCache.size === 0) {
      console.warn("[ENERGY] Energy cache is empty");
      return null;
    }

    console.log(`[ENERGY] Energy cache has ${energyCache.size} devices`);
    console.log("[ENERGY] ctx.data available:", !!self.ctx?.data, "entries:", self.ctx?.data?.length);

    // Initialize counters
    const distribution = {
      Chiller: 0,
      Fancoil: 0,
      AR: 0,
      Bombas: 0,
      Lojas: 0,
      Elevadores: 0,
      Outros: 0,
    };

    let devicesProcessed = 0;
    let devicesNotFound = 0;

    // Classify each device and sum consumption
    energyCache.forEach((deviceData, ingestionId) => {
      devicesProcessed++;
      const consumption = Number(deviceData.total_value) || 0;

      console.log(`[ENERGY] Processing device ${devicesProcessed}/${energyCache.size}, ingestionId: ${ingestionId}, consumption: ${consumption}`);

      // Get device info from ctx.data to classify
      const device = findDeviceInCtx(ingestionId);

      if (!device) {
        devicesNotFound++;
        console.warn(`[ENERGY] Device not found in ctx for ingestionId: ${ingestionId}, adding to Outros`);
        distribution.Outros += consumption;
        return;
      }

      const type = classifyEquipmentType(device);
      distribution[type] = (distribution[type] || 0) + consumption;
      console.log(`[ENERGY] Added ${consumption} kWh to ${type}, new total: ${distribution[type]}`);
    });

    console.log("[ENERGY] Distribution calculation complete:");
    console.log(`[ENERGY] - Devices processed: ${devicesProcessed}`);
    console.log(`[ENERGY] - Devices not found in ctx: ${devicesNotFound}`);
    console.log("[ENERGY] Equipment distribution:", distribution);

    return distribution;
  } catch (error) {
    console.error("[ENERGY] Error calculating equipment distribution:", error);
    return null;
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
  let deviceType = (device.deviceType || "").toUpperCase();
  const deviceProfile = (device.deviceProfile || "").toUpperCase();
  const identifier = (device.deviceIdentifier || device.name || "").toUpperCase();
  const labelOrName = (device.labelOrName || device.label || device.name || "").toUpperCase();

  // RFC-0076: REGRA 1: Se é 3F_MEDIDOR e tem deviceProfile válido, usa o deviceProfile como deviceType
  if (deviceType === "3F_MEDIDOR" && deviceProfile && deviceProfile !== "N/D") {
    deviceType = deviceProfile;
  }

  // RFC-0076: REGRA 2 (CRITICAL FIX): Se deviceType está vazio mas há deviceProfile, usa deviceProfile
  if (!deviceType && deviceProfile && deviceProfile !== "N/D") {
    deviceType = deviceProfile;
  }

  // RFC-0076: Priority 1 - ELEVATORS
  // Check deviceType first (now includes deviceProfile!), then fallback to name patterns
  if (deviceType === "ELEVADOR" || deviceType === "ELEVATOR") {
    return "Elevadores";
  }
  // Fallback: Check name patterns for elevators
  if (labelOrName.includes("ELEVADOR") || labelOrName.includes("ELEVATOR") ||
      labelOrName.includes(" ELV") || labelOrName.includes("ELV ") ||
      (labelOrName.includes("ELV.") && !labelOrName.includes("ESRL"))) {
    return "Elevadores";
  }

  // RFC-0076: Priority 2 - ESCALATORS
  // Check deviceType first, then fallback to name patterns
  if (deviceType === "ESCADA_ROLANTE" || deviceType === "ESCALATOR") {
    return "Escadas Rolantes";
  }
  // Fallback: Check name patterns for escalators
  if (labelOrName.includes("ESCADA") || labelOrName.includes("ESCALATOR") ||
      labelOrName.includes("ESRL") || labelOrName.includes("ESC.ROL")) {
    return "Escadas Rolantes";
  }

  // RFC-0076: Priority 3 - CLIMATIZAÇÃO (HVAC)
  // Check for CAG in identifier or labelOrName (same as EQUIPMENTS widget)
  const hasCAG = identifier.includes('CAG') || labelOrName.includes('CAG');

  const hvacTypes = ["CHILLER", "FANCOIL", "AR_CONDICIONADO", "AC", "HVAC", "BOMBA"];
  const hvacNamePatterns = labelOrName.includes("FANCOIL") || labelOrName.includes("CHILLER") ||
                           labelOrName.includes("CAG") || labelOrName.includes("HVAC") ||
                           labelOrName.includes("BOMBA") || labelOrName.includes("AR COND") ||
                           labelOrName.includes("MOTR");

  if (hasCAG || hvacTypes.includes(deviceType) || hvacNamePatterns) {
    return "Climatização";
  }

  // RFC-0076: Default - Everything else is "Outros Equipamentos"
  // This includes: MOTOR and any other equipment type
  return "Outros Equipamentos";
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
      console.warn("[ENERGY] Orchestrator not available");
      return null;
    }

    const energyCache = orchestrator.getEnergyCache();

    if (!energyCache || energyCache.size === 0) {
      console.warn("[ENERGY] Energy cache is empty");
      return null;
    }

    console.log(`[ENERGY] Calculating distribution for mode: ${mode}`);

    const distribution = {};

    if (mode === "groups") {
      // Por grupos de equipamentos (padrão)
      const groups = {
        "Elevadores": 0,
        "Escadas Rolantes": 0,
        "Climatização": 0,
        "Outros Equipamentos": 0,
        "Lojas": 0
      };

      // RFC-0076: Device counters for debugging
      const deviceCounters = {
        "Elevadores": 0,
        "Escadas Rolantes": 0,
        "Climatização": 0,
        "Outros Equipamentos": 0,
        "Lojas": 0
      };

      // Get lojas IDs from orchestrator (same logic as MAIN uses)
      const lojasIngestionIds = orchestrator.getLojasIngestionIds?.() || new Set();
      console.log(`[ENERGY] Using lojasIngestionIds from orchestrator: ${lojasIngestionIds.size} lojas`);

      let sampleCount = 0;
      energyCache.forEach((deviceData, ingestionId) => {
        const consumption = Number(deviceData.total_value) || 0;

        // Priority 1: Check if it's a LOJA (using same logic as MAIN)
        if (lojasIngestionIds.has(ingestionId)) {
          groups["Lojas"] += consumption;
          deviceCounters["Lojas"]++;

          if (sampleCount < 10) {
            console.log(`[ENERGY] 🔍 Device classification sample #${sampleCount + 1}:`, {
              name: deviceData.name,
              ingestionId: ingestionId,
              classified: "Lojas (from lojasIngestionIds)",
              consumption: consumption
            });
            sampleCount++;
          }
          return; // Skip further classification
        }

        // RFC-0076: Priority 2: Classify EQUIPMENTS (everything that's not a loja)
        const label = String(deviceData.label || deviceData.entityLabel || deviceData.entityName || deviceData.name || "").toLowerCase();

        // RFC-0076: CRITICAL FIX - Get metadata from energyCache deviceData
        // The energyCache should have all fields from ThingsBoard entity
        const device = {
          deviceType: deviceData.deviceType || deviceData.type || "",
          deviceProfile: deviceData.deviceProfile || deviceData.additionalInfo?.deviceProfile || "",
          deviceIdentifier: deviceData.deviceIdentifier || deviceData.additionalInfo?.deviceIdentifier || deviceData.name || "",
          name: deviceData.name || deviceData.entityName || "",
          labelOrName: label,
          label: label
        };

        const type = classifyEquipmentDetailed(device);
        groups[type] = (groups[type] || 0) + consumption;
        deviceCounters[type] = (deviceCounters[type] || 0) + 1;

        // RFC-0076: Enhanced logging - Log ALL devices that could be elevators
        const couldBeElevator = (deviceData.deviceType === "3F_MEDIDOR" || deviceData.type === "3F_MEDIDOR") ||
                                (deviceData.deviceType === "ELEVADOR" || deviceData.type === "ELEVADOR") ||
                                (deviceData.deviceProfile && deviceData.deviceProfile.toUpperCase() === "ELEVADOR") ||
                                (deviceData.additionalInfo?.deviceProfile && deviceData.additionalInfo.deviceProfile.toUpperCase() === "ELEVADOR") ||
                                (deviceData.name && deviceData.name.toUpperCase().includes("ELV"));

        // RFC-0076: Log first 30 devices for debugging (increased from 10)
        if (sampleCount < 30 || couldBeElevator) {
          console.log(`[ENERGY] 🔍 Device classification ${couldBeElevator ? '⚡ ELEVATOR CANDIDATE' : 'sample'} #${sampleCount + 1}:`, {
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
              hasELV: label.toUpperCase().includes("ELV"),
              hasELEVADOR: label.toUpperCase().includes("ELEVADOR"),
              hasESRL: label.toUpperCase().includes("ESRL"),
              hasESCADA: label.toUpperCase().includes("ESCADA"),
              hasCAG: (deviceData.name || "").toUpperCase().includes('CAG') || label.toUpperCase().includes('CAG'),
              hasMOTR: label.toUpperCase().includes("MOTR")
            }
          });
          if (!couldBeElevator) sampleCount++;
        }

        // RFC-0076: Log Elevadores and Escadas Rolantes specifically
        if (type === "Elevadores" || type === "Escadas Rolantes") {
          console.log(`[ENERGY] ✅ Found ${type}:`, {
            name: deviceData.name,
            deviceType: deviceData.deviceType,
            deviceProfile: deviceData.deviceProfile,
            consumption: consumption,
            classifiedBy: "name-pattern"
          });
        }
      });

      // RFC-0076: Enhanced logging for debugging
      console.log("[ENERGY] ============================================");
      console.log("[ENERGY] Distribution by groups (RFC-0076):");
      console.log("[ENERGY] - Total devices processed:", energyCache.size);
      console.log("[ENERGY] - Lojas from orchestrator:", lojasIngestionIds.size);
      console.log("[ENERGY] Device counts by category:");
      Object.entries(deviceCounters).forEach(([cat, count]) => {
        console.log(`[ENERGY]   - ${cat}: ${count} devices, ${groups[cat].toFixed(2)} kWh`);
      });
      console.log("[ENERGY] Distribution breakdown (consumption):", groups);

      // RFC-0076: Warning and diagnostic info if no elevators found
      if (deviceCounters["Elevadores"] === 0) {
        console.warn("[ENERGY] ⚠️  No elevators detected in energyCache. Possible causes:");
        console.warn("[ENERGY]     1. Elevators may not have energy measurement devices");
        console.warn("[ENERGY]     2. Elevator devices may not be included in /energy/devices/totals API");
        console.warn("[ENERGY]     3. deviceType/deviceProfile metadata may be missing from energyCache");
        console.warn("[ENERGY]     4. Elevator naming convention may differ from expected patterns");
        console.warn("[ENERGY]     Expected patterns: 'ELEVADOR', 'ELEVATOR', 'ELV' in device name/label");

        // Print sample of "Outros Equipamentos" to help identify misclassified elevators
        console.log("[ENERGY] 📋 Sample of 'Outros Equipamentos' (first 20 devices):");
        let othersCount = 0;
        energyCache.forEach((deviceData, ingestionId) => {
          if (!lojasIngestionIds.has(ingestionId) && othersCount < 20) {
            const label = String(deviceData.label || deviceData.entityLabel || deviceData.entityName || deviceData.name || "").toLowerCase();
            const device = {
              deviceType: deviceData.deviceType || "",
              deviceProfile: deviceData.deviceProfile || "",
              deviceIdentifier: deviceData.deviceIdentifier || "",
              name: deviceData.name || "",
              labelOrName: label,
              label: label
            };
            const classification = classifyEquipmentDetailed(device);
            if (classification === "Outros Equipamentos") {
              console.log(`[ENERGY]    - "${deviceData.name || label}" (deviceType: ${device.deviceType}, profile: ${device.deviceProfile})`);
              othersCount++;
            }
          }
        });
      }

      console.log("[ENERGY] ============================================");

      return groups;
    } else {
      // Por shopping para tipo específico
      let equipmentType;
      switch (mode) {
        case "elevators": equipmentType = "Elevadores"; break;
        case "escalators": equipmentType = "Escadas Rolantes"; break;
        case "hvac": equipmentType = "Climatização"; break;
        case "others": equipmentType = "Outros Equipamentos"; break;
        case "stores": equipmentType = "Lojas"; break;
        default: equipmentType = "Elevadores";
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
          type = "Lojas";
        } else {
          // Classify equipment (includes deviceProfile, deviceIdentifier and name)
          const label = String(deviceData.label || deviceData.entityLabel || deviceData.entityName || deviceData.name || "").toLowerCase();
          const device = {
            deviceType: deviceData.deviceType || "",
            deviceProfile: deviceData.deviceProfile || "",
            deviceIdentifier: deviceData.deviceIdentifier || "",
            name: deviceData.name || "",
            labelOrName: label,
            label: label
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
    console.error("[ENERGY] Error calculating distribution by mode:", error);
    return null;
  }
}

/**
 * Obtém o nome do shopping pelo customerId
 */
function getShoppingName(customerId) {
  if (!customerId) return "Sem Shopping";

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
    const shopping = window.custumersSelected.find(c => c.value === customerId);
    if (shopping) return shopping.name;
  }

  // Priority 3: Tentar buscar do ctx
  if (self.ctx.$scope?.custumer && Array.isArray(self.ctx.$scope.custumer)) {
    const shopping = self.ctx.$scope.custumer.find(c => c.value === customerId);
    if (shopping) return shopping.name;
  }

  // Fallback
  return `Shopping ${customerId.substring(0, 8)}...`;
}

/**
 * Encontra o device no ctx.data pelo ingestionId
 */
function findDeviceInCtx(ingestionId) {
  if (!self.ctx || !Array.isArray(self.ctx.data)) {
    console.warn("[ENERGY] ctx or ctx.data not available");
    return null;
  }

  // Search in ctx.data for matching ingestionId
  for (const data of self.ctx.data) {
    const deviceIngestionId = data.datasource?.ingestionId;
    const deviceType = data.datasource?.deviceType;
    const entityLabel = data.datasource?.entityLabel;
    const entityName = data.datasource?.entityName;
    const name = data.datasource?.name;
    const label = entityLabel || entityName || name || "";

    if (deviceIngestionId === ingestionId) {
      console.log(`[ENERGY] Found device for ingestionId ${ingestionId}:`, {
        deviceType,
        label,
        entityLabel,
        entityName,
        name
      });
      return {
        ingestionId: deviceIngestionId,
        deviceType: deviceType,
        labelOrName: label,
        label: label,
      };
    }
  }

  console.warn(`[ENERGY] Device not found in ctx for ingestionId: ${ingestionId}`);
  return null;
}

/**
 * Inicializa os gráficos com dados reais
 */
async function initializeCharts() {
  console.log("[ENERGY] Initializing charts with real data...");

  // Get customer ID
  const customerId = self.ctx?.settings?.customerId;

  if (!customerId) {
    console.error("[ENERGY] Customer ID not found, using mock data");
    initializeMockCharts();
    return;
  }

  console.log("[ENERGY] Customer ID:", customerId);

  // Initialize line chart with 7 days data
  const lineCtx = document.getElementById("lineChart").getContext("2d");

  // Show loading state
  lineChartInstance = new Chart(lineCtx, {
    type: "line",
    data: {
      labels: ["Carregando..."],
      datasets: [{
        label: "Consumo (kWh)",
        data: [0],
        borderColor: "#2563eb",
        backgroundColor: "transparent",
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.parsed.y || 0;
              if (val >= 1000) {
                return `Consumo: ${(val / 1000).toFixed(2)} MWh`;
              }
              return `Consumo: ${val.toFixed(2)} kWh`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(1)} MWh`;
              }
              return `${value.toFixed(0)} kWh`;
            }
          }
        }
      }
    },
  });

  // Initialize bar chart with loading state
  const pieCtx = document.getElementById("pieChart").getContext("2d");
  pieChartInstance = new Chart(pieCtx, {
    type: "bar",
    data: {
      labels: ["Carregando..."],
      datasets: [{
        label: "Consumo (kWh)",
        data: [1],
        backgroundColor: ["#e5e7eb"],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y', // Horizontal bar chart
      plugins: {
        legend: {
          display: false, // Hide legend for bar chart (not needed)
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
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
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(1)} MWh`;
              }
              return `${value.toFixed(0)} kWh`;
            }
          }
        },
        y: {
          ticks: {
            font: {
              size: 11
            }
          }
        }
      }
    },
  });

  // Fetch real data and update charts
  setTimeout(async () => {
    console.log("[ENERGY] Starting chart updates...");
    await updateLineChart(customerId);
    await updatePieChart("groups"); // Initialize with default mode

    // Setup distribution mode selector
    setupDistributionModeSelector();

    // RFC-0073 Problem 1: Setup chart configuration button
    setupChartConfigButton();
  }, 2000); // Increased timeout to ensure orchestrator is ready
}

/**
 * RFC-0073: Fetch 7 days consumption for multiple customers (respects shopping filter)
 */
async function fetch7DaysConsumptionFiltered(customerIds) {
  if (!customerIds || customerIds.length === 0) {
    return [];
  }

  console.log("[ENERGY] [RFC-0073] Fetching 7 days for customers:", customerIds);

  const results = [];
  const now = new Date();

  // Iterate through last 7 days
  for (let i = 6; i >= 0; i--) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() - i);
    dayDate.setHours(0, 0, 0, 0);

    const startTs = dayDate.getTime();
    const endDate = new Date(dayDate);
    endDate.setHours(23, 59, 59, 999);
    const endTs = endDate.getTime();

    // Aggregate consumption from all filtered customers for this day
    let dayTotal = 0;

    for (const customerId of customerIds) {
      const consumption = await fetchDayTotalConsumption(customerId, startTs, endTs);
      dayTotal += consumption;
    }

    results.push({
      date: dayDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      consumption: dayTotal,
    });
  }

  console.log("[ENERGY] [RFC-0073] 7 days consumption (filtered):", results);
  return results;
}

/**
 * Atualiza o gráfico de linha com dados reais dos últimos 7 dias
 * RFC-0073: Now respects shopping filters
 */
async function updateLineChart(customerId) {
  try {
    console.log("[ENERGY] [RFC-0073] Fetching 7 days consumption data...");

    // RFC-0073: Get filtered shopping IDs or use widget's customerId
    const selectedShoppingIds = getSelectedShoppingIds();
    const customerIds = selectedShoppingIds.length > 0
      ? selectedShoppingIds
      : [customerId];

    const sevenDaysData = await fetch7DaysConsumptionFiltered(customerIds);

    if (!lineChartInstance) {
      console.error("[ENERGY] Line chart instance not found");
      return;
    }

    // Update chart data
    lineChartInstance.data.labels = sevenDaysData.map(d => d.date);
    lineChartInstance.data.datasets[0].data = sevenDaysData.map(d => d.consumption);

    // RFC-0073: Show which shoppings are included
    const shoppingNames = customerIds.length > 1
      ? `${customerIds.length} Shoppings`
      : getShoppingNameForFilter(customerIds[0]);

    lineChartInstance.data.datasets[0].label = `Consumo Total (${shoppingNames})`;
    lineChartInstance.update();

    console.log("[ENERGY] [RFC-0073] Line chart updated with 7 days data (filtered)");
  } catch (error) {
    console.error("[ENERGY] Error updating line chart:", error);
  }
}

/**
 * RFC-0073: Helper to get shopping name for chart label
 */
function getShoppingNameForFilter(customerId) {
  if (window.custumersSelected && Array.isArray(window.custumersSelected)) {
    const shopping = window.custumersSelected.find(c => c.value === customerId);
    if (shopping) return shopping.name;
  }
  return "Shopping";
}

/**
 * Atualiza o gráfico de pizza com distribuição por tipo de equipamento ou por shopping
 * @param {string} mode - Mode to display: "groups", "elevators", "escalators", "hvac", "others", "stores"
 */
async function updatePieChart(mode = "groups") {
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
      console.warn("[ENERGY] Orchestrator not ready, using mock distribution");
      return;
    }

    // Use new distribution calculation based on mode
    const distribution = await calculateDistributionByMode(mode);

    if (!distribution || !pieChartInstance) {
      console.error("[ENERGY] Unable to calculate distribution or chart not found");
      return;
    }

    // Filter out zero values and prepare data
    const labels = [];
    const data = [];

    // Calculate total for percentage calculation
    const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);

    // Color palette for equipment groups
    const groupColors = {
      "Elevadores": "#3b82f6",
      "Escadas Rolantes": "#8b5cf6",
      "Climatização": "#f59e0b",
      "Outros Equipamentos": "#ef4444",
      "Lojas": "#10b981",
    };

    // Color palette for shoppings (rotating colors)
    const shoppingColors = [
      "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981",
      "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#a855f7"
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
        if (mode === "groups") {
          backgroundColors.push(groupColors[type] || "#94a3b8");
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
    pieChartInstance.data.datasets[0].label = "Consumo"; // Bar chart label
    pieChartInstance.update();

    console.log(`[ENERGY] Bar chart updated with ${mode} distribution`);
  } catch (error) {
    console.error("[ENERGY] Error updating pie chart:", error);
  }
}

/**
 * Configura o seletor de modo de distribuição
 */
function setupDistributionModeSelector() {
  const distributionModeSelect = document.getElementById("distributionMode");

  if (!distributionModeSelect) {
    console.warn("[ENERGY] Distribution mode selector not found");
    return;
  }

  console.log("[ENERGY] Setting up distribution mode selector");

  distributionModeSelect.addEventListener("change", async (e) => {
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
  const configBtn = document.getElementById("configureChartBtn");

  if (!configBtn) {
    console.warn("[ENERGY] [RFC-0073] Chart configuration button not found");
    return;
  }

  console.log("[ENERGY] [RFC-0073] Setting up chart configuration button");

  configBtn.addEventListener("click", () => {
    console.log("[ENERGY] [RFC-0073] Opening chart configuration modal");
    openChartConfigModal();
  });
}

/**
 * RFC-0073 Problem 2: Abre a modal de configuração avançada do gráfico
 */
function openChartConfigModal() {
  console.log("[ENERGY] [RFC-0073] Opening chart configuration modal");

  let globalContainer = document.getElementById("energyChartConfigModalGlobal");

  if (!globalContainer) {
    // Create modal structure
    globalContainer = document.createElement("div");
    globalContainer.id = "energyChartConfigModalGlobal";

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

        #energyChartConfigModalGlobal .date-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        #energyChartConfigModalGlobal .date-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        #energyChartConfigModalGlobal .date-field label {
          font-size: 13px;
          color: #6b7a90;
          font-weight: 500;
        }

        #energyChartConfigModalGlobal .date-field input {
          padding: 10px 12px;
          border: 2px solid #e6eef5;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        #energyChartConfigModalGlobal .date-field input:focus {
          border-color: #2563eb;
        }

        #energyChartConfigModalGlobal .equipment-filters {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
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
            <!-- Period Selection -->
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

              <!-- Custom Date Range (hidden by default) -->
              <div id="customDateRange" class="date-inputs" style="display: none;">
                <div class="date-field">
                  <label>Data Inicial</label>
                  <input type="date" id="chartStartDate">
                </div>
                <div class="date-field">
                  <label>Data Final</label>
                  <input type="date" id="chartEndDate">
                </div>
              </div>
            </div>

            <!-- Equipment Type Filters -->
            <div class="config-section">
              <div class="section-label">Tipos de Equipamento</div>
              <div class="equipment-filters">
                <label class="checkbox-option">
                  <input type="checkbox" class="equipment-type-filter" value="ELEVADOR" checked>
                  <span>Elevadores</span>
                </label>
                <label class="checkbox-option">
                  <input type="checkbox" class="equipment-type-filter" value="ESCADA_ROLANTE" checked>
                  <span>Escadas Rolantes</span>
                </label>
                <label class="checkbox-option">
                  <input type="checkbox" class="equipment-type-filter" value="CHILLER" checked>
                  <span>Chiller</span>
                </label>
                <label class="checkbox-option">
                  <input type="checkbox" class="equipment-type-filter" value="FANCOIL" checked>
                  <span>Fancoil</span>
                </label>
                <label class="checkbox-option">
                  <input type="checkbox" class="equipment-type-filter" value="AR_CONDICIONADO" checked>
                  <span>Ar Condicionado</span>
                </label>
                <label class="checkbox-option">
                  <input type="checkbox" class="equipment-type-filter" value="BOMBA" checked>
                  <span>Bombas</span>
                </label>
              </div>
            </div>

            <!-- Visualization Mode -->
            <div class="config-section">
              <div class="section-label">Modo de Visualização</div>
              <div class="viz-mode-group">
                <label class="checkbox-option">
                  <input type="radio" name="vizMode" value="total" checked>
                  <span>Total Consolidado</span>
                </label>
                <label class="checkbox-option">
                  <input type="radio" name="vizMode" value="separate">
                  <span>Séries Separadas por Shopping</span>
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

  const modal = globalContainer.querySelector("#chartConfigModal");
  if (!modal) return;

  modal.classList.remove("hidden");
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
 * RFC-0073 Problem 2: Configura os handlers da modal de configuração
 */
function setupChartConfigModalHandlers() {
  const modal = document.getElementById("chartConfigModal");
  if (!modal) return;

  // Close button
  const closeBtn = document.getElementById("closeChartConfig");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeChartConfigModal);
  }

  // Click outside to close
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeChartConfigModal();
    }
  });

  // Period selection handlers
  const periodRadios = modal.querySelectorAll('input[name="chartPeriod"]');
  const customDateRange = document.getElementById("customDateRange");

  periodRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      // Update selected styling
      modal.querySelectorAll(".period-option").forEach(opt => opt.classList.remove("selected"));
      e.target.closest(".period-option").classList.add("selected");

      // Show/hide custom date range
      if (e.target.value === "custom") {
        customDateRange.style.display = "grid";
      } else {
        customDateRange.style.display = "none";
      }
    });
  });

  // Apply button
  const applyBtn = document.getElementById("applyChartConfig");
  if (applyBtn) {
    applyBtn.addEventListener("click", applyChartConfiguration);
  }

  // Reset button
  const resetBtn = document.getElementById("resetChartConfig");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetChartConfiguration);
  }
}

/**
 * RFC-0073 Problem 2: Fecha a modal de configuração
 */
function closeChartConfigModal() {
  const globalContainer = document.getElementById("energyChartConfigModalGlobal");
  if (!globalContainer) return;

  const modal = globalContainer.querySelector("#chartConfigModal");
  if (!modal) return;

  console.log("[ENERGY] [RFC-0073] Closing chart config modal");

  modal.classList.add("hidden");
  document.body.classList.remove('modal-open');

  // Remove ESC handler
  if (modal._escHandler) {
    document.removeEventListener('keydown', modal._escHandler);
    modal._escHandler = null;
  }
}

/**
 * RFC-0073 Problem 2: Aplica a configuração do gráfico
 */
async function applyChartConfiguration() {
  console.log("[ENERGY] [RFC-0073] Applying chart configuration");

  const modal = document.getElementById("chartConfigModal");
  if (!modal) return;

  // Get selected period
  const periodRadio = modal.querySelector('input[name="chartPeriod"]:checked');
  const period = periodRadio ? periodRadio.value : "7";

  // Get selected equipment types
  const equipmentCheckboxes = modal.querySelectorAll('.equipment-type-filter:checked');
  const selectedEquipmentTypes = Array.from(equipmentCheckboxes).map(cb => cb.value);

  // Get visualization mode
  const vizModeRadio = modal.querySelector('input[name="vizMode"]:checked');
  const vizMode = vizModeRadio ? vizModeRadio.value : "total";

  // Get dates
  let startDate, endDate;
  if (period === "custom") {
    const startInput = document.getElementById("chartStartDate");
    const endInput = document.getElementById("chartEndDate");
    startDate = startInput ? startInput.value : null;
    endDate = endInput ? endInput.value : null;

    if (!startDate || !endDate) {
      alert("Por favor, selecione as datas inicial e final");
      return;
    }
  } else {
    // Calculate dates based on period
    const now = new Date();
    endDate = now.toISOString().split('T')[0];
    const startDateObj = new Date(now);
    startDateObj.setDate(now.getDate() - parseInt(period));
    startDate = startDateObj.toISOString().split('T')[0];
  }

  console.log("[ENERGY] [RFC-0073] Chart config:", { period, startDate, endDate, selectedEquipmentTypes, vizMode });

  // TODO: Update chart with new configuration
  // For now, just close the modal
  closeChartConfigModal();

  // Show success message
  alert(`Configuração aplicada:\nPeríodo: ${period} dias\nEquipamentos: ${selectedEquipmentTypes.length} tipos selecionados\nModo: ${vizMode === 'total' ? 'Consolidado' : 'Separado'}`);

  // Update the chart
  const customerId = self.ctx.settings?.customerId;
  if (customerId) {
    await updateLineChart(customerId);
  }
}

/**
 * RFC-0073 Problem 2: Restaura configuração padrão
 */
function resetChartConfiguration() {
  console.log("[ENERGY] [RFC-0073] Resetting chart configuration to defaults");

  const modal = document.getElementById("chartConfigModal");
  if (!modal) return;

  // Reset period to 7 days
  const period7Radio = modal.querySelector('input[name="chartPeriod"][value="7"]');
  if (period7Radio) {
    period7Radio.checked = true;
    period7Radio.dispatchEvent(new Event("change"));
  }

  // Check all equipment types
  const equipmentCheckboxes = modal.querySelectorAll('.equipment-type-filter');
  equipmentCheckboxes.forEach(cb => cb.checked = true);

  // Reset visualization mode to total
  const vizTotalRadio = modal.querySelector('input[name="vizMode"][value="total"]');
  if (vizTotalRadio) {
    vizTotalRadio.checked = true;
  }

  // Clear custom dates
  const startInput = document.getElementById("chartStartDate");
  const endInput = document.getElementById("chartEndDate");
  if (startInput) startInput.value = "";
  if (endInput) endInput.value = "";
}

/**
 * Inicializa gráficos com dados mock (fallback)
 */
function initializeMockCharts() {
  const lineCtx = document.getElementById("lineChart").getContext("2d");
  lineChartInstance = new Chart(lineCtx, {
    type: "line",
    data: {
      labels: ["01/01", "02/01", "03/01", "04/01", "05/01", "06/01", "07/01"],
      datasets: [{
        label: "Consumo (kWh)",
        data: [1200, 1150, 1300, 1250, 1400, 1350, 1300],
        borderColor: "#2563eb",
        backgroundColor: "transparent",
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
    },
  });

  const pieCtx = document.getElementById("pieChart").getContext("2d");
  pieChartInstance = new Chart(pieCtx, {
    type: "doughnut",
    data: {
      labels: ["Chiller", "Fancoil", "AR", "Bombas", "Lojas", "Elevadores", "Outros"],
      datasets: [{
        data: [35, 20, 15, 10, 12, 5, 3],
        backgroundColor: ["#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#a3e635", "#94a3b8"],
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "right", labels: { usePointStyle: true } },
      },
      cutout: "70%",
    },
  });
}

// ============================================
// MAIN INITIALIZATION
// ============================================

// ============================================
// WIDGET ENERGY - FUNÇÃO DE INICIALIZAÇÃO COMPLETA
// ============================================

self.onInit = async function () {
  console.log("[ENERGY] Initializing energy charts and consumption cards...");

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
  const handleEnergySummary = (ev) => {
    console.log(
      "[ENERGY] Resumo de energia recebido do orquestrador!",
      ev.detail
    );
    // Chama as funções que atualizam os cards na tela com os dados recebidos.
    updateTotalConsumptionStoresCard(ev.detail); // Novo: card de lojas
    updateTotalConsumptionEquipmentsCard(ev.detail); // Novo: card de equipamentos
  };

  window.addEventListener("myio:energy-summary-ready", handleEnergySummary);

  if (window.parent !== window) {
    window.parent.addEventListener("myio:energy-summary-ready", handleEnergySummary);
  }

  // RFC-0073: Listen to shopping filter changes and update charts
  const handleFilterApplied = async (ev) => {
    console.log("[ENERGY] [RFC-0073] Shopping filter applied, updating charts...", ev.detail);

    // Get dates from context
    const startTs = self.ctx.$scope?.startDateISO
      ? new Date(self.ctx.$scope.startDateISO).getTime()
      : Date.now() - 7 * 24 * 60 * 60 * 1000;

    const endTs = self.ctx.$scope?.endDateISO
      ? new Date(self.ctx.$scope.endDateISO).getTime()
      : Date.now();

    // DESABILITADO TEMPORARIAMENTE: Update peak demand card with new filter
    // await updatePeakDemandCard(startTs, endTs);

    // Also update pie chart to reflect filtered data
    const currentMode = document.getElementById("distributionMode")?.value || "groups";
    await updatePieChart(currentMode);

    // RFC-0073 Problem 1: Update 7-day line chart with filtered data
    const customerId = self.ctx.settings?.customerId;
    if (customerId) {
      await updateLineChart(customerId);
    }
  };

  window.addEventListener("myio:filter-applied", handleFilterApplied);

  if (window.parent !== window) {
    window.parent.addEventListener("myio:filter-applied", handleFilterApplied);
  }

  // RFC-0076: Listen to equipment metadata enrichment from EQUIPMENTS widget
  // This forces chart updates when EQUIPMENTS finishes enriching the cache with deviceType/deviceProfile
  const handleEquipmentMetadataEnriched = async (ev) => {
    console.log("[ENERGY] [RFC-0076] 🔧 Equipment metadata enriched! Forcing chart update...", ev.detail);

    // Force immediate update of pie chart to pick up elevator classifications
    const currentMode = document.getElementById("distributionMode")?.value || "groups";
    await updatePieChart(currentMode);

    console.log("[ENERGY] [RFC-0076] ✅ Charts updated with enriched metadata");
  };

  window.addEventListener("myio:equipment-metadata-enriched", handleEquipmentMetadataEnriched);

  if (window.parent !== window) {
    window.parent.addEventListener("myio:equipment-metadata-enriched", handleEquipmentMetadataEnriched);
  }

  // DEPOIS (NOVO CÓDIGO PARA O onInit DO WIDGET ENERGY)

  // Em seguida, inicia um "vigia" que espera o Orquestrador ficar pronto.
  const waitForOrchestratorAndRequestSummary = () => {
    let attempts = 0;
    const maxAttempts = 50; // Tenta por 10 segundos (50 * 200ms)

    const intervalId = setInterval(() => {
      attempts++;

      // ✅ CORREÇÃO: Procura no "quarto" (window) E na "sala principal" (window.parent)
      const orchestrator =
        window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;

      // VERIFICA SE O ORQUESTRADOR FOI ENCONTRADO EM UM DOS DOIS LUGARES
      if (orchestrator && typeof orchestrator.requestSummary === "function") {
        // SUCESSO! Orquestrador encontrado.
        clearInterval(intervalId); // Para de vigiar
        console.log(
          `[ENERGY] Orquestrador encontrado após ${attempts} tentativas. Solicitando resumo.`
        );

        // Chama a função do orquestrador encontrado
        orchestrator.requestSummary();
      } else if (attempts >= maxAttempts) {
        // FALHA: Timeout
        clearInterval(intervalId); // Para de vigiar
        console.error(
          "[ENERGY] TIMEOUT: Orquestrador não foi encontrado após 10 segundos. O card não será carregado."
        );
      }
    }, 200); // Verifica a cada 200ms
  };

  // Inicia o "vigia"
  waitForOrchestratorAndRequestSummary();

  // 3. LÓGICA DO CARD "PICO DE DEMANDA": Busca as datas para fazer sua própria busca.
  //    Esta parte é independente do consumo total e continua como antes.
  // -----------------------------------------------------------------

  // Tenta buscar as datas iniciais após um pequeno atraso para dar tempo ao MENU de carregar.
  setTimeout(async () => {
    let startDateISO, endDateISO;

    // Tenta pegar as datas da variável global primeiro
    if (window.myioDateRange?.startDate && window.myioDateRange?.endDate) {
      startDateISO = window.myioDateRange.startDate;
      endDateISO = window.myioDateRange.endDate;
    }
    // Se não encontrar, tenta pegar do localStorage
    else {
      const storedRange = localStorage.getItem("myio:date-range");
      if (storedRange) {
        try {
          const parsed = JSON.parse(storedRange);
          startDateISO = parsed.startDate;
          endDateISO = parsed.endDate;
        } catch (e) {
          /* ignora erro de parsing */
        }
      }
    }

    // DESABILITADO TEMPORARIAMENTE: Se encontrou datas válidas, busca os dados de pico de demanda
    /*
    if (startDateISO && endDateISO) {
      const startMs = new Date(startDateISO).getTime();
      const endMs = new Date(endDateISO).getTime();
      if (!isNaN(startMs) && !isNaN(endMs)) {
        console.log("[ENERGY] Buscando dados iniciais de Pico de Demanda.");
        await updatePeakDemandCard(startMs, endMs);
      }
    }
    */
  }, 1000);

  // DESABILITADO TEMPORARIAMENTE: Ouve por futuras mudanças de data para atualizar o Pico de Demanda.
  /*
  window.addEventListener("myio:update-date", async (ev) => {
    console.log(
      "[ENERGY] Período de data atualizado para Pico de Demanda:",
      ev.detail
    );
    let startMs = ev.detail.startMs || new Date(ev.detail.startDate).getTime();
    let endMs = ev.detail.endMs || new Date(ev.detail.endDate).getTime();

    if (!isNaN(startMs) && !isNaN(endMs)) {
      await updatePeakDemandCard(startMs, endMs);
    }
  });
  */

  // 4. OUTROS LISTENERS (Bônus): Mantém a robustez do widget.
  // -----------------------------------------------------------------

  // Limpa os caches se um evento global de limpeza for disparado.
  window.addEventListener("myio:telemetry:clear", (ev) => {
    console.log("[ENERGY] Evento de limpeza de cache recebido.", ev.detail);
    peakDemandCache = {
      data: null,
      startTs: null,
      endTs: null,
      timestamp: null,
    };
    totalConsumptionCache = {
      data: null,
      customerTotal: 0,
      equipmentsTotal: 0,
      difference: 0,
      timestamp: null,
    };

    // Reinicializa os cards para o estado de loading
    initializeTotalConsumptionCard();
    initializePeakDemandCard();
  });
};

// ============================================
// WIDGET ENERGY - CLEANUP ON DESTROY
// ============================================

self.onDestroy = function () {
  console.log("[ENERGY] [RFC-0073] Widget destroying, cleaning up modals");

  // RFC-0073: Remove chart configuration modal if it exists
  const globalContainer = document.getElementById("energyChartConfigModalGlobal");
  if (globalContainer) {
    const modal = globalContainer.querySelector("#chartConfigModal");
    if (modal && modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
      modal._escHandler = null;
    }

    // Remove global modal container from document.body
    globalContainer.remove();
    console.log("[ENERGY] [RFC-0073] Global modal container removed on destroy");
  }

  // Remove modal-open class if widget is destroyed with modal open
  document.body.classList.remove('modal-open');
};
