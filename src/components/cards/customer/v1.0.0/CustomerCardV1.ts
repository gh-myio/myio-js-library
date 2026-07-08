/**
 * CustomerCardV1 Component
 * Reusable customer card component for Welcome Modal and other contexts
 */

import {
  CustomerCardData,
  CustomerCardV1Params,
  CustomerCardV1Instance,
  ThemeMode,
} from './types';
import { injectCustomerCardV1Styles } from './styles';

export class CustomerCardV1 implements CustomerCardV1Instance {
  private container: HTMLElement;
  private element: HTMLElement;
  private card: CustomerCardData;
  private index: number;
  private themeMode: ThemeMode;
  private params: CustomerCardV1Params;

  constructor(params: CustomerCardV1Params) {
    this.params = params;
    this.container = params.container;
    this.card = params.card;
    this.index = params.index;
    this.themeMode = params.themeMode || 'dark';

    // Inject styles
    injectCustomerCardV1Styles();

    // Create and render element
    this.element = this.render();
    this.container.appendChild(this.element);

    // Bind events
    this.bindEvents();

    // Lazy load background image if enabled
    if (params.enableLazyLoading && this.card.bgImageUrl) {
      this.setupLazyLoading();
    } else if (this.card.bgImageUrl) {
      this.loadBackgroundImage();
    }
  }

  private render(): HTMLElement {
    const el = document.createElement('div');
    el.className = `myio-customer-card-v1${this.themeMode === 'light' ? ' myio-customer-card-v1--light' : ''}`;
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
    const bgImage = this.card.bgImageUrl
      ? `<div class="myio-customer-card-v1__bg" data-src="${this.card.bgImageUrl}"></div>`
      : '';

    const metaCountsHTML = this.buildMetaCountsHTML();
    const deviceCountsHTML = this.buildDeviceCountsHTML();

    return `
      ${bgImage}
      ${metaCountsHTML}
      <div class="myio-customer-card-v1__content">
        <h3 class="myio-customer-card-v1__title">${this.card.title}</h3>
      </div>
      ${deviceCountsHTML}
    `;
  }

  private buildMetaCountsHTML(): string {
    const { users = 0, alarms = 0, notifications = 0 } = this.card.metaCounts || {};

    return `
      <div class="myio-customer-card-v1__meta-counts">
        <span class="myio-customer-card-v1__badge myio-customer-card-v1__badge--users"
              data-tooltip-type="users"
              data-card-index="${this.index}"
              title="Usuarios">
          <span class="icon">👥</span> ${users}
        </span>
        <span class="myio-customer-card-v1__badge myio-customer-card-v1__badge--alarms"
              data-tooltip-type="alarms"
              data-card-index="${this.index}"
              title="Alarmes">
          <span class="icon">🚨</span> ${alarms}
        </span>
        <span class="myio-customer-card-v1__badge myio-customer-card-v1__badge--notifications"
              data-tooltip-type="notifications"
              data-card-index="${this.index}"
              title="Notificacoes">
          <span class="icon">🔔</span> ${notifications}
        </span>
      </div>
    `;
  }

  private buildDeviceCountsHTML(): string {
    if (!this.card.deviceCounts) {
      return this.card.subtitle
        ? `<p class="myio-customer-card-v1__subtitle">${this.card.subtitle}</p>`
        : '';
    }

    const counts = this.card.deviceCounts;

    const renderCount = (count: number | null | undefined): string =>
      count === null || count === undefined
        ? '<span class="count-spinner"></span>'
        : String(count);

    const formatEnergy = (value: number | null | undefined): string => {
      if (value === null || value === undefined) return '';
      return value >= 1000
        ? `${(value / 1000).toFixed(1)} MWh`
        : `${value.toFixed(0)} kWh`;
    };

    const formatWater = (value: number | null | undefined): string => {
      if (value === null || value === undefined) return '';
      return `${value.toFixed(0)} m³`;
    };

    const formatTemp = (value: number | null | undefined): string => {
      if (value === null || value === undefined) return '';
      return `${value.toFixed(1)} °C`;
    };

    const energyValue = formatEnergy(counts.energyConsumption);
    const waterValue = formatWater(counts.waterConsumption);
    const tempValue = formatTemp(counts.temperatureAvg);

    return `
      <div class="myio-customer-card-v1__device-counts">
        <span class="myio-customer-card-v1__badge myio-customer-card-v1__badge--energy"
              data-tooltip-type="energy"
              data-card-index="${this.index}"
              title="Resumo de Energia">
          <span class="icon">⚡</span>
          <span class="count">${renderCount(counts.energy)}</span>
          ${energyValue ? `<span class="value">(${energyValue})</span>` : ''}
        </span>
        <span class="myio-customer-card-v1__badge myio-customer-card-v1__badge--water"
              data-tooltip-type="water"
              data-card-index="${this.index}"
              title="Resumo de Agua">
          <span class="icon">💧</span>
          <span class="count">${renderCount(counts.water)}</span>
          ${waterValue ? `<span class="value">(${waterValue})</span>` : ''}
        </span>
        <span class="myio-customer-card-v1__badge myio-customer-card-v1__badge--temperature"
              data-tooltip-type="temperature"
              data-card-index="${this.index}"
              title="Sensores de Temperatura">
          <span class="icon">🌡️</span>
          <span class="count">${renderCount(counts.temperature)}</span>
          ${tempValue ? `<span class="value">(${tempValue})</span>` : ''}
        </span>
      </div>
    `;
  }

  private bindEvents(): void {
    // Card click
    this.element.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      // Don't trigger card click if clicking on badge (tooltip trigger)
      if (target.closest('.myio-customer-card-v1__badge')) {
        const badgeType = target.closest('.myio-customer-card-v1__badge')?.getAttribute('data-tooltip-type');
        if (badgeType && this.params.onBadgeClick) {
          this.params.onBadgeClick(badgeType, this.card, this.index);
        }
        return;
      }
      this.params.onClick?.(this.card);
    });

    // Keyboard support
    this.element.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.params.onClick?.(this.card);
      }
    });
  }

  private setupLazyLoading(): void {
    const bgEl = this.element.querySelector('.myio-customer-card-v1__bg') as HTMLElement;
    if (!bgEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadBackgroundImage();
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    observer.observe(this.element);
  }

  private loadBackgroundImage(): void {
    const bgEl = this.element.querySelector('.myio-customer-card-v1__bg') as HTMLElement;
    if (!bgEl || !this.card.bgImageUrl) return;

    const img = new Image();
    img.onload = () => {
      bgEl.style.backgroundImage = `url('${this.card.bgImageUrl}')`;
      bgEl.classList.add('loaded');
    };
    img.src = this.card.bgImageUrl;
  }

  // Public API

  public update(cardData: Partial<CustomerCardData>): void {
    Object.assign(this.card, cardData);
    this.element.innerHTML = this.buildInnerHTML();

    if (cardData.bgImageUrl) {
      this.loadBackgroundImage();
    }
  }

  public setThemeMode(mode: ThemeMode): void {
    this.themeMode = mode;
    this.element.classList.toggle('myio-customer-card-v1--light', mode === 'light');
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public destroy(): void {
    this.element.remove();
  }
}

/**
 * Factory function to create a CustomerCardV1 instance
 */
export function createCustomerCardV1(params: CustomerCardV1Params): CustomerCardV1Instance {
  return new CustomerCardV1(params);
}
