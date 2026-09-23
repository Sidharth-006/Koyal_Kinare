-- Migration 004: Expenses and Attachments

CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_key VARCHAR(255) NOT NULL UNIQUE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL CHECK (file_size > 0),
    uploaded_by UUID NOT NULL REFERENCES admins(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_date DATE NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (
        category IN ('RAW_MATERIALS', 'LPG', 'ELECTRICITY', 'SALARY', 'PACKAGING', 'MAINTENANCE', 'MISCELLANEOUS')
    ),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'UPI', 'CARD')),
    description TEXT NOT NULL,
    attachment_id UUID REFERENCES attachments(id),
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    void_reason TEXT,
    voided_by UUID REFERENCES admins(id),
    voided_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES admins(id),
    updated_by UUID REFERENCES admins(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
