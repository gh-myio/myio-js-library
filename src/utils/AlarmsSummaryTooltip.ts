/**
 * AlarmsSummaryTooltip - Alarms Summary Tooltip Component
 * RFC-0116: Premium tooltip for alarms summary (NOT YET RELEASED)
 *
 * Status: FUNCIONALIDADE AINDA NAO LIBERADA
 *
 * Future features:
 * - Active alarms count
 * - Alarms by severity (critical, warning, info)
 * - Alarms by category
 * - Recent alarms list
 *
 * @example
 * AlarmsSummaryTooltip.show(triggerElement, summaryData);
 */

// ============================================
// Types
// ============================================

export interface AlarmInfo {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface AlarmsSummaryData {
  totalAlarms: number;
  activeAlarms: number;
  acknowledgedAlarms: number;
  bySeverity: {
    critical: number;
    warning: number;
    info: number;
  };
  recentAlarms?: AlarmInfo[];
  lastUpdated: string;
  customerName?: string;
}

// ============================================
// CSS Styles (injected once)
// ============================================

const ALARMS_SUMMARY_TOOLTIP_CSS = `
/* ============================================
   Alarms Summary Tooltip (RFC-0116)
   Red theme for alarms
   FUNCIONALIDADE AINDA NAO LIBERADA
   ============================================ */
.alarms-summary-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: translateY(8px);
}

.alarms-summary-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.alarms-summary-tooltip.closing {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
  pointer-events: none;
}

.alarms-summary-tooltip__content {
  background: #ffffff;
  border: 1px solid #fecaca;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08);
  min-width: 300px;
  width: max-content;
  max-width: 90vw;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
}

.alarms-summary-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(90deg, #fef2f2 0%, #fecaca 100%);
  border-bottom: 1px solid #f87171;
  border-radius: 12px 12px 0 0;
  cursor: move;
  user-select: none;
}

.alarms-summary-tooltip__icon {
  font-size: 18px;
}

.alarms-summary-tooltip__title {
  font-weight: 700;
  font-size: 14px;
  color: #dc2626;
  flex: 1;
}

.alarms-summary-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.alarms-summary-tooltip__header-btn {
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

.alarms-summary-tooltip__header-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  color: #1e293b;
}

.alarms-summary-tooltip__header-btn.pinned {
  background: #dc2626;
  color: white;
}

.alarms-summary-tooltip__header-btn.pinned:hover {
  background: #b91c1c;
  color: white;
}

.alarms-summary-tooltip__header-btn svg {
  width: 14px;
  height: 14px;
}

.alarms-summary-tooltip__body {
  padding: 24px;
  text-align: center;
}

.alarms-summary-tooltip__not-released {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
}

.alarms-summary-tooltip__not-released-icon {
  font-size: 48px;
  opacity: 0.8;
}

.alarms-summary-tooltip__not-released-title {
  font-size: 14px;
  font-weight: 700;
  color: #dc2626;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.alarms-summary-tooltip__not-released-message {
  font-size: 12px;
  color: #64748b;
  max-width: 250px;
  line-height: 1.5;
}

.alarms-summary-tooltip__not-released-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #fef2f2;
  border: 1px dashed #f87171;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
  color: #dc2626;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Pinned state indicator */
.alarms-summary-tooltip.pinned {
  box-shadow: 0 0 0 2px #dc2626, 0 10px 40px rgba(0, 0, 0, 0.2);
}

/* Dragging state */
.alarms-summary-tooltip.dragging {
  transition: none !important;
  cursor: move;
}
`;

// ============================================
// CSS Injection Helper
// ============================================

let cssInjected = false;

function injectCSS(): void {
  if (cssInjected) return;
  if (typeof document === 'undefined') return;

  const styleId = 'myio-alarms-summary-tooltip-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = ALARMS_SUMMARY_TOOLTIP_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format timestamp for display (date and time)
 */
function formatTimestamp(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  } catch {
    return '';
  }
}

// ============================================
// AlarmsSummaryTooltip Object
// ============================================

export const AlarmsSummaryTooltip = {
  containerId: 'myio-alarms-summary-tooltip',

  /**
   * Create or get the tooltip container
   */
  getContainer(): HTMLElement {
    injectCSS();

    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'alarms-summary-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Render full tooltip HTML - Shows "NOT RELEASED" message
   */
  renderHTML(summary?: AlarmsSummaryData): string {
    const titleSuffix = summary?.customerName ? ` (${summary.customerName})` : '';
    const timestamp = formatTimestamp(summary?.lastUpdated);

    return `
      <div class="alarms-summary-tooltip__content">
        <div class="alarms-summary-tooltip__header" data-drag-handle>
          <span class="alarms-summary-tooltip__icon">🚨</span>
          <span class="alarms-summary-tooltip__title">Resumo de Alarmes${titleSuffix}</span>
          ${timestamp ? `<span style="font-size: 10px; color: #9ca3af; margin-right: 8px;">${timestamp}</span>` : ''}
          <div class="alarms-summary-tooltip__header-actions">
            <button class="alarms-summary-tooltip__header-btn" data-action="close" title="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="alarms-summary-tooltip__body">
          <div class="alarms-summary-tooltip__not-released">
            <span class="alarms-summary-tooltip__not-released-icon">🔒</span>
            <span class="alarms-summary-tooltip__not-released-title">Funcionalidade Nao Liberada</span>
            <span class="alarms-summary-tooltip__not-released-message">
              O resumo de alarmes estara disponivel em breve.
              Esta funcionalidade esta em desenvolvimento.
            </span>
            <span class="alarms-summary-tooltip__not-released-badge">
              📋 RFC-0116 Em Desenvolvimento
            </span>
          </div>
        </div>
      </div>
    `;
  },

  // Timer for delayed hide
  _hideTimer: null as ReturnType<typeof setTimeout> | null,
  _isMouseOverTooltip: false,
  _isDragging: false,
  _dragOffset: { x: 0, y: 0 },

  /**
   * Show tooltip for an element
   */
  show(triggerElement: HTMLElement, summary?: AlarmsSummaryData, event?: MouseEvent): void {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }

    const container = this.getContainer();
    container.classList.remove('closing');
    container.innerHTML = this.renderHTML(summary);

    // Position tooltip near the trigger element
    const rect = triggerElement.getBoundingClientRect();
    let left = rect.right + 12;
    let top = rect.top;

    const tooltipWidth = 320;
    const tooltipHeight = 280;

    if (left + tooltipWidth > window.innerWidth - 16) {
      left = rect.left - tooltipWidth - 12;
    }
    if (left < 16) {
      left = Math.max(16, (window.innerWidth - tooltipWidth) / 2);
    }

    if (top + tooltipHeight > window.innerHeight - 16) {
      top = window.innerHeight - tooltipHeight - 16;
    }
    if (top < 16) top = 16;

    container.style.left = left + 'px';
    container.style.top = top + 'px';
    container.classList.add('visible');

    this._setupTooltipHoverListeners(container);
    this._setupButtonListeners(container);
    this._setupDragListeners(container);
  },

  /**
   * Setup button click listeners
   */
  _setupButtonListeners(container: HTMLElement): void {
    const closeBtn = container.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
    }
  },

  /**
   * Setup drag listeners on the header
   */
  _setupDragListeners(container: HTMLElement): void {
    const header = container.querySelector('[data-drag-handle]') as HTMLElement;
    if (!header) return;

    const self = this;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-action]')) return;

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
   * Close tooltip
   */
  close(): void {
    this._isDragging = false;

    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'pinned', 'dragging', 'closing');
    }
  },

  /**
   * Setup hover listeners on the tooltip itself
   */
  _setupTooltipHoverListeners(container: HTMLElement): void {
    container.onmouseenter = null;
    container.onmouseleave = null;

    container.onmouseenter = () => {
      this._isMouseOverTooltip = true;
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
    };

    container.onmouseleave = () => {
      this._isMouseOverTooltip = false;
      this._startDelayedHide();
    };
  },

  /**
   * Start delayed hide
   */
  _startDelayedHide(): void {
    if (this._isMouseOverTooltip) return;

    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
    }

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
      setTimeout(() => {
        this._isMouseOverTooltip = false;
        this._isDragging = false;

        container.classList.remove('visible', 'closing', 'pinned', 'dragging');
        container.innerHTML = '';
      }, 400);
    }
  },

  /**
   * Hide tooltip immediately
   */
  hide(): void {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    this._isMouseOverTooltip = false;
    this._isDragging = false;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'closing', 'pinned', 'dragging');
    }
  },

  /**
   * Attach tooltip to an element
   */
  attach(element: HTMLElement, getDataFn?: () => AlarmsSummaryData): () => void {
    const self = this;

    const handleMouseEnter = (e: MouseEvent) => {
      if (self._hideTimer) {
        clearTimeout(self._hideTimer);
        self._hideTimer = null;
      }
      const summary = getDataFn?.();
      self.show(element, summary, e);
    };

    const handleMouseLeave = () => {
      self._startDelayedHide();
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      self.hide();
    };
  },
};

// Default export
export default AlarmsSummaryTooltip;
