/* =========================================================================
 * ThingsBoard Widget: TELEMETRY_INFO (MyIO v-5.2.0)
 * - Consolida informações de entrada e consumidores
 * - Gráfico de pizza com distribuição de consumo
 * - Integrado com MyIO Orchestrator (RFC-0042)
 *
 * Autor: MyIO Team
 * Data: 2025-10-17
 * Versão: 1.0.0
 * =========================================================================*/

// ===================== CONFIGURATION =====================

let DEBUG_ACTIVE = false;

// LogHelper
const LogHelper = {
  log: (...args) => {
    if (DEBUG_ACTIVE) console.log("[TELEMETRY_INFO]", ...args);
  },
  warn: (...args) => {
    if (DEBUG_ACTIVE) console.warn("[TELEMETRY_INFO]", ...args);
  },
  error: (...args) => console.error("[TELEMETRY_INFO]", ...args)
};

// Widget configuration
let WIDGET_DOMAIN = 'energy';
let SHOW_DEVICES_LIST = false;
let CHART_COLORS = {
  areaComum: '#4CAF50',
  equipamentos: '#2196F3',
  lojas: '#FFC107'
};

// ===================== STATE =====================

const STATE = {
  entrada: {
    devices: [],
    total: 0,
    perc: 100
  },
  consumidores: {
    areaComum: { devices: [], total: 0, perc: 0 },
    equipamentos: { devices: [], total: 0, perc: 0 },
    lojas: { devices: [], total: 0, perc: 0 },
    totalGeral: 0,
    percGeral: 0
  },
  grandTotal: 0
};

// Chart instance
let pieChartInstance = null;

// Event handlers
let dateUpdateHandler = null;
let dataProvideHandler = null;
let lastProcessedPeriodKey = null;

// ===================== CATEGORIES =====================

const CATEGORIES = {
  ENTRADA: 'entrada',
  AREA_COMUM: 'area_comum',
  EQUIPAMENTOS: 'equipamentos',
  LOJAS: 'lojas'
};

// ===================== DOM HELPERS =====================

const $root = () => $(self.ctx.$container[0]);
const $ = selector => self.ctx.$container.find(selector);

// ===================== CLASSIFICATION LOGIC =====================

/**
 * Normalize label (remove accents, lowercase, trim)
 */
function normalizeLabel(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Classify device based on label/name
 * Returns: 'entrada' | 'area_comum' | 'equipamentos' | 'lojas'
 */
function classifyDevice(labelOrName = "") {
  const s = normalizeLabel(labelOrName);

  // ENTRADA: Dispositivos que medem a energia total que entra
  if (/\brelogio\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/subesta/.test(s)) return CATEGORIES.ENTRADA;
  if (/\bentrada\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/medicao/.test(s)) return CATEGORIES.ENTRADA;
  if (/medidor principal/.test(s)) return CATEGORIES.ENTRADA;

  // EQUIPAMENTOS: Bombas, chillers, administração
  if (/bomba/.test(s)) return CATEGORIES.EQUIPAMENTOS;
  if (/chiller/.test(s)) return CATEGORIES.EQUIPAMENTOS;
  if (/administra/.test(s)) return CATEGORIES.EQUIPAMENTOS;
  if (/casa de maquinas/.test(s)) return CATEGORIES.EQUIPAMENTOS;

  // ÁREA COMUM: Infraestrutura compartilhada
  if (/area comum/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/iluminacao/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/elevador/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/escada/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/ar condicionado/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/climatizacao/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/corredor/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/hall/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/estacionamento/.test(s)) return CATEGORIES.AREA_COMUM;

  // DEFAULT: Loja/Consumidor individual
  return CATEGORIES.LOJAS;
}

// ===================== DATA PROCESSING =====================

/**
 * Aggregate telemetry data by category
 */
function aggregateData(items) {
  LogHelper.log("Aggregating data:", items.length, "items");

  // 1. Classify devices into categories
  const entrada = items.filter(i => classifyDevice(i.label) === CATEGORIES.ENTRADA);
  const areaComum = items.filter(i => classifyDevice(i.label) === CATEGORIES.AREA_COMUM);
  const equipamentos = items.filter(i => classifyDevice(i.label) === CATEGORIES.EQUIPAMENTOS);
  const lojas = items.filter(i => classifyDevice(i.label) === CATEGORIES.LOJAS);

  LogHelper.log("Classification results:", {
    entrada: entrada.length,
    areaComum: areaComum.length,
    equipamentos: equipamentos.length,
    lojas: lojas.length
  });

  // 2. Calculate totals per category
  const entradaTotal = entrada.reduce((sum, i) => sum + (i.value || 0), 0);
  const areaComumTotal = areaComum.reduce((sum, i) => sum + (i.value || 0), 0);
  const equipamentosTotal = equipamentos.reduce((sum, i) => sum + (i.value || 0), 0);
  const lojasTotal = lojas.reduce((sum, i) => sum + (i.value || 0), 0);

  const consumidoresTotal = areaComumTotal + equipamentosTotal + lojasTotal;
  const grandTotal = entradaTotal; // Entrada = 100% reference

  // 3. Calculate percentages (based on entrada as 100%)
  STATE.entrada = {
    devices: entrada,
    total: entradaTotal,
    perc: 100 // Entrada always 100%
  };

  STATE.consumidores = {
    areaComum: {
      devices: areaComum,
      total: areaComumTotal,
      perc: grandTotal > 0 ? (areaComumTotal / grandTotal) * 100 : 0
    },
    equipamentos: {
      devices: equipamentos,
      total: equipamentosTotal,
      perc: grandTotal > 0 ? (equipamentosTotal / grandTotal) * 100 : 0
    },
    lojas: {
      devices: lojas,
      total: lojasTotal,
      perc: grandTotal > 0 ? (lojasTotal / grandTotal) * 100 : 0
    },
    totalGeral: consumidoresTotal,
    percGeral: grandTotal > 0 ? (consumidoresTotal / grandTotal) * 100 : 0
  };

  STATE.grandTotal = grandTotal;

  LogHelper.log("Aggregation complete:", {
    entrada: STATE.entrada.total.toFixed(2),
    consumidores: STATE.consumidores.totalGeral.toFixed(2),
    percentages: {
      areaComum: STATE.consumidores.areaComum.perc.toFixed(1) + '%',
      equipamentos: STATE.consumidores.equipamentos.perc.toFixed(1) + '%',
      lojas: STATE.consumidores.lojas.perc.toFixed(1) + '%'
    }
  });
}

// ===================== RENDERING =====================

/**
 * Format energy value (kWh)
 */
function formatEnergy(value) {
  if (typeof value !== 'number' || isNaN(value)) return '0,00 kWh';

  // Use MyIOLibrary if available, otherwise fallback
  if (window.MyIOLibrary && typeof window.MyIOLibrary.formatEnergy === 'function') {
    return window.MyIOLibrary.formatEnergy(value);
  }

  // Fallback formatting
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' kWh';
}

/**
 * Render statistics in the UI
 */
function renderStats() {
  LogHelper.log("Rendering stats...");

  // Entrada section
  $('#entradaTotal').text(formatEnergy(STATE.entrada.total));
  $('#entradaPerc').text('100%');

  // Consumidores section
  $('#areaComumTotal').text(formatEnergy(STATE.consumidores.areaComum.total));
  $('#areaComumPerc').text(`(${STATE.consumidores.areaComum.perc.toFixed(1)}%)`);

  $('#equipamentosTotal').text(formatEnergy(STATE.consumidores.equipamentos.total));
  $('#equipamentosPerc').text(`(${STATE.consumidores.equipamentos.perc.toFixed(1)}%)`);

  $('#lojasTotal').text(formatEnergy(STATE.consumidores.lojas.total));
  $('#lojasPerc').text(`(${STATE.consumidores.lojas.perc.toFixed(1)}%)`);

  $('#consumidoresTotal').text(formatEnergy(STATE.consumidores.totalGeral));
  $('#consumidoresPerc').text(`(${STATE.consumidores.percGeral.toFixed(1)}%)`);

  // Optional: Render devices list for entrada
  if (SHOW_DEVICES_LIST) {
    const $list = $('#entradaDevices').empty();
    STATE.entrada.devices.forEach(device => {
      $list.append(`<div class="device-item">${device.label || device.identifier || device.id}</div>`);
    });
  } else {
    $('#entradaDevices').empty();
  }

  LogHelper.log("Stats rendered successfully");
}

/**
 * Render pie chart using Chart.js
 */
function renderPieChart() {
  LogHelper.log("Rendering pie chart...");

  const canvas = document.getElementById('consumptionPieChart');
  if (!canvas) {
    LogHelper.warn("Canvas element not found");
    return;
  }

  // Destroy previous chart instance
  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }

  // Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    LogHelper.error("Chart.js library not loaded!");
    $(canvas).parent().html('<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-text">Chart.js não carregado</div></div>');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Prepare chart data
  const data = {
    labels: ['🏢 Área Comum', '⚙️ Equipamentos', '🏪 Lojas'],
    datasets: [{
      data: [
        STATE.consumidores.areaComum.total,
        STATE.consumidores.equipamentos.total,
        STATE.consumidores.lojas.total
      ],
      backgroundColor: [
        CHART_COLORS.areaComum,
        CHART_COLORS.equipamentos,
        CHART_COLORS.lojas
      ],
      borderColor: '#1c2743',
      borderWidth: 2
    }]
  };

  // Chart configuration
  pieChartInstance = new Chart(ctx, {
    type: 'pie',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false // Use custom legend below
        },
        tooltip: {
          backgroundColor: '#1c2743',
          borderColor: '#00e09e',
          borderWidth: 1,
          titleColor: '#e8ebf0',
          bodyColor: '#a8b2c1',
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const perc = total > 0 ? (value / total * 100).toFixed(1) : 0;
              return `${label}: ${formatEnergy(value)} (${perc}%)`;
            }
          }
        }
      }
    }
  });

  // Render custom legend
  renderChartLegend();

  LogHelper.log("Pie chart rendered successfully");
}

/**
 * Render custom chart legend
 */
function renderChartLegend() {
  const $legend = $('#chartLegend').empty();

  const items = [
    {
      label: '🏢 Área Comum',
      color: CHART_COLORS.areaComum,
      value: STATE.consumidores.areaComum.total,
      perc: STATE.consumidores.areaComum.perc
    },
    {
      label: '⚙️ Equipamentos',
      color: CHART_COLORS.equipamentos,
      value: STATE.consumidores.equipamentos.total,
      perc: STATE.consumidores.equipamentos.perc
    },
    {
      label: '🏪 Lojas',
      color: CHART_COLORS.lojas,
      value: STATE.consumidores.lojas.total,
      perc: STATE.consumidores.lojas.perc
    }
  ];

  items.forEach(item => {
    const html = `
      <div class="legend-item">
        <div class="legend-color" style="background: ${item.color};"></div>
        <span class="legend-label">${item.label}:</span>
        <span class="legend-value">${formatEnergy(item.value)} (${item.perc.toFixed(1)}%)</span>
      </div>
    `;
    $legend.append(html);
  });
}

/**
 * Update entire display
 */
function updateDisplay() {
  LogHelper.log("Updating display...");

  try {
    renderStats();
    renderPieChart();
    LogHelper.log("Display updated successfully");
  } catch (error) {
    LogHelper.error("Error updating display:", error);
  }
}

// ===================== ORCHESTRATOR INTEGRATION =====================

/**
 * Process orchestrator data
 */
function processOrchestratorData(items) {
  LogHelper.log("Processing orchestrator data:", items.length, "items");

  if (!items || items.length === 0) {
    LogHelper.warn("No data to process");

    // Reset to empty state
    STATE.entrada.devices = [];
    STATE.entrada.total = 0;
    STATE.consumidores.areaComum.devices = [];
    STATE.consumidores.areaComum.total = 0;
    STATE.consumidores.equipamentos.devices = [];
    STATE.consumidores.equipamentos.total = 0;
    STATE.consumidores.lojas.devices = [];
    STATE.consumidores.lojas.total = 0;
    STATE.consumidores.totalGeral = 0;
    STATE.grandTotal = 0;

    updateDisplay();
    return;
  }

  // Aggregate and classify
  aggregateData(items);

  // Update display
  updateDisplay();
}

// ===================== WIDGET LIFECYCLE =====================

self.onInit = async function() {
  LogHelper.log("Widget initializing...");

  // Setup container styles
  $(self.ctx.$container).css({
    height: "100%",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    position: "relative"
  });

  // Load settings
  DEBUG_ACTIVE = self.ctx.settings?.DEBUG_ACTIVE || false;
  WIDGET_DOMAIN = self.ctx.settings?.DOMAIN || 'energy';
  SHOW_DEVICES_LIST = self.ctx.settings?.showDevicesList || false;
  CHART_COLORS = {
    areaComum: self.ctx.settings?.chartColors?.areaComum || '#4CAF50',
    equipamentos: self.ctx.settings?.chartColors?.equipamentos || '#2196F3',
    lojas: self.ctx.settings?.chartColors?.lojas || '#FFC107'
  };

  LogHelper.log("Settings loaded:", {
    domain: WIDGET_DOMAIN,
    showDevicesList: SHOW_DEVICES_LIST,
    debugActive: DEBUG_ACTIVE
  });

  // Set widget label
  const widgetLabel = self.ctx.settings?.labelWidget || 'Informações de Energia';
  $root().find('.info-title').text(widgetLabel);

  // Listen for orchestrator data
  dataProvideHandler = function(ev) {
    const { domain, periodKey, items } = ev.detail;

    // Only process my domain
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(`Ignoring data for domain: ${domain} (expecting: ${WIDGET_DOMAIN})`);
      return;
    }

    // Prevent duplicate processing
    if (lastProcessedPeriodKey === periodKey) {
      LogHelper.log(`Skipping duplicate periodKey: ${periodKey}`);
      return;
    }
    lastProcessedPeriodKey = periodKey;

    LogHelper.log(`Received data: domain=${domain}, periodKey=${periodKey}, items=${items.length}`);

    processOrchestratorData(items);
  };

  window.addEventListener('myio:telemetry:provide-data', dataProvideHandler);

  // Listen for date updates
  dateUpdateHandler = function(ev) {
    LogHelper.log("Date updated:", ev.detail);

    // Update widget scope
    const { startISO, endISO } = ev.detail.period || {};
    if (startISO && endISO) {
      self.ctx.scope = self.ctx.scope || {};
      self.ctx.scope.startDateISO = startISO;
      self.ctx.scope.endDateISO = endISO;
      lastProcessedPeriodKey = null; // Reset to allow reprocessing
    }
  };

  window.addEventListener('myio:update-date', dateUpdateHandler);

  // Check for stored orchestrator data (warm start)
  setTimeout(() => {
    const orchestratorData = window.MyIOOrchestratorData || window.parent?.MyIOOrchestratorData;

    if (orchestratorData && orchestratorData[WIDGET_DOMAIN]) {
      const storedData = orchestratorData[WIDGET_DOMAIN];
      const age = Date.now() - storedData.timestamp;

      // Use stored data if less than 30 seconds old
      if (age < 30000 && storedData.items && storedData.items.length > 0) {
        LogHelper.log("Using stored orchestrator data (age:", age, "ms)");
        processOrchestratorData(storedData.items);
      } else {
        LogHelper.log("Stored data is stale or empty (age:", age, "ms)");
      }
    } else {
      LogHelper.log("No stored orchestrator data found");
    }
  }, 500);

  LogHelper.log("Widget initialized successfully");
};

self.onDataUpdated = function() {
  // No-op: We rely on orchestrator events, not ThingsBoard datasources
  LogHelper.log("onDataUpdated called (no-op in orchestrator mode)");
};

self.onResize = function() {
  LogHelper.log("Widget resized");

  // Resize chart if it exists
  if (pieChartInstance) {
    try {
      pieChartInstance.resize();
      LogHelper.log("Chart resized");
    } catch (error) {
      LogHelper.warn("Error resizing chart:", error);
    }
  }
};

self.onDestroy = function() {
  LogHelper.log("Widget destroying...");

  // Remove event listeners
  if (dateUpdateHandler) {
    window.removeEventListener('myio:update-date', dateUpdateHandler);
    dateUpdateHandler = null;
  }

  if (dataProvideHandler) {
    window.removeEventListener('myio:telemetry:provide-data', dataProvideHandler);
    dataProvideHandler = null;
  }

  // Destroy chart
  if (pieChartInstance) {
    try {
      pieChartInstance.destroy();
      pieChartInstance = null;
      LogHelper.log("Chart destroyed");
    } catch (error) {
      LogHelper.warn("Error destroying chart:", error);
    }
  }

  // Clear jQuery event handlers
  try {
    $root().off();
  } catch (_) {}

  LogHelper.log("Widget destroyed successfully");
};
