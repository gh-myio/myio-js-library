/**
 * DeviceComparisonTooltip - Premium Device Comparison Tooltip Component
 * RFC-0110: Premium tooltip showing device consumption comparisons
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
 * - Device consumption and percentage
 * - Device vs Category group (e.g., Chiller 1 vs All Chillers)
 * - Device vs Widget scope (e.g., Chiller 1 vs Area Comum)
 * - Device vs Total (e.g., Chiller 1 vs Area Comum + Lojas)
 *
 * @example
 * // Attach to an element
 * const cleanup = DeviceComparisonTooltip.attach(triggerElement, getDataFn);
 * // Later: cleanup();
 *
 * // Or manual control
 * DeviceComparisonTooltip.show(element, data, event);
 * DeviceComparisonTooltip.hide();
 */

import { formatEnergy } from '../format/energy';

// ============================================
// Types
// ============================================

export interface DeviceComparisonData {
  /** Device info */
  device: {
    id: string;
    name: string;
    type: string;
    consumption: number;
    percentage: number;
    unit?: string;
  };
  /** Category comparison (e.g., all Chillers) */
  categoryGroup: {
    name: string;
    totalConsumption: number;
    deviceCount: number;
    devicePercentage: number;
  };
  /** Widget scope comparison (e.g., Area Comum) */
  widgetScope: {
    name: string;
    totalConsumption: number;
    deviceCount: number;
    devicePercentage: number;
  };
  /** Grand total comparison (Area Comum + Lojas) */
  grandTotal: {
    name: string;
    totalConsumption: number;
    deviceCount: number;
    devicePercentage: number;
  };
  /** Last update timestamp */
  lastUpdated?: string;
}

// ============================================
// CSS Styles
// ============================================

const DEVICE_COMPARISON_TOOLTIP_CSS = `
/* ============================================
   Device Comparison Tooltip (RFC-0110)
   Premium draggable tooltip with actions
   ============================================ */

.myio-device-comparison-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease, transform 0.25s ease;
  transform: translateY(5px);
}

.myio-device-comparison-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.myio-device-comparison-tooltip.closing {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.myio-device-comparison-tooltip.pinned {
  box-shadow: 0 0 0 2px #6366f1, 0 10px 40px rgba(0, 0, 0, 0.2);
  border-radius: 16px;
}

.myio-device-comparison-tooltip.dragging {
  transition: none !important;
  cursor: move;
}

.myio-device-comparison-tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
}

.myio-device-comparison-tooltip.maximized .myio-device-comparison-tooltip__panel {
  width: 100%;
  height: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
}

.myio-device-comparison-tooltip.maximized .myio-device-comparison-tooltip__body {
  flex: 1;
  overflow-y: auto;
}

.myio-device-comparison-tooltip__panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.15),
    0 8px 20px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.02);
  min-width: 340px;
  max-width: 400px;
  font-family: Inter, system-ui, -apple-system, sans-serif;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
}

/* Header with gradient */
.myio-device-comparison-tooltip__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px 16px 0 0;
  position: relative;
  overflow: hidden;
  cursor: move;
  user-select: none;
}

.myio-device-comparison-tooltip__header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.3;
}

.myio-device-comparison-tooltip__icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 1;
}

.myio-device-comparison-tooltip__header-info {
  flex: 1;
  position: relative;
  z-index: 1;
}

.myio-device-comparison-tooltip__device-name {
  font-weight: 700;
  font-size: 15px;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  margin-bottom: 2px;
}

.myio-device-comparison-tooltip__device-type {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.myio-device-comparison-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
  z-index: 1;
}

.myio-device-comparison-tooltip__header-btn {
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

.myio-device-comparison-tooltip__header-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  transform: scale(1.05);
}

.myio-device-comparison-tooltip__header-btn.pinned {
  background: rgba(255, 255, 255, 0.9);
  color: #6366f1;
}

.myio-device-comparison-tooltip__header-btn.pinned:hover {
  background: #ffffff;
  color: #4f46e5;
}

.myio-device-comparison-tooltip__header-btn svg {
  width: 14px;
  height: 14px;
}

/* Body */
.myio-device-comparison-tooltip__body {
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}

/* Main Stats Banner */
.myio-device-comparison-tooltip__main-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.myio-device-comparison-tooltip__stat-card {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.myio-device-comparison-tooltip__stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.myio-device-comparison-tooltip__stat-label {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.myio-device-comparison-tooltip__stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.myio-device-comparison-tooltip__stat-value.consumption {
  color: #059669;
}

.myio-device-comparison-tooltip__stat-value.percentage {
  color: #6366f1;
}

/* Section Title */
.myio-device-comparison-tooltip__section-title {
  font-weight: 700;
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 16px 0 10px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.myio-device-comparison-tooltip__section-icon {
  font-size: 12px;
}

/* Comparison Row */
.myio-device-comparison-tooltip__comparison {
  background: #fafafa;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
  border: 1px solid #f1f5f9;
  transition: all 0.2s ease;
}

.myio-device-comparison-tooltip__comparison:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
}

.myio-device-comparison-tooltip__comparison:last-child {
  margin-bottom: 0;
}

.myio-device-comparison-tooltip__comparison-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.myio-device-comparison-tooltip__comparison-title {
  font-weight: 600;
  font-size: 12px;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 6px;
}

.myio-device-comparison-tooltip__comparison-icon {
  font-size: 14px;
}

.myio-device-comparison-tooltip__comparison-meta {
  font-size: 10px;
  color: #94a3b8;
}

/* Progress Bar */
.myio-device-comparison-tooltip__progress-container {
  margin-bottom: 10px;
}

.myio-device-comparison-tooltip__progress-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.myio-device-comparison-tooltip__progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.myio-device-comparison-tooltip__progress-fill.category {
  background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
}

.myio-device-comparison-tooltip__progress-fill.widget {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
}

.myio-device-comparison-tooltip__progress-fill.total {
  background: linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%);
}

.myio-device-comparison-tooltip__progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.3) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: device-comparison-shimmer 2s infinite;
}

@keyframes device-comparison-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Stats Row */
.myio-device-comparison-tooltip__comparison-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.myio-device-comparison-tooltip__comparison-stat {
  text-align: center;
}

.myio-device-comparison-tooltip__comparison-stat-label {
  font-size: 9px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 2px;
}

.myio-device-comparison-tooltip__comparison-stat-value {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.myio-device-comparison-tooltip__comparison-stat-value.highlight {
  color: #059669;
  font-size: 13px;
}

/* Footer */
.myio-device-comparison-tooltip__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 16px 16px;
}

.myio-device-comparison-tooltip__footer-label {
  font-size: 10px;
  color: #64748b;
}

.myio-device-comparison-tooltip__footer-value {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}

/* Responsive */
@media (max-width: 400px) {
  .myio-device-comparison-tooltip__panel {
    min-width: 290px;
    max-width: 95vw;
  }

  .myio-device-comparison-tooltip__main-stats {
    grid-template-columns: 1fr;
  }

  .myio-device-comparison-tooltip__comparison-stats {
    grid-template-columns: 1fr 1fr;
  }
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .myio-device-comparison-tooltip__panel {
    background: #1e293b;
    border-color: #334155;
    color: #f1f5f9;
  }

  .myio-device-comparison-tooltip__stat-card {
    background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
    border-color: #475569;
  }

  .myio-device-comparison-tooltip__stat-label {
    color: #94a3b8;
  }

  .myio-device-comparison-tooltip__stat-value {
    color: #f1f5f9;
  }

  .myio-device-comparison-tooltip__section-title {
    color: #94a3b8;
    border-color: #334155;
  }

  .myio-device-comparison-tooltip__comparison {
    background: #334155;
    border-color: #475569;
  }

  .myio-device-comparison-tooltip__comparison:hover {
    background: #3d4f6f;
    border-color: #4b5d7a;
  }

  .myio-device-comparison-tooltip__comparison-title {
    color: #e2e8f0;
  }

  .myio-device-comparison-tooltip__comparison-stat-value {
    color: #e2e8f0;
  }

  .myio-device-comparison-tooltip__progress-bar {
    background: #475569;
  }

  .myio-device-comparison-tooltip__footer {
    background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
    border-color: #475569;
  }

  .myio-device-comparison-tooltip__footer-label {
    color: #94a3b8;
  }

  .myio-device-comparison-tooltip__footer-value {
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

  const styleId = 'myio-device-comparison-tooltip-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = DEVICE_COMPARISON_TOOLTIP_CSS;
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
// Device Type Icons
// ============================================

const DEVICE_TYPE_ICONS: Record<string, string> = {
  CHILLER: '🧊',
  FANCOIL: '💨',
  BOMBA: '💧',
  BOMBA_HIDRAULICA: '💧',
  BOMBA_CAG: '💧',
  BOMBA_INCENDIO: '🚒',
  ELEVADOR: '🛗',
  ESCADA_ROLANTE: '🎢',
  COMPRESSOR: '⚙️',
  VENTILADOR: '🌀',
  AR_CONDICIONADO: '❄️',
  HVAC: '❄️',
  MOTOR: '⚡',
  ENTRADA: '📥',
  SUBESTACAO: '🔌',
  '3F_MEDIDOR': '📊',
  RELOGIO: '⏱️',
  HIDROMETRO: '🚿',
  CAIXA_DAGUA: '🚰',
  TANK: '🛢️',
  TERMOSTATO: '🌡️',
  DEFAULT: '⚡',
};

function getDeviceIcon(deviceType: string): string {
  const normalizedType = (deviceType || '').toUpperCase();
  return DEVICE_TYPE_ICONS[normalizedType] || DEVICE_TYPE_ICONS.DEFAULT;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format consumption with smart unit conversion
 */
function formatConsumption(value: number): string {
  if (value == null || isNaN(value)) return '0,00 kWh';
  return formatEnergy(value);
}

/**
 * Format percentage with 1 decimal
 */
function formatPercentage(value: number): string {
  if (value == null || isNaN(value)) return '0,0%';
  return (
    value.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + '%'
  );
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
 * Generate header HTML with action buttons
 */
function generateHeaderHTML(data: DeviceComparisonData): string {
  const deviceIcon = getDeviceIcon(data.device.type);
  return `
    <div class="myio-device-comparison-tooltip__header" data-drag-handle>
      <div class="myio-device-comparison-tooltip__icon">${deviceIcon}</div>
      <div class="myio-device-comparison-tooltip__header-info">
        <div class="myio-device-comparison-tooltip__device-name">${data.device.name}</div>
        <div class="myio-device-comparison-tooltip__device-type">${data.device.type}</div>
      </div>
      <div class="myio-device-comparison-tooltip__header-actions">
        <button class="myio-device-comparison-tooltip__header-btn" data-action="pin" title="Fixar na tela">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
            <line x1="12" y1="16" x2="12" y2="21"/>
            <line x1="8" y1="4" x2="16" y2="4"/>
          </svg>
        </button>
        <button class="myio-device-comparison-tooltip__header-btn" data-action="maximize" title="Maximizar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        </button>
        <button class="myio-device-comparison-tooltip__header-btn" data-action="close" title="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Generate body HTML with comparisons
 */
function generateBodyHTML(data: DeviceComparisonData): string {
  const { device, categoryGroup, widgetScope, grandTotal, lastUpdated } = data;
  const timestamp = formatTimestamp(lastUpdated);

  return `
    <div class="myio-device-comparison-tooltip__body">
      <!-- Main Stats -->
      <div class="myio-device-comparison-tooltip__main-stats">
        <div class="myio-device-comparison-tooltip__stat-card">
          <div class="myio-device-comparison-tooltip__stat-label">Consumo</div>
          <div class="myio-device-comparison-tooltip__stat-value consumption">${formatConsumption(
            device.consumption
          )}</div>
        </div>
        <div class="myio-device-comparison-tooltip__stat-card">
          <div class="myio-device-comparison-tooltip__stat-label">Participacao</div>
          <div class="myio-device-comparison-tooltip__stat-value percentage">${formatPercentage(
            device.percentage
          )}</div>
        </div>
      </div>

      <!-- Section: Category Comparison -->
      <div class="myio-device-comparison-tooltip__section-title">
        <span class="myio-device-comparison-tooltip__section-icon">📊</span>
        Comparação por Tipo
      </div>
      <div class="myio-device-comparison-tooltip__comparison">
        <div class="myio-device-comparison-tooltip__comparison-header">
          <div class="myio-device-comparison-tooltip__comparison-title">
            <span class="myio-device-comparison-tooltip__comparison-icon">🏷️</span>
            ${device.name} vs ${categoryGroup.name}
          </div>
          <div class="myio-device-comparison-tooltip__comparison-meta">${
            categoryGroup.deviceCount
          } dispositivos</div>
        </div>
        <div class="myio-device-comparison-tooltip__progress-container">
          <div class="myio-device-comparison-tooltip__progress-bar">
            <div class="myio-device-comparison-tooltip__progress-fill category" style="width: ${Math.min(
              categoryGroup.devicePercentage,
              100
            )}%"></div>
          </div>
        </div>
        <div class="myio-device-comparison-tooltip__comparison-stats">
          <div class="myio-device-comparison-tooltip__comparison-stat">
            <div class="myio-device-comparison-tooltip__comparison-stat-label">Este Device</div>
            <div class="myio-device-comparison-tooltip__comparison-stat-value">${formatConsumption(
              device.consumption
            )}</div>
          </div>
          <div class="myio-device-comparison-tooltip__comparison-stat">
            <div class="myio-device-comparison-tooltip__comparison-stat-label">Total Grupo</div>
            <div class="myio-device-comparison-tooltip__comparison-stat-value">${formatConsumption(
              categoryGroup.totalConsumption
            )}</div>
          </div>
          <div class="myio-device-comparison-tooltip__comparison-stat">
            <div class="myio-device-comparison-tooltip__comparison-stat-label">Participacao</div>
            <div class="myio-device-comparison-tooltip__comparison-stat-value highlight">${formatPercentage(
              categoryGroup.devicePercentage
            )}</div>
          </div>
        </div>
      </div>

      <!-- Section: Widget Scope Comparison -->
      <div class="myio-device-comparison-tooltip__section-title">
        <span class="myio-device-comparison-tooltip__section-icon">🏢</span>
        Comparação no Grupo
      </div>
      <div class="myio-device-comparison-tooltip__comparison">
        <div class="myio-device-comparison-tooltip__comparison-header">
          <div class="myio-device-comparison-tooltip__comparison-title">
            <span class="myio-device-comparison-tooltip__comparison-icon">🏠</span>
            ${device.name} vs ${widgetScope.name}
          </div>
          <div class="myio-device-comparison-tooltip__comparison-meta">${
            widgetScope.deviceCount
          } dispositivos</div>
        </div>
        <div class="myio-device-comparison-tooltip__progress-container">
          <div class="myio-device-comparison-tooltip__progress-bar">
            <div class="myio-device-comparison-tooltip__progress-fill widget" style="width: ${Math.min(
              widgetScope.devicePercentage,
              100
            )}%"></div>
          </div>
        </div>
        <div class="myio-device-comparison-tooltip__comparison-stats">
          <div class="myio-device-comparison-tooltip__comparison-stat">
            <div class="myio-device-comparison-tooltip__comparison-stat-label">Este Device</div>
            <div class="myio-device-comparison-tooltip__comparison-stat-value">${formatConsumption(
              device.consumption
            )}</div>
          </div>
          <div class="myio-device-comparison-tooltip__comparison-stat">
            <div class="myio-device-comparison-tooltip__comparison-stat-label">Total Widget</div>
            <div class="myio-device-comparison-tooltip__comparison-stat-value">${formatConsumption(
              widgetScope.totalConsumption
            )}</div>
          </div>
          <div class="myio-device-comparison-tooltip__comparison-stat">
            <div class="myio-device-comparison-tooltip__comparison-stat-label">Participacao</div>
            <div class="myio-device-comparison-tooltip__comparison-stat-value highlight">${formatPercentage(
              widgetScope.devicePercentage
            )}</div>
          </div>
        </div>
      </div>

      <!-- Section: Grand Total Comparison -->
      <div class="myio-device-comparison-tooltip__section-title">
        <span class="myio-device-comparison-tooltip__section-icon">🌐</span>
        Comparação Total
      </div>
      <div class="myio-device-comparison-tooltip__comparison">
        <div class="myio-device-comparison-tooltip__comparison-header">
          <div class="myio-device-comparison-tooltip__comparison-title">
            <span class="myio-device-comparison-tooltip__comparison-icon">🏪</span>
            ${device.name} vs ${grandTotal.name}
          </div>
          <div class="myio-device-comparison-tooltip__comparison-meta">${
            grandTotal.deviceCount
          } dispositivos</div>
        </div>
        <div class="myio-device-comparison-tooltip__progress-container">
          <div class="myio-device-comparison-tooltip__progress-bar">
            <div class="myio-device-comparison-tooltip__progress-fill total" style="width: ${Math.min(
              grandTotal.devicePercentage,
              100
            )}%"></div>
          </div>
        </div>
        <div class="myio-device-comparison-tooltip__comparison-stats">
          <div class="myio-device-comparison-tooltip__comparison-stat">
            <div class="myio-device-comparison-tooltip__comparison-stat-label">Este Device</div>
            <div class="myio-device-comparison-tooltip__comparison-stat-value">${formatConsumption(
              device.consumption
            )}</div>
          </div>
          <div class="myio-device-comparison-tooltip__comparison-stat">
            <div class="myio-device-comparison-tooltip__comparison-stat-label">Total Geral</div>
            <div class="myio-device-comparison-tooltip__comparison-stat-value">${formatConsumption(
              grandTotal.totalConsumption
            )}</div>
          </div>
          <div class="myio-device-comparison-tooltip__comparison-stat">
            <div class="myio-device-comparison-tooltip__comparison-stat-label">Participacao</div>
            <div class="myio-device-comparison-tooltip__comparison-stat-value highlight">${formatPercentage(
              grandTotal.devicePercentage
            )}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="myio-device-comparison-tooltip__footer">
      <span class="myio-device-comparison-tooltip__footer-label">Ultima atualizacao</span>
      <span class="myio-device-comparison-tooltip__footer-value">${timestamp || 'Agora'}</span>
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
  buttons.forEach((btn) => {
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
          DeviceComparisonTooltip.close();
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
      y: e.clientY - rect.top,
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
  const pinnedId = `myio-device-comparison-tooltip-pinned-${state.pinnedCounter}`;

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
  DeviceComparisonTooltip.hide();
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
      top: container.style.top,
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
  const container = document.getElementById('myio-device-comparison-tooltip');
  if (container && container.classList.contains('visible')) {
    container.classList.add('closing');
    setTimeout(() => {
      container.classList.remove('visible', 'closing');
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

  if (top + 500 > window.innerHeight) {
    top = rect.top - 8 - 500;
    if (top < 10) top = 10;
  }

  container.style.left = left + 'px';
  container.style.top = top + 'px';
}

// ============================================
// DeviceComparisonTooltip Object
// ============================================

export const DeviceComparisonTooltip = {
  containerId: 'myio-device-comparison-tooltip',

  /**
   * Get or create container
   */
  getContainer(): HTMLElement {
    injectCSS();

    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'myio-device-comparison-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Show tooltip
   */
  show(triggerElement: HTMLElement, data: DeviceComparisonData): void {
    // Cancel pending hide
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }

    const container = this.getContainer();
    container.classList.remove('closing');

    // Build HTML
    container.innerHTML = `
      <div class="myio-device-comparison-tooltip__panel">
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
  attach(triggerElement: HTMLElement, getDataFn: () => DeviceComparisonData | null): () => void {
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
   * Build comparison data from entity and widget state
   * Helper method to build the data structure from widget controller data
   */
  buildComparisonData(
    entity: {
      entityId: string;
      labelOrName: string;
      deviceType: string;
      val: number;
      perc: number;
    },
    categoryData: {
      name: string;
      total: number;
      deviceCount: number;
    },
    widgetData: {
      name: string;
      total: number;
      deviceCount: number;
    },
    grandTotalData: {
      name: string;
      total: number;
      deviceCount: number;
    }
  ): DeviceComparisonData {
    const deviceConsumption = Number(entity.val) || 0;

    // Calculate percentages
    const categoryPerc = categoryData.total > 0 ? (deviceConsumption / categoryData.total) * 100 : 0;
    const widgetPerc = widgetData.total > 0 ? (deviceConsumption / widgetData.total) * 100 : 0;
    const grandTotalPerc = grandTotalData.total > 0 ? (deviceConsumption / grandTotalData.total) * 100 : 0;

    return {
      device: {
        id: entity.entityId,
        name: entity.labelOrName || 'Dispositivo',
        type: entity.deviceType || 'DEVICE',
        consumption: deviceConsumption,
        percentage: Number(entity.perc) || 0,
      },
      categoryGroup: {
        name: categoryData.name || 'Categoria',
        totalConsumption: categoryData.total || 0,
        deviceCount: categoryData.deviceCount || 0,
        devicePercentage: categoryPerc,
      },
      widgetScope: {
        name: widgetData.name || 'Widget',
        totalConsumption: widgetData.total || 0,
        deviceCount: widgetData.deviceCount || 0,
        devicePercentage: widgetPerc,
      },
      grandTotal: {
        name: grandTotalData.name || 'Total',
        totalConsumption: grandTotalData.total || 0,
        deviceCount: grandTotalData.deviceCount || 0,
        devicePercentage: grandTotalPerc,
      },
      lastUpdated: new Date().toISOString(),
    };
  },
};

// Default export
export default DeviceComparisonTooltip;
