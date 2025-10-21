# RFC-0048: Widget Busy Monitor - Timeout Detection System

**Status**: Implemented
**Date**: 2025-10-21
**Author**: Claude Code
**Related**: RFC-0042, RFC-0044, RFC-0045, RFC-0046, RFC-0047

## Problem Statement

### Intermitência nos Widgets TELEMETRY

Observamos intermitência no carregamento dos 3 widgets TELEMETRY (energy, water, temperature) no dashboard `telemetry_content`:

1. **Widget fica em showBusy por mais de 30 segundos** sem dados
2. **Dados zerados** mesmo quando há dados disponíveis no cache/API
3. **Falta de visibilidade** sobre qual widget está travado
4. **Sem auto-recovery** quando widget entra em estado inconsistente

### Cenários Problemáticos

```
CENÁRIO 1: Widget não recebe dados do orchestrator
- Widget chama showBusy()
- Orchestrator emite evento 'myio:telemetry:provide-data'
- Widget não recebe o evento (listener não registrado ou erro)
- showBusy() permanece visível indefinidamente

CENÁRIO 2: Widget recebe dados vazios
- Widget recebe array vazio do orchestrator
- Widget não chama hideBusy() porque não há dados para processar
- Usuário vê tela de loading eternamente

CENÁRIO 3: Erro silencioso no processamento
- Widget recebe dados válidos
- Erro JavaScript durante processamento (ex: item.value.toFixed() quando value é null)
- Erro é silencioso (try/catch não reporta)
- hideBusy() nunca é chamado
```

## Solution Design

### Widget Busy Monitor

Sistema de monitoramento que detecta widgets travados e tenta auto-recovery:

```javascript
const widgetBusyMonitor = {
  timers: new Map(), // domain -> timeoutId
  TIMEOUT_MS: 30000, // 30 segundos

  startMonitoring(domain) {
    // Inicia timer quando widget mostra busy
  },

  stopMonitoring(domain) {
    // Para timer quando widget esconde busy
  }
}
```

### Fluxo de Monitoramento

```
1. Widget chama showGlobalBusy(domain)
   ↓
2. Monitor inicia timer de 30s para esse domain
   ↓
3a. Widget processa dados e chama hideBusy()
    → Monitor cancela timer ✅

3b. 30 segundos passam sem hideBusy()
    → Monitor detecta problema ⚠️
    → Logs detalhados sobre o estado
    → Auto-recovery: força hideBusy()
```

### Integração com Orchestrator

```javascript
// showGlobalBusy agora inicia monitoramento
function showGlobalBusy(domain = 'unknown', message = 'Carregando dados...') {
  // ... código existente ...

  // RFC-0048: Start widget monitoring
  if (window.MyIOOrchestrator?.widgetBusyMonitor) {
    window.MyIOOrchestrator.widgetBusyMonitor.startMonitoring(domain);
  }
}

// hideGlobalBusy agora para monitoramento
function hideGlobalBusy() {
  // RFC-0048: Stop widget monitoring for current domain
  if (window.MyIOOrchestrator?.widgetBusyMonitor && globalBusyState.currentDomain) {
    window.MyIOOrchestrator.widgetBusyMonitor.stopMonitoring(globalBusyState.currentDomain);
  }

  // ... código existente ...
}
```

## Implementation Details

### Detecção de Problemas

Quando timeout de 30s é atingido, o monitor registra:

```javascript
LogHelper.error(`[WidgetMonitor] ⚠️ Widget ${domain} has been showing busy for more than 30s!`);
LogHelper.error(`[WidgetMonitor] Possible issues:`);
LogHelper.error(`[WidgetMonitor] 1. Widget não recebeu dados do orchestrator`);
LogHelper.error(`[WidgetMonitor] 2. Widget recebeu dados vazios mas não chamou hideBusy()`);
LogHelper.error(`[WidgetMonitor] 3. Erro silencioso impedindo processamento`);
```

### Informações de Debug

O monitor coleta e registra:

1. **Estado do Busy Global**
   ```javascript
   const busyState = globalBusyState;
   LogHelper.error(`[WidgetMonitor] Current busy state:`, busyState);
   ```

2. **Estado do Cache para o Domain**
   ```javascript
   const cacheKey = `${domain}:${period.startISO}:${period.endISO}`;
   const cached = memCache.get(cacheKey);
   LogHelper.error(`[WidgetMonitor] Cache state for ${domain}:`, {
     hasCachedData: !!cached,
     itemCount: cached?.items?.length || 0,
     cachedAt: cached?.cachedAt ? new Date(cached.cachedAt).toISOString() : 'never'
   });
   ```

### Auto-Recovery

Quando problema é detectado:

```javascript
LogHelper.warn(`[WidgetMonitor] 🔧 Attempting auto-recovery: forcing hideBusy for ${domain}`);
hideGlobalBusy();
```

Isso permite que:
- Usuário veja a interface novamente (mesmo que com dados zerados)
- Widget possa tentar novo carregamento se usuário mudar período
- Sistema não fique travado indefinidamente

## Key Benefits

### 1. Visibilidade de Problemas
- **Antes**: Widget travado silenciosamente, sem informação
- **Depois**: Logs detalhados indicando exatamente qual widget e por quanto tempo

### 2. Auto-Recovery
- **Antes**: Usuário precisava recarregar página inteira
- **Depois**: Sistema tenta recovery automático após 30s

### 3. Debug Facilitado
- **Antes**: Difícil saber se problema é cache, API, ou widget
- **Depois**: Logs mostram estado do cache, busy, e domain específico

### 4. Não-Intrusivo
- Monitor opera em background
- Não afeta fluxo normal quando widgets funcionam corretamente
- Apenas age quando detecta anomalia

## Testing Strategy

### Teste Manual 1: Widget Normal
```
1. Abrir dashboard telemetry_content
2. Selecionar período com dados
3. Verificar que showBusy aparece e desaparece < 30s
4. Monitor deve iniciar e parar normalmente
5. Sem logs de erro
```

### Teste Manual 2: Simular Timeout
```
1. No TELEMETRY controller, comentar hideBusy() no final de dataProvideHandler
2. Abrir dashboard telemetry_content
3. Selecionar período
4. Aguardar 30 segundos
5. Verificar logs do WidgetMonitor
6. Verificar auto-recovery (busy desaparece)
```

### Teste Manual 3: Múltiplos Widgets
```
1. Abrir dashboard com 3 widgets TELEMETRY
2. Simular timeout em apenas 1 widget
3. Verificar que apenas esse widget é monitorado/recuperado
4. Outros widgets devem funcionar normalmente
```

## Monitoring Metrics

Console logs permitem rastrear:

```
✅ [WidgetMonitor] Started monitoring energy (timeout: 30s)
✅ [WidgetMonitor] Stopped monitoring energy

⚠️ [WidgetMonitor] Widget water has been showing busy for more than 30s!
🔧 [WidgetMonitor] Attempting auto-recovery: forcing hideBusy for water
```

## Migration Path

### Nenhuma mudança necessária nos widgets

Integração é transparente:
- Widgets continuam chamando `showBusy()` e `hideBusy()` normalmente
- Monitor opera automaticamente via orchestrator
- Não requer mudanças em TELEMETRY, HEADER, ou FOOTER

### Rollback

Se necessário reverter:
```javascript
// Remover linha 565-569 de controller.js (showGlobalBusy)
// Remover linha 611-614 de controller.js (hideGlobalBusy)
// Remover bloco 1598-1652 de controller.js (widgetBusyMonitor)
```

## Configuration

### Ajustar Timeout

Padrão é 30 segundos. Para ajustar:

```javascript
const widgetBusyMonitor = {
  timers: new Map(),
  TIMEOUT_MS: 45000, // 45 segundos
  // ...
}
```

### Desabilitar Monitor

Para desabilitar temporariamente:

```javascript
// Em showGlobalBusy, comentar:
/*
if (window.MyIOOrchestrator?.widgetBusyMonitor) {
  window.MyIOOrchestrator.widgetBusyMonitor.startMonitoring(domain);
}
*/
```

## Related Work

- **RFC-0042**: Orchestrator base implementation
- **RFC-0044**: Centralized busy management (base para este RFC)
- **RFC-0045**: Cache strategy (informações usadas no debug)
- **RFC-0046**: Race condition fixes (contexto dos problemas)
- **RFC-0047**: Cache improvements (dados de cache usados no monitor)

## Future Improvements

### 1. Telemetry
Enviar métricas para ThingsBoard:
```javascript
{
  widgetTimeouts: { energy: 2, water: 1, temperature: 0 },
  avgBusyDuration: { energy: 3200, water: 2800, temperature: 3100 },
  autoRecoverySuccess: true
}
```

### 2. User Notification
Mostrar notificação visual ao usuário:
```javascript
showNotification({
  type: 'warning',
  message: 'Dados demorando mais que o esperado, tentando novamente...',
  duration: 5000
});
```

### 3. Retry Strategy
Implementar retry automático:
```javascript
if (timeout) {
  LogHelper.warn('Retrying data fetch...');
  MyIOOrchestrator.invalidateCache(domain);
  MyIOOrchestrator.hydrateDomain(domain, currentPeriod);
}
```

### 4. Circuit Breaker
Prevenir retry loops infinitos:
```javascript
if (retryCount > 3) {
  LogHelper.error('Max retries reached, showing error state');
  showErrorState(domain);
}
```

## Files Modified

```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js
  - Line 565-569: Monitor start em showGlobalBusy
  - Line 611-614: Monitor stop em hideGlobalBusy
  - Line 1598-1652: widgetBusyMonitor implementation
  - Line 1684: Expose widgetBusyMonitor na public API
  - Line 1722-1723: Stop all monitors em destroy
```

## Conclusion

O Widget Busy Monitor resolve o problema de widgets TELEMETRY travados, fornecendo:

✅ **Detecção automática** de widgets com busy > 30s
✅ **Logs detalhados** para debug
✅ **Auto-recovery** para melhor UX
✅ **Zero mudanças** necessárias nos widgets existentes
✅ **Não-intrusivo** quando sistema funciona normalmente

Implementação está completa e pronta para testes em produção.

## Appendix A: Console Output Example

```
[TELEMETRY] 🔄 showBusy() called with message: "Carregando dados..."
[Orchestrator] 🔄 showGlobalBusy() domain=energy message="Carregando dados..."
[WidgetMonitor] ✅ Started monitoring energy (timeout: 30s)

... 30 segundos depois (se hideBusy não for chamado) ...

[WidgetMonitor] ⚠️ Widget energy has been showing busy for more than 30s!
[WidgetMonitor] Possible issues:
[WidgetMonitor] 1. Widget não recebeu dados do orchestrator
[WidgetMonitor] 2. Widget recebeu dados vazios mas não chamou hideBusy()
[WidgetMonitor] 3. Erro silencioso impedindo processamento
[WidgetMonitor] Current busy state: {
  isVisible: true,
  currentDomain: 'energy',
  startTime: 1729511234567,
  requestCount: 1,
  timeoutId: 123
}
[WidgetMonitor] Cache state for energy: {
  hasCachedData: true,
  itemCount: 45,
  cachedAt: '2025-10-21T14:30:00.000Z'
}
[WidgetMonitor] 🔧 Attempting auto-recovery: forcing hideBusy for energy
[Orchestrator] ⏸️ hideGlobalBusy() called
[WidgetMonitor] ✅ Stopped monitoring energy
```

## Appendix B: Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   MAIN_VIEW Widget                  │
│                  (Orchestrator Host)                │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │       MyIOOrchestrator                        │ │
│  │                                               │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │   widgetBusyMonitor                     │ │ │
│  │  │                                         │ │ │
│  │  │   timers: Map {                        │ │ │
│  │  │     'energy'  -> timeoutId1            │ │ │
│  │  │     'water'   -> timeoutId2            │ │ │
│  │  │     'temperature' -> timeoutId3        │ │ │
│  │  │   }                                     │ │ │
│  │  │                                         │ │ │
│  │  │   startMonitoring(domain) {            │ │ │
│  │  │     setTimeout(() => {                 │ │ │
│  │  │       // Log errors                    │ │ │
│  │  │       // Show state                    │ │ │
│  │  │       // Force hideBusy()              │ │ │
│  │  │     }, 30000)                          │ │ │
│  │  │   }                                     │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  │                                               │ │
│  │  showGlobalBusy(domain) {                     │ │
│  │    widgetBusyMonitor.startMonitoring(domain)  │ │
│  │    // ... show busy overlay ...              │ │
│  │  }                                             │ │
│  │                                               │ │
│  │  hideGlobalBusy() {                           │ │
│  │    widgetBusyMonitor.stopMonitoring(domain)   │ │
│  │    // ... hide busy overlay ...              │ │
│  │  }                                             │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                        │
                        │ Events
                        ↓
    ┌──────────────────────────────────────┐
    │      TELEMETRY Widgets (x3)          │
    │                                      │
    │  Energy Widget                       │
    │    calls: showBusy() / hideBusy()   │
    │                                      │
    │  Water Widget                        │
    │    calls: showBusy() / hideBusy()   │
    │                                      │
    │  Temperature Widget                  │
    │    calls: showBusy() / hideBusy()   │
    └──────────────────────────────────────┘
```
