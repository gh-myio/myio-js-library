# Guia de Testes - Orchestrator RFC-0045

**Data:** 2025-10-17
**Versão:** v5.2.0
**Objetivo:** Validar melhorias implementadas no sistema de cache do orchestrator

---

## 🎯 Testes Obrigatórios

### ✅ Teste 1: Inicialização Normal (3 Widgets Simultâneos)

**Objetivo:** Verificar que todos os widgets recebem dados sem loading infinito.

**Passos:**

1. Abrir dashboard com 3 widgets TELEMETRY (energy, water, temperature)
2. Observar console do browser (F12)
3. Aguardar carregamento completo

**Resultado Esperado:**

```
[Orchestrator] 🌍 Global state initialized
[Orchestrator] 📝 Widget registered: telemetry_energy_xxx (priority: 1)
[Orchestrator] 📝 Widget registered: telemetry_water_xxx (priority: 2)
[Orchestrator] 📝 Widget registered: telemetry_temperature_xxx (priority: 3)
[Orchestrator] 📨 Received data request from widget telemetry_energy_xxx
[Orchestrator] 📨 Received data request from widget telemetry_water_xxx
[Orchestrator] ⏳ Already loading energy, adding to pending listeners
[Orchestrator] 📡 Emitted provide-data for energy with X items
[Orchestrator] 🔔 Processing 1 pending listeners for energy
✅ Todos os 3 widgets exibem dados corretamente
```

**Métricas:**
- ⏱️ Tempo de carregamento: < 2s
- ✅ Nenhum widget fica em loading infinito
- ✅ Nenhum request duplicado para mesma query

---

### ✅ Teste 2: Widget Carrega Tarde (Race Condition)

**Objetivo:** Verificar que widget carregado tarde recebe dados do cache.

**Passos:**

1. Abrir dashboard com 2 widgets TELEMETRY
2. Aguardar carregamento completo (2s)
3. Adicionar 3º widget TELEMETRY dinamicamente

**Comando de teste (console):**

```javascript
// Simular widget chegando tarde
setTimeout(() => {
  window.dispatchEvent(new CustomEvent('myio:telemetry:request-data', {
    detail: {
      domain: 'energy',
      widgetId: 'late_widget_test',
      priority: 999,
      period: {
        startISO: '2025-10-01T00:00:00-03:00',
        endISO: '2025-10-17T23:59:59-03:00',
        granularity: 'day',
        tz: 'America/Sao_Paulo'
      }
    }
  }));
}, 5000); // 5s depois
```

**Resultado Esperado:**

```
[Orchestrator] 📨 Received data request from widget late_widget_test
[Orchestrator] ✅ Serving from cache for energy (age: 5234ms)
[Orchestrator] 📡 Emitted provide-data for energy with X items
✅ Widget recebe dados imediatamente do cache (< 100ms)
```

**Métricas:**
- ⏱️ Latência: < 100ms (cache hit)
- ✅ Sem request à API
- ✅ Widget exibe dados corretamente

---

### ✅ Teste 3: Mudança Rápida de Data (3x em 5s)

**Objetivo:** Verificar deduplicação de requests e cache hit.

**Passos:**

1. Abrir dashboard com 3 widgets TELEMETRY
2. Mudar data 3 vezes rapidamente no HEADER:
   - Outubro 2025 → Setembro 2025 (0s)
   - Setembro 2025 → Agosto 2025 (2s)
   - Agosto 2025 → Outubro 2025 (4s)

**Resultado Esperado:**

```
[Orchestrator] 📅 Received myio:update-date (Oct 2025)
[Orchestrator] hydrateDomain called for energy
[Orchestrator] ✅ Fresh data fetched for energy in 1234ms

[Orchestrator] 📅 Received myio:update-date (Sep 2025)
[Orchestrator] hydrateDomain called for energy
[Orchestrator] ✅ Fresh data fetched for energy in 987ms

[Orchestrator] 📅 Received myio:update-date (Aug 2025)
[Orchestrator] hydrateDomain called for energy
[Orchestrator] ✅ Fresh data fetched for energy in 1056ms

[Orchestrator] 📅 Received myio:update-date (Oct 2025)
[Orchestrator] hydrateDomain called for energy
[Orchestrator] 🎯 Cache hit for energy, fresh: true
✅ Cache hit para Outubro (já buscado anteriormente)
```

**Métricas:**
- ✅ Cache hit para query repetida (Outubro)
- ✅ Nenhum loading infinito
- ⏱️ Cache hit: < 300ms

---

### ✅ Teste 4: Iframe Carregando Tarde

**Objetivo:** Verificar retry para iframes não carregados.

**Passos:**

1. Abrir dashboard com widgets TELEMETRY em iframes
2. Simular iframe lento (throttle 3G no DevTools)
3. Observar logs de retry

**Resultado Esperado:**

```
[Orchestrator] 📡 Emitted provide-data for energy
[Orchestrator] ✅ Emitted to iframe 0 for energy
[Orchestrator] ⏳ Iframe 1 not ready yet, will retry
[Orchestrator] ✅ Emitted to iframe 2 for energy

// 500ms depois
[Orchestrator] ✅ Retry: Emitted to iframe 1 for energy
✅ Iframe 1 recebe dados após retry
```

**Métricas:**
- ✅ Iframes não prontos recebem retry após 500ms
- ✅ Todos os iframes recebem dados eventualmente

---

### ✅ Teste 5: Emissões Duplicadas (Deduplicação)

**Objetivo:** Verificar que emissões duplicadas são bloqueadas.

**Comando de teste (console):**

```javascript
// Disparar 5 emissões rápidas (simular bug antigo)
for (let i = 0; i < 5; i++) {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('myio:telemetry:request-data', {
      detail: {
        domain: 'energy',
        widgetId: `test_widget_${i}`,
        priority: i + 1,
        period: {
          startISO: '2025-10-01T00:00:00-03:00',
          endISO: '2025-10-17T23:59:59-03:00',
          granularity: 'day',
          tz: 'America/Sao_Paulo'
        }
      }
    }));
  }, i * 10); // 0ms, 10ms, 20ms, 30ms, 40ms
}
```

**Resultado Esperado:**

```
[Orchestrator] 📨 Received data request from widget test_widget_0
[Orchestrator] hydrateDomain called for energy

[Orchestrator] 📨 Received data request from widget test_widget_1
[Orchestrator] ⏳ Already loading energy, adding to pending listeners

[Orchestrator] 📨 Received data request from widget test_widget_2
[Orchestrator] ⏳ Already loading energy, adding to pending listeners

// ... (3, 4 também vão para pending listeners)

[Orchestrator] 📡 Emitted provide-data for energy
[Orchestrator] 🔔 Processing 4 pending listeners for energy
✅ Apenas 1 request à API, 4 widgets aguardam via pending listeners
```

**Métricas:**
- ✅ Apenas 1 request à API (não 5)
- ✅ Todos os 5 widgets recebem dados
- ✅ Pending listeners processados corretamente

---

## 🔍 Comandos de Debug para Testes

### Ver Estado Completo do Orchestrator

```javascript
console.log('=== Orchestrator State ===');
console.log('Widgets registrados:', window.MyIOOrchestratorState.widgetPriority.length);
console.log('Registry:', window.MyIOOrchestratorState.widgetRegistry);
console.log('Cache:', window.MyIOOrchestratorState.cache);
console.log('Loading:', window.MyIOOrchestratorState.loading);
console.log('Pending listeners:', window.MyIOOrchestratorState.pendingListeners);
console.log('Last emission:', window.MyIOOrchestratorState.lastEmission);
```

### Ver Cache Global

```javascript
console.table(Object.keys(window.MyIOOrchestratorData || {}).map(k => ({
  domain: k,
  items: window.MyIOOrchestratorData[k].items.length,
  age_ms: Date.now() - window.MyIOOrchestratorData[k].timestamp,
  version: window.MyIOOrchestratorData[k].version,
  periodKey: window.MyIOOrchestratorData[k].periodKey
})));
```

### Ver Widgets Registrados

```javascript
console.table(Array.from(window.MyIOOrchestratorState.widgetRegistry.entries()).map(([id, data]) => ({
  widgetId: id,
  domain: data.domain,
  priority: data.priority,
  registeredAt: new Date(data.registeredAt).toLocaleTimeString()
})));
```

### Limpar Cache (Reset para Testes)

```javascript
// CUIDADO: Isso vai limpar todo o cache!
delete window.MyIOOrchestratorData;
delete window.MyIOOrchestratorState;
window.MyIOOrchestrator.invalidateCache('*');
console.log('✅ Cache limpo! Recarregue a página para testar novamente.');
```

### Simular Request de Widget

```javascript
function simulateWidgetRequest(domain, widgetId = 'test_widget') {
  window.dispatchEvent(new CustomEvent('myio:telemetry:request-data', {
    detail: {
      domain: domain,
      widgetId: widgetId,
      priority: 999,
      period: {
        startISO: '2025-10-01T00:00:00-03:00',
        endISO: '2025-10-17T23:59:59-03:00',
        granularity: 'day',
        tz: 'America/Sao_Paulo'
      }
    }
  }));
  console.log(`✅ Request simulado para domain: ${domain}, widget: ${widgetId}`);
}

// Uso:
simulateWidgetRequest('energy', 'my_test_widget_1');
simulateWidgetRequest('water', 'my_test_widget_2');
```

### Monitorar Eventos em Tempo Real

```javascript
// Listener para debug
window.addEventListener('myio:telemetry:provide-data', (ev) => {
  console.log('🔔 provide-data received:', {
    domain: ev.detail.domain,
    items: ev.detail.items.length,
    version: ev.detail.version,
    periodKey: ev.detail.periodKey
  });
});

window.addEventListener('myio:widget:register', (ev) => {
  console.log('📝 widget:register:', ev.detail);
});

console.log('✅ Listeners de debug registrados!');
```

---

## 📊 Checklist de Validação

### Funcionalidades Básicas

- [ ] Orchestrator inicializa sem erros
- [ ] Global state `MyIOOrchestratorState` criado corretamente
- [ ] Cache global `MyIOOrchestratorData` criado corretamente
- [ ] Widgets conseguem se registrar via `myio:widget:register`
- [ ] Listener `myio:telemetry:request-data` responde corretamente

### Deduplicação

- [ ] Emissões duplicadas (< 100ms) são bloqueadas
- [ ] `lastEmission` timestamp atualizado corretamente
- [ ] Versionamento funciona (version incrementa a cada emissão)

### Cache

- [ ] Cache hit para queries idênticas (< 30s)
- [ ] Cache miss busca dados da API
- [ ] Cache atualizado com version correta
- [ ] `OrchestratorState.cache` sincronizado com `MyIOOrchestratorData`

### Pending Listeners

- [ ] Widgets em fila recebem callback quando dados chegam
- [ ] `pendingListeners` limpo após processar
- [ ] Múltiplos widgets aguardando funcionam corretamente

### Retry para Iframes

- [ ] Iframes não prontos recebem retry após 500ms
- [ ] Logs de retry aparecem no console
- [ ] Iframes eventualmente recebem dados

### Priorização

- [ ] Primeiro widget tem priority: 1
- [ ] `widgetPriority` array mantém ordem correta
- [ ] `widgetRegistry` Map possui metadata completa

---

## 🚨 Cenários de Erro (Teste de Resiliência)

### Teste de Timeout (Busy Overlay)

**Objetivo:** Verificar timeout de 25s e recovery.

**Passos:**

1. Simular API lenta (Network throttle: Offline no DevTools)
2. Mudar data no HEADER
3. Aguardar 25s

**Resultado Esperado:**

```
[Orchestrator] 🔄 showGlobalBusy() domain=energy
[Orchestrator] ✅ Global busy shown for energy

// 25s depois
[Orchestrator] ⚠️ BUSY TIMEOUT (25s) for domain energy - implementing recovery
[Orchestrator] 🧹 Cache invalidated for domain energy
[Orchestrator] ⏸️ hideGlobalBusy() called
[Notification] "Dados recarregados automaticamente"
✅ Recovery notification exibida
```

---

## 📝 Relatório de Testes

### Template de Relatório

```markdown
# Relatório de Testes - Orchestrator RFC-0045

**Data:** YYYY-MM-DD
**Testador:** [Nome]
**Ambiente:** [Development/Production]
**Browser:** [Chrome 120 / Firefox 121 / etc]

## Testes Executados

| # | Teste | Status | Tempo | Observações |
|---|-------|--------|-------|-------------|
| 1 | Inicialização Normal | ✅ PASS | 1.2s | Todos os widgets carregaram |
| 2 | Widget Carrega Tarde | ✅ PASS | 0.08s | Cache hit funcionou |
| 3 | Mudança Rápida de Data | ✅ PASS | - | Cache hit para query repetida |
| 4 | Iframe Carregando Tarde | ✅ PASS | 0.5s | Retry funcionou após 500ms |
| 5 | Emissões Duplicadas | ✅ PASS | - | Apenas 1 request à API |

## Bugs Encontrados

- [ ] Nenhum bug encontrado
- [ ] Bug 1: [Descrição]
- [ ] Bug 2: [Descrição]

## Métricas de Performance

- Cache Hit Ratio: XX%
- Tempo médio de carregamento: XXXms
- Requests duplicados: 0
- Loading infinito: 0 ocorrências

## Conclusão

[ ] ✅ Testes aprovados - pronto para produção
[ ] ⚠️ Testes parciais - requer ajustes
[ ] ❌ Testes falharam - não aprovar
```

---

**Próximo Passo:** Executar testes em ambiente de desenvolvimento e preencher relatório.
