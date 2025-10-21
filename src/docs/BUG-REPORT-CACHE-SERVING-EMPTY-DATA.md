# 🐛 BUG REPORT: Cache Serving Empty Data on Domain Switch

**Data:** 2025-10-17
**Severidade:** 🔴 CRITICAL
**Versão Afetada:** v5.2.0
**RFC Relacionado:** RFC-0045 (Robust Cache Strategy)

---

## 📋 Resumo do Problema

Quando o usuário navega entre domínios (energy → water → energy), o sistema serve dados **zerados (0 items)** do cache na segunda visita ao domínio `energy`.

**Reprodução:**
1. ✅ Usuário acessa `energy` → carrega 354 items
2. ✅ Usuário troca para `water` → carrega 93 items
3. ❌ Usuário volta para `energy` → **recebe 0 items do cache**

---

## 🔍 Análise do Log

### Sequência de Eventos (Linhas do Log)

#### 1️⃣ **Primeira Visita ao Energy** (Linha 3-82)

```
[linha 3] 📅 myio:update-date → hydrateDomain(energy)
[linha 4] hydrateDomain called for energy: {key: '...', inFlight: false}
[linha 5] 🎯 Cache hit for energy, fresh: true
[linha 6] 📦 Cache updated for energy: 0 items (v9)   ← ⚠️ CACHE COM 0 ITEMS!
[linha 14] 📡 Emitted provide-data for energy with 0 items
...
[linha 82] fetchAndEnrich: fetched 354 items for domain energy
[linha 661] 📡 Emitted provide-data for energy with 354 items
```

**Problema Identificado:** O cache foi atualizado com `0 items` (v9) **ANTES** do fetch completar.

---

#### 2️⃣ **Visita ao Water** (Linha 691-728)

```
[linha 691] 🔄 myio:dashboard-state → hydrateDomain(water)
[linha 692] hydrateDomain called for water: {key: '...', inFlight: false}
[linha 702] 📡 Emitted provide-data for water with 0 items
[linha 722] fetchAndEnrich: fetched 93 items for domain water
[linha 728] 📡 Emitted provide-data for water with 93 items
```

**Mesma Issue:** Cache atualizado com `0 items` antes do fetch completar.

---

#### 3️⃣ **Segunda Visita ao Energy** (Linha 1064-1075) - 🔴 BUG CRÍTICO

```
[linha 1064] 🔄 myio:dashboard-state → hydrateDomain(energy)
[linha 1065] hydrateDomain called for energy: {key: '...', inFlight: false}
[linha 1066] 🎯 Cache hit for energy, fresh: true
[linha 1067] 📦 Cache updated for energy: 0 items (v11)   ← ⚠️ SERVIU CACHE COM 0 ITEMS!
[linha 1075] 📡 Emitted provide-data for energy with 0 items
[linha 1076] ✅ Fresh cache hit - hiding busy immediately
```

**ROOT CAUSE:** O cache armazenado na primeira visita tinha `0 items`, então quando o usuário voltou para `energy`, o sistema serviu o **cache com 0 items** em vez de buscar dados frescos.

---

## 🧬 Root Cause Analysis

### Código Problemático (`controller.js:1072-1086`)

```javascript
// MAIN_VIEW/controller.js - Linha 1072-1086
const cached = readCache(key);

// IMPORTANT: Emit cached data immediately (no debounce)
// Debounce was causing race conditions with fresh data
if (cached) {
  LogHelper.log(`[Orchestrator] 🎯 Cache hit for ${domain}, fresh: ${cached.fresh}`);
  emitProvide(domain, key, cached.data);  // ← 🐛 EMITE DADOS DO CACHE (pode ser vazio!)
  metrics.recordHydration(domain, Date.now() - startTime, true);

  if (cached.fresh) {
    // IMPORTANT: Always hide busy for fresh cache hits
    LogHelper.log(`[Orchestrator] ✅ Fresh cache hit - hiding busy immediately`);
    setTimeout(() => hideGlobalBusy(), 100);
    return cached.data;  // ← 🐛 RETORNA SEM BUSCAR DADOS FRESCOS!
  }
}
```

**Problema:**
1. `readCache()` retorna cache com `cached.data = []` (array vazio)
2. `cached.fresh = true` porque o cache foi criado há menos de 5 minutos
3. `emitProvide()` emite `items = []` (0 items)
4. **Retorna imediatamente** sem buscar dados da API

---

### Por Que o Cache Tinha 0 Items?

**Sequência de Execução Problemática:**

```
1. hydrateDomain(energy) é chamado
2. readCache(key) → retorna null (sem cache)
3. cached = null, pula o bloco "if (cached)"
4. showGlobalBusy(energy) exibido
5. fetchPromise iniciado (async)
6. ⚠️ Enquanto fetchAndEnrich está executando:
   - emitProvide() é chamado com cached.data (que ainda é [])
   - Cache é atualizado: MyIOOrchestratorData[energy] = { items: [], version: 9 }
7. fetchAndEnrich completa e retorna 354 items
8. writeCache() atualiza o cache com 354 items
9. emitProvide() emite 354 items novamente
```

**Mas então, por que o cache ficou com 0 items?**

**ANSWER:** Olhando para o código em `controller.js:1072-1086`, vejo que `emitProvide()` é chamado com `cached.data`, mas **`cached.data` pode ser `[]` (array vazio)** se:

1. O cache foi criado durante uma execução anterior onde `fetchAndEnrich()` retornou `[]`
2. OU houve um erro durante o fetch e `fetchAndEnrich()` retornou `[]` como fallback

---

## 🔎 Análise Detalhada: Por Que `fetchAndEnrich()` Retornou `[]`?

**Código de `fetchAndEnrich()` (controller.js:921-1043):**

```javascript
async function fetchAndEnrich(domain, period) {
  try {
    // ... authentication and fetch logic ...

    const items = rows.map(row => ({
      id: row.id,
      tbId: row.id,
      ingestionId: row.id,
      identifier: row.identifier || row.id,
      label: row.name || row.label || row.identifier || row.id,
      value: Number(row.total_value || 0),
      perc: 0,
      deviceType: row.deviceType || 'energy',
      slaveId: row.slaveId || null,
      centralId: row.centralId || null
    }));

    LogHelper.log(`[Orchestrator] fetchAndEnrich: fetched ${items.length} items for domain ${domain}`);
    return items;
  } catch (error) {
    LogHelper.error(`[Orchestrator] fetchAndEnrich error for domain ${domain}:`, error);
    return [];  // ← 🐛 RETORNA ARRAY VAZIO EM CASO DE ERRO!
  }
}
```

**Hipótese 1:** Durante a primeira execução, `fetchAndEnrich()` capturou uma exceção e retornou `[]`.

**Hipótese 2:** A resposta da API foi `[]` devido a um problema de autenticação ou timeout.

---

## 📊 Evidências do Log

### Evidência 1: Cache Foi Atualizado com 0 Items ANTES do Fetch Completar

```
[linha 6] 📦 Cache updated for energy: 0 items (v9)
[linha 14] 📡 Emitted provide-data for energy with 0 items
[linha 82] fetchAndEnrich: fetched 354 items for domain energy  ← Fetch completou DEPOIS
[linha 661] 📡 Emitted provide-data for energy with 354 items
```

**Conclusão:** Há uma race condition onde `emitProvide()` é chamado **DUAS VEZES**:
1. Primeira vez com `items = []` (antes do fetch)
2. Segunda vez com `items = [354 items]` (depois do fetch)

---

### Evidência 2: Cache "Fresh" Impediu Novo Fetch

```
[linha 1066] 🎯 Cache hit for energy, fresh: true
[linha 1067] 📦 Cache updated for energy: 0 items (v11)
[linha 1075] 📡 Emitted provide-data for energy with 0 items
[linha 1076] ✅ Fresh cache hit - hiding busy immediately
```

**Nenhum log de `fetchAndEnrich` foi gerado**, provando que o código retornou precocemente em `controller.js:1085`:

```javascript
if (cached.fresh) {
  setTimeout(() => hideGlobalBusy(), 100);
  return cached.data;  // ← RETORNOU SEM BUSCAR!
}
```

---

## 🛠️ Root Cause Identified

### Problema 1: `emitProvide()` é Chamado ANTES do Fetch Completar

**Localização:** `controller.js:1078` dentro de `hydrateDomain()`

```javascript
if (cached) {
  LogHelper.log(`[Orchestrator] 🎯 Cache hit for ${domain}, fresh: ${cached.fresh}`);
  emitProvide(domain, key, cached.data);  // ← 🐛 EMITE CACHE VAZIO!
  // ...
}
```

**Issue:** Se `cached.data = []`, isso emite 0 items mesmo quando o cache não é válido.

---

### Problema 2: `readCache()` Não Valida Se Cache Tem Dados

**Localização:** `controller.js:784-792`

```javascript
function readCache(key) {
  const entry = memCache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.hydratedAt;
  const fresh = age < entry.ttlMinutes * 60_000;

  return { ...entry, fresh };  // ← 🐛 NÃO VERIFICA SE entry.data.length > 0
}
```

**Issue:** `readCache()` marca como `fresh: true` mesmo quando `entry.data = []`.

---

### Problema 3: `writeCache()` Permite Salvar Cache Vazio

**Localização:** `controller.js:794-810`

```javascript
function writeCache(key, data) {
  if (memCache.has(key)) memCache.delete(key);

  memCache.set(key, {
    data,  // ← 🐛 PERMITE data = []
    hydratedAt: Date.now(),
    ttlMinutes: config.ttlMinutes
  });
  // ...
}
```

**Issue:** Não há validação para impedir cache de arrays vazios.

---

## ✅ Solução Proposta

### Fix 1: Invalidar Cache Vazio em `readCache()`

```javascript
function readCache(key) {
  const entry = memCache.get(key);
  if (!entry) return null;

  // ⭐ VALIDATE: Cache must have data
  if (!entry.data || entry.data.length === 0) {
    LogHelper.warn(`[Orchestrator] ⚠️ Cache for ${key} is empty, invalidating`);
    memCache.delete(key);
    return null;
  }

  const age = Date.now() - entry.hydratedAt;
  const fresh = age < entry.ttlMinutes * 60_000;

  return { ...entry, fresh };
}
```

---

### Fix 2: Não Salvar Cache Vazio em `writeCache()`

```javascript
function writeCache(key, data) {
  // ⭐ VALIDATE: Don't cache empty arrays
  if (!data || data.length === 0) {
    LogHelper.warn(`[Orchestrator] ⚠️ Skipping cache write for ${key} - empty data`);
    return;
  }

  if (memCache.has(key)) memCache.delete(key);

  memCache.set(key, {
    data,
    hydratedAt: Date.now(),
    ttlMinutes: config.ttlMinutes
  });

  // ...
}
```

---

### Fix 3: Validar em `emitProvide()` Antes de Emitir

```javascript
function emitProvide(domain, periodKey, items) {
  const now = Date.now();
  const key = `${domain}_${periodKey}`;

  // ⭐ VALIDATE: Don't emit empty data
  if (!items || items.length === 0) {
    LogHelper.warn(`[Orchestrator] ⚠️ Skipping emitProvide for ${domain} - no items to emit`);
    return;
  }

  // 1. PREVENT DUPLICATE EMISSIONS (< 100ms)
  if (OrchestratorState.lastEmission[key]) {
    const timeSinceLastEmit = now - OrchestratorState.lastEmission[key];
    if (timeSinceLastEmit < 100) {
      LogHelper.log(`[Orchestrator] ⏭️ Skipping duplicate emission for ${domain} (${timeSinceLastEmit}ms ago)`);
      return;
    }
  }

  // ... rest of the function
}
```

---

## 🧪 Validação da Solução

### Teste 1: Cache Vazio Deve Ser Invalidado

```javascript
// BEFORE FIX:
readCache('energy:2025-10-01:2025-10-17:day')
// → { data: [], fresh: true, hydratedAt: 1697561234567 }

// AFTER FIX:
readCache('energy:2025-10-01:2025-10-17:day')
// → null (cache invalidated)
```

---

### Teste 2: writeCache() Deve Rejeitar Arrays Vazios

```javascript
// BEFORE FIX:
writeCache('energy:2025-10-01:2025-10-17:day', [])
// → Cache saved with data = []

// AFTER FIX:
writeCache('energy:2025-10-01:2025-10-17:day', [])
// → ⚠️ Skipping cache write for energy - empty data
```

---

### Teste 3: emitProvide() Não Deve Emitir Arrays Vazios

```javascript
// BEFORE FIX:
emitProvide('energy', 'energy:2025-10-01:2025-10-17:day', [])
// → Event emitted with items = []

// AFTER FIX:
emitProvide('energy', 'energy:2025-10-01:2025-10-17:day', [])
// → ⚠️ Skipping emitProvide for energy - no items to emit
```

---

## 📝 Checklist de Implementação

- [ ] **Fix 1:** Adicionar validação de array vazio em `readCache()` (linha 784-792)
- [ ] **Fix 2:** Adicionar validação de array vazio em `writeCache()` (linha 794-810)
- [ ] **Fix 3:** Adicionar validação de array vazio em `emitProvide()` (linha 1166-1200)
- [ ] **Test 1:** Testar navegação energy → water → energy com validação de dados
- [ ] **Test 2:** Verificar logs para confirmar que cache vazio é invalidado
- [ ] **Test 3:** Testar com dados reais do cliente para garantir que fix funciona

---

## 🎯 Impacto do Bug

### Severidade: 🔴 CRITICAL

**Impacto no Usuário:**
- ❌ Dados zerados exibidos em widgets
- ❌ Perda de confiança no sistema
- ❌ Necessidade de refresh manual da página
- ❌ Experiência de usuário degradada

**Impacto Técnico:**
- ❌ Cache corrompido com dados vazios
- ❌ Race condition entre fetch e cache hit
- ❌ Sistema não se auto-recupera (requer refresh)

---

## 📊 Métricas de Sucesso Pós-Fix

- ✅ **0% de cache hits com arrays vazios**
- ✅ **100% de dados válidos servidos do cache**
- ✅ **0 ocorrências de "Emitted provide-data with 0 items" quando há dados disponíveis**
- ✅ **Cache invalidation automática para dados vazios**

---

## 🔗 Arquivos Relacionados

1. **`MAIN_VIEW/controller.js`** (linhas 784-1200)
   - `readCache()` - linha 784-792
   - `writeCache()` - linha 794-810
   - `hydrateDomain()` - linha 1046-1134
   - `emitProvide()` - linha 1166-1200

2. **Log de Evidência:**
   - `dashboard.myio-bas.com-1760753862283-CLEAN.log` (linhas 1064-1082)

---

**Próximo Passo:** Implementar os 3 fixes propostos e executar testes de validação.
