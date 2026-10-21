# RFC-0237 — Inventory Panel v2.0.0

- **RFC number:** 0237
- **Feature name:** `inventory-panel-v2`
- **Title:** A visual device inventory with two-axis status (Cadastro / Atividade), combinable filters and exports that follow the filtered result
- **Status:** Implemented rev. 3 (2026-10-06) — steps 1–4 done and validated in the showcase (mock + live tenant); AC-11 calibration decisions D1–D4 open (see "Live calibration"). Rev. 2 consolidated BMAD round 1, an external review and an API validation spike
- **Type:** ThingsBoard widget (`src/thingsboard/inventory-panel/v2.0.0`) + pure logic in the library (`src/utils/devices/inventory/`)
- **Author:** Rodrigo Lago
- **Created:** 2026-10-06
- **Tracking:** [ED-1324](https://myio.atlassian.net/browse/ED-1324) · branch `feat/ED-1324-inventory-panel-v2`
- **Relates to:**
  - RFC-0001 (Inventory Panel v1.0.0) — `src/thingsboard/inventory-panel/v1.0.0/docs/`
  - RFC-0200 / `src/utils/devices/deviceIcons.ts` — device images
  - RFC-0207 — `deviceClassificationProfile` (domain / group classification)
  - RFC-0218…0221 — annotations moving from TB `log_annotations` to GCDR
  - `src/components/premium-modals/upsell/openUpsellModal.ts` — visual and interaction reference

> Design document. `v2.0.0/` holds an unchanged, lint-clean copy of v1.0.0 as the starting
> point; v1.0.0 is not modified. What changed from rev. 1 and why is in
> [Appendix A](#appendix-a--decision-log-rev-1--rev-2); the review round is summarized in
> [Appendix B](#appendix-b--review-round-1-2026-10-06).

---

## Summary

Inventory Panel v1.0.0 lists every device of the tenant grouped by customer or type, with a
small dashboard and CSV/PDF export. It answers "how many devices do we have", not "which
devices are wrongly set up or silent, and why".

v2.0.0 turns it into an internal MYIO operations tool:

1. **Visual rows** — device image and profile from `src/utils/devices`; the device shown as
   **`label` (`name`) [copy]**.
2. **Two status axes per device** — **Cadastro** (is it correctly registered and integrated?)
   and **Atividade** (is it reporting?), each computed from explicit rules, with the failing
   rules shown inline.
3. **Lifecycle awareness** — archived / stock devices stay searchable but leave the
   operational indicators.
4. **Combinable filters** — customer, domain, profile, Cadastro, Atividade, specific rule and
   free text; AND across dimensions, OR within one; shown as removable chips.
5. **Exports of the filtered result** — real XLSX, CSV and PDF of every device matching the
   current filters, search and sort.

## Motivation

What v1.0.0 does today (`v1.0.0/controller.js`):

- **Data:** pages `GET /api/deviceInfos/all` (`:294-367`) and keeps TB fields only. It never
  reads the SERVER_SCOPE attributes MYIO classifies by (`deviceProfile`, `identifier`,
  `ingestionId`, `gcdrDeviceId`, `centralId`, `slaveId`).
- **Rows:** an active/inactive dot, the name and a TB-type pill (`:1212-1244`). No image, no
  label, no profile, no notion of a misconfigured device.
- **Filters:** three multi-selects with an "empty = all, `['__NONE__']` = none" encoding
  (`:1495-1546`); free-text search rebuilds the whole panel on each keystroke and the input
  loses focus (`:985`).
- **Export:** the Dashboard buttons apply filters but not the search (`:1445-1456`); the header
  "Export" modal ignores filters (`:1429-1443`); no XLSX.
- **Robustness:** global `window.ip*` handlers, styles injected into `document.head` without
  removal (`:286-288`), timers (`:97`, `:1620`) not cleared in `onDestroy` (`:1628-1634`),
  IDs interpolated into inline `onclick` strings.

The 2026-10-06 spike (section 10) shows why a status is needed and why it must be calibrated:
of **9,185** devices in the tenant, 60% have no `deviceProfile` attribute, 380 share an
`ingestionId` with another device, and lifecycle is encoded today in at least three
inconsistent ways.

## Goals

- G1. Each device with **image, profile, `label` and `name`**, one-click copy of the `name`.
- G2. **Two status axes** — Cadastro and Atividade — from documented rules whose results
  distinguish *fail*, *pass*, *unknown* and *not applicable*.
- G3. **Lifecycle**: archived / stock devices listed but excluded from operational indicators,
  with explicit counts.
- G4. **Combinable filters** with facet counts, active chips and "clear all"; typing never
  loses focus.
- G5. **XLSX, CSV and PDF** export of the whole filtered and sorted result.
- G6. **One bulk request per page** — no per-device requests.
- G7. Multi-instance safe; nothing left running after destroy; late responses discarded.

## Non-goals

- **Checking consistency against the ingestion API or GCDR** (e.g. a sensor registered as
  `energy` in the ingestion API). v2 reads ThingsBoard only and **does not detect** that class
  of error. It is a planned later delivery (Future possibilities).
- Telemetry-based connectivity (`calculateDeviceStatus`); Atividade uses TB's
  `active` / `lastActivityTime` attributes only.
- Editing devices, bulk actions.
- Customer-facing use. v2 is an internal MYIO tool (tenant users); customer access needs its
  own presentation and scope rules.
- Moving the whole panel into the library (only the pure logic moves — section 6).

---

## Guide-level explanation

### Layout

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📦 Inventário de Dispositivos                   [⟳ Atualizar] [Exportar 41 ▾]│
├─────────────────────────────────────────────────────────────────────────────┤
│ Cadastro: ● Íntegro 5.102  ▲ Pendente 1.840  ✖ Crítico 640  ? Parcial 12      │  ← chips = filters
│ Atividade: ● Reportando 5.900  ✖ Sem atividade 2.940  ? Sem dado 74           │
│ Ciclo de vida: 16 arquivados · 0 em estoque (fora dos indicadores)            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Buscar label, name, identificador…   [Cliente ▾][Domínio ▾][Perfil ▾][Regra ▾]│
│ Filtros ativos:  Cliente: Shopping da Ilha ✕   Cadastro: Crítico ✕   Limpar tudo│
├─────────────────────────────────────────────────────────────────────────────┤
│ Agrupar por: [Cliente ▾]  Ordenar: [Gravidade ▾]   Mostrando 41 de 9.185      │  ← aria-live
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ ⚠ Sem cliente (1.157)                                                       │
│ ▼ Shopping da Ilha (41)                                         ✖ 12  ▲ 29    │
│  [img] CM AR 4  (3F SCSDIACCCasaAr4) ⧉   FANCOIL  ✖ Cadastro · ✖ há 3 d       │
│         Sem ingestionId · Duplicado +1                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

Two tabs: **Dispositivos** (the list above) and **Painel** (dashboard). Both read the same
filtered set, and the filter bar is shared — see [Painel](#painel-tab).

### Painel tab

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Dispositivos] [Painel]                                                      │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ Total    │ Íntegro  │ Pendente │ Crítico  │Reportando│Sem ativ. │ Fora dos │
│ 9.185    │ 5.102    │ 1.840    │ 640      │ 5.900    │ 2.940    │ indic. 16│
├──────────┴──────────┴───────┬──┴──────────┴──────────┴──────────┴──────────┤
│ Cadastro (rosca)            │ Atividade (rosca)                              │
├─────────────────────────────┼───────────────────────────────────────────────┤
│ Clientes com mais problemas │ Regras que mais falham                        │
│ (barras: Crítico + Pendente)│ (barras)                                      │
├─────────────────────────────┴───────────────────────────────────────────────┤
│ Matriz cliente × regra (contagem de devices que falham cada regra)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Every number respects the active filters (same `applyFilters` as the list).
- **Click to filter:** a card, a doughnut slice, a bar or a matrix cell applies the
  matching filter (Cadastro / Atividade level, customer, rule, customer + rule) and opens the
  **Dispositivos** tab.
- Charts use Chart.js (already used by v1), loaded lazily the first time the tab opens; if it
  fails to load, the cards and the matrix still render.
- The numbers come from a pure library function (`buildDashboardSummary`), so they are tested
  in Vitest and match the list exactly.

### Row anatomy

| Element | Rule |
|---|---|
| Image | `getDeviceIcon(deviceProfile)`; `loading="lazy"`, 28 px |
| **`label`** first, bold | when `label` is blank **or equal to `name`**, show `name` once — no parentheses |
| `(name)` muted, monospace | ellipsis + `title` when long; contrast ≥ 4.5:1 in both themes |
| ⧉ copy | always visible (low contrast), `aria-label="Copiar name"`; copies `name`; icon turns ✓ for 1.5 s; toast only on clipboard error; **`stopPropagation`** so it never opens the device |
| Profile pill | `deviceProfile` attribute; **"Não classificado"** when blank or not in `DEVICE_TYPE_CONFIG` |
| Domain | `getDeviceCategory` **only for recognized profiles** — otherwise "Não classificado" (the library function defaults to `energy`, `deviceTypeConfig.ts:91-93`) |
| Cadastro badge | ● Íntegro / ▲ Pendente / ✖ Crítico, plus "· avaliação parcial" when some applicable rule is `unknown`; text, not icon only |
| Atividade | ● Reportando / ✖ Sem atividade + relative time ("há 3 d"); "? Sem dado" when the attribute is missing |
| Reasons | up to 2 inline tags in pt-BR ("Sem ingestionId", "Duplicado") + "+N"; ⓘ keeps the long explanation |
| Lifecycle | archived / stock rows show a grey "Arquivado" / "Estoque" tag and no status badges |
| Row click | opens the device detail state (`enableNavigation`) |

### States

- **Loading:** skeleton with real progress — "Carregando 3.000 de 9.185…" (paged load).
- **Load error, no previous data:** error screen with "Tentar de novo".
- **Refresh error with previous data:** keep the last data with a banner "Dados de 10:42 —
  falha ao atualizar".
- **Partial attributes** (a page or key failed): affected rules become `unknown`; Cadastro
  shows "avaliação parcial"; a "? Parcial" chip appears.
- **No results:** "Nenhum dispositivo com esses filtros" + "Limpar tudo".
- **Zero issues:** explicit positive state.
- **Refresh** preserves filters, scroll and focus, and shows "Atualizado há X min"; a cycle is
  skipped while the previous one is in flight.

---

## Reference-level explanation

### 1. Data loading (G6)

**Single loader:** `POST /api/entitiesQuery/find`, `entityFilter: { type: 'entityType',
entityType: 'DEVICE' }`, paged (`pageSize` setting, default 1000), sorted by `name`.

| Key | Key type | Use |
|---|---|---|
| `name`, `label`, `type`, `createdTime`, `ownerName`, `ownerType` | `ENTITY_FIELD` | row, search, C1, C6 |
| `deviceProfile`, `identifier`, `ingestionId`, `gcdrDeviceId`, `centralId`, `slaveId`, `lifecycleStatus` | `SERVER_ATTRIBUTE` | Cadastro rules, lifecycle, export |
| `active`, `lastActivityTime` | `SERVER_ATTRIBUTE` | Atividade rules |

Validated on the production tenant (section 10):

- `ownerName` / `ownerType` come back populated; **`ownerId` and `customerId` come back
  empty** as entity fields. The customer id needed for exports is resolved by mapping
  `ownerName` to `/api/customers` — TB enforces unique customer titles per tenant. A name that
  does not map is exported with an empty id and logged.
- `active` and `lastActivityTime` are **server attributes**; requesting them as `TIME_SERIES`
  returned nothing on this tenant. They are **not** entity fields.
- **All values come back as strings.** Parsing is explicit: `active` is `true` only for the
  string `"true"`; timestamps via `Number()` with `0`/NaN treated as missing; a missing key
  arrives as `{ ts: 0, value: "" }`.
- Load time: 10 pages of 1,000 → ~3.5 s for 9,185 devices.

Errors: a failed page is retried once; if it still fails, the devices already loaded are
shown and the panel marks the load as partial (rules depending on the missing page cannot be
evaluated for devices that are not there — the count "Mostrando X de ~Y" uses
`totalElements`). There is no second source to fall back on.

### 2. Lifecycle (G3)

**Source of truth:** a new SERVER_SCOPE attribute **`lifecycleStatus`** —
`active` (default when absent) · `stock` (not installed) · `archived` (decommissioned / replaced).

- `stock` and `archived` devices are listed and searchable, but excluded from the Cadastro and
  Atividade indicators, which show the excluded count explicitly.
- **Legacy signals** found in the spike are shown as a hint ("possivelmente arquivado"), never
  as authority, until the attribute is filled:
  - `deviceProfile` ending in `_ARQUIVADO_*` (16 devices),
  - customers named with "DESATIVAR" (e.g. "Campinas DESATIVAR").

  Annotations mentioning "desativado" (19 devices in the spike) are **not** used in v2: the
  `log_annotations` attribute is a large JSON per device and is not part of the bulk load.
  They become usable once annotations come from GCDR (RFC-0218…0221).
- Filling `lifecycleStatus` for existing devices is an operational task outside this widget.

### 3. Rules

Each rule returns one of **`pass` · `fail` · `unknown` · `notApplicable`**:

- `fail` — the query succeeded and the condition is violated (e.g. a required field blank);
- `unknown` — the source failed or the value cannot be read conclusively;
- `notApplicable` — the rule does not apply to this device (lifecycle, integration not
  expected, architecture);
- `pass` — condition met.

`isBlank(v)` = `null`/`undefined`, empty or whitespace, or the strings `"null"`/`"undefined"`.

**Integration expected** (gates C2–C5, C7, C8): a customer is *integrated* when at least one of
its devices has an `ingestionId` or a `gcdrDeviceId`. In the spike, **30 customers / 3,072
devices** have none of the MYIO attributes (BB, Obramax stores, …) — for them C2–C5/C7/C8 are
`notApplicable`. The derived value can be overridden per customer in settings
(`integrationOverrides`).

**Cadastro axis**

| Id | Rule | Severity | Applies when |
|---|---|---|---|
| C1 | No customer (`ownerType = TENANT`) | Pendente | lifecycle `active` (not `stock`) |
| C2 | No `deviceProfile` | Crítico | integrated customer |
| C3 | No `ingestionId` | Crítico — data does not reach reports | integrated customer |
| C4 | No `gcdrDeviceId` | Pendente — GCDR features degraded | integrated customer |
| C5 | `deviceProfile` not recognized (not in `DEVICE_TYPE_CONFIG`) | Pendente | C2 passes |
| C6 | `deviceProfile` ≠ TB profile `type` | Info | **disabled by default**; C2 passes |
| C7 | No `centralId` or `slaveId` | Pendente | integrated customer and a recognized profile of a central-attached domain |
| C8 | Duplicate `ingestionId` or `gcdrDeviceId` (another non-archived device has it) | Crítico | value present |

Severity semantics: **Crítico** = data reaching the customer is wrong or missing;
**Pendente** = a feature is degraded but numbers stay right; **Info** = hygiene (not counted
in the Cadastro badge).

**Atividade axis**

| Id | Rule | Severity |
|---|---|---|
| A1 | TB `active = "false"` | Sem atividade |
| A2 | `lastActivityTime` older than `staleHours` (default 24 h) | Sem atividade |

- A missing `lastActivityTime` is `unknown` ("Sem dado"), **not** "never reported" — the
  meaning depends on the source and is not confirmed for every device type.
- A1 and A2 are related but not equivalent (the TB inactivity timeout can differ from
  `staleHours`); both live on this axis and **rule counts overlap** — the "Regra" facet can
  sum to more than the device total.

**Aggregation per axis:** the badge is the worst known severity among `fail` results;
"Íntegro" requires that **every applicable rule** evaluated to `pass` or `notApplicable`. If
any applicable rule is `unknown`, the badge keeps the worst known severity and adds
"· avaliação parcial" (`Íntegro · avaliação parcial` is not allowed — it becomes "? Parcial").

**Deferred rules** (Future possibilities): duplicates of `(centralId, slaveId)` and of
`identifier` (the spike shows `identifier` is not unique — 1,817 devices share one — and 855
central/slave pairs repeat, many legitimately across replaced devices); "all devices of a
central silent" as an **indication** of a common problem (not proof of a replaced central);
TB × ingestion consistency.

### 4. Filters (G4)

```js
filters = {
  customers: Set<string>, domains: Set<string /* incl. 'unclassified' */>, profiles: Set<string>,
  cadastro: Set<'ok'|'pending'|'critical'|'partial'>, atividade: Set<'ok'|'inactive'|'nodata'>,
  rules: Set<string> /* device matches if it FAILS any selected rule */,
  lifecycle: Set<'active'|'stock'|'archived'> /* default: {'active'} */, text: string,
}
```

- AND across dimensions, OR within one; an empty set means no constraint.
- **Facet count** of option *x* in dimension *D* = devices matching all *other* dimensions
  and *x*. When *D* already has selections, the count is what *x* contributes, **not** the
  total after the click — the UI and tests must not claim otherwise.
- The Cadastro and Atividade KPI chips **are** the filters for those axes (no separate
  dropdowns); the chip shows `aria-pressed` and creates the corresponding active-filter chip.
- Options with a zero facet count are disabled, not hidden. The Cliente dropdown has an
  internal search. Rule options are shown by their pt-BR text.
- Search: 150 ms debounce, accent- and case-insensitive (`NFD` + strip diacritics +
  lowercase), over label, name, identifier, profile, customer, `ingestionId`; it re-renders
  only the list region.
- Default sort: **gravity** (Crítico first); "⚠ Sem cliente" group pinned on top.
- List rendering: incremental (200 rows, more on scroll); groups larger than 50 start
  collapsed.

### 5. Export (G5)

- **Source:** `getVisibleRows()` = every device matching filters + search, in the list order.
  Collapsed groups and rows not yet rendered **are exported**.
- **Columns (XLSX / CSV):** Cadastro, Atividade, Failed rules (pt-BR text), Label, Name,
  `deviceId`, Identifier, Profile, Domain, Customer, `customerId`, Lifecycle, Active, Last
  activity, `ingestionId`, `gcdrDeviceId`, `centralId`, `slaveId`, Created.
- **CSV:** tabular only — UTF-8 BOM, `;`, no metadata rows; identifiers kept as text; cells
  starting with `= + - @` (or tab / CR) prefixed with `'` (formula injection).
- **XLSX (real):** SheetJS loaded lazily **only when XLSX is requested**, pinned version,
  preferably a MYIO-hosted copy (SheetJS recommends a local copy for stability). Sheets
  *Dispositivos* (frozen header, autofilter, ids as text) and *Filtros* (active filters,
  search, counts, generation time and user). If the script fails to load: message + offer CSV.
- **PDF:** the same devices with fewer columns (Cadastro, Atividade, Label, Name, Profile,
  Customer, Reasons, Last activity), a header with the active filters, and a first-page
  summary matrix **customer × failing rule**.
- The button shows the count it will export: "Exportar 41 ▾".
- File name: `inventario_<cliente|todos>_<AAAA-MM-DD_HHmm>.<ext>`.

### 6. Where the code lives

```text
src/utils/devices/inventory/            ← library, pure, no DOM, Vitest
  rules.ts         RULES, evaluateDevice(device, ctx, now) → { cadastro, atividade, results[] }
  lifecycle.ts     resolveLifecycle(device) → { status, legacyHint }
  filters.ts       applyFilters, facetCounts, getVisibleRows(rows, filters, sort, groupBy)
  exportRows.ts    toExportMatrix(rows, columns), toCSV(matrix) (BOM, ';', injection guard)
  loader.ts        buildEntitiesQueryBody(page, pageSize), parseEntityRow(raw) (string parsing)
  formatLabel.ts   formatDeviceLabel(device) → { primary, secondary | null }
tests/utils/devices/inventory/*.test.ts

src/thingsboard/inventory-panel/v2.0.0/  ← widget: DOM, fetch, events, jsPDF/SheetJS loading
```

- `now` is injected so A2 is deterministic in tests.
- The widget consumes the module through `window.MyIOLibrary.inventory` (`libraryUrl`
  setting), like the other MYIO widgets. It is exported as a namespace
  (`export * as inventory`) because names such as `applyFilters` and `toCSV` already exist at
  the library root.

### 7. Visual system and robustness

- CSS variables scoped to the widget root (`--ip-accent` `#3e1a7d`, font **Nunito**);
  styles injected inside the container, not in `document.head`.
- Events by delegation on `data-action` / `data-id`; no `window.ip*`; strings escaped before
  `innerHTML`.
- `onDestroy` clears every interval/timeout and listener; in-flight responses are discarded
  after destroy (generation token).
- `aria-live="polite"` on "Mostrando X de Y"; badges carry text for screen readers.
- Dark/light toggle, `persistFilters` and configurable severities are **not** in v2.

### 8. Settings (`settings.schema` v2)

Kept: `title`, `defaultTab`, `defaultGroupBy`, `pageSize`, `showExportButton`,
`refreshInterval`, `enableNavigation` (now read). New: `libraryUrl`, `staleHours` (24),
`disabledRules` (default `["C6"]`), `integrationOverrides`, `xlsxScriptUrl`, `defaultSort`
(`gravity`).

### 9. Showcase — `showcase/inventory-panel-v2/` (where v2 is tested)

> `showcase/inventory-panel/` is the existing v1.0.0 showcase (RFC-0001, port 8080) and is
> left untouched; v2 gets its own folder.

Every step of the widget is validated in a showcase **before** being published to ThingsBoard,
following the `showcase/main-view-shopping/` pattern:

```text
showcase/inventory-panel-v2/
├── index.html          loads ../../dist/myio-js-library.umd.js and
│                       ../../src/thingsboard/inventory-panel/v2.0.0/controller.js (cache-busted)
├── config.example.json TB base URL, settings overrides (config.json is local, git-ignored)
├── fixtures/devices.json   mock entitiesQuery pages + /api/customers
├── README.md           how to run, modes, what each fixture device exercises
└── start-server.{bat,sh} / stop-server.{bat,sh}   `npx serve` on port **3346**
```

- **ThingsBoard context simulation:** `self.ctx` with `$container`, `settings` (from the
  widget's `settings.schema` defaults + `config.json`), `stateController.openState` (logged)
  and `http.get/post` returning an Observable-like object (`subscribe` / `toPromise`), as the
  controller uses `ctx.http` (`controller.js:306, 338, 355`). Lifecycle buttons call
  `onInit`, `onResize`, `onDestroy` — and a second instance can be mounted side by side
  (AC-12).
- **Two modes:**
  - **Mock (default, no login):** `ctx.http` answers from `fixtures/devices.json`, paged like
    `entitiesQuery/find`, with **string values** exactly as TB returns them. A toggle injects
    failures (a page error, a missing key, a slow page) to exercise the partial / error / refresh
    states.
  - **Live (read-only):** "🔑 Login TB" stores a JWT (as in `main-view-shopping`) and `ctx.http`
    calls the real `/api/entitiesQuery/find` and `/api/customers`. Used to repeat the
    section 10 calibration (AC-11).
- **Fixtures** are synthetic (no customer data) and cover every rule outcome: integrated vs
  non-integrated customer, tenant-owned device, blank vs `"null"` values, unknown profile,
  `_ARQUIVADO_` profile and `lifecycleStatus = archived/stock`, duplicate `ingestionId`,
  `active = "false"`, stale and missing `lastActivityTime`, blank `label`, `label === name`,
  names starting with `=`/`+` (CSV injection), long labels and accented text for search.
- An event log panel (as in `main-view-shopping`) shows requests, rule evaluation counts and
  export actions; exports download real files for manual checking.

### 10. Validation spike (2026-10-06, production tenant, read-only)

`POST /api/entitiesQuery/find`, 9,185 devices, 75 customers, 10 pages of 1,000 in ~3.5 s,
as `TENANT_ADMIN`.

| Measure | Devices |
|---|---|
| Owner = tenant (C1) | 1,157 |
| No `deviceProfile` (C2) | 5,547 (60%) |
| No `ingestionId` (C3) | 5,159 |
| No `gcdrDeviceId` (C4) | 5,794 |
| …of which in customers with **no** MYIO attribute at all (→ `notApplicable`) | 3,072 devices / 30 customers |
| `deviceProfile` ≠ TB `type` (C6) | 366 (TB `type = default` on 4,129 devices) |
| No `centralId` or `slaveId` | 3,877 |
| `ingestionId` shared by >1 device (C8) | 380 |
| `gcdrDeviceId` shared by >1 device (C8) | 113 |
| `identifier` shared (not used as a rule) | 1,817 |
| `(centralId, slaveId)` pairs repeated (deferred) | 855 pairs |
| `active = "false"` (A1) | 3,066 |
| `lastActivityTime` > 24 h (A2) | 2,940 |
| `lastActivityTime` missing | 74 |
| `label` empty / equal to `name` | 2,799 / 406 |
| Non-standard `deviceProfile` values among the 40 most frequent (e.g. "Park Lagos CAG", "default", "Melicidade - Hidrômetros") — to be checked against `DEVICE_TYPE_CONFIG` | ≥ 37 |
| Legacy lifecycle signals (`_ARQUIVADO_` profile / "desativado" annotation) | 16 / 19 |

Conclusion: without the integration gate, lifecycle and severity semantics, ~60% of the base
would show as Pendente/Crítico — the panel would be ignored. Expected Cadastro counts must be
re-checked against this table after implementing the gates (AC-11).

---

## Acceptance criteria

| AC | Criterion |
|---|---|
| AC-01 | Rows show image, `label` first, `(name)` muted monospace, a copy button that copies `name` without opening the device, the profile pill and both axis badges. |
| AC-02 | Blank `label` or `label === name` shows the name once, without parentheses. |
| AC-03 | Rules C1–C8, A1–A2 return `pass`/`fail`/`unknown`/`notApplicable` as specified; reasons show the failing rules in pt-BR. |
| AC-04 | "Íntegro" only when every applicable rule passed; any `unknown` shows "avaliação parcial" without hiding a known failure. |
| AC-05 | `stock`/`archived` devices are listed but excluded from the axis indicators, with the excluded count shown; legacy signals appear only as hints. |
| AC-06 | Unrecognized or blank profiles are "Não classificado" (never `energy` by default). |
| AC-07 | Filters combine AND/OR as specified; facet counts follow the definition in section 4. |
| AC-08 | Typing in the search never loses focus; only the list region re-renders. |
| AC-09 | XLSX/CSV contain every device of `getVisibleRows()` (including collapsed and unrendered), in list order, with `deviceId` and `customerId`; CSV has no metadata rows and guards formula injection; PDF has the same devices with fewer columns. |
| AC-10 | One `entitiesQuery/find` request per page; no per-device requests; values parsed explicitly from strings. |
| AC-11 | On the production tenant, Cadastro counts after the gates are reviewed with the owner before release. |
| AC-12 | Two instances work independently; destroying during a request leaves no timer/listener and drops the late response. |
| AC-13 | v1.0.0 behaves exactly as before (only its `docs/` folder moved). |
| AC-14 | `showcase/inventory-panel-v2/` runs the v2 controller in mock mode without login, covers every fixture case, supports two side-by-side instances and a live read-only mode; every delivery step is checked there before publishing to TB. |
| AC-15 | The Painel tab shows cards, Cadastro and Atividade doughnuts, the customers with most failures, the most failing rules and the customer × rule matrix — all from the filtered set and equal to the list counts; clicking any of them filters the list and opens Dispositivos; without Chart.js the cards and the matrix still render. |

## Delivery plan

**One single, final PR** from `feat/ED-1324-inventory-panel-v2` to `desenv`, opened only when
every step below is done and validated. No intermediate PRs; work stays on the branch, with
commits only when the owner approves them.

The steps are the order of work inside that branch, each with its own checkpoint:

| Step | Scope | Checkpoint (before moving on) |
|---|---|---|
| 1. Library logic | `src/utils/devices/inventory/*` + tests + exports in `src/index.ts` | AC-03/04/05/06/07, matrix part of AC-09, AC-10 body/parse — green in Vitest; build OK |
| 2. Showcase + widget skeleton | `showcase/inventory-panel-v2/` (mock + live) and the widget skeleton: loader, delegation, root-scoped styles, states, destroy | AC-08, AC-10, AC-12, AC-13, AC-14 — verified in the showcase |
| 3. Filters and Painel | Cliente / Domínio / Perfil / Regra dropdowns with facet counts, rule explanations, the Painel tab (`buildDashboardSummary` in the lib + tests, cards, charts, matrix, click-to-filter), lifecycle filter | AC-01, AC-02, AC-05, AC-07, AC-15 in the showcase (mock); AC-11 in the showcase live mode, reviewed with the owner |
| 4. Exports | XLSX/CSV/PDF | AC-09 in the showcase (+ manual PDF/XLSX checklist in `v2.0.0/docs/`) |
| 5. Final PR | full test suite, build, lint of the changed files, showcase walkthrough of every AC, RFC status → "Implemented" | all ACs checked; PR to `desenv` with the AC checklist |

**Step 4 — as implemented (2026-10-06):**

- "Exportar N ▾" menu (N = `applyFilters` count); XLSX / CSV / PDF all export
  `getVisibleRows()` (filters + search, list order, collapsed and unrendered rows included).
- **XLSX:** SheetJS `xlsx@0.18.5` from cdnjs, loaded on the first XLSX click; the setting
  `xlsxScriptUrl` points it to a MYIO-hosted copy (open question 3). Sheets *Dispositivos*
  (every cell a string, autofilter, column widths) and *Filtros* (`buildExportSummary` in the
  lib: generated at/by, active filters or "Nenhum", indicator counts). The frozen header is
  **not** written: SheetJS Community Edition does not support panes. SheetJS 0.18.5's
  advisories concern *parsing* files; the panel only writes.
- **PDF:** jsPDF 2.5.1 + jspdf-autotable 3.8.2 from cdnjs, landscape A4, compressed. Page 1 =
  summary + annex legend (dots + rule codes) + customer × rule matrix (15 customers). Then a
  **compact annex** instead of a wide table: font 6, **3 columns per page**, one device per
  line (Cadastro dot, Atividade dot, "Label (name)" cut with "…", failed rule codes, age of
  the last activity), grouped like the list, with the group header repeated ("— cont.") when
  a group crosses a column/page. Footer "Gerado em … · Página x de y". Owner's request after
  the live test: the 8-column table produced 342 pages / 16.5 MB / 11 s for 9,291 devices;
  the annex gives **56 pages / 1.6 MB / 6 s** for 9,294. Details stay in the XLSX.
- **Fallback:** if a generator script fails to load, `openConfirmDialog` offers the CSV of
  the same rows.
- "Gerado por" comes from `ctx.currentUser.sub` (TB JWT claims).
- Verified in the showcase (mock): CSV 85 rows / header; XLSX sheets, autofilter, ids as
  text; PDF 5 pages; filtered export (Crítico → 4 rows; Shopping Alfa → 50 rows,
  `inventario_shopping-alfa_…xlsx`); CDN-blocked XLSX → dialog → CSV. Manual checklist:
  `src/thingsboard/inventory-panel/v2.0.0/docs/EXPORT-CHECKLIST.md`.

**Live calibration (AC-11, 2026-10-06, production tenant, showcase live mode):**

- Load: 9,291 devices in 3.7 s (10 pages × ~220 ms), no partial load.
- Cadastro: Íntegro 5,993 · Pendente 1,624 · Crítico 1,674 · Parcial 0.
  Atividade: Reportando 6,223 · Sem atividade 3,068 · Sem dado 0 (the 72 devices without
  `lastActivityTime` are all `active = false`, a known failure that wins).
- Failing rules: A1 3,068 · A2 2,939 · C4 1,660 · C2 1,422 (1,127 with TB type `default`) ·
  C1 1,157 · C3 1,064 · C8 473 (245 groups; Campinas Shopping 226) · C5 57 (Park Lagos
  profiles, `*_ARQUIVADO_*`) · C7 16.
- Integration gate: 33 customers / 3,084 devices not integrated (spike: 30 / 3,072).
- Open decisions (owner):
  - **D1** — no device has `lifecycleStatus` yet; 177 carry the legacy hint (customer
    `DESATIVAR`, profile `ARQUIVADO`) and still count (Campinas DESATIVAR: 85 Crítico).
    Proposal: treat the legacy hint as archived until the backfill, behind a setting.
  - **D2** — gate fragility: Obramax Aricanduva is 108/108 Crítico because one device has an
    `ingestionId` (integration in progress). Proposal: `integrationOverrides` per customer.
  - **D3** — C1 stays Pendente? (1,153 of the 1,157 also have no profile; 90 active.)
  - **D4** — C8 stays Crítico; open a cleanup ticket for Campinas Shopping duplicates?

## Drawbacks

- Another inventory version to maintain while v1 is deployed.
- A new `lifecycleStatus` attribute needs an operational backfill before the lifecycle
  indicators are meaningful.
- XLSX adds a lazily loaded third-party script.

## Rationale and alternatives

- **Two axes instead of one badge** — a missing integration and a silent device call for
  different actions by different people.
- **`deviceInfos` + `entitiesQuery` merge** — rejected: two cursors that can drift between
  pages; `entitiesQuery` alone covers the needs (customer id through the unique customer
  title).
- **Boolean rules** — rejected: cannot express "not applicable" or "could not evaluate".
- **CSV instead of XLSX** — rejected: XLSX is a stated requirement, not an optimization.
- **Rule engine inside the ES5 widget** — rejected: untestable in `tests/`.

## Unresolved questions

1. Who backfills `lifecycleStatus`, and from which legacy signal first?
2. Integration gate: is "≥ 1 device with `ingestionId` or `gcdrDeviceId`" the right default,
   or should the integrated customers come from GCDR?
3. Where to host the pinned SheetJS copy (MYIO CDN / TB resources)?
4. C7 domains that require a central (energy and water meters; thermostats?).
5. Severity of C1 for devices that are neither stock nor assigned.

## Future possibilities

- Consistency checks against the ingestion API (`deviceType` vs `deviceProfile` domain) and GCDR.
- Duplicate `(centralId, slaveId)` and grouping by central with "all devices silent" hints.
- Bulk lifecycle tagging; move the panel into the library with a showcase.

---

## Appendix A — Decision log (rev. 1 → rev. 2)

| Topic | Rev. 1 | Rev. 2 | Source |
|---|---|---|---|
| Status | one badge OK/Atenção/Crítico | two axes Cadastro / Atividade | Sally, Mary, external review |
| Rule result | boolean | `pass`/`fail`/`unknown`/`notApplicable` | external review |
| Precedence with unknown | unspecified (`critical > unknown > …` proposed in round) | known severity kept + "avaliação parcial" | external review |
| Lifecycle | absent | `lifecycleStatus` attribute; legacy signals as hints | Mary, external review, spike |
| R3/R4 | always | only for integrated customers | external review, spike |
| R7 (now C6) | Atenção | Info, disabled by default | Mary, external review |
| R8 (now C7) | optional | only for central-attached domains | external review |
| Domain | `getDeviceCategory` | "Não classificado" for unknown profiles | external review |
| Duplicates | — | C8 for `ingestionId`/`gcdrDeviceId`; pairs/identifier deferred | Mary, spike |
| Loader | `deviceInfos` + `entitiesQuery` merge | `entitiesQuery` only; customer id via unique title | Winston, spike |
| `lastActivityTime` | entity field | `SERVER_ATTRIBUTE`, string parsing | Winston, Amelia, spike |
| Rule engine | inside the widget | library module with Vitest | Winston, Amelia, Mary |
| XLSX | SheetJS from cdnjs | real XLSX, pinned, preferably MYIO-hosted, CSV fallback | external review (Amelia proposed cutting it) |
| CSV header | filters in header | tabular only; filters in PDF and XLSX sheet | Sally, external review |
| Export columns | no ids | + `deviceId`, `customerId` | Mary, external review |
| Status / Atividade dropdowns | separate | KPI chips are the filters | Sally |
| Audience | open question | internal MYIO tool | Mary, external review |
| Ingestion consistency | silent | explicit non-goal | Mary, external review |
| Delivery | 4 PRs proposed in the round | one single, final PR to `desenv`; the 4 slices became internal steps with checkpoints | owner (2026-10-06) |
| Testing ground | — | `showcase/inventory-panel-v2/` (mock + live), `main-view-shopping` pattern | owner (2026-10-06) |
| Painel tab | "charts read the filtered set" but in no delivery step | explicit Painel (cards, doughnuts, top customers, top rules, customer × rule matrix, click-to-filter) in step 3 | owner (2026-10-06) |

## Appendix B — Review round 1 (2026-10-06)

BMAD party mode with **Sally** (UX), **Winston** (architecture), **Amelia** (implementation),
**Mary** (business), followed by an external review of the RFC and the round.

- **Sally:** "status" collides with the online/offline vocabulary of every dashboard → rename
  to Cadastro and split activity out; reasons inline instead of tooltip; copy button must not
  navigate; loading/error/empty/refresh states; CSV must stay tabular; PDF with fewer columns.
- **Winston:** single `entitiesQuery` loader; `lastActivityTime` is a server attribute, not an
  entity field; `entitiesQuery` honours the caller's permissions; rule engine in the library;
  incremental rendering over virtualization; refresh must not overlap.
- **Amelia:** pure modules in `src/utils/devices/inventory/` with injected `now`; precise
  definitions for blank values, tenant owner, facet counts and export equality; CSV injection;
  4-PR slicing (later replaced by the owner with a single final PR — see Delivery plan).
- **Mary:** rev. 1 rules would not catch the three real incidents (wrong type in ingestion,
  deactivated devices still counted, replaced central); lifecycle, duplicates, severity
  semantics, export ids, calibration against real data before fixing severities.
- **External review (adopted by the owner, 2026-10-06):** lifecycle from a structured
  attribute; ingestion consistency out of scope but declared; two axes; internal audience; real
  XLSX; four-valued rule results; "avaliação parcial" instead of letting `unknown` hide a known
  failure; R3/R4/R7/R8 gated; "Não classificado" domain; duplicates/central grouping as later
  evolutions; facet-count wording; multi-instance validated by behaviour, not by regex.
- **Spike (section 10)** confirmed the loader contract and quantified the false-positive risk.
