# RFC-0056: TELEMETRY_INFO Layout and Consumer Logic Improvements

## Sumário

Este documento propõe melhorias no widget **TELEMETRY_INFO** (v-5.2.0) para ajustar o tema visual, refatorar a lógica de classificação de consumidores e reorganizar o layout em um grid responsivo de 2 colunas. O objetivo é melhorar a clareza visual, remover o tema escuro inadequado e implementar categorização mais granular de dispositivos consumidores.

## Motivation

O widget TELEMETRY_INFO atual apresenta os seguintes problemas:

1. **Tema Visual Inconsistente**: Utiliza um tema escuro (`--myio-bg: #0f1419`) que destoa do resto do dashboard MyIO (light mode)
2. **Categorização Insuficiente**: Agrupa todos os consumidores em apenas 3 categorias genéricas (Área Comum, Equipamentos, Lojas)
3. **Layout Vertical Rígido**: Cards empilhados verticalmente sem aproveitamento do espaço horizontal
4. **Falta de Granularidade**: Não distingue sistemas críticos como Climatização, Elevadores e Escadas Rolantes

Essas limitações dificultam a análise detalhada de consumo por subsistema e a identificação de oportunidades de otimização energética.

## Comportamento Atual

### Tema Visual

O widget usa variáveis CSS escuras:

```css
.telemetry-info-root {
  background: var(--myio-bg, #0f1419);
  color: var(--myio-text, #e8ebf0);
}

.info-card {
  background: var(--myio-panel, #1c2743);
  border: 1px solid var(--myio-border, #2e3a52);
}
```

**Problema**: O dashboard principal usa light mode (`#FFFFFF`, `#F5F5F5`), criando contraste visual negativo.

### Lógica de Classificação

```javascript
// Classificação atual (simplificada)
const CATEGORIES = {
  ENTRADA: 'entrada',       // Relógios, subestações
  AREA_COMUM: 'area_comum', // Iluminação, climatização, elevadores
  EQUIPAMENTOS: 'equipamentos', // Bombas, chillers
  LOJAS: 'lojas'            // Default
};
```

**Problema**: Climatização, elevadores e escadas rolantes estão misturados em "Área Comum", impossibilitando análise granular.

### Layout

```
┌─────────────────────────────────────┐
│ 📥 ENTRADA          (card vertical) │
├─────────────────────────────────────┤
│ 📊 CONSUMIDORES     (card vertical) │
├─────────────────────────────────────┤
│ 📊 GRÁFICO          (full width)    │
└─────────────────────────────────────┘
```

**Problema**: Espaço horizontal desperdiçado, cards muito altos em telas grandes.

---

## Proposed Solution

### 1. Tema Visual: Light Mode

Substituir o tema escuro pela paleta oficial MyIO:

```css
/* Paleta MyIO Light Mode */
:root {
  --myio-primary: #5B2EBC;      /* Purple primary */
  --myio-accent: #00C896;       /* Teal/Green accent */
  --myio-bg: #FFFFFF;           /* White background */
  --myio-text: #222222;         /* Dark text */
  --myio-subtext: #666666;      /* Gray subtext */
  --myio-border: #E0E0E0;       /* Light border */
  --myio-panel: #F9F9F9;        /* Light panel bg */
}

.telemetry-info-root {
  background: var(--myio-bg, #FFFFFF);
  color: var(--myio-text, #222222);
  font-family: Inter, system-ui, sans-serif;
}

.info-card {
  background: var(--myio-panel, #F9F9F9);
  border: 1px solid var(--myio-border, #E0E0E0);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.card-title {
  color: var(--myio-primary, #5B2EBC);
  font-weight: 600;
}

.stat-value {
  color: var(--myio-text, #222222);
  font-weight: 600;
}

.stat-perc {
  color: var(--myio-accent, #00C896);
  font-weight: 500;
}
```

---

### 2. Nova Lógica de Categorização

Refatorar `classifyDevice()` para 6 categorias granulares:

```javascript
const CATEGORIES = {
  ENTRADA: 'entrada',
  CLIMATIZACAO: 'climatizacao',
  ELEVADORES: 'elevadores',
  ESCADAS_ROLANTES: 'escadas_rolantes',
  LOJAS: 'lojas',
  AREA_COMUM: 'area_comum'  // Computed (residual)
};

function classifyDevice(labelOrName = "", datasourceAlias = "") {
  const s = normalizeLabel(labelOrName);

  // 1. ENTRADA: Medição principal
  if (/\brelogio\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/subesta/.test(s)) return CATEGORIES.ENTRADA;
  if (/\bentrada\b/.test(s)) return CATEGORIES.ENTRADA;
  if (/medicao/.test(s)) return CATEGORIES.ENTRADA;

  // 2. CLIMATIZAÇÃO: Chillers e bombas
  if (/chiller/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/\bbomba\b/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/bomba primaria/.test(s)) return CATEGORIES.CLIMATIZACAO;
  if (/bomba secundaria/.test(s)) return CATEGORIES.CLIMATIZACAO;

  // 3. ELEVADORES
  if (/elevador/.test(s)) return CATEGORIES.ELEVADORES;

  // 4. ESCADAS ROLANTES
  if (/escada rolante/.test(s)) return CATEGORIES.ESCADAS_ROLANTES;
  if (/esc\. rolante/.test(s)) return CATEGORIES.ESCADAS_ROLANTES;

  // 5. LOJAS: Via datasource alias
  if (datasourceAlias && /lojas/i.test(datasourceAlias)) {
    return CATEGORIES.LOJAS;
  }
  if (/\bloja\b/.test(s)) return CATEGORIES.LOJAS;

  // 6. ÁREA COMUM: Default (será computado como residual)
  return CATEGORIES.AREA_COMUM;
}
```

#### Cálculo de Área Comum (Residual)

```javascript
function aggregateData(items) {
  // 1. Classificar devices
  const entrada = items.filter(i => classifyDevice(i.label, i.datasource) === 'entrada');
  const climatizacao = items.filter(i => classifyDevice(i.label, i.datasource) === 'climatizacao');
  const elevadores = items.filter(i => classifyDevice(i.label, i.datasource) === 'elevadores');
  const escadasRolantes = items.filter(i => classifyDevice(i.label, i.datasource) === 'escadas_rolantes');
  const lojas = items.filter(i => classifyDevice(i.label, i.datasource) === 'lojas');

  // 2. Calcular totais
  const entradaTotal = entrada.reduce((sum, i) => sum + (i.value || 0), 0);
  const climatizacaoTotal = climatizacao.reduce((sum, i) => sum + (i.value || 0), 0);
  const elevadoresTotal = elevadores.reduce((sum, i) => sum + (i.value || 0), 0);
  const escadasRolantesTotal = escadasRolantes.reduce((sum, i) => sum + (i.value || 0), 0);
  const lojasTotal = lojas.reduce((sum, i) => sum + (i.value || 0), 0);

  // 3. ÁREA COMUM = Residual
  // Área Comum = Entrada - (Climatização + Elevadores + Escadas + Lojas)
  const areaComumTotal = entradaTotal - (climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal);

  // 4. Calcular percentuais (baseado na entrada = 100%)
  const grandTotal = entradaTotal;

  STATE.entrada = {
    devices: entrada,
    total: entradaTotal,
    perc: 100
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
      devices: [], // Computado, não tem devices diretos
      total: areaComumTotal,
      perc: grandTotal > 0 ? (areaComumTotal / grandTotal) * 100 : 0
    },
    totalGeral: climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal + areaComumTotal,
    percGeral: 100
  };

  STATE.grandTotal = grandTotal;
}
```

---

### 3. Novo Layout: Grid 2 Colunas

#### Estrutura HTML

```html
<section class="telemetry-info-root">
  <header class="info-header">
    <h2 class="info-title">ℹ️ Informações de Energia</h2>
  </header>

  <div class="info-grid">
    <!-- Row 1: Entrada + Lojas -->
    <div class="info-card">
      <div class="card-header">
        <span class="card-icon">📥</span>
        <h3 class="card-title">Entrada</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="entradaTotal">0,00 MWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="entradaPerc">100%</span>
        </div>
      </div>
    </div>

    <div class="info-card">
      <div class="card-header">
        <span class="card-icon">🏪</span>
        <h3 class="card-title">Lojas</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="lojasTotal">0,00 MWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="lojasPerc">(0%)</span>
        </div>
      </div>
    </div>

    <!-- Row 2: Climatização + Elevadores -->
    <div class="info-card">
      <div class="card-header">
        <span class="card-icon">❄️</span>
        <h3 class="card-title">Climatização</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="climatizacaoTotal">0,00 MWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="climatizacaoPerc">(0%)</span>
        </div>
      </div>
    </div>

    <div class="info-card">
      <div class="card-header">
        <span class="card-icon">🛗</span>
        <h3 class="card-title">Elevadores</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="elevadoresTotal">0,00 MWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="elevadoresPerc">(0%)</span>
        </div>
      </div>
    </div>

    <!-- Row 3: Esc. Rolantes + Área Comum -->
    <div class="info-card">
      <div class="card-header">
        <span class="card-icon">🎢</span>
        <h3 class="card-title">Esc. Rolantes</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="escadasRolantesTotal">0,00 MWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="escadasRolantesPerc">(0%)</span>
        </div>
      </div>
    </div>

    <div class="info-card">
      <div class="card-header">
        <span class="card-icon">🏢</span>
        <h3 class="card-title">Área Comum</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">Total:</span>
          <span class="stat-value" id="areaComumTotal">0,00 MWh</span>
        </div>
        <div class="stat-row">
          <span class="stat-perc" id="areaComumPerc">(0%)</span>
        </div>
      </div>
    </div>

    <!-- Row 4: Total (full width) -->
    <div class="info-card total-card">
      <div class="card-header">
        <span class="card-icon">📊</span>
        <h3 class="card-title">Total Consumidores</h3>
      </div>
      <div class="card-body">
        <div class="stat-row main-stat">
          <span class="stat-label">TOTAL:</span>
          <span class="stat-value" id="consumidoresTotal">0,00 MWh</span>
          <span class="stat-perc" id="consumidoresPerc">(100%)</span>
        </div>
      </div>
    </div>

    <!-- Row 5: Gráfico (full width) -->
    <div class="info-card chart-card">
      <div class="card-header">
        <h3 class="card-title">Distribuição de Consumo</h3>
      </div>
      <div class="card-body">
        <div class="chart-container">
          <canvas id="consumptionPieChart"></canvas>
        </div>
        <div class="chart-legend" id="chartLegend"></div>
      </div>
    </div>
  </div>
</section>
```

#### CSS Grid Layout

```css
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  flex: 1;
}

.info-card {
  background: var(--myio-panel, #F9F9F9);
  border: 1px solid var(--myio-border, #E0E0E0);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s ease;
}

.info-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Total e Chart ocupam 2 colunas */
.total-card,
.chart-card {
  grid-column: 1 / -1; /* Span all columns */
}

/* Responsivo: Mobile (1 coluna) */
@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

/* Responsivo: Tablet (2 colunas mantém) */
@media (min-width: 769px) and (max-width: 1200px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop grande (2 colunas mantém) */
@media (min-width: 1201px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

---

## Tabela de Regras de Categorização

| Categoria | Regra de Inclusão | Exemplo de Label |
|-----------|-------------------|------------------|
| **Entrada** | "relógio", "subestação", "entrada", "medição" | "Relógio Principal", "Subestação A" |
| **Climatização** | "chiller", "bomba", "bomba primária", "bomba secundária" | "Chiller 01", "Bomba Primária HVAC" |
| **Elevadores** | "elevador" | "Elevador 1", "Elevador Social" |
| **Esc. Rolantes** | "escada rolante", "esc. rolante" | "Escada Rolante L1", "Esc. Rolante Torre" |
| **Lojas** | Datasource alias = "Lojas" OU label contém "loja" | "Loja 101", "Store ABC" |
| **Área Comum** | **Computado**: Entrada - (Climatização + Elevadores + Esc. Rolantes + Lojas) | (Residual) |

---

## Plano de Ação Detalhado

### Fase 1: Tema Visual (2h)
1. **Criar novo arquivo `style-light.css`** com paleta MyIO light mode
2. **Substituir variáveis CSS** em `style.css`:
   - `--myio-bg: #FFFFFF`
   - `--myio-text: #222222`
   - `--myio-primary: #5B2EBC`
   - `--myio-accent: #00C896`
3. **Atualizar cores do gráfico**:
   ```javascript
   CHART_COLORS = {
     climatizacao: '#00C896', // Teal
     elevadores: '#5B2EBC',   // Purple
     escadasRolantes: '#FF6B6B', // Red
     lojas: '#FFC107',        // Yellow
     areaComum: '#4CAF50'     // Green
   };
   ```
4. **Testar contraste** e acessibilidade (WCAG AA)

### Fase 2: Lógica de Categorização (3h)
1. **Refatorar `classifyDevice()`** para 6 categorias
2. **Implementar cálculo residual** de Área Comum
3. **Adicionar logs de debug**:
   ```javascript
   LogHelper.log(`[TELEMETRY_INFO] Classificação:`, {
     entrada: entrada.length,
     climatizacao: climatizacao.length,
     elevadores: elevadores.length,
     escadasRolantes: escadasRolantes.length,
     lojas: lojas.length,
     areaComum: areaComumTotal
   });
   ```
4. **Validar totais**: Soma deve sempre bater com Entrada

### Fase 3: Layout Grid (2h)
1. **Atualizar `template.html`** com grid 2 colunas
2. **Implementar CSS Grid** responsivo
3. **Adicionar ícones** para cada categoria (❄️, 🛗, 🎢, etc.)
4. **Testar responsividade**:
   - Desktop: 2 colunas
   - Tablet: 2 colunas
   - Mobile: 1 coluna

### Fase 4: Renderização (2h)
1. **Atualizar `renderStats()`** para 6 categorias:
   ```javascript
   function renderStats() {
     const MyIO = window.MyIOLibrary;

     // Entrada
     $('#entradaTotal').text(MyIO.formatEnergy(STATE.entrada.total));
     $('#entradaPerc').text('100%');

     // Consumidores
     $('#climatizacaoTotal').text(MyIO.formatEnergy(STATE.consumidores.climatizacao.total));
     $('#climatizacaoPerc').text(`(${STATE.consumidores.climatizacao.perc.toFixed(1)}%)`);

     $('#elevadoresTotal').text(MyIO.formatEnergy(STATE.consumidores.elevadores.total));
     $('#elevadoresPerc').text(`(${STATE.consumidores.elevadores.perc.toFixed(1)}%)`);

     $('#escadasRolantesTotal').text(MyIO.formatEnergy(STATE.consumidores.escadasRolantes.total));
     $('#escadasRolantesPerc').text(`(${STATE.consumidores.escadasRolantes.perc.toFixed(1)}%)`);

     $('#lojasTotal').text(MyIO.formatEnergy(STATE.consumidores.lojas.total));
     $('#lojasPerc').text(`(${STATE.consumidores.lojas.perc.toFixed(1)}%)`);

     $('#areaComumTotal').text(MyIO.formatEnergy(STATE.consumidores.areaComum.total));
     $('#areaComumPerc').text(`(${STATE.consumidores.areaComum.perc.toFixed(1)}%)`);

     // Total
     $('#consumidoresTotal').text(MyIO.formatEnergy(STATE.consumidores.totalGeral));
     $('#consumidoresPerc').text('(100%)');
   }
   ```

2. **Atualizar `renderPieChart()`** com 5 fatias (sem Entrada):
   ```javascript
   const data = {
     labels: ['❄️ Climatização', '🛗 Elevadores', '🎢 Esc. Rolantes', '🏪 Lojas', '🏢 Área Comum'],
     datasets: [{
       data: [
         STATE.consumidores.climatizacao.total,
         STATE.consumidores.elevadores.total,
         STATE.consumidores.escadasRolantes.total,
         STATE.consumidores.lojas.total,
         STATE.consumidores.areaComum.total
       ],
       backgroundColor: [
         CHART_COLORS.climatizacao,
         CHART_COLORS.elevadores,
         CHART_COLORS.escadasRolantes,
         CHART_COLORS.lojas,
         CHART_COLORS.areaComum
       ]
     }]
   };
   ```

### Fase 5: Testes e Validação (2h)
1. **Testes unitários**:
   - Validar classificação com dados mock
   - Verificar cálculo residual de Área Comum
   - Conferir somas de percentuais (deve dar 100%)
2. **Testes visuais**:
   - Comparar com design MyIO oficial
   - Testar em resoluções: 1920x1080, 1366x768, 768x1024, 375x667
3. **Testes de integração**:
   - Verificar dados reais do orquestrador
   - Validar performance com 100+ dispositivos

---

## Acceptance Criteria

- [ ] **Tema Light Mode**: Background branco, textos escuros, cores MyIO (#5B2EBC, #00C896)
- [ ] **6 Categorias Funcionando**: Entrada, Climatização, Elevadores, Esc. Rolantes, Lojas, Área Comum
- [ ] **Área Comum Residual**: Calculado corretamente como `Entrada - (outros)`
- [ ] **Layout 2 Colunas**: Grid responsivo funciona em desktop, tablet e mobile
- [ ] **Gráfico Atualizado**: Pie chart com 5 fatias (sem Entrada), cores novas
- [ ] **Validação de Totais**: Soma de categorias = Entrada (100%)
- [ ] **Sem Regressões**: Valores de Entrada e integração com orquestrador mantidos
- [ ] **Logs de Debug**: Console mostra classificação e totais por categoria
- [ ] **Responsivo**: Mobile (1 col), Tablet/Desktop (2 cols)

---

## Technical Notes

### Formato de Dados

Todos os valores devem ser exibidos em **MWh** com **2 casas decimais**:

```javascript
MyIO.formatEnergy(value) // Ex: "63,16 MWh"
```

### Hook de Atualização

A lógica de classificação deve rodar após a agregação de telemetria:

```javascript
dataProvideHandler = function(ev) {
  const { domain, periodKey, items } = ev.detail;

  if (domain !== WIDGET_DOMAIN) return;
  if (lastProcessedPeriodKey === periodKey) return;

  lastProcessedPeriodKey = periodKey;

  LogHelper.log(`[TELEMETRY_INFO] Received ${items.length} items`);

  // 1. Classificar e agregar
  aggregateData(items);

  // 2. Atualizar UI
  updateDisplay();
};
```

### Validação de Consistência

Adicionar validação após `aggregateData()`:

```javascript
function validateTotals() {
  const sum = STATE.consumidores.climatizacao.total +
              STATE.consumidores.elevadores.total +
              STATE.consumidores.escadasRolantes.total +
              STATE.consumidores.lojas.total +
              STATE.consumidores.areaComum.total;

  const diff = Math.abs(STATE.entrada.total - sum);

  if (diff > 0.01) { // Tolerância de 10 Wh
    LogHelper.warn(`[TELEMETRY_INFO] ⚠️ Total mismatch: Entrada=${STATE.entrada.total}, Sum=${sum}, Diff=${diff}`);
  } else {
    LogHelper.log(`[TELEMETRY_INFO] ✅ Totals validated: ${STATE.entrada.total} MWh`);
  }
}
```

---

## Cronograma de Rollout

1. **Aprovação do RFC**: Review pelo time MyIO (1 dia)
2. **Implementação**: Desenvolvimento das 5 fases (11h total)
3. **Testes em Staging**: Validação com dados reais (2 dias)
4. **Deploy Gradual**:
   - Beta (10% clientes): 1 semana
   - General Availability: Após validação beta
5. **Monitoramento**: Verificar logs de classificação e feedbacks

---

## Referências

- **TELEMETRY_INFO Widget**: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/`
- **MyIO Orchestrator**: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`
- **RFC-0042**: MyIO Orchestrator Integration
- **Draft RFC-0056**: `src/docs/rfcs/draft.rfc.56.md`

---

**Autor**: MyIO Team
**Data**: 2025-01-24
**Versão**: 1.0.0
**Status**: 📋 **PROPOSAL - AGUARDANDO APROVAÇÃO**
