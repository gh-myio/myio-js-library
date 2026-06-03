/**
 * RFC-0168: Ambiente Detail Modal Component
 * RFC-0171: Uses ModalHeader for standardized premium header
 * Modal for displaying detailed ambiente information with devices
 */

import { AMBIENTE_MODAL_CSS_PREFIX, injectAmbienteModalStyles } from './styles';
import { ModalHeader } from '../../utils/ModalHeader';
import type {
  AmbienteData,
  AmbienteDetailModalConfig,
  AmbienteDetailModalInstance,
  AmbienteEnergyDevice,
  AmbienteRemoteDevice,
  AmbienteSeletorDevice,
  AmbienteHierarchyNode,
} from './types';

// Modal ID prefix for ModalHeader
const MODAL_ID = 'ambiente-detail';

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
 * Get device type icon
 * RFC-0172: LAMP has same behavior as REMOTE
 */
function getDeviceIcon(deviceType: string): string {
  const dt = (deviceType || '').toUpperCase();
  if (dt.includes('TERMOSTATO')) return '🌡️';
  if (dt.includes('3F_MEDIDOR') || dt.includes('MEDIDOR')) return '⚡';
  if (dt.includes('FANCOIL')) return '❄️';
  if (dt.includes('AR_CONDICIONADO')) return '🌀';
  if (dt.includes('REMOTE') || dt.includes('CONTROLE') || dt.includes('LAMP')) return '💡';
  return '📱';
}

/**
 * Get device profile for display, with deviceType as fallback
 * RFC-0172: Always prefer deviceProfile, warn if using deviceType fallback
 */
function getDisplayDeviceProfile(device: { deviceProfile?: string; deviceType?: string }): string {
  if (device.deviceProfile) {
    return device.deviceProfile;
  }
  if (device.deviceType) {
    console.warn('[AmbienteDetailModal] deviceProfile missing, using deviceType fallback:', device.deviceType);
    return device.deviceType;
  }
  return 'Dispositivo';
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

  // Metrics section — only render cards that actually have data.
  const hasMetricValue = (v: number | null | undefined): boolean =>
    v !== null && v !== undefined && !isNaN(Number(v));

  const metricCards: string[] = [];

  if (hasMetricValue(data.temperature)) {
    metricCards.push(`
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
    `);
  }

  if (hasMetricValue(data.humidity)) {
    metricCards.push(`
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
    `);
  }

  if (hasMetricValue(data.consumption)) {
    metricCards.push(`
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-card">
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-header">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-icon">⚡</span>
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-label">Consumo Total</span>
        </div>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-value consumption">
          ${formatConsumption(data.consumption)}
        </div>
      </div>
    `);
  }

  // Devices count card is always shown
  metricCards.push(`
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-card">
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-header">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-icon">📱</span>
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-label">Dispositivos</span>
        </div>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metric-value">
          ${data.childDeviceCount || data.devices?.length || 0}
        </div>
      </div>
  `);

  const metricsHTML = `
    <div class="${AMBIENTE_MODAL_CSS_PREFIX}__metrics-grid">
      ${metricCards.join('')}
    </div>
  `;

  // Energy devices section
  let energyDevicesHTML = '';
  if (data.energyDevices && data.energyDevices.length > 0) {
    const hasClickHandler = !!config.onEnergyDeviceClick;
    const deviceItems = data.energyDevices.map((device: AmbienteEnergyDevice) => `
      <div
        class="${AMBIENTE_MODAL_CSS_PREFIX}__device-item ${hasClickHandler ? `${AMBIENTE_MODAL_CSS_PREFIX}__device-item--clickable` : ''}"
        data-energy-device-id="${device.id}"
        ${hasClickHandler ? 'role="button" tabindex="0"' : ''}
      >
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-info">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__device-icon">${getDeviceIcon(device.deviceProfile || device.deviceType || '')}</span>
          <div>
            <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-name">${device.label || device.name}</div>
            <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-type">${getDisplayDeviceProfile(device)}</div>
          </div>
        </div>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-value">
          ${formatConsumption(device.consumption)}
        </div>
        ${hasClickHandler ? `<span class="${AMBIENTE_MODAL_CSS_PREFIX}__device-arrow">›</span>` : ''}
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
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__section-icon">💡</span>
          Interruptor (${data.remoteDevices.length})
        </h4>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__remote-controls">
          ${remoteButtons}
        </div>
      </div>
    `;
  }

  // Seletor Auto/Manual section — read-only premium slider (detected=auto, not_detected=manual)
  let seletorHTML = '';
  if (data.seletorDevices && data.seletorDevices.length > 0) {
    const seletorItems = data.seletorDevices.map((sel: AmbienteSeletorDevice) => {
      const isAuto = sel.mode === 'auto';
      return `
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__seletor-item" data-seletor-id="${sel.id}" data-mode="${sel.mode}">
          <div class="${AMBIENTE_MODAL_CSS_PREFIX}__seletor-info">
            <span class="${AMBIENTE_MODAL_CSS_PREFIX}__seletor-icon">🔀</span>
            <span class="${AMBIENTE_MODAL_CSS_PREFIX}__seletor-name">${sel.label || sel.name}</span>
          </div>
          <div class="${AMBIENTE_MODAL_CSS_PREFIX}__seletor-toggle ${isAuto ? 'is-auto' : 'is-manual'}" role="img" aria-label="${isAuto ? 'Automático' : 'Manual'}">
            <span class="${AMBIENTE_MODAL_CSS_PREFIX}__seletor-thumb"></span>
            <span class="${AMBIENTE_MODAL_CSS_PREFIX}__seletor-opt left">Manual</span>
            <span class="${AMBIENTE_MODAL_CSS_PREFIX}__seletor-opt right">Automático</span>
          </div>
        </div>
      `;
    }).join('');

    seletorHTML = `
      <div class="${AMBIENTE_MODAL_CSS_PREFIX}__section">
        <h4 class="${AMBIENTE_MODAL_CSS_PREFIX}__section-title">
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__section-icon">🔀</span>
          Seletor Auto/Manual (${data.seletorDevices.length})
        </h4>
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__seletor-list">
          ${seletorItems}
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
          <span class="${AMBIENTE_MODAL_CSS_PREFIX}__device-icon">${getDeviceIcon(device.deviceProfile || device.deviceType || '')}</span>
          <div>
            <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-name">${device.label || device.name}</div>
            <div class="${AMBIENTE_MODAL_CSS_PREFIX}__device-type">${getDisplayDeviceProfile(device)}</div>
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

  // RFC-0171: Generate header using ModalHeader
  const headerHTML = ModalHeader.generateHTML({
    icon: '🏢',
    title: data.label,
    modalId: MODAL_ID,
    theme: config.themeMode || 'dark',
    isMaximized: false,
    showThemeToggle: false,
    showMaximize: false,
    showClose: true,
    primaryColor: '#2F5848', // Green theme for ambiente
  });

  return `
    <div class="${AMBIENTE_MODAL_CSS_PREFIX}-overlay" role="dialog" aria-modal="true" aria-labelledby="ambiente-modal-title">
      <div class="${AMBIENTE_MODAL_CSS_PREFIX} ${themeClass}">
        ${headerHTML}
        <div class="${AMBIENTE_MODAL_CSS_PREFIX}__body">
          ${metricsHTML}
          ${data.hasSetupWarning ? warningHTML : ''}
          ${energyDevicesHTML}
          ${remoteControlsHTML}
          ${seletorHTML}
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
    const footerCloseBtn = container.querySelector(`.${AMBIENTE_MODAL_CSS_PREFIX}__btn-close`) as HTMLElement;
    const remoteButtons = container.querySelectorAll(`.${AMBIENTE_MODAL_CSS_PREFIX}__remote-btn`);

    // Close on backdrop click
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        close();
      }
    });

    // RFC-0171: Setup ModalHeader handlers for close button
    ModalHeader.setupHandlers({
      modalId: MODAL_ID,
      onClose: close,
    });

    // Close button (footer)
    footerCloseBtn?.addEventListener('click', close);

    // Escape key
    document.addEventListener('keydown', handleEscape);

    // Interruptor (LAMP/REMOTE) buttons — open the On/Off modal (control + logs + scheduling)
    // when onSwitchClick is provided; otherwise fall back to the legacy toggle callback.
    remoteButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const remoteId = (btn as HTMLElement).dataset.remoteId;
        const remote = data.remoteDevices?.find((r) => r.id === remoteId);
        if (!remote) return;
        if (config.onSwitchClick) {
          close();
          config.onSwitchClick(remote);
        } else if (config.onRemoteToggle) {
          const currentState = (btn as HTMLElement).dataset.remoteState === 'on';
          config.onRemoteToggle(!currentState, remote);
        }
      });
    });

    // Seletor Auto/Manual items — clickable to open the On/Off modal (logs + scheduling)
    if (config.onSwitchClick) {
      const seletorItems = container.querySelectorAll(`.${AMBIENTE_MODAL_CSS_PREFIX}__seletor-item`);
      seletorItems.forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const seletorId = (item as HTMLElement).dataset.seletorId;
          const seletor = data.seletorDevices?.find((s) => s.id === seletorId);
          if (seletor && config.onSwitchClick) {
            close();
            config.onSwitchClick(seletor);
          }
        });
      });
    }

    // Energy device click handler - opens BAS device modal
    if (config.onEnergyDeviceClick) {
      const energyDeviceItems = container.querySelectorAll(`[data-energy-device-id]`);
      energyDeviceItems.forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const deviceId = (item as HTMLElement).dataset.energyDeviceId;
          const device = data.energyDevices?.find((d) => d.id === deviceId);
          if (device && config.onEnergyDeviceClick) {
            // Close this modal first, then call the callback
            close();
            config.onEnergyDeviceClick(device);
          }
        });
        // Support keyboard navigation
        item.addEventListener('keydown', (e) => {
          if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
            e.preventDefault();
            (item as HTMLElement).click();
          }
        });
      });
    }
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
