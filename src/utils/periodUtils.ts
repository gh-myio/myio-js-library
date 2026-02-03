/**
 * Period Utilities for MYIO JS Library
 * RFC-XXXX: Reusable period-related helper functions
 */

/**
 * Interface representing a time period for data queries
 */
export interface Period {
  /** Start timestamp in ISO 8601 format with timezone */
  startISO: string;
  /** End timestamp in ISO 8601 format with timezone */
  endISO: string;
  /** Timezone identifier (IANA format) */
  tz: string;
  /** Data aggregation level (hour, day, month, etc.) */
  granularity: string;
}

/**
 * Generates a cache key for period-based data requests
 *
 * RFC-0130: Creates a unique key combining customer, domain, and period details
 * Used for caching telemetry data and preventing duplicate requests
 *
 * @param customerTbId - ThingsBoard customer entity ID (required, no fallback)
 * @param domain - Data domain ('energy', 'water', 'temperature')
 * @param period - Time period configuration
 * @returns Cache key string in format: customerId:domain:startISO:endISO:granularity
 *
 * @example
 * ```typescript
 * const key = periodKey('customer-123', 'energy', {
 *   startISO: '2023-01-01T00:00:00Z',
 *   endISO: '2023-01-02T00:00:00Z',
 *   tz: 'America/Sao_Paulo',
 *   granularity: '1h'
 * });
 * // Returns: "customer-123:energy:2023-01-01T00:00:00Z:2023-01-02T00:00:00Z:1h"
 * ```
 */
export function periodKey(customerTbId: string, domain: string, period: Period): string {
  // Validate required parameters
  if (!customerTbId || typeof customerTbId !== 'string') {
    throw new Error('customerTbId is required and must be a string');
  }
  if (!domain || typeof domain !== 'string') {
    throw new Error('domain is required and must be a string');
  }
  if (!period || typeof period !== 'object') {
    throw new Error('period is required and must be an object');
  }
  if (!period.startISO || !period.endISO || !period.granularity) {
    throw new Error('period must have startISO, endISO, and granularity properties');
  }

  return `${customerTbId}:${domain}:${period.startISO}:${period.endISO}:${period.granularity}`;
}
