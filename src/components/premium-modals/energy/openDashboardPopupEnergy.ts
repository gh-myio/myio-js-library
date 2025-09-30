// energy/openDashboardPopupEnergy.ts - Public API entry point for energy modal

import { EnergyModal } from './EnergyModal';
import { OpenDashboardPopupEnergyOptions } from './types';
import { validateOptions } from './utils';

/**
 * Opens the energy detail modal for a specific device
 * 
 * @param options Configuration options for the energy modal
 * @returns Promise that resolves to an object with close method
 * 
 * @example
 * ```typescript
 * // Basic usage with await
 * const modal = await openDashboardPopupEnergy({
 *   deviceId: 'DEVICE_UUID',
 *   startDate: '2025-09-01',
 *   endDate: '2025-09-30',
 *   tbJwtToken: myTbToken,
 *   ingestionToken: myIngestionToken
 * });
 * 
 * // Close programmatically
 * modal.close();
 * 
 * // Usage with client credentials
 * const modal = await openDashboardPopupEnergy({
 *   deviceId: 'DEVICE_UUID',
 *   startDate: '2025-09-01',
 *   endDate: '2025-09-30',
 *   tbJwtToken: myTbToken,
 *   clientId: CLIENT_ID,
 *   clientSecret: CLIENT_SECRET
 * });
 * ```
 */
export async function openDashboardPopupEnergy(
  options: OpenDashboardPopupEnergyOptions
): Promise<{ close: () => void }> {
  try {
    // Validate parameters early
    validateOptions(options);
    
    console.log('[openDashboardPopupEnergy] Opening energy modal with options:', {
      deviceId: options.deviceId,
      hasIngestionToken: !!options.ingestionToken,
      hasClientCredentials: !!(options.clientId && options.clientSecret),
      startDate: options.startDate,
      endDate: options.endDate,
      theme: options.theme || 'light'
    });
    
    // Create modal instance
    const modal = new EnergyModal(options);
    
    // Wait for the modal to fully initialize and show
    const modalHandle = await modal.show();
    
    console.log('[openDashboardPopupEnergy] Energy modal opened successfully');
    
    // Return the close handle
    return modalHandle;
    
  } catch (error) {
    console.error('[openDashboardPopupEnergy] Error opening modal:', error);
    
    // Trigger onError callback if provided
    if (options.onError) {
      try {
        options.onError({
          code: error instanceof Error && error.message.includes('validation') ? 'VALIDATION_ERROR' : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          cause: error
        });
      } catch (callbackError) {
        console.warn('[openDashboardPopupEnergy] onError callback failed:', callbackError);
      }
    }
    
    // Re-throw the error for the caller to handle
    throw error;
  }
}

// Re-export types for convenience
export type { 
  OpenDashboardPopupEnergyOptions,
  EnergyModalContext,
  EnergyModalI18n,
  EnergyModalStyleOverrides,
  EnergyModalError
} from './types';
