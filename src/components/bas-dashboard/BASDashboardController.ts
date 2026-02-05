/**
 * RFC-0158: Building Automation System (BAS) Dashboard Controller
 */

import type {
  BASDashboardParams,
  BASDashboardData,
  BASDashboardThemeMode,
  HVACDevice,
  MotorDevice,
} from './types';
import { BASDashboardView } from './BASDashboardView';

export class BASDashboardController {
  private view: BASDashboardView;
  private onFloorSelect?: (floor: string | null) => void;
  private onDeviceClick?: (device: HVACDevice | MotorDevice) => void;

  constructor(container: HTMLElement, params: BASDashboardParams) {
    this.onFloorSelect = params.onFloorSelect;
    this.onDeviceClick = params.onDeviceClick;

    this.view = new BASDashboardView({
      container,
      settings: params.settings,
      themeMode: params.themeMode,
      onFloorSelect: (floor) => {
        this.onFloorSelect?.(floor);
      },
      onDeviceClick: (device) => {
        this.onDeviceClick?.(device);
      },
    });

    // Set initial data
    if (params.floors) {
      this.view.updateFloors(params.floors);
    }
    if (params.hvacDevices) {
      this.view.updateHVACDevices(params.hvacDevices);
    }
    if (params.motorDevices) {
      this.view.updateMotorDevices(params.motorDevices);
    }
  }

  public getElement(): HTMLElement {
    return this.view.getElement();
  }

  public updateData(data: Partial<BASDashboardData>): void {
    if (data.floors) {
      this.view.updateFloors(data.floors);
    }
    if (data.hvacDevices) {
      this.view.updateHVACDevices(data.hvacDevices);
    }
    if (data.motorDevices) {
      this.view.updateMotorDevices(data.motorDevices);
    }
  }

  public setThemeMode(mode: BASDashboardThemeMode): void {
    this.view.setThemeMode(mode);
  }

  public getThemeMode(): BASDashboardThemeMode {
    return this.view.getThemeMode();
  }

  public setSelectedFloor(floor: string | null): void {
    this.view.setSelectedFloor(floor);
  }

  public getSelectedFloor(): string | null {
    return this.view.getSelectedFloor();
  }

  public resize(): void {
    this.view.resize();
  }

  public destroy(): void {
    this.view.destroy();
  }
}
