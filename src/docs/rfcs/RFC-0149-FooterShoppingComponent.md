# RFC-0149: FooterShoppingComponent

**Status:** Draft
**Author:** MyIO Team
**Created:** 2025-01-XX
**Related RFCs:** RFC-0085, RFC-0134

## Summary

Migrar o widget ThingsBoard `FOOTER` (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/FOOTER/`) para um componente library reutilizavel exposto em `src/index.ts`, com showcase em `showcase/footer-shopping/`.

## Motivation

O widget FOOTER e responsavel pela selecao de dispositivos para comparacao. Apresenta chips de dispositivos selecionados, permite arrastar e soltar, e abre modais de comparacao (energia, agua, temperatura). Atualmente esta acoplado ao ThingsBoard. A migracao para componente library permite:

1. **Reutilizacao** - Usar o mesmo componente em diferentes contextos
2. **Testabilidade** - Testar isoladamente com showcase
3. **Manutenibilidade** - Codigo centralizado e versionado
4. **Desacoplamento** - Separar logica de UI da store de selecao

## Design

### Factory Function

```typescript
export function createFooterShoppingComponent(options: FooterOptions): FooterComponent
```

### Interfaces

```typescript
interface FooterOptions {
  container: HTMLElement | string;

  // Selection store (required)
  selectionStore: SelectionStore;

  // API Configuration (for comparison modals)
  dataApiHost?: string;
  chartsBaseUrl?: string;
  clientId?: string;
  clientSecret?: string;

  // Settings
  maxSelection?: number;  // Default: 6
  fixedPosition?: boolean; // Default: false

  // Callbacks
  onCompare?: (entities: SelectedEntity[], readingType: string) => void;
  onSelectionChange?: (entities: SelectedEntity[]) => void;
  onLimitReached?: (limit: number) => void;
}

interface SelectedEntity {
  id: string;
  name: string;
  icon: 'energy' | 'water' | 'temperature' | 'tank';
  lastValue?: number;
  unit?: string;
  ingestionId?: string;
  tbId?: string;
  customerTitle?: string;
  temperatureMin?: number;
  temperatureMax?: number;
}

interface SelectionStore {
  getSelectedEntities(): SelectedEntity[];
  getSelectionCount(): number;
  add(entity: SelectedEntity): boolean;
  remove(id: string): boolean;
  clear(): void;
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
}

interface FooterComponent {
  // Rendering
  render(): void;

  // Selection
  getSelectedCount(): number;
  getSelectedEntities(): SelectedEntity[];
  clearSelection(): void;

  // Comparison
  openComparisonModal(): Promise<void>;
  canCompare(): boolean;

  // Alerts
  showLimitAlert(): void;
  showMixedUnitsAlert(): void;
  hideAlert(): void;

  // Lifecycle
  destroy(): void;
}
```

### Events (Input - Listened)

| Event | Purpose | Source |
|-------|---------|--------|
| `selection:change` | Selection updated | SelectionStore |
| `selection:totals` | Totals recalculated | SelectionStore |
| `selection:limit-reached` | Max selection reached | SelectionStore |
| `myio:dashboard-state` | Tab changed (energy/water/temp) | Menu widget |

### Events (Output - Dispatched)

| Event | Purpose | Payload |
|-------|---------|---------|
| `myio:footer:compare-click` | Compare button clicked | `{ entities, readingType }` |
| `myio:footer:selection-cleared` | Selection was cleared | `{}` |
| `myio:footer:entity-removed` | Entity removed from selection | `{ entityId }` |

### UI Components

#### 1. Footer Bar (Fixed/Relative)

```
+-----------------------------------------------------------------------------------+
|  [Chip 1] [Chip 2] [Chip 3] ...    |  SELECAO    |  [Clear]  |  [Comparar ->]   |
|                                     |  3 itens    |           |                   |
+-----------------------------------------------------------------------------------+
```

#### 2. Chip Component

```html
<div class="myio-chip">
  <div class="myio-chip-content">
    <span class="myio-chip-name">Device Name</span>
    <span class="myio-chip-value">1.234,56 kWh</span>
  </div>
  <button class="myio-chip-remove" data-entity-id="xxx">
    <svg>X</svg>
  </button>
</div>
```

#### 3. Empty State

```html
<span class="myio-empty">Selecione dispositivos para comparar</span>
```

#### 4. Alert Modal

- **Limit Alert**: "Voce pode selecionar no maximo 6 dispositivos"
- **Mixed Units Alert**: "Voce nao pode comparar dispositivos de tipos diferentes"

### File Structure

```
src/
├── components/
│   └── footer-shopping/
│       ├── FooterView.ts           # Main component class
│       ├── FooterChip.ts           # Chip component
│       ├── FooterAlert.ts          # Alert modal component
│       ├── FooterStyles.ts         # CSS-in-JS styles
│       ├── types.ts                # TypeScript interfaces
│       └── index.ts                # Exports
├── index.ts                        # Library exports
showcase/
└── footer-shopping/
    ├── index.html
    ├── start-server.bat
    ├── start-server.sh
    ├── stop-server.bat
    └── stop-server.sh
```

### CSS Variables

```css
:root {
  /* Footer Theme - Purple */
  --myio-footer-primary: #9E8CBE;
  --myio-footer-primary-hover: #B8A5D6;
  --myio-footer-primary-dark: #8472A8;
  --myio-footer-bg: linear-gradient(180deg, rgba(158, 140, 190, 0.95) 0%, rgba(132, 114, 168, 0.98) 100%);
  --myio-footer-border: rgba(184, 165, 214, 0.5);
  --myio-footer-text: #ffffff;
  --myio-footer-text-secondary: rgba(255, 255, 255, 0.7);

  /* Chip */
  --myio-chip-bg: linear-gradient(135deg, rgba(158, 140, 190, 0.25) 0%, rgba(158, 140, 190, 0.15) 100%);
  --myio-chip-border: rgba(184, 165, 214, 0.4);

  /* Button */
  --myio-btn-compare-bg: #3E1A7D;
  --myio-btn-compare-hover: #5A2CB8;

  /* Error */
  --myio-error: #ff4444;
}
```

### Dependencies

- **MyIOSelectionStore** - Selection state management
- **MyIOLibrary** - For comparison modals:
  - `openDashboardPopupEnergy` - Energy/water comparison
  - `openTemperatureComparisonModal` - Temperature comparison
  - `buildMyioIngestionAuth` - API authentication

## Implementation

### Phase 1: Core Component

1. Create `FooterView.ts` with:
   - Container setup (fixed or relative positioning)
   - Dock area for chips
   - Right section (stats + buttons)
   - Event listener registration

2. Create `FooterChip.ts` with:
   - Chip rendering with name and value
   - Remove button with hover effects
   - Animation on add/remove

### Phase 2: Selection Integration

1. Integrate with `MyIOSelectionStore`:
   - Listen for selection changes
   - Render chips based on selection
   - Update totals display
   - Handle limit reached event

2. Implement unit type detection:
   - Detect mixed types (energy + water)
   - Auto-clear on type mismatch
   - Track current unit type

### Phase 3: Comparison Modals

1. Implement `openComparisonModal()`:
   - Detect reading type (energy/water/temperature)
   - For energy/water: use `openDashboardPopupEnergy`
   - For temperature: use `openTemperatureComparisonModal`
   - Handle authentication

### Phase 4: Alerts

1. Create `FooterAlert.ts`:
   - Limit reached alert
   - Mixed units alert
   - Premium design with animations

### Phase 5: Integration

1. Export from `src/index.ts`:
   ```typescript
   export { createFooterShoppingComponent } from './components/footer-shopping';
   export type {
     FooterOptions,
     FooterComponent,
     SelectedEntity
   } from './components/footer-shopping/types';
   ```

2. Create showcase HTML with mock selection store

### Showcase Usage

```html
<script type="module">
  import {
    createFooterShoppingComponent,
    MyIOSelectionStore
  } from '/dist/index.esm.js';

  const footer = createFooterShoppingComponent({
    container: '#footer-container',
    selectionStore: MyIOSelectionStore,
    maxSelection: 6,
    fixedPosition: true,
    onCompare: (entities, readingType) => {
      console.log('Compare:', entities, readingType);
    },
    onLimitReached: (limit) => {
      console.log('Limit reached:', limit);
    }
  });

  // Simulate adding entities
  MyIOSelectionStore.add({
    id: 'device-1',
    name: 'Medidor 01',
    icon: 'energy',
    lastValue: 1234.56,
    unit: 'kWh'
  });
</script>
```

### Drag and Drop

```javascript
// Enable drag from device cards
deviceCard.setAttribute('draggable', 'true');
deviceCard.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('text/myio-id', entity.id);
});

// Footer accepts drops
footer.addEventListener('drop', (e) => {
  const id = e.dataTransfer.getData('text/myio-id');
  MyIOSelectionStore.add(id);
});
```

## Migration Path

### From ThingsBoard Widget

```javascript
// Old: ThingsBoard widget controller
self.onInit = function() {
  footerController.init(self.ctx);
};

// New: Library component
import {
  createFooterShoppingComponent,
  MyIOSelectionStore
} from 'myio-js-library';

const footer = createFooterShoppingComponent({
  container: self.ctx.$container[0],
  selectionStore: MyIOSelectionStore,
  dataApiHost: window.MyIOUtils?.DATA_API_HOST,
  chartsBaseUrl: 'https://graphs.staging.apps.myio-bas.com',
  fixedPosition: self.ctx.settings?.fixedFooter
});

// Events still work the same way
window.addEventListener('myio:dashboard-state', (ev) => {
  if (ev.detail?.tab) {
    footer.clearSelection();
  }
});
```

## Showcase Server

Port: **3338**

```bash
# Windows
start-server.bat

# Linux/Mac
./start-server.sh
```

## Testing

### Manual Testing

1. Add entities to selection (click or drag)
2. Remove entities (X button)
3. Clear all selection
4. Compare button state (disabled < 2 items)
5. Mixed types alert
6. Limit reached alert (> 6 items)
7. Compare modal opens correctly
8. Tab change clears selection

### Unit Tests

- Chip rendering
- Unit type detection
- Mixed types detection
- Selection count
- Value formatting

## Features Summary

| Feature | Description |
|---------|-------------|
| **Chip Display** | Shows selected entities as chips with name and value |
| **Remove Button** | Each chip has X button to remove |
| **Clear All** | Button to clear entire selection |
| **Compare Button** | Opens comparison modal (min 2 items) |
| **Selection Counter** | Shows count and total/average value |
| **Mixed Types Alert** | Prevents comparing different types |
| **Limit Alert** | Shows when max selection (6) reached |
| **Drag & Drop** | Can drop entities into footer |
| **Tab Change** | Clears selection on domain change |
| **Temperature Average** | Shows average instead of sum for temperature |

## Risks

1. **SelectionStore dependency** - Component requires selection store
2. **Comparison modal integration** - Requires MyIOLibrary functions
3. **Authentication** - Needs API credentials for comparison
4. **Cross-domain issues** - If footer in different iframe than cards

## References

- [RFC-0085: Temperature Comparison Modal](./RFC-0085.md)
- [RFC-0134: Build Local Server Simulation](./RFC-0134--BuildLocalServerSimulationThingsboard.md)
- [MyIOSelectionStore Documentation](../myio-selection-store.md)
