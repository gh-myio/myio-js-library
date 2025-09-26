- Feature Name: `renderFilterableCardGrid`
- Start Date: 2025-09-26
- RFC PR: [myio-js-library#TBD](https://github.com/gh-myio/myio-js-library/pull/TBD)
- Tracking Issue: [myio-js-library#TBD](https://github.com/gh-myio/myio-js-library/issues/TBD)

# Summary

Introduce a new, atomic UI component `renderFilterableCardGrid` in the MYIO JS Library that combines the proven FilterOrderingModal (RFC-0021) with premium card rendering capabilities. This component creates a complete filterable grid experience with integrated search, multi-select, sorting, and actions - perfect for MYIO dashboards that need both card display and advanced filtering without requiring separate modal implementations.

The component's public entrypoint will be exported as:

```javascript
MyIOLibrary.renderFilterableCardGrid(containerEl, props)
```

This provides a unified, atomic component that handles card rendering, filtering, sorting, and selection - eliminating the need to manage separate FilterOrderingModal and card components.

# Motivation

## Integration Complexity
Current implementations require developers to separately manage FilterOrderingModal and card rendering components, leading to complex state synchronization and increased development overhead in ThingsBoard widgets and dashboard implementations.

## Performance Optimization
Having filter and display logic in a single atomic component reduces DOM manipulation overhead and enables better performance optimizations like virtual scrolling and efficient re-rendering.

## Consistency & Maintainability
A unified component ensures consistent behavior between filtering interactions and card updates, reducing the likelihood of state synchronization bugs that occur when managing separate components.

## Developer Experience
Single-component approach dramatically simplifies integration in ThingsBoard widgets, reducing boilerplate code and potential for implementation errors.

# Guide-level explanation

## What you get

A single call that creates a complete filterable card grid with built-in MYIO design system styling:

```javascript
const grid = MyIOLibrary.renderFilterableCardGrid(container, {
  items: storesArray,                    // Array of store/device objects
  initialSelected: ['store-1', 'store-3'],
  renderCard: (item, actions) => renderCustomCard(item, actions),
  onSelectionChange: (selectedIds) => updateSelection(selectedIds),
  onCardAction: (action, item) => handleCardAction(action, item),
  enableFiltering: true,
  enableSorting: true,
  enableSelection: true,
  filterOptions: {
    searchPlaceholder: "Buscar lojas...",
    sortModes: ['CONSUMPTION_DESC', 'CONSUMPTION_ASC', 'ALPHA_ASC', 'ALPHA_DESC']
  },
  gridOptions: {
    columns: 'auto-fit',
    minCardWidth: '280px',
    gap: '16px',
    enableVirtualization: false
  }
});
```

It returns a comprehensive handle for programmatic control:

```javascript
grid.updateItems(newStoresArray);          // Update data
grid.setSelection(['store-2', 'store-4']); // Change selection
grid.applyFilter('search term');           // Apply search filter
grid.setSortMode('ALPHA_ASC');            // Change sorting
grid.destroy();                           // Cleanup
```

## Visual components

**Filter Bar (Top):**
- Quick search input with debounced filtering
- "Filtros & Ordenação" button (opens full filter modal)
- Selection counter "X de Y lojas selecionadas"
- Bulk action buttons (if enabled)

**Card Grid:**
- Responsive CSS Grid layout with configurable columns
- Cards rendered using provided `renderCard` function or default template
- Selection checkboxes on cards (if enabled)
- Loading states and empty states

**Integrated Filter Modal:**
- Full FilterOrderingModal (RFC-0021) implementation
- Seamless integration with grid state
- Maintains selection and sorting preferences

## ThingsBoard usage snippet

```javascript
// Inside widget controller.js
const container = document.getElementById('myio-filterable-grid');

const grid = MyIOLibrary.renderFilterableCardGrid(container, {
  items: entitiesData.map(entity => ({
    id: entity.entityId,
    label: entity.labelOrName,
    consumption: entity.val,
    deviceType: entity.deviceType,
    status: entity.connectionStatus,
    lastUpdate: entity.timaVal
  })),

  renderCard: (item, { onSelect, onAction, isSelected }) => {
    return MyIOLibrary.renderCardCompenteHeadOffice(container, {
      entityObject: item,
      handleActionDashboard: () => onAction('dashboard', item),
      handleActionReport: () => onAction('report', item),
      handleActionSettings: () => onAction('settings', item),
      handleSelect: onSelect,
      enableSelection: true
    });
  },

  onSelectionChange: (selectedIds) => {
    console.log('Selection changed:', selectedIds);
    updateWidgetState({ selectedStores: selectedIds });
  },

  onCardAction: (action, item) => {
    switch (action) {
      case 'dashboard': openEntityDashboard(item); break;
      case 'report': openEntityReport(item); break;
      case 'settings': openEntitySettings(item); break;
    }
  },

  filterOptions: {
    searchFields: ['label', 'deviceType'],
    sortModes: ['CONSUMPTION_DESC', 'CONSUMPTION_ASC', 'ALPHA_ASC', 'ALPHA_DESC']
  },

  gridOptions: {
    columns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  }
});

// Update data when widget receives new telemetry
function onDataUpdated(newData) {
  grid.updateItems(newData);
}
```

# Reference-level explanation

## 1) Package layout

```
src/
  components/
    filterable-grid/
      FilterableCardGrid.ts           // Core component
      FilterableCardGrid.css.ts       // CSS string export
      FilterableCardGrid.types.ts     // TypeScript interfaces
      FilterableCardGrid.utils.ts     // Helper functions
      index.ts                        // Re-export
```

Public export in `src/index.ts`:

```typescript
export { renderFilterableCardGrid } from './components/filterable-grid';
```

## 2) Function signature

```typescript
export function renderFilterableCardGrid(
  containerEl: HTMLElement,
  params: FilterableCardGridParams
): FilterableCardGridHandle;

interface FilterableCardGridParams {
  items: FilterableItem[];
  renderCard?: (item: FilterableItem, actions: CardActions) => HTMLElement | CardHandle;
  initialSelected?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onCardAction?: (action: string, item: FilterableItem) => void;
  onFilterChange?: (filter: FilterState) => void;

  enableFiltering?: boolean;          // default: true
  enableSorting?: boolean;            // default: true
  enableSelection?: boolean;          // default: true
  enableBulkActions?: boolean;        // default: false

  filterOptions?: FilterOptions;
  gridOptions?: GridOptions;
  i18n?: Partial<I18nDict>;
}

interface FilterableItem {
  id: string;
  label: string;
  consumption?: number | null;
  deviceType?: string;
  status?: string;
  [key: string]: any;  // Additional properties for custom rendering
}

interface CardActions {
  onSelect: (checked: boolean) => void;
  onAction: (action: string, item: FilterableItem) => void;
  isSelected: boolean;
}

interface FilterOptions {
  searchPlaceholder?: string;
  searchFields?: string[];
  sortModes?: SortMode[];
  showCounter?: boolean;
  showBulkActions?: boolean;
}

interface GridOptions {
  columns?: string;                   // CSS grid-template-columns
  minCardWidth?: string;
  gap?: string;
  enableVirtualization?: boolean;     // For 1000+ items
  virtualChunkSize?: number;
}

interface FilterableCardGridHandle {
  updateItems: (items: FilterableItem[]) => void;
  setSelection: (selectedIds: string[]) => void;
  getSelection: () => string[];
  applyFilter: (searchTerm: string) => void;
  setSortMode: (mode: SortMode) => void;
  openFilterModal: () => void;
  destroy: () => void;
  getContainer: () => HTMLElement;
}
```

## 3) Component architecture

```typescript
class FilterableCardGrid {
  private container: HTMLElement;
  private filterBar: HTMLElement;
  private gridContainer: HTMLElement;
  private filterModal: FilterModalHandle | null;
  private cardHandles: Map<string, CardHandle | HTMLElement>;
  private state: FilterableGridState;

  constructor(container: HTMLElement, params: FilterableCardGridParams) {
    this.container = container;
    this.state = this.normalizeParams(params);

    this.injectStyles();
    this.createDOM();
    this.setupEventListeners();
    this.renderInitial();
  }

  private createDOM(): void {
    this.container.innerHTML = `
      <div class="myio-filterable-grid">
        <div class="myio-filter-bar" style="display: ${this.state.enableFiltering ? 'flex' : 'none'}">
          <div class="search-section">
            <input type="text" class="search-input" placeholder="${this.state.filterOptions.searchPlaceholder}">
          </div>
          <div class="filter-section">
            <button class="filter-button">🔍 Filtros & Ordenação</button>
            <span class="selection-counter"></span>
          </div>
          <div class="bulk-actions" style="display: ${this.state.enableBulkActions ? 'flex' : 'none'}">
            <button class="bulk-export">Exportar Selecionados</button>
          </div>
        </div>

        <div class="myio-grid-container">
          <div class="myio-card-grid"></div>
          <div class="myio-empty-state" style="display: none;">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">Nenhum resultado encontrado</div>
            <div class="empty-desc">Tente ajustar os filtros de busca</div>
          </div>
          <div class="myio-loading-state" style="display: none;">
            <div class="loading-spinner"></div>
            <div>Carregando...</div>
          </div>
        </div>
      </div>
    `;

    this.filterBar = this.container.querySelector('.myio-filter-bar')!;
    this.gridContainer = this.container.querySelector('.myio-card-grid')!;
  }
}
```

## 4) CSS & styling

CSS injection with scoped styling following MYIO design system:

```css
.myio-filterable-grid {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.myio-filter-bar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--myio-card, #fff);
  border-radius: var(--myio-radius, 10px);
  border: 1px solid var(--myio-border, #e0e0e0);
  box-shadow: var(--myio-shadow, 0 2px 6px rgba(0,0,0,0.08));
}

.search-input {
  width: 300px;
  padding: 8px 12px;
  border: 1px solid var(--myio-border);
  border-radius: var(--myio-radius-sm, 6px);
  font-size: 14px;
}

.filter-button {
  background: #7C3AED;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: var(--myio-radius-sm);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.filter-button:hover {
  background: #6D28D9;
}

.selection-counter {
  font-size: 14px;
  color: var(--myio-text-muted, #666);
}

.myio-card-grid {
  display: grid;
  grid-template-columns: var(--grid-columns, repeat(auto-fit, minmax(280px, 1fr)));
  gap: var(--grid-gap, 16px);
  padding: 16px;
}

.myio-empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--myio-text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--myio-border);
  border-top: 3px solid #7C3AED;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

## 5) Filter integration

The component leverages the existing FilterOrderingModal (RFC-0021) implementation:

```typescript
private setupFilterModal(): void {
  if (!this.state.enableFiltering) return;

  const filterButton = this.filterBar.querySelector('.filter-button');
  filterButton?.addEventListener('click', () => {
    if (!this.filterModal) {
      this.filterModal = attachFilterOrderingModal({
        title: 'Filtros & Ordenação',
        items: this.state.items.map(item => ({
          id: item.id,
          label: item.label,
          consumption: item.consumption
        })),
        initialSelected: Array.from(this.state.selectedIds),
        initialSort: this.state.sortMode,
        onApply: ({ selected, sort }) => {
          this.handleFilterApply(selected, sort);
        }
      });
    }
    this.filterModal.open();
  });
}

private handleFilterApply(selectedIds: string[], sortMode: SortMode): void {
  this.state.selectedIds = new Set(selectedIds);
  this.state.sortMode = sortMode;

  this.updateSelectionCounter();
  this.rerenderGrid();

  this.state.onSelectionChange?.(Array.from(this.state.selectedIds));
  this.state.onFilterChange?.({
    selectedIds: Array.from(this.state.selectedIds),
    sortMode: this.state.sortMode,
    searchTerm: this.state.searchTerm
  });
}
```

## 6) Card rendering integration

```typescript
private renderCard(item: FilterableItem): HTMLElement {
  const cardContainer = document.createElement('div');
  cardContainer.className = 'myio-card-wrapper';
  cardContainer.setAttribute('data-item-id', item.id);

  const actions: CardActions = {
    onSelect: (checked: boolean) => this.handleCardSelection(item.id, checked),
    onAction: (action: string) => this.state.onCardAction?.(action, item),
    isSelected: this.state.selectedIds.has(item.id)
  };

  const cardElement = this.state.renderCard
    ? this.state.renderCard(item, actions)
    : this.renderDefaultCard(item, actions);

  if (cardElement instanceof HTMLElement) {
    cardContainer.appendChild(cardElement);
    this.cardHandles.set(item.id, cardElement);
  } else {
    // Handle CardHandle case
    cardContainer.appendChild(cardElement.getRoot());
    this.cardHandles.set(item.id, cardElement);
  }

  return cardContainer;
}

private renderDefaultCard(item: FilterableItem, actions: CardActions): HTMLElement {
  // Fallback card rendering if no custom renderCard provided
  const card = document.createElement('div');
  card.className = 'myio-default-card';
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">${item.label}</div>
      <input type="checkbox" ${actions.isSelected ? 'checked' : ''}>
    </div>
    <div class="card-body">
      <div class="consumption">${item.consumption || '—'} kWh</div>
      <div class="device-type">${item.deviceType || 'Unknown'}</div>
    </div>
    <div class="card-actions">
      <button data-action="dashboard">Dashboard</button>
      <button data-action="report">Report</button>
    </div>
  `;

  // Bind events
  const checkbox = card.querySelector('input[type="checkbox"]');
  checkbox?.addEventListener('change', (e) => {
    actions.onSelect((e.target as HTMLInputElement).checked);
  });

  card.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).getAttribute('data-action');
      if (action) actions.onAction(action);
    });
  });

  return card;
}
```

## 7) Performance optimizations

```typescript
private updateItems(newItems: FilterableItem[]): void {
  // Intelligent diff to minimize DOM manipulation
  const oldIds = new Set(this.state.items.map(item => item.id));
  const newIds = new Set(newItems.map(item => item.id));

  // Remove deleted items
  for (const oldId of oldIds) {
    if (!newIds.has(oldId)) {
      this.removeCard(oldId);
    }
  }

  // Add/update items
  for (const item of newItems) {
    if (oldIds.has(item.id)) {
      this.updateCard(item);
    } else {
      this.addCard(item);
    }
  }

  this.state.items = newItems;
  this.updateLayout();
}

private enableVirtualization(): void {
  if (!this.state.gridOptions.enableVirtualization) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Render card if in viewport
        const itemId = entry.target.getAttribute('data-item-id');
        if (itemId && !this.cardHandles.has(itemId)) {
          this.renderLazyCard(itemId);
        }
      }
    });
  }, { rootMargin: '100px' });

  // Observe card placeholders
  this.gridContainer.querySelectorAll('.card-placeholder').forEach(placeholder => {
    observer.observe(placeholder);
  });
}
```

## 8) Error handling & accessibility

```typescript
private validateParams(params: FilterableCardGridParams): void {
  if (!params.items || !Array.isArray(params.items)) {
    throw new Error('FilterableCardGrid: items must be a non-empty array');
  }

  if (params.items.some(item => !item.id || !item.label)) {
    console.warn('FilterableCardGrid: All items must have id and label properties');
  }
}

private setupAccessibility(): void {
  // Add ARIA labels and roles
  this.gridContainer.setAttribute('role', 'grid');
  this.gridContainer.setAttribute('aria-label', 'Filterable card grid');

  const searchInput = this.filterBar.querySelector('.search-input');
  searchInput?.setAttribute('aria-label', 'Search cards');

  // Keyboard navigation
  this.gridContainer.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      this.navigateCards(e.key === 'ArrowRight' ? 'next' : 'prev');
      e.preventDefault();
    }
  });
}
```

# Drawbacks

- **Bundle size**: Combines multiple features into a single component, increasing overall bundle size
- **Complexity**: More complex than individual components, potentially harder to debug
- **Flexibility**: May be less flexible than separate components for edge cases
- **Learning curve**: Developers need to understand integrated component instead of familiar separate pieces

# Rationale and alternatives

## Why this design?

**Integrated approach** reduces complexity for the most common use case (filtered card grids) while maintaining the ability to use separate components when needed.

**Atomic packaging** ensures consistent behavior and reduces integration overhead in ThingsBoard widgets.

**Leveraging existing components** (FilterOrderingModal) maximizes code reuse while providing a unified interface.

## Alternative approaches considered

**Alternative 1: Keep separate FilterOrderingModal + card rendering**
- **Rationale for not choosing**: Increases integration complexity and state synchronization overhead

**Alternative 2: Extend existing card components with filtering**
- **Rationale for not choosing**: Would pollute card component APIs with filtering concerns

**Alternative 3: Create a higher-order component wrapper**
- **Rationale for not choosing**: Less intuitive API and harder to optimize performance

## Impact of not implementing

- Continued integration complexity in ThingsBoard widgets
- Duplicated filtering logic across implementations
- Higher maintenance burden for dashboard development
- Inconsistent filtering behavior across different MYIO interfaces

# Prior art

- FilterOrderingModal (RFC-0021) for proven filtering patterns
- `renderCardCompenteHeadOffice` (RFC-0007) for atomic card component design
- Modern data grid libraries (AG-Grid, React Table) for performance patterns
- MYIO existing dashboard implementations

# Unresolved questions

1. **Virtualization threshold**: At what item count should virtualization automatically enable?
2. **Custom sorting**: Should we support custom sort functions beyond the standard modes?
3. **Bulk actions**: What standard bulk actions should be included by default?
4. **Theme variants**: Should we support multiple visual themes?
5. **Mobile optimization**: How should the grid adapt on mobile devices?

# Future possibilities

- **Advanced filtering**: Date ranges, numeric ranges, categorical filters
- **Drag-and-drop reordering**: Integration with existing DraggableCard component
- **Real-time updates**: WebSocket integration for live data updates
- **Export capabilities**: Built-in CSV/PDF export of filtered data
- **Analytics integration**: Built-in tracking of filter usage patterns
- **Column view mode**: Alternative to grid view for tabular data display

# Security considerations

- **Input sanitization**: All search inputs and filter values are properly sanitized
- **XSS prevention**: No innerHTML injection from user data
- **Event handler cleanup**: Proper cleanup prevents memory leaks
- **Data validation**: Item IDs and other identifiers are validated before use

# Testing plan

## Unit tests (Jest + JSDOM)
- Component initialization with various configurations
- Filter integration and state synchronization
- Selection handling and bulk operations
- Search functionality and debouncing
- Card rendering with custom and default templates
- Performance with large datasets (1000+ items)

## Integration tests
- FilterOrderingModal integration
- ThingsBoard widget integration
- Card component compatibility testing

## Visual regression tests
- Grid layouts at different screen sizes
- Filter modal appearance and behavior
- Loading and empty states
- Dark/light theme variants

## Performance tests
- Rendering time with 100, 500, 1000+ items
- Memory usage during updates
- Virtual scrolling effectiveness
- Filter response times

# Acceptance criteria

- ✅ Exported as `MyIOLibrary.renderFilterableCardGrid`
- ✅ Integrates seamlessly with existing FilterOrderingModal
- ✅ Works with custom card renderers and provides default fallback
- ✅ Handles selection state synchronization correctly
- ✅ Responsive grid layout works across device sizes
- ✅ Search and sorting perform efficiently with 500+ items
- ✅ No memory leaks during component lifecycle
- ✅ Keyboard accessible (Tab, Arrow keys, Enter, Escape)
- ✅ Unit tests achieve 95%+ coverage
- ✅ Example ThingsBoard integration documented

# Migration guide

## Current approach (separate components)
```javascript
// Before: Multiple components to manage
const filterModal = attachFilterOrderingModal(container, { ... });
entities.forEach(entity => {
  const card = renderCardComponent(cardContainer, { ... });
  // Manual state synchronization required
});
```

## New integrated approach
```javascript
// After: Single component handles everything
const grid = MyIOLibrary.renderFilterableCardGrid(container, {
  items: entities,
  renderCard: (item, actions) => renderCardComponent(item, actions),
  onSelectionChange: (ids) => handleSelectionChange(ids),
  enableFiltering: true,
  enableSelection: true
});
```

# Implementation phases

## Phase 1: Core component (Week 1-2)
- Basic FilterableCardGrid class implementation
- CSS styling and responsive grid
- Search functionality with debouncing
- Basic card rendering and selection

## Phase 2: Filter integration (Week 3)
- FilterOrderingModal integration
- State synchronization between filter and grid
- Sort mode handling
- Selection counter and bulk actions

## Phase 3: Performance & polish (Week 4)
- Virtual scrolling for large datasets
- Error handling and accessibility improvements
- Loading and empty states
- Documentation and examples

## Phase 4: Testing & deployment (Week 5)
- Comprehensive test suite
- ThingsBoard widget integration examples
- Performance benchmarking
- Production deployment

# Documentation plan

## API documentation
- Complete TypeScript interface documentation
- Props and configuration options reference
- Event handling patterns
- Performance tuning guidelines

## Usage examples
- Basic ThingsBoard widget integration
- Custom card renderer examples
- Advanced filtering configurations
- Performance optimization patterns

## Migration guide
- Step-by-step migration from separate components
- Common pitfalls and solutions
- Performance comparison benchmarks

This RFC provides a comprehensive foundation for implementing a unified filterable card grid component that combines the power of existing MYIO components while simplifying integration and improving developer experience.