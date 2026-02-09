/**
 * EntityListPanel — Reusable sidebar list component
 *
 * Renders a panel with:
 * - Configurable title + subtitle
 * - Search (magnifying glass) with instant filter
 * - Sortable list of entity items with arrow action
 * - Optional background watermark image
 * - 10px border-radius, scrollable list
 * - handleClickItem callback per item
 *
 * Inspired by the BAS "Andares" floor-list design.
 */

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface EntityListItem {
  id: string;
  label: string;
  /** @deprecated Use handleActionClick instead */
  urlLink?: string;
  /** Per-item action callback. Called when clicking the item arrow. */
  handleActionClick?: () => void;
  [key: string]: unknown;
}

export interface EntityListTitleStyle {
  /** Font size (e.g. '0.7rem', '11px') */
  fontSize?: string;
  /** Font weight (e.g. '500', '600', 'bold') */
  fontWeight?: string;
  /** Header padding (e.g. '8px 12px') */
  padding?: string;
  /** Title color */
  color?: string;
  /** Letter spacing */
  letterSpacing?: string;
}

export interface EntityListPanelOptions {
  /** Panel title (e.g. "Andares") */
  title: string;
  /** Optional subtitle shown below title as sort indicator (e.g. "Nome do andar ↑") */
  subtitle?: string;
  /** Items to render */
  items: EntityListItem[];
  /** Optional background watermark image URL */
  backgroundImage?: string;
  /** Callback when an item row or its arrow is clicked */
  handleClickItem: (item: EntityListItem) => void;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Currently selected item id (highlights the row) */
  selectedId?: string | null;
  /** Show "All" button at the top of the list */
  showAllOption?: boolean;
  /** Label for the "All" option */
  allLabel?: string;
  /** Callback when "All" is clicked */
  handleClickAll?: () => void;
  /** Optional style for the title/header (slim, premium look) */
  titleStyle?: EntityListTitleStyle;
  /**
   * Sort order for items. Default: 'none' (preserve source order)
   * - 'asc': A-Z ascending (by normalized display label)
   * - 'desc': Z-A descending (by normalized display label)
   * - 'none': No sorting (backward compatible)
   */
  sortOrder?: 'asc' | 'desc' | 'none';
  /**
   * Regex pattern to remove from labels for display purposes.
   * Original label preserved for ID/search matching.
   * Example: '^\(\d{3}\)-\s*' removes '(001)-' prefix
   */
  excludePartOfLabel?: string;
  /**
   * Regex flags for excludePartOfLabel. Default: ''
   * Example: 'i' for case-insensitive matching
   */
  excludePartOfLabelFlags?: string;
}

// ────────────────────────────────────────────
// CSS (injected once)
// ────────────────────────────────────────────

const CSS_ID = 'myio-entity-list-panel-styles';

const PANEL_CSS = `
  .myio-elp {
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    background: #faf8f1;
    border: 1px solid #e8e4d9;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    position: relative;
    height: 100%;
    min-width: 180px;
  }

  /* Watermark background */
  .myio-elp__watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60%;
    max-width: 120px;
    opacity: 0.08;
    pointer-events: none;
    z-index: 0;
  }

  /* Header area */
  .myio-elp__header {
    padding: 14px 16px 0 16px;
    position: relative;
    z-index: 1;
  }

  .myio-elp__title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .myio-elp__title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0;
    line-height: 1.3;
  }

  .myio-elp__search-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: #555;
    transition: color 0.2s;
    flex-shrink: 0;
  }
  .myio-elp__search-btn:hover {
    color: #1a1a1a;
  }

  /* Search input (hidden by default, toggled) */
  .myio-elp__search-row {
    overflow: hidden;
    max-height: 0;
    transition: max-height 0.25s ease, margin 0.25s ease;
    margin-top: 0;
  }
  .myio-elp__search-row--open {
    max-height: 44px;
    margin-top: 8px;
  }

  .myio-elp__search-input {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 10px;
    border: 1px solid #d4cfbe;
    border-radius: 6px;
    font-size: 0.8rem;
    background: #fff;
    outline: none;
    transition: border-color 0.2s;
  }
  .myio-elp__search-input:focus {
    border-color: #a09880;
  }

  /* Subtitle / sort indicator */
  .myio-elp__subtitle {
    font-size: 0.72rem;
    color: #888;
    margin-top: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e8e4d9;
    letter-spacing: 0.02em;
  }

  /* Scrollable list */
  .myio-elp__list {
    flex: 1;
    overflow-y: auto;
    position: relative;
    z-index: 1;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  /* Thin scrollbar */
  .myio-elp__list::-webkit-scrollbar {
    width: 4px;
  }
  .myio-elp__list::-webkit-scrollbar-track {
    background: transparent;
  }
  .myio-elp__list::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 4px;
  }

  /* List item */
  .myio-elp__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 16px;
    cursor: pointer;
    transition: background 0.15s;
    border-bottom: 1px solid #ece8db;
    position: relative;
  }
  .myio-elp__item:last-child {
    border-bottom: none;
  }
  .myio-elp__item:hover {
    background: rgba(0, 0, 0, 0.04);
  }
  .myio-elp__item--selected {
    background: rgba(47, 88, 72, 0.10);
    font-weight: 600;
  }
  .myio-elp__item--selected:hover {
    background: rgba(47, 88, 72, 0.15);
  }

  .myio-elp__item-label {
    font-size: 0.85rem;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .myio-elp__item-arrow {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    transition: color 0.15s, transform 0.15s;
    margin-left: 8px;
  }
  .myio-elp__item:hover .myio-elp__item-arrow {
    color: #555;
    transform: translateX(2px);
  }
  .myio-elp__item--selected .myio-elp__item-arrow {
    color: #2F5848;
  }

  /* Empty state */
  .myio-elp__empty {
    padding: 20px 16px;
    text-align: center;
    font-size: 0.8rem;
    color: #999;
  }
`;

function injectStyles(): void {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
}

// ────────────────────────────────────────────
// SVG icons (inline, no external deps)
// ────────────────────────────────────────────

const ICON_SEARCH = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

const ICON_ARROW = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;

// ────────────────────────────────────────────
// Component class
// ────────────────────────────────────────────

export class EntityListPanel {
  private root: HTMLElement;
  private options: EntityListPanelOptions;
  private searchOpen = false;
  private filterText = '';

  constructor(options: EntityListPanelOptions) {
    injectStyles();
    this.options = options;
    this.root = document.createElement('div');
    this.root.className = 'myio-elp';
    this.render();
  }

  // ── Public API ────────────────────────────

  /** Get the root DOM element to append to a container */
  public getElement(): HTMLElement {
    return this.root;
  }

  /** Replace items and re-render list */
  public setItems(items: EntityListItem[]): void {
    this.options.items = items;
    this.renderList();
  }

  /** Update which item is selected */
  public setSelectedId(id: string | null): void {
    this.options.selectedId = id;
    this.renderList();
  }

  /** Update title */
  public setTitle(title: string): void {
    this.options.title = title;
    const el = this.root.querySelector('.myio-elp__title') as HTMLElement;
    if (el) el.textContent = title;
  }

  /** Update subtitle */
  public setSubtitle(subtitle: string): void {
    this.options.subtitle = subtitle;
    const el = this.root.querySelector('.myio-elp__subtitle') as HTMLElement;
    if (el) el.textContent = subtitle;
  }

  /** Update background watermark image */
  public setBackgroundImage(url: string | null): void {
    this.options.backgroundImage = url || undefined;
    const img = this.root.querySelector('.myio-elp__watermark') as HTMLImageElement;
    if (url) {
      if (img) {
        img.src = url;
        img.style.display = '';
      } else {
        this.injectWatermark();
      }
    } else if (img) {
      img.style.display = 'none';
    }
  }

  /** Cleanup */
  public destroy(): void {
    this.root.remove();
  }

  // ── Render ────────────────────────────────

  private render(): void {
    const { title, subtitle, backgroundImage, searchPlaceholder, titleStyle } = this.options;

    this.root.innerHTML = '';

    // Watermark
    if (backgroundImage) {
      this.injectWatermark();
    }

    // Header
    const header = document.createElement('div');
    header.className = 'myio-elp__header';
    if (titleStyle?.padding) {
      header.style.padding = titleStyle.padding;
    }

    // Title row
    const titleRow = document.createElement('div');
    titleRow.className = 'myio-elp__title-row';

    const titleEl = document.createElement('h3');
    titleEl.className = 'myio-elp__title';
    titleEl.textContent = title;
    if (titleStyle?.fontSize) titleEl.style.fontSize = titleStyle.fontSize;
    if (titleStyle?.fontWeight) titleEl.style.fontWeight = titleStyle.fontWeight;
    if (titleStyle?.color) titleEl.style.color = titleStyle.color;
    if (titleStyle?.letterSpacing) titleEl.style.letterSpacing = titleStyle.letterSpacing;
    titleRow.appendChild(titleEl);

    const searchBtn = document.createElement('button');
    searchBtn.className = 'myio-elp__search-btn';
    searchBtn.innerHTML = ICON_SEARCH;
    searchBtn.title = 'Buscar';
    searchBtn.addEventListener('click', () => this.toggleSearch());
    titleRow.appendChild(searchBtn);

    header.appendChild(titleRow);

    // Search row (collapsed)
    const searchRow = document.createElement('div');
    searchRow.className = 'myio-elp__search-row';

    const searchInput = document.createElement('input');
    searchInput.className = 'myio-elp__search-input';
    searchInput.type = 'text';
    searchInput.placeholder = searchPlaceholder || 'Buscar...';
    searchInput.addEventListener('input', () => {
      this.filterText = searchInput.value.trim().toLowerCase();
      this.renderList();
    });
    searchRow.appendChild(searchInput);
    header.appendChild(searchRow);

    // Subtitle
    if (subtitle) {
      const subEl = document.createElement('div');
      subEl.className = 'myio-elp__subtitle';
      subEl.textContent = subtitle;
      header.appendChild(subEl);
    }

    this.root.appendChild(header);

    // List
    const list = document.createElement('ul');
    list.className = 'myio-elp__list';
    this.root.appendChild(list);

    this.renderList();
  }

  private renderList(): void {
    const list = this.root.querySelector('.myio-elp__list') as HTMLElement;
    if (!list) return;

    list.innerHTML = '';

    const {
      items,
      selectedId,
      handleClickItem,
      showAllOption,
      allLabel,
      handleClickAll,
    } = this.options;

    // "All" option
    if (showAllOption) {
      const allItem = document.createElement('li');
      allItem.className = `myio-elp__item${selectedId === null || selectedId === undefined ? ' myio-elp__item--selected' : ''}`;
      allItem.innerHTML = `
        <span class="myio-elp__item-label">${this.escapeHtml(allLabel || 'Todos')}</span>
        <span class="myio-elp__item-arrow">${ICON_ARROW}</span>
      `;
      allItem.addEventListener('click', () => {
        handleClickAll?.();
      });
      list.appendChild(allItem);
    }

    // Sort items first (before filtering) so the display order is consistent
    const sortedItems = this.sortItems(items);

    // Filter by original label OR normalized label (user may type either)
    const filtered = this.filterText
      ? sortedItems.filter(it => {
          const originalMatch = it.label.toLowerCase().includes(this.filterText);
          const normalizedMatch = this.normalizeLabel(it.label).toLowerCase().includes(this.filterText);
          return originalMatch || normalizedMatch;
        })
      : sortedItems;

    if (filtered.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'myio-elp__empty';
      empty.textContent = this.filterText ? 'Nenhum resultado' : 'Nenhum item';
      list.appendChild(empty);
      return;
    }

    filtered.forEach(item => {
      // Display normalized label, but keep original for tooltip/ID
      const displayLabel = this.normalizeLabel(item.label);
      const li = document.createElement('li');
      li.className = `myio-elp__item${item.id === selectedId ? ' myio-elp__item--selected' : ''}`;
      li.innerHTML = `
        <span class="myio-elp__item-label" title="${this.escapeHtml(item.label)}">${this.escapeHtml(displayLabel)}</span>
        <span class="myio-elp__item-arrow">${ICON_ARROW}</span>
      `;
      li.addEventListener('click', () => {
        handleClickItem(item);
        // Call per-item action if defined
        if (typeof item.handleActionClick === 'function') {
          item.handleActionClick();
        }
      });
      list.appendChild(li);
    });
  }

  private injectWatermark(): void {
    const img = document.createElement('img');
    img.className = 'myio-elp__watermark';
    img.src = this.options.backgroundImage!;
    img.alt = '';
    img.draggable = false;
    this.root.appendChild(img);
  }

  private toggleSearch(): void {
    this.searchOpen = !this.searchOpen;
    const row = this.root.querySelector('.myio-elp__search-row') as HTMLElement;
    if (!row) return;

    if (this.searchOpen) {
      row.classList.add('myio-elp__search-row--open');
      const input = row.querySelector('input');
      if (input) {
        requestAnimationFrame(() => input.focus());
      }
    } else {
      row.classList.remove('myio-elp__search-row--open');
      // Clear filter
      const input = row.querySelector('input') as HTMLInputElement;
      if (input) input.value = '';
      this.filterText = '';
      this.renderList();
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Normalize a label by removing prefix patterns defined in excludePartOfLabel.
   * Returns the cleaned display label while preserving the original for ID/search.
   */
  private normalizeLabel(raw: string): string {
    if (!this.options.excludePartOfLabel) return raw;
    const flags = this.options.excludePartOfLabelFlags || '';
    try {
      const regex = new RegExp(this.options.excludePartOfLabel, flags);
      return raw.replace(regex, '').trim();
    } catch (e) {
      console.warn('[EntityListPanel] Invalid excludePartOfLabel regex:', e);
      return raw;
    }
  }

  /**
   * Sort items by ORIGINAL label (before excludePartOfLabel).
   * This preserves prefix-based ordering like "(001)-", "(002)-", etc.
   * Returns a new array without mutating the original.
   */
  private sortItems(items: EntityListItem[]): EntityListItem[] {
    if (!this.options.sortOrder || this.options.sortOrder === 'none') {
      return items; // No sorting - backward compatible
    }

    return [...items].sort((a, b) => {
      // Sort by original label to preserve prefix ordering
      const comparison = a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' });
      return this.options.sortOrder === 'desc' ? -comparison : comparison;
    });
  }
}
