import { OpenDashboardPopupSettingsParams, PersistResult, SettingsEvent } from './types';
import { SettingsModalView } from './SettingsModalView';
import { DefaultSettingsPersister } from './SettingsPersister';
import { DefaultSettingsFetcher } from './SettingsFetcher';

export class SettingsController {
  private view: SettingsModalView;
  private persister: DefaultSettingsPersister;
  private fetcher: DefaultSettingsFetcher;
  private params: OpenDashboardPopupSettingsParams;

  constructor(params: OpenDashboardPopupSettingsParams) {
    this.params = params;
    this.validateParams();

    // Initialize dependencies with injection support
    // RFC-0086: Pass deviceType, deviceProfile, and mapInstantaneousPower to persister for JSON structure
    const apiConfigWithDeviceInfo = {
      ...params.api,
      deviceType: params.deviceType,
      deviceProfile: params.deviceProfile, // RFC-0086: For 3F_MEDIDOR → deviceProfile resolution
      mapInstantaneousPower: params.mapInstantaneousPower,
    };
    this.persister =
      (params.persister as DefaultSettingsPersister) ||
      new DefaultSettingsPersister(params.jwtToken, apiConfigWithDeviceInfo);
    this.fetcher =
      (params.fetcher as DefaultSettingsFetcher) || new DefaultSettingsFetcher(params.jwtToken, params.api);

    // Initialize view
    this.view = new SettingsModalView({
      title: params.ui?.title || `Settings - ${params.label || params.deviceId}`,
      width: params.ui?.width || 1300,
      theme: 'light', // Default theme
      closeOnBackdrop: params.ui?.closeOnBackdrop !== false,
      domain: params.domain || 'energy',
      deviceType: params.deviceType, // Pass deviceType for conditional rendering
      deviceProfile: params.deviceProfile, // RFC-0076: Pass deviceProfile for 3F_MEDIDOR fallback
      customerName: params.customerName, // RFC-0077: Pass customer/shopping name for display
      customerId: params.customerId, // RFC-0080: Pass customerId for fetching GLOBAL mapInstantaneousPower
      deviceId: params.deviceId, // RFC-0077: Pass deviceId for Power Limits feature
      jwtToken: params.jwtToken, // RFC-0077: Pass jwtToken for API calls
      themeTokens: params.ui?.themeTokens,
      i18n: params.ui?.i18n,
      deviceLabel: params.label, // Pass the device label for dynamic section titles
      connectionData: params.connectionData, // Pass connection info for display
      onSave: this.handleSave.bind(this),
      onClose: this.handleClose.bind(this),
      mapInstantaneousPower: params.mapInstantaneousPower, // RFC-0077: Pass instantaneous power map for Power Limits feature,
      deviceMapInstaneousPower: params.deviceMapInstaneousPower,
      // RFC-0171: Pass superadmin and userEmail for field editing permissions
      // Fallback to window.MyIOUtils.currentUserEmail if not provided (set by MAIN controller)
      superadmin: params.superadmin,
      userEmail: params.userEmail || (window as any).MyIOUtils?.currentUserEmail || null,
      // RFC-0144: Pass enableAnnotationsOnboarding flag for onboarding control
      enableAnnotationsOnboarding: params.enableAnnotationsOnboarding ?? false,
      // RFC-0180: Raw device name + GCDR identifiers for Alarms tab
      deviceName: params.deviceName,
      gcdrDeviceId: params.gcdrDeviceId,
      gcdrCustomerId: params.gcdrCustomerId,
      gcdrTenantId: params.gcdrTenantId,
      gcdrApiBaseUrl: params.gcdrApiBaseUrl,
      prefetchedBundle: params.prefetchedBundle,
    });
  }

  async show(): Promise<void> {
    console.info('[SettingsModal] Opening modal', {
      deviceId: this.params.deviceId,
      deviceType: this.params.deviceType,
      deviceProfile: this.params.deviceProfile,
    });

    this.emitEvent('modal_opened');

    // RFC-0080: Fetch GLOBAL mapInstantaneousPower from CUSTOMER if not provided
    if (!this.params.mapInstantaneousPower && this.params.customerId) {
      try {
        const globalMap = await this.fetchGlobalMapInstantaneousPower();
        if (globalMap) {
          this.params.mapInstantaneousPower = globalMap;
          console.log('[SettingsModal] RFC-0080: Loaded GLOBAL mapInstantaneousPower from CUSTOMER');

          // RFC-0086: Update persister with GLOBAL mapInstantaneousPower and deviceProfile
          this.persister = new DefaultSettingsPersister(this.params.jwtToken, {
            ...this.params.api,
            deviceType: this.params.deviceType,
            deviceProfile: this.params.deviceProfile, // RFC-0086: For 3F_MEDIDOR → deviceProfile resolution
            mapInstantaneousPower: globalMap,
          });

          // RFC-0080: Update view config with GLOBAL mapInstantaneousPower
          this.view.updateMapInstantaneousPower(globalMap);
        }
      } catch (error) {
        console.warn('[SettingsModal] RFC-0080: Failed to fetch GLOBAL mapInstantaneousPower:', error);
      }
    }

    // Load current settings if no seed provided
    let initialData = this.params.seed || {};
    if (!this.params.seed) {
      try {
        const fetchedData = await this.fetcher.fetchCurrentSettings(
          this.params.deviceId,
          this.params.jwtToken,
          this.params.scope || 'SERVER_SCOPE'
        );

        // Merge fetched data with any seed data
        initialData = DefaultSettingsFetcher.mergeWithSeed(fetchedData, this.params.seed);

        // Sanitize the data
        initialData = DefaultSettingsFetcher.sanitizeFetchedData(initialData);
      } catch (error) {
        console.warn('[SettingsModal] Failed to fetch current settings:', error);
        // Continue with empty form or seed data
        if (this.params.onError) {
          this.params.onError({
            code: 'NETWORK_ERROR',
            message: 'Failed to load current settings',
            cause: error,
          });
        }
      }
    }

    this.view.render(initialData);
  }

  /**
   * RFC-0080: Fetch GLOBAL mapInstantaneousPower from CUSTOMER SERVER_SCOPE
   */
  private async fetchGlobalMapInstantaneousPower(): Promise<object | null> {
    const customerId = this.params.customerId;
    const jwtToken = this.params.jwtToken;

    if (!customerId || !jwtToken) {
      console.warn('[SettingsModal] RFC-0080: Cannot fetch GLOBAL - missing customerId or token');
      return null;
    }

    try {
      const tbBaseUrl = this.params.api?.tbBaseUrl || window.location.origin;
      const url = `${tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=mapInstantaneousPower`;

      console.log('[SettingsModal] RFC-0080: Fetching GLOBAL from:', url);

      // Use AbortController for timeout (8s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        headers: {
          'X-Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const attrs = await response.json();
      const powerLimitsAttr = attrs.find((a: any) => a.key === 'mapInstantaneousPower');

      if (!powerLimitsAttr) {
        console.log('[SettingsModal] RFC-0080: No GLOBAL mapInstantaneousPower found on CUSTOMER');
        return null;
      }

      const value =
        typeof powerLimitsAttr.value === 'string' ? JSON.parse(powerLimitsAttr.value) : powerLimitsAttr.value;

      console.log('[SettingsModal] RFC-0080: Loaded GLOBAL mapInstantaneousPower:', value);
      return value;
    } catch (error) {
      console.error('[SettingsModal] RFC-0080: Failed to fetch GLOBAL mapInstantaneousPower:', error);
      return null;
    }
  }

  private validateParams(): void {
    if (!this.params.jwtToken) {
      throw new Error('jwtToken is required for settings persistence');
    }

    if (!this.params.deviceId) {
      throw new Error('deviceId is required');
    }
  }

  private async handleSave(formData: Record<string, any>): Promise<void> {
    console.info('[SettingsModal] Save initiated', { deviceId: this.params.deviceId, formData });

    this.emitEvent('save_started', { formData });
    this.view.showLoadingState(true);

    try {
      const result = await this.saveSettings(formData);

      if (result.ok) {
        console.info('[SettingsModal] Settings saved successfully', result);
        this.emitEvent('save_completed', { result });

        if (this.params.onSaved) {
          this.params.onSaved(result);
        }

        // Close modal on successful save
        setTimeout(() => {
          this.view.close();
        }, 500); // Brief delay to show success state
      } else {
        console.error('[SettingsModal] Save failed:', result);
        this.emitEvent('save_failed', { result });

        const errorMessage = this.getErrorMessage(result);
        this.view.showError(errorMessage);

        if (this.params.onError) {
          this.params.onError({
            code: 'VALIDATION_ERROR',
            message: errorMessage,
            cause: result,
          });
        }
      }
    } catch (error) {
      console.error('[SettingsModal] Save error:', error);
      this.emitEvent('save_failed', { error: error.message });

      const errorMessage = 'Network error occurred while saving settings';
      this.view.showError(errorMessage);

      if (this.params.onError) {
        this.params.onError({
          code: 'NETWORK_ERROR',
          message: errorMessage,
          cause: error,
        });
      }
    } finally {
      this.view.showLoadingState(false);
    }
  }

  private async saveSettings(formData: Record<string, any>): Promise<PersistResult> {
    const result: PersistResult = {
      ok: true,
      timestamp: new Date().toISOString(),
    };

    // 1. Update device label if provided
    if (formData.label) {
      try {
        const labelResult = await this.persister.saveEntityLabel(this.params.deviceId, formData.label);

        result.entity = {
          ok: labelResult.ok,
          updated: labelResult.ok ? ['label'] : undefined,
          error: labelResult.error
            ? {
                code: labelResult.error.code,
                message: labelResult.error.message,
                cause: labelResult.error.cause,
              }
            : undefined,
        };

        if (!labelResult.ok) {
          result.ok = false;
        }
      } catch (error) {
        result.entity = {
          ok: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message: error.message || 'Failed to save device label',
            cause: error,
          },
        };
        result.ok = false;
      }
    }

    // 2. Update SERVER_SCOPE attributes (all fields except label)
    const attributes = this.extractAttributes(formData);
    if (Object.keys(attributes).length > 0) {
      try {
        const attributesResult = await this.persister.saveServerScopeAttributes(
          this.params.deviceId,
          attributes
        );

        result.serverScope = {
          ok: attributesResult.ok,
          updatedKeys: attributesResult.updatedKeys,
          error: attributesResult.error
            ? {
                code: attributesResult.error.code,
                message: attributesResult.error.message,
                cause: attributesResult.error.cause,
              }
            : undefined,
        };

        if (!attributesResult.ok) {
          result.ok = false;
        }
      } catch (error) {
        result.serverScope = {
          ok: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message: error.message || 'Failed to save device attributes',
            cause: error,
          },
        };
        result.ok = false;
      }
    }

    return result;
  }

  private extractAttributes(formData: Record<string, any>): Record<string, unknown> {
    const attributes: Record<string, unknown> = {};

    // All fields except label go to attributes
    for (const [key, value] of Object.entries(formData)) {
      if (key !== 'label' && value !== undefined && value !== null && value !== '') {
        attributes[key] = value;
      }
    }

    return attributes;
  }

  private getErrorMessage(result: PersistResult): string {
    const errors: string[] = [];

    if (result.entity?.error) {
      errors.push(`Device label: ${result.entity.error.message}`);
    }

    if (result.serverScope?.error) {
      errors.push(`Settings: ${result.serverScope.error.message}`);
    }

    return errors.length > 0 ? errors.join('; ') : 'Failed to save settings';
  }

  private handleClose(): void {
    console.info('[SettingsModal] Modal closed');
    this.emitEvent('modal_closed');

    // Actually close the modal view
    this.view.close();

    if (this.params.onClose) {
      this.params.onClose();
    }
  }

  private emitEvent(type: SettingsEvent['type'], data?: Record<string, unknown>): void {
    if (this.params.onEvent) {
      const event: SettingsEvent = {
        type,
        deviceId: this.params.deviceId,
        timestamp: new Date().toISOString(),
        data,
      };

      try {
        this.params.onEvent(event);
      } catch (error) {
        console.warn('[SettingsModal] Event handler error:', error);
      }
    }
  }

  /**
   * Utility method to validate form data before save
   */
  private validateFormData(formData: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // GUID validation
    if (formData.guid) {
      const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!guidPattern.test(formData.guid)) {
        errors.push('GUID must be in valid UUID format');
      }
    }

    // Numeric validation
    const numericFields = [
      'maxDailyKwh',
      'maxNightKwh',
      'maxBusinessKwh',
      'minTemperature',
      'maxTemperature',
      'offSetTemperature',
      'minWaterLevel',
      'maxWaterLevel',
    ];
    for (const field of numericFields) {
      if (formData[field] !== undefined) {
        const num = Number(formData[field]);
        // Temperature fields can be negative, consumption fields must be >= 0
        if (isNaN(num) || (field.includes('Kwh') && num < 0)) {
          errors.push(`${field} must be a valid number`);
        }
        // Water level fields must be between 0 and 100
        if (field.includes('WaterLevel')) {
          if (num < 0 || num > 100) {
            errors.push(`${field} must be between 0 and 100`);
          }
        }
        // offSetTemperature must be between -99.99 and +99.99
        if (field === 'offSetTemperature') {
          if (num < -99.99 || num > 99.99) {
            errors.push(`${field} must be between -99.99 and +99.99`);
          }
        }
      }
    }

    // Temperature range validation
    if (formData.minTemperature !== undefined && formData.maxTemperature !== undefined) {
      const minTemp = Number(formData.minTemperature);
      const maxTemp = Number(formData.maxTemperature);
      if (!isNaN(minTemp) && !isNaN(maxTemp) && minTemp >= maxTemp) {
        errors.push('Minimum temperature must be less than maximum temperature');
      }
    }

    // Water level range validation
    if (formData.minWaterLevel !== undefined && formData.maxWaterLevel !== undefined) {
      const minLevel = Number(formData.minWaterLevel);
      const maxLevel = Number(formData.maxWaterLevel);
      if (!isNaN(minLevel) && !isNaN(maxLevel) && minLevel >= maxLevel) {
        errors.push('Minimum water level must be less than maximum water level');
      }
    }

    // String length validation
    if (formData.label && formData.label.length > 255) {
      errors.push('Device label must be 255 characters or less');
    }

    if (formData.floor && formData.floor.length > 50) {
      errors.push('Floor must be 50 characters or less');
    }

    if (formData.storeNumber && formData.storeNumber.length > 20) {
      errors.push('Store number must be 20 characters or less');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Public method to programmatically close the modal
   */
  public closeModal(): void {
    this.view.close();
  }

  /**
   * Public method to get current form data
   */
  public getCurrentFormData(): Record<string, any> {
    return this.view.getFormData();
  }
}
