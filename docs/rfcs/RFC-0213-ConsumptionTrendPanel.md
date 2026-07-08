# RFC-0213 — ConsumptionTrendPanel (fork of Consumption7DaysChart) with unit-consistent axis, ideal-range fixes, and a daily goal overlay

- **RFC**: 0213
- **Title**: ConsumptionTrendPanel — a forked, renamed consumption chart that fixes the mixed-unit Y-axis and ideal-range clipping bugs, drops the "7Days" misnomer, and adds a per-day **goal overlay** (scalar line now; min–max band forward-looking) from the GCDR Goals JSON
- **Status**: Proposed (2026-06-25) — design only, not implemented. For discussion/validation.
- **Author**: Rodrigo Lago
- **Created**: 2026-06-25
- **Strategy**: **Fork, do not mutate.** The existing `Consumption7DaysChart` stays untouched (its consumers keep working). This RFC introduces a **new component, `ConsumptionTrendPanel`**, copied from it, where the bug fixes and the goal overlay land. New dashboards adopt the new component; migration of existing callers is a later, separate step.
- **Target (new files — fork)**:
  - `src/components/ConsumptionTrendPanel/types.ts` (copied; adds `goalSeries`/`goalLine`, `GoalPoint`)
  - `src/components/ConsumptionTrendPanel/createConsumptionTrendChart.ts` (copied from `createConsumption7DaysChart.ts`; bug fixes A+B + goal datasets + headroom)
  - `src/components/ConsumptionTrendPanel/createConsumptionTrendPanel.ts` (copied from `createConsumptionChartWidget.ts`; vizMode-aware footer stats)
  - `src/components/ConsumptionTrendPanel/index.ts` + `src/index.ts` export
  - `showcase/consumption-trend-panel/` (forked from `showcase/consumption-7days-chart/`) — the **validation surface**
- **Target (later, Phase 2 wiring)**:
  - `src/thingsboard/MYIO-SIM/v5.2.0/ENERGY/controller.js` (fetch goals JSON + align to labels in the data adapter; switch to the new component)
- **Untouched**:
  - `src/components/Consumption7DaysChart/**` — the source component remains as-is.
- **Related**:
  - RFC-0098 — `createConsumption7DaysChart` / `createConsumptionChartWidget` (the component this **forks**).
  - RFC-0046 — Goals GCDR (`/customers/:id/goals`); the daily-goals dataset the overlay consumes is the same shape served by the Goals API and the S3 export (`tree`).
  - `src/components/Consumption7DaysChart/createConsumption7DaysChart.ts:231` — `buildIdealRangeAnnotation()`, the **static box** "Faixa Ideal" (carried into the fork; the goal band is its time-varying generalization — see Motivation).
  - `gcdr.git/docs/examples/goals-2026-{Month,Day,Hour}-Energy-Moxuara.json` — the actual backend payloads. One `tree` with nested granularities: `tree.monthly["MM"].value`, `tree.daily["MM-DD"].value`, `tree.hourly["MM-DDTHH"].value` (plus `tree.annual.value`). The leaf field is **`value`** (scalar).

> **Note on file/line citations.** Code locations like `createConsumption7DaysChart.ts:231` refer
> to the **source** being forked. In the fork they become the corresponding lines of
> `createConsumptionTrendChart.ts`; the citations mark *what to change when copying*.

---

## Summary

The 7-day consumption chart (`createConsumption7DaysChart`, RFC-0098) can render a **static
"Faixa Ideal"** — a horizontal shaded box between a fixed `min` and `max` (Chart.js `box`
annotation, `buildIdealRangeAnnotation()`). That box is constant across all days.

This RFC adds a different, complementary capability: a **per-day goal overlay**. A goal for a
given day can take two forms, and the overlay supports both (and their combination):

- **Scalar goal** → a single target value per day, rendered as a smooth, thicker, orange
  **line** where each point is that day's goal.
- **Range goal** → a per-day `min`–`max` band, rendered as a translucent orange **area** whose
  upper and lower edges vary day by day (a *dynamic* band — not the constant box of "Faixa
  Ideal"), optionally with a center line when a `value` is also given.

The values come from a daily goals dataset (the GCDR Goals JSON, `data.tree.daily` keyed by
`"MM-DD"`), aligned to the chart's existing day labels. It is a **time series (or band)
overlaid on the consumption series**, not a static box.

> **Scope note (backend).** As of this RFC the GCDR backend emits only a **scalar `value`** per
> day (the `tree.{daily,hourly}[key].value` field) — it does **not** yet provide a per-day
> `min`/`max` range. The first iteration therefore implements only the **scalar line**. The data
> model below is designed to accept a range too (so no breaking change is needed later), but the
> **band rendering is forward-looking and dormant** until the backend supplies range goals (see
> Future possibilities). Everywhere this RFC describes a band, read it as "designed-for, not
> shipped".

The overlay is meaningful only in **consolidated** (`vizMode === 'total'`) view, because the
goal is an aggregate customer number with no per-store breakdown.

The RFC also specifies **configurable Y-axis headroom**: because a goal point — or the top of a
goal band — can sit well above the tallest consumption bar (e.g. consumption averaging 200 kWh
while the goal is 30–40 % higher), the Y-axis maximum must reserve extra space (default 15 %,
configurable) so the goal line/band never hugs the top edge.

### Why a fork (and not an edit)

Rather than mutate `Consumption7DaysChart` in place, this RFC **copies** it into a new
component, **`ConsumptionTrendPanel`**, and lands everything there:

1. **Rename** — drop the "7Days" misnomer (the period is already configurable; the chart is a
   *trend over a window*, not fixed to 7 days).
2. **Fix two real bugs** found in the source while reviewing the ideal-range feature
   (see "Bugs carried out of the source", below): a **mixed-unit Y-axis** and **ideal-range
   clipping**.
3. **Make footer indicators vizMode-aware** — today they always reflect the consolidated totals
   even in "Por Shopping" view.
4. **Add the goal overlay** — the headline feature (scalar line now, band later).

Existing consumers of `Consumption7DaysChart` are unaffected; new dashboards use the fork. The
**new showcase** (`showcase/consumption-trend-panel/`, derived from the existing one) is the
**validation surface** for all of the above before any production wiring.

---

## Motivation

- **The static box answers the wrong question.** "Faixa Ideal" shows a fixed acceptable band.
  Users want to see, *day by day*, how actual consumption tracks against that day's **goal**.
  A flat box cannot express a goal that varies daily.
- **The goal data already exists and is daily-granular.** The GCDR Goals API (RFC-0046) and
  its S3 export expose `tree.daily` as `{ "MM-DD": { value } }` — one goal value per calendar
  day. Today nothing on the consumption chart consumes it.
- **A goal is sometimes a value, sometimes a band.** Conceptually a target can be a single
  number ("hit ~270 kWh") or an acceptable range ("stay between 240 and 290 kWh") — and that
  range can differ per day. A scalar maps to a line; a per-day range maps to a band whose edges
  move day by day. The model must represent both, and their combination (band + center line).
- **It belongs as a dataset, not an annotation.** A varying series (or a varying band built
  from two edge series with fill-between) is naturally a set of Chart.js datasets, which also
  lets it overlay a **bar** base chart as a mixed chart, gets legend entries, and participates
  in tooltips — none of which a `box` annotation does. The static "Faixa Ideal" box is the
  degenerate (constant) case of a band; this overlay is the time-varying generalization.
- **Headroom is a real visual bug waiting to happen.** `calculateYAxisMax()` currently sizes
  the axis from the *displayed consumption values only*. If the goal exceeds the max bar, the
  goal line is clipped or glued to the top. The fix is small but must be explicit and
  configurable.

### Concrete example (the headroom case)

A consolidated bar shows ~200 kWh (the 7-day average, varying ±20 %). The goal for those days
averages 30–40 % higher (~260–280 kWh). Plotting the goal point at ~270 against a Y-axis whose
max was computed as ~220 (consumption + 10 % padding) would clip the goal line. With a
configurable headroom delta (default 15 %) applied **after** including the goal series in the
max computation, the axis comfortably clears the goal line.

---

## Bugs carried out of the source (fixed in the fork)

Reviewing the ideal-range ("Faixa Ideal") feature surfaced three defects in
`Consumption7DaysChart`. The fork fixes them; the source is left as-is.

> **Diagnostic first:** the ideal-range box is **positioned correctly**. Chart.js annotations use
> **data-space** coordinates and the scale domain stays in **kWh** — `formatTickValue` only
> *relabels* ticks. So `yMin/yMax` in kWh land in the right place. The confusion users report
> comes from the two bugs below, not from the box geometry.

### 🔴 Bug A — the Y-axis mixes kWh and MWh on the same axis

`formatTickValue` (`createConsumption7DaysChart.ts:298`) switches unit **per tick value**:

```js
function formatTickValue(value) {
  if (config.unitLarge && config.thresholdForLargeUnit && value >= config.thresholdForLargeUnit) {
    return `${(value / config.thresholdForLargeUnit).toFixed(1)}`; // 1200 -> "1.2"  (MWh)
  }
  return value.toFixed(0);                                          // 600  -> "600"  (kWh)
}
```

…while the axis **title** (`:401`) becomes `unitLarge` ("MWh") whenever `yAxisMax >= threshold`.
Result: an axis titled "MWh" whose ticks read `600`, `800`, `1.0`, `1.2` — a per-tick unit
switch. The ideal-range band sitting at 600 kWh looks misaligned against a "MWh" axis. The band
is fine; the **axis labeling** is inconsistent.

**Fix:** pick one unit/divisor for the **whole axis** (from `yAxisMax`) and format every tick
with it:

```js
const useLarge = !!(config.unitLarge && config.thresholdForLargeUnit && yAxisMax >= config.thresholdForLargeUnit);
const axisDivisor = useLarge ? config.thresholdForLargeUnit : 1;
const axisUnit    = useLarge ? config.unitLarge : config.unit;
// tick callback: (value / axisDivisor).toFixed(useLarge ? 2 : 0)   → all ticks in axisUnit
```

### 🔴 Bug B — the ideal-range box can exceed the axis top and be clipped

`calculateYAxisMax` (`:95`) folds `idealRange` into the max **only in the temperature branch**
(`:107-108`). For energy/water/gas it ignores `currentIdealRange`. So when the user sets an
ideal-range **max above the tallest consumption value**, the box top is clipped off-canvas.

**Fix (mirror the temperature branch):**

```js
const idealMax = currentIdealRange?.enabled !== false ? (currentIdealRange?.max ?? 0) : 0;
const maxValue = Math.max(...values, idealMax, 0);
```

> This is the **same root cause** as the goal-line headroom (§Reference 2b); the fork solves both
> with one axis-max policy: include every overlay's top (`idealRange.max`, goal `value`/band
> `max`), then apply the configurable headroom.

### 🟡 Inconsistency — footer indicators don't change between Consolidado and Agrupado

`setVizMode` in the widget (`createConsumptionChartWidget.ts:1905`) swaps the mode but **never
calls `updateFooterStats`**, and `updateFooterStats` (`:1222`) always reads `data.dailyTotals`
(the **consolidated** totals). So in "Por Shopping" the Total/Average/Peak stay identical to the
consolidated view — wrong for a per-group view.

**Fix:** (a) call `updateFooterStats` from `setVizMode`; (b) branch `updateFooterStats` by
`currentVizMode` — in `separate`, compute from `shoppingData` with an explicit semantic
(per-group average? sum across groups per day? peak of which series?). **This requires a product
decision** on what each indicator means in grouped mode (see Unresolved questions).

---

## Guide-level explanation

### What the user sees

In **Consolidado** view, when a daily goals dataset is available, the chart draws an extra goal
overlay tracking each day's goal:

- If the goals are **scalar**, a single **smooth orange line** (thicker than the consumption
  line).
- If the goals are **ranges**, a **translucent orange band** between the per-day `min` and
  `max` edges (the band's top and bottom move from day to day), optionally with a center line
  when a `value` is also present.

In **Linhas** mode the overlay reads as a second line/band; in **Barras** mode it reads as a
line/band drawn over the bars (mixed chart). Switching to **Por Shopping** hides the overlay (a
consolidated goal has no per-store meaning).

The consumption series, footer stats (total / average / peak), CSV export, and the existing
static "Faixa Ideal" box are all unchanged. The goal overlay is purely additive.

### How a caller turns it on

The caller supplies the goal values aligned to the chart's day labels. Two equivalent paths:

1. **Data-driven (recommended).** The `fetchData` adapter attaches a `goalSeries` array to the
   returned `ConsumptionTrendData` (the fork's copy of `Consumption7DaysData`), aligned
   position-by-position with `labels`. Missing days are `null`.
2. **Config-driven appearance.** An optional `goalLine` config block customizes color, label,
   width, smoothing, and the Y-axis headroom delta. All have defaults; omitting it yields an
   orange 3px smooth line with 15 % headroom.

```ts
// In the data adapter (SIM ENERGY controller)
// Today the backend gives a scalar `value` per day, so goalSeries is number|null:
return {
  labels,                 // ["25/06", "26/06", ...]  (pt-BR DD/MM)
  dailyTotals,            // consumption per day
  shoppingData,
  shoppingNames,
  goalSeries: await fetchEnergyGoalSeries(labels), // [262.1, null, 280.4, ...] aligned to labels
};

// Later, if/when the backend emits ranges, the SAME field accepts band points
// (no breaking change to the component contract):
//   goalSeries: [{ value: 270, min: 240, max: 290 }, null, { min: 250, max: 300 }, ...]

// In the widget config (appearance only; all optional)
goalLine: {
  enabled: true,
  color: '#f97316',       // orange
  label: 'Meta',
  borderWidth: 3,         // thicker than the consumption line
  tension: 0.4,           // smooth, matches the consumption line
  yAxisHeadroomPct: 0.15, // 15% extra top space when the goal exceeds consumption
}
```

### Label ↔ goal-key mapping (by granularity)

The Goals payload carries every granularity in one `tree`; the overlay selects the sub-tree
that matches the chart's current granularity and keys into it with that granularity's format:

| Chart granularity | Sub-tree      | Key format   | Example key   |
|-------------------|---------------|--------------|---------------|
| Daily (1d)        | `tree.daily`  | `"MM-DD"`    | `"06-25"`     |
| Hourly (1h)       | `tree.hourly` | `"MM-DDTHH"` | `"06-25T14"`  |
| Monthly (future)  | `tree.monthly`| `"MM"`       | `"06"`        |

Daily chart labels are pt-BR `DD/MM` (`controller.js:1653`,
`toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })`), so the daily map is
`"DD/MM"` → `"MM-DD"`. Because hourly labels and the year are not recoverable from a `DD/MM`
string, the **robust** key is derived from the day's real `Date` (already available in
`dayBoundaries`, `controller.js:1643`), not from the formatted label — this also fixes the
year-boundary problem (Unresolved questions #1):

```js
const pad = (n) => String(n).padStart(2, '0');

// granularity: '1d' | '1h'  ;  d: the Date for this x position
function goalKeyFor(d, granularity) {
  const mmdd = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return granularity === '1h' ? `${mmdd}T${pad(d.getHours())}` : mmdd;
}

function goalSubtree(tree, granularity) {
  return (granularity === '1h' ? tree?.hourly : tree?.daily) ?? {};
}
```

---

## Reference-level explanation

### 0. The fork & naming map

Copy the `Consumption7DaysChart/` folder to `ConsumptionTrendPanel/` and rename the public
surface. Shapes are identical to the source; only names change.

| Source (`Consumption7DaysChart`)     | Fork (`ConsumptionTrendPanel`)        |
|--------------------------------------|---------------------------------------|
| `createConsumption7DaysChart`        | `createConsumptionTrendChart`         |
| `createConsumptionChartWidget`       | `createConsumptionTrendPanel`        |
| `Consumption7DaysConfig`             | `ConsumptionTrendConfig`              |
| `Consumption7DaysData`               | `ConsumptionTrendData`                |
| `Consumption7DaysInstance`           | `ConsumptionTrendInstance`            |
| `ConsumptionWidgetConfig/Instance`   | `ConsumptionTrendPanelConfig/Instance` |
| folder `src/components/Consumption7DaysChart/` | `src/components/ConsumptionTrendPanel/` |

Internal helper names (`buildChartConfig`, `calculateYAxisMax`, `buildIdealRangeAnnotation`,
`updateFooterStats`, etc.) stay the same. The fork is additive in `src/index.ts` (both
components export until the source is later deprecated). The line citations below refer to the
**source** file; apply them to the copied file.

### 1. Types (`types.ts` → fork)

Extend the data contract and add an appearance/behavior block. (Type names per the map above;
the snippet keeps the source name in comments for traceability.)

```ts
/**
 * A single day's goal. Today the GCDR backend emits only a scalar target, so in practice
 * this is a `number`. The object form is accepted now (without a backend change) so a future
 * per-day range needs no contract change:
 *   - `number`                      → scalar target (line)
 *   - `{ value }`                   → scalar target (line)        [equivalent to number]
 *   - `{ min, max }`                → per-day band (area)         [forward-looking]
 *   - `{ value, min, max }`         → band + center line          [forward-looking]
 */
export type GoalPoint =
  | number
  | { value?: number | null; min?: number | null; max?: number | null };

export interface ConsumptionTrendData /* was Consumption7DaysData */ {
  // ...existing fields...
  /**
   * Optional per-day goals, aligned position-by-position with `labels`.
   * `null` marks a day with no goal (rendered as a gap via spanGaps).
   * Only consumed in `vizMode === 'total'`.
   * Scalar today; band-capable by type (see GoalPoint).
   */
  goalSeries?: (GoalPoint | null)[];
}

export interface GoalLineConfig {
  /** Master switch. Default: true when `goalSeries` is present and non-empty. */
  enabled?: boolean;
  /** Line color (and band edge/fill base). Default: '#f97316' (orange). */
  color?: string;
  /** Legend/tooltip label. Default: `Meta (${unit})`. */
  label?: string;
  /** Center/scalar line width in px (thicker than consumption). Default: 3. */
  borderWidth?: number;
  /** Smoothing tension 0–1. Default: 0.4 (matches consumption line). */
  tension?: number;
  /**
   * Extra fraction of headroom added to the Y-axis max when the goal (line value
   * or band top) exceeds the displayed consumption values. Default: 0.15 (15%).
   */
  yAxisHeadroomPct?: number;
  /**
   * Band fill color when goals are ranges (forward-looking; unused while the
   * backend emits scalars only). Default: derived from `color` at ~0.15 alpha.
   */
  bandColor?: string;
}

export interface ConsumptionTrendConfig /* was Consumption7DaysConfig */ {
  // ...existing fields...
  /** Goal overlay configuration (appearance + Y-axis headroom). */
  goalLine?: GoalLineConfig;
}
```

`DEFAULT_CONFIG` gains `goalLineHeadroomPct: 0.15` (referenced by `calculateYAxisMax`).

### 2. Render (`createConsumptionTrendChart.ts` → `buildChartConfig`)

**2a. Normalize each `GoalPoint`** into three aligned arrays — only in `total` mode and only
when goals exist. This single normalization step is what lets the same code path serve scalars
today and bands later.

```js
// number | {value,min,max} | null  →  {value, min, max} with null for absent fields
function normGoalPoint(p) {
  if (p == null) return { value: null, min: null, max: null };
  if (typeof p === 'number') return { value: p, min: null, max: null };
  const n = (x) => (Number.isFinite(x) ? x : null);
  return { value: n(p.value), min: n(p.min), max: n(p.max) };
}

const goalCfg = config.goalLine ?? {};
const goalActive = (goalCfg.enabled ?? true)
  && currentVizMode === 'total'
  && Array.isArray(data.goalSeries)
  && data.goalSeries.some((p) => p != null);

if (goalActive) {
  const pts     = data.goalSeries.map(normGoalPoint);
  const center  = pts.map((p) => p.value);             // scalar line (shipped path)
  const lo      = pts.map((p) => p.min);               // band bottom (dormant)
  const hi      = pts.map((p) => p.max);               // band top    (dormant)
  const hasBand = lo.some((v) => v != null) && hi.some((v) => v != null);
  const color   = goalCfg.color ?? '#f97316';

  // --- Band (forward-looking; only when min/max present) ---
  // Two line datasets; the top fills down to the bottom → a per-day shaded area.
  if (hasBand) {
    const bandColor = goalCfg.bandColor ?? 'rgba(249, 115, 22, 0.15)';
    datasets.push({
      label: `${goalCfg.label ?? 'Meta'} (mín)`,
      data: lo, type: 'line', borderColor: color, borderWidth: 1,
      borderDash: [4, 4], pointRadius: 0, fill: false, spanGaps: true, order: 2,
    });
    datasets.push({
      label: `${goalCfg.label ?? 'Meta'} (máx)`,
      data: hi, type: 'line', borderColor: color, borderWidth: 1, borderDash: [4, 4],
      pointRadius: 0, spanGaps: true, order: 2,
      fill: '-1',                              // fill down to the previous (min) dataset
      backgroundColor: bandColor,
    });
  }

  // --- Scalar / center line (shipped path; present whenever any `value` exists) ---
  if (center.some((v) => v != null)) {
    datasets.push({
      label: goalCfg.label ?? `Meta (${config.unit})`,
      data: center,
      type: 'line',                 // mixed chart: stays a line even if base type is 'bar'
      borderColor: color,
      backgroundColor: 'transparent',
      borderWidth: goalCfg.borderWidth ?? 3,
      tension: goalCfg.tension ?? DEFAULT_CONFIG.lineTension,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
      spanGaps: true,               // skip null days
      order: 0,                      // draw on top (lower order = front)
    });
  }
}
```

> `type: 'line'` on the dataset is what makes the overlay render as a line over a **bar** base
> chart. The band uses Chart.js `fill: '-1'` (fill to the previous dataset) to shade between the
> two edge series — no plugin needed. `chartjs-plugin-annotation` is required only for the
> static box.
>
> **What ships now:** with the current backend (`number` per day), only the scalar/center line
> branch executes; `hasBand` is always false. The band branch is inert until range goals arrive.

**2b. Y-axis headroom** — fold the goal series into the max computation.

`getDisplayedValues(data)` (`:313`) returns the consumption values used to size the axis. The
**top of the goal** (a scalar `value`, or a band's `max`) must be considered too, then the
configurable headroom applied. A small helper extracts the goal's per-day upper value:

```js
// Highest relevant goal value for a day: prefer band max, else scalar value.
function goalTop(p) {
  if (p == null) return null;
  if (typeof p === 'number') return p;
  return p.max ?? p.value ?? null;
}
```

Two coordinated changes:

```js
// getDisplayedValues: when the goal overlay will be shown, include its per-day tops
function getDisplayedValues(data) {
  const base = /* existing consumption selection */;
  if (currentVizMode === 'total' && Array.isArray(data.goalSeries)) {
    return base.concat(data.goalSeries.map(goalTop).filter((v) => v != null));
  }
  return base;
}
```

```js
// calculateYAxisMax: after the existing rounded max, reserve goal headroom.
// Only widen when the goal actually drives the max (avoid shrinking the normal case).
const headroomPct = config.goalLine?.yAxisHeadroomPct
  ?? DEFAULT_CONFIG.goalLineHeadroomPct; // 0.15
const goalMax = currentVizMode === 'total'
  ? Math.max(0, ...(data.goalSeries?.map(goalTop).filter((v) => v != null) ?? []))
  : 0;
if (goalMax > 0 && goalMax >= maxConsumptionValue) {
  roundedMax = Math.max(roundedMax, Math.ceil(goalMax * (1 + headroomPct) / roundTo) * roundTo);
}
```

> The headroom is applied **only when the goal top is at least the tallest consumption value**,
> so the common case (goal below consumption) keeps today's tight 10 % padding and the axis does
> not grow needlessly. `calculateYAxisMax` must receive `data` (or the goal max) to do this; the
> current signature takes `values: number[]` and is called with `getDisplayedValues(data)`, so
> either pass `data` through or precompute `goalMax` at the call site (`:332`).
>
> **Fold in Bug B here:** the same max policy must also include `currentIdealRange.max`
> (see "Bugs carried out of the source" → Bug B), so the ideal-range box and the goal overlay
> share one headroom-aware axis-max computation.

**2c. Legend.** The base chart shows no legend in `total` mode today
(`display: showLegend || currentVizMode === 'separate'`, `:418`). When the goal overlay is
active it is worth showing the legend so the series are labeled. Either force the legend on when
`goalActive`, or rely on tooltips. Recommended: show legend when `goalActive`.

**2d. Axis unit consistency (Bug A).** Replace the per-tick `formatTickValue` switch with one
axis-wide divisor/unit derived from `yAxisMax` (snippet in "Bugs carried out of the source" →
Bug A). The Y-axis title and every tick then read in the same unit, so the ideal-range box and
goal overlay no longer appear to disagree with the labels.

**2e. Footer indicators by vizMode (the inconsistency).** In the **widget** fork
(`createConsumptionTrendPanel.ts`), call `updateFooterStats` from `setVizMode` and branch the
stat math on `currentVizMode` (consolidated → `dailyTotals`; separate → derived from
`shoppingData` per the product-decided semantic). See Unresolved questions.

### 3. Data adapter (`SIM v5.2.0/ENERGY/controller.js`) — Phase 2

Fetch the Goals JSON (hard-coded URL/customer for the first iteration), map to `goalSeries`
aligned to the labels, and attach it in `fetchConsumptionDataAdapter` (`:1353`).

The adapter already builds `dayBoundaries` (`controller.js:1643`) — an array of
`{ label, startTs, endTs }` per x position. Key into the goal sub-tree by each position's real
`Date`, not by the formatted label, so hourly and year-boundary cases are correct.

```js
const ENERGY_GOALS_URL = '<S3 presigned URL — energy goals, customer X, year 2026>';

// `dates` = one Date per x position (from dayBoundaries); `granularity` = '1d' | '1h'
async function fetchEnergyGoalSeries(dates, granularity) {
  if (!dates?.length) return null;
  let tree = {};
  try {
    const res = await fetch(ENERGY_GOALS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tree = (await res.json())?.data?.tree ?? {};
  } catch (e) {
    LogHelper.warn('[ENERGY] goal series unavailable — goal overlay skipped', e);
    return null; // degrade gracefully: no overlay
  }
  const sub = goalSubtree(tree, granularity);                // tree.daily | tree.hourly
  return dates.map((d) => {
    const v = sub[goalKeyFor(d, granularity)]?.value;        // backend field is `value`
    return Number.isFinite(v) ? v : null;                    // number = scalar GoalPoint
  });
}
```

```js
// inside fetchConsumptionDataAdapter, in the returned object:
goalSeries: await fetchEnergyGoalSeries(
  dayBoundaries.map((b) => new Date(b.startTs)),
  chartConfig.granularity || '1d',
),
```

And in `initializeCharts` (`:1411`), pass the appearance block:

```js
goalLine: { enabled: true, color: '#f97316', label: 'Meta', borderWidth: 3, yAxisHeadroomPct: 0.15 },
```

### 4. Settings UI (optional, `createConsumptionTrendPanel.ts`)

Out of scope for the first iteration, but the existing **"🎯 Faixa Ideal"** section
(`:1008`) is the natural home for a later "Mostrar linha de meta" toggle and a headroom input.
The first iteration ships the line on by default whenever `goalSeries` is present.

### 5. Showcase (validation surface) — `showcase/consumption-trend-panel/`

Fork `showcase/consumption-7days-chart/` (currently `index.html` + start/stop server scripts).
The new showcase is a **from-scratch Chart.js prototype** (it does not yet depend on the library
component — it is the validation surface for this RFC's rendering) and demonstrates, with mock
data (no live TB), the cases that exercise the fixes and the feature.

**Mock data (`data/`)** — fixtures served statically; the panel `fetch`es them like a real API:
- `goals-2026-{Month,Day,Hour}-Energy-Moxuara.json` — the actual GCDR goal exports (one `tree`
  per granularity, leaf `value`). Drive the goal line/region.
- `consumption-2026-Hour-Energy-Moxuara.json` — **mock "real" telemetry** for Shopping Moxuara,
  hourly from 2026-06-20 → now, shaped by a mall load profile at ~74–88 % of the daily goal
  (so the goal sits above → headroom is exercised). Same `tree` shape (`daily`+`hourly`), so the
  panel reads it exactly like the goals. The cockpit "Fonte de consumo" toggles file vs
  synthesized-from-goal. Bars render this; days/hours not yet measured are gaps (null).

Cases:

1. **Unit-consistent axis (Bug A)** — a dataset large enough to push the axis into MWh; verify
   every tick and the title share one unit.
2. **Ideal-range no longer clipped (Bug B)** — set an ideal-range `max` above the data max;
   verify the box top is visible (axis grew).
3. **Goal line (scalar)** — supply a `goalSeries` of numbers; verify the orange smooth line and
   the 15 % headroom when the goal exceeds consumption (the ~200 kWh vs ~270 goal case).
4. **vizMode-aware footer** — toggle Consolidado/Por Shopping; verify Total/Média/Pico change.
5. **Goal band (dormant)** — a toggle feeding `{min,max}` goal points to preview the future band
   rendering, clearly labeled "forward-looking (backend not emitting ranges yet)".
6. **Granularity** — daily vs hourly goal keys (`MM-DD` / `MM-DDTHH`) against mock trees.

Mirror the existing showcase's static-server scripts (`start-server.*` / `stop-server.*`) so the
run/stop UX is identical.

### Data flow

```
S3/GCDR Goals JSON (one tree: monthly | daily | hourly, leaf field `value`)
      │  fetchEnergyGoalSeries(dates, granularity):
      │    sub = tree[daily|hourly]; key = Date → "MM-DD" | "MM-DDTHH"; value|null
      ▼
fetchConsumptionDataAdapter → ConsumptionTrendData.goalSeries  (aligned to labels)
      │
      ▼
buildChartConfig (vizMode==='total' && goals present)
      ├─ normalize GoalPoint → {value, min, max}
      ├─ scalar/center line: datasets.push({ type:'line', orange, thicker, smooth, spanGaps })
      ├─ band (dormant): min+max edge datasets, top fill:'-1' → shaded area
      └─ calculateYAxisMax: include goal top (value|max) + headroom (default 15%)
      ▼
Chart.js mixed chart: consumption (line|bar) + goal line [+ band, future]
```

---

## Phased plan

**Phase 1 — Fork + fixes + showcase (this RFC's validation goal; no production wiring).**
1. Copy `Consumption7DaysChart/` → `ConsumptionTrendPanel/`; apply the naming map (§Reference 0).
2. Fix **Bug A** (axis unit consistency, §2d) and **Bug B** (ideal-range in `calculateYAxisMax`,
   §2b fold-in).
3. Make footer indicators **vizMode-aware** (§2e) — pending the semantic decision; until decided,
   ship the `setVizMode → updateFooterStats` call with the consolidated math and a TODO.
4. Add the **goal datasets** (scalar line live; band dormant) and **headroom** to `buildChartConfig`
   (§2a–2b). With no `goalSeries` supplied, the chart behaves exactly like the source.
5. Export from `src/index.ts`; build a **forked showcase** (§5) exercising all of the above with
   mock data. **This is the validation deliverable.**

**Phase 2 — Wire real goals (separate change).**
6. In the SIM ENERGY controller, implement `fetchEnergyGoalSeries` (§3), attach `goalSeries`, and
   switch the energy chart to `createConsumptionTrendPanel`. Decide goal source (S3 vs Goals
   API, Unresolved #1).

**Phase 3 — Future (own RFCs/issues).**
7. Range/band goals when the backend emits `min`/`max`; settings-UI toggles; other domains;
   migrate remaining `Consumption7DaysChart` callers and deprecate the source.

---

## Drawbacks

- **Code duplication (the fork).** `ConsumptionTrendPanel` starts as a near-copy of
  `Consumption7DaysChart`; two components now carry similar logic until the source is deprecated
  and callers migrate (Phase 3). Accepted deliberately to avoid risking the source's existing
  consumers while validating the fixes + feature on a fresh surface.
- **Coupling to a JSON shape.** The adapter hard-codes the `data.tree.{daily,hourly}[key].value`
  path and the granularity key formats. If the Goals export shape changes, the adapter breaks
  (degrades to "no overlay", not a crash).
- **Year scope.** The payload is per-year (`data.year`, `tree` keyed only `MM-DD` / `MM-DDTHH`).
  Keying off each position's real `Date` (not the `DD/MM` label) makes within-year mapping
  correct; a window straddling a year boundary would still need the matching year's payload (or
  two fetches). Out of scope for the 7-day default window, noted for hourly/long ranges.
- **CORS.** A browser `fetch` of the S3 presigned URL requires the bucket to allow the
  dashboard origin. On CORS failure the overlay silently disappears.
- **Hard-coded customer/URL (first iteration).** Not multi-customer yet; intentional scope cut.
- **Axis growth.** Headroom enlarges the Y-axis when the goal dominates, which slightly
  compresses the consumption bars. This is the intended trade-off for not clipping the goal.

## Rationale and alternatives

- **Fork vs. edit in place.** Editing `Consumption7DaysChart` directly would change behavior for
  all current consumers at once (axis relabeling, axis growth, footer math, new datasets) — risky
  for a shared production component. A fork isolates the changes, gives a clean rename (dropping
  "7Days"), and provides a dedicated showcase to validate before any caller migrates. Cost is
  temporary duplication (Drawbacks).
- **New name `ConsumptionTrendPanel`.** "7Days" is a misnomer (period is configurable). "Trend"
  captures *consumption over a window* and accommodates the overlays (ideal-range band + goal),
  without baking a fixed period or a single domain into the name.
- **Second dataset vs. extending the box annotation.** The box (`type: 'box'`) is fundamentally
  static (one `yMin`/`yMax`). A per-day value cannot be expressed as a box without one box per
  day. A dataset is the idiomatic Chart.js primitive for a varying series and composes with bar
  charts via mixed types.
- **`goalSeries` on the data vs. a separate `fetchGoals` callback.** Putting goals on
  `ConsumptionTrendData` keeps the component's contract data-in/render-out (the component never
  fetches), consistent with how `fetchData` already supplies everything. A callback would split
  the data source in two and complicate caching (`fetchTimestamp`).
- **Headroom as a post-step vs. always padding more.** Always adding 15 % would waste vertical
  space in the common case (goal below consumption). Applying headroom only when the goal drives
  the max keeps today's tight axis for normal data.
- **Orange thick line.** Chosen for contrast against the domain colors (energy blue `#2563eb`,
  water `#0288d1`) and to read as "target", not "another series of the same kind".

## Prior art

- The temperature domain already overlays **reference lines** and an **ideal-range box**
  (`buildTemperatureAnnotations()`, `:164`) — precedent for non-consumption overlays, but those
  are static annotations, not per-day series.
- Mixed bar+line charts (a line dataset with `type: 'line'` over a bar base) are a standard
  Chart.js pattern for "actual vs. target".
- RFC-0046 already surfaces this same `tree` (monthly/daily/hourly) goals data inside the Goals
  panel; this RFC reuses the dataset in a second surface.

## Unresolved questions

1. **Goal source.** Fetch the static S3 export (hard-coded, this RFC) or call the GCDR Goals API
   (`/customers/:id/goals`, RFC-0046) directly? The API is the durable answer; S3 is the quick
   first iteration. Either way the payload shape (`data.tree.{daily,hourly}`) is identical.
2. **Hourly window.** The settings modal forces hourly granularity for short windows (≤48 h,
   `controller.js:1529`). The overlay already handles `tree.hourly`; confirm the chart's current
   granularity is reliably readable by the adapter (`chartConfig.granularity`) at fetch time.
3. **Per-shopping goals.** Out of scope here (consolidated only). Is there a future need for a
   goal line per store in `separate` mode? Would require per-store goals in the payload.
4. **Settings exposure.** Should the headroom delta and "show goal overlay" be user-editable in
   the settings modal, or stay caller-config? First iteration: caller-config only.
5. **Other domains.** Water/gas have the same Goals shape (`domain` in the payload). Should the
   adapter be generalized to any domain now, or stay energy-only until requested?
6. **Range goals (band).** Not produced by the backend today (scalar `value` only). When/if the
   backend adds per-day `min`/`max`, the band rendering (already designed in §2a) activates with
   no component contract change. What backend field names would carry the range?
7. **Footer indicators in grouped (separate) mode — product decision.** What should Total / Média
   / Pico mean when the chart shows per-shopping series? Options: (a) keep consolidated totals
   (today's behavior, but now recomputed on toggle); (b) **Média** = average across groups per
   day; (c) **Pico** = peak of the consolidated total vs. peak of any single group; (d) show
   per-group breakdown. The fork wires `setVizMode → updateFooterStats` regardless; the **math**
   needs this answer before Phase 1 closes (until then it ships consolidated math + a TODO).

## Future possibilities

- **Goal API integration** replacing the hard-coded S3 URL (per-customer, per-domain, per-year).
- **Settings UI**: a "Mostrar linha de meta" toggle and headroom input in the "🎯 Faixa Ideal"
  section, plus a CSV column for the goal in `generateCSVContent`.
- **Range goals / band**: when the backend emits per-day `min`/`max`, render the dynamic band
  (translucent area) designed in §2a — the data model (`GoalPoint`) and render path already
  accept it without a contract change.
- **Monthly granularity**: the payload already carries `tree.monthly["MM"]`; a monthly view of
  the chart could overlay monthly goals with the same machinery.
- **Variance shading**: fill the area between consumption and goal (green under-goal / red
  over-goal) for an at-a-glance budget read.
- **Footer stat**: "Aderência à meta" (sum of consumption vs. sum of goal over the window).
- **Generalize to water/gas/temperature** by deriving unit/keys from the domain descriptor.
