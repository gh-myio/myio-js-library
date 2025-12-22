/**
 * RFC-0107: Contract Devices Controller
 * Orchestrates View, Fetcher, and Persister for the contract devices modal
 */

import { ContractDevicesModalView } from './ContractDevicesModalView';
import { DefaultContractDevicesPersister } from './ContractDevicesPersister';
import { DefaultContractDevicesFetcher } from './ContractDevicesFetcher';
import {
  OpenContractDevicesModalParams,
  ContractDeviceCounts,
  ContractDevicesModalConfig,
  ContractDevicesPersister,
  ContractDevicesFetcher
} from './types';

export class ContractDevicesController {
  private params: OpenContractDevicesModalParams;
  private view: ContractDevicesModalView | null = null;
  private persister: ContractDevicesPersister;
  private fetcher: ContractDevicesFetcher;

  constructor(params: OpenContractDevicesModalParams) {
    this.params = params;

    // Initialize persister
    this.persister = new DefaultContractDevicesPersister(
      params.jwtToken,
      params.api
    );

    // Initialize fetcher
    this.fetcher = new DefaultContractDevicesFetcher(
      params.jwtToken,
      params.api
    );
  }

  async show(): Promise<void> {
    // Fetch existing values
    let seedData = this.params.seed || {};

    try {
      const existingCounts = await this.fetcher.fetchCurrentCounts(this.params.customerId);
      // Merge with seed, preferring fetched data
      seedData = this.mergeCounts(seedData, existingCounts);
      console.log('[ContractDevicesController] Merged seed data:', seedData);
    } catch (error) {
      console.warn('[ContractDevicesController] Failed to fetch existing counts:', error);
    }

    // Build view config
    const viewConfig: ContractDevicesModalConfig = {
      title: this.params.ui?.title || 'Configurar Dispositivos Contratados',
      width: this.params.ui?.width || 800,
      closeOnBackdrop: this.params.ui?.closeOnBackdrop !== false,
      customerName: this.params.customerName,
      onSave: this.handleSave.bind(this),
      onClose: this.handleClose.bind(this)
    };

    // Create and render view
    this.view = new ContractDevicesModalView(viewConfig);
    this.view.render(seedData);
  }

  private async handleSave(formData: ContractDeviceCounts): Promise<void> {
    if (!this.view) return;

    // Validate totals match sum of components
    const validationError = this.validateTotals(formData);
    if (validationError) {
      this.view.showError(validationError);
      return;
    }

    this.view.showLoadingState(true);
    this.view.hideError();

    try {
      const result = await this.persister.saveDeviceCounts(
        this.params.customerId,
        formData
      );

      if (result.ok) {
        console.log('[ContractDevicesController] Save successful:', result);

        // Call onSaved callback
        if (this.params.onSaved) {
          this.params.onSaved(result);
        }

        // Close modal on success
        this.handleClose();
      } else {
        console.error('[ContractDevicesController] Save failed:', result.error);
        this.view.showError(result.error?.message || 'Erro ao salvar configuracoes');

        if (this.params.onError && result.error) {
          this.params.onError(result.error);
        }
      }
    } catch (error: any) {
      console.error('[ContractDevicesController] Unexpected error:', error);
      this.view.showError(error.message || 'Erro inesperado');

      if (this.params.onError) {
        this.params.onError({
          code: 'UNKNOWN_ERROR',
          message: error.message || 'Erro desconhecido',
          cause: error
        });
      }
    } finally {
      if (this.view) {
        this.view.showLoadingState(false);
      }
    }
  }

  private handleClose(): void {
    if (this.view) {
      this.view.close();
      this.view = null;
    }

    if (this.params.onClose) {
      this.params.onClose();
    }
  }

  /**
   * Validate that totals match sum of components for each domain
   * Returns error message if validation fails, null if valid
   */
  private validateTotals(formData: ContractDeviceCounts): string | null {
    const errors: string[] = [];

    // Energy: total = entries + commonArea + stores
    if (formData.energy.total !== null) {
      const energySum = (formData.energy.entries || 0) +
                        (formData.energy.commonArea || 0) +
                        (formData.energy.stores || 0);
      if (formData.energy.total !== energySum) {
        errors.push(`Energia: Total (${formData.energy.total}) deve ser igual a Entradas + Area Comum + Lojas (${energySum})`);
      }
    }

    // Water: total = entries + commonArea + stores
    if (formData.water.total !== null) {
      const waterSum = (formData.water.entries || 0) +
                       (formData.water.commonArea || 0) +
                       (formData.water.stores || 0);
      if (formData.water.total !== waterSum) {
        errors.push(`Agua: Total (${formData.water.total}) deve ser igual a Entradas + Area Comum + Lojas (${waterSum})`);
      }
    }

    // Temperature: total = internal + stores
    if (formData.temperature.total !== null) {
      const tempSum = (formData.temperature.internal || 0) +
                      (formData.temperature.stores || 0);
      if (formData.temperature.total !== tempSum) {
        errors.push(`Temperatura: Total (${formData.temperature.total}) deve ser igual a Sensores Internos + Lojas (${tempSum})`);
      }
    }

    return errors.length > 0 ? errors.join('\n') : null;
  }

  private mergeCounts(
    seed: Partial<ContractDeviceCounts>,
    fetched: Partial<ContractDeviceCounts>
  ): Partial<ContractDeviceCounts> {
    return {
      energy: {
        total: fetched.energy?.total ?? seed.energy?.total ?? null,
        entries: fetched.energy?.entries ?? seed.energy?.entries ?? null,
        commonArea: fetched.energy?.commonArea ?? seed.energy?.commonArea ?? null,
        stores: fetched.energy?.stores ?? seed.energy?.stores ?? null
      },
      water: {
        total: fetched.water?.total ?? seed.water?.total ?? null,
        entries: fetched.water?.entries ?? seed.water?.entries ?? null,
        commonArea: fetched.water?.commonArea ?? seed.water?.commonArea ?? null,
        stores: fetched.water?.stores ?? seed.water?.stores ?? null
      },
      temperature: {
        total: fetched.temperature?.total ?? seed.temperature?.total ?? null,
        internal: fetched.temperature?.internal ?? seed.temperature?.internal ?? null,
        stores: fetched.temperature?.stores ?? seed.temperature?.stores ?? null
      }
    };
  }
}
