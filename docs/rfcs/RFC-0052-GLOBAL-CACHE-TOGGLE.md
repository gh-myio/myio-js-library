# RFC-0052: Global Cache Enable/Disable Toggle

**Data:** 2025-10-22
**Status:** 🔴 URGENT - P0 (Critical)
**Versão:** v5.2.0
**Priority:** P0 (Production issues with cache)
**Relacionado:** RFC-0047 (Cache Improvements), RFC-0051 (Context Fixes)

---

## 🎯 Objetivo

**URGENTE:** Adicionar controle global para HABILITAR ou DESABILITAR completamente o sistema de cache no v5.2.0.

**Motivo:** Cache está causando problemas em produção e precisamos ter a opção de desabilitá-lo rapidamente sem modificar código.

---

## 📋 Problema Atual

### Evidências do Log (2025-10-22 18:35)

#### Problema #1: Dual Cache Key (default vs TB_ID)
```javascript
// PRIMEIRA chamada (FALHA):
[Orchestrator] hydrateDomain: {key: 'default:energy:...'}
[Orchestrator] ⚠️ Credentials timeout after 10s
[Orchestrator] fetchAndEnrich error: Credentials not available

// SEGUNDA chamada (SUCESSO):
[Orchestrator] hydrateDomain: {key: '20b93da0-9011-11f0-a06d-e9509531b1d5:energy:...'}
[Orchestrator] ✅ Fresh data fetched for energy in 1892ms
[Orchestrator] 💾 Cache written for 20b93da0-9011-11f0-a06d-e9509531b1d5:energy:...
```

**Root Cause:** O orchestrator está usando `default` na primeira chamada antes de `widgetSettings` ser populado.

#### Problema #2: Cache Desatualizado
- Water carregou com sucesso (linha 289)
- Voltando para Energy, usou CACHE em vez de buscar dados frescos (linha 380)
- Cache pode estar desatualizado ou corrompido

#### Problema #3: Impossível Desabilitar Cache
- Não há forma de desabilitar cache via settings
- Requer modificação de código para testar sem cache
- Dificulta troubleshooting em produção

---

## ✅ Solução: Toggle Global de Cache

### Mudança 1: Adicionar Setting `enableCache`

**Arquivo:** `MAIN_VIEW/settings.schema`

```json
{
  "schema": {
    "type": "object",
    "title": "MAIN_VIEW Orchestrator Settings",
    "properties": {
      "customerTB_ID": {
        "title": "Customer ThingsBoard ID",
        "type": "string",
        "description": "ID do customer no ThingsBoard"
      },

      "enableCache": {
        "title": "🔧 Enable Cache System",
        "type": "boolean",
        "default": true,
        "description": "⚠️ CRITICAL: Enable/disable cache system globally. Set to FALSE to always fetch fresh data from API (use for troubleshooting or real-time dashboards)."
      },

      "cacheTtlMinutes": {
        "title": "Cache TTL (minutes)",
        "type": "number",
        "default": 30,
        "description": "Time-to-live for cached data (only used if enableCache=true)"
      },

      "enableStaleWhileRevalidate": {
        "title": "Stale-While-Revalidate",
        "type": "boolean",
        "default": true,
        "description": "Serve stale data while refreshing (only used if enableCache=true)"
      },

      "maxCacheSize": {
        "title": "Max Cache Size",
        "type": "number",
        "default": 50,
        "description": "Maximum cache entries (only used if enableCache=true)"
      },

      "debugMode": {
        "title": "Debug Mode",
        "type": "boolean",
        "default": false,
        "description": "Enable console logging"
      }
    }
  },
  "form": [
    "customerTB_ID",
    {
      "type": "section",
      "title": "⚙️ Cache Configuration",
      "items": [
        {
          "key": "enableCache",
          "type": "checkbox",
          "titleMap": [
            {"value": true, "name": "✅ Cache Enabled (recommended for production)"},
            {"value": false, "name": "⚠️ Cache Disabled (always fetch fresh data)"}
          ]
        },
        "cacheTtlMinutes",
        "enableStaleWhileRevalidate",
        "maxCacheSize"
      ]
    },
    "debugMode"
  ]
}
```

**Benefícios:**
- ✅ Toggle visual claro (✅/⚠️)
- ✅ Default `true` = comportamento atual
- ✅ Seção separada para cache
- ✅ Avisos claros sobre impacto

---

### Mudança 2: Implementar Bypass de Cache

**Arquivo:** `MAIN_VIEW/controller.js`

#### 2.1. Adicionar `enableCache` ao `widgetSettings`

```javascript
// RFC-0051.1: Global widget settings (linha 34)
let widgetSettings = {
  customerTB_ID: 'default',
  enableCache: true,        // ← NEW
  cacheTtlMinutes: 30,
  enableStaleWhileRevalidate: true,
  maxCacheSize: 50,
  debugMode: false,
  domainsEnabled: { energy: true, water: true, temperature: true }
};
```

#### 2.2. Popular no `onInit`

```javascript
// RFC-0051.1: Populate global widget settings (linha ~200)
widgetSettings.customerTB_ID = self.ctx.settings?.customerTB_ID || 'default';
widgetSettings.enableCache = self.ctx.settings?.enableCache ?? true; // ← NEW
widgetSettings.cacheTtlMinutes = self.ctx.settings?.cacheTtlMinutes ?? 30;
// ...
```

#### 2.3. Adicionar ao `config`

```javascript
// RFC-0051.1: Read config from widgetSettings (linha ~831)
const config = {
  enableCache: widgetSettings.enableCache,  // ← NEW
  ttlMinutes: widgetSettings.cacheTtlMinutes,
  enableStaleWhileRevalidate: widgetSettings.enableStaleWhileRevalidate,
  maxCacheSize: widgetSettings.maxCacheSize,
  debugMode: widgetSettings.debugMode,
  domainsEnabled: widgetSettings.domainsEnabled
};

// Log warning if cache is disabled
if (!config.enableCache) {
  LogHelper.warn('[Orchestrator] ⚠️ CACHE DISABLED - All requests will fetch fresh data from API');
}
```

#### 2.4. Modificar `readCache()` para Bypass

**Linha:** ~870

```javascript
function readCache(key) {
  // RFC-0052: Do not read from cache if cache is disabled
  if (!config.enableCache) {
    LogHelper.log(`[Orchestrator] ⏭️ Cache disabled - skipping read for ${key}`);
    return null; // Always return null = cache miss
  }

  const entry = memCache.get(key);
  if (!entry) return null;

  // ... rest of validation
}
```

#### 2.5. Modificar `writeCache()` para Bypass

**Linha:** ~900

```javascript
function writeCache(key, data) {
  // RFC-0052: Do not write to cache if cache is disabled
  if (!config.enableCache) {
    LogHelper.log(`[Orchestrator] ⏭️ Cache disabled - skipping write for ${key}`);
    return;
  }

  if (!data || data.length === 0) {
    LogHelper.warn(`[Orchestrator] ⚠️ Cannot cache empty data for ${key}`);
    return;
  }

  // ... rest of write logic
}
```

#### 2.6. Modificar `hydrateDomain()` - Log de Status

**Linha:** ~1200

```javascript
async function hydrateDomain(domain) {
  // ... existing code ...

  // Log cache status
  if (config.enableCache) {
    LogHelper.log(`[Orchestrator] 🔍 Checking cache for ${domain}...`);
  } else {
    LogHelper.log(`[Orchestrator] 🔄 Cache disabled - fetching fresh data for ${domain}...`);
  }

  // ... rest of logic
}
```

#### 2.7. Modificar `cleanupExpiredCache()` para Skip

**Linha:** ~118

```javascript
function cleanupExpiredCache() {
  // RFC-0052: Skip cleanup if cache is disabled
  if (!widgetSettings.enableCache) {
    LogHelper.log('[Orchestrator] ⏭️ Cache disabled - skipping cleanup');
    return;
  }

  LogHelper.log('[Orchestrator] 🧹 Starting cleanup of expired cache...');
  // ... rest of cleanup
}
```

---

## 📊 Comparação: Before vs After

| Aspecto | Before (RFC-0047) | After (RFC-0052) |
|---------|-------------------|------------------|
| **Cache toggle** | ❌ Hardcoded `true` | ✅ Configurável via settings |
| **Desabilitar cache** | ❌ Requer modificação de código | ✅ Checkbox no settings |
| **Bypass completo** | ❌ Não | ✅ `readCache()` e `writeCache()` verificam flag |
| **Troubleshooting** | ❌ Difícil | ✅ Fácil (desabilitar cache temporariamente) |
| **Logs** | Parcial | ✅ Logs claros quando cache está desabilitado |

---

## 🔍 Logs Esperados

### Cache Habilitado (default)

```javascript
[Orchestrator] 📋 Widget settings captured: {
  customerTB_ID: '20b93da0-9011-11f0-a06d-e9509531b1d5',
  enableCache: true,
  cacheTtlMinutes: 30
}
[Orchestrator] 🔧 Config initialized: {enableCache: true, ttlMinutes: 30, ...}
[Orchestrator] 🔍 Checking cache for energy...
[Orchestrator] 🎯 Cache hit for energy, fresh: true
[Orchestrator] 💾 Cache written for energy:...: 354 items
```

### Cache Desabilitado

```javascript
[Orchestrator] 📋 Widget settings captured: {
  customerTB_ID: '20b93da0-9011-11f0-a06d-e9509531b1d5',
  enableCache: false,
  cacheTtlMinutes: 30
}
[Orchestrator] 🔧 Config initialized: {enableCache: false, ttlMinutes: 30, ...}
[Orchestrator] ⚠️ CACHE DISABLED - All requests will fetch fresh data from API
[Orchestrator] 🔄 Cache disabled - fetching fresh data for energy...
[Orchestrator] ⏭️ Cache disabled - skipping read for energy:...
[Orchestrator] ⏭️ Cache disabled - skipping write for energy:...
[Orchestrator] ⏭️ Cache disabled - skipping cleanup
[Orchestrator] Fetching from: https://api.data.apps.myio-bas.com/...
[Orchestrator] ✅ Fresh data fetched for energy in 1892ms
```

---

## 📝 Arquivos Modificados

### 1. `MAIN_VIEW/settings.schema`

**Mudanças:**
- **Linha 11-16:** Novo campo `enableCache` (boolean, default: true)
- **Linha 59-75:** Seção visual "Cache Configuration" com toggle

**Total:** +20 linhas

---

### 2. `MAIN_VIEW/controller.js`

**Mudanças:**
- **Linha 35:** Adicionar `enableCache: true` ao `widgetSettings`
- **Linha 201:** Popular `widgetSettings.enableCache` no `onInit`
- **Linha 831:** Adicionar `enableCache` ao `config`
- **Linha 834:** Log warning se cache está desabilitado
- **Linha 120:** Modificar `cleanupExpiredCache()` - skip se desabilitado
- **Linha 870:** Modificar `readCache()` - return null se desabilitado
- **Linha 900:** Modificar `writeCache()` - return se desabilitado
- **Linha 1200:** Adicionar logs de status em `hydrateDomain()`

**Total:** ~30 linhas adicionadas/modificadas

---

## ✅ Checklist de Implementação

### Fase 1: Settings Schema
- [ ] **1.1:** Adicionar campo `enableCache` no schema
- [ ] **1.2:** Criar seção visual "Cache Configuration"
- [ ] **1.3:** Adicionar titleMap com avisos (✅/⚠️)

### Fase 2: Controller
- [ ] **2.1:** Adicionar `enableCache` ao `widgetSettings` global
- [ ] **2.2:** Popular `enableCache` no `onInit`
- [ ] **2.3:** Adicionar `enableCache` ao `config`
- [ ] **2.4:** Log warning se cache desabilitado
- [ ] **2.5:** Modificar `readCache()` - bypass
- [ ] **2.6:** Modificar `writeCache()` - bypass
- [ ] **2.7:** Modificar `cleanupExpiredCache()` - skip
- [ ] **2.8:** Adicionar logs em `hydrateDomain()`

### Fase 3: Testing
- [ ] **3.1:** Testar com `enableCache: true` (default)
- [ ] **3.2:** Testar com `enableCache: false`
- [ ] **3.3:** Verificar logs mostram status correto
- [ ] **3.4:** Verificar que desabilitar cache SEMPRE busca dados frescos
- [ ] **3.5:** Verificar que nenhum dado é escrito em cache quando desabilitado

---

## 🧪 Plano de Testes

### Teste 1: Cache Habilitado (Baseline)
```
1. Configurar: enableCache = true
2. Recarregar dashboard
3. Clicar em Energy
4. Verificar logs: "💾 Cache written..."
5. Clicar em Water
6. Voltar para Energy
7. Verificar logs: "🎯 Cache hit..."
✅ ESPERADO: Segunda requisição usa cache
```

### Teste 2: Cache Desabilitado
```
1. Configurar: enableCache = false
2. Recarregar dashboard
3. Verificar log: "⚠️ CACHE DISABLED..."
4. Clicar em Energy
5. Verificar logs: "🔄 Cache disabled - fetching fresh data..."
6. Verificar logs: "⏭️ Cache disabled - skipping write..."
7. Clicar em Water
8. Voltar para Energy
9. Verificar logs: "🔄 Cache disabled - fetching fresh data..." (de novo!)
✅ ESPERADO: TODA requisição busca dados frescos (sem cache)
```

### Teste 3: Toggle em Produção
```
1. Dashboard em produção com problemas de cache
2. Abrir settings do widget MAIN_VIEW
3. Desmarcar "Enable Cache"
4. Salvar
5. Recarregar dashboard
6. Verificar que problema sumiu (dados sempre frescos)
7. Se resolver: cache era o problema
8. Se não resolver: problema é outro
✅ ESPERADO: Ferramenta de diagnóstico rápido
```

---

## 🎯 Benefícios da Implementação

### 1. Troubleshooting Rápido
- ✅ Desabilitar cache com 1 click (sem modificar código)
- ✅ Diagnóstico imediato: cache é o problema?
- ✅ Testes A/B: com cache vs sem cache

### 2. Flexibilidade
- ✅ Dashboards de tempo real: cache OFF
- ✅ Dashboards analíticos: cache ON
- ✅ Configurável por cliente/dashboard

### 3. Segurança
- ✅ Fallback imediato se cache causar problemas
- ✅ Sem necessidade de deploy para desabilitar cache
- ✅ Revert instantâneo (checkbox)

### 4. Performance Testing
- ✅ Medir impacto real do cache
- ✅ Comparar tempo de carregamento com/sem cache
- ✅ Decidir baseado em dados

---

## 🔗 Próximos Passos

### Urgente (Hoje)
1. ⏳ Implementar RFC-0052 (enableCache toggle)
2. ⏳ Testar em ambiente local
3. ⏳ Deploy para produção

### Seguir (Amanhã)
4. ⏳ Corrigir problema `default` vs `customerTB_ID` (linha 104)
5. ⏳ Corrigir stub do orchestrator não sendo criado (linha 7)
6. ⏳ Revisar RFC-0051 e corrigir implementação do stub

---

## 📚 Documentação Relacionada

- **RFC-0042:** Orchestrator Implementation
- **RFC-0045:** Robust Cache Strategy
- **RFC-0047:** Cache Improvements - TB_ID Integration
- **RFC-0051:** Fix Orchestrator Context + Race Condition

---

## 🔥 Impact Assessment

### Severidade
- **Priority:** 🔴 P0 (Critical)
- **Urgency:** ASAP (problemas em produção)
- **Risk:** Very Low (apenas adiciona toggle, não muda lógica existente)

### Usuários Afetados
- **Com cache habilitado:** 0% (comportamento atual)
- **Com cache desabilitado:** Dados sempre frescos (pode aumentar carga da API)

### Deploy Strategy
1. **Implementar** toggle sem mudar default (`true`)
2. **Testar** em produção com toggle OFF em 1 cliente
3. **Validar** que resolve problemas de cache
4. **Documentar** quando usar ON vs OFF

---

**Status:** 🔴 **URGENT - READY FOR IMPLEMENTATION**
**Próximo:** Implementar toggle no settings.schema + controller.js
**ETA:** 1-2 horas (implementação + testing)
**Deploy:** ASAP após validação
