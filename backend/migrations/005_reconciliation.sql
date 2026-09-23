-- Migration 005: Reconciliation

CREATE TABLE IF NOT EXISTS cash_openings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_date DATE NOT NULL UNIQUE,
    opening_cash NUMERIC(12, 2) NOT NULL CHECK (opening_cash >= 0),
    set_by UUID NOT NULL REFERENCES admins(id),
    set_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_closings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_date DATE NOT NULL UNIQUE,
    opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (opening_cash >= 0),
    cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cash_sales >= 0),
    cash_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cash_expenses >= 0),
    expected_closing_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (expected_closing_cash >= 0),
    actual_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (actual_cash >= 0),
    cash_difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_status VARCHAR(20) NOT NULL CHECK (cash_status IN ('MATCHED', 'SHORTAGE', 'EXCESS')),
    upi_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (upi_sales >= 0),
    upi_settlement NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (upi_settlement >= 0),
    upi_difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    upi_status VARCHAR(20) NOT NULL CHECK (upi_status IN ('MATCHED', 'MISMATCHED')),
    card_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (card_sales >= 0),
    card_settlement NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (card_settlement >= 0),
    card_difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    card_status VARCHAR(20) NOT NULL CHECK (card_status IN ('MATCHED', 'MISMATCHED')),
    status VARCHAR(20) NOT NULL DEFAULT 'CLOSED' CHECK (status IN ('OPEN', 'CLOSED', 'MISMATCHED')),
    notes TEXT DEFAULT '',
    closed_by UUID NOT NULL REFERENCES admins(id),
    closed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_date DATE NOT NULL,
    method VARCHAR(20) NOT NULL CHECK (method IN ('UPI', 'CARD')),
    expected_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (expected_amount >= 0),
    settlement_amount NUMERIC(12, 2) NOT NULL CHECK (settlement_amount >= 0),
    difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL CHECK (status IN ('MATCHED', 'MISMATCHED')),
    notes TEXT DEFAULT '',
    settled_by UUID NOT NULL REFERENCES admins(id),
    settled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_settlement_date_method UNIQUE (business_date, method)
);
