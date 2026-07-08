# RFC-0056 FIX: Inter-Widget Communication Plan v1.1

**Data**: 2025-01-24
**Versão**: 1.1 (REV.002)
**Status**: ✅ APPROVED FOR IMPLEMENTATION
**Baseado em**: Review REV.001

---

## 📝 Changelog v1.0 → v1.1

### Melhorias Implementadas (REV.001):

1. ✅ **Event Names Consolidados**: `myio:telemetry:update` com `detail.type`
2. ✅ **Period Matching**: Validação de `periodKey` antes de aceitar eventos
3. ✅ **Debounce**: 300ms em `recalculateWithReceivedData()`
4. ✅ **Fallback Mechanism**: `myio:telemetry:request-refresh` após 3s timeout
5. ✅ **Unit Labeling**: Normalização para MWh (2 decimais)
6. ✅ **Error Visibility**: Marcador ⚠️ no UI quando Entrada < Sum
7. ✅ **Performance**: Cache em `sessionStorage` por `domain+periodKey`

---

## 🎯 Objetivo

Corrigir problemas de cálculo no widget **TELEMETRY_INFO** implementando comunicação entre widgets através de eventos customizados consolidados, eliminando duplicação de cálculos e garantindo valores consistentes.

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

## 📐 Arquitetura Proposta v1.1

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
│ Calcula:      │ │ Calcula:     │ │ Escuta:          │
│ - Total Lojas │ │ - Climatiz.  │ │ - Lojas (evento) │
│ (MWh)         │ │ - Elevadores │ │ - AreaComum (ev) │
│               │ │ - Esc.Rol.   │ │                  │
│               │ │ (MWh)        │ │                  │
├───────────────┤ ├──────────────┤ ├──────────────────┤
│ EMITE:        │ │ EMITE:       │ │ EMITE (fallback):│
│ myio:         │ │ myio:        │ │ myio:            │
│ telemetry:    │ │ telemetry:   │ │ telemetry:       │
│ update        │ │ update       │ │ request-refresh  │
│               │ │              │ │                  │
│ type:         │ │ type:        │ │ (após 3s sem     │
│ lojas_total   │ │ areacomum_   │ │  dados)          │
│               │ │ breakdown    │ │                  │
└───────────────┘ └──────────────┘ └──────────────────┘
         │                │                  ▲
         └────────────────┴──────────────────┘
           sessionStorage Cache (domain+periodKey)
```

---

## 🔧 Solução Proposta v1.1

### Fase 1: Evento Consolidado (REV.001)

#### 1.1. Estrutura do Evento Unificado

**Nome do Evento**: `myio:telemetry:update` (único para todos os tipos)

**Estrutura do `detail`**:
```javascript
{
  type: 'lojas_total' | 'areacomum_breakdown' | 'request_refresh',
  domain: 'energy' | 'water' | 'temperature',
  periodKey: 'YYYY-MM-DDTHH:mm:ss.sssZ_YYYY-MM-DDTHH:mm:ss.sssZ',
  timestamp: 1234567890123,
  source: 'TELEMETRY_Lojas' | 'TELEMETRY_AreaComum' | 'TELEMETRY_INFO',

  // Type-specific data (union type)
  data: {
    // For type = 'lojas_total'
    total?: number,      // MWh (2 decimals)
    count?: number,

    // For type = 'areacomum_breakdown'
    climatizacao?: { total: number, count: number, devices: [] },
    elevadores?: { total: number, count: number, devices: [] },
    escadasRolantes?: { total: number, count: number, devices: [] }
  }
}
```

**Benefícios**:
- ✅ Single listener (simpler cleanup)
- ✅ Easier tracing in console (filter by `myio:telemetry:update`)
- ✅ Type-safe with `detail.type` discriminator

---

### Fase 2: TELEMETRY (Lojas) - Emissor v1.1

**Arquivo**: `TELEMETRY/controller.js`

#### 2.1. Função de Normalização de Unidades

```javascript
// RFC-0056 FIX v1.1: Normalize to MWh with 2 decimals
function normalizeToMWh(kWhValue) {
  const mwh = kWhValue / 1000; // kWh → MWh
  return Math.round(mwh * 100) / 100; // 2 decimals
}
```

#### 2.2. Função Emissora com Cache

```javascript
// RFC-0056 FIX v1.1: Emit lojas total with period validation
function emitLojasTotal() {
  const lojasTotal = STATE.itemsEnriched.reduce((sum, item) => sum + (item.total || 0), 0);
  const lojasCount = STATE.itemsEnriched.length;

  // Normalize to MWh
  const totalMWh = normalizeToMWh(lojasTotal);

  // Build periodKey
  const periodKey = `${self.ctx.scope.startDateISO}_${self.ctx.scope.endDateISO}`;

  // Build event detail
  const detail = {
    type: 'lojas_total',
    domain: WIDGET_DOMAIN,
    periodKey: periodKey,
    timestamp: Date.now(),
    source: 'TELEMETRY_Lojas',
    data: {
      total: totalMWh,
      count: lojasCount
    }
  };

  // Emit event
  const event = new CustomEvent('myio:telemetry:update', {
    detail: detail,
    bubbles: true,
    composed: true
  });

  window.dispatchEvent(event);

  // Cache in sessionStorage (REV.001)
  const cacheKey = `myio:telemetry:cache:lojas:${WIDGET_DOMAIN}:${periodKey}`;
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(detail));
  } catch (e) {
    LogHelper.warn('[TELEMETRY_Lojas] Failed to cache data:', e);
  }

  LogHelper.log(`[TELEMETRY_Lojas] 📤 Emitted lojas_total: ${totalMWh} MWh (${lojasCount} devices) for period ${periodKey}`);
}
```

#### 2.3. Chamadas da Função

```javascript
// Call after fetchAndEnrich completes
async function fetchAndEnrich(startISO, endISO) {
  // ... existing code ...

  // After enrichment complete
  emitLojasTotal(); // ← NEW

  // ... existing code ...
}

// Call after orchestrator data
dataProvideHandler = function(ev) {
  // ... existing code ...
  processOrchestratorData(items);
  emitLojasTotal(); // ← NEW
};

// Call after date update
dateUpdateHandler = function(ev) {
  // ... existing code ...
  // After refresh completes
  emitLojasTotal(); // ← NEW
};
```

---

### Fase 3: TELEMETRY (AreaComum_Asset) - Emissor v1.1

**Arquivo**: `TELEMETRY/controller.js` (segundo widget)

#### 3.1. Função de Classificação

```javascript
// RFC-0056 FIX v1.1: Normalize label (remove accents, lowercase)
function normalizeLabel(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
```

#### 3.2. Função Emissora com Cache

```javascript
// RFC-0056 FIX v1.1: Emit areacomum breakdown with period validation
function emitAreaComumBreakdown() {
  // Classify devices into 3 categories
  const climatizacao = STATE.itemsEnriched.filter(item => {
    const label = normalizeLabel(item.label || item.name);
    return /chiller|bomba|hvac|climatizacao|ar condicionado|casa de maquinas/.test(label);
  });

  const elevadores = STATE.itemsEnriched.filter(item => {
    const label = normalizeLabel(item.label || item.name);
    return /elevador|lift/.test(label);
  });

  const escadasRolantes = STATE.itemsEnriched.filter(item => {
    const label = normalizeLabel(item.label || item.name);
    return /escada rolante|esc\. rolante|esc rolante|escalator/.test(label);
  });

  // Calculate totals (kWh)
  const climatizacaoTotalkWh = climatizacao.reduce((sum, i) => sum + (i.total || 0), 0);
  const elevadoresTotalkWh = elevadores.reduce((sum, i) => sum + (i.total || 0), 0);
  const escadasRolantesTotalkWh = escadasRolantes.reduce((sum, i) => sum + (i.total || 0), 0);

  // Normalize to MWh
  const climatizacaoTotalMWh = normalizeToMWh(climatizacaoTotalkWh);
  const elevadoresTotalMWh = normalizeToMWh(elevadoresTotalkWh);
  const escadasRolantesTotalMWh = normalizeToMWh(escadasRolantesTotalkWh);

  // Build periodKey
  const periodKey = `${self.ctx.scope.startDateISO}_${self.ctx.scope.endDateISO}`;

  // Build event detail
  const detail = {
    type: 'areacomum_breakdown',
    domain: WIDGET_DOMAIN,
    periodKey: periodKey,
    timestamp: Date.now(),
    source: 'TELEMETRY_AreaComum',
    data: {
      climatizacao: {
        total: climatizacaoTotalMWh,
        count: climatizacao.length,
        devices: climatizacao.map(d => ({
          id: d.id,
          label: d.label,
          total: normalizeToMWh(d.total || 0)
        }))
      },
      elevadores: {
        total: elevadoresTotalMWh,
        count: elevadores.length,
        devices: elevadores.map(d => ({
          id: d.id,
          label: d.label,
          total: normalizeToMWh(d.total || 0)
        }))
      },
      escadasRolantes: {
        total: escadasRolantesTotalMWh,
        count: escadasRolantes.length,
        devices: escadasRolantes.map(d => ({
          id: d.id,
          label: d.label,
          total: normalizeToMWh(d.total || 0)
        }))
      }
    }
  };

  // Emit event
  const event = new CustomEvent('myio:telemetry:update', {
    detail: detail,
    bubbles: true,
    composed: true
  });

  window.dispatchEvent(event);

  // Cache in sessionStorage (REV.001)
  const cacheKey = `myio:telemetry:cache:areacomum:${WIDGET_DOMAIN}:${periodKey}`;
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(detail));
  } catch (e) {
    LogHelper.warn('[TELEMETRY_AreaComum] Failed to cache data:', e);
  }

  LogHelper.log(`[TELEMETRY_AreaComum] 📤 Emitted areacomum_breakdown for period ${periodKey}:`, {
    climatizacao: climatizacaoTotalMWh,
    elevadores: elevadoresTotalMWh,
    escadasRolantes: escadasRolantesTotalMWh
  });
}
```

---

### Fase 4: TELEMETRY_INFO - Receptor v1.1

**Arquivo**: `TELEMETRY_INFO/controller.js`

#### 4.1. State e Configuração

```javascript
// ===================== INTER-WIDGET COMMUNICATION (RFC-0056 FIX v1.1) =====================

// State for received data from other widgets
const RECEIVED_DATA = {
  lojas: {
    total: 0,      // MWh
    count: 0,
    received: false,
    timestamp: 0,
    periodKey: null
  },
  areaComum: {
    climatizacao: { total: 0, count: 0, devices: [] },
    elevadores: { total: 0, count: 0, devices: [] },
    escadasRolantes: { total: 0, count: 0, devices: [] },
    received: false,
    timestamp: 0,
    periodKey: null
  }
};

// Debounce timer for recalculation (REV.001)
let recalculateDebounceTimer = null;
const RECALCULATE_DEBOUNCE_MS = 300;

// Fallback timeout (REV.001)
let fallbackTimeoutId = null;
const FALLBACK_TIMEOUT_MS = 3000;

// Event handler
let telemetryUpdateHandler = null;
```

#### 4.2. Listener Consolidado (REV.001)

```javascript
// RFC-0056 FIX v1.1: Single unified listener
telemetryUpdateHandler = function(ev) {
  const { type, domain, periodKey, timestamp, source, data } = ev.detail;

  // Only process my domain
  if (domain !== WIDGET_DOMAIN) {
    LogHelper.log(`[TELEMETRY_INFO] Ignoring event for domain: ${domain} (expecting: ${WIDGET_DOMAIN})`);
    return;
  }

  // REV.001: Verify periodKey matches current filter
  const currentPeriodKey = `${self.ctx.scope.startDateISO}_${self.ctx.scope.endDateISO}`;
  if (periodKey !== currentPeriodKey) {
    LogHelper.warn(`[TELEMETRY_INFO] Ignoring event with mismatched periodKey:`, {
      received: periodKey,
      current: currentPeriodKey
    });
    return;
  }

  // Route by type
  switch (type) {
    case 'lojas_total':
      handleLojasTotal(data, periodKey, timestamp);
      break;

    case 'areacomum_breakdown':
      handleAreaComumBreakdown(data, periodKey, timestamp);
      break;

    case 'request_refresh':
      handleRequestRefresh(source);
      break;

    default:
      LogHelper.warn(`[TELEMETRY_INFO] Unknown event type: ${type}`);
  }
};

// Attach single listener (REV.001)
window.addEventListener('myio:telemetry:update', telemetryUpdateHandler);
```

#### 4.3. Handlers por Tipo

```javascript
// Handle lojas_total event
function handleLojasTotal(data, periodKey, timestamp) {
  const { total, count } = data;

  LogHelper.log(`[TELEMETRY_INFO] 📥 Received lojas_total: ${total} MWh (${count} devices)`);

  RECEIVED_DATA.lojas = {
    total: total || 0,
    count: count || 0,
    received: true,
    timestamp: timestamp,
    periodKey: periodKey
  };

  // Trigger recalculation (debounced)
  scheduleRecalculation();

  // Cancel fallback timeout (data received)
  if (fallbackTimeoutId) {
    clearTimeout(fallbackTimeoutId);
    fallbackTimeoutId = null;
  }
}

// Handle areacomum_breakdown event
function handleAreaComumBreakdown(data, periodKey, timestamp) {
  const { climatizacao, elevadores, escadasRolantes } = data;

  LogHelper.log(`[TELEMETRY_INFO] 📥 Received areacomum_breakdown:`, {
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
    timestamp: timestamp,
    periodKey: periodKey
  };

  // Trigger recalculation (debounced)
  scheduleRecalculation();

  // Cancel fallback timeout (data received)
  if (fallbackTimeoutId) {
    clearTimeout(fallbackTimeoutId);
    fallbackTimeoutId = null;
  }
}

// Handle request_refresh event (from other TELEMETRY_INFO instances)
function handleRequestRefresh(source) {
  LogHelper.log(`[TELEMETRY_INFO] 📨 Received request_refresh from ${source}, re-emitting data...`);

  // If this widget has data, re-emit it
  // (This would be in TELEMETRY widgets, not TELEMETRY_INFO)
  // TELEMETRY_INFO just logs it for debugging
}
```

#### 4.4. Recalculação com Debounce (REV.001)

```javascript
// RFC-0056 FIX v1.1: Schedule recalculation with debounce
function scheduleRecalculation() {
  // Clear existing timer
  if (recalculateDebounceTimer) {
    clearTimeout(recalculateDebounceTimer);
  }

  // Schedule new recalculation after debounce
  recalculateDebounceTimer = setTimeout(() => {
    recalculateDebounceTimer = null;

    if (canRecalculate()) {
      recalculateWithReceivedData();
    } else {
      LogHelper.log(`[TELEMETRY_INFO] Waiting for more data... (hasLojas: ${RECEIVED_DATA.lojas.received}, hasAreaComum: ${RECEIVED_DATA.areaComum.received})`);
    }
  }, RECALCULATE_DEBOUNCE_MS);
}

// Check if we have all required data to recalculate
function canRecalculate() {
  const hasLojas = RECEIVED_DATA.lojas.received;
  const hasAreaComum = RECEIVED_DATA.areaComum.received;
  const hasEntrada = STATE.entrada.total > 0;

  return hasLojas && hasAreaComum && hasEntrada;
}
```

#### 4.5. Recalculação com Dados Recebidos

```javascript
// RFC-0056 FIX v1.1: Recalculate using received data from other widgets
function recalculateWithReceivedData() {
  LogHelper.log(`[TELEMETRY_INFO] 🔄 Recalculating with received data (MWh)...`);

  // Use received data (already in MWh)
  const climatizacaoTotal = RECEIVED_DATA.areaComum.climatizacao.total;
  const elevadoresTotal = RECEIVED_DATA.areaComum.elevadores.total;
  const escadasRolantesTotal = RECEIVED_DATA.areaComum.escadasRolantes.total;
  const lojasTotal = RECEIVED_DATA.lojas.total;

  // Entrada remains from orchestrator (convert kWh → MWh if needed)
  const entradaTotalkWh = STATE.entrada.total;
  const entradaTotalMWh = entradaTotalkWh / 1000; // Assuming orchestrator gives kWh

  // Calculate Área Comum as RESIDUAL
  const areaComumResidual = entradaTotalMWh - (climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal);
  const areaComumTotal = Math.max(0, areaComumResidual); // Never negative

  // Total Consumidores = sum of all consumers (NOT including entrada)
  const consumidoresTotal = climatizacaoTotal + elevadoresTotal + escadasRolantesTotal + lojasTotal + areaComumTotal;

  const grandTotal = entradaTotalMWh; // Entrada = 100% reference

  LogHelper.log(`[TELEMETRY_INFO] RFC-0056 FIX v1.1 - Totals recalculated (MWh):`, {
    entradaTotal: entradaTotalMWh.toFixed(2),
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
      total: climatizacaoTotal * 1000, // MWh → kWh for internal state
      perc: grandTotal > 0 ? (climatizacaoTotal / grandTotal) * 100 : 0
    },
    elevadores: {
      devices: RECEIVED_DATA.areaComum.elevadores.devices || [],
      total: elevadoresTotal * 1000, // MWh → kWh
      perc: grandTotal > 0 ? (elevadoresTotal / grandTotal) * 100 : 0
    },
    escadasRolantes: {
      devices: RECEIVED_DATA.areaComum.escadasRolantes.devices || [],
      total: escadasRolantesTotal * 1000, // MWh → kWh
      perc: grandTotal > 0 ? (escadasRolantesTotal / grandTotal) * 100 : 0
    },
    lojas: {
      devices: [], // Devices from lojas widget (could be added to event if needed)
      total: lojasTotal * 1000, // MWh → kWh
      perc: grandTotal > 0 ? (lojasTotal / grandTotal) * 100 : 0
    },
    areaComum: {
      devices: [], // Residual has no direct devices
      total: areaComumTotal * 1000, // MWh → kWh
      perc: grandTotal > 0 ? (areaComumTotal / grandTotal) * 100 : 0
    },
    totalGeral: consumidoresTotal * 1000, // MWh → kWh; FIX: NOT including entrada
    percGeral: 100 // Always 100% (= entrada)
  };

  STATE.grandTotal = entradaTotalMWh * 1000; // MWh → kWh

  // Validate totals
  const validationResult = validateTotals();

  // REV.001: Show warning marker if validation fails
  if (!validationResult.valid) {
    showValidationWarning(validationResult);
  } else {
    hideValidationWarning();
  }

  // Update display
  updateDisplay();
}
```

#### 4.6. Validação com UI Marker (REV.001)

```javascript
// RFC-0056 FIX v1.1: Validate totals with UI feedback
function validateTotals() {
  const sum = STATE.consumidores.climatizacao.total +
              STATE.consumidores.elevadores.total +
              STATE.consumidores.escadasRolantes.total +
              STATE.consumidores.lojas.total +
              STATE.consumidores.areaComum.total;

  const entrada = STATE.entrada.total;
  const diff = Math.abs(entrada - sum);
  const tolerance = 10; // 10 Wh (0.01 kWh)

  const valid = diff <= tolerance;

  if (!valid) {
    LogHelper.warn("⚠️ RFC-0056 FIX v1.1: Total validation FAILED!");
    LogHelper.warn(`  Entrada:          ${entrada.toFixed(2)} kWh (100%)`);
    LogHelper.warn(`  Sum Consumidores: ${sum.toFixed(2)} kWh`);
    LogHelper.warn(`  Diff:             ${diff.toFixed(2)} kWh`);
  } else {
    LogHelper.log("✅ RFC-0056 FIX v1.1: Totals validated successfully");
    LogHelper.log(`  Entrada = Consumidores = ${entrada.toFixed(2)} kWh (100%)`);
  }

  return {
    valid,
    entrada,
    sum,
    diff,
    tolerance
  };
}

// REV.001: Show validation warning in UI
function showValidationWarning(validationResult) {
  const { entrada, sum, diff } = validationResult;

  // Find or create warning element
  let $warning = $root().find('.validation-warning');

  if (!$warning.length) {
    const html = `
      <div class="validation-warning" style="
        position: absolute;
        top: 10px;
        right: 10px;
        background: #FFC107;
        color: #222;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 6px;
      ">
        <span style="font-size: 16px;">⚠️</span>
        <span class="warning-text"></span>
      </div>
    `;
    $root().append(html);
    $warning = $root().find('.validation-warning');
  }

  $warning.find('.warning-text').text(
    `Diferença: ${diff.toFixed(2)} kWh (Entrada: ${entrada.toFixed(2)} vs Soma: ${sum.toFixed(2)})`
  );
  $warning.show();
}

// REV.001: Hide validation warning
function hideValidationWarning() {
  $root().find('.validation-warning').hide();
}
```

#### 4.7. Fallback com Request Refresh (REV.001)

```javascript
// RFC-0056 FIX v1.1: Fallback mechanism - request refresh after timeout
function startFallbackTimeout() {
  // Clear existing timeout
  if (fallbackTimeoutId) {
    clearTimeout(fallbackTimeoutId);
  }

  // Start new timeout
  fallbackTimeoutId = setTimeout(() => {
    fallbackTimeoutId = null;

    if (!canRecalculate()) {
      LogHelper.warn(`[TELEMETRY_INFO] ⏰ Fallback timeout (${FALLBACK_TIMEOUT_MS}ms) - requesting refresh...`);

      // Check cache first (REV.001)
      const hasCache = tryLoadFromCache();

      if (!hasCache) {
        // Emit request_refresh event
        emitRequestRefresh();

        // Try again after another timeout
        startFallbackTimeout();
      }
    }
  }, FALLBACK_TIMEOUT_MS);
}

// REV.001: Try to load data from sessionStorage cache
function tryLoadFromCache() {
  const periodKey = `${self.ctx.scope.startDateISO}_${self.ctx.scope.endDateISO}`;

  let loaded = false;

  try {
    // Try load lojas from cache
    const lojasCacheKey = `myio:telemetry:cache:lojas:${WIDGET_DOMAIN}:${periodKey}`;
    const lojasCache = sessionStorage.getItem(lojasCacheKey);

    if (lojasCache) {
      const detail = JSON.parse(lojasCache);
      handleLojasTotal(detail.data, detail.periodKey, detail.timestamp);
      LogHelper.log(`[TELEMETRY_INFO] 💾 Loaded lojas from cache`);
      loaded = true;
    }

    // Try load areacomum from cache
    const areacomumCacheKey = `myio:telemetry:cache:areacomum:${WIDGET_DOMAIN}:${periodKey}`;
    const areacomumCache = sessionStorage.getItem(areacomumCacheKey);

    if (areacomumCache) {
      const detail = JSON.parse(areacomumCache);
      handleAreaComumBreakdown(detail.data, detail.periodKey, detail.timestamp);
      LogHelper.log(`[TELEMETRY_INFO] 💾 Loaded areacomum from cache`);
      loaded = true;
    }
  } catch (e) {
    LogHelper.warn(`[TELEMETRY_INFO] Failed to load from cache:`, e);
  }

  return loaded;
}

// REV.001: Emit request refresh event
function emitRequestRefresh() {
  const event = new CustomEvent('myio:telemetry:update', {
    detail: {
      type: 'request_refresh',
      domain: WIDGET_DOMAIN,
      periodKey: `${self.ctx.scope.startDateISO}_${self.ctx.scope.endDateISO}`,
      timestamp: Date.now(),
      source: 'TELEMETRY_INFO',
      data: {}
    },
    bubbles: true,
    composed: true
  });

  window.dispatchEvent(event);
  LogHelper.log(`[TELEMETRY_INFO] 📢 Emitted request_refresh for domain ${WIDGET_DOMAIN}`);
}
```

#### 4.8. Lifecycle Hooks

```javascript
self.onInit = async function() {
  // ... existing code ...

  // RFC-0056 FIX v1.1: Attach listener
  window.addEventListener('myio:telemetry:update', telemetryUpdateHandler);

  // Try load from cache immediately (REV.001)
  setTimeout(() => {
    const hasCache = tryLoadFromCache();

    if (!hasCache) {
      // Start fallback timeout
      startFallbackTimeout();
    }
  }, 500);

  // ... existing code ...
};

self.onDestroy = function() {
  LogHelper.log("Widget destroying...");

  // RFC-0056 FIX v1.1: Remove listeners
  if (telemetryUpdateHandler) {
    window.removeEventListener('myio:telemetry:update', telemetryUpdateHandler);
    telemetryUpdateHandler = null;
  }

  // Clear timers
  if (recalculateDebounceTimer) {
    clearTimeout(recalculateDebounceTimer);
    recalculateDebounceTimer = null;
  }

  if (fallbackTimeoutId) {
    clearTimeout(fallbackTimeoutId);
    fallbackTimeoutId = null;
  }

  // ... existing cleanup code ...
};
```

---

## 📊 Fluxo de Dados Completo v1.1

### 1. Inicialização com Cache

```
TELEMETRY_INFO
  ↓ onInit()
  ↓ tryLoadFromCache()
  ├─→ Cache HIT
  │     ↓ handleLojasTotal(cached)
  │     ↓ handleAreaComumBreakdown(cached)
  │     ↓ recalculateWithReceivedData()
  │     ↓ updateDisplay() ✅ FAST!
  │
  └─→ Cache MISS
        ↓ startFallbackTimeout(3s)
        ↓ wait for events...
```

### 2. Eventos Normais

```
MAIN_VIEW (Orchestrator)
  ↓ emite: myio:telemetry:provide-data
  ├─→ TELEMETRY (Lojas)
  │     ↓ normalizeToMWh()
  │     ↓ emitLojasTotal()
  │     ↓ cache in sessionStorage
  │     ↓ emit: myio:telemetry:update (type: lojas_total)
  │
  ├─→ TELEMETRY (AreaComum)
  │     ↓ classifyDevice()
  │     ↓ normalizeToMWh()
  │     ↓ emitAreaComumBreakdown()
  │     ↓ cache in sessionStorage
  │     ↓ emit: myio:telemetry:update (type: areacomum_breakdown)
  │
  └─→ TELEMETRY_INFO
        ↓ telemetryUpdateHandler()
        ↓ verify periodKey ✅
        ↓ handleLojasTotal() OR handleAreaComumBreakdown()
        ↓ scheduleRecalculation() (debounce 300ms)
        ↓ canRecalculate() ?
        ├─→ YES: recalculateWithReceivedData()
        │         ↓ validateTotals()
        │         ├─→ VALID: hideValidationWarning()
        │         └─→ INVALID: showValidationWarning() ⚠️
        │         ↓ updateDisplay()
        │
        └─→ NO: wait for more data...
```

### 3. Fallback com Timeout

```
TELEMETRY_INFO
  ↓ startFallbackTimeout(3s)
  ↓ wait...
  ↓ timeout expires
  ↓ tryLoadFromCache()
  ├─→ Cache HIT: use cached data ✅
  │
  └─→ Cache MISS
        ↓ emitRequestRefresh()
        ↓ emit: myio:telemetry:update (type: request_refresh)
        ↓ TELEMETRY widgets receive request
        ↓ TELEMETRY re-emit their data
        ↓ TELEMETRY_INFO receives data
        ↓ recalculate ✅
```

---

## ✅ Validações v1.1

### Teste 1: Valores Consistentes

```javascript
// Antes (com duplicação):
TELEMETRY (Lojas): 100.00 kWh = 0.10 MWh
TELEMETRY_INFO (Lojas): 95.50 kWh = 0.0955 MWh  ❌ DIFERENTE

// Depois (com eventos v1.1):
TELEMETRY (Lojas): 100.00 kWh → emit 0.10 MWh
TELEMETRY_INFO (Lojas): 0.10 MWh (recebido) ✅ IGUAL
```

### Teste 2: Period Matching (REV.001)

```javascript
// Evento com periodKey antigo (ignorado)
Event: {
  type: 'lojas_total',
  periodKey: '2025-01-01T00:00:00_2025-01-31T23:59:59', // OLD
  data: { total: 100 }
}
Current: '2025-02-01T00:00:00_2025-02-28T23:59:59' // NEW

Result: ⏭️ IGNORED (periodKey mismatch)
```

### Teste 3: Debounce (REV.001)

```javascript
// Multiple events in quick succession
t=0ms:   Event lojas_total → schedule recalc (300ms)
t=50ms:  Event areacomum_breakdown → cancel previous, schedule new (300ms)
t=100ms: Event lojas_total (duplicate) → cancel previous, schedule new (300ms)
t=400ms: Recalculate ONCE ✅ (debounced)
```

### Teste 4: Cache Performance (REV.001)

```javascript
// First load (no cache):
Time to display: 3000ms (wait for events)

// Reload (with cache):
Time to display: 100ms ✅ FAST! (cache hit)
```

### Teste 5: UI Warning Marker (REV.001)

```javascript
// Validation fails:
Entrada: 1000.00 kWh
Sum:     1005.50 kWh
Diff:    5.50 kWh > 0.01 kWh tolerance

UI: ⚠️ Diferença: 5.50 kWh (Entrada: 1000.00 vs Soma: 1005.50) ← VISIBLE
```

---

## 📋 Checklist de Implementação v1.1

### Fase 1: TELEMETRY (Lojas) - Emissor
- [ ] Adicionar `normalizeToMWh()`
- [ ] Adicionar `emitLojasTotal()` com cache
- [ ] Chamar após `fetchAndEnrich()` completar
- [ ] Chamar após evento `myio:update-date`
- [ ] Chamar após evento `myio:telemetry:provide-data`
- [ ] Testar evento no console: `myio:telemetry:update` (type: lojas_total)
- [ ] Verificar cache em sessionStorage

### Fase 2: TELEMETRY (AreaComum) - Emissor
- [ ] Adicionar `normalizeLabel()`
- [ ] Adicionar `normalizeToMWh()`
- [ ] Adicionar `emitAreaComumBreakdown()` com cache
- [ ] Classificar devices em 3 categorias
- [ ] Chamar após processamento de dados
- [ ] Testar evento no console: `myio:telemetry:update` (type: areacomum_breakdown)
- [ ] Verificar cache em sessionStorage

### Fase 3: TELEMETRY_INFO - Receptor
- [ ] Adicionar `RECEIVED_DATA` state
- [ ] Adicionar listener consolidado `telemetryUpdateHandler`
- [ ] Implementar `handleLojasTotal()`
- [ ] Implementar `handleAreaComumBreakdown()`
- [ ] Implementar `handleRequestRefresh()`
- [ ] Implementar `scheduleRecalculation()` com debounce
- [ ] Implementar `canRecalculate()`
- [ ] Implementar `recalculateWithReceivedData()`
- [ ] Implementar `validateTotals()` com UI marker
- [ ] Implementar `showValidationWarning()` / `hideValidationWarning()`
- [ ] Implementar `tryLoadFromCache()`
- [ ] Implementar `startFallbackTimeout()`
- [ ] Implementar `emitRequestRefresh()`
- [ ] Adicionar cleanup no `onDestroy()`
- [ ] Testar period matching
- [ ] Testar debounce (300ms)
- [ ] Testar cache (sessionStorage)
- [ ] Testar fallback timeout (3s)
- [ ] Testar UI warning marker

### Fase 4: Testes
- [ ] Valores iguais entre widgets ✅
- [ ] Period matching funciona ✅
- [ ] Debounce reduz recalcs ✅
- [ ] Cache acelera reload ✅
- [ ] Fallback timeout funciona ✅
- [ ] UI warning visible quando invalid ✅
- [ ] Total consumidores = 100% ✅
- [ ] Área comum residual correto ✅
- [ ] Sem memory leaks ✅
- [ ] Performance < 100ms para recalc ✅

### Fase 5: Documentação
- [ ] Atualizar README.md do TELEMETRY_INFO
- [ ] Documentar evento `myio:telemetry:update`
- [ ] Documentar estrutura do `detail` por type
- [ ] Adicionar diagrama de fluxo v1.1
- [ ] Documentar cache (sessionStorage keys)
- [ ] Atualizar CHANGELOG

---

## 🚧 Riscos e Mitigações v1.1

### Risco 1: Ordem de Carregamento ✅ MITIGADO
**Solução REV.001**:
- Cache em sessionStorage (fast load)
- Fallback timeout (3s) com request_refresh
- Debounce (300ms) evita múltiplas recalcs

### Risco 2: Eventos Perdidos ✅ MITIGADO
**Solução REV.001**:
- Cache persiste entre reloads
- Request refresh fallback
- Logs detalhados para debug

### Risco 3: Performance ✅ MITIGADO
**Solução REV.001**:
- Debounce 300ms
- Cache hit < 100ms
- Normalização MWh (menos processamento)

### Risco 4: Period Mismatch ✅ MITIGADO
**Solução REV.001**:
- Validação de periodKey em todos os eventos
- Eventos antigos ignorados
- Cache separado por periodKey

---

## 📈 Benefícios v1.1

1. **Consistência de Dados**: Valores idênticos entre todos os widgets
2. **Performance**: Cache + Debounce + Normalização MWh
3. **Manutenibilidade**: Evento único consolidado (`myio:telemetry:update`)
4. **Robustez**: Fallback timeout + Cache + Request refresh
5. **Debug**: UI warning marker + Logs detalhados
6. **Escalabilidade**: Fácil adicionar novos tipos de eventos

---

## 🎯 Critérios de Aceitação v1.1

- [ ] Valores de Lojas idênticos (MWh, 2 decimais)
- [ ] Valores de Climatização idênticos
- [ ] Valores de Elevadores idênticos
- [ ] Valores de Esc. Rolantes idênticos
- [ ] Total Consumidores = Entrada (100%)
- [ ] Área Comum = Residual (nunca negativo)
- [ ] Period matching funciona (eventos antigos ignorados)
- [ ] Debounce reduz recalcs (1 recalc para múltiplos eventos)
- [ ] Cache acelera reload (< 100ms)
- [ ] Fallback timeout funciona (request_refresh após 3s)
- [ ] UI warning marker visível quando Entrada ≠ Sum
- [ ] Evento consolidado (`myio:telemetry:update`) com types
- [ ] Logs de debug mostram eventos sendo emitidos e recebidos
- [ ] Sem erros no console do navegador
- [ ] Performance sem degradação (< 100ms para recalcular)
- [ ] sessionStorage cache funciona (keys corretos)

---

## 🚀 Próximos Passos

1. **Aprovação Final**: Review pelo tech lead
2. **Implementação**: Seguir checklist das 5 fases
3. **Testes**: Validar em ambiente staging
4. **Deploy**: Gradual (10% → 50% → 100%)
5. **Monitoramento**: Verificar logs e performance

**Estimativa Total**: 6-8 horas de desenvolvimento + 2 horas de testes

---

**Status**: ✅ **APPROVED FOR IMPLEMENTATION v1.1**

**Próxima Ação**: Iniciar implementação da Fase 1 (TELEMETRY Lojas emissor)
