# MYIO-SIM 1.0.0: Energy Peak Demand Card Implementation Plan

**Status**: 📋 Planning Phase
**Created**: 2025-10-16
**Priority**: 🟡 Medium
**Complexity**: 🟡 Medium (4-6 hours estimated)

---

## 📋 Executive Summary

### Objetivo
Implementar o card de "Pico de Demanda" no widget ENERGY do MYIO-SIM 1.0.0, buscando dados reais do ThingsBoard via API de telemetria, seguindo o padrão estabelecido em `DemandModal.ts`.

### Problema Atual
O card de "Pico de Demanda" no template está com dados mockados estáticos:
```html
<div class="card">
  <p class="label">Pico de Demanda</p>
  <h3 class="value">1.892 kW</h3>
  <span class="trend up">▲ +5% vs ontem</span>
</div>
```

### Solução Proposta
Criar endpoint no nível de **CUSTOMER** (não DEVICE) para buscar o pico de demanda agregado de todos os dispositivos do cliente, usando a API do ThingsBoard.

---

## 🔍 Análise Técnica

### 1. Padrão de Referência: DemandModal.ts

**Localização**: `C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\components\DemandModal.ts`

**URL Pattern Usado** (linhas 731-734):
```typescript
let url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?` +
  `keys=${keys}&startTs=${startTs}&endTs=${endTs}&` +
  `intervalType=${intervalType}&interval=${interval}&agg=${agg}&orderBy=${orderBy}`;
```

**Parâmetros Importantes**:
- `deviceId`: ID do dispositivo no ThingsBoard
- `keys`: Chaves de telemetria (ex: `power`, `demand`, `consumption`)
- `startTs`: Timestamp início (ms)
- `endTs`: Timestamp fim (ms)
- `intervalType`: Tipo de intervalo (`0` para customizado)
- `interval`: Intervalo em ms (ex: `3600000` para 1 hora)
- `agg`: Agregação (`MAX`, `MIN`, `AVG`, `SUM`, `COUNT`, `NONE`)
- `orderBy`: Ordenação (`ASC` ou `DESC`)

### 2. Adaptação para CUSTOMER

**Problema**: A API atual é focada em **DEVICE**. Precisamos adaptar para **CUSTOMER**.

**Soluções Possíveis**:

#### Opção A: Iterar por Devices (Recomendada)
```typescript
// 1. Buscar todos os devices do customer (já temos no self.ctx.data)
// 2. Para cada device, fazer uma chamada individual
// 3. Agregar os resultados localmente
```

#### Opção B: API de Customer Aggregation (Se disponível)
```typescript
// Verificar se ThingsBoard tem endpoint:
// /api/plugins/telemetry/CUSTOMER/${customerId}/values/timeseries
```

#### Opção C: Usar Ingestion API (Orquestrador)
```typescript
// Usar endpoint da Ingestion API similar ao de energy:
// ${DATA_API_HOST}/api/v1/telemetry/customers/${customerId}/demand/peak
```

---

## 🎯 Implementação Detalhada

### Fase 1: Estrutura de Dados e API

#### 1.1 Definir Endpoint e Método

**Arquivo**: `C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\ENERGY\controller.js`

**Função a Criar**:
```javascript
/**
 * Busca o pico de demanda de todos os dispositivos do customer
 * @param {string} customerId - ID do customer no ThingsBoard
 * @param {number} startTs - Timestamp início em ms
 * @param {number} endTs - Timestamp fim em ms
 * @returns {Promise<{peakValue: number, timestamp: number, deviceId: string}>}
 */
async function fetchCustomerPeakDemand(customerId, startTs, endTs) {
  const tbToken = localStorage.getItem("jwt_token");

  if (!tbToken) {
    throw new Error("JWT do ThingsBoard não encontrado");
  }

  // OPÇÃO A: Iterar por devices (implementação completa abaixo)
  const devices = extractDeviceIds(self.ctx.data);
  const peakResults = [];

  for (const deviceId of devices) {
    try {
      const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?` +
        `keys=power,demand&startTs=${startTs}&endTs=${endTs}&` +
        `intervalType=0&interval=3600000&agg=MAX&orderBy=DESC&limit=1`;

      const response = await fetch(url, {
        headers: {
          "X-Authorization": `Bearer ${tbToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn(`[ENERGY] Failed to fetch demand for device ${deviceId}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Data format: { "power": [{ts: 123, value: 456}], "demand": [...] }
      const powerData = data.power || [];
      const demandData = data.demand || [];

      if (powerData.length > 0) {
        peakResults.push({
          deviceId,
          value: powerData[0].value,
          timestamp: powerData[0].ts,
          key: 'power'
        });
      }

      if (demandData.length > 0) {
        peakResults.push({
          deviceId,
          value: demandData[0].value,
          timestamp: demandData[0].ts,
          key: 'demand'
        });
      }
    } catch (err) {
      console.error(`[ENERGY] Error fetching demand for device ${deviceId}:`, err);
    }
  }

  // Encontrar o maior pico entre todos os devices
  if (peakResults.length === 0) {
    return { peakValue: 0, timestamp: Date.now(), deviceId: null, deviceName: null };
  }

  const maxPeak = peakResults.reduce((max, current) =>
    current.value > max.value ? current : max
  );

  // Buscar nome do device
  const deviceName = getDeviceNameById(maxPeak.deviceId);

  return {
    peakValue: maxPeak.value,
    timestamp: maxPeak.timestamp,
    deviceId: maxPeak.deviceId,
    deviceName: deviceName || 'Desconhecido'
  };
}

/**
 * Extrai IDs dos devices do ctx.data
 */
function extractDeviceIds(ctxData) {
  const deviceIds = new Set();

  ctxData.forEach(data => {
    if (data.datasource.aliasName !== "Shopping") {
      const entityId = data.datasource.entityId?.id || data.datasource.entity?.id?.id;
      if (entityId) {
        deviceIds.add(entityId);
      }
    }
  });

  return Array.from(deviceIds);
}

/**
 * Busca nome do device por ID
 */
function getDeviceNameById(deviceId) {
  const deviceData = self.ctx.data.find(d => {
    const id = d.datasource.entityId?.id || d.datasource.entity?.id?.id;
    return id === deviceId;
  });

  return deviceData?.datasource?.entityLabel ||
         deviceData?.datasource?.entityName ||
         deviceData?.datasource?.name ||
         null;
}
```

#### 1.2 Calcular Tendência (Comparação com Período Anterior)

```javascript
/**
 * Calcula a tendência de pico comparando com período anterior
 * @param {number} currentPeak - Pico atual
 * @param {number} startTs - Início do período atual
 * @param {number} endTs - Fim do período atual
 */
async function calculatePeakTrend(currentPeak, startTs, endTs) {
  // Calcular período anterior (mesmo intervalo)
  const periodDuration = endTs - startTs;
  const previousStartTs = startTs - periodDuration;
  const previousEndTs = startTs;

  const customerId = self.ctx.settings.customerId;
  const previousPeak = await fetchCustomerPeakDemand(customerId, previousStartTs, previousEndTs);

  if (!previousPeak || previousPeak.peakValue === 0) {
    return {
      direction: 'neutral',
      percentChange: 0,
      label: '—'
    };
  }

  const percentChange = ((currentPeak - previousPeak.peakValue) / previousPeak.peakValue) * 100;

  return {
    direction: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'neutral',
    percentChange: Math.abs(percentChange),
    label: percentChange > 0
      ? `▲ +${percentChange.toFixed(1)}% vs período anterior`
      : percentChange < 0
      ? `▼ ${percentChange.toFixed(1)}% vs período anterior`
      : '— sem alteração'
  };
}
```

---

### Fase 2: Atualização do Template HTML

**Arquivo**: `C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\ENERGY\template.html`

**ANTES** (Mock):
```html
<div class="card">
  <p class="label">Pico de Demanda</p>
  <h3 class="value">1.892 kW</h3>
  <span class="trend up">▲ +5% vs ontem</span>
</div>
```

**DEPOIS** (Dinâmico):
```html
<div class="card" id="peak-demand-card">
  <p class="label">Pico de Demanda</p>
  <h3 class="value" id="peak-demand-value">
    <svg class="loading-spinner" style="width:24px; height:24px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#6c2fbf" stroke-width="5" stroke-linecap="round"
              stroke-dasharray="90,150" stroke-dashoffset="0">
      </circle>
    </svg>
  </h3>
  <span class="trend" id="peak-demand-trend">Carregando...</span>
  <span class="device-info" id="peak-demand-device" style="font-size: 12px; color: #6b7280; margin-top: 4px;"></span>
</div>
```

**CSS Adicional**:
```html
<style>
  #peak-demand-card {
    position: relative;
  }

  #peak-demand-value {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
  }

  .loading-spinner {
    display: inline-block;
  }

  .trend.up {
    color: #dc2626; /* Red for increase in demand (bad) */
  }

  .trend.down {
    color: #16a34a; /* Green for decrease in demand (good) */
  }

  .trend.neutral {
    color: #6b7280; /* Gray for no change */
  }

  .device-info {
    display: block;
    font-size: 11px;
    color: #6b7280;
    margin-top: 4px;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
```

---

### Fase 3: Integração com Controller

**Arquivo**: `C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\ENERGY\controller.js`

#### 3.1 Adicionar no onInit

```javascript
self.onInit = async function() {
  // ✅ Check active domain
  const currentDomain = window.MyIOOrchestrator?.getActiveDomain?.() || 'energy';

  if (currentDomain !== 'energy') {
    console.log(`[ENERGY] Widget disabled for domain: ${currentDomain}`);
    return;
  }

  console.log("[ENERGY] Initializing energy charts and peak demand card...");

  // Initialize charts with empty state
  initializeCharts();

  // ===== NEW: Initialize Peak Demand Card =====
  initializePeakDemandCard();

  // ===== LISTEN FOR ENERGY DATA FROM ORCHESTRATOR =====
  window.addEventListener('myio:energy-data-ready', (ev) => {
    console.log("[ENERGY] Received energy data:", ev.detail);
    const { cache } = ev.detail;

    // Update charts with real data
    updateCharts(cache);
  });

  // ===== LISTEN FOR DATE CHANGES =====
  window.addEventListener('myio:update-date', async (ev) => {
    console.log("[ENERGY] Date range updated:", ev.detail);

    const { startMs, endMs } = ev.detail;

    if (startMs && endMs) {
      await updatePeakDemandCard(startMs, endMs);
    }
  });
}
```

#### 3.2 Implementar Funções de Atualização

```javascript
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

    const customerId = self.ctx.settings.customerId;

    // Fetch peak demand
    const peakData = await fetchCustomerPeakDemand(customerId, startTs, endTs);

    console.log("[ENERGY] Peak demand data received:", peakData);

    // Format peak value
    const peakValueFormatted = peakData.peakValue >= 1000
      ? `${(peakData.peakValue / 1000).toFixed(3)} MW`
      : `${peakData.peakValue.toFixed(0)} kW`;

    // Update value
    if (valueEl) {
      valueEl.textContent = peakValueFormatted;
    }

    // Calculate and update trend
    const trendData = await calculatePeakTrend(peakData.peakValue, startTs, endTs);

    if (trendEl) {
      trendEl.textContent = trendData.label;
      trendEl.className = `trend ${trendData.direction}`;
    }

    // Update device info
    if (deviceEl && peakData.deviceName) {
      const peakDate = new Date(peakData.timestamp);
      const peakTime = peakDate.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
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
```

---

### Fase 4: Otimizações e Cache

#### 4.1 Implementar Cache Local

```javascript
// Cache para evitar chamadas repetidas
let peakDemandCache = {
  data: null,
  startTs: null,
  endTs: null,
  timestamp: null
};

const PEAK_DEMAND_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

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

function cachePeakDemand(data, startTs, endTs) {
  peakDemandCache = {
    data,
    startTs,
    endTs,
    timestamp: Date.now()
  };
  console.log("[ENERGY] Peak demand data cached");
}
```

#### 4.2 Atualizar fetchCustomerPeakDemand com Cache

```javascript
async function fetchCustomerPeakDemand(customerId, startTs, endTs) {
  // Try cache first
  const cached = getCachedPeakDemand(startTs, endTs);
  if (cached) {
    return cached;
  }

  // ... rest of fetch logic ...

  const result = {
    peakValue: maxPeak.value,
    timestamp: maxPeak.timestamp,
    deviceId: maxPeak.deviceId,
    deviceName: deviceName || 'Desconhecido'
  };

  // Cache the result
  cachePeakDemand(result, startTs, endTs);

  return result;
}
```

---

### Fase 5: Tratamento de Erros e Edge Cases

#### 5.1 Casos Especiais

```javascript
function handlePeakDemandEdgeCases(peakData) {
  // Caso 1: Nenhum dado disponível
  if (!peakData || peakData.peakValue === 0) {
    return {
      value: "— kW",
      trend: "Sem dados disponíveis",
      trendClass: "neutral",
      deviceInfo: ""
    };
  }

  // Caso 2: Valor muito baixo (possível erro de sensor)
  if (peakData.peakValue < 0.1) {
    return {
      value: `${peakData.peakValue.toFixed(3)} kW`,
      trend: "⚠ Valor suspeito - verificar sensor",
      trendClass: "neutral",
      deviceInfo: peakData.deviceName || ""
    };
  }

  // Caso 3: Valor muito alto (possível pico anormal)
  if (peakData.peakValue > 10000) { // > 10 MW
    return {
      value: `${(peakData.peakValue / 1000).toFixed(2)} MW`,
      trend: "⚠ Pico anormalmente alto",
      trendClass: "up",
      deviceInfo: `${peakData.deviceName || "Desconhecido"} - VERIFICAR URGENTE`
    };
  }

  // Caso normal
  return null;
}
```

#### 5.2 Retry Logic para Falhas de Rede

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error;
      console.warn(`[ENERGY] Fetch attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

---

## 📊 Fluxo de Dados Completo

```
┌─────────────────────────────────────────────────────────────┐
│                        USER ACTION                          │
│         (Seleciona datas + clica "Carregar")               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    MENU Widget                              │
│   Dispara: myio:update-date { startMs, endMs, ... }       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    ENERGY Widget                            │
│   Listener: window.addEventListener('myio:update-date')    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              updatePeakDemandCard(startTs, endTs)          │
│   1. Show loading spinner                                   │
│   2. Check cache                                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            fetchCustomerPeakDemand(customerId, ...)        │
│   1. Extract device IDs from self.ctx.data                 │
│   2. For each device:                                       │
│      - Call ThingsBoard API:                                │
│        /api/plugins/telemetry/DEVICE/{id}/values/timeseries│
│        ?keys=power,demand&agg=MAX&limit=1                  │
│   3. Aggregate results (find max peak)                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         calculatePeakTrend(currentPeak, startTs, endTs)    │
│   1. Calculate previous period range                        │
│   2. Fetch previous period peak                             │
│   3. Calculate % change                                     │
│   4. Return { direction, percentChange, label }            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    UPDATE DOM                               │
│   1. #peak-demand-value: "1.892 kW"                        │
│   2. #peak-demand-trend: "▲ +5% vs período anterior"       │
│   3. #peak-demand-device: "Chiller Central às 16/10 14:30" │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Plano de Testes

### Teste 1: Busca de Pico com Dados Válidos
**Cenário**: Customer com múltiplos devices com dados de demanda
**Entrada**:
- customerId: válido
- startTs: início do mês
- endTs: hoje
**Resultado Esperado**:
- ✅ Pico correto identificado
- ✅ Device com maior pico exibido
- ✅ Tendência calculada corretamente

### Teste 2: Sem Dados Disponíveis
**Cenário**: Período sem telemetria
**Entrada**:
- customerId: válido
- startTs/endTs: período sem dados
**Resultado Esperado**:
- ✅ "— kW" exibido
- ✅ "Sem dados disponíveis" na tendência

### Teste 3: Erro de Rede
**Cenário**: API do ThingsBoard indisponível
**Entrada**: API retorna 500
**Resultado Esperado**:
- ✅ Retry logic executado (3 tentativas)
- ✅ "Erro" exibido após falha
- ✅ Mensagem de erro no console

### Teste 4: Cache Funcionando
**Cenário**: Requisições repetidas para mesmo período
**Entrada**:
- 1ª chamada: fetch real
- 2ª chamada (< 5 min): mesmo período
**Resultado Esperado**:
- ✅ 1ª chamada faz fetch
- ✅ 2ª chamada usa cache (log confirmando)

### Teste 5: Mudança de Período
**Cenário**: User altera datas e clica "Carregar"
**Entrada**:
- Período 1: 01/10 - 15/10
- Período 2: 01/09 - 30/09
**Resultado Esperado**:
- ✅ Cache invalidado
- ✅ Novo fetch executado
- ✅ Card atualizado com novos dados

---

## 📝 Checklist de Implementação

### Fase 1: Setup Básico (1-2 horas)
- [ ] Criar função `fetchCustomerPeakDemand()` em ENERGY/controller.js
- [ ] Criar função `extractDeviceIds()` helper
- [ ] Criar função `getDeviceNameById()` helper
- [ ] Testar chamada básica à API do ThingsBoard

### Fase 2: Template e UI (1 hora)
- [ ] Atualizar template.html com IDs dinâmicos
- [ ] Adicionar CSS para estados (loading, up, down, neutral)
- [ ] Adicionar spinner de loading
- [ ] Adicionar campo de device info

### Fase 3: Lógica de Tendência (1-2 horas)
- [ ] Criar função `calculatePeakTrend()`
- [ ] Implementar cálculo de período anterior
- [ ] Implementar cálculo de % de mudança
- [ ] Formatar labels de tendência

### Fase 4: Integração (1 hora)
- [ ] Adicionar `initializePeakDemandCard()` no onInit
- [ ] Criar listener para `myio:update-date`
- [ ] Criar função `updatePeakDemandCard()`
- [ ] Conectar tudo

### Fase 5: Otimizações (30 min - 1 hora)
- [ ] Implementar cache local
- [ ] Implementar retry logic
- [ ] Tratar edge cases (sem dados, valores anormais)
- [ ] Adicionar logs de debug

### Fase 6: Testes (1 hora)
- [ ] Teste 1: Dados válidos
- [ ] Teste 2: Sem dados
- [ ] Teste 3: Erro de rede
- [ ] Teste 4: Cache
- [ ] Teste 5: Mudança de período

---

## ⚠️ Considerações Importantes

### 1. Performance
- ❗ **Múltiplas Chamadas**: Se customer tem 50 devices, serão 50 chamadas à API
- ✅ **Solução**: Implementar batching ou usar endpoint de customer (se disponível)
- ✅ **Mitigação**: Cache agressivo (5 minutos) e chamadas paralelas

### 2. Limitações da API ThingsBoard
- ❗ **Rate Limiting**: API pode ter limite de requisições/minuto
- ✅ **Solução**: Adicionar delay entre chamadas ou usar Promise.allSettled()
- ❗ **Timeout**: Chamadas podem demorar em períodos grandes
- ✅ **Solução**: Usar timeout de 10s por chamada

### 3. Dados Inconsistentes
- ❗ **Keys Diferentes**: Alguns devices usam `power`, outros `demand`
- ✅ **Solução**: Buscar ambas as keys e escolher a disponível
- ❗ **Unidades Diferentes**: kW vs W
- ✅ **Solução**: Normalizar para kW (dividir por 1000 se necessário)

### 4. Integração com Orquestrador
- 💡 **Opção Futura**: Adicionar endpoint no MAIN orchestrator
- 💡 **Vantagem**: Centralizar lógica, reduzir chamadas
- 💡 **Desvantagem**: Requer modificar arquitetura existente

---

## 🚀 Alternativas e Melhorias Futuras

### Alternativa 1: Usar Ingestion API (Se Disponível)
```javascript
// Similar ao endpoint de energy:
const response = await fetch(
  `${DATA_API_HOST}/api/v1/telemetry/customers/${customerId}/demand/peak?` +
  `startTime=${startTs}&endTime=${endTs}`,
  {
    headers: {
      Authorization: `Bearer ${ingestionToken}`,
      "Content-Type": "application/json",
    },
  }
);
```

**Vantagens**:
- ✅ 1 única chamada
- ✅ Backend já agrega dados
- ✅ Mais rápido e eficiente

**Desvantagens**:
- ❌ Requer desenvolvimento backend
- ❌ Depende de infraestrutura Ingestion API

### Alternativa 2: WebSocket para Dados em Tempo Real
```javascript
// Conectar ao WebSocket do ThingsBoard
const ws = new WebSocket(`wss://dashboard.myio-bas.com/api/ws`);

// Subscrever a updates de demanda
ws.send({
  type: 'subscribe',
  keys: ['power', 'demand'],
  entityIds: deviceIds
});
```

**Vantagens**:
- ✅ Dados em tempo real
- ✅ Sem polling

**Desvantagens**:
- ❌ Complexidade adicional
- ❌ Gerenciamento de conexão

### Melhoria 1: Gráfico de Pico ao Longo do Tempo
```javascript
// Adicionar mini-gráfico sparkline mostrando evolução do pico
function renderPeakSparkline(peakHistory) {
  // Usar Chart.js ou biblioteca similar
  const canvas = document.getElementById('peak-sparkline');
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: peakHistory.map(p => formatDate(p.timestamp)),
      datasets: [{
        data: peakHistory.map(p => p.value),
        borderColor: '#dc2626',
        borderWidth: 2,
        pointRadius: 0
      }]
    },
    options: {
      scales: { x: { display: false }, y: { display: false } },
      plugins: { legend: { display: false } }
    }
  });
}
```

### Melhoria 2: Alertas de Pico Anormal
```javascript
// Detectar picos > 120% da média histórica
function detectAbnormalPeak(currentPeak, historicalAverage) {
  const threshold = historicalAverage * 1.2;

  if (currentPeak > threshold) {
    // Emitir evento de alerta
    window.dispatchEvent(new CustomEvent('myio:peak-alert', {
      detail: {
        peak: currentPeak,
        threshold,
        severity: 'high'
      }
    }));

    // Mostrar badge de alerta no card
    showAlertBadge();
  }
}
```

---

## 📚 Referências

### APIs ThingsBoard Consultadas
1. **Timeseries API**: `/api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries`
   - Docs: https://thingsboard.io/docs/user-guide/telemetry/
   - Parâmetros: keys, startTs, endTs, agg, limit

2. **Customer Attributes**: `/api/plugins/telemetry/CUSTOMER/{customerId}/values/attributes`
   - Usado para buscar credenciais

### Componentes Relacionados
- `DemandModal.ts` (linhas 731-734): Padrão de URL para timeseries
- `MAIN/controller.js`: Orquestrador de dados
- `HEADER/controller.js`: Exemplo de agregação por customer
- `v-5.2.0/WIDGET/`: Referência de arquitetura

---

## ✅ Critérios de Sucesso

1. ✅ Card mostra pico de demanda real do período selecionado
2. ✅ Tendência calculada corretamente (comparação com período anterior)
3. ✅ Device com maior pico identificado e exibido
4. ✅ Loading state durante fetch
5. ✅ Error handling robusto
6. ✅ Cache funcional (evita chamadas repetidas)
7. ✅ Performance aceitável (< 5s para 50 devices)
8. ✅ UI responsiva e informativa

---

## 📅 Timeline Estimado

| Fase | Descrição | Duração | Status |
|------|-----------|---------|--------|
| 1 | Setup básico e API | 1-2h | ⏳ Pendente |
| 2 | Template e UI | 1h | ⏳ Pendente |
| 3 | Lógica de tendência | 1-2h | ⏳ Pendente |
| 4 | Integração | 1h | ⏳ Pendente |
| 5 | Otimizações | 30min-1h | ⏳ Pendente |
| 6 | Testes | 1h | ⏳ Pendente |
| **TOTAL** | | **4-6 horas** | |

---

## 🎯 Próximos Passos

1. **Revisar e Aprovar** este plano
2. **Verificar** se Ingestion API tem endpoint de peak demand
3. **Decidir** entre Opção A (iterar devices) vs usar API de customer
4. **Começar implementação** pela Fase 1
5. **Testar incrementalmente** a cada fase

---

**Status Final**: ✅ Plano Completo - Pronto para Implementação
**Próxima Ação**: Aprovação do time e início da Fase 1
