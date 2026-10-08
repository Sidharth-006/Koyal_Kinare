import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { query } from '@/shared/database/client';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthRepository } from '@/modules/auth/auth.repository';
import { DeviceSessionRepository } from '@/modules/auth/device-session.repository';
import { DeviceSessionService } from '@/modules/auth/device-session.service';
import { IdempotencyEngineService } from '@/modules/audit/idempotency-engine.service';
import { IdempotencyKeysRepository } from '@/modules/audit/idempotency-keys.repository';
import { RevisionService } from '@/modules/settings/revision.service';
import { BackupService } from '@/modules/backup/backup.service';
import { MockBackupStorageProvider } from '@/modules/backup/backup-provider.mock';
import { hashPassword, generateSessionToken } from '@/shared/auth/security';
import { createSessionCookie } from '@/shared/auth/session';

// Import route handlers
import { GET as getSessionsHandler } from '@/app/api/settings/sessions/route';
import { POST as revokeSessionHandler } from '@/app/api/settings/sessions/[id]/revoke/route';
import { POST as revokeOthersHandler } from '@/app/api/settings/sessions/revoke-others/route';
import { GET as getBackupStatusHandler } from '@/app/api/settings/backup-status/route';

describe('Operational Resilience Integration Tests (Module 5)', () => {
  let adminId: string;
  let adminEmail: string;
  let rawToken1: string;
  let cookie1: string;
  let rawToken2: string;
  let cookie2: string;

  beforeAll(async () => {
    // 1. Create a dedicated test admin
    adminEmail = `resilience_admin_${Date.now()}@koyalkinare.com`;
    const passwordHash = await hashPassword('AdminPass123!');
    const admin = await AuthRepository.createAdmin({
      email: adminEmail,
      passwordHash,
      displayName: 'Resilience Test Admin',
    });
    adminId = admin.id;

    // 2. Perform first login (Chrome on Windows)
    const loginRes1 = await AuthService.login(
      { email: adminEmail, password: 'AdminPass123!' },
      {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        ip: '192.168.1.50',
      }
    );
    rawToken1 = loginRes1.token;
    cookie1 = loginRes1.cookieHeader;

    // 3. Perform second login from another device (Safari on macOS)
    const loginRes2 = await AuthService.login(
      { email: adminEmail, password: 'AdminPass123!' },
      {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15',
        ip: '192.168.1.55',
      }
    );
    rawToken2 = loginRes2.token;
    cookie2 = loginRes2.cookieHeader;
  });

  describe('Session Management & Device Sessions', () => {
    it('should list active device sessions and identify current session safely', async () => {
      const req = new NextRequest('http://localhost:3000/api/settings/sessions', {
        method: 'GET',
        headers: { cookie: cookie1 },
      });

      const res = await getSessionsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.sessions).toBeInstanceOf(Array);
      expect(json.data.sessions.length).toBeGreaterThanOrEqual(2);

      const current = json.data.sessions.find((s: any) => s.isCurrent === true);
      expect(current).toBeDefined();
      expect(current.deviceLabel).toBe('Chrome on Windows');

      const other = json.data.sessions.find((s: any) => s.isCurrent === false);
      expect(other).toBeDefined();
      expect(other.deviceLabel).toBe('Safari on macOS');

      // Zero Secret Invariant: Check that no sensitive technical fields are returned
      for (const s of json.data.sessions) {
        expect(s.rawToken).toBeUndefined();
        expect(s.token_hash).toBeUndefined();
        expect(s.user_agent_hash).toBeUndefined();
        expect(s.last_ip_hash).toBeUndefined();
        expect(s.ip).toBeUndefined();
        expect(s.userAgent).toBeUndefined();
      }
    });

    it('should throttle last_seen_at updates when called repeatedly within 60s', async () => {
      // Validate session 1
      const initial = await AuthService.validateSessionToken(rawToken1);
      const row1 = await query('SELECT last_seen_at FROM sessions WHERE id = $1', [initial.sessionId]);
      const initialTimestamp = new Date(row1.rows[0].last_seen_at).getTime();

      // Immediate second validation
      await AuthService.validateSessionToken(rawToken1);
      const row2 = await query('SELECT last_seen_at FROM sessions WHERE id = $1', [initial.sessionId]);
      const secondTimestamp = new Date(row2.rows[0].last_seen_at).getTime();

      // Because under 60 seconds, no DB write should occur
      expect(secondTimestamp).toBe(initialTimestamp);
    });

    it('should revoke a specific session and prevent it from further protected access', async () => {
      // Create a 3rd temporary session to revoke
      const login3 = await AuthService.login(
        { email: adminEmail, password: 'AdminPass123!' },
        { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1' }
      );

      // Find its device_session id
      const sessions = await DeviceSessionService.listSessions(adminId, login3.sessionId);
      const sessionToRevoke = sessions.find((s) => s.isCurrent === true);
      expect(sessionToRevoke).toBeDefined();

      // Revoke it using Session 1
      const revokeReq = new NextRequest(`http://localhost:3000/api/settings/sessions/${sessionToRevoke!.id}/revoke`, {
        method: 'POST',
        headers: { cookie: cookie1, origin: 'http://localhost:3000' },
      });

      const revokeRes = await revokeSessionHandler(revokeReq, { params: { id: sessionToRevoke!.id } });
      expect(revokeRes.status).toBe(200);
      const revokeJson = await revokeRes.json();
      expect(revokeJson.data.isCurrentSession).toBe(false);

      // Verify that Session 3 is now rejected
      const protectedReq = new NextRequest('http://localhost:3000/api/settings/sessions', {
        method: 'GET',
        headers: { cookie: login3.cookieHeader },
      });
      const rejectedRes = await getSessionsHandler(protectedReq);
      expect(rejectedRes.status).toBe(401);
    });

    it('should return signout cookie when current session is revoked', async () => {
      // Create session 4
      const login4 = await AuthService.login(
        { email: adminEmail, password: 'AdminPass123!' },
        { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile' }
      );

      const sessions = await DeviceSessionService.listSessions(adminId, login4.sessionId);
      const currentSession = sessions.find((s) => s.isCurrent === true);
      expect(currentSession).toBeDefined();

      // Revoke current session using its own token
      const revokeReq = new NextRequest(`http://localhost:3000/api/settings/sessions/${currentSession!.id}/revoke`, {
        method: 'POST',
        headers: { cookie: login4.cookieHeader, origin: 'http://localhost:3000' },
      });

      const revokeRes = await revokeSessionHandler(revokeReq, { params: { id: currentSession!.id } });
      expect(revokeRes.status).toBe(200);

      const setCookie = revokeRes.headers.get('set-cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('Max-Age=0');

      const json = await revokeRes.json();
      expect(json.data.isCurrentSession).toBe(true);
      expect(json.data.loggedOut).toBe(true);
    });

    it('should revoke all other sessions while keeping caller session active', async () => {
      // Create session 5 and 6
      const s5 = await AuthService.login({ email: adminEmail, password: 'AdminPass123!' });
      const s6 = await AuthService.login({ email: adminEmail, password: 'AdminPass123!' });

      const revokeOthersReq = new NextRequest('http://localhost:3000/api/settings/sessions/revoke-others', {
        method: 'POST',
        headers: { cookie: cookie1, origin: 'http://localhost:3000' },
      });

      const res = await revokeOthersHandler(revokeOthersReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.revokedCount).toBeGreaterThanOrEqual(2);

      // Caller session (cookie1) must still work
      const checkReq1 = new NextRequest('http://localhost:3000/api/settings/sessions', {
        method: 'GET',
        headers: { cookie: cookie1 },
      });
      const checkRes1 = await getSessionsHandler(checkReq1);
      expect(checkRes1.status).toBe(200);

      // S5 and S6 must now fail with 401
      const checkReq5 = new NextRequest('http://localhost:3000/api/settings/sessions', {
        method: 'GET',
        headers: { cookie: s5.cookieHeader },
      });
      const checkRes5 = await getSessionsHandler(checkReq5);
      expect(checkRes5.status).toBe(401);
    });
  });

  describe('Transactional Idempotency Infrastructure', () => {
    it('should execute first mutation and return cached result on replay with identical payload', async () => {
      const key = `idem-test-${Date.now()}`;
      const route = '/api/pos/bills';
      const payload = { totalAmount: 500, customerName: 'Ravi' };
      let executionCount = 0;

      const run = async () =>
        IdempotencyEngineService.execute({
          adminId,
          route,
          key,
          payload,
          mutationFn: async () => {
            executionCount++;
            return { statusCode: 201, data: { billId: 'bill-abc-123', count: executionCount } };
          },
        });

      // 1st Call
      const res1 = await run();
      expect(res1.cached).toBe(false);
      expect(res1.data.count).toBe(1);
      expect(executionCount).toBe(1);

      // 2nd Call (replay with same key and same payload)
      const res2 = await run();
      expect(res2.cached).toBe(true);
      expect(res2.data.count).toBe(1);
      expect(executionCount).toBe(1); // Mutation was NOT re-executed!
    });

    it('should throw HTTP 409 conflict when idempotency key is reused with different payload', async () => {
      const key = `idem-conflict-${Date.now()}`;
      const route = '/api/pos/bills';

      // First run with payload A
      await IdempotencyEngineService.execute({
        adminId,
        route,
        key,
        payload: { amount: 100 },
        mutationFn: async () => ({ statusCode: 200, data: { ok: true } }),
      });

      // Second run with same key but payload B
      await expect(
        IdempotencyEngineService.execute({
          adminId,
          route,
          key,
          payload: { amount: 200 }, // Different!
          mutationFn: async () => ({ statusCode: 200, data: { ok: true } }),
        })
      ).rejects.toThrow('Idempotency key payload mismatch for this route.');
    });

    it('should allow re-execution after key expiration', async () => {
      const key = `idem-expired-${Date.now()}`;
      const route = '/api/stock/adjustments';
      const payload = { qty: 5 };

      // Execute initial mutation
      await IdempotencyEngineService.execute({
        adminId,
        route,
        key,
        payload,
        mutationFn: async () => ({ statusCode: 200, data: { attempt: 1 } }),
      });

      // Manually set expires_at in the past
      await query(
        'UPDATE idempotency_keys SET expires_at = CURRENT_TIMESTAMP - INTERVAL \'1 hour\' WHERE key = $1',
        [key]
      );

      // Re-execution should be allowed and should execute new mutation
      let newExecuted = false;
      const res = await IdempotencyEngineService.execute({
        adminId,
        route,
        key,
        payload,
        mutationFn: async () => {
          newExecuted = true;
          return { statusCode: 200, data: { attempt: 2 } };
        },
      });

      expect(newExecuted).toBe(true);
      expect(res.cached).toBe(false);
      expect(res.data.attempt).toBe(2);
    });
  });

  describe('Optimistic Concurrency & Data Change Revisions', () => {
    it('should list all initialized domain revisions internally', async () => {
      const revisions = await RevisionService.getAllRevisions();
      expect(revisions).toBeDefined();
      expect(revisions.bill).toBeDefined();
      expect(revisions.purchase).toBeDefined();
      expect(revisions.stock).toBeDefined();
      expect(revisions.reconciliation).toBeDefined();
      expect(revisions.recipe).toBeDefined();
      expect(revisions.settings).toBeDefined();
    });

    it('should monotonically increment revision upon bumpRevision', async () => {
      const r1 = await RevisionService.getCurrentRevision('bill');
      const r2 = await RevisionService.bumpRevision('bill');
      expect(r2).toBe(r1 + 1);

      const r3 = await RevisionService.bumpRevision('bill');
      expect(r3).toBe(r2 + 1);
    });

    it('should detect stale revision and reject with HTTP 409 conflict and latestRevision', async () => {
      const current = await RevisionService.getCurrentRevision('stock');
      const stale = current - 1;

      await expect(
        RevisionService.verifyRevision('stock', stale, undefined, adminId)
      ).rejects.toThrow(`Stale data detected for domain "stock". Current revision is ${current}.`);
    });
  });

  describe('Backup Lifecycle & Operational Status', () => {
    it('should transition backup lifecycle from RUNNING to SUCCEEDED and redact technical secrets', async () => {
      const mockProvider = new MockBackupStorageProvider();
      const result = await BackupService.runDailyBackup(mockProvider);

      expect(result.status).toBe('SUCCEEDED');
      expect(result.backupRunId).toBeDefined();

      const runRow = await query('SELECT * FROM backup_runs WHERE id = $1', [result.backupRunId]);
      expect(runRow.rows[0].status).toBe('SUCCEEDED');
      expect(runRow.rows[0].completed_at).toBeDefined();
      expect(runRow.rows[0].retention_until).toBeDefined();

      // Backup reference must be opaque and not expose internal storage paths
      expect(runRow.rows[0].backup_reference).toMatch(/^bkp_[a-f0-9]{32}$/);
    });

    it('should safely handle and record backup failure without leaking raw stack trace', async () => {
      const failingProvider = new MockBackupStorageProvider();
      failingProvider.shouldFailSnapshot = true;

      const result = await BackupService.runDailyBackup(failingProvider);
      expect(result.status).toBe('FAILED');
      expect(result.safeFailureCode).toBe('ERR_STORAGE_UNAVAILABLE');

      const runRow = await query('SELECT * FROM backup_runs WHERE id = $1', [result.backupRunId]);
      expect(runRow.rows[0].status).toBe('FAILED');
      expect(runRow.rows[0].safe_failure_code).toBe('ERR_STORAGE_UNAVAILABLE');
    });

    it('should verify backup restore in isolated sandbox double without touching production DB', async () => {
      const mockProvider = new MockBackupStorageProvider();
      const backupResult = await BackupService.runDailyBackup(mockProvider);
      expect(backupResult.status).toBe('SUCCEEDED');

      // Successful verification
      const verifySuccess = await BackupService.verifyBackupRestore(backupResult.backupRunId, mockProvider);
      expect(verifySuccess.verified).toBe(true);

      // Simulated verification failure
      mockProvider.shouldFailVerify = true;
      const verifyFail = await BackupService.verifyBackupRestore(backupResult.backupRunId, mockProvider);
      expect(verifyFail.verified).toBe(false);
      expect(verifyFail.safeFailureCode).toBe('ERR_INTEGRITY_CHECK_FAILED');
    });

    it('should return safe operational backup status via GET /api/settings/backup-status', async () => {
      const req = new NextRequest('http://localhost:3000/api/settings/backup-status', {
        method: 'GET',
        headers: { cookie: cookie1 },
      });

      const res = await getBackupStatusHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.backupStatus).toBeDefined();
      expect(json.data.backupStatus.status).toBeDefined();
      expect(json.data.backupStatus.instruction).toBeDefined();
      expect(json.data.backupStatus.nextScheduledRun).toBeDefined();

      // STRICT ZERO SECRET INVARIANT: Verify no backup_reference or raw storage path in response
      expect(json.data.backupStatus.backup_reference).toBeUndefined();
      expect(json.data.backupStatus.backupReference).toBeUndefined();
      expect(json.data.backupStatus.storagePath).toBeUndefined();
      expect(json.data.backupStatus.provider).toBeUndefined();
    });
  });

  describe('Security, Origin Protection & Audit Logs', () => {
    it('should reject unauthenticated requests with HTTP 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/settings/sessions', { method: 'GET' });
      const res = await getSessionsHandler(req);
      expect(res.status).toBe(401);
    });

    it('should reject unauthorized cross-origin mutation requests', async () => {
      const req = new NextRequest('http://localhost:3000/api/settings/sessions/revoke-others', {
        method: 'POST',
        headers: {
          cookie: cookie1,
          origin: 'https://unauthorized-evil-site.com',
        },
      });
      const res = await revokeOthersHandler(req);
      expect(res.status).toBe(401);
    });

    it('should verify audit logs are emitted without sensitive technical secrets', async () => {
      const { rows } = await query(
        `SELECT action, metadata
         FROM audit_logs
         WHERE admin_id = $1 OR entity_type IN ('SESSION', 'BACKUP_RUN', 'IDEMPOTENCY_KEY', 'REVISION')
         ORDER BY created_at DESC
         LIMIT 100`,
        [adminId]
      );

      expect(rows.length).toBeGreaterThan(0);

      const actions = rows.map((r: any) => r.action);
      expect(actions).toContain('SESSION_CREATED');
      expect(actions).toContain('SESSION_REVOKED');
      expect(actions).toContain('REVOKE_OTHER_SESSIONS');
      expect(actions).toContain('IDEMPOTENCY_CONFLICT');
      expect(actions).toContain('BACKUP_STARTED');
      expect(actions).toContain('BACKUP_SUCCEEDED');
      expect(actions).toContain('RESTORE_VERIFICATION_STARTED');
      expect(actions).toContain('MATERIAL_DATA_CONFLICT');

      // Verify no raw passwords, tokens, or backup references are in audit metadata
      for (const row of rows) {
        const metaStr = JSON.stringify(row.metadata || {});
        expect(metaStr).not.toContain('AdminPass123!');
        expect(metaStr).not.toContain(rawToken1);
        expect(metaStr).not.toContain('192.168.1.50');
      }
    });
  });
});
