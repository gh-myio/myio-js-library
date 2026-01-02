# RFC 0113: Header Component Library

- Feature Name: `header_component`
- Start Date: 2026-01-02
- RFC PR: (to be assigned)
- Status: **Draft**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0111 (MAIN_UNIQUE_DATASOURCE), RFC-0114 (Menu), RFC-0105 (InfoTooltip)

---

## Summary

This RFC documents the reverse-engineering of the existing HEADER widget (`src/MYIO-SIM/v5.2.0/HEADER/`) and proposes extracting its functionality into a reusable **HeaderComponent** in the MYIO library. The header provides KPI summary cards, shopping filter modal, and contextual tooltips for the Head Office dashboard.

---

## Motivation

### Current State: HEADER Widget (v5.2.0)

The existing HEADER widget (`src/MYIO-SIM/v5.2.0/HEADER/`) is a ThingsBoard widget that provides:

1. **KPI Summary Cards**: Equipment, Energy, Temperature, Water
2. **Shopping Filter Modal**: Multi-select shopping centers with presets
3. **InfoTooltips**: Detailed breakdowns for each KPI card
4. **Brand Logo**: Back-to-home navigation button
5. **Card Customization**: Background/font colors from widget settings

### Problem

The HEADER functionality is tightly coupled to ThingsBoard widget system. With RFC-0111's architecture:

1. **Library Component**: Need standalone component callable from any widget
2. **Consistent API**: Follow existing library patterns
3. **Reusability**: Support multiple dashboard contexts
4. **Event-Driven**: React to orchestrator events for data updates

### Goals

1. Extract HEADER logic into `createHeaderComponent()` library function
2. Expose via `src/index.ts` for consumption
3. Support data updates via CustomEvents
4. Maintain feature parity with existing widget
5. Integrate with RFC-0105 InfoTooltip system

---

## Guide-level Explanation

### Existing HEADER Widget Structure

```
src/MYIO-SIM/v5.2.0/HEADER/
├── controller.js          # Widget logic (~1200+ lines)
├── template.html          # HTML structure (115 lines)
├── styles.css             # CSS styles
├── settings.schema.json   # Widget settings
└── base.json              # Widget definition
```

### Current Features (Reverse Engineering)

#### 1. KPI Summary Cards

```html
<!-- Template Structure -->
<section class="myio-toolbar-root">
  <div class="myio-cards">
    <!-- Logo Card with back button -->
    <article class="myio-card v2 myio-card-logo">
      <button class="myio-back-btn" id="back-to-welcome-btn">
        <svg><!-- Home icon --></svg>
      </button>
      <div class="logo-box">
        <img src="/api/images/public/..." alt="MYIO Logo" />
      </div>
    </article>

    <!-- Equipment Card -->
    <article class="myio-card v2" id="card-equip">
      <header class="myio-card-hd">
        <span class="hd-title">Equipamentos
          <span class="equip-info-trigger" id="equip-info-trigger">ℹ️</span>
        </span>
      </header>
      <div class="myio-card-main">
        <div class="myio-kpi"><span id="equip-kpi">-</span></div>
        <div class="myio-subrow"><span id="equip-sub">-</span></div>
      </div>
    </article>

    <!-- Energy Card -->
    <article class="myio-card v2" id="card-energy">...</article>

    <!-- Temperature Card -->
    <article class="myio-card v2" id="card-temp">...</article>

    <!-- Water Card -->
    <article class="myio-card v2" id="card-water">...</article>
  </div>
</section>
```

#### 2. Card Data Model

```typescript
interface CardKPIs {
  equip: {
    totalStr: string;      // "45/50"
    percent: number;       // 90
  };
  energy: {
    kpi: string;           // "1.234 kWh"
    trendDir: 'up' | 'down';
    trendText: string;     // "↑ 5.2%"
  };
  temp: {
    kpi: string;           // "23.5 °C"
    rangeText: string;     // "18-25 °C"
  };
  water: {
    kpi: string;           // "567 m³"
    percent: number;       // 65
  };
}
```

#### 3. Shopping Filter Modal

```javascript
// Filter state management
window.myioFilterSel = { malls: [], floors: [], places: [] };
window.myioFilterQuery = '';
window.myioFilterPresets = []; // localStorage persisted

// Customer selection
window.custumersSelected = [
  { name: 'Shopping A', value: 'ingestionId123', customerId: 'tbId' }
];

// Events dispatched
'myio:filter-applied' -> { selection: [...], ts: Date.now() }
'myio:request-total-consumption' -> { customersArray, startDateISO, endDateISO }
'myio:request-total-water-consumption' -> { customersArray, startDateISO, endDateISO }
```

#### 4. InfoTooltip Integration (RFC-0105)

```javascript
// Temperature tooltip data
window._headerTempData = {
  globalAvg: 23.5,
  shoppingsInRange: [...],
  shoppingsOutOfRange: [...],
  devices: [...]
};

// Energy tooltip data
window._headerEnergyData = {
  customerTotal: 1234.56,
  unfilteredTotal: 5678.90,
  equipmentsTotal: 800,
  lojasTotal: 434,
  shoppingsEnergy: [...]
};

// Water tooltip data
window._headerWaterData = {
  filteredTotal: 567.89,
  unfilteredTotal: 1000,
  commonArea: 300,
  stores: 267,
  shoppingsWater: [...]
};

// Equipment tooltip data
window._headerEquipData = {
  totalEquipments: 50,
  filteredEquipments: 45,
  allShoppingsSelected: true,
  categories: { meters: 20, sensors: 15, controllers: 10 }
};
```

#### 5. Card Color Customization

```javascript
// From widget settings
const settings = {
  cardEquipamentosBackgroundColor: '#1F3A35',
  cardEquipamentosFontColor: '#F2F2F2',
  cardEnergiaBackgroundColor: '#1F3A35',
  cardEnergiaFontColor: '#F2F2F2',
  cardTemperaturaBackgroundColor: '#1F3A35',
  cardTemperaturaFontColor: '#F2F2F2',
  cardAguaBackgroundColor: '#1F3A35',
  cardAguaFontColor: '#F2F2F2',
};
```

---

## Reference-level Explanation

### Proposed Library Component

#### File Structure

```
src/components/header/
├── index.ts                    # Public exports
├── createHeaderComponent.ts    # Main entry function
├── HeaderView.ts               # View rendering
├── HeaderController.ts         # Business logic
├── FilterModal.ts              # Shopping filter modal
├── KPICards.ts                 # Individual card components
├── styles.ts                   # Injected CSS
└── types.ts                    # TypeScript interfaces
```

#### Public API

```typescript
// src/components/header/types.ts

export interface HeaderComponentParams {
  // Container element
  container: HTMLElement;

  // ThingsBoard context (for navigation)
  ctx?: ThingsboardWidgetContext;

  // Logo Configuration
  logoUrl?: string;
  homeUrl?: string;  // URL for back button navigation

  // Card Colors
  cardColors?: {
    equipment?: { background: string; font: string };
    energy?: { background: string; font: string };
    temperature?: { background: string; font: string };
    water?: { background: string; font: string };
  };

  // Initial KPIs
  initialKPIs?: Partial<CardKPIs>;

  // Shopping data for filter
  shoppings?: Shopping[];

  // Callbacks
  onFilterApply?: (selection: Shopping[]) => void;
  onBackClick?: () => void;
  onCardClick?: (cardType: CardType) => void;

  // Tooltip configuration
  enableTooltips?: boolean;
}

export interface CardKPIs {
  equip: EquipmentKPI;
  energy: EnergyKPI;
  temp: TemperatureKPI;
  water: WaterKPI;
}

export interface Shopping {
  name: string;
  value: string;      // ingestionId
  customerId: string; // ThingsBoard entity ID
  ingestionId?: string;
}

export type CardType = 'equipment' | 'energy' | 'temperature' | 'water';

export interface HeaderComponentInstance {
  // Update methods
  updateKPIs: (kpis: Partial<CardKPIs>) => void;
  updateTooltipData: (cardType: CardType, data: any) => void;
  updateShoppings: (shoppings: Shopping[]) => void;

  // Filter methods
  openFilterModal: () => void;
  closeFilterModal: () => void;
  getSelectedShoppings: () => Shopping[];
  setSelectedShoppings: (shoppings: Shopping[]) => void;

  // Lifecycle
  destroy: () => void;

  // DOM reference
  element: HTMLElement;
}

export function createHeaderComponent(params: HeaderComponentParams): HeaderComponentInstance;
```

#### Usage Example

```javascript
// In MAIN_UNIQUE_DATASOURCE controller.js onInit():
import { createHeaderComponent } from 'myio-js-library';

self.onInit = async function() {
  const headerContainer = document.getElementById('header-mount');

  const header = createHeaderComponent({
    container: headerContainer,
    ctx: self.ctx,
    logoUrl: '/api/images/public/myio-logo',
    homeUrl: '/dashboards/welcome-dashboard-id',

    cardColors: {
      equipment: { background: '#1F3A35', font: '#F2F2F2' },
      energy: { background: '#1F3A35', font: '#F2F2F2' },
      temperature: { background: '#1F3A35', font: '#F2F2F2' },
      water: { background: '#1F3A35', font: '#F2F2F2' },
    },

    enableTooltips: true,

    onFilterApply: (selection) => {
      console.log('Filter applied:', selection);
      window.dispatchEvent(new CustomEvent('myio:filter-applied', {
        detail: { selection, ts: Date.now() }
      }));
    },

    onBackClick: () => {
      window.location.href = '/dashboards/welcome';
    }
  });

  // Listen for data updates from orchestrator
  window.addEventListener('myio:energy-summary-ready', (e) => {
    header.updateKPIs({ energy: e.detail });
    header.updateTooltipData('energy', e.detail);
  });

  window.addEventListener('myio:temperature-data-ready', (e) => {
    header.updateKPIs({ temp: e.detail });
    header.updateTooltipData('temperature', e.detail);
  });
};
```

### Event Integration

```typescript
// Events the HeaderComponent listens to:
'myio:energy-summary-ready'     -> Updates energy KPI card
'myio:water-summary-ready'      -> Updates water KPI card
'myio:temperature-data-ready'   -> Updates temperature KPI card
'myio:equipment-count-updated'  -> Updates equipment KPI card
'myio:shoppings-data-ready'     -> Updates filter modal shopping list

// Events the HeaderComponent dispatches:
'myio:filter-applied'           -> { selection: Shopping[], ts: number }
'myio:request-total-consumption'
'myio:request-total-water-consumption'
'myio:request-shoppings-data'
```

### Export in index.ts

```typescript
// Add to src/index.ts

// RFC-0113: Header Component
export {
  createHeaderComponent,
} from './components/header';

export type {
  HeaderComponentParams,
  HeaderComponentInstance,
  CardKPIs,
  Shopping,
  CardType,
} from './components/header';
```

---

## Drawbacks

1. **Large Component Size**: ~30-40KB added to bundle
2. **Filter Modal Complexity**: Preset management adds complexity
3. **Tooltip Dependency**: Requires InfoTooltip from RFC-0105
4. **Event Coupling**: Tightly coupled to orchestrator event system

---

## Rationale and Alternatives

### Why Library Component?

| Aspect | Widget (Current) | Component (Proposed) |
|--------|-----------------|---------------------|
| Instantiation | ThingsBoard lifecycle | `createHeaderComponent()` |
| Data Updates | `onDataUpdated()` | Event-driven + API methods |
| Styling | External CSS file | Injected + customizable |
| Testing | Requires ThingsBoard | Unit testable |

### Alternatives Considered

1. **Keep Widget Only**: Rejected - doesn't fit RFC-0111 architecture
2. **Multiple Small Components**: Rejected - too granular, loses cohesion
3. **React/Vue Component**: Rejected - library is vanilla JS/TS

---

## Prior Art

### Library Component Patterns

- `createHeaderComponent()` follows same pattern as modal functions
- InfoTooltip integration from RFC-0105

### Existing HEADER Widget

- `src/MYIO-SIM/v5.2.0/HEADER/controller.js` (~1200+ lines)
- Fully functional, production-tested
- Reference implementation for component

---

## Unresolved Questions

1. **Preset Storage**: Keep localStorage for presets or move to server?
2. **Card Click Actions**: Should cards be clickable to navigate to detail views?
3. **Responsive Layout**: How should cards stack on mobile?
4. **Tooltip Positioning**: Handle edge cases near screen boundaries?

---

## Future Possibilities

1. **Drag-to-Reorder Cards**: Let users customize card order
2. **Card Visibility Toggle**: Hide/show specific KPI cards
3. **Real-time Sparklines**: Mini charts in each card
4. **Alert Badges**: Show warning indicators on cards

---

## Implementation Plan

### Phase 1: Type Definitions
- [ ] Create `types.ts` with all interfaces
- [ ] Define `HeaderComponentParams`, `CardKPIs`, `Shopping`

### Phase 2: View Layer
- [ ] Create `HeaderView.ts`
- [ ] Port HTML structure from `template.html`
- [ ] Port CSS from `styles.css`
- [ ] Implement `KPICards.ts` for individual cards

### Phase 3: Filter Modal
- [ ] Create `FilterModal.ts`
- [ ] Port filter logic from controller.js
- [ ] Implement preset management

### Phase 4: Controller
- [ ] Create `HeaderController.ts`
- [ ] Port business logic from controller.js
- [ ] Wire up InfoTooltip integration

### Phase 5: Entry Function
- [ ] Create `createHeaderComponent.ts`
- [ ] Implement instance methods
- [ ] Add event listeners

### Phase 6: Export & Integration
- [ ] Add exports to `src/index.ts`
- [ ] Create usage documentation
- [ ] Test with `MAIN_UNIQUE_DATASOURCE`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/header/index.ts` | Public exports |
| `src/components/header/createHeaderComponent.ts` | Main entry |
| `src/components/header/HeaderView.ts` | View rendering |
| `src/components/header/HeaderController.ts` | Business logic |
| `src/components/header/FilterModal.ts` | Shopping filter |
| `src/components/header/KPICards.ts` | Card components |
| `src/components/header/styles.ts` | Injected CSS |
| `src/components/header/types.ts` | TypeScript interfaces |

## Files to Modify

| File | Change |
|------|--------|
| `src/index.ts` | Add exports for HeaderComponent |

---

## References

- [RFC-0105 InfoTooltip](./RFC-0105-InfoTooltip.md)
- [RFC-0111 Unified Main Single Datasource](./RFC-0111-Unified-Main-Single-Datasource-Architecture.md)
- [HEADER Widget Source](../../MYIO-SIM/v5.2.0/HEADER/)

---

**Document History:**
- 2026-01-02: Initial RFC created from HEADER widget reverse engineering
