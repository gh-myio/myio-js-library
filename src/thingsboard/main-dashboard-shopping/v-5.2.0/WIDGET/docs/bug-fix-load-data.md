# Bug: Intermitência no Carregamento de Dados ao Trocar de Tab

## Status: RESOLVIDO (RFC-0136)

---

## Problema Original

Ao entrar no dashboard com o widget MAIN_VIEW, os dados carregavam corretamente na primeira vez. Porém, ao clicar no menu no item "Água" e carregar novos widgets TELEMETRY (entrada, área comum, lojas) + TELEMETRY_INFO:

- Intermitência crítica: às vezes não carregava nada
- Na maioria das vezes, dos 3 widgets TELEMETRY com domain water, "Lojas" não carregava
- O widget TELEMETRY_INFO recebia os dados corretamente (mostrando consumo em lojas no summary)
- Só ao clicar em "Consultar" no HEADER é que os cards de lojas apareciam

---

## Causa Raiz: Race Condition

**Race Condition no registro de event listeners:**

```
1. Usuário clica "Água" no MENU
2. ThingsBoard carrega 3 TELEMETRY widgets + 1 TELEMETRY_INFO (assíncrono)
3. MAIN_VIEW emite `myio:telemetry:provide-data` para water
4. Widgets "entrada" e "areacomum" JÁ registraram listener → recebem dados ✅
5. Widget "lojas" AINDA não registrou listener → perde evento ❌
6. Widget "lojas" permanece vazio
```

### Arquitetura do Problema

```
MAIN_VIEW (Orquestrador)
    │
    ├── popula window.STATE.water = { entrada, lojas, areacomum, ... }
    ├── popula window.MyIOOrchestratorData.water = { items: [...], timestamp }
    └── dispatchEvent('myio:telemetry:provide-data', { domain: 'water', items })
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
TELEMETRY   TELEMETRY   TELEMETRY
 entrada    areacomum    lojas (LATE!)
    │           │           │
    └───────────┴───────────┘
    addEventListener('myio:telemetry:provide-data')
```

---

## Solução Implementada (RFC-0136)

### 1. Evento `myio:widget:ready`

Quando um widget TELEMETRY termina de registrar seus listeners, ele agora emite `myio:widget:ready`:

```javascript
// TELEMETRY/controller.js - registerWithOrchestrator()
window.dispatchEvent(
  new CustomEvent('myio:widget:ready', {
    detail: {
      widgetId: widgetId,
      domain: WIDGET_DOMAIN,
      labelWidget: labelWidget,
      timestamp: Date.now(),
    },
  })
);
```

### 2. Re-emissão de Dados pelo MAIN_VIEW

O MAIN_VIEW escuta `myio:widget:ready` e re-emite `provide-data` se houver dados em cache:

```javascript
// MAIN_VIEW/controller.js
window.addEventListener('myio:widget:ready', (ev) => {
  const { widgetId, domain } = ev.detail;
  const cachedData = window.MyIOOrchestratorData?.[domain];

  if (cachedData && cachedData.items.length > 0 && age < 60000) {
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('myio:telemetry:provide-data', {
          detail: { domain, periodKey, items, _reemit: true }
        })
      );
    }, 50);
  }
});
```

### 3. Retry Inteligente com Backoff

O TELEMETRY agora usa múltiplos retries com intervalos crescentes ao invés de um único timeout:

```javascript
const RETRY_INTERVALS = [500, 1000, 2000]; // Backoff: 500ms, 1s, 2s

function executeRetryWithBackoff() {
  // Tenta carregar dados do cache ou window.STATE
  // Se falhar, agenda próximo retry com delay maior
  // Após 3 tentativas, solicita dados frescos do orchestrator
}
```

### 4. Fallback Direto para window.STATE

Além de verificar `MyIOOrchestratorData`, o retry agora também verifica `window.STATE` diretamente:

```javascript
if (window.STATE?.isReady && window.STATE.isReady(WIDGET_DOMAIN)) {
  const stateItems = getItemsFromState(WIDGET_DOMAIN, myLabelWidget);
  if (stateItems && stateItems.length > 0) {
    // Usa dados diretamente do STATE como fallback
  }
}
```

---

## Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `TELEMETRY/controller.js` | `registerWithOrchestrator()`: emite `widget:ready` após registro |
| `TELEMETRY/controller.js` | Substituído setTimeout(500) por retry com backoff [500, 1000, 2000] |
| `TELEMETRY/controller.js` | Adicionado fallback para `window.STATE` direto |
| `MAIN_VIEW/controller.js` | Adicionado listener para `myio:widget:ready` |
| `MAIN_VIEW/controller.js` | Re-emite `provide-data` para widgets tardios |

---

## Fluxo Corrigido

```
1. Usuário clica "Água" no MENU
2. ThingsBoard carrega TELEMETRY widgets (entrada, areacomum, lojas)
3. MAIN_VIEW emite 'provide-data' para water
4. Widgets "entrada" e "areacomum" recebem via listener ✅
5. Widget "lojas" termina inicialização
6. Widget "lojas" emite 'widget:ready' ✅
7. MAIN_VIEW recebe 'widget:ready', re-emite 'provide-data' ✅
8. Widget "lojas" recebe dados ✅
9. (Backup) Se ainda falhar, retry com backoff tenta 3x
10. (Backup) Fallback para window.STATE direto
```

---

## Logs de Debug

Procure por estes logs no console para verificar o funcionamento:

```
[TELEMETRY water] 📡 RFC-0136: Emitted widget:ready for telemetry-water-xxxxx
[Orchestrator] 📡 RFC-0136: Widget ready - telemetry-water-xxxxx (domain: water, labelWidget: Lojas)
[Orchestrator] 📡 RFC-0136: Re-emitting provide-data for water (15 items) - triggered by telemetry-water-xxxxx
[TELEMETRY water] 🔄 RFC-0136: Starting intelligent retry with backoff [500ms, 1000ms, 2000ms]
[TELEMETRY water] ✅ RFC-0136: Data loaded externally, canceling remaining retries
```

---

## Análise Original (Referência)

### Causas Raiz Identificadas

1. **Race Condition no Registro de Listeners** - Widget "lojas" perde o evento `provide-data`
2. **Fallback de 500ms único** - Não era suficiente para widgets lentos
3. **Filtro por labelWidget depende de window.STATE.isReady()** - Podia retornar null
4. **Validação de Customer podia limpar cache** - Limpeza inesperada durante navegação

### Por que TELEMETRY_INFO Funcionava?

O widget TELEMETRY_INFO recebe dados via `myio:telemetry:provide-water` que é emitido pelo TELEMETRY que **conseguiu** carregar. Portanto, o summary aparecia mesmo quando "lojas" não carregava os cards.

### Pontos Críticos no Código

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| TELEMETRY/controller.js | 3913 | Registro do listener (pode ser tarde) |
| TELEMETRY/controller.js | 3956-4099 | Retry com backoff (RFC-0136) |
| TELEMETRY/controller.js | 811-814 | Verificação isReady() |
| MAIN_VIEW/controller.js | 5180-5236 | Listener widget:ready (RFC-0136) |
| MAIN_VIEW/controller.js | 5023-5025 | Dispatch do evento |
