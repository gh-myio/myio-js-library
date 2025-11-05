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
// CHART FUNCTIONS (Original)
// ============================================

function initializeCharts() {
  // Mock data (pode substituir com telemetria real do ThingsBoard)
  const lineCtx = document.getElementById("lineChart").getContext("2d");
  new Chart(lineCtx, {
    type: "line",
    data: {
      labels: [
        "00:00",
        "02:00",
        "04:00",
        "06:00",
        "08:00",
        "10:00",
        "12:00",
        "14:00",
        "16:00",
        "18:00",
        "20:00",
        "22:00",
      ],
      datasets: [
        {
          label: "Consumo Real",
          data: [
            900, 750, 650, 700, 1100, 1400, 1600, 1900, 1700, 1500, 1200, 1000,
          ],
          borderColor: "#2563eb",
          backgroundColor: "transparent",
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
        },
        {
          label: "Meta",
          data: [
            850, 700, 600, 680, 1000, 1300, 1500, 1800, 1600, 1400, 1150, 950,
          ],
          borderColor: "#9fc131",
          backgroundColor: "transparent",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });

  const pieCtx = document.getElementById("pieChart").getContext("2d");
  new Chart(pieCtx, {
    type: "doughnut",
    data: {
      labels: [
        "HVAC 35%",
        "Lojas 25%",
        "Elevadores 15%",
        "Equipamentos 10%",
        "Iluminação 10%",
        "Área Comum 5%",
      ],
      datasets: [
        {
          data: [35, 25, 15, 10, 10, 5],
          backgroundColor: [
            "#3b82f6",
            "#8b5cf6",
            "#f59e0b",
            "#ef4444",
            "#10b981",
            "#a3e635",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "right",
          labels: { usePointStyle: true },
        },
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
  window.parent.addEventListener("myio:energy-summary-ready", (ev) => {
    console.log(
      "[ENERGY] Resumo de energia recebido do orquestrador!",
      ev.detail
    );
    // Chama a função que atualiza o card na tela com os dados recebidos.
    updateTotalConsumptionCard(ev.detail);
  });

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
