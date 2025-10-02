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

- [x] Verificar se widgets estão no mesmo window context ✅
- [x] Verificar se event listeners estão registrados (getEventListeners) ✅
- [x] Testar emissão manual de evento ✅
- [x] Verificar se WIDGET_DOMAIN está definido ✅
- [x] Implementar emissão cross-context (parent/iframes) ✅
- [x] Adicionar retry mechanism com timeout ✅
- [x] Corrigir match de ingestionId ✅
- [x] Corrigir labels da API (usar "name" ao invés de "label") ✅
- [x] Implementar formatação por domain ✅
- [x] Adicionar delay em modal busy ✅

---

## ✅ PROBLEMAS RESOLVIDOS (2025-10-02)

### 1. Cross-Context Communication
**Problema:** Eventos não chegavam em widgets dentro de iframes
**Solução:** `emitToAllContexts()` em HEADER e MAIN_VIEW

### 2. Match de Dados
**Problema:** `extractDatasourceIds()` pegava entityId ao invés de ingestionId
**Solução:** Extrair ingestionId do ctx.data

### 3. Labels Incorretos
**Problema:** API usa `row.name`, código usava `row.label`
**Solução:** `label: row.name || row.label || row.identifier || row.id`

### 4. Formatação de Header
**Problema:** Hardcoded com `MyIO.formatEnergy()` para todos os domains
**Solução:** Switch case baseado em `WIDGET_DOMAIN`

### 5. Modal Invisível
**Problema:** Processing muito rápido (< 50ms)
**Solução:** `setTimeout(() => hideBusy(), 500)`

### 6. readingType Hardcoded no EnergyModalView
**Problema:** `readingType: 'energy'` hardcoded, não funcionava para water/tank
**Solução:**
- Passar `readingType: WIDGET_DOMAIN` em `MyIO.openDashboardPopupEnergy()`
- Usar `this.config.params.readingType || 'energy'` no chartConfig
**Arquivos:** `TELEMETRY/controller.js:478`, `EnergyModalView.ts:234`, `types.ts:29`

### 7. Double-Fetch no onInit (Water Zerava Dados)
**Problema:** onInit chamava `hydrateAndRender()` (fetch direto API) + 500ms depois orchestrator sobrescrevia com dados vazios
**Solução:**
- Remover chamada a `hydrateAndRender()` no onInit
- Construir `itemsBase` do TB com valores zerados
- Aguardar orchestrator prover dados corretos
- Adicionar validação: só usar dados armazenados se `items.length > 0`
**Arquivo:** `TELEMETRY/controller.js:1180-1214`

### 8. centralName Support
**Problema:** `centralName: "N/A"` hardcoded
**Solução:**
- Extrair `centralName` do ctx.data em `buildTbAttrIndex()`
- Mapear em `buildAuthoritativeItems()`
- Usar `it.centralName || "N/A"` em renderList
**Nota:** Requer adicionar `centralName` aos dataKeys no ThingsBoard
**Arquivo:** `TELEMETRY/controller.js:267,324,450`

### 9. GROUP_TYPE Removido (Redundante)
**Problema:** Filtro `GROUP_TYPE` redundante com datasource do ThingsBoard
**Análise:** Datasource já define quais devices aparecem no widget, tornando filtro por groupType desnecessário
**Solução:**
- Remover variável `WIDGET_GROUP_TYPE`
- Remover lógica de filtro secundário por groupType
- Remover campo `GROUP_TYPE` do settings.schema
- Simplificar typedef em MAIN_VIEW (remover GroupType)
**Benefício:** Código mais simples, menos configuração, menos lugares para bugs
**Arquivos:** `TELEMETRY/controller.js`, `TELEMETRY/settings.schema`, `MAIN_VIEW/controller.js`

### 10. DeviceReportModal - Domain Support
**Problema:** Modal de relatório hardcoded "Consumo (kWh)" para todos os domains
**Análise:** Widget TELEMETRY pode ser energy, water ou temperature, mas modal sempre mostrava kWh
**Solução:**
- Adicionar `domain?: 'energy' | 'water' | 'temperature'` ao `OpenDeviceReportParams` (types.ts)
- Criar `DOMAIN_CONFIG` com endpoint, unit, label e formatter por domain
- Atualizar fetcher para usar endpoint dinâmico (`/energy`, `/water`, `/temperature`)
- Atualizar renderTable() para exibir unidade e label corretos
- Atualizar exportCSV() para usar unidade correta no CSV
- Passar `domain: WIDGET_DOMAIN` do TELEMETRY para `openDashboardPopupReport()`
**Resultado:**
- Energy: "Consumo (kWh)" / Total: 1234.56 kWh
- Water: "Consumo (m³)" / Total: 45.78 m³
- Temperature: "Temperatura (°C)" / Total: 23.45 °C
**Arquivos:** `DeviceReportModal.ts`, `types.ts`, `TELEMETRY/controller.js:519`

---

## 🧪 Comandos de Validação

### Verificar se tudo está funcionando:

```javascript
// 1. Verificar labels corretos
console.log(STATE.itemsEnriched.map(i => i.label));
// Deve mostrar: ["Allegria", "Bob's", "Renner", ...]
// NÃO deve mostrar UUIDs!

// 2. Verificar valores
console.log(STATE.itemsEnriched.filter(i => i.value > 0));
// Deve mostrar items com valores da API

// 3. Verificar formatação do header
console.log(WIDGET_DOMAIN); // "energy", "water" ou "tank"
$total().text(); // Deve ter unidade correta (kWh, m³, cm)

// 4. Verificar match
const orchestratorValues = new Map();
filtered.forEach(item => {
  if (item.ingestionId && item.value > 0) {
    console.log(`${item.label}: ${item.value}`);
  }
});
```

### Testar atualização de data:

1. Mudar data no HEADER
2. Clicar em "Carregar"
3. **Deve aparecer:**
   - Modal busy em todos os 3 widgets ✅
   - Valores atualizados ✅
   - Labels corretos (nomes das lojas) ✅
   - Unidade correta no header ✅

---

## 🚨 Troubleshooting

**SE valores aparecem e depois desaparecem:**
- Verificar se API retorna `row.name` (não `row.label`)
- Verificar match de ingestionId nos logs

**SE modal não aparece:**
- Verificar se `showBusy()` está sendo chamado
- Verificar se delay de 500ms está implementado

**SE unidade errada no header:**
- Verificar `WIDGET_DOMAIN` no settings do widget
- Verificar se `renderHeader()` tem switch case por domain
