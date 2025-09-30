// energy/openDashboardPopupEnergy.ts - Public API entry point for energy modal

import { EnergyModal } from './EnergyModal';
import { OpenDashboardPopupEnergyOptions } from './types';
import { validateOptions } from './utils';

/**
 * Opens the energy detail modal for a specific device
 * 
 * @param options Configuration options for the energy modal
 * @returns Object with close method to programmatically close the modal
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const modal = openDashboardPopupEnergy({
 *   deviceId: 'DEVICE_UUID',
 *   startDate: '2025-09-01',
 *   endDate: '2025-09-30',
 *   tbJwtToken: myTbToken,
 *   ingestionToken: myIngestionToken
 * });
 * 
 * // Close programmatically
 * modal.close();
 * ```
 */
export function openDashboardPopupEnergy(
  options: OpenDashboardPopupEnergyOptions
): { close: () => void } {
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
    
    // Start the async show process but return synchronously
    modal.show().catch(error => {
      console.error('[openDashboardPopupEnergy] Async error in modal.show():', error);
      
      // Trigger onError callback if provided
      if (options.onError) {
        try {
          options.onError({
            code: 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            cause: error
          });
        } catch (callbackError) {
          console.warn('[openDashboardPopupEnergy] onError callback failed:', callbackError);
        }
      }
    });
    
    // Return close handle immediately
    return {
      close: () => modal.close()
    };
    
  } catch (error) {
    console.error('[openDashboardPopupEnergy] Error opening modal:', error);
    
    // Trigger onError callback if provided
    if (options.onError) {
      try {
        options.onError({
          code: 'VALIDATION_ERROR',
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
