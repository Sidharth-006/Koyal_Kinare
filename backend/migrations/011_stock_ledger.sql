-- Migration 011: Stock Ledger and Physical Counts

-- 1. Inventory Balances Table (Tracks current authoritative stock per item)
CREATE TABLE IF NOT EXISTS inventory_balances (
    inventory_item_id UUID PRIMARY KEY REFERENCES inventory_items(id) ON DELETE RESTRICT,
    available_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0.000 CHECK (available_quantity >= 0),
    last_movement_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stock Movements Table (Append-only immutable audit ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    business_date DATE NOT NULL,
    movement_type VARCHAR(30) NOT NULL CHECK (
        movement_type IN (
            'OPENING',
            'PURCHASE_RECEIPT',
            'PURCHASE_REVERSAL',
            'MANUAL_INCREASE',
            'MANUAL_DECREASE',
            'WASTAGE',
            'MANUAL_CONSUMPTION',
            'COUNT_CORRECTION'
        )
    ),
    quantity_delta NUMERIC(14, 3) NOT NULL CHECK (quantity_delta != 0),
    unit_cost NUMERIC(12, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
    source_type VARCHAR(50) NOT NULL,
    source_id VARCHAR(100) NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES admins(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Stock Counts Table (Physical inventory counts & verification)
CREATE TABLE IF NOT EXISTS stock_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    business_date DATE NOT NULL,
    expected_quantity NUMERIC(14, 3) NOT NULL CHECK (expected_quantity >= 0),
    actual_quantity NUMERIC(14, 3) NOT NULL CHECK (actual_quantity >= 0),
    variance_quantity NUMERIC(14, 3) NOT NULL,
    reason TEXT,
    counted_by UUID NOT NULL REFERENCES admins(id),
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Mandatory Performance & Analytical Indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_date 
ON stock_movements (inventory_item_id, business_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_date_type 
ON stock_movements (business_date, movement_type);

CREATE INDEX IF NOT EXISTS idx_stock_movements_source 
ON stock_movements (source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_stock_counts_item_date 
ON stock_counts (inventory_item_id, business_date DESC);

-- 5. Strict Uniqueness Indexes for Machine Duplication Prevention
-- Machine movements (purchase receipt, purchase reversal) must have exactly one movement per source_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_movements_machine_source 
ON stock_movements (source_type, source_id) 
WHERE source_type IN ('PURCHASE_RECEIPT', 'PURCHASE_REVERSAL');

-- Opening movement: Maximum one opening movement per inventory item
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_movements_item_opening 
ON stock_movements (inventory_item_id) 
WHERE movement_type = 'OPENING';
