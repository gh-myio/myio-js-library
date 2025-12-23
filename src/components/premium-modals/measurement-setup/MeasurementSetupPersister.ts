// RFC-0108: Measurement Setup Modal - Persistence Layer

import {
  MeasurementDisplaySettings,
  MeasurementSetupFormData,
  PersistResult,
  DEFAULT_SETTINGS,
} from './types';

export class MeasurementSetupPersister {
  private token: string;
  private tbBaseUrl: string;
  private static readonly ATTRIBUTE_KEY = 'measurementDisplaySettings';
  private static readonly FETCH_TIMEOUT_MS = 8000;

  constructor(token: string, tbBaseUrl?: string) {
    this.token = token;
    this.tbBaseUrl = tbBaseUrl || window.location.origin;
  }

  /**
   * Fetch with timeout to prevent hanging requests
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = MeasurementSetupPersister.FETCH_TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Load measurement settings from customer SERVER_SCOPE
   */
  async loadSettings(customerId: string): Promise<MeasurementDisplaySettings | null> {
    try {
      const url = `${this.tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=${MeasurementSetupPersister.ATTRIBUTE_KEY}`;

      console.log('[MeasurementSetupPersister] Loading settings from:', url);

      const response = await this.fetchWithTimeout(url, {
        headers: {
          'X-Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[MeasurementSetupPersister] HTTP ${response.status}: ${response.statusText}`);
        return null;
      }

      const attrs = await response.json();
      const settingsAttr = attrs.find((a: any) => a.key === MeasurementSetupPersister.ATTRIBUTE_KEY);

      if (!settingsAttr) {
        console.log('[MeasurementSetupPersister] No existing settings found, using defaults');
        return null;
      }

      const value = typeof settingsAttr.value === 'string'
        ? JSON.parse(settingsAttr.value)
        : settingsAttr.value;

      console.log('[MeasurementSetupPersister] Loaded settings:', value);
      return this.validateAndMergeSettings(value);
    } catch (error) {
      console.error('[MeasurementSetupPersister] Failed to load settings:', error);
      return null;
    }
  }

  /**
   * Save measurement settings to customer SERVER_SCOPE
   */
  async saveSettings(customerId: string, settings: MeasurementDisplaySettings): Promise<PersistResult> {
    try {
      const url = `${this.tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/attributes/SERVER_SCOPE`;

      console.log('[MeasurementSetupPersister] Saving settings to:', url);

      const payload = {
        [MeasurementSetupPersister.ATTRIBUTE_KEY]: JSON.stringify(settings),
      };

      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'X-Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MeasurementSetupPersister] Save failed:', response.status, errorText);

        return {
          ok: false,
          error: {
            code: response.status === 401 ? 'AUTH_ERROR' : 'NETWORK_ERROR',
            message: `Failed to save settings: HTTP ${response.status}`,
            cause: errorText,
          },
        };
      }

      console.log('[MeasurementSetupPersister] Settings saved successfully');
      return { ok: true, settings };
    } catch (error) {
      console.error('[MeasurementSetupPersister] Save error:', error);
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: (error as Error).message || 'Failed to save settings',
          cause: error,
        },
      };
    }
  }

  /**
   * Validate and merge settings with defaults to ensure all fields exist
   */
  validateAndMergeSettings(settings: Partial<MeasurementDisplaySettings>): MeasurementDisplaySettings {
    return {
      version: settings.version || DEFAULT_SETTINGS.version,
      updatedAt: settings.updatedAt || DEFAULT_SETTINGS.updatedAt,
      updatedBy: settings.updatedBy,
      water: {
        unit: settings.water?.unit || DEFAULT_SETTINGS.water.unit,
        decimalPlaces: settings.water?.decimalPlaces ?? DEFAULT_SETTINGS.water.decimalPlaces,
        autoScale: settings.water?.autoScale ?? DEFAULT_SETTINGS.water.autoScale,
      },
      energy: {
        unit: settings.energy?.unit || DEFAULT_SETTINGS.energy.unit,
        decimalPlaces: settings.energy?.decimalPlaces ?? DEFAULT_SETTINGS.energy.decimalPlaces,
        forceUnit: settings.energy?.forceUnit ?? DEFAULT_SETTINGS.energy.forceUnit,
      },
      temperature: {
        unit: settings.temperature?.unit || DEFAULT_SETTINGS.temperature.unit,
        decimalPlaces: settings.temperature?.decimalPlaces ?? DEFAULT_SETTINGS.temperature.decimalPlaces,
      },
    };
  }

  /**
   * Convert form data to full settings object for persistence
   */
  formDataToSettings(formData: MeasurementSetupFormData, existingSettings?: MeasurementDisplaySettings | null): MeasurementDisplaySettings {
    return {
      version: existingSettings?.version || DEFAULT_SETTINGS.version,
      updatedAt: new Date().toISOString(),
      updatedBy: existingSettings?.updatedBy,
      water: { ...formData.water },
      energy: { ...formData.energy },
      temperature: { ...formData.temperature },
    };
  }

  /**
   * Extract form data from settings
   */
  settingsToFormData(settings: MeasurementDisplaySettings | null): MeasurementSetupFormData {
    const s = settings || DEFAULT_SETTINGS;
    return {
      water: { ...s.water },
      energy: { ...s.energy },
      temperature: { ...s.temperature },
    };
  }
}
