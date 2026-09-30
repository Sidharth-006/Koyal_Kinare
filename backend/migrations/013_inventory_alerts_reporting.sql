-- Migration 013: Inventory Alerts and Analytical Reporting

-- 1. Low Stock Alert Acknowledgements Table
CREATE TABLE IF NOT EXISTS low_stock_alert_acknowledgements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    balance_snapshot NUMERIC(14, 3) NOT NULL CHECK (balance_snapshot >= 0),
    acknowledged_by UUID NOT NULL REFERENCES admins(id),
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Justified Performance Indexes
-- Fast lookup for the latest acknowledgement per inventory item
CREATE INDEX IF NOT EXISTS idx_low_stock_ack_item_date 
ON low_stock_alert_acknowledgements (inventory_item_id, acknowledged_at DESC);

-- Fast lookup for inventory balances when evaluating low-stock conditions
CREATE INDEX IF NOT EXISTS idx_inventory_balances_available 
ON inventory_balances (available_quantity);

-- Fast lookup for stock movements by type and business date for movement and wastage reports
CREATE INDEX IF NOT EXISTS idx_stock_movements_type_date 
ON stock_movements (movement_type, business_date DESC);

-- Fast lookup for purchases by date, status, and payment method for financial reporting & reconciliation
CREATE INDEX IF NOT EXISTS idx_purchases_date_status_payment 
ON purchases (purchase_date, status, payment_method);
