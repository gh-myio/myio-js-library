# Showcase — Central Status Card (RFC-0231)

## 1. Quick start

```bash
npm run build                # generates dist/myio-js-library.umd.min.js
./showcase/central-status-card/start-server.bat   # or start-server.sh
```

```
open http://localhost:3343/showcase/central-status-card/
```

Stop with `stop-server.bat` / `stop-server.sh` (kills whatever is listening on port 3343).

## 2. File manifest (everything in this folder)

| File | Purpose |
|---|---|
| `index.html` | The showcase page — mounts 6 sample centrals × 2 variants (`card` grid + `compact` row list), mock async callbacks, event log |
| `start-server.bat` / `.sh` | Serves the **repo root** on port 3343 (so `../../dist/...` resolves) and opens the showcase |
| `stop-server.bat` / `.sh` | Kills whatever is listening on port 3343 |

## 3. External dependencies

- `../../dist/myio-js-library.umd.min.js` — the UMD build (must run `npm run build` first). Exposes `window.MyIOLibrary.createCentralStatusCard`.
- No other runtime dependency — the card is vanilla DOM, no Chart.js/React needed.

## 4. `index.html` — what it demonstrates

- **Legend section** at the top of the page (`#legendSection`) — see §6 below. Its swatches use the library's own injected CSS (`[data-status]`/`[data-connectivity]` selectors), so it cannot silently drift from what the live cards actually render.
- **Both variants** (`variant: 'card'` full grid + `variant: 'compact'` row-dense) for 8 sample centrals, covering every `connectivity` value (`ONLINE`/`WARNING`/`OFFLINE`/`UNKNOWN`), a monitoring-OFF/stale sample, one sample with `showDivergence`, one driven by `connectivityEvidence` + `offlineHardMs` (the "OFFLINE 2h30min" badge), and one `entityStatus: 'DELETED'` sample.
- **Controls bar**: theme toggle (light/dark, calls `handle.setThemeMode`), a **Language** toggle (`pt`/`en`, calls `handle.update({ language })` — pt is the library default), callback delay, a **"Force reject"** checkbox that makes every `onMonitoringToggle`/`onStatusToggle` mock reject — demoing the revert-on-reject + local error path —, a `confirmStatusActivate` toggle, and **`enableSelection`/`enableDragDrop`** toggles that call `handle.update(...)` on every mounted card — see §8.
- **Mock callbacks** (`mockToggle`/`mockForceSync`/`mockFetchTimeline`/`mockAction`) resolve/reject after the configured delay and log the exact event object received — nothing here is real GCDR/cockpit wiring, this showcase only exercises the card's own UI/confirm/optimistic-state contract.
- **Timeline (📈)** wired on samples `c1`/`c3` — see §7.
- **Selection/drag/click/action-row** wired globally (`onSelectChange`/`onClickCard` on every sample) plus per-sample action-row callbacks (`c1` has all 3, `c6` has just `onOpenReport`) and `c2` pre-`selected: true` — see §8.
- **Guard**: logs an error if `MyIOLibrary.createCentralStatusCard` is missing (forgot to `npm run build`).

## 5. Server scripts

Same convention as `showcase/loading-spinner/` and `showcase/main-view-shopping/`: the script `cd`s two levels up to the repo root, runs `npx serve . -p 3343`, and opens the showcase URL. Port **3343** (3333 = loading-spinner, 3339 = main-view-shopping).

## 6. Guia visual (legenda de cores)

O card usa **dois eixos de cor independentes** — não confundir um com o outro:

| Eixo | O que representa | Onde aparece |
|---|---|---|
| **Borda do card** | `entityStatus` — o ciclo de vida do **cadastro** (registro) | Borda inteira do `<article>` |
| **Header + badge de conectividade** | `connectivity` — a **saúde ao vivo** (derivada por `deriveCentralConnectivity` ou passada pelo host) | Faixa atrás do título + chip na linha "conectividade" |

### Borda (cadastro / `entityStatus`)

| Valor | Cor | Efeito |
|---|---|---|
| `ACTIVE` | Verde | "3D" — `box-shadow` em camadas (glow + realce), não é só uma borda plana |
| `INACTIVE` | Cinza | Flat, sem glow |
| `DELETED` | Cinza | Igual a `INACTIVE` hoje — comportamento final (desabilitar switch? badge próprio?) ainda **não definido**, ver `types.ts` |

### Header + badge (saúde / `connectivity`)

| Valor | Cor | Quando acontece |
|---|---|---|
| `ONLINE` | Azul | Última tentativa foi sucesso |
| `WARNING` | Amarelo sutil | Falhando, mas ainda dentro de `offlineGraceMs` |
| `OFFLINE` | Vermelho sutil | Falhando além de `offlineGraceMs`. Se `offlineHardMs` estiver configurado e a falha já durar mais que isso, o badge ganha um sufixo de duração: **"OFFLINE 2h30min"** |
| `UNKNOWN` | Cinza sutil | Nunca sincronizada (sem `lastSuccessAt`) |

### Indicadores extras

| Indicador | Onde | Significado |
|---|---|---|
| Badge **"desatualizado"/"stale"** | Ao lado do badge de conectividade | `monitoringEnabled: false` — o estado mostrado é o último conhecido, **congelado** (não decai pra OFFLINE só porque o tempo passou) |
| Ícone **⚠️** com tooltip | Ao lado do badge de conectividade | `showDivergence` — o valor persistido (`divergence.current`) diverge do valor calculado pelo worker (`divergence.proposed`); hover/clique abre o tooltip com "atual → proposto" |
| **Dots coloridos** na linha "dispositivos" | Linha "dispositivos" | `total` (cinza) · `online` (azul) · `offline` (vermelho) · `unknown` (cinza) — números continuam como texto real e visível, as cores só reforçam |
| **Setinha de tendência** (↑ ▬ ↘) na linha "teste de conexão" | Ao lado do `Xms` | Compara com o `latencyMs` do render anterior (rastreado internamente, o host não precisa calcular delta): **↑ verde** = mais rápido (>100ms de melhora), **▬ preta** = dentro de ±100ms (sem mudança relevante), **↘ vermelha diagonal** = mais lento (>100ms de piora). Sem indicador na primeira leitura (nada pra comparar ainda) |

> Esta tabela é a versão .md da seção **"Legenda — como ler o card"** no topo de `index.html`. Se um dos dois divergir do outro (ou do CSS real em `styles.ts`), um dos três está desatualizado — a fonte de verdade final é sempre `src/components/cards/central-status/v1.0.0/styles.ts`.

## 7. Timeline de conectividade (📈)

Porta a feature que o card antigo (`createDivCard`-based) tinha — o botão 📈 ao lado do 🔄
(Atualizar evidência) na linha Monitoramento. Estava órfão na branch nova (modal/endpoint
vivos na página, mas `createCentralStatusCard` sem slot de ações) — agora está implementado
em `TimelineModal.ts` e exportado como `MyIOLibrary.openCentralTimelineModal`.

### Acesso

O botão **só aparece se `timeline` for passado** ao criar o card (mesma filosofia de
`showForceSync`/`showDivergence` — omitir esconde a feature inteira, não deixa um botão morto).
Clicar abre a modal **"Timeline de conectividade — {nome da central}"** com um seletor de
período: 24h / 7 dias / 30 dias (default) / 90 dias.

### Como conectar ao GCDR

Dois jeitos, mesmo princípio do resto do card ("auth é responsabilidade do host"):

```js
MyIOLibrary.createCentralStatusCard({
  id: 'ID-do-gateway-no-GCDR', // mesmo id usado nos outros eventos do card
  name: 'Central Campinas Shopping G1 G2',
  // ...demais props...
  timeline: {
    // Opção 1 — o card monta a URL e chama fetch() ele mesmo:
    baseUrl: 'https://gcdr.exemplo.com',
    // path default: '/admin/orchestrator-devices/api/centrals/:id/timeline'
    // ':id' é substituído pelo `id` do card acima.
    path: '/admin/orchestrator-devices/api/centrals/:id/timeline', // opcional, é o default
    fetchOptions: { headers: { 'X-Api-Key': 'SEU_TOKEN_ADMIN' } }, // repassado ao fetch() sem alteração
    periods: [1, 7, 30, 90], // opcional, é o default (24h/7d/30d/90d)
    defaultDays: 30, // opcional, é o default

    // Opção 2 — escape hatch: você faz o fetch (outro transporte, cache, etc.)
    // onFetchTimeline: ({ id, days }) => Promise<CentralTimelineResponse>,
  },
});
```

A URL final fica `{baseUrl}{path com :id substituído}?days=N` — ex.:
`https://gcdr.exemplo.com/admin/orchestrator-devices/api/centrals/ID-do-gateway-no-GCDR/timeline?days=30`.
Se `onFetchTimeline` for passado, ele tem prioridade total sobre `baseUrl`/`path`/`fetchOptions`.

### Fonte de dados (contrato do endpoint)

`GET {baseUrl}{path}?days=N` (N entre 1 e 365) deve devolver:

```ts
{
  transitions: Array<{
    from_status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';
    to_status:   'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';
    probe_result: string | null; // sinal causador, ex. "TIMEOUT" — null quando não aplicável
    mode: 'shadow' | 'canonical';
    created_at: string; // ISO
  }>;
  segments: Array<{
    status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';
    start: string; // ISO
    end: string;   // ISO
    durationMs: number;
  }>;
}
```

Fonte real (desenv): tabela `orchestrator_devices_status_history` (migration 0072) —
**append-on-change**, uma linha por transição de status, nunca por tick. Não é podada pela
retenção do ledger (7d) — é o histórico de longo prazo. A reconstrução de `segments` contínuos
a partir das transições cruas **acontece no servidor** (o endpoint já devolve os segmentos
prontos); este componente só renderiza o que recebe, não re-deriva nada no cliente.

### ⚠️ Vocabulário diferente do resto do card

`ONLINE`/`DEGRADED`/`OFFLINE`/`UNKNOWN` aqui é o vocabulário do **worker/histórico**
(`CentralTimelineStatus`) — **não é o mesmo union** que `CentralConnectivity`
(`ONLINE`/`OFFLINE`/`WARNING`/`UNKNOWN`) usado no resto do card. Não existe "OFFLINE 2h30min"
no histórico: o estágio hard-offline é uma derivação de **exibição** (`deriveCentralConnectivity`
+ `offlineHardMs`), não um estado gravado. Misturar os dois vocabulários é exatamente o tipo de
drift que a RFC-0231 nasceu para matar — por isso são tipos TypeScript **distintos e não
conversíveis** de propósito.

### Renderização

- **Legenda de 4 estados** — cores acompanham o esquema novo do card (§6), **não** o verde
  legado do card antigo: `ONLINE` azul · `DEGRADED` (rotulado **"ATENÇÃO"** em pt / **"DEGRADED"**
  em en) âmbar · `OFFLINE` vermelho · `UNKNOWN` (rotulado **"DESCONHECIDO"** em pt) cinza.
- **Barra horizontal empilhada** (`.myio-tlmodal__bar`, 26px) — um bloco por segmento, largura
  proporcional à duração, com **piso de 0,3%** (renormalizado para a soma continuar em 100%) pra
  blips curtos não sumirem visualmente. Hover mostra "ATENÇÃO · 01/09 03:28 → 01/09 11:27 (8h)".
- **Lista de transições**, mais recente primeiro: "ONLINE → OFFLINE · 01/09 16:52 · TIMEOUT ·
  shadow". Sem transições no período: "Sem transições registradas nesse período."
- **Nota de shadow**: "Em shadow, reflete o estado proposto; canônico quando ativo." — sempre
  visível abaixo da lista.
- Erro de fetch mostra uma mensagem + botão "Tentar novamente" no lugar da barra/lista; o
  seletor de período continua funcional.

### i18n

Segue o mesmo `language: 'pt' | 'en'` do card (default `'pt'`) e aceita os mesmos overrides via
`labels` (`timelineModalTitle`, `timelineLegend`, `timelineEmptyState`, `timelineShadowNote`,
`timelineFetchError`, `timelineRetry`, `timelineLoading`, `timelinePeriodLabels`,
`timelineButton`). `{name}` é interpolado em `timelineModalTitle`.

### Na showcase

Samples **c1** (Campinas) e **c3** (Montserrat) têm `timeline` wireado com um `onFetchTimeline`
mockado (`mockFetchTimeline()`) que fabrica uma história plausível (maioria ONLINE, um blip
DEGRADED, uma queda OFFLINE real) proporcional ao período pedido — não é GCDR de verdade, só
exercita o contrato UI/fetch/render do componente.

## 8. Seleção, drag-and-drop, clique no card e coluna de ações (📊/📄/⚙️)

Inspirado em `src/components/cards/main-view/v6.0.0` (o card de dispositivo com checkbox de
seleção, `draggable` e os 3 botões piano-key de ação) — portado para o vocabulário deste card,
**sem** importar `MyIOSelectionStore`.

### Layout (3ª revisão — histórico das anteriores abaixo)

O layout passou por 3 rodadas de feedback até chegar no estado atual. Documentando a versão
**atual primeiro**, depois o histórico (pra ninguém confundir com uma versão velha):

**Estado atual:**

- **Checkbox de seleção inline no header**, ao lado do nome da central — não é mais uma linha
  própria abaixo do título nem um overlay `position:absolute` no canto. Ocupa o mesmo lugar onde
  o (i) costumava ficar. Ficou ali de propósito: é o "âncora" que um futuro **footer de
  comparação entre cards de central** vai ler (`selected`/`onSelectChange`).
- **(i) do título mudou pra ao lado do label "Status"** (dentro da linha `.myio-cscard__status`,
  que agora é só mais uma linha do bloco único — ver §"Operação/Cadastro" mais abaixo).
- **Coluna de ações à esquerda** (`.myio-cscard__actioncol`) — mesmo papel visual do
  `.card-actions` do v6.0.0: uma tira vertical à esquerda do card inteiro (fora do
  `.myio-cscard__content`, que é um irmão dela), só renderizada se pelo menos um de
  `onOpenDashboard`/`onOpenReport`/`onOpenSettings` for passado. `gap` entre os 3 botões: 10px
  (era 2px, ficava apertado demais).
- **`min-height: 230px`** no variant `card` — sem isso, linhas opcionais (teste de conexão,
  dispositivos, divergência, badge "stale") faziam a altura variar muito de card pra card, e um
  grid deles ficava visualmente quebrado (uns bem mais baixos que os vizinhos). `compact` não
  leva min-height — é uma linha densa, não um tile de grid.
- **Fonte reduzida em geral** — título 14px→13px, linhas 12.5px→11.5px, badge 11px→10px, switch
  34px→30px, etc. — pra abrir espaço pra coluna de ações sem o card crescer de largura.

**Histórico (não reflete o card de hoje):**

1. Checkbox como overlay `position:absolute` no canto superior direito; botões de ação dentro do
   header; (i) no header ao lado do título.
2. Checkbox virou linha própria (`.myio-cscard__selectrow`) abaixo do título; botões migraram
   pra coluna à esquerda; (i) migrou pra ao lado do label "Cadastro" (bloco de registro).
3. **(atual)** Checkbox voltou pro header (inline, sem linha própria); (i) migrou de novo, agora
   pra ao lado de "Status" — porque o bloco "Cadastro" em si deixou de existir (ver abaixo).

### Operação/Cadastro — removido

A separação em dois blocos com cabeçalho (`OPERAÇÃO`/`CADASTRO`), que a RFC-0231 original
defendia explicitamente, **foi removida** por feedback direto ("não vejo motivo de separação...
remova isso para deixar mais limpo"). Hoje é **um bloco único** (`.myio-cscard__block`, sem
`--operation`/`--registry`, sem header de seção) com todas as linhas na mesma ordem de antes:
conectividade → Monitoramento → evidências → dispositivos → Status. `labels.operationBlock` e
`labels.registryBlock` foram removidos do tipo `CentralStatusCardLabels` (nada mais os
renderizava).

### ⚠️ Por que sem `MyIOSelectionStore`

O v6.0.0 usa `import { MyIOSelectionStore } from '../../../SelectionStore.js'` — um **singleton
eager, acoplado a `document`/`window`** (cria/recupera uma instância cross-window via
`window.top.__MyIOSelectionStore_INSTANCE__` já no construtor). Importar isso aqui faria o
`CentralStatusCard` — pensado pra ser portável entre o cockpit GCDR e a lista de centrais do
cliente, hosts potencialmente sem esse global — depender implicitamente do conceito de "carrinho
de relatório" do dashboard de shopping. Além disso esse módulo **já quebra builds Node/SSR**
hoje (`document is not defined` — é literalmente a causa dos smoke-tests que já estavam
falhando antes de eu mexer em qualquer coisa aqui, achado incidental durante esse trabalho, não
corrigido por estar fora do escopo desta feature).

Em vez disso, o card oferece a **mesma forma de feature** via props host-controlled, no mesmo
princípio de `monitoringEnabled`/`onMonitoringToggle`:

```js
MyIOLibrary.createCentralStatusCard({
  // ...props de identidade/estado...
  enableSelection: true,   // mostra a linha de checkbox abaixo do título
  selected: false,         // estado controlado pelo host (não interno ao card)
  onSelectChange: (e) => { /* { id, selected, source } */ },

  enableDragDrop: true,    // draggable="true" + dragstart

  onClickCard: (e) => { /* { id, source } — ignorado se o clique começou num switch/botão/checkbox */ },

  // Coluna de ações à esquerda do card — cada botão só aparece se o callback for passado
  onOpenDashboard: (e) => { /* 📊 */ },
  onOpenReport:    (e) => { /* 📄 */ },
  onOpenSettings:  (e) => { /* ⚙️ */ },
});
```

Se você **precisa** de seleção cross-card sincronizada com o `MyIOSelectionStore` real, chame
`MyIOSelectionStore.add(id)`/`.remove(id)` dentro do seu próprio `onSelectChange`, e leia
`MyIOSelectionStore.isSelected(id)` para popular `selected` — o card não sabe nem precisa saber
que esse store existe.

### Payload de drag idêntico ao v6.0.0

`dragstart` grava as mesmas 3 chaves no `dataTransfer` que o card antigo grava — qualquer
drop-zone já construída pra aceitar cards v6.0.0 aceita este sem alteração:

| Chave | Valor |
|---|---|
| `text/myio-id` | `id` do card |
| `application/json` | `{ id, name }` (JSON) |
| `text/myio-name` | `name` do card |

### Anel de seleção não conflita com a borda de status

`selected` usa `outline` (não `box-shadow`) — propriedade CSS independente, então o anel violeta
de seleção aparece **junto** com o glow verde 3D de `ACTIVE` (§6) sem um sobrescrever o outro.

### Detalhe de implementação (bug evitado)

Os listeners de `dragstart`/`click` no elemento raiz são ligados **uma única vez**, no
construtor — não a cada `render()`. `render()` reconstrói `innerHTML` inteiro a cada
`update()`/toggle, e um listener no elemento raiz (que **sobrevive** a esse rebuild, ao contrário
dos filhos) ligado dentro do método de render acumularia um handler duplicado por render,
disparando `onClickCard` N vezes após N atualizações. Testado explicitamente
(`tests/components/cards/central-status/centralStatusCard.test.ts`, describe "drag and drop").

### Na showcase

- Toggles globais **`enableSelection`**/**`enableDragDrop`** na barra de controles chamam
  `handle.update(...)` em todos os cards montados.
- **c1** tem os 3 botões de ação (`onOpenDashboard`/`onOpenReport`/`onOpenSettings`); **c6** tem
  só `onOpenReport` — demonstra o gating independente por callback.
- **c2** nasce com `selected: true` — ligue `enableSelection` pra ver o anel violeta.
- `onSelectChange`/`onClickCard` estão wireados em toda amostra, só logando no painel de eventos.
- **c1** tem `onOpenDashboard` abrindo o `GatewayModal` de verdade (§9), não só logando.

## 9. GatewayModal — "gráfico de Centrais" (📊)

**Reescrito (RFC-0231, follow-up)** para espelhar **bem, bem parecido mesmo** o modal de gráfico
de temperatura que roda em produção hoje — `src/components/temperature/TemperatureModal.ts`
(confirmado como a referência real via `handleActionDashboard` em
`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`, não o
`TemperatureSettingsModal.ts`, que é um formulário sem gráficos). Vive em
`src/components/premium-modals/gateway/` (`GatewayModal.ts` + `utils.ts` + barrel `index.ts`),
exportado como `MyIOLibrary.openGatewayModal`. A versão anterior (baseada em `openGenericModal`
do `TimelineModal.ts`, com seletor de período 24h/7d/30d/90d) foi **substituída por completo** —
não é mais compatível: a assinatura do `source` mudou (veja abaixo).

### Fidelidade ao `TemperatureModal.ts`

Port quase 1:1, seção por seção: mesmo `ModalState`, mesmo `renderModal()` reconstruindo o
`innerHTML` inteiro a cada mudança de estado, mesmo `drawChart`/`setupChartTooltip` desenhados à
mão em `<canvas>`, mesmo `createDateRangePicker` como controle de período, mesmo dropdown
multi-select de Período do Dia (madrugada/manhã/tarde/noite), mesmo select de Granularidade
(hora/dia), mesmo tema persistido em `localStorage`, mesmo export CSV via `Blob`+`<a download>`,
mesmo `ModalHeader.generateInlineHTML` para o cabeçalho. Onde a temperatura tem uma faixa
ideal (verde, min/max), o Gateway tem uma linha tracejada de **SLA** (`targetLatencyMs`) com uma
faixa "em risco" vermelha acima dela.

### Card "Disponibilidade" + Exportar PDF

5º stats card, ao lado de "Alvo (SLA)": `% online` (colorido — verde ≥99%, amarelo ≥95%,
vermelho abaixo) e `Xh offline (Y%)` do período consultado, via
`calculateUptimeStats(stats, startTs, endTs)` (`src/components/premium-modals/gateway/utils.ts`).
**É uma estimativa proporcional**, não uma integral contínua de tempo: `offlineFraction = gaps /
(count + gaps)`, escalada sobre as horas totais do período — não sabe quanto durou cada gap
individual, só a proporção de leituras que falharam. Mostra "N/A" quando não há nenhuma leitura
amostrada no período (não confundir com "100% online").

Botão **"📄 Exportar PDF"** ao lado do CSV (`src/components/premium-modals/gateway/exportGatewayPdf.ts`),
mesmo padrão "PDF premium" já usado em `header-annotations-panel/ExportPDF.ts` (jsPDF, A4
retrato, cursor manual, capa + seções + rodapé com número de página) — trocando o roxo `#4c3aac`
daquela referência pelo roxo de marca do RFC-0231, `#3e1a7d` (helpers compartilhados em
`gateway/pdfLayout.ts`, reaproveitados pela comparação — item 10). Uma seção lista latência
(atual/média/min/max/SLA), outra a disponibilidade estimada, e o gráfico é embutido como imagem
via `canvas.toDataURL('image/png')` + `doc.addImage(...)`.

### Como conectar

```js
MyIOLibrary.openGatewayModal({
  id: 'ID-do-gateway-no-GCDR',
  name: 'Central Campinas Shopping G1 G2',
  theme: 'dark',              // opcional, default 'dark'
  language: 'pt',             // opcional, default 'pt'
  currentLatencyMs: 45,       // opcional — card "Latência Atual"; se omitido, mostra N/A
  targetLatencyMs: 200,       // opcional — card "Alvo (SLA)" + linha tracejada no gráfico
  startDate: '...', endDate: '...',  // opcionais, default = últimos 30 dias
  source: {
    // (a) callback do host — usado na showcase:
    onFetchLatencyHistory: ({ id, startTs, endTs }) => Promise<GatewayLatencyPoint[]>,
    // (b) OU baseUrl+path direto:
    // baseUrl: 'https://gcdr.exemplo.com',
    // path: '/admin/orchestrator-devices/api/centrals/:id/latency', // ?start=&end=
    // fetchOptions: { headers: { 'X-Api-Key': 'SEU_TOKEN_ADMIN' } },
  },
});
```

**Quebra de contrato em relação à versão anterior**: `source.onFetchLatencyHistory` agora recebe
`{ id, startTs, endTs }` (ms epoch, janela explícita), não mais `{ id, days }` — mesma forma que
o `dataFetcher(startTs, endTs)` do `TemperatureModal.ts`.

`GatewayLatencyPoint` continua `{ ts: string /* ISO */; latencyMs: number | null }` —
`latencyMs: null` vira gap na linha (não interpola "última leitura conhecida" como a
temperatura faz, para não maquiar uma queda real como saúde contínua).

### Na showcase

O sample **c1** tem `onOpenDashboard` abrindo o `GatewayModal` com `mockFetchLatencyHistory()` —
mesma narrativa do `mockFetchTimeline` (baseline saudável ~35-60ms, pico durante a janela
"DEGRADED", gap durante a janela "OFFLINE"), só que expressa em pontos de latência em vez de
segmentos de conectividade.

## 10. GatewayComparisonModal — comparação de conectividade entre centrais (🔌)

**Novo (RFC-0231, follow-up)**, port quase 1:1 de
`src/components/temperature/TemperatureComparisonModal.ts` para o domínio de latência de
sondagem. Vive em `src/components/premium-modals/gateway-comparison/`
(`GatewayComparisonModal.ts` + `utils.ts` como barrel puro de re-export de `../gateway/utils` +
`index.ts`), exportado como `MyIOLibrary.openGatewayComparisonModal`.

Assim como no `TemperatureComparisonModal.ts` de referência, o cabeçalho é montado à mão inline
(não usa `ModalHeader.generateInlineHTML` — inconsistência deliberada, fiel ao original) e cada
central ganha uma cor própria na legenda/linha do gráfico. SLAs distintos (`targetLatencyMs`
por central) são agrupados (`slaTargets`) e cada valor único ganha sua própria faixa "em risco"
tracejada no gráfico — mesmo princípio do agrupamento de faixas de temperatura ideais do
original.

### Como conectar

```js
MyIOLibrary.openGatewayComparisonModal({
  centrals: [
    { id: 'c1', label: 'Central Campinas Shopping G1 G2', targetLatencyMs: 200 },
    { id: 'c2', label: 'Central Shopping Ananindeua', targetLatencyMs: 200 },
    { id: 'c3', label: 'Central Montserrat' }, // sem SLA definido — ok, fica sem faixa
  ],
  startDate: '...', endDate: '...',
  theme: 'dark',       // opcional
  locale: 'pt-BR',     // opcional, não `language` — 'pt-BR' | 'en-US'
  source: {
    onFetchLatencyHistory: ({ id, startTs, endTs }) => Promise<GatewayLatencyPoint[]>,
  },
  onClose: () => { /* opcional */ },
});
```

Uma central cujo fetch rejeita não derruba o modal inteiro — ela só aparece sem dados (mesmo
comportamento defensivo do original, testado explicitamente).

### Eye toggle (show/hide por central) + KPI Consolidado

Cada stats card por central ganhou um botão 👁️/🙈 (`aria-label` "Mostrar/Ocultar `<central>` na
comparação") — clique alterna `state.hiddenCentrals` (`Set<central.id>`, tudo visível por
padrão): o card dessa central fica com `opacity: 0.4`, sua linha some do gráfico, e ela sai do
agrupamento de faixas SLA. Ocultar todas as centrais mostra uma mensagem no lugar de um gráfico
em branco.

Acima dos cards por central, um card roxo "📊 Consolidado (`N` de `M` visíveis)" — média geral de
latência, **tempo online estimado E tempo offline estimado** (ambos, cada um com seu percentual
ao lado — "661.0h (98.4% online)" / "11.0h (1.6% offline)"), **só das centrais visíveis**,
recomputado a cada clique no olho. Implementação: soma `onlineHours`/`offlineHours` de
`calculateUptimeStats(cd.stats, startTs, endTs)` (item 9) por central visível; como o
online+offline de cada central sempre fecha o período inteiro, `% online consolidado = (soma
online) / (soma online + soma offline)` é exatamente a média das % de cada central, ponderada
igualmente (mesmo período para todas).

Botão **"📄 Exportar PDF"** (`src/components/premium-modals/gateway-comparison/exportGatewayComparisonPdf.ts`) —
mesmo padrão do item 9: KPI consolidado, estatísticas por central (centrais ocultas aparecem
marcadas "(oculta na comparação)", não são omitidas do relatório) e o gráfico comparativo
embutido como imagem.

### Painel de KPIs retrátil (side right bar)

O card "Consolidado" e os cards por central (antes uma faixa horizontal abaixo do gráfico) agora
vivem numa **sidebar direita retrátil** (`state.kpiSidebarOpen`, `true` por padrão, persistida em
`localStorage['myio-gw-comparison-kpi-sidebar']`) — 300px, cards empilhados verticalmente
(`width: 100%` em vez do antigo `min-width: 160px` num `flex-wrap`). Dois toggles equivalentes
(mesmo handler): o ícone 📊 no header (ao lado de tema/maximizar/fechar) e o botão de texto
"📊 Ocultar/Mostrar KPIs" no rodapé, ao lado dos botões de exportar. Fechar a sidebar (`width:
0px`, `transition: width 0.2s`) devolve aquela largura para a coluna do gráfico — o
`drawComparisonChart` é rechamado após o toggle porque ele lê `chartContainer.clientWidth` a cada
desenho, então o gráfico realmente redimensiona, não só "sobra espaço vazio". A legenda de cores
acima do gráfico (nome + latência média de cada central, ponto colorido igual à linha) continua
visível o tempo todo, sidebar aberta ou fechada — é o jeito de identificar as cores das linhas
quando o painel de KPIs está oculto.

### Na showcase

Botão **"Comparar centrais"** na barra de controles (topo) abre o modal comparando 4 das
amostras (`c1`, `c2`, `c3`, `c6`), reaproveitando `mockFetchLatencyHistory()` por `id`. O
fechamento (`onClose`) e cada chamada de fetch são logados no Event Log, como todo o resto da
showcase.

## 11. CentralSettingsModal — configurações da central (⚙️)

**Literalmente `extends SettingsModalView`** (`src/components/premium-modals/settings/SettingsModalView.ts`,
o modal de configurações de **dispositivo**, ~3400 linhas) — decisão explícita: *"CentralSettingsModal
deve estender SettingsModalView e vou pensando em customizações depois"*. Criado em
`src/components/premium-modals/central-settings/`, exportado como
`MyIOLibrary.openCentralSettingsModal` (função) e `MyIOLibrary.CentralSettingsModal` (a classe).

Isso substituiu uma primeira versão que era uma reimplementação independente sobre
`openGenericModal` (2 seções: Identidade + Conectividade, ~300 linhas) — mantida só até esta
mudança de direção.

### Como funciona ("extends" apesar de tudo ser `private`)

`SettingsModalView` não foi desenhada para herança — `container`/`modal`/`form`/`config` são
todos `private`, então uma subclasse não tem acesso direto a eles. `CentralSettingsModal` contorna
isso de duas formas, **sem** editar o arquivo:

1. **`render()`/`close()`/`showError()`/`showLoadingState()`/`getFormData()` são públicos** (sem
   modificador) — pontos de extensão legítimos. `render()` é sobrescrito: chama `super.render()`
   (monta o shell completo do modal de dispositivo) e depois injeta o card "Configuração de
   Conectividade" na tab **Central** (`#gateway-tab-content .gateway-info-grid`, logo depois do
   card somente-leitura "Conectividade (telemetria)"), escopado à instância certa (a última
   `.myio-device-settings-modal` montada no momento do `render()`). Como essa tab não é envolvida
   por `<form>` (só a tab Geral é), `getFormData()` também é sobrescrito — soma o
   `new FormData(this.form)` da base com uma leitura manual dos 3 inputs do card injetado, para
   que eles cheguem no `onSaveSettings` mesmo vivendo fora do form.
2. **`onSave`/`onClose` são reatribuídos depois do `super()`** — o objeto de config passado a
   `super(config)` é a MESMA referência que a classe-base guarda como seu `this.config` privado
   (sem clone). Como `this` só existe depois que `super()` retorna, `CentralSettingsModal` guarda
   uma referência local a esse objeto e reatribui `config.onSave`/`config.onClose` para closures
   que capturam `this` — a base lê `this.config.onSave` só no momento do clique, então pega a
   versão certa.

**Uma 3ª tab própria ("Central") exigiu editar `SettingsModalView.ts`** — a única mudança real
nesse arquivo até agora. `switchTab()` tem uma lista fixa de 5 tabs hard-coded (nenhuma injeção
via DOM conseguiria fazer uma 6ª tab esconder/mostrar corretamente ao trocar sem duplicar essa
lógica). A mudança é pequena e sempre atrás de uma flag nova: `ModalConfig.isGateway` (default
`undefined`/`false`) — **um dispositivo real nunca seta essa flag**, então o modal de configurações
de dispositivo continua 100% inalterado. Quando `isGateway: true`:
- um botão de tab "Central" é renderizado e participa de `switchTab()` como qualquer outra;
- `getGatewayInfoHTML()` (novo método privado) renderiza 4 cards somente-leitura (Identificação,
  Conectividade/telemetria, Estatísticas, Metadados) a partir de `ModalConfig.gatewayInfo`
  (tipo `GatewayInfo`, também novo em `types.ts`) — 1:1 com o payload do GCDR
  `GET /api/v1/centrals/:id` (ver seção "Como conectar" abaixo);
- como esse HTML só é gerado UMA VEZ (`createModal()` só roda no construtor), um
  `onFetchSettings` assíncrono que resolve depois precisa de um patch explícito —
  `CentralSettingsModal.patchGatewayInfoDom()` atualiza os elementos `#gwinfo-<campo>` via
  `.textContent` depois que `super.render()` roda de novo, mesmo padrão que a própria base já usa
  para `#identity-created-time-value`/`#identity-last-updated-value`.

### O que isso já resolve de graça

Tema claro/escuro, maximizar, focus trap, teclado (Esc fecha), header premium com o `ModalHeader`
compartilhado — tudo herdado sem reescrever nada.

### O que ainda é "customização depois" (ainda não resolvido)

- **Sem `domain`** (`domain: '' as Domain`) — some a tab "Excluir Grupos" (só aparece com
  `domain === 'energy'`) e as seções condicionais de limite de energia/água/temperatura. Efeito
  colateral correto, não um hack.
- **Sem `jwtToken`/`gcdrDeviceId`** — as tabs Anotações/Alarmes mostram um placeholder "não
  disponível (autenticação necessária)" em vez de conteúdo real. A tab Chamados some inteiramente
  (gate global `window.MyIOUtils.ticketsEnabled`, não relacionado à central).
- **Campos "Andar/Localização" e "Identificador/LUC/SUC"** (tab Geral) continuam com
  rótulos/posições de dispositivo — não foram renomeados/escondidos ainda.
- **Ícone de identidade** (tab Geral) mostra o ícone genérico de "tipo de dispositivo
  desconhecido" (uma lupa), não um ícone de central.
- **Focus trap pode pular o card injetado** — `setupFocusTrap()` (privado, roda dentro do
  `super.render()`) tira a foto dos elementos focáveis *antes* do card "Configuração de
  Conectividade" existir.

### O que ficou (igual à v1 sobre openGenericModal)

- **Identidade**: nome (editável, campo `label` da base) + UUID/Hardware ID (somente leitura, tab
  Central).
- **Conectividade** (**novo** — não existe no `SettingsModalView` original): os 3 parâmetros v2
  do `deriveCentralConnectivity` (`offlineGraceMs`/`blipToleranceMs`/`offlineHardMs`), hoje só
  configuráveis via prop pelo desenvolvedor do host, nunca editáveis pelo usuário final. O
  formulário trabalha em **minutos** (mais legível); `minutesToMs`/`msToMinutes` (exportados)
  fazem a conversão pro host. Vive na tab **Central** (não na Geral — ver nota abaixo), como card
  "Configuração de Conectividade" ao lado do card somente-leitura "Conectividade (telemetria)".
- Mesmo formato de `PersistResult`/fetcher-persister-por-callback do original, simplificado pra
  `onFetchSettings`/`onSaveSettings` (ou `seed`, pulando o fetch inteiramente) — **não** usa o
  `fetcher`/`persister` por injeção de dependência do `SettingsController` original; o próprio
  `onSave` da base é reatribuído para chamar `onSaveSettings` diretamente (ver acima).

### Tab "Central" (⚙️ → Central) — identidade + telemetria somente-leitura

Pedido explícito: *"precisamos de ver tudo que a central teria de informações... tudo que está no
card em si... e mais a data da criação, data da alteração, modelo, firmware version, uuid,
hardware id"* — usando o payload real do GCDR (`GET /api/v1/centrals/:id`) como referência. 4
cards, todos somente-leitura (nunca voltam no `onSaveSettings` como campo editável — ver
"read-only fields are never part of the save payload" nos testes):

| Card | Campos |
|---|---|
| **Identificação** | UUID, Serial Number, Hardware ID, Tipo (`GATEWAY`/`NODEHUB`/`EDGE_CONTROLLER`/`VIRTUAL`), Status (cadastro), Firmware, Software, Frequência (canal de rádio) |
| **Conectividade (telemetria)** | Status de conexão (`ONLINE`/`OFFLINE`/`DEGRADED`/`MAINTENANCE`), Monitoramento habilitado, Última tentativa, Último sucesso, Latência, Resultado do probe |
| **Estatísticas** | Dispositivos conectados, Regras ativas, Eventos de sync pendentes, Uptime (`Xd Yh Zmin`), Último heartbeat |
| **Metadados** | Criado em, Atualizado em, Versão (optimistic locking) |

Nota: dentro dessa mesma tab, o card "Conectividade (telemetria)" (somente-leitura, dados que o
worker escreve) fica lado a lado com o card "Configuração de Conectividade" (**editável**, os
limiares grace/blip/hard) — nomes parecidos de propósito (ambos "sobre conectividade"), mas
propósitos opostos. **Revisão histórica**: até uma iteração anterior, o card editável vivia
injetado na tab Geral, separado da tab Central — movido para cá após feedback explícito ("tem uma
aba nova Central, esses dados não deveriam estar todos na aba central?"), já que ter dois lugares
para "coisas da central" não fazia sentido assim que a tab Central passou a existir. O UUID também
saiu do card editável nessa mudança (era um `<input readonly>` duplicando exatamente o que já
aparece no card "Identificação" logo ao lado).

### Como conectar

```js
MyIOLibrary.openCentralSettingsModal({
  id: 'ID-do-gateway-no-GCDR',
  name: 'Central Campinas Shopping G1 G2',
  uuid: '6e88d9be-e351-4a8a-aa02-2a2222fcb22b',   // opcional, exibido read-only
  hardwareId: 'OPI-ZERO-0417',                     // opcional, exibido read-only
  theme: 'dark', language: 'pt',                   // opcionais
  seed: {
    offlineGraceMinutes: 10, blipToleranceMinutes: 0, offlineHardMinutes: 150, // editáveis (tab Central)
    // Tudo abaixo é somente-leitura (também tab Central) — mapeia 1:1 com o GET
    // /api/v1/centrals/:id do GCDR; passe exatamente o que a API devolver.
    serialNumber: 'SCMXGATEWAY01', type: 'GATEWAY', status: 'ACTIVE', connectionStatus: 'ONLINE',
    monitoringEnabled: true, lastGatewayCheckAt: '...', lastGatewaySuccessCheckAt: '...',
    lastGatewayCheckLatencyMs: 1372, probeResult: 'OK', firmwareVersion: '1.0.0', softwareVersion: '0.0.0',
    frequency: 60, stats: { connectedDevices: 0, activeRules: 0, pendingSyncEvents: 0, uptimeSeconds: 0, lastHeartbeatAt: '...' },
    createdAt: '2026-03-16T...Z', updatedAt: '2026-09-04T...Z', version: 1,
  },
  // OU, em vez de seed: onFetchSettings: ({id}) => Promise<CentralSettingsData>,
  // (idealmente chamando o próprio GET /api/v1/centrals/:id do GCDR e repassando a resposta quase crua)
  onSaveSettings: async ({ id, data }) => {
    // data.offlineGraceMinutes/.blipToleranceMinutes/.offlineHardMinutes já validados
    // (offlineHardMinutes > offlineGraceMinutes quando setado — senão nunca dispara).
    // Converta pra ms com MyIOLibrary.minutesToMs(...) antes de persistir/repassar ao card.
    // Os demais campos de `data` (serialNumber, stats, etc.) vêm junto no objeto por
    // conveniência, mas nunca foram editáveis — ignore-os ao persistir.
  },
});
```

Validação (`validateCentralSettings`, também exportada): nome obrigatório, grace/blip ≥ 0,
`offlineHardMinutes` (quando setado) deve ser maior que `offlineGraceMinutes` — mesma regra de
guarda que `deriveCentralConnectivity`'s `pastHard` já aplica (nunca dispara com config
inconsistente).

### Na showcase

O sample **c1** tem `onOpenSettings` abrindo o modal de verdade com `seed` fixo (incluindo os
campos de identidade/telemetria da tab Central) e `onSaveSettings` mockado (loga + resolve após o
delay configurado) — não persiste nada de verdade, só exercita o contrato UI/validação/save do
componente. Confirmado no navegador: abre o shell completo (header roxo, tabs
Geral/Anotações/Alarmes/**Central** — Excluir Grupos e Chamados somem, como esperado), a Etiqueta
vem pré-preenchida com o nome da central, Anotações/Alarmes mostram o placeholder "não disponível
(autenticação necessária)", e a tab **Central** mostra 5 cards lado a lado: os 4 somente-leitura
(Identificação, Conectividade/telemetria, Estatísticas, Metadados) preenchidos com os dados do
`seed`, mais o card **editável** "Configuração de Conectividade" (grace/blip/hard) logo ao lado de
"Conectividade (telemetria)" — salvar com um valor alterado ali chega corretamente em
`onSaveSettings`, confirmando que a leitura funciona mesmo com esses campos fora do `<form>` da
tab Geral.

## 12. Badges de notificação (alarmes / chamados / anotações)

Porta fiel do padrão de badges de
`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`
(`addAlarmBadge`/`refreshAlarmBadges`, `addTicketBadge`/`refreshTicketBadges`,
`addAnnotationIndicator`) para o `CentralStatusCard` — mesmas cores, ícones, posições e
comportamento das 3 famílias de badge já usadas nos cards de dispositivo (v5.2.0/v6.0.0).

### As 3 famílias (idênticas ao original)

| Badge | Posição | Cor | Comportamento |
|---|---|---|---|
| **Alarme** 🔔 | borda esquerda, 10% abaixo do limite superior do card | vermelho `#dc2626`, texto branco | some por completo em contagem 0; "99+" acima de 99; clicável só se `onAlarmBadgeClick` for passado (senão é decorativo, igual ao original) |
| **Chamado** 🎧 | borda esquerda, 10% acima do limite inferior do card | ciano `#0891b2` sobre fundo translúcido, contagem em pill sólida no canto | 24×24, sempre clicável (chama `onTicketBadgeClick`) |
| **Anotação** (⚠️🔧✓📝) | coluna à direita, na borda do card, centralizada verticalmente | uma cor por tipo — `pending` #d63031, `maintenance` #e17055, `activity` #00b894, `observation` #0984e3 | **um quadrado 22×22 por tipo presente** (nunca contagem combinada), ordem fixa pending→maintenance→activity→observation, cada um com sua própria pill de contagem |

Alarme e chamado ficam em pontos opostos da MESMA borda (esquerda) — alarme perto do topo,
chamado perto do rodapé — em vez de empilhados juntos: leem como um par coerente (o mesmo lado),
mas sem crescer para uma coluna só quando os dois números aparecem ao mesmo tempo. (Uma versão
"agrupada numa única coluna, centralizada" foi testada e revertida — o par topo/rodapé validou
melhor visualmente.)

### Por que na borda do card, e não dentro do conteúdo

O `CentralStatusCard` tem texto/controles reais em todo canto (título no topo-esquerdo, (i)/
checkbox do Status no rodapé-esquerdo, valores alinhados à direita nas linhas de evidência) — ao
contrário do tile de dispositivo v5/v6, onde esses cantos são espaço vazio de thumbnail. Ancorar
os badges *dentro* desses cantos (como no original) cobria esse conteúdo. A solução: os badges
são filhos **do próprio elemento raiz** do card, e a raiz **não** recorta overflow — só a camada
visual interna (`.myio-cscard__surface`, que hospeda a coluna de ações + conteúdo, com
`overflow:hidden` e o border-radius arredondado) recorta. Isso deixa os badges pendurados **por
fora** da superfície visível, na própria linha da borda do card, sem nunca cobrir texto real.
Como o alarme/chamado ficam deslocados para fora da faixa vertical do conteúdo (perto do topo ou
do rodapé, não no meio), também nunca colidem com a coluna de ações opcional (📊/📄/⚙️,
[seção 8](#8-seleção-drag-and-drop-clique-no-card-e-coluna-de-ações-)) — ela só ocupa a altura da
própria linha de conteúdo.

### Hover: tooltip premium, não o balão nativo do navegador

Passar o mouse em qualquer um dos 3 badges abre o mesmo `InfoTooltip` premium usado pelo botão
(i)/pela flag de divergência — não o balão `title=` nativo do navegador (que foi removido dessas
3 famílias especificamente para não duplicar com o tooltip custom; o texto equivalente continua
disponível via `aria-label` para leitores de tela). Conteúdo do tooltip: ícone do tipo, um título
curto ("Alarmes"/"Chamados"/o rótulo do tipo de anotação) e a contagem por extenso.

### Detalhe de acabamento: o contador do chamado

O badge de chamado é intencionalmente translúcido (fundo `rgba(8,145,178,.12)`, estilo "ghost
button"), mas isso deixava a pill de contagem sólida por cima parecendo desbotada/semitransparente
— sem uma borda própria, ela se misturava visualmente com o quadrado translúcido atrás dela. O
contador agora carrega um anel `box-shadow` (`rgba(0,0,0,.35)`) que lhe dá um contorno nítido
contra qualquer fundo, claro ou escuro, sem alterar a cor/opacidade real (que já era 100% sólida).

### Como conectar

```js
MyIOLibrary.createCentralStatusCard({
  // ...demais props do card...
  alarmCount: 3,
  onAlarmBadgeClick: (e) => { /* { id, source: 'central-status-card' } */ },
  ticketCount: 2,
  onTicketBadgeClick: (e) => { /* { id, source: 'central-status-card' } */ },
  annotationCounts: { pending: 1, maintenance: 2, activity: 1, observation: 3 },
  onAnnotationBadgeClick: (e) => { /* { id, type, source: 'central-status-card' } */ },
});
```

Todos os campos são opcionais e independentes entre si — um card pode ter só `ticketCount`, só
`annotationCounts`, todos os três, ou nenhum (comportamento idêntico ao card sem essa seção do
RFC).

### Na showcase

- **c1** (Campinas): os 3 badges juntos (`alarmCount: 3`, `ticketCount: 2`,
  `annotationCounts` com os 4 tipos) — clique em qualquer um loga o evento no painel.
- **c3** (Montserrat, OFFLINE): `alarmCount: 16` (não bate no cap "99+") + só o tipo `pending`
  em `annotationCounts` — mostra que tipos ausentes/zerados não geram quadrado vazio.
- **c6** (West Plaza): só `ticketCount: 1` — mostra que os badges são independentes entre si e
  dos botões da coluna de ações.
- A seção **Legenda** ganhou um grupo "Badges de notificação" com os 3 estilos reais lado a
  lado, para referência rápida sem precisar abrir um card com dados.
- `.card-grid`/`.compact-list` ganharam um gap bem maior (`40px 32px` / `24px`, antes `14px`/
  `8px`) especificamente por causa dos badges: como eles penduram **fora** da borda do card
  (seção acima), um gap apertado fazia o badge de um card encostar visualmente no vizinho —
  o gap maior existe só para validação nesta showcase, não é uma recomendação de layout do host.

## 13. Status: só o slider, sem o rótulo ATIVO/INATIVO

A linha **Status** mostrava o slider **e** um texto ao lado (`ATIVO`/`INATIVO` em pt-BR,
`ACTIVE`/`INACTIVE` em inglês) — igual à linha **Monitoramento**, que mantém seu texto `ON`/`OFF`
(invariante entre idiomas, ver seção 6). Diferença: no Status a posição do slider já é
autoexplicativa (ligado = ativo), então o texto ao lado virou ruído visual sem adicionar
informação nova.

O `<span class="myio-cscard__switch-text">` da linha Status continua no DOM — com o texto
traduzido de sempre (`ATIVO`/`INATIVO`/`ACTIVE`/`INACTIVE`) — só que agora **visualmente oculto**
(`.myio-cscard__status .myio-cscard__switch-text` vira um clip de 1×1px, padrão "sr-only").
Leitor de tela continua anunciando o estado; olho humano só vê o slider. O texto ON/OFF da linha
Monitoramento não foi tocado — continua visível normalmente.
