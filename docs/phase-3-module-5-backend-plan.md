# Phase 3 — Module 5: Backups, Device Sessions, and Operational Resilience — Backend Implementation Plan

## 1. Executive Summary & Architectural Invariants

Phase 3 Module 5 establishes operational resilience, security hardening, multi-device session observability, mutation idempotency, and backup verification for Koyal Kinare Cafe POS & ERP.

### Core Architectural Invariants:
1. **Layered Architecture Preserved**:
   Next.js App Router Route Handlers -> `guard` (auth & origin & rate limit) -> `service` layer -> `repository` layer -> PostgreSQL (`pg`).
2. **Forward-Only Migration Numbering**:
   Existing migrations end at `017_pnl_config.sql`. Module 5 will be strictly numbered as `018_operational_resilience.sql`.
3. **Data Redaction & Zero Secret Exposure**:
   - Raw User-Agent and client IP are NEVER persisted or returned. Only SHA-256 hashes and safe parsed labels (e.g., "Chrome on Windows") are stored.
   - Session tokens, cookies, passwords, and secrets are NEVER in API responses, logs, or audit payloads.
   - `backup_reference`, raw cloud storage URLs, encryption keys, and provider internals are strictly DEVELOPER-ONLY and NEVER exposed in UI/API responses.
4. **Frozen Modules 1–4 Protection**:
   No changes to billing calculations, inventory valuation, recipe costing, staff attendance, or P&L logic. Integration hooks are surgical and backward-compatible.

---

## 2. Database Schema (Migration `018_operational_resilience.sql`)

### 2.1 Table: `device_sessions`
Tracks active and historical login sessions with safe device metadata.
```sql
CREATE TABLE IF NOT EXISTS device_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    device_label VARCHAR(150) NOT NULL,
    user_agent_hash VARCHAR(64) NOT NULL,
    last_ip_hash VARCHAR(64),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_admin ON device_sessions (admin_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_session ON device_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_active ON device_sessions (admin_id, revoked_at) WHERE revoked_at IS NULL;
```

### 2.2 Table: `idempotency_keys`
Per-admin, per-route transactional idempotency ledger.
```sql
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    route VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
    response_reference JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_idempotency_admin_route_key UNIQUE (admin_id, route, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys (admin_id, route, key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys (expires_at);
```

### 2.3 Table: `backup_runs`
Tracks scheduled and on-demand database backup executions and retention.
```sql
CREATE TABLE IF NOT EXISTS backup_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheduled_for TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL CHECK (status IN ('SCHEDULED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
    backup_reference VARCHAR(255),
    safe_failure_code VARCHAR(100),
    retention_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_status ON backup_runs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_runs_retention ON backup_runs (retention_until);
```

### 2.4 Table: `data_change_revisions`
Tracks monotonic atomic revision numbers for critical operational domains.
```sql
CREATE TABLE IF NOT EXISTS data_change_revisions (
    domain_key VARCHAR(50) PRIMARY KEY,
    revision BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed core domains
INSERT INTO data_change_revisions (domain_key, revision)
VALUES
    ('bill', 1),
    ('purchase', 1),
    ('stock', 1),
    ('reconciliation', 1),
    ('recipe', 1),
    ('settings', 1)
ON CONFLICT (domain_key) DO NOTHING;
```

---

## 3. Session & Device Management

### 3.1 Device Metadata Parsing
- Utility: `src/shared/auth/device-label.ts`
- Derives a clean human-readable label from the `User-Agent` header (e.g., `Chrome on Windows`, `Safari on iOS`, `Firefox on Linux`, `Edge on macOS`).
- Computes SHA-256 of User-Agent and client IP (`x-forwarded-for` / socket address).

### 3.2 Login Hook Integration (`AuthService.login`)
- When a user logs in, `AuthService.login` records the primary session in `sessions` and simultaneously registers a record in `device_sessions`.
- Emits audit event: `SESSION_CREATED`.
- Logs structured info: `{ action: 'SESSION_CREATED', adminId, deviceLabel, outcome: 'SUCCESS' }`.

### 3.3 Session Validation & Last-Seen Throttling (`AuthService.validateSessionToken`)
- Checks `sessions.revoked_at IS NULL` AND `sessions.expires_at > CURRENT_TIMESTAMP`.
- Throttles `last_seen_at` updates: only writes to DB if `last_seen_at` is older than 60 seconds (1 minute throttle threshold).
- Synchronously updates both `sessions.last_seen_at` and `device_sessions.last_seen_at`.

### 3.4 Session Endpoints
1. `GET /api/settings/sessions`:
   - Admin authenticated.
   - Returns list of active device sessions with:
     `{ id, deviceLabel, lastSeenAt, createdAt, isCurrent }`.
   - Never exposes tokens, hashes, IP, or raw UA.
2. `POST /api/settings/sessions/[id]/revoke`:
   - Admin authenticated + CSRF/origin check + rate limited.
   - Transactionally sets `revoked_at = CURRENT_TIMESTAMP` on both `device_sessions` and `sessions`.
   - If the revoked session is the caller's session: clears session cookie (`Max-Age=0`) and flags `{ isCurrentSession: true, loggedOut: true }`.
   - Revoked session immediately fails subsequent requests with 401.
   - Emits audit event: `SESSION_REVOKED`.
3. `POST /api/settings/sessions/revoke-others`:
   - Admin authenticated + CSRF/origin check + rate limited.
   - Transactionally revokes all active sessions for current admin where `session_id != currentSessionId`.
   - Emits audit event: `REVOKE_OTHER_SESSIONS`.
   - Returns `{ message: 'All other sessions revoked successfully', revokedCount }`.

---

## 4. Idempotency Infrastructure

### 4.1 Module: `src/modules/audit/idempotency.service.ts`
- Contract:
  `IdempotencyService.execute<T>({ adminId, route, key, payload, executeFn, ttlHours })`
- Cases:
  - **No Key provided**: runs `executeFn` directly.
  - **Same key + Same request hash**:
    - If status is `COMPLETED`: returns original stored response reference immediately (no mutation).
    - If status is `IN_PROGRESS`: detects concurrent duplicate mutation; waits or safely aborts with `ConflictError('A request with this idempotency key is currently in progress.')`.
  - **Same key + Different request hash**:
    - Emits audit event `IDEMPOTENCY_CONFLICT`.
    - Throws `IdempotencyError('Idempotency key reused with different payload.')` (HTTP 409).
  - **Expired Key**:
    - Replaces expired key record safely or purges expired keys.
  - **Transaction Safety**:
    - Atomic DB insert with `ON CONFLICT (admin_id, route, key)` ensuring race condition safety.
    - If `executeFn` fails, updates status to `FAILED` or cleans up key so retry with fixed payload can execute.

---

## 5. Optimistic Concurrency & Data Change Revisions

### 5.1 Module: `src/modules/settings/revision.service.ts`
- Core methods:
  - `getCurrentRevision(domainKey)`
  - `bumpRevision(domainKey, client)`: Monotonically increments `revision` atomically using `RETURNING revision`.
  - `verifyRevision(domainKey, clientRevision)`: If `clientRevision` is provided and != current DB revision, throws `ConflictError('Stale revision for domain ...')` and provides `latestRevision`. Emits audit event `MATERIAL_DATA_CONFLICT`.
  - `getAllRevisions()`: Returns safe dictionary of all domain revisions internally for mutation precondition checks.
- Public Endpoint Decision:
  - No public route `/api/settings/revisions` is exposed. Revision management is retained as internal, reusable infrastructure for financial and inventory mutation preconditions.

---

## 6. Backup & Restore Lifecycle

### 6.1 Provider Abstraction & Classifications
- **`runDailyBackup` Classification**:
  **APPLICATION ORCHESTRATION IMPLEMENTED — PRODUCTION PROVIDER REQUIRED**
  The repository provides the complete application-side state machine (`SCHEDULED` -> `RUNNING` -> `SUCCEEDED` / `FAILED`), `backup_runs` ledger, encrypted/opaque reference generation (`bkp_...`), 30-day retention policies, audit events, and Pino developer logging.
  Production cloud storage persistence requires external infrastructure configuration:
  - `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (restricted IAM write-only role).
  - PostgreSQL replica dump utility / Neon point-in-time branch token.
  - Encryption key (`BACKUP_ENCRYPTION_KEY`).
  In development and testing, `MockBackupStorageProvider` serves as a deterministic test double. In production without registered cloud infrastructure, the service maps missing infrastructure to `ERR_STORAGE_UNAVAILABLE` without pretending cloud backups occurred.

- **`verifyBackupRestore` Classification**:
  **APPLICATION VERIFICATION ORCHESTRATION IMPLEMENTED — PRODUCTION RESTORE ENVIRONMENT REQUIRED**
  The repository provides the scheduled verification workflow, safe state checking, checksum validation, and audit tracking.
  A real production restore verification requires an isolated, non-production sandbox environment (e.g., ephemeral test DB container or segregated staging branch) to ensure zero risk to the live production database.

```ts
export interface BackupStorageProvider {
  createSnapshot(): Promise<{ reference: string; byteSize: number; checksum: string }>;
  verifySnapshot(reference: string, checksum: string): Promise<boolean>;
  deleteSnapshot(reference: string): Promise<boolean>;
}
```

### 6.2 Backup Service: `src/modules/backup/backup.service.ts`
- `runDailyBackup(provider?: BackupStorageProvider)`:
  1. Resolves provider (explicit provider -> registered production provider -> test double in dev).
  2. Creates `backup_runs` row with `status: 'RUNNING'`, `scheduled_for`.
  3. Emits audit `BACKUP_STARTED` and structured log.
  4. Executes snapshot creation.
  5. Encrypts / creates opaque reference `bkp_sha256(...)` so no cloud URL is exposed.
  6. Computes retention (`CURRENT_TIMESTAMP + INTERVAL '30 days'`).
  7. Updates `backup_runs` to `status: 'SUCCEEDED'`.
  8. Emits audit `BACKUP_SUCCEEDED` and structured log.
  9. On exception: catches provider error, stores safe code (`ERR_STORAGE_UNAVAILABLE`, `ERR_SNAPSHOT_FAILED`), logs raw error in developer logs only (redacting credentials), updates status to `FAILED`, emits audit `BACKUP_FAILED`.
- `verifyBackupRestore(backupRunId: string, provider?: BackupStorageProvider)`:
  1. Emits audit `RESTORE_VERIFICATION_STARTED`.
  2. Validates backup run exists and is `SUCCEEDED`.
  3. Executes restore verification in an isolated sandbox/verification double (strictly NEVER targeting production).
  4. Emits audit `RESTORE_VERIFICATION_SUCCEEDED` or `RESTORE_VERIFICATION_FAILED`.
- `cleanExpiredBackups(provider?: BackupStorageProvider)`:
  - Cleans up runs where `retention_until < CURRENT_TIMESTAMP`.

### 6.3 Backup Status Endpoint: `GET /api/settings/backup-status`
- Response Contract:
```json
{
  "data": {
    "backupStatus": {
      "lastSuccessfulBackupAt": "2026-10-08T02:00:00.000Z",
      "nextScheduledRun": "2026-10-09T02:00:00.000Z",
      "status": "SUCCEEDED",
      "safeFailureCode": null,
      "instruction": "All automated backups are running normally."
    }
  },
  "requestId": "..."
}
```
- **Strict redaction**: `backup_reference`, storage paths, provider tokens, and internal error stacks are completely absent.

---

## 7. Security, Audit, and Logging Invariants

### 7.1 Security & Rate Limiting
- Helper: `src/shared/auth/rate-limiter.ts` - in-memory sliding window rate limiter (30 requests/minute for sensitive session routes).
- Helper: `src/shared/auth/csrf.ts` - Origin / Referer validation against allowed domains on state-modifying requests.
- Guard: `requireAdmin` + `requireAdminSession` enforces valid unrevoked admin session.

### 7.2 Audit Events Emitted:
1. `SESSION_CREATED`
2. `SESSION_REVOKED`
3. `REVOKE_OTHER_SESSIONS`
4. `IDEMPOTENCY_CONFLICT`
5. `BACKUP_SCHEDULED`
6. `BACKUP_STARTED`
7. `BACKUP_SUCCEEDED`
8. `BACKUP_FAILED`
9. `RESTORE_VERIFICATION_STARTED`
10. `RESTORE_VERIFICATION_SUCCEEDED`
11. `RESTORE_VERIFICATION_FAILED`
12. `MATERIAL_DATA_CONFLICT`

### 7.3 Structured Developer Logging:
- Pino logger paths extended to redact: `backup_reference`, `backupReference`, `user_agent_hash`, `last_ip_hash`.
- Structured logs output `{ requestId, action, adminId, outcome, durationMs }`.

---

## 8. Verification & Test Plan

1. **Unit Tests** (`tests/unit/operational_resilience.test.ts`):
   - Device label parser for various user agents (Chrome/Win, Safari/iOS, Firefox/Linux, Edge/Mac, Unknown).
   - Safe hashing (UA hash, IP hash) - one-way, no plaintext leakage.
   - Revision check and conflict detection math.
   - Backup status safe instruction mapping and secret redaction.
   - Rate limiter sliding window behavior.
2. **Integration Tests** (`tests/integration/operational_resilience_api.test.ts`):
   - Device session creation on login.
   - Session listing (hides secrets, marks `isCurrent`).
   - Revoke specific session (invalidates further requests).
   - Revoke current session (sets signout cookie).
   - Revoke other sessions (preserves caller session).
   - Idempotency: same key/same hash returns original result; same key/different hash returns 409 conflict.
   - Idempotency concurrent duplicate handling.
   - Revision: monotonic increment on mutation, stale revision returns 409 conflict.
   - Backup lifecycle: `runDailyBackup` success and failure handling, opaque reference, retention timestamp.
   - Backup status endpoint: strictly redacts backup reference and returns safe instruction.
   - Restore verification: isolated test without touching production DB.
   - Origin/CSRF and rate limiting checks.
   - Audit event emission verification.
3. **Full Regression Suite**:
   - Run complete Vitest suite across all 40+ test files (377+ existing tests).
   - Run `npx tsc --noEmit`.
   - Run `npm run build`.
