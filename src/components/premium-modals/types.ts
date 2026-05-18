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
  domain?: 'energy' | 'water' | 'temperature'; // NEW: data domain (default: 'energy')
  granularity?: '1d' | '1h'; // API data granularity (default: '1d')
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

export interface StoreItem {
  id: string;           // ingestionId to match with API response (device.ingestionId)
  identifier: string;   // Display identifier (e.g., "SCMAL1230B")
  label: string;        // Display name (e.g., "McDonalds")
  groupLabel?: string;  // RFC-0182: Optional group for "todos" mode — triggers section headers
}

export interface OpenAllReportParams {
  customerId: string;
  domain?: 'energy' | 'water' | 'temperature'; // Data domain (default: 'energy')
  group?: string; // RFC-0182: e.g. 'lojas' | 'entrada' | 'area_comum' | 'todos' | 'climatizavel' | 'nao_climatizavel'
  granularity?: '1d' | '1h'; // API data granularity (default: '1d')
  ui?: BaseUiCfg;
  api: BaseApiCfg;
  itemsList?: StoreItem[]; // RFC-0182: Optional — if absent, maps directly from API response
  /**
   * RFC-0182 / RFC-0201 Phase-2 #18 — Server-side ingestionId allow-list.
   *
   * When provided, the modal filters the API response so only rows whose
   * `id` is present in `orchIdSet` are kept. This is the API-driven filter
   * counterpart to `itemsList`: callers can pass a pre-built `Set<string>`
   * built from `itemsList.map(i => String(i.id))` to avoid the modal
   * rebuilding it on every render.
   *
   * If both `itemsList` and `orchIdSet` are provided, `orchIdSet` takes
   * precedence for the API-response filter (label/identifier/groupLabel
   * still come from `itemsList`).
   *
   * If `orchIdSet` is `undefined` or empty AND `itemsList` is also absent,
   * the modal falls back to mapping every API item directly.
   */
  orchIdSet?: Set<string>;
  fetcher?: CustomerTotalsFetcher; // Optional dependency injection for testing
  debug?: 1 | 0; // Optional debug logging flag (1 = enabled, 0 = disabled)
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
