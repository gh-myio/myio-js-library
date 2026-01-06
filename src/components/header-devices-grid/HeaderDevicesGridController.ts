/**
 * RFC-0125: HeaderDevicesGrid Controller
 * Business logic for stats calculation and updates
 */

import type {
  HeaderDevicesGridParams,
  HeaderDevicesGridInstance,
  HeaderDevicesThemeMode,
  HeaderDevicesDomain,
  HeaderStats,
  HeaderDevice,
} from './types.js';
import { HeaderDevicesGridView } from './HeaderDevicesGridView.js';

export class HeaderDevicesGridController implements HeaderDevicesGridInstance {
  private view: HeaderDevicesGridView;
  private domain: HeaderDevicesDomain;

  constructor(params: HeaderDevicesGridParams) {
    this.view = new HeaderDevicesGridView(params);
    this.domain = params.domain || 'energy';
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

    let totalValue = 0;
    let zeroCount = 0;
    let validValueCount = 0;

    devices.forEach((device) => {
      let value = 0;

      if (cache && device.ingestionId) {
        const cached = cache.get(device.ingestionId);
        if (cached) {
          value = Number(cached.total_value) || 0;
        }
      }

      if (value === 0) {
        // For temperature, prioritize temperature field
        if (this.domain === 'temperature') {
          value = Number((device as Record<string, unknown>).temperature) ||
                  Number(device.val) || Number(device.value) || Number(device.lastValue) || 0;
        } else {
          value = Number(device.val) || Number(device.value) || Number(device.lastValue) || 0;
        }
      }

      totalValue += value;
      if (value === 0) {
        zeroCount++;
      } else {
        validValueCount++;
      }
    });

    // For temperature domain, calculate average instead of sum
    let displayValue = totalValue;
    if (this.domain === 'temperature' && validValueCount > 0) {
      displayValue = totalValue / validValueCount;
    }

    this.updateStats({
      online,
      total: devices.length,
      consumption: displayValue,
      zeroCount,
    });
  }

  public setThemeMode(mode: HeaderDevicesThemeMode): void {
    this.view.setThemeMode(mode);
  }

  public setDomain(domain: HeaderDevicesDomain): void {
    this.domain = domain;
    this.view.setDomain(domain);
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
