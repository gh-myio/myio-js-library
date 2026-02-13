/**
 * CardGridPanel — Reusable card grid component
 *
 * Renders a titled panel with a responsive grid of device cards (v6).
 * Used for Water Infrastructure, HVAC, Motors, etc.
 *
 * Features:
 * - Configurable title
 * - Responsive CSS grid of renderCardComponentV6 cards
 * - Entity-object based: accepts pre-mapped entityObjects
 * - Per-card customStyle support
 * - handleClickCard callback per item
 * - Empty state
 * - 10px border-radius panel
 */

import { renderCardComponentV6 } from '../template-card-v6/template-card-v6.js';
import { renderCardAmbienteV6 } from '../template-card-ambiente-v6/template-card-ambiente-v6.js';
import { HeaderPanelComponent, HeaderPanelStyle } from '../header-panel/HeaderPanelComponent';

/**
 * Card type for the grid
 * - 'device': Standard device card (renderCardComponentV6)
 * - 'ambiente': Ambiente card with aggregated metrics (renderCardAmbienteV6)
 */
export type CardType = 'device' | 'ambiente';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

/**
 * Tab item configuration for header tabs
 */
export interface TabItem {
  /** Unique identifier for the tab */
  id: string;
  /** Display label */
  label: string;
  /** Whether this tab is selected */
  selected?: boolean;
  /** Colors configuration (optional) */
  colors?: {
    /** Background color when selected */
    selectedBackground?: string;
    /** Text color when selected */
    selectedColor?: string;
    /** Background color when not selected */
    unselectedBackground?: string;
    /** Text color when not selected */
    unselectedColor?: string;
  };
  /** Click handler */
  handleClick?: (tab: TabItem) => void;
}

export interface CardGridItem {
  /** Unique identifier */
  id: string;
  /** Pre-mapped entityObject for renderCardComponentV6 */
  entityObject: Record<string, unknown>;
  /** Optional: original device reference (passed back in click handler) */
  source?: unknown;
}

export interface CardGridCustomStyle {
  fontSize?: string;
  backgroundColor?: string;
  fontColor?: string;
  width?: string;
  height?: string;
}

/** @deprecated Use HeaderPanelStyle from header-panel component */
export type CardGridTitleStyle = HeaderPanelStyle;

export interface CardGridPanelOptions {
  /** Panel title (e.g. "Infraestrutura Hidrica") */
  title: string;
  /** Icon (SVG string or emoji) displayed before title */
  icon?: string;
  /** Item count to display as (N) badge in header */
  quantity?: number;
  /** Items to render as cards */
  items: CardGridItem[];
  /**
   * Card type to render:
   * - 'device': Standard device card (default)
   * - 'ambiente': Ambiente card with aggregated metrics
   */
  cardType?: CardType;
  /**
   * Panel background - can be:
   * - Hex color: '#e8f4fc'
   * - RGB/RGBA: 'rgba(0,100,200,0.1)'
   * - Image URL: 'https://example.com/bg.png' or '/path/to/bg.jpg'
   * Default: #faf8f1
   */
  panelBackground?: string;
  /** Optional customStyle applied to every card */
  cardCustomStyle?: CardGridCustomStyle;
  /** Optional style for the title/header (slim, premium look) */
  titleStyle?: CardGridTitleStyle;
  /** Callback when a card is clicked */
  handleClickCard?: (item: CardGridItem) => void;
  /** Callback for card's dashboard action button (lateral piano-key) */
  handleActionDashboard?: (item: CardGridItem) => void;
  /** Callback for card's report action button (lateral piano-key) */
  handleActionReport?: (item: CardGridItem) => void;
  /** Callback for card's settings action button (lateral piano-key) */
  handleActionSettings?: (item: CardGridItem) => void;
  /** Callback for ambiente card remote toggle (only for cardType='ambiente') */
  handleToggleRemote?: (isOn: boolean, item: CardGridItem) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Min card width for the auto-fill grid (default: 140px) */
  gridMinCardWidth?: string;
  /** Gap between cards in the grid (default: 16px) */
  gridGap?: string;
  /** Show temp range tooltip on cards */
  showTempRangeTooltip?: boolean;
  /** Show search toggle button in header */
  showSearch?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Callback when search text changes (filters cards locally) */
  onSearchChange?: (text: string) => void;
  /** Show filter button in header */
  showFilter?: boolean;
  /** Callback when filter button is clicked */
  handleActionFilter?: () => void;
  /** Show maximize/minimize toggle in header */
  showMaximize?: boolean;
  /** Callback when maximize/minimize is toggled */
  onMaximizeToggle?: (isMaximized: boolean) => void;
  /** Optional tabs in header (supports N tabs with horizontal scroll for 3+) */
  tabs?: TabItem[];
  /** Callback when tab selection changes (receives the newly selected tab) */
  onTabChange?: (tab: TabItem) => void;
}

// ────────────────────────────────────────────
// CSS (injected once)
// ────────────────────────────────────────────

const CSS_ID = 'myio-card-grid-panel-styles';

const PANEL_CSS = `
  .myio-cgp {
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    background: #faf8f1;
    border: 1px solid #e8e4d9;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    height: 100%;
    min-width: 0;
  }

  .myio-cgp__header {
    padding: 14px 16px 10px 16px;
    border-bottom: 1px solid #e8e4d9;
    flex-shrink: 0;
  }

  .myio-cgp__title {
    font-size: 0.82rem;
    font-weight: 700;
    color: #1a1a1a;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin: 0;
  }

  .myio-cgp__grid {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--cgp-min-card-w, 140px), 1fr));
    grid-auto-rows: auto;
    gap: var(--cgp-grid-gap, 16px);
    row-gap: var(--cgp-grid-gap, 16px);
    column-gap: var(--cgp-grid-gap, 16px);
    align-content: start;
  }

  /* Thin scrollbar */
  .myio-cgp__grid::-webkit-scrollbar { width: 4px; }
  .myio-cgp__grid::-webkit-scrollbar-track { background: transparent; }
  .myio-cgp__grid::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }

  .myio-cgp__card-wrapper {
    min-width: 0;
    /* Block display - let grid handle sizing, don't use flex */
    display: block;
    margin: 0;
  }

  /* Card should fill wrapper width */
  .myio-cgp__card-wrapper > * {
    width: 100%;
    margin: 0;
  }

  /* Override card v6 width constraints when inside grid */
  .myio-cgp__card-wrapper .device-card-centered,
  .myio-cgp__card-wrapper .device-card-centered.clickable {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
  }

  .myio-cgp__empty {
    padding: 24px 16px;
    text-align: center;
    font-size: 0.8rem;
    color: #999;
  }

  /* ── Tabs ────────────────────────────────── */
  .myio-cgp__tabs-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-bottom: 1px solid #e8e4d9;
    background: linear-gradient(135deg, #245040 0%, #2F5848 100%);
  }

  .myio-cgp__tabs-scroll-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.8);
    padding: 0;
    flex-shrink: 0;
    transition: background 0.15s, opacity 0.15s;
  }

  .myio-cgp__tabs-scroll-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    color: #ffffff;
  }

  .myio-cgp__tabs-scroll-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .myio-cgp__tabs-scroll-btn--visible {
    display: flex;
  }

  .myio-cgp__tabs-scroll-btn svg {
    width: 14px;
    height: 14px;
  }

  .myio-cgp__tabs-container {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    overflow-x: auto;
    scroll-behavior: smooth;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .myio-cgp__tabs-container::-webkit-scrollbar {
    display: none;
  }

  .myio-cgp__tab {
    padding: 5px 12px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.68rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }

  .myio-cgp__tab:hover {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  .myio-cgp__tab--selected {
    background: rgba(255, 255, 255, 0.95);
    color: #2F5848;
    font-weight: 600;
  }

  .myio-cgp__tab--selected:hover {
    background: #ffffff;
    color: #2F5848;
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
// SVG Icons for tabs scroll
// ────────────────────────────────────────────

const ICON_CHEVRON_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;

const ICON_CHEVRON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

// ────────────────────────────────────────────
// Component class
// ────────────────────────────────────────────

export class CardGridPanel {
  private root: HTMLElement;
  private options: CardGridPanelOptions;
  private headerComponent: HeaderPanelComponent | null = null;
  private searchText = '';
  private tabsContainer: HTMLElement | null = null;

  constructor(options: CardGridPanelOptions) {
    injectStyles();
    this.options = options;
    this.root = document.createElement('div');
    this.root.className = 'myio-cgp';
    // Apply custom panel background (color or image)
    if (options.panelBackground) {
      this.applyPanelBackground(options.panelBackground);
    }
    this.render();
  }

  // ── Public API ────────────────────────────

  public getElement(): HTMLElement {
    return this.root;
  }

  /** Replace items and re-render grid */
  public setItems(items: CardGridItem[]): void {
    this.options.items = items;
    this.renderGrid();
  }

  /** Update title */
  public setTitle(title: string): void {
    this.options.title = title;
    if (this.headerComponent) {
      this.headerComponent.setTitle(title);
    }
  }

  /** Update quantity badge */
  public setQuantity(quantity: number): void {
    this.options.quantity = quantity;
    if (this.headerComponent) {
      this.headerComponent.setQuantity(quantity);
    }
  }

  /** Update icon */
  public setIcon(icon: string): void {
    this.options.icon = icon;
    if (this.headerComponent) {
      this.headerComponent.setIcon(icon);
    }
  }

  /** Set maximize state without triggering callback (for external reset) */
  public setMaximized(value: boolean): void {
    if (this.headerComponent) {
      this.headerComponent.setMaximized(value);
    }
  }

  /** Update tabs configuration */
  public setTabs(tabs: TabItem[]): void {
    this.options.tabs = tabs;
    this.renderTabs();
  }

  /** Select a tab by id */
  public selectTab(tabId: string): void {
    if (!this.options.tabs) return;
    this.options.tabs = this.options.tabs.map(t => ({
      ...t,
      selected: t.id === tabId,
    }));
    this.renderTabs();
  }

  /** Get the currently selected tab */
  public getSelectedTab(): TabItem | undefined {
    return this.options.tabs?.find(t => t.selected);
  }

  /** Update panel background (color or image URL) */
  public setPanelBackground(background: string): void {
    this.options.panelBackground = background;
    this.applyPanelBackground(background);
  }

  /** Apply background - detects if it's an image URL or color */
  private applyPanelBackground(background: string): void {
    // Check if it's an image URL (starts with http, https, /, or data:)
    const isImageUrl = /^(https?:\/\/|\/|data:image)/.test(background);
    if (isImageUrl) {
      this.root.style.backgroundImage = `url('${background}')`;
      this.root.style.backgroundSize = 'cover';
      this.root.style.backgroundPosition = 'center';
      this.root.style.backgroundRepeat = 'no-repeat';
    } else {
      // It's a color (hex, rgb, rgba, named color)
      this.root.style.backgroundColor = background;
    }
  }

  /** Update card custom style */
  public setCardCustomStyle(style: CardGridCustomStyle | undefined): void {
    this.options.cardCustomStyle = style;
    this.renderGrid();
  }

  public destroy(): void {
    this.root.remove();
  }

  // ── Render ────────────────────────────────

  private render(): void {
    const {
      title,
      icon,
      quantity,
      gridMinCardWidth,
      titleStyle,
      showSearch,
      searchPlaceholder,
      onSearchChange,
      showFilter,
      handleActionFilter,
      showMaximize,
      onMaximizeToggle,
    } = this.options;

    this.root.innerHTML = '';

    // Header using HeaderPanelComponent with full feature support
    this.headerComponent = new HeaderPanelComponent({
      title,
      icon,
      quantity,
      style: titleStyle,
      showBottomBorder: true,
      showTopBorder: true,
      // Search (internal filtering + optional consumer callback)
      showSearch,
      searchPlaceholder,
      onSearchChange: showSearch ? (text: string) => {
        this.searchText = text.toLowerCase();
        this.renderGrid();
        onSearchChange?.(text);
      } : undefined,
      // Filter
      showFilter,
      handleActionFilter,
      // Maximize
      showMaximize,
      onMaximizeToggle,
    });
    this.root.appendChild(this.headerComponent.getElement());

    // Grid
    const grid = document.createElement('div');
    grid.className = 'myio-cgp__grid';
    if (gridMinCardWidth) {
      grid.style.setProperty('--cgp-min-card-w', gridMinCardWidth);
    }
    if (this.options.gridGap) {
      grid.style.setProperty('--cgp-grid-gap', this.options.gridGap);
    }
    this.root.appendChild(grid);

    // Render tabs if configured
    this.renderTabs();

    this.renderGrid();
  }

  private renderGrid(): void {
    const grid = this.root.querySelector('.myio-cgp__grid') as HTMLElement;
    if (!grid) return;

    grid.innerHTML = '';

    const {
      items,
      cardType,
      cardCustomStyle,
      handleClickCard,
      handleActionDashboard,
      handleActionReport,
      handleActionSettings,
      handleToggleRemote,
      emptyMessage,
      showTempRangeTooltip,
    } = this.options;

    if (!items || items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'myio-cgp__empty';
      empty.textContent = emptyMessage || 'Nenhum dispositivo';
      grid.appendChild(empty);
      return;
    }

    // Filter by search text (match against entityObject.labelOrName, label, or ambienteData.label)
    const filtered = this.searchText
      ? items.filter(it => {
          const label = (it.entityObject?.labelOrName as string)
            || (it.entityObject?.label as string)
            || (it.entityObject?.entityLabel as string)
            || ((it as any).ambienteData?.label as string)
            || '';
          return label.toLowerCase().includes(this.searchText);
        })
      : items;

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'myio-cgp__empty';
      empty.textContent = 'Nenhum resultado';
      grid.appendChild(empty);
      return;
    }

    filtered.forEach(item => {
      let cardResult: [HTMLElement, unknown] | null = null;

      if (cardType === 'ambiente') {
        // Use ambiente card renderer
        // The item should have ambienteData instead of entityObject
        const ambienteData = (item as any).ambienteData || item.entityObject;
        cardResult = (renderCardAmbienteV6 as Function)({
          ambienteData: ambienteData,
          handleActionDashboard: handleActionDashboard
            ? () => handleActionDashboard(item)
            : undefined,
          handleActionReport: handleActionReport
            ? () => handleActionReport(item)
            : undefined,
          handleActionSettings: handleActionSettings
            ? () => handleActionSettings(item)
            : undefined,
          handleClickCard: handleClickCard
            ? () => handleClickCard(item)
            : undefined,
          handleToggleRemote: handleToggleRemote
            ? (isOn: boolean) => handleToggleRemote(isOn, item)
            : undefined,
          enableSelection: false,
          enableDragDrop: false,
          customStyle: cardCustomStyle || undefined,
        });
      } else {
        // Default: Use device card renderer
        cardResult = (renderCardComponentV6 as Function)({
          entityObject: item.entityObject,
          handleActionDashboard: handleActionDashboard
            ? () => handleActionDashboard(item)
            : undefined,
          handleActionReport: handleActionReport
            ? () => handleActionReport(item)
            : undefined,
          handleActionSettings: handleActionSettings
            ? () => handleActionSettings(item)
            : undefined,
          handleSelect: undefined,
          handInfo: undefined,
          handleClickCard: () => {
            handleClickCard?.(item);
          },
          enableSelection: false,
          enableDragDrop: false,
          useNewComponents: true,
          showTempRangeTooltip: showTempRangeTooltip || false,
          customStyle: cardCustomStyle || undefined,
        });
      }

      if (cardResult && cardResult[0]) {
        const wrapper = document.createElement('div');
        wrapper.className = 'myio-cgp__card-wrapper';
        wrapper.dataset.deviceId = item.id;
        // Apply min-height to wrapper if customStyle.height is specified
        // Use min-height so card can grow if content needs more space
        if (cardCustomStyle?.height) {
          wrapper.style.minHeight = cardCustomStyle.height;
        }
        wrapper.appendChild(cardResult[0]);
        grid.appendChild(wrapper);
      }
    });
  }

  private renderTabs(): void {
    const { tabs, onTabChange } = this.options;

    // Remove existing tabs wrapper if any
    const existingTabs = this.root.querySelector('.myio-cgp__tabs-wrapper');
    if (existingTabs) {
      existingTabs.remove();
    }

    // Don't render if no tabs
    if (!tabs || tabs.length === 0) {
      this.tabsContainer = null;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'myio-cgp__tabs-wrapper';

    // Left scroll button
    const leftBtn = document.createElement('button');
    leftBtn.className = 'myio-cgp__tabs-scroll-btn';
    leftBtn.innerHTML = ICON_CHEVRON_LEFT;
    leftBtn.title = 'Rolar esquerda';
    leftBtn.disabled = true;
    wrapper.appendChild(leftBtn);

    // Tabs container
    const container = document.createElement('div');
    container.className = 'myio-cgp__tabs-container';
    this.tabsContainer = container;

    // Render each tab
    tabs.forEach(tab => {
      const tabEl = document.createElement('button');
      tabEl.className = 'myio-cgp__tab';
      tabEl.dataset.tabId = tab.id;
      tabEl.textContent = tab.label;

      if (tab.selected) {
        tabEl.classList.add('myio-cgp__tab--selected');
        // Apply custom selected colors if provided
        if (tab.colors?.selectedBackground) {
          tabEl.style.background = tab.colors.selectedBackground;
        }
        if (tab.colors?.selectedColor) {
          tabEl.style.color = tab.colors.selectedColor;
        }
      } else {
        // Apply custom unselected colors if provided
        if (tab.colors?.unselectedBackground) {
          tabEl.style.background = tab.colors.unselectedBackground;
        }
        if (tab.colors?.unselectedColor) {
          tabEl.style.color = tab.colors.unselectedColor;
        }
      }

      tabEl.addEventListener('click', () => {
        // Update selection state
        this.options.tabs = tabs.map(t => ({
          ...t,
          selected: t.id === tab.id,
        }));
        this.renderTabs();

        // Call tab's own click handler
        tab.handleClick?.(tab);

        // Call global onTabChange callback
        onTabChange?.(tab);
      });

      container.appendChild(tabEl);
    });

    wrapper.appendChild(container);

    // Right scroll button
    const rightBtn = document.createElement('button');
    rightBtn.className = 'myio-cgp__tabs-scroll-btn';
    rightBtn.innerHTML = ICON_CHEVRON_RIGHT;
    rightBtn.title = 'Rolar direita';
    wrapper.appendChild(rightBtn);

    // Show scroll buttons when 3+ tabs
    if (tabs.length >= 3) {
      leftBtn.classList.add('myio-cgp__tabs-scroll-btn--visible');
      rightBtn.classList.add('myio-cgp__tabs-scroll-btn--visible');

      // Scroll handlers
      const scrollAmount = 120;

      leftBtn.addEventListener('click', () => {
        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      });

      rightBtn.addEventListener('click', () => {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      });

      // Update button states on scroll
      const updateScrollButtons = () => {
        leftBtn.disabled = container.scrollLeft <= 0;
        rightBtn.disabled = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;
      };

      container.addEventListener('scroll', updateScrollButtons);

      // Initial state update after render
      requestAnimationFrame(() => {
        updateScrollButtons();
      });
    }

    // Insert tabs after header
    const headerEl = this.root.querySelector('.myio-hp');
    if (headerEl && headerEl.nextSibling) {
      this.root.insertBefore(wrapper, headerEl.nextSibling);
    } else if (headerEl) {
      headerEl.after(wrapper);
    } else {
      // No header, insert at beginning before grid
      const grid = this.root.querySelector('.myio-cgp__grid');
      if (grid) {
        this.root.insertBefore(wrapper, grid);
      } else {
        this.root.appendChild(wrapper);
      }
    }
  }
}
