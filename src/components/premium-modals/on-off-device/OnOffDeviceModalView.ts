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

export interface OnOffDeviceModalViewOptions {
  container: HTMLElement;
  device: OnOffDeviceData;
  themeMode: OnOffDeviceThemeMode;
  deviceConfig: DeviceTypeConfig;
  onToggleView: () => void;
  onDeviceToggle: (newState: boolean) => void;
  onScheduleSave?: (schedules: OnOffScheduleEntry[]) => void;
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

  // Callbacks
  private onToggleView: () => void;
  private onDeviceToggle: (newState: boolean) => void;
  private onScheduleSave?: (schedules: OnOffScheduleEntry[]) => void;

  constructor(options: OnOffDeviceModalViewOptions) {
    this.container = options.container;
    this.device = options.device;
    this.themeMode = options.themeMode;
    this.deviceConfig = options.deviceConfig;
    this.onToggleView = options.onToggleView;
    this.onDeviceToggle = options.onDeviceToggle;
    this.onScheduleSave = options.onScheduleSave;

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

    // Control container (top 50%)
    this.controlContainer = document.createElement('div');
    this.controlContainer.className = `${ON_OFF_MODAL_CSS_PREFIX}__control-container`;
    panel.appendChild(this.controlContainer);

    // Schedule button container (bottom 50%)
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

    panel.appendChild(this.scheduleButtonContainer);

    return panel;
  }

  private createRightPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = `${ON_OFF_MODAL_CSS_PREFIX}__right-panel`;

    // Chart view (default)
    this.chartView = this.createChartView();
    panel.appendChild(this.chartView);

    // Schedule view (hidden by default)
    this.scheduleView = this.createScheduleView();
    this.scheduleView.classList.add(`${ON_OFF_MODAL_CSS_PREFIX}__view-container--hidden`);
    panel.appendChild(this.scheduleView);

    return panel;
  }

  private createChartView(): HTMLElement {
    const view = document.createElement('div');
    view.className = `${ON_OFF_MODAL_CSS_PREFIX}__view-container ${ON_OFF_MODAL_CSS_PREFIX}__chart-view`;

    // Header
    const header = document.createElement('div');
    header.className = `${ON_OFF_MODAL_CSS_PREFIX}__chart-header`;
    header.innerHTML = `
      <h3 class="${ON_OFF_MODAL_CSS_PREFIX}__chart-title">${this.escapeHtml(this.deviceConfig.chartTitle)}</h3>
    `;
    view.appendChild(header);

    // Chart content container
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
  private generateDeviceTimelineData(): OnOffTimelineData {
    const mockData = generateMockOnOffTimelineData();

    // Customize with device info
    return {
      ...mockData,
      deviceId: this.device.id || 'unknown',
      deviceName: this.device.label || this.device.name || 'Dispositivo',
    };
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

    // Initialize ScheduleOnOff component (lazy - only when schedule view is shown)
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
    const state = attrs.state ?? rawData.state ?? attrs.acionamento ?? rawData.acionamento;
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
      // Show schedule, hide chart
      this.chartView?.classList.add(`${ON_OFF_MODAL_CSS_PREFIX}__view-container--hidden`);
      this.scheduleView?.classList.remove(`${ON_OFF_MODAL_CSS_PREFIX}__view-container--hidden`);

      // Lazy initialize schedule component
      this.initializeScheduleOnOff();

      // Update button
      this.updateScheduleButton('📊', 'Ver Gráfico');
    } else {
      // Show chart, hide schedule
      this.scheduleView?.classList.add(`${ON_OFF_MODAL_CSS_PREFIX}__view-container--hidden`);
      this.chartView?.classList.remove(`${ON_OFF_MODAL_CSS_PREFIX}__view-container--hidden`);

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

    // Remove root element
    this.root.remove();
  }
}
