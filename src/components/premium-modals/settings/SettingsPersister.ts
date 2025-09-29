import { SettingsError, SettingsPersister } from './types';

export class DefaultSettingsPersister implements SettingsPersister {
  private jwtToken: string;
  private tbBaseUrl: string;

  constructor(jwtToken: string, apiConfig?: any) {
    this.jwtToken = jwtToken;
    this.tbBaseUrl = apiConfig?.tbBaseUrl || window.location.origin;
  }

  async saveEntityLabel(deviceId: string, label: string): Promise<{ ok: boolean; error?: SettingsError }> {
    try {
      // 1. Get current device entity
      const getRes = await fetch(`${this.tbBaseUrl}/api/device/${deviceId}`, {
        headers: { 'X-Authorization': `Bearer ${this.jwtToken}` }
      });

      if (!getRes.ok) {
        throw this.createHttpError(getRes.status, await getRes.text().catch(() => ''));
      }

      const device = await getRes.json();

      // 2. Update device with new label
      const putRes = await fetch(`${this.tbBaseUrl}/api/device`, {
        method: 'PUT',
        headers: {
          'X-Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...device, label: this.sanitizeLabel(label) })
      });

      if (!putRes.ok) {
        throw this.createHttpError(putRes.status, await putRes.text().catch(() => ''));
      }

      return { ok: true };

    } catch (error) {
      console.error('[SettingsPersister] Entity label save failed:', error);
      return { ok: false, error: this.mapError(error) };
    }
  }

  async saveServerScopeAttributes(
    deviceId: string, 
    attributes: Record<string, unknown>
  ): Promise<{ ok: boolean; updatedKeys?: string[]; error?: SettingsError }> {
    try {
      // Add namespace and version to attributes
      const namespacedAttrs = this.addNamespaceAndVersion(attributes);

      const res = await fetch(
        `${this.tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`,
        {
          method: 'POST',
          headers: {
            'X-Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(namespacedAttrs)
        }
      );

      if (!res.ok) {
        throw this.createHttpError(res.status, await res.text().catch(() => ''));
      }

      return { 
        ok: true, 
        updatedKeys: Object.keys(namespacedAttrs) 
      };

    } catch (error) {
      console.error('[SettingsPersister] Attributes save failed:', error);
      return { ok: false, error: this.mapError(error) };
    }
  }

  private addNamespaceAndVersion(attributes: Record<string, unknown>): Record<string, unknown> {
    const namespaced: Record<string, unknown> = {
      'myio.settings.energy.__version': 1
    };

    for (const [key, value] of Object.entries(attributes)) {
      if (key !== 'label') { // Label goes to entity, not attributes
        namespaced[`myio.settings.energy.${key}`] = value;
      }
    }

    return namespaced;
  }

  private sanitizeLabel(label: string): string {
    return label
      .trim()
      .slice(0, 255) // Max length
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
  }

  private createHttpError(status: number, body: string): Error {
    const error = new Error(`HTTP ${status}: ${body}`);
    (error as any).status = status;
    (error as any).body = body;
    return error;
  }

  private mapError(error: any): SettingsError {
    const status = error.status;

    if (status === 400) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        userAction: 'FIX_INPUT',
        cause: error
      };
    }

    if (status === 401) {
      return {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
        userAction: 'RE_AUTH',
        cause: error
      };
    }

    if (status === 403) {
      return {
        code: 'AUTH_ERROR',
        message: 'Insufficient permissions',
        userAction: 'RE_AUTH',
        cause: error
      };
    }

    if (status === 404) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Device not found',
        userAction: 'CONTACT_ADMIN',
        cause: error
      };
    }

    if (status === 409) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Concurrent modification detected',
        userAction: 'RETRY',
        cause: error
      };
    }

    if (status >= 500) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Server error occurred',
        userAction: 'RETRY',
        cause: error
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      userAction: 'CONTACT_ADMIN',
      cause: error
    };
  }
}
