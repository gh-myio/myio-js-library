/* global self, window, document, sessionStorage, Chart */

/* =========================================================================
 * ThingsBoard Widget: TELEMETRY_INFO (MyIO v-5.2.0)
 * RFC-0056: 6 Categories + Light Mode + Grid 2 Columns
 * - Consolida informaÃ§Ãµes de entrada e consumidores
 * - GrÃ¡fico de pizza com distribuiÃ§Ã£o de consumo (5 categorias)
 * - Integrado com MyIO Orchestrator (RFC-0042)
 * - Ãrea Comum calculado como residual
 *
 * Autor: MyIO Team
 * Data: 2025-01-24
 * VersÃ£o: 2.0.0 (RFC-0056)
 * =========================================================================*/

// ===================== CONFIGURATION =====================

// RFC-0091: Use shared LogHelper from MAIN widget via window.MyIOUtils
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log('[TELEMETRY_INFO]', ...args),
  warn: (...args) => console.warn('[TELEMETRY_INFO]', ...args),
  error: (...args) => console.error('[TELEMETRY_INFO]', ...args),
};

// Widget configuration
let WIDGET_DOMAIN = 'energy';
let SHOW_DEVICES_LIST = false;

// RFC-0056: Chart colors with MyIO palette (6 categories)
let CHART_COLORS = {
  climatizacao: '#00C896', // Teal (MyIO accent)
  elevadores: '#5B2EBC', // Purple (MyIO primary)
  escadasRolantes: '#FF6B6B', // Red
  lojas: '#FFC107', // Yellow
  outros: '#9C27B0', // Deep Purple
  areaComum: '#4CAF50', // Green (residual)
};

// RFC-0002: Domain labels for multi-domain support (energy, water, gas)
const DOMAIN_LABELS = {
  energy: {
    title: 'Energia',
    unit: 'kWh',
    icon: 'ℹ️',
  },
  water: {
    title: 'Água',
    unit: 'm³',
    icon: '💧',
  },
  gas: {
    title: 'Gás',
    unit: 'm³',
    icon: '🔥',
  },
};

/**
 * RFC-0002: Get domain label configuration
 * @param {string} domain - Domain identifier ('energy', 'water', 'gas')
 * @returns {Object} Domain configuration with title, unit, and icon
 */
function getDomainLabel(domain = 'energy') {
  // Always fallback to 'energy' if domain is invalid or undefined
  return DOMAIN_LABELS[domain] || DOMAIN_LABELS.energy;
}

/**
 * RFC-0002: Format value based on domain
 * @param {number} value - Numeric value
 * @param {string} domain - Domain ('energy' or 'water')
 * @returns {string} Formatted string with unit
 */
function formatValue(value, domain = 'energy') {
  if (domain === 'water') {
    // Format as m³ with 2 decimals
    return value.toFixed(2).replace('.', ',') + ' m³';
  }
  // Default: energy (kWh)
  return formatEnergy(value);
}

// ===================== STATE =====================

const STATE = {
  entrada: {
    devices: [],
    total: 0,
    perc: 100,
  },
  consumidores: {
    climatizacao: { devices: [], total: 0, perc: 0 },
    elevadores: { devices: [], total: 0, perc: 0 },
    escadasRolantes: { devices: [], total: 0, perc: 0 },
    lojas: { devices: [], total: 0, perc: 0 },
    outros: { devices: [], total: 0, perc: 0 }, // â† RFC-0056: Outros equipamentos de AreaComum
    areaComum: { devices: [], total: 0, perc: 0 }, // â† Residual
    totalGeral: 0,
    percGeral: 100,
  },
  grandTotal: 0,
};

// Chart instance
let pieChartInstance = null;

// RFC-0002: STATE for water domain (5 contexts with banheiros extracted from areaComum)
const STATE_WATER = {
  domain: 'water',
  entrada: {
    context: 'entrada',
    devices: [],
    total: 0,
    perc: 100,
    source: 'widget-telemetry-entrada',
  },
  lojas: {
    context: 'lojas',
    devices: [],
    total: 0,
    perc: 0,
    source: 'widget-telemetry-lojas',
  },
  banheiros: {
    context: 'banheiros',
    devices: [],
    total: 0,
    perc: 0,
    source: 'widget-telemetry-area-comum (banheiros breakdown)', // Extracted from areaComum by label/identifier
  },
  areaComum: {
    context: 'areaComum',
    devices: [],
    total: 0,
    perc: 0,
    source: 'widget-telemetry-area-comum (outros)',
  },
  pontosNaoMapeados: {
    context: 'pontosNaoMapeados',
    devices: [],
    total: 0,
    perc: 0,
    isCalculated: true,
    hasInconsistency: false,
  },
  grandTotal: 0,
  periodKey: null,
  lastUpdate: null,
  includeBathrooms: false, // Setting from widget config
};

// Event handlers
let dateUpdateHandler = null;
let dataProvideHandler = null;
let waterProvideHandler = null; // RFC-0002: Handler for water events
let clearCacheHandler = null;
let lastProcessedPeriodKey = null;

// ===================== CATEGORIES (RFC-0056) =====================

const CATEGORIES = {
  ENTRADA: 'entrada',
  CLIMATIZACAO: 'climatizacao',
  ELEVADORES: 'elevadores',
  ESCADAS_ROLANTES: 'escadas_rolantes',
  LOJAS: 'lojas',
  AREA_COMUM: 'area_comum', // â† Residual (calculado)
};

// ===================== DOM HELPERS =====================

// Preserve global jQuery and avoid shadowing `$`
const $J = window.jQuery || window.$;
// Root jQuery object for this widget container
const $root = () => $J(self.ctx.$container);
// Find elements within this widget container
const $$ = (selector) => $root().find(selector);

// ===================== CLASSIFICATION LOGIC (RFC-0056) =====================

/**
 * Normalize label (remove accents, lowercase, trim)
 */
function normalizeLabel(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * RFC-0056: Classify device into 6 categories
 * @param {string} labelOrName - Device label or name
 * @param {string} datasourceAlias - Optional: ThingsBoard datasource alias
 * @returns {'entrada'|'climatizacao'|'elevadores'|'escadas_rolantes'|'lojas'|'area_comum'}
 */
function classifyDevice(labelOrName = '', datasourceAlias = '') {
  const s = normalizeLabel(labelOrName);

  // ========== 1. ENTRADA ==========
  // Dispositivos de mediÃ§Ã£o principal (relÃ³gios, subestaÃ§Ãµes)
  if (/\brelogio\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/subesta/.test(s)) return CATEGORIES.ENTRADA;
  if (/\bentrada\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/medicao/.test(s)) return CATEGORIES.ENTRADA;
  if (/medidor principal/.test(s)) return CATEGORIES.ENTRADA;
  if (/geracao/.test(s)) return CATEGORIES.ENTRADA; // GeraÃ§Ã£o solar, etc

  // ========== 2. CLIMATIZAÃ‡ÃƒO ==========
  // Chillers, bombas, sistemas de climatizaÃ§Ã£o
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

  // ========== 6. ÃREA COMUM (Residual) ==========
  // Nota: Ãrea Comum NÃƒO Ã© classificado aqui, Ã© CALCULADO como residual!
  // Apenas itens explicitamente rotulados como "Ã¡rea comum" vÃ£o aqui
  if (/area comum/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/iluminacao/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/corredor/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/hall/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/estacionamento/.test(s)) return CATEGORIES.AREA_COMUM;

  // ========== DEFAULT ==========
  // Items nÃ£o classificados vÃ£o para LOJAS (comportamento padrÃ£o)
  return CATEGORIES.LOJAS;
}

// ===================== DATA PROCESSING (RFC-0056) =====================

/**
 * RFC-0056: Aggregate telemetry data with residual calculation for Ãrea Comum
 *
 * Formula:
 *   Ãrea Comum = Entrada - (ClimatizaÃ§Ã£o + Elevadores + Esc.Rolantes + Lojas)
 */
function aggregateData(items) {
  LogHelper.log('RFC-0056: Aggregating data with 6 categories:', items.length, 'items');

  // ========== 1. CLASSIFY DEVICES ==========
  const entrada = items.filter((i) => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.ENTRADA;
  });

  const climatizacao = items.filter((i) => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.CLIMATIZACAO;
  });

  const elevadores = items.filter((i) => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.ELEVADORES;
  });

  const escadasRolantes = items.filter((i) => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.ESCADAS_ROLANTES;
  });

  const lojas = items.filter((i) => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.LOJAS;
  });

  const areaComumExplicit = items.filter((i) => {
    const cat = classifyDevice(i.label, i.datasourceAlias);
    return cat === CATEGORIES.AREA_COMUM;
  });

  LogHelper.log('RFC-0056: Classification breakdown:', {
    entrada: entrada.length,
    climatizacao: climatizacao.length,
    elevadores: elevadores.length,
    escadasRolantes: escadasRolantes.length,
    lojas: lojas.length,
    areaComumExplicit: areaComumExplicit.length,
  });

  // ========== 2. CALCULATE TOTALS ==========
  const entradaTotal = entrada.reduce((sum, i) => sum + (i.value || 0), 0);
  const climatizacaoTotal = climatizacao.reduce((sum, i) => sum + (i.value || 0), 0);
  const elevadoresTotal = elevadores.reduce((sum, i) => sum + (i.value || 0), 0);
  const escadasRolantesTotal = escadasRolantes.reduce((sum, i) => sum + (i.value || 0), 0);
  const lojasTotal = lojas.reduce((sum, i) => sum + (i.value || 0), 0);
  const areaComumExplicitTotal = areaComumExplicit.reduce((sum, i) => sum + (i.value || 0), 0);

  // ========== 3. RESIDUAL CALCULATION ==========
  // Ãrea Comum = Entrada - (Todos os outros consumidores)
  // Inclui tambÃ©m devices explicitamente rotulados como "Ãrea Comum"
  const areaComumResidual =
    entradaTotal - (climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal);
  const areaComumTotal = Math.max(0, areaComumResidual + areaComumExplicitTotal); // â† Nunca negativo

  // Total de consumidores = Entrada (sempre 100%)
  const consumidoresTotal =
    climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal + areaComumTotal;
  const grandTotal = entradaTotal; // Entrada = referÃªncia 100%

  LogHelper.log('RFC-0056: Totals calculated:', {
    entradaTotal: entradaTotal.toFixed(2),
    climatizacaoTotal: climatizacaoTotal.toFixed(2),
    elevadoresTotal: elevadoresTotal.toFixed(2),
    escadasRolantesTotal: escadasRolantesTotal.toFixed(2),
    lojasTotal: lojasTotal.toFixed(2),
    areaComumResidual: areaComumResidual.toFixed(2),
    areaComumExplicitTotal: areaComumExplicitTotal.toFixed(2),
    areaComumTotal: areaComumTotal.toFixed(2),
    consumidoresTotal: consumidoresTotal.toFixed(2),
  });

  // ========== 4. CALCULATE PERCENTAGES ==========
  // Todos os percentuais sÃ£o baseados na Entrada (= 100%)
  STATE.entrada = {
    devices: entrada,
    total: entradaTotal,
    perc: 100, // Entrada sempre 100%
  };

  STATE.consumidores = {
    climatizacao: {
      devices: climatizacao,
      total: climatizacaoTotal,
      perc: grandTotal > 0 ? (climatizacaoTotal / grandTotal) * 100 : 0,
    },
    elevadores: {
      devices: elevadores,
      total: elevadoresTotal,
      perc: grandTotal > 0 ? (elevadoresTotal / grandTotal) * 100 : 0,
    },
    escadasRolantes: {
      devices: escadasRolantes,
      total: escadasRolantesTotal,
      perc: grandTotal > 0 ? (escadasRolantesTotal / grandTotal) * 100 : 0,
    },
    lojas: {
      devices: lojas,
      total: lojasTotal,
      perc: grandTotal > 0 ? (lojasTotal / grandTotal) * 100 : 0,
    },
    areaComum: {
      devices: areaComumExplicit, // â† Apenas devices explÃ­citos (residual nÃ£o tem devices)
      total: areaComumTotal,
      perc: grandTotal > 0 ? (areaComumTotal / grandTotal) * 100 : 0,
    },
    totalGeral: consumidoresTotal,
    percGeral: 100, // â† Total sempre 100% (= entrada)
  };

  STATE.grandTotal = grandTotal;

  LogHelper.log('RFC-0056: Percentages calculated:', {
    climatizacao: STATE.consumidores.climatizacao.perc.toFixed(1) + '%',
    elevadores: STATE.consumidores.elevadores.perc.toFixed(1) + '%',
    escadasRolantes: STATE.consumidores.escadasRolantes.perc.toFixed(1) + '%',
    lojas: STATE.consumidores.lojas.perc.toFixed(1) + '%',
    areaComum: STATE.consumidores.areaComum.perc.toFixed(1) + '%',
  });

  // ========== 5. VALIDATE TOTALS ==========
  validateTotals();
}

/**
 * RFC-0056: Validate that sum of consumers equals entrada total
 * Logs warning if mismatch > 10 Wh (0.01 kWh)
 */
function validateTotals() {
  const sum =
    STATE.consumidores.climatizacao.total +
    STATE.consumidores.elevadores.total +
    STATE.consumidores.escadasRolantes.total +
    STATE.consumidores.lojas.total +
    STATE.consumidores.areaComum.total;

  const entrada = STATE.entrada.total;
  const diff = Math.abs(entrada - sum);
  const tolerance = 0.01; // 10 Wh

  if (diff > tolerance) {
    LogHelper.warn('[WARNING] RFC-0056: Total validation FAILED!');
    LogHelper.warn('  Entrada:  ', entrada.toFixed(2), 'kWh');
    LogHelper.warn('  Sum:      ', sum.toFixed(2), 'kWh');
    LogHelper.warn('  Diff:     ', diff.toFixed(2), 'kWh');
    LogHelper.warn('  Breakdown:', {
      climatizacao: STATE.consumidores.climatizacao.total.toFixed(2),
      elevadores: STATE.consumidores.elevadores.total.toFixed(2),
      escadasRolantes: STATE.consumidores.escadasRolantes.total.toFixed(2),
      lojas: STATE.consumidores.lojas.total.toFixed(2),
      areaComum: STATE.consumidores.areaComum.total.toFixed(2),
    });
  } else {
    LogHelper.log('âœ… RFC-0056: Totals validated successfully');
    LogHelper.log('  Entrada = Sum =', entrada.toFixed(2), 'kWh (Diff:', diff.toFixed(4), 'kWh)');
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
  return (
    value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' kWh'
  );
}

/**
 * RFC-0056: Render statistics for 6 categories
 */
function renderStats() {
  LogHelper.log('RFC-0056: Rendering stats for 6 categories...');

  // ========== ENTRADA ==========
  $$('#entradaTotal').text(formatEnergy(STATE.entrada.total));

  // ========== CONSUMIDORES ==========

  // ClimatizaÃ§Ã£o
  $$('#climatizacaoTotal').text(formatEnergy(STATE.consumidores.climatizacao.total));
  $$('#climatizacaoPerc').text(`(${STATE.consumidores.climatizacao.perc.toFixed(1)}%)`);

  // Elevadores
  $$('#elevadoresTotal').text(formatEnergy(STATE.consumidores.elevadores.total));
  $$('#elevadoresPerc').text(`(${STATE.consumidores.elevadores.perc.toFixed(1)}%)`);

  // Escadas Rolantes
  $$('#escadasRolantesTotal').text(formatEnergy(STATE.consumidores.escadasRolantes.total));
  $$('#escadasRolantesPerc').text(`(${STATE.consumidores.escadasRolantes.perc.toFixed(1)}%)`);

  // Lojas
  $$('#lojasTotal').text(formatEnergy(STATE.consumidores.lojas.total));
  $$('#lojasPerc').text(`(${STATE.consumidores.lojas.perc.toFixed(1)}%)`);

  // Outros Equipamentos (RFC-0056: Defensiva para compatibilidade)
  if (STATE.consumidores.outros) {
    $$('#outrosTotal').text(formatEnergy(STATE.consumidores.outros.total));
    $$('#outrosPerc').text(`(${STATE.consumidores.outros.perc.toFixed(1)}%)`);
  } else {
    $$('#outrosTotal').text('0,00 kWh');
    $$('#outrosPerc').text('(0%)');
  }

  // Ãrea Comum (residual)
  $$('#areaComumTotal').text(formatEnergy(STATE.consumidores.areaComum.total));
  $$('#areaComumPerc').text(`(${STATE.consumidores.areaComum.perc.toFixed(1)}%)`);

  // RFC-0056: Hide Área Comum card when water domain has bathrooms enabled
  // Consolidate área comum into "Pontos não mapeados" instead
  if (WIDGET_DOMAIN === 'water' && STATE_WATER.includeBathrooms) {
    $$('.area-comum-card').hide();
  } else {
    $$('.area-comum-card').show();
  }

  // ========== TOTAL ==========
  $$('#consumidoresTotal').text(formatEnergy(STATE.consumidores.totalGeral));
  $$('#consumidoresPerc').text('(100%)');

  // ========== DEVICES LIST (opcional) ==========
  if (SHOW_DEVICES_LIST) {
    const $list = $$('#entradaDevices').empty();
    STATE.entrada.devices.forEach((device) => {
      $list.append(`<div class="device-item">${device.label || device.identifier || device.id}</div>`);
    });
  } else {
    $$('#entradaDevices').empty();
  }

  LogHelper.log('RFC-0056: Stats rendered successfully');
}

/**
 * RFC-0056: Render pie chart with 6 slices (no Entrada)
 */
function renderPieChart() {
  LogHelper.log('RFC-0056: Rendering pie chart with 6 categories...');

  const canvas = document.getElementById('consumptionPieChart');
  if (!canvas) {
    LogHelper.warn('Canvas element not found');
    return;
  }

  // Destroy previous chart instance
  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }

  // Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    LogHelper.error('Chart.js library not loaded!');
    $J(canvas).parent().html(`
      <div class="empty-state">
        <div class="empty-state-icon">ðŸ“Š</div>
        <div class="empty-state-text">Chart.js nÃ£o carregado</div>
        <div class="empty-state-hint">
          <small>Adicione Chart.js v4.4.0 nos External Resources</small>
        </div>
      </div>
    `);
    return;
  }

  const ctx = canvas.getContext('2d');

  // ========== CHART DATA (6 slices or 5 if hiding Área Comum) ==========
  // RFC-0056: Hide Área Comum when water domain has bathrooms enabled
  const hideAreaComum = WIDGET_DOMAIN === 'water' && STATE_WATER.includeBathrooms;

  const labels = hideAreaComum
    ? ['Climatização', 'Elevadores', 'Esc. Rolantes', 'Lojas', 'Outros']
    : ['Climatização', 'Elevadores', 'Esc. Rolantes', 'Lojas', 'Outros', 'Área Comum'];

  const data = {
    labels: labels,
    datasets: [
      {
        data: hideAreaComum
          ? [
              STATE.consumidores.climatizacao.total,
              STATE.consumidores.elevadores.total,
              STATE.consumidores.escadasRolantes.total,
              STATE.consumidores.lojas.total,
              STATE.consumidores.outros ? STATE.consumidores.outros.total : 0,
            ]
          : [
              STATE.consumidores.climatizacao.total,
              STATE.consumidores.elevadores.total,
              STATE.consumidores.escadasRolantes.total,
              STATE.consumidores.lojas.total,
              STATE.consumidores.outros ? STATE.consumidores.outros.total : 0,
              STATE.consumidores.areaComum.total,
            ],
        backgroundColor: hideAreaComum
          ? [
              CHART_COLORS.climatizacao, // #00C896 (Teal)
              CHART_COLORS.elevadores, // #5B2EBC (Purple)
              CHART_COLORS.escadasRolantes, // #FF6B6B (Red)
              CHART_COLORS.lojas, // #FFC107 (Yellow)
              CHART_COLORS.outros, // #9C27B0 (Deep Purple)
            ]
          : [
              CHART_COLORS.climatizacao, // #00C896 (Teal)
              CHART_COLORS.elevadores, // #5B2EBC (Purple)
              CHART_COLORS.escadasRolantes, // #FF6B6B (Red)
              CHART_COLORS.lojas, // #FFC107 (Yellow)
              CHART_COLORS.outros, // #9C27B0 (Deep Purple)
              CHART_COLORS.areaComum, // #4CAF50 (Green)
            ],
        borderColor: '#FFFFFF', // â† Light border
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverBorderColor: '#222222',
      },
    ],
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
          display: false, // Use custom legend below
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
            label: function (context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const perc = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${formatEnergy(value)} (${perc}%)`;
            },
          },
        },
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 800,
        easing: 'easeOutQuart',
      },
    },
  });

  // Render custom legend
  renderChartLegend();

  LogHelper.log('RFC-0056: Pie chart rendered successfully');
}

/**
 * RFC-0056: Render custom chart legend with 5 or 6 categories (hide Área Comum when water + bathrooms)
 */
function renderChartLegend() {
  const $legend = $$('#chartLegend').empty();

  const hideAreaComum = WIDGET_DOMAIN === 'water' && STATE_WATER.includeBathrooms;

  const items = [
    {
      label: 'Climatização',
      color: CHART_COLORS.climatizacao,
      value: STATE.consumidores.climatizacao.total,
      perc: STATE.consumidores.climatizacao.perc,
    },
    {
      label: 'Elevadores',
      color: CHART_COLORS.elevadores,
      value: STATE.consumidores.elevadores.total,
      perc: STATE.consumidores.elevadores.perc,
    },
    {
      label: 'Esc. Rolantes',
      color: CHART_COLORS.escadasRolantes,
      value: STATE.consumidores.escadasRolantes.total,
      perc: STATE.consumidores.escadasRolantes.perc,
    },
    {
      label: 'Lojas',
      color: CHART_COLORS.lojas,
      value: STATE.consumidores.lojas.total,
      perc: STATE.consumidores.lojas.perc,
    },
  ];

  // Only add Área Comum if not hidden
  if (!hideAreaComum) {
    items.push({
      label: 'Área Comum',
      color: CHART_COLORS.areaComum,
      value: STATE.consumidores.areaComum.total,
      perc: STATE.consumidores.areaComum.perc,
    });
  }

  items.forEach((item) => {
    const html = `
      <div class="legend-item">
        <div class="legend-color" style="background: ${item.color};"></div>
        <span class="legend-label">${item.label}:</span>
        <span class="legend-value">${formatEnergy(item.value)} (${item.perc.toFixed(1)}%)</span>
      </div>
    `;
    $legend.append(html);
  });

  LogHelper.log('RFC-0056: Chart legend rendered with 5 items');
}

// ===================== MODAL FUNCTIONS =====================

let modalPieChartInstance = null;

/**
 * Open expanded modal view
 */
function openModal() {
  console.log('[TELEMETRY_INFO] ðŸš€ openModal() called');
  LogHelper.log('Opening expanded modal...');

  const $modal = $J('#modalExpanded');

  if (!$modal || $modal.length === 0) {
    console.error('[TELEMETRY_INFO] âŒ Modal element #modalExpanded NOT FOUND!');
    return;
  }

  console.log('[TELEMETRY_INFO] Modal found:', $modal.length, 'elements');
  console.log('[TELEMETRY_INFO] Modal current parent:', $modal.parent()[0]?.tagName || 'NONE');

  // CRITICAL: ALWAYS remove and re-add to body to ensure it's the LAST element (highest stacking)
  console.log("[TELEMETRY_INFO] ðŸ“¦ Re-appending modal to body to ensure it's last element");
  $modal.detach().appendTo(document.body);
  console.log('[TELEMETRY_INFO] âœ… Modal is now last element in body');

  // RFC-0056 FIX: ULTRA-FORCE modal visibility with MAXIMUM z-index
  console.log('[TELEMETRY_INFO] ðŸŽ¨ Setting modal visibility with MAX z-index...');

  const MAX_Z_INDEX = '2147483647'; // Maximum 32-bit signed integer

  $modal.css({
    display: 'flex',
    visibility: 'visible',
    opacity: '1',
    'pointer-events': 'all',
    'z-index': MAX_Z_INDEX,
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    width: '100vw',
    height: '100vh',
    background: 'rgba(0, 0, 0, 0.75)',
  });

  // Force with !important for ABSOLUTE override
  $modal[0].style.setProperty('display', 'flex', 'important');
  $modal[0].style.setProperty('visibility', 'visible', 'important');
  $modal[0].style.setProperty('opacity', '1', 'important');
  $modal[0].style.setProperty('position', 'fixed', 'important');
  $modal[0].style.setProperty('z-index', MAX_Z_INDEX, 'important');
  $modal[0].style.setProperty('width', '100vw', 'important');
  $modal[0].style.setProperty('height', '100vh', 'important');
  $modal[0].style.setProperty('top', '0', 'important');
  $modal[0].style.setProperty('left', '0', 'important');

  console.log('[TELEMETRY_INFO] âœ… Modal visibility styles applied with z-index:', MAX_Z_INDEX);

  // Add a class to body to prevent scrolling
  $J('body').addClass('modal-open-telemetry-info');

  // Update modal data with current STATE
  updateModalData();

  // Render modal chart
  renderModalChart();

  // Prevent body scroll
  $J('body').css('overflow', 'hidden');

  LogHelper.log('Modal opened successfully');
}

// RFC-0056 FIX: Expose openModal globally for onclick handler
window.TELEMETRY_INFO_openModal = openModal;

/**
 * Close expanded modal view
 */
function closeModal() {
  console.log('[TELEMETRY_INFO] ðŸ”’ closeModal() called');
  LogHelper.log('Closing expanded modal...');

  const $modal = $J('#modalExpanded');
  $modal.css('display', 'none');

  // Destroy modal chart instance
  if (modalPieChartInstance) {
    modalPieChartInstance.destroy();
    modalPieChartInstance = null;
  }

  // Remove body class
  $J('body').removeClass('modal-open-telemetry-info');

  // Restore body scroll
  $J('body').css('overflow', '');

  console.log('[TELEMETRY_INFO] âœ… Modal closed successfully');
  LogHelper.log('Modal closed successfully');
}

/**
 * Update modal cards with current STATE values
 */
function updateModalData() {
  // REMOVED: Modal redesigned as chart-only (no cards to update)
  LogHelper.log('Modal data update skipped (chart-only mode)');
}

/**
 * Render modal pie chart
 */
function renderModalChart() {
  LogHelper.log('Rendering modal chart...');

  const ctx = document.getElementById('modalConsumptionPieChart');
  if (!ctx) {
    LogHelper.warn('Modal chart canvas not found');
    return;
  }

  // Destroy existing instance
  if (modalPieChartInstance) {
    modalPieChartInstance.destroy();
  }

  // RFC-0056: 5 or 6 categories for pie chart (hide Área Comum when water + bathrooms)
  const hideAreaComum = WIDGET_DOMAIN === 'water' && STATE_WATER.includeBathrooms;

  const data = hideAreaComum
    ? [
        STATE.consumidores.climatizacao.total,
        STATE.consumidores.elevadores.total,
        STATE.consumidores.escadasRolantes.total,
        STATE.consumidores.lojas.total,
        STATE.consumidores.outros ? STATE.consumidores.outros.total : 0,
      ]
    : [
        STATE.consumidores.climatizacao.total,
        STATE.consumidores.elevadores.total,
        STATE.consumidores.escadasRolantes.total,
        STATE.consumidores.lojas.total,
        STATE.consumidores.outros ? STATE.consumidores.outros.total : 0,
        STATE.consumidores.areaComum.total,
      ];

  const colors = hideAreaComum
    ? [
        CHART_COLORS.climatizacao,
        CHART_COLORS.elevadores,
        CHART_COLORS.escadasRolantes,
        CHART_COLORS.lojas,
        CHART_COLORS.outros,
      ]
    : [
        CHART_COLORS.climatizacao,
        CHART_COLORS.elevadores,
        CHART_COLORS.escadasRolantes,
        CHART_COLORS.lojas,
        CHART_COLORS.outros,
        CHART_COLORS.areaComum,
      ];

  const labels = hideAreaComum
    ? ['Climatização', 'Elevadores', 'Esc. Rolantes', 'Lojas', 'Outros']
    : ['Climatização', 'Elevadores', 'Esc. Rolantes', 'Lojas', 'Outros', 'Área Comum'];

  modalPieChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: colors,
          borderColor: '#FFFFFF',
          borderWidth: 3,
          hoverOffset: 12,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: 0,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          borderColor: '#00C896',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const perc = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${formatEnergy(value)} (${perc}%)`;
            },
          },
        },
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 800,
        easing: 'easeOutQuart',
      },
    },
  });

  // Render modal legend
  renderModalChartLegend();

  LogHelper.log('Modal chart rendered successfully');
}

/**
 * Render modal chart legend (hide Área Comum when water + bathrooms)
 */
function renderModalChartLegend() {
  const $legend = $J('#modalChartLegend').empty();

  const hideAreaComum = WIDGET_DOMAIN === 'water' && STATE_WATER.includeBathrooms;

  const items = [
    {
      label: 'Climatização',
      color: CHART_COLORS.climatizacao,
      value: STATE.consumidores.climatizacao.total,
      perc: STATE.consumidores.climatizacao.perc,
    },
    {
      label: 'Elevadores',
      color: CHART_COLORS.elevadores,
      value: STATE.consumidores.elevadores.total,
      perc: STATE.consumidores.elevadores.perc,
    },
    {
      label: 'Esc. Rolantes',
      color: CHART_COLORS.escadasRolantes,
      value: STATE.consumidores.escadasRolantes.total,
      perc: STATE.consumidores.escadasRolantes.perc,
    },
    {
      label: 'Lojas',
      color: CHART_COLORS.lojas,
      value: STATE.consumidores.lojas.total,
      perc: STATE.consumidores.lojas.perc,
    },
    {
      label: 'Outros',
      color: CHART_COLORS.outros,
      value: STATE.consumidores.outros ? STATE.consumidores.outros.total : 0,
      perc: STATE.consumidores.outros ? STATE.consumidores.outros.perc : 0,
    },
  ];

  // Only add Área Comum if not hidden
  if (!hideAreaComum) {
    items.push({
      label: 'Área Comum',
      color: CHART_COLORS.areaComum,
      value: STATE.consumidores.areaComum.total,
      perc: STATE.consumidores.areaComum.perc,
    });
  }

  items.forEach((item) => {
    const html = `<div class="legend-item"><div class="legend-color" style="background: ${
      item.color
    }"></div><span class="legend-label">${item.label}:</span><span class="legend-value">${formatEnergy(
      item.value
    )}</span></div>`;
    $legend.append(html);
  });

  LogHelper.log('Modal chart legend rendered (6 categories)');
}

/**
 * Update entire display
 * RFC-0002: Supports both energy and water domains
 */
function updateDisplay() {
  LogHelper.log(`Updating display for domain: ${WIDGET_DOMAIN}...`);

  try {
    // RFC-0002: Domain-specific rendering
    if (WIDGET_DOMAIN === 'water') {
      renderWaterStats();
      renderWaterPieChart();
      LogHelper.log('[RFC-0002 Water] Display updated successfully');
    } else {
      // Default: energy domain
      renderStats();
      renderPieChart();
      LogHelper.log('Display updated successfully');
    }
  } catch (error) {
    LogHelper.error('Error updating display:', error);
  }
}

// ===================== ORCHESTRATOR INTEGRATION =====================

/**
 * Process orchestrator data
 */
function processOrchestratorData(items) {
  LogHelper.log('Processing orchestrator data:', items.length, 'items');

  if (!items || items.length === 0) {
    LogHelper.warn('No data to process');

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
  outros: null,
};

/**
 * Configura listener consolidado para myio:telemetry:update
 * RFC-0056 FIX v1.1: Evento Ãºnico com detail.type discriminador
 */
function setupTelemetryListener() {
  telemetryUpdateHandler = function (ev) {
    const { type, domain, periodKey, timestamp, source, data } = ev.detail || {};

    LogHelper.log(
      `[RFC-0056] Received telemetry update: type=${type}, source=${source}, periodKey=${periodKey}`
    );

    // Validar domÃ­nio
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

  // Fallback: se apÃ³s 3s nÃ£o temos dados completos, solicitar refresh
  startFallbackTimeout();
}

/**
 * Handler: lojas_total
 */
function handleLojasTotal(data, timestamp, periodKey) {
  RECEIVED_DATA.lojas_total = { ...data, timestamp, periodKey };
  LogHelper.log(`[RFC-0056] âœ… Lojas total updated: ${data.total_MWh} MWh`);

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
    periodKey,
  };
  RECEIVED_DATA.elevadores = {
    total: data.elevadores_kWh,
    totalMWh: data.elevadores_MWh,
    timestamp,
    periodKey,
  };
  RECEIVED_DATA.escadas_rolantes = {
    total: data.escadas_rolantes_kWh,
    totalMWh: data.escadas_rolantes_MWh,
    timestamp,
    periodKey,
  };
  RECEIVED_DATA.outros = {
    total: data.outros_kWh,
    totalMWh: data.outros_MWh,
    timestamp,
    periodKey,
  };

  LogHelper.log(`[RFC-0056] âœ… AreaComum breakdown updated:`, {
    climatizacao: data.climatizacao_MWh,
    elevadores: data.elevadores_MWh,
    escadas_rolantes: data.escadas_rolantes_MWh,
    outros: data.outros_MWh,
  });

  // Agendar recalculo com debounce
  scheduleRecalculation();
}

/**
 * Handler: request_refresh
 * Outro widget solicita re-emissÃ£o dos dados (fallback)
 */
function handleRequestRefresh(periodKey) {
  LogHelper.log(`[RFC-0056] Received request_refresh for period: ${periodKey}`);

  // Este widget Ã© receptor, nÃ£o emissor - ignora
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
 * RFC-0056 FIX v1.1: Substitui cÃ¡lculo local por valores recebidos
 */
function recalculateWithReceivedData() {
  LogHelper.log('[RFC-0056] ðŸ”„ Recalculating with received data...');

  // Cancelar fallback timer (dados completos recebidos)
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }

  // Atualizar STATE.consumidores com dados recebidos (RFC-0056: Defensive)
  // Ensure objects exist before setting properties
  if (!STATE.consumidores.lojas) STATE.consumidores.lojas = { total: 0, perc: 0 };
  if (!STATE.consumidores.climatizacao) STATE.consumidores.climatizacao = { total: 0, perc: 0 };
  if (!STATE.consumidores.elevadores) STATE.consumidores.elevadores = { total: 0, perc: 0 };
  if (!STATE.consumidores.escadasRolantes) STATE.consumidores.escadasRolantes = { total: 0, perc: 0 };
  if (!STATE.consumidores.outros) STATE.consumidores.outros = { total: 0, perc: 0 };

  STATE.consumidores.lojas.total = RECEIVED_DATA.lojas_total?.total_kWh || 0;
  STATE.consumidores.climatizacao.total = RECEIVED_DATA.climatizacao?.total || 0;
  STATE.consumidores.elevadores.total = RECEIVED_DATA.elevadores?.total || 0;
  STATE.consumidores.escadasRolantes.total = RECEIVED_DATA.escadas_rolantes?.total || 0;
  STATE.consumidores.outros.total = RECEIVED_DATA.outros?.total || 0;

  // Recalcular Ãrea Comum como residual (RFC-0056: Defensive calculation)
  const somaConsumidores =
    (STATE.consumidores.lojas?.total || 0) +
    (STATE.consumidores.climatizacao?.total || 0) +
    (STATE.consumidores.elevadores?.total || 0) +
    (STATE.consumidores.escadasRolantes?.total || 0) +
    (STATE.consumidores.outros?.total || 0);

  if (!STATE.consumidores.areaComum) STATE.consumidores.areaComum = { total: 0, perc: 0 };
  STATE.consumidores.areaComum.total = Math.max(0, STATE.entrada.total - somaConsumidores);

  // RFC-0056: When water domain has bathrooms, consolidate área comum into "outros"
  if (WIDGET_DOMAIN === 'water' && STATE_WATER.includeBathrooms && STATE.consumidores.areaComum.total > 0) {
    LogHelper.log(
      `[RFC-0056] Consolidating área comum (${STATE.consumidores.areaComum.total.toFixed(2)}) into outros`
    );
    STATE.consumidores.outros.total += STATE.consumidores.areaComum.total;
    LogHelper.log(`[RFC-0056] New outros total: ${STATE.consumidores.outros.total.toFixed(2)}`);
    // Set areaComum to 0 since it's now consolidated into outros
    STATE.consumidores.areaComum.total = 0;
  }

  // Recalcular total geral (SEM incluir entrada)
  // Note: Must recalculate if we consolidated área comum into outros
  const finalSomaConsumidores =
    (STATE.consumidores.lojas?.total || 0) +
    (STATE.consumidores.climatizacao?.total || 0) +
    (STATE.consumidores.elevadores?.total || 0) +
    (STATE.consumidores.escadasRolantes?.total || 0) +
    (STATE.consumidores.outros?.total || 0);

  STATE.consumidores.totalGeral = finalSomaConsumidores + STATE.consumidores.areaComum.total;

  // Recalcular percentuais (RFC-0056: Baseados em Total Consumidores, nÃ£o em Entrada)
  const totalConsumidores = STATE.consumidores.totalGeral;
  STATE.consumidores.lojas.perc =
    totalConsumidores > 0 ? (STATE.consumidores.lojas.total / totalConsumidores) * 100 : 0;
  STATE.consumidores.climatizacao.perc =
    totalConsumidores > 0 ? (STATE.consumidores.climatizacao.total / totalConsumidores) * 100 : 0;
  STATE.consumidores.elevadores.perc =
    totalConsumidores > 0 ? (STATE.consumidores.elevadores.total / totalConsumidores) * 100 : 0;
  STATE.consumidores.escadasRolantes.perc =
    totalConsumidores > 0 ? (STATE.consumidores.escadasRolantes.total / totalConsumidores) * 100 : 0;
  STATE.consumidores.outros.perc =
    totalConsumidores > 0 ? (STATE.consumidores.outros.total / totalConsumidores) * 100 : 0;
  STATE.consumidores.areaComum.perc =
    totalConsumidores > 0 ? (STATE.consumidores.areaComum.total / totalConsumidores) * 100 : 0;
  STATE.consumidores.percGeral = 100; // Total Consumidores Ã© sempre 100% de si mesmo

  // ValidaÃ§Ã£o: Total consumidores vs Entrada
  const diff = Math.abs(STATE.entrada.total - STATE.consumidores.totalGeral);
  const tolerance = STATE.entrada.total * 0.02; // 2%

  if (diff > tolerance) {
    LogHelper.warn(
      `[RFC-0056] Validation warning: Entrada (${STATE.entrada.total.toFixed(
        2
      )} kWh) != Total Consumidores (${STATE.consumidores.totalGeral.toFixed(2)} kWh), diff: ${diff.toFixed(
        2
      )} kWh`
    );
    showValidationWarning(diff);
  } else {
    hideValidationWarning();
  }

  // Atualizar display
  updateDisplay();

  LogHelper.log('[RFC-0056] âœ… Recalculation complete');
}

// ===================== RFC-0002: WATER DOMAIN FUNCTIONS =====================

/**
 * RFC-0002: Process water telemetry data from TELEMETRY widgets
 * @param {Object} eventDetail - Event detail with context, total, devices, periodKey, banheirosBreakdown
 */
function processWaterTelemetryData(eventDetail) {
  const { context, total, devices, periodKey, banheirosBreakdown } = eventDetail;

  LogHelper.log(
    `[RFC-0002 Water] Received data: context=${context}, total=${total} m³, devices=${devices?.length || 0}`
  );

  // Validate period key
  if (periodKey && STATE_WATER.periodKey && periodKey !== STATE_WATER.periodKey) {
    LogHelper.warn(
      `[RFC-0002 Water] Period mismatch: received ${periodKey}, current ${STATE_WATER.periodKey}`
    );
    return;
  }

  // Set period key if first time
  if (!STATE_WATER.periodKey) {
    STATE_WATER.periodKey = periodKey;
  }

  // Update state based on context
  switch (context) {
    case 'entrada':
      STATE_WATER.entrada.total = total || 0;
      STATE_WATER.entrada.devices = devices || [];
      STATE_WATER.entrada.perc = 100; // Always 100% of itself
      break;

    case 'lojas':
      STATE_WATER.lojas.total = total || 0;
      STATE_WATER.lojas.devices = devices || [];
      break;

    case 'areaComum':
      // RFC-0002: Extract banheiros from areaComum breakdown (devices classified by label/identifier)
      if (banheirosBreakdown && STATE_WATER.includeBathrooms) {
        // Banheiros data from areaComum widget (devices with "banheiro" in label/identifier)
        STATE_WATER.banheiros.total = banheirosBreakdown.banheiros?.total || 0;
        STATE_WATER.banheiros.devices = banheirosBreakdown.banheiros?.devices || [];
        LogHelper.log(
          `[RFC-0002 Water] Banheiros extracted from areaComum: ${STATE_WATER.banheiros.total.toFixed(
            2
          )} m³ (${STATE_WATER.banheiros.devices.length} devices)`
        );

        // Área Comum = only outros (non-bathroom devices)
        STATE_WATER.areaComum.total = banheirosBreakdown.outros?.total || 0;
        STATE_WATER.areaComum.devices = banheirosBreakdown.outros?.devices || [];
        LogHelper.log(
          `[RFC-0002 Water] Área Comum (outros): ${STATE_WATER.areaComum.total.toFixed(2)} m³ (${
            STATE_WATER.areaComum.devices.length
          } devices)`
        );
      } else {
        // No breakdown or banheiros disabled - use full areaComum
        STATE_WATER.areaComum.total = total || 0;
        STATE_WATER.areaComum.devices = devices || [];
      }
      break;

    default:
      LogHelper.warn(`[RFC-0002 Water] Unknown context: ${context}`);
      return;
  }

  // Recalculate pontos não mapeados and percentages
  calculateWaterPontosNaoMapeados();
  calculateWaterPercentages();

  // Update last update timestamp
  STATE_WATER.lastUpdate = new Date().toISOString();

  // Update display
  updateDisplay();

  LogHelper.log(`[RFC-0002 Water] State updated:`, {
    entrada: STATE_WATER.entrada.total,
    lojas: STATE_WATER.lojas.total,
    banheiros: STATE_WATER.banheiros.total,
    areaComum: STATE_WATER.areaComum.total,
    pontosNaoMapeados: STATE_WATER.pontosNaoMapeados.total,
  });
}

/**
 * RFC-0002: Calculate "Pontos Não Mapeados" as residual
 * Formula: entrada - (lojas + banheiros + areaComum) when includeBathrooms is true
 * Formula: entrada - (lojas + areaComum) when includeBathrooms is false
 */
function calculateWaterPontosNaoMapeados() {
  const entrada = STATE_WATER.entrada.total;
  const lojas = STATE_WATER.lojas.total;
  const banheiros = STATE_WATER.includeBathrooms ? STATE_WATER.banheiros.total : 0;
  const areaComum = STATE_WATER.areaComum.total;

  // Sum of measured points (includes banheiros only if enabled)
  const medidosTotal = lojas + banheiros + areaComum;

  // Residual (difference)
  const naoMapeados = entrada - medidosTotal;

  // Check for inconsistency (negative indicates measurement error)
  const hasInconsistency = naoMapeados < 0;

  STATE_WATER.pontosNaoMapeados.total = hasInconsistency ? 0 : naoMapeados;
  STATE_WATER.pontosNaoMapeados.hasInconsistency = hasInconsistency;

  // Update grand total (sum of all measured, excluding entrada)
  STATE_WATER.grandTotal = medidosTotal + (hasInconsistency ? 0 : naoMapeados);

  if (hasInconsistency) {
    LogHelper.warn(
      `[RFC-0002 Water] [WARNING] Inconsistency detected: entrada (${entrada} m³) < medidos (${medidosTotal} m³)`
    );
  }

  LogHelper.log(
    `[RFC-0002 Water] Calculated pontos não mapeados: ${STATE_WATER.pontosNaoMapeados.total.toFixed(2)} m³`
  );
}

/**
 * RFC-0002: Calculate percentages relative to entrada
 */
function calculateWaterPercentages() {
  const entrada = STATE_WATER.entrada.total;

  if (entrada === 0) {
    // No entrada, all percentages are 0
    STATE_WATER.lojas.perc = 0;
    STATE_WATER.banheiros.perc = 0;
    STATE_WATER.areaComum.perc = 0;
    STATE_WATER.pontosNaoMapeados.perc = 0;
    return;
  }

  // Percentage relative to entrada
  STATE_WATER.lojas.perc = (STATE_WATER.lojas.total / entrada) * 100;
  STATE_WATER.banheiros.perc = (STATE_WATER.banheiros.total / entrada) * 100;
  STATE_WATER.areaComum.perc = (STATE_WATER.areaComum.total / entrada) * 100;
  STATE_WATER.pontosNaoMapeados.perc = (STATE_WATER.pontosNaoMapeados.total / entrada) * 100;

  LogHelper.log(`[RFC-0002 Water] Percentages:`, {
    lojas: STATE_WATER.lojas.perc.toFixed(1) + '%',
    banheiros: STATE_WATER.banheiros.perc.toFixed(1) + '%',
    areaComum: STATE_WATER.areaComum.perc.toFixed(1) + '%',
    naoMapeados: STATE_WATER.pontosNaoMapeados.perc.toFixed(1) + '%',
  });
}

/**
 * RFC-0002: Render water stats (5 cards with banheiros)
 * Reuses existing HTML structure but hides energy-only cards
 * Order: Entrada - Lojas - Banheiros - Área Comum - Pontos Não Mapeados
 */
function renderWaterStats() {
  LogHelper.log('[RFC-0002 Water] Rendering stats...');

  // Hide energy-only cards
  $$('.climatizacao-card').hide();
  $$('.elevadores-card').hide();
  $$('.escadas-card').hide();
  $$('.outros-card').hide();

  // Show/hide banheiros card based on setting
  if (STATE_WATER.includeBathrooms) {
    $$('.banheiros-card').show();
  } else {
    $$('.banheiros-card').hide();
  }

  // Update Entrada card
  $$('#entradaTotal').text(formatValue(STATE_WATER.entrada.total, 'water'));

  // Update Lojas card
  $$('#lojasTotal').text(formatValue(STATE_WATER.lojas.total, 'water'));
  $$('#lojasPerc').text(`(${STATE_WATER.lojas.perc.toFixed(1)}%)`);

  // Update Banheiros card (only if enabled)
  if (STATE_WATER.includeBathrooms) {
    $$('#banheirosTotal').text(formatValue(STATE_WATER.banheiros.total, 'water'));
    $$('#banheirosPerc').text(`(${STATE_WATER.banheiros.perc.toFixed(1)}%)`);
  }

  // Reuse "área comum" card for water área comum
  $$('#areaComumTotal').text(formatValue(STATE_WATER.areaComum.total, 'water'));
  $$('#areaComumPerc').text(`(${STATE_WATER.areaComum.perc.toFixed(1)}%)`);

  // RFC-0056: Hide Área Comum card when bathrooms are included
  // Consolidate área comum into "Pontos não mapeados" instead
  if (STATE_WATER.includeBathrooms) {
    $$('.area-comum-card').hide();
    LogHelper.log('[RFC-0056] Hiding Área Comum card (water domain with bathrooms)');
  } else {
    $$('.area-comum-card').show();
    LogHelper.log('[RFC-0056] Showing Área Comum card (water domain without bathrooms)');
  }

  // Reuse "total consumidores" card for "pontos não mapeados"
  const $totalCard = $$('.total-card .card-title');
  if ($totalCard.length > 0) {
    $totalCard.text('Pontos Não Mapeados');
  }
  $$('#consumidoresTotal').text(formatValue(STATE_WATER.pontosNaoMapeados.total, 'water'));
  $$('#consumidoresPerc').text(`(${STATE_WATER.pontosNaoMapeados.perc.toFixed(1)}%)`);

  // Show warning if inconsistency
  if (STATE_WATER.pontosNaoMapeados.hasInconsistency) {
    const $totalCardTitle = $$('.total-card .card-title');
    if ($totalCardTitle.length && !$totalCardTitle.find('.validation-warning').length) {
      $totalCardTitle.append(
        ' <span class="validation-warning" style="color: #FF6B6B; font-size: 0.9em;" title="Inconsistência: soma dos medidos > entrada">[WARNING]</span>'
      );
    }
  } else {
    $$('.total-card .validation-warning').remove();
  }

  LogHelper.log('[RFC-0002 Water] Stats rendered');
}

/**
 * RFC-0002: Render water pie chart (5 contexts with banheiros)
 */
function renderWaterPieChart() {
  LogHelper.log('[RFC-0002 Water] Rendering pie chart...');

  // Get colors from settings or use defaults
  const colors = {
    lojas: self.ctx.settings?.waterChartColors?.lojas || '#FFC107',
    banheiros: self.ctx.settings?.waterChartColors?.banheiros || '#2196F3',
    areaComum: self.ctx.settings?.waterChartColors?.areaComum || '#4CAF50',
    pontosNaoMapeados: self.ctx.settings?.waterChartColors?.pontosNaoMapeados || '#9E9E9E',
  };

  // Build chart data based on includeBathrooms setting
  const chartData = [
    { label: 'Lojas', color: colors.lojas, value: STATE_WATER.lojas.total, perc: STATE_WATER.lojas.perc },
  ];

  // Add banheiros if enabled
  if (STATE_WATER.includeBathrooms) {
    chartData.push({
      label: 'Banheiros',
      color: colors.banheiros,
      value: STATE_WATER.banheiros.total,
      perc: STATE_WATER.banheiros.perc,
    });
  }

  // Add remaining contexts
  chartData.push(
    {
      label: 'Área Comum',
      color: colors.areaComum,
      value: STATE_WATER.areaComum.total,
      perc: STATE_WATER.areaComum.perc,
    },
    {
      label: 'Pontos Não Mapeados',
      color: colors.pontosNaoMapeados,
      value: STATE_WATER.pontosNaoMapeados.total,
      perc: STATE_WATER.pontosNaoMapeados.perc,
    }
  );

  // Filter out zero values
  const validData = chartData.filter((item) => item.value > 0);

  if (validData.length === 0) {
    LogHelper.warn('[RFC-0002 Water] No data to render chart');
    return;
  }

  // Render main widget chart
  const chartCanvas = $$('#consumptionPieChart')[0];
  if (chartCanvas) {
    if (pieChartInstance) {
      pieChartInstance.destroy();
    }

    pieChartInstance = new Chart(chartCanvas.getContext('2d'), {
      type: 'pie',
      data: {
        labels: validData.map((item) => item.label),
        datasets: [
          {
            data: validData.map((item) => item.value),
            backgroundColor: validData.map((item) => item.color),
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || '';
                const value = formatValue(context.parsed, 'water');
                const perc = validData[context.dataIndex].perc.toFixed(1);
                return `${label}: ${value} (${perc}%)`;
              },
            },
          },
        },
      },
    });
  }

  // Render legend
  const $legend = $$('#chartLegend');
  if ($legend.length > 0) {
    $legend.empty();
    validData.forEach((item) => {
      $legend.append(`
        <div class="legend-item">
          <span class="legend-color" style="background-color: ${item.color};"></span>
          <span class="legend-label">${item.label}</span>
          <span class="legend-value">${formatValue(item.value, 'water')} (${item.perc.toFixed(1)}%)</span>
        </div>
      `);
    });
  }

  LogHelper.log('[RFC-0002 Water] Pie chart rendered');
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
      LogHelper.log('[RFC-0056] ðŸ“¦ Loaded lojas from cache');
    }

    if (cachedAreaComum) {
      const payload = JSON.parse(cachedAreaComum);
      handleAreaComumBreakdown(payload.data, payload.timestamp, payload.periodKey);
      LogHelper.log('[RFC-0056] ðŸ“¦ Loaded areacomum from cache');
    }
  } catch (err) {
    LogHelper.warn('[RFC-0056] Cache load failed:', err);
  }
}

/**
 * Inicia timer de fallback (3s)
 * RFC-0056 FIX v1.1: Se apÃ³s 3s nÃ£o recebemos dados, emite request_refresh
 */
function startFallbackTimeout() {
  fallbackTimer = setTimeout(() => {
    if (!canRecalculate()) {
      LogHelper.warn('[RFC-0056] â±ï¸ Fallback timeout - requesting refresh');

      const periodKey = buildCurrentPeriodKey();
      const event = new CustomEvent('myio:telemetry:update', {
        detail: {
          type: 'request_refresh',
          domain: WIDGET_DOMAIN,
          periodKey: periodKey,
          timestamp: Date.now(),
          source: 'TELEMETRY_INFO',
        },
        bubbles: true,
        cancelable: false,
      });

      window.dispatchEvent(event);
    }
  }, 3000);
}

/**
 * ConstrÃ³i periodKey atual baseado no timewindow do widget
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
 * Exibe marker de warning de validaÃ§Ã£o na UI
 * RFC-0056 FIX v1.1: Ajuda debugging sem console
 */
function showValidationWarning(diff) {
  // Adicionar warning icon no card Total Consumidores
  const $totalCard = $$('.total-card .card-title');
  if ($totalCard.length && !$totalCard.find('.validation-warning').length) {
    $totalCard.append(
      ' <span class="validation-warning" style="color: #FF6B6B; font-size: 0.9em;" title="DiferenÃ§a de ' +
        diff.toFixed(2) +
        ' kWh detectada">!</span>'
    );
  }
}

/**
 * Remove marker de warning
 */
function hideValidationWarning() {
  $$('.validation-warning').remove();
}

// ===================== WIDGET LIFECYCLE =====================

self.onInit = async function () {
  LogHelper.log('Widget initializing (RFC-0056)...');

  // RFC-0056 FIX: Expose openModal globally IMMEDIATELY for onclick handler
  window.TELEMETRY_INFO_openModal = openModal;
  window.TELEMETRY_INFO_closeModal = closeModal;
  LogHelper.log('âœ… Modal functions exposed globally');

  // RFC-0056 FIX: Move modal to body immediately (but keep it hidden) to escape widget constraints
  setTimeout(() => {
    const $modal = $J('#modalExpanded');
    if ($modal.length > 0 && $modal.parent()[0] !== document.body) {
      console.log('[TELEMETRY_INFO] ðŸ“¦ INIT: Moving modal to body (keeping it hidden)');
      $modal.detach().appendTo(document.body);
      // Ensure it stays hidden with ULTRA z-index
      $modal.css({
        display: 'none',
        'z-index': '2147483647', // Maximum 32-bit integer
      });
      console.log('[TELEMETRY_INFO] âœ… INIT: Modal moved to body and hidden with max z-index');
    }
  }, 100);

  // Setup container styles
  $root().css({
    height: '100%',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  });

  // Load settings
  WIDGET_DOMAIN = self.ctx.settings?.DOMAIN || 'energy';
  SHOW_DEVICES_LIST = self.ctx.settings?.showDevicesList || false;

  // RFC-0002: Water domain - load banheiros setting
  STATE_WATER.includeBathrooms = self.ctx.settings?.waterIncludeBathrooms || false;
  LogHelper.log(`[RFC-0002 Water] includeBathrooms setting: ${STATE_WATER.includeBathrooms}`);

  // RFC-0056: Load chart colors (with defaults) - 6 categories
  CHART_COLORS = {
    climatizacao: self.ctx.settings?.chartColors?.climatizacao || '#00C896',
    elevadores: self.ctx.settings?.chartColors?.elevadores || '#5B2EBC',
    escadasRolantes: self.ctx.settings?.chartColors?.escadasRolantes || '#FF6B6B',
    lojas: self.ctx.settings?.chartColors?.lojas || '#FFC107',
    outros: self.ctx.settings?.chartColors?.outros || '#9C27B0',
    areaComum: self.ctx.settings?.chartColors?.areaComum || '#4CAF50',
  };

  LogHelper.log('Settings loaded:', {
    domain: WIDGET_DOMAIN,
    showDevicesList: SHOW_DEVICES_LIST,
    chartColors: CHART_COLORS,
  });

  // RFC-0056: Migration - Ensure 'outros' exists in STATE (for backwards compatibility)
  if (!STATE.consumidores.outros) {
    LogHelper.warn("[RFC-0056] Migration: Adding 'outros' to STATE.consumidores");
    STATE.consumidores.outros = { devices: [], total: 0, perc: 0 };
  }
  if (!RECEIVED_DATA.outros) {
    RECEIVED_DATA.outros = null;
  }

  // RFC-0002: Set widget label (dynamic based on domain)
  const domainConfig = getDomainLabel(WIDGET_DOMAIN);

  // Priority: 1) Manual config from settings, 2) Auto from domain
  const widgetLabel =
    self.ctx.settings?.labelWidget || `${domainConfig.icon} Informações de ${domainConfig.title}`;
  const modalLabel = self.ctx.settings?.modalTitle || `Distribuição de Consumo de ${domainConfig.title}`;

  // Update header title
  const $infoTitle = $root().find('.info-title');
  if ($infoTitle.length > 0) {
    $infoTitle.html(widgetLabel);
  }

  // Update modal title (using ID for safer targeting)
  const $modalTitle = $J('#modalTitleHeader');
  if ($modalTitle.length > 0) {
    $modalTitle.text(modalLabel);
  }

  LogHelper.log(`[RFC-0002] Títulos atualizados: domain=${WIDGET_DOMAIN}, title=${domainConfig.title}`);

  // Listen for orchestrator data
  dataProvideHandler = function (ev) {
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

  // RFC-0002: Listen for water domain events
  if (WIDGET_DOMAIN === 'water') {
    waterProvideHandler = function (ev) {
      const { domain, context } = ev.detail;

      // Only process water domain
      if (domain !== 'water') {
        LogHelper.log(`[RFC-0002 Water] Ignoring event for domain: ${domain}`);
        return;
      }

      LogHelper.log(`[RFC-0002 Water] Received event: context=${context}, domain=${domain}`);

      processWaterTelemetryData(ev.detail);
    };

    window.addEventListener('myio:telemetry:provide-water', waterProvideHandler);
    LogHelper.log('[RFC-0002 Water] Listener configured for myio:telemetry:provide-water');
  }

  // Listen for clear cache event from HEADER
  clearCacheHandler = function (ev) {
    const { domain } = ev.detail || {};

    // Only process if it's for my domain
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(`Ignoring clear event for domain: ${domain} (expecting: ${WIDGET_DOMAIN})`);
      return;
    }

    LogHelper.log(`[CLEAR] Received clear cache event for domain: ${domain}`);

    // RFC-0002: Clear domain-specific STATE
    if (domain === 'water') {
      // Clear water state
      STATE_WATER.entrada = {
        context: 'entrada',
        devices: [],
        total: 0,
        perc: 100,
        source: 'widget-telemetry-entrada',
      };
      STATE_WATER.lojas = {
        context: 'lojas',
        devices: [],
        total: 0,
        perc: 0,
        source: 'widget-telemetry-lojas',
      };
      STATE_WATER.banheiros = {
        context: 'banheiros',
        devices: [],
        total: 0,
        perc: 0,
        source: 'widget-telemetry-area-comum (banheiros breakdown)',
      };
      STATE_WATER.areaComum = {
        context: 'areaComum',
        devices: [],
        total: 0,
        perc: 0,
        source: 'widget-telemetry-area-comum (outros)',
      };
      STATE_WATER.pontosNaoMapeados = {
        context: 'pontosNaoMapeados',
        devices: [],
        total: 0,
        perc: 0,
        isCalculated: true,
        hasInconsistency: false,
      };
      STATE_WATER.grandTotal = 0;
      STATE_WATER.periodKey = null;
      STATE_WATER.lastUpdate = null;
      // Note: includeBathrooms is preserved from settings, not cleared
      LogHelper.log('[CLEAR] Water state cleared');
    } else {
      // Clear energy state (default)
      STATE.entrada = { devices: [], total: 0, perc: 100 };
      STATE.consumidores = {
        climatizacao: { devices: [], total: 0, perc: 0 },
        elevadores: { devices: [], total: 0, perc: 0 },
        escadasRolantes: { devices: [], total: 0, perc: 0 },
        lojas: { devices: [], total: 0, perc: 0 },
        outros: { devices: [], total: 0, perc: 0 },
        areaComum: { devices: [], total: 0, perc: 0 },
        totalGeral: 0,
        percGeral: 0,
      };

      // Clear RECEIVED_DATA
      RECEIVED_DATA.entrada = null;
      RECEIVED_DATA.climatizacao = null;
      RECEIVED_DATA.elevadores = null;
      RECEIVED_DATA.escadasRolantes = null;
      RECEIVED_DATA.lojas = null;
      RECEIVED_DATA.outros = null;

      LogHelper.log('[CLEAR] Energy state cleared');
    }

    // Reset period key
    lastProcessedPeriodKey = null;

    // Update display with cleared data
    updateDisplay();

    LogHelper.log('[CLEAR] ✅ Widget data cleared and display updated');
  };

  window.addEventListener('myio:telemetry:clear', clearCacheHandler);

  // RFC-0056 FIX v1.1: Listen for consolidated telemetry updates
  setupTelemetryListener();

  // Listen for date updates
  dateUpdateHandler = function (ev) {
    LogHelper.log('Date updated:', ev.detail);

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
        LogHelper.log('Using stored orchestrator data (age:', age, 'ms)');
        processOrchestratorData(storedData.items);
      } else {
        LogHelper.log('Stored data is stale or empty (age:', age, 'ms)');
      }
    } else {
      LogHelper.log('No stored orchestrator data found');
    }
  }, 500);

  // Setup modal event listeners (RFC-0056: Using event delegation for robustness)
  const $container = $root();

  LogHelper.log('Setting up modal event listeners...');
  LogHelper.log('Container:', $container.length > 0 ? 'found' : 'NOT FOUND');

  // RFC-0056 FIX: Immediate button binding (no setTimeout)
  // Use multiple selectors to ensure button is found
  const bindExpandButton = () => {
    // Try multiple selection strategies
    const $btn1 = $container.find('#btnExpandModal');
    const $btn2 = $container.find('.btn-expand');
    const $btn3 = $root().find('#btnExpandModal');

    const $btn = $btn1.length > 0 ? $btn1 : $btn2.length > 0 ? $btn2 : $btn3;

    LogHelper.log('Expand button found:', $btn.length > 0 ? 'YES' : 'NO');

    if ($btn.length > 0) {
      LogHelper.log('Button HTML:', $btn[0].outerHTML);

      // DIRECT binding (no delegation needed since button is in widget container)
      $btn.off('click').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[TELEMETRY_INFO] âœ… DIRECT Expand button clicked!'); // Force log
        openModal();
      });
      LogHelper.log('âœ… Direct click handler attached to button');
      return true;
    } else {
      LogHelper.error('âŒ Button #btnExpandModal NOT FOUND in container!');
      return false;
    }
  };

  // Try binding immediately
  if (!bindExpandButton()) {
    // If not found, retry after DOM settles
    setTimeout(bindExpandButton, 100);
    setTimeout(bindExpandButton, 500);
    setTimeout(bindExpandButton, 1000);
  }

  // Expand button - use delegation on container (PRIMARY)
  $container.on('click', '#btnExpandModal, .btn-expand', function (e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('[TELEMETRY_INFO] âœ… DELEGATED Expand button clicked!'); // Force log even if DEBUG off
    LogHelper.log('Expand button clicked (delegated)');
    openModal();
  });

  // Fallback: native DOM listener directly on the element (in case jQuery delegation fails)
  const nativeBtn = document.getElementById('btnExpandModal');
  if (nativeBtn) {
    nativeBtn.addEventListener(
      'click',
      function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[TELEMETRY_INFO] âœ… NATIVE Expand button clicked!');
        openModal();
      },
      { capture: false }
    );
  }
  // Also bind by class, in case id changes or duplicates
  const nativeBtnsByClass = document.getElementsByClassName('btn-expand');
  if (nativeBtnsByClass && nativeBtnsByClass.length) {
    Array.prototype.forEach.call(nativeBtnsByClass, function (el) {
      el.addEventListener(
        'click',
        function (e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('[TELEMETRY_INFO] âœ… NATIVE(.btn-expand) Expand button clicked!');
          openModal();
        },
        { capture: false }
      );
    });
  }

  // Ultimate fallback: capture-phase on window to intercept the click
  window.addEventListener(
    'click',
    function (e) {
      const t = e.target;
      if (!t) return;
      // match self or svg/path inside the button
      let btn = t.id === 'btnExpandModal' ? t : t.closest ? t.closest('#btnExpandModal') : null;
      if (!btn && t.closest) {
        btn = t.closest('.btn-expand');
      }
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[TELEMETRY_INFO] âœ… CAPTURE Expand button clicked!');
        openModal();
      }
    },
    true
  );

  // Close button - delegate to body since modal moves there
  $J('body').on('click', '#btnCloseModal', function (e) {
    e.preventDefault();
    e.stopPropagation();
    LogHelper.log('Close button clicked');
    closeModal();
  });

  // Close modal on overlay click
  $J('body').on('click', '#modalExpanded', function (e) {
    if (e.target.id === 'modalExpanded') {
      LogHelper.log('Modal overlay clicked');
      closeModal();
    }
  });

  // Close modal on ESC key
  $J(document).on('keydown.telemetryInfoModal', function (e) {
    if (e.key === 'Escape' && $J('#modalExpanded').css('display') === 'flex') {
      LogHelper.log('ESC key pressed - closing modal');
      closeModal();
    }
  });

  LogHelper.log('Widget initialized successfully (RFC-0056)');
};

self.onDataUpdated = function () {
  // No-op: We rely on orchestrator events, not ThingsBoard datasources
  LogHelper.log('onDataUpdated called (no-op in orchestrator mode)');
};

self.onResize = function () {
  LogHelper.log('Widget resized');

  // Resize chart if it exists
  if (pieChartInstance) {
    try {
      pieChartInstance.resize();
      LogHelper.log('Chart resized');
    } catch (error) {
      LogHelper.warn('Error resizing chart:', error);
    }
  }
};

self.onDestroy = function () {
  LogHelper.log('Widget destroying...');

  // Remove event listeners
  if (dateUpdateHandler) {
    window.removeEventListener('myio:update-date', dateUpdateHandler);
    dateUpdateHandler = null;
  }

  if (dataProvideHandler) {
    window.removeEventListener('myio:telemetry:provide-data', dataProvideHandler);
    dataProvideHandler = null;
  }

  if (clearCacheHandler) {
    window.removeEventListener('myio:telemetry:clear', clearCacheHandler);
    clearCacheHandler = null;
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
      LogHelper.log('Chart destroyed');
    } catch (error) {
      LogHelper.warn('Error destroying chart:', error);
    }
  }

  // Destroy modal chart
  if (modalPieChartInstance) {
    try {
      modalPieChartInstance.destroy();
      modalPieChartInstance = null;
      LogHelper.log('Modal chart destroyed');
    } catch (error) {
      LogHelper.warn('Error destroying modal chart:', error);
    }
  }

  // Remove modal event listeners (RFC-0056: Cleanup delegated events)
  try {
    const $container = $root();
    $container.off('click', '#btnExpandModal');
    $J('body').off('click', '#btnCloseModal');
    $J('body').off('click', '#modalExpanded');
    $J(document).off('keydown.telemetryInfoModal');
    LogHelper.log('Modal event listeners removed');
  } catch (error) {
    LogHelper.warn('Error removing modal listeners:', error);
  }

  // Remove modal from body if it was moved there
  try {
    const $modal = $J('#modalExpanded');
    if ($modal.parent()[0] === document.body) {
      LogHelper.log('Removing modal from body');
      $modal.remove();
    }
  } catch (error) {
    LogHelper.warn('Error removing modal from body:', error);
  }

  // Clear jQuery event handlers
  try {
    $root().off();
  } catch {
    // jQuery cleanup may fail if element no longer exists
  }

  LogHelper.log('Widget destroyed successfully');
};
