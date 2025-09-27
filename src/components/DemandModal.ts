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
  limit?: number;                      // Maximum number of data points (default: 50000)
  intervalType?: string;               // Interval type (default: "MILLISECONDS")
  interval?: number;                   // Interval value (default: 54000000)
  agg?: string;                        // Aggregation function (default: "SUM")
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

// Global state for library loading
let chartJsLoaded = false;
let zoomPluginLoaded = false;
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
    fullscreen: 'Tela cheia',
    close: 'Fechar',
    resetZoom: 'Reset Zoom',
    loading: 'Carregando dados...',
    noData: 'Sem pontos de demanda no período selecionado',
    error: 'Erro ao carregar dados',
    zoomHelp: 'Scroll: zoom | Drag: selecionar | Ctrl+Drag: mover',
    demand: 'Demanda (kW)',
    reportTitle: 'Relatório de Demanda',
    reportFooter: 'MyIO Energy Management System'
  },
  'en-US': {
    title: 'Demand',
    period: 'Period',
    maximum: 'Maximum',
    at: 'on',
    atTime: 'at',
    timeUnit: '',
    exportPdf: 'Export PDF',
    fullscreen: 'Fullscreen',
    close: 'Close',
    resetZoom: 'Reset Zoom',
    loading: 'Loading data...',
    noData: 'No demand points in the selected period',
    error: 'Error loading data',
    zoomHelp: 'Scroll: zoom | Drag: select | Ctrl+Drag: pan',
    demand: 'Demand (kW)',
    reportTitle: 'Demand Report',
    reportFooter: 'MyIO Energy Management System'
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
      setTimeout(() => {
        if ((window as any)[checkGlobal]) {
          resolve();
        } else {
          reject(new Error(`Library ${checkGlobal} not available after loading ${url}`));
        }
      }, 500);
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.onload = () => {
      // Wait for library to be fully available
      setTimeout(() => {
        if ((window as any)[checkGlobal]) {
          resolve();
        } else {
          reject(new Error(`Library ${checkGlobal} not available after loading ${url}`));
        }
      }, 200);
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
  } catch (error) {
    throw new Error(`Failed to load external libraries: ${error}`);
  }
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
  const limit = queryParams?.limit || 50000;
  const intervalType = queryParams?.intervalType || 'MILLISECONDS';
  const interval = queryParams?.interval || 54000000;
  const agg = queryParams?.agg || 'SUM';
  const orderBy = queryParams?.orderBy || 'ASC';

  const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?` +
    `keys=${keys}&startTs=${startTs}&endTs=${endTs}&limit=${limit}&` +
    `intervalType=${intervalType}&interval=${interval}&agg=${agg}&orderBy=${orderBy}`;

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
  // Handle different jsPDF loading patterns
  const jsPDFConstructor = (window as any).jsPDF?.jsPDF || (window as any).jsPDF;
  
  if (!jsPDFConstructor) {
    throw new Error('jsPDF library not available');
  }
  
  const doc = new jsPDFConstructor();

  // Header
  doc.setFontSize(20);
  doc.text(strings.reportTitle, 20, 30);

  // Device info
  doc.setFontSize(12);
  const label = params.label || 'Dispositivo';
  doc.text(`${strings.title} - ${label}`, 20, 50);
  
  const startDate = formatDate(new Date(params.startDate), params.locale || 'pt-BR');
  const endDate = formatDate(new Date(params.endDate), params.locale || 'pt-BR');
  doc.text(`${strings.period}: ${startDate} → ${endDate}`, 20, 65);

  // Peak info
  if (chartData.globalPeak) {
    const peak = chartData.globalPeak;
    doc.text(
      `${strings.maximum}: ${peak.formattedValue} kW ${peak.key ? `(${peak.key}) ` : ''}${strings.at} ${peak.formattedTime}`,
      20, 80
    );
  }

  // Chart image
  const chartImage = chartCanvas.toDataURL('image/png');
  doc.addImage(chartImage, 'PNG', 20, 95, 170, 100);

  // Sample data table
  if (chartData.series.length > 0 && chartData.series[0].points.length > 0) {
    doc.text('Amostra de Dados:', 20, 210);
    
    let y = 225;
    // Take sample points from the first series for the table
    const samplePoints = chartData.series[0].points.slice(0, 10);
    
    doc.setFontSize(10);
    doc.text('Data/Hora', 20, y);
    doc.text(params.yAxisLabel || strings.demand, 100, y); // Use configurable Y-axis label
    y += 10;

    samplePoints.forEach(point => {
      const dateStr = formatDateTime(new Date(point.x), params.locale || 'pt-BR');
      doc.text(dateStr, 20, y);
      doc.text(point.y.toFixed(2), 100, y);
      y += 8;
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.text(strings.reportFooter, 20, 280);
  doc.text(new Date().toLocaleString(params.locale || 'pt-BR'), 20, 290);

  // Download
  const fileName = params.pdf?.fileName || 
    `demanda-${params.label || 'dispositivo'}-${params.startDate}-${params.endDate}.pdf`;
  doc.save(fileName);
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
          <button class="myio-demand-modal-btn myio-demand-modal-btn-pdf" type="button">
            ${strings.exportPdf}
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
  const resetBtn = overlay.querySelector('.myio-demand-modal-btn-reset') as HTMLButtonElement;
  const chartCanvas = overlay.querySelector('.myio-demand-modal-chart') as HTMLCanvasElement;
  const loadingEl = overlay.querySelector('.myio-demand-modal-loading') as HTMLElement;
  const errorEl = overlay.querySelector('.myio-demand-modal-error') as HTMLElement;
  const errorText = overlay.querySelector('.myio-demand-modal-error-text') as HTMLElement;
  const peakEl = overlay.querySelector('.myio-demand-modal-peak') as HTMLElement;
  const contentEl = overlay.querySelector('.myio-demand-modal-content') as HTMLElement;

  // State
  let chart: any = null;
  let chartData: MultiSeriesChartData | null = null;
  let isFullscreen = false;

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

  async function exportPdf() {
    if (!chartData || !chart) {
      alert('Nenhum dado disponível para exportar');
      return;
    }

    // Temporary fallback: export chart as image instead of PDF
    try {
      const chartImage = chartCanvas.toDataURL('image/png');
      
      // Create a temporary link to download the image
      const link = document.createElement('a');
      link.download = `demanda-${params.label || 'dispositivo'}-${params.startDate}-${params.endDate}.png`;
      link.href = chartImage;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert('📊 Gráfico exportado como imagem PNG!\n\nO export em PDF será implementado em uma próxima versão.');
      
    } catch (error) {
      console.error('Image export failed:', error);
      alert('Erro ao exportar gráfico. Tente novamente.');
    }
  }

  // Event listeners
  closeBtn.addEventListener('click', closeModal);
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  resetBtn.addEventListener('click', resetZoom);
  pdfBtn.addEventListener('click', exportPdf);

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

      // Validate date range - maximum 30 days
      const startDateObj = new Date(params.startDate);
      const endDateObj = new Date(params.endDate);
      const diffTime = Math.abs(endDateObj.getTime() - startDateObj.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 30) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'flex';
        errorText.textContent = 'O Limite de busca é de 30 dias de intervalo.';
        return;
      }

      // Use custom fetcher if provided, otherwise use default ThingsBoard fetcher
      const rawData = params.fetcher 
        ? await params.fetcher({ token: params.token, deviceId: params.deviceId, startDate: params.startDate, endDate: params.endDate, telemetryQuery: params.telemetryQuery })
        : await fetchTelemetryData(params.token, params.deviceId, params.startDate, params.endDate, params.telemetryQuery);
      
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

      // Create chart
      const Chart = (window as any).Chart;
      Chart.register((window as any).ChartZoom);

      chart = new Chart(chartCanvas, {
        type: 'line',
        data: {
          datasets: chartData.series.map(series => ({
            label: series.label,
            data: series.points,
            borderColor: series.color,
            backgroundColor: series.color + '20',
            fill: false, // No fill for multi-series
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 6,
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
                modifierKey: 'ctrl',
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

      loadingEl.style.display = 'none';
      contentEl.style.display = 'flex';

    } catch (error) {
      console.error('Error loading demand data:', error);
      loadingEl.style.display = 'none';
      errorEl.style.display = 'flex';
      errorText.textContent = `${strings.error}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Start loading data
  loadData();

  // Return instance with destroy method
  return {
    destroy: closeModal
  };
}
