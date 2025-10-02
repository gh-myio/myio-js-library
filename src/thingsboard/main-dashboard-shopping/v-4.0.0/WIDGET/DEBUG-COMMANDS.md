# Comandos de Debug para Diagnosticar Problema de Comunicação

## 🔍 Diagnóstico Rápido

### 1. Verificar se widgets TELEMETRY carregaram
```javascript
// Deve mostrar 3x o log:
// "🚀 [TELEMETRY] Controller loaded - VERSION WITH ORCHESTRATOR SUPPORT"
// "✅ myio:update-date listener registered!"
```

### 2. Verificar event listeners registrados
```javascript
// No console:
getEventListeners(window)['myio:update-date']
// Deve retornar um array com 3 listeners (um para cada widget TELEMETRY)
```

### 3. Testar manualmente o evento
```javascript
// Emitir evento de mudança de data manualmente
window.dispatchEvent(new CustomEvent('myio:update-date', {
  detail: {
    period: {
      startISO: '2025-09-26T00:00:00-03:00',
      endISO: '2025-10-02T23:59:59-03:00',
      granularity: 'day',
      tz: 'America/Sao_Paulo'
    }
  }
}));

// Deve aparecer nos logs:
// [TELEMETRY energy] ✅ DATE UPDATE EVENT RECEIVED!
// [TELEMETRY energy] Using NEW format (period object)
// [TELEMETRY energy] ✅ Requesting data from orchestrator
```

### 4. Verificar se WIDGET_DOMAIN está definido
```javascript
// No console, verificar contexto de cada widget
// (execute dentro do iframe se necessário)
console.log('WIDGET_DOMAIN:', WIDGET_DOMAIN);
// Deve retornar: "energy" ou "water" ou "temperature"
```

---

## 🐛 Diagnóstico do Problema Atual

### Sintomas Observados:
```
✅ [HEADER] Emitting standardized period: {...}
✅ [Orchestrator] Fetching from: https://...
✅ [Orchestrator] fetchAndEnrich: fetched 353 items
✅ [Orchestrator] Emitting provide-data event for domain energy with 353 items
✅ [Orchestrator] Retrying event emission for domain energy

❌ [TELEMETRY energy] ✅ DATE UPDATE EVENT RECEIVED! (NÃO APARECE!)
❌ [TELEMETRY energy] ✅ Requesting data from orchestrator (NÃO APARECE!)
```

### Possível Causa:
**O evento `myio:update-date` está sendo emitido em um contexto de window diferente dos widgets TELEMETRY.**

---

## 🔧 Solução 1: Verificar Contexto de Window

### Teste 1: Widgets em iframe?
```javascript
// No console principal:
window === top
// Se retornar false, widgets estão em iframe

// Verificar se HEADER está no mesmo contexto:
console.log('HEADER window:', window);
console.log('TELEMETRY window:', /* precisa acessar iframe */);
```

### Teste 2: Emitir em todos os contextos
```javascript
// Modificar HEADER para emitir em múltiplos contextos:
function emitToAllContexts(eventName, detail) {
  // Window atual
  window.dispatchEvent(new CustomEvent(eventName, { detail }));

  // Parent window (se em iframe)
  if (window.parent && window.parent !== window) {
    try {
      window.parent.dispatchEvent(new CustomEvent(eventName, { detail }));
    } catch (e) {
      console.warn('Cannot emit to parent:', e);
    }
  }

  // Todos os iframes
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    try {
      iframe.contentWindow.dispatchEvent(new CustomEvent(eventName, { detail }));
    } catch (e) {
      console.warn('Cannot emit to iframe:', e);
    }
  });
}
```

---

## 🔧 Solução 2: Usar Custom Window Event com Bubbling

### No HEADER (emissor):
```javascript
btnLoad?.addEventListener("click", () => {
  const period = {
    startISO: toISO(self.ctx.$scope.startTs || inputStart.value + "T00:00:00", 'America/Sao_Paulo'),
    endISO: toISO(self.ctx.$scope.endTs || inputEnd.value + "T23:59:00", 'America/Sao_Paulo'),
    granularity: calcGranularity(startISO, endISO),
    tz: 'America/Sao_Paulo'
  };

  console.log("[HEADER] Emitting to ALL contexts...");

  // Emit to current window
  window.dispatchEvent(new CustomEvent("myio:update-date", {
    detail: { period },
    bubbles: true,
    composed: true
  }));

  // Emit to parent if exists
  if (window.parent && window.parent !== window) {
    try {
      window.parent.dispatchEvent(new CustomEvent("myio:update-date", {
        detail: { period },
        bubbles: true,
        composed: true
      }));
      console.log("[HEADER] Emitted to parent window");
    } catch (e) {
      console.warn("[HEADER] Cannot emit to parent:", e);
    }
  }

  // Emit to all iframes
  try {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe, idx) => {
      try {
        iframe.contentWindow.dispatchEvent(new CustomEvent("myio:update-date", {
          detail: { period },
          bubbles: true,
          composed: true
        }));
        console.log(`[HEADER] Emitted to iframe ${idx}`);
      } catch (e) {
        console.warn(`[HEADER] Cannot emit to iframe ${idx}:`, e);
      }
    });
  } catch (e) {
    console.warn("[HEADER] Cannot access iframes:", e);
  }
});
```

---

## 🔧 Solução 3: Usar SharedWorker ou BroadcastChannel

### Criar canal de comunicação global:
```javascript
// No início de cada widget (HEADER, TELEMETRY, etc.):
const channel = new BroadcastChannel('myio-events');

// HEADER emite:
channel.postMessage({
  type: 'update-date',
  period: { startISO, endISO, granularity, tz }
});

// TELEMETRY escuta:
channel.onmessage = (event) => {
  if (event.data.type === 'update-date') {
    const { period } = event.data;
    self.ctx.scope.startDateISO = period.startISO;
    self.ctx.scope.endDateISO = period.endISO;
    requestDataFromOrchestrator();
  }
};
```

---

## 🧪 Teste de Diagnóstico Completo

Execute este script no console para diagnosticar o problema:

```javascript
(function diagnose() {
  console.log('=== DIAGNOSTIC REPORT ===');

  // 1. Check window context
  console.log('1. Window Context:');
  console.log('  - Is top window:', window === top);
  console.log('  - Has parent:', window.parent !== window);
  console.log('  - Iframe count:', document.querySelectorAll('iframe').length);

  // 2. Check Orchestrator
  console.log('2. Orchestrator:');
  console.log('  - Exists:', !!window.MyIOOrchestrator);
  console.log('  - Stats:', window.MyIOOrchestrator?.getCacheStats());

  // 3. Check event listeners
  console.log('3. Event Listeners:');
  const listeners = getEventListeners(window);
  console.log('  - myio:update-date:', listeners['myio:update-date']?.length || 0);
  console.log('  - myio:telemetry:provide-data:', listeners['myio:telemetry:provide-data']?.length || 0);
  console.log('  - myio:telemetry:request-data:', listeners['myio:telemetry:request-data']?.length || 0);

  // 4. Test manual emission
  console.log('4. Testing Manual Emission:');
  window.dispatchEvent(new CustomEvent('myio:update-date', {
    detail: {
      period: {
        startISO: '2025-09-26T00:00:00-03:00',
        endISO: '2025-10-02T23:59:59-03:00',
        granularity: 'day',
        tz: 'America/Sao_Paulo'
      }
    }
  }));

  console.log('=== END DIAGNOSTIC ===');
})();
```

---

## 📋 Checklist de Resolução

- [ ] Verificar se widgets estão no mesmo window context
- [ ] Verificar se event listeners estão registrados (getEventListeners)
- [ ] Testar emissão manual de evento
- [ ] Verificar se WIDGET_DOMAIN está definido
- [ ] Implementar emissão cross-context (parent/iframes)
- [ ] Considerar usar BroadcastChannel para comunicação
- [ ] Adicionar retry mechanism com timeout

---

## 🚨 Ação Imediata

**SE os logs `[TELEMETRY energy] ✅ DATE UPDATE EVENT RECEIVED!` NÃO aparecerem:**

1. Execute o diagnóstico completo
2. Verifique `getEventListeners(window)['myio:update-date']`
3. Se retornar vazio ou undefined → **problema de contexto de window**
4. Implemente **Solução 2** (emissão cross-context)

**SE os logs aparecerem MAS data não atualizar:**

1. Verifique se `requestDataFromOrchestrator()` está sendo chamada
2. Verifique se `WIDGET_DOMAIN` está correto
3. Verifique se orchestrator está recebendo `myio:telemetry:request-data`
