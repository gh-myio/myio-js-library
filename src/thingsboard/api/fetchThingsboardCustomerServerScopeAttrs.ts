/**
 * ThingsBoard Customer Server Scope Attributes Fetcher
 * 
 * Utility function to fetch customer server scope attributes from ThingsBoard API.
 * Handles both array and object response formats with proper error handling.
 */

/**
 * Configuration parameters for fetching customer attributes
 */
export interface ThingsboardCustomerAttrsConfig {
  customerId: string;
  tbToken: string;
  baseUrl?: string;
}

/**
 * Fetch customer server scope attributes from ThingsBoard API
 * 
 * @param config Configuration object with customerId and tbToken
 * @returns Promise resolving to attributes map
 * 
 * @example
 * ```typescript
 * const attrs = await fetchThingsboardCustomerServerScopeAttrs({
 *   customerId: 'customer-uuid',
 *   tbToken: 'jwt-token-from-localStorage'
 * });
 * 
 * console.log(attrs.client_id, attrs.client_secret, attrs.ingestionId);
 * ```
 */
export async function fetchThingsboardCustomerServerScopeAttrs(
  config: ThingsboardCustomerAttrsConfig
): Promise<Record<string, any>> {
  const { customerId, tbToken, baseUrl = '' } = config;

  // Validate required parameters
  if (!customerId || !tbToken) {
    throw new Error('customerId and tbToken are required');
  }

  const url = `${baseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${tbToken}`,
      },
    });

    if (!response.ok) {
      console.warn(`[ThingsBoard Customer Attrs] HTTP ${response.status} ${response.statusText}`);
      
      // Return empty object for non-critical errors (like 404)
      if (response.status === 404 || response.status === 403) {
        return {};
      }
      
      // Throw for server errors
      throw new Error(`ThingsBoard API error: HTTP ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    
    // Process the response - can be array or object format
    return processAttributesResponse(payload);
    
  } catch (error) {
    console.error('[ThingsBoard Customer Attrs] Error fetching attributes:', error);
    
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Failed to fetch customer attributes: ${error.message}`);
    }
    
    throw new Error('Failed to fetch customer attributes: Unknown error');
  }
}

/**
 * Process ThingsBoard attributes response into a normalized map
 * Handles both array [{key,value}] and object {key: [{value}]} formats
 * 
 * @param payload Raw response from ThingsBoard API
 * @returns Normalized attributes map
 */
function processAttributesResponse(payload: any): Record<string, any> {
  const attributesMap: Record<string, any> = {};

  if (!payload) {
    return attributesMap;
  }

  // Handle array format: [{key: "client_id", value: "abc123"}, ...]
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (item && typeof item === 'object' && item.key !== undefined) {
        attributesMap[item.key] = item.value;
      }
    }
    return attributesMap;
  }

  // Handle object format: {client_id: [{value: "abc123"}], ...}
  if (typeof payload === 'object') {
    for (const key of Object.keys(payload)) {
      const value = payload[key];
      
      if (Array.isArray(value) && value.length > 0) {
        // Extract value from array format
        const firstItem = value[0];
        attributesMap[key] = firstItem?.value ?? firstItem;
      } else {
        // Direct value assignment
        attributesMap[key] = value;
      }
    }
    return attributesMap;
  }

  console.warn('[ThingsBoard Customer Attrs] Unexpected payload format:', typeof payload);
  return attributesMap;
}

/**
 * Fetch customer attributes with automatic token retrieval from localStorage
 * Convenience function for ThingsBoard widget contexts
 * 
 * @param customerId Customer UUID
 * @param tokenKey localStorage key for JWT token (default: 'jwt_token')
 * @returns Promise resolving to attributes map
 * 
 * @example
 * ```typescript
 * const attrs = await fetchThingsboardCustomerAttrsFromStorage('customer-uuid');
 * ```
 */
export async function fetchThingsboardCustomerAttrsFromStorage(
  customerId: string,
  tokenKey: string = 'jwt_token'
): Promise<Record<string, any>> {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage is not available in this environment');
  }

  const tbToken = localStorage.getItem(tokenKey);
  
  if (!tbToken) {
    throw new Error(`JWT token not found in localStorage (key: ${tokenKey})`);
  }

  return fetchThingsboardCustomerServerScopeAttrs({
    customerId,
    tbToken
  });
}

/**
 * Extract common credentials from attributes map
 * Helper function to get standard MyIO credentials
 * 
 * @param attributes Attributes map from fetchThingsboardCustomerServerScopeAttrs
 * @returns Extracted credentials with fallbacks
 * 
 * @example
 * ```typescript
 * const attrs = await fetchThingsboardCustomerServerScopeAttrs(config);
 * const creds = extractMyIOCredentials(attrs);
 * console.log(creds.clientId, creds.clientSecret, creds.ingestionId);
 * ```
 */
export function extractMyIOCredentials(attributes: Record<string, any> | null | undefined): {
  clientId: string;
  clientSecret: string;
  ingestionId: string;
} {
  // Handle null/undefined attributes
  if (!attributes || typeof attributes !== 'object') {
    return {
      clientId: '',
      clientSecret: '',
      ingestionId: ''
    };
  }

  return {
    clientId: attributes.client_id || attributes.clientId || '',
    clientSecret: attributes.client_secret || attributes.clientSecret || '',
    ingestionId: attributes.ingestionId || attributes.ingestion_id || ''
  };
}
