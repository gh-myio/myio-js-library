# RFC 0114: Menu Component Library

- Feature Name: `menu_component`
- Start Date: 2026-01-02
- RFC PR: (to be assigned)
- Status: **Draft**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0111 (MAIN_UNIQUE_DATASOURCE), RFC-0113 (Header), RFC-0115 (Footer)

---

## Summary

This RFC documents the reverse-engineering of the existing MENU widget (`src/MYIO-SIM/v5.2.0/MENU/`) and proposes extracting its functionality into a reusable **MenuComponent** in the MYIO library. The menu provides tab navigation, context modals, date range selection, and action buttons for the Head Office dashboard.

---

## Motivation

### Current State: MENU Widget (v5.2.0)

The existing MENU widget (`src/MYIO-SIM/v5.2.0/MENU/`) is a ThingsBoard widget that provides:

1. **Tab Navigation**: Energy, Water, Temperature with dropdown context modals
2. **Context Modals**: Sub-context selection (Equipments, Stores, General, etc.)
3. **Date Range Picker**: Flatpickr-based date range selection
4. **Action Buttons**: Filter, Load, Clear, Goals
5. **Shopping Filter Modal**: Multi-select shopping centers

### Problem

The MENU functionality is tightly coupled to ThingsBoard widget system. With RFC-0111's architecture:

1. **Library Component**: Need standalone component callable from any widget
2. **Consistent API**: Follow existing library patterns
3. **Date Management**: Centralized date range control
4. **Event Orchestration**: Coordinate state changes across widgets

### Goals

1. Extract MENU logic into `createMenuComponent()` library function
2. Expose via `src/index.ts` for consumption
3. Support tab switching and context changes via events
4. Maintain feature parity with existing widget
5. Provide centralized date range management

---

## Guide-level Explanation

### Existing MENU Widget Structure

```
src/MYIO-SIM/v5.2.0/MENU/
├── controller.js          # Widget logic (~900+ lines)
├── template.html          # HTML structure (195 lines)
├── styles.css             # CSS styles
├── settings.schema.json   # Widget settings
└── base.json              # Widget definition
```

### Current Features (Reverse Engineering)

#### 1. Tab Navigation with Dropdown Modals

```html
<!-- Template Structure -->
<section class="myio-toolbar-root">
  <div class="myio-tabs-row">
    <nav class="myio-tabs" role="tablist">
      <!-- Energy Tab with Dropdown -->
      <button id="energyButton" class="tab is-active">
        <span class="ico">⚡</span>
        <span id="energyContextLabel">Energia: Equipamentos</span>
        <span class="dropdown-arrow">▼</span>
      </button>

      <!-- Water Tab with Dropdown -->
      <button id="waterButton" class="tab">
        <span class="ico">💧</span>
        <span id="waterContextLabel">Água: Resumo</span>
        <span class="dropdown-arrow">▼</span>
      </button>

      <!-- Temperature Tab with Dropdown -->
      <button id="temperatureButton" class="tab">
        <span class="ico">🌡️</span>
        <span id="temperatureContextLabel">Temperatura: Ambientes Climatizáveis</span>
        <span class="dropdown-arrow">▼</span>
      </button>
    </nav>

    <!-- Action Buttons -->
    <button id="myio-goals-btn" class="tab">Metas</button>
    <button class="myio-filter-btn" id="filterBtn">Filtro</button>
    <button class="tab">📅 <input type="text" name="startDatetimes" /></button>
    <button id="load-button" class="tab">Carregar</button>
    <button id="myio-clear-btn" class="tab">Limpar</button>
  </div>

  <!-- Context Modals -->
  <div id="energyContextModal" class="energy-modal">...</div>
  <div id="waterContextModal" class="water-modal">...</div>
  <div id="temperatureContextModal" class="temperature-modal">...</div>
</section>
```

#### 2. Context Modal Options

```javascript
// Energy Contexts
const ENERGY_CONTEXTS = [
  { context: 'equipments', target: 'content_equipments', title: 'Equipamentos' },
  { context: 'stores', target: 'content_store', title: 'Lojas' },
  { context: 'general', target: 'content_energy', title: 'Geral (Energia)' },
];

// Water Contexts
const WATER_CONTEXTS = [
  { context: 'water_common_area', target: 'content_water_common_area', title: 'Área Comum' },
  { context: 'water_stores', target: 'content_water_stores', title: 'Lojas' },
  { context: 'water_summary', target: 'content_water', title: 'Resumo' },
];

// Temperature Contexts
const TEMPERATURE_CONTEXTS = [
  { context: 'temperature_sensors', target: 'content_temperature_sensors', title: 'Ambientes Climatizáveis' },
  { context: 'temperature_sensors_external', target: 'content_temperature_sensors_external', title: 'Ambientes Não Climatizáveis' },
  { context: 'temperature_comparison', target: 'content_temperature', title: 'Resumo Geral' },
];
```

#### 3. Event System

```javascript
// Tab/State switching
const EVT_SWITCH = 'myio:switch-main-state';

function publishSwitch(targetStateId) {
  const detail = { targetStateId, source: 'menu', ts: Date.now() };
  window.dispatchEvent(new CustomEvent(EVT_SWITCH, { detail }));
}

// Dashboard state change (for FOOTER to clear selection)
window.dispatchEvent(new CustomEvent('myio:dashboard-state', {
  detail: { domain: 'energy', stateId: 'content_equipments' }
}));

// Customer/Shopping data ready
window.dispatchEvent(new CustomEvent('myio:customers-ready', {
  detail: { count: arr.length, customers: arr }
}));

// Filter applied
window.dispatchEvent(new CustomEvent('myio:filter-applied', {
  detail: { selection: window.custumersSelected, ts: Date.now() }
}));

// Date update
window.dispatchEvent(new CustomEvent('myio:update-date', {
  detail: { startISO, endISO }
}));
```

#### 4. Date Range Management

```javascript
// Flatpickr integration
const dateInput = document.querySelector('input[name="startDatetimes"]');

flatpickr(dateInput, {
  mode: 'range',
  dateFormat: 'd/m/Y',
  locale: Portuguese,
  defaultDate: [startDate, endDate],
  onChange: (selectedDates) => {
    if (selectedDates.length === 2) {
      const [start, end] = selectedDates;
      self.ctx.$scope.startDateISO = start.toISOString();
      self.ctx.$scope.endDateISO = end.toISOString();
    }
  }
});
```

#### 5. Shopping Filter Modal (Same as HEADER)

```javascript
// Filter modal with multi-select
function injectModalGlobal() {
  // Creates filter modal with:
  // - Search input
  // - Customer list with checkboxes
  // - Apply/Clear/Cancel buttons
  // - Chips for selected items
}
```

---

## Reference-level Explanation

### Proposed Library Component

#### File Structure

```
src/components/menu/
├── index.ts                    # Public exports
├── createMenuComponent.ts      # Main entry function
├── MenuView.ts                 # View rendering
├── MenuController.ts           # Business logic
├── TabNavigation.ts            # Tab and context management
├── ContextModals.ts            # Dropdown context modals
├── DateRangePicker.ts          # Date range integration
├── ActionButtons.ts            # Load, Clear, Goals buttons
├── styles.ts                   # Injected CSS
└── types.ts                    # TypeScript interfaces
```

#### Public API

```typescript
// src/components/menu/types.ts

export interface MenuComponentParams {
  // Container element
  container: HTMLElement;

  // ThingsBoard context
  ctx?: ThingsboardWidgetContext;

  // Tab Configuration
  tabs?: TabConfig[];
  initialTab?: string;

  // Date Range
  initialDateRange?: {
    start: Date | string;
    end: Date | string;
  };
  dateLocale?: string;

  // Shopping data for filter
  shoppings?: Shopping[];

  // Feature Toggles
  showGoalsButton?: boolean;
  showFilterButton?: boolean;
  showLoadButton?: boolean;
  showClearButton?: boolean;

  // Callbacks
  onTabChange?: (tab: string, context: string, target: string) => void;
  onContextChange?: (tab: string, context: string, target: string) => void;
  onDateRangeChange?: (start: Date, end: Date) => void;
  onFilterApply?: (selection: Shopping[]) => void;
  onLoad?: () => void;
  onClear?: () => void;
  onGoals?: () => void;
}

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  contexts: ContextOption[];
  defaultContext?: string;
}

export interface ContextOption {
  id: string;
  target: string;
  title: string;
  description: string;
  icon: string;
}

export interface Shopping {
  name: string;
  value: string;
  customerId: string;
  ingestionId?: string;
}

export interface MenuComponentInstance {
  // Tab methods
  setActiveTab: (tabId: string) => void;
  getActiveTab: () => string;
  setContext: (tabId: string, contextId: string) => void;
  getContext: (tabId: string) => string;

  // Date methods
  setDateRange: (start: Date, end: Date) => void;
  getDateRange: () => { start: Date; end: Date };

  // Filter methods
  openFilterModal: () => void;
  closeFilterModal: () => void;
  getSelectedShoppings: () => Shopping[];
  setSelectedShoppings: (shoppings: Shopping[]) => void;

  // Action methods
  triggerLoad: () => void;
  triggerClear: () => void;

  // Lifecycle
  destroy: () => void;

  // DOM reference
  element: HTMLElement;
}

export function createMenuComponent(params: MenuComponentParams): MenuComponentInstance;
```

#### Default Tab Configuration

```typescript
const DEFAULT_TABS: TabConfig[] = [
  {
    id: 'energy',
    label: 'Energia',
    icon: '⚡',
    contexts: [
      { id: 'equipments', target: 'content_equipments', title: 'Equipamentos', description: 'Telemetria de equipamentos', icon: '⚙️' },
      { id: 'stores', target: 'content_store', title: 'Lojas', description: 'Telemetria de lojas', icon: '🏬' },
      { id: 'general', target: 'content_energy', title: 'Geral', description: 'Visão geral de energia', icon: '⚡' },
    ],
    defaultContext: 'equipments',
  },
  {
    id: 'water',
    label: 'Água',
    icon: '💧',
    contexts: [
      { id: 'water_common_area', target: 'content_water_common_area', title: 'Área Comum', description: 'Hidrômetros de áreas comuns', icon: '🏢' },
      { id: 'water_stores', target: 'content_water_stores', title: 'Lojas', description: 'Hidrômetros de lojas', icon: '🏬' },
      { id: 'water_summary', target: 'content_water', title: 'Resumo', description: 'Visão geral de água', icon: '📊' },
    ],
    defaultContext: 'water_summary',
  },
  {
    id: 'temperature',
    label: 'Temperatura',
    icon: '🌡️',
    contexts: [
      { id: 'temperature_sensors', target: 'content_temperature_sensors', title: 'Ambientes Climatizáveis', description: 'Sensores com ar-condicionado', icon: '❄️' },
      { id: 'temperature_sensors_external', target: 'content_temperature_sensors_external', title: 'Ambientes Não Climatizáveis', description: 'Sensores externos', icon: '☀️' },
      { id: 'temperature_comparison', target: 'content_temperature', title: 'Resumo Geral', description: 'Visão geral de temperatura', icon: '📊' },
    ],
    defaultContext: 'temperature_sensors',
  },
];
```

#### Usage Example

```javascript
// In MAIN_UNIQUE_DATASOURCE controller.js onInit():
import { createMenuComponent } from 'myio-js-library';

self.onInit = async function() {
  const menuContainer = document.getElementById('menu-mount');

  const menu = createMenuComponent({
    container: menuContainer,
    ctx: self.ctx,

    initialTab: 'energy',
    initialDateRange: {
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      end: new Date(),
    },
    dateLocale: 'pt-BR',

    showGoalsButton: true,
    showFilterButton: true,
    showLoadButton: true,
    showClearButton: true,

    onTabChange: (tab, context, target) => {
      console.log('Tab changed:', tab, context);
      // Dispatch state switch event
      window.dispatchEvent(new CustomEvent('myio:switch-main-state', {
        detail: { targetStateId: target, source: 'menu', ts: Date.now() }
      }));
    },

    onContextChange: (tab, context, target) => {
      console.log('Context changed:', context, target);
      // Dispatch dashboard state for FOOTER to clear selection
      window.dispatchEvent(new CustomEvent('myio:dashboard-state', {
        detail: { domain: tab, stateId: target }
      }));
    },

    onDateRangeChange: (start, end) => {
      console.log('Date range:', start, end);
      self.ctx.$scope.startDateISO = start.toISOString();
      self.ctx.$scope.endDateISO = end.toISOString();

      // Dispatch date update
      window.dispatchEvent(new CustomEvent('myio:update-date', {
        detail: { startISO: start.toISOString(), endISO: end.toISOString() }
      }));
    },

    onFilterApply: (selection) => {
      window.dispatchEvent(new CustomEvent('myio:filter-applied', {
        detail: { selection, ts: Date.now() }
      }));
    },

    onLoad: () => {
      window.dispatchEvent(new CustomEvent('myio:request-reload'));
    },

    onClear: () => {
      window.dispatchEvent(new CustomEvent('myio:force-refresh'));
    },

    onGoals: () => {
      // Open goals panel
      window.MyIOLibrary?.openGoalsModal?.();
    }
  });
};
```

### Event Integration

```typescript
// Events the MenuComponent dispatches:
'myio:switch-main-state'    -> { targetStateId, source, ts }
'myio:dashboard-state'      -> { domain, stateId }
'myio:update-date'          -> { startISO, endISO }
'myio:filter-applied'       -> { selection, ts }
'myio:customers-ready'      -> { count, customers }
'myio:request-reload'       -> (no detail)
'myio:force-refresh'        -> (no detail)

// Events the MenuComponent listens to:
'myio:shoppings-data-ready' -> Updates filter modal shopping list
```

### Export in index.ts

```typescript
// Add to src/index.ts

// RFC-0114: Menu Component
export {
  createMenuComponent,
} from './components/menu';

export type {
  MenuComponentParams,
  MenuComponentInstance,
  TabConfig,
  ContextOption,
} from './components/menu';
```

---

## Drawbacks

1. **Flatpickr Dependency**: Requires external date picker library
2. **Tab State Complexity**: Managing tab + context state is complex
3. **Event Coupling**: Tightly coupled to orchestrator event system
4. **CSS Size**: ~20KB of injected CSS

---

## Rationale and Alternatives

### Why Library Component?

| Aspect | Widget (Current) | Component (Proposed) |
|--------|-----------------|---------------------|
| Instantiation | ThingsBoard lifecycle | `createMenuComponent()` |
| Tab State | Window global | Instance methods |
| Date Management | `ctx.$scope` | Callbacks + events |
| Testing | Requires ThingsBoard | Unit testable |

### Alternatives Considered

1. **Keep Widget Only**: Rejected - doesn't fit RFC-0111 architecture
2. **Separate Tab/Date/Filter Components**: Rejected - too fragmented
3. **Single Event Bus**: Considered - may add in future version

---

## Prior Art

### Library Component Patterns

- Follows same pattern as HeaderComponent (RFC-0113)
- Filter modal shared with HEADER

### Existing MENU Widget

- `src/MYIO-SIM/v5.2.0/MENU/controller.js` (~900+ lines)
- Fully functional, production-tested
- Reference implementation for component

---

## Unresolved Questions

1. **Flatpickr Bundling**: Bundle flatpickr or require external?
2. **Tab Persistence**: Save last active tab to localStorage?
3. **Date Presets**: Add "Last 7 days", "This month" quick buttons?
4. **Keyboard Navigation**: Arrow keys to switch tabs?

---

## Future Possibilities

1. **Tab Badges**: Show counts or alerts on tabs
2. **Collapsible Menu**: Minimize to icons only
3. **Custom Tab Colors**: Per-tab color themes
4. **Date Comparison Mode**: Compare two date ranges

---

## Implementation Plan

### Phase 1: Type Definitions
- [ ] Create `types.ts` with all interfaces
- [ ] Define `MenuComponentParams`, `TabConfig`, `ContextOption`

### Phase 2: View Layer
- [ ] Create `MenuView.ts`
- [ ] Port HTML structure from `template.html`
- [ ] Port CSS from `styles.css`

### Phase 3: Tab Navigation
- [ ] Create `TabNavigation.ts`
- [ ] Implement tab switching logic
- [ ] Create `ContextModals.ts` for dropdown modals

### Phase 4: Date Picker
- [ ] Create `DateRangePicker.ts`
- [ ] Integrate flatpickr
- [ ] Handle locale and date format

### Phase 5: Action Buttons
- [ ] Create `ActionButtons.ts`
- [ ] Implement Load, Clear, Goals, Filter buttons

### Phase 6: Controller & Entry
- [ ] Create `MenuController.ts`
- [ ] Create `createMenuComponent.ts`
- [ ] Wire up all events

### Phase 7: Export & Integration
- [ ] Add exports to `src/index.ts`
- [ ] Create usage documentation
- [ ] Test with `MAIN_UNIQUE_DATASOURCE`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/menu/index.ts` | Public exports |
| `src/components/menu/createMenuComponent.ts` | Main entry |
| `src/components/menu/MenuView.ts` | View rendering |
| `src/components/menu/MenuController.ts` | Business logic |
| `src/components/menu/TabNavigation.ts` | Tab management |
| `src/components/menu/ContextModals.ts` | Dropdown modals |
| `src/components/menu/DateRangePicker.ts` | Date picker |
| `src/components/menu/ActionButtons.ts` | Action buttons |
| `src/components/menu/styles.ts` | Injected CSS |
| `src/components/menu/types.ts` | TypeScript interfaces |

## Files to Modify

| File | Change |
|------|--------|
| `src/index.ts` | Add exports for MenuComponent |

---

## References

- [RFC-0111 Unified Main Single Datasource](./RFC-0111-Unified-Main-Single-Datasource-Architecture.md)
- [RFC-0113 Header Component](./RFC-0113-HeaderComponent.md)
- [MENU Widget Source](../../MYIO-SIM/v5.2.0/MENU/)
- [Flatpickr Documentation](https://flatpickr.js.org/)

---

**Document History:**
- 2026-01-02: Initial RFC created from MENU widget reverse engineering
