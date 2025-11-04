/**
 * Telemetry Utilities for MYIO JS Library
 * RFC-0061: Reusable telemetry helper functions
 *
 * Provides detection, caching, and utility functions for telemetry data management
 */

import { TelemetryType, TELEMETRY_TYPES } from '../components/DemandModal';

/**
 * Detects the telemetry type from incoming keys
 * Maps telemetry keys to predefined TelemetryType configurations
 *
 * @param keys - Telemetry keys string (comma-separated) or array
 * @returns Matching TelemetryType or default (total_power)
 */
export function detectTelemetryType(keys: string | string[] | undefined): TelemetryType {
  // Handle undefined/null keys - default to total_power
  if (!keys) {
    return TELEMETRY_TYPES.total_power;
  }

  // Normalize keys to comma-separated string for comparison
  const keyStr = Array.isArray(keys)
    ? keys.map(k => k.trim()).join(',')
    : keys.trim();

  // Check each telemetry type for a match
  for (const type of Object.values(TELEMETRY_TYPES)) {
    const typeKeys = Array.isArray(type.keys)
      ? type.keys.map(k => k.trim()).join(',')
      : type.keys.trim();

    if (typeKeys === keyStr) {
      return type;
    }
  }

  // Default fallback: total_power
  return TELEMETRY_TYPES.total_power;
}

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time-to-live in milliseconds
}

/**
 * In-memory cache for telemetry data
 * LRU-like behavior with TTL expiration
 */
const telemetryCache = new Map<string, CacheEntry<any>>();

/**
 * Default cache TTL: 5 minutes (300,000 milliseconds)
 */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Maximum cache size (prevent memory leaks)
 */
const MAX_CACHE_SIZE = 50;

/**
 * Generates a cache key for telemetry data
 *
 * @param params - Parameters for cache key generation
 * @returns Cache key string
 */
export function getCacheKey(params: {
  deviceId: string;
  startDate: string;
  endDate: string;
  keys: string | string[];
  agg?: string;
  interval?: number;
}): string {
  const keysStr = Array.isArray(params.keys) ? params.keys.join(',') : params.keys;
  const agg = params.agg || 'MAX';
  const interval = params.interval || 86400000;

  return `${params.deviceId}:${params.startDate}:${params.endDate}:${keysStr}:${agg}:${interval}`;
}

/**
 * Retrieves cached telemetry data if valid
 *
 * @param cacheKey - Cache key to lookup
 * @returns Cached data or null if not found/expired
 */
export function getCachedData<T>(cacheKey: string): T | null {
  const entry = telemetryCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  // Check if cache entry has expired
  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    // Expired - remove from cache
    telemetryCache.delete(cacheKey);
    return null;
  }

  return entry.data;
}

/**
 * Stores telemetry data in cache with TTL
 *
 * @param cacheKey - Cache key for storage
 * @param data - Data to cache
 * @param ttl - Time-to-live in milliseconds (default: 5 minutes)
 */
export function setCachedData<T>(
  cacheKey: string,
  data: T,
  ttl: number = DEFAULT_CACHE_TTL
): void {
  // Implement LRU-like eviction if cache is full
  if (telemetryCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first entry in Map)
    const firstKey = telemetryCache.keys().next().value;
    if (firstKey) {
      telemetryCache.delete(firstKey);
    }
  }

  telemetryCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

/**
 * Clears all cached telemetry data
 * Useful for testing or forced refresh scenarios
 */
export function clearTelemetryCache(): void {
  telemetryCache.clear();
}

/**
 * Gets cache statistics (for debugging/monitoring)
 *
 * @returns Cache statistics object
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  entries: Array<{ key: string; age: number; ttl: number }>;
} {
  const now = Date.now();
  const entries: Array<{ key: string; age: number; ttl: number }> = [];

  telemetryCache.forEach((entry, key) => {
    entries.push({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl
    });
  });

  return {
    size: telemetryCache.size,
    maxSize: MAX_CACHE_SIZE,
    entries
  };
}
