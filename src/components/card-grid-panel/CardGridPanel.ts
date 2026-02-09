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
`;

function injectStyles(): void {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
}

// ────────────────────────────────────────────
// Component class
// ────────────────────────────────────────────

export class CardGridPanel {
  private root: HTMLElement;
  private options: CardGridPanelOptions;
  private headerComponent: HeaderPanelComponent | null = null;

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
      // Search
      showSearch,
      searchPlaceholder,
      onSearchChange,
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

    items.forEach(item => {
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
}
