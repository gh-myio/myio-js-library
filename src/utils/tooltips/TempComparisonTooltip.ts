/**
 * TempComparisonTooltip - Premium Temperature Comparison Tooltip Component
 * RFC-0110: Premium tooltip showing temperature comparison with average
 *
 * Features:
 * - Draggable header
 * - PIN button (creates independent clone)
 * - Maximize/restore button
 * - Close button
 * - Delayed hide (1.5s) with hover detection
 * - Smooth animations
 *
 * Shows:
 * - Current temperature and deviation from average
 * - Device vs Average comparison with visual bar
 *
 * @example
 * // Attach to an element
 * const cleanup = TempComparisonTooltip.attach(triggerElement, getDataFn);
 * // Later: cleanup();
 *
 * // Or manual control
 * TempComparisonTooltip.show(element, data);
 * TempComparisonTooltip.hide();
 */

// ============================================
// Types
// ============================================

export interface TempComparisonData {
  /** Device info */
  device: {
    id: string;
    name: string;
    currentTemp: number;
    minTemp: number;
    maxTemp: number;
  };
  /** Average comparison */
  average: {
    name: string;
    value: number;
    deviceCount: number;
  };
  /** Last update timestamp */
  lastUpdated?: string;
}

// ============================================
// CSS Styles
// ============================================

const TEMP_COMPARISON_TOOLTIP_CSS = `
/* ============================================
   Temp Comparison Tooltip (RFC-0110)
   Premium draggable tooltip with actions
   ============================================ */

.myio-temp-comparison-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease, transform 0.25s ease;
  transform: translateY(5px);
}

.myio-temp-comparison-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.myio-temp-comparison-tooltip.closing {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.myio-temp-comparison-tooltip.pinned {
  box-shadow: 0 0 0 2px #f97316, 0 10px 40px rgba(0, 0, 0, 0.2);
  border-radius: 16px;
}

.myio-temp-comparison-tooltip.dragging {
  transition: none !important;
  cursor: move;
}

.myio-temp-comparison-tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
}

.myio-temp-comparison-tooltip.maximized .myio-temp-comparison-tooltip__panel {
  width: 100%;
  height: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
}

.myio-temp-comparison-tooltip.maximized .myio-temp-comparison-tooltip__body {
  flex: 1;
  overflow-y: auto;
}

.myio-temp-comparison-tooltip__panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.15),
    0 8px 20px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.02);
  min-width: 300px;
  max-width: 360px;
  font-family: Inter, system-ui, -apple-system, sans-serif;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
}

/* Header with temperature gradient */
.myio-temp-comparison-tooltip__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  border-radius: 16px 16px 0 0;
  position: relative;
  overflow: hidden;
  cursor: move;
  user-select: none;
}

.myio-temp-comparison-tooltip__header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.3;
}

.myio-temp-comparison-tooltip__icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 1;
}

.myio-temp-comparison-tooltip__header-info {
  flex: 1;
  position: relative;
  z-index: 1;
}

.myio-temp-comparison-tooltip__device-name {
  font-weight: 700;
  font-size: 15px;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  margin-bottom: 2px;
}

.myio-temp-comparison-tooltip__device-type {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.myio-temp-comparison-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
  z-index: 1;
}

.myio-temp-comparison-tooltip__header-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.8);
}

.myio-temp-comparison-tooltip__header-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  transform: scale(1.05);
}

.myio-temp-comparison-tooltip__header-btn.pinned {
  background: rgba(255, 255, 255, 0.9);
  color: #f97316;
}

.myio-temp-comparison-tooltip__header-btn.pinned:hover {
  background: #ffffff;
  color: #ea580c;
}

.myio-temp-comparison-tooltip__header-btn svg {
  width: 14px;
  height: 14px;
}

/* Body */
.myio-temp-comparison-tooltip__body {
  padding: 16px;
}

/* Main Stats Banner */
.myio-temp-comparison-tooltip__main-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.myio-temp-comparison-tooltip__stat-card {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.myio-temp-comparison-tooltip__stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.myio-temp-comparison-tooltip__stat-label {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.myio-temp-comparison-tooltip__stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.myio-temp-comparison-tooltip__stat-value.temp {
  color: #f97316;
}

.myio-temp-comparison-tooltip__stat-value.above {
  color: #ef4444;
}

.myio-temp-comparison-tooltip__stat-value.below {
  color: #3b82f6;
}

.myio-temp-comparison-tooltip__stat-value.normal {
  color: #22c55e;
}

/* Range indicator */
.myio-temp-comparison-tooltip__range {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 10px;
  margin-bottom: 16px;
  border: 1px solid #fcd34d;
}

.myio-temp-comparison-tooltip__range-label {
  font-size: 11px;
  color: #92400e;
  font-weight: 500;
}

.myio-temp-comparison-tooltip__range-value {
  font-size: 13px;
  font-weight: 700;
  color: #78350f;
}

/* Section Title */
.myio-temp-comparison-tooltip__section-title {
  font-weight: 700;
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.myio-temp-comparison-tooltip__section-icon {
  font-size: 12px;
}

/* Comparison Row */
.myio-temp-comparison-tooltip__comparison {
  background: #fafafa;
  border-radius: 12px;
  padding: 14px;
  border: 1px solid #f1f5f9;
  transition: all 0.2s ease;
}

.myio-temp-comparison-tooltip__comparison:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
}

.myio-temp-comparison-tooltip__comparison-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.myio-temp-comparison-tooltip__comparison-title {
  font-weight: 600;
  font-size: 12px;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 6px;
}

.myio-temp-comparison-tooltip__comparison-icon {
  font-size: 14px;
}

.myio-temp-comparison-tooltip__comparison-meta {
  font-size: 10px;
  color: #94a3b8;
}

/* Temperature Visual Bar */
.myio-temp-comparison-tooltip__temp-bar-container {
  margin-bottom: 12px;
  position: relative;
}

.myio-temp-comparison-tooltip__temp-bar {
  height: 12px;
  background: linear-gradient(90deg, #3b82f6 0%, #22c55e 50%, #ef4444 100%);
  border-radius: 6px;
  position: relative;
  overflow: visible;
}

.myio-temp-comparison-tooltip__temp-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: #ffffff;
  border: 3px solid;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 2;
}

.myio-temp-comparison-tooltip__temp-marker.device {
  border-color: #1e293b;
}

.myio-temp-comparison-tooltip__temp-marker.average {
  border-color: #f97316;
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.myio-temp-comparison-tooltip__temp-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  color: #94a3b8;
}

/* Stats Row */
.myio-temp-comparison-tooltip__comparison-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.myio-temp-comparison-tooltip__comparison-stat {
  text-align: center;
}

.myio-temp-comparison-tooltip__comparison-stat-label {
  font-size: 9px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 2px;
}

.myio-temp-comparison-tooltip__comparison-stat-value {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.myio-temp-comparison-tooltip__comparison-stat-value.highlight {
  font-size: 14px;
}

.myio-temp-comparison-tooltip__comparison-stat-value.above {
  color: #ef4444;
}

.myio-temp-comparison-tooltip__comparison-stat-value.below {
  color: #3b82f6;
}

.myio-temp-comparison-tooltip__comparison-stat-value.normal {
  color: #22c55e;
}

/* Status indicator */
.myio-temp-comparison-tooltip__status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  border-radius: 10px;
  margin-top: 12px;
  font-size: 12px;
  font-weight: 600;
}

.myio-temp-comparison-tooltip__status.above {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  color: #dc2626;
  border: 1px solid #fecaca;
}

.myio-temp-comparison-tooltip__status.below {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.myio-temp-comparison-tooltip__status.normal {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

.myio-temp-comparison-tooltip__status-icon {
  font-size: 16px;
}

/* Footer */
.myio-temp-comparison-tooltip__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 16px 16px;
}

.myio-temp-comparison-tooltip__footer-label {
  font-size: 10px;
  color: #64748b;
}

.myio-temp-comparison-tooltip__footer-value {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}

/* Responsive */
@media (max-width: 400px) {
  .myio-temp-comparison-tooltip__panel {
    min-width: 280px;
    max-width: 95vw;
  }

  .myio-temp-comparison-tooltip__main-stats {
    grid-template-columns: 1fr;
  }
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .myio-temp-comparison-tooltip__panel {
    background: #1e293b;
    border-color: #334155;
    color: #f1f5f9;
  }

  .myio-temp-comparison-tooltip__stat-card {
    background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
    border-color: #475569;
  }

  .myio-temp-comparison-tooltip__stat-label {
    color: #94a3b8;
  }

  .myio-temp-comparison-tooltip__stat-value {
    color: #f1f5f9;
  }

  .myio-temp-comparison-tooltip__range {
    background: linear-gradient(135deg, #422006 0%, #451a03 100%);
    border-color: #78350f;
  }

  .myio-temp-comparison-tooltip__range-label {
    color: #fcd34d;
  }

  .myio-temp-comparison-tooltip__range-value {
    color: #fde68a;
  }

  .myio-temp-comparison-tooltip__section-title {
    color: #94a3b8;
    border-color: #334155;
  }

  .myio-temp-comparison-tooltip__comparison {
    background: #334155;
    border-color: #475569;
  }

  .myio-temp-comparison-tooltip__comparison:hover {
    background: #3d4f6f;
    border-color: #4b5d7a;
  }

  .myio-temp-comparison-tooltip__comparison-title {
    color: #e2e8f0;
  }

  .myio-temp-comparison-tooltip__comparison-stat-value {
    color: #e2e8f0;
  }

  .myio-temp-comparison-tooltip__footer {
    background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
    border-color: #475569;
  }

  .myio-temp-comparison-tooltip__footer-label {
    color: #94a3b8;
  }

  .myio-temp-comparison-tooltip__footer-value {
    color: #cbd5e1;
  }
}
`;

// ============================================
// CSS Injection
// ============================================

let cssInjected = false;

function injectCSS(): void {
  if (cssInjected) return;
  if (typeof document === 'undefined') return;

  const styleId = 'myio-temp-comparison-tooltip-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = TEMP_COMPARISON_TOOLTIP_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ============================================
// State Management
// ============================================

interface TooltipState {
  hideTimer: ReturnType<typeof setTimeout> | null;
  isMouseOverTooltip: boolean;
  isMaximized: boolean;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  savedPosition: { left: string; top: string } | null;
  pinnedCounter: number;
}

const state: TooltipState = {
  hideTimer: null,
  isMouseOverTooltip: false,
  isMaximized: false,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  savedPosition: null,
  pinnedCounter: 0,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Format temperature with unit
 */
function formatTemp(value: number): string {
  if (value == null || isNaN(value)) return '0,0°C';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + '°C';
}

/**
 * Format deviation percentage
 */
function formatDeviation(value: number, sign: string): string {
  return `${sign}${Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Calculate temperature status relative to average
 */
function calculateTempStatus(currentTemp: number, avgTemp: number): {
  deviation: number;
  sign: string;
  status: 'above' | 'below' | 'normal';
  statusText: string;
  statusIcon: string;
} {
  if (avgTemp === 0) {
    return { deviation: 0, sign: '+', status: 'normal', statusText: 'Na media', statusIcon: '✓' };
  }

  const deviation = ((currentTemp - avgTemp) / avgTemp) * 100;
  const absDeviation = Math.abs(deviation);

  // Threshold: 5% deviation is considered normal
  if (absDeviation <= 5) {
    return { deviation: absDeviation, sign: deviation >= 0 ? '+' : '-', status: 'normal', statusText: 'Dentro da media', statusIcon: '✓' };
  } else if (deviation > 0) {
    return { deviation: absDeviation, sign: '+', status: 'above', statusText: 'Acima da media', statusIcon: '🔺' };
  } else {
    return { deviation: absDeviation, sign: '-', status: 'below', statusText: 'Abaixo da media', statusIcon: '🔻' };
  }
}

/**
 * Calculate temperature status relative to configured range (minTemp - maxTemp)
 */
function calculateRangeStatus(currentTemp: number, minTemp: number, maxTemp: number): {
  status: 'ok' | 'above' | 'below';
  statusText: string;
  statusIcon: string;
} {
  if (currentTemp >= minTemp && currentTemp <= maxTemp) {
    return { status: 'ok', statusText: 'Dentro da faixa', statusIcon: '✓' };
  } else if (currentTemp > maxTemp) {
    return { status: 'above', statusText: 'Acima da faixa', statusIcon: '🔺' };
  } else {
    return { status: 'below', statusText: 'Abaixo da faixa', statusIcon: '🔻' };
  }
}

/**
 * Calculate position percentage for temp bar (0-100)
 */
function calcTempBarPosition(temp: number, minRange: number, maxRange: number): number {
  // Extend range by 20% on each side for visual purposes
  const rangeSize = maxRange - minRange;
  const extendedMin = minRange - rangeSize * 0.3;
  const extendedMax = maxRange + rangeSize * 0.3;
  const extendedRange = extendedMax - extendedMin;

  const position = ((temp - extendedMin) / extendedRange) * 100;
  return Math.max(5, Math.min(95, position));
}

/**
 * Generate header HTML with action buttons
 */
function generateHeaderHTML(data: TempComparisonData): string {
  return `
    <div class="myio-temp-comparison-tooltip__header" data-drag-handle>
      <div class="myio-temp-comparison-tooltip__icon">🌡️</div>
      <div class="myio-temp-comparison-tooltip__header-info">
        <div class="myio-temp-comparison-tooltip__device-name">${data.device.name}</div>
        <div class="myio-temp-comparison-tooltip__device-type">Sensor de Temperatura</div>
      </div>
      <div class="myio-temp-comparison-tooltip__header-actions">
        <button class="myio-temp-comparison-tooltip__header-btn" data-action="pin" title="Fixar na tela">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
            <line x1="12" y1="16" x2="12" y2="21"/>
            <line x1="8" y1="4" x2="16" y2="4"/>
          </svg>
        </button>
        <button class="myio-temp-comparison-tooltip__header-btn" data-action="maximize" title="Maximizar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        </button>
        <button class="myio-temp-comparison-tooltip__header-btn" data-action="close" title="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Generate body HTML with comparison
 */
function generateBodyHTML(data: TempComparisonData): string {
  const { device, average, lastUpdated } = data;
  const timestamp = formatTimestamp(lastUpdated);

  const tempStatus = calculateTempStatus(device.currentTemp, average.value);
  const rangeStatus = calculateRangeStatus(device.currentTemp, device.minTemp, device.maxTemp);
  const deviceBarPos = calcTempBarPosition(device.currentTemp, device.minTemp, device.maxTemp);
  const avgBarPos = calcTempBarPosition(average.value, device.minTemp, device.maxTemp);

  // Map rangeStatus.status to CSS class (ok -> normal for styling)
  const rangeStatusClass = rangeStatus.status === 'ok' ? 'normal' : rangeStatus.status;

  return `
    <div class="myio-temp-comparison-tooltip__body">
      <!-- Main Stats -->
      <div class="myio-temp-comparison-tooltip__main-stats">
        <div class="myio-temp-comparison-tooltip__stat-card">
          <div class="myio-temp-comparison-tooltip__stat-label">Temperatura Atual</div>
          <div class="myio-temp-comparison-tooltip__stat-value temp">${formatTemp(device.currentTemp)}</div>
        </div>
        <div class="myio-temp-comparison-tooltip__stat-card">
          <div class="myio-temp-comparison-tooltip__stat-label">Desvio da Media</div>
          <div class="myio-temp-comparison-tooltip__stat-value ${tempStatus.status}">${formatDeviation(tempStatus.deviation, tempStatus.sign)}</div>
        </div>
      </div>

      <!-- Configured Range with Status -->
      <div class="myio-temp-comparison-tooltip__range">
        <span class="myio-temp-comparison-tooltip__range-label">Faixa Ideal:</span>
        <span class="myio-temp-comparison-tooltip__range-value">${formatTemp(device.minTemp)} - ${formatTemp(device.maxTemp)}</span>
      </div>

      <!-- Range Status Indicator -->
      <div class="myio-temp-comparison-tooltip__status ${rangeStatusClass}">
        <span class="myio-temp-comparison-tooltip__status-icon">${rangeStatus.statusIcon}</span>
        <span>${rangeStatus.statusText}</span>
      </div>

      <!-- Section: Average Comparison -->
      <div class="myio-temp-comparison-tooltip__section-title">
        <span class="myio-temp-comparison-tooltip__section-icon">📊</span>
        Comparacao com Media Geral
      </div>
      <div class="myio-temp-comparison-tooltip__comparison">
        <div class="myio-temp-comparison-tooltip__comparison-header">
          <div class="myio-temp-comparison-tooltip__comparison-title">
            <span class="myio-temp-comparison-tooltip__comparison-icon">🎯</span>
            ${device.name} vs ${average.name}
          </div>
          <div class="myio-temp-comparison-tooltip__comparison-meta">${average.deviceCount} sensores</div>
        </div>

        <!-- Visual Temperature Bar -->
        <div class="myio-temp-comparison-tooltip__temp-bar-container">
          <div class="myio-temp-comparison-tooltip__temp-bar">
            <div class="myio-temp-comparison-tooltip__temp-marker average" style="left: ${avgBarPos}%;" title="Media: ${formatTemp(average.value)}"></div>
            <div class="myio-temp-comparison-tooltip__temp-marker device" style="left: ${deviceBarPos}%;" title="Atual: ${formatTemp(device.currentTemp)}"></div>
          </div>
          <div class="myio-temp-comparison-tooltip__temp-labels">
            <span>Frio</span>
            <span>Ideal</span>
            <span>Quente</span>
          </div>
        </div>

        <div class="myio-temp-comparison-tooltip__comparison-stats">
          <div class="myio-temp-comparison-tooltip__comparison-stat">
            <div class="myio-temp-comparison-tooltip__comparison-stat-label">Este Sensor</div>
            <div class="myio-temp-comparison-tooltip__comparison-stat-value">${formatTemp(device.currentTemp)}</div>
          </div>
          <div class="myio-temp-comparison-tooltip__comparison-stat">
            <div class="myio-temp-comparison-tooltip__comparison-stat-label">Media Geral</div>
            <div class="myio-temp-comparison-tooltip__comparison-stat-value">${formatTemp(average.value)}</div>
          </div>
          <div class="myio-temp-comparison-tooltip__comparison-stat">
            <div class="myio-temp-comparison-tooltip__comparison-stat-label">Diferenca</div>
            <div class="myio-temp-comparison-tooltip__comparison-stat-value highlight ${tempStatus.status}">${tempStatus.sign}${formatTemp(Math.abs(device.currentTemp - average.value)).replace('°C', '')}°C</div>
          </div>
        </div>

        <!-- Status Indicator -->
        <div class="myio-temp-comparison-tooltip__status ${tempStatus.status}">
          <span class="myio-temp-comparison-tooltip__status-icon">${tempStatus.statusIcon}</span>
          <span>${tempStatus.statusText}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="myio-temp-comparison-tooltip__footer">
      <span class="myio-temp-comparison-tooltip__footer-label">Ultima atualizacao</span>
      <span class="myio-temp-comparison-tooltip__footer-value">${timestamp || 'Agora'}</span>
    </div>
  `;
}

/**
 * Setup hover listeners on tooltip container
 */
function setupHoverListeners(container: HTMLElement): void {
  container.onmouseenter = () => {
    state.isMouseOverTooltip = true;
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
  };

  container.onmouseleave = () => {
    state.isMouseOverTooltip = false;
    startDelayedHide();
  };
}

/**
 * Setup button click listeners
 */
function setupButtonListeners(container: HTMLElement): void {
  const buttons = container.querySelectorAll('[data-action]');
  buttons.forEach(btn => {
    (btn as HTMLElement).onclick = (e: MouseEvent) => {
      e.stopPropagation();
      const action = (btn as HTMLElement).dataset.action;
      switch (action) {
        case 'pin':
          createPinnedClone(container);
          break;
        case 'maximize':
          toggleMaximize(container);
          break;
        case 'close':
          TempComparisonTooltip.close();
          break;
      }
    };
  });
}

/**
 * Setup drag listeners
 */
function setupDragListeners(container: HTMLElement): void {
  const header = container.querySelector('[data-drag-handle]') as HTMLElement;
  if (!header) return;

  header.onmousedown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-action]')) return;
    if (state.isMaximized) return;

    state.isDragging = true;
    container.classList.add('dragging');

    const rect = container.getBoundingClientRect();
    state.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!state.isDragging) return;
      const newLeft = e.clientX - state.dragOffset.x;
      const newTop = e.clientY - state.dragOffset.y;
      const maxLeft = window.innerWidth - container.offsetWidth;
      const maxTop = window.innerHeight - container.offsetHeight;
      container.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
      container.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
    };

    const onMouseUp = () => {
      state.isDragging = false;
      container.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
}

/**
 * Create pinned clone
 */
function createPinnedClone(container: HTMLElement): void {
  state.pinnedCounter++;
  const pinnedId = `myio-temp-comparison-tooltip-pinned-${state.pinnedCounter}`;

  const clone = container.cloneNode(true) as HTMLElement;
  clone.id = pinnedId;
  clone.classList.add('pinned');
  clone.classList.remove('closing');

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

  document.body.appendChild(clone);
  setupPinnedCloneListeners(clone, pinnedId);
  TempComparisonTooltip.hide();
}

/**
 * Setup listeners for pinned clone
 */
function setupPinnedCloneListeners(clone: HTMLElement, cloneId: string): void {
  let isMaximized = false;
  let savedPosition: { left: string; top: string } | null = null;

  const pinBtn = clone.querySelector('[data-action="pin"]');
  if (pinBtn) {
    (pinBtn as HTMLElement).onclick = (e: MouseEvent) => {
      e.stopPropagation();
      closePinnedClone(cloneId);
    };
  }

  const closeBtn = clone.querySelector('[data-action="close"]');
  if (closeBtn) {
    (closeBtn as HTMLElement).onclick = (e: MouseEvent) => {
      e.stopPropagation();
      closePinnedClone(cloneId);
    };
  }

  const maxBtn = clone.querySelector('[data-action="maximize"]');
  if (maxBtn) {
    (maxBtn as HTMLElement).onclick = (e: MouseEvent) => {
      e.stopPropagation();
      isMaximized = !isMaximized;
      if (isMaximized) {
        savedPosition = { left: clone.style.left, top: clone.style.top };
        maxBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 5V3h12v12h-2"/></svg>`;
        maxBtn.setAttribute('title', 'Restaurar');
      } else {
        maxBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
        maxBtn.setAttribute('title', 'Maximizar');
        if (savedPosition) {
          clone.style.left = savedPosition.left;
          clone.style.top = savedPosition.top;
        }
      }
      clone.classList.toggle('maximized', isMaximized);
    };
  }

  // Drag for clone
  const header = clone.querySelector('[data-drag-handle]') as HTMLElement;
  if (header) {
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    header.onmousedown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-action]')) return;
      if (isMaximized) return;

      isDragging = true;
      clone.classList.add('dragging');
      const rect = clone.getBoundingClientRect();
      dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

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

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  }
}

/**
 * Close pinned clone
 */
function closePinnedClone(cloneId: string): void {
  const clone = document.getElementById(cloneId);
  if (clone) {
    clone.classList.add('closing');
    setTimeout(() => clone.remove(), 400);
  }
}

/**
 * Toggle maximize
 */
function toggleMaximize(container: HTMLElement): void {
  state.isMaximized = !state.isMaximized;

  if (state.isMaximized) {
    state.savedPosition = {
      left: container.style.left,
      top: container.style.top
    };
  }

  container.classList.toggle('maximized', state.isMaximized);

  const maxBtn = container.querySelector('[data-action="maximize"]');
  if (maxBtn) {
    if (state.isMaximized) {
      maxBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 5V3h12v12h-2"/></svg>`;
      maxBtn.setAttribute('title', 'Restaurar');
    } else {
      maxBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
      maxBtn.setAttribute('title', 'Maximizar');
      if (state.savedPosition) {
        container.style.left = state.savedPosition.left;
        container.style.top = state.savedPosition.top;
      }
    }
  }
}

/**
 * Start delayed hide (1.5s)
 */
function startDelayedHide(): void {
  if (state.isMouseOverTooltip) return;
  if (state.hideTimer) {
    clearTimeout(state.hideTimer);
  }
  state.hideTimer = setTimeout(() => {
    hideWithAnimation();
  }, 1500);
}

/**
 * Hide with animation
 */
function hideWithAnimation(): void {
  const container = document.getElementById('myio-temp-comparison-tooltip');
  if (container && container.classList.contains('visible')) {
    container.classList.add('closing');
    setTimeout(() => {
      // Reset state and clear content to prevent invisible blocking divs
      container.classList.remove('visible', 'closing', 'pinned', 'maximized', 'dragging');
      container.innerHTML = '';
    }, 400);
  }
}

/**
 * Position tooltip near trigger element
 */
function positionTooltip(container: HTMLElement, triggerElement: HTMLElement): void {
  const rect = triggerElement.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 8;

  const tooltipWidth = 340;
  if (left + tooltipWidth > window.innerWidth - 20) {
    left = window.innerWidth - tooltipWidth - 20;
  }
  if (left < 10) left = 10;

  if (top + 450 > window.innerHeight) {
    top = rect.top - 8 - 450;
    if (top < 10) top = 10;
  }

  container.style.left = left + 'px';
  container.style.top = top + 'px';
}

// ============================================
// TempComparisonTooltip Object
// ============================================

export const TempComparisonTooltip = {
  containerId: 'myio-temp-comparison-tooltip',

  /**
   * Get or create container
   */
  getContainer(): HTMLElement {
    injectCSS();

    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'myio-temp-comparison-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Show tooltip
   */
  show(triggerElement: HTMLElement, data: TempComparisonData): void {
    // Cancel pending hide
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }

    const container = this.getContainer();
    container.classList.remove('closing');

    // Build HTML
    container.innerHTML = `
      <div class="myio-temp-comparison-tooltip__panel">
        ${generateHeaderHTML(data)}
        ${generateBodyHTML(data)}
      </div>
    `;

    // Position and show
    positionTooltip(container, triggerElement);
    container.classList.add('visible');

    // Setup listeners
    setupHoverListeners(container);
    setupButtonListeners(container);
    setupDragListeners(container);
  },

  /**
   * Start delayed hide
   */
  startDelayedHide(): void {
    startDelayedHide();
  },

  /**
   * Hide immediately
   */
  hide(): void {
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
    state.isMouseOverTooltip = false;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'closing');
    }
  },

  /**
   * Close and reset all states
   */
  close(): void {
    state.isMaximized = false;
    state.isDragging = false;
    state.savedPosition = null;
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
    state.isMouseOverTooltip = false;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'pinned', 'maximized', 'dragging', 'closing');
    }
  },

  /**
   * Attach tooltip to trigger element with hover behavior
   */
  attach(
    triggerElement: HTMLElement,
    getDataFn: () => TempComparisonData | null
  ): () => void {
    const self = this;

    const handleMouseEnter = () => {
      if (state.hideTimer) {
        clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
      const data = getDataFn();
      if (data) {
        self.show(triggerElement, data);
      }
    };

    const handleMouseLeave = () => {
      startDelayedHide();
    };

    triggerElement.addEventListener('mouseenter', handleMouseEnter);
    triggerElement.addEventListener('mouseleave', handleMouseLeave);

    // Return cleanup function
    return () => {
      triggerElement.removeEventListener('mouseenter', handleMouseEnter);
      triggerElement.removeEventListener('mouseleave', handleMouseLeave);
      self.hide();
    };
  },

  /**
   * Build comparison data from entity data
   * Helper method to build the data structure from widget controller data
   */
  buildComparisonData(
    entity: {
      entityId: string;
      labelOrName: string;
      currentTemp: number;
      minTemp: number;
      maxTemp: number;
    },
    averageData: {
      name: string;
      value: number;
      deviceCount: number;
    }
  ): TempComparisonData {
    return {
      device: {
        id: entity.entityId,
        name: entity.labelOrName || 'Sensor',
        currentTemp: Number(entity.currentTemp) || 0,
        minTemp: Number(entity.minTemp) || 18,
        maxTemp: Number(entity.maxTemp) || 26,
      },
      average: {
        name: averageData.name || 'Media Geral',
        value: Number(averageData.value) || 0,
        deviceCount: averageData.deviceCount || 1,
      },
      lastUpdated: new Date().toISOString(),
    };
  },
};

// Default export
export default TempComparisonTooltip;
