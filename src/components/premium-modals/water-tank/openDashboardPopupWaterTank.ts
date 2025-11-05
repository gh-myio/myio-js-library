// water-tank/openDashboardPopupWaterTank.ts - Public API entry point for water tank modal

import { WaterTankModal } from './WaterTankModal';
import { OpenDashboardPopupWaterTankOptions } from './types';

/**
 * Opens the water tank detail modal for a specific device
 *
 * This modal fetches telemetry data directly from ThingsBoard REST API (NOT Ingestion API).
 * It displays water level data in a visual chart and provides export functionality.
 *
 * @param options Configuration options for the water tank modal
 * @returns Promise that resolves to an object with close method
 *
 * @example
 * ```typescript
 * // Basic usage
 * const modal = await openDashboardPopupWaterTank({
 *   deviceId: 'DEVICE_UUID',
 *   tbJwtToken: localStorage.getItem('jwt_token'),
 *   startTs: Date.now() - 86400000, // Last 24 hours
 *   endTs: Date.now(),
 *   label: 'Water Tank #1',
 *   currentLevel: 75.5
 * });
 *
 * // Close programmatically
 * modal.close();
 *
 * // With callbacks
 * const modal = await openDashboardPopupWaterTank({
 *   deviceId: 'DEVICE_UUID',
 *   tbJwtToken: myToken,
 *   startTs: startTimestamp,
 *   endTs: endTimestamp,
 *   label: 'Water Tank #1',
 *   deviceType: 'CAIXA_DAGUA',
 *   onOpen: (context) => {
 *     console.log('Modal opened:', context);
 *   },
 *   onDataLoaded: (data) => {
 *     console.log('Data loaded:', data.summary);
 *   },
 *   onClose: () => {
 *     console.log('Modal closed');
 *   },
 *   onError: (error) => {
 *     console.error('Modal error:', error);
 *   }
 * });
 *
 * // With custom telemetry keys and UI options
 * const modal = await openDashboardPopupWaterTank({
 *   deviceId: 'DEVICE_UUID',
 *   tbJwtToken: myToken,
 *   startTs: startTimestamp,
 *   endTs: endTimestamp,
 *   telemetryKeys: ['waterLevel', 'nivel_agua', 'level'],
 *   aggregation: 'AVG',
 *   limit: 500,
 *   ui: {
 *     title: 'Custom Tank Title',
 *     width: 1000,
 *     height: 700,
 *     showExport: true,
 *     showLevelIndicator: true
 *   },
 *   timezone: 'America/Sao_Paulo'
 * });
 * ```
 *
 * @throws {WaterTankModalError} If validation fails or API request fails
 */
export async function openDashboardPopupWaterTank(
  options: OpenDashboardPopupWaterTankOptions
): Promise<{ close: () => void }> {
  try {
    // Validate required parameters
    validateOptions(options);

    console.log('[openDashboardPopupWaterTank] Opening water tank modal with options:', {
      deviceId: options.deviceId,
      label: options.label,
      currentLevel: options.currentLevel,
      timeRange: {
        start: new Date(options.startTs).toISOString(),
        end: new Date(options.endTs).toISOString()
      },
      telemetryKeys: options.telemetryKeys || ['waterLevel', 'nivel', 'level']
    });

    // Create modal instance
    const modal = new WaterTankModal(options);

    // Wait for the modal to fully initialize and show
    const modalHandle = await modal.show();

    console.log('[openDashboardPopupWaterTank] Water tank modal opened successfully');

    // Return the close handle
    return modalHandle;

  } catch (error) {
    console.error('[openDashboardPopupWaterTank] Error opening modal:', error);

    // Trigger onError callback if provided
    if (options.onError) {
      try {
        options.onError({
          code: error instanceof Error && error.message.includes('validation')
            ? 'VALIDATION_ERROR'
            : error instanceof Error && error.message.includes('auth')
            ? 'AUTH_ERROR'
            : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          cause: error
        });
      } catch (callbackError) {
        console.warn('[openDashboardPopupWaterTank] onError callback failed:', callbackError);
      }
    }

    // Re-throw the error for the caller to handle
    throw error;
  }
}

/**
 * Validate required options
 */
function validateOptions(options: OpenDashboardPopupWaterTankOptions): void {
  const errors: string[] = [];

  // Required fields
  if (!options.deviceId || typeof options.deviceId !== 'string') {
    errors.push('deviceId is required and must be a string');
  }

  if (!options.tbJwtToken || typeof options.tbJwtToken !== 'string') {
    errors.push('tbJwtToken is required and must be a string');
  }

  if (typeof options.startTs !== 'number' || isNaN(options.startTs)) {
    errors.push('startTs is required and must be a valid timestamp number');
  }

  if (typeof options.endTs !== 'number' || isNaN(options.endTs)) {
    errors.push('endTs is required and must be a valid timestamp number');
  }

  // Validate time range
  if (options.startTs && options.endTs && options.startTs >= options.endTs) {
    errors.push('startTs must be before endTs');
  }

  // Validate current level if provided
  if (options.currentLevel !== undefined) {
    const level = Number(options.currentLevel);
    if (isNaN(level) || level < 0 || level > 100) {
      errors.push('currentLevel must be a number between 0 and 100');
    }
  }

  // Validate limit if provided
  if (options.limit !== undefined) {
    const limit = Number(options.limit);
    if (isNaN(limit) || limit < 1 || limit > 10000) {
      errors.push('limit must be a number between 1 and 10000');
    }
  }

  // Validate aggregation if provided
  if (options.aggregation !== undefined) {
    const validAggregations = ['NONE', 'MIN', 'MAX', 'AVG', 'SUM', 'COUNT'];
    if (!validAggregations.includes(options.aggregation)) {
      errors.push(`aggregation must be one of: ${validAggregations.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed:\n- ${errors.join('\n- ')}`);
  }
}

// Re-export types for convenience
export type {
  OpenDashboardPopupWaterTankOptions,
  WaterTankModalContext,
  WaterTankModalError,
  WaterTankTelemetryData,
  WaterTankDataPoint,
  WaterTankModalI18n,
  WaterTankModalStyleOverrides
} from './types';
