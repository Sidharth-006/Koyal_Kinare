-- Migration 009: Supplier Management

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    gstin TEXT,
    notes TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES admins(id),
    updated_by UUID REFERENCES admins(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Case-insensitive unique partial index among active suppliers
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_unique_active_name 
ON suppliers (LOWER(name)) 
WHERE is_archived = FALSE;

-- Index on is_archived, name
CREATE INDEX IF NOT EXISTS idx_suppliers_archived_name 
ON suppliers (is_archived, name);
