# RFC: Premium Modal Components for ThingsBoard Energy Dashboards

**Feature Name:** premium-dashboard-modals

**Start Date:** 2025-09-25

**Owners:** MyIO UI Platform

**Status:** Draft

**Target Library Namespace:** MyIOLibrary.*

**Inspired by:** MyIOLibrary.renderCardCompenteHeadOffice, MyIOLibrary.renderCardComponentV2

## Summary

Introduce four atomic, premium-quality modal components for ThingsBoard dashboards that replace the current ad-hoc jQuery popups:

- `MyIOLibrary.openDashboardPopupEnergy` – device energy chart + device info.
- `MyIOLibrary.openDashboardPopupReport` – device daily consumption report (tabular) with CSV export.
- `MyIOLibrary.openDashboardPopupAllReport` – global "consumption by store" report with sorting & CSV export.
- `MyIOLibrary.openDashboardPopup` – settings (device metadata + alarm thresholds).

Each modal is built from the same set of atomized primitives (modal shell, header, date range controls, content panels, footers, and utilities) to ensure consistency, maintainability, and easy reuse across dashboards.

The API mirrors our existing library style (MyIOLibrary.renderCardComponentV2) and is fully self-contained: it renders DOM, styles, and behavior with zero external CSS/HTML required (aside from the host's font stack). It consumes data via our Data API + EnergyChartSDK and via ThingsBoard REST for device attributes when needed.

## Motivation

- Current modals are inline strings with duplicated HTML/CSS/logic, hard to reuse or theme.
- We need typed, documented, versioned APIs that the dashboard scripts can call.
- The modals must feel premium: accessible, keyboard-navigable, adaptive layout, subtle motion, consistent tokens, and robust error/empty states.
- Improved reliability: single source of truth for date/time handling, sorting, and CSV formatting; uniform auth and error flows.

### Source Reference

The original widget source files (.html, .css, .js) from the ThingsBoard implementation are available in:
`C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-4.0.0\modal\`

These files serve as the primary reference to ensure all parameters, data bindings, and UI flows are correctly understood when componentizing:
- `controller.js` - Contains the complete modal implementations
- `template.html` - HTML structure and Angular bindings
- `style.css` - Complete styling and responsive design

**Critical Requirement**: The new modal components must remain as faithful as possible to the current widget behavior and layout. Improvements, refactors, or redesigns will be considered only after the initial extraction and componentization are complete.

## Guide-Level Explanation

### Modal Primitives (Atomic Design)

We will ship internal primitives (not exported) that compose into the four public modals:

- **ModalPremiumShell** – overlay + centered container, focus trap, scroll lock, ESC/✕ close, responsive width.
- **ModalHeader** – title, optional subtitle, right-aligned actions, brand color.
- **DateRangeBar** – startDate/endDate inputs + "Load" button; emits onChange and onLoad.
- **InfoFields** – labeled readonly inputs for device metadata (label, floor, store number, meter/device IDs, GUID).
- **ChartPanel** – container hosting EnergyChartSDK iframe; exposes renderChart() and destroy().
- **TotalsStrip** – inline KPIs (min/max/avg/total or stores count + total kWh).
- **DataTable** – sticky header, client-side sort, zebra rows, empty/error/loader views.
- **FooterActions** – primary/secondary buttons (e.g., Save / Close).
- **CsvExporter** – utility that converts arrays into semicolon CSV with localized numbers.
- **AuthClient** – utility that handles Data API token (clientId/clientSecret) and TB JWT passthrough.

All primitives are styled via CSS custom properties injected with the modal, so there's no global stylesheet dependency.

### Public API (Overview)

```typescript
namespace MyIOLibrary {
  // 1) Energy modal (device-specific charts)
  function openDashboardPopupEnergy(params: EnergyModalParams): ModalHandle;

  // 2) Device report modal (per device daily table)
  function openDashboardPopupReport(params: DeviceReportParams): ModalHandle;

  // 3) Global report modal (stores table)
  function openDashboardPopupAllReport(params: AllReportParams): ModalHandle;

  // 4) Settings modal (device settings / alarms)
  function openDashboardPopup(params: SettingsModalParams): ModalHandle;
}
```

All functions:

- Render immediately into a single `#myio-premium-overlay` root (one modal at a time).
- Return a ModalHandle with:

```typescript
interface ModalHandle {
  close(): void;
  on(event: 'close' | 'loaded' | 'error', handler: (payload?: any) => void): void;
}
```

### Naming & Usage examples

#### Energy modal

```javascript
MyIOLibrary.openDashboardPopupEnergy({
  deviceId: 'UUID',
  label: 'ENTRADA SUBESTAÇÃO',
  gatewayId: 'GW-123',
  slaveId: 1,
  ingestionId: 'a1b2c3d4-....',
  date: { start: '2025-09-01', end: '2025-09-25' },
  ui: { theme: 'light' },
  api: {
    clientId: '<CLIENT_ID>',
    clientSecret: '<CLIENT_SECRET>',
    dataApiBaseUrl: 'https://api.data.apps.myio-bas.com',
    graphsBaseUrl: 'https://graphs.apps.myio-bas.com',
    timezone: 'America/Sao_Paulo'
  },
});
```

#### Device report modal

```javascript
MyIOLibrary.openDashboardPopupReport({
  deviceId: 'UUID',
  ingestionId: 'a1b2c3d4-....',
  deviceLabel: 'Entrada Subestação',
  storeLabel: 'Outback',
  date: { start: '2025-09-01', end: '2025-09-25' },
  api: { clientId, clientSecret, dataApiBaseUrl: DATA_API_HOST },
});
```

#### Global report (by store)

```javascript
MyIOLibrary.openDashboardPopupAllReport({
  customerId: '<TB customer id>',
  date: { start: '2025-09-01', end: '2025-09-25' },
  api: { clientId, clientSecret, dataApiBaseUrl: DATA_API_HOST },
  filters: {
    excludeLabels: [
      /bomba.*secund[aá]ria/i, /^administra[cç][aã]o\s*1$/i, /^administra[cç][aã]o\s*2$/i,
      /^pist[aã]o\s*2$/i, /chiller/i, /ubesta/i, /^entrada\b/i, /^rel[oó]gio\b/i
    ]
  }
});
```

#### Settings modal

```javascript
MyIOLibrary.openDashboardPopup({
  deviceId: 'UUID',
  api: { tbJwtToken: localStorage.getItem('jwt_token') },
  // optional to prefill UI (will also fetch from TB)
  seed: {
    label: 'Chiller',
    floor: 'E1',
    storeNumber: 'SCP00480',
    meterId: '12345',
    deviceRef: 'SCPO261A',
    guid: '5d344a31-....',
    maxDailyKwh: 10000,
    maxNightKwh: 1500,
    maxBusinessKwh: 8000,
  }
});
```

## Reference-Level Explanation

### 1) Types

```typescript
type ISODateYMD = `${number}-${number}-${number}`; // "YYYY-MM-DD"

interface DateRange {
  start: ISODateYMD; // inclusive, 00:00:00 local
  end: ISODateYMD;   // inclusive, 23:59:59 local
}

interface ApiConfig {
  clientId?: string;
  clientSecret?: string;
  dataApiBaseUrl?: string;    // default https://api.data.apps.myio-bas.com
  graphsBaseUrl?: string;     // default https://graphs.apps.myio-bas.com
  timezone?: string;          // default "America/Sao_Paulo"
  tbJwtToken?: string;        // required for TB attribute reads/writes in Settings
}

interface UiConfig {
  theme?: 'light' | 'dark';
  width?: number | 'auto';  // default 0.8 * viewport
}

interface EnergyModalParams {
  deviceId: string;
  label?: string;
  gatewayId?: string;
  slaveId?: number;
  ingestionId?: string;
  date?: Partial<DateRange>;
  ui?: UiConfig;
  api: ApiConfig;
}

interface DeviceReportParams {
  deviceId?: string;         // used to fetch TB attributes if needed
  ingestionId: string;       // required for Data API call
  deviceLabel?: string;
  storeLabel?: string;
  date?: Partial<DateRange>;
  ui?: UiConfig;
  api: ApiConfig;
}

interface AllReportParams {
  customerId: string;
  date?: Partial<DateRange>;
  ui?: UiConfig;
  api: ApiConfig;
  filters?: {
    excludeLabels?: (RegExp | string)[];
  };
}

interface SettingsModalParams {
  deviceId: string;
  api: ApiConfig; // tbJwtToken required
  ui?: UiConfig;
  seed?: {
    label?: string; floor?: string; storeNumber?: string;
    meterId?: string; deviceRef?: string; guid?: string;
    maxDailyKwh?: number; maxNightKwh?: number; maxBusinessKwh?: number;
  };
}
```

### 2) Behavior & Data Flows

#### Date Handling

- Convert {start,end} to timezone-aware ISO strings with offset (e.g., T00:00:00-03:00 / T23:59:59-03:00).
- Defaults: if not provided, set to current month start → today.

#### Auth

- **Data API**: use clientId/clientSecret to fetch a bearer token (cached with pre-expiry refresh).
- **TB REST**: use tbJwtToken from host app (no password handling in the modal).

#### Energy Modal

- **Left card**: device identity + readonly info fields (Label, Floor, Store#, Meter ID, Device ID, GUID).
- **Right card**: EnergyChartSDK v2 embedded with readingType=energy, granularity=1d.
- **Header KPIs** (optional): min/max/avg/total (when chart returns aggregates).
- **"Load"** re-renders chart and recomputes comparison deltas (current vs previous period).
- **Device sprite** uses classifyDevice(label) to choose the correct icon (substation, meter, chiller/pump, default).

#### Device Report Modal

- Fetch `/telemetry/devices/{ingestionId}/energy?startTime=...&endTime=...&granularity=1d&page=1&pageSize=1000&deep=0`.
- Build complete date range array and fill gaps with 0 for missing days.
- Show **Total** row at top.
- **Table**: sticky headers, client-side sorting (date asc/desc; consumption asc/desc).
- **Export CSV** (semicolon separator, "pt-BR" decimals).

#### All Report Modal (by store)

- Fetch totals for the given customerId via paginated Data API endpoint; merge all pages.
- Build table with **Loja / Identificador / Consumo**, allow sorting by any column.
- Show header stats: **Stores count** and **Total consumption**.
- **CSV export** included.

#### Settings Modal

- Load current TB device and SERVER_SCOPE attributes:
  - `floor`, `NumLoja`, `IDMedidor`, `deviceId`, `guid`,
  - `maxDailyConsumption`, `maxNightConsumption`, `maxBusinessConsumption`.
- Provide inputs with validation (numeric for kWh fields).
- **On Save**:
  - PATCH device label via `/api/device` (ThingsBoard).
  - POST attributes to `/api/plugins/telemetry/DEVICE/{deviceId}/SERVER_SCOPE`.
  - Show success/error toast; close on success.

### 3) Styling (Atomic, Embedded)

Each modal injects a scoped `<style>` with the following CSS variables (themeable):

```css
:root {
  --myio-brand-700: #4A148C;
  --myio-accent: #5c307d;
  --myio-danger: #d32f2f;
  --myio-ok: #388E3C;
  --myio-bg: #f7f7f7;
  --myio-card: #fff;
  --myio-shadow: 0 2px 6px rgba(0,0,0,.08);
  --myio-radius: 10px;
  --myio-font: 'Roboto', Arial, sans-serif;
}
```

**Premium touches:**

- Backdrop blur and soft drop shadows.
- Focus ring on interactive elements (`:focus-visible`).
- Motion: subtle scale in/out for modal; icon hover scale on action buttons.
- Sticky table headers; zebra rows; hover highlight.
- Mobile: stacked layout, scrollable content areas; header actions pinned.

### 4) Accessibility

- Focus trap, ESC to close, ✕ button has `aria-label="Close"`.
- `role="dialog"` with `aria-modal="true"`.
- All form controls have explicit `<label>`s linked via `for`.
- Keyboard support for sorting (Space/Enter on header cell toggles sort).

### 5) Errors & Empty States

- Global error box near header (red text, soft red background).
- Loading overlays with spinner icon.
- Friendly copy for "no data".
- Retries with exponential backoff only for auth.

### 6) Security

- Never logs secrets.
- Data API token kept in memory and cleared when modal closes.
- TB JWT is provided by the host and used only for TB endpoints.

## Drawbacks

- Slightly larger bundle due to embedded styles and utilities per modal.
- EnergyChartSDK is iframe-based; we expose minimal surface for cross-doc messaging (drilldown events only).

## Rationale and Alternatives

- **Why atomic?** Allows us to reuse ModalHeader, DateRangeBar, and DataTable across future analytics modals with identical look & feel.
- **Why embed styles?** Ensures the component is portable across dashboards and immune to host CSS collisions.
- **Why namespace functions (not classes)?** Matches existing library ergonomics (MyIOLibrary.renderCardComponentV2) and is friendlier in TB widget scripts.

## Unresolved Questions

- Should All Report permit multi-select exports or filters by tag? (Future extension.)
- Theming: do we need a dark palette beyond token overrides?
- Localization beyond pt-BR and en-US?

## Future Work

- Add `MyIOLibrary.openDashboardPopupDemand` (kW demand profile).
- Add role-based edit controls in Settings (hide alarms for non-admins).
- Provide a Storybook playground for the components with fake data.

## Implementation Requirements

### Faithful Componentization

**Primary Goal**: Extract and componentize the existing modal implementations with complete fidelity to current behavior.

**Source Files Reference**:
- **Controller Logic**: `src/thingsboard/main-dashboard-shopping/v-4.0.0/modal/controller.js`
  - Contains complete implementations of all four modal functions
  - Data API integration patterns
  - ThingsBoard REST API calls
  - Date handling and timezone logic
  - Authentication flows (MyIOAuth, JWT tokens)
  - CSV export formatting
  - Sorting and filtering logic

- **HTML Structure**: `src/thingsboard/main-dashboard-shopping/v-4.0.0/modal/template.html`
  - Angular template bindings
  - Date range controls
  - Search functionality
  - Group layout structure

- **Styling**: `src/thingsboard/main-dashboard-shopping/v-4.0.0/modal/style.css`
  - Complete responsive design
  - Modal overlay patterns
  - Card layouts and animations
  - Mobile breakpoints and alerts

### Demo and Validation Requirements

For validation during development, we must provide **demo screens with mock data** inside the library. These demos will:

1. **Simulate realistic scenarios** with representative data sets
2. **Allow team verification** of styling, data formatting, and interactivity
3. **Remove dependency on live APIs** during development and testing
4. **Provide regression testing** against the original widget behavior

Demo data should include:
- Typical device lists with various consumption patterns
- Edge cases (zero consumption, missing data, error states)
- Different date ranges and time periods
- Various device types and classifications

### Internal Reuse and Atomization

**Mandatory internal reuse** wherever possible:

**Example**: `openDashboardPopupReport` and `openDashboardPopupAllReport` both rely on a shared grid engine. This grid component and the CSV export engine should be abstracted into internal primitives and reused across both modals.

**Shared Components to Extract**:
- **DataTable Engine**: Unified table rendering, sorting, and pagination
- **CSV Export Engine**: Single implementation for semicolon-separated, pt-BR formatted exports
- **Date Range Controls**: Consistent date picker behavior across all modals
- **Modal Shell**: Common overlay, focus trap, and responsive container
- **Loading States**: Unified spinner and error display patterns
- **Authentication Client**: Shared Data API and ThingsBoard token management

**Anti-Pattern**: Avoid duplicating logic for table rendering, sorting, and CSV generation — use a single implementation consumed by both report modals.

### Development Phases

**Phase 1: Faithful Extraction** (This RFC)
- Extract existing modal functions with zero behavior changes
- Componentize shared primitives identified in source analysis
- Implement demo screens with mock data
- Ensure 100% visual and functional parity

**Phase 2: Premium Improvements** (Future)
- Enhanced theming and dark mode support
- Advanced filtering and multi-select capabilities
- Performance optimizations
- Additional accessibility features

### Source Code Analysis Summary

From `controller.js` analysis, the key functions to componentize:

1. **`openDashboardPopupEnergy`**:
   - Device info display with ThingsBoard attributes
   - EnergyChartSDK v2 integration
   - Comparison data with previous period
   - Device classification and icon selection

2. **`openDashboardPopupReport`**:
   - Daily consumption table with date range filling
   - Data API telemetry endpoint integration
   - Client-side sorting (date/consumption)
   - CSV export with pt-BR formatting

3. **`openDashboardPopupAllReport`**:
   - Customer-wide device totals
   - Pagination handling for large datasets
   - Label filtering with regex patterns
   - Store-level aggregation and sorting

4. **`openDashboardPopup`** (Settings):
   - ThingsBoard device and attribute management
   - Form validation for numeric fields
   - Server scope attribute updates
   - Success/error feedback patterns

### Critical Implementation Notes

- **Date Handling**: Use `toISOWithOffset()` function pattern for timezone-aware timestamps
- **Authentication**: Implement `MyIOAuth` pattern for Data API token caching
- **Device Classification**: Preserve `classifyDevice()` logic for icon selection
- **Error Handling**: Maintain existing retry patterns and user feedback
- **Responsive Design**: Keep mobile alert patterns and breakpoint behavior
- **State Management**: Preserve local state isolation between modals

## Appendix A – DOM Structure (Energy Modal)

```
#myio-premium-overlay
  .modal
    .header (title + close)
    .body
      .col-left (InfoFields card with icon)
      .col-right (ChartPanel)
```

## Appendix B – CSV Formats

### Device Report:

```
Dispositivo/Loja; <label>; <store>
DATA EMISSÃO; DD/MM/YYYY - HH:mm
Total; 123,45
Data; Consumo
01/09/2025; 7,86
...
```

### All Report:

```
DATA EMISSÃO; DD/MM/YYYY - HH:mm
Total; 232,49
Loja; Identificador; Consumo
Outback; SCP00480; 22,81
...
```

## Appendix C – Event Hooks

All modals dispatch:

- `loaded` with `{date, counts?, totals?}`
- `error` with `{message, context}`
- `close` with no payload

Example:

```javascript
const handle = MyIOLibrary.openDashboardPopupAllReport({...});
handle.on('loaded', (p) => console.log('Report ready', p));
handle.on('error', (e) => console.error(e));
```

## Appendix D – Mapping Old → New

| Legacy function | New API | Notes |
|---|---|---|
| `openDashboardPopupEnergy(...)` | `MyIOLibrary.openDashboardPopupEnergy` | Chart + device info with comparison |
| `openDashboardPopupReport(...)` | `MyIOLibrary.openDashboardPopupReport` | Daily table + CSV |
| `openDashboardPopupAllReport(...)` | `MyIOLibrary.openDashboardPopupAllReport` | Global table + sorting + CSV |
| `openDashboardPopup(...)` (settings) | `MyIOLibrary.openDashboardPopup` | Metadata + alarm thresholds |

## Acceptance Criteria

- ✅ Each function renders a modal with no required external CSS/HTML.
- ✅ Keyboard accessible, responsive, and themable via CSS vars.
- ✅ Correct Data API calls and TB attribute read/write where applicable.
- ✅ CSV exports match current finance ops expectations (semicolon; pt-BR decimals).
- ✅ Public APIs typed and documented as above.
- ✅ Screens closely match the provided reference screenshots (layout, colors, controls).
