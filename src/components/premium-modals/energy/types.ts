// energy/types.ts - Comprehensive types for openDashboardPopupEnergy component

// ============================================================================
// RFC-0165: BAS Mode Types
// ============================================================================

export interface BASDeviceData {
  id: string;
  entityId: string;
  label: string;
  deviceType: string;
  deviceProfile?: string;
  hasRemote: boolean;
  isRemoteOn?: boolean;
  status: 'online' | 'offline' | 'unknown';
  telemetry?: BASDeviceTelemetry;
}

export interface BASDeviceTelemetry {
  power?: number;        // kW
  current?: number;      // A
  voltage?: number;      // V
  temperature?: number;  // °C
  consumption?: number;  // kWh
  lastUpdate?: number;   // timestamp
}

export interface OpenDashboardPopupEnergyOptions {
  // ⭐ NEW: Mode Configuration (default: 'single')
  mode?: 'single' | 'comparison';

  // ========================================
  // RFC-0165: BAS MODE PARAMETERS
  // ========================================
  /** Enable BAS mode with automation control panel (30% left, 70% chart right) */
  basMode?: boolean;
  /** Device object for automation control (required when basMode=true) */
  basDevice?: BASDeviceData;
  /** Callback for remote control commands */
  onRemoteCommand?: (command: 'on' | 'off', device: BASDeviceData) => Promise<void>;
  /** Callback for device telemetry refresh */
  onTelemetryRefresh?: (device: BASDeviceData) => Promise<BASDeviceTelemetry>;
  /** Callback when settings button is clicked */
  onSettingsClick?: (device: BASDeviceData) => void;
  /** Auto-refresh interval for telemetry in ms (default: 10000) */
  telemetryRefreshInterval?: number;

  // ========================================
  // SINGLE MODE PARAMETERS (original behavior)
  // ========================================
  deviceId?: string;                   // TB device UUID for entity fetch (required for single mode)
  startDate: string | Date;            // ISO with TZ offset or 'YYYY-MM-DD'
  endDate: string | Date;              // ISO with TZ offset or 'YYYY-MM-DD'
  tbJwtToken?: string;                 // REQUIRED for TB REST fetches in single mode

  // Optional Identity Resolution (single mode)
  label?: string;                      // Display label (fallback to TB label/name)
  customerId?: string;                 // Optional; if absent, show device view
  ingestionId?: string;                // Optional; try resolving from TB attributes
  centralId?: string;                  // Optional; may come from attributes
  slaveId?: number | string;           // Optional; may come from attributes

  // ========================================
  // COMPARISON MODE PARAMETERS (new)
  // ========================================
  dataSources?: Array<{
    type: 'device';
    id: string;                        // Ingestion device ID
    label: string;                     // Display name for device
  }>

  // Authentication Strategy (ONE REQUIRED)
  ingestionToken?: string;             // For direct Data API access
  clientId?: string;                   // For SDK auth flow
  clientSecret?: string;               // For SDK auth flow

  // Endpoints / Environment
  dataApiHost?: string;                // default: https://api.data.apps.myio-bas.com
  chartsBaseUrl?: string;              // default: https://graphs.apps.myio-bas.com
  timezone?: string;                   // default: "America/Sao_Paulo"
  theme?: 'light' | 'dark';            // default: 'light'

  // Behavior Configuration
  readingType?: 'energy' | 'water' | 'tank' | 'temperature';  // default: 'energy'
  granularity?: '1d' | '1h' | '15m';   // default: '1d' (REQUIRED for comparison mode)
  deviceLabel?: string;               // Display label for device (used in demand modal)
  deviceProfile?: string;             // Device profile (e.g. '3F_MEDIDOR') — used to conditionally hide buttons
  closeOnEsc?: boolean;                // default: true
  zIndex?: number;                     // default: 10000
  deep?: boolean;                      // default: false (used in comparison mode)

  // Event Hooks
  onOpen?: (ctx: EnergyModalContext) => void;
  onClose?: () => void;
  onError?: (err: EnergyModalError) => void;

  // Customization
  i18n?: Partial<EnergyModalI18n>;
  styles?: Partial<EnergyModalStyleOverrides>;
}

export interface EnergyModalContext {
  device: {
    id: string;
    label: string;
    attributes: Record<string, any>;
  };
  resolved: {
    ingestionId?: string;
    centralId?: string;
    slaveId?: number | string;
    customerId?: string;
  };
}

export interface EnergyModalI18n {
  title: string;
  loading: string;
  error: string;
  noData: string;
  exportCsv: string;
  close: string;
  totalConsumption: string;
  averageDaily: string;
  peakDay: string;
  dateRange: string;
  deviceSummary: string;
  energyChart: string;
  kwhUnit: string;
}

export interface EnergyModalStyleOverrides {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderRadius: string;
  fontFamily: string;
  modalWidth: string;
  modalHeight: string;
}

export interface EnergyModalError {
  code: 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'AUTH_ERROR' | 'TOKEN_EXPIRED' | 'UNKNOWN_ERROR';
  message: string;
  field?: string;
  userAction?: 'RETRY' | 'RE_AUTH' | 'CONTACT_ADMIN' | 'FIX_INPUT';
  cause?: unknown;
}

export interface EnergyData {
  deviceId: string;
  consumption: EnergyDataPoint[];
  granularity: string;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface EnergyDataPoint {
  timestamp: string;
  value: number;
}

export interface EnergyDataParams {
  ingestionId: string;
  startISO: string;
  endISO: string;
  granularity: string;
}

export interface DataFetcherConfig {
  dataApiHost?: string;
  ingestionToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface EnergyViewConfig {
  context: EnergyModalContext;
  params: OpenDashboardPopupEnergyOptions;
  onExport: () => void;
  onError: (error: EnergyModalError) => void;
  onDateRangeChange?: (startISO: string, endISO: string) => Promise<void>;
}

export interface ChartOptions {
  dataApiHost?: string;
  chartsBaseUrl?: string;
  timezone: string;
  ingestionId: string;
  startISO: string;
  endISO: string;
  granularity: string;
  theme: string;
  ingestionToken?: string;
  clientId?: string;
  clientSecret?: string;
}

// Default i18n values
export const DEFAULT_I18N: EnergyModalI18n = {
  title: 'Dashboard - Gráfico',
  loading: 'Carregando dados...',
  error: 'Ocorreu um erro ao carregar os dados',
  noData: 'Nenhum dado disponível para o período selecionado',
  exportCsv: 'Exportar CSV',
  close: 'Fechar',
  totalConsumption: 'Consumo total',
  averageDaily: 'Média diária',
  peakDay: 'Pico do dia',
  dateRange: 'Período',
  deviceSummary: 'Detalhes do dispositivo',
  energyChart: 'Consumo de Energia',
  kwhUnit: 'kWh'
};

// Default style overrides
export const DEFAULT_STYLES: EnergyModalStyleOverrides = {
  primaryColor: '#6366f1',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  borderColor: '#e5e7eb',
  borderRadius: '8px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  modalWidth: '90vw',
  modalHeight: '90vh'
};
