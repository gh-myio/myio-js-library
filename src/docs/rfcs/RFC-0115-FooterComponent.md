# RFC 0115: Footer Component Library

- Feature Name: `footer_component`
- Start Date: 2026-01-02
- RFC PR: (to be assigned)
- Status: **Draft**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0111 (MAIN_UNIQUE_DATASOURCE), RFC-0113 (Header), RFC-0114 (Menu)

---

## Summary

This RFC documents the reverse-engineering of the existing FOOTER widget (`src/MYIO-SIM/v5.2.0/FOOTER/`) and proposes extracting its functionality into a reusable **FooterComponent** in the MYIO library. The footer provides a selection dock for comparing devices, displaying selected items as chips, and opening comparison modals.

---

## Motivation

### Current State: FOOTER Widget (v5.2.0)

The existing FOOTER widget (`src/MYIO-SIM/v5.2.0/FOOTER/`) is a ThingsBoard widget that provides:

1. **Selection Dock**: Displays selected devices as chips
2. **Selection Totals**: Shows count and aggregated values
3. **Comparison Modal**: Opens energy/water/temperature comparison charts
4. **Unit Type Validation**: Prevents comparing mixed device types
5. **Clear Selection**: Remove individual or all selected items
6. **Drag & Drop**: Accept dragged items from telemetry widgets

### Problem

The FOOTER functionality is tightly coupled to ThingsBoard widget system and the MyIOSelectionStore. With RFC-0111's architecture:

1. **Library Component**: Need standalone component callable from any widget
2. **SelectionStore Integration**: Must work with existing MyIOSelectionStore
3. **Modal Integration**: Opens existing library modals (energy, temperature)
4. **Event-Driven**: React to orchestrator events

### Goals

1. Extract FOOTER logic into `createFooterComponent()` library function
2. Expose via `src/index.ts` for consumption
3. Integrate with MyIOSelectionStore
4. Support multiple comparison modal types
5. Maintain feature parity with existing widget

---

## Guide-level Explanation

### Existing FOOTER Widget Structure

```
src/MYIO-SIM/v5.2.0/FOOTER/
├── controller.js          # Widget logic (~1527 lines)
├── template.html          # HTML structure (25 lines)
├── styles.css             # CSS styles (inline in controller)
├── settings.schema.json   # Widget settings
└── base.json              # Widget definition
```

### Current Features (Reverse Engineering)

#### 1. Selection Dock Template

```html
<section class="myio-footer">
  <div class="myio-dock" id="myioDock" aria-live="polite">
    <span class="myio-empty">Selecione dispositivos para comparar</span>
  </div>
  <div class="myio-right">
    <div class="myio-meta">
      <div class="myio-meta-title">SELEÇÃO</div>
      <div id="myioTotals">0 itens</div>
    </div>
    <button id="myioClear" class="myio-clear-btn" title="Limpar seleção">
      <svg><!-- Trash icon --></svg>
    </button>
    <button id="myioCompare" class="myio-compare" disabled>Comparar</button>
  </div>
</section>
```

#### 2. Chip Rendering

```javascript
// Each selected entity becomes a chip
const chip = document.createElement('div');
chip.className = 'myio-chip';
chip.innerHTML = `
  <div class="myio-chip-content">
    <span class="myio-chip-name">${entity.name} ${entity.customerName}</span>
    <span class="myio-chip-value">${formattedValue} ${entity.unit || ''}</span>
  </div>
  <button class="myio-chip-remove" data-entity-id="${entity.id}">
    <svg><!-- X icon --></svg>
  </button>
`;
```

#### 3. Selection Entity Model

```typescript
interface SelectedEntity {
  id: string;
  name: string;
  customerName: string;
  lastValue: number;
  unit: string;
  icon: string;           // 'energy' | 'water' | 'tank' | 'temperature'
  ingestionId: string;    // For API calls
  tbId: string;           // ThingsBoard entity ID
  entityType: string;     // 'ASSET' | 'DEVICE'
  dashboardId?: string;   // For navigation

  // Temperature-specific
  temperatureMin?: number;
  temperatureMax?: number;
}
```

#### 4. Unit Type Validation

```javascript
// Detect unit type from selected entities
function _detectUnitType(entities) {
  const types = new Set(entities.map(e => e.icon).filter(Boolean));

  if (types.size === 0) return null;
  if (types.size > 1) return 'mixed'; // Invalid!
  return Array.from(types)[0];
}

// Show alert if mixed types
if (detectedType === 'mixed') {
  showMixedUnitsAlert();
  MyIOSelectionStore.clear();
  return;
}
```

#### 5. Comparison Modal Integration

```javascript
// Energy/Water comparison (uses SDK)
window.MyIOLibrary.openDashboardPopupEnergy({
  mode: 'comparison',
  tbJwtToken: localStorage.getItem('jwt_token'),
  ingestionToken: token,
  dataSources: dataSources,  // Array of { type, id, label }
  readingType: 'energy',     // or 'water', 'tank'
  startDate: startDateISO,
  endDate: endDateISO,
  granularity: '1d',
  chartsBaseUrl: CHARTS_BASE_URL,
  theme: 'dark',
});

// Temperature comparison (uses Chart.js)
window.MyIOLibrary.openTemperatureComparisonModal({
  token: jwtToken,
  devices: devices,  // Array with temperature ranges
  startDate: startDateISO,
  endDate: endDateISO,
  theme: 'dark',
  locale: 'pt-BR',
  temperatureMin: globalMin,
  temperatureMax: globalMax,
});
```

#### 6. Event System

```javascript
// SelectionStore events
MyIOSelectionStore.on('selection:change', renderDock);
MyIOSelectionStore.on('selection:totals', renderDock);
MyIOSelectionStore.on('selection:limit-reached', showLimitAlert);

// Dashboard state change (from MENU)
window.addEventListener('myio:dashboard-state', (e) => {
  const domain = e.detail?.domain;
  if (domain && ['energy', 'water', 'temperature', 'tank'].includes(domain)) {
    // Clear selection when switching domains
    MyIOSelectionStore.clear();
  }
});
```

#### 7. CSS Design System (Inline)

```css
.myio-footer {
  --color-primary: #9E8CBE;
  --color-primary-hover: #B8A5D6;
  --color-primary-dark: #8472A8;
  --color-background: #0f1419;
  --color-surface: #1a1f28;
  --color-text-primary: #ffffff;

  height: 46px;
  background: linear-gradient(180deg, rgba(158,140,190,0.95), rgba(132,114,168,0.98));
  border-top: 2px solid rgba(184,165,214,0.5);
  backdrop-filter: blur(24px);
}

.myio-chip {
  background: linear-gradient(135deg, rgba(158,140,190,0.25), rgba(158,140,190,0.15));
  border: 1px solid rgba(184,165,214,0.4);
  border-radius: 10px;
  animation: chipSlideIn 0.3s ease-out;
}

.myio-compare {
  background: #3E1A7D;
  min-width: 100px;
  text-transform: uppercase;
}
```

---

## Reference-level Explanation

### Proposed Library Component

#### File Structure

```
src/components/footer/
├── index.ts                    # Public exports
├── createFooterComponent.ts    # Main entry function
├── FooterView.ts               # View rendering
├── FooterController.ts         # Business logic
├── ChipRenderer.ts             # Chip creation and management
├── ComparisonHandler.ts        # Modal integration
├── AlertDialogs.ts             # Mixed units, limit alerts
├── styles.ts                   # Injected CSS
└── types.ts                    # TypeScript interfaces
```

#### Public API

```typescript
// src/components/footer/types.ts

export interface FooterComponentParams {
  // Container element
  container: HTMLElement;

  // ThingsBoard context (for token, navigation)
  ctx?: ThingsboardWidgetContext;

  // Selection Store
  selectionStore?: SelectionStore; // Default: MyIOSelectionStore

  // Configuration
  maxSelections?: number;           // Default: 6
  emptyMessage?: string;            // "Selecione dispositivos para comparar"
  compareButtonLabel?: string;      // "Comparar"

  // Date range (for comparison modal)
  getDateRange?: () => { start: string; end: string };

  // API Configuration
  chartsBaseUrl?: string;
  dataApiHost?: string;
  getIngestionToken?: () => string;

  // Theme
  theme?: 'dark' | 'light';
  colors?: FooterColors;

  // Callbacks
  onCompareClick?: (entities: SelectedEntity[], unitType: string) => void;
  onClearClick?: () => void;
  onChipRemove?: (entityId: string) => void;
  onSelectionChange?: (entities: SelectedEntity[]) => void;
  onLimitReached?: (limit: number) => void;
  onMixedTypes?: (types: string[]) => void;
}

export interface FooterColors {
  primary: string;
  primaryHover: string;
  background: string;
  surface: string;
  text: string;
  border: string;
}

export interface SelectedEntity {
  id: string;
  name: string;
  customerName: string;
  lastValue: number;
  unit: string;
  icon: 'energy' | 'water' | 'tank' | 'temperature';
  ingestionId: string;
  tbId?: string;
  entityType?: string;
  dashboardId?: string;
  temperatureMin?: number;
  temperatureMax?: number;
}

export interface FooterComponentInstance {
  // Selection methods
  addEntity: (entity: SelectedEntity) => boolean;
  removeEntity: (entityId: string) => void;
  clearSelection: () => void;
  getSelectedEntities: () => SelectedEntity[];
  getSelectionCount: () => number;

  // State methods
  getCurrentUnitType: () => string | null;
  setDateRange: (start: string, end: string) => void;

  // UI methods
  openCompareModal: () => void;
  showLimitAlert: () => void;
  showMixedTypesAlert: () => void;

  // Lifecycle
  destroy: () => void;

  // DOM reference
  element: HTMLElement;
}

export function createFooterComponent(params: FooterComponentParams): FooterComponentInstance;
```

#### Usage Example

```javascript
// In MAIN_UNIQUE_DATASOURCE controller.js onInit():
import { createFooterComponent, MyIOSelectionStore } from 'myio-js-library';

self.onInit = async function() {
  const footerContainer = document.getElementById('footer-mount');

  const footer = createFooterComponent({
    container: footerContainer,
    ctx: self.ctx,
    selectionStore: MyIOSelectionStore,
    maxSelections: 6,

    getDateRange: () => ({
      start: self.ctx.$scope.startDateISO,
      end: self.ctx.$scope.endDateISO,
    }),

    chartsBaseUrl: 'https://graphs.staging.apps.myio-bas.com',

    getIngestionToken: () => {
      return window.MyIOOrchestrator?.tokenManager?.getToken?.('ingestionToken');
    },

    theme: 'dark',

    onCompareClick: (entities, unitType) => {
      console.log('Compare clicked:', entities.length, 'items of type:', unitType);
    },

    onSelectionChange: (entities) => {
      console.log('Selection changed:', entities.length);
    },

    onLimitReached: (limit) => {
      console.log('Selection limit reached:', limit);
    },

    onMixedTypes: (types) => {
      console.log('Mixed types detected:', types);
    }
  });

  // Listen for domain changes to clear selection
  window.addEventListener('myio:dashboard-state', (e) => {
    const domain = e.detail?.domain;
    if (domain) {
      footer.clearSelection();
    }
  });
};
```

### SelectionStore Integration

```typescript
// The FooterComponent uses SelectionStore for state management
class FooterController {
  private store: SelectionStore;
  private currentUnitType: string | null = null;

  constructor(private params: FooterComponentParams) {
    this.store = params.selectionStore || window.MyIOSelectionStore;
    this.bindStoreEvents();
  }

  private bindStoreEvents(): void {
    this.store.on('selection:change', this.handleSelectionChange.bind(this));
    this.store.on('selection:totals', this.handleTotalsChange.bind(this));
    this.store.on('selection:limit-reached', this.handleLimitReached.bind(this));
  }

  private handleSelectionChange(entities: SelectedEntity[]): void {
    // Validate unit types
    const detectedType = this.detectUnitType(entities);

    if (detectedType === 'mixed') {
      this.params.onMixedTypes?.(this.getUniqueTypes(entities));
      this.showMixedTypesAlert();
      this.store.clear();
      return;
    }

    // Check if type changed
    if (detectedType && this.currentUnitType && detectedType !== this.currentUnitType) {
      this.store.clear();
      return;
    }

    this.currentUnitType = detectedType;
    this.view.renderDock(entities);
    this.params.onSelectionChange?.(entities);
  }
}
```

### Comparison Modal Handler

```typescript
// src/components/footer/ComparisonHandler.ts

export class ComparisonHandler {
  constructor(private params: FooterComponentParams) {}

  async openComparisonModal(entities: SelectedEntity[]): Promise<void> {
    const unitType = this.detectUnitType(entities);
    const { start, end } = this.params.getDateRange?.() || this.getDefaultDateRange();

    if (unitType === 'temperature') {
      await this.openTemperatureModal(entities, start, end);
    } else {
      await this.openEnergyModal(entities, unitType, start, end);
    }
  }

  private async openEnergyModal(
    entities: SelectedEntity[],
    readingType: string,
    startDate: string,
    endDate: string
  ): Promise<void> {
    const dataSources = entities.map(e => ({
      type: 'device',
      id: e.ingestionId || e.id,
      label: `${e.name} ${e.customerName}`.trim(),
    }));

    const token = this.params.getIngestionToken?.();
    if (!token) {
      throw new Error('Ingestion token not available');
    }

    window.MyIOLibrary.openDashboardPopupEnergy({
      mode: 'comparison',
      tbJwtToken: localStorage.getItem('jwt_token'),
      ingestionToken: token,
      dataSources,
      readingType,
      startDate,
      endDate,
      granularity: this.calculateGranularity(startDate, endDate),
      chartsBaseUrl: this.params.chartsBaseUrl,
      dataApiHost: this.params.dataApiHost,
      theme: this.params.theme || 'dark',
    });
  }

  private async openTemperatureModal(
    entities: SelectedEntity[],
    startDate: string,
    endDate: string
  ): Promise<void> {
    const devices = entities.map(e => ({
      id: e.id,
      label: e.name,
      tbId: e.tbId,
      customerName: e.customerName,
      temperatureMin: e.temperatureMin,
      temperatureMax: e.temperatureMax,
    }));

    window.MyIOLibrary.openTemperatureComparisonModal({
      token: localStorage.getItem('jwt_token'),
      devices,
      startDate,
      endDate,
      theme: this.params.theme || 'dark',
      locale: 'pt-BR',
      granularity: 'hour',
    });
  }
}
```

### Export in index.ts

```typescript
// Add to src/index.ts

// RFC-0115: Footer Component
export {
  createFooterComponent,
} from './components/footer';

export type {
  FooterComponentParams,
  FooterComponentInstance,
  FooterColors,
  SelectedEntity,
} from './components/footer';
```

---

## Drawbacks

1. **SelectionStore Coupling**: Tightly coupled to MyIOSelectionStore
2. **Modal Dependencies**: Requires energy and temperature modals to exist
3. **Token Management**: Needs external token provider
4. **CSS Size**: ~15KB of injected CSS

---

## Rationale and Alternatives

### Why Library Component?

| Aspect | Widget (Current) | Component (Proposed) |
|--------|-----------------|---------------------|
| Instantiation | ThingsBoard lifecycle | `createFooterComponent()` |
| Selection State | Window global + Store | Instance + Store |
| Modal Opening | Inline implementation | Delegated to library |
| Testing | Requires ThingsBoard | Unit testable |

### Alternatives Considered

1. **Keep Widget Only**: Rejected - doesn't fit RFC-0111 architecture
2. **Merge with SelectionStore**: Rejected - separates concerns
3. **Headless Component**: Considered - may add renderless option

---

## Prior Art

### Library Component Patterns

- Follows same pattern as HeaderComponent (RFC-0113)
- Uses existing modals (`openDashboardPopupEnergy`, `openTemperatureComparisonModal`)

### Existing FOOTER Widget

- `src/MYIO-SIM/v5.2.0/FOOTER/controller.js` (~1527 lines)
- Fully functional, production-tested
- Reference implementation for component

---

## Unresolved Questions

1. **Drag & Drop**: Should drag-and-drop be part of component or separate?
2. **Chip Customization**: Allow custom chip templates?
3. **Position**: Fixed bottom or flow layout?
4. **Animation**: Chip enter/exit animations configurable?

---

## Future Possibilities

1. **Batch Actions**: Select all, select by type
2. **Export Selection**: Export selected entities to CSV/JSON
3. **Selection Persistence**: Save/restore selections across sessions
4. **Custom Comparison Views**: Pluggable comparison modal types
5. **Keyboard Shortcuts**: Delete key to remove last chip

---

## Implementation Plan

### Phase 1: Type Definitions
- [ ] Create `types.ts` with all interfaces
- [ ] Define `FooterComponentParams`, `SelectedEntity`, `FooterColors`

### Phase 2: View Layer
- [ ] Create `FooterView.ts`
- [ ] Port HTML structure from `template.html`
- [ ] Create `ChipRenderer.ts`
- [ ] Port CSS from controller.js (inline styles)

### Phase 3: Controller
- [ ] Create `FooterController.ts`
- [ ] Integrate with SelectionStore
- [ ] Handle unit type validation

### Phase 4: Comparison Handler
- [ ] Create `ComparisonHandler.ts`
- [ ] Integrate with `openDashboardPopupEnergy`
- [ ] Integrate with `openTemperatureComparisonModal`

### Phase 5: Alert Dialogs
- [ ] Create `AlertDialogs.ts`
- [ ] Mixed types alert
- [ ] Limit reached alert

### Phase 6: Entry Function
- [ ] Create `createFooterComponent.ts`
- [ ] Wire up all events
- [ ] Implement instance methods

### Phase 7: Export & Integration
- [ ] Add exports to `src/index.ts`
- [ ] Create usage documentation
- [ ] Test with `MAIN_UNIQUE_DATASOURCE`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/footer/index.ts` | Public exports |
| `src/components/footer/createFooterComponent.ts` | Main entry |
| `src/components/footer/FooterView.ts` | View rendering |
| `src/components/footer/FooterController.ts` | Business logic |
| `src/components/footer/ChipRenderer.ts` | Chip management |
| `src/components/footer/ComparisonHandler.ts` | Modal integration |
| `src/components/footer/AlertDialogs.ts` | Alert modals |
| `src/components/footer/styles.ts` | Injected CSS |
| `src/components/footer/types.ts` | TypeScript interfaces |

## Files to Modify

| File | Change |
|------|--------|
| `src/index.ts` | Add exports for FooterComponent |

---

## References

- [RFC-0111 Unified Main Single Datasource](./RFC-0111-Unified-Main-Single-Datasource-Architecture.md)
- [RFC-0113 Header Component](./RFC-0113-HeaderComponent.md)
- [RFC-0114 Menu Component](./RFC-0114-MenuComponent.md)
- [MyIOSelectionStore](../../stores/MyIOSelectionStore.ts)
- [FOOTER Widget Source](../../MYIO-SIM/v5.2.0/FOOTER/)
- [openDashboardPopupEnergy](../../components/premium-modals/energy/)
- [openTemperatureComparisonModal](../../components/premium-modals/temperature/)

---

**Document History:**
- 2026-01-02: Initial RFC created from FOOTER widget reverse engineering
