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
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  transform: translateY(5px);
}

.energy-range-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
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
}

.energy-range-tooltip__icon {
  font-size: 18px;
}

.energy-range-tooltip__title {
  font-weight: 700;
  font-size: 13px;
  color: #047857;
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
    const container = this.getContainer();

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
        <div class="energy-range-tooltip__header">
          <span class="energy-range-tooltip__icon">⚡</span>
          <span class="energy-range-tooltip__title">${entityObject.labelOrName || entityObject.name || 'Equipamento'}</span>
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

    // Position tooltip at cursor position
    let left: number, top: number;
    if (event && event.clientX && event.clientY) {
      left = event.clientX + 8;
      top = event.clientY + 8;
    } else {
      const rect = triggerElement.getBoundingClientRect();
      left = rect.left + rect.width / 2 - 150;
      top = rect.bottom + 8;
    }

    // Adjust if goes off screen
    const tooltipWidth = 320;
    const tooltipHeight = 380;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = (event?.clientX || left) - tooltipWidth - 8;
    }
    if (left < 10) left = 10;
    if (top + tooltipHeight > window.innerHeight - 10) {
      top = (event?.clientY || top) - tooltipHeight - 8;
    }
    if (top < 10) top = 10;

    container.style.left = left + 'px';
    container.style.top = top + 'px';
    container.classList.add('visible');
  },

  /**
   * Hide tooltip
   */
  hide(): void {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible');
    }
  },

  /**
   * Attach tooltip to an element with automatic show/hide on hover
   * Returns cleanup function to remove event listeners
   */
  attach(element: HTMLElement, entityData: EnergyEntityData): () => void {
    const handleMouseEnter = (e: MouseEvent) => {
      this.show(element, entityData, e);
    };

    const handleMouseLeave = () => {
      this.hide();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById(this.containerId);
      if (container && container.classList.contains('visible')) {
        let left = e.clientX + 8;
        let top = e.clientY + 8;

        const tooltipWidth = 320;
        const tooltipHeight = 380;
        if (left + tooltipWidth > window.innerWidth - 10) {
          left = e.clientX - tooltipWidth - 8;
        }
        if (left < 10) left = 10;
        if (top + tooltipHeight > window.innerHeight - 10) {
          top = e.clientY - tooltipHeight - 8;
        }
        if (top < 10) top = 10;

        container.style.left = left + 'px';
        container.style.top = top + 'px';
      }
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('mousemove', handleMouseMove);

    // Return cleanup function
    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('mousemove', handleMouseMove);
      this.hide();
    };
  }
};
