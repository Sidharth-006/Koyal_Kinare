import { InventoryAlertsRepository } from './inventory-alerts.repository';
import { AuditService } from '../audit/audit.service';
import { NotFoundError, InventoryItemArchivedError, ItemNotLowStockError, ValidationError } from '@/shared/errors';
import Decimal from 'decimal.js';

export class InventoryAlertsService {
  static async getOverview() {
    return InventoryAlertsRepository.getOverviewCounts();
  }

  static async getLowStock(page: number = 1, pageSize: number = 20) {
    const validPage = Math.max(1, Number(page) || 1);
    const validPageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));

    return InventoryAlertsRepository.getLowStockItems({
      page: validPage,
      pageSize: validPageSize
    });
  }

  static async acknowledgeAlert(
    itemId: string,
    note: string | undefined,
    adminId: string,
    requestId?: string
  ) {
    if (!itemId) {
      throw new ValidationError('Item ID is required.');
    }

    const item = await InventoryAlertsRepository.getItemWithBalance(itemId);
    if (!item) {
      throw new NotFoundError('Inventory item not found.');
    }

    if (item.is_archived) {
      throw new InventoryItemArchivedError('Cannot acknowledge alert for an archived inventory item.');
    }

    const available = new Decimal(item.available_quantity || 0);
    const minimum = new Decimal(item.minimum_stock || 0);

    if (available.greaterThan(minimum)) {
      throw new ItemNotLowStockError('Item is not currently in low stock.');
    }

    const acknowledgement = await InventoryAlertsRepository.createAcknowledgement({
      inventoryItemId: itemId,
      balanceSnapshot: available.toFixed(3),
      note: note || null,
      acknowledgedBy: adminId
    });

    await AuditService.logEvent({
      adminId,
      action: 'LOW_STOCK_ACKNOWLEDGED',
      entityType: 'INVENTORY_ITEM',
      entityId: itemId,
      requestId,
      afterState: acknowledgement,
      metadata: {
        balanceSnapshot: available.toFixed(3),
        minimumStock: minimum.toFixed(3),
        note: note || null
      }
    });

    return acknowledgement;
  }
}
