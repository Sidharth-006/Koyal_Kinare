import { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import crypto from 'crypto';
import { withTransaction } from '@/shared/database/client';
import { getTodayDateString } from '@/shared/time';
import {
  ValidationError,
  NotFoundError,
  InsufficientStockError,
  DuplicateOpeningStockError,
  DuplicateMovementError,
  IdempotencyError
} from '@/shared/errors';
import { AuditService } from '../audit/audit.service';
import { IdempotencyRepository } from '../audit/idempotency.repository';
import { InventoryRepository } from '../inventory/inventory.repository';
import { StockRepository } from './stock.repository';
import {
  StockMovement,
  StockMovementType,
  RecordOpeningStockDTO,
  RecordAdjustmentDTO,
  RecordStockCountDTO,
  RecordPurchaseReceiptInput,
  RecordPurchaseReversalInput,
  StockMovementResult,
  ItemStockSummary,
  StockMovementListParams,
  StockMovementListResult
} from './stock.types';

export class StockLedgerService {
  private static validateQuantity(qty: number | string, allowZero: boolean = false): Decimal {
    if (qty === undefined || qty === null || String(qty).trim() === '') {
      throw new ValidationError('Quantity is required.');
    }
    const dec = new Decimal(qty);
    if (dec.isNaN()) {
      throw new ValidationError('Quantity must be a valid number.');
    }
    if (allowZero ? dec.lt(0) : dec.lte(0)) {
      throw new ValidationError(allowZero ? 'Quantity cannot be negative.' : 'Quantity must be greater than zero.');
    }
    if (dec.decimalPlaces() > 3) {
      throw new ValidationError('Quantity cannot have more than 3 decimal places.');
    }
    return dec;
  }

  private static validateReason(reason?: string | null, required: boolean = false): string | null {
    if (!reason || reason.trim().length === 0) {
      if (required) {
        throw new ValidationError('A non-empty reason is mandatory for this adjustment.');
      }
      return null;
    }
    const trimmed = reason.trim();
    if (trimmed.length > 500) {
      throw new ValidationError('Reason cannot exceed 500 characters.');
    }
    return trimmed;
  }

  private static async validateActiveItem(inventoryItemId: string, client?: PoolClient) {
    const item = await InventoryRepository.findById(inventoryItemId, client);
    if (!item) {
      throw new NotFoundError(`Inventory item ${inventoryItemId} not found.`);
    }
    if (item.is_archived) {
      throw new ValidationError(`Inventory item "${item.name}" is archived and cannot receive stock movements.`);
    }
    return item;
  }

  private static async recordMovementInternal(
    params: {
      inventoryItemId: string;
      businessDate: string;
      movementType: StockMovementType;
      quantityDelta: Decimal;
      unitCost?: string | null;
      sourceType: string;
      sourceId: string;
      reason?: string | null;
      createdBy?: string | null;
    },
    client: PoolClient
  ): Promise<{ movement: StockMovement; previousBalance: string; resultingBalance: string }> {
    const currentBalance = await StockRepository.lockAndGetBalance(params.inventoryItemId, client);
    const newBalance = currentBalance.plus(params.quantityDelta);

    if (newBalance.lt(0)) {
      throw new InsufficientStockError(
        `Insufficient stock. Available: ${currentBalance.toFixed(3)}, Required reduction: ${params.quantityDelta.abs().toFixed(3)}.`
      );
    }

    const movement = await StockRepository.insertMovement(
      {
        inventoryItemId: params.inventoryItemId,
        businessDate: params.businessDate,
        movementType: params.movementType,
        quantityDelta: params.quantityDelta.toFixed(3),
        unitCost: params.unitCost,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        reason: params.reason,
        createdBy: params.createdBy
      },
      client
    );

    const resultingBalance = await StockRepository.updateBalance(params.inventoryItemId, newBalance, client);

    return {
      movement,
      previousBalance: currentBalance.toFixed(3),
      resultingBalance
    };
  }

  static async recordOpeningStock(
    params: RecordOpeningStockDTO,
    adminId: string,
    requestId?: string
  ): Promise<{ movement: StockMovement; resultingBalance: string }> {
    const positiveQty = this.validateQuantity(params.quantity, false);
    const businessDate = params.businessDate || getTodayDateString();
    const note = this.validateReason(params.note, false);

    // Idempotency check if key provided
    const idempotencyKey = params.idempotencyKey;
    if (idempotencyKey) {
      const cached = await IdempotencyRepository.find(idempotencyKey);
      if (cached) {
        const currentHash = IdempotencyRepository.computeHash(params);
        if (cached.request_hash === currentHash) {
          return cached.response_body;
        }
        throw new IdempotencyError('Idempotency key payload mismatch.');
      }
    }

    const sourceId = params.sourceId && String(params.sourceId).trim().length > 0
      ? String(params.sourceId).trim()
      : 'MANUAL_OPENING';

    const result = await withTransaction(async (client) => {
      await this.validateActiveItem(params.inventoryItemId, client);

      const alreadyHasOpening = await StockRepository.hasOpeningStock(
        params.inventoryItemId,
        businessDate,
        sourceId,
        client
      );
      if (alreadyHasOpening) {
        throw new DuplicateOpeningStockError(
          `Opening stock has already been recorded for inventory item ${params.inventoryItemId} on ${businessDate} for source ${sourceId}.`
        );
      }

      let movementRes: { movement: StockMovement; previousBalance: string; resultingBalance: string };
      try {
        movementRes = await this.recordMovementInternal(
          {
            inventoryItemId: params.inventoryItemId,
            businessDate,
            movementType: 'OPENING',
            quantityDelta: positiveQty,
            sourceType: 'OPENING',
            sourceId,
            reason: note || 'Initial opening balance',
            createdBy: adminId
          },
          client
        );
      } catch (err: any) {
        if (err.code === '23505' && (err.constraint?.includes('opening') || err.message?.includes('opening'))) {
          throw new DuplicateOpeningStockError(
            `Opening stock has already been recorded for inventory item ${params.inventoryItemId} on ${businessDate} for source ${sourceId}.`
          );
        }
        throw err;
      }

      const { movement, previousBalance, resultingBalance } = movementRes;

      await AuditService.logEvent(
        {
          adminId,
          action: 'STOCK_OPENING_RECORDED',
          entityType: 'INVENTORY_ITEM',
          entityId: params.inventoryItemId,
          requestId,
          beforeState: { availableQuantity: previousBalance },
          afterState: { availableQuantity: resultingBalance },
          metadata: {
            movementId: movement.id,
            quantityDelta: movement.quantity_delta,
            businessDate
          }
        },
        client
      );

      const responsePayload = { movement, resultingBalance };

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash(params),
          201,
          responsePayload,
          client
        );
      }

      return responsePayload;
    });

    return result;
  }

  static async recordAdjustment(
    params: RecordAdjustmentDTO,
    adminId: string,
    requestId?: string
  ): Promise<{ movement: StockMovement; resultingBalance: string }> {
    const validTypes = ['MANUAL_INCREASE', 'MANUAL_DECREASE', 'WASTAGE', 'MANUAL_CONSUMPTION'];
    if (!params.type || !validTypes.includes(params.type)) {
      throw new ValidationError(`Invalid adjustment type. Allowed: ${validTypes.join(', ')}`);
    }

    const isDecrease = ['MANUAL_DECREASE', 'WASTAGE', 'MANUAL_CONSUMPTION'].includes(params.type);
    const reason = this.validateReason(params.reason, isDecrease);
    const positiveQty = this.validateQuantity(params.quantity, false);
    const businessDate = params.businessDate || getTodayDateString();

    const idempotencyKey = params.idempotencyKey;
    if (idempotencyKey) {
      const cached = await IdempotencyRepository.find(idempotencyKey);
      if (cached) {
        const currentHash = IdempotencyRepository.computeHash(params);
        if (cached.request_hash === currentHash) {
          return cached.response_body;
        }
        throw new IdempotencyError('Idempotency key payload mismatch.');
      }
    }

    const delta = isDecrease ? positiveQty.negated() : positiveQty;

    const result = await withTransaction(async (client) => {
      await this.validateActiveItem(params.inventoryItemId, client);

      const sourceId = crypto.randomUUID();

      const { movement, previousBalance, resultingBalance } = await this.recordMovementInternal(
        {
          inventoryItemId: params.inventoryItemId,
          businessDate,
          movementType: params.type,
          quantityDelta: delta,
          sourceType: 'MANUAL_ADJUSTMENT',
          sourceId,
          reason,
          createdBy: adminId
        },
        client
      );

      let auditAction = 'STOCK_ADJUSTMENT_RECORDED';
      if (params.type === 'WASTAGE') {
        auditAction = 'STOCK_WASTAGE_RECORDED';
      } else if (params.type === 'MANUAL_CONSUMPTION') {
        auditAction = 'STOCK_CONSUMPTION_RECORDED';
      }

      await AuditService.logEvent(
        {
          adminId,
          action: auditAction,
          entityType: 'INVENTORY_ITEM',
          entityId: params.inventoryItemId,
          requestId,
          beforeState: { availableQuantity: previousBalance },
          afterState: { availableQuantity: resultingBalance },
          metadata: {
            movementId: movement.id,
            movementType: params.type,
            quantityDelta: movement.quantity_delta,
            reason,
            businessDate
          }
        },
        client
      );

      const responsePayload = { movement, resultingBalance };

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash(params),
          201,
          responsePayload,
          client
        );
      }

      return responsePayload;
    });

    return result;
  }

  static async recordStockCount(
    params: RecordStockCountDTO,
    adminId: string,
    requestId?: string
  ): Promise<{ stockCount: any; movementCreated: boolean; movement?: StockMovement; resultingBalance: string }> {
    const actualQty = this.validateQuantity(params.actualQuantity, true);
    const businessDate = params.businessDate || getTodayDateString();
    const reason = this.validateReason(params.reason, false);

    const idempotencyKey = params.idempotencyKey;
    if (idempotencyKey) {
      const cached = await IdempotencyRepository.find(idempotencyKey);
      if (cached) {
        const currentHash = IdempotencyRepository.computeHash(params);
        if (cached.request_hash === currentHash) {
          return cached.response_body;
        }
        throw new IdempotencyError('Idempotency key payload mismatch.');
      }
    }

    const result = await withTransaction(async (client) => {
      await this.validateActiveItem(params.inventoryItemId, client);

      const currentBalance = await StockRepository.lockAndGetBalance(params.inventoryItemId, client);
      const variance = actualQty.minus(currentBalance);

      const stockCount = await StockRepository.insertStockCount(
        {
          inventoryItemId: params.inventoryItemId,
          businessDate,
          expectedQuantity: currentBalance.toFixed(3),
          actualQuantity: actualQty.toFixed(3),
          varianceQuantity: variance.toFixed(3),
          reason,
          countedBy: adminId
        },
        client
      );

      let movement: StockMovement | undefined;
      let finalBalance = currentBalance.toFixed(3);
      let movementCreated = false;

      if (!variance.equals(0)) {
        const movementRes = await this.recordMovementInternal(
          {
            inventoryItemId: params.inventoryItemId,
            businessDate,
            movementType: 'COUNT_CORRECTION',
            quantityDelta: variance,
            sourceType: 'STOCK_COUNT',
            sourceId: stockCount.id,
            reason: reason || `Count variance correction: ${variance.toFixed(3)}`,
            createdBy: adminId
          },
          client
        );
        movement = movementRes.movement;
        finalBalance = movementRes.resultingBalance;
        movementCreated = true;
      }

      await AuditService.logEvent(
        {
          adminId,
          action: 'STOCK_COUNT_RECORDED',
          entityType: 'INVENTORY_ITEM',
          entityId: params.inventoryItemId,
          requestId,
          beforeState: { availableQuantity: currentBalance.toFixed(3) },
          afterState: { availableQuantity: finalBalance },
          metadata: {
            stockCountId: stockCount.id,
            expectedQuantity: currentBalance.toFixed(3),
            actualQuantity: actualQty.toFixed(3),
            varianceQuantity: variance.toFixed(3),
            movementCreated,
            businessDate
          }
        },
        client
      );

      const responsePayload = {
        stockCount,
        movementCreated,
        movement,
        resultingBalance: finalBalance
      };

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash(params),
          201,
          responsePayload,
          client
        );
      }

      return responsePayload;
    });

    return result;
  }

  // --- MODULE 3 INTEGRATION METHODS (ACCEPTING PoolClient) ---

  static async recordPurchaseReceipt(
    input: RecordPurchaseReceiptInput,
    client: PoolClient
  ): Promise<StockMovementResult> {
    const positiveQty = this.validateQuantity(input.quantity, false);
    const unitCost = input.unitCost !== undefined && input.unitCost !== null
      ? new Decimal(input.unitCost).toFixed(2)
      : null;

    await this.validateActiveItem(input.inventoryItemId, client);

    const exists = await StockRepository.hasMachineMovement('PURCHASE_RECEIPT', input.purchaseLineId, client);
    if (exists) {
      throw new DuplicateMovementError(
        `Purchase receipt movement for line ${input.purchaseLineId} has already been recorded.`
      );
    }

    const { movement, resultingBalance } = await this.recordMovementInternal(
      {
        inventoryItemId: input.inventoryItemId,
        businessDate: input.businessDate,
        movementType: 'PURCHASE_RECEIPT',
        quantityDelta: positiveQty,
        unitCost,
        sourceType: 'PURCHASE_RECEIPT',
        sourceId: input.purchaseLineId,
        reason: `Purchase Receipt: ${input.purchaseNumber}`,
        createdBy: input.adminId
      },
      client
    );

    return {
      movementId: movement.id,
      inventoryItemId: input.inventoryItemId,
      quantityDelta: movement.quantity_delta,
      resultingBalance
    };
  }

  static async recordPurchaseReversal(
    input: RecordPurchaseReversalInput,
    client: PoolClient
  ): Promise<StockMovementResult> {
    const positiveQty = this.validateQuantity(input.quantity, false);
    const reason = this.validateReason(input.reason, true);

    const item = await InventoryRepository.findById(input.inventoryItemId, client);
    if (!item) {
      throw new NotFoundError(`Inventory item ${input.inventoryItemId} not found.`);
    }

    const exists = await StockRepository.hasMachineMovement('PURCHASE_REVERSAL', input.purchaseLineId, client);
    if (exists) {
      throw new DuplicateMovementError(
        `Purchase reversal movement for line ${input.purchaseLineId} has already been recorded.`
      );
    }

    const { movement, resultingBalance } = await this.recordMovementInternal(
      {
        inventoryItemId: input.inventoryItemId,
        businessDate: input.businessDate,
        movementType: 'PURCHASE_REVERSAL',
        quantityDelta: positiveQty.negated(),
        sourceType: 'PURCHASE_REVERSAL',
        sourceId: input.purchaseLineId,
        reason: `Purchase Reversal (${input.purchaseNumber}): ${reason}`,
        createdBy: input.adminId
      },
      client
    );

    return {
      movementId: movement.id,
      inventoryItemId: input.inventoryItemId,
      quantityDelta: movement.quantity_delta,
      resultingBalance
    };
  }

  // --- QUERY APIS ---

  static async getItemStock(inventoryItemId: string): Promise<ItemStockSummary> {
    const item = await InventoryRepository.findById(inventoryItemId);
    if (!item) {
      throw new NotFoundError(`Inventory item ${inventoryItemId} not found.`);
    }

    const balance = await StockRepository.getBalance(inventoryItemId);
    const availableQuantity = balance ? balance.available_quantity : '0.000';
    const minStock = String(item.minimum_stock || '0.000');
    const isLowStock = new Decimal(availableQuantity).lte(new Decimal(minStock));

    return {
      inventoryItemId: item.id,
      name: item.name,
      baseUnit: item.base_unit,
      availableQuantity: String(availableQuantity),
      minimumStock: minStock,
      isLowStock,
      lastMovementAt: balance ? balance.last_movement_at : null
    };
  }

  static async listMovements(params: StockMovementListParams): Promise<StockMovementListResult> {
    return StockRepository.listMovements(params);
  }
}
