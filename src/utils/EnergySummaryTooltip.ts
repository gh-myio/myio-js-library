/**
 * EnergySummaryTooltip - Dashboard Energy Summary Tooltip Component
 * RFC-0105: Premium tooltip showing comprehensive energy dashboard summary
 *
 * Shows:
 * - Total device count
 * - Device counts by category (tree view)
 * - Consumption totals by category
 * - Device status breakdown (normal, alert, failure, standby, offline)
 *
 * @example
 * // Attach to an element
 * const cleanup = EnergySummaryTooltip.attach(triggerElement, getDataFn);
 * // Later: cleanup();
 *
 * // Or manual control
 * EnergySummaryTooltip.show(element, summaryData, event);
 * EnergySummaryTooltip.hide();
 */

// ============================================
// Types
// ============================================

export interface CategorySummary {
  id: string;
  name: string;
  icon: string;
  deviceCount: number;
  consumption: number;
  percentage: number;
  children?: CategorySummary[];
}

export interface StatusSummary {
  normal: number;
  alert: number;
  failure: number;
  standby: number;
  offline: number;
  noConsumption: number;
}

export interface DashboardEnergySummary {
  totalDevices: number;
  totalConsumption: number;
  unit: string;
  byCategory: CategorySummary[];
  byStatus: StatusSummary;
  lastUpdated: string;
}

// ============================================
// CSS Styles (injected once)
// ============================================

const ENERGY_SUMMARY_TOOLTIP_CSS = `
/* ============================================
   Energy Summary Tooltip (RFC-0105)
   Premium dashboard summary on hover
   ============================================ */
.energy-summary-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: translateY(8px);
}

.energy-summary-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
}

.energy-summary-tooltip.closing {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.energy-summary-tooltip__content {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08);
  width: max-content;
  max-width: 90vw;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: #1e293b;
}

.energy-summary-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(90deg, #ecfdf5 0%, #d1fae5 100%);
  border-bottom: 1px solid #6ee7b7;
  border-radius: 12px 12px 0 0;
  cursor: move;
  user-select: none;
}

.energy-summary-tooltip__icon {
  font-size: 18px;
}

.energy-summary-tooltip__title {
  font-weight: 700;
  font-size: 14px;
  color: #047857;
  flex: 1;
}

.energy-summary-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.energy-summary-tooltip__header-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  color: #64748b;
}

.energy-summary-tooltip__header-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  color: #1e293b;
}

.energy-summary-tooltip__header-btn.pinned {
  background: #047857;
  color: white;
}

.energy-summary-tooltip__header-btn.pinned:hover {
  background: #065f46;
  color: white;
}

.energy-summary-tooltip__header-btn svg {
  width: 14px;
  height: 14px;
}

.energy-summary-tooltip__timestamp {
  font-size: 10px;
  color: #6b7280;
  margin-right: 8px;
}

.energy-summary-tooltip__body {
  padding: 14px;
}

/* Maximized state */
.energy-summary-tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
}

.energy-summary-tooltip.maximized .energy-summary-tooltip__content {
  width: 100%;
  height: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
}

.energy-summary-tooltip.maximized .energy-summary-tooltip__body {
  flex: 1;
  overflow-y: auto;
}

/* Pinned state indicator */
.energy-summary-tooltip.pinned {
  box-shadow: 0 0 0 2px #047857, 0 10px 40px rgba(0, 0, 0, 0.2);
}

/* Dragging state */
.energy-summary-tooltip.dragging {
  transition: none !important;
  cursor: move;
}

/* Total Devices Banner */
.energy-summary-tooltip__total-devices {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid #e2e8f0;
}

.energy-summary-tooltip__total-devices-label {
  font-weight: 600;
  color: #475569;
  font-size: 12px;
}

.energy-summary-tooltip__total-devices-value {
  font-weight: 700;
  font-size: 20px;
  color: #1e293b;
}

/* Section Title */
.energy-summary-tooltip__section-title {
  font-weight: 700;
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 12px 0 6px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid #e2e8f0;
}

/* Category Tree */
.energy-summary-tooltip__category-tree {
  margin: 6px 0;
}

.energy-summary-tooltip__category-header {
  display: grid;
  grid-template-columns: 1fr 50px 80px;
  gap: 8px;
  padding: 4px 10px;
  font-size: 9px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.energy-summary-tooltip__category-row {
  display: grid;
  grid-template-columns: 1fr 50px 80px;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  align-items: center;
  transition: background-color 0.15s ease;
}

.energy-summary-tooltip__category-row:hover {
  background: #f8fafc;
}

.energy-summary-tooltip__category-row.parent {
  font-weight: 600;
  background: #fafafa;
}

.energy-summary-tooltip__category-row.child {
  padding-left: 28px;
  font-size: 11px;
  color: #64748b;
}

.energy-summary-tooltip__category-row.child::before {
  content: '';
  position: absolute;
  left: 18px;
  width: 8px;
  height: 1px;
  background: #cbd5e1;
}

.energy-summary-tooltip__category-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.energy-summary-tooltip__category-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
}

.energy-summary-tooltip__category-count {
  text-align: center;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
}

.energy-summary-tooltip__category-consumption {
  text-align: right;
  font-weight: 600;
  color: #059669;
  font-size: 11px;
}

/* Status Matrix */
.energy-summary-tooltip__status-matrix {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 6px 0 12px 0;
}

.energy-summary-tooltip__status-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
}

.energy-summary-tooltip__status-item.normal {
  background: #dcfce7;
  color: #15803d;
}

.energy-summary-tooltip__status-item.alert {
  background: #fef3c7;
  color: #b45309;
}

.energy-summary-tooltip__status-item.failure {
  background: #fee2e2;
  color: #b91c1c;
}

.energy-summary-tooltip__status-item.standby {
  background: #dbeafe;
  color: #1d4ed8;
}

.energy-summary-tooltip__status-item.offline {
  background: #f3f4f6;
  color: #6b7280;
}

.energy-summary-tooltip__status-item.no-consumption {
  background: #f8fafc;
  color: #9ca3af;
  border: 1px dashed #e2e8f0;
}

.energy-summary-tooltip__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.energy-summary-tooltip__status-dot.normal { background: #22c55e; }
.energy-summary-tooltip__status-dot.alert { background: #f59e0b; }
.energy-summary-tooltip__status-dot.failure { background: #ef4444; }
.energy-summary-tooltip__status-dot.standby { background: #3b82f6; }
.energy-summary-tooltip__status-dot.offline { background: #6b7280; }
.energy-summary-tooltip__status-dot.no-consumption { background: #d1d5db; }

.energy-summary-tooltip__status-count {
  font-size: 12px;
  font-weight: 700;
}

.energy-summary-tooltip__status-label {
  font-size: 9px;
  opacity: 0.85;
}

/* Total Consumption Footer */
.energy-summary-tooltip__total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(135deg, #047857 0%, #059669 100%);
  margin: 12px -14px -14px;
  border-radius: 0 0 12px 12px;
}

.energy-summary-tooltip__total-label {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
}

.energy-summary-tooltip__total-value {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .energy-summary-tooltip__content {
    min-width: 360px;
    max-width: 95vw;
  }

  .energy-summary-tooltip__status-matrix {
    grid-template-columns: repeat(2, 1fr);
  }
}
`;

// ============================================
// CSS Injection Helper
// ============================================

let cssInjected = false;

function injectCSS(): void {
  if (cssInjected) return;
  if (typeof document === 'undefined') return;

  const styleId = 'myio-energy-summary-tooltip-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = ENERGY_SUMMARY_TOOLTIP_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ============================================
// Category Icons
// ============================================

const CATEGORY_ICONS: Record<string, string> = {
  entrada: '📥',
  lojas: '🏪',
  climatizacao: '❄️',
  elevadores: '🛗',
  escadas: '🎢',
  escadasRolantes: '🎢',
  chillers: '🧊',
  fancoils: '💨',
  bombas: '💧',
  cag: '🌡️',
  outros: '⚙️',
  areaComum: '🏢',
};

// ============================================
// Helper Functions
// ============================================

/**
 * Format consumption value with appropriate unit
 */
function formatConsumption(value: number, unit: string = 'kWh'): string {
  if (value == null || isNaN(value)) return '0,00 ' + unit;

  // Convert to MWh if large
  if (unit === 'kWh' && value >= 1000) {
    return (value / 1000).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' MWh';
  }

  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ' + unit;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// ============================================
// EnergySummaryTooltip Object
// ============================================

export const EnergySummaryTooltip = {
  containerId: 'myio-energy-summary-tooltip',

  /**
   * Create or get the tooltip container
   */
  getContainer(): HTMLElement {
    injectCSS();

    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'energy-summary-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Render category tree rows
   */
  renderCategoryTree(categories: CategorySummary[], unit: string): string {
    let html = '';

    categories.forEach(cat => {
      const icon = CATEGORY_ICONS[cat.id] || CATEGORY_ICONS.outros;
      const isParent = cat.children && cat.children.length > 0;

      html += `
        <div class="energy-summary-tooltip__category-row ${isParent ? 'parent' : ''}">
          <span class="energy-summary-tooltip__category-name">
            <span class="energy-summary-tooltip__category-icon">${icon}</span>
            <span>${cat.name}</span>
          </span>
          <span class="energy-summary-tooltip__category-count">${cat.deviceCount}</span>
          <span class="energy-summary-tooltip__category-consumption">${formatConsumption(cat.consumption, unit)}</span>
        </div>
      `;

      // Render children (subcategories)
      if (cat.children && cat.children.length > 0) {
        cat.children.forEach(child => {
          const childIcon = CATEGORY_ICONS[child.id] || '•';
          html += `
            <div class="energy-summary-tooltip__category-row child">
              <span class="energy-summary-tooltip__category-name">
                <span class="energy-summary-tooltip__category-icon">${childIcon}</span>
                <span>${child.name}</span>
              </span>
              <span class="energy-summary-tooltip__category-count">${child.deviceCount}</span>
              <span class="energy-summary-tooltip__category-consumption">${formatConsumption(child.consumption, unit)}</span>
            </div>
          `;
        });
      }
    });

    return html;
  },

  /**
   * Render status matrix
   */
  renderStatusMatrix(status: StatusSummary): string {
    const items = [
      { key: 'normal', label: 'Normal', count: status.normal },
      { key: 'alert', label: 'Alerta', count: status.alert },
      { key: 'failure', label: 'Falha', count: status.failure },
      { key: 'standby', label: 'Standby', count: status.standby },
      { key: 'offline', label: 'Offline', count: status.offline },
      { key: 'no-consumption', label: 'Sem Dados', count: status.noConsumption },
    ];

    return items.map(item => `
      <div class="energy-summary-tooltip__status-item ${item.key}">
        <span class="energy-summary-tooltip__status-dot ${item.key}"></span>
        <span class="energy-summary-tooltip__status-count">${item.count}</span>
        <span class="energy-summary-tooltip__status-label">${item.label}</span>
      </div>
    `).join('');
  },

  /**
   * Render full tooltip HTML
   */
  renderHTML(summary: DashboardEnergySummary): string {
    const categoryRows = this.renderCategoryTree(summary.byCategory, summary.unit);
    const statusMatrix = this.renderStatusMatrix(summary.byStatus);
    const timestamp = formatTimestamp(summary.lastUpdated);

    return `
      <div class="energy-summary-tooltip__content">
        <div class="energy-summary-tooltip__header" data-drag-handle>
          <span class="energy-summary-tooltip__icon">⚡</span>
          <span class="energy-summary-tooltip__title">Resumo do Dashboard</span>
          ${timestamp ? `<span class="energy-summary-tooltip__timestamp">${timestamp}</span>` : ''}
          <div class="energy-summary-tooltip__header-actions">
            <button class="energy-summary-tooltip__header-btn" data-action="pin" title="Fixar na tela">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
                <line x1="12" y1="16" x2="12" y2="21"/>
                <line x1="8" y1="4" x2="16" y2="4"/>
              </svg>
            </button>
            <button class="energy-summary-tooltip__header-btn" data-action="maximize" title="Maximizar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>
            <button class="energy-summary-tooltip__header-btn" data-action="close" title="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="energy-summary-tooltip__body">
          <div class="energy-summary-tooltip__total-devices">
            <span class="energy-summary-tooltip__total-devices-label">Total de Dispositivos</span>
            <span class="energy-summary-tooltip__total-devices-value">${summary.totalDevices}</span>
          </div>

          <div class="energy-summary-tooltip__section-title">Distribuicao por Categoria</div>
          <div class="energy-summary-tooltip__category-tree">
            <div class="energy-summary-tooltip__category-header">
              <span>Categoria</span>
              <span>Qtd</span>
              <span>Consumo</span>
            </div>
            ${categoryRows}
          </div>

          <div class="energy-summary-tooltip__section-title">Status dos Dispositivos</div>
          <div class="energy-summary-tooltip__status-matrix">
            ${statusMatrix}
          </div>
        </div>
        <div class="energy-summary-tooltip__total">
          <span class="energy-summary-tooltip__total-label">Consumo Total</span>
          <span class="energy-summary-tooltip__total-value">${formatConsumption(summary.totalConsumption, summary.unit)}</span>
        </div>
      </div>
    `;
  },

  // Timer for delayed hide
  _hideTimer: null as ReturnType<typeof setTimeout> | null,
  _isMouseOverTooltip: false,

  // State for maximize and drag (PIN creates clones instead of toggling state)
  _isMaximized: false,
  _isDragging: false,
  _dragOffset: { x: 0, y: 0 },
  _savedPosition: null as { left: string; top: string } | null,

  /**
   * Show tooltip for an element
   */
  show(triggerElement: HTMLElement, summary: DashboardEnergySummary, event?: MouseEvent): void {
    // Cancel any pending hide
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }

    const container = this.getContainer();
    container.classList.remove('closing');
    container.innerHTML = this.renderHTML(summary);

    // Position tooltip near the trigger element (not following mouse)
    const rect = triggerElement.getBoundingClientRect();
    let left = rect.right + 12;
    let top = rect.top;

    // Adjust for viewport bounds
    const tooltipRect = container.getBoundingClientRect();
    const tooltipWidth = 400;
    const tooltipHeight = 450;

    // If tooltip goes off right edge, show on left side of trigger
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = rect.left - tooltipWidth - 12;
    }
    // If still off screen, center it
    if (left < 16) {
      left = Math.max(16, (window.innerWidth - tooltipWidth) / 2);
    }

    // Vertical adjustment
    if (top + tooltipHeight > window.innerHeight - 16) {
      top = window.innerHeight - tooltipHeight - 16;
    }
    if (top < 16) top = 16;

    container.style.left = left + 'px';
    container.style.top = top + 'px';
    container.classList.add('visible');

    // Setup tooltip hover listeners (to keep it open when mouse is over tooltip)
    this._setupTooltipHoverListeners(container);

    // Setup button click handlers and drag functionality
    this._setupButtonListeners(container);
    this._setupDragListeners(container);
  },

  /**
   * Setup button click listeners (pin, maximize, close)
   */
  _setupButtonListeners(container: HTMLElement): void {
    const buttons = container.querySelectorAll('[data-action]');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;

        switch (action) {
          case 'pin':
            this.togglePin();
            break;
          case 'maximize':
            this.toggleMaximize();
            break;
          case 'close':
            this.close();
            break;
        }
      });
    });
  },

  /**
   * Setup drag listeners on the header
   */
  _setupDragListeners(container: HTMLElement): void {
    const header = container.querySelector('[data-drag-handle]') as HTMLElement;
    if (!header) return;

    const self = this;

    const onMouseDown = (e: MouseEvent) => {
      // Don't start drag if clicking on a button
      if ((e.target as HTMLElement).closest('[data-action]')) return;
      // Don't drag if maximized
      if (self._isMaximized) return;

      self._isDragging = true;
      container.classList.add('dragging');

      const rect = container.getBoundingClientRect();
      self._dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!self._isDragging) return;

      const newLeft = e.clientX - self._dragOffset.x;
      const newTop = e.clientY - self._dragOffset.y;

      // Keep within viewport bounds
      const maxLeft = window.innerWidth - container.offsetWidth;
      const maxTop = window.innerHeight - container.offsetHeight;

      container.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
      container.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
    };

    const onMouseUp = () => {
      self._isDragging = false;
      container.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    header.addEventListener('mousedown', onMouseDown);
  },

  /**
   * Counter for unique pinned clone IDs
   */
  _pinnedCounter: 0,

  /**
   * Create a pinned clone of the tooltip that stays on screen independently
   */
  togglePin(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Create a unique ID for this pinned clone
    this._pinnedCounter++;
    const pinnedId = `${this.containerId}-pinned-${this._pinnedCounter}`;

    // Clone the container
    const clone = container.cloneNode(true) as HTMLElement;
    clone.id = pinnedId;
    clone.classList.add('pinned');
    clone.classList.remove('closing');

    // Update the PIN button to show it's pinned (change to unpin/close icon)
    const pinBtn = clone.querySelector('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.classList.add('pinned');
      pinBtn.setAttribute('title', 'Desafixar');
      // Change icon to indicate it's pinned (rotated pushpin)
      pinBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1">
          <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
          <line x1="12" y1="16" x2="12" y2="21"/>
          <line x1="8" y1="4" x2="16" y2="4"/>
        </svg>
      `;
    }

    // Append clone to body
    document.body.appendChild(clone);

    // Setup event listeners for the pinned clone
    this._setupPinnedCloneListeners(clone, pinnedId);

    // Hide the original tooltip
    this.hide();
  },

  /**
   * Setup event listeners for a pinned clone
   */
  _setupPinnedCloneListeners(clone: HTMLElement, cloneId: string): void {
    // Handle PIN button click - unpin/close the clone
    const pinBtn = clone.querySelector('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._closePinnedClone(cloneId);
      });
    }

    // Handle close button
    const closeBtn = clone.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._closePinnedClone(cloneId);
      });
    }

    // Handle maximize button
    let isMaximized = false;
    let savedPosition: { left: string; top: string } | null = null;
    const maxBtn = clone.querySelector('[data-action="maximize"]');
    if (maxBtn) {
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMaximized = !isMaximized;

        if (isMaximized) {
          savedPosition = { left: clone.style.left, top: clone.style.top };
        }
        clone.classList.toggle('maximized', isMaximized);

        if (isMaximized) {
          maxBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="5" y="5" width="14" height="14" rx="2"/>
              <path d="M9 5V3h12v12h-2"/>
            </svg>
          `;
          maxBtn.setAttribute('title', 'Restaurar');
        } else {
          maxBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          `;
          maxBtn.setAttribute('title', 'Maximizar');
          if (savedPosition) {
            clone.style.left = savedPosition.left;
            clone.style.top = savedPosition.top;
          }
        }
      });
    }

    // Setup drag for the clone
    const header = clone.querySelector('[data-drag-handle]') as HTMLElement;
    if (header) {
      let isDragging = false;
      let dragOffset = { x: 0, y: 0 };

      const onMouseDown = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('[data-action]')) return;
        if (isMaximized) return;

        isDragging = true;
        clone.classList.add('dragging');

        const rect = clone.getBoundingClientRect();
        dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const newLeft = e.clientX - dragOffset.x;
        const newTop = e.clientY - dragOffset.y;
        const maxLeft = window.innerWidth - clone.offsetWidth;
        const maxTop = window.innerHeight - clone.offsetHeight;
        clone.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
        clone.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
      };

      const onMouseUp = () => {
        isDragging = false;
        clone.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      header.addEventListener('mousedown', onMouseDown);
    }
  },

  /**
   * Close and remove a pinned clone
   */
  _closePinnedClone(cloneId: string): void {
    const clone = document.getElementById(cloneId);
    if (clone) {
      clone.classList.add('closing');
      setTimeout(() => {
        clone.remove();
      }, 400);
    }
  },

  /**
   * Toggle maximized state
   */
  toggleMaximize(): void {
    this._isMaximized = !this._isMaximized;
    const container = document.getElementById(this.containerId);
    if (!container) return;

    if (this._isMaximized) {
      // Save current position before maximizing
      this._savedPosition = {
        left: container.style.left,
        top: container.style.top
      };
    }

    container.classList.toggle('maximized', this._isMaximized);

    // Update maximize button icon
    const maxBtn = container.querySelector('[data-action="maximize"]');
    if (maxBtn) {
      if (this._isMaximized) {
        maxBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="5" width="14" height="14" rx="2"/>
            <path d="M9 5V3h12v12h-2"/>
          </svg>
        `;
        maxBtn.setAttribute('title', 'Restaurar');
      } else {
        maxBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        `;
        maxBtn.setAttribute('title', 'Maximizar');
        // Restore position
        if (this._savedPosition) {
          container.style.left = this._savedPosition.left;
          container.style.top = this._savedPosition.top;
        }
      }
    }
  },

  /**
   * Close tooltip (reset all states)
   */
  close(): void {
    this._isMaximized = false;
    this._isDragging = false;
    this._savedPosition = null;

    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'pinned', 'maximized', 'dragging', 'closing');
    }
  },

  /**
   * Setup hover listeners on the tooltip itself
   */
  _setupTooltipHoverListeners(container: HTMLElement): void {
    // Remove existing listeners first
    container.onmouseenter = null;
    container.onmouseleave = null;

    container.onmouseenter = () => {
      this._isMouseOverTooltip = true;
      // Cancel any pending hide
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
    };

    container.onmouseleave = () => {
      this._isMouseOverTooltip = false;
      // Start delayed hide
      this._startDelayedHide();
    };
  },

  /**
   * Start delayed hide with animation
   */
  _startDelayedHide(): void {
    // Don't hide if mouse is over tooltip
    if (this._isMouseOverTooltip) return;

    // Cancel existing timer
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
    }

    // Wait 1.5 seconds before starting to close
    this._hideTimer = setTimeout(() => {
      this.hideWithAnimation();
    }, 1500);
  },

  /**
   * Hide tooltip with fade animation
   */
  hideWithAnimation(): void {
    const container = document.getElementById(this.containerId);
    if (container && container.classList.contains('visible')) {
      container.classList.add('closing');
      // Wait for animation to complete
      setTimeout(() => {
        container.classList.remove('visible');
        container.classList.remove('closing');
      }, 400);
    }
  },

  /**
   * Hide tooltip immediately (for cleanup)
   */
  hide(): void {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    this._isMouseOverTooltip = false;
    this._isMaximized = false;
    this._isDragging = false;
    this._savedPosition = null;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'closing', 'pinned', 'maximized', 'dragging');
    }
  },

  /**
   * Attach tooltip to an element with automatic show/hide on hover
   * Returns cleanup function to remove event listeners
   */
  attach(element: HTMLElement, getDataFn: () => DashboardEnergySummary): () => void {
    const self = this;

    const handleMouseEnter = (e: MouseEvent) => {
      // Cancel any pending hide
      if (self._hideTimer) {
        clearTimeout(self._hideTimer);
        self._hideTimer = null;
      }
      const summary = getDataFn();
      if (summary && summary.totalDevices > 0) {
        self.show(element, summary, e);
      }
    };

    const handleMouseLeave = () => {
      // Start delayed hide (gives time to move mouse to tooltip)
      self._startDelayedHide();
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    // Return cleanup function
    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      self.hide();
    };
  },

  /**
   * Build summary data from TELEMETRY_INFO STATE
   * This is called by the widget controller to get data for the tooltip
   */
  buildSummaryFromState(state: any, receivedData: any): DashboardEnergySummary {
    const summary: DashboardEnergySummary = {
      totalDevices: 0,
      totalConsumption: 0,
      unit: 'kWh',
      byCategory: [],
      byStatus: {
        normal: 0,
        alert: 0,
        failure: 0,
        standby: 0,
        offline: 0,
        noConsumption: 0,
      },
      lastUpdated: new Date().toISOString(),
    };

    if (!state) return summary;

    // Build categories from state
    const entrada = {
      id: 'entrada',
      name: 'Entrada',
      icon: CATEGORY_ICONS.entrada,
      deviceCount: state.entrada?.devices?.length || (receivedData?.entrada_total?.device_count || 0),
      consumption: state.entrada?.total || 0,
      percentage: 100,
    };

    const lojas = {
      id: 'lojas',
      name: 'Lojas',
      icon: CATEGORY_ICONS.lojas,
      deviceCount: state.consumidores?.lojas?.devices?.length || (receivedData?.lojas_total?.device_count || 0),
      consumption: state.consumidores?.lojas?.total || 0,
      percentage: state.consumidores?.lojas?.perc || 0,
    };

    // Build Area Comum with subcategories
    const climatizacaoData = receivedData?.climatizacao || {};
    const elevadoresData = receivedData?.elevadores || {};
    const escadasData = receivedData?.escadas_rolantes || {};
    const outrosData = receivedData?.outros || {};

    const areaComumChildren: CategorySummary[] = [];

    // Climatizacao with optional subcategories
    const climatizacao: CategorySummary = {
      id: 'climatizacao',
      name: 'Climatizacao',
      icon: CATEGORY_ICONS.climatizacao,
      deviceCount: climatizacaoData.count || state.consumidores?.climatizacao?.devices?.length || 0,
      consumption: state.consumidores?.climatizacao?.total || 0,
      percentage: state.consumidores?.climatizacao?.perc || 0,
    };

    // Add climatizacao subcategories if available
    if (climatizacaoData.subcategories) {
      climatizacao.children = [];
      const subs = climatizacaoData.subcategories;

      if (subs.chillers) {
        climatizacao.children.push({
          id: 'chillers',
          name: 'Chillers',
          icon: CATEGORY_ICONS.chillers,
          deviceCount: subs.chillers.count || 0,
          consumption: subs.chillers.kWh || 0,
          percentage: 0,
        });
      }
      if (subs.fancoils) {
        climatizacao.children.push({
          id: 'fancoils',
          name: 'Fancoils',
          icon: CATEGORY_ICONS.fancoils,
          deviceCount: subs.fancoils.count || 0,
          consumption: subs.fancoils.kWh || 0,
          percentage: 0,
        });
      }
      if (subs.bombas) {
        climatizacao.children.push({
          id: 'bombas',
          name: 'Bombas',
          icon: CATEGORY_ICONS.bombas,
          deviceCount: subs.bombas.count || 0,
          consumption: subs.bombas.kWh || 0,
          percentage: 0,
        });
      }
      if (subs.cag) {
        climatizacao.children.push({
          id: 'cag',
          name: 'CAG',
          icon: CATEGORY_ICONS.cag,
          deviceCount: subs.cag.count || 0,
          consumption: subs.cag.kWh || 0,
          percentage: 0,
        });
      }
    }

    areaComumChildren.push(climatizacao);

    // Elevadores
    areaComumChildren.push({
      id: 'elevadores',
      name: 'Elevadores',
      icon: CATEGORY_ICONS.elevadores,
      deviceCount: elevadoresData.count || state.consumidores?.elevadores?.devices?.length || 0,
      consumption: state.consumidores?.elevadores?.total || 0,
      percentage: state.consumidores?.elevadores?.perc || 0,
    });

    // Escadas Rolantes
    areaComumChildren.push({
      id: 'escadasRolantes',
      name: 'Esc. Rolantes',
      icon: CATEGORY_ICONS.escadas,
      deviceCount: escadasData.count || state.consumidores?.escadasRolantes?.devices?.length || 0,
      consumption: state.consumidores?.escadasRolantes?.total || 0,
      percentage: state.consumidores?.escadasRolantes?.perc || 0,
    });

    // Outros
    areaComumChildren.push({
      id: 'outros',
      name: 'Outros',
      icon: CATEGORY_ICONS.outros,
      deviceCount: outrosData.count || state.consumidores?.outros?.devices?.length || 0,
      consumption: state.consumidores?.outros?.total || 0,
      percentage: state.consumidores?.outros?.perc || 0,
    });

    // Calculate Area Comum totals
    const areaComumDeviceCount = areaComumChildren.reduce((sum, c) => sum + c.deviceCount, 0);
    const areaComumConsumption = state.consumidores?.areaComum?.total ||
      areaComumChildren.reduce((sum, c) => sum + c.consumption, 0);

    const areaComum: CategorySummary = {
      id: 'areaComum',
      name: 'Area Comum',
      icon: CATEGORY_ICONS.areaComum,
      deviceCount: areaComumDeviceCount,
      consumption: areaComumConsumption,
      percentage: state.consumidores?.areaComum?.perc || 0,
      children: areaComumChildren,
    };

    // Build final categories array
    summary.byCategory = [entrada, lojas, areaComum];

    // Calculate totals
    summary.totalDevices = entrada.deviceCount + lojas.deviceCount + areaComumDeviceCount;
    summary.totalConsumption = state.grandTotal || entrada.consumption;

    // Status counts (placeholder - would need device-level status data)
    // For now, estimate based on device counts
    const totalDevices = summary.totalDevices;
    summary.byStatus = {
      normal: Math.floor(totalDevices * 0.85), // Estimate 85% normal
      alert: Math.floor(totalDevices * 0.08),  // Estimate 8% alert
      failure: Math.floor(totalDevices * 0.02), // Estimate 2% failure
      standby: Math.floor(totalDevices * 0.03), // Estimate 3% standby
      offline: Math.floor(totalDevices * 0.02), // Estimate 2% offline
      noConsumption: 0,
    };

    // Adjust to ensure totals match
    const statusSum = Object.values(summary.byStatus).reduce((a, b) => a + b, 0);
    if (statusSum !== totalDevices && totalDevices > 0) {
      summary.byStatus.normal += (totalDevices - statusSum);
    }

    return summary;
  },
};

// Default export
export default EnergySummaryTooltip;
