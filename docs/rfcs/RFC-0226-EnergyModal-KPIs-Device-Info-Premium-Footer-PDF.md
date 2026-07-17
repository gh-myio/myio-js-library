# RFC-0226: EnergyModal — KPIs + Device "(i)", Premium Footer & New PDF (CSV preserved)

- Feature Name: `energymodal_kpis_device_info_premium_footer_pdf`
- Start Date: 2026-07-17
- RFC PR: (leave this empty)
- Tracking Issue: (leave this empty)

## Summary

Upgrade the shared **EnergyModal** (`src/components/premium-modals/energy/`,
opened via `window.MyIOUtils.openDashboardPopupEnergy`) — used for both the
**single-device** energy dashboard and the **comparison** modal reached from the
FOOTER "Comparar" button (Shopping v-5.2.0, Head Office and SIM) — so that:

- **(a)** the **comparison** modal gains a **KPIs section** and an **"(i)" info**
  affordance listing **which devices are being compared** (design language from
  `EnergySummaryTooltip`);
- **(b)** the **single-device** dashboard gains the same **"(i)"** (in the header)
  identifying the device/customer;
- **(c)** the **redundant "FECHAR" button** is removed (the shell header already
  has an **×**);
- **(d)** both modes get the **premium footer** already used by `AllReportModal`
  (`createModalFooter`);
- **(e)** the standalone **"Exportar CSV" button** is removed from the toolbar and
  its trigger moves into the footer — **but the CSV-generating code
  (`exportToCsv`) is preserved byte-for-byte** because clients depend on the exact
  template;
- **(f)** a **new PDF export** is added with **KPIs**, reusing AllReportModal's
  `exportGridPdf` (KPI band + chart image);
- **(g)** optionally, the new KPIs render as a **right-side sidebar** (BAS
  split-layout precedent) rather than a top band.

EnergyModal is a **library component** — one change lands in `src/` and every TB
dashboard picks it up via the published bundle (caveat: the comparison "(i)"
depends on callers passing device labels, which the FOOTER already does).

## Motivation

- The comparison modal shows a stacked chart but **never says which devices** are
  in it and shows **no KPIs** — the operator can't read totals/averages or confirm
  the selection.
- The single-device dashboard has **no "(i)"** to confirm device/customer context.
- There are **two close buttons** (toolbar "Fechar" + shell "×") — redundant.
- Export is inconsistent: **CSV only** (single mode), **no PDF**, and the KPI button
  is a stub (`alert('KPI modal functionality to be implemented')`,
  `EnergyModalView.ts:1481`). AllReportModal already solved footer + KPI + PDF; we
  should reuse it.

## Grounding (verified in code)

- **Modes:** `params.mode: 'single' | 'comparison'` (`types.ts:29`). `show()`
  branches at `EnergyModal.ts:83`. **Single** fetches TB device context + series →
  `currentEnergyData` is populated (`EnergyModalView.renderEnergyData` `:788`).
  **Comparison** skips the fetch, builds a minimal context
  (`createComparisonContext` `:196`) and calls `view.tryRenderWithSDK(null)` —
  **there is no MyIO-side dataset in comparison mode.**
- **Chart is the external Energy Chart SDK inside an `<iframe>`**
  (`window.EnergyChartSDK.renderTelemetry*Chart`, `iframeBaseUrl` default
  `https://graphs.apps.myio-bas.com`, `EnergyModalView.ts:866/962/1046`). MyIO owns
  only the chrome (header, controls toolbar, footer). **Any KPIs the SDK draws live
  inside the iframe and are not readable by MyIO** → new KPIs must be computed
  MyIO-side.
- **Header + ×:** owned by `ModalPremiumShell` (`:133-145`); single title HTML =
  `buildModalTitle()` (`EnergyModal.ts:370-396`); comparison title = the plain
  string `` `Comparação de ${n} Dispositivos` `` (`EnergyModal.ts:112`).
- **"FECHAR":** `#close-btn` at `EnergyModalView.ts:524-526` (normal) **and**
  `:630-632` (BAS), wired `:1385-1389`. (Error-panel "Fechar" `:770` is separate —
  keep.)
- **"Exportar CSV":** `#export-csv-btn` at `:418-420` (normal) **and** `:587-589`
  (BAS), wired `:1370-1383`.
- **CSV logic to preserve:** `exportToCsv()` `:1224-1258` + `downloadCSV()`
  `:1263-1276` (see §"CSV").
- **No PDF today.** KPI section is a stub (`#energy-kpi-btn`/`#show-kpis-btn`
  `:543-549`, handler `:1481`).
- **FOOTER "Comparar":** `openComparisonModal()`
  (`v-5.2.0/WIDGET/FOOTER/controller.js:1296`) → `dataSources` with **per-device
  `label`** (`:1330-1334`) → `openDashboardPopupEnergy({ mode:'comparison',
  dataSources, readingType, granularity, … })` (`:1406-1432`). **The device names
  for the "(i)" are already passed in `dataSources`.**
- **Reusable footer:** `createModalFooter` (`../footer-modal/ModalFooter.ts:75`) —
  3-column (customerName + real-time clock + lib-version checker / "Powered by
  MYIO" / export buttons), theme wiring, class `myio-modal-footer-premium`.
  AllReportModal mounts it via `mountFooter()` (`AllReportModal.ts:389-427`) with
  `exports.{pdf,csv,xls}`.
- **Reusable PDF:** AllReportModal `computeKpis()` (`:690-723`) →
  `Array<{value,label,sub?}>`; `exportPDF()` (`:1221-1240`) → `exportGridPdf(...)`
  (`telemetry-grid-shopping/export.ts:257`) with KPI band `drawKpiBand()`
  (`:376-398`) and optional `chartImage`.
- **"(i)" design language:** `EnergySummaryTooltip` (`src/utils/tooltips/…`) —
  `DeviceInfo = { id, label, name? }`, per-status device lists, expand "(i)" →
  `showDeviceListPopup`, pin/drag/maximize panel. `DeviceComparisonTooltip.ts` is a
  closer analog for the comparison device list.

## Guide-level explanation

### (c) Remove redundant "FECHAR"
Delete `#close-btn` from **both** toolbars (normal + BAS) and its wiring. The shell
**×** remains the single close. Keep the error-panel "Fechar".

### (b) Single-device "(i)"
Add a small **(i)** next to the title showing device name, id/ingestionId, customer,
period and granularity. Since `buildModalTitle()` returns an HTML string rendered
into the shell header, the interactive popup is wired **post-render in the view**
(the header string carries a `data-myio-info` anchor; the view attaches the popup).

### (a) Comparison KPIs + "(i)"
- **"(i)"**: a device-list popup (mirroring `EnergySummaryTooltip`'s expand popup)
  built from the `dataSources` labels already passed in — **no new data needed for
  the list**.
- **KPIs**: total, average per device, max/min device, device count, period. In
  comparison mode **MyIO has no dataset today**, so KPIs require **per-device
  fetches via `EnergyDataFetcher`** (the same fetcher single mode uses), aggregated
  client-side. This is the main new data work (see Open Questions).

### (d) Premium footer (both modes)
Mount `createModalFooter` into the modal root (as AllReportModal does), replacing
the ad-hoc toolbar export area. Footer carries: customerName + clock + lib-version,
"Powered by MYIO", and export buttons **CSV / PDF** (XLS optional).

### (e) CSV — move the button, preserve the code
Remove `#export-csv-btn` from the toolbar; route the footer's **CSV** button to the
**unchanged** `exportToCsv()`. **`exportToCsv()` and `downloadCSV()` are kept
verbatim** (columns, metadata block, granularity `HH:MM`, BOM, filename). Only the
trigger moves.

### (f) New PDF with KPIs
Add a **PDF** export mirroring AllReportModal: compute a `computeKpis()`-style array
and call the existing `exportGridPdf(devices, title, unit, period, null, {
accentColor, kpis, chartImage })`. The KPI band + jsPDF worker already exist.
`chartImage`: single mode can capture the iframe only if the SDK exposes a PNG hook;
otherwise render the KPI band + data table without the chart image (Open Question).

### (g) KPIs as right sidebar (optional)
Instead of a top band, render KPIs in a **right-side sidebar** using the BAS
split-layout precedent (`getBASModeStyles` `:682-737`, 30/70), or an
`EnergySummaryTooltip`-style pinnable panel. Decide during design.

## Reference-level explanation

### CSV — the exact template to preserve (`EnergyModalView.ts:1224-1258`)
Metadata block + data section, `readingType`-driven unit (ENERGY/kWh, WATER/m³,
TEMPERATURE/°C), granularity-aware date cell (`1h` appends `HH:MM`), filename
`<readingType>-report-<deviceId>-<YYYY-MM-DD>.csv`, UTF-8 BOM via `downloadCSV`.
**Guarantee:** no change to `exportToCsv`/`downloadCSV`/`CsvExporter.toCsv` output;
a regression test should snapshot a known device's CSV bytes before/after.

### Footer factory (`ModalFooter.ts:75`)
`ModalFooterInstance`: `setThemeMode`, `setCustomerName`, `setExportDisabled`,
`buttons`, `destroy`. EnergyModal mounts it after the chart container, passing
`exports.csv = { onClick: () => view.exportToCsv() }` and `exports.pdf = { onClick:
() => this.exportPDF() }`. Legacy export ids can be re-assigned (as AllReportModal
does) so any external hooks survive.

### PDF (`AllReportModal.ts:690-723`, `export.ts:257-408`)
`GridPdfKpi = { label, value, sub? }`; `drawKpiBand()` draws rounded cards, value in
accent, label + `sub` in gray. EnergyModal's `computeKpis()`:
- **single**: from `currentEnergyData.consumption` (total, average, peak+timestamp,
  min, "sem consumo" if applicable).
- **comparison**: from the aggregated per-device fetch (total across devices, avg
  per device, top/bottom device, device count).

### Callers
`openDashboardPopupEnergy` params are unchanged for existing callers; the comparison
"(i)" consumes `dataSources[].label` already sent by the FOOTER
(`controller.js:1330`). **Head Office / SIM FOOTER copies must pass the same
`dataSources` labels** — verify `src/thingsboard/MYIO-SIM/v5.2.0/FOOTER/controller.js`.

## Drawbacks

- Comparison KPIs add **N per-device fetches** (latency + API load) that don't exist
  today; must be throttled/cached and must never block the SDK chart.
- Editing **two toolbars** (normal + BAS) increases surface for regressions.
- The chart lives in an iframe, so PDF "chart image" may be unavailable without an
  SDK hook.

## Rationale and alternatives

- **Reuse AllReportModal's footer/PDF** vs bespoke: reuse — the infra
  (`createModalFooter`, `exportGridPdf`, `drawKpiBand`) is already battle-tested and
  themed.
- **KPIs top-band vs right-sidebar (g):** sidebar reads better for a chart-first
  modal and matches BAS; band is simpler. Proposed: pick sidebar for comparison
  (more devices) and evaluate for single.
- **Keep CSV button** vs move to footer: move — consolidates exports and removes
  toolbar clutter, without touching the CSV output.

## Risks & mitigations

- **CSV regression (client-critical):** snapshot test on `exportToCsv` output;
  change only the button, never the generator. **Hard requirement.**
- **Comparison data absent:** wire `EnergyDataFetcher` per device with the existing
  throttle; render KPIs progressively; failures degrade to "(i)"-only.
- **Double toolbars / BAS mode:** cover both `#close-btn`/`#export-csv-btn`
  occurrences; keep the error-panel "Fechar".
- **iframe PDF image:** if no SDK PNG hook, ship PDF with KPI band + table first;
  add the chart image when the SDK exposes it.

## Adoption plan

1. **Footer + FECHAR + CSV-move** (low risk, no data work): mount `createModalFooter`
   in both modes, remove `#close-btn` and `#export-csv-btn`, route CSV to the footer.
   Ship with the CSV snapshot test.
2. **Single "(i)"** in `buildModalTitle` + view wiring.
3. **New PDF** (`computeKpis` + `exportGridPdf`) for single mode.
4. **Comparison KPIs + "(i)"** (per-device fetch via `EnergyDataFetcher`), PDF for
   comparison.
5. **Sidebar layout (g)** if approved.

## Acceptance criteria

- **AC-01:** No "FECHAR" in the toolbar (both layouts); the shell × still closes;
  error-panel "Fechar" intact.
- **AC-02:** Premium footer present in single **and** comparison, themed, with CSV +
  PDF buttons (XLS optional), clock + lib-version.
- **AC-03:** CSV output is **byte-identical** to today for the same device/period/
  granularity (snapshot test passes); filename/BOM/columns unchanged.
- **AC-04:** PDF exports with a KPI band; single mode KPIs match the on-screen
  values.
- **AC-05:** Comparison modal shows an **"(i)"** listing every compared device
  (name/id), sourced from `dataSources`.
- **AC-06:** Comparison modal shows KPIs (total, avg/device, max/min device, count)
  computed MyIO-side; missing data degrades gracefully.
- **AC-07:** Single-device modal shows an **"(i)"** with device/customer/period.
- **AC-08:** No regression to the SDK chart in either mode; KPI fetches never block
  or break the chart.

## Open questions

1. **SDK vs MyIO KPIs:** confirm the Energy Chart SDK doesn't already expose
   totals/KPIs we could read (postMessage?) before adding per-device fetches. If the
   SDK offers a data/KPI callback, prefer it over N fetches.
2. **Chart image in PDF:** does the SDK expose a PNG/`toDataURL` hook for the iframe?
   If not, PDF ships without the chart image initially.
3. **Comparison fetch cost:** acceptable N and throttle for per-device aggregation
   (reuse `goalsThrottle`-style settings?).
4. **Sidebar vs band (g):** final layout decision.
5. **XLS in the footer:** include now or CSV+PDF only?
6. **Which readingTypes:** comparison KPIs for water/temperature (temperature
   **averages**, not sums — mirror AllReportModal's unit-aware aggregation).

## Prior art / references

- `AllReportModal` (RFC-0182) — footer + KPIs + PDF template reused here.
- `EnergySummaryTooltip` (RFC-0105) — KPI/"(i)"/device-list design language.
- `ModalFooter` (`footer-modal`), `exportGridPdf` (`telemetry-grid-shopping/export.ts`).
- Consumers: `openDashboardPopupEnergy` (`src/index.ts:428`), FOOTER comparison
  (`v-5.2.0/WIDGET/FOOTER/controller.js:1406`); Head Office / SIM FOOTER copies to
  verify.
