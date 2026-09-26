import crypto from 'crypto';
import { PoolClient } from 'pg';
import { withTransaction } from '@/shared/database/client';
import { StorageService, detectMimeType } from '@/shared/storage/storage.service';
import { PurchaseRepository, PurchaseListFilters, PurchaseListResult } from './purchases.repository';
import {
  Purchase,
  CreatePurchaseDraftInput,
  UpdatePurchaseDraftInput,
  PurchaseLineInput
} from './purchases.types';
import { calculatePurchaseTotals, CalculatedPurchaseLine } from './purchases.math';
import { SupplierRepository } from '../supplier/supplier.repository';
import { InventoryRepository } from '../inventory/inventory.repository';
import { StockLedgerService } from '../stock/stock.service';
import { AuditService } from '../audit/audit.service';
import { IdempotencyRepository } from '../audit/idempotency.repository';
import {
  ValidationError,
  NotFoundError,
  SupplierInactiveError,
  InventoryItemArchivedError,
  PurchaseNotEditableError,
  PurchaseAlreadyReceivedError,
  PurchaseNotReceivableError,
  PurchaseNotReversibleError,
  PurchaseAlreadyReversedError,
  IdempotencyError
} from '@/shared/errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PurchaseService {
  /**
   * Helper to validate and resolve supplier/ad-hoc supplier name
   */
  private static async resolveSupplierInfo(
    supplierId: string | null | undefined,
    adhocSupplierName: string | null | undefined,
    client?: PoolClient
  ): Promise<{ supplierId: string | null; supplierName: string }> {
    if (supplierId) {
      const supplier = await SupplierRepository.findById(supplierId, client);
      if (!supplier) {
        throw new NotFoundError('Supplier not found.');
      }
      if (supplier.is_archived) {
        throw new SupplierInactiveError('Supplier is inactive or archived.');
      }
      return {
        supplierId: supplier.id,
        supplierName: supplier.name
      };
    }

    const trimmedAdhoc = (adhocSupplierName || '').trim();
    if (!trimmedAdhoc) {
      throw new ValidationError('Either a valid supplierId or adhocSupplierName is required.');
    }

    return {
      supplierId: null,
      supplierName: trimmedAdhoc
    };
  }

  /**
   * Helper to validate inventory items and fetch authoritative server snapshots
   */
  private static async resolveLineSnapshots(
    lines: CalculatedPurchaseLine[],
    client?: PoolClient
  ): Promise<Array<{
    inventoryItemId: string;
    itemName: string;
    unit: string;
    quantity: string;
    unitRate: string;
    lineDiscount: string;
    taxRate: string;
    lineTotal: string;
  }>> {
    const resolvedLines = [];

    for (const line of lines) {
      const item = await InventoryRepository.findById(line.inventoryItemId, client);
      if (!item) {
        throw new NotFoundError(`Inventory item not found: ${line.inventoryItemId}`);
      }
      if (item.is_archived) {
        throw new InventoryItemArchivedError(`Inventory item '${item.name}' is archived.`);
      }

      resolvedLines.push({
        inventoryItemId: item.id,
        itemName: item.name,
        unit: item.base_unit,
        quantity: line.quantity,
        unitRate: line.unitRate,
        lineDiscount: line.lineDiscount,
        taxRate: line.taxRate,
        lineTotal: line.lineTotal
      });
    }

    return resolvedLines;
  }

  /**
   * Create Purchase Draft
   */
  static async createDraft(
    input: CreatePurchaseDraftInput,
    adminId: string,
    requestId?: string
  ): Promise<Purchase> {
    if (!input.purchaseDate) {
      throw new ValidationError('Purchase date is required.');
    }
    if (!input.paymentMethod || !['CASH', 'UPI', 'CARD', 'CREDIT'].includes(input.paymentMethod)) {
      throw new ValidationError('Valid payment method is required.');
    }
    if (!input.lines || input.lines.length === 0) {
      throw new ValidationError('Purchase draft must contain at least one line.');
    }

    // 1. Calculate totals server-side
    const calculated = calculatePurchaseTotals(
      input.lines,
      input.discount ?? 0,
      input.taxAmount ?? 0
    );

    return withTransaction(async (client) => {
      // 2. Validate supplier
      const { supplierId, supplierName } = await this.resolveSupplierInfo(
        input.supplierId,
        input.adhocSupplierName,
        client
      );

      // 3. Resolve inventory item snapshots
      const preparedLines = await this.resolveLineSnapshots(calculated.lines, client);

      // 4. Generate next purchase number
      const purchaseNumber = await PurchaseRepository.generateNextPurchaseNumber(
        input.purchaseDate,
        client
      );

      // 5. Create header
      const purchase = await PurchaseRepository.createPurchase(
        {
          purchaseNumber,
          supplierId,
          supplierName,
          invoiceNumber: input.invoiceNumber,
          purchaseDate: input.purchaseDate,
          paymentMethod: input.paymentMethod,
          discount: calculated.discount,
          taxAmount: calculated.taxAmount,
          grandTotal: calculated.grandTotal,
          note: input.note,
          createdBy: adminId
        },
        client
      );

      // 6. Create detail lines
      const createdLines = await PurchaseRepository.createPurchaseLines(
        purchase.id,
        preparedLines,
        client
      );

      const result: Purchase = {
        ...purchase,
        lines: createdLines
      };

      // 7. Audit log
      await AuditService.logEvent(
        {
          adminId,
          action: 'PURCHASE_DRAFT_CREATED',
          entityType: 'PURCHASE',
          entityId: purchase.id,
          requestId,
          afterState: {
            purchaseNumber,
            supplierName,
            grandTotal: calculated.grandTotal,
            lineCount: createdLines.length
          }
        },
        client
      );

      return result;
    });
  }

  /**
   * Update Purchase Draft
   */
  static async updateDraft(
    id: string,
    input: UpdatePurchaseDraftInput,
    adminId: string,
    requestId?: string
  ): Promise<Purchase> {
    return withTransaction(async (client) => {
      // 1. Lock purchase row
      const existing = await PurchaseRepository.findByIdForUpdate(id, client);
      if (!existing) {
        throw new NotFoundError('Purchase not found.');
      }
      if (existing.status !== 'DRAFT') {
        throw new PurchaseNotEditableError('Only draft purchases can be edited.');
      }

      const purchaseDate = input.purchaseDate || existing.purchase_date;
      const paymentMethod = input.paymentMethod || existing.payment_method;

      // 2. Resolve supplier
      let supplierId = existing.supplier_id;
      let supplierName = existing.supplier_name;
      if (input.supplierId !== undefined || input.adhocSupplierName !== undefined) {
        const resolved = await this.resolveSupplierInfo(
          input.supplierId,
          input.adhocSupplierName,
          client
        );
        supplierId = resolved.supplierId;
        supplierName = resolved.supplierName;
      }

      // 3. Resolve lines and totals
      let linesToCalculate: PurchaseLineInput[] = [];
      if (input.lines && input.lines.length > 0) {
        linesToCalculate = input.lines;
      } else {
        const currentLines = await PurchaseRepository.findLinesByPurchaseId(id, client);
        linesToCalculate = currentLines.map((l) => ({
          inventoryItemId: l.inventory_item_id,
          quantity: l.quantity,
          unitRate: l.unit_rate,
          lineDiscount: l.line_discount,
          taxRate: l.tax_rate
        }));
      }

      if (linesToCalculate.length === 0) {
        throw new ValidationError('Purchase must contain at least one line.');
      }

      const discount = input.discount !== undefined ? input.discount : existing.discount;
      const taxAmount = input.taxAmount !== undefined ? input.taxAmount : existing.tax_amount;

      const calculated = calculatePurchaseTotals(linesToCalculate, discount, taxAmount);
      const preparedLines = await this.resolveLineSnapshots(calculated.lines, client);

      // 4. Update header
      const updated = await PurchaseRepository.updatePurchaseDraft(
        id,
        {
          supplierId,
          supplierName,
          invoiceNumber: input.invoiceNumber !== undefined ? input.invoiceNumber : existing.invoice_number,
          purchaseDate,
          paymentMethod,
          discount: calculated.discount,
          taxAmount: calculated.taxAmount,
          grandTotal: calculated.grandTotal,
          note: input.note !== undefined ? input.note : existing.note
        },
        client
      );

      // 5. Replace lines
      await PurchaseRepository.deleteLinesByPurchaseId(id, client);
      const createdLines = await PurchaseRepository.createPurchaseLines(id, preparedLines, client);

      const result: Purchase = {
        ...updated,
        lines: createdLines
      };

      // 6. Audit
      await AuditService.logEvent(
        {
          adminId,
          action: 'PURCHASE_DRAFT_UPDATED',
          entityType: 'PURCHASE',
          entityId: id,
          requestId,
          beforeState: {
            grandTotal: existing.grand_total,
            status: existing.status
          },
          afterState: {
            grandTotal: calculated.grandTotal,
            lineCount: createdLines.length
          }
        },
        client
      );

      return result;
    });
  }

  /**
   * Receive Purchase (Atomic, Idempotent, Module 4 Integration)
   */
  static async receivePurchase(
    id: string,
    adminId: string,
    idempotencyKey?: string,
    requestId?: string
  ): Promise<Purchase> {
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency-Key is required to receive a purchase.');
    }

    // Check idempotency cache first
    const requestPayload = { action: 'RECEIVE_PURCHASE', purchaseId: id };
    const requestHash = IdempotencyRepository.computeHash(requestPayload);
    const cached = await IdempotencyRepository.find(idempotencyKey);
    if (cached) {
      if (cached.request_hash === requestHash) {
        return cached.response_body;
      }
      throw new IdempotencyError('Idempotency key payload mismatch.');
    }

    return withTransaction(async (client) => {
      // 1. Lock purchase row
      const purchase = await PurchaseRepository.findByIdForUpdate(id, client);
      if (!purchase) {
        throw new NotFoundError('Purchase not found.');
      }

      // 2. Status verification
      if (purchase.status === 'RECEIVED') {
        throw new PurchaseAlreadyReceivedError('Purchase has already been received.');
      }
      if (purchase.status !== 'DRAFT') {
        throw new PurchaseNotReceivableError(`Purchase cannot be received in status: ${purchase.status}`);
      }

      // 3. Load lines and sort deterministically by inventory_item_id ASC
      const lines = await PurchaseRepository.findLinesByPurchaseId(id, client);
      if (lines.length === 0) {
        throw new ValidationError('Cannot receive a purchase with no lines.');
      }
      lines.sort((a, b) => a.inventory_item_id.localeCompare(b.inventory_item_id));

      // 4. For every line, call Module 4 recordPurchaseReceipt with the SAME PoolClient
      for (const line of lines) {
        await StockLedgerService.recordPurchaseReceipt(
          {
            purchaseId: purchase.id,
            purchaseNumber: purchase.purchase_number,
            purchaseLineId: line.id,
            inventoryItemId: line.inventory_item_id,
            quantity: line.quantity,
            unitCost: line.unit_rate,
            adminId,
            businessDate: purchase.purchase_date
          },
          client
        );
      }

      // 5. Update purchase status
      const updatedPurchase = await PurchaseRepository.markReceived(id, client);
      const result: Purchase = {
        ...updatedPurchase,
        lines
      };

      // 6. Audit
      await AuditService.logEvent(
        {
          adminId,
          action: 'PURCHASE_RECEIVED',
          entityType: 'PURCHASE',
          entityId: id,
          requestId,
          afterState: {
            status: 'RECEIVED',
            receivedAt: updatedPurchase.received_at,
            lineCount: lines.length
          }
        },
        client
      );

      // 7. Save idempotency record inside the same transaction
      await IdempotencyRepository.save(
        idempotencyKey,
        requestHash,
        200,
        result,
        client
      );

      return result;
    });
  }

  /**
   * Reverse Purchase (Atomic, Idempotent, Module 4 Integration)
   */
  static async reversePurchase(
    id: string,
    reason: string,
    adminId: string,
    idempotencyKey?: string,
    requestId?: string
  ): Promise<Purchase> {
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency-Key is required to reverse a purchase.');
    }

    const trimmedReason = (reason || '').trim();
    if (trimmedReason.length < 5) {
      throw new ValidationError('Reversal reason must be at least 5 characters.');
    }

    // Check idempotency cache
    const requestPayload = { action: 'REVERSE_PURCHASE', purchaseId: id, reason: trimmedReason };
    const requestHash = IdempotencyRepository.computeHash(requestPayload);
    const cached = await IdempotencyRepository.find(idempotencyKey);
    if (cached) {
      if (cached.request_hash === requestHash) {
        return cached.response_body;
      }
      throw new IdempotencyError('Idempotency key payload mismatch.');
    }

    return withTransaction(async (client) => {
      // 1. Lock purchase row
      const purchase = await PurchaseRepository.findByIdForUpdate(id, client);
      if (!purchase) {
        throw new NotFoundError('Purchase not found.');
      }

      // 2. Status verification
      if (purchase.status === 'REVERSED') {
        throw new PurchaseAlreadyReversedError('Purchase has already been reversed.');
      }
      if (purchase.status !== 'RECEIVED') {
        throw new PurchaseNotReversibleError('Only received purchases can be reversed.');
      }

      // 3. Load lines and sort deterministically
      const lines = await PurchaseRepository.findLinesByPurchaseId(id, client);
      lines.sort((a, b) => a.inventory_item_id.localeCompare(b.inventory_item_id));

      // 4. For every line, call Module 4 recordPurchaseReversal with the SAME PoolClient
      for (const line of lines) {
        await StockLedgerService.recordPurchaseReversal(
          {
            purchaseId: purchase.id,
            purchaseNumber: purchase.purchase_number,
            purchaseLineId: line.id,
            inventoryItemId: line.inventory_item_id,
            quantity: line.quantity,
            reason: trimmedReason,
            adminId,
            businessDate: purchase.purchase_date
          },
          client
        );
      }

      // 5. Create reversal record and update status
      const reversal = await PurchaseRepository.createReversal(
        {
          purchaseId: id,
          reason: trimmedReason,
          reversedBy: adminId
        },
        client
      );

      const updatedPurchase = await PurchaseRepository.findById(id, client);
      const result: Purchase = {
        ...updatedPurchase!,
        lines,
        reversal
      };

      // 6. Audit
      await AuditService.logEvent(
        {
          adminId,
          action: 'PURCHASE_REVERSED',
          entityType: 'PURCHASE',
          entityId: id,
          requestId,
          afterState: {
            status: 'REVERSED',
            reason: trimmedReason,
            reversedAt: reversal.reversed_at
          }
        },
        client
      );

      // 7. Save idempotency record
      await IdempotencyRepository.save(
        idempotencyKey,
        requestHash,
        200,
        result,
        client
      );

      return result;
    });
  }

  /**
   * Get purchase by ID with lines and reversal information
   */
  static async getById(id: string): Promise<Purchase> {
    const purchase = await PurchaseRepository.findByIdWithDetails(id);
    if (!purchase) {
      throw new NotFoundError('Purchase not found.');
    }
    return purchase;
  }

  /**
   * List purchases with filtering and pagination
   */
  static async listPurchases(filters: PurchaseListFilters): Promise<PurchaseListResult> {
    return PurchaseRepository.listPurchases(filters);
  }

  /**
   * Upload and attach invoice proof to a purchase
   */
  static async uploadAttachment(
    params: {
      purchaseId: string;
      fileName: string;
      buffer: Buffer;
      fileSize: number;
      clientMime?: string;
    },
    adminId: string,
    requestId?: string
  ): Promise<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    createdAt: string;
  }> {
    const { purchaseId, fileName, buffer, fileSize } = params;

    if (!purchaseId || !UUID_REGEX.test(purchaseId)) {
      throw new ValidationError('Invalid purchase ID format. Expected UUID.');
    }

    if (!buffer || buffer.length === 0) {
      throw new ValidationError('File content is empty or missing.');
    }

    if (fileSize > 5 * 1024 * 1024) {
      throw new ValidationError('File size exceeds the 5 MB limit.');
    }

    // Verify magic bytes / signature
    const detectedMime = detectMimeType(buffer);
    if (!detectedMime) {
      throw new ValidationError('Invalid file type. Only JPEG, PNG, and PDF files are allowed.');
    }

    // If client supplied a mime type, verify it matches allowed types
    if (params.clientMime) {
      const normalizedClientMime = params.clientMime.toLowerCase();
      const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!validMimes.includes(normalizedClientMime)) {
        throw new ValidationError('Invalid file type. Only JPEG, PNG, and PDF files are allowed.');
      }
    }

    // Verify purchase exists before saving file
    const existingPurchase = await PurchaseRepository.findById(purchaseId);
    if (!existingPurchase) {
      throw new NotFoundError('Purchase not found.');
    }

    // Generate unique storage key
    const ext = detectedMime === 'image/jpeg' ? 'jpg' : detectedMime === 'image/png' ? 'png' : 'pdf';
    const storageKey = `purchases/${purchaseId}/${crypto.randomUUID()}.${ext}`;

    // 1. Write file to private storage
    await StorageService.saveFile(storageKey, buffer, detectedMime);

    try {
      // 2. Transactionally record metadata and link to purchase
      const attachment = await withTransaction(async (client) => {
        const att = await PurchaseRepository.createAttachment(
          {
            storageKey,
            fileName: fileName.trim() || `invoice.${ext}`,
            mimeType: detectedMime,
            fileSize,
            uploadedBy: adminId
          },
          client
        );

        await PurchaseRepository.updateAttachmentId(purchaseId, att.id, client);
        return att;
      });

      // 3. Log audit event
      await AuditService.logEvent({
        adminId,
        action: 'PURCHASE_ATTACHMENT_UPLOADED',
        entityType: 'PURCHASE',
        entityId: purchaseId,
        requestId,
        afterState: {
          purchaseId,
          attachmentId: attachment.id,
          fileName: attachment.file_name,
          mimeType: attachment.mime_type,
          fileSize: attachment.file_size
        }
      });

      return {
        id: attachment.id,
        fileName: attachment.file_name,
        mimeType: attachment.mime_type,
        fileSize: attachment.file_size,
        createdAt: String(attachment.created_at)
      };
    } catch (dbErr) {
      // Clean up orphaned file on storage if DB transaction fails
      await StorageService.deleteFile(storageKey).catch(() => {});
      throw dbErr;
    }
  }

  /**
   * Retrieve authorized attachment for a purchase
   */
  static async getAttachment(
    purchaseId: string
  ): Promise<{
    buffer: Buffer;
    metadata: {
      id: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
    };
  }> {
    if (!purchaseId || !UUID_REGEX.test(purchaseId)) {
      throw new ValidationError('Invalid purchase ID format. Expected UUID.');
    }

    const purchase = await PurchaseRepository.findById(purchaseId);
    if (!purchase) {
      throw new NotFoundError('Purchase not found.');
    }

    if (!purchase.attachment_id) {
      throw new NotFoundError('Purchase does not have an attachment.');
    }

    const attachment = await PurchaseRepository.findAttachmentById(purchase.attachment_id);
    if (!attachment) {
      throw new NotFoundError('Attachment record not found.');
    }

    const buffer = await StorageService.getFile(attachment.storage_key);
    if (!buffer) {
      throw new NotFoundError('Attachment file not found in storage.');
    }

    return {
      buffer,
      metadata: {
        id: attachment.id,
        fileName: attachment.file_name,
        mimeType: attachment.mime_type,
        fileSize: attachment.file_size
      }
    };
  }
}

