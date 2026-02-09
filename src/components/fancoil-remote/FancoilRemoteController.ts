/**
 * RFC-0158: Fancoil Remote Control Controller
 * Migrated from remote-version-fancoil-widget-v1.0.0
 */

import type {
  FancoilRemoteParams,
  FancoilRemoteInstance,
  FancoilRemoteSettings,
  FancoilState,
  FancoilThemeMode,
  FancoilStatus,
} from './types';
import { DEFAULT_FANCOIL_SETTINGS, DEFAULT_FANCOIL_STATE } from './types';
import { FancoilRemoteView } from './FancoilRemoteView';

// Debounce utility
function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export class FancoilRemoteController {
  private view: FancoilRemoteView;
  private settings: Required<FancoilRemoteSettings>;
  private state: FancoilState;
  private debouncedTemperatureChange: (temp: number) => void;

  private onPowerToggle?: (currentStatus: FancoilStatus) => Promise<boolean> | boolean;
  private onTemperatureChange?: (newTemperature: number) => Promise<boolean> | boolean;
  private onSettingsClick?: () => void;
  private onConfirmAction?: (title: string, message: string) => Promise<boolean>;
  private onNotify?: (type: 'success' | 'warning' | 'error', message: string) => void;

  constructor(container: HTMLElement, params: FancoilRemoteParams) {
    this.settings = {
      ...DEFAULT_FANCOIL_SETTINGS,
      ...params.settings,
      labels: {
        ...DEFAULT_FANCOIL_SETTINGS.labels,
        ...params.settings?.labels,
      },
    };
    this.state = { ...DEFAULT_FANCOIL_STATE, ...params.initialState };

    this.onPowerToggle = params.onPowerToggle;
    this.onTemperatureChange = params.onTemperatureChange;
    this.onSettingsClick = params.onSettingsClick;
    this.onConfirmAction = params.onConfirmAction;
    this.onNotify = params.onNotify;

    // Debounce temperature changes to avoid rapid API calls
    this.debouncedTemperatureChange = debounce((temp: number) => {
      this.handleTemperatureChange(temp);
    }, 500);

    this.view = new FancoilRemoteView({
      container,
      settings: this.settings,
      initialState: this.state,
      onPowerToggle: () => this.handlePowerToggle(),
      onTemperatureIncrease: () => this.handleTemperatureIncrease(),
      onTemperatureDecrease: () => this.handleTemperatureDecrease(),
      onSettingsClick: () => this.onSettingsClick?.(),
    });
  }

  private async handlePowerToggle(): Promise<void> {
    const currentStatus = this.state.status;
    if (currentStatus === 'offline') return;

    const newStatus: FancoilStatus = currentStatus === 'on' ? 'off' : 'on';
    const actionText = newStatus === 'on' ? 'LIGAR' : 'DESLIGAR';

    // Show confirmation if callback provided
    if (this.onConfirmAction) {
      const confirmed = await this.onConfirmAction(
        'Confirmar acao',
        `Tem certeza que deseja <b>${actionText}</b> o dispositivo?`
      );
      if (!confirmed) return;
    } else {
      // Use built-in confirmation
      const confirmed = await this.showConfirmModal(
        'Confirmar acao',
        `Tem certeza que deseja <b>${actionText}</b> o dispositivo?`
      );
      if (!confirmed) return;
    }

    // Call the callback if provided
    if (this.onPowerToggle) {
      try {
        const success = await this.onPowerToggle(currentStatus);
        if (success) {
          this.state.status = newStatus;
          this.view.updateState({ status: newStatus });
          this.notify('success', `Sistema ${newStatus === 'on' ? 'ligado' : 'desligado'} com sucesso!`);
        } else {
          this.notify('error', 'Falha ao enviar comando para o equipamento.');
        }
      } catch (error) {
        console.error('[FancoilRemoteController] Error toggling power:', error);
        this.notify('error', 'Falha ao enviar comando para o equipamento.');
      }
    } else {
      // No callback, just update state
      this.state.status = newStatus;
      this.view.updateState({ status: newStatus });
      this.notify('success', `Sistema ${newStatus === 'on' ? 'ligado' : 'desligado'} com sucesso!`);
    }
  }

  private handleTemperatureIncrease(): void {
    if (!this.state.isSetpointEnabled || this.state.temperatureSetpoint === null) return;

    const currentTemp = this.state.temperatureSetpoint;
    if (currentTemp >= this.settings.maxTemperature) return;

    const newTemp = currentTemp + 1;
    this.state.temperatureSetpoint = newTemp;
    this.view.updateState({ temperatureSetpoint: newTemp });

    this.notify('success', 'Enviando novo setpoint de aumento de temperatura! Aguarde!');
    this.debouncedTemperatureChange(newTemp);
  }

  private handleTemperatureDecrease(): void {
    if (!this.state.isSetpointEnabled || this.state.temperatureSetpoint === null) return;

    const currentTemp = this.state.temperatureSetpoint;
    if (currentTemp <= this.settings.minTemperature) return;

    const newTemp = currentTemp - 1;
    this.state.temperatureSetpoint = newTemp;
    this.view.updateState({ temperatureSetpoint: newTemp });

    this.notify('success', 'Enviando novo setpoint de diminuicao de temperatura! Aguarde!');
    this.debouncedTemperatureChange(newTemp);
  }

  private async handleTemperatureChange(temperature: number): Promise<void> {
    if (this.onTemperatureChange) {
      try {
        const success = await this.onTemperatureChange(temperature);
        if (success) {
          this.notify('success', 'Ajuste em temperatura feito com sucesso!');
        } else {
          this.notify('error', 'Erro ao definir temperatura');
        }
      } catch (error) {
        console.error('[FancoilRemoteController] Error changing temperature:', error);
        this.notify('error', 'Erro ao definir temperatura');
      }
    }
  }

  private notify(type: 'success' | 'warning' | 'error', message: string): void {
    if (this.onNotify) {
      this.onNotify(type, message);
    } else {
      const icons = {
        success: ' Sucesso',
        warning: ' Atencao',
        error: ' Erro',
      };
      this.view.showModal(type, icons[type], message);
    }
  }

  private showConfirmModal(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.view.showModal('confirm', title, message, () => resolve(true));
      // If modal is closed without confirm, resolve false after a delay
      setTimeout(() => resolve(false), 30000);
    });
  }

  // Public API

  public getElement(): HTMLElement {
    return this.view.getElement();
  }

  public updateState(newState: Partial<FancoilState>): void {
    this.state = { ...this.state, ...newState };
    this.view.updateState(newState);
  }

  public getState(): FancoilState {
    return { ...this.state };
  }

  public setThemeMode(mode: FancoilThemeMode): void {
    this.settings.themeMode = mode;
    this.view.setThemeMode(mode);
  }

  public getThemeMode(): FancoilThemeMode {
    return this.settings.themeMode;
  }

  public destroy(): void {
    this.view.destroy();
  }
}

/**
 * Factory function to create a Fancoil Remote Control component
 */
export function createFancoilRemote(
  container: HTMLElement,
  params: FancoilRemoteParams = {}
): FancoilRemoteInstance {
  const controller = new FancoilRemoteController(container, params);

  return {
    element: controller.getElement(),
    updateState: (state) => controller.updateState(state),
    getState: () => controller.getState(),
    setThemeMode: (mode) => controller.setThemeMode(mode),
    destroy: () => controller.destroy(),
  };
}
