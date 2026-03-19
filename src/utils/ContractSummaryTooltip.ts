/**
 * ContractSummaryTooltip - Premium Contract Summary Tooltip Component
 * RFC-0107: Welcome and Loading Modal for Shopping Dashboard
 *
 * Features:
 * - Draggable header
 * - PIN button (creates independent clone)
 * - Maximize/restore button
 * - Close button
 * - Delayed hide (1.5s) with hover detection
 * - Smooth animations
 * - Dark theme (#2d1458)
 *
 * Shows:
 * - Contract validation status
 * - Device counts by domain (Energy, Water, Temperature)
 * - Detailed breakdown by group (Entries, Common Area, Stores)
 *
 * @example
 * // Attach to an element
 * const cleanup = ContractSummaryTooltip.attach(triggerElement, getDataFn);
 * // Later: cleanup();
 *
 * // Or manual control
 * ContractSummaryTooltip.show(element, data);
 * ContractSummaryTooltip.hide();
 */

// ============================================
// Types
// ============================================

export interface ContractDomainCounts {
  total: number;
  entries: number;
  commonArea: number;
  stores: number;
}

export interface ContractTemperatureCounts {
  total: number;
  internal: number;
  stores: number;
}

export interface ContractSummaryData {
  /** Whether contract is loaded */
  isLoaded: boolean;
  /** Whether validation passed */
  isValid: boolean;
  /** Load timestamp */
  timestamp: string | null;
  /** Energy domain counts */
  energy: ContractDomainCounts;
  /** Water domain counts */
  water: ContractDomainCounts;
  /** Temperature domain counts */
  temperature: ContractTemperatureCounts;
  /** Validation discrepancies (if any) */
  discrepancies?: Array<{
    domain: string;
    expected: number;
    actual: number;
  }>;
}

// ============================================
// CSS Styles
// ============================================

const CONTRACT_SUMMARY_TOOLTIP_CSS = `
/* ============================================
   Contract Summary Tooltip (RFC-0107)
   Premium draggable tooltip with light/dark theme support
   ============================================ */

/* Theme Variables */
.myio-contract-summary-tooltip,
.myio-contract-summary-tooltip[data-theme="light"] {
  /* Light theme (default) */
  --cst-bg-panel: #ffffff;
  --cst-bg-header: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --cst-bg-body: #f8f9fa;
  --cst-bg-footer: #f1f3f4;
  --cst-bg-domain: #ffffff;
  --cst-bg-domain-hover: #f5f5f5;
  --cst-bg-domain-details: #f8f9fa;
  --cst-bg-total: #e8f5e9;
  --cst-bg-icon: rgba(255, 255, 255, 0.2);
  --cst-bg-btn: rgba(255, 255, 255, 0.2);
  --cst-bg-btn-hover: rgba(255, 255, 255, 0.35);
  --cst-border-panel: #e0e0e0;
  --cst-border-domain: #e8e8e8;
  --cst-border-detail: #eeeeee;
  --cst-text-primary: #1a1a2e;
  --cst-text-secondary: #555555;
  --cst-text-muted: #888888;
  --cst-text-btn: rgba(255, 255, 255, 0.9);
  --cst-accent: #667eea;
  --cst-success: #2e7d32;
  --cst-error: #c62828;
  --cst-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 20px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
  --cst-pinned-shadow: 0 0 0 2px #667eea, 0 10px 40px rgba(0, 0, 0, 0.2);
}

.myio-contract-summary-tooltip[data-theme="dark"] {
  /* Dark theme */
  --cst-bg-panel: #2d1458;
  --cst-bg-header: linear-gradient(135deg, #9684B5 0%, #2d1458 100%);
  --cst-bg-body: #2d1458;
  --cst-bg-footer: rgba(0, 0, 0, 0.2);
  --cst-bg-domain: rgba(255, 255, 255, 0.05);
  --cst-bg-domain-hover: rgba(255, 255, 255, 0.08);
  --cst-bg-domain-details: rgba(0, 0, 0, 0.15);
  --cst-bg-total: rgba(255, 255, 255, 0.08);
  --cst-bg-icon: rgba(255, 255, 255, 0.15);
  --cst-bg-btn: rgba(255, 255, 255, 0.15);
  --cst-bg-btn-hover: rgba(255, 255, 255, 0.25);
  --cst-border-panel: rgba(255, 255, 255, 0.1);
  --cst-border-domain: rgba(255, 255, 255, 0.08);
  --cst-border-detail: rgba(255, 255, 255, 0.05);
  --cst-text-primary: #ffffff;
  --cst-text-secondary: rgba(255, 255, 255, 0.7);
  --cst-text-muted: rgba(255, 255, 255, 0.5);
  --cst-text-btn: rgba(255, 255, 255, 0.8);
  --cst-accent: #9684B5;
  --cst-success: #81c784;
  --cst-error: #ef5350;
  --cst-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 8px 20px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05);
  --cst-pinned-shadow: 0 0 0 2px #9684B5, 0 10px 40px rgba(0, 0, 0, 0.3);
}

.myio-contract-summary-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease, transform 0.25s ease;
  transform: translateY(5px);
}

.myio-contract-summary-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.myio-contract-summary-tooltip.closing {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
  pointer-events: none;
}

.myio-contract-summary-tooltip.pinned {
  box-shadow: var(--cst-pinned-shadow);
  border-radius: 16px;
}

.myio-contract-summary-tooltip.dragging {
  transition: none !important;
  cursor: move;
}

.myio-contract-summary-tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
}

.myio-contract-summary-tooltip.maximized .myio-contract-summary-tooltip__panel {
  width: 100%;
  height: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
}

.myio-contract-summary-tooltip.maximized .myio-contract-summary-tooltip__body {
  flex: 1;
  overflow-y: auto;
}

.myio-contract-summary-tooltip__panel {
  background: var(--cst-bg-panel);
  border: 1px solid var(--cst-border-panel);
  border-radius: 16px;
  box-shadow: var(--cst-shadow);
  min-width: 380px;
  max-width: 450px;
  font-family: Inter, system-ui, -apple-system, sans-serif;
  font-size: 12px;
  color: var(--cst-text-primary);
  overflow: hidden;
}

/* Header */
.myio-contract-summary-tooltip__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--cst-bg-header);
  border-radius: 16px 16px 0 0;
  position: relative;
  overflow: hidden;
  cursor: move;
  user-select: none;
}

.myio-contract-summary-tooltip__header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.3;
}

.myio-contract-summary-tooltip__icon {
  width: 40px;
  height: 40px;
  background: var(--cst-bg-icon);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 1;
  color: #ffffff;
}

.myio-contract-summary-tooltip__icon.valid {
  background: rgba(76, 175, 80, 0.3);
}

.myio-contract-summary-tooltip__icon.invalid {
  background: rgba(244, 67, 54, 0.3);
}

.myio-contract-summary-tooltip__header-info {
  flex: 1;
  position: relative;
  z-index: 1;
}

.myio-contract-summary-tooltip__title {
  font-weight: 700;
  font-size: 15px;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  margin-bottom: 2px;
}

.myio-contract-summary-tooltip__subtitle {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.myio-contract-summary-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
  z-index: 1;
}

.myio-contract-summary-tooltip__header-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: var(--cst-bg-btn);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: var(--cst-text-btn);
}

.myio-contract-summary-tooltip__header-btn:hover {
  background: var(--cst-bg-btn-hover);
  color: #ffffff;
  transform: scale(1.05);
}

.myio-contract-summary-tooltip__header-btn.pinned {
  background: rgba(255, 255, 255, 0.9);
  color: var(--cst-accent);
}

.myio-contract-summary-tooltip__header-btn.pinned:hover {
  background: #ffffff;
  color: var(--cst-bg-panel);
}

.myio-contract-summary-tooltip__header-btn svg {
  width: 14px;
  height: 14px;
}

/* Body */
.myio-contract-summary-tooltip__body {
  padding: 16px;
  background: var(--cst-bg-body);
}

/* Domain Section */
.myio-contract-summary-tooltip__domain {
  margin-bottom: 14px;
  background: var(--cst-bg-domain);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--cst-border-domain);
}

.myio-contract-summary-tooltip__domain:last-child {
  margin-bottom: 0;
}

.myio-contract-summary-tooltip__domain-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.myio-contract-summary-tooltip__domain-header:hover {
  background: var(--cst-bg-domain-hover);
}

.myio-contract-summary-tooltip__domain-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.myio-contract-summary-tooltip__domain-icon {
  font-size: 18px;
}

.myio-contract-summary-tooltip__domain-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--cst-text-primary);
}

.myio-contract-summary-tooltip__domain-count {
  font-size: 12px;
  color: var(--cst-success);
  font-weight: 600;
}

.myio-contract-summary-tooltip__expand-icon {
  font-size: 10px;
  opacity: 0.6;
  transition: transform 0.3s ease;
  color: var(--cst-text-secondary);
}

.myio-contract-summary-tooltip__domain.expanded .myio-contract-summary-tooltip__expand-icon {
  transform: rotate(180deg);
}

/* Domain Details */
.myio-contract-summary-tooltip__domain-details {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
  background: var(--cst-bg-domain-details);
}

.myio-contract-summary-tooltip__domain.expanded .myio-contract-summary-tooltip__domain-details {
  max-height: 150px;
}

.myio-contract-summary-tooltip__detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px 6px 40px;
  font-size: 12px;
  border-top: 1px solid var(--cst-border-detail);
}

.myio-contract-summary-tooltip__detail-row:first-child {
  border-top: none;
}

.myio-contract-summary-tooltip__detail-label {
  opacity: 0.7;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--cst-text-secondary);
}

.myio-contract-summary-tooltip__detail-label::before {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
}

.myio-contract-summary-tooltip__detail-count {
  font-weight: 500;
  color: var(--cst-success);
}

/* Status Banner */
.myio-contract-summary-tooltip__status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 14px;
  font-size: 12px;
  font-weight: 600;
}

.myio-contract-summary-tooltip__status.valid {
  background: rgba(76, 175, 80, 0.15);
  color: var(--cst-success);
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.myio-contract-summary-tooltip__status.invalid {
  background: rgba(244, 67, 54, 0.15);
  color: var(--cst-error);
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.myio-contract-summary-tooltip__status-icon {
  font-size: 14px;
}

/* Discrepancies */
.myio-contract-summary-tooltip__discrepancies {
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 14px;
}

.myio-contract-summary-tooltip__discrepancies-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--cst-error);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.myio-contract-summary-tooltip__discrepancy-item {
  font-size: 11px;
  color: var(--cst-text-secondary);
  padding: 3px 0;
}

/* Footer */
.myio-contract-summary-tooltip__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--cst-bg-footer);
  border-top: 1px solid var(--cst-border-detail);
  border-radius: 0 0 16px 16px;
}

.myio-contract-summary-tooltip__footer-label {
  font-size: 10px;
  color: var(--cst-text-muted);
}

.myio-contract-summary-tooltip__footer-value {
  font-size: 11px;
  font-weight: 600;
  color: var(--cst-text-secondary);
}

/* Total Devices Badge */
.myio-contract-summary-tooltip__total {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: var(--cst-bg-total);
  border-radius: 10px;
  margin-bottom: 14px;
}

.myio-contract-summary-tooltip__total-label {
  font-size: 12px;
  color: var(--cst-text-secondary);
}

.myio-contract-summary-tooltip__total-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--cst-success);
}

/* Responsive */
@media (max-width: 400px) {
  .myio-contract-summary-tooltip__panel {
    min-width: 280px;
    max-width: 95vw;
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

  const styleId = 'myio-contract-summary-tooltip-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = CONTRACT_SUMMARY_TOOLTIP_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ============================================
// State Management
// ============================================

export type TooltipTheme = 'light' | 'dark';

interface TooltipState {
  hideTimer: ReturnType<typeof setTimeout> | null;
  isMouseOverTooltip: boolean;
  isMaximized: boolean;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  savedPosition: { left: string; top: string } | null;
  pinnedCounter: number;
  expandedDomains: Set<string>;
  theme: TooltipTheme;
}

const state: TooltipState = {
  hideTimer: null,
  isMouseOverTooltip: false,
  isMaximized: false,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  savedPosition: null,
  pinnedCounter: 0,
  expandedDomains: new Set(['energy', 'water', 'temperature']),
  theme: 'light',
};

// ============================================
// Helper Functions
// ============================================

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString?: string | null): string {
  if (!isoString) return 'Agora';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return 'Agora';
  }
}

/**
 * Calculate total devices
 */
function calculateTotalDevices(data: ContractSummaryData): number {
  return data.energy.total + data.water.total + data.temperature.total;
}

/**
 * Generate header HTML with action buttons
 */
function generateHeaderHTML(data: ContractSummaryData): string {
  const iconClass = data.isValid ? 'valid' : 'invalid';
  const iconSymbol = data.isValid ? '✓' : '!';
  const totalDevices = calculateTotalDevices(data);

  return `
    <div class="myio-contract-summary-tooltip__header" data-drag-handle>
      <div class="myio-contract-summary-tooltip__icon ${iconClass}">${iconSymbol}</div>
      <div class="myio-contract-summary-tooltip__header-info">
        <div class="myio-contract-summary-tooltip__title">Resumo do Contrato</div>
        <div class="myio-contract-summary-tooltip__subtitle">${totalDevices} dispositivos carregados</div>
      </div>
      <div class="myio-contract-summary-tooltip__header-actions">
        <button class="myio-contract-summary-tooltip__header-btn" data-action="pin" title="Fixar na tela">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
            <line x1="12" y1="16" x2="12" y2="21"/>
            <line x1="8" y1="4" x2="16" y2="4"/>
          </svg>
        </button>
        <button class="myio-contract-summary-tooltip__header-btn" data-action="maximize" title="Maximizar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        </button>
        <button class="myio-contract-summary-tooltip__header-btn" data-action="close" title="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Generate domain section HTML
 */
function generateDomainHTML(
  domain: string,
  icon: string,
  name: string,
  counts: ContractDomainCounts | ContractTemperatureCounts,
  isTemperature = false
): string {
  const isExpanded = state.expandedDomains.has(domain);
  const expandedClass = isExpanded ? 'expanded' : '';

  let detailsHTML = '';
  if (isTemperature) {
    const tempCounts = counts as ContractTemperatureCounts;
    detailsHTML = `
      <div class="myio-contract-summary-tooltip__detail-row">
        <span class="myio-contract-summary-tooltip__detail-label">Internos (Climatizacao)</span>
        <span class="myio-contract-summary-tooltip__detail-count">${tempCounts.internal}</span>
      </div>
      <div class="myio-contract-summary-tooltip__detail-row">
        <span class="myio-contract-summary-tooltip__detail-label">Lojas (Nao-Climatizados)</span>
        <span class="myio-contract-summary-tooltip__detail-count">${tempCounts.stores}</span>
      </div>
    `;
  } else {
    const domainCounts = counts as ContractDomainCounts;
    detailsHTML = `
      <div class="myio-contract-summary-tooltip__detail-row">
        <span class="myio-contract-summary-tooltip__detail-label">Entradas</span>
        <span class="myio-contract-summary-tooltip__detail-count">${domainCounts.entries}</span>
      </div>
      <div class="myio-contract-summary-tooltip__detail-row">
        <span class="myio-contract-summary-tooltip__detail-label">Area Comum</span>
        <span class="myio-contract-summary-tooltip__detail-count">${domainCounts.commonArea}</span>
      </div>
      <div class="myio-contract-summary-tooltip__detail-row">
        <span class="myio-contract-summary-tooltip__detail-label">Lojas</span>
        <span class="myio-contract-summary-tooltip__detail-count">${domainCounts.stores}</span>
      </div>
    `;
  }

  return `
    <div class="myio-contract-summary-tooltip__domain ${expandedClass}" data-domain="${domain}">
      <div class="myio-contract-summary-tooltip__domain-header" data-toggle-domain="${domain}">
        <div class="myio-contract-summary-tooltip__domain-info">
          <span class="myio-contract-summary-tooltip__domain-icon">${icon}</span>
          <span class="myio-contract-summary-tooltip__domain-name">${name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="myio-contract-summary-tooltip__domain-count">${counts.total} dispositivos</span>
          <span class="myio-contract-summary-tooltip__expand-icon">▼</span>
        </div>
      </div>
      <div class="myio-contract-summary-tooltip__domain-details">
        ${detailsHTML}
      </div>
    </div>
  `;
}

/**
 * Generate body HTML
 */
function generateBodyHTML(data: ContractSummaryData): string {
  const totalDevices = calculateTotalDevices(data);
  const timestamp = formatTimestamp(data.timestamp);

  const statusClass = data.isValid ? 'valid' : 'invalid';
  const statusIcon = data.isValid ? '✓' : '⚠';
  const statusText = data.isValid
    ? 'Contrato validado com sucesso'
    : 'Problemas de validacao detectados';

  let discrepanciesHTML = '';
  if (data.discrepancies && data.discrepancies.length > 0) {
    const items = data.discrepancies
      .map(d => `<div class="myio-contract-summary-tooltip__discrepancy-item">${d.domain}: esperado ${d.expected}, encontrado ${d.actual}</div>`)
      .join('');
    discrepanciesHTML = `
      <div class="myio-contract-summary-tooltip__discrepancies">
        <div class="myio-contract-summary-tooltip__discrepancies-title">Divergencias</div>
        ${items}
      </div>
    `;
  }

  return `
    <div class="myio-contract-summary-tooltip__body">
      <!-- Status Banner -->
      <div class="myio-contract-summary-tooltip__status ${statusClass}">
        <span class="myio-contract-summary-tooltip__status-icon">${statusIcon}</span>
        <span>${statusText}</span>
      </div>

      ${discrepanciesHTML}

      <!-- Total Devices -->
      <div class="myio-contract-summary-tooltip__total">
        <span class="myio-contract-summary-tooltip__total-label">Total de Dispositivos:</span>
        <span class="myio-contract-summary-tooltip__total-value">${totalDevices}</span>
      </div>

      <!-- Energy -->
      ${generateDomainHTML('energy', '⚡', 'Energia', data.energy)}

      <!-- Water -->
      ${generateDomainHTML('water', '💧', 'Agua', data.water)}

      <!-- Temperature -->
      ${generateDomainHTML('temperature', '🌡️', 'Temperatura', data.temperature, true)}
    </div>

    <!-- Footer -->
    <div class="myio-contract-summary-tooltip__footer">
      <span class="myio-contract-summary-tooltip__footer-label">Carregado em</span>
      <span class="myio-contract-summary-tooltip__footer-value">${timestamp}</span>
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
 * Setup domain toggle listeners
 */
function setupDomainToggleListeners(container: HTMLElement): void {
  const toggles = container.querySelectorAll('[data-toggle-domain]');
  toggles.forEach(toggle => {
    (toggle as HTMLElement).onclick = (e: MouseEvent) => {
      e.stopPropagation();
      const domain = (toggle as HTMLElement).dataset.toggleDomain;
      if (!domain) return;

      const domainEl = container.querySelector(`[data-domain="${domain}"]`);
      if (!domainEl) return;

      if (state.expandedDomains.has(domain)) {
        state.expandedDomains.delete(domain);
        domainEl.classList.remove('expanded');
      } else {
        state.expandedDomains.add(domain);
        domainEl.classList.add('expanded');
      }
    };
  });
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
          ContractSummaryTooltip.close();
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
    if ((e.target as HTMLElement).closest('[data-toggle-domain]')) return;
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
  const pinnedId = `myio-contract-summary-tooltip-pinned-${state.pinnedCounter}`;

  const clone = container.cloneNode(true) as HTMLElement;
  clone.id = pinnedId;
  clone.classList.add('pinned');
  clone.classList.remove('closing');

  // Preserve theme on clone
  clone.setAttribute('data-theme', state.theme);

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
  ContractSummaryTooltip.hide();
}

/**
 * Setup listeners for pinned clone
 */
function setupPinnedCloneListeners(clone: HTMLElement, cloneId: string): void {
  let isMaximized = false;
  let savedPosition: { left: string; top: string } | null = null;
  const cloneExpandedDomains = new Set(state.expandedDomains);

  // Domain toggles
  const toggles = clone.querySelectorAll('[data-toggle-domain]');
  toggles.forEach(toggle => {
    (toggle as HTMLElement).onclick = (e: MouseEvent) => {
      e.stopPropagation();
      const domain = (toggle as HTMLElement).dataset.toggleDomain;
      if (!domain) return;

      const domainEl = clone.querySelector(`[data-domain="${domain}"]`);
      if (!domainEl) return;

      if (cloneExpandedDomains.has(domain)) {
        cloneExpandedDomains.delete(domain);
        domainEl.classList.remove('expanded');
      } else {
        cloneExpandedDomains.add(domain);
        domainEl.classList.add('expanded');
      }
    };
  });

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
      if ((e.target as HTMLElement).closest('[data-toggle-domain]')) return;
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
  const container = document.getElementById('myio-contract-summary-tooltip');
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

  const tooltipWidth = 360;
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
// ContractSummaryTooltip Object
// ============================================

export const ContractSummaryTooltip = {
  containerId: 'myio-contract-summary-tooltip',

  /**
   * Get or create container
   */
  getContainer(): HTMLElement {
    injectCSS();

    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'myio-contract-summary-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Show tooltip
   */
  show(triggerElement: HTMLElement, data: ContractSummaryData, options?: { theme?: TooltipTheme }): void {
    // Cancel pending hide
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }

    const container = this.getContainer();
    container.classList.remove('closing');

    // Apply theme
    const theme = options?.theme || state.theme;
    container.setAttribute('data-theme', theme);

    // Build HTML
    container.innerHTML = `
      <div class="myio-contract-summary-tooltip__panel">
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
    setupDomainToggleListeners(container);
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
   * Set the default theme for the tooltip
   * @param theme - 'light' or 'dark'
   */
  setTheme(theme: TooltipTheme): void {
    state.theme = theme;

    // Update existing container if visible
    const container = document.getElementById(this.containerId);
    if (container) {
      container.setAttribute('data-theme', theme);
    }

    // Also update any pinned clones
    const pinnedClones = document.querySelectorAll('[id^="myio-contract-summary-tooltip-pinned-"]');
    pinnedClones.forEach(clone => {
      clone.setAttribute('data-theme', theme);
    });
  },

  /**
   * Get the current theme
   */
  getTheme(): TooltipTheme {
    return state.theme;
  },

  /**
   * Attach tooltip to trigger element with click behavior
   */
  attach(
    triggerElement: HTMLElement,
    getDataFn: () => ContractSummaryData | null
  ): () => void {
    const self = this;

    const handleClick = () => {
      if (state.hideTimer) {
        clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
      const data = getDataFn();
      if (data) {
        self.show(triggerElement, data);
      }
    };

    triggerElement.addEventListener('click', handleClick);

    // Return cleanup function
    return () => {
      triggerElement.removeEventListener('click', handleClick);
      self.hide();
    };
  },

  /**
   * Attach tooltip with hover behavior
   */
  attachHover(
    triggerElement: HTMLElement,
    getDataFn: () => ContractSummaryData | null
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
   * Build contract data from window.CONTRACT_STATE
   * Helper method to build the data structure from global state
   */
  buildFromGlobalState(): ContractSummaryData | null {
    const globalState = (window as unknown as { CONTRACT_STATE?: ContractSummaryData }).CONTRACT_STATE;
    if (!globalState) return null;

    return {
      isLoaded: globalState.isLoaded ?? false,
      isValid: globalState.isValid ?? false,
      timestamp: globalState.timestamp ?? null,
      energy: {
        total: globalState.energy?.total ?? 0,
        entries: globalState.energy?.entries ?? 0,
        commonArea: globalState.energy?.commonArea ?? 0,
        stores: globalState.energy?.stores ?? 0,
      },
      water: {
        total: globalState.water?.total ?? 0,
        entries: globalState.water?.entries ?? 0,
        commonArea: globalState.water?.commonArea ?? 0,
        stores: globalState.water?.stores ?? 0,
      },
      temperature: {
        total: globalState.temperature?.total ?? 0,
        internal: globalState.temperature?.internal ?? 0,
        stores: globalState.temperature?.stores ?? 0,
      },
      discrepancies: globalState.discrepancies,
    };
  },
};

// Default export
export default ContractSummaryTooltip;
