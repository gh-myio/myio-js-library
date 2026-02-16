/**
 * RFC-0167: On/Off Device Modal View
 * Handles DOM rendering for the On/Off device modal
 */

import type {
  OnOffDeviceData,
  OnOffDeviceModalParams,
  OnOffDeviceModalState,
  OnOffDeviceThemeMode,
  OnOffModalView,
  OnOffScheduleEntry,
  UsageDataPoint,
  DeviceTypeConfig,
} from './types';
import { DEFAULT_MODAL_STATE } from './types';
import { getDeviceConfig, getModalTitle } from './deviceConfig';
import { ON_OFF_MODAL_CSS_PREFIX, injectOnOffDeviceModalStyles } from './styles';
import {
  renderOnOffTimelineChart,
  initOnOffTimelineTooltips,
  generateMockOnOffTimelineData,
  type OnOffTimelineData,
} from '../../on-off-timeline-chart';
import { createDateRangePicker } from '../../createDateRangePicker';

export interface OnOffDeviceModalViewOptions {
  container: HTMLElement;
  device: OnOffDeviceData;
  themeMode: OnOffDeviceThemeMode;
  deviceConfig: DeviceTypeConfig;
  onToggleView: () => void;
  onDeviceToggle: (newState: boolean) => void;
  onScheduleSave?: (schedules: OnOffScheduleEntry[]) => void;
  onRefresh?: () => void;
  onDateRangeChange?: (startISO: string, endISO: string) => void;
  parentEl?: HTMLElement;
}

export class OnOffDeviceModalView {
  private root: HTMLElement;
  private container: HTMLElement;
  private device: OnOffDeviceData;
  private themeMode: OnOffDeviceThemeMode;
  private deviceConfig: DeviceTypeConfig;
  private state: OnOffDeviceModalState;

  // Child elements
  private leftPanel: HTMLElement | null = null;
  private rightPanel: HTMLElement | null = null;
  private controlContainer: HTMLElement | null = null;
  private scheduleButtonContainer: HTMLElement | null = null;
  private chartView: HTMLElement | null = null;
  private scheduleView: HTMLElement | null = null;
  private scheduleContent: HTMLElement | null = null;

  // Child component instances
  private solenoidControlInstance: any = null;
  private scheduleOnOffInstance: any = null;
  private dateRangePickerInstance: any = null;
  private dateRangeInputEl: HTMLInputElement | null = null;

  // Callbacks
  private onToggleView: () => void;
  private onDeviceToggle: (newState: boolean) => void;
  private onScheduleSave?: (schedules: OnOffScheduleEntry[]) => void;
  private onRefresh?: () => void;
  private onDateRangeChange?: (startISO: string, endISO: string) => void;
  private parentEl?: HTMLElement;

  constructor(options: OnOffDeviceModalViewOptions) {
    this.container = options.container;
    this.device = options.device;
    this.themeMode = options.themeMode;
    this.deviceConfig = options.deviceConfig;
    this.onToggleView = options.onToggleView;
    this.onDeviceToggle = options.onDeviceToggle;
    this.onScheduleSave = options.onScheduleSave;
    this.onRefresh = options.onRefresh;
    this.onDateRangeChange = options.onDateRangeChange;
    this.parentEl = options.parentEl;

    this.state = {
      ...DEFAULT_MODAL_STATE,
      deviceConfig: options.deviceConfig,
    };

    injectOnOffDeviceModalStyles();

    this.root = document.createElement('div');
    this.root.className = this.getRootClassName();

    this.render();
    this.container.appendChild(this.root);
  }

  private getRootClassName(): string {
    const classes = [ON_OFF_MODAL_CSS_PREFIX];
    if (this.themeMode === 'dark') {
      classes.push(`${ON_OFF_MODAL_CSS_PREFIX}--dark`);
    }
    return classes.join(' ');
  }

  private render(): void {
    this.root.innerHTML = '';

    // Create left panel (20% width)
    this.leftPanel = this.createLeftPanel();
    this.root.appendChild(this.leftPanel);

    // Create right panel (80% width)
    this.rightPanel = this.createRightPanel();
    this.root.appendChild(this.rightPanel);

    // Initialize child components
    this.initializeComponents();
  }

  private createLeftPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = `${ON_OFF_MODAL_CSS_PREFIX}__left-panel`;

    // Control container (top area)
    this.controlContainer = document.createElement('div');
    this.controlContainer.className = `${ON_OFF_MODAL_CSS_PREFIX}__control-container`;
    panel.appendChild(this.controlContainer);

    // Bottom buttons container (schedule + refresh)
    const bottomButtons = document.createElement('div');
    bottomButtons.className = `${ON_OFF_MODAL_CSS_PREFIX}__bottom-buttons`;

    // Schedule button container
    this.scheduleButtonContainer = document.createElement('div');
    this.scheduleButtonContainer.className = `${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn-container`;

    const scheduleBtn = document.createElement('button');
    scheduleBtn.className = `${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn`;
    scheduleBtn.innerHTML = `
      <span class="${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn-icon" data-icon>📅</span>
      <span class="${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn-label" data-label>Agendamento</span>
    `;
    scheduleBtn.addEventListener('click', () => this.onToggleView());
    this.scheduleButtonContainer.appendChild(scheduleBtn);
    bottomButtons.appendChild(this.scheduleButtonContainer);

    // Refresh button (bottom)
    const refreshBtn = document.createElement('button');
    refreshBtn.className = `${ON_OFF_MODAL_CSS_PREFIX}__refresh-btn`;
    refreshBtn.innerHTML = `
      <span class="${ON_OFF_MODAL_CSS_PREFIX}__refresh-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span>
      <span>Atualizar</span>
    `;
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add(`${ON_OFF_MODAL_CSS_PREFIX}__refresh-btn--loading`);
      this.onRefresh?.();
      setTimeout(() => {
        refreshBtn.classList.remove(`${ON_OFF_MODAL_CSS_PREFIX}__refresh-btn--loading`);
      }, 1500);
    });
    bottomButtons.appendChild(refreshBtn);

    panel.appendChild(bottomButtons);

    return panel;
  }

  private createRightPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = `${ON_OFF_MODAL_CSS_PREFIX}__right-panel`;

    // Toolbar with date range picker
    const toolbar = this.createToolbar();
    panel.appendChild(toolbar);

    // Chart view (default)
    this.chartView = this.createChartView();
    panel.appendChild(this.chartView);

    // Schedule view (hidden by default - only one view visible at a time)
    this.scheduleView = this.createScheduleView();
    this.scheduleView.classList.add(`${ON_OFF_MODAL_CSS_PREFIX}__view-container--hidden`);
    this.scheduleView.style.display = 'none';
    panel.appendChild(this.scheduleView);

    return panel;
  }

  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = `${ON_OFF_MODAL_CSS_PREFIX}__toolbar`;

    const label = document.createElement('span');
    label.className = `${ON_OFF_MODAL_CSS_PREFIX}__toolbar-label`;
    label.textContent = 'Período';
    toolbar.appendChild(label);

    // Wrapper with calendar icon
    const wrapper = document.createElement('div');
    wrapper.className = `${ON_OFF_MODAL_CSS_PREFIX}__date-input-wrapper`;

    const iconSpan = document.createElement('span');
    iconSpan.className = `${ON_OFF_MODAL_CSS_PREFIX}__date-input-icon`;
    iconSpan.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    wrapper.appendChild(iconSpan);

    this.dateRangeInputEl = document.createElement('input');
    this.dateRangeInputEl.type = 'text';
    this.dateRangeInputEl.readOnly = true;
    this.dateRangeInputEl.placeholder = 'Selecione o período...';
    this.dateRangeInputEl.className = `${ON_OFF_MODAL_CSS_PREFIX}__date-input`;
    wrapper.appendChild(this.dateRangeInputEl);

    toolbar.appendChild(wrapper);

    return toolbar;
  }

  private createChartView(): HTMLElement {
    const view = document.createElement('div');
    view.className = `${ON_OFF_MODAL_CSS_PREFIX}__view-container ${ON_OFF_MODAL_CSS_PREFIX}__chart-view`;

    // Chart content container (fills entire view, no title header)
    const content = document.createElement('div');
    content.className = `${ON_OFF_MODAL_CSS_PREFIX}__chart-content`;
    content.id = `onoff-chart-${Date.now()}`;

    // Generate mock timeline data with device-specific labels
    const mockData = this.generateDeviceTimelineData();

    // Render timeline chart
    content.innerHTML = renderOnOffTimelineChart(mockData, {
      themeMode: this.themeMode,
      labels: {
        on: this.deviceConfig.labelOn,
        off: this.deviceConfig.labelOff,
      },
      onColor: this.deviceConfig.controlColor,
    });

    view.appendChild(content);

    // Initialize tooltips after DOM is ready
    requestAnimationFrame(() => {
      initOnOffTimelineTooltips(content, {
        on: this.deviceConfig.labelOn,
        off: this.deviceConfig.labelOff,
      });
    });

    return view;
  }

  /**
   * Generate timeline data for the device
   * Uses mock data for now - will be replaced with real telemetry data
   */
  private generateDeviceTimelineData(startISO?: string, endISO?: string): OnOffTimelineData {
    const mockData = generateMockOnOffTimelineData(startISO, endISO);

    // Customize with device info
    return {
      ...mockData,
      deviceId: this.device.id || 'unknown',
      deviceName: this.device.label || this.device.name || 'Dispositivo',
    };
  }

  /**
   * Re-render the chart with a new date range
   */
  private reRenderChart(startISO?: string, endISO?: string): void {
    const chartContent = this.chartView?.querySelector(`.${ON_OFF_MODAL_CSS_PREFIX}__chart-content`);
    if (!chartContent) return;

    const data = this.generateDeviceTimelineData(startISO, endISO);
    chartContent.innerHTML = renderOnOffTimelineChart(data, {
      themeMode: this.themeMode,
      labels: {
        on: this.deviceConfig.labelOn,
        off: this.deviceConfig.labelOff,
      },
      onColor: this.deviceConfig.controlColor,
    });

    // Re-initialize tooltips
    requestAnimationFrame(() => {
      initOnOffTimelineTooltips(chartContent as HTMLElement, {
        on: this.deviceConfig.labelOn,
        off: this.deviceConfig.labelOff,
      });
    });
  }

  private createScheduleView(): HTMLElement {
    const view = document.createElement('div');
    view.className = `${ON_OFF_MODAL_CSS_PREFIX}__view-container ${ON_OFF_MODAL_CSS_PREFIX}__schedule-view`;

    // Header
    const header = document.createElement('div');
    header.className = `${ON_OFF_MODAL_CSS_PREFIX}__schedule-header`;
    header.innerHTML = `
      <h3 class="${ON_OFF_MODAL_CSS_PREFIX}__schedule-title">Agendamentos</h3>
    `;
    view.appendChild(header);

    // Schedule content container (will be populated by ScheduleOnOff component)
    this.scheduleContent = document.createElement('div');
    this.scheduleContent.className = `${ON_OFF_MODAL_CSS_PREFIX}__schedule-content`;
    view.appendChild(this.scheduleContent);

    return view;
  }

  private initializeComponents(): void {
    // Initialize SolenoidControl component
    this.initializeSolenoidControl();

    // Initialize DateRangePicker
    this.initializeDateRangePicker();

    // Initialize ScheduleOnOff component (lazy - only when schedule view is shown)
  }

  private async initializeDateRangePicker(): Promise<void> {
    if (!this.dateRangeInputEl) return;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    try {
      this.dateRangePickerInstance = await createDateRangePicker(this.dateRangeInputEl, {
        presetStart: sevenDaysAgo.toISOString(),
        presetEnd: now.toISOString(),
        includeTime: true,
        timePrecision: 'minute',
        maxRangeDays: 31,
        locale: 'pt-BR',
        parentEl: this.parentEl || undefined,
        onApply: (result: { startISO: string; endISO: string }) => {
          if (!result.startISO || !result.endISO) return;
          // Re-render chart with new date range
          this.reRenderChart(result.startISO, result.endISO);
          // Notify external callback
          this.onDateRangeChange?.(result.startISO, result.endISO);
        },
      });
    } catch (error) {
      console.warn('[OnOffDeviceModalView] DateRangePicker initialization failed:', error);
    }
  }

  private initializeSolenoidControl(): void {
    if (!this.controlContainer) return;

    // Check if MyIOLibrary is available
    const MyIOLibrary = (window as any).MyIOLibrary;
    if (!MyIOLibrary?.createSolenoidControl) {
      console.warn('[OnOffDeviceModalView] createSolenoidControl not available');
      this.renderFallbackControl();
      return;
    }

    try {
      // Determine initial state from device attributes
      const initialStatus = this.getDeviceStatus();

      this.solenoidControlInstance = MyIOLibrary.createSolenoidControl(this.controlContainer, {
        settings: {
          themeMode: this.themeMode,
          labels: {
            open: this.deviceConfig.labelOn,
            closed: this.deviceConfig.labelOff,
            unavailable: 'Indisponível',
            confirmMessage: `Deseja alterar o estado do dispositivo?`,
          },
        },
        initialState: {
          status: initialStatus,
          deviceName: this.device.label || this.device.name || 'Dispositivo',
          relatedDevices: [],
        },
        onToggle: async (currentStatus: string) => {
          const newState = currentStatus !== 'on';
          this.onDeviceToggle(newState);
          return true;
        },
      });
    } catch (error) {
      console.error('[OnOffDeviceModalView] Error creating SolenoidControl:', error);
      this.renderFallbackControl();
    }
  }

  private getDeviceStatus(): 'on' | 'off' | 'offline' {
    // Check device status from various sources
    const attrs = this.device.attributes || {};
    const rawData = this.device.rawData || {};

    // Check if device is offline
    if (this.device.status === 'offline') {
      return 'offline';
    }

    // Check state from attributes or rawData
    // RFC-0175: Also check rawData.status for solenoid devices (MAIN_BAS uses cd.status)
    const state = attrs.state ?? rawData.state ?? rawData.status ?? attrs.acionamento ?? rawData.acionamento;

    // RFC-0175: Solenoid has INVERTED logic - 'off' means valve OPEN, 'on' means valve CLOSED
    // For solenoid: status='off' → valve open → modal shows 'on' (operating)
    // For solenoid: status='on' → valve closed → modal shows 'off' (not operating)
    const deviceTypeUpper = (this.device.deviceType || '').toUpperCase();
    const deviceProfileUpper = (this.device.deviceProfile || '').toUpperCase();
    const isSolenoid = deviceTypeUpper.includes('SOLENOIDE') ||
      deviceProfileUpper.includes('SOLENOIDE') ||
      deviceTypeUpper === 'SOLENOID' ||
      deviceProfileUpper === 'SOLENOID';

    if (isSolenoid) {
      // Inverted logic for solenoid
      if (state === false || state === 'off' || state === 0 || state === 'aberta' || state === 'desligado') {
        return 'on'; // off = valve open = operating
      }
      return 'off'; // on = valve closed = not operating
    }

    // Standard logic for other devices
    if (state === true || state === 'on' || state === 1 || state === 'aberta' || state === 'ligado') {
      return 'on';
    }

    return 'off';
  }

  private renderFallbackControl(): void {
    if (!this.controlContainer) return;

    const status = this.getDeviceStatus();
    const isOn = status === 'on';
    const isOffline = status === 'offline';

    this.controlContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px;">
        <div style="font-size: 48px;">${this.deviceConfig.icon}</div>
        <button
          class="${ON_OFF_MODAL_CSS_PREFIX}__fallback-toggle"
          style="
            padding: 12px 24px;
            font-size: 16px;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: ${isOffline ? 'not-allowed' : 'pointer'};
            background: ${isOffline ? '#6b7280' : (isOn ? '#22c55e' : '#ef4444')};
            color: white;
            transition: all 0.2s ease;
          "
          ${isOffline ? 'disabled' : ''}
          data-action="toggle"
        >
          ${isOffline ? 'Indisponível' : (isOn ? this.deviceConfig.labelOn : this.deviceConfig.labelOff)}
        </button>
      </div>
    `;

    if (!isOffline) {
      const toggleBtn = this.controlContainer.querySelector('[data-action="toggle"]');
      toggleBtn?.addEventListener('click', () => {
        this.onDeviceToggle(!isOn);
      });
    }
  }

  private initializeScheduleOnOff(): void {
    if (!this.scheduleContent) return;
    if (this.scheduleOnOffInstance) return; // Already initialized

    const MyIOLibrary = (window as any).MyIOLibrary;
    if (!MyIOLibrary?.createScheduleOnOff) {
      console.warn('[OnOffDeviceModalView] createScheduleOnOff not available');
      this.renderFallbackSchedule();
      return;
    }

    try {
      this.scheduleOnOffInstance = MyIOLibrary.createScheduleOnOff(this.scheduleContent, {
        settings: {
          themeMode: this.themeMode,
        },
        initialState: {
          entityName: this.device.label || this.device.name || 'Dispositivo',
          schedules: this.state.schedules,
          groupSchedules: [],
          loading: false,
        },
        onSave: async (schedules: OnOffScheduleEntry[]) => {
          console.log('[OnOffDeviceModalView] Saving schedules:', schedules);
          this.onScheduleSave?.(schedules);
          return true;
        },
      });
    } catch (error) {
      console.error('[OnOffDeviceModalView] Error creating ScheduleOnOff:', error);
      this.renderFallbackSchedule();
    }
  }

  private renderFallbackSchedule(): void {
    if (!this.scheduleContent) return;

    this.scheduleContent.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; color: #6b7280;">
        <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
        <p style="text-align: center;">Componente de agendamento não disponível.</p>
        <p style="text-align: center; font-size: 14px;">Verifique se a biblioteca está carregada corretamente.</p>
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== Public Methods =====

  public getElement(): HTMLElement {
    return this.root;
  }

  public setThemeMode(mode: OnOffDeviceThemeMode): void {
    this.themeMode = mode;
    this.root.className = this.getRootClassName();

    // Update child components theme
    if (this.solenoidControlInstance?.setThemeMode) {
      this.solenoidControlInstance.setThemeMode(mode);
    }
    if (this.scheduleOnOffInstance?.setThemeMode) {
      this.scheduleOnOffInstance.setThemeMode(mode);
    }

    // Re-render the chart with new theme
    this.updateChartTheme();

    // Re-initialize date picker for new theme
    if (this.dateRangePickerInstance?.destroy) {
      this.dateRangePickerInstance.destroy();
      this.dateRangePickerInstance = null;
    }
    this.initializeDateRangePicker();
  }

  private updateChartTheme(): void {
    const chartContent = this.chartView?.querySelector(`.${ON_OFF_MODAL_CSS_PREFIX}__chart-content`);
    if (!chartContent) return;

    const mockData = this.generateDeviceTimelineData();
    chartContent.innerHTML = renderOnOffTimelineChart(mockData, {
      themeMode: this.themeMode,
      labels: {
        on: this.deviceConfig.labelOn,
        off: this.deviceConfig.labelOff,
      },
      onColor: this.deviceConfig.controlColor,
    });

    // Re-initialize tooltips
    initOnOffTimelineTooltips(chartContent as HTMLElement, {
      on: this.deviceConfig.labelOn,
      off: this.deviceConfig.labelOff,
    });
  }

  public updateDeviceState(state: boolean): void {
    this.state.deviceState = state;

    if (this.solenoidControlInstance?.updateState) {
      this.solenoidControlInstance.updateState({
        status: state ? 'on' : 'off',
      });
    }
  }

  public toggleView(): void {
    const newView: OnOffModalView = this.state.currentView === 'chart' ? 'schedule' : 'chart';
    this.state.currentView = newView;

    if (newView === 'schedule') {
      // Hide chart completely, show schedule
      if (this.chartView) {
        this.chartView.classList.add(`${ON_OFF_MODAL_CSS_PREFIX}__view-container--hidden`);
        this.chartView.style.display = 'none';
      }
      if (this.scheduleView) {
        this.scheduleView.classList.remove(`${ON_OFF_MODAL_CSS_PREFIX}__view-container--hidden`);
        this.scheduleView.style.display = '';
      }

      // Lazy initialize schedule component
      this.initializeScheduleOnOff();

      // Update button
      this.updateScheduleButton('📊', 'Ver Gráfico');
    } else {
      // Hide schedule completely, show chart
      if (this.scheduleView) {
        this.scheduleView.classList.add(`${ON_OFF_MODAL_CSS_PREFIX}__view-container--hidden`);
        this.scheduleView.style.display = 'none';
      }
      if (this.chartView) {
        this.chartView.classList.remove(`${ON_OFF_MODAL_CSS_PREFIX}__view-container--hidden`);
        this.chartView.style.display = '';
      }

      // Update button
      this.updateScheduleButton('📅', 'Agendamento');
    }
  }

  private updateScheduleButton(icon: string, label: string): void {
    const btn = this.scheduleButtonContainer?.querySelector(`.${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn`);
    if (btn) {
      const iconEl = btn.querySelector('[data-icon]');
      const labelEl = btn.querySelector('[data-label]');
      if (iconEl) iconEl.textContent = icon;
      if (labelEl) labelEl.textContent = label;
    }
  }

  public showLoading(): void {
    this.state.isLoading = true;
    // Could add loading indicator to right panel if needed
  }

  public hideLoading(): void {
    this.state.isLoading = false;
  }

  public updateUsageData(data: UsageDataPoint[]): void {
    this.state.usageData = data;

    // TODO: Convert UsageDataPoint[] to OnOffTimelineData and re-render chart
    // For now, the chart uses mock data
    // Future implementation will transform real telemetry data into timeline segments
  }

  /**
   * Update the timeline chart with real telemetry data
   * @param timelineData - Timeline data from device telemetry
   */
  public updateTimelineData(timelineData: OnOffTimelineData): void {
    const chartContent = this.chartView?.querySelector(`.${ON_OFF_MODAL_CSS_PREFIX}__chart-content`);
    if (!chartContent) return;

    chartContent.innerHTML = renderOnOffTimelineChart(timelineData, {
      themeMode: this.themeMode,
      labels: {
        on: this.deviceConfig.labelOn,
        off: this.deviceConfig.labelOff,
      },
      onColor: this.deviceConfig.controlColor,
    });

    // Re-initialize tooltips
    initOnOffTimelineTooltips(chartContent as HTMLElement, {
      on: this.deviceConfig.labelOn,
      off: this.deviceConfig.labelOff,
    });
  }

  public updateSchedules(schedules: OnOffScheduleEntry[]): void {
    this.state.schedules = schedules;
    if (this.scheduleOnOffInstance?.updateState) {
      this.scheduleOnOffInstance.updateState({ schedules });
    }
  }

  public getCurrentView(): OnOffModalView {
    return this.state.currentView;
  }

  public destroy(): void {
    // Destroy child components
    if (this.solenoidControlInstance?.destroy) {
      this.solenoidControlInstance.destroy();
    }
    if (this.scheduleOnOffInstance?.destroy) {
      this.scheduleOnOffInstance.destroy();
    }
    if (this.dateRangePickerInstance?.destroy) {
      this.dateRangePickerInstance.destroy();
    }

    // Remove root element
    this.root.remove();
  }
}
