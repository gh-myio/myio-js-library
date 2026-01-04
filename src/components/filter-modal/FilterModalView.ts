/**
 * RFC-0125: FilterModal View
 * Renders the 3-column filter modal DOM structure
 */

import type {
  FilterModalParams,
  FilterModalThemeMode,
  FilterModalState,
  FilterableDevice,
  FilterTab,
  AppliedFilters,
} from './types.js';
import { FILTER_GROUPS, FILTER_TAB_ICONS, STATUS_TO_CONNECTIVITY } from './types.js';
import { generateFilterModalStyles } from './styles.js';

export class FilterModalView {
  private containerId: string;
  private widgetName: string;
  private modalClass: string;
  private primaryColor: string;
  private itemIdAttr: string;
  private filterTabs: FilterTab[];
  private themeMode: FilterModalThemeMode;
  private getItemId: (item: FilterableDevice) => string;
  private getItemLabel: (item: FilterableDevice) => string;
  private getItemValue: (item: FilterableDevice) => number;
  private getItemSubLabel: (item: FilterableDevice) => string;
  private formatValue: (val: number) => string;
  private onApply: (filters: AppliedFilters) => void;
  private onClose: () => void;

  private globalContainer: HTMLElement | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;
  private currentItems: FilterableDevice[] = [];

  constructor(params: FilterModalParams) {
    this.containerId = params.containerId;
    this.widgetName = params.widgetName || 'WIDGET';
    this.modalClass = params.modalClass || 'filter-modal';
    this.primaryColor = params.primaryColor || '#2563eb';
    this.itemIdAttr = params.itemIdAttr || 'data-item-id';
    this.filterTabs = params.filterTabs || [];
    this.themeMode = params.themeMode || 'dark';
    this.getItemId = params.getItemId || ((item) => item.id || item.entityId || '');
    this.getItemLabel = params.getItemLabel || ((item) => item.label || item.name || item.labelOrName || item.deviceName || '');
    this.getItemValue = params.getItemValue || ((item) => Number(item.value) || Number(item.val) || 0);
    this.getItemSubLabel = params.getItemSubLabel || (() => '');
    this.formatValue = params.formatValue || ((val) => val.toFixed(2));
    this.onApply = params.onApply || (() => {});
    this.onClose = params.onClose || (() => {});
  }

  private generateFilterTabsHTML(counts: Record<string, number>): string {
    const allTab = this.filterTabs.find((t) => t.id === 'all');
    let html = '';
    if (allTab) {
      const icon = FILTER_TAB_ICONS['all'] || '';
      html += `
        <div class="filter-group filter-group-all">
          <button class="filter-tab active" data-filter="all">
            ${icon} ${allTab.label} (<span id="countAll">${counts['all'] || 0}</span>)
          </button>
        </div>
      `;
    }

    FILTER_GROUPS.forEach((group) => {
      const groupTabs = this.filterTabs.filter((t) => group.filters.includes(t.id));
      if (groupTabs.length === 0) return;
      html += `
        <div class="filter-group">
          <span class="filter-group-label">${group.label}</span>
          <div class="filter-group-tabs">
            ${groupTabs
              .map((tab) => {
                const icon = FILTER_TAB_ICONS[tab.id] || '';
                const count = counts[tab.id] || 0;
                const expandBtn =
                  count > 0
                    ? `<button class="filter-tab-expand" data-expand-filter="${tab.id}" title="Ver dispositivos">+</button>`
                    : '';
                return `
              <button class="filter-tab active" data-filter="${tab.id}">
                ${icon} ${tab.label} (<span id="count${
                  tab.id.charAt(0).toUpperCase() + tab.id.slice(1)
                }">${count}</span>)${expandBtn}
              </button>
            `;
              })
              .join('')}
          </div>
        </div>
      `;
    });
    return html;
  }

  private generateModalHTML(): string {
    return `
      <div id="filterModal" class="${this.modalClass} hidden">
        <div class="${this.modalClass}-card">
          <div class="${this.modalClass}-header" id="${this.containerId}Header">
            <div class="${this.modalClass}-header__left">
              <span class="${this.modalClass}-header__icon">🔍</span>
              <h3>Filtrar e Ordenar</h3>
            </div>
            <div class="${this.modalClass}-header__actions">
              <button class="${this.modalClass}-header__btn" id="${this.containerId}ThemeToggle" title="Alternar tema">☀️</button>
              <button class="${this.modalClass}-header__btn" id="${this.containerId}Maximize" title="Maximizar">🗖</button>
              <button class="${this.modalClass}-header__btn ${this.modalClass}-header__btn--close" id="closeFilter" title="Fechar">&times;</button>
            </div>
          </div>
          <div class="${this.modalClass}-body">
            <div class="filter-sidebar">
              <div class="filter-tabs" id="filterTabsContainer"></div>
            </div>
            <div class="filter-content">
              <div class="filter-block">
                <div class="filter-search">
                  <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                  <input type="text" id="filterDeviceSearch" placeholder="Buscar...">
                  <button class="clear-x" id="filterDeviceClear">
                    <svg width="14" height="14" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="#6b7a90"/></svg>
                  </button>
                </div>
                <div class="inline-actions" style="margin-bottom: 8px;">
                  <button class="tiny-btn" id="selectAllItems">Selecionar Todos</button>
                  <button class="tiny-btn" id="clearAllItems">Limpar Seleção</button>
                </div>
                <div class="checklist" id="deviceChecklist"></div>
              </div>
            </div>
            <div class="filter-sortbar">
              <div class="filter-block">
                <span class="block-label">Ordenar por</span>
                <div class="radio-grid">
                  <label><input type="radio" name="sortMode" value="cons_desc" checked> Maior consumo</label>
                  <label><input type="radio" name="sortMode" value="cons_asc"> Menor consumo</label>
                  <label><input type="radio" name="sortMode" value="alpha_asc"> Nome A → Z</label>
                  <label><input type="radio" name="sortMode" value="alpha_desc"> Nome Z → A</label>
                  <label><input type="radio" name="sortMode" value="status_asc"> Status A → Z</label>
                  <label><input type="radio" name="sortMode" value="status_desc"> Status Z → A</label>
                  <label><input type="radio" name="sortMode" value="shopping_asc"> Shopping A → Z</label>
                  <label><input type="radio" name="sortMode" value="shopping_desc"> Shopping Z → A</label>
                </div>
              </div>
            </div>
          </div>
          <div class="${this.modalClass}-footer">
            <button class="btn" id="resetFilters">Fechar</button>
            <button class="btn primary" id="applyFilters">Aplicar</button>
          </div>
        </div>
      </div>
    `;
  }

  private calculateCounts(items: FilterableDevice[]): Record<string, number> {
    const counts: Record<string, number> = {};
    this.filterTabs.forEach((tab) => {
      counts[tab.id] = items.filter(tab.filter).length;
    });
    return counts;
  }

  private populateChecklist(modal: HTMLElement, items: FilterableDevice[], selectedIds?: Set<string>): void {
    const checklist = modal.querySelector('#deviceChecklist');
    if (!checklist) return;
    checklist.innerHTML = '';

    // Use global filter if available
    const globalSelection = (window as unknown as Record<string, unknown>).custumersSelected as Array<{ value: string }> | undefined;
    const isFiltered = globalSelection && globalSelection.length > 0;
    let itemsProcessing = items.slice();
    if (isFiltered && globalSelection) {
      const allowedShoppingIds = globalSelection.map((c) => c.value);
      itemsProcessing = itemsProcessing.filter(
        (item) => item.customerId && allowedShoppingIds.includes(item.customerId)
      );
    }

    const sortedItems = itemsProcessing.sort((a, b) =>
      (this.getItemLabel(a) || '').localeCompare(this.getItemLabel(b) || '', 'pt-BR', { sensitivity: 'base' })
    );

    if (sortedItems.length === 0) {
      checklist.innerHTML =
        '<div style="padding:10px; color:#666; font-size:12px; text-align:center;">Nenhum dispositivo encontrado.</div>';
      return;
    }

    sortedItems.forEach((item) => {
      const itemId = this.getItemId(item);
      const isChecked = !selectedIds || selectedIds.has(String(itemId));
      const subLabel = this.getItemSubLabel(item);
      const value = this.getItemValue(item);
      const formattedValue = this.formatValue(value);
      const customerName = item.customerName || item.ownerName || '';

      const div = document.createElement('div');
      div.className = 'check-item';
      div.innerHTML = `
        <input type="checkbox" id="check-${itemId}" ${isChecked ? 'checked' : ''} ${this.itemIdAttr}="${itemId}">
        <label for="check-${itemId}" style="flex: 1;">${this.getItemLabel(item)}</label>
        ${
          customerName
            ? `<span class="customer-name" style="color: #0ea5e9; font-size: 10px; margin-right: 8px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${customerName}">${customerName}</span>`
            : ''
        }
        ${
          subLabel
            ? `<span style="color: #64748b; font-size: 11px; margin-right: 8px;">${subLabel}</span>`
            : ''
        }
        <span style="color: ${
          value > 0 ? '#16a34a' : '#94a3b8'
        }; font-size: 11px; font-weight: 600; min-width: 70px; text-align: right;">${formattedValue}</span>
      `;
      checklist.appendChild(div);
    });
  }

  private setupHandlers(modal: HTMLElement, items: FilterableDevice[]): void {
    const closeBtn = modal.querySelector('#closeFilter');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // Theme toggle button
    let modalTheme = this.themeMode;
    const themeToggleBtn = modal.querySelector(`#${this.containerId}ThemeToggle`);
    const headerEl = modal.querySelector(`#${this.containerId}Header`);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = modalTheme === 'dark' ? '☀️' : '🌙';
      themeToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modalTheme = modalTheme === 'dark' ? 'light' : 'dark';
        themeToggleBtn.textContent = modalTheme === 'dark' ? '☀️' : '🌙';
        if (headerEl) {
          headerEl.classList.toggle(`${this.modalClass}-header--light`, modalTheme === 'light');
        }
        if (this.globalContainer) {
          this.globalContainer.setAttribute('data-theme', modalTheme);
        }
      });
    }

    // Maximize button
    let isMaximized = false;
    const maximizeBtn = modal.querySelector(`#${this.containerId}Maximize`);
    const cardEl = modal.querySelector(`.${this.modalClass}-card`);
    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMaximized = !isMaximized;
        maximizeBtn.textContent = isMaximized ? '🗗' : '🗖';
        (maximizeBtn as HTMLElement).title = isMaximized ? 'Restaurar' : 'Maximizar';
        if (cardEl) {
          cardEl.classList.toggle('maximized', isMaximized);
        }
      });
    }

    // Apply button
    const applyBtn = modal.querySelector('#applyFilters');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const checkboxes = modal.querySelectorAll(`#deviceChecklist input[type='checkbox']:checked`);
        const selectedSet = new Set<string>();
        checkboxes.forEach((cb) => {
          const itemId = cb.getAttribute(this.itemIdAttr);
          if (itemId) selectedSet.add(itemId);
        });
        const sortRadio = modal.querySelector('input[name="sortMode"]:checked') as HTMLInputElement;
        const sortMode = sortRadio ? sortRadio.value : 'cons_desc';
        this.onApply({
          selectedIds: selectedSet.size === items.length ? null : selectedSet,
          sortMode: sortMode as AppliedFilters['sortMode'],
        });
        this.close();
      });
    }

    // Reset/Close button
    const resetBtn = modal.querySelector('#resetFilters');
    if (resetBtn) resetBtn.addEventListener('click', () => this.close());

    // Select all button
    const selectAllBtn = modal.querySelector('#selectAllItems');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        modal
          .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
          .forEach((cb) => ((cb as HTMLInputElement).checked = true));
      });
    }

    // Clear all button
    const clearAllBtn = modal.querySelector('#clearAllItems');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        modal
          .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
          .forEach((cb) => ((cb as HTMLInputElement).checked = false));
      });
    }

    // Search input
    const searchInput = modal.querySelector('#filterDeviceSearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = ((e.target as HTMLInputElement).value || '').trim().toLowerCase();
        modal.querySelectorAll('#deviceChecklist .check-item').forEach((item) => {
          const label = item.querySelector('label');
          const text = (label?.textContent || '').toLowerCase();
          (item as HTMLElement).style.display = text.includes(query) ? 'flex' : 'none';
        });
      });
    }

    // Clear search button
    const clearBtn = modal.querySelector('#filterDeviceClear');
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        modal
          .querySelectorAll('#deviceChecklist .check-item')
          .forEach((item) => ((item as HTMLElement).style.display = 'flex'));
        searchInput.focus();
      });
    }

    // ESC key handler
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) this.close();
    };
    document.addEventListener('keydown', this.escHandler);
  }

  private bindFilterTabHandlers(modal: HTMLElement, items: FilterableDevice[]): void {
    const filterTabsEl = modal.querySelectorAll('.filter-tab');

    const getFilterFn = (filterId: string) => {
      const tabConfig = this.filterTabs.find((t) => t.id === filterId);
      return tabConfig ? tabConfig.filter : () => false;
    };

    const applyActiveFilters = () => {
      const itemPassesGroup = (item: FilterableDevice, groupActiveFilters: string[]) => {
        if (groupActiveFilters.length === 0) return true;
        return groupActiveFilters.some((filterId) => getFilterFn(filterId)(item));
      };

      let filteredItems = [...items];
      for (let i = 0; i < FILTER_GROUPS.length; i++) {
        const group = FILTER_GROUPS[i];
        const activeInGroup = Array.from(filterTabsEl)
          .filter(
            (t) => group.filters.includes(t.getAttribute('data-filter') || '') && t.classList.contains('active')
          )
          .map((t) => t.getAttribute('data-filter') || '');
        if (activeInGroup.length > 0) {
          filteredItems = filteredItems.filter((item) => itemPassesGroup(item, activeInGroup));
        }
        for (let j = i + 1; j < FILTER_GROUPS.length; j++) {
          const nextGroup = FILTER_GROUPS[j];
          nextGroup.filters.forEach((filterId) => {
            const tab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === filterId);
            if (!tab) return;
            const filterFn = getFilterFn(filterId);
            const hasMatchingItems = filteredItems.some((item) => filterFn(item));
            if (!hasMatchingItems && tab.classList.contains('active')) tab.classList.remove('active');
          });
        }
      }

      const activeFilters = Array.from(filterTabsEl)
        .filter((t) => t.classList.contains('active') && t.getAttribute('data-filter') !== 'all')
        .map((t) => t.getAttribute('data-filter') || '');

      const activeByGroup: Record<string, string[]> = {};
      FILTER_GROUPS.forEach((group) => {
        const activeInGroup = activeFilters.filter((id) => group.filters.includes(id));
        if (activeInGroup.length > 0) activeByGroup[group.id] = activeInGroup;
      });

      const checkboxes = modal.querySelectorAll(`#deviceChecklist input[type='checkbox']`);
      checkboxes.forEach((cb) => {
        const itemId = cb.getAttribute(this.itemIdAttr);
        const item = items.find((i) => String(this.getItemId(i)) === String(itemId));
        if (!item) return;
        if (activeFilters.length === 0) {
          (cb as HTMLInputElement).checked = true;
        } else {
          (cb as HTMLInputElement).checked = Object.entries(activeByGroup).every(([_groupName, groupFilterIds]) => {
            return groupFilterIds.some((filterId) => getFilterFn(filterId)(item));
          });
        }
      });
    };

    const getFilteredItems = () => {
      let filteredItems = [...items];
      FILTER_GROUPS.forEach((group) => {
        const activeInGroup = Array.from(filterTabsEl)
          .filter(
            (t) => group.filters.includes(t.getAttribute('data-filter') || '') && t.classList.contains('active')
          )
          .map((t) => t.getAttribute('data-filter') || '');
        if (activeInGroup.length > 0) {
          filteredItems = filteredItems.filter((item) =>
            activeInGroup.some((filterId) => getFilterFn(filterId)(item))
          );
        }
      });
      return filteredItems;
    };

    const updateFilterCounts = (filteredItems: FilterableDevice[]) => {
      this.filterTabs.forEach((tabConfig) => {
        if (tabConfig.id === 'all') {
          const countEl = modal.querySelector('#countAll');
          if (countEl) countEl.textContent = String(filteredItems.length);
        } else {
          const count = filteredItems.filter(tabConfig.filter).length;
          const countEl = modal.querySelector(
            `#count${tabConfig.id.charAt(0).toUpperCase() + tabConfig.id.slice(1)}`
          );
          if (countEl) countEl.textContent = String(count);
        }
      });
    };

    const syncTodosButton = () => {
      const allTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === 'all');
      const otherTabs = Array.from(filterTabsEl).filter((t) => t.getAttribute('data-filter') !== 'all');
      const allOthersActive = otherTabs.every((t) => t.classList.contains('active'));
      if (allTab) allTab.classList.toggle('active', allOthersActive);
    };

    filterTabsEl.forEach((tab) => {
      tab.addEventListener('click', () => {
        const filterType = tab.getAttribute('data-filter');
        const otherTabs = Array.from(filterTabsEl).filter((t) => t.getAttribute('data-filter') !== 'all');
        const allTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === 'all');

        if (filterType === 'all') {
          const allOthersActive = otherTabs.every((t) => t.classList.contains('active'));
          if (allOthersActive) {
            otherTabs.forEach((t) => t.classList.remove('active'));
            if (allTab) allTab.classList.remove('active');
            modal
              .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
              .forEach((cb) => ((cb as HTMLInputElement).checked = false));
          } else {
            otherTabs.forEach((t) => t.classList.add('active'));
            if (allTab) allTab.classList.add('active');
            modal
              .querySelectorAll(`#deviceChecklist input[type='checkbox']`)
              .forEach((cb) => ((cb as HTMLInputElement).checked = true));
          }
          return;
        }

        tab.classList.toggle('active');
        const isNowActive = tab.classList.contains('active');

        if (isNowActive && filterType) {
          const impliedConnectivity = STATUS_TO_CONNECTIVITY[filterType];
          if (impliedConnectivity) {
            const connectivityTab = Array.from(filterTabsEl).find(
              (t) => t.getAttribute('data-filter') === impliedConnectivity
            );
            if (connectivityTab && !connectivityTab.classList.contains('active'))
              connectivityTab.classList.add('active');
          }
          const filteredItems = getFilteredItems();
          const typeIds = ['elevators', 'escalators', 'hvac', 'others', 'commonArea', 'stores'];
          typeIds.forEach((typeId) => {
            const typeTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === typeId);
            if (!typeTab) return;
            const typeFilterFn = getFilterFn(typeId);
            const hasItems = filteredItems.some((item) => typeFilterFn(item));
            if (hasItems && !typeTab.classList.contains('active')) typeTab.classList.add('active');
          });
          const consumptionIds = ['withConsumption', 'noConsumption'];
          consumptionIds.forEach((consId) => {
            const consTab = Array.from(filterTabsEl).find((t) => t.getAttribute('data-filter') === consId);
            if (!consTab) return;
            const consFilterFn = getFilterFn(consId);
            const hasItems = filteredItems.some((item) => consFilterFn(item));
            if (hasItems && !consTab.classList.contains('active')) consTab.classList.add('active');
          });
        }

        applyActiveFilters();
        const filteredItems = getFilteredItems();
        updateFilterCounts(filteredItems);
        syncTodosButton();
      });
    });

    this.setupExpandButtonListeners(modal, items);
  }

  private setupExpandButtonListeners(modal: HTMLElement, items: FilterableDevice[]): void {
    const expandBtns = modal.querySelectorAll('.filter-tab-expand');

    expandBtns.forEach((btn) => {
      const filterId = btn.getAttribute('data-expand-filter');
      if (!filterId) return;

      const filterTabConfig = this.filterTabs.find((t) => t.id === filterId);
      const filterFn = filterTabConfig?.filter || (() => false);

      btn.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        const matchingDevices = items.filter(filterFn);
        this.showDeviceTooltip(btn as HTMLElement, filterId, matchingDevices);
      });

      btn.addEventListener('mouseleave', (e) => {
        e.stopPropagation();
        this.hideDeviceTooltip();
      });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const matchingDevices = items.filter(filterFn);
        this.showDeviceTooltip(btn as HTMLElement, filterId, matchingDevices);
      });
    });
  }

  private showDeviceTooltip(triggerEl: HTMLElement, filterId: string, devices: FilterableDevice[]): void {
    const InfoTooltip = (window as unknown as Record<string, unknown>).MyIOLibrary as { InfoTooltip?: { show: (el: HTMLElement, opts: Record<string, unknown>) => void } } | undefined;

    if (!InfoTooltip?.InfoTooltip) return;

    const filterTabConfig = this.filterTabs.find((t) => t.id === filterId);
    const label = filterTabConfig?.label || filterId;
    const icon = FILTER_TAB_ICONS[filterId] || '📋';

    let devicesHtml = '';
    if (devices.length === 0) {
      devicesHtml = `
        <div class="myio-info-tooltip__section">
          <div style="text-align: center; padding: 16px 0; color: #94a3b8; font-style: italic;">
            Nenhum dispositivo
          </div>
        </div>
      `;
    } else {
      const dotColors: Record<string, string> = {
        online: '#22c55e',
        offline: '#6b7280',
        notInstalled: '#92400e',
        normal: '#3b82f6',
        standby: '#22c55e',
        alert: '#f59e0b',
        failure: '#ef4444',
        elevators: '#7c3aed',
        escalators: '#db2777',
        hvac: '#0891b2',
        others: '#57534e',
        commonArea: '#0284c7',
        stores: '#9333ea',
      };
      const dotColor = dotColors[filterId] || '#94a3b8';

      const deviceItems = devices
        .slice(0, 50)
        .map((device) => {
          const deviceLabel = this.getItemLabel(device) || 'Sem nome';
          const customerName = this.getItemSubLabel ? this.getItemSubLabel(device) : '';
          const displayLabel = customerName ? `${deviceLabel} (${customerName})` : deviceLabel;
          return `
          <div class="myio-info-tooltip__row" style="padding: 6px 0; gap: 8px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0;"></span>
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px;" title="${displayLabel}">${displayLabel}</span>
          </div>
        `;
        })
        .join('');

      const moreText =
        devices.length > 50
          ? `<div style="font-style: italic; color: #94a3b8; font-size: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0; margin-top: 8px;">... e mais ${
              devices.length - 50
            } dispositivos</div>`
          : '';

      devicesHtml = `
        <div class="myio-info-tooltip__section">
          <div class="myio-info-tooltip__section-title">
            Dispositivos (${devices.length})
          </div>
          <div style="max-height: 280px; overflow-y: auto;">
            ${deviceItems}
            ${moreText}
          </div>
        </div>
      `;
    }

    InfoTooltip.InfoTooltip.show(triggerEl, {
      icon: icon,
      title: `${label} (${devices.length})`,
      content: devicesHtml,
    });
  }

  private hideDeviceTooltip(): void {
    const InfoTooltip = (window as unknown as Record<string, unknown>).MyIOLibrary as { InfoTooltip?: { startDelayedHide: () => void } } | undefined;
    if (InfoTooltip?.InfoTooltip) {
      InfoTooltip.InfoTooltip.startDelayedHide();
    }
  }

  public open(items: FilterableDevice[], state: FilterModalState = {}): void {
    if (!items || items.length === 0) {
      window.alert('Nenhum item encontrado. Por favor, aguarde o carregamento dos dados.');
      return;
    }

    this.currentItems = items;

    if (!this.globalContainer) {
      this.globalContainer = document.getElementById(this.containerId);
      if (!this.globalContainer) {
        this.globalContainer = document.createElement('div');
        this.globalContainer.id = this.containerId;
        this.globalContainer.innerHTML = `<style>${generateFilterModalStyles(this.containerId, this.modalClass, this.primaryColor)}</style>${this.generateModalHTML()}`;
        document.body.appendChild(this.globalContainer);
        const modal = this.globalContainer.querySelector('#filterModal') as HTMLElement;
        if (modal) this.setupHandlers(modal, items);
      }
    }

    this.globalContainer.setAttribute('data-theme', this.themeMode);

    const modal = this.globalContainer.querySelector('#filterModal') as HTMLElement;
    if (!modal) return;

    const counts = this.calculateCounts(items);
    const tabsContainer = modal.querySelector('#filterTabsContainer');
    if (tabsContainer) {
      tabsContainer.innerHTML = this.generateFilterTabsHTML(counts);
      this.bindFilterTabHandlers(modal, items);
    }

    this.populateChecklist(modal, items, state.selectedIds);

    const sortRadio = modal.querySelector(
      `input[name="sortMode"][value="${state.sortMode || 'cons_desc'}"]`
    ) as HTMLInputElement;
    if (sortRadio) sortRadio.checked = true;

    modal.classList.remove('hidden');
    document.body.classList.add('filter-modal-open');
  }

  public close(): void {
    if (this.globalContainer) {
      const modal = this.globalContainer.querySelector('#filterModal');
      if (modal) modal.classList.add('hidden');
    }
    document.body.classList.remove('filter-modal-open');
    this.onClose();
  }

  public setThemeMode(mode: FilterModalThemeMode): void {
    if (this.themeMode === mode) return;
    this.themeMode = mode;
    if (this.globalContainer) {
      this.globalContainer.setAttribute('data-theme', mode);
    }
  }

  public destroy(): void {
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }
    if (this.globalContainer) {
      this.globalContainer.remove();
      this.globalContainer = null;
    }
    document.body.classList.remove('filter-modal-open');
  }
}
