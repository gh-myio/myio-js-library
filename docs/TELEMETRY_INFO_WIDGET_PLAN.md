# TELEMETRY_INFO Widget - Plano de Implementação

## 📋 Resumo Executivo

**Objetivo**: Criar um novo widget `TELEMETRY_INFO` que consolida informações de entrada e consumidores (área comum/equipamentos + lojas) em um único card informativo, similar ao card "ℹ️ Informações" da v.3.6.0, mas integrado ao orquestrador da v-5.2.0.

**Data**: 2025-10-17
**Versão Alvo**: v-5.2.0
**Status**: 🎯 Plano em Análise

---

## 🎯 Contexto e Requisitos

### Situação Atual (v.3.6.0)

No dashboard antigo, o **state `telemetry_content`** possui 3 widgets separados:

1. **Widget 1: Entrada Energia** (Alias: `Entrada Energia`)
   - Mostra dispositivos de **entrada** (medidores, subestações, relógios)
   - Função: Medir a energia total que **entra** no shopping

2. **Widget 2: Área Comum + Equipamentos** (Alias: `AreaComum_Asset`)
   - Mostra consumo de:
     - **Área comum** (iluminação, elevadores, escadas rolantes, ar condicionado central)
     - **Equipamentos prediais** (bombas, chillers, administração)
   - Função: Medir consumo de infraestrutura compartilhada

3. **Widget 3: Lojas** (Alias: Lojas/Stores)
   - Mostra consumo de **devices de lojas individuais**
   - Função: Medir consumo de cada loja

### Card "ℹ️ Informações" (v.3.6.0)

Localizado em `v.3.6.0\WIDGET\ENERGY\template.html` (linhas 79-86):

```html
<div class="group-card area-comum">
  <div class="group-title">ℹ️ Informações</div>
  <div class="card-list" id="area-comum-list"></div>
  <div class="area-pie-card">
    <canvas id="areaChart" class="area-pie"></canvas>
    <ul id="areaLegend" class="chart-legend"></ul>
  </div>
</div>
```

**Características**:
- Exibe um **gráfico de pizza** (pie chart) mostrando distribuição de consumo
- Lista textual dos dispositivos/grupos
- Totalizações visuais
- Design compacto e informativo

---

## 🏗️ Arquitetura do Novo Widget TELEMETRY_INFO

### Localização

```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/
├── controller.js       # Lógica principal
├── template.html       # Estrutura HTML
├── style.css          # Estilos visuais
└── settings.schema    # Configurações do widget
```

### Estrutura de Dados

#### Entrada de Dados (Data Sources)

O widget receberá dados do **MyIO Orchestrator** via eventos `myio:telemetry:provide-data`:

```typescript
interface OrchestratorData {
  domain: 'energy';
  periodKey: string;
  items: TelemetryItem[];
}

interface TelemetryItem {
  id: string;              // ThingsBoard device ID
  ingestionId: string;     // API ingestion ID
  tbId: string;           // ThingsBoard entity ID
  identifier: string;      // Device identifier
  label: string;          // Display name
  value: number;          // Consumption value (kWh)
  deviceType: 'energy';
  slaveId?: string;
  centralId?: string;
  centralName?: string;
  category?: 'entrada' | 'area_comum' | 'equipamentos' | 'lojas';
}
```

#### Classificação de Dispositivos

O widget classificará os devices em 4 categorias baseado no `label` ou `identifier`:

```javascript
// Categorias
const CATEGORIES = {
  ENTRADA: 'entrada',           // Relógios, subestações, medidores
  AREA_COMUM: 'area_comum',     // Área comum, iluminação geral, etc
  EQUIPAMENTOS: 'equipamentos', // Bombas, chillers, administração
  LOJAS: 'lojas'               // Dispositivos de lojas
};

// Função de classificação (similar ao v.3.6.0)
function classifyDevice(labelOrName = "") {
  const s = normalizeLabel(labelOrName); // Remove acentos, lowercase

  // Entrada
  if (/\brelogio\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/subesta/.test(s)) return CATEGORIES.ENTRADA;
  if (/entrada/.test(s)) return CATEGORIES.ENTRADA;

  // Equipamentos
  if (/bomba|chiller/.test(s)) return CATEGORIES.EQUIPAMENTOS;
  if (/administra/.test(s)) return CATEGORIES.EQUIPAMENTOS;

  // Área Comum
  if (/area comum/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/iluminacao/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/elevador/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/escada/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/ar condicionado/.test(s)) return CATEGORIES.AREA_COMUM;

  // Default: Loja
  return CATEGORIES.LOJAS;
}
```

### Agregação e Cálculos

```javascript
// State do widget
const STATE = {
  entrada: {
    devices: [],
    total: 0,
    perc: 0
  },
  consumidores: {
    areaComum: {
      devices: [],
      total: 0,
      perc: 0
    },
    equipamentos: {
      devices: [],
      total: 0,
      perc: 0
    },
    lojas: {
      devices: [],
      total: 0,
      perc: 0
    },
    totalGeral: 0,
    percGeral: 0
  },
  grandTotal: 0
};

// Função de agregação
function aggregateData(items) {
  // 1. Classificar devices
  const entrada = items.filter(i => classifyDevice(i.label) === 'entrada');
  const areaComum = items.filter(i => classifyDevice(i.label) === 'area_comum');
  const equipamentos = items.filter(i => classifyDevice(i.label) === 'equipamentos');
  const lojas = items.filter(i => classifyDevice(i.label) === 'lojas');

  // 2. Calcular totais
  const entradaTotal = entrada.reduce((sum, i) => sum + i.value, 0);
  const areaComumTotal = areaComum.reduce((sum, i) => sum + i.value, 0);
  const equipamentosTotal = equipamentos.reduce((sum, i) => sum + i.value, 0);
  const lojasTotal = lojas.reduce((sum, i) => sum + i.value, 0);

  const consumidoresTotal = areaComumTotal + equipamentosTotal + lojasTotal;
  const grandTotal = entradaTotal; // Entrada = 100%

  // 3. Calcular percentuais (baseado na entrada)
  STATE.entrada = {
    devices: entrada,
    total: entradaTotal,
    perc: 100 // Entrada sempre 100%
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
}
```

---

## 🎨 Interface Visual

### Layout do Widget

```
┌─────────────────────────────────────────────────────┐
│ ℹ️ Informações de Energia                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌────────────────────┐  ┌────────────────────┐   │
│  │  📥 ENTRADA        │  │  📊 CONSUMIDORES   │   │
│  │                    │  │                    │   │
│  │  Total:            │  │  Área Comum:       │   │
│  │  1.234,56 kWh      │  │  456,78 kWh (37%)  │   │
│  │  100%              │  │                    │   │
│  │                    │  │  Equipamentos:     │   │
│  │  Dispositivos:     │  │  234,56 kWh (19%)  │   │
│  │  • Subestação Ppal │  │                    │   │
│  │  • Relógio 1       │  │  Lojas:            │   │
│  │  • Relógio 2       │  │  543,22 kWh (44%)  │   │
│  │                    │  │                    │   │
│  │                    │  │  TOTAL:            │   │
│  │                    │  │  1.234,56 kWh (100%)│   │
│  └────────────────────┘  └────────────────────┘   │
│                                                     │
│  ┌────────────────────────────────────────────┐   │
│  │         GRÁFICO DE PIZZA                   │   │
│  │                                            │   │
│  │            [Pie Chart]                     │   │
│  │                                            │   │
│  │  Legenda:                                  │   │
│  │  🟢 Área Comum (37%)                       │   │
│  │  🔵 Equipamentos (19%)                     │   │
│  │  🟡 Lojas (44%)                            │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### template.html

```html
<section class="telemetry-info-root">
  <header class="info-header">
    <h2 class="info-title">ℹ️ Informações de Energia</h2>
  </header>

  <div class="info-content">
    <!-- Seção Entrada -->
    <div class="info-card entrada-card">
      <div class="card-header">
        <span class="card-icon">📥</span>
        <h3 class="card-title">Entrada</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="entradaTotal">0,00 kWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="entradaPerc">100%</span>
        </div>
        <div class="devices-list" id="entradaDevices">
          <!-- Dispositivos de entrada -->
        </div>
      </div>
    </div>

    <!-- Seção Consumidores -->
    <div class="info-card consumidores-card">
      <div class="card-header">
        <span class="card-icon">📊</span>
        <h3 class="card-title">Consumidores</h3>
      </div>
      <div class="card-body">
        <!-- Área Comum -->
        <div class="consumer-group">
          <div class="stat-row">
            <span class="stat-label">🏢 Área Comum:</span>
            <span class="stat-value" id="areaComumTotal">0,00 kWh</span>
            <span class="stat-perc" id="areaComumPerc">(0%)</span>
          </div>
        </div>

        <!-- Equipamentos -->
        <div class="consumer-group">
          <div class="stat-row">
            <span class="stat-label">⚙️ Equipamentos:</span>
            <span class="stat-value" id="equipamentosTotal">0,00 kWh</span>
            <span class="stat-perc" id="equipamentosPerc">(0%)</span>
          </div>
        </div>

        <!-- Lojas -->
        <div class="consumer-group">
          <div class="stat-row">
            <span class="stat-label">🏪 Lojas:</span>
            <span class="stat-value" id="lojasTotal">0,00 kWh</span>
            <span class="stat-perc" id="lojasPerc">(0%)</span>
          </div>
        </div>

        <!-- Total Consumidores -->
        <div class="consumer-group total-group">
          <div class="stat-row main-stat">
            <span class="stat-label">TOTAL:</span>
            <span class="stat-value" id="consumidoresTotal">0,00 kWh</span>
            <span class="stat-perc" id="consumidoresPerc">(100%)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Gráfico de Pizza -->
    <div class="info-card chart-card">
      <div class="card-header">
        <h3 class="card-title">Distribuição de Consumo</h3>
      </div>
      <div class="card-body">
        <div class="chart-container">
          <canvas id="consumptionPieChart"></canvas>
        </div>
        <div class="chart-legend" id="chartLegend">
          <!-- Legenda gerada dinamicamente -->
        </div>
      </div>
    </div>
  </div>
</section>
```

### style.css (baseado no TELEMETRY v-5.2.0)

```css
.telemetry-info-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  background: var(--myio-bg, #0f1419);
  color: var(--myio-text, #e8ebf0);
  font-family: Inter, system-ui, sans-serif;
}

.info-header {
  margin-bottom: 20px;
}

.info-title {
  font-size: 20px;
  font-weight: 600;
  color: #00e09e;
  margin: 0;
}

.info-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 16px;
  flex: 1;
}

.info-card {
  background: var(--myio-panel, #1c2743);
  border: 1px solid var(--myio-border, #2e3a52);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.chart-card {
  grid-column: 1 / -1; /* Ocupa toda a largura */
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--myio-border, #2e3a52);
}

.card-icon {
  font-size: 20px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #00e09e;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Stats */
.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.stat-row.main-stat {
  font-size: 16px;
  font-weight: 600;
  color: #00e09e;
}

.stat-label {
  color: #a8b2c1;
}

.stat-value {
  font-weight: 600;
  color: #e8ebf0;
  margin-left: auto;
}

.stat-perc {
  color: #00e09e;
  font-weight: 500;
  min-width: 50px;
  text-align: right;
}

/* Consumer groups */
.consumer-group {
  padding: 8px 0;
  border-bottom: 1px solid rgba(46, 58, 82, 0.5);
}

.consumer-group.total-group {
  border-bottom: none;
  border-top: 2px solid #00e09e;
  margin-top: 8px;
  padding-top: 12px;
}

/* Devices list */
.devices-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #a8b2c1;
  margin-top: 8px;
  padding-left: 16px;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.device-item::before {
  content: "•";
  color: #00e09e;
}

/* Chart */
.chart-container {
  position: relative;
  height: 300px;
  margin-bottom: 16px;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

.legend-label {
  color: #a8b2c1;
}

.legend-value {
  font-weight: 600;
  color: #e8ebf0;
}

/* Responsive */
@media (max-width: 1200px) {
  .info-content {
    grid-template-columns: 1fr;
  }
}
```

---

## 🔧 Integração com Orquestrador

### settings.schema

```json
{
  "schema": {
    "type": "object",
    "title": "TELEMETRY_INFO Settings",
    "properties": {
      "labelWidget": {
        "type": "string",
        "title": "Widget Label",
        "default": "Informações de Energia"
      },
      "DOMAIN": {
        "type": "string",
        "title": "Domain",
        "default": "energy",
        "enum": ["energy", "water", "temperature"]
      },
      "customerTB_ID": {
        "type": "string",
        "title": "Customer ThingsBoard ID"
      },
      "showDevicesList": {
        "type": "boolean",
        "title": "Show Devices List",
        "default": false
      },
      "chartColors": {
        "type": "object",
        "title": "Chart Colors",
        "properties": {
          "areaComum": {
            "type": "string",
            "title": "Área Comum",
            "default": "#4CAF50"
          },
          "equipamentos": {
            "type": "string",
            "title": "Equipamentos",
            "default": "#2196F3"
          },
          "lojas": {
            "type": "string",
            "title": "Lojas",
            "default": "#FFC107"
          }
        }
      }
    },
    "required": ["customerTB_ID", "DOMAIN"]
  },
  "form": [
    "labelWidget",
    "DOMAIN",
    "customerTB_ID",
    "showDevicesList",
    {
      "key": "chartColors",
      "type": "section",
      "items": [
        "chartColors.areaComum",
        "chartColors.equipamentos",
        "chartColors.lojas"
      ]
    }
  ]
}
```

### controller.js - Estrutura Principal

```javascript
/* =========================================================================
 * ThingsBoard Widget: TELEMETRY_INFO (MyIO v-5.2.0)
 * - Consolida informações de entrada e consumidores
 * - Gráfico de pizza com distribuição de consumo
 * - Integrado com MyIO Orchestrator (RFC-0042)
 * =========================================================================*/

const DEBUG_ACTIVE = true;
const LogHelper = { /* ... */ };

const DATA_API_HOST = "https://api.data.apps.myio-bas.com";

// Widget configuration
let WIDGET_DOMAIN = 'energy';
let SHOW_DEVICES_LIST = false;
let CHART_COLORS = {
  areaComum: '#4CAF50',
  equipamentos: '#2196F3',
  lojas: '#FFC107'
};

// State
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

// DOM helpers
const $root = () => $(self.ctx.$container[0]);

// Categories
const CATEGORIES = {
  ENTRADA: 'entrada',
  AREA_COMUM: 'area_comum',
  EQUIPAMENTOS: 'equipamentos',
  LOJAS: 'lojas'
};

// Normalize label (remove accents, lowercase)
function normalizeLabel(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Classify device based on label
function classifyDevice(labelOrName = "") {
  const s = normalizeLabel(labelOrName);

  // Entrada
  if (/\brelogio\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/subesta/.test(s)) return CATEGORIES.ENTRADA;
  if (/entrada/.test(s)) return CATEGORIES.ENTRADA;
  if (/medicao/.test(s)) return CATEGORIES.ENTRADA;

  // Equipamentos
  if (/bomba|chiller/.test(s)) return CATEGORIES.EQUIPAMENTOS;
  if (/administra/.test(s)) return CATEGORIES.EQUIPAMENTOS;

  // Área Comum
  if (/area comum/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/iluminacao/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/elevador/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/escada/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/ar condicionado/.test(s)) return CATEGORIES.AREA_COMUM;
  if (/climatizacao/.test(s)) return CATEGORIES.AREA_COMUM;

  // Default: Loja
  return CATEGORIES.LOJAS;
}

// Aggregate data
function aggregateData(items) {
  // 1. Classify devices
  const entrada = items.filter(i => classifyDevice(i.label) === CATEGORIES.ENTRADA);
  const areaComum = items.filter(i => classifyDevice(i.label) === CATEGORIES.AREA_COMUM);
  const equipamentos = items.filter(i => classifyDevice(i.label) === CATEGORIES.EQUIPAMENTOS);
  const lojas = items.filter(i => classifyDevice(i.label) === CATEGORIES.LOJAS);

  // 2. Calculate totals
  const entradaTotal = entrada.reduce((sum, i) => sum + (i.value || 0), 0);
  const areaComumTotal = areaComum.reduce((sum, i) => sum + (i.value || 0), 0);
  const equipamentosTotal = equipamentos.reduce((sum, i) => sum + (i.value || 0), 0);
  const lojasTotal = lojas.reduce((sum, i) => sum + (i.value || 0), 0);

  const consumidoresTotal = areaComumTotal + equipamentosTotal + lojasTotal;
  const grandTotal = entradaTotal;

  // 3. Calculate percentages (based on entrada)
  STATE.entrada = {
    devices: entrada,
    total: entradaTotal,
    perc: 100
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

  LogHelper.log("[TELEMETRY_INFO] Aggregated data:", STATE);
}

// Render stats
function renderStats() {
  const MyIO = window.MyIOLibrary;

  // Entrada
  $root().find('#entradaTotal').text(MyIO.formatEnergy(STATE.entrada.total));
  $root().find('#entradaPerc').text('100%');

  // Consumidores
  $root().find('#areaComumTotal').text(MyIO.formatEnergy(STATE.consumidores.areaComum.total));
  $root().find('#areaComumPerc').text(`(${STATE.consumidores.areaComum.perc.toFixed(1)}%)`);

  $root().find('#equipamentosTotal').text(MyIO.formatEnergy(STATE.consumidores.equipamentos.total));
  $root().find('#equipamentosPerc').text(`(${STATE.consumidores.equipamentos.perc.toFixed(1)}%)`);

  $root().find('#lojasTotal').text(MyIO.formatEnergy(STATE.consumidores.lojas.total));
  $root().find('#lojasPerc').text(`(${STATE.consumidores.lojas.perc.toFixed(1)}%)`);

  $root().find('#consumidoresTotal').text(MyIO.formatEnergy(STATE.consumidores.totalGeral));
  $root().find('#consumidoresPerc').text(`(${STATE.consumidores.percGeral.toFixed(1)}%)`);

  // Devices list (if enabled)
  if (SHOW_DEVICES_LIST) {
    const $list = $root().find('#entradaDevices').empty();
    STATE.entrada.devices.forEach(device => {
      $list.append(`<div class="device-item">${device.label}</div>`);
    });
  }
}

// Render pie chart
function renderPieChart() {
  const canvas = $root().find('#consumptionPieChart')[0];
  if (!canvas) return;

  // Destroy previous chart
  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }

  const ctx = canvas.getContext('2d');

  // Chart data
  const data = {
    labels: ['Área Comum', 'Equipamentos', 'Lojas'],
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

  // Chart config
  pieChartInstance = new Chart(ctx, {
    type: 'pie',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false // Custom legend below
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const perc = total > 0 ? (value / total * 100).toFixed(1) : 0;
              return `${label}: ${value.toFixed(2)} kWh (${perc}%)`;
            }
          }
        }
      }
    }
  });

  // Render custom legend
  renderChartLegend();
}

// Render custom legend
function renderChartLegend() {
  const $legend = $root().find('#chartLegend').empty();
  const MyIO = window.MyIOLibrary;

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
        <span class="legend-value">${MyIO.formatEnergy(item.value)} (${item.perc.toFixed(1)}%)</span>
      </div>
    `;
    $legend.append(html);
  });
}

// Update display
function updateDisplay() {
  renderStats();
  renderPieChart();
}

// Process orchestrator data
function processOrchestratorData(items) {
  LogHelper.log("[TELEMETRY_INFO] Processing orchestrator data:", items);

  // Aggregate and classify
  aggregateData(items);

  // Update display
  updateDisplay();
}

// ===================== LIFECYCLE =====================

self.onInit = async function() {
  $(self.ctx.$container).css({
    height: "100%",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    position: "relative"
  });

  // Load settings
  WIDGET_DOMAIN = self.ctx.settings?.DOMAIN || 'energy';
  SHOW_DEVICES_LIST = self.ctx.settings?.showDevicesList || false;
  CHART_COLORS = {
    areaComum: self.ctx.settings?.chartColors?.areaComum || '#4CAF50',
    equipamentos: self.ctx.settings?.chartColors?.equipamentos || '#2196F3',
    lojas: self.ctx.settings?.chartColors?.lojas || '#FFC107'
  };

  LogHelper.log(`[TELEMETRY_INFO] Initialized: domain=${WIDGET_DOMAIN}`);

  // Set widget label
  $root().find('.info-title').text(self.ctx.settings?.labelWidget || 'Informações de Energia');

  // Listen for orchestrator data
  dataProvideHandler = function(ev) {
    const { domain, periodKey, items } = ev.detail;

    // Only process my domain
    if (domain !== WIDGET_DOMAIN) return;

    // Prevent duplicates
    if (lastProcessedPeriodKey === periodKey) return;
    lastProcessedPeriodKey = periodKey;

    LogHelper.log(`[TELEMETRY_INFO] Received data: ${items.length} items`);

    processOrchestratorData(items);
  };

  window.addEventListener('myio:telemetry:provide-data', dataProvideHandler);

  // Listen for date updates
  dateUpdateHandler = function(ev) {
    LogHelper.log("[TELEMETRY_INFO] Date updated:", ev.detail);

    // Update scope
    const { startISO, endISO } = ev.detail.period || {};
    if (startISO && endISO) {
      self.ctx.scope = self.ctx.scope || {};
      self.ctx.scope.startDateISO = startISO;
      self.ctx.scope.endDateISO = endISO;
      lastProcessedPeriodKey = null;
    }
  };

  window.addEventListener('myio:update-date', dateUpdateHandler);

  // Check for stored data
  setTimeout(() => {
    const orchestratorData = window.MyIOOrchestratorData || window.parent?.MyIOOrchestratorData;

    if (orchestratorData && orchestratorData[WIDGET_DOMAIN]) {
      const storedData = orchestratorData[WIDGET_DOMAIN];
      const age = Date.now() - storedData.timestamp;

      if (age < 30000 && storedData.items && storedData.items.length > 0) {
        LogHelper.log("[TELEMETRY_INFO] Using stored orchestrator data");
        processOrchestratorData(storedData.items);
      }
    }
  }, 500);
};

self.onDataUpdated = function() { /* no-op */ };
self.onResize = function() {
  if (pieChartInstance) {
    pieChartInstance.resize();
  }
};

self.onDestroy = function() {
  if (dateUpdateHandler) {
    window.removeEventListener('myio:update-date', dateUpdateHandler);
  }
  if (dataProvideHandler) {
    window.removeEventListener('myio:telemetry:provide-data', dataProvideHandler);
  }
  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }
  try { $root().off(); } catch(_) {}
};
```

---

## 🔄 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    USER SELECTS DATE RANGE                  │
│                    (via HEADER widget)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              HEADER emits myio:update-date                  │
│              { period: { startISO, endISO } }               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          MyIOOrchestrator receives event                    │
│          - Fetches data from API for all domains            │
│          - Filters by domain (energy, water, etc)           │
│          - Caches in MyIOOrchestratorData                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│     Orchestrator emits myio:telemetry:provide-data          │
│     {                                                       │
│       domain: 'energy',                                     │
│       periodKey: 'energy_2025-10-01_2025-10-17',            │
│       items: [                                              │
│         { id, label, value, ingestionId, ... },             │
│         ...                                                 │
│       ]                                                     │
│     }                                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│        TELEMETRY_INFO receives provide-data event           │
│        - Filters items by domain                            │
│        - Classifies devices (entrada, area_comum, ...)      │
│        - Aggregates totals per category                     │
│        - Calculates percentages                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              TELEMETRY_INFO updates display                 │
│              - renderStats() updates numbers                │
│              - renderPieChart() updates chart               │
│              - renderChartLegend() updates legend           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Checklist de Implementação

### Fase 1: Estrutura Base ✅
- [ ] Criar diretório `v-5.2.0/WIDGET/TELEMETRY_INFO/`
- [ ] Criar `template.html` com layout dos cards
- [ ] Criar `style.css` baseado no TELEMETRY v-5.2.0
- [ ] Criar `settings.schema` com configurações

### Fase 2: Controller - Classificação 🔧
- [ ] Implementar `normalizeLabel()`
- [ ] Implementar `classifyDevice()` com todas as regras
- [ ] Implementar `aggregateData()` com cálculos
- [ ] Testar classificação com dados mock

### Fase 3: Controller - Renderização 🎨
- [ ] Implementar `renderStats()` para atualizar números
- [ ] Implementar `renderPieChart()` com Chart.js
- [ ] Implementar `renderChartLegend()` customizado
- [ ] Implementar `updateDisplay()` como orchestrador de updates

### Fase 4: Integração com Orquestrador 🔌
- [ ] Implementar `dataProvideHandler` para receber dados
- [ ] Implementar `dateUpdateHandler` para mudanças de data
- [ ] Implementar `processOrchestratorData()` como entry point
- [ ] Adicionar suporte a múltiplos domínios (energy, water, temperature)

### Fase 5: Testes 🧪
- [ ] Testar com dados reais de energy
- [ ] Testar classificação de diferentes tipos de devices
- [ ] Testar cálculos de percentual
- [ ] Testar mudança de período
- [ ] Testar responsividade

### Fase 6: Otimizações ⚡
- [ ] Adicionar cache de classificação
- [ ] Otimizar re-renders do chart
- [ ] Adicionar loading states
- [ ] Adicionar empty states

---

## 🎯 Diferenças vs v.3.6.0

| Aspecto | v.3.6.0 (ENERGY) | v-5.2.0 (TELEMETRY_INFO) |
|---------|------------------|--------------------------|
| **Arquitetura** | Widget monolítico único | Widget especializado + Orquestrador |
| **Fonte de Dados** | Fetch direto da API | Dados via Orquestrador |
| **Classificação** | Hardcoded em GROUPS | Função `classifyDevice()` |
| **Gráfico** | Pie chart vanilla JS | Chart.js moderno |
| **Responsividade** | Limitada | Grid CSS moderno |
| **Temas** | CSS fixo | CSS variables (--myio-*) |
| **Multi-domain** | Não suportado | Suporta energy/water/temp |

---

## 🚀 Próximos Passos

1. **Criar estrutura de arquivos**
   ```bash
   mkdir -p src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO
   cd src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO
   touch controller.js template.html style.css settings.schema
   ```

2. **Implementar template.html** (estrutura visual)

3. **Implementar style.css** (estilos baseados no TELEMETRY)

4. **Implementar controller.js** (lógica de negócio)

5. **Implementar settings.schema** (configurações do widget)

6. **Testar no ThingsBoard**
   - Adicionar widget ao dashboard
   - Configurar aliases/datasources
   - Validar integração com orquestrador

7. **Documentar uso**
   - Como configurar aliases
   - Como ajustar cores
   - Como interpretar os dados

---

## 📝 Notas Importantes

### Aliases ThingsBoard

O widget precisa de um **alias único** que contenha **TODOS os devices** (entrada + consumidores). Exemplo:

```json
{
  "alias": "All Energy Devices",
  "filter": {
    "type": "deviceType",
    "deviceTypes": ["energy_meter", "energy_device"],
    "resolveMultiple": true
  }
}
```

### Datasources

O widget receberá 6 chaves por device via ThingsBoard `ctx.data`:
- `slaveId`
- `centralId`
- `ingestionId` ← **CHAVE PRINCIPAL** para join com API
- `connectionStatus`
- `deviceType`
- `identifier`

### Performance

- **Classificação**: Cache dos resultados de `classifyDevice()` por label
- **Chart**: Destruir instância anterior antes de criar nova
- **Re-renders**: Usar debounce se necessário

### Extensibilidade

O widget pode ser facilmente extendido para:
- **Water domain**: Classificar por tipo de medidor (geral, banheiros, jardim, etc)
- **Temperature domain**: Classificar por zona (refrigeração, climatização, etc)
- **Custom categories**: Via settings.schema

---

## 🔍 Referências

- **RFC-0042**: MyIO Orchestrator Integration
- **v.3.6.0 ENERGY**: `src/thingsboard/main-dashboard-shopping/v.3.6.0/WIDGET/ENERGY/`
- **v-5.2.0 TELEMETRY**: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/`
- **Chart.js Docs**: https://www.chartjs.org/docs/latest/

---

**Criado por**: Claude Code
**Data**: 2025-10-17
**Status**: 📋 **PLANO COMPLETO - PRONTO PARA IMPLEMENTAÇÃO**
