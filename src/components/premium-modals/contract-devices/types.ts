/**
 * RFC-0107: Contract Devices Modal Types
 * Modal for managing device count attributes on CUSTOMER SERVER_SCOPE
 */

export type ContractDomain = 'energy' | 'water' | 'temperature';

/**
 * Device count keys structure matching RFC-0107
 */
export interface DeviceCountKeys {
  energy: {
    total: string;
    entries: string;
    commonArea: string;
    stores: string;
  };
  water: {
    total: string;
    entries: string;
    commonArea: string;
    stores: string;
  };
  temperature: {
    total: string;
    internal: string;
    stores: string;
  };
}

/**
 * Device counts data structure
 */
export interface ContractDeviceCounts {
  energy: {
    total: number | null;
    entries: number | null;
    commonArea: number | null;
    stores: number | null;
  };
  water: {
    total: number | null;
    entries: number | null;
    commonArea: number | null;
    stores: number | null;
  };
  temperature: {
    total: number | null;
    internal: number | null;
    stores: number | null;
  };
}

/**
 * Parameters for opening the contract devices modal
 */
export interface OpenContractDevicesModalParams {
  // Customer identification (REQUIRED)
  customerId: string;
  customerName?: string;

  // Authentication (REQUIRED)
  jwtToken: string;

  // API configuration
  api?: {
    tbBaseUrl?: string;
  };

  // Pre-populate form with existing values
  seed?: Partial<ContractDeviceCounts>;

  // Event handlers
  onSaved?: (result: ContractDevicesPersistResult) => void;
  onClose?: () => void;
  onError?: (error: ContractDevicesError) => void;

  // UI customization
  ui?: {
    title?: string;
    width?: number | string;
    closeOnBackdrop?: boolean;
  };
}

/**
 * Result of persisting contract device counts
 */
export interface ContractDevicesPersistResult {
  ok: boolean;
  updatedKeys?: string[];
  error?: ContractDevicesError;
  timestamp?: string;
}

/**
 * Error structure for contract devices modal
 */
export interface ContractDevicesError {
  code: 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'AUTH_ERROR' | 'TOKEN_EXPIRED' | 'UNKNOWN_ERROR';
  message: string;
  field?: string;
  userAction?: 'RETRY' | 'RE_AUTH' | 'CONTACT_ADMIN' | 'FIX_INPUT';
  cause?: unknown;
}

/**
 * Internal modal configuration
 */
export interface ContractDevicesModalConfig {
  title: string;
  width: number | string;
  closeOnBackdrop?: boolean;
  customerName?: string;
  onSave: (formData: ContractDeviceCounts) => Promise<void>;
  onClose: () => void;
}

/**
 * Contract devices persister interface
 */
export interface ContractDevicesPersister {
  saveDeviceCounts(
    customerId: string,
    counts: ContractDeviceCounts
  ): Promise<ContractDevicesPersistResult>;
}

/**
 * Contract devices fetcher interface
 */
export interface ContractDevicesFetcher {
  fetchCurrentCounts(
    customerId: string
  ): Promise<Partial<ContractDeviceCounts>>;
}

/**
 * Default device count keys (matches RFC-0107)
 */
export const DEVICE_COUNT_KEYS: DeviceCountKeys = {
  energy: {
    total: 'qtDevices3f',
    entries: 'qtDevices3f-Entries',
    commonArea: 'qtDevices3f-CommonArea',
    stores: 'qtDevices3f-Stores'
  },
  water: {
    total: 'qtDevicesHidr',
    entries: 'qtDevicesHidr-Entries',
    commonArea: 'qtDevicesHidr-CommonArea',
    stores: 'qtDevicesHidr-Stores'
  },
  temperature: {
    total: 'qtDevicesTemp',
    internal: 'qtDevicesTemp-Internal',
    stores: 'qtDevicesTemp-Stores'
  }
};
