// water-tank/types.ts - Types for openDashboardPopupWaterTank component

/**
 * Options for opening the water tank detail modal
 *
 * This modal displays water tank level telemetry data fetched directly from
 * ThingsBoard REST API, NOT from the Ingestion API (unlike energy/water consumption modals).
 */
export interface OpenDashboardPopupWaterTankOptions {
  // ========================================
  // REQUIRED PARAMETERS
  // ========================================
  deviceId: string;                    // ThingsBoard device UUID
  tbJwtToken: string;                  // ThingsBoard JWT token for REST API
  startTs: number;                     // Start timestamp in milliseconds
  endTs: number;                       // End timestamp in milliseconds

  // ========================================
  // DEVICE IDENTITY
  // ========================================
  deviceType?: string;                 // Device type (TANK, CAIXA_DAGUA, etc.)
  label?: string;                      // Display label for the device
  currentLevel?: number;               // Current water level (0-100%)
  currentLevelClamped?: number;        // RFC-0107: Clamped level for visual display (0-100)
  waterLevel?: number | null;          // RFC-0107: Raw water_level value from ThingsBoard
  waterPercentage?: number | null;     // RFC-0107: Raw water_percentage (0-1 range)

  // Optional Device Metadata
  slaveId?: string | number;           // Slave device ID
  centralId?: string;                  // Central controller ID
  ingestionId?: string;                // Ingestion ID (for reference, not used for API calls)

  // ========================================
  // TELEMETRY CONFIGURATION
  // ========================================
  telemetryKeys?: string[];            // Keys to fetch (default: ['waterLevel', 'nivel', 'level'])
  displayKey?: 'water_level' | 'water_percentage';  // RFC-0107: Which key to display in chart (default: 'water_percentage')
  aggregation?: 'NONE' | 'MIN' | 'MAX' | 'AVG' | 'SUM' | 'COUNT';  // default: 'NONE'
  limit?: number;                      // Max data points (default: 1000)

  // ========================================
  // ENVIRONMENT & BEHAVIOR
  // ========================================
  tbApiHost?: string;                  // ThingsBoard API host (default: window.location.origin)
  timezone?: string;                   // Timezone (default: "America/Sao_Paulo")
  theme?: 'light' | 'dark';            // UI theme (default: 'light')
  closeOnEsc?: boolean;                // Close modal on ESC key (default: true)
  zIndex?: number;                     // Modal z-index (default: 10000)

  // ========================================
  // UI CUSTOMIZATION
  // ========================================
  ui?: {
    title?: string;                    // Modal title (default: "Water Tank - {label}")
    width?: number;                    // Modal width in pixels (default: 900)
    height?: number;                   // Modal height in pixels (default: 600)
    showExport?: boolean;              // Show CSV export button (default: true)
    showLevelIndicator?: boolean;      // Show visual level indicator (default: true)
  };

  // ========================================
  // EVENT HOOKS
  // ========================================
  onOpen?: (ctx: WaterTankModalContext) => void;
  onClose?: () => void;
  onError?: (err: WaterTankModalError) => void;
  onDataLoaded?: (data: WaterTankTelemetryData) => void;

  // ========================================
  // ADVANCED CUSTOMIZATION
  // ========================================
  i18n?: Partial<WaterTankModalI18n>;
  styles?: Partial<WaterTankModalStyleOverrides>;
}

/**
 * Context passed to onOpen callback
 */
export interface WaterTankModalContext {
  device: {
    id: string;
    label: string;
    type?: string;
    currentLevel?: number;
  };
  metadata: {
    slaveId?: string | number;
    centralId?: string;
    ingestionId?: string;
  };
  timeRange: {
    startTs: number;
    endTs: number;
    timezone: string;
  };
}

/**
 * Error object passed to onError callback
 */
export interface WaterTankModalError {
  code: 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'AUTH_ERROR' | 'TOKEN_EXPIRED' | 'NO_DATA' | 'UNKNOWN_ERROR';
  message: string;
  field?: string;
  userAction?: 'RETRY' | 'RE_AUTH' | 'CONTACT_ADMIN' | 'FIX_INPUT';
  cause?: unknown;
}

/**
 * Telemetry data structure returned from ThingsBoard
 */
export interface WaterTankTelemetryData {
  deviceId: string;
  telemetry: WaterTankDataPoint[];
  summary: {
    currentLevel?: number;         // Most recent level reading (%)
    avgLevel: number;              // Average level over period (%)
    minLevel: number;              // Minimum level (%)
    maxLevel: number;              // Maximum level (%)
    totalReadings: number;         // Number of data points
    firstReadingTs?: number;       // Timestamp of first reading
    lastReadingTs?: number;        // Timestamp of last reading
  };
  metadata: {
    keys: string[];                // Telemetry keys that were fetched
    aggregation: string;           // Aggregation method used
    limit: number;                 // Data point limit applied
  };
}

/**
 * Single telemetry data point
 */
export interface WaterTankDataPoint {
  ts: number;                      // Timestamp in milliseconds
  value: number;                   // Water level value (0-100%)
  key?: string;                    // Telemetry key name
}

/**
 * Internationalization strings
 */
export interface WaterTankModalI18n {
  title: string;
  loading: string;
  error: string;
  noData: string;
  exportCsv: string;
  close: string;
  currentLevel: string;
  averageLevel: string;
  minLevel: string;
  maxLevel: string;
  dateRange: string;
  deviceInfo: string;
  levelChart: string;
  percentUnit: string;
  status: {
    critical: string;              // < 20%
    low: string;                   // 20-40%
    medium: string;                // 40-70%
    good: string;                  // 70-90%
    full: string;                  // > 90%
  };
}

/**
 * Style overrides for modal customization
 */
export interface WaterTankModalStyleOverrides {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderRadius: string;
  fontFamily: string;
  modalWidth: string;
  modalHeight: string;
  levelColors?: {
    critical: string;              // < 20%
    low: string;                   // 20-40%
    medium: string;                // 40-70%
    good: string;                  // 70-90%
    full: string;                  // > 90%
  };
}

/**
 * Configuration for ThingsBoard telemetry API calls
 */
export interface TelemetryApiConfig {
  tbApiHost: string;
  tbJwtToken: string;
  deviceId: string;
  keys: string[];
  startTs: number;
  endTs: number;
  aggregation?: string;
  limit?: number;
}

/**
 * Raw response from ThingsBoard telemetry API
 */
export interface ThingsBoardTelemetryResponse {
  [key: string]: Array<{
    ts: number;
    value: string | number;
  }>;
}

/**
 * Configuration for the water tank modal view
 */
export interface WaterTankViewConfig {
  context: WaterTankModalContext;
  params: OpenDashboardPopupWaterTankOptions;
  onExport: () => void;
  onError: (error: WaterTankModalError) => void;
  onClose: () => void;
}
