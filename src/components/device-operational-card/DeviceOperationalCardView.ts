/**
 * RFC-0152 Phase 4: Device Operational Card View
 * Handles rendering for the DeviceOperationalCard component
 */

import {
  Alarm,
  AlarmSeverity,
  AlarmState,
  SEVERITY_CONFIG,
  STATE_CONFIG,
  formatAlarmRelativeTime,
  isAlarmActive,
} from '../../types/alarm';

import {
  ThemeMode,
  DeviceOperationalCardParams,
  DeviceOperationalCardEventType,
  DeviceOperationalCardEventHandler,
  AlarmAction,
  ALARM_SORT_OPTIONS,
} from './types';
import { DeviceOperationalCardController } from './DeviceOperationalCardController';
import { injectDeviceOperationalCardStyles } from './styles';

export class DeviceOperationalCardView {
  private container: HTMLElement;
  private root: HTMLElement | null = null;
  private params: DeviceOperationalCardParams;
  private controller: DeviceOperationalCardController;
  private eventHandlers = new Map<DeviceOperationalCardEventType, Set<DeviceOperationalCardEventHandler>>();

  // DOM references
  private gridContainer: HTMLElement | null = null;
  private loadingState: HTMLElement | null = null;
  private emptyState: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private severityFilter: HTMLSelectElement | null = null;
  private stateFilter: HTMLSelectElement | null = null;
  private sortFilter: HTMLSelectElement | null = null;
  private alarmCount: HTMLElement | null = null;
  private selectionCleanups: Array<() => void> = [];

  constructor(
    params: DeviceOperationalCardParams,
    controller: DeviceOperationalCardController
  ) {
    this.container = params.container;
    this.params = params;
    this.controller = controller;

    // Inject styles
    injectDeviceOperationalCardStyles();
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  render(): HTMLElement {
    this.root = document.createElement('div');
    this.root.className = 'myio-alarms-grid-root';

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
    this.renderGrid(this.controller.getFilteredAlarms());

    return this.root;
  }

  private buildTemplate(): string {
    const includeSearch = this.params.includeSearch !== false;
    const includeFilters = this.params.includeFilters !== false;
    const includeStats = this.params.includeStats !== false;

    return `
      <!-- Header -->
      <header class="myio-alarms-header">
        <div class="myio-alarms-header-top">
          <h2>Alarmes e Notificacoes</h2>
          <span class="myio-alarms-count" id="alarmCount">0 alarmes</span>
        </div>

        ${includeStats ? `
          <div class="myio-alarms-stats-row" id="statsRow">
            <div class="myio-alarms-stat critical">
              <span class="myio-alarms-stat-value" id="statCritical">0</span>
              <span class="myio-alarms-stat-label">Criticos Abertos</span>
            </div>
            <div class="myio-alarms-stat high">
              <span class="myio-alarms-stat-value" id="statHigh">0</span>
              <span class="myio-alarms-stat-label">Altos Abertos</span>
            </div>
            <div class="myio-alarms-stat open">
              <span class="myio-alarms-stat-value" id="statOpen">0</span>
              <span class="myio-alarms-stat-label">Total Abertos</span>
            </div>
            <div class="myio-alarms-stat">
              <span class="myio-alarms-stat-value" id="stat24h">0</span>
              <span class="myio-alarms-stat-label">Ultimas 24h</span>
            </div>
          </div>
        ` : ''}

        ${includeSearch || includeFilters ? `
          <div class="myio-alarms-filters">
            ${includeSearch ? `
              <div class="myio-alarms-search-wrap">
                <span class="search-icon">&#x1F50D;</span>
                <input type="text" id="searchInput" placeholder="Buscar alarme..." />
              </div>
            ` : ''}

            ${includeFilters ? `
              <select id="severityFilter" class="myio-alarms-filter-select">
                <option value="all">Todas Severidades</option>
                <option value="CRITICAL">Critico</option>
                <option value="HIGH">Alto</option>
                <option value="MEDIUM">Medio</option>
                <option value="LOW">Baixo</option>
                <option value="INFO">Informativo</option>
              </select>

              <select id="stateFilter" class="myio-alarms-filter-select">
                <option value="all">Todos Estados</option>
                <option value="OPEN">Aberto</option>
                <option value="ACK">Reconhecido</option>
                <option value="SNOOZED">Adiado</option>
                <option value="ESCALATED">Escalado</option>
                <option value="CLOSED">Fechado</option>
              </select>

              <select id="sortFilter" class="myio-alarms-filter-select">
                ${ALARM_SORT_OPTIONS.map(opt =>
                  `<option value="${opt.id}">${opt.icon} ${opt.label}</option>`
                ).join('')}
              </select>
            ` : ''}
          </div>
        ` : ''}
      </header>

      <!-- Alarms Grid -->
      <section class="myio-alarms-grid" id="alarmsGrid">
        <!-- Cards rendered dynamically -->
      </section>

      <!-- Loading State -->
      <div class="myio-alarms-loading" id="loadingState">
        <div class="spinner"></div>
        <p>Carregando alarmes...</p>
      </div>

      <!-- Empty State -->
      <div class="myio-alarms-empty" id="emptyState">
        <div class="empty-icon">&#x1F514;</div>
        <p>Nenhum alarme encontrado</p>
      </div>
    `;
  }

  private cacheReferences(): void {
    if (!this.root) return;

    this.gridContainer = this.root.querySelector('#alarmsGrid');
    this.loadingState = this.root.querySelector('#loadingState');
    this.emptyState = this.root.querySelector('#emptyState');
    this.searchInput = this.root.querySelector('#searchInput');
    this.severityFilter = this.root.querySelector('#severityFilter');
    this.stateFilter = this.root.querySelector('#stateFilter');
    this.sortFilter = this.root.querySelector('#sortFilter');
    this.alarmCount = this.root.querySelector('#alarmCount');
  }

  private setupEventListeners(): void {
    // Search input
    this.searchInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.controller.setSearchQuery(target.value);
      this.emit('search-change', target.value);
    });

    // Severity filter
    this.severityFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const value = target.value;
      if (value === 'all') {
        this.controller.setSeverityFilter('all');
      } else {
        this.controller.setSeverityFilter([value as AlarmSeverity]);
      }
      this.emit('filter-change', { severity: value });
    });

    // State filter
    this.stateFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const value = target.value;
      if (value === 'all') {
        this.controller.setStateFilter('all');
      } else {
        this.controller.setStateFilter([value as AlarmState]);
      }
      this.emit('filter-change', { state: value });
    });

    // Sort filter
    this.sortFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.controller.setSortMode(target.value as any);
      this.emit('sort-change', target.value);
    });

    // Controller state changes trigger re-render
    this.controller.setOnStateChange((state) => {
      this.renderGrid(state.filteredAlarms);
      this.updateStats(state.stats);
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

  renderGrid(alarms: Alarm[]): void {
    if (!this.gridContainer) return;

    // Update count
    this.updateCount(alarms.length);

    // Check for empty state
    if (alarms.length === 0) {
      this.gridContainer.innerHTML = '';
      this.showEmptyState(true);
      return;
    }

    this.showEmptyState(false);

    // Render cards
    this.gridContainer.innerHTML = alarms
      .map((alarm) => this.renderCard(alarm))
      .join('');

    // Bind card click events
    this.bindCardEvents();

    this.log('Rendered', alarms.length, 'alarm cards');
    this.emit('cards-rendered', alarms.length);
  }

  private renderCard(alarm: Alarm): string {
    const severityConfig = SEVERITY_CONFIG[alarm.severity];
    const isActive = isAlarmActive(alarm.state);
    const isCritical = alarm.severity === 'CRITICAL' && alarm.state === 'OPEN';
    const severityChipClass = this.getSeverityChipClass(alarm.severity);
    const stateChipClass = this.getStateChipClass(alarm.state);
    const enableSelection = this.params.enableSelection !== false;
    const enableDragDrop = this.params.enableDragDrop === true;

    return `
      <article class="myio-alarm-card ${isCritical ? 'is-critical' : ''}"
               data-id="${alarm.id}"
               data-severity="${alarm.severity}"
               data-state="${alarm.state}"
               ${enableDragDrop ? 'draggable="true"' : ''}>

        <!-- Severity Bar -->
        <div class="severity-bar" style="background: ${severityConfig.border}"></div>

        <div class="myio-alarm-card-content">
          <!-- Header -->
          <div class="myio-alarm-card-header">
            <div class="myio-alarm-card-badges">
              <span class="chip ${severityChipClass}">${severityConfig.icon} ${severityConfig.label}</span>
              <span class="chip ${stateChipClass}">${STATE_CONFIG[alarm.state].label}</span>
            </div>
            <span class="myio-alarm-card-time">${formatAlarmRelativeTime(alarm.lastOccurrence)}</span>
          </div>

          ${enableSelection ? `
            <label class="myio-alarm-card-select">
              <input type="checkbox" class="alarm-card-checkbox" aria-label="Selecionar ${this.escapeHtml(alarm.title)}">
              <span class="alarm-card-checkbox-ui"></span>
            </label>
          ` : ''}

          <!-- Title -->
          <h3 class="myio-alarm-card-title">${this.escapeHtml(alarm.title)}</h3>
          <p class="myio-alarm-card-id">${alarm.id}</p>

          <!-- Customer Info -->
          <div class="myio-alarm-customer-info">
            <div class="myio-alarm-customer-avatar">
              ${alarm.customerName.slice(0, 2).toUpperCase()}
            </div>
            <div class="myio-alarm-customer-details">
              <span class="myio-alarm-customer-name">${this.escapeHtml(alarm.customerName)}</span>
              <span class="myio-alarm-source">${this.escapeHtml(alarm.source)}</span>
            </div>
          </div>

          <!-- Stats Row -->
          <div class="myio-alarm-card-stats">
            <div class="myio-alarm-stat-item">
              <span class="stat-value">${alarm.occurrenceCount}</span>
              <span class="stat-label">Ocorrencias</span>
            </div>
            <div class="myio-alarm-stat-item">
              <span class="stat-value">${formatAlarmRelativeTime(alarm.firstOccurrence)}</span>
              <span class="stat-label">Primeira vez</span>
            </div>
            <div class="myio-alarm-stat-item">
              <span class="stat-value">${formatAlarmRelativeTime(alarm.lastOccurrence)}</span>
              <span class="stat-label">Ultima vez</span>
            </div>
          </div>

          ${Object.keys(alarm.tags).length > 0 ? `
            <div class="myio-alarm-tags">
              ${Object.entries(alarm.tags).slice(0, 3).map(([k, v]) =>
                `<span class="myio-alarm-tag">${k}: ${v}</span>`
              ).join('')}
              ${Object.keys(alarm.tags).length > 3 ?
                `<span class="myio-alarm-tag more">+${Object.keys(alarm.tags).length - 3}</span>` : ''}
            </div>
          ` : ''}

          <!-- Actions -->
          <div class="myio-alarm-card-actions">
            ${isActive ? `
              <button class="btn-ack" data-action="acknowledge">Reconhecer</button>
            ` : ''}
            <button class="btn-details" data-action="details">Detalhes</button>
            ${alarm.state !== 'CLOSED' ? `
              <button class="btn-more" data-action="more">&#x22EE;</button>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }

  private bindCardEvents(): void {
    if (!this.gridContainer) return;

    // Cleanup previous selection listeners
    this.selectionCleanups.forEach((cleanup) => cleanup());
    this.selectionCleanups = [];

    const cards = this.gridContainer.querySelectorAll('.myio-alarm-card');
    cards.forEach((card) => {
      const alarmId = card.getAttribute('data-id') || '';

      // Card click
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // Don't trigger card click if clicking on a button or checkbox
        if (target.closest('button') || target.closest('.alarm-card-checkbox')) return;

        if (alarmId) {
          const alarm = this.controller.getAlarms().find((a) => a.id === alarmId);
          if (alarm) {
            this.log('Card clicked:', alarm.title);
            this.params.onAlarmClick?.(alarm);
            this.emit('alarm-click', alarm);
          }
        }
      });

      // Action buttons
      const actionButtons = card.querySelectorAll('button[data-action]');
      actionButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = (btn as HTMLElement).getAttribute('data-action') as AlarmAction;
          const id = card.getAttribute('data-id');
          if (id && action) {
            const alarm = this.controller.getAlarms().find((a) => a.id === id);
            if (alarm) {
              this.log('Action triggered:', action, 'on', alarm.title);
              this.params.onAlarmAction?.(action, alarm);
              this.emit('alarm-action', { action, alarm });
            }
          }
        });
      });
    });

    this.bindSelectionEvents();
    this.bindDragEvents();
  }

  private bindSelectionEvents(): void {
    if (!this.gridContainer) return;
    if (this.params.enableSelection === false) return;

    const win = window as unknown as Record<string, any>;
    const selectionStore = win.MyIOLibrary?.MyIOSelectionStore || win.MyIOSelectionStore;
    if (!selectionStore) return;

    const cards = this.gridContainer.querySelectorAll('.myio-alarm-card');
    cards.forEach((card) => {
      const alarmId = card.getAttribute('data-id');
      if (!alarmId) return;

      const alarm = this.controller.getAlarms().find((a) => a.id === alarmId);
      if (!alarm) return;

      // Register entity for footer selection
      try {
        selectionStore.registerEntity({
          id: alarm.id,
          name: alarm.title,
          customerName: alarm.customerName || '',
          lastValue: alarm.occurrenceCount || 0,
          unit: 'alarms',
          icon: 'alarms',
          domain: 'alarms',
          alarm: alarm,
          meta: {
            type: 'alarm',
            severity: alarm.severity,
            state: alarm.state,
            firstOccurrence: alarm.firstOccurrence,
            lastOccurrence: alarm.lastOccurrence,
            occurrenceCount: alarm.occurrenceCount,
            source: alarm.source,
            tags: alarm.tags,
          },
        });
      } catch (_err) {
        // Ignore registration errors to avoid breaking UI
      }

      const checkbox = card.querySelector('.alarm-card-checkbox') as HTMLInputElement | null;
      if (!checkbox) return;

      // Handle checkbox changes
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const checked = (e.target as HTMLInputElement).checked;
        if (checked) {
          selectionStore.add(alarmId);
          if (!selectionStore.isSelected(alarmId)) {
            checkbox.checked = false;
          }
        } else {
          selectionStore.remove(alarmId);
        }
      });

      // Sync selection state from store
      const handleSelectionChange = (data: { selectedIds?: string[] }) => {
        const selected = data?.selectedIds?.includes(alarmId) || selectionStore.isSelected(alarmId);
        checkbox.checked = selected;
        card.classList.toggle('is-selected', selected);
      };

      selectionStore.on('selection:change', handleSelectionChange);

      // Initial state
      const initiallySelected = selectionStore.isSelected(alarmId);
      checkbox.checked = initiallySelected;
      card.classList.toggle('is-selected', initiallySelected);

      // Cleanup
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

    const cards = this.gridContainer.querySelectorAll('.myio-alarm-card');
    cards.forEach((card) => {
      const alarmId = card.getAttribute('data-id');
      if (!alarmId) return;

      const alarm = this.controller.getAlarms().find((a) => a.id === alarmId);
      if (!alarm) return;

      card.addEventListener('dragstart', (e: DragEvent) => {
        e.dataTransfer?.setData('text/myio-id', alarmId);
        e.dataTransfer?.setData('application/json', JSON.stringify(alarm));
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'copy';
        }

        if (selectionStore?.startDrag) {
          selectionStore.startDrag(alarmId);
        }
      });
    });
  }

  private getSeverityChipClass(severity: AlarmSeverity): string {
    switch (severity) {
      case 'CRITICAL':
        return 'chip--failure';
      case 'HIGH':
        return 'chip--warning';
      case 'MEDIUM':
        return 'chip--alert';
      case 'LOW':
        return 'chip--standby';
      case 'INFO':
        return 'chip--power-on';
      default:
        return 'chip--offline';
    }
  }

  private getStateChipClass(state: AlarmState): string {
    switch (state) {
      case 'OPEN':
        return 'chip--alert';
      case 'ACK':
        return 'chip--standby';
      case 'SNOOZED':
        return 'chip--warning';
      case 'ESCALATED':
        return 'chip--failure';
      case 'CLOSED':
        return 'chip--offline';
      default:
        return 'chip--offline';
    }
  }

  // =========================================================================
  // UI State Management
  // =========================================================================

  updateCount(count: number): void {
    if (this.alarmCount) {
      this.alarmCount.textContent = `${count} ${count === 1 ? 'alarme' : 'alarmes'}`;
    }
  }

  updateStats(stats: import('../../types/alarm').AlarmStats): void {
    if (!this.root) return;

    const statCritical = this.root.querySelector('#statCritical');
    const statHigh = this.root.querySelector('#statHigh');
    const statOpen = this.root.querySelector('#statOpen');
    const stat24h = this.root.querySelector('#stat24h');

    if (statCritical) statCritical.textContent = String(stats.openCritical);
    if (statHigh) statHigh.textContent = String(stats.openHigh);
    if (statOpen) statOpen.textContent = String(stats.byState.OPEN);
    if (stat24h) stat24h.textContent = String(stats.last24Hours);
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

  on(event: DeviceOperationalCardEventType, handler: DeviceOperationalCardEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: DeviceOperationalCardEventType, handler: DeviceOperationalCardEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: DeviceOperationalCardEventType, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }

  // =========================================================================
  // Refresh
  // =========================================================================

  refresh(): void {
    this.renderGrid(this.controller.getFilteredAlarms());
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
    this.severityFilter = null;
    this.stateFilter = null;
    this.sortFilter = null;
    this.alarmCount = null;
  }

  // =========================================================================
  // Debug
  // =========================================================================

  private log(...args: unknown[]): void {
    if (this.params.enableDebugMode) {
      console.log('[DeviceOperationalCardView]', ...args);
    }
  }
}
