/**
 * RFC-0170: Ambiente Group Modal Component
 * Modal for displaying aggregated information from multiple sub-ambientes
 */

import { AMBIENTE_GROUP_CSS_PREFIX, injectAmbienteGroupModalStyles } from './styles';
import type {
  AmbienteGroupData,
  AmbienteGroupModalConfig,
  AmbienteGroupModalInstance,
  SubAmbienteItem,
  AggregatedGroupMetrics,
} from './types';
import type { AmbienteData, AmbienteRemoteDevice } from '../ambiente-detail-modal/types';

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
    return (num / 1000).toLocaleString('pt-BR', {
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
 * Calculate aggregated metrics from sub-ambientes
 */
export function calculateGroupMetrics(subAmbientes: SubAmbienteItem[]): AggregatedGroupMetrics {
  const temps: number[] = [];
  const humids: number[] = [];
  let consumptionTotal = 0;
  let deviceCount = 0;
  let onlineCount = 0;
  let offlineCount = 0;

  subAmbientes.forEach((sub) => {
    const data = sub.ambienteData;
    if (data.temperature !== null && data.temperature !== undefined && !isNaN(data.temperature)) {
      temps.push(data.temperature);
    }
    if (data.humidity !== null && data.humidity !== undefined && !isNaN(data.humidity)) {
      humids.push(data.humidity);
    }
    if (data.consumption !== null && data.consumption !== undefined && !isNaN(data.consumption)) {
      consumptionTotal += data.consumption;
    }
    deviceCount += data.childDeviceCount || data.devices?.length || 0;

    if (data.status === 'online') {
      onlineCount++;
    } else if (data.status === 'offline') {
      offlineCount++;
    }
  });

  return {
    temperatureAvg: temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
    temperatureMin: temps.length > 0 ? Math.min(...temps) : null,
    temperatureMax: temps.length > 0 ? Math.max(...temps) : null,
    humidityAvg: humids.length > 0 ? humids.reduce((a, b) => a + b, 0) / humids.length : null,
    consumptionTotal: consumptionTotal > 0 ? consumptionTotal : null,
    deviceCount,
    onlineCount,
    offlineCount,
    subAmbienteCount: subAmbientes.length,
  };
}

/**
 * Render the modal HTML
 */
function renderModalHTML(
  data: AmbienteGroupData,
  config: AmbienteGroupModalConfig
): string {
  const themeClass = config.themeMode === 'dark' ? `${AMBIENTE_GROUP_CSS_PREFIX}--dark` : '';
  const metrics = data.metrics;

  // Summary cards
  const summaryHTML = `
    <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary">
      <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-card">
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-icon">🌡️</div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-value temperature">
          ${formatTemperature(metrics.temperatureAvg)}°C
        </div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-label">Temp. Media</div>
        ${metrics.temperatureMin !== null && metrics.temperatureMax !== null ? `
          <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-range">
            ${formatTemperature(metrics.temperatureMin)}° - ${formatTemperature(metrics.temperatureMax)}°
          </div>
        ` : ''}
      </div>
      <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-card">
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-icon">💧</div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-value humidity">
          ${formatHumidity(metrics.humidityAvg)}%
        </div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-label">Umidade Media</div>
      </div>
      <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-card">
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-icon">⚡</div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-value consumption">
          ${formatConsumption(metrics.consumptionTotal)}
        </div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-label">Consumo Total</div>
      </div>
      <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-card">
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-icon">📱</div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-value devices">
          ${metrics.deviceCount}
        </div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-label">Dispositivos</div>
      </div>
      <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-card">
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-icon">🏢</div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-value">
          ${metrics.subAmbienteCount}
        </div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__summary-label">Sub-Ambientes</div>
      </div>
    </div>
  `;

  // Status bar
  const statusBarHTML = `
    <div class="${AMBIENTE_GROUP_CSS_PREFIX}__status-bar">
      <div class="${AMBIENTE_GROUP_CSS_PREFIX}__status-item">
        <span class="${AMBIENTE_GROUP_CSS_PREFIX}__status-dot online"></span>
        <span>${metrics.onlineCount} Online</span>
      </div>
      <div class="${AMBIENTE_GROUP_CSS_PREFIX}__status-item">
        <span class="${AMBIENTE_GROUP_CSS_PREFIX}__status-dot offline"></span>
        <span>${metrics.offlineCount} Offline</span>
      </div>
    </div>
  `;

  // Sub-ambientes list
  const subAmbientesHTML = data.subAmbientes.map((sub, index) => {
    const ambData = sub.ambienteData;
    const status = ambData.status || 'offline';

    // Device items
    let devicesHTML = '';
    if (ambData.energyDevices && ambData.energyDevices.length > 0) {
      devicesHTML = ambData.energyDevices.map((device) => `
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__device-item">
          <span class="${AMBIENTE_GROUP_CSS_PREFIX}__device-icon">${getDeviceIcon(device.deviceType)}</span>
          <div class="${AMBIENTE_GROUP_CSS_PREFIX}__device-info">
            <div class="${AMBIENTE_GROUP_CSS_PREFIX}__device-name">${device.label || device.name}</div>
            <div class="${AMBIENTE_GROUP_CSS_PREFIX}__device-type">${device.deviceType || 'Medidor'}</div>
          </div>
          <span class="${AMBIENTE_GROUP_CSS_PREFIX}__device-value">${formatConsumption(device.consumption)}</span>
        </div>
      `).join('');
    } else if (ambData.devices && ambData.devices.length > 0) {
      devicesHTML = ambData.devices.slice(0, 6).map((device) => `
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__device-item">
          <span class="${AMBIENTE_GROUP_CSS_PREFIX}__device-icon">${getDeviceIcon(device.deviceType)}</span>
          <div class="${AMBIENTE_GROUP_CSS_PREFIX}__device-info">
            <div class="${AMBIENTE_GROUP_CSS_PREFIX}__device-name">${device.label || device.name}</div>
            <div class="${AMBIENTE_GROUP_CSS_PREFIX}__device-type">${device.deviceType || 'Dispositivo'}</div>
          </div>
        </div>
      `).join('');
    }

    // Remote controls
    let remotesHTML = '';
    if (ambData.remoteDevices && ambData.remoteDevices.length > 0) {
      const remoteButtons = ambData.remoteDevices.map((remote: AmbienteRemoteDevice) => `
        <button
          class="${AMBIENTE_GROUP_CSS_PREFIX}__remote-btn ${remote.isOn ? 'on' : 'off'}"
          data-subambiente-index="${index}"
          data-remote-id="${remote.id}"
          data-remote-state="${remote.isOn ? 'on' : 'off'}"
        >
          ${remote.isOn ? '🟢' : '⚫'} ${remote.label || remote.name} ${remote.isOn ? 'ON' : 'OFF'}
        </button>
      `).join('');
      remotesHTML = `<div class="${AMBIENTE_GROUP_CSS_PREFIX}__remotes">${remoteButtons}</div>`;
    }

    return `
      <div class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente" data-subambiente-index="${index}">
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-header">
          <div class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-info">
            <span class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-status ${status}"></span>
            <span class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-name">${sub.label}</span>
          </div>
          <div class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metrics">
            <div class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric">
              <span class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric-icon">🌡️</span>
              <span class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric-value temperature">${formatTemperature(ambData.temperature)}°</span>
            </div>
            <div class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric">
              <span class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric-icon">💧</span>
              <span class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric-value humidity">${formatHumidity(ambData.humidity)}%</span>
            </div>
            <div class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric">
              <span class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric-icon">⚡</span>
              <span class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric-value consumption">${formatConsumption(ambData.consumption)}</span>
            </div>
          </div>
          <span class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-arrow">▶</span>
        </div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-details">
          ${devicesHTML ? `<div class="${AMBIENTE_GROUP_CSS_PREFIX}__devices-grid">${devicesHTML}</div>` : '<p style="color:#6c757d;font-size:13px;">Nenhum dispositivo configurado</p>'}
          ${remotesHTML}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="${AMBIENTE_GROUP_CSS_PREFIX}-overlay" role="dialog" aria-modal="true" aria-labelledby="ambiente-group-title">
      <div class="${AMBIENTE_GROUP_CSS_PREFIX} ${themeClass}">
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__header">
          <div class="${AMBIENTE_GROUP_CSS_PREFIX}__header-content">
            <h2 id="ambiente-group-title" class="${AMBIENTE_GROUP_CSS_PREFIX}__title">
              <span class="${AMBIENTE_GROUP_CSS_PREFIX}__title-icon">🏢</span>
              ${data.label}
            </h2>
            <span class="${AMBIENTE_GROUP_CSS_PREFIX}__subtitle">${data.name || `${metrics.subAmbienteCount} sub-ambientes`}</span>
          </div>
          <button class="${AMBIENTE_GROUP_CSS_PREFIX}__close-btn" aria-label="Fechar">&times;</button>
        </div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__body">
          ${summaryHTML}
          ${statusBarHTML}
          <h4 class="${AMBIENTE_GROUP_CSS_PREFIX}__section-title">
            🏢 Sub-Ambientes (${metrics.subAmbienteCount})
          </h4>
          <div class="${AMBIENTE_GROUP_CSS_PREFIX}__subambientes">
            ${subAmbientesHTML}
          </div>
        </div>
        <div class="${AMBIENTE_GROUP_CSS_PREFIX}__footer">
          <button class="${AMBIENTE_GROUP_CSS_PREFIX}__btn ${AMBIENTE_GROUP_CSS_PREFIX}__btn-close">Fechar</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Create Ambiente Group Modal instance
 */
export function createAmbienteGroupModal(
  data: AmbienteGroupData,
  config: AmbienteGroupModalConfig = {}
): AmbienteGroupModalInstance {
  injectAmbienteGroupModalStyles();

  let container: HTMLElement | null = null;
  let isOpen = false;

  // Create container
  function createContainer(): void {
    container = document.createElement('div');
    container.innerHTML = renderModalHTML(data, config);
    document.body.appendChild(container);

    // Attach event listeners
    attachEventListeners();
  }

  // Attach event listeners
  function attachEventListeners(): void {
    if (!container) return;

    const overlay = container.querySelector(`.${AMBIENTE_GROUP_CSS_PREFIX}-overlay`) as HTMLElement;
    const closeBtn = container.querySelector(`.${AMBIENTE_GROUP_CSS_PREFIX}__close-btn`) as HTMLElement;
    const footerCloseBtn = container.querySelector(`.${AMBIENTE_GROUP_CSS_PREFIX}__btn-close`) as HTMLElement;
    const subAmbienteHeaders = container.querySelectorAll(`.${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-header`);
    const remoteButtons = container.querySelectorAll(`.${AMBIENTE_GROUP_CSS_PREFIX}__remote-btn`);

    // Close on backdrop click
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        close();
      }
    });

    // Close buttons
    closeBtn?.addEventListener('click', close);
    footerCloseBtn?.addEventListener('click', close);

    // Escape key
    document.addEventListener('keydown', handleEscape);

    // Sub-ambiente expand/collapse
    subAmbienteHeaders.forEach((header) => {
      header.addEventListener('click', (e) => {
        const subAmbiente = (header as HTMLElement).closest(`.${AMBIENTE_GROUP_CSS_PREFIX}__subambiente`) as HTMLElement;
        if (subAmbiente) {
          subAmbiente.classList.toggle('expanded');
        }
      });
    });

    // Remote toggle buttons
    remoteButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt((btn as HTMLElement).dataset.subambienteIndex || '0', 10);
        const remoteId = (btn as HTMLElement).dataset.remoteId || '';
        const currentState = (btn as HTMLElement).dataset.remoteState === 'on';
        const subAmbiente = data.subAmbientes[index];
        if (subAmbiente && config.onRemoteToggle) {
          config.onRemoteToggle(!currentState, subAmbiente, remoteId);
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
    const overlay = container?.querySelector(`.${AMBIENTE_GROUP_CSS_PREFIX}-overlay`) as HTMLElement;
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
    const overlay = container?.querySelector(`.${AMBIENTE_GROUP_CSS_PREFIX}-overlay`) as HTMLElement;
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
  function update(newData: AmbienteGroupData): void {
    if (container) {
      container.innerHTML = renderModalHTML(newData, config);
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
 * Open Ambiente Group Modal (convenience function)
 */
export function openAmbienteGroupModal(
  data: AmbienteGroupData,
  config: AmbienteGroupModalConfig = {}
): AmbienteGroupModalInstance {
  const modal = createAmbienteGroupModal(data, config);
  modal.open();
  return modal;
}

/**
 * Build AmbienteGroupData from sub-ambientes
 * Helper function to construct group data from array of sub-ambientes
 */
export function buildAmbienteGroupData(
  groupId: string,
  groupLabel: string,
  groupName: string,
  subAmbientes: SubAmbienteItem[]
): AmbienteGroupData {
  const metrics = calculateGroupMetrics(subAmbientes);

  // Determine group status
  let status: 'online' | 'offline' | 'partial' | 'warning' = 'offline';
  if (metrics.onlineCount === subAmbientes.length) {
    status = 'online';
  } else if (metrics.onlineCount > 0) {
    status = 'partial';
  } else if (subAmbientes.some((s) => s.ambienteData.hasSetupWarning)) {
    status = 'warning';
  }

  return {
    id: groupId,
    label: groupLabel,
    name: groupName,
    metrics,
    subAmbientes,
    status,
  };
}
