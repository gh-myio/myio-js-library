// RFC-0103: Power Limits Setup Modal - Main Entry Point

import {
  PowerLimitsModalParams,
  PowerLimitsModalInstance,
  PowerLimitsFormData,
  InstantaneousPowerLimits,
  Domain,
} from './types';
import { PowerLimitsModalView } from './PowerLimitsModalView';
import { PowerLimitsPersister } from './PowerLimitsPersister';

/**
 * Opens a modal for configuring power limits stored in customer server_scope attributes.
 *
 * @example
 * ```typescript
 * const modal = await openPowerLimitsSetupModal({
 *   token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   customerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 *   tbBaseUrl: 'https://tb.myio-bas.com',
 *   deviceType: 'ELEVADOR',
 *   telemetryType: 'consumption',
 *   domain: 'energy', // 'energy' | 'water' | 'temperature'
 *   onSave: (json) => console.log('Saved:', json),
 *   onClose: () => console.log('Modal closed')
 * });
 *
 * // Clean up when needed
 * modal.destroy();
 * ```
 */
export async function openPowerLimitsSetupModal(
  params: PowerLimitsModalParams
): Promise<PowerLimitsModalInstance> {
  // Validate required parameters
  if (!params.token) {
    throw new Error('[PowerLimitsSetupModal] token is required');
  }
  if (!params.customerId) {
    throw new Error('[PowerLimitsSetupModal] customerId is required');
  }

  // Initialize persister
  const persister = new PowerLimitsPersister(params.token, params.tbBaseUrl);

  // Track current state
  let currentDeviceType = params.deviceType || 'ELEVADOR';
  let currentTelemetryType = params.telemetryType || 'consumption';
  let currentDomain: Domain = params.domain || 'energy';
  let existingLimits: InstantaneousPowerLimits | null = params.existingMapPower || null;

  // Create view
  const view = new PowerLimitsModalView({
    deviceType: currentDeviceType,
    telemetryType: currentTelemetryType,
    domain: currentDomain,
    styles: params.styles,
    locale: params.locale,
    onDeviceTypeChange: async (deviceType: string) => {
      currentDeviceType = deviceType;
      await loadFormData();
    },
    onTelemetryTypeChange: async (telemetryType: string) => {
      currentTelemetryType = telemetryType;
      await loadFormData();
    },
    onDomainChange: (domain: Domain) => {
      currentDomain = domain;
      // Domain change doesn't require reloading data, just updates icons
    },
    onSave: async () => {
      const formData = view.getFormData();
      const updatedLimits = persister.mergeFormDataIntoLimits(existingLimits, formData);

      const result = await persister.saveCustomerPowerLimits(params.customerId, updatedLimits);

      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to save configuration');
      }

      // Update local cache
      existingLimits = updatedLimits;

      // Call onSave callback
      if (params.onSave) {
        params.onSave(updatedLimits);
      }
    },
    onClose: () => {
      if (params.onClose) {
        params.onClose();
      }
    },
  });

  // Load form data from existing limits or API
  async function loadFormData(): Promise<void> {
    view.showLoading();

    try {
      // Load from API if not provided
      if (!existingLimits) {
        existingLimits = await persister.loadCustomerPowerLimits(params.customerId);
      }

      // Extract form data for current device/telemetry type
      const formData = persister.extractFormData(existingLimits, currentDeviceType, currentTelemetryType);
      formData.domain = currentDomain;
      view.setFormData(formData);
    } catch (error) {
      console.error('[PowerLimitsSetupModal] Error loading form data:', error);
      view.showError((error as Error).message || 'Failed to load configuration');
    } finally {
      view.hideLoading();
    }
  }

  // Resolve container
  let container: HTMLElement | undefined;
  if (params.container) {
    if (typeof params.container === 'string') {
      container = document.querySelector(params.container) as HTMLElement;
    } else {
      container = params.container;
    }
  }

  // Render modal
  view.render(container);

  // Load initial data
  await loadFormData();

  // Return instance
  return {
    destroy: () => view.destroy(),
    getFormData: () => view.getFormData(),
    setFormData: (data: Partial<PowerLimitsFormData>) => view.setFormData(data),
  };
}

// Also export as default
export default openPowerLimitsSetupModal;
