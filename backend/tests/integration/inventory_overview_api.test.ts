import { describe, it, expect, beforeAll } from 'vitest';
import { InventoryAlertsService } from '@/modules/inventory/inventory-alerts.service';
import { InventoryRepository } from '@/modules/inventory/inventory.repository';
import { query } from '@/shared/database/client';

describe('Inventory Overview Integration Tests', () => {
  let adminId: string;

  beforeAll(async () => {
    const adminRes = await query('SELECT id FROM admins LIMIT 1');
    if (adminRes.rows.length > 0) {
      adminId = adminRes.rows[0].id;
    } else {
      const inserted = await query(
        "INSERT INTO admins (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id",
        ['overview_admin@koyal.com', 'hash', 'Overview Admin']
      );
      adminId = inserted.rows[0].id;
    }

    // Create a test active item with 0 stock (will be low stock)
    await InventoryRepository.create(
      {
        name: `Overview Low Stock Item ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '15.000'
      },
      adminId
    );
  });

  it('should return overview counts with active items and low stock counts', async () => {
    const overview = await InventoryAlertsService.getOverview();

    expect(overview).toHaveProperty('totalActiveItems');
    expect(overview).toHaveProperty('activeLowStockCount');
    expect(overview).toHaveProperty('recentPurchases');
    expect(overview).toHaveProperty('recentMovements');

    expect(Number(overview.totalActiveItems)).toBeGreaterThan(0);
    expect(Number(overview.activeLowStockCount)).toBeGreaterThan(0);
    expect(Array.isArray(overview.recentPurchases)).toBe(true);
    expect(Array.isArray(overview.recentMovements)).toBe(true);
    expect(overview.recentPurchases.length).toBeLessThanOrEqual(5);
    expect(overview.recentMovements.length).toBeLessThanOrEqual(5);
  });
});
