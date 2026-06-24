/**
 * Exports data to CSV format for a single report
 * @param data - Array of data objects to export
 * @param headers - Array of header strings for the CSV
 * @param filename - Optional filename for the CSV (without extension)
 * @returns CSV content as a string
 */
export function exportToCSV(
  data: Record<string, any>[],
  headers: string[],
  filename?: string
): string {
  if (!data || data.length === 0) {
    return '';
  }
  
  // Create CSV header row
  const csvHeaders = headers.join(',');
  
  // Create CSV data rows
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      
      // Handle null/undefined values
      if (value === null || value === undefined) {
        return '';
      }
      
      // Convert to string and escape quotes
      const stringValue = String(value);
      
      // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    }).join(',');
  });
  
  // Combine headers and rows
  const csvContent = [csvHeaders, ...csvRows].join('\n');
  
  return csvContent;
}
