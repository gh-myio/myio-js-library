/**
 * RFC-0107: Contract Devices Persister
 * Saves device count attributes to CUSTOMER SERVER_SCOPE
 */

import {
  ContractDevicesPersister,
  ContractDeviceCounts,
  ContractDevicesPersistResult,
  ContractDevicesError,
  DEVICE_COUNT_KEYS
} from './types';

export class DefaultContractDevicesPersister implements ContractDevicesPersister {
  private jwtToken: string;
  private tbBaseUrl: string;

  constructor(jwtToken: string, apiConfig?: { tbBaseUrl?: string }) {
    this.jwtToken = jwtToken;
    this.tbBaseUrl = apiConfig?.tbBaseUrl || window.location.origin;
  }

  async saveDeviceCounts(
    customerId: string,
    counts: ContractDeviceCounts
  ): Promise<ContractDevicesPersistResult> {
    try {
      // Build flat attributes from nested structure
      const payload: Record<string, number> = {};

      // Energy contracted counts
      if (counts.energy.contracted.total !== null) {
        payload[DEVICE_COUNT_KEYS.energy.contracted.total] = counts.energy.contracted.total;
      }
      if (counts.energy.contracted.entries !== null) {
        payload[DEVICE_COUNT_KEYS.energy.contracted.entries] = counts.energy.contracted.entries;
      }
      if (counts.energy.contracted.commonArea !== null) {
        payload[DEVICE_COUNT_KEYS.energy.contracted.commonArea] = counts.energy.contracted.commonArea;
      }
      if (counts.energy.contracted.stores !== null) {
        payload[DEVICE_COUNT_KEYS.energy.contracted.stores] = counts.energy.contracted.stores;
      }

      // Energy installed counts
      if (counts.energy.installed.total !== null) {
        payload[DEVICE_COUNT_KEYS.energy.installed.total] = counts.energy.installed.total;
      }
      if (counts.energy.installed.entries !== null) {
        payload[DEVICE_COUNT_KEYS.energy.installed.entries] = counts.energy.installed.entries;
      }
      if (counts.energy.installed.commonArea !== null) {
        payload[DEVICE_COUNT_KEYS.energy.installed.commonArea] = counts.energy.installed.commonArea;
      }
      if (counts.energy.installed.stores !== null) {
        payload[DEVICE_COUNT_KEYS.energy.installed.stores] = counts.energy.installed.stores;
      }

      // Water contracted counts
      if (counts.water.contracted.total !== null) {
        payload[DEVICE_COUNT_KEYS.water.contracted.total] = counts.water.contracted.total;
      }
      if (counts.water.contracted.entries !== null) {
        payload[DEVICE_COUNT_KEYS.water.contracted.entries] = counts.water.contracted.entries;
      }
      if (counts.water.contracted.commonArea !== null) {
        payload[DEVICE_COUNT_KEYS.water.contracted.commonArea] = counts.water.contracted.commonArea;
      }
      if (counts.water.contracted.stores !== null) {
        payload[DEVICE_COUNT_KEYS.water.contracted.stores] = counts.water.contracted.stores;
      }

      // Water installed counts
      if (counts.water.installed.total !== null) {
        payload[DEVICE_COUNT_KEYS.water.installed.total] = counts.water.installed.total;
      }
      if (counts.water.installed.entries !== null) {
        payload[DEVICE_COUNT_KEYS.water.installed.entries] = counts.water.installed.entries;
      }
      if (counts.water.installed.commonArea !== null) {
        payload[DEVICE_COUNT_KEYS.water.installed.commonArea] = counts.water.installed.commonArea;
      }
      if (counts.water.installed.stores !== null) {
        payload[DEVICE_COUNT_KEYS.water.installed.stores] = counts.water.installed.stores;
      }

      // Temperature contracted counts
      if (counts.temperature.contracted.total !== null) {
        payload[DEVICE_COUNT_KEYS.temperature.contracted.total] = counts.temperature.contracted.total;
      }
      if (counts.temperature.contracted.internal !== null) {
        payload[DEVICE_COUNT_KEYS.temperature.contracted.internal] = counts.temperature.contracted.internal;
      }
      if (counts.temperature.contracted.stores !== null) {
        payload[DEVICE_COUNT_KEYS.temperature.contracted.stores] = counts.temperature.contracted.stores;
      }

      // Temperature installed counts
      if (counts.temperature.installed.total !== null) {
        payload[DEVICE_COUNT_KEYS.temperature.installed.total] = counts.temperature.installed.total;
      }
      if (counts.temperature.installed.internal !== null) {
        payload[DEVICE_COUNT_KEYS.temperature.installed.internal] = counts.temperature.installed.internal;
      }
      if (counts.temperature.installed.stores !== null) {
        payload[DEVICE_COUNT_KEYS.temperature.installed.stores] = counts.temperature.installed.stores;
      }

      console.log('[ContractDevicesPersister] Saving to CUSTOMER SERVER_SCOPE:', payload);

      const res = await fetch(
        `${this.tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/attributes/SERVER_SCOPE`,
        {
          method: 'POST',
          headers: {
            'X-Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        throw this.createHttpError(res.status, await res.text().catch(() => ''));
      }

      return {
        ok: true,
        updatedKeys: Object.keys(payload),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ContractDevicesPersister] Save failed:', error);
      return {
        ok: false,
        error: this.mapError(error)
      };
    }
  }

  private createHttpError(status: number, body: string): Error {
    const error = new Error(`HTTP ${status}: ${body}`);
    (error as any).status = status;
    (error as any).body = body;
    return error;
  }

  private mapError(error: any): ContractDevicesError {
    const status = error.status;

    if (status === 400) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Dados invalidos',
        userAction: 'FIX_INPUT',
        cause: error
      };
    }

    if (status === 401) {
      return {
        code: 'TOKEN_EXPIRED',
        message: 'Token de autenticacao expirado',
        userAction: 'RE_AUTH',
        cause: error
      };
    }

    if (status === 403) {
      return {
        code: 'AUTH_ERROR',
        message: 'Permissao insuficiente',
        userAction: 'RE_AUTH',
        cause: error
      };
    }

    if (status === 404) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Cliente nao encontrado',
        userAction: 'CONTACT_ADMIN',
        cause: error
      };
    }

    if (status >= 500) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Erro no servidor',
        userAction: 'RETRY',
        cause: error
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Erro desconhecido',
      userAction: 'CONTACT_ADMIN',
      cause: error
    };
  }
}
