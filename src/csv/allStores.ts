/**
 * Exports data to CSV format for all stores/entities
 * @param storesData - Object containing data for multiple stores/entities
 * @param headers - Array of header strings for the CSV
 * @param filename - Optional filename for the CSV (without extension)
 * @returns CSV content as a string
 */
export function exportToCSVAll(
  storesData: Record<string, Record<string, any>[]>,
  headers: string[],
  filename?: string
): string {
  if (!storesData || Object.keys(storesData).length === 0) {
    return '';
  }
  
  const csvRows: string[] = [];
  
  // Add headers with store name column
  const csvHeaders = ['Store', ...headers].join(',');
  csvRows.push(csvHeaders);
  
  // Process each store's data
  Object.entries(storesData).forEach(([storeName, storeData]) => {
    if (!storeData || storeData.length === 0) {
      return;
    }
    
    storeData.forEach(row => {
      // Handle store name with special characters
      let formattedStoreName = storeName;
      if (storeName.includes(',') || storeName.includes('"') || storeName.includes('\n')) {
        formattedStoreName = `"${storeName.replace(/"/g, '""')}"`;
      }
      
      const csvRow = [formattedStoreName, ...headers.map(header => {
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
      })].join(',');
      
      csvRows.push(csvRow);
    });
  });
  
  return csvRows.join('\n');
}
