import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '../../src/lib/api';
import { SafeDeviceSessionDTO } from '../../src/lib/types';

describe('Phase 3 Module 5: Device Sessions Unit Tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockSessions: SafeDeviceSessionDTO[] = [
    {
      id: 'session-1-uuid',
      deviceLabel: 'Chrome on Windows',
      lastSeenAt: '2026-10-08T16:00:00.000Z',
      createdAt: '2026-10-08T14:00:00.000Z',
      isCurrent: true
    },
    {
      id: 'session-2-uuid',
      deviceLabel: 'Safari on iPhone',
      lastSeenAt: '2026-10-08T15:30:00.000Z',
      createdAt: '2026-10-07T10:00:00.000Z',
      isCurrent: false
    }
  ];

  it('lists device sessions and preserves safe metadata fields only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          sessions: mockSessions
        }
      })
    });
    globalThis.fetch = fetchMock;

    const res = await api.getDeviceSessions();
    expect(res.sessions).toHaveLength(2);

    const current = res.sessions.find((s) => s.isCurrent);
    expect(current).toBeDefined();
    expect(current?.deviceLabel).toBe('Chrome on Windows');

    const remote = res.sessions.find((s) => !s.isCurrent);
    expect(remote).toBeDefined();
    expect(remote?.deviceLabel).toBe('Safari on iPhone');

    // STRICT ZERO-SECRET INVARIANT: Technical identifiers, tokens, and hashes must be undefined
    for (const session of res.sessions) {
      expect((session as any).rawToken).toBeUndefined();
      expect((session as any).token_hash).toBeUndefined();
      expect((session as any).user_agent_hash).toBeUndefined();
      expect((session as any).last_ip_hash).toBeUndefined();
      expect((session as any).ip).toBeUndefined();
      expect((session as any).userAgent).toBeUndefined();
    }
  });

  it('revokes remote session and forwards idempotency key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          message: 'Session revoked successfully.',
          isCurrentSession: false,
          loggedOut: false
        }
      })
    });
    globalThis.fetch = fetchMock;

    const testIdempotencyKey = 'rvk-key-123';
    const res = await api.revokeSession('session-2-uuid', testIdempotencyKey);

    expect(res.isCurrentSession).toBe(false);
    expect(res.loggedOut).toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    const calledOptions = fetchMock.mock.calls[0][1];

    expect(calledUrl).toContain('/api/settings/sessions/session-2-uuid/revoke');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers['Idempotency-Key']).toBe(testIdempotencyKey);
  });

  it('revokes current session with isCurrentSession: true and loggedOut: true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          message: 'Current session revoked. Signed out successfully.',
          isCurrentSession: true,
          loggedOut: true
        }
      })
    });
    globalThis.fetch = fetchMock;

    const res = await api.revokeSession('session-1-uuid');

    expect(res.isCurrentSession).toBe(true);
    expect(res.loggedOut).toBe(true);
    expect(res.message).toContain('Current session revoked');
  });

  it('revokes all other sessions and passes idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          message: 'All other sessions revoked successfully.',
          revokedCount: 3
        }
      })
    });
    globalThis.fetch = fetchMock;

    const testKey = 'rvk-others-uuid-456';
    const res = await api.revokeOtherSessions(testKey);

    expect(res.revokedCount).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    const calledOptions = fetchMock.mock.calls[0][1];

    expect(calledUrl).toContain('/api/settings/sessions/revoke-others');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers['Idempotency-Key']).toBe(testKey);
  });

  it('handles 401 on protected session route with safe message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session revoked or expired.'
        }
      })
    });
    globalThis.fetch = fetchMock;

    await expect(api.getDeviceSessions()).rejects.toThrow('Your session has ended. Please sign in again.');
  });
});
