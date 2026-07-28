# RFC-0222: Customer Energy & Water Pricing Panel

- Feature Name: `customer_energy_pricing_panel`
- Start Date: 2026-07-16
- RFC PR: (leave this empty)
- Tracking Issue: (leave this empty)

## Summary

Add a public, prototype panel — `openPricingPanel(params)` — that lets an
operator define a **price in BRL** for a **customer (shopping)**, scoped to a
**domain** (energy → R$/kWh, water → R$/m³), a **usage category** (`lojas` /
`area_comum`), and a **period**. A period is either a **closed month**
(`2026-03`) or a **day-to-day range** (`2026-03-01 … 2026-03-15`).

The panel is organized in three tabs:

- **Definir preços** — add/edit/remove prices with the selectors above.
- **Dashboard** — KPIs over the saved prices + a filterable report table
  covering **energy AND water**.
- **Histórico** — the audit trail of every price action.

It is **MyIO-only** (gated to `@myio.com.br` accounts / SuperAdmin), enforces
**no overlapping periods within the same (customer, domain, category)**
client-side, **upserts idempotently** (re-adding the same scope × period only
updates the price, never duplicates), and records an **audit log** for every
create / price-change / delete. This RFC ships a **prototype**: persistence is
in-memory + `localStorage` + an `onSave` callback. The real persistence surface
(GCDR endpoint or a SERVER_SCOPE attribute) is specified here but intentionally
not wired.

```ts
const panel = MyIOLibrary.openPricingPanel({
  customers: [{ gcdrCustomerId: 'gc-1', tbId: 'tb-1', title: 'Shopping Iguatemi' }],
  currentUserEmail: 'op@myio.com.br',
  domain: 'energy',      // initial domain selection
  category: 'lojas',     // initial category selection
  theme: window.MyIOUtils?.theme,
  onSave: (entries) => console.log('pricing', entries),
});
panel.on('add', (p) => {/* ... */});
const auditLog = panel.getAuditLog();
```

## Motivation

Energy and water cost reporting needs a **price signal** (R$/kWh, R$/m³) to turn
measured consumption into money (R$). Today that tariff lives nowhere
structured: it is hard-coded in report exports or pasted into spreadsheets, so:

- **No per-period tariffs.** Utility prices change monthly (bandeiras
  tarifárias, reajustes). A single flat number cannot represent a March price
  different from an April price.
- **No per-customer isolation.** Each shopping negotiates its own tariff; a
  global constant is wrong for a multi-tenant dashboard.
- **No per-category isolation.** Tenant stores (`lojas`) and common-area
  equipment (`area_comum`) are billed at different rates; energy and water are
  entirely different tariffs. A one-dimensional price cannot express that.
- **No guard rails.** Nothing prevents two conflicting prices covering the same
  day, which would make a R$ total ambiguous.
- **No audit trail.** A commercial figure that feeds billing needs to show who
  set it, when, and what it was before.

This RFC introduces the **UI, data model and audit trail** for
customer × domain × category × period pricing as a prototype, so the reporting
features (AllReportModal, energy/water summaries) can later read a well-defined
price table instead of a magic constant. Landing the UX, validation, KPIs and
data shape first — behind a stub persistence — lets us iterate on the interaction
before committing a backend contract, the same prototype-then-persist path the
library used for other panels.

## Guide-level explanation

`openPricingPanel(params)` opens a premium modal (Nunito font, MyIO palette,
light/dark aware) with three tabs over the current dashboard.

### Gating

If `currentUserEmail` does not end in `@myio.com.br` — and the user is not a
`window.MyIOUtils.SuperAdmin` — the panel renders only a locked state:

> 🔒 Funcionalidade disponível apenas para usuários MyIO.

No form/tabs are shown, and `handle.getEntries()` returns `[]`.

### Tab 1 — Definir preços

1. **Customer** selector — one of `params.customers`. The first is preselected.
2. **Domínio** — Energia | Água. Switching it flips the price unit label between
   `R$/kWh` and `R$/m³`.
3. **Categoria** — Lojas | Área Comum.
4. **Tipo de período** — “Mês fechado” (closed month) or “Dia a dia” (range).
5. **Preço** — a pt-BR text field (`0,75`, `R$ 1.234,56`).
6. Period inputs: month → `<input type="month">`; range → start/end
   `<input type="date">` (inclusive).
7. **Add período** button. On click it validates, then upserts.

Adding a period:

- **Idempotent upsert.** If the same (customer, domain, category) already has that
  exact period, its price is updated in place (version bumped) — no duplicate row.
  Re-adding the *same* price is a no-op.
- **Overlap rejection.** If the new period overlaps a *different* existing period
  in the **same (customer, domain, category)**, the add is blocked with an inline
  error naming the conflict. Overlap is inclusive: March (`2026-03`) conflicts
  with the range `2026-03-20 … 2026-04-05`. Different domains or categories are
  **independent** — energy-March and water-March can coexist.
- On success the customer/domain/category just used stay selected and the list
  re-renders.

Below the form is the **list of periods for the selected customer** (across all
domains/categories), each row showing a domain·category badge, the period label,
the price with its unit, and a remove (✕) button.

### Tab 2 — Dashboard

KPI cards computed over all saved prices:

- number of periods total and per domain (energy / water),
- **mean R$/kWh** and **mean R$/m³**,
- **coverage** = distinct (customer × domain × category) combinations that hold a
  price, out of `customerCount × 4`,
- last update timestamp.

Below the KPIs, a **report table** (customer × domain × category × período ×
preço) filterable by domain (Todos | Energia | Água).

### Tab 3 — Histórico

The **audit trail**, most recent first: each record shows the action
(`created` / `price-changed` / `deleted`), the domain·category badge, the period
label, the price (before → after for changes), the customer, the author and the
timestamp.

### The handle

```ts
interface PricingPanelHandle {
  close(): void;
  on(event: 'save' | 'close' | 'add' | 'remove', cb: (payload?: unknown) => void): void;
  getEntries(): PricingEntry[];
  getAuditLog(): PricingAuditRecord[];
}
```

Every mutation calls `params.onSave(entries)` and persists entries + audit log to
`localStorage` (prototype). The panel closes on the ✕, the overlay, or Escape.

## Reference-level explanation

### Public API

```ts
interface OpenPricingPanelParams {
  customers: Array<{ tbId?: string; gcdrCustomerId?: string; title: string }>;
  currentUserEmail?: string;             // gate + audit author
  domain?: 'energy' | 'water';           // initial domain selection. Default 'energy'.
  category?: 'lojas' | 'area_comum';     // initial category selection. Default 'lojas'.
  theme?: { cssVars(): Record<string,string> } | Record<string,string>;
  onSave?: (entries: PricingEntry[]) => void;
  targetDocument?: Document;             // default: top-level document
  storageKeyPrefix?: string;             // tenant namespace. Default 'myio'.
  initialEntries?: PricingEntry[];       // seeds, merged over localStorage
}

function openPricingPanel(params: OpenPricingPanelParams): PricingPanelHandle;
```

### Data model

```ts
type PricingDomain   = 'energy' | 'water';
type PricingCategory = 'lojas' | 'area_comum';
type PricingAuditAction = 'created' | 'edited' | 'deleted' | 'price-changed';

interface PricingAuditRecord {
  action: PricingAuditAction;
  at: string;                 // ISO timestamp
  by: string;                 // author (currentUserEmail in the prototype)
  customerId: string;
  domain: PricingDomain;
  category: PricingCategory;
  periodLabel: string;        // human-readable, captured at action time
  before?: { pricePerKwh?: number } | null;
  after?:  { pricePerKwh?: number } | null;
}

interface PricingEntry {
  customerId: string;                 // gcdrCustomerId ?? tbId ?? title
  domain: PricingDomain;
  category: PricingCategory;
  periodType: 'month' | 'range';
  periodKey?: string;                 // 'YYYY-MM'    (periodType === 'month')
  start?: string;                     // 'YYYY-MM-DD' (periodType === 'range', inclusive)
  end?: string;                       // 'YYYY-MM-DD' (periodType === 'range', inclusive)
  pricePerKwh: number;                // BRL per unit — kWh (energy) or m³ (water), > 0
  currency: 'BRL';
  version?: number;                   // optimistic-concurrency counter
  createdAt?: string; createdBy?: string;
  updatedAt?: string; updatedBy?: string;
  history?: PricingAuditRecord[];     // per-entry trail (created / price-changed)
}
```

> Note: the price field is named `pricePerKwh` for backward compatibility; it
> holds R$/kWh for energy and R$/m³ for water. A future revision may rename it to
> a unit-tagged `pricePerUnit`.

The **upsert key** is `(customerId, domain, category, periodType, periodKey |
start+end)`, encoded by `periodIdentity(entry)`. Every entry has inclusive date
bounds via `entryBounds(entry)`:

- month → `[YYYY-MM-01, YYYY-MM-<lastday>]`
- range → `[start, end]`

### Idempotency & overlap algorithm

`upsertEntry(entries, candidate, { by, now })` (pure, no DOM) returns
`{ entries, status: 'inserted' | 'updated' | 'noop' | 'overlap', conflict?, audit? }`:

1. Restrict to the candidate's **scope** = same `(customerId, domain, category)`.
2. If a scoped entry has the same `periodIdentity`:
   - same price → `noop` (fully idempotent, no version bump, no audit);
   - different price → `updated`: replace `pricePerKwh`, bump `version`, set
     `updatedAt/By`, append a `price-changed` record to `history`, return it as
     `audit`.
3. Else if the candidate's bounds overlap any **other scoped** entry's bounds
   (`aStart <= bEnd && bStart <= aEnd`) → `overlap` with the conflicting entry.
4. Else append with `version = 1`, `created` history, `audit.action='created'`.

`removeEntryByBounds(entries, { customerId, domain, category, boundsKey }, opts)`
returns `{ entries, audit }` with a `deleted` record. The input list is never
mutated. Overlap is scoped: different customers, domains or categories may hold
the same period.

### Audit trail

Two levels:

- **Per entry**: `PricingEntry.history[]` accumulates `created` and
  `price-changed` records for the living row.
- **Panel-level aggregated log**: the panel keeps an `auditLog: PricingAuditRecord[]`
  (most recent first) that also survives deletions (a deleted row's history would
  otherwise be lost). The Histórico tab renders this log; `handle.getAuditLog()`
  exposes it.

In the prototype the author is `currentUserEmail` and timestamps use the browser
`Date`. (Only the ThingsBoard **WORKFLOW** script context forbids `Date`; this is
ordinary browser runtime, so `Date` is fine here.)

### KPIs

`computePricingKpis(entries, { customerCount })` returns `totalPeriods`,
`periodsByDomain`, `periodsByCategory`, `avgEnergyPrice` (R$/kWh),
`avgWaterPrice` (R$/m³), `lastUpdatedAt`, and `coverage` =
`{ covered, total = customerCount*4, pct }`.

### Prototype persistence

- **In-memory**: the panel keeps the working `entries` array and `auditLog`.
- **localStorage**: entries under `` `${storageKeyPrefix}:pricing` `` and the
  audit log under `` `${storageKeyPrefix}:pricing-audit` `` (each entry carries
  its own `domain`/`category`, so a single array is keyed by the full identity).
  Hydrated on open, rewritten on every mutation. Failures (private mode, quota)
  are swallowed.
- **Callback**: `onSave(entries)` fires on every add/edit/remove with a
  defensive copy.

### Files

```
src/components/pricing-panel/
  index.ts              # barrel
  types.ts              # public types (entry, audit, kpis, params, handle)
  styles.ts             # injectPricingPanelStyles(doc) — idempotent, --myio-* aware
  helpers.ts            # pure logic: parse/format BRL, entryBounds, periodIdentity,
                        #   upsertEntry, removeEntryByBounds, computePricingKpis, gating
  openPricingPanel.ts   # factory: tabbed modal DOM + wiring
```

Exported from `src/index.ts` as `openPricingPanel` plus the types.

### Theming

Same pattern as `AllReportModal` / `openSettingsHubModal`: the effective palette
is `params.theme ?? window.MyIOUtils.theme`. If it exposes `cssVars()` (a
`createMyIOTheme` object) those vars are read, else a flat `--myio-*` map is used;
each is applied with `root.style.setProperty` so the header/accent/tabs follow the
host dashboard.

### Future real persistence & audit (not in this RFC)

The prototype boundary is `loadJson` / `saveJson` in `openPricingPanel.ts`. The
real implementation replaces those with a repository call, leaving the UI
untouched:

```
GET    /customers/:customerId/pricing?domain=energy&category=lojas -> PricingEntry[]
PUT    /customers/:customerId/pricing                              -> upsert one entry (idempotent, version-checked)
DELETE /customers/:customerId/pricing/:periodIdentity              -> remove one entry
GET    /customers/:customerId/pricing/audit                        -> PricingAuditRecord[]
```

`version` supports optimistic concurrency (If-Match / 409 on stale writes),
mirroring the GCDR goals/margin contract (RFC-0046, RFC-0052). Auth via
`X-API-Key` with an explicit `baseUrl`, as the other GCDR clients do. The audit
trail becomes a server-side, append-only log (real `by` from the auth context
instead of `currentUserEmail`). A SERVER_SCOPE attribute (`customerPricing`) is an
acceptable alternative for a ThingsBoard-only deployment; the audit log would then
be a companion attribute.

## Drawbacks

- **Another prototype persistence layer.** `localStorage` state is per-browser
  and not authoritative; if shipped visibly it can mislead users into thinking
  prices are saved server-side. Mitigation: the RFC and code label it a prototype
  and the callback exists so a host can persist immediately.
- **Client-side-only overlap validation.** Two operators could still create
  conflicting periods concurrently without a server guard. Acceptable for a
  prototype; the future PUT must re-validate server-side.
- **Client-supplied audit author.** In the prototype `by` is
  `currentUserEmail`, which the client controls; a real audit trail must stamp
  the author from the server auth context.
- **Single currency.** BRL only; multi-currency is out of scope.
- **No tariff components.** A real tariff has TE/TUSD, taxes and bandeiras. This
  panel stores a single blended price per unit.

## Rationale and alternatives

- **Why customer × domain × category × period, inclusive intervals?** It is the
  minimal shape that makes “stores' energy consumption in March × March store
  price” unambiguous while allowing tariffs to change over time and to differ by
  domain and by usage class. Closed months cover the common case; ranges cover
  mid-month reajustes.
- **Why forbid overlaps in the UI rather than resolve them?** A deterministic R$
  total requires exactly one price per day within a scope. Rejecting overlaps
  keeps the model a clean partition instead of introducing precedence rules.
- **Why scope overlap to (customer, domain, category)?** Energy and water, and
  stores vs common-area, are independent tariffs; forbidding cross-scope overlap
  would be wrong (they legitimately share calendar periods).
- **Why upsert (not append)?** Editing a price is the frequent operation;
  append-only would grow duplicate rows and require a separate edit affordance.
- **Why a `noop` status?** It makes idempotency observable and avoids polluting
  the audit trail when a price is re-submitted unchanged.
- **Alternatives considered:**
  - *A spreadsheet import (CSV)* — deferred; the panel could gain CSV import like
    the goals panel later.
  - *A global price constant* — rejected: wrong for multi-tenant, no history.
  - *Storing price on each device* — rejected: tariff is a customer-level
    commercial fact, not a device property.

## Prior art

- **RFC-0046 / RFC-0052 (Goals & margin, GCDR):** customer-scoped, per-period,
  versioned values fetched from `/customers/:id/goals` — the closest sibling and
  the template for the future pricing endpoint and optimistic concurrency.
- **RFC-0215 (`openSettingsHubModal`):** the factory/overlay/theming convention
  (`--myio-*` root vars, idempotent style injection, top-document mount) this
  panel follows.
- **RFC-0203 (Header annotations):** per-record history / audit UX with actions
  and authors — the template for the Histórico tab.
- **RFC-0182 (AllReportModal):** the consumer that will multiply consumption by
  these prices to produce R$ totals.
- Utility tariff tables (ANEEL bandeiras) generally model price-by-period; this is
  the standard domain shape.

## Unresolved questions

- **Persistence target:** GCDR endpoint vs. SERVER_SCOPE attribute — decide
  before productionizing.
- **Category taxonomy:** are `lojas` / `area_comum` sufficient, or should the
  categories mirror RFC-0128's finer energy subcategories (Climatização,
  Elevadores, …)? The prototype uses the coarse pair.
- **Granularity of the range key:** is a per-day range enough, or do intraday
  (peak/off-peak) tariffs need modeling? Out of scope for the prototype.
- **Who may edit:** all `@myio.com.br` users, or a narrower role? The gate is a
  domain check today.
- **Coverage semantics:** should the UI actively warn when a customer has
  consumption periods with *no* price? The KPI reports coverage but does not
  block.
- **Rounding/precision:** number of decimals to persist (4 today) and how reports
  round when multiplying.

## Future possibilities

- **Billing integration.** Feed the price table into an invoicing/faturamento
  flow: multiply per-period consumption (energy kWh, water m³) by the matching
  (customer, domain, category, period) price to emit billable line items and
  monthly cost statements; reconcile against the utility invoice. The audit trail
  and `version` give the traceability billing requires, and the future GCDR
  endpoint is the natural integration point for a billing service.
- Wire the real GCDR pricing repository and drop the localStorage stub.
- Feed prices into AllReportModal and energy/water summaries to show R$ alongside
  kWh / m³.
- CSV import/export of a tariff table (parity with the goals panel).
- Coverage view: highlight periods with no price for a customer × domain ×
  category.
- Finer categories aligned with RFC-0128 energy subcategorization.
- Tariff components (TE/TUSD, taxes, bandeiras) as an advanced mode.
- Server-side, append-only audit with authenticated authors and diff of every
  field (not just price).
