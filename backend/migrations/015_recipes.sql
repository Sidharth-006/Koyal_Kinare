-- Migration 015: Recipe Management and Versioning

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE recipe_status AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE recipe_version_status AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Recipes Table (Parent container linking menu items to version history)
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL UNIQUE REFERENCES menu_items(id) ON DELETE RESTRICT,
    active_version_id UUID NULL,
    status recipe_status NOT NULL DEFAULT 'INACTIVE',
    created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Recipe Versions Table (Immutable historical snapshots + editable drafts)
CREATE TABLE IF NOT EXISTS recipe_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    version_number INT NOT NULL CHECK (version_number > 0),
    status recipe_version_status NOT NULL DEFAULT 'DRAFT',
    effective_from TIMESTAMPTZ NULL,
    superseded_at TIMESTAMPTZ NULL,
    note TEXT NULL,
    created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_recipe_versions_recipe_version UNIQUE (recipe_id, version_number)
);

-- Circular FK link from recipes.active_version_id -> recipe_versions.id
ALTER TABLE recipes
    DROP CONSTRAINT IF EXISTS fk_recipes_active_version,
    ADD CONSTRAINT fk_recipes_active_version
        FOREIGN KEY (active_version_id)
        REFERENCES recipe_versions(id)
        ON DELETE SET NULL;

-- 4. Recipe Ingredients Table (Line items per version with frozen snapshots)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_version_id UUID NOT NULL REFERENCES recipe_versions(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    item_name_snapshot VARCHAR(120) NOT NULL,
    unit_snapshot VARCHAR(20) NOT NULL,
    quantity NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
    wastage_allowance_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (wastage_allowance_pct >= 0 AND wastage_allowance_pct <= 100),
    note VARCHAR(255) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_recipe_ingredients_version_item UNIQUE (recipe_version_id, inventory_item_id)
);

-- 5. Indexes for Performance & Coverage Queries
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id ON recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_status ON recipes(status);
CREATE INDEX IF NOT EXISTS idx_recipes_active_version_id ON recipes(active_version_id);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe_status ON recipe_versions(recipe_id, status);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_version ON recipe_ingredients(recipe_version_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_inventory_item ON recipe_ingredients(inventory_item_id);
