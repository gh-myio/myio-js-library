- Feature Name: `extract-libs-from-water-widget`
- Start Date: 2025-08-27
- RFC PR: [myio-js-library#0000](https://github.com/gh-myio/myio-js-library/pull/0000)
- Tracking Issue: [myio-js-library#0000](https://github.com/gh-myio/myio-js-library/issues/0000)

# Summary

Extract reusable, framework-agnostic utilities from the Water Dashboard widget into the shared NPM package `myio-js-library`, reducing duplication across widgets and standardizing behavior for dates, numeric formatting, CSV generation, classification, and simple analytics. The widget will import these utilities and drop its local copies, keeping UI/ThingsBoard specifics in-place.

# Motivation

Multiple widgets (including the Water widget) duplicate helpers for:

- **Date handling**: YMD formatting, fixed-offset ISO, input parsing, time windows, daily aggregation
- **Numeric formatting**: pt-BR number formatting, water volume, tank head, percentage deltas  
- **CSV generation**: building content vs. triggering downloads
- **Label classification**: domain-aware grouping
- **Data access helpers**: ThingsBoard datakey extraction

This duplication increases maintenance costs, causes behavioral drift, and bloats bundle size. Centralizing these helpers:

- Establishes a single source of truth
- Reduces bundle size in widgets
- Improves testability (unit tests live with the utilities)
- Simplifies future i18n and configurability

**Non-goals**: extracting UI (DOM/jQuery/Chart.js) or ThingsBoard service plumbing.

# Guide-level explanation

We will:

1. Add new modules to `myio-js-library` (TypeScript, no runtime deps)
2. Publish a minor version (e.g., 0.2.0)
3. Refactor the Water widget to import these utilities
4. Remove the duplicated local helpers from the widget

## Intended usage (in a widget)

```javascript
import {
  // dates
  formatDateToYMD,
  getSaoPauloISOString,
  formatDateForInput,
  parseInputDateToDate,
  timeWindowFromInputYMD,
  averageByDay,

  // numbers
  formatNumberReadable,
  formatWaterVolumeM3,
  formatTankHeadFromCm,
  calcDeltaPercent,

  // csv
  toCSV,
  buildWaterReportCSV,
  buildWaterStoresCSV,

  // classify
  classifyWaterLabel,

  // tb helpers (already in lib)
  getValueByDatakey,
  getValueByDatakeyLegacy
} from 'myio-js-library';

// Example: compute time window from two <input type="date"> values
const { startTs, endTs } = timeWindowFromInputYMD('2025-08-01','2025-08-26','-03:00');

// Example: format water series and tank head
formatWaterVolumeM3(12.345);      // "12,35 m³"
formatTankHeadFromCm(178);        // "1,78 m.c.a."

// Example: delta %
const { value, type } = calcDeltaPercent(120, 135); // { value: 12.5, type: "increase" }

// Example: CSV (string only; widget triggers download)
const csv = buildWaterStoresCSV(rows, { issueDate: '26/08/2025 - 23:19', total });
triggerDownload(csv, 'relatorio_consumo_geral_2025-08-26.csv');
```

**What stays in the widget**: DOM creation, jQuery handlers, Chart.js, ThingsBoard $injector, routing, and API calls.

# Reference-level explanation

## Package surface

New modules in `myio-js-library`:

```
src/
  date/
    averageByDay.ts
    fixedOffsetIso.ts            // toFixedOffsetISOString
    inputDate.ts                 // formatDateForInput, parseInputDateToDate
    timeWindowFromInput.ts       // timeWindowFromInputYMD
  number/
    water.ts                     // formatWaterVolumeM3, formatTankHeadFromCm, calcDeltaPercent
  csv/
    toCSV.ts
    waterReports.ts              // buildWaterReportCSV, buildWaterStoresCSV
  classify/
    waterLabel.ts                // classifyWaterLabel
  // (existing files reused)
  date/formatDateToYMD.ts
  date/interval.ts               // determineInterval
  date/saoPauloISOString.ts
  date/dateRange.ts
  number/numbers.ts              // formatNumberReadable
  utils/getValueByDatakey.ts
  index.ts
```

## TypeScript API

```typescript
// date/fixedOffsetIso.ts
export function toFixedOffsetISOString(date: Date, offset: string): string; // e.g. "-03:00"

// date/inputDate.ts
export function formatDateForInput(date: Date): string;          // 'yyyy-MM-dd'
export function parseInputDateToDate(input: string): Date;       // 00:00 local

// date/timeWindowFromInput.ts
export function timeWindowFromInputYMD(
  startYmd: string, endYmd: string, tzOffset?: string
): { startTs: number; endTs: number };

// date/averageByDay.ts
export type TimedValue = { ts: number|Date; value: number };
export function averageByDay<T extends TimedValue>(
  rows: T[]
): Array<{ day: string /* 'YYYY-MM-DD' */, average: number }>;

// number/water.ts
export function formatWaterVolumeM3(value: number, locale?: string): string;    // "x,xx m³"
export function formatTankHeadFromCm(valueCm: number, locale?: string): string; // "x,xx m.c.a."
export function calcDeltaPercent(
  prev: number, current: number
): { value: number; type: "increase"|"decrease"|"neutral" };

// csv/toCSV.ts
export function toCSV(rows: (string|number)[][], delimiter?: string): string;

// csv/waterReports.ts
export type WaterRow = {
  formattedDate: string;
  day: string;
  avgConsumption: number|string;
  minDemand: number|string;
  maxDemand: number|string;
  totalConsumption: number|string;
};
export function buildWaterReportCSV(
  rows: WaterRow[],
  meta: { issueDate: string; name?: string; identifier?: string; total?: number }
): string;

export type StoreRow = {
  entityLabel?: string; deviceName?: string; deviceId?: string;
  consumptionM3?: number; // NOTE: prefer M3; alias consumptionKwh deprecated
};
export function buildWaterStoresCSV(
  rows: StoreRow[],
  meta: { issueDate: string; total?: number }
): string;

// classify/waterLabel.ts
export function classifyWaterLabel(
  label: string
): "Caixas D'Água" | "Lojas" | "Área Comum";
```

## Design notes

- **CSV**: Library only returns string content. Widgets handle download (DOM).
- **Units**: We split former `formatEnergy` into water-specific helpers:
  - `formatWaterVolumeM3` for m³ values
  - `formatTankHeadFromCm` for tank head (centimeters → meters of water column, m.c.a.)
- **Percent deltas** centralize the "increase/decrease/neutral" logic.
- **Dates** include fixed-offset ISO to standardize -03:00 strings and helpers for input date fields.
- **Classification** uses explicit water domain categories; regexes can be externalized later.

## Backwards compatibility

`consumptionKwh` naming in the widget refers to water. We recommend `consumptionM3`:

- Provide a temporary alias in CSV builders: accept both keys, prefer `consumptionM3`
- Deprecation notice in README; removal in 0.4.0
- `formatAllInSameUnit` previously returned "M³" regardless of divisor; the new `formatWaterVolumeM3` keeps a fixed unit (no misleading scaling). If scaling is needed later (e.g., kL), we'll introduce a separate API.

## Build & distribution

- **Language**: TypeScript; output ESM/CJS/UMD + .d.ts
- **Build**: Rollup
- **Runtime deps**: none
- **Size guard** (CI): keep total added code ≤ +10 KB minified (UMD)

## Testing

**Unit tests** (Jest):
- **dates**: input parse/format, timeWindow boundaries, averageByDay grouping
- **numbers**: formatWaterVolumeM3, formatTankHeadFromCm, calcDeltaPercent (0/0, ±, NaN, Infinity)
- **csv**: separators, escaping `;`, quotes, newlines; totals row
- **classify**: Portuguese diacritics and common label variants

**Smoke tests**:
- ESM/CJS/UMD importability
- .d.ts type resolution
- No runtime deps check

# Drawbacks

- New exported surface to maintain and version
- Short-term refactor effort in the Water widget
- Tightening semantics (e.g., fixed m³ unit) may require minor UI adjustments

# Rationale and alternatives

- **Extract to shared lib** (this RFC): best for consistency, testability, and reuse
- **Leave inline**: fastest now, but perpetuates drift and duplication
- **Bigger monorepo SDK**: possible later; starting small reduces blast radius
- **Adopt third-party libs**: general libs (date-fns, etc.) don't cover our domain bits (m.c.a., TB datakeys, CSV shapes); also increases deps

# Prior art

We're following a common pattern of extracting cross-cutting utilities into a small, dependency-free package, similar to how projects separate formatting and date helpers from UI code.

# Unresolved questions

- Should CSV default delimiter be `;` (pt-BR) or `,`? (Current: `;`.)
- Should classification regexes be configurable at runtime? (Likely yes, later.)
- Should we add i18n for units/labels immediately or stage it?
- Do we introduce kL scaling for large volumes, or keep fixed m³?
- Do we add a tiny `triggerDownload(csv, filename)` helper to the lib, or keep DOM strictly out? (Current proposal: keep DOM out.)

## Security considerations

- Do not extract MyIOAuth with in-code credentials. If needed, provide a separate `@myio/auth` that requires injected credentials and recommend server-side token brokerage. No tokens/secrets in the shared utils package.
- All utilities are pure and do not access network/DOM/storage.

## Migration plan

1. Implement modules in `myio-js-library` and export from `index.ts`
2. Add tests, smoke tests, and size guards. Bump minor: 0.2.0
3. Refactor Water widget:
   - Replace local helpers:
     - `formatDateToYMD`, `getSaoPauloISOString`, `getDateRangeArray`, `determineInterval`
     - `formatNumberReadable`
     - `formatEnergy` → `formatWaterVolumeM3` (stores) and `formatTankHeadFromCm` (tanks)
     - `%` logic → `calcDeltaPercent`
     - `averageByDay` → lib version
     - `exportToCSV*` → `buildWaterReportCSV` / `buildWaterStoresCSV` + local `triggerDownload`
     - `classify` → `classifyWaterLabel`
     - `getValueByDatakey*` → lib versions
   - Rename local usages of `consumptionKwh` to `consumptionM3` when data truly is water; support the alias during transition
   - QA: verify outputs match prior behavior (snapshots for CSV, visual spot checks)
   - Remove duplicated code from widget
4. Document migration in the repo CHANGELOG and README

## Rollout & stability

- Release under minor version
- Keep deprecated aliases until 0.4.0
- Monitor:
  - Bundle size delta in widget
  - CSV snapshot diffs
  - Error reports in console logs (CI on examples if available)

## Success criteria

- Water widget builds and runs with no local duplicates of extracted helpers
- 100% of new utilities covered by unit tests (critical paths)
- Widget bundle shrinks by ≥3 KB min+gzip compared to pre-refactor
- CSV snapshots identical (modulo header wording if intended)
- No regressions in date ranges or tank head display

# Future possibilities

- **i18n**: locale-driven units, labels, and delimiters
- **Configurable classification** via external rules
- **@myio/ingestion-sdk** (typed client for ingestion/data endpoints)
- **React hooks** around dates/CSV (`useTimeWindow`, `useCsvContent`)
- **Performance**: micro-memoization where helpful
- **Additional domains**: electricity/gas formatters, common chart helpers (data transforms only)
