import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '../../src/lib/api';

describe('Frontend Login Cold-Start & Auth Handling', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('preserves fast single-attempt login when backend is already running', async () => {
    const mockAdmin = {
      id: 'admin-123',
      email: 'admin@koyalkinare.com',
      displayName: 'Cafe Admin'
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { admin: mockAdmin } })
    });
    globalThis.fetch = fetchMock;

    const onRetry = vi.fn();
    const result = await api.login(
      { email: 'admin@koyalkinare.com', password: 'ValidPassword123' },
      { onRetry, retryDelayMs: 10 }
    );

    expect(result.admin).toEqual(mockAdmin);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('does NOT retry genuine authentication failures (HTTP 401)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password.'
        }
      })
    });
    globalThis.fetch = fetchMock;

    const onRetry = vi.fn();

    await expect(
      api.login(
        { email: 'admin@koyalkinare.com', password: 'WrongPassword' },
        { onRetry, maxRetries: 4, retryDelayMs: 10 }
      )
    ).rejects.toThrow('Sign-in details are incorrect. Please try again.');

    // Only 1 attempt must have occurred; 401 should NEVER be retried
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('does NOT retry client validation errors (HTTP 400)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required.'
        }
      })
    });
    globalThis.fetch = fetchMock;

    const onRetry = vi.fn();

    await expect(
      api.login(
        { email: '', password: '' },
        { onRetry, maxRetries: 4, retryDelayMs: 10 }
      )
    ).rejects.toThrow('Email and password are required.');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('gracefully handles 502/503 cold-start errors, notifies onRetry, and succeeds once backend is awake', async () => {
    const mockAdmin = {
      id: 'admin-123',
      email: 'admin@koyalkinare.com',
      displayName: 'Cafe Admin'
    };

    // Attempt 1: Render sleeping (502 Bad Gateway with Render HTML page)
    // Attempt 2: Render starting (503 Service Unavailable)
    // Attempt 3: Awake and healthy (200 OK)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('Unexpected token < in JSON at position 0');
        }
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { admin: mockAdmin } })
      });

    globalThis.fetch = fetchMock;

    const onRetry = vi.fn();
    const result = await api.login(
      { email: 'admin@koyalkinare.com', password: 'ValidPassword123' },
      { onRetry, maxRetries: 4, retryDelayMs: 10 }
    );

    expect(result.admin).toEqual(mockAdmin);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 'Connecting to server...', 1);
    expect(onRetry).toHaveBeenNthCalledWith(2, 'Connecting to server...', 2);
  });

  it('retries through transient network failure (TypeError: Failed to fetch) and recovers', async () => {
    const mockAdmin = {
      id: 'admin-123',
      email: 'admin@koyalkinare.com',
      displayName: 'Cafe Admin'
    };

    // Attempt 1: Network socket reset / failed to fetch while container initializes
    // Attempt 2: Success 200 OK
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { admin: mockAdmin } })
      });

    globalThis.fetch = fetchMock;

    const onRetry = vi.fn();
    const result = await api.login(
      { email: 'admin@koyalkinare.com', password: 'ValidPassword123' },
      { onRetry, maxRetries: 3, retryDelayMs: 10 }
    );

    expect(result.admin).toEqual(mockAdmin);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith('Connecting to server...', 1);
  });

  it('shows clear server error rather than invalid credentials when server remains unavailable after retry limit', async () => {
    // All attempts fail with 502 Bad Gateway
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({})
    });
    globalThis.fetch = fetchMock;

    const onRetry = vi.fn();

    let errorThrown: any = null;
    try {
      await api.login(
        { email: 'admin@koyalkinare.com', password: 'ValidPassword123' },
        { onRetry, maxRetries: 3, retryDelayMs: 10 }
      );
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).toBeInstanceOf(ApiError);
    expect(errorThrown.message).toContain('server is taking longer than expected');
    expect(errorThrown.message).not.toContain('Sign-in details are incorrect');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('stops retrying immediately if server wakes up and returns 401', async () => {
    // Attempt 1: 502 Bad Gateway (server cold)
    // Attempt 2: Server is now awake, but password was wrong (401 Unauthorized)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password.'
          }
        })
      });

    globalThis.fetch = fetchMock;

    const onRetry = vi.fn();

    await expect(
      api.login(
        { email: 'admin@koyalkinare.com', password: 'WrongPassword' },
        { onRetry, maxRetries: 4, retryDelayMs: 10 }
      )
    ).rejects.toThrow('Sign-in details are incorrect. Please try again.');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
