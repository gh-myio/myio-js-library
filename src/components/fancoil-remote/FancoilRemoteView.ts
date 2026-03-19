/**
 * RFC-0158: Fancoil Remote Control View
 * Migrated from remote-version-fancoil-widget-v1.0.0
 */

import type {
  FancoilRemoteSettings,
  FancoilState,
  FancoilStatus,
  FancoilThemeMode,
} from './types';
import {
  DEFAULT_FANCOIL_SETTINGS,
  DEFAULT_FANCOIL_STATE,
  getImageByConsumption,
} from './types';
import { FANCOIL_REMOTE_CSS_PREFIX, injectFancoilRemoteStyles } from './styles';

export interface FancoilRemoteViewOptions {
  container: HTMLElement;
  settings?: FancoilRemoteSettings;
  initialState?: Partial<FancoilState>;
  onPowerToggle?: () => void;
  onTemperatureIncrease?: () => void;
  onTemperatureDecrease?: () => void;
  onSettingsClick?: () => void;
}

export class FancoilRemoteView {
  private container: HTMLElement;
  private settings: Required<FancoilRemoteSettings>;
  private state: FancoilState;
  private root: HTMLElement;

  private onPowerToggle?: () => void;
  private onTemperatureIncrease?: () => void;
  private onTemperatureDecrease?: () => void;
  private onSettingsClick?: () => void;

  constructor(options: FancoilRemoteViewOptions) {
    this.container = options.container;
    this.settings = {
      ...DEFAULT_FANCOIL_SETTINGS,
      ...options.settings,
      labels: {
        ...DEFAULT_FANCOIL_SETTINGS.labels,
        ...options.settings?.labels,
      },
    };
    this.state = { ...DEFAULT_FANCOIL_STATE, ...options.initialState };

    this.onPowerToggle = options.onPowerToggle;
    this.onTemperatureIncrease = options.onTemperatureIncrease;
    this.onTemperatureDecrease = options.onTemperatureDecrease;
    this.onSettingsClick = options.onSettingsClick;

    injectFancoilRemoteStyles();

    this.root = document.createElement('div');
    this.root.className = this.getRootClassName();

    this.render();
    this.container.appendChild(this.root);
  }

  private getRootClassName(): string {
    const classes = [FANCOIL_REMOTE_CSS_PREFIX];
    if (this.settings.themeMode === 'dark') {
      classes.push(`${FANCOIL_REMOTE_CSS_PREFIX}--dark`);
    }
    return classes.join(' ');
  }

  private render(): void {
    const { labels } = this.settings;
    const { status, mode, ambientTemperature, consumption, temperatureSetpoint, isSetpointEnabled } = this.state;

    const statusChipClass = `${FANCOIL_REMOTE_CSS_PREFIX}__status-chip--${status}`;
    const imageUrl = getImageByConsumption(consumption);
    const tempDisplay = ambientTemperature !== null ? `${ambientTemperature.toFixed(1)}` : '-';
    const consumptionDisplay = consumption.toFixed(2);
    const setpointDisplay = isSetpointEnabled && temperatureSetpoint !== null
      ? `${temperatureSetpoint} °C`
      : '';

    this.root.innerHTML = `
      <div class="${FANCOIL_REMOTE_CSS_PREFIX}__lcd">
        <!-- Status Bar -->
        <div class="${FANCOIL_REMOTE_CSS_PREFIX}__status-bar">
          <span class="${FANCOIL_REMOTE_CSS_PREFIX}__status-label">${this.escapeHtml(labels.status || 'STATUS')}</span>
          <span class="${FANCOIL_REMOTE_CSS_PREFIX}__status-chip ${statusChipClass}">
            ${status.toUpperCase()}
          </span>
        </div>

        <!-- Mode Toggle -->
        <div class="${FANCOIL_REMOTE_CSS_PREFIX}__mode-toggle">
          <div class="${FANCOIL_REMOTE_CSS_PREFIX}__mode-option ${mode === 'auto' ? `${FANCOIL_REMOTE_CSS_PREFIX}__mode-option--active` : ''}">
            ${this.escapeHtml(labels.auto || 'AUTO.')}
          </div>
          <div class="${FANCOIL_REMOTE_CSS_PREFIX}__mode-option ${mode === 'man' ? `${FANCOIL_REMOTE_CSS_PREFIX}__mode-option--active` : ''}">
            ${this.escapeHtml(labels.manual || 'MAN.')}
          </div>
        </div>

        <!-- Image and Metrics -->
        <div class="${FANCOIL_REMOTE_CSS_PREFIX}__image-block">
          <div class="${FANCOIL_REMOTE_CSS_PREFIX}__ac-image-wrapper">
            <img src="${imageUrl}" class="${FANCOIL_REMOTE_CSS_PREFIX}__ac-image" alt="AC Status" />
          </div>
          <div class="${FANCOIL_REMOTE_CSS_PREFIX}__metrics">
            <div class="${FANCOIL_REMOTE_CSS_PREFIX}__metric">
              <span class="${FANCOIL_REMOTE_CSS_PREFIX}__metric-icon"></span>
              <span>${tempDisplay}°C</span>
            </div>
            <div class="${FANCOIL_REMOTE_CSS_PREFIX}__metric">
              <span class="${FANCOIL_REMOTE_CSS_PREFIX}__metric-icon"></span>
              <span>${consumptionDisplay} kW</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Setpoint Grid -->
      <div class="${FANCOIL_REMOTE_CSS_PREFIX}__setpoint-grid">
        <div class="${FANCOIL_REMOTE_CSS_PREFIX}__grid-label">${this.escapeHtml(labels.setPoint || 'Set Point')}</div>
        <div class="${FANCOIL_REMOTE_CSS_PREFIX}__grid-value ${!isSetpointEnabled ? `${FANCOIL_REMOTE_CSS_PREFIX}__grid-value--disabled` : ''}">
          ${setpointDisplay}
        </div>

        <button class="${FANCOIL_REMOTE_CSS_PREFIX}__btn ${FANCOIL_REMOTE_CSS_PREFIX}__btn--power ${status === 'on' ? `${FANCOIL_REMOTE_CSS_PREFIX}__btn--power-active` : ''}"
                data-action="power"
                ${status === 'offline' ? 'disabled' : ''}>
          ⏻
        </button>

        <div class="${FANCOIL_REMOTE_CSS_PREFIX}__btn-group">
          <button class="${FANCOIL_REMOTE_CSS_PREFIX}__btn"
                  data-action="decrease"
                  ${!isSetpointEnabled ? 'disabled' : ''}>
            ⬇
          </button>
          <button class="${FANCOIL_REMOTE_CSS_PREFIX}__btn"
                  data-action="increase"
                  ${!isSetpointEnabled ? 'disabled' : ''}>
            ⬆
          </button>
        </div>
      </div>

      <!-- Actions Bar -->
      <div class="${FANCOIL_REMOTE_CSS_PREFIX}__actions" data-action="settings">
        ${this.escapeHtml(labels.settingsButton || '& ')}
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest('[data-action]')?.getAttribute('data-action');

      if (!action) return;

      switch (action) {
        case 'power':
          if (this.state.status !== 'offline') {
            this.onPowerToggle?.();
          }
          break;
        case 'increase':
          if (this.state.isSetpointEnabled) {
            this.onTemperatureIncrease?.();
          }
          break;
        case 'decrease':
          if (this.state.isSetpointEnabled) {
            this.onTemperatureDecrease?.();
          }
          break;
        case 'settings':
          this.onSettingsClick?.();
          break;
      }
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public methods

  public getElement(): HTMLElement {
    return this.root;
  }

  public updateState(newState: Partial<FancoilState>): void {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  public getState(): FancoilState {
    return { ...this.state };
  }

  public setThemeMode(mode: FancoilThemeMode): void {
    this.settings.themeMode = mode;
    this.root.className = this.getRootClassName();
  }

  public getThemeMode(): FancoilThemeMode {
    return this.settings.themeMode;
  }

  public showModal(type: 'success' | 'warning' | 'error' | 'confirm', title: string, message: string, onConfirm?: () => void): void {
    const modal = document.createElement('div');
    modal.className = `${FANCOIL_REMOTE_CSS_PREFIX}__modal-overlay`;

    const isConfirm = type === 'confirm';
    const contentClass = isConfirm ? '' : `${FANCOIL_REMOTE_CSS_PREFIX}__modal-content--${type}`;

    modal.innerHTML = `
      <div class="${FANCOIL_REMOTE_CSS_PREFIX}__modal-backdrop"></div>
      <div class="${FANCOIL_REMOTE_CSS_PREFIX}__modal-content ${contentClass}">
        <h3 class="${FANCOIL_REMOTE_CSS_PREFIX}__modal-title">${title}</h3>
        <p class="${FANCOIL_REMOTE_CSS_PREFIX}__modal-message">${message}</p>
        <div class="${FANCOIL_REMOTE_CSS_PREFIX}__modal-actions">
          ${isConfirm ? `
            <button class="${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn ${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn--cancel" data-modal-action="cancel">Cancelar</button>
            <button class="${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn ${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn--confirm" data-modal-action="confirm">Confirmar</button>
          ` : `
            <button class="${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn ${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn--close" data-modal-action="close">Fechar</button>
          `}
        </div>
      </div>
    `;

    const closeModal = () => modal.remove();

    modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-modal-action');

      if (action === 'cancel' || action === 'close') {
        closeModal();
      } else if (action === 'confirm') {
        closeModal();
        onConfirm?.();
      }
    });

    // Also close on backdrop click
    modal.querySelector(`.${FANCOIL_REMOTE_CSS_PREFIX}__modal-backdrop`)?.addEventListener('click', closeModal);

    document.body.appendChild(modal);

    // Auto-close notification modals after 2 seconds
    if (!isConfirm) {
      setTimeout(closeModal, 2000);
    }
  }

  public destroy(): void {
    this.root.remove();
  }
}
