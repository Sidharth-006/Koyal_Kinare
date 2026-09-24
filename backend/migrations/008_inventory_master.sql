-- Migration 008: Inventory Master

DO $$ BEGIN
    CREATE TYPE inventory_item_type AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'BEVERAGE', 'CONSUMABLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE inventory_base_unit AS ENUM ('KG', 'G', 'L', 'ML', 'PIECE', 'PACKET', 'BOX');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL,
    item_type inventory_item_type NOT NULL,
    base_unit inventory_base_unit NOT NULL,
    minimum_stock NUMERIC(14, 3) NOT NULL CHECK (minimum_stock >= 0),
    description VARCHAR(500),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES admins(id),
    updated_by UUID REFERENCES admins(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_unique_name ON inventory_items(LOWER(name)) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_inventory_items_archived_type ON inventory_items(is_archived, item_type);
