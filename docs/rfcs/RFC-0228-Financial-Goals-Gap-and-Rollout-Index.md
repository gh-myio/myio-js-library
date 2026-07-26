# RFC-0228: Financial Goals — Gap Analysis & Rollout Index

- Feature Name: `financial_goals_gap_and_rollout_index`
- Start Date: 2026-07-25
- RFC PR: (leave this empty)
- Tracking Issue: (suggest a Jira epic; one child issue per track below)
- Status: **Proposed — index/gap RFC. Does not itself implement; it catalogs and sequences the work that turns GCDR's RFC-0054 from a backend contract into a delivered, end-to-end "metas financeiras" capability in the dashboards.**
- Builds on (**GCDR** repo, not this one): **GCDR RFC-0054** (Monetary Goals & Hourly Tariffs — APPROVED & FROZEN — `gcdr.git/docs/rfcs/RFC-0054-Monetary-Goals-and-Customer-Tariffs.md`), **GCDR RFC-0046** (Consumption Goals), **GCDR RFC-0052** (Goal Margin).
  > ⚠️ **Namespace:** os RFCs de Goals 0046/0052 estão no **GCDR**. Neste repo, RFC-0046/RFC-0052 são de assuntos **não relacionados** (race condition / cache) — não confundir. Sempre que este documento cita 0046/0054/0052, é o **GCDR**.
- Related (this repo): RFC-0075 (setup panel / metas legadas em TB SERVER_SCOPE — precedente de persistência), RFC-0217 (CustomerGoalsCard / small multiples), RFC-0222 (`openPricingPanel` — protótipo de tarifas), RFC-0225 (Metas Period Goal/KPI + gating de domínio), RFC-0227 (wizard da modal Metas).
- Spans repos: `gcdr` (backend/API) and `myio-js-library` (dashboards, `openPricingPanel`, Metas × Consumo). This index lives here because the visible feature — money in the panels — is a `myio-js-library` deliverable (OKR *"Metas financeiras e indicadores no painel do Head Office"*).

---

## Summary

GCDR's RFC-0054 froze a **correct, honest backend contract** for money: hourly customer tariffs, a `withMoney` overlay on quantity goals, and native `CURRENCY` budget goals. It deliberately stopped at the API boundary. **Nothing consumes it yet**, and several of its own §Future / §Unresolved items are hard prerequisites for the feature to be usable across the production base.

This RFC is the **index**: it enumerates every difference between "RFC-0054 as frozen" and "financial goals delivered end-to-end", groups them into **three tracks**, orders them by **dependency**, and names the **child RFC** that should own each. It invents no new product scope beyond what RFC-0054 already deferred plus the frontend integration that RFC-0054 names as its client contract (DEC-13, §Future).

**One-line thesis:** the backend is a frozen contract with **no consumer** and **one structural coverage gap** (customer-granular money). Wire the frontend for **curated/pilot** customers *in parallel* with measuring the base and deciding the coverage fork; the **broad** Head-Office rollout waits on that decision. Deferred tariff-model evolution blocks nothing.

> **Correção vs v0 (feedback-v1 §2):** uma versão anterior tratava a cobertura customer-granular (**B1**) como pré-requisito de *toda* entrega de frontend. Errado: RFC-0054 mantém o overlay device-granular em v1, e a UI pode entrar honestamente para clientes device-granular curados atrás de um gate. **B1 é gate do rollout AMPLO, não pré-requisito de implementação.**

---

## Motivation

- **A frozen contract nobody reads is not a feature.** RFC-0054 §Future item 1 ("wire `openPricingPanel` to the tariff bucket API, dropping the `localStorage` stub") and the OKR *"Metas financeiras e indicadores no painel do Head Office"* both depend on a frontend that does not exist yet.
- **The coverage gap decides whether the money view is usable at all.** RFC-0054 hard-requires **device-granular** goals for `withMoney` (DEC-5) and flags, as a Phase-2 rollout gate, that the count of production device-granular goals is **unknown** and probably low — so a naive rollout would return `money: MONEY_REQUIRES_DEVICE_GRANULARITY` (or `coverageComplete:false`) for most of the base. This is the single highest-leverage difference.
- **The deferred model evolution is real but not on the critical path.** TE/TUSD/bandeiras, tiered water, and multi-currency are genuine, but they are `tariff_model` extensions behind the `FLAT` baseline and must not block the first honest R$ view.

---

## The frozen baseline (what RFC-0054 already delivers)

Recorded so every gap below is a genuine delta, not a re-spec.

| Capability | Status in RFC-0054 |
|---|---|
| Hourly tariffs `(customer × domain × category × year)`, `R$/unit`, `FLAT`, BRL | Spec'd (Phase 1) |
| `devices.tariff_category` (`COMMON_AREA` / `SPECIFIC`, explicit) | Spec'd (Phase 1) |
| `?withMoney=true` overlay on **device-granular** quantity goals | Spec'd (Phase 2) |
| Honest partial coverage (`coverageComplete`, `tariffCoverageGaps`, `uncategorizedDevices`) | Spec'd |
| Native `CURRENCY` budget goals (`measure=CURRENCY`) + `withinBudget`/`variance` | Spec'd (Phase 3) |
| Optimistic concurrency (`version`/`ETag`/`If-Match`), stable error `code`s | Spec'd |
| Backend-authoritative rounding + nominal-civil-hour calendar (golden vectors) | Spec'd |

> **Implementation status is out of this RFC's scope** — it plans the *differences*, not the build state of RFC-0054's own phases. Confirm which of Phases 1–3 have shipped before scheduling any dependent item below.

---

## Gap catalog

Each gap is `[ID] title — repo — depends-on — value`. Value/effort are relative (P small · M medium · G large).

### Track A — Frontend financeiro (`myio-js-library`) — consume RFC-0054

These are the OKR *"Metas financeiras e indicadores no painel do Head Office"*. None exist today.

| ID | Difference | Depends on | Effort | Value |
|---|---|---|---|---|
| **A1** | **`openPricingPanel` → API real de tarifas.** Hoje `localStorage` + shape month/range + `pricePerKwh` numérico (confirmado: `src/components/pricing-panel/types.ts`). Vira **adaptador cliente** (RFC-0054 DEC-13): edição day/band expande para buckets horários no PUT/PATCH, e no GET colapsa horas iguais contíguas em bandas. Remove o stub. ACs concretos ficam no RFC-filho (RFC-0222 revisão), não aqui. | RFC-0054 Fase 1 | M | Alto |
| **A2a** | **Overlay de dinheiro no Metas × Consumo (piloto).** R$ ao lado de kWh/m³ via `?withMoney=true` para clientes **device-granular curados**, atrás de feature/coverage gate. Chip de desvio em R$. | RFC-0054 Fase 2 · **A4** | M | Alto |
| **A2b** | **Rollout amplo do HO.** Habilitar o overlay para a base de produção. | **B2** + decisão **B1** | P | Alto |
| **A3** | **Budget nativo na UI.** Ler/exibir a meta `CURRENCY` e o bloco `budget` (projeção × target, `withinBudget`), com o **veredito suprimido** quando `coverageComplete:false` — a UI nunca declara in/over-budget sobre projeção parcial (RFC-0054 DEC-6). | RFC-0054 Fase 3 | M | Alto |
| **A4** | **UI honesta de cobertura.** Renderizar `uncategorizedDevices` e `tariffCoverageGaps` como estado explícito (não erro, não R$ 0). É a face de UX da disciplina do backend. | RFC-0054 Fase 2 | P | Alto |
| **A5a** | **UI de gestão de `tariff_category` por device.** Ver/filtrar/editar em massa `COMMON_AREA`/`SPECIFIC` (explícito, nunca inferido). Deep-link a partir dos `uncategorizedDevices` de A4. Ecoa a disciplina do RFC-0207 (classificar por atributo explícito, nunca por nome). **Depende do contrato B6** (não construir UI contra API de device presumida). | **B6** | P | Alto |
| **A6** | **R$ em AllReportModal / energy summaries.** R$ ao lado de kWh/m³ no relatório e nos resumos, no contrato de arredondamento DEC-8. | A2a | M | Médio |
| **A7** | **Variância realizado-vs-meta em R$** para consumidores RFC-0182 / RFC-0217. | A2a | P | Médio |

> ⚠️ **Colisão de nomes `budget` (fácil de virar bug — resolver no RFC-0229).** Três conceitos R$ distintos vão coexistir na UI:
> - **`budget` já existe** nos componentes locais como a linha **Meta / Orçado** (quantidade — `CustomerGoalsCard/types.ts`: `budget`/`budgetBreakdown`/`orcado`, RFC-0052 adjustedValue). **Não é dinheiro.**
> - **`money`/`monetaryValue`** (RFC-0054) = projeção R$ derivada de `withMoney=true`.
> - **`budget` block** (RFC-0054, `measure=CURRENCY`) = orçamento R$ nativo + veredito (`withinBudget`/`variance`).
>
> Sem um contrato de nomes, o frontend mistura os três. A **tabela completa** de renomeação/wrappers pertence ao **RFC-0229**; aqui fica só o alerta.

### Track B — Cobertura & consumo do backend (`gcdr`) — desbloqueia o frontend na base real

O gargalo do rollout **amplo** (A2b). Sem B1, o overlay mostra "sem cobertura" para a maioria dos clientes — o piloto (A2a) segue válido para device-granular curados.

| ID | Difference | Depends on | Effort | Value |
|---|---|---|---|---|
| **B1** | **Money em meta customer-granular** — o **gate do rollout AMPLO** (A2b), não pré-requisito de A2a. RFC-0054 §Unresolved #1: hoje `withMoney` exige goal device-granular; a maioria em produção pode ser customer-granular → `MONEY_REQUIRES_DEVICE_GRANULARITY`. Fork (a decidir após B2): (i) `tariff_category` default por customer para precificar metas não-device; (ii) curadoria para tornar metas device-granular; (iii) híbrido. | RFC-0054 Fase 2 · B2 | M–G | Crítico |
| **B2** | **Medição do gate da Fase 2.** RFC-0054 DEC-12 pede: contar quantas metas de produção são device-granular e definir curadoria — **antes** de habilitar o overlay amplamente. É a evidência que decide o fork B1. | — | P | Crítico |
| **B3** | **CSV import/export de tarifas** (paridade com o CSV de goals). Operacionaliza a entrada de tarifas em escala. | RFC-0054 Fase 1 | M | Médio |
| **B4** | **`withMoney` default** — opt-in (proposto) vs auto quando há tarifa (RFC-0054 §Unresolved #3). Decisão de contrato que afeta todo consumidor. | — | P | Médio |
| **B5** | **View inversa: meta `CURRENCY` → quantidade implícita** via tarifas (RFC-0054 §Future). | RFC-0054 Fase 3 | M | Baixo |
| **B6** | **Contrato de `tariffCategory` na API de device (gcdr).** Onde vem a lista de devices, qual endpoint escreve, RBAC de escrita, auditoria/histórico, edição em massa. Par backend de **A5a** — o frontend não deve ser construído contra uma API de device presumida. | RFC-0054 Fase 1 | M | Alto |

### Track C — Evolução do modelo de tarifa (`gcdr`) — deferido, fora do caminho crítico

Extensões de `tariff_model` além do `FLAT`. **Não devem bloquear a primeira visão de R$.**

| ID | Difference | Depends on | Effort | Value |
|---|---|---|---|---|
| **C1** | **Tarifa decomposta** (TE/TUSD, impostos, bandeiras) como novos `tariff_model`; `FLAT` continua baseline compatível. | RFC-0054 Fase 1 | G | Médio |
| **C2** | **Água escalonada/progressiva + esgoto** (tiers) — RFC-0054 §Unresolved #2 condiciona à medição do piloto se `FLAT` water é usável. | RFC-0054 Fase 1 · B2 | G | Médio |
| **C3** | **Multi-moeda** (a coluna `currency` já existe). | RFC-0054 Fase 1 | M | Baixo |

---

## Dependency order (o caminho crítico)

```
RFC-0054 Fase 1 (tarifas)  ──► B6 (API device tariffCategory) ──► A5a (UI categorizar)  ──► A1 (pricing panel real)
                                                                        │
RFC-0054 Fase 2 (overlay)  ──► A4 (UX cobertura) ──► A2a (overlay R$ piloto) ──► A6, A7
                                     │
                               B2 (medir device-granular) ──► B1 (fork cobertura) ──► A2b (rollout amplo)
RFC-0054 Fase 3 (budget)   ────────────────────────────────────────────────────► A3 (budget na UI)

Track C (C1/C2/C3)  — paralelo, sem bloquear A/B; entra por demanda de cliente.
```

**Sequência recomendada:** **B6 → A5a → A1** (tarifas + categorização na UI) em paralelo com **B2** (medir a base); então **A4 → A2a → A3** (a face do OKR, piloto honesto); a decisão do fork **B1** libera **A2b** (rollout amplo); depois **A6/A7** e **B3/B4**; **Track C** por último, dirigido por cliente.

---

## What each child RFC should own

| Child RFC (proposto) | Repo | Cobre | Nota |
|---|---|---|---|
| **RFC-0222 (revisão)** | myio-js-library | **A1** — `openPricingPanel` como adaptador da API horária | RFC-0222 já existe; esta é a evolução prevista na §Prior art do RFC-0054 |
| **RFC-0229 "Metas Financeiras — Frontend HO"** | myio-js-library | **A2a, A2b, A3, A4, A5a, A6, A7** | O RFC do OKR O6. Consome `withMoney`/`budget`; UI honesta de cobertura; **dona da tabela de ponte de nomes** (`budget` × `currencyBudget` × `monetaryProjection`) e do tipo normalizado de `money` |
| **gcdr RFC-00xx "Customer-granular money + device tariffCategory API"** | gcdr | **B1, B2, B4, B6** | O desbloqueador de rollout; decide o fork do `tariff_category` × curadoria; contrato de escrita/auditoria de `tariffCategory` no device (par de A5a) |
| **gcdr RFC-00xx "Tariff CSV & inverse view"** | gcdr | **B3, B5** | Operacional; independente |
| **gcdr RFC-00xx "Tariff model evolution"** | gcdr | **C1, C2, C3** | `tariff_model` além de `FLAT`; deferido |

> Números concretos a atribuir na criação: **myio-js-library** próximo livre = **RFC-0229**; **gcdr** conforme a sequência daquele repo (após RFC-0054).

---

## O que precisa mudar em `gcdr.git/docs/api/API-Financial-Goals.md`

O guia de API está **correto para o que RFC-0054 congelou**. As mudanças abaixo só entram **quando** as trilhas correspondentes forem aprovadas — não antes (senão a doc promete o que não existe, o padrão que a auditoria RFC-0207 nos ensinou a evitar). **Uma exceção pode entrar já** (é consistência de contrato, não escopo novo):

- **IMEDIATO — normalizar o shape de `MONEY_REQUIRES_DEVICE_GRANULARITY`.** A §4.2 do guia mostra `money: { "reason": "MONEY_REQUIRES_DEVICE_GRANULARITY" }` (objeto), mas o texto de contrato do RFC-0054 fala em `money` `null` com `reason` — estruturalmente impossível (`null` não carrega campo). Fixar **um** shape na dupla guia/RFC-0054 antes de qualquer UI ramificar. (O RFC-0229 pode absorver via adaptador se o backend já estiver congelado, mas a ambiguidade tem que ser sinalizada.)
- **B1 aprovado** → documentar o caminho de money para meta **customer-granular** (hoje a §4.2 diz `MONEY_REQUIRES_DEVICE_GRANULARITY` como estado terminal). Descrever a fonte do `tariff_category` default por customer, se adotada.
- **B4 decidido** → fixar o default de `withMoney` (a §3 hoje diz "defaults to QUANTITY / omitting keeps byte-identical"; o default de `withMoney` em si não está pinado).
- **B3** → nova seção de CSV de tarifas (paralela ao CSV de goals citado em §8).
- **C1/C2/C3** → novos valores de `tariff_model` na §3 (Tariffs) e no `tariff_model CHECK`; hoje só `FLAT`.
- **A1 (DEC-13)** → a nota de rollout da §8 pode referenciar o adaptador cliente quando o pricing panel for religado.
- **Pendência já aberta no RFC-0054** (§Unresolved): o anchor de remoção do alias `pricePerKwh` (`v(GA+3)`) precisa do número de GA concreto — casar com a cadência de release do widget (`myio-js-library`).

Nenhuma dessas é mudança **agora**: são o checklist de sincronização doc↔contrato à medida que cada trilha fecha.

---

## Drawbacks & non-goals

- **Este RFC não implementa nada** — é índice. O risco é virar backlog inflado se os filhos não forem criados; mitigação: cada linha do catálogo vira uma issue rastreável.
- **Não re-especifica RFC-0054** nem reabre suas decisões congeladas (calendário, arredondamento, device-granularity em v1, `FLAT`). Ele parte delas.
- **Não presume o estado de implementação** das Fases 1–3 do RFC-0054 — confirmar antes de agendar dependentes.

## Unresolved (a decidir ao abrir os filhos)

- **B1 é o fork mais pesado:** default de `tariff_category` por customer (rápido, menos preciso) × curadoria para device-granular (correto, caro) × híbrido. A medição **B2** deve preceder essa decisão.
- **Ordem A vs B:** religar o pricing panel (A1) e o piloto honesto (A2a) dão valor cedo para clientes device-granular curados; só o **rollout amplo (A2b)** espera o fork **B1**. Recomenda-se A1/A5a e B2 em paralelo, e adiar a decisão de B1 até a medição de B2.
- **RFC-0229 deve fixar** a ponte de nomes de `budget` e o tipo normalizado de `money` (estados `available` × `unavailable/reason`) antes da primeira UI — insumos vindos do feedback-v1 (§3, §6), fora deste índice.
