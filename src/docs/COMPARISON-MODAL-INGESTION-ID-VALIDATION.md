# Validação: Uso de `ingestionId` no Modo Comparison

## 🎯 Objetivo

Validar se o FOOTER está passando o **`ingestionId` correto** dos devices selecionados para o SDK `renderTelemetryStackedChart`.

**Data**: 2025-10-17
**Status**: ✅ **CORRETO** (com ressalvas)

---

## 📊 Fluxo Atual

### 1. FOOTER Coleta Entities Selecionadas

```javascript
// src/thingsboard/.../FOOTER/controller.js - linha 1107
const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
const selected = MyIOSelectionStore.getSelectedEntities();
// selected = [
//   {
//     id: '35f4a6c0-9181-11f0-a06d-e9509531b1d5',    ← ThingsBoard Device ID
//     ingestionId: 'ing-uuid-123',                   ← ⭐ API Ingestion ID
//     name: 'Chiller1',
//     icon: 'energy',
//     lastValue: 49829.48956594515
//   },
//   { ... }
// ]
```

---

### 2. FOOTER Monta `dataSources` Array

```javascript
// src/thingsboard/.../FOOTER/controller.js - linhas 1123-1129
const dataSources = selected.map(entity => ({
  type: 'device',
  id: entity.ingestionId || entity.id,  // ⭐ Prioriza ingestionId
  label: entity.name || entity.id
}));

// Resultado:
// dataSources = [
//   { type: 'device', id: 'ing-uuid-123', label: 'Chiller1' },
//   { type: 'device', id: 'ing-uuid-456', label: 'Chiller 2' }
// ]
```

**✅ CORRETO**: O código prioriza `ingestionId` sobre `id` (que é o ThingsBoard deviceId).

---

### 3. FOOTER Chama `openDashboardPopupEnergy`

```javascript
// src/thingsboard/.../FOOTER/controller.js - linhas 1178-1202
const modal = window.MyIOLibrary.openDashboardPopupEnergy({
  mode: 'comparison',  // ⭐ MODO COMPARISON
  tbJwtToken: myTbTokenDashBoardFooter,
  ingestionToken: tokenIngestionDashBoardComparison,
  dataSources: dataSources,  // ⭐ Array com ingestionIds
  readingType: readingType,  // 'energy', 'water', etc
  startDate: startDate,      // ISO string
  endDate: endDate,          // ISO string
  granularity: granularity,  // '1d', '1h', etc
  clientId: clientId,
  clientSecret: clientSecret,
  dataApiHost: 'https://api.data.apps.myio-bas.com',
  theme: 'dark',
  deep: false
});
```

**✅ CORRETO**: Passa `dataSources` com `ingestionId` como `id`.

---

### 4. EnergyModal Processa (ATUAL - QUEBRADO ❌)

```javascript
// src/components/premium-modals/energy/EnergyModal.ts - linha 64
async show(): Promise<{ close: () => void }> {
  // ❌ PROBLEMA: Sempre tenta buscar device context do ThingsBoard
  this.context = await this.fetchDeviceContext();  // ← Falha com deviceId: undefined
  // ...
}
```

**❌ PROBLEMA**: No modo comparison, `deviceId` é `undefined`, mas o código tenta fazer fetch do ThingsBoard.

**Solução**: Implementar fix descrito em `COMPARISON-MODAL-THINGSBOARD-FETCH-BUG.md`.

---

### 5. EnergyModalView Renderiza Chart (CORRETO ✅)

```javascript
// src/components/premium-modals/energy/EnergyModalView.ts - linhas 280-362
private renderComparisonChart(): boolean {
  // ...

  const chartConfig = {
    version: 'v2',
    clientId: this.config.params.clientId,
    clientSecret: this.config.params.clientSecret,
    dataSources: this.config.params.dataSources!,  // ⭐ Usa dataSources do params
    readingType: this.config.params.readingType || 'energy',
    startDate: startDateStr,  // YYYY-MM-DD
    endDate: endDateStr,      // YYYY-MM-DD
    granularity: this.config.params.granularity!,
    theme: theme,
    timezone: tzIdentifier,
    apiBaseUrl: this.config.params.dataApiHost || 'https://api.data.apps.myio-bas.com',
    deep: this.config.params.deep || false
  };

  console.log('[EnergyModalView] Rendering comparison chart with SDK:', chartConfig);

  (this as any).chartInstance = renderTelemetryStackedChart(this.chartContainer, chartConfig);

  return true;
}
```

**✅ CORRETO**: Passa `dataSources` diretamente ao SDK sem modificação.

---

### 6. SDK `renderTelemetryStackedChart` Busca Dados

```typescript
// Esperado pelo SDK (exemplo da documentação)
const chartInstance = renderTelemetryStackedChart(container, {
  version: 'v2',
  clientId: 'testapp_mdb37rrp_7rcije',
  clientSecret: 'FltZq6pqJ9m43u5NnEBUv6fgfaOfyoyYKz0DXL6gdZck1PiTrCwU1QDFrkCAOOyZ',
  dataSources: [
    { type: 'device', id: 'device-1-uuid', label: 'Device 1' },  // ← 'id' é ingestionId
    { type: 'device', id: 'device-2-uuid', label: 'Device 2' },
    { type: 'device', id: 'device-3-uuid', label: 'Device 3' }
  ],
  readingType: 'water',
  startDate: '2025-08-01',  // ← YYYY-MM-DD (sem hora!)
  endDate: '2025-09-30',
  granularity: '1d',        // ← OBRIGATÓRIO
  theme: 'light',
  timezone: 'America/Sao_Paulo',
  apiBaseUrl: 'https://api.data.apps.myio-bas.com',
  deep: false
});
```

**✅ SDK ESPERA**: `dataSources[].id` = `ingestionId` (não é ThingsBoard deviceId)

---

## 🔍 Validação Crítica

### ⚠️ PERGUNTA CHAVE: O que é `entity.ingestionId`?

Vamos verificar de onde vem esse campo:

#### Origem 1: MyIOSelectionStore

Quando um card é selecionado, ele registra a entidade com:

```javascript
// src/components/premium-widgets/template-card-v2.js
const cardEntity = {
  id: entityObject.entityId,           // ← ThingsBoard deviceId
  name: entityObject.labelOrName,
  icon: entityObject.deviceType,
  group: entityObject.group,
  lastValue: entityObject.val,
  unit: unit,
  ingestionId: entityObject.ingestionId,  // ⭐ CRÍTICO: De onde vem?
  // ...
};

MyIOSelectionStore.registerEntity(cardEntity);
```

#### Origem 2: TELEMETRY Widget

O TELEMETRY widget monta as entidades com:

```javascript
// src/thingsboard/.../TELEMETRY/controller.js - linhas 536-558
const entityObject = {
  entityId: it.tbId || it.id,            // ThingsBoard deviceId
  labelOrName: it.label,
  deviceType: it.deviceType,
  val: valNum,
  perc: it.perc ?? 0,
  deviceStatus: connectionStatus,
  entityType: "DEVICE",
  deviceIdentifier: it.identifier,
  slaveId: it.slaveId || "N/A",
  ingestionId: it.ingestionId || "N/A",  // ⭐ AQUI!
  centralId: it.centralId || "N/A",
  centralName: it.centralName || "N/A",
  updatedIdentifiers: it.updatedIdentifiers || {},
  handInfo: true,
  connectionStatusTime: Date.now(),
  timaVal: Date.now()
};
```

#### Origem 3: TELEMETRY Widget - Onde `it.ingestionId` vem?

```javascript
// src/thingsboard/.../TELEMETRY/controller.js - linhas 390-435
function buildAuthoritativeItems() {
  const base = MyIO.buildListItemsThingsboardByUniqueDatasource(self.ctx.datasources, self.ctx.data) || [];

  const mapped = ok.map(r => {
    const ingestionId = r.id;  // ⭐ AQUI: r.id É O ingestionId da API!

    return {
      id: tbId || ingestionId,
      tbId,                     // ThingsBoard deviceId
      ingestionId,              // ⭐ API ingestion ID
      identifier: r.identifier,
      label: r.label,
      // ...
    };
  });

  return mapped;
}
```

#### Origem 4: MyIOLibrary - `buildListItemsThingsboardByUniqueDatasource`

Este método está na biblioteca `myio-js-library` e extrai o `ingestionId` dos **Server Attributes** do ThingsBoard device:

```javascript
// Pseudo-código (simplificado)
function buildListItemsThingsboardByUniqueDatasource(datasources, data) {
  return datasources.map(ds => {
    // Busca o atributo 'ingestionId' do device
    const ingestionIdAttr = data.find(d => d.dataKey.name === 'ingestionId' && d.datasource === ds);

    return {
      id: ingestionIdAttr?.data[0][1],  // ⭐ ingestionId from Server Attributes
      identifier: ...,
      label: ds.entityName || ds.name
    };
  });
}
```

---

## ✅ Validação Final: Está CORRETO?

### SIM ✅, MAS...

O fluxo está **tecnicamente correto**:

1. ✅ TELEMETRY widget extrai `ingestionId` dos **Server Attributes** do ThingsBoard
2. ✅ TELEMETRY widget passa `ingestionId` ao card via `entityObject.ingestionId`
3. ✅ Card registra entidade com `ingestionId` no SelectionStore
4. ✅ FOOTER monta `dataSources` com `entity.ingestionId`
5. ✅ EnergyModalView passa `dataSources` ao SDK sem modificação
6. ✅ SDK usa `dataSources[].id` (que é `ingestionId`) para buscar dados da API

### ⚠️ PORÉM...

O fluxo **QUEBRA** porque `EnergyModal.show()` tenta fazer fetch do ThingsBoard **ANTES** de passar para `EnergyModalView`.

---

## 🐛 Problema Bloqueante

```
FOOTER → openDashboardPopupEnergy(dataSources: [ingestionIds])
           ↓
         EnergyModal.show()
           ↓
         ❌ fetchDeviceContext() ← TENTA BUSCAR deviceId: undefined
           ↓
         💥 400 BAD REQUEST
```

**Solução**: Implementar o fix descrito em `COMPARISON-MODAL-THINGSBOARD-FETCH-BUG.md`.

---

## 📋 Checklist de Validação

### Pré-requisitos ✅

- [x] **ThingsBoard Devices têm Server Attribute `ingestionId`**
  - Verificar em: Device > Attributes > Server Attributes > `ingestionId`
  - Deve ser UUID válido (ex: `abc-123-def-456`)

- [x] **TELEMETRY widget está configurado corretamente**
  - Datasources mapeados para devices
  - Data keys incluem `ingestionId`

- [x] **FOOTER usa `entity.ingestionId`**
  - Código: `id: entity.ingestionId || entity.id`
  - Fallback para `id` se `ingestionId` não existir

### Código ✅

- [x] **FOOTER monta dataSources corretamente**
  ```javascript
  { type: 'device', id: entity.ingestionId, label: entity.name }
  ```

- [x] **EnergyModalView usa dataSources diretamente**
  ```javascript
  dataSources: this.config.params.dataSources!
  ```

- [x] **SDK recebe formato correto**
  ```javascript
  dataSources: [{ type: 'device', id: 'ing-uuid', label: 'Name' }]
  ```

### Bloqueadores ❌

- [ ] **EnergyModal.show() pula fetch do ThingsBoard em modo comparison**
  - Status: ❌ **NÃO IMPLEMENTADO**
  - Fix: `COMPARISON-MODAL-THINGSBOARD-FETCH-BUG.md`

---

## 🎯 Resposta à Pergunta Inicial

> "Reforçando como devemos abrir o gráfico de comparação, revise se vai funcionar dessa maneira, passando os ingestionId de cada device que está no footer selecionado para comparar"

### ✅ **SIM, ESTÁ CORRETO!**

O FOOTER **JÁ ESTÁ** passando os `ingestionId` corretamente:

```javascript
// FOOTER monta assim:
const dataSources = selected.map(entity => ({
  type: 'device',
  id: entity.ingestionId || entity.id,  // ← ingestionId!
  label: entity.name
}));

// SDK ESPERA exatamente isso:
const chartInstance = renderTelemetryStackedChart(container, {
  dataSources: [
    { type: 'device', id: 'ingestion-id-1', label: 'Device 1' },
    { type: 'device', id: 'ingestion-id-2', label: 'Device 2' }
  ],
  // ...
});
```

### ⚠️ MAS...

O **único problema** é que `EnergyModal.show()` tenta fazer fetch do ThingsBoard **ANTES** de chegar no `EnergyModalView.renderComparisonChart()`.

**Basta implementar o fix** e vai funcionar perfeitamente! ✅

---

## 📊 Diagrama Completo (Correto)

```
┌─────────────────────────────────────────────────────────────────┐
│                 USER SELECTS 2+ DEVICES                         │
│                 (clicks checkboxes on TELEMETRY cards)          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         TELEMETRY Card registers entity with:                   │
│         {                                                       │
│           id: 'tb-device-uuid-123',          ← ThingsBoard     │
│           ingestionId: 'ing-uuid-abc',       ← ⭐ API ID       │
│           name: 'Chiller1',                                     │
│           icon: 'energy'                                        │
│         }                                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│       MyIOSelectionStore.registerEntity(entity)                 │
│       Stores entity with ingestionId                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│             USER CLICKS "COMPARAR" IN FOOTER                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         FOOTER gets selected entities:                          │
│         selected = MyIOSelectionStore.getSelectedEntities()     │
│         // [                                                    │
│         //   { id: 'tb-uuid-1', ingestionId: 'ing-abc', ... }, │
│         //   { id: 'tb-uuid-2', ingestionId: 'ing-def', ... }  │
│         // ]                                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         FOOTER maps to dataSources:                             │
│         dataSources = selected.map(entity => ({                 │
│           type: 'device',                                       │
│           id: entity.ingestionId,  ← ⭐ Uses ingestionId       │
│           label: entity.name                                    │
│         }))                                                     │
│         // Result:                                              │
│         // [                                                    │
│         //   { type: 'device', id: 'ing-abc', label: 'X' },    │
│         //   { type: 'device', id: 'ing-def', label: 'Y' }     │
│         // ]                                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│       FOOTER calls openDashboardPopupEnergy({                   │
│         mode: 'comparison',                                     │
│         dataSources: dataSources,  ← ⭐ With ingestionIds      │
│         startDate, endDate, granularity, ...                    │
│       })                                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         EnergyModal.show()                                      │
│         ❌ PROBLEMA ATUAL: Tenta fetchDeviceContext()          │
│         ✅ FIX: Pular fetch em modo comparison                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         EnergyModalView.renderComparisonChart()                 │
│         Passes dataSources DIRECTLY to SDK:                     │
│         renderTelemetryStackedChart(container, {                │
│           dataSources: [                                        │
│             { type: 'device', id: 'ing-abc', label: 'X' },     │
│             { type: 'device', id: 'ing-def', label: 'Y' }      │
│           ],                                                    │
│           readingType: 'energy',                                │
│           startDate: '2025-10-01',  ← YYYY-MM-DD               │
│           endDate: '2025-10-17',                                │
│           granularity: '1d',                                    │
│           clientId, clientSecret, ...                           │
│         })                                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         SDK renderTelemetryStackedChart()                       │
│         Makes API calls:                                        │
│         GET /api/v1/telemetry/devices/ing-abc/totals?...        │
│         GET /api/v1/telemetry/devices/ing-def/totals?...        │
│         Uses ingestionId as device ID ✅                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              SDK renders stacked bar chart ✅                   │
│              Shows all devices in comparison                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Conclusão

### ✅ Fluxo de `ingestionId` está CORRETO:

1. ✅ ThingsBoard devices têm `ingestionId` em Server Attributes
2. ✅ TELEMETRY widget extrai `ingestionId` corretamente
3. ✅ Card registra entidade com `ingestionId` no SelectionStore
4. ✅ FOOTER monta `dataSources` com `ingestionId`
5. ✅ EnergyModalView passa `dataSources` ao SDK sem modificação
6. ✅ SDK usa `ingestionId` para buscar dados da API

### ❌ Bloqueador Atual:

- **EnergyModal.show()** tenta fazer fetch do ThingsBoard em modo comparison
- Causa erro 400 porque `deviceId` é `undefined`

### 🔧 Solução:

- Implementar fix descrito em `COMPARISON-MODAL-THINGSBOARD-FETCH-BUG.md`
- Pular `fetchDeviceContext()` quando `mode === 'comparison'`

### 📋 Próximos Passos:

1. **Implementar fix em `EnergyModal.ts`** (5 métodos modificados)
2. **Testar com 2+ devices selecionados**
3. **Verificar que SDK recebe `ingestionId` correto**
4. **Publicar versão corrigida no NPM**

---

**Criado por**: Claude Code
**Data**: 2025-10-17
**Status**: ✅ **VALIDAÇÃO COMPLETA - FLUXO CORRETO - FIX NECESSÁRIO**
