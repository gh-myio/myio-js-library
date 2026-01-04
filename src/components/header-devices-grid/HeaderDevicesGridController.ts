/**
 * RFC-0125: HeaderDevicesGrid Controller
 * Business logic for stats calculation and updates
 */

import type {
  HeaderDevicesGridParams,
  HeaderDevicesGridInstance,
  HeaderDevicesThemeMode,
  HeaderStats,
  HeaderDevice,
} from './types.js';
import { HeaderDevicesGridView } from './HeaderDevicesGridView.js';

export class HeaderDevicesGridController implements HeaderDevicesGridInstance {
  private view: HeaderDevicesGridView;

  constructor(params: HeaderDevicesGridParams) {
    this.view = new HeaderDevicesGridView(params);
  }

  get element(): HTMLElement {
    return this.view.getElement() as HTMLElement;
  }

  public updateStats(stats: HeaderStats): void {
    this.view.updateStats(stats);
  }

  public updateFromDevices(
    devices: HeaderDevice[],
    options: { cache?: Map<string, { total_value: number }> } = {}
  ): void {
    const { cache } = options;

    let online = 0;
    devices.forEach((device) => {
      const devStatus = (device.deviceStatus || '').toLowerCase();
      const isOffline = ['offline', 'no_info'].includes(devStatus);
      const isNotInstalled = devStatus === 'not_installed';
      if (!isOffline && !isNotInstalled) {
        online++;
      }
    });

    let totalConsumption = 0;
    let zeroCount = 0;

    devices.forEach((device) => {
      let consumption = 0;

      if (cache && device.ingestionId) {
        const cached = cache.get(device.ingestionId);
        if (cached) {
          consumption = Number(cached.total_value) || 0;
        }
      }

      if (consumption === 0) {
        consumption = Number(device.val) || Number(device.value) || Number(device.lastValue) || 0;
      }

      totalConsumption += consumption;
      if (consumption === 0) zeroCount++;
    });

    this.updateStats({
      online,
      total: devices.length,
      consumption: totalConsumption,
      zeroCount,
    });
  }

  public setThemeMode(mode: HeaderDevicesThemeMode): void {
    this.view.setThemeMode(mode);
  }

  public getSearchInput(): HTMLInputElement | null {
    return this.view.getSearchInput();
  }

  public toggleSearch(active?: boolean): void {
    this.view.toggleSearch(active);
  }

  public destroy(): void {
    this.view.destroy();
  }
}
