/**
 * RFC-0107: Contract Devices Modal Types
 * Modal for managing device count attributes on CUSTOMER SERVER_SCOPE
 */

export type ContractDomain = 'energy' | 'water' | 'temperature';

/**
 * Sub-fields for energy and water domains
 */
export interface EnergyWaterSubFields {
  total: number | null;
  entries: number | null;
  commonArea: number | null;
  stores: number | null;
}

/**
 * Sub-fields for temperature domain
 */
export interface TemperatureSubFields {
  total: number | null;
  internal: number | null;
  stores: number | null;
}

/**
 * Device count keys structure matching RFC-0107
 * Each domain has contracted and installed sub-keys
 */
export interface DeviceCountKeys {
  energy: {
    contracted: {
      total: string;
      entries: string;
      commonArea: string;
      stores: string;
    };
    installed: {
      total: string;
      entries: string;
      commonArea: string;
      stores: string;
    };
  };
  water: {
    contracted: {
      total: string;
      entries: string;
      commonArea: string;
      stores: string;
    };
    installed: {
      total: string;
      entries: string;
      commonArea: string;
      stores: string;
    };
  };
  temperature: {
    contracted: {
      total: string;
      internal: string;
      stores: string;
    };
    installed: {
      total: string;
      internal: string;
      stores: string;
    };
  };
}

/**
 * Device counts data structure
 * Each domain has contracted and installed counts
 */
export interface ContractDeviceCounts {
  energy: {
    contracted: EnergyWaterSubFields;
    installed: EnergyWaterSubFields;
  };
  water: {
    contracted: EnergyWaterSubFields;
    installed: EnergyWaterSubFields;
  };
  temperature: {
    contracted: TemperatureSubFields;
    installed: TemperatureSubFields;
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

  // User email for permission check (fields editable only for @myio.com.br domain)
  userEmail?: string;

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
  /** When true, fields are disabled and save button is hidden (view-only mode) */
  readOnly?: boolean;
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
 * Each domain has contracted and installed sub-keys
 */
export const DEVICE_COUNT_KEYS: DeviceCountKeys = {
  energy: {
    contracted: {
      total: 'qtDevices3f',
      entries: 'qtDevices3f-Entries',
      commonArea: 'qtDevices3f-CommonArea',
      stores: 'qtDevices3f-Stores'
    },
    installed: {
      total: 'qtDevices3f-Installed',
      entries: 'qtDevices3f-Installed-Entries',
      commonArea: 'qtDevices3f-Installed-CommonArea',
      stores: 'qtDevices3f-Installed-Stores'
    }
  },
  water: {
    contracted: {
      total: 'qtDevicesHidr',
      entries: 'qtDevicesHidr-Entries',
      commonArea: 'qtDevicesHidr-CommonArea',
      stores: 'qtDevicesHidr-Stores'
    },
    installed: {
      total: 'qtDevicesHidr-Installed',
      entries: 'qtDevicesHidr-Installed-Entries',
      commonArea: 'qtDevicesHidr-Installed-CommonArea',
      stores: 'qtDevicesHidr-Installed-Stores'
    }
  },
  temperature: {
    contracted: {
      total: 'qtDevicesTemp',
      internal: 'qtDevicesTemp-Internal',
      stores: 'qtDevicesTemp-Stores'
    },
    installed: {
      total: 'qtDevicesTemp-Installed',
      internal: 'qtDevicesTemp-Installed-Internal',
      stores: 'qtDevicesTemp-Installed-Stores'
    }
  }
};
