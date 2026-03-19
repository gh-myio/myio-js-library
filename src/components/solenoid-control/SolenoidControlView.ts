/**
 * RFC-0158: Solenoid Control View
 * Migrated from acionamento-solenoide-com-on-off
 */

import type {
  SolenoidControlSettings,
  SolenoidState,
  SolenoidStatus,
  SolenoidThemeMode,
} from './types';
import { DEFAULT_SOLENOID_SETTINGS, DEFAULT_SOLENOID_STATE, SOLENOID_IMAGES } from './types';
import { SOLENOID_CONTROL_CSS_PREFIX, injectSolenoidControlStyles } from './styles';

export interface SolenoidControlViewOptions {
  container: HTMLElement;
  settings?: SolenoidControlSettings;
  initialState?: Partial<SolenoidState>;
  onToggleClick?: () => void;
}

/** Button config per status */
const STATUS_BUTTON_CONFIG: Record<SolenoidStatus, { icon: string; cssModifier: string }> = {
  on: { icon: '\uD83D\uDD13', cssModifier: 'on' },
  off: { icon: '\uD83D\uDD12', cssModifier: 'off' },
  offline: { icon: '\u26A0\uFE0F', cssModifier: 'offline' },
};

export class SolenoidControlView {
  private container: HTMLElement;
  private settings: Required<SolenoidControlSettings>;
  private state: SolenoidState;
  private root: HTMLElement;

  private onToggleClick?: () => void;

  constructor(options: SolenoidControlViewOptions) {
    this.container = options.container;
    this.settings = {
      ...DEFAULT_SOLENOID_SETTINGS,
      ...options.settings,
      labels: {
        ...DEFAULT_SOLENOID_SETTINGS.labels,
        ...options.settings?.labels,
      },
    };
    this.state = { ...DEFAULT_SOLENOID_STATE, ...options.initialState };
    this.onToggleClick = options.onToggleClick;

    injectSolenoidControlStyles();

    this.root = document.createElement('div');
    this.root.className = this.getRootClassName();
    this.applyBackgroundColor();

    this.render();
    this.container.appendChild(this.root);
  }

  private getRootClassName(): string {
    const classes = [SOLENOID_CONTROL_CSS_PREFIX];
    if (this.settings.themeMode === 'dark') {
      classes.push(`${SOLENOID_CONTROL_CSS_PREFIX}--dark`);
    }
    return classes.join(' ');
  }

  private applyBackgroundColor(): void {
    if (this.settings.backgroundColor) {
      this.root.style.backgroundColor = this.settings.backgroundColor;
    }
  }

  private render(): void {
    const { status } = this.state;
    const { labels } = this.settings;
    const config = STATUS_BUTTON_CONFIG[status];
    const imageUrl = SOLENOID_IMAGES[status] || SOLENOID_IMAGES.offline;

    let buttonLabel: string;
    if (status === 'on') {
      buttonLabel = labels.open || 'Aberto';
    } else if (status === 'off') {
      buttonLabel = labels.closed || 'Fechado';
    } else {
      buttonLabel = labels.unavailable || 'Indisponivel';
    }

    this.root.innerHTML = `
      <div class="${SOLENOID_CONTROL_CSS_PREFIX}__valve-area">
        <img
          class="${SOLENOID_CONTROL_CSS_PREFIX}__valve-img"
          src="${imageUrl}"
          alt="${this.escapeHtml(buttonLabel)}"
        />
        <button
          class="${SOLENOID_CONTROL_CSS_PREFIX}__action-btn ${SOLENOID_CONTROL_CSS_PREFIX}__action-btn--${config.cssModifier}"
          data-action="toggle"
          ${status === 'offline' ? 'disabled' : ''}
        >
          <span class="${SOLENOID_CONTROL_CSS_PREFIX}__btn-icon">${config.icon}</span>
          <span>${this.escapeHtml(buttonLabel)}</span>
        </button>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest('[data-action]')?.getAttribute('data-action');
      if (action === 'toggle' && this.state.status !== 'offline') {
        this.onToggleClick?.();
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

  public updateState(newState: Partial<SolenoidState>): void {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  public getState(): SolenoidState {
    return { ...this.state };
  }

  public setThemeMode(mode: SolenoidThemeMode): void {
    this.settings.themeMode = mode;
    this.root.className = this.getRootClassName();
    this.applyBackgroundColor();
  }

  public showModal(
    type: 'success' | 'warning' | 'error' | 'confirm',
    message: string,
    onConfirm?: () => void,
  ): void {
    // Remove any existing modal overlay to prevent stacking
    document.querySelectorAll(`.${SOLENOID_CONTROL_CSS_PREFIX}__modal-overlay`).forEach(el => el.remove());

    const modal = document.createElement('div');
    modal.className = `${SOLENOID_CONTROL_CSS_PREFIX}__modal-overlay`;

    const isConfirm = type === 'confirm';
    const modalClass = isConfirm ? '' : `${SOLENOID_CONTROL_CSS_PREFIX}__modal--${type}`;
    const { labels } = this.settings;

    modal.innerHTML = `
      <div class="${SOLENOID_CONTROL_CSS_PREFIX}__modal-backdrop"></div>
      <div class="${SOLENOID_CONTROL_CSS_PREFIX}__modal ${modalClass}">
        <p class="${SOLENOID_CONTROL_CSS_PREFIX}__modal-message">${message}</p>
        <div class="${SOLENOID_CONTROL_CSS_PREFIX}__modal-actions">
          ${isConfirm ? `
            <button class="${SOLENOID_CONTROL_CSS_PREFIX}__modal-btn ${SOLENOID_CONTROL_CSS_PREFIX}__modal-btn--confirm" data-modal-action="confirm">
              ${this.escapeHtml(labels.confirmYes || 'Sim')}
            </button>
            <button class="${SOLENOID_CONTROL_CSS_PREFIX}__modal-btn ${SOLENOID_CONTROL_CSS_PREFIX}__modal-btn--cancel" data-modal-action="cancel">
              ${this.escapeHtml(labels.confirmNo || 'Nao')}
            </button>
          ` : `
            <button class="${SOLENOID_CONTROL_CSS_PREFIX}__modal-btn ${SOLENOID_CONTROL_CSS_PREFIX}__modal-btn--close" data-modal-action="close">
              Fechar
            </button>
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

    modal.querySelector(`.${SOLENOID_CONTROL_CSS_PREFIX}__modal-backdrop`)?.addEventListener('click', closeModal);

    document.body.appendChild(modal);

    if (!isConfirm) {
      setTimeout(closeModal, 2000);
    }
  }

  public destroy(): void {
    this.root.remove();
  }
}
