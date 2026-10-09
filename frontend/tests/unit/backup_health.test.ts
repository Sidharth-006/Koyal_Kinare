import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '../../src/lib/api';
import { SafeBackupStatusDTO } from '../../src/lib/types';

describe('Phase 3 Module 5: Backup Health Unit Tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('retrieves healthy backup status and suppresses all technical internals', async () => {
    const mockBackup: SafeBackupStatusDTO = {
      lastSuccessfulBackupAt: '2026-10-08T02:00:00.000Z',
      nextScheduledRun: '2026-10-09T02:00:00.000Z',
      status: 'SUCCEEDED',
      safeFailureCode: null,
      instruction: 'All automated backups are running normally.'
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          backupStatus: mockBackup
        }
      })
    });
    globalThis.fetch = fetchMock;

    const res = await api.getBackupStatus();
    expect(res.backupStatus.status).toBe('SUCCEEDED');
    expect(res.backupStatus.lastSuccessfulBackupAt).toBe('2026-10-08T02:00:00.000Z');
    expect(res.backupStatus.nextScheduledRun).toBe('2026-10-09T02:00:00.000Z');

    // STRICT ZERO SECRET INVARIANT: Ensure no internal storage references exist
    expect((res.backupStatus as any).backup_reference).toBeUndefined();
    expect((res.backupStatus as any).backupReference).toBeUndefined();
    expect((res.backupStatus as any).storagePath).toBeUndefined();
    expect((res.backupStatus as any).s3Url).toBeUndefined();
    expect((res.backupStatus as any).cloudBucket).toBeUndefined();
  });

  it('handles failed backup state and guarantees safe attention instruction', async () => {
    const mockBackup: SafeBackupStatusDTO = {
      lastSuccessfulBackupAt: '2026-10-07T02:00:00.000Z',
      nextScheduledRun: '2026-10-09T02:00:00.000Z',
      status: 'FAILED',
      safeFailureCode: 'ERR_STORAGE_UNAVAILABLE',
      instruction: 'Backup needs attention. Please contact the developer.'
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          backupStatus: mockBackup
        }
      })
    });
    globalThis.fetch = fetchMock;

    const res = await api.getBackupStatus();
    expect(res.backupStatus.status).toBe('FAILED');
    expect(res.backupStatus.instruction).toBe('Backup needs attention. Please contact the developer.');

    // Ensure raw stack or infrastructure credentials are not present
    expect((res.backupStatus as any).stack).toBeUndefined();
    expect((res.backupStatus as any).errorStack).toBeUndefined();
  });

  it('handles initial state when no backup runs have executed yet', async () => {
    const mockBackup: SafeBackupStatusDTO = {
      lastSuccessfulBackupAt: null,
      nextScheduledRun: '2026-10-09T02:00:00.000Z',
      status: 'NO_RUNS',
      safeFailureCode: null,
      instruction: 'No automated backups have run yet. Next run is scheduled.'
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          backupStatus: mockBackup
        }
      })
    });
    globalThis.fetch = fetchMock;

    const res = await api.getBackupStatus();
    expect(res.backupStatus.status).toBe('NO_RUNS');
    expect(res.backupStatus.lastSuccessfulBackupAt).toBeNull();
  });
});
