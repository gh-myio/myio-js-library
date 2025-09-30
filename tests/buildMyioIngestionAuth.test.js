/**
 * Unit tests for buildMyioIngestionAuth component
 */

import { 
  buildMyioIngestionAuth, 
  clearAllAuthCaches, 
  getAuthCacheStats 
} from '../src/thingsboard/auth/buildMyioIngestionAuth.js';
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('buildMyioIngestionAuth', () => {
  beforeEach(() => {
    // Clear all caches before each test
    clearAllAuthCaches();
    // Reset fetch mock
    fetch.mockClear();
  });

  afterEach(() => {
    // Clean up after each test
    clearAllAuthCaches();
  });

  test('should create auth instance with required parameters', () => {
    const auth = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret'
    });

    expect(auth).toBeDefined();
    expect(typeof auth.getToken).toBe('function');
    expect(typeof auth.getExpiryInfo).toBe('function');
    expect(typeof auth.clearCache).toBe('function');
    expect(typeof auth.isTokenValid).toBe('function');
  });

  test('should throw error for missing required parameters', () => {
    expect(() => {
      buildMyioIngestionAuth({
        dataApiHost: '',
        clientId: 'test-client',
        clientSecret: 'test-secret'
      });
    }).toThrow('dataApiHost, clientId, and clientSecret are required');

    expect(() => {
      buildMyioIngestionAuth({
        dataApiHost: 'https://api.example.com',
        clientId: '',
        clientSecret: 'test-secret'
      });
    }).toThrow('dataApiHost, clientId, and clientSecret are required');

    expect(() => {
      buildMyioIngestionAuth({
        dataApiHost: 'https://api.example.com',
        clientId: 'test-client',
        clientSecret: ''
      });
    }).toThrow('dataApiHost, clientId, and clientSecret are required');
  });

  test('should successfully obtain token from API', async () => {
    const mockResponse = {
      access_token: 'test-token-123',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read write'
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const auth = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret'
    });

    const token = await auth.getToken();

    expect(token).toBe('test-token-123');
    expect(fetch).toHaveBeenCalledWith(
      new URL('https://api.example.com/api/v1/auth'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: 'test-client',
          client_secret: 'test-secret',
        }),
      }
    );
  });

  test('should return cached token on subsequent calls', async () => {
    const mockResponse = {
      access_token: 'cached-token-456',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read write'
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const auth = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret'
    });

    // First call should fetch from API
    const token1 = await auth.getToken();
    expect(token1).toBe('cached-token-456');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call should return cached token
    const token2 = await auth.getToken();
    expect(token2).toBe('cached-token-456');
    expect(fetch).toHaveBeenCalledTimes(1); // No additional API call
  });

  test('should share cache between instances with same credentials', async () => {
    const mockResponse = {
      access_token: 'shared-token-789',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read write'
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const auth1 = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret'
    });

    const auth2 = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret'
    });

    // First instance fetches token
    const token1 = await auth1.getToken();
    expect(token1).toBe('shared-token-789');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second instance should get cached token
    const token2 = await auth2.getToken();
    expect(token2).toBe('shared-token-789');
    expect(fetch).toHaveBeenCalledTimes(1); // No additional API call
  });

  test('should use separate cache for different credentials', async () => {
    const mockResponse1 = {
      access_token: 'token-client1',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read write'
    };

    const mockResponse2 = {
      access_token: 'token-client2',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read write'
    };

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse1
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse2
      });

    const auth1 = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'client1',
      clientSecret: 'secret1'
    });

    const auth2 = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'client2',
      clientSecret: 'secret2'
    });

    const token1 = await auth1.getToken();
    const token2 = await auth2.getToken();

    expect(token1).toBe('token-client1');
    expect(token2).toBe('token-client2');
    expect(fetch).toHaveBeenCalledTimes(2); // Two separate API calls
  });

  test('should handle API errors with retry logic', async () => {
    // First two calls fail, third succeeds
    fetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'retry-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'read write'
        })
      });

    const auth = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      retryMaxAttempts: 3,
      retryBaseMs: 10 // Fast retry for testing
    });

    const token = await auth.getToken();

    expect(token).toBe('retry-token');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('should throw error after max retry attempts', async () => {
    fetch.mockRejectedValue(new Error('Persistent network error'));

    const auth = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      retryMaxAttempts: 2,
      retryBaseMs: 10
    });

    await expect(auth.getToken()).rejects.toThrow('Persistent network error');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('should handle HTTP error responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid credentials'
    });

    const auth = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'invalid-client',
      clientSecret: 'invalid-secret',
      retryMaxAttempts: 1
    });

    await expect(auth.getToken()).rejects.toThrow('Auth failed: HTTP 401 Unauthorized Invalid credentials');
  });

  test('should handle malformed API response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        // Missing access_token and expires_in
        token_type: 'Bearer',
        scope: 'read write'
      })
    });

    const auth = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      retryMaxAttempts: 1
    });

    await expect(auth.getToken()).rejects.toThrow('Auth response missing required fields');
  });

  test('should provide expiry information', async () => {
    const mockResponse = {
      access_token: 'expiry-test-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read write'
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const auth = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret'
    });

    await auth.getToken();
    const expiryInfo = auth.getExpiryInfo();

    expect(expiryInfo.expiresAt).toBeGreaterThan(Date.now());
    expect(expiryInfo.expiresInSeconds).toBeGreaterThan(3500); // Should be close to 3600
    expect(expiryInfo.expiresInSeconds).toBeLessThanOrEqual(3600);
  });

  test('should validate token correctly', async () => {
    const mockResponse = {
      access_token: 'validity-test-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read write'
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const auth = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret'
    });

    // Before getting token
    expect(auth.isTokenValid()).toBe(false);

    // After getting token
    await auth.getToken();
    expect(auth.isTokenValid()).toBe(true);
  });

  test('should clear cache correctly', async () => {
    const mockResponse = {
      access_token: 'clear-test-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read write'
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const auth = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret'
    });

    // Get token
    await auth.getToken();
    expect(auth.isTokenValid()).toBe(true);

    // Clear cache
    auth.clearCache();
    expect(auth.isTokenValid()).toBe(false);

    // Next call should fetch new token
    await auth.getToken();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('should provide cache statistics', () => {
    const auth1 = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'client1',
      clientSecret: 'secret1'
    });

    const auth2 = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'client2',
      clientSecret: 'secret2'
    });

    const stats = getAuthCacheStats();
    expect(stats.totalCaches).toBe(2);
    expect(stats.cacheKeys).toHaveLength(2);
    expect(stats.cacheKeys).toContain('https://api.example.com:client1:secret1');
    expect(stats.cacheKeys).toContain('https://api.example.com:client2:secret2');
  });

  test('should clear all caches', async () => {
    const mockResponse = {
      access_token: 'clear-all-test-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read write'
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const auth1 = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'client1',
      clientSecret: 'secret1'
    });

    const auth2 = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'client2',
      clientSecret: 'secret2'
    });

    // Get tokens for both instances
    await auth1.getToken();
    await auth2.getToken();

    expect(getAuthCacheStats().totalCaches).toBe(2);

    // Clear all caches
    clearAllAuthCaches();

    expect(getAuthCacheStats().totalCaches).toBe(0);
    expect(auth1.isTokenValid()).toBe(false);
    expect(auth2.isTokenValid()).toBe(false);
  });

  test('should prevent race conditions with concurrent requests', async () => {
    const mockResponse = {
      access_token: 'race-condition-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read write'
    };

    // Simulate slow API response
    fetch.mockImplementationOnce(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: async () => mockResponse
        }), 100)
      )
    );

    const auth = buildMyioIngestionAuth({
      dataApiHost: 'https://api.example.com',
      clientId: 'test-client',
      clientSecret: 'test-secret'
    });

    // Make multiple concurrent requests
    const promises = [
      auth.getToken(),
      auth.getToken(),
      auth.getToken()
    ];

    const tokens = await Promise.all(promises);

    // All should return the same token
    expect(tokens[0]).toBe('race-condition-token');
    expect(tokens[1]).toBe('race-condition-token');
    expect(tokens[2]).toBe('race-condition-token');

    // Only one API call should have been made
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
