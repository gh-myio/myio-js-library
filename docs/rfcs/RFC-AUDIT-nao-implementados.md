# RFC-AUDIT — O que **não** está implementado no corpus de RFCs

- **Escopo**: os **277 arquivos `.md`** em `docs/rfcs/`. Nada fora daí (`.claude/worktrees/**`
  e `node_modules` foram explicitamente excluídos como cópias obsoletas).
- **Data**: 2026-07-23/24 · Branch: `desenv`
- **Método**: inventário barato sobre os 277 → verificação profunda **apenas** nos que se
  declaram construídos → mineração de pendências dentro dos parcialmente construídos.
- **Padrão de evidência**: herdado de
  `docs/rfcs/RFC-0207-CustomerScopedDeviceClassificationProfile.md` § *Estado verificado
  (auditoria 2026-07-23)*. Toda afirmação sobre código carrega `arquivo:linha`.

> **Tese desta auditoria.** O campo `Status` do topo dos RFCs **não é evidência** — é uma
> alegação a ser testada. O caso que motivou este padrão: o RFC-0207 declarava
> `Phase B — Implemented (… premium MENU management modal)` com o bloco de
> *implementation status* descrevendo `view/edit/preview/save`, enquanto
> `saveDeviceClassificationProfile` — o método que o MENU chama — **não existia em
> lugar nenhum do repositório**. Era só consumido, nunca definido; o botão "Salvar"
> lançava em runtime.
>
> O campo erra nas **duas** direções. Há RFCs que declaram entrega e não entregaram
> (§2), e há RFCs implementados e mergeados que continuam declarando "design only"
> (§2.2). As duas formas custam caro: a primeira produz bug em produção, a segunda
> produz retrabalho.

---

## 1. Resumo executivo

### 1.1 Tamanho real do corpus

| Métrica | Valor |
|---|---|
| Arquivos `.md` em `docs/rfcs/` | **277** |
| Números de RFC distintos | **171** |
| Arquivos com número de RFC no nome | 263 |
| Arquivos sem número (planos, comparativos, `daterangepicker-*`, `premium-dashboard-modals`, …) | 14 |

O corpus tem **inflação documental**: 171 números geram 263 arquivos porque cada RFC
arrasta `.draft`, `.rev-00N`, `-feedback`, `-IMPLEMENTATION-PLAN`, `-REVIEW-SUMMARY`.
Casos extremos: RFC-0053 (6 arquivos), RFC-0096 (6), RFC-0111 (6), RFC-0152 (6),
RFC-0057 (5), RFC-0093 (5). Isso importa para a auditoria porque **o `Status` de um
RFC costuma viver num arquivo e a realidade em outro** — o RFC-0207 é o exemplo
canônico (a pendência estava enterrada num addendum, não no cabeçalho).

### 1.2 Baldes de `Status`

As strings são inconsistentes (`Implemented`, `Implementado`, `PRODUCTION READY 🚀`,
`SHIP READY 🚀`, `Ready for Implementation`, `Draft`, `Proposed`, `PROPOSTO`,
`Accept with changes`, `Implementing`, `Histórico`, …). Normalizadas:

| Balde | Arquivos | Tratamento nesta auditoria |
|---|---|---|
| **A — Auto-declaram NÃO construído** (Draft / Proposed / Ready for Implementation / awaiting approval / design only / PLANNING) | **~88** | Aceitos pela palavra. §3. Sem verificação de código. |
| **B — Alegam entrega** (Implemented / Implementado / PRODUCTION READY / SHIP READY / Implementing / Aceito-implementado / Histórico-implementada) | **~32** | **Verificados**. §2. |
| **C — Sem campo `Status` utilizável** | **~157** | Não classificados. Ver §5 — este é o maior limite da auditoria. |

> Os totais são aproximados de propósito: alguns `Status` são ambíguos por construção
> (`RFC-0054`: *"Aceito — Implementação **recomendada**"* — aceito não é entregue) e
> vários "hits" de status são falso-positivo de bloco de código (`status: 'online' | 'offline'`
> em `RFC-0152`, `RFC-0158`, `RFC-0165`, `RFC-0185`, tabelas em `RFC-0104`/`RFC-0105`/`RFC-0109`).
> Preferi somar aproximado e declarar a imprecisão a apresentar um número falso.

### 1.3 A manchete

De **~32 arquivos que alegam entrega**, **6 falharam a verificação** de forma
substantiva (§2.1) e **1 gate de engenharia documentado como vigente não é executado**
(§2.1 · D-2). Na direção oposta, **9 RFCs estão implementados e continuam declarando
"Draft" / "Proposed — design only" / "awaiting approval"** (§2.2).

**O `Status` errou em ~16 dos ~32+9 casos examinados. É uma taxa de erro alta o
suficiente para que o campo não deva ser usado como fonte em nenhuma decisão de
planejamento.**

---

## 2. ⚠️ Divergências `Status` × código

### 2.1 Alegam entrega, verificação falhou

#### D-1 · RFC-0207 — o bug do `saveDeviceClassificationProfile` foi corrigido no v-5.2.0 e **permanece intacto no v-5.4.0** · **Alta**

O `Status` do RFC-0207 (já corrigido em 2026-07-23) declara
`Phase B — Implemented (store = TB SERVER_SCOPE). Load **e** save operacionais`.
No caminho **v-5.2.0 isso agora é verdade**:

- Definição real: `MAIN_VIEW/controller.js:1441` — `async function rfc0207SaveActiveProfile(nextProfile)`
- Exposição no orquestrador: `MAIN_VIEW/controller.js:8282` —
  `saveDeviceClassificationProfile: (nextProfile) => rfc0207SaveActiveProfile(nextProfile)`
- (Há também um *guard* anterior em `MAIN_VIEW/controller.js:2149` que avisa
  "chamado antes do orquestrador estar pronto" — é stub de ordem de boot, não a implementação.)
- Consumidor: `MENU/controller.js:825`

**Mas o v-5.4.0 continua sendo exatamente o caso original do achado 1:**

- `v-5.4.0/controller.js:431` — `const saver = window.MyIOOrchestrator?.saveDeviceClassificationProfile;`
- `v-5.4.0/controller.js:434` — lança
  `'Persistência do perfil indisponível: saveDeviceClassificationProfile (GCDR) não conectado.'`
- **Nenhuma definição** de `saveDeviceClassificationProfile` existe no v-5.4.0. O
  `grep` sobre `src/` retorna 9 ocorrências: 4 são consumo (v-5.4.0 ×2, MENU ×2),
  3 são comentário no MAIN_VIEW, e só 2 são definição — **ambas no MAIN_VIEW do v-5.2.0**.

O v-5.4.0 não tem widget MAIN_VIEW separado (é *single-controller*, 3.272 LOC), então
não herda a correção. **O botão "Salvar perfil" do v-5.4.0 continua quebrado em runtime.**
Isso é o achado 1 do RFC-0207 deslocado de versão, não resolvido.

> **Nota de proveniência.** Não pude datar quando `rfc0207SaveActiveProfile` entrou —
> comandos `git` estavam fora do escopo desta auditoria. O contexto informado (PR #108,
> mergeado) indica que é **muito recente**. Trate a correção do v-5.2.0 como *acabou de
> pousar*, não como código maduro.

#### D-2 · Gate de tamanho de bundle: documentado como vigente, **não é executado**, e o orçamento está estourado ~218× · **Alta**

O `CLAUDE.md` do projeto documenta: *"Bundle size limits (enforced by
`scripts/size-check.js`): ESM/CJS ≤50KB, UMD ≤60KB, minified UMD ≤25KB"*. A palavra
é **enforced**. Verificação em `package.json`:

```
"prebuild":  "node scripts/gen-baked-profile.mjs --check"
"build":     "npm run clean && npm run build:tsup && npm run build:umd && npm run minify:umd"
"postbuild": "node scripts/verify-dts.js"
"size-check":"node scripts/size-check.js"      ← script isolado, ninguém o chama
```

`size-check` **não é invocado por `build`, `prebuild`, `postbuild`, `test` nem `release`**.
Os scripts `scripts/size-check.js` e `scripts/check-bundle-size.mjs` existem — são
código alcançável apenas por invocação manual, que nada dispara.

Estado real do `dist/`:

| Artefato | Tamanho | Limite | Fator |
|---|---:|---:|---:|
| `myio-js-library.umd.min.js` | **5.459 KB** | 25 KB | **~218×** |
| `myio-js-library.umd.js` | 6.756 KB | 60 KB | ~113× |
| `index.js` (ESM) | 5.219 KB | 50 KB | ~104× |
| `index.cjs` | 5.327 KB | 50 KB | ~107× |

Um gate desligado cujo orçamento está estourado duas ordens de grandeza não é um gate —
é documentação falsa. Qualquer RFC que assuma esse limite como restrição vigente está
raciocinando sobre uma premissa que não existe.

#### D-3 · RFC-0226 — o stub que o próprio RFC manda remover continua vivo · **Média**

`Status: Accept with changes — consolidated`. O RFC lista, no item (c), *"remover o
stub de KPI (`#show-kpis-btn` → `alert('… to be implemented')`)"*, e cita a localização
em `RFC-0226…md:62`: *"KPI stub: `#energy-kpi-btn`/`#show-kpis-btn` `:543-549`, handler `:1481` (alert)"*.

O stub está **exatamente onde o RFC disse que estava**, intocado:

- `src/components/premium-modals/energy/EnergyModalView.ts:544` — `<div id="energy-kpi-btn" style="display: none; …">`
- `src/components/premium-modals/energy/EnergyModalView.ts:545` — `<button id="show-kpis-btn" …>`
- `src/components/premium-modals/energy/EnergyModalView.ts:1483-1485`:
  ```js
  // TODO: Open KPI modal here
  dbg('[EnergyModalView] Show KPIs modal clicked');
  alert('KPI modal functionality to be implemented');
  ```

Nenhum dos itens (a)–(g) foi construído: sem KPIs unit-aware, sem `"(i)"` de dispositivo,
sem `createModalFooter` no EnergyModal, sem novo PDF. Grep por
`Máx|Mín|Sem Consumo|premium-footer|myio-footer-modal|buildPdf|exportPdf` em
`src/components/premium-modals/energy/` → **zero resultados**.

Severidade Média e não Baixa porque um `alert()` de "to be implemented" está em código
de **biblioteca publicada**, alcançável por qualquer consumidor que clique no botão.

#### D-4 · RFC-0224 — o "andaime morto" que o RFC diagnosticou continua morto · **Média-Alta**

`Status: Approved with mandatory changes — consolidated`. O RFC descreve o problema:
*"o evento que deveria coordenar a renovação (`myio:token-expired`) é **disparado mas
não tem consumidor** — é andaime morto."*

Continua assim. `myio:token-expired` é **despachado** em 3 pontos e **escutado em zero**:

- `v-5.2.0/WIDGET/MAIN_VIEW/controller.js:7646` — `window.dispatchEvent(new CustomEvent('myio:token-expired', { detail: {} }))`
- `v-5.2.0/bkp/MAIN_VIEW/controller.js:6823` (backup)
- `MYIO-SIM/v5.2.0/MAIN/controller.js:7778`

Nenhum `addEventListener('myio:token-expired')` em `src/`. E nada da arquitetura
aprovada existe: grep por `authScopeId|session-refreshed|single-flight|singleFlight`
em `src/` → **zero resultados**. Sem classificação 401/403, sem contador de geração,
sem coordenação por escopo.

Aprovado com "mandatory changes" há ~1 semana e sem nenhuma linha de código.

#### D-5 · RFC-0223 — implementado pela metade, sem `Status` que registre isso · **Média**

`RFC-0223-AllReport-PerDevice-Granularity-Sections.md` **não tem campo `Status`** (o
cabeçalho vai de `Feature Name` a `## Summary` sem ele). O que existe no código é
**metade** do especificado:

| Especificado | Onde | Implementado? |
|---|---|---|
| `type ReportMode = 'consolidado' \| '1d' \| '1h'` (`RFC-0223:179`) | — | ❌ código tem `private granularity: '1d' \| '1h'` — `AllReportModal.ts:88` |
| `private reportMode: ReportMode = 'consolidado'` (`RFC-0223:181`) | — | ❌ inexistente |
| Segmento `Consolidado` como default (`RFC-0223:90`) | — | ❌ o seletor é binário |
| Seções colapsáveis por device | — | ❌ único hit de `expandable` em `AllReportModal.ts:860` é de outro contexto |

O que **está** implementado é o seletor binário `1d`/`1h`:
`AllReportModal.ts:19` importa `createGranularitySelector`, `:470` o instancia,
`:1164`/`:1336` usam `granularity=1h` nas URLs. Ou seja: a **granularidade horária**
entrou (isso é a memória do trabalho de 2026-07-15/16), mas o **modo de três vias +
seções colapsáveis**, que é o objeto do RFC-0223, não.

#### D-6 · RFC-0225 — nada foi construído · **Média**

`Status: Accept with changes — consolidated (incorporates Revisão v1, 2026-07-17)`.
Verificação:

- Grep por `Meta do Per|metaPeriodo|periodGoalKpi` em `src/` → **zero resultados**.
- Grep por `goalCoverage|capabilities|gatedTabs|waterTabEnabled|temperatureTabEnabled`
  em `src/components/GoalsPanel.js` → **zero resultados**.

Nem o KPI "Meta do Período", nem a detecção por cobertura, nem a API de capabilities,
nem o gating das abas Água/Temperatura.

#### D-7 · RFC-0215 — `Status` aponta para uma branch que não é mais a referência · **Baixa**

`Status: Phases 1+2+3 implemented (2026-07-02) on ``feat/rfc-0207-consolidated``.`

O trabalho **está** no caminho corrente (`desenv`): `openSettingsHubModal` é definido
em `src/components/settings-hub/openSettingsHubModal.ts:295`, exportado em
`src/index.ts:939`, e consumido pelo v-5.4.0 em
`v-5.4.0/controller.js:1670-1675` (*"RFC-0215 Phase 3: the hub UI lives in the lib"*).

A divergência é de **navegabilidade**, não de entrega: o `Status` manda o leitor para
uma feature branch em vez de dizer "mergeado". Um leitor que não encontre a branch
concluirá que não foi entregue. Baixa, mas é a mesma classe de defeito.

---

### 2.2 Stale na direção **oposta** — implementados, ainda declarando "não implementado"

Esta seção existe porque o erro do `Status` não é unidirecional. Os itens abaixo
**passaram** a verificação (símbolo definido **e** alcançado) mas seguem com `Status`
de não-construído. Custo: retrabalho e RFCs "propostos" que já são fato consumado.

| RFC | `Status` declarado | Realidade verificada |
|---|---|---|
| **RFC-0200** `deviceIcons` | `Draft — Design In Progress` | **Implementado e alcançável.** Definido em `src/utils/devices/deviceIcons.ts`; exportado em `src/index.ts:104-112` (`deviceIcons`, `getDeviceIcon`, `DEFAULT_DEVICE_ICON`, `isDeviceIconType`); **consumido em 9 arquivos** — `premium-modals/upsell/openUpsellModal.ts`, `premium-modals/settings/SettingsModalView.ts`, `premium-modals/energy/EnergyModalView.ts`, `premium-modals/energy/utils.ts`, `utils/devices/deviceTypeConfig.ts`, `utils/tooltips/DeviceComparisonTooltip.ts`, `types/domain/DomainDescriptor.ts`, `ambiente-detail-modal/`, `ambiente-group-modal/`. O objetivo declarado (consolidar as 4 cópias de `DEVICE_TYPE_CONFIG`) **foi atingido**: grep por `DEVICE_TYPE_CONFIG =` em `src/` retorna **1 único hit, e é num `.md` de documentação** (`bas-components/MAIN_BAS/docs/CARD_V6_ARCHITECTURE.md:152`), não em código. |
| **RFC-0214** header parity v-5.4.0 | `Proposed (2026-06-26) — design only, not implemented` | **Majoritariamente implementado.** Os 3 botões existem em `HeaderShoppingView.ts:194-196` (`🔔 Alarmes`, `🎫 Chamados`, `✏️ Anotações`) com badges (`:479`, `:490`, `:496`). O v-5.4.0 constrói os 3 orquestradores: `AlarmServiceOrchestrator` (`v-5.4.0/controller.js:2278`), `AnnotationServiceOrchestrator` (`:2350`), `TicketServiceOrchestrator` (`:2397`). **Ressalva real → §4.** |
| **RFC-0227** wizard de ajuda Metas | `Accept with changes — consolidated` | **Implementado e alcançável.** `openMetasGuide` definido em `src/components/metas-guide/openMetasGuide.ts:543`, exportado em `src/index.ts:1264`, **consumido** em `MYIO-SIM/v5.2.0_UNIQUE/controller.js:7172-7173` via botão `data-help` (`:4061`, `:7170`). |
| **RFC-0222** Pricing Panel | *(sem campo `Status`)* | **Implementado e alcançável.** `openPricingPanel` em `src/components/pricing-panel/openPricingPanel.ts:123`, export `src/index.ts:951`, consumo em `MYIO-SIM/v5.2.0_UNIQUE/controller.js:7043` (com guarda de disponibilidade em `:7018`). |
| **RFC-0217** CustomerGoalsCard | `PROPOSED — awaiting approval` | **Implementado.** `src/components/cards/customer-goals/v1.0.0/CustomerGoalsCard.ts` (+ `index.ts`, `styles.ts`, `types.ts`); exportado `src/index.ts:1198`. *(Nota: o caminho real é `src/components/cards/...`, não `src/cards/...`.)* |
| **RFC-0203** Header Annotations | `Approved — Ready for Implementation` | **Implementado.** `buildAnnotationServiceOrchestrator` em `src/services/annotations/AnnotationServiceOrchestrator.ts:82`, exportado `src/index.ts:2225`; painel em `src/components/header-annotations-panel/HeaderAnnotationsPanel.ts`; consumido em `MYIO-SIM/v5.2.0_UNIQUE/controller.js:1713-1715`. |
| **RFC-0205** Premium Dialog | *(sem campo `Status`)* | **Implementado.** `openConfirmDialog` / `openMessageDialog` exportados em `src/index.ts:1020`; `src/components/premium-modals/dialog/` existe. |
| **RFC-0116** AlarmsSummaryTooltip | `Draft - Nao Liberada` | **Existe e é consumido.** `src/utils/tooltips/AlarmsSummaryTooltip.ts`; export `src/index.ts:718`; consumido em `v-5.2.0/WIDGET/MAIN_VIEW/controller.js` e `src/components/menu/MenuView.ts`. "Não liberada" pode ser decisão de produto — mas o código está no caminho de execução. |
| **RFC-0152** (Fases 1–5, painéis operacionais) | *(sem `Status`; hits são falso-positivo de bloco de código)* | **Parcialmente construído.** `src/components/AlarmsNotificationsPanel/` existe completo (`View`, `Controller`, `types`, `styles`, `index`) — a Fase 4. As Fases 1/2/3/5 **não foram verificadas** — ver §5. |

---

### 2.3 Confirmados não construídos por **ausência total** de símbolo

Estes se auto-declaram não implementados (§3), mas registro a confirmação porque são
os que a memória do time cita com mais frequência como "quase prontos":

| RFC | Símbolo/artefato prometido | Verificação |
|---|---|---|
| **RFC-0218 / 0219 / 0220 / 0221** (migração de anotações TB → GCDR) | `GcdrAnnotationsClient` | Grep em `src/` → **zero ocorrências**. Nem definição, nem consumo, nem tipo. Os 4 RFCs dependem deste único componente; **nenhum dos 4 tem qualquer código**. |
| **RFC-0212** CustomerInsightModal | modal `customer-insight` | Diretório inexistente; `openCustomerInsightModal` ausente de `src/index.ts`. O próprio RFC declara `classifyGcdrDevices` como pré-requisito bloqueante. |
| **RFC-0213** ConsumptionTrendPanel | `ConsumptionTrendPanel` | Diretório inexistente; ausente de `src/index.ts`. *(O componente do qual é fork, `createConsumption7DaysChart`, existe — `src/index.ts:757`.)* |
| **RFC-0093** WebSocket Migration Study | telemetria em tempo real via WS no widget de produção | Grep por `WebSocket\|ws://\|wss://` em `src/`: os únicos hits de **código** estão em `MYIO-SIM/v5.2.0/EQUIPMENTS/controller.js` (simulador). O restante são `.md`/`.json` (Node-RED, docs). **Nada no widget shopping de produção.** |

---

## 3. RFCs que se declaram não implementados

Aceitos pela palavra — **sem verificação de código** (§5). Tabela compacta; onde há
múltiplos arquivos do mesmo número, listo o canônico.

### 3.1 Recentes / com maior probabilidade de virarem trabalho (0175–0227)

| RFC | Título (assunto em uma linha) | `Status` |
|---|---|---|
| 0175 | Alarms Real Usage — trocar mock pela API real de alarmes (+ plano de implementação, requisitos e endpoint de availability para o time de backend) | Draft |
| 0176 | GCDR Sync Modal (+ v2 com correções) | Draft |
| 0177 | Alarm Widget — widget premium single-shopping | Draft |
| 0178 | Alarm View — integração com filtro do header | Proposed |
| 0179 | Alarm Device Name Enrichment | Draft / Discussion |
| 0184 | Check & Fix Routine | Proposed |
| 0190 | User Management Modal *(o `rev-001` declara Implemented — ver §5)* | Proposed |
| 0191 | Enqueue-Close de alarmes ao desatribuir regra | Proposed |
| 0192 | Notification Log — sino no header + `log_notify` + `NotificationLogManager` | Draft — pending author review |
| 0194 | Customer Default Dashboard | Proposed |
| 0197 | Roles & Policies Management no modal de usuários | Proposed |
| 0199 | MyIOAuthContext — guard de permissão GCDR client-side | Draft — Design In Progress |
| 0201 | Sync v-5.4.0 ← v-5.2.0 (3 fases) | Draft — Design In Progress |
| 0202 | Dashboard Geradores Report (v5.2.0) | Draft — Design In Progress |
| 0206 | Utilitários de naming/geração de código (Customer/Asset/Device) + resposta ao feedback GCDR | Draft (design only) / Assessment |
| 0208 | AnnotationServiceOrchestrator — seed do datasource + gap-fetch | Draft |
| 0209 | Emagrecer o controller: classificação/agregação single-source na lib | Proposed |
| 0210 | Paridade de settings: portar 10 settings do v-5.2.0 para o v-5.4.0 | Proposed |
| 0212 | Customer Insight Modal (domain-agnostic) | Proposed — design only |
| 0213 | ConsumptionTrendPanel | Proposed — design only |
| 0216 | Extração SQL de `log_annotations` por customer | PROPOSTO — aguardando aprovação |
| 0218 | GcdrAnnotationsClient | PROPOSED — awaiting approval |
| 0219 | Migração de anotações → GCDR (shopping v-5.2.0) | PROPOSED — awaiting approval |
| 0220 | Migração de anotações → GCDR (shopping v-5.4.0) | PROPOSED — awaiting approval |
| 0221 | Migração de anotações → GCDR (head-office UNIQUE) | PROPOSED — awaiting approval |
| 0224 | Recuperação graciosa de expiração de token de ingestão | Approved with mandatory changes → **§2.1 D-4** |
| 0225 | Metas — KPI "Meta do Período" + abas Água/Temp gated | Accept with changes → **§2.1 D-6** |
| 0226 | EnergyModal — KPIs, "(i)", footer premium, novo PDF | Accept with changes → **§2.1 D-3** |

> **RFC-0214 e RFC-0227 declaram-se não implementados e **estão** implementados** — ver §2.2.

### 3.2 Backlog antigo declarado Draft/Proposed (0001–0174)

Agrupado por não ter valor listar 60 linhas individuais; nenhum foi verificado contra código.

| Faixa | RFCs em Draft/Proposed | Tema |
|---|---|---|
| 0001–0026 | 0001, 0002, 0010, 0021, 0025, 0026 | Template Card v5, TELEMETRY_INFO água, DateTimeRangePicker, Filter/Ordering Modal, Settings/Energy popups |
| 0042–0045 | 0042, 0043, 0045 | Orquestrador MAIN_VIEW, navegação por estados, EnergyModal comparison |
| 0070–0080 | 0070, 0071, 0072, 0073, 0074, 0076, 0077, 0078, 0079, 0080 | TANK/CAIXA_DAGUA, sync de deviceProfile p/ TB, EQUIPMENTS/ENERGY/FOOTER UX, limites de consumo por atributo, JSON unificado de power limits, menu, persistência do settings modal |
| 0085–0092 | 0085, 0086, 0087(.draft), 0092 | Temperature modal, datetime picker de temperatura, suite de widgets de água, TemperatureView head-office |
| 0093 | 0093 (WebSocket study) | "Draft (Study) → Ready for Implementation" — §2.3 |
| 0111–0127 | 0111, 0113, 0114, 0115, 0116, 0117, 0118, 0119, 0122, 0127 | Arquitetura single-datasource, componentes Header/Menu/Footer/Energy/Water/Temperature Panel, LogHelper, CustomerCard |
| 0135 | 0135 | Fila de notificação Telegram em rule chains |
| 0145–0149 | 0145, 0146, 0147 | Componentes Shopping: TelemetryGrid, Header, Menu |
| 0168 | 0168 | Cards de ambiente baseados em `ASSET_AMBIENT` |
| — | `daterangepicker-standardization`, `daterangepicker-implementation-plan` | Padronização do date range picker |

**Nota sobre `Status: Ready for Implementation` / `Implementation Guide` / `IMPLEMENTATION READY`.**
Tratei como **não implementado** — é o estado imediatamente anterior ao código. Afeta:
`RFC-0070-Implementation-Dashboard-Action-TANK`, `RFC-0111-…-IMPLEMENTATION-DETAILED`,
`RFC-0056-implementation-plan`, `RFC-0056-FIX-…-v1.1` (`APPROVED FOR IMPLEMENTATION`),
`daterangepicker-implementation-plan`. Um documento chamado "plano de implementação"
não é evidência de implementação — é evidência do contrário.

---

## 4. Melhorias pendentes **dentro** de RFCs implementados

Estas são as pendências que os próprios RFCs carregam, frequentemente enterradas em
addendum enquanto o cabeçalho declara entrega — o padrão exato do RFC-0207.

### RFC-0207 — Classification Profile

O `Status` (já em forma estratificada) é honesto. O trabalho restante está em
`§v3.2-G` (`RFC-0207…md:1236-1244`), **linha 1236 de um documento de 1.270** — ou seja,
invisível para quem lê o cabeçalho:

- **v2 — motor pronto, produção ainda no v1.** A árvore recursiva, o walker
  group-generic, a migração v1→v2 e a validação de invariantes existem e são
  golden-tested (`src/utils/devices/classificationNodeTree.ts`), **mas o dashboard
  executa `resolveGroup`/`resolveCategory` com `schemaVersion: 1`**. O editor do modal
  ainda edita o modelo plano. A troca é passo separado e **não é equivalente**.
- **v3.2 — adaptador `entities ↔ ClassificationNode` NÃO existe**, nem o save via
  `/entities/bulk-replace`. A mecânica HTTP do `GcdrResolveProfileSource` existe atrás
  de **flag desligada**.
- **LIB:** adaptador puro + `validateProfile` espelho + baked + arquivo key-parity +
  render de ícone (token RFC-0200) — `:1239`.
- **MAIN_VIEW:** `GcdrResolveProfileSource` (lazy 1 domínio + 304 + baked fallback) +
  `saveDomainClassification` (If-Match por domínio + 409 com reload) + cache
  `(customerId, domain, version)` — `:1240`.
- **GCDR (backend, RFC-0047):** validação cross-tree na TX do `bulk-replace`, cast
  `::jsonb` + teste anti-Moxuara, `If-Match` domain-root + 409 com `currentVersion`,
  `icon` validado contra RFC-0200, seed da role `entities:write` — `:1238`.
- **14 testes de consumidor em aberto**, todos ainda `[ ]` no checklist `§v3.2-H`
  (`:1248-1265`): anti-Moxuara, `metadata` nunca `JSON.stringify`, ordem só por
  `sort_order`, ciclo de `parent_entity_id`, alocação única de device, `rules.op`
  desconhecido → throw, isolamento de cache A→B, 304 por domínio.
- **Laço circular do `combinedOf`** (achado 3 do RFC-0207): `combinedOf` inclui
  `labelWidget`, que é a saída anterior do próprio classificador. O RFC registra:
  *"Resolver o campo sem resolver o laço não fecha a classe de bug."* **Não verifiquei
  se o laço foi fechado** — ver §5.

  > **Correção sobre o achado 3.** O campo em si **foi resolvido**: o editor agora
  > renderiza `profileContains` e a chave legada `cc`/`combinedContains` foi migrada em
  > `normalizeProfile`. Evidência: `openDeviceProfileModal.ts:426` (`/^cat-(\d+)-(dp|pc|idc|idp)$/`),
  > `:430-434` (comentário datado 2026-07-23 + `rule.profileContains`), `:113` (migração
  > de chave). Trabalho **recente** — mesma janela da auditoria do RFC-0207.

- **`saveDeviceClassificationProfile` no v-5.4.0** — §2.1 D-1.

### RFC-0227 — Metas Guide (implementado; Fases 2 e 3 abertas)

`RFC-0227…md:515-528`:

- **Fase 2 — snapshot "vivo".** Renderizar o card via `createCustomerGoalsCard`
  (RFC-0217) com dados mock e/ou mini-painel dirigido por adapter de fetch falso
  (fidelidade 1:1, ainda sem rede). Inclui **"Não mostrar novamente" + auto-open
  first-run gated** (`:525-526`). *(Verificado: RFC-0217 está implementado, então a
  dependência da Fase 2 já existe — `src/components/cards/customer-goals/v1.0.0/`.)*
- **Fase 3 — reuso.** Servir o mesmo guia no GoalsModal do Shopping v5.2.0,
  parametrizando fixtures/domínios (`:527-528`).
- **8 open questions ainda abertas** para o PO (`:496-513`): overlay vs. substituição;
  snapshot standalone vs. mini-painel vivo; habilitar auto-open first-run e sob qual
  atributo; i18n (só pt-BR ou dicionário de strings); persistência em `localStorage`
  vs. atributo SERVER_SCOPE por usuário; escopo do reuso; rótulo `?` vs `❓`; botão "?"
  também no Shopping.
- **Risco registrado e não fechado:** *"Vazamento de rede no modo com dados"* —
  garantir que o adapter mock é a **única** fonte, com teste que falha se qualquer
  `fetch`/XHR for chamado durante o tour (`:491-493`).

### RFC-0214 / RFC-0201 — paridade v-5.4.0

Apesar de o RFC-0214 estar majoritariamente implementado (§2.2), **duas lacunas
concretas permanecem no v-5.4.0**:

- **`MyIOAuthContext` (RFC-0199) ausente.** Grep no `v-5.4.0/controller.js` → **zero
  ocorrências**. O componente existe (`src/components/gcdr-auth/MyIOAuthContext.ts`,
  export `src/index.ts:1058`) e é consumido pelo `v-5.2.0/WIDGET/MAIN_VIEW/controller.js`,
  mas o v-5.4.0 não o constrói. O RFC-0201 sinaliza o risco de *deny-all* nesse cenário.
- **`STATE.itemsBase` ausente** no v-5.4.0 (grep → zero). É a estrutura que o
  RFC-0183 usa para propagar `gcdrDeviceId` até os cards. *(`gcdrDeviceId` em si
  **está** extraído no v-5.4.0 — `:138`, `:156`, `:2295`, `:2339` — então a lacuna da
  Fase 1 do RFC-0201 registrada na memória do time **foi fechada**; a que resta é a
  estrutura de estado.)*
- **RFC-0201 Fases 1/2/3** (`:557`, `:593`, `:622`) permanecem como plano de 4–7 sprints,
  com cenários de showcase próprios (`:1172`, `:1188`, `:1203`) não construídos.
- **`openMetasGuide` não chega ao v-5.4.0** (grep → ausente): o wizard do RFC-0227 só
  existe no HO UNIQUE, o que é consistente com a Fase 1 do próprio RFC-0227.

### RFC-0211 — paridade menu/footer/grid/info (Implemented, `22612fb4`)

`Future possibilities` (`RFC-0211…md:230-234`), i.e. escopo cortado:

- Portar o restante do chrome de colunas do grid (ícone `(i)`, `headerActions`,
  device-map, sync) quando o componente for re-alinhado com o v-5.2.0.
- Implementar um **picker de shopping de verdade** reagindo a
  `myio:shopping-selector-click` (hoje o evento existe sem consumidor real — mesmo
  padrão de andaime do D-4; **não verifiquei** se há listener).
- Dirigir `chartsBaseUrl` e o gate de telemetria por device a partir dos settings, para
  fechar a paridade do RFC-0210.

### RFC-0215 — Settings Hub (Fases 1+2+3 implementadas)

`Open questions` ainda abertas (`RFC-0215…md:168-176`):

- **Fonte do `isSuperAdmin` no v-5.4.0** — v-5.2.0 deriva do usuário; v-5.4.0 precisa
  escolher fonte única (`window.MyIOUtils.SuperAdmin`, `updateUserInfo({ isAdmin })`,
  ou e-mail `@myio.com.br`). Marcado como *"Decide before Phase 1"* — e as fases já
  foram implementadas, ou seja, **a decisão foi pulada, não tomada**.
- Tratamento das opções 4/6/7 na Fase 1 (esconder vs. mostrar desabilitado).
- Se a extração de `openSettingsHubModal` para a lib compensa a mudança no v-5.2.0.

### RFC-0198 — TicketsTab / FreshDesk (Implemented)

As Fases 2 e 3 estão marcadas `✅` no próprio documento (`:466`, `:473`) — sem
pendência declarada. **Não verifiquei o código** (o `createFreshdeskClient` /
`openTicketsTab` não aparecem em `src/index.ts`, mas `src/components/premium-modals/tickets/`
e `src/components/premium-modals/settings/tickets/` existem; pode ser consumo interno
por widget e não export de biblioteca). Ver §5.

---

## 5. Cobertura e limites desta auditoria

Esta seção é obrigatória e deliberadamente desconfortável. **Não afirmo cobertura que
não alcancei.**

### 5.1 O que foi verificado a fundo

**~32 RFCs/arquivos** receberam verificação mecânica de existência + alcançabilidade:

0116, 0120, 0121, 0123, 0152 (parcial), 0183, 0193, 0198 (parcial), 0199, 0200, 0201,
0203, 0205, 0207, 0211, 0212, 0213, 0214, 0215, 0217, 0218–0221, 0222, 0223, 0224,
0225, 0226, 0227, 0093 (WebSocket), + o gate de bundle size.

O procedimento por item foi: localizar o símbolo/arquivo nomeado pelo RFC → confirmar
**definição** (`function X` / `const X =` / `export … X`), não só call-site → confirmar
**consumidor** (import, chamada, evento escutado, elemento renderizado) → registrar
`arquivo:linha`.

### 5.2 O que foi aceito pela palavra

- **~88 arquivos** do balde A (§3). Se um RFC diz "Draft/Proposed", **não gastei
  verificação nele** — a alegação já está do lado conservador. **Consequência
  assumida:** se algum desses estiver implementado (como aconteceu com 0200, 0203,
  0214, 0217, 0222, 0227), **esta auditoria não o detectou**. Dado que encontrei 9
  casos assim entre os que *por acaso* toquei, **é quase certo que existam mais**
  no balde A não examinado. Este é o maior viés conhecido do relatório.
- **~14 arquivos** do balde B não foram verificados individualmente: `Fix_Filter_Modal_*`,
  `daterangepicker-ga-ready`, `daterangepicker-production-final`, RFC-0048, RFC-0053
  (4 apêndices), RFC-0054, RFC-0055, RFC-0083, RFC-0084, RFC-0087, RFC-0106, RFC-0110,
  RFC-0112, RFC-0126, RFC-0169, RFC-0170, RFC-0174, RFC-0190-rev-001. São majoritariamente
  de 2025/início de 2026 e sobre código que desde então foi reescrito. **Alegam entrega
  e não foram testados.** Dada a taxa de erro de ~40% medida nos que testei, tratar
  qualquer um deles como entregue é injustificado.

### 5.3 O que **não** consegui verificar — e por quê

| Item | Por quê |
|---|---|
| **Proveniência (quando algo entrou)** | Comandos `git` estavam fora do escopo. **Não consigo datar nenhuma linha de código.** Onde escrevi "recente"/"acabou de pousar" (RFC-0207 save, `profileContains`, RFC-0227), estou repassando o contexto informado, **não** verificação própria. Este é um enfraquecimento material do padrão de evidência: a auditoria original do RFC-0207 pegou um revisor citando testes escritos minutos antes como prova de fechamento de gap — **eu não tenho como detectar esse modo de falha**. |
| **~157 arquivos sem `Status` utilizável** | Não classificados nem verificados. São em grande parte `.draft`/`.rev`/`-feedback`/`-plan` acompanhantes, mas **alguns são o documento canônico** (RFC-0128, RFC-0141, RFC-0143, RFC-0144, RFC-0180, RFC-0181, RFC-0182, RFC-0186, RFC-0188, RFC-0195, RFC-0196, RFC-0204, RFC-0222, RFC-0223, `RFC-MAIN-REFACTOR`, `RFC-CUSTOMER-TOTALS-ALL-REPORT`, …). **Este é o maior buraco quantitativo: 57% do corpus.** |
| **Comportamento em runtime** | Toda verificação é **estática**. Não abri dashboard, não usei CDP. "Tem definição e tem consumidor" **não prova que funciona** — prova que não é o modo de falha do RFC-0207. |
| **Consumidores fora de `src/`** | Varri `src/`. Widgets publicados no ThingsBoard, `showcase/`, `tests/` e Node-RED **não** foram varridos por consumo, exceto onde citado. Uma afirmação de "sem consumidor" tem esse limite — pode haver consumidor em dashboard publicado. |
| **Laço circular `combinedOf`/`labelWidget`** (RFC-0207 achado 3) | Confirmei que o **campo** foi resolvido; **não confirmei** se o laço foi. O RFC diz explicitamente que resolver um sem o outro não fecha a classe de bug. **Não verificado.** |
| **RFC-0152 Fases 1/2/3/5** | Só a Fase 4 (`AlarmsNotificationsPanel`) foi verificada. As outras 4 fases: **não verificadas**. |
| **RFC-0198 (FreshDesk)** | Diretórios existem, exports de biblioteca não aparecem em `src/index.ts`. **Não conclusivo** — pode ser consumo interno legítimo. Não classifiquei como divergência. |
| **RFCs de backend / infra** | 0175 (endpoints de alarmes), 0191 (rule chain), 0135 (Telegram), 0216 (SQL), partes de 0207-v3.2 (GCDR) descrevem trabalho **fora deste repositório**. Ausência de código aqui **não é** evidência de não-implementação. Listados em §3 pelo `Status` declarado, sem inferência. |
| **`myio:shopping-selector-click`** (RFC-0211) | Suspeita de andaime sem consumidor por analogia com D-4. **Não verificado.** |

### 5.4 Regra de desempate aplicada

Onde a evidência foi ambígua, **inclinei para "não implementado"**. A auditoria de
2026-07-23 que serve de modelo se autocorrigiu **duas vezes**, e ambos os erros tinham
o mesmo sinal — *"o código está melhor do que o RFC diz"*. Esse é o viés natural de
quem lê `grep` com pressa: um hit parece confirmação. Inclinei contra ele
deliberadamente. Onde nem isso foi possível, escrevi **"não verificado"** — que vale
mais que uma afirmação confiante e errada.

---

## 6. Recomendações operacionais

1. **Corrigir D-1 antes de qualquer coisa.** O botão "Salvar perfil" do v-5.4.0 lança
   em runtime. É o mesmo bug que já foi diagnosticado, documentado e corrigido uma
   vez — só que na outra versão.
2. **Decidir sobre D-2.** Ou o gate de tamanho é ligado (`"build": "… && npm run size-check"`)
   com orçamento realista, ou a linha do `CLAUDE.md` que diz *enforced* é corrigida.
   Um limite de 25 KB contra um bundle de 5.459 KB não é um limite frouxo — é ficção.
3. **Remover o `alert()` do `EnergyModalView.ts:1485`** independentemente do RFC-0226.
   É uma linha; está em biblioteca publicada.
4. **Normalizar o campo `Status`.** Um vocabulário fechado (`Draft` / `Approved` /
   `Implemented (commit)` / `Partially implemented (ver §X)`) e a regra do RFC-0207:
   `Status` estratificado por fase, com a pendência **no cabeçalho**, nunca só no
   addendum. Onde houver divergência conhecida, uma seção `§ Estado verificado` datada.
5. **Auditar o balde C (157 arquivos sem `Status`)** — é onde mais provavelmente estão
   as próximas surpresas nas **duas** direções.
6. **Aposentar arquivos acompanhantes.** 171 números → 263 arquivos. O RFC-0207 já
   estabeleceu a convenção correta (absorver a série de feedback no documento canônico
   e remover os `-feedback-vN.md`). Aplicá-la ao resto reduz drasticamente a superfície
   onde um `Status` pode divergir da realidade.

---

_Auditoria somente-leitura sobre código. Nenhum RFC foi modificado. Nenhum comando
`git` foi executado. O único arquivo criado é este._
