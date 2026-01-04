/**
 * RFC-0125: HeaderDevicesGrid View
 * Renders the stats header DOM structure
 */

import type {
  HeaderDevicesGridParams,
  HeaderDevicesDomain,
  HeaderDevicesThemeMode,
  HeaderStats,
  HeaderLabels,
  HeaderDomainConfig,
} from './types.js';
import { injectHeaderDevicesGridStyles } from './styles.js';

const DOMAIN_CONFIG: Record<HeaderDevicesDomain, HeaderDomainConfig> = {
  energy: {
    totalLabel: 'Total Equipamentos',
    consumptionLabel: 'Consumo Total',
    zeroLabel: 'Consumo Zero',
    unit: 'kWh',
    formatValue: (value: number) => `${value.toFixed(2)} kWh`,
  },
  water: {
    totalLabel: 'Total Hidrômetros',
    consumptionLabel: 'Consumo Total',
    zeroLabel: 'Consumo Zero',
    unit: 'm³',
    formatValue: (value: number) => `${value.toFixed(2)} m³`,
  },
  temperature: {
    totalLabel: 'Total Sensores',
    consumptionLabel: 'Temp. Média',
    zeroLabel: 'Sem Leitura',
    unit: '°C',
    formatValue: (value: number) => `${value.toFixed(1)} °C`,
  },
};

export class HeaderDevicesGridView {
  private container: HTMLElement;
  private headerEl: HTMLElement | null = null;
  private domain: HeaderDevicesDomain;
  private idPrefix: string;
  private labels: Required<HeaderLabels>;
  private themeMode: HeaderDevicesThemeMode;
  private domainConfig: HeaderDomainConfig;
  private includeSearch: boolean;
  private includeFilter: boolean;
  private onSearchClick?: () => void;
  private onFilterClick?: () => void;
  private onMaximizeClick?: (maximized: boolean) => void;

  private ids: {
    header: string;
    connectivity: string;
    total: string;
    consumption: string;
    zero: string;
    searchWrap: string;
    searchInput: string;
    btnSearch: string;
    btnFilter: string;
    btnMaximize: string;
  };

  constructor(params: HeaderDevicesGridParams) {
    injectHeaderDevicesGridStyles();

    this.container =
      typeof params.container === 'string'
        ? (document.querySelector(params.container) as HTMLElement)
        : params.container;

    if (!this.container) {
      throw new Error('[HeaderDevicesGridView] Container not found');
    }

    this.domain = params.domain || 'energy';
    this.idPrefix = params.idPrefix || 'devices';
    this.themeMode = params.themeMode || 'light';
    this.domainConfig = DOMAIN_CONFIG[this.domain];
    this.includeSearch = params.includeSearch !== false;
    this.includeFilter = params.includeFilter !== false;
    this.onSearchClick = params.onSearchClick;
    this.onFilterClick = params.onFilterClick;
    this.onMaximizeClick = params.onMaximizeClick;

    this.labels = {
      connectivity: params.labels?.connectivity || 'Conectividade',
      total: params.labels?.total || this.domainConfig.totalLabel,
      consumption: params.labels?.consumption || this.domainConfig.consumptionLabel,
      zero: params.labels?.zero || this.domainConfig.zeroLabel,
    };

    this.ids = {
      header: `${this.idPrefix}StatsHeader`,
      connectivity: `${this.idPrefix}StatsConnectivity`,
      total: `${this.idPrefix}StatsTotal`,
      consumption: `${this.idPrefix}StatsConsumption`,
      zero: `${this.idPrefix}StatsZero`,
      searchWrap: `${this.idPrefix}SearchWrap`,
      searchInput: `${this.idPrefix}Search`,
      btnSearch: `${this.idPrefix}BtnSearch`,
      btnFilter: `${this.idPrefix}BtnFilter`,
      btnMaximize: `${this.idPrefix}BtnMaximize`,
    };

    this.render();
    this.attachEventListeners();
  }

  private render(): void {
    const searchButtonHTML = this.includeSearch
      ? `<button class="icon-btn" id="${this.ids.btnSearch}" title="Buscar" aria-label="Buscar">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5z"/>
          </svg>
        </button>`
      : '';

    const filterButtonHTML = this.includeFilter
      ? `<button class="icon-btn" id="${this.ids.btnFilter}" title="Filtros" aria-label="Filtros">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/>
          </svg>
        </button>`
      : '';

    const themeClass = this.themeMode === 'light' ? 'hdg-header--light' : '';

    const headerHTML = `
      <div class="hdg-header ${themeClass}" id="${this.ids.header}">
        <div class="stat-item">
          <span class="stat-label">${this.labels.connectivity}</span>
          <span class="stat-value" id="${this.ids.connectivity}">-</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">${this.labels.total}</span>
          <span class="stat-value" id="${this.ids.total}">-</span>
        </div>
        <div class="stat-item highlight">
          <span class="stat-label">${this.labels.consumption}</span>
          <span class="stat-value" id="${this.ids.consumption}">-</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">${this.labels.zero}</span>
          <span class="stat-value" id="${this.ids.zero}">-</span>
        </div>
        <div class="filter-actions">
          <div class="search-wrap" id="${this.ids.searchWrap}">
            <input type="text" id="${this.ids.searchInput}" placeholder="Buscar..." autocomplete="off">
          </div>
          ${searchButtonHTML}
          ${filterButtonHTML}
          <button class="icon-btn" id="${this.ids.btnMaximize}" title="Maximizar" aria-label="Maximizar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="icon-maximize" aria-hidden="true">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="icon-minimize" aria-hidden="true">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    this.container.insertAdjacentHTML('afterbegin', headerHTML);
    this.headerEl = document.getElementById(this.ids.header);
  }

  private attachEventListeners(): void {
    setTimeout(() => {
      // Search button
      if (this.includeSearch && this.onSearchClick) {
        const btnSearch = document.getElementById(this.ids.btnSearch);
        const searchWrap = document.getElementById(this.ids.searchWrap);
        if (btnSearch) {
          btnSearch.addEventListener('click', () => {
            if (searchWrap) {
              searchWrap.classList.toggle('active');
              if (searchWrap.classList.contains('active')) {
                const input = document.getElementById(this.ids.searchInput) as HTMLInputElement;
                if (input) input.focus();
              }
            }
            this.onSearchClick?.();
          });
        }
      }

      // Filter button
      if (this.includeFilter && this.onFilterClick) {
        const btnFilter = document.getElementById(this.ids.btnFilter);
        if (btnFilter) {
          btnFilter.addEventListener('click', () => {
            this.onFilterClick?.();
          });
        }
      }

      // Maximize button
      const btnMaximize = document.getElementById(this.ids.btnMaximize);
      if (btnMaximize) {
        btnMaximize.addEventListener('click', () => {
          const telemetryWrap = document.querySelector('.telemetry-grid-wrap');
          if (!telemetryWrap) return;

          const isMaximized = telemetryWrap.classList.toggle('maximized');

          const iconMax = btnMaximize.querySelector('.icon-maximize') as HTMLElement;
          const iconMin = btnMaximize.querySelector('.icon-minimize') as HTMLElement;
          if (iconMax && iconMin) {
            iconMax.style.display = isMaximized ? 'none' : 'block';
            iconMin.style.display = isMaximized ? 'block' : 'none';
          }

          window.dispatchEvent(
            new CustomEvent('myio:telemetry-maximize', {
              detail: { domain: this.domain, idPrefix: this.idPrefix, maximized: isMaximized },
            })
          );

          this.onMaximizeClick?.(isMaximized);
        });
      }
    }, 0);
  }

  public updateStats(stats: HeaderStats): void {
    const { online = 0, total = 0, consumption = 0, zeroCount = 0 } = stats;

    const connectivityEl = document.getElementById(this.ids.connectivity);
    const totalEl = document.getElementById(this.ids.total);
    const consumptionEl = document.getElementById(this.ids.consumption);
    const zeroEl = document.getElementById(this.ids.zero);

    if (!connectivityEl || !totalEl || !consumptionEl || !zeroEl) return;

    const percentage = total > 0 ? ((online / total) * 100).toFixed(1) : '0.0';

    connectivityEl.textContent = `${online}/${total} (${percentage}%)`;
    totalEl.textContent = total.toString();
    consumptionEl.textContent = this.domainConfig.formatValue(consumption);
    zeroEl.textContent = zeroCount.toString();
  }

  public setThemeMode(mode: HeaderDevicesThemeMode): void {
    if (this.themeMode === mode) return;
    this.themeMode = mode;

    if (this.headerEl) {
      this.headerEl.classList.toggle('hdg-header--light', mode === 'light');
    }
  }

  public getSearchInput(): HTMLInputElement | null {
    return document.getElementById(this.ids.searchInput) as HTMLInputElement | null;
  }

  public toggleSearch(active?: boolean): void {
    const searchWrap = document.getElementById(this.ids.searchWrap);
    if (searchWrap) {
      if (active !== undefined) {
        searchWrap.classList.toggle('active', active);
      } else {
        searchWrap.classList.toggle('active');
      }
    }
  }

  public getElement(): HTMLElement | null {
    return this.headerEl;
  }

  public destroy(): void {
    if (this.headerEl) {
      this.headerEl.remove();
      this.headerEl = null;
    }
  }
}
