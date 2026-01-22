/**
 * RFC-0145: TelemetryGridShopping View
 * Handles DOM rendering and user interaction
 */

import {
  TelemetryDevice,
  TelemetryDomain,
  TelemetryContext,
  ThemeMode,
  SortMode,
  TelemetryGridShoppingParams,
  DOMAIN_CONFIG,
  CONTEXT_CONFIG,
  CardAction,
} from './types';
import { TelemetryGridShoppingController } from './TelemetryGridShoppingController';
import { injectStyles } from './styles';

// Type for MyIOLibrary card component (jQuery-like object)
interface CardInstance {
  [0]?: HTMLElement;
  update?: (entity: TelemetryDevice) => void;
  destroy?: () => void;
}

export class TelemetryGridShoppingView {
  private root: HTMLElement;
  private controller: TelemetryGridShoppingController;
  private params: TelemetryGridShoppingParams;
  private debugActive: boolean;

  // DOM references
  private shopsListEl: HTMLElement | null = null;
  private shopsCountEl: HTMLElement | null = null;
  private shopsTotalEl: HTMLElement | null = null;
  private searchWrapEl: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  private filterModalEl: HTMLElement | null = null;
  private loadingOverlayEl: HTMLElement | null = null;
  private maximizeBtnEl: HTMLElement | null = null;

  // Card instances for cleanup
  private cardInstances: Map<string, CardInstance> = new Map();
  private isMaximized = false;
  private originalParent: HTMLElement | null = null;
  private originalNextSibling: Node | null = null;

  constructor(params: TelemetryGridShoppingParams, controller: TelemetryGridShoppingController) {
    this.params = params;
    this.controller = controller;
    this.debugActive = params.debugActive || false;
    this.root = this.createRoot();
  }

  private log(...args: unknown[]): void {
    if (this.debugActive) {
      console.log('[TelemetryGridShoppingView]', ...args);
    }
  }

  // =========================================================================
  // Render
  // =========================================================================

  render(): HTMLElement {
    injectStyles(this.root);
    this.root.innerHTML = this.buildHTML();
    this.cacheElements();
    this.bindEvents();
    this.renderCards();
    this.updateStats();
    this.renderMaximizeButton();

    // Move filter modal to body to escape stacking context issues
    if (this.filterModalEl) {
      document.body.appendChild(this.filterModalEl);
    }

    return this.root;
  }

  private createRoot(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'shops-root';
    root.setAttribute('data-theme', this.params.themeMode || 'light');
    root.setAttribute('data-domain', this.params.domain);
    root.setAttribute('data-context', this.params.context);
    return root;
  }

  private buildHTML(): string {
    const labelWidget =
      this.params.labelWidget || CONTEXT_CONFIG[this.params.context]?.headerLabel || 'Dispositivos';

    return `
      <!-- Header -->
      <header class="shops-header">
        <div class="shops-header-left">
          <h2 class="shops-title" id="labelWidgetId">${labelWidget}</h2>
          <span class="shops-count" id="shopsCount">(0)</span>
        </div>

        <div class="shops-header-actions">
          <div class="search-wrap" id="searchWrap">
            <input type="text" id="shopsSearch" placeholder="Buscar..." autocomplete="off" />
          </div>

          <button class="icon-btn" id="btnSearch" title="Buscar" aria-label="Buscar">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5z"/>
            </svg>
          </button>

          <button class="icon-btn" id="btnFilter" title="Filtros" aria-label="Filtros">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/>
            </svg>
          </button>

          <a class="shops-total" id="shopsTotal">0,00</a>
        </div>
      </header>

      <!-- Cards List -->
      <section id="shopsList" class="shops-list"></section>

      <!-- Loading Overlay -->
      <div class="loading-overlay hidden" id="loadingOverlay">
        <div class="loading-spinner"></div>
        <div class="loading-text" id="loadingText">Carregando...</div>
      </div>

      <!-- Filter Modal -->
      ${this.buildFilterModalHTML()}
    `;
  }

  private buildFilterModalHTML(): string {
    return `
      <div id="filterModal" class="shops-modal hidden" role="dialog" aria-modal="true" aria-labelledby="filterTitle">
        <div class="shops-modal-card">
          <header class="shops-modal-header">
            <h3 id="filterTitle">Filtros & Ordenação</h3>
            <button class="icon-btn" id="closeFilter" aria-label="Fechar">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z"/>
              </svg>
            </button>
          </header>

          <section class="shops-modal-body">
            <div class="filter-block">
              <label class="block-label">Selecionar Dispositivos</label>
              <div class="inline-actions">
                <button id="selectAll" class="tiny-btn">Selecionar todos</button>
                <button id="clearAll" class="tiny-btn">Limpar</button>
              </div>

              <div class="filter-search">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5z"/>
                </svg>
                <input id="filterDeviceSearch" type="text" placeholder="Buscar dispositivos..." autocomplete="off" />
                <button class="clear-x" id="filterDeviceClear" title="Limpar" aria-label="Limpar">
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z"/>
                  </svg>
                </button>
              </div>
              <div id="deviceChecklist" class="checklist" role="listbox" aria-multiselectable="true"></div>
            </div>

            <div class="filter-block">
              <label class="block-label">Ordenação</label>
              <div class="radio-grid">
                <label><input type="radio" name="sortMode" value="cons_desc" checked /> Consumo ↓ (padrão)</label>
                <label><input type="radio" name="sortMode" value="cons_asc" /> Consumo ↑</label>
                <label><input type="radio" name="sortMode" value="alpha_asc" /> A → Z</label>
                <label><input type="radio" name="sortMode" value="alpha_desc" /> Z → A</label>
              </div>
              <p class="muted">Caso o consumo seja o mesmo, é considerada a ordem alfabética.</p>
            </div>
          </section>

          <footer class="shops-modal-footer">
            <button id="applyFilters" class="btn primary">Aplicar</button>
            <button id="resetFilters" class="btn">Resetar</button>
          </footer>
        </div>
      </div>
    `;
  }

  private cacheElements(): void {
    this.shopsListEl = this.root.querySelector('#shopsList');
    this.shopsCountEl = this.root.querySelector('#shopsCount');
    this.shopsTotalEl = this.root.querySelector('#shopsTotal');
    this.searchWrapEl = this.root.querySelector('#searchWrap');
    this.searchInputEl = this.root.querySelector('#shopsSearch');
    this.filterModalEl = this.root.querySelector('#filterModal');
    this.loadingOverlayEl = this.root.querySelector('#loadingOverlay');
    this.maximizeBtnEl = this.root.querySelector('.maximize-btn');
  }

  private bindEvents(): void {
    this.root.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.root.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

    // Listen for global theme changes
    window.addEventListener('myio:theme-change', ((e: CustomEvent<{ mode: 'light' | 'dark' }>) => {
      this.applyThemeMode(e.detail.mode);
    }) as EventListener);

    // Search toggle
    const btnSearch = this.root.querySelector('#btnSearch');
    btnSearch?.addEventListener('click', () => this.toggleSearch());

    // Search input
    this.searchInputEl?.addEventListener('input', (e) => {
      const term = (e.target as HTMLInputElement).value;
      this.controller.setSearchTerm(term);
      this.renderCards();
      this.updateStats();
    });

    // Filter button (this is in root)
    const btnFilter = this.root.querySelector('#btnFilter');
    btnFilter?.addEventListener('click', () => this.openFilterModal());

    // Bind filter modal events after it's cached but before moving to body
    this.bindFilterModalEvents();
  }

  /**
   * Bind events for the filter modal (called before modal is moved to body)
   */
  private bindFilterModalEvents(): void {
    if (!this.filterModalEl) return;

    // Filter modal close
    const closeFilter = this.filterModalEl.querySelector('#closeFilter');
    closeFilter?.addEventListener('click', () => this.closeFilterModal());

    // Filter modal backdrop
    this.filterModalEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('shops-modal')) {
        this.closeFilterModal();
      }
    });

    // Select all / Clear all
    const selectAll = this.filterModalEl.querySelector('#selectAll');
    selectAll?.addEventListener('click', () => this.selectAllDevices());

    const clearAll = this.filterModalEl.querySelector('#clearAll');
    clearAll?.addEventListener('click', () => this.clearAllDevices());

    // Filter device search
    const filterDeviceSearch = this.filterModalEl.querySelector('#filterDeviceSearch') as HTMLInputElement;
    filterDeviceSearch?.addEventListener('input', (e) => {
      this.filterDeviceChecklist((e.target as HTMLInputElement).value);
    });

    const filterDeviceClear = this.filterModalEl.querySelector('#filterDeviceClear');
    filterDeviceClear?.addEventListener('click', () => {
      if (filterDeviceSearch) {
        filterDeviceSearch.value = '';
        this.filterDeviceChecklist('');
      }
    });

    // Sort mode
    const sortRadios = this.filterModalEl.querySelectorAll('input[name="sortMode"]');
    sortRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const mode = (e.target as HTMLInputElement).value as SortMode;
        this.controller.setSortMode(mode);
      });
    });

    // Apply filters
    const applyFilters = this.filterModalEl.querySelector('#applyFilters');
    applyFilters?.addEventListener('click', () => {
      this.applySelectedFilters();
      this.closeFilterModal();
      this.renderCards();
      this.updateStats();
    });

    // Reset filters
    const resetFilters = this.filterModalEl.querySelector('#resetFilters');
    resetFilters?.addEventListener('click', () => {
      this.controller.clearFilters();
      this.closeFilterModal();
      this.renderCards();
      this.updateStats();
    });
  }

  // =========================================================================
  // Search
  // =========================================================================

  private toggleSearch(): void {
    this.searchWrapEl?.classList.toggle('active');
    if (this.searchWrapEl?.classList.contains('active')) {
      this.searchInputEl?.focus();
    } else {
      if (this.searchInputEl) {
        this.searchInputEl.value = '';
        this.controller.setSearchTerm('');
        this.renderCards();
        this.updateStats();
      }
    }
  }

  // =========================================================================
  // Filter Modal
  // =========================================================================

  openFilterModal(): void {
    this.log('openFilterModal');
    this.populateDeviceChecklist();
    this.filterModalEl?.classList.remove('hidden');
  }

  closeFilterModal(): void {
    this.log('closeFilterModal');
    this.filterModalEl?.classList.add('hidden');
  }

  private populateDeviceChecklist(): void {
    // Modal is moved to body, so query from filterModalEl instead of root
    const checklist = this.filterModalEl?.querySelector('#deviceChecklist');
    if (!checklist) {
      this.log('deviceChecklist not found in filterModalEl');
      return;
    }

    const devices = this.controller.getDevices();
    this.log('populateDeviceChecklist: found', devices.length, 'devices');
    const filterState = this.controller.getFilterState();
    const selectedIds = new Set(filterState.selectedDeviceIds);

    if (devices.length === 0) {
      checklist.innerHTML = '<div class="empty-checklist">Nenhum dispositivo disponível</div>';
      return;
    }

    checklist.innerHTML = devices
      .map((d) => {
        const isSelected = selectedIds.size === 0 || selectedIds.has(d.entityId);
        return `
          <label class="check-item ${isSelected ? 'selected' : ''}" data-device-id="${d.entityId}">
            <input type="checkbox" ${isSelected ? 'checked' : ''} />
            <span>${d.labelOrName || d.name || d.deviceIdentifier}</span>
          </label>
        `;
      })
      .join('');

    // Bind checkbox events
    checklist.querySelectorAll('.check-item').forEach((item) => {
      const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
      checkbox?.addEventListener('change', () => {
        item.classList.toggle('selected', checkbox.checked);
      });
    });
  }

  private filterDeviceChecklist(term: string): void {
    const checklist = this.filterModalEl?.querySelector('#deviceChecklist');
    if (!checklist) return;

    const items = checklist.querySelectorAll('.check-item');
    const lowerTerm = term.toLowerCase();

    items.forEach((item) => {
      const text = item.querySelector('span')?.textContent?.toLowerCase() || '';
      (item as HTMLElement).style.display = text.includes(lowerTerm) ? '' : 'none';
    });
  }

  private selectAllDevices(): void {
    const checklist = this.filterModalEl?.querySelector('#deviceChecklist');
    checklist?.querySelectorAll('.check-item').forEach((item) => {
      const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox && (item as HTMLElement).style.display !== 'none') {
        checkbox.checked = true;
        item.classList.add('selected');
      }
    });
  }

  private clearAllDevices(): void {
    const checklist = this.filterModalEl?.querySelector('#deviceChecklist');
    checklist?.querySelectorAll('.check-item').forEach((item) => {
      const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = false;
        item.classList.remove('selected');
      }
    });
  }

  private applySelectedFilters(): void {
    const checklist = this.filterModalEl?.querySelector('#deviceChecklist');
    if (!checklist) return;

    const selectedIds: string[] = [];
    checklist.querySelectorAll('.check-item.selected').forEach((item) => {
      const id = (item as HTMLElement).dataset.deviceId;
      if (id) selectedIds.push(id);
    });

    // If all are selected, clear the filter (show all)
    const totalItems = checklist.querySelectorAll('.check-item').length;
    if (selectedIds.length === totalItems) {
      this.controller.setSelectedDeviceIds([]);
    } else {
      this.controller.setSelectedDeviceIds(selectedIds);
    }
  }

  // =========================================================================
  // Card Rendering
  // =========================================================================

  renderCards(): void {
    if (!this.shopsListEl) return;

    const devices = this.controller.getFilteredDevices();
    this.log('renderCards:', devices.length, 'devices');

    // Clear existing cards
    this.destroyCards();
    this.shopsListEl.innerHTML = '';

    if (devices.length === 0) {
      this.shopsListEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-title">Nenhum dispositivo encontrado</div>
          <div class="empty-state-text">Tente ajustar os filtros ou aguarde os dados carregarem.</div>
        </div>
      `;
      return;
    }

    // Check if MyIOLibrary.renderCardComponentV5 is available
    const MyIOLibrary = (
      window as unknown as { MyIOLibrary?: { renderCardComponentV5?: (opts: unknown) => CardInstance } }
    ).MyIOLibrary;

    if (MyIOLibrary?.renderCardComponentV5) {
      devices.forEach((device) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';
        wrapper.dataset.entityId = device.entityId;
        this.shopsListEl!.appendChild(wrapper);

        try {
          const $card = MyIOLibrary.renderCardComponentV5({
            entityObject: device,
            useNewComponents: true,
            enableSelection: this.params.enableSelection ?? true,
            enableDragDrop: this.params.enableDragDrop ?? false,
            showEnergyRangeTooltip: false,
            showPercentageTooltip: false,
            showTempComparisonTooltip: false,
            showTempRangeTooltip: false,
            handleActionDashboard: (entity: TelemetryDevice) => {
              this.params.onCardAction?.('dashboard', entity);
            },
            handleActionReport: (entity: TelemetryDevice) => {
              this.params.onCardAction?.('report', entity);
            },
            handleActionSettings: (entity: TelemetryDevice) => {
              this.params.onCardAction?.('settings', entity);
            },
            handleSelect: (_checked: boolean, _entity: TelemetryDevice) => {
              // Selection handled externally
            },
            handleClickCard: (entity: TelemetryDevice) => {
              this.log('Card clicked:', entity.labelOrName);
            },
          });

          // $card is jQuery-like object, [0] gets the DOM element
          const cardElement = $card?.[0] as HTMLElement | undefined;
          if (cardElement) {
            wrapper.appendChild(cardElement);
            this.cardInstances.set(device.entityId, $card);
          } else {
            this.log('Card element not found for:', device.labelOrName);
            wrapper.innerHTML = this.buildFallbackCard(device);
          }
        } catch (err) {
          this.log('Error rendering card:', device.labelOrName, err);
          wrapper.innerHTML = this.buildFallbackCard(device);
        }
      });
    } else {
      // Fallback: Simple card rendering
      this.log('MyIOLibrary.renderCardComponentV5 not available, using fallback');
      devices.forEach((device) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';
        wrapper.innerHTML = this.buildFallbackCard(device);
        this.shopsListEl!.appendChild(wrapper);
      });
    }
  }

  private buildFallbackCard(device: TelemetryDevice): string {
    const config = DOMAIN_CONFIG[this.controller.getDomain()];
    const value = config.formatValue(device.val);
    const perc = device.perc?.toFixed(1) || '0.0';

    return `
      <div style="
        background: var(--card);
        border: 1px solid var(--bd);
        border-radius: 12px;
        padding: 16px;
        width: 100%;
        box-shadow: var(--shadow);
      ">
        <div style="font-weight: 700; color: var(--ink-1); margin-bottom: 8px;">
          ${device.labelOrName || device.name || device.deviceIdentifier}
        </div>
        <div style="font-size: 20px; font-weight: 800; color: var(--brand);">
          ${value} ${config.unit}
        </div>
        <div style="font-size: 12px; color: var(--ink-2);">
          ${perc}% do total
        </div>
      </div>
    `;
  }

  private destroyCards(): void {
    this.cardInstances.forEach((instance) => {
      instance.destroy?.();
    });
    this.cardInstances.clear();
  }

  // =========================================================================
  // Stats Update
  // =========================================================================

  private updateStats(): void {
    const stats = this.controller.getStats();
    const config = DOMAIN_CONFIG[this.controller.getDomain()];

    if (this.shopsCountEl) {
      this.shopsCountEl.textContent = `(${stats.filteredCount})`;
    }

    if (this.shopsTotalEl) {
      this.shopsTotalEl.textContent = `${config.formatValue(stats.totalConsumption)} ${config.unit}`;
    }
  }

  // =========================================================================
  // Public Methods
  // =========================================================================

  refresh(): void {
    this.renderCards();
    this.updateStats();
  }

  applyThemeMode(mode: ThemeMode): void {
    this.root.setAttribute('data-theme', mode);
  }

  applyDomainTheme(domain: TelemetryDomain): void {
    this.root.setAttribute('data-domain', domain);
  }

  applyContextAttribute(context: TelemetryContext): void {
    this.root.setAttribute('data-context', context);
  }

  updateLabel(label: string): void {
    const labelEl = this.root.querySelector('#labelWidgetId');
    if (labelEl) {
      labelEl.textContent = label;
    }
  }

  showLoading(show: boolean, message?: string): void {
    if (this.loadingOverlayEl) {
      this.loadingOverlayEl.classList.toggle('hidden', !show);
      const textEl = this.loadingOverlayEl.querySelector('#loadingText');
      if (textEl && message) {
        textEl.textContent = message;
      }
    }
  }

  destroy(): void {
    this.log('destroy');
    this.destroyCards();
    // Remove modal from body if it was moved there
    this.filterModalEl?.remove();
    this.root.remove();
  }

  getElement(): HTMLElement {
    return this.root;
  }

  private renderMaximizeButton(): void {
    const maximizeBtnHTML = this.buildMaximizeButtonHTML();
    this.root.insertAdjacentHTML('beforeend', maximizeBtnHTML);
    this.maximizeBtnEl = this.root.querySelector('.maximize-btn');
    this.maximizeBtnEl?.addEventListener('click', this.toggleMaximize.bind(this));
  }

  private buildMaximizeButtonHTML(): string {
    return `
      <button class="maximize-btn" title="Maximizar">
        <svg viewBox="0 0 24 24">
          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
        </svg>
      </button>
    `;
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.isMaximized) return;

    const rect = this.root.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const isNearTopRight = x > rect.width - 100 && y < 100;

    if (isNearTopRight) {
      this.maximizeBtnEl!.style.opacity = '1';
    } else {
      this.maximizeBtnEl!.style.opacity = '0';
    }
  }

  private handleMouseLeave(): void {
    if (this.isMaximized) return;
    this.maximizeBtnEl!.style.opacity = '0';
  }

  private toggleMaximize(): void {
    this.isMaximized = !this.isMaximized;

    if (this.isMaximized) {
      // Save original position
      this.originalParent = this.root.parentElement;
      this.originalNextSibling = this.root.nextSibling;

      // Move to body (like filter modal)
      document.body.appendChild(this.root);
      this.root.classList.add('maximized');

      // Keep button visible when maximized
      if (this.maximizeBtnEl) {
        this.maximizeBtnEl.style.opacity = '1';
      }
    } else {
      // Restore original position
      this.root.classList.remove('maximized');

      if (this.originalParent) {
        if (this.originalNextSibling) {
          this.originalParent.insertBefore(this.root, this.originalNextSibling);
        } else {
          this.originalParent.appendChild(this.root);
        }
      }

      // Reset button opacity
      if (this.maximizeBtnEl) {
        this.maximizeBtnEl.style.opacity = '0';
      }
    }

    // Update icon
    const icon = this.isMaximized
      ? '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>'
      : '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';

    this.maximizeBtnEl!.innerHTML = `<svg viewBox="0 0 24 24">${icon}</svg>`;
  }
}
