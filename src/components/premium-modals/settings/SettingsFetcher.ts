import { SettingsFetcher, TbScope } from './types';

export class DefaultSettingsFetcher implements SettingsFetcher {
  private jwtToken: string;
  private tbBaseUrl: string;

  constructor(jwtToken: string, apiConfig?: any) {
    this.jwtToken = jwtToken;
    this.tbBaseUrl = apiConfig?.tbBaseUrl || window.location.origin;
  }

  async fetchCurrentSettings(deviceId: string, jwtToken: string, scope: TbScope = 'SERVER_SCOPE'): Promise<{
    entity?: { label?: string };
    attributes?: Record<string, unknown>;
  }> {
    try {
      const [entityResult, attributesResult] = await Promise.allSettled([
        this.fetchDeviceEntity(deviceId),
        this.fetchDeviceAttributes(deviceId, scope)
      ]);

      const result: { entity?: { label?: string }; attributes?: Record<string, unknown> } = {};

      // Handle entity result
      if (entityResult.status === 'fulfilled') {
        result.entity = entityResult.value;
      } else {
        console.warn('[SettingsFetcher] Failed to fetch device entity:', entityResult.reason);
      }

      // Handle attributes result
      if (attributesResult.status === 'fulfilled') {
        result.attributes = attributesResult.value;
      } else {
        console.warn('[SettingsFetcher] Failed to fetch device attributes:', attributesResult.reason);
      }

      return result;

    } catch (error) {
      console.error('[SettingsFetcher] Failed to fetch current settings:', error);
      // Return empty object to allow form to render with defaults
      return {};
    }
  }

  private async fetchDeviceEntity(deviceId: string): Promise<{ label?: string }> {
    const response = await fetch(`${this.tbBaseUrl}/api/device/${deviceId}`, {
      headers: { 'X-Authorization': `Bearer ${this.jwtToken}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch device entity: ${response.status} ${response.statusText}`);
    }

    const device = await response.json();
    return {
      label: device.label || device.name || ''
    };
  }

  private async fetchDeviceAttributes(deviceId: string, scope: TbScope): Promise<Record<string, unknown>> {
    const response = await fetch(
      `${this.tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/${scope}`,
      {
        headers: { 'X-Authorization': `Bearer ${this.jwtToken}` }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch device attributes: ${response.status} ${response.statusText}`);
    }

    const attributesArray = await response.json();
    
    // Convert array format to object and map API fields to form fields
    const attributes: Record<string, unknown> = {};
    const settingsNamespace = 'myio.settings.energy.';

    for (const attr of attributesArray) {
      if (attr.key && attr.value !== undefined && attr.value !== null && attr.value !== '') {
        // Handle namespaced settings
        if (attr.key.startsWith(settingsNamespace)) {
          const key = attr.key.replace(settingsNamespace, '');
          if (key !== '__version') {
            attributes[key] = attr.value;
          }
        }
        // Handle direct API fields mapping to form fields
        else if (attr.key === 'floor') {
          attributes.floor = attr.value; // floor -> Andar
        }
        else if (attr.key === 'identifier') {
          attributes.identifier = attr.value; // identifier -> Número da Loja (read-only)
        }
      }
    }

    return attributes;
  }

  /**
   * Utility method to merge fetched settings with seed data
   */
  static mergeWithSeed(
    fetchedData: { entity?: { label?: string }; attributes?: Record<string, unknown> },
    seedData?: Record<string, any>
  ): Record<string, any> {
    const merged: Record<string, any> = {};

    // Start with seed data as base
    if (seedData) {
      Object.assign(merged, seedData);
    }

    // Override with fetched entity data
    if (fetchedData.entity?.label) {
      merged.label = fetchedData.entity.label;
    }

    // Override with fetched attributes
    if (fetchedData.attributes) {
      Object.assign(merged, fetchedData.attributes);
    }

    return merged;
  }

  /**
   * Utility method to validate and sanitize fetched data
   */
  static sanitizeFetchedData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    // String fields (updated to match new form structure)
    const stringFields = ['label', 'floor', 'identifier'];
    for (const field of stringFields) {
      if (data[field] && typeof data[field] === 'string') {
        sanitized[field] = data[field].trim();
      }
    }

    // Numeric fields
    const numericFields = ['maxDailyKwh', 'maxNightKwh', 'maxBusinessKwh'];
    for (const field of numericFields) {
      if (data[field] !== undefined && data[field] !== null) {
        const num = Number(data[field]);
        if (!isNaN(num) && num >= 0) {
          sanitized[field] = num;
        }
      }
    }


    return sanitized;
  }
}
