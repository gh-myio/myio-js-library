import { ModalConfig } from './types';
import { mapDeviceStatusToCardStatus } from '../../../utils/deviceStatus';
import { AnnotationsTab } from './annotations/AnnotationsTab';
import { AlarmsTab } from './alarms/AlarmsTab';
import { getAnnotationPermissions } from '../../../utils/superAdminUtils';
import type { UserInfo, PermissionSet } from './annotations/types';

// RFC-0171: Allowed email domain for superadmin editing permissions
const ALLOWED_EMAIL_DOMAIN = '@myio.com.br';

export class SettingsModalView {
  private container: HTMLElement;
  private modal: HTMLElement;
  private form: HTMLFormElement;
  private config: ModalConfig;
  private focusTrapElements: HTMLElement[] = [];
  private originalActiveElement: Element | null = null;
  // RFC-0104: Annotations Tab
  private annotationsTab: AnnotationsTab | null = null;
  // RFC-0180: Alarms Tab
  private alarmsTab: AlarmsTab | null = null;
  private currentTab: 'general' | 'annotations' | 'alarms' = 'general';
  private currentUser: UserInfo | null = null;
  private permissions: PermissionSet | null = null;

  constructor(config: ModalConfig) {
    this.config = config;
    this.createModal();
  }

  /**
   * RFC-0171: Check if user has superadmin permissions
   * Returns true if:
   * - superadmin flag is explicitly set to true, OR
   * - userEmail ends with @myio.com.br
   */
  private isSuperAdmin(): boolean {
    // Explicit superadmin flag takes precedence
    if (this.config.superadmin === true) {
      return true;
    }

    // Check userEmail domain
    const userEmail = this.config.userEmail;
    if (!userEmail) {
      return false;
    }

    const email = userEmail.toLowerCase().trim();
    return email.endsWith(ALLOWED_EMAIL_DOMAIN.toLowerCase());
  }

  render(initialData: Record<string, any>): void {
    // Store current focus to restore later
    this.originalActiveElement = document.activeElement;

    // Portal to document.body
    document.body.appendChild(this.container);

    // --- LÓGICA DE PRIORIZAÇÃO DOS DADOS SALVOS ---
    let formData = { ...initialData };

    // Verifica se veio o JSON específico do dispositivo (deviceMapInstaneousPower)
    // Nota: O nome da chave deve bater com o que vem do Fetcher
    if (initialData.deviceMapInstaneousPower && typeof initialData.deviceMapInstaneousPower === 'object') {
      console.log('[SettingsModalView] Configuração salva encontrada (Device Scope). Processando...');

      // 1. Extrai os valores do JSON para o formato do formulário
      const flatLimits = this.parseDeviceSavedLimits(initialData.deviceMapInstaneousPower);

      // 2. Mescla: Os valores do JSON sobrescrevem qualquer outro valor conflitante
      formData = { ...formData, ...flatLimits };
    }

    // Preenche o formulário com os dados processados
    this.populateForm(formData);

    // Patch date cells from fetched data (not available at HTML build time)
    const createdTimeEl = this.modal.querySelector('#identity-created-time-value') as HTMLElement;
    if (createdTimeEl && formData.createdTime) {
      createdTimeEl.textContent = this.formatTs(formData.createdTime);
    }
    const lastUpdatedEl = this.modal.querySelector('#identity-last-updated-value') as HTMLElement;
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = formData.lastUpdatedTime ? this.formatTs(formData.lastUpdatedTime) : '—';
    }

    // Patch gcdrDeviceId from SERVER_SCOPE attribute if not already provided
    if (!this.config.gcdrDeviceId && formData.gcdrDeviceId) {
      this.config.gcdrDeviceId = formData.gcdrDeviceId;
    }

    // --- Resto do método render continua igual ---
    this.attachEventListeners();
    this.setupAccessibility();
    this.setupFocusTrap();
    this.applyTheme();
    this.fetchLatestConsumptionTelemetry();

    // RFC-0104: Initialize annotations tab (async)
    this.initAnnotationsTab();
    // RFC-0180: Initialize alarms tab (async)
    this.initAlarmsTab();
  }

  // RFC-0104: Initialize the Annotations Tab
  private async initAnnotationsTab(): Promise<void> {
    const annotationsContainer = this.modal.querySelector('#annotations-tab-content') as HTMLElement;
    if (!annotationsContainer) {
      console.warn('[SettingsModalView] Annotations container not found');
      return;
    }

    if (!this.config.deviceId || !this.config.jwtToken) {
      console.warn('[SettingsModalView] Missing deviceId or jwtToken for annotations');
      annotationsContainer.innerHTML =
        '<p style="color: #6c757d; padding: 20px; text-align: center;">Anotações não disponíveis (autenticação necessária)</p>';
      return;
    }

    try {
      // Fetch permissions
      const permissions = await getAnnotationPermissions(this.config.customerId, this.config.jwtToken, this.config.tbBaseUrl);

      if (!permissions.currentUser) {
        console.warn('[SettingsModalView] Could not get current user for annotations');
        annotationsContainer.innerHTML =
          '<p style="color: #6c757d; padding: 20px; text-align: center;">Anotações não disponíveis (usuário não identificado)</p>';
        return;
      }

      this.currentUser = permissions.currentUser;
      this.permissions = {
        currentUser: permissions.currentUser,
        isSuperAdminMyio: permissions.isSuperAdminMyio,
        isSuperAdminHolding: permissions.isSuperAdminHolding,
      };

      // Create annotations tab
      this.annotationsTab = new AnnotationsTab({
        container: annotationsContainer,
        deviceId: this.config.deviceId,
        jwtToken: this.config.jwtToken,
        tbBaseUrl: this.config.tbBaseUrl,
        currentUser: this.currentUser,
        permissions: this.permissions,
        enableAnnotationsOnboarding: this.config.enableAnnotationsOnboarding ?? false, // RFC-0144
      });

      await this.annotationsTab.init();
      console.log('[SettingsModalView] RFC-0104: Annotations tab initialized');
    } catch (error) {
      console.error('[SettingsModalView] Failed to initialize annotations tab:', error);
      annotationsContainer.innerHTML =
        '<p style="color: #dc3545; padding: 20px; text-align: center;">Erro ao carregar anotações</p>';
    }
  }

  // RFC-0180: Initialize the Alarms Tab
  private async initAlarmsTab(): Promise<void> {
    const container = this.modal.querySelector('#alarms-tab-content') as HTMLElement;
    if (!container) return;

    const { gcdrDeviceId, gcdrCustomerId, gcdrTenantId, gcdrApiBaseUrl, prefetchedBundle, prefetchedAlarms, deviceId, jwtToken } =
      this.config;

    if (!gcdrDeviceId || !gcdrCustomerId || !gcdrTenantId) {
      container.innerHTML =
        '<p style="color:#6c757d;padding:20px;text-align:center;font-style:italic;">Alarm data not available (missing GCDR identifiers).</p>';
      return;
    }

    try {
      this.alarmsTab = new AlarmsTab({
        container,
        gcdrDeviceId,
        gcdrCustomerId,
        gcdrTenantId,
        gcdrApiBaseUrl,
        tbDeviceId: deviceId ?? '',
        jwtToken: jwtToken ?? '',
        prefetchedBundle: prefetchedBundle ?? null,
        prefetchedAlarms: prefetchedAlarms ?? null,
      });
      await this.alarmsTab.init();
      console.log('[SettingsModalView] RFC-0180: Alarms tab initialized');
    } catch (error) {
      console.error('[SettingsModalView] Failed to initialize alarms tab:', error);
      container.innerHTML =
        '<p style="color:#dc3545;padding:20px;text-align:center;">Erro ao carregar alarmes</p>';
    }
  }

  // RFC-0104 / RFC-0180: Switch between tabs
  private switchTab(tab: 'general' | 'annotations' | 'alarms'): void {
    this.currentTab = tab;

    // Update tab buttons
    this.modal.querySelectorAll('.modal-tab').forEach((btn) => {
      const t = (btn as HTMLElement).dataset.tab;
      btn.classList.toggle('active', t === tab);
    });

    // Update tab content visibility
    const generalContent = this.modal.querySelector('#general-tab-content') as HTMLElement;
    const annotationsContent = this.modal.querySelector('#annotations-tab-content') as HTMLElement;
    const alarmsContent = this.modal.querySelector('#alarms-tab-content') as HTMLElement;

    if (generalContent) generalContent.style.display = tab === 'general' ? 'block' : 'none';
    if (annotationsContent) annotationsContent.style.display = tab === 'annotations' ? 'block' : 'none';
    if (alarmsContent) alarmsContent.style.display = tab === 'alarms' ? 'block' : 'none';

    // Update footer Save button (only on General tab)
    const saveBtn = this.modal.querySelector('.btn-save') as HTMLElement;
    if (saveBtn) saveBtn.style.display = tab === 'general' ? 'inline-flex' : 'none';

    // RFC-0144: Trigger onboarding when Annotations tab becomes active
    if (tab === 'annotations' && this.annotationsTab) {
      this.annotationsTab.onTabActivated();
    }
  }

  close(): void {
    this.teardownFocusTrap();

    // RFC-0104: Clean up annotations tab
    if (this.annotationsTab) {
      this.annotationsTab.destroy();
      this.annotationsTab = null;
    }

    // RFC-0180: Clean up alarms tab
    if (this.alarmsTab) {
      this.alarmsTab.destroy();
      this.alarmsTab = null;
    }

    // Restore focus to original element
    if (this.originalActiveElement && 'focus' in this.originalActiveElement) {
      (this.originalActiveElement as HTMLElement).focus();
    }

    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * RFC-0080: Update mapInstantaneousPower configuration
   * Called from SettingsController after fetching GLOBAL from CUSTOMER
   * This must be called BEFORE render() so the power limits display correctly
   */
  updateMapInstantaneousPower(mapInstantaneousPower: object): void {
    this.config.mapInstantaneousPower = mapInstantaneousPower;
    console.log('[SettingsModalView] RFC-0080: Updated mapInstantaneousPower config');
  }

  showError(message: string): void {
    const errorEl = this.modal.querySelector('.error-message') as HTMLElement;
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      errorEl.setAttribute('role', 'alert');
      errorEl.setAttribute('aria-live', 'polite');
    }
  }

  hideError(): void {
    const errorEl = this.modal.querySelector('.error-message') as HTMLElement;
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.removeAttribute('role');
      errorEl.removeAttribute('aria-live');
    }
  }

  showLoadingState(isLoading: boolean): void {
    const saveBtn = this.modal.querySelector('.btn-save') as HTMLButtonElement;
    const cancelBtn = this.modal.querySelector('.btn-cancel') as HTMLButtonElement;
    const formInputs = this.modal.querySelectorAll('input, select, textarea') as NodeListOf<HTMLInputElement>;

    if (saveBtn) {
      saveBtn.disabled = isLoading;
      saveBtn.textContent = isLoading ? 'Salvando...' : 'Salvar';
    }

    if (cancelBtn) {
      cancelBtn.disabled = isLoading;
    }

    // Disable form inputs during save
    formInputs.forEach((input) => {
      input.disabled = isLoading;
    });
  }

  private formatDomainLabel(domain: string): string {
    const MAP: Record<Domain, string> = {
      energy: 'de energia',
      water: 'de água',
      temperature: 'de temperatura',
    };
    return MAP[domain];
  }

  private getTelemetryLabelByDomain(): string {
    const domain = this.config.domain || 'energy';
    const MAP: Record<string, string> = {
      energy: 'de Consumo',
      water: 'de Água',
      temperature: 'de Temperatura',
    };
    return MAP[domain] || 'de Consumo';
  }

  getFormData(): Record<string, any> {
    const formData = new FormData(this.form);
    const data: Record<string, any> = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        // Handle numeric fields (consumption, temperature, water levels, and offset)
        if (
          [
            'maxDailyKwh',
            'maxNightKwh',
            'maxBusinessKwh',
            'minTemperature',
            'maxTemperature',
            'offSetTemperature', // RFC-XXXX: Temperature offset (SuperAdmin only)
            'minWaterLevel',
            'maxWaterLevel',
          ].includes(key)
        ) {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            // For consumption fields, ensure they are >= 0
            if (key.includes('Kwh') && num < 0) {
              continue;
            }
            // For water level fields, ensure they are between 0 and 100
            if (key.includes('WaterLevel')) {
              if (num < 0 || num > 100) {
                continue;
              }
            }
            // For offSetTemperature, ensure value is between -99.99 and +99.99
            if (key === 'offSetTemperature') {
              if (num < -99.99 || num > 99.99) {
                continue;
              }
            }
            data[key] = num;
          }
        } else if (value.trim()) {
          data[key] = value.trim();
        }
      }
    }

    return data;
  }

  private createModal(): void {
    this.container = document.createElement('div');
    this.container.className = 'myio-device-settings-overlay';
    this.container.innerHTML = this.getModalHTML();
    this.modal = this.container.querySelector('.myio-device-settings-modal') as HTMLElement;
    this.form = this.modal.querySelector('form') as HTMLFormElement;
  }

  private getModalHTML(): string {
    // Width is controlled by CSS (.myio-device-settings-modal { width: 1700px })
    // Config width can override if explicitly provided
    const widthStyle = this.config.width
      ? `style="width: ${typeof this.config.width === 'number' ? `${this.config.width}px` : this.config.width}"`
      : '';

    return `
      <div class="myio-device-settings-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="myio-device-settings-modal" ${widthStyle}>
          <div class="modal-header">
            <h3 id="modal-title">Configurações</h3>
            <div class="modal-header-actions">
              <button type="button" class="maximize-btn" aria-label="Maximizar" title="Maximizar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              </button>
              <button type="button" class="close-btn" aria-label="Fechar">&times;</button>
            </div>
          </div>
          <!-- RFC-0104: Tab Navigation -->
          <div class="modal-tabs">
            <button type="button" class="modal-tab active" data-tab="general">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Geral
            </button>
            <button type="button" class="modal-tab" data-tab="annotations">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
              Anotações
            </button>
            <!-- RFC-0180: Alarms Tab -->
            <button type="button" class="modal-tab" data-tab="alarms">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              Alarmes
            </button>
          </div>
          <div class="modal-body">
            <div class="error-message" style="display: none;" role="alert" aria-live="polite"></div>
            <!-- RFC-0104: General Tab Content -->
            <div id="general-tab-content" class="tab-content">
              <form novalidate>
                ${this.getFormHTML()}
              </form>
            </div>
            <!-- RFC-0104: Annotations Tab Content -->
            <div id="annotations-tab-content" class="tab-content" style="display: none;">
              <div style="padding: 20px; text-align: center; color: #6c757d;">
                <div class="loading-spinner"></div>
                <p>Carregando anotações...</p>
              </div>
            </div>
            <!-- RFC-0180: Alarms Tab Content -->
            <div id="alarms-tab-content" class="tab-content" style="display: none;">
              <div style="padding: 20px; text-align: center; color: #6c757d;">
                <div class="loading-spinner"></div>
                <p>Carregando alarmes...</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-cancel">Fechar</button>
            <button type="button" class="btn-save btn-primary">Salvar</button>
          </div>
        </div>
      </div>
      ${this.getModalCSS()}
    `;
  }

  private getFormHTML(): string {
    // Check deviceType for conditional rendering
    const deviceType = this.config.deviceType;

    // RFC-0077: Extract customerName for display
    const customerName = this.config.customerName;
    const hasCustomerName = customerName && customerName.trim() !== '';

    return `
      <div class="form-layout">
        ${
          hasCustomerName
            ? `
        <!-- RFC-0077/0078: Shopping name display with device type icon -->
        <div class="customer-name-container">
          <div class="customer-info-row">
            <div class="device-type-icon-wrapper">
              ${this.getDeviceTypeIcon(deviceType)}
            </div>
            <div class="customer-info-content">
              <div class="customer-name-label">Shopping</div>
              <div class="customer-name-value">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shopping-icon"><path d="M4 22h16"/><path d="M7 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/></svg>
                <span class="customer-name-text">${customerName}</span>
              </div>
            </div>
          </div>
        </div>
        `
            : ''
        }

        <!-- Identity card: 3-column × 6-row grid -->
        <div class="form-card identity-card">
          <div class="identity-grid">

            <!-- Col 1, rows 1-6: single wrapper → borda contínua -->
            <div class="identity-col1">
              <div class="identity-name-block">
                <div class="identity-name-text">${this.config.deviceLabel || '—'}</div>
                <div class="device-name-subtitle">${this.config.deviceName || ''}</div>
              </div>
              <div class="identity-icon-cell">
                ${this.getDeviceImage(deviceType)}
              </div>
            </div>

            <!-- Col 2, row 1: "Etiqueta" label -->
            <div class="identity-field-label">Etiqueta</div>
            <!-- Col 2, row 2: input etiqueta -->
            <input type="text" id="label" name="label" class="identity-input" required maxlength="255">

            <!-- Col 2, row 3: "Andar" label -->
            <div class="identity-field-label">Andar / Localização</div>
            <!-- Col 2, row 4: input andar -->
            <input type="text" id="floor" name="floor" class="identity-input" maxlength="50">

            <!-- Col 2, row 5: "Identificador" label -->
            <div class="identity-field-label">Identificador / LUC / SUC</div>
            <!-- Col 2, row 6: input identificador -->
            <input type="text" id="identifier" name="identifier" class="identity-input" maxlength="20" ${
              this.isSuperAdmin() ? '' : 'readonly'
            }>

            <!-- Col 3, rows 1-6: date info block -->
            <div class="identity-dates-block">
              <div class="identity-date-row">
                <div class="identity-date-label">Data Criação</div>
                <div class="identity-date-value" id="identity-created-time-value">${this.formatTs((this.config as any).createdTime)}</div>
              </div>
              <div class="identity-date-row">
                <div class="identity-date-label">Data Última Alteração</div>
                <div class="identity-date-value" id="identity-last-updated-value">—</div>
              </div>
              <div class="identity-date-row">
                <div class="identity-date-label">Data Última Atividade</div>
                <div class="identity-date-value">${this.formatTs((this.config as any).lastActivityTime)}</div>
              </div>
            </div>

          </div>
        </div>

        <!-- Bottom Row: Connection Info spanning full width -->
        ${this.getConnectionInfoHTML()}

        <!-- RFC-0077: Power Limits Configuration (only for energy domain, when deviceType is available, and not a store meter) -->
        ${this.config.domain === 'energy' && this.config.deviceType && this.config.deviceType !== '3F_MEDIDOR' && this.config.deviceProfile !== '3F_MEDIDOR' ? this.getPowerLimitsHTML() : ''}
      </div>
    `;
  }

  private getAlarmsHTML(deviceType?: string): string {
    switch (deviceType) {
      case 'TERMOSTATO':
        return this.getThermostatAlarmsHTML();
      case 'CAIXA_DAGUA':
        return this.getWaterTankAlarmsHTML();
      default:
        return this.getConsumptionAlarmsHTML();
    }
  }

  private getConsumptionAlarmsHTML(): string {
    // Determine unit based on domain
    const unit = this.config.domain === 'water' ? 'L' : 'kWh';

    return `
      <div class="form-card">
        <h4 class="section-title">Alarmes ${this.formatDomainLabel(this.config.domain)}</h4>

        <div class="form-group">
          <label for="maxDailyKwh">Consumo Máximo Diário (${unit})</label>
          <input type="number" id="maxDailyKwh" name="maxDailyKwh" min="0" step="0.1">
        </div>

        <div class="form-group">
          <label for="maxNightKwh">Consumo Máximo na Madrugada (0h–06h)</label>
          <input type="number" id="maxNightKwh" name="maxNightKwh" min="0" step="0.1">
        </div>

        <div class="form-group">
          <label for="maxBusinessKwh">Consumo Máximo Horário Comercial (09h–22h)</label>
          <input type="number" id="maxBusinessKwh" name="maxBusinessKwh" min="0" step="0.1">
        </div>
      </div>
    `;
  }

  private getThermostatAlarmsHTML(): string {
    // RFC-0171: offSetTemperature field only visible for SuperAdmin (@myio.com.br users)
    const offSetTemperatureField =
      this.isSuperAdmin()
        ? `
        <div class="form-group">
          <label for="offSetTemperature">Offset de Temperatura (°C)</label>
          <input type="number" id="offSetTemperature" name="offSetTemperature" step="0.01" min="-99.99" max="99.99" placeholder="-99.99 a +99.99">
          <small class="form-hint" style="color: #6b7280; font-size: 11px; margin-top: 4px; display: block;">Correção aplicada à leitura do sensor (valores negativos ou positivos)</small>
        </div>
      `
        : '';

    return `
      <div class="form-card">
        <h4 class="section-title">Alarmes de Temperatura</h4>

        <div class="form-group">
          <label for="minTemperature">Temperatura Mínima (°C)</label>
          <input type="number" id="minTemperature" name="minTemperature" step="0.1">
        </div>

        <div class="form-group">
          <label for="maxTemperature">Temperatura Máxima (°C)</label>
          <input type="number" id="maxTemperature" name="maxTemperature" step="0.1">
        </div>

        ${offSetTemperatureField}
      </div>
    `;
  }

  private getWaterTankAlarmsHTML(): string {
    return `
      <div class="form-card">
        <h4 class="section-title">Alarmes de Nível</h4>

        <div class="form-group">
          <label for="minWaterLevel">Nível Mínimo (%)</label>
          <input type="number" id="minWaterLevel" name="minWaterLevel" min="0" max="100" step="0.1" placeholder="Risco de falta d'água">
        </div>

        <div class="form-group">
          <label for="maxWaterLevel">Nível Máximo (%)</label>
          <input type="number" id="maxWaterLevel" name="maxWaterLevel" min="0" max="100" step="0.1" placeholder="Risco de transbordar">
        </div>
      </div>
    `;
  }

  /**
   * RFC-0078: Get device type icon SVG based on deviceType
   * Replicates the icon logic from template-card-v5.js
   * Note: Applies 3F_MEDIDOR → deviceProfile fallback rule
   */
  private getDeviceTypeIcon(deviceType: string): string {
    let normalizedType = (deviceType || '').toUpperCase();

    // RFC-0076: If deviceType is 3F_MEDIDOR, check for deviceProfile fallback
    if (normalizedType === '3F_MEDIDOR') {
      const deviceProfile = (this.config as any).deviceProfile;
      if (deviceProfile && deviceProfile !== 'N/D' && deviceProfile.trim() !== '') {
        normalizedType = deviceProfile.toUpperCase();
      }
    }

    // Energy device types
    const energyDevices = [
      'COMPRESSOR',
      'VENTILADOR',
      'ESCADA_ROLANTE',
      'ELEVADOR',
      'MOTOR',
      '3F_MEDIDOR',
      'RELOGIO',
      'ENTRADA',
      'SUBESTACAO',
      'BOMBA',
      'CHILLER',
      'AR_CONDICIONADO',
      'HVAC',
      'FANCOIL',
    ];

    // Water device types
    const waterDevices = ['HIDROMETRO', 'CAIXA_DAGUA', 'TANK'];

    if (energyDevices.includes(normalizedType)) {
      // Energy icon - bolt/lightning
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="device-type-icon energy-icon">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
      `;
    } else if (waterDevices.includes(normalizedType)) {
      // Water icon - droplet
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="device-type-icon water-icon">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
        </svg>
      `;
    } else {
      // Generic icon - device/cpu
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="device-type-icon generic-icon">
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
          <rect x="9" y="9" width="6" height="6"/>
          <line x1="9" y1="1" x2="9" y2="4"/>
          <line x1="15" y1="1" x2="15" y2="4"/>
          <line x1="9" y1="20" x2="9" y2="23"/>
          <line x1="15" y1="20" x2="15" y2="23"/>
          <line x1="20" y1="9" x2="23" y2="9"/>
          <line x1="20" y1="14" x2="23" y2="14"/>
          <line x1="1" y1="9" x2="4" y2="9"/>
          <line x1="1" y1="14" x2="4" y2="14"/>
        </svg>
      `;
    }
  }

  /**
   * Returns an <img> tag with the same image URL used by card v5 (DEVICE_TYPE_CONFIG).
   * Applies the 3F_MEDIDOR → deviceProfile fallback rule (RFC-0076).
   */
  private formatTs(ts?: number | null): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  private getDeviceImage(deviceType?: string): string {
    let normalized = (deviceType || '').toUpperCase();

    // RFC-0076: 3F_MEDIDOR → deviceProfile fallback
    if (normalized === '3F_MEDIDOR') {
      const profile = (this.config as any).deviceProfile;
      if (profile && profile !== 'N/D' && profile.trim() !== '') {
        normalized = profile.toUpperCase();
      }
    }

    const IMAGES: Record<string, string> = {
      ESCADA_ROLANTE: 'https://dashboard.myio-bas.com/api/images/public/EJ997iB2HD1AYYUHwIloyQOOszeqb2jp',
      ELEVADOR:       'https://dashboard.myio-bas.com/api/images/public/rAjOvdsYJLGah6w6BABPJSD9znIyrkJX',
      MOTOR:          'https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT',
      BOMBA_HIDRAULICA: 'https://dashboard.myio-bas.com/api/images/public/rbO2wQb6iKBtX0Ec04DFDcO3Qg04EOoD',
      BOMBA_CAG:      'https://dashboard.myio-bas.com/api/images/public/rbO2wQb6iKBtX0Ec04DFDcO3Qg04EOoD',
      BOMBA_INCENDIO: 'https://dashboard.myio-bas.com/api/images/public/YJkELCk9kluQSM6QXaFINX6byQWI7vbB',
      BOMBA:          'https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT',
      '3F_MEDIDOR':   'https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k',
      RELOGIO:        'https://dashboard.myio-bas.com/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB',
      ENTRADA:        'https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU',
      SUBESTACAO:     'https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU',
      FANCOIL:        'https://dashboard.myio-bas.com/api/images/public/4BWMuVIFHnsfqatiV86DmTrOB7IF0X8Y',
      CHILLER:        'https://dashboard.myio-bas.com/api/images/public/27Rvy9HbNoPz8KKWPa0SBDwu4kQ827VU',
      HIDROMETRO:     'https://dashboard.myio-bas.com/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4',
      HIDROMETRO_AREA_COMUM: 'https://dashboard.myio-bas.com/api/images/public/IbEhjsvixAxwKg1ntGGZc5xZwwvGKv2t',
      HIDROMETRO_SHOPPING: 'https://dashboard.myio-bas.com/api/images/public/OIMmvN4ZTKYDvrpPGYY5agqMRoSaWNTI',
      CAIXA_DAGUA:    'https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq',
      TERMOSTATO:     'https://dashboard.myio-bas.com/api/images/public/rtCcq6kZZVCD7wgJywxEurRZwR8LA7Q7',
    };

    const DEFAULT = 'https://cdn-icons-png.flaticon.com/512/1178/1178428.png';
    const url = IMAGES[normalized] || DEFAULT;
    return `<img src="${url}" class="identity-device-image" alt="${normalized}" />`;
  }

  private getConsumptionLimits() {
    // 1. Garante que o objeto base existe
    const mapPower: any = this.config.mapInstantaneousPower || {};

    // 2. Acessa o array de tipos
    const limitsByType = mapPower.limitsByInstantaneoustPowerType || [];

    // 3. Filtra pelo tipo 'consumption'
    const consumptionGroup = limitsByType.find((group: any) => group.telemetryType === 'consumption');

    // 4. Filtra pelo Device Type configurado no widget
    const targetDeviceType = this.config.deviceType;
    const itemsByDevice = consumptionGroup?.itemsByDeviceType || [];
    const deviceSettings = itemsByDevice.find((item: any) => item.deviceType === targetDeviceType);

    // 5. Extrai a lista de status
    const limitsList = deviceSettings?.limitsByDeviceStatus || [];

    // Helper para extrair valores (Retorna string vazia se não existir)
    const getValues = (statusName: string) => {
      const statusObj = limitsList.find((l: any) => l.deviceStatusName === statusName);
      return statusObj?.limitsValues || { baseValue: '', topValue: '' };
    };

    return {
      hasConfig: !!deviceSettings,
      description: deviceSettings?.description || 'Padrão do Sistema',
      // Valores Globais (JSON)
      standby: getValues('standBy'),
      normal: getValues('normal'),
      alert: getValues('alert'),
      failure: getValues('failure'),
    };
  }

  /**
   * RFC-0078: Power Limits Configuration UI
   * Shows device-level and customer-level consumption limits with telemetry type selector
   */
  private getPowerLimitsHTML(): string {
    // Busca dados do JSON GLOBAL (this.config)
    const globalData = this.getConsumptionLimits();

    // Helper visual para formatar a referência (Ex: "0 a 150 W")
    const fmtRange = (val: any) => {
      if (val.baseValue === '' || val.baseValue === undefined) return '—';
      return `${val.baseValue} a ${val.topValue} W`;
    };

    return `
      <div class="form-card power-limits-card">
        <div class="power-limits-header">
          <h4 class="section-title">Configuração de Limites de Telemetrias Instantâneas</h4>
          <div class="power-limits-subtitle">
            Monitoramento de Consumo (W) para: <strong>${this.config.deviceType || 'N/D'}</strong>
          </div>
        </div>

        <div class="power-limits-controls-row" style="display:flex; gap:20px; align-items: flex-end; margin-bottom: 15px;">
           <div class="telemetry-selector-group" style="flex:1">
            <label for="telemetryType" style="display:block; margin-bottom:5px; font-weight:500;">Tipo de Telemetria</label>
            <select id="telemetryType" name="telemetryType" class="form-select">
                <option value="consumption" selected>Potência Ativa (W)</option>
            </select>
           </div>
        </div>

        <div class="global-reference-container">
          <div class="global-ref-header">
            <span>🌐 Referência Global (${globalData.description})</span>
          </div>
          <div class="global-values-grid">
            <div class="global-value-item">
                <span class="g-status">StandBy 🔌</span>
                <span class="g-range">${fmtRange(globalData.standby)}</span>
            </div>
            <div class="global-value-item">
                <span class="g-status">Normal ⚡</span>
                <span class="g-range">${fmtRange(globalData.normal)}</span>
            </div>
            <div class="global-value-item">
                <span class="g-status">Alerta ⚠️</span>
                <span class="g-range">${fmtRange(globalData.alert)}</span>
            </div>
            <div class="global-value-item">
                <span class="g-status">Falha 🚨</span>
                <span class="g-range">${fmtRange(globalData.failure)}</span>
            </div>
          </div>
        </div>

        <div class="power-limits-table-wrapper">
          <table class="power-limits-table">
            <thead>
              <tr>
                <th style="width: 30%">Status</th>
                <th style="width: 35%">Mínimo (W)</th>
                <th style="width: 35%">Máximo (W)</th>
              </tr>
            </thead>
            <tbody>
              <tr class="limit-row">
                <td class="status-label"><span class="status-icon">🔌</span> StandBy</td>
                <td>
                    <input type="number" 
                           name="standbyLimitDownConsumption" 
                           class="limit-input js-limit-input" 
                           min="0" step="1" 
                           placeholder="Vazio" 
                           data-global-value="${globalData.standby.baseValue}">
                </td>
                <td>
                    <input type="number" 
                           name="standbyLimitUpConsumption" 
                           class="limit-input js-limit-input" 
                           min="0" step="1" 
                           placeholder="Vazio" 
                           data-global-value="${globalData.standby.topValue}">
                </td>
              </tr>
              
              <tr class="limit-row">
                <td class="status-label"><span class="status-icon">⚡</span> Normal</td>
                <td>
                    <input type="number" 
                           name="normalLimitDownConsumption" 
                           class="limit-input js-limit-input" 
                           min="0" step="1" 
                           placeholder="Vazio" 
                           data-global-value="${globalData.normal.baseValue}">
                </td>
                <td>
                    <input type="number" 
                           name="normalLimitUpConsumption" 
                           class="limit-input js-limit-input" 
                           min="0" step="1" 
                           placeholder="Vazio" 
                           data-global-value="${globalData.normal.topValue}">
                </td>
              </tr>

              <tr class="limit-row">
                <td class="status-label"><span class="status-icon">⚠️</span> Alerta</td>
                <td>
                    <input type="number" 
                           name="alertLimitDownConsumption" 
                           class="limit-input js-limit-input" 
                           min="0" step="1" 
                           placeholder="Vazio" 
                           data-global-value="${globalData.alert.baseValue}">
                </td>
                <td>
                    <input type="number" 
                           name="alertLimitUpConsumption" 
                           class="limit-input js-limit-input" 
                           min="0" step="1" 
                           placeholder="Vazio" 
                           data-global-value="${globalData.alert.topValue}">
                </td>
              </tr>

              <tr class="limit-row">
                <td class="status-label"><span class="status-icon">🚨</span> Falha</td>
                <td>
                    <input type="number" 
                           name="failureLimitDownConsumption" 
                           class="limit-input js-limit-input" 
                           min="0" step="1" 
                           placeholder="Vazio" 
                           data-global-value="${globalData.failure.baseValue}">
                </td>
                <td>
                    <input type="number" 
                           name="failureLimitUpConsumption" 
                           class="limit-input js-limit-input" 
                           min="0" step="1" 
                           placeholder="Vazio" 
                           data-global-value="${globalData.failure.topValue}">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="power-limits-actions">
          <button type="button" class="btn-copy-global" id="btnCopyFromGlobal">
            ⬇️ Copiar valores da Referência Global
          </button>
          
          <button type="button" class="btn-clear-overrides" id="btnClearInputs">
            🗑️ Limpar Campos
          </button>
        </div>
      </div>
    `;
  }

  private calculateTimeBetweenDates(data1, data2) {
    // 1. Validação das entradas
    if (!(data1 instanceof Date) || !(data2 instanceof Date)) {
      console.error('Entradas inválidas. As duas entradas devem ser objetos Date.');
      return 'Datas inválidas';
    }

    // 2. Calcular a diferença absoluta em milissegundos
    const diffMs = Math.abs(data1.getTime() - data2.getTime());

    // 3. Definir constantes de conversão
    const msPorMinuto = 1000 * 60;
    const msPorHora = msPorMinuto * 60;
    const msPorDia = msPorHora * 24;

    // 4. Decidir o formato da saída

    // Se a diferença for de 1 dia ou mais
    if (diffMs >= msPorDia) {
      const dias = Math.floor(diffMs / msPorDia);
      return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
    }

    // Se a diferença for de 1 hora ou mais (mas menos de 1 dia)
    if (diffMs >= msPorHora) {
      const horas = Math.floor(diffMs / msPorHora);
      return `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
    }

    // Se a diferença for menor que 1 hora
    const minutos = Math.round(diffMs / msPorMinuto);
    return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
  }

  private getConnectionInfoHTML(): string {
    if (!this.config.connectionData) {
      return '';
    }

    const { centralName, connectionStatusTime, timeVal, deviceStatus, lastDisconnectTime } =
      this.config.connectionData;

    // Format disconnection interval (from disconnect to reconnect)
    let disconnectionIntervalFormatted = 'N/A';
    if (lastDisconnectTime && connectionStatusTime) {
      try {
        const disconnectDate = new Date(lastDisconnectTime);
        const reconnectDate = new Date(connectionStatusTime);

        // Format both dates with seconds
        const disconnectFormatted = disconnectDate.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        const reconnectFormatted = reconnectDate.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        // Calculate duration of disconnection
        const diffMs = reconnectDate.getTime() - disconnectDate.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        let durationText = '';
        if (diffDays > 0) {
          const remainingHours = diffHours % 24;
          durationText = `${diffDays} dia${diffDays > 1 ? 's' : ''}${
            remainingHours > 0 ? ` e ${remainingHours} hora${remainingHours > 1 ? 's' : ''}` : ''
          }`;
        } else if (diffHours > 0) {
          const remainingMinutes = diffMinutes % 60;
          durationText = `${diffHours} hora${diffHours > 1 ? 's' : ''}${
            remainingMinutes > 0 ? ` e ${remainingMinutes} minuto${remainingMinutes > 1 ? 's' : ''}` : ''
          }`;
        } else if (diffMinutes > 0) {
          const remainingSeconds = diffSeconds % 60;
          durationText = `${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}${
            remainingSeconds > 0 ? ` e ${remainingSeconds} segundo${remainingSeconds > 1 ? 's' : ''}` : ''
          }`;
        } else {
          durationText = `${diffSeconds} segundo${diffSeconds !== 1 ? 's' : ''}`;
        }

        disconnectionIntervalFormatted = `${disconnectFormatted} até ${reconnectFormatted} (${durationText})`;
      } catch (e) {
        disconnectionIntervalFormatted = 'Formato inválido';
      }
    }

    // Format connection time - only show if lastConnectTime > lastDisconnectTime (device is connected)
    let connectionTimeFormatted = '—';
    let timeSinceLastConnection = '';
    let isCurrentlyConnected = false;

    if (connectionStatusTime) {
      try {
        const connectDate = new Date(connectionStatusTime);
        const disconnectDate = lastDisconnectTime ? new Date(lastDisconnectTime) : null;

        // Only show "Conectado desde" if lastConnectTime > lastDisconnectTime
        if (!disconnectDate || connectDate.getTime() > disconnectDate.getTime()) {
          isCurrentlyConnected = true;
          connectionTimeFormatted = connectDate.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          // Calculate time since last connection
          const now = new Date();
          const diffMs = now.getTime() - connectDate.getTime();
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          const diffHours = Math.floor(diffMinutes / 60);
          const diffDays = Math.floor(diffHours / 24);
          const remainingMinutes = diffMinutes % 60;

          if (diffDays > 0) {
            const remainingHours = diffHours % 24;
            timeSinceLastConnection = `(${diffDays}d:${remainingHours
              .toString()
              .padStart(2, '0')}hs:${remainingMinutes.toString().padStart(2, '0')}mins atrás)`;
          } else if (diffHours > 0) {
            timeSinceLastConnection = `(${diffHours}hs:${remainingMinutes
              .toString()
              .padStart(2, '0')}mins atrás)`;
          } else if (diffMinutes > 0) {
            timeSinceLastConnection = `(${diffMinutes}mins atrás)`;
          } else {
            timeSinceLastConnection = '(agora)';
          }
        }
      } catch (e) {
        connectionTimeFormatted = '—';
      }
    }

    // Format telemetry time
    let telemetryTimeFormatted = 'N/A';
    let timeSinceLastTelemetry = '';
    if (timeVal) {
      try {
        const telemetryDate = new Date(timeVal);
        telemetryTimeFormatted = telemetryDate.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        // Calculate time difference
        const now = new Date();
        const diffMs = now.getTime() - telemetryDate.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
          timeSinceLastTelemetry = `(${diffDays}d atrás)`;
        } else if (diffHours > 0) {
          timeSinceLastTelemetry = `(${diffHours}h atrás)`;
        } else if (diffMinutes > 0) {
          timeSinceLastTelemetry = `(${diffMinutes}min atrás)`;
        } else {
          timeSinceLastTelemetry = '(agora)';
        }
      } catch (e) {
        telemetryTimeFormatted = 'Formato inválido';
      }
    }

    const statusMap: Record<string, { text: string; color: string }> = {
      ok: { text: 'ONLINE', color: '#22c55e' },
      alert: { text: 'Atenção', color: '#f59e0b' },
      fail: { text: 'OFFLINE', color: '#ef4444' },
      offline: { text: 'OFFLINE', color: '#ef4444' }, // RFC-0130: Added missing offline status
      weak: { text: 'Conexão Fraca', color: '#f59e0b' }, // RFC-0130: Added missing weak status
      not_installed: { text: 'Não instalado', color: '#94a3b8' },
      unknown: { text: 'Sem informação', color: '#94a3b8' },
    };

    const statusInfo = statusMap[mapDeviceStatusToCardStatus(deviceStatus) || ''] || {
      text: 'Desconhecido',
      color: '#6b7280',
    };

    return `
      <div class="form-card info-card-wide">
        <h4 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: text-bottom; margin-right: 6px;">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
          </svg>
          Informações de Conexão
        </h4>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Central:</span>
            <span class="info-value">${centralName || 'N/A'}${
      this.config.customerName ? ` (${this.config.customerName})` : ''
    }</span>
          </div>

          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value" style="color: ${statusInfo.color}; font-weight: 600;">
              ${statusInfo.text}
            </span>
          </div>

          <div class="info-row">
            <span class="info-label">Conectado desde:</span>
            <span class="info-value">
              ${connectionTimeFormatted}
              ${timeSinceLastConnection ? `<span class="time-since">${timeSinceLastConnection}</span>` : ''}
            </span>
          </div>

          <div class="info-row">
            <span class="info-label">Último check status:</span>
            <span class="info-value">
              ${telemetryTimeFormatted}
              ${timeSinceLastTelemetry ? `<span class="time-since">${timeSinceLastTelemetry}</span>` : ''}
            </span>
          </div>
            <div class="info-row full-width">
            <span class="info-label">Último intervalo desconectado:</span>
            <span class="info-value disconnect-interval">
              ${disconnectionIntervalFormatted}
            </span>
          </div>
          <div class="info-row full-width">
            <span class="info-label">Última Telemetria ${this.getTelemetryLabelByDomain()}:</span>
            <span class="info-value" id="lastConsumptionTelemetry">
              <span class="loading-text">Carregando...</span>
            </span>
          </div>
        </div>
      </div>
    `;
  }

  private getModalCSS(): string {
    return `
      <style>
        .myio-device-settings-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .myio-device-settings-modal {
          background: white;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          max-width: 95vw;
          max-height: 90vh;
          width: 1700px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .myio-device-settings-modal * {
          box-sizing: border-box;
        }
        
        .modal-header {
          background: #3e1a7d;
          color: white;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: white;
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: white;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
        
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .modal-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .maximize-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: white;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .maximize-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .myio-device-settings-modal.is-maximized {
          width: 100vw !important;
          max-width: 100vw !important;
          height: 100vh !important;
          max-height: 100vh !important;
          border-radius: 0;
          margin: 0;
        }

        /* RFC-0104: Tab Navigation Styles */
        .modal-tabs {
          display: flex;
          background: #f1f3f5;
          border-bottom: 1px solid #dee2e6;
          padding: 0 24px;
        }

        .modal-tab {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          font-size: 14px;
          font-weight: 500;
          color: #6c757d;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: -1px;
        }

        .modal-tab:hover {
          color: #495057;
          background: rgba(0, 0, 0, 0.03);
        }

        .modal-tab.active {
          color: #3e1a7d;
          border-bottom-color: #3e1a7d;
          background: #fff;
        }

        .modal-tab svg {
          width: 16px;
          height: 16px;
          stroke-width: 2;
        }

        .tab-content {
          min-height: 400px;
        }

        /* Loading spinner for annotations tab */
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e9ecef;
          border-top-color: #3e1a7d;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
          background: #f8f9fa;
        }
        
        .error-message {
          background: #fee;
          border: 1px solid #fcc;
          color: #c33;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
          font-size: 14px;
        }
        
        .form-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* RFC-0077/0078: Customer name display styles with device type icon */
        .customer-name-container {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          padding: 16px 20px;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }

        .customer-info-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .device-type-icon-wrapper {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          backdrop-filter: blur(4px);
        }

        .device-type-icon {
          stroke: white;
          opacity: 0.95;
        }

        .device-type-icon.energy-icon {
          stroke: #ffd700;
        }

        .device-type-icon.water-icon {
          stroke: #00bfff;
        }

        .device-type-icon.generic-icon {
          stroke: white;
        }

        .customer-info-content {
          flex: 1;
          min-width: 0;
        }

        .customer-name-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.75);
          margin-bottom: 4px;
        }

        .customer-name-value {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .shopping-icon {
          stroke: rgba(255, 255, 255, 0.9);
          flex-shrink: 0;
        }

        .customer-name-text {
          font-size: 16px;
          font-weight: 600;
          color: white;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* RFC-0077: Device label with monospace font */
        .device-label-title {
          font-family: 'Courier New', Courier, monospace;
          font-size: 15px;
          letter-spacing: 0.5px;
        }

        .form-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .form-column {
          display: flex;
          flex-direction: column;
        }

        .form-card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 20px;
          height: fit-content;
        }

        /* RFC-0180: Identity card — 2-column × 6-row grid */
        .identity-card {
          padding: 16px 20px;
        }

        .identity-grid {
          display: grid;
          grid-template-columns: minmax(250px, auto) 1fr minmax(250px, auto);
          grid-template-rows: repeat(6, auto);
          gap: 6px 16px;
          align-items: center;
        }

        /* Col 1, rows 1-6: wrapper único para borda contínua */
        .identity-col1 {
          grid-column: 1;
          grid-row: 1 / 7;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-right: 16px;
          border-right: 1px solid #e9ecef;
        }

        .identity-name-block {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 3px;
          overflow: hidden;
          flex: 0 0 auto;
        }

        .identity-name-text {
          font-size: 15px;
          font-weight: 600;
          color: #3e1a7d;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Ícone ocupa o restante do espaço de col 1 */
        .identity-icon-cell {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .identity-device-image {
          width: 102px;
          height: auto;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.12));
          border-radius: 8px;
        }

        .identity-field-label {
          font-size: 10px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          line-height: 1;
        }

        .identity-input {
          width: 100%;
          padding: 5px 10px;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          font-size: 13px;
          color: #343a40;
          background: #fff;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }

        .identity-input:focus {
          outline: none;
          border-color: #3e1a7d;
          box-shadow: 0 0 0 2px rgba(62,26,125,0.1);
        }

        .identity-input[readonly] {
          background: #f8f9fa;
          color: #6c757d;
          cursor: default;
        }

        /* Col 3: date info block */
        .identity-dates-block {
          grid-column: 3;
          grid-row: 1 / 7;
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          gap: 16px;
          padding-left: 16px;
          border-left: 1px solid #e9ecef;
          min-width: 160px;
        }

        .identity-date-row {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .identity-date-label {
          font-size: 10px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .identity-date-value {
          font-size: 12px;
          color: #495057;
          font-variant-numeric: tabular-nums;
        }

        /* RFC-0180: Muted raw deviceName shown below the user label */
        .device-name-subtitle {
          display: block;
          font-size: 11px;
          color: #9ca3af;
          font-family: 'Courier New', Courier, monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
          margin-bottom: 0;
        }

        .device-name-subtitle:empty {
          display: none;
        }

        .section-title {
          margin: 0 0 20px 0;
          font-size: 16px;
          font-weight: 600;
          color: #3e1a7d;
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
          margin-bottom: 16px;
        }
        
        .form-group:last-child {
          margin-bottom: 0;
        }
        
        .form-group label {
          font-weight: 500;
          margin-bottom: 6px;
          color: #333;
          font-size: 14px;
        }
        
        .form-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        
        .form-group input:focus {
          outline: none;
          border-color: #3e1a7d;
          box-shadow: 0 0 0 2px rgba(62, 26, 125, 0.25);
        }
        
        .form-group input:invalid {
          border-color: #dc3545;
        }
        
        .form-group input[readonly] {
          background-color: #f8f9fa;
          color: #6c757d;
          cursor: not-allowed;
        }
        
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: white;
        }
        
        .modal-footer button {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-cancel {
          background: #6c757d;
          color: white;
        }
        
        .btn-cancel:hover:not(:disabled) {
          background: #545b62;
        }
        
        .btn-primary {
          background: #3e1a7d;
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: #2d1458;
        }
        
        .modal-footer button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

      .global-reference-container {
        background-color: #f8f9fa;
        border: 1px dashed #cbd5e1;
        border-radius: 6px;
        padding: 12px 16px;
        margin-top: 8px;
        margin-bottom: 16px;
      }

      .global-ref-header {
        font-size: 12px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .global-values-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr); /* 4 Colunas para os 4 status */
        gap: 12px;
      }

      .global-value-item {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }

      .g-status {
        font-size: 11px;
        font-weight: 600;
        color: #475569;
        margin-bottom: 2px;
      }

      .g-range {
        font-family: 'Courier New', monospace;
        font-size: 13px;
        font-weight: 700;
        color: #3e1a7d;
      }

      /* Responsividade para telas pequenas */
      @media (max-width: 768px) {
        .global-values-grid {
          grid-template-columns: 1fr 1fr; /* 2 colunas em mobile */
        }
      }
        
        /* Responsive design */
        @media (max-width: 1024px) {
          .myio-device-settings-modal {
            width: 95vw !important;
          }
          
          .form-columns {
            gap: 16px;
          }
          
          .form-card {
            padding: 16px;
          }
        }
        
        @media (max-width: 768px) {
          .myio-device-settings-modal {
            width: 95vw !important;
            margin: 10px;
          }

          .form-columns {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .info-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .modal-header, .modal-body, .modal-footer {
            padding-left: 16px;
            padding-right: 16px;
          }

          .form-card {
            padding: 16px;
          }
        }
        
        /* Scrollbar styling for modal body */
        .modal-body::-webkit-scrollbar {
          width: 6px;
        }
        
        .modal-body::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        
        .modal-body::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }
        
        .modal-body::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }

        /* Connection Info Card Styles - Wide layout spanning 2 columns */
        .info-card-wide {
          margin-top: 20px;
          background: linear-gradient(135deg, #f8fafc 0%, #f0f9ff 100%);
          border: 1px solid #e0e7ff;
          grid-column: 1 / -1; /* Span all columns */
        }

        .info-card-wide .section-title {
          color: #2563eb;
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px 24px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 6px;
          border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .info-label {
          font-weight: 600;
          color: #475569;
          font-size: 13px;
          flex-shrink: 0;
        }

        .info-value {
          text-align: right;
          color: #1e293b;
          font-size: 13px;
          word-break: break-word;
          margin-left: 12px;
        }

        .time-since {
          display: inline-block;
          margin-left: 6px;
          color: #64748b;
          font-size: 12px;
          font-style: italic;
        }

        .disconnect-interval {
          font-size: 12px;
          line-height: 1.4;
        }

        .info-row.full-width {
          grid-column: 1 / -1; /* Span all columns */
        }

        .loading-text {
          color: #64748b;
          font-style: italic;
        }

        .consumption-value-display {
          font-weight: 600;
          color: #3e1a7d;
        }

        .consumption-date {
          color: #475569;
        }

        .telemetry-error {
          color: #dc2626;
          font-style: italic;
        }

        .telemetry-no-data {
          color: #94a3b8;
          font-style: italic;
        }

        /* RFC-0078: Power Limits Configuration Styles */
        .power-limits-card {
          grid-column: 1 / -1; /* Span full width */
          margin-top: 20px;
        }

        .power-limits-header {
          margin-bottom: 20px;
        }

        .power-limits-subtitle {
          font-size: 13px;
          color: #6c757d;
          margin-top: 8px;
        }

        /* RFC-0078: Telemetry Type Selector Styles */
        .telemetry-selector {
          margin-bottom: 16px;
        }

        .telemetry-selector label {
          display: block;
          font-weight: 500;
          margin-bottom: 6px;
          color: #333;
          font-size: 14px;
        }

        .form-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          background-color: white;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .form-select:focus {
          outline: none;
          border-color: #3e1a7d;
          box-shadow: 0 0 0 2px rgba(62, 26, 125, 0.25);
        }

        .form-select:hover {
          border-color: #3e1a7d;
        }

        .power-limits-table-wrapper {
          overflow-x: auto;
          margin-bottom: 16px;
        }

        .power-limits-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .power-limits-table thead {
          background: #f8f9fa;
        }

        .power-limits-table th {
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #495057;
          border-bottom: 2px solid #dee2e6;
        }

        .power-limits-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #e9ecef;
        }

        .limit-row:hover {
          background: #f8f9fa;
        }

        .status-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }

        .status-icon {
          font-size: 18px;
        }

        .limit-input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .limit-input:focus {
          outline: none;
          border-color: #3e1a7d;
          box-shadow: 0 0 0 2px rgba(62, 26, 125, 0.15);
        }

        .power-limits-source-info {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #dee2e6;
        }

        .source-label {
          font-weight: 600;
          color: #495057;
          font-size: 14px;
        }

        .source-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          background: #e9ecef;
          color: #495057;
        }

        .source-badge.global-source {
          background: #3e1a7d;
          color: #fff;
          padding: 6px 14px;
          font-size: 13px;
        }

        .source-badge.source-device {
          background: #cfe2ff;
          color: #084298;
        }

        .source-badge.source-global {
          background: #d1e7dd;
          color: #0f5132;
        }

        .source-badge.source-hardcoded {
          background: #f8d7da;
          color: #842029;
        }

        .power-limits-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .btn-copy-global,
        .btn-clear-overrides {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-copy-global {
          background: #198754;
          color: white;
        }

        .btn-copy-global:hover {
          background: #157347;
        }

        .btn-clear-overrides {
          background: #0d6efd;
          color: white;
        }

        .btn-clear-overrides:hover {
          background: #0b5ed7;
        }

        .btn-view-json {
          background: #6c757d;
          color: white;
        }

        .btn-view-json:hover {
          background: #5a6268;
        }

        /* RFC-0078: JSON Preview Panel Styles */
        .json-preview-panel {
          background: #1e1e1e;
          border-radius: 6px;
          margin-bottom: 16px;
          overflow: hidden;
        }

        .json-preview-header {
          background: #2d2d2d;
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .json-preview-header h5 {
          margin: 0;
          color: #e0e0e0;
          font-size: 14px;
          font-weight: 600;
        }

        .btn-close-json {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 16px;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .btn-close-json:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .json-content {
          margin: 0;
          padding: 16px;
          color: #d4d4d4;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          line-height: 1.5;
          overflow-x: auto;
          max-height: 300px;
          overflow-y: auto;
        }

        .power-limits-legend {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 3px solid #3e1a7d;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .legend-text {
          font-size: 13px;
          color: #495057;
        }

        @media (max-width: 768px) {
          .power-limits-table {
            font-size: 12px;
          }

          .power-limits-table th,
          .power-limits-table td {
            padding: 8px;
          }

          .limit-input {
            padding: 6px 8px;
            font-size: 12px;
          }

          .power-limits-actions {
            flex-direction: column;
          }

          .btn-copy-global,
          .btn-clear-overrides {
            width: 100%;
          }
        }

        /* Mobile-specific responsive styles (< 480px) */
        @media (max-width: 480px) {
          .myio-device-settings-overlay {
            padding: 8px;
            overflow-x: hidden;
          }

          .myio-device-settings-modal {
            width: calc(100% - 16px) !important;
            max-width: calc(100vw - 16px);
            height: auto;
            max-height: calc(100vh - 16px);
            margin: 0 auto;
            border-radius: 8px;
            box-sizing: border-box;
          }

          .modal-header {
            padding: 12px 16px;
          }

          .modal-header h3 {
            font-size: 16px;
          }

          .close-btn {
            width: 36px;
            height: 36px;
            font-size: 28px;
          }

          /* Tabs - horizontal scroll */
          .modal-tabs {
            padding: 0 12px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .modal-tab {
            padding: 10px 14px;
            font-size: 13px;
            white-space: nowrap;
            flex-shrink: 0;
          }

          .modal-tab svg {
            width: 14px;
            height: 14px;
          }

          .modal-body {
            padding: 12px;
          }

          .tab-content {
            min-height: auto;
          }

          .form-card {
            padding: 12px;
          }

          .section-title {
            font-size: 14px;
            margin-bottom: 14px;
          }

          .form-group label {
            font-size: 13px;
          }

          .form-group input {
            padding: 12px;
            font-size: 16px; /* Prevents zoom on iOS */
          }

          /* Customer info row */
          .customer-info-row {
            flex-direction: column;
            text-align: center;
            gap: 12px;
          }

          .device-type-icon-wrapper {
            width: 40px;
            height: 40px;
          }

          .customer-name-text {
            font-size: 14px;
          }

          /* Connection info */
          .info-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .info-value {
            text-align: left;
            margin-left: 0;
          }

          /* Modal footer */
          .modal-footer {
            padding: 12px 16px;
            flex-direction: column-reverse;
            gap: 8px;
          }

          .modal-footer button {
            width: 100%;
            padding: 12px 20px;
          }

          /* Global reference grid */
          .global-values-grid {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .global-value-item {
            padding: 4px 6px;
          }

          .g-status {
            font-size: 10px;
          }

          .g-range {
            font-size: 11px;
          }

          /* Power limits table */
          .power-limits-table th,
          .power-limits-table td {
            padding: 6px;
          }

          .status-label {
            font-size: 12px;
          }

          .status-icon {
            font-size: 14px;
          }

          .limit-input {
            padding: 10px 8px;
            font-size: 16px; /* Prevents zoom on iOS */
          }
        }
      </style>
    `;
  }

  private populateForm(data: Record<string, any>): void {
    for (const [key, value] of Object.entries(data)) {
      const input = this.form.querySelector(`[name="${key}"]`) as HTMLInputElement;
      if (input && value !== undefined && value !== null) {
        input.value = String(value);
      }
    }
  }

  private setupAccessibility(): void {
    // Set initial focus to first input
    const firstInput = this.modal.querySelector('input') as HTMLInputElement;
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }

    // Setup ARIA relationships
    this.modal.setAttribute('aria-labelledby', 'modal-title');
  }

  private setupFocusTrap(): void {
    // Get all focusable elements
    this.focusTrapElements = Array.from(
      this.modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ) as HTMLElement[];

    // Handle Tab key for focus trap
    this.modal.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private teardownFocusTrap(): void {
    this.modal.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.config.closeOnBackdrop !== false) {
      event.preventDefault();
      this.config.onClose();
      return;
    }

    if (event.key === 'Tab') {
      const firstElement = this.focusTrapElements[0];
      const lastElement = this.focusTrapElements[this.focusTrapElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  /**
   * Helper: Traduz o JSON RFC-0086 (deviceMapInstaneousPower)
   * para os campos planos do formulário (ex: standbyLimitUpConsumption)
   */
  private parseDeviceSavedLimits(deviceJson: any): Record<string, any> {
    const extracted: Record<string, any> = {};

    try {
      // Validação básica da estrutura
      if (!deviceJson || !deviceJson.limitsByInstantaneoustPowerType) return extracted;

      // Pega o grupo de consumo (consumption)
      const consumptionGroup = deviceJson.limitsByInstantaneoustPowerType.find(
        (g: any) => g.telemetryType === 'consumption'
      );

      // Pega o primeiro item de dispositivo (no Device Scope só deve haver um)
      const deviceItem = consumptionGroup?.itemsByDeviceType?.[0];

      if (!deviceItem?.limitsByDeviceStatus) return extracted;

      // Mapeia o nome do status no JSON para o prefixo do input HTML
      // JSON: "standBy" -> Input: "standby..."
      const mapPrefix: Record<string, string> = {
        standBy: 'standby',
        normal: 'normal',
        alert: 'alert',
        failure: 'failure',
      };

      deviceItem.limitsByDeviceStatus.forEach((status: any) => {
        const prefix = mapPrefix[status.deviceStatusName];

        if (prefix && status.limitsValues) {
          const { baseValue, topValue } = status.limitsValues;

          // Extrai valores apenas se existirem (não forem null ou undefined)
          if (baseValue !== null && baseValue !== undefined) {
            extracted[`${prefix}LimitDownConsumption`] = baseValue;
          }
          if (topValue !== null && topValue !== undefined) {
            extracted[`${prefix}LimitUpConsumption`] = topValue;
          }
        }
      });
    } catch (e) {
      console.warn('[SettingsModalView] Erro ao processar deviceMapInstaneousPower:', e);
    }

    return extracted;
  }

  private attachEventListeners(): void {
    // RFC-0104/0180: Handle tab switching (general | annotations | alarms)
    const tabButtons = this.modal.querySelectorAll('.modal-tab');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const tab = (btn as HTMLElement).dataset.tab as 'general' | 'annotations' | 'alarms';
        if (tab) {
          this.switchTab(tab);
        }
      });
    });

    // RFC-0180: "Alarms tab" link button inside the alarm placeholder card
    this.modal.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.dataset.tabLink === 'alarms') {
        event.preventDefault();
        this.switchTab('alarms');
      }
    });

    // Handle form submission
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.hideError();

      const formData = this.getFormData();
      this.config.onSave(formData);
    });

    // Handle maximize button
    const maximizeBtn = this.modal.querySelector('.maximize-btn') as HTMLButtonElement;
    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isMaximized = this.modal.classList.toggle('is-maximized');
        maximizeBtn.setAttribute('aria-label', isMaximized ? 'Restaurar' : 'Maximizar');
        maximizeBtn.title = isMaximized ? 'Restaurar' : 'Maximizar';
        // Toggle icon between maximize and restore
        maximizeBtn.innerHTML = isMaximized
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
      });
    }

    // Handle close button (X button)
    const closeBtn = this.modal.querySelector('.close-btn') as HTMLButtonElement;
    if (closeBtn) {
      closeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.config.onClose();
      });
    }

    // Handle cancel button (Fechar button)
    const cancelBtn = this.modal.querySelector('.btn-cancel') as HTMLButtonElement;
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.config.onClose();
      });
    }

    // Handle save button (Salvar button)
    const saveBtn = this.modal.querySelector('.btn-save') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.hideError();

        const formData = this.getFormData();
        this.config.onSave(formData);
      });
    }

    const btnCopy = this.modal.querySelector('#btnCopyFromGlobal') as HTMLButtonElement;
    if (btnCopy) {
      btnCopy.addEventListener('click', (e) => {
        e.preventDefault(); // Previne submissão do form
        e.stopPropagation();

        // Busca todos os inputs que tem a classe marcadora
        const inputs = this.modal.querySelectorAll('.js-limit-input');

        inputs.forEach((el) => {
          const input = el as HTMLInputElement;
          const globalVal = input.getAttribute('data-global-value');

          // Só copia se existir um valor global válido
          if (globalVal !== null && globalVal !== '' && globalVal !== 'undefined') {
            input.value = globalVal;

            // Dispara evento 'input' para notificar validações ou frameworks reativos se houver
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      });
    }

    // 2. Botão Limpar Campos
    const btnClear = this.modal.querySelector('#btnClearInputs') as HTMLButtonElement;
    if (btnClear) {
      btnClear.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const inputs = this.modal.querySelectorAll('.js-limit-input');

        inputs.forEach((el) => {
          const input = el as HTMLInputElement;
          input.value = ''; // Limpa o valor visualmente
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    }

    // Handle backdrop click
    this.container.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;

      if (target.classList.contains('myio-device-settings-overlay') && this.config.closeOnBackdrop !== false) {
        this.config.onClose();
      }
    });

    // Real-time validation
    this.form.addEventListener('input', this.handleInputValidation.bind(this));
  }

  private handleInputValidation(event: Event): void {
    const input = event.target as HTMLInputElement;

    // Clear previous validation state
    input.classList.remove('is-invalid');

    // GUID validation
    if (input.name === 'guid' && input.value) {
      const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!guidPattern.test(input.value)) {
        input.classList.add('is-invalid');
        input.setCustomValidity('Invalid GUID format');
      } else {
        input.setCustomValidity('');
      }
    }

    // Numeric validation
    if (input.type === 'number' && input.value) {
      const num = parseFloat(input.value);
      if (isNaN(num) || num < 0) {
        input.classList.add('is-invalid');
        input.setCustomValidity('Must be a positive number');
      } else {
        input.setCustomValidity('');
      }
    }
  }

  private applyTheme(): void {
    if (this.config.themeTokens) {
      const style = document.createElement('style');
      let css = '';

      for (const [property, value] of Object.entries(this.config.themeTokens)) {
        css += `--myio-${property}: ${value};\n`;
      }

      style.textContent = `.myio-device-settings-modal { ${css} }`;
      this.container.appendChild(style);
    }
  }

  private getI18nText(key: string, defaultText: string): string {
    return this.config.i18n?.t(key, defaultText) || defaultText;
  }

  /**
   * Fetch the latest telemetry from ThingsBoard
   * Shows the most recent value with timestamp
   * Uses different keys based on domain: consumption (energy), temperature, pulses (water)
   */
  private async fetchLatestConsumptionTelemetry(): Promise<void> {
    const telemetryElement = this.modal.querySelector('#lastConsumptionTelemetry');
    if (!telemetryElement) return;

    const deviceId = this.config.deviceId;
    const jwtToken = this.config.jwtToken;
    const domain = this.config.domain || 'energy';

    if (!deviceId || !jwtToken) {
      telemetryElement.innerHTML = '<span class="telemetry-error">N/A</span>';
      return;
    }

    // Determine telemetry key and display config based on domain
    type TelemetryConfig = {
      key: string;
      unit: string;
      label: string;
      formatter: (value: number) => string;
    };

    const decimalPlaces = this.config.consumptionDecimalPlaces ?? 3;
    const telemetryConfigByDomain: Record<string, TelemetryConfig> = {
      energy: {
        key: 'consumption',
        unit: 'kW',
        label: 'Consumo',
        formatter: (v) => (v / 1000).toFixed(decimalPlaces), // W to kW
      },
      temperature: {
        key: 'temperature',
        unit: '°C',
        label: 'Temperatura',
        formatter: (v) => v.toFixed(1),
      },
      water: {
        key: 'pulses',
        unit: 'L',
        label: 'Pulsos',
        formatter: (v) => v.toFixed(0),
      },
    };

    const telemetryConfig = telemetryConfigByDomain[domain] || telemetryConfigByDomain.energy;

    try {
      // Fetch the latest single telemetry point
      // RFC-0130: Extended window from 24h to 7 days to show older telemetry data
      const endTs = Date.now();
      const startTs = endTs - 7 * 24 * 60 * 60 * 1000; // Last 7 days
      const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${telemetryConfig.key}&startTs=${startTs}&endTs=${endTs}&limit=1&orderBy=DESC`;

      const response = await fetch(url, {
        headers: {
          'X-Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const telemetryData = data[telemetryConfig.key];

      if (telemetryData && telemetryData.length > 0) {
        const latestPoint = telemetryData[0];
        const rawValue = parseFloat(latestPoint.value);
        const timestamp = latestPoint.ts;

        // Format value using domain-specific formatter
        const formattedValue = telemetryConfig.formatter(rawValue);

        // Format timestamp with seconds
        const date = new Date(timestamp);
        const formattedDate = date.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        // Calculate time since
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const remainingMinutes = diffMinutes % 60;

        let timeSince = '';
        if (diffHours > 0) {
          timeSince = `(${diffHours}hs:${remainingMinutes.toString().padStart(2, '0')}mins atrás)`;
        } else if (diffMinutes > 0) {
          timeSince = `(${diffMinutes}mins atrás)`;
        } else {
          timeSince = '(agora)';
        }

        telemetryElement.innerHTML = `
          <span class="consumption-value-display">${formattedValue} ${telemetryConfig.unit}</span>
          <span class="consumption-date">- ${formattedDate}</span>
          <span class="time-since">${timeSince}</span>
        `;
      } else {
        telemetryElement.innerHTML = '<span class="telemetry-no-data">Sem dados</span>';
      }
    } catch (error) {
      console.error('[SettingsModal] Failed to fetch telemetry:', error);
      telemetryElement.innerHTML = '<span class="telemetry-error">Erro ao carregar</span>';
    }
  }
}

type Domain = 'energy' | 'water' | 'temperature';
