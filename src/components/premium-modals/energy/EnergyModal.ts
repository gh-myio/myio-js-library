// energy/EnergyModal.ts - Main component class for energy modal

import { createModal } from '../internal/ModalPremiumShell';
import { EnergyDataFetcher } from './EnergyDataFetcher';
import { EnergyModalView } from './EnergyModalView';
import {
  OpenDashboardPopupEnergyOptions,
  EnergyModalContext,
  EnergyModalError,
  DEFAULT_I18N,
  DEFAULT_STYLES,
} from './types';
import {
  validateOptions,
  normalizeToSaoPauloISO,
  resolveDeviceAttributes,
  mapHttpError,
  createSafeErrorMessage,
  validateJwtToken,
  createModalId,
} from './utils';

export class EnergyModal {
  private modal: any;
  private view: EnergyModalView | null = null;
  private dataFetcher: EnergyDataFetcher;
  private params: OpenDashboardPopupEnergyOptions;
  private context: EnergyModalContext | null = null;
  private modalId: string;
  private eventHandlers: { [key: string]: (() => void)[] } = {};
  private _dataLoadError = false;

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
      clientSecret: this.params.clientSecret,
    });

    console.log('[EnergyModal] Initialized with params:', {
      deviceId: this.params.deviceId,
      hasIngestionToken: !!this.params.ingestionToken,
      hasClientCredentials: !!(this.params.clientId && this.params.clientSecret),
      dataApiHost: this.params.dataApiHost,
      modalId: this.modalId,
    });
  }

  /**
   * Shows the energy modal
   */
  async show(): Promise<{ close: () => void }> {
    try {
      console.log('[EnergyModal] Starting modal show process');

      const mode = this.params.mode || 'single';
      console.log(`[EnergyModal] Mode: ${mode}`);

      // ⭐ NEW: Only fetch device context in SINGLE mode
      if (mode === 'single') {
        // 1. Fetch device context from ThingsBoard
        this.context = await this.fetchDeviceContext();

        // 2. Create and configure modal with device info
        const identifier = this.context.device.attributes.identifier || 'SEM IDENTIFICADOR';
        const label = this.context.device.label || 'SEM ETIQUETA';

        this.modal = createModal({
          title: this.buildModalTitle(),
          width: '80vw',
          height: '90vh',
          theme: (this.params.theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark',
        });
      }
      // ⭐ NEW: Comparison mode - skip ThingsBoard fetch
      else if (mode === 'comparison') {
        // Create minimal context (no device info needed)
        this.context = this.createComparisonContext();

        // Create modal with comparison title
        const deviceCount = this.params.dataSources?.length || 0;
        this.modal = createModal({
          title: `Comparação de ${deviceCount} Dispositivos`,
          width: '80vw',
          height: '90vh',
          theme: (this.params.theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark',
        });
      }

      // 3. Create and render view
      this.view = new EnergyModalView(this.modal, {
        context: this.context!,
        params: this.params,
        onExport: () => this.handleExport(),
        onError: (error) => this.handleEnergyModalError(error),
        onDateRangeChange: (startISO, endISO) => this.handleDateRangeChange(startISO, endISO),
      });

      // 4. Setup modal event handlers
      this.setupModalEventHandlers();

      // ⭐ NEW: Mode-specific data loading
      if (mode === 'single') {
        // Single mode: Fetch and render energy data
        await this.loadEnergyData();
      } else if (mode === 'comparison') {
        // Comparison mode: Directly render comparison chart (SDK handles data fetch)
        console.log('[EnergyModal] Triggering comparison chart render');
        const success = this.view.tryRenderWithSDK(null as any);

        if (!success) {
          const error = new Error('Failed to render comparison chart. Check if EnergyChartSDK is loaded.');
          this.handleError(error);
        }
      }

      // 5. Trigger onOpen callback — only if no error occurred during data load
      if (this.params.onOpen && !this._dataLoadError) {
        try {
          this.params.onOpen(this.context!);
        } catch (error) {
          console.warn('[EnergyModal] onOpen callback error:', error);
        }
      }

      console.log('[EnergyModal] Modal successfully opened');

      return {
        close: () => this.close(),
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
    if (!validateJwtToken(params.tbJwtToken || '')) {
      throw new Error('Invalid JWT token format');
    }

    return {
      ...params,
      // Set defaults
      dataApiHost: params.dataApiHost || 'https://api.data.apps.myio-bas.com/api/v1',
      chartsBaseUrl: params.chartsBaseUrl || 'https://graphs.apps.myio-bas.com',
      timezone: params.timezone || 'America/Sao_Paulo',
      theme: params.theme || 'light',
      granularity: params.granularity || '1d',
      closeOnEsc: params.closeOnEsc !== false,
      zIndex: params.zIndex || 10000,
      // Merge i18n with defaults
      i18n: { ...DEFAULT_I18N, ...params.i18n },
      // Merge styles with defaults
      styles: { ...DEFAULT_STYLES, ...params.styles },
    };
  }

  /**
   * Creates a minimal context for comparison mode
   * No ThingsBoard data fetching required
   */
  private createComparisonContext(): EnergyModalContext {
    const deviceCount = this.params.dataSources?.length || 0;

    return {
      device: {
        id: 'comparison',
        label: `Comparação (${deviceCount} dispositivos)`,
        attributes: {},
      },
      resolved: {
        ingestionId: undefined,
        centralId: undefined,
        slaveId: undefined,
        customerId: undefined,
      },
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
        this.fetchEntityAttributes(),
      ]);

      const resolvedAttributes = resolveDeviceAttributes(attributes);

      const context: EnergyModalContext = {
        device: {
          id: this.params.deviceId!,
          name: entityInfo.name,
          label: this.params.label || entityInfo.label || entityInfo.name || 'Unknown Device',
          attributes: attributes,
        },
        resolved: {
          ingestionId: this.params.ingestionId || resolvedAttributes.ingestionId,
          centralId: this.params.centralId || resolvedAttributes.centralId,
          slaveId: this.params.slaveId || resolvedAttributes.slaveId,
          customerId: this.params.customerId || resolvedAttributes.customerId,
        },
      };

      console.log('[EnergyModal] Device context resolved:', {
        deviceLabel: context.device.label,
        hasIngestionId: !!context.resolved.ingestionId,
        attributeCount: Object.keys(attributes).length,
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
    const base = this.params.tbBaseUrl || '';
    const url = `${base}/api/device/${this.params.deviceId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Authorization': `Bearer ${this.params.tbJwtToken}`,
        'Content-Type': 'application/json',
      },
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
    const base = this.params.tbBaseUrl || '';
    const url = `${base}/api/plugins/telemetry/DEVICE/${this.params.deviceId}/values/attributes?scope=SERVER_SCOPE`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Authorization': `Bearer ${this.params.tbJwtToken}`,
        'Content-Type': 'application/json',
      },
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
    const mode = this.params.mode || 'single';

    // ⭐ SAFETY: Only load data in single mode
    if (mode !== 'single') {
      console.log('[EnergyModal] Skipping loadEnergyData in comparison mode');
      return;
    }

    if (!this.context?.resolved.ingestionId) {
      const error = new Error(
        'ingestionId not found in device attributes. Please configure the device properly.'
      );
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
        granularity: this.params.granularity || '1d',
        readingType: this.params.readingType,
      });

      console.log('[EnergyModal] Energy data loaded:', {
        dataPoints: energyData.consumption.length,
        totalConsumption: energyData.consumption.reduce((sum, point) => sum + point.value, 0),
      });

      // Render energy data
      this.view.renderEnergyData(energyData);
    } catch (error) {
      console.error('[EnergyModal] Error loading energy data:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Builds modal title HTML with domain text + device/customer/version badges.
   */
  private buildModalTitle(): string {
    const readingType = this.params.readingType || 'energy';
    const domainTitles: Record<string, string> = {
      energy:      '⚡ Gráfico de Energia',
      water:       '💧 Gráfico de Água',
      temperature: '🌡️ Gráfico de Temperatura',
      tank:        '💧 Gráfico de Reservatório',
    };
    const mainTitle = domainTitles[readingType] ?? '⚡ Gráfico de Energia';

    const label      = this.context?.device.label || '';
    const deviceName = this.context?.device.name || (this.context?.device as any)?.attributes?.identifier || '';
    const customer   = this.params.customerName || '';
    const version    = (window as any).MyIOLibrary?.version;

    const deviceBadge = label
      ? `<span class="myio-modal-header-device-label">${label}${deviceName && deviceName !== label ? `<span class="myio-modal-header-device-name">(${deviceName})</span>` : ''}</span>`
      : '';
    const customerBadge = customer
      ? `<span class="myio-modal-header-customer-badge">${customer}</span>`
      : '';
    const versionBadge = version
      ? `<span class="myio-modal-header-version-badge">v${version}</span>`
      : '';

    return `${mainTitle}${deviceBadge}${customerBadge}${versionBadge}`;
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
   * Handles date range changes from the date picker
   */
  private async handleDateRangeChange(startISO: string, endISO: string): Promise<void> {
    const mode = this.params.mode || 'single';

    if (!this.view) {
      return;
    }

    try {
      console.log('[EnergyModal] Date range changed:', { startISO, endISO, mode });

      // ⭐ COMPARISON MODE: Let SDK handle data fetch
      if (mode === 'comparison') {
        console.log('[EnergyModal] Comparison mode: re-rendering chart with new dates');

        // Update params with new dates
        this.params.startDate = startISO;
        this.params.endDate = endISO;

        // Show loading state
        this.view.showLoadingState();

        // Re-render chart (SDK will fetch new data)
        const success = this.view.tryRenderWithSDK(null as any);

        if (success) {
          this.view.hideLoadingState();
          this.view.hideError();
        } else {
          this.view.showError('Erro ao recarregar gráfico de comparação');
        }

        return;
      }

      // ⭐ SINGLE MODE: Original behavior
      if (!this.context?.resolved.ingestionId) {
        return;
      }

      // Show loading state
      this.view.showLoadingState();

      // Fetch energy data with new date range
      const energyData = await this.dataFetcher.fetchEnergyData({
        ingestionId: this.context.resolved.ingestionId,
        startISO,
        endISO,
        granularity: this.params.granularity || '1d',
        readingType: this.params.readingType,
      });

      console.log('[EnergyModal] Energy data reloaded:', {
        dataPoints: energyData.consumption.length,
        totalConsumption: energyData.consumption.reduce((sum, point) => sum + point.value, 0),
      });

      // Render updated energy data
      this.view.renderEnergyData(energyData);
    } catch (error) {
      console.error('[EnergyModal] Error reloading energy data:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Handles CSV export
   */
  private handleExport(): void {
    const mode = this.params.mode || 'single';

    if (!this.view) {
      console.warn('[EnergyModal] Cannot export: view not initialized');
      return;
    }

    try {
      // ⭐ NEW: Disable export in comparison mode (for now)
      if (mode === 'comparison') {
        alert('Export não disponível no modo de comparação');
        return;
      }

      this.view.exportToCsv();
      console.log('[EnergyModal] CSV export completed');
    } catch (error) {
      console.error('[EnergyModal] Export error:', error);
      this.handleError(new Error('Failed to export data to CSV'));
    }
  }

  /**
   * Handles EnergyModalError types from the view
   */
  private handleEnergyModalError(error: EnergyModalError): void {
    console.error('[EnergyModal] EnergyModalError occurred:', error);

    // Show friendly error in view if available
    if (this.view) {
      const { title, detail } = this.toFriendlyError(error.message);
      this.view.showError(title, detail);
    }

    // Trigger onError callback
    if (this.params.onError) {
      try {
        this.params.onError(error);
      } catch (callbackError) {
        console.warn('[EnergyModal] onError callback error:', callbackError);
      }
    }

    this.emit('error', { message: error.message, error });
  }

  /**
   * Handles errors with user feedback
   */
  private toFriendlyError(raw: string): { title: string; detail: string } {
    const msg = raw.toLowerCase();
    if (msg.includes('device not found') || msg.includes('404'))
      return {
        title: 'Dispositivo não encontrado',
        detail: 'Este dispositivo ainda não possui dados de telemetria cadastrados. Verifique a integração ou contate o suporte.',
      };
    if (msg.includes('token_expired') || msg.includes('token has expired') || msg.includes('authentication token') || msg.includes('token expirou'))
      return {
        title: 'Sessão expirada',
        detail: 'Seu token de acesso expirou. Recarregue a página para continuar.',
      };
    if (msg.includes('insufficient permissions') || msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('forbidden'))
      return {
        title: 'Sem permissão de acesso',
        detail: 'Você não tem permissão para visualizar estes dados. Tente reabrir o modal ou contate o suporte.',
      };
    if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network error') || msg.includes('err_network'))
      return {
        title: 'Sem conexão com o servidor',
        detail: 'Não foi possível alcançar o servidor de dados. Verifique sua conexão com a internet.',
      };
    if (msg.includes('500') || msg.includes('internal server'))
      return {
        title: 'Erro interno no servidor',
        detail: 'O servidor encontrou um problema inesperado. Tente novamente em alguns instantes.',
      };
    if (msg.includes('timeout') || msg.includes('timed out'))
      return {
        title: 'Tempo de resposta esgotado',
        detail: 'O servidor demorou demais para responder. Verifique sua conexão e tente novamente.',
      };
    return {
      title: 'Não foi possível carregar os dados',
      detail: 'Ocorreu um erro inesperado ao buscar os dados de energia.',
    };
  }

  private handleError(error: Error): void {
    console.error('[EnergyModal] Error occurred:', error);
    this._dataLoadError = true;

    // Show friendly error in view if available
    if (this.view) {
      const { title, detail } = this.toFriendlyError(error.message);
      this.view.showError(title, detail);
    }

    // Trigger onError callback
    if (this.params.onError) {
      try {
        const modalError: EnergyModalError = {
          code: 'UNKNOWN_ERROR',
          message: error.message,
          cause: error,
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
      this.eventHandlers[event].forEach((handler) => {
        try {
          handler();
        } catch (error) {
          console.warn(`[EnergyModal] Event handler error for ${event}:`, error);
        }
      });
    }
  }
}
