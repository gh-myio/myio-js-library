/**
 * RFC-0101: Export Data Smart Component
 *
 * A two-part smart component system for exporting device data
 * in multiple formats (PDF, XLS, CSV) across different domains
 * (temperature, water, energy).
 *
 * @example
 * ```typescript
 * import { buildTemplateExport, myioExportData } from 'myio-js-library';
 *
 * // 1. Create configuration template
 * const config = buildTemplateExport({
 *   domain: 'energy',
 *   formatExport: 'pdf',
 *   typeExport: 'one-device',
 * });
 *
 * // 2. Export data
 * const exporter = myioExportData(data, config);
 * await exporter.download();
 * ```
 */

import type {
  ExportDomain,
  ExportFormat,
  ExportType,
  BuildTemplateExportParams,
  ExportConfigTemplate,
  ExportColorsPallet,
  ExportData,
  ExportComparisonData,
  ExportCustomerData,
  ExportGroupData,
  ExportDataInput,
  ExportDataPoint,
  ExportStats,
  ExportResult,
  ExportDataInstance,
  ExportOptions,
} from './types';

// Re-export types
export * from './types';

// ============================================================================
// Constants
// ============================================================================

/** Default MyIO color palette */
const DEFAULT_COLORS: Required<ExportColorsPallet> = {
  primary: '#3e1a7d',      // MyIO purple
  secondary: '#6b4c9a',    // Light purple
  accent: '#00bcd4',       // Cyan accent
  background: '#ffffff',   // White
  text: '#333333',         // Dark gray
  chartColors: ['#3e1a7d', '#00bcd4', '#4caf50', '#ff9800', '#e91e63', '#9c27b0'],
};

/** Domain icons */
const DOMAIN_ICONS: Record<ExportDomain, string> = {
  energy: '\u26A1',   // Lightning bolt
  water: '\uD83D\uDCA7',    // Water drop
  temperature: '\uD83C\uDF21\uFE0F', // Thermometer
};

/** Domain labels (Portuguese) */
const DOMAIN_LABELS: Record<ExportDomain, string> = {
  energy: 'Energia',
  water: '\u00C1gua',
  temperature: 'Temperatura',
};

/** Domain labels (English) */
const DOMAIN_LABELS_EN: Record<ExportDomain, string> = {
  energy: 'Energy',
  water: 'Water',
  temperature: 'Temperature',
};

/** Domain units */
const DOMAIN_UNITS: Record<ExportDomain, string> = {
  energy: 'kWh',
  water: 'm\u00B3',
  temperature: '\u00B0C',
};

/** CSV separator by locale */
const CSV_SEPARATORS: Record<string, string> = {
  'pt-BR': ';',
  'en-US': ',',
  'default': ';',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats a date to YYYY-MM-DD-HH-mm-ss for filename
 */
function formatDateForFilename(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

/**
 * Sanitizes a string for use in filename
 */
function sanitizeFilename(str: string): string {
  return str
    .replace(/[<>:"/\\|?*]/g, '')  // Remove invalid chars
    .replace(/\s+/g, '_')           // Replace spaces with underscore
    .substring(0, 50);               // Limit length
}

/**
 * Generates filename based on export config and data
 */
function generateFilename(
  data: ExportDataInput,
  config: ExportConfigTemplate
): string {
  const timestamp = formatDateForFilename(new Date());
  const domainLabel = DOMAIN_LABELS_EN[config.domain].toUpperCase();
  const ext = config.formatExport;

  // Get device/customer name for filename
  let baseName = 'export';

  if ('device' in data && data.device) {
    const device = data.device;
    const label = device.label || device.name || 'device';
    const identifier = device.identifier ? `-${device.identifier}` : '';
    baseName = `${sanitizeFilename(label)}${identifier}`;
  } else if ('customer' in data && data.customer?.customerName) {
    baseName = sanitizeFilename(data.customer.customerName);
  } else if ('groupName' in data) {
    baseName = sanitizeFilename(data.groupName);
  }

  return `${baseName}-${domainLabel}-${timestamp}.${ext}`;
}

/**
 * Normalizes timestamp to Date object
 */
function normalizeTimestamp(ts: Date | string | number): Date {
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  return new Date(ts);
}

/**
 * Calculates statistics from data points
 */
function calculateStats(dataPoints: ExportDataPoint[]): ExportStats {
  if (dataPoints.length === 0) {
    return { min: 0, max: 0, average: 0, sum: 0, count: 0 };
  }

  const values = dataPoints.map(d => d.value);
  const sum = values.reduce((a, b) => a + b, 0);

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    average: sum / values.length,
    sum,
    count: values.length,
  };
}

/**
 * Formats number according to locale
 */
function formatNumber(value: number, locale: string, decimals = 2): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats date according to locale
 */
function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// ============================================================================
// CSV Export
// ============================================================================

/**
 * Generates CSV content from data
 */
function generateCSV(
  data: ExportDataInput,
  config: ExportConfigTemplate
): string {
  const sep = CSV_SEPARATORS[config.locale] || CSV_SEPARATORS['default'];
  const rows: string[][] = [];

  const escapeCSV = (val: any): string => {
    const str = String(val ?? '');
    if (str.includes(sep) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const formatNumCSV = (val: number): string => {
    return formatNumber(val, config.locale);
  };

  // Handle single device export
  if ('device' in data && 'data' in data && Array.isArray(data.data)) {
    const deviceData = data as ExportData;

    // Header row
    rows.push(['Timestamp', config.domainLabel, `Unit (${config.domainUnit})`]);

    // Data rows
    for (const point of deviceData.data) {
      const ts = normalizeTimestamp(point.timestamp);
      rows.push([
        formatDate(ts, config.locale),
        formatNumCSV(point.value),
        point.unit || config.domainUnit,
      ]);
    }

    // Stats footer if enabled
    if (config.includeStats) {
      const stats = calculateStats(deviceData.data);
      rows.push([]);
      rows.push(['Statistics', '', '']);
      rows.push(['Minimum', formatNumCSV(stats.min), config.domainUnit]);
      rows.push(['Maximum', formatNumCSV(stats.max), config.domainUnit]);
      rows.push(['Average', formatNumCSV(stats.average), config.domainUnit]);
      rows.push(['Total', formatNumCSV(stats.sum), config.domainUnit]);
      rows.push(['Count', String(stats.count), 'points']);
    }
  }

  // Handle comparison export
  else if ('devices' in data && Array.isArray(data.devices)) {
    const compData = data as ExportComparisonData;

    // Header with device names
    const deviceHeaders = compData.devices.map(d =>
      d.device.label || d.device.name || 'Device'
    );
    rows.push(['Timestamp', ...deviceHeaders]);

    // Get all unique timestamps
    const allTimestamps = new Set<number>();
    compData.devices.forEach(d => {
      d.data.forEach(point => {
        allTimestamps.add(normalizeTimestamp(point.timestamp).getTime());
      });
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Create rows for each timestamp
    for (const ts of sortedTimestamps) {
      const row: string[] = [formatDate(new Date(ts), config.locale)];

      for (const device of compData.devices) {
        const point = device.data.find(
          p => normalizeTimestamp(p.timestamp).getTime() === ts
        );
        row.push(point ? formatNumCSV(point.value) : '');
      }

      rows.push(row);
    }
  }

  // Convert rows to CSV string
  return rows.map(row => row.map(escapeCSV).join(sep)).join('\r\n');
}

// ============================================================================
// XLSX Export (simplified - generates CSV compatible with Excel)
// ============================================================================

/**
 * Generates XLSX-compatible content
 * Note: For full XLSX support, consider using xlsx library
 */
function generateXLSX(
  data: ExportDataInput,
  config: ExportConfigTemplate
): string {
  // For now, generate a CSV that Excel can open
  // In production, you'd use a library like xlsx or exceljs
  return generateCSV(data, config);
}

// ============================================================================
// PDF Export (simplified HTML-based)
// ============================================================================

/**
 * Generates HTML content for PDF export
 * Can be converted to PDF using browser print or libraries like jsPDF/pdfmake
 */
function generatePDFContent(
  data: ExportDataInput,
  config: ExportConfigTemplate
): string {
  const { colors, domainIcon, domainLabel, domainUnit, locale, includeStats, includeChart } = config;

  let deviceLabel = 'Export';
  let customerName = '';
  let identifier = '';
  let dataPoints: ExportDataPoint[] = [];

  // Extract data based on type
  if ('device' in data && 'data' in data) {
    const deviceData = data as ExportData;
    deviceLabel = deviceData.device.label || deviceData.device.name || 'Device';
    identifier = deviceData.device.identifier || '';
    customerName = deviceData.customer?.customerName || '';
    dataPoints = deviceData.data;
  }

  const stats = calculateStats(dataPoints);

  // Generate table rows
  const tableRows = dataPoints.slice(0, 100).map(point => {
    const ts = normalizeTimestamp(point.timestamp);
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${formatDate(ts, locale)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatNumber(point.value, locale)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${point.unit || domainUnit}</td>
      </tr>
    `;
  }).join('');

  const statsSection = includeStats ? `
    <div style="margin-top: 24px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; color: ${colors.primary};">Statistics</h3>
      <table style="width: 100%;">
        <tr>
          <td><strong>Minimum:</strong></td>
          <td>${formatNumber(stats.min, locale)} ${domainUnit}</td>
          <td><strong>Maximum:</strong></td>
          <td>${formatNumber(stats.max, locale)} ${domainUnit}</td>
        </tr>
        <tr>
          <td><strong>Average:</strong></td>
          <td>${formatNumber(stats.average, locale)} ${domainUnit}</td>
          <td><strong>Total:</strong></td>
          <td>${formatNumber(stats.sum, locale)} ${domainUnit}</td>
        </tr>
      </table>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${deviceLabel} - ${domainLabel} Report</title>
      <style>
        body {
          font-family: 'Roboto', Arial, sans-serif;
          margin: 0;
          padding: 24px;
          color: ${colors.text};
          background: ${colors.background};
        }
        .header {
          background: ${colors.primary};
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 24px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .header .subtitle {
          opacity: 0.9;
          margin-top: 8px;
        }
        .device-info {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 8px;
        }
        .device-info span {
          padding: 4px 12px;
          background: ${colors.secondary};
          color: white;
          border-radius: 4px;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          background: ${colors.primary};
          color: white;
          padding: 12px 8px;
          text-align: left;
        }
        th:nth-child(2) {
          text-align: right;
        }
        .footer {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #eee;
          text-align: center;
          font-size: 12px;
          color: #999;
        }
        @media print {
          body { padding: 0; }
          .header { border-radius: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${domainIcon} ${deviceLabel}</h1>
        <div class="subtitle">${domainLabel} Report - Generated ${formatDate(new Date(), locale)}</div>
      </div>

      ${customerName ? `<div class="customer-name" style="margin-bottom: 16px; font-size: 18px;"><strong>Customer:</strong> ${customerName}</div>` : ''}

      ${identifier ? `
        <div class="device-info">
          <span>ID: ${identifier}</span>
          <span>Domain: ${domainLabel}</span>
          <span>Unit: ${domainUnit}</span>
        </div>
      ` : ''}

      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>${domainLabel} (${domainUnit})</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          ${dataPoints.length > 100 ? `<tr><td colspan="3" style="text-align: center; padding: 16px; color: #999;">... and ${dataPoints.length - 100} more rows</td></tr>` : ''}
        </tbody>
      </table>

      ${statsSection}

      <div class="footer">
        <p>${config.footerText || 'Generated by MyIO Platform'}</p>
      </div>
    </body>
    </html>
  `;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Creates an export configuration template
 *
 * @param params - Configuration parameters
 * @returns Export configuration template
 *
 * @example
 * ```typescript
 * const config = buildTemplateExport({
 *   domain: 'energy',
 *   formatExport: 'pdf',
 *   typeExport: 'one-device',
 *   colorsPallet: { primary: '#ff0000' },
 * });
 * ```
 */
export function buildTemplateExport(params: BuildTemplateExportParams): ExportConfigTemplate {
  const {
    domain,
    formatExport,
    typeExport,
    colorsPallet,
    locale = 'pt-BR',
    includeChart = formatExport === 'pdf',
    includeStats = true,
    headerText,
    footerText,
  } = params;

  // Merge colors with defaults
  const colors: Required<ExportColorsPallet> = {
    ...DEFAULT_COLORS,
    ...colorsPallet,
    chartColors: colorsPallet?.chartColors || DEFAULT_COLORS.chartColors,
  };

  return {
    domain,
    formatExport,
    typeExport,
    colors,
    locale,
    includeChart,
    includeStats,
    headerText: headerText || `${DOMAIN_LABELS[domain]} Report`,
    footerText: footerText || 'Generated by MyIO Platform',
    domainIcon: DOMAIN_ICONS[domain],
    domainLabel: DOMAIN_LABELS[domain],
    domainUnit: DOMAIN_UNITS[domain],
  };
}

/**
 * Creates an export instance with the provided data and configuration
 *
 * @param data - Data to export
 * @param config - Export configuration template
 * @param options - Optional export options
 * @returns Export data instance
 *
 * @example
 * ```typescript
 * const exporter = myioExportData(deviceData, config);
 * await exporter.download();
 * ```
 */
export function myioExportData(
  data: ExportDataInput,
  config: ExportConfigTemplate,
  options?: ExportOptions
): ExportDataInstance {
  const filename = generateFilename(data, config);

  // Get all data points for stats calculation
  let allDataPoints: ExportDataPoint[] = [];
  if ('data' in data && Array.isArray(data.data)) {
    allDataPoints = data.data;
  } else if ('devices' in data && Array.isArray(data.devices)) {
    allDataPoints = data.devices.flatMap(d => d.data);
  }

  const stats = calculateStats(allDataPoints);

  const instance: ExportDataInstance = {
    async export(): Promise<ExportResult> {
      try {
        options?.onProgress?.(10, 'Generating content...');

        let content: string;
        let mimeType: string;
        let finalFilename = filename;

        switch (config.formatExport) {
          case 'csv':
            content = generateCSV(data, config);
            mimeType = 'text/csv;charset=utf-8;';
            break;

          case 'xlsx':
            // Generate CSV for Excel compatibility
            // Note: For true XLSX, use xlsx library
            content = generateXLSX(data, config);
            mimeType = 'text/csv;charset=utf-8;';
            finalFilename = filename.replace('.xlsx', '.csv'); // Fallback to CSV
            break;

          case 'pdf':
            content = generatePDFContent(data, config);
            mimeType = 'text/html;charset=utf-8;';
            finalFilename = filename.replace('.pdf', '.html'); // HTML for now
            break;

          default:
            throw new Error(`Unsupported format: ${config.formatExport}`);
        }

        options?.onProgress?.(80, 'Creating file...');

        // Add BOM for UTF-8 CSV/Excel compatibility
        const bom = config.formatExport === 'csv' ? '\uFEFF' : '';
        const blob = new Blob([bom + content], { type: mimeType });

        options?.onProgress?.(100, 'Export complete');

        return {
          success: true,
          filename: finalFilename,
          blob,
          dataUrl: URL.createObjectURL(blob),
        };
      } catch (error) {
        return {
          success: false,
          filename,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    async download(): Promise<void> {
      const result = await this.export();

      if (!result.success || !result.blob) {
        console.error('Export failed:', result.error);
        return;
      }

      // Create download link
      const link = document.createElement('a');
      link.href = URL.createObjectURL(result.blob);
      link.download = result.filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      URL.revokeObjectURL(link.href);
    },

    async preview(): Promise<string | null> {
      if (config.formatExport !== 'pdf') {
        return null;
      }

      const result = await this.export();
      return result.dataUrl || null;
    },

    getStats(): ExportStats {
      return stats;
    },

    getFilename(): string {
      return filename;
    },
  };

  // Auto-download if requested
  if (options?.autoDownload) {
    instance.download();
  }

  return instance;
}

// ============================================================================
// Utility Exports
// ============================================================================

/** Default colors for exports */
export const EXPORT_DEFAULT_COLORS = DEFAULT_COLORS;

/** Domain icons */
export const EXPORT_DOMAIN_ICONS = DOMAIN_ICONS;

/** Domain labels */
export const EXPORT_DOMAIN_LABELS = DOMAIN_LABELS;

/** Domain units */
export const EXPORT_DOMAIN_UNITS = DOMAIN_UNITS;

/** Calculate stats helper */
export { calculateStats as calculateExportStats };

/** Generate filename helper */
export { generateFilename as generateExportFilename };

// ============================================================================
// Default Export
// ============================================================================

export default {
  buildTemplateExport,
  myioExportData,
};
