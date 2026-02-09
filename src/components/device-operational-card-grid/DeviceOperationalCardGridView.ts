/**
 * RFC-0152 Phase 3: Device Operational Card Grid View
 * Handles rendering for the equipment grid component
 */

import {
  OperationalEquipment,
  ThemeMode,
  DeviceOperationalCardGridParams,
  DeviceOperationalCardGridEventType,
  DeviceOperationalCardGridEventHandler,
  EquipmentAction,
  GRID_SORT_OPTIONS,
  STATUS_CONFIG,
  TYPE_CONFIG,
  DeviceOperationalCardGridStats,
} from './types';
import type { FilterTab, FilterableDevice, SortMode as FilterModalSortMode } from '../filter-modal/types';
import { FilterModalController } from '../filter-modal/FilterModalController';
import { DeviceOperationalCardGridController } from './DeviceOperationalCardGridController';
import { injectDeviceOperationalCardGridStyles } from './styles';
import {
  createOperationalHeaderDevicesGridComponent,
  OperationalHeaderDevicesGridInstance,
} from '../operational-header-devices-grid';

export class DeviceOperationalCardGridView {
  private container: HTMLElement;
  private root: HTMLElement | null = null;
  private params: DeviceOperationalCardGridParams;
  private controller: DeviceOperationalCardGridController;
  private eventHandlers = new Map<DeviceOperationalCardGridEventType, Set<DeviceOperationalCardGridEventHandler>>();

  // Premium header instance
  private headerInstance: OperationalHeaderDevicesGridInstance | null = null;

  // DOM references
  private headerContainer: HTMLElement | null = null;
  private gridContainer: HTMLElement | null = null;
  private loadingState: HTMLElement | null = null;
  private emptyState: HTMLElement | null = null;
  private typeFilter: HTMLSelectElement | null = null;
  private statusFilter: HTMLSelectElement | null = null;
  private sortFilter: HTMLSelectElement | null = null;
  private selectionCleanups: Array<() => void> = [];

  private filterModal: FilterModalController | null = null;
  private filterModalContainerId: string;

  constructor(
    params: DeviceOperationalCardGridParams,
    controller: DeviceOperationalCardGridController
  ) {
    this.container = params.container;
    this.params = params;
    this.controller = controller;
    this.filterModalContainerId = `operational-filter-modal-${Math.random().toString(36).slice(2, 10)}`;

    // Inject styles
    injectDeviceOperationalCardGridStyles();
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  render(): HTMLElement {
    this.root = document.createElement('div');
    this.root.className = 'myio-equipment-grid-root operational-grid-wrap';

    // Apply initial theme
    this.applyThemeMode(this.controller.getThemeMode());

    // Build structure
    this.root.innerHTML = this.buildTemplate();

    // Cache DOM references
    this.cacheReferences();

    // Create premium header
    this.createPremiumHeader();

    // Setup event listeners
    this.setupEventListeners();

    // Mount to container
    this.container.appendChild(this.root);

    // Render initial cards
    this.renderGrid(this.controller.getFilteredEquipment());

    return this.root;
  }

  private createPremiumHeader(): void {
    if (!this.headerContainer) return;

    const includeSearch = this.params.includeSearch !== false;
    const includeFilters = this.params.includeFilters !== false;

    this.headerInstance = createOperationalHeaderDevicesGridComponent({
      container: this.headerContainer,
      themeMode: this.controller.getThemeMode(),
      includeSearch,
      includeFilter: includeFilters,
      includeCustomerFilter: true,
      includeMaximize: true,
      customers: this.params.customers || [],
      onSearchChange: (query) => {
        this.controller.setSearchQuery(query);
        this.emit('search-change', query);
      },
      onFilterClick: () => {
        this.openFilterModal();
        this.emit('filter-click', null);
      },
      onCustomerChange: (customerId) => {
        if (customerId === 'all') {
          this.controller.setCustomerFilter([]);
        } else {
          this.controller.setCustomerFilter([customerId]);
        }
        this.emit('customer-change', customerId);
      },
      onMaximizeClick: (maximized) => {
        this.emit('maximize-change', maximized);
      },
    });

    // Update header stats with initial data
    this.updateStats(this.controller.getStats());
  }

  private buildTemplate(): string {
    const includeFilters = this.params.includeFilters !== false;

    return `
      <!-- Premium Header Container -->
      <div class="myio-equipment-header-container" id="headerContainer"></div>

      <!-- Inline Filters (Type, Status, Sort) -->
      ${includeFilters ? `
        <div class="myio-equipment-inline-filters">
          <select id="typeFilter" class="myio-equipment-filter-select">
            <option value="all">Todos os Tipos</option>
            <option value="escada">Escadas Rolantes</option>
            <option value="elevador">Elevadores</option>
            <option value="other">Outros</option>
          </select>

          <select id="statusFilter" class="myio-equipment-filter-select">
            <option value="all">Todos os Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="maintenance">Manutencao</option>
            <option value="warning">Alerta</option>
          </select>

          <select id="sortFilter" class="myio-equipment-filter-select">
            ${GRID_SORT_OPTIONS.map(opt =>
              `<option value="${opt.id}">${opt.icon} ${opt.label}</option>`
            ).join('')}
          </select>
        </div>
      ` : ''}

      <!-- Equipment Grid -->
      <section class="myio-equipment-grid" id="equipmentGrid">
        <!-- Cards rendered dynamically -->
      </section>

      <!-- Loading State -->
      <div class="myio-equipment-loading" id="loadingState">
        <div class="spinner"></div>
        <p>Carregando equipamentos...</p>
      </div>

      <!-- Empty State -->
      <div class="myio-equipment-empty" id="emptyState">
        <div class="empty-icon">&#x1F4CB;</div>
        <p>Nenhum equipamento encontrado</p>
      </div>
    `;
  }

  private cacheReferences(): void {
    if (!this.root) return;

    this.headerContainer = this.root.querySelector('#headerContainer');
    this.gridContainer = this.root.querySelector('#equipmentGrid');
    this.loadingState = this.root.querySelector('#loadingState');
    this.emptyState = this.root.querySelector('#emptyState');
    this.typeFilter = this.root.querySelector('#typeFilter');
    this.statusFilter = this.root.querySelector('#statusFilter');
    this.sortFilter = this.root.querySelector('#sortFilter');
  }

  private setupEventListeners(): void {
    // Type filter
    this.typeFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.controller.setTypeFilter(target.value as 'all' | 'escada' | 'elevador' | 'other');
      this.emit('filter-change', { type: target.value });
    });

    // Status filter
    this.statusFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.controller.setStatusFilter(target.value as 'all' | 'online' | 'offline' | 'maintenance' | 'warning');
      this.emit('filter-change', { status: target.value });
    });

    // Sort filter
    this.sortFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.controller.setSortMode(target.value as any);
      this.emit('sort-change', target.value);
    });

    // Controller state changes trigger re-render
    this.controller.setOnStateChange((state) => {
      this.renderGrid(state.filteredEquipment);
      this.updateStats(state.stats);
      this.showLoading(state.isLoading);
    });

    // Listen for global theme changes
    window.addEventListener('myio:theme-change', this.handleThemeChange);

    // Listen for customer filter from menu
    window.addEventListener('myio:filter-applied', this.handleFilterApplied);
  }

  private buildFilterTabs(): FilterTab[] {
    return [
      { id: 'all', label: 'Todos', filter: () => true },
      { id: 'online', label: 'Online', filter: (e) => e.deviceStatus === 'online' },
      { id: 'offline', label: 'Offline', filter: (e) => e.deviceStatus === 'offline' },
      { id: 'notInstalled', label: 'N/Instalado', filter: () => false },
      { id: 'maintenance', label: 'Manutenção', filter: (e) => e.deviceStatus === 'maintenance' },
      { id: 'alert', label: 'Alerta', filter: (e) => e.deviceStatus === 'warning' },
      { id: 'failure', label: 'Falha', filter: (e) => e.deviceStatus === 'offline' },
      { id: 'elevators', label: 'Elevadores', filter: (e) => e.deviceType === 'elevador' },
      { id: 'escalators', label: 'Escadas', filter: (e) => e.deviceType === 'escada' },
      { id: 'others', label: 'Outros', filter: (e) => e.deviceType === 'other' },
    ];
  }

  private mapSortModeToFilterModal(sortMode: string): FilterModalSortMode {
    switch (sortMode) {
      case 'availability_desc':
        return 'cons_desc';
      case 'availability_asc':
        return 'cons_asc';
      case 'alpha_asc':
        return 'alpha_asc';
      case 'alpha_desc':
        return 'alpha_desc';
      case 'status_asc':
        return 'status_asc';
      case 'status_desc':
        return 'status_desc';
      case 'alerts_desc':
        return 'cons_desc';
      case 'alerts_asc':
        return 'cons_asc';
      default:
        return 'cons_desc';
    }
  }

  private mapSortModeFromFilterModal(sortMode: FilterModalSortMode): string {
    switch (sortMode) {
      case 'cons_desc':
        return 'availability_desc';
      case 'cons_asc':
        return 'availability_asc';
      case 'alpha_asc':
        return 'alpha_asc';
      case 'alpha_desc':
        return 'alpha_desc';
      case 'status_asc':
        return 'status_asc';
      case 'status_desc':
        return 'status_desc';
      case 'shopping_asc':
      case 'shopping_desc':
        return 'alpha_asc';
      default:
        return 'availability_desc';
    }
  }

  private openFilterModal(): void {
    if (!this.filterModal) {
      this.filterModal = new FilterModalController({
        containerId: this.filterModalContainerId,
        widgetName: 'OperationalIndicators',
        modalClass: 'filter-modal',
        primaryColor: '#7c3aed',
        themeMode: this.controller.getThemeMode(),
        filterTabs: this.buildFilterTabs(),
        getItemId: (item) => String(item.id || item.entityId || ''),
        getItemLabel: (item) => item.label || item.name || item.labelOrName || '',
        getItemSubLabel: (item) => item.customerName || item.ownerName || '',
        getItemValue: (item) => Number(item.value) || 0,
        formatValue: (val) => `${Math.round(val)}`,
        onApply: (filters) => {
          const sortMode = this.mapSortModeFromFilterModal(filters.sortMode);
          this.controller.setFilters({
            selectedIds: filters.selectedIds,
            sortMode: sortMode as any,
          });
        },
      });
    }

    const items: FilterableDevice[] = this.controller.getEquipment().map((eq) => ({
      id: eq.id,
      label: eq.name,
      name: eq.name,
      labelOrName: eq.name,
      deviceStatus: eq.status,
      customerId: eq.customerId,
      customerName: eq.customerName,
      ownerName: eq.customerName,
      deviceType: eq.type,
      value: eq.recentAlerts + eq.openAlarms,
    }));

    const currentFilters = this.controller.getFilters();
    this.filterModal.setThemeMode(this.controller.getThemeMode());
    this.filterModal.open(items, {
      selectedIds: currentFilters.selectedIds || undefined,
      sortMode: this.mapSortModeToFilterModal(currentFilters.sortMode),
    });
  }

  // =========================================================================
  // Grid Rendering
  // =========================================================================

  renderGrid(equipment: OperationalEquipment[]): void {
    if (!this.gridContainer) return;

    // Cleanup previous selection listeners
    this.selectionCleanups.forEach((cleanup) => cleanup());
    this.selectionCleanups = [];

    // Update count
    this.updateCount(equipment.length);

    // Check for empty state
    if (equipment.length === 0) {
      this.gridContainer.innerHTML = '';
      this.showEmptyState(true);
      return;
    }

    this.showEmptyState(false);

    // Render cards
    this.gridContainer.innerHTML = equipment
      .map((eq) => this.renderCard(eq))
      .join('');

    // Bind card click events
    this.bindCardEvents();
    this.bindSelectionEvents();
    this.bindDragEvents();

    this.log('Rendered', equipment.length, 'equipment cards');
    this.emit('cards-rendered', equipment.length);
  }

  /**
   * Render equipment card (RFC-157 Enhanced)
   * - Cut-out header with identity bar
   * - Checkbox in absolute top-right
   * - Compact body layout
   * - Location in footer
   */
  private renderCard(equipment: OperationalEquipment): string {
    const statusConfig = STATUS_CONFIG[equipment.status];
    const typeConfig = TYPE_CONFIG[equipment.type];
    const availabilityColor = this.getAvailabilityColor(equipment.availability);
    const enableSelection = this.params.enableSelection !== false;
    const enableDragDrop = this.params.enableDragDrop === true;

    return `
      <article class="myio-equipment-card"
               data-id="${equipment.id}"
               data-status="${equipment.status}"
               ${enableDragDrop ? 'draggable="true"' : ''}>

        <!-- RFC-157: Checkbox in absolute top-right corner -->
        ${enableSelection ? `
          <label class="myio-equipment-card-select-absolute">
            <input type="checkbox" class="equipment-card-checkbox" aria-label="Selecionar ${this.escapeHtml(equipment.name)}">
            <span class="equipment-card-checkbox-ui"></span>
          </label>
        ` : ''}

        <!-- RFC-157: Cut-out Header (Identity Bar) -->
        <div class="myio-equipment-card-header-bar ${equipment.status}">
          <div class="header-bar-content">
            <h3 class="myio-equipment-card-title">${this.escapeHtml(equipment.name)}</h3>
            <span class="myio-equipment-card-type">${typeConfig.icon} ${typeConfig.label}</span>
          </div>
          <span class="myio-equipment-status-icon">${statusConfig.icon}</span>
        </div>

        <!-- Card Body -->
        <div class="myio-equipment-card-body">
          <!-- RFC-157: 3-Column Metrics Layout (Disponibilidade | MTBF | MTTR) -->
          <div class="myio-equipment-metrics-row">
            <!-- Block 1: Disponibilidade -->
            <div class="myio-equipment-metric-block disp" style="background: ${availabilityColor}15; border-color: ${availabilityColor}40;">
              <span class="myio-equipment-metric-block-value" style="color: ${availabilityColor};">${equipment.availability}%</span>
              <span class="myio-equipment-metric-block-label">Disp.</span>
            </div>

            <!-- Block 2: MTBF -->
            <div class="myio-equipment-metric-block mtbf">
              <span class="myio-equipment-metric-block-value">${equipment.mtbf}h</span>
              <span class="myio-equipment-metric-block-label">MTBF</span>
            </div>

            <!-- Block 3: MTTR -->
            <div class="myio-equipment-metric-block mttr">
              <span class="myio-equipment-metric-block-value">${equipment.mttr}h</span>
              <span class="myio-equipment-metric-block-label">MTTR</span>
            </div>
          </div>

          <!-- Footer with Customer + Location + Warnings -->
          <div class="myio-equipment-footer">
            <div class="myio-equipment-footer-top">
              <div class="myio-equipment-customer">
                <div class="myio-equipment-customer-avatar">
                  ${equipment.customerName.slice(0, 2).toUpperCase()}
                </div>
                <span class="myio-equipment-customer-name">${this.escapeHtml(equipment.customerName)}</span>
              </div>
              <span class="myio-equipment-location">${this.escapeHtml(equipment.location)}</span>
            </div>
            ${equipment.hasReversal || equipment.recentAlerts > 0 || equipment.openAlarms > 0 ? `
              <div class="myio-equipment-footer-warnings">
                ${equipment.hasReversal ? `<span class="myio-equipment-warning-tag reversal">⚠️ Reversão</span>` : ''}
                ${equipment.recentAlerts + equipment.openAlarms > 0 ? `<span class="myio-equipment-warning-tag alerts">🔔 ${equipment.recentAlerts + equipment.openAlarms} ${(equipment.recentAlerts + equipment.openAlarms) === 1 ? 'alerta' : 'alertas'}</span>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }

  /**
   * RFC-157: Color scale for availability percentage
   * - >= 98%: Dark green (excellent)
   * - >= 95%: Green (great)
   * - >= 90%: Lime (good)
   * - >= 80%: Yellow/amber (moderate)
   * - >= 70%: Orange (attention)
   * - < 70%: Red (critical)
   */
  private getAvailabilityColor(availability: number): string {
    if (availability >= 98) return '#15803d'; // Dark green - excellent
    if (availability >= 95) return '#22c55e'; // Green - great
    if (availability >= 90) return '#84cc16'; // Lime - good
    if (availability >= 80) return '#eab308'; // Yellow - moderate
    if (availability >= 70) return '#f97316'; // Orange - attention
    return '#ef4444'; // Red - critical
  }

  private bindCardEvents(): void {
    if (!this.gridContainer) return;

    const cards = this.gridContainer.querySelectorAll('.myio-equipment-card');
    cards.forEach((card) => {
      // Card click
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // Don't trigger card click if clicking on a button
        if (target.closest('button') || target.closest('.equipment-card-checkbox')) return;

        const id = card.getAttribute('data-id');
        if (id) {
          const equipment = this.controller.getEquipment().find((eq) => eq.id === id);
          if (equipment) {
            this.log('Card clicked:', equipment.name);
            this.params.onEquipmentClick?.(equipment);
            this.emit('equipment-click', equipment);
          }
        }
      });
    });
  }

  private bindSelectionEvents(): void {
    if (!this.gridContainer) return;
    if (this.params.enableSelection === false) return;

    const win = window as unknown as Record<string, any>;
    const selectionStore = win.MyIOLibrary?.MyIOSelectionStore || win.MyIOSelectionStore;
    if (!selectionStore) return;

    const cards = this.gridContainer.querySelectorAll('.myio-equipment-card');
    cards.forEach((card) => {
      const equipmentId = card.getAttribute('data-id');
      if (!equipmentId) return;

      const equipment = this.controller.getEquipment().find((eq) => eq.id === equipmentId);
      if (!equipment) return;

      // RFC-0157: Register as operational entity for operational comparison modal
      try {
        selectionStore.registerEntity({
          id: equipment.id,
          name: equipment.name,
          customerName: equipment.customerName || '',
          lastValue: equipment.availability || 0,
          unit: '%',
          icon: 'operational',
          domain: 'operational',
          ingestionId: equipment.id,
          // Operational metrics for comparison modal
          availability: equipment.availability || 0,
          mtbf: equipment.mtbf || 0,
          mttr: equipment.mttr || 0,
          status: equipment.status,
          equipmentType: equipment.type,
          meta: {
            type: 'equipment',
            equipment,
          },
        });
      } catch (_err) {
        // Ignore registration errors to avoid breaking UI
      }

      const checkbox = card.querySelector('.equipment-card-checkbox') as HTMLInputElement | null;
      if (!checkbox) return;

      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const checked = (e.target as HTMLInputElement).checked;
        if (checked) {
          selectionStore.add(equipmentId);
          if (!selectionStore.isSelected(equipmentId)) {
            checkbox.checked = false;
          }
        } else {
          selectionStore.remove(equipmentId);
        }
      });

      const handleSelectionChange = (data: { selectedIds?: string[] }) => {
        const selected = data?.selectedIds?.includes(equipmentId) || selectionStore.isSelected(equipmentId);
        checkbox.checked = selected;
        card.classList.toggle('is-selected', selected);
      };

      selectionStore.on('selection:change', handleSelectionChange);

      const initiallySelected = selectionStore.isSelected(equipmentId);
      checkbox.checked = initiallySelected;
      card.classList.toggle('is-selected', initiallySelected);

      this.selectionCleanups.push(() => {
        selectionStore.off('selection:change', handleSelectionChange);
      });
    });
  }

  private bindDragEvents(): void {
    if (!this.gridContainer) return;
    if (!this.params.enableDragDrop) return;

    const win = window as unknown as Record<string, any>;
    const selectionStore = win.MyIOLibrary?.MyIOSelectionStore || win.MyIOSelectionStore;

    const cards = this.gridContainer.querySelectorAll('.myio-equipment-card');
    cards.forEach((card) => {
      const equipmentId = card.getAttribute('data-id');
      if (!equipmentId) return;

      const equipment = this.controller.getEquipment().find((eq) => eq.id === equipmentId);
      if (!equipment) return;

      // RFC-0157: Drag payload with operational data
      card.addEventListener('dragstart', (e: DragEvent) => {
        const payload = {
          id: equipment.id,
          name: equipment.name,
          customerName: equipment.customerName,
          unit: '%',
          icon: 'operational',
          domain: 'operational',
          availability: equipment.availability || 0,
          mtbf: equipment.mtbf || 0,
          mttr: equipment.mttr || 0,
          status: equipment.status,
          equipmentType: equipment.type,
          meta: { type: 'equipment', equipment },
        };

        e.dataTransfer?.setData('text/myio-id', equipmentId);
        e.dataTransfer?.setData('application/json', JSON.stringify(payload));
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'copy';
        }

        if (selectionStore?.startDrag) {
          selectionStore.startDrag(equipmentId);
        }
      });
    });
  }

  // =========================================================================
  // UI State Management
  // =========================================================================

  updateCount(count: number): void {
    // Count is now updated via header instance
    if (this.headerInstance) {
      this.headerInstance.updateStats({ total: count });
    }
  }

  updateStats(stats: DeviceOperationalCardGridStats): void {
    if (this.headerInstance) {
      this.headerInstance.updateStats({
        online: stats.online,
        offline: stats.offline,
        maintenance: stats.maintenance,
        warning: stats.warning,
        total: stats.total,
        avgAvailability: stats.avgAvailability,
        avgMtbf: stats.avgMtbf,
        avgMttr: stats.avgMttr,
      });
    }
  }

  showLoading(show: boolean): void {
    if (this.loadingState) {
      this.loadingState.classList.toggle('show', show);
    }
    if (this.gridContainer) {
      this.gridContainer.style.display = show ? 'none' : '';
    }
  }

  showEmptyState(show: boolean): void {
    if (this.emptyState) {
      this.emptyState.classList.toggle('show', show);
    }
  }

  // =========================================================================
  // Theme Management
  // =========================================================================

  applyThemeMode(themeMode: ThemeMode): void {
    if (this.root) {
      this.root.setAttribute('data-theme', themeMode);
      this.log(`Applied ${themeMode} theme mode`);
    }
    if (this.headerInstance) {
      this.headerInstance.setThemeMode(themeMode);
    }
  }

  private handleThemeChange = (ev: Event): void => {
    const customEv = ev as CustomEvent<{ theme: ThemeMode }>;
    if (customEv.detail?.theme) {
      this.controller.setThemeMode(customEv.detail.theme);
      this.applyThemeMode(customEv.detail.theme);
      this.filterModal?.setThemeMode(customEv.detail.theme);
    }
  };

  // =========================================================================
  // External Filter Handling
  // =========================================================================

  private handleFilterApplied = (ev: Event): void => {
    const customEv = ev as CustomEvent<{ customerIds?: string[] }>;
    if (customEv.detail?.customerIds) {
      this.controller.setCustomerFilter(customEv.detail.customerIds);
    }
  };

  // =========================================================================
  // Event System
  // =========================================================================

  on(event: DeviceOperationalCardGridEventType, handler: DeviceOperationalCardGridEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: DeviceOperationalCardGridEventType, handler: DeviceOperationalCardGridEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: DeviceOperationalCardGridEventType, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }

  // =========================================================================
  // Refresh
  // =========================================================================

  refresh(): void {
    this.renderGrid(this.controller.getFilteredEquipment());
  }

  // =========================================================================
  // Getters
  // =========================================================================

  getElement(): HTMLElement | null {
    return this.root;
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  destroy(): void {
    this.log('Destroying view');

    // Remove event listeners
    window.removeEventListener('myio:theme-change', this.handleThemeChange);
    window.removeEventListener('myio:filter-applied', this.handleFilterApplied);

    // Clear event handlers
    this.eventHandlers.clear();

    // Destroy header instance
    if (this.headerInstance) {
      this.headerInstance.destroy();
      this.headerInstance = null;
    }

    // Remove element
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;

    // Clear references
    this.headerContainer = null;
    this.gridContainer = null;
    this.loadingState = null;
    this.emptyState = null;
    this.typeFilter = null;
    this.statusFilter = null;
    this.sortFilter = null;
  }

  // =========================================================================
  // Debug
  // =========================================================================

  private log(...args: unknown[]): void {
    if (this.params.enableDebugMode) {
      console.log('[DeviceOperationalCardGridView]', ...args);
    }
  }
}
