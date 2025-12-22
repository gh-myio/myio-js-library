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

      // Energy counts
      if (counts.energy.total !== null) {
        payload[DEVICE_COUNT_KEYS.energy.total] = counts.energy.total;
      }
      if (counts.energy.entries !== null) {
        payload[DEVICE_COUNT_KEYS.energy.entries] = counts.energy.entries;
      }
      if (counts.energy.commonArea !== null) {
        payload[DEVICE_COUNT_KEYS.energy.commonArea] = counts.energy.commonArea;
      }
      if (counts.energy.stores !== null) {
        payload[DEVICE_COUNT_KEYS.energy.stores] = counts.energy.stores;
      }

      // Water counts
      if (counts.water.total !== null) {
        payload[DEVICE_COUNT_KEYS.water.total] = counts.water.total;
      }
      if (counts.water.entries !== null) {
        payload[DEVICE_COUNT_KEYS.water.entries] = counts.water.entries;
      }
      if (counts.water.commonArea !== null) {
        payload[DEVICE_COUNT_KEYS.water.commonArea] = counts.water.commonArea;
      }
      if (counts.water.stores !== null) {
        payload[DEVICE_COUNT_KEYS.water.stores] = counts.water.stores;
      }

      // Temperature counts
      if (counts.temperature.total !== null) {
        payload[DEVICE_COUNT_KEYS.temperature.total] = counts.temperature.total;
      }
      if (counts.temperature.internal !== null) {
        payload[DEVICE_COUNT_KEYS.temperature.internal] = counts.temperature.internal;
      }
      if (counts.temperature.stores !== null) {
        payload[DEVICE_COUNT_KEYS.temperature.stores] = counts.temperature.stores;
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
