/* =========================================================================
 * ThingsBoard Widget: TELEMETRY_INFO (MyIO v-5.2.0)
 * RFC-0056: 6 Categories + Light Mode + Grid 2 Columns
 * - Consolida informações de entrada e consumidores
 * - Gráfico de pizza com distribuição de consumo (5 categorias)
 * - Integrado com MyIO Orchestrator (RFC-0042)
 * - Área Comum calculado como residual
 *
 * Autor: MyIO Team
 * Data: 2025-01-24
 * Versão: 2.0.0 (RFC-0056)
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

// RFC-0056: Chart colors with MyIO palette
let CHART_COLORS = {
  climatizacao: '#00C896',    // Teal (MyIO accent)
  elevadores: '#5B2EBC',      // Purple (MyIO primary)
  escadasRolantes: '#FF6B6B', // Red
  lojas: '#FFC107',           // Yellow
  areaComum: '#4CAF50'        // Green
};

// ===================== STATE =====================

const STATE = {
  entrada: {
    devices: [],
    total: 0,
    perc: 100
  },
  consumidores: {
    climatizacao: { devices: [], total: 0, perc: 0 },
    elevadores: { devices: [], total: 0, perc: 0 },
    escadasRolantes: { devices: [], total: 0, perc: 0 },
    lojas: { devices: [], total: 0, perc: 0 },
    areaComum: { devices: [], total: 0, perc: 0 }, // ← Residual
    totalGeral: 0,
    percGeral: 100
  },
  grandTotal: 0
};

// Chart instance
let pieChartInstance = null;

// Event handlers
let dateUpdateHandler = null;
let dataProvideHandler = null;
let lastProcessedPeriodKey = null;

// ===================== CATEGORIES (RFC-0056) =====================

const CATEGORIES = {
  ENTRADA: 'entrada',
  CLIMATIZACAO: 'climatizacao',
  ELEVADORES: 'elevadores',
  ESCADAS_ROLANTES: 'escadas_rolantes',
  LOJAS: 'lojas',
  AREA_COMUM: 'area_comum' // ← Residual (calculado)
};

// ===================== DOM HELPERS =====================

const $root = () => $(self.ctx.$container[0]);
const $ = selector => self.ctx.$container.find(selector);

// ===================== CLASSIFICATION LOGIC (RFC-0056) =====================

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
 * RFC-0056: Classify device into 6 categories
 * @param {string} labelOrName - Device label or name
 * @param {string} datasourceAlias - Optional: ThingsBoard datasource alias
 * @returns {'entrada'|'climatizacao'|'elevadores'|'escadas_rolantes'|'lojas'|'area_comum'}
 */
function classifyDevice(labelOrName = "", datasourceAlias = "") {
  const s = normalizeLabel(labelOrName);

  // ========== 1. ENTRADA ==========
  // Dispositivos de medição principal (relógios, subestações)
  if (/\brelogio\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/subesta/.test(s)) return CATEGORIES.ENTRADA;
  if (/\bentrada\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/medicao/.test(s)) return CATEGORIES.ENTRADA;
  if (/medidor principal/.test(s)) return CATEGORIES.ENTRADA;
  if (/geracao/.test(s)) return CATEGORIES.ENTRADA; // Geração solar, etc

  // ========== 2. CLIMATIZAÇÃO ==========
  // Chillers, bombas, sistemas de climatização
  if (/chiller/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/\bbomba\b/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/bomba primaria/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/bomba secundaria/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/ar condicionado/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/climatizacao/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/hvac/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/casa de maquinas/.test(s)) return CATEGORIES.CLIMATIZACAO;

  // ========== 3. ELEVADORES ==========
  if (/elevador/.test(s)) return CATEGORIES.ELEVADORES;
  if (/lift/.test(s)) return CATEGORIES.ELEVADORES; // EN

  // ========== 4. ESCADAS ROLANTES ==========
  if (/escada rolante/.test(s)) return CATEGORIES.ESCADAS_ROLANTES;
  if (/esc\. rolante/.test(s)) return CATEGORIES.ESCADAS_ROLANTES;
  if (/esc rolante/.test(s)) return CATEGORIES.ESCADAS_ROLANTES;
  if (/escalator/.test(s)) return CATEGORIES.ESCADAS_ROLANTES; // EN

  // ========== 5. LOJAS ==========
  // Check datasource alias first (more reliable)
  if (datasourceAlias && /lojas/i.test(datasourceAlias)) {
    return CATEGORIES.LOJAS;
  }
  // Fallback to label matching
  if (/\bloja\b/.test(s)) return CATEGORIES.LOJAS;
  if (/\bstore\b/.test(s)) return CATEGORIES.LOJAS; // EN
  if (/varejo/.test(s)) return CATEGORIES.LOJAS;

  // ========== 6. ÁREA COMUM (Residual) ==========
  // Nota: Área Comum NÃO é classificado aqui, é CALCULADO como residual!
  // Apenas itens explicitamente rotulados como "área comum" vão aqui
  if (/area comum/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/iluminacao/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/corredor/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/hall/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/estacionamento/.test(s)) return CATEGORIES.AREA_COMUM;

  // ========== DEFAULT ==========
  // Items não classificados vão para LOJAS (comportamento padrão)
  return CATEGORIES.LOJAS;
}

// ===================== DATA PROCESSING (RFC-0056) =====================

/**
 * RFC-0056: Aggregate telemetry data with residual calculation for Área Comum
 *
 * Formula:
 *   Área Comum = Entrada - (Climatização + Elevadores + Esc.Rolantes + Lojas)
 */
function aggregateData(items) {
  LogHelper.log("RFC-0056: Aggregating data with 6 categories:", items.length, "items");

  // ========== 1. CLASSIFY DEVICES ==========
  const entrada = items.filter(i => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.ENTRADA;
  });

  const climatizacao = items.filter(i => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.CLIMATIZACAO;
  });

  const elevadores = items.filter(i => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.ELEVADORES;
  });

  const escadasRolantes = items.filter(i => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.ESCADAS_ROLANTES;
  });

  const lojas = items.filter(i => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.LOJAS;
  });

  const areaComumExplicit = items.filter(i => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.AREA_COMUM;
  });

  LogHelper.log("RFC-0056: Classification breakdown:", {
    entrada: entrada.length,
    climatizacao: climatizacao.length,
    elevadores: elevadores.length,
    escadasRolantes: escadasRolantes.length,
    lojas: lojas.length,
    areaComumExplicit: areaComumExplicit.length
  });

  // ========== 2. CALCULATE TOTALS ==========
  const entradaTotal = entrada.reduce((sum, i) => sum + (i.value || 0), 0);
  const climatizacaoTotal = climatizacao.reduce((sum, i) => sum + (i.value || 0), 0);
  const elevadoresTotal = elevadores.reduce((sum, i) => sum + (i.value || 0), 0);
  const escadasRolantesTotal = escadasRolantes.reduce((sum, i) => sum + (i.value || 0), 0);
  const lojasTotal = lojas.reduce((sum, i) => sum + (i.value || 0), 0);
  const areaComumExplicitTotal = areaComumExplicit.reduce((sum, i) => sum + (i.value || 0), 0);

  // ========== 3. RESIDUAL CALCULATION ==========
  // Área Comum = Entrada - (Todos os outros consumidores)
  // Inclui também devices explicitamente rotulados como "Área Comum"
  const areaComumResidual = entradaTotal - (climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal);
  const areaComumTotal = Math.max(0, areaComumResidual + areaComumExplicitTotal); // ← Nunca negativo

  // Total de consumidores = Entrada (sempre 100%)
  const consumidoresTotal = climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal + areaComumTotal;
  const grandTotal = entradaTotal; // Entrada = referência 100%

  LogHelper.log("RFC-0056: Totals calculated:", {
    entradaTotal: entradaTotal.toFixed(2),
    climatizacaoTotal: climatizacaoTotal.toFixed(2),
    elevadoresTotal: elevadoresTotal.toFixed(2),
    escadasRolantesTotal: escadasRolantesTotal.toFixed(2),
    lojasTotal: lojasTotal.toFixed(2),
    areaComumResidual: areaComumResidual.toFixed(2),
    areaComumExplicitTotal: areaComumExplicitTotal.toFixed(2),
    areaComumTotal: areaComumTotal.toFixed(2),
    consumidoresTotal: consumidoresTotal.toFixed(2)
  });

  // ========== 4. CALCULATE PERCENTAGES ==========
  // Todos os percentuais são baseados na Entrada (= 100%)
  STATE.entrada = {
    devices: entrada,
    total: entradaTotal,
    perc: 100 // Entrada sempre 100%
  };

  STATE.consumidores = {
    climatizacao: {
      devices: climatizacao,
      total: climatizacaoTotal,
      perc: grandTotal > 0 ? (climatizacaoTotal / grandTotal) * 100 : 0
    },
    elevadores: {
      devices: elevadores,
      total: elevadoresTotal,
      perc: grandTotal > 0 ? (elevadoresTotal / grandTotal) * 100 : 0
    },
    escadasRolantes: {
      devices: escadasRolantes,
      total: escadasRolantesTotal,
      perc: grandTotal > 0 ? (escadasRolantesTotal / grandTotal) * 100 : 0
    },
    lojas: {
      devices: lojas,
      total: lojasTotal,
      perc: grandTotal > 0 ? (lojasTotal / grandTotal) * 100 : 0
    },
    areaComum: {
      devices: areaComumExplicit, // ← Apenas devices explícitos (residual não tem devices)
      total: areaComumTotal,
      perc: grandTotal > 0 ? (areaComumTotal / grandTotal) * 100 : 0
    },
    totalGeral: consumidoresTotal,
    percGeral: 100 // ← Total sempre 100% (= entrada)
  };

  STATE.grandTotal = grandTotal;

  LogHelper.log("RFC-0056: Percentages calculated:", {
    climatizacao: STATE.consumidores.climatizacao.perc.toFixed(1) + '%',
    elevadores: STATE.consumidores.elevadores.perc.toFixed(1) + '%',
    escadasRolantes: STATE.consumidores.escadasRolantes.perc.toFixed(1) + '%',
    lojas: STATE.consumidores.lojas.perc.toFixed(1) + '%',
    areaComum: STATE.consumidores.areaComum.perc.toFixed(1) + '%'
  });

  // ========== 5. VALIDATE TOTALS ==========
  validateTotals();
}

/**
 * RFC-0056: Validate that sum of consumers equals entrada total
 * Logs warning if mismatch > 10 Wh (0.01 kWh)
 */
function validateTotals() {
  const sum = STATE.consumidores.climatizacao.total +
              STATE.consumidores.elevadores.total +
              STATE.consumidores.escadasRolantes.total +
              STATE.consumidores.lojas.total +
              STATE.consumidores.areaComum.total;

  const entrada = STATE.entrada.total;
  const diff = Math.abs(entrada - sum);
  const tolerance = 0.01; // 10 Wh

  if (diff > tolerance) {
    LogHelper.warn("⚠️ RFC-0056: Total validation FAILED!");
    LogHelper.warn("  Entrada:  ", entrada.toFixed(2), "kWh");
    LogHelper.warn("  Sum:      ", sum.toFixed(2), "kWh");
    LogHelper.warn("  Diff:     ", diff.toFixed(2), "kWh");
    LogHelper.warn("  Breakdown:", {
      climatizacao: STATE.consumidores.climatizacao.total.toFixed(2),
      elevadores: STATE.consumidores.elevadores.total.toFixed(2),
      escadasRolantes: STATE.consumidores.escadasRolantes.total.toFixed(2),
      lojas: STATE.consumidores.lojas.total.toFixed(2),
      areaComum: STATE.consumidores.areaComum.total.toFixed(2)
    });
  } else {
    LogHelper.log("✅ RFC-0056: Totals validated successfully");
    LogHelper.log("  Entrada = Sum =", entrada.toFixed(2), "kWh (Diff:", diff.toFixed(4), "kWh)");
  }
}

// ===================== RENDERING (RFC-0056) =====================

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
 * RFC-0056: Render statistics for 6 categories
 */
function renderStats() {
  LogHelper.log("RFC-0056: Rendering stats for 6 categories...");

  // ========== ENTRADA ==========
  $('#entradaTotal').text(formatEnergy(STATE.entrada.total));
  $('#entradaPerc').text('100%');

  // ========== CONSUMIDORES ==========

  // Climatização
  $('#climatizacaoTotal').text(formatEnergy(STATE.consumidores.climatizacao.total));
  $('#climatizacaoPerc').text(`(${STATE.consumidores.climatizacao.perc.toFixed(1)}%)`);

  // Elevadores
  $('#elevadoresTotal').text(formatEnergy(STATE.consumidores.elevadores.total));
  $('#elevadoresPerc').text(`(${STATE.consumidores.elevadores.perc.toFixed(1)}%)`);

  // Escadas Rolantes
  $('#escadasRolantesTotal').text(formatEnergy(STATE.consumidores.escadasRolantes.total));
  $('#escadasRolantesPerc').text(`(${STATE.consumidores.escadasRolantes.perc.toFixed(1)}%)`);

  // Lojas
  $('#lojasTotal').text(formatEnergy(STATE.consumidores.lojas.total));
  $('#lojasPerc').text(`(${STATE.consumidores.lojas.perc.toFixed(1)}%)`);

  // Área Comum (residual)
  $('#areaComumTotal').text(formatEnergy(STATE.consumidores.areaComum.total));
  $('#areaComumPerc').text(`(${STATE.consumidores.areaComum.perc.toFixed(1)}%)`);

  // ========== TOTAL ==========
  $('#consumidoresTotal').text(formatEnergy(STATE.consumidores.totalGeral));
  $('#consumidoresPerc').text('(100%)');

  // ========== DEVICES LIST (opcional) ==========
  if (SHOW_DEVICES_LIST) {
    const $list = $('#entradaDevices').empty();
    STATE.entrada.devices.forEach(device => {
      $list.append(`<div class="device-item">${device.label || device.identifier || device.id}</div>`);
    });
  } else {
    $('#entradaDevices').empty();
  }

  LogHelper.log("RFC-0056: Stats rendered successfully");
}

/**
 * RFC-0056: Render pie chart with 5 slices (no Entrada)
 */
function renderPieChart() {
  LogHelper.log("RFC-0056: Rendering pie chart with 5 categories...");

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
    $(canvas).parent().html(`
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">Chart.js não carregado</div>
        <div class="empty-state-hint">
          <small>Adicione Chart.js v4.4.0 nos External Resources</small>
        </div>
      </div>
    `);
    return;
  }

  const ctx = canvas.getContext('2d');

  // ========== CHART DATA (5 slices) ==========
  const data = {
    labels: [
      '❄️ Climatização',
      '🛗 Elevadores',
      '🎢 Esc. Rolantes',
      '🏪 Lojas',
      '🏢 Área Comum'
    ],
    datasets: [{
      data: [
        STATE.consumidores.climatizacao.total,
        STATE.consumidores.elevadores.total,
        STATE.consumidores.escadasRolantes.total,
        STATE.consumidores.lojas.total,
        STATE.consumidores.areaComum.total
      ],
      backgroundColor: [
        CHART_COLORS.climatizacao,    // #00C896 (Teal)
        CHART_COLORS.elevadores,      // #5B2EBC (Purple)
        CHART_COLORS.escadasRolantes, // #FF6B6B (Red)
        CHART_COLORS.lojas,           // #FFC107 (Yellow)
        CHART_COLORS.areaComum        // #4CAF50 (Green)
      ],
      borderColor: '#FFFFFF',  // ← Light border
      borderWidth: 2,
      hoverBorderWidth: 3,
      hoverBorderColor: '#222222'
    }]
  };

  // ========== CHART CONFIG ==========
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
          backgroundColor: '#FFFFFF',
          borderColor: '#E0E0E0',
          borderWidth: 1,
          titleColor: '#222222',
          bodyColor: '#666666',
          padding: 12,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
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
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 800,
        easing: 'easeOutQuart'
      }
    }
  });

  // Render custom legend
  renderChartLegend();

  LogHelper.log("RFC-0056: Pie chart rendered successfully");
}

/**
 * RFC-0056: Render custom chart legend with 5 categories
 */
function renderChartLegend() {
  const $legend = $('#chartLegend').empty();

  const items = [
    {
      label: '❄️ Climatização',
      color: CHART_COLORS.climatizacao,
      value: STATE.consumidores.climatizacao.total,
      perc: STATE.consumidores.climatizacao.perc
    },
    {
      label: '🛗 Elevadores',
      color: CHART_COLORS.elevadores,
      value: STATE.consumidores.elevadores.total,
      perc: STATE.consumidores.elevadores.perc
    },
    {
      label: '🎢 Esc. Rolantes',
      color: CHART_COLORS.escadasRolantes,
      value: STATE.consumidores.escadasRolantes.total,
      perc: STATE.consumidores.escadasRolantes.perc
    },
    {
      label: '🏪 Lojas',
      color: CHART_COLORS.lojas,
      value: STATE.consumidores.lojas.total,
      perc: STATE.consumidores.lojas.perc
    },
    {
      label: '🏢 Área Comum',
      color: CHART_COLORS.areaComum,
      value: STATE.consumidores.areaComum.total,
      perc: STATE.consumidores.areaComum.perc
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

  LogHelper.log("RFC-0056: Chart legend rendered with 5 items");
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
    STATE.consumidores.climatizacao.devices = [];
    STATE.consumidores.climatizacao.total = 0;
    STATE.consumidores.elevadores.devices = [];
    STATE.consumidores.elevadores.total = 0;
    STATE.consumidores.escadasRolantes.devices = [];
    STATE.consumidores.escadasRolantes.total = 0;
    STATE.consumidores.lojas.devices = [];
    STATE.consumidores.lojas.total = 0;
    STATE.consumidores.areaComum.devices = [];
    STATE.consumidores.areaComum.total = 0;
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
  LogHelper.log("Widget initializing (RFC-0056)...");

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

  // RFC-0056: Load chart colors (with defaults)
  CHART_COLORS = {
    climatizacao: self.ctx.settings?.chartColors?.climatizacao || '#00C896',
    elevadores: self.ctx.settings?.chartColors?.elevadores || '#5B2EBC',
    escadasRolantes: self.ctx.settings?.chartColors?.escadasRolantes || '#FF6B6B',
    lojas: self.ctx.settings?.chartColors?.lojas || '#FFC107',
    areaComum: self.ctx.settings?.chartColors?.areaComum || '#4CAF50'
  };

  LogHelper.log("Settings loaded:", {
    domain: WIDGET_DOMAIN,
    showDevicesList: SHOW_DEVICES_LIST,
    debugActive: DEBUG_ACTIVE,
    chartColors: CHART_COLORS
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

  LogHelper.log("Widget initialized successfully (RFC-0056)");
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
