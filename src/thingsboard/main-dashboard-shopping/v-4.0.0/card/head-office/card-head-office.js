// src/thingsboard/main-dashboard-shopping/v-4.0.0/card/head-office/card-head-office.js
// Core Head Office card component implementation

/* eslint-env browser */
/* eslint-disable */
import { CSS_STRING } from './card-head-office.css.js';
import { Icons, ICON_MAP } from '../../head-office/card-head-office.icons';
import { DEFAULT_I18N } from '../../head-office/card-head-office.types';
import { formatEnergy } from '../../../../../format/energy.ts';
import { formatWaterVolumeM3 } from '../../../../../format/water.ts';
import { formatTemperature } from '../../../../../components/temperature/utils';
import {
  DeviceStatusType,
  mapDeviceToConnectionStatus,
  getDeviceStatusInfo,
} from '../../../../../utils/deviceStatus.js';
import { createLogHelper } from '../../../../../utils/logHelper.js';

// ============================================
// CONSTANTS
// ============================================

/** Maximum characters for device label display before truncation */
const LABEL_CHAR_LIMIT = 18;
const DEFAUL_DELAY_TIME_CONNECTION_IN_MINS = 1440; // 24 hours x 60 minutes = 1440 mins
const CSS_TAG = 'head-office-card-v1';

/**
 * Ensure CSS is injected once per page
 */
function ensureCss() {
  if (!document.querySelector(`style[data-myio-css="${CSS_TAG}"]`)) {
    const style = document.createElement('style');
    style.setAttribute('data-myio-css', CSS_TAG);
    style.textContent = CSS_STRING;
    document.head.appendChild(style);
  }
}

const ModalIcons = {
  centralName: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9"/><path d="M12 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z"/></svg>`,
  identifier: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  connection: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>`,
  target: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  tolerance: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  excess: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
};

/**
 * Normalize and validate parameters
 */
function normalizeParams(params) {
  if (!params || !params.entityObject) {
    throw new Error('renderCardCompenteHeadOffice: entityObject is required');
  }

  // Create LogHelper based on debugActive param (default: false)
  const LogHelper = createLogHelper(params.debugActive ?? false);

  const entityObject = params.entityObject;
  if (!entityObject.entityId) {
    LogHelper.warn('[CardHeadOffice] entityId is missing, generating temporary ID');
    entityObject.entityId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  if (!params.delayTimeConnectionInMins) {
    LogHelper.warn(
      `[CardHeadOffice] delayTimeConnectionInMins is missing, defaulting to ${DEFAUL_DELAY_TIME_CONNECTION_IN_MINS} mins`
    );
  }

  return {
    entityObject,
    i18n: { ...DEFAULT_I18N, ...(params.i18n || {}) },
    enableSelection: Boolean(params.enableSelection),
    enableDragDrop: Boolean(params.enableDragDrop),
    useNewComponents: Boolean(params.useNewComponents),
    // RFC-0091: Configurable delay time for connection status check (default 15 minutes)
    delayTimeConnectionInMins: params.delayTimeConnectionInMins ?? DEFAUL_DELAY_TIME_CONNECTION_IN_MINS,
    // Debug options
    debugActive: params.debugActive ?? false,
    activeTooltipDebug: params.activeTooltipDebug ?? false,
    // LogHelper instance for this card
    LogHelper,
    callbacks: {
      handleActionDashboard: params.handleActionDashboard,
      handleActionReport: params.handleActionReport,
      handleActionSettings: params.handleActionSettings,
      handleSelect: params.handleSelect,
      handInfo: params.handInfo,
      handleClickCard: params.handleClickCard,
    },
  };
}

/**
 * Get icon SVG for device type
 */
function getIconSvg(deviceType, domain) {
  // Se o domínio for 'water', força o ícone de gota
  if (domain === 'water') {
    return Icons.waterDrop; // Usa o ícone que acabamos de criar
  }

  if (domain === 'temperature') {
    return Icons.thermometer;
  }

  // Caso contrário, segue a lógica padrão por tipo de dispositivo
  return ICON_MAP[deviceType] || ICON_MAP.DEFAULT;
}

/**
 * Format power value (W to kW conversion)
 * If value >= 1000W, convert to kW with 2 decimal places rounded up
 * @param {number} valueInWatts - Power value in Watts
 * @returns {{ num: string, unit: string }}
 */
function formatPower(valueInWatts) {
  if (valueInWatts === null || valueInWatts === undefined || isNaN(valueInWatts)) {
    return { num: '-', unit: '' };
  }

  const val = Number(valueInWatts);
  if (val >= 1000) {
    // Convert to kW, round up to 2 decimal places
    const kw = Math.ceil((val / 1000) * 100) / 100;
    return { num: kw.toFixed(2), unit: 'kW' };
  } else {
    // Keep in W, round up
    const w = Math.ceil(val);
    return { num: w.toString(), unit: 'W' };
  }
}

/**
 * Format volume value (L to m³ conversion)
 * If value >= 1000L, convert to m³ with 2 decimal places rounded up
 * @param {number} valueInLiters - Volume value in Liters
 * @returns {{ num: string, unit: string }}
 */
function formatVolume(valueInLiters) {
  if (valueInLiters === null || valueInLiters === undefined || isNaN(valueInLiters)) {
    return { num: '-', unit: '' };
  }

  const val = Number(valueInLiters);
  if (val >= 1000) {
    // Convert to m³, round up to 2 decimal places
    const m3 = Math.ceil((val / 1000) * 100) / 100;
    return { num: m3.toFixed(2), unit: 'm³' };
  } else {
    // Keep in L, round up
    const l = Math.ceil(val);
    return { num: l.toString(), unit: 'L' };
  }
}

/**
 * Format primary value based on type
 */
function formatPrimaryValue(val, valType) {
  if (val === null || val === undefined || isNaN(val)) {
    return { num: '—', unit: '', suffix: '' };
  }

  switch (valType) {
    case 'power_kw':
      // val is already in kWh (consumption)
      return {
        num: val.toFixed(1),
        unit: 'kWh',
        suffix: '',
      };
    case 'power_w':
      // val is in Watts, convert if >= 1000
      const formattedPower = formatPower(val);
      return {
        num: formattedPower.num,
        unit: formattedPower.unit,
        suffix: '',
      };
    case 'volume_l':
      // val is in Liters, convert to m³ if >= 1000
      const formattedVolume = formatVolume(val);
      return {
        num: formattedVolume.num,
        unit: formattedVolume.unit,
        suffix: '',
      };
    case 'flow_m3h':
      return {
        num: val.toFixed(1),
        unit: 'm³/h',
        suffix: '',
      };
    case 'temp_c':
      return {
        num: val.toFixed(1),
        unit: '°C',
        suffix: '',
      };
    default:
      return {
        num: val.toFixed(1),
        unit: '',
        suffix: '',
      };
  }
}

/**
 * Format value based on domain (energy, water, or temperature)
 * @param {number} value - The value to format
 * @param {string} domain - The domain type ('energy', 'water', or 'temperature')
 * @returns {string} Formatted value with appropriate unit
 */
function formatValueByDomain(value, domain) {
  if (domain === 'water') {
    return formatWaterVolumeM3(value);
  }
  // RFC-0092: Add temperature domain support (using library's formatTemperature with 0 decimals)
  if (domain === 'temperature') {
    return formatTemperature(value, 0);
  }
  // Default to energy formatting
  return formatEnergy(value);
}

/**
 * Format operation hours
 */
function formatOperationHours(hours) {
  if (hours === null || hours === undefined || isNaN(hours)) {
    return '—';
  }
  return `${hours.toFixed(3)}h`;
}

function formatUpdateDate(timeVal) {
  let telemetryTimeFormatted = 'N/A';
  let timeSinceLastTelemetry = '';
  if (timeVal) {
    try {
      const telemetryDate = new Date(timeVal);
      telemetryTimeFormatted = telemetryDate.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Calculate time difference
      const now = new Date();
      const diffMs = now.getTime() - telemetryDate.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        timeSinceLastTelemetry = `(${diffDays}d atrás)`;
      } else if (diffHours > 0) {
        timeSinceLastTelemetry = `(${diffHours}h atrás)`;
      } else if (diffMinutes > 0) {
        timeSinceLastTelemetry = `(${diffMinutes}min atrás)`;
      } else {
        timeSinceLastTelemetry = '(agora)';
      }
      return timeSinceLastTelemetry;
    } catch (e) {
      telemetryTimeFormatted = 'Formato inválido';
    }
  }
}

/**
 * Format timestamp to "HH:mm DD/MM/YYYY" format
 * Always shows the actual datetime, never shows "agora"
 */
function formatRelativeTime(timestamp) {
  if (!timestamp || isNaN(timestamp)) return '—';

  const date = new Date(timestamp);

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

/**
 * Calcula a porcentagem do consumo em relação a uma meta.
 * @param {number} target - O valor da meta (deve ser maior que zero).
 * @param {number} consumption - O valor consumido.
 * @returns {number} A porcentagem do consumo em relação à meta. Retorna 0 se a meta for inválida.
 */
function calculateConsumptionPercentage(target, consumption) {
  // Garante que os valores sejam numéricos e a meta seja positiva para evitar erros.
  const numericTarget = Number(target);
  const numericConsumption = Number(consumption);

  if (isNaN(numericTarget) || isNaN(numericConsumption) || numericTarget <= 0) {
    return 0;
  }

  const percentage = (numericConsumption / numericTarget) * 100;
  return percentage;
}

/**
 * Get status chip class and label based on deviceStatus
 * Agora aceita o parâmetro 'domain'
 *
 * Chip classes aligned with getCardStateClass:
 *   POWER_ON: chip--power-on (Blue)
 *   STANDBY: chip--standby (Green)
 *   WARNING: chip--warning (Yellow)
 *   MAINTENANCE: chip--maintenance (Yellow)
 *   FAILURE: chip--failure (Dark Red)
 *   POWER_OFF: chip--power-off (Light Red)
 *   OFFLINE: chip--offline (Dark Gray)
 *   NO_INFO: chip--no-info (Dark Orange)
 *   NOT_INSTALLED: chip--not-installed (Purple)
 */
function getStatusInfo(deviceStatus, i18n, domain) {
  switch (deviceStatus) {
    // --- Novos Status de Temperatura ---
    case 'normal':
      return { chipClass: 'chip--ok', label: 'Normal' };
    case 'cold':
      return { chipClass: 'chip--standby', label: 'Frio' };
    case 'hot':
      return { chipClass: 'chip--alert', label: 'Quente' };

    // --- Status Existentes (aligned with getCardStateClass) ---
    case DeviceStatusType.POWER_ON:
      if (domain === 'water') {
        return { chipClass: 'chip--power-on', label: i18n.in_operation_water };
      }
      return { chipClass: 'chip--power-on', label: i18n.in_operation };

    case DeviceStatusType.STANDBY:
      return { chipClass: 'chip--standby', label: i18n.standby };

    case DeviceStatusType.WARNING:
      return { chipClass: 'chip--warning', label: i18n.alert };

    case DeviceStatusType.MAINTENANCE:
      return { chipClass: 'chip--maintenance', label: i18n.maintenance };

    case DeviceStatusType.FAILURE:
      return { chipClass: 'chip--failure', label: i18n.failure };

    case DeviceStatusType.POWER_OFF:
      return { chipClass: 'chip--power-off', label: i18n.power_off || i18n.failure };

    case DeviceStatusType.OFFLINE:
      return { chipClass: 'chip--offline', label: i18n.offline };

    case DeviceStatusType.NO_INFO:
      return { chipClass: 'chip--no-info', label: i18n.no_info || i18n.offline };

    case DeviceStatusType.NOT_INSTALLED:
      return { chipClass: 'chip--not-installed', label: i18n.not_installed };

    default:
      return { chipClass: 'chip--offline', label: i18n.offline };
  }
}

/**
 * Get card state class for status border based on deviceStatus
 * Colors:
 *   POWER_ON: Blue
 *   STANDBY: Green
 *   WARNING: Yellow
 *   MAINTENANCE: Yellow
 *   FAILURE: Dark Red
 *   POWER_OFF: Light Red
 *   OFFLINE: Dark Gray
 *   NO_INFO: Dark Orange
 *   NOT_INSTALLED: Purple
 */
function getCardStateClass(deviceStatus) {
  switch (deviceStatus) {
    case DeviceStatusType.POWER_ON:
      return 'is-power-on'; // Blue border

    case DeviceStatusType.STANDBY:
      return 'is-standby'; // Green border

    case DeviceStatusType.WARNING:
      return 'is-warning'; // Yellow border

    case DeviceStatusType.MAINTENANCE:
      return 'is-maintenance'; // Yellow border

    case DeviceStatusType.FAILURE:
      return 'is-failure'; // Dark Red border

    case DeviceStatusType.POWER_OFF:
      return 'is-power-off'; // Light Red border

    case DeviceStatusType.OFFLINE:
      return 'is-offline'; // Dark Gray border

    case DeviceStatusType.NO_INFO:
      return 'is-no-info'; // Dark Orange border

    case DeviceStatusType.NOT_INSTALLED:
      return 'is-not-installed'; // Purple border

    default:
      return '';
  }
}

/**
 * Calculate temperature status based on range
 * Returns CSS class for temperature range background
 *
 * @param {object} entityObject - Entity with temperature data
 * @returns {string} CSS class: 'is-temp-cold' | 'is-temp-ok' | 'is-temp-hot' | ''
 */
function getTempRangeClass(entityObject) {
  // Only for temperature domain
  if (entityObject.domain !== 'temperature') return '';

  // Get temperature value and range
  const currentTemp = Number(entityObject.val ?? entityObject.currentTemperature ?? entityObject.temperature) || 0;
  const tempMin = entityObject.temperatureMin ?? entityObject.minTemperature;
  const tempMax = entityObject.temperatureMax ?? entityObject.maxTemperature;

  // If no range configured, don't apply temperature class
  if (tempMin === undefined || tempMax === undefined || tempMin === null || tempMax === null) {
    return '';
  }

  // Calculate status based on range
  if (currentTemp > tempMax) return 'is-temp-hot';   // Above ideal range - light red
  if (currentTemp < tempMin) return 'is-temp-cold';  // Below ideal range - blue
  return 'is-temp-ok';                                // Within ideal range - green
}

/**
 * Temperature Range Tooltip - Shows ruler with current position and deviation
 */
const TempRangeTooltip = {
  containerId: 'myio-temp-range-tooltip',

  /**
   * Create or get the tooltip container
   */
  getContainer() {
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
  calculateStatus(currentTemp, tempMin, tempMax) {
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
  calculateMarkerPosition(currentTemp, tempMin, tempMax) {
    if (tempMin == null || tempMax == null) return 50;

    // Extend visible range by 20% on each side for out-of-range temps
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
   * @param {HTMLElement} triggerElement - The card element
   * @param {Object} entityObject - Entity data
   * @param {MouseEvent} event - Mouse event for cursor position
   */
  show(triggerElement, entityObject, event) {
    const container = this.getContainer();

    const currentTemp = Number(entityObject.val ?? entityObject.currentTemperature ?? entityObject.temperature) || 0;
    const tempMin = entityObject.temperatureMin ?? entityObject.minTemperature;
    const tempMax = entityObject.temperatureMax ?? entityObject.maxTemperature;
    const hasRange = tempMin != null && tempMax != null;

    const { status, deviation, deviationPercent } = this.calculateStatus(currentTemp, tempMin, tempMax);
    const markerPos = this.calculateMarkerPosition(currentTemp, tempMin, tempMax);

    // Calculate green range position on ruler
    let rangeLeft = 0, rangeWidth = 100;
    if (hasRange) {
      const rangeSize = tempMax - tempMin;
      const extension = rangeSize * 0.3;
      const visibleMin = tempMin - extension;
      const visibleMax = tempMax + extension;
      const visibleRange = visibleMax - visibleMin;
      rangeLeft = ((tempMin - visibleMin) / visibleRange) * 100;
      rangeWidth = (rangeSize / visibleRange) * 100;
    }

    // Format deviation text
    let deviationText = '';
    let deviationClass = status;
    if (status === 'cold') {
      deviationText = `${Math.abs(deviation).toFixed(1)}°C abaixo`;
    } else if (status === 'hot') {
      deviationText = `+${deviation.toFixed(1)}°C acima`;
    } else if (status === 'ok') {
      deviationText = 'Na faixa ideal';
    } else {
      deviationText = 'Faixa não configurada';
    }

    // Status labels
    const statusLabels = {
      cold: '❄️ Abaixo da Faixa Ideal',
      ok: '✔️ Dentro da Faixa Ideal',
      hot: '🔥 Acima da Faixa Ideal',
      unknown: '❓ Faixa Não Configurada'
    };

    container.innerHTML = `
      <div class="temp-range-tooltip__content">
        <div class="temp-range-tooltip__header">
          <span class="temp-range-tooltip__icon">🌡️</span>
          <span class="temp-range-tooltip__title">${entityObject.labelOrName || entityObject.name || 'Sensor'}</span>
        </div>
        <div class="temp-range-tooltip__body">
          <div class="temp-range-tooltip__value-row">
            <div class="temp-range-tooltip__current">
              ${currentTemp.toFixed(1)}<sup>°C</sup>
            </div>
            <div class="temp-range-tooltip__deviation">
              <div class="temp-range-tooltip__deviation-value ${deviationClass}">
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
              <div class="temp-range-tooltip__range-value" style="color: ${status === 'ok' ? '#16a34a' : (status === 'cold' ? '#2563eb' : '#dc2626')}">${currentTemp.toFixed(1)}°C</div>
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
    let left, top;
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
  hide() {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible');
    }
  }
};

/**
 * Energy Range Tooltip - Shows power ruler with ranges and current status
 */
const EnergyRangeTooltip = {
  containerId: 'myio-energy-range-tooltip',

  /**
   * Create or get the tooltip container
   */
  getContainer() {
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
  calculateStatus(powerValue, ranges) {
    if (!ranges || powerValue == null) {
      return { status: 'offline', label: 'Sem dados' };
    }

    const power = Number(powerValue) || 0;
    const { standbyRange, normalRange, alertRange, failureRange } = ranges;

    if (standbyRange && power >= standbyRange.down && power <= standbyRange.up) {
      return { status: 'standby', label: 'Standby' };
    }
    if (normalRange && power >= normalRange.down && power <= normalRange.up) {
      return { status: 'normal', label: 'Normal' };
    }
    if (alertRange && power >= alertRange.down && power <= alertRange.up) {
      return { status: 'alert', label: 'Alerta' };
    }
    if (failureRange && power >= failureRange.down && power <= failureRange.up) {
      return { status: 'failure', label: 'Falha' };
    }

    return { status: 'offline', label: 'Fora da faixa' };
  },

  /**
   * Calculate marker position on ruler (0-100%)
   */
  calculateMarkerPosition(powerValue, ranges) {
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
  calculateSegmentWidths(ranges) {
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
  formatPower(value) {
    if (value == null || isNaN(value)) return '-';
    const num = Number(value);
    if (num >= 1000) {
      return `${(num / 1000).toFixed(2)} kW`;
    }
    return `${Math.round(num)} W`;
  },

  /**
   * Show tooltip for an energy card
   */
  show(triggerElement, entityObject, event) {
    const container = this.getContainer();

    const powerValue = entityObject.instantaneousPower ?? entityObject.consumption_power ?? 0;
    const ranges = entityObject.powerRanges || entityObject.ranges;
    const hasRanges = ranges && ranges.normalRange;

    const { status, label } = this.calculateStatus(powerValue, ranges);
    const markerPos = this.calculateMarkerPosition(powerValue, ranges);
    const segmentWidths = this.calculateSegmentWidths(ranges);

    // Status labels mapping
    const statusLabels = {
      standby: '🔵 Standby',
      normal: '✅ Operação Normal',
      alert: '⚠️ Alerta',
      failure: '🔴 Falha',
      offline: '⚫ Offline / Sem dados'
    };

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

          ${hasRanges ? `
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
            Ranges de potência não configurados
          </div>
          `}

          <div class="energy-range-tooltip__status-info ${status}">
            ${statusLabels[status] || statusLabels.offline}
          </div>
        </div>
      </div>
    `;

    // Position tooltip at cursor position
    let left, top;
    if (event && event.clientX && event.clientY) {
      left = event.clientX + 15;
      top = event.clientY + 15;
    } else {
      const rect = triggerElement.getBoundingClientRect();
      left = rect.left + rect.width / 2 - 150;
      top = rect.bottom + 8;
    }

    // Adjust if goes off screen
    const tooltipWidth = 320;
    const tooltipHeight = 380;
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
  hide() {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible');
    }
  }
};

/**
 * Get status dot class for power metric indicator
 *
 * Dot classes aligned with getCardStateClass:
 *   POWER_ON: dot--power-on (Blue)
 *   STANDBY: dot--standby (Green)
 *   WARNING: dot--warning (Yellow)
 *   MAINTENANCE: dot--maintenance (Yellow)
 *   FAILURE: dot--failure (Dark Red)
 *   POWER_OFF: dot--power-off (Light Red)
 *   OFFLINE: dot--offline (Dark Gray)
 *   NO_INFO: dot--no-info (Dark Orange)
 *   NOT_INSTALLED: dot--not-installed (Purple)
 */
function getStatusDotClass(deviceStatus) {
  switch (deviceStatus) {
    // --- Novos Status de Temperatura ---
    case 'normal':
      return 'dot--ok';
    case 'cold':
      return 'dot--standby';
    case 'hot':
      return 'dot--alert';

    // --- Status Existentes (aligned with getCardStateClass) ---
    case DeviceStatusType.POWER_ON:
      return 'dot--power-on';

    case DeviceStatusType.STANDBY:
      return 'dot--standby';

    case DeviceStatusType.WARNING:
      return 'dot--warning';

    case DeviceStatusType.MAINTENANCE:
      return 'dot--maintenance';

    case DeviceStatusType.FAILURE:
      return 'dot--failure';

    case DeviceStatusType.POWER_OFF:
      return 'dot--power-off';

    case DeviceStatusType.OFFLINE:
      return 'dot--offline';

    case DeviceStatusType.NO_INFO:
      return 'dot--no-info';

    case DeviceStatusType.NOT_INSTALLED:
      return 'dot--not-installed';

    default:
      return 'dot--offline';
  }
}

/**
 * Build DOM structure
 */
function buildDOM(state) {
  const { entityObject, i18n, enableSelection, enableDragDrop } = state;

  // Root container
  const root = document.createElement('div');
  root.className = 'myio-ho-card';
  root.setAttribute('role', 'group');
  root.setAttribute('data-entity-id', entityObject.entityId);

  if (enableDragDrop) {
    root.setAttribute('draggable', 'true');
  }

  // Header
  const header = document.createElement('div');
  header.className = 'myio-ho-card__header';

  // Icon
  const iconContainer = document.createElement('div');
  iconContainer.className = 'myio-ho-card__icon';
  iconContainer.innerHTML = getIconSvg(entityObject.deviceType, entityObject.domain);
  header.appendChild(iconContainer);

  // Title section
  const titleSection = document.createElement('div');
  titleSection.className = 'myio-ho-card__title';

  const nameEl = document.createElement('div');
  nameEl.className = 'myio-ho-card__name';
  const fullName = entityObject.labelOrName || 'Unknown Device';
  // Truncate name if exceeds limit and add tooltip with full name
  if (fullName.length > LABEL_CHAR_LIMIT) {
    nameEl.textContent = fullName.slice(0, LABEL_CHAR_LIMIT) + '…';
    nameEl.title = fullName;
  } else {
    nameEl.textContent = fullName;
  }
  titleSection.appendChild(nameEl);

  if (entityObject.deviceIdentifier) {
    const codeEl = document.createElement('div');
    codeEl.className = 'myio-ho-card__code';
    codeEl.textContent = entityObject.deviceIdentifier;
    titleSection.appendChild(codeEl);
  }

  header.appendChild(titleSection);

  // Actions section
  const actionsSection = document.createElement('div');
  actionsSection.className = 'myio-ho-card__actions';

  // Kebab menu
  const kebabBtn = document.createElement('button');
  kebabBtn.className = 'myio-ho-card__kebab';
  kebabBtn.setAttribute('aria-label', 'Open actions');
  kebabBtn.setAttribute('aria-haspopup', 'menu');
  kebabBtn.innerHTML = Icons.kebab;
  actionsSection.appendChild(kebabBtn);

  // Menu
  const menu = document.createElement('div');
  menu.className = 'myio-ho-card__menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('hidden', '');

  const dashboardBtn = document.createElement('button');
  dashboardBtn.setAttribute('role', 'menuitem');
  dashboardBtn.setAttribute('data-action', 'dashboard');
  dashboardBtn.innerHTML = `<img src="https://dashboard.myio-bas.com/api/images/public/TAVXE0sTbCZylwGsMF9lIWdllBB3iFtS" width="16" height="16"/> <span>Dashboard</span>`;
  menu.appendChild(dashboardBtn);

  const reportBtn = document.createElement('button');
  reportBtn.setAttribute('role', 'menuitem');
  reportBtn.setAttribute('data-action', 'report');
  reportBtn.innerHTML = `<img src="https://dashboard.myio-bas.com/api/images/public/d9XuQwMYQCG2otvtNSlqUHGavGaSSpz4" width="16" height="16"/> <span>${i18n.menu_report}</span>`;
  menu.appendChild(reportBtn);

  const settingsBtn = document.createElement('button');
  settingsBtn.setAttribute('role', 'menuitem');
  settingsBtn.setAttribute('data-action', 'settings');
  settingsBtn.innerHTML = `<img src="https://dashboard.myio-bas.com/api/images/public/5n9tze6vED2uwIs5VvJxGzNNZ9eV4yoz" width="16" height="16"/> <span>${i18n.menu_settings}</span>`;
  menu.appendChild(settingsBtn);

  // const infoDataBtn = document.createElement('button');
  // infoDataBtn.setAttribute('role', 'menuitem');
  // infoDataBtn.setAttribute('data-action', 'info');
  // infoDataBtn.innerHTML = `<img src="data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3ccircle cx='12' cy='12' r='10'%3e%3c/circle%3e%3cline x1='12' y1='16' x2='12' y2='12'%3e%3c/line%3e%3cline x1='12' y1='8' x2='12.01' y2='8'%3e%3c/line%3e%3c/svg%3e"/> <span>Mais informações</span>`;
  // menu.appendChild(infoDataBtn);

  actionsSection.appendChild(menu);

  // Selection checkbox
  if (enableSelection) {
    const selectLabel = document.createElement('label');
    selectLabel.className = 'myio-ho-card__select';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    selectLabel.appendChild(checkbox);

    actionsSection.appendChild(selectLabel);
  }

  header.appendChild(actionsSection);
  root.appendChild(header);

  const chipsRow = document.createElement('div');
  chipsRow.className = 'myio-ho-card__chips-row'; // Novo container para ambos os chips

  // Status chip (PRIMEIRO, para ficar à esquerda)
  const statusChipContainer = document.createElement('div');
  statusChipContainer.className = 'myio-ho-card__status-chip-container';

  const chip = document.createElement('span'); // Este é o SPAN do chip de status
  chip.className = 'chip'; // A classe existente 'chip'
  statusChipContainer.appendChild(chip);
  chipsRow.appendChild(statusChipContainer); // Adiciona ao novo container

  const chipShopping = document.createElement('span');
  chipShopping.className = 'myio-ho-card__shopping-chip';
  const chipIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chip-icon"><path d="M4 22h16"/><path d="M7 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/><path d="M9 18h6"/><path d="M9 14h6"/><path d="M9 10h6"/><path d="M9 6h6"/></svg>`;
  chipShopping.innerHTML = `${chipIcon}<span>${entityObject.customerName}</span>`;
  chipsRow.appendChild(chipShopping); // Adiciona ao novo container

  root.appendChild(chipsRow); // Adiciona o novo container ao root

  // Primary metric
  const primarySection = document.createElement('div');
  primarySection.className = 'myio-ho-card__primary';
  primarySection.setAttribute('role', 'button');
  primarySection.setAttribute('tabindex', '0');

  const valueContainer = document.createElement('div');
  valueContainer.className = 'myio-ho-card__value';

  const numSpan = document.createElement('span');
  numSpan.className = 'num';
  valueContainer.appendChild(numSpan);

  const unitSpan = document.createElement('span');
  unitSpan.className = 'unit';
  valueContainer.appendChild(unitSpan);

  primarySection.appendChild(valueContainer);
  root.appendChild(primarySection);

  // Efficiency bar
  const effSection = document.createElement('div');
  effSection.className = 'myio-ho-card__eff';

  const effLabel = document.createElement('div');
  effLabel.className = 'label';
  effLabel.textContent = i18n.efficiency;
  effSection.appendChild(effLabel);

  const barContainer = document.createElement('div');
  barContainer.className = 'bar';
  barContainer.setAttribute('role', 'progressbar');
  barContainer.setAttribute('aria-valuemin', '0');
  barContainer.setAttribute('aria-valuemax', '100');

  const barFill = document.createElement('div');
  barFill.className = 'bar__fill';
  barContainer.appendChild(barFill);

  effSection.appendChild(barContainer);

  const percSpan = document.createElement('div');
  percSpan.className = 'perc';
  effSection.appendChild(percSpan);

  root.appendChild(effSection);

  // Footer metrics
  const footer = document.createElement('div');
  footer.className = 'myio-ho-card__footer';

  // Temperature metric
  // const tempMetric = document.createElement('div');
  // tempMetric.className = 'metric';

  // const tempIcon = document.createElement('i');
  // tempIcon.className = 'ico ico-temp';
  // tempIcon.innerHTML = Icons.thermometer;
  // tempMetric.appendChild(tempIcon);

  // const tempLabel = document.createElement('div');
  // tempLabel.className = 'label';
  // tempLabel.textContent = i18n.temperature;
  // tempMetric.appendChild(tempLabel);

  // const tempVal = document.createElement('div');
  // tempVal.className = 'val';
  // tempMetric.appendChild(tempVal);

  // footer.appendChild(tempMetric);

  // Operation time metric
  const opTimeMetric = document.createElement('div');
  opTimeMetric.className = 'metric';

  // Status indicator dot for operation time (neutral gray)
  const opTimeDot = document.createElement('span');
  opTimeDot.className = 'status-dot dot--neutral';
  opTimeMetric.appendChild(opTimeDot);

  const opTimeLabel = document.createElement('div');
  opTimeLabel.className = 'label';
  opTimeLabel.textContent = i18n.operation_time;
  opTimeMetric.appendChild(opTimeLabel);

  const opTimeVal = document.createElement('div');
  opTimeVal.className = 'val';
  opTimeMetric.appendChild(opTimeVal);

  footer.appendChild(opTimeMetric);

  // Instantaneous Power metric with status indicator
  const powerMetric = document.createElement('div');
  powerMetric.className = 'metric';

  // Status indicator dot (colored based on device status)
  const statusDot = document.createElement('span');
  statusDot.className = 'status-dot';
  powerMetric.appendChild(statusDot);

  const powerLabel = document.createElement('div');
  powerLabel.className = 'label';
  if (entityObject.domain === 'water') {
    powerLabel.textContent = 'Leitura';
  } else if (entityObject.domain === 'temperature') {
    powerLabel.textContent = 'Últ. Telemetria';
  } else {
    powerLabel.textContent = i18n.instantaneous_power || 'Potência';
  }
  powerMetric.appendChild(powerLabel);

  const powerVal = document.createElement('div');
  powerVal.className = 'val';
  powerMetric.appendChild(powerVal);

  footer.appendChild(powerMetric);

  // // Last Telemetry metric
  // const telemetryMetric = document.createElement('div');
  // telemetryMetric.className = 'metric';

  // const telemetryIcon = document.createElement('i');
  // telemetryIcon.className = 'ico ico-sync';
  // telemetryIcon.innerHTML = Icons.dot; // Using dot as sync placeholder
  // telemetryMetric.appendChild(telemetryIcon);

  // const telemetryLabel = document.createElement('div');
  // telemetryLabel.className = 'label';
  // telemetryLabel.textContent = i18n.last_telemetry || 'Últ. Telemetria';
  // telemetryMetric.appendChild(telemetryLabel);

  // const telemetryVal = document.createElement('div');
  // telemetryVal.className = 'val';
  // telemetryMetric.appendChild(telemetryVal);

  // footer.appendChild(telemetryMetric);

  root.appendChild(footer);

  return root;
}

// ============================================
// DEBUG TOOLTIP FUNCTIONS
// ============================================

/**
 * Build debug tooltip information object
 */
function buildDebugTooltipInfo(entityObject, statusInfo, stateClass, statusDecisionSource, delayTimeConnectionInMins) {
  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    const d = new Date(ts);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return {
    // Entity identification
    entityId: entityObject.entityId || 'N/A',
    name: entityObject.name || entityObject.nameEl || 'N/A',
    domain: entityObject.domain || 'energy',

    // Status decision chain
    originalDeviceStatus: entityObject._originalDeviceStatus || entityObject.deviceStatus,
    finalDeviceStatus: entityObject.deviceStatus,
    connectionStatus: entityObject.connectionStatus || 'N/A',
    statusDecisionSource,

    // Visual output
    stateClass,
    chipClass: statusInfo.chipClass,
    chipLabel: statusInfo.label,

    // Connection timestamps
    lastConnectTime: formatTimestamp(entityObject.lastConnectTime),
    lastDisconnectTime: formatTimestamp(entityObject.lastDisconnectTime),
    delayTimeConnectionInMins,

    // Raw values
    val: entityObject.val,
    consumptionTargetValue: entityObject.consumptionTargetValue,
    deviceType: entityObject.deviceType || 'N/A',
  };
}

/**
 * Attach premium debug tooltip to an element
 */
function attachDebugTooltip(element, debugInfo) {
  // Remove existing tooltip if any
  const existingTooltip = element.querySelector('.debug-tooltip-container');
  if (existingTooltip) {
    existingTooltip.remove();
  }

  // Create tooltip container
  const tooltipContainer = document.createElement('div');
  tooltipContainer.className = 'debug-tooltip-container';

  // Create tooltip content
  const tooltip = document.createElement('div');
  tooltip.className = 'debug-tooltip';
  tooltip.innerHTML = `
    <div class="debug-tooltip__header">
      <span class="debug-tooltip__icon">🔍</span>
      <span class="debug-tooltip__title">Debug Info</span>
    </div>
    <div class="debug-tooltip__content">
      <div class="debug-tooltip__section">
        <div class="debug-tooltip__section-title">📋 Identificação</div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">Entity ID:</span>
          <span class="debug-tooltip__value debug-tooltip__value--mono">${debugInfo.entityId}</span>
        </div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">Nome:</span>
          <span class="debug-tooltip__value">${debugInfo.name}</span>
        </div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">Domínio:</span>
          <span class="debug-tooltip__value debug-tooltip__badge debug-tooltip__badge--${debugInfo.domain}">${debugInfo.domain}</span>
        </div>
      </div>

      <div class="debug-tooltip__section">
        <div class="debug-tooltip__section-title">⚡ Decisão de Status</div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">connectionStatus:</span>
          <span class="debug-tooltip__value debug-tooltip__value--mono">${debugInfo.connectionStatus}</span>
        </div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">deviceStatus (final):</span>
          <span class="debug-tooltip__value debug-tooltip__badge">${debugInfo.finalDeviceStatus}</span>
        </div>
        <div class="debug-tooltip__row debug-tooltip__row--full">
          <span class="debug-tooltip__label">Fonte da decisão:</span>
          <span class="debug-tooltip__value debug-tooltip__value--highlight">${debugInfo.statusDecisionSource}</span>
        </div>
      </div>

      <div class="debug-tooltip__section">
        <div class="debug-tooltip__section-title">🎨 Output Visual</div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">stateClass:</span>
          <span class="debug-tooltip__value debug-tooltip__value--mono">${debugInfo.stateClass}</span>
        </div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">chipClass:</span>
          <span class="debug-tooltip__value debug-tooltip__value--mono">${debugInfo.chipClass}</span>
        </div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">chipLabel:</span>
          <span class="debug-tooltip__value">${debugInfo.chipLabel}</span>
        </div>
      </div>

      <div class="debug-tooltip__section">
        <div class="debug-tooltip__section-title">🕐 Timestamps de Conexão</div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">lastConnectTime:</span>
          <span class="debug-tooltip__value debug-tooltip__value--mono">${debugInfo.lastConnectTime}</span>
        </div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">lastDisconnectTime:</span>
          <span class="debug-tooltip__value debug-tooltip__value--mono">${debugInfo.lastDisconnectTime}</span>
        </div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">delayTime:</span>
          <span class="debug-tooltip__value">${debugInfo.delayTimeConnectionInMins} mins</span>
        </div>
      </div>

      <div class="debug-tooltip__section">
        <div class="debug-tooltip__section-title">📊 Valores</div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">val (consumo):</span>
          <span class="debug-tooltip__value">${debugInfo.val ?? 'N/A'}</span>
        </div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">target (meta):</span>
          <span class="debug-tooltip__value">${debugInfo.consumptionTargetValue ?? 'N/A'}</span>
        </div>
        <div class="debug-tooltip__row">
          <span class="debug-tooltip__label">deviceType:</span>
          <span class="debug-tooltip__value debug-tooltip__value--mono">${debugInfo.deviceType}</span>
        </div>
      </div>
    </div>
  `;

  tooltipContainer.appendChild(tooltip);

  // Make chip position relative for tooltip positioning
  element.style.position = 'relative';
  element.style.cursor = 'help';
  element.appendChild(tooltipContainer);

  // Add hover indicator
  element.classList.add('has-debug-tooltip');
}

/**
 * Verify if device is online based on connection timestamps
 * @param {Object} entityObject - Entity with lastConnectTime and lastDisconnectTime
 * @param {number} delayTimeInMins - Delay time in minutes for connection probation period (default 15)
 * @param {Object} LogHelper - LogHelper instance for logging
 * @returns {boolean} true if online, false if offline
 */
function verifyOfflineStatus(entityObject, delayTimeInMins = 15, LogHelper) {
  const lastConnectionTime = new Date(entityObject.lastConnectTime || 0);
  const lastDisconnectTime = new Date(entityObject.lastDisconnectTime || 0);
  const now = new Date();
  // RFC-0091: Use configurable delay time (in minutes) instead of hardcoded 15 minutes
  const delayTimeInMs = delayTimeInMins * 60 * 1000;
  const timeSinceConnection = now.getTime() - lastConnectionTime.getTime();

  let isOffline = false;

  // Rule 1: If last disconnect is more recent than last connect, device is offline
  if (lastDisconnectTime.getTime() > lastConnectionTime.getTime()) {
    isOffline = true;
    LogHelper.log(
      '[CardHeadOffice][ConnectionStatus Verify] Device is OFFLINE because lastDisconnectTime is more recent than lastConnectTime',
      entityObject.nameEl
    );
  } else if (timeSinceConnection > delayTimeInMs) {
    // Rule 2: If connection is recent (< configured delay), consider offline (probation period)
    isOffline = true;
    LogHelper.log(
      '[CardHeadOffice][ConnectionStatus Verify] Device is OFFLINE because lastConnectTime is older than configured delayTimeConnectionInMins:',
      delayTimeInMins,
      'for device',
      entityObject.nameEl
    );
  } else {
    isOffline = false;
    LogHelper.log(
      '[CardHeadOffice][ConnectionStatus Verify] Device is ONLINE because lastConnectTime is within configured delayTimeConnectionInMins:',
      delayTimeInMins,
      'for device',
      entityObject.nameEl
    );
  }

  // Otherwise: Connected for more than configured delay, device is online
  return isOffline;
}

/**
 * Paint/update DOM with current state
 */
function paint(root, state) {
  const { entityObject, i18n, delayTimeConnectionInMins, isSelected, LogHelper, activeTooltipDebug } = state;

  // Track decision source for debug tooltip
  let statusDecisionSource = 'unknown';

  // RFC-0093: Use connectionStatus if available (from ThingsBoard real-time data)
  // Only fallback to timestamp verification if connectionStatus is not provided
  if (entityObject.connectionStatus) {
    // connectionStatus is already mapped ('online', 'waiting', 'offline')
    if (entityObject.connectionStatus === 'offline') {
      LogHelper.log(
        '[CardHeadOffice][ConnectionStatus Verify 01] Setting deviceStatus to OFFLINE based on connectionStatus'
      );
      entityObject.deviceStatus = DeviceStatusType.OFFLINE;
      statusDecisionSource = 'connectionStatus === "offline"';
    } else {
      LogHelper.log(
        '[CardHeadOffice] Device is ONLINE or WAITING based on connectionStatus for device',
        entityObject.nameEl
      );
      statusDecisionSource = `connectionStatus === "${entityObject.connectionStatus}" (kept original deviceStatus)`;
    }
    // If online/waiting, keep the existing deviceStatus (which reflects power status)
  } else {
    // RFC-0091: Fallback to timestamp-based verification when connectionStatus not available
    if (verifyOfflineStatus(entityObject, delayTimeConnectionInMins, LogHelper) === false) {
      LogHelper.log(
        '[CardHeadOffice][ConnectionStatus Verify 02] Setting deviceStatus to OFFLINE based on timestamp verification by verifyOfflineStatus METHOD with delayTimeConnectionInMins:',
        delayTimeConnectionInMins
      );
      entityObject.deviceStatus = DeviceStatusType.OFFLINE;
      statusDecisionSource = `verifyOfflineStatus() returned false (delay: ${delayTimeConnectionInMins} mins)`;
    } else {
      LogHelper.log(
        `[CardHeadOffice][ConnectionStatus Verify 03] Device is ONLINE with deviceStatus = ${entityObject.deviceStatus} based on timestamp verification for device ${entityObject.nameEl}`
      );
      statusDecisionSource = `verifyOfflineStatus() returned true (delay: ${delayTimeConnectionInMins} mins)`;
    }
  }

  // Update card state class using deviceStatus
  const stateClass = getCardStateClass(entityObject.deviceStatus);
  const tempRangeClass = getTempRangeClass(entityObject);
  root.className = `myio-ho-card ${stateClass} ${tempRangeClass}`.trim();

  // Update status chip using deviceStatus
  const statusInfo = getStatusInfo(entityObject.deviceStatus, i18n, entityObject.domain);
  const chip = root.querySelector('.chip');
  chip.className = `chip ${statusInfo.chipClass}`;
  chip.innerHTML = statusInfo.label;

  // Update icon based on domain (ensures correct icon after updates)
  const iconContainer = root.querySelector('.myio-ho-card__icon');
  if (iconContainer) {
    iconContainer.innerHTML = getIconSvg(entityObject.deviceType, entityObject.domain);
  }

  // Debug tooltip for chip (when activeTooltipDebug is enabled)
  if (activeTooltipDebug) {
    const debugInfo = buildDebugTooltipInfo(entityObject, statusInfo, stateClass, statusDecisionSource, delayTimeConnectionInMins);
    attachDebugTooltip(chip, debugInfo);
  }

  // Update primary value - use domain-specific formatting (energy or water)
  const primaryValue = formatValueByDomain(entityObject.val, entityObject.domain);
  const numSpan = root.querySelector('.myio-ho-card__value .num');
  const unitSpan = root.querySelector('.myio-ho-card__value .unit');

  numSpan.textContent = primaryValue;
  //unitSpan.textContent = primaryValue.unit;

  // Seleciona o contêiner principal da barra ANTES de qualquer lógica
  const barContainer = root.querySelector('.bar');
  const effContainer = root.querySelector('.myio-ho-card__eff'); // Contêiner do texto "%"

  // --- NOVA LÓGICA DE SELEÇÃO VISUAL ---
  if (state.enableSelection) {
    const checkbox = root.querySelector('.myio-ho-card__select input[type="checkbox"]');
    if (checkbox) {
      // Força o checkbox a refletir o estado real
      checkbox.checked = !!isSelected;
    }
    // Adiciona ou remove a borda de seleção
    root.classList.toggle('is-selected', !!isSelected);
  }

  // 1. Verifica se o valor da meta é válido (não é nulo, indefinido ou zero)
  const targetValue = entityObject.consumptionTargetValue;

  if (targetValue) {
    // --- A META EXISTE: MOSTRA E ATUALIZA A BARRA ---

    // Garante que os elementos estejam visíveis
    barContainer.style.display = ''; // Reverte para o display padrão do CSS
    effContainer.style.display = '';

    // Pega os elementos internos da barra
    const barFill = root.querySelector('.bar__fill');
    const percSpan = root.querySelector('.myio-ho-card__eff .perc');

    // Calcula e atualiza a barra
    const perc = calculateConsumptionPercentage(targetValue, entityObject.val);

    barFill.style.width = `${Math.max(0, Math.min(100, perc))}%`;
    percSpan.textContent = `${Math.round(perc)}%`;
    barContainer.setAttribute('aria-valuenow', Math.round(perc).toString());
    barContainer.setAttribute('aria-label', `${i18n.efficiency} ${Math.round(perc)}%`);
  } else {
    barContainer.style.display = 'none';
    effContainer.style.display = 'none';
  }

  // Update footer metrics - primeiro campo sempre mostra tempo de operação
  // Se deviceStatus for OFFLINE, não mostrar operationHours (mostrar "-")
  const opTimeVal = root.querySelector('.myio-ho-card__footer .metric:nth-child(1) .val');
  const opTimeLabel = root.querySelector('.myio-ho-card__footer .metric:nth-child(1) .label');
  if (opTimeVal) {
    if (opTimeLabel) opTimeLabel.textContent = i18n.operation_time;
    const isOffline = entityObject.deviceStatus === DeviceStatusType.OFFLINE ||
                      entityObject.deviceStatus === 'offline' ||
                      entityObject.deviceStatus === DeviceStatusType.NO_INFO;
    opTimeVal.textContent = isOffline ? '-' : (entityObject.operationHours ?? '-');
  }

  // Instantaneous Power (W/kW) - value comes in Watts
  const powerVal = root.querySelector('.myio-ho-card__footer .metric:nth-child(2) .val');
  if (powerVal) {
    if (entityObject.domain === 'water') {
      const pulses = entityObject.pulses ?? 0;
      powerVal.textContent = `${pulses} L`;
    } else if (entityObject.domain === 'temperature') {
      // Para temperatura, mostrar última telemetria (lastActivityTime é timestamp UTC)
      powerVal.textContent = entityObject.lastActivityTime ? formatRelativeTime(entityObject.lastActivityTime) : '-';
    } else {
      // Lógica existente para Energia (Potência)
      const instantPower = entityObject.instantaneousPower ?? entityObject.consumption_power ?? null;
      const powerFormatted = formatPower(instantPower);
      powerVal.textContent = instantPower !== null ? `${powerFormatted.num} ${powerFormatted.unit}` : '-';
    }
  }

  // Update status dot color based on device status
  const statusDot = root.querySelector('.myio-ho-card__footer .metric:nth-child(2) .status-dot');
  if (statusDot) {
    const dotClass = getStatusDotClass(entityObject.deviceStatus);
    statusDot.className = `status-dot ${dotClass}`;
  }
}

/**
 * Bind event listeners
 */
function bindEvents(root, state, callbacks) {
  const { entityObject } = state;

  // Kebab menu toggle
  const kebabBtn = root.querySelector('.myio-ho-card__kebab');
  const menu = root.querySelector('.myio-ho-card__menu');

  function toggleMenu() {
    const isHidden = menu.hasAttribute('hidden');
    if (isHidden) {
      menu.removeAttribute('hidden');
      kebabBtn.setAttribute('aria-expanded', 'true');
    } else {
      menu.setAttribute('hidden', '');
      kebabBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function closeMenu() {
    menu.setAttribute('hidden', '');
    kebabBtn.setAttribute('aria-expanded', 'false');
  }

  kebabBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Close menu on outside click
  document.addEventListener('click', closeMenu);

  // Close menu on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
  });

  // Menu actions
  const dashboardBtn = menu.querySelector('[data-action="dashboard"]');
  const reportBtn = menu.querySelector('[data-action="report"]');
  const settingsBtn = menu.querySelector('[data-action="settings"]');
  // const infoBtn = menu.querySelector('[data-action="info"]');

  if (callbacks.handleActionDashboard) {
    dashboardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      callbacks.handleActionDashboard(e, entityObject);
    });
  }

  if (callbacks.handleActionReport) {
    reportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      callbacks.handleActionReport(e, entityObject);
    });
  }

  if (callbacks.handleActionSettings) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      callbacks.handleActionSettings(e, entityObject);
    });
  }

  const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;

  if (MyIOSelectionStore) {
    // Definimos a função de callback
    const onSelectionChange = () => {
      const selectedIds = MyIOSelectionStore.getSelectedIds();

      // Verifica se EU (este card) estou na lista
      const isSelected = selectedIds.includes(entityObject.entityId);

      // Se o estado mudou, repinta
      if (state.isSelected !== isSelected) {
        state.isSelected = isSelected;
        paint(root, state); // Reaproveita sua função paint que já ajustamos
      }
    };

    // Registra o ouvinte
    MyIOSelectionStore.on('selection:change', onSelectionChange);

    // [IMPORTANTE] Guardamos a referência da função no root para poder limpar depois
    root._selectionListener = onSelectionChange;
  }

  // Temperature range tooltip (only for domain=temperature)
  if (entityObject.domain === 'temperature') {
    const showTooltip = (e) => {
      TempRangeTooltip.show(root, state.entityObject, e);
    };
    const hideTooltip = () => {
      TempRangeTooltip.hide();
    };

    root.addEventListener('mouseenter', showTooltip);
    root.addEventListener('mouseleave', hideTooltip);

    // Store references for cleanup
    root._tempTooltipShowFn = showTooltip;
    root._tempTooltipHideFn = hideTooltip;
  }

  // Energy range tooltip (only for domain=energy)
  if (entityObject.domain === 'energy') {
    const showEnergyTooltip = (e) => {
      EnergyRangeTooltip.show(root, state.entityObject, e);
    };
    const hideEnergyTooltip = () => {
      EnergyRangeTooltip.hide();
    };

    root.addEventListener('mouseenter', showEnergyTooltip);
    root.addEventListener('mouseleave', hideEnergyTooltip);

    // Store references for cleanup
    root._energyTooltipShowFn = showEnergyTooltip;
    root._energyTooltipHideFn = hideEnergyTooltip;
  }

  // Store cleanup functions
  root._cleanup = () => {
    document.removeEventListener('click', closeMenu);
    document.removeEventListener('keydown', closeMenu);

    // [NOVO] Remove o ouvinte da Store quando o card morrer
    if (MyIOSelectionStore && root._selectionListener) {
      MyIOSelectionStore.off('selection:change', root._selectionListener);
    }

    // Cleanup temperature tooltip events
    if (root._tempTooltipShowFn) {
      root.removeEventListener('mouseenter', root._tempTooltipShowFn);
      root.removeEventListener('mouseleave', root._tempTooltipHideFn);
      TempRangeTooltip.hide();
    }

    // Cleanup energy tooltip events
    if (root._energyTooltipShowFn) {
      root.removeEventListener('mouseenter', root._energyTooltipShowFn);
      root.removeEventListener('mouseleave', root._energyTooltipHideFn);
      EnergyRangeTooltip.hide();
    }
  };

  // infoBtn.addEventListener('click', (e) => {
  //   e.stopPropagation();
  //   closeMenu();

  //   const title = state.entityObject.labelOrName || 'Dispositivo sem nome';
  //   let modalBodyContent = '<div class="info-section">'; // Inicia a primeira seção

  //   // Informações básicas
  //   modalBodyContent += `
  //     <div class="info-row">
  //       <span class="info-icon">${ModalIcons.centralName}</span>
  //       <span class="info-label">Central: </span>
  //       <span class="info-value">${entityObject.centralName || 'N/A'}</span>
  //     </div>
  //     <div class="info-row">
  //       <span class="info-icon">${ModalIcons.identifier}</span>
  //       <span class="info-label">Identificador: </span>
  //       <span class="info-value">${entityObject.deviceIdentifier || 'N/A'}</span>
  //     </div>
  //     <div class="info-row">
  //       <span class="info-icon">${ModalIcons.connection}</span>
  //       <span class="info-label">Última Conexão: </span>
  //       <span class="info-value">${entityObject.operationHours || 'N/A'}</span>
  //     </div>
  //   `;

  //   modalBodyContent += '</div>'; // Fecha a primeira seção

  //   // Tenta obter os dados de meta (que são opcionais)
  //   const consumptionTargetValue = state.entityObject.consumptionTargetValue ? formatPrimaryValue(state.entityObject.consumptionTargetValue, 'power_kw') : null;
  //   const consumptionToleranceValue = state.entityObject.consumptionToleranceValue ? formatPrimaryValue(state.entityObject.consumptionToleranceValue, 'power_kw') : null;
  //   const consumptionExcessValue = state.entityObject.consumptionExcessValue != null ? formatPrimaryValue(state.entityObject.consumptionExcessValue, 'power_kw') : null;

  //   // Se TODOS os dados de meta existirem, adiciona o bloco de HTML correspondente
  //   if (consumptionTargetValue && consumptionToleranceValue && consumptionExcessValue) {
  //       modalBodyContent += '<hr class="info-divider">';
  //       modalBodyContent += '<div class="info-section">'; // Inicia a segunda seção

  //       modalBodyContent += `
  //         <div class="info-row">
  //           <span class="info-icon">${ModalIcons.target}</span>
  //           <span class="info-label">Meta:</span>
  //           <span class="info-value">${consumptionTargetValue.num} ${consumptionTargetValue.unit}</span>
  //         </div>
  //         <div class="info-row">
  //           <span class="info-icon">${ModalIcons.tolerance}</span>
  //           <span class="info-label">Tolerância:</span>
  //           <span class="info-value">${consumptionToleranceValue.num} ${consumptionToleranceValue.unit}</span>
  //         </div>
  //         <div class="info-row">
  //           <span class="info-icon">${ModalIcons.excess}</span>
  //           <span class="info-label">Excedente PG/NPG:</span>
  //           <span class="info-value">${consumptionExcessValue.num} ${consumptionExcessValue.unit}</span>
  //         </div>
  //       `;

  //       modalBodyContent += '</div>'; // Fecha a segunda seção
  //   }

  //   // Chama a função para mostrar o modal
  //   showInfoModal(title, modalBodyContent);
  // });
  // Selection checkbox
  const checkbox = root.querySelector('.myio-ho-card__select input[type="checkbox"]');
  if (checkbox && callbacks.handleSelect) {
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const isSelected = checkbox.checked;

      // Toggle selected visual state
      root.classList.toggle('is-selected', isSelected);

      callbacks.handleSelect(isSelected, entityObject);
    });
  }

  // Card click
  const primarySection = root.querySelector('.myio-ho-card__primary');
  if (callbacks.handleClickCard) {
    function handleCardClick(e) {
      // Don't trigger if clicking on actions or checkbox
      if (e.target.closest('.myio-ho-card__actions')) return;
      callbacks.handleClickCard(e, entityObject);
    }

    root.addEventListener('click', handleCardClick);

    // Keyboard support
    primarySection.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callbacks.handleClickCard(e, entityObject);
      }
    });
  }

  // Drag and drop
  if (state.enableDragDrop) {
    root.addEventListener('dragstart', (e) => {
      root.classList.add('is-dragging');
      e.dataTransfer.setData('text/plain', entityObject.entityId);

      // Custom event
      const customEvent = new CustomEvent('myio:dragstart', {
        detail: { entityObject },
        bubbles: true,
      });
      root.dispatchEvent(customEvent);
    });

    root.addEventListener('dragend', () => {
      root.classList.remove('is-dragging');
    });

    root.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');

      // Custom event
      const customEvent = new CustomEvent('myio:drop', {
        detail: { draggedId, targetEntity: entityObject },
        bubbles: true,
      });
      root.dispatchEvent(customEvent);
    });

    root.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
  }

  // Store cleanup functions
  root._cleanup = () => {
    document.removeEventListener('click', closeMenu);
    document.removeEventListener('keydown', closeMenu);
  };
}

/**
 * Unbind event listeners
 */
function unbindEvents(root) {
  if (root._cleanup) {
    root._cleanup();
    delete root._cleanup;
  }
}

/**
 * Cria a estrutura do modal e a anexa ao body (se ainda não existir).
 * Também configura os eventos para fechar o modal.
 */
function createInfoModal() {
  // Evita criar o modal múltiplas vezes
  if (document.getElementById('myio-info-modal')) {
    return;
  }

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'myio-modal-overlay';
  modalOverlay.id = 'myio-info-modal';

  const modalContent = document.createElement('div');
  modalContent.className = 'myio-modal-content';

  const closeButton = document.createElement('button');
  closeButton.className = 'myio-modal-close';
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Fechar modal');

  // +++ ADICIONADO O TÍTULO +++
  const modalTitle = document.createElement('h3');
  modalTitle.className = 'myio-modal-title';
  modalTitle.id = 'myio-info-modal-title';

  const modalBody = document.createElement('div');
  modalBody.id = 'myio-info-modal-body';

  modalContent.appendChild(closeButton);
  modalContent.appendChild(modalTitle); // +++ ADICIONADO
  modalContent.appendChild(modalBody);
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  // Função para fechar o modal
  const closeModal = () => {
    modalOverlay.classList.remove('visible');
  };

  // Eventos para fechar
  closeButton.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}

/**
 * Exibe o modal com as informações fornecidas.
 * @param {object} data - Objeto com os dados a serem exibidos. Ex: { title: 'Nome do Device', meta: '120kWh', ... }
 */
function showInfoModal(title, bodyHtml) {
  createInfoModal();

  const modalOverlay = document.getElementById('myio-info-modal');
  const modalTitle = document.getElementById('myio-info-modal-title');
  const modalBody = document.getElementById('myio-info-modal-body');

  modalTitle.textContent = title || 'Informações';
  modalBody.innerHTML = bodyHtml; // Define o HTML diretamente

  modalOverlay.classList.add('visible');
}
/**
 * Main render function
 */
export function renderCardComponentHeadOffice(containerEl, params) {
  if (!containerEl) {
    throw new Error('renderCardComponentHeadOffice: containerEl is required');
  }

  ensureCss();
  const state = normalizeParams(params);
  const root = buildDOM(state);

  state.isSelected = params.isSelected || false;

  containerEl.appendChild(root);
  bindEvents(root, state, state.callbacks);
  paint(root, state);

  return {
    update(next) {
      if (next) {
        Object.assign(state.entityObject, next);
        paint(root, state);
      }
    },

    destroy() {
      unbindEvents(root);
      if (root.parentNode) {
        root.parentNode.removeChild(root);
      }
    },

    getRoot() {
      return root;
    },
  };
}
