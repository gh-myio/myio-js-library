/**
 * RFC-0107: Open Contract Devices Modal
 * Entry point function for the contract devices configuration modal
 */

import { ContractDevicesController } from './ContractDevicesController';
import { OpenContractDevicesModalParams } from './types';

/**
 * Opens a modal for configuring contracted device counts per domain (energy, water, temperature).
 *
 * This function creates a modal interface for editing device count attributes that are
 * persisted to ThingsBoard CUSTOMER SERVER_SCOPE. These counts represent the contracted
 * number of devices for each domain and subcategory (entries, common area, stores).
 *
 * Attribute keys managed:
 * - Energy: qtDevices3f, qtDevices3f-Entries, qtDevices3f-CommonArea, qtDevices3f-Stores
 * - Water: qtDevicesHidr, qtDevicesHidr-Entries, qtDevicesHidr-CommonArea, qtDevicesHidr-Stores
 * - Temperature: qtDevicesTemp, qtDevicesTemp-Internal, qtDevicesTemp-Stores
 *
 * @param params Configuration parameters for the modal
 * @returns Promise that resolves when the modal is displayed
 *
 * @example
 * ```typescript
 * // Basic usage
 * await openContractDevicesModal({
 *   customerId: 'customer-123',
 *   jwtToken: localStorage.getItem('jwt_token'),
 *   customerName: 'Shopping Center XYZ',
 *   onSaved: (result) => {
 *     if (result.ok) {
 *       console.log('Contract devices saved:', result.updatedKeys);
 *     }
 *   }
 * });
 *
 * // With pre-populated data
 * await openContractDevicesModal({
 *   customerId: 'customer-123',
 *   jwtToken: jwtToken,
 *   customerName: 'Shopping Center XYZ',
 *   seed: {
 *     energy: { total: 50, entries: 2, commonArea: 10, stores: 38 },
 *     water: { total: 30, entries: 1, commonArea: 5, stores: 24 },
 *     temperature: { total: 20, internal: 5, stores: 15 }
 *   },
 *   onSaved: (result) => console.log('Saved:', result)
 * });
 * ```
 *
 * @throws {Error} When required parameters (jwtToken, customerId) are missing
 */
export async function openContractDevicesModal(
  params: OpenContractDevicesModalParams
): Promise<void> {
  // Parameter validation
  if (!params.jwtToken) {
    throw new Error('jwtToken is required for contract devices persistence');
  }

  if (!params.customerId) {
    throw new Error('customerId is required');
  }

  console.info('[openContractDevicesModal] Initializing contract devices modal', {
    customerId: params.customerId,
    customerName: params.customerName,
    hasJwtToken: !!params.jwtToken,
    hasSeedData: !!params.seed
  });

  // Create and show controller
  const controller = new ContractDevicesController(params);

  try {
    await controller.show();
  } catch (error: any) {
    console.error('[openContractDevicesModal] Error:', error);

    if (params.onError) {
      params.onError({
        code: 'UNKNOWN_ERROR',
        message: error.message || 'Erro ao abrir modal de dispositivos contratados',
        cause: error
      });
    }

    throw error;
  }
}
