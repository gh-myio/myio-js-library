# RFC-0202 — Dashboard Geradores Report (v5.2.0)

- **Status**: Draft — Design In Progress
- **Date**: 2026-05-04
- **Author**: MYIO Engineering
- **Related**: RFC-0010 (DateTimeRangePicker), RFC-0183 (AlarmServiceOrchestrator + AlarmBadge), RFC-0198 (Freshdesk tickets), RFC-0199 (MyIOAuthContext + PermissionGuard)
- **Inspired by**:
  - `src/thingsboard/smart-hospital/Tabela_Temp_V5/prod/` — export pipeline, MyIO date range picker, `isMyIOAdmin` gate
  - `src/thingsboard/WIDGET/Generator/` — generator SVG icon + status binding
  - `src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/controller.js` — timeseries edit/delete pattern
  - `src/components/premium-modals/upsell/openUpsellModal.ts` — TB telemetry fetch URL pattern
- **Source draft**: [`RFC-0202-DashboardGeradoresReport-v5.2.0.draft.md`](./RFC-0202-DashboardGeradoresReport-v5.2.0.draft.md)
- **Operational context**: [`src/NODE-RED/SOUZA-AGUIAR/CENTRAL-GERADOR/investigation-gerador-4-startup-time.md`](../../NODE-RED/SOUZA-AGUIAR/CENTRAL-GERADOR/investigation-gerador-4-startup-time.md)

---

## 1. Summary

Introduce a per-customer ThingsBoard custom widget called **Dashboard Geradores Report** that renders a one-page operational view of every QTA (Quadro de Transferência Automática) belonging to a hospital customer. The widget consumes a customer-rooted Asset hierarchy (`Geradores<Customer>Asset → Unit Asset → QTA Asset → {Gerador device, Rede device}`), produces a 4-column grid (one row per QTA) with a status icon, two telemetry tables, and a derived mean, and exposes admin-only edit/delete actions for individual telemetry points. PDF, XLSX, and CSV exports, maximize, and mobile-responsive layout are first-class. The widget reuses the visual language and the proven helpers of the existing `Tabela_Temp_V5/prod` widget (date range picker, export pipeline, `isMyIOAdmin` gate) so most plumbing is borrowed rather than re-invented.

---

## 2. Motivation

The April 15, 2026 grid-failure incident at **Souza Aguiar — QTA4** exposed three concrete gaps:

1. **No aggregated view per customer.** Operations had to open multiple TB device panels and cross-reference timestamps across two virtual devices (`Gerador 4 (Souza Aguiar Gerador)` and `Rede 4 time (Souza Aguiar Gerador)`) to reconstruct a single grid-failure event. See the operational investigation in [`investigation-gerador-4-startup-time.md`](../../NODE-RED/SOUZA-AGUIAR/CENTRAL-GERADOR/investigation-gerador-4-startup-time.md) for the full event reconstruction.
2. **No SLA-grade report.** Customers (currently CER, Maternidade, Souza Aguiar) need monthly reports with mean Tempo de Partida and exportable artifacts (PDF for hand-off, XLSX/CSV for downstream analysis).
3. **No data-correction surface.** §5 of the operational investigation identifies that `startupTime` events can be polluted by `presence_sensor` glitches during transitory electrical events. Today there is no admin-facing UI to delete or amend a polluted timeseries entry — corrections must be done by hand against the TB API.

Building this widget closes all three gaps in a single artifact and creates a reusable pattern for other holdings (Sá Cavalcante, Soul Malls) that have similar QTA topologies.

---

## 3. Guide-level Explanation

A logged-in user opens the dashboard and sees a single widget that occupies the whole tab.

### 3.1 Header (premium)

| Element              | Behavior                                                                    |
| -------------------- | --------------------------------------------------------------------------- |
| **Unit selector**    | Dropdown with three options: `CER`, `Maternidade`, `Souza Aguiar`           |
| **MyIO logo**        | Fixed image (existing `Logotest01.png`)                                     |
| **Title block**      | Three-line block — e.g. *"Hospital Municipal Souza Aguiar — HMSA / Telemetria de Geradores / Relatório emitido em: 04/05/2026"* |
| **Date range picker**| MyIO library picker — Carregar / Limpar buttons trigger the data refresh    |

The header layout mirrors the header of the `Tabela_Temp_V5/prod` widget so the visual language is consistent across MyIO reports.

### 3.2 Body — 4-column grid, one row per QTA

For each QTA in the selected unit, the widget renders one row with four columns:

| #   | Column                              | Content                                                                                                                                                       |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Status panel**                    | SVG generator icon (the same asset used in `WIDGET/Generator/template.html`) + label "Ligado" / "Desligado" + status badge "OK" / "OFFLINE"                   |
| 2   | **Histórico de Partida do Gerador** | Table with columns *Data e Hora* / *Tempo de Partida* / *Ações*. One row per `startupTime` telemetry point of the Gerador device.                             |
| 3   | **Histórico de Falha da Rede**      | Same shape, sourced from the `Rede` device's `startupTime` telemetry (the time the grid stayed off).                                                          |
| 4   | **Média TP**                        | Single label: arithmetic mean of column 2's `startupTime` values, formatted as in §4.4.                                                                       |

#### 3.2.1 Tempo de Partida formatting

The raw value is in **milliseconds** (TB telemetry). The widget formats according to magnitude:

| Range            | Format example     |
| ---------------- | ------------------ |
| ≥ 1 hour         | `"2h 35m 21s"`     |
| ≥ 1 minute       | `"3m 57s"`         |
| < 1 minute       | `"45s"`            |

#### 3.2.2 Actions column (admin-only)

The *Ações* column is visible only when the logged-in user satisfies the `isMyIOAdmin` predicate (§4.6). Each row exposes:

- **Edit** — open a modal to adjust the telemetry value (e.g. correct a polluted `startupTime`).
- **Delete** — confirm-and-remove the single timestamp from the timeseries.

When `isMyIOAdmin` is `false`, the column is hidden — non-admin users see read-only history.

### 3.3 Footer

Three buttons: **Export PDF**, **Export XLSX**, **Export CSV** (icons consistent with `Tabela_Temp_V5/prod` — `fa-file-arrow-down`, `fa-file-csv`, etc.). A maximize toggle and the responsive layout (§4.10) round out the footer area.

### 3.4 Walkthrough

1. Operator picks unit `Souza Aguiar` → date range `2026-04-15` → click *Carregar*.
2. Grid populates with one row per QTA (QTA1, QTA2, QTA3, QTA4).
3. QTA4 row shows three rows in the *Histórico de Partida* table (the April 15 incident).
4. An admin notices the second and third rows are spurious (per the operational investigation §4–§5), opens **Delete** on each, confirms.
5. Admin clicks **Export PDF** to send the cleaned report to the customer.

---

## 4. Reference-level Explanation

### 4.1 Datasource topology

The widget binds to a single Asset, root of a strict hierarchy that must be created in ThingsBoard ahead of widget deployment:

```
GeradoresSouzaAguiarAsset                                  (root, customer-scoped)
├── GeradoresSouzaAguiar-CER-Asset                          (unit asset)
│   └── GeradoresSouzaAguiar-CER-QTA1-Asset                 (QTA asset)
│       ├── Device: "Gerador <id>"                          (presence_sensor)
│       └── Device: "Rede <id>"                             (presence_sensor)
├── GeradoresSouzaAguiar-Maternidade-Asset
│   ├── GeradoresSouzaAguiar-Maternidade-QTA1-Asset
│   │   ├── Device: "Gerador <id>"
│   │   └── Device: "Rede <id>"
│   └── GeradoresSouzaAguiar-Maternidade-QTA2-Asset
│       ├── Device: "Gerador <id>"
│       └── Device: "Rede <id>"
└── GeradoresSouzaAguiar-SouzaAguiar-Asset
    ├── GeradoresSouzaAguiar-SouzaAguiar-QTA1-Asset
    │   ├── Device: "Gerador <id>"
    │   └── Device: "Rede <id>"
    ├── GeradoresSouzaAguiar-SouzaAguiar-QTA2-Asset
    ├── GeradoresSouzaAguiar-SouzaAguiar-QTA3-Asset
    └── GeradoresSouzaAguiar-SouzaAguiar-QTA4-Asset
        ├── Device: "Gerador <id>"
        └── Device: "Rede <id>"
```

The widget's `ctx.datasource` resolves to the root asset; the widget walks `ctx.data` to discover units and QTAs at runtime. **Asset creation is a prerequisite** — the widget renders an empty grid if the hierarchy is missing.

### 4.2 Widget structure

Standard ThingsBoard custom-widget triplet:

| File              | Role                                                            |
| ----------------- | --------------------------------------------------------------- |
| `template.html`   | Header, grid container, footer, modals (edit telemetry)         |
| `style.css`       | Grid layout, premium header, table styles, responsive media-queries |
| `controller.js`   | Lifecycle (`onInit`, `onDataUpdated`, `onResize`), data fetch, render, exports, admin gate |

The closest in-repo analog is `src/thingsboard/smart-hospital/Tabela_Temp_V5/prod/`. We fork the **patterns** (header layout, export glue, admin gate, date picker wiring), not the file — `Tabela_Temp_V5` is too coupled to the temperature domain.

### 4.3 Data fetching

Per QTA, the widget issues two TB telemetry calls:

```
GET /api/plugins/telemetry/DEVICE/{generatorDeviceId}/values/timeseries?keys=startupTime,status&startTs=...&endTs=...
GET /api/plugins/telemetry/DEVICE/{redeDeviceId}/values/timeseries?keys=startupTime,status&startTs=...&endTs=...
```

This is the same URL shape used at `src/components/premium-modals/upsell/openUpsellModal.ts:7085` and `:7215`. The response shape is `Record<key, Array<{ ts: number; value: string | number }>>` — already the format consumed elsewhere in the library.

### 4.4 Time formatting helper

A pure function:

```ts
// proposed location: src/utils/durationFormat.ts (new file)
export function formatDurationFromMs(ms: number): string;
```

Returns one of:

| Input range        | Output                            |
| ------------------ | --------------------------------- |
| `ms >= 3_600_000`  | `"<H>h <M>m <S>s"` (e.g. `2h 35m 21s`) |
| `ms >= 60_000`     | `"<M>m <S>s"` (e.g. `3m 57s`)     |
| `ms < 60_000`      | `"<S>s"` (e.g. `45s`)             |

Exported from `src/index.ts` to be reusable across other widgets and the showcase.

### 4.5 Mean computation (Média TP)

`Média TP = arithmetic mean of all startupTime values currently visible in column 2 of that row` — i.e. respects the date filter and any client-side row filtering. Computed client-side; no rule-chain or server aggregation involved.

### 4.6 Permission gating — `isMyIOAdmin`

Replicates the exact rule used by `Tabela_Temp_V5/prod/controller.js` (lines 3258–3260, async fallback at lines 3270–3272):

```js
isMyIOAdmin = email.toLowerCase().endsWith('@myio.com.br')
           && !email.toLowerCase().startsWith('alarme@')
           && !email.toLowerCase().startsWith('alarmes@');
```

Email source order:

1. `self.ctx.currentUser.sub || self.ctx.currentUser.email` (controller lines 3255–3256) — synchronous, JWT-derived.
2. Async fallback: `GET /api/auth/user`, read `userData.email` (controller line 3266).

The `alarme@`/`alarmes@` exclusion is intentional and matches `Tabela_Temp_V5` semantics: those service accounts must remain read-only.

### 4.7 Edit / Delete timeseries

Two TB telemetry-plugin operations are exposed in the *Ações* column. Both are gated by `isMyIOAdmin === true` (§4.6).

#### 4.7.1 Edit — overwrite a value at an existing timestamp

```
POST /api/plugins/telemetry/{entityType}/{deviceId}/timeseries/ANY?ts={ts}
Content-Type: application/json
Body: { "<key>": <newValue> }
```

The TB telemetry plugin upserts on `(deviceId, key, ts)` — posting the same `ts` replaces the value. The latest table is recomputed automatically.

#### 4.7.2 Delete — remove a single record (canonical contract)

The official endpoint is `deleteEntityTimeseries`:

```
DELETE /api/plugins/telemetry/{entityType}/{entityId}/timeseries/delete
  ?keys=<comma-separated keys>
  &deleteAllDataForKeys=<bool>
  &startTs=<int64 ms>
  &endTs=<int64 ms>
  &deleteLatest=<bool>
  &rewriteLatestIfDeleted=<bool>
```

Required authority: `TENANT_ADMIN` or `CUSTOMER_USER`. The platform creates an audit log event with action type `TIMESERIES_DELETED` for each call.

Parameter semantics (from the TB API spec):

| Parameter                  | Default | Effect                                                                                                                  |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `keys`                     | —       | Comma-separated telemetry keys to delete.                                                                               |
| `deleteAllDataForKeys`     | `false` | If `true`, deletes the entire history of the listed keys; if `false`, the time range `[startTs, endTs]` is honoured.    |
| `startTs` / `endTs`        | —       | Defines the deletion range. Required when `deleteAllDataForKeys=false`.                                                 |
| `deleteLatest`             | `true`  | If `true`, the latest table (separate hot table for current values) is also cleared when its `ts` falls in the range.   |
| `rewriteLatestIfDeleted`   | `false` | If `true` and `deleteLatest=true`, after clearing the latest entry, TB rewrites it from the most recent surviving `ts` in the time-series table. |

##### 4.7.2.1 Single-record delete — recommended parameters

For the *Ações → Delete* button (one row in one table), the recommended request shape is:

```
DELETE /api/plugins/telemetry/DEVICE/{deviceId}/timeseries/delete
  ?keys=startupTime
  &deleteAllDataForKeys=false
  &startTs=<ts>
  &endTs=<ts + 1>
  &deleteLatest=true
  &rewriteLatestIfDeleted=true
```

Substitute `keys=status` if the action is in the status table (do not pass both keys at once — see §4.7.2.2).

Reasoning per parameter:

| Parameter                 | Recommended value | Why                                                                                                                                                |
| ------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keys`                    | the single key of the row | Deleting `startupTime,status` together would remove a `status` sample at the same `ts` that the admin did not click on — broader than intended. |
| `deleteAllDataForKeys`    | `false`           | We are deleting one timestamp, not the entire key history.                                                                                         |
| `startTs` / `endTs`       | `ts` / `ts + 1`   | TB range semantics for `delete` are not unambiguously documented as inclusive on both ends. `endTs = ts + 1` guarantees the target `ts` is included regardless of inclusive/exclusive convention. **Validate on a dev device before first production call.** |
| `deleteLatest`            | `true`            | If the deleted `ts` happens to be the latest sample for that key, leaving `deleteLatest=false` keeps a stale value in the latest table — dashboards reading "latest" still see the deleted record. `true` is the safe default. |
| `rewriteLatestIfDeleted`  | `true`            | Paired with `deleteLatest=true`, this asks TB to repopulate the latest table with the most recent surviving `ts`. Without it, the latest table is left empty until the next ingestion. |

##### 4.7.2.2 Why not `keys=startupTime,status` together?

The widget exposes Edit/Delete on **specific table rows**. A row in *Histórico de Partida do Gerador* corresponds to a `startupTime` sample. Deleting both keys at the same `ts` would silently remove a `status` sample the admin never clicked on. The widget's per-row action MUST send only the key the admin selected.

(Bulk delete for both keys at the same `ts` would require a different UI affordance — out of scope for v1.)

##### 4.7.2.3 Pre-deployment validation

Before the first production call, the implementer must confirm two TB-version-specific behaviours on a throwaway dev device:

1. **Range inclusivity** — does `startTs = ts, endTs = ts` delete the record, or is `endTs` exclusive (requiring `endTs = ts + 1`)?
2. **`rewriteLatestIfDeleted` cascade** — after deleting the latest record, does the latest table indeed get repopulated with the next-most-recent `ts`?

Both behaviours are stable in TB ≥ 3.6.x but should not be assumed without a one-time check on the deployed TB version.

#### 4.7.3 Audit trail

Every `Edit`/`Delete` produces a TB platform audit log entry (`TIMESERIES_DELETED` for delete; `TIMESERIES_UPDATED` for the upsert). For v1, we rely on the platform audit log; an in-widget action log is listed under §9 (Future possibilities).

#### 4.7.4 Reference implementations

- `src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/controller.js` — reference for the request glue (auth headers, error handling).
- TB telemetry plugin official spec: `deleteEntityTimeseries` (the spec block reproduced in §4.7.2).

### 4.8 Export pipeline

Mirrors `Tabela_Temp_V5/prod/controller.js`:

| Output | Glue function                          | Engine                                                     |
| ------ | -------------------------------------- | ---------------------------------------------------------- |
| PDF    | `exportToPDF(data)` (Tabela_Temp line 1474) | `new window.jspdf.jsPDF()` (line 1493)                |
| CSV    | `exportToCSV(rows)` (line 1140)        | Native `Blob` + `URL.createObjectURL`                      |
| XLSX   | `exportToXLS(rows)` (line 1170)        | SpreadsheetML XML string serialized to Blob               |

`window.jspdf` is loaded by the host page; the widget uses the namespace without an explicit ESM import (consistent with the host environment).

A `_exportZIP()` bundle (Tabela_Temp line 1229) is **out of scope** for v1; revisit in §9.

### 4.9 Date range picker

Reuses `window.MyIOLibrary.createDateRangePicker(input, options)` (Tabela_Temp_V5 controller lines 2518–2551). Options:

```js
{
  onApply: ({ startISO, endISO }) => {
    state.startDate = startISO;
    state.endDate   = endISO;
    self.ctx.detectChanges();
    refreshGrid();
  }
}
```

Template markup follows Tabela_Temp_V5: a single `<input name="startDatetimes" class="tbx-datepicker-row" readonly>` paired with **Carregar** / **Limpar** buttons that call `applyDateRange()` / `clearDateRange()`.

### 4.10 Maximize and responsive

- **Maximize**: dynamically inject `.tbx-btn-maximize` (Tabela_Temp_V5 `style.css` lines 145–164, controller injection at lines 3345–3346). Same UX (Esc closes maximize).
- **Responsive baseline**: CSS Grid with `grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))` (Tabela_Temp_V5 `style.css` lines 255–265). For the 4-column grid, add explicit `@media` breakpoints:
  - `≥ 1280 px` — 4 columns (default).
  - `768–1279 px` — 2 columns; QTA cards stack vertically inside each row.
  - `< 768 px` — 1 column; full-width cards, tables horizontally scrollable.

---

## 5. Drawbacks

- **Maintenance overhead.** Adds a sixth widget to maintain in parallel with `Tabela_Temp_V5`. The export logic partially duplicates Tabela_Temp_V5's; risk of drift over time. Mitigation: extract `formatDurationFromMs` and the export glue into shared utilities (`src/utils/`) — but only after both widgets are stable, to avoid over-abstraction.
- **Destructive admin actions.** Edit/Delete operates on production telemetry. The only safety gate is `isMyIOAdmin`; the same risk profile already accepted for the manual override in Tabela_Temp_V5. Suggested mitigation: log every edit/delete to a TB audit timeseries (out of scope for v1, listed in §9).
- **Asset hierarchy is operational overhead.** The widget renders empty until someone creates `GeradoresSouzaAguiarAsset` and the unit/QTA tree in TB. There is no auto-bootstrap.
- **API call multiplication.** A customer with N QTAs triggers 2N telemetry GETs per refresh. For Souza Aguiar today (4 QTAs across 1 unit) this is trivial; revisit if a customer crosses 20+ QTAs.

---

## 6. Rationale and Alternatives

- **Custom widget vs. ThingsBoard built-in table.** The built-in table widget cannot co-locate a status icon, two tables, and a derived mean in a 4-column row layout. We need a custom widget to own the layout.
- **Client-side mean vs. rule-chain aggregation.** Client-side respects the active date range for free and avoids any TB rule-chain change. Server-side aggregation would be overkill for monthly windows and adds operational coupling.
- **Single widget vs. four stacked widgets.** A stacked-widget composition breaks the per-QTA visual grouping that operations actually wants. The 4 columns must share a row.
- **Reusing `Tabela_Temp_V5` directly.** Tabela_Temp_V5 is too coupled to the temperature domain (slot-based override, MAN4 PDF, etc.). We fork the *patterns* (header, picker, export, admin gate) — not the file.
- **Single-customer vs. multi-customer widget.** v1 is single-customer (one root asset per dashboard). A multi-customer variant could be a future RFC if the same hospital chain wants a cross-customer view.

---

## 7. Prior Art

| Pattern reused                  | Source                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Header layout (logo + title + picker) | `src/thingsboard/smart-hospital/Tabela_Temp_V5/prod/template.html` (lines 1–60)                                  |
| `isMyIOAdmin` admin gate        | `src/thingsboard/smart-hospital/Tabela_Temp_V5/prod/controller.js:3255–3272`                                          |
| Date range picker               | `src/thingsboard/smart-hospital/Tabela_Temp_V5/prod/controller.js:2518–2551`                                          |
| Export pipeline (PDF/XLSX/CSV)  | `src/thingsboard/smart-hospital/Tabela_Temp_V5/prod/controller.js:1140 / 1170 / 1474`                                 |
| Maximize button                 | `src/thingsboard/smart-hospital/Tabela_Temp_V5/prod/style.css:145–164` + `controller.js:3345–3346`                    |
| Generator SVG icon              | `src/thingsboard/WIDGET/Generator/template.html`                                                                     |
| Telemetry edit/delete           | `src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/controller.js`                                                    |
| Telemetry fetch URL             | `src/components/premium-modals/upsell/openUpsellModal.ts:7085, 7215`                                                |
| Admin gate cross-reference      | `src/thingsboard/bas-components/MAIN_BAS/controller.js`                                                              |

---

## 8. Unresolved Questions

1. **Final list of units.** v1 covers `CER`, `Maternidade`, `Souza Aguiar`. Should the widget already accept other holdings (Sá Cavalcante, Soul Malls) on day 1, or stay scoped to Souza Aguiar?
2. **Asset prefix.** `GeradoresSouzaAguiarAsset` is customer-specific. If we want a single widget shared across holdings, a generic prefix (e.g. `GeradoresReportAsset`) would be more reusable. Decision required before TB hierarchy creation.
3. ~~**TB delete-timeseries semantics.**~~ — Resolved in §4.7.2 with the official `deleteEntityTimeseries` spec. Two pre-deployment behaviours still need a one-time runtime check (range inclusivity + `rewriteLatestIfDeleted` cascade) — see §4.7.2.3.
4. **Cross-link with the operational investigation §5.** The investigation MD §5 describes that the `startupTime` field can carry false positives during a single grid failure (sensor glitches). Should this widget surface ALL `startupTime` events (raw, audit-style) or filter to the first per grid failure (clean SLA view)? Pending operations decision among Opção A / B / C / D in the investigation §8.
5. **Mobile breakpoint target.** The §4.10 breakpoints (1280 / 768) are proposals; minimum supported width should be confirmed with operations (do customers open this on phones, or only tablets+laptops?).
6. **Audit log for edit/delete.** Should every admin edit/delete write a parallel telemetry entry (e.g. `auditLog` key) so the change is itself reviewable? Out of v1 scope, but the decision affects the data model.
7. **Branch and rollout plan.** Implementation branch name and deployment strategy (canary → all customers, or single-customer pilot) are TBD.

---

## 9. Future Possibilities

- **Auto-alert on long startups.** Tie `startupTime > threshold` into the AlarmServiceOrchestrator (RFC-0183) so a slow generator partition raises a TB alarm, not just a row in this widget.
- **"Histórico de Instabilidade do Gerador" column.** If the operations team picks Opção B from the investigation §8 (separate `startupTime` from re-partition events), this widget gains a fifth column for instability events.
- **ZIP export.** Bundle PDF + XLSX + CSV + raw JSON into a single download — mirror `_exportZIP()` (Tabela_Temp_V5 line 1229).
- **Audit-log integration.** Persist every Edit/Delete admin action as its own telemetry entry on the affected device, with the operator's email and a reason field.
- **Mobile-app integration.** A shared component under `src/components/` so the same panel renders inside the MyIO mobile app (RFC-0201 sync line).
- **Auto-create Freshdesk ticket for anomalous events.** Hook the widget into `TicketServiceOrchestrator` (RFC-0198) so a single click in the *Ações* column opens a pre-filled ticket for the affected QTA.
- **Cross-holding rollout.** Once Souza Aguiar is stable, extend the widget to Sá Cavalcante and Soul Malls (depends on §8.2).

---

_Last updated: 2026-05-04_
