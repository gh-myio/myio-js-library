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

// Allowed email domain for editing contract devices
const ALLOWED_EMAIL_DOMAIN = '@myio.com.br';

export class ContractDevicesController {
  private params: OpenContractDevicesModalParams;
  private view: ContractDevicesModalView | null = null;
  private persister: ContractDevicesPersister;
  private fetcher: ContractDevicesFetcher;
  private isReadOnly: boolean;

  constructor(params: OpenContractDevicesModalParams) {
    this.params = params;

    // Check if user has edit permission based on email domain
    this.isReadOnly = !this.hasEditPermission(params.userEmail);

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

  /**
   * Check if user has permission to edit contract devices
   * Only users with @myio.com.br email domain can edit
   */
  private hasEditPermission(userEmail?: string): boolean {
    if (!userEmail) {
      console.log('[ContractDevicesController] No userEmail provided, defaulting to read-only');
      return false;
    }

    const email = userEmail.toLowerCase().trim();
    const hasPermission = email.endsWith(ALLOWED_EMAIL_DOMAIN.toLowerCase());

    console.log('[ContractDevicesController] Permission check:', {
      userEmail: email,
      allowedDomain: ALLOWED_EMAIL_DOMAIN,
      hasEditPermission: hasPermission
    });

    return hasPermission;
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
      readOnly: this.isReadOnly,
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
   * Validate that totals match sum of components for each domain and type
   * Returns error message if validation fails, null if valid
   */
  private validateTotals(formData: ContractDeviceCounts): string | null {
    const errors: string[] = [];
    const types: Array<{ key: 'contracted' | 'installed'; label: string }> = [
      { key: 'contracted', label: 'Contratado' },
      { key: 'installed', label: 'Instalado' }
    ];

    types.forEach(({ key, label }) => {
      // Energy: total = entries + commonArea + stores
      if (formData.energy[key].total !== null) {
        const energySum = (formData.energy[key].entries || 0) +
                          (formData.energy[key].commonArea || 0) +
                          (formData.energy[key].stores || 0);
        if (formData.energy[key].total !== energySum) {
          errors.push(`Energia ${label}: Total (${formData.energy[key].total}) deve ser igual a Entradas + Area Comum + Lojas (${energySum})`);
        }
      }

      // Water: total = entries + commonArea + stores
      if (formData.water[key].total !== null) {
        const waterSum = (formData.water[key].entries || 0) +
                         (formData.water[key].commonArea || 0) +
                         (formData.water[key].stores || 0);
        if (formData.water[key].total !== waterSum) {
          errors.push(`Agua ${label}: Total (${formData.water[key].total}) deve ser igual a Entradas + Area Comum + Lojas (${waterSum})`);
        }
      }

      // Temperature: total = internal + stores
      if (formData.temperature[key].total !== null) {
        const tempSum = (formData.temperature[key].internal || 0) +
                        (formData.temperature[key].stores || 0);
        if (formData.temperature[key].total !== tempSum) {
          errors.push(`Temperatura ${label}: Total (${formData.temperature[key].total}) deve ser igual a Sensores Internos + Externos (${tempSum})`);
        }
      }
    });

    return errors.length > 0 ? errors.join('\n') : null;
  }

  private mergeCounts(
    seed: Partial<ContractDeviceCounts>,
    fetched: Partial<ContractDeviceCounts>
  ): Partial<ContractDeviceCounts> {
    return {
      energy: {
        contracted: {
          total: fetched.energy?.contracted?.total ?? seed.energy?.contracted?.total ?? null,
          entries: fetched.energy?.contracted?.entries ?? seed.energy?.contracted?.entries ?? null,
          commonArea: fetched.energy?.contracted?.commonArea ?? seed.energy?.contracted?.commonArea ?? null,
          stores: fetched.energy?.contracted?.stores ?? seed.energy?.contracted?.stores ?? null
        },
        installed: {
          total: fetched.energy?.installed?.total ?? seed.energy?.installed?.total ?? null,
          entries: fetched.energy?.installed?.entries ?? seed.energy?.installed?.entries ?? null,
          commonArea: fetched.energy?.installed?.commonArea ?? seed.energy?.installed?.commonArea ?? null,
          stores: fetched.energy?.installed?.stores ?? seed.energy?.installed?.stores ?? null
        }
      },
      water: {
        contracted: {
          total: fetched.water?.contracted?.total ?? seed.water?.contracted?.total ?? null,
          entries: fetched.water?.contracted?.entries ?? seed.water?.contracted?.entries ?? null,
          commonArea: fetched.water?.contracted?.commonArea ?? seed.water?.contracted?.commonArea ?? null,
          stores: fetched.water?.contracted?.stores ?? seed.water?.contracted?.stores ?? null
        },
        installed: {
          total: fetched.water?.installed?.total ?? seed.water?.installed?.total ?? null,
          entries: fetched.water?.installed?.entries ?? seed.water?.installed?.entries ?? null,
          commonArea: fetched.water?.installed?.commonArea ?? seed.water?.installed?.commonArea ?? null,
          stores: fetched.water?.installed?.stores ?? seed.water?.installed?.stores ?? null
        }
      },
      temperature: {
        contracted: {
          total: fetched.temperature?.contracted?.total ?? seed.temperature?.contracted?.total ?? null,
          internal: fetched.temperature?.contracted?.internal ?? seed.temperature?.contracted?.internal ?? null,
          stores: fetched.temperature?.contracted?.stores ?? seed.temperature?.contracted?.stores ?? null
        },
        installed: {
          total: fetched.temperature?.installed?.total ?? seed.temperature?.installed?.total ?? null,
          internal: fetched.temperature?.installed?.internal ?? seed.temperature?.installed?.internal ?? null,
          stores: fetched.temperature?.installed?.stores ?? seed.temperature?.installed?.stores ?? null
        }
      }
    };
  }
}
