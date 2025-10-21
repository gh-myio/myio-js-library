# RFC-0046: Fix Race Condition - TELEMETRY Widgets Not Displaying Data

**Data:** 2025-10-18
**Status:** ✅ IMPLEMENTED
**Versão:** v5.2.0
**Relacionado:** RFC-0045, BUG-FIX-CACHE-EMPTY-DATA-IMPLEMENTED.md, HEADER-FIX-INITIAL-PERIOD-EMISSION.md

---

## 🐛 Problema Relatado

**Sintoma:** Dos 3 widgets TELEMETRY energy, apenas 1 exibe dados. Os outros 2 ficam:
- Widget 1: Dados zerados e carregando eternamente
- Widget 2: Dados zerados
- Widget 3: ✅ Dados corretos (354 items exibidos)

**Evidência:** Log `dashboard.myio-bas.com-1760757095745-CLEAN.log` (141 linhas)

---

## 🔍 Root Cause Analysis

### Problema 1: Race Condition - `provide-data` Chega Antes de `update-date`

**Evidência no Log:**

```
Linha 10: [HEADER] 🚀 Emitting initial period for domain energy
Linha 25-27: [HEADER] ✅ Emitted myio:update-date to current window + iframe 0

Linha 63: [TELEMETRY] No period set, ignoring data provision and hiding busy
Linha 69: [TELEMETRY] No period set, ignoring data provision and hiding busy
```

**Fluxo Quebrado:**

```
1. Orchestrator emite myio:telemetry:provide-data (354 items)
   ↓
2. TELEMETRY widgets 1 e 2 recebem provide-data
   ├─ Checam: self.ctx.scope.startDateISO = undefined ❌
   ├─ Checam: self.ctx.scope.endDateISO = undefined ❌
   └─ Rejeitam: "No period set, ignoring data provision"
   ↓
3. HEADER emite myio:update-date (TARDE DEMAIS!)
   ↓
4. TELEMETRY widget 3 (último a inicializar) recebe update-date PRIMEIRO
   ├─ Define: self.ctx.scope.startDateISO ✅
   ├─ Define: self.ctx.scope.endDateISO ✅
   └─ Aceita provide-data: "Processing data from orchestrator..."
```

**Root Cause:**
Os widgets TELEMETRY **inicializaram em momentos diferentes**. Widgets 1 e 2 inicializaram **antes** do evento `myio:update-date` chegar, então quando receberam `provide-data`, o `period` ainda não estava definido.

---

### Problema 2: Duplicate `hydrateDomain()` Calls

**Evidência no Log:**

```
Linha 11: [Orchestrator] 📅 Received myio:update-date event
Linha 13: [Orchestrator] hydrateDomain called for energy
Linha 16: [Orchestrator] 📍 fetchAndEnrich called for energy → SUCESSO (354 items)

Linha 18: [Orchestrator] 📅 Received myio:update-date event (DUPLICADO!)
Linha 20: [Orchestrator] hydrateDomain called for energy (DUPLICADO!)
Linha 23: [Orchestrator] 📍 fetchAndEnrich called for energy → TIMEOUT (10s)

Linha 120-138: [Orchestrator] ⚠️ Credentials timeout - Credentials timeout after 10s
```

**Root Cause:**
HEADER emitiu `myio:update-date` **2 vezes** em < 200ms, causando 2 chamadas `hydrateDomain()` simultâneas. A segunda competiu pelas credenciais e timeout.

---

## ✅ Soluções Implementadas

### Fix 1: TELEMETRY - Store Pending `provide-data` Events

**Arquivo:** `TELEMETRY/controller.js`

**Linha 1091-1127:** Modificado `dataProvideHandler` para armazenar eventos que chegam antes do `period` ser definido:

```javascript
// RFC-0045 FIX: Store pending provide-data events that arrive before update-date
let pendingProvideData = null;

// RFC-0042: Listen for data provision from orchestrator
dataProvideHandler = function (ev) {
  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📦 Received provide-data event...`);
  const { domain, periodKey, items } = ev.detail;

  // Only process if it's for my domain
  if (domain !== WIDGET_DOMAIN) {
    return;
  }

  // Prevent duplicate processing
  if (lastProcessedPeriodKey === periodKey) {
    LogHelper.log(`[TELEMETRY] ⏭️ Skipping duplicate provide-data for periodKey: ${periodKey}`);
    return;
  }

  // Validate current period
  const myPeriod = {
    startISO: self.ctx.scope?.startDateISO,
    endISO: self.ctx.scope?.endDateISO
  };

  // RFC-0045 FIX: If period not set yet, STORE the event
  if (!myPeriod.startISO || !myPeriod.endISO) {
    LogHelper.warn(`[TELEMETRY] ⏸️ Period not set yet, storing provide-data event for later processing`);
    pendingProvideData = { domain, periodKey, items };
    // DON'T call hideBusy() here - wait for update-date
    return;
  }

  // Mark as processed ONLY when actually processing
  lastProcessedPeriodKey = periodKey;

  // ... process data normally
};
```

**Linha 992-1001:** Modificado `dateUpdateHandler` para processar evento pendente:

```javascript
// RFC-0045 FIX: Check if there's a pending provide-data event
if (pendingProvideData) {
  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ Found pending provide-data event, processing now...`);
  const pending = pendingProvideData;
  pendingProvideData = null; // Clear

  // Process immediately
  dataProvideHandler({ detail: pending });
  return; // Don't request data again
}

// ... normal flow (request from orchestrator)
```

---

### Fix 2: HEADER - Debounce Duplicate Emissions

**Arquivo:** `HEADER/controller.js`

**Linha 327-341:** Adicionado debouncing em `emitToAllContexts`:

```javascript
// RFC-0045 FIX: Track last emission to prevent duplicates
let lastEmission = {};

// RFC-0042: Helper function to emit period to all contexts
function emitToAllContexts(eventName, detail) {
  // RFC-0045 FIX: Prevent duplicate emissions within 200ms
  const now = Date.now();
  const key = `${eventName}:${JSON.stringify(detail)}`;

  if (lastEmission[key] && (now - lastEmission[key]) < 200) {
    LogHelper.warn(`[HEADER] ⏭️ Skipping duplicate ${eventName} emission (${now - lastEmission[key]}ms ago)`);
    return;
  }

  lastEmission[key] = now;

  // 1. Emit to current window
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
  LogHelper.log(`[HEADER] ✅ Emitted ${eventName} to current window`);

  // 2. Emit to parent window (if in iframe)
  // ... rest of function
}
```

---

## 📊 Comportamento Esperado Após Fixes

### Cenário: 3 TELEMETRY Widgets Inicializam em Momentos Diferentes

```
T=0ms: MENU emite myio:dashboard-state { tab: 'energy' }
       ├─ HEADER recebe e emite myio:update-date (300ms delay)
       └─ Orchestrator hydrateDomain('energy') → fetchAndEnrich()

T=300ms: HEADER emite myio:update-date (PRIMEIRA VEZ)
         ├─ Fix 2: lastEmission['myio:update-date:...'] = 300ms
         └─ Evento emitido para window + iframes

T=310ms: HEADER emite myio:update-date (SEGUNDA VEZ - DUPLICADO)
         ├─ Fix 2: Detecta (310ms - 300ms = 10ms) < 200ms
         └─ ⏭️ Skipping duplicate emission → BLOQUEADO ✅

T=2000ms: Orchestrator fetchAndEnrich() completa (354 items)
          └─ Emite myio:telemetry:provide-data

T=2100ms: TELEMETRY Widget 1 (iniciou antes de update-date)
          ├─ Recebe provide-data
          ├─ Fix 1: period não definido → armazena em pendingProvideData
          └─ ⏸️ Waiting for update-date...

T=2150ms: TELEMETRY Widget 2 (iniciou antes de update-date)
          ├─ Recebe provide-data
          ├─ Fix 1: period não definido → armazena em pendingProvideData
          └─ ⏸️ Waiting for update-date...

T=2200ms: TELEMETRY Widget 3 (iniciou depois de update-date)
          ├─ Recebe provide-data
          ├─ period já definido ✅
          └─ 📄 Processing data from orchestrator... (354 items) ✅

T=2250ms: Widget 1 recebe myio:update-date (evento atrasado)
          ├─ Fix 1: Detecta pendingProvideData !== null
          ├─ Processa evento pendente: dataProvideHandler(pending)
          └─ 📄 Processing data from orchestrator... (354 items) ✅

T=2300ms: Widget 2 recebe myio:update-date (evento atrasado)
          ├─ Fix 1: Detecta pendingProvideData !== null
          ├─ Processa evento pendente: dataProvideHandler(pending)
          └─ 📄 Processing data from orchestrator... (354 items) ✅
```

**Resultado:** ✅ Todos os 3 widgets exibem 354 items corretamente!

---

## 🔍 Logs Esperados Após Fixes

### Success Logs (Todos os Widgets):

```javascript
// Widget com period JÁ definido (widget 3)
[TELEMETRY energy] 📦 Received provide-data event for domain energy, periodKey: ..., items: 354
[TELEMETRY] 🔄 Processing data from orchestrator...
[TELEMETRY] Received 354 items from orchestrator for domain energy
[TELEMETRY] Filtered 354 items down to 232 items matching datasources
[TELEMETRY] Enriched 232 items with orchestrator values
[TELEMETRY] 🏁 Data processed successfully - ensuring busy is hidden

// Widgets com period NÃO definido (widgets 1 e 2)
[TELEMETRY energy] 📦 Received provide-data event for domain energy, periodKey: ..., items: 354
[TELEMETRY] ⏸️ Period not set yet, storing provide-data event for later processing

// ... later when update-date arrives ...
[TELEMETRY energy] ✅ DATE UPDATE EVENT RECEIVED!
[TELEMETRY energy] ✅ Found pending provide-data event, processing now...
[TELEMETRY] 🔄 Processing data from orchestrator...
[TELEMETRY] Received 354 items from orchestrator for domain energy
[TELEMETRY] Enriched 232 items with orchestrator values
[TELEMETRY] 🏁 Data processed successfully
```

### Blocked Duplicate Emission Logs:

```javascript
// First emission
[HEADER] 🚀 Emitting initial period for domain energy: {...}
[HEADER] ✅ Emitted myio:update-date to current window
[HEADER] Found 3 iframes
[HEADER] ✅ Emitted myio:update-date to iframe 0
[HEADER] ✅ Emitted myio:update-date to iframe 1
[HEADER] ✅ Emitted myio:update-date to iframe 2

// Second emission (BLOCKED)
[HEADER] ⏭️ Skipping duplicate myio:update-date emission (15ms ago)
```

---

## 📝 Arquivos Modificados

### 1. `TELEMETRY/controller.js`

**Linha 1091-1092:** Adicionada variável `pendingProvideData`
**Linha 1118-1124:** Adicionada lógica para armazenar eventos pendentes
**Linha 1127:** Movido `lastProcessedPeriodKey =` para DEPOIS da validação
**Linha 992-1001:** Adicionada lógica para processar evento pendente em `dateUpdateHandler`

**Total de Linhas Adicionadas:** ~15 linhas
**Total de Validações:** 1 validação crítica (period check + store)

### 2. `HEADER/controller.js`

**Linha 327-328:** Adicionada variável `lastEmission`
**Linha 332-341:** Adicionado debouncing (200ms) para evitar emissões duplicadas

**Total de Linhas Adicionadas:** ~12 linhas
**Total de Validações:** 1 validação crítica (time check)

---

## ✅ Checklist de Validação

### Funcionalidade

- [x] **Fix 1:** TELEMETRY armazena `provide-data` pendente se `period` não definido
- [x] **Fix 1:** TELEMETRY processa evento pendente quando `update-date` chegar
- [x] **Fix 2:** HEADER bloqueia emissões duplicadas em < 200ms

### Testes

- [ ] **Teste 1:** Recarregar página e verificar que TODOS os 3 widgets exibem dados
- [ ] **Teste 2:** Verificar logs para confirmar:
  - `⏸️ Period not set yet, storing provide-data event` (widgets 1 e 2)
  - `✅ Found pending provide-data event, processing now` (widgets 1 e 2)
  - `⏭️ Skipping duplicate myio:update-date emission` (HEADER)
- [ ] **Teste 3:** Navegar energy → water → energy e verificar todos os widgets funcionam

### Deployment

- [ ] **Build:** Compilar código atualizado (TELEMETRY + HEADER)
- [ ] **Deploy:** Subir para ambiente de teste
- [ ] **QA:** Validar com dados reais do cliente
- [ ] **Production:** Deploy após aprovação

---

## 🎯 Próximos Passos

1. ✅ **Implementação Completa** - 2 fixes aplicados
2. ⏳ **Testing** - Executar testes em ambiente de desenvolvimento
3. ⏳ **Log Analysis** - Capturar novo log e validar comportamento
4. ⏳ **QA Approval** - Validar com dados reais
5. ⏳ **Production Deploy** - Subir para produção

---

## 📚 Documentação Relacionada

- **Bug Report Anterior:** `BUG-FIX-CACHE-EMPTY-DATA-IMPLEMENTED.md`
- **HEADER Fix:** `HEADER-FIX-INITIAL-PERIOD-EMISSION.md`
- **RFC Original:** `RFC-0045-FINAL-DELIVERY.md`
- **Orchestrator Guide:** `ORCHESTRATOR-IMPROVEMENTS-SUMMARY.md`

---

## 🔗 Comparação: Before vs After

### Before Fixes

| Widget | Inicialização | Recebe update-date? | Recebe provide-data? | Period Definido? | Aceita Dados? | Resultado |
|--------|--------------|---------------------|----------------------|------------------|---------------|-----------|
| 1 | T=0ms (cedo) | ❌ Não (ainda) | ✅ Sim (T=2000ms) | ❌ Não | ❌ Rejeita | ❌ Zerado |
| 2 | T=500ms (cedo) | ❌ Não (ainda) | ✅ Sim (T=2000ms) | ❌ Não | ❌ Rejeita | ❌ Zerado |
| 3 | T=1500ms (tarde) | ✅ Sim (T=300ms) | ✅ Sim (T=2000ms) | ✅ Sim | ✅ Aceita | ✅ 354 items |

### After Fixes

| Widget | Inicialização | Recebe provide-data? | Period Definido? | Armazena Pendente? | Processa Depois? | Resultado |
|--------|--------------|----------------------|------------------|--------------------|------------------|-----------|
| 1 | T=0ms (cedo) | ✅ Sim (T=2000ms) | ❌ Não | ✅ Sim | ✅ Sim (T=2250ms) | ✅ 354 items |
| 2 | T=500ms (cedo) | ✅ Sim (T=2000ms) | ❌ Não | ✅ Sim | ✅ Sim (T=2300ms) | ✅ 354 items |
| 3 | T=1500ms (tarde) | ✅ Sim (T=2000ms) | ✅ Sim | ❌ Não | ✅ Sim (imediato) | ✅ 354 items |

---

**Status:** ✅ **CODE READY - AWAITING DEPLOYMENT**
**Próximo:** Deploy widgets TELEMETRY + HEADER e capturar logs de validação
