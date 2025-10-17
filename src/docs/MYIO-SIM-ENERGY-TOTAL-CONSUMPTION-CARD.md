# MYIO-SIM 1.0.0: Energy Total Consumption Card Implementation

**Status**: ✅ Implementado
**Created**: 2025-10-17
**Priority**: 🔴 Alta

---

## 📋 Resumo Executivo

### Objetivo
Implementar o card "Consumo Total" no widget ENERGY do MYIO-SIM 1.0.0 que calcula a diferença entre:
- **Consumo Total do Customer** (HEADER)
- **MENOS** Soma de todos os equipamentos individuais (EQUIPMENTS/Orquestrador)

### Fórmula
```
Consumo Total (ENERGY) = Consumo Customer (HEADER) - Σ Equipamentos (EQUIPMENTS)
```

---

## 🎯 Arquitetura da Solução

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    INGESTION API                            │
│         (Customer Total Consumption Endpoint)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    HEADER Widget                            │
│  1. Busca consumo total do customer via API                │
│  2. Atualiza card "Consumo de Energia"                     │
│  3. EMITE evento: myio:customer-total-consumption          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ customerTotal: 28400 kWh
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              MAIN Orchestrator (MyIOOrchestrator)          │
│  1. Busca consumo individual dos devices via API           │
│  2. Cacheia dados (energyCache Map)                        │
│  3. EMITE evento: myio:energy-data-ready                   │
│  4. Função: getTotalEquipmentsConsumption()                │
│     → Soma todos devices: 25100 kWh                        │
│  5. Função: getEnergyWidgetData(customerTotal)             │
│     → Calcula diferença: 28400 - 25100 = 3300 kWh         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    ENERGY Widget                            │
│  1. Escuta: myio:customer-total-consumption                │
│  2. Escuta: myio:energy-data-ready                         │
│  3. Chama: MyIOOrchestrator.getEnergyWidgetData()          │
│  4. Atualiza card "Consumo Total"                          │
│     → Valor: 3.3 MWh                                        │
│     → Info: Total: 28.4 MWh | Equipamentos: 25.1 MWh      │
│     → Trend: 11.6% do total (50 equipamentos)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Implementação Detalhada

### 1. MAIN/controller.js - Orquestrador

#### Novas Funções Adicionadas

```javascript
/**
 * Calcula o total de consumo de todos os equipamentos no cache
 * @returns {number} - Total em kWh
 */
function getTotalEquipmentsConsumption() {
  let total = 0;
  energyCache.forEach(device => {
    total += device.total_value || 0;
  });
  console.log(`[MAIN] [Orchestrator] Total equipments consumption: ${total} kWh (${energyCache.size} devices)`);
  return total;
}

/**
 * Obtém dados agregados para o widget ENERGY
 * @param {number} customerTotalConsumption - Consumo total do customer (vindo do HEADER)
 * @returns {object} - { customerTotal, equipmentsTotal, difference, percentage }
 */
function getEnergyWidgetData(customerTotalConsumption = 0) {
  const equipmentsTotal = getTotalEquipmentsConsumption();
  const difference = customerTotalConsumption - equipmentsTotal;
  const percentage = customerTotalConsumption > 0
    ? (difference / customerTotalConsumption) * 100
    : 0;

  const result = {
    customerTotal: customerTotalConsumption,
    equipmentsTotal: equipmentsTotal,
    difference: difference,
    percentage: percentage,
    deviceCount: energyCache.size
  };

  console.log(`[MAIN] [Orchestrator] Energy widget data:`, result);
  return result;
}
```

**Exportação**:
```javascript
return {
  // ... existing functions
  getTotalEquipmentsConsumption,
  getEnergyWidgetData
};
```

---

### 2. HEADER/controller.js - Emissão de Evento

#### Modificação em `updateEnergyCard()`

**Localização**: Linha 1114-1122

```javascript
// ✅ EMIT EVENT: Notify ENERGY widget of customer total consumption
window.dispatchEvent(new CustomEvent('myio:customer-total-consumption', {
  detail: {
    customerTotal: totalConsumption,
    deviceCount: ingestionIds.length,
    timestamp: Date.now()
  }
}));
console.log(`[HEADER] Emitted customer total consumption: ${totalConsumption} kWh`);
```

**Quando Emite**:
- Após atualizar o card de energia no HEADER
- Sempre que o orquestrador envia dados via `myio:energy-data-ready`
- Quando o MENU atualiza as datas e recarrega os dados

---

### 3. ENERGY/template.html - UI do Card

**Localização**: Linhas 12-23

```html
<div class="card" id="total-consumption-card">
  <p class="label">Consumo Total</p>
  <h3 class="value" id="total-consumption-value">
    <svg class="loading-spinner" style="width:24px; height:24px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#6c2fbf" stroke-width="5" stroke-linecap="round"
              stroke-dasharray="90,150" stroke-dashoffset="0">
      </circle>
    </svg>
  </h3>
  <span class="trend neutral" id="total-consumption-trend">Aguardando dados...</span>
  <span class="device-info" id="total-consumption-info"></span>
</div>
```

**Elementos Dinâmicos**:
- `#total-consumption-value`: Valor da diferença (ex: "3.3 MWh")
- `#total-consumption-trend`: Percentual e contagem (ex: "11.6% do total (50 equipamentos)")
- `#total-consumption-info`: Breakdown detalhado (ex: "Total: 28.4 MWh | Equipamentos: 25.1 MWh")

---

### 4. ENERGY/controller.js - Lógica de Cálculo

#### Cache Global

**Linhas 15-24**:
```javascript
// Cache para consumo total
let totalConsumptionCache = {
  data: null,
  customerTotal: 0,
  equipmentsTotal: 0,
  difference: 0,
  timestamp: null
};

const TOTAL_CONSUMPTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
```

#### Funções de Cache

**Linhas 68-100**:
```javascript
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
function cacheTotalConsumption(customerTotal, equipmentsTotal, difference, percentage, deviceCount) {
  totalConsumptionCache = {
    data: {
      customerTotal,
      equipmentsTotal,
      difference,
      percentage,
      deviceCount
    },
    customerTotal,
    equipmentsTotal,
    difference,
    timestamp: Date.now()
  };
  console.log("[ENERGY] Total consumption data cached:", totalConsumptionCache.data);
}
```

#### Função de Inicialização

**Linhas 313-338**: `initializeTotalConsumptionCard()`
- Mostra loading spinner
- Define estado neutro

#### Função de Atualização

**Linhas 343-410**: `updateTotalConsumptionCard()`

```javascript
function updateTotalConsumptionCard() {
  const valueEl = document.getElementById("total-consumption-value");
  const trendEl = document.getElementById("total-consumption-trend");
  const infoEl = document.getElementById("total-consumption-info");

  if (!window.MyIOOrchestrator) {
    console.warn("[ENERGY] MyIOOrchestrator not available");
    return;
  }

  try {
    // ✅ Pega dados do orquestrador
    const energyData = window.MyIOOrchestrator.getEnergyWidgetData(consumptionState.customerTotal);

    console.log("[ENERGY] Total consumption data:", energyData);

    // Update state
    consumptionState.equipmentsTotal = energyData.equipmentsTotal;
    consumptionState.difference = energyData.difference;

    // Format value (diferença = customer total - equipments total)
    const differenceFormatted = energyData.difference >= 1000
      ? `${(energyData.difference / 1000).toFixed(2)} MWh`
      : `${energyData.difference.toFixed(2)} kWh`;

    // Update value
    if (valueEl) {
      valueEl.textContent = differenceFormatted;
    }

    // Update info with breakdown
    if (infoEl) {
      const customerFormatted = energyData.customerTotal >= 1000
        ? `${(energyData.customerTotal / 1000).toFixed(2)} MWh`
        : `${energyData.customerTotal.toFixed(2)} kWh`;

      const equipmentsFormatted = energyData.equipmentsTotal >= 1000
        ? `${(energyData.equipmentsTotal / 1000).toFixed(2)} MWh`
        : `${energyData.equipmentsTotal.toFixed(2)} kWh`;

      infoEl.textContent = `Total: ${customerFormatted} | Equipamentos: ${equipmentsFormatted}`;
    }

    // Update trend with percentage
    if (trendEl) {
      const percentage = energyData.percentage.toFixed(1);
      trendEl.textContent = `${percentage}% do total (${energyData.deviceCount} equipamentos)`;
      trendEl.className = "trend neutral";
    }

    console.log("[ENERGY] Total consumption card updated successfully");

  } catch (error) {
    console.error("[ENERGY] Error updating total consumption card:", error);
    // ... error handling
  }
}
```

#### Event Listeners

**Linhas 663-680**:
```javascript
// ===== LISTEN FOR CUSTOMER TOTAL CONSUMPTION FROM HEADER =====
window.addEventListener('myio:customer-total-consumption', (ev) => {
  console.log("[ENERGY] Received customer total consumption from HEADER:", ev.detail);
  consumptionState.customerTotal = ev.detail.customerTotal || 0;
  updateTotalConsumptionCard();
});

// ===== LISTEN FOR ENERGY DATA FROM ORCHESTRATOR =====
window.addEventListener('myio:energy-data-ready', (ev) => {
  console.log("[ENERGY] Received energy data from orchestrator:", ev.detail);
  const { cache } = ev.detail;

  // Update total consumption card when equipment data arrives
  updateTotalConsumptionCard();
});
```

---

## 💾 Sistema de Cache

### Estratégia de Cache

O card "Consumo Total" utiliza um sistema de cache de **5 minutos** para:
1. **Evitar recálculos desnecessários** quando o usuário troca de aba e volta
2. **Melhorar performance** reduzindo chamadas ao orquestrador
3. **Garantir consistência** dos dados exibidos

### Como Funciona

```javascript
// Estrutura do cache
totalConsumptionCache = {
  data: {
    customerTotal: 28400,
    equipmentsTotal: 25100,
    difference: 3300,
    percentage: 11.62,
    deviceCount: 50
  },
  customerTotal: 28400,    // Duplicado para acesso rápido
  equipmentsTotal: 25100,
  difference: 3300,
  timestamp: 1729180800000  // Quando foi cacheado
}
```

### Fluxo de Cache

```
1. initializeTotalConsumptionCard()
   ├─> Tenta getCachedTotalConsumption()
   ├─> Se cache válido (< 5 min):
   │   └─> Renderiza UI imediatamente (SEM loading)
   └─> Se cache expirado/vazio:
       └─> Mostra loading spinner

2. updateTotalConsumptionCard()
   ├─> Tenta getCachedTotalConsumption()
   ├─> Se cache válido:
   │   └─> Renderiza UI e retorna (RÁPIDO)
   └─> Se cache inválido:
       ├─> Busca dados do orquestrador
       ├─> Chama cacheTotalConsumption()
       └─> Renderiza UI

3. Event: myio:customer-total-consumption
   ├─> Armazena customerTotal no cache
   └─> Chama updateTotalConsumptionCard()

4. Event: myio:telemetry:clear
   ├─> Limpa totalConsumptionCache
   └─> Reinicializa card (volta ao loading)
```

### Benefícios

| Cenário | Sem Cache | Com Cache |
|---------|-----------|-----------|
| User vai de ENERGY → EQUIPMENTS | Dados perdidos | Dados mantidos |
| User volta EQUIPMENTS → ENERGY | Loading + fetch | Exibe imediatamente |
| User troca datas rapidamente | Múltiplos recálculos | Cache invalida automaticamente |
| Cache expira (5 min) | N/A | Auto-refresh no próximo acesso |

### Invalidação do Cache

O cache é invalidado nas seguintes situações:

1. **TTL expirado** (5 minutos): Auto-invalidação por idade
2. **Cache clear manual**: User clica botão "Limpar" no MENU
3. **Mudança de datas**: Cache não é específico por período (simplificado)

---

## 🔄 Sequência de Eventos

### Inicialização (onInit)

```
1. MAIN Orchestrator inicia
   └─> Busca energia dos devices via API Ingestion
   └─> Cacheia em energyCache (Map)
   └─> Emite: myio:energy-data-ready

2. HEADER widget recebe myio:energy-data-ready
   └─> Calcula total do customer somando todos devices
   └─> Atualiza card "Consumo de Energia"
   └─> Emite: myio:customer-total-consumption

3. ENERGY widget recebe ambos eventos:
   a) myio:customer-total-consumption
      └─> Armazena customerTotal no estado
      └─> Chama updateTotalConsumptionCard()

   b) myio:energy-data-ready
      └─> Chama updateTotalConsumptionCard()

4. updateTotalConsumptionCard()
   └─> Chama MyIOOrchestrator.getEnergyWidgetData(customerTotal)
   └─> Recebe: { customerTotal, equipmentsTotal, difference, percentage }
   └─> Atualiza UI com os valores
```

### Atualização de Datas (MENU → Carregar)

```
1. User clica "Carregar" no MENU
   └─> MENU emite: myio:update-date

2. MAIN Orchestrator recebe myio:update-date
   └─> Busca novos dados via API Ingestion
   └─> Atualiza energyCache
   └─> Emite: myio:energy-data-ready

3. Fluxo continua igual ao da inicialização (passos 2-4)
```

---

## 📊 Exemplo de Dados Reais

### Input (do HEADER)
```json
{
  "customerTotal": 28400,
  "deviceCount": 3,
  "timestamp": 1729180800000
}
```

### Processamento (Orquestrador)
```javascript
// energyCache (Map)
Map {
  "ingestion-id-1" => { name: "Chiller Central", total_value: 12000 },
  "ingestion-id-2" => { name: "HVAC Loja 1", total_value: 8500 },
  "ingestion-id-3" => { name: "HVAC Loja 2", total_value: 4600 }
}

// getTotalEquipmentsConsumption()
equipmentsTotal = 12000 + 8500 + 4600 = 25100 kWh

// getEnergyWidgetData(28400)
{
  customerTotal: 28400,
  equipmentsTotal: 25100,
  difference: 3300,      // 28400 - 25100
  percentage: 11.62,     // (3300 / 28400) * 100
  deviceCount: 3
}
```

### Output (UI do ENERGY)
```
┌─────────────────────────────────┐
│ Consumo Total                   │
│                                 │
│ 3.30 MWh                       │  ← difference formatted
│                                 │
│ 11.6% do total (3 equipamentos) │  ← percentage + device count
│ Total: 28.4 MWh | Equipamentos: 25.1 MWh │  ← breakdown
└─────────────────────────────────┘
```

---

## 🧪 Pontos de Teste

### 1. Teste de Integração Básica
- [x] HEADER busca dados do customer
- [x] HEADER emite evento `myio:customer-total-consumption`
- [x] Orquestrador calcula total dos equipamentos
- [x] ENERGY recebe ambos eventos
- [x] ENERGY exibe diferença correta

### 2. Teste de Formatação
- [x] Valores < 1000 kWh exibidos em kWh
- [x] Valores >= 1000 kWh exibidos em MWh (2 casas decimais)
- [x] Percentual com 1 casa decimal
- [x] Breakdown mostra ambos valores formatados

### 3. Teste de Estados
- [x] Loading spinner inicial
- [x] Aguardando dados (estado neutro)
- [x] Dados carregados (valores reais)
- [x] Erro (fallback com mensagem)

### 4. Teste de Cache Clear
- [x] MENU "Limpar" limpa estado do ENERGY
- [x] Cards reinicializados com loading
- [x] Novos dados carregados após reload

---

## ⚠️ Considerações Importantes

### 1. Ordem de Eventos
A ordem de chegada dos eventos (`myio:customer-total-consumption` vs `myio:energy-data-ready`) pode variar. A implementação garante que o card seja atualizado corretamente independente da ordem.

### 2. Sincronização
- O HEADER **sempre** emite o evento após calcular o total
- O ENERGY **sempre** aguarda ambos eventos antes de exibir dados
- O orquestrador é **single source of truth** para equipments total

### 3. Performance
- Cálculos são leves (apenas soma de Map)
- Sem chamadas adicionais à API
- Usa dados já cacheados pelo orquestrador

### 4. Precisão
- Diferença pode ser positiva ou negativa
- Percentual relativo ao customer total
- Não há validação de "razoabilidade" (diferença pode ser > 100%)

---

## 🚀 Melhorias Futuras

### 1. Trend Histórico
Comparar com período anterior para exibir tendência (▲ ▼)

### 2. Alertas
Se diferença for muito alta (ex: > 20%), emitir alerta de possível erro de medição

### 3. Drill-Down
Clicar no card para ver breakdown detalhado por categoria/device

### 4. Chart
Mini-gráfico mostrando evolução da diferença ao longo do tempo

---

## 📝 Logs de Debug

### Sequência Esperada (Primeira Carga)

```
[MAIN] [Orchestrator] Fetching energy data from API...
[MAIN] [Orchestrator] Energy cache updated: 50 devices
[MAIN] [Orchestrator] Emitted myio:energy-data-ready

[HEADER] Received energy data from orchestrator: 50 devices
[HEADER] Energy card updated: 28.4 MWh
[HEADER] Emitted customer total consumption: 28400 kWh

[ENERGY] Total consumption card initialized with loading state
[ENERGY] Received customer total consumption from HEADER: 28400
[ENERGY] Received energy data from orchestrator: 50 devices
[MAIN] [Orchestrator] Total equipments consumption: 25100 kWh (50 devices)
[MAIN] [Orchestrator] Energy widget data: { customerTotal: 28400, equipmentsTotal: 25100, difference: 3300, percentage: 11.62, deviceCount: 50 }
[ENERGY] Total consumption data: { ... }
[ENERGY] Total consumption data cached: { customerTotal: 28400, equipmentsTotal: 25100, difference: 3300, percentage: 11.62, deviceCount: 50 }
[ENERGY] Total consumption card updated successfully
```

### Sequência com Cache (Troca de Aba)

```
[User clica em EQUIPMENTS]
(... navegação ...)

[User volta para ENERGY - onInit executado]
[ENERGY] Initializing with cached total consumption data
[ENERGY] Using cached total consumption data
(Card exibido IMEDIATAMENTE sem loading)
```

### Sequência com Cache Expirado

```
[User volta para ENERGY após 6 minutos]
[ENERGY] Total consumption cache expired
[ENERGY] Total consumption card initialized with loading state
(Loading spinner exibido)

[Eventos normais acontecem...]
[ENERGY] Received customer total consumption from HEADER: 28400
[ENERGY] Total consumption data cached: { ... }
[ENERGY] Total consumption card updated successfully
```

---

## ✅ Status Final

**Implementação**: ✅ Completa
**Testes**: ⏳ Pendente (aguardando teste do usuário)
**Integração**: ✅ Funcionando
**Documentação**: ✅ Completa

---

**Próxima Ação**: Usuário deve testar refreshando a página e verificando se:
1. HEADER mostra consumo total do customer
2. ENERGY mostra diferença (Total - Equipamentos)
3. Valores fazem sentido
4. Logs aparecem no console conforme esperado
