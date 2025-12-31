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
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: translateY(5px);
}

.temp-range-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
}

.temp-range-tooltip.closing {
  opacity: 0;
  transform: translateY(5px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.temp-range-tooltip.pinned {
  box-shadow: 0 0 0 2px #c2410c, 0 10px 40px rgba(0, 0, 0, 0.2);
}

.temp-range-tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
}

.temp-range-tooltip.maximized .temp-range-tooltip__content {
  width: 100%;
  height: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
}

.temp-range-tooltip.maximized .temp-range-tooltip__body {
  flex: 1;
  overflow-y: auto;
}

.temp-range-tooltip.dragging {
  transition: none !important;
  cursor: move;
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
  cursor: move;
  user-select: none;
}

.temp-range-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.temp-range-tooltip__header-btn {
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

.temp-range-tooltip__header-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  color: #1e293b;
}

.temp-range-tooltip__header-btn.pinned {
  background: #c2410c;
  color: white;
}

.temp-range-tooltip__header-btn.pinned:hover {
  background: #9a3412;
  color: white;
}

.temp-range-tooltip__header-btn svg {
  width: 12px;
  height: 12px;
}

.temp-range-tooltip__icon {
  font-size: 18px;
}

.temp-range-tooltip__title {
  font-weight: 700;
  font-size: 13px;
  color: #c2410c;
  flex: 1;
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
    // Cancel any pending hide
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }

    const container = this.getContainer();
    container.classList.remove('closing');

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
        <div class="temp-range-tooltip__header" data-drag-handle>
          <span class="temp-range-tooltip__icon">🌡️</span>
          <span class="temp-range-tooltip__title">${label}</span>
          <div class="temp-range-tooltip__header-actions">
            <button class="temp-range-tooltip__header-btn" data-action="pin" title="Fixar na tela">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
                <line x1="12" y1="16" x2="12" y2="21"/>
                <line x1="8" y1="4" x2="16" y2="4"/>
              </svg>
            </button>
            <button class="temp-range-tooltip__header-btn" data-action="maximize" title="Maximizar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>
            <button class="temp-range-tooltip__header-btn" data-action="close" title="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
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

    // Position tooltip near trigger element (not following mouse)
    const rect = triggerElement.getBoundingClientRect();
    let left = rect.right + 12;
    let top = rect.top;

    // Adjust if goes off screen
    const tooltipWidth = 300;
    const tooltipHeight = 350;
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
      setTimeout(() => {
        // Reset state to prevent invisible blocking divs
        this._isMouseOverTooltip = false;
        this._isMaximized = false;
        this._isDragging = false;
        this._savedPosition = null;

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
   * Attach tooltip to an element
   * Returns cleanup function
   */
  attach(element: HTMLElement, entityData: TempEntityData): () => void {
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

    element.style.cursor = 'help';
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    // Return cleanup function
    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.style.cursor = '';
      self.hide();
    };
  }
};

// Default export
export default TempRangeTooltip;
