import { SettingsError, SettingsPersister } from './types';

// RFC-0078: JSON Schema Types
interface InstantaneousPowerLimits {
  version: string;
  limitsByInstantaneoustPowerType: TelemetryTypeLimits[];
}

interface TelemetryTypeLimits {
  telemetryType: string;
  itemsByDeviceType: DeviceTypeLimits[];
}

interface DeviceTypeLimits {
  deviceType: string;
  name: string;
  description: string;
  limitsByDeviceStatus: StatusLimits[];
}

interface StatusLimits {
  deviceStatusName: string;
  limitsValues: {
    baseValue: number;
    topValue: number;
  };
}

export class DefaultSettingsPersister implements SettingsPersister {
  private jwtToken: string;
  private tbBaseUrl: string;
  private deviceType: string;
  private existingMapInstantaneousPower: InstantaneousPowerLimits | null;

  constructor(jwtToken: string, apiConfig?: any) {
    this.jwtToken = jwtToken;
    this.tbBaseUrl = apiConfig?.tbBaseUrl || window.location.origin;
    this.deviceType = apiConfig?.deviceType || 'ELEVADOR';
    this.existingMapInstantaneousPower = apiConfig?.mapInstantaneousPower || null;
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

      // 2. Update device with new label using POST (ThingsBoard only accepts POST)
      const postRes = await fetch(`${this.tbBaseUrl}/api/device`, {
        method: 'POST',
        headers: {
          'X-Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...device, label: this.sanitizeLabel(label) })
      });

      if (!postRes.ok) {
        throw this.createHttpError(postRes.status, await postRes.text().catch(() => ''));
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
      // RFC-0080: Build JSON structure for mapInstantaneousPower
      const mapInstantaneousPower = this.buildMapInstantaneousPower(attributes);

      // Save as single JSON attribute (RFC-0078 compliant)
      const payload = {
        mapInstantaneousPower: mapInstantaneousPower
      };

      console.log('[SettingsPersister] RFC-0080: Saving mapInstantaneousPower as JSON:', payload);

      const res = await fetch(
        `${this.tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`,
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
        updatedKeys: ['mapInstantaneousPower']
      };

    } catch (error) {
      console.error('[SettingsPersister] Attributes save failed:', error);
      return { ok: false, error: this.mapError(error) };
    }
  }

  /**
   * RFC-0080: Build mapInstantaneousPower JSON structure from form data
   * Preserves existing structure and updates only the current device type
   */
  private buildMapInstantaneousPower(formData: Record<string, unknown>): InstantaneousPowerLimits {
    // Start with existing or create new structure
    const result: InstantaneousPowerLimits = this.existingMapInstantaneousPower
      ? JSON.parse(JSON.stringify(this.existingMapInstantaneousPower)) // Deep clone
      : {
          version: '1.0.0',
          limitsByInstantaneoustPowerType: []
        };

    // Find or create telemetry type entry
    const telemetryType = String(formData.telemetryType || 'consumption');
    let telemetryConfig = result.limitsByInstantaneoustPowerType.find(
      t => t.telemetryType === telemetryType
    );

    if (!telemetryConfig) {
      telemetryConfig = {
        telemetryType,
        itemsByDeviceType: []
      };
      result.limitsByInstantaneoustPowerType.push(telemetryConfig);
    }

    // Find or create device type entry
    const deviceType = this.deviceType.toUpperCase();
    let deviceConfig = telemetryConfig.itemsByDeviceType.find(
      d => d.deviceType === deviceType
    );

    if (!deviceConfig) {
      deviceConfig = {
        deviceType,
        name: `mapInstantaneousPower${this.formatDeviceTypeName(deviceType)}`,
        description: `Limites de potência customizados para ${deviceType}`,
        limitsByDeviceStatus: []
      };
      telemetryConfig.itemsByDeviceType.push(deviceConfig);
    }

    // Update limits from form data
    deviceConfig.limitsByDeviceStatus = [
      {
        deviceStatusName: 'standBy',
        limitsValues: {
          baseValue: Number(formData.standbyLimitDownConsumption) || 0,
          topValue: Number(formData.standbyLimitUpConsumption) || 0
        }
      },
      {
        deviceStatusName: 'normal',
        limitsValues: {
          baseValue: Number(formData.normalLimitDownConsumption) || 0,
          topValue: Number(formData.normalLimitUpConsumption) || 0
        }
      },
      {
        deviceStatusName: 'alert',
        limitsValues: {
          baseValue: Number(formData.alertLimitDownConsumption) || 0,
          topValue: Number(formData.alertLimitUpConsumption) || 0
        }
      },
      {
        deviceStatusName: 'failure',
        limitsValues: {
          baseValue: Number(formData.failureLimitDownConsumption) || 0,
          topValue: Number(formData.failureLimitUpConsumption) || 0
        }
      }
    ];

    // Update description with identifier if provided
    if (formData.identifier) {
      deviceConfig.description = `Limites customizados para ${formData.identifier}`;
    }

    console.log('[SettingsPersister] RFC-0080: Built mapInstantaneousPower:', result);
    return result;
  }

  /**
   * Format device type name for display (e.g., ELEVADOR -> Elevador)
   */
  private formatDeviceTypeName(deviceType: string): string {
    const map: Record<string, string> = {
      'ELEVADOR': 'Elevator',
      'ESCADA_ROLANTE': 'Escalator',
      'MOTOR': 'Motor',
      'BOMBA': 'Pump',
      '3F_MEDIDOR': '3FMedidor',
      'CHILLER': 'Chiller',
      'FANCOIL': 'Fancoil',
      'AR_CONDICIONADO': 'AirConditioner',
      'HVAC': 'HVAC',
      'HIDROMETRO': 'Hidrometro',
      'TERMOSTATO': 'Termostato'
    };
    return map[deviceType] || deviceType;
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
