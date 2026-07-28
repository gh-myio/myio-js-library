- Feature Name: `customer_goals_card`
- Start Date: 2026-07-09
- RFC PR: (to be filled)
- Status: **PROPOSED — awaiting approval**
- Tracking Issue: (to be filled)
- Visual reference: `logs/025-card-GoalsByCustomer.png` (faithful inspiration — this image is the spec)

# RFC-0217 — CustomerGoalsCard: per-shopping "small multiples" cards for the Goals × Consumption modal

## Summary
[summary]: #summary

A new reusable card component — `createCustomerGoalsCard` at `src/components/cards/customer-goals/v1.0.0/` — that faithfully reproduces the per-unit card in `logs/025-card-GoalsByCustomer.png`: a compact dark-friendly card with a 3-series sparkline (**Realizado**, **A-1**, **Orçado**), a totals strip and a deltas strip (*vs A-1*, *vs Orçado*). The Head Office **Goals × Consumption** modal (MYIO-SIM v5.2.0_UNIQUE) gains a new view mode — **Cards** — alongside the existing *Consolidado*, *Empilhado* and *Por shopping* pills, rendering one card per shopping in a responsive grid ("small multiples" pattern). The component is exported from `src/index.ts` and demoed in `showcase/main-unique-datasource`.

## Motivation
[motivation]: #motivation

Today the Goals × Consumption modal draws every mode on a **single Chart.js canvas**. The *Por shopping* (separado) mode plots up to 18 datasets (6 shoppings × current year + previous year + goal line) on one chart — legible for 2–3 shoppings, noisy beyond that. Business users asked for the classic BI "consumption per unit" layout (see reference PNG): **one mini-chart per shopping**, each with its own scale, totals and variance badges, so that:

1. Each shopping can be read **independently** (own Y scale — a small shopping is not flattened by a big one).
2. The two questions that matter — *"how are we vs last year?"* and *"how are we vs budget?"* — are answered by **explicit ▲/▼ percentage badges**, not by eyeballing line gaps.
3. The pattern scales: 4 shoppings (Soul Malls) or 6 (Sá Cavalcante) render as a clean grid; more customers just wrap to new rows.

## Guide-level explanation
[guide-level-explanation]: #guide-level-explanation

### Card anatomy (faithful to the reference image)

```
┌──────────────────────────────────────┐
│           Shopping Alpha             │  ← title, centered, bold
│  3M ┤        ▄▄�අ▀▀●▄▄               │
│  2M ┤   ●▄▄●▀ ▄▄▄▄▄▄▄▄●             │  ← sparkline, 3 series:
│  1M ┤ ●▀▀                            │     Realizado (green ●, solid)
│   0 └──┬────┬────┬────┬──           │     A-1 (blue ●, solid)
│       Jan  Abr  Jul  Out             │     Orçado (amber ■, DASHED)
├──────────┬───────────┬───────────────┤
│ Realizado│    A-1    │    Orçado     │  ← labels in series colors
│ 1.486.520│ 1.512.300 │  1.505.000    │  ← period totals (pt-BR)
├──────────────┬───────────────────────┤
│    vs A-1    │      vs Orçado        │
│   ↓ 1,71%    │      ↓ 1,23%          │  ← ↓ green (good), ↑ red (bad)
└──────────────┴───────────────────────┘
```

- **Series semantics** (Goals × Consumption modal): *Realizado* = consumption of the selected period (current year); *A-1* = same period, previous year; *Orçado* = GCDR goal for the period (RFC-0046 tree).
- **Delta badges**: `vs A-1 = (realized − a1) / a1`, `vs Orçado = (realized − budget) / budget`. Consumption **above** reference is bad → `↑ red`; below → `↓ green`. Reference `null`/`0` → em-dash badge ("—").
- **Y-axis ticks** abbreviated exactly like the reference (`1M`, `2M`, `3M`): reuse the modal's unit conversion (RFC "kWh ≥ 1.000 → MWh" rule via `_fmtQtyStr`-style compact formatter; water stays m³).
- **X-axis**: sparse bucket labels (first month of each quarter for monthly; ~4 evenly spaced labels for daily/hourly) to keep the mini-chart clean.
- **Shared legend**: rendered **once** below the cards grid (`A-1 (2025) · Realizado (2026) · Orçado (2026)`), not per card — exactly like the panel in the reference image.
- **Theming**: light/dark via `themeMode`, following the modal's `GC_THEMES` tokens (the reference is dark; light mode maps to the modal's light surface/border/text tokens). Nunito everywhere (MYIO standard font).
- **Hover**: subtle elevation (consistent with the energy-panel premium cards), tooltip on chart points via Chart.js.

### New mode in the Goals × Consumption modal

The mode pills become: **Consolidado · Empilhado · Por shopping · Cards**. Selecting *Cards*:

- hides the single `[data-evo-wrap]` canvas and shows a `[data-cards-grid]` container — CSS grid `repeat(auto-fill, minmax(250px, 1fr))`;
- renders one `createCustomerGoalsCard` per shopping, fed by the **same data already fetched** by `loadEvo()` for the *Por shopping* mode (per-shopping consumption buckets for current and previous year + per-shopping GCDR goal buckets) — no new API calls;
- respects the existing period picker, domain tabs (Energy/Water) and granularity pills (Mês/Dia/Hora, Hora ≤ 15 days);
- theme toggle re-themes cards in place (`setThemeMode`), maximize re-flows the grid naturally.

## Reference-level explanation
[reference-level-explanation]: #reference-level-explanation

### File layout

```
src/components/cards/customer-goals/
└── v1.0.0/
    ├── CustomerGoalsCard.ts     # component (view + chart + styles injection)
    ├── types.ts                 # params/instance interfaces
    └── index.ts                 # re-exports
```

Export chain: `src/components/cards/customer-goals/v1.0.0/index.ts` → `src/index.ts` (`createCustomerGoalsCard`, `CustomerGoalsCardParams`, `CustomerGoalsCardInstance`).

### Public API

```typescript
export interface CustomerGoalsSeries {
  /** Bucket labels (months "Jan".."Dez", days "01/07".., or hours) */
  labels: string[];
  /** Consumption of the current period, one point per bucket (null = gap) */
  realized: Array<number | null>;
  /** Same buckets, previous year (optional — strip/badge omitted when absent) */
  previousYear?: Array<number | null>;
  /** Goal per bucket (optional — strip/badge omitted when absent) */
  budget?: Array<number | null>;
}

export interface CustomerGoalsCardParams {
  container: HTMLElement;
  title: string;                       // shopping name
  series: CustomerGoalsSeries;
  unit?: string;                       // 'kWh' (default) | 'm³' — drives tick/total formatting
  yearLabels?: { current: string; previous: string }; // e.g. {current:'2026', previous:'2025'}
  totals?: {                           // optional override; default = sum of non-null points
    realized?: number | null;
    previousYear?: number | null;
    budget?: number | null;
  };
  themeMode?: 'light' | 'dark';        // default 'light'
  locale?: string;                     // default 'pt-BR'
  onClick?: (info: { title: string }) => void;  // optional card click-through
}

export interface CustomerGoalsCardInstance {
  el: HTMLElement;
  update(partial: Partial<Pick<CustomerGoalsCardParams, 'series' | 'totals' | 'title'>>): void;
  setThemeMode(mode: 'light' | 'dark'): void;
  destroy(): void;                     // removes DOM + destroys chart instance
}

export function createCustomerGoalsCard(params: CustomerGoalsCardParams): CustomerGoalsCardInstance;
```

### Rendering rules

- **Chart engine**: `window.Chart` (Chart.js, already loaded by the HO widget and by the showcase via CDN). If `window.Chart` is missing the card renders everything except the chart area, which shows a quiet "gráfico indisponível" placeholder — the lib must **not** bundle Chart.js (bundle-size budget: ESM/CJS ≤ 50 KB).
- **Series styling** (from the reference): Realizado `#22c55e` solid, point radius 2.5; A-1 `#3b82f6` solid; Orçado `#f59e0b` dashed `[6,4]`, square point style. Line tension 0.3, no fill, `spanGaps: true`.
- **Compact value formatter**: `1486520 kWh → "1,49M"` on ticks; totals strip uses full pt-BR grouping (`1.486.520`) exactly like the reference. For the energy domain totals may also be rendered pre-converted (MWh/GWh) by the caller — the card only formats, semantics stay with the host.
- **Styles**: injected once via a `<style id="myio-customer-goals-card-css">` tag; class prefix `myio-cgc__`. CSS custom properties for theme tokens (`--cgc-surface`, `--cgc-border`, `--cgc-text`, `--cgc-muted`) so `setThemeMode` only swaps a `data-theme` attribute.
- **Deltas**: computed from the resolved totals; badge text `↑ 5,38%` / `↓ 1,71%` / `—`; colors `#22c55e` (down/good) and `#ef4444` (up/bad).

### Modal integration (MYIO-SIM v5.2.0_UNIQUE controller)

1. `EVO_MODES` gains `cards` (pill label: `Cards`), persisted like the others while the modal lives.
2. `loadEvo()` already produces, for the *sep* mode: `curBy: Map<ingestionId, buckets>`, `prevBy`, and per-shopping goal buckets. For `cards` mode the same structures are mapped into `CustomerGoalsSeries` per shopping (no extra fetching).
3. Grid container `[data-cards-grid]` lives next to `[data-evo-wrap]`; mode switch toggles `display` between them and calls `destroy()` on stale card instances (kept in a local array).
4. The shared legend row is emitted by the modal (single element under the grid), not by the cards.
5. **PDF export** in cards mode: v1 exports the same per-shopping table it already exports today and snapshots the grid via per-card `canvas.toDataURL` stitched vertically (2 per row). If stitching proves brittle, v1 falls back to table-only with a note — see Unresolved questions.

### Showcase (`showcase/main-unique-datasource`)

Add a "Customer Goals Cards" section to `showcase/main-unique-datasource/index.html`:

- loads the UMD build (`dist/myio-js-library.umd.js`) + Chart.js CDN;
- renders 4 mocked shoppings (mirroring the reference image values: Alpha/Bravo/Charlie/Delta, 12 monthly buckets, totals `1.486.520 / 1.512.300 / 1.505.000` etc.) in a responsive grid;
- theme toggle button switching all card instances light ↔ dark;
- one card with missing `budget` and one with `previousYear` gaps, to demo graceful degradation.

### Tests (`tests/components/cards/customer-goals/`)

Vitest + jsdom (Chart.js mocked as `window.Chart` stub):

1. renders title, totals strip (pt-BR formatting) and both delta badges;
2. delta math and badge direction/color (above budget → ↑ red; below → ↓ green; null reference → "—");
3. totals default to the sum of non-null series points; explicit `totals` override wins;
4. `update()` re-renders values without recreating the root element;
5. `setThemeMode('dark')` swaps the `data-theme` attribute;
6. `destroy()` removes the element and calls `chart.destroy()`;
7. missing `window.Chart` → placeholder rendered, no throw.

## Drawbacks
[drawbacks]: #drawbacks

- One Chart.js instance per card (6 on Sá Cavalcante, more for larger groups) — small but non-zero memory/CPU; mitigated by `animation: false` and destroying instances on mode switch.
- Per-card independent Y scales aid per-unit reading but **hinder absolute cross-shopping comparison** — that is what the existing *Empilhado*/*Por shopping* modes remain for.
- A fourth mode pill adds UI surface to an already dense modal header.

## Rationale and alternatives
[rationale-and-alternatives]: #rationale-and-alternatives

- **Small multiples as a dedicated component (chosen)** — reusable beyond the modal (dashboards, customer insight modal RFC-0212), testable in isolation, faithful to the approved visual.
- *Single canvas with Chart.js grid layout* — one chart faking a grid of subplots; rejected: axis/legend hacks, poor responsiveness, no per-card DOM (badges/strips are DOM, not chart).
- *Reusing `createCustomerCardV2`* — different information architecture (KPIs/status vs series+variance); forcing it would bloat both.
- *ECharts small-multiples* — not in the stack; Chart.js is already the host dependency.

## Prior art
[prior-art]: #prior-art

- `logs/025-card-GoalsByCustomer.png` — the visual spec (classic BI "per unit" panel).
- Goals × Consumption modal (this codebase): modes, per-shopping series and GCDR goal trees (RFC-0046) that feed the cards.
- `src/components/cards/customer/v2.0.0` (`createCustomerCardV2`) — card component conventions (params/instance, container-append, index re-exports).
- Energy-panel premium compact cards — hover/elevation language and TB CSS-override lessons (ID-scoped styles).
- RFC-0213 ConsumptionTrendPanel — goal overlay semantics on consumption series.

## Unresolved questions
[unresolved-questions]: #unresolved-questions

1. **PDF export in cards mode** — stitch per-card canvases into the PDF, or table-only for v1?
2. **Hourly granularity density** — up to 360 points (15 days × 24 h) per sparkline; decimate to ~48 points or keep raw?
3. Should the card expose a **maximize/click-through** (open the shopping's GoalsPanel) in v1, or leave `onClick` unused?
4. Color tokens: keep the reference palette (green/blue/amber) or derive from `EVO_COLORS[domain]` so water mode shifts to its own hues?

## Future possibilities
[future-possibilities]: #future-possibilities

- Reuse in **RFC-0212 Customer Insight Modal** (per-domain small multiples inside the customer drill-down).
- A `sortBy` option (worst *vs Orçado* first) turning the grid into a triage board.
- Sparkline-only variant (no strips) for the WelcomeModal shopping cards.
- Export the grid as an image (single composed canvas) for reports/e-mail.
