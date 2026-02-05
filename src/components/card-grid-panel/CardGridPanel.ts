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

export interface CardGridPanelOptions {
  /** Panel title (e.g. "Infraestrutura Hidrica") */
  title: string;
  /** Items to render as cards */
  items: CardGridItem[];
  /** Optional customStyle applied to every card */
  cardCustomStyle?: CardGridCustomStyle;
  /** Callback when a card is clicked */
  handleClickCard?: (item: CardGridItem) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Min card width for the auto-fill grid (default: 140px) */
  gridMinCardWidth?: string;
  /** Show temp range tooltip on cards */
  showTempRangeTooltip?: boolean;
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
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--cgp-min-card-w, 140px), 1fr));
    gap: 12px;
    align-content: start;
  }

  /* Thin scrollbar */
  .myio-cgp__grid::-webkit-scrollbar { width: 4px; }
  .myio-cgp__grid::-webkit-scrollbar-track { background: transparent; }
  .myio-cgp__grid::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }

  .myio-cgp__card-wrapper {
    min-width: 0;
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

  constructor(options: CardGridPanelOptions) {
    injectStyles();
    this.options = options;
    this.root = document.createElement('div');
    this.root.className = 'myio-cgp';
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
    const el = this.root.querySelector('.myio-cgp__title') as HTMLElement;
    if (el) el.textContent = title;
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
    const { title, gridMinCardWidth } = this.options;

    this.root.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'myio-cgp__header';

    const titleEl = document.createElement('h3');
    titleEl.className = 'myio-cgp__title';
    titleEl.textContent = title;
    header.appendChild(titleEl);
    this.root.appendChild(header);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'myio-cgp__grid';
    if (gridMinCardWidth) {
      grid.style.setProperty('--cgp-min-card-w', gridMinCardWidth);
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
      cardCustomStyle,
      handleClickCard,
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
      const cardResult = (renderCardComponentV6 as Function)({
        entityObject: item.entityObject,
        handleActionDashboard: undefined,
        handleActionReport: undefined,
        handleActionSettings: undefined,
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

      if (cardResult && cardResult[0]) {
        const wrapper = document.createElement('div');
        wrapper.className = 'myio-cgp__card-wrapper';
        wrapper.dataset.deviceId = item.id;
        wrapper.appendChild(cardResult[0]);
        grid.appendChild(wrapper);
      }
    });
  }
}
