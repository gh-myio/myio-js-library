/**
 * RFC-0172: Switch Control View
 * Visual component for on/off interruptor
 */

import type {
  SwitchControlSettings,
  SwitchState,
  SwitchStatus,
  SwitchThemeMode,
} from './types';
import { DEFAULT_SWITCH_SETTINGS, DEFAULT_SWITCH_STATE } from './types';
import { SWITCH_CONTROL_CSS_PREFIX, injectSwitchControlStyles } from './styles';

export interface SwitchControlViewOptions {
  container: HTMLElement;
  settings?: SwitchControlSettings;
  initialState?: Partial<SwitchState>;
  onToggleClick?: () => void;
}

export class SwitchControlView {
  private container: HTMLElement;
  private settings: Required<SwitchControlSettings>;
  private state: SwitchState;
  private root: HTMLElement;
  private onToggleClick?: () => void;

  constructor(options: SwitchControlViewOptions) {
    this.container = options.container;
    this.settings = {
      ...DEFAULT_SWITCH_SETTINGS,
      ...options.settings,
      labels: {
        ...DEFAULT_SWITCH_SETTINGS.labels,
        ...options.settings?.labels,
      },
    };
    this.state = { ...DEFAULT_SWITCH_STATE, ...options.initialState };
    this.onToggleClick = options.onToggleClick;

    injectSwitchControlStyles();

    this.root = document.createElement('div');
    this.root.className = this.getRootClassName();
    this.applyBackgroundColor();

    this.render();
    this.container.appendChild(this.root);
  }

  private getRootClassName(): string {
    const classes = [SWITCH_CONTROL_CSS_PREFIX];

    // Theme
    if (this.settings.themeMode === 'dark') {
      classes.push(`${SWITCH_CONTROL_CSS_PREFIX}--dark`);
    }

    // Status
    classes.push(`${SWITCH_CONTROL_CSS_PREFIX}--${this.state.status}`);

    // Loading
    if (this.state.isLoading) {
      classes.push(`${SWITCH_CONTROL_CSS_PREFIX}--loading`);
    }

    return classes.join(' ');
  }

  private applyBackgroundColor(): void {
    if (this.settings.backgroundColor) {
      this.root.style.backgroundColor = this.settings.backgroundColor;
    }
  }

  private getStatusLabel(): string {
    const { status } = this.state;
    const { labels } = this.settings;

    if (status === 'on') return labels.on || 'Ligado';
    if (status === 'off') return labels.off || 'Desligado';
    return labels.offline || 'Indisponivel';
  }

  private getStatusIcon(): string {
    const { status } = this.state;
    if (status === 'on') return '💡';
    if (status === 'off') return '🔌';
    return '⚠️';
  }

  private render(): void {
    const { name } = this.state;
    const statusLabel = this.getStatusLabel();
    const statusIcon = this.getStatusIcon();

    this.root.className = this.getRootClassName();

    this.root.innerHTML = `
      <div class="${SWITCH_CONTROL_CSS_PREFIX}__toggle"></div>
      <div class="${SWITCH_CONTROL_CSS_PREFIX}__info">
        <span class="${SWITCH_CONTROL_CSS_PREFIX}__name">${this.escapeHtml(name)}</span>
        <span class="${SWITCH_CONTROL_CSS_PREFIX}__status">${this.escapeHtml(statusLabel)}</span>
      </div>
      <span class="${SWITCH_CONTROL_CSS_PREFIX}__icon">${statusIcon}</span>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.root.addEventListener('click', (e) => {
      if (this.state.status === 'offline' || this.state.isLoading) return;
      e.preventDefault();
      e.stopPropagation();
      this.onToggleClick?.();
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

  public updateState(newState: Partial<SwitchState>): void {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  public getState(): SwitchState {
    return { ...this.state };
  }

  public setThemeMode(mode: SwitchThemeMode): void {
    this.settings.themeMode = mode;
    this.root.className = this.getRootClassName();
    this.applyBackgroundColor();
  }

  public showConfirmationModal(
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    // Remove existing modals
    document.querySelectorAll(`.${SWITCH_CONTROL_CSS_PREFIX}__modal-overlay`).forEach(el => el.remove());

    const { labels } = this.settings;
    const newStatus = this.state.status === 'on' ? 'off' : 'on';
    const icon = newStatus === 'on' ? '💡' : '🔌';

    const modal = document.createElement('div');
    modal.className = `${SWITCH_CONTROL_CSS_PREFIX}__modal-overlay`;
    modal.innerHTML = `
      <div class="${SWITCH_CONTROL_CSS_PREFIX}__modal">
        <div class="${SWITCH_CONTROL_CSS_PREFIX}__modal-icon">${icon}</div>
        <h3 class="${SWITCH_CONTROL_CSS_PREFIX}__modal-title">${this.escapeHtml(this.state.name)}</h3>
        <p class="${SWITCH_CONTROL_CSS_PREFIX}__modal-message">${message}</p>
        <div class="${SWITCH_CONTROL_CSS_PREFIX}__modal-actions">
          <button class="${SWITCH_CONTROL_CSS_PREFIX}__modal-btn ${SWITCH_CONTROL_CSS_PREFIX}__modal-btn--cancel" data-action="cancel">
            ${this.escapeHtml(labels.confirmNo || 'Nao')}
          </button>
          <button class="${SWITCH_CONTROL_CSS_PREFIX}__modal-btn ${SWITCH_CONTROL_CSS_PREFIX}__modal-btn--confirm" data-action="confirm">
            ${this.escapeHtml(labels.confirmYes || 'Sim')}
          </button>
        </div>
      </div>
    `;

    const closeModal = () => modal.remove();

    modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');

      if (action === 'cancel') {
        closeModal();
        onCancel?.();
      } else if (action === 'confirm') {
        closeModal();
        onConfirm();
      } else if (target === modal) {
        // Click on backdrop
        closeModal();
        onCancel?.();
      }
    });

    document.body.appendChild(modal);
  }

  public showToast(type: 'success' | 'error', message: string): void {
    // Remove existing toasts
    document.querySelectorAll(`.${SWITCH_CONTROL_CSS_PREFIX}__toast`).forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = `${SWITCH_CONTROL_CSS_PREFIX}__toast ${SWITCH_CONTROL_CSS_PREFIX}__toast--${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  public destroy(): void {
    // Remove any modals/toasts
    document.querySelectorAll(`.${SWITCH_CONTROL_CSS_PREFIX}__modal-overlay`).forEach(el => el.remove());
    document.querySelectorAll(`.${SWITCH_CONTROL_CSS_PREFIX}__toast`).forEach(el => el.remove());
    this.root.remove();
  }
}
