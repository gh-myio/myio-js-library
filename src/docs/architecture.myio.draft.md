# MYIO JS Library - Architecture Document

> **Status:** Draft
> **Version:** 0.1.0
> **Last Updated:** 2026-02-13

---

## 1. Overview

MYIO JS Library (`myio-js-library`) is a component library for ThingsBoard dashboards, specialized in monitoring energy, water, and temperature systems for shopping malls and commercial buildings (BAS - Building Automation Systems).

### 1.1 Core Purpose

- Provide reusable UI components for ThingsBoard HTML widgets
- Standardize device classification and status handling
- Enable event-driven communication between dashboard components
- Support BAS (Building Automation System) dashboards
- Integrate with Myio Ingestion API for telemetry data

### 1.2 Technology Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript / JavaScript (ES6+) |
| Build | tsup (ESM/CJS) + custom UMD bundler |
| Target | Browser (ThingsBoard widgets) |
| Styling | CSS-in-JS (injected styles) |
| Package | npm (`myio-js-library`) |
| Backend | Myio Ingestion API (REST) |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MYIO Ecosystem                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   IoT Devices   │───▶│   ThingsBoard   │───▶│  MYIO Ingestion │         │
│  │  (Meters, etc.) │    │   (Platform)    │    │      API        │         │
│  └─────────────────┘    └────────┬────────┘    └────────┬────────┘         │
│                                  │                      │                   │
│                                  ▼                      ▼                   │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                       ThingsBoard Dashboard                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │  HTML Widget │  │  HTML Widget │  │  HTML Widget │                 │ │
│  │  │  (MAIN_BAS)  │  │   (HEADER)   │  │    (MENU)    │                 │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                 │ │
│  │         │                 │                 │                          │ │
│  │         ▼                 ▼                 ▼                          │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │                  MyIOLibrary (UMD Bundle)                       │   │ │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │   │ │
│  │  │  │Components │ │  Utils    │ │  Events   │ │ Ingestion │       │   │ │
│  │  │  │           │ │           │ │           │ │  Client   │       │   │ │
│  │  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  │                                │                                       │ │
│  │                                ▼                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │              Window Event Bus (CustomEvent)                     │   │ │
│  │  │    myio:data-ready | myio:filter-applied | bas:device-clicked  │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure

```
src/
├── components/                    # Reusable UI Components
│   ├── card-grid-panel/           # CardGridPanel - Grid of device/ambiente cards
│   ├── device-grid-v6/            # DeviceGridV6 - Alternative device grid
│   ├── entity-list-panel/         # EntityListPanel - Sidebar list component
│   ├── header-panel/              # HeaderPanelComponent - Reusable header
│   ├── template-card-v6/          # Device card component
│   ├── template-card-ambiente-v6/ # Ambiente card with aggregated data
│   ├── menu/                      # MenuView - Navigation sidebar
│   └── premium-modals/            # Modal components (Welcome, Settings)
│
├── thingsboard/                   # ThingsBoard Widget Controllers
│   ├── bas-components/            # BAS Dashboard widgets
│   │   └── MAIN_BAS/              # Main BAS controller
│   │       ├── controller.js      # Widget logic
│   │       ├── template.html      # HTML structure
│   │       └── styles.css         # Layout styles only
│   └── MYIO-SIM/                  # Legacy controllers
│
├── utils/                         # Utility Functions
│   ├── deviceInfo.js              # Domain/context detection
│   ├── deviceStatus.js            # Status classification
│   ├── deviceItem.js              # Device type helpers
│   ├── equipmentCategory.js       # Energy equipment categorization
│   └── formatters.js              # Value formatting
│
├── docs/                          # Documentation
│   ├── rfcs/                      # RFC documents
│   └── api-1.json                 # Ingestion API OpenAPI spec
│
└── index.ts                       # Library exports
```

---

## 4. Component Architecture

### 4.1 Component Pattern

All components follow a consistent pattern:

```typescript
// 1. Types/Interfaces
export interface ComponentOptions {
  title: string;
  items: Item[];
  handleClick?: (item: Item) => void;
}

// 2. CSS (injected once)
const CSS_ID = 'myio-component-styles';
const COMPONENT_CSS = `
  .myio-comp { ... }
  .myio-comp__header { ... }
  .myio-comp__body { ... }
`;

function injectStyles(): void {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = COMPONENT_CSS;
  document.head.appendChild(style);
}

// 3. Component Class
export class Component {
  private root: HTMLElement;
  private options: ComponentOptions;

  constructor(options: ComponentOptions) {
    injectStyles();
    this.options = options;
    this.root = document.createElement('div');
    this.root.className = 'myio-comp';
    this.render();
  }

  public getElement(): HTMLElement { return this.root; }
  public setItems(items: Item[]): void { ... }
  public destroy(): void { this.root.remove(); }
  private render(): void { ... }
}
```

### 4.2 CSS Naming Convention (BEM-like)

```css
.myio-{component}                    /* Root element */
.myio-{component}__header            /* Child element */
.myio-{component}__body
.myio-{component}--dark              /* Modifier */
.myio-{component}--single-column
```

### 4.3 Component Hierarchy

```
CardGridPanel
├── HeaderPanelComponent (title, search, filter, tabs)
├── Grid Container (.myio-cgp__grid)
│   └── Card Wrappers (.myio-cgp__card-wrapper)
│       └── renderCardComponentV6() or renderCardAmbienteV6()
└── Empty State (.myio-cgp__empty)

EntityListPanel
├── HeaderPanelComponent (title, search)
└── List (.myio-elp__list)
    └── Items (.myio-elp__item)

DeviceGridV6
├── Header (.myio-dgv6__header)
│   ├── Title + Count
│   ├── Search
│   └── Sort Select
└── Grid (.myio-dgv6__grid)
    └── Card Wrappers
```

### 4.4 Key Component Options

#### CardGridPanel

| Option | Type | Description |
|--------|------|-------------|
| `title` | string | Panel title |
| `icon` | string | Emoji or SVG icon |
| `items` | CardGridItem[] | Cards to render |
| `cardType` | 'device' \| 'ambiente' | Card rendering type |
| `singleColumn` | boolean | Force single column layout |
| `maxCardWidth` | string | Max card width (e.g., '200px') |
| `gridMinCardWidth` | string | Min card width for auto-fill |
| `gridGap` | string | Gap between cards |
| `theme` | 'light' \| 'dark' | Color theme |

#### EntityListPanel

| Option | Type | Description |
|--------|------|-------------|
| `title` | string | Panel title |
| `items` | EntityListItem[] | List items |
| `theme` | 'light' \| 'dark' | Color theme |
| `selectedId` | string | Currently selected item |
| `sortOrder` | 'asc' \| 'desc' \| 'none' | Sort order |

---

## 5. ThingsBoard Integration

### 5.1 Widget Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    ThingsBoard Widget Lifecycle                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   onInit()                    onDataUpdated()                   │
│      │                             │                             │
│      │  ┌──────────────────────────┤                             │
│      │  │ Can fire DURING onInit!  │                             │
│      ▼  ▼                          ▼                             │
│   ┌─────────────────┐        ┌─────────────────┐                │
│   │ Register event  │        │ Process data    │                │
│   │ handlers FIRST  │        │ Update cache    │                │
│   └────────┬────────┘        │ Dispatch events │                │
│            │                 └─────────────────┘                │
│            ▼                                                     │
│   ┌─────────────────┐                                           │
│   │ await async ops │                                           │
│   │ (fetch config)  │                                           │
│   └────────┬────────┘                                           │
│            ▼                                                     │
│   ┌─────────────────┐                                           │
│   │ Mount components│                                           │
│   │ Check cache     │                                           │
│   └─────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Module-Level Caching Pattern (RFC-0126)

**Problem:** `onDataUpdated` can fire DURING `onInit` async operations, before components are mounted.

**Solution:** Cache data at module level, check cache after component creation.

```javascript
// CRITICAL: Register handlers at module scope BEFORE async operations
let _cachedClassified = null;
let _componentRef = null;

// Handler registered immediately
window.addEventListener('myio:data-ready', (e) => {
  if (e.detail?.classified) _cachedClassified = e.detail.classified;

  // Update component if already mounted
  if (_componentRef) {
    _componentRef.setItems(buildItems(_cachedClassified));
  }
});

// onInit
self.onInit = async function() {
  await fetchSettings();  // Async operation

  // Mount component
  _componentRef = new CardGridPanel({ ... });

  // Check cache for data that arrived during async
  if (_cachedClassified) {
    _componentRef.setItems(buildItems(_cachedClassified));
  }
};
```

### 5.3 Widget File Structure

```
MAIN_BAS/
├── controller.js    # Widget logic (onInit, onDataUpdated, helpers)
├── template.html    # HTML structure (slots for components)
└── styles.css       # Layout styles ONLY (no component styles)
```

**Key Principle:** Component styles live in the component. Widget styles only handle:
- Slot layout (grid areas, flex)
- ThingsBoard container overrides
- Widget-specific layout adjustments

---

## 6. Event-Driven Architecture

### 6.1 Event Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  MAIN Controller │     │   Window Events  │     │  Other Widgets   │
│                  │     │                  │     │  (Menu, Header)  │
│  onDataUpdated() │────▶│ myio:data-ready  │────▶│  Handle event    │
│                  │     │                  │     │  Update UI       │
│  classifyDevices │     │ myio:*-ready     │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                                                 │
         │              ┌──────────────────┐               │
         └─────────────▶│ myio:filter-     │◀──────────────┘
                        │ applied          │
                        └──────────────────┘
```

### 6.2 Event Catalog

| Event | Payload | Purpose |
|-------|---------|---------|
| `myio:data-ready` | `{ classified, shoppings }` | Raw classified data available |
| `myio:energy-summary-ready` | `{ byStatus, byCategory, total }` | Energy KPIs calculated |
| `myio:water-summary-ready` | `{ byStatus, byCategory, total }` | Water KPIs calculated |
| `myio:temperature-data-ready` | `{ devices, summary }` | Temperature data ready |
| `myio:equipment-count-updated` | `{ counts }` | Equipment counts updated |
| `myio:customers-ready` | `{ customers }` | Shopping list available |
| `myio:filter-applied` | `{ domain, filters }` | User applied filter |
| `bas:device-clicked` | `{ device }` | Device card clicked |
| `bas:ambiente-clicked` | `{ ambiente }` | Ambiente card clicked |

---

## 7. Device Classification System

### 7.1 Domain/Context Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        Device Classification                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Domain: ENERGY                                                  │
│  ├── entrada        (ENTRADA, RELOGIO, TRAFO, SUBESTACAO)       │
│  ├── stores         (3F_MEDIDOR exact match)                    │
│  ├── equipments     (3F_MEDIDOR with classification)            │
│  ├── motor          (MOTOR devices)                             │
│  └── bomba          (BOMBA_HIDRAULICA devices)                  │
│                                                                  │
│  Domain: WATER                                                   │
│  ├── hidrometro_entrada                                         │
│  ├── hidrometro_area_comum                                      │
│  ├── hidrometro                                                 │
│  ├── banheiros                                                  │
│  ├── caixa_dagua    (CAIXA_DAGUA, TANK)                        │
│  └── solenoide      (SOLENOIDE valves)                         │
│                                                                  │
│  Domain: TEMPERATURE                                             │
│  ├── termostato                                                 │
│  └── termostato_external                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Classification Functions

```javascript
import { detectDomain, detectContext, detectDomainAndContext } from 'myio-js-library';

const { domain, context } = detectDomainAndContext(device);
// domain: 'energy' | 'water' | 'temperature'
// context: 'equipments' | 'stores' | 'entrada' | 'hidrometro' | etc.
```

### 7.3 Status Classification

```javascript
const ONLINE_STATUSES = ['power_on', 'online', 'normal', 'ok', 'running', 'active'];
const OFFLINE_STATUSES = ['offline', 'no_info'];
const WAITING_STATUSES = ['waiting', 'aguardando', 'not_installed', 'pending'];
const WEAK_STATUSES = ['weak_connection', 'conexao_fraca', 'bad'];
```

### 7.4 Energy Equipment Subcategorization (RFC-0128)

| Category | Classification Rule | Icon |
|----------|---------------------|------|
| Entrada | ENTRADA, RELOGIO, TRAFO, SUBESTACAO | 📥 |
| Lojas | 3F_MEDIDOR (exact match) | 🏬 |
| Climatizacao | CHILLER, FANCOIL, HVAC, AR_CONDICIONADO | ❄️ |
| Elevadores | ELEVADOR or identifier starts with ELV- | 🛗 |
| Escadas Rolantes | ESCADA_ROLANTE or identifier starts with ESC- | 🎢 |
| Outros | Remaining 3F_MEDIDOR equipment | ⚙️ |
| Area Comum | Calculated: Entrada - (sum of others) | 🏢 |

---

## 8. Myio Ingestion API

### 8.1 Overview

The Myio Ingestion API provides access to aggregated telemetry data from IoT devices. It complements ThingsBoard's real-time data with historical aggregations and analytics.

**Base URLs:**
- Production: `https://api.ingestion.myio-bas.com`
- Staging: `https://staging.ingestion.myio-bas.com`

### 8.2 Authentication

```javascript
// 1. Authenticate
const response = await fetch('/api/v1/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret'
  })
});

const { access_token } = await response.json();

// 2. Use token in subsequent requests
const data = await fetch('/api/v1/telemetry/devices/{id}/energy', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
```

### 8.3 Telemetry Endpoints

| Endpoint | Tier | Description |
|----------|------|-------------|
| `GET /api/v1/telemetry/devices/{id}/{type}` | Light | Single device telemetry |
| `GET /api/v1/telemetry/assets/{id}/{type}` | Heavy | Asset aggregation |
| `GET /api/v1/telemetry/customers/{id}/{type}` | Heavy | Customer aggregation |
| `GET /api/v1/telemetry/devices/{id}/{type}/total` | Light | Device total |
| `GET /api/v1/telemetry/assets/{id}/{type}/total` | Heavy | Asset total |
| `GET /api/v1/telemetry/customers/{id}/{type}/total` | Heavy | Customer total |
| `GET /api/v1/telemetry/customers/{id}/{type}/devices/totals` | Heavy | All device totals |

**Reading Types:** `energy` (kWh) | `water` (m³)

**Granularities:** `1h` (hourly) | `1d` (daily)

### 8.4 Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `startTime` | ISO 8601 | Start of time range |
| `endTime` | ISO 8601 | End of time range |
| `granularity` | string | `1h` or `1d` |
| `timezone` | string | IANA timezone (optional) |

### 8.5 Rate Limiting

| Tier | Limit | Window | Applied To |
|------|-------|--------|------------|
| Authentication | 5 | 15 min | Login endpoints |
| Light | 120 | 1 min | Single device queries |
| Standard | 60 | 1 min | List operations |
| Heavy | 20 | 1 min | Aggregations |
| Write | 30 | 1 min | Create/update/delete |
| Backfill | 5 | 1 hour | Data gap filling |

**Response Headers:**
```
RateLimit-Limit: 120
RateLimit-Policy: 120;w=60
RateLimit-Remaining: 117
RateLimit-Reset: 1704067200
```

### 8.6 Time Filters

Pre-defined time filter presets for common queries:

```javascript
// Get available time filters
const filters = await fetch('/api/v1/time-filters');

// Get specific filter by ID or slug
const filter = await fetch('/api/v1/time-filters/last-7-days');
```

### 8.7 Example: Fetch Energy Data

```javascript
async function fetchEnergyData(deviceId, startDate, endDate) {
  const params = new URLSearchParams({
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    granularity: '1h'
  });

  const response = await fetch(
    `${API_BASE}/api/v1/telemetry/devices/${deviceId}/energy?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
  }

  return response.json();
}
```

### 8.8 Response Format

```json
{
  "data": [
    {
      "timestamp": "2025-06-15T14:00:00-03:00",
      "value": 125.5,
      "unit": "kWh"
    },
    {
      "timestamp": "2025-06-15T15:00:00-03:00",
      "value": 130.2,
      "unit": "kWh"
    }
  ],
  "metadata": {
    "deviceId": "device-123",
    "startTime": "2025-06-15T00:00:00-03:00",
    "endTime": "2025-06-15T23:59:59-03:00",
    "granularity": "1h",
    "timezone": "America/Sao_Paulo"
  }
}
```

---

## 9. Data Flow

### 9.1 ThingsBoard to UI Flow

```
┌─────────────────┐
│   ThingsBoard   │
│   Datasource    │
└────────┬────────┘
         │ raw telemetry
         ▼
┌─────────────────┐
│  onDataUpdated  │
│  (controller.js)│
└────────┬────────┘
         │ collectedData
         ▼
┌─────────────────┐
│ classifyDevices │──────────────────┐
│ ()              │                  │
└────────┬────────┘                  │
         │ classified                │
         ▼                           ▼
┌─────────────────┐        ┌─────────────────┐
│ buildCardItems  │        │ dispatchEvent   │
│ ()              │        │ myio:data-ready │
└────────┬────────┘        └─────────────────┘
         │ CardGridItem[]
         ▼
┌─────────────────┐
│ CardGridPanel   │
│ .setItems()     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ renderCard      │
│ ComponentV6()   │
└─────────────────┘
```

### 9.2 EntityObject Structure

```typescript
interface EntityObject {
  // Identity
  id: string;
  name: string;
  label: string;

  // Classification
  deviceType: string;
  deviceProfile: string;
  context: string;
  domain: string;

  // Status
  status: string;
  connectionStatus: string;

  // Telemetry (varies by domain)
  value?: number;
  unit?: string;
  consumption?: number;
  temperature?: number;
  setpoint?: number;
  level?: number;

  // Special fields
  solenoidStatus?: string;  // For SOLENOIDE devices
}
```

---

## 10. Styling Strategy

### 10.1 Style Ownership

| Owner | Responsibility |
|-------|----------------|
| **Component** (CardGridPanel.ts) | Grid, card layout, card styling, spacing |
| **Widget** (styles.css) | Slot layout, ThingsBoard overrides, grid areas |

### 10.2 CSS Variable System

```css
/* CardGridPanel CSS Variables */
--cgp-min-card-w: 140px;      /* Minimum card width in grid */
--cgp-grid-gap: 16px;          /* Gap between cards */
--cgp-max-card-w: none;        /* Maximum card width */
```

### 10.3 Style Injection

```typescript
const CSS_ID = 'myio-cgp-styles';

function injectStyles(): void {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
}
```

---

## 11. Build System

### 11.1 Build Pipeline

```
TypeScript Source → tsup (ESM/CJS) → UMD Bundler → Minify (terser)
                         ↓                ↓              ↓
                   dist/index.js   dist/umd/*.js   dist/umd/*.min.js
```

### 11.2 Build Commands

```bash
npm run build           # Full build (clean + tsup + umd + minify)
npm run build:tsup      # ESM/CJS build only
npm run build:umd       # UMD bundle only
npm version patch       # Bump version
npm publish             # Publish to npm
```

### 11.3 Output Formats

| Format | File | Usage |
|--------|------|-------|
| ESM | `dist/index.js` | Modern bundlers |
| CJS | `dist/index.cjs` | Node.js, legacy bundlers |
| UMD | `dist/umd/myio-js-library.min.js` | ThingsBoard widgets (CDN) |

---

## 12. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **CSS-in-JS** | ThingsBoard widgets are isolated; styles must be self-contained |
| **Event-Driven** | Widgets are independent; loose coupling enables flexibility |
| **Module-Level Caching** | `onDataUpdated` can fire during `onInit` async operations |
| **deviceProfile over deviceType** | `deviceProfile` is more specific (user-defined) |
| **Component owns styles** | Single source of truth; no style conflicts |

---

## 13. RFC Index

| RFC | Title | Status |
|-----|-------|--------|
| RFC-0111 | Unified device domain/context classification | Implemented |
| RFC-0126 | MenuShoppingFilterSync (timing issues) | Implemented |
| RFC-0127 | CustomerCardComponent | Implemented |
| RFC-0128 | Energy equipment subcategorization | Implemented |
| RFC-0168 | ASSET_AMBIENT hierarchy for ambientes | Implemented |
| RFC-0171 | GetDeviceProfileByDevice | Draft |
| RFC-0173 | Sidebar menu layout | Implemented |
| RFC-0174 | Chart panel tabs | Implemented |
| RFC-0175 | Card grid spacing | Implemented |

---

## 14. Glossary

| Term | Definition |
|------|------------|
| **BAS** | Building Automation System |
| **Domain** | High-level device category (energy, water, temperature) |
| **Context** | Specific device role within a domain |
| **Classified** | Object containing devices organized by domain/context |
| **EntityObject** | Normalized device data structure for card rendering |
| **Slot** | HTML container element for mounting components |
| **Widget** | ThingsBoard HTML widget with controller, template, styles |
| **Ingestion API** | Myio's backend API for aggregated telemetry data |
