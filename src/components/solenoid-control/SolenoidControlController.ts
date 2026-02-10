/**
 * RFC-0158: Solenoid Control Controller
 * Migrated from acionamento-solenoide-com-on-off
 */

import type {
  SolenoidControlParams,
  SolenoidControlInstance,
  SolenoidControlSettings,
  SolenoidState,
  SolenoidStatus,
  SolenoidThemeMode,
} from './types';
import { DEFAULT_SOLENOID_SETTINGS, DEFAULT_SOLENOID_STATE } from './types';
import { SolenoidControlView } from './SolenoidControlView';

export class SolenoidControlController {
  private view: SolenoidControlView;
  private settings: Required<SolenoidControlSettings>;
  private state: SolenoidState;

  private onToggle?: (
    currentStatus: SolenoidStatus,
    deviceName: string,
    relatedDevices: string[],
  ) => Promise<boolean> | boolean;
  private onConfirmAction?: (title: string, message: string) => Promise<boolean>;
  private onNotify?: (type: 'success' | 'warning' | 'error', message: string) => void;
  private isToggling = false;

  constructor(container: HTMLElement, params: SolenoidControlParams) {
    this.settings = {
      ...DEFAULT_SOLENOID_SETTINGS,
      ...params.settings,
      labels: {
        ...DEFAULT_SOLENOID_SETTINGS.labels,
        ...params.settings?.labels,
      },
    };
    this.state = { ...DEFAULT_SOLENOID_STATE, ...params.initialState };

    this.onToggle = params.onToggle;
    this.onConfirmAction = params.onConfirmAction;
    this.onNotify = params.onNotify;

    this.view = new SolenoidControlView({
      container,
      settings: this.settings,
      initialState: this.state,
      onToggleClick: () => this.handleToggle(),
    });
  }

  private async handleToggle(): Promise<void> {
    if (this.isToggling) return; // Prevent rapid re-entry
    const { status, deviceName, relatedDevices } = this.state;
    if (status === 'offline') return;
    this.isToggling = true;

    const newStatus: SolenoidStatus = status === 'on' ? 'off' : 'on';
    const { labels } = this.settings;
    const confirmMessage = labels.confirmMessage || 'Deseja alterar o estado do solenoide?';

    // Show confirmation
    if (this.onConfirmAction) {
      const confirmed = await this.onConfirmAction('Confirmar', confirmMessage);
      if (!confirmed) { this.isToggling = false; return; }
    } else {
      const confirmed = await this.showConfirmModal(confirmMessage);
      if (!confirmed) { this.isToggling = false; return; }
    }

    // Call toggle callback
    if (this.onToggle) {
      try {
        const success = await this.onToggle(status, deviceName, relatedDevices);
        if (success) {
          this.state.status = newStatus;
          this.view.updateState({ status: newStatus });
          const label = newStatus === 'on'
            ? (labels.open || 'Aberto')
            : (labels.closed || 'Fechado');
          this.notify('success', `Solenoide ${label} com sucesso!`);
        } else {
          this.notify('error', 'Erro ao enviar status');
        }
      } catch (error) {
        if (this.settings.enableDebugMode) {
          console.error('[SolenoidControlController] Error toggling:', error);
        }
        this.notify('error', 'Erro ao enviar status');
      }
    } else {
      // No callback — just update state locally
      this.state.status = newStatus;
      this.view.updateState({ status: newStatus });
      const label = newStatus === 'on'
        ? (labels.open || 'Aberto')
        : (labels.closed || 'Fechado');
      this.notify('success', `Solenoide ${label} com sucesso!`);
    }
    this.isToggling = false;
  }

  private notify(type: 'success' | 'warning' | 'error', message: string): void {
    if (this.onNotify) {
      this.onNotify(type, message);
    } else {
      this.view.showModal(type, message);
    }
  }

  private showConfirmModal(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      this.view.showModal('confirm', message, () => {
        if (!resolved) { resolved = true; resolve(true); }
      });
      // If modal is closed without confirm, resolve false after a delay
      setTimeout(() => { if (!resolved) { resolved = true; resolve(false); } }, 30000);
    });
  }

  // Public API

  public getElement(): HTMLElement {
    return this.view.getElement();
  }

  public updateState(newState: Partial<SolenoidState>): void {
    this.state = { ...this.state, ...newState };
    this.view.updateState(newState);
  }

  public getState(): SolenoidState {
    return { ...this.state };
  }

  public setThemeMode(mode: SolenoidThemeMode): void {
    this.settings.themeMode = mode;
    this.view.setThemeMode(mode);
  }

  public getThemeMode(): SolenoidThemeMode {
    return this.settings.themeMode;
  }

  public destroy(): void {
    this.view.destroy();
  }
}

/**
 * Factory function to create a Solenoid Control component
 *
 * @example
 * ```typescript
 * import { createSolenoidControl } from 'myio-js-library';
 *
 * const solenoid = createSolenoidControl(container, {
 *   settings: { centralId: 'my-central', themeMode: 'dark' },
 *   initialState: { status: 'on', deviceName: 'Solenoide 01' },
 *   onToggle: async (currentStatus, deviceName, relatedDevices) => {
 *     // Call API to toggle solenoid
 *     return true;
 *   },
 * });
 *
 * // Update from telemetry
 * solenoid.updateState({ status: 'off' });
 *
 * // Clean up
 * solenoid.destroy();
 * ```
 */
export function createSolenoidControl(
  container: HTMLElement,
  params: SolenoidControlParams = {},
): SolenoidControlInstance {
  const controller = new SolenoidControlController(container, params);

  return {
    element: controller.getElement(),
    updateState: (state) => controller.updateState(state),
    getState: () => controller.getState(),
    setThemeMode: (mode) => controller.setThemeMode(mode),
    destroy: () => controller.destroy(),
  };
}
