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

// RFC-0056: Chart colors with MyIO palette (6 categories)
let CHART_COLORS = {
  climatizacao: '#00C896',    // Teal (MyIO accent)
  elevadores: '#5B2EBC',      // Purple (MyIO primary)
  escadasRolantes: '#FF6B6B', // Red
  lojas: '#FFC107',           // Yellow
  outros: '#9C27B0',          // Deep Purple
  areaComum: '#4CAF50'        // Green (residual)
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
    outros: { devices: [], total: 0, perc: 0 }, // ← RFC-0056: Outros equipamentos de AreaComum
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

  // Outros Equipamentos
  $('#outrosTotal').text(formatEnergy(STATE.consumidores.outros.total));
  $('#outrosPerc').text(`(${STATE.consumidores.outros.perc.toFixed(1)}%)`);

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
 * RFC-0056: Render pie chart with 6 slices (no Entrada)
 */
function renderPieChart() {
  LogHelper.log("RFC-0056: Rendering pie chart with 6 categories...");

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

  // ========== CHART DATA (6 slices) ==========
  const data = {
    labels: [
      '❄️ Climatização',
      '🛗 Elevadores',
      '🎢 Esc. Rolantes',
      '🏪 Lojas',
      '⚙️ Outros',
      '🏢 Área Comum'
    ],
    datasets: [{
      data: [
        STATE.consumidores.climatizacao.total,
        STATE.consumidores.elevadores.total,
        STATE.consumidores.escadasRolantes.total,
        STATE.consumidores.lojas.total,
        STATE.consumidores.outros.total,
        STATE.consumidores.areaComum.total
      ],
      backgroundColor: [
        CHART_COLORS.climatizacao,    // #00C896 (Teal)
        CHART_COLORS.elevadores,      // #5B2EBC (Purple)
        CHART_COLORS.escadasRolantes, // #FF6B6B (Red)
        CHART_COLORS.lojas,           // #FFC107 (Yellow)
        CHART_COLORS.outros,          // #9C27B0 (Deep Purple)
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
    STATE.consumidores.outros.devices = [];
    STATE.consumidores.outros.total = 0;
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

// ===================== RFC-0056 FIX v1.1: RECEPTOR =====================

let telemetryUpdateHandler = null;
let debounceTimer = null;
let fallbackTimer = null;

// RFC-0056 FIX v1.1: Dados recebidos dos widgets TELEMETRY
const RECEIVED_DATA = {
  lojas_total: null,
  climatizacao: null,
  elevadores: null,
  escadas_rolantes: null,
  outros: null
};

/**
 * Configura listener consolidado para myio:telemetry:update
 * RFC-0056 FIX v1.1: Evento único com detail.type discriminador
 */
function setupTelemetryListener() {
  telemetryUpdateHandler = function(ev) {
    const { type, domain, periodKey, timestamp, source, data } = ev.detail || {};

    LogHelper.log(`[RFC-0056] Received telemetry update: type=${type}, source=${source}, periodKey=${periodKey}`);

    // Validar domínio
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(`[RFC-0056] Ignoring domain: ${domain} (expecting: ${WIDGET_DOMAIN})`);
      return;
    }

    // Validar periodKey (previne cross-period mix-ups)
    const currentPeriodKey = buildCurrentPeriodKey();
    if (periodKey !== currentPeriodKey) {
      LogHelper.warn(`[RFC-0056] Period mismatch: received ${periodKey}, current ${currentPeriodKey}`);
      return;
    }

    // Dispatch por tipo
    switch (type) {
      case 'lojas_total':
        handleLojasTotal(data, timestamp, periodKey);
        break;
      case 'areacomum_breakdown':
        handleAreaComumBreakdown(data, timestamp, periodKey);
        break;
      case 'request_refresh':
        handleRequestRefresh(periodKey);
        break;
      default:
        LogHelper.warn(`[RFC-0056] Unknown event type: ${type}`);
    }
  };

  window.addEventListener('myio:telemetry:update', telemetryUpdateHandler);

  // Tentar carregar do cache
  tryLoadFromCache();

  // Fallback: se após 3s não temos dados completos, solicitar refresh
  startFallbackTimeout();
}

/**
 * Handler: lojas_total
 */
function handleLojasTotal(data, timestamp, periodKey) {
  RECEIVED_DATA.lojas_total = { ...data, timestamp, periodKey };
  LogHelper.log(`[RFC-0056] ✅ Lojas total updated: ${data.total_MWh} MWh`);

  // Agendar recalculo com debounce
  scheduleRecalculation();
}

/**
 * Handler: areacomum_breakdown
 */
function handleAreaComumBreakdown(data, timestamp, periodKey) {
  RECEIVED_DATA.climatizacao = {
    total: data.climatizacao_kWh,
    totalMWh: data.climatizacao_MWh,
    timestamp,
    periodKey
  };
  RECEIVED_DATA.elevadores = {
    total: data.elevadores_kWh,
    totalMWh: data.elevadores_MWh,
    timestamp,
    periodKey
  };
  RECEIVED_DATA.escadas_rolantes = {
    total: data.escadas_rolantes_kWh,
    totalMWh: data.escadas_rolantes_MWh,
    timestamp,
    periodKey
  };
  RECEIVED_DATA.outros = {
    total: data.outros_kWh,
    totalMWh: data.outros_MWh,
    timestamp,
    periodKey
  };

  LogHelper.log(`[RFC-0056] ✅ AreaComum breakdown updated:`, {
    climatizacao: data.climatizacao_MWh,
    elevadores: data.elevadores_MWh,
    escadas_rolantes: data.escadas_rolantes_MWh,
    outros: data.outros_MWh
  });

  // Agendar recalculo com debounce
  scheduleRecalculation();
}

/**
 * Handler: request_refresh
 * Outro widget solicita re-emissão dos dados (fallback)
 */
function handleRequestRefresh(periodKey) {
  LogHelper.log(`[RFC-0056] Received request_refresh for period: ${periodKey}`);

  // Este widget é receptor, não emissor - ignora
  // (apenas TELEMETRY responde a request_refresh)
}

/**
 * Agenda recalculo com debounce de 300ms
 * RFC-0056 FIX v1.1: Reduz recalculos redundantes quando ambos eventos chegam juntos
 */
function scheduleRecalculation() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;

    if (canRecalculate()) {
      recalculateWithReceivedData();
    } else {
      LogHelper.warn('[RFC-0056] Cannot recalculate yet - waiting for more data');
    }
  }, 300);
}

/**
 * Verifica se temos dados suficientes para recalcular
 */
function canRecalculate() {
  const hasLojas = RECEIVED_DATA.lojas_total !== null;
  const hasAreaComum =
    RECEIVED_DATA.climatizacao !== null &&
    RECEIVED_DATA.elevadores !== null &&
    RECEIVED_DATA.escadas_rolantes !== null &&
    RECEIVED_DATA.outros !== null;

  return hasLojas && hasAreaComum;
}

/**
 * Recalcula valores usando dados recebidos
 * RFC-0056 FIX v1.1: Substitui cálculo local por valores recebidos
 */
function recalculateWithReceivedData() {
  LogHelper.log('[RFC-0056] 🔄 Recalculating with received data...');

  // Cancelar fallback timer (dados completos recebidos)
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }

  // Atualizar STATE.consumidores com dados recebidos
  STATE.consumidores.lojas.total = RECEIVED_DATA.lojas_total.total_kWh;
  STATE.consumidores.climatizacao.total = RECEIVED_DATA.climatizacao.total;
  STATE.consumidores.elevadores.total = RECEIVED_DATA.elevadores.total;
  STATE.consumidores.escadasRolantes.total = RECEIVED_DATA.escadas_rolantes.total;
  STATE.consumidores.outros.total = RECEIVED_DATA.outros.total;

  // Recalcular Área Comum como residual
  const somaConsumidores =
    STATE.consumidores.lojas.total +
    STATE.consumidores.climatizacao.total +
    STATE.consumidores.elevadores.total +
    STATE.consumidores.escadasRolantes.total +
    STATE.consumidores.outros.total;

  STATE.consumidores.areaComum.total = Math.max(0, STATE.entrada.total - somaConsumidores);

  // Recalcular total geral (SEM incluir entrada)
  STATE.consumidores.totalGeral = somaConsumidores + STATE.consumidores.areaComum.total;

  // Recalcular percentuais
  STATE.consumidores.lojas.perc = STATE.entrada.total > 0
    ? (STATE.consumidores.lojas.total / STATE.entrada.total) * 100
    : 0;
  STATE.consumidores.climatizacao.perc = STATE.entrada.total > 0
    ? (STATE.consumidores.climatizacao.total / STATE.entrada.total) * 100
    : 0;
  STATE.consumidores.elevadores.perc = STATE.entrada.total > 0
    ? (STATE.consumidores.elevadores.total / STATE.entrada.total) * 100
    : 0;
  STATE.consumidores.escadasRolantes.perc = STATE.entrada.total > 0
    ? (STATE.consumidores.escadasRolantes.total / STATE.entrada.total) * 100
    : 0;
  STATE.consumidores.outros.perc = STATE.entrada.total > 0
    ? (STATE.consumidores.outros.total / STATE.entrada.total) * 100
    : 0;
  STATE.consumidores.areaComum.perc = STATE.entrada.total > 0
    ? (STATE.consumidores.areaComum.total / STATE.entrada.total) * 100
    : 0;
  STATE.consumidores.percGeral = STATE.entrada.total > 0
    ? (STATE.consumidores.totalGeral / STATE.entrada.total) * 100
    : 0;

  // Validação: Total consumidores vs Entrada
  const diff = Math.abs(STATE.entrada.total - STATE.consumidores.totalGeral);
  const tolerance = STATE.entrada.total * 0.02; // 2%

  if (diff > tolerance) {
    LogHelper.warn(`[RFC-0056] ⚠️ Validation warning: Entrada (${STATE.entrada.total.toFixed(2)} kWh) != Total Consumidores (${STATE.consumidores.totalGeral.toFixed(2)} kWh), diff: ${diff.toFixed(2)} kWh`);
    showValidationWarning(diff);
  } else {
    hideValidationWarning();
  }

  // Atualizar display
  updateDisplay();

  LogHelper.log('[RFC-0056] ✅ Recalculation complete');
}

/**
 * Tenta carregar dados do cache sessionStorage
 * RFC-0056 FIX v1.1: Performance < 100ms reload
 */
function tryLoadFromCache() {
  try {
    const periodKey = buildCurrentPeriodKey();

    const cacheKeyLojas = `myio:telemetry:lojas_${periodKey}`;
    const cacheKeyAreaComum = `myio:telemetry:areacomum_${periodKey}`;

    const cachedLojas = sessionStorage.getItem(cacheKeyLojas);
    const cachedAreaComum = sessionStorage.getItem(cacheKeyAreaComum);

    if (cachedLojas) {
      const payload = JSON.parse(cachedLojas);
      handleLojasTotal(payload.data, payload.timestamp, payload.periodKey);
      LogHelper.log('[RFC-0056] 📦 Loaded lojas from cache');
    }

    if (cachedAreaComum) {
      const payload = JSON.parse(cachedAreaComum);
      handleAreaComumBreakdown(payload.data, payload.timestamp, payload.periodKey);
      LogHelper.log('[RFC-0056] 📦 Loaded areacomum from cache');
    }

  } catch (err) {
    LogHelper.warn('[RFC-0056] Cache load failed:', err);
  }
}

/**
 * Inicia timer de fallback (3s)
 * RFC-0056 FIX v1.1: Se após 3s não recebemos dados, emite request_refresh
 */
function startFallbackTimeout() {
  fallbackTimer = setTimeout(() => {
    if (!canRecalculate()) {
      LogHelper.warn('[RFC-0056] ⏱️ Fallback timeout - requesting refresh');

      const periodKey = buildCurrentPeriodKey();
      const event = new CustomEvent('myio:telemetry:update', {
        detail: {
          type: 'request_refresh',
          domain: WIDGET_DOMAIN,
          periodKey: periodKey,
          timestamp: Date.now(),
          source: 'TELEMETRY_INFO'
        },
        bubbles: true,
        cancelable: false
      });

      window.dispatchEvent(event);
    }
  }, 3000);
}

/**
 * Constrói periodKey atual baseado no timewindow do widget
 */
function buildCurrentPeriodKey() {
  const timewindow = self.ctx?.defaultSubscription?.subscriptionTimewindow;

  if (!timewindow || timewindow.realtimeWindowMs) {
    return 'realtime';
  }

  const startMs = timewindow.fixedWindow?.startTimeMs || Date.now() - 86400000;
  const endMs = timewindow.fixedWindow?.endTimeMs || Date.now();

  const startDate = new Date(startMs).toISOString().split('T')[0];
  const endDate = new Date(endMs).toISOString().split('T')[0];

  return `${startDate}_${endDate}`;
}

/**
 * Exibe marker de warning de validação na UI
 * RFC-0056 FIX v1.1: Ajuda debugging sem console
 */
function showValidationWarning(diff) {
  // Adicionar ⚠️ no card Total Consumidores
  const $totalCard = $('.total-card .card-title');
  if ($totalCard.length && !$totalCard.find('.validation-warning').length) {
    $totalCard.append(' <span class="validation-warning" style="color: #FF6B6B; font-size: 0.9em;" title="Diferença de ' + diff.toFixed(2) + ' kWh detectada">⚠️</span>');
  }
}

/**
 * Remove marker de warning
 */
function hideValidationWarning() {
  $('.validation-warning').remove();
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

  // RFC-0056: Load chart colors (with defaults) - 6 categories
  CHART_COLORS = {
    climatizacao: self.ctx.settings?.chartColors?.climatizacao || '#00C896',
    elevadores: self.ctx.settings?.chartColors?.elevadores || '#5B2EBC',
    escadasRolantes: self.ctx.settings?.chartColors?.escadasRolantes || '#FF6B6B',
    lojas: self.ctx.settings?.chartColors?.lojas || '#FFC107',
    outros: self.ctx.settings?.chartColors?.outros || '#9C27B0',
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

  // RFC-0056 FIX v1.1: Listen for consolidated telemetry updates
  setupTelemetryListener();

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

  // RFC-0056 FIX v1.1: Remove telemetry listener
  if (telemetryUpdateHandler) {
    window.removeEventListener('myio:telemetry:update', telemetryUpdateHandler);
    telemetryUpdateHandler = null;
  }

  // RFC-0056 FIX v1.1: Clear timers
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
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
