/* eslint-disable */
/**
 * MYIO Ambiente Card Component - Version 6
 * Card for displaying "ambiente" (environment) with aggregated device data.
 *
 * @version 6.0.0
 * @author MYIO Frontend Guild
 *
 * Features:
 * - Displays ambiente with multiple device types:
 *   - Temperature sensor (termostato)
 *   - Energy meter (3F_MEDIDOR)
 *   - Remote control (on/off)
 * - Piano-key action buttons on left side
 * - Draggable and selectable support
 * - Status aggregation from all devices
 * - CustomStyle support for per-card overrides
 */

import { MyIOSelectionStore } from '../SelectionStore.js';
import { MyIODraggableCard } from '../DraggableCard.js';
import { formatEnergy } from '../../format/energy.ts';

// ============================================
// CONSTANTS
// ============================================

/** Maximum characters for ambiente label before truncation */
const LABEL_CHAR_LIMIT = 20;

/** CSS ID for injected styles */
const STYLES_ID = 'myio-card-ambiente-v6-styles';

/** Default images */
const IMAGES = {
  thermometer: 'https://cdn-icons-png.flaticon.com/512/1843/1843544.png',
  energy: 'https://cdn-icons-png.flaticon.com/512/2910/2910756.png',
  remote: 'https://cdn-icons-png.flaticon.com/512/3659/3659899.png',
  ambiente: 'https://cdn-icons-png.flaticon.com/512/2838/2838912.png',
  dashboard: 'https://cdn-icons-png.flaticon.com/512/1828/1828765.png',
  report: 'https://cdn-icons-png.flaticon.com/512/2991/2991112.png',
  settings: 'https://cdn-icons-png.flaticon.com/512/2099/2099058.png',
};

/** Status colors */
const STATUS_COLORS = {
  online: '#28a745',
  offline: '#dc3545',
  warning: '#ffc107',
  neutral: '#6c757d',
};

// ============================================
// CSS STYLES
// ============================================

const CARD_STYLES = `
  .myio-ambiente-card-container {
    position: relative;
    width: 100%;
  }

  .myio-ambiente-card {
    width: 100%;
    border-radius: 12px;
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
    overflow: hidden;
    min-height: 120px;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    border: 1px solid #e9ecef;
  }

  .myio-ambiente-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  }

  .myio-ambiente-card.clickable {
    cursor: pointer;
  }

  .myio-ambiente-card.selected {
    border: 2px solid #00e09e;
    box-shadow: 0 4px 12px rgba(0, 224, 158, 0.2);
    background: linear-gradient(135deg, #f0fdf9, #ecfdf5);
  }

  .myio-ambiente-card.offline {
    border: 2px solid #ff4d4f;
    animation: ambiente-border-blink 1s infinite;
  }

  @keyframes ambiente-border-blink {
    0%, 100% { box-shadow: 0 0 8px rgba(255, 77, 79, 0.6); }
    50% { box-shadow: 0 0 16px rgba(255, 0, 0, 0.4); }
  }

  /* Piano-key action buttons (left side) */
  .myio-ambiente-card__actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    padding: 6px 4px;
    justify-content: center;
    align-items: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.02);
    border-right: 1px solid rgba(0, 0, 0, 0.05);
  }

  .myio-ambiente-card__action {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s ease;
    cursor: pointer;
    border: none;
    background: transparent;
    padding: 0;
  }

  .myio-ambiente-card__action:hover {
    background: rgba(47, 88, 72, 0.1);
    transform: scale(1.1);
  }

  .myio-ambiente-card__action img {
    width: 18px;
    height: 18px;
    opacity: 0.7;
  }

  .myio-ambiente-card__action:hover img {
    opacity: 1;
  }

  .myio-ambiente-card__checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #2F5848;
  }

  /* Card body (center content) */
  .myio-ambiente-card__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    min-width: 0;
  }

  /* Header row with label and status */
  .myio-ambiente-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .myio-ambiente-card__label {
    font-weight: 600;
    font-size: 0.9rem;
    color: #1a1a1a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .myio-ambiente-card__status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-left: 8px;
  }

  .myio-ambiente-card__status-dot.online {
    background: #28a745;
    box-shadow: 0 0 6px rgba(40, 167, 69, 0.5);
  }

  .myio-ambiente-card__status-dot.offline {
    background: #dc3545;
    animation: status-pulse 1s infinite;
  }

  @keyframes status-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Metrics row */
  .myio-ambiente-card__metrics {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .myio-ambiente-card__metric {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    color: #495057;
  }

  .myio-ambiente-card__metric-icon {
    font-size: 1rem;
  }

  .myio-ambiente-card__metric-value {
    font-weight: 600;
    color: #212529;
  }

  .myio-ambiente-card__metric-value.temperature {
    color: #0d6efd;
  }

  .myio-ambiente-card__metric-value.consumption {
    color: #198754;
  }

  .myio-ambiente-card__metric-value.remote-on {
    color: #28a745;
  }

  .myio-ambiente-card__metric-value.remote-off {
    color: #6c757d;
  }

  /* RFC-0168: Humidity metric */
  .myio-ambiente-card__metric-value.humidity {
    color: #17a2b8;
  }

  /* RFC-0168: Setup warning state */
  .myio-ambiente-card.setup-warning {
    border: 2px dashed #ffc107;
    background: linear-gradient(135deg, #fffbe6 0%, #fff8dc 100%);
  }

  .myio-ambiente-card__warning {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(255, 193, 7, 0.15);
    border-radius: 6px;
    color: #856404;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .myio-ambiente-card__warning-icon {
    font-size: 1rem;
  }

  /* Identifier row */
  .myio-ambiente-card__identifier {
    font-size: 0.7rem;
    color: #868e96;
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Device count badge */
  .myio-ambiente-card__device-count {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 6px;
    background: rgba(47, 88, 72, 0.1);
    border-radius: 10px;
    font-size: 0.65rem;
    color: #2F5848;
    margin-top: 6px;
  }

  /* Remote control toggle */
  .myio-ambiente-card__remote-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.03);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .myio-ambiente-card__remote-toggle:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  .myio-ambiente-card__remote-toggle.on {
    background: rgba(40, 167, 69, 0.1);
  }

  .myio-ambiente-card__remote-toggle.off {
    background: rgba(108, 117, 125, 0.1);
  }
`;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Inject styles into document head (once)
 */
function injectStyles() {
  if (document.getElementById(STYLES_ID)) return;
  const style = document.createElement('style');
  style.id = STYLES_ID;
  style.textContent = CARD_STYLES;
  document.head.appendChild(style);
}

/**
 * Truncate label if too long
 */
function truncateLabel(label, maxLength = LABEL_CHAR_LIMIT) {
  if (!label) return 'Ambiente';
  if (label.length <= maxLength) return label;
  return label.substring(0, maxLength - 3) + '...';
}

/**
 * Format temperature value
 */
function formatTemperature(value) {
  if (value === null || value === undefined || isNaN(value)) return '--';
  const num = Number(value);
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + '°C';
}

/**
 * RFC-0168: Format humidity value
 */
function formatHumidity(value) {
  if (value === null || value === undefined || isNaN(value)) return '--';
  const num = Number(value);
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }) + '%';
}

/**
 * Format energy/consumption value
 */
function formatConsumption(value) {
  if (value === null || value === undefined || isNaN(value)) return '--';
  const num = Number(value);
  if (typeof formatEnergy === 'function') {
    return formatEnergy(num);
  }
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' kW';
}

/**
 * Determine overall status from devices
 */
function getAggregatedStatus(devices) {
  if (!devices || devices.length === 0) return 'offline';
  const hasOffline = devices.some(d => d.status === 'offline' || d.connectionStatus === 'offline');
  const allOnline = devices.every(d => d.status === 'online' || d.connectionStatus === 'online');
  if (allOnline) return 'online';
  if (hasOffline) return 'offline';
  return 'online';
}

// ============================================
// MAIN COMPONENT
// ============================================

/**
 * @typedef {Object} AmbienteDevice
 * @property {string} id - Device ID
 * @property {string} type - Device type: 'temperature' | 'energy' | 'remote'
 * @property {string} [deviceType] - Original device type (TERMOSTATO, 3F_MEDIDOR, etc.)
 * @property {string} [status] - Device status: 'online' | 'offline'
 * @property {number} [value] - Current value (temperature, consumption, or 0/1 for remote)
 */

/**
 * @typedef {Object} AmbienteData
 * @property {string} id - Ambiente ID
 * @property {string} label - Display label
 * @property {string} [identifier] - Optional identifier
 * @property {number} [temperature] - Current temperature (°C)
 * @property {number} [consumption] - Current consumption (kW)
 * @property {boolean} [isOn] - Remote state (on/off)
 * @property {boolean} [hasRemote] - Whether ambiente has remote control
 * @property {string} [status] - Overall status
 * @property {AmbienteDevice[]} [devices] - Array of devices in this ambiente
 */

/**
 * @typedef {Object} CustomStyle
 * @property {string} [fontSize] - CSS font-size
 * @property {string} [backgroundColor] - CSS background-color
 * @property {string} [fontColor] - CSS color
 * @property {string} [width] - CSS width
 * @property {string} [height] - CSS height
 */

/**
 * @typedef {Object} RenderCardAmbienteOptions
 * @property {AmbienteData} ambienteData - The ambiente data object
 * @property {Function} [handleActionDashboard] - Dashboard button callback
 * @property {Function} [handleActionReport] - Report button callback
 * @property {Function} [handleActionSettings] - Settings button callback
 * @property {Function} [handleClickCard] - Card click callback
 * @property {Function} [handleSelect] - Selection change callback
 * @property {Function} [handleToggleRemote] - Remote toggle callback
 * @property {boolean} [enableSelection=true] - Enable selection checkbox
 * @property {boolean} [enableDragDrop=true] - Enable drag and drop
 * @property {CustomStyle} [customStyle] - Per-card style overrides
 */

/**
 * Renders an Ambiente card component with aggregated device data.
 *
 * @param {RenderCardAmbienteOptions} options - Card options
 * @returns {[HTMLElement, Object]} Tuple of [container element, card API]
 *
 * @example
 * const [cardEl, api] = renderCardAmbienteV6({
 *   ambienteData: {
 *     id: 'amb-001',
 *     label: 'Sala de Reunião',
 *     temperature: 22.5,
 *     consumption: 1.8,
 *     isOn: true,
 *     hasRemote: true,
 *     status: 'online',
 *     devices: [
 *       { id: 'dev-1', type: 'temperature', value: 22.5 },
 *       { id: 'dev-2', type: 'energy', value: 1.8 },
 *       { id: 'dev-3', type: 'remote', value: 1 },
 *     ],
 *   },
 *   handleClickCard: (data) => console.log('Clicked:', data),
 *   handleToggleRemote: (isOn) => console.log('Toggle:', isOn),
 * });
 */
export function renderCardAmbienteV6({
  ambienteData,
  handleActionDashboard,
  handleActionReport,
  handleActionSettings,
  handleClickCard,
  handleSelect,
  handleToggleRemote,
  enableSelection = true,
  enableDragDrop = true,
  customStyle,
}) {
  // Inject styles
  injectStyles();

  // Extract data
  // RFC-0168: Added humidity and hasSetupWarning fields
  const {
    id,
    label,
    identifier,
    temperature,
    humidity, // RFC-0168: Humidity from TERMOSTATO
    consumption,
    isOn,
    hasRemote,
    status,
    hasSetupWarning, // RFC-0168: True if ASSET_AMBIENT has no children
    devices = [],
  } = ambienteData || {};

  // DEBUG: Log received data
  console.log('[renderCardAmbienteV6] ambienteData:', {
    id,
    label,
    temperature,
    humidity,
    status,
    hasSetupWarning,
    fullData: ambienteData,
  });

  // Determine aggregated status
  const aggregatedStatus = status || getAggregatedStatus(devices);
  const isOffline = aggregatedStatus === 'offline';
  const isWarning = hasSetupWarning || aggregatedStatus === 'warning';

  // Create container
  const container = document.createElement('div');
  container.className = 'myio-ambiente-card-container';
  container.dataset.ambienteId = id || '';

  // Create card element
  // RFC-0168: Added setup-warning class for cards with no child devices
  const card = document.createElement('div');
  card.className = `myio-ambiente-card${handleClickCard ? ' clickable' : ''}${isOffline ? ' offline' : ''}${isWarning ? ' setup-warning' : ''}`;

  // === BODY (Center content) ===
  // Note: Actions (piano keys) removed for simplified card layout
  const bodyEl = document.createElement('div');
  bodyEl.className = 'myio-ambiente-card__body';

  // Header with label and status
  const headerEl = document.createElement('div');
  headerEl.className = 'myio-ambiente-card__header';

  const labelEl = document.createElement('div');
  labelEl.className = 'myio-ambiente-card__label';
  labelEl.textContent = truncateLabel(label);
  labelEl.title = label || '';
  headerEl.appendChild(labelEl);

  const statusDot = document.createElement('div');
  statusDot.className = `myio-ambiente-card__status-dot ${aggregatedStatus}`;
  statusDot.title = aggregatedStatus === 'online' ? 'Online' : 'Offline';
  headerEl.appendChild(statusDot);

  bodyEl.appendChild(headerEl);

  // Metrics row
  const metricsEl = document.createElement('div');
  metricsEl.className = 'myio-ambiente-card__metrics';

  // RFC-0168: Show setup warning if no child devices
  if (hasSetupWarning) {
    const warningEl = document.createElement('div');
    warningEl.className = 'myio-ambiente-card__warning';
    warningEl.innerHTML = `
      <span class="myio-ambiente-card__warning-icon">⚠️</span>
      <span>Configuração Necessária</span>
    `;
    metricsEl.appendChild(warningEl);
  } else {
    // Temperature metric
    if (temperature !== undefined && temperature !== null) {
      const tempMetric = document.createElement('div');
      tempMetric.className = 'myio-ambiente-card__metric';
      tempMetric.innerHTML = `
        <span class="myio-ambiente-card__metric-icon">🌡️</span>
        <span class="myio-ambiente-card__metric-value temperature">${formatTemperature(temperature)}</span>
      `;
      metricsEl.appendChild(tempMetric);
    }

    // RFC-0168: Humidity metric (if available)
    if (humidity !== undefined && humidity !== null) {
      const humidityMetric = document.createElement('div');
      humidityMetric.className = 'myio-ambiente-card__metric';
      humidityMetric.innerHTML = `
        <span class="myio-ambiente-card__metric-icon">💧</span>
        <span class="myio-ambiente-card__metric-value humidity">${formatHumidity(humidity)}</span>
      `;
      metricsEl.appendChild(humidityMetric);
    }

    // Consumption metric
    if (consumption !== undefined && consumption !== null) {
      const consMetric = document.createElement('div');
      consMetric.className = 'myio-ambiente-card__metric';
      consMetric.innerHTML = `
        <span class="myio-ambiente-card__metric-icon">⚡</span>
        <span class="myio-ambiente-card__metric-value consumption">${formatConsumption(consumption)}</span>
      `;
      metricsEl.appendChild(consMetric);
    }
  }

  // Remote toggle (if has remote and not in warning state)
  // RFC-0168: Only show remote toggle when not in setup warning state
  if (hasRemote && !hasSetupWarning) {
    const remoteEl = document.createElement('div');
    remoteEl.className = `myio-ambiente-card__remote-toggle ${isOn ? 'on' : 'off'}`;
    remoteEl.innerHTML = `
      <span>${isOn ? '🟢' : '⚫'}</span>
      <span class="myio-ambiente-card__metric-value ${isOn ? 'remote-on' : 'remote-off'}">${isOn ? 'Ligado' : 'Desligado'}</span>
    `;
    remoteEl.title = 'Clique para alternar';
    remoteEl.addEventListener('click', (e) => {
      e.stopPropagation();
      handleToggleRemote?.(!isOn, ambienteData);
    });
    metricsEl.appendChild(remoteEl);
  }

  bodyEl.appendChild(metricsEl);

  // Identifier
  if (identifier) {
    const idEl = document.createElement('div');
    idEl.className = 'myio-ambiente-card__identifier';
    idEl.textContent = identifier;
    bodyEl.appendChild(idEl);
  }

  // Device count badge - removed for simplified layout

  card.appendChild(bodyEl);

  // === CLICK HANDLER ===
  if (handleClickCard) {
    card.addEventListener('click', () => {
      handleClickCard(ambienteData);
    });
  }

  // === DRAG AND DROP ===
  if (enableDragDrop && MyIODraggableCard) {
    const draggable = new MyIODraggableCard(card, {
      entityId: id,
      entityType: 'AMBIENTE',
      data: ambienteData,
    });
  }

  container.appendChild(card);

  // === APPLY CUSTOM STYLE ===
  if (customStyle) {
    applyCustomStyle(container, card, customStyle);
  }

  // === API ===
  const api = {
    getElement: () => container,
    getId: () => id,
    getData: () => ambienteData,
    setSelected: (selected) => {
      card.classList.toggle('selected', selected);
      const checkbox = container.querySelector('.myio-ambiente-card__checkbox');
      if (checkbox) checkbox.checked = selected;
    },
    updateData: (newData) => {
      // Update temperature
      const tempValue = container.querySelector('.myio-ambiente-card__metric-value.temperature');
      if (tempValue && newData.temperature !== undefined) {
        tempValue.textContent = formatTemperature(newData.temperature);
      }
      // RFC-0168: Update humidity
      const humidityValue = container.querySelector('.myio-ambiente-card__metric-value.humidity');
      if (humidityValue && newData.humidity !== undefined) {
        humidityValue.textContent = formatHumidity(newData.humidity);
      }
      // Update consumption
      const consValue = container.querySelector('.myio-ambiente-card__metric-value.consumption');
      if (consValue && newData.consumption !== undefined) {
        consValue.textContent = formatConsumption(newData.consumption);
      }
      // Update remote state
      if (newData.isOn !== undefined) {
        const remoteEl = container.querySelector('.myio-ambiente-card__remote-toggle');
        if (remoteEl) {
          remoteEl.classList.toggle('on', newData.isOn);
          remoteEl.classList.toggle('off', !newData.isOn);
          remoteEl.innerHTML = `
            <span>${newData.isOn ? '🟢' : '⚫'}</span>
            <span class="myio-ambiente-card__metric-value ${newData.isOn ? 'remote-on' : 'remote-off'}">${newData.isOn ? 'Ligado' : 'Desligado'}</span>
          `;
        }
      }
      // Update status
      if (newData.status) {
        const statusDotEl = container.querySelector('.myio-ambiente-card__status-dot');
        if (statusDotEl) {
          statusDotEl.className = `myio-ambiente-card__status-dot ${newData.status}`;
        }
        card.classList.toggle('offline', newData.status === 'offline');
        // RFC-0168: Handle warning status
        card.classList.toggle('setup-warning', newData.status === 'warning' || newData.hasSetupWarning);
      }
    },
    destroy: () => {
      container.remove();
    },
  };

  return [container, api];
}

/**
 * Apply custom styles to card
 */
function applyCustomStyle(container, card, customStyle) {
  const { fontSize, backgroundColor, fontColor, width, height } = customStyle;

  if (width) {
    container.style.width = width;
  }

  if (height) {
    container.style.height = height;
    card.style.minHeight = height;
  }

  if (backgroundColor) {
    card.style.background = backgroundColor;
  }

  if (fontColor) {
    card.style.color = fontColor;
    const label = card.querySelector('.myio-ambiente-card__label');
    if (label) label.style.color = fontColor;
  }

  if (fontSize) {
    const label = card.querySelector('.myio-ambiente-card__label');
    if (label) label.style.fontSize = fontSize;
  }
}

export default renderCardAmbienteV6;
