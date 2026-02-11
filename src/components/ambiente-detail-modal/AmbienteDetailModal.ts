/**
 * RFC-0168: Ambiente Detail Modal Component
 * Modal for displaying detailed ambiente information with devices
 */

import { AMBIENTE_MODAL_CSS_PREFIX, injectAmbienteModalStyles } from './styles';
import type {
  AmbienteData,
  AmbienteDetailModalConfig,
  AmbienteDetailModalInstance,
  AmbienteEnergyDevice,
  AmbienteRemoteDevice,
  AmbienteHierarchyNode,
} from './types';

/**
 * Format temperature value
 */
function formatTemperature(value: number | null): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Format humidity value
 */
function formatHumidity(value: number | null): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Format power/consumption value
 */
function formatConsumption(value: number | null): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const num = Number(value);
  if (num >= 1000) {
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + ' kW';
  }
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }) + ' W';
}

/**
 * Get status label
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    online: 'Ambiente Online',
    offline: 'Ambiente Offline',
    warning: 'Configuracao Necessaria',
  };
  return labels[status] || 'Status Desconhecido';
}

/**
 * Get device type icon
 */
function getDeviceIcon(deviceType: string): string {
  const dt = (deviceType || '').toUpperCase();
  if (dt.includes('TERMOSTATO')) return '🌡️';
  if (dt.includes('3F_MEDIDOR') || dt.includes('MEDIDOR')) return '⚡';
  if (dt.includes('FANCOIL')) return '❄️';
  if (dt.includes('AR_CONDICIONADO')) return '🌀';
  if (dt.includes('REMOTE') || dt.includes('CONTROLE')) return '🎮';
  return '📱';
}

/**
 * Render the modal HTML
 */
function renderModalHTML(
  data: AmbienteData,
  source: AmbienteHierarchyNode | null,
  config: AmbienteDetailModalConfig
): string {
  const themeClass = config.themeMode === 'dark' ? `${AMBIENTE_MODAL_CSS_PREFIX}--dark` : '';
  const status = data.status || 'offline';

  // Metrics section
  const metricsHTML = `
    <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metrics-grid">
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-card">
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-header">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-icon">🌡️</span>
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-label">Temperatura</span>
        </div>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-value temperature">
          ${formatTemperature(data.temperature)}
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-unit">°C</span>
        </div>
      </div>
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-card">
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-header">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-icon">💧</span>
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-label">Umidade</span>
        </div>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-value humidity">
          ${formatHumidity(data.humidity)}
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-unit">%</span>
        </div>
      </div>
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-card">
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-header">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-icon">⚡</span>
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-label">Consumo Total</span>
        </div>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-value consumption">
          ${formatConsumption(data.consumption)}
        </div>
      </div>
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-card">
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-header">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-icon">📱</span>
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-label">Dispositivos</span>
        </div>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-value">
          ${data.childDeviceCount || data.devices?.length || 0}
        </div>
      </div>
    </div>
  `;

  // Energy devices section
  let energyDevicesHTML = '';
  if (data.energyDevices && data.energyDevices.length > 0) {
    const deviceItems = data.energyDevices.map((device: AmbienteEnergyDevice) => `
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-item">
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-info">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__device-icon">${getDeviceIcon(device.deviceType)}</span>
          <div>
            <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-name">${device.label || device.name}</div>
            <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-type">${device.deviceType || 'Medidor'}</div>
          </div>
        </div>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-value">
          ${formatConsumption(device.consumption)}
        </div>
      </div>
    `).join('');

    energyDevicesHTML = `
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__section">
        <h4 class="${AMBIENTE_MODAL_CSS_PREFIX}__section-title">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__section-icon">⚡</span>
          Medidores de Energia (${data.energyDevices.length})
        </h4>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-list">
          ${deviceItems}
        </div>
      </div>
    `;
  }

  // Remote controls section
  let remoteControlsHTML = '';
  if (data.remoteDevices && data.remoteDevices.length > 0) {
    const remoteButtons = data.remoteDevices.map((remote: AmbienteRemoteDevice) => `
      <button
        class="${AMBIENTE_MODAL_CSS_PREFIX}__remote-btn ${remote.isOn ? 'on' : 'off'}"
        data-remote-id="${remote.id}"
        data-remote-state="${remote.isOn ? 'on' : 'off'}"
      >
        <span class="${AMBIENTE_MODAL_CSS_PREFIX}__remote-icon">${remote.isOn ? '🟢' : '⚫'}</span>
        <span class="${AMBIENTE_MODAL_CSS_PREFIX}__remote-name">${remote.label || remote.name}</span>
        <span class="${AMBIENTE_MODAL_CSS_PREFIX}__remote-status">${remote.isOn ? 'ON' : 'OFF'}</span>
      </button>
    `).join('');

    remoteControlsHTML = `
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__section">
        <h4 class="${AMBIENTE_MODAL_CSS_PREFIX}__section-title">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__section-icon">🎮</span>
          Controles Remotos (${data.remoteDevices.length})
        </h4>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__remote-controls">
          ${remoteButtons}
        </div>
      </div>
    `;
  }

  // All devices section (if no energy or remote devices, show all devices)
  let allDevicesHTML = '';
  if ((!data.energyDevices || data.energyDevices.length === 0) &&
      (!data.remoteDevices || data.remoteDevices.length === 0) &&
      data.devices && data.devices.length > 0) {
    const deviceItems = data.devices.map((device) => `
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-item">
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-info">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__device-icon">${getDeviceIcon(device.deviceType)}</span>
          <div>
            <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-name">${device.label || device.name}</div>
            <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-type">${device.deviceType || 'Dispositivo'}</div>
          </div>
        </div>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-value status-${device.status}">
          ${device.status === 'online' ? '🟢' : '🔴'}
        </div>
      </div>
    `).join('');

    allDevicesHTML = `
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__section">
        <h4 class="${AMBIENTE_MODAL_CSS_PREFIX}__section-title">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__section-icon">📱</span>
          Dispositivos (${data.devices.length})
        </h4>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-list">
          ${deviceItems}
        </div>
      </div>
    `;
  }

  // Setup warning
  let warningHTML = '';
  if (data.hasSetupWarning) {
    warningHTML = `
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__empty">
        <span class="${AMBIENTE_MODAL_CSS_PREFIX}__empty-icon">⚠️</span>
        <p class="${AMBIENTE_MODAL_CSS_PREFIX}__empty-text">
          Este ambiente ainda nao possui dispositivos configurados.<br>
          Adicione dispositivos para monitorar temperatura, umidade e consumo.
        </p>
      </div>
    `;
  }

  return `
    <div class="${AMBIENTE_MODAL_CSS_PREFIX}-overlay" role="dialog" aria-modal="true" aria-labelledby="ambiente-modal-title">
      <div class="${AMBIENTE_MODAL_CSS_PREFIX} ${themeClass}">
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__header">
          <div class="${AMBIENTE_MODAL_CSS_PREFIX}__header-content">
            <h2 id="ambiente-modal-title" class="${AMBIENTE_MODAL_CSS_PREFIX}__title">${data.label}</h2>
            ${source?.name ? `<span class="${AMBIENTE_MODAL_CSS_PREFIX}__subtitle">${source.name}</span>` : ''}
          </div>
          <button class="${AMBIENTE_MODAL_CSS_PREFIX}__close-btn" aria-label="Fechar">&times;</button>
        </div>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__body">
          <div class="${AMBIENTE_MODAL_CSS_PREFIX}__status-banner ${status}">
            <span class="${AMBIENTE_MODAL_CSS_PREFIX}__status-dot ${status}"></span>
            <span class="${AMBIENTE_MODAL_CSS_PREFIX}__status-text ${status}">${getStatusLabel(status)}</span>
          </div>
          ${metricsHTML}
          ${data.hasSetupWarning ? warningHTML : ''}
          ${energyDevicesHTML}
          ${remoteControlsHTML}
          ${allDevicesHTML}
        </div>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__footer">
          <button class="${AMBIENTE_MODAL_CSS_PREFIX}__btn ${AMBIENTE_MODAL_CSS_PREFIX}__btn-close">Fechar</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Create Ambiente Detail Modal instance
 */
export function createAmbienteDetailModal(
  data: AmbienteData,
  source: AmbienteHierarchyNode | null,
  config: AmbienteDetailModalConfig = {}
): AmbienteDetailModalInstance {
  injectAmbienteModalStyles();

  let container: HTMLElement | null = null;
  let isOpen = false;

  // Create container
  function createContainer(): void {
    container = document.createElement('div');
    container.innerHTML = renderModalHTML(data, source, config);
    document.body.appendChild(container);

    // Attach event listeners
    attachEventListeners();
  }

  // Attach event listeners
  function attachEventListeners(): void {
    if (!container) return;

    const overlay = container.querySelector(`.${AMBIENTE_MODAL_CSS_PREFIX}-overlay`) as HTMLElement;
    const closeBtn = container.querySelector(`.${AMBIENTE_MODAL_CSS_PREFIX}__close-btn`) as HTMLElement;
    const footerCloseBtn = container.querySelector(`.${AMBIENTE_MODAL_CSS_PREFIX}__btn-close`) as HTMLElement;
    const remoteButtons = container.querySelectorAll(`.${AMBIENTE_MODAL_CSS_PREFIX}__remote-btn`);

    // Close on backdrop click
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        close();
      }
    });

    // Close button
    closeBtn?.addEventListener('click', close);
    footerCloseBtn?.addEventListener('click', close);

    // Escape key
    document.addEventListener('keydown', handleEscape);

    // Remote toggle buttons
    remoteButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const remoteId = (btn as HTMLElement).dataset.remoteId;
        const currentState = (btn as HTMLElement).dataset.remoteState === 'on';
        const remote = data.remoteDevices?.find((r) => r.id === remoteId);
        if (remote && config.onRemoteToggle) {
          config.onRemoteToggle(!currentState, remote);
        }
      });
    });
  }

  // Handle escape key
  function handleEscape(e: KeyboardEvent): void {
    if (e.key === 'Escape' && isOpen) {
      close();
    }
  }

  // Open modal
  function open(): void {
    if (!container) {
      createContainer();
    }
    const overlay = container?.querySelector(`.${AMBIENTE_MODAL_CSS_PREFIX}-overlay`) as HTMLElement;
    if (overlay) {
      requestAnimationFrame(() => {
        overlay.classList.add('visible');
      });
    }
    isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  // Close modal
  function close(): void {
    const overlay = container?.querySelector(`.${AMBIENTE_MODAL_CSS_PREFIX}-overlay`) as HTMLElement;
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => {
        destroy();
      }, 200);
    }
    isOpen = false;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleEscape);
    config.onClose?.();
  }

  // Update data
  function update(newData: AmbienteData): void {
    if (container) {
      container.innerHTML = renderModalHTML(newData, source, config);
      attachEventListeners();
    }
  }

  // Destroy modal
  function destroy(): void {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    isOpen = false;
    document.removeEventListener('keydown', handleEscape);
  }

  return {
    open,
    close,
    update,
    destroy,
  };
}

/**
 * Open Ambiente Detail Modal (convenience function)
 * Call this directly to open the modal
 */
export function openAmbienteDetailModal(
  ambienteData: AmbienteData,
  source: AmbienteHierarchyNode | null = null,
  config: AmbienteDetailModalConfig = {}
): AmbienteDetailModalInstance {
  const modal = createAmbienteDetailModal(ambienteData, source, config);
  modal.open();
  return modal;
}
