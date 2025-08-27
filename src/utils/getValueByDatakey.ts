/**
 * Retrieves a value from data using a datakey path (improved version)
 * @param data - The data object or array to search in
 * @param datakey - The key path to the desired value (supports dot notation and array indices)
 * @returns The value found at the datakey path, or undefined if not found
 */
export function getValueByDatakey(data: any, datakey: string): any {
  if (!data || !datakey) {
    return undefined;
  }
  
  // Handle array of objects - search for the datakey in each object
  if (Array.isArray(data)) {
    for (const item of data) {
      const value = getValueByDatakey(item, datakey);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }
  
  // Handle object - navigate through the datakey path
  if (typeof data === 'object' && data !== null) {
    // Split datakey by dots to handle nested properties
    const keys = datakey.split('.');
    let current = data;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // Handle array indices in square brackets
      if (key.includes('[') && key.includes(']')) {
        const arrayKey = key.substring(0, key.indexOf('['));
        const indexMatch = key.match(/\[(\d+)\]/);
        
        if (indexMatch) {
          const index = parseInt(indexMatch[1], 10);
          current = current[arrayKey];
          
          if (Array.isArray(current) && index >= 0 && index < current.length) {
            current = current[index];
          } else {
            return undefined;
          }
        } else {
          return undefined;
        }
      } else {
        current = current[key];
      }
    }
    
    return current;
  }
  
  return undefined;
}

/**
 * Legacy compatibility function for ThingsBoard widgets
 * Searches for a value in a data list by matching dataSourceName and dataKey
 * @param dataList - Array of data objects to search in
 * @param dataSourceNameTarget - The target data source name to match
 * @param dataKeyTarget - The target data key to match
 * @returns The value found, or undefined if not found
 * @deprecated Use getValueByDatakey(data, datakey) instead for better flexibility
 */
export function getValueByDatakeyLegacy(
  dataList: any[], 
  dataSourceNameTarget: string, 
  dataKeyTarget: string
): any {
  if (!Array.isArray(dataList) || !dataSourceNameTarget || !dataKeyTarget) {
    return undefined;
  }
  
  for (const item of dataList) {
    if (item && 
        item.dataSourceName === dataSourceNameTarget && 
        item.dataKey === dataKeyTarget) {
      return item.value;
    }
  }
  
  return undefined;
}

/**
 * Searches for a value in ThingsBoard-style data structures
 * Supports both legacy format (dataSourceName/dataKey) and modern path-based access
 * @param data - The data to search in (object, array, or ThingsBoard data list)
 * @param keyOrPath - Either a simple datakey path or dataSourceName for legacy mode
 * @param legacyDataKey - Optional dataKey for legacy ThingsBoard compatibility
 * @returns The value found, or undefined if not found
 */
export function findValue(data: any, keyOrPath: string, legacyDataKey?: string): any {
  // Legacy mode: if legacyDataKey is provided, use ThingsBoard-style search
  if (legacyDataKey !== undefined) {
    return getValueByDatakeyLegacy(data, keyOrPath, legacyDataKey);
  }
  
  // Modern mode: use path-based search
  return getValueByDatakey(data, keyOrPath);
}
