/**
 * RFC-0107: Contract Devices Fetcher
 * Fetches device count attributes from CUSTOMER SERVER_SCOPE
 */

import { ContractDevicesFetcher, ContractDeviceCounts, DEVICE_COUNT_KEYS } from './types';

export class DefaultContractDevicesFetcher implements ContractDevicesFetcher {
  private jwtToken: string;
  private tbBaseUrl: string;

  constructor(jwtToken: string, apiConfig?: { tbBaseUrl?: string }) {
    this.jwtToken = jwtToken;
    this.tbBaseUrl = apiConfig?.tbBaseUrl || window.location.origin;
  }

  async fetchCurrentCounts(customerId: string): Promise<Partial<ContractDeviceCounts>> {
    try {
      // Build keys array for both contracted and installed
      const keys = [
        // Energy contracted
        DEVICE_COUNT_KEYS.energy.contracted.total,
        DEVICE_COUNT_KEYS.energy.contracted.entries,
        DEVICE_COUNT_KEYS.energy.contracted.commonArea,
        DEVICE_COUNT_KEYS.energy.contracted.stores,
        // Energy installed
        DEVICE_COUNT_KEYS.energy.installed.total,
        DEVICE_COUNT_KEYS.energy.installed.entries,
        DEVICE_COUNT_KEYS.energy.installed.commonArea,
        DEVICE_COUNT_KEYS.energy.installed.stores,
        // Water contracted
        DEVICE_COUNT_KEYS.water.contracted.total,
        DEVICE_COUNT_KEYS.water.contracted.entries,
        DEVICE_COUNT_KEYS.water.contracted.commonArea,
        DEVICE_COUNT_KEYS.water.contracted.stores,
        // Water installed
        DEVICE_COUNT_KEYS.water.installed.total,
        DEVICE_COUNT_KEYS.water.installed.entries,
        DEVICE_COUNT_KEYS.water.installed.commonArea,
        DEVICE_COUNT_KEYS.water.installed.stores,
        // Temperature contracted
        DEVICE_COUNT_KEYS.temperature.contracted.total,
        DEVICE_COUNT_KEYS.temperature.contracted.internal,
        DEVICE_COUNT_KEYS.temperature.contracted.stores,
        // Temperature installed
        DEVICE_COUNT_KEYS.temperature.installed.total,
        DEVICE_COUNT_KEYS.temperature.installed.internal,
        DEVICE_COUNT_KEYS.temperature.installed.stores
      ];

      const url = `${this.tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=${keys.join(',')}`;

      console.log('[ContractDevicesFetcher] Fetching from:', url);

      const res = await fetch(url, {
        headers: {
          'X-Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        console.warn('[ContractDevicesFetcher] Fetch failed:', res.status);
        return {};
      }

      const data = await res.json();
      console.log('[ContractDevicesFetcher] Received data:', data);

      // Parse response array to counts object
      return this.parseAttributesToCounts(data);

    } catch (error) {
      console.error('[ContractDevicesFetcher] Error fetching counts:', error);
      return {};
    }
  }

  private parseAttributesToCounts(attributes: Array<{ key: string; value: any }>): Partial<ContractDeviceCounts> {
    const getValue = (key: string): number | null => {
      const attr = attributes.find(a => a.key === key);
      if (!attr) return null;
      const num = parseInt(attr.value, 10);
      return isNaN(num) ? null : num;
    };

    return {
      energy: {
        contracted: {
          total: getValue(DEVICE_COUNT_KEYS.energy.contracted.total),
          entries: getValue(DEVICE_COUNT_KEYS.energy.contracted.entries),
          commonArea: getValue(DEVICE_COUNT_KEYS.energy.contracted.commonArea),
          stores: getValue(DEVICE_COUNT_KEYS.energy.contracted.stores)
        },
        installed: {
          total: getValue(DEVICE_COUNT_KEYS.energy.installed.total),
          entries: getValue(DEVICE_COUNT_KEYS.energy.installed.entries),
          commonArea: getValue(DEVICE_COUNT_KEYS.energy.installed.commonArea),
          stores: getValue(DEVICE_COUNT_KEYS.energy.installed.stores)
        }
      },
      water: {
        contracted: {
          total: getValue(DEVICE_COUNT_KEYS.water.contracted.total),
          entries: getValue(DEVICE_COUNT_KEYS.water.contracted.entries),
          commonArea: getValue(DEVICE_COUNT_KEYS.water.contracted.commonArea),
          stores: getValue(DEVICE_COUNT_KEYS.water.contracted.stores)
        },
        installed: {
          total: getValue(DEVICE_COUNT_KEYS.water.installed.total),
          entries: getValue(DEVICE_COUNT_KEYS.water.installed.entries),
          commonArea: getValue(DEVICE_COUNT_KEYS.water.installed.commonArea),
          stores: getValue(DEVICE_COUNT_KEYS.water.installed.stores)
        }
      },
      temperature: {
        contracted: {
          total: getValue(DEVICE_COUNT_KEYS.temperature.contracted.total),
          internal: getValue(DEVICE_COUNT_KEYS.temperature.contracted.internal),
          stores: getValue(DEVICE_COUNT_KEYS.temperature.contracted.stores)
        },
        installed: {
          total: getValue(DEVICE_COUNT_KEYS.temperature.installed.total),
          internal: getValue(DEVICE_COUNT_KEYS.temperature.installed.internal),
          stores: getValue(DEVICE_COUNT_KEYS.temperature.installed.stores)
        }
      }
    };
  }
}
