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
      // Build keys array
      const keys = [
        DEVICE_COUNT_KEYS.energy.total,
        DEVICE_COUNT_KEYS.energy.entries,
        DEVICE_COUNT_KEYS.energy.commonArea,
        DEVICE_COUNT_KEYS.energy.stores,
        DEVICE_COUNT_KEYS.water.total,
        DEVICE_COUNT_KEYS.water.entries,
        DEVICE_COUNT_KEYS.water.commonArea,
        DEVICE_COUNT_KEYS.water.stores,
        DEVICE_COUNT_KEYS.temperature.total,
        DEVICE_COUNT_KEYS.temperature.internal,
        DEVICE_COUNT_KEYS.temperature.stores
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
        total: getValue(DEVICE_COUNT_KEYS.energy.total),
        entries: getValue(DEVICE_COUNT_KEYS.energy.entries),
        commonArea: getValue(DEVICE_COUNT_KEYS.energy.commonArea),
        stores: getValue(DEVICE_COUNT_KEYS.energy.stores)
      },
      water: {
        total: getValue(DEVICE_COUNT_KEYS.water.total),
        entries: getValue(DEVICE_COUNT_KEYS.water.entries),
        commonArea: getValue(DEVICE_COUNT_KEYS.water.commonArea),
        stores: getValue(DEVICE_COUNT_KEYS.water.stores)
      },
      temperature: {
        total: getValue(DEVICE_COUNT_KEYS.temperature.total),
        internal: getValue(DEVICE_COUNT_KEYS.temperature.internal),
        stores: getValue(DEVICE_COUNT_KEYS.temperature.stores)
      }
    };
  }
}
