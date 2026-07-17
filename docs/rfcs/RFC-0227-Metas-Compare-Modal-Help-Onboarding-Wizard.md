# RFC-0227: Metas × Consumo Modal — "?" Help Button + Mock-Data Guided Tour (Wizard)

- Feature Name: `metas_compare_modal_help_onboarding_wizard`
- Start Date: 2026-07-17
- RFC PR: (leave this empty)
- Tracking Issue: (leave this empty — suggest Jira **ED**, e.g. ED-1030 epic + per-phase children)
- Status: **Draft (design only — no feature code)**

> **Escopo.** Este RFC é **design only**. Nenhum arquivo de código é alterado. Ele
> especifica um botão **"?"** (ajuda) ao lado do botão **Engine** (que passa a ser
> **icon-only**) na modal **"Metas × Consumo — Shoppings"** do Head Office **UNIQUE**
> e um **guia de uso em wizard** (tour guiado) que roda 100% em **dados MOCK** —
> shoppings falsos, KPIs/metas falsas e **chamadas de endpoint falsas** (sem rede
> real), de modo a ser sempre disponível independente de um cliente com metas
> configuradas.

---

## Summary

Adicionar, na modal **Metas × Consumo** (root `#myio-goals-compare-root`, renderizada
por `src/thingsboard/MYIO-SIM/v5.2.0_UNIQUE/controller.js`, função `openGoalsCompare`),
um botão **"?"** ao lado do botão **Engine** — que se torna **icon-only** (só `⚙️`).
Clicar em **"?"** abre um **guia de uso completo e intuitivo**, em formato **wizard /
tour guiado** com várias seções passo-a-passo, que explica **cada parte** da modal:

- abas de domínio (**Energia / Água**), o input **Período**, e os presets **Ano
  2025 / Ano 2026** (+ os toggles 👁 A-1 / Realizado da legenda);
- as sub-abas **Dashboards / Analítico** e o botão **Engine**;
- cada **card por shopping**: o gráfico (linhas/barras A-1 2025 · Realizado 2026 ·
  Meta · Orçado) e a linha de **KPIs** (A-1, Realizado, Orçado, Meta) mais os **chips
  de desvio** (vs A-1, vs Realizado, vs Meta);
- a sidebar **"Resumo por shopping"** (por shopping: 2025 / 2026 / Orçado / Meta +
  deltas, e a linha **Total**) e seu controle de **ordenação**;
- a entrada do **Engine** (gestão de metas — granularidade, visão, tipo, ordenação).

O guia roda sobre um **dataset MOCK autocontido** (2–3 shoppings fake com A-1 /
Realizado / Orçado / Meta) e uma **camada de fetch falsa** (adapter que resolve
Promises com fixtures) — nunca toca a API GCDR nem depende do cliente logado.

O engine de wizard **reusa `src/components/onboard/openOnboardModal.ts`** como *shell*
premium (header roxo + footer MYIO Academy), **estendido** com um modo de **passos**
(o componente hoje é single-content, não tem navegação prev/next).

## Motivation

A modal Metas × Consumo é densa: domínios, período, presets de ano, sub-abas
Dashboards/Analítico, Engine, cards com 4 KPIs + 3 chips + gráfico de 4 séries, e uma
sidebar com resumo + total + ordenação. Hoje o entendimento depende de:

1. **um cliente real com metas GCDR configuradas** (nem todo cliente tem), e
2. **conhecimento tácito** de quem já operou o painel.

Para **operadores novos** e para **demos/comercial**, não há um caminho self-serve que
explique o painel sem live data. Um **tour em dados mock**, sempre disponível pelo
botão **"?"**, resolve isso: ensina o significado de cada elemento com números
realistas e sem risco de expor/alterar metas de um cliente. É também documentação
"viva" acoplada à própria UI (menos drift que um wiki externo).

---

## Guide-level explanation

### Onde fica o "?" (colocação)

O toolbar da modal tem **duas linhas** no `data-gc-col1`:

- **Linha 1 (`data-tabs` + período):** abas de domínio (`data-domain`), input
  **Período** (`data-period`), presets **Ano 2025 / Ano 2026** (`data-period-preset`).
- **Linha 2 (`data-controls`):** pills **Dashboards / Analítico** (`data-view`) e o
  botão **Engine** (`data-engine`, hoje `⚙️ Engine`).

**Proposta:** na **linha 2**, ao lado do **Engine**:

1. **Engine vira icon-only** — `⚙️` sem o texto "Engine" (mantém `title="Engine —
   granularidade, visão, tipo e ordenação"` para acessibilidade e hover).
2. **Novo botão `data-help`** — rótulo **`?`** (ou `❓`), mesmo estilo *outline* do
   Engine (borda `GP.tint(45)`, cor `GP.accent`, `title="Como usar este painel — guia
   passo a passo"`, `aria-label` idem). Fica **imediatamente à direita** do `⚙️`.

Isso alinha com a **relocação de abas já planejada** (as pills Dashboards/Analítico e
o Engine convivem na linha de controles). O "?" é um **par visual** do Engine: um
configura, o outro explica.

> Nota: o header superior (`🌙` tema · `⛶` maximizar · `⬇️ PDF` · `✕`) **não** recebe o
> "?" — o guia é sobre o *conteúdo* do painel, então mora junto dos controles do
> conteúdo, não junto dos controles de janela.

### O que o guia mostra (wizard — lista de seções)

Cada seção mapeia **1:1** para uma área concreta da modal. Ordem = fluxo de leitura
(topo → conteúdo → sidebar → gestão):

| # | Seção (título pt-BR) | O que explica | Âncora na modal |
|---|----------------------|---------------|-----------------|
| 1 | **Bem-vindo ao Metas × Consumo** | O que o painel compara (Realizado vs Meta/Orçado vs A-1) e para quem serve | header `📊 Metas × Consumo` |
| 2 | **Domínio: Energia e Água** | As abas de domínio; unidade (MWh / m³); que a régua da meta é ENTRADA (energia) / hidrômetros (água) | `data-tabs` / `data-domain` |
| 3 | **Período e presets de Ano** | O input **Período** (intervalo livre) e os presets **Ano 2025 / Ano 2026**; efeito na granularidade (Dia/Hora até 15 dias) | `data-period`, `data-period-preset` |
| 4 | **Dashboards × Analítico** | As duas sub-abas: gráficos/cards vs tabela do portfólio (Resumo Analítico) | `data-view` |
| 5 | **O card do shopping — gráfico** | As 4 séries: **A-1 (2025)** cinza, **Realizado (2026)** azul, **Meta** roxa, **Orçado** laranja; barras = consumo, linhas = meta/orçado | `data-cards-grid` / `.myio-cgc` |
| 6 | **O card do shopping — KPIs e chips** | A linha de KPIs (**A-1 · Realizado · Orçado · Meta**) e os chips de desvio (**vs A-1 · vs Realizado · vs Meta**), com leitura de sinal (acima/abaixo) | KPIs + chips do card |
| 7 | **Toggles de ano (👁)** | Ligar/desligar **A-1** e **Realizado** na legenda para focar a comparação | `data-year-toggles` |
| 8 | **Resumo por shopping (sidebar)** | A lista lateral: por shopping **2025 / 2026 / Orçado / Meta + deltas**, e a linha **Total** consolidada | `data-side` / `data-table` / `data-side-total` |
| 9 | **Ordenar o resumo** | O controle de ordem (`Data de Inauguração ↑`, clique inverte) e o modal de filtros (buscar/excluir/filtros rápidos) | `data-side-order`, `data-side-filter` |
| 10 | **Engine — gestão de metas** | O `⚙️` Engine: granularidade, visão (consolidado × por shopping), tipo (cards/empilhado/separado), ordenação e **salvar** | `data-engine` |
| 11 | **Exportar e finalizar** | `⬇️ PDF`, tema `🌙`, maximizar `⛶`; encerra o tour | header |

Cada seção tem: **título**, **texto curto** (2–4 frases pt-BR), e um **visual** — um
*snapshot ilustrativo* (mini-card, mini-sidebar, mini-toolbar) populado com o dataset
**mock**, para o operador ver o elemento real com números plausíveis.

### Navegação

- **Anterior / Próximo** (prev/next), **Pular** (skip → fecha), **Concluir** (finish
  na última seção).
- Indicador de progresso: **dots** ou `"3 / 11"`.
- Teclado: `←/→` navega, `Esc` fecha (já suportado pelo shell).
- Opcional: **"Não mostrar novamente"** (checkbox na última seção) → grava flag de
  persistência (ver §Persistência).

### Auto-abertura (first-run) — opcional

Se `enableGoalsGuideOnboarding` (atributo do widget, **default OFF**) e o usuário nunca
viu o guia (flag ausente), a modal pode **auto-abrir o tour na primeira vez** que Metas
× Consumo abre. Gated e desligável — nunca intrusivo por default. O botão **"?"**
reabre o tour a qualquer momento.

---

## Reference-level explanation

### 1. Estado atual de `openOnboardModal` (o shell)

`src/components/onboard/openOnboardModal.ts` + `OnboardModalView.ts` + `types.ts`.
Interface pública **atual** (quote):

```ts
export interface OnboardModalConfig {
  title: string;
  width?: number | string;      // default 800
  height?: number | string;
  content?: string | HTMLElement; // corpo único
  iframeUrl?: string;             // ou um iframe
  closeOnBackdrop?: boolean;      // default true
  showFooter?: boolean;           // default true (footer "MYIO Academy")
  footerLinks?: OnboardFooterLink[];
  onClose?: () => void;
}
export interface OnboardModalHandle {
  close: () => void;
  setContent: (content: string | HTMLElement) => void; // troca o corpo
  getElement: () => HTMLElement | null;
}
```

**Conclusão:** o shell é **single-content** — tem header (gradiente roxo
`#6c5ce7→#a29bfe` + logo 🎓), body rolável, footer premium "MYIO Academy", `Esc` e
backdrop-close. **Não** tem: conceito de passos, prev/next/skip/finish, progress, nem
persistência ("don't show again"). Já suporta **HTML rico por conteúdo** e troca de
corpo via `setContent()`.

**Decisão:** o shell **serve** como janela, mas **precisa de uma extensão** para o
wizard. Duas formas, ambas backward-compatible:

- **(A) Estender `openOnboardModal` com um modo `steps`** (recomendado para reuso
  amplo): adicionar campo opcional `steps?: OnboardStep[]`; quando presente, o
  `OnboardModalView` renderiza a barra de navegação (prev/next/skip/finish + dots) e um
  slot de conteúdo trocado por passo. `content`/`iframeUrl` seguem funcionando quando
  `steps` é omitido (zero breaking change). Extensão proposta:

  ```ts
  export interface OnboardStep {
    id: string;
    title: string;
    /** HTML string ou elemento; pode conter o snapshot mock */
    body: string | HTMLElement;
    /** opcional: texto do rótulo do passo nos dots/legenda */
    label?: string;
  }
  export interface OnboardModalConfig {
    // ...campos atuais...
    steps?: OnboardStep[];             // NOVO — ativa modo wizard
    initialStep?: number;              // NOVO — default 0
    showProgress?: boolean;            // NOVO — dots/"n/N", default true
    finishLabel?: string;              // NOVO — default "Concluir"
    onFinish?: () => void;             // NOVO
    onStepChange?: (index: number) => void; // NOVO
    persistKey?: string;               // NOVO — habilita "não mostrar novamente"
  }
  export interface OnboardModalHandle {
    // ...atuais...
    goToStep?: (index: number) => void; // NOVO
  }
  ```

- **(B) Um componente novo `metas-guide` que só *usa* o shell** via `content` +
  `setContent()` e gerencia os passos por fora (o guia monta seu próprio rodapé de
  navegação dentro do `content`). Sem tocar `openOnboardModal`.

**Recomendação:** **(A) + (B) combinados** — estender o shell com `steps` (util para
qualquer tour futuro) **e** encapsular o conteúdo/mock específico de Metas num
componente `metas-guide` reusável. Se a extensão (A) for considerada fora de escopo da
Fase 1, o guia pode nascer com **(B)** (shell atual + navegação inline via
`setContent`) e migrar para `steps` depois — o `metas-guide` esconde essa diferença
atrás de sua própria API.

### 2. Padrão de look & feel (referência: annotations settings)

Referência de UX: `src/components/premium-modals/settings/annotations/` (e o shell
`settings/`). Padrões a reusar:

- **Fonte** `Nunito` em todo o guia (padrão MyIO de modais premium).
- **Gradiente de header/banner** `linear-gradient(135deg,#6c5ce7,#a29bfe)` — coincide
  com o header nativo do `OnboardModalView` (roxo Academy). Para casar com o **tema do
  próprio painel de Metas**, o guia deve **herdar o accent** via as CSS vars `--gc-*`
  já expostas no `#myio-goals-compare-root` (ver `GC_THEMES` light/dark e o objeto
  `GP` — `GP.accent`, `GP.accentDark`, `GP.tint(n)`), assim o tour respeita o tema
  claro/escuro atual do dashboard. Fallback = roxo Academy quando aberto fora do
  painel.
- **CSS-in-JS injetado** (bloco de estilos único com id, como `ANNOTATIONS_STYLES`),
  **banner informativo** no topo de cada seção, e **maps de rótulo/cor** por conceito
  (como `ANNOTATION_TYPE_COLORS`) — aqui, o mapa de cores das séries: **Realizado
  `#2563eb`**, **A-1 `#94a3b8`**, **Orçado `#f59e0b`**, **Meta `#7c3aed`** (as mesmas
  do card RFC-0217, para o snapshot bater com o painel real).
- **Fixtures co-locadas**: o annotations component já traz `sampleAnnotations.json`
  ao lado do código — precedente direto para colocarmos as fixtures do guia
  (`metasGuideFixtures`) ao lado do `metas-guide`.

### 3. Onde o código mora (lib vs widget)

O painel Metas × Consumo vive num **widget controller** (`MYIO-SIM/v5.2.0_UNIQUE` —
sem publish npm; sincronizado no ThingsBoard). O padrão de bridge do projeto: **só o
MAIN_VIEW referencia `window.MyIOLibrary`; os filhos leem via `window.MyIOUtils.<símbolo>`**;
símbolos novos entram em `LIB_SYMBOLS` no MAIN.

**Decisão / recomendação:** implementar o guia como **componente de biblioteca**
reusável, não inline no controller:

- **Novo componente** `src/components/metas-guide/` exportando
  `openMetasGuide(options)` (+ fixtures + tipos). Ele **usa** `openOnboardModal`
  (shell estendido) internamente.
- Exportado em `src/index.ts` e adicionado a **`LIB_SYMBOLS`** para o controller
  acessá-lo via `window.MyIOUtils.openMetasGuide` (bridge). Fallback inline mínimo
  (um `openOnboardModal` com conteúdo estático) caso o símbolo não exista, seguindo o
  padrão "prefere lib, fallback inline".
- No controller, o único código novo é: **(a)** tornar o Engine icon-only, **(b)**
  adicionar o botão `data-help`, e **(c)** no handler de clique
  (`if (e.target.closest('[data-help]')) return void openGuide();`) chamar
  `window.MyIOUtils.openMetasGuide?.({...})`. **Nada** da lógica do tour vive no
  controller.

Assinatura proposta do componente:

```ts
export interface MetasGuideOptions {
  /** herda o tema do painel: passe as CSS vars/accent já resolvidos */
  theme?: { accent: string; accentDark: string; accentText: string; mode: 'light'|'dark' };
  /** dataset mock; default = fixtures embutidas */
  mockData?: MetasGuideFixtures;
  /** habilita "não mostrar novamente" + chave de storage */
  persistKey?: string;      // ex.: 'myio:metas-guide:seen:v1'
  /** callbacks */
  onClose?: () => void;
  onFinish?: () => void;
}
export function openMetasGuide(options?: MetasGuideOptions): OnboardModalHandle;
```

### 4. Modo MOCK — o *seam* (como o tour renderiza sem rede)

**Requisito duro:** o guia **nunca** faz chamada real. Duas questões: (a) de onde vêm
os números, (b) o tour renderiza um *snapshot do painel* populado com mock, ou *painéis
ilustrativos standalone*?

**Decisão (recomendada): snapshots ilustrativos standalone, alimentados por fixtures.**
Ou seja, cada seção do wizard renderiza um **mini-widget** (mini-card, mini-sidebar,
mini-toolbar) construído pelo `metas-guide` a partir das fixtures — **não** um clone
vivo do `openGoalsCompare`. Razões:

- **Isolamento total:** não instancia Chart.js pesado, não dispara os fetchers reais
  do painel, não depende de `shoppings` reais nem do estado do dashboard.
- **Estabilidade:** o snapshot é determinístico (mesmos números sempre) — ideal para
  demo e para screenshots/QA.
- **Baixo acoplamento:** o guia não precisa reproduzir o ciclo de vida completo do
  painel (Engine, presets, toggles) — só **ilustra** cada peça.

O trade-off (drift entre o mini-widget e o card real) é mitigado reusando o **mesmo
mapa de cores** e os **mesmos rótulos** do card RFC-0217, e — se desejado numa Fase 2 —
reaproveitando o próprio `createCustomerGoalsCard` da lib para o snapshot do card
(passando dados mock), o que dá fidelidade 1:1 sem tocar endpoints.

**Camada de fetch falsa (para quem quiser exercitar o caminho "com dados"):** um
**adapter de resolved-Promise** que substitui o fetcher real, retornando as fixtures:

```ts
// fake endpoint layer — resolve sempre com fixtures, zero rede
export function makeMockGoalsAdapter(fx: MetasGuideFixtures) {
  return {
    listShoppings: async () => fx.shoppings,
    getGoals: async (_shoppingId: string, _period: Period) => fx.goalsByShopping[_shoppingId],
    getRealized: async (_shoppingId: string, _period: Period) => fx.realizedByShopping[_shoppingId],
    // nenhuma chamada real; Promise resolvida em memória
  };
}
```

O guia injeta esse adapter onde o painel usaria o fetcher GCDR. Como o snapshot é
standalone, na prática o adapter só é necessário se, na Fase 2, optarmos por renderizar
um **mini-painel vivo** dirigido pelos mesmos code paths — aí o adapter garante que
nenhuma dessas chamadas escape para a rede.

### 5. Contrato de dados MOCK (fixtures)

2–3 shoppings fake, cada um com A-1 (2025), Realizado (2026), Orçado e Meta — mais
séries por bucket para o mini-gráfico e os deltas prontos para os chips:

```ts
export interface MetasGuideShoppingFixture {
  id: string;            // 'mock-sh-1'
  name: string;          // 'Shopping Aurora' (fictício)
  inaugurationDate: string; // 'YYYY-MM-DD' — p/ ilustrar a ordenação
  // KPIs do período (números realistas; energia em MWh, água em m³)
  aMinus1: number;       // A-1 (2025)
  realizado: number;     // Realizado (2026)
  orcado: number;        // Orçado (value cru)
  meta: number;          // Meta (adjustedValue)
  // séries por bucket p/ o mini-chart (mesmos labels p/ as 4 séries)
  labels: string[];      // ex.: ['Jan','Fev',...] ou dias
  series: {
    aMinus1: number[];
    realizado: (number|null)[];
    orcado: number[];
    meta: number[];
  };
}
export interface MetasGuideFixtures {
  domain: 'energy' | 'water';
  unit: 'MWh' | 'm³';
  shoppings: MetasGuideShoppingFixture[];
  // total consolidado (linha "Total" da sidebar), derivável ou pré-computado
  total: { aMinus1: number; realizado: number; orcado: number; meta: number };
}
```

Chips derivados (para a seção 6) = `vs A-1 = realizado/aMinus1 - 1`,
`vs Realizado` (uso ilustrativo entre séries), `vs Meta = realizado/meta - 1`,
formatados em pt-BR (`%`, sinal, cor por above/below). As fixtures ficam **co-locadas**
(`src/components/metas-guide/metasGuideFixtures.ts` ou `.json`, à la
`sampleAnnotations.json`), com **um dataset de energia e um de água** para a seção de
domínios.

### 6. Persistência ("não mostrar novamente")

`localStorage` com chave versionada, ex.: `myio:metas-guide:seen:v1` (bump de versão
quando o tour mudar materialmente, para reexibir). A escrita é opcional e só ocorre se
`persistKey` for passado / o checkbox for marcado. **Nunca** grava sozinho sem opt-in.

### 7. Acessibilidade

- **Focus trap** dentro da modal do guia; foco inicial no título/1º controle; retorno
  do foco ao botão **"?"** ao fechar.
- Botões prev/next/skip/finish com `aria-label`; progress com `aria-live="polite"`
  ("Passo 3 de 11").
- `Esc` fecha (já no shell); `←/→` navegam; ícones decorativos com `aria-hidden`.
- Contraste garantido em **light e dark** (herdando `--gc-*`).

---

## Drawbacks

- **Manutenção/drift:** o guia precisa acompanhar a evolução da modal real (novas
  abas, mudança de KPIs). Mitigação: reusar cores/rótulos/`createCustomerGoalsCard` e
  versionar as fixtures; checklist "atualizar RFC-0227 tour" no DoD de mudanças na
  modal Metas.
- **Superfície pública nova:** estender `OnboardModalConfig` com `steps` e exportar
  `openMetasGuide` é API que passa a ser mantida.
- **Conteúdo em pt-BR hard-coded:** i18n não é resolvido aqui (ver Open questions).
- **Custo de fidelidade:** snapshots standalone podem divergir sutilmente do card real
  (tipografia/spacing) mesmo com cores iguais.

## Rationale and alternatives

- **Reusar `openOnboardModal`** (shell) vs. construir um modal próprio: reusar mantém
  header/footer premium, `Esc`/backdrop e consistência — escolhido.
- **Extensão `steps` no shell (A)** vs. **navegação inline no `content` (B)**: (A) é
  reusável para qualquer tour futuro; (B) é zero-touch no shell. Recomendado **A+B**
  (extensão + componente encapsulador), com **B como fallback** se A for adiada.
- **Snapshot standalone (mock) vs. mini-painel vivo com adapter falso:** standalone é
  mais isolado e determinístico (escolhido para Fase 1); mini-painel vivo (Fase 2) dá
  fidelidade 1:1 mas exige o adapter de fetch falso e mais acoplamento.
- **Guia acoplado ao controller (inline)** vs. **componente de lib via bridge:**
  componente de lib (reuso, testes, e possível reuso pelo Shopping v5.2.0 GoalsModal) —
  escolhido.
- **Tooltip/coach-marks sobre a modal real** vs. **wizard em modal separada:** o PO
  pediu explicitamente **wizard** ("ver tudo em wizard", "recarregar todo o conteúdo da
  modal") — modal separada com passos, escolhida. (Coach-marks overlay sobre a modal
  real fica como alternativa futura, mais frágil a mudanças de layout.)

## Risks & mitigations

- **Drift guia × modal:** ver Drawbacks; DoD + fixtures versionadas.
- **Extensão do shell quebrar callers atuais:** manter `steps` **opcional**; sem
  `steps`, comportamento idêntico ao atual (testes de regressão do onboard).
- **Vazamento de rede no "modo com dados":** garantir que o adapter mock é a **única**
  fonte no caminho do guia; teste que falha se qualquer `fetch`/XHR for chamado durante
  o tour.
- **Auto-open intrusivo:** gated por atributo **default OFF** + flag de persistência.

## Open questions (para o Product Owner)

1. **Overlay ou substituição?** O tour é uma **modal separada por cima** do painel (o
   painel continua atrás) ou **"recarrega todo o conteúdo da modal"** Metas (substitui
   o corpo do `#myio-goals-compare-root` e restaura ao fechar)? Este RFC recomenda
   **modal separada** (mais simples, isola o mock do estado real); confirmar.
2. **Snapshot standalone vs. mini-painel vivo:** aceitar snapshots ilustrativos na
   Fase 1 (recomendado) e deixar o mini-painel vivo com adapter falso como Fase 2?
3. **Auto-open first-run:** habilitar? Sob qual atributo/condição (só MyIO? todos?)?
4. **i18n:** manter só pt-BR agora, ou já estruturar o texto do tour como dicionário
   de strings para futura tradução?
5. **Persistência:** `localStorage` no browser está OK, ou preferem atributo
   SERVER_SCOPE por usuário (sincroniza entre dispositivos)?
6. **Escopo do reuso:** o mesmo `metas-guide` deve servir também o **GoalsModal do
   Shopping v5.2.0** (RFC-0046/RFC-0225) numa fase seguinte, ou é HO UNIQUE-only?
7. **Rótulo do botão:** `?` (texto) ou `❓` (emoji)? Tornar Engine icon-only quebra
   algum aprendizado/expectativa do usuário atual?
8. **Ícone/`?` também no Shopping:** se sim, o botão "?" entra no GoalsModal também.

## Adoption / rollout

- **Fase 1 — botão "?" + tour estático (mock).** Engine icon-only + botão `data-help`
  no `data-controls`; `openMetasGuide` como componente de lib (via bridge `LIB_SYMBOLS`)
  com as 11 seções e **snapshots ilustrativos** populados por fixtures embutidas.
  Extensão `steps` no `openOnboardModal` **ou** navegação inline (B) — o que couber no
  sprint. **HO UNIQUE primeiro.**
- **Fase 2 — snapshot "vivo".** Opcional: renderizar o card via
  `createCustomerGoalsCard` (RFC-0217) com dados mock e/ou um mini-painel dirigido pelo
  **adapter de fetch falso** (fidelidade 1:1, ainda sem rede). "Não mostrar novamente"
  + auto-open first-run gated.
- **Fase 3 — reuso.** Avaliar servir o **mesmo guia** no GoalsModal do Shopping v5.2.0
  (Open question 6), parametrizando as fixtures/domínios.

## Tracking (Jira ED)

- **Épico sugerido (ED):** "Metas × Consumo — guia de uso (wizard) em dados mock".
- **ED-child A (Fase 1):** botão "?" + Engine icon-only + `openMetasGuide` (11 seções,
  snapshots mock, fixtures co-locadas) + extensão `steps` (ou inline) no onboard.
- **ED-child B (Fase 2):** snapshot vivo (createCustomerGoalsCard / adapter fetch
  falso) + "não mostrar novamente" + auto-open gated.
- **ED-child C (Fase 3):** reuso no Shopping v5.2.0 GoalsModal (se aprovado).
- **QA:** validar isolamento (nenhuma chamada de rede durante o tour), paridade de
  cores/rótulos com o card real, a11y (focus trap, teclado, aria), tema light/dark.

## Referências de código (ground)

- Modal Metas: `src/thingsboard/MYIO-SIM/v5.2.0_UNIQUE/controller.js` —
  `openGoalsCompare(shoppings)` (~L3876); root `#myio-goals-compare-root` (~L4002);
  header/toolbar (~L4010–4046: `data-tabs`/`data-domain`, `data-period`,
  `data-period-preset`, `data-view`, **`data-engine`** ⚙️ Engine); cards
  `data-cards-grid`/`.myio-cgc` + toggles `data-year-toggles`; sidebar
  `data-side`/`data-table`/`data-side-order`/`data-side-filter`/`data-side-total`
  (~L4072–4085). Cores das séries: Realizado `#2563eb`, A-1 `#94a3b8`, Orçado
  `#f59e0b`, Meta `#7c3aed` (~L3996–4142).
- Shell do wizard: `src/components/onboard/openOnboardModal.ts`,
  `OnboardModalView.ts`, `types.ts`; export em `src/index.ts` (~L1217).
- Referência de UX/pattern: `src/components/premium-modals/settings/annotations/`
  (`AnnotationsTab.ts`, `sampleAnnotations.json`, `types.ts`).
- Card de referência (Fase 2): `createCustomerGoalsCard` (RFC-0217).

## Histórico

- **v0 (2026-07-17):** rascunho inicial (design only). Botão "?" + wizard mock;
  recomenda extensão `steps` do onboard + componente de lib `metas-guide` via bridge;
  snapshots ilustrativos em fixtures co-locadas; 8 open questions para o PO.
