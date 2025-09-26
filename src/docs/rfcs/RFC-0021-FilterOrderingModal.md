RFC-0021: Filter & Ordering Modal (Multi-Select + Sort) for MYIO

Status: Draft

Authors: Code Assist / MYIO Frontend Guild

Stakeholders: Head Office Dashboards, ThingsBoard Widgets, MYIO JS Library

Created: 2025-09-26

Target Package: @myio/js-library (vanilla wrapper-first; React/Angular adapters optional)

1. Summary

Introduce a responsive Filter & Ordering Modal that lets users:

Multi-select “Stores/Assets” (chips) with Select all, Clear, Apply, Reset, and Close actions.

Search within the list (client-side, debounced).

Sort the list by Consumption ↓ (default), Consumption ↑, A→Z, Z→A, with deterministic tiebreakers.

See a purple header (MYIO palette) with title and live counters: Total stores and Selected.

Persist choices until dismissed or reset, with full A11y (focus trap, ARIA), keyboard navigation, and high performance for 1k+ items.

The component must be buildable from zero using this document only.

2. Motivation

Filtering/ordering is core to MYIO dashboards. Current UIs vary by screen and framework. This RFC defines a single, polished, reusable modal with consistent behavior, styling, and API, reducing user friction and implementation drift.

3. Guide-Level Explanation
3.1 User Flow

User opens Filters & Ordering modal.

Header shows:

Title: “Filtros & Ordenação”

Counters: Stores: 124 • Selected: 17

Close (×) button.

Top actions: Select all, Clear.

Search input filters the visible list instantly (debounced 200ms).

List of selectable chips (two-column grid on desktop, single column on mobile). Each chip shows:

Checkbox (checked/unchecked), label (store name).

Selected chips appear filled; unselected chips are outlined.

Sorting section:

Radio buttons: Consumption ↓ (default), Consumption ↑, A→Z, Z→A.

Note: “When consumption is equal, alphabetical order is applied.”

Sticky footer: Apply (primary) and Reset (secondary).

Apply emits the selection and sort model and closes (configurable).

Reset returns to initial props (also clears search).

Esc or header × closes the modal without applying changes.

3.2 Visual Spec (Essential)

Header: MYIO Purple background with white text.

--myio-purple-600: #4B0082 (example; replace with design token)

Height: 56–64px, padding: 16px, border-radius: 16px 16px 0 0 (modal card).

Card: White, radius 16px, shadow 0 8px 24px rgba(0,0,0,0.12).

Chips:

Height 44px; radius 12px; border 2px --myio-purple-500.

Selected: filled bg --myio-purple-50 with inner pill state badge.

Icon: checkmark inside a rounded square.

Grid: Gap 12–16px; 2 columns ≥ 768px, 1 column < 768px.

Footer: Sticky, elevation, padding 12–16px; buttons right-aligned.

Search: Left icon (🔍), clear (✕) suffix icon; radius 12px.

Radio group: Four options; default Consumption ↓.

Provide final hex values via tokens in §6.

4. Reference-Level Explanation
4.1 Data Model (TypeScript)
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

4.2 Sorting Rules

Consumption ↓ (default): consumption descending; null last. Ties → label ascending, then id.

Consumption ↑: ascending; null last. Ties → label ascending, then id.

A→Z: label ascending (locale-aware pt-BR/en-US fallback); ties → id.

Z→A: label descending; ties → id.

4.3 Search Filter

Normalize label with case-fold and diacritics removal.

Filter after sorting for predictable keyboard order.

Debounce input 200ms. Empty query restores full list.

Select all affects filtered result when a query is active; affects all items when query empty.

4.4 State Machine
IDLE → (open) → OPEN
OPEN:
  on SEARCH(query)         → update query, recompute visible
  on TOGGLE(id)            → toggle in selected
  on SELECT_ALL()          → add all visible to selected
  on CLEAR()               → remove all (or visible when query active?)  [Decision: visible only when query active; else all]
  on SORT(mode)            → set sort, recompute order
  on RESET()               → state = initial*, query="", sort=initialSort
  on APPLY()               → emit {selected, sort}, (close if autoCloseOnApply)
  on CLOSE() or ESC        → close without changes


initial* equals initialSelected intersected with current items.

4.5 DOM Structure (Framework-agnostic)
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
      <!-- item -->
      <button role="option" aria-selected="true" class="chip selected" data-id="store-1">
        <span class="checkbox" aria-hidden="true">✔</span>
        <span class="label">Bomba Condensada 1</span>
      </button>
      <!-- repeat -->
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

4.6 Accessibility

role="dialog" + aria-modal="true", labelled by header title.

Focus trap within the card; initial focus on search; Tab cycles, Shift+Tab back.

Keyboard:

Esc → Close.

Enter on focused chip → toggle.

Space on chip → toggle (prevent scroll).

Ctrl+A (or Cmd+A) in list → Select all visible.

Arrow Up/Down to move virtual focus between chips.

Live region updates selection counters (aria-live="polite").

Radio group accessible via arrow keys.

4.7 Performance

Virtualization recommended above 200 items. Provide minimal built-in windowing (data-virtualized).

Stable keys by id.

Search normalized once per item and cached (labelNorm).

Sorting computed on a memoized array of items + sort.

4.8 Public API (Vanilla Wrapper)
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


The implementation must not assume React/Angular. Adapters can wrap the vanilla API.

4.9 Events & Analytics (optional)

Emit custom events on the root card element:

myio:filter:open

myio:filter:apply { selectedCount, sort, queryLength, durationMs }

myio:filter:close

myio:filter:select_all { scope: 'visible' | 'all' }

myio:filter:clear { scope: 'visible' | 'all' }

5. Algorithms (Pseudocode)
5.1 Normalize (diacritics, case)
function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

5.2 Compute Visible Items
function visibleItems(state: FilterState, itemsById: Map<StoreId, StoreItem>): StoreId[] {
  const sorted = sortItems([...itemsById.values()], state.sort);
  if (!state.query) return sorted.map(x => x.id);
  const q = normalize(state.query);
  return sorted.filter(x => normalize(x.label).includes(q)).map(x => x.id);
}

5.3 Select All / Clear
function selectAllVisible(state: FilterState, visible: StoreId[]): void {
  visible.forEach(id => state.selected.add(id));
}

function clearSelection(state: FilterState, visible: StoreId[], queryActive: boolean): void {
  if (queryActive) visible.forEach(id => state.selected.delete(id));
  else state.selected.clear();
}

5.4 Tiebreaking Sort
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

6. Design Tokens (MYIO)

Replace with the canonical tokens from the MYIO palette after design sign-off.

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

7. CSS Architecture (extract)
.myio-modal { position: fixed; inset: 0; background: rgba(0,0,0,.45);
  display:flex; justify-content:center; align-items:center; z-index: 9999; }
.myio-card { width:min(920px, 92vw); max-height:90vh; overflow:auto; background:var(--myio-surface);
  border-radius:16px; box-shadow:0 16px 48px rgba(0,0,0,.16); }

.myio-header { display:flex; align-items:center; gap:12px; padding:16px 20px; color:#fff;
  background: var(--myio-purple-600); position:sticky; top:0; z-index:1; border-radius:16px 16px 0 0; }
.myio-header h2 { font-size:18px; font-weight:700; margin:0; }
.myio-counters { margin-left:auto; display:flex; align-items:center; gap:8px; opacity:.95; }
.myio-header .close { margin-left:12px; background:transparent; color:#fff; font-size:20px; }

.myio-toolbar { display:flex; gap:12px; align-items:center; padding:12px 20px; flex-wrap:wrap; }
.myio-toolbar .actions { display:flex; gap:8px; }
.myio-toolbar .search { margin-left:auto; position:relative; flex:1 1 320px; }
.myio-toolbar .search input { width:100%; height:40px; padding:0 36px 0 36px; border-radius:12px; border:1px solid var(--myio-border); }

.myio-list { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px; padding:0 20px 12px; }
@media (max-width: 768px) { .myio-list { grid-template-columns: 1fr; } }

.chip { display:flex; align-items:center; gap:10px; height:44px; border-radius:12px;
  border:2px solid var(--myio-purple-500); background:#fff; padding:0 14px; cursor:pointer; }
.chip.selected { background: var(--myio-purple-50); }
.chip .checkbox { width:22px; height:22px; border-radius:6px; border:2px solid var(--myio-purple-500);
  display:flex; align-items:center; justify-content:center; font-size:14px; }

.myio-sorting { padding:12px 20px 0; }
.myio-sorting h3 { margin:8px 0 6px; font-size:14px; color: var(--myio-text-muted); }
.myio-sorting label { display:inline-flex; gap:8px; align-items:center; margin-right:16px; }

.myio-footer { position:sticky; bottom:0; background:#fff; padding:12px 20px; display:flex; gap:8px; justify-content:flex-end;
  border-top:1px solid var(--myio-border); border-radius:0 0 16px 16px; }
.btn.primary { background: var(--myio-purple-600); color:#fff; border-radius:12px; padding:10px 16px; }
.btn.secondary { background:#fff; border:1px solid var(--myio-border); border-radius:12px; padding:10px 16px; }
.btn.ghost { background:transparent; border:1px solid var(--myio-border); border-radius:10px; padding:8px 12px; }

8. Example Usage
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

9. Edge Cases

0 items: Empty state message, disabled Select all; counters show 0.

All selected then Clear with a search query active: only clears visible by design.

Duplicated labels: Sorting uses id as tiebreaker.

No consumption data: Treated as -∞ for desc/asc; placed last; still tiebroken by label.

Very long labels: Truncate with text-overflow: ellipsis; and provide title tooltip.

10. Internationalization

All user strings pulled from i18n with defaults in PT-BR.

Sorting labels adapt based on language.

Locale-aware label comparison (use Intl.Collator).

11. Testing Strategy

Unit:

Sorting comparators (all 4 modes, with/without consumption).

Search normalization & diacritics.

Select all / clear semantics with and without active query.

Accessibility:

Axe-core pass; focus trap; keyboard interactions.

E2E:

Open → select subset → change sort → apply → assert payload.

Reset semantics restore initial state.

Performance:

2k items smoke test under 16ms per interaction (virtualized list).

12. Acceptance Criteria

Visual parity with screenshots (header purple, counters “Lojas N • Selecionadas M”).

Functional: multi-select chips, search, select-all, clear, sorting, apply, reset, close (Esc/×).

Deterministic sort and tiebreakers.

Accessible: screen-reader labels, focus trap, keyboard ops.

Mobile responsive: single column, sticky footer.

API stable (attachFilterOrderingModal) with docs and example.

13. Out of Scope

Persisting choices to backend.

Server-side search/sort (can be added later).

Grouping by category/type (future RFC).

14. Open Questions

Should Clear without query ask for confirmation when more than N selections would be removed? (Default: no)

Provide an “Apply without closing” secondary mode? (Default: off)

Expose selected-first ordering toggle? (Future)

15. Appendix: Minimal Vanilla JS Skeleton
// Pseudo-init (for implementers)
export function attachFilterOrderingModal(props) {
  const state = createInitialState(props);
  const dom = renderSkeleton(props);
  wireEvents(dom, state, props);
  return {
    open: () => open(dom),
    close: () => close(dom),
    getState: () => ({ selected: [...state.selected], sort: state.sort }),
    setSelection: (ids) => { state.selected = new Set(ids); refreshCounters(dom, state); redrawList(dom, state, props); },
    setSort: (s) => { state.sort = s; redrawList(dom, state, props); },
    destroy: () => dom.root.remove()
  };
}


This RFC is intentionally exhaustive so a developer can implement the modal faithfully from scratch with consistent UX across MYIO.