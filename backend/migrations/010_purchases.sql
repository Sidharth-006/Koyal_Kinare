-- Migration 010: Purchase Management
-- Creates purchases, purchase_lines, and purchase_reversals

-- 1. Purchase Number Sequence
CREATE SEQUENCE IF NOT EXISTS purchase_number_seq START WITH 1 INCREMENT BY 1;

-- 2. Status & Payment Method Enums
DO $$ BEGIN
    CREATE TYPE purchase_status AS ENUM ('DRAFT', 'RECEIVED', 'REVERSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE purchase_payment_method AS ENUM ('CASH', 'UPI', 'CARD', 'CREDIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Purchases Table (Header)
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_number VARCHAR(32) NOT NULL UNIQUE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
    supplier_name VARCHAR(150) NOT NULL,
    invoice_number VARCHAR(100),
    purchase_date DATE NOT NULL,
    payment_method purchase_payment_method NOT NULL,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
    status purchase_status NOT NULL DEFAULT 'DRAFT',
    received_at TIMESTAMPTZ,
    attachment_id UUID REFERENCES attachments(id) ON DELETE SET NULL,
    note TEXT,
    created_by UUID NOT NULL REFERENCES admins(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_purchases_supplier_or_adhoc CHECK (
        (supplier_id IS NOT NULL) OR (char_length(trim(supplier_name)) > 0)
    )
);

-- 4. Purchase Lines Table (Detail lines)
CREATE TABLE IF NOT EXISTS purchase_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    item_name VARCHAR(150) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    quantity NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
    unit_rate NUMERIC(12, 2) NOT NULL CHECK (unit_rate >= 0),
    line_discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (line_discount >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
    line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Purchase Reversals Table
CREATE TABLE IF NOT EXISTS purchase_reversals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL UNIQUE REFERENCES purchases(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 5),
    reversed_by UUID NOT NULL REFERENCES admins(id),
    reversed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Indexes for Performance & Filtering
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_method ON purchases(payment_method);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_purchase ON purchase_lines(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_item ON purchase_lines(inventory_item_id);
