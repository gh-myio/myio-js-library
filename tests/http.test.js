import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from '../src/net/http.js';

let mockFetch;

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();                  // drive all time ourselves
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(async () => {
    // ensure no pending backoff/timeout ticks keep running after the test
    await vi.runAllTimersAsync();        // drain pending timers (Vitest v2 supports this)
    vi.clearAllTimers();
    vi.resetAllMocks();
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

    const p = fetchWithRetry('https://api.example.com/test', {
      retries: 3,
      retryDelay: 100,
      timeout: 10000 // Increase timeout to 10 seconds
    });

    // Advance through all timers to complete the retry cycle
    await vi.runAllTimersAsync();

    await expect(p).rejects.toThrow('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });

  it('should use exponential backoff for retry delays', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const startTime = Date.now();
    const delays = [];
    
    mockFetch.mockImplementation(() => {
      const delay = Date.now() - startTime;
      delays.push(delay);
      return Promise.reject(new Error('Network error'));
    });

    const p = fetchWithRetry('https://api.example.com/test', {
      retries: 3,
      retryDelay: 100
    });

    // Advance timers to simulate the delays
    await vi.advanceTimersByTimeAsync(100); // First retry
    await vi.advanceTimersByTimeAsync(200); // Second retry (100 * 2)
    await vi.advanceTimersByTimeAsync(400); // Third retry (100 * 4)

    await expect(p).rejects.toThrow('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries

    // Verify the delays are exponential
    expect(delays[0]).toBeGreaterThanOrEqual(100);
    expect(delays[1]).toBeGreaterThanOrEqual(200);
    expect(delays[2]).toBeGreaterThanOrEqual(400);
  });

  it('should use exponential backoff for retry delays', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const p = fetchWithRetry('https://api.example.com/test', {
      retries: 3,
      retryDelay: 100
    });

    // deterministically step through the schedule
    vi.advanceTimersByTime(0);    // initial
    vi.advanceTimersByTime(100);  // retry #1
    vi.advanceTimersByTime(200);  // retry #2
    vi.advanceTimersByTime(400);  // retry #3

    await expect(p).rejects.toThrow('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });

  it('should handle timeout', async () => {
    // never resolves or rejects -> rely on our timeout
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const promise = fetchWithRetry('https://api.example.com/test', {
      retries: 0,
      timeout: 500
    });

    vi.advanceTimersByTime(500);
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
