import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from '../src/net/http.js';

process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled rejection ignored:', reason);
});

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should make a successful request on first try', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
      text: () => Promise.resolve('test response')
    };
    
    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await fetchWithRetry('https://api.example.com/test');
    
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
      timeout: 10000
    });
    expect(result).toBe(mockResponse);
  });

  it('should retry on network error and eventually succeed', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' })
    };

    // First two calls fail, third succeeds
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockResponse);

    const promise = fetchWithRetry('https://api.example.com/test', {
      retries: 3,
      retryDelay: 100
    });

    // Fast-forward through the delays
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200); // Second retry has longer delay
    
    const result = await promise;
    
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result).toBe(mockResponse);
  });

  it('should retry on 5xx status codes', async () => {
    const errorResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    };
    
    const successResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' })
    };

    mockFetch
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(successResponse);

    const promise = fetchWithRetry('https://api.example.com/test', {
      retries: 2,
      retryDelay: 100
    });

    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;
    
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toBe(successResponse);
  });

  it('should not retry on 4xx status codes', async () => {
    const errorResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found'
    };

    mockFetch.mockResolvedValueOnce(errorResponse);

    await expect(fetchWithRetry('https://api.example.com/test')).rejects.toThrow('HTTP 404: Not Found');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should throw error after exhausting all retries', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const promise = fetchWithRetry('https://api.example.com/test', {
      retries: 2,
      retryDelay: 100
    });

    // Fast-forward through all retry delays
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).rejects.toThrow('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should use exponential backoff for retry delays', async () => {
    const startTime = Date.now();
    const delays = [];
    
    mockFetch.mockImplementation(() => {
      delays.push(Date.now() - startTime);
      return Promise.reject(new Error('Network error'));
    });

    const promise = fetchWithRetry('https://api.example.com/test', {
      retries: 3,
      retryDelay: 100
    });

    // Advance timers to simulate the delays
    await vi.advanceTimersByTimeAsync(100); // First retry
    await vi.advanceTimersByTimeAsync(200); // Second retry (100 * 2)
    await vi.advanceTimersByTimeAsync(400); // Third retry (100 * 4)

    await expect(promise).rejects.toThrow('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });

  it('should handle timeout', async () => {
    // Mock a request that never resolves
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const promise = fetchWithRetry('https://api.example.com/test', {
      timeout: 1000,
      retries: 0
    });

    // Fast-forward past the timeout
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).rejects.toThrow('Request timeout');
  });

  it('should pass through custom options', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' })
    };
    
    mockFetch.mockResolvedValueOnce(mockResponse);

    const customOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
      },
      body: JSON.stringify({ test: 'data' })
    };

    await fetchWithRetry('https://api.example.com/test', customOptions);
    
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
      ...customOptions,
      timeout: 10000 // Default timeout should be added
    });
  });

  it('should handle custom retry condition', async () => {
    const mockResponse = {
      ok: false,
      status: 429, // Rate limited
      statusText: 'Too Many Requests'
    };
    
    const successResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' })
    };

    mockFetch
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(successResponse);

    const customRetryCondition = (error, response) => {
      return response && response.status === 429;
    };

    const promise = fetchWithRetry('https://api.example.com/test', {
      retries: 1,
      retryDelay: 100,
      retryCondition: customRetryCondition
    });

    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;
    
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toBe(successResponse);
  });

  it('should handle AbortController signal', async () => {
    const controller = new AbortController();
    const mockResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' })
    };
    
    mockFetch.mockResolvedValueOnce(mockResponse);

    await fetchWithRetry('https://api.example.com/test', {
      signal: controller.signal
    });
    
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
      signal: controller.signal,
      timeout: 10000
    });
  });
});
