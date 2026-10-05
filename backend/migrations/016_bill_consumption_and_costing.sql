-- Migration 016: Bill Consumption, Cost Tracking, and Stock Movement Extension

-- 1. Targeted update of stock_movements CHECK constraint
ALTER TABLE stock_movements 
    DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE stock_movements 
    ADD CONSTRAINT stock_movements_movement_type_check CHECK (
        movement_type IN (
            'OPENING',
            'PURCHASE_RECEIPT',
            'PURCHASE_REVERSAL',
            'MANUAL_INCREASE',
            'MANUAL_DECREASE',
            'WASTAGE',
            'MANUAL_CONSUMPTION',
            'COUNT_CORRECTION',
            'BILL_CONSUMPTION',
            'BILL_VOID_RETURN'
        )
    );

-- 2. Inventory Cost State (Exact DLD precision)
CREATE TABLE IF NOT EXISTS inventory_cost_state (
    inventory_item_id UUID PRIMARY KEY REFERENCES inventory_items(id) ON DELETE CASCADE,
    average_unit_cost NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CHECK (average_unit_cost >= 0),
    quantity_on_cost_basis NUMERIC(14, 3) NOT NULL DEFAULT 0.000 CHECK (quantity_on_cost_basis >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bill Consumptions (Exact DLD precision)
CREATE TABLE IF NOT EXISTS bill_consumptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
    bill_line_id UUID NOT NULL REFERENCES bill_lines(id) ON DELETE RESTRICT,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    recipe_version_id UUID NOT NULL REFERENCES recipe_versions(id) ON DELETE RESTRICT,
    quantity_consumed NUMERIC(14, 3) NOT NULL CHECK (quantity_consumed > 0),
    unit_cost_snapshot NUMERIC(14, 4) NULL CHECK (unit_cost_snapshot IS NULL OR unit_cost_snapshot >= 0),
    total_cost_snapshot NUMERIC(14, 4) NULL CHECK (total_cost_snapshot IS NULL OR total_cost_snapshot >= 0),
    stock_movement_id UUID NOT NULL UNIQUE REFERENCES stock_movements(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bill_consumptions_line_item_version UNIQUE (bill_line_id, inventory_item_id, recipe_version_id)
);

-- 4. Bill Cost Coverage (Exact DLD precision)
CREATE TABLE IF NOT EXISTS bill_cost_coverage (
    bill_id UUID PRIMARY KEY REFERENCES bills(id) ON DELETE RESTRICT,
    total_bill_lines INT NOT NULL CHECK (total_bill_lines >= 0),
    covered_lines INT NOT NULL CHECK (covered_lines >= 0),
    missing_recipe_lines INT NOT NULL CHECK (missing_recipe_lines >= 0),
    missing_cost_lines INT NOT NULL CHECK (missing_cost_lines >= 0),
    negative_stock_override_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_bill_consumptions_bill_id ON bill_consumptions(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_consumptions_item_id ON bill_consumptions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_bill_consumptions_stock_movement ON bill_consumptions(stock_movement_id);
