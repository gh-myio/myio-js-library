/* eslint-disable */
/**
 * MYIO Enhanced Card Component - Version 2
 * Updated to integrate with MyIODraggableCard and MyIOSelectionStore
 * 
 * @version 2.0.0
 * @author MYIO Frontend Guild
 */

// Import the new MYIO components
import { MyIOSelectionStore } from '../../../../components/SelectionStore.js';
import { MyIODraggableCard } from '../../../../components/DraggableCard.js';
import { formatEnergy } from '../../../../format/energy.js';

export function renderCardComponentV2({
  entityObject,
  handleActionDashboard,
  handleActionReport,
  handleActionSettings,
  handleSelect,
  handInfo,
  handleClickCard,
  useNewComponents = true, // Flag to enable/disable new components
  enableSelection = true,  // Flag to enable selection functionality
  enableDragDrop = true,   // Flag to enable drag and drop
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
  } = entityObject;

  /*********************************************************
 * MyIO Global Toast Manager
 * - Cria um único elemento de toast no DOM.
 * - Evita múltiplos toasts de diferentes widgets.
 * - Simples de usar: MyIOToast.show('Sua mensagem');
 *********************************************************/
  const MyIOToast = (function() {
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
          show: show
      };
  })();


  // If new components are disabled, fall back to original implementation
  if (!useNewComponents) {
    return renderCardComponentLegacy({
      entityObject,
      handleActionDashboard,
      handleActionReport,
      handleActionSettings,
      handleSelect,
      handInfo,
      handleClickCard,
    });
  }

  // 1. LÓGICA DE STATUS
  const DeviceStatusType = {
      POWER_ON: "power_on",
      STANDBY: "standby",
      POWER_OFF: "power_off",
      WARNING: "warning",
      DANGER: "danger",
      MAINTENANCE: "maintenance",
      NO_INFO: "no_info",
  };

  const connectionStatusType = {
    CONNECTED: "connected",
    OFFLINE: "offline"
  }

    const mapDeviceToConnectionStatus = (deviceStatus) => {
    // Se o status for 'no_info', o dispositivo está offline.
    if (deviceStatus === DeviceStatusType.NO_INFO) {
      return connectionStatusType.OFFLINE;
    }
    // Para qualquer outro status, o dispositivo é considerado conectado.
    return connectionStatusType.CONNECTED;
  };

  const connectionStatus = mapDeviceToConnectionStatus(deviceStatus);

  const deviceStatusIcons = {
      [DeviceStatusType.POWER_ON]: "⚡",
      [DeviceStatusType.STANDBY]: "🔌",
      [DeviceStatusType.POWER_OFF]: "🔴",
      [DeviceStatusType.WARNING]: "⚠️",
      [DeviceStatusType.DANGER]: "🚨",
      [DeviceStatusType.MAINTENANCE]: "🛠️",
      [DeviceStatusType.NO_INFO]: "❓️",
  };

  const connectionStatusIcons = {
    [connectionStatusType.CONNECTED]: "🟢",
    [connectionStatusType.OFFLINE]: "🚫"
  }

  // 2. NOVA LÓGICA DE CLASSES E ÍCONES
  const isOffline = deviceStatus === DeviceStatusType.OFFLINE

  const shouldFlashIcon =
    deviceStatus === DeviceStatusType.OFFLINE ||
    deviceStatus === DeviceStatusType.WARNING ||
    deviceStatus === DeviceStatusType.DANGER ||
    deviceStatus === DeviceStatusType.MAINTENANCE;

  const icon = deviceStatusIcons[deviceStatus] || deviceStatusIcons[DeviceStatusType.POWER_ON];
  const connectionIcon = connectionStatusIcons[connectionStatus] || connectionStatusIcons[connectionStatusType.OFFLINE];

  // Map device status to connection status
  const mapDeviceStatus = (status) => {
    const statusMap = {
      'power_on': 'ok',
      'standby': 'alert',
      'power_off': 'fail',
      'warning': 'alert',
      'danger': 'fail',
      'maintenance': 'alert'
    };
    return statusMap[status] || 'unknown';
  };

  // Map device type to icon
  const mapDeviceTypeToIcon = (deviceType) => {
    const typeMap = {
      'COMPRESSOR': 'energy',
      'VENTILADOR': 'energy',
      'ESCADA_ROLANTE': 'energy',
      'ELEVADOR': 'energy',
      'MOTOR': 'energy',
      '3F_MEDIDOR': 'energy',
      'RELOGIO': 'energy',
      'ENTRADA': 'energy',
      'SUBESTACAO': 'energy',
      'HIDROMETRO': 'water',
      'CAIXA_DAGUA': 'water',
      'TANK': 'water',
    };
    
    const normalizedType = deviceType?.toUpperCase() || '';
    return typeMap[normalizedType] || 'generic';
  };

  // Get value type from device type (replaces valType logic)
  const getValueTypeFromDeviceType = (deviceType) => {
    const typeMap = {
      'COMPRESSOR': 'ENERGY',
      'VENTILADOR': 'ENERGY',
      'ESCADA_ROLANTE': 'ENERGY',
      'ELEVADOR': 'ENERGY',
      'MOTOR': 'ENERGY',
      '3F_MEDIDOR': 'ENERGY', 
      'RELOGIO': 'ENERGY',
      'ENTRADA': 'ENERGY',
      'SUBESTACAO': 'ENERGY',
      'HIDROMETRO': 'WATER',
      'CAIXA_DAGUA': 'WATER',
      'TANK': 'TANK'
    };
    const normalizedType = deviceType?.toUpperCase() || '';
    return typeMap[normalizedType] || 'ENERGY';
  };

  // Check if device is energy-related (now uses deviceType only)
  const isEnergyDevice = (deviceType) => {
    const energyDeviceTypes = ['COMPRESSOR', 'VENTILADOR', 'ESCADA_ROLANTE', 'ELEVADOR', 'MOTOR', '3F_MEDIDOR', 'RELOGIO', 'ENTRADA', 'SUBESTACAO'];
    const normalizedType = deviceType?.toUpperCase() || '';
    return energyDeviceTypes.includes(normalizedType);
  };

  // Smart formatting function that uses formatEnergy for energy devices
  const formatCardValue = (value, deviceType) => {
    const numValue = Number(value) || 0;
    
    if (isEnergyDevice(deviceType)) {
      // Use formatEnergy for intelligent unit conversion (Wh → kWh → MWh → GWh)
      return formatEnergy(numValue);
    } else {
      // Use existing formatting for non-energy devices
      const unit = determineUnit(deviceType);
      const formattedValue = numValue.toLocaleString('pt-BR', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
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
    status: mapDeviceStatus(deviceStatus)
  };

  // Register entity with SelectionStore if selection is enabled
  if (enableSelection && MyIOSelectionStore) {
    MyIOSelectionStore.registerEntity(cardEntity);
  }

  // Create container for the card
  const container = document.createElement('div');
  container.className = 'myio-enhanced-card-container';
  
  // Add enhanced styling
  if (!document.getElementById('myio-enhanced-card-styles')) {
    const style = document.createElement('style');
    style.id = 'myio-enhanced-card-styles';
    style.textContent = `
      .myio-enhanced-card-container {
        position: relative;
        width: 100%;
          height: 100%;
        }

      .myio-enhanced-card-container .myio-draggable-card {
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
      
      .myio-enhanced-card-container .myio-draggable-card:hover {
        transform: scale(1.05);
      }
      
      .myio-enhanced-card-container .myio-draggable-card.selected {
        border: 2px solid #00e09e;
        box-shadow: 0 4px 12px rgba(0,224,158,0.2);
        background: linear-gradient(135deg, #f0fdf9, #ecfdf5);
      }
      
      .myio-enhanced-card-container .myio-draggable-card.offline {
        border: 2px solid #ff4d4f;
        animation: border-blink 1s infinite;
      }
      
      @keyframes border-blink {
        0%, 100% { box-shadow: 0 0 8px rgba(255, 77, 79, 0.9); }
        50% { box-shadow: 0 0 16px rgba(255, 0, 0, 0.6); }
      }
      
      .myio-enhanced-card-container .card-actions {
        flex-shrink: 0;
        height: 100%;
        box-shadow: 1px 0 2px rgba(0, 0, 0, .1);
        display: flex;
        flex-direction: column;
        padding: 0 4px;
        justify-content: space-around;
        align-items: center;
        gap: 8px;
      }
      
      .myio-enhanced-card-container .card-action {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s ease;
        cursor: pointer;
        border: none;
        background: rgba(0, 0, 0, 0.05);
      }
      
      .myio-enhanced-card-container .card-action:hover {
        background: rgba(0, 224, 158, 0.1);
        transform: scale(1.1);
      }
      
      .myio-enhanced-card-container .card-action img {
        width: 20px;
        height: 20px;
      }
      
      .myio-enhanced-card-container .card-checkbox {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }
      
      .myio-enhanced-card-container .card-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 0 12px;
        text-align: center;
      }
      
      .myio-enhanced-card-container .card-title {
        font-weight: 700;
        font-size: 0.85rem;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      
      .myio-enhanced-card-container .card-group {
        font-size: 0.7rem;
        color: #888;
        margin-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      
      .myio-enhanced-card-container .card-value {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.9rem;
        font-weight: 700;
        color: #28a745;
      }
      
      .myio-enhanced-card-container .card-unit {
        font-size: 0.75rem;
        color: rgba(0, 0, 0, 0.6);
      }
      
      .myio-enhanced-card-container .card-percentage {
        font-size: 0.75rem;
        color: rgba(0, 0, 0, 0.45);
        margin-left: 4px;
      }
      
      .myio-enhanced-card-container .card-icon {
        width: 24px;
        height: 24px;
        margin-bottom: 8px;
      }
      
      .myio-enhanced-card-container .card-icon svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }
      
      .myio-enhanced-card-container .card-status-indicator {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        z-index: 10;
      }
      
      .myio-enhanced-card-container .card-status-ok {
        background: #28a745;
      }
      
      .myio-enhanced-card-container .card-status-alert {
        background: #ffc107;
      }
      
      .myio-enhanced-card-container .card-status-fail,
      .myio-enhanced-card-container .card-status-offline {
        background: #dc3545;
      }
      
      .myio-enhanced-card-container .card-status-unknown {
        background: #6c757d;
      }
      
      .myio-enhanced-card-container .info-panel {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(4px);
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 16px;
        border-radius: 10px;
        z-index: 20;
      }
      
      .myio-enhanced-card-container .info-panel.active {
        display: flex;
      }
      
      .myio-enhanced-card-container .info-close {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #666;
      }
      
      .myio-enhanced-card-container .info-content {
        text-align: center;
        font-size: 0.8rem;
        line-height: 1.4;
      }
      
      .myio-enhanced-card-container .info-content strong {
        display: block;
        margin-bottom: 8px;
        color: #333;
      }
    `;
    document.head.appendChild(style);
  }

  // Get device image URL
  const getDeviceImageUrl = (deviceType) => {
    // Normalize device type
    function normalizeString(str) {
      if (typeof str !== 'string') {
        str = '';
      }
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
    }

    // Device image mapping
    const deviceImages = {
      MOTOR: "https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT",
      "3F_MEDIDOR": "https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k",
      RELOGIO: "https://dashboard.myio-bas.com/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB",
      HIDROMETRO: "https://dashboard.myio-bas.com/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4",
      ENTRADA: "https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU",
      CAIXA_DAGUA: "https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq",
      ELEVADOR: "https://dashboard.myio-bas.com/api/images/public/rAjOvdsYJLGah6w6BABPJSD9znIyrkJX",
      ESCADA_ROLANTE: "https://dashboard.myio-bas.com/api/images/public/EJ997iB2HD1AYYUHwIloyQOOszeqb2jp",
    };

    const defaultImage = "https://cdn-icons-png.flaticon.com/512/1178/1178428.png";
    const nameType = normalizeString(deviceType);
    return deviceImages[nameType] || defaultImage;
  };

  // Create custom card HTML instead of using MyIODraggableCard
  const deviceImageUrl = getDeviceImageUrl(deviceType);
  
  // Create card HTML with central image (matching original layout)
  const cardHTML = `
      <div class="device-card-centered clickable ${cardEntity.status === 'offline' ? 'offline' : ''}" 
          data-entity-id="${entityId}"
          draggable="${enableDragDrop}"
          tabindex="0"
          role="article"
          aria-label="${cardEntity.name}, ${cardEntity.group}">
        
        <div class="device-card-inner">
          <div class="device-card-front">
            ${enableSelection && typeof handleSelect === 'function' ? 
              `<input type="checkbox" class="card-checkbox action-checker" aria-label="Select ${cardEntity.name}" style="position: absolute; top: 8px; right: 8px; z-index: 10;">` : 
              ''}
            
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%; flex-grow: 1; min-width: 0; padding: 0 12px 0 20px; margin-left: 16px;">
              
              <div class="device-title-row" style="flex-direction: column; min-height: 38px; text-align: center; width: 100%;">
                <span class="device-title" title="${cardEntity.name}">
                  ${cardEntity.name.length > 15 ? cardEntity.name.slice(0, 15) + "…" : cardEntity.name}
                </span>
                ${deviceIdentifier ? `
                  <span class="device-subtitle" title="${deviceIdentifier}">
                    ${deviceIdentifier}
                  </span>
                ` : ''}
              </div>

              <img class="device-image" src="${deviceImageUrl}" alt="${deviceType}" />
              
              <div class="device-data-row">
                <div class="consumption-main">
                  <span class="flash-icon ${shouldFlashIcon ? "flash" : ""}">
                    ${icon}
                  </span>
                  <span class="consumption-value">${formatCardValue(cardEntity.lastValue, deviceType)}</span>
                  <span class="device-title-percent">(${perc.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="connection-status-icon" data-conn="${connectionStatus}" data-state="${deviceStatus}" aria-label="${connectionStatus}"></div>
        
      </div>
    `;

  container.innerHTML = cardHTML;
  const enhancedCardElement = container.querySelector('.device-card-centered');

  // Add premium enhanced card styles with Piano-Key Actions & Flat Status
  if (!document.getElementById('myio-enhanced-card-layout-styles')) {
    const layoutStyle = document.createElement('style');
    layoutStyle.id = 'myio-enhanced-card-layout-styles';
    layoutStyle.textContent = `
      /* ===== MYIO Card v2 — Clean Piano Keys & Flat Status ===== */

      /* Card shell (kept) */
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
        min-height: 126px !important;
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

      /* Selected / Offline (kept) */
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

      /* Device image & titles (kept) */
      .device-card-centered .device-image {
        max-height: 47px !important;
        width: auto;
        margin: 10px 0 !important;
        display: block;
        filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.1));
        transition: all 0.3s ease;
        border-radius: 7px;
      }
      
      .device-card-centered:hover .device-image {
        filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.15));
        transform: scale(1.05);
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
        font-size: 0.85rem !important;
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

      /* Value pill (kept) */
      .device-card-centered .consumption-main {
        background: linear-gradient(135deg, rgba(0, 224, 158, 0.1) 0%, rgba(0, 180, 216, 0.1) 100%);
        border-radius: 10px;
        padding: 7px 10px;
        margin-top: 7px;
        border: 1px solid rgba(0, 224, 158, 0.2);
        backdrop-filter: blur(10px);
      }
      
      .device-card-centered .consumption-value {
        font-weight: 700 !important;
        font-size: 0.9rem !important;
        color: #059669 !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }
      
      .device-card-centered .device-title-percent {
        font-size: 0.72rem !important;
        color: #6b7280 !important;
        font-weight: 600 !important;
        margin-left: 5px;
      }
      
      .device-card-centered .flash-icon {
        font-size: 1rem !important;
        margin-right: 7px;
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

      /* Checkbox (kept) */
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

      /* ——— NEW: Piano-Key Actions (flat by default, full height) ——— */
      .device-card-centered .card-actions {
        position: absolute;
        left: 12px;
        top: 12px;
        bottom: 12px;
        padding: 0;
        display: flex;
        flex-direction: column;
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
        height: 36px !important;
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

      /* ——— NEW: Flat Status (CSS dot, never clipped) ——— */
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
      
      .myio-enhanced-card-container .info-close:hover {
        background: rgba(239, 68, 68, 0.2) !important;
        transform: scale(1.1);
      }

      /* Responsive / Dark mode (kept) */
      @media (max-width: 768px) {
        .device-card-centered.clickable {
          padding: 16px !important;
          border-radius: 12px !important;
        }
        
        .device-card-centered .device-image {
          max-height: 44px !important;
        }
        
        .device-card-centered .card-action {
          width: 36px !important;
          height: 36px !important;
        }
      }
      
      @media (prefers-color-scheme: dark) {
        .device-card-centered.clickable {
          background: linear-gradient(145deg, #1e293b 0%, #334155 100%) !important;
          border-color: rgba(71, 85, 105, 0.8) !important;
          color: #f1f5f9 !important;
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
      }
    `;
    document.head.appendChild(layoutStyle);
  }

  // Create action buttons container
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'card-actions';

  // Add action buttons
  if (typeof handleActionDashboard === 'function') {
    const dashboardBtn = document.createElement('button');
    dashboardBtn.className = 'card-action action-dashboard';
    dashboardBtn.title = 'Dashboard';
    dashboardBtn.innerHTML = '<img src="https://dashboard.myio-bas.com/api/images/public/TAVXE0sTbCZylwGsMF9lIWdllBB3iFtS"/>';
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
    reportBtn.innerHTML = '<img src="https://dashboard.myio-bas.com/api/images/public/d9XuQwMYQCG2otvtNSlqUHGavGaSSpz4"/>';
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
    settingsBtn.innerHTML = '<img src="https://dashboard.myio-bas.com/api/images/public/5n9tze6vED2uwIs5VvJxGzNNZ9eV4yoz"/>';
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleActionSettings(entityObject);
    });
    actionsContainer.appendChild(settingsBtn);
  }

  // Add info panel if requested
  if (handInfo) {
    const infoPanel = document.createElement('div');
    infoPanel.className = 'info-panel';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'info-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', () => {
      infoPanel.classList.remove('active');
    });
    
    const infoContent = document.createElement('div');
    infoContent.className = 'info-content';
    
    // Format connection info
    let connectionInfo = '';
    if (connectionStatusTime) {
      const date = new Date(connectionStatusTime);
      connectionInfo = `<strong>Central:</strong> ${centralName || 'N/A'}<br>`;
      connectionInfo += `<strong>Última Conexão:</strong> ${date.toLocaleString('pt-BR')}<br>`;
    }
    
    if (timeVal) {
      const telemetryDate = new Date(timeVal);
      const now = new Date();
      const diffMs = now - telemetryDate;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      
      connectionInfo += `<strong>Última Telemetria:</strong> ${telemetryDate.toLocaleString('pt-BR')}`;
      if (diffHours > 0) {
        connectionInfo += ` (${diffHours}h atrás)`;
      }
    }
    
    infoContent.innerHTML = connectionInfo || '<strong>Informações não disponíveis</strong>';
    
    infoPanel.appendChild(closeBtn);
    infoPanel.appendChild(infoContent);
    container.appendChild(infoPanel);
    
    // Add info button to actions
    const infoBtn = document.createElement('button');
    infoBtn.className = 'card-action action-info';
    infoBtn.title = 'Informações';
    infoBtn.innerHTML = 'ℹ️';
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      infoPanel.classList.toggle('active');
    });
    actionsContainer.appendChild(infoBtn);
  }

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

        // Lógica para quando o usuário MARCA o checkbox
        if (e.target.checked) {
          const currentCount = MyIOSelectionStore.getSelectedEntities().length;
          const selectedEntityes = MyIOSelectionStore.getSelectedEntities()
          console.log("selectedEntityes",selectedEntityes)
          const isTryingToAdd = e.target.checked;

          if (isTryingToAdd && currentCount >= 6) {
              e.preventDefault(); // Previne a ação padrão
              e.target.checked = false; // Desfaz a marcação do checkbox
              MyIOToast.show('Não é possível selecionar mais de 6 itens.', 'warning');
              return; // Interrompe a execução
          }
          

          window.dispatchEvent(new CustomEvent('myio:device-params', {
            detail: {
              id: entityId,
              name: labelOrName
            }
        }));
          // Se o limite não foi atingido, adiciona normalmente
          //MyIOSelectionStore.add(entityId);

        } else {
          // Lógica para quando o usuário DESMARCA (sempre permitido)
          window.dispatchEvent(new CustomEvent('myio:device-params-remove', {
            detail: {
              id: entityId,
              name: labelOrName
            }
        }));


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
      
      if (typeof handleSelect === 'function') {
        handleSelect(entityObject);
      }
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

  // Return jQuery-like object for compatibility
  const jQueryLikeObject = {
    get: (index) => index === 0 ? container : undefined,
    0: container,
    length: 1,
    find: (selector) => {
      const found = container.querySelector(selector);
      return {
        get: (index) => index === 0 ? found : undefined,
        0: found,
        length: found ? 1 : 0,
        on: (event, handler) => {
          if (found) found.addEventListener(event, handler);
          return this;
        }
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
    }
  };

  return jQueryLikeObject;
}

// Legacy fallback function (original implementation)
function renderCardComponentLegacy(options) {
  // This would contain the original renderCardComponent implementation
  // For now, we'll import and call the original function
  const { renderCardComponent } = require('./template-card.js');
  return renderCardComponent(options);
}

// Enhanced wrapper that provides both old and new functionality
export function renderCardComponent(options) {
  // Check if new components are available and user wants to use them
  const useNewComponents = options.useNewComponents !== false && 
                          typeof MyIOSelectionStore !== 'undefined' && 
                          typeof MyIODraggableCard !== 'undefined';
  
  if (useNewComponents) {
    return renderCardComponentV2(options);
  } else {
    return renderCardComponentLegacy(options);
  }
}

// Export legacy version for flexibility
export { renderCardComponentLegacy };
