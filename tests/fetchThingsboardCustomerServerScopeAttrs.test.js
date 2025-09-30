/**
 * Unit tests for fetchThingsboardCustomerServerScopeAttrs component
 */

import { 
  fetchThingsboardCustomerServerScopeAttrs,
  fetchThingsboardCustomerAttrsFromStorage,
  extractMyIOCredentials
} from '../src/thingsboard/api/fetchThingsboardCustomerServerScopeAttrs.js';
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = localStorageMock;

describe('fetchThingsboardCustomerServerScopeAttrs', () => {
  beforeEach(() => {
    // Reset fetch mock
    fetch.mockClear();
    // Reset localStorage mock
    localStorageMock.getItem.mockClear();
  });

  test('should fetch attributes successfully with array response format', async () => {
    const mockResponse = [
      { key: 'client_id', value: 'test-client-123' },
      { key: 'client_secret', value: 'test-secret-456' },
      { key: 'ingestionId', value: 'test-ingestion-789' }
    ];

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const result = await fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer-uuid-123',
      tbToken: 'jwt-token-456'
    });

    expect(result).toEqual({
      client_id: 'test-client-123',
      client_secret: 'test-secret-456',
      ingestionId: 'test-ingestion-789'
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/plugins/telemetry/CUSTOMER/customer-uuid-123/values/attributes/SERVER_SCOPE',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': 'Bearer jwt-token-456'
        }
      }
    );
  });

  test('should fetch attributes successfully with object response format', async () => {
    const mockResponse = {
      client_id: [{ value: 'test-client-obj' }],
      client_secret: [{ value: 'test-secret-obj' }],
      ingestionId: [{ value: 'test-ingestion-obj' }]
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const result = await fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer-uuid-456',
      tbToken: 'jwt-token-789'
    });

    expect(result).toEqual({
      client_id: 'test-client-obj',
      client_secret: 'test-secret-obj',
      ingestionId: 'test-ingestion-obj'
    });
  });

  test('should handle object response with direct values', async () => {
    const mockResponse = {
      client_id: 'direct-client-value',
      client_secret: 'direct-secret-value',
      ingestionId: 'direct-ingestion-value'
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const result = await fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer-uuid-789',
      tbToken: 'jwt-token-123'
    });

    expect(result).toEqual({
      client_id: 'direct-client-value',
      client_secret: 'direct-secret-value',
      ingestionId: 'direct-ingestion-value'
    });
  });

  test('should use custom baseUrl when provided', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => []
    });

    await fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer-123',
      tbToken: 'token-456',
      baseUrl: 'https://custom.thingsboard.com'
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://custom.thingsboard.com/api/plugins/telemetry/CUSTOMER/customer-123/values/attributes/SERVER_SCOPE',
      expect.any(Object)
    );
  });

  test('should throw error for missing required parameters', async () => {
    await expect(fetchThingsboardCustomerServerScopeAttrs({
      customerId: '',
      tbToken: 'token'
    })).rejects.toThrow('customerId and tbToken are required');

    await expect(fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer',
      tbToken: ''
    })).rejects.toThrow('customerId and tbToken are required');

    await expect(fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer'
      // missing tbToken
    })).rejects.toThrow('customerId and tbToken are required');
  });

  test('should return empty object for 404 errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const result = await fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'nonexistent-customer',
      tbToken: 'valid-token'
    });

    expect(result).toEqual({});
  });

  test('should return empty object for 403 errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    });

    const result = await fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'forbidden-customer',
      tbToken: 'invalid-token'
    });

    expect(result).toEqual({});
  });

  test('should throw error for server errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    await expect(fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer-123',
      tbToken: 'token-456'
    })).rejects.toThrow('ThingsBoard API error: HTTP 500 Internal Server Error');
  });

  test('should handle network errors', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer-123',
      tbToken: 'token-456'
    })).rejects.toThrow('Failed to fetch customer attributes: Network error');
  });

  test('should handle malformed JSON response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Invalid JSON');
      }
    });

    await expect(fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer-123',
      tbToken: 'token-456'
    })).rejects.toThrow('Failed to fetch customer attributes: Invalid JSON');
  });

  test('should handle empty response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => null
    });

    const result = await fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer-123',
      tbToken: 'token-456'
    });

    expect(result).toEqual({});
  });

  test('should handle unexpected response format', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => 'unexpected string response'
    });

    const result = await fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer-123',
      tbToken: 'token-456'
    });

    expect(result).toEqual({});
  });

  test('should handle array with malformed items', async () => {
    const mockResponse = [
      { key: 'valid_key', value: 'valid_value' },
      { invalid: 'item' }, // Missing key property
      null, // Null item
      { key: 'another_key', value: 'another_value' }
    ];

    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const result = await fetchThingsboardCustomerServerScopeAttrs({
      customerId: 'customer-123',
      tbToken: 'token-456'
    });

    expect(result).toEqual({
      valid_key: 'valid_value',
      another_key: 'another_value'
    });
  });
});

describe('fetchThingsboardCustomerAttrsFromStorage', () => {
  beforeEach(() => {
    fetch.mockClear();
    localStorageMock.getItem.mockClear();
  });

  test('should fetch attributes using token from localStorage', async () => {
    localStorageMock.getItem.mockReturnValue('stored-jwt-token');
    
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        { key: 'client_id', value: 'stored-client' }
      ]
    });

    const result = await fetchThingsboardCustomerAttrsFromStorage('customer-123');

    expect(localStorageMock.getItem).toHaveBeenCalledWith('jwt_token');
    expect(result).toEqual({
      client_id: 'stored-client'
    });
  });

  test('should use custom token key', async () => {
    localStorageMock.getItem.mockReturnValue('custom-token');
    
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => []
    });

    await fetchThingsboardCustomerAttrsFromStorage('customer-123', 'custom_jwt_key');

    expect(localStorageMock.getItem).toHaveBeenCalledWith('custom_jwt_key');
  });

  test('should throw error when token not found in localStorage', async () => {
    localStorageMock.getItem.mockReturnValue(null);

    await expect(fetchThingsboardCustomerAttrsFromStorage('customer-123'))
      .rejects.toThrow('JWT token not found in localStorage (key: jwt_token)');
  });

  test('should throw error when localStorage is not available', async () => {
    // Temporarily remove localStorage
    const originalLocalStorage = global.localStorage;
    delete global.localStorage;

    await expect(fetchThingsboardCustomerAttrsFromStorage('customer-123'))
      .rejects.toThrow('localStorage is not available in this environment');

    // Restore localStorage
    global.localStorage = originalLocalStorage;
  });
});

describe('extractMyIOCredentials', () => {
  test('should extract credentials with standard keys', () => {
    const attributes = {
      client_id: 'test-client',
      client_secret: 'test-secret',
      ingestionId: 'test-ingestion'
    };

    const result = extractMyIOCredentials(attributes);

    expect(result).toEqual({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      ingestionId: 'test-ingestion'
    });
  });

  test('should extract credentials with alternative keys', () => {
    const attributes = {
      clientId: 'alt-client',
      clientSecret: 'alt-secret',
      ingestion_id: 'alt-ingestion'
    };

    const result = extractMyIOCredentials(attributes);

    expect(result).toEqual({
      clientId: 'alt-client',
      clientSecret: 'alt-secret',
      ingestionId: 'alt-ingestion'
    });
  });

  test('should use fallback values for missing keys', () => {
    const attributes = {
      some_other_key: 'some_value'
    };

    const result = extractMyIOCredentials(attributes);

    expect(result).toEqual({
      clientId: '',
      clientSecret: '',
      ingestionId: ''
    });
  });

  test('should prioritize standard keys over alternative keys', () => {
    const attributes = {
      client_id: 'standard-client',
      clientId: 'alt-client',
      client_secret: 'standard-secret',
      clientSecret: 'alt-secret',
      ingestionId: 'standard-ingestion',
      ingestion_id: 'alt-ingestion'
    };

    const result = extractMyIOCredentials(attributes);

    expect(result).toEqual({
      clientId: 'standard-client',
      clientSecret: 'standard-secret',
      ingestionId: 'standard-ingestion'
    });
  });

  test('should handle empty attributes object', () => {
    const result = extractMyIOCredentials({});

    expect(result).toEqual({
      clientId: '',
      clientSecret: '',
      ingestionId: ''
    });
  });

  test('should handle null/undefined attributes', () => {
    expect(extractMyIOCredentials(null)).toEqual({
      clientId: '',
      clientSecret: '',
      ingestionId: ''
    });

    expect(extractMyIOCredentials(undefined)).toEqual({
      clientId: '',
      clientSecret: '',
      ingestionId: ''
    });
  });
});
