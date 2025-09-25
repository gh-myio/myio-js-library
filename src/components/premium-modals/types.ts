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

export interface OpenDeviceReportParams {
  ingestionId: string;
  deviceId?: string;
  deviceLabel?: string;
  storeLabel?: string;
  date?: Partial<DateRange>;
  ui?: BaseUiCfg;
  api: BaseApiCfg;
}

export interface OpenAllReportParams {
  customerId: string;
  date?: Partial<DateRange>;
  ui?: BaseUiCfg;
  api: BaseApiCfg;
  filters?: { excludeLabels?: (RegExp | string)[] };
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
