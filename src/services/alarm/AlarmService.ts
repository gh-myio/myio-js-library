// RFC-0175: Alarm Service — Singleton facade for Alarms Backend API

import { AlarmApiClient } from './AlarmApiClient';
import type { AvailabilityResponse } from './types';

const AVAILABILITY_CACHE_TTL_MS = 60 * 1000; // 60 seconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class AlarmServiceClass {
  private readonly client = new AlarmApiClient();
  private readonly availabilityCache = new Map<string, CacheEntry<AvailabilityResponse>>();

  /**
   * Fetches MTBF, MTTR, and Availability metrics per device and fleet-wide.
   * Results are cached for 60 seconds.
   *
   * @param customerId - GCDR customer ID (ingestionId from TB attributes)
   * @param startAt    - Period start in ISO 8601 format
   * @param endAt      - Period end in ISO 8601 format
   */
  async getAvailability(
    customerId: string,
    startAt: string,
    endAt: string
  ): Promise<AvailabilityResponse> {
    if (!customerId) {
      throw new Error('AlarmService.getAvailability: customerId is required');
    }

    const cacheKey = `${customerId}:${startAt}:${endAt}`;
    const cached = this.availabilityCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < AVAILABILITY_CACHE_TTL_MS) {
      return cached.data;
    }

    const data = await this.client.getAvailability({
      customerId,
      startAt,
      endAt,
      includeByDevice: true,
    });

    this.availabilityCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  clearCache(): void {
    this.availabilityCache.clear();
  }
}

export const AlarmService = new AlarmServiceClass();
