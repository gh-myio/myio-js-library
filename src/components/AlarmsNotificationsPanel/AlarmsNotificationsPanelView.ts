/**
 * RFC-0152 Phase 4: Alarms Notifications Panel View
 * DOM rendering and event handling
 */

import type { Alarm, AlarmFilters, AlarmSeverity, AlarmState } from '../../types/alarm';
import { SEVERITY_CONFIG, STATE_CONFIG } from '../../types/alarm';
import type {
  AlarmsNotificationsPanelParams,
  AlarmsNotificationsPanelState,
  AlarmsTab,
  ThemeMode,
  AlarmsEventType,
  AlarmsEventHandler,
} from './types';
import { AlarmsNotificationsPanelController } from './AlarmsNotificationsPanelController';
import { injectAlarmsNotificationsPanelStyles } from './styles';
import { createAlarmCardElement } from './AlarmCard';
import { renderDashboard, updateDashboard } from './AlarmDashboard';
import { openAlarmDetailsModal } from './AlarmDetailsModal';

export class AlarmsNotificationsPanelView {
  private params: AlarmsNotificationsPanelParams;
  private controller: AlarmsNotificationsPanelController;
  private root: HTMLElement | null = null;
  private eventHandlers: Map<AlarmsEventType, Set<AlarmsEventHandler>> = new Map();
  private debug: boolean;

  // Bulk-selection state
  private selectedTitles = new Set<string>();
  private groupedAlarms: import('../../types/alarm').Alarm[] = [];

  // View mode: 'card' (default) or 'list' (table)
  private viewMode: 'card' | 'list' = 'card';

  // Group mode: 'consolidado' (default) groups same-title alarms; 'separado' one row per device
  private groupMode: 'consolidado' | 'separado' = 'consolidado';

  constructor(
    params: AlarmsNotificationsPanelParams,
    controller: AlarmsNotificationsPanelController
  ) {
    this.params = params;
    this.controller = controller;
    this.debug = params.enableDebugMode ?? false;

    // Inject styles
    injectAlarmsNotificationsPanelStyles();

    // Listen to controller state changes
    this.controller.setOnStateChange(this.handleStateChange.bind(this));
  }

  // =====================================================================
  // Render
  // =====================================================================

  /**
   * Render the component
   */
  render(): HTMLElement {
    const state = this.controller.getState();

    // Create root element
    this.root = document.createElement('div');
    this.root.className = 'myio-alarms-panel';
    this.root.setAttribute('data-theme', state.themeMode);
    this.root.setAttribute('data-tab', state.activeTab);

    // Build HTML structure
    this.root.innerHTML = this.buildTemplate(state);

    // Append to container
    this.params.container.appendChild(this.root);

    // Bind event listeners
    this.bindEvents();

    // Initial render of content
    this.renderListContent(state);
    this.renderDashboardContent(state);

    this.log('View rendered');

    return this.root;
  }

  /**
   * Build main template
   */
  private buildTemplate(state: AlarmsNotificationsPanelState): string {
    return `
      <!-- Tab Navigation -->
      <nav class="myio-alarms-tabs">
        <button class="tab-btn ${state.activeTab === 'list' ? 'active' : ''}" data-tab="list">
          <span class="tab-icon">📋</span>
          <span class="tab-label">Lista</span>
          <span class="tab-count" data-count="filtered">${state.filteredAlarms.length}</span>
        </button>
        <button class="tab-btn ${state.activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
          <span class="tab-icon">📊</span>
          <span class="tab-label">Dashboard</span>
        </button>
        <!-- margin-left:auto no botão empurra ele + badge para a direita -->
        <button class="alarm-text-btn alarms-tab-map-btn" id="btnAlarmBundleMap" title="Mapa de Alarmes GCDR" aria-label="Mapa de Alarmes GCDR">
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
          REGRAS DE ALARMES
        </button>
        <span class="alarm-count-badge alarms-tab-count-badge" id="alarmCountBadge" style="display: none">0</span>
      </nav>

      <!-- Tab Content -->
      <div class="myio-alarms-content">
        <!-- List Tab -->
        <section class="tab-content ${state.activeTab === 'list' ? 'active' : ''}" data-tab-content="list">
          ${this.buildListHeaderTemplate(state)}
          <div class="alarms-grid" id="alarmsGrid"></div>
          <div class="alarms-empty-state" id="alarmsEmpty" style="display: none">
            <span class="alarms-empty-icon">🔔</span>
            <h3 class="alarms-empty-title">Nenhum alarme encontrado</h3>
            <p class="alarms-empty-text">Ajuste os filtros ou aguarde novos alarmes.</p>
          </div>
        </section>

        <!-- Dashboard Tab -->
        <section class="tab-content ${state.activeTab === 'dashboard' ? 'active' : ''}" data-tab-content="dashboard">
          <div id="dashboardContent"></div>
        </section>

        <!-- Loading Overlay -->
        <div class="alarms-loading-overlay ${state.isLoading ? 'active' : ''}" id="loadingOverlay">
          <div class="alarms-spinner"></div>
          <span class="alarms-loading-text">Carregando alarmes...</span>
        </div>
      </div>
    `;
  }

  /**
   * Build compact inline list header (filters + bulk actions button)
   */
  private buildListHeaderTemplate(state: AlarmsNotificationsPanelState): string {
    const sel = this.selectedTitles.size;
    const isCard = this.viewMode === 'card';
    const isList = this.viewMode === 'list';
    const isConsol = this.groupMode === 'consolidado';
    const isSep = this.groupMode === 'separado';
    const filterCount = this.getActiveFilterCount(state.filters);

    return `
      <div class="alarms-list-header">
        <div class="alarms-search-wrap">
          <span class="alarms-search-icon">🔍</span>
          <input type="text" id="searchInput" placeholder="Buscar alarmes..." value="${state.filters.search || ''}">
        </div>
        <button class="alarms-filter-btn" id="filterBtn" title="Filtros avançados">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>
          Filtros
          <span class="alarms-filter-count" id="filterCount"${filterCount === 0 ? ' style="display:none"' : ''}>${filterCount}</span>
        </button>
        <button class="alarms-clear-filters" id="clearFiltersBtn" title="Limpar filtros">✕</button>
        <button class="alarms-bulk-btn" id="bulkActionsBtn" ${sel === 0 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>
          Ações em Lote
          <span class="alarms-bulk-count" id="bulkCount"${sel === 0 ? ' style="display:none"' : ''}>${sel}</span>
        </button>

        <div class="alarms-view-toggle" role="group" aria-label="Modo de visualização">
          <button class="alarms-view-btn${isCard ? ' is-active' : ''}" data-view="card" title="Cards">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"/></svg>
          </button>
          <button class="alarms-view-btn${isList ? ' is-active' : ''}" data-view="list" title="Lista">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
          </button>
        </div>

        <div class="alarms-group-toggle" role="group" aria-label="Modo de agrupamento">
          <button class="alarms-group-btn${isConsol ? ' is-active' : ''}" data-group-mode="consolidado" title="Agrupar alarmes do mesmo tipo">Consol.</button>
          <button class="alarms-group-btn${isSep ? ' is-active' : ''}" data-group-mode="separado" title="Um item por dispositivo">Separ.</button>
        </div>

        <button class="alarms-export-btn" id="exportBtn" title="Exportar dados">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Exportar
        </button>
      </div>
    `;
  }

  // =====================================================================
  // Event Binding
  // =====================================================================

  /**
   * Bind all event listeners
   */
  private bindEvents(): void {
    if (!this.root) return;

    // Tab buttons
    const tabButtons = this.root.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).getAttribute('data-tab') as AlarmsTab;
        this.controller.setActiveTab(tab);
      });
    });

    // Search input
    const searchInput = this.root.querySelector('#searchInput') as HTMLInputElement;
    if (searchInput) {
      let debounceTimer: ReturnType<typeof setTimeout>;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.controller.setSearchTerm((e.target as HTMLInputElement).value);
        }, 300);
      });
    }

    // Filter modal button
    this.root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('#filterBtn')) this.openFilterModal();
    });

    // Clear filters button
    const clearBtn = this.root.querySelector('#clearFiltersBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.controller.clearFilters();
        if (searchInput) searchInput.value = '';
        this.updateFilterBadge();
      });
    }

    // Delegated listeners for card custom events (snooze / escalate)
    this.root.addEventListener('alarm-snooze', (e) => {
      const detail = (e as CustomEvent).detail as { alarmId?: string };
      if (detail?.alarmId) this.openAlarmActionModal('snooze', detail.alarmId);
    });
    this.root.addEventListener('alarm-escalate', (e) => {
      const detail = (e as CustomEvent).detail as { alarmId?: string };
      if (detail?.alarmId) this.openAlarmActionModal('escalate', detail.alarmId);
    });

    // Bulk actions button
    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('#bulkActionsBtn');
      if (btn && !(btn as HTMLButtonElement).disabled) this.openBulkActionPicker();
    });

    // View toggle (CARD | LIST)
    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-view]') as HTMLElement | null;
      if (!btn) return;
      const view = btn.getAttribute('data-view') as 'card' | 'list';
      if (view === this.viewMode) return;
      this.viewMode = view;
      // Update active state on toggle buttons
      this.root?.querySelectorAll('.alarms-view-btn').forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-view') === view);
      });
      const state = this.controller.getState();
      this.renderListContent(state);
    });

    // Group toggle (CONSOLIDADO | SEPARADO)
    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-group-mode]') as HTMLElement | null;
      if (!btn) return;
      const mode = btn.getAttribute('data-group-mode') as 'consolidado' | 'separado';
      if (mode === this.groupMode) return;
      this.groupMode = mode;
      this.selectedTitles.clear();
      this.root?.querySelectorAll('.alarms-group-btn').forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-group-mode') === mode);
      });
      const state = this.controller.getState();
      this.renderListContent(state);
    });

    // Export button
    this.root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('#exportBtn')) this.openExportModal();
    });

    // Delegated checkbox change (works for both card grid and table view)
    this.root.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.type !== 'checkbox' || !input.classList.contains('alarm-card-select')) return;
      const title = input.dataset.alarmTitle;
      if (!title) return;
      if (input.checked) this.selectedTitles.add(title);
      else this.selectedTitles.delete(title);
      // Visual: card highlight
      const card = input.closest('.alarm-card');
      if (card) card.classList.toggle('alarm-card--selected', input.checked);
      // Visual: table row highlight
      const row = input.closest('.atbl-row');
      if (row) row.classList.toggle('atbl-row--selected', input.checked);
      this.updateBulkButton();
    });

    // Delegated "select all" in table header
    this.root.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.id !== 'tblSelectAll') return;
      if (input.checked) {
        this.groupedAlarms.forEach((a) => this.selectedTitles.add(a.title));
      } else {
        this.groupedAlarms.forEach((a) => this.selectedTitles.delete(a.title));
      }
      // Sync all row checkboxes
      this.root?.querySelectorAll<HTMLInputElement>('.alarm-card-select').forEach((cb) => {
        cb.checked = input.checked;
      });
      this.root?.querySelectorAll('.atbl-row').forEach((row) => {
        row.classList.toggle('atbl-row--selected', input.checked);
      });
      this.updateBulkButton();
    });

    // Delegated table row action buttons (ack / snooze / escalate / details)
    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-action][data-alarm-id]') as HTMLElement | null;
      if (!btn || !btn.closest('.atbl-row')) return; // only table rows (cards handled individually)
      e.stopPropagation();
      const action = btn.getAttribute('data-action');
      const alarmId = btn.getAttribute('data-alarm-id')!;
      if (action === 'acknowledge') this.openAlarmActionModal('acknowledge', alarmId);
      else if (action === 'snooze') this.openAlarmActionModal('snooze', alarmId);
      else if (action === 'escalate') this.openAlarmActionModal('escalate', alarmId);
      else if (action === 'details') this.handleDetails(alarmId);
    });

    // Delegated table row click (open details)
    this.root.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest('.atbl-row') as HTMLElement | null;
      if (!row) return;
      if ((e.target as HTMLElement).closest('button, input, label')) return;
      const alarmId = row.getAttribute('data-alarm-id');
      if (!alarmId) return;
      const alarm = this.groupedAlarms.find((a) => a.id === alarmId);
      if (alarm) this.handleAlarmClick(alarm);
    });
  }

  // =====================================================================
  // State Change Handler
  // =====================================================================

  /**
   * Handle state changes from controller
   */
  private handleStateChange(state: AlarmsNotificationsPanelState): void {
    this.log('State changed', state);

    if (!this.root) return;

    // Update theme
    this.root.setAttribute('data-theme', state.themeMode);

    // Update active tab
    this.updateActiveTab(state.activeTab);

    // Update filtered count
    const countEl = this.root.querySelector('[data-count="filtered"]');
    if (countEl) {
      countEl.textContent = String(state.filteredAlarms.length);
    }

    // Update loading state
    const loadingOverlay = this.root.querySelector('#loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.toggle('active', state.isLoading);
    }

    // Update content based on tab
    if (state.activeTab === 'list') {
      this.renderListContent(state);
    } else {
      this.renderDashboardContent(state);
    }
  }

  /**
   * Update active tab styling
   */
  private updateActiveTab(activeTab: AlarmsTab): void {
    if (!this.root) return;

    // Update tab buttons
    const tabButtons = this.root.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn) => {
      const tab = btn.getAttribute('data-tab');
      btn.classList.toggle('active', tab === activeTab);
    });

    // Update tab content
    const tabContents = this.root.querySelectorAll('.tab-content');
    tabContents.forEach((content) => {
      const tab = content.getAttribute('data-tab-content');
      content.classList.toggle('active', tab === activeTab);
    });

    this.emit('tab-change', activeTab);
  }

  // =====================================================================
  // Content Rendering
  // =====================================================================

  /**
   * Render list tab content
   */
  private renderListContent(state: AlarmsNotificationsPanelState): void {
    if (!this.root) return;

    const grid = this.root.querySelector('#alarmsGrid');
    const emptyState = this.root.querySelector('#alarmsEmpty') as HTMLElement;

    if (!grid) return;

    // Clear existing cards
    grid.innerHTML = '';

    if (state.filteredAlarms.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Group alarms by title (consolidado) or explode per device (separado), persist for bulk actions
    this.groupedAlarms = this.groupMode === 'consolidado'
      ? this.groupAlarmsByTitle(state.filteredAlarms)
      : this.explodeAlarmsByDevice(state.filteredAlarms);

    if (this.viewMode === 'list') {
      // Table view
      (grid as HTMLElement).className = 'alarms-table-container';
      (grid as HTMLElement).innerHTML = this.renderAlarmsTable(this.groupedAlarms);
    } else {
      // Card grid view
      (grid as HTMLElement).className = 'alarms-grid';
      this.groupedAlarms.forEach((alarm) => {
        const card = createAlarmCardElement(alarm, {
          onCardClick: (a) => this.handleAlarmClick(a),
          onAcknowledge: (id) => this.openAlarmActionModal('acknowledge', id),
          onDetails: (id) => this.handleDetails(id),
          onMore: (id, e) => this.handleMore(id, e),
          themeMode: state.themeMode,
          showCustomerName: this.params.showCustomerName ?? true,
          selected: this.selectedTitles.has(alarm.title),
        });
        grid.appendChild(card);
      });
    }

    this.emit('cards-rendered', this.groupedAlarms.length);
  }

  /**
   * Render dashboard tab content
   */
  private renderDashboardContent(state: AlarmsNotificationsPanelState): void {
    if (!this.root) return;

    const container = this.root.querySelector('#dashboardContent');
    if (!container) return;

    // Check if dashboard is already rendered
    if (container.children.length > 0) {
      // Update existing dashboard
      updateDashboard(container as HTMLElement, state.stats);
    } else {
      // Initial render
      container.innerHTML = renderDashboard(state.stats);
    }

    this.emit('stats-updated', state.stats);
  }

  // =====================================================================
  // Bulk Selection
  // =====================================================================

  private handleAlarmSelect(title: string, selected: boolean): void {
    if (selected) {
      this.selectedTitles.add(title);
    } else {
      this.selectedTitles.delete(title);
    }
    this.updateBulkButton();
  }

  private updateBulkButton(): void {
    if (!this.root) return;
    const btn = this.root.querySelector('#bulkActionsBtn') as HTMLButtonElement | null;
    const count = this.root.querySelector('#bulkCount') as HTMLElement | null;
    if (!btn || !count) return;
    const sel = this.selectedTitles.size;
    btn.disabled = sel === 0;
    count.textContent = String(sel);
    count.style.display = sel === 0 ? 'none' : '';
  }

  private getActiveFilterCount(filters: AlarmFilters): number {
    let count = 0;
    if (filters.severity?.length) count++;
    if (filters.state?.length) count++;
    if (filters.alarmType?.length) count++;
    if (filters.devices?.length) count++;
    return count;
  }

  private updateFilterBadge(): void {
    if (!this.root) return;
    const filters = this.controller.getFilters();
    const count = this.getActiveFilterCount(filters);
    const badge = this.root.querySelector('#filterCount') as HTMLElement | null;
    if (!badge) return;
    badge.textContent = String(count);
    badge.style.display = count === 0 ? 'none' : '';
  }

  private openFilterModal(): void {
    const state = this.controller.getState();
    const filters = state.filters as AlarmFilters;

    // Extract unique alarm types from all alarms
    const alarmTypes = [...new Set(state.allAlarms.map((a) => a.title).filter(Boolean))].sort();

    // Extract unique devices from alarm.source (comma-separated)
    const deviceSet = new Set<string>();
    state.allAlarms.forEach((a) => {
      if (a.source) {
        a.source.split(',').map((s) => s.trim()).filter(Boolean).forEach((d) => deviceSet.add(d));
      }
    });
    const allDevices = [...deviceSet].sort();

    // When no filter is active for a group, treat all options as selected (show-all default)
    const allSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    const allStates     = ['OPEN', 'ACK', 'SNOOZED', 'ESCALATED', 'CLOSED'];
    const selSeverity  = new Set<string>(filters.severity?.length  ? filters.severity  : allSeverities);
    const selState     = new Set<string>(filters.state?.length     ? filters.state     : allStates);
    const selAlarmType = new Set<string>(filters.alarmType?.length ? filters.alarmType : alarmTypes);
    const selDevices   = new Set<string>(filters.devices?.length   ? filters.devices   : allDevices);

    const severityChips = (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as AlarmSeverity[])
      .map((s) => {
        const cfg = SEVERITY_CONFIG[s];
        const checked = selSeverity.has(s);
        return `<div class="afm-chip${checked ? ' is-checked' : ''}" data-group="severity" data-value="${s}">${cfg.icon} ${cfg.label}</div>`;
      }).join('');

    const stateChips = (['OPEN', 'ACK', 'SNOOZED', 'ESCALATED', 'CLOSED'] as AlarmState[])
      .map((s) => {
        const cfg = STATE_CONFIG[s];
        const checked = selState.has(s);
        return `<div class="afm-chip${checked ? ' is-checked' : ''}" data-group="state" data-value="${s}">${cfg.label}</div>`;
      }).join('');

    const alarmTypeChips = alarmTypes.length > 0
      ? alarmTypes.map((t) => {
          const checked = selAlarmType.has(t);
          const esc = this.esc(t);
          return `<div class="afm-chip${checked ? ' is-checked' : ''}" data-group="alarmType" data-value="${esc}">${esc}</div>`;
        }).join('')
      : '<span class="afm-empty">Nenhum tipo encontrado</span>';

    const deviceChips = allDevices.length > 0
      ? allDevices.map((d) => {
          const checked = selDevices.has(d);
          const esc = this.esc(d);
          return `<div class="afm-chip${checked ? ' is-checked' : ''}" data-group="devices" data-value="${esc}">${esc}</div>`;
        }).join('')
      : '<span class="afm-empty">Nenhum dispositivo encontrado</span>';

    const overlay = document.createElement('div');
    overlay.className = 'afm-overlay';
    overlay.innerHTML = `
      <div class="afm-modal" role="dialog" aria-modal="true" aria-label="Filtros avançados">
        <div class="afm-header">
          <span class="afm-title">Filtros</span>
          <button class="afm-close" aria-label="Fechar">✕</button>
        </div>
        <div class="afm-body">
          <div class="afm-section">
            <div class="afm-section-label">Severidade</div>
            <div class="afm-chips" data-group="severity">${severityChips}</div>
          </div>
          <div class="afm-section">
            <div class="afm-section-label">Estado</div>
            <div class="afm-chips" data-group="state">${stateChips}</div>
          </div>
          <div class="afm-section">
            <div class="afm-section-label">Tipo de Alarme</div>
            <div class="afm-chips afm-chips--scroll" data-group="alarmType">${alarmTypeChips}</div>
          </div>
          <div class="afm-section">
            <div class="afm-section-label">Dispositivos</div>
            <div class="afm-chips afm-chips--scroll" data-group="devices">${deviceChips}</div>
          </div>
        </div>
        <div class="afm-footer">
          <button class="afm-btn-clear" id="afmClearBtn">Limpar filtros</button>
          <button class="afm-btn-apply" id="afmApplyBtn">Aplicar</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelector('.afm-close')!.addEventListener('click', close);

    overlay.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest('.afm-chip') as HTMLElement | null;
      if (!chip) return;
      chip.classList.toggle('is-checked');
    });

    overlay.querySelector('#afmClearBtn')!.addEventListener('click', () => {
      overlay.querySelectorAll<HTMLElement>('.afm-chip.is-checked').forEach((chip) => {
        chip.classList.remove('is-checked');
      });
    });

    overlay.querySelector('#afmApplyBtn')!.addEventListener('click', () => {
      const getGroup = (group: string): string[] =>
        [...overlay.querySelectorAll<HTMLElement>(`.afm-chip.is-checked[data-group="${group}"]`)]
          .map((el) => el.getAttribute('data-value') || '')
          .filter(Boolean);

      const severity = getGroup('severity') as AlarmSeverity[];
      const stateVal = getGroup('state') as AlarmState[];
      const alarmType = getGroup('alarmType');
      const devices = getGroup('devices');

      this.controller.setFilters({
        severity: severity.length ? severity : undefined,
        state: stateVal.length ? stateVal : undefined,
        alarmType: alarmType.length ? alarmType : undefined,
        devices: devices.length ? devices : undefined,
      });

      this.updateFilterBadge();
      close();
    });

    (this.root || document.body).appendChild(overlay);
  }

  // =====================================================================
  // Table View
  // =====================================================================

  private renderAlarmsTable(alarms: import('../../types/alarm').Alarm[]): string {
    const fmtDt = (iso: string | number | null | undefined): string => {
      if (!iso) return '-';
      const d = new Date(iso as string);
      if (isNaN(d.getTime())) return '-';
      return (
        String(d.getDate()).padStart(2, '0') + '/' +
        String(d.getMonth() + 1).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0')
      );
    };

    const rows = alarms.map((alarm) => {
      const sev = SEVERITY_CONFIG[alarm.severity];
      const st = STATE_CONFIG[alarm.state];
      const isActive = alarm.state !== 'CLOSED';
      const sel = this.selectedTitles.has(alarm.title);
      const escTitle = this.esc(alarm.title);
      const escCustomer = this.esc(alarm.customerName || '-');
      const escSource = this.esc(alarm.source || '-');

      const actionBtns = `
        ${alarm.state === 'OPEN' ? `<button class="atbl-btn atbl-btn--ack" data-action="acknowledge" data-alarm-id="${alarm.id}" title="Reconhecer"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>` : ''}
        ${isActive ? `<button class="atbl-btn atbl-btn--snooze" data-action="snooze" data-alarm-id="${alarm.id}" title="Adiar"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg></button>` : ''}
        ${isActive ? `<button class="atbl-btn atbl-btn--escalate" data-action="escalate" data-alarm-id="${alarm.id}" title="Escalar"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg></button>` : ''}
        <button class="atbl-btn atbl-btn--details" data-action="details" data-alarm-id="${alarm.id}" title="Detalhes"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></button>
      `;

      return `
        <tr class="atbl-row${sel ? ' atbl-row--selected' : ''}" data-alarm-id="${alarm.id}">
          <td class="atbl-cell atbl-cell--sel">
            <input type="checkbox" class="alarm-card-select" data-alarm-id="${alarm.id}" data-alarm-title="${escTitle}"${sel ? ' checked' : ''}>
          </td>
          <td class="atbl-cell atbl-cell--title" title="${escTitle}">${escTitle}</td>
          <td class="atbl-cell atbl-cell--sev">
            <span class="atbl-sev-badge" style="background:${sev.bg};color:${sev.text}">${sev.icon} ${sev.label}</span>
          </td>
          <td class="atbl-cell atbl-cell--state">
            <span class="alarm-state-badge" data-state="${alarm.state}">${st.label}</span>
          </td>
          <td class="atbl-cell atbl-cell--customer">${escCustomer}</td>
          <td class="atbl-cell atbl-cell--num">${alarm.occurrenceCount || 1}</td>
          <td class="atbl-cell atbl-cell--date">${fmtDt(alarm.firstOccurrence)}</td>
          <td class="atbl-cell atbl-cell--date">${fmtDt(alarm.lastOccurrence)}</td>
          <td class="atbl-cell atbl-cell--actions">${actionBtns}</td>
        </tr>`;
    }).join('');

    const allSelected = alarms.length > 0 && alarms.every((a) => this.selectedTitles.has(a.title));

    return `
      <table class="alarms-table" aria-label="Lista de alarmes">
        <thead>
          <tr class="atbl-head-row">
            <th class="atbl-th atbl-th--sel"><input type="checkbox" id="tblSelectAll"${allSelected ? ' checked' : ''}></th>
            <th class="atbl-th">Tipo</th>
            <th class="atbl-th">Severidade</th>
            <th class="atbl-th">Estado</th>
            <th class="atbl-th">Shopping</th>
            <th class="atbl-th atbl-th--num">Qte.</th>
            <th class="atbl-th atbl-th--date">1a Ocorrência</th>
            <th class="atbl-th atbl-th--date">Últ. Ocorrência</th>
            <th class="atbl-th atbl-th--actions">Ações</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // =====================================================================
  // Export
  // =====================================================================

  private openExportModal(): void {
    const count = this.groupedAlarms.length;

    const overlay = document.createElement('div');
    overlay.className = 'aex-overlay';
    overlay.innerHTML = `
      <div class="aex-modal" role="dialog" aria-modal="true">
        <div class="aex-header">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="aex-icon"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          <span class="aex-title">Exportar Alarmes</span>
        </div>
        <div class="aex-body">
          <div class="aex-info">${count} alarme${count !== 1 ? 's' : ''} (filtros aplicados)</div>
          <div class="aex-formats">
            <button class="aex-fmt-btn" id="aexPdf">
              <span class="aex-fmt-icon">📄</span>
              <span class="aex-fmt-label">PDF</span>
              <span class="aex-fmt-desc">Impressão / PDF</span>
            </button>
            <button class="aex-fmt-btn" id="aexExcel">
              <span class="aex-fmt-icon">📊</span>
              <span class="aex-fmt-label">Excel</span>
              <span class="aex-fmt-desc">Planilha .xls</span>
            </button>
            <button class="aex-fmt-btn" id="aexCsv">
              <span class="aex-fmt-icon">📋</span>
              <span class="aex-fmt-label">CSV</span>
              <span class="aex-fmt-desc">Arquivo .csv</span>
            </button>
          </div>
        </div>
        <div class="aex-footer">
          <button class="aex-cancel" id="aexCancel">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('aex-overlay--visible'));

    const close = () => {
      overlay.classList.remove('aex-overlay--visible');
      setTimeout(() => overlay.remove(), 220);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#aexCancel')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#aexCsv')?.addEventListener('click', () => {
      this.exportToCsv();
      close();
    });
    overlay.querySelector('#aexExcel')?.addEventListener('click', () => {
      this.exportToExcel();
      close();
    });
    overlay.querySelector('#aexPdf')?.addEventListener('click', () => {
      this.exportToPdf();
      close();
    });
  }

  private getCsvRows(): string[][] {
    const header = ['Tipo', 'Severidade', 'Estado', 'Shopping', 'Fonte', 'Qte.', '1a Ocorrência', 'Últ. Ocorrência'];
    const fmtDt = (iso: string | number | null | undefined): string => {
      if (!iso) return '';
      const d = new Date(iso as string);
      return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR');
    };
    const dataRows = this.groupedAlarms.map((a) => [
      a.title || '',
      a.severity,
      a.state,
      a.customerName || '',
      a.source || '',
      String(a.occurrenceCount || 1),
      fmtDt(a.firstOccurrence),
      fmtDt(a.lastOccurrence),
    ]);
    return [header, ...dataRows];
  }

  private exportToCsv(): void {
    const rows = this.getCsvRows();
    const BOM = '\uFEFF';
    const csv = BOM + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    this.triggerDownload(csv, 'alarmes.csv', 'text/csv;charset=utf-8;');
  }

  private exportToExcel(): void {
    const rows = this.getCsvRows();
    // HTML table that Excel opens natively
    const htmlTable = `<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"><style>td,th{border:1px solid #ccc;padding:4px 8px;font-size:11px;}th{background:#7c3aed;color:#fff;}</style></head>
<body><table>${rows.map((r, i) => `<tr>${r.map((c) => i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</table></body>
</html>`;
    this.triggerDownload(htmlTable, 'alarmes.xls', 'application/vnd.ms-excel;charset=utf-8;');
  }

  private exportToPdf(): void {
    // Build a print-friendly page in a new window
    const rows = this.getCsvRows();
    const tableHtml = `<table style="width:100%;border-collapse:collapse;font-size:11px;">
      ${rows.map((r, i) => `<tr>${r.map((c) => i === 0
        ? `<th style="background:#7c3aed;color:#fff;padding:5px 8px;border:1px solid #555;">${c}</th>`
        : `<td style="padding:4px 8px;border:1px solid #ddd;">${c}</td>`
      ).join('')}</tr>`).join('')}
    </table>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Alarmes</title>
      <style>body{font-family:sans-serif;padding:16px;}h2{font-size:14px;margin-bottom:8px;}@media print{button{display:none}}</style>
    </head><body>
      <h2>Relatório de Alarmes</h2>
      ${tableHtml}
      <br><button onclick="window.print()">Imprimir / Salvar PDF</button>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  private triggerDownload(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  private openBulkActionPicker(): void {
    if (this.selectedTitles.size === 0) return;

    const selected = this.groupedAlarms.filter((a) => this.selectedTitles.has(a.title));
    const count = selected.length;

    const listHtml = selected
      .slice(0, 5)
      .map((a) => `<li class="abm-alarm-item">${this.esc(a.title)}</li>`)
      .join('');
    const moreHtml =
      count > 5 ? `<li class="abm-alarm-item abm-alarm-more">+${count - 5} mais...</li>` : '';

    const overlay = document.createElement('div');
    overlay.className = 'abm-overlay';
    overlay.innerHTML = `
      <div class="abm-modal" role="dialog" aria-modal="true">
        <div class="abm-header">
          <span class="abm-icon">⚡</span>
          <span class="abm-title">Ações em Lote</span>
        </div>
        <div class="abm-body">
          <div class="abm-count">${count} alarme${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}</div>
          <ul class="abm-alarm-list">${listHtml}${moreHtml}</ul>
          <div class="abm-action-label">Escolha a ação:</div>
          <div class="abm-actions">
            <button class="abm-action-btn abm-action-btn--ack" data-bulk-action="acknowledge">
              <span class="abm-action-icon">✅</span>
              <span>Reconhecer</span>
            </button>
            <button class="abm-action-btn abm-action-btn--snooze" data-bulk-action="snooze">
              <span class="abm-action-icon">⏰</span>
              <span>Adiar</span>
            </button>
            <button class="abm-action-btn abm-action-btn--escalate" data-bulk-action="escalate">
              <span class="abm-action-icon">⬆️</span>
              <span>Escalar</span>
            </button>
          </div>
        </div>
        <div class="abm-footer">
          <button class="abm-cancel" id="abmCancel">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('abm-overlay--visible'));

    const close = () => {
      overlay.classList.remove('abm-overlay--visible');
      setTimeout(() => overlay.remove(), 220);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#abmCancel')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelectorAll('[data-bulk-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-bulk-action') as 'acknowledge' | 'snooze' | 'escalate';
        close();
        this.openBulkActionModal(action, selected);
      });
    });
  }

  private openBulkActionModal(
    type: 'acknowledge' | 'snooze' | 'escalate',
    selectedAlarms: import('../../types/alarm').Alarm[]
  ): void {
    const count = selectedAlarms.length;

    type ModalConfig = {
      title: string;
      icon: string;
      confirmLabel: string;
      confirmColor: string;
      textLabel: string;
      textRequired: boolean;
      showDuration: boolean;
    };

    const CONFIG: Record<'acknowledge' | 'snooze' | 'escalate', ModalConfig> = {
      acknowledge: {
        title: 'Reconhecer em Lote',
        icon: '✅',
        confirmLabel: 'Reconhecer todos',
        confirmColor: '#16a34a',
        textLabel: 'Justificativa (opcional)',
        textRequired: false,
        showDuration: false,
      },
      snooze: {
        title: 'Adiar em Lote',
        icon: '⏰',
        confirmLabel: 'Adiar todos',
        confirmColor: '#d97706',
        textLabel: 'Motivo do adiamento (opcional)',
        textRequired: false,
        showDuration: true,
      },
      escalate: {
        title: 'Escalar em Lote',
        icon: '⬆️',
        confirmLabel: 'Escalar todos',
        confirmColor: '#dc2626',
        textLabel: 'Justificativa de escalamento',
        textRequired: true,
        showDuration: false,
      },
    };
    const cfg = CONFIG[type];

    // Summary list of selected alarms
    const listHtml = selectedAlarms
      .slice(0, 5)
      .map((a) => {
        const sev = SEVERITY_CONFIG[a.severity];
        return `<div class="aam-alarm-item"><span class="aam-alarm-sev" style="background:${sev.bg};color:${sev.text}">${sev.icon}</span><span>${this.esc(a.title)}</span></div>`;
      })
      .join('');
    const moreHtml = count > 5
      ? `<div class="aam-alarm-more">+${count - 5} alarmes</div>`
      : '';

    const durationHtml = cfg.showDuration
      ? `<div class="aam-field-group">
           <label class="alarm-action-modal__label">Duração do adiamento</label>
           <select class="alarm-action-modal__select" id="aamDuration">
             <option value="30">30 minutos</option>
             <option value="60" selected>1 hora</option>
             <option value="120">2 horas</option>
             <option value="240">4 horas</option>
             <option value="480">8 horas</option>
             <option value="1440">24 horas</option>
           </select>
         </div>`
      : '';

    const overlay = document.createElement('div');
    overlay.className = 'alarm-action-modal-overlay';
    overlay.innerHTML = `
      <div class="alarm-action-modal" role="dialog" aria-modal="true">
        <div class="alarm-action-modal__header">
          <span class="alarm-action-modal__icon">${cfg.icon}</span>
          <span class="alarm-action-modal__title">${cfg.title}</span>
        </div>
        <div class="aam-summary">
          <div class="aam-summary-header-label">${count} alarme${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}</div>
          <div class="aam-alarm-list-bulk">${listHtml}${moreHtml}</div>
        </div>
        <div class="alarm-action-modal__body">
          ${durationHtml}
          <div class="aam-field-group">
            <label class="alarm-action-modal__label${cfg.textRequired ? ' alarm-action-modal__label--required' : ''}">${cfg.textLabel}</label>
            <textarea class="alarm-action-modal__textarea" id="aamText" placeholder="Digite aqui..." maxlength="500" rows="3"></textarea>
            <div class="alarm-action-modal__char-count"><span id="aamCharCount">0</span>/500</div>
          </div>
        </div>
        <div class="alarm-action-modal__footer">
          <button class="alarm-action-modal__btn alarm-action-modal__btn--cancel" id="aamCancel">Cancelar</button>
          <button class="alarm-action-modal__btn alarm-action-modal__btn--confirm" id="aamConfirm"
            style="background:${cfg.confirmColor}"
            ${cfg.textRequired ? 'disabled' : ''}>${cfg.confirmLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('alarm-action-modal-overlay--visible'));

    const textarea = overlay.querySelector('#aamText') as HTMLTextAreaElement;
    const confirmBtn = overlay.querySelector('#aamConfirm') as HTMLButtonElement;
    const cancelBtn = overlay.querySelector('#aamCancel') as HTMLButtonElement;
    const charCountEl = overlay.querySelector('#aamCharCount') as HTMLElement;

    textarea.focus();
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCountEl.textContent = String(len);
      if (cfg.textRequired) confirmBtn.disabled = len === 0;
    });

    const close = () => {
      overlay.classList.remove('alarm-action-modal-overlay--visible');
      setTimeout(() => overlay.remove(), 220);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirmAction();
    };
    document.addEventListener('keydown', onKey);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const confirmAction = () => {
      if (cfg.textRequired && !textarea.value.trim()) return;
      const durationSelect = overlay.querySelector('#aamDuration') as HTMLSelectElement | null;

      // Collect all real IDs (strip separado compound suffix), then call batch once
      const ids = selectedAlarms.map((alarm) => this.stripSeparadoId(alarm.id));
      if (type === 'acknowledge') {
        this.controller.handleAcknowledge(ids);
      } else if (type === 'escalate') {
        this.controller.handleEscalate(ids);
      } else if (type === 'snooze') {
        const minutes = parseInt(durationSelect?.value ?? '60', 10);
        const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        this.controller.handleSnooze(ids, until);
      }

      // Clear selection after bulk action
      this.selectedTitles.clear();
      this.updateBulkButton();

      close();
      this.emit(`alarm-${type}` as AlarmsEventType, selectedAlarms.map((a) => a.id));
    };

    confirmBtn.addEventListener('click', confirmAction);
  }

  /** Simple HTML escaper for inline use */
  private esc(s: string | null | undefined): string {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =====================================================================
  // Grouping
  // =====================================================================

  /**
   * Group alarms by title so the same alarm type appears as one card.
   * Aggregates: occurrenceCount (sum), firstOccurrence (min),
   * lastOccurrence (max), severity (highest), state (most active).
   */
  private groupAlarmsByTitle(alarms: Alarm[]): Alarm[] {
    const SEVERITY_ORDER: AlarmSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    const STATE_ORDER: AlarmState[] = ['OPEN', 'ESCALATED', 'ACK', 'SNOOZED', 'CLOSED'];

    const groups = new Map<string, Alarm[]>();
    for (const alarm of alarms) {
      const key = alarm.title;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(alarm);
    }

    return Array.from(groups.values()).map((group) => {
      // Representative = most recent by lastOccurrence (used for id and action calls)
      const sorted = [...group].sort(
        (a, b) => new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime()
      );
      const rep = sorted[0];

      const occurrenceCount = group.reduce((sum, a) => sum + (a.occurrenceCount || 1), 0);
      const firstOccurrence = group.reduce(
        (min, a) => (a.firstOccurrence < min ? a.firstOccurrence : min),
        group[0].firstOccurrence
      );
      const lastOccurrence = group.reduce(
        (max, a) => (a.lastOccurrence > max ? a.lastOccurrence : max),
        group[0].lastOccurrence
      );
      const severity = group.reduce<AlarmSeverity>(
        (best, a) =>
          SEVERITY_ORDER.indexOf(a.severity) < SEVERITY_ORDER.indexOf(best) ? a.severity : best,
        group[0].severity
      );
      const state = group.reduce<AlarmState>(
        (best, a) =>
          STATE_ORDER.indexOf(a.state) < STATE_ORDER.indexOf(best) ? a.state : best,
        group[0].state
      );

      const uniqueCustomers = new Set(group.map((a) => a.customerName));
      const customerName =
        uniqueCustomers.size === 1 ? rep.customerName : `${uniqueCustomers.size} shoppings`;

      const uniqueSources = new Set(group.map((a) => a.source));
      const source =
        uniqueSources.size === 1 ? rep.source : `${uniqueSources.size} dispositivos`;

      return { ...rep, occurrenceCount, firstOccurrence, lastOccurrence, severity, state, customerName, source };
    });
  }

  /**
   * Separado mode: one entry per (alarm × device).
   * Uses compound ID "uuid__DEVICE" when the alarm has multiple sources.
   */
  private explodeAlarmsByDevice(alarms: Alarm[]): Alarm[] {
    const result: Alarm[] = [];
    for (const alarm of alarms) {
      const devices = alarm.source
        ? alarm.source.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      if (devices.length <= 1) {
        result.push(alarm);
      } else {
        devices.forEach((dev) => {
          result.push({ ...alarm, id: `${alarm.id}__${dev}`, source: dev });
        });
      }
    }
    return result;
  }

  /** Strip the "__DEVICE" suffix from a separado compound ID to get the real alarm UUID. */
  private stripSeparadoId(id: string): string {
    const idx = id.indexOf('__');
    return idx === -1 ? id : id.slice(0, idx);
  }

  // =====================================================================
  // Alarm Actions
  // =====================================================================

  private handleAlarmClick(alarm: Alarm): void {
    this.log('Alarm clicked', alarm.id);
    this.controller.handleAlarmClick(alarm);
    this.emit('alarm-click', alarm);
  }

  private handleDetails(alarmId: string): void {
    this.log('Details', alarmId);
    // In separado mode alarmId may be a compound "uuid__DEVICE" — look in groupedAlarms first
    const alarm =
      this.groupedAlarms.find((a) => a.id === alarmId) ??
      this.controller.getAlarms().find((a) => a.id === this.stripSeparadoId(alarmId));
    if (alarm) {
      openAlarmDetailsModal(alarm);
      this.emit('alarm-click', alarm);
    }
  }

  private handleMore(alarmId: string, _event: MouseEvent): void {
    this.log('More options', alarmId);
  }

  // =====================================================================
  // Action Modal
  // =====================================================================

  private openAlarmActionModal(
    type: 'acknowledge' | 'snooze' | 'escalate',
    alarmId: string
  ): void {
    this.log('Opening action modal', type, alarmId);

    // ── Alarm data ──────────────────────────────────────────────────
    const alarm = this.controller.getAlarms().find((a) => a.id === alarmId);

    type ModalConfig = {
      title: string;
      icon: string;
      confirmLabel: string;
      confirmColor: string;
      textLabel: string;
      textRequired: boolean;
      showDuration: boolean;
    };

    const CONFIG: Record<'acknowledge' | 'snooze' | 'escalate', ModalConfig> = {
      acknowledge: {
        title: 'Reconhecer Alarme',
        icon: '✅',
        confirmLabel: 'Reconhecer',
        confirmColor: '#16a34a',
        textLabel: 'Justificativa (opcional)',
        textRequired: false,
        showDuration: false,
      },
      snooze: {
        title: 'Adiar Alarme',
        icon: '⏰',
        confirmLabel: 'Adiar',
        confirmColor: '#d97706',
        textLabel: 'Motivo do adiamento (opcional)',
        textRequired: false,
        showDuration: true,
      },
      escalate: {
        title: 'Escalar Alarme',
        icon: '⬆️',
        confirmLabel: 'Escalar',
        confirmColor: '#dc2626',
        textLabel: 'Justificativa de escalamento',
        textRequired: true,
        showDuration: false,
      },
    };

    const cfg = CONFIG[type];

    // ── Alarm summary card ──────────────────────────────────────────
    const fmtShort = (iso: string | number | null | undefined): string => {
      if (!iso) return '-';
      const d = new Date(iso as string);
      if (isNaN(d.getTime())) return '-';
      return (
        String(d.getDate()).padStart(2, '0') +
        '/' +
        String(d.getMonth() + 1).padStart(2, '0') +
        ' ' +
        String(d.getHours()).padStart(2, '0') +
        ':' +
        String(d.getMinutes()).padStart(2, '0')
      );
    };

    let summaryHtml = '';
    if (alarm) {
      const sev = SEVERITY_CONFIG[alarm.severity];
      const st = STATE_CONFIG[alarm.state];
      const count = alarm.occurrenceCount || 1;
      const tags = Object.entries(alarm.tags || {});
      const tagsHtml = tags
        .slice(0, 3)
        .map(([k, v]) => `<span class="aam-tag"><span class="aam-tag-key">${k}</span>: ${v}</span>`)
        .join('');
      const moreTagsHtml =
        tags.length > 3
          ? `<span class="aam-tag aam-tag-more">+${tags.length - 3}</span>`
          : '';

      summaryHtml = `
        <div class="aam-summary">
          <div class="aam-summary-header-label">Alarme a ser ${type === 'acknowledge' ? 'reconhecido' : type === 'snooze' ? 'adiado' : 'escalado'}</div>
          <div class="aam-summary-badges">
            <span class="aam-summary-sev" style="background:${sev.bg};color:${sev.text}">${sev.icon} ${sev.label}</span>
            <span class="aam-summary-state" style="color:${st.color}">● ${st.label}</span>
          </div>
          <div class="aam-summary-title">${alarm.title}</div>
          <div class="aam-summary-meta">
            <span title="Shopping/Cliente">🏢 ${alarm.customerName || '-'}</span>
            <span title="Dispositivo/Fonte" class="aam-summary-source">🔌 ${alarm.source}</span>
            <span title="Total de ocorrências">🔁 ${count} ocorrência${count !== 1 ? 's' : ''}</span>
          </div>
          <div class="aam-summary-dates">
            <span>1ª: <strong>${fmtShort(alarm.firstOccurrence)}</strong></span>
            <span>Últ.: <strong>${fmtShort(alarm.lastOccurrence)}</strong></span>
          </div>
          ${tags.length > 0 ? `<div class="aam-summary-tags">${tagsHtml}${moreTagsHtml}</div>` : ''}
        </div>`;
    }

    // ── Duration (snooze only) ──────────────────────────────────────
    const durationHtml = cfg.showDuration
      ? `<div class="aam-field-group">
           <label class="alarm-action-modal__label">Duração do adiamento</label>
           <select class="alarm-action-modal__select" id="aamDuration">
             <option value="30">30 minutos</option>
             <option value="60" selected>1 hora</option>
             <option value="120">2 horas</option>
             <option value="240">4 horas</option>
             <option value="480">8 horas</option>
             <option value="1440">24 horas</option>
           </select>
         </div>`
      : '';

    // ── Build overlay ───────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'alarm-action-modal-overlay';

    overlay.innerHTML = `
      <div class="alarm-action-modal" role="dialog" aria-modal="true">
        <div class="alarm-action-modal__header">
          <span class="alarm-action-modal__icon">${cfg.icon}</span>
          <span class="alarm-action-modal__title">${cfg.title}</span>
        </div>
        ${summaryHtml}
        <div class="alarm-action-modal__body">
          ${durationHtml}
          <div class="aam-field-group">
            <label class="alarm-action-modal__label${cfg.textRequired ? ' alarm-action-modal__label--required' : ''}">${cfg.textLabel}</label>
            <textarea class="alarm-action-modal__textarea" id="aamText" placeholder="Digite aqui..." maxlength="500" rows="3"></textarea>
            <div class="alarm-action-modal__char-count"><span id="aamCharCount">0</span>/500</div>
          </div>
        </div>
        <div class="alarm-action-modal__footer">
          <button class="alarm-action-modal__btn alarm-action-modal__btn--cancel" id="aamCancel">Cancelar</button>
          <button class="alarm-action-modal__btn alarm-action-modal__btn--confirm" id="aamConfirm"
            style="background:${cfg.confirmColor}"
            ${cfg.textRequired ? 'disabled' : ''}>${cfg.confirmLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('alarm-action-modal-overlay--visible'));

    const textarea = overlay.querySelector('#aamText') as HTMLTextAreaElement;
    const confirmBtn = overlay.querySelector('#aamConfirm') as HTMLButtonElement;
    const cancelBtn = overlay.querySelector('#aamCancel') as HTMLButtonElement;
    const charCountEl = overlay.querySelector('#aamCharCount') as HTMLElement;

    textarea.focus();

    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCountEl.textContent = String(len);
      if (cfg.textRequired) confirmBtn.disabled = len === 0;
    });

    const closeModal = () => {
      overlay.classList.remove('alarm-action-modal-overlay--visible');
      setTimeout(() => overlay.remove(), 220);
      document.removeEventListener('keydown', onKeyDown);
    };

    const confirmAction = () => {
      if (cfg.textRequired && !textarea.value.trim()) return;

      const ids = [this.stripSeparadoId(alarmId)];
      if (type === 'acknowledge') {
        this.controller.handleAcknowledge(ids);
        this.emit('alarm-acknowledge', alarmId);
      } else if (type === 'escalate') {
        this.controller.handleEscalate(ids);
        this.emit('alarm-escalate', alarmId);
      } else if (type === 'snooze') {
        const durationSelect = overlay.querySelector('#aamDuration') as HTMLSelectElement | null;
        const minutes = parseInt(durationSelect?.value ?? '60', 10);
        const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        this.controller.handleSnooze(ids, until);
        this.emit('alarm-snooze', alarmId);
      }

      closeModal();
    };

    confirmBtn.addEventListener('click', confirmAction);
    cancelBtn.addEventListener('click', closeModal);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirmAction();
    };
    document.addEventListener('keydown', onKeyDown);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // =====================================================================
  // Public Methods
  // =====================================================================

  /**
   * Apply theme mode
   */
  applyThemeMode(mode: ThemeMode): void {
    if (this.root) {
      this.root.setAttribute('data-theme', mode);
    }
  }

  /**
   * Show/hide loading overlay
   */
  showLoading(show: boolean): void {
    if (!this.root) return;
    const overlay = this.root.querySelector('#loadingOverlay');
    if (overlay) {
      overlay.classList.toggle('active', show);
    }
  }

  /**
   * Refresh the view
   */
  refresh(): void {
    const state = this.controller.getState();
    this.handleStateChange(state);
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.log('Destroying view');
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this.eventHandlers.clear();
  }

  // =====================================================================
  // Event System
  // =====================================================================

  /**
   * Register event handler
   */
  on(event: AlarmsEventType, handler: AlarmsEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove event handler
   */
  off(event: AlarmsEventType, handler: AlarmsEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event
   */
  private emit(event: AlarmsEventType, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // =====================================================================
  // Debug Logging
  // =====================================================================

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[AlarmsNotificationsPanelView]', ...args);
    }
  }
}
