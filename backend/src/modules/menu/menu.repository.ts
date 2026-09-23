import { query } from '@/shared/database/client';

export interface CategoryRecord {
  id: string;
  name: string;
  display_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuItemRecord {
  id: string;
  category_id: string;
  category_name?: string;
  name: string;
  selling_price: string;
  is_available: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CafeTableRecord {
  id: string;
  table_number: string;
  capacity: number;
  is_active: boolean;
  created_at: string;
}

export class MenuRepository {
  // Categories
  static async seedInitialCategoriesIfNeeded(): Promise<void> {
    const { rows } = await query('SELECT COUNT(*) as count FROM menu_categories');
    if (parseInt(rows[0].count, 10) === 0) {
      const initial = [
        'Momos', 'Indo-Chinese', 'Biryani', 'Pav Bhaji', 'Sandwiches',
        'Burger & Fries', 'Shakes', 'Ice Cream', 'Chaat', 'Pani Puri'
      ];
      for (let i = 0; i < initial.length; i++) {
        await query(
          'INSERT INTO menu_categories (name, display_order) VALUES ($1, $2)',
          [initial[i], i + 1]
        );
      }
    }
  }

  static async seedInitialTablesIfNeeded(): Promise<void> {
    const { rows } = await query('SELECT COUNT(*) as count FROM cafe_tables');
    if (parseInt(rows[0].count, 10) === 0) {
      for (let i = 1; i <= 10; i++) {
        await query(
          'INSERT INTO cafe_tables (table_number, capacity) VALUES ($1, $2)',
          [`T${i}`, 4]
        );
      }
    }
  }

  static async listCategories(includeArchived = false): Promise<CategoryRecord[]> {
    const text = includeArchived
      ? 'SELECT * FROM menu_categories ORDER BY display_order ASC, name ASC'
      : 'SELECT * FROM menu_categories WHERE is_archived = FALSE ORDER BY display_order ASC, name ASC';
    const { rows } = await query(text);
    return rows;
  }

  static async createCategory(name: string, displayOrder = 0): Promise<CategoryRecord> {
    const { rows } = await query(
      'INSERT INTO menu_categories (name, display_order) VALUES ($1, $2) RETURNING *',
      [name.trim(), displayOrder]
    );
    return rows[0];
  }

  static async archiveCategory(id: string): Promise<CategoryRecord> {
    const { rows } = await query(
      'UPDATE menu_categories SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return rows[0];
  }

  static async restoreCategory(id: string): Promise<CategoryRecord> {
    const { rows } = await query(
      'UPDATE menu_categories SET is_archived = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return rows[0];
  }

  // Items
  static async listMenuItems(includeArchived = false): Promise<MenuItemRecord[]> {
    const text = `
      SELECT i.*, c.name as category_name
      FROM menu_items i
      JOIN menu_categories c ON i.category_id = c.id
      ${includeArchived ? '' : 'WHERE i.is_archived = FALSE AND c.is_archived = FALSE'}
      ORDER BY c.display_order ASC, i.name ASC;
    `;
    const { rows } = await query(text);
    return rows;
  }

  static async findMenuItemById(id: string): Promise<MenuItemRecord | null> {
    const text = `
      SELECT i.*, c.name as category_name
      FROM menu_items i
      JOIN menu_categories c ON i.category_id = c.id
      WHERE i.id = $1;
    `;
    const { rows } = await query(text, [id]);
    return rows[0] || null;
  }

  static async createMenuItem(params: { categoryId: string; name: string; sellingPrice: number | string }): Promise<MenuItemRecord> {
    const { rows } = await query(
      `INSERT INTO menu_items (category_id, name, selling_price)
       VALUES ($1, $2, $3)
       RETURNING *;`,
      [params.categoryId, params.name.trim(), params.sellingPrice]
    );
    return rows[0];
  }

  static async updateMenuItemAvailability(id: string, isAvailable: boolean): Promise<MenuItemRecord> {
    const { rows } = await query(
      'UPDATE menu_items SET is_available = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [isAvailable, id]
    );
    return rows[0];
  }

  static async archiveMenuItem(id: string): Promise<MenuItemRecord> {
    const { rows } = await query(
      'UPDATE menu_items SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return rows[0];
  }

  static async restoreMenuItem(id: string): Promise<MenuItemRecord> {
    const { rows } = await query(
      'UPDATE menu_items SET is_archived = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return rows[0];
  }

  // Tables
  static async listTables(): Promise<CafeTableRecord[]> {
    const { rows } = await query('SELECT * FROM cafe_tables WHERE is_active = TRUE ORDER BY table_number ASC');
    return rows;
  }

  static async findTableById(id: string): Promise<CafeTableRecord | null> {
    const { rows } = await query('SELECT * FROM cafe_tables WHERE id = $1 AND is_active = TRUE', [id]);
    return rows[0] || null;
  }
}
