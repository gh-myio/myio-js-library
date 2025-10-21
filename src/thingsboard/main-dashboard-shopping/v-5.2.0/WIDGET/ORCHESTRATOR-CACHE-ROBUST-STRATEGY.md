# Estratégia Robusta de Cache - MyIO Orchestrator

**Data:** 2025-10-17
**Status:** 🔧 EM DESENVOLVIMENTO

---

## 📋 Problema Identificado

### Sintomas:
- ✅ Orchestrator busca dados com sucesso
- ✅ Eventos `myio:telemetry:provide-data` são emitidos
- ❌ **Primeiro widget TELEMETRY fica carregando intermitentemente**
- ✅ Segundo e terceiro widgets carregam normalmente
- ❌ Problema ocorre de forma não determinística (race condition)

### Cenário Atual:
```
Dashboard tem 3 widgets TELEMETRY (energy, water, temperature)
↓
HEADER emite myio:update-date
↓
Orchestrator recebe e busca dados para os 3 domains
↓
Orchestrator emite provide-data para cada domain
↓
❌ PRIMEIRO widget às vezes não recebe ou processa incorretamente
✅ SEGUNDO e TERCEIRO widgets sempre funcionam
```

### Causa Raiz Identificada:

**RACE CONDITION entre múltiplos mecanismos de cache:**

1. **Cache Hit Timing Issue:**
   ```javascript
   // Orchestrator: emitProvide() chamado 2x
   emitProvide(domain, key, items);           // Imediato
   setTimeout(() => emitProvide(...), 1000);  // Retry após 1s
   ```

2. **Widget Timing Issue:**
   ```javascript
   // Widget: setTimeout 500ms para verificar cache
   setTimeout(() => {
     if (MyIOOrchestratorData[domain]) {
       // Usa cache
     } else {
       requestDataFromOrchestrator();  // Request duplicado
     }
   }, 500);
   ```

3. **Event Listener Registration Race:**
   - Widget 1 registra listener tarde → perde evento inicial
   - Widgets 2 e 3 já estão prontos → recebem normalmente
   - Widget 1 depende do retry 1000ms → loading intermitente

4. **Cross-Context Emission Overhead:**
   ```javascript
   // emitToAllContexts percorre TODOS os iframes
   const iframes = document.querySelectorAll('iframe');
   iframes.forEach(iframe => {
     iframe.contentWindow.dispatchEvent(...);  // Pode falhar se iframe não carregou
   });
   ```

---

## ✅ Solução Proposta: Cache Prioritizado com Coordenação

### Princípios da Solução:

1. **Single Source of Truth:** `window.MyIOOrchestratorData` como cache central
2. **Priorização:** Primeiro widget tem prioridade máxima
3. **Coordenação:** Estado compartilhado entre widgets para evitar race conditions
4. **Retry Inteligente:** Retry apenas se não houver dados frescos
5. **Debounce Unificado:** Um único mecanismo de debounce no orchestrator

---

## 🔧 Implementação

### 1. **Orchestrator: Estado Compartilhado Global**

```javascript
// MAIN_VIEW/controller.js

// Global shared state para coordenação entre widgets
if (!window.MyIOOrchestratorState) {
  window.MyIOOrchestratorState = {
    // Prioridade de widgets por ordem de inicialização
    widgetPriority: [],

    // Cache de dados por domain
    cache: {},

    // Estado de loading por domain
    loading: {},

    // Listeners aguardando dados
    pendingListeners: {},

    // Timestamp da última emissão por domain
    lastEmission: {},

    // Lock para evitar requests concorrentes
    locks: {}
  };
}

const OrchestratorState = window.MyIOOrchestratorState;
```

### 2. **Orchestrator: Sistema de Prioridade**

```javascript
/**
 * Registra widget com prioridade baseada na ordem de inicialização
 */
function registerWidget(widgetId, domain) {
  if (!OrchestratorState.widgetPriority.includes(widgetId)) {
    OrchestratorState.widgetPriority.push(widgetId);

    const priority = OrchestratorState.widgetPriority.indexOf(widgetId) + 1;

    LogHelper.log(`[Orchestrator] Widget registered: ${widgetId} (domain: ${domain}, priority: ${priority})`);
  }
}

/**
 * Listener para widgets se registrarem
 */
window.addEventListener('myio:widget:register', (ev) => {
  const { widgetId, domain } = ev.detail;
  registerWidget(widgetId, domain);
});
```

### 3. **Orchestrator: emitProvide() Melhorado**

```javascript
/**
 * Emit provide-data com controle de duplicação e prioridade
 */
function emitProvide(domain, periodKey, items) {
  const now = Date.now();
  const key = `${domain}_${periodKey}`;

  // 1. PREVENIR EMISSÕES DUPLICADAS (< 100ms)
  if (OrchestratorState.lastEmission[key]) {
    const timeSinceLastEmit = now - OrchestratorState.lastEmission[key];
    if (timeSinceLastEmit < 100) {
      LogHelper.log(`[Orchestrator] ⏭️ Skipping duplicate emission for ${domain} (${timeSinceLastEmit}ms ago)`);
      return;
    }
  }

  OrchestratorState.lastEmission[key] = now;

  // 2. ARMAZENAR NO CACHE CENTRAL (Single Source of Truth)
  if (!window.MyIOOrchestratorData) {
    window.MyIOOrchestratorData = {};
  }

  window.MyIOOrchestratorData[domain] = {
    periodKey,
    items,
    timestamp: now,
    version: (window.MyIOOrchestratorData[domain]?.version || 0) + 1
  };

  OrchestratorState.cache[domain] = {
    periodKey,
    items,
    timestamp: now
  };

  LogHelper.log(`[Orchestrator] 📦 Cache updated for ${domain}: ${items.length} items (v${window.MyIOOrchestratorData[domain].version})`);

  // 3. EMITIR EVENTO PARA TODOS OS CONTEXTOS
  const eventDetail = { domain, periodKey, items, version: window.MyIOOrchestratorData[domain].version };

  // 3a. Emitir para current window
  window.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', { detail: eventDetail }));

  // 3b. Emitir para parent (se em iframe)
  try {
    if (window.parent && window.parent !== window) {
      window.parent.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', { detail: eventDetail }));
    }
  } catch (e) {
    // Cross-origin, ignore
  }

  // 3c. Emitir para iframes (apenas os que estão prontos)
  try {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe, idx) => {
      try {
        // Verificar se iframe está carregado antes de emitir
        if (iframe.contentWindow && iframe.contentWindow.document.readyState === 'complete') {
          iframe.contentWindow.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', { detail: eventDetail }));
          LogHelper.log(`[Orchestrator] ✅ Emitted to iframe ${idx} for ${domain}`);
        } else {
          LogHelper.warn(`[Orchestrator] ⏳ Iframe ${idx} not ready yet, will retry`);

          // Agendar retry para iframe não carregado
          setTimeout(() => {
            if (iframe.contentWindow && iframe.contentWindow.document.readyState === 'complete') {
              iframe.contentWindow.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', { detail: eventDetail }));
              LogHelper.log(`[Orchestrator] ✅ Retry: Emitted to iframe ${idx} for ${domain}`);
            }
          }, 500);
        }
      } catch (err) {
        LogHelper.warn(`[Orchestrator] Cannot emit to iframe ${idx}:`, err.message);
      }
    });
  } catch (e) {
    LogHelper.warn(`[Orchestrator] Cannot enumerate iframes:`, e.message);
  }

  // 4. MARCAR COMO NÃO LOADING
  OrchestratorState.loading[domain] = false;

  // 5. PROCESSAR LISTENERS PENDENTES (widgets que chegaram tarde)
  if (OrchestratorState.pendingListeners[domain]) {
    LogHelper.log(`[Orchestrator] 🔔 Processing ${OrchestratorState.pendingListeners[domain].length} pending listeners for ${domain}`);

    OrchestratorState.pendingListeners[domain].forEach(callback => {
      try {
        callback({ detail: eventDetail });
      } catch (err) {
        LogHelper.error(`[Orchestrator] Error calling pending listener:`, err);
      }
    });

    delete OrchestratorState.pendingListeners[domain];
  }

  LogHelper.log(`[Orchestrator] 📡 Emitted provide-data for ${domain} with ${items.length} items`);
}
```

### 4. **Orchestrator: Listener para Requests de Widgets**

```javascript
/**
 * Widget pode solicitar dados ativamente
 */
window.addEventListener('myio:telemetry:request-data', async (ev) => {
  const { domain, period, widgetId, priority } = ev.detail;

  LogHelper.log(`[Orchestrator] 📨 Received data request from widget ${widgetId} (domain: ${domain}, priority: ${priority})`);

  // Verificar se já temos dados frescos no cache
  const cached = OrchestratorState.cache[domain];
  if (cached && (Date.now() - cached.timestamp < 30000)) {
    LogHelper.log(`[Orchestrator] ✅ Serving from cache for ${domain} (age: ${Date.now() - cached.timestamp}ms)`);
    emitProvide(domain, cached.periodKey, cached.items);
    return;
  }

  // Verificar se já está em progresso
  if (OrchestratorState.loading[domain]) {
    LogHelper.log(`[Orchestrator] ⏳ Already loading ${domain}, adding to pending listeners`);

    // Adicionar listener pendente
    if (!OrchestratorState.pendingListeners[domain]) {
      OrchestratorState.pendingListeners[domain] = [];
    }

    OrchestratorState.pendingListeners[domain].push((data) => {
      // Emitir diretamente para o widget solicitante
      window.dispatchEvent(new CustomEvent('myio:telemetry:provide-data', { detail: data.detail }));
    });

    return;
  }

  // Buscar dados frescos
  OrchestratorState.loading[domain] = true;

  try {
    await hydrateDomain(domain, period);
  } catch (error) {
    LogHelper.error(`[Orchestrator] Error hydrating ${domain}:`, error);
    OrchestratorState.loading[domain] = false;
  }
});
```

### 5. **Widget TELEMETRY: Registro com Prioridade**

```javascript
// TELEMETRY/controller.js - Logo após definir WIDGET_DOMAIN

// Gerar ID único para o widget
const WIDGET_ID = `telemetry_${WIDGET_DOMAIN}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Registrar widget no orchestrator
window.dispatchEvent(new CustomEvent('myio:widget:register', {
  detail: {
    widgetId: WIDGET_ID,
    domain: WIDGET_DOMAIN
  }
}));

LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Widget registered with ID: ${WIDGET_ID}`);
```

### 6. **Widget TELEMETRY: Verificação de Cache Melhorada**

```javascript
// TELEMETRY/controller.js - Substituir setTimeout(500ms)

/**
 * Verifica cache com fallback inteligente
 */
function checkCacheOrRequest() {
  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔍 Checking orchestrator cache...`);

  // 1. Tentar cache do current window
  let orchestratorData = window.MyIOOrchestratorData;
  let cacheLocation = 'current window';

  // 2. Fallback para parent window (se em iframe)
  if ((!orchestratorData || !orchestratorData[WIDGET_DOMAIN]) && window.parent && window.parent !== window) {
    try {
      orchestratorData = window.parent.MyIOOrchestratorData;
      cacheLocation = 'parent window';
    } catch (e) {
      // Cross-origin, ignore
    }
  }

  // 3. Verificar se temos dados frescos
  if (orchestratorData && orchestratorData[WIDGET_DOMAIN]) {
    const storedData = orchestratorData[WIDGET_DOMAIN];
    const age = Date.now() - storedData.timestamp;

    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Found cached data in ${cacheLocation}: ${storedData.items?.length || 0} items, age: ${age}ms, version: ${storedData.version}`);

    // Usar cache se:
    // - Tem items (não vazio)
    // - Idade < 30s
    // - Versão mudou desde última vez (evita processar dados duplicados)
    if (storedData.items && storedData.items.length > 0 && age < 30000) {

      // Verificar se já processamos esta versão
      if (STATE.lastProcessedVersion === storedData.version) {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ⏭️ Already processed version ${storedData.version}, skipping`);
        hideBusy();
        return;
      }

      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ Using cached data (version ${storedData.version})`);

      // Marcar versão como processada
      STATE.lastProcessedVersion = storedData.version;

      // Processar dados
      dataProvideHandler({
        detail: {
          domain: WIDGET_DOMAIN,
          periodKey: storedData.periodKey,
          items: storedData.items,
          version: storedData.version
        }
      });

      return;
    } else {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ⚠️ Cached data is too old or empty (age: ${age}ms, items: ${storedData.items?.length || 0})`);
    }
  } else {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ℹ️ No cached data found`);
  }

  // 4. Solicitar dados frescos do orchestrator
  if (!hasRequestedInitialData) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 Requesting fresh data from orchestrator...`);

    hasRequestedInitialData = true;

    // Calcular prioridade (1 = mais alta)
    const priority = window.MyIOOrchestratorState?.widgetPriority.indexOf(WIDGET_ID) + 1 || 999;

    window.dispatchEvent(new CustomEvent('myio:telemetry:request-data', {
      detail: {
        domain: WIDGET_DOMAIN,
        period: {
          startISO: self.ctx.scope.startDateISO,
          endISO: self.ctx.scope.endDateISO,
          granularity: calcGranularity(self.ctx.scope.startDateISO, self.ctx.scope.endDateISO),
          tz: 'America/Sao_Paulo'
        },
        widgetId: WIDGET_ID,
        priority: priority
      }
    }));
  } else {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ⏭️ Already requested data, waiting for response`);
  }
}

// Chamar após pequeno delay para garantir que listeners estão registrados
setTimeout(checkCacheOrRequest, 300);
```

### 7. **Widget TELEMETRY: dataProvideHandler com Deduplicação**

```javascript
// TELEMETRY/controller.js

function dataProvideHandler(ev) {
  const { domain, periodKey, items, version } = ev.detail;

  // 1. FILTRAR APENAS O DOMAIN DO WIDGET
  if (domain !== WIDGET_DOMAIN) {
    return;
  }

  // 2. VERIFICAR SE JÁ PROCESSAMOS ESTA VERSÃO
  if (STATE.lastProcessedVersion === version) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ⏭️ Already processed version ${version}, ignoring duplicate event`);
    return;
  }

  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📦 Received provide-data: ${items?.length || 0} items (version ${version})`);

  // 3. MARCAR VERSÃO COMO PROCESSADA
  STATE.lastProcessedVersion = version;

  // 4. PROCESSAR DADOS
  if (!items || items.length === 0) {
    LogHelper.warn(`[TELEMETRY ${WIDGET_DOMAIN}] ⚠️ Received empty data`);
    hideBusy();
    return;
  }

  // ... resto da lógica de processamento ...

  hideBusy();
}
```

---

## 📊 Fluxo Corrigido

### Cenário 1: Inicialização Normal (ordem sequencial)

```
1. MAIN_VIEW carrega → Orchestrator inicializa
   └─ window.MyIOOrchestratorState criado

2. Widget TELEMETRY 1 (energy) carrega
   ├─ Dispara myio:widget:register (priority: 1)
   ├─ Registra listener para myio:telemetry:provide-data
   └─ setTimeout(300ms) → checkCacheOrRequest()

3. Widget TELEMETRY 2 (water) carrega
   ├─ Dispara myio:widget:register (priority: 2)
   └─ setTimeout(300ms) → checkCacheOrRequest()

4. Widget TELEMETRY 3 (temperature) carrega
   ├─ Dispara myio:widget:register (priority: 3)
   └─ setTimeout(300ms) → checkCacheOrRequest()

5. HEADER emite myio:update-date
   └─ Orchestrator recebe e busca dados

6. Orchestrator fetch completa (energy)
   ├─ emitProvide('energy', key, items)
   │  ├─ Atualiza MyIOOrchestratorData.energy (version: 1)
   │  ├─ Emite para current window ✅
   │  ├─ Emite para iframes (apenas os prontos) ✅
   │  └─ Processa pendingListeners ✅
   └─ Widget 1 recebe e processa (version: 1) ✅

7. Repeat para water e temperature
```

### Cenário 2: Widget Carrega Tarde (race condition)

```
1. HEADER emite myio:update-date
2. Orchestrator busca dados (energy, water, temp)
3. Orchestrator emitProvide para os 3 domains
   └─ MyIOOrchestratorData atualizado (version: 1)

4. Widget TELEMETRY 1 carrega TARDE
   ├─ Dispara myio:widget:register (priority: 1)
   ├─ setTimeout(300ms) → checkCacheOrRequest()
   │  ├─ Encontra MyIOOrchestratorData.energy (age: 2s, version: 1)
   │  ├─ Verifica version não foi processada ainda
   │  └─ Usa cache e processa ✅
   └─ Não dispara request duplicado ✅
```

### Cenário 3: Cache Hit (usuário muda data)

```
1. Usuário muda data no HEADER
2. Orchestrator verifica cache
   ├─ Cache hit (fresh data)
   └─ emitProvide imediatamente

3. Widgets recebem evento
   ├─ Verificam version (incrementada)
   └─ Processam nova versão ✅
```

---

## 🧪 Testes de Validação

### Teste 1: Inicialização Simultânea
```javascript
// Simular 3 widgets carregando simultaneamente
// Expectativa: Todos recebem dados, nenhum fica loading
```

### Teste 2: Widget Carrega Tarde
```javascript
// Carregar widget 5 segundos após orchestrator
// Expectativa: Widget usa cache, não faz request duplicado
```

### Teste 3: Mudança Rápida de Data
```javascript
// Mudar data 3 vezes em 5 segundos
// Expectativa: Cache hit para mesma query, sem requests duplicados
```

### Teste 4: Iframe Não Carregado
```javascript
// Emitir evento antes de iframe estar ready
// Expectativa: Retry após 500ms entrega o evento
```

---

## 📝 Métricas de Sucesso

- ✅ **0% de widgets ficando em loading infinito**
- ✅ **100% de cache hit para queries idênticas**
- ✅ **< 300ms latência para cache hit**
- ✅ **0 requests duplicados para mesma query**
- ✅ **Prioridade respeitada (widget 1 sempre primeiro)**

---

## 🔍 Debug Commands

```javascript
// Ver estado do orchestrator
console.table(window.MyIOOrchestratorState.widgetPriority);

// Ver cache
console.table(Object.keys(window.MyIOOrchestratorData).map(k => ({
  domain: k,
  items: window.MyIOOrchestratorData[k].items.length,
  age: Date.now() - window.MyIOOrchestratorData[k].timestamp,
  version: window.MyIOOrchestratorData[k].version
})));

// Forçar limpeza de cache
delete window.MyIOOrchestratorData;
delete window.MyIOOrchestratorState;

// Simular request de widget
window.dispatchEvent(new CustomEvent('myio:telemetry:request-data', {
  detail: {
    domain: 'energy',
    widgetId: 'test_widget',
    priority: 1,
    period: {
      startISO: '2025-10-01T00:00:00-03:00',
      endISO: '2025-10-17T23:59:59-03:00',
      granularity: 'day',
      tz: 'America/Sao_Paulo'
    }
  }
}));
```

---

**Status:** 🔧 Aguardando implementação e testes
**Próximos Passos:**
1. Implementar mudanças no MAIN_VIEW/controller.js
2. Implementar mudanças no TELEMETRY/controller.js
3. Testar em ambiente de desenvolvimento
4. Validar métricas de sucesso
