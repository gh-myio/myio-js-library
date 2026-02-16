/**
 * RFC-0167: On/Off Device Modal Controller
 * Handles modal lifecycle and state management
 * Uses ModalHeader pattern for consistent styling
 */

import { ModalHeader } from '../../../utils/ModalHeader';
import { CSS_TOKENS } from '../internal/styles/tokens';
import { OnOffDeviceModalView } from './OnOffDeviceModalView';
import { getDeviceConfig, getModalTitle } from './deviceConfig';
import { ON_OFF_MODAL_CSS_PREFIX, injectOnOffDeviceModalStyles } from './styles';
import type {
  OnOffDeviceModalParams,
  OnOffDeviceModalInstance,
  OnOffDeviceData,
  OnOffDeviceThemeMode,
  OnOffScheduleEntry,
  DeviceTypeConfig,
} from './types';

interface ModalState {
  theme: OnOffDeviceThemeMode;
  isMaximized: boolean;
  deviceConfig: DeviceTypeConfig;
}

export class OnOffDeviceModalController {
  private modalContainer: HTMLElement | null = null;
  private view: OnOffDeviceModalView | null = null;
  private params: Required<OnOffDeviceModalParams>;
  private state: ModalState;
  private modalId: string;

  constructor(params: OnOffDeviceModalParams) {
    this.params = this.normalizeParams(params);
    this.modalId = `onoff-modal-${Date.now()}`;
    this.state = {
      theme: this.params.themeMode,
      isMaximized: false,
      deviceConfig: getDeviceConfig(params.device.deviceProfile),
    };

    if (params.enableDebugMode) {
      console.log('[OnOffDeviceModal] Initialized with params:', {
        deviceId: params.device.id,
        deviceProfile: params.device.deviceProfile,
        themeMode: params.themeMode,
      });
    }
  }

  private normalizeParams(params: OnOffDeviceModalParams): Required<OnOffDeviceModalParams> {
    return {
      container: params.container || document.body,
      device: params.device,
      deviceType: params.deviceType || 'generic',
      themeMode: params.themeMode || 'light', // Default to light
      jwtToken: params.jwtToken || '',
      tbBaseUrl: params.tbBaseUrl || '',
      onClose: params.onClose || (() => {}),
      onStateChange: params.onStateChange || (() => {}),
      onScheduleSave: params.onScheduleSave || (() => {}),
      centralId: params.centralId || '',
      enableDebugMode: params.enableDebugMode || false,
      onRefresh: params.onRefresh || (() => {}),
      onDateRangeChange: params.onDateRangeChange || (() => {}),
    };
  }

  /**
   * Show the modal
   */
  public show(): OnOffDeviceModalInstance {
    injectOnOffDeviceModalStyles();
    this.injectModalStyles();

    // Create modal container
    this.modalContainer = document.createElement('div');
    this.modalContainer.id = this.modalId;
    document.body.appendChild(this.modalContainer);

    // Render modal
    this.renderModal();

    // Setup event listeners
    this.setupEventListeners();

    if (this.params.enableDebugMode) {
      console.log('[OnOffDeviceModal] Modal shown');
    }

    return {
      element: this.modalContainer,
      destroy: () => this.destroy(),
      close: () => this.close(),
      setTheme: (mode) => this.setTheme(mode),
      updateDeviceState: (state) => this.updateDeviceState(state),
    };
  }

  private injectModalStyles(): void {
    const styleId = `${ON_OFF_MODAL_CSS_PREFIX}-modal-styles`;
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = CSS_TOKENS + `
      .${ON_OFF_MODAL_CSS_PREFIX}-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9998;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(2px);
      }

      .${ON_OFF_MODAL_CSS_PREFIX}-content {
        background: var(--myio-surface, #ffffff);
        border-radius: 10px;
        max-width: 1000px;
        width: 95%;
        max-height: 90vh;
        height: auto;
        min-height: 824px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: 'Roboto', 'Segoe UI', Arial, sans-serif;
      }

      .${ON_OFF_MODAL_CSS_PREFIX}-content.maximized {
        max-width: 100%;
        width: 100%;
        max-height: 100vh;
        height: 100%;
        border-radius: 0;
      }

      .${ON_OFF_MODAL_CSS_PREFIX}-body {
        flex: 1;
        overflow: hidden;
        display: flex;
      }

      /* Dark theme */
      .${ON_OFF_MODAL_CSS_PREFIX}-overlay[data-theme="dark"] .${ON_OFF_MODAL_CSS_PREFIX}-content {
        background: #1f2937;
        color: #f3f4f6;
      }
    `;
    document.head.appendChild(style);
  }

  private renderModal(): void {
    if (!this.modalContainer) return;

    const deviceName = this.params.device.label || this.params.device.name || 'Dispositivo';
    const title = getModalTitle(this.params.device.deviceProfile, deviceName);
    const isMaximized = this.state.isMaximized;

    this.modalContainer.innerHTML = `
      <div class="${ON_OFF_MODAL_CSS_PREFIX}-overlay myio-modal-scope" data-theme="${this.state.theme}">
        <div class="${ON_OFF_MODAL_CSS_PREFIX}-content ${isMaximized ? 'maximized' : ''}">
          <!-- Header via ModalHeader -->
          ${ModalHeader.generateInlineHTML({
            icon: this.state.deviceConfig.icon,
            title: title,
            modalId: this.modalId,
            theme: this.state.theme,
            isMaximized: isMaximized,
            showThemeToggle: true,
            showMaximize: true,
            showClose: true,
            primaryColor: this.state.deviceConfig.controlColor || '#3b82f6',
            borderRadius: isMaximized ? '0' : '10px 10px 0 0',
          })}

          <!-- Body -->
          <div class="${ON_OFF_MODAL_CSS_PREFIX}-body" id="${this.modalId}-body">
          </div>
        </div>
      </div>
    `;

    // Create view inside body
    const bodyContainer = document.getElementById(`${this.modalId}-body`);
    if (bodyContainer) {
      // Destroy previous view if exists
      if (this.view) {
        this.view.destroy();
      }

      this.view = new OnOffDeviceModalView({
        container: bodyContainer,
        device: this.params.device,
        themeMode: this.state.theme,
        deviceConfig: this.state.deviceConfig,
        onToggleView: () => this.handleToggleView(),
        onDeviceToggle: (newState) => this.handleDeviceToggle(newState),
        onScheduleSave: (schedules) => this.handleScheduleSave(schedules),
        onRefresh: () => this.handleRefresh(),
        onDateRangeChange: (startISO, endISO) => this.handleDateRangeChange(startISO, endISO),
        parentEl: this.modalContainer?.querySelector(`.${ON_OFF_MODAL_CSS_PREFIX}-content`) as HTMLElement || undefined,
        jwtToken: this.params.jwtToken,
      });
    }
  }

  private setupEventListeners(): void {
    if (!this.modalContainer) return;

    // Close on overlay click
    const overlay = this.modalContainer.querySelector(`.${ON_OFF_MODAL_CSS_PREFIX}-overlay`);
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Close button
    document.getElementById(`${this.modalId}-close`)?.addEventListener('click', () => {
      this.close();
    });

    // Theme toggle
    document.getElementById(`${this.modalId}-theme-toggle`)?.addEventListener('click', () => {
      this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
      this.renderModal();
      this.setupEventListeners();
    });

    // Maximize toggle
    document.getElementById(`${this.modalId}-maximize`)?.addEventListener('click', () => {
      this.state.isMaximized = !this.state.isMaximized;
      this.renderModal();
      this.setupEventListeners();
    });

    // Escape key to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
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

  private async handleRefresh(): Promise<void> {
    if (this.params.enableDebugMode) {
      console.log('[OnOffDeviceModal] Refresh requested');
    }

    try {
      // Notify external callback
      this.params.onRefresh?.(this.params.device.id);

      // If we have a JWT token, try to fetch latest device state
      if (this.params.jwtToken && this.params.device.id) {
        const deviceId = this.params.device.entityId || this.params.device.id;
        const response = await fetch(
          `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/CLIENT_SCOPE,SHARED_SCOPE,SERVER_SCOPE`,
          {
            method: 'GET',
            headers: {
              'X-Authorization': `Bearer ${this.params.jwtToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const attrs = await response.json();
          const stateAttr = attrs.find((a: any) => a.key === 'state' || a.key === 'acionamento');
          if (stateAttr) {
            const isOn = stateAttr.value === true || stateAttr.value === 'on' || stateAttr.value === 1 ||
              stateAttr.value === 'aberta' || stateAttr.value === 'ligado';
            this.view?.updateDeviceState(isOn);
          }

          if (this.params.enableDebugMode) {
            console.log('[OnOffDeviceModal] Device state refreshed:', attrs);
          }
        }
      }
    } catch (error) {
      console.error('[OnOffDeviceModal] Refresh error:', error);
    }
  }

  private handleDateRangeChange(startISO: string, endISO: string): void {
    if (this.params.enableDebugMode) {
      console.log('[OnOffDeviceModal] Date range changed:', { startISO, endISO });
    }

    // Notify external callback
    this.params.onDateRangeChange?.(this.params.device.id, startISO, endISO);
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

  /**
   * Close the modal
   */
  public close(): void {
    if (this.params.enableDebugMode) {
      console.log('[OnOffDeviceModal] Modal closing');
    }

    // Trigger callback
    this.params.onClose?.();

    // Cleanup
    this.cleanup();
  }

  /**
   * Set theme mode
   */
  public setTheme(mode: OnOffDeviceThemeMode): void {
    this.state.theme = mode;
    this.renderModal();
    this.setupEventListeners();
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
    if (this.modalContainer) {
      this.modalContainer.remove();
      this.modalContainer = null;
    }
  }

  /**
   * Destroy the modal and cleanup
   */
  public destroy(): void {
    this.close();
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
