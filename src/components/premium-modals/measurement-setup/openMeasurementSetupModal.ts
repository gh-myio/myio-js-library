// RFC-0108: Measurement Setup Modal - Main Entry Point

import {
  MeasurementSetupModalParams,
  MeasurementSetupModalInstance,
  MeasurementSetupFormData,
  MeasurementDisplaySettings,
} from './types';
import { MeasurementSetupView } from './MeasurementSetupView';
import { MeasurementSetupPersister } from './MeasurementSetupPersister';

/**
 * Opens a modal for configuring measurement display settings stored in customer server_scope attributes.
 *
 * @example
 * ```typescript
 * const modal = await openMeasurementSetupModal({
 *   token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   customerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 *   tbBaseUrl: 'https://tb.myio-bas.com',
 *   onSave: (settings) => console.log('Saved:', settings),
 *   onClose: () => console.log('Modal closed')
 * });
 *
 * // Clean up when needed
 * modal.destroy();
 * ```
 */
export async function openMeasurementSetupModal(
  params: MeasurementSetupModalParams
): Promise<MeasurementSetupModalInstance> {
  // Validate required parameters
  if (!params.token) {
    throw new Error('[MeasurementSetupModal] token is required');
  }
  if (!params.customerId) {
    throw new Error('[MeasurementSetupModal] customerId is required');
  }

  // Initialize persister
  const persister = new MeasurementSetupPersister(params.token, params.tbBaseUrl);

  // Track current settings
  let existingSettings: MeasurementDisplaySettings | null = params.existingSettings || null;

  // Create view
  const view = new MeasurementSetupView({
    styles: params.styles,
    locale: params.locale,
    onSave: async () => {
      const formData = view.getFormData();
      const settings = persister.formDataToSettings(formData, existingSettings);

      const result = await persister.saveSettings(params.customerId, settings);

      if (!result.ok) {
        throw new Error(result.error?.message || 'Failed to save configuration');
      }

      // Update local cache
      existingSettings = settings;

      // Call onSave callback
      if (params.onSave) {
        params.onSave(settings);
      }
    },
    onClose: () => {
      if (params.onClose) {
        params.onClose();
      }
    },
  });

  // Load form data from existing settings or API
  async function loadFormData(): Promise<void> {
    view.showLoading();

    try {
      // Load from API if not provided
      if (!existingSettings) {
        existingSettings = await persister.loadSettings(params.customerId);
      }

      // Extract form data from settings
      const formData = persister.settingsToFormData(existingSettings);
      view.setFormData(formData);
    } catch (error) {
      console.error('[MeasurementSetupModal] Error loading form data:', error);
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
    setFormData: (data: Partial<MeasurementSetupFormData>) => view.setFormData(data),
  };
}

// Also export as default
export default openMeasurementSetupModal;
