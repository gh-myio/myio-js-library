# RFC-0097: ENERGY Widget - Chart Improvements

## Requisitos Originais

@/src\MYIO-SIM\v5.2.0\ENERGY\controller.js

```
async function fetch7DaysConsumptionFiltered(customerIds) {
```

### Modos de Visualização (vizMode)

- `chartConfig.vizMode === 'total'`: Linha única com soma consolidada por dia
- `chartConfig.vizMode === 'separate'`: Linhas separadas por shopping

### Granularidade

- Default: `1d` (dia)
- Opcional: `1hr` (hora)
- Deve ser parâmetro na chamada da API

### Comportamento

- Alternar `vizMode` via TAB não recarrega dados (apenas re-renderiza)
- Clicar em APLICAR na modal sempre recarrega dados

---

## Plano de Implementação

### FASE 1: Atualizar Template HTML

**Arquivo:** `template.html`

**Alterações:**

1. Adicionar TABs acima do gráfico de linhas:
   - TAB 1: "Consolidado" (vizMode = total)
   - TAB 2: "Por Shopping" (vizMode = separate)

2. Adicionar TABs para tipo de gráfico:
   - TAB: "Linhas" (chartType = line)
   - TAB: "Barras" (chartType = bar)

```html
<div class="chart-box">
  <div class="chart-header">
    <h4 id="lineChartTitle">Consumo dos últimos 7 dias</h4>
    <div class="chart-controls">
      <!-- TABs de Modo de Visualização -->
      <div class="chart-tabs viz-mode-tabs">
        <button class="chart-tab active" data-viz="total">Consolidado</button>
        <button class="chart-tab" data-viz="separate">Por Shopping</button>
      </div>
      <!-- TABs de Tipo de Gráfico -->
      <div class="chart-tabs chart-type-tabs">
        <button class="chart-tab active" data-type="line">Linhas</button>
        <button class="chart-tab" data-type="bar">Barras</button>
      </div>
      <!-- Botão Config -->
      <button id="configureChartBtn" class="config-btn" title="Configurar gráfico">⚙️</button>
    </div>
  </div>
  <canvas id="lineChart"></canvas>
</div>
```

---

### FASE 2: Atualizar Modal de Configuração

**Arquivo:** `controller.js` - função `openChartConfigModal()`

**Remover:**
- Seção "Tipo" com checkboxes de equipamentos (Elevadores, Chiller, etc.)

**Manter:**
- Seção "Período" com opções 7d, 14d, 30d, Personalizado

**Alterar:**
- Substituir inputs de data por `MyIOLibrary.createDateRangePicker`
- Remover seção "Modo de Visualização" da modal (agora é TAB no gráfico)

**Nova Estrutura Modal:**
```html
<div class="modal-body">
  <!-- Período com DateRangePicker -->
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
    <!-- DateRangePicker container -->
    <div id="chartDateRangeContainer" style="display: none;">
      <input type="text" id="chartDateRangeInput" placeholder="Selecione o período" readonly>
    </div>
  </div>

  <!-- Granularidade -->
  <div class="config-section">
    <div class="section-label">Granularidade</div>
    <div class="granularity-options">
      <label class="period-option">
        <input type="radio" name="granularity" value="1d" checked>
        <span>Por Dia</span>
      </label>
      <label class="period-option">
        <input type="radio" name="granularity" value="1h">
        <span>Por Hora</span>
      </label>
    </div>
  </div>
</div>
```

---

### FASE 3: Atualizar chartConfig State

**Arquivo:** `controller.js`

**Alterar estrutura:**
```javascript
const chartConfig = {
  period: 7,                    // 7, 14, 30, ou 0 (custom)
  startDate: null,              // ISO string para período custom
  endDate: null,                // ISO string para período custom
  granularity: '1d',            // '1d' ou '1h'
  vizMode: 'total',             // 'total' ou 'separate'
  chartType: 'line',            // 'line' ou 'bar'
  // REMOVIDO: equipmentTypes
};
```

---

### FASE 4: Atualizar Fetch e API

**Arquivo:** `MAIN/controller.js`

**Alterar função `fetchEnergyDayConsumption`:**
```javascript
async function fetchEnergyDayConsumption(customerId, startTs, endTs, granularity = '1d') {
  // ...
  const url = `${getDataApiHost()}/api/v1/telemetry/customers/${customerId}/energy/?deep=1&granularity=${granularity}&startTime=...`;
  // ...
}
```

---

### FASE 5: Implementar TAB Handlers

**Arquivo:** `controller.js`

**Adicionar funções:**

```javascript
// Inicializa handlers das TABs
function setupChartTabHandlers() {
  // TABs vizMode (Consolidado/Por Shopping)
  const vizTabs = document.querySelectorAll('.viz-mode-tabs .chart-tab');
  vizTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      vizTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      chartConfig.vizMode = tab.dataset.viz;
      // Re-renderiza sem recarregar dados
      rerenderLineChart();
    });
  });

  // TABs chartType (Linhas/Barras)
  const typeTabs = document.querySelectorAll('.chart-type-tabs .chart-tab');
  typeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      typeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      chartConfig.chartType = tab.dataset.type;
      // Re-renderiza sem recarregar dados
      rerenderLineChart();
    });
  });
}

// Re-renderiza o gráfico com dados em cache
function rerenderLineChart() {
  if (!cachedChartData) return;
  updateLineChartFromCache(cachedChartData);
}
```

---

### FASE 6: Cache de Dados do Gráfico

**Arquivo:** `controller.js`

**Adicionar:**
```javascript
// Cache para dados do gráfico (evita re-fetch ao trocar vizMode/chartType)
let cachedChartData = null;

// Atualizar fetch7DaysConsumptionFiltered para armazenar em cache
async function fetch7DaysConsumptionFiltered(customerIds) {
  // ... fetch data ...
  cachedChartData = {
    customerIds,
    dailyData,       // dados por dia
    shoppingData,    // dados por shopping
    labels,
    fetchTimestamp: Date.now()
  };
  // ... render chart ...
}
```

---

### FASE 7: Adicionar CSS para TABs

**Arquivo:** `controller.js` ou `style.css`

```css
.chart-tabs {
  display: inline-flex;
  gap: 2px;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 2px;
  margin-right: 8px;
}

.chart-tab {
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.chart-tab:hover {
  color: #1e293b;
}

.chart-tab.active {
  background: #fff;
  color: #6c2fbf;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

---

## Ordem de Execução

1. [x] Atualizar `chartConfig` state (remover equipmentTypes, adicionar granularity, chartType)
2. [x] Atualizar `template.html` com TABs
3. [x] Adicionar CSS das TABs
4. [x] Implementar handlers das TABs
5. [x] Atualizar modal (remover filtro Tipo, usar DateRangePicker)
6. [x] Atualizar `fetchEnergyDayConsumption` para aceitar granularidade
7. [x] Implementar cache de dados
8. [x] Implementar re-renderização sem re-fetch
9. [ ] Testar todos os modos e combinações

---

## Arquivos Afetados

- `ENERGY/template.html` - TABs no header do gráfico
- `ENERGY/controller.js` - Modal, chartConfig, handlers, cache
- `ENERGY/style.css` - Estilos das TABs (ou inline no controller)
- `MAIN/controller.js` - fetchEnergyDayConsumption com granularidade
