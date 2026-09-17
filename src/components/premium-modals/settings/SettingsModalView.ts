import { ModalConfig, InterpolatedSlot } from './types';
import { mapDeviceStatusToCardStatus } from '../../../utils/devices/deviceStatus';
import { deviceIcons, DEFAULT_DEVICE_ICON } from '../../../utils/devices/deviceIcons';
import { ModalHeader } from '../../../utils/ModalHeader';
import { AnnotationsTab } from './annotations/AnnotationsTab';
import { AlarmsTab } from './alarms/AlarmsTab';
import { ExclusionGroupsTab } from './exclusion-groups/ExclusionGroupsTab';
import { createTicketsTab } from './tickets/TicketsTab';
import { getAnnotationPermissions } from '../../../utils/superAdminUtils';
import type { UserInfo, PermissionSet } from './annotations/types';
import {
  createInputDateRangePickerInsideDIV,
  type DateRangeInputController,
} from '../../createInputDateRangePickerInsideDIV';

// RFC-0171: Allowed email domain for superadmin editing permissions
const ALLOWED_EMAIL_DOMAIN = '@myio.com.br';

export class SettingsModalView {
  private container!: HTMLElement;
  private modal!: HTMLElement;
  private form!: HTMLFormElement;
  private config: ModalConfig;
  private focusTrapElements: HTMLElement[] = [];
  private originalActiveElement: Element | null = null;
  // RFC-0104: Annotations Tab
  private annotationsTab: AnnotationsTab | null = null;
  // RFC-0180: Alarms Tab
  private alarmsTab: AlarmsTab | null = null;
  // RFC-0198: Chamados Tab
  private chamadosTabHandle: { destroy(): void } | null = null;
  // Exclusão de Grupos tab
  private exclusionGroupsTab: ExclusionGroupsTab | null = null;
  private currentTab: 'general' | 'annotations' | 'alarms' | 'chamados' | 'exclusion-groups' | 'incidents' = 'general';
  private currentUser: UserInfo | null = null;
  private permissions: PermissionSet | null = null;
  // RFC-0190: Exclude Groups Totals
  private excludeGroupsEnabled = false;
  private excludedGroups: string[] = [];

  // RFC-0232: Incidentes tab filters (search/devices/period) — client-side
  // state, all derived from `config.interpolatedSlots` (the host's one
  // pre-fetch). `incidentsIdSuffix` is only needed because
  // createInputDateRangePickerInsideDIV() does a global `document.getElementById`
  // internally — every other Incidentes element is found via `this.modal.querySelector`,
  // which is safely scoped even with duplicate ids across simultaneous instances.
  private incidentsIdSuffix = Math.random().toString(36).slice(2, 10);
  private incidentsAllSlots: InterpolatedSlot[] = [];
  private incidentsSelectedDevices: Set<string> = new Set();
  private incidentsSearch = '';
  private incidentsDateRange: { startISO: string | null; endISO: string | null } = { startISO: null, endISO: null };
  private incidentsDateRangeController: DateRangeInputController | null = null;

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

  /**
   * Check if the user may edit the "Identificador" field.
   * True when isSuperAdmin() OR the caller already resolved the user as a
   * holding admin (USER SERVER_SCOPE attrs isHolding=true AND isUserAdmin=true
   * — see detectHoldingUserAdmin in utils/superAdminUtils.ts).
   */
  private canEditIdentifier(): boolean {
    return this.isSuperAdmin() || this.config.holdingAdmin === true;
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
    // RFC-0198: Initialize chamados tab
    this.initChamadosTab();
    // Exclusão de Grupos tab (async, energy domain only)
    this.initExclusionGroupsTab();
    // RFC-0232: Incidentes tab (central + admin MyIO only) — search/devices
    // filters are plain sync listeners, the period picker loads its CDN deps async.
    if (this.config.isGateway && this.isSuperAdmin()) {
      this.bindIncidentsTabEvents();
      this.initIncidentsDateRange();
    }
    // Seed tab badges from available orchestrators + initialData
    this._updateTabBadges(initialData);
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

    const { gcdrDeviceId, prefetchedBundle, prefetchedAlarms, prefetchedRules, deviceId, jwtToken } =
      this.config;

    if (!gcdrDeviceId) {
      // Lock the tab button visually
      const tabBtn = this.modal.querySelector<HTMLElement>('.modal-tab[data-tab="alarms"]');
      if (tabBtn) tabBtn.classList.add('locked');

      container.innerHTML = `
        <div style="
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          min-height:320px; padding:40px 24px; text-align:center;
        ">
          <div style="
            width:72px; height:72px; border-radius:50%;
            background:#f3f4f6; border:1.5px solid #e5e7eb;
            display:flex; align-items:center; justify-content:center;
            font-size:32px; margin-bottom:20px; opacity:0.7;
          ">🔒</div>
          <div style="font-size:15px; font-weight:600; color:#374151; margin-bottom:8px;">
            Alarmes não disponíveis
          </div>
          <div style="font-size:13px; color:#9ca3af; max-width:320px; line-height:1.6;">
            Este dispositivo não está vinculado ao sistema GCDR.<br>
            O identificador <code style="font-size:11px;background:#f3f4f6;padding:1px 5px;border-radius:3px;">gcdrDeviceId</code>
            não foi encontrado nos atributos do servidor.
          </div>
        </div>`;
      return;
    }

    try {
      this.alarmsTab = new AlarmsTab({
        container,
        gcdrDeviceId,
        tbDeviceId: deviceId ?? '',
        jwtToken: jwtToken ?? '',
        prefetchedBundle: prefetchedBundle ?? null,
        prefetchedAlarms: prefetchedAlarms ?? null,
        prefetchedRules: prefetchedRules ?? null,
        deviceProfile: this.config.deviceProfile,
        masterAdminPassword: this.config.masterAdminPassword,
      });
      await this.alarmsTab.init();
      console.log('[SettingsModalView] RFC-0180: Alarms tab initialized');
    } catch (error) {
      console.error('[SettingsModalView] Failed to initialize alarms tab:', error);
      container.innerHTML =
        '<p style="color:#dc3545;padding:20px;text-align:center;">Erro ao carregar alarmes</p>';
    }
  }

  // RFC-0198: Initialize the Chamados Tab
  private initChamadosTab(): void {
    const container = this.modal.querySelector('#chamados-tab-content') as HTMLElement;
    if (!container) return;

    const freshdeskApiKey =
      (window as unknown as { MyIOUtils?: { freshdeskApiKey?: string } }).MyIOUtils?.freshdeskApiKey ?? '';
    const freshdeskDomain =
      (window as unknown as { MyIOUtils?: { freshdeskDomain?: string } }).MyIOUtils?.freshdeskDomain ??
      'myiocom.freshdesk.com';

    const deviceIdentifier = this.config.identifier ?? this.config.deviceId ?? '';

    const ticketsEnabled =
      (window as unknown as { MyIOUtils?: { ticketsEnabled?: boolean } }).MyIOUtils?.ticketsEnabled;

    if (ticketsEnabled !== true) {
      // Customer has tickets_enabled=false — remove tab entirely
      this.modal.querySelector('[data-tab="chamados"]')?.remove();
      this.modal.querySelector('#chamados-tab-content')?.remove();
      return;
    }

    if (!freshdeskApiKey) {
      // API key not configured — lock tab button visually (tab visible but locked)
      const tabBtn = this.modal.querySelector<HTMLElement>('.modal-tab[data-tab="chamados"]');
      if (tabBtn) tabBtn.classList.add('locked');
    }

    try {
      this.chamadosTabHandle = createTicketsTab({
        container,
        deviceIdentifier,
        tbDeviceId: this.config.deviceId ?? '',
        deviceLabel: this.config.deviceLabel,
        freshdeskApiKey,
        freshdeskDomain,
        prefetchedTickets: null,
        jwtToken: localStorage.getItem('jwt_token') ?? undefined,
        tbBaseUrl: window.location.origin,
        requesterEmail: this.config.userEmail
          ?? (window as unknown as { MyIOUtils?: { currentUserEmail?: string | null } }).MyIOUtils?.currentUserEmail
          ?? undefined,
      });
      console.log('[SettingsModalView] RFC-0198: Chamados tab initialized');
    } catch (error) {
      console.error('[SettingsModalView] Failed to initialize chamados tab:', error);
      container.innerHTML =
        '<p style="color:#dc3545;padding:20px;text-align:center;">Erro ao carregar chamados</p>';
    }
  }

  // ==========================================================================
  // Tab badges
  // ==========================================================================

  /** Update a single tab badge. Pass count=0 to hide it. */
  updateTabBadge(tab: 'annotations' | 'alarms' | 'chamados' | 'exclusion-groups', count: number): void {
    const badgeId = tab === 'exclusion-groups' ? 'tab-badge-exclusion-groups' : `tab-badge-${tab}`;
    const badge = this.modal.querySelector<HTMLElement>(`#${badgeId}`);
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  /**
   * Seed all tab badges immediately from orchestrators + initialData.
   * Tabs that load async (alarms, chamados) may call updateTabBadge() later.
   */
  private _updateTabBadges(initialData: Record<string, unknown>): void {
    // ── Anotações ── count active (non-archived) annotations from log_annotations
    try {
      let rawAnnotations = initialData['log_annotations'];
      if (typeof rawAnnotations === 'string') rawAnnotations = JSON.parse(rawAnnotations);
      const annotationsArr: unknown[] = Array.isArray((rawAnnotations as { annotations?: unknown[] })?.annotations)
        ? (rawAnnotations as { annotations: unknown[] }).annotations
        : Array.isArray(rawAnnotations) ? (rawAnnotations as unknown[]) : [];
      const activeAnnotations = annotationsArr.filter(
        (a) => (a as { status?: string })?.status !== 'archived'
      ).length;
      this.updateTabBadge('annotations', activeAnnotations);
    } catch { /* ignore */ }

    // ── Alarmes ── from AlarmServiceOrchestrator (sync, available at render time)
    try {
      const aso = (window as unknown as { AlarmServiceOrchestrator?: { getAlarmCountForDevice(id: string): number } })
        .AlarmServiceOrchestrator;
      if (aso && this.config.gcdrDeviceId) {
        this.updateTabBadge('alarms', aso.getAlarmCountForDevice(this.config.gcdrDeviceId));
      }
    } catch { /* ignore */ }

    // ── Chamados ── from TicketServiceOrchestrator (sync, available at render time)
    try {
      const tso = (window as unknown as { TicketServiceOrchestrator?: { getTicketCountForDevice(id: string): number } })
        .TicketServiceOrchestrator;
      if (tso && this.config.identifier) {
        this.updateTabBadge('chamados', tso.getTicketCountForDevice(this.config.identifier));
      }
    } catch { /* ignore */ }

    // ── Excluir Grupos ── from excludeGroupsEnabled / excludedGroups (set during init)
    // Will be updated by initExclusionGroupsTab after it loads
  }

  // Exclusão de Grupos: Initialize the tab (energy domain only)
  private async initExclusionGroupsTab(): Promise<void> {
    if (this.config.domain !== 'energy') {
      this.modal.querySelector('[data-tab="exclusion-groups"]')?.remove();
      return;
    }

    const container = this.modal.querySelector('#exclusion-groups-tab-content') as HTMLElement;
    if (!container) return;

    const { deviceId, jwtToken, tbBaseUrl } = this.config;

    if (!deviceId || !jwtToken) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    min-height:320px;padding:40px 24px;text-align:center;">
          <div style="font-size:15px;font-weight:600;color:#374151;margin-bottom:8px;">
            Exclusão de grupos não disponível
          </div>
          <div style="font-size:13px;color:#9ca3af;max-width:320px;line-height:1.6;">
            deviceId ou jwtToken não disponíveis para carregar configurações.
          </div>
        </div>`;
      return;
    }

    try {
      this.exclusionGroupsTab = new ExclusionGroupsTab({
        container,
        deviceId,
        jwtToken,
        tbBaseUrl: tbBaseUrl ?? window.location.origin,
      });
      await this.exclusionGroupsTab.init();
      this.updateTabBadge('exclusion-groups', this.exclusionGroupsTab.getExcludedCount());
      console.log('[SettingsModalView] ExclusionGroupsTab initialized');
    } catch (error) {
      console.error('[SettingsModalView] Failed to initialize ExclusionGroupsTab:', error);
      container.innerHTML =
        '<p style="color:#dc3545;padding:20px;text-align:center;">Erro ao carregar configurações de exclusão</p>';
    }
  }

  // RFC-0104 / RFC-0180 / RFC-0198: Switch between tabs
  private switchTab(
    tab: 'general' | 'annotations' | 'alarms' | 'chamados' | 'exclusion-groups' | 'incidents'
  ): void {
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
    const chamadosContent = this.modal.querySelector('#chamados-tab-content') as HTMLElement;
    const exclusionGroupsContent = this.modal.querySelector('#exclusion-groups-tab-content') as HTMLElement;
    const incidentsContent = this.modal.querySelector('#incidents-tab-content') as HTMLElement;

    if (generalContent) generalContent.style.display = tab === 'general' ? 'block' : 'none';
    if (annotationsContent) annotationsContent.style.display = tab === 'annotations' ? 'block' : 'none';
    if (alarmsContent) alarmsContent.style.display = tab === 'alarms' ? 'block' : 'none';
    if (chamadosContent) chamadosContent.style.display = tab === 'chamados' ? 'block' : 'none';
    if (exclusionGroupsContent) exclusionGroupsContent.style.display = tab === 'exclusion-groups' ? 'block' : 'none';
    if (incidentsContent) incidentsContent.style.display = tab === 'incidents' ? 'block' : 'none';

    // Update footer Save button (only on General tab; all other tabs have own save)
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

    // RFC-0198: Clean up chamados tab
    if (this.chamadosTabHandle) {
      this.chamadosTabHandle.destroy();
      this.chamadosTabHandle = null;
    }

    // Cleanup exclusion groups tab
    if (this.exclusionGroupsTab) {
      this.exclusionGroupsTab.destroy();
      this.exclusionGroupsTab = null;
    }

    // RFC-0232: Clean up the Incidentes tab's period picker (jQuery plugin instance)
    if (this.incidentsDateRangeController) {
      this.incidentsDateRangeController.destroy();
      this.incidentsDateRangeController = null;
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
    const MAP: Record<string, string> = {
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
          ${ModalHeader.generateHTML({ icon: '⚙️', title: `Configurações${this.config.customerName ? ` — ${this.config.customerName}` : ''}`, modalId: 'settings-modal', showThemeToggle: true, showMaximize: true, showClose: true, draggable: false })}
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
              <span class="modal-tab-badge modal-tab-badge--annotations" id="tab-badge-annotations" style="display:none"></span>
            </button>
            <!-- RFC-0180: Alarms Tab -->
            <button type="button" class="modal-tab" data-tab="alarms">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              Alarmes
              <span class="modal-tab-badge modal-tab-badge--alarms" id="tab-badge-alarms" style="display:none"></span>
            </button>
            <!-- RFC-0198: Chamados Tab -->
            <button type="button" class="modal-tab" data-tab="chamados">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
                <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
              </svg>
              Chamados
              <span class="modal-tab-badge modal-tab-badge--chamados" id="tab-badge-chamados" style="display:none"></span>
            </button>
            <!-- Exclusão de Grupos Tab -->
            <button type="button" class="modal-tab" data-tab="exclusion-groups">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
              </svg>
              Excluir Grupos
              <span class="modal-tab-badge modal-tab-badge--exclusion" id="tab-badge-exclusion-groups" style="display:none"></span>
            </button>
            <!-- RFC-0232: Incidentes (interpolação) — central + admin MyIO only -->
            ${
              this.config.isGateway && this.isSuperAdmin()
                ? `<button type="button" class="modal-tab" data-tab="incidents">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v4"></path>
                  <path d="M12 17h.01"></path>
                  <path d="M10.29 3.86l-8.18 14.14A2 2 0 0 0 3.93 21h16.14a2 2 0 0 0 1.82-2.99L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                </svg>
                Incidentes
                ${
                  (this.config.interpolatedSlots?.length ?? 0) > 0
                    ? `<span class="modal-tab-badge modal-tab-badge--incidents">${this.config.interpolatedSlots!.length}</span>`
                    : ''
                }
              </button>`
                : ''
            }
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
            <!-- RFC-0198: Chamados Tab Content -->
            <div id="chamados-tab-content" class="tab-content" style="display: none;">
              <div style="padding: 20px; text-align: center; color: #6c757d;">
                <div class="loading-spinner"></div>
                <p>Carregando chamados...</p>
              </div>
            </div>
            <!-- Exclusão de Grupos Tab Content -->
            <div id="exclusion-groups-tab-content" class="tab-content" style="display: none;">
              <div style="padding: 20px; text-align: center; color: #6c757d;">
                <div class="loading-spinner"></div>
                <p>Carregando configurações de exclusão...</p>
              </div>
            </div>
            <!-- RFC-0232: Incidentes (interpolação) Tab Content — central + admin MyIO only.
                 Rendered synchronously (data comes pre-fetched via config.interpolatedSlots,
                 same as getGatewayInfoHTML() — no async loading state needed here). -->
            ${
              this.config.isGateway && this.isSuperAdmin()
                ? `<div id="incidents-tab-content" class="tab-content" style="display: none;">${this.getInterpolationIncidentsHTML()}</div>`
                : ''
            }
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
              ${this.getDeviceTypeIcon(deviceType ?? '')}
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
              this.canEditIdentifier() ? '' : 'readonly'
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

        <!-- Central/gateway identity+telemetry — only for CentralSettingsModal (isGateway);
             rendered directly in Geral instead of its own tab, right after the identity card. -->
        ${this.config.isGateway ? this.getGatewayInfoHTML() : ''}

        <!-- Bottom Row: Connection Info spanning full width -->
        ${this.getConnectionInfoHTML()}

        <!-- RFC-0077: Power Limits Configuration (only for energy domain, when deviceType is available, and not a store meter) -->
        ${this.config.domain === 'energy' && this.config.deviceType && this.config.deviceType !== '3F_MEDIDOR' && this.config.deviceProfile !== '3F_MEDIDOR' ? this.getPowerLimitsHTML() : ''}

        <!-- RFC-0171: Temperature Offset — always visible for temperature domain; editable only for @myio.com.br -->
        ${this.config.domain === 'temperature' ? this.getTemperatureOffsetHTML() : ''}
      </div>
    `;
  }

  /** RFC-0171: Offset de Temperatura — sempre visível para domain=temperature; editável só para @myio.com.br */
  private getTemperatureOffsetHTML(): string {
    const superAdmin = this.isSuperAdmin();
    return `
      <div class="form-card">
        <h4 class="section-title">Offset de Temperatura</h4>
        <div class="form-group">
          <label for="offSetTemperature">Correção de Leitura (°C)</label>
          <input
            type="number"
            id="offSetTemperature"
            name="offSetTemperature"
            step="0.01"
            min="-99.99"
            max="99.99"
            placeholder="-99.99 a +99.99"
            ${superAdmin ? '' : 'readonly'}
          >
          <small class="form-hint" style="color:#6b7280;font-size:11px;margin-top:4px;display:block;">
            ${superAdmin
              ? 'Correção aplicada à leitura do sensor (valores negativos ou positivos)'
              : 'Somente operadores MyIO podem alterar este valor'}
          </small>
        </div>
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
    // RFC-0171: offSetTemperature always visible; editable only for SuperAdmin (@myio.com.br users)
    const superAdmin = this.isSuperAdmin();
    const offSetTemperatureField = `
      <div class="form-group">
        <label for="offSetTemperature">Offset de Temperatura (°C)</label>
        <input type="number" id="offSetTemperature" name="offSetTemperature" step="0.01" min="-99.99" max="99.99" placeholder="-99.99 a +99.99"${superAdmin ? '' : ' readonly'}>
        <small class="form-hint" style="color: #6b7280; font-size: 11px; margin-top: 4px; display: block;">${
          superAdmin
            ? 'Correção aplicada à leitura do sensor (valores negativos ou positivos)'
            : 'Somente operadores MyIO podem alterar este valor'
        }</small>
      </div>
    `;

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

  /** ISO-8601 string variant of formatTs — GCDR (`GatewayInfo`) sends dates as
   *  ISO strings, not Unix ms. */
  private formatIso(iso?: string | null): string {
    if (!iso) return '—';
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? '—' : this.formatTs(ms);
  }

  private formatUptime(seconds?: number | null): string {
    if (seconds == null || Number.isNaN(seconds)) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    parts.push(`${m}min`);
    return parts.join(' ');
  }

  /** pt-BR absolute timestamp WITH seconds, ISO-string input (mirrors the
   *  seconds-precision formatting `getConnectionInfoHTML()` uses for its
   *  disconnect-interval row). */
  private formatIsoWithSeconds(iso?: string | null): string {
    if (!iso) return '—';
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return '—';
    return new Date(ms).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  /** "(Xd:YYhs:YYmins atrás)"-style relative time, ISO-string input — mirrors
   *  the device "Conectado desde" pattern in `getConnectionInfoHTML()`. */
  private formatIsoRelativeDetailed(iso?: string | null): string {
    const ms = iso ? Date.parse(iso) : NaN;
    if (Number.isNaN(ms)) return '';
    const diffMinutes = Math.floor((Date.now() - ms) / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) {
      return `(${diffDays}d:${String(diffHours % 24).padStart(2, '0')}hs:${String(diffMinutes % 60).padStart(2, '0')}mins atrás)`;
    }
    if (diffHours > 0) return `(${diffHours}hs:${String(diffMinutes % 60).padStart(2, '0')}mins atrás)`;
    if (diffMinutes > 0) return `(${diffMinutes}mins atrás)`;
    return '(agora)';
  }

  /** "(Xd/h/min atrás)"-style relative time, ISO-string input — mirrors the
   *  device "Último check status" pattern in `getConnectionInfoHTML()`. */
  private formatIsoRelativeSimple(iso?: string | null): string {
    const ms = iso ? Date.parse(iso) : NaN;
    if (Number.isNaN(ms)) return '';
    const diffMinutes = Math.floor((Date.now() - ms) / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `(${diffDays}d atrás)`;
    if (diffHours > 0) return `(${diffHours}h atrás)`;
    if (diffMinutes > 0) return `(${diffMinutes}min atrás)`;
    return '(agora)';
  }

  /**
   * Central/gateway identity + telemetry — read-only, sourced 1:1 from
   * GCDR's `GET /api/v1/centrals/:id`. Rendered inline in the Geral tab
   * (right after the identity card) rather than its own tab — a real device
   * never sets `isGateway`, so this is fully inert for the device settings
   * modal. Every value carries a stable `id="gwinfo-<key>"` so a host
   * (CentralSettingsModal) can patch `.textContent` after an async fetch
   * resolves — this method itself only runs once, at construction time
   * (createModal() is never re-invoked), so it can't pick up data that
   * arrives after the modal is already built.
   */
  /**
   * "Status" text/color mapping for `GatewayInfo.connectionStatus`
   * (ONLINE|OFFLINE|DEGRADED|MAINTENANCE) — same visual vocabulary as
   * `getConnectionInfoHTML()`'s device `statusMap` (ONLINE/OFFLINE stay
   * ALL-CAPS, DEGRADED reads "Atenção"). Exposed as a static so
   * `CentralSettingsModal.patchGatewayInfoDom()` can mirror it exactly when
   * an async `onFetchSettings` re-renders this card's values.
   */
  static readonly GATEWAY_CONN_STATUS_MAP: Record<string, { text: string; color: string }> = {
    ONLINE: { text: 'ONLINE', color: '#22c55e' },
    OFFLINE: { text: 'OFFLINE', color: '#ef4444' },
    DEGRADED: { text: 'Atenção', color: '#f59e0b' },
    MAINTENANCE: { text: 'Manutenção', color: '#3b82f6' },
  };

  private getGatewayInfoHTML(): string {
    const g = this.config.gatewayInfo || {};
    const bool = (v?: boolean | null) => (v == null ? '—' : v ? 'Sim' : 'Não');
    const num = (v?: number | null, suffix = '') => (v == null ? '—' : `${v}${suffix}`);
    const txt = (v?: string | null) => (v == null || v === '' ? '—' : v);
    const infoRow = (label: string, key: string, valueHtml: string, fullWidth = false) =>
      `<div class="info-row${fullWidth ? ' full-width' : ''}">
        <span class="info-label">${label}</span>
        <span class="info-value" id="gwinfo-${key}">${valueHtml}</span>
      </div>`;

    // "Informações de Conexão" — same visual pattern (divs/classes/fonts) as
    // getConnectionInfoHTML()'s device card, mapped onto GatewayInfo's
    // fields. "Último intervalo desconectado" always reads "—": GatewayInfo
    // only carries point-in-time checks (last attempt / last success), not a
    // recorded downtime interval — showing a fabricated one would misrepresent
    // data that doesn't exist yet on GCDR's `GET /api/v1/centrals/:id`.
    const connStatusInfo = SettingsModalView.GATEWAY_CONN_STATUS_MAP[(g.connectionStatus || '').toUpperCase()] || {
      text: txt(g.connectionStatus),
      color: '#6b7280',
    };
    const isOnline = (g.connectionStatus || '').toUpperCase() === 'ONLINE';
    const connectedSinceAbs = isOnline ? this.formatIso(g.lastGatewaySuccessCheckAt) : '—';
    const connectedSinceRel = isOnline ? this.formatIsoRelativeDetailed(g.lastGatewaySuccessCheckAt) : '';
    const lastCheckAbs = this.formatIso(g.lastGatewayCheckAt);
    const lastCheckRel = this.formatIsoRelativeSimple(g.lastGatewayCheckAt);
    const lc = g.lastConsumptionTelemetry;
    const consumptionText = lc
      ? `${lc.value.toLocaleString('pt-BR')}${lc.unit ? ` ${lc.unit}` : ''} - ${this.formatIsoWithSeconds(
          lc.timestamp
        )} ${this.formatIsoRelativeSimple(lc.timestamp)}`.trim()
      : '—';

    const connectionInfoCard = `
      <div class="form-card info-card-wide">
        <h4 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: text-bottom; margin-right: 6px;">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
          </svg>
          Informações de Conexão
        </h4>
        <div class="info-grid">
          ${infoRow('Central:', 'connCentral', txt(this.config.deviceLabel))}
          ${infoRow(
            'Status:',
            'connectionStatus',
            `<span style="color: ${connStatusInfo.color}; font-weight: 600;">${connStatusInfo.text}</span>`
          )}
          ${infoRow(
            'Conectado desde:',
            'lastGatewaySuccessCheckAt',
            `${connectedSinceAbs}${connectedSinceRel ? ` <span class="time-since">${connectedSinceRel}</span>` : ''}`
          )}
          ${infoRow(
            'Último check status:',
            'lastGatewayCheckAt',
            `${lastCheckAbs}${lastCheckRel ? ` <span class="time-since">${lastCheckRel}</span>` : ''}`
          )}
          ${infoRow('Último intervalo desconectado:', 'disconnectInterval', '—', true)}
          ${infoRow('Última Telemetria de Consumo:', 'lastConsumptionTelemetry', consumptionText, true)}
          ${infoRow('Monitoramento habilitado:', 'monitoringEnabled', bool(g.monitoringEnabled))}
          ${infoRow('Latência:', 'lastGatewayCheckLatencyMs', num(g.lastGatewayCheckLatencyMs, 'ms'))}
          ${infoRow('Resultado do probe:', 'probeResult', txt(g.probeResult))}
        </div>
      </div>
    `;

    // Identificação/Estatísticas/Metadados — same "one section per line" full-
    // width pattern as "Informações de Conexão" above (`.info-card-wide` +
    // `.info-grid`/`.info-row`), not the narrower side-by-side cards this used
    // to be. `.gateway-info-grid` is now a simple vertical stack; the
    // Conectividade fieldset CentralSettingsModal injects after these three
    // follows the exact same pattern (see `connectivityFieldsetHtml()`).
    return `
      ${connectionInfoCard}
      <div class="gateway-info-grid">
        <div class="form-card gateway-info-card info-card-wide">
          <h4 class="section-title">Identificação</h4>
          <div class="info-grid">
            ${infoRow('UUID:', 'uuid', txt(this.config.deviceId))}
            ${infoRow('Serial Number:', 'serialNumber', txt(g.serialNumber))}
            ${infoRow('Hardware ID:', 'hardwareId', txt(g.hardwareId))}
            ${infoRow('Tipo:', 'type', txt(g.type))}
            ${infoRow('Status (cadastro):', 'status', txt(g.status))}
            ${infoRow('Firmware:', 'firmwareVersion', txt(g.firmwareVersion))}
            ${infoRow('Software:', 'softwareVersion', txt(g.softwareVersion))}
            ${infoRow('Frequência (canal):', 'frequency', num(g.frequency))}
          </div>
        </div>
        <div class="form-card gateway-info-card info-card-wide">
          <h4 class="section-title">Estatísticas</h4>
          <div class="info-grid">
            ${infoRow('Dispositivos conectados:', 'statsConnectedDevices', num(g.stats?.connectedDevices))}
            ${infoRow('Regras ativas:', 'statsActiveRules', num(g.stats?.activeRules))}
            ${infoRow('Eventos de sync pendentes:', 'statsPendingSyncEvents', num(g.stats?.pendingSyncEvents))}
            ${infoRow('Uptime:', 'statsUptimeSeconds', this.formatUptime(g.stats?.uptimeSeconds))}
            ${infoRow('Último heartbeat:', 'statsLastHeartbeatAt', this.formatIso(g.stats?.lastHeartbeatAt))}
          </div>
        </div>
        <div class="form-card gateway-info-card info-card-wide">
          <h4 class="section-title">Metadados</h4>
          <div class="info-grid">
            ${infoRow('Criado em:', 'createdAt', this.formatIso(g.createdAt))}
            ${infoRow('Atualizado em:', 'updatedAt', this.formatIso(g.updatedAt))}
            ${infoRow('Versão:', 'version', num(g.version))}
          </div>
        </div>
      </div>
    `;
  }

  private escHtml(v: string): string {
    return String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
    );
  }

  private incidentsDeviceKey(s: InterpolatedSlot): string {
    return s.deviceName || `slave ${s.slaveId}`;
  }

  private incidentsFmtHour(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  }
  private incidentsFmtDay(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }
  private incidentsFmtFull(iso: string | null): string {
    return iso == null
      ? '—'
      : new Date(iso).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });
  }

  /**
   * RFC-0232 — "Incidentes" tab (central + admin MyIO only): what the
   * No-Consumption Interpolation agent (`data-ingestion-prod`) fabricated for
   * THIS central. Inspired by that app's own ledger
   * (`InterpolationPanel.tsx`'s "Logs" tab, ~L450-548) but simplified for a
   * single-central context: that page groups by GATEWAY first (it shows every
   * central at once) — here there's only one central, so grouping starts one
   * level down, by DEVICE, then by DAY, each day showing its hour slots.
   * `config.interpolatedSlots` arrives pre-fetched from the host — nothing is
   * fetched in here, ever; the header controls (busca/dispositivos/período)
   * only filter that one array client-side. This method runs once, at
   * construction time, and builds the STATIC shell (filters header + KPI/body
   * mount points); `refreshIncidentsView()` re-renders the KPI/body pair on
   * every filter change via `this.modal.querySelector`.
   */
  private getInterpolationIncidentsHTML(): string {
    this.incidentsAllSlots = this.config.interpolatedSlots ?? [];
    const deviceKeys = Array.from(new Set(this.incidentsAllSlots.map((s) => this.incidentsDeviceKey(s)))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
    // Default: every device checked (see class doc — "default todos marcados").
    this.incidentsSelectedDevices = new Set(deviceKeys);

    if (this.incidentsAllSlots.length === 0) {
      return `<div class="incidents-empty">Nenhuma interpolação registrada para esta central no período consultado pelo host.</div>`;
    }

    const devicesPanel = deviceKeys
      .map(
        (key) => `
        <label class="incidents-multiselect__item">
          <input type="checkbox" checked value="${this.escHtml(key)}" data-role="incidents-device-checkbox">
          <span>${this.escHtml(key)}</span>
        </label>`
      )
      .join('');

    return `
      <div class="incidents-filters">
        <div class="incidents-filter incidents-filter--search">
          <label class="incidents-filter__label">Buscar dispositivo</label>
          <input type="text" class="incidents-search-input" placeholder="Nome do dispositivo…" data-role="incidents-search-input">
        </div>
        <div class="incidents-filter incidents-filter--devices">
          <label class="incidents-filter__label">Dispositivos</label>
          <div class="incidents-multiselect">
            <button type="button" class="incidents-multiselect__toggle" data-role="incidents-devices-toggle">
              <span data-role="incidents-devices-summary">Todos (${deviceKeys.length})</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="incidents-multiselect__panel" data-role="incidents-devices-panel" hidden>
              <div class="incidents-multiselect__actions">
                <button type="button" data-role="incidents-devices-all">Marcar todos</button>
                <button type="button" data-role="incidents-devices-none">Desmarcar todos</button>
              </div>
              ${devicesPanel}
            </div>
          </div>
        </div>
        <div class="incidents-filter incidents-filter--period">
          <label class="incidents-filter__label">Período</label>
          <div id="incidents-daterange-${this.incidentsIdSuffix}" class="incidents-daterange-mount"></div>
        </div>
      </div>
      <div class="incidents-kpis">${this.buildIncidentsKpisHtml(this.incidentsAllSlots)}</div>
      <div class="incidents-body">${this.buildIncidentsBodyHtml(this.incidentsAllSlots)}</div>
    `;
  }

  /** 4 small KPI cards summarizing the currently-filtered slot set. */
  private buildIncidentsKpisHtml(slots: InterpolatedSlot[]): string {
    if (slots.length === 0) {
      return `<div class="incidents-kpi-empty">Nenhuma interpolação corresponde aos filtros atuais.</div>`;
    }
    const deviceCount = new Set(slots.map((s) => this.incidentsDeviceKey(s))).size;
    const dayCount = new Set(slots.map((s) => this.incidentsFmtDay(s.hourStart))).size;
    const withIncident = slots.filter((s) => s.incidentRef).length;
    const pct = slots.length ? Math.round((withIncident / slots.length) * 100) : 0;
    const kpi = (label: string, value: string, sub?: string) => `
      <div class="incidents-kpi">
        <div class="incidents-kpi__value">${value}</div>
        <div class="incidents-kpi__label">${label}</div>
        ${sub ? `<div class="incidents-kpi__sub">${sub}</div>` : ''}
      </div>`;
    return [
      kpi('Interpolações', String(slots.length)),
      kpi('Dispositivos', String(deviceCount)),
      kpi('Dias com atividade', String(dayCount)),
      kpi('Com incidente vinculado', String(withIncident), `${pct}% do total`),
    ].join('');
  }

  /** Device → day → hour-slot table, for whatever slot subset the caller already filtered. */
  private buildIncidentsBodyHtml(slots: InterpolatedSlot[]): string {
    if (slots.length === 0) {
      return `<div class="incidents-empty">Nenhuma interpolação corresponde aos filtros atuais.</div>`;
    }

    const byDevice = new Map<string, InterpolatedSlot[]>();
    for (const s of slots) {
      const key = this.incidentsDeviceKey(s);
      (byDevice.get(key) ?? byDevice.set(key, []).get(key)!).push(s);
    }
    const deviceNames = Array.from(byDevice.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const deviceSections = deviceNames
      .map((deviceName) => {
        const deviceSlots = byDevice.get(deviceName)!.slice().sort((a, b) => a.hourStart.localeCompare(b.hourStart));

        // Sub-group by day, in chronological order (Map preserves insertion order).
        const byDay = new Map<string, InterpolatedSlot[]>();
        for (const s of deviceSlots) {
          const day = this.incidentsFmtDay(s.hourStart);
          (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(s);
        }

        const daySections = Array.from(byDay.entries())
          .map(([day, daySlots]) => {
            const rows = daySlots
              .map(
                (s) => `
              <tr>
                <td class="mono">${this.incidentsFmtHour(s.hourStart)}</td>
                <td class="num mono">${s.value.toFixed(1)}</td>
                <td class="mono muted">${this.incidentsFmtHour(s.sourceHour)}</td>
                <td class="mono muted" title="${this.escHtml(s.ruleId)}">${this.escHtml(s.ruleId.slice(0, 8))}</td>
                <td>${s.incidentRef ? `<code>${this.escHtml(s.incidentRef)}</code>` : '<span class="muted">—</span>'}</td>
                <td class="muted">${this.incidentsFmtFull(s.createdAt)}</td>
              </tr>`
              )
              .join('');
            return `
              <div class="incidents-day">
                <div class="incidents-day__header">
                  <span>${this.escHtml(day)}</span>
                  <span class="incidents-day__count">${daySlots.length} hora${daySlots.length === 1 ? '' : 's'}</span>
                </div>
                <table class="incidents-table">
                  <thead>
                    <tr><th>Hora</th><th>Valor</th><th>Fonte LOCF</th><th>Regra</th><th>Incidente</th><th>Gravado</th></tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>`;
          })
          .join('');

        return `
          <div class="incidents-device">
            <button type="button" class="incidents-device__header" data-role="toggle-incidents-device">
              <svg class="incidents-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <span class="incidents-device__name">${this.escHtml(deviceName)}</span>
              <span class="incidents-device__count">${deviceSlots.length} hora${deviceSlots.length === 1 ? '' : 's'} · ${byDay.size} dia${byDay.size === 1 ? '' : 's'}</span>
            </button>
            <div class="incidents-device__body">${daySections}</div>
          </div>`;
      })
      .join('');

    return `
      <div class="incidents-summary">${slots.length} interpolação(ões) · ${deviceNames.length} dispositivo(s)</div>
      <div class="incidents-wrap">${deviceSections}</div>
    `;
  }

  /** Applies search + device + period filters to `incidentsAllSlots`. */
  private getFilteredIncidentsSlots(): InterpolatedSlot[] {
    const search = this.incidentsSearch.trim().toLowerCase();
    const { startISO, endISO } = this.incidentsDateRange;
    return this.incidentsAllSlots.filter((s) => {
      const key = this.incidentsDeviceKey(s);
      if (!this.incidentsSelectedDevices.has(key)) return false;
      if (search && !key.toLowerCase().includes(search)) return false;
      if (startISO && s.hourStart < startISO) return false;
      if (endISO && s.hourStart > endISO) return false;
      return true;
    });
  }

  /** Re-renders the KPI cards + device/day body after any filter change (search/devices/period). */
  private refreshIncidentsView(): void {
    const filtered = this.getFilteredIncidentsSlots();
    const kpisEl = this.modal.querySelector('.incidents-kpis');
    const bodyEl = this.modal.querySelector('.incidents-body');
    if (kpisEl) kpisEl.innerHTML = this.buildIncidentsKpisHtml(filtered);
    if (bodyEl) bodyEl.innerHTML = this.buildIncidentsBodyHtml(filtered);
    const summaryEl = this.modal.querySelector('[data-role="incidents-devices-summary"]');
    if (summaryEl) {
      const total = this.incidentsAllSlots.length
        ? new Set(this.incidentsAllSlots.map((s) => this.incidentsDeviceKey(s))).size
        : 0;
      const selected = this.incidentsSelectedDevices.size;
      summaryEl.textContent = selected === total ? `Todos (${total})` : `${selected} de ${total}`;
    }
  }

  /**
   * Wires the Incidentes tab's static controls (search input, devices
   * multiselect dropdown, device-group collapse). Called once from `render()`
   * — all delegated on `this.modal`, so it survives the KPI/body innerHTML
   * swaps `refreshIncidentsView()` does (those never touch the header). The
   * date-range picker is wired separately in `initIncidentsDateRange()`
   * (async — see that method).
   */
  private bindIncidentsTabEvents(): void {
    this.modal.addEventListener('input', (event) => {
      const target = event.target as HTMLElement;
      if (target.dataset.role !== 'incidents-search-input') return;
      this.incidentsSearch = (target as HTMLInputElement).value;
      this.refreshIncidentsView();
    });

    this.modal.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;

      // Collapse/expand a device group in the body.
      const deviceHeader = target.closest<HTMLElement>('[data-role="toggle-incidents-device"]');
      if (deviceHeader) {
        deviceHeader.closest('.incidents-device')?.classList.toggle('is-collapsed');
        return;
      }

      const panel = this.modal.querySelector<HTMLElement>('[data-role="incidents-devices-panel"]');

      // Open/close the devices dropdown.
      const toggle = target.closest<HTMLElement>('[data-role="incidents-devices-toggle"]');
      if (toggle && panel) {
        panel.hidden = !panel.hidden;
        return;
      }

      // "Marcar todos" / "Desmarcar todos".
      if (target.dataset.role === 'incidents-devices-all' || target.dataset.role === 'incidents-devices-none') {
        const checkAll = target.dataset.role === 'incidents-devices-all';
        this.modal.querySelectorAll<HTMLInputElement>('[data-role="incidents-device-checkbox"]').forEach((cb) => {
          cb.checked = checkAll;
        });
        this.incidentsSelectedDevices = checkAll
          ? new Set(this.incidentsAllSlots.map((s) => this.incidentsDeviceKey(s)))
          : new Set();
        this.refreshIncidentsView();
        return;
      }

      // Click outside the dropdown closes it.
      if (panel && !panel.hidden && !target.closest('[data-role="incidents-devices-toggle"]') && !panel.contains(target)) {
        panel.hidden = true;
      }
    });

    // Per-device checkbox toggling (delegated 'change', not 'click', so it
    // also fires for keyboard-driven checks).
    this.modal.addEventListener('change', (event) => {
      const target = event.target as HTMLElement;
      if (target.dataset.role !== 'incidents-device-checkbox') return;
      const cb = target as HTMLInputElement;
      if (cb.checked) this.incidentsSelectedDevices.add(cb.value);
      else this.incidentsSelectedDevices.delete(cb.value);
      this.refreshIncidentsView();
    });
  }

  /**
   * Mounts the period date-range picker into the Incidentes tab's header —
   * async (loads jQuery/moment/daterangepicker from CDN on first use, see
   * `createInputDateRangePickerInsideDIV`), so this runs from `render()`
   * AFTER the modal is attached to the DOM, same timing as
   * `initAnnotationsTab()`/`initAlarmsTab()`. No-ops when the tab isn't
   * rendered at all (non-admin / non-gateway).
   */
  private async initIncidentsDateRange(): Promise<void> {
    if (!(this.config.isGateway && this.isSuperAdmin())) return;
    const mountId = `incidents-daterange-${this.incidentsIdSuffix}`;
    if (!document.getElementById(mountId)) return; // tab HTML wasn't rendered (empty state has no filters header)

    try {
      this.incidentsDateRangeController = await createInputDateRangePickerInsideDIV({
        containerId: mountId,
        inputId: `${mountId}-input`,
        label: '',
        placeholder: 'Todo o período',
        showHelper: false,
        pickerOptions: {
          includeTime: true,
          onApply: (result) => {
            this.incidentsDateRange = { startISO: result.startISO, endISO: result.endISO };
            this.refreshIncidentsView();
          },
        },
      });
    } catch (err) {
      console.warn('[SettingsModalView] Incidentes: failed to mount date-range picker:', err);
    }
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

    // RFC-0202: device-type image URLs come from the shared deviceIcons map.
    // Fallback uses the map's own DEFAULT_DEVICE_ICON (generic 3F_MEDIDOR art) —
    // this used to hardcode a flaticon "search not found" icon that read as a
    // broken image whenever deviceType had no entry (e.g. GATEWAY).
    const url = (deviceIcons as Record<string, string>)[normalized] || DEFAULT_DEVICE_ICON;
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

  private calculateTimeBetweenDates(data1: any, data2: any) {
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

    const statusInfo = statusMap[mapDeviceStatusToCardStatus(deviceStatus ?? '') || ''] || {
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
          font-family: 'Nunito', system-ui, sans-serif;
        }

        /* RFC-0232: the "Incidentes" period picker (createInputDateRangePickerInsideDIV
           -> jQuery daterangepicker) always appends its calendar dropdown to
           document.body, as a SIBLING of this overlay, not a descendant — so it
           can't be reached with a normal descendant selector. The plugin's own
           default z-index (~10000) is far below this overlay's 9999999 (chosen
           to beat ThingsBoard's Angular Material overlays in production), so
           without this override the calendar renders but is fully hidden behind
           the modal, making the input look like it "doesn't open". */
        .daterangepicker {
          z-index: 10000000 !important;
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
        
        /* Header handled by ModalHeader (RFC-0121) */
        .myio-device-settings-modal .myio-modal-header__title {
          font-size: 14px;
          font-weight: 600;
        }
        .myio-device-settings-modal .myio-modal-header__icon {
          font-size: 15px;
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
          color: var(--myio-brand-700, #3e1a7d);
          border-bottom-color: var(--myio-brand-700, #3e1a7d);
          background: #fff;
        }

        .modal-tab.locked {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }

        .modal-tab svg {
          width: 16px;
          height: 16px;
          stroke-width: 2;
        }

        .modal-tab-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9px;
          font-size: 10px;
          font-weight: 700;
          line-height: 1;
          color: #fff;
          background: #6c757d;
          margin-left: 2px;
        }
        .modal-tab-badge--annotations { background: #7c3aed; }
        .modal-tab-badge--alarms      { background: #dc2626; }
        .modal-tab-badge--chamados    { background: #0891b2; }
        .modal-tab-badge--exclusion   { background: #d97706; }
        .modal-tab-badge--incidents   { background: #7C3AED; }

        .tab-content {
          min-height: 400px;
        }

        /* RFC-0232: Incidentes (interpolação) tab — device → day → hour slots. */
        .incidents-filters {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
        }
        .incidents-filter {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .incidents-filter--search { flex: 1 1 123px; min-width: 100px; }
        .incidents-filter--devices { flex: 0 0 auto; }
        .incidents-filter--period { flex: 0 0 auto; }
        .incidents-filter__label {
          font: 700 11px 'Nunito', system-ui, sans-serif;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .incidents-search-input {
          width: 100%;
          padding: 7px 10px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font: 600 13px 'Nunito', system-ui, sans-serif;
          color: #1f2937;
          box-sizing: border-box;
        }
        .incidents-search-input:focus { outline: 2px solid #7C3AED; outline-offset: 1px; }
        .incidents-multiselect { position: relative; }
        .incidents-multiselect__toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          min-width: 200px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: #fff;
          font: 600 13px 'Nunito', system-ui, sans-serif;
          color: #1f2937;
          cursor: pointer;
          white-space: nowrap;
        }
        .incidents-multiselect__toggle:hover { border-color: #7C3AED; }
        .incidents-multiselect__panel {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          z-index: 20;
          min-width: 220px;
          max-height: 260px;
          overflow-y: auto;
          background: #fff;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          padding: 8px;
        }
        .incidents-multiselect__actions {
          display: flex;
          gap: 8px;
          padding-bottom: 6px;
          margin-bottom: 6px;
          border-bottom: 1px solid #f3f4f6;
        }
        .incidents-multiselect__actions button {
          flex: 1;
          padding: 4px 6px;
          border: none;
          border-radius: 4px;
          background: #f5f3ff;
          color: #5b21b6;
          font: 700 11px 'Nunito', system-ui, sans-serif;
          cursor: pointer;
        }
        .incidents-multiselect__actions button:hover { background: #ede9fe; }
        .incidents-multiselect__item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 4px;
          font: 600 13px 'Nunito', system-ui, sans-serif;
          color: #374151;
          cursor: pointer;
          border-radius: 4px;
        }
        .incidents-multiselect__item:hover { background: #f9fafb; }
        .incidents-daterange-mount .myio-daterange-wrapper {
          margin-bottom: 0;
          padding: 0;
          background: transparent;
          box-shadow: none;
        }
        .incidents-daterange-mount {
          min-width: 280px;
        }
        .incidents-daterange-mount .myio-daterange-input {
          padding: 7px 10px;
          font-size: 13px;
          width: 100%;
          min-width: 280px;
          max-width: 340px;
        }
        .incidents-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .incidents-kpi {
          padding: 12px 14px;
          border-radius: 8px;
          background: #f5f3ff;
          border: 1px solid #e9d5ff;
        }
        .incidents-kpi__value {
          font: 800 22px 'Nunito', system-ui, sans-serif;
          color: #5b21b6;
        }
        .incidents-kpi__label {
          margin-top: 2px;
          font: 700 11px 'Nunito', system-ui, sans-serif;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .incidents-kpi__sub {
          margin-top: 2px;
          font-size: 11px;
          color: #9ca3af;
        }
        .incidents-kpi-empty {
          margin-bottom: 16px;
          padding: 10px 14px;
          border-radius: 8px;
          background: #f9fafb;
          color: #9ca3af;
          font-size: 12px;
        }
        .theme-dark .incidents-filters { border-color: #374151; }
        .theme-dark .incidents-filter__label { color: #9ca3af; }
        .theme-dark .incidents-search-input { background: #111827; border-color: #4b5563; color: #e5e7eb; }
        .theme-dark .incidents-multiselect__toggle { background: #111827; border-color: #4b5563; color: #e5e7eb; }
        .theme-dark .incidents-multiselect__panel { background: #1f2937; border-color: #374151; }
        .theme-dark .incidents-multiselect__item { color: #e5e7eb; }
        .theme-dark .incidents-multiselect__item:hover { background: #111827; }
        .theme-dark .incidents-kpi { background: #2e1065; border-color: #4c1d95; }
        .theme-dark .incidents-kpi__value { color: #d8b4fe; }
        .theme-dark .incidents-kpi-empty { background: #111827; color: #6b7280; }

        .incidents-summary {
          margin-bottom: 14px;
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
        }
        .incidents-empty {
          padding: 40px 20px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
          border: 1px dashed #d1d5db;
          border-radius: 8px;
        }
        .incidents-wrap {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .incidents-device {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        .incidents-device__header {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 14px;
          background: #f5f3ff;
          border: none;
          cursor: pointer;
          font: 700 13px 'Nunito', system-ui, sans-serif;
          color: #5b21b6;
          text-align: left;
        }
        .incidents-device__header:hover { background: #ede9fe; }
        /* Chevron SVG points right (▶); rotated 90° to point down (▼) while
           expanded — the default state, since a group starts open. */
        .incidents-chevron { flex-shrink: 0; transition: transform 0.15s ease; transform: rotate(90deg); }
        .incidents-device.is-collapsed .incidents-chevron { transform: rotate(0deg); }
        .incidents-device.is-collapsed .incidents-device__body { display: none; }
        .incidents-device__name { flex: 1; }
        .incidents-device__count {
          font-size: 11px;
          font-weight: 600;
          color: #7c3aed;
          background: #fff;
          border-radius: 999px;
          padding: 2px 8px;
        }
        .incidents-device__body {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 10px 14px;
        }
        .incidents-day__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 2px;
          font: 700 12px 'Nunito', system-ui, sans-serif;
          color: #374151;
        }
        .incidents-day__count {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
        }
        .incidents-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .incidents-table th {
          text-align: left;
          padding: 6px 8px;
          background: #f9fafb;
          color: #6b7280;
          font-weight: 600;
          border-bottom: 1px solid #e5e7eb;
        }
        .incidents-table td {
          padding: 6px 8px;
          border-bottom: 1px solid #f3f4f6;
          color: #1f2937;
        }
        .incidents-table td.num { text-align: right; }
        .incidents-table td.mono { font-family: 'Courier New', Courier, monospace; }
        .incidents-table td.muted { color: #9ca3af; }
        .incidents-table code {
          color: #7c3aed;
          background: #f5f3ff;
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 11px;
        }
        .theme-dark .incidents-empty { border-color: #4b5563; color: #9ca3af; }
        .theme-dark .incidents-device { border-color: #374151; }
        .theme-dark .incidents-device__header { background: #2e1065; color: #d8b4fe; }
        .theme-dark .incidents-device__header:hover { background: #3b0764; }
        .theme-dark .incidents-device__count { background: #111827; color: #c4b5fd; }
        .theme-dark .incidents-day__header { color: #e5e7eb; }
        .theme-dark .incidents-table th { background: #111827; color: #9ca3af; border-color: #374151; }
        .theme-dark .incidents-table td { color: #e5e7eb; border-color: #1f2937; }
        .theme-dark .incidents-table code { background: #2e1065; }

        /* Loading spinner for annotations tab */
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e9ecef;
          border-top-color: var(--myio-brand-700, #3e1a7d);
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

        /* Central/gateway identity+telemetry (isGateway), inline in Geral —
           one section per line, same visual pattern as "Informações de
           Conexão" (.info-card-wide + .info-grid/.info-row) for every card:
           Identificação/Estatísticas/Metadados here, plus the Conectividade
           fieldset CentralSettingsModal injects after them.
           .gateway-info-grid is just a vertical stack — .gateway-info-card
           carries no sizing of its own any more (that lived here back when
           these were narrower, side-by-side flex-wrap cards); the full-width
           look now comes entirely from .info-card-wide. */
        .gateway-info-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .gateway-info-card {
          margin: 0;
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
          color: var(--myio-brand-700, #3e1a7d);
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
          border-color: var(--myio-brand-700, #3e1a7d);
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
          color: var(--myio-brand-700, #3e1a7d);
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
          border-color: var(--myio-brand-700, #3e1a7d);
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
          background: var(--myio-brand-700, #3e1a7d);
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: var(--myio-brand-600, #2d1458);
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
        color: var(--myio-brand-700, #3e1a7d);
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
          color: var(--myio-brand-700, #3e1a7d);
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
          border-color: var(--myio-brand-700, #3e1a7d);
          box-shadow: 0 0 0 2px rgba(62, 26, 125, 0.25);
        }

        .form-select:hover {
          border-color: var(--myio-brand-700, #3e1a7d);
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
          border-color: var(--myio-brand-700, #3e1a7d);
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
          background: var(--myio-brand-700, #3e1a7d);
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
          border-left: 3px solid var(--myio-brand-700, #3e1a7d);
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

        /* RFC-0190: Exclude Groups Totals */
        .eg-card { padding: 20px; }

        .eg-header { margin-bottom: 14px; }

        .eg-enable-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .eg-toggle-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          user-select: none;
        }

        .eg-toggle-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: var(--myio-brand-700, #3e1a7d);
          cursor: pointer;
        }

        .eg-badge-active {
          font-size: 11px;
          font-weight: 600;
          color: #16a34a;
          background: #dcfce7;
          border: 1px solid #86efac;
          border-radius: 12px;
          padding: 2px 8px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .eg-groups-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
          margin-bottom: 16px;
        }

        .eg-groups-grid--disabled {
          opacity: 0.45;
          pointer-events: none;
        }

        .eg-rule-row {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px 12px;
          transition: border-color 0.15s, background 0.15s;
          background: #fafafa;
        }

        .eg-rule-row--checked {
          border-color: var(--myio-brand-700, #3e1a7d);
          background: #f5f0ff;
        }

        .eg-rule-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
        }

        .eg-rule-label input[type="checkbox"] {
          width: 15px;
          height: 15px;
          accent-color: var(--myio-brand-700, #3e1a7d);
          cursor: pointer;
          flex-shrink: 0;
        }

        .eg-rule-name {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
        }

        .eg-rule-row--checked .eg-rule-name {
          color: var(--myio-brand-700, #3e1a7d);
        }

        .eg-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 14px;
          border-top: 1px solid #e5e7eb;
        }

        .eg-save-msg {
          font-size: 13px;
          font-weight: 500;
        }

        .eg-btn-save {
          padding: 8px 20px;
          font-size: 13px;
          font-weight: 600;
          background: var(--myio-brand-700, #3e1a7d);
          color: #fff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .eg-btn-save:hover { background: var(--myio-brand-600, #5a2da8); }
        .eg-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ================================================================
         * DARK MODE — toggled by .theme-dark class on .myio-device-settings-modal
         * ================================================================ */
        .theme-dark {
          background: #1a1b1e;
          color: #e9ecef;
        }

        /* Modal body */
        .theme-dark .modal-body {
          background: #1a1b1e;
        }

        /* Tab bar */
        .theme-dark .modal-tabs {
          background: #25262b;
          border-bottom-color: #373a40;
        }
        .theme-dark .modal-tab {
          color: #adb5bd;
        }
        .theme-dark .modal-tab:hover {
          background: rgba(255,255,255,0.05);
          color: #dee2e6;
        }
        .theme-dark .modal-tab.active {
          background: #1a1b1e;
          color: #a78bfa;
          border-bottom-color: #7c3aed;
        }
        .theme-dark .modal-tab.locked {
          opacity: 0.35;
        }

        /* Scrollbar */
        .theme-dark .modal-body::-webkit-scrollbar-track { background: #25262b; }
        .theme-dark .modal-body::-webkit-scrollbar-thumb { background: #495057; }
        .theme-dark .modal-body::-webkit-scrollbar-thumb:hover { background: #6c757d; }

        /* Form cards */
        .theme-dark .form-card {
          background: #25262b;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }

        /* Section titles */
        .theme-dark .section-title {
          color: #a78bfa;
        }
        .theme-dark .info-card-wide .section-title {
          color: #60a5fa;
        }

        /* Identity card */
        .theme-dark .identity-col1 {
          border-right-color: #373a40;
        }
        .theme-dark .identity-name-text {
          color: #a78bfa;
        }
        .theme-dark .identity-field-label {
          color: #6c757d;
        }
        .theme-dark .identity-input {
          background: #2c2e33;
          border-color: #495057;
          color: #e9ecef;
        }
        .theme-dark .identity-input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 2px rgba(124,58,237,0.25);
        }
        .theme-dark .identity-input[readonly] {
          background: #1a1b1e;
          color: #6c757d;
          border-color: #373a40;
        }
        .theme-dark .device-name-subtitle {
          color: #6c757d;
        }

        /* Form groups */
        .theme-dark .form-group label {
          color: #adb5bd;
        }
        .theme-dark .form-group input {
          background: #2c2e33;
          border-color: #495057;
          color: #e9ecef;
        }
        .theme-dark .form-group input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 2px rgba(124,58,237,0.25);
        }
        .theme-dark .form-group input[readonly] {
          background: #1a1b1e;
          color: #6c757d;
        }

        /* Form select */
        .theme-dark .form-select {
          background: #2c2e33;
          border-color: #495057;
          color: #e9ecef;
        }
        .theme-dark .form-select:focus {
          border-color: #7c3aed;
        }
        .theme-dark .form-select:hover {
          border-color: #6c757d;
        }

        /* Info rows */
        .theme-dark .info-row {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.08);
        }
        .theme-dark .info-label {
          color: #adb5bd;
        }
        .theme-dark .info-value {
          color: #e9ecef;
        }
        .theme-dark .info-card-wide {
          background: linear-gradient(135deg, #1e2235 0%, #1a2030 100%);
          border-color: #2d3748;
        }

        /* Global reference container */
        .theme-dark .global-reference-container {
          background: #2c2e33;
          border-color: #495057;
        }

        /* Power limits table */
        .theme-dark .power-limits-table-wrapper {
          border-color: #373a40;
        }
        .theme-dark .power-limits-table {
          background: #25262b;
        }
        .theme-dark .power-limits-table thead {
          background: #2c2e33;
        }
        .theme-dark .power-limits-table th {
          color: #adb5bd;
          border-color: #373a40;
        }
        .theme-dark .power-limits-table td {
          border-color: #373a40;
          color: #e9ecef;
        }
        .theme-dark .power-limits-table tbody tr:hover td {
          background: rgba(124,58,237,0.08);
        }
        .theme-dark .limit-input {
          background: #2c2e33;
          border-color: #495057;
          color: #e9ecef;
        }
        .theme-dark .limit-input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 2px rgba(124,58,237,0.25);
        }

        /* Power limits legend */
        .theme-dark .power-limits-legend {
          background: #2c2e33;
          border-left-color: #7c3aed;
        }
        .theme-dark .legend-text {
          color: #adb5bd;
        }

        /* Footer */
        .theme-dark .modal-footer {
          background: #25262b;
          border-top-color: #373a40;
        }
        .theme-dark .btn-cancel {
          background: #495057;
        }
        .theme-dark .btn-cancel:hover:not(:disabled) {
          background: #6c757d;
        }

        /* Error message */
        .theme-dark .error-message {
          background: rgba(220,53,69,0.15);
          border-color: rgba(220,53,69,0.4);
          color: #f87171;
        }

        /* Loading spinner */
        .theme-dark .loading-spinner {
          border-color: #373a40;
          border-top-color: #7c3aed;
        }

        /* Exclusion Groups tab */
        .theme-dark .egt-group-row {
          background: #2c2e33;
          border-color: #373a40;
          color: #e9ecef;
        }
        .theme-dark .egt-group-row--checked {
          background: rgba(124,58,237,0.12);
          border-color: rgba(124,58,237,0.4);
        }
        .theme-dark .egt-group-name { color: #e9ecef; }
        .theme-dark .egt-group-desc { color: #6c757d; }
        .theme-dark .egt-group-status { color: #adb5bd; }
        .theme-dark .egt-header { background: #2c2e33; border-color: #373a40; color: #adb5bd; }
        .theme-dark .egt-card { background: #25262b; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
        .theme-dark .egt-section-title { color: #a78bfa; }
        .theme-dark .egt-footer { background: #25262b; border-color: #373a40; }
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
        const tab = (btn as HTMLElement).dataset.tab as
          | 'general'
          | 'annotations'
          | 'alarms'
          | 'chamados'
          | 'exclusion-groups'
          | 'incidents';
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

    // RFC-0232: Incidentes tab click/input/change handling (search, devices
    // multiselect, device-group collapse) lives in bindIncidentsTabEvents(),
    // called from render() — not here, to avoid double-binding the same
    // 'click' delegate twice on this.modal (bit us once already: two
    // listeners both toggling 'is-collapsed' on the same click cancelled
    // each other out).

    // Handle form submission
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.hideError();

      const formData = this.getFormData();
      this.config.onSave(formData);
    });

    // RFC-0121: ModalHeader controller handles maximize/close/theme
    ModalHeader.createController({
      modalId: 'settings-modal',
      maximizeTarget: this.modal,
      maximizedClass: 'is-maximized',
      onClose: () => this.config.onClose(),
      onThemeChange: (theme) => {
        this.modal.classList.toggle('theme-dark', theme === 'dark');
      },
    });

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

  // Tema efetivo: paleta explícita (config.themePalette) OU o global do
  // dashboard (window.MyIOUtils.theme) — controllers antigos não passam o param,
  // mas a MAIN expõe o global (createMyIOTheme).
  private resolveThemeSource(): { cssVars(): Record<string, string> } | Record<string, string> | undefined {
    if (this.config.themePalette) return this.config.themePalette;
    if (typeof window === 'undefined') return undefined;
    return (
      window as { MyIOUtils?: { theme?: { cssVars(): Record<string, string> } | Record<string, string> } }
    ).MyIOUtils?.theme;
  }

  // Extrai o mapa de CSS vars (--myio-*) da paleta: createMyIOTheme expõe
  // cssVars(); um host pode também passar um mapa plano já pronto.
  private themePaletteVars(): Record<string, string> | null {
    const theme = this.resolveThemeSource();
    if (!theme) return null;
    const vars =
      typeof (theme as { cssVars?: () => Record<string, string> }).cssVars === 'function'
        ? (theme as { cssVars(): Record<string, string> }).cssVars()
        : (theme as Record<string, string>);
    return vars && typeof vars === 'object' ? vars : null;
  }

  private applyTheme(): void {
    const root = this.modal || this.container;
    if (!root) return;

    // 1) Paleta do dashboard (createMyIOTheme OU mapa plano de --myio-*).
    //    Os estilos internos já leem var(--myio-brand-700)/var(--myio-*) — ao
    //    setar as vars no root, header/tabs/botões seguem a paleta. Não mexe no
    //    toggle light/dark (as regras .theme-dark continuam por classe).
    const paletteVars = this.themePaletteVars();
    if (paletteVars) {
      Object.entries(paletteVars).forEach(([k, v]) => {
        if (k.startsWith('--') && typeof v === 'string') root.style.setProperty(k, v);
      });
      // O header (RFC-0121 ModalHeader) lê --modal-header-bg via style inline no
      // próprio elemento; alinha ao accent p/ o cabeçalho também herdar a paleta.
      const accent = paletteVars['--myio-brand-700'] || paletteVars['--myio-primary'];
      if (accent) {
        const header = this.modal?.querySelector('.myio-modal-header') as HTMLElement | null;
        header?.style.setProperty('--modal-header-bg', accent);
      }
    }

    // 2) themeTokens explícito (override do host) — aplicado por último, inline
    //    no root, p/ vencer a paleta quando o caller define tokens específicos.
    if (this.config.themeTokens) {
      for (const [property, value] of Object.entries(this.config.themeTokens)) {
        root.style.setProperty(`--myio-${property}`, String(value));
      }
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

  // ============================================================================
  // RFC-0190: Exclude Groups Totals
  // ============================================================================

  private static readonly ENERGY_GROUPS = [
    { key: 'entrada',     label: 'Entrada' },
    { key: 'lojas',       label: 'Lojas' },
    { key: 'climatizacao', label: 'Climatização' },
    { key: 'elevadores',  label: 'Elevadores' },
    { key: 'esc_rolantes', label: 'Esc. Rolantes' },
    { key: 'outros',      label: 'Outros Equipamentos' },
    { key: 'area_comum',  label: 'Área Comum' },
  ];
}

type Domain = 'energy' | 'water' | 'temperature';
