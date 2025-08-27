import { formatNumberReadable } from '../format/numbers';

/**
 * Type definition for water report row data
 */
export type WaterRow = {
  formattedDate: string;
  day: string;
  avgConsumption: number | string;
  minDemand: number | string;
  maxDemand: number | string;
  totalConsumption: number | string;
  name?: string;
};

/**
 * Type definition for store row data
 */
export type StoreRow = {
  entityLabel?: string;
  deviceName?: string;
  deviceId?: string;
  consumptionM3?: number;
  consumptionKwh?: number; // Deprecated alias for water consumption
};

/**
 * Builds a CSV string for water consumption reports
 * @param rows - Array of water report data
 * @param meta - Metadata including issue date, name, identifier, and total
 * @returns CSV content as string
 */
export function buildWaterReportCSV(
  rows: WaterRow[],
  meta: {
    issueDate: string;
    name?: string;
    identifier?: string;
    total?: number;
  }
): string {
  if (!rows || rows.length === 0) {
    return '';
  }
  
  const csvRows: string[][] = [];
  
  // Calculate total consumption
  let totalConsumption = 0;
  rows.forEach((row) => {
    // Handle both string and number values, remove commas for pt-BR format
    const consumptionStr = String(row.totalConsumption).replace(',', '.');
    const consumption = Number(consumptionStr) || 0;
    totalConsumption += consumption;
  });
  
  // Use provided total or calculated total
  const finalTotal = meta.total !== undefined ? meta.total : totalConsumption;
  
  // Add metadata rows
  csvRows.push(['DATA EMISSÃO', meta.issueDate]);
  csvRows.push(['Total', finalTotal.toFixed(2)]);
  
  if (meta.name && meta.identifier) {
    csvRows.push(['Loja:', meta.name, meta.identifier]);
  }
  
  // Add header row
  csvRows.push([
    'Data',
    'Dia da Semana',
    'Consumo Médio (m³)',
    'Consumo Mínimo (m³)',
    'Consumo Máximo (m³)',
    'Consumo (m³)'
  ]);
  
  // Add data rows
  rows.forEach((row) => {
    csvRows.push([
      row.formattedDate,
      row.day,
      String(row.avgConsumption),
      String(row.minDemand),
      String(row.maxDemand),
      String(row.totalConsumption)
    ]);
  });
  
  // Convert to CSV string using semicolon delimiter (pt-BR standard)
  return csvRows.map(row => row.join(';')).join('\n');
}

/**
 * Builds a CSV string for all stores water consumption report
 * @param rows - Array of store consumption data
 * @param meta - Metadata including issue date and total
 * @returns CSV content as string
 */
export function buildWaterStoresCSV(
  rows: StoreRow[],
  meta: {
    issueDate: string;
    total?: number;
  }
): string {
  if (!rows || rows.length === 0) {
    return '';
  }
  
  const csvRows: string[][] = [];
  
  // Calculate total consumption (prefer M3, fallback to Kwh for backward compatibility)
  let totalConsumption = 0;
  rows.forEach((row) => {
    const consumption = row.consumptionM3 !== undefined 
      ? row.consumptionM3 
      : (row.consumptionKwh || 0);
    totalConsumption += consumption;
  });
  
  // Use provided total or calculated total
  const finalTotal = meta.total !== undefined ? meta.total : totalConsumption;
  
  // Add metadata rows
  csvRows.push(['DATA EMISSÃO', meta.issueDate]);
  csvRows.push(['Total', finalTotal.toFixed(2)]);
  csvRows.push(['Loja', 'Identificador', 'Consumo']);
  
  // Add data rows
  rows.forEach((row) => {
    const label = row.entityLabel || row.deviceName || '-';
    const deviceId = row.deviceId || '-';
    const consumption = row.consumptionM3 !== undefined 
      ? row.consumptionM3 
      : (row.consumptionKwh || 0);
    
    const formattedConsumption = consumption !== null && consumption !== undefined
      ? formatNumberReadable(consumption)
      : '0,00';
    
    csvRows.push([label, deviceId, formattedConsumption]);
  });
  
  // Convert to CSV string using semicolon delimiter (pt-BR standard)
  return csvRows.map(row => row.join(';')).join('\n');
}

/**
 * Basic CSV generation function that converts 2D array to CSV string
 * @param rows - 2D array of strings/numbers
 * @param delimiter - Delimiter to use (defaults to semicolon for pt-BR)
 * @returns CSV content as string
 */
export function toCSV(rows: (string | number)[][], delimiter: string = ';'): string {
  if (!rows || rows.length === 0) {
    return '';
  }
  
  return rows.map(row => 
    row.map(cell => {
      const value = String(cell);
      // Escape values that contain the delimiter, quotes, or newlines
      if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(delimiter)
  ).join('\n');
}
