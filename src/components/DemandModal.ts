/**
 * Demand Modal Component for MYIO JS Library
 * RFC 0015: Demand Modal Component (with Token Injection)
 * RFC 0061: Telemetry Key Selection for Demand Modal
 *
 * Displays a fully-styled modal with demand/consumption line chart over time.
 * Fetches telemetry data from ThingsBoard REST API using token-based authentication.
 * Supports dynamic telemetry type switching (Power A/B/C, Current A/B/C, Voltage A/B/C, Total Power).
 */

// Import telemetry utilities
import { detectTelemetryType, getCacheKey, getCachedData, setCachedData } from '../utils/telemetryUtils';

// Type definitions
/**
 * Telemetry type configuration
 * Defines the structure for different telemetry measurements
 */
export interface TelemetryType {
  id: string;                              // Unique identifier
  label: string;                           // Display name (localized)
  keys: string | string[];                 // ThingsBoard telemetry keys
  defaultAggregation: 'AVG' | 'MAX' | 'MIN' | 'SUM'; // Default aggregation function
  unit: string;                            // Measurement unit (kW, A, V)
  color: string | string[];                // Chart color(s) - array for multi-phase
}

/**
 * Available telemetry types for demand modal
 */
export const TELEMETRY_TYPES: Record<string, TelemetryType> = {
  total_power: {
    id: 'total_power',
    label: 'Potência Total',
    keys: 'consumption',
    defaultAggregation: 'MAX',
    unit: 'kW',
    color: '#4A148C'
  },
  power_phases: {
    id: 'power_phases',
    label: 'Potência A, B, C',
    keys: ['a', 'b', 'c'],
    defaultAggregation: 'MAX',
    unit: 'kW',
    color: ['#FF5722', '#4CAF50', '#2196F3']
  },
  current_phases: {
    id: 'current_phases',
    label: 'Corrente A, B, C',
    keys: ['current_a', 'current_b', 'current_c'],
    defaultAggregation: 'AVG',
    unit: 'A',
    color: ['#FF5722', '#4CAF50', '#2196F3']
  },
  voltage_phases: {
    id: 'voltage_phases',
    label: 'Tensão A, B, C',
    keys: ['voltage_a', 'voltage_b', 'voltage_c'],
    defaultAggregation: 'AVG',
    unit: 'V',
    color: ['#FF5722', '#4CAF50', '#2196F3']
  }
};

export interface DemandModalParams {
  // Required parameters
  token: string;                       // JWT token for ThingsBoard authentication
  deviceId: string;                    // ThingsBoard device UUID
  startDate: string;                   // ISO datetime string "YYYY-MM-DDTHH:mm:ss±HH:mm"
  endDate: string;                     // ISO datetime string "YYYY-MM-DDTHH:mm:ss±HH:mm"

  // Optional parameters
  label?: string;                      // Device/store label (default: "Dispositivo")
  container?: HTMLElement | string;    // Mount container (default: document.body)
  onClose?: () => void;                // Callback when modal closes
  locale?: 'pt-BR' | 'en-US' | string; // Locale for formatting (default: 'pt-BR')
  pdf?: DemandModalPdfConfig;          // PDF export configuration
  styles?: Partial<DemandModalStyles>; // Style customization tokens
  fetcher?: TelemetryFetcher;          // Optional custom fetcher for testing/mocking
  telemetryQuery?: TelemetryQueryParams; // ThingsBoard API query parameters
  yAxisLabel?: string;                 // Custom Y-axis label (default: "Demanda (kW)")
  correctionFactor?: number;           // Value multiplier (default: 1.0)
  timezoneOffset?: number;             // Timezone offset in hours (default: -3 for UTC-3/Brazil)
  readingType?: 'energy' | 'water' | 'temperature'; // RFC-0083: Reading type for formatting (default: 'energy')

  // RFC-0061: Telemetry selector configuration
  allowTelemetrySwitch?: boolean;      // Enable telemetry type switching (default: true)
  availableTelemetryTypes?: string[];  // Limit available types by ID (default: all types)

  // RFC-0082: Real-time mode configuration
  enableRealTimeMode?: boolean;        // Allow real-time toggle (default: true)
  realTimeInterval?: number;           // Update interval in ms (default: 8000)
  realTimeAutoScroll?: boolean;        // Auto-scroll to latest data (default: true)
}

// ThingsBoard telemetry query parameters
export interface TelemetryQueryParams {
  keys?: string;                       // Telemetry keys (default: "consumption")
  limit?: number;                      // Maximum number of data points (ONLY used when agg=NONE)
  intervalType?: string;               // Interval type (default: "MILLISECONDS")
  interval?: number;                   // Interval value (default: 86400000 - 24 hours)
  agg?: string;                        // Aggregation function (default: "MAX")
  orderBy?: string;                    // Sort order (default: "ASC")
}

// Type for custom telemetry fetcher
export type TelemetryFetcher = (params: {
  token: string;
  deviceId: string;
  startDate: string;
  endDate: string;
  telemetryQuery?: TelemetryQueryParams; // Pass telemetryQuery to custom fetcher
}) => Promise<any>; // Return type changed to any to handle multiple keys

export interface DemandModalPdfConfig {
  enabled?: boolean;                   // Enable PDF export (default: true)
  fileName?: string;                   // Custom filename (default: auto-generated)
}

export interface DemandModalStyles {
  // Color tokens
  primaryColor: string;                // Main purple color (#4A148C)
  accentColor: string;                 // Yellow highlight color (#FFC107)
  dangerColor: string;                 // Error state color (#f44336)
  infoColor: string;                   // Info elements color (#2196F3)
  textPrimary: string;                 // Primary text color
  textSecondary: string;               // Secondary text color
  backgroundColor: string;             // Modal background
  overlayColor: string;                // Backdrop overlay color
  
  // Layout tokens
  borderRadius: string;                // Card border radius (8px)
  buttonRadius: string;                // Button border radius (6px)
  pillRadius: string;                  // Pill border radius (20px)
  zIndex: number;                      // Modal z-index (10000)
  
  // Spacing tokens
  spacingXs: string;                   // 4px
  spacingSm: string;                   // 8px
  spacingMd: string;                   // 16px
  spacingLg: string;                   // 24px
  spacingXl: string;                   // 32px
  
  // Typography tokens
  fontFamily: string;                  // Font family
  fontSizeXs: string;                  // 12px
  fontSizeSm: string;                  // 14px
  fontSizeMd: string;                  // 16px
  fontSizeLg: string;                  // 18px
  fontSizeXl: string;                  // 20px
  fontWeight: string;                  // Normal weight
  fontWeightBold: string;              // Bold weight
}

export interface DemandModalInstance {
  destroy(): void;                     // Clean up modal and resources
}

interface MultiSeriesDataPoint {
  x: number;                           // Timestamp in milliseconds
  y: number;                           // Corrected value
}

interface DemandPeak {
  value: number;                       // Peak demand value in kW
  timestamp: number;                   // Timestamp of peak in milliseconds
  formattedValue: string;              // Formatted value with units
  formattedTime: string;               // Formatted timestamp
  key?: string;                        // Key name for multi-series peak
}

interface SeriesData {
  key: string;                         // Telemetry key name
  label: string;                       // Display label for the series
  points: MultiSeriesDataPoint[];      // Data points for this series
  peak: DemandPeak | null;             // Peak for this specific series
  color: string;                       // Chart line color
}

interface MultiSeriesChartData {
  series: SeriesData[];                // Array of all series
  globalPeak: DemandPeak | null;       // Overall peak across all series
  isEmpty: boolean;                    // Whether all series are empty
}

// Default styles
const DEFAULT_STYLES: DemandModalStyles = {
  primaryColor: '#4A148C',
  accentColor: '#EDE7F3',
  dangerColor: '#f44336',
  infoColor: '#2196F3',
  textPrimary: '#212121',
  textSecondary: '#757575',
  backgroundColor: '#ffffff',
  overlayColor: 'rgba(0, 0, 0, 0.5)',
  borderRadius: '8px',
  buttonRadius: '6px',
  pillRadius: '20px',
  zIndex: 10000,
  spacingXs: '4px',
  spacingSm: '8px',
  spacingMd: '16px',
  spacingLg: '24px',
  spacingXl: '32px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSizeXs: '12px',
  fontSizeSm: '14px',
  fontSizeMd: '16px',
  fontSizeLg: '18px',
  fontSizeXl: '20px',
  fontWeight: '400',
  fontWeightBold: '600'
};

// External library CDN URLs
const CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
const ZOOM_PLUGIN_CDN = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js';
const JSPDF_VERSION = '2.5.1';
const JSPDF_CDN = `https://cdnjs.cloudflare.com/ajax/libs/jspdf/${JSPDF_VERSION}/jspdf.umd.min.js`;

// Global state for library loading
let chartJsLoaded = false;
let zoomPluginLoaded = false;
let jsPdfLoaded = false;
let _jspdfPromise: Promise<void> | null = null;
let cssInjected = false;

// Localization strings
const STRINGS = {
  'pt-BR': {
    title: 'Demanda',
    period: 'Período',
    maximum: 'Máxima',
    at: 'em',
    exportPdf: 'Exportar PDF',
    exportCsv: 'Exportar CSV',
    fullscreen: 'Tela cheia',
    close: 'Fechar',
    resetZoom: 'Reset Zoom',
    loading: 'Carregando dados...',
    noData: 'Sem pontos de demanda no período selecionado',
    error: 'Erro ao carregar dados',
    zoomHelp: 'Scroll: zoom | Arraste: mover | Ctrl+Arraste: selecionar',
    demand: 'Demanda (kW)',
    reportTitle: 'Relatório de Demanda',
    reportFooter: 'MyIO Energy Management System',
    startDate: 'Data Inicial',
    endDate: 'Data Final',
    updatePeriod: 'Atualizar',
    invalidDateRange: 'Data final deve ser maior que data inicial',
    maxRangeExceeded: 'Período máximo de 30 dias',
    telemetryType: 'Tipo de Telemetria'
  },
  'en-US': {
    title: 'Demand',
    period: 'Period',
    maximum: 'Maximum',
    at: 'on',
    exportPdf: 'Export PDF',
    exportCsv: 'Export CSV',
    fullscreen: 'Fullscreen',
    close: 'Close',
    resetZoom: 'Reset Zoom',
    loading: 'Loading data...',
    noData: 'No demand points in the selected period',
    error: 'Error loading data',
    zoomHelp: 'Scroll: zoom | Drag: pan | Ctrl+Drag: select',
    demand: 'Demand (kW)',
    reportTitle: 'Demand Report',
    reportFooter: 'MyIO Energy Management System',
    startDate: 'Start Date',
    endDate: 'End Date',
    updatePeriod: 'Update',
    invalidDateRange: 'End date must be greater than start date',
    maxRangeExceeded: 'Maximum range of 30 days',
    telemetryType: 'Telemetry Type'
  }
};

/**
 * Load external library dynamically
 */
async function loadScript(url: string, checkGlobal: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any)[checkGlobal]) {
      resolve();
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector(`script[src="${url}"]`);
    if (existingScript) {
      // Wait for existing script to load
      existingScript.addEventListener('load', () => {
        if ((window as any)[checkGlobal]) {
          resolve();
        } else {
          reject(new Error(`Library ${checkGlobal} not available after loading ${url}`));
        }
      });
      existingScript.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)));
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.onload = () => {
      if ((window as any)[checkGlobal]) {
        resolve();
      } else {
        reject(new Error(`Library ${checkGlobal} not available after loading ${url}`));
      }
    };
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });
}

/**
 * Load all required external libraries
 */
async function loadExternalLibraries(): Promise<void> {
  try {
    // Load Chart.js
    if (!chartJsLoaded) {
      await loadScript(CHART_JS_CDN, 'Chart');
      chartJsLoaded = true;
    }

    // Load zoom plugin
    if (!zoomPluginLoaded) {
      await loadScript(ZOOM_PLUGIN_CDN, 'ChartZoom');
      zoomPluginLoaded = true;
    }

    // Load jsPDF
    if (!jsPdfLoaded) {
      await ensureJsPDF();
      jsPdfLoaded = true;
    }
  } catch (error) {
    throw new Error(`Failed to load external libraries: ${error}`);
  }
}

/**
 * Ensures jsPDF is loaded and available.
 */
function ensureJsPDF(): Promise<void> {
  if (window.jspdf?.jsPDF) {
    console.info('jsPDF already loaded.');
    return Promise.resolve();
  }
  if (_jspdfPromise) {
    console.info('jsPDF loading already in progress.');
    return _jspdfPromise;
  }

  _jspdfPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-lib="jspdf"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.jspdf?.jsPDF) {
          console.info('jsPDF loaded via existing script.');
          resolve();
        } else {
          reject(new Error('jsPDF loaded but window.jspdf.jsPDF missing'));
        }
      });
      existing.addEventListener('error', () => reject(new Error('Failed to load jsPDF via existing script')));
      return;
    }

    const s = document.createElement('script');
    s.src = JSPDF_CDN;
    s.async = true;
    s.defer = true;
    s.dataset.lib = 'jspdf';
    s.onload = () => {
      if (window.jspdf?.jsPDF) {
        console.info('jsPDF loaded successfully.');
        resolve();
      } else {
        reject(new Error('jsPDF loaded but window.jspdf.jsPDF missing'));
      }
    };
    s.onerror = () => reject(new Error('Failed to load jsPDF from CDN'));
    document.head.appendChild(s);
  }).finally(() => {
    _jspdfPromise = null; // Clear promise after resolution/rejection
  });

  return _jspdfPromise;
}

/**
 * Resolves the jsPDF constructor from the window object.
 */
function getJsPDFCtor(): typeof window.jspdf.jsPDF {
  // Primary (OLD working)
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  // Defensive fallback if future versions change global shape
  if ((window as any).jsPDF?.jsPDF) return (window as any).jsPDF.jsPDF;
  if ((window as any).jsPDF) return (window as any).jsPDF;
  throw new Error('jsPDF constructor not found on window');
}

/**
 * Safely saves the PDF, with a Blob URL fallback for restrictive environments.
 */
function savePdfSafe(doc: any, filename: string) {
  try {
    doc.save(filename); // preferred path
  } catch (e) {
    console.warn('doc.save() failed, attempting Blob URL fallback:', e);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank') || alert('Pop-up blocked. Allow pop-ups to download the PDF.');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

/**
 * Adds a Chart.js canvas to the PDF document, handling scaling.
 */
function addCanvasToPdf(doc: any, canvas: HTMLCanvasElement, x = 10, y = 20, maxWmm = 190) {
  const img = canvas.toDataURL('image/png', 1.0); // High quality PNG
  const pageWmm = doc.internal.pageSize.getWidth();
  const mmW = Math.min(maxWmm, pageWmm - x * 2);
  const mmH = (canvas.height / canvas.width) * mmW; // Maintain aspect ratio
  doc.addImage(img, 'PNG', x, y, mmW, mmH, undefined, 'FAST');
  return y + mmH;
}

/**
 * Ensures there is enough room on the current PDF page, adding a new page if necessary.
 */
function ensureRoom(doc: any, nextY: number, minRoom = 40) {
  const h = doc.internal.pageSize.getHeight();
  if (nextY + minRoom > h) {
    doc.addPage();
    return 20; // Start at top of new page
  }
  return nextY;
}

/**
 * Inject CSS styles for the modal
 */
function injectCSS(styles: DemandModalStyles): void {
  if (cssInjected) return;

  const css = `
    .myio-demand-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: ${styles.overlayColor};
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: ${styles.zIndex};
      font-family: ${styles.fontFamily};
      font-size: ${styles.fontSizeMd};
      color: ${styles.textPrimary};
    }

    .myio-demand-modal-card {
      background: ${styles.backgroundColor};
      border-radius: ${styles.borderRadius};
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      max-width: 90vw;
      max-height: 90vh;
      width: 1040px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .myio-demand-modal-card.fullscreen {
      width: 100vw;
      height: 100vh;
      max-width: 100vw;
      max-height: 100vh;
      border-radius: 0;
    }

    .myio-demand-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${styles.spacingMd};
      background: #4A148C;
      color: white;
    }

    .myio-demand-modal-title-section {
      display: flex;
      align-items: center;
      gap: ${styles.spacingSm};
    }

    .myio-demand-modal-icon {
      font-size: ${styles.fontSizeLg};
    }

    .myio-demand-modal-title {
      margin: 0;
      font-size: ${styles.fontSizeLg};
      font-weight: ${styles.fontWeightBold};
    }

    .myio-demand-modal-actions {
      display: flex;
      gap: ${styles.spacingSm};
    }

    .myio-demand-modal-btn {
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: ${styles.spacingSm} ${styles.spacingMd};
      border-radius: ${styles.buttonRadius};
      cursor: pointer;
      font-size: ${styles.fontSizeSm};
      font-family: inherit;
      transition: background-color 0.2s;
    }

    .myio-demand-modal-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .myio-demand-modal-btn:focus {
      outline: 2px solid white;
      outline-offset: 2px;
    }

    .myio-demand-modal-btn-close {
      font-size: ${styles.fontSizeLg};
      padding: ${styles.spacingSm};
      min-width: 32px;
      background: ${styles.dangerColor} !important;
    }

    .myio-demand-modal-btn-close:hover {
      background: #d32f2f !important;
    }

    .myio-demand-modal-period {
      padding: ${styles.spacingMd} ${styles.spacingLg};
      background: #f5f5f5;
      font-size: ${styles.fontSizeSm};
      color: ${styles.textSecondary};
      border-bottom: 1px solid #e0e0e0;
    }

    .myio-demand-modal-period-selector {
      display: flex;
      align-items: center;
      gap: ${styles.spacingMd};
      padding: ${styles.spacingMd} ${styles.spacingLg};
      background: #f9f9f9;
      border-bottom: 1px solid #e0e0e0;
      flex-wrap: wrap;
    }

    .myio-demand-modal-period-selector label {
      display: flex;
      flex-direction: column;
      gap: ${styles.spacingXs};
      font-size: ${styles.fontSizeSm};
      color: ${styles.textPrimary};
      font-weight: ${styles.fontWeightBold};
    }

    .myio-demand-modal-date-input {
      padding: ${styles.spacingSm};
      border: 1px solid #ccc;
      border-radius: ${styles.buttonRadius};
      font-size: ${styles.fontSizeSm};
      font-family: inherit;
      min-width: 150px;
    }

    .myio-demand-modal-date-input:focus {
      outline: 2px solid ${styles.primaryColor};
      outline-offset: 1px;
    }

    /* RFC-0061: Telemetry selector styles */
    .myio-demand-modal-select {
      padding-right: 32px;
      background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="%23333"><path d="M4 6l4 4 4-4z"/></svg>');
      background-repeat: no-repeat;
      background-position: right 8px center;
      background-size: 16px;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
    }

    .myio-demand-modal-select:hover {
      border-color: ${styles.primaryColor};
      background-color: #fafafa;
    }

    .myio-demand-modal-select:focus {
      outline: 2px solid ${styles.primaryColor};
      outline-offset: 1px;
      box-shadow: 0 0 0 3px rgba(74, 20, 140, 0.1);
    }

    .myio-demand-modal-select:disabled {
      background-color: #f5f5f5;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .myio-demand-modal-btn-update {
      background: ${styles.primaryColor};
      border: none;
      color: white;
      padding: ${styles.spacingSm} ${styles.spacingMd};
      border-radius: ${styles.buttonRadius};
      cursor: pointer;
      font-size: ${styles.fontSizeSm};
      font-family: inherit;
      font-weight: ${styles.fontWeightBold};
      align-self: flex-end;
      margin-bottom: 2px;
    }

    .myio-demand-modal-btn-update:hover {
      background: #6A1B9A;
    }

    .myio-demand-modal-btn-update:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    /* RFC-0082: Real-time button styles */
    .myio-demand-modal-btn-realtime {
      background: transparent;
      border: 2px solid #666;
      color: #666;
      padding: ${styles.spacingSm} ${styles.spacingMd};
      border-radius: ${styles.buttonRadius};
      cursor: pointer;
      font-size: ${styles.fontSizeSm};
      font-family: inherit;
      font-weight: ${styles.fontWeightBold};
      align-self: flex-end;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.3s ease;
      white-space: nowrap;
    }

    .myio-demand-modal-btn-realtime:hover {
      border-color: #999;
      color: #999;
    }

    .myio-demand-modal-btn-realtime.active {
      background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%);
      border-color: #d32f2f;
      color: white;
      box-shadow: 0 0 12px rgba(244, 67, 54, 0.5);
    }

    .myio-demand-modal-btn-realtime.active:hover {
      background: linear-gradient(135deg, #c62828 0%, #e53935 100%);
    }

    .realtime-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #666;
      transition: all 0.3s ease;
    }

    .myio-demand-modal-btn-realtime.active .realtime-indicator {
      background: white;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.2); }
    }

    .myio-demand-modal-btn-realtime.active .realtime-text::before {
      content: "AO VIVO";
    }

    .myio-demand-modal-btn-realtime:not(.active) .realtime-text::before {
      content: "REAL TIME";
    }

    .realtime-text {
      font-size: 0; /* Hide original text, use ::before pseudo-element */
    }

    .myio-demand-modal-period-error {
      flex-basis: 100%;
      color: ${styles.dangerColor};
      font-size: ${styles.fontSizeXs};
      margin-top: -${styles.spacingSm};
    }

    .myio-demand-modal-peak {
      margin: ${styles.spacingMd} ${styles.spacingLg} 0;
      padding: ${styles.spacingSm} ${styles.spacingMd};
      background: ${styles.accentColor};
      color: #333;
      border-radius: ${styles.pillRadius};
      font-size: ${styles.fontSizeSm};
      font-weight: ${styles.fontWeightBold};
      display: inline-block;
      width: fit-content;
    }

    .myio-demand-modal-content {
      flex: 1;
      padding: ${styles.spacingLg};
      display: flex;
      flex-direction: column;
      min-height: 400px;
    }

    .myio-demand-modal-chart-container {
      flex: 1;
      position: relative;
      min-height: 300px;
    }

    .myio-demand-modal-chart {
      width: 100% !important;
      height: 100% !important;
    }

    .myio-demand-modal-zoom-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: ${styles.spacingMd};
      padding-top: ${styles.spacingMd};
      border-top: 1px solid #e0e0e0;
    }

    .myio-demand-modal-btn-reset {
      background: ${styles.infoColor};
      border: none;
      color: white;
      padding: ${styles.spacingSm} ${styles.spacingMd};
      border-radius: ${styles.buttonRadius};
      cursor: pointer;
      font-size: ${styles.fontSizeSm};
      font-family: inherit;
    }

    .myio-demand-modal-btn-reset:hover {
      background: #1976D2;
    }

    .myio-demand-modal-zoom-help {
      font-size: ${styles.fontSizeXs};
      color: ${styles.textSecondary};
    }

    .myio-demand-modal-loading,
    .myio-demand-modal-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: ${styles.spacingXl};
      text-align: center;
    }

    .myio-demand-modal-spinner {
      font-size: 2rem;
      animation: spin 1s linear infinite;
      margin-bottom: ${styles.spacingMd};
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .myio-demand-modal-loading-text {
      color: ${styles.textSecondary};
    }

    .myio-demand-modal-error-icon {
      font-size: 2rem;
      color: ${styles.dangerColor};
      margin-bottom: ${styles.spacingMd};
    }

    .myio-demand-modal-error-text {
      color: ${styles.dangerColor};
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .myio-demand-modal-card {
        width: 95vw;
        height: 90vh;
        max-height: 90vh;
      }

      .myio-demand-modal-header {
        padding: ${styles.spacingMd};
      }

      .myio-demand-modal-title {
        font-size: ${styles.fontSizeMd};
      }

      .myio-demand-modal-actions {
        gap: ${styles.spacingXs};
      }

      .myio-demand-modal-btn {
        padding: ${styles.spacingXs} ${styles.spacingSm};
        font-size: ${styles.fontSizeXs};
      }

      .myio-demand-modal-content {
        padding: ${styles.spacingMd};
      }
    }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  cssInjected = true;
}

/**
 * Format date according to locale
 */
function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Format date according to locale (without time)
 */
function formatDateTime(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * RFC-0083: Interpolate temperature data to have points every 30 minutes
 * Uses last known value (step interpolation)
 */
function interpolateTemperatureData(rawPoints: MultiSeriesDataPoint[]): MultiSeriesDataPoint[] {
  if (rawPoints.length === 0) return [];

  const interpolated: MultiSeriesDataPoint[] = [];
  const interval = 30 * 60 * 1000; // 30 minutes in milliseconds

  // Sort by timestamp
  const sorted = [...rawPoints].sort((a, b) => a.x - b.x);

  // Get time range
  const startTime = sorted[0].x;
  const endTime = sorted[sorted.length - 1].x;

  let lastKnownValue = sorted[0].y;
  let dataIndex = 0;

  // Generate points every 30 minutes
  for (let time = startTime; time <= endTime; time += interval) {
    // Find if we have actual data at this time (±5 min tolerance)
    const actualPoint = sorted.find((p, idx) => {
      if (idx >= dataIndex && Math.abs(p.x - time) < 5 * 60 * 1000) {
        dataIndex = idx + 1;
        return true;
      }
      return false;
    });

    if (actualPoint) {
      lastKnownValue = actualPoint.y;
      interpolated.push({ x: time, y: lastKnownValue });
    } else {
      // Use last known value (step interpolation)
      interpolated.push({ x: time, y: lastKnownValue });
    }
  }

  return interpolated;
}

/**
 * Fetch telemetry data from ThingsBoard
 */
async function fetchTelemetryData(
  token: string,
  deviceId: string,
  startDate: string,
  endDate: string,
  queryParams?: TelemetryQueryParams
): Promise<any> { // Changed return type to any to handle full response object
  const startTs = new Date(startDate).getTime();
  const endTs = new Date(endDate).getTime();

  // Use provided parameters or defaults
  const keys = queryParams?.keys || 'consumption';
  const intervalType = queryParams?.intervalType || 'MILLISECONDS';
  const interval = queryParams?.interval || 86400000; // 24 hours in milliseconds
  const agg = queryParams?.agg || 'MAX';
  const orderBy = queryParams?.orderBy || 'ASC';

  // Build URL - only include limit when agg=NONE
  let url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?` +
    `keys=${keys}&startTs=${startTs}&endTs=${endTs}&` +
    `intervalType=${intervalType}&interval=${interval}&agg=${agg}&orderBy=${orderBy}`;

  // Add limit only when aggregation is NONE (per ThingsBoard API docs)
  if (agg === 'NONE' && queryParams?.limit) {
    url += `&limit=${queryParams.limit}`;
  }

  const response = await fetch(url, {
    headers: {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data; // Return the full data object
}

/**
 * Process telemetry data into multi-series chart format
 */
function processMultiSeriesChartData(
  rawData: any, // Full API response object
  keys: string,
  correctionFactor: number,
  locale: string,
  aggregation?: string, // Add aggregation type to determine processing method
  timezoneOffset?: number // Timezone offset in hours (default: -3)
): MultiSeriesChartData {
  const seriesKeys = keys.split(',').map(k => k.trim());
  const seriesData: SeriesData[] = [];
  let globalPeak: DemandPeak | null = null;
  let isEmpty = true;

  // Default timezone offset: -3 hours (Brazil/São Paulo)
  const tzOffset = timezoneOffset !== undefined ? timezoneOffset : -3;
  const tzOffsetMs = tzOffset * 60 * 60 * 1000;

  // Predefined color palette
  const colors = ['#4A148C', '#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#795548', '#607D8B'];

  seriesKeys.forEach((key, index) => {
    const rawSeries = rawData[key] || [];
    if (rawSeries.length === 0) {
      seriesData.push({ key, label: key, points: [], peak: null, color: colors[index % colors.length] });
      return;
    }

    isEmpty = false;

    // Sort by timestamp
    const sortedData = rawSeries.sort((a: any, b: any) => a.ts - b.ts);

    const points: MultiSeriesDataPoint[] = [];

    // Check if data is already aggregated (MAX, AVG, etc.) or raw (NONE)
    const isAggregated = aggregation && aggregation !== 'NONE';

    if (isAggregated) {
      // Data is already aggregated - use values directly
      for (let i = 0; i < sortedData.length; i++) {
        const current = sortedData[i];
        const value = parseFloat(current.value) * correctionFactor;
        // Apply timezone offset to convert UTC to local time
        const timestamp = current.ts + tzOffsetMs;

        points.push({
          x: timestamp,
          y: value
        });
      }
    } else {
      // Data is raw - calculate demand from consumption deltas
      let previousValue = 0;
      let previousTs = 0;

      for (let i = 0; i < sortedData.length; i++) {
        const current = sortedData[i];
        const currentValue = parseFloat(current.value);
        const currentTs = current.ts;

        if (i > 0) {
          const deltaWh = currentValue - previousValue;
          const deltaHours = (currentTs - previousTs) / (1000 * 60 * 60);

          // Only include positive deltas (ignore meter resets)
          if (deltaWh > 0 && deltaHours > 0) {
            const demandKw = (deltaWh / 1000 / deltaHours) * correctionFactor;
            // Apply timezone offset to convert UTC to local time
            const timestamp = currentTs + tzOffsetMs;
            points.push({
              x: timestamp,
              y: demandKw
            });
          }
        }

        previousValue = currentValue;
        previousTs = currentTs;
      }
    }

    // Find peak demand for this series
    let seriesPeak: DemandPeak | null = null;
    if (points.length > 0) {
      const maxPoint = points.reduce((max, point) =>
        point.y > max.y ? point : max
      );

      seriesPeak = {
        value: maxPoint.y,
        timestamp: maxPoint.x,
        formattedValue: maxPoint.y.toFixed(2),
        formattedTime: formatDateTime(new Date(maxPoint.x), locale),
        key: key
      };

      // Update global peak if this series' peak is higher
      if (!globalPeak || seriesPeak.value > globalPeak.value) {
        globalPeak = seriesPeak;
      }
    }

    seriesData.push({
      key,
      label: key, // Use key as label for now, can be customized later
      points,
      peak: seriesPeak,
      color: colors[index % colors.length]
    });
  });

  return {
    series: seriesData,
    globalPeak,
    isEmpty
  };
}

/**
 * Create focus trap for modal
 */
function createFocusTrap(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  function handleTabKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }

  container.addEventListener('keydown', handleTabKey);
  firstElement?.focus();

  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
}

/**
 * Generate PDF report
 */
async function generatePdfReport(
  chartData: MultiSeriesChartData,
  params: DemandModalParams,
  strings: any,
  chartCanvas: HTMLCanvasElement
): Promise<void> {
  const JsPDF = getJsPDFCtor();
  const doc = new JsPDF('p', 'mm', 'a4');

  // Header
  doc.setFontSize(20);
  doc.setTextColor(74, 20, 140); // MyIO purple
  doc.text(strings.reportTitle, 20, 20);

  // Device info
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  const label = params.label || 'Dispositivo';
  doc.text(`${strings.title} - ${label}`, 20, 35);
  
  const startDate = formatDate(new Date(params.startDate), params.locale || 'pt-BR');
  const endDate = formatDate(new Date(params.endDate), params.locale || 'pt-BR');
  doc.text(`${strings.period}: ${startDate} - ${endDate}`, 20, 45);

  // Peak info
  let currentY = 55;
  if (chartData.globalPeak) {
    const peak = chartData.globalPeak;
    doc.setFontSize(12);
    doc.setTextColor(255, 152, 0); // Orange for peak
    doc.text(
      `${strings.maximum}: ${peak.formattedValue} kW ${peak.key ? `(${peak.key}) ` : ''}${strings.at} ${peak.formattedTime}`,
      20, currentY
    );
    currentY += 10;
  }

  // Chart image
  currentY = ensureRoom(doc, currentY, 120); // Ensure room for chart
  currentY = addCanvasToPdf(doc, chartCanvas, 20, currentY);
  currentY += 10; // Add some padding after chart

  // Sample data table
  if (chartData.series.length > 0 && chartData.series[0].points.length > 0) {
    currentY = ensureRoom(doc, currentY, 60); // Ensure room for table header and a few rows
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Amostra de Dados:', 20, currentY);
    currentY += 10;
    
    const samplePoints = chartData.series[0].points.slice(0, 10); // Take sample from first series

    doc.setFontSize(10);
    doc.text('Data', 20, currentY);
    doc.text(params.yAxisLabel || strings.demand, 100, currentY);
    currentY += 7; // Smaller increment for table rows

    samplePoints.forEach(point => {
      currentY = ensureRoom(doc, currentY, 10); // Ensure room for each row
      const dateStr = formatDate(new Date(point.x), params.locale || 'pt-BR');
      doc.text(dateStr, 20, currentY);
      doc.text(point.y.toFixed(2), 100, currentY);
      currentY += 7;
    });
  }

  // Footer
  currentY = ensureRoom(doc, currentY, 20); // Ensure room for footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128); // Grey for footer
  doc.text(`${strings.reportFooter}`, 20, doc.internal.pageSize.getHeight() - 15);
  doc.text(`Gerado em: ${new Date().toLocaleString(params.locale || 'pt-BR')}`, 20, doc.internal.pageSize.getHeight() - 10);

  // Download
  const fileName = params.pdf?.fileName || 
    `demanda_${label.replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.pdf`;
  savePdfSafe(doc, fileName);
}

/**
 * Main function to open demand modal
 */
export async function openDemandModal(params: DemandModalParams): Promise<DemandModalInstance> {
  // Validate required parameters
  if (!params.token || !params.deviceId || !params.startDate || !params.endDate) {
    throw new Error('Missing required parameters: token, deviceId, startDate, endDate');
  }

  // Merge styles with defaults
  const styles = { ...DEFAULT_STYLES, ...params.styles };
  const locale = params.locale || 'pt-BR';
  const strings = STRINGS[locale as keyof typeof STRINGS] || STRINGS['pt-BR'];

  // Load external libraries
  await loadExternalLibraries();

  // Inject CSS
  injectCSS(styles);

  // Get container
  const container = typeof params.container === 'string' 
    ? document.querySelector(params.container) as HTMLElement
    : params.container || document.body;

  if (!container) {
    throw new Error('Container element not found');
  }

  // Create modal DOM
  const overlay = document.createElement('div');
  overlay.className = 'myio-demand-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'modal-title');

  const label = params.label || 'Dispositivo';

  // RFC-0061: Setup telemetry selector configuration
  const allowTelemetrySwitch = params.allowTelemetrySwitch !== false; // Default: true
  const currentTelemetryType = detectTelemetryType(params.telemetryQuery?.keys);

  // Filter available telemetry types based on configuration
  const availableTypes = params.availableTelemetryTypes
    ? Object.values(TELEMETRY_TYPES).filter(type => params.availableTelemetryTypes!.includes(type.id))
    : Object.values(TELEMETRY_TYPES);

  // Build telemetry selector options HTML
  const telemetrySelectorOptions = availableTypes.map(type =>
    `<option value="${type.id}" ${type.id === currentTelemetryType.id ? 'selected' : ''}>${type.label}</option>`
  ).join('');

  // Telemetry selector HTML (conditionally rendered)
  const telemetrySelectorHTML = allowTelemetrySwitch ? `
    <label>
      ${strings.telemetryType}:
      <select id="telemetry-type-select" class="myio-demand-modal-select myio-demand-modal-date-input" aria-label="${strings.telemetryType}">
        ${telemetrySelectorOptions}
      </select>
    </label>
  ` : '';

  overlay.innerHTML = `
    <div class="myio-demand-modal-card">
      <div class="myio-demand-modal-header">
        <div class="myio-demand-modal-title-section">
          <span class="myio-demand-modal-icon">⚡</span>
          <h2 id="modal-title" class="myio-demand-modal-title">${strings.title} – ${label}</h2>
        </div>
        <div class="myio-demand-modal-actions">
          <button class="myio-demand-modal-btn myio-demand-modal-btn-pdf" type="button" style="display: none;">
            ${strings.exportPdf}
          </button>
          <button class="myio-demand-modal-btn myio-demand-modal-btn-csv" type="button">
            ${strings.exportCsv}
          </button>
          <button class="myio-demand-modal-btn myio-demand-modal-btn-fullscreen" type="button" aria-label="${strings.fullscreen}">
            ⛶
          </button>
          <button class="myio-demand-modal-btn myio-demand-modal-btn-close" type="button" aria-label="${strings.close}">
            ×
          </button>
        </div>
      </div>

      <div class="myio-demand-modal-period-selector">
        <label>
          ${strings.startDate}:
          <input type="date" class="myio-demand-modal-date-input myio-demand-modal-date-start" />
        </label>
        <label>
          ${strings.endDate}:
          <input type="date" class="myio-demand-modal-date-input myio-demand-modal-date-end" />
        </label>
        ${telemetrySelectorHTML}
        <label>
          Intervalo:
          <select id="demand-interval-select" class="myio-demand-modal-select myio-demand-modal-date-input" aria-label="Intervalo">
            <option value="86400000">24 horas</option>
            <option value="3600000">1 hora</option>
            <option value="60000">1 minuto (60s)</option>
          </select>
        </label>
        <label>
          Agregador:
          <select id="demand-agg-select" class="myio-demand-modal-select myio-demand-modal-date-input" aria-label="Agregador">
            <option value="MAX">Máximo</option>
            <option value="AVG">Média</option>
          </select>
        </label>
        <button class="myio-demand-modal-btn-update" type="button">
          ${strings.updatePeriod}
        </button>
        <!-- RFC-0084: REAL TIME button removed - use RealTimeTelemetryModal instead -->
        <div class="myio-demand-modal-period-error" style="display: none;"></div>
      </div>

      <div class="myio-demand-modal-peak" style="display: none;"></div>
      
      <div class="myio-demand-modal-content">
        <div class="myio-demand-modal-chart-container">
          <canvas class="myio-demand-modal-chart"></canvas>
        </div>
        
        <div class="myio-demand-modal-zoom-controls">
          <button class="myio-demand-modal-btn-reset" type="button">
            ${strings.resetZoom}
          </button>
          <div class="myio-demand-modal-zoom-help">
            <small>${strings.zoomHelp}</small>
          </div>
        </div>
      </div>
      
      <div class="myio-demand-modal-loading">
        <div class="myio-demand-modal-spinner">⧗</div>
        <div class="myio-demand-modal-loading-text">${strings.loading}</div>
      </div>
      
      <div class="myio-demand-modal-error" style="display: none;">
        <div class="myio-demand-modal-error-icon">⚠</div>
        <div class="myio-demand-modal-error-text"></div>
      </div>
    </div>
  `;

  container.appendChild(overlay);

  // Get DOM elements
  const card = overlay.querySelector('.myio-demand-modal-card') as HTMLElement;
  const closeBtn = overlay.querySelector('.myio-demand-modal-btn-close') as HTMLButtonElement;
  const fullscreenBtn = overlay.querySelector('.myio-demand-modal-btn-fullscreen') as HTMLButtonElement;
  const pdfBtn = overlay.querySelector('.myio-demand-modal-btn-pdf') as HTMLButtonElement;
  const csvBtn = overlay.querySelector('.myio-demand-modal-btn-csv') as HTMLButtonElement;
  const resetBtn = overlay.querySelector('.myio-demand-modal-btn-reset') as HTMLButtonElement;
  const chartCanvas = overlay.querySelector('.myio-demand-modal-chart') as HTMLCanvasElement;
  const loadingEl = overlay.querySelector('.myio-demand-modal-loading') as HTMLElement;
  const errorEl = overlay.querySelector('.myio-demand-modal-error') as HTMLElement;
  const errorText = overlay.querySelector('.myio-demand-modal-error-text') as HTMLElement;
  const peakEl = overlay.querySelector('.myio-demand-modal-peak') as HTMLElement;
  const contentEl = overlay.querySelector('.myio-demand-modal-content') as HTMLElement;
  const dateStartInput = overlay.querySelector('.myio-demand-modal-date-start') as HTMLInputElement;
  const dateEndInput = overlay.querySelector('.myio-demand-modal-date-end') as HTMLInputElement;
  const updateBtn = overlay.querySelector('.myio-demand-modal-btn-update') as HTMLButtonElement;
  // RFC-0084: Real-time toggle button removed - use RealTimeTelemetryModal instead
  // const realTimeToggleBtn = overlay.querySelector('#realtime-toggle-btn') as HTMLButtonElement;
  const periodErrorEl = overlay.querySelector('.myio-demand-modal-period-error') as HTMLElement;
  const telemetryTypeSelect = overlay.querySelector('#telemetry-type-select') as HTMLSelectElement | null;
  const intervalSelect = overlay.querySelector('#demand-interval-select') as HTMLSelectElement;
  const aggSelect = overlay.querySelector('#demand-agg-select') as HTMLSelectElement;

  // State
  let chart: any = null;
  let chartData: MultiSeriesChartData | null = null;
  let isFullscreen = false;
  let currentStartDate = params.startDate;
  let currentEndDate = params.endDate;
  let activeTelemetryType: TelemetryType = currentTelemetryType; // RFC-0061: Track active telemetry type

  // RFC-0082: Real-time mode state
  let isRealTimeMode = false;                    // Current mode flag
  let realTimeIntervalId: number | null = null;  // Interval timer ID
  let lastFetchedTimestamp: number | null = null; // Last successful fetch timestamp
  let realTimeDataBuffer: any[] = [];            // Accumulated data for today

  // Prevent body scroll
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // Focus trap
  const releaseFocusTrap = createFocusTrap(overlay);

  // Event handlers
  function closeModal() {
    // RFC-0082: Stop real-time mode if active
    if (isRealTimeMode && realTimeIntervalId) {
      window.clearInterval(realTimeIntervalId);
    }

    if (chart) {
      chart.destroy();
    }
    overlay.remove();
    document.body.style.overflow = originalOverflow;
    releaseFocusTrap();
    params.onClose?.();
  }

  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    card.classList.toggle('fullscreen', isFullscreen);
    
    if (chart) {
      setTimeout(() => chart.resize(), 100);
    }
  }

  function resetZoom() {
    if (chart) {
      chart.resetZoom();
    }
  }

  function exportCsv() {
    if (!chartData) {
      alert('Nenhum dado disponível para exportar');
      return;
    }

    const btn = csvBtn;
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Gerando CSV...';

    try {
      // CSV Header with BOM for Excel compatibility
      const BOM = '\uFEFF';
      let csv = BOM + 'Data,Série,Valor (kW)\n';

      // Add data rows
      chartData.series.forEach(series => {
        series.points.forEach(point => {
          const dateStr = formatDate(new Date(point.x), locale);
          const value = point.y.toFixed(2);
          csv += `${dateStr},${series.label},${value}\n`;
        });
      });

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const labelSafe = label.replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `demanda_${labelSafe}_${dateStr}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('[CSV Export] Error:', error);
      alert('Erro ao gerar CSV. Por favor, tente novamente.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }

  async function exportPdf() {
    if (!chartData || !chart) {
      alert('Nenhum dado disponível para exportar');
      return;
    }

    const btn = pdfBtn; // Use the actual PDF button element
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Gerando PDF...';

    try {
      // Ensure jsPDF is loaded
      await ensureJsPDF();
      
      // Wait for fonts to be ready for accurate canvas rendering
      await (document as any).fonts?.ready?.catch((e: any) => console.warn('Font loading interrupted or failed:', e));

      const JsPDF = getJsPDFCtor();
      const doc = new JsPDF('p', 'mm', 'a4');

      // Header
      doc.setFontSize(20);
      doc.setTextColor(74, 20, 140); // MyIO purple
      doc.text(strings.reportTitle, 20, 20);

      // Device info
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      const label = params.label || 'Dispositivo';
      doc.text(`${strings.title} - ${label}`, 20, 35);
      
      const startDate = formatDate(new Date(params.startDate), params.locale || 'pt-BR');
      const endDate = formatDate(new Date(params.endDate), params.locale || 'pt-BR');
      doc.text(`${strings.period}: ${startDate} - ${endDate}`, 20, 45);

      // Peak info
      let currentY = 55;
      if (chartData.globalPeak) {
        const peak = chartData.globalPeak;
        doc.setFontSize(12);
        doc.setTextColor(255, 152, 0); // Orange for peak
        doc.text(
          `${strings.maximum}: ${peak.formattedValue} kW ${peak.key ? `(${peak.key}) ` : ''}${strings.at} ${peak.formattedTime}`,
          20, currentY
        );
        currentY += 10;
      }

      // Chart image
      currentY = ensureRoom(doc, currentY, 120); // Ensure room for chart
      currentY = addCanvasToPdf(doc, chartCanvas, 20, currentY);
      currentY += 10; // Add some padding after chart

      // Sample data table
      if (chartData.series.length > 0 && chartData.series[0].points.length > 0) {
        currentY = ensureRoom(doc, currentY, 60); // Ensure room for table header and a few rows
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Amostra de Dados:', 20, currentY);
        currentY += 10;
        
        const samplePoints = chartData.series[0].points.slice(0, 10); // Take sample from first series

        doc.setFontSize(10);
        doc.text('Data', 20, currentY);
        doc.text(params.yAxisLabel || strings.demand, 100, currentY);
        currentY += 7; // Smaller increment for table rows

        samplePoints.forEach(point => {
          currentY = ensureRoom(doc, currentY, 10); // Ensure room for each row
          const dateStr = formatDate(new Date(point.x), params.locale || 'pt-BR');
          doc.text(dateStr, 20, currentY);
          doc.text(point.y.toFixed(2), 100, currentY);
          currentY += 7;
        });
      }

      // Footer
      currentY = ensureRoom(doc, currentY, 20); // Ensure room for footer
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128); // Grey for footer
      doc.text(`${strings.reportFooter}`, 20, doc.internal.pageSize.getHeight() - 15);
      doc.text(`Gerado em: ${new Date().toLocaleString(params.locale || 'pt-BR')}`, 20, doc.internal.pageSize.getHeight() - 10);

      // Download
      const fileName = params.pdf?.fileName || 
        `demanda_${label.replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.pdf`;
      savePdfSafe(doc, fileName);

    } catch (error) {
      console.error('[PDF Export] Error:', error);
      alert('Erro ao gerar PDF. Por favor, tente novamente. Verifique o console para mais detalhes.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }

  // RFC-0082: Real-time mode functions
  function getTodayStart(): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  }

  function getTodayEnd(): string {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.toISOString();
  }

  async function enableRealTimeMode(): Promise<void> {
    try {
      // 1. Lock dates to today - IMPORTANT: End date must be NOW, not end of day
      currentStartDate = getTodayStart();
      currentEndDate = new Date().toISOString(); // Use current time, not 23:59:59

      // 2. Update date inputs and disable them
      initializeDateInputs();
      dateStartInput.disabled = true;
      dateEndInput.disabled = true;
      dateStartInput.style.opacity = '0.5';
      dateEndInput.style.opacity = '0.5';

      // 3. Disable interval and aggregation selectors
      if (intervalSelect) {
        intervalSelect.disabled = true;
        intervalSelect.style.opacity = '0.5';
      }
      if (aggSelect) {
        aggSelect.disabled = true;
        aggSelect.style.opacity = '0.5';
      }

      // 4. Fix query parameters for real-time mode
      if (intervalSelect) intervalSelect.value = '8000';
      if (aggSelect) aggSelect.value = 'AVG';

      // 5. Initial full fetch from 00:00 to NOW (not end of day)
      await loadData();

      // 6. Update last fetched timestamp
      lastFetchedTimestamp = Date.now();

      // 7. Start auto-update loop
      const intervalMs = params.realTimeInterval || 8000;
      realTimeIntervalId = window.setInterval(async () => {
        try {
          await fetchIncrementalData();
        } catch (error) {
          console.error('[DemandModal] Real-time update failed:', error);
          // Continue loop even on error (retry next interval)
        }
      }, intervalMs);

      // 8. Update button UI
      // RFC-0084: Real-time button removed
      // realTimeToggleBtn.classList.add('active');
      isRealTimeMode = true;

      console.log(`[DemandModal] Real-time mode started (${intervalMs}ms interval)`);
    } catch (error) {
      console.error('[DemandModal] Failed to enable real-time mode:', error);
      // Rollback state
      await disableRealTimeMode();
      alert('Erro ao ativar modo tempo real. Tente novamente.');
    }
  }

  async function fetchIncrementalData(): Promise<void> {
    if (!lastFetchedTimestamp) {
      throw new Error('No last fetched timestamp available');
    }

    const startTs = lastFetchedTimestamp;
    const endTs = Date.now();

    // Convert timestamps to ISO strings for the API
    const startDate = new Date(startTs).toISOString();
    const endDate = new Date(endTs).toISOString();

    // Build telemetry query for incremental fetch
    const keysStr = Array.isArray(activeTelemetryType.keys)
      ? activeTelemetryType.keys.join(',')
      : activeTelemetryType.keys;

    const telemetryQuery: TelemetryQueryParams = {
      keys: keysStr,
      interval: 8000,  // 8 seconds (fixed for real-time mode)
      agg: 'AVG',      // Average (fixed for real-time mode)
      intervalType: 'MILLISECONDS',
      orderBy: 'ASC'
    };

    // Fetch only new data (8 seconds window)
    const newRawData = params.fetcher
      ? await params.fetcher({ token: params.token, deviceId: params.deviceId, startDate, endDate, telemetryQuery })
      : await fetchTelemetryData(params.token, params.deviceId, startDate, endDate, telemetryQuery);

    // Process new data
    const newChartData = processMultiSeriesChartData(
      newRawData,
      keysStr,
      params.correctionFactor || 1.0,
      locale,
      'AVG',
      params.timezoneOffset
    );

    // Append new data points to existing chart (if any new data)
    if (!newChartData.isEmpty && chart && chartData) {
      const Chart = (window as any).Chart;

      newChartData.series.forEach((newSeries, seriesIndex) => {
        if (newSeries.points.length > 0 && chart.data.datasets[seriesIndex]) {
          // Append new points to existing dataset
          newSeries.points.forEach(point => {
            chart.data.datasets[seriesIndex].data.push({
              x: point.x,
              y: point.y
            });
            chart.data.labels.push(point.x);
          });
        }
      });

      // Update chart with new data
      chart.update('none'); // 'none' mode = no animation for better performance

      // Optional: Auto-scroll to latest data
      if (params.realTimeAutoScroll !== false) {
        // Pan to show latest data point
        const latestTimestamp = newChartData.series[0]?.points[newChartData.series[0].points.length - 1]?.x;
        if (latestTimestamp && chart.options.scales?.x) {
          const visibleRange = 300000; // Show last 5 minutes (300000ms)
          chart.options.scales.x.min = latestTimestamp - visibleRange;
          chart.options.scales.x.max = latestTimestamp;
          chart.update('none');
        }
      }
    }

    // Update last fetched timestamp
    lastFetchedTimestamp = endTs;

    console.log(`[DemandModal] Incremental fetch completed (${newChartData.series.reduce((sum, s) => sum + s.points.length, 0)} new points)`);
  }

  async function disableRealTimeMode(): Promise<void> {
    // 1. Stop interval timer
    if (realTimeIntervalId) {
      window.clearInterval(realTimeIntervalId);
      realTimeIntervalId = null;
    }

    // 2. Re-enable date inputs
    dateStartInput.disabled = false;
    dateEndInput.disabled = false;
    dateStartInput.style.opacity = '1';
    dateEndInput.style.opacity = '1';

    // 3. Re-enable interval and aggregation selectors
    if (intervalSelect) {
      intervalSelect.disabled = false;
      intervalSelect.style.opacity = '1';
    }
    if (aggSelect) {
      aggSelect.disabled = false;
      aggSelect.style.opacity = '1';
    }

    // 4. Clear real-time state
    isRealTimeMode = false;
    lastFetchedTimestamp = null;
    realTimeDataBuffer = [];

    // 5. Update button UI
    // RFC-0084: Real-time button removed
    // realTimeToggleBtn.classList.remove('active');

    console.log('[DemandModal] Real-time mode stopped');
  }

  // Initialize date inputs with current values
  function initializeDateInputs() {
    const startDate = new Date(currentStartDate);
    const endDate = new Date(currentEndDate);

    // Format to YYYY-MM-DD for HTML5 date input (using local date, not UTC)
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    dateStartInput.value = formatLocalDate(startDate);
    dateEndInput.value = formatLocalDate(endDate);
  }

  // Initialize interval and aggregation selects with initial values
  function initializeQuerySelects() {
    if (intervalSelect && params.telemetryQuery?.interval) {
      intervalSelect.value = params.telemetryQuery.interval.toString();
    }
    if (aggSelect && params.telemetryQuery?.agg) {
      aggSelect.value = params.telemetryQuery.agg;
    }
  }

  // RFC-0061: Debounce utility function
  function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function(this: any, ...args: Parameters<T>) {
      const context = this;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // RFC-0061: Handle telemetry type switching
  async function switchTelemetryType(newTypeId: string) {
    const newType = TELEMETRY_TYPES[newTypeId];
    if (!newType || newType.id === activeTelemetryType.id) {
      return; // No change needed
    }

    try {
      // Show loading state
      loadingEl.style.display = 'flex';
      contentEl.style.display = 'none';
      errorEl.style.display = 'none';
      peakEl.style.display = 'none';

      // Update active type
      activeTelemetryType = newType;

      // Reload data with new telemetry type
      await loadData();

    } catch (error) {
      console.error('[DemandModal] Error switching telemetry type:', error);
      errorEl.style.display = 'flex';
      errorText.textContent = `${strings.error}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      loadingEl.style.display = 'none';
    }
  }

  // Validate and update period
  async function updatePeriod() {
    periodErrorEl.style.display = 'none';

    const newStartDate = dateStartInput.value;
    const newEndDate = dateEndInput.value;

    if (!newStartDate || !newEndDate) {
      periodErrorEl.textContent = strings.error;
      periodErrorEl.style.display = 'block';
      return;
    }

    const startDateObj = new Date(newStartDate);
    const endDateObj = new Date(newEndDate);

    // Validation: end date must be >= start date
    if (endDateObj < startDateObj) {
      periodErrorEl.textContent = strings.invalidDateRange;
      periodErrorEl.style.display = 'block';
      return;
    }

    // Validation: maximum 30 days
    const diffTime = Math.abs(endDateObj.getTime() - startDateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 30) {
      periodErrorEl.textContent = strings.maxRangeExceeded;
      periodErrorEl.style.display = 'block';
      return;
    }

    // Update state with ISO format including time
    currentStartDate = startDateObj.toISOString();
    currentEndDate = endDateObj.toISOString();

    // Reload data with new date range
    await loadData();
  }

  // Event listeners
  closeBtn.addEventListener('click', closeModal);
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  resetBtn.addEventListener('click', resetZoom);
  pdfBtn.addEventListener('click', exportPdf);
  csvBtn.addEventListener('click', exportCsv);
  updateBtn.addEventListener('click', updatePeriod);

  // RFC-0084: Real-time mode toggle button removed - use RealTimeTelemetryModal instead
  // realTimeToggleBtn.addEventListener('click', async () => {
  //   if (isRealTimeMode) {
  //     // Disable real-time mode
  //     await disableRealTimeMode();
  //   } else {
  //     // Enable real-time mode
  //     await enableRealTimeMode();
  //   }
  // });

  // RFC-0061: Telemetry type selector event listener (with debounce)
  if (telemetryTypeSelect && allowTelemetrySwitch) {
    const debouncedSwitch = debounce(switchTelemetryType, 300); // 300ms debounce
    telemetryTypeSelect.addEventListener('change', (e) => {
      const newTypeId = (e.target as HTMLSelectElement).value;
      debouncedSwitch(newTypeId);
    });
  }

  // Interval and Aggregation selector event listeners
  if (intervalSelect) {
    intervalSelect.addEventListener('change', () => {
      // Automatically reload data when interval changes
      loadData();
    });
  }

  if (aggSelect) {
    aggSelect.addEventListener('change', () => {
      // Automatically reload data when aggregation changes
      loadData();
    });
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // Load and display data
  async function loadData() {
    try {
      loadingEl.style.display = 'flex';
      contentEl.style.display = 'none';
      errorEl.style.display = 'none';
      peakEl.style.display = 'none';

      // Validate date range - maximum 30 days
      const startDateObj = new Date(currentStartDate);
      const endDateObj = new Date(currentEndDate);
      const diffTime = Math.abs(endDateObj.getTime() - startDateObj.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 30) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'flex';
        errorText.textContent = 'O Limite de busca é de 30 dias de intervalo.';
        return;
      }

      // RFC-0061: Build telemetry query using active telemetry type
      const keysStr = Array.isArray(activeTelemetryType.keys)
        ? activeTelemetryType.keys.join(',')
        : activeTelemetryType.keys;

      // Get selected interval and aggregation from selects
      const selectedInterval = intervalSelect ? parseInt(intervalSelect.value) : 86400000;
      const selectedAgg = aggSelect ? aggSelect.value : 'MAX';

      // Calculate limit based on interval for 60s (1 minute)
      // For 60s interval, limit to 24 hours worth of data (1440 points)
      let queryLimit = params.telemetryQuery?.limit || 10000;
      if (selectedInterval === 60000) {
        queryLimit = 1440; // 24 hours * 60 minutes = 1440 points
      }

      // Build query parameters with active telemetry type
      const telemetryQuery: TelemetryQueryParams = {
        ...params.telemetryQuery,
        keys: keysStr,
        interval: selectedInterval,
        agg: selectedAgg,
        limit: queryLimit
      };

      // RFC-0061: Check cache first
      const cacheKey = getCacheKey({
        deviceId: params.deviceId,
        startDate: currentStartDate,
        endDate: currentEndDate,
        keys: keysStr,
        agg: telemetryQuery.agg,
        interval: telemetryQuery.interval || 86400000
      });

      let rawData = getCachedData<any>(cacheKey);

      if (!rawData) {
        // Cache miss - fetch from API
        rawData = params.fetcher
          ? await params.fetcher({ token: params.token, deviceId: params.deviceId, startDate: currentStartDate, endDate: currentEndDate, telemetryQuery })
          : await fetchTelemetryData(params.token, params.deviceId, currentStartDate, currentEndDate, telemetryQuery);

        // Store in cache
        setCachedData(cacheKey, rawData);
      }

      chartData = processMultiSeriesChartData(
        rawData,
        keysStr,
        params.correctionFactor || 1.0,
        locale,
        telemetryQuery.agg || 'MAX',
        params.timezoneOffset // Pass timezone offset (default: -3)
      );

      // RFC-0083: Apply 30-minute interpolation for temperature domain
      if (params.readingType === 'temperature' && !chartData.isEmpty) {
        chartData.series = chartData.series.map(series => ({
          ...series,
          points: interpolateTemperatureData(series.points)
        }));
      }

      if (chartData.isEmpty) {
        errorEl.style.display = 'flex';
        errorText.textContent = strings.noData;
        return;
      }

      // Show global peak information
      if (chartData.globalPeak) {
        const peak = chartData.globalPeak;
        const date = new Date(peak.timestamp);
        const dateStr = date.toLocaleDateString(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        peakEl.textContent = `${strings.maximum}: ${peak.formattedValue} kW ${peak.key ? `(${peak.key}) ` : ''}${strings.at} ${dateStr}`;
        peakEl.style.display = 'block';
      }

      // Create or update chart
      const Chart = (window as any).Chart;
      Chart.register((window as any).ChartZoom);

      if (chart) {
        // Update existing chart
        chart.data.datasets = chartData.series.map(series => ({
          label: series.label,
          data: series.points,
          borderColor: series.color,
          backgroundColor: series.color + 'CC',
          borderWidth: 1,
        }));
        chart.options.plugins.legend.display = chartData.series.length > 1;

        // Update tooltip callbacks to ensure locale is captured
        chart.options.plugins.tooltip.callbacks = {
          title: function(context: any) {
            const timestamp = context[0].parsed.x;
            const date = new Date(timestamp);

            // RFC-0083: Show date + time for temperature, date only for energy/water
            if (params.readingType === 'temperature') {
              return date.toLocaleString(locale, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            } else {
              return date.toLocaleDateString(locale, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
            }
          },
          label: function(context: any) {
            const seriesLabel = context.dataset.label || '';
            const value = context.parsed.y;
            return `${seriesLabel}: ${value.toFixed(2)} kW`;
          }
        };

        // RFC-0083: Update X-axis ticks for temperature
        chart.options.scales.x.ticks.callback = function(value: any) {
          const date = new Date(value);

          if (params.readingType === 'temperature') {
            return date.toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit'
            });
          } else {
            return date.toLocaleDateString(locale, {
              day: '2-digit',
              month: '2-digit'
            });
          }
        };

        chart.update();
      } else {
        // Create new chart
        chart = new Chart(chartCanvas, {
        type: 'line',
        data: {
          datasets: chartData.series.map(series => ({
            label: series.label,
            data: series.points,
            borderColor: series.color,
            backgroundColor: series.color + '33', // More transparent for line fill
            borderWidth: 2,
            fill: true,
            tension: 0.4, // Smooth line curve
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: chartData.series.length > 1, // Show legend only if multiple series
              position: 'top'
            },
            tooltip: {
              callbacks: {
                title: function(context: any) {
                  const timestamp = context[0].parsed.x;
                  const date = new Date(timestamp);

                  // RFC-0083: Show date + time for temperature, date only for energy/water
                  if (params.readingType === 'temperature') {
                    return date.toLocaleString(locale, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  } else {
                    return date.toLocaleDateString(locale, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });
                  }
                },
                label: function(context: any) {
                  const seriesLabel = context.dataset.label || '';
                  const value = context.parsed.y;
                  return `${seriesLabel}: ${value.toFixed(2)} kW`;
                }
              }
            },
            zoom: {
              zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                drag: { enabled: true, modifierKey: 'ctrl' },
                mode: 'x',
              },
              pan: {
                enabled: true,
                mode: 'x',
                // No modifierKey - pan is free after zoom
              },
            },
          },
          scales: {
            x: {
              type: 'linear',
              position: 'bottom',
              title: {
                display: true,
                text: 'Tempo'
              },
              ticks: {
                callback: function(value: any) {
                  const date = new Date(value);

                  // RFC-0083: Show time (HH:mm) for temperature, date for energy/water
                  if (params.readingType === 'temperature') {
                    return date.toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  } else {
                    return date.toLocaleDateString(locale, {
                      day: '2-digit',
                      month: '2-digit'
                    });
                  }
                }
              }
            },
            y: {
              title: {
                display: true,
                text: params.yAxisLabel || strings.demand // Use configurable Y-axis label
              },
              beginAtZero: true
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        }
      });
      }

      loadingEl.style.display = 'none';
      contentEl.style.display = 'flex';

    } catch (error) {
      console.error('Error loading demand data:', error);
      loadingEl.style.display = 'none';
      errorEl.style.display = 'flex';
      errorText.textContent = `${strings.error}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Initialize date inputs
  initializeDateInputs();

  // Initialize query selects (interval and aggregation)
  initializeQuerySelects();

  // Start loading data
  loadData();

  // Return instance with destroy method
  return {
    destroy: closeModal
  };
}
