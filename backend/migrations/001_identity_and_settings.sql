-- Migration 001: Identity and Settings
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_name VARCHAR(255) NOT NULL DEFAULT 'Koyal Kinare Cafe',
    address TEXT NOT NULL DEFAULT '',
    contact_phone VARCHAR(50) NOT NULL DEFAULT '',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    receipt_header TEXT DEFAULT '',
    receipt_footer TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS target_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_sales_target NUMERIC(12, 2) NOT NULL DEFAULT 5000.00 CHECK (daily_sales_target >= 0),
    monthly_sales_target NUMERIC(12, 2) NOT NULL DEFAULT 150000.00 CHECK (monthly_sales_target >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS tax_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    label VARCHAR(50) NOT NULL DEFAULT 'GST',
    rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00 CHECK (rate >= 0),
    is_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES admins(id)
);
