/**
 * TempSensorSummaryTooltip - Temperature Sensors Summary Tooltip
 * Premium draggable tooltip with PIN, maximize, close and delayed hide
 *
 * Features:
 * - Draggable header
 * - PIN button (creates independent clone)
 * - Maximize/restore button
 * - Close button
 * - Delayed hide (1.5s) with hover detection
 * - Smooth animations
 * - Orange theme for temperature
 *
 * @example
 * TempSensorSummaryTooltip.show(triggerElement, {
 *   devices: [...],
 *   temperatureMin: 20,
 *   temperatureMax: 26
 * });
 */

// ============================================
// Types
// ============================================

export interface TempSensorDevice {
  name: string;
  temp: number;
  status: 'ok' | 'warn' | 'unknown';
}

export interface ShoppingTemperatureInfo {
  name: string;
  avgTemp: number;
  deviceCount: number;
  minTemp?: number;
  maxTemp?: number;
}

export interface DeviceInfo {
  id: string;
  label: string;
  name?: string;
}

export interface TempStatusSummary {
  // Connection status
  waiting: number;
  weakConnection: number;
  offline: number;
  // Temperature status
  normal: number;  // in range
  alert: number;   // out of range (warn)
  // Device lists for each status (optional)
  waitingDevices?: DeviceInfo[];
  weakConnectionDevices?: DeviceInfo[];
  offlineDevices?: DeviceInfo[];
  normalDevices?: DeviceInfo[];
  alertDevices?: DeviceInfo[];
}

export interface TempSensorSummaryData {
  devices: TempSensorDevice[];
  temperatureMin?: number;
  temperatureMax?: number;
  title?: string;
  /** Optional customer name to display in header (e.g., "Mestre Álvaro") */
  customerName?: string;
  /** Last updated timestamp */
  lastUpdated?: string;
  /** Max devices to display in list (default: 100) */
  maxDevices?: number;
  /** Global average temperature */
  globalAvg?: number;
  /** Total devices count */
  totalDevices?: number;
  /** Shoppings with all sensors in range */
  shoppingsInRange?: ShoppingTemperatureInfo[];
  /** Shoppings with sensors out of range */
  shoppingsOutOfRange?: ShoppingTemperatureInfo[];
  /** Status breakdown */
  byStatus?: TempStatusSummary;
}

// ============================================
// CSS Styles
// ============================================

const TEMP_SENSOR_TOOLTIP_CSS = `
/* ============================================
   Temp Sensor Summary Tooltip
   Premium draggable tooltip with actions
   ============================================ */

.myio-temp-sensor-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease, transform 0.25s ease;
  transform: translateY(5px);
}

.myio-temp-sensor-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.myio-temp-sensor-tooltip.closing {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
  pointer-events: none; /* Disable pointer events during close animation */
}

.myio-temp-sensor-tooltip.pinned {
  box-shadow: 0 0 0 2px #ea580c, 0 10px 40px rgba(0, 0, 0, 0.2);
  border-radius: 12px;
}

.myio-temp-sensor-tooltip.dragging {
  transition: none !important;
  cursor: move;
}

.myio-temp-sensor-tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
}

.myio-temp-sensor-tooltip.maximized .myio-temp-sensor-tooltip__panel {
  width: 100%;
  height: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
}

.myio-temp-sensor-tooltip.maximized .myio-temp-sensor-tooltip__content {
  flex: 1;
  overflow-y: auto;
}

.myio-temp-sensor-tooltip__panel {
  background: #ffffff;
  border: 1px solid #fed7aa;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.08);
  min-width: 320px;
  max-width: 400px;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
  font-family: Inter, system-ui, -apple-system, sans-serif;
}

.myio-temp-sensor-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(90deg, #fff7ed 0%, #fed7aa 100%);
  border-bottom: 1px solid #fdba74;
  cursor: move;
  user-select: none;
}

.myio-temp-sensor-tooltip__icon {
  font-size: 18px;
}

.myio-temp-sensor-tooltip__title {
  font-weight: 700;
  font-size: 14px;
  color: #c2410c;
  letter-spacing: 0.3px;
  flex: 1;
}

.myio-temp-sensor-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.myio-temp-sensor-tooltip__header-btn {
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
  color: #c2410c;
}

.myio-temp-sensor-tooltip__header-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  color: #9a3412;
}

.myio-temp-sensor-tooltip__header-btn.pinned {
  background: #ea580c;
  color: white;
}

.myio-temp-sensor-tooltip__header-btn.pinned:hover {
  background: #c2410c;
  color: white;
}

.myio-temp-sensor-tooltip__header-btn svg {
  width: 14px;
  height: 14px;
}

.myio-temp-sensor-tooltip__content {
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}

/* Content styles */
.myio-temp-sensor-tooltip__section {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.myio-temp-sensor-tooltip__section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.myio-temp-sensor-tooltip__section-title {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.myio-temp-sensor-tooltip__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  gap: 12px;
}

.myio-temp-sensor-tooltip__label {
  color: #64748b;
  font-size: 12px;
  flex-shrink: 0;
}

.myio-temp-sensor-tooltip__value {
  color: #1e293b;
  font-weight: 600;
  text-align: right;
}

.myio-temp-sensor-tooltip__value--highlight {
  color: #ea580c;
  font-weight: 700;
  font-size: 14px;
}

.myio-temp-sensor-tooltip__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.myio-temp-sensor-tooltip__badge--ok {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.myio-temp-sensor-tooltip__badge--warn {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}

.myio-temp-sensor-tooltip__badge--info {
  background: #e0e7ff;
  color: #4338ca;
  border: 1px solid #c7d2fe;
}

.myio-temp-sensor-tooltip__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.myio-temp-sensor-tooltip__list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 11px;
}

.myio-temp-sensor-tooltip__list-item--ok {
  border-left: 3px solid #22c55e;
  background: #f0fdf4;
}

.myio-temp-sensor-tooltip__list-item--warn {
  border-left: 3px solid #f59e0b;
  background: #fffbeb;
}

.myio-temp-sensor-tooltip__list-item--unknown {
  border-left: 3px solid #6b7280;
  background: #f3f4f6;
}

.myio-temp-sensor-tooltip__list-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.myio-temp-sensor-tooltip__list-name {
  flex: 1;
  color: #334155;
  font-weight: 500;
}

.myio-temp-sensor-tooltip__list-value {
  color: #475569;
  font-size: 11px;
  font-weight: 500;
}

.myio-temp-sensor-tooltip__notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  margin-top: 12px;
}

.myio-temp-sensor-tooltip__notice-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.myio-temp-sensor-tooltip__notice-text {
  font-size: 10px;
  color: #9a3412;
  line-height: 1.5;
}

.myio-temp-sensor-tooltip__notice-text strong {
  font-weight: 700;
  color: #7c2d12;
}

/* Total Devices Banner */
.myio-temp-sensor-tooltip__total-devices {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%);
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid #fdba74;
}

.myio-temp-sensor-tooltip__total-devices-label {
  font-weight: 600;
  color: #9a3412;
  font-size: 12px;
}

.myio-temp-sensor-tooltip__total-devices-value {
  font-weight: 700;
  font-size: 20px;
  color: #c2410c;
}

/* Shopping Breakdown Sections */
.myio-temp-sensor-tooltip__shopping-section {
  margin: 12px 0;
}

.myio-temp-sensor-tooltip__shopping-header {
  display: grid;
  grid-template-columns: 1fr 60px 60px;
  gap: 8px;
  padding: 4px 10px;
  font-size: 9px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.myio-temp-sensor-tooltip__shopping-row {
  display: grid;
  grid-template-columns: 1fr 60px 60px;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  align-items: center;
  transition: background-color 0.15s ease;
  font-size: 12px;
}

.myio-temp-sensor-tooltip__shopping-row:hover {
  background: #f8fafc;
}

.myio-temp-sensor-tooltip__shopping-row.in-range {
  border-left: 3px solid #22c55e;
  background: #f0fdf4;
}

.myio-temp-sensor-tooltip__shopping-row.out-of-range {
  border-left: 3px solid #f59e0b;
  background: #fffbeb;
}

.myio-temp-sensor-tooltip__shopping-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #334155;
}

.myio-temp-sensor-tooltip__shopping-icon {
  font-size: 14px;
}

.myio-temp-sensor-tooltip__shopping-count {
  text-align: center;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
}

.myio-temp-sensor-tooltip__shopping-temp {
  text-align: right;
  font-weight: 600;
  font-size: 11px;
}

.myio-temp-sensor-tooltip__shopping-temp.in-range {
  color: #15803d;
}

.myio-temp-sensor-tooltip__shopping-temp.out-of-range {
  color: #b45309;
}

/* Status Matrix */
.myio-temp-sensor-tooltip__status-matrix {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 6px 0 12px 0;
}

.myio-temp-sensor-tooltip__status-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
}

.myio-temp-sensor-tooltip__status-item.normal {
  background: #dcfce7;
  color: #15803d;
}

.myio-temp-sensor-tooltip__status-item.alert {
  background: #fef3c7;
  color: #b45309;
}

.myio-temp-sensor-tooltip__status-item.offline {
  background: #f3f4f6;
  color: #6b7280;
}

.myio-temp-sensor-tooltip__status-item.waiting {
  background: #fef3c7;
  color: #92400e;
  border: 1px dashed #f59e0b;
}

.myio-temp-sensor-tooltip__status-item.weak-connection {
  background: #ffedd5;
  color: #c2410c;
}

.myio-temp-sensor-tooltip__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.myio-temp-sensor-tooltip__status-dot.normal { background: #22c55e; }
.myio-temp-sensor-tooltip__status-dot.alert { background: #f59e0b; }
.myio-temp-sensor-tooltip__status-dot.offline { background: #6b7280; }
.myio-temp-sensor-tooltip__status-dot.waiting { background: #fbbf24; }
.myio-temp-sensor-tooltip__status-dot.weak-connection { background: #fb923c; }

.myio-temp-sensor-tooltip__status-count {
  font-size: 12px;
  font-weight: 700;
}

.myio-temp-sensor-tooltip__status-label {
  font-size: 9px;
  opacity: 0.85;
}

/* Average Footer */
.myio-temp-sensor-tooltip__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
  border-radius: 0 0 11px 11px;
}

.myio-temp-sensor-tooltip__footer-label {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
}

.myio-temp-sensor-tooltip__footer-value {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
}
`;

// ============================================
// CSS Injection
// ============================================

let cssInjected = false;

function injectCSS(): void {
  if (cssInjected) return;
  if (typeof document === 'undefined') return;

  const styleId = 'myio-temp-sensor-tooltip-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = TEMP_SENSOR_TOOLTIP_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ============================================
// State Management
// ============================================

interface TooltipState {
  hideTimer: ReturnType<typeof setTimeout> | null;
  forceHideTimer: ReturnType<typeof setTimeout> | null;
  isMouseOverTooltip: boolean;
  isMaximized: boolean;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  savedPosition: { left: string; top: string } | null;
  isPinned: boolean; // When true, tooltip won't auto-hide
}

const state: TooltipState = {
  hideTimer: null,
  forceHideTimer: null,
  isMouseOverTooltip: false,
  isMaximized: false,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  savedPosition: null,
  isPinned: false,
};

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

/**
 * Generate header HTML with action buttons
 */
function generateHeaderHTML(title: string, timestamp?: string): string {
  const timestampHtml = timestamp ? `<span style="font-size: 10px; color: #9ca3af; margin-right: 8px;">${timestamp}</span>` : '';
  return `
    <div class="myio-temp-sensor-tooltip__header" data-drag-handle>
      <span class="myio-temp-sensor-tooltip__icon">🌡️</span>
      <span class="myio-temp-sensor-tooltip__title">${title}</span>
      ${timestampHtml}
      <div class="myio-temp-sensor-tooltip__header-actions">
        <button class="myio-temp-sensor-tooltip__header-btn" data-action="pin" title="Fixar na tela">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
            <line x1="12" y1="16" x2="12" y2="21"/>
            <line x1="8" y1="4" x2="16" y2="4"/>
          </svg>
        </button>
        <button class="myio-temp-sensor-tooltip__header-btn" data-action="maximize" title="Maximizar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        </button>
        <button class="myio-temp-sensor-tooltip__header-btn" data-action="close" title="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Generate shopping breakdown section HTML
 * Groups shoppings by in-range and out-of-range
 */
function generateShoppingBreakdownHTML(data: TempSensorSummaryData): string {
  const shoppingsInRange = data.shoppingsInRange || [];
  const shoppingsOutOfRange = data.shoppingsOutOfRange || [];

  if (shoppingsInRange.length === 0 && shoppingsOutOfRange.length === 0) {
    return '';
  }

  let html = `
    <div class="myio-temp-sensor-tooltip__section-title">
      <span>🏢</span> Distribuição por Shopping
    </div>
    <div class="myio-temp-sensor-tooltip__shopping-section">
      <div class="myio-temp-sensor-tooltip__shopping-header">
        <span>Shopping</span>
        <span>Sensores</span>
        <span>Média</span>
      </div>
  `;

  // Out of range shoppings first (more important)
  if (shoppingsOutOfRange.length > 0) {
    shoppingsOutOfRange.forEach(shopping => {
      html += `
        <div class="myio-temp-sensor-tooltip__shopping-row out-of-range">
          <span class="myio-temp-sensor-tooltip__shopping-name">
            <span class="myio-temp-sensor-tooltip__shopping-icon">⚠️</span>
            <span>${shopping.name}</span>
          </span>
          <span class="myio-temp-sensor-tooltip__shopping-count">${shopping.deviceCount}</span>
          <span class="myio-temp-sensor-tooltip__shopping-temp out-of-range">${shopping.avgTemp.toFixed(1)}°C</span>
        </div>
      `;
    });
  }

  // In range shoppings
  if (shoppingsInRange.length > 0) {
    shoppingsInRange.forEach(shopping => {
      html += `
        <div class="myio-temp-sensor-tooltip__shopping-row in-range">
          <span class="myio-temp-sensor-tooltip__shopping-name">
            <span class="myio-temp-sensor-tooltip__shopping-icon">✅</span>
            <span>${shopping.name}</span>
          </span>
          <span class="myio-temp-sensor-tooltip__shopping-count">${shopping.deviceCount}</span>
          <span class="myio-temp-sensor-tooltip__shopping-temp in-range">${shopping.avgTemp.toFixed(1)}°C</span>
        </div>
      `;
    });
  }

  html += '</div>';
  return html;
}

/**
 * Generate status matrix HTML
 */
function generateStatusMatrixHTML(data: TempSensorSummaryData): string {
  const { devices, byStatus } = data;

  // FIX: Guard against undefined/null devices
  const deviceList = devices && Array.isArray(devices) ? devices : [];

  // Calculate from devices if byStatus not provided
  let inRangeCount = 0;
  let outOfRangeCount = 0;

  deviceList.forEach((d) => {
    if (d.status === 'ok') inRangeCount++;
    else if (d.status === 'warn') outOfRangeCount++;
  });

  // Use byStatus if provided, otherwise use calculated values
  const normal = byStatus?.normal ?? inRangeCount;
  const alert = byStatus?.alert ?? outOfRangeCount;
  const offline = byStatus?.offline ?? 0;
  const waiting = byStatus?.waiting ?? 0;
  const weakConnection = byStatus?.weakConnection ?? 0;

  const statusItems = [
    { key: 'normal', label: 'Na Faixa', count: normal },
    { key: 'alert', label: 'Fora da Faixa', count: alert },
    { key: 'offline', label: 'Offline', count: offline },
    { key: 'waiting', label: 'Aguardando', count: waiting },
    { key: 'weak-connection', label: 'Conexão Fraca', count: weakConnection },
  ];

  // Filter out zero counts except for normal and alert
  const visibleItems = statusItems.filter(item =>
    item.count > 0 || item.key === 'normal' || item.key === 'alert'
  );

  return `
    <div class="myio-temp-sensor-tooltip__section-title">
      <span>📊</span> Status dos Sensores
    </div>
    <div class="myio-temp-sensor-tooltip__status-matrix">
      ${visibleItems.map(item => `
        <div class="myio-temp-sensor-tooltip__status-item ${item.key}">
          <span class="myio-temp-sensor-tooltip__status-dot ${item.key}"></span>
          <span class="myio-temp-sensor-tooltip__status-count">${item.count}</span>
          <span class="myio-temp-sensor-tooltip__status-label">${item.label}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Generate content HTML from data
 * RFC-0129: Now groups by shopping like water tooltip
 */
function generateContentHTML(data: TempSensorSummaryData): string {
  const { devices, temperatureMin, temperatureMax, globalAvg, totalDevices, shoppingsInRange, shoppingsOutOfRange } = data;
  const hasLimits = temperatureMin != null && temperatureMax != null;

  // FIX: Guard against undefined/null devices
  const deviceList = devices && Array.isArray(devices) ? devices : [];

  // Calculate statistics from devices if not provided
  let avgTemp = globalAvg ?? 0;
  if (!globalAvg && deviceList.length > 0) {
    avgTemp = deviceList.reduce((sum, d) => sum + d.temp, 0) / deviceList.length;
  }

  const deviceCount = totalDevices ?? deviceList.length;
  const inRangeShoppings = shoppingsInRange?.length ?? 0;
  const outOfRangeShoppings = shoppingsOutOfRange?.length ?? 0;
  const hasShoppingData = inRangeShoppings > 0 || outOfRangeShoppings > 0;

  // Build summary info
  let summaryHtml = `
    <div class="myio-temp-sensor-tooltip__total-devices">
      <span class="myio-temp-sensor-tooltip__total-devices-label">Total de Sensores</span>
      <span class="myio-temp-sensor-tooltip__total-devices-value">${deviceCount}</span>
    </div>
  `;

  // Range info
  if (hasLimits) {
    summaryHtml += `
      <div class="myio-temp-sensor-tooltip__section">
        <div class="myio-temp-sensor-tooltip__row">
          <span class="myio-temp-sensor-tooltip__label">Faixa Ideal:</span>
          <span class="myio-temp-sensor-tooltip__value">${temperatureMin}°C - ${temperatureMax}°C</span>
        </div>
      </div>
    `;
  }

  // Shopping breakdown (like water categories)
  const shoppingBreakdownHtml = hasShoppingData ? generateShoppingBreakdownHTML(data) : '';

  // Status matrix
  const statusMatrixHtml = generateStatusMatrixHTML(data);

  // Build device list HTML (collapsed by default, for detail view)
  let deviceListHtml = '';
  if (deviceList.length > 0 && deviceList.length <= 20) {
    const maxDevices = data.maxDevices ?? 20;
    const sortedDevices = [...deviceList].sort((a, b) => b.temp - a.temp);
    const displayDevices = sortedDevices.slice(0, maxDevices);
    const hasMore = sortedDevices.length > maxDevices;

    deviceListHtml = `
      <div class="myio-temp-sensor-tooltip__section">
        <div class="myio-temp-sensor-tooltip__section-title">
          <span>🌡️</span> Sensores (${deviceList.length})
        </div>
        <div class="myio-temp-sensor-tooltip__list">
          ${displayDevices.map((d) => {
            const statusClass = d.status === 'ok' ? 'ok' : d.status === 'warn' ? 'warn' : 'unknown';
            const icon = d.status === 'ok' ? '✔' : d.status === 'warn' ? '⚠' : '?';
            return `
              <div class="myio-temp-sensor-tooltip__list-item myio-temp-sensor-tooltip__list-item--${statusClass}">
                <span class="myio-temp-sensor-tooltip__list-icon">${icon}</span>
                <span class="myio-temp-sensor-tooltip__list-name">${d.name}</span>
                <span class="myio-temp-sensor-tooltip__list-value">${d.temp.toFixed(1)}°C</span>
              </div>
            `;
          }).join('')}
          ${hasMore ? `<div style="text-align: center; color: #94a3b8; font-size: 10px; padding: 4px;">... e mais ${sortedDevices.length - maxDevices} sensores</div>` : ''}
        </div>
      </div>
    `;
  }

  return `
    ${summaryHtml}
    ${shoppingBreakdownHtml}
    ${statusMatrixHtml}
    ${deviceListHtml}
  `;
}

/**
 * Setup hover listeners on tooltip container
 * NOTE: Timer is NOT cancelled when mouse enters tooltip
 * Only clicking PIN button will cancel the timer and fix the tooltip
 */
function setupHoverListeners(container: HTMLElement): void {
  container.onmouseenter = () => {
    state.isMouseOverTooltip = true;
    // NOTE: We intentionally do NOT cancel the hide timer here
    // The tooltip will be destroyed after 2.5s unless PIN is clicked
  };

  container.onmouseleave = () => {
    state.isMouseOverTooltip = false;
    // NOTE: Timer was already started when mouse left the badge
    // No need to restart it here
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
          togglePin(container);
          break;
        case 'maximize':
          toggleMaximize(container);
          break;
        case 'close':
          TempSensorSummaryTooltip.close();
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
 * Toggle PIN state - fixes tooltip on screen or unfixes and restarts timer
 * First click: PIN fixes the tooltip, cancels all timers
 * Second click: Unpin, restarts 2.5s timer
 */
function togglePin(container: HTMLElement): void {
  const pinBtn = container.querySelector('[data-action="pin"]');

  if (state.isPinned) {
    // UNPIN: Remove pinned state and restart timer
    state.isPinned = false;
    container.classList.remove('pinned');

    // Update PIN button visual
    if (pinBtn) {
      pinBtn.classList.remove('pinned');
      pinBtn.setAttribute('title', 'Fixar na tela');
      pinBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
          <line x1="12" y1="16" x2="12" y2="21"/>
          <line x1="8" y1="4" x2="16" y2="4"/>
        </svg>
      `;
    }

    // Restart 2.5s timer
    startDelayedHide();
  } else {
    // PIN: Fix tooltip on screen, cancel all timers
    state.isPinned = true;
    container.classList.add('pinned');

    // Cancel all timers
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
    if (state.forceHideTimer) {
      clearTimeout(state.forceHideTimer);
      state.forceHideTimer = null;
    }

    // Update PIN button visual
    if (pinBtn) {
      pinBtn.classList.add('pinned');
      pinBtn.setAttribute('title', 'Desafixar (reinicia timer)');
      pinBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1">
          <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
          <line x1="12" y1="16" x2="12" y2="21"/>
          <line x1="8" y1="4" x2="16" y2="4"/>
        </svg>
      `;
    }
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
 * Timer is NOT cancelled when mouse hovers over tooltip
 * Only PIN button can cancel the timer
 */
function startDelayedHide(): void {
  // Don't hide if tooltip is pinned
  if (state.isPinned) return;

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
  const container = document.getElementById('myio-temp-sensor-tooltip');
  if (container && container.classList.contains('visible')) {
    container.classList.add('closing');
    setTimeout(() => {
      // Reset all state to prevent invisible blocking divs
      state.isMouseOverTooltip = false;
      state.isMaximized = false;
      state.isDragging = false;
      state.savedPosition = null;
      state.isPinned = false;

      // Remove all classes and clear content
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

  const tooltipWidth = 380;
  if (left + tooltipWidth > window.innerWidth - 20) {
    left = window.innerWidth - tooltipWidth - 20;
  }
  if (left < 10) left = 10;

  if (top + 400 > window.innerHeight) {
    top = rect.top - 8 - 400;
    if (top < 10) top = 10;
  }

  container.style.left = left + 'px';
  container.style.top = top + 'px';
}

// ============================================
// TempSensorSummaryTooltip Object
// ============================================

export const TempSensorSummaryTooltip = {
  containerId: 'myio-temp-sensor-tooltip',

  /**
   * Get or create container
   */
  getContainer(): HTMLElement {
    injectCSS();

    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'myio-temp-sensor-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Check if tooltip is currently visible
   */
  isVisible(): boolean {
    const container = document.getElementById(this.containerId);
    return container?.classList.contains('visible') ?? false;
  },

  /**
   * Show tooltip
   */
  show(triggerElement: HTMLElement, data: TempSensorSummaryData): void {
    // Cancel pending hide and force hide
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
    if (state.forceHideTimer) {
      clearTimeout(state.forceHideTimer);
      state.forceHideTimer = null;
    }

    const container = this.getContainer();
    container.classList.remove('closing');

    // Set up force hide timer (8 seconds max)
    state.forceHideTimer = setTimeout(() => {
      state.isMouseOverTooltip = false;
      this.hide();
    }, 8000);

    const baseTitle = data.title || 'Resumo de Temperatura';
    const titleSuffix = data.customerName ? ` (${data.customerName})` : '';
    const title = baseTitle + titleSuffix;
    const timestamp = formatTimestamp(data.lastUpdated);

    // Calculate average temperature for footer
    const devices = data.devices && Array.isArray(data.devices) ? data.devices : [];
    let avgTemp = data.globalAvg ?? 0;
    if (!data.globalAvg && devices.length > 0) {
      avgTemp = devices.reduce((sum, d) => sum + d.temp, 0) / devices.length;
    }

    // Build HTML with footer (like water tooltip)
    container.innerHTML = `
      <div class="myio-temp-sensor-tooltip__panel">
        ${generateHeaderHTML(title, timestamp)}
        <div class="myio-temp-sensor-tooltip__content">
          ${generateContentHTML(data)}
        </div>
        <div class="myio-temp-sensor-tooltip__footer">
          <span class="myio-temp-sensor-tooltip__footer-label">Média Geral</span>
          <span class="myio-temp-sensor-tooltip__footer-value">${avgTemp.toFixed(1)}°C</span>
        </div>
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
    if (state.forceHideTimer) {
      clearTimeout(state.forceHideTimer);
      state.forceHideTimer = null;
    }
    state.isMouseOverTooltip = false;
    state.isPinned = false;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'closing', 'pinned');
    }
  },

  /**
   * Close and reset all states
   */
  close(): void {
    state.isMaximized = false;
    state.isDragging = false;
    state.savedPosition = null;
    state.isPinned = false;
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
    if (state.forceHideTimer) {
      clearTimeout(state.forceHideTimer);
      state.forceHideTimer = null;
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
    getData: () => TempSensorSummaryData
  ): () => void {
    const self = this;

    const handleMouseEnter = () => {
      if (state.hideTimer) {
        clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
      const data = getData();
      self.show(triggerElement, data);
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
};

export default TempSensorSummaryTooltip;
