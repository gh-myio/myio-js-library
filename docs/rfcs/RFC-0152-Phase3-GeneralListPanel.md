# RFC-0152 Phase 3: General List Panel

## Status: ✅ IMPLEMENTED

## Summary

Create a library component `operational-general-list` that displays a grid of equipment cards (escalators and elevators) with operational KPIs. The component follows the same architecture as `src/components/telemetry-grid`.

---

## Architecture

### Pattern: Library Component (NOT ThingsBoard Widget)

```
src/components/operational-general-list/
├── index.ts                              # Public exports
├── types.ts                              # TypeScript definitions
├── OperationalGeneralListView.ts         # View layer (rendering)
├── OperationalGeneralListController.ts   # Controller layer (logic)
└── styles.ts                             # CSS styles (injected)
```

### Inspiration

Follow the pattern from:
- `src/components/telemetry-grid/`
- `src/components/telemetry-grid-shopping/`

---

## Component Interface

### Creation Function

```typescript
// src/components/operational-general-list/index.ts

export function createOperationalGeneralListComponent(
  params: OperationalGeneralListParams
): OperationalGeneralListInstance;
```

### Parameters

```typescript
interface OperationalGeneralListParams {
  /** Container element where component will be rendered */
  container: HTMLElement;

  /** Theme mode */
  themeMode?: 'light' | 'dark';

  /** Enable debug logging */
  enableDebugMode?: boolean;

  /** Initial equipment data (optional, can be set via updateEquipment) */
  equipment?: EquipmentCardData[];

  /** Callback when equipment card is clicked */
  onCardClick?: (equipment: EquipmentCardData) => void;

  /** Callback when filter changes */
  onFilterChange?: (filters: EquipmentFilterState) => void;
}
```

### Instance

```typescript
interface OperationalGeneralListInstance {
  /** Update equipment data */
  updateEquipment: (equipment: EquipmentCardData[]) => void;

  /** Set loading state */
  setLoading: (isLoading: boolean) => void;

  /** Set theme mode */
  setThemeMode: (mode: 'light' | 'dark') => void;

  /** Get current filter state */
  getFilters: () => EquipmentFilterState;

  /** Set filters programmatically */
  setFilters: (filters: Partial<EquipmentFilterState>) => void;

  /** Destroy component and cleanup */
  destroy: () => void;

  /** Root DOM element */
  element: HTMLElement;
}
```

---

## Data Types

### Equipment Card Data

```typescript
// src/components/operational-general-list/types.ts

export type EquipmentType = 'escada' | 'elevador';

export type EquipmentStatus = 'online' | 'offline' | 'maintenance';

export interface EquipmentCardData {
  /** Unique identifier */
  id: string;

  /** Display name (e.g., 'ESC-01', 'ELV-02') */
  name: string;

  /** Equipment type */
  type: EquipmentType;

  /** Operational status */
  status: EquipmentStatus;

  /** Availability percentage (0-100) */
  availability: number;

  /** Mean Time Between Failures (hours) */
  mtbf: number;

  /** Mean Time To Repair (hours) */
  mttr: number;

  /** Reversal detection flag */
  hasReversal: boolean;

  /** Count of recent alerts */
  recentAlerts: number;

  /** Customer/Shopping name */
  customerName: string;

  /** Location (e.g., 'Piso 1', 'Torre A') */
  location: string;

  /** Optional: Customer ID for filtering */
  customerId?: string;

  /** Optional: Entity ID */
  entityId?: string;
}
```

### Filter State

```typescript
export interface EquipmentFilterState {
  /** Search query (name, customer, location) */
  searchQuery: string;

  /** Status filter */
  statusFilter: EquipmentStatus | 'all';

  /** Type filter */
  typeFilter: EquipmentType | 'all';
}

export const DEFAULT_FILTER_STATE: EquipmentFilterState = {
  searchQuery: '',
  statusFilter: 'all',
  typeFilter: 'all',
};
```

---

## Card Layout

### Visual Specification

```
┌─────────────────────────────────────────┐
│ ESC-01                      [🟢 Online] │
│ Escada Rolante                          │
│ Piso 1                                  │
├─────────────────────────────────────────┤
│ ⚠️ Reversão detectada (if hasReversal)  │
├─────────────────────────────────────────┤
│                                         │
│         ┌───────────────┐               │
│         │     97%       │               │
│         │   ◯──────◯    │  ← SVG gauge  │
│         │               │               │
│         └───────────────┘               │
│         Disponibilidade                 │
│                                         │
├─────────────────────────────────────────┤
│  ⏱️ MTBF        │  🔧 MTTR              │
│     480h        │     2h                │
├─────────────────────────────────────────┤
│  🔔 3 alertas recentes (if > 0)         │
├─────────────────────────────────────────┤
│  [Shopping Madureira]                   │
└─────────────────────────────────────────┘
```

### Status Colors

| Status | Background | Border | Text | Label |
|--------|------------|--------|------|-------|
| online | `#dcfce7` | `#22c55e` | `#166534` | Online |
| offline | `#fee2e2` | `#ef4444` | `#991b1b` | Offline |
| maintenance | `#fef3c7` | `#f59e0b` | `#92400e` | Manutenção |

### Availability Gauge Colors

| Range | Color | Meaning |
|-------|-------|---------|
| ≥95% | `#22c55e` (green) | Excellent |
| 80-94% | `#f59e0b` (amber) | Warning |
| <80% | `#ef4444` (red) | Critical |

---

## View Implementation

### Template Structure

```typescript
// OperationalGeneralListView.ts

private buildHTML(): string {
  return `
    <div class="myio-operational-list-root" data-theme="${this.themeMode}">
      <!-- Header with filters -->
      <header class="myio-operational-header">
        <div class="header-title">
          <h2>Lista Geral de Equipamentos</h2>
          <span class="equipment-count" id="equipmentCount">0 equipamentos</span>
        </div>
        <div class="header-filters">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" id="searchInput" placeholder="Buscar equipamento..." />
          </div>
          <select id="statusFilter" class="filter-select">
            <option value="all">Todos os Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="maintenance">Manutenção</option>
          </select>
          <select id="typeFilter" class="filter-select">
            <option value="all">Todos os Tipos</option>
            <option value="escada">Escadas Rolantes</option>
            <option value="elevador">Elevadores</option>
          </select>
        </div>
      </header>

      <!-- Equipment Grid -->
      <section class="myio-operational-grid" id="equipmentGrid">
        <!-- Cards rendered dynamically -->
      </section>

      <!-- Loading State -->
      <div class="myio-operational-loading" id="loadingState">
        <div class="spinner"></div>
        <p>Carregando equipamentos...</p>
      </div>

      <!-- Empty State -->
      <div class="myio-operational-empty" id="emptyState">
        <div class="empty-icon">📋</div>
        <p>Nenhum equipamento encontrado</p>
      </div>
    </div>
  `;
}
```

### Card Rendering

```typescript
private renderCard(data: EquipmentCardData): string {
  const statusConfig = this.getStatusConfig(data.status);
  const availabilityColor = this.getAvailabilityColor(data.availability);
  const circumference = 2 * Math.PI * 56;
  const strokeDashoffset = circumference * (1 - data.availability / 100);

  return `
    <article class="equipment-card" data-id="${data.id}" data-status="${data.status}">
      <header class="card-header">
        <div class="card-info">
          <h3 class="card-name">${data.name}</h3>
          <span class="card-type">${data.type === 'escada' ? 'Escada Rolante' : 'Elevador'}</span>
          <span class="card-location">${data.location}</span>
        </div>
        <span class="status-badge" style="
          background: ${statusConfig.bg};
          border-color: ${statusConfig.border};
          color: ${statusConfig.text}
        ">${statusConfig.label}</span>
      </header>

      ${data.hasReversal ? `
        <div class="reversal-warning">
          <span>⚠️</span>
          <span>Reversão detectada</span>
        </div>
      ` : ''}

      <div class="availability-gauge">
        <svg viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="56" class="gauge-bg" />
          <circle cx="64" cy="64" r="56" class="gauge-value"
            stroke="${availabilityColor}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${strokeDashoffset}"
          />
        </svg>
        <div class="gauge-label">
          <span class="value">${data.availability}%</span>
          <span class="label">Disponibilidade</span>
        </div>
      </div>

      <div class="metrics-row">
        <div class="metric">
          <span class="metric-icon">⏱️</span>
          <div class="metric-data">
            <span class="metric-label">MTBF</span>
            <span class="metric-value">${data.mtbf}h</span>
          </div>
        </div>
        <div class="metric">
          <span class="metric-icon">🔧</span>
          <div class="metric-data">
            <span class="metric-label">MTTR</span>
            <span class="metric-value">${data.mttr}h</span>
          </div>
        </div>
      </div>

      ${data.recentAlerts > 0 ? `
        <div class="alerts-badge">
          <span>🔔</span>
          <span>${data.recentAlerts} ${data.recentAlerts === 1 ? 'alerta recente' : 'alertas recentes'}</span>
        </div>
      ` : ''}

      <footer class="card-footer">
        <span class="customer-badge">${data.customerName}</span>
      </footer>
    </article>
  `;
}
```

---

## Controller Implementation

### State Management

```typescript
// OperationalGeneralListController.ts

export class OperationalGeneralListController {
  private view: OperationalGeneralListView;
  private equipment: EquipmentCardData[] = [];
  private filteredEquipment: EquipmentCardData[] = [];
  private filters: EquipmentFilterState = { ...DEFAULT_FILTER_STATE };
  private isLoading = false;

  constructor(private params: OperationalGeneralListParams) {
    this.view = new OperationalGeneralListView(params);
    this.bindEvents();

    if (params.equipment) {
      this.updateEquipment(params.equipment);
    }
  }

  public updateEquipment(equipment: EquipmentCardData[]): void {
    this.equipment = equipment;
    this.applyFilters();
  }

  private applyFilters(): void {
    this.filteredEquipment = this.equipment.filter(eq => {
      // Search filter
      if (this.filters.searchQuery) {
        const query = this.filters.searchQuery.toLowerCase();
        const matchesSearch =
          eq.name.toLowerCase().includes(query) ||
          eq.customerName.toLowerCase().includes(query) ||
          eq.location.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (this.filters.statusFilter !== 'all' && eq.status !== this.filters.statusFilter) {
        return false;
      }

      // Type filter
      if (this.filters.typeFilter !== 'all' && eq.type !== this.filters.typeFilter) {
        return false;
      }

      return true;
    });

    this.view.renderGrid(this.filteredEquipment);
    this.view.updateCount(this.filteredEquipment.length);
  }
}
```

---

## Integration with MAIN_UNIQUE_DATASOURCE

### Injection Point

The `MAIN_UNIQUE_DATASOURCE` controller injects this component when the user navigates to `operational_general_list`:

```javascript
// In MAIN_UNIQUE_DATASOURCE controller.js

// Listen for navigation to operational general list
window.addEventListener('myio:switch-main-state', (ev) => {
  if (ev.detail?.stateId === 'operational_general_list') {
    renderOperationalGeneralList();
  }
});

function renderOperationalGeneralList() {
  const container = document.getElementById('mainContentContainer');
  if (!container) return;

  // Create component
  const listComponent = MyIOLibrary.createOperationalGeneralListComponent({
    container,
    themeMode: currentThemeMode,
    enableDebugMode: DEBUG_ACTIVE,
    equipment: [], // Will be populated via updateEquipment
    onCardClick: (equipment) => {
      console.log('Equipment clicked:', equipment);
      // TODO: Open equipment detail modal
    },
    onFilterChange: (filters) => {
      console.log('Filters changed:', filters);
    },
  });

  // Store reference for cleanup
  _operationalListRef = listComponent;

  // Fetch and populate equipment data (mock for now)
  fetchOperationalEquipment().then(data => {
    listComponent.updateEquipment(data);
  });
}
```

---

## Events

### Emitted Events

| Event | Detail | Description |
|-------|--------|-------------|
| `myio:operational-card-click` | `{ equipment: EquipmentCardData }` | Card clicked |
| `myio:operational-filter-change` | `{ filters: EquipmentFilterState }` | Filters changed |

### Consumed Events

| Event | Action |
|-------|--------|
| `myio:theme-change` | Update theme mode |
| `myio:filter-applied` | Filter by selected customers |

---

## Files to Create

| File | Description |
|------|-------------|
| `src/components/operational-general-list/index.ts` | Public exports |
| `src/components/operational-general-list/types.ts` | TypeScript definitions |
| `src/components/operational-general-list/OperationalGeneralListView.ts` | View layer |
| `src/components/operational-general-list/OperationalGeneralListController.ts` | Controller layer |
| `src/components/operational-general-list/styles.ts` | CSS styles |

---

## Exports to Add (`src/index.ts`)

```typescript
// RFC-0152: Operational General List Component
export { createOperationalGeneralListComponent } from './components/operational-general-list';
export { OperationalGeneralListView } from './components/operational-general-list';

export type {
  OperationalGeneralListParams,
  OperationalGeneralListInstance,
  EquipmentCardData,
  EquipmentType,
  EquipmentStatus,
  EquipmentFilterState,
} from './components/operational-general-list';
```

---

## Testing Checklist

- [ ] Component renders in container
- [ ] Equipment cards display all data fields
- [ ] Availability gauge renders correctly (SVG arc)
- [ ] Availability colors change based on percentage
- [ ] Status badges show correct colors
- [ ] Reversal warning shows with animation (when hasReversal=true)
- [ ] Recent alerts badge shows (when recentAlerts > 0)
- [ ] Search filter works (name, customer, location)
- [ ] Status filter works
- [ ] Type filter works
- [ ] Combined filters work
- [ ] Equipment count updates with filters
- [ ] Loading state shows/hides correctly
- [ ] Empty state shows when no results
- [ ] Theme toggle works (light/dark)
- [ ] Card click callback fires
- [ ] Responsive grid layout works
- [ ] Component cleanup on destroy

---

## Dependencies

- **Phase 1**: User access gating (attribute check)
- **Phase 2**: Menu navigation (context selection)
- **Types**: `src/types/operational.ts` (already created)
