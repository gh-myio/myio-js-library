// src/components/premium-modals/types.ts
export type ISODate = `${number}-${number}-${number}`; // YYYY-MM-DD

export interface DateRange { 
  start: ISODate; 
  end: ISODate; 
}

export interface BaseApiCfg {
  clientId?: string;
  clientSecret?: string;
  dataApiBaseUrl?: string;
  graphsBaseUrl?: string;
  timezone?: string;        // default: "America/Sao_Paulo"
  tbJwtToken?: string;      // required only for Settings writes
  ingestionToken?: string;  // NEW: token for data ingestion access
}

export interface BaseUiCfg {
  theme?: 'light' | 'dark';
  width?: number | 'auto';  // default: 0.8 * viewport width
}

export interface OpenEnergyParams {
  deviceId: string;
  label?: string;
  gatewayId?: string;
  slaveId?: number;
  ingestionId?: string;
  date?: Partial<DateRange>;
  ui?: BaseUiCfg;
  api: BaseApiCfg;
}

// Energy fetcher type for dependency injection
export type EnergyFetcher = (args: {
  baseUrl: string;
  ingestionId: string;
  startISO: string;
  endISO: string;
}) => Promise<any>;

export interface OpenDeviceReportParams {
  ingestionId: string;
  deviceId?: string;
  identifier?: string;    // NEW: replaces deviceLabel (device identifier/code)
  label?: string;         // NEW: replaces storeLabel (human-readable name)
  ui?: BaseUiCfg;
  api: BaseApiCfg;
  fetcher?: EnergyFetcher; // Optional dependency injection for testing
}

// Customer Totals fetcher type for dependency injection
export type CustomerTotalsFetcher = (args: {
  baseUrl: string;
  token: string;
  customerId: string;
  startISO: string;
  endISO: string;
}) => Promise<any[]>;

export interface OpenAllReportParams {
  customerId: string;
  ui?: BaseUiCfg;
  api: BaseApiCfg;
  filters?: { 
    excludeLabels?: (RegExp | string)[];
    excludeIds?: string[];
    forceOnlyIds?: string[];
  };
  fetcher?: CustomerTotalsFetcher; // Optional dependency injection for testing
}

export interface OpenSettingsParams {
  deviceId: string;
  api: BaseApiCfg;
  ui?: BaseUiCfg;
  seed?: {
    label?: string; floor?: string; storeNumber?: string;
    meterId?: string; deviceRef?: string; guid?: string;
    maxDailyKwh?: number; maxNightKwh?: number; maxBusinessKwh?: number;
  };
}

export interface ModalHandle {
  close(): void;
  on(event: 'close'|'loaded'|'error', handler: (p?: any) => void): void;
}
