import { query } from '@/shared/database/client';
import { PoolClient } from 'pg';
import {
  RecipeRecord,
  RecipeVersionRecord,
  RecipeIngredientRecord,
  RecipeStatus,
  RecipeVersionStatus,
  RecipeCoverageItemDTO
} from './recipe.types';

function formatRecipe(row: any): RecipeRecord {
  return {
    id: row.id,
    menu_item_id: row.menu_item_id,
    active_version_id: row.active_version_id || null,
    status: row.status,
    created_by: row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function formatRecipeVersion(row: any): RecipeVersionRecord {
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    version_number: Number(row.version_number),
    status: row.status,
    effective_from: row.effective_from || null,
    superseded_at: row.superseded_at || null,
    note: row.note || null,
    created_by: row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function formatRecipeIngredient(row: any): RecipeIngredientRecord {
  return {
    id: row.id,
    recipe_version_id: row.recipe_version_id,
    inventory_item_id: row.inventory_item_id,
    item_name_snapshot: row.item_name_snapshot,
    unit_snapshot: row.unit_snapshot,
    quantity: String(row.quantity),
    wastage_allowance_pct: String(row.wastage_allowance_pct),
    note: row.note || null,
    created_at: row.created_at
  };
}

export class RecipeRepository {
  private static getExecutor(client?: PoolClient) {
    if (client) {
      return {
        query: (text: string, params?: any[]) => client.query(text, params)
      };
    }
    return {
      query: (text: string, params?: any[]) => query(text, params)
    };
  }

  // ==========================================
  // 1. Parent Recipe Operations
  // ==========================================

  static async findRecipeByMenuItemId(menuItemId: string, client?: PoolClient): Promise<RecipeRecord | null> {
    const db = this.getExecutor(client);
    const sql = `SELECT * FROM recipes WHERE menu_item_id = $1 LIMIT 1`;
    const { rows } = await db.query(sql, [menuItemId]);
    return rows[0] ? formatRecipe(rows[0]) : null;
  }

  static async findRecipeById(id: string, client?: PoolClient): Promise<RecipeRecord | null> {
    const db = this.getExecutor(client);
    const sql = `SELECT * FROM recipes WHERE id = $1 LIMIT 1`;
    const { rows } = await db.query(sql, [id]);
    return rows[0] ? formatRecipe(rows[0]) : null;
  }

  static async createRecipe(
    params: { menuItemId: string; createdBy?: string | null },
    client?: PoolClient
  ): Promise<RecipeRecord> {
    const db = this.getExecutor(client);
    const sql = `
      INSERT INTO recipes (menu_item_id, status, created_by)
      VALUES ($1, 'INACTIVE', $2)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [params.menuItemId, params.createdBy || null]);
    return formatRecipe(rows[0]);
  }

  static async updateRecipeActiveVersion(
    params: { recipeId: string; activeVersionId: string | null; status: RecipeStatus },
    client?: PoolClient
  ): Promise<RecipeRecord> {
    const db = this.getExecutor(client);
    const sql = `
      UPDATE recipes
      SET active_version_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [params.activeVersionId, params.status, params.recipeId]);
    return formatRecipe(rows[0]);
  }

  static async lockRecipeById(recipeId: string, client: PoolClient): Promise<RecipeRecord | null> {
    const sql = `SELECT * FROM recipes WHERE id = $1 FOR UPDATE;`;
    const { rows } = await client.query(sql, [recipeId]);
    return rows[0] ? formatRecipe(rows[0]) : null;
  }

  // ==========================================
  // 2. Recipe Version Operations
  // ==========================================

  static async findVersionById(id: string, client?: PoolClient): Promise<RecipeVersionRecord | null> {
    const db = this.getExecutor(client);
    const sql = `SELECT * FROM recipe_versions WHERE id = $1 LIMIT 1`;
    const { rows } = await db.query(sql, [id]);
    return rows[0] ? formatRecipeVersion(rows[0]) : null;
  }

  static async findVersionByRecipeAndNumber(
    recipeId: string,
    versionNumber: number,
    client?: PoolClient
  ): Promise<RecipeVersionRecord | null> {
    const db = this.getExecutor(client);
    const sql = `SELECT * FROM recipe_versions WHERE recipe_id = $1 AND version_number = $2 LIMIT 1`;
    const { rows } = await db.query(sql, [recipeId, versionNumber]);
    return rows[0] ? formatRecipeVersion(rows[0]) : null;
  }

  static async findActiveVersionByRecipeId(recipeId: string, client?: PoolClient): Promise<RecipeVersionRecord | null> {
    const db = this.getExecutor(client);
    const sql = `SELECT * FROM recipe_versions WHERE recipe_id = $1 AND status = 'ACTIVE' LIMIT 1`;
    const { rows } = await db.query(sql, [recipeId]);
    return rows[0] ? formatRecipeVersion(rows[0]) : null;
  }

  static async findLatestDraftVersionByRecipeId(recipeId: string, client?: PoolClient): Promise<RecipeVersionRecord | null> {
    const db = this.getExecutor(client);
    const sql = `
      SELECT * FROM recipe_versions 
      WHERE recipe_id = $1 AND status = 'DRAFT'
      ORDER BY version_number DESC
      LIMIT 1;
    `;
    const { rows } = await db.query(sql, [recipeId]);
    return rows[0] ? formatRecipeVersion(rows[0]) : null;
  }

  static async getNextVersionNumber(recipeId: string, client?: PoolClient): Promise<number> {
    const db = this.getExecutor(client);
    const sql = `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM recipe_versions WHERE recipe_id = $1`;
    const { rows } = await db.query(sql, [recipeId]);
    return Number(rows[0].next_version);
  }

  static async createVersion(
    params: {
      recipeId: string;
      versionNumber: number;
      status?: RecipeVersionStatus;
      note?: string | null;
      createdBy?: string | null;
    },
    client?: PoolClient
  ): Promise<RecipeVersionRecord> {
    const db = this.getExecutor(client);
    const sql = `
      INSERT INTO recipe_versions (recipe_id, version_number, status, note, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [
      params.recipeId,
      params.versionNumber,
      params.status || 'DRAFT',
      params.note || null,
      params.createdBy || null
    ]);
    return formatRecipeVersion(rows[0]);
  }

  static async updateVersionNote(
    params: { versionId: string; note?: string | null },
    client?: PoolClient
  ): Promise<RecipeVersionRecord> {
    const db = this.getExecutor(client);
    const sql = `
      UPDATE recipe_versions
      SET note = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [params.note || null, params.versionId]);
    return formatRecipeVersion(rows[0]);
  }

  static async updateVersionStatus(
    params: {
      versionId: string;
      status: RecipeVersionStatus;
      effectiveFrom?: string | null;
      supersededAt?: string | null;
    },
    client?: PoolClient
  ): Promise<RecipeVersionRecord> {
    const db = this.getExecutor(client);
    const sql = `
      UPDATE recipe_versions
      SET status = $1,
          effective_from = COALESCE($2, effective_from),
          superseded_at = COALESCE($3, superseded_at),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [
      params.status,
      params.effectiveFrom || null,
      params.supersededAt || null,
      params.versionId
    ]);
    return formatRecipeVersion(rows[0]);
  }

  static async listVersionsByRecipeId(recipeId: string, client?: PoolClient): Promise<RecipeVersionRecord[]> {
    const db = this.getExecutor(client);
    const sql = `
      SELECT * FROM recipe_versions 
      WHERE recipe_id = $1 
      ORDER BY version_number DESC;
    `;
    const { rows } = await db.query(sql, [recipeId]);
    return rows.map(formatRecipeVersion);
  }

  static async lockVersionById(versionId: string, client: PoolClient): Promise<RecipeVersionRecord | null> {
    const sql = `SELECT * FROM recipe_versions WHERE id = $1 FOR UPDATE;`;
    const { rows } = await client.query(sql, [versionId]);
    return rows[0] ? formatRecipeVersion(rows[0]) : null;
  }

  // ==========================================
  // 3. Ingredient Operations
  // ==========================================

  static async listIngredientsByVersionId(
    versionId: string,
    client?: PoolClient
  ): Promise<RecipeIngredientRecord[]> {
    const db = this.getExecutor(client);
    const sql = `
      SELECT * FROM recipe_ingredients
      WHERE recipe_version_id = $1
      ORDER BY item_name_snapshot ASC;
    `;
    const { rows } = await db.query(sql, [versionId]);
    return rows.map(formatRecipeIngredient);
  }

  static async deleteIngredientsByVersionId(versionId: string, client?: PoolClient): Promise<void> {
    const db = this.getExecutor(client);
    const sql = `DELETE FROM recipe_ingredients WHERE recipe_version_id = $1;`;
    await db.query(sql, [versionId]);
  }

  static async insertIngredients(
    versionId: string,
    ingredients: Array<{
      inventoryItemId: string;
      itemNameSnapshot: string;
      unitSnapshot: string;
      quantity: string | number;
      wastageAllowancePct?: string | number;
      note?: string | null;
    }>,
    client?: PoolClient
  ): Promise<RecipeIngredientRecord[]> {
    if (ingredients.length === 0) return [];
    const db = this.getExecutor(client);

    const values: any[] = [];
    const valueClauses: string[] = [];

    ingredients.forEach((ing, index) => {
      const baseIndex = index * 7;
      valueClauses.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`
      );
      values.push(
        versionId,
        ing.inventoryItemId,
        ing.itemNameSnapshot,
        ing.unitSnapshot,
        ing.quantity,
        ing.wastageAllowancePct !== undefined ? ing.wastageAllowancePct : 0.0,
        ing.note || null
      );
    });

    const sql = `
      INSERT INTO recipe_ingredients (
        recipe_version_id,
        inventory_item_id,
        item_name_snapshot,
        unit_snapshot,
        quantity,
        wastage_allowance_pct,
        note
      )
      VALUES ${valueClauses.join(', ')}
      RETURNING *;
    `;

    const { rows } = await db.query(sql, values);
    return rows.map(formatRecipeIngredient);
  }

  // ==========================================
  // 4. Coverage & Missing Recipe Queries
  // ==========================================

  static async listCoverage(params: {
    status?: string;
    missingOnly?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: RecipeCoverageItemDTO[]; total: number }> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const whereClauses: string[] = ['m.is_archived = FALSE'];
    const queryParams: any[] = [];

    if (params.missingOnly) {
      whereClauses.push('(r.id IS NULL OR r.active_version_id IS NULL OR r.status != \'ACTIVE\')');
    } else if (params.status && params.status !== 'ALL') {
      queryParams.push(params.status.toUpperCase());
      whereClauses.push(`r.status = $${queryParams.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT 
        m.id AS menu_item_id,
        m.name AS menu_item_name,
        c.name AS category_name,
        r.id AS recipe_id,
        r.status AS recipe_status,
        r.active_version_id,
        v.version_number AS active_version_number,
        COALESCE(ing.ingredient_count, 0) AS ingredient_count,
        CASE 
          WHEN r.active_version_id IS NOT NULL AND r.status = 'ACTIVE' THEN TRUE 
          ELSE FALSE 
        END AS has_active_recipe,
        r.updated_at,
        COUNT(*) OVER() AS total_count
      FROM menu_items m
      JOIN menu_categories c ON m.category_id = c.id
      LEFT JOIN recipes r ON r.menu_item_id = m.id
      LEFT JOIN recipe_versions v ON r.active_version_id = v.id
      LEFT JOIN (
        SELECT recipe_version_id, COUNT(*) AS ingredient_count
        FROM recipe_ingredients
        GROUP BY recipe_version_id
      ) ing ON ing.recipe_version_id = v.id
      ${whereSql}
      ORDER BY c.display_order ASC, m.name ASC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};
    `;

    queryParams.push(pageSize, offset);

    const { rows } = await query(sql, queryParams);
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    const items: RecipeCoverageItemDTO[] = rows.map((r) => ({
      menuItemId: r.menu_item_id,
      menuItemName: r.menu_item_name,
      categoryName: r.category_name,
      recipeId: r.recipe_id || null,
      status: r.recipe_status || null,
      activeVersionId: r.active_version_id || null,
      activeVersionNumber: r.active_version_number !== null ? Number(r.active_version_number) : null,
      ingredientCount: Number(r.ingredient_count),
      hasActiveRecipe: Boolean(r.has_active_recipe),
      updatedAt: r.updated_at || null
    }));

    return { items, total };
  }
}
