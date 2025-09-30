// energy/EnergyModal.ts - Main component class for energy modal

import { createModal } from '../internal/ModalPremiumShell';
import { EnergyDataFetcher } from './EnergyDataFetcher';
import { EnergyModalView } from './EnergyModalView';
import { 
  OpenDashboardPopupEnergyOptions, 
  EnergyModalContext, 
  EnergyModalError,
  DEFAULT_I18N,
  DEFAULT_STYLES
} from './types';
import { 
  validateOptions, 
  normalizeToSaoPauloISO, 
  resolveDeviceAttributes, 
  mapHttpError,
  createSafeErrorMessage,
  validateJwtToken,
  createModalId
} from './utils';

export class EnergyModal {
  private modal: any;
  private view: EnergyModalView | null = null;
  private dataFetcher: EnergyDataFetcher;
  private params: OpenDashboardPopupEnergyOptions;
  private context: EnergyModalContext | null = null;
  private modalId: string;
  private eventHandlers: { [key: string]: (() => void)[] } = {};

  constructor(params: OpenDashboardPopupEnergyOptions) {
    // Validate parameters first
    validateOptions(params);
    
    this.params = this.normalizeParams(params);
    this.modalId = createModalId();
    
    // Initialize data fetcher
    this.dataFetcher = new EnergyDataFetcher({
      dataApiHost: this.params.dataApiHost,
      ingestionToken: this.params.ingestionToken,
      clientId: this.params.clientId,
      clientSecret: this.params.clientSecret
    });

    console.log('[EnergyModal] Initialized with params:', {
      deviceId: this.params.deviceId,
      hasIngestionToken: !!this.params.ingestionToken,
      hasClientCredentials: !!(this.params.clientId && this.params.clientSecret),
      dataApiHost: this.params.dataApiHost,
      modalId: this.modalId
    });
  }

  /**
   * Shows the energy modal
   */
  async show(): Promise<{ close: () => void }> {
    try {
      console.log('[EnergyModal] Starting modal show process');

      // 1. Fetch device context from ThingsBoard
      this.context = await this.fetchDeviceContext();
      
      // 2. Create and configure modal
      const identifier = this.context.device.attributes.identifier || 'SEM IDENTIFICADOR';
      const label = this.context.device.label || 'SEM ETIQUETA';
      
      this.modal = createModal({
        title: `Relatório de Energia - ${identifier} - ${label}`,
        width: '80vw',
        height: '90vh',
        theme: (this.params.theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark'
      });

      // 3. Create and render view
      this.view = new EnergyModalView(this.modal, {
        context: this.context,
        params: this.params,
        onExport: () => this.handleExport(),
        onError: (error) => this.handleError(error)
      });

      // 4. Setup modal event handlers
      this.setupModalEventHandlers();
      
      // 5. Load and render energy data
      await this.loadEnergyData();
      
      // 6. Trigger onOpen callback
      if (this.params.onOpen) {
        try {
          this.params.onOpen(this.context);
        } catch (error) {
          console.warn('[EnergyModal] onOpen callback error:', error);
        }
      }

      console.log('[EnergyModal] Modal successfully opened');

      return {
        close: () => this.close()
      };
      
    } catch (error) {
      console.error('[EnergyModal] Error showing modal:', error);
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Normalizes and validates parameters
   */
  private normalizeParams(params: OpenDashboardPopupEnergyOptions): OpenDashboardPopupEnergyOptions {
    // Validate JWT token format
    if (!validateJwtToken(params.tbJwtToken)) {
      throw new Error('Invalid JWT token format');
    }

    return {
      ...params,
      // Set defaults
      dataApiHost: params.dataApiHost || 'https://api.data.apps.myio-bas.com',
      chartsBaseUrl: params.chartsBaseUrl || 'https://graphs.apps.myio-bas.com',
      timezone: params.timezone || 'America/Sao_Paulo',
      theme: params.theme || 'light',
      granularity: params.granularity || '1d',
      closeOnEsc: params.closeOnEsc !== false,
      zIndex: params.zIndex || 10000,
      // Merge i18n with defaults
      i18n: { ...DEFAULT_I18N, ...params.i18n },
      // Merge styles with defaults
      styles: { ...DEFAULT_STYLES, ...params.styles }
    };
  }

  /**
   * Fetches device context from ThingsBoard
   */
  private async fetchDeviceContext(): Promise<EnergyModalContext> {
    console.log('[EnergyModal] Fetching device context for:', this.params.deviceId);

    try {
      // Fetch device entity and attributes in parallel
      const [entityInfo, attributes] = await Promise.all([
        this.fetchEntityInfo(),
        this.fetchEntityAttributes()
      ]);

      const resolvedAttributes = resolveDeviceAttributes(attributes);

      const context: EnergyModalContext = {
        device: {
          id: this.params.deviceId,
          label: this.params.label || entityInfo.label || entityInfo.name || 'Unknown Device',
          attributes: attributes
        },
        resolved: {
          ingestionId: this.params.ingestionId || resolvedAttributes.ingestionId,
          centralId: this.params.centralId || resolvedAttributes.centralId,
          slaveId: this.params.slaveId || resolvedAttributes.slaveId,
          customerId: this.params.customerId || resolvedAttributes.customerId
        }
      };

      console.log('[EnergyModal] Device context resolved:', {
        deviceLabel: context.device.label,
        hasIngestionId: !!context.resolved.ingestionId,
        attributeCount: Object.keys(attributes).length
      });

      return context;

    } catch (error) {
      console.error('[EnergyModal] Error fetching device context:', error);
      throw new Error(`Failed to fetch device information: ${createSafeErrorMessage(error)}`);
    }
  }

  /**
   * Fetches device entity from ThingsBoard
   */
  private async fetchEntityInfo(): Promise<any> {
    const url = `/api/device/${this.params.deviceId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Authorization': `Bearer ${this.params.tbJwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = mapHttpError(response.status);
      throw new Error(`Failed to fetch device entity: ${error.message}`);
    }

    return response.json();
  }

  /**
   * Fetches device attributes from ThingsBoard
   */
  private async fetchEntityAttributes(): Promise<Record<string, any>> {
    const url = `/api/plugins/telemetry/DEVICE/${this.params.deviceId}/values/attributes?scope=SERVER_SCOPE`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Authorization': `Bearer ${this.params.tbJwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = mapHttpError(response.status);
      throw new Error(`Failed to fetch device attributes: ${error.message}`);
    }

    const attributes = await response.json();
    
    // Convert array format to object
    return attributes.reduce((acc: any, attr: any) => {
      acc[attr.key] = attr.value;
      return acc;
    }, {});
  }

  /**
   * Loads energy data and renders it
   */
  private async loadEnergyData(): Promise<void> {
    if (!this.context?.resolved.ingestionId) {
      const error = new Error('ingestionId not found in device attributes. Please configure the device properly.');
      this.handleError(error);
      return;
    }

    if (!this.view) {
      throw new Error('View not initialized');
    }

    try {
      console.log('[EnergyModal] Loading energy data');

      // Show loading state
      this.view.showLoadingState();

      // Normalize dates
      const startISO = normalizeToSaoPauloISO(this.params.startDate, false);
      const endISO = normalizeToSaoPauloISO(this.params.endDate, true);

      // Fetch energy data
      const energyData = await this.dataFetcher.fetchEnergyData({
        ingestionId: this.context.resolved.ingestionId,
        startISO,
        endISO,
        granularity: this.params.granularity || '1d'
      });

      console.log('[EnergyModal] Energy data loaded:', {
        dataPoints: energyData.consumption.length,
        totalConsumption: energyData.consumption.reduce((sum, point) => sum + point.value, 0)
      });

      // Render energy data
      this.view.renderEnergyData(energyData);

    } catch (error) {
      console.error('[EnergyModal] Error loading energy data:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Builds modal title
   */
  private buildModalTitle(): string {
    const i18n = this.params.i18n || DEFAULT_I18N;
    const deviceLabel = this.context?.device.label || this.params.label || 'Device';
    return `${i18n.title} - ${deviceLabel}`;
  }

  /**
   * Sets up modal event handlers
   */
  private setupModalEventHandlers(): void {
    if (!this.modal) return;

    // Handle modal close
    this.modal.on('close', () => {
      console.log('[EnergyModal] Modal closing');
      this.cleanup();
      this.emit('close');
      
      if (this.params.onClose) {
        try {
          this.params.onClose();
        } catch (error) {
          console.warn('[EnergyModal] onClose callback error:', error);
        }
      }
    });

    // Handle escape key if enabled
    if (this.params.closeOnEsc) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.close();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      
      // Store for cleanup
      this.on('close', () => {
        document.removeEventListener('keydown', handleKeyDown);
      });
    }
  }

  /**
   * Handles CSV export
   */
  private handleExport(): void {
    if (!this.view) {
      console.warn('[EnergyModal] Cannot export: view not initialized');
      return;
    }

    try {
      this.view.exportToCsv();
      console.log('[EnergyModal] CSV export completed');
    } catch (error) {
      console.error('[EnergyModal] Export error:', error);
      this.handleError(new Error('Failed to export data to CSV'));
    }
  }

  /**
   * Handles errors with user feedback
   */
  private handleError(error: Error): void {
    console.error('[EnergyModal] Error occurred:', error);

    // Show error in view if available
    if (this.view) {
      this.view.showError(error.message);
    }

    // Trigger onError callback
    if (this.params.onError) {
      try {
        const modalError: EnergyModalError = {
          code: 'UNKNOWN_ERROR',
          message: error.message,
          cause: error
        };
        this.params.onError(modalError);
      } catch (callbackError) {
        console.warn('[EnergyModal] onError callback error:', callbackError);
      }
    }

    this.emit('error', { message: error.message, error });
  }

  /**
   * Closes the modal
   */
  public close(): void {
    if (this.modal) {
      this.modal.close();
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    console.log('[EnergyModal] Cleaning up resources');

    // Clear data fetcher cache
    this.dataFetcher.clearCache();

    // Clear view
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }

    // Clear context
    this.context = null;

    // Clear event handlers
    this.eventHandlers = {};
  }

  /**
   * Event handling
   */
  private on(event: string, handler: () => void): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  private emit(event: string, payload?: any): void {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler();
        } catch (error) {
          console.warn(`[EnergyModal] Event handler error for ${event}:`, error);
        }
      });
    }
  }
}
