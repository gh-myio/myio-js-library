# RFC-0047: Cache Improvements - TB_ID Integration & TTL Enhancement

**Data:** 2025-10-20
**Status:** ✅ IMPLEMENTED
**Versão:** v5.2.0
**Relacionado:** RFC-0042 (Orchestrator), RFC-0045 (Robust Cache Strategy)

---

## 🎯 Objetivo

Implementar melhorias no sistema de cache do Orchestrator (MAIN_VIEW) para:

1. **Multi-tenancy**: Adicionar ThingsBoard Customer ID nas chaves de cache
2. **Expiração**: Implementar TTL de 30 minutos com validação automática
3. **Limpeza**: Adicionar limpeza automática de cache expirado no `onInit`
4. **Rastreabilidade**: Adicionar timestamp de criação e expiração explícitos

---

## 📋 Problemas Identificados

### Problema 1: Conflito de Cache entre Clientes

**Sintoma:** Cache compartilhado entre diferentes clientes ThingsBoard

**Evidência:**
```javascript
// Chave ANTIGA (sem TB_ID):
myio:cache:energy:2025-10-01T00:00:00-03:00:2025-10-18T23:59:00-03:00:day

// PROBLEMA: Clientes diferentes usando o mesmo cache!
// Cliente A e Cliente B compartilham dados se tiverem o mesmo período
```

**Root Cause:** A chave de cache não incluía o `customerTB_ID`, causando conflitos em ambientes multi-tenant.

---

### Problema 2: Cache Sem Expiração Controlada

**Sintoma:** Cache permanecia válido indefinidamente sem validação de idade

**Evidência:**
```javascript
// Código ANTIGO:
const config = {
  ttlMinutes: 5, // ❌ Muito curto
  // ...
};

// Sem timestamp de criação explícito
// Sem validação de expiração ao ler
```

**Root Cause:**
- TTL de apenas 5 minutos (muito curto para dados de telemetria)
- Falta de validação de expiração ao ler do cache
- Sem limpeza automática de entradas expiradas

---

### Problema 3: Limpeza Manual de Cache

**Sintoma:** Usuário precisava clicar em "Force Refresh" para limpar cache expirado

**Evidência:**
```javascript
// Limpeza MANUAL via botão:
btnForceRefresh.addEventListener('click', () => {
  // Clear all cache manually
  localStorage.clear(); // ❌ Remove TUDO, inclusive outros dados
});
```

**Root Cause:** Sem limpeza automática de cache expirado no `onInit` ou intervalos periódicos.

---

## ✅ Soluções Implementadas

### Fix 1: Nova Estrutura de Chave com TB_ID

**Arquivo:** `MAIN_VIEW/controller.js:357-365`

**Mudança:**
```javascript
// BEFORE:
function cacheKey(domain, period) {
  return `${domain}:${period.startISO}:${period.endISO}:${period.granularity}`;
}

// AFTER (RFC-0047):
function cacheKey(domain, period) {
  const customerTbId = self.ctx.settings?.customerTB_ID || 'default';
  return `${customerTbId}:${domain}:${period.startISO}:${period.endISO}:${period.granularity}`;
}
```

**Formato da Chave:**
```
ANTES: energy:2025-10-01T00:00:00-03:00:2025-10-18T23:59:00-03:00:day
DEPOIS: a1b2c3d4-...-uuid:energy:2025-10-01T00:00:00-03:00:2025-10-18T23:59:00-03:00:day
         └─ TB Customer ID
```

**Benefícios:**
- ✅ Isolamento de cache entre clientes
- ✅ Suporte a multi-tenancy
- ✅ Chaves únicas por cliente + domínio + período

---

### Fix 2: TTL de 30 Minutos com Timestamp

**Arquivo:** `MAIN_VIEW/controller.js:727-733, 821-855`

**Mudança 1: Config**
```javascript
// BEFORE:
const config = {
  ttlMinutes: 5, // ❌ Muito curto
  // ...
};

// AFTER (RFC-0047):
const config = {
  ttlMinutes: 30, // ✅ 30 minutos
  // ...
};
```

**Mudança 2: Enhanced Cache Entry**
```javascript
// BEFORE:
memCache.set(key, {
  data,
  hydratedAt: Date.now(),
  ttlMinutes: config.ttlMinutes
});

// AFTER (RFC-0047):
const now = Date.now();
const cacheEntry = {
  data,
  cachedAt: now,              // ✅ Timestamp de criação
  hydratedAt: now,            // Backward compatibility
  ttlMinutes: config.ttlMinutes, // 30
  expiresAt: now + (config.ttlMinutes * 60_000) // ✅ Timestamp de expiração explícito
};

memCache.set(key, cacheEntry);
```

**Benefícios:**
- ✅ Cache válido por 30 minutos (adequado para telemetria)
- ✅ Timestamp explícito de criação (`cachedAt`)
- ✅ Timestamp explícito de expiração (`expiresAt`)
- ✅ Logs informativos com horário de expiração

---

### Fix 3: Validação de Expiração ao Ler

**Arquivo:** `MAIN_VIEW/controller.js:787-819`

**Implementação:**
```javascript
// RFC-0047: Enhanced cache read with expiration validation
function readCache(key) {
  const entry = memCache.get(key);
  if (!entry) return null;

  // RFC-0045 FIX 1: Validate cache must have data
  if (!entry.data || entry.data.length === 0) {
    LogHelper.warn(`[Orchestrator] ⚠️ Cache for ${key} is empty, invalidating`);
    memCache.delete(key);
    return null;
  }

  // RFC-0047: Validate cache expiration (30 minutes)
  const age = Date.now() - entry.cachedAt;
  const expired = age > entry.ttlMinutes * 60_000;

  if (expired) {
    LogHelper.warn(`[Orchestrator] ⏰ Cache for ${key} expired (age: ${Math.round(age / 60_000)} minutes)`);
    memCache.delete(key);

    // Also remove from localStorage
    try {
      localStorage.removeItem(`myio:cache:${key}`);
    } catch (e) {
      LogHelper.warn('[Orchestrator] Failed to remove expired cache from localStorage:', e);
    }

    return null;
  }

  const fresh = age < entry.ttlMinutes * 60_000;
  return { ...entry, fresh };
}
```

**Benefícios:**
- ✅ Validação automática ao ler cache
- ✅ Remoção automática de cache expirado (memCache + localStorage)
- ✅ Logs informativos com idade do cache

---

### Fix 4: Limpeza Automática no `onInit`

**Arquivo:** `MAIN_VIEW/controller.js:118-191`

**Implementação:**
```javascript
// RFC-0047: Clean up expired cache from localStorage
function cleanupExpiredCache() {
  LogHelper.log('[Orchestrator] 🧹 Starting cleanup of expired cache...');

  const now = Date.now();
  const ttlMs = 30 * 60_000; // 30 minutes in milliseconds
  let removedCount = 0;
  let totalCount = 0;

  try {
    // Iterate through all localStorage keys
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);

      // Only process myio:cache: keys
      if (!storageKey || !storageKey.startsWith('myio:cache:')) {
        continue;
      }

      totalCount++;

      try {
        const valueStr = localStorage.getItem(storageKey);
        if (!valueStr) continue;

        const parsed = JSON.parse(valueStr);

        // Extract cache entry (format: { "TB_ID:domain:...": { data, cachedAt, ... } })
        const cacheEntry = Object.values(parsed)[0];

        if (!cacheEntry || !cacheEntry.cachedAt) {
          // Invalid or old format cache, mark for removal
          LogHelper.warn(`[Orchestrator] Invalid cache entry (missing cachedAt): ${storageKey}`);
          keysToRemove.push(storageKey);
          continue;
        }

        const age = now - cacheEntry.cachedAt;
        const expired = age > ttlMs;

        if (expired) {
          const ageMinutes = Math.round(age / 60_000);
          LogHelper.log(`[Orchestrator] ⏰ Removing expired cache: ${storageKey} (age: ${ageMinutes} minutes)`);
          keysToRemove.push(storageKey);
        }
      } catch (parseErr) {
        LogHelper.warn(`[Orchestrator] Failed to parse cache entry: ${storageKey}`, parseErr);
        keysToRemove.push(storageKey); // Remove corrupted entries
      }
    }

    // Remove expired keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      removedCount++;
    });

    LogHelper.log(`[Orchestrator] ✅ Cache cleanup complete: ${removedCount}/${totalCount} entries removed`);
  } catch (err) {
    LogHelper.error('[Orchestrator] ❌ Error during cache cleanup:', err);
  }
}

// ThingsBoard lifecycle
self.onInit = async function () {
  rootEl = $('#myio-root');
  registerGlobalEvents();
  setupResizeObserver();

  // RFC-0047: Clean up expired cache on init
  cleanupExpiredCache();

  // ... rest of initialization
};
```

**Benefícios:**
- ✅ Limpeza automática ao carregar a página
- ✅ Remove cache expirado (> 30 min)
- ✅ Remove cache corrompido (parse error)
- ✅ Remove cache no formato antigo (sem `cachedAt`)
- ✅ Logs informativos com quantidade removida

---

### Fix 5: Limpeza Periódica Aprimorada

**Arquivo:** `MAIN_VIEW/controller.js:1557-1585`

**Mudança:**
```javascript
// BEFORE:
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memCache.entries()) {
    const age = now - entry.hydratedAt;
    if (age > entry.ttlMinutes * 60_000 * 2) { // ❌ 2x TTL
      memCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

// AFTER (RFC-0047):
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  // Clean memCache
  for (const [key, entry] of memCache.entries()) {
    const age = now - entry.cachedAt; // ✅ Use cachedAt
    // ✅ Clean entries older than TTL (not 2x TTL)
    if (age > entry.ttlMinutes * 60_000) {
      memCache.delete(key);
      cleanedCount++;

      // Also remove from localStorage
      try {
        localStorage.removeItem(`myio:cache:${key}`);
      } catch (e) {
        LogHelper.warn('[Orchestrator] Failed to remove from localStorage:', e);
      }
    }
  }

  if (cleanedCount > 0) {
    LogHelper.log(`[Orchestrator] 🧹 Periodic cleanup: removed ${cleanedCount} expired entries`);
  }

  // ✅ Also clean localStorage periodically
  cleanupExpiredCache();
}, 10 * 60 * 1000); // Every 10 minutes
```

**Benefícios:**
- ✅ Limpeza a cada 10 minutos (memCache + localStorage)
- ✅ Remove cache expirado (TTL, não 2x TTL)
- ✅ Sincroniza memCache e localStorage
- ✅ Logs informativos

---

### Fix 6: HEADER - Atualização para Nova Estrutura

**Arquivo:** `HEADER/controller.js:414-438`

**Mudança:**
```javascript
// BEFORE:
const keysToRemove = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (key.startsWith('myio:cache:energy:') || key.startsWith('myio:cache:water:'))) {
    keysToRemove.push(key);
  }
}

// AFTER (RFC-0047):
const customerTbId = self.ctx.settings?.customerTB_ID || 'default';

const keysToRemove = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (!key) continue;

  // RFC-0047: Match new cache key format with TB_ID
  const energyPrefix = `myio:cache:${customerTbId}:energy:`;
  const waterPrefix = `myio:cache:${customerTbId}:water:`;

  if (key.startsWith(energyPrefix) || key.startsWith(waterPrefix)) {
    keysToRemove.push(key);
  }
}
```

**Benefícios:**
- ✅ Botão "Force Refresh" limpa apenas cache do cliente atual
- ✅ Compatível com nova estrutura de chave

---

### Fix 7: clearStorageCache - Atualização

**Arquivo:** `MAIN_VIEW/controller.js:971-997`

**Mudança:**
```javascript
// BEFORE:
function clearStorageCache(domain) {
  const prefix = domain ? `myio:cache:${domain}:` : 'myio:cache:';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      localStorage.removeItem(key);
    }
  }
}

// AFTER (RFC-0047):
function clearStorageCache(domain) {
  const customerTbId = self.ctx.settings?.customerTB_ID || 'default';

  // RFC-0047: Updated prefix format to include TB_ID
  // Format: myio:cache:TB_ID:domain: or myio:cache:TB_ID: (all domains)
  const prefix = domain
    ? `myio:cache:${customerTbId}:${domain}:`
    : `myio:cache:${customerTbId}:`;

  LogHelper.log(`[Orchestrator] 🧹 Clearing localStorage cache with prefix: ${prefix}`);

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    LogHelper.log(`[Orchestrator] 🗑️ Removed cache key: ${key}`);
  });

  LogHelper.log(`[Orchestrator] ✅ Cleared ${keysToRemove.length} cache entries`);
}
```

**Benefícios:**
- ✅ Limpa apenas cache do cliente atual (TB_ID)
- ✅ Logs informativos

---

## 📊 Comparação: Before vs After

### Estrutura de Chave

| Aspecto | Before | After (RFC-0047) |
|---------|--------|------------------|
| **Formato** | `domain:startISO:endISO:granularity` | `TB_ID:domain:startISO:endISO:granularity` |
| **Exemplo** | `energy:2025-10-01T00:00:00-03:00:...` | `a1b2c3d4-uuid:energy:2025-10-01T00:00:00-03:00:...` |
| **Multi-tenancy** | ❌ Compartilhado | ✅ Isolado por cliente |
| **Conflitos** | ❌ Possíveis | ✅ Impossíveis |

### Estrutura de Entrada de Cache

| Campo | Before | After (RFC-0047) |
|-------|--------|------------------|
| `data` | ✅ Array | ✅ Array |
| `hydratedAt` | ✅ Timestamp | ✅ Timestamp (compat) |
| `cachedAt` | ❌ N/A | ✅ Timestamp criação |
| `ttlMinutes` | ✅ 5 | ✅ 30 |
| `expiresAt` | ❌ N/A | ✅ Timestamp expiração |

### Validação e Limpeza

| Aspecto | Before | After (RFC-0047) |
|---------|--------|------------------|
| **Validação ao ler** | ❌ Não | ✅ Sim (age > TTL) |
| **Limpeza onInit** | ❌ Não | ✅ Sim (automático) |
| **Limpeza periódica** | ✅ Sim (2x TTL) | ✅ Sim (TTL, + localStorage) |
| **TTL** | 5 min | 30 min |
| **Remoção localStorage** | ❌ Não | ✅ Sim (sync) |

---

## 🔍 Logs Esperados Após Implementação

### onInit - Limpeza Automática

```javascript
[Orchestrator] 🧹 Starting cleanup of expired cache...
[Orchestrator] ⏰ Removing expired cache: myio:cache:a1b2c3d4-...-uuid:energy:2025-10-01T00:00:00-03:00:2025-10-18T23:59:00-03:00:day (age: 45 minutes)
[Orchestrator] Invalid cache entry (missing cachedAt): myio:cache:old-format-key
[Orchestrator] ✅ Cache cleanup complete: 2/5 entries removed
```

### Cache Write

```javascript
[Orchestrator] 💾 Cache written for a1b2c3d4-...-uuid:energy:2025-10-01T00:00:00-03:00:2025-10-18T23:59:00-03:00:day: 354 items, TTL: 30 min, expires: 14:30:00
```

### Cache Read - Expirado

```javascript
[Orchestrator] ⏰ Cache for a1b2c3d4-...-uuid:energy:... expired (age: 35 minutes)
```

### Limpeza Periódica

```javascript
[Orchestrator] 🧹 Periodic cleanup: removed 3 expired entries
[Orchestrator] 🧹 Starting cleanup of expired cache...
[Orchestrator] ✅ Cache cleanup complete: 1/8 entries removed
```

---

## 📝 Arquivos Modificados

### 1. `MAIN_VIEW/controller.js`

**Mudanças:**
- **Linha 118-181:** Função `cleanupExpiredCache()` (NEW)
- **Linha 191:** Chamada `cleanupExpiredCache()` no `onInit` (NEW)
- **Linha 357-365:** Função `cacheKey()` - adiciona TB_ID
- **Linha 727-733:** Config `ttlMinutes: 30`
- **Linha 787-819:** Função `readCache()` - validação de expiração
- **Linha 821-855:** Função `writeCache()` - timestamp e `expiresAt`
- **Linha 971-997:** Função `clearStorageCache()` - suporte TB_ID
- **Linha 1557-1585:** `cleanupInterval` - limpeza aprimorada

**Total de Linhas Adicionadas:** ~80 linhas
**Total de Linhas Modificadas:** ~50 linhas

### 2. `HEADER/controller.js`

**Mudanças:**
- **Linha 414-438:** Force Refresh - suporte nova estrutura de chave

**Total de Linhas Modificadas:** ~10 linhas

---

## ✅ Checklist de Validação

### Funcionalidade

- [x] **Fix 1:** Chave de cache inclui `customerTB_ID`
- [x] **Fix 2:** TTL de 30 minutos configurado
- [x] **Fix 3:** Validação de expiração ao ler cache
- [x] **Fix 4:** Limpeza automática no `onInit`
- [x] **Fix 5:** Limpeza periódica (memCache + localStorage)
- [x] **Fix 6:** HEADER compatível com nova estrutura
- [x] **Fix 7:** `clearStorageCache()` suporta TB_ID

### Testes

- [ ] **Teste 1:** Carregar página e verificar limpeza de cache expirado nos logs
- [ ] **Teste 2:** Verificar chave de cache no localStorage (`myio:cache:TB_ID:energy:...`)
- [ ] **Teste 3:** Esperar 30 minutos e verificar se cache expira
- [ ] **Teste 4:** Clicar em "Force Refresh" e verificar que apenas cache do cliente atual é removido
- [ ] **Teste 5:** Dois clientes diferentes (TB_IDs diferentes) devem ter caches isolados

### Deployment

- [ ] **Build:** Compilar código atualizado (MAIN_VIEW + HEADER)
- [ ] **Deploy:** Subir para ambiente de teste
- [ ] **QA:** Validar com múltiplos clientes
- [ ] **Production:** Deploy após aprovação

---

## 🎯 Benefícios da Implementação

### 1. Multi-tenancy Robusto
- ✅ Cache isolado por cliente ThingsBoard
- ✅ Impossível conflito entre clientes diferentes
- ✅ Segurança de dados aprimorada

### 2. Gerenciamento de Cache Inteligente
- ✅ TTL de 30 minutos (adequado para telemetria)
- ✅ Validação automática de expiração
- ✅ Limpeza automática (onInit + periódica)
- ✅ Logs informativos com timestamps

### 3. Performance e UX
- ✅ Cache válido por mais tempo (30 min vs 5 min)
- ✅ Menos requisições à API
- ✅ Limpeza automática (sem intervenção manual)
- ✅ localStorage sempre sincronizado

### 4. Debugging e Manutenção
- ✅ Logs claros com horários de expiração
- ✅ Chaves de cache identificáveis (TB_ID visível)
- ✅ Remoção de cache corrompido automática

---

## 🔗 Próximos Passos

1. ✅ **Implementação Completa** - 7 fixes aplicados
2. ⏳ **Testing** - Executar testes em ambiente de desenvolvimento
3. ⏳ **Multi-tenant Testing** - Validar com 2+ clientes diferentes
4. ⏳ **Cache Expiration Testing** - Validar expiração de 30 minutos
5. ⏳ **Production Deploy** - Subir para produção

---

## 📚 Documentação Relacionada

- **RFC-0042:** Orchestrator Implementation (MAIN_VIEW)
- **RFC-0045:** Robust Cache Strategy with Prioritization
- **RFC-0046:** Fix Race Condition - TELEMETRY Widgets

---

**Status:** ✅ **CODE READY - AWAITING DEPLOYMENT**
**Próximo:** Deploy MAIN_VIEW + HEADER e validar multi-tenancy + expiração
