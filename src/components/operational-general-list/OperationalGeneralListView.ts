/**
 * RFC-0152 Phase 3: Operational General List View
 * Handles rendering for the OperationalGeneralList component
 */

import {
  EquipmentCardData,
  EquipmentStatus,
} from '../../types/operational';

import {
  ThemeMode,
  OperationalGeneralListParams,
  OperationalListEventType,
  OperationalListEventHandler,
  STATUS_CONFIG,
  getAvailabilityColorFromThresholds,
} from './types';
import { OperationalGeneralListController } from './OperationalGeneralListController';
import { injectOperationalGeneralListStyles } from './styles';

export class OperationalGeneralListView {
  private container: HTMLElement;
  private root: HTMLElement | null = null;
  private params: OperationalGeneralListParams;
  private controller: OperationalGeneralListController;
  private eventHandlers = new Map<OperationalListEventType, Set<OperationalListEventHandler>>();

  // DOM references
  private gridContainer: HTMLElement | null = null;
  private loadingState: HTMLElement | null = null;
  private emptyState: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private statusFilter: HTMLSelectElement | null = null;
  private typeFilter: HTMLSelectElement | null = null;
  private equipmentCount: HTMLElement | null = null;

  constructor(
    params: OperationalGeneralListParams,
    controller: OperationalGeneralListController
  ) {
    this.container = params.container;
    this.params = params;
    this.controller = controller;

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
      <!-- Header with filters -->
      <header class="myio-operational-header">
        <div class="header-title">
          <h2>Lista Geral de Equipamentos</h2>
          <span class="equipment-count" id="equipmentCount">0 equipamentos</span>
        </div>
        <div class="header-filters">
          <div class="search-wrap">
            <span class="search-icon">&#x1F50D;</span>
            <input type="text" id="searchInput" placeholder="Buscar equipamento..." />
          </div>
          <select id="statusFilter" class="filter-select">
            <option value="all">Todos os Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="maintenance">Manutencao</option>
          </select>
          <select id="typeFilter" class="filter-select">
            <option value="all">Todos os Tipos</option>
            <option value="escada">Escadas Rolantes</option>
            <option value="elevador">Elevadores</option>
          </select>
        </div>
      </header>

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

    this.gridContainer = this.root.querySelector('#equipmentGrid');
    this.loadingState = this.root.querySelector('#loadingState');
    this.emptyState = this.root.querySelector('#emptyState');
    this.searchInput = this.root.querySelector('#searchInput');
    this.statusFilter = this.root.querySelector('#statusFilter');
    this.typeFilter = this.root.querySelector('#typeFilter');
    this.equipmentCount = this.root.querySelector('#equipmentCount');
  }

  private setupEventListeners(): void {
    // Search input
    this.searchInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.controller.setSearchQuery(target.value);
      this.emit('search-change', target.value);
    });

    // Status filter
    this.statusFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.controller.setStatusFilter(target.value as EquipmentStatus | 'all');
      this.emit('status-filter-change', target.value);
    });

    // Type filter
    this.typeFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.controller.setTypeFilter(target.value as 'escada' | 'elevador' | 'all');
      this.emit('type-filter-change', target.value);
    });

    // Controller state changes trigger re-render
    this.controller.setOnStateChange((state) => {
      this.renderGrid(state.filteredEquipment);
      this.showLoading(state.isLoading);
    });

    // Listen for global theme changes
    window.addEventListener('myio:theme-change', this.handleThemeChange);

    // Listen for customer filter from menu
    window.addEventListener('myio:filter-applied', this.handleFilterApplied);
  }

  // =========================================================================
  // Grid Rendering
  // =========================================================================

  renderGrid(equipment: EquipmentCardData[]): void {
    if (!this.gridContainer) return;

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

    this.log('Rendered', equipment.length, 'equipment cards');
    this.emit('cards-rendered', equipment.length);
  }

  private renderCard(data: EquipmentCardData): string {
    const statusConfig = STATUS_CONFIG[data.status];
    const availabilityColor = getAvailabilityColorFromThresholds(data.availability);

    // SVG gauge calculations
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - data.availability / 100);

    return `
      <article class="equipment-card" data-id="${data.id}" data-status="${data.status}">
        <header class="card-header">
          <div class="card-info">
            <h3 class="card-name">${this.escapeHtml(data.name)}</h3>
            <span class="card-type">${data.type === 'escada' ? 'Escada Rolante' : 'Elevador'}</span>
            <span class="card-location">${this.escapeHtml(data.location)}</span>
          </div>
          <span class="status-badge" style="
            background: ${statusConfig.bg};
            border-color: ${statusConfig.border};
            color: ${statusConfig.text}
          ">${statusConfig.label}</span>
        </header>

        ${data.hasReversal ? `
          <div class="reversal-warning">
            <span>&#x26A0;&#xFE0F;</span>
            <span>Reversao detectada</span>
          </div>
        ` : ''}

        <div class="availability-gauge">
          <svg viewBox="0 0 128 128">
            <circle cx="64" cy="64" r="${radius}" class="gauge-bg" />
            <circle cx="64" cy="64" r="${radius}" class="gauge-value"
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

        <div class="metrics-row">
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

        ${data.recentAlerts > 0 ? `
          <div class="alerts-badge">
            <span>&#x1F514;</span>
            <span>${data.recentAlerts} ${data.recentAlerts === 1 ? 'alerta recente' : 'alertas recentes'}</span>
          </div>
        ` : ''}

        <footer class="card-footer">
          <span class="customer-badge">${this.escapeHtml(data.customerName)}</span>
        </footer>
      </article>
    `;
  }

  private bindCardEvents(): void {
    if (!this.gridContainer) return;

    const cards = this.gridContainer.querySelectorAll('.equipment-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
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

  // =========================================================================
  // UI State Management
  // =========================================================================

  updateCount(count: number): void {
    if (this.equipmentCount) {
      this.equipmentCount.textContent = `${count} ${count === 1 ? 'equipamento' : 'equipamentos'}`;
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

    // Clear event handlers
    this.eventHandlers.clear();

    // Remove element
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;

    // Clear references
    this.gridContainer = null;
    this.loadingState = null;
    this.emptyState = null;
    this.searchInput = null;
    this.statusFilter = null;
    this.typeFilter = null;
    this.equipmentCount = null;
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
