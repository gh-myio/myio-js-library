/**
 * Demand Modal Component for MYIO JS Library
 * RFC 0015: Demand Modal Component (with Token Injection)
 * 
 * Displays a fully-styled modal with demand/consumption line chart over time.
 * Fetches telemetry data from ThingsBoard REST API using token-based authentication.
 */

// Type definitions
// Type definitions
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
    at: 'no dia',
    atTime: 'ás',
    timeUnit: 'hs',
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
    maxRangeExceeded: 'Período máximo de 30 dias'
  },
  'en-US': {
    title: 'Demand',
    period: 'Period',
    maximum: 'Maximum',
    at: 'on',
    atTime: 'at',
    timeUnit: '',
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
    maxRangeExceeded: 'Maximum range of 30 days'
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
      width: 800px;
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
 * Format datetime according to locale
 */
function formatDateTime(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
  locale: string
): MultiSeriesChartData {
  const seriesKeys = keys.split(',').map(k => k.trim());
  const seriesData: SeriesData[] = [];
  let globalPeak: DemandPeak | null = null;
  let isEmpty = true;

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

    // Calculate demand (kW) from consumption deltas and apply correction factor
    const points: MultiSeriesDataPoint[] = [];
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
          const demandKw = (deltaWh / 1000 / deltaHours) * correctionFactor; // Apply correction factor
          points.push({
            x: currentTs,
            y: demandKw
          });
        }
      }

      previousValue = currentValue;
      previousTs = currentTs;
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
    doc.text('Data/Hora', 20, currentY);
    doc.text(params.yAxisLabel || strings.demand, 100, currentY);
    currentY += 7; // Smaller increment for table rows

    samplePoints.forEach(point => {
      currentY = ensureRoom(doc, currentY, 10); // Ensure room for each row
      const dateStr = formatDateTime(new Date(point.x), params.locale || 'pt-BR');
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
  const startDateFormatted = formatDate(new Date(params.startDate), locale);
  const endDateFormatted = formatDate(new Date(params.endDate), locale);

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
      
      <div class="myio-demand-modal-period">
        ${strings.period}: ${startDateFormatted} → ${endDateFormatted}
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
        <button class="myio-demand-modal-btn-update" type="button">
          ${strings.updatePeriod}
        </button>
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
  const periodDisplayEl = overlay.querySelector('.myio-demand-modal-period') as HTMLElement;
  const dateStartInput = overlay.querySelector('.myio-demand-modal-date-start') as HTMLInputElement;
  const dateEndInput = overlay.querySelector('.myio-demand-modal-date-end') as HTMLInputElement;
  const updateBtn = overlay.querySelector('.myio-demand-modal-btn-update') as HTMLButtonElement;
  const periodErrorEl = overlay.querySelector('.myio-demand-modal-period-error') as HTMLElement;

  // State
  let chart: any = null;
  let chartData: MultiSeriesChartData | null = null;
  let isFullscreen = false;
  let currentStartDate = params.startDate;
  let currentEndDate = params.endDate;

  // Prevent body scroll
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // Focus trap
  const releaseFocusTrap = createFocusTrap(overlay);

  // Event handlers
  function closeModal() {
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
      let csv = BOM + 'Data/Hora,Série,Valor (kW)\n';

      // Add data rows
      chartData.series.forEach(series => {
        series.points.forEach(point => {
          const dateStr = formatDateTime(new Date(point.x), locale);
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
        doc.text('Data/Hora', 20, currentY);
        doc.text(params.yAxisLabel || strings.demand, 100, currentY);
        currentY += 7; // Smaller increment for table rows

        samplePoints.forEach(point => {
          currentY = ensureRoom(doc, currentY, 10); // Ensure room for each row
          const dateStr = formatDateTime(new Date(point.x), params.locale || 'pt-BR');
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

  // Initialize date inputs with current values
  function initializeDateInputs() {
    const startDate = new Date(currentStartDate);
    const endDate = new Date(currentEndDate);

    // Format to YYYY-MM-DD for HTML5 date input
    dateStartInput.value = startDate.toISOString().split('T')[0];
    dateEndInput.value = endDate.toISOString().split('T')[0];
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

      // Update period display
      const startDateFormatted = formatDate(startDateObj, locale);
      const endDateFormatted = formatDate(endDateObj, locale);
      periodDisplayEl.textContent = `${strings.period}: ${startDateFormatted} → ${endDateFormatted}`;

      // Use custom fetcher if provided, otherwise use default ThingsBoard fetcher
      const rawData = params.fetcher
        ? await params.fetcher({ token: params.token, deviceId: params.deviceId, startDate: currentStartDate, endDate: currentEndDate, telemetryQuery: params.telemetryQuery })
        : await fetchTelemetryData(params.token, params.deviceId, currentStartDate, currentEndDate, params.telemetryQuery);
      
      chartData = processMultiSeriesChartData(
        rawData, 
        params.telemetryQuery?.keys || 'consumption', 
        params.correctionFactor || 1.0, 
        locale
      );

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
        const timeStr = date.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        peakEl.textContent = `${strings.maximum}: ${peak.formattedValue} kW ${peak.key ? `(${peak.key}) ` : ''}${strings.at} ${dateStr} ${strings.atTime} ${timeStr}${strings.timeUnit}`;
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
        chart.update();
      } else {
        // Create new chart
        chart = new Chart(chartCanvas, {
        type: 'bar',
        data: {
          datasets: chartData.series.map(series => ({
            label: series.label,
            data: series.points,
            borderColor: series.color,
            backgroundColor: series.color + 'CC', // More opaque for bars
            borderWidth: 1,
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
                  return date.toLocaleDateString(locale, { 
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
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

  // Start loading data
  loadData();

  // Return instance with destroy method
  return {
    destroy: closeModal
  };
}
