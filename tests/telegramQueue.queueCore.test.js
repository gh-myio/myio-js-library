/**
 * RFC-0135: Telegram Notification Queue - Queue Core Tests
 * Unit tests for core queue operations using Vitest
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizePayload,
  enqueue,
  dequeue,
  updateStatus,
  getQueueStats,
  shouldRetry,
  QueueStatus,
  Priority
} from '../src/thingsboard/alarm-queue-setup/v1.0.0/lib/queueCore.js';

describe('Telegram Queue - queueCore', () => {
  describe('normalizePayload', () => {
    it('should normalize a valid Rule Chain message', () => {
      const msg = {
        msg: { text: 'Alert message' },
        metadata: {
          deviceType: '3F_MEDIDOR',
          deviceName: 'Device 1',
          ts: '1767878649180'
        },
        msgType: 'POST_TELEMETRY_REQUEST'
      };

      const context = {
        deviceId: 'device-uuid',
        customerId: 'customer-uuid'
      };

      const result = normalizePayload(msg, context);

      expect(result).toMatchObject({
        customerId: 'customer-uuid',
        deviceId: 'device-uuid',
        deviceProfile: '3F_MEDIDOR',
        status: QueueStatus.PENDING,
        retryCount: 0,
        maxRetries: 3
      });

      expect(result.queueId).toBeDefined();
      expect(result.payload.text).toBe('Alert message');
      expect(result.payload.originalDeviceName).toBe('Device 1');
      expect(result.createdAt).toBe(1767878649180);
    });

    it('should handle missing metadata gracefully', () => {
      const msg = {
        msg: { text: 'Test' },
        metadata: {},
        msgType: 'POST_TELEMETRY_REQUEST'
      };

      const result = normalizePayload(msg);

      expect(result.deviceId).toBe('unknown');
      expect(result.customerId).toBe('unknown');
      expect(result.deviceProfile).toBe('unknown');
    });

    it('should use current timestamp if ts is missing', () => {
      const msg = {
        msg: { text: 'Test' },
        metadata: {},
        msgType: 'POST_TELEMETRY_REQUEST'
      };

      const before = Date.now();
      const result = normalizePayload(msg);
      const after = Date.now();

      expect(result.createdAt).toBeGreaterThanOrEqual(before);
      expect(result.createdAt).toBeLessThanOrEqual(after);
    });

    it('should generate unique queue IDs', () => {
      const msg = {
        msg: { text: 'Test' },
        metadata: {},
        msgType: 'POST_TELEMETRY_REQUEST'
      };

      const result1 = normalizePayload(msg);
      const result2 = normalizePayload(msg);

      expect(result1.queueId).not.toBe(result2.queueId);
      expect(result1.queueId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('enqueue', () => {
    let mockStorage;

    beforeEach(() => {
      mockStorage = {
        save: vi.fn().mockResolvedValue('queue-id-123')
      };
    });

    it('should enqueue a message with priority', async () => {
      const payload = {
        queueId: 'queue-id-123',
        customerId: 'customer-uuid',
        deviceId: 'device-uuid',
        deviceProfile: '3F_MEDIDOR',
        priority: Priority.HIGH,
        payload: { text: 'Test' },
        status: QueueStatus.PENDING,
        retryCount: 0,
        createdAt: Date.now()
      };

      const config = { storage: mockStorage };

      const queueId = await enqueue(config, payload);

      expect(queueId).toBe('queue-id-123');
      expect(mockStorage.save).toHaveBeenCalledWith(payload);
    });

    it('should throw error if storage is missing', async () => {
      const payload = { priority: 1 };

      await expect(enqueue({}, payload))
        .rejects
        .toThrow('Storage adapter is required');
    });

    it('should throw error if priority is missing', async () => {
      const payload = { queueId: 'test' };
      const config = { storage: mockStorage };

      await expect(enqueue(config, payload))
        .rejects
        .toThrow('Priority must be set before enqueue');
    });
  });

  describe('dequeue', () => {
    let mockStorage;

    beforeEach(() => {
      mockStorage = {
        fetchByStatusAndPriority: vi.fn()
      };
    });

    it('should fetch pending entries by priority', async () => {
      const pendingEntries = [
        { queueId: '1', priority: 1, status: QueueStatus.PENDING },
        { queueId: '2', priority: 2, status: QueueStatus.PENDING }
      ];

      mockStorage.fetchByStatusAndPriority
        .mockResolvedValueOnce(pendingEntries)
        .mockResolvedValueOnce([]);

      const config = { storage: mockStorage };
      const result = await dequeue(config, 5);

      expect(result).toEqual(pendingEntries);
      expect(mockStorage.fetchByStatusAndPriority).toHaveBeenCalledWith(
        QueueStatus.PENDING,
        5,
        [1, 2, 3, 4]
      );
    });

    it('should include retry entries if pending batch is small', async () => {
      const pendingEntries = [
        { queueId: '1', priority: 1, status: QueueStatus.PENDING }
      ];

      const retryEntries = [
        { queueId: '2', priority: 2, status: QueueStatus.RETRY }
      ];

      mockStorage.fetchByStatusAndPriority
        .mockResolvedValueOnce(pendingEntries)
        .mockResolvedValueOnce(retryEntries);

      const config = { storage: mockStorage };
      const result = await dequeue(config, 5);

      expect(result).toHaveLength(2);
      expect(result).toEqual([...pendingEntries, ...retryEntries]);
      expect(mockStorage.fetchByStatusAndPriority).toHaveBeenCalledTimes(2);
    });

    it('should throw error if batch size is invalid', async () => {
      const config = { storage: mockStorage };

      await expect(dequeue(config, 0))
        .rejects
        .toThrow('Batch size must be positive');

      await expect(dequeue(config, -5))
        .rejects
        .toThrow('Batch size must be positive');
    });
  });

  describe('updateStatus', () => {
    let mockStorage;

    beforeEach(() => {
      mockStorage = {
        updateEntry: vi.fn().mockResolvedValue()
      };
    });

    it('should update status to SENT with timestamp', async () => {
      const config = { storage: mockStorage };
      const queueId = 'queue-id-123';
      const result = {
        httpStatus: 200,
        sentAt: Date.now()
      };

      await updateStatus(config, queueId, QueueStatus.SENT, result);

      expect(mockStorage.updateEntry).toHaveBeenCalledWith(
        queueId,
        expect.objectContaining({
          status: QueueStatus.SENT,
          httpStatus: 200,
          sentAt: result.sentAt,
          lastAttemptAt: expect.any(Number)
        })
      );
    });

    it('should update status to FAILED with error message', async () => {
      const config = { storage: mockStorage };
      const queueId = 'queue-id-123';
      const result = {
        httpStatus: 400,
        errorMessage: 'Bad request'
      };

      await updateStatus(config, queueId, QueueStatus.FAILED, result);

      expect(mockStorage.updateEntry).toHaveBeenCalledWith(
        queueId,
        expect.objectContaining({
          status: QueueStatus.FAILED,
          httpStatus: 400,
          errorMessage: 'Bad request',
          lastAttemptAt: expect.any(Number)
        })
      );
    });

    it('should update status to RETRY with incremented count', async () => {
      const config = { storage: mockStorage };
      const queueId = 'queue-id-123';
      const result = {
        retryCount: 1
      };

      await updateStatus(config, queueId, QueueStatus.RETRY, result);

      expect(mockStorage.updateEntry).toHaveBeenCalledWith(
        queueId,
        expect.objectContaining({
          status: QueueStatus.RETRY,
          retryCount: 1
        })
      );
    });

    it('should throw error for invalid status', async () => {
      const config = { storage: mockStorage };

      await expect(updateStatus(config, 'queue-id', 'INVALID_STATUS', {}))
        .rejects
        .toThrow('Invalid status: INVALID_STATUS');
    });
  });

  describe('getQueueStats', () => {
    let mockStorage;

    beforeEach(() => {
      mockStorage = {
        getStats: vi.fn()
      };
    });

    it('should return queue statistics', async () => {
      const stats = {
        queueDepth: { 1: 5, 2: 10, 3: 15, 4: 8 },
        pendingCount: 38,
        failedCount: 3,
        retryCount: 5,
        sentCount: 120,
        averageDispatchDelaySeconds: 45
      };

      mockStorage.getStats.mockResolvedValue(stats);

      const config = { storage: mockStorage };
      const result = await getQueueStats(config);

      expect(result).toEqual(stats);
      expect(mockStorage.getStats).toHaveBeenCalledWith(null);
    });

    it('should filter by customer ID', async () => {
      const stats = { pendingCount: 10 };
      mockStorage.getStats.mockResolvedValue(stats);

      const config = { storage: mockStorage };
      await getQueueStats(config, 'customer-uuid');

      expect(mockStorage.getStats).toHaveBeenCalledWith('customer-uuid');
    });
  });

  describe('shouldRetry', () => {
    it('should return true if retries remain', () => {
      const entry = { retryCount: 1, maxRetries: 3 };
      expect(shouldRetry(entry)).toBe(true);
    });

    it('should return false if max retries reached', () => {
      const entry = { retryCount: 3, maxRetries: 3 };
      expect(shouldRetry(entry)).toBe(false);
    });

    it('should return false if retries exceeded', () => {
      const entry = { retryCount: 5, maxRetries: 3 };
      expect(shouldRetry(entry)).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should export QueueStatus constants', () => {
      expect(QueueStatus.PENDING).toBe('PENDING');
      expect(QueueStatus.SENDING).toBe('SENDING');
      expect(QueueStatus.SENT).toBe('SENT');
      expect(QueueStatus.FAILED).toBe('FAILED');
      expect(QueueStatus.RETRY).toBe('RETRY');
    });

    it('should export Priority constants', () => {
      expect(Priority.CRITICAL).toBe(1);
      expect(Priority.HIGH).toBe(2);
      expect(Priority.MEDIUM).toBe(3);
      expect(Priority.LOW).toBe(4);
    });
  });
});
