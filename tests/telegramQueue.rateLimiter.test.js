/**
 * RFC-0135: Telegram Notification Queue - Rate Limiter Tests
 * Unit tests for rate limiting and backoff logic using Vitest
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  canSendBatch,
  getWaitTime,
  recordBatchDispatch,
  calculateRetryDelay,
  shouldRetryNow,
  getNextRetryTime,
  getRateLimitStats,
  resetRateLimitState,
  applyRateLimit
} from '../src/thingsboard/alarm-queue-setup/v1.0.0/lib/rateLimiter.js';

describe('Telegram Queue - rateLimiter', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      getRateLimitState: vi.fn(),
      updateRateLimitState: vi.fn().mockResolvedValue()
    };
    vi.clearAllMocks();
  });

  describe('canSendBatch', () => {
    it('should return true if no previous dispatch', async () => {
      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: 0,
        batchCount: 0
      });

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const result = await canSendBatch(config, 'customer-uuid');

      expect(result).toBe(true);
    });

    it('should return true if enough time has passed', async () => {
      const now = Date.now();
      const lastDispatch = now - 61000; // 61 seconds ago

      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: lastDispatch,
        batchCount: 1
      });

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const result = await canSendBatch(config, 'customer-uuid');

      expect(result).toBe(true);
    });

    it('should return false if not enough time has passed', async () => {
      const now = Date.now();
      const lastDispatch = now - 30000; // 30 seconds ago

      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: lastDispatch,
        batchCount: 1
      });

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const result = await canSendBatch(config, 'customer-uuid');

      expect(result).toBe(false);
    });

    it('should fail open on error', async () => {
      mockStorage.getRateLimitState.mockRejectedValue(new Error('Storage error'));

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const result = await canSendBatch(config, 'customer-uuid');

      expect(result).toBe(true); // Fail open
    });
  });

  describe('getWaitTime', () => {
    it('should return 0 if no previous dispatch', async () => {
      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: 0
      });

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const result = await getWaitTime(config, 'customer-uuid');

      expect(result).toBe(0);
    });

    it('should calculate remaining wait time', async () => {
      const now = Date.now();
      const lastDispatch = now - 30000; // 30 seconds ago
      const delayMs = 60000; // 60 seconds
      const expectedWait = delayMs - 30000; // 30 seconds remaining

      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: lastDispatch
      });

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const result = await getWaitTime(config, 'customer-uuid');

      expect(result).toBeGreaterThanOrEqual(expectedWait - 100); // Allow 100ms tolerance
      expect(result).toBeLessThanOrEqual(expectedWait + 100);
    });

    it('should return 0 if wait time is negative', async () => {
      const now = Date.now();
      const lastDispatch = now - 70000; // 70 seconds ago

      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: lastDispatch
      });

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const result = await getWaitTime(config, 'customer-uuid');

      expect(result).toBe(0);
    });

    it('should return 0 on error', async () => {
      mockStorage.getRateLimitState.mockRejectedValue(new Error('Storage error'));

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const result = await getWaitTime(config, 'customer-uuid');

      expect(result).toBe(0);
    });
  });

  describe('recordBatchDispatch', () => {
    it('should update rate limit state', async () => {
      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: 0,
        batchCount: 0
      });

      const config = {
        storage: mockStorage
      };

      await recordBatchDispatch(config, 'customer-uuid', 5);

      expect(mockStorage.updateRateLimitState).toHaveBeenCalledWith(
        'customer-uuid',
        expect.objectContaining({
          lastDispatchAt: expect.any(Number),
          batchCount: 1
        })
      );
    });

    it('should increment batch count', async () => {
      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: Date.now() - 60000,
        batchCount: 3
      });

      const config = {
        storage: mockStorage
      };

      await recordBatchDispatch(config, 'customer-uuid', 5);

      expect(mockStorage.updateRateLimitState).toHaveBeenCalledWith(
        'customer-uuid',
        expect.objectContaining({
          batchCount: 4
        })
      );
    });

    it('should not throw on error', async () => {
      mockStorage.getRateLimitState.mockRejectedValue(new Error('Storage error'));

      const config = {
        storage: mockStorage
      };

      await expect(recordBatchDispatch(config, 'customer-uuid', 5))
        .resolves
        .not.toThrow();
    });
  });

  describe('calculateRetryDelay', () => {
    describe('exponential backoff', () => {
      it('should calculate exponential delays', () => {
        expect(calculateRetryDelay(0, 'exponential', 10)).toBe(10000); // 10s * 2^0
        expect(calculateRetryDelay(1, 'exponential', 10)).toBe(20000); // 10s * 2^1
        expect(calculateRetryDelay(2, 'exponential', 10)).toBe(40000); // 10s * 2^2
        expect(calculateRetryDelay(3, 'exponential', 10)).toBe(80000); // 10s * 2^3
      });

      it('should handle negative retry counts', () => {
        expect(calculateRetryDelay(-1, 'exponential', 10)).toBe(10000);
        expect(calculateRetryDelay(-5, 'exponential', 10)).toBe(10000);
      });

      it('should handle zero base delay', () => {
        expect(calculateRetryDelay(2, 'exponential', 0)).toBe(40000); // Uses default 10s
      });
    });

    describe('linear backoff', () => {
      it('should calculate linear delays', () => {
        expect(calculateRetryDelay(0, 'linear', 10)).toBe(10000); // 10s * (0 + 1)
        expect(calculateRetryDelay(1, 'linear', 10)).toBe(20000); // 10s * (1 + 1)
        expect(calculateRetryDelay(2, 'linear', 10)).toBe(30000); // 10s * (2 + 1)
        expect(calculateRetryDelay(3, 'linear', 10)).toBe(40000); // 10s * (3 + 1)
      });

      it('should handle negative retry counts', () => {
        expect(calculateRetryDelay(-1, 'linear', 10)).toBe(10000);
      });
    });

    describe('unknown strategy', () => {
      it('should default to linear for unknown strategies', () => {
        expect(calculateRetryDelay(2, 'unknown', 10)).toBe(30000);
        expect(calculateRetryDelay(2, 'invalid', 10)).toBe(30000);
        expect(calculateRetryDelay(2, '', 10)).toBe(30000);
      });
    });
  });

  describe('shouldRetryNow', () => {
    it('should return true if no previous attempt', () => {
      const entry = {
        lastAttemptAt: null,
        retryCount: 0
      };

      const rateControl = {
        retryBackoff: 'exponential',
        retryBaseDelaySeconds: 10
      };

      const result = shouldRetryNow(entry, rateControl);

      expect(result).toBe(true);
    });

    it('should return true if enough time has passed', () => {
      const now = Date.now();
      const entry = {
        lastAttemptAt: now - 25000, // 25 seconds ago
        retryCount: 1
      };

      const rateControl = {
        retryBackoff: 'exponential',
        retryBaseDelaySeconds: 10
      };

      // For retry count 1, exponential delay is 20s (10s * 2^1)
      // 25s has passed, so should retry now

      const result = shouldRetryNow(entry, rateControl);

      expect(result).toBe(true);
    });

    it('should return false if not enough time has passed', () => {
      const now = Date.now();
      const entry = {
        lastAttemptAt: now - 15000, // 15 seconds ago
        retryCount: 1
      };

      const rateControl = {
        retryBackoff: 'exponential',
        retryBaseDelaySeconds: 10
      };

      // For retry count 1, exponential delay is 20s (10s * 2^1)
      // Only 15s has passed, so should wait

      const result = shouldRetryNow(entry, rateControl);

      expect(result).toBe(false);
    });
  });

  describe('getNextRetryTime', () => {
    it('should return current time if no previous attempt', () => {
      const entry = {
        lastAttemptAt: null,
        retryCount: 0
      };

      const rateControl = {
        retryBackoff: 'exponential',
        retryBaseDelaySeconds: 10
      };

      const before = Date.now();
      const result = getNextRetryTime(entry, rateControl);
      const after = Date.now();

      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });

    it('should calculate next retry time', () => {
      const lastAttempt = Date.now();
      const entry = {
        lastAttemptAt: lastAttempt,
        retryCount: 1
      };

      const rateControl = {
        retryBackoff: 'exponential',
        retryBaseDelaySeconds: 10
      };

      // For retry count 1, delay is 20s
      const expectedTime = lastAttempt + 20000;

      const result = getNextRetryTime(entry, rateControl);

      expect(result).toBe(expectedTime);
    });
  });

  describe('getRateLimitStats', () => {
    it('should return comprehensive statistics', async () => {
      const now = Date.now();
      const lastDispatch = now - 30000; // 30 seconds ago

      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: lastDispatch,
        batchCount: 5
      });

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const stats = await getRateLimitStats(config, 'customer-uuid');

      expect(stats).toMatchObject({
        lastDispatchAt: lastDispatch,
        batchCount: 5,
        timeSinceLastDispatchSeconds: 30,
        canSendNow: false,
        waitTimeSeconds: 30
      });
    });

    it('should handle no previous dispatch', async () => {
      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: 0,
        batchCount: 0
      });

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const stats = await getRateLimitStats(config, 'customer-uuid');

      expect(stats).toMatchObject({
        lastDispatchAt: 0,
        batchCount: 0,
        timeSinceLastDispatchSeconds: 0,
        canSendNow: true,
        waitTimeSeconds: 0
      });
    });
  });

  describe('resetRateLimitState', () => {
    it('should reset state to initial values', async () => {
      const config = {
        storage: mockStorage
      };

      await resetRateLimitState(config, 'customer-uuid');

      expect(mockStorage.updateRateLimitState).toHaveBeenCalledWith(
        'customer-uuid',
        expect.objectContaining({
          lastDispatchAt: 0,
          batchCount: 0
        })
      );
    });
  });

  describe('applyRateLimit', () => {
    it('should return true and not log if can send', async () => {
      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: 0
      });

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const result = await applyRateLimit(config, 'customer-uuid');

      expect(result).toBe(true);
    });

    it('should return false if rate limited', async () => {
      const now = Date.now();
      const lastDispatch = now - 30000; // 30 seconds ago

      mockStorage.getRateLimitState.mockResolvedValue({
        lastDispatchAt: lastDispatch
      });

      const config = {
        storage: mockStorage,
        rateControl: { delayBetweenBatchesSeconds: 60 }
      };

      const result = await applyRateLimit(config, 'customer-uuid');

      expect(result).toBe(false);
    });
  });
});
