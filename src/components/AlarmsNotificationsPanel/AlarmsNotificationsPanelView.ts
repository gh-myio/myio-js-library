/**
 * RFC-0152 Phase 4: Alarms Notifications Panel View
 * DOM rendering and event handling
 */

import type { Alarm, AlarmSeverity, AlarmState } from '../../types/alarm';
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
      </nav>

      <!-- Tab Content -->
      <div class="myio-alarms-content">
        <!-- List Tab -->
        <section class="tab-content ${state.activeTab === 'list' ? 'active' : ''}" data-tab-content="list">
          ${this.buildFiltersTemplate(state)}
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
   * Build filters template
   */
  private buildFiltersTemplate(state: AlarmsNotificationsPanelState): string {
    const currentSeverity = state.filters.severity?.[0] || '';
    const currentState = state.filters.state?.[0] || '';

    const severityOptions = (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as AlarmSeverity[])
      .map((s) => `<option value="${s}" ${currentSeverity === s ? 'selected' : ''}>${SEVERITY_CONFIG[s].icon} ${SEVERITY_CONFIG[s].label}</option>`)
      .join('');

    const stateOptions = (['OPEN', 'ACK', 'SNOOZED', 'ESCALATED', 'CLOSED'] as AlarmState[])
      .map((s) => `<option value="${s}" ${currentState === s ? 'selected' : ''}>${STATE_CONFIG[s].label}</option>`)
      .join('');

    return `
      <div class="alarms-filters">
        <div class="alarms-filter-group search">
          <label>Buscar</label>
          <div class="alarms-filter-input">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              id="searchInput"
              placeholder="Titulo, descricao, fonte..."
              value="${state.filters.search || ''}"
            />
          </div>
        </div>

        <div class="alarms-filter-group">
          <label>Severidade</label>
          <select class="alarms-filter-select" id="severityFilter">
            <option value="">Todas</option>
            ${severityOptions}
          </select>
        </div>

        <div class="alarms-filter-group">
          <label>Estado</label>
          <select class="alarms-filter-select" id="stateFilter">
            <option value="">Todos</option>
            ${stateOptions}
          </select>
        </div>

        <button class="alarms-clear-filters" id="clearFiltersBtn">
          Limpar Filtros
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

    // Severity filter
    const severityFilter = this.root.querySelector('#severityFilter') as HTMLSelectElement;
    if (severityFilter) {
      severityFilter.addEventListener('change', () => {
        const value = severityFilter.value;
        this.controller.setSeverityFilter(value ? [value as AlarmSeverity] : undefined);
      });
    }

    // State filter
    const stateFilter = this.root.querySelector('#stateFilter') as HTMLSelectElement;
    if (stateFilter) {
      stateFilter.addEventListener('change', () => {
        const value = stateFilter.value;
        this.controller.setStateFilter(value ? [value as AlarmState] : undefined);
      });
    }

    // Clear filters button
    const clearBtn = this.root.querySelector('#clearFiltersBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.controller.clearFilters();
        // Reset filter inputs
        if (searchInput) searchInput.value = '';
        if (severityFilter) severityFilter.value = '';
        if (stateFilter) stateFilter.value = '';
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

    // Render alarm cards
    state.filteredAlarms.forEach((alarm) => {
      const card = createAlarmCardElement(alarm, {
        onCardClick: (a) => this.handleAlarmClick(a),
        onAcknowledge: (id) => this.openAlarmActionModal('acknowledge', id),
        onDetails: (id) => this.handleDetails(id),
        onMore: (id, e) => this.handleMore(id, e),
        themeMode: state.themeMode,
        showCustomerName: this.params.showCustomerName ?? true,
      });
      grid.appendChild(card);
    });

    this.emit('cards-rendered', state.filteredAlarms.length);
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
  // Alarm Actions
  // =====================================================================

  private handleAlarmClick(alarm: Alarm): void {
    this.log('Alarm clicked', alarm.id);
    this.controller.handleAlarmClick(alarm);
    this.emit('alarm-click', alarm);
  }

  private handleDetails(alarmId: string): void {
    this.log('Details', alarmId);
    const alarm = this.controller.getAlarms().find((a) => a.id === alarmId);
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

      if (type === 'acknowledge') {
        this.controller.handleAcknowledge(alarmId);
        this.emit('alarm-acknowledge', alarmId);
      } else if (type === 'escalate') {
        this.controller.handleEscalate(alarmId);
        this.emit('alarm-escalate', alarmId);
      } else if (type === 'snooze') {
        const durationSelect = overlay.querySelector('#aamDuration') as HTMLSelectElement | null;
        const minutes = parseInt(durationSelect?.value ?? '60', 10);
        const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        this.controller.handleSnooze(alarmId, until);
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
