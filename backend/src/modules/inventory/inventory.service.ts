import { InventoryRepository } from './inventory.repository';
import { CreateInventoryItemDTO, UpdateInventoryItemDTO, InventoryListParams, InventoryBaseUnit, InventoryItemType } from './inventory.types';
import { AuditService } from '../audit/audit.service';
import { IdempotencyRepository } from '../audit/idempotency.repository';
import { withTransaction } from '@/shared/database/client';
import {
  ValidationError,
  NotFoundError,
  DuplicateInventoryItemError,
  ItemHasStockHistoryError,
  ItemInUseError,
  IdempotencyError
} from '@/shared/errors';
import Decimal from 'decimal.js';

const VALID_ITEM_TYPES: InventoryItemType[] = ['RAW_MATERIAL', 'PACKAGING', 'BEVERAGE', 'CONSUMABLE'];
const VALID_BASE_UNITS: InventoryBaseUnit[] = ['KG', 'G', 'L', 'ML', 'PIECE', 'PACKET', 'BOX'];

export class InventoryService {
  private static validateName(name: any): string {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Inventory item name is required.');
    }
    const trimmed = name.trim();
    if (trimmed.length > 120) {
      throw new ValidationError('Inventory item name cannot exceed 120 characters.');
    }
    return trimmed;
  }

  private static validateItemType(type: any): InventoryItemType {
    if (!type || !VALID_ITEM_TYPES.includes(type)) {
      throw new ValidationError(`Invalid item type. Must be one of: ${VALID_ITEM_TYPES.join(', ')}`);
    }
    return type;
  }

  private static validateBaseUnit(unit: any): InventoryBaseUnit {
    if (!unit || !VALID_BASE_UNITS.includes(unit)) {
      throw new ValidationError(`Invalid base unit. Must be one of: ${VALID_BASE_UNITS.join(', ')}`);
    }
    return unit;
  }

  private static validateMinimumStock(minStock: any): string {
    if (minStock === undefined || minStock === null || minStock === '') {
      throw new ValidationError('Minimum stock level is required.');
    }
    let dec: Decimal;
    try {
      dec = new Decimal(minStock);
    } catch {
      throw new ValidationError('Minimum stock must be a valid number.');
    }

    if (dec.isNegative()) {
      throw new ValidationError('Minimum stock cannot be negative.');
    }

    if (dec.decimalPlaces() > 3) {
      throw new ValidationError('Minimum stock cannot have more than 3 decimal places.');
    }

    return dec.toFixed(3);
  }

  private static validateDescription(desc: any): string | null {
    if (!desc) return null;
    if (typeof desc !== 'string') {
      throw new ValidationError('Description must be a string.');
    }
    if (desc.length > 500) {
      throw new ValidationError('Description cannot exceed 500 characters.');
    }
    return desc.trim() || null;
  }

  static async listItems(params: InventoryListParams) {
    return InventoryRepository.list(params);
  }

  static async getItemById(id: string) {
    const item = await InventoryRepository.findById(id);
    if (!item) {
      throw new NotFoundError('Inventory item not found.');
    }
    return item;
  }

  static async createItem(payload: CreateInventoryItemDTO, adminId: string, requestId?: string) {
    const name = this.validateName(payload.name);
    const itemType = this.validateItemType(payload.itemType);
    const baseUnit = this.validateBaseUnit(payload.baseUnit);
    const minimumStock = this.validateMinimumStock(payload.minimumStock);
    const description = this.validateDescription(payload.description);

    const idempotencyKey = payload.idempotencyKey;
    if (idempotencyKey) {
      const existing = await IdempotencyRepository.find(idempotencyKey);
      if (existing) {
        const currentHash = IdempotencyRepository.computeHash({ name, itemType, baseUnit, minimumStock, description });
        if (existing.request_hash === currentHash) {
          return existing.response_body;
        } else {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
      }
    }

    const existingActive = await InventoryRepository.findActiveByName(name);
    if (existingActive) {
      throw new DuplicateInventoryItemError();
    }

    const result = await withTransaction(async (client) => {
      const item = await InventoryRepository.create(
        { name, itemType, baseUnit, minimumStock, description },
        adminId,
        client
      );

      await AuditService.logEvent(
        {
          adminId,
          action: 'INVENTORY_ITEM_CREATED',
          entityType: 'INVENTORY_ITEM',
          entityId: item.id,
          requestId,
          afterState: item
        },
        client
      );

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ name, itemType, baseUnit, minimumStock, description }),
          201,
          item,
          client
        );
      }

      return item;
    });

    return result;
  }

  static async updateItem(id: string, payload: UpdateInventoryItemDTO, adminId: string, requestId?: string) {
    const existing = await this.getItemById(id);

    const idempotencyKey = payload.idempotencyKey;
    if (idempotencyKey) {
      const cached = await IdempotencyRepository.find(idempotencyKey);
      if (cached) {
        const currentHash = IdempotencyRepository.computeHash({ id, ...payload });
        if (cached.request_hash === currentHash) {
          return cached.response_body;
        } else {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
      }
    }

    let name = existing.name;
    if (payload.name !== undefined) {
      name = this.validateName(payload.name);
      if (name.toLowerCase() !== existing.name.toLowerCase()) {
        const conflict = await InventoryRepository.findActiveByName(name, id);
        if (conflict) {
          throw new DuplicateInventoryItemError();
        }
      }
    }

    let itemType = existing.item_type;
    if (payload.itemType !== undefined) {
      itemType = this.validateItemType(payload.itemType);
    }

    let baseUnit = existing.base_unit;
    if (payload.baseUnit !== undefined) {
      baseUnit = this.validateBaseUnit(payload.baseUnit);
      if (baseUnit !== existing.base_unit) {
        const hasHistory = await InventoryRepository.hasStockHistory(id);
        if (hasHistory) {
          throw new ItemHasStockHistoryError();
        }
      }
    }

    let minimumStock = String(existing.minimum_stock);
    if (payload.minimumStock !== undefined) {
      minimumStock = this.validateMinimumStock(payload.minimumStock);
    }

    let description = existing.description;
    if (payload.description !== undefined) {
      description = this.validateDescription(payload.description);
    }

    const result = await withTransaction(async (client) => {
      const updated = await InventoryRepository.update(
        id,
        { name, itemType, baseUnit, minimumStock, description },
        adminId,
        client
      );

      await AuditService.logEvent(
        {
          adminId,
          action: 'INVENTORY_ITEM_UPDATED',
          entityType: 'INVENTORY_ITEM',
          entityId: id,
          requestId,
          beforeState: existing,
          afterState: updated
        },
        client
      );

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ id, ...payload }),
          200,
          updated,
          client
        );
      }

      return updated;
    });

    return result;
  }

  static async archiveItem(id: string, adminId: string, idempotencyKey?: string, requestId?: string) {
    const existing = await this.getItemById(id);
    if (existing.is_archived) {
      throw new ValidationError('Inventory item is already archived.');
    }

    if (idempotencyKey) {
      const cached = await IdempotencyRepository.find(idempotencyKey);
      if (cached) {
        const currentHash = IdempotencyRepository.computeHash({ archiveId: id });
        if (cached.request_hash === currentHash) {
          return cached.response_body;
        } else {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
      }
    }

    const inUse = await InventoryRepository.hasPendingFlows(id);
    if (inUse) {
      throw new ItemInUseError();
    }

    const result = await withTransaction(async (client) => {
      const archived = await InventoryRepository.setArchiveStatus(id, true, adminId, client);

      await AuditService.logEvent(
        {
          adminId,
          action: 'INVENTORY_ITEM_ARCHIVED',
          entityType: 'INVENTORY_ITEM',
          entityId: id,
          requestId,
          beforeState: existing,
          afterState: archived
        },
        client
      );

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ archiveId: id }),
          200,
          archived,
          client
        );
      }

      return archived;
    });

    return result;
  }

  static async restoreItem(id: string, adminId: string, idempotencyKey?: string, requestId?: string) {
    const existing = await this.getItemById(id);
    if (!existing.is_archived) {
      throw new ValidationError('Inventory item is not archived.');
    }

    if (idempotencyKey) {
      const cached = await IdempotencyRepository.find(idempotencyKey);
      if (cached) {
        const currentHash = IdempotencyRepository.computeHash({ restoreId: id });
        if (cached.request_hash === currentHash) {
          return cached.response_body;
        } else {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
      }
    }

    const activeConflict = await InventoryRepository.findActiveByName(existing.name);
    if (activeConflict) {
      throw new DuplicateInventoryItemError('Cannot restore item because an active item with the same name already exists.');
    }

    const result = await withTransaction(async (client) => {
      const restored = await InventoryRepository.setArchiveStatus(id, false, adminId, client);

      await AuditService.logEvent(
        {
          adminId,
          action: 'INVENTORY_ITEM_RESTORED',
          entityType: 'INVENTORY_ITEM',
          entityId: id,
          requestId,
          beforeState: existing,
          afterState: restored
        },
        client
      );

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ restoreId: id }),
          200,
          restored,
          client
        );
      }

      return restored;
    });

    return result;
  }
}
