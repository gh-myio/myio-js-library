/* eslint-disable */
/**
 * MYIO Enhanced Card Component - Version 5
 * Optimized for v5.2.0 with cleaner UI and improved spacing
 *
 * @version 5.0.0
 * @author MYIO Frontend Guild
 *
 * Changes from v2:
 * - Removed info icon from lateral piano-key actions
 * - Reduced image gap from 10px to 4px (top and bottom)
 * - Adjusted minimum card height from 126px to 114px
 * - Info panel deprecated (info moved to settings modal)
 */

// Import the new MYIO components
import { MyIOSelectionStore } from '../../../../components/SelectionStore.js';
import { MyIODraggableCard } from '../../../../components/DraggableCard.js';
import { formatEnergy } from '../../../../format/energy.ts';
import {
  DeviceStatusType,
  ConnectionStatusType,
  deviceStatusIcons,
  connectionStatusIcons,
  mapDeviceToConnectionStatus,
  mapDeviceStatusToCardStatus,
  shouldFlashIcon as shouldIconFlash,
  isDeviceOffline,
  getDeviceStatusIcon,
  getConnectionStatusIcon,
} from '../../../../utils/deviceStatus.js';
import { TempRangeTooltip } from '../../../../utils/TempRangeTooltip';
import { EnergyRangeTooltip } from '../../../../utils/EnergyRangeTooltip';
import { DeviceComparisonTooltip } from '../../../../utils/DeviceComparisonTooltip';
import { TempComparisonTooltip } from '../../../../utils/TempComparisonTooltip';

// ============================================
// CONSTANTS
// ============================================

/** Maximum characters for device label display before truncation */
const LABEL_CHAR_LIMIT = 18;

/**
 * Centralized device type configuration
 * category: 'energy' | 'water' | 'tank' | 'temperature'
 * image: URL or null (for dynamic images like TANK/TERMOSTATO)
 */
const DEVICE_TYPE_CONFIG = {
  // Energy devices
  COMPRESSOR: { category: 'energy', image: null },
  VENTILADOR: { category: 'energy', image: null },
  ESCADA_ROLANTE: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/EJ997iB2HD1AYYUHwIloyQOOszeqb2jp',
  },
  ELEVADOR: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/rAjOvdsYJLGah6w6BABPJSD9znIyrkJX',
  },
  MOTOR: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT',
  },
  BOMBA_HIDRAULICA: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/rbO2wQb6iKBtX0Ec04DFDcO3Qg04EOoD',
  },
  BOMBA_CAG: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/rbO2wQb6iKBtX0Ec04DFDcO3Qg04EOoD',
  },
  BOMBA_INCENDIO: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/YJkELCk9kluQSM6QXaFINX6byQWI7vbB',
  },
  BOMBA: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT',
  },
  '3F_MEDIDOR': {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k',
  },
  RELOGIO: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB',
  },
  ENTRADA: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU',
  },
  SUBESTACAO: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU',
  },
  FANCOIL: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/4BWMuVIFHnsfqatiV86DmTrOB7IF0X8Y',
  },
  CHILLER: {
    category: 'energy',
    image: 'https://dashboard.myio-bas.com/api/images/public/27Rvy9HbNoPz8KKWPa0SBDwu4kQ827VU',
  },
  AR_CONDICIONADO: { category: 'energy', image: null },
  HVAC: { category: 'energy', image: null },

  // Water devices
  HIDROMETRO: {
    category: 'water',
    image: 'https://dashboard.myio-bas.com/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4',
  },
  CAIXA_DAGUA: {
    category: 'water',
    image: 'https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq',
  },

  // Tank devices (dynamic images based on level)
  TANK: { category: 'tank', image: null },

  // Temperature devices (dynamic images based on status)
  TERMOSTATO: { category: 'temperature', image: null },
};

// Pre-computed sets for fast lookup
const ENERGY_DEVICE_TYPES = new Set(
  Object.entries(DEVICE_TYPE_CONFIG)
    .filter(([_, cfg]) => cfg.category === 'energy')
    .map(([type]) => type)
);

const WATER_DEVICE_TYPES = new Set(
  Object.entries(DEVICE_TYPE_CONFIG)
    .filter(([_, cfg]) => cfg.category === 'water')
    .map(([type]) => type)
);

const TEMPERATURE_DEVICE_TYPES = new Set(
  Object.entries(DEVICE_TYPE_CONFIG)
    .filter(([_, cfg]) => cfg.category === 'temperature')
    .map(([type]) => type)
);

const DEFAULT_DEVICE_IMAGE = 'https://cdn-icons-png.flaticon.com/512/1178/1178428.png';

// Helper functions derived from config
const getDeviceCategory = (deviceType) => {
  const normalizedType = String(deviceType || '').toUpperCase();
  return DEVICE_TYPE_CONFIG[normalizedType]?.category || 'energy';
};

const isEnergyDeviceType = (deviceType) => {
  const normalizedType = String(deviceType || '').toUpperCase();
  return ENERGY_DEVICE_TYPES.has(normalizedType);
};

const isWaterDeviceType = (deviceType) => {
  const normalizedType = String(deviceType || '').toUpperCase();
  return WATER_DEVICE_TYPES.has(normalizedType);
};

const isTemperatureDeviceType = (deviceType) => {
  const normalizedType = String(deviceType || '').toUpperCase();
  return TEMPERATURE_DEVICE_TYPES.has(normalizedType);
};

const getStaticDeviceImage = (deviceType) => {
  const normalizedType = String(deviceType || '').toUpperCase();
  return DEVICE_TYPE_CONFIG[normalizedType]?.image || DEFAULT_DEVICE_IMAGE;
};

export function renderCardComponentV5({
  entityObject,
  handleActionDashboard,
  handleActionReport,
  handleActionSettings,
  handleSelect,
  handInfo, // DEPRECATED: Info now handled in settings modal
  handleClickCard,
  useNewComponents = true, // Flag to enable/disable new components
  enableSelection = true, // Flag to enable selection functionality
  enableDragDrop = true, // Flag to enable drag and drop
}) {
  const {
    entityId,
    labelOrName,
    deviceIdentifier,
    entityType,
    deviceType,
    slaveId,
    ingestionId,
    val,
    centralId,
    updatedIdentifiers = {},
    perc = 0,
    deviceStatus,
    centralName,
    connectionStatusTime,
    timeVal,
    customerName,
    waterLevel,
    waterPercentage,
    // Temperature-specific fields (for TERMOSTATO devices)
    temperature,
    temperatureMin,
    temperatureMax,
    temperatureStatus, // 'ok' | 'above' | 'below' | undefined
  } = entityObject;

  /*********************************************************
   * MyIO Global Toast Manager
   * - Cria um único elemento de toast no DOM.
   * - Evita múltiplos toasts de diferentes widgets.
   * - Simples de usar: MyIOToast.show('Sua mensagem');
   *********************************************************/
  const MyIOToast = (function () {
    let toastContainer = null;
    let toastTimeout = null;

    // CSS para um toast simples e agradável
    const TOAST_CSS = `
          #myio-global-toast-container {
              position: fixed;
              top: 25px;
              right: 25px;
              z-index: 99999;
              width: 320px;
              padding: 16px;
              border-radius: 8px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              font-size: 15px;
              color: #fff;
              transform: translateX(120%);
              transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
              box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
              border-left: 5px solid transparent;
              display: flex;
              align-items: center;
          }
          #myio-global-toast-container.show {
              transform: translateX(0);
          }
          #myio-global-toast-container.warning {
              background-color: #ff9800; /* Laranja para alerta */
              border-color: #f57c00;
          }
          #myio-global-toast-container.error {
              background-color: #d32f2f; /* Vermelho para erro */
              border-color: #b71c1c;
          }
          #myio-global-toast-container::before {
              content: '⚠️'; /* Ícone de alerta */
              margin-right: 12px;
              font-size: 20px;
          }
          #myio-global-toast-container.error::before {
              content: '🚫'; /* Ícone de erro */
          }
      `;

    // Função para criar o elemento do toast (só roda uma vez)
    function createToastElement() {
      if (document.getElementById('myio-global-toast-container')) {
        toastContainer = document.getElementById('myio-global-toast-container');
        return;
      }

      // Injeta o CSS no <head>
      const style = document.createElement('style');
      style.id = 'myio-global-toast-styles';
      style.textContent = TOAST_CSS;
      document.head.appendChild(style);

      // Cria o elemento HTML e anexa ao <body>
      toastContainer = document.createElement('div');
      toastContainer.id = 'myio-global-toast-container';
      document.body.appendChild(toastContainer);
    }

    /**
     * Exibe o toast com uma mensagem.
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} [type='warning'] - O tipo do toast ('warning' ou 'error').
     * @param {number} [duration=3500] - Duração em milissegundos.
     */
    function show(message, type = 'warning', duration = 3500) {
      if (!toastContainer) {
        createToastElement();
      }

      clearTimeout(toastTimeout);

      toastContainer.textContent = message;
      toastContainer.className = ''; // Reseta classes
      toastContainer.classList.add(type);

      // Força o navegador a reconhecer a mudança antes de adicionar a classe 'show'
      // para garantir que a animação sempre funcione.
      setTimeout(() => {
        toastContainer.classList.add('show');
      }, 10);

      toastTimeout = setTimeout(() => {
        toastContainer.classList.remove('show');
      }, duration);
    }

    // Garante que o elemento seja criado assim que o script for carregado.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createToastElement);
    } else {
      createToastElement();
    }

    return {
      show: show,
    };
  })();

  // Deprecated warning for handInfo
  if (handInfo) {
    console.warn(
      '[template-card-v5] handInfo parameter is deprecated. Info functionality has been moved to settings modal.'
    );
  }

  // If new components are disabled, fall back to v2 implementation
  if (!useNewComponents) {
    console.warn(
      '[template-card-v5] useNewComponents=false is not recommended. Consider using template-card-v2 directly.'
    );
    // Could import and call v2 here if needed
  }

  // 1. LÓGICA DE STATUS - Usando utilitário centralizado
  const connectionStatus = mapDeviceToConnectionStatus(deviceStatus);
  const isOffline = isDeviceOffline(deviceStatus);
  const shouldFlashIcon = shouldIconFlash(deviceStatus);
  const icon = getDeviceStatusIcon(deviceStatus, deviceType); // Pass deviceType for water device icons
  const connectionIcon = getConnectionStatusIcon(connectionStatus);

  // Map device type to icon category (uses centralized config)
  const mapDeviceTypeToIcon = (deviceType) => {
    const category = getDeviceCategory(deviceType);
    // Map category to icon type
    if (category === 'water' || category === 'tank') return 'water';
    if (category === 'temperature') return 'temperature';
    if (category === 'energy') return 'energy';
    return 'generic';
  };

  // Get value type from device type (uses centralized config)
  const getValueTypeFromDeviceType = (deviceType) => {
    const category = getDeviceCategory(deviceType);
    if (category === 'tank') return 'TANK';
    return category.toUpperCase(); // 'energy' -> 'ENERGY', 'water' -> 'WATER', etc.
  };

  // Check if device is energy-related (uses centralized config)
  const isEnergyDevice = (deviceType) => isEnergyDeviceType(deviceType);

  // Check if device is temperature-related (uses centralized config)
  const isTemperatureDevice = (deviceType) => isTemperatureDeviceType(deviceType);

  // Smart formatting function that uses formatEnergy for energy devices
  const formatCardValue = (value, deviceType) => {
    const numValue = Number(value) || 0;

    if (isEnergyDevice(deviceType)) {
      // Use formatEnergy for intelligent unit conversion (Wh → kWh → MWh → GWh)
      return formatEnergy(numValue);
    } else if (isTemperatureDevice(deviceType)) {
      // Format temperature with 1 decimal place and °C unit
      const formattedTemp = numValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      return `${formattedTemp} °C`;
    } else {
      // Use existing formatting for non-energy devices
      const unit = determineUnit(deviceType);
      const formattedValue = numValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
      return `${formattedValue} ${unit}`;
    }
  };

  // Determine unit based on device type (updated to work with formatEnergy)
  const determineUnit = (deviceType) => {
    const valueType = getValueTypeFromDeviceType(deviceType);
    switch (valueType) {
      case 'ENERGY':
        // Unit will be determined by formatEnergy
        return '';
      case 'WATER':
        return 'm³';
      case 'TANK':
        return 'm.c.a';
      case 'TEMPERATURE':
        return '°C';
      default:
        return '';
    }
  };

  // Create entity object for MyIODraggableCard
  const cardEntity = {
    id: entityId,
    name: labelOrName || 'Dispositivo',
    icon: mapDeviceTypeToIcon(deviceType),
    group: deviceIdentifier || entityType || 'Dispositivo',
    lastValue: Number(val) || 0,
    unit: determineUnit(deviceType),
    status: mapDeviceStatusToCardStatus(deviceStatus),
    ingestionId: ingestionId || entityId, // Store ingestionId for API calls
  };

  // Register entity with SelectionStore if selection is enabled
  if (enableSelection && MyIOSelectionStore) {
    MyIOSelectionStore.registerEntity(cardEntity);
  }

  // Create container for the card
  const container = document.createElement('div');
  container.className = 'myio-enhanced-card-container-v5';

  // Add enhanced styling (v5 optimized)
  if (!document.getElementById('myio-enhanced-card-styles-v5')) {
    const style = document.createElement('style');
    style.id = 'myio-enhanced-card-styles-v5';
    style.textContent = `
      .myio-enhanced-card-container-v5 {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .myio-enhanced-card-container-v5 .myio-draggable-card {
        width: 100%;
        border-radius: 10px;
        padding: 8px 12px;
        background: #fff;
        box-shadow: 0 4px 10px rgba(0, 0, 0, .05);
        cursor: pointer;

        transition: transform .2s;
        box-sizing: border-box;
        overflow: hidden;
        min-height: 140px;
        display: flex;
        flex-direction: row;
        align-items: stretch;
      }

      .myio-enhanced-card-container-v5 .myio-draggable-card:hover {
        transform: scale(1.05);
      }

      .myio-enhanced-card-container-v5 .myio-draggable-card.selected {
        border: 2px solid #00e09e;
        box-shadow: 0 4px 12px rgba(0,224,158,0.2);
        background: linear-gradient(135deg, #f0fdf9, #ecfdf5);
      }

      .myio-enhanced-card-container-v5 .myio-draggable-card.offline {
        border: 2px solid #ff4d4f;
        animation: border-blink 1s infinite;
      }

      @keyframes border-blink {
        0%, 100% { box-shadow: 0 0 8px rgba(255, 77, 79, 0.9); }
        50% { box-shadow: 0 0 16px rgba(255, 0, 0, 0.6); }
      }

      .myio-enhanced-card-container-v5 .card-actions {
        flex-shrink: 0;
        height: 100%;
        box-shadow: 1px 0 2px rgba(0, 0, 0, .1);
        display: flex;
        flex-direction: column;
        padding: 0 4px;
        justify-content: space-evenly;
        align-items: center;
        gap: 8px;
      }

      .myio-enhanced-card-container-v5 .card-action {
        width: 32px;
        flex: 1;
        min-height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s ease;
        cursor: pointer;
        border: none;
        background: rgba(0, 0, 0, 0.05);
      }

      .myio-enhanced-card-container-v5 .card-action:hover {
        background: rgba(0, 224, 158, 0.1);
        transform: scale(1.1);
      }

      .myio-enhanced-card-container-v5 .card-action img {
        width: 20px;
        height: 20px;
      }

      .myio-enhanced-card-container-v5 .card-checkbox {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .myio-enhanced-card-container-v5 .card-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 0 12px;
        text-align: center;
      }

      .myio-enhanced-card-container-v5 .card-title {
        font-weight: 700;
        font-size: 0.85rem;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .myio-enhanced-card-container-v5 .card-group {
        font-size: 0.7rem;
        color: #888;
        margin-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .myio-enhanced-card-container-v5 .card-value {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.9rem;
        font-weight: 700;
        color: #28a745;
      }

      .myio-enhanced-card-container-v5 .card-unit {
        font-size: 0.75rem;
        color: rgba(0, 0, 0, 0.6);
      }

      .myio-enhanced-card-container-v5 .card-percentage {
        font-size: 0.75rem;
        color: rgba(0, 0, 0, 0.45);
        margin-left: 4px;
      }

      .myio-enhanced-card-container-v5 .card-icon {
        width: 24px;
        height: 24px;
        margin-bottom: 8px;
      }

      .myio-enhanced-card-container-v5 .card-icon svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }

      .myio-enhanced-card-container-v5 .card-status-indicator {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        z-index: 10;
      }

      .myio-enhanced-card-container-v5 .card-status-ok {
        background: #28a745;
      }

      .myio-enhanced-card-container-v5 .card-status-alert {
        background: #ffc107;
      }

      .myio-enhanced-card-container-v5 .card-status-fail,
      .myio-enhanced-card-container-v5 .card-status-offline {
        background: #dc3545;
      }

      .myio-enhanced-card-container-v5 .card-status-unknown {
        background: #6c757d;
      }
    `;
    document.head.appendChild(style);
  }

  // Get device image URL with dynamic level support for TANK and TERMOSTATO devices
  const getDeviceImageUrl = (deviceType, percentage = 0, options = {}) => {
    const { tempStatus, isOffline } = options;

    const nameType = String(deviceType || '').toUpperCase();

    // TERMOSTATO devices: Dynamic icon based on temperature status
    if (nameType === 'TERMOSTATO') {
      // If offline, return offline icon (gray/neutral)
      if (isOffline) {
        return 'https://dashboard.myio-bas.com/api/images/public/Q4bE6zWz4pL3u5M3rjmMt2uSis6Xe52F'; // offline/online base
      }
      // Determine status: 'ok' = within range, 'above' = above max, 'below' = below min
      if (tempStatus === 'above') {
        return 'https://dashboard.myio-bas.com/api/images/public/S3IvpZRJvskqFrhoypKBCKKsLaKiqzJI'; // above range (hot)
      } else if (tempStatus === 'below') {
        return 'https://dashboard.myio-bas.com/api/images/public/ctfORoxVGP2bB7VKeprJfIvNgmNjpaO4'; // below range (cold)
      } else {
        // Default: within range or status not specified
        return 'https://dashboard.myio-bas.com/api/images/public/rtCcq6kZZVCD7wgJywxEurRZwR8LA7Q7'; // within range (ok)
      }
    }

    // TANK devices: Dynamic icon based on water level percentage
    if (nameType === 'TANK') {
      if (percentage >= 70) {
        return 'https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq'; // 70-100%
      } else if (percentage >= 40) {
        return 'https://dashboard.myio-bas.com/api/images/public/4UBbShfXCVWR9wcw6IzVMNran4x1EW5n'; // 40-69%
      } else if (percentage >= 20) {
        return 'https://dashboard.myio-bas.com/api/images/public/aB9nX28F54fBBQs1Ht8jKUdYAMcq9QSm'; // 20-39%
      } else {
        return 'https://dashboard.myio-bas.com/api/images/public/qLdwhV4qw295poSCa7HinpnmXoN7dAPO'; // 0-19%
      }
    }

    // Use centralized config for static images
    return getStaticDeviceImage(nameType);
  };

  // Create custom card HTML
  // For TANK devices, waterPercentage is 0-1, so multiply by 100
  // For other devices, perc is already 0-100
  const isTankDevice = deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA';
  const isTermostatoDevice = deviceType?.toUpperCase() === 'TERMOSTATO';
  const isEnergyDeviceFlag = isEnergyDevice(deviceType);
  const percentageForDisplay = isTankDevice ? (waterPercentage || 0) * 100 : perc;

  // Calculate temperature status for TERMOSTATO devices
  const calculateTempStatus = () => {
    // If status is explicitly provided, use it
    if (temperatureStatus) return temperatureStatus;

    // If min/max are provided, calculate based on current value
    const currentTemp = Number(val) || 0;
    if (temperatureMin !== undefined && temperatureMax !== undefined) {
      if (currentTemp > temperatureMax) return 'above';
      if (currentTemp < temperatureMin) return 'below';
      return 'ok';
    }

    // Default to 'ok' if no range info available
    return 'ok';
  };

  const tempStatus = isTermostatoDevice ? calculateTempStatus() : null;
  const deviceImageUrl = getDeviceImageUrl(deviceType, percentageForDisplay, {
    tempStatus,
    isOffline,
  });

  // Calculate temperature deviation percentage from average (for TERMOSTATO devices)
  const calculateTempDeviationPercent = () => {
    const currentTemp = Number(val) || 0;
    if (temperatureMin !== undefined && temperatureMax !== undefined) {
      const avgTemp = (Number(temperatureMin) + Number(temperatureMax)) / 2;
      if (avgTemp === 0) return { value: 0, sign: '' };
      const deviation = ((currentTemp - avgTemp) / avgTemp) * 100;
      return {
        value: Math.abs(deviation),
        sign: deviation >= 0 ? '+' : '-',
        isAbove: deviation > 0,
        isBelow: deviation < 0,
      };
    }
    return null;
  };

  const tempDeviationPercent = isTermostatoDevice ? calculateTempDeviationPercent() : null;

  // Temperature tooltip is now handled by TempRangeTooltip (attached after render)

  // Create card HTML with optimized spacing
  const cardHTML = `
      <div class="device-card-centered clickable ${cardEntity.status === 'offline' ? 'offline' : ''}"
          data-entity-id="${entityId}"
          draggable="${enableDragDrop}"
          tabindex="0"
          role="article"
          aria-label="${cardEntity.name}, ${cardEntity.group}">

        <div class="device-card-inner">
          <div class="device-card-front">
            ${
              enableSelection && typeof handleSelect === 'function'
                ? `<input type="checkbox" class="card-checkbox action-checker" aria-label="Select ${cardEntity.name}" style="position: absolute; top: 8px; right: 8px; z-index: 10;">`
                : ''
            }

            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%; flex-grow: 1; min-width: 0; padding: 0 12px 0 20px; margin-left: 16px;">

              <div class="device-title-row" style="flex-direction: column; min-height: 38px; text-align: center; width: 100%;">
                <span class="device-title" title="${cardEntity.name}">
                  ${
                    cardEntity.name.length > LABEL_CHAR_LIMIT
                      ? cardEntity.name.slice(0, LABEL_CHAR_LIMIT) + '…'
                      : cardEntity.name
                  }
                </span>
                ${
                  deviceIdentifier
                    ? `
                  <span class="device-subtitle" title="${deviceIdentifier}">
                    ${deviceIdentifier}
                  </span>
                `
                    : ''
                }
              </div>

              <div class="device-image-wrapper">
                <img class="device-image ${isTermostatoDevice ? 'temp-tooltip-trigger' : ''}${
    isEnergyDeviceFlag ? ' energy-tooltip-trigger' : ''
  }" src="${deviceImageUrl}" alt="${deviceType}" style="${
    isTermostatoDevice || isEnergyDeviceFlag ? 'cursor: help;' : ''
  }" />
              </div>


              ${
                customerName && String(customerName).trim() !== ''
                  ? `
                <div class="myio-v5-shopping-badge-row">
                  <span class="myio-v5-shopping-badge" title="${customerName}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chip-icon"><path d="M4 22h16"/><path d="M7 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/></svg>
                    <span style="font-size: 0.65rem;">${customerName}</span>
                  </span>
                </div>
              `
                  : ''
              }

              <div class="device-data-row">
                <div class="consumption-main">
                  <span class="flash-icon ${shouldFlashIcon ? 'flash' : ''}">
                    ${icon}
                  </span>
                  <span class="consumption-value">${formatCardValue(cardEntity.lastValue, deviceType)}</span>
                </div>
              </div>
              ${!isTermostatoDevice
                ? `<span class="device-percentage-badge percentage-tooltip-trigger" style="position: absolute; bottom: 12px; right: 12px; z-index: 20; background: none !important; cursor: help;">${percentageForDisplay.toFixed(1)}%</span>`
                : (tempDeviationPercent
                    ? `<span class="device-percentage-badge temp-deviation-badge temp-comparison-tooltip-trigger" style="position: absolute; bottom: 12px; right: 12px; z-index: 20; background: none !important; color: ${tempDeviationPercent.isAbove ? '#ef4444' : tempDeviationPercent.isBelow ? '#3b82f6' : '#6b7280'}; font-weight: 600; cursor: help;">${tempDeviationPercent.sign}${tempDeviationPercent.value.toFixed(1)}%</span>`
                    : '')}
            </div>
          </div>
        </div>

        <div style="display: none;" class="connection-status-icon" data-conn="${connectionStatus}" data-state="${deviceStatus}" aria-label="${connectionStatus}"></div>

      </div>
    `;

  container.innerHTML = cardHTML;
  const enhancedCardElement = container.querySelector('.device-card-centered');

  // Add premium enhanced card styles - V5 OPTIMIZED
  if (!document.getElementById('myio-enhanced-card-layout-styles-v5')) {
    const layoutStyle = document.createElement('style');
    layoutStyle.id = 'myio-enhanced-card-layout-styles-v5';
    layoutStyle.textContent = `
      /* ===== MYIO Card v5 — Optimized Spacing & Clean Piano Keys ===== */

      /* Card shell - UPDATED min-height: 126px → 114px */
      .device-card-centered.clickable {
        width: 90% !important;
        max-width: 280px !important;
        border-radius: 14px !important;
        padding: 18px !important;
        background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%) !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04) !important;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        border: 1px solid rgba(226, 232, 240, 0.8) !important;
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(10px);
        min-height: 114px !important;
        margin: 0 auto;
      }

      .device-card-centered.clickable::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #00e09e 0%, #00b4d8 50%, #7209b7 100%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .device-card-centered.clickable:hover {
        transform: translateY(-4px) scale(1.02) !important;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.08) !important;
        border-color: rgba(0, 224, 158, 0.3) !important;
      }

      .device-card-centered.clickable:hover::before {
        opacity: 1;
      }

      /* Selected / Offline */
      .device-card-centered.selected {
        border: 2px solid #00e09e !important;
        box-shadow: 0 12px 40px rgba(0, 224, 158, 0.25), 0 4px 12px rgba(0, 224, 158, 0.15) !important;
        background: linear-gradient(145deg, #f0fdf9 0%, #ecfdf5 50%, #f0fdf9 100%) !important;
        transform: translateY(-2px) !important;
      }

      .device-card-centered.selected::before {
        opacity: 1;
        background: linear-gradient(90deg, #00e09e 0%, #00d4aa 100%);
      }

      .device-card-centered.offline {
        border: 2px solid #ef4444 !important;
        background: linear-gradient(145deg, #fef2f2 0%, #fee2e2 50%, #fef2f2 100%) !important;
        animation: premium-offline-pulse 2s infinite !important;
      }

      .device-card-centered.offline::before {
        opacity: 1;
        background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
      }

      @keyframes premium-offline-pulse {
        0%, 100% {
          box-shadow: 0 8px 32px rgba(239, 68, 68, 0.15), 0 2px 8px rgba(239, 68, 68, 0.1);
        }
        50% {
          box-shadow: 0 12px 40px rgba(239, 68, 68, 0.25), 0 4px 12px rgba(239, 68, 68, 0.2);
        }
      }

      /* Device data row - flex to align consumption and percentage */
      .device-card-centered .device-data-row {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
      }

      /* Device image - UPDATED margin: 10px → 4px */
      .device-card-centered .device-image {
        max-height: 47px !important;
        width: auto;
        margin: 4px 0 !important;
        display: block;
        filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.1));
        transition: all 0.3s ease;
        border-radius: 7px;
      }

      .device-card-centered:hover .device-image {
        filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.15));
        transform: scale(1.05);
      }

      /* Floating percentage badge - bottom-right of card */
      .device-card-centered .device-percentage-badge {
        background: none !important;
        background-color: transparent !important;
        border: none !important;
        padding: 0 !important;
        font-size: 0.65rem !important;
        font-weight: 600 !important;
        color: #6b7280 !important;
        white-space: nowrap !important;
        box-shadow: none !important;
      }

      .device-card-centered .device-title-row {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        width: 100% !important;
        min-height: 38px !important;
        margin-bottom: 8px !important;
      }

      .device-card-centered .device-title {
        font-weight: 700 !important;
        font-size: 0.80rem !important;
        color: #1e293b !important;
        margin: 0 0 4px 0 !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        letter-spacing: -0.025em;
        display: block !important;
        width: 100% !important;
        text-align: center !important;
      }

      .device-card-centered .device-subtitle {
        font-size: 0.67rem !important;
        color: #64748b !important;
        font-weight: 500 !important;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.8;
        display: block !important;
        width: 100% !important;
        text-align: center !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* Value pill - COMPACT */
      .device-card-centered .consumption-main {
        background: linear-gradient(135deg, rgba(0, 224, 158, 0.1) 0%, rgba(0, 180, 216, 0.1) 100%);
        border-radius: 8px;
        padding: 4px 8px;
        margin-top: 5px;
        border: 1px solid rgba(0, 224, 158, 0.2);
        backdrop-filter: blur(10px);
      }

      .device-card-centered .consumption-value {
        font-weight: 700 !important;
        font-size: 0.75rem !important;
        color: #059669 !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }

      .device-card-centered .device-title-percent {
        font-size: 0.65rem !important;
        color: #6b7280 !important;
        font-weight: 600 !important;
        margin-left: 4px;
      }

      .device-card-centered .flash-icon {
        font-size: 0.85rem !important;
        margin-right: 5px;
        transition: all 0.3s ease;
      }

      .device-card-centered:hover .flash-icon {
        transform: scale(1.1);
      }

      .device-card-centered .flash-icon.flash {
        animation: premium-flash 1.5s infinite;
      }

      @keyframes premium-flash {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        }
        50% {
          opacity: 0.3;
          transform: scale(1.15);
          filter: drop-shadow(0 4px 8px rgba(239, 68, 68, 0.3));
        }
      }

      /* Checkbox */
      .device-card-centered .card-checkbox {
        width: 16px !important;
        height: 16px !important;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.9) !important;
        border: 2px solid #e2e8f0 !important;
        border-radius: 5px !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(10px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        position: relative;
      }

      .device-card-centered .card-checkbox:hover {
        border-color: #00e09e !important;
        box-shadow: 0 3px 6px rgba(0, 224, 158, 0.15);
        transform: scale(1.05);
      }

      .device-card-centered .card-checkbox:checked {
        background: linear-gradient(135deg, #00e09e 0%, #00d4aa 100%) !important;
        border-color: #00e09e !important;
        box-shadow: 0 3px 10px rgba(0, 224, 158, 0.3);
      }

      .device-card-centered .card-checkbox:checked::after {
        content: '✓';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 10px;
        font-weight: bold;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      }

      /* Piano-Key Actions (3 BUTTONS - EVENLY DISTRIBUTED) */
      .device-card-centered .card-actions {
        position: absolute;
        left: 12px;
        top: 12px;
        bottom: 12px;
        padding: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        gap: 0;
        border: 1px solid rgba(226, 232, 240, 0.9);
        border-radius: 8px;
        background: #fff;
        overflow: visible;
        box-shadow: none !important;
        z-index: 10;
      }

      .device-card-centered .card-action {
        width: 36px !important;
        flex: 1;
        min-height: 36px !important;
        border: 0;
        border-bottom: 1px solid rgba(226, 232, 240, 0.9);
        background: #fff !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        transform: translateZ(0);
        transition: transform 0.18s ease, box-shadow 0.18s ease;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        border-radius: 0;
      }

      .device-card-centered .card-action:first-child {
        border-top-left-radius: 7px;
        border-top-right-radius: 7px;
      }

      .device-card-centered .card-action:last-child {
        border-bottom: 0;
        border-bottom-left-radius: 7px;
        border-bottom-right-radius: 7px;
      }

      .device-card-centered .card-action img {
        width: 16px !important;
        height: 16px !important;
        filter: grayscale(0.2) brightness(0.85);
        transition: transform 0.18s ease, filter 0.18s ease;
      }

      /* Lift on interaction only */
      .device-card-centered .card-action:hover,
      .device-card-centered .card-action:focus-visible {
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 6px 14px rgba(16, 24, 40, 0.12), 0 2px 6px rgba(16, 24, 40, 0.08);
        outline: none;
      }

      .device-card-centered .card-action:hover img,
      .device-card-centered .card-action:focus-visible img {
        filter: grayscale(0) brightness(1);
        transform: scale(1.08);
      }

      /* Flat Status Indicator */
      .device-card-centered .connection-status-icon {
        position: absolute;
        bottom: 18px;
        right: 18px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #22c55e;
        border: 1px solid rgba(0, 0, 0, 0.06);
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15),
                    0 1px 3px rgba(0, 0, 0, 0.1),
                    inset 0 -2px 4px rgba(0, 0, 0, 0.1),
                    inset 0 2px 3px rgba(255, 255, 255, 0.4) !important;
        backdrop-filter: none !important;
        z-index: 5;
        transform: translateZ(0);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .device-card-centered .connection-status-icon:hover {
        transform: translateZ(2px) scale(1.05);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2),
                    0 2px 4px rgba(0, 0, 0, 0.12),
                    inset 0 -2px 5px rgba(0, 0, 0, 0.15),
                    inset 0 2px 4px rgba(255, 255, 255, 0.5) !important;
      }

      /* Map colors by connection or device state */
      .device-card-centered .connection-status-icon[data-conn="offline"] {
        background: #94a3b8;
      }
      .device-card-centered .connection-status-icon[data-state="warning"] {
        background: #f59e0b;
      }
      .device-card-centered .connection-status-icon[data-state="danger"] {
        background: #ef4444;
      }
      .device-card-centered .connection-status-icon[data-state="no_info"] {
        background: #94a3b8;
      }
      .device-card-centered .connection-status-icon[data-state="maintenance"] {
        background: #0ea5e9;
      }

    .myio-v5-shopping-badge-row {
        width: 100%;
        text-align: center;
        margin-bottom: 8px; /* Espaço ANTES da imagem */
      }
      
      /* Este é o estilo da badge, copiado do v1 */
      .myio-v5-shopping-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        
        /* Estilo do v1 (head-office) para replicar o visual */
        background-color: #EBF4FF; /* Fundo azul bem claro */
        border: 1px solid #BEE3F8; /* Borda azul clara */
        color: #2C5282; /* Texto azul escuro */
        
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 11px; /* Um pouco menor para caber no v5 */
        font-weight: 500;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

        /* Garantir que não quebre o layout */
        max-width: 90%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .myio-v5-shopping-badge .chip-icon {
        width: 12px;
        height: 12px;
        stroke: currentColor;
        opacity: 0.7;
        flex-shrink: 0;
      }

      /* Responsive / Dark mode */
      @media (max-width: 768px) {
        .device-card-centered.clickable {
          padding: 16px !important;
          border-radius: 12px !important;
          min-height: 110px !important;
        }

        .device-card-centered .device-image {
          max-height: 44px !important;
          margin: 3px 0 !important;
        }

        .device-card-centered .card-action {
          width: 36px !important;
          height: 36px !important;
        }

        .device-card-centered .device-percentage-badge {
          font-size: 0.55rem;
          padding: 2px 5px;
        }
      }

      @media (prefers-color-scheme: dark) {
        .device-card-centered.clickable {
          background: linear-gradient(145deg, #1e293b 0%, #334155 100%) !important;
          border-color: rgba(71, 85, 105, 0.8) !important;
          color: #f1f5f9 !important;
        }

        .myio-v5-shopping-badge {
          background-color: #334155; /* Fundo mais escuro */
          border-color: #475569;
          color: #cbd5e1; /* Texto mais claro */
        }

        .device-card-centered .device-title {
          color: #f1f5f9 !important;
        }

        .device-card-centered .device-subtitle {
          color: #94a3b8 !important;
        }

        .device-card-centered .card-actions {
          border-color: rgba(71, 85, 105, 0.8);
          background: #1e293b;
        }

        .device-card-centered .card-action {
          background: #1e293b !important;
          border-bottom: 1px solid rgba(71, 85, 105, 0.8);
        }

        .device-card-centered .device-percentage-badge {
          color: #94a3b8;
        }
      }
    `;
    document.head.appendChild(layoutStyle);
  }

  // Create action buttons container (NO INFO BUTTON)
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'card-actions';

  // Add action buttons
  if (typeof handleActionDashboard === 'function') {
    const dashboardBtn = document.createElement('button');
    dashboardBtn.className = 'card-action action-dashboard';
    dashboardBtn.title = 'Dashboard';
    dashboardBtn.innerHTML =
      '<img src="https://dashboard.myio-bas.com/api/images/public/TAVXE0sTbCZylwGsMF9lIWdllBB3iFtS"/>';
    dashboardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleActionDashboard(entityObject);
    });
    actionsContainer.appendChild(dashboardBtn);
  }

  if (typeof handleActionReport === 'function') {
    const reportBtn = document.createElement('button');
    reportBtn.className = 'card-action action-report';
    reportBtn.title = 'Relatório';
    reportBtn.innerHTML =
      '<img src="https://dashboard.myio-bas.com/api/images/public/d9XuQwMYQCG2otvtNSlqUHGavGaSSpz4"/>';
    reportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleActionReport(entityObject);
    });
    actionsContainer.appendChild(reportBtn);
  }

  if (typeof handleActionSettings === 'function') {
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'card-action action-settings';
    settingsBtn.title = 'Configurações';
    settingsBtn.innerHTML =
      '<img src="https://dashboard.myio-bas.com/api/images/public/5n9tze6vED2uwIs5VvJxGzNNZ9eV4yoz"/>';
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // V5: Settings should now include info functionality
      handleActionSettings(entityObject, {
        includeInfo: true, // Signal to settings modal to include connection info
        connectionData: {
          centralName,
          connectionStatusTime,
          timeVal,
          deviceStatus,
        },
      });
    });
    actionsContainer.appendChild(settingsBtn);
  }

  // NOTE: Info panel is REMOVED in v5
  // Connection info should now be handled in handleActionSettings modal

  // Insert actions container into the card
  if (enhancedCardElement && actionsContainer.children.length > 0) {
    enhancedCardElement.insertBefore(actionsContainer, enhancedCardElement.firstChild);
  }

  // Handle selection events
  if (enableSelection && MyIOSelectionStore) {
    const checkbox = enhancedCardElement.querySelector('.card-checkbox');

    // Handle checkbox changes
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();

        // Check selection when user CHECKS the box
        if (e.target.checked) {
          const currentCount = MyIOSelectionStore.getSelectedEntities().length;
          const selectedEntities = MyIOSelectionStore.getSelectedEntities();
          console.log('selectedEntities', selectedEntities);
          const isTryingToAdd = e.target.checked;

          if (isTryingToAdd && currentCount >= 6) {
            e.preventDefault();
            e.target.checked = false;
            MyIOToast.show('Não é possível selecionar mais de 6 itens.', 'warning');
            return;
          }

          MyIOSelectionStore.add(entityId);
        } else {
          // Remove from SelectionStore when UNCHECKED
          MyIOSelectionStore.remove(entityId);
        }
      });
    }

    // Listen for selection changes from the store
    const handleSelectionChange = (data) => {
      const isSelected = data.selectedIds.includes(entityId);
      if (checkbox) {
        checkbox.checked = isSelected;
      }
      enhancedCardElement.classList.toggle('selected', isSelected);
    };

    MyIOSelectionStore.on('selection:change', handleSelectionChange);

    // Set initial state
    const isInitiallySelected = MyIOSelectionStore.isSelected(entityId);
    if (checkbox) {
      checkbox.checked = isInitiallySelected;
    }
    enhancedCardElement.classList.toggle('selected', isInitiallySelected);

    // Cleanup function
    container._cleanup = () => {
      MyIOSelectionStore.off('selection:change', handleSelectionChange);
    };
  }

  // Handle drag and drop
  if (enableDragDrop) {
    enhancedCardElement.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/myio-id', entityId);
      e.dataTransfer.setData('application/json', JSON.stringify(entityObject));
      e.dataTransfer.setData('text/myio-name', entityObject.labelOrName);
      e.dataTransfer.effectAllowed = 'copy';

      if (MyIOSelectionStore) {
        MyIOSelectionStore.startDrag(entityId);
      }
    });

    enhancedCardElement.addEventListener('dragend', () => {
      // Drag end handling if needed
    });
  }

  // Handle card clicks
  if (typeof handleClickCard === 'function') {
    enhancedCardElement.addEventListener('click', (e) => {
      if (!e.target.closest('.card-action') && !e.target.closest('.card-checkbox')) {
        handleClickCard(entityObject);
      }
    });
  }

  // Attach TempRangeTooltip for TERMOSTATO devices
  const tempTooltipTrigger = enhancedCardElement.querySelector('.temp-tooltip-trigger');
  let tempTooltipCleanup = null;
  if (tempTooltipTrigger && isTermostatoDevice) {
    // Build entity data for tooltip
    const tooltipEntityData = {
      val: val,
      temperatureMin: temperatureMin,
      temperatureMax: temperatureMax,
      labelOrName: cardEntity.name,
      name: cardEntity.name,
    };
    tempTooltipCleanup = TempRangeTooltip.attach(tempTooltipTrigger, tooltipEntityData);
  }

  // Attach EnergyRangeTooltip for energy devices
  const energyTooltipTrigger = enhancedCardElement.querySelector('.energy-tooltip-trigger');
  let energyTooltipCleanup = null;
  if (energyTooltipTrigger && isEnergyDeviceFlag) {
    // Build entity data for energy tooltip
    const energyTooltipData = {
      labelOrName: cardEntity.name,
      name: cardEntity.name,
      instantaneousPower: entityObject.instantaneousPower ?? entityObject.consumption_power ?? val,
      powerRanges: entityObject.powerRanges || entityObject.ranges,
    };
    energyTooltipCleanup = EnergyRangeTooltip.attach(energyTooltipTrigger, energyTooltipData);
  }

  // Attach DeviceComparisonTooltip for percentage badge (non-termostato devices)
  const percentageTooltipTrigger = enhancedCardElement.querySelector('.percentage-tooltip-trigger');
  let percentageTooltipCleanup = null;
  if (percentageTooltipTrigger && !isTermostatoDevice) {
    // Get comparison data function - this pulls from entityObject's comparison data
    const getComparisonData = () => {
      // Extract comparison data from entityObject if available
      const categoryData = entityObject.categoryComparison || {
        name: `Todos ${deviceType || 'Dispositivos'}`,
        total: entityObject.categoryTotal || cardEntity.lastValue,
        deviceCount: entityObject.categoryDeviceCount || 1,
      };

      const widgetData = entityObject.widgetComparison || {
        name: entityObject.widgetScopeName || 'Area Comum',
        total: entityObject.widgetTotal || cardEntity.lastValue,
        deviceCount: entityObject.widgetDeviceCount || 1,
      };

      const grandTotalData = entityObject.grandTotalComparison || {
        name: 'Area Comum + Lojas',
        total: entityObject.grandTotal || cardEntity.lastValue,
        deviceCount: entityObject.grandTotalDeviceCount || 1,
      };

      return DeviceComparisonTooltip.buildComparisonData(
        {
          entityId: entityId,
          labelOrName: cardEntity.name,
          deviceType: deviceType,
          val: cardEntity.lastValue,
          perc: percentageForDisplay,
        },
        categoryData,
        widgetData,
        grandTotalData
      );
    };

    percentageTooltipCleanup = DeviceComparisonTooltip.attach(percentageTooltipTrigger, getComparisonData);
  }

  // Attach TempComparisonTooltip for temperature deviation badge (TERMOSTATO devices)
  const tempComparisonTrigger = enhancedCardElement.querySelector('.temp-comparison-tooltip-trigger');
  let tempComparisonCleanup = null;
  if (tempComparisonTrigger && isTermostatoDevice && tempDeviationPercent) {
    const getTempComparisonData = () => {
      // Get average temperature from entityObject if available
      const avgTemp = entityObject.averageTemperature ?? entityObject.avgTemp ?? ((Number(temperatureMin) + Number(temperatureMax)) / 2);
      const deviceCount = entityObject.temperatureDeviceCount ?? entityObject.tempDeviceCount ?? 1;

      return TempComparisonTooltip.buildComparisonData(
        {
          entityId: entityId,
          labelOrName: cardEntity.name,
          currentTemp: Number(val) || 0,
          minTemp: Number(temperatureMin) || 18,
          maxTemp: Number(temperatureMax) || 26,
        },
        {
          name: entityObject.averageName || 'Media Geral',
          value: Number(avgTemp) || 0,
          deviceCount: deviceCount,
        }
      );
    };

    tempComparisonCleanup = TempComparisonTooltip.attach(tempComparisonTrigger, getTempComparisonData);
  }

  // Store cleanup function for tooltips
  container._cleanup = () => {
    if (tempTooltipCleanup) tempTooltipCleanup();
    if (energyTooltipCleanup) energyTooltipCleanup();
    if (percentageTooltipCleanup) percentageTooltipCleanup();
    if (tempComparisonCleanup) tempComparisonCleanup();
  };

  // Return jQuery-like object for compatibility
  const jQueryLikeObject = {
    get: (index) => (index === 0 ? container : undefined),
    0: container,
    length: 1,
    find: (selector) => {
      const found = container.querySelector(selector);
      return {
        get: (index) => (index === 0 ? found : undefined),
        0: found,
        length: found ? 1 : 0,
        on: (event, handler) => {
          if (found) found.addEventListener(event, handler);
          return this;
        },
      };
    },
    on: (event, handler) => {
      container.addEventListener(event, handler);
      return this;
    },
    addClass: (className) => {
      container.classList.add(className);
      return this;
    },
    removeClass: (className) => {
      container.classList.remove(className);
      return this;
    },
    // Add cleanup method
    destroy: () => {
      if (container._cleanup) {
        container._cleanup();
      }
    },
  };

  return jQueryLikeObject;
}

// Enhanced wrapper for backward compatibility
export function renderCardComponent(options) {
  return renderCardComponentV5(options);
}
