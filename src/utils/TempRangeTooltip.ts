/**
 * Temperature Range Tooltip Component
 *
 * A reusable tooltip that shows temperature status with:
 * - Current temperature value
 * - Visual ruler showing position within configured range
 * - Deviation percentage from ideal range
 * - Status indicators (cold/ok/hot)
 *
 * @module TempRangeTooltip
 */

// ============================================================================
// Types
// ============================================================================

export interface TempEntityData {
  /** Current temperature value */
  val?: number;
  currentTemperature?: number;
  temperature?: number;
  /** Minimum temperature of ideal range */
  temperatureMin?: number;
  minTemperature?: number;
  /** Maximum temperature of ideal range */
  temperatureMax?: number;
  maxTemperature?: number;
  /** Display label */
  labelOrName?: string;
  name?: string;
  label?: string;
}

export type TempStatus = 'cold' | 'ok' | 'hot' | 'unknown';

export interface TempStatusResult {
  status: TempStatus;
  deviation: number | null;
  deviationPercent: number | null;
}

// ============================================================================
// CSS Styles
// ============================================================================

const TOOLTIP_STYLES = `
.temp-range-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  transform: translateY(5px);
}

.temp-range-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.temp-range-tooltip__content {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08);
  min-width: 280px;
  max-width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
}

.temp-range-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(90deg, #fff7ed 0%, #fed7aa 100%);
  border-bottom: 1px solid #fdba74;
}

.temp-range-tooltip__icon {
  font-size: 18px;
}

.temp-range-tooltip__title {
  font-weight: 700;
  font-size: 13px;
  color: #c2410c;
}

.temp-range-tooltip__body {
  padding: 16px;
}

.temp-range-tooltip__value-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.temp-range-tooltip__current {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.temp-range-tooltip__current sup {
  font-size: 14px;
  color: #64748b;
}

.temp-range-tooltip__deviation {
  text-align: right;
}

.temp-range-tooltip__deviation-value {
  font-size: 16px;
  font-weight: 700;
}

.temp-range-tooltip__deviation-value.cold {
  color: #2563eb;
}

.temp-range-tooltip__deviation-value.ok {
  color: #16a34a;
}

.temp-range-tooltip__deviation-value.hot {
  color: #dc2626;
}

.temp-range-tooltip__deviation-label {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.temp-range-tooltip__ruler {
  position: relative;
  height: 32px;
  margin: 12px 0;
  border-radius: 8px;
  overflow: visible;
}

.temp-range-tooltip__ruler-track {
  position: absolute;
  top: 12px;
  left: 0;
  right: 0;
  height: 8px;
  background: linear-gradient(90deg, #dbeafe 0%, #dcfce7 50%, #fee2e2 100%);
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.temp-range-tooltip__ruler-range {
  position: absolute;
  top: 12px;
  height: 8px;
  background: #22c55e;
  border-radius: 4px;
  opacity: 0.6;
}

.temp-range-tooltip__ruler-marker {
  position: absolute;
  top: 4px;
  width: 4px;
  height: 24px;
  background: #1e293b;
  border-radius: 2px;
  transform: translateX(-50%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.temp-range-tooltip__ruler-marker::after {
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

.temp-range-tooltip__ruler-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 10px;
  color: #64748b;
}

.temp-range-tooltip__ruler-min,
.temp-range-tooltip__ruler-max {
  font-weight: 600;
}

.temp-range-tooltip__range-info {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
  margin-top: 12px;
}

.temp-range-tooltip__range-item {
  text-align: center;
}

.temp-range-tooltip__range-label {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 2px;
}

.temp-range-tooltip__range-value {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.temp-range-tooltip__status {
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

.temp-range-tooltip__status.cold {
  background: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #93c5fd;
}

.temp-range-tooltip__status.ok {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}

.temp-range-tooltip__status.hot {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
}

.temp-range-tooltip__status.unknown {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #d1d5db;
}
`;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Inject tooltip styles into document head (only once)
 */
function injectStyles(): void {
  if (typeof document === 'undefined') return;

  const styleId = 'myio-temp-range-tooltip-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = TOOLTIP_STYLES;
  document.head.appendChild(style);
}

/**
 * Extract temperature value from entity data
 */
function extractTemperature(entityData: TempEntityData): number {
  return Number(entityData.val ?? entityData.currentTemperature ?? entityData.temperature) || 0;
}

/**
 * Extract min/max range from entity data
 */
function extractRange(entityData: TempEntityData): { tempMin: number | null; tempMax: number | null } {
  const tempMin = entityData.temperatureMin ?? entityData.minTemperature ?? null;
  const tempMax = entityData.temperatureMax ?? entityData.maxTemperature ?? null;
  return { tempMin, tempMax };
}

/**
 * Extract display label from entity data
 */
function extractLabel(entityData: TempEntityData): string {
  return entityData.labelOrName || entityData.name || entityData.label || 'Sensor';
}

// ============================================================================
// TempRangeTooltip Object
// ============================================================================

export const TempRangeTooltip = {
  containerId: 'myio-temp-range-tooltip',

  /**
   * Create or get the tooltip container
   */
  getContainer(): HTMLElement {
    injectStyles();

    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'temp-range-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Calculate temperature status and deviation
   */
  calculateStatus(currentTemp: number, tempMin: number | null, tempMax: number | null): TempStatusResult {
    if (tempMin == null || tempMax == null) {
      return { status: 'unknown', deviation: null, deviationPercent: null };
    }

    const rangeSize = tempMax - tempMin;
    const midPoint = (tempMin + tempMax) / 2;

    if (currentTemp < tempMin) {
      const deviation = tempMin - currentTemp;
      const deviationPercent = rangeSize > 0 ? (deviation / rangeSize) * 100 : 0;
      return { status: 'cold', deviation: -deviation, deviationPercent: -deviationPercent };
    } else if (currentTemp > tempMax) {
      const deviation = currentTemp - tempMax;
      const deviationPercent = rangeSize > 0 ? (deviation / rangeSize) * 100 : 0;
      return { status: 'hot', deviation: deviation, deviationPercent: deviationPercent };
    } else {
      // Within range - show deviation from midpoint
      const deviationFromMid = currentTemp - midPoint;
      const halfRange = rangeSize / 2;
      const deviationPercent = halfRange > 0 ? (deviationFromMid / halfRange) * 100 : 0;
      return { status: 'ok', deviation: deviationFromMid, deviationPercent: 0 };
    }
  },

  /**
   * Calculate marker position on ruler (0-100%)
   */
  calculateMarkerPosition(currentTemp: number, tempMin: number | null, tempMax: number | null): number {
    if (tempMin == null || tempMax == null) return 50;

    // Extend visible range by 30% on each side for out-of-range temps
    const rangeSize = tempMax - tempMin;
    const extension = rangeSize * 0.3;
    const visibleMin = tempMin - extension;
    const visibleMax = tempMax + extension;
    const visibleRange = visibleMax - visibleMin;

    // Clamp current temp to visible range
    const clampedTemp = Math.max(visibleMin, Math.min(visibleMax, currentTemp));
    const position = ((clampedTemp - visibleMin) / visibleRange) * 100;

    return Math.max(2, Math.min(98, position));
  },

  /**
   * Show tooltip for a temperature card
   * @param triggerElement - The card element
   * @param entityData - Entity data with temperature info
   * @param event - Mouse event for cursor position
   */
  show(triggerElement: HTMLElement, entityData: TempEntityData, event?: MouseEvent): void {
    const container = this.getContainer();

    const currentTemp = extractTemperature(entityData);
    const { tempMin, tempMax } = extractRange(entityData);
    const label = extractLabel(entityData);
    const hasRange = tempMin != null && tempMax != null;

    const { status, deviationPercent } = this.calculateStatus(currentTemp, tempMin, tempMax);
    const markerPos = this.calculateMarkerPosition(currentTemp, tempMin, tempMax);

    // Calculate green range position on ruler
    let rangeLeft = 0, rangeWidth = 100;
    if (hasRange && tempMin != null && tempMax != null) {
      const rangeSize = tempMax - tempMin;
      const extension = rangeSize * 0.3;
      const visibleMin = tempMin - extension;
      const visibleMax = tempMax + extension;
      const visibleRange = visibleMax - visibleMin;
      rangeLeft = ((tempMin - visibleMin) / visibleRange) * 100;
      rangeWidth = (rangeSize / visibleRange) * 100;
    }

    // Status labels
    const statusLabels: Record<TempStatus, string> = {
      cold: '❄️ Abaixo da Faixa Ideal',
      ok: '✔️ Dentro da Faixa Ideal',
      hot: '🔥 Acima da Faixa Ideal',
      unknown: '❓ Faixa Não Configurada'
    };

    // Status colors for current value
    const statusColors: Record<TempStatus, string> = {
      cold: '#2563eb',
      ok: '#16a34a',
      hot: '#dc2626',
      unknown: '#64748b'
    };

    container.innerHTML = `
      <div class="temp-range-tooltip__content">
        <div class="temp-range-tooltip__header">
          <span class="temp-range-tooltip__icon">🌡️</span>
          <span class="temp-range-tooltip__title">${label}</span>
        </div>
        <div class="temp-range-tooltip__body">
          <div class="temp-range-tooltip__value-row">
            <div class="temp-range-tooltip__current">
              ${currentTemp.toFixed(1)}<sup>°C</sup>
            </div>
            <div class="temp-range-tooltip__deviation">
              <div class="temp-range-tooltip__deviation-value ${status}">
                ${status === 'ok' ? '✓' : (status === 'cold' ? '↓' : (status === 'hot' ? '↑' : '?'))} ${Math.abs(deviationPercent || 0).toFixed(0)}%
              </div>
              <div class="temp-range-tooltip__deviation-label">Desvio</div>
            </div>
          </div>

          ${hasRange ? `
          <div class="temp-range-tooltip__ruler">
            <div class="temp-range-tooltip__ruler-track"></div>
            <div class="temp-range-tooltip__ruler-range" style="left: ${rangeLeft}%; width: ${rangeWidth}%;"></div>
            <div class="temp-range-tooltip__ruler-marker" style="left: ${markerPos}%;"></div>
          </div>
          <div class="temp-range-tooltip__ruler-labels">
            <span class="temp-range-tooltip__ruler-min">${tempMin}°C</span>
            <span style="color: #22c55e; font-weight: 600;">Faixa Ideal</span>
            <span class="temp-range-tooltip__ruler-max">${tempMax}°C</span>
          </div>
          ` : ''}

          <div class="temp-range-tooltip__range-info">
            <div class="temp-range-tooltip__range-item">
              <div class="temp-range-tooltip__range-label">Mínimo</div>
              <div class="temp-range-tooltip__range-value">${hasRange ? tempMin + '°C' : '--'}</div>
            </div>
            <div class="temp-range-tooltip__range-item">
              <div class="temp-range-tooltip__range-label">Atual</div>
              <div class="temp-range-tooltip__range-value" style="color: ${statusColors[status]}">${currentTemp.toFixed(1)}°C</div>
            </div>
            <div class="temp-range-tooltip__range-item">
              <div class="temp-range-tooltip__range-label">Máximo</div>
              <div class="temp-range-tooltip__range-value">${hasRange ? tempMax + '°C' : '--'}</div>
            </div>
          </div>

          <div class="temp-range-tooltip__status ${status}">
            ${statusLabels[status]}
          </div>
        </div>
      </div>
    `;

    // Position tooltip at cursor position
    let left: number, top: number;
    if (event && event.clientX && event.clientY) {
      // Use cursor position with small offset
      left = event.clientX + 15;
      top = event.clientY + 15;
    } else {
      // Fallback to element position
      const rect = triggerElement.getBoundingClientRect();
      left = rect.left + rect.width / 2 - 150;
      top = rect.bottom + 8;
    }

    // Adjust if goes off screen
    const tooltipWidth = 300;
    const tooltipHeight = 350;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = (event?.clientX || left) - tooltipWidth - 15;
    }
    if (left < 10) left = 10;
    if (top + tooltipHeight > window.innerHeight - 10) {
      top = (event?.clientY || top) - tooltipHeight - 15;
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
   * Attach tooltip to an element
   * Returns cleanup function
   */
  attach(element: HTMLElement, entityData: TempEntityData): () => void {
    const showHandler = (e: MouseEvent) => this.show(element, entityData, e);
    const hideHandler = () => this.hide();

    element.style.cursor = 'help';
    element.addEventListener('mouseenter', showHandler);
    element.addEventListener('mouseleave', hideHandler);

    // Return cleanup function
    return () => {
      element.removeEventListener('mouseenter', showHandler);
      element.removeEventListener('mouseleave', hideHandler);
      element.style.cursor = '';
      this.hide();
    };
  }
};

// Default export
export default TempRangeTooltip;
