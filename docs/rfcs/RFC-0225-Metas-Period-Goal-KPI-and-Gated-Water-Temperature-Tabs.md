# RFC-0225: Metas Modal — "Meta do Período" KPI + Gated Água/Temperatura Tabs

- Feature Name: `metas_period_goal_kpi_and_gated_tabs`
- Start Date: 2026-07-17
- RFC PR: (leave this empty)
- Tracking Issue: ED-1016 (MET-2), ED-1021 (MET-4), ED-1025 (MET-8, HO parity)
- Status: **Accept with changes — consolidated (incorporates Revisão v1, 2026-07-17)**

> **Nota de consolidação.** Versão canônica. Mantém o intento de produto e
> **substitui o contrato de implementação** pelas correções aprovadas na Revisão
> v1: KPI de meta **só para domínios aditivos** (energy/water), detecção de meta
> **por cobertura** (não `goalTotal > 0`), API de **capabilities** (sem identidade
> no modal), wiring do MENU via `currentUserEmail`, abas travadas **de fato
> inacessíveis** (a11y) e **escopo Shopping v5.2.0** (HO como follow-up verificado).

## Summary

Duas melhorias na modal de **Metas** (`GoalsModal`,
`src/components/goals-modal/GoalsModal.ts`, aberta pelo MENU do Shopping v-5.2.0 —
RFC-0046):

1. **MET-2 — KPI "Meta do Período".** Exibir a **soma da meta (ajustada) no
   período**, na unidade do domínio, **apenas para domínios aditivos** (`energy`,
   `water`), com **detecção de meta por cobertura** (não confia em
   `goalTotal > 0`). Colocado após `Total` e antes de `vs Meta`.
2. **MET-4 — Travar as abas Água e Temperatura.** Via **capabilities resolvidas**
   passadas pelo caller (`enabledDomains`); abas fora do conjunto ficam
   **realmente inacessíveis** (guard no event path, sem fetch, a11y) com cadeado +
   tooltip. `energy` sempre habilitado. O **MENU** computa as capabilities a
   partir de `window.MyIOUtils.currentUserEmail` (`@myio.com.br` → todos; senão →
   só `energy`, **fail-closed**).

MET-3/MET-6 (3 casas decimais) **já shipou** (commit `4dc965d5`) e é **non-goal**
aqui — usar o `_formatValue` existente. **MET-8** (KPI no HO v5.4.0) **não é
automático** e fica como follow-up (§HO).

## Motivation

- **MET-2:** o rodapé mostra Total/Média/Pico/vs Meta (%), mas nunca a **meta
  absoluta do período** — o número que o operador quer comparar.
- **MET-4:** metas de água/temperatura ainda são WIP; expor abas quebradas a
  clientes corrói confiança. Gate por `@myio.com.br` deixa a MyIO iterar enquanto
  o cliente vê um "não liberado" claro.

## Correções obrigatórias sobre o rascunho inicial

### P0 — Temperatura não pode ter "Meta do Período" somada
`GoalsModal` é domain-generic. Somar alvos horários/diários/mensais de **°C** não é
KPI válido. **Regra:** exibir "Meta do Período" só para `energy` e `water`; para
`temperature`, **omitir** (métrica própria — alvo médio / faixa de conforto /
cobertura de setpoint — fica fora deste RFC).

### P0 — `goalTotal > 0` não é um "tem meta" confiável
O atalho atual do chip `vs Meta`:
```ts
const goalTotal = goalLine.reduce((a, b) => a + (b ?? 0), 0);
if (goalTotal > 0) { ... }
```
converte buckets ausentes em zero (meta parcial parece cheia), **esconde meta-zero
configurada**, e colapsa "sem meta" e "tudo zero" no mesmo `0`. O rótulo "Meta do
Período" implica **cobertura completa**, mas o código não verifica.

**Detecção correta (por cobertura):**
```ts
const finiteGoalPoints = goalLine.filter(
  (v): v is number => typeof v === 'number' && Number.isFinite(v)
);
const hasGoal = finiteGoalPoints.length > 0;
const goalTotal = finiteGoalPoints.reduce((s, v) => s + v, 0);
const goalCoveragePct = labels.length ? finiteGoalPoints.length / labels.length : 0;
```
(`_buildGoalLine` já retorna `null` para bucket ausente e número para configurado —
inclusive `0`.)

**Regras de exibição (energy/water):**
- `hasGoal === true`, cobertura completa → `_formatValue(goalTotal, domain)`.
- `hasGoal === false` → `--` (ou omitir o card, consistente com o rodapé).
- Meta-zero explícita → `0,000 MWh` / `0,000 m³` (não esconder).
- Cobertura parcial → marcador sutil `Meta do Período (parcial)` ou tooltip
  `N/M pontos com meta`. **Nunca** mostrar soma parcial como alvo de período cheio.

O chip `vs Meta` deve alinhar-se à mesma semântica `hasGoal` (ainda evitando
divisão por zero), sem usar `goalTotal > 0` como único sinal.

### P0 — A fonte da meta é HÍBRIDA (grupo/entrada, annual ou device)
A meta **nem sempre existe por device**. No JSON de metas (GCDR) o
`data.granularity` é `'CUSTOMER'` **ou** `'DEVICE'`, e o `tree` tem camadas:
`annual` (escalar do **grupo**, com `value`/`adjustedValue`) · `monthly` · `daily`
· `hourly` — além de `data.devices[]` (`GoalsDeviceEntry`: `annual`/
`annualAdjusted`, `allocation: EXPLICIT|RESIDUAL`), presente só em anos `DEVICE`.

**Hoje o comum é `granularity: 'CUSTOMER'` = total do grupo de entrada**, enquanto o
**Realizado** pode vir por device. Logo `_buildGoalLine` por bucket pode retornar
tudo `null` (sem breakdown diário) **mesmo havendo meta no nível `annual` do
grupo** — e o KPI **não pode** mostrar `--` nesse caso.

**Resolução da "Meta do Período" — flexível/híbrida, nesta ordem:**
1. **Breakdown por bucket:** se `tree.<viewGran>` (daily/monthly/hourly) cobre o
   período → soma coverage-aware (§P0 acima). Caminho atual.
2. **Grupo / annual:** senão, se `tree.annual` existe → derivar do **total do grupo
   de entrada** (annual `adjustedValue` × fração do período — regra a definir).
   É o caso "como é hoje".
3. **Devices:** se `granularity: 'DEVICE'` + `data.devices[]` → somar
   `annualAdjusted` (prorated), **independente** de haver Realizado por device.
4. Nenhum → `--`.

**Regra:** o KPI usa a meta **no nível em que ela existir**, sem assumir soma de
metas por-device. **Questão em aberto:** a prorata `annual → período` (definir a
fração — ex.: dias do período / dias do ano vigente) e se, para o breakdown
parcial, mistura-se bucket + annual ou escolhe-se só uma fonte.

### P1 — API por capabilities, não por identidade
O rascunho misturava `allowedDomains` **e** `isMyioUser` (precedência ambígua) e
empurrava identidade para um componente reutilizável. **Contrato aprovado:**
```ts
type GoalsDomain = 'energy' | 'water' | 'temperature';
interface GoalsModalOptions {
  initialDomain?: GoalsDomain;
  enabledDomains?: readonly GoalsDomain[];
  disabledDomainReason?: Partial<Record<GoalsDomain, string>>;
}
```
- `energy` **sempre** habilitado.
- `enabledDomains` controla UI e navegação.
- **Política default (decidida):** a **lib** default = **todos os domínios**
  (backward-compat para outros callers); o **gate vive no MENU** e é **fail-closed**
  (sem email resolvido → `['energy']`). Isso atende o intento do MET-4 sem quebrar
  callers existentes.

Normalização única no `open()`:
```ts
function _normalizeEnabledDomains(options: GoalsModalOptions): Set<GoalsDomain> {
  const domains = options.enabledDomains?.length ? options.enabledDomains : DOMAIN_ORDER;
  const enabled = new Set<GoalsDomain>(domains.filter((d): d is GoalsDomain => DOMAIN_ORDER.includes(d)));
  enabled.add('energy');
  return enabled;
}
```

### P1 — MENU computa acesso via `currentUserEmail` (não `SuperAdmin`)
`SuperAdmin` é mais restrito (exclui `alarme@`/`alarmes@myio.com.br`) e **≠** a
regra `@myio.com.br`. v5.4.0 usa checagens mais frouxas (`includes('@myio.com.br')`
em alguns pontos). Usar o email:
```js
const email = String(window.MyIOUtils?.currentUserEmail || '').trim().toLowerCase();
const isMyioEmail = email.endsWith('@myio.com.br');
const enabledDomains = isMyioEmail ? ['energy', 'water', 'temperature'] : ['energy'];

GoalsModal.open({
  ...existingOptions,
  initialDomain: enabledDomains.includes(initialDomain) ? initialDomain : 'energy',
  enabledDomains,
  disabledDomainReason: {
    water: 'Disponível apenas para usuários MyIO',
    temperature: 'Disponível apenas para usuários MyIO',
  },
});
```
Usar `currentUserEmail` (populado pelo MAIN_VIEW), **não** o `user` local de
`fetchUserInfo()` — `openGoalsModal()` não lê esse local de forma confiável. **Não
passar o email para o `GoalsModal`.**

### P1 — Abas travadas de fato inacessíveis (a11y)
Dim + cadeado + click no-op é insuficiente para teclado/AT. `_wireEvents()` hoje
troca para **qualquer** `.gm-tab[data-domain]` — precisa **guard no event path**:
- Aba travada não dispara `_loadAndRender`; guard `if (!_enabledDomains.has(domain)) return;`.
- Domínio inicial travado cai para `energy` **antes do primeiro render/fetch**:
  ```ts
  _enabledDomains = _normalizeEnabledDomains(options);
  const requested = options.initialDomain ?? 'energy';
  _currentDomain = _enabledDomains.has(requested) ? requested : 'energy';
  ```
- Botão da aba com `disabled` **ou** `aria-disabled="true"` + tratamento de foco;
  se `disabled`, tooltip/title num **wrapper** (botões disabled não expõem tooltip
  de hover/focus de forma consistente).
- Cadeado decorativo (`aria-hidden="true"`); a razão fica como texto acessível.

### P2 — 3 casas decimais é non-goal
Já shipou em `4dc965d5`. Usar `_formatValue(value, domain)`, **não** criar formatter
paralelo. Adicionar assert de regressão: "Meta do Período" segue a mesma precisão de
Total/Média/Pico (energy/water).

## Contrato de implementação (revisado)

### 1. Estender `GoalsModalOptions` (§P1) e normalizar no `open()`.
### 2. Validar o domínio inicial (§P1) antes de montar HTML.
### 3. Renderizar abas travadas a partir do estado
Para cada `DOMAIN_ORDER`: ativa se `d === _currentDomain`; travada se
`!_enabledDomains.has(d)` (com razão de `disabledDomainReason[d]`). Guard no handler.
### 4. KPI de meta só para domínios aditivos
```ts
const canShowPeriodGoal = domain === 'energy' || domain === 'water';
const periodGoalHtml = canShowPeriodGoal
  ? `<div class="gm-stat"><span class="gm-stat-label">Meta do Período</span><span class="gm-stat-value">${
      hasGoal ? _formatValue(goalTotal, domain) : '--'
    }</span></div>`
  : '';
```
Ordem do rodapé: **1** Total · **2** Meta do Período · **3** Média · **4** Pico ·
**5** vs Meta · **6** YoY (quando houver). Cobertura parcial → sublabel/tooltip.
### 5. Autorização fora do modal — gate no MENU via `currentUserEmail` (§P1).

## Head Office v5.4.0 — escopo (MET-8)
**Paridade NÃO é automática.** Verificado: v5.4.0 não tem `GoalsModal.open` direto;
o UNIQUE usa `openGoalsPanel`/`createCustomerGoalsCard` e lógica multi-customer
própria. **Escopo deste RFC = Shopping v5.2.0 `GoalsModal`.** MET-8 (ED-1025) vira
**follow-up de verificação**: (1) identificar a superfície de Metas do HO v5.4.0;
(2) se reusar `GoalsModal`, MET-2 cobre após publish+sync; (3) se for UI própria,
replicar o KPI (com as mesmas semânticas P0). Sem um call path concreto, HO fica
**out of scope** do 0225.

## Test requirements
Não há teste direto de `GoalsModal` para rodapé/gate hoje (só cobertura de gaps em
`tests/utils/goalsCoverage.test.ts`). Mínimo:
- Energy com metas completas → "Meta do Período" via `_formatValue`.
- Water com metas completas → idem.
- Temperature → **não** renderiza "Meta do Período" somada.
- Sem metas → **não** mostra `0` enganoso (a menos que zero seja configurado).
- Meta-zero explícita → zero formatado.
- Cobertura parcial → marca como parcial / expõe cobertura.
- Não-MyIO `enabledDomains: ['energy']` → water/temperature travadas, **sem**
  `_loadAndRender`.
- `initialDomain: 'water'` com só energy habilitado → abre em energy, **sem fetch**
  de water.
- Caller MyIO com todos habilitados → três abas navegáveis.

**Aceite manual:** não-MyIO vê Energia; Água/Temp travadas; clicar numa travada
mantém o chart em Energia. `@myio.com.br` acessa as três. Formatação de
Total/Média/Pico inalterada.

## Drawbacks
- Gate client-side (esconde/trava UI, não é fronteira de segurança server-side) —
  aceitável: é feature-flag por audiência, não autorização.
- Nova opção pública (`enabledDomains`/`disabledDomainReason`) a manter.

## Alternativas
- **KPI só o %:** rejeitado — pediram o **absoluto**.
- **Esconder as abas:** rejeitado — aba **travada** comunica "restrito" melhor e
  mantém o layout estável entre MyIO e cliente.
- **Gate por atributo SERVER_SCOPE** (`goalsWaterEnabled`): mais granular a longo
  prazo; o gate por email é o mínimo pedido. Questão em aberto.

## Riscos & mitigações
- **Email não resolvido:** fail-closed → `['energy']` (cliente nunca vê WIP).
- **Formatter na fallback:** `_formatValue` já tem fallback window-independente
  (3 casas), então o KPI renderiza em showcase/testes.
- **`goalTotal === 0` ambíguo:** resolvido pela detecção por cobertura (§P0).

## Tracking (Jira ED)
- **ED-1016 (MET-2):** ACs → additive-only + coverage-aware + `_formatValue` +
  assert de regressão.
- **ED-1021 (MET-4):** ACs → API de capabilities + gate no MENU via
  `currentUserEmail` + abas inacessíveis (a11y) + fallback do domínio inicial.
- **ED-1025 (MET-8):** re-escopo → **verificar** a superfície de Metas do HO v5.4.0
  antes de implementar; possivelmente out of scope do 0225.
- QA (Letícia): validar KPI contra referência — meta 10/jul Shopping = 45,36 MWh;
  HO Meta = 45,37 / Orçado 47,75.

## Histórico
- **v0 (2026-07-17):** rascunho (KPI via `goalTotal`; `isMyioUser`/`allowedDomains`).
- **Revisão v1 (2026-07-17):** accept with changes — additive-only, coverage-aware,
  capabilities, `currentUserEmail`, a11y, escopo HO. **Consolidada aqui.**
