/**
 * RFC-0158: Building Automation System (BAS) Dashboard View
 */

import type {
  BASDashboardThemeMode,
  BASDashboardSettings,
  HVACDevice,
  MotorDevice,
} from './types';
import { DEFAULT_BAS_SETTINGS } from './types';
import { BAS_DASHBOARD_CSS_PREFIX, injectBASDashboardStyles } from './styles';
import { renderCardComponentV6 } from '../../components/template-card-v6/template-card-v6.js';

const MOTOR_TYPE_MAP: Record<string, string> = {
  pump: 'BOMBA_HIDRAULICA',
  motor: 'MOTOR',
  other: 'MOTOR',
};

const HVAC_STATUS_MAP: Record<string, string> = {
  active: 'online',
  inactive: 'offline',
  no_reading: 'no_info',
};

const MOTOR_STATUS_MAP: Record<string, string> = {
  running: 'online',
  stopped: 'offline',
  unknown: 'no_info',
};

export interface BASDashboardViewOptions {
  container: HTMLElement;
  settings?: BASDashboardSettings;
  themeMode?: BASDashboardThemeMode;
  onFloorSelect?: (floor: string | null) => void;
  onDeviceClick?: (device: HVACDevice | MotorDevice) => void;
}

function hvacDeviceToEntityObject(device: HVACDevice): Record<string, unknown> {
  const deviceStatus = HVAC_STATUS_MAP[device.status] || 'no_info';

  return {
    entityId: device.id,
    labelOrName: device.name,
    deviceIdentifier: device.id,
    deviceType: 'TERMOSTATO',
    val: device.temperature ?? 0,
    deviceStatus,
    perc: 0,
    temperature: device.temperature,
    temperatureMin: device.setpoint ? device.setpoint - 2 : 18,
    temperatureMax: device.setpoint ? device.setpoint + 2 : 26,
    consumption: device.consumption,
  };
}

function motorDeviceToEntityObject(device: MotorDevice): Record<string, unknown> {
  const deviceType = MOTOR_TYPE_MAP[device.type] || 'MOTOR';
  const deviceStatus = MOTOR_STATUS_MAP[device.status] || 'no_info';

  return {
    entityId: device.id,
    labelOrName: device.name,
    deviceIdentifier: device.id,
    deviceType,
    val: device.consumption,
    deviceStatus,
    perc: 0,
  };
}

export class BASDashboardView {
  private container: HTMLElement;
  private settings: Required<BASDashboardSettings>;
  private themeMode: BASDashboardThemeMode;
  private root: HTMLElement;

  private selectedFloor: string | null = null;
  private hvacDevices: HVACDevice[] = [];
  private motorDevices: MotorDevice[] = [];
  private floors: string[] = [];

  private onFloorSelect?: (floor: string | null) => void;
  private onDeviceClick?: (device: HVACDevice | MotorDevice) => void;

  constructor(options: BASDashboardViewOptions) {
    this.container = options.container;
    this.settings = { ...DEFAULT_BAS_SETTINGS, ...options.settings };
    this.themeMode = options.themeMode ?? this.settings.defaultThemeMode;
    this.onFloorSelect = options.onFloorSelect;
    this.onDeviceClick = options.onDeviceClick;

    injectBASDashboardStyles();

    this.root = document.createElement('div');
    this.root.className = this.getRootClassName();
    this.applyThemeColors();

    this.render();
    this.container.appendChild(this.root);
  }

  private getRootClassName(): string {
    const classes = [BAS_DASHBOARD_CSS_PREFIX];
    // Default is dark theme, only add --light modifier for light mode
    if (this.themeMode === 'light') {
      classes.push(`${BAS_DASHBOARD_CSS_PREFIX}--light`);
    }
    return classes.join(' ');
  }

  private applyThemeColors(): void {
    this.root.style.setProperty('--bas-primary-color', this.settings.primaryColor);
    this.root.style.setProperty('--bas-warning-color', this.settings.warningColor);
    this.root.style.setProperty('--bas-error-color', this.settings.errorColor);
    this.root.style.setProperty('--bas-success-color', this.settings.successColor);
  }

  private isPanelsOnly(): boolean {
    return !this.settings.showCharts
      && !this.settings.showFloorsSidebar
      && !this.settings.showWaterInfrastructure;
  }

  private render(): void {
    if (this.isPanelsOnly()) {
      // Panels-only mode: skip header and main area, render panels filling full space
      this.root.innerHTML = `
        <div class="${BAS_DASHBOARD_CSS_PREFIX}__content ${BAS_DASHBOARD_CSS_PREFIX}__content--panels-only">
          ${(this.settings.showEnvironments || this.settings.showPumpsMotors) ? this.renderRightPanel() : ''}
        </div>
      `;
    } else {
      this.root.innerHTML = `
        <div class="${BAS_DASHBOARD_CSS_PREFIX}__header">
          <h1 class="${BAS_DASHBOARD_CSS_PREFIX}__title">${this.escapeHtml(this.settings.dashboardTitle)}</h1>
        </div>
        <div class="${BAS_DASHBOARD_CSS_PREFIX}__content">
          <div class="${BAS_DASHBOARD_CSS_PREFIX}__main">
            ${this.settings.showCharts ? this.renderChartsArea() : ''}
          </div>
          ${(this.settings.showEnvironments || this.settings.showPumpsMotors) ? this.renderRightPanel() : ''}
        </div>
      `;
    }

    this.populateCardGrids();
  }

  private populateCardGrids(): void {
    const hvacList = this.root.querySelector('[data-hvac-list]') as HTMLElement;
    if (hvacList) {
      this.renderHVACList(hvacList);
    }

    const motorsList = this.root.querySelector('[data-motors-list]') as HTMLElement;
    if (motorsList) {
      this.renderMotorsList(motorsList);
    }
  }

  private renderChartsArea(): string {
    return `
      <div class="${BAS_DASHBOARD_CSS_PREFIX}__charts-area">
        <div class="${BAS_DASHBOARD_CSS_PREFIX}__charts-grid">
          <div class="${BAS_DASHBOARD_CSS_PREFIX}__chart-container" data-chart="temperature">
            <h3 class="${BAS_DASHBOARD_CSS_PREFIX}__chart-title">${this.escapeHtml(this.settings.temperatureChartTitle)}</h3>
            <div class="${BAS_DASHBOARD_CSS_PREFIX}__chart-placeholder">Grafico de temperatura</div>
          </div>
          <div class="${BAS_DASHBOARD_CSS_PREFIX}__chart-container" data-chart="consumption">
            <h3 class="${BAS_DASHBOARD_CSS_PREFIX}__chart-title">${this.escapeHtml(this.settings.consumptionChartTitle)}</h3>
            <div class="${BAS_DASHBOARD_CSS_PREFIX}__chart-placeholder">Grafico de consumo</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderRightPanel(): string {
    return `
      <div class="${BAS_DASHBOARD_CSS_PREFIX}__right-panel">
        ${this.settings.showEnvironments ? this.renderEnvironmentsPanel() : ''}
        ${this.settings.showPumpsMotors ? this.renderMotorsPanel() : ''}
      </div>
    `;
  }

  private renderEnvironmentsPanel(): string {
    return `
      <div class="${BAS_DASHBOARD_CSS_PREFIX}__panel-section">
        <div class="${BAS_DASHBOARD_CSS_PREFIX}__panel-header">
          <h3 class="${BAS_DASHBOARD_CSS_PREFIX}__panel-title">${this.escapeHtml(this.settings.environmentsLabel)}</h3>
        </div>
        <div class="${BAS_DASHBOARD_CSS_PREFIX}__panel-list" data-hvac-list></div>
      </div>
    `;
  }

  private renderHVACList(container: HTMLElement): void {
    const filtered = this.getFilteredHVACDevices();

    if (filtered.length === 0) {
      container.innerHTML = `<div class="${BAS_DASHBOARD_CSS_PREFIX}__empty">Nenhum ambiente</div>`;
      return;
    }

    container.innerHTML = '';
    filtered.forEach(device => {
      const entityObject = hvacDeviceToEntityObject(device);
      const cardResult = renderCardComponentV6({
        entityObject,
        handleActionDashboard: undefined,
        handleActionReport: undefined,
        handleActionSettings: undefined,
        handleSelect: undefined,
        handInfo: undefined,
        handleClickCard: () => {
          this.onDeviceClick?.(device);
        },
        enableSelection: false,
        enableDragDrop: false,
        useNewComponents: true,
        showTempRangeTooltip: true,
        customStyle: this.settings.cardCustomStyle || undefined,
      });

      if (cardResult && cardResult[0]) {
        const wrapper = document.createElement('div');
        wrapper.className = `${BAS_DASHBOARD_CSS_PREFIX}__card-wrapper`;
        wrapper.dataset.hvacDevice = device.id;
        wrapper.appendChild(cardResult[0]);
        container.appendChild(wrapper);
      }
    });
  }

  private renderMotorsPanel(): string {
    return `
      <div class="${BAS_DASHBOARD_CSS_PREFIX}__panel-section">
        <div class="${BAS_DASHBOARD_CSS_PREFIX}__panel-header">
          <h3 class="${BAS_DASHBOARD_CSS_PREFIX}__panel-title">${this.escapeHtml(this.settings.pumpsMotorsLabel)}</h3>
        </div>
        <div class="${BAS_DASHBOARD_CSS_PREFIX}__panel-list" data-motors-list></div>
      </div>
    `;
  }

  private renderMotorsList(container: HTMLElement): void {
    const filtered = this.getFilteredMotorDevices();

    if (filtered.length === 0) {
      container.innerHTML = `<div class="${BAS_DASHBOARD_CSS_PREFIX}__empty">Nenhum equipamento</div>`;
      return;
    }

    container.innerHTML = '';
    filtered.forEach(device => {
      const entityObject = motorDeviceToEntityObject(device);
      const cardResult = renderCardComponentV6({
        entityObject,
        handleActionDashboard: undefined,
        handleActionReport: undefined,
        handleActionSettings: undefined,
        handleSelect: undefined,
        handInfo: undefined,
        handleClickCard: () => {
          this.onDeviceClick?.(device);
        },
        enableSelection: false,
        enableDragDrop: false,
        useNewComponents: true,
        customStyle: this.settings.cardCustomStyle || undefined,
      });

      if (cardResult && cardResult[0]) {
        const wrapper = document.createElement('div');
        wrapper.className = `${BAS_DASHBOARD_CSS_PREFIX}__card-wrapper`;
        wrapper.dataset.motorDevice = device.id;
        wrapper.appendChild(cardResult[0]);
        container.appendChild(wrapper);
      }
    });
  }

  private getFilteredHVACDevices(): HVACDevice[] {
    if (!this.selectedFloor) return this.hvacDevices;
    return this.hvacDevices.filter(d => d.floor === this.selectedFloor);
  }

  private getFilteredMotorDevices(): MotorDevice[] {
    if (!this.selectedFloor) return this.motorDevices;
    return this.motorDevices.filter(d => d.floor === this.selectedFloor);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public methods

  public getElement(): HTMLElement {
    return this.root;
  }

  public setSelectedFloor(floor: string | null): void {
    this.selectedFloor = floor;
    this.updateHVACList();
    this.updateMotorsList();
  }

  public getSelectedFloor(): string | null {
    return this.selectedFloor;
  }

  public setThemeMode(mode: BASDashboardThemeMode): void {
    this.themeMode = mode;
    this.root.className = this.getRootClassName();
  }

  public getThemeMode(): BASDashboardThemeMode {
    return this.themeMode;
  }

  public updateFloors(floors: string[]): void {
    this.floors = floors;
    this.updateFloorButtons();
  }

  public updateHVACDevices(devices: HVACDevice[]): void {
    this.hvacDevices = devices;
    this.updateHVACList();
  }

  public updateMotorDevices(devices: MotorDevice[]): void {
    this.motorDevices = devices;
    this.updateMotorsList();
  }

  private updateFloorButtons(): void {
    // Floor list is managed externally by the controller via EntityListPanel
  }

  private updateHVACList(): void {
    const container = this.root.querySelector('[data-hvac-list]') as HTMLElement;
    if (container) {
      this.renderHVACList(container);
    }
  }

  private updateMotorsList(): void {
    const container = this.root.querySelector('[data-motors-list]') as HTMLElement;
    if (container) {
      this.renderMotorsList(container);
    }
  }

  public resize(): void {
    // Charts will need resize handling when implemented
  }

  public destroy(): void {
    this.root.remove();
  }
}
