# Log Analysis - Cache Disabled Test (2025-10-22 20:58)

**Date:** 2025-10-22 20:58:39
**Log File:** dashboard.myio-bas.com-1761166767568.log
**Test:** RFC-0052 - Cache disabled test (`enableCache = false`)
**Status:** 🔴 **CRITICAL ISSUES FOUND**

---

## 🎯 Test Configuration

**Widget Settings (linha 12):**
```javascript
{
  customerTB_ID: '20b93da0-9011-11f0-a06d-e9509531b1d5',
  enableCache: false,  // ← Cache DESABILITADO para teste
  cacheTtlMinutes: 5,
  debugMode: true
}
```

**Expected Behavior:**
- ✅ Cache should be DISABLED
- ✅ Every request should fetch fresh data from API
- ✅ No cache reads or writes

---

## ✅ RFC-0052 Working Correctly

### 1. Cache Disabled Detection ✅

**Linhas 13-15:**
```
[Orchestrator] ⚠️ CACHE DISABLED - All requests will fetch fresh data from API
[Orchestrator] This increases API load. Enable cache for better performance.
```

**Resultado:** ✅ **RFC-0052 log implementado corretamente**

### 2. Cache Cleanup Skipped ✅

**Linha 17:**
```
[Orchestrator] ⏭️ Cache disabled - skipping cleanup
```

**Resultado:** ✅ **cleanupExpiredCache() bypass funcionando**

### 3. Cache Read Skipped ✅

**Linhas 110, 119:**
```
[Orchestrator] 🔍 Checking cache for energy...
```

**Resultado:** ✅ **hydrateDomain() log de status funcionando**

### 4. Cache Write Skipped ✅

**Linha 134:**
```
[Orchestrator] 💾 Cache written for 20b93da0-9011-11f0-a06d-e9509531b1d5:energy:...
```

**⚠️ ATENÇÃO:** Cache foi ESCRITO mesmo com `enableCache = false`!

**Resultado:** 🔴 **BUG - writeCache() bypass NÃO está funcionando corretamente**

---

## 🔴 PROBLEMA CRÍTICO #1: Dual Cache Key (null vs TB_ID)

### Evidências

**PRIMEIRA requisição (FALHOU - linhas 109-237):**
```javascript
// Linha 109: Primeira chamada com customerTB_ID = null
hydrateDomain called for energy: {
  key: 'null:energy:2025-10-01T00:00:00-03:00:2025-10-22T23:59:00-03:00:day',
  inFlight: false
}

// Linha 219: Timeout de credentials
⚠️ Credentials timeout - Credentials timeout after 10s

// Linha 222: Error
fetchAndEnrich error for domain energy: Error: Credentials not available - initialization timeout

// Linha 227: Cache write skipped (empty data)
⚠️ Skipping cache write for null:energy:... - empty data

// Linha 233: Falhou após 10 segundos
✅ Fresh data fetched for energy in 10051ms
```

**SEGUNDA requisição (SUCESSO - linhas 118-143):**
```javascript
// Linha 118: Segunda chamada com customerTB_ID correto
hydrateDomain called for energy: {
  key: '20b93da0-9011-11f0-a06d-e9509531b1d5:energy:2025-10-01T00:00:00-03:00:2025-10-22T23:59:00-03:00:day',
  inFlight: false
}

// Linha 129: Credentials available
✅ Credentials available, proceeding with fetch

// Linha 133: Dados buscados com sucesso
fetchAndEnrich: fetched 354 items for domain energy

// Linha 134: Cache ESCRITO (mesmo com enableCache=false!)
💾 Cache written for 20b93da0-9011-11f0-a06d-e9509531b1d5:energy:...: 354 items

// Linha 138: Sucesso em 1.5 segundos
✅ Fresh data fetched for energy in 1513ms
```

### Root Cause

**Problema:** `cacheKey()` está sendo chamado ANTES de `widgetSettings.customerTB_ID` ser populado, resultando em:
- **Primeira chamada:** `key = 'null:energy:...'` → FALHA
- **Segunda chamada:** `key = '20b93da0-9011-11f0-a06d-e9509531b1d5:energy:...'` → SUCESSO

**Localização no código:**
```javascript
// linha ~109: hydrateDomain é chamado
const key = cacheKey(domain, period);  // ← Usa widgetSettings.customerTB_ID

// Se widgetSettings.customerTB_ID ainda é null → key começa com 'null:'
```

---

## 🔴 PROBLEMA CRÍTICO #2: Cache Write Bypass NÃO Funciona

### Evidência

**Linha 134:**
```
💾 Cache written for 20b93da0-9011-11f0-a06d-e9509531b1d5:energy:...: 354 items, TTL: 30 min
```

**Configuração:**
```javascript
enableCache: false  // Cache deveria estar DESABILITADO
```

### Root Cause

O bypass em `writeCache()` NÃO está impedindo a escrita. Provavelmente:

**Código atual (controller.js linha 1006-1010):**
```javascript
function writeCache(key, data) {
  // RFC-0052: Do not write to cache if cache is disabled
  if (!config.enableCache) {
    LogHelper.log(`[Orchestrator] ⏭️ Cache disabled - skipping write for ${key}`);
    return;
  }
  // ... resto
}
```

**Possível causa:** `config.enableCache` não está sendo lido corretamente do `widgetSettings`.

---

## 🔴 PROBLEMA CRÍTICO #3: TELEMETRY Timeout Waiting for Orchestrator

### Evidências

**Linhas 238-247:**
```
[TELEMETRY] ⚠️ Orchestrator ready timeout after 5s, using fallback
[TELEMETRY] ⚠️ Orchestrator not available, using fallback busy
[TELEMETRY] ⚠️ Orchestrator ready timeout after 5s, using fallback
[TELEMETRY] ⚠️ Orchestrator not available, using fallback hideBusy
```

**Mas ao mesmo tempo (linhas 169-215):**
```
[TELEMETRY energy] Found stored data: 354 items, age: 3644ms
[TELEMETRY energy] ✅ Using stored orchestrator data (parent window)
[TELEMETRY energy] 📦 Received provide-data event for domain energy, items: 354
```

### Análise

**Paradoxo:** TELEMETRY recebe dados do orchestrator, mas também reporta timeout.

**Causa provável:**
1. TELEMETRY widgets carregam ANTES do orchestrator estar pronto
2. Alguns TELEMETRY encontram dados (window.MyIOOrchestratorData)
3. Outros timeout esperando `window.MyIOOrchestrator.isReady`

---

## 📊 Timeline dos Eventos

```
T+0ms     : Dashboard carregado
T+100ms   : Orchestrator inicializado (linha 8: "no stub found")
T+200ms   : widgetSettings capturado (linha 12)
T+300ms   : Credentials setadas com sucesso (linha 30)
T+400ms   : PRIMEIRA hydrateDomain (key='null:...') - INICIA (linha 109)
T+500ms   : SEGUNDA hydrateDomain (key='TB_ID:...') - INICIA (linha 118)
T+2000ms  : SEGUNDA requisição SUCESSO - 354 items (linha 133)
T+2000ms  : Cache ESCRITO (enableCache=false ignorado!) (linha 134)
T+10500ms : PRIMEIRA requisição TIMEOUT - credentials timeout (linha 219)
```

---

## 🔍 Perguntas Críticas

### 1. Por que duas chamadas a hydrateDomain?

**Linhas 106-108 e 116-117:**
```
📅 Received myio:update-date event {period: {...}}
📅 myio:update-date → hydrateDomain(energy)
```

**Resposta:** HEADER emite `myio:update-date` DUAS VEZES:
- Primeira: Antes de widgetSettings.customerTB_ID estar populado
- Segunda: Depois de widgetSettings.customerTB_ID estar populado

### 2. Por que cache foi escrito com enableCache=false?

**Hipótese:** O bypass em `writeCache()` não está funcionando.

**Verificar:**
- `config.enableCache` está sendo lido corretamente?
- `config` está sendo inicializado ANTES de `writeCache()` ser chamado?

### 3. Por que 'null' aparece na primeira cache key?

**Resposta:** `cacheKey()` usa `widgetSettings.customerTB_ID` que ainda é `null` na primeira chamada.

**Fix necessário:** Garantir que `customerTB_ID` seja populado ANTES de qualquer evento ser processado.

---

## ✅ O Que Está Funcionando

1. ✅ **Cache disabled warning** - Linha 13
2. ✅ **cleanupExpiredCache() bypass** - Linha 17
3. ✅ **hydrateDomain() cache status log** - Linhas 110, 119
4. ✅ **Credentials fetch** - Sucesso em 200ms (linha 30)
5. ✅ **TELEMETRY data reception** - 354 items recebidos (linha 171)
6. ✅ **Segunda requisição API** - Sucesso em 1.5s (linha 138)

---

## 🔴 O Que NÃO Está Funcionando

1. 🔴 **writeCache() bypass** - Cache foi escrito com enableCache=false (linha 134)
2. 🔴 **Dual cache key** - Primeira chamada usa 'null' (linha 109)
3. 🔴 **TELEMETRY timeout** - 5s esperando orchestrator (linha 238)
4. 🔴 **Credentials timeout** - Primeira requisição timeout após 10s (linha 219)

---

## 🎯 Ações Necessárias

### URGENTE #1: Corrigir writeCache() Bypass

**Problema:** Cache está sendo escrito mesmo com `enableCache = false`

**Verificar:**
1. `config.enableCache` está sendo populado corretamente?
2. `writeCache()` está recebendo `config` atualizado?
3. Timing: `config` é inicializado ANTES de `writeCache()` ser chamado?

### URGENTE #2: Corrigir Dual Cache Key

**Problema:** Primeira chamada usa `'null:energy:...'` em vez de `'TB_ID:energy:...'`

**Possíveis soluções:**
1. Validar `customerTB_ID !== null` antes de chamar `hydrateDomain()`
2. Ignorar eventos `myio:update-date` até `widgetSettings.customerTB_ID` ser populado
3. Adicionar guard em `cacheKey()`:
   ```javascript
   function cacheKey(domain, period) {
     if (!widgetSettings.customerTB_ID) {
       LogHelper.warn('[Orchestrator] ⚠️ cacheKey called before customerTB_ID is set!');
       return null; // Signal que não pode criar cache key ainda
     }
     // ... resto
   }
   ```

### URGENTE #3: Investigar TELEMETRY Timeout

**Problema:** TELEMETRY reporta timeout mas recebe dados

**Verificar:**
1. `window.MyIOOrchestrator.isReady` sendo setado corretamente?
2. Timing de inicialização do orchestrator vs TELEMETRY load
3. Race condition entre stub creation e widget load

---

## 📝 Conclusão

### RFC-0052 Status

**Parcialmente funcionando:**
- ✅ Cache disabled detection
- ✅ cleanupExpiredCache() bypass
- ✅ hydrateDomain() logs
- 🔴 writeCache() bypass **NÃO FUNCIONA**
- 🔴 readCache() bypass **NÃO TESTADO** (não aparece no log)

### Problemas Pré-existentes (RFC-0051)

- 🔴 Stub do orchestrator não criado (linha 8)
- 🔴 Dual cache key (null vs TB_ID)
- 🔴 TELEMETRY timeout

---

**Próximos passos:**
1. ⏳ Debugar por que `writeCache()` bypass não funciona
2. ⏳ Corrigir dual cache key (null na primeira chamada)
3. ⏳ Investigar config initialization timing
