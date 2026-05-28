/**
 * RFC-0203 M4 — HeaderAnnotationsPanel.
 *
 * Static panel (no virtualization, no search/sort/filter yet — those land in
 * M5/M6). Renders 3 tabs (Por Identificador / Por Device / Por Domínio),
 * shows groups + items, dispatches `myio:annotation-clicked` on item click.
 *
 * Lifecycle:
 *   - new HeaderAnnotationsPanel()         — creates instance; lazy DOM.
 *   - panel.show(buttonEl)                 — renders + positions + binds.
 *   - panel.hide()                         — hides + unbinds.
 *   - panel.destroy()                      — removes DOM + listeners.
 *
 * Pin/Maximize/Drag come in M6 (AC-32..AC-35). For now, close on:
 *   - click outside the panel
 *   - Esc keypress
 *   - X (close) button in the header
 *
 * The panel queries `window.AnnotationServiceOrchestrator` at show() time;
 * it does NOT cache. Re-rendering on demand is cheap relative to the orch
 * itself which holds the indexed data.
 */

import {
  HEADER_ANNOTATIONS_STYLES_ID,
  injectStylesOnce,
} from './styles';
import { renderAnnotationItemCard, escapeHtml } from './AnnotationItemCard';
import {
  SORT_OPTIONS,
  DEFAULT_SORT,
  sortGroups,
  createDefaultFilter,
  FILTER_TYPE_OPTIONS,
  FILTER_STATUS_OPTIONS,
  toggleInSet,
  withSearchTerm,
  countAnnotationsInGroups,
} from './searchSortFilter';
import type {
  AnnotatedDevice,
  AnnotationFilter,
  AnnotationGroup,
  AnnotationGroupBy,
  AnnotationServiceOrchestratorShape,
  AnnotationSortKey,
  AnnotationStatus,
  AnnotationType,
} from '../../services/annotations/types';

// ─── Tab metadata ──────────────────────────────────────────────────────────

const TABS: { id: AnnotationGroupBy; label: string }[] = [
  { id: 'identifier', label: 'Por Identificador' },
  { id: 'device', label: 'Por Device' },
  { id: 'domain', label: 'Por Domínio' },
];

const TAB_STORAGE_KEY = 'myio.annotations.activeTab';
const SORT_STORAGE_KEY = 'myio.annotations.sortBy';
const SEARCH_DEBOUNCE_MS = 250;
const PANEL_DOM_ID = 'myio-annotations-panel';

// ─── Public surface ────────────────────────────────────────────────────────

export interface HeaderAnnotationsPanelOptions {
  /**
   * Accessor for the orchestrator. Defaults to reading
   * `window.AnnotationServiceOrchestrator`. Override for tests.
   */
  getOrchestrator?: () => AnnotationServiceOrchestratorShape | null;
  /**
   * Optional logger; defaults to console.
   */
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}

export class HeaderAnnotationsPanel {
  private root: HTMLDivElement | null = null;
  private anchorButton: HTMLElement | null = null;
  private activeTab: AnnotationGroupBy = 'identifier';
  private sortBy: AnnotationSortKey = DEFAULT_SORT;
  private filter: AnnotationFilter = createDefaultFilter();
  private isOpen = false;
  private readonly opts: Required<HeaderAnnotationsPanelOptions>;

  // Bound listeners stored for removal
  private readonly _onEscKey: (e: KeyboardEvent) => void;
  private readonly _onClickOutside: (e: MouseEvent) => void;
  private readonly _onAnnotationsRefreshed: () => void;

  // Debounce timer for search input
  private _searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: HeaderAnnotationsPanelOptions = {}) {
    this.opts = {
      getOrchestrator:
        options.getOrchestrator ??
        (() =>
          ((typeof window !== 'undefined'
            ? (window as unknown as {
                AnnotationServiceOrchestrator?: AnnotationServiceOrchestratorShape;
              }).AnnotationServiceOrchestrator
            : null) ?? null)),
      logger: options.logger ?? console,
    };

    this.activeTab = this._loadActiveTab();
    this.sortBy = this._loadSortBy();
    this._onEscKey = (e) => {
      if (e.key === 'Escape' && this.isOpen) this.hide();
    };
    this._onClickOutside = (e) => {
      if (!this.isOpen || !this.root) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (this.root.contains(target)) return;
      if (this.anchorButton && this.anchorButton.contains(target)) return;
      this.hide();
    };
    this._onAnnotationsRefreshed = () => {
      if (this.isOpen) this._render();
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /** Render + position + show. Idempotent. */
  show(anchorButton: HTMLElement): void {
    injectStylesOnce();
    this.anchorButton = anchorButton;
    if (!this.root) this.root = this._createRoot();
    this._render();
    this._position();
    this.root.style.display = '';
    this.root.setAttribute('aria-hidden', 'false');
    this.isOpen = true;
    this._bindWindowListeners();

    // Move focus to first tab for keyboard users
    const firstTab = this.root.querySelector<HTMLButtonElement>('.myio-annotations-tab[aria-selected="true"]');
    if (firstTab) firstTab.focus();
  }

  /** Hide the panel without destroying it. */
  hide(): void {
    if (!this.root) return;
    this.root.style.display = 'none';
    this.root.setAttribute('aria-hidden', 'true');
    this.isOpen = false;
    this._unbindWindowListeners();
    if (this.anchorButton) {
      // AC-47: return focus to the button
      try {
        this.anchorButton.focus();
      } catch {
        /* ignore */
      }
    }
  }

  /** Toggle convenience. */
  toggle(anchorButton: HTMLElement): void {
    if (this.isOpen) this.hide();
    else this.show(anchorButton);
  }

  /** Remove the panel DOM + listeners. After this, `show()` recreates. */
  destroy(): void {
    this._unbindWindowListeners();
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
    this.anchorButton = null;
    this.isOpen = false;
  }

  /** Test/inspection helper. */
  getActiveTab(): AnnotationGroupBy {
    return this.activeTab;
  }

  /** Test helper — programmatic tab switch (also persists to sessionStorage). */
  setActiveTab(tab: AnnotationGroupBy): void {
    if (!TABS.some((t) => t.id === tab)) return;
    this.activeTab = tab;
    this._saveActiveTab(tab);
    if (this.isOpen) this._render();
  }

  /** Test/inspection helper. */
  getSortBy(): AnnotationSortKey {
    return this.sortBy;
  }

  /** Test helper — programmatic sort change (persists). */
  setSortBy(sort: AnnotationSortKey): void {
    if (!SORT_OPTIONS.some((o) => o.key === sort)) return;
    this.sortBy = sort;
    this._saveSortBy(sort);
    if (this.isOpen) this._render();
  }

  /** Test/inspection helper. */
  getFilter(): AnnotationFilter {
    return this.filter;
  }

  /** Test helper — programmatic filter merge. */
  setFilter(patch: Partial<AnnotationFilter>): void {
    this.filter = { ...this.filter, ...patch };
    if (this.isOpen) this._render();
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private _loadActiveTab(): AnnotationGroupBy {
    try {
      if (typeof sessionStorage === 'undefined') return 'identifier';
      const stored = sessionStorage.getItem(TAB_STORAGE_KEY) as AnnotationGroupBy | null;
      if (stored && TABS.some((t) => t.id === stored)) return stored;
    } catch {
      /* ignore */
    }
    return 'identifier';
  }

  private _saveActiveTab(tab: AnnotationGroupBy): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(TAB_STORAGE_KEY, tab);
      }
    } catch {
      /* ignore */
    }
  }

  private _loadSortBy(): AnnotationSortKey {
    try {
      if (typeof sessionStorage === 'undefined') return DEFAULT_SORT;
      const stored = sessionStorage.getItem(SORT_STORAGE_KEY) as AnnotationSortKey | null;
      if (stored && SORT_OPTIONS.some((o) => o.key === stored)) return stored;
    } catch {
      /* ignore */
    }
    return DEFAULT_SORT;
  }

  private _saveSortBy(sort: AnnotationSortKey): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SORT_STORAGE_KEY, sort);
      }
    } catch {
      /* ignore */
    }
  }

  private _createRoot(): HTMLDivElement {
    const el = document.createElement('div');
    el.id = PANEL_DOM_ID;
    el.className = 'myio-annotations-panel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-labelledby', PANEL_DOM_ID + '-title');
    el.setAttribute('aria-hidden', 'true');
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }

  private _position(): void {
    if (!this.root || !this.anchorButton) return;
    const rect = this.anchorButton.getBoundingClientRect();
    const panelWidth = Math.min(720, window.innerWidth * 0.9);

    let left = rect.left;
    if (left + panelWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - panelWidth - 8);
    }
    const top = rect.bottom + 8;

    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;
    this.root.style.width = `${panelWidth}px`;
  }

  private _bindWindowListeners(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this._onEscKey);
    // Defer click-outside binding so the originating click doesn't immediately close us
    setTimeout(() => {
      window.addEventListener('mousedown', this._onClickOutside, true);
    }, 0);
    window.addEventListener('myio:annotations-refreshed', this._onAnnotationsRefreshed);
  }

  private _unbindWindowListeners(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this._onEscKey);
    window.removeEventListener('mousedown', this._onClickOutside, true);
    window.removeEventListener('myio:annotations-refreshed', this._onAnnotationsRefreshed);
  }

  private _render(): void {
    if (!this.root) return;
    const orch = this.opts.getOrchestrator();
    this.root.innerHTML = this._renderHTML(orch);
    this._bindInteractiveElements();
  }

  private _renderHTML(orch: AnnotationServiceOrchestratorShape | null): string {
    const totalAllUnfiltered = orch?.getTotalCount?.() ?? 0;
    const pending = orch?.getPendingCount?.() ?? 0;
    const overdue = orch?.getOverdueCount?.() ?? 0;

    const tabsHtml = TABS.map(
      (t) =>
        `<button
          class="myio-annotations-tab"
          type="button"
          role="tab"
          id="myio-anno-tab-${t.id}"
          data-tab="${t.id}"
          aria-selected="${t.id === this.activeTab}"
          aria-controls="myio-anno-body"
          tabindex="${t.id === this.activeTab ? 0 : -1}"
        >${t.label}</button>`
    ).join('');

    // AC-24: get filtered groups from orchestrator; then sort (AC-23) in panel.
    const rawGroups = orch ? orch.getGroups(this.activeTab, this.filter) : [];
    const groups = sortGroups(rawGroups, this.sortBy);
    // AC-26: filtered count reflected in toolbar
    const filteredCount = countAnnotationsInGroups(groups);
    const bodyHtml = this._renderBody(groups);

    return `
<div class="myio-annotations-panel-header" data-region="header">
  <h2 class="myio-annotations-panel-title" id="${PANEL_DOM_ID}-title">
    <span class="myio-annotations-icon" aria-hidden="true">📋</span>Anotações
  </h2>
  <span class="myio-annotations-panel-meta">${totalAllUnfiltered} ativas · ${pending} pendentes · ${overdue} vencidas</span>
  <div class="myio-annotations-panel-actions">
    <button class="myio-annotations-panel-action" type="button" data-action="close" title="Fechar" aria-label="Fechar painel">✕</button>
  </div>
</div>
<div class="myio-annotations-tabs" role="tablist" aria-label="Modo de agrupamento">${tabsHtml}</div>
${this._renderToolbar(filteredCount, totalAllUnfiltered)}
<div class="myio-annotations-body" id="myio-anno-body" role="tabpanel" aria-labelledby="myio-anno-tab-${this.activeTab}">${bodyHtml}</div>
<div class="myio-annotations-panel-footer">
  <span>RFC-0203 · M5 (busca + ordenação + filtros)</span>
  <button class="myio-annotations-panel-footer-action" type="button" data-action="refresh">Atualizar</button>
</div>
`;
  }

  private _renderToolbar(filteredCount: number, totalCount: number): string {
    const sortOptions = SORT_OPTIONS.map(
      (o) =>
        `<option value="${o.key}" ${o.key === this.sortBy ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
    ).join('');

    const term = escapeHtml(this.filter.searchTerm || '');
    const filtersActiveCount = this._activeFilterCount();
    const filterIndicator =
      filtersActiveCount > 0
        ? `<span class="myio-annotations-group-count">${filtersActiveCount}</span>`
        : '';

    const showingHtml =
      filteredCount === totalCount
        ? `${totalCount} anotações`
        : `${filteredCount} de ${totalCount} anotações`;

    return `
<div class="myio-annotations-toolbar" data-region="toolbar">
  <div class="myio-annotations-toolbar-row">
    <label class="myio-annotations-toolbar-search">
      <span class="myio-annotations-search-icon" aria-hidden="true">🔍</span>
      <input
        type="search"
        data-input="search"
        placeholder="Buscar identificador, device, texto…"
        aria-label="Buscar anotações"
        value="${term}"
      />
    </label>
    <select class="myio-annotations-toolbar-sort" data-input="sort" aria-label="Ordenação">
      ${sortOptions}
    </select>
    <button
      class="myio-annotations-toolbar-filter-btn"
      type="button"
      data-action="toggle-filters"
      aria-expanded="false"
      aria-controls="myio-anno-filters"
    >⚙ Filtros ${filterIndicator}</button>
  </div>
  <div class="myio-annotations-toolbar-row myio-annotations-toolbar-meta">
    <span class="myio-annotations-toolbar-count">${showingHtml}</span>
  </div>
  <div id="myio-anno-filters" class="myio-annotations-filters" hidden>${this._renderFilters()}</div>
</div>`;
  }

  private _renderFilters(): string {
    const typesHtml = FILTER_TYPE_OPTIONS.map(
      (t) =>
        `<label class="myio-annotations-filter-chip ${this.filter.types.has(t.id) ? 'is-on' : ''}">
          <input type="checkbox" data-filter="type" value="${t.id}" ${this.filter.types.has(t.id) ? 'checked' : ''} />
          <span>${t.icon} ${escapeHtml(t.label)}</span>
        </label>`
    ).join('');

    const statusHtml = FILTER_STATUS_OPTIONS.map(
      (s) =>
        `<label class="myio-annotations-filter-chip ${this.filter.statuses.has(s.id) ? 'is-on' : ''}">
          <input type="checkbox" data-filter="status" value="${s.id}" ${this.filter.statuses.has(s.id) ? 'checked' : ''} />
          <span>${escapeHtml(s.label)}</span>
        </label>`
    ).join('');

    const impHtml = ([1, 2, 3, 4, 5] as const)
      .map(
        (lv) =>
          `<label class="myio-annotations-filter-chip ${this.filter.importance.has(lv) ? 'is-on' : ''}">
            <input type="checkbox" data-filter="importance" value="${lv}" ${this.filter.importance.has(lv) ? 'checked' : ''} />
            <span>${lv}</span>
          </label>`
      )
      .join('');

    return `
<div class="myio-annotations-filter-section">
  <div class="myio-annotations-filter-section-title">Tipo</div>
  <div class="myio-annotations-filter-chips">${typesHtml}</div>
</div>
<div class="myio-annotations-filter-section">
  <div class="myio-annotations-filter-section-title">Status</div>
  <div class="myio-annotations-filter-chips">${statusHtml}</div>
</div>
<div class="myio-annotations-filter-section">
  <div class="myio-annotations-filter-section-title">Importância</div>
  <div class="myio-annotations-filter-chips">${impHtml}</div>
</div>
<div class="myio-annotations-filter-section">
  <label class="myio-annotations-filter-chip ${this.filter.actionableOnly ? 'is-on' : ''}">
    <input type="checkbox" data-filter="actionable" ${this.filter.actionableOnly ? 'checked' : ''} />
    <span>Acionáveis apenas (pendentes não-arquivadas, com vencimento ≤ 7 dias ou sem vencimento)</span>
  </label>
</div>
<div class="myio-annotations-filter-actions">
  <button type="button" class="myio-annotations-panel-footer-action" data-action="clear-filters">Limpar</button>
</div>`;
  }

  private _activeFilterCount(): number {
    let n = 0;
    n += this.filter.types.size;
    n += this.filter.statuses.size;
    n += this.filter.importance.size;
    if (this.filter.actionableOnly) n += 1;
    return n;
  }

  private _renderBody(groups: AnnotationGroup[]): string {
    if (!groups || groups.length === 0) {
      const hasFilters = this.filter.searchTerm || this._activeFilterCount() > 0;
      return `
<div class="myio-annotations-empty">
  <div class="myio-annotations-empty-icon" aria-hidden="true">📋</div>
  <div>${hasFilters ? 'Nada encontrado para o filtro / busca atual.' : 'Nenhuma anotação ativa.'}</div>
</div>`;
    }

    return groups
      .map((g) => this._renderGroup(g))
      .join('\n');
  }

  private _renderGroup(group: AnnotationGroup): string {
    const isNoIdentifier = this.activeTab === 'identifier' && group.key === 'Sem Identificador';
    const term = this.filter.searchTerm || '';
    const items = group.devices.flatMap((d) =>
      d.annotations.map((a) => renderAnnotationItemCard(d as AnnotatedDevice, a, term))
    );

    const groupClass = isNoIdentifier
      ? 'myio-annotations-group myio-annotations-group--no-id'
      : 'myio-annotations-group';

    return `
<section class="${groupClass}">
  <header class="myio-annotations-group-header">
    ${group.icon ? `<span class="myio-annotations-group-icon" aria-hidden="true">${escapeHtml(group.icon)}</span>` : ''}
    <span class="myio-annotations-group-label">${escapeHtml(group.label)}</span>
    <span class="myio-annotations-group-count">${group.totalAnnotations}</span>
  </header>
  ${items.join('\n')}
</section>`;
  }

  private _bindInteractiveElements(): void {
    if (!this.root) return;

    // Tab buttons
    const tabBtns = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.myio-annotations-tab'));
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as AnnotationGroupBy | null;
        if (tab) this.setActiveTab(tab);
      });
    });

    // AC-44: Tab keyboard navigation (←/→/Home/End)
    const tablist = this.root.querySelector<HTMLDivElement>('.myio-annotations-tabs');
    if (tablist) {
      tablist.addEventListener('keydown', (e) => this._onTabKeydown(e as KeyboardEvent, tabBtns));
    }

    // Item clicks → dispatch event
    const items = this.root.querySelectorAll<HTMLButtonElement>('.myio-annotations-item');
    items.forEach((it) => {
      it.addEventListener('click', () => this._handleItemClick(it));
    });

    // Header actions
    const closeBtn = this.root.querySelector<HTMLButtonElement>('[data-action="close"]');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());

    const refreshBtn = this.root.querySelector<HTMLButtonElement>('[data-action="refresh"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const orch = this.opts.getOrchestrator();
        if (orch && typeof orch.refresh === 'function') {
          orch.refresh().catch((err) => this.opts.logger.warn('[HeaderAnnotationsPanel] refresh failed:', err));
        }
      });
    }

    // Toolbar — search input (AC-20 debounced 250ms, AC-21 NFD normalized via filter)
    const searchInput = this.root.querySelector<HTMLInputElement>('[data-input="search"]');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        if (this._searchDebounceTimer) clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => {
          this.filter = withSearchTerm(this.filter, searchInput.value);
          if (this.isOpen) this._render();
          // Restore focus + caret to the input after re-render
          requestAnimationFrame(() => {
            const fresh = this.root?.querySelector<HTMLInputElement>('[data-input="search"]');
            if (fresh) {
              fresh.focus();
              try {
                fresh.setSelectionRange(fresh.value.length, fresh.value.length);
              } catch {
                /* ignore */
              }
            }
          });
        }, SEARCH_DEBOUNCE_MS);
      });
    }

    // Toolbar — sort select (AC-23)
    const sortSelect = this.root.querySelector<HTMLSelectElement>('[data-input="sort"]');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.setSortBy(sortSelect.value as AnnotationSortKey);
      });
    }

    // Toolbar — toggle filters dropdown
    const filterToggle = this.root.querySelector<HTMLButtonElement>(
      '[data-action="toggle-filters"]'
    );
    const filterPanel = this.root.querySelector<HTMLDivElement>('#myio-anno-filters');
    if (filterToggle && filterPanel) {
      filterToggle.addEventListener('click', () => {
        const isHidden = filterPanel.hasAttribute('hidden');
        if (isHidden) {
          filterPanel.removeAttribute('hidden');
          filterToggle.setAttribute('aria-expanded', 'true');
        } else {
          filterPanel.setAttribute('hidden', '');
          filterToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Filter checkboxes — AC-24 (AND between sections, OR within), AC-25 actionable
    const filterInputs = this.root.querySelectorAll<HTMLInputElement>('[data-filter]');
    filterInputs.forEach((cb) => {
      cb.addEventListener('change', () => {
        const kind = cb.getAttribute('data-filter');
        if (kind === 'type') {
          const v = cb.value as AnnotationType;
          this.setFilter({ types: toggleInSet(this.filter.types, v) });
          this._reopenFiltersAfterRender();
        } else if (kind === 'status') {
          const v = cb.value as AnnotationStatus;
          this.setFilter({ statuses: toggleInSet(this.filter.statuses, v) });
          this._reopenFiltersAfterRender();
        } else if (kind === 'importance') {
          const v = Number(cb.value) as 1 | 2 | 3 | 4 | 5;
          this.setFilter({ importance: toggleInSet(this.filter.importance, v) });
          this._reopenFiltersAfterRender();
        } else if (kind === 'actionable') {
          this.setFilter({ actionableOnly: cb.checked });
          this._reopenFiltersAfterRender();
        }
      });
    });

    // Clear filters
    const clearBtn = this.root.querySelector<HTMLButtonElement>('[data-action="clear-filters"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.filter = createDefaultFilter();
        if (this.isOpen) this._render();
        this._reopenFiltersAfterRender();
      });
    }
  }

  /** After a re-render triggered by a filter checkbox, re-open the filter panel
   * so the user keeps the context visible. */
  private _reopenFiltersAfterRender(): void {
    requestAnimationFrame(() => {
      const fp = this.root?.querySelector<HTMLDivElement>('#myio-anno-filters');
      const toggle = this.root?.querySelector<HTMLButtonElement>(
        '[data-action="toggle-filters"]'
      );
      if (fp && toggle) {
        fp.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  }

  private _onTabKeydown(e: KeyboardEvent, tabBtns: HTMLButtonElement[]): void {
    const currentIdx = tabBtns.findIndex(
      (b) => b.getAttribute('aria-selected') === 'true'
    );
    if (currentIdx < 0) return;
    let nextIdx = currentIdx;

    switch (e.key) {
      case 'ArrowRight':
        nextIdx = (currentIdx + 1) % tabBtns.length;
        break;
      case 'ArrowLeft':
        nextIdx = (currentIdx - 1 + tabBtns.length) % tabBtns.length;
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = tabBtns.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const tabId = tabBtns[nextIdx].getAttribute('data-tab') as AnnotationGroupBy | null;
    if (tabId) {
      this.setActiveTab(tabId);
      // Re-query the new selected tab to refocus
      requestAnimationFrame(() => {
        const sel = this.root?.querySelector<HTMLButtonElement>(
          '.myio-annotations-tab[aria-selected="true"]'
        );
        sel?.focus();
      });
    }
  }

  private _handleItemClick(itemEl: HTMLButtonElement): void {
    const deviceId = itemEl.getAttribute('data-device-id') || '';
    const annotationId = itemEl.getAttribute('data-annotation-id') || '';

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('myio:annotation-clicked', {
          detail: { deviceId, annotationId, returnTo: 'header-panel' },
        })
      );
    }
    // The downstream handler decides whether to open SettingsModal etc.
    // M4 scope: dispatch only. M7 will wire the actual SettingsModal handler.
  }
}

// ─── Convenience singleton accessor for the widget (HEADER controller) ─────

let _singleton: HeaderAnnotationsPanel | null = null;

/**
 * Returns the lazy singleton instance for use inside the HEADER widget.
 * Tests should `new HeaderAnnotationsPanel()` directly to avoid global state.
 */
export function getHeaderAnnotationsPanel(): HeaderAnnotationsPanel {
  if (!_singleton) _singleton = new HeaderAnnotationsPanel();
  return _singleton;
}

// Re-export styles helper for direct callers
export { injectStylesOnce, HEADER_ANNOTATIONS_STYLES_ID };
