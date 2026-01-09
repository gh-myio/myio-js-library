/**
 * RFC-0135: Telegram Notification Queue - Priority Resolver Tests
 * Unit tests for priority resolution logic using Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolvePriority,
  fetchCustomerPriorityRules,
  getDeviceProfileDefaultPriority,
  getGlobalFallbackPriority,
  invalidateCache,
  clearAllCache,
  getCacheStats,
  buildDefaultCustomerConfig,
  validateCustomerConfig,
  Priority
} from '../src/thingsboard/alarm-queue-setup/v1.0.0/lib/priorityResolver.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Telegram Queue - priorityResolver', () => {
  beforeEach(() => {
    clearAllCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearAllCache();
  });

  describe('fetchCustomerPriorityRules', () => {
    it('should fetch and parse customer configuration', async () => {
      const customerConfig = {
        enabled: true,
        priorityRules: {
          deviceProfiles: { '3F_MEDIDOR': 2 },
          deviceOverrides: { 'device-1': 1 }
        },
        rateControl: {
          batchSize: 5,
          delayBetweenBatchesSeconds: 60
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          telegram_queue_config: JSON.stringify(customerConfig)
        })
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      const result = await fetchCustomerPriorityRules(config, 'customer-uuid');

      expect(result).toEqual(customerConfig);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('customer-uuid'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('should cache customer configuration', async () => {
      const customerConfig = {
        enabled: true,
        priorityRules: { deviceProfiles: {} }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          telegram_queue_config: JSON.stringify(customerConfig)
        })
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      // First call - fetches from API
      const result1 = await fetchCustomerPriorityRules(config, 'customer-uuid');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - returns from cache
      const result2 = await fetchCustomerPriorityRules(config, 'customer-uuid');
      expect(global.fetch).toHaveBeenCalledTimes(1); // Not called again
      expect(result2).toEqual(result1);
    });

    it('should return null for 404 response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      const result = await fetchCustomerPriorityRules(config, 'customer-uuid');

      expect(result).toBeNull();
    });

    it('should return null for invalid config structure', async () => {
      const invalidConfig = {
        enabled: true
        // Missing priorityRules
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          telegram_queue_config: JSON.stringify(invalidConfig)
        })
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      const result = await fetchCustomerPriorityRules(config, 'customer-uuid');

      expect(result).toBeNull();
    });
  });

  describe('resolvePriority', () => {
    it('should use device override (highest priority)', async () => {
      const customerConfig = {
        priorityRules: {
          deviceProfiles: { '3F_MEDIDOR': 2 },
          deviceOverrides: { 'device-1': 1 },
          globalDefault: 3
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          telegram_queue_config: JSON.stringify(customerConfig)
        })
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      const priority = await resolvePriority(
        config,
        'customer-uuid',
        'device-1',
        '3F_MEDIDOR'
      );

      expect(priority).toBe(1); // Device override
    });

    it('should use device profile rule if no override', async () => {
      const customerConfig = {
        priorityRules: {
          deviceProfiles: { '3F_MEDIDOR': 2 },
          deviceOverrides: {},
          globalDefault: 3
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          telegram_queue_config: JSON.stringify(customerConfig)
        })
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      const priority = await resolvePriority(
        config,
        'customer-uuid',
        'device-2',
        '3F_MEDIDOR'
      );

      expect(priority).toBe(2); // Device profile rule
    });

    it('should use customer global default if no profile rule', async () => {
      const customerConfig = {
        priorityRules: {
          deviceProfiles: {},
          deviceOverrides: {},
          globalDefault: 4
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          telegram_queue_config: JSON.stringify(customerConfig)
        })
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      const priority = await resolvePriority(
        config,
        'customer-uuid',
        'device-3',
        'UNKNOWN_PROFILE'
      );

      expect(priority).toBe(4); // Customer global default
    });

    it('should use system global fallback if no config', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      const priority = await resolvePriority(
        config,
        'customer-uuid',
        'device-4',
        'UNKNOWN_PROFILE'
      );

      expect(priority).toBe(Priority.MEDIUM); // System global fallback
    });

    it('should handle invalid priority values', async () => {
      const customerConfig = {
        priorityRules: {
          deviceOverrides: { 'device-1': 999 }
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          telegram_queue_config: JSON.stringify(customerConfig)
        })
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      const priority = await resolvePriority(
        config,
        'customer-uuid',
        'device-1',
        '3F_MEDIDOR'
      );

      expect(priority).toBe(Priority.MEDIUM); // Fallback for invalid value
    });

    it('should return global fallback on error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      const priority = await resolvePriority(
        config,
        'customer-uuid',
        'device-1',
        '3F_MEDIDOR'
      );

      expect(priority).toBe(Priority.MEDIUM);
    });
  });

  describe('getDeviceProfileDefaultPriority', () => {
    it('should return CRITICAL for entrada devices', () => {
      expect(getDeviceProfileDefaultPriority('ENTRADA')).toBe(Priority.CRITICAL);
      expect(getDeviceProfileDefaultPriority('RELOGIO')).toBe(Priority.CRITICAL);
      expect(getDeviceProfileDefaultPriority('TRAFO')).toBe(Priority.CRITICAL);
      expect(getDeviceProfileDefaultPriority('SUBESTACAO')).toBe(Priority.CRITICAL);
    });

    it('should return HIGH for meters', () => {
      expect(getDeviceProfileDefaultPriority('3F_MEDIDOR')).toBe(Priority.HIGH);
      expect(getDeviceProfileDefaultPriority('HIDROMETRO')).toBe(Priority.HIGH);
      expect(getDeviceProfileDefaultPriority('HIDROMETRO_SHOPPING')).toBe(Priority.HIGH);
    });

    it('should return LOW for thermostats', () => {
      expect(getDeviceProfileDefaultPriority('TERMOSTATO')).toBe(Priority.LOW);
      expect(getDeviceProfileDefaultPriority('TERMOSTATO_EXTERNAL')).toBe(Priority.LOW);
    });

    it('should return MEDIUM for unknown profiles', () => {
      expect(getDeviceProfileDefaultPriority('UNKNOWN')).toBe(Priority.MEDIUM);
      expect(getDeviceProfileDefaultPriority('')).toBe(Priority.MEDIUM);
      expect(getDeviceProfileDefaultPriority(null)).toBe(Priority.MEDIUM);
    });

    it('should be case-insensitive', () => {
      expect(getDeviceProfileDefaultPriority('entrada')).toBe(Priority.CRITICAL);
      expect(getDeviceProfileDefaultPriority('3f_medidor')).toBe(Priority.HIGH);
      expect(getDeviceProfileDefaultPriority('termostato')).toBe(Priority.LOW);
    });
  });

  describe('getGlobalFallbackPriority', () => {
    it('should return MEDIUM as global fallback', () => {
      expect(getGlobalFallbackPriority()).toBe(Priority.MEDIUM);
      expect(getGlobalFallbackPriority()).toBe(3);
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache for specific customer', async () => {
      const customerConfig = {
        priorityRules: { deviceProfiles: {} }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          telegram_queue_config: JSON.stringify(customerConfig)
        })
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      // First call - fetches from API
      await fetchCustomerPriorityRules(config, 'customer-uuid');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Invalidate cache
      invalidateCache('customer-uuid');

      // Next call - fetches again
      await fetchCustomerPriorityRules(config, 'customer-uuid');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should clear all cached rules', async () => {
      const customerConfig = {
        priorityRules: { deviceProfiles: {} }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          telegram_queue_config: JSON.stringify(customerConfig)
        })
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      // Cache for two customers
      await fetchCustomerPriorityRules(config, 'customer-1');
      await fetchCustomerPriorityRules(config, 'customer-2');
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Clear all cache
      clearAllCache();

      // Both should fetch again
      await fetchCustomerPriorityRules(config, 'customer-1');
      await fetchCustomerPriorityRules(config, 'customer-2');
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });

    it('should provide cache statistics', async () => {
      const customerConfig = {
        priorityRules: { deviceProfiles: {} }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          telegram_queue_config: JSON.stringify(customerConfig)
        })
      });

      const config = {
        baseUrl: 'https://tb.example.com',
        authToken: 'test-token'
      };

      const stats1 = getCacheStats();
      expect(stats1.size).toBe(0);

      await fetchCustomerPriorityRules(config, 'customer-1');
      await fetchCustomerPriorityRules(config, 'customer-2');

      const stats2 = getCacheStats();
      expect(stats2.size).toBe(2);
      expect(stats2.customerIds).toContain('customer-1');
      expect(stats2.customerIds).toContain('customer-2');
      expect(stats2.ttlMs).toBe(5 * 60 * 1000);
    });
  });

  describe('buildDefaultCustomerConfig', () => {
    it('should build default configuration', () => {
      const config = buildDefaultCustomerConfig();

      expect(config.enabled).toBe(true);
      expect(config.priorityRules.deviceProfiles['3F_MEDIDOR']).toBe(Priority.HIGH);
      expect(config.priorityRules.deviceProfiles['ENTRADA']).toBe(Priority.CRITICAL);
      expect(config.priorityRules.globalDefault).toBe(Priority.MEDIUM);
      expect(config.rateControl.batchSize).toBe(5);
      expect(config.rateControl.delayBetweenBatchesSeconds).toBe(60);
      expect(config.rateControl.maxRetries).toBe(3);
      expect(config.rateControl.retryBackoff).toBe('exponential');
    });

    it('should merge overrides', () => {
      const config = buildDefaultCustomerConfig({
        rateControl: {
          batchSize: 10
        },
        telegram: {
          botToken: 'test-token',
          chatId: '-123'
        }
      });

      expect(config.rateControl.batchSize).toBe(10);
      expect(config.rateControl.delayBetweenBatchesSeconds).toBe(60); // Default
      expect(config.telegram.botToken).toBe('test-token');
      expect(config.telegram.chatId).toBe('-123');
    });
  });

  describe('validateCustomerConfig', () => {
    it('should validate correct configuration', () => {
      const config = buildDefaultCustomerConfig({
        telegram: { botToken: 'test', chatId: '-123' }
      });

      const result = validateCustomerConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing enabled flag', () => {
      const config = {
        priorityRules: { deviceProfiles: {}, deviceOverrides: {} },
        rateControl: { batchSize: 5, delayBetweenBatchesSeconds: 60, maxRetries: 3, retryBackoff: 'exponential' },
        telegram: { botToken: 'test', chatId: '-123' }
      };

      const result = validateCustomerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('enabled must be a boolean');
    });

    it('should detect missing priority rules', () => {
      const config = {
        enabled: true,
        rateControl: { batchSize: 5, delayBetweenBatchesSeconds: 60, maxRetries: 3, retryBackoff: 'exponential' },
        telegram: { botToken: 'test', chatId: '-123' }
      };

      const result = validateCustomerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('priorityRules is required');
    });

    it('should detect invalid batch size', () => {
      const config = buildDefaultCustomerConfig({
        rateControl: { batchSize: -5 },
        telegram: { botToken: 'test', chatId: '-123' }
      });

      const result = validateCustomerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('batchSize'))).toBe(true);
    });

    it('should detect invalid retry backoff', () => {
      const config = buildDefaultCustomerConfig({
        rateControl: { retryBackoff: 'invalid' },
        telegram: { botToken: 'test', chatId: '-123' }
      });

      const result = validateCustomerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('retryBackoff'))).toBe(true);
    });

    it('should detect missing telegram configuration', () => {
      const config = {
        enabled: true,
        priorityRules: { deviceProfiles: {}, deviceOverrides: {} },
        rateControl: { batchSize: 5, delayBetweenBatchesSeconds: 60, maxRetries: 3, retryBackoff: 'exponential' }
      };

      const result = validateCustomerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('telegram configuration is required');
    });
  });
});
