# RFC: MAN4 Conformity Indicators Tab

- **Status:** Implemented
- **Date:** 2026-04-06 (updated)
- **Author:** Rodrigo Lago
- **Widget:** `src/thingsboard/smart-hospital/Tabela_Temp_V5/prod/`
- **Relates to:** `controller.js`, `template.html`

---

## Summary

Add a new **MAN4** tab alongside the existing Lista / Cards / Dashboard tabs that displays the
**"Indicadores de Resultado de Conformidade — MAN4"** view.

The tab reads the `dados` array already in scope (same data as Lista, Cards, and Dashboard),
extracts the 7 fixed daily measurement slots defined by the MAN4 protocol (08:00–20:00 BRT every
2 hours), classifies each slot per device as `CONFORME`, `SEM_DADOS`, or `TEMPERATURA_ALTA`, and
renders an expandable conformity report inline — no modal, no extra API calls.

---

## Motivation

Hospital compliance protocol requires documenting that monitored environments maintained temperatures
at or below 24 °C during defined measurement windows throughout the day. The MAN4 indicator
formalises this requirement: 7 scheduled readings per room per day must all be ≤ 24 °C for the
environment to be considered fully conformant.

The tab approach (vs. a modal) keeps the report permanently visible and scrollable alongside the
other views, making it easier to annotate and audit without dismissing overlays.

---

## Guide-Level Explanation

### MAN4 Slot Grid

For every calendar day covered by the selected query range, the protocol defines exactly **7 measurement
slots** (times in BRT, UTC−3):

| Slot # | BRT time | UTC equivalent |
|--------|----------|----------------|
| 1 | 08:00 | 11:00 UTC |
| 2 | 10:00 | 13:00 UTC |
| 3 | 12:00 | 15:00 UTC |
| 4 | 14:00 | 17:00 UTC |
| 5 | 16:00 | 19:00 UTC |
| 6 | 18:00 | 21:00 UTC |
| 7 | 20:00 | 23:00 UTC |

Each slot UTC timestamp is computed as:

```javascript
Date.UTC(year, month, day, hourBRT + 3, 0, 0, 0)
// e.g. 08:00 BRT on 2026-04-04 → Date.UTC(2026, 3, 4, 11, 0, 0, 0)
```

### Slot Classification

Each slot is resolved by looking up the device's `dados` row whose `sort_ts` equals the slot's UTC
timestamp (exact integer match). Classification is applied to the **final, post-processing value**
(after clamp, interpolation, and manual override merge):

| Condition | Classification | Label |
|-----------|---------------|-------|
| No `dados` row found for this `sort_ts` | `SEM_DADOS` | ? |
| Row found, `temperature === '-'` | `SEM_DADOS` | ? |
| Row found, `equalSign === true` | `SEM_DADOS` | ? |
| Row found, `parseFloat(temperature) > 24` | `TEMPERATURA_ALTA` | ✗ |
| Row found, `parseFloat(temperature) <= 24` | `CONFORME` | ✓ |

The target is **100% CONFORME**: every slot of every device must be ≤ 24 °C.

---

## Reference-Level Explanation

### Data Flow

```
self.ctx.$scope.dados  (allProcessed — already clamped, merged, sorted)
  │
  ├─ group by deviceName → { deviceName: { sort_ts: row } }
  │
  ├─ build day list: startDate → endDate (BRT calendar days)
  │
  └─ for each device × each day × each slot in [08,10,12,14,16,18,20]:
        slotTs = Date.UTC(year, month, day, hourBRT + 3, 0, 0, 0)
        row    = tsMap[slotTs]          // exact integer key lookup
        status = classify(row)          // CONFORME | SEM_DADOS | TEMPERATURA_ALTA
        accumulate counts
  │
  └─ _man4ActivateDashboard(man4Report)
       └─ document.getElementById('tbtv5-man4-view').innerHTML = _man4BuildHTML(report)
```

### `man4Report` Object Schema

```javascript
{
  period:             string,   // "DD/MM/YYYY → DD/MM/YYYY"
  totalDevices:       number,
  totalSlots:         number,   // devices × days × 7
  totalConforme:      number,
  totalSemDados:      number,
  totalTempAlta:      number,
  overallConformePct: number,   // 0–100, one decimal place
  semDadosPct:        number,   // totalSemDados / totalSlots × 100, one decimal place

  devices: Array<{
    name:          string,
    totalConforme: number,
    totalSemDados: number,
    totalTempAlta: number,
    conformePct:   number,

    days: Array<{
      date:          string,   // "DD/MM"
      conformeCount: number,
      semDadosCount: number,
      tempAltaCount: number,

      slots: Array<{
        time:   string,                               // "08:00"
        status: 'CONFORME' | 'SEM_DADOS' | 'TEMPERATURA_ALTA',
        value:  number | null,                        // temperature or null
      }>
    }>
  }>
}
```

Devices are sorted ascending by `conformePct` (worst conformity first).

### Tab Integration — `template.html`

New tab button added after Dashboard:

```html
<button mat-button [class.active]="viewMode === 'man4'"
        (click)="toggleViewMode('man4')" title="Indicadores de Conformidade MAN4">
  <mat-icon>fact_check</mat-icon> MAN4
</button>
```

Expand/collapse controls (same pattern as Dashboard tab):

```html
<div class="expand-controls" *ngIf="viewMode === 'man4'">
  <button mat-button (click)="expandAllMAN4()"><mat-icon>expand_more</mat-icon> Expandir Todos</button>
  <button mat-button (click)="collapseAllMAN4()"><mat-icon>expand_less</mat-icon> Recolher Todos</button>
</div>
```

Filter bar `*ngIf` updated to include `man4`:

```html
*ngIf="(viewMode === 'list' || viewMode === 'card' || viewMode === 'dashboard' || viewMode === 'man4') && ..."
```

Container (reuses `.dashboard-tab-container` class — already flex-styled by `_injectLayoutCSS`):

```html
<div class="dashboard-tab-container" [hidden]="viewMode !== 'man4' || !dados || dados.length === 0">
  <div id="tbtv5-man4-view"></div>
</div>
```

### New JavaScript Functions — `controller.js`

All new functions follow the `_man4*` naming convention, mirroring the `_sm*` pattern.

| Function / Variable | Description |
|---|---|
| `var _man4State` | Module-level state: `{ report: null }` |
| `toggleViewMode('man4')` | New branch: ensures `groupedData`, calls `openMAN4Dashboard()` via `setTimeout` |
| `$scope.openMAN4Dashboard()` | Builds report via `_man4BuildReport`, calls `_man4ActivateDashboard` |
| `$scope.expandAllMAN4()` | Expands all device rows via DOM (`tbtv5-man4-dd-*`) |
| `$scope.collapseAllMAN4()` | Collapses all device rows |
| `$scope.getBadgeDeviceCount()` | Updated: returns `_man4State.report.totalDevices` for `man4` viewMode |
| `$scope.getBadgeReadingsCount()` | Updated: returns `_man4State.report.totalConforme` for `man4` viewMode |
| `_man4BuildReport(allData)` | Builds `man4Report` from `dados` + `startDate`/`endDate` |
| `_man4InjectCSS()` | Injects `<style id="tbtv5-man4-styles">` with all MAN4 CSS |
| `_man4BuildHTML(report)` | Returns HTML string for `#tbtv5-man4-view` |
| `_man4ActivateDashboard(report)` | Injects CSS, sets `container.innerHTML`, stores report in `_man4State` |
| `_man4Esc(s)` | HTML escape helper |
| `_man4PfClass(pct)` | Returns progress fill class (`pf-ok/warn/fail`) |
| `_man4PctClass(pct)` | Returns percentage text class (`pct-ok/warn/fail`) |
| `window.tbtv5_toggleMAN4Device(i)` | Toggles device row expansion via `tbtv5-man4-dd-i` / `tbtv5-man4-dt-i` |
| `_man4BuildExportFilename(ext)` | Builds filename: `man4_{slug}_conformidade_{period}_emitido-em-{ts}.{ext}` |
| `_man4BuildExportRows()` | Flat rows from `_man4State.report`: `[device, date, time, status, temp]` per slot |
| `_man4ExportCSV()` | CSV export (UTF-8 BOM, `;` separator, PT-BR decimal `,`) |
| `_man4ExportXLS()` | XLSX export (XML SpreadsheetML, worksheet "MAN4") |
| `_man4ExportPDF()` | PDF export via jsPDF — cover page + slot-by-slot detail table |
| `window.tbtv5_man4ExportPDF/XLS/CSV` | Globals for `onclick` in export footer buttons |

### CSS Architecture

`_man4InjectCSS()` injects into `document.head` (same pattern as `_smInjectCSS`):

- `#tbtv5-man4-view` — flex column, `flex:1`, rounded with shadow (matches `#tbtv5-dashboard-view`)
- `.man4-header` — purple `#5c307d` header bar matching Summary Dashboard
- `.man4-body` — flex column, `flex:1`, `overflow-y:auto` — scrollable body
- `.man4-overall` — KPI cards row
- `.man4-kpi` — KPI card with `grid-template-columns:44px 1fr`, modifier classes `kpi-ok/warn/fail`
- `.man4-dr` / `.man4-dr-header` / `.man4-dr-detail` — expandable device row
- `.man4-prog` / `.man4-prog-fill` — inline progress bar (`pf-ok/warn/fail`)
- `.man4-chip` — small status chip (`chip-sem` amber, `chip-alta` red)
- `.man4-day-block` — day group within device detail
- `.man4-slot` — slot pill with modifier `s-conforme`, `s-sem-dados`, `s-temp-alta`
- `.man4-export-footer` — sticky footer row with export buttons (PDF red, XLSX green, CSV blue)
- `.man4-exp-btn` — base export button; `.btn-pdf`, `.btn-xls`, `.btn-csv` — colour variants

`.dashboard-tab-container` class (already `flex:1` in `_injectLayoutCSS`) is reused — no `style.css` changes required.

### Export

#### CSV / XLSX flat-row structure

One row per slot per device per day:

| Column | Example |
|--------|---------|
| Dispositivo | `UTI Norte` |
| Data | `04/04` |
| Horário | `08:00` |
| Status | `Conforme` / `Temperatura Alta` / `Sem Dados` |
| Temperatura (°C) | `22,50` (PT-BR decimal) or empty for SEM_DADOS |

#### PDF structure

- **Page 1 — Cover** (identical layout to `_pdfBuildCover`):
  - Purple header bar (h=50): logo left + title / "MYIO Smart Hospital" / hospital name / emitted date right
  - Lilac info bar (y=50, h=12): consulted period
  - 4 KPI cards (y=67): Conforme Geral % · % Sem Dados · Dispositivos · Temp. Alta
  - 2-column device summary table: Dispositivo / Conf. / T.Alta / S/D / % (colour-coded %)
- **Pages 2+ — Slot detail table**: Dispositivo / Data / Horário / Status (colour) / Temp (°C), repeating header on each page
- **Footer all pages**: purple bar with logo, title, emitted date+time, period, page n/total

### Color Tokens

| Token | Value | Meaning |
|---|---|---|
| Conforme | `#22c55e` / `#dcfce7` | Temperature ≤ 24 °C |
| Sem Dados | `#f59e0b` / `#fef9c3` | No measurement |
| Temp Alta | `#ef4444` / `#fee2e2` | Temperature > 24 °C |
| Header | `#5c307d` | Matches Summary Dashboard |

---

## Drawbacks

- Adds ~270 lines to `controller.js`. Consistent with existing feature blocks; file is not bundled.
- The 7 slot hours and 24 °C threshold are hardcoded. A future protocol revision would require a
  code change.

---

## Rationale and Alternatives

**Why reuse `dados` directly?**
Data is already cleaned, clamped, and merged. Re-fetching would duplicate traffic and risk showing
different values from the main report.

**Why 7 slots (08:00–20:00 every 2 h)?**
Both boundaries are inclusive: `08, 10, 12, 14, 16, 18, 20` → 7 values. Confirmed by product owner.

**Why exact `sort_ts` integer match?**
All `dados` rows originate from ThingsBoard 30-minute-aligned intervals. The 2-hour MAN4 slots are
proper multiples of 30 minutes, so their UTC timestamps always align with existing `sort_ts` values.
O(1) hash lookup via `tsMap[slotTs]`.

**Why a tab instead of a modal?**
Keeps the conformity report permanently accessible without overlays, consistent with the existing
Dashboard tab pattern, and requires zero extra Z-index management.

---

## Prior Art

- **Dashboard tab** (`openSummaryDashboard` / `_smActivateDashboard` / `_smBuildHTML`) — same
  architectural pattern: `toggleViewMode` → `openXDashboard()` → `_xActivateDashboard(report)` →
  `container.innerHTML = _xBuildHTML(report)`.
- **`_injectLayoutCSS`** — provides `.dashboard-tab-container{flex:1;...}` reused by MAN4 tab.

---

## Unresolved Questions

None. All classification rules, slot definitions, and threshold confirmed before implementation.

---

## Future Possibilities

- **Configurable threshold**: expose the 24 °C limit in the Settings modal (same clamp UI pattern),
  stored as a customer attribute.
- **MAN4 badge**: small conformity % indicator in the `.summary-badges` strip.
- **Multi-protocol support**: generalise slot config and threshold for MAN5, MAN6, etc.
