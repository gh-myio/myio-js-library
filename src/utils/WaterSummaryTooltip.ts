/**
 * WaterSummaryTooltip - Dashboard Water Summary Tooltip Component
 * RFC-0105: Premium tooltip showing comprehensive water dashboard summary
 *
 * Shows:
 * - Total device count
 * - Device counts by category (tree view)
 * - Consumption totals by category
 * - Device status breakdown (normal, alert, failure, standby, offline)
 *
 * @example
 * // Attach to an element
 * const cleanup = WaterSummaryTooltip.attach(triggerElement, getDataFn);
 * // Later: cleanup();
 *
 * // Or manual control
 * WaterSummaryTooltip.show(element, summaryData, event);
 * WaterSummaryTooltip.hide();
 */

// ============================================
// Types
// ============================================

export interface WaterCategorySummary {
  id: string;
  name: string;
  icon: string;
  deviceCount: number;
  consumption: number;
  percentage: number;
  children?: WaterCategorySummary[];
}

export interface DeviceInfo {
  id: string;
  label: string;
  name?: string;
}

export interface StatusSummary {
  // Connection status (RFC-0109: independent of consumption)
  waiting: number;           // not_installed - device registered but not yet installed
  weakConnection: number;    // bad/weak connection quality
  offline: number;           // device is offline/disconnected
  // Consumption status (only for online devices)
  normal: number;
  alert: number;
  failure: number;
  standby: number;
  noConsumption: number;
  // Device lists for each status (optional - for popup display)
  // Note: A device can appear in multiple lists (e.g., offline AND noConsumption)
  // Exception: waiting devices should NOT appear in noConsumption
  waitingDevices?: DeviceInfo[];
  weakConnectionDevices?: DeviceInfo[];
  offlineDevices?: DeviceInfo[];
  normalDevices?: DeviceInfo[];
  alertDevices?: DeviceInfo[];
  failureDevices?: DeviceInfo[];
  standbyDevices?: DeviceInfo[];
  noConsumptionDevices?: DeviceInfo[];
}

export interface DashboardWaterSummary {
  totalDevices: number;
  totalConsumption: number;
  unit: string;
  byCategory: WaterCategorySummary[];
  byStatus: StatusSummary;
  lastUpdated: string;
  includeBathrooms?: boolean;
  /** Optional customer name to display in header (e.g., "Mestre Álvaro") */
  customerName?: string;
}

// ============================================
// CSS Styles (injected once)
// ============================================

const WATER_SUMMARY_TOOLTIP_CSS = `
/* ============================================
   Water Summary Tooltip (RFC-0105)
   Premium dashboard summary on hover
   ============================================ */
.water-summary-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none; /* IMPORTANT: Disable pointer events when hidden to prevent blocking navigation */
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: translateY(8px);
}

.water-summary-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto; /* Enable pointer events only when visible */
}

.water-summary-tooltip.closing {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
  pointer-events: none; /* Disable pointer events during close animation */
}

.water-summary-tooltip__content {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08);
  min-width: 380px;
  width: max-content;
  max-width: 90vw;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
}

.water-summary-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%);
  border-bottom: 1px solid #93c5fd;
  border-radius: 12px 12px 0 0;
  cursor: move;
  user-select: none;
}

.water-summary-tooltip__icon {
  font-size: 18px;
}

.water-summary-tooltip__title {
  font-weight: 700;
  font-size: 14px;
  color: #1d4ed8;
  flex: 1;
}

.water-summary-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.water-summary-tooltip__header-btn {
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

.water-summary-tooltip__header-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  color: #1e293b;
}

.water-summary-tooltip__header-btn.pinned {
  background: #1d4ed8;
  color: white;
}

.water-summary-tooltip__header-btn.pinned:hover {
  background: #1e40af;
  color: white;
}

.water-summary-tooltip__header-btn svg {
  width: 14px;
  height: 14px;
}

.water-summary-tooltip__timestamp {
  font-size: 10px;
  color: #6b7280;
  margin-right: 8px;
}

.water-summary-tooltip__body {
  padding: 14px;
}

/* Maximized state */
.water-summary-tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
}

.water-summary-tooltip.maximized .water-summary-tooltip__content {
  width: 100%;
  height: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
}

.water-summary-tooltip.maximized .water-summary-tooltip__body {
  flex: 1;
  overflow-y: auto;
}

/* Pinned state indicator */
.water-summary-tooltip.pinned {
  box-shadow: 0 0 0 2px #1d4ed8, 0 10px 40px rgba(0, 0, 0, 0.2);
}

/* Dragging state */
.water-summary-tooltip.dragging {
  transition: none !important;
  cursor: move;
}

/* Total Devices Banner */
.water-summary-tooltip__total-devices {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid #e2e8f0;
}

.water-summary-tooltip__total-devices-label {
  font-weight: 600;
  color: #475569;
  font-size: 12px;
}

.water-summary-tooltip__total-devices-value {
  font-weight: 700;
  font-size: 20px;
  color: #1e293b;
}

/* Section Title */
.water-summary-tooltip__section-title {
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
.water-summary-tooltip__category-tree {
  margin: 6px 0;
}

.water-summary-tooltip__category-header {
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

.water-summary-tooltip__category-row {
  display: grid;
  grid-template-columns: 1fr 50px 80px;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  align-items: center;
  transition: background-color 0.15s ease;
}

.water-summary-tooltip__category-row:hover {
  background: #f8fafc;
}

.water-summary-tooltip__category-row.parent {
  font-weight: 600;
  background: #fafafa;
}

.water-summary-tooltip__category-row.child {
  padding-left: 28px;
  font-size: 11px;
  color: #64748b;
}

.water-summary-tooltip__category-row.child::before {
  content: '';
  position: absolute;
  left: 18px;
  width: 8px;
  height: 1px;
  background: #cbd5e1;
}

.water-summary-tooltip__category-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.water-summary-tooltip__category-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
}

.water-summary-tooltip__category-count {
  text-align: center;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
}

.water-summary-tooltip__category-consumption {
  text-align: right;
  font-weight: 600;
  color: #2563eb;
  font-size: 11px;
}

/* Status Matrix - RFC-0109: 8 status items (4 columns x 2 rows) */
.water-summary-tooltip__status-matrix {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin: 6px 0 12px 0;
}

.water-summary-tooltip__status-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
}

.water-summary-tooltip__status-item.normal {
  background: #dcfce7;
  color: #15803d;
}

.water-summary-tooltip__status-item.alert {
  background: #fef3c7;
  color: #b45309;
}

.water-summary-tooltip__status-item.failure {
  background: #fee2e2;
  color: #b91c1c;
}

.water-summary-tooltip__status-item.standby {
  background: #dbeafe;
  color: #1d4ed8;
}

.water-summary-tooltip__status-item.offline {
  background: #f3f4f6;
  color: #6b7280;
}

.water-summary-tooltip__status-item.waiting {
  background: #fef3c7;
  color: #92400e;
  border: 1px dashed #f59e0b;
}

.water-summary-tooltip__status-item.weak-connection {
  background: #ffedd5;
  color: #c2410c;
}

.water-summary-tooltip__status-item.no-consumption {
  background: #f8fafc;
  color: #9ca3af;
  border: 1px dashed #e2e8f0;
}

.water-summary-tooltip__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.water-summary-tooltip__status-dot.normal { background: #22c55e; }
.water-summary-tooltip__status-dot.alert { background: #f59e0b; }
.water-summary-tooltip__status-dot.failure { background: #ef4444; }
.water-summary-tooltip__status-dot.standby { background: #3b82f6; }
.water-summary-tooltip__status-dot.offline { background: #6b7280; }
.water-summary-tooltip__status-dot.waiting { background: #fbbf24; }
.water-summary-tooltip__status-dot.weak-connection { background: #fb923c; }
.water-summary-tooltip__status-dot.no-consumption { background: #d1d5db; }

.water-summary-tooltip__status-count {
  font-size: 12px;
  font-weight: 700;
}

.water-summary-tooltip__status-label {
  font-size: 9px;
  opacity: 0.85;
}

/* Status Expand Button (+) */
.water-summary-tooltip__status-expand {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.1);
  color: inherit;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  transition: all 0.15s ease;
  flex-shrink: 0;
  opacity: 0.7;
}

.water-summary-tooltip__status-expand:hover {
  background: rgba(0, 0, 0, 0.2);
  transform: scale(1.1);
  opacity: 1;
}

.water-summary-tooltip__status-item.normal .water-summary-tooltip__status-expand:hover {
  background: #15803d;
  color: white;
}

.water-summary-tooltip__status-item.alert .water-summary-tooltip__status-expand:hover {
  background: #b45309;
  color: white;
}

.water-summary-tooltip__status-item.failure .water-summary-tooltip__status-expand:hover {
  background: #b91c1c;
  color: white;
}

.water-summary-tooltip__status-item.standby .water-summary-tooltip__status-expand:hover {
  background: #1d4ed8;
  color: white;
}

.water-summary-tooltip__status-item.offline .water-summary-tooltip__status-expand:hover {
  background: #6b7280;
  color: white;
}

.water-summary-tooltip__status-item.waiting .water-summary-tooltip__status-expand:hover {
  background: #92400e;
  color: white;
}

.water-summary-tooltip__status-item.weak-connection .water-summary-tooltip__status-expand:hover {
  background: #c2410c;
  color: white;
}

.water-summary-tooltip__status-item.no-consumption .water-summary-tooltip__status-expand:hover {
  background: #9ca3af;
  color: white;
}

/* Device dot colors (used in InfoTooltip content) */
.water-summary-tooltip__device-dot {
  display: inline-block;
}
.water-summary-tooltip__device-dot.normal { background: #22c55e; }
.water-summary-tooltip__device-dot.alert { background: #f59e0b; }
.water-summary-tooltip__device-dot.failure { background: #ef4444; }
.water-summary-tooltip__device-dot.standby { background: #3b82f6; }
.water-summary-tooltip__device-dot.offline { background: #6b7280; }
.water-summary-tooltip__device-dot.waiting { background: #fbbf24; }
.water-summary-tooltip__device-dot.weak-connection { background: #fb923c; }
.water-summary-tooltip__device-dot.no-consumption { background: #d1d5db; }

/* Total Consumption Footer */
.water-summary-tooltip__total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
  border-radius: 0 0 11px 11px;
}

.water-summary-tooltip__total-label {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
}

.water-summary-tooltip__total-value {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
}

/* Responsive adjustments */
@media (max-width: 800px) {
  .water-summary-tooltip__status-matrix {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 600px) {
  .water-summary-tooltip__content {
    min-width: 360px;
    max-width: 95vw;
  }

  .water-summary-tooltip__status-matrix {
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

  const styleId = 'myio-water-summary-tooltip-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = WATER_SUMMARY_TOOLTIP_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ============================================
// Category Icons (Water specific)
// ============================================

const WATER_CATEGORY_ICONS: Record<string, string> = {
  entrada: '📥',
  lojas: '🏪',
  banheiros: '🚿',
  areaComum: '🏢',
  pontosNaoMapeados: '❓',
};

// ============================================
// Helper Functions
// ============================================

/**
 * Format consumption value with appropriate unit (m³)
 */
function formatConsumption(value: number, unit: string = 'm³'): string {
  if (value == null || isNaN(value)) return '0,00 ' + unit;

  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ' + unit;
}

/**
 * Format timestamp for display (date and time)
 */
function formatTimestamp(isoString: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const timeStr = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dateStr} ${timeStr}`;
  } catch {
    return '';
  }
}

// ============================================
// WaterSummaryTooltip Object
// ============================================

export const WaterSummaryTooltip = {
  containerId: 'myio-water-summary-tooltip',

  /**
   * Create or get the tooltip container
   */
  getContainer(): HTMLElement {
    injectCSS();

    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'water-summary-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Render category tree rows
   */
  renderCategoryTree(categories: WaterCategorySummary[], unit: string): string {
    let html = '';

    categories.forEach(cat => {
      const icon = WATER_CATEGORY_ICONS[cat.id] || WATER_CATEGORY_ICONS.areaComum;
      const isParent = cat.children && cat.children.length > 0;

      html += `
        <div class="water-summary-tooltip__category-row ${isParent ? 'parent' : ''}">
          <span class="water-summary-tooltip__category-name">
            <span class="water-summary-tooltip__category-icon">${icon}</span>
            <span>${cat.name}</span>
          </span>
          <span class="water-summary-tooltip__category-count">${cat.deviceCount}</span>
          <span class="water-summary-tooltip__category-consumption">${formatConsumption(cat.consumption, unit)}</span>
        </div>
      `;

      // Render children (subcategories)
      if (cat.children && cat.children.length > 0) {
        cat.children.forEach(child => {
          const childIcon = WATER_CATEGORY_ICONS[child.id] || '•';
          html += `
            <div class="water-summary-tooltip__category-row child">
              <span class="water-summary-tooltip__category-name">
                <span class="water-summary-tooltip__category-icon">${childIcon}</span>
                <span>${child.name}</span>
              </span>
              <span class="water-summary-tooltip__category-count">${child.deviceCount}</span>
              <span class="water-summary-tooltip__category-consumption">${formatConsumption(child.consumption, unit)}</span>
            </div>
          `;
        });
      }
    });

    return html;
  },

  /**
   * Render status matrix with expand buttons
   * RFC-0109: Reorganized to show connectivity status separately from consumption status
   * Note: A device can appear in multiple categories (e.g., offline AND noConsumption)
   */
  renderStatusMatrix(status: StatusSummary): string {
    // Connectivity status items (RFC-0109) - use fallback to 0 for backward compatibility
    const connectivityItems = [
      { key: 'waiting', label: 'Não Instalado', count: status.waiting ?? 0, devices: status.waitingDevices },
      { key: 'weak-connection', label: 'Conexão Fraca', count: status.weakConnection ?? 0, devices: status.weakConnectionDevices },
      { key: 'offline', label: 'Offline', count: status.offline ?? 0, devices: status.offlineDevices },
    ];

    // Consumption status items (only for online devices)
    const consumptionItems = [
      { key: 'normal', label: 'Normal', count: status.normal ?? 0, devices: status.normalDevices },
      { key: 'alert', label: 'Alerta', count: status.alert ?? 0, devices: status.alertDevices },
      { key: 'failure', label: 'Falha', count: status.failure ?? 0, devices: status.failureDevices },
      { key: 'standby', label: 'Standby', count: status.standby ?? 0, devices: status.standbyDevices },
      { key: 'no-consumption', label: 'Sem Consumo', count: status.noConsumption ?? 0, devices: status.noConsumptionDevices },
    ];

    const renderItem = (item: { key: string; label: string; count: number; devices?: DeviceInfo[] }) => {
      // Always show expand button if count > 0
      const expandBtn = item.count > 0 ? `
        <button
          class="water-summary-tooltip__status-expand"
          data-status="${item.key}"
          data-label="${item.label}"
          data-count="${item.count}"
        >+</button>
      ` : '';

      return `
        <div class="water-summary-tooltip__status-item ${item.key}">
          <span class="water-summary-tooltip__status-dot ${item.key}"></span>
          <span class="water-summary-tooltip__status-count">${item.count}</span>
          <span class="water-summary-tooltip__status-label">${item.label}</span>
          ${expandBtn}
        </div>
      `;
    };

    // Combine all items, connectivity first then consumption
    const allItems = [...connectivityItems, ...consumptionItems];
    return allItems.map(renderItem).join('');
  },

  /**
   * Render full tooltip HTML
   */
  renderHTML(summary: DashboardWaterSummary): string {
    const categoryRows = this.renderCategoryTree(summary.byCategory, summary.unit);
    const statusMatrix = this.renderStatusMatrix(summary.byStatus);
    const timestamp = formatTimestamp(summary.lastUpdated);
    const titleSuffix = summary.customerName ? ` (${summary.customerName})` : '';

    return `
      <div class="water-summary-tooltip__content">
        <div class="water-summary-tooltip__header" data-drag-handle>
          <span class="water-summary-tooltip__icon">💧</span>
          <span class="water-summary-tooltip__title">Resumo de Água${titleSuffix}</span>
          ${timestamp ? `<span class="water-summary-tooltip__timestamp">${timestamp}</span>` : ''}
          <div class="water-summary-tooltip__header-actions">
            <button class="water-summary-tooltip__header-btn" data-action="pin" title="Fixar na tela">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
                <line x1="12" y1="16" x2="12" y2="21"/>
                <line x1="8" y1="4" x2="16" y2="4"/>
              </svg>
            </button>
            <button class="water-summary-tooltip__header-btn" data-action="maximize" title="Maximizar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>
            <button class="water-summary-tooltip__header-btn" data-action="close" title="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="water-summary-tooltip__body">
          <div class="water-summary-tooltip__total-devices">
            <span class="water-summary-tooltip__total-devices-label">Total de Medidores</span>
            <span class="water-summary-tooltip__total-devices-value">${summary.totalDevices}</span>
          </div>

          <div class="water-summary-tooltip__section-title">Distribuição por Categoria</div>
          <div class="water-summary-tooltip__category-tree">
            <div class="water-summary-tooltip__category-header">
              <span>Categoria</span>
              <span>Qtd</span>
              <span>Consumo</span>
            </div>
            ${categoryRows}
          </div>

          <div class="water-summary-tooltip__section-title">Status dos Medidores</div>
          <div class="water-summary-tooltip__status-matrix">
            ${statusMatrix}
          </div>
        </div>
        <div class="water-summary-tooltip__total">
          <span class="water-summary-tooltip__total-label">Consumo Total</span>
          <span class="water-summary-tooltip__total-value">${formatConsumption(summary.totalConsumption, summary.unit)}</span>
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

  // Store current status data for device list popup
  _currentStatus: null as StatusSummary | null,
  _devicePopupId: 'myio-water-device-popup',

  /**
   * Show tooltip for an element
   */
  show(triggerElement: HTMLElement, summary: DashboardWaterSummary, event?: MouseEvent): void {
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

    // Store current status data for device list popup
    this._currentStatus = summary.byStatus;

    // Setup tooltip hover listeners (to keep it open when mouse is over tooltip)
    this._setupTooltipHoverListeners(container);

    // Setup button click handlers and drag functionality
    this._setupButtonListeners(container);
    this._setupDragListeners(container);
    this._setupExpandButtonListeners(container);
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
   * Setup expand button listeners for device list popup (hover behavior)
   */
  _setupExpandButtonListeners(container: HTMLElement): void {
    const self = this;
    const expandBtns = container.querySelectorAll('.water-summary-tooltip__status-expand');
    expandBtns.forEach(btn => {
      const btnEl = btn as HTMLElement;

      btnEl.addEventListener('mouseenter', () => {
        const statusKey = btnEl.dataset.status;
        const label = btnEl.dataset.label;
        const count = parseInt(btnEl.dataset.count || '0', 10);
        if (statusKey && label) {
          self.showDeviceListPopup(btnEl, statusKey, label, count);
        }
      });

      btnEl.addEventListener('mouseleave', (e) => {
        // Check if mouse is moving to the popup itself
        const popup = document.getElementById(self._devicePopupId);
        if (popup) {
          const relatedTarget = e.relatedTarget as Node;
          if (popup.contains(relatedTarget)) {
            return; // Don't hide if moving to popup
          }
        }
        // Start delayed hide
        self._startDevicePopupDelayedHide();
      });
    });
  },

  // Timer for device popup delayed hide
  _devicePopupHideTimer: null as ReturnType<typeof setTimeout> | null,

  /**
   * Start delayed hide for device popup
   */
  _startDevicePopupDelayedHide(): void {
    if (this._devicePopupHideTimer) {
      clearTimeout(this._devicePopupHideTimer);
    }
    this._devicePopupHideTimer = setTimeout(() => {
      this.hideDeviceListPopup();
    }, 300);
  },

  /**
   * Cancel device popup delayed hide
   */
  _cancelDevicePopupDelayedHide(): void {
    if (this._devicePopupHideTimer) {
      clearTimeout(this._devicePopupHideTimer);
      this._devicePopupHideTimer = null;
    }
  },

  /**
   * Get devices for a given status key
   */
  _getDevicesForStatus(statusKey: string): DeviceInfo[] {
    if (!this._currentStatus) return [];

    const deviceMap: Record<string, DeviceInfo[] | undefined> = {
      // Connectivity status (RFC-0109)
      'waiting': this._currentStatus.waitingDevices,
      'weak-connection': this._currentStatus.weakConnectionDevices,
      'offline': this._currentStatus.offlineDevices,
      // Consumption status
      'normal': this._currentStatus.normalDevices,
      'alert': this._currentStatus.alertDevices,
      'failure': this._currentStatus.failureDevices,
      'standby': this._currentStatus.standbyDevices,
      'no-consumption': this._currentStatus.noConsumptionDevices,
    };

    return deviceMap[statusKey] || [];
  },

  /**
   * Get status icon based on status key
   */
  _getStatusIcon(statusKey: string): string {
    const icons: Record<string, string> = {
      // Connectivity status (RFC-0109)
      'waiting': '📦',
      'weak-connection': '📶',
      'offline': '📴',
      // Consumption status
      'normal': '✅',
      'alert': '⚠️',
      'failure': '❌',
      'standby': '💤',
      'no-consumption': '🔌',
    };
    return icons[statusKey] || '📋';
  },

  /**
   * Build device list content HTML for InfoTooltip
   */
  _buildDeviceListContent(statusKey: string, label: string, count: number): string {
    const devices = this._getDevicesForStatus(statusKey);
    const hasDeviceDetails = devices.length > 0;

    if (!hasDeviceDetails) {
      // No device details available - show count info
      return `
        <div class="myio-info-tooltip__section">
          <div style="text-align: center; padding: 16px 0;">
            <div style="font-size: 32px; margin-bottom: 12px;">📋</div>
            <div style="font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 6px;">
              ${count} medidor${count !== 1 ? 'es' : ''}
            </div>
            <div style="font-size: 11px; color: #64748b;">
              com status "${label}"
            </div>
            <div style="margin-top: 12px; font-size: 10px; color: #94a3b8; font-style: italic;">
              Detalhes não disponíveis nesta visualização
            </div>
          </div>
        </div>
      `;
    }

    // Build device list
    const deviceItems = devices.map(device => `
      <div class="myio-info-tooltip__row" style="padding: 6px 0;">
        <span class="water-summary-tooltip__device-dot ${statusKey}" style="width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;"></span>
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${device.label || device.name || device.id}">
          ${device.label || device.name || device.id}
        </span>
      </div>
    `).join('');

    return `
      <div class="myio-info-tooltip__section">
        <div class="myio-info-tooltip__section-title">
          Medidores (${devices.length})
        </div>
        <div style="max-height: 200px; overflow-y: auto;">
          ${deviceItems}
        </div>
      </div>
    `;
  },

  /**
   * Show device list popup using InfoTooltip
   */
  showDeviceListPopup(triggerElement: HTMLElement, statusKey: string, label: string, count: number = 0): void {
    // Get InfoTooltip from window (loaded via library)
    const InfoTooltip = (window as any).MyIOLibrary?.InfoTooltip;
    if (!InfoTooltip) {
      console.error('[WaterSummaryTooltip] InfoTooltip not available');
      return;
    }

    // Cancel any pending hide on main tooltip
    this._cancelDevicePopupDelayedHide();

    const icon = this._getStatusIcon(statusKey);
    const content = this._buildDeviceListContent(statusKey, label, count);

    InfoTooltip.show(triggerElement, {
      icon: icon,
      title: `${label} (${count})`,
      content: content
    });
  },

  /**
   * Hide device list popup (uses InfoTooltip)
   */
  hideDeviceListPopup(): void {
    // Clear any pending hide timer
    if (this._devicePopupHideTimer) {
      clearTimeout(this._devicePopupHideTimer);
      this._devicePopupHideTimer = null;
    }

    // Use InfoTooltip to hide
    const InfoTooltip = (window as any).MyIOLibrary?.InfoTooltip;
    if (InfoTooltip) {
      InfoTooltip.startDelayedHide();
    }
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
      // Wait for animation to complete, then fully reset state
      setTimeout(() => {
        // Reset all state to prevent invisible blocking divs
        this._isMouseOverTooltip = false;
        this._isMaximized = false;
        this._isDragging = false;
        this._savedPosition = null;
        this._currentStatus = null;

        // Hide device list popup
        this.hideDeviceListPopup();

        // Remove all classes and clear content
        container.classList.remove('visible', 'closing', 'pinned', 'maximized', 'dragging');
        container.innerHTML = '';
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
    this._currentStatus = null;

    // Hide device list popup
    this.hideDeviceListPopup();

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'closing', 'pinned', 'maximized', 'dragging');
    }
  },

  /**
   * Attach tooltip to an element with automatic show/hide on hover
   * Returns cleanup function to remove event listeners
   */
  attach(element: HTMLElement, getDataFn: () => DashboardWaterSummary): () => void {
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
   * Build summary data from TELEMETRY_INFO STATE_WATER
   * This is called by the widget controller to get data for the tooltip
   *
   * RFC-0105 Enhancement: Now fetches device lists from MyIOOrchestratorData
   * to populate device lists for status popup display
   */
  buildSummaryFromState(state: any, receivedData: any, includeBathrooms: boolean = false, domain: string = 'water'): DashboardWaterSummary {
    const summary: DashboardWaterSummary = {
      totalDevices: 0,
      totalConsumption: 0,
      unit: 'm³',
      byCategory: [],
      byStatus: {
        normal: 0,
        alert: 0,
        failure: 0,
        standby: 0,
        offline: 0,
        noConsumption: 0,
        waiting: 0,
        weakConnection: 0,
        // Device lists - populated from orchestrator data
        normalDevices: [],
        alertDevices: [],
        failureDevices: [],
        standbyDevices: [],
        offlineDevices: [],
        noConsumptionDevices: [],
        waitingDevices: [],
        weakConnectionDevices: [],
      },
      lastUpdated: new Date().toISOString(),
      includeBathrooms: includeBathrooms,
    };

    if (!state) return summary;

    // Build categories from state (Water specific)
    const entrada: WaterCategorySummary = {
      id: 'entrada',
      name: 'Entrada',
      icon: WATER_CATEGORY_ICONS.entrada,
      deviceCount: state.entrada?.devices?.length || (receivedData?.entrada_total?.device_count || 0),
      consumption: state.entrada?.total || 0,
      percentage: 100,
    };

    const lojas: WaterCategorySummary = {
      id: 'lojas',
      name: 'Lojas',
      icon: WATER_CATEGORY_ICONS.lojas,
      deviceCount: state.lojas?.devices?.length || (receivedData?.lojas_total?.device_count || 0),
      consumption: state.lojas?.total || 0,
      percentage: state.lojas?.perc || 0,
    };

    // Build categories array
    summary.byCategory = [entrada, lojas];

    // Add Banheiros if enabled
    if (includeBathrooms) {
      const banheiros: WaterCategorySummary = {
        id: 'banheiros',
        name: 'Banheiros',
        icon: WATER_CATEGORY_ICONS.banheiros,
        deviceCount: state.banheiros?.devices?.length || (receivedData?.banheiros_total?.device_count || 0),
        consumption: state.banheiros?.total || 0,
        percentage: state.banheiros?.perc || 0,
      };
      summary.byCategory.push(banheiros);
    }

    // Area Comum
    const areaComum: WaterCategorySummary = {
      id: 'areaComum',
      name: 'Área Comum',
      icon: WATER_CATEGORY_ICONS.areaComum,
      deviceCount: state.areaComum?.devices?.length || (receivedData?.area_comum_total?.device_count || 0),
      consumption: state.areaComum?.total || 0,
      percentage: state.areaComum?.perc || 0,
    };
    summary.byCategory.push(areaComum);

    // Pontos Não Mapeados (if exists)
    if (state.pontosNaoMapeados && state.pontosNaoMapeados.total > 0) {
      const pontosNaoMapeados: WaterCategorySummary = {
        id: 'pontosNaoMapeados',
        name: 'Pontos Não Mapeados',
        icon: WATER_CATEGORY_ICONS.pontosNaoMapeados,
        deviceCount: state.pontosNaoMapeados?.devices?.length || 0,
        consumption: state.pontosNaoMapeados?.total || 0,
        percentage: state.pontosNaoMapeados?.perc || 0,
      };
      summary.byCategory.push(pontosNaoMapeados);
    }

    // Calculate totals
    summary.totalDevices = summary.byCategory.reduce((sum, cat) => sum + cat.deviceCount, 0);
    summary.totalConsumption = state.entrada?.total || 0;

    // RFC-0105 Enhancement: Use device status aggregation passed from widget controller
    // Priority: 1. deviceStatusAggregation from receivedData (widget context)
    //           2. Direct orchestrator access (may not work in all contexts)
    //           3. Fallback estimates
    const widgetAggregation = receivedData?.deviceStatusAggregation;

    if (widgetAggregation && widgetAggregation.hasData) {
      // Use device data aggregated by the widget controller (preferred method)
      summary.byStatus = {
        normal: widgetAggregation.normal || 0,
        alert: widgetAggregation.alert || 0,
        failure: widgetAggregation.failure || 0,
        standby: widgetAggregation.standby || 0,
        offline: widgetAggregation.offline || 0,
        noConsumption: widgetAggregation.noConsumption || 0,
        waiting: widgetAggregation.waiting || 0,
        weakConnection: widgetAggregation.weakConnection || 0,
        normalDevices: widgetAggregation.normalDevices || [],
        alertDevices: widgetAggregation.alertDevices || [],
        failureDevices: widgetAggregation.failureDevices || [],
        standbyDevices: widgetAggregation.standbyDevices || [],
        offlineDevices: widgetAggregation.offlineDevices || [],
        noConsumptionDevices: widgetAggregation.noConsumptionDevices || [],
        waitingDevices: widgetAggregation.waitingDevices || [],
        weakConnectionDevices: widgetAggregation.weakConnectionDevices || [],
      };

      // RFC-0109: Total devices = unique devices (connectivity categories are mutually exclusive)
      // Note: A device appears in exactly one connectivity category (waiting, weakConnection, offline, or online)
      const orchestratorTotal =
        (widgetAggregation.waiting || 0) +
        (widgetAggregation.weakConnection || 0) +
        (widgetAggregation.offline || 0) +
        (widgetAggregation.normal || 0) +
        (widgetAggregation.alert || 0) +
        (widgetAggregation.failure || 0) +
        (widgetAggregation.standby || 0);
      // Note: noConsumption is NOT added because devices can be both offline AND noConsumption

      if (orchestratorTotal > 0) {
        // Override totalDevices with orchestrator count for consistency
        summary.totalDevices = orchestratorTotal;
      }
    } else {
      // Try direct orchestrator access (may not work in iframe/library context)
      const statusAggregation = this._aggregateDeviceStatusFromOrchestrator(domain);

      if (statusAggregation.hasData) {
        summary.byStatus = statusAggregation.byStatus;

        // RFC-0109: Calculate total from connectivity categories + online consumption categories
        const orchestratorTotal =
          statusAggregation.byStatus.waiting +
          statusAggregation.byStatus.weakConnection +
          statusAggregation.byStatus.offline +
          statusAggregation.byStatus.normal +
          statusAggregation.byStatus.alert +
          statusAggregation.byStatus.failure +
          statusAggregation.byStatus.standby;

        if (orchestratorTotal > 0) {
          summary.totalDevices = orchestratorTotal;
        }
      } else {
        // Fallback: estimate based on device counts (no device lists available)
        const totalDevices = summary.totalDevices;
        const statusData = receivedData?.statusCounts || receivedData?.deviceStatus || null;

        if (statusData && typeof statusData === 'object') {
          // Use actual status counts from data (but no device lists)
          summary.byStatus = {
            normal: statusData.normal || 0,
            alert: statusData.alert || 0,
            failure: statusData.failure || 0,
            standby: statusData.standby || 0,
            offline: statusData.offline || 0,
            noConsumption: statusData.noConsumption || statusData.zeroConsumption || 0,
            waiting: statusData.waiting || 0,
            weakConnection: statusData.weakConnection || 0,
            normalDevices: [],
            alertDevices: [],
            failureDevices: [],
            standbyDevices: [],
            offlineDevices: [],
            noConsumptionDevices: [],
            waitingDevices: [],
            weakConnectionDevices: [],
          };
        } else {
          // Last resort: estimate based on device counts
          summary.byStatus = {
            normal: Math.floor(totalDevices * 0.80),
            alert: Math.floor(totalDevices * 0.05),
            failure: Math.floor(totalDevices * 0.02),
            standby: Math.floor(totalDevices * 0.02),
            offline: Math.floor(totalDevices * 0.03),
            noConsumption: Math.floor(totalDevices * 0.08),
            waiting: 0,
            weakConnection: 0,
            normalDevices: [],
            alertDevices: [],
            failureDevices: [],
            standbyDevices: [],
            offlineDevices: [],
            noConsumptionDevices: [],
            waitingDevices: [],
            weakConnectionDevices: [],
          };

          // Adjust to ensure totals match
          const statusSum = Object.values(summary.byStatus).reduce((a, b) => {
            return typeof b === 'number' ? a + b : a;
          }, 0);
          if (statusSum !== totalDevices && totalDevices > 0) {
            summary.byStatus.normal += (totalDevices - statusSum);
          }
        }
      }
    }

    return summary;
  },

  /**
   * RFC-0105: Aggregate device status from MyIOOrchestratorData
   * Iterates through all orchestrator items and groups devices by status
   * Returns both counts and device lists
   */
  _aggregateDeviceStatusFromOrchestrator(domain: string = 'water'): { hasData: boolean; byStatus: StatusSummary } {
    const result: StatusSummary = {
      normal: 0,
      alert: 0,
      failure: 0,
      standby: 0,
      offline: 0,
      noConsumption: 0,
      waiting: 0,
      weakConnection: 0,
      normalDevices: [],
      alertDevices: [],
      failureDevices: [],
      standbyDevices: [],
      offlineDevices: [],
      noConsumptionDevices: [],
      waitingDevices: [],
      weakConnectionDevices: [],
    };

    // Try to access orchestrator data
    const win = typeof window !== 'undefined' ? window : null;
    if (!win) return { hasData: false, byStatus: result };

    // Try both window and parent window (for iframe scenarios)
    const orchestratorData = (win as any).MyIOOrchestratorData ||
                             (win.parent as any)?.MyIOOrchestratorData;

    if (!orchestratorData || !orchestratorData[domain]) {
      return { hasData: false, byStatus: result };
    }

    const domainData = orchestratorData[domain];
    const items = domainData.items || [];

    if (!items || items.length === 0) {
      return { hasData: false, byStatus: result };
    }

    // Threshold for "no consumption" - devices with value below this are considered zero
    const NO_CONSUMPTION_THRESHOLD = 0.001; // m³ for water

    // Map deviceStatus values to consumption categories (for online devices with consumption)
    const consumptionStatusMapping: Record<string, 'normal' | 'alert' | 'failure' | 'standby'> = {
      'power_on': 'normal',
      'warning': 'alert',
      'failure': 'failure',
      'standby': 'standby',
    };

    items.forEach((item: any) => {
      const deviceInfo: DeviceInfo = {
        id: item.id || item.deviceId || '',
        label: item.label || item.entityLabel || item.name || item.deviceIdentifier || '',
        name: item.name || item.entityLabel || '',
      };

      const deviceStatus = item.deviceStatus || 'no_info';
      const connectionStatus = item.connectionStatus || '';
      const value = Number(item.value || item.val || 0);

      // RFC-0109: Determine connectivity/status category
      // IMPORTANT: Each device appears in EXACTLY ONE category (mutually exclusive)
      const isWaiting = deviceStatus === 'not_installed' || connectionStatus === 'waiting';
      const isWeakConnection = deviceStatus === 'weak_connection' || connectionStatus === 'bad' ||
                               ['bad', 'weak', 'unstable', 'poor', 'degraded'].includes(String(connectionStatus).toLowerCase());
      const isOffline = deviceStatus === 'offline' || deviceStatus === 'no_info' ||
                        deviceStatus === 'power_off' || deviceStatus === 'maintenance' ||
                        connectionStatus === 'offline' || connectionStatus === 'disconnected';

      // MUTUALLY EXCLUSIVE categories - device appears in exactly ONE
      // Priority: waiting > weakConnection > offline > noConsumption > consumption status

      // 1. Waiting (Não Instalado)
      if (isWaiting) {
        result.waiting++;
        result.waitingDevices?.push(deviceInfo);
        return;
      }

      // 2. Weak Connection (Conexão Fraca)
      if (isWeakConnection) {
        result.weakConnection++;
        result.weakConnectionDevices?.push(deviceInfo);
        return;
      }

      // 3. Offline
      if (isOffline) {
        result.offline++;
        result.offlineDevices?.push(deviceInfo);
        return;
      }

      // 4. Online device - check consumption value first
      // If no consumption (value ~= 0), goes to noConsumption category
      if (Math.abs(value) < NO_CONSUMPTION_THRESHOLD) {
        result.noConsumption++;
        result.noConsumptionDevices?.push(deviceInfo);
        return;
      }

      // 5. Online device with consumption - map to status category
      const consumptionCategory = consumptionStatusMapping[deviceStatus];
      if (consumptionCategory) {
        result[consumptionCategory]++;
        const deviceListKey = `${consumptionCategory}Devices` as keyof StatusSummary;
        const deviceList = result[deviceListKey] as DeviceInfo[] | undefined;
        if (deviceList) {
          deviceList.push(deviceInfo);
        }
      } else {
        // Unknown status - default to normal for online devices with consumption
        result.normal++;
        result.normalDevices?.push(deviceInfo);
      }
    });

    return { hasData: true, byStatus: result };
  },
};

// Default export
export default WaterSummaryTooltip;
