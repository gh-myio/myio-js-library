/**
 * RFC-0158: Action Button View
 * Migrated from action-button widget
 */

import type { ActionButtonSettings, ActionButtonThemeMode } from './types';
import { DEFAULT_ACTION_BUTTON_SETTINGS } from './types';
import { ACTION_BUTTON_CSS_PREFIX, injectActionButtonStyles } from './styles';

export interface ActionButtonViewOptions {
  container: HTMLElement;
  settings?: ActionButtonSettings;
  onClick?: () => void;
}

export class ActionButtonView {
  private container: HTMLElement;
  private settings: Required<ActionButtonSettings>;
  private root: HTMLButtonElement;
  private onClick?: () => void;

  constructor(options: ActionButtonViewOptions) {
    this.container = options.container;
    this.settings = { ...DEFAULT_ACTION_BUTTON_SETTINGS, ...options.settings };
    this.onClick = options.onClick;

    injectActionButtonStyles();

    this.root = document.createElement('button');
    this.root.type = 'button';
    this.applyAll();
    this.bindEvents();

    this.container.appendChild(this.root);
  }

  private buildClassName(): string {
    const { themeMode, variant, size, fullWidth } = this.settings;
    const classes = [
      ACTION_BUTTON_CSS_PREFIX,
      `${ACTION_BUTTON_CSS_PREFIX}--${variant}`,
      `${ACTION_BUTTON_CSS_PREFIX}--${size}`,
    ];
    if (themeMode === 'dark') {
      classes.push(`${ACTION_BUTTON_CSS_PREFIX}--dark`);
    }
    if (fullWidth) {
      classes.push(`${ACTION_BUTTON_CSS_PREFIX}--full-width`);
    }
    return classes.join(' ');
  }

  private applyAll(): void {
    const { label, icon, variant, color, textColor, borderRadius, disabled, tooltip } = this.settings;

    this.root.className = this.buildClassName();
    this.root.disabled = disabled;
    this.root.style.borderRadius = `${borderRadius}px`;
    this.root.title = tooltip;

    // Apply colors
    if (variant === 'filled') {
      this.root.style.backgroundColor = color;
      this.root.style.color = textColor || '#ffffff';
    } else {
      this.root.style.backgroundColor = '';
      this.root.style.color = textColor || color;
    }

    // Build inner HTML
    let html = '';
    if (icon) {
      html += `<span class="${ACTION_BUTTON_CSS_PREFIX}__icon">${this.escapeHtml(icon)}</span>`;
    }
    if (label) {
      html += `<span>${this.escapeHtml(label)}</span>`;
    }
    this.root.innerHTML = html;
  }

  private bindEvents(): void {
    this.root.addEventListener('click', () => {
      if (!this.settings.disabled) {
        this.onClick?.();
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

  public updateSettings(newSettings: Partial<ActionButtonSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.applyAll();
  }

  public getSettings(): Required<ActionButtonSettings> {
    return { ...this.settings };
  }

  public setThemeMode(mode: ActionButtonThemeMode): void {
    this.settings.themeMode = mode;
    this.root.className = this.buildClassName();
  }

  public setDisabled(disabled: boolean): void {
    this.settings.disabled = disabled;
    this.root.disabled = disabled;
  }

  public destroy(): void {
    this.root.remove();
  }
}
