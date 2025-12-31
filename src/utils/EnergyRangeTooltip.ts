/**
 * EnergyRangeTooltip - Reusable Energy Range Tooltip Component
 *
 * Shows power value with ruler visualization and status ranges.
 * Used in card-head-office and template-card-v5 for energy domain devices.
 *
 * @example
 * // Attach to an element (recommended)
 * const cleanup = EnergyRangeTooltip.attach(imageElement, entityData);
 * // Later: cleanup();
 *
 * // Or manual control
 * EnergyRangeTooltip.show(element, entityData, event);
 * EnergyRangeTooltip.hide();
 */

// ============================================
// Types
// ============================================

export interface PowerRange {
  down: number;
  up: number;
}

export interface PowerRanges {
  standbyRange?: PowerRange;
  normalRange?: PowerRange;
  alertRange?: PowerRange;
  failureRange?: PowerRange;
}

export interface EnergyEntityData {
  labelOrName?: string;
  name?: string;
  instantaneousPower?: number;
  consumption_power?: number;
  powerRanges?: PowerRanges;
  ranges?: PowerRanges;
}

export type EnergyStatus = 'standby' | 'normal' | 'alert' | 'failure' | 'offline';

export interface EnergyStatusResult {
  status: EnergyStatus;
  label: string;
}

// ============================================
// CSS Styles (injected once)
// ============================================

const ENERGY_RANGE_TOOLTIP_CSS = `
/* ============================================
   Energy Range Tooltip (for domain=energy)
   Shows power ruler with current position and status ranges
   ============================================ */
.energy-range-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: translateY(5px);
}

.energy-range-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
}

.energy-range-tooltip.closing {
  opacity: 0;
  transform: translateY(5px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.energy-range-tooltip.pinned {
  box-shadow: 0 0 0 2px #047857, 0 10px 40px rgba(0, 0, 0, 0.2);
}

.energy-range-tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
}

.energy-range-tooltip.maximized .energy-range-tooltip__content {
  width: 100%;
  height: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
}

.energy-range-tooltip.maximized .energy-range-tooltip__body {
  flex: 1;
  overflow-y: auto;
}

.energy-range-tooltip.dragging {
  transition: none !important;
  cursor: move;
}

.energy-range-tooltip__content {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08);
  min-width: 300px;
  max-width: 360px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
}

.energy-range-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(90deg, #ecfdf5 0%, #d1fae5 100%);
  border-bottom: 1px solid #6ee7b7;
  cursor: move;
  user-select: none;
}

.energy-range-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.energy-range-tooltip__header-btn {
  width: 22px;
  height: 22px;
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

.energy-range-tooltip__header-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  color: #1e293b;
}

.energy-range-tooltip__header-btn.pinned {
  background: #047857;
  color: white;
}

.energy-range-tooltip__header-btn.pinned:hover {
  background: #065f46;
  color: white;
}

.energy-range-tooltip__header-btn svg {
  width: 12px;
  height: 12px;
}

.energy-range-tooltip__icon {
  font-size: 18px;
}

.energy-range-tooltip__title {
  font-weight: 700;
  font-size: 13px;
  color: #047857;
  flex: 1;
}

.energy-range-tooltip__body {
  padding: 16px;
}

/* Power value display */
.energy-range-tooltip__value-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.energy-range-tooltip__current {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.energy-range-tooltip__current sup {
  font-size: 14px;
  color: #64748b;
}

.energy-range-tooltip__status-badge {
  text-align: right;
}

.energy-range-tooltip__status-value {
  font-size: 14px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
}

.energy-range-tooltip__status-value.standby {
  background: #dbeafe;
  color: #1d4ed8;
}

.energy-range-tooltip__status-value.normal {
  background: #dcfce7;
  color: #15803d;
}

.energy-range-tooltip__status-value.alert {
  background: #fef3c7;
  color: #b45309;
}

.energy-range-tooltip__status-value.failure {
  background: #fee2e2;
  color: #b91c1c;
}

.energy-range-tooltip__status-value.offline {
  background: #f3f4f6;
  color: #6b7280;
}

/* Power ruler/gauge */
.energy-range-tooltip__ruler {
  position: relative;
  height: 40px;
  margin: 12px 0;
  border-radius: 8px;
  overflow: visible;
}

.energy-range-tooltip__ruler-track {
  position: absolute;
  top: 16px;
  left: 0;
  right: 0;
  height: 8px;
  display: flex;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.energy-range-tooltip__ruler-segment {
  height: 100%;
}

.energy-range-tooltip__ruler-segment.standby {
  background: #dbeafe;
}

.energy-range-tooltip__ruler-segment.normal {
  background: #dcfce7;
}

.energy-range-tooltip__ruler-segment.alert {
  background: #fef3c7;
}

.energy-range-tooltip__ruler-segment.failure {
  background: #fee2e2;
}

.energy-range-tooltip__ruler-marker {
  position: absolute;
  top: 8px;
  width: 4px;
  height: 24px;
  background: #1e293b;
  border-radius: 2px;
  transform: translateX(-50%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.energy-range-tooltip__ruler-marker::after {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: #1e293b;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Range info grid */
.energy-range-tooltip__ranges {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 16px;
}

.energy-range-tooltip__range-item {
  text-align: center;
  padding: 8px 4px;
  border-radius: 6px;
  background: #f8fafc;
}

.energy-range-tooltip__range-item.standby {
  border-left: 3px solid #3b82f6;
}

.energy-range-tooltip__range-item.normal {
  border-left: 3px solid #22c55e;
}

.energy-range-tooltip__range-item.alert {
  border-left: 3px solid #f59e0b;
}

.energy-range-tooltip__range-item.failure {
  border-left: 3px solid #ef4444;
}

.energy-range-tooltip__range-label {
  font-size: 9px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 2px;
}

.energy-range-tooltip__range-value {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
}

/* Status info */
.energy-range-tooltip__status-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.energy-range-tooltip__status-info.standby {
  background: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #93c5fd;
}

.energy-range-tooltip__status-info.normal {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}

.energy-range-tooltip__status-info.alert {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fcd34d;
}

.energy-range-tooltip__status-info.failure {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
}

.energy-range-tooltip__status-info.offline {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #d1d5db;
}
`;

// ============================================
// CSS Injection Helper
// ============================================

let cssInjected = false;

function injectCSS(): void {
  if (cssInjected) return;
  if (typeof document === 'undefined') return;

  const styleId = 'myio-energy-range-tooltip-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = ENERGY_RANGE_TOOLTIP_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ============================================
// Status Labels
// ============================================

const STATUS_LABELS: Record<EnergyStatus, string> = {
  standby: 'Standby',
  normal: 'Operacao Normal',
  alert: 'Alerta',
  failure: 'Falha',
  offline: 'Fora da faixa'
};

const STATUS_INFO_LABELS: Record<EnergyStatus, string> = {
  standby: '🔵 Standby',
  normal: '✅ Operacao Normal',
  alert: '⚠️ Alerta',
  failure: '🔴 Falha',
  offline: '⚫ Offline / Sem dados'
};

// ============================================
// EnergyRangeTooltip Object
// ============================================

export const EnergyRangeTooltip = {
  containerId: 'myio-energy-range-tooltip',

  // State for delayed hide, maximize, and drag (PIN creates clones instead of toggling state)
  _hideTimer: null as ReturnType<typeof setTimeout> | null,
  _isMouseOverTooltip: false,
  _isMaximized: false,
  _isDragging: false,
  _dragOffset: { x: 0, y: 0 },
  _savedPosition: null as { left: string; top: string } | null,

  /**
   * Create or get the tooltip container
   */
  getContainer(): HTMLElement {
    injectCSS();

    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'energy-range-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Determine status based on power value and ranges
   */
  calculateStatus(powerValue: number | null | undefined, ranges: PowerRanges | undefined): EnergyStatusResult {
    if (!ranges || powerValue == null) {
      return { status: 'offline', label: 'Sem dados' };
    }

    const power = Number(powerValue) || 0;
    const { standbyRange, normalRange, alertRange, failureRange } = ranges;

    if (standbyRange && power >= standbyRange.down && power <= standbyRange.up) {
      return { status: 'standby', label: STATUS_LABELS.standby };
    }
    if (normalRange && power >= normalRange.down && power <= normalRange.up) {
      return { status: 'normal', label: STATUS_LABELS.normal };
    }
    if (alertRange && power >= alertRange.down && power <= alertRange.up) {
      return { status: 'alert', label: STATUS_LABELS.alert };
    }
    if (failureRange && power >= failureRange.down && power <= failureRange.up) {
      return { status: 'failure', label: STATUS_LABELS.failure };
    }

    return { status: 'offline', label: STATUS_LABELS.offline };
  },

  /**
   * Calculate marker position on ruler (0-100%)
   */
  calculateMarkerPosition(powerValue: number | null | undefined, ranges: PowerRanges | undefined): number {
    if (!ranges) return 50;

    const power = Number(powerValue) || 0;
    const maxRange = ranges.failureRange?.up || ranges.alertRange?.up || 1000;

    // Use 80% of ruler for normal display, leave room for failure range
    const displayMax = Math.min(maxRange, (ranges.alertRange?.up || maxRange) * 1.2);
    const position = (power / displayMax) * 100;

    return Math.max(2, Math.min(98, position));
  },

  /**
   * Calculate segment widths for the ruler
   */
  calculateSegmentWidths(ranges: PowerRanges | undefined): { standby: number; normal: number; alert: number; failure: number } {
    if (!ranges) return { standby: 25, normal: 25, alert: 25, failure: 25 };

    const maxValue = ranges.failureRange?.up || 10000;
    const total = Math.min(maxValue, (ranges.alertRange?.up || maxValue) * 1.2);

    return {
      standby: ((ranges.standbyRange?.up || 0) / total) * 100,
      normal: (((ranges.normalRange?.up || 0) - (ranges.normalRange?.down || 0)) / total) * 100,
      alert: (((ranges.alertRange?.up || 0) - (ranges.alertRange?.down || 0)) / total) * 100,
      failure: Math.max(5, 100 - ((ranges.alertRange?.up || 0) / total) * 100)
    };
  },

  /**
   * Format power value for display
   */
  formatPower(value: number | null | undefined): string {
    if (value == null || isNaN(Number(value))) return '-';
    const num = Number(value);
    if (num >= 1000) {
      return `${(num / 1000).toFixed(2)} kW`;
    }
    return `${Math.round(num)} W`;
  },

  /**
   * Show tooltip for an energy card
   */
  show(triggerElement: HTMLElement, entityObject: EnergyEntityData, event?: MouseEvent): void {
    // Cancel any pending hide
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }

    const container = this.getContainer();
    container.classList.remove('closing');

    const powerValue = entityObject.instantaneousPower ?? entityObject.consumption_power ?? 0;
    const ranges = entityObject.powerRanges || entityObject.ranges;
    const hasRanges = ranges && ranges.normalRange;

    const { status, label } = this.calculateStatus(powerValue, ranges);
    const markerPos = this.calculateMarkerPosition(powerValue, ranges);
    const segmentWidths = this.calculateSegmentWidths(ranges);

    const rangesHtml = hasRanges && ranges ? `
      <div class="energy-range-tooltip__ruler">
        <div class="energy-range-tooltip__ruler-track">
          <div class="energy-range-tooltip__ruler-segment standby" style="width: ${segmentWidths.standby}%"></div>
          <div class="energy-range-tooltip__ruler-segment normal" style="width: ${segmentWidths.normal}%"></div>
          <div class="energy-range-tooltip__ruler-segment alert" style="width: ${segmentWidths.alert}%"></div>
          <div class="energy-range-tooltip__ruler-segment failure" style="width: ${segmentWidths.failure}%"></div>
        </div>
        <div class="energy-range-tooltip__ruler-marker" style="left: ${markerPos}%;"></div>
      </div>

      <div class="energy-range-tooltip__ranges">
        <div class="energy-range-tooltip__range-item standby">
          <div class="energy-range-tooltip__range-label">Standby</div>
          <div class="energy-range-tooltip__range-value">${ranges.standbyRange?.down || 0}-${ranges.standbyRange?.up || 0}W</div>
        </div>
        <div class="energy-range-tooltip__range-item normal">
          <div class="energy-range-tooltip__range-label">Normal</div>
          <div class="energy-range-tooltip__range-value">${ranges.normalRange?.down || 0}-${ranges.normalRange?.up || 0}W</div>
        </div>
        <div class="energy-range-tooltip__range-item alert">
          <div class="energy-range-tooltip__range-label">Alerta</div>
          <div class="energy-range-tooltip__range-value">${ranges.alertRange?.down || 0}-${ranges.alertRange?.up || 0}W</div>
        </div>
        <div class="energy-range-tooltip__range-item failure">
          <div class="energy-range-tooltip__range-label">Falha</div>
          <div class="energy-range-tooltip__range-value">&gt;${ranges.failureRange?.down || 0}W</div>
        </div>
      </div>
    ` : `
      <div style="text-align: center; padding: 16px; color: #64748b; font-size: 12px;">
        Ranges de potencia nao configurados
      </div>
    `;

    container.innerHTML = `
      <div class="energy-range-tooltip__content">
        <div class="energy-range-tooltip__header" data-drag-handle>
          <span class="energy-range-tooltip__icon">⚡</span>
          <span class="energy-range-tooltip__title">${entityObject.labelOrName || entityObject.name || 'Equipamento'}</span>
          <div class="energy-range-tooltip__header-actions">
            <button class="energy-range-tooltip__header-btn" data-action="pin" title="Fixar na tela">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
                <line x1="12" y1="16" x2="12" y2="21"/>
                <line x1="8" y1="4" x2="16" y2="4"/>
              </svg>
            </button>
            <button class="energy-range-tooltip__header-btn" data-action="maximize" title="Maximizar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>
            <button class="energy-range-tooltip__header-btn" data-action="close" title="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="energy-range-tooltip__body">
          <div class="energy-range-tooltip__value-row">
            <div class="energy-range-tooltip__current">
              ${this.formatPower(powerValue)}
            </div>
            <div class="energy-range-tooltip__status-badge">
              <span class="energy-range-tooltip__status-value ${status}">${label}</span>
            </div>
          </div>

          ${rangesHtml}

          <div class="energy-range-tooltip__status-info ${status}">
            ${STATUS_INFO_LABELS[status] || STATUS_INFO_LABELS.offline}
          </div>
        </div>
      </div>
    `;

    // Position tooltip near trigger element (not following mouse)
    const rect = triggerElement.getBoundingClientRect();
    let left = rect.right + 12;
    let top = rect.top;

    // Adjust if goes off screen
    const tooltipWidth = 320;
    const tooltipHeight = 380;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = rect.left - tooltipWidth - 12;
    }
    if (left < 10) left = 10;
    if (top + tooltipHeight > window.innerHeight - 10) {
      top = window.innerHeight - tooltipHeight - 10;
    }
    if (top < 10) top = 10;

    container.style.left = left + 'px';
    container.style.top = top + 'px';
    container.classList.add('visible');

    // Setup listeners
    this._setupTooltipHoverListeners(container);
    this._setupButtonListeners(container);
    this._setupDragListeners(container);
  },

  /**
   * Setup hover listeners on the tooltip itself
   */
  _setupTooltipHoverListeners(container: HTMLElement): void {
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
   * Setup button click listeners
   */
  _setupButtonListeners(container: HTMLElement): void {
    const buttons = container.querySelectorAll('[data-action]');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;
        if (action === 'pin') this.togglePin();
        else if (action === 'maximize') this.toggleMaximize();
        else if (action === 'close') this.close();
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
      if ((e.target as HTMLElement).closest('[data-action]')) return;
      if (self._isMaximized) return;

      self._isDragging = true;
      container.classList.add('dragging');

      const rect = container.getBoundingClientRect();
      self._dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

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

    // Update the PIN button to show it's pinned
    const pinBtn = clone.querySelector('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.classList.add('pinned');
      pinBtn.setAttribute('title', 'Desafixar');
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
        if (isMaximized) savedPosition = { left: clone.style.left, top: clone.style.top };
        clone.classList.toggle('maximized', isMaximized);
        if (isMaximized) {
          maxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 5V3h12v12h-2"/></svg>';
          maxBtn.setAttribute('title', 'Restaurar');
        } else {
          maxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
          maxBtn.setAttribute('title', 'Maximizar');
          if (savedPosition) { clone.style.left = savedPosition.left; clone.style.top = savedPosition.top; }
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
      setTimeout(() => clone.remove(), 400);
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
      this._savedPosition = { left: container.style.left, top: container.style.top };
    }
    container.classList.toggle('maximized', this._isMaximized);

    const maxBtn = container.querySelector('[data-action="maximize"]');
    if (maxBtn) {
      if (this._isMaximized) {
        maxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 5V3h12v12h-2"/></svg>';
        maxBtn.setAttribute('title', 'Restaurar');
      } else {
        maxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
        maxBtn.setAttribute('title', 'Maximizar');
        if (this._savedPosition) {
          container.style.left = this._savedPosition.left;
          container.style.top = this._savedPosition.top;
        }
      }
    }
  },

  /**
   * Close tooltip
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
   * Start delayed hide with animation
   */
  _startDelayedHide(): void {
    if (this._isMouseOverTooltip) return;
    if (this._hideTimer) clearTimeout(this._hideTimer);

    this._hideTimer = setTimeout(() => {
      this.hideWithAnimation();
    }, 1500);
  },

  /**
   * Hide with fade animation
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

        // Remove all classes and clear content
        container.classList.remove('visible', 'closing', 'pinned', 'maximized', 'dragging');
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
  attach(element: HTMLElement, entityData: EnergyEntityData): () => void {
    const self = this;

    const handleMouseEnter = (e: MouseEvent) => {
      if (self._hideTimer) {
        clearTimeout(self._hideTimer);
        self._hideTimer = null;
      }
      self.show(element, entityData, e);
    };

    const handleMouseLeave = () => {
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
  }
};
