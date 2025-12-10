// RFC-0103: Power Limits Persister - ThingsBoard API Integration

import {
  InstantaneousPowerLimits,
  PowerLimitsError,
  PowerLimitsFormData,
  StatusLimits,
  DeviceTypeLimits,
  TelemetryTypeLimits,
  DeviceStatusName,
} from './types';

export class PowerLimitsPersister {
  private jwtToken: string;
  private tbBaseUrl: string;

  constructor(jwtToken: string, tbBaseUrl?: string) {
    this.jwtToken = jwtToken;
    this.tbBaseUrl = tbBaseUrl || window.location.origin;
  }

  /**
   * Load existing mapInstantaneousPower from customer server_scope attributes
   */
  async loadCustomerPowerLimits(customerId: string): Promise<InstantaneousPowerLimits | null> {
    try {
      const url = `${this.tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=mapInstantaneousPower`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[PowerLimitsPersister] No existing mapInstantaneousPower found');
          return null;
        }
        throw this.createHttpError(response.status, await response.text().catch(() => ''));
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        console.log('[PowerLimitsPersister] No mapInstantaneousPower attribute found');
        return null;
      }

      const attr = data.find((item: any) => item.key === 'mapInstantaneousPower');
      if (!attr || !attr.value) {
        return null;
      }

      // Parse JSON if it's a string
      const parsedValue = typeof attr.value === 'string' ? JSON.parse(attr.value) : attr.value;

      console.log('[PowerLimitsPersister] Loaded mapInstantaneousPower:', parsedValue);
      return parsedValue as InstantaneousPowerLimits;

    } catch (error) {
      console.error('[PowerLimitsPersister] Error loading power limits:', error);
      throw this.mapError(error);
    }
  }

  /**
   * Save mapInstantaneousPower to customer server_scope attributes
   */
  async saveCustomerPowerLimits(
    customerId: string,
    limits: InstantaneousPowerLimits
  ): Promise<{ ok: boolean; error?: PowerLimitsError }> {
    try {
      const url = `${this.tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/attributes/SERVER_SCOPE`;

      const payload = {
        mapInstantaneousPower: limits,
      };

      console.log('[PowerLimitsPersister] Saving power limits:', payload);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw this.createHttpError(response.status, await response.text().catch(() => ''));
      }

      console.log('[PowerLimitsPersister] Successfully saved power limits');
      return { ok: true };

    } catch (error) {
      console.error('[PowerLimitsPersister] Error saving power limits:', error);
      return { ok: false, error: this.mapError(error) };
    }
  }

  /**
   * Extract form data for a specific device type and telemetry type
   */
  extractFormData(
    limits: InstantaneousPowerLimits | null,
    deviceType: string,
    telemetryType: string
  ): PowerLimitsFormData {
    const defaultFormData: PowerLimitsFormData = {
      deviceType,
      telemetryType,
      domain: 'energy', // Default to energy, will be overwritten by caller if needed
      standby: { baseValue: null, topValue: null },
      normal: { baseValue: null, topValue: null },
      alert: { baseValue: null, topValue: null },
      failure: { baseValue: null, topValue: null },
    };

    if (!limits || !limits.limitsByInstantaneoustPowerType) {
      return defaultFormData;
    }

    // Find telemetry type entry
    const telemetryEntry = limits.limitsByInstantaneoustPowerType.find(
      (t) => t.telemetryType === telemetryType
    );

    if (!telemetryEntry || !telemetryEntry.itemsByDeviceType) {
      return defaultFormData;
    }

    // Find device type entry
    const deviceEntry = telemetryEntry.itemsByDeviceType.find(
      (d) => d.deviceType === deviceType
    );

    if (!deviceEntry || !deviceEntry.limitsByDeviceStatus) {
      return defaultFormData;
    }

    // Map status limits to form data
    const statusMap: Record<string, keyof Pick<PowerLimitsFormData, 'standby' | 'normal' | 'alert' | 'failure'>> = {
      'standBy': 'standby',
      'normal': 'normal',
      'alert': 'alert',
      'failure': 'failure',
    };

    deviceEntry.limitsByDeviceStatus.forEach((status) => {
      const formKey = statusMap[status.deviceStatusName];
      if (formKey && defaultFormData[formKey]) {
        defaultFormData[formKey] = {
          baseValue: status.limitsValues.baseValue,
          topValue: status.limitsValues.topValue,
        };
      }
    });

    return defaultFormData;
  }

  /**
   * Merge form data into existing limits JSON
   * Creates new entries if they don't exist
   */
  mergeFormDataIntoLimits(
    existingLimits: InstantaneousPowerLimits | null,
    formData: PowerLimitsFormData
  ): InstantaneousPowerLimits {
    const result: InstantaneousPowerLimits = existingLimits
      ? JSON.parse(JSON.stringify(existingLimits)) // Deep clone
      : { version: '1.0.0', limitsByInstantaneoustPowerType: [] };

    // Build status limits from form data
    const statusLimits: StatusLimits[] = [
      {
        deviceStatusName: 'standBy',
        limitsValues: {
          baseValue: formData.standby.baseValue ?? 0,
          topValue: formData.standby.topValue ?? 0,
        },
      },
      {
        deviceStatusName: 'normal',
        limitsValues: {
          baseValue: formData.normal.baseValue ?? 0,
          topValue: formData.normal.topValue ?? 0,
        },
      },
      {
        deviceStatusName: 'alert',
        limitsValues: {
          baseValue: formData.alert.baseValue ?? 0,
          topValue: formData.alert.topValue ?? 0,
        },
      },
      {
        deviceStatusName: 'failure',
        limitsValues: {
          baseValue: formData.failure.baseValue ?? 0,
          topValue: formData.failure.topValue ?? 0,
        },
      },
    ];

    // Find or create telemetry type entry
    let telemetryEntry = result.limitsByInstantaneoustPowerType.find(
      (t) => t.telemetryType === formData.telemetryType
    );

    if (!telemetryEntry) {
      telemetryEntry = {
        telemetryType: formData.telemetryType,
        itemsByDeviceType: [],
      };
      result.limitsByInstantaneoustPowerType.push(telemetryEntry);
    }

    // Find or create device type entry
    let deviceEntry = telemetryEntry.itemsByDeviceType.find(
      (d) => d.deviceType === formData.deviceType
    );

    if (!deviceEntry) {
      deviceEntry = {
        deviceType: formData.deviceType,
        name: `mapInstantaneousPower${this.formatDeviceTypeName(formData.deviceType)}`,
        description: `Power limits for ${formData.deviceType}`,
        limitsByDeviceStatus: [],
      };
      telemetryEntry.itemsByDeviceType.push(deviceEntry);
    }

    // Update status limits
    deviceEntry.limitsByDeviceStatus = statusLimits;
    deviceEntry.name = `mapInstantaneousPower${this.formatDeviceTypeName(formData.deviceType)}`;
    deviceEntry.description = `Power limits for ${formData.deviceType} - ${formData.telemetryType}`;

    return result;
  }

  /**
   * Format device type name for the JSON name field
   */
  private formatDeviceTypeName(deviceType: string): string {
    if (!deviceType) return '';
    // Convert ELEVADOR -> Elevador, AR_CONDICIONADO -> ArCondicionado
    return deviceType
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  private createHttpError(status: number, body: string): Error {
    const error = new Error(`HTTP ${status}: ${body}`);
    (error as any).status = status;
    (error as any).body = body;
    return error;
  }

  private mapError(error: any): PowerLimitsError {
    const status = error.status;

    if (status === 400) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        cause: error,
      };
    }

    if (status === 401) {
      return {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
        cause: error,
      };
    }

    if (status === 403) {
      return {
        code: 'AUTH_ERROR',
        message: 'Insufficient permissions',
        cause: error,
      };
    }

    if (status === 404) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Customer not found',
        cause: error,
      };
    }

    if (status >= 500) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Server error occurred',
        cause: error,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      cause: error,
    };
  }
}
