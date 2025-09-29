import { SettingsController } from './SettingsController';
import { OpenDashboardPopupSettingsParams } from './types';

/**
 * Opens a settings modal for device configuration management with ThingsBoard persistence.
 * 
 * This function creates a modal interface for editing device settings including:
 * - Device label (persisted to ThingsBoard device entity)
 * - Device metadata (floor, store number, meter ID, etc.)
 * - Energy consumption limits
 * - Custom device reference and GUID
 * 
 * All settings except the device label are persisted as SERVER_SCOPE attributes
 * in ThingsBoard with the namespace 'myio.settings.energy.*'
 * 
 * @param params Configuration parameters for the settings modal
 * @returns Promise that resolves when the modal is displayed
 * 
 * @example
 * ```typescript
 * // Basic usage
 * await openDashboardPopupSettings({
 *   deviceId: 'device-123',
 *   jwtToken: localStorage.getItem('jwt_token'),
 *   onSaved: (result) => {
 *     if (result.ok) {
 *       console.log('Settings saved successfully');
 *       location.reload(); // Refresh to show updated data
 *     }
 *   }
 * });
 * 
 * // With pre-populated data
 * await openDashboardPopupSettings({
 *   deviceId: 'device-123',
 *   jwtToken: jwtToken,
 *   seed: {
 *     label: 'Main Store Device',
 *     floor: '2nd Floor',
 *     storeNumber: 'ST-001',
 *     maxDailyKwh: 150
 *   },
 *   ui: {
 *     title: 'Device Configuration',
 *     width: 700
 *   }
 * });
 * 
 * // With custom API configuration
 * await openDashboardPopupSettings({
 *   deviceId: 'device-123',
 *   jwtToken: jwtToken,
 *   api: {
 *     tbBaseUrl: 'https://thingsboard.example.com',
 *     dataApiBaseUrl: 'https://api.data.example.com'
 *   },
 *   onSaved: (result) => console.log('Saved:', result),
 *   onError: (error) => {
 *     if (error.userAction === 'RE_AUTH') {
 *       window.location.href = '/login';
 *     }
 *   }
 * });
 * ```
 * 
 * @throws {Error} When required parameters (jwtToken, deviceId) are missing
 */
export async function openDashboardPopupSettings(
  params: OpenDashboardPopupSettingsParams
): Promise<void> {
  // Parameter validation
  if (!params.jwtToken) {
    throw new Error('jwtToken is required for settings persistence');
  }

  if (!params.deviceId) {
    throw new Error('deviceId is required');
  }

  // Log the operation for debugging
  console.info('[openDashboardPopupSettings] Initializing settings modal', {
    deviceId: params.deviceId,
    ingestionId: params.ingestionId,
    hasJwtToken: !!params.jwtToken,
    hasSeedData: !!params.seed,
    apiConfig: params.api ? Object.keys(params.api) : undefined
  });

  // Create and initialize controller
  const controller = new SettingsController(params);

  // Show modal and handle lifecycle
  try {
    await controller.show();
  } catch (error) {
    console.error('[openDashboardPopupSettings] Error:', error);
    
    // Call error handler if provided
    if (params.onError) {
      params.onError({
        code: 'UNKNOWN_ERROR',
        message: error.message || 'Unknown error occurred while opening settings modal',
        cause: error
      });
    }
    
    // Re-throw to allow caller to handle
    throw error;
  }
}
