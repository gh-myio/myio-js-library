/**
 * CustomerCardV2 Component - Metro UI Style
 * Flat design with square tiles in a 2x3 grid
 */

import {
  CustomerCardData,
  CustomerCardV2Params,
  CustomerCardV2Instance,
  ThemeMode,
} from './types';
import { injectCustomerCardV2Styles } from './styles';

export class CustomerCardV2 implements CustomerCardV2Instance {
  private container: HTMLElement;
  private element: HTMLElement;
  private card: CustomerCardData;
  private index: number;
  private themeMode: ThemeMode;
  private params: CustomerCardV2Params;

  constructor(params: CustomerCardV2Params) {
    this.params = params;
    this.container = params.container;
    this.card = params.card;
    this.index = params.index;
    this.themeMode = params.themeMode || 'dark';

    // Inject styles
    injectCustomerCardV2Styles();

    // Create and render element
    this.element = this.render();
    this.container.appendChild(this.element);

    // Bind events
    this.bindEvents();
  }

  private render(): HTMLElement {
    const el = document.createElement('div');
    el.className = `myio-customer-card-v2${this.themeMode === 'light' ? ' myio-customer-card-v2--light' : ''}`;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `Acessar ${this.card.title}`);
    el.dataset.cardIndex = String(this.index);
    el.dataset.dashboardId = this.card.dashboardId;
    el.dataset.entityId = this.card.entityId;
    el.dataset.entityType = this.card.entityType || 'ASSET';

    el.innerHTML = this.buildInnerHTML();
    return el;
  }

  private buildInnerHTML(): string {
    const tilesHTML = this.buildTilesHTML();

    return `
      <div class="myio-customer-card-v2__header">
        <h3 class="myio-customer-card-v2__title">${this.card.title}</h3>
      </div>
      <div class="myio-customer-card-v2__tiles">
        ${tilesHTML}
      </div>
    `;
  }

  private buildTilesHTML(): string {
    const counts = this.card.deviceCounts || {};
    const meta = this.card.metaCounts || {};

    // Helper: render count or spinner
    const renderValue = (count: number | null | undefined): string =>
      count === null || count === undefined
        ? '<span class="myio-customer-card-v2__spinner"></span>'
        : String(count);

    // Build tiles in order: energy, water, temperature, users, alarms, notifications
    const tiles = [
      { type: 'energy', icon: '⚡', value: renderValue(counts.energy) },
      { type: 'water', icon: '💧', value: renderValue(counts.water) },
      { type: 'temperature', icon: '🌡️', value: renderValue(counts.temperature) },
      { type: 'users', icon: '👥', value: String(meta.users || 0) },
      { type: 'alarms', icon: '🚨', value: String(meta.alarms || 0) },
      { type: 'notifications', icon: '🔔', value: String(meta.notifications || 0) },
    ];

    return tiles
      .map(
        (tile) => `
      <div class="myio-customer-card-v2__tile myio-customer-card-v2__tile--${tile.type}"
           data-tile-type="${tile.type}"
           data-card-index="${this.index}">
        <span class="myio-customer-card-v2__tile-icon">${tile.icon}</span>
        <span class="myio-customer-card-v2__tile-value">${tile.value}</span>
      </div>
    `
      )
      .join('');
  }

  private bindEvents(): void {
    // Header click (card click)
    const header = this.element.querySelector('.myio-customer-card-v2__header');
    if (header) {
      header.addEventListener('click', () => {
        this.params.onClick?.(this.card);
      });
    }

    // Tile clicks
    const tiles = this.element.querySelectorAll('.myio-customer-card-v2__tile');
    tiles.forEach((tile) => {
      tile.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const tileType = (tile as HTMLElement).dataset.tileType;
        if (tileType && this.params.onTileClick) {
          this.params.onTileClick(tileType, this.card, this.index);
        }
      });
    });

    // Keyboard support
    this.element.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.params.onClick?.(this.card);
      }
    });
  }

  // Public API

  public update(cardData: Partial<CustomerCardData>): void {
    Object.assign(this.card, cardData);
    this.element.innerHTML = this.buildInnerHTML();
    this.bindEvents();
  }

  public setThemeMode(mode: ThemeMode): void {
    this.themeMode = mode;
    this.element.classList.toggle('myio-customer-card-v2--light', mode === 'light');
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public destroy(): void {
    this.element.remove();
  }
}

/**
 * Factory function to create a CustomerCardV2 instance
 */
export function createCustomerCardV2(params: CustomerCardV2Params): CustomerCardV2Instance {
  return new CustomerCardV2(params);
}
