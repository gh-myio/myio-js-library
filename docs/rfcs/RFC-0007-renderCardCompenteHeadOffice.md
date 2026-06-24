- Feature Name: `renderCardCompenteHeadOffice`
- Start Date: 2025-09-23
- RFC PR: [myio-js-library#TBD](https://github.com/gh-myio/myio-js-library/pull/TBD)
- Tracking Issue: [myio-js-library#TBD](https://github.com/gh-myio/myio-js-library/issues/TBD)

# Summary

Introduce a new, atomic UI component `renderCardCompenteHeadOffice` in the MYIO JS Library to render premium device cards inside ThingsBoard widgets used by MYIO SIM – Head Office dashboards. The component must visually match the reference screenshot (8 cards grid) and support status chips, primary metrics, efficiency progress bars, secondary metrics, actions via 3-dot menu, card-level click + selection checkbox, optional drag-and-drop, accessibility + keyboard navigation, and built-in CSS injection following the atomic component pattern used in the library.

The component's public entrypoint will be exported as:

```javascript
MyIOLibrary.renderCardCompenteHeadOffice(containerEl, props)
```

This allows direct calls from ThingsBoard widget JS without requiring extra CSS/JS assets.

# Motivation

## Consistency
Head Office dashboards need the same premium visual and UX as recent Energy/Water widgets to maintain brand consistency and user experience across the MYIO platform.

## Reusability
Current `renderCardComponentV2` is close but tailored to a different context; Head Office requires additional badges, different metric layout, and stricter atomic packaging to meet specific dashboard requirements.

## Velocity
Having an atomic, self-styled, versioned component reduces widget code size and speeds up delivery by eliminating the need for custom CSS and complex DOM manipulation in each widget.

## Safety
Standardized events (select, open dashboard, etc.) help avoid one-off DOM bugs in production widgets by providing a tested, consistent interface.

# Guide-level explanation

## What you get

A single call that draws a fully-styled, accessible card:

```javascript
const card = MyIOLibrary.renderCardCompenteHeadOffice(container, {
  entityObject,                 // device metadata + metrics
  handleActionDashboard,        // menu: open dashboard
  handleActionReport,           // menu: open report
  handleActionSettings,         // menu: open settings
  handleSelect,                 // checkbox toggled
  handInfo,                     // info icon clicked (optional)
  handleClickCard,              // card body clicked
  useNewComponents: true,
  enableSelection: true,
  enableDragDrop: true
});
```

It injects its own stylesheet (scoped by a unique root class), binds events, and returns a disposable handle:

```javascript
card.update(nextEntityObject); // re-render metrics, status, etc.
card.destroy();                // unbind events + remove DOM
```

## Visual anatomy (matching the screenshot)

**Header:**
- Left: Icon circle (device type)
- Title (labelOrName) + small device code (deviceIdentifier)
- Right: 3-dot menu

**Status Row:** rounded chip (e.g., "Em operação", "Alerta", "Falha", "Offline")

**Primary Metric:** large number (15.2 kW) + "Atual"

**Efficiency:** label "Eficiência", horizontal segmented bar, right-aligned %

**Footer (3 columns):**
- Temperature (thermometer icon) + value (28°C)
- "Tempo de operação" (clock icon) + humanized value (12.847h)
- "Atualizado" icon (tiny bolt/antenna) + relative time (optional)

Optional alert border (orange/red) around the card for Alert/Failure states.

## ThingsBoard usage snippet

```javascript
// inside widget controller.js
const root = document.getElementById('myio-cards-grid');

entities.forEach((entity) => {
  const cell = document.createElement('div');
  cell.className = 'myio-card-cell';
  root.appendChild(cell);

  const card = MyIOLibrary.renderCardCompenteHeadOffice(cell, {
    entityObject: entity,
    handleActionDashboard: (e, ent) => openDashboard(ent),
    handleActionReport: (e, ent) => openReport(ent),
    handleActionSettings: (e, ent) => openSettings(ent),
    handleSelect: (checked, ent) => toggleSelection(ent, checked),
    handInfo: (e, ent) => showInfo(ent),
    handleClickCard: (e, ent) => openQuickView(ent),
    useNewComponents: true,
    enableSelection: true,
    enableDragDrop: true
  });

  // Keep a reference if you'll update or dispose later
  gridCards.push(card);
});
```

# Reference-level explanation

## 1) Package layout

```
src/
  thingsboard/
    main-dashboard-shopping/
      v-4.0.0/
        card/
          template-card-v2.js
          head-office/
            card-head-office.js           // NEW (core)
            card-head-office.css.ts       // NEW (CSS string export)
            card-head-office.icons.ts     // NEW (inline SVGs)
            card-head-office.types.ts     // NEW (TS types JSDoc)
            index.js                      // NEW (re-export)
```

Public export in `src/index.ts`:

```typescript
export { renderCardCompenteHeadOffice } from './thingsboard/main-dashboard-shopping/v-4.0.0/card/head-office';
```

## 2) Function signature

```typescript
export function renderCardCompenteHeadOffice(
  containerEl: HTMLElement,
  params: {
    entityObject: EntityObject;
    handleActionDashboard?: (ev: Event, entity: EntityObject) => void;
    handleActionReport?: (ev: Event, entity: EntityObject) => void;
    handleActionSettings?: (ev: Event, entity: EntityObject) => void;
    handleSelect?: (checked: boolean, entity: EntityObject) => void;
    handInfo?: (ev: Event, entity: EntityObject) => void;
    handleClickCard?: (ev: Event, entity: EntityObject) => void;
    useNewComponents?: boolean;
    enableSelection?: boolean;
    enableDragDrop?: boolean;
    i18n?: Partial<I18NMap>; // optional labels override
  }
): {
  update(next: Partial<EntityObject>): void;
  destroy(): void;
  getRoot(): HTMLElement;
}
```

## 3) EntityObject (minimum)

```typescript
type EntityObject = {
  entityId: string;
  labelOrName: string;          // "Elevador Social Norte 01"
  deviceIdentifier?: string;    // "ELV-002"
  entityType?: string;          // "DEVICE"
  deviceType?: string;          // "ELEVATOR", "ESCADA_ROLANTE", "CHILLER", "PUMP", etc.
  slaveId?: string | number;
  ingestionId?: string | number;
  centralId?: string;
  centralName?: string;

  // Primary metric
  val?: number | null;          // e.g., current power (kW)
  valType?: 'power_kw' | 'flow_m3h' | 'temp_c' | 'custom';
  timaVal?: number | null;      // timestamp of val (ms)

  // Efficiency (0..100)
  perc?: number;

  // Status
  connectionStatus?: 'ONLINE' | 'OFFLINE' | 'ALERT' | 'FAILURE' | 'RUNNING' | 'PAUSED';
  connectionStatusTime?: number; // ms epoch

  // Secondary metrics
  temperatureC?: number | null;
  operationHours?: number | null; // e.g., 12.847 (hours)

  // Optional dictionary for updated IDs
  updatedIdentifiers?: Record<string, string>;
};
```

## 4) CSS & theming (atomic injection)

CSS is injected once per page with a guard (`data-myio-css="head-office-card-v1"`).

Variables for easy theming:

```css
:root {
  --myio-card-radius: 16px;
  --myio-card-shadow: 0 2px 8px rgba(10, 31, 68, .06);
  --myio-card-bg: #fff;
  --myio-card-border: #e9eef5;

  --myio-chip-ok-bg: #e8f7ff;
  --myio-chip-ok-fg: #007ecc;
  --myio-chip-alert-bg: #fff4e5;
  --myio-chip-alert-fg: #b96b00;
  --myio-chip-failure-bg: #ffeaea;
  --myio-chip-failure-fg: #b71c1c;

  --myio-text-1: #0f172a;
  --myio-text-2: #4b5563;
  --myio-muted: #94a3b8;

  --myio-eff-bar-bg: #e6edf5;
  --myio-eff-bar-a: #1e90ff; /* left segment */
  --myio-eff-bar-b: #a3d1ff; /* right filler */

  --myio-badge-border: rgba(255, 153, 0, .35); /* alert ring */
  --myio-badge-border-failure: rgba(244, 67, 54, .45);
}
```

The component root class is `.myio-ho-card` (BEM style inside). Alert/failure adds `.is-alert` or `.is-failure` which paints an outer soft ring, as in the screenshot.

## 5) DOM structure (BEM)

```html
<div class="myio-ho-card [is-alert|is-failure]" role="group" data-entity-id="...">
  <div class="myio-ho-card__header">
    <div class="myio-ho-card__icon" aria-hidden="true"><!-- inline SVG --></div>
    <div class="myio-ho-card__title">
      <div class="myio-ho-card__name">Escada Rolante Sul 02</div>
      <div class="myio-ho-card__code">ESC-001</div>
    </div>

    <div class="myio-ho-card__actions">
      <button class="myio-ho-card__kebab" aria-label="Open actions" aria-haspopup="menu">⋯</button>
      <div class="myio-ho-card__menu" role="menu" hidden>
        <button role="menuitem" data-action="dashboard">Dashboard</button>
        <button role="menuitem" data-action="report">Report</button>
        <button role="menuitem" data-action="settings">Settings</button>
      </div>
      <label class="myio-ho-card__select" hidden>
        <input type="checkbox" />
      </label>
    </div>
  </div>

  <div class="myio-ho-card__status">
    <span class="chip chip--ok">Em operação</span>
    <!-- or chip--alert / chip--failure / chip--offline -->
  </div>

  <div class="myio-ho-card__primary" role="button" tabindex="0">
    <div class="myio-ho-card__value">
      <span class="num">15.2</span><span class="unit">kW</span>
      <span class="suffix">Atual</span>
    </div>
  </div>

  <div class="myio-ho-card__eff">
    <div class="label">Eficiência</div>
    <div class="bar" aria-label="Eficiência 94%" aria-valuenow="94" aria-valuemin="0" aria-valuemax="100" role="progressbar">
      <div class="bar__fill" style="width:94%"></div>
    </div>
    <div class="perc">94%</div>
  </div>

  <div class="myio-ho-card__footer">
    <div class="metric">
      <i class="ico ico-temp" aria-hidden="true"></i>
      <div class="label">Temperatura</div>
      <div class="val">28°C</div>
    </div>
    <div class="metric">
      <i class="ico ico-clock" aria-hidden="true"></i>
      <div class="label">Tempo de operação</div>
      <div class="val">12.847h</div>
    </div>
    <div class="metric">
      <i class="ico ico-sync" aria-hidden="true"></i>
      <div class="label">Atualizado</div>
      <div class="val">15m</div>
    </div>
  </div>
</div>
```

## 6) Behavior

**Menu:** Clicking the kebab toggles a popover menu. Outside click or Esc closes it.

**Selection:** If `enableSelection` then a checkbox appears inside header; toggling calls `handleSelect(checked, entity)`.

**Card click:** Clicking the primary area (or pressing Enter on focus) triggers `handleClickCard`.

**Drag and drop:** If `enableDragDrop` then `draggable="true"` on root; emits custom events `myio:dragstart`, `myio:drop` with the `entityObject`.

**Status & ring:**
- RUNNING/ONLINE → blue chip (`chip--ok`)
- ALERT → amber chip + `.is-alert` border
- FAILURE → red chip + `.is-failure` border
- OFFLINE → gray chip

## 7) Formatting helpers

Leverage existing helpers in the LIB when available:

- `formatPowerKW(val)` → 15.2 kW
- `formatPercent(perc)` → 94%
- `formatTemperatureC(val)` → 28°C
- `formatHoursDecimal(val)` → 12.847h
- `timeSince(t)` → 7.405h or 15m

Fallback inline formatters included if helpers absent.

## 8) i18n (labels)

Default map (pt-BR baseline to match screenshot), overridable via `params.i18n`:

```typescript
type I18NMap = {
  in_operation: 'Em operação';
  alert: 'Alerta';
  failure: 'Falha';
  offline: 'Offline';
  efficiency: 'Eficiência';
  temperature: 'Temperatura';
  operation_time: 'Tempo de operação';
  updated: 'Atualizado';
  current_suffix: 'Atual';
  menu_dashboard: 'Dashboard';
  menu_report: 'Relatório';
  menu_settings: 'Configurações';
};
```

## 9) Accessibility

- Interactive elements are proper `<button>` or focusable containers with role and keyboard support.
- Progressbar uses `aria-valuenow`.
- Kebab menu uses `role="menu"` / `role="menuitem"`.
- High contrast ring for alert/failure; ensure WCAG AA against card background.

## 10) Performance

- No frameworks. Vanilla JS + inline SVG.
- Single CSS injection per page.
- Minimal reflows: progress width + text nodes updated in `update()`.
- Pool icons: SVGs are static constants.

## 11) Public API details

```javascript
const handle = MyIOLibrary.renderCardCompenteHeadOffice(container, params);

// Update only changed fields
handle.update({ val: 18.4, perc: 88, temperatureC: 27, operationHours: 7.405 });

// Dispose when removing card
handle.destroy();

// Root element for advanced integrations
const el = handle.getRoot();
```

## 12) Error handling

- If `containerEl` is null → throw informative error.
- If `entityObject.entityId` missing → warn and generate a temp id.
- NaN metrics: render `—` and do not break layout.

# Drawbacks

- **Maintenance overhead:** Adds another UI surface to maintain alongside `renderCardComponentV2`.
- **Bundle size:** The atomic CSS injection increases library bundle size slightly.
- **Complexity:** Additional component increases the overall complexity of the library.

# Rationale and alternatives

## Why this design?

**Reusing `renderCardComponentV2`** would require extensive overrides and CSS forks; a dedicated component reduces risk and keeps Head Office visuals stable.

**Web Components** were considered but avoided for ThingsBoard AngularJS compatibility and simplicity.

## What other designs have been considered?

**Alternative 1: Extend existing renderCardComponentV2**
- **Rationale for not choosing**: Would require extensive modifications and risk breaking existing implementations

**Alternative 2: CSS-only approach**
- **Rationale for not choosing**: Would not provide the atomic, self-contained behavior required

**Alternative 3: Framework-specific component**
- **Rationale for not choosing**: ThingsBoard compatibility requires vanilla JS approach

## What is the impact of not doing this?

- Continued inconsistency in Head Office dashboard visuals
- Increased development time for each new widget
- Higher maintenance burden with duplicated code
- Risk of UI bugs in production widgets

# Prior art

- `template-card-v2.js` (existing)
- MYIO Energy/Water premium widgets from 2024-2025
- Modern card component patterns in design systems

# Unresolved questions

1. **Icon mapping:** Final icon mapping for all deviceType strings (e.g., ESCADA_ROLANTE, ELEVADOR, CHILLER, PUMP, etc.). For now, ship a minimal set + fallback generic icon.

2. **Color tokens:** Final color tokens alignment with SIM design system.

3. **Performance:** Should we implement virtual scrolling for large card grids?

4. **Theming:** Should we support multiple theme variants beyond the default?

# Future possibilities

- **Compact/dense mode toggle**
- **Inline sparkline for the primary metric**
- **Contextual tooltips with last 24h delta**
- **Batch selection affordances**
- **Animation and transition effects**
- **Real-time metric updates via WebSocket**

# Security considerations

- **No outerHTML injection** from untrusted strings; `innerText` is used for user content.
- **Data attributes are sanitized** (only alphanumerics, dashes, underscores).
- **Event handlers are properly bound** and cleaned up to prevent memory leaks.

# Testing plan

## Unit (JSDOM)
- Renders with minimal `entityObject`
- Menu callbacks fire
- Efficiency bar width matches `perc`
- Status classes applied by `connectionStatus`
- `update()` mutates DOM without re-create

## Snapshot (Visual)
- Golden images for statuses: running, alert, failure, offline
- RTL vs LTR smoke check (if i18n switches in future)

## Manual in ThingsBoard
- Drag-and-drop between lists
- Multiple cards grid (8+) – layout stability
- Performance under frequent updates (1s interval)

# Acceptance criteria

- ✅ Exported as `MyIOLibrary.renderCardCompenteHeadOffice`
- ✅ Renders pixel-close to the provided screenshot (spacing, chip colors, borders, progress bar segments)
- ✅ Works without any external CSS/JS (atomic injection)
- ✅ Supports all callbacks and does not throw if optional
- ✅ Keyboard accessible (Tab/Enter/Esc)
- ✅ Handles ALERT and FAILURE with soft colored ring on the card
- ✅ Unit tests cover rendering, update, and events
- ✅ Example ThingsBoard snippet in docs

# Migration / Usage in widget JS

## Before (pseudo)
```javascript
renderCardComponentV2({ ... });
```

## After
```javascript
const node = document.createElement('div');
grid.appendChild(node);

const handle = MyIOLibrary.renderCardCompenteHeadOffice(node, {
  entityObject: {
    entityId: 'ELV-002',
    labelOrName: 'Elevador Social Norte 01',
    deviceIdentifier: 'ELV-002',
    deviceType: 'ELEVATOR',
    val: 22.8,
    valType: 'power_kw',
    perc: 89,
    connectionStatus: 'RUNNING',
    temperatureC: 26,
    operationHours: 8.934
  },
  handleActionDashboard: (_, ent) => openDashboard(ent),
  handleActionReport:    (_, ent) => openReport(ent),
  handleActionSettings:  (_, ent) => openSettings(ent),
  handleSelect:          (checked, ent) => toggleSelection(ent, checked),
  handInfo:              (_, ent) => showInfo(ent),
  handleClickCard:       (_, ent) => quickView(ent),
  useNewComponents: true,
  enableSelection: true,
  enableDragDrop: true
});
```

# Implementation sketch (high-level)

```javascript
// card-head-office.js
import { CSS_STRING } from './card-head-office.css';
import { Icons } from './card-head-office.icons';

const CSS_TAG = 'head-office-card-v1';

function ensureCss() {
  if (!document.querySelector(`style[data-myio-css="${CSS_TAG}"]`)) {
    const s = document.createElement('style');
    s.setAttribute('data-myio-css', CSS_TAG);
    s.textContent = CSS_STRING;
    document.head.appendChild(s);
  }
}

export function renderCardCompenteHeadOffice(container, params) {
  ensureCss();
  const state = normalizeParams(params);
  const root = buildDOM(state);
  container.appendChild(root);
  bindEvents(root, state, params);
  paint(root, state);

  return {
    update(next) {
      Object.assign(state.entityObject, next || {});
      paint(root, state);
    },
    destroy() {
      unbindEvents(root);
      root.remove();
    },
    getRoot() { return root; }
  };
}
```

The actual files will include full DOM build helpers, icon map by deviceType, and the complete CSS string.

# Rollout plan

1. **Implement** under `src/thingsboard/.../head-office/` with unit tests.
2. **Export** from `src/index.ts`.
3. **Release** `myio-js-library-PROD@x.y.z` (minor bump).
4. **Update** the Head Office widget JS to call `MyIOLibrary.renderCardCompenteHeadOffice`.
5. **Validate** in Homolog; then Production.

# Documentation

Add a "Head Office Cards" section to the library README:

- Installation/update note
- One minimal code sample
- Props reference (table)
- Theming via CSS variables
- Known deviceType → icon mapping
- Tips for ThingsBoard states (AngularJS context, no frameworks)
