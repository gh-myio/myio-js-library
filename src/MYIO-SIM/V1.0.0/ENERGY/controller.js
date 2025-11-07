// ============================================
// MYIO-SIM 1.0.0 - ENERGY Widget Controller
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
 * Renderiza a UI do card de consumo usando os dados do pacote de resumo.
 * @param {object} energyData - O objeto de resumo completo vindo do MAIN.
 */
function renderTotalConsumptionUI(energyData, valueEl, trendEl, infoEl) {
  if (!energyData) return;

  // ✅ PONTO PRINCIPAL: O valor principal do card agora é a 'difference'
  const differenceFormatted = MyIOLibrary.formatEnergy(energyData.difference);

  if (valueEl) {
    valueEl.textContent = differenceFormatted;
  }

  // O texto de informação dá o contexto do cálculo
  if (infoEl) {
    const customerFormatted = MyIOLibrary.formatEnergy(
      energyData.customerTotal
    );
    const equipmentsFormatted = MyIOLibrary.formatEnergy(
      energyData.equipmentsTotal
    );
    infoEl.textContent = `Total: ${customerFormatted} | Equipamentos: ${equipmentsFormatted}`;
  }

  // O texto de "tendência" agora mostra a proporção
  if (trendEl && energyData.customerTotal > 0) {
    trendEl.textContent = `Equipamentos são ${energyData.percentage.toFixed(
      1
    )}% do total`;
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
 * Apenas chama a função que desenha o card na tela.
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
  const tbToken = localStorage.getItem("jwt_token");

  if (!tbToken) {
    console.error("[ENERGY] JWT token not found");
    return 0;
  }

  try {
    const url = `/api/v1/telemetry/customers/${customerId}/energy/devices/totals?startDate=${startTs}&endDate=${endTs}`;

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
 * Classifica equipamentos com mais detalhes (Elevadores vs Escadas Rolantes)
 */
function classifyEquipmentDetailed(device) {
  const deviceType = device.deviceType || "";
  const label = String(device.labelOrName || device.label || "").toLowerCase();

  // Lojas: 3F_MEDIDOR que não são equipamentos
  if (deviceType === "3F_MEDIDOR") {
    const equipmentKeywords = ["elevador", "chiller", "bomba", "escada", "casa de m"];
    const isEquipment = equipmentKeywords.some(keyword => label.includes(keyword));
    if (!isEquipment) {
      return "Lojas";
    }
  }

  // Elevadores vs Escadas Rolantes
  if (label.includes("elevador")) return "Elevadores";
  if (label.includes("escada")) return "Escadas Rolantes";

  // Climatização (HVAC)
  if (label.includes("chiller") || label.includes("fancoil") || label.includes("fan coil") ||
      label.includes("fan-coil") || label.includes("ar condicionado") ||
      label.includes("ar-condicionado") || label.includes("split") || label.includes(" ar ")) {
    return "Climatização";
  }

  // Outros Equipamentos (Bombas, etc)
  if (label.includes("bomba") || label.includes("casa de m")) {
    return "Outros Equipamentos";
  }

  return "Outros";
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

      energyCache.forEach((deviceData, ingestionId) => {
        const consumption = Number(deviceData.total_value) || 0;
        const device = findDeviceInCtx(ingestionId);

        if (device) {
          const type = classifyEquipmentDetailed(device);
          groups[type] = (groups[type] || 0) + consumption;
        } else {
          groups["Outros Equipamentos"] += consumption;
        }
      });

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

      // Agrupar por shopping
      const shoppingDistribution = {};

      energyCache.forEach((deviceData, ingestionId) => {
        const consumption = Number(deviceData.total_value) || 0;
        const device = findDeviceInCtx(ingestionId);

        if (!device) return;

        const type = classifyEquipmentDetailed(device);

        // Só incluir se for do tipo selecionado
        if (type === equipmentType) {
          const customerId = deviceData.customerId;
          const shoppingName = getShoppingName(customerId);

          shoppingDistribution[shoppingName] = (shoppingDistribution[shoppingName] || 0) + consumption;
        }
      });

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

  // Tentar buscar dos customers carregados
  if (window.custumersSelected && Array.isArray(window.custumersSelected)) {
    const shopping = window.custumersSelected.find(c => c.value === customerId);
    if (shopping) return shopping.name;
  }

  // Tentar buscar do ctx
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

  // Initialize pie chart with loading state
  const pieCtx = document.getElementById("pieChart").getContext("2d");
  pieChartInstance = new Chart(pieCtx, {
    type: "doughnut",
    data: {
      labels: ["Carregando..."],
      datasets: [{
        data: [1],
        backgroundColor: ["#e5e7eb"],
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "right",
          labels: { usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              if (value >= 1000) {
                return `${label}: ${(value / 1000).toFixed(2)} MWh`;
              }
              return `${label}: ${value.toFixed(2)} kWh`;
            }
          }
        }
      },
      cutout: "70%",
    },
  });

  // Fetch real data and update charts
  setTimeout(async () => {
    console.log("[ENERGY] Starting chart updates...");
    await updateLineChart(customerId);
    await updatePieChart("groups"); // Initialize with default mode

    // Setup distribution mode selector
    setupDistributionModeSelector();
  }, 2000); // Increased timeout to ensure orchestrator is ready
}

/**
 * Atualiza o gráfico de linha com dados reais dos últimos 7 dias
 */
async function updateLineChart(customerId) {
  try {
    console.log("[ENERGY] Fetching 7 days consumption data...");
    const sevenDaysData = await fetch7DaysConsumption(customerId);

    if (!lineChartInstance) {
      console.error("[ENERGY] Line chart instance not found");
      return;
    }

    // Update chart data
    lineChartInstance.data.labels = sevenDaysData.map(d => d.date);
    lineChartInstance.data.datasets[0].data = sevenDaysData.map(d => d.consumption);
    lineChartInstance.data.datasets[0].label = "Consumo Total";
    lineChartInstance.update();

    console.log("[ENERGY] Line chart updated with 7 days data");
  } catch (error) {
    console.error("[ENERGY] Error updating line chart:", error);
  }
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
        labels.push(`${type} (${formatted})`);
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
    pieChartInstance.update();

    console.log(`[ENERGY] Pie chart updated with ${mode} distribution`);
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
  initializeTotalConsumptionCard();
  initializePeakDemandCard();

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
    // Chama a função que atualiza o card na tela com os dados recebidos.
    updateTotalConsumptionCard(ev.detail);
  };

  window.addEventListener("myio:energy-summary-ready", handleEnergySummary);

  if (window.parent !== window) {
    window.parent.addEventListener("myio:energy-summary-ready", handleEnergySummary);
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

    // Se encontrou datas válidas, busca os dados de pico de demanda
    if (startDateISO && endDateISO) {
      const startMs = new Date(startDateISO).getTime();
      const endMs = new Date(endDateISO).getTime();
      if (!isNaN(startMs) && !isNaN(endMs)) {
        console.log("[ENERGY] Buscando dados iniciais de Pico de Demanda.");
        await updatePeakDemandCard(startMs, endMs);
      }
    }
  }, 1000);

  // Ouve por futuras mudanças de data para atualizar o Pico de Demanda.
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
