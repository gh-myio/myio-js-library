/**
 * RFC-0101: Export Data Smart Component Types
 *
 * Type definitions for the export data component system.
 */

// ============================================================================
// Core Types
// ============================================================================

/** Domain types for data classification */
export type ExportDomain = 'energy' | 'water' | 'temperature';

/** Supported export file formats */
export type ExportFormat = 'pdf' | 'xlsx' | 'csv';

/** Export type determining data structure */
export type ExportType = 'one-device' | 'comparison' | 'one-customer' | 'group-of-customer';

// ============================================================================
// Configuration Types
// ============================================================================

/** Custom color palette for exports */
export interface ExportColorsPallet {
  /** Primary brand color (default: MyIO purple #3e1a7d) */
  primary?: string;
  /** Secondary color for accents */
  secondary?: string;
  /** Accent color for highlights */
  accent?: string;
  /** Background color */
  background?: string;
  /** Text color */
  text?: string;
  /** Chart colors array */
  chartColors?: string[];
}

/** Configuration options for buildTemplateExport */
export interface BuildTemplateExportParams {
  /** Data domain (energy, water, temperature) */
  domain: ExportDomain;
  /** Output format (pdf, xlsx, csv) */
  formatExport: ExportFormat;
  /** Type of export data structure */
  typeExport: ExportType;
  /** Optional custom color palette */
  colorsPallet?: ExportColorsPallet;
  /** Locale for number/date formatting (default: 'pt-BR') */
  locale?: string;
  /** Include chart in export (PDF only) */
  includeChart?: boolean;
  /** Include statistics (min, max, avg) */
  includeStats?: boolean;
  /** Custom header text */
  headerText?: string;
  /** Custom footer text */
  footerText?: string;
}

/** Generated export configuration template */
export interface ExportConfigTemplate {
  /** Domain configuration */
  domain: ExportDomain;
  /** Format configuration */
  formatExport: ExportFormat;
  /** Export type */
  typeExport: ExportType;
  /** Resolved color palette */
  colors: Required<ExportColorsPallet>;
  /** Locale setting */
  locale: string;
  /** Chart inclusion flag */
  includeChart: boolean;
  /** Stats inclusion flag */
  includeStats: boolean;
  /** Header text */
  headerText: string;
  /** Footer text */
  footerText: string;
  /** Domain-specific icon */
  domainIcon: string;
  /** Domain label (localized) */
  domainLabel: string;
  /** Unit for the domain */
  domainUnit: string;
}

// ============================================================================
// Data Types
// ============================================================================

/** Single data point with timestamp and value */
export interface ExportDataPoint {
  /** Timestamp of the measurement */
  timestamp: Date | string | number;
  /** Measured value */
  value: number;
  /** Optional unit override */
  unit?: string;
}

/** Device information for export */
export interface ExportDeviceInfo {
  /** Device identifier (e.g., '113CD') */
  identifier?: string;
  /** Device label (display name) */
  label?: string;
  /** Device name (fallback if no label) */
  name: string;
  /** Device icon (optional) */
  icon?: string;
}

/** Customer/Shopping information */
export interface ExportCustomerInfo {
  /** Customer name */
  customerName?: string;
  /** Shopping/location name */
  shoppingName?: string;
  /** Customer logo URL (for PDF) */
  logoUrl?: string;
}

/** Complete data structure for export */
export interface ExportData {
  /** Device information */
  device: ExportDeviceInfo;
  /** Customer information */
  customer?: ExportCustomerInfo;
  /** Data points array */
  data: ExportDataPoint[];
  /** Period start date */
  periodStart?: Date | string;
  /** Period end date */
  periodEnd?: Date | string;
}

/** Data structure for comparison exports */
export interface ExportComparisonData {
  /** Array of devices with their data */
  devices: Array<ExportData>;
  /** Customer information */
  customer?: ExportCustomerInfo;
  /** Period start date */
  periodStart?: Date | string;
  /** Period end date */
  periodEnd?: Date | string;
}

/** Data structure for customer exports */
export interface ExportCustomerData {
  /** Customer information */
  customer: ExportCustomerInfo;
  /** Array of devices with their data */
  devices: Array<ExportData>;
  /** Period start date */
  periodStart?: Date | string;
  /** Period end date */
  periodEnd?: Date | string;
}

/** Data structure for group of customers exports */
export interface ExportGroupData {
  /** Group name */
  groupName: string;
  /** Array of customers with their data */
  customers: Array<ExportCustomerData>;
  /** Period start date */
  periodStart?: Date | string;
  /** Period end date */
  periodEnd?: Date | string;
}

/** Union type for all export data types */
export type ExportDataInput = ExportData | ExportComparisonData | ExportCustomerData | ExportGroupData;

// ============================================================================
// Statistics Types
// ============================================================================

/** Calculated statistics for a data series */
export interface ExportStats {
  /** Minimum value in the period */
  min: number;
  /** Maximum value in the period */
  max: number;
  /** Average value in the period */
  average: number;
  /** Sum of all values */
  sum: number;
  /** Number of data points */
  count: number;
}

// ============================================================================
// Result Types
// ============================================================================

/** Export result with file information */
export interface ExportResult {
  /** Whether export was successful */
  success: boolean;
  /** Generated filename */
  filename: string;
  /** File blob (for download) */
  blob?: Blob;
  /** Data URL (for preview) */
  dataUrl?: string;
  /** Error message if failed */
  error?: string;
}

/** Export instance returned by myioExportData */
export interface ExportDataInstance {
  /** Execute the export and get result */
  export: () => Promise<ExportResult>;
  /** Download the exported file */
  download: () => Promise<void>;
  /** Get preview data URL (PDF only) */
  preview: () => Promise<string | null>;
  /** Get calculated statistics */
  getStats: () => ExportStats;
  /** Get generated filename */
  getFilename: () => string;
}

// ============================================================================
// Callback Types
// ============================================================================

/** Progress callback for large exports */
export type ExportProgressCallback = (progress: number, message: string) => void;

/** Options for the export function */
export interface ExportOptions {
  /** Progress callback */
  onProgress?: ExportProgressCallback;
  /** Auto-download after export */
  autoDownload?: boolean;
}
