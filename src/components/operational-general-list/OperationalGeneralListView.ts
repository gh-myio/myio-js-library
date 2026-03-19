/**
 * RFC-0152 Phase 3: Operational General List View
 * Handles rendering for the OperationalGeneralList component
 */

import {
  EquipmentCardData,
} from '../../types/operational';

import {
  ThemeMode,
  OperationalGeneralListParams,
  OperationalListEventType,
  OperationalListEventHandler,
  STATUS_CONFIG,
  getAvailabilityColorFromThresholds,
} from './types';
import type { FilterTab, FilterableDevice, SortMode as FilterModalSortMode } from '../filter-modal/types';
import { FilterModalController } from '../filter-modal/FilterModalController';
import { OperationalGeneralListController } from './OperationalGeneralListController';
import { injectOperationalGeneralListStyles } from './styles';
import {
  createOperationalHeaderDevicesGridComponent,
  OperationalHeaderDevicesGridInstance,
} from '../operational-header-devices-grid';

export class OperationalGeneralListView {
  private container: HTMLElement;
  private root: HTMLElement | null = null;
  private params: OperationalGeneralListParams;
  private controller: OperationalGeneralListController;
  private eventHandlers = new Map<OperationalListEventType, Set<OperationalListEventHandler>>();

  private headerInstance: OperationalHeaderDevicesGridInstance | null = null;
  private filterModal: FilterModalController | null = null;
  private filterModalContainerId: string;
  private selectionCleanups: Array<() => void> = [];

  // DOM references
  private headerContainer: HTMLElement | null = null;
  private gridContainer: HTMLElement | null = null;
  private loadingState: HTMLElement | null = null;
  private emptyState: HTMLElement | null = null;

  constructor(
    params: OperationalGeneralListParams,
    controller: OperationalGeneralListController
  ) {
    this.container = params.container;
    this.params = params;
    this.controller = controller;
    this.filterModalContainerId = `operational-general-filter-${Math.random().toString(36).slice(2, 10)}`;

    // Inject styles
    injectOperationalGeneralListStyles();
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  render(): HTMLElement {
    this.root = document.createElement('div');
    this.root.className = 'myio-operational-list-root';

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

  private buildTemplate(): string {
    return `
      <!-- Premium Header Container -->
      <div class="myio-operational-header-container" id="headerContainer"></div>

      <!-- Equipment Grid -->
      <section class="myio-operational-grid" id="equipmentGrid">
        <!-- Cards rendered dynamically -->
      </section>

      <!-- Loading State -->
      <div class="myio-operational-loading" id="loadingState" style="display: none;">
        <div class="spinner"></div>
        <p>Carregando equipamentos...</p>
      </div>

      <!-- Empty State -->
      <div class="myio-operational-empty" id="emptyState" style="display: none;">
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
  }

  private setupEventListeners(): void {
    // Controller state changes trigger re-render
    this.controller.setOnStateChange((state) => {
      this.renderGrid(state.filteredEquipment);
      this.showLoading(state.isLoading);
      this.updateStats(state.stats);
    });

    // Listen for global theme changes
    window.addEventListener('myio:theme-change', this.handleThemeChange);

    // Listen for customer filter from menu
    window.addEventListener('myio:filter-applied', this.handleFilterApplied);
  }

  private createPremiumHeader(): void {
    if (!this.headerContainer) return;

    const equipment = this.controller.getEquipment();
    const customers = this.params.customers && this.params.customers.length > 0
      ? this.params.customers
      : this.buildCustomerOptions(equipment);

    this.headerInstance = createOperationalHeaderDevicesGridComponent({
      container: this.headerContainer,
      themeMode: this.controller.getThemeMode(),
      includeSearch: true,
      includeFilter: true,
      includeCustomerFilter: true,
      includeMaximize: true,
      customers,
      onSearchChange: (query) => {
        this.controller.setSearchQuery(query);
        this.emit('search-change', query);
      },
      onFilterClick: () => {
        this.openFilterModal();
      },
      onCustomerChange: (customerId) => {
        if (customerId === 'all') {
          this.controller.setCustomerFilter([]);
        } else {
          this.controller.setCustomerFilter([customerId]);
        }
      },
      onMaximizeClick: (maximized) => {
        this.emit('filter-change', maximized);
      },
    });

    this.updateStats(this.controller.getStats());
  }

  private buildCustomerOptions(equipment: EquipmentCardData[]): Array<{ id: string; name: string }> {
    const map = new Map<string, string>();
    equipment.forEach((eq) => {
      const id = eq.customerId || eq.customerName;
      if (id && eq.customerName) {
        map.set(id, eq.customerName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }

  private buildFilterTabs(): FilterTab[] {
    return [
      { id: 'online', label: 'Online', filter: (e) => e.deviceStatus === 'online' },
      { id: 'offline', label: 'Offline', filter: (e) => e.deviceStatus === 'offline' },
      { id: 'maintenance', label: 'Manutencao', filter: (e) => e.deviceStatus === 'maintenance' },
      { id: 'elevators', label: 'Elevadores', filter: (e) => e.deviceType === 'elevador' },
      { id: 'escalators', label: 'Escadas', filter: (e) => e.deviceType === 'escada' },
      { id: 'others', label: 'Outros', filter: (e) => e.deviceType === 'other' },
    ];
  }

  private mapSortModeToFilterModal(sortMode?: string): FilterModalSortMode {
    switch (sortMode) {
      case 'cons_asc':
        return 'cons_asc';
      case 'alpha_asc':
        return 'alpha_asc';
      case 'alpha_desc':
        return 'alpha_desc';
      case 'status_asc':
        return 'status_asc';
      case 'status_desc':
        return 'status_desc';
      case 'shopping_asc':
        return 'shopping_asc';
      case 'shopping_desc':
        return 'shopping_desc';
      case 'cons_desc':
      default:
        return 'cons_desc';
    }
  }

  private mapSortModeFromFilterModal(sortMode: FilterModalSortMode): string {
    return sortMode;
  }

  private openFilterModal(): void {
    if (!this.filterModal) {
      this.filterModal = new FilterModalController({
        containerId: this.filterModalContainerId,
        widgetName: 'OperationalGeneralList',
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
            selectedIds: filters.selectedIds || null,
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
      value: eq.recentAlerts || 0,
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

  renderGrid(equipment: EquipmentCardData[]): void {
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

  private renderCard(data: EquipmentCardData): string {
    const statusConfig = STATUS_CONFIG[data.status];
    const availabilityColor = getAvailabilityColorFromThresholds(data.availability);
    const enableSelection = this.params.enableSelection !== false;
    const enableDragDrop = this.params.enableDragDrop === true;

    // SVG gauge calculations
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - data.availability / 100);

    return `
      <article class="equipment-card" data-id="${data.id}" data-status="${data.status}" ${enableDragDrop ? 'draggable="true"' : ''}>
        <header class="card-header">
          <div class="card-info">
            <h3 class="card-name">${this.escapeHtml(data.name)}</h3>
            <span class="card-type">${data.type === 'escada' ? 'Escada Rolante' : 'Elevador'}</span>
            <span class="card-location">${this.escapeHtml(data.location)}</span>
          </div>
          ${enableSelection ? `
            <label class="equipment-card-select">
              <input type="checkbox" class="equipment-card-checkbox" aria-label="Selecionar ${this.escapeHtml(data.name)}">
              <span class="equipment-card-checkbox-ui"></span>
            </label>
          ` : ''}
        </header>

        ${data.hasReversal ? `
          <div class="reversal-warning">
            <span class="warn-icon">&#x26A0;&#xFE0F;</span>
            <span>Reversao detectada</span>
          </div>
        ` : ''}

        <div class="card-mid">
          <div class="availability-gauge">
            <svg viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="${radius}" class="gauge-bg" />
              <circle cx="36" cy="36" r="${radius}" class="gauge-value"
                stroke="${availabilityColor}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${strokeDashoffset}"
              />
            </svg>
            <div class="gauge-label">
              <span class="value">${data.availability}%</span>
              <span class="label">Disponibilidade</span>
            </div>
          </div>

          <div class="metrics-col">
            <div class="metric">
              <span class="metric-icon">&#x23F1;&#xFE0F;</span>
              <div class="metric-data">
                <span class="metric-label">MTBF</span>
                <span class="metric-value">${data.mtbf}h</span>
              </div>
            </div>
            <div class="metric">
              <span class="metric-icon">&#x1F527;</span>
              <div class="metric-data">
                <span class="metric-label">MTTR</span>
                <span class="metric-value">${data.mttr}h</span>
              </div>
            </div>
          </div>
        </div>

        ${data.recentAlerts > 0 ? `
          <div class="alerts-badge">
            <span>&#x1F514;</span>
            <span>${data.recentAlerts} ${data.recentAlerts === 1 ? 'alerta recente' : 'alertas recentes'}</span>
          </div>
        ` : ''}

        <footer class="card-footer">
          <span class="customer-badge">${this.escapeHtml(data.customerName)}</span>
          <span class="status-badge" style="
            background: ${statusConfig.bg};
            border-color: ${statusConfig.border};
            color: ${statusConfig.text}
          ">${statusConfig.label}</span>
        </footer>
      </article>
    `;
  }

  private bindCardEvents(): void {
    if (!this.gridContainer) return;

    const cards = this.gridContainer.querySelectorAll('.equipment-card');
    cards.forEach((card) => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('.equipment-card-checkbox')) return;
        const id = card.getAttribute('data-id');
        if (id) {
          const equipment = this.controller
            .getEquipment()
            .find((eq) => eq.id === id);
          if (equipment) {
            this.log('Card clicked:', equipment.name);
            this.params.onCardClick?.(equipment);
            this.emit('card-click', equipment);
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

    const cards = this.gridContainer.querySelectorAll('.equipment-card');
    cards.forEach((card) => {
      const equipmentId = card.getAttribute('data-id');
      if (!equipmentId) return;

      const equipment = this.controller.getEquipment().find((eq) => eq.id === equipmentId);
      if (!equipment) return;

      const severityMap: Record<string, string> = {
        offline: 'CRITICAL',
        maintenance: 'HIGH',
        online: 'INFO',
      };

      const alarmLike = {
        id: equipment.id,
        customerId: equipment.customerId || '',
        customerName: equipment.customerName || '',
        source: equipment.name,
        severity: severityMap[equipment.status] || 'MEDIUM',
        state: equipment.status === 'online' ? 'CLOSED' : 'OPEN',
        title: equipment.name,
        description: `${equipment.type} - ${equipment.location}`,
        tags: { type: equipment.type, status: equipment.status },
        firstOccurrence: new Date().toISOString(),
        lastOccurrence: new Date().toISOString(),
        occurrenceCount: equipment.recentAlerts || 0,
      };

      try {
        selectionStore.registerEntity({
          id: equipment.id,
          name: equipment.name,
          customerName: equipment.customerName || '',
          lastValue: equipment.recentAlerts || 0,
          unit: 'alarms',
          icon: 'alarms',
          domain: 'alarms',
          alarm: alarmLike,
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

    const cards = this.gridContainer.querySelectorAll('.equipment-card');
    cards.forEach((card) => {
      const equipmentId = card.getAttribute('data-id');
      if (!equipmentId) return;

      const equipment = this.controller.getEquipment().find((eq) => eq.id === equipmentId);
      if (!equipment) return;

      card.addEventListener('dragstart', (e: DragEvent) => {
        const payload = {
          id: equipment.id,
          name: equipment.name,
          customerName: equipment.customerName,
          unit: 'alarms',
          domain: 'alarms',
          alarm: {
            id: equipment.id,
            customerName: equipment.customerName,
            title: equipment.name,
            severity: equipment.status === 'offline' ? 'CRITICAL' : 'MEDIUM',
            state: equipment.status === 'online' ? 'CLOSED' : 'OPEN',
            lastOccurrence: new Date().toISOString(),
            occurrenceCount: equipment.recentAlerts || 0,
          },
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
    if (this.headerInstance) {
      this.headerInstance.updateStats({ total: count });
    }
  }

  updateStats(stats: import('../../types/operational').EquipmentStats): void {
    if (this.headerInstance) {
      this.headerInstance.updateStats({
        online: stats.online,
        offline: stats.offline,
        maintenance: stats.maintenance,
        warning: 0,
        total: stats.total,
        avgAvailability: stats.fleetAvailability,
        avgMtbf: stats.avgMtbf,
        avgMttr: stats.avgMttr,
      });
    }
  }

  showLoading(show: boolean): void {
    if (this.loadingState) {
      this.loadingState.style.display = show ? 'flex' : 'none';
    }
  }

  showEmptyState(show: boolean): void {
    if (this.emptyState) {
      this.emptyState.style.display = show ? 'flex' : 'none';
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

  on(event: OperationalListEventType, handler: OperationalListEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: OperationalListEventType, handler: OperationalListEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: OperationalListEventType, ...args: unknown[]): void {
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

    // Cleanup selection listeners
    this.selectionCleanups.forEach((cleanup) => cleanup());
    this.selectionCleanups = [];

    // Destroy header and filter modal
    this.headerInstance?.destroy?.();
    this.filterModal?.destroy?.();

    // Clear event handlers
    this.eventHandlers.clear();

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
    this.headerInstance = null;
    this.filterModal = null;
  }

  // =========================================================================
  // Debug
  // =========================================================================

  private log(...args: unknown[]): void {
    if (this.params.enableDebugMode) {
      console.log('[OperationalGeneralListView]', ...args);
    }
  }
}
