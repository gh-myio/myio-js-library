/**
 * RFC-0172: Switch Control Controller
 * Manages switch state and toggle logic
 */

import type {
  SwitchControlParams,
  SwitchControlInstance,
  SwitchControlSettings,
  SwitchState,
  SwitchStatus,
  SwitchThemeMode,
} from './types';
import { DEFAULT_SWITCH_SETTINGS, DEFAULT_SWITCH_STATE } from './types';
import { SwitchControlView } from './SwitchControlView';

export class SwitchControlController implements SwitchControlInstance {
  private view: SwitchControlView;
  private settings: Required<SwitchControlSettings>;
  private state: SwitchState;
  private onToggle?: (newStatus: SwitchStatus, state: SwitchState) => Promise<boolean>;

  constructor(container: HTMLElement, params: SwitchControlParams = {}) {
    this.settings = {
      ...DEFAULT_SWITCH_SETTINGS,
      ...params.settings,
      labels: {
        ...DEFAULT_SWITCH_SETTINGS.labels,
        ...params.settings?.labels,
      },
    };

    this.state = {
      ...DEFAULT_SWITCH_STATE,
      ...params.initialState,
    };

    this.onToggle = params.onToggle;

    this.view = new SwitchControlView({
      container,
      settings: this.settings,
      initialState: this.state,
      onToggleClick: () => this.handleToggleClick(),
    });
  }

  private async handleToggleClick(): Promise<void> {
    if (this.state.status === 'offline' || this.state.isLoading) return;

    const newStatus: SwitchStatus = this.state.status === 'on' ? 'off' : 'on';
    const { labels, showConfirmation } = this.settings;

    const performToggle = async () => {
      // Set loading state
      this.state.isLoading = true;
      this.view.updateState({ isLoading: true });

      try {
        let success = true;

        if (this.onToggle) {
          success = await this.onToggle(newStatus, this.state);
        }

        if (success) {
          // Update to new status
          this.state.status = newStatus;
          this.state.isLoading = false;
          this.view.updateState({ status: newStatus, isLoading: false });
          this.view.showToast('success', newStatus === 'on' ? 'Ligado com sucesso' : 'Desligado com sucesso');
        } else {
          // Revert loading state
          this.state.isLoading = false;
          this.view.updateState({ isLoading: false });
          this.view.showToast('error', 'Falha ao executar comando');
        }
      } catch (error) {
        console.error('[SwitchControl] Toggle error:', error);
        this.state.isLoading = false;
        this.view.updateState({ isLoading: false });
        this.view.showToast('error', 'Erro ao executar comando');
      }
    };

    if (showConfirmation) {
      const message = newStatus === 'on'
        ? (labels.confirmOn || 'Deseja LIGAR este interruptor?')
        : (labels.confirmOff || 'Deseja DESLIGAR este interruptor?');

      this.view.showConfirmationModal(message, performToggle);
    } else {
      await performToggle();
    }
  }

  // Public interface implementation

  public getElement(): HTMLElement {
    return this.view.getElement();
  }

  public updateState(newState: Partial<SwitchState>): void {
    this.state = { ...this.state, ...newState };
    this.view.updateState(newState);
  }

  public getState(): SwitchState {
    return { ...this.state };
  }

  public setThemeMode(mode: SwitchThemeMode): void {
    this.settings.themeMode = mode;
    this.view.setThemeMode(mode);
  }

  public destroy(): void {
    this.view.destroy();
  }
}

/**
 * Factory function to create a switch control instance
 *
 * @example
 * ```typescript
 * const switchCtrl = createSwitchControl(container, {
 *   settings: { themeMode: 'dark' },
 *   initialState: { status: 'on', name: 'Luz Sala', id: 'device-123' },
 *   onToggle: async (newStatus, state) => {
 *     const response = await api.sendCommand(state.id, newStatus);
 *     return response.success;
 *   },
 * });
 *
 * // Update from external data
 * switchCtrl.updateState({ status: 'off' });
 *
 * // Cleanup
 * switchCtrl.destroy();
 * ```
 */
export function createSwitchControl(
  container: HTMLElement,
  params: SwitchControlParams = {}
): SwitchControlInstance {
  return new SwitchControlController(container, params);
}
