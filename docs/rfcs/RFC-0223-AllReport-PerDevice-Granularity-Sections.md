# RFC-0223: AllReport Per-Device Granularity & Collapsible Sections

- Feature Name: `allreport_perdevice_granularity_sections`
- Start Date: 2026-07-16
- RFC PR: (leave this empty)
- Tracking Issue: (leave this empty)

## Summary

Extend the **Relatório Geral** (`AllReportModal`, opened from the MENU
"Relatórios" flow) with a three-way **report-mode** selector —
`Consolidado | 1d | 1h` — that replaces the current binary `1h | 1d` granularity
tab with a single grouped, mutually-exclusive choice-set. `Consolidado` is the
default and is **exactly today's behavior** (one aggregate row per device,
totals only). Choosing `1d` or `1h` turns the report — in **both the grid and
the PDF** — into **collapsible sections per device**: a `1d` device section
lists one row per day; a `1h` device section lists one collapsible row per day
that expands into that day's hours.

The RFC also adds a **subtle per-device period filter** (a small modal) that lets
the operator include/exclude individual **days** (and, in `1h`, **hours**), with
grid totals recomputed from the checked set; a **collapse-all / expand-all**
header shortcut; and it **standardizes** the existing per-GROUP sectioning
(RFC-0182 `renderGroupedRows`) onto the same collapsible UX. All new controls
follow the existing MYIO premium theming (`--myio-brand-700`,
`resolveThemeSource` / `resolveAccentHex`, `color-mix`) already used by the
modal. Aggregation is **unit-aware**: energy sums kWh, water sums m³,
temperature **averages** °C.

```txt
Período  [ 01/07 – 16/07 ]   Modo do relatório
                             ┌──────────────────────────────────────┐
                             │  Consolidado │  Diário  │  Horário    │   ← one track, 3 equal radio segments
                             └──────────────────────────────────────┘
                                Como o consumo é detalhado no relatório.
```

## Motivation

The Relatório Geral answers "how much did each device consume in the period?"
Today it can only answer it as a **single number per device** over the whole
range. Operators repeatedly need the **breakdown that produced that number**:

- **No per-day visibility in the report.** The grid always shows the period
  total (`StoreReading.consumption`, sourced from `/…/devices/totals?granularity=1d`).
  To see which day drove a spike, the operator must leave the report and open a
  per-device history modal, one device at a time.
- **The `1h` selection barely does anything visible.** Currently `granularity`
  (`'1d' | '1h'`) only changes the **CSV export** — it fetches a per-device
  hourly series at export time. The on-screen grid and the PDF ignore it
  entirely. Users pick `1h`, look at the table, and see no difference, which is
  confusing.
- **The PDF can't tell the day/hour story.** `exportPDF` renders one line per
  device (`buildExportDevices`), so a stakeholder receiving the PDF gets the same
  flat total with no temporal breakdown.
- **Two different sectioning UXs.** RFC-0182 already sections the grid **by
  group** (`renderGroupedRows`, `.rp-group-header`) with a static header — but
  those sections do not collapse and have no filter. Adding a **second**,
  differently-behaving per-device sectioning would leave two inconsistent
  patterns in the same modal.

This RFC turns the report into a drill-downable, temporally-aware document
(on-screen **and** in the exported PDF) while unifying the collapse/expand/filter
UX across group and device sections, and while keeping the default view byte-for-byte
identical to today for users who only want the aggregate.

## Guide-level explanation

### The report-mode selector

At the top of the modal, where the **Granularidade** field with the `1h | 1d`
pill lives today (mounted at `#granularity-toggle` via `createGranularitySelector`),
there is now a single **grouped segmented control** labelled **"Modo do
relatório"**. It renders **three visually-identical, equal-weight radio segments
sharing one track** (`role="radiogroup"`, one selected-fill treatment) inside a
**bounding region** with a **perceptible border in both themes** (verified ≥ 3:1
against the surface so low-vision and dark-mode viewers still see the grouping):

1. **`Consolidado`** — the aggregate report (default).
2. **`Diário`** (enum `1d`) and **`Horário`** (enum `1h`) — the daily / hourly
   breakdowns.

The **display labels are `Consolidado | Diário | Horário`** — all three are the
same *kind* of thing (a temporal resolution), parallel and un-confusable with the
adjacent `Período [dd/mm – dd/mm]` **range** field; `1d`/`1h` survive only as the
internal `ReportMode` enum values. A one-line helper under the control reads
*"Como o consumo é detalhado no relatório."* The earlier "leading button next to
a two-way pill" composite is **rejected** — a standalone button beside a pill
reads as "action + toggle" and breaks the single-choice-of-three mental model
(AC2). Exactly one segment is active at a time; the default is **`Consolidado`**.

> **Component boundary.** The selector is a thin **wrapper** (`ReportModeSelector`)
> that composes the existing `createGranularitySelector` unchanged and adds the
> `Consolidado` segment + bounding region around it. We do **not** add three-way
> mode into the shared `granularity-selector` primitive — that would couple the
> unrelated EnergyModal consumer to this feature's evolution and widen the
> regression blast radius.

- **`Consolidado` (default)** — the report is **exactly what it is today**: the
  KPI band, the flat/grouped totals table (one row per device), the participation
  chart, and the CSV/PDF/XLS exports all behave as they do now. No new network
  calls. This guarantees zero regression for the common case.
- **`1d` (daily)** — the grid switches to **one collapsible section per device**.
- **`1h` (hourly)** — same per-device sections, but each **day** row inside a
  device is itself collapsible and expands into that day's **hours**.

### Per-device sections (1d)

When `1d` is active, each device becomes a collapsible section:

- **Section header** shows: the device name/identifier, the **number of days** in
  the period, and the **device total** — `kWh` (energy), `m³` (water), or the
  **average °C** (temperature). Example:
  `McDonalds (SCMAL1230B) · 16 dias · 1.204,53 kWh`.
- A **collapse-all / expand-all** shortcut in the grid toolbar toggles every
  device section at once. **Default: all expanded.**
- Inside the section, **slightly indented**, one **row per day** showing that
  day's value in the domain unit (`kWh` / `m³` / `°C` average).

### Per-device sections (1h)

When `1h` is active, the device sections are the same, but each **day row is
itself a second-level collapsible**. Collapsed, it shows the day's value;
expanded, it reveals **one row per hour** (`00:00 … 23:00`) with that hour's
value, indented one further level. Default: day rows collapsed (so a device with
16 days is readable), device sections expanded.

### The period filter (days/hours)

A small, subtle **"Períodos"** filter button in the grid toolbar opens a compact
modal listing, for the report:

- all **days** of the period, each with a checkbox — **all checked by default**;
- in `1h` mode, an expandable list of **hours per day**, also all checked.

Unchecking a day (or an hour, in `1h`) and applying **recomputes** the grid: the
per-day rows, the device-section totals, the KPI band, and the participation
chart all reflect only the **checked** set. This is a **temporal** filter,
orthogonal to the existing **device** filter ("Filtros & Ordenação", which picks
*which devices* appear). Both can be active together.

### Standardized group sections

The existing per-**group** sections (RFC-0182) adopt the same collapsible
chrome: a caret to collapse/expand the group, participation in the same
collapse-all shortcut, and a group-level total in the header consistent with the
device-section header. A group section contains device sections (in `1d`/`1h`)
or device rows (in `Consolidado`).

### The PDF

The PDF mirrors the on-screen mode:

- **`Consolidado`** — unchanged (one line per device).
- **`1d`** — a device block per device: header line (name · days · total) then an
  indented day table.
- **`1h`** — device block → day sub-block → hour rows.

Collapse state is a screen affordance only; the PDF renders the **currently
included** (filtered) data fully expanded.

### Theming

Every new element — the bounding region, the `Consolidado` button, section
carets, the Períodos filter modal — is painted from the host dashboard palette
exactly like the rest of the modal: `var(--myio-brand-700)` for accent,
`color-mix()` for the subtle fills/hovers, and the palette resolved via
`resolveThemeSource()` (`params.theme ?? window.MyIOUtils.theme`) applied through
`applyTheme()`. The PDF accent uses `resolveAccentHex()`.

## Reference-level explanation

### New state

`AllReportModal` gains a single source of truth for the mode and the temporal
selection:

```ts
type ReportMode = 'consolidado' | '1d' | '1h';

private reportMode: ReportMode = 'consolidado';   // default preserves today

// Per-device temporal series for 1d/1h, keyed by StoreReading.id.
// Cache key = `${startISO}|${endISO}|${granularity}|${idsKey}` — where idsKey is
// the sorted device-id set (mirrors the existing hourlySeriesCache idsKey so an
// RFC-0128 exclude-groups toggle that changes the device set re-fetches only
// missing ids instead of serving a stale series). Invalidated ONLY by a full
// load, a mode switch, or a device-set top-up. An excludedDays/excludedHours
// change NEVER invalidates it — the temporal filter is a pure client-side
// recompute over the cached buckets (see AC9/AC10), not a refetch.
private deviceSeriesCache: {
  key: string;
  granularity: '1d' | '1h';
  // day bucket -> { total, hours: Map<hourIso, value> } per device
  series: Map<string, DeviceTemporalSeries>;
  // per-device fetch outcome so a swallowed failure is not read as "0 consumo".
  coverage: Map<string, 'ok' | 'partial' | 'failed'>;
} | null = null;

// Temporal (day/hour) filter — empty set means "all included".
// Day/hour keys are derived from the period range via a single América/São_Paulo
// tz-aware formatter (NOT raw `new Date().getHours()`) so they line up with the
// day labels the operator sees and with the 1d server buckets (see AC17).
private excludedDays: Set<string> = new Set();          // 'YYYY-MM-DD'
private excludedHours: Set<string> = new Set();          // 'YYYY-MM-DDTHH'

// Collapse state so re-render preserves what the user opened/closed.
// Namespaced, id-based keys (never labels) with an escaped reserved separator to
// avoid aliasing when a group label or device id contains the separator char:
//   `grp:<id>` · `dev:<id>` · `dev:<id>#day:<YYYY-MM-DD>`
// Keyed together with the active period+mode so a Períodos re-render preserves
// carets but a period/mode change resets to defaults (see AC21).
private collapsedSections: Set<string> = new Set();
```

The legacy `private granularity: '1d' | '1h'` is subsumed: when
`reportMode === 'consolidado'` no series is fetched; otherwise
`granularity = reportMode`.

### Data flow

- **Consolidado** keeps the current path: `fetchCustomerTotals` →
  `mapCustomerTotalsResponse` → `StoreReading[]` (one total per device). Nothing
  else changes.
- **1d / 1h** additionally fetch a **per-device temporal series**. This
  generalizes the existing `ensureHourlySeries` (which already fetches
  `/telemetry/devices/{id}/{endpoint}?granularity=1h` device-by-device in batches
  of 6). We introduce `ensureDeviceSeries(rows, granularity)`:
  - `1h` → reuse the existing hourly fetch, then **bucket points into days**.
  - `1d` → identical request shape with `granularity=1d`, one value per day.
  - temperature reuses the same per-device endpoint used by
    `enrichTemperatureAverages`.

  The series feeds the grid render directly (not only the CSV, as today).

- **Partial-fetch is never silent.** The generalized `ensureHourlySeries` today
  does `if (!res.ok) return;` / `catch {}` per device, so a device that 404s or
  times out simply vanishes from the series Map — harmless for a CSV row, but in
  the sectioned grid it would feed a **wrong-but-plausible** KPI band that
  reconciles perfectly to an under-reported total. `ensureDeviceSeries` therefore
  records a per-device `coverage` outcome (`ok | partial | failed`) and returns a
  "fetched N of M" summary. When any device failed, the affected sections render a
  distinct **"dados incompletos"** state (not a clean `0`), and a warning banner
  is shown; partial series **must not** feed the KPI band as if complete (AC19).
- **Day bucketing is timezone-pinned.** In `1d` the day value comes from the
  server (`/totals?granularity=1d`, server day boundaries); in `1h` the day value
  is client-bucketed from hourly timestamps. Both use **one shared
  América/São_Paulo tz-aware formatter** (matching the existing
  `toLocaleDateString('pt-BR')` display) to derive `YYYY-MM-DD` / `YYYY-MM-DDTHH`
  keys, so the two modes reconcile and `excludedDays` keys match the visible
  labels. On a DST-transition day the day renders its **actual** hour count (23 or
  25), not a hard-coded 24 (AC17).

### Aggregation (unit-aware)

`DOMAIN_CONFIG` already encodes the unit and total label
(`energy: kWh / 'Total kWh'`, `water: m³ / 'Total m³'`,
`temperature: °C / 'Média °C'`). A single helper decides sum vs. average:

The helper is **null-aware**: missing buckets are represented as `null` and are
skipped from both the sum and the average denominator. The **caller** decides how
a missing bucket materializes per domain (resolved below), because `aggregate()`
cannot tell a real `0` from "no reading":

```ts
// values may contain nulls for missing buckets; nulls are excluded entirely.
private aggregate(values: Array<number | null>): number {
  const domain = this.params.domain || 'energy';
  const present = values.filter((v): v is number => v != null);
  if (!present.length) return 0;
  return domain === 'temperature'
    ? present.reduce((s, v) => s + v, 0) / present.length  // mean of present
    : present.reduce((s, v) => s + v, 0);                  // sum of present
}
```

- **Missing-bucket materialization (resolved).** Energy/water: a missing hour/day
  materializes as `0` (a zero reading is meaningful consumption) and is summed.
  Temperature: a missing bucket materializes as `null`, renders `—` in the row,
  and is **excluded from the mean denominator** — a fabricated `0 °C` would
  corrupt the average.
- **Day value** = `aggregate(hours of that day)` (only relevant in `1h`; in `1d`
  the API already returns one value per day).
- **Device total** (section header). Energy/water: hierarchical **sum** (summing
  day totals is associative, so the hierarchy is safe). **Temperature: a flat
  mean over all included leaf buckets** (all included hours in `1h`, all included
  days in `1d`) — **not** mean-of-day-means, which is only equal to the flat mean
  when every day has identical hour coverage and otherwise biases the number
  under uneven coverage. The header reads `Média °C` and carries a footnote
  *"média não ponderada por tempo"* so a stakeholder never acts on a subtly wrong
  headline figure.
- **KPI band** (`computeKpis`) recomputes over the **filtered** device totals so
  the summary always reconciles with the visible sections (see the reconciliation
  invariant in AC18).
- **Percentage base & group totals under two filters.** The participation `%`
  base (`calculateTotalConsumption`) and the RFC-0182 group-header totals
  recompute over the **temporally-filtered, device-unfiltered** set, so
  percentages and group headers never silently disagree with the visible day
  rows.

### Rendering

`renderTable()` branches on `reportMode`:

- `consolidado` → current behavior (`renderGroupedRows` when `groupLabel` present,
  else flat rows). No functional change.
- `1d` / `1h` → new `renderSectionedRows()`:
  - Groups are still respected (RFC-0182): group section → device sections →
    day rows (→ hour rows in `1h`).
  - Each collapsible level is a `<tr>` header with a caret bound to
    `toggleSection(key)`; expansion state comes from `collapsedSections`.
  - Rows carry `data-section` / `data-parent` so a toggle is a **pure DOM
    show/hide** (toggling a CSS class on descendants + updating the caret +
    `collapsedSections`) — **never** a full `renderTable()` rebuild. A full
    re-render is reserved for exactly two events: a **mode switch** and a
    **Períodos apply**. This is the cheap win that removes the caret-click jank
    the Drawbacks flag.
  - **Lazy leaf materialization (1h).** A day's hour `<tr>`s are built on the
    **first expand** of that day, not in the initial `innerHTML`. With day rows
    collapsed by default, initial 1h DOM is `devices × days`, which stays
    tractable into the low thousands.
  - **No row pagination in sectioned mode.** `reportMode !== 'consolidado'`
    bypasses `getPaginatedData()` / `itemsPerPage` entirely and renders the full
    filtered device set as sections; a fixed row-count page would otherwise slice
    mid-section and orphan day/hour rows under no header. Pagination remains only
    for the `consolidado` flat/grouped path.
  - **Indentation.** A fixed **16 px per level (max 4 levels)** plus a thin left
    guide rule per open section as a secondary depth cue; the right-aligned total
    badge lives in a **fixed column independent of indent** so numbers stay
    comparable and the layout degrades gracefully at narrow modal widths.

A shared **`CollapsibleSection`** helper (new internal module) renders the
header row (caret + title + right-aligned total badge) for **both** group and
device sections, so their chrome is identical. Caret header rows are keyboard-
operable: `role`/`button` semantics, focusable, `aria-expanded`, toggled on
Enter/Space (see AC22). The grid toolbar gains a **collapse-all/expand-all**
button whose label reflects the next action — **"Expandir tudo"** when any
section is collapsed, **"Recolher tudo"** when all are open — so the mixed state
is unambiguous (see AC7).

### The Períodos (day/hour) filter modal

A new lightweight internal modal — reusing the modal shell and
`--myio-*` theming — lists days (and hours in `1h`) as checkboxes, all checked by
default. It writes `excludedDays` / `excludedHours` on apply and triggers a
re-render. It is distinct from `FilterOrderingModal` (device selection + sort),
which is untouched. The grid toolbar shows an active-count badge on the Períodos
button when any day/hour is excluded, mirroring the "Filtros & Ordenação (N)"
active-state convention.

### PDF export

`exportPDF()` branches on `reportMode`:

- `consolidado` → unchanged call into `exportGridPdf(buildExportDevices(), …)`.
- `1d` / `1h` → build a **sectioned** device model (device header + day table,
  and day → hour sub-tables in `1h`) honoring the same temporal filter, and emit
  it as grouped blocks. Accent color continues to come from `resolveAccentHex()`;
  the KPI band and participation-chart page are preserved. The sectioned model is
  produced by a **pure, unit-testable builder** whose output (day/hour rows ==
  included set) is asserted before handoff (AC12), decoupling the assertion from
  the binary PDF.
- **Exporter scope.** `exportGridPdf`'s current signature has no grouping
  parameter, so the sectioned PDF needs either (a) a grouped-blocks mode added to
  the shared `exportGridPdf` (a change to shared TELEMETRY export code that must
  be **owned and listed** in the Impact Map, not slipped in) or (b) a dedicated
  `exportSectionedPdf`. The RFC prefers **(b)** to keep the shared exporter
  single-responsibility.
- **Size guard (resolved leaning).** Above a `devices × days × hours` cell
  threshold (e.g. `> ~50k` cells, tuned by profiling), the PDF export **warns and
  requires explicit confirmation**, prompting the operator to narrow the period or
  apply the Períodos filter. It **never silently caps/truncates** — a truncated
  consumption report is worse than a slow or refused one (AC20).

CSV in `1h` already emits one row per device × hour (`exportHourlyCSV`); a `1d`
CSV emits one row per device × day from the same `ensureDeviceSeries` cache.

**Hourly-CSV continuity (resolved).** Today `1h` exists mainly to drive the
hourly CSV with the grid unchanged; the new model folds granularity into mode, so
"I only want the hourly CSV, not a sectioned grid" would lose its home. Because
the sectioned grid now renders day rows **collapsed by default** in `Horário`,
selecting `Horário` and immediately exporting the CSV is the intended,
low-friction path to today's hourly CSV — the heavy hour-DOM is never
materialized (lazy leaf expand) unless the operator drills in. AC1's
"byte-for-byte" guarantee is therefore scoped to **`Consolidado`**; the
`Horário`/`Diário` CSV output must equal today's hourly / daily CSV for the same
period (AC23), and the behavior change (1h now also changes the grid, not only
the CSV) is documented for existing hourly-CSV users.

### Theming (explicit)

No new color literals. The bounding region and controls read
`var(--myio-brand-700)` and derive hovers/fills with
`color-mix(in srgb, var(--myio-brand-700) X%, transparent)`, matching the
existing `#filter-btn` / exclusion-checkbox styling. `applyTheme()` already
propagates the host `cssVars()` (or flat `--myio-*` map) onto the modal root, and
`resolveAccentHex()` feeds the PDF — the new code paths call the **same** helpers.

### Acceptance Criteria

> Numbered, testable. QA (Letícia Camargo) validates against these. "Report"
> means the AllReportModal opened via MENU → Relatórios.

1. **Default is Consolidado / no regression.**
   Given the report is opened, When it first renders, Then the mode selector
   shows **`Consolidado`** active and the grid, KPI band, participation chart and
   exports are byte-for-byte the current behavior (one aggregate row per device;
   no per-device temporal fetch occurs).

2. **Single grouped choice-set.**
   Given the mode selector, Then `Consolidado`, `1d` and `1h` are visually inside
   **one** bounding region, and selecting any one **deactivates** the other two
   (exactly one active at all times).

3. **Consolidado is the current aggregate.**
   Given data is loaded in `Consolidado`, Then each device appears once with its
   period total, identical to the pre-RFC report.

4. **1d creates per-device sections.**
   Given data is loaded and `1d` is selected, Then the grid renders **one
   collapsible section per device**, each header showing device name/identifier,
   **total number of days**, and the **device total** in the correct unit
   (`kWh` energy / `m³` water / `°C` average temperature).

5. **1d day rows.**
   Given a `1d` device section is expanded, Then it shows **one indented row per
   day** of the period with that day's value in the domain unit.

6. **Default expansion state.**
   Given `1d` has just loaded, Then **all device sections are expanded**. Given
   `1h` has just loaded, Then **device sections are expanded but their day rows
   are collapsed** (so a 16-day device is readable and the initial DOM stays
   `devices × days`). Above a device-count threshold, `1d` device sections open
   **collapsed** with "Expandir tudo" available, so a many-device customer does
   not face a wall of rows on open.

7. **Collapse-all / expand-all shortcut (mixed state defined).**
   Given per-device sections are shown, When the operator clicks the shortcut,
   Then **every** section toggles in one action. The single control is
   next-action driven: it reads **"Expandir tudo"** whenever **any** section is
   collapsed and **"Recolher tudo"** only when **all** are open; individually
   toggling sections updates the label accordingly. Clicking it never destroys a
   hand-arranged state ambiguously.

8. **1h second-level collapse.**
   Given `1h` is selected, Then each **day** row within a device section is
   itself collapsible and, when expanded, reveals **one row per hour** with that
   hour's value, indented one level deeper.

9. **Períodos filter — days.**
   Given `1d` or `1h`, When the operator opens the Períodos filter, Then every
   day is listed and **checked by default**; When a day is unchecked and applied,
   Then that day disappears from every device section and the device totals, KPI
   band and participation chart **recompute** from the remaining days.

10. **Períodos filter — hours.**
    Given `1h`, Then the Períodos filter also lists **hours per day** (checked by
    default); When an hour is unchecked and applied, Then that hour is removed and
    its day's value and the device total **recompute** accordingly.

11. **Unit-aware aggregation.**
    Given energy or water, Then device/day totals are **sums**; Given
    temperature, Then device/day values are **averages** (never sums) and the
    header/total label reads `Média °C`.

12. **PDF mirrors the grid mode.**
    Given `1d` (resp. `1h`) with an active Períodos filter, When the operator
    exports the PDF, Then the PDF contains per-device blocks with day rows (resp.
    day → hour rows) reflecting **only the included** days/hours, plus the KPI
    band and participation-chart page.

13. **Standardized group sections.**
    Given grouped data (RFC-0182), Then group sections use the **same**
    collapsible header chrome and participate in the same collapse-all shortcut
    and Períodos filter as device sections.

14. **Theme fidelity.**
    Given a host dashboard theme (`window.MyIOUtils.theme` or `params.theme`),
    Then the bounding region, `Consolidado` button, carets and Períodos modal use
    `var(--myio-brand-700)` / `color-mix` accents, and the PDF accent matches
    `resolveAccentHex()` — no hard-coded colors.

15. **Cleanup / no leaks.**
    Given the modal is closed, Then the mode selector, Períodos modal and any new
    tooltips are destroyed (added to the existing `modal.on('close')` teardown),
    and reopening starts again in `Consolidado`.

16. **Empty / partial data.**
    Given a device with **genuinely no readings** for the period in `1d`/`1h`,
    Then its section header renders with `0` days and a zero total (energy/water)
    or `—` (temperature), and the report does not error. A device whose fetch
    **failed** is visually distinct (AC19), never shown as a clean `0`.

17. **Timezone / DST day boundaries.**
    Given day/hour bucketing, Then it uses an explicitly declared timezone
    (**América/São_Paulo** unless `params` override) via a single shared
    formatter; And Given a period crossing a DST transition, Then that day renders
    its **actual** hour count (23 or 25), and for energy/water
    `sum(1h day-buckets) == 1d value` from `/totals` for the same day within
    rounding.

18. **KPI reconciliation (numeric oracle).**
    Given energy or water in `1d`/`1h` with any Períodos filter, Then
    `KPI band total == sum(visible device totals) == sum(visible day rows) ==
    sum(visible hour rows)` to 2 decimals. Given temperature, Then the device
    total equals the **flat mean of visible leaf buckets** and is explicitly
    **not** the sum of rows. A golden fixture with **uneven** day/hour coverage
    pins the temperature contract so QA does not flag it as a reconciliation bug.

19. **Partial-fetch is visible, never silent.**
    Given one or more per-device series fetches fail during `ensureDeviceSeries`,
    Then the affected device sections render a distinct **"dados incompletos"**
    state and a warning is surfaced; And the KPI band / participation chart are
    **not** computed as if those devices were complete.

20. **PDF size guard.**
    Given `1h` (or `1d`) over a device × day × hour count above the configured
    threshold, When the operator exports the PDF, Then the export **warns and
    requires confirmation** (suggesting a narrower period or the Períodos filter)
    and **never silently truncates** the report.

21. **Collapse-state persistence.**
    Given the operator toggles some sections and then applies/clears a Períodos
    filter (a re-render within the same period+mode), Then each section's collapse
    state is **preserved**; And Given a fresh `loadData()` or a period/mode
    change, Then collapse state **resets to the AC6 defaults**.

22. **Keyboard & screen-reader operability.**
    Given the collapsible carets and the Períodos day→hour checkbox tree, Then all
    are fully operable by keyboard (focusable, Enter/Space toggles, parent
    select-all with `indeterminate` state) and expose `aria-expanded` / checkbox
    state to assistive tech.

23. **CSV parity across modes.**
    Given the same period, Then the `Diário` CSV equals today's per-device × day
    CSV and the `Horário` CSV equals today's `exportHourlyCSV` output (device ×
    hour); the `Consolidado` CSV/XLS is byte-for-byte today's Consolidado export.

24. **Two-filter empty state names the cause.**
    Given the device filter (Filtros & Ordenação) and the Períodos filter jointly
    yield zero rows, Then the grid shows an empty-state message **naming which
    filter(s) are active** (e.g. "Nenhum dispositivo — ajuste Filtros &
    Ordenação" vs "… ajuste Períodos"), does not throw, and clearing either
    restores rows. When any day/hour is excluded, a **"Filtrado por período"**
    chip appears near the KPI band.

25. **Sort axis.**
    Given a user sort (by consumption, name, …) in `1d`/`1h`, Then it orders the
    **device sections** only; day and hour rows are **always chronological
    ascending**, so a value-sort never scrambles the time axis.

26. **Large-data budget (non-functional).**
    Given `Horário` over a 31-day period with N devices (day rows collapsed),
    Then initial render completes within the profiled DOM-node / time budget; And
    above the device × day threshold the Períodos filter is prompted/forced. The
    budget test ships even if virtualization is deferred.

### Impact Map

Every artifact that must change, with the reason:

**`src/components/premium-modals/report-all/AllReportModal.ts`**

- `renderContent()` — replace the `#granularity-toggle` form-group with the new
  grouped **Modo do relatório** region (`Consolidado` + granularity pill in one
  bounding container); add the **Períodos** filter button and **collapse-all**
  shortcut to the grid toolbar.
- `setupEventListeners()` — wire the three-way mode change (extend/replace the
  `createGranularitySelector` `onChange`); wire Períodos + collapse-all buttons.
- New state fields: `reportMode`, `deviceSeriesCache`, `excludedDays`,
  `excludedHours`, `collapsedSections` (and subsume `granularity`).
- `loadData()` — after mapping totals, when `reportMode !== 'consolidado'`,
  call `ensureDeviceSeries()`; initialize `excludedDays/Hours` empty and
  `collapsedSections` empty (all expanded).
- New `ensureDeviceSeries(rows, granularity)` — generalizes `ensureHourlySeries`
  (batched per-device fetch) to also fetch/bucket `1d`; feeds grid + exports.
- `renderTable()` — branch on `reportMode`; new `renderSectionedRows()` for
  `1d`/`1h`; keep the current path for `consolidado`.
- `renderGroupedRows()` — refactor to the shared collapsible header (standardize
  with device sections).
- New `toggleSection()`, `collapseAll()`, `expandAll()`.
- New `openPeriodsFilterModal()` + apply handler that sets
  `excludedDays/Hours` and re-renders.
- `computeKpis()` / `calculateTotalConsumption()` — compute over the temporally
  filtered series when `reportMode !== 'consolidado'`.
- New `aggregate(values)` helper (sum vs. average by domain).
- `renderSummary()` — unchanged call site, but reads recomputed KPIs.
- `updateParticipationChart()` — feed device totals recomputed from the filtered
  series.
- `exportPDF()` — branch to a sectioned device model for `1d`/`1h`
  (reuse `resolveAccentHex()`, KPI band, chart page).
- `exportCSV()` / `exportHourlyCSV()` — add the `1d` per-device × day path from
  the shared `deviceSeriesCache`.
- `show()` / `modal.on('close')` — destroy the new selector, Períodos modal and
  tooltips (extend existing teardown).

**New internal sub-modules (under `report-all/` or `premium-modals/internal/`):**

- `ReportModeSelector` — a **wrapper** that composes the existing
  `createGranularitySelector` unchanged and adds the `Consolidado` segment + one
  equal-weight radio track (`Consolidado | Diário | Horário`) + bounding region,
  emitting `ReportMode`; `--myio-*` themed. **Does not** add three-way mode into
  the shared `granularity-selector` primitive (keeps EnergyModal insulated).
- `CollapsibleSection` — shared header-row renderer (caret + title + total badge)
  for group and device sections.
- `PeriodsFilterModal` — the day/hour checkbox modal (theme-aware), distinct from
  `FilterOrderingModal`.

**`src/components/granularity-selector/` — untouched.**

- Per the resolved component boundary (compose, don't extend), the shared
  primitive is **not modified**; `ReportModeSelector` wraps it. This removes the
  "must not regress EnergyModal" risk the earlier draft carried.

**`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js`**

- `_openGroupReport()` / `openDashboardPopupAllReport` call — no signature change
  required (mode defaults to `Consolidado` internally). If a default mode ever
  needs to be passed, add an optional `reportMode` to the params; otherwise the
  MENU entry point is **unchanged**. Listed here to confirm it was reviewed.

**Types (`src/components/premium-modals/types.ts`)**

- Add optional `reportMode?: 'consolidado' | '1d' | '1h'` to
  `OpenAllReportParams` (optional; default `consolidado`).

**Tests (`tests/…`)**

- Unit tests for `aggregate` (sum vs. average, **null-skipping**), day-bucketing
  of hourly points, temporal-filter recomputation, and section collapse state.
- **tz/DST day-bucketing** (23/25-hour day; `sum(1h buckets) == 1d value`).
- **Reconciliation golden fixture** with uneven day/hour coverage (AC18),
  including the temperature flat-mean contract.
- **Missing-hour rendering per domain** (energy/water `0` vs temperature `—`).
- **Fetch-failure vs empty** distinction (AC19) and the **race** where an
  in-flight `ensureDeviceSeries` result is discarded if `reportMode` changed
  before it resolved.
- **PDF sectioned-model** pure builder assertion (AC12) and **caret keyboard /
  `aria-expanded`** a11y (AC22).

**Product instrumentation (rollout)**

- Emit a lightweight signal on report open counting `reportMode`
  (`consolidado | 1d | 1h`), Períodos-filter usage, and section-expand / sectioned-PDF
  events, so the "Consolidado is the most common request" default and the value of
  the expensive `1h` tail become **measured** rather than assumed (gates Phases 3–4).

## Delivery phases

The roundtable found the RFC over-bundles independently-shippable features against
its own zero-regression promise. It is therefore delivered in **phases**, thin
valuable slice first; each phase is releasable and measurable on its own. ACs are
tagged by phase:

| Phase | Scope | ACs |
|-------|-------|-----|
| **P1 — MVP (daily grid)** | `ReportModeSelector` (`Consolidado \| Diário \| Horário`) with `Horário` **hidden or disabled** until P3 (no dead control); `Diário` per-device collapsible sections; collapse-all; unit-aware `aggregate()`; tz-pinned bucketing; partial-fetch visibility; empty/two-filter states | 1, 2, 3, 4, 5, 6, 7, 11, 14, 15, 16, 17, 18, 19, 21, 22, 24, 25 |
| **P2 — Daily PDF/CSV** | `Diário` sectioned PDF (pure builder) + `Diário` CSV | 12 (1d), 23 (1d) |
| **P3 — Hourly drill-down** | `Horário` second-level day→hour sections (lazy leaf), `Horário` PDF/CSV, size guard, large-data budget | 8, 12 (1h), 20, 23 (1h), 26 |
| **P4 — Períodos filter** | day/hour temporal filter + KPI/chart recompute | 9, 10 |
| **P5 — Group standardization** | fold RFC-0182 group sections onto the shared `CollapsibleSection` chrome | 13 |

Rationale: P1 kills both headline pains (no per-day visibility; `1h` "does
nothing visible") at the lowest risk. The expensive/uncertain surfaces — hourly
DOM weight, PDF size, the Períodos recompute reconciliation, and the **refactor of
working RFC-0182 code** — move to later phases that can be validated or cut
independently. Instrumentation (see Impact Map) gates P3–P4 on observed `Diário`
adoption rather than the unmeasured "Consolidado is most common" assumption.

## Drawbacks

- **More network traffic.** `1d`/`1h` fetch a per-device series (batched 6-wide)
  instead of a single `/totals` call. For large customers (hundreds of devices)
  this is many requests. Mitigation: fetch lazily only when `1d`/`1h` is chosen,
  cache per period+granularity, and keep `Consolidado` as the default so the
  common case pays nothing.
- **Grid weight.** A `1h` report over a month is device × 30 days × 24 hours of
  DOM. Mitigation: day rows collapsed by default in `1h`; consider virtualization
  if profiling shows jank (see Unresolved questions).
- **Two filters to reason about.** Device filter (Filtros & Ordenação) and
  temporal filter (Períodos) interact; users could confuse "no data" caused by
  device de-selection vs. day de-selection. Mitigation: distinct buttons, active
  badges, and an empty-state message that names which filter is hiding rows.
- **Temperature aggregation is a simplification.** The device average is a **flat
  mean over included leaf buckets** (unbiased under uneven coverage, unlike
  mean-of-day-means), but still **not time-weighted** by bucket duration.
  Accepted for v1 and surfaced with a *"média não ponderada por tempo"* footnote;
  true time-weighting is a fast-follow, not a blocker.
- **Refactor risk on RFC-0182 group sections.** Standardizing the group section
  chrome touches working code; the Consolidado default and preserved flat/grouped
  path bound the blast radius.

## Rationale and alternatives

- **Why fold `Consolidado` into the granularity control instead of a separate
  toggle?** The three are one decision — "at what temporal resolution is this
  report?" — so a single choice-set is the honest model and prevents illegal
  combinations (e.g., "consolidated but hourly"). Wrapping them in one bounding
  region communicates that they are mutually exclusive.
- **Why keep `Consolidado` as default?** Zero regression and zero added latency
  for the most common request; the drill-downs are opt-in.
- **Why reuse `ensureHourlySeries`' per-device fetch?** The `/totals` endpoint
  has no sub-period granularity; per-device series is already the proven path for
  the `1h` CSV. Generalizing it (add `1d`, bucket by day) is less code and less
  risk than a new endpoint.
- **Why a separate Períodos filter rather than extending Filtros & Ordenação?**
  They filter orthogonal axes (which devices vs. which days/hours). Overloading
  one modal with both would be harder to reason about and to show active state
  for.
- **Alternatives considered:**
  - *Per-device drill via the existing history modal* — rejected: it's one device
    at a time and lives outside the report/PDF.
  - *Server-side sectioned aggregation* — deferred: no such endpoint today;
    client bucketing reuses existing calls.
  - *Rendering day/hour rows only in the PDF, not the grid* — rejected: the grid
    is where operators explore; parity avoids surprise.

## Prior art

- **RFC-0182 (AllReportModal grouping):** the `groupLabel` → `renderGroupedRows`
  section pattern and the API-driven `orchIdSet` filter this RFC generalizes and
  standardizes.
- **RFC-0097 / `granularity-selector`:** the `1h | 1d` pill component reused (and
  extended) for the mode selector.
- **RFC-0128 (`exclude_groups_totals`):** the exclusion toggle whose totals must
  keep reconciling with the sectioned view.
- **EnergyModal:** the source of the granularity pill and the per-device
  batched-fetch pattern (`ensureHourlySeries` mirrors its temperature enrichment
  batching).
- **RFC-0203 (Header annotations) / RFC-0215 (`openSettingsHubModal`):** the
  premium-modal theming and teardown conventions (`--myio-*` root vars,
  `modal.on('close')` cleanup) the new sub-modules follow.

## Resolved by the roundtable (2026-07-16)

The following were open in the first draft and are now **decided in the body**:

- **Hour coverage → RESOLVED.** Domain-split, enforced at the `aggregate()`
  layer (not display-only): energy/water missing bucket = `0` (summed);
  temperature missing bucket = `null`, rendered `—`, excluded from the mean. Never
  omit the row (keeps the time axis continuous). See *Aggregation* + AC16/AC17.
- **Temperature weighting → RESOLVED (v1).** **Flat mean over included leaf
  buckets** (unbiased under uneven coverage), with a *"média não ponderada por
  tempo"* footnote. True time-weighting deferred. See *Aggregation* + AC18.
- **Collapse persistence → RESOLVED.** Reset on `loadData()` / period-or-mode
  change; **preserve** across re-render (Períodos apply / toggle), keyed by
  period+mode. See AC21.
- **Sort within sections → RESOLVED.** Sort orders **device sections** only;
  day/hour rows are always chronological ascending. See AC25.
- **Cache correctness → RESOLVED.** Cache key includes the device-id set; an
  exclusion change is a pure client recompute, never a refetch. See *New state*.

## Unresolved questions (narrowed, with leaning)

- **Virtualization threshold:** exact device × day × hour count for windowing —
  **profiling-driven, deferred.** Leaning: don't build virtualization first; lazy
  leaf materialization + day-rows-collapsed caps live DOM to `devices × days`; add
  windowing only if a ~200-device month still janks. A **budget test ships now**
  (AC26) even though the number is TBD.
- **PDF size guard threshold:** the cell count that triggers the warn+confirm is
  **TBD from profiling**; the *behavior* (warn + require confirmation, never
  silent truncation) is decided (AC20).
- **MENU default mode:** decided to **always open `Consolidado`** from the generic
  MENU entry; the optional `reportMode` param exists in types but no entry point
  is wired to a heavy mode now. **Open leaning:** persist **last-used mode per
  user/session** so repeat drill-down operators aren't re-taxed — revisit once the
  instrumentation shows `1d`/`1h` adoption.
- **Large-`1d` default-collapse threshold:** the device count above which `1d`
  opens collapsed (AC6) — **TBD from UX/profiling** (starting point ~25 devices).

## Future possibilities

- **Per-device sparklines** in the section header (day series as an inline
  mini-chart), reusing the participation-chart / graphs infrastructure.
- **Cost overlay (RFC-0222):** multiply each day/hour value by the matching
  (customer, domain, category, period) price to show R$ per day/hour alongside
  kWh / m³.
- **Weekly / monthly buckets** as further mode options for long ranges.
- **Anomaly flags:** highlight day/hour rows that deviate from the device's
  baseline.
- **Export the temporal series as XLSX** with a sheet per device.
- **Carry the mode/filter into the shareable report URL** so a drill-down can be
  reopened as configured.
- **Reuse the sectioned renderer** in the v-5.4.0 grid report path once RFC-0201
  brings the reporting flows into parity.

## Roundtable Review (BMAD Party Mode)

### 2026-07-16 — Analyst / PM / Architect / UX / Dev / QA

Six-persona review, facilitated by Bob (SM). The panel strongly converged on
**phasing + testability**, not on scrapping the design — the Consolidado-default
core is sound. Top point per persona and its resolution:

| Persona | Top point | Resolution |
|---------|-----------|------------|
| **Mary (Analyst)** | Over-bundles a working-code refactor; hourly-CSV user silently dropped; "Consolidado most common" unmeasured | **Accepted** — group refactor → Phase 5; hourly-CSV continuity via `Horário`+collapsed-CSV (AC23); success instrumentation added |
| **John (PM)** | 5 features in one flat AC list; slice the 1d grid as MVP | **Accepted** — Delivery phases table (P1–P5), ACs tagged; `Horário` hidden/disabled until P3 (no dead control) |
| **Winston (Architect)** | Exclusion-invalidates-cache defeats the filter; `aggregate()` temp null gap; full-materialization jank; compose don't extend | **Accepted** — cache key + invalidation rewritten; null-aware `aggregate()` + flat mean; pure-DOM toggle + lazy leaf; `ReportModeSelector` wraps the primitive |
| **Sally (UX)** | Selector reads as button+toggle; `1d/1h` labels ambiguous vs range; no a11y | **Accepted** — 3 equal radio segments `Consolidado\|Diário\|Horário`; keyboard/ARIA (AC22); indentation scale + guide rule; visible bounding border; scale-aware default (AC6) |
| **James (Dev)** | Silent partial-fetch under-reports; tz/DST day boundaries; cache-key drops device set; pagination vs sections | **Accepted** — coverage tracking + "dados incompletos" (AC19); tz-pinned formatter (AC17); idsKey restored; no pagination in sectioned mode |
| **Quinn (QA)** | ~⅓ of ACs directional — tz/DST, KPI reconciliation, temp semantics, missing-value all untestable | **Accepted** — AC17 (tz/DST), AC18 (numeric reconciliation + golden fixture), AC16/aggregation (missing-value contract), AC26 (perf budget) added |

**Deferred with reason (not silently dropped):**

- *True time-weighted temperature average* — deferred to fast-follow; v1 ships the
  unbiased flat mean with a caveat footnote (low risk, adequate for the report).
- *Virtualization & exact PDF/large-data thresholds* — behavior decided, the
  numbers are profiling-driven; a budget test (AC26) ships regardless.
- *Persist last-used mode per session* — left as an open leaning; the safe
  zero-regression default (`Consolidado`) ships first, revisited with adoption data.
- *RFC-0182 group-section standardization (AC13)* — kept in scope but moved to the
  last phase (P5) so a consistency refactor of working code never gates
  operator-facing value.
