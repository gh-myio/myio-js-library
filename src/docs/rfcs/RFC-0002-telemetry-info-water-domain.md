# RFC 0002: TELEMETRY_INFO Water Domain Support

- Feature Name: `telemetry-info-water-domain`
- Start Date: 2025-10-28
- RFC PR: (to be assigned)
- Status: **Draft**
- Related: RFC-0056 (TELEMETRY_INFO v5.2.0 Energy)

---

## Summary

Esta RFC propõe a extensão do widget **TELEMETRY_INFO v5.2.0** para suportar o domain **water** (água), permitindo a consolidação e visualização de dados de consumo de água em metros cúbicos (m³) com 4 contextos específicos: **Entrada**, **Área Comum**, **Lojas** e **Pontos não mapeados**.

A implementação seguirá o padrão já estabelecido pelo domain `energy`, mas adaptado para as características específicas de medição de água.

---

## Motivation

### Contexto Atual

O widget **TELEMETRY_INFO** (v5.2.0) atualmente suporta apenas o domain `energy`, consolidando dados de consumo elétrico em kWh através de 6 categorias:

- **Entrada** (relógios, subestações)
- **Climatização** (chillers, bombas)
- **Elevadores**
- **Escadas Rolantes**
- **Lojas**
- **Área Comum** (residual calculado)

### Estado Atual do Dashboard Water

No state `water_content`, existem **3 widgets TELEMETRY** com `domain: water`:

1. **TELEMETRY - Entrada** (Hidrômetros principais)
2. **TELEMETRY - Área Comum** (Hidrômetros de uso comum)
3. **TELEMETRY - Lojas** (Hidrômetros das lojas)

Atualmente, **não existe um widget TELEMETRY_INFO para water** que consolide essas informações em uma visão única com gráfico de pizza.

### Necessidade

1. **Consolidação de Dados**: Operadores precisam ver o consumo total de água e sua distribuição em um único widget.

2. **Consistência de UX**: Manter a mesma experiência visual e interativa entre energy e water domains.

3. **Identificação de Anomalias**: "Pontos não mapeados" (diferença entre entrada e medições) ajudam a identificar vazamentos ou hidrômetros não cadastrados.

4. **Decisões Operacionais**: Gestores precisam saber quanto do consumo total é Lojas vs. Área Comum.

---

## Guide-level explanation

### Visão Geral

O **TELEMETRY_INFO para water** funcionará de forma similar ao energy, mas com adaptações:

#### 1. **4 Contextos para Water**

Diferente de energy (6 categorias), water terá **4 contextos**:

| Contexto | Origem dos Dados | Cor Sugerida | Descrição |
|----------|------------------|--------------|-----------|
| **Entrada** | Widget TELEMETRY #1 (Entrada) | `#2196F3` (Azul) | Hidrômetros principais que medem entrada de água |
| **Área Comum** | Widget TELEMETRY #2 (Área Comum) | `#4CAF50` (Verde) | Hidrômetros de áreas comuns (banheiros, jardins, etc.) |
| **Lojas** | Widget TELEMETRY #3 (Lojas) | `#FFC107` (Amarelo) | Hidrômetros individuais das lojas |
| **Pontos não mapeados** | Calculado (residual) | `#9E9E9E` (Cinza) | Diferença entre Entrada e soma dos outros |

#### 2. **Fórmula de Cálculo**

```
Pontos não mapeados = Entrada - (Área Comum + Lojas)
```

**Importante**: Se o resultado for **negativo**, indica **erro de medição** ou **hidrômetros descalibrados**. Neste caso:
- Exibir valor como `0 m³`
- Mostrar warning no widget: "⚠️ Inconsistência de medição detectada"

#### 3. **Comunicação entre Widgets**

O TELEMETRY_INFO water receberá dados dos 3 widgets TELEMETRY através do **MyIO Orchestrator** (RFC-0042):

```javascript
// Widget TELEMETRY #1 (Entrada) envia:
window.dispatchEvent(new CustomEvent('myio:telemetry:provide-water', {
  detail: {
    context: 'entrada',
    domain: 'water',
    total: 1250.5,  // m³
    devices: [
      { id: 'hydro-1', label: 'Hidrômetro Principal', value: 1250.5 }
    ],
    periodKey: '2025-10-28'
  }
}));

// Widget TELEMETRY #2 (Área Comum) envia:
window.dispatchEvent(new CustomEvent('myio:telemetry:provide-water', {
  detail: {
    context: 'areaComum',
    domain: 'water',
    total: 450.2,  // m³
    devices: [
      { id: 'hydro-ac-1', label: 'Banheiros', value: 200.1 },
      { id: 'hydro-ac-2', label: 'Jardim', value: 250.1 }
    ],
    periodKey: '2025-10-28'
  }
}));

// Widget TELEMETRY #3 (Lojas) envia:
window.dispatchEvent(new CustomEvent('myio:telemetry:provide-water', {
  detail: {
    context: 'lojas',
    domain: 'water',
    total: 680.3,  // m³
    devices: [
      { id: 'hydro-loja-01', label: 'Loja 01', value: 150.5 },
      { id: 'hydro-loja-02', label: 'Loja 02', value: 200.8 },
      // ... mais lojas
    ],
    periodKey: '2025-10-28'
  }
}));
```

#### 4. **Interface do Usuário**

**Layout (Grid 2 Colunas):**

```
┌─────────────────────────────────────────────────────────────┐
│ 💧 Resumo de Consumo de Água - Outubro 2025                │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│   [Gráfico de Pizza]     │   📊 Distribuição                │
│        1.250,5 m³        │                                  │
│      ENTRADA TOTAL       │   🔵 Entrada: 1.250,5 m³ (100%) │
│                          │   🟢 Área Comum: 450,2 m³ (36%) │
│                          │   🟡 Lojas: 680,3 m³ (54%)      │
│                          │   ⚪ Não mapeados: 120,0 m³ (10%)│
│                          │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

**Cards Expansíveis:**

Cada contexto pode ser expandido para ver a lista de dispositivos:

```
🟢 Área Comum: 450,2 m³ (36%)  [▼]
  ├─ Banheiros 1º Piso: 80,5 m³
  ├─ Banheiros 2º Piso: 75,3 m³
  ├─ Jardim Interno: 150,2 m³
  └─ Lavanderia: 144,2 m³
```

#### 5. **Unidades e Formatação**

| Domain | Unidade Principal | Formato | Exemplo |
|--------|-------------------|---------|---------|
| energy | kWh | `formatEnergy()` | `1.250,50 kWh` |
| water | m³ | `formatWaterVolumeM3()` | `1.250,50 m³` |

**Formatação de valores:**
```javascript
import { formatWaterVolumeM3 } from 'myio-js-library';

const formatted = formatWaterVolumeM3(1250.5); // "1.250,50 m³"
```

---

## Reference-level explanation

### Estrutura de Dados

#### State para Water Domain

```javascript
const STATE_WATER = {
  domain: 'water',

  entrada: {
    context: 'entrada',
    devices: [],
    total: 0,      // m³
    perc: 100,     // % em relação a si mesmo (sempre 100%)
    source: 'widget-telemetry-entrada'
  },

  areaComum: {
    context: 'areaComum',
    devices: [],
    total: 0,      // m³
    perc: 0,       // % em relação à entrada
    source: 'widget-telemetry-area-comum'
  },

  lojas: {
    context: 'lojas',
    devices: [],
    total: 0,      // m³
    perc: 0,       // % em relação à entrada
    source: 'widget-telemetry-lojas'
  },

  pontosNaoMapeados: {
    context: 'pontosNaoMapeados',
    devices: [],
    total: 0,      // m³ (calculado)
    perc: 0,       // % em relação à entrada
    isCalculated: true,
    hasInconsistency: false  // true se valor calculado < 0
  },

  grandTotal: 0,   // m³ (soma de todos os contextos, exceto entrada)
  periodKey: null,
  lastUpdate: null
};
```

#### Event Schema

```typescript
interface WaterTelemetryProvideEvent {
  context: 'entrada' | 'areaComum' | 'lojas';
  domain: 'water';
  total: number;  // m³
  devices: Array<{
    id: string;
    label: string;
    value: number;  // m³
    deviceType?: string;  // 'HIDROMETRO', 'CAIXA_DAGUA', 'TANK'
    identifier?: string;
  }>;
  periodKey: string;  // ISO date or period identifier
  timestamp?: string; // ISO timestamp
}

interface WaterTelemetryRequestEvent {
  domain: 'water';
  periodKey: string;
  requestId?: string;
}
```

### API de Comunicação

#### 1. TELEMETRY_INFO solicita dados (opcional)

```javascript
// TELEMETRY_INFO pode solicitar refresh de dados
window.dispatchEvent(new CustomEvent('myio:telemetry:request-water', {
  detail: {
    domain: 'water',
    periodKey: '2025-10-28',
    requestId: 'req-' + Date.now()
  }
}));
```

#### 2. TELEMETRY widgets respondem

```javascript
// Cada widget TELEMETRY (water) escuta e responde
window.addEventListener('myio:telemetry:request-water', (event) => {
  const { periodKey } = event.detail;

  // Widget TELEMETRY #1 (Entrada)
  if (WIDGET_CONTEXT === 'entrada') {
    window.dispatchEvent(new CustomEvent('myio:telemetry:provide-water', {
      detail: {
        context: 'entrada',
        domain: 'water',
        total: calculateTotal(),  // m³
        devices: getDevicesList(),
        periodKey: periodKey
      }
    }));
  }
});
```

#### 3. TELEMETRY_INFO recebe e agrega

```javascript
// TELEMETRY_INFO escuta todos os eventos 'provide-water'
window.addEventListener('myio:telemetry:provide-water', (event) => {
  const { context, total, devices, periodKey } = event.detail;

  // Verificar se é para o período correto
  if (periodKey !== STATE_WATER.periodKey) {
    return; // Ignorar dados de períodos diferentes
  }

  // Atualizar state
  switch (context) {
    case 'entrada':
      STATE_WATER.entrada.total = total;
      STATE_WATER.entrada.devices = devices;
      break;
    case 'areaComum':
      STATE_WATER.areaComum.total = total;
      STATE_WATER.areaComum.devices = devices;
      break;
    case 'lojas':
      STATE_WATER.lojas.total = total;
      STATE_WATER.lojas.devices = devices;
      break;
  }

  // Recalcular pontos não mapeados
  calculatePontosNaoMapeados();

  // Re-renderizar UI
  renderWaterInfo();
});
```

### Lógica de Cálculo

#### Cálculo de Pontos Não Mapeados

```javascript
function calculatePontosNaoMapeados() {
  const entrada = STATE_WATER.entrada.total;
  const areaComum = STATE_WATER.areaComum.total;
  const lojas = STATE_WATER.lojas.total;

  // Soma dos medidos
  const medidosTotal = areaComum + lojas;

  // Diferença (residual)
  const naoMapeados = entrada - medidosTotal;

  // Verificar inconsistência (negativo indica erro)
  const hasInconsistency = naoMapeados < 0;

  STATE_WATER.pontosNaoMapeados = {
    context: 'pontosNaoMapeados',
    devices: [],  // Não há dispositivos físicos
    total: hasInconsistency ? 0 : naoMapeados,
    perc: hasInconsistency ? 0 : (naoMapeados / entrada) * 100,
    isCalculated: true,
    hasInconsistency: hasInconsistency
  };

  // Atualizar grand total (excluindo entrada)
  STATE_WATER.grandTotal = medidosTotal + (hasInconsistency ? 0 : naoMapeados);

  LogHelper.log('[Water] Calculated:', {
    entrada,
    medidos: medidosTotal,
    naoMapeados: hasInconsistency ? 0 : naoMapeados,
    inconsistency: hasInconsistency
  });
}
```

#### Cálculo de Percentuais

```javascript
function calculatePercentages() {
  const entrada = STATE_WATER.entrada.total;

  if (entrada === 0) {
    // Sem entrada, todos os percentuais são 0
    STATE_WATER.areaComum.perc = 0;
    STATE_WATER.lojas.perc = 0;
    STATE_WATER.pontosNaoMapeados.perc = 0;
    return;
  }

  // Percentual em relação à entrada
  STATE_WATER.areaComum.perc = (STATE_WATER.areaComum.total / entrada) * 100;
  STATE_WATER.lojas.perc = (STATE_WATER.lojas.total / entrada) * 100;
  STATE_WATER.pontosNaoMapeados.perc = (STATE_WATER.pontosNaoMapeados.total / entrada) * 100;

  LogHelper.log('[Water] Percentages:', {
    areaComum: STATE_WATER.areaComum.perc.toFixed(1) + '%',
    lojas: STATE_WATER.lojas.perc.toFixed(1) + '%',
    naoMapeados: STATE_WATER.pontosNaoMapeados.perc.toFixed(1) + '%'
  });
}
```

### Configuração do Widget

#### Widget Settings (ThingsBoard)

```javascript
{
  "domain": "water",  // 'energy' | 'water' | 'gas'
  "showDevicesList": false,
  "chartType": "pie",  // 'pie' | 'donut'
  "title": "Consumo de Água",
  "colors": {
    "entrada": "#2196F3",      // Azul
    "areaComum": "#4CAF50",    // Verde
    "lojas": "#FFC107",        // Amarelo
    "pontosNaoMapeados": "#9E9E9E"  // Cinza
  }
}
```

#### Detecção Automática de Domain

```javascript
function detectDomain() {
  // Tentar detectar pelo subscription alias
  const alias = self.ctx.defaultSubscription?.subscriptionOptions?.alias;

  if (alias && /water/i.test(alias)) {
    return 'water';
  }

  // Fallback: usar configuração manual
  return WIDGET_DOMAIN || 'energy';
}
```

### Dinamização de Títulos no Template

**Problema Identificado**: Os títulos no template HTML estão hardcoded como "Energia".

#### Títulos que Precisam Ser Dinamizados

**Arquivo**: `template.html`

| Linha | Título Fixo (Atual) | Solução |
|-------|---------------------|---------|
| 10 | `ℹ️ Informações de Energia` | `ℹ️ Informações de ${domainLabel}` |
| 173 | `Distribuição de Consumo de Energia` | `Distribuição de Consumo de ${domainLabel}` |

#### Implementação

**1. Adicionar Mapeamento de Labels**

```javascript
const DOMAIN_LABELS = {
  energy: {
    title: 'Energia',
    unit: 'kWh',
    icon: '⚡'
  },
  water: {
    title: 'Água',
    unit: 'm³',
    icon: '💧'
  },
  gas: {
    title: 'Gás',
    unit: 'm³',
    icon: '🔥'
  }
};
```

**2. Função para Obter Label**

```javascript
function getDomainLabel(domain = 'energy') {
  return DOMAIN_LABELS[domain] || DOMAIN_LABELS.energy;
}
```

**3. Atualizar Títulos Dinamicamente no `onInit()`**

```javascript
function onInit() {
  const domain = detectDomain();
  const domainConfig = getDomainLabel(domain);

  // Atualizar título do header
  const infoTitle = document.querySelector('.info-title');
  if (infoTitle) {
    infoTitle.innerHTML = `${domainConfig.icon} Informações de ${domainConfig.title}`;
  }

  // Atualizar título da modal
  const modalTitle = document.querySelector('.modal-title-clean');
  if (modalTitle) {
    modalTitle.textContent = `Distribuição de Consumo de ${domainConfig.title}`;
  }

  // Atualizar título do card de distribuição (opcional)
  const chartCardTitle = document.querySelector('.chart-card .card-title');
  if (chartCardTitle && domain !== 'energy') {
    chartCardTitle.textContent = `Distribuição de Consumo de ${domainConfig.title}`;
  }

  LogHelper.log(`[TELEMETRY_INFO] Domain: ${domain}, Label: ${domainConfig.title}`);
}
```

**4. Modificar Template HTML (Tornar Genérico)**

```html
<!-- ANTES (linha 10) -->
<h2 class="info-title">ℹ️ Informações de Energia</h2>

<!-- DEPOIS (linha 10) -->
<h2 class="info-title" id="infoTitleHeader">ℹ️ Informações de Energia</h2>
<!-- ^^ O ID permite atualização via JS, valor inicial como fallback -->
```

```html
<!-- ANTES (linha 173) -->
<h2 class="modal-title-clean">Distribuição de Consumo de Energia</h2>

<!-- DEPOIS (linha 173) -->
<h2 class="modal-title-clean" id="modalTitleHeader">Distribuição de Consumo de Energia</h2>
<!-- ^^ O ID permite atualização via JS, valor inicial como fallback -->
```

#### Exemplo de Saída

**Domain: energy**
```
ℹ️ Informações de Energia
Distribuição de Consumo de Energia
```

**Domain: water**
```
💧 Informações de Água
Distribuição de Consumo de Água
```

**Domain: gas** (futuro)
```
🔥 Informações de Gás
Distribuição de Consumo de Gás
```

### Implementação do WaterDomainAdapter

```javascript
class WaterDomainAdapter {
  getContexts() {
    return ['entrada', 'areaComum', 'lojas', 'pontosNaoMapeados'];
  }

  formatValue(value) {
    return formatWaterVolumeM3(value); // "1.250,50 m³"
  }

  getChartColors() {
    return {
      entrada: '#2196F3',      // Azul
      areaComum: '#4CAF50',    // Verde
      lojas: '#FFC107',        // Amarelo
      pontosNaoMapeados: '#9E9E9E'  // Cinza
    };
  }

  calculateResidual(state) {
    const entrada = state.entrada.total;
    const medidos = state.areaComum.total + state.lojas.total;
    const residual = entrada - medidos;

    return {
      total: residual < 0 ? 0 : residual,
      hasInconsistency: residual < 0
    };
  }

  getLabels() {
    return {
      title: 'Água',
      unit: 'm³',
      icon: '💧'
    };
  }
}
```

**Uso:**
```javascript
const domain = detectDomain(); // 'water'
const adapter = domain === 'water'
  ? new WaterDomainAdapter()
  : new EnergyDomainAdapter();

const labels = adapter.getLabels();
console.log(labels.icon + ' Informações de ' + labels.title);
// "💧 Informações de Água"
```

---

## Drawbacks

### 1. Complexidade de Sincronização

**Problema**: 3 widgets devem enviar dados para 1 widget TELEMETRY_INFO. Se um widget falhar, os dados ficam incompletos.

**Mitigação**:
- Timeout de 5 segundos para cada resposta
- Mostrar indicador visual de "Aguardando dados..."
- Permitir visualização parcial (ex: se apenas Lojas respondeu)

### 2. Inconsistências de Medição

**Problema**: `Pontos não mapeados` pode ser negativo se a soma dos medidos for maior que a entrada.

**Mitigação**:
- Exibir valor como `0 m³` mas mostrar warning
- Adicionar tooltip explicativo: "Verificar calibração dos hidrômetros"
- Log detalhado no console para debug

### 3. Performance com Muitos Dispositivos

**Problema**: Widget de Lojas pode ter 50+ hidrômetros. Renderizar todos na lista expansível pode ser lento.

**Mitigação**:
- Paginação: mostrar apenas 10 dispositivos por vez
- Virtualização de lista para grandes quantidades
- Cache de renderização

### 4. Duplicação de Código

**Problema**: Lógica similar entre energy e water pode gerar duplicação.

**Mitigação**:
- Abstrair funções comuns (formatação, cálculo de percentuais)
- Factory pattern para criar state baseado em domain
- Shared utilities para comunicação entre widgets

---

## Rationale and alternatives

### Por que 4 Contextos ao invés de 6?

**Energy** tem infraestrutura complexa (climatização, elevadores, escadas rolantes) que justifica 6 categorias.

**Water** tem medição mais simples:
- **Entrada**: Hidrômetro principal
- **Lojas**: Hidrômetros individuais
- **Área Comum**: Uso coletivo
- **Não mapeados**: Vazamentos ou não medidos

Adicionar subcategorias (ex: "Banheiros", "Jardim") seria over-engineering e complicaria a visualização.

### Por que Comunicação via Custom Events?

**Alternativa 1: Shared State Global**
```javascript
window.MYIO_WATER_STATE = { ... };
```
❌ Problemas:
- Acoplamento forte entre widgets
- Dificuldade de testar isoladamente
- Conflitos de namespace

**Alternativa 2: LocalStorage**
```javascript
localStorage.setItem('myio-water-entrada', JSON.stringify(data));
```
❌ Problemas:
- Limitação de tamanho (5-10MB)
- Sincronização entre abas
- Sem notificação de mudanças

**✅ Custom Events (Escolhido)**
```javascript
window.dispatchEvent(new CustomEvent('myio:telemetry:provide-water', { ... }));
```
Vantagens:
- Desacoplamento total
- Fácil de testar (mock events)
- Padrão já usado no Orchestrator (RFC-0042)
- Sem limite de tamanho
- Notificação automática

### Por que Não Usar WebSockets?

WebSockets seriam overkill para comunicação entre widgets na mesma página. Custom Events são síncronos, leves e não requerem servidor.

---

## Prior art

### Referências Internas

1. **RFC-0056**: TELEMETRY_INFO v5.2.0 (energy domain)
   - Base para toda a arquitetura
   - Padrão de 6 categorias com residual calculado

2. **RFC-0042**: MyIO Orchestrator
   - Sistema de comunicação entre widgets
   - Padrão de eventos `myio:*`

3. **Water Formatting Utilities** (`myio-js-library`)
   - `formatWaterVolumeM3()`: Formato PT-BR com m³
   - `formatWaterByGroup()`: Agrupamento por categoria
   - `calcDeltaPercent()`: Variação percentual

### Referências Externas

1. **Sistemas de Medição de Água** (Sabesp, Águas de Portugal)
   - Padrão de medição: Entrada principal + Submediões
   - Detecção de vazamentos por diferença

2. **Building Management Systems (BMS)**
   - Schneider EcoStruxure: Dashboard de água com 4-5 categorias
   - Siemens Desigo CC: Visualização entrada vs. consumo

3. **ISO 50001 (Energy Management Systems)**
   - Conceito de "Unaccounted Energy/Water"
   - Metodologia de balanço (entrada - saída = perda)

---

## Unresolved questions

### 1. Período de Agregação

**Questão**: Os dados devem ser do período selecionado no Date Picker ou tempo real?

**Opções**:
- A) Usar o mesmo período do Date Picker (consistência com energy)
- B) Sempre mostrar dados do dia atual (tempo real)
- C) Permitir toggle entre "Período Selecionado" e "Hoje"

**Recomendação**: Opção A (consistência)

### 2. Threshold para Inconsistência

**Questão**: Qual margem de erro aceitar antes de mostrar warning?

```javascript
const naoMapeados = entrada - medidosTotal;

// Opção 1: Qualquer valor negativo
if (naoMapeados < 0) showWarning();

// Opção 2: Margem de 5%
if (naoMapeados < -(entrada * 0.05)) showWarning();

// Opção 3: Valor absoluto (ex: 10 m³)
if (naoMapeados < -10) showWarning();
```

**Recomendação**: Opção 2 (5% de margem) para evitar alarmes falsos por imprecisão de medição.

### 3. Ordem de Prioridade

**Questão**: Se múltiplos widgets enviarem dados ao mesmo tempo, qual processar primeiro?

**Opções**:
- A) Ordem de chegada (FIFO)
- B) Prioridade fixa: Entrada > Área Comum > Lojas
- C) Debounce: aguardar 500ms após última chegada

**Recomendação**: Opção C (debounce) para garantir que todos os dados sejam recebidos antes de calcular.

### 4. Cache de Dados

**Questão**: Armazenar dados recebidos para evitar reprocessamento?

```javascript
const WATER_CACHE = {
  '2025-10-28': {
    entrada: { total: 1250.5, ... },
    areaComum: { total: 450.2, ... },
    lojas: { total: 680.3, ... }
  }
};
```

**Prós**: Performance, menos eventos
**Contras**: Sincronização, invalidação de cache

**Recomendação**: Sim, com TTL de 5 minutos e invalidação manual via evento `myio:telemetry:clear-cache`.

### 5. Suporte a Múltiplos Hidrômetros de Entrada

**Questão**: E se houver 2+ hidrômetros principais de entrada?

**Opções**:
- A) Somar todos (valor único no card "Entrada")
- B) Mostrar separados (card "Entrada 1", "Entrada 2")
- C) Permitir configuração de qual é o "principal"

**Recomendação**: Opção A (somar) para simplificar. Casos com múltiplas entradas são raros e podem ser modelados como sub-dispositivos.

---

## Future possibilities

### v1.1: Detecção Automática de Vazamentos

```javascript
// Alertar se pontos não mapeados > 20% por 3 dias consecutivos
if (STATE_WATER.pontosNaoMapeados.perc > 20) {
  showAlert('🚨 Possível vazamento detectado: ' +
            formatWaterVolumeM3(STATE_WATER.pontosNaoMapeados.total) +
            ' não contabilizados');
}
```

### v1.2: Comparação Temporal

```javascript
// Comparar com semana/mês anterior
const comparison = {
  current: STATE_WATER.grandTotal,
  previous: WATER_CACHE['2025-10-21'].grandTotal,
  delta: calcDeltaPercent(current, previous)  // "+15% vs. semana passada"
};
```

### v1.3: Export de Relatórios

```javascript
// Botão "Exportar Relatório" gera CSV/PDF
const report = {
  periodo: '01/10/2025 - 28/10/2025',
  entrada: formatWaterVolumeM3(STATE_WATER.entrada.total),
  areaComum: formatWaterVolumeM3(STATE_WATER.areaComum.total),
  lojas: formatWaterVolumeM3(STATE_WATER.lojas.total),
  naoMapeados: formatWaterVolumeM3(STATE_WATER.pontosNaoMapeados.total)
};

exportToCSV(report, 'relatorio-agua-outubro-2025.csv');
```

### v2.0: Suporte a Domain "Gas"

Seguir o mesmo padrão para medição de gás (m³):
- `TELEMETRY_INFO` com `domain: 'gas'`
- Contextos: Entrada, Cozinha, Aquecimento, Não mapeados
- Mesma API de comunicação

### v2.1: Visão Unificada Multi-Domain

Dashboard com 3 TELEMETRY_INFO lado a lado:
```
┌───────────────┬───────────────┬───────────────┐
│  💡 Energia   │   💧 Água     │   🔥 Gás      │
│  1.250 kWh    │   800 m³      │   150 m³      │
│  [Pizza]      │   [Pizza]     │   [Pizza]     │
└───────────────┴───────────────┴───────────────┘
```

### v2.2: Machine Learning - Predição de Consumo

```javascript
// Treinar modelo com histórico de 6 meses
const prediction = predictWaterConsumption({
  historicalData: WATER_HISTORY,
  seasonality: 'summer',
  daysAhead: 7
});

// "Previsão para próxima semana: 950 m³ (+12%)"
```

---

## Implementation plan

### Fase 1: Preparação (Semana 1)

- [x] **RFC Aprovada** (este documento)
- [ ] Revisar código existente do TELEMETRY_INFO (energy)
- [ ] Identificar funções reutilizáveis
- [ ] Criar branch `feature/telemetry-info-water`

### Fase 2: Refatoração (Semana 2)

- [ ] Extrair lógica comum de energy para `telemetry-info-core.js`
- [ ] Criar factory `createTelemetryInfoState(domain)`
- [ ] Abstrair renderização de gráfico (independente de domain)
- [ ] Criar `DomainAdapter` interface:
  ```javascript
  interface DomainAdapter {
    getContexts(): string[];
    formatValue(value: number): string;
    getChartColors(): Record<string, string>;
    calculateResidual(state): number;
    getLabels(): { title: string; unit: string; icon: string };
  }
  ```

### Fase 3: Implementação Water (Semana 3)

- [ ] Criar `WaterDomainAdapter` implementando interface
- [ ] Implementar `STATE_WATER` e lógica de agregação
- [ ] Criar event listeners `myio:telemetry:provide-water`
- [ ] Implementar cálculo de "Pontos não mapeados"
- [ ] Adicionar detecção de inconsistência (negativo)

### Fase 4: Comunicação (Semana 4)

- [ ] Atualizar widgets TELEMETRY (water) para emitir eventos
- [ ] Implementar timeout e retry logic
- [ ] Adicionar debounce (500ms) para evitar reprocessamento
- [ ] Criar cache com TTL de 5 minutos

### Fase 5: Interface (Semana 5)

- [ ] **Dinamizar títulos baseados em domain** (template.html linhas 10 e 173)
  - Adicionar IDs aos elementos h2 (`infoTitleHeader`, `modalTitleHeader`)
  - Criar `DOMAIN_LABELS` com energia/água/gás
  - Implementar atualização dinâmica no `onInit()`
- [ ] Adaptar template HTML para water (cards e contextos)
- [ ] Atualizar cores do gráfico conforme domain
- [ ] Formatar valores com `formatWaterVolumeM3()` ou `formatEnergy()`
- [ ] Implementar warning visual para inconsistências
- [ ] Adicionar tooltips explicativos

### Fase 6: Testes (Semana 6)

- [ ] Testes unitários:
  - `calculatePontosNaoMapeados()`
  - `calculatePercentages()`
  - Event handling
- [ ] Testes de integração:
  - 3 widgets TELEMETRY + 1 TELEMETRY_INFO
  - Cenário de dados parciais (apenas 2 widgets respondem)
  - Cenário de inconsistência (soma > entrada)
- [ ] Testes de performance:
  - 100+ dispositivos em Lojas
  - Múltiplas mudanças de período rápidas

### Fase 7: Documentação e Deploy (Semana 7)

- [ ] Atualizar README do TELEMETRY_INFO
- [ ] Criar guia de migração para dashboards existentes
- [ ] Documentar API de eventos
- [ ] Deploy em ambiente de staging
- [ ] Validação com usuários (UAT)
- [ ] Deploy em produção

---

## Dependencies

### Bibliotecas

```json
{
  "myio-js-library": "^0.1.107",
  "dependencies": [
    "formatWaterVolumeM3",
    "formatWaterByGroup",
    "calcDeltaPercent"
  ]
}
```

### Widgets

- **TELEMETRY v5.2.0** (domain: water) x3
- **MyIO Orchestrator** (RFC-0042)
- **Date Picker** (global)

### APIs

- ThingsBoard Telemetry API (para fetch histórico)
- ThingsBoard Attributes API (para configurações)

---

## Testing strategy

### Unit Tests

```javascript
describe('WaterDomainAdapter', () => {
  test('calculates pontos nao mapeados correctly', () => {
    const state = {
      entrada: { total: 1000 },
      areaComum: { total: 400 },
      lojas: { total: 500 }
    };

    const result = calculatePontosNaoMapeados(state);

    expect(result.total).toBe(100);  // 1000 - 400 - 500 = 100
    expect(result.perc).toBe(10);    // (100 / 1000) * 100
  });

  test('handles negative residual (inconsistency)', () => {
    const state = {
      entrada: { total: 1000 },
      areaComum: { total: 600 },
      lojas: { total: 500 }
    };

    const result = calculatePontosNaoMapeados(state);

    expect(result.total).toBe(0);  // Negativo vira 0
    expect(result.hasInconsistency).toBe(true);
  });
});
```

### Integration Tests

```javascript
describe('TELEMETRY_INFO Water Integration', () => {
  test('receives data from 3 TELEMETRY widgets', (done) => {
    // Mock 3 widgets enviando dados
    dispatchEvent('myio:telemetry:provide-water', { context: 'entrada', total: 1000 });
    dispatchEvent('myio:telemetry:provide-water', { context: 'areaComum', total: 400 });
    dispatchEvent('myio:telemetry:provide-water', { context: 'lojas', total: 500 });

    setTimeout(() => {
      expect(STATE_WATER.entrada.total).toBe(1000);
      expect(STATE_WATER.pontosNaoMapeados.total).toBe(100);
      done();
    }, 600);  // Debounce de 500ms + margem
  });
});
```

---

## Security considerations

### 1. Validação de Dados

```javascript
function validateWaterData(data) {
  // Validar tipos
  if (typeof data.total !== 'number' || isNaN(data.total)) {
    throw new Error('Invalid total: must be a number');
  }

  // Validar range (água não pode ser negativa)
  if (data.total < 0) {
    throw new Error('Invalid total: cannot be negative');
  }

  // Validar contexto
  const validContexts = ['entrada', 'areaComum', 'lojas'];
  if (!validContexts.includes(data.context)) {
    throw new Error('Invalid context: ' + data.context);
  }

  return true;
}
```

### 2. Sanitização de Labels

```javascript
// Prevenir XSS em labels de dispositivos
function sanitizeLabel(label) {
  return String(label)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 255);  // Limitar tamanho
}
```

### 3. Rate Limiting

```javascript
// Prevenir spam de eventos
const EVENT_RATE_LIMIT = {
  maxEvents: 10,
  windowMs: 1000  // 10 eventos por segundo
};

let eventCount = 0;
let windowStart = Date.now();

window.addEventListener('myio:telemetry:provide-water', (event) => {
  const now = Date.now();

  // Reset window
  if (now - windowStart > EVENT_RATE_LIMIT.windowMs) {
    eventCount = 0;
    windowStart = now;
  }

  // Check limit
  if (eventCount >= EVENT_RATE_LIMIT.maxEvents) {
    LogHelper.warn('[Security] Rate limit exceeded, ignoring event');
    return;
  }

  eventCount++;
  handleWaterData(event.detail);
});
```

---

## Open questions for discussion

1. **Múltiplas Entradas**: Como lidar se houver 2+ hidrômetros de entrada?
   - Somar tudo?
   - Mostrar separado?

2. **Threshold de Inconsistência**: 5% de margem é suficiente?
   - Ou deveria ser configurável por cliente?

3. **Cache Duration**: 5 minutos é adequado?
   - Ou deveria invalidar a cada mudança de período?

4. **Nomenclatura**: "Pontos não mapeados" é clara?
   - Alternativas: "Não contabilizado", "Vazamentos/Perdas", "Outros"

5. **Performance**: Lista de dispositivos expansível deve ter limite?
   - Mostrar top 10 e link "Ver todos"?

6. **Comparação Temporal**: Deve ser parte do v1.0 ou future work?

---

## References

- **RFC-0056**: TELEMETRY_INFO v5.2.0 Energy
- **RFC-0042**: MyIO Orchestrator Communication Protocol
- **myio-js-library**: Water formatting utilities
- **ISO 50001**: Energy/Water Management Systems
- **ThingsBoard Documentation**: Widget API and Events

---

**Document History:**
- 2025-10-28: Initial draft created
- _To be updated as RFC progresses_
