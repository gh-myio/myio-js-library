<!--
  Refactoring map for MYIO-SIM v5.2.0 (ENERGY/WATER -> MAIN shared utilities)
  This document is intentionally detailed and operational.
-->

# Refactoring — Mapa de Extração (MYIO-SIM v5.2.0)

Este documento descreve **o “mapa de extração”**: quais funções criar em `window.MyIOUtils` e/ou `window.MyIOOrchestrator` (no `MAIN`), e **quais trechos dos controllers** (`ENERGY` e `WATER`) passam a chamar essas funções.

Objetivos principais:

- Remover duplicações entre `ENERGY/controller.js` e `WATER/controller.js`.
- Padronizar compatibilidade ThingsBoard (`ctx.$container`) para busca de elementos.
- Padronizar registro/cleanup de eventos em contextos com `iframe` (`window` e `window.parent`).
- Trocar **polling/retries** por um fluxo único baseado em evento (`myio:orchestrator:ready`).
- Centralizar o “fullscreen modal” (RFC-0098) em um helper único.
- Eliminar eventos “órfãos” (ex.: `myio:request-water-data`) ou criar handlers oficiais no Orchestrator.

## Escopo (arquivos alvo)

- `src/MYIO-SIM/v5.2.0/MAIN/controller.js`
- `src/MYIO-SIM/v5.2.0/ENERGY/controller.js`
- `src/MYIO-SIM/v5.2.0/WATER/controller.js`

Referências úteis:

- Orchestrator já emite `myio:orchestrator:ready` no `MAIN`.
- ENERGY já usa `window.MyIOUtils?.LogHelper` (fallback local) e faz polling `requestSummary()`.
- WATER implementa `$id` local (compat TB), e dispara `myio:request-water-data` (não encontrado handler correspondente no `MAIN`).

## Diagnóstico resumido (duplicações/focos)

### 1) Compatibilidade ThingsBoard (seleção de elementos)

- WATER possui helper `$id(id)` baseado em `self.ctx.$container`.
- ENERGY usa `document.getElementById`, o que quebra/fragiliza em contextos de widget/iframe.

**Extração:** `MyIOUtils.$id(ctx, id)`.

### 2) Eventos e cleanup (window + parent)

- ENERGY tem lógica manual para adicionar/remover listeners em `window` e `window.parent` e mantém um `registeredHandlers`.
- WATER adiciona listeners apenas em `window` e tem `cleanup()` próprio.

**Extração:** `MyIOUtils.addListenerBoth(eventName, handler, options?) -> cleanupFn` e um padrão `cleanupFns`.

### 3) Orchestrator readiness: polling/retries

- ENERGY tem `waitForOrchestratorAndRequestSummary()` (polling).
- WATER tem `setTimeout` + retries + evento `myio:request-water-data`.

**Extração:** `MyIOUtils.onOrchestratorReady(cb, opts)` (baseado em `myio:orchestrator:ready` + `isReady`), e padronizar “request summary” por domínio no Orchestrator.

### 4) Fullscreen modal (RFC-0098)

- `openFullscreenModal()` existe em ambos, com mesma “cola” (`initialData` via `cachedChartData`/`consumptionChartInstance.getCachedData()` e defaults).

**Extração:** `MyIOUtils.openConsumptionFullscreen(params)`.

### 5) “request-water-data” não padronizado

WATER dispara `myio:request-water-data`, mas não há handler no `MAIN` para responder a isso. O `MAIN` já emite:

- `myio:water-data-ready`
- `myio:water-summary-ready`

**Refatoração:** substituir o fluxo do WATER para consumir `myio:water-summary-ready` (e/ou um método `requestWaterSummary()` no Orchestrator).

---

# Parte A — Funções a criar no `window.MyIOUtils` (no MAIN)

> Local sugerido: consolidar em um único `Object.assign(window.MyIOUtils, { ... })` no `MAIN/controller.js`.
> O `MAIN` já inicializa `window.MyIOUtils` e expõe `LogHelper`, etc.

## A.1 `MyIOUtils.$id(ctx, id)`

### Problema que resolve

- Padroniza a busca de elementos dentro do container do widget (ThingsBoard), com fallback para `document`.
- Remove a duplicação do `$id` local no WATER e corrige ENERGY.

### Assinatura (JS)

```js
$id: (ctx, id) => {
  const container = ctx?.$container?.[0];
  if (container?.querySelector) return container.querySelector(`#${id}`);
  return document.getElementById(id);
},
```

### Uso nos widgets

No topo de cada controller:

```js
const $id = (id) => window.MyIOUtils.$id(self.ctx, id);
```

### Substituições

- WATER: remover `function $id(id) { ... }` e usar o wrapper acima.
- ENERGY: substituir `document.getElementById('...')` por `$id('...')`.

---

## A.2 `MyIOUtils.addListenerBoth(eventName, handler, options?) -> cleanupFn`

### Problema que resolve

- Evita duplicação `window` + `window.parent` e centraliza o cleanup.
- Padroniza o comportamento entre widgets (e reduz leaks por listeners não removidos).

### Assinatura (JS)

```js
addListenerBoth: (eventName, handler, options) => {
  window.addEventListener(eventName, handler, options);
  if (window.parent && window.parent !== window) {
    window.parent.addEventListener(eventName, handler, options);
  }
  return () => {
    window.removeEventListener(eventName, handler, options);
    if (window.parent && window.parent !== window) {
      window.parent.removeEventListener(eventName, handler, options);
    }
  };
},
```

### Padrão de uso recomendado nos widgets

- Criar um array `cleanupFns` no escopo do widget.
- Em `onInit`, sempre “limpar antes de registrar de novo”.
- Em `onDestroy`, chamar todas as cleanups.

```js
let cleanupFns = [];
function cleanupAll() {
  cleanupFns.forEach((fn) => {
    try { fn(); } catch (e) {}
  });
  cleanupFns = [];
}
```

No registro:

```js
cleanupFns.push(window.MyIOUtils.addListenerBoth('myio:filter-applied', onFilterApplied));
```

---

## A.3 `MyIOUtils.onOrchestratorReady(cb, opts?) -> cleanupFn`

### Problema que resolve

- Substitui polling (ENERGY) e retries (WATER).
- Usa a fonte de verdade do `MAIN`: evento `myio:orchestrator:ready` + `MyIOOrchestrator.isReady`.

### Assinatura (JS)

```js
onOrchestratorReady: (cb, { timeoutMs = 10000 } = {}) => {
  const getOrch = () => window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;

  // Ready immediately?
  const orch = getOrch();
  if (orch?.isReady) {
    cb(orch);
    return () => {};
  }

  let done = false;
  const onReady = () => {
    if (done) return;
    done = true;
    cleanup();
    const orch2 = getOrch();
    if (orch2) cb(orch2);
  };

  const off = window.MyIOUtils.addListenerBoth('myio:orchestrator:ready', onReady);
  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    cleanup();
  }, timeoutMs);

  const cleanup = () => {
    clearTimeout(timer);
    off();
  };

  return cleanup;
},
```

### Uso nos widgets

ENERGY:

```js
cleanupFns.push(window.MyIOUtils.onOrchestratorReady((orch) => orch.requestSummary?.()));
```

WATER (após criar `requestWaterSummary` no Orchestrator):

```js
cleanupFns.push(window.MyIOUtils.onOrchestratorReady((orch) => orch.requestWaterSummary?.()));
```

---

## A.4 `MyIOUtils.openConsumptionFullscreen(params) -> Promise<{ modal }>`

### Problema que resolve

- Remove duplicação `openFullscreenModal()` em ENERGY e WATER.
- Centraliza defaults (period/type/vizMode) e o uso de `initialData` (cache do chart).

### Contrato sugerido

- O helper **não** guarda estado global do widget; ele retorna a instância do modal.
- O widget define `onClose` para limpar flags locais (`isChartFullscreen`, etc.).

### Assinatura (JS)

```js
openConsumptionFullscreen: async ({
  domain,
  title,
  unit,
  decimalPlaces = 1,
  chartConfig,
  cachedChartData,
  consumptionChartInstance,
  fetchData,
  theme = 'light',
  showSettingsButton = false,
  onClose,
}) => {
  if (!window.MyIOLibrary?.createConsumptionModal) {
    throw new Error('MyIOLibrary.createConsumptionModal not available');
  }

  const initialData = cachedChartData || consumptionChartInstance?.getCachedData?.() || null;

  const modal = window.MyIOLibrary.createConsumptionModal({
    domain,
    title,
    unit,
    decimalPlaces,
    defaultPeriod: chartConfig?.period || 7,
    defaultChartType: chartConfig?.chartType || 'line',
    defaultVizMode: chartConfig?.vizMode || 'total',
    theme,
    showSettingsButton,
    fetchData,
    initialData,
    onClose,
  });

  await modal.open();
  return { modal };
},
```

### Uso nos widgets

ENERGY:

```js
fullscreenModalInstance = (await window.MyIOUtils.openConsumptionFullscreen({
  domain: 'energy',
  title: 'Consumo de Energia',
  unit: 'kWh',
  decimalPlaces: 1,
  chartConfig,
  cachedChartData,
  consumptionChartInstance,
  fetchData: fetchEnergyConsumptionDataAdapter,
  onClose: () => { fullscreenModalInstance = null; isChartFullscreen = false; },
})).modal;
```

WATER:

```js
fullscreenModalInstance = (await window.MyIOUtils.openConsumptionFullscreen({
  domain: 'water',
  title: 'Consumo de Água',
  unit: 'm³',
  decimalPlaces: 1,
  chartConfig,
  cachedChartData,
  consumptionChartInstance,
  fetchData: fetchWaterConsumptionDataAdapter,
  onClose: () => { fullscreenModalInstance = null; isChartFullscreen = false; },
})).modal;
```

---

## A.5 (Opcional) `MyIOUtils.createTTLCache(ttlMs)`

### Problema que resolve

WATER tem cache de cards (`totalConsumptionCache`) com TTL; se for manter cache local, pode virar helper genérico.

### Assinatura (JS)

```js
createTTLCache: (ttlMs) => {
  let value = null;
  let ts = 0;

  return {
    get: () => (value && Date.now() - ts < ttlMs ? value : null),
    set: (v) => { value = v; ts = Date.now(); },
    clear: () => { value = null; ts = 0; },
  };
},
```

---

# Parte B — Funções a criar/ajustar no `window.MyIOOrchestrator` (no MAIN)

## B.1 `requestSummary()` (já existe) — manter

ENERGY chama `requestSummary()` para emitir `myio:energy-summary-ready`. Isso já está implementado no `MAIN` e deve ser preservado para compatibilidade.

## B.2 `requestWaterSummary()` (novo)

### Problema que resolve

- WATER hoje dispara `myio:request-water-data`, mas não existe handler oficial no `MAIN`.
- O `MAIN` já calcula e emite `myio:water-summary-ready` durante o fluxo normal, porém:
  - Widgets podem carregar “tarde” e perder o evento.
  - O widget precisa de uma forma oficial de solicitar o summary “sob demanda”, como o ENERGY faz.

### Contrato

- `requestWaterSummary()` recalcula o summary usando dados já carregados em memória (cache interno do Orchestrator / `window.MyIOOrchestratorData` / estruturas já usadas no `MAIN`).
- Se não houver dados suficientes ainda, deve logar `warn` e retornar sem emitir evento (mesmo padrão do ENERGY).

### Pseudocódigo (estrutura)

```js
requestWaterSummary: () => {
  const cached = window.MyIOOrchestratorData?.water;
  const items = cached?.items || cached?.data || null;
  if (!Array.isArray(items) || items.length === 0) {
    LogHelper.warn('[Orchestrator] requestWaterSummary: No water data cached yet');
    return;
  }

  // Aplicar regras de exclusão (ex.: "entrada") conforme as regras atuais do MAIN
  const itemsExcludingEntrada = items.filter((item) => !isWaterEntradaDevice(item) && item._classification !== 'entrada');

  // Calcular totals e breakdown por tipo e por shopping
  // (replicar a lógica já existente no MAIN onde emite myio:water-summary-ready)

  window.dispatchEvent(new CustomEvent('myio:water-summary-ready', { detail: waterSummary }));
},
```

> Nota: a melhor implementação é **reaproveitar** a função/trecho que o `MAIN` já usa para emitir `myio:water-summary-ready`, extraindo isso para um helper interno `buildWaterSummary(items)` e usando tanto no fluxo automático quanto no `requestWaterSummary()`.

## B.3 (Opcional) `requestDomainSummary(domain)`

Para padronizar a API:

```js
requestDomainSummary: (domain) => {
  const d = String(domain || '').toLowerCase();
  if (d === 'energy') return window.MyIOOrchestrator.requestSummary?.();
  if (d === 'water') return window.MyIOOrchestrator.requestWaterSummary?.();
},
```

---

# Parte C — Alterações nos widgets (trechos que passam a chamar as funções extraídas)

## C.1 ENERGY — `src/MYIO-SIM/v5.2.0/ENERGY/controller.js`

### C.1.1 Padronizar `$id` (TB compat)

Adicionar próximo ao topo (após `LogHelper`):

```js
const $id = (id) => window.MyIOUtils.$id(self.ctx, id);
```

Substituir usos de `document.getElementById(...)` por `$id(...)` (ex.: `initializeTotalConsumptionStoresCard`, `initializeTotalConsumptionEquipmentsCard`, etc.).

### C.1.2 Substituir polling por `onOrchestratorReady`

Remover a função/bloco `waitForOrchestratorAndRequestSummary` e o `setInterval` (hoje próximo do final do `onInit`).

Substituir por:

```js
cleanupFns.push(window.MyIOUtils.onOrchestratorReady((orch) => {
  orch.requestSummary?.();
}));
```

### C.1.3 Centralizar listeners window+parent com cleanup

Trocar registros como:

- `window.addEventListener('myio:energy-summary-ready', ...)` + duplicado no `window.parent`
- `myio:filter-applied`
- `myio:equipment-metadata-enriched`

por:

```js
cleanupFns.push(window.MyIOUtils.addListenerBoth('myio:energy-summary-ready', registeredHandlers.handleEnergySummary));
cleanupFns.push(window.MyIOUtils.addListenerBoth('myio:filter-applied', registeredHandlers.handleFilterApplied));
cleanupFns.push(window.MyIOUtils.addListenerBoth('myio:equipment-metadata-enriched', registeredHandlers.handleEquipmentMetadataEnriched));
```

E no `onDestroy` chamar `cleanupAll()` antes de resetar estado.

### C.1.4 Fullscreen modal via helper

Substituir o corpo de `openFullscreenModal()` por `MyIOUtils.openConsumptionFullscreen(...)` e manter apenas o estado local (`fullscreenModalInstance`, `isChartFullscreen`) no widget.

### C.1.5 Remoção do fullscreen legacy (após estabilização)

Após validar o modal RFC-0098 em produção, remover o “fullscreen overlay legacy” (HTML/CSS + handlers) do ENERGY.

---

## C.2 WATER — `src/MYIO-SIM/v5.2.0/WATER/controller.js`

### C.2.1 Remover `$id` local e usar `MyIOUtils.$id`

Remover:

- `function $id(id) { ... }`

Adicionar:

```js
const $id = (id) => window.MyIOUtils.$id(self.ctx, id);
```

### C.2.2 Parar de emitir `myio:request-water-data` e consumir summary

Hoje o WATER:

- Em `onInit`, dispara `myio:request-water-data` e faz retries.
- Em `handleDateUpdate`, dispara `myio:request-water-data`.

Plano:

1. **Criar `MyIOOrchestrator.requestWaterSummary()` no `MAIN`.**
2. **No WATER**, substituir o fluxo por:

```js
cleanupFns.push(window.MyIOUtils.onOrchestratorReady((orch) => {
  orch.requestWaterSummary?.();
}));
```

3. Trocar o listener principal para `myio:water-summary-ready`:

```js
cleanupFns.push(window.MyIOUtils.addListenerBoth('myio:water-summary-ready', handleWaterSummaryReady));
```

Onde `handleWaterSummaryReady` atualiza cards/charts com o summary:

- `storesTotal` ← `ev.detail.stores`
- `commonAreaTotal` ← `ev.detail.commonArea`
- `totalGeral` ← `ev.detail.filteredTotal` (ou `unfilteredTotal` conforme regra de UI)
- `shoppingsWater` se necessário para gráficos “por shopping”

4. Manter `myio:water-data-ready` somente se houver dependência real do `cache Map` para algo específico. Caso não, remover o handler e simplificar.

### C.2.3 Date/filter refresh

Ao invés de emitir um evento custom inexistente no MAIN, chamar o Orchestrator:

```js
function handleDateUpdate() {
  initializeCards();
  const orch = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
  orch?.requestWaterSummary?.();

  // Se a mudança de data realmente altera o período do chart (7/14/30),
  // chame o API do componente:
  // consumptionChartInstance?.setPeriod?.(chartConfig.period)
  // ou consumptionChartInstance?.refresh?.(true)
}
```

### C.2.4 Fullscreen modal via helper

Substituir `openFullscreenModal()` pelo helper, igual ao ENERGY.

### C.2.5 Remover fallback 60/40 (depois de `requestWaterSummary`)

O fallback 60/40 em `handleWaterDataReady` deve ser eliminado após o WATER consumir `myio:water-summary-ready` ou `requestWaterSummary()` fornecer totais corretos.

---

# Parte D — Checklist operacional (PRs sugeridos)

## PR 1 — Infra de Utils (sem mudar lógica)

- [ ] Adicionar em `MAIN`: `MyIOUtils.$id`, `MyIOUtils.addListenerBoth`.
- [ ] Atualizar WATER para usar `MyIOUtils.$id` (sem alterar fluxo de dados).
- [ ] Atualizar ENERGY para usar `$id` e reduzir `document.getElementById`.
- [ ] Validar que widgets continuam renderizando normalmente.

## PR 2 — Orchestrator Ready (trocar polling/retries)

- [ ] Adicionar em `MAIN`: `MyIOUtils.onOrchestratorReady`.
- [ ] Atualizar ENERGY: remover `waitForOrchestratorAndRequestSummary` e usar `onOrchestratorReady`.
- [ ] Validar que `myio:energy-summary-ready` chega mesmo com carregamento tardio.

## PR 3 — Water summary “sob demanda” (corrigir request-water-data)

- [ ] Adicionar em `MAIN`: `MyIOOrchestrator.requestWaterSummary`.
- [ ] Atualizar WATER para escutar `myio:water-summary-ready` e parar de emitir `myio:request-water-data`.
- [ ] Remover retries `setTimeout` no `onInit`.
- [ ] Validar cards + charts (incluindo filtro e mudança de período).

## PR 4 — Fullscreen modal unificado (RFC-0098)

- [ ] Adicionar em `MAIN`: `MyIOUtils.openConsumptionFullscreen`.
- [ ] Atualizar ENERGY/WATER para usar helper.
- [ ] Após estabilização, remover fullscreen legacy overlay nos dois widgets.

---

# Parte E — Riscos e validações

## Riscos

- Widgets podem carregar antes de `window.MyIOUtils` estar definido (ordem de scripts).
  - Mitigação: manter fallback local mínimo (como ENERGY faz para `LogHelper`) ou checar `window.MyIOUtils` antes de usar e logar erro claro.
- Diferenças de regra de “total” (ex.: água exclui `entrada`).
  - Mitigação: centralizar cálculo no Orchestrator e tratar WATER como consumidor “burro” do summary.
- Duplicação de listeners se `onInit` rodar mais de uma vez.
  - Mitigação: padronizar `cleanupAll()` no começo do `onInit` e no `onDestroy`.

## Smoke tests manuais sugeridos

- Abrir dashboard com ENERGY e WATER e confirmar que:
  - Cards saem de loading sem reload.
  - Filtro de shopping (`myio:filter-applied`) atualiza charts.
  - Fullscreen abre e fecha; ao fechar, não deixa listeners pendurados (reabrir várias vezes).
  - WATER atualiza totals corretamente (sem 60/40).
  - Trocar período (7/14/30) e validar que o chart refaz fetch/refresh.
