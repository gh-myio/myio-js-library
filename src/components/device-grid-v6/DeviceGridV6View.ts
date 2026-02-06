/**
 * DeviceGridV6 View
 * DOM rendering, events, card instances
 */

import type { CardGridItem, CardGridCustomStyle, SortMode, DeviceGridV6Params } from './types';
import { DeviceGridV6Controller } from './DeviceGridV6Controller';
import { injectStyles } from './styles';
import { renderCardComponentV6 } from '../template-card-v6/template-card-v6.js';

// jQuery-like card result from renderCardComponentV6
interface CardInstance {
  [0]?: HTMLElement;
  destroy?: () => void;
}

export class DeviceGridV6View {
  private root: HTMLElement;
  private controller: DeviceGridV6Controller;
  private params: DeviceGridV6Params;
  private debugActive: boolean;

  // DOM references
  private gridEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;
  private searchWrapEl: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  private sortSelectEl: HTMLSelectElement | null = null;

  // Card instances for cleanup
  private cardInstances: Map<string, CardInstance> = new Map();

  constructor(params: DeviceGridV6Params, controller: DeviceGridV6Controller) {
    this.params = params;
    this.controller = controller;
    this.debugActive = params.debugActive || false;
    this.root = document.createElement('div');
    this.root.className = 'myio-dgv6';
  }

  private log(...args: unknown[]): void {
    if (this.debugActive) {
      console.log('[DeviceGridV6View]', ...args);
    }
  }

  // =========================================================================
  // Render
  // =========================================================================

  render(): HTMLElement {
    injectStyles();
    this.root.innerHTML = this.buildHTML();
    this.cacheElements();
    this.bindEvents();
    this.renderCards();
    this.updateStats();
    return this.root;
  }

  getElement(): HTMLElement {
    return this.root;
  }

  // =========================================================================
  // Public mutations
  // =========================================================================

  setTitle(title: string): void {
    if (this.titleEl) this.titleEl.textContent = title;
  }

  refresh(): void {
    this.renderCards();
    this.updateStats();
  }

  setSearchTerm(term: string): void {
    if (this.searchInputEl) {
      this.searchInputEl.value = term;
    }
    // Show search bar if term provided
    if (term && this.searchWrapEl) {
      this.searchWrapEl.classList.add('active');
    }
  }

  setSortMode(mode: SortMode): void {
    if (this.sortSelectEl) {
      this.sortSelectEl.value = mode;
    }
  }

  destroy(): void {
    this.destroyCardInstances();
    this.root.remove();
  }

  // =========================================================================
  // Build HTML
  // =========================================================================

  private buildHTML(): string {
    const title = this.params.title || 'Dispositivos';

    return `
      <div class="myio-dgv6__header">
        <div class="myio-dgv6__header-left">
          <h3 class="myio-dgv6__title">${title}</h3>
          <span class="myio-dgv6__count">(0)</span>
        </div>
        <div class="myio-dgv6__header-actions">
          <div class="myio-dgv6__search-wrap">
            <input type="text" class="myio-dgv6__search-input" placeholder="Buscar..." autocomplete="off" />
          </div>
          <button class="myio-dgv6__icon-btn myio-dgv6__btn-search" title="Buscar" aria-label="Buscar">
            <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5z"/></svg>
          </button>
          <select class="myio-dgv6__sort-select" title="Ordenar" aria-label="Ordenar">
            <option value="alpha_asc">A → Z</option>
            <option value="alpha_desc">Z → A</option>
            <option value="status_online">Online</option>
            <option value="status_offline">Offline</option>
          </select>
        </div>
      </div>
      <div class="myio-dgv6__grid"></div>
    `;
  }

  // =========================================================================
  // Cache & Bind
  // =========================================================================

  private cacheElements(): void {
    this.titleEl = this.root.querySelector('.myio-dgv6__title');
    this.countEl = this.root.querySelector('.myio-dgv6__count');
    this.gridEl = this.root.querySelector('.myio-dgv6__grid');
    this.searchWrapEl = this.root.querySelector('.myio-dgv6__search-wrap');
    this.searchInputEl = this.root.querySelector('.myio-dgv6__search-input');
    this.sortSelectEl = this.root.querySelector('.myio-dgv6__sort-select');

    // Apply gridMinCardWidth
    if (this.gridEl && this.params.gridMinCardWidth) {
      this.gridEl.style.setProperty('--dgv6-min-card-w', this.params.gridMinCardWidth);
    }
  }

  private bindEvents(): void {
    // Search toggle
    const btnSearch = this.root.querySelector('.myio-dgv6__btn-search');
    if (btnSearch) {
      btnSearch.addEventListener('click', () => this.toggleSearch());
    }

    // Search input
    if (this.searchInputEl) {
      this.searchInputEl.addEventListener('input', () => {
        const term = this.searchInputEl?.value || '';
        this.controller.setSearchTerm(term);
        this.renderCards();
        this.updateStats();
      });
    }

    // Sort select
    if (this.sortSelectEl) {
      this.sortSelectEl.addEventListener('change', () => {
        const mode = (this.sortSelectEl?.value || 'alpha_asc') as SortMode;
        this.controller.setSortMode(mode);
        this.renderCards();
        this.updateStats();
      });
    }
  }

  private toggleSearch(): void {
    if (!this.searchWrapEl) return;
    const isActive = this.searchWrapEl.classList.toggle('active');
    if (isActive && this.searchInputEl) {
      this.searchInputEl.focus();
    } else if (!isActive && this.searchInputEl) {
      // Clear search when closing
      this.searchInputEl.value = '';
      this.controller.setSearchTerm('');
      this.renderCards();
      this.updateStats();
    }
  }

  // =========================================================================
  // Cards
  // =========================================================================

  private renderCards(): void {
    if (!this.gridEl) return;

    // Cleanup previous card instances
    this.destroyCardInstances();
    this.gridEl.innerHTML = '';

    const items = this.controller.getFilteredItems();

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'myio-dgv6__empty';
      empty.innerHTML = `
        <span class="myio-dgv6__empty-icon">&#128268;</span>
        <span class="myio-dgv6__empty-text">${this.params.emptyMessage || 'Nenhum dispositivo'}</span>
      `;
      this.gridEl.appendChild(empty);
      return;
    }

    const { cardCustomStyle, handleClickCard, showTempRangeTooltip } = this.params;

    items.forEach((item) => {
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
      }) as CardInstance | null;

      if (cardResult && cardResult[0]) {
        const wrapper = document.createElement('div');
        wrapper.className = 'myio-dgv6__card-wrapper';
        wrapper.dataset.deviceId = item.id;
        wrapper.appendChild(cardResult[0]);
        this.gridEl!.appendChild(wrapper);
        this.cardInstances.set(item.id, cardResult);
      }
    });
  }

  private destroyCardInstances(): void {
    this.cardInstances.forEach((instance) => {
      if (instance.destroy) {
        try { instance.destroy(); } catch (_) { /* ignore */ }
      }
    });
    this.cardInstances.clear();
  }

  // =========================================================================
  // Stats
  // =========================================================================

  private updateStats(): void {
    const stats = this.controller.getStats();

    if (this.countEl) {
      this.countEl.textContent =
        stats.total === stats.filtered
          ? `(${stats.total})`
          : `(${stats.filtered}/${stats.total})`;
    }
  }
}
