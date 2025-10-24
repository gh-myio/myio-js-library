# RFC-0056 FIX: Inter-Widget Communication Plan

**Data**: 2025-01-24
**Versão**: 1.0.0
**Status**: 📋 PLANNING

---

## 🎯 Objetivo

Corrigir problemas de cálculo no widget **TELEMETRY_INFO** implementando comunicação entre widgets através de eventos customizados, eliminando duplicação de cálculos e garantindo valores consistentes.

---

## 🐛 Problemas Identificados

### 1. **Entrada** ✅ OK
- Funcionando corretamente
- Mantém cálculo atual do orquestrador

### 2. **Lojas** ❌ PROBLEMA
**Situação Atual**:
- TELEMETRY_INFO calcula soma de devices classificados como "Lojas"
- Dashboard tem widget TELEMETRY separado com datasource `aliasName = "Lojas"`
- **Duplicação de cálculo**: mesmo dado calculado 2x

**Impacto**:
- Valores diferentes entre widgets
- Processamento desnecessário
- Inconsistência de dados

### 3. **Climatização, Elevadores, Escadas Rolantes** ❌ PROBLEMA
**Situação Atual**:
- TELEMETRY_INFO classifica individualmente cada device
- Dashboard tem widget TELEMETRY com datasource `aliasName = "AreaComum_Asset"`
- AreaComum_Asset contém: Climatização + Elevadores + Escadas Rolantes
- **Duplicação de cálculo**: mesmo dado calculado 2x

**Impacto**:
- Valores diferentes entre widgets
- Processamento desnecessário
- Lógica de classificação pode divergir

### 4. **Total Consumidores** ❌ PROBLEMA
**Situação Atual**:
```javascript
// ERRADO: inclui Entrada no total
consumidoresTotal = climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal + areaComumTotal;
```

**Deveria ser**:
```javascript
// CORRETO: Total = soma dos consumidores (SEM entrada)
consumidoresTotal = climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal + areaComumTotal;
// Entrada é 100%, consumidores devem somar 100% também
```

**Impacto**:
- Total duplicado (soma entrada + consumidores)
- Percentuais errados
- Violação do princípio: Entrada = 100% = Soma de todos os consumidores

---

## 📐 Arquitetura Proposta

### Diagrama de Comunicação

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN_VIEW (Orchestrator)                  │
│  - Busca dados da API Data Ingestion                        │
│  - Emite: myio:telemetry:provide-data (todos os devices)    │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌───────────────┐ ┌──────────────┐ ┌──────────────────┐
│  TELEMETRY    │ │  TELEMETRY   │ │  TELEMETRY_INFO  │
│  (Lojas)      │ │ (AreaComum)  │ │  (Consolidado)   │
├───────────────┤ ├──────────────┤ ├──────────────────┤
│ Datasource:   │ │ Datasource:  │ │ NO Datasource    │
│ alias=Lojas   │ │ alias=       │ │ (recebe eventos) │
│               │ │ AreaComum_   │ │                  │
│               │ │ Asset        │ │                  │
├───────────────┤ ├──────────────┤ ├──────────────────┤
│ Calcula:      │ │ Calcula:     │ │ Recebe:          │
│ - Total Lojas │ │ - Climatiz.  │ │ - Lojas (evento) │
│               │ │ - Elevadores │ │ - Climatiz. (ev) │
│               │ │ - Esc.Rol.   │ │ - Elevad. (ev)   │
│               │ │              │ │ - Esc.Rol. (ev)  │
├───────────────┤ ├──────────────┤ ├──────────────────┤
│ EMITE EVENTO: │ │ EMITE EVENTO:│ │ Calcula:         │
│ myio:         │ │ myio:        │ │ - Área Comum     │
│ telemetry:    │ │ telemetry:   │ │   (residual)     │
│ lojas:total   │ │ areacomum:   │ │ - Total Consumi. │
│               │ │ breakdown    │ │                  │
└───────────────┘ └──────────────┘ └──────────────────┘
```

---

## 🔧 Solução Proposta

### Fase 1: Criar Eventos de Comunicação

#### 1.1. Widget TELEMETRY (Lojas) - Emissor

**Arquivo**: `TELEMETRY/controller.js`

**Onde**: Após calcular totais (função que processa dados)

**Evento a emitir**:
```javascript
// Após calcular itemsEnriched com totals
function emitLojasTotal() {
  const lojasTotal = STATE.itemsEnriched.reduce((sum, item) => sum + (item.total || 0), 0);

  const event = new CustomEvent('myio:telemetry:lojas:total', {
    detail: {
      domain: WIDGET_DOMAIN, // 'energy', 'water', etc
      total: lojasTotal,
      count: STATE.itemsEnriched.length,
      timestamp: Date.now(),
      periodKey: `${self.ctx.scope.startDateISO}_${self.ctx.scope.endDateISO}`,
      source: 'TELEMETRY_Lojas'
    },
    bubbles: true,
    composed: true
  });

  window.dispatchEvent(event);
  LogHelper.log(`[TELEMETRY_Lojas] 📤 Emitted lojas total: ${lojasTotal} kWh`);
}
```

**Quando emitir**:
- Após `fetchAndEnrich()` completar
- Após evento `myio:update-date`
- Após evento `myio:telemetry:provide-data` do orquestrador

#### 1.2. Widget TELEMETRY (AreaComum_Asset) - Emissor

**Arquivo**: `TELEMETRY/controller.js` (segundo widget)

**Evento a emitir**:
```javascript
// Após processar devices de AreaComum_Asset
function emitAreaComumBreakdown() {
  // Classificar devices em: Climatização, Elevadores, Escadas Rolantes
  const climatizacao = STATE.itemsEnriched.filter(item => {
    const label = normalizeLabel(item.label || item.name);
    return /chiller|bomba|hvac|climatizacao/.test(label);
  });

  const elevadores = STATE.itemsEnriched.filter(item => {
    const label = normalizeLabel(item.label || item.name);
    return /elevador|lift/.test(label);
  });

  const escadasRolantes = STATE.itemsEnriched.filter(item => {
    const label = normalizeLabel(item.label || item.name);
    return /escada rolante|esc\. rolante|escalator/.test(label);
  });

  // Calcular totais
  const climatizacaoTotal = climatizacao.reduce((sum, i) => sum + (i.total || 0), 0);
  const elevadoresTotal = elevadores.reduce((sum, i) => sum + (i.total || 0), 0);
  const escadasRolantesTotal = escadasRolantes.reduce((sum, i) => sum + (i.total || 0), 0);

  const event = new CustomEvent('myio:telemetry:areacomum:breakdown', {
    detail: {
      domain: WIDGET_DOMAIN,
      climatizacao: {
        total: climatizacaoTotal,
        count: climatizacao.length,
        devices: climatizacao.map(d => ({ id: d.id, label: d.label, total: d.total }))
      },
      elevadores: {
        total: elevadoresTotal,
        count: elevadores.length,
        devices: elevadores.map(d => ({ id: d.id, label: d.label, total: d.total }))
      },
      escadasRolantes: {
        total: escadasRolantesTotal,
        count: escadasRolantes.length,
        devices: escadasRolantes.map(d => ({ id: d.id, label: d.label, total: d.total }))
      },
      timestamp: Date.now(),
      periodKey: `${self.ctx.scope.startDateISO}_${self.ctx.scope.endDateISO}`,
      source: 'TELEMETRY_AreaComum'
    },
    bubbles: true,
    composed: true
  });

  window.dispatchEvent(event);
  LogHelper.log(`[TELEMETRY_AreaComum] 📤 Emitted breakdown:`, {
    climatizacao: climatizacaoTotal,
    elevadores: elevadoresTotal,
    escadasRolantes: escadasRolantesTotal
  });
}

// Helper: normalize label
function normalizeLabel(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
```

### Fase 2: TELEMETRY_INFO - Receptor

#### 2.1. Adicionar Listeners de Eventos

**Arquivo**: `TELEMETRY_INFO/controller.js`

**Onde**: `onInit()` lifecycle

```javascript
// ===================== INTER-WIDGET COMMUNICATION (RFC-0056 FIX) =====================

// State for received data from other widgets
const RECEIVED_DATA = {
  lojas: {
    total: 0,
    count: 0,
    received: false,
    timestamp: 0
  },
  areaComum: {
    climatizacao: { total: 0, count: 0 },
    elevadores: { total: 0, count: 0 },
    escadasRolantes: { total: 0, count: 0 },
    received: false,
    timestamp: 0
  }
};

let lojasEventHandler = null;
let areaComumEventHandler = null;

// Listener: Lojas Total
lojasEventHandler = function(ev) {
  const { domain, total, count, periodKey, timestamp } = ev.detail;

  // Only process my domain
  if (domain !== WIDGET_DOMAIN) {
    LogHelper.log(`[TELEMETRY_INFO] Ignoring lojas event for domain: ${domain}`);
    return;
  }

  LogHelper.log(`[TELEMETRY_INFO] 📥 Received lojas total: ${total} kWh (${count} devices)`);

  RECEIVED_DATA.lojas = {
    total: total || 0,
    count: count || 0,
    received: true,
    timestamp: timestamp || Date.now()
  };

  // Trigger recalculation if we have all data
  if (canRecalculate()) {
    recalculateWithReceivedData();
  }
};

// Listener: AreaComum Breakdown
areaComumEventHandler = function(ev) {
  const { domain, climatizacao, elevadores, escadasRolantes, timestamp } = ev.detail;

  // Only process my domain
  if (domain !== WIDGET_DOMAIN) {
    LogHelper.log(`[TELEMETRY_INFO] Ignoring areacomum event for domain: ${domain}`);
    return;
  }

  LogHelper.log(`[TELEMETRY_INFO] 📥 Received areacomum breakdown:`, {
    climatizacao: climatizacao.total,
    elevadores: elevadores.total,
    escadasRolantes: escadasRolantes.total
  });

  RECEIVED_DATA.areaComum = {
    climatizacao: {
      total: climatizacao.total || 0,
      count: climatizacao.count || 0,
      devices: climatizacao.devices || []
    },
    elevadores: {
      total: elevadores.total || 0,
      count: elevadores.count || 0,
      devices: elevadores.devices || []
    },
    escadasRolantes: {
      total: escadasRolantes.total || 0,
      count: escadasRolantes.count || 0,
      devices: escadasRolantes.devices || []
    },
    received: true,
    timestamp: timestamp || Date.now()
  };

  // Trigger recalculation if we have all data
  if (canRecalculate()) {
    recalculateWithReceivedData();
  }
};

// Attach listeners
window.addEventListener('myio:telemetry:lojas:total', lojasEventHandler);
window.addEventListener('myio:telemetry:areacomum:breakdown', areaComumEventHandler);
```

#### 2.2. Lógica de Recalculação

**Arquivo**: `TELEMETRY_INFO/controller.js`

```javascript
// Check if we have all required data to recalculate
function canRecalculate() {
  const hasLojas = RECEIVED_DATA.lojas.received;
  const hasAreaComum = RECEIVED_DATA.areaComum.received;
  const hasEntrada = STATE.entrada.total > 0;

  LogHelper.log(`[TELEMETRY_INFO] Can recalculate check:`, {
    hasLojas,
    hasAreaComum,
    hasEntrada
  });

  return hasLojas && hasAreaComum && hasEntrada;
}

// Recalculate using received data from other widgets
function recalculateWithReceivedData() {
  LogHelper.log(`[TELEMETRY_INFO] 🔄 Recalculating with received data...`);

  // Use received data instead of classifying devices
  const climatizacaoTotal = RECEIVED_DATA.areaComum.climatizacao.total;
  const elevadoresTotal = RECEIVED_DATA.areaComum.elevadores.total;
  const escadasRolantesTotal = RECEIVED_DATA.areaComum.escadasRolantes.total;
  const lojasTotal = RECEIVED_DATA.lojas.total;

  // Entrada remains from orchestrator (already calculated)
  const entradaTotal = STATE.entrada.total;

  // Calculate Área Comum as RESIDUAL
  const areaComumResidual = entradaTotal - (climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal);
  const areaComumTotal = Math.max(0, areaComumResidual); // Never negative

  // Total Consumidores = sum of all consumers (NOT including entrada)
  const consumidoresTotal = climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal + areaComumTotal;

  const grandTotal = entradaTotal; // Entrada = 100% reference

  LogHelper.log(`[TELEMETRY_INFO] RFC-0056 FIX - Totals recalculated:`, {
    entradaTotal: entradaTotal.toFixed(2),
    climatizacaoTotal: climatizacaoTotal.toFixed(2),
    elevadoresTotal: elevadoresTotal.toFixed(2),
    escadasRolantesTotal: escadasRolantesTotal.toFixed(2),
    lojasTotal: lojasTotal.toFixed(2),
    areaComumResidual: areaComumResidual.toFixed(2),
    areaComumTotal: areaComumTotal.toFixed(2),
    consumidoresTotal: consumidoresTotal.toFixed(2)
  });

  // Update STATE with received data
  STATE.consumidores = {
    climatizacao: {
      devices: RECEIVED_DATA.areaComum.climatizacao.devices || [],
      total: climatizacaoTotal,
      perc: grandTotal > 0 ? (climatizacaoTotal / grandTotal) * 100 : 0
    },
    elevadores: {
      devices: RECEIVED_DATA.areaComum.elevadores.devices || [],
      total: elevadoresTotal,
      perc: grandTotal > 0 ? (elevadoresTotal / grandTotal) * 100 : 0
    },
    escadasRolantes: {
      devices: RECEIVED_DATA.areaComum.escadasRolantes.devices || [],
      total: escadasRolantesTotal,
      perc: grandTotal > 0 ? (escadasRolantesTotal / grandTotal) * 100 : 0
    },
    lojas: {
      devices: [], // Devices from lojas widget (could be added to event if needed)
      total: lojasTotal,
      perc: grandTotal > 0 ? (lojasTotal / grandTotal) * 100 : 0
    },
    areaComum: {
      devices: [], // Residual has no direct devices
      total: areaComumTotal,
      perc: grandTotal > 0 ? (areaComumTotal / grandTotal) * 100 : 0
    },
    totalGeral: consumidoresTotal, // FIX: NOT including entrada
    percGeral: 100 // Always 100% (= entrada)
  };

  STATE.grandTotal = grandTotal;

  // Validate totals
  validateTotals();

  // Update display
  updateDisplay();
}
```

### Fase 3: Corrigir Total Consumidores

**Arquivo**: `TELEMETRY_INFO/controller.js`

**Mudança em `aggregateData()`**:

```javascript
// ANTES (ERRADO):
const consumidoresTotal = climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal + areaComumTotal;

// DEPOIS (CORRETO):
// Total Consumidores = soma APENAS dos consumidores (SEM entrada)
const consumidoresTotal = climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal + areaComumTotal;

// Entrada é a referência (100%)
// Consumidores devem somar 100% (= entrada)
const grandTotal = entradaTotal; // Entrada = 100% reference
```

**Validação**:
```javascript
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
    LogHelper.warn("⚠️ RFC-0056 FIX: Total validation FAILED!");
    LogHelper.warn(`  Entrada:          ${entrada.toFixed(2)} kWh (100%)`);
    LogHelper.warn(`  Sum Consumidores: ${sum.toFixed(2)} kWh`);
    LogHelper.warn(`  Diff:             ${diff.toFixed(2)} kWh`);
  } else {
    LogHelper.log("✅ RFC-0056 FIX: Totals validated successfully");
    LogHelper.log(`  Entrada = Consumidores = ${entrada.toFixed(2)} kWh (100%)`);
  }
}
```

### Fase 4: Cleanup (onDestroy)

**Arquivo**: `TELEMETRY_INFO/controller.js`

```javascript
self.onDestroy = function() {
  LogHelper.log("Widget destroying...");

  // Remove event listeners (RFC-0056 FIX)
  if (lojasEventHandler) {
    window.removeEventListener('myio:telemetry:lojas:total', lojasEventHandler);
    lojasEventHandler = null;
  }

  if (areaComumEventHandler) {
    window.removeEventListener('myio:telemetry:areacomum:breakdown', areaComumEventHandler);
    areaComumEventHandler = null;
  }

  // ... existing cleanup code ...
};
```

---

## 📊 Fluxo de Dados Completo

### 1. Inicialização

```
MAIN_VIEW (Orchestrator)
  ↓ emite: myio:telemetry:provide-data
  ├─→ TELEMETRY (Lojas)
  │     ↓ calcula total
  │     ↓ emite: myio:telemetry:lojas:total
  │
  ├─→ TELEMETRY (AreaComum_Asset)
  │     ↓ classifica devices
  │     ↓ emite: myio:telemetry:areacomum:breakdown
  │
  └─→ TELEMETRY_INFO
        ↓ recebe entrada do orchestrator
        ↓ escuta eventos dos outros widgets
        ↓ recalcula com dados recebidos
        ↓ atualiza display
```

### 2. Mudança de Período

```
HEADER
  ↓ emite: myio:update-date
  ↓
MAIN_VIEW (Orchestrator)
  ↓ busca novos dados
  ↓ emite: myio:telemetry:provide-data (nova periodKey)
  ├─→ TELEMETRY (Lojas)
  │     ↓ atualiza totais
  │     ↓ emite: myio:telemetry:lojas:total
  │
  ├─→ TELEMETRY (AreaComum_Asset)
  │     ↓ atualiza breakdown
  │     ↓ emite: myio:telemetry:areacomum:breakdown
  │
  └─→ TELEMETRY_INFO
        ↓ aguarda eventos
        ↓ recalcula quando canRecalculate() = true
        ↓ atualiza display
```

---

## ✅ Validações

### Teste 1: Valores Consistentes

```javascript
// Antes (com duplicação):
TELEMETRY (Lojas): 100.00 kWh
TELEMETRY_INFO (Lojas): 95.50 kWh  ❌ DIFERENTE

// Depois (com eventos):
TELEMETRY (Lojas): 100.00 kWh
TELEMETRY_INFO (Lojas): 100.00 kWh ✅ IGUAL (recebido do evento)
```

### Teste 2: Total Consumidores

```javascript
// Antes (ERRADO):
Entrada: 1000 kWh (100%)
Total Consumidores: 1000 kWh ❌ (somando entrada?)

// Depois (CORRETO):
Entrada: 1000 kWh (100%)
Climatização: 300 kWh (30%)
Elevadores: 100 kWh (10%)
Esc. Rolantes: 50 kWh (5%)
Lojas: 400 kWh (40%)
Área Comum: 150 kWh (15%) ← RESIDUAL
Total Consumidores: 1000 kWh ✅ (soma dos consumidores = entrada)
```

### Teste 3: Área Comum Residual

```javascript
// Formula:
areaComum = entrada - (climatizacao + elevadores + escadasRolantes + lojas)
areaComum = 1000 - (300 + 100 + 50 + 400)
areaComum = 1000 - 850
areaComum = 150 kWh ✅
```

---

## 📋 Checklist de Implementação

### Fase 1: TELEMETRY (Lojas) - Emissor
- [ ] Adicionar função `emitLojasTotal()`
- [ ] Chamar após `fetchAndEnrich()` completar
- [ ] Chamar após evento `myio:update-date`
- [ ] Adicionar logs de debug
- [ ] Testar evento no console do navegador

### Fase 2: TELEMETRY (AreaComum_Asset) - Emissor
- [ ] Adicionar função `normalizeLabel()`
- [ ] Adicionar função `emitAreaComumBreakdown()`
- [ ] Classificar devices em 3 categorias
- [ ] Chamar após processamento de dados
- [ ] Adicionar logs de debug
- [ ] Testar evento no console do navegador

### Fase 3: TELEMETRY_INFO - Receptor
- [ ] Adicionar `RECEIVED_DATA` state
- [ ] Adicionar listener `lojasEventHandler`
- [ ] Adicionar listener `areaComumEventHandler`
- [ ] Implementar `canRecalculate()`
- [ ] Implementar `recalculateWithReceivedData()`
- [ ] Corrigir `aggregateData()` (total consumidores)
- [ ] Atualizar `validateTotals()`
- [ ] Adicionar cleanup no `onDestroy()`

### Fase 4: Testes
- [ ] Testar valores iguais entre widgets
- [ ] Testar mudança de período
- [ ] Testar total consumidores = 100%
- [ ] Testar área comum residual
- [ ] Validar logs de debug
- [ ] Verificar sem memory leaks

### Fase 5: Documentação
- [ ] Atualizar README.md do TELEMETRY_INFO
- [ ] Documentar eventos customizados
- [ ] Adicionar diagrama de fluxo
- [ ] Atualizar CHANGELOG

---

## 🚧 Riscos e Mitigações

### Risco 1: Ordem de Carregamento
**Problema**: TELEMETRY_INFO pode carregar antes dos outros widgets
**Mitigação**:
- Implementar `canRecalculate()` que aguarda todos os dados
- Usar cache de eventos (últimos valores recebidos)
- Timeout de 5s para fallback (usar dados do orquestrador)

### Risco 2: Eventos Perdidos
**Problema**: Evento emitido antes do listener estar ativo
**Mitigação**:
- Widgets emissores devem emitir após cada cálculo
- TELEMETRY_INFO deve solicitar re-emissão se não receber em 5s
- Implementar evento `myio:request:data:refresh`

### Risco 3: Performance
**Problema**: Múltiplos eventos podem causar re-renderizações
**Mitigação**:
- Debounce de 300ms em `recalculateWithReceivedData()`
- Flag `isRecalculating` para evitar duplicatas
- Batch updates quando múltiplos eventos chegam juntos

---

## 📈 Benefícios

1. **Consistência de Dados**: Valores iguais entre todos os widgets
2. **Performance**: Eliminação de cálculos duplicados
3. **Manutenibilidade**: Lógica de classificação centralizada em cada widget
4. **Escalabilidade**: Fácil adicionar novos widgets consumidores
5. **Debug**: Logs claros de comunicação entre widgets

---

## 🎯 Critérios de Aceitação

- [ ] Valores de Lojas idênticos em TELEMETRY e TELEMETRY_INFO
- [ ] Valores de Climatização idênticos em ambos widgets
- [ ] Valores de Elevadores idênticos em ambos widgets
- [ ] Valores de Esc. Rolantes idênticos em ambos widgets
- [ ] Total Consumidores = Entrada (100%)
- [ ] Área Comum = Residual (nunca negativo)
- [ ] Logs de debug mostram eventos sendo emitidos e recebidos
- [ ] Sem erros no console do navegador
- [ ] Performance sem degradação (< 100ms para recalcular)

---

**Próximo Passo**: Aprovação do plano e início da implementação

**Estimativa**: 4-6 horas de desenvolvimento + 2 horas de testes
