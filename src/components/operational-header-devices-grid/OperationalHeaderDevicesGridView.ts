/**
 * RFC-0152: OperationalHeaderDevicesGrid View
 * Premium stats header for operational equipment grids
 */

import type {
  OperationalHeaderDevicesGridParams,
  OperationalHeaderThemeMode,
  OperationalHeaderStats,
  CustomerOption,
} from './types';
import { injectOperationalHeaderDevicesGridStyles } from './styles';

export class OperationalHeaderDevicesGridView {
  private container: HTMLElement;
  private headerEl: HTMLElement | null = null;
  private idPrefix: string;
  private themeMode: OperationalHeaderThemeMode;
  private includeSearch: boolean;
  private includeFilter: boolean;
  private includeCustomerFilter: boolean;
  private includeMaximize: boolean;
  private customers: CustomerOption[];
  private onSearchChange?: (query: string) => void;
  private onFilterClick?: () => void;
  private onCustomerChange?: (customerId: string) => void;
  private onMaximizeClick?: (maximized: boolean) => void;

  private stats: OperationalHeaderStats = {
    online: 0,
    offline: 0,
    maintenance: 0,
    warning: 0,
    total: 0,
    avgAvailability: 0,
    avgMtbf: 0,
    avgMttr: 0,
  };

  private ids: {
    header: string;
    titleCount: string;
    statOnline: string;
    statOffline: string;
    statMaintenance: string;
    statAvailability: string;
    searchWrap: string;
    searchInput: string;
    btnSearch: string;
    btnFilter: string;
    btnMaximize: string;
    customerSelect: string;
  };

  constructor(params: OperationalHeaderDevicesGridParams) {
    injectOperationalHeaderDevicesGridStyles();

    this.container =
      typeof params.container === 'string'
        ? (document.querySelector(params.container) as HTMLElement)
        : params.container;

    if (!this.container) {
      throw new Error('[OperationalHeaderDevicesGridView] Container not found');
    }

    this.idPrefix = params.idPrefix || 'operational';
    this.themeMode = params.themeMode || 'dark';
    this.includeSearch = params.includeSearch !== false;
    this.includeFilter = params.includeFilter !== false;
    this.includeCustomerFilter = params.includeCustomerFilter !== false;
    this.includeMaximize = params.includeMaximize !== false;
    this.customers = params.customers || [];
    this.onSearchChange = params.onSearchChange;
    this.onFilterClick = params.onFilterClick;
    this.onCustomerChange = params.onCustomerChange;
    this.onMaximizeClick = params.onMaximizeClick;

    this.ids = {
      header: `${this.idPrefix}Header`,
      titleCount: `${this.idPrefix}TitleCount`,
      statOnline: `${this.idPrefix}StatOnline`,
      statOffline: `${this.idPrefix}StatOffline`,
      statMaintenance: `${this.idPrefix}StatMaintenance`,
      statAvailability: `${this.idPrefix}StatAvailability`,
      searchWrap: `${this.idPrefix}SearchWrap`,
      searchInput: `${this.idPrefix}SearchInput`,
      btnSearch: `${this.idPrefix}BtnSearch`,
      btnFilter: `${this.idPrefix}BtnFilter`,
      btnMaximize: `${this.idPrefix}BtnMaximize`,
      customerSelect: `${this.idPrefix}CustomerSelect`,
    };

    this.render();
    this.attachEventListeners();
  }

  private render(): void {
    const themeClass = this.themeMode === 'light' ? 'ohg-header--light' : '';

    const customerSelectHTML = this.includeCustomerFilter
      ? `<select class="customer-select" id="${this.ids.customerSelect}">
          <option value="all">Todos os Clientes</option>
          ${this.customers.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('')}
        </select>`
      : '';

    const searchButtonHTML = this.includeSearch
      ? `<button class="icon-btn" id="${this.ids.btnSearch}" title="Buscar" aria-label="Buscar">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5z"/>
          </svg>
        </button>`
      : '';

    const filterButtonHTML = this.includeFilter
      ? `<button class="icon-btn filter-btn" id="${this.ids.btnFilter}" title="Filtros" aria-label="Filtros">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/>
          </svg>
        </button>`
      : '';

    const maximizeButtonHTML = this.includeMaximize
      ? `<button class="icon-btn" id="${this.ids.btnMaximize}" title="Maximizar" aria-label="Maximizar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="icon-maximize" aria-hidden="true">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="icon-minimize" aria-hidden="true">
            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
          </svg>
        </button>`
      : '';

    const headerHTML = `
      <div class="ohg-header ${themeClass}" id="${this.ids.header}">
        <div class="ohg-title-section">
          <span class="ohg-title">Lista Geral</span>
          <span class="ohg-count" id="${this.ids.titleCount}">0</span>
        </div>

        <div class="stat-item online">
          <span class="stat-label">Online</span>
          <span class="stat-value" id="${this.ids.statOnline}">0</span>
        </div>

        <div class="stat-item offline">
          <span class="stat-label">Offline</span>
          <span class="stat-value" id="${this.ids.statOffline}">0</span>
        </div>

        <div class="stat-item maintenance">
          <span class="stat-label">Manutencao</span>
          <span class="stat-value" id="${this.ids.statMaintenance}">0</span>
        </div>

        <div class="stat-item availability">
          <span class="stat-label">Disponibilidade</span>
          <span class="stat-value" id="${this.ids.statAvailability}">0%</span>
        </div>

        <div class="filter-actions">
          ${customerSelectHTML}
          <div class="search-wrap" id="${this.ids.searchWrap}">
            <input type="text" id="${this.ids.searchInput}" placeholder="Buscar..." autocomplete="off">
          </div>
          ${searchButtonHTML}
          ${filterButtonHTML}
          ${maximizeButtonHTML}
        </div>
      </div>
    `;

    this.container.insertAdjacentHTML('afterbegin', headerHTML);
    this.headerEl = document.getElementById(this.ids.header);
  }

  private attachEventListeners(): void {
    setTimeout(() => {
      // Search button
      if (this.includeSearch) {
        const btnSearch = document.getElementById(this.ids.btnSearch);
        const searchWrap = document.getElementById(this.ids.searchWrap);
        const searchInput = document.getElementById(this.ids.searchInput) as HTMLInputElement;

        if (btnSearch && searchWrap) {
          btnSearch.addEventListener('click', () => {
            searchWrap.classList.toggle('active');
            if (searchWrap.classList.contains('active') && searchInput) {
              searchInput.focus();
            }
          });
        }

        if (searchInput) {
          searchInput.addEventListener('input', () => {
            this.onSearchChange?.(searchInput.value);
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

      // Customer select
      if (this.includeCustomerFilter && this.onCustomerChange) {
        const customerSelect = document.getElementById(this.ids.customerSelect) as HTMLSelectElement;
        if (customerSelect) {
          customerSelect.addEventListener('change', () => {
            this.onCustomerChange?.(customerSelect.value);
          });
        }
      }

      // Maximize button
      if (this.includeMaximize) {
        const btnMaximize = document.getElementById(this.ids.btnMaximize);
        if (btnMaximize) {
          btnMaximize.addEventListener('click', () => {
            const gridWrap = this.container.closest('.operational-grid-wrap') || this.container;
            if (!gridWrap) return;

            const isMaximized = gridWrap.classList.toggle('maximized');

            const iconMax = btnMaximize.querySelector('.icon-maximize') as HTMLElement;
            const iconMin = btnMaximize.querySelector('.icon-minimize') as HTMLElement;
            if (iconMax && iconMin) {
              iconMax.style.display = isMaximized ? 'none' : 'block';
              iconMin.style.display = isMaximized ? 'block' : 'none';
            }

            window.dispatchEvent(
              new CustomEvent('myio:operational-maximize', {
                detail: { maximized: isMaximized },
              })
            );

            this.onMaximizeClick?.(isMaximized);
          });
        }
      }
    }, 0);
  }

  public updateStats(stats: Partial<OperationalHeaderStats>): void {
    this.stats = { ...this.stats, ...stats };

    const titleCountEl = document.getElementById(this.ids.titleCount);
    const onlineEl = document.getElementById(this.ids.statOnline);
    const offlineEl = document.getElementById(this.ids.statOffline);
    const maintenanceEl = document.getElementById(this.ids.statMaintenance);
    const availabilityEl = document.getElementById(this.ids.statAvailability);

    if (titleCountEl) titleCountEl.textContent = String(this.stats.total);
    if (onlineEl) onlineEl.textContent = String(this.stats.online);
    if (offlineEl) offlineEl.textContent = String(this.stats.offline);
    if (maintenanceEl) maintenanceEl.textContent = String(this.stats.maintenance);
    if (availabilityEl) availabilityEl.textContent = `${this.stats.avgAvailability.toFixed(1)}%`;
  }

  public setThemeMode(mode: OperationalHeaderThemeMode): void {
    if (this.themeMode === mode) return;
    this.themeMode = mode;

    if (this.headerEl) {
      this.headerEl.classList.toggle('ohg-header--light', mode === 'light');
    }
  }

  public updateCustomers(customers: CustomerOption[]): void {
    this.customers = customers;
    const customerSelect = document.getElementById(this.ids.customerSelect) as HTMLSelectElement;
    if (customerSelect) {
      const currentValue = customerSelect.value;
      customerSelect.innerHTML = `
        <option value="all">Todos os Clientes</option>
        ${customers.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('')}
      `;
      // Restore selection if still valid
      if (customers.some(c => c.id === currentValue) || currentValue === 'all') {
        customerSelect.value = currentValue;
      }
    }
  }

  public setSelectedCustomer(customerId: string): void {
    const customerSelect = document.getElementById(this.ids.customerSelect) as HTMLSelectElement;
    if (customerSelect) {
      customerSelect.value = customerId;
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

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  public destroy(): void {
    if (this.headerEl) {
      this.headerEl.remove();
      this.headerEl = null;
    }
  }
}
