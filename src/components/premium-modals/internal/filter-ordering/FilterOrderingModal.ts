// internal/filter-ordering/FilterOrderingModal.ts
export type StoreId = string;

export interface StoreItem {
  id: StoreId;
  label: string;
  consumption?: number | null; // kWh, null treated as -Infinity
}

export type SortMode = 'CONSUMPTION_DESC' | 'CONSUMPTION_ASC' | 'ALPHA_ASC' | 'ALPHA_DESC';

export interface FilterState {
  allIds: StoreId[];
  selected: Set<StoreId>;
  query: string;
  sort: SortMode;
}

export interface FilterModalProps {
  title?: string;
  items: StoreItem[];
  initialSelected?: StoreId[];
  initialSort?: SortMode;
  autoCloseOnApply?: boolean;
  onApply: (payload: { selected: StoreId[]; sort: SortMode }) => void;
  onClose?: () => void;
  i18n?: Partial<I18nDict>;
}

export interface I18nDict {
  selectAll: string;
  clear: string;
  searchPlaceholder: string;
  sortingTitle: string;
  consumptionDesc: string;
  consumptionAsc: string;
  aToZ: string;
  zToA: string;
  tieNote: string;
  apply: string;
  reset: string;
  totalLabel: string;
  selectedLabel: string;
  closeLabel: string;
}

export interface FilterModalHandle {
  open: () => void;
  close: () => void;
  getState: () => { selected: StoreId[]; sort: SortMode };
  setSelection: (ids: StoreId[]) => void;
  setSort: (sort: SortMode) => void;
  destroy: () => void;
}

const defaultI18n: I18nDict = {
  selectAll: 'Selecionar todas',
  clear: 'Limpar',
  searchPlaceholder: 'Buscar lojas...',
  sortingTitle: 'Ordenação',
  consumptionDesc: 'Consumo ↓ (padrão)',
  consumptionAsc: 'Consumo ↑',
  aToZ: 'A → Z',
  zToA: 'Z → A',
  tieNote: 'Caso o consumo seja o mesmo é considerada a ordem alfabética.',
  apply: 'Aplicar',
  reset: 'Resetar',
  totalLabel: 'Lojas',
  selectedLabel: 'Selecionadas',
  closeLabel: 'Fechar'
};

export class FilterOrderingModal {
  private state: FilterState;
  private props: FilterModalProps;
  private i18n: I18nDict;
  private dom: {
    overlay: HTMLElement;
    root: HTMLElement;
    card: HTMLElement;
    totalCounter: HTMLElement;
    selectedCounter: HTMLElement;
    searchInput: HTMLInputElement;
    listContainer: HTMLElement;
    sortRadios: NodeListOf<HTMLInputElement>;
    clearSearchBtn: HTMLButtonElement;
  } | null = null;

  private searchTimeout: number | null = null;
  private itemsById: Map<StoreId, StoreItem>;
  private initialState: { selected: Set<StoreId>; sort: SortMode };
  private openerEl: HTMLElement | null = null; // Add this property

  constructor(props: FilterModalProps) {
    this.props = props;
    this.i18n = { ...defaultI18n, ...props.i18n };

    this.itemsById = new Map(props.items.map(item => [item.id, item]));

    const initialSelected = new Set(props.initialSelected || []);
    const initialSort = props.initialSort || 'CONSUMPTION_DESC';

    this.state = {
      allIds: props.items.map(item => item.id),
      selected: new Set(initialSelected),
      query: '',
      sort: initialSort
    };

    this.initialState = {
      selected: new Set(initialSelected),
      sort: initialSort
    };
  }

  public open(): void {
    if (!this.dom) {
      this.createDOM();
    }

    this.openerEl = document.activeElement instanceof HTMLElement ? document.activeElement : null; // Store active element

    this.updateCounters();
    this.renderList();

    // Show modal with transitions
    this.dom!.overlay.setAttribute('aria-hidden', 'false');
    this.dom!.root.setAttribute('aria-hidden', 'false');

    // Lock body scroll without layout shift
    this.lockBodyScroll();

    // Add focus trap
    this.dom!.root.addEventListener('keydown', this.trapFocus);

    // Focus search input after animation
    setTimeout(() => {
      const search = this.dom!.searchInput || this.dom!.root.querySelector('button, input') as HTMLElement;
      if (search) search.focus();
    }, 200); // Wait for transition to complete

    // Emit open event
    this.emit('myio:filter:open', {});
  }

  public close(): void {
    if (this.dom) {
      this.dom.overlay.setAttribute('aria-hidden', 'true');
      this.dom.root.setAttribute('aria-hidden', 'true');

      // Restore focus to opener
      if (this.openerEl && document.contains(this.openerEl)) {
        this.openerEl.focus();
      }
      this.openerEl = null;

      // Unlock body scroll
      this.unlockBodyScroll();

      // Remove focus trap
      this.dom.root.removeEventListener('keydown', this.trapFocus);
    }

    this.emit('myio:filter:close', {});
    this.props.onClose?.();
  }

  private lockBodyScroll(): void {
    // Prevent scrollbar layout shift on desktop
    const hasScrollbar = document.documentElement.scrollHeight > document.documentElement.clientHeight;
    if (hasScrollbar) {
      const scrollBarW = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.paddingRight = `${scrollBarW}px`;
    }
    
    document.body.classList.add('body--myio-modal-open');
  }

  private unlockBodyScroll(): void {
    document.body.classList.remove('body--myio-modal-open');
    document.documentElement.style.paddingRight = '';
  }

  public getState(): { selected: StoreId[]; sort: SortMode } {
    return {
      selected: Array.from(this.state.selected),
      sort: this.state.sort
    };
  }

  public setSelection(ids: StoreId[]): void {
    this.state.selected = new Set(ids);
    this.updateCounters();
    this.renderList();
  }

  public setSort(sort: SortMode): void {
    this.state.sort = sort;
    this.renderList();

    // Update radio buttons
    if (this.dom) {
      this.dom.sortRadios.forEach(radio => {
        radio.checked = radio.value === sort;
      });
    }
  }

  public destroy(): void {
    if (this.dom) {
      this.close();
      this.dom.overlay.remove();
      this.dom.root.remove();
      this.dom = null;
    }
  }

  private trapFocus = (e: KeyboardEvent): void => {
    if (e.isComposing) return; // IME handling
    if (!this.dom || e.key !== 'Tab' || this.dom.root.getAttribute('aria-hidden') === 'true') return;

    const focusable = [...this.dom.root.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )].filter(el => {
      const htmlEl = el as HTMLElement;
      return !htmlEl.hasAttribute('disabled') &&
        htmlEl.tabIndex !== -1 &&
        htmlEl.offsetParent !== null; // visible check
    }) as HTMLElement[];
    
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }

  private createDOM(): void {
    // Guard against multiple instances (single instance policy)
    const existing = document.querySelector('.myio-modal-root');
    if (existing) {
      existing.remove();
    }

    // 1) Create overlay + root (portal to body)
    const overlay = document.createElement('div');
    overlay.className = 'myio-modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const root = document.createElement('div');
    root.className = 'myio-modal-root myio-modal-portal';
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'myioFilterTitle');

    // 2) Card
    const card = document.createElement('div');
    card.className = 'myio-modal-card';
    card.setAttribute('role', 'document'); // Enhanced ARIA support
    root.appendChild(card);

    // Prevent card clicks from bubbling to overlay
    card.addEventListener('click', (e) => e.stopPropagation());

    // 3) Render inner HTML of the modal into card
    card.innerHTML = `
      <header class="myio-header">
        <h2 id="myioFilterTitle">${this.props.title || 'Filtros & Ordenação'}</h2>
        <div class="myio-counters" aria-live="polite">
          <span class="counter">
            <strong class="value" data-total>0</strong> <span>${this.i18n.totalLabel}</span>
          </span>
          <span class="sep">•</span>
          <span class="counter">
            <strong class="value" data-selected>0</strong> <span>${this.i18n.selectedLabel}</span>
          </span>
        </div>
        <button class="icon-btn close" aria-label="${this.i18n.closeLabel}" data-close>×</button>
      </header>

      <section class="myio-toolbar">
        <div class="actions">
          <button class="btn ghost" data-select-all>${this.i18n.selectAll}</button>
          <button class="btn ghost" data-clear>${this.i18n.clear}</button>
        </div>
        <div class="search">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="${this.i18n.searchPlaceholder}" aria-label="Buscar" data-search />
            <button class="icon-btn clear-search" aria-label="Limpar busca" data-clear-search hidden>✕</button>
          </div>
        </div>
      </section>

      <section class="myio-list" role="listbox" aria-multiselectable="true" data-virtualized>
        <!-- Items will be rendered here -->
      </section>

      <section class="myio-sorting">
        <h3>${this.i18n.sortingTitle}</h3>
        <div class="radio-group">
          <label><input type="radio" name="sort" value="CONSUMPTION_DESC" checked /> ${this.i18n.consumptionDesc}</label>
          <label><input type="radio" name="sort" value="CONSUMPTION_ASC" /> ${this.i18n.consumptionAsc}</label>
          <label><input type="radio" name="sort" value="ALPHA_ASC" /> ${this.i18n.aToZ}</label>
          <label><input type="radio" name="sort" value="ALPHA_DESC" /> ${this.i18n.zToA}</label>
        </div>
        <p class="hint">${this.i18n.tieNote}</p>
      </section>

      <footer class="myio-footer">
        <button class="btn secondary" data-reset>${this.i18n.reset}</button>
        <button class="btn primary" data-apply>${this.i18n.apply}</button>
      </footer>
    `;

    // Add styles
    this.addStyles();

    // 4) Append to BODY to avoid parent stacking contexts
    document.body.appendChild(overlay);
    document.body.appendChild(root);

    const totalCounter = card.querySelector('[data-total]') as HTMLElement;
    const selectedCounter = card.querySelector('[data-selected]') as HTMLElement;
    const searchInput = card.querySelector('[data-search]') as HTMLInputElement;
    const listContainer = card.querySelector('.myio-list') as HTMLElement;
    const sortRadios = card.querySelectorAll('input[name="sort"]') as NodeListOf<HTMLInputElement>;
    const clearSearchBtn = card.querySelector('[data-clear-search]') as HTMLButtonElement;

    this.dom = {
      overlay,
      root,
      card,
      totalCounter,
      selectedCounter,
      searchInput,
      listContainer,
      sortRadios,
      clearSearchBtn
    };

    this.attachEventListeners();
  }

  private addStyles(): void {
    if (document.getElementById('myio-filter-styles')) return;

    const style = document.createElement('style');
    style.id = 'myio-filter-styles';
    style.textContent = `
      /* === Overlay / Scrim ==================================================== */
      .myio-modal-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(0, 0, 0, 0.50);   /* 50% dim */
        backdrop-filter: saturate(100%) blur(2px);
        z-index: 10000;                    /* above app UI */
        opacity: 0;
        pointer-events: none;
        transition: opacity 160ms ease-out;
        margin: 0 !important;              /* Reset any inherited margins */
        width: auto !important;            /* Reset any inherited width */
        height: auto !important;           /* Reset any inherited height */
        touch-action: none;                /* iOS overscroll prevention */
      }
      .myio-modal-overlay[aria-hidden="false"] {
        opacity: 1;
        pointer-events: auto;
      }

      /* === Card container ====================================================== */
      .myio-modal-root {
        position: fixed !important;        /* Force fixed positioning relative to viewport */
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 10001;                    /* above overlay */
        opacity: 0;
        pointer-events: none;
        transition: opacity 160ms ease-out;
        padding: 20px;                     /* Add padding for better mobile positioning */
        margin: 0 !important;              /* Reset any inherited margins */
        width: auto !important;            /* Reset any inherited width */
        height: auto !important;           /* Reset any inherited height */
        touch-action: none;                /* iOS overscroll prevention */
      }
      .myio-modal-root[aria-hidden="false"] {
        opacity: 1;
        pointer-events: auto;
      }

      /* === Card ================================================================ */
      .myio-modal-card {
        width: min(960px, 94vw);
        max-height: calc(100vh - 40px);    /* Account for padding */
        overflow: auto;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 24px 64px rgba(0,0,0,.28);
        transform: translateY(-12px) scale(0.98);
        transition: transform 160ms ease-out;
      }
      .myio-modal-root[aria-hidden="false"] .myio-modal-card {
        transform: translateY(0) scale(1);
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .myio-modal-overlay,
        .myio-modal-root,
        .myio-modal-card {
          transition: none !important;
          transform: none !important;
        }
        .myio-modal-root[aria-hidden="false"] .myio-modal-card {
          transform: none !important;
        }
      }

      /* Header stays purple (MYIO palette) and sticky */
      .myio-modal-card header.myio-header {
        position: sticky;
        top: 0;
        z-index: 1;
        padding: 16px 20px;
        background: var(--myio-purple-600, #7C3AED);
        color: #fff;
        border-radius: 16px 16px 0 0;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .myio-modal-card footer.myio-footer {
        position: sticky;
        bottom: 0;
        background: #fff;
        border-top: 1px solid var(--myio-border, #E5E7EB);
        padding: 12px 20px;
        border-radius: 0 0 16px 16px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      /* Prevent accidental stacking-context issues inside transformed parents */
      .myio-modal-portal {
        position: relative;
        z-index: 10000;
      }

      /* Optional: body lock when open */
      .body--myio-modal-open {
        overflow: hidden;
        overscroll-behavior: contain;
      }

      .myio-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        color: #fff;
        background: #7C3AED;
        position: sticky;
        top: 0;
        z-index: 1;
        border-radius: 16px 16px 0 0;
      }

      .myio-header h2 {
        font-size: 18px;
        font-weight: 700;
        margin: 0;
        flex: 1;
      }

      .myio-counters {
        display: flex;
        align-items: center;
        gap: 8px;
        opacity: 0.95;
      }

      .myio-header .close {
        background: transparent;
        color: #fff;
        font-size: 20px;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
      }

      .myio-header .close:hover {
        background: rgba(255,255,255,0.1);
      }

      .myio-toolbar {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 12px 20px;
        flex-wrap: wrap;
        border-bottom: 1px solid #E5E7EB;
      }

      .myio-toolbar .actions {
        display: flex;
        gap: 8px;
      }

      .myio-toolbar .search {
        margin-left: auto;
        flex: 1 1 320px;
        max-width: 400px;
      }

      .search-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .search-icon {
        position: absolute;
        left: 12px;
        z-index: 1;
        opacity: 0.5;
      }

      .myio-toolbar .search input {
        width: 100%;
        height: 40px;
        padding: 0 40px;
        border-radius: 12px;
        border: 1px solid #E5E7EB;
        font-size: 14px;
      }

      .clear-search {
        position: absolute;
        right: 8px;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        opacity: 0.5;
      }

      .clear-search:hover {
        opacity: 1;
      }

      .myio-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0,1fr));
        gap: 12px;
        padding: 16px 20px;
        max-height: 300px;
        overflow-y: auto;
      }

      @media (max-width: 768px) {
        .myio-list {
          grid-template-columns: 1fr;
        }
      }

      .chip {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 44px;
        border-radius: 12px;
        border: 2px solid #8B5CF6;
        background: #fff;
        padding: 0 14px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
      }

      .chip:hover {
        background: #F3E8FF;
      }

      .chip.selected {
        background: #F3E8FF;
        border-color: #7C3AED;
      }

      .chip .checkbox {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 2px solid #8B5CF6;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        color: #7C3AED;
      }

      .chip.selected .checkbox {
        background: #7C3AED;
        color: white;
      }

      .myio-sorting {
        padding: 16px 20px;
        border-top: 1px solid #E5E7EB;
      }

      .myio-sorting h3 {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
        color: #1F2937;
      }

      .radio-group {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 8px;
      }

      .myio-sorting label {
        display: flex;
        gap: 8px;
        align-items: center;
        cursor: pointer;
        font-size: 14px;
      }

      .myio-sorting input[type="radio"] {
        margin: 0;
      }

      .hint {
        font-size: 12px;
        color: #6B7280;
        margin: 8px 0 0 0;
        font-style: italic;
      }

      .myio-footer {
        position: sticky;
        bottom: 0;
        background: #fff;
        border-top: 1px solid #E5E7EB;
        padding: 12px 20px;
        border-radius: 0 0 16px 16px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .btn {
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn.primary {
        background: #7C3AED;
        color: #fff;
      }

      .btn.primary:hover {
        background: #6D28D9;
      }

      .btn.secondary {
        background: #fff;
        border: 1px solid #D1D5DB;
        color: #374151;
      }

      .btn.secondary:hover {
        background: #F9FAFB;
      }

      .btn.ghost {
        background: transparent;
        border: 1px solid #D1D5DB;
        color: #374151;
        padding: 8px 12px;
        font-size: 13px;
      }

      .btn.ghost:hover {
        background: #F3F4F6;
      }

      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #6B7280;
      }
    `;

    document.head.appendChild(style);
  }

  private attachEventListeners(): void {
    if (!this.dom) return;

    const { overlay, root, searchInput, clearSearchBtn, sortRadios } = this.dom;

    // Close handlers
    overlay.addEventListener('click', () => this.close());
    root.querySelector('[data-close]')?.addEventListener('click', () => this.close());

    // Escape key handler
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });

    // Search input
    searchInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.debounceSearch(query);

      if (query) {
        clearSearchBtn.hidden = false;
      } else {
        clearSearchBtn.hidden = true;
      }
    });

    // Clear search
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.hidden = true;
      this.updateQuery('');
    });

    // Toolbar actions
    root.querySelector('[data-select-all]')?.addEventListener('click', () => {
      this.selectAllVisible();
    });

    root.querySelector('[data-clear]')?.addEventListener('click', () => {
      this.clearSelection();
    });

    // Sort radios
    sortRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          this.setSort(radio.value as SortMode);
        }
      });
    });

    // Footer actions
    root.querySelector('[data-apply]')?.addEventListener('click', () => {
      this.apply();
    });

    root.querySelector('[data-reset]')?.addEventListener('click', () => {
      this.reset();
    });
  }

  private debounceSearch(query: string): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = window.setTimeout(() => {
      this.updateQuery(query);
    }, 200);
  }

  private updateQuery(query: string): void {
    this.state.query = query;
    this.renderList();
  }

  private selectAllVisible(): void {
    const visibleIds = this.getVisibleItems();
    visibleIds.forEach(id => this.state.selected.add(id));
    this.updateCounters();
    this.renderList();

    this.emit('myio:filter:select_all', {
      scope: this.state.query ? 'visible' : 'all'
    });
  }

  private clearSelection(): void {
    const visibleIds = this.getVisibleItems();
    const queryActive = this.state.query.length > 0;

    if (queryActive) {
      visibleIds.forEach(id => this.state.selected.delete(id));
    } else {
      this.state.selected.clear();
    }

    this.updateCounters();
    this.renderList();

    this.emit('myio:filter:clear', {
      scope: queryActive ? 'visible' : 'all'
    });
  }

  private apply(): void {
    const startTime = performance.now();

    this.props.onApply({
      selected: Array.from(this.state.selected),
      sort: this.state.sort
    });

    this.emit('myio:filter:apply', {
      selectedCount: this.state.selected.size,
      sort: this.state.sort,
      queryLength: this.state.query.length,
      durationMs: performance.now() - startTime
    });

    if (this.props.autoCloseOnApply !== false) {
      this.close();
    }
  }

  private reset(): void {
    this.state.selected = new Set(this.initialState.selected);
    this.state.sort = this.initialState.sort;
    this.state.query = '';

    if (this.dom) {
      this.dom.searchInput.value = '';
      this.dom.clearSearchBtn.hidden = true;

      this.dom.sortRadios.forEach(radio => {
        radio.checked = radio.value === this.state.sort;
      });
    }

    this.updateCounters();
    this.renderList();
  }

  private getVisibleItems(): StoreId[] {
    const sorted = this.sortItems([...this.itemsById.values()], this.state.sort);

    if (!this.state.query) {
      return sorted.map(x => x.id);
    }

    const query = this.normalize(this.state.query);
    return sorted
      .filter(x => this.normalize(x.label).includes(query))
      .map(x => x.id);
  }

  private normalize(s: string): string {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }

  private sortItems(list: StoreItem[], mode: SortMode): StoreItem[] {
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
      default:
        return [...list];
    }
  }

  private updateCounters(): void {
    if (!this.dom) return;

    this.dom.totalCounter.textContent = this.state.allIds.length.toString();
    this.dom.selectedCounter.textContent = this.state.selected.size.toString();
  }

  private renderList(): void {
    if (!this.dom) return;

    const visibleIds = this.getVisibleItems();

    if (visibleIds.length === 0) {
      this.dom.listContainer.innerHTML = `
        <div class="empty-state">
          ${this.state.query ? 'Nenhuma loja encontrada com o filtro aplicado.' : 'Nenhuma loja disponível.'}
        </div>
      `;
      return;
    }

    this.dom.listContainer.innerHTML = visibleIds
      .map(id => this.renderChip(id))
      .join('');

    // Attach click handlers
    this.dom.listContainer.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.getAttribute('data-id')!;
        this.toggleItem(id);
      });
    });
  }

  private renderChip(id: StoreId): string {
    const item = this.itemsById.get(id)!;
    const isSelected = this.state.selected.has(id);

    return `
      <button role="option" aria-selected="${isSelected}"
              class="chip ${isSelected ? 'selected' : ''}"
              data-id="${id}">
        <span class="checkbox" aria-hidden="true">${isSelected ? '✓' : ''}</span>
        <span class="label" title="${item.label}">${item.label}</span>
      </button>
    `;
  }

  private toggleItem(id: StoreId): void {
    if (this.state.selected.has(id)) {
      this.state.selected.delete(id);
    } else {
      this.state.selected.add(id);
    }

    this.updateCounters();
    this.renderList();
  }

  private emit(eventType: string, detail: any): void {
    if (this.dom) {
      const event = new CustomEvent(eventType, { detail });
      this.dom.card.dispatchEvent(event);
    }
  }
}

/** Attaches the modal to `document.body` and returns a handle. */
export function attachFilterOrderingModal(props: FilterModalProps): FilterModalHandle {
  const modal = new FilterOrderingModal(props);

  return {
    open: () => modal.open(),
    close: () => modal.close(),
    getState: () => modal.getState(),
    setSelection: (ids: StoreId[]) => modal.setSelection(ids),
    setSort: (sort: SortMode) => modal.setSort(sort),
    destroy: () => modal.destroy()
  };
}
