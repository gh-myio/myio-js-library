/**
 * RFC-0167: On/Off Device Modal Controller
 * Handles modal lifecycle and state management
 */

import { createModal } from '../internal/ModalPremiumShell';
import { OnOffDeviceModalView } from './OnOffDeviceModalView';
import { getDeviceConfig, getModalTitle } from './deviceConfig';
import type {
  OnOffDeviceModalParams,
  OnOffDeviceModalInstance,
  OnOffDeviceData,
  OnOffDeviceThemeMode,
  OnOffScheduleEntry,
  DeviceTypeConfig,
} from './types';

export class OnOffDeviceModalController {
  private modal: ReturnType<typeof createModal> | null = null;
  private view: OnOffDeviceModalView | null = null;
  private params: OnOffDeviceModalParams;
  private deviceConfig: DeviceTypeConfig;
  private closeHandlers: (() => void)[] = [];

  constructor(params: OnOffDeviceModalParams) {
    this.params = this.normalizeParams(params);
    this.deviceConfig = getDeviceConfig(params.device.deviceProfile);

    if (params.enableDebugMode) {
      console.log('[OnOffDeviceModal] Initialized with params:', {
        deviceId: params.device.id,
        deviceProfile: params.device.deviceProfile,
        deviceType: params.deviceType,
        themeMode: params.themeMode,
      });
    }
  }

  private normalizeParams(params: OnOffDeviceModalParams): Required<OnOffDeviceModalParams> {
    return {
      container: params.container || document.body,
      device: params.device,
      deviceType: params.deviceType || 'generic',
      themeMode: params.themeMode || 'light',
      jwtToken: params.jwtToken || '',
      tbBaseUrl: params.tbBaseUrl || '',
      onClose: params.onClose || (() => {}),
      onStateChange: params.onStateChange || (() => {}),
      onScheduleSave: params.onScheduleSave || (() => {}),
      centralId: params.centralId || '',
      enableDebugMode: params.enableDebugMode || false,
    };
  }

  /**
   * Show the modal
   */
  public show(): OnOffDeviceModalInstance {
    const deviceName = this.params.device.label || this.params.device.name || 'Dispositivo';
    const title = getModalTitle(this.params.device.deviceProfile, deviceName);

    // Create modal shell
    this.modal = createModal({
      title,
      width: '80vw',
      height: '80vh',
      theme: this.params.themeMode,
      closeOnBackdrop: true,
      closeOnEscape: true,
    });

    // Create view inside modal body
    this.view = new OnOffDeviceModalView({
      container: this.modal.element,
      device: this.params.device,
      themeMode: this.params.themeMode,
      deviceConfig: this.deviceConfig,
      onToggleView: () => this.handleToggleView(),
      onDeviceToggle: (newState) => this.handleDeviceToggle(newState),
      onScheduleSave: (schedules) => this.handleScheduleSave(schedules),
    });

    // Handle modal close
    this.modal.on('close', () => this.handleClose());

    if (this.params.enableDebugMode) {
      console.log('[OnOffDeviceModal] Modal shown');
    }

    return {
      element: this.modal.element,
      destroy: () => this.destroy(),
      close: () => this.close(),
      setTheme: (mode) => this.setTheme(mode),
      updateDeviceState: (state) => this.updateDeviceState(state),
    };
  }

  private handleToggleView(): void {
    if (this.view) {
      this.view.toggleView();

      if (this.params.enableDebugMode) {
        console.log('[OnOffDeviceModal] View toggled to:', this.view.getCurrentView());
      }
    }
  }

  private async handleDeviceToggle(newState: boolean): Promise<void> {
    if (this.params.enableDebugMode) {
      console.log('[OnOffDeviceModal] Device toggle requested:', newState);
    }

    try {
      // Send RPC command to device
      await this.sendDeviceCommand(newState);

      // Update view
      if (this.view) {
        this.view.updateDeviceState(newState);
      }

      // Notify callback
      this.params.onStateChange?.(this.params.device.id, newState);
    } catch (error) {
      console.error('[OnOffDeviceModal] Failed to toggle device:', error);
    }
  }

  private async sendDeviceCommand(state: boolean): Promise<void> {
    if (!this.params.jwtToken || !this.params.device.id) {
      console.warn('[OnOffDeviceModal] Missing jwtToken or deviceId, skipping RPC command');
      return;
    }

    const deviceId = this.params.device.entityId || this.params.device.id;

    // Build RPC command based on device type
    const rpcMethod = 'setValueOutput';
    const rpcParams = {
      value: state ? 1 : 0,
      // Some devices expect specific parameters
      output: 1,
    };

    try {
      const response = await fetch(`/api/plugins/rpc/twoway/${deviceId}`, {
        method: 'POST',
        headers: {
          'X-Authorization': `Bearer ${this.params.jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: rpcMethod,
          params: rpcParams,
          timeout: 5000,
        }),
      });

      if (!response.ok) {
        throw new Error(`RPC failed with status ${response.status}`);
      }

      const result = await response.json();
      if (this.params.enableDebugMode) {
        console.log('[OnOffDeviceModal] RPC response:', result);
      }
    } catch (error) {
      console.error('[OnOffDeviceModal] RPC error:', error);
      throw error;
    }
  }

  private async handleScheduleSave(schedules: OnOffScheduleEntry[]): Promise<void> {
    if (this.params.enableDebugMode) {
      console.log('[OnOffDeviceModal] Saving schedules:', schedules);
    }

    try {
      // Save schedules to device attributes
      await this.saveSchedulesToDevice(schedules);

      // Notify callback
      this.params.onScheduleSave?.(this.params.device.id, schedules);
    } catch (error) {
      console.error('[OnOffDeviceModal] Failed to save schedules:', error);
    }
  }

  private async saveSchedulesToDevice(schedules: OnOffScheduleEntry[]): Promise<void> {
    if (!this.params.jwtToken || !this.params.device.id) {
      console.warn('[OnOffDeviceModal] Missing jwtToken or deviceId, skipping schedule save');
      return;
    }

    const deviceId = this.params.device.entityId || this.params.device.id;

    try {
      const response = await fetch(
        `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`,
        {
          method: 'POST',
          headers: {
            'X-Authorization': `Bearer ${this.params.jwtToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            schedules: JSON.stringify(schedules),
            schedulesLastModified: new Date().toISOString(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save schedules with status ${response.status}`);
      }

      if (this.params.enableDebugMode) {
        console.log('[OnOffDeviceModal] Schedules saved successfully');
      }
    } catch (error) {
      console.error('[OnOffDeviceModal] Error saving schedules:', error);
      throw error;
    }
  }

  private handleClose(): void {
    if (this.params.enableDebugMode) {
      console.log('[OnOffDeviceModal] Modal closing');
    }

    // Trigger close handlers
    this.closeHandlers.forEach((handler) => handler());

    // Trigger callback
    this.params.onClose?.();

    // Cleanup
    this.cleanup();
  }

  /**
   * Register close handler
   */
  public on(event: 'close', handler: () => void): void {
    if (event === 'close') {
      this.closeHandlers.push(handler);
    }
  }

  /**
   * Close the modal
   */
  public close(): void {
    if (this.modal) {
      this.modal.close();
    }
  }

  /**
   * Set theme mode
   */
  public setTheme(mode: OnOffDeviceThemeMode): void {
    if (this.view) {
      this.view.setThemeMode(mode);
    }
  }

  /**
   * Update device state
   */
  public updateDeviceState(state: boolean): void {
    if (this.view) {
      this.view.updateDeviceState(state);
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
    this.modal = null;
    this.closeHandlers = [];
  }

  /**
   * Destroy the modal and cleanup
   */
  public destroy(): void {
    this.close();
    this.cleanup();
  }
}

/**
 * Factory function to create and show the On/Off Device Modal
 */
export function createOnOffDeviceModal(
  params: OnOffDeviceModalParams
): OnOffDeviceModalInstance {
  const controller = new OnOffDeviceModalController(params);
  return controller.show();
}

/**
 * Alternative factory that opens modal directly (convenience function)
 */
export function openOnOffDeviceModal(
  device: OnOffDeviceData,
  options: Omit<OnOffDeviceModalParams, 'device'> = {}
): OnOffDeviceModalInstance {
  return createOnOffDeviceModal({
    ...options,
    device,
  });
}
