# RFC-0241 — Goals & Tariffs in the v-5.2.0 Settings menu, plus a dashboard-wide "R$ instead of kWh/m³" display mode

- **Feature name:** `goals-tariffs-settings-v520` (hub item) + `value-display-mode` (global R$ toggle)
- **Start date:** 2026-11-03
- **Status:** **Draft — design only, not implemented.** Nothing described here exists in code yet.
- **Branch:** none yet (to be cut from `desenv` when approved: `feat/rfc-0241-goals-tariffs-v520`)
- **Jira:** none yet
- **Related RFCs:** RFC-0222 (Pricing Panel), RFC-0228 (Financial Goals gap & rollout index, Track A), RFC-0225 / RFC-0227
  (Metas period KPI, compare modal, onboarding guide), RFC-0217 (CustomerGoalsCard), RFC-0215 (Settings hub in the
  library), RFC-0108 (measurement display settings + `myio:measurement-settings-updated`), RFC-0233 (`restrict_view`),
  RFC-0207 (classification profile), RFC-0128 (energy subcategories), RFC-0239 (Reports Hub), PR #97 (`MyIOUtils`
  bridge / `LIB_SYMBOLS`). GCDR-repo RFCs referenced by code comments: GCDR RFC-0046 (Goals API), GCDR RFC-0052
  (goal margin), GCDR RFC-0054 (hourly tariffs + money overlay). **Note:** `docs/rfcs/RFC-0046-*`, `RFC-0052-*` and
  `RFC-0054-*` in *this* repo are unrelated documents (race condition, cache toggle, busy modal); the goals/tariff
  RFCs with those numbers live in `gcdr.git`.
- **Key files:**
  - Reference: `src/thingsboard/MYIO-SIM/v5.4.0_UNIQUE/controller.js`
  - Target: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/{MAIN_VIEW,MENU,TELEMETRY,TELEMETRY_INFO,FOOTER,HEADER}/controller.js`
  - Library: `src/components/GoalsPanel.js`, `src/components/pricing-panel/*`, `src/components/financial-goals/*`,
    `src/components/settings-hub/openSettingsHubModal.ts`, `src/components/goals-modal/GoalsModal.ts`,
    `src/components/cards/main-view/v5.2.0/template-card-v5.js`, `src/index.ts`

---

## Summary

Bring the **goals and tariffs management** that today exists only in the head-office simulator
(`MYIO-SIM/v5.4.0_UNIQUE`, the "🎯 Metas" button) to the **Shopping dashboard v-5.2.0**, as a new card
**"Metas e Tarifas"** in the MENU's **⚙️ Configurações** hub. The card is visible only to **MyIO users
(`@myio.com.br`) and user admins** (`isUserAdmin` on the logged USER entity, or `TENANT_ADMIN`). MAIN_VIEW
owns credentials, API calls and state; MENU only renders the entry and calls a MAIN-provided function. The
area picker that the simulator builds inline is moved into the library so both dashboards call the **same
component**.

Second, add a **dashboard-wide display mode** that shows **estimated cost in R$** instead of kWh / m³ for
energy and water wherever a value is displayed (cards, group totals, KPI/summary widgets, tooltips, selection
dock), computed by MAIN from the GCDR hourly tariffs (GCDR RFC-0054, client in RFC-0228 A1). Conversion is
**honest**: a value is shown in R$ only when the tariff fully covers the period for that device's tariff
category; otherwise the physical value stays, with an explicit coverage marker — never `R$ 0`, never a
partial sum presented as a total (RFC-0228 A4 / DEC-6 / DEC-8 disciplines).

## Motivation

1. **Goal management is unreachable in v-5.2.0.** The v-5.2.0 MENU "Metas" link opens the read-only
   `GoalsModal` (consumption vs. goals) — `MENU/controller.js:598-601`, `:2689-2725`. Creating, editing,
   importing goals and editing the margin (GCDR RFC-0046/0052) is only possible through `openGoalsPanel`, which no
   v-5.2.0 widget calls (no match for `openGoalsPanel|openPricingPanel` under
   `src/thingsboard/main-dashboard-shopping/`). Operators must switch to the head-office simulator or to the GCDR
   frontend to manage a single shopping's goals.
2. **Tariffs have no entry point in v-5.2.0 either.** The pricing panel (`openPricingPanel`, RFC-0222 + RFC-0228
   A1) is only reachable from the "$" button inside the head-office "Metas × Consumo" modal
   (`v5.4.0_UNIQUE/controller.js:4252`, `:7398-7467`, `:7521`).
3. **Customers ask to read the dashboard in money.** Facility managers reason in R$; today every surface shows
   kWh/MWh or m³/L only (`MAIN_VIEW/controller.js:571-615`). The financial building blocks exist in the library
   (RFC-0228 Track A: `createGoalsMoneyClient`, `renderFinancialIndicators`, `createReportMoneyColumn`,
   `sumMoneyDecimals`, `resolveMoneyRollout`) but nothing turns them into a dashboard-wide display mode.
4. **Avoid a fourth copy of goals UI.** The simulator's area picker, palette and GCDR wiring are inline
   (`v5.4.0_UNIQUE/controller.js:3126-3290`, `:7653-7761`). Porting them inline into v-5.2.0 would duplicate ~300
   lines; the RFC-0215 precedent (settings hub moved to the lib, `openSettingsHubModal.ts:1-13`) shows the
   preferred direction.

## Guide-level explanation

### For an operator (MyIO or admin user)

1. Click **⚙️ Configurações** at the bottom of the MENU. The hub shows a new card **🎯 Metas e Tarifas — Criar e
   editar metas de consumo e tarifas (R$/kWh, R$/m³)**.
2. The card opens the **Goals & Tariffs picker** (library component, same look as the simulator's picker): three
   cards —
   - **🛠️ Gestão de Metas** → opens the GCDR goals editor (`openGoalsPanel`) for *this* shopping: summary, drill
     Month → Day → Hour, CSV import, version history, margin editor.
   - **📊 Metas × Consumo** → opens the existing v-5.2.0 `GoalsModal` (unchanged behaviour of the MENU "Metas" link).
   - **💲 Tarifas** → opens the pricing panel (`openPricingPanel`) bound to the **real GCDR tariff API** for this
     shopping (energy and water, categories *Lojas* / *Área Comum*, month / range / day / intraday band).
3. After saving goals or tariffs, the dashboard refreshes what depends on them (goal caches, R$ values) without a
   page reload.

### For any user allowed to see money (see §Security; v1: same audience as above)

A segmented control **"kWh/m³ | R$"** is added to the HEADER next to the period picker. Choosing **R$**:

- Energy and water cards show `R$ 1.234,56` (label "Custo estimado") instead of `1.234,567 kWh`.
- Group totals (TELEMETRY header line), the TELEMETRY_INFO summary/KPI widget, its tooltips and the FOOTER
  selection dock show R$.
- A device whose tariff does not cover the whole period keeps its kWh/m³ value with a small chip
  **"Sem tarifa"** or **"Tarifa parcial"**; totals that would include such a device show the physical total and a
  **"Cobertura incompleta (n de m)"** chip (allowed users get a link to **Tarifas**).
- On the temperature tab the control is disabled (tooltip: "Temperatura não tem conversão monetária").
- Reports keep physical units as the primary column and **add** an R$ column (RFC-0228 A6). Charts stay in
  physical units in v1.

The choice is remembered per user and per shopping in this browser.

## Reference-level explanation

### 1. What the reference (v5.4.0_UNIQUE) actually does — verified inventory

| Step | Where | Inline in controller or lib? |
|---|---|---|
| "🎯 Metas" toolbar button rendered by the lib menu | `src/components/menu/MenuView.ts:1542`, `:1900-1907` (`#menuGoalsBtn`), gated by `showGoalsButton` (`types.ts:487`) | lib |
| Click → `myio:open-goals-panel` | `src/components/menu/MenuController.ts:118`; controller callback `onGoals` at `v5.4.0_UNIQUE/controller.js:2193-2195` | lib + controller |
| `showGoalsButton` from customer attr `show-goals-button` (default true) | `v5.4.0_UNIQUE/controller.js:498`, `:509-519` | controller |
| Listener: builds child-shopping list, area picker, shopping picker | `v5.4.0_UNIQUE/controller.js:7717-7761` | controller (inline) |
| Area picker "🎯 Metas de Consumo": **Gestão de Metas** / **Metas × Consumo** | `pickGoalsArea`, `v5.4.0_UNIQUE/controller.js:7655-7715` | controller (inline HTML) |
| Shopping picker (multi-customer HO) | `pickGoalsCustomer`, `:3248-3290` | controller (inline) |
| Goals editor | `openGoalsForCustomer` → `MyIOLibrary.openGoalsPanel({customerId: gcdrCustomerId, apiKey, baseUrl, domain:'ENERGY', onSaved → 'myio:goals-updated'})`, `:3179-3244` | lib component, controller wiring |
| GCDR credentials per shopping | `fetchCustomerServerScopeAttrs(tbId)` → `gcdrCustomerId`, `gcdrApiKey`; base URL from `settings.gcdrApiBaseUrl` / orchestrator; dev overrides `window.GCDR_CUSTOMER_API_KEY` and `localStorage 'gcdr_customer_api_key'` (`:3195-3209`) | controller |
| Metas × Consumo (multi-shopping compare, ~2 000 lines) | `openGoalsCompare`, `:4034` onwards; uses lib `createCustomerGoalsCard`, `createGoalsBarTooltip`, `createDateRangePicker`, `openMetasGuide` | controller (inline) + lib pieces |
| **"$" → pricing panel ("Tarifas")** | `openPricing`, `:7398-7467`: gate `@myio.com.br` or `SuperAdmin`, then `MyIOLibrary.openPricingPanel({customers, currentUserEmail, domain, theme})` — **no `tariffApi` passed** | controller wiring, lib panel |
| R$ overlay on compare cards (RFC-0228 A2a/A2b) | `_moneyGate` = `settings.goalsMoneyApi` + lib symbols, `:4279-4363`; `createGoalsMoneyClient().getGoalWithMoney(...)`, `resolveMoneyRollout`, `renderFinancialIndicators` | lib, gated by controller |
| Palette | `goalsPalette()`, `:3136-3169` (dashboard settings colours) | controller (inline) |

Findings that shape this RFC:

- **F-1** There is no screen literally titled "Metas e Tarifas" in the code (no match for `Tarifas` under
  `src/components`). The reference experience is *area picker → goals editor / compare*, with tariffs reachable
  only through the "$" inside the compare modal. This RFC names the combined entry **"Metas e Tarifas"** and makes
  Tariffs a first-class third card.
- **F-2** In the simulator the pricing panel runs in its **localStorage prototype mode**, because `tariffApi` is not
  passed (`:7453-7462`); the real persistence path only activates when `params.tariffApi` is present
  (`pricing-panel/openPricingPanel.ts:154-168`, `types.ts:148-154`). v-5.2.0 **must** pass `tariffApi`, otherwise
  tariffs would live in one browser only and the R$ display mode would have nothing to read.
- **F-3** The pricing panel gates itself with `isPricingAllowed(email, SuperAdmin)` = `@myio.com.br` or SuperAdmin
  (`pricing-panel/helpers.ts:38-42`, used at `openPricingPanel.ts:151`). A non-MyIO **admin** would get the "not
  allowed" view (`:222-230`). The lib needs an explicit caller-asserted permission (§4.3).
- **F-4** `openGoalsPanel` sends only `X-API-Key` (`GoalsPanel.js:203-211`), while MAIN's own goals fetch
  sends `X-Tenant-ID` and documents that "without the tenant the API answers 401" (`MAIN_VIEW/controller.js:1173-1174`,
  `:1195`). Either the goals write path does not need the tenant, or the panel is broken against this backend —
  **unverified**, listed as an unresolved question.

### 2. Current v-5.2.0 state — verified inventory

| Concern | Where |
|---|---|
| ⚙️ button is created **only when the user is admin** (`TENANT_ADMIN`, or USER SERVER_SCOPE `isUserAdmin`) | `MENU/controller.js:465-521` (USER attr fetch at `:474-495`, `addSettingsMenuButton` at `:518`) |
| Hub opened through the lib (`openSettingsHubModal`) with inline fallback | `MENU/controller.js:794-819`; fallback `:821-1090` |
| Hub option list is fixed; gating is a single `superAdminOnly` boolean | `settings-hub/openSettingsHubModal.ts:15-25`, `:62-128`, `:310-312` |
| `SuperAdmin` = email ends with `@myio.com.br` and is not `alarme@`/`alarmes@` | `MAIN_VIEW/controller.js:2919-2923` |
| MAIN also reads USER SERVER_SCOPE (all keys) and derives `HoldingAdmin = isHolding && isUserAdmin`, plus `restrict_view`; it does **not** expose `isUserAdmin` alone | `MAIN_VIEW/controller.js:2926-2972`; event `myio:user-info-ready` `:2975-2984` |
| `restrict_view` resolver and MENU consumer (`['menu','settings']`) | `MAIN_VIEW/controller.js:164-177`; `MENU/controller.js:571-576` |
| Lib bridge — only MAIN touches `window.MyIOLibrary` | `MAIN_VIEW/controller.js:179-296` (`LIB_SYMBOLS` `:190-285`; `GoalsModal` and `openSettingsHubModal` already present, `openGoalsPanel`/`openPricingPanel` absent) |
| GCDR credentials from customer SERVER_SCOPE | `MAIN_VIEW/controller.js:3486-3513` (`gcdrCustomerId`, `gcdrTenantId`, `gcdrApiKey`), base URL from widget settings `:3495`; published on the orchestrator `:3554-3557`, `:3591-3596` |
| Goals preloaded for `GoalsModal` into `MyIOUtils.goalsData` | `_fetchGoalsFromGCDR`, `MAIN_VIEW/controller.js:1175-1214`, called at `:3680-3681` |
| Measurement settings: state in `MyIOUtils.measurementSettings`, formatters, loader, event | `MAIN_VIEW/controller.js:548-654`, `_loadMeasurementDisplaySettings` `:1348-1370`, listener `:2852-2865`; MENU dispatch `MENU/controller.js:2308-2317` |
| Every displayed energy/water value funnels through `MyIOUtils.formatEnergyWithSettings` / `formatWaterWithSettings` (scalar in, string out) | card template `cards/main-view/v5.2.0/template-card-v5.js:398-430`; TELEMETRY group total `TELEMETRY/controller.js:3000-3014`, checklist `:4685-4695`; TELEMETRY_INFO `:456-457`, `:885-898` (+ ~25 call sites `:924-3060`); FOOTER dock `FOOTER/controller.js:1082-1086` |
| Re-render listeners for `myio:measurement-settings-updated` | TELEMETRY `:6821-6835`, TELEMETRY_INFO `:5239`, FOOTER `:1364` |
| Single data choke point (cards, totals, reports) | `emitProvide`, `MAIN_VIEW/controller.js:9548-9602` (status filter applied at `:9563`) |
| Per-device totals with granularity (`1d`/`1h`) from the Ingestion API | `MyIOUtils.fetchGoalsDayTotals`, `MAIN_VIEW/controller.js:915-1000` (`/telemetry/customers/{id}/{domain}/devices/totals?granularity=`) |
| Orchestrator publication: in a normal load there is no stub when the module-level code runs, so the "fallback" branch publishes `window.MyIOOrchestrator`; anything that must exist in both cases goes **after** the if/else | `MAIN_VIEW/controller.js:10573-10648` (RFC-0240 note at `:10646-10648`); stub created in `onInit` `:3309-3310` |
| The HEADER widget shows no consumption values (only period/actions) | `HEADER/controller.js` (no KPI rendering; only `energy/water-summary-ready` listeners at `:819-831` to enable controls) |

### 3. Design overview

```
MENU (child)                       MAIN_VIEW (owner)                                 Library
────────────                       ───────────────────────────────────────────────   ─────────────────────────────
⚙️ hub card "Metas e Tarifas" ──► MyIOUtils.openGoalsTariffs({theme})            ──► openGoalsTariffsHub (NEW)
  (visible iff                        • resolves gcdr creds (orchestrator)                ├ manage  → openGoalsPanel
   MyIOUtils.canManageGoalsTariffs)   • builds handlers                                   ├ compare → GoalsModal
                                      • onSaved → refetch goals / tariffs, emit           └ tariffs → openPricingPanel({tariffApi, allowed})
HEADER segmented control ─────────► MyIOUtils.setValueDisplayMode('money'|'physical')
                                      • loads tariffs (TariffApiClient)            ──► createTariffValuator (NEW, pure)
                                      • valuates items in emitProvide                    resolve price(ts) · valuate series
                                      • emits myio:value-display-mode-updated            sumMoneyDecimals / formatMoneyBRL (exist)
TELEMETRY / TELEMETRY_INFO / FOOTER ◄─ formatters read item.money + mode
```

### 4. Part A — "Metas e Tarifas" hub item

#### 4.1 Visibility rule

`canManageGoalsTariffs = SuperAdmin || UserAdmin`, where

- `SuperAdmin` — existing (`MAIN_VIEW/controller.js:2920-2923`).
- `UserAdmin` — **new** `window.MyIOUtils.UserAdmin`: `user.authority === 'TENANT_ADMIN'` **or** USER SERVER_SCOPE
  `isUserAdmin === true | 'true'`. Computed inside `detectSuperAdmin()` from the attribute fetch it already
  performs (`:2937-2951`) — no new round trip. Mirrors MENU's rule at `MENU/controller.js:466-495`.
- Then narrowed by RFC-0233: `isFeatureVisible(['menu','settings','goalsTariffs'])` (fail-open, can only hide).
- MAIN adds `isUserAdmin` and `canManageGoalsTariffs` to the `myio:user-info-ready` detail (`:2975-2984`).

Required MENU change: the ⚙️ button is today created only inside `if (isUserAdmin)` (`MENU/controller.js:515-521`).
It must also be created for `SuperAdmin` users who are not admins, otherwise a MyIO user without `isUserAdmin` never
reaches the hub. Because `detectSuperAdmin()` is not awaited (`MAIN_VIEW/controller.js:3389-3390`), MENU uses the
check-immediately-and-subscribe idiom: evaluate on init and again on `myio:user-info-ready`.

#### 4.2 Settings hub change (library)

`openSettingsHubModal` gets one new action and one new gating input — generic, not goals-specific:

```ts
export type SettingsHubAction = /* existing 8 */ | 'goals-tariffs';
export interface OpenSettingsHubModalOptions {
  // existing…
  /** Extra per-option permission asserted by the caller (default: false → option hidden). */
  permissions?: Partial<Record<SettingsHubAction, boolean>>;
}
// HUB_OPTIONS entry:
{ action: 'goals-tariffs', icon: '🎯', title: 'Metas e Tarifas',
  desc: 'Metas de consumo e tarifas (R$/kWh, R$/m³)', superAdminOnly: false, requiresPermission: true }
```

Rendering rule becomes: handler present **and** (`!superAdminOnly || isSuperAdmin`) **and**
(`!requiresPermission || permissions[action] === true`). Existing options are byte-identical. Position: after
`measurement` (end of the non-MyIO group). The inline fallback hub in MENU (`:821-1090`) is **not** extended — if the
deployed lib lacks the option, the item simply does not appear (acceptable degradation; avoids a second copy).

#### 4.3 New library component `openGoalsTariffsHub`

Extract `pickGoalsArea` (`v5.4.0_UNIQUE/controller.js:7655-7715`) into `src/components/goals-tariffs-hub/`:

```ts
export type GoalsTariffsArea = 'manage' | 'compare' | 'tariffs';
export interface OpenGoalsTariffsHubOptions {
  title?: string;                                   // default '🎯 Metas e Tarifas'
  entityLabel?: string;                             // 'shopping' (UNIQUE passes settings.goalsEntityLabel)
  handlers: Partial<Record<GoalsTariffsArea, () => void | Promise<void>>>;  // card hidden when absent
  theme?: { cssVars(): Record<string,string> } | Record<string,string>;     // same contract as the settings hub
  footer?: { customerName?: string; libVersion?: string };                   // createModalFooter
  targetDocument?: Document;
}
export function openGoalsTariffsHub(o: OpenGoalsTariffsHubOptions): { close(): void };
```

Library changes needed by the handlers:

| Change | File | Why |
|---|---|---|
| `openPricingPanel` accepts `allowed?: boolean` (caller-asserted; when provided it replaces `isPricingAllowed`) | `pricing-panel/openPricingPanel.ts:151`, `types.ts:129-155` | F-3: admins who are not `@myio.com.br` |
| `openPricingPanel` accepts `lockCustomer?: boolean` (single shopping, hides selector) | same | v-5.2.0 is single-customer |
| `openGoalsPanel` accepts optional `tenantId` → `X-Tenant-ID` | `GoalsPanel.js:203-211` | F-4 (only if confirmed needed) |
| `openGoalsPanel` accepts `theme` (`--myio-*`) in addition to `styles` | `GoalsPanel.js:120-130` | palette parity with other hub modals |

Exports added to `src/index.ts` (next to `openSettingsHubModal`, `:1147`) and to MAIN's `LIB_SYMBOLS`:
`openGoalsTariffsHub`, `openGoalsPanel`, `openPricingPanel`, `createTariffApiClient`, `createTariffValuator`
(Part B), `formatMoneyBRL`, `sumMoneyDecimals`.

#### 4.4 MAIN_VIEW orchestration

MAIN defines `window.MyIOUtils.openGoalsTariffs(opts)` (module scope, before any `await`) which:

1. Reads `gcdrApiBaseUrl`, `gcdrCustomerId`, `gcdrTenantId`, `gcdrApiKey` from `window.MyIOOrchestrator`
   (`:3554-3557`). Missing → `MyIOToast.error` with the same actionable text as the simulator
   (`v5.4.0_UNIQUE/controller.js:3185-3215`). **Never** reads `window.GCDR_CUSTOMER_API_KEY` or
   `localStorage 'gcdr_customer_api_key'` (simulator dev overrides at `:3203-3204` are not ported).
2. Re-checks `canManageGoalsTariffs`; if false, logs and returns (defence in depth; still UX only).
3. Calls `openGoalsTariffsHub` with handlers:
   - `manage` → `openGoalsPanel({ customerId: gcdrCustomerId, apiKey, baseUrl, tenantId?, domain: <visible tab→ENERGY|WATER|TEMPERATURE>, locale:'pt-BR', theme: MyIOUtils.theme, onSaved })`.
   - `compare` → same call MENU already makes to `GoalsModal.open(...)` (`MENU/controller.js:2703-2724`); the MENU
     function is moved to MAIN or MAIN dispatches `myio:open-goals-modal` that MENU already handles — implementer's
     choice, but only one implementation must remain.
   - `tariffs` → `openPricingPanel({ customers:[{ tbId: customerTB_ID, gcdrCustomerId, title }], lockCustomer:true,
     currentUserEmail: MyIOUtils.currentUserEmail, allowed: canManageGoalsTariffs, domain: <tab>, theme,
     tariffApi: { baseUrl, apiKey, tenantId: gcdrTenantId } })`; `handle.on('save', …)`.
4. After a goals save: re-run `_fetchGoalsFromGCDR(...)` (`:1175`) so `GoalsModal` sees fresh data, and dispatch
   `myio:goals-updated` `{ customerId, version, ts }` (same name/shape as the simulator, `:3228-3232`).
5. After a tariff save: invalidate the tariff cache (Part B) and dispatch `myio:tariffs-updated`
   `{ customerId, domain, category, year, version, ts }`; if the display mode is `money`, re-valuate and re-emit.

`openGoalsTariffs` is attached to `window.MyIOUtils` (not to the orchestrator) so it is independent of the
stub/fallback publication order (`:10573-10648`). Anything Part B adds to the orchestrator object must be assigned
**after** the if/else, like the RFC-0240 line at `:10648`.

#### 4.5 MENU wiring

```js
// inside showSettingsModal(user), lib-hub branch (MENU/controller.js:798-816)
handlers['goals-tariffs'] = () => window.MyIOUtils?.openGoalsTariffs?.({ source: 'settings-hub' });
permissions: { 'goals-tariffs': window.MyIOUtils?.canManageGoalsTariffs === true },
```

MENU never reads GCDR credentials and never references `window.MyIOLibrary`.

#### 4.6 v5.4.0_UNIQUE convergence

`pickGoalsArea` is replaced by `openGoalsTariffsHub` with `handlers.manage` (existing shopping picker +
`openGoalsForCustomer`), `handlers.compare` (`openGoalsCompare`) and **new** `handlers.tariffs` (the existing
`openPricing`, now passing `tariffApi`). The "$" inside the compare modal stays. The picker and the gate for
`tariffs` use the same `canManageGoalsTariffs` rule, computed there from `MyIOUtils.SuperAdmin` (set at
`:7414`) plus the user admin attribute.

### 5. Part B — global "R$ instead of kWh/m³" display mode

#### 5.1 State (owned by MAIN)

| Field | Type | Notes |
|---|---|---|
| `MyIOUtils.valueDisplayMode` | `'physical' \| 'money'` | default `'physical'` |
| `MyIOUtils.setValueDisplayMode(mode, {source})` | function | the only writer; validates eligibility, persists, (re)valuates, broadcasts |
| `MyIOUtils.moneyDisplayAvailable` | boolean | true when GCDR creds exist **and** the tariff API answered for at least one domain/category of the current year |
| `MyIOOrchestrator.moneyState` | `{ mode, periodKey, byDomain: { energy?: Coverage, water?: Coverage } }` | assigned after the publication if/else (§4.4) |

**Persistence:** per **user × shopping × browser**, `localStorage['myio:value-display-mode:v1:<tbUserId>:<customerTbId>']`,
wrapped in try/catch (private mode). It is a display convenience, not a business setting, so it is not stored in
SERVER_SCOPE in v1. A stored `'money'` is ignored (falls back to `'physical'`) when the user is not eligible or
`moneyDisplayAvailable` is false.

#### 5.2 Event contract (follows `myio:measurement-settings-updated` conventions)

| Event | Dispatcher | `detail` |
|---|---|---|
| `myio:value-display-mode-updated` | MAIN only (from `setValueDisplayMode`, after valuation of the visible domain finished or failed) | `{ mode, available, periodKey, coverage: { energy?, water? }, source, ts }` |
| `myio:money-valuation-ready` | MAIN, whenever a domain is (re)valuated (period change, data refresh, tariff save) | `{ domain, periodKey, coverage, ts }` |
| `myio:tariffs-updated` | MAIN after a pricing-panel save | `{ customerId, domain, category, year, version, ts }` |
| `myio:goals-updated` | MAIN after a goals save | `{ customerId, version, ts }` |

Children register listeners at module scope before any `await` (project rule, CLAUDE.md §Key Patterns 1).
Children **request** changes by calling `MyIOUtils.setValueDisplayMode`, never by dispatching the `-updated` event
themselves (unlike RFC-0108, where MENU dispatches directly at `MENU/controller.js:2316`; that pattern is not
repeated because eligibility must be re-checked by the owner).

#### 5.3 Valuation (library, pure) — `createTariffValuator`

New module `src/components/financial-goals/tariffValuation.ts` (no DOM, no TB):

```ts
type Category = 'SPECIFIC' | 'COMMON_AREA';                       // wire names (tariffApiClient.ts:28)
interface DeviceSeries { deviceKey: string; category: Category | null;
                         buckets: Array<{ startTs: number; endTs: number; qty: number }> }   // kWh or m³
interface DeviceMoney { state: 'complete' | 'partial' | 'none' | 'uncategorized' | 'not-convertible';
                        amount?: string;          // decimal string, unrounded (DEC-8)
                        coveredRatio?: number; reason?: string }
createTariffValuator({ trees: Record<Category, TariffTreeResponse[]>, timezone: 'America/Sao_Paulo' })
  .priceAt(category, ts): string | null            // hour > day > month > annual node (tariffApiClient.ts:33-46)
  .valuate(series: DeviceSeries): DeviceMoney
  .sum(list: DeviceMoney[]): { state, amount?, covered: number, total: number }   // uses sumMoneyDecimals
```

Algorithm per device: for each bucket, `price = priceAt(category, bucket.startTs)`; if the tariff varies **inside** a
bucket (bucket is `1d` and the day has hourly nodes/bands), the bucket is marked `needs-hourly`. Amount =
Σ `qty × price` computed in decimal strings (qty is normalised to a fixed 6-decimal string before the BigInt
multiply — never `Number(price)`, RFC-0228 A1 rule `tariffApiClient.ts:17-18`). Rounding happens **once**, at
display (`formatMoneyBRL`), and parents are `round(Σ raw)` not `Σ round` (DEC-8, as `reportMoneyColumn.ts`).

#### 5.4 Data flow in MAIN

1. On mode `money` (and on every period change / `myio:tariffs-updated` while in `money`): load tariff trees for each
   `(domain ∈ {ENERGY, WATER}) × (category ∈ {SPECIFIC, COMMON_AREA}) × (year ∈ years spanned by the period)` via
   `createTariffApiClient` at `granularity=hour` — at most 2 × 2 × 2 = 8 GETs, cached by `(domain, category, year, version)`.
2. Decide the consumption granularity: `1d` if no day in the period has intraday price variation; else `1h`, allowed
   only when the period is ≤ 31 days (proposal; constant `MONEY_HOURLY_MAX_DAYS`); longer periods with intraday
   tariffs → affected devices `state:'partial', reason:'intraday-tariff-long-period'`.
3. Fetch per-device bucketed consumption with the existing `fetchGoalsDayTotals(ingestionId, domain, start, end, gran)`
   (`MAIN_VIEW/controller.js:925-1000`). **Assumption:** the `/devices/totals?granularity=` response carries
   per-bucket values per device; this must be verified against the Ingestion API before Phase B starts.
4. Valuate and attach `item.money: DeviceMoney` in `emitProvide` (`:9548`) — the single choke point, so cards,
   totals and the reports' `itemsList` all see the same numbers. Items are not mutated when mode is `physical`
   (byte-identical payload).
5. Emit `myio:money-valuation-ready`, then (if triggered by a mode change) `myio:value-display-mode-updated`.

Busy UX: the switch shows the existing MAIN busy spinner until step 5; on failure mode reverts to `physical`
with a toast.

#### 5.5 Device tariff category

RFC-0228 requires the category to be **explicit, never inferred by name** (A5a; `deviceCategoryPort.ts`). Resolution
order:

1. GCDR device `tariffCategory` (`COMMON_AREA`/`SPECIFIC`) — available only when GCDR B6 ships; until then
   `createHttpDeviceCategoryPort` rejects (RFC-0228 memo; **assumption** based on the A5a description).
2. **Opt-in customer rule** (new customer SERVER_SCOPE attribute, e.g.
   `moneyCategoryRule = { "source": "classification", "SPECIFIC": ["lojas"], "COMMON_AREA": ["*"] }`): maps the
   dashboard's explicit RFC-0207/RFC-0128 group to a tariff category. This is a declared configuration, not name
   inference, but it **does relax RFC-0228's "never inferred" discipline** for v-5.2.0 and therefore needs owner
   approval (Unresolved Q3).
3. Otherwise `uncategorized` → the device keeps physical units and counts against coverage.

#### 5.6 Behaviour matrix

| Situation | Device card | Group / KPI total | Tooltip |
|---|---|---|---|
| Tariff covers the full period, single price | `R$ x` ("Custo estimado") | `R$ Σ` | R$ plus physical value in secondary line |
| Tariff changes inside the period (month boundary, day override) | exact piecewise sum (§5.3) | exact | shows "tarifa variável no período" |
| Intraday bands, period ≤ 31 d | exact using `1h` series | exact | idem |
| Intraday bands, period > 31 d | physical + chip "Tarifa parcial" | physical + "Cobertura incompleta" | reason text |
| No tariff for the device's category in part of the period | physical + "Tarifa parcial" | physical + "Cobertura incompleta (n de m)" | covered % |
| No tariff at all for the category | physical + "Sem tarifa" | idem | link "Tarifas" for allowed users |
| Device uncategorized | physical + "Sem categoria" | idem | — |
| Mixed group (devices of both categories) | each device by its own category | `R$ Σ` only if **every** member is `complete` | per-category breakdown |
| Entrada meters (RFC-0128 Entrada) | not convertible in v1 (mix of both categories) unless the customer rule maps Entrada to a category | Entrada total in R$ = Σ valued consumers + residual "Área Comum" valued at `COMMON_AREA` (only if all `complete`) | explains derivation |
| Calculated "Área Comum" residual (RFC-0128) | n/a | residual qty × `COMMON_AREA` price, piecewise; requires per-bucket Entrada and consumer series | — |
| Temperature domain | unchanged | unchanged | toggle disabled on that tab |
| Tank / level devices (`tank`, water level) | unchanged (not consumption) | excluded | — |
| `*_MANUAL` devices | valued like any device if they have consumption buckets | as above | — |
| Percent badges / sort | percentages stay physical-based (labelled); sort uses money when all visible items are `complete`, else physical | — | — |

Never displayed: `R$ 0` for missing data, `NaN`, or a partial sum without the "Cobertura incompleta" marker. Wording
restricted to "Custo estimado", "Estimado R$", "Cobertura incompleta"; forbidden "Fatura", "Faturamento",
"Valor final", "Total a pagar" (RFC-0228 rule, e.g. `financial-goals/reportMoneyColumn.ts:38-40`).

#### 5.7 Per-widget reaction (v-5.2.0)

| Widget | Change |
|---|---|
| **MAIN_VIEW** | State, persistence, valuation, events (above). New `MyIOUtils.formatItemValue(item, domain)` and `MyIOUtils.formatMoneyTotal(items)`; existing `formatEnergyWithSettings/formatWaterWithSettings` stay scalar and physical (`:571-615`). |
| **TELEMETRY** | Card: pass `displayMode` and `item.money` in `entityObject` to `renderCardComponentV5` (`:3170`); group total `renderHeader` (`:3000-3014`) uses `formatMoneyTotal` in money mode; checklist `_fmtDeviceValue` (`:4685`) idem. Listen to `myio:value-display-mode-updated` and `myio:money-valuation-ready` → `reflowFromState()` (same as `:6821-6835`). |
| **Card template (lib)** | `template-card-v5.js:398-430`: when `entityObject.displayMode === 'money'` and `entityObject.money.state === 'complete'`, render `formatMoneyBRL(amount)`; else render the physical value plus the chip. Default path byte-identical. |
| **TELEMETRY_INFO** | Totals, pie legends, tooltips (`:885-967`, `:1108`, `:1178`, `:2687-3060`) go through a local `fmt(domainValueOrMoney)` that reads the per-group money sums MAIN publishes in `moneyState`; listener next to `:5239`. Pie chart proportions stay physical in v1 (label says so). |
| **FOOTER** | Selection dock (`:1082-1086`): total of selected items in R$ only when all selected are `complete`; listener next to `:1364`. Comparison charts opened from the dock stay physical. |
| **HEADER** | Hosts the "kWh/m³ \| R$" segmented control (proposal — Unresolved Q5); hidden when the user is not eligible or `moneyDisplayAvailable` is false; disabled on temperature/alarm tabs; calls `MyIOUtils.setValueDisplayMode`. |
| **MENU** | Only the hub item (Part A). No value rendering. |
| **ALARM** | No change. |
| **Reports** (Reports Hub → AllReportModal) | Physical stays primary; when mode is `money`, MAIN passes `params.money` so the existing RFC-0228 A6 column is enabled (`AllReportModal.ts:168-196`). PDF/CSV export includes the R$ column with the "Custo estimado" header. |
| **Charts / energy modal / GoalsModal** | Unchanged in v1 (physical). A small "valores físicos" note is shown in money mode. Money charts are a future possibility. |

### 6. Security and permissions

- **All gating in this RFC is UX only.** `canManageGoalsTariffs`, the hub `permissions` map, the `allowed` flag of the
  pricing panel and the HEADER toggle visibility run in the browser and can be bypassed from devtools.
- **The GCDR customer API key is reachable by every dashboard user.** MAIN reads `gcdrApiKey` from the customer
  SERVER_SCOPE for all users (`MAIN_VIEW/controller.js:3511-3513`) and stores it on `window.MyIOOrchestrator`
  (`:3557`, `:3594`). Anyone who can open the dashboard can therefore call GCDR with it. Consequently the backend
  **must** enforce:
  1. **Scope separation on keys**: the key distributed to dashboards must carry read scopes only
     (`goals:read`, `tariffs:read`); `PUT/PATCH/DELETE /customers/:id/goals`, `/goals/import`, `/goals/margin` and
     `/customers/:id/tariffs` must be rejected for that key.
  2. **User-bound authorization for writes**: writes require an identity that GCDR can verify (e.g. a JWT bearer —
     `TariffApiClientConfig.jwt` already exists, `pricing-panel/types.ts:161-164` — or a TB-token exchange) with a
     role check equivalent to "MyIO staff or customer admin" (the `isUserAdmin` USER attribute or a GCDR-side role).
  3. **Audit with a server-derived actor**: today the pricing audit author is the client-supplied
     `currentUserEmail` (`openPricingPanel.ts:127`) — spoofable. GCDR must record the authenticated principal.
  4. **Optimistic concurrency** (`version`/`If-Match`) as already specified by GCDR RFC-0054 and implemented in
     `tariffApiClient.ts:19-21`.
- **Until (1)–(2) exist, Phase A ships the tariff/goal *editors* behind the client gate with a known risk**, which
  the owner must accept explicitly (Unresolved Q1). Read-only money display (Part B) does not widen exposure beyond
  what the key already allows.
- `isUserAdmin` is read from **USER** SERVER_SCOPE, never from the customer (comment at `MENU/controller.js:471-472`).
  Customer users cannot write their own SERVER_SCOPE attributes in ThingsBoard, which is what makes the attribute
  trustworthy for UX gating (**assumption** about the tenant's TB permission setup).
- No credentials are added by this RFC. Note: MAIN_VIEW currently contains hard-coded `MANUAL_PROV_*` credentials
  (RFC-0240, `MAIN_VIEW/controller.js:1544-1551`); this feature must not reuse them, and they remain a separate
  security debt to remove. The simulator's dev key overrides (`v5.4.0_UNIQUE/controller.js:3203-3204`) must not be
  ported.

### 7. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-01 | A user with `@myio.com.br` (not `alarme@`/`alarmes@`) and **without** `isUserAdmin` sees ⚙️ and the "Metas e Tarifas" card. |
| AC-02 | A user with USER SERVER_SCOPE `isUserAdmin=true` (any email) or `TENANT_ADMIN` sees the card. |
| AC-03 | Any other user sees neither the card nor the HEADER R$ toggle; a customer-level `isUserAdmin` does **not** grant it. |
| AC-04 | `restrict_view` `{menu:{settings:{goalsTariffs:false}}}` hides the card even for eligible users. |
| AC-05 | The existing 8 hub options render exactly as before for every user (snapshot test of `openSettingsHubModal`). |
| AC-06 | MENU never references `window.MyIOLibrary` nor GCDR credentials (grep check in CI/test). |
| AC-07 | "Gestão de Metas" opens `openGoalsPanel` for the current shopping's `gcdrCustomerId`; a save dispatches `myio:goals-updated` and refreshes `MyIOUtils.goalsData`. |
| AC-08 | "Tarifas" opens `openPricingPanel` **with `tariffApi`**; no `myio:pricing` localStorage key is written; a non-MyIO admin gets the editable panel (not the "not allowed" view). |
| AC-09 | Missing `gcdrCustomerId`/`gcdrApiKey` → actionable toast; no modal opens. |
| AC-10 | v5.4.0_UNIQUE uses `openGoalsTariffsHub` and keeps its current Gestão / Metas × Consumo behaviour, plus the new Tarifas card. |
| AC-11 | With mode `physical`, `emitProvide` payloads and rendered DOM are byte-identical to today. |
| AC-12 | With mode `money` and full coverage, card, group total, TELEMETRY_INFO totals/tooltips and FOOTER dock show identical R$ for the same device set (single source `item.money`). |
| AC-13 | A tariff change on day 15 of the period yields `Σ(qty_1..14 × p1) + Σ(qty_15..n × p2)` (golden-vector unit test in `tariffValuation`). |
| AC-14 | Partial / missing tariff and uncategorized devices never render `R$ 0` or a total without "Cobertura incompleta". |
| AC-15 | Rounding: parent total equals `round(Σ raw)`; no `Number()` round-trip of prices (unit tests). |
| AC-16 | Temperature tab: toggle disabled; temperature values unchanged in both modes. |
| AC-17 | Mode persists per user × shopping in localStorage; a stored `money` is ignored when the user is ineligible or tariffs are unavailable. |
| AC-18 | `myio:tariffs-updated` while in money mode re-valuates without page reload. |
| AC-19 | AllReportModal in money mode shows the R$ column; in physical mode it is absent (existing A6 gate). |
| AC-20 | Bundle-size budgets in CLAUDE.md still pass (`scripts/size-check.js`). |

### 8. Phased implementation plan (one feature branch, one PR to `desenv`, phases as commits)

| Phase | Scope | Exit |
|---|---|---|
| **0 — Verification spikes** (no product code) | Confirm: GCDR tariff API live and reachable with the dashboard key; whether goals writes need `X-Tenant-ID` (F-4); shape of `/devices/totals?granularity=1d|1h`; GCDR write-scope enforcement status. | Answers recorded in this RFC (rev. 2). |
| **1 — Library: hub & panels** | `openGoalsTariffsHub`; `openSettingsHubModal` `goals-tariffs` + `permissions`; `openPricingPanel` `allowed`/`lockCustomer`; `openGoalsPanel` `tenantId`/`theme`; exports; Vitest for each (AC-05, AC-08 lib part). | `npm run build`, `npm run test` green. |
| **2 — v-5.2.0 Part A** | MAIN: `UserAdmin`, `canManageGoalsTariffs`, `openGoalsTariffs`, `LIB_SYMBOLS`; MENU: ⚙️ for SuperAdmin, hub handler; showcase `showcase/main-view-shopping/` updated. | AC-01…AC-09. |
| **3 — v5.4.0_UNIQUE convergence** | Replace `pickGoalsArea` with the lib; add Tarifas card with `tariffApi`. | AC-10. |
| **4 — Library: valuation** | `tariffValuation.ts` + golden vectors (single price, mid-period change, intraday bands, gaps, mixed groups). | AC-13, AC-15. |
| **5 — v-5.2.0 Part B** | MAIN state/persistence/events/`emitProvide`; card template; TELEMETRY, TELEMETRY_INFO, FOOTER, HEADER toggle; reports money column. | AC-11, AC-12, AC-14, AC-16…AC-19. |
| **6 — Hardening** | Size check, CDP validation on a real dashboard (memory: CDP injection), QA script. | AC-20; QA sign-off. |

Phases 1–3 deliver value on their own (management) and can be released before Part B.

## Drawbacks

- Part B touches every value-rendering path of four widgets and the shared card template; regressions in the default
  path are the main risk (mitigated by AC-11 byte-identity tests).
- Money mode adds up to 8 tariff GETs and possibly hourly consumption fetches per period change; for large shoppings
  `1h` series can be heavy (hence the 31-day cap).
- Until GCDR enforces write scopes, the editors are protected only by client-side gating (§6).
- The opt-in classification→category rule (§5.5) is a pragmatic deviation from RFC-0228's "explicit category"
  discipline and could produce wrong R$ if the classification is wrong.
- Two "goals" entries coexist in v-5.2.0 (MENU "Metas" link for everyone, hub card for operators) — slightly
  redundant by design.

## Rationale and alternatives

- **Hub card vs. new MENU link:** the hub already groups privileged settings and has a lib implementation (RFC-0215);
  a link in `settings.links` would need per-dashboard configuration in ThingsBoard and RFC-0233 regex heuristics
  (`MENU/controller.js:553-559`).
- **MAIN-owned function vs. MENU calling the lib directly:** keeps credentials and orchestration in MAIN (bridge rule
  `MAIN_VIEW/controller.js:179-188`) and lets v5.4.0 and v-5.2.0 share the same lib calls.
- **Client-side valuation vs. a GCDR "valuate consumption" endpoint:** a server endpoint (GCDR has tariffs, Ingestion
  has consumption) would be authoritative and cheaper for the browser, but does not exist (**assumption**: none found
  in `tariffApiClient.ts` or `goalsMoneyClient.ts`). The pure valuator is designed so it can be replaced by such an
  endpoint without changing widgets (they only read `item.money`). The existing `?withMoney=true` goals overlay is
  not reusable here: it values *goals*, requires device-granular goals (RFC-0228 B1) and is gated off by default
  (A2b).
- **Replace units vs. show both:** the owner asked to replace; cards replace, tooltips and reports keep both so the
  physical truth is always one hover away.
- **Persist mode in USER SERVER_SCOPE:** rejected for v1 (extra write per toggle, needs write permission on the USER
  entity); localStorage follows the project rule for per-viewer conveniences.
- **Do nothing / keep using the simulator:** keeps operators context-switching and leaves tariffs in localStorage.

## Prior art

- **RFC-0222** — Pricing Panel prototype (month/range, categories `lojas`/`area_comum`, MyIO-only gate, audit).
- **RFC-0228** (+ feedback-v1) — Financial goals gap index; Track A implemented: A1 tariff adapter
  (`pricing-panel/tariffApiClient.ts`, `tariffApiAdapter.ts`), A2a/A2b money overlay and rollout gate, A3 budget
  verdict (DEC-6), A4 honest coverage, A5a device category UI, A6 report money column (DEC-8), A7 variance. This RFC
  reuses their disciplines and does not reopen them, except §5.5 (flagged).
- **GCDR RFC-0046 / RFC-0052 / RFC-0054** (gcdr repo) — Goals API, goal margin, hourly tariffs and money overlay
  (contracts cited in `GoalsPanel.js:1-23`, `goalsMoneyClient.ts:1-9`, `tariffApiClient.ts:1-9`).
- **RFC-0225 / RFC-0227 / RFC-0217** — Metas period KPI, compare modal and guide, CustomerGoalsCard (the v5.4.0 compare
  experience).
- **RFC-0215** — Settings hub moved to the library; template for §4.2.
- **RFC-0108** — measurement display settings and `myio:measurement-settings-updated`; template for the event and
  formatter design.
- **RFC-0233** — `restrict_view`, reused for narrowing visibility.
- **RFC-0239** — Reports Hub; reports receive the money column through it.

## Unresolved questions

1. **Write authorization in GCDR:** does the dashboard `gcdrApiKey` currently allow goal/tariff writes? If yes, does
   the owner accept shipping the editors (Phases 1–3) before GCDR adds write scopes + user-bound auth?
2. **Is the GCDR tariff API (RFC-0054 Phase 1) live in production**, and with which auth (customer key vs JWT)?
3. **Device tariff category before GCDR B6:** approve the opt-in customer rule mapping classification groups to
   `SPECIFIC`/`COMMON_AREA` (§5.5), or block Part B until B6?
4. **Does `openGoalsPanel` need `X-Tenant-ID`** (F-4)?
5. **Toggle placement:** HEADER segmented control (proposed) vs. MENU vs. inside the "Metas e Tarifas" modal.
6. **Audience of the R$ display:** only operators (v1 proposal) or all users of customers that enable a flag
   (e.g. customer SERVER_SCOPE `moneyDisplayEnabled`)? Are tariffs commercially sensitive for store tenants?
7. **"@myio.com.br" rule:** reuse `SuperAdmin` (which excludes `alarme@`/`alarmes@`) or plain suffix match as stated?
8. **Entrada meters and the Área Comum residual:** accept the derivation in §5.6, or show Entrada only in physical
   units?
9. **Hourly cap** (`MONEY_HOURLY_MAX_DAYS = 31`) and acceptable request volume for large shoppings.
10. **Shape of `/devices/totals?granularity=`** per-bucket data (assumed in §5.4).
11. Should the v-5.2.0 MENU "Metas" link (read-only `GoalsModal`) remain once the hub card exists?
12. Should the money mode also apply to v-5.4.0 (`TelemetryGridShoppingView`) in the same PR or a follow-up?

## Future possibilities

- Server-side valuation endpoint (GCDR) replacing `createTariffValuator` behind the same `item.money` contract.
- Money mode in charts (Consumption 7 days, energy modal, GoalsModal) and in the head-office "Metas × Consumo".
- Tariff CSV import/export (RFC-0228 B3) surfaced in the Tarifas card.
- Decomposed tariffs (TE/TUSD, flags, taxes) and tiered water (RFC-0228 C1/C2) — the valuator's `priceAt` becomes a
  strategy per `tariffModel`.
- Persisting the display mode per user in GCDR user preferences once such an API exists.
- Native currency budgets (RFC-0228 A3) as a fourth card in the Goals & Tariffs hub.
