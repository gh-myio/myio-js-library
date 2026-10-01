# Botões de Alarmes 🔔, Chamados 🎫 e Anotações ✏️ do HEADER — como usar e reusar

> Guia de orientação para quem precisa colocar esses três botões (com badge + painel no hover)
> em outro widget/dashboard, ou entender de onde vem cada peça.
>
> Levantado no código em **01/10/2026** (`desenv`, `eb1604e1`). RFCs: 0193 (sino de alarmes),
> 0198 (chamados/FreshDesk), 0203 (anotações), 0214 (paridade no v-5.4.0).

---

## 1. Resposta curta — são reusáveis?

| Botão | Painel no hover | Reusável? | Onde mora |
| --- | --- | --- | --- |
| 🔔 **Alarmes** | `AlarmNotificationTooltip` | ✅ **Sim** — componente da lib | `src/utils/tooltips/AlarmNotificationTooltip.ts` |
| ✏️ **Anotações** | `HeaderAnnotationsPanel` | ✅ **Sim** — componente da lib | `src/components/header-annotations-panel/` |
| 🎫 **Chamados** | `TicketNotificationTooltip` | ⚠️ **Parcial** — o tooltip é **inline no HEADER v-5.2.0** (não está na lib); os modais que ele abre são da lib | HEADER `controller.js:1821` + `src/components/premium-modals/tickets/` |
| Os 3 botões em si (ícone + badge + spinner) | — | ✅ no v-5.4.0 (`createHeaderShoppingComponent`); ❌ no v-5.2.0 (HTML/CSS do widget) | `src/components/header-shopping/` |

**Em uma frase:** os painéis de **alarmes** e **anotações** são componentes de biblioteca prontos
para reuso; o de **chamados** ainda não foi extraído. E há uma **duplicação conhecida**: o HEADER
v-5.2.0 continua usando a cópia *inline* do tooltip de alarmes em vez da versão da lib.

---

## 2. Anatomia — as 4 camadas

Cada botão depende de quatro peças. Para reusar, você precisa das quatro:

```text
 ┌────────────────────────┐   quem busca os dados (uma vez, no widget "dono")
 │ 1. Orquestrador (dados)│   window.AlarmServiceOrchestrator / TicketServiceOrchestrator /
 └───────────┬────────────┘   AnnotationServiceOrchestrator  + window.MyIOOrchestrator.*
             │ eventos window (myio:*)
 ┌───────────▼────────────┐
 │ 2. Botão + badge       │   <button id="tbx-btn-…-notif"> + <span …-badge>
 └───────────┬────────────┘
             │ mouseenter / mouseleave / click
 ┌───────────▼────────────┐
 │ 3. Painel / tooltip    │   AlarmNotificationTooltip · TicketNotificationTooltip ·
 └───────────┬────────────┘   HeaderAnnotationsPanel
             │ ações do usuário dentro do painel
 ┌───────────▼────────────┐
 │ 4. Modais de detalhe   │   AlarmBundleMapModal · NewTicketWizard / TicketDetailModal ·
 └────────────────────────┘   SettingsModal (aba Anotações)
```

### 2.1 Mapa por botão

| | 🔔 Alarmes | 🎫 Chamados | ✏️ Anotações |
| --- | --- | --- | --- |
| **Botão (id)** | `#tbx-btn-alarm-notif` | `#tbx-btn-ticket-notif` | `#tbx-btn-annotation-notif` |
| **Badge (id, v-5.2.0)** | `#tbx-alarm-notif-badge` | `#tbx-ticket-notif-badge` | `#tbx-annotation-notif-badge` |
| **Fonte de dados** | `window.MyIOOrchestrator.customerAlarms` / `.alarmDayMap` + `window.AlarmServiceOrchestrator` | `window.TicketServiceOrchestrator.deviceTicketMap` | `window.AnnotationServiceOrchestrator` |
| **Construção (lib)** | montado no controller (MAIN_VIEW `:3529`) | `buildTicketServiceOrchestrator` | `buildAnnotationServiceOrchestrator` |
| **Gate (aparece ou não)** | `MyIOOrchestrator.alarmsConfigured` (credenciais GCDR) | `MyIOUtils.ticketsEnabled` + `freshdeskApiKey` | `MyIOOrchestrator.annotationsConfigured` |
| **Evento "dados prontos"** | `myio:alarms-updated` `{alarms}` | `myio:tickets-ready` `{ticketMap}` | `myio:annotations-ready`, `myio:annotations-refreshed`, `myio:annotation-changed` |
| **Evento de gate** | — | `myio:tickets-gate-changed` `{ticketsEnabled}` | — |
| **Hover** | abre `AlarmNotificationTooltip` | abre `TicketNotificationTooltip` | abre `HeaderAnnotationsPanel` (`showFromHover`) |
| **Clique** | liga/desliga filtro global → `myio:global-alarm-filter` `{mode:'apenas_ativados'\|'ativado'}` | abre `NewTicketWizard` (fallback: widget FreshWorks) | liga/desliga filtro global → `myio:global-annotation-filter` `{mode:'apenas_com_anotacao'\|'ativado'}` |
| **Sincronia reversa** | `myio:telemetry-alarm-filter-changed` | — | `myio:telemetry-annotation-filter-changed` |
| **Modais abertos** | `openAlarmBundleMapModal` ("Regras de Alarmes") | `createNewTicketWizard`, `createTicketDetailModal` | `myio:annotation-clicked` → MAIN_VIEW abre `SettingsModal` na aba Anotações |

> O clique **não abre o painel** em alarmes e anotações — ele alterna o filtro global dos cards.
> O painel abre no **hover**.

---

## 3. Como reusar cada um

### 3.1 🔔 Alarmes — `AlarmNotificationTooltip` (lib)

Objeto singleton, arrastável / fixável / maximizável. Por padrão lê `window.MyIOOrchestrator` e
`window.MyIOUtils`, a mesma fonte do badge.

```js
const Tip = window.MyIOLibrary.AlarmNotificationTooltip;

// Opção A — attach: cuida do mouseenter/mouseleave e devolve um cleanup
const cleanup = Tip.attach(btnAlarm);            // lê window.MyIOOrchestrator
// const cleanup = Tip.attach(btnAlarm, () => meusDados);   // provider próprio

// Opção B — wiring manual (o que o v-5.4.0 faz)
btnAlarm.addEventListener('mouseenter', () => Tip.show(btnAlarm));
btnAlarm.addEventListener('mouseleave', () => {
  if (!Tip._isMouseOver && !Tip._isPinned) Tip.hide();
});

// Opcional — trocar a fonte de dados e os handlers
Tip.configure({
  getData: () => ({ /* AlarmNotificationData */ }),
  tbBaseUrl, customerTbId,          // persistência dos toggles no SERVER_SCOPE
  onOpenAlarmMap: () => { /* botão "Regras de Alarmes" */ },
  onToggleNotifications, onToggleOffline, onToggleInternalRule,
});
```

**Pré-requisitos** (o que precisa existir em `window.MyIOOrchestrator` no modo padrão):
`alarmsConfigured`, `customerAlarms`, `alarmDayMap` (`listAll()`), `alarmNotificationsEnabled`,
`showOfflineAlarms`, `isInternalSupportRule`, `customerTB_ID`, `gcdrTenantId`, `gcdrApiBaseUrl`,
`gcdrDeviceNameMap`; e em `window.MyIOUtils`: `currentUserEmail`, `openAlarmBundleMapModal`.
Sem `alarmsConfigured`, o tooltip mostra o estado **bloqueado** ("Funcionalidade de Alarmes não
está ativada").

Tipos exportados: `AlarmNotificationData`, `AlarmRecord`, `AlarmDayMap`,
`AlarmNotificationTooltipConfig`, `AlarmNotificationToggleContext`.

### 3.2 ✏️ Anotações — `HeaderAnnotationsPanel` (lib)

Painel com 3 abas (Por Identificador / Por Dispositivo / Por Tipo de Telemetria), busca,
ordenação, filtros, scroll virtual (> 100 itens) e exportação PDF/CSV.

```js
const panel = window.MyIOLibrary.getHeaderAnnotationsPanel();   // singleton lazy

btnAnnot.addEventListener('mouseenter', () => panel.showFromHover(btnAnnot));
btnAnnot.addEventListener('mouseleave', () => panel.startDelayedHide());   // fecha após 450 ms
// Alternativas: panel.show(btn) · panel.toggle(btn) · panel.hide() · panel.destroy()
```

Instância própria (testes ou fonte de dados diferente):

```ts
import { HeaderAnnotationsPanel } from 'myio-js-library';
const panel = new HeaderAnnotationsPanel({
  getOrchestrator: () => meuOrquestrador,   // default: window.AnnotationServiceOrchestrator
  logger: console,
});
```

**Pré-requisitos:** um objeto no formato `AnnotationServiceOrchestratorShape`
(`src/services/annotations/types.ts:130`) — `devices`, `byIdentifier`, `byDeviceId`, `byDomain`,
`getAll()`, `getTotalCount()`, `getPendingCount()`, `getOverdueCount()`… Normalmente criado com
`MyIOLibrary.buildAnnotationServiceOrchestrator(...)`.

**O que o painel emite:** `myio:annotation-clicked` `{deviceId, annotationId, returnTo:'header-panel'}`
— alguém precisa ouvir e abrir o modal de anotações do device (na v-5.2.0 é a MAIN_VIEW).

**Estado persistido** em `localStorage`: `myio.annotations.activeTab`, `myio.annotations.sortBy`.

API pública: `show` · `hide` · `toggle` · `showFromHover` · `startDelayedHide` · `destroy` ·
`getActiveTab/setActiveTab` · `getSortBy/setSortBy` · `getFilter/setFilter`.

Peças internas reaproveitáveis da mesma pasta: `AnnotationItemCard`, `VirtualList`,
`searchSortFilter`, `ExportModal` / `ExportPDF` / `ExportCSV`.

### 3.3 🎫 Chamados — **tooltip ainda não está na lib**

O que **é** reusável (lib):

```js
// Orquestrador (busca os tickets do FreshDesk e indexa por device)
window.TicketServiceOrchestrator = await MyIOLibrary.buildTicketServiceOrchestrator(/* … */);

// Wizard de novo chamado
const wizard = MyIOLibrary.createNewTicketWizard({
  freshdeskDomain, freshdeskApiKey, requesterEmail,
  getDevices: () => [{ identifier, label, domain, deviceProfile }],
});
wizard.open();

// Detalhe de um chamado
MyIOLibrary.createTicketDetailModal({
  freshdeskDomain, freshdeskApiKey, ticket,
  onTicketCancelled: () => window.TicketServiceOrchestrator?.refresh?.(),
  onNoteAdded:       () => window.TicketServiceOrchestrator?.refresh?.(),
}).open();
```

O que **não** é reusável hoje: o `TicketNotificationTooltip` (lista de chamados no hover) é um
objeto **inline** no HEADER v-5.2.0 (`HEADER/controller.js:1821–2130`, CSS em `_tntInjectCSS`
`:1795`). O v-5.4.0 não o tem: usa um tooltip simples próprio (`_ticketTipHtml`).

Também vive só no HEADER v-5.2.0 (teria que ser copiado ou extraído):
- **watchdog de 60 s** do spinner → estado de erro (✕ + tooltip) quando o FreshDesk não responde;
- injeção do **widget FreshWorks** como fallback (`_initFreshworksWidget`).

> Para reusar o tooltip de chamados **do jeito certo**, extraia-o para a lib seguindo o molde do
> `AlarmNotificationTooltip.ts` (mesma estrutura: `getContainer/renderHTML/show/hide/attach/configure`).

### 3.4 Os botões (ícone + badge + spinner)

**Widget novo / v-5.4.0 — usar o componente:**

```js
const header = MyIOLibrary.createHeaderShoppingComponent({
  showAlarmButton: true, showTicketButton: true, showAnnotationButton: true,   // default: false
  onAlarmClick, onTicketClick, onAnnotationClick,
});
header.setAlarmBadge(count, { loading: false, configured: true });
header.setTicketBadge(count, { loading: false, error: false });
header.setAnnotationBadge(total, { pending, overdue, loading: false });

// os painéis de hover são ligados por fora, nos mesmos ids:
const root = header.element;
MyIOLibrary.AlarmNotificationTooltip.attach(root.querySelector('#tbx-btn-alarm-notif'));
```

**v-5.2.0 — markup próprio do widget:** `HEADER/template.html:40–100` (botões) e
`HEADER/styles.css` (classes `tbx-btn-*-notif`, `is-loading`, `tbx-loading-spinner`, badges). Não é
componente; para reusar é copiar o trecho de HTML + CSS.

> Atenção aos ids dos badges: no v-5.2.0 são `tbx-<x>-notif-badge`; no componente
> `header-shopping` são `tbx-<x>-badge`. Os ids dos **botões** são iguais nos dois.

---

## 4. Regras do v-5.2.0 (widgets separados)

1. **Só a MAIN_VIEW toca em `window.MyIOLibrary`.** HEADER/MENU/TELEMETRY leem pela ponte
   `window.MyIOUtils.<símbolo>`. Símbolo novo = adicionar à lista `LIB_SYMBOLS` da MAIN_VIEW
   (`MAIN_VIEW/controller.js:112`). Já estão lá: `getHeaderAnnotationsPanel`,
   `createNewTicketWizard`, `createTicketDetailModal`, `openAlarmBundleMapModal`,
   `openAlarmDetailsModal`, `createAlarmsNotificationsPanelComponent`.
   ⚠️ `AlarmNotificationTooltip` **não está** na lista — por isso o HEADER usa a cópia inline.
2. **Orquestradores nascem na MAIN_VIEW**, o HEADER só consome. O HEADER pode montar **depois**
   dos eventos já terem sido disparados → sempre faça o *seed* lendo o estado atual além de
   registrar o listener (o HEADER faz isso para os três: `customerAlarms`, `deviceTicketMap`,
   `annotationsConfigured`).
3. **Botão nasce em `is-loading`** (spinner) e só troca para o ícone quando o dado/gate chega.
4. **Visibilidade por usuário (RFC-0233):** `MyIOUtils.isFeatureVisible` pode forçar
   `display:none` em qualquer um dos três, por cima dos gates acima.

---

## 5. Checklist para levar os 3 botões a outro widget

- [ ] Garantir os **orquestradores** no escopo `window` (ou injetar provider próprio)
- [ ] Renderizar os **botões** — `createHeaderShoppingComponent` (recomendado) ou copiar o markup do v-5.2.0
- [ ] Ligar o **hover**: `AlarmNotificationTooltip.attach(btn)` · `getHeaderAnnotationsPanel().showFromHover(btn)` · tooltip de chamados (inline / simples)
- [ ] Ligar o **clique**: filtro global (alarmes, anotações) e wizard (chamados)
- [ ] Ouvir os **eventos** `myio:*` para atualizar badges **e** fazer o seed inicial
- [ ] Tratar os **gates** (`alarmsConfigured`, `ticketsEnabled`, `annotationsConfigured`) e o estado de loading
- [ ] Ouvir `myio:annotation-clicked` e abrir o modal de anotações do device
- [ ] No v-5.2.0: expor símbolos novos via `LIB_SYMBOLS`

---

## 6. Dívidas técnicas / oportunidades

| # | Item | Impacto |
| --- | --- | --- |
| 1 | HEADER v-5.2.0 mantém `AlarmNotificationTooltip` **inline** (`controller.js:1130–1820`, ~690 linhas) duplicando a versão da lib | Correção feita num lado não chega ao outro. Migrar: adicionar o símbolo a `LIB_SYMBOLS` e trocar o objeto inline por `MyIOUtils.AlarmNotificationTooltip` |
| 2 | `TicketNotificationTooltip` só existe inline no v-5.2.0 | v-5.4.0 tem tooltip mais simples; extrair para `src/utils/tooltips/` |
| 3 | Watchdog/estado de erro do botão de chamados só no v-5.2.0 | Levar para `header-shopping` (`setTicketBadge(..., {error:true})` já existe na API) |
| 4 | Ids de badge diferentes entre v-5.2.0 e `header-shopping` | Cuidado ao portar CSS/JS entre versões |
| 5 | Markup dos botões do v-5.2.0 não é componente | Avaliar adotar `createHeaderShoppingComponent` também no v-5.2.0 |

---

## 7. Referência rápida de arquivos

| O quê | Arquivo |
| --- | --- |
| HEADER v-5.2.0 — botões (HTML) | `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/template.html:40` |
| HEADER v-5.2.0 — tooltip de alarmes inline | `…/HEADER/controller.js:1130` |
| HEADER v-5.2.0 — tooltip de chamados inline | `…/HEADER/controller.js:1821` |
| HEADER v-5.2.0 — wiring chamados / alarmes / anotações | `…/HEADER/controller.js:2133` / `:2436` / `:2520` |
| MAIN_VIEW v-5.2.0 — `LIB_SYMBOLS` (ponte MyIOUtils) | `…/MAIN_VIEW/controller.js:112` |
| MAIN_VIEW v-5.2.0 — orquestradores | `:3529` (alarmes) · `:3637` (anotações) · `:3785` (chamados) |
| v-5.4.0 — wiring dos três | `src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js:2570–2610`, `:2792` |
| Lib — tooltip de alarmes | `src/utils/tooltips/AlarmNotificationTooltip.ts` |
| Lib — painel de anotações | `src/components/header-annotations-panel/HeaderAnnotationsPanel.ts` |
| Lib — orquestrador de anotações | `src/services/annotations/AnnotationServiceOrchestrator.ts` |
| Lib — chamados (wizard, detalhe, orquestrador) | `src/components/premium-modals/tickets/`, `…/settings/tickets/TicketServiceOrchestrator.ts` |
| Lib — header com os 3 botões | `src/components/header-shopping/` |
| Exports | `src/index.ts:792` (alarmes) · `:2486–2501` (chamados) · `:2512–2531` (anotações) |
