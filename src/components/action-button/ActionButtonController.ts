/**
 * RFC-0158: Action Button Controller
 * Migrated from action-button widget
 */

import type {
  ActionButtonParams,
  ActionButtonInstance,
  ActionButtonSettings,
  ActionButtonThemeMode,
} from './types';
import { DEFAULT_ACTION_BUTTON_SETTINGS } from './types';
import { ActionButtonView } from './ActionButtonView';

export class ActionButtonController {
  private view: ActionButtonView;
  private settings: Required<ActionButtonSettings>;
  private onClick?: () => void | Promise<void>;

  constructor(container: HTMLElement, params: ActionButtonParams) {
    this.settings = { ...DEFAULT_ACTION_BUTTON_SETTINGS, ...params.settings };
    this.onClick = params.onClick;

    this.view = new ActionButtonView({
      container,
      settings: this.settings,
      onClick: () => this.handleClick(),
    });
  }

  private handleClick(): void {
    if (this.settings.disabled) return;

    if (this.settings.enableDebugMode) {
      console.log('[ActionButtonController] Button clicked');
    }

    this.onClick?.();
  }

  // Public API

  public getElement(): HTMLElement {
    return this.view.getElement();
  }

  public updateSettings(newSettings: Partial<ActionButtonSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.view.updateSettings(newSettings);
  }

  public getSettings(): Required<ActionButtonSettings> {
    return { ...this.settings };
  }

  public setThemeMode(mode: ActionButtonThemeMode): void {
    this.settings.themeMode = mode;
    this.view.setThemeMode(mode);
  }

  public setDisabled(disabled: boolean): void {
    this.settings.disabled = disabled;
    this.view.setDisabled(disabled);
  }

  public destroy(): void {
    this.view.destroy();
  }
}

/**
 * Factory function to create an Action Button component
 *
 * @example
 * ```typescript
 * import { createActionButton } from 'myio-js-library';
 *
 * const button = createActionButton(container, {
 *   settings: {
 *     label: 'Abrir Relatorio',
 *     icon: '\uD83D\uDCC4',
 *     variant: 'filled',
 *     color: '#2F5848',
 *     size: 'medium',
 *   },
 *   onClick: () => {
 *     console.log('Button clicked');
 *   },
 * });
 *
 * // Update label or color at runtime
 * button.updateSettings({ label: 'Novo Label', disabled: true });
 *
 * // Clean up
 * button.destroy();
 * ```
 */
export function createActionButton(
  container: HTMLElement,
  params: ActionButtonParams = {},
): ActionButtonInstance {
  const controller = new ActionButtonController(container, params);

  return {
    element: controller.getElement(),
    updateSettings: (settings) => controller.updateSettings(settings),
    getSettings: () => controller.getSettings(),
    setThemeMode: (mode) => controller.setThemeMode(mode),
    setDisabled: (disabled) => controller.setDisabled(disabled),
    destroy: () => controller.destroy(),
  };
}
