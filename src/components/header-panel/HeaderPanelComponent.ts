/**
 * HeaderPanelComponent — Standardized header for panels
 *
 * Layout:
 *   [Icon] Title (quantity) | [Search] [Filter] [Maximize/Minimize]
 *
 * Features:
 * - Standard height (32px default, customizable)
 * - Icon + Title + quantity badge
 * - Search toggle (shows/hides input, updates quantity on filter)
 * - Filter button (calls handleActionFilter for modal)
 * - Maximize/Minimize toggle
 * - Subtle top border line
 * - Consistent font/color styling
 */

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface HeaderPanelStyle {
  /** Header height (default: '32px') */
  height?: string;
  /** Font size (default: '0.7rem') */
  fontSize?: string;
  /** Font weight (default: '600') */
  fontWeight?: string;
  /** Font color (default: '#1a1a1a') */
  color?: string;
  /** Letter spacing (default: '0.5px') */
  letterSpacing?: string;
  /** Text transform (default: 'uppercase') */
  textTransform?: string;
  /** Background color or gradient (default: 'transparent') */
  backgroundColor?: string;
  /** Top border color (default: 'rgba(47, 88, 72, 0.3)') */
  topBorderColor?: string;
  /** Bottom border color (default: '#e8e4d9') */
  bottomBorderColor?: string;
  /** Icon color (default: '#2F5848') */
  iconColor?: string;
  /** Quantity badge background (default: 'rgba(0, 0, 0, 0.06)') */
  quantityBackground?: string;
  /** Quantity badge text color (default: '#666') */
  quantityColor?: string;
  /** Action button color (default: '#666') */
  buttonColor?: string;
  /** Action button hover background (default: 'rgba(0, 0, 0, 0.06)') */
  buttonHoverBackground?: string;
  /** Action button hover color (default: '#333') */
  buttonHoverColor?: string;
  /** Search input background (default: 'rgba(0, 0, 0, 0.04)') */
  searchBackground?: string;
  /** Search input text color (default: '#333') */
  searchColor?: string;
  /** Search placeholder color (default: '#999') */
  searchPlaceholderColor?: string;
}

export interface HeaderPanelOptions {
  /** Panel title */
  title: string;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Icon (SVG string or emoji) */
  icon?: string;
  /** Item count to display as (N) badge */
  quantity?: number;
  /** Style customization */
  style?: HeaderPanelStyle;
  /** Show search toggle button */
  showSearch?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Callback when search text changes */
  onSearchChange?: (text: string) => void;
  /** Show filter button */
  showFilter?: boolean;
  /** Callback when filter button clicked (opens modal) */
  handleActionFilter?: () => void;
  /** Show maximize/minimize toggle */
  showMaximize?: boolean;
  /** Callback when maximize/minimize clicked */
  onMaximizeToggle?: (isMaximized: boolean) => void;
  /** Initial maximized state */
  isMaximized?: boolean;
  /** Show bottom border (default: true) */
  showBottomBorder?: boolean;
  /** Show top accent border (default: true) */
  showTopBorder?: boolean;
  /** Custom action button (legacy, for backward compatibility) */
  actionButton?: {
    icon: string;
    title: string;
    onClick: () => void;
  };
}

// ────────────────────────────────────────────
// SVG Icons
// ────────────────────────────────────────────

const ICON_SEARCH = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

const ICON_FILTER = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`;

const ICON_MAXIMIZE = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;

const ICON_MINIMIZE = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;

const ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

// ────────────────────────────────────────────
// CSS (injected once)
// ────────────────────────────────────────────

const CSS_ID = 'myio-header-panel-styles';

const HEADER_CSS = `
  .myio-hp {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }

  .myio-hp--top-border {
    border-top: 2px solid rgba(47, 88, 72, 0.3);
  }

  .myio-hp--bottom-border {
    border-bottom: 1px solid #e8e4d9;
  }

  .myio-hp__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 12px;
    height: 32px;
    min-height: 32px;
    overflow: hidden;
  }

  .myio-hp__left {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .myio-hp__icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #2F5848;
    font-size: 14px;
  }

  .myio-hp__icon svg {
    width: 16px;
    height: 16px;
  }

  .myio-hp__title {
    font-size: 0.7rem;
    font-weight: 700;
    color: #111111;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .myio-hp__quantity {
    font-size: 0.65rem;
    font-weight: 500;
    color: #666;
    background: rgba(0, 0, 0, 0.06);
    padding: 2px 6px;
    border-radius: 10px;
    line-height: 1;
    flex-shrink: 0;
  }

  .myio-hp__subtitle {
    font-size: 0.65rem;
    font-weight: 400;
    color: #888;
    margin: 0;
    padding: 0 12px 6px 12px;
  }

  .myio-hp__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    min-width: fit-content;
  }

  .myio-hp__btn {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    transition: background 0.15s, color 0.15s;
    padding: 0;
  }

  .myio-hp__btn:hover {
    background: rgba(0, 0, 0, 0.06);
    color: #333;
  }

  .myio-hp__btn--active {
    background: rgba(47, 88, 72, 0.1);
    color: #2F5848;
  }

  .myio-hp__btn--active:hover {
    background: rgba(47, 88, 72, 0.15);
  }

  .myio-hp__btn svg {
    width: 14px;
    height: 14px;
  }

  /* Search row */
  .myio-hp__search-row {
    display: none;
    padding: 0 12px 8px 12px;
  }

  .myio-hp__search-row--open {
    display: flex;
  }

  .myio-hp__search-input-wrapper {
    display: flex;
    align-items: center;
    flex: 1;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 6px;
    padding: 0 8px;
    gap: 6px;
  }

  .myio-hp__search-input-wrapper svg {
    color: #999;
    flex-shrink: 0;
  }

  .myio-hp__search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.75rem;
    color: #333;
    padding: 6px 0;
    outline: none;
  }

  .myio-hp__search-input::placeholder {
    color: #999;
  }

  .myio-hp__search-clear {
    width: 18px;
    height: 18px;
    border: none;
    background: transparent;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    padding: 0;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
  }

  .myio-hp__search-input-wrapper:focus-within .myio-hp__search-clear,
  .myio-hp__search-clear--visible {
    opacity: 1;
  }

  .myio-hp__search-clear:hover {
    background: rgba(0, 0, 0, 0.08);
    color: #666;
  }
`;

function injectStyles(): void {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = HEADER_CSS;
  document.head.appendChild(style);
}

// ────────────────────────────────────────────
// Default styles
// ────────────────────────────────────────────

export const HEADER_STYLE_DEFAULT: HeaderPanelStyle = {
  height: '32px',
  fontSize: '0.7rem',
  fontWeight: '700',
  color: '#111111',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  backgroundColor: 'transparent',
  topBorderColor: 'rgba(47, 88, 72, 0.3)',
  bottomBorderColor: '#e8e4d9',
  iconColor: '#2F5848',
  quantityBackground: 'rgba(0, 0, 0, 0.06)',
  quantityColor: '#666',
  buttonColor: '#666',
  buttonHoverBackground: 'rgba(0, 0, 0, 0.06)',
  buttonHoverColor: '#333',
  searchBackground: 'rgba(0, 0, 0, 0.04)',
  searchColor: '#333',
  searchPlaceholderColor: '#999',
};

export const HEADER_STYLE_SLIM: HeaderPanelStyle = {
  ...HEADER_STYLE_DEFAULT,
  height: '28px',
};

export const HEADER_STYLE_DARK: HeaderPanelStyle = {
  ...HEADER_STYLE_DEFAULT,
  color: '#e2e8f0',
  backgroundColor: '#1e293b',
  topBorderColor: 'rgba(61, 122, 98, 0.5)',
  bottomBorderColor: '#334155',
  iconColor: '#a7d4c0',
  quantityBackground: 'rgba(255, 255, 255, 0.1)',
  quantityColor: '#e2e8f0',
  buttonColor: 'rgba(255, 255, 255, 0.7)',
  buttonHoverBackground: 'rgba(255, 255, 255, 0.1)',
  buttonHoverColor: '#ffffff',
  searchBackground: 'rgba(255, 255, 255, 0.1)',
  searchColor: '#e2e8f0',
  searchPlaceholderColor: 'rgba(255, 255, 255, 0.5)',
};

/** Premium green gradient header style */
export const HEADER_STYLE_PREMIUM_GREEN: HeaderPanelStyle = {
  height: '36px',
  fontSize: '0.7rem',
  fontWeight: '600',
  color: '#ffffff',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  backgroundColor: 'linear-gradient(135deg, #2F5848 0%, #3d7a62 100%)',
  topBorderColor: 'transparent',
  bottomBorderColor: 'transparent',
  iconColor: '#a7d4c0',
  quantityBackground: 'rgba(255, 255, 255, 0.2)',
  quantityColor: '#ffffff',
  buttonColor: 'rgba(255, 255, 255, 0.7)',
  buttonHoverBackground: 'rgba(255, 255, 255, 0.15)',
  buttonHoverColor: '#ffffff',
  searchBackground: 'rgba(255, 255, 255, 0.15)',
  searchColor: '#ffffff',
  searchPlaceholderColor: 'rgba(255, 255, 255, 0.5)',
};

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export class HeaderPanelComponent {
  private root: HTMLElement;
  private options: HeaderPanelOptions;
  private searchOpen = false;
  private isMaximized = false;
  private searchText = '';

  constructor(options: HeaderPanelOptions) {
    injectStyles();
    this.options = options;
    this.isMaximized = options.isMaximized || false;
    this.root = document.createElement('div');
    this.root.className = 'myio-hp';
    this.applyBorders();
    this.render();
  }

  // ── Public API ────────────────────────────

  public getElement(): HTMLElement {
    return this.root;
  }

  public setTitle(title: string): void {
    this.options.title = title;
    const el = this.root.querySelector('.myio-hp__title') as HTMLElement;
    if (el) el.textContent = title;
  }

  public setQuantity(quantity: number): void {
    this.options.quantity = quantity;
    const el = this.root.querySelector('.myio-hp__quantity') as HTMLElement;
    if (el) {
      el.textContent = `(${quantity})`;
      el.style.display = quantity >= 0 ? '' : 'none';
    }
  }

  public setIcon(icon: string): void {
    this.options.icon = icon;
    const el = this.root.querySelector('.myio-hp__icon') as HTMLElement;
    if (el) el.innerHTML = icon;
  }

  public setSubtitle(subtitle: string): void {
    this.options.subtitle = subtitle;
    const el = this.root.querySelector('.myio-hp__subtitle') as HTMLElement;
    if (el) el.textContent = subtitle;
  }

  public getSearchText(): string {
    return this.searchText;
  }

  /** Set maximize state without triggering callback (for external reset) */
  public setMaximized(value: boolean): void {
    this.isMaximized = value;
    const btn = this.root.querySelector('.myio-hp__actions .myio-hp__btn:last-child') as HTMLElement;
    if (btn && this.options.showMaximize) {
      // Find the maximize button (it's the last action button when showMaximize is true)
      const maximizeBtn = Array.from(this.root.querySelectorAll('.myio-hp__btn')).find(
        b => b.getAttribute('title') === 'Maximizar' || b.getAttribute('title') === 'Minimizar'
      ) as HTMLElement;
      if (maximizeBtn) {
        maximizeBtn.innerHTML = value ? ICON_MINIMIZE : ICON_MAXIMIZE;
        maximizeBtn.title = value ? 'Minimizar' : 'Maximizar';
      }
    }
  }

  public clearSearch(): void {
    this.searchText = '';
    const input = this.root.querySelector('.myio-hp__search-input') as HTMLInputElement;
    if (input) input.value = '';
    this.options.onSearchChange?.('');
  }

  public destroy(): void {
    this.root.remove();
  }

  // ── Private ────────────────────────────────

  private applyBorders(): void {
    const { showTopBorder = true, showBottomBorder = true, style } = this.options;

    // Handle top border - skip if transparent
    if (showTopBorder && style?.topBorderColor !== 'transparent') {
      this.root.classList.add('myio-hp--top-border');
      if (style?.topBorderColor) {
        this.root.style.borderTopColor = style.topBorderColor;
      }
    }

    // Handle bottom border - skip if transparent
    if (showBottomBorder && style?.bottomBorderColor !== 'transparent') {
      this.root.classList.add('myio-hp--bottom-border');
      if (style?.bottomBorderColor) {
        this.root.style.borderBottomColor = style.bottomBorderColor;
      }
    }

    // Handle background - support both color and gradient
    if (style?.backgroundColor) {
      if (style.backgroundColor.includes('gradient')) {
        this.root.style.background = style.backgroundColor;
      } else {
        this.root.style.backgroundColor = style.backgroundColor;
      }
    }
  }

  private render(): void {
    const {
      title,
      icon,
      quantity,
      style,
      showSearch,
      searchPlaceholder,
      showFilter,
      showMaximize,
    } = this.options;

    this.root.innerHTML = '';

    // Main row
    const row = document.createElement('div');
    row.className = 'myio-hp__row';
    if (style?.height) {
      row.style.height = style.height;
      row.style.minHeight = style.height;
    }

    // Left section: icon + title + quantity
    const left = document.createElement('div');
    left.className = 'myio-hp__left';

    if (icon) {
      const iconEl = document.createElement('span');
      iconEl.className = 'myio-hp__icon';
      iconEl.innerHTML = icon;
      if (style?.iconColor) iconEl.style.color = style.iconColor;
      left.appendChild(iconEl);
    }

    const titleEl = document.createElement('h3');
    titleEl.className = 'myio-hp__title';
    titleEl.textContent = title;
    if (style?.fontSize) titleEl.style.fontSize = style.fontSize;
    if (style?.fontWeight) titleEl.style.fontWeight = style.fontWeight;
    if (style?.color) titleEl.style.color = style.color;
    if (style?.letterSpacing) titleEl.style.letterSpacing = style.letterSpacing;
    if (style?.textTransform) titleEl.style.textTransform = style.textTransform;
    left.appendChild(titleEl);

    if (typeof quantity === 'number') {
      const qtyEl = document.createElement('span');
      qtyEl.className = 'myio-hp__quantity';
      qtyEl.textContent = `(${quantity})`;
      if (style?.quantityBackground) qtyEl.style.background = style.quantityBackground;
      if (style?.quantityColor) qtyEl.style.color = style.quantityColor;
      left.appendChild(qtyEl);
    }

    row.appendChild(left);

    // Right section: action buttons
    const actions = document.createElement('div');
    actions.className = 'myio-hp__actions';

    // Helper to apply button styles with hover
    const applyButtonStyle = (btn: HTMLButtonElement) => {
      if (style?.buttonColor) btn.style.color = style.buttonColor;
      btn.addEventListener('mouseenter', () => {
        if (style?.buttonHoverBackground) btn.style.background = style.buttonHoverBackground;
        if (style?.buttonHoverColor) btn.style.color = style.buttonHoverColor;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '';
        if (style?.buttonColor) btn.style.color = style.buttonColor;
      });
    };

    if (showSearch) {
      const searchBtn = document.createElement('button');
      searchBtn.className = 'myio-hp__btn';
      searchBtn.innerHTML = ICON_SEARCH;
      searchBtn.title = 'Buscar';
      applyButtonStyle(searchBtn);
      searchBtn.addEventListener('click', () => this.toggleSearch(searchBtn));
      actions.appendChild(searchBtn);
    }

    if (showFilter) {
      const filterBtn = document.createElement('button');
      filterBtn.className = 'myio-hp__btn';
      filterBtn.innerHTML = ICON_FILTER;
      filterBtn.title = 'Filtrar';
      applyButtonStyle(filterBtn);
      filterBtn.addEventListener('click', () => {
        this.options.handleActionFilter?.();
      });
      actions.appendChild(filterBtn);
    }

    if (showMaximize) {
      const maxBtn = document.createElement('button');
      maxBtn.className = 'myio-hp__btn';
      maxBtn.innerHTML = this.isMaximized ? ICON_MINIMIZE : ICON_MAXIMIZE;
      maxBtn.title = this.isMaximized ? 'Minimizar' : 'Maximizar';
      applyButtonStyle(maxBtn);
      maxBtn.addEventListener('click', () => this.toggleMaximize(maxBtn));
      actions.appendChild(maxBtn);
    }

    // Legacy actionButton support
    const { actionButton } = this.options;
    if (actionButton) {
      const customBtn = document.createElement('button');
      customBtn.className = 'myio-hp__btn';
      customBtn.innerHTML = actionButton.icon;
      customBtn.title = actionButton.title;
      applyButtonStyle(customBtn);
      customBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        actionButton.onClick();
      });
      actions.appendChild(customBtn);
    }

    if (actions.children.length > 0) {
      row.appendChild(actions);
    }

    this.root.appendChild(row);

    // Subtitle (if provided)
    const { subtitle } = this.options;
    if (subtitle) {
      const subtitleEl = document.createElement('p');
      subtitleEl.className = 'myio-hp__subtitle';
      subtitleEl.textContent = subtitle;
      this.root.appendChild(subtitleEl);
    }

    // Search row (hidden by default)
    if (showSearch) {
      const searchRow = document.createElement('div');
      searchRow.className = 'myio-hp__search-row';
      // Apply gradient background to search row if header has gradient
      if (style?.backgroundColor?.includes('gradient')) {
        searchRow.style.background = 'linear-gradient(135deg, #245040 0%, #2F5848 100%)';
        searchRow.style.paddingBottom = '8px';
      }

      const inputWrapper = document.createElement('div');
      inputWrapper.className = 'myio-hp__search-input-wrapper';
      if (style?.searchBackground) inputWrapper.style.background = style.searchBackground;

      const searchIcon = document.createElement('span');
      searchIcon.innerHTML = ICON_SEARCH;
      if (style?.searchPlaceholderColor) searchIcon.style.color = style.searchPlaceholderColor;
      inputWrapper.appendChild(searchIcon);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'myio-hp__search-input';
      input.placeholder = searchPlaceholder || 'Buscar...';
      if (style?.searchColor) input.style.color = style.searchColor;
      input.addEventListener('input', () => {
        this.searchText = input.value.trim();
        this.updateClearButton(input.value.length > 0);
        this.options.onSearchChange?.(this.searchText);
      });
      inputWrapper.appendChild(input);

      const clearBtn = document.createElement('button');
      clearBtn.className = 'myio-hp__search-clear';
      clearBtn.innerHTML = ICON_CLOSE;
      clearBtn.title = 'Limpar';
      if (style?.searchPlaceholderColor) clearBtn.style.color = style.searchPlaceholderColor;
      clearBtn.addEventListener('click', () => {
        input.value = '';
        this.searchText = '';
        this.updateClearButton(false);
        this.options.onSearchChange?.('');
        input.focus();
      });
      inputWrapper.appendChild(clearBtn);

      searchRow.appendChild(inputWrapper);
      this.root.appendChild(searchRow);
    }
  }

  private toggleSearch(btn: HTMLElement): void {
    this.searchOpen = !this.searchOpen;
    btn.classList.toggle('myio-hp__btn--active', this.searchOpen);

    const searchRow = this.root.querySelector('.myio-hp__search-row') as HTMLElement;
    if (searchRow) {
      searchRow.classList.toggle('myio-hp__search-row--open', this.searchOpen);
      if (this.searchOpen) {
        const input = searchRow.querySelector('input');
        if (input) {
          requestAnimationFrame(() => input.focus());
        }
      }
    }
  }

  private toggleMaximize(btn: HTMLElement): void {
    this.isMaximized = !this.isMaximized;
    btn.innerHTML = this.isMaximized ? ICON_MINIMIZE : ICON_MAXIMIZE;
    btn.title = this.isMaximized ? 'Minimizar' : 'Maximizar';
    this.options.onMaximizeToggle?.(this.isMaximized);
  }

  private updateClearButton(visible: boolean): void {
    const clearBtn = this.root.querySelector('.myio-hp__search-clear') as HTMLElement;
    if (clearBtn) {
      clearBtn.classList.toggle('myio-hp__search-clear--visible', visible);
    }
  }
}

export default HeaderPanelComponent;
