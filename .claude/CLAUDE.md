# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# MYIO JS Library - Project Context

## Overview

MYIO JavaScript library (`myio-js-library`) — a component library and ThingsBoard widget collection for shopping mall energy, water, and temperature monitoring dashboards.

## Build Commands

```bash
npm run build           # Full build: clean → tsup (ESM/CJS/DTS) → rollup (UMD) → terser (min) → copy-dts
npm run build:tsup      # ESM/CJS/DTS only (via tsup)
npm run build:umd       # UMD bundle only (via rollup)
npm run lint            # ESLint
npm run test            # Vitest (single run)
npm run dev:test        # Vitest (watch mode)
npm run smoke-test      # Import/function sanity check on all build formats
npm run bundle-analyze  # Rollup visualizer (set ANALYZE=1)
npm version patch       # Bump version
npm run release         # build + publish
```

**Bundle size limits** (enforced by `scripts/size-check.js`): ESM/CJS ≤50KB, UMD ≤60KB, minified UMD ≤25KB (gzipped ≤26KB via `scripts/check-bundle-size.mjs`).

## Project Structure

```
src/
├── index.ts                        # Library public API (~1400 lines of exports)
├── components/                     # Reusable UI components (TypeScript + JS)
│   ├── alarms/ AlarmsNotificationsPanel/
│   ├── card-grid-panel/ device-grid-v6/ telemetry-grid-shopping/
│   ├── customer-card-v1/ customer-card-v2/
│   ├── fancoil-remote/ filter-modal/ filterable-grid/
│   ├── energy-panel/ footer/ menu/ header/
│   ├── premium-modals/
│   │   ├── settings/               # SettingsModal with tabs: Annotations, Alarms
│   │   │   ├── alarms/AlarmsTab.ts
│   │   │   └── annotations/AnnotationsTab.ts
│   │   ├── welcome/WelcomeModalView.ts
│   │   └── report-all/AllReportModal.ts
│   └── ...
├── thingsboard/                    # Production ThingsBoard widget code
│   └── main-dashboard-shopping/
│       ├── v-5.2.0/WIDGET/         # Current production version
│       │   ├── MAIN_VIEW/controller.js   # Orchestrator, AlarmServiceOrchestrator
│       │   ├── TELEMETRY/controller.js   # Device cards + alarm badge
│       │   ├── MENU/controller.js
│       │   ├── HEADER/controller.js
│       │   ├── ALARM/
│       │   └── FOOTER/
│       └── v-5.4.0/controller.js   # Uses TelemetryGridShoppingView component
├── MYIO-SIM/v5.2.0/               # Standalone simulators for showcase/dev (no live TB)
│   └── MAIN_UNIQUE_DATASOURCE/    # Unified datasource simulator
├── utils/                          # deviceInfo.js, equipmentCategory.js, etc.
├── classify/ codec/ csv/ date/ format/ net/ services/ types/
├── docs/rfcs/                      # RFC-0001 … RFC-0183
└── NODE-RED/                       # Node-RED integrations (not part of npm package)
```

**`src/thingsboard/`** = real ThingsBoard widget controllers deployed in production.
**`src/MYIO-SIM/`** = simulators that run without a live ThingsBoard (used in showcase HTMLs).

## Tests

- Framework: **Vitest** with jsdom + `tests/setup.js`
- Test files live under `tests/` (not `src/`)
- Run a specific test file: `npx vitest run tests/path/to/file.test.ts`

## Key Files

| File | Description |
|------|-------------|
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` | Main widget: orchestrator, AlarmServiceOrchestrator, buildMetadataMapFromCtxData |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js` | Device cards widget, alarm badge, STATE.itemsBase |
| `src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js` | Grid controller using TelemetryGridShoppingView |
| `src/components/telemetry-grid-shopping/TelemetryGridShoppingView.ts` | Device card grid component (v5.4.0) |
| `src/components/menu/MenuView.ts` | Navigation + filter modal |
| `src/components/header/createHeaderComponent.ts` | Header KPI cards with tooltips |
| `src/components/premium-modals/settings/alarms/AlarmsTab.ts` | Alarms tab (RFC-0180) |
| `src/components/premium-modals/settings/annotations/AnnotationsTab.ts` | Device annotations |
| `src/components/premium-modals/report-all/AllReportModal.ts` | All-report modal (RFC-0182) |
| `src/utils/deviceInfo.js` | Domain/context detection (RFC-0111) |
| `src/utils/equipmentCategory.js` | Energy equipment subcategorization (RFC-0128) |
| `src/index.ts` | Library public exports |
| `showcase/main-view-shopping/index.html` | Primary showcase (RFC-0182, RFC-0183) |

## Key Patterns

### 1. ThingsBoard Widget Lifecycle

- `onInit()` — runs once on widget load (async operations go here)
- `onDataUpdated()` — fires when datasource data changes; **can fire DURING `onInit` awaits**

**Critical**: Register module-level event handlers BEFORE any `await` in `onInit` to avoid missing events dispatched during async operations.

### 2. Module-Level Caching (RFC-0126)

```javascript
// At module scope — before any async onInit code
let _cachedShoppings = [];
let _menuInstanceRef = null;

window.addEventListener('myio:data-ready', (e) => {
  if (e.detail?.shoppings) _cachedShoppings = e.detail.shoppings;
  if (_menuInstanceRef) _menuInstanceRef.updateShoppings?.(_cachedShoppings);
});
```

### 3. Event-Driven Architecture

Events dispatched by `MAIN_VIEW` controller:

| Event | Payload |
|-------|---------|
| `myio:data-ready` | Raw classified data, `shoppings` list |
| `myio:energy-summary-ready` | Energy KPIs: `byStatus`, `byCategory` |
| `myio:water-summary-ready` | Water KPIs: `byStatus`, `byCategory` |
| `myio:temperature-data-ready` | Temperature devices array |
| `myio:equipment-count-updated` | Equipment counts |
| `myio:customers-ready` | Shopping list |
| `myio:filter-applied` | Active filter |

### 4. AlarmServiceOrchestrator (RFC-0183)

Created in `MAIN_VIEW` after `_prefetchCustomerAlarms()`:

```javascript
window.AlarmServiceOrchestrator = {
  deviceAlarmMap: Map<gcdrDeviceId, GCDRAlarm[]>,
  getAlarmCountForDevice(gcdrDeviceId) { ... },
  refresh() { ... }  // re-fetches and rebuilds maps
};
```

`gcdrDeviceId` propagation chain: `ctx.data` → `buildMetadataMapFromCtxData` (key: `gcdrdeviceid`) → `meta.gcdrDeviceId` → `STATE.itemsBase[].gcdrDeviceId`.

### 5. Shadow DOM Button Binding

`ModalHeader.createController` uses `document.getElementById()` which fails in shadow DOM. Use `this.root.querySelector()` with a guard:

```typescript
private bindUnifiedModalButtonsFallback(): void {
  const closeBtn = this.root.querySelector('#menuUnified-close');
  if (closeBtn && !closeBtn.hasAttribute('data-bound')) {
    closeBtn.setAttribute('data-bound', 'true');
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.closeUnifiedModal(); });
  }
}
```

### 6. Device Classification

**Domain/Context** (RFC-0111):

| Domain | Contexts | Rule |
|--------|----------|------|
| `energy` | `equipments`, `stores`, `entrada` | deviceType/Profile = 3F_MEDIDOR or ENTRADA/RELOGIO/TRAFO/SUBESTACAO |
| `water` | `hidrometro_entrada`, `banheiros`, `hidrometro_area_comum`, `hidrometro` | deviceType includes HIDROMETRO |
| `temperature` | `termostato`, `termostato_external` | deviceType includes TERMOSTATO |

**Status values** from `calculateDeviceStatusMasterRules`:
- Online: `power_on`, `online`, `normal`, `ok`, `running`, `active`
- Offline: `offline`, `no_info`
- Waiting: `waiting`, `aguardando`, `not_installed`, `pending`, `connecting`
- Weak: `weak_connection`, `conexao_fraca`, `bad`

### 7. Energy Equipment Subcategorization (RFC-0128)

| Category | Rule |
|----------|------|
| Entrada | ENTRADA, RELOGIO, TRAFO, SUBESTACAO in deviceType/Profile |
| Lojas | deviceType = deviceProfile = `3F_MEDIDOR` exact match |
| Climatizacao | CHILLER, FANCOIL, HVAC, AR_CONDICIONADO, BOMBA_CAG, or identifier contains CAG |
| Elevadores | ELEVADOR or identifier starts with `ELV-` |
| Escadas Rolantes | ESCADA_ROLANTE or identifier starts with `ESC-` |
| Outros | Remaining 3F_MEDIDOR |
| Area Comum | Calculated: Entrada − (Lojas + Climatizacao + Elevadores + Esc. Rolantes + Outros) |

### 8. AllReportModal Filter (RFC-0182)

`StoreItem.id` = device `ingestionId` (GCDR API `api.item.id`). Filter uses `orchIdSet`:

```javascript
const orchIdSet = new Set(itemsList.map(item => String(item.id)));
// filters API response: only include items whose id is in orchIdSet
```

### 9. Device Annotation Schema

Key fields per annotation: `id`, `version`, `text`, `type` (`observation`|`issue`|`maintenance`|`alert`), `importance` (1–5), `status`, `createdAt/By`, `acknowledged/By/At`, `responses[]` (type: `approved`|`rejected`|`comment`|`resolved`), `history[]` (actions: `created`|`approved`|`rejected`|`edited`|`deleted`|`archived`).

**Business rule**: Annotations with `status = approved | rejected` can always be archived (removed from active view, preserved in history).

## Global Objects (`window.*`)

| Global | Description |
|--------|-------------|
| `window.MyIOOrchestrator` | Main orchestrator (TB data + API) |
| `window.AlarmServiceOrchestrator` | Device×alarm map (RFC-0183) |
| `window.MyIOLibrary` | Compiled library exports |
| `window.MyIOUtils` | Shared utilities (LogHelper, classifyDevice, etc.) |
| `window.STATE` | Dashboard state by domain (energy/water/temperature) |

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Components show zeros/empty data | `onDataUpdated` fired before component created | Cache at module level; check cache after creation |
| Modal buttons don't work | `document.getElementById()` fails in shadow DOM | Use `this.root.querySelector()` with `data-bound` guard |
| Tooltips show all status as "normal" | Hardcoded status data | Use `buildTooltipStatusData()` or `buildByStatusFromDevices()` |
| Shoppings list empty in menu | Event handler registered after event dispatch | Register handler at module scope before any `await` |
| `gcdrDeviceId` not in item | Key casing in `buildMetadataMapFromCtxData` | Check `else if (keyName === 'gcdrdeviceid')` branch |

## Showcase

HTML demos in `showcase/`. Open after starting a local server:

```bash
# From repo root, serve and open a showcase
npx serve . # or any static server
# Then open showcase/main-view-shopping/index.html in browser
```

## Documentation

RFCs in `src/docs/rfcs/`. Recent key RFCs:

| RFC | Subject |
|-----|---------|
| RFC-0111 | Unified device domain/context classification |
| RFC-0126 | MenuShoppingFilterSync (timing / module-level caching) |
| RFC-0128 | Energy equipment subcategorization |
| RFC-0180 | NewAlarmsTab in SettingsModal |
| RFC-0181 | ReportsMenuItem in MENU widget |
| RFC-0182 | OrchestratorGroupClassification + AllReportModal API filter |
| RFC-0183 | AlarmServiceOrchestrator + AlarmBadge |

Onboarding guide: `src/docs/ONBOARDING-ECOSYSTEM-GCDR-ALARMS.md`

## Current Version

- Version: `0.1.413`
- Main branch: `main`
- Active branch: `fix/rfc-0152-real-data`
