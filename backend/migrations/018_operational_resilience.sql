-- Migration 018: Operational Resilience, Device Sessions, Idempotency Keys, Backup Runs, and Data Change Revisions

-- 1. Device Sessions Table
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

-- 2. Idempotency Keys Table
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

-- 3. Backup Runs Table
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

-- 4. Data Change Revisions Table
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
