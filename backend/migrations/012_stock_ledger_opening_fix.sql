-- Migration 012: Correct opening stock uniqueness to (inventory_item_id, business_date, source_id)

-- Drop the old lifetime-wide unique index
DROP INDEX IF EXISTS uq_stock_movements_item_opening;

-- Create the DLD-compliant unique index scoped to item + business_date + source_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_movements_opening_item_date_source 
ON stock_movements (inventory_item_id, business_date, source_id) 
WHERE movement_type = 'OPENING';
