# RFC-0021: Filter & Ordering Modal (Multi-Select + Sort) for MYIO

- **RFC**: 0021
- **Title**: Filter & Ordering Modal (Multi-Select + Sort) for MYIO
- **Author(s)**: Code Assist / MYIO Frontend Guild
- **Status**: Draft
- **Created**: 2025-09-26
- **Target Package**: @myio/js-library (vanilla wrapper-first; React/Angular adapters optional)

## Summary

Introduce a responsive Filter & Ordering Modal that enables users to multi-select "Stores/Assets" through chip-based UI with comprehensive filtering and sorting capabilities. The modal provides Select all, Clear, Apply, Reset, and Close actions with debounced client-side search functionality. Users can sort the list by Consumption ↓ (default), Consumption ↑, A→Z, Z→A, with deterministic tiebreakers. The modal features a purple header matching MYIO's design palette with title and live counters displaying total stores and selected count. The component ensures full accessibility (focus trap, ARIA), keyboard navigation, and high performance for 1k+ items while maintaining state persistence until dismissed or reset.

## Motivation

Filtering and ordering functionality is core to MYIO dashboards. Current implementations vary across different screens and frameworks, leading to inconsistent user experiences and implementation drift. This RFC defines a single, polished, reusable modal component with consistent behavior, styling, and API that reduces user friction and development complexity.

The standardized component addresses several key pain points:
- **Consistency**: Unified UX across all MYIO dashboard interfaces
- **Performance**: Optimized for large datasets (1k+ items) with virtualization
- **Accessibility**: Full A11y compliance with screen reader support and keyboard navigation
- **Maintainability**: Single source of truth reducing code duplication

## Guide-level explanation

### User Flow

The Filter & Ordering Modal provides an intuitive interface for managing store selection and sorting preferences:

1. **Modal Opening**: User triggers the modal through a filter/ordering action
2. **Header Display**: Shows title "Filtros & Ordenação" with live counters (e.g., "Stores: 124 • Selected: 17") and close (×) button
3. **Quick Actions**: Top-level "Select all" and "Clear" buttons for bulk operations
4. **Search Interface**: Real-time search input with 200ms debouncing for instant filtering
5. **Item Selection**: Grid of selectable chips (two-column on desktop, single column on mobile) with:
   - Visual checkbox states (checked/unchecked)
   - Store name labels
   - Filled appearance for selected items, outlined for unselected
6. **Sorting Options**: Radio button group with four modes:
   - Consumption ↓ (default)
   - Consumption ↑
   - A→Z (alphabetical ascending)
   - Z→A (alphabetical descending)
   - Note: "When consumption is equal, alphabetical order is applied"
7. **Action Buttons**: Sticky footer with "Apply" (primary) and "Reset" (secondary) buttons
8. **Modal Dismissal**: Apply emits selection/sort state and closes; Reset restores initial state; Esc or × closes without changes

### Visual Specification

The modal follows MYIO's design system with specific styling requirements:

- **Header**: Purple background (`--myio-purple-600: #4B0082`) with white text, 56-64px height, 16px padding, rounded corners (16px 16px 0 0)
- **Card Container**: White background, 16px border-radius, elevated shadow (0 8px 24px rgba(0,0,0,0.12))
- **Chips**: 44px height, 12px border-radius, 2px border in `--myio-purple-500`
  - Selected state: filled background (`--myio-purple-50`) with checkmark icon
  - Grid layout: 12-16px gap, responsive (2 columns ≥768px, 1 column <768px)
- **Footer**: Sticky positioning with elevation, 12-16px padding, right-aligned buttons
- **Search Input**: Left search icon (🔍), clear suffix icon (✕), 12px border-radius
- **Radio Group**: Four sorting options with default Consumption ↓ selection

## Reference-level explanation

### Data Model

```typescript
export type StoreId = string;

export interface StoreItem {
  id: StoreId;
  label: string;              // e.g., "Escada Rolante 7"
  consumption?: number | null;// Wh/kWh (used for sort). null treated as -Infinity
}

export type SortMode = 'CONSUMPTION_DESC' | 'CONSUMPTION_ASC' | 'ALPHA_ASC' | 'ALPHA_DESC';

export interface FilterState {
  /** All store IDs present in the modal. */
  allIds: StoreId[];

  /** Selected store IDs (subset of allIds). */
  selected: Set<StoreId>;

  /** Current visible filter query (case-insensitive). */
  query: string;

  /** Current sort strategy. */
  sort: SortMode;
}

export interface FilterModalProps {
  title?: string;                     // default: "Filtros & Ordenação"
  items: StoreItem[];                 // required
  initialSelected?: StoreId[];        // default: []
  initialSort?: SortMode;             // default: 'CONSUMPTION_DESC'
  autoCloseOnApply?: boolean;         // default: true
  onApply: (payload: { selected: StoreId[]; sort: SortMode }) => void;
  onClose?: () => void;
  i18n?: Partial<I18nDict>;
}

export interface I18nDict {
  selectAll: string;     // "Selecionar todas"
  clear: string;         // "Limpar"
  searchPlaceholder: string; // "Buscar lojas..."
  sortingTitle: string;  // "Ordenação"
  consumptionDesc: string; // "Consumo ↓ (padrão)"
  consumptionAsc: string;  // "Consumo ↑"
  aToZ: string;            // "A → Z"
  zToA: string;            // "Z → A"
  tieNote: string;         // "Caso o consumo seja o mesmo é considerada a ordem alfabética."
  apply: string;           // "Aplicar"
  reset: string;           // "Resetar"
  totalLabel: string;      // "Lojas"
  selectedLabel: string;   // "Selecionadas"
  closeLabel: string;      // "Fechar"
}
```

### Sorting Algorithm

The sorting system implements deterministic ordering with tiebreaker rules:

1. **Consumption ↓ (default)**: Consumption descending, null values last, ties resolved by label ascending then id
2. **Consumption ↑**: Consumption ascending, null values last, ties resolved by label ascending then id
3. **A→Z**: Label ascending (locale-aware pt-BR/en-US fallback), ties resolved by id
4. **Z→A**: Label descending, ties resolved by id

```typescript
function sortItems(list: StoreItem[], mode: SortMode): StoreItem[] {
  const byLabelAsc = (a: StoreItem, b: StoreItem) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) || (a.id > b.id ? 1 : -1);

  const byLabelDesc = (a: StoreItem, b: StoreItem) => -byLabelAsc(a, b);

  const num = (x?: number | null) => (x == null ? Number.NEGATIVE_INFINITY : x);

  switch (mode) {
    case 'CONSUMPTION_DESC':
      return [...list].sort((a, b) => num(b.consumption) - num(a.consumption) || byLabelAsc(a, b));
    case 'CONSUMPTION_ASC':
      return [...list].sort((a, b) => num(a.consumption) - num(b.consumption) || byLabelAsc(a, b));
    case 'ALPHA_ASC':
      return [...list].sort(byLabelAsc);
    case 'ALPHA_DESC':
      return [...list].sort(byLabelDesc);
  }
}
```

### Search Implementation

Search functionality normalizes text for diacritics and case-insensitive matching:

```typescript
function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function visibleItems(state: FilterState, itemsById: Map<StoreId, StoreItem>): StoreId[] {
  const sorted = sortItems([...itemsById.values()], state.sort);
  if (!state.query) return sorted.map(x => x.id);
  const q = normalize(state.query);
  return sorted.filter(x => normalize(x.label).includes(q)).map(x => x.id);
}
```

### State Management

The modal implements a state machine pattern for predictable behavior:

```
IDLE → (open) → OPEN
OPEN:
  on SEARCH(query)         → update query, recompute visible
  on TOGGLE(id)            → toggle in selected
  on SELECT_ALL()          → add all visible to selected
  on CLEAR()               → remove all (or visible when query active)
  on SORT(mode)            → set sort, recompute order
  on RESET()               → state = initial*, query="", sort=initialSort
  on APPLY()               → emit {selected, sort}, (close if autoCloseOnApply)
  on CLOSE() or ESC        → close without changes
```

### DOM Structure

```html
<div class="myio-modal" role="dialog" aria-modal="true" aria-labelledby="myioFilterTitle">
  <div class="myio-card" data-elev="3">
    <header class="myio-header --purple">
      <h2 id="myioFilterTitle">Filtros &amp; Ordenação</h2>
      <div class="myio-counters" aria-live="polite">
        <span class="counter">
          <strong class="value" data-total>124</strong> <span data-i18n="totalLabel">Lojas</span>
        </span>
        <span class="sep">•</span>
        <span class="counter">
          <strong class="value" data-selected>17</strong> <span data-i18n="selectedLabel">Selecionadas</span>
        </span>
      </div>
      <button class="icon-btn close" aria-label="Fechar" data-close>×</button>
    </header>

    <section class="myio-toolbar">
      <div class="actions">
        <button class="btn ghost" data-select-all>Selecionar todas</button>
        <button class="btn ghost" data-clear>Limpar</button>
      </div>
      <div class="search">
        <input type="text" placeholder="Buscar lojas..." aria-label="Buscar" data-search />
        <button class="icon-btn" aria-label="Limpar busca" data-clear-search hidden>✕</button>
      </div>
    </section>

    <section class="myio-list" role="listbox" aria-multiselectable="true" data-virtualized>
      <button role="option" aria-selected="true" class="chip selected" data-id="store-1">
        <span class="checkbox" aria-hidden="true">✔</span>
        <span class="label">Bomba Condensada 1</span>
      </button>
    </section>

    <section class="myio-sorting">
      <h3>Ordenação</h3>
      <label><input type="radio" name="sort" value="CONSUMPTION_DESC" checked /> Consumo ↓ (padrão)</label>
      <label><input type="radio" name="sort" value="CONSUMPTION_ASC" /> Consumo ↑</label>
      <label><input type="radio" name="sort" value="ALPHA_ASC" /> A → Z</label>
      <label><input type="radio" name="sort" value="ALPHA_DESC" /> Z → A</label>
      <p class="hint">Caso o consumo seja o mesmo é considerada a ordem alfabética.</p>
    </section>

    <footer class="myio-footer">
      <button class="btn secondary" data-reset>Resetar</button>
      <button class="btn primary" data-apply>Aplicar</button>
    </footer>
  </div>
</div>
```

### Public API

```typescript
export interface FilterModalHandle {
  open: () => void;
  close: () => void;
  getState: () => { selected: StoreId[]; sort: SortMode };
  setSelection: (ids: StoreId[]) => void;
  setSort: (sort: SortMode) => void;
  destroy: () => void;
}

/** Attaches the modal to `document.body` and returns a handle. */
export function attachFilterOrderingModal(props: FilterModalProps): FilterModalHandle;
```

### Accessibility Features

- `role="dialog"` with `aria-modal="true"` and `aria-labelledby` header reference
- Focus trap within modal card with initial focus on search input
- Keyboard navigation: Tab/Shift+Tab cycling, Esc to close
- Chip interaction: Enter/Space to toggle selection
- List navigation: Arrow keys for virtual focus movement
- Bulk selection: Ctrl+A (Cmd+A) for select all visible
- Live region updates for selection counters (`aria-live="polite"`)
- Radio group accessible via arrow keys

### Performance Optimizations

- **Virtualization**: Recommended above 200 items with built-in windowing support
- **Stable Keys**: Items identified by stable `id` property
- **Memoization**: Search normalization cached per item (`labelNorm`)
- **Computed Sorting**: Memoized array computation based on items + sort mode
- **Debounced Search**: 200ms debouncing to prevent excessive filtering

### Design Tokens

```css
:root {
  /* Core purple scale */
  --myio-purple-50:  #F3E8FF;
  --myio-purple-100: #E9D5FF;
  --myio-purple-200: #D8B4FE;
  --myio-purple-300: #C084FC;
  --myio-purple-400: #A855F7;
  --myio-purple-500: #8B5CF6; /* borders/active outlines */
  --myio-purple-600: #7C3AED; /* header bg */
  --myio-purple-700: #6D28D9;

  /* Text & surfaces */
  --myio-surface: #FFFFFF;
  --myio-text: #1F2937;
  --myio-text-muted: #6B7280;
  --myio-border: #E5E7EB;

  /* Focus */
  --myio-focus: #2563EB;
}
```

### Example Usage

```typescript
import { attachFilterOrderingModal } from '@myio/js-library';

const handle = attachFilterOrderingModal({
  title: 'Filtros & Ordenação',
  items: storesArray, // [{id, label, consumption}]
  initialSelected: preselectedIds,
  onApply: ({ selected, sort }) => {
    renderCards(selected, sort);
  },
});

// Open from a button click
document.getElementById('openFilters')!.addEventListener('click', handle.open);
```

## Drawbacks

- **Bundle Size**: Additional JavaScript and CSS for modal functionality increases library size
- **Complexity**: State management and accessibility requirements add implementation complexity
- **Performance**: Large datasets (>1k items) may require virtualization, adding complexity
- **Mobile UX**: Limited screen space may constrain usability on very small devices
- **Framework Coupling**: While designed as vanilla JS, integration patterns may vary across frameworks

## Rationale and alternatives

### Why This Design

**Chip-based Selection**: Provides clear visual feedback and familiar interaction patterns from modern UI libraries. Alternative list-based selection would be less space-efficient and harder to scan.

**Modal Approach**: Dedicated modal prevents context switching and allows focus on filtering task. Alternative inline filtering would compete with main content for space.

**Client-side Processing**: Enables instant feedback and reduces server load. Server-side filtering could be added later for very large datasets.

**Vanilla JS First**: Ensures maximum compatibility across frameworks and reduces dependency coupling.

### Alternative Approaches Considered

1. **Dropdown-based Filtering**: Less visual feedback, harder to manage multiple selections
2. **Sidebar Panel**: Takes permanent screen space, not suitable for all layouts
3. **Inline Table Filtering**: Competes with content, limited sorting options
4. **Framework-specific Components**: Would require maintaining multiple implementations

## Prior art

### Similar Implementations

- **Material-UI Select**: Multi-select with chips, but lacks integrated sorting
- **Ant Design Transfer**: Similar selection pattern but different UX paradigm
- **Shopify Polaris Filters**: Close inspiration for combined filtering/sorting
- **GitHub Repository Filters**: Good example of search + multi-select

### Design System References

- **MYIO Current Modals**: Maintains consistency with existing modal patterns
- **ThingsBoard Widget Filters**: Similar use case in dashboard context
- **Material Design**: Chip selection patterns and modal behavior

## Unresolved questions

1. **Clear Behavior**: Should "Clear" without active query prompt confirmation when removing many selections? Current default is no confirmation.

2. **Apply Mode**: Should there be an "Apply without closing" secondary mode for iterative filtering? Current default keeps modal open until explicit close.

3. **Selection Priority**: Should selected items appear first in the list regardless of sort order? This could improve UX but breaks sort consistency.

4. **Batch Operations**: Should there be keyboard shortcuts for common operations (Ctrl+A, Delete for clear, etc.)?

5. **Backend Integration**: How should server-side search/sort be integrated in future iterations without breaking the current API?

6. **Performance Thresholds**: What are the exact item count thresholds for enabling virtualization automatically?

## Future possibilities

### Enhanced Filtering

- **Grouping Support**: Category-based organization (e.g., by store type, region)
- **Advanced Search**: Support for operators like AND, OR, NOT with multiple fields
- **Saved Filters**: Persistence of commonly used filter combinations

### Performance Improvements

- **Virtual Scrolling**: More sophisticated virtualization for ultra-large datasets
- **Web Workers**: Offload sorting/filtering to background thread for >10k items
- **Progressive Loading**: Server-side pagination with client-side caching

### UX Enhancements

- **Drag and Drop**: Manual ordering capability for custom sort preferences
- **Bulk Actions**: Apply operations to selected items directly from modal
- **Preview Mode**: Show filtered results in background before applying

### Integration Features

- **Analytics**: Track usage patterns and optimize default behaviors
- **Tour/Help**: Guided introduction for first-time users
- **Keyboard Shortcuts**: Power user features for efficient navigation

### Framework Adapters

- **React Hooks**: `useFilterModal()` hook for React integration
- **Angular Service**: Injectable service for Angular applications
- **Vue Composable**: Composable API for Vue.js integration

The RFC provides a comprehensive foundation that can evolve to support these advanced features while maintaining backward compatibility and consistent user experience.