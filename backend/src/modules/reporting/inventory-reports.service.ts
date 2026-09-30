import { InventoryReportsRepository } from './inventory-reports.repository';
import { ValidationError, ReportTooLargeError } from '@/shared/errors';
import { getTodayDateString } from '@/shared/time';
import Decimal from 'decimal.js';

export function validateDateRange(from: string | undefined, to: string | undefined) {
  if (!from || !to) {
    throw new ValidationError('Start date (from) and end date (to) are required.');
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(from) || !dateRegex.test(to)) {
    throw new ValidationError('Dates must be in valid YYYY-MM-DD format.');
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new ValidationError('Invalid date values provided.');
  }

  if (from > to) {
    throw new ValidationError('Start date (from) cannot be after end date (to).');
  }

  const diffMs = toDate.getTime() - fromDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 366) {
    throw new ReportTooLargeError('Requested report date range exceeds maximum allowed range (366 days).');
  }
}

export function normalizeReportFormat(format: string | null | undefined): 'XLSX' | 'PDF' {
  if (!format) {
    throw new ValidationError('Report format is required (XLSX or PDF).');
  }
  const upper = format.trim().toUpperCase();
  if (upper !== 'XLSX' && upper !== 'PDF') {
    throw new ValidationError('Invalid format. Supported formats are XLSX and PDF.');
  }
  return upper;
}

export class InventoryReportsService {
  static async getInventoryStockReport(asOf?: string) {
    const asOfDate = asOf || getTodayDateString();
    const rows = await InventoryReportsRepository.getInventoryStockSnapshot(asOfDate);

    let totalValuation = new Decimal(0);
    let lowStockCount = 0;

    const items = rows.map((r: any) => {
      const currentQty = new Decimal(r.current_quantity || 0);
      const minQty = new Decimal(r.minimum_stock || 0);
      const isLowStock = currentQty.lessThanOrEqualTo(minQty);
      if (isLowStock) lowStockCount++;

      const unitCost = r.latest_unit_cost !== null && r.latest_unit_cost !== undefined ? String(r.latest_unit_cost) : null;
      let totalValue: string | null = null;

      if (unitCost !== null) {
        const itemVal = currentQty.times(new Decimal(unitCost));
        totalValuation = totalValuation.plus(itemVal);
        totalValue = itemVal.toFixed(2);
      }

      return {
        itemId: r.id,
        itemName: r.name,
        itemType: r.item_type,
        baseUnit: r.base_unit,
        currentQuantity: currentQty.toFixed(3),
        minimumStock: minQty.toFixed(3),
        status: isLowStock ? 'LOW_STOCK' : 'OK',
        latestUnitCost: unitCost,
        totalValue,
        lastMovementAt: r.last_movement_at
      };
    });

    return {
      reportType: 'INVENTORY_STOCK',
      asOfDate,
      summary: {
        totalItems: items.length,
        lowStockItemsCount: lowStockCount,
        totalValuation: totalValuation.toFixed(2)
      },
      dataQualityNote: 'Valuation reflects the latest received purchase unit rate for items with purchase history.',
      items
    };
  }

  static async getStockMovementsReport(filters: {
    from: string;
    to: string;
    itemId?: string;
    movementType?: string;
  }) {
    validateDateRange(filters.from, filters.to);

    const rows = await InventoryReportsRepository.getStockMovements(filters);

    let totalInbound = new Decimal(0);
    let totalOutbound = new Decimal(0);

    const movements = rows.map((r: any) => {
      const delta = new Decimal(r.quantity_delta || 0);
      if (delta.greaterThan(0)) {
        totalInbound = totalInbound.plus(delta);
      } else {
        totalOutbound = totalOutbound.plus(delta.abs());
      }

      return {
        id: r.id,
        inventoryItemId: r.inventory_item_id,
        itemName: r.item_name,
        baseUnit: r.base_unit,
        businessDate: typeof r.business_date === 'string' ? r.business_date.substring(0, 10) : new Date(r.business_date).toISOString().substring(0, 10),
        movementType: r.movement_type,
        quantityDelta: delta.toFixed(3),
        unitCost: r.unit_cost !== null && r.unit_cost !== undefined ? String(r.unit_cost) : null,
        sourceType: r.source_type,
        sourceId: r.source_id,
        reason: r.reason || null,
        createdByName: r.created_by_name || null,
        createdAt: r.created_at
      };
    });

    return {
      reportType: 'STOCK_MOVEMENTS',
      dateRange: { from: filters.from, to: filters.to },
      appliedFilters: {
        itemId: filters.itemId || null,
        movementType: filters.movementType || null
      },
      summary: {
        totalMovements: movements.length,
        totalInboundQuantity: totalInbound.toFixed(3),
        totalOutboundQuantity: totalOutbound.toFixed(3),
        netChangeQuantity: totalInbound.minus(totalOutbound).toFixed(3)
      },
      dataQualityNote: 'Stock movements are sourced from the immutable audit ledger.',
      movements
    };
  }

  static async getPurchasesReport(filters: {
    from: string;
    to: string;
    supplierId?: string;
    itemId?: string;
    paymentMethod?: string;
    status?: string;
  }) {
    validateDateRange(filters.from, filters.to);

    const rows = await InventoryReportsRepository.getPurchasesReport(filters);

    let receivedCount = 0;
    let receivedTotal = new Decimal(0);
    let draftCount = 0;
    let draftTotal = new Decimal(0);
    let reversedCount = 0;
    let reversedTotal = new Decimal(0);

    const splits = {
      CASH: new Decimal(0),
      UPI: new Decimal(0),
      CARD: new Decimal(0),
      CREDIT: new Decimal(0)
    };

    const purchases = rows.map((r: any) => {
      const grandTotal = new Decimal(r.grand_total || 0);

      if (r.status === 'RECEIVED') {
        receivedCount++;
        receivedTotal = receivedTotal.plus(grandTotal);
        if (r.payment_method in splits) {
          splits[r.payment_method as keyof typeof splits] = splits[r.payment_method as keyof typeof splits].plus(grandTotal);
        }
      } else if (r.status === 'DRAFT') {
        draftCount++;
        draftTotal = draftTotal.plus(grandTotal);
      } else if (r.status === 'REVERSED') {
        reversedCount++;
        reversedTotal = reversedTotal.plus(grandTotal);
      }

      return {
        id: r.id,
        purchaseNumber: r.purchase_number,
        purchaseDate: typeof r.purchase_date === 'string' ? r.purchase_date.substring(0, 10) : new Date(r.purchase_date).toISOString().substring(0, 10),
        supplierId: r.supplier_id || null,
        supplierName: r.supplier_name,
        invoiceNumber: r.invoice_number || null,
        paymentMethod: r.payment_method,
        discount: String(r.discount),
        taxAmount: String(r.tax_amount),
        grandTotal: grandTotal.toFixed(2),
        status: r.status,
        receivedAt: r.received_at,
        createdAt: r.created_at
      };
    });

    return {
      reportType: 'PURCHASES',
      dateRange: { from: filters.from, to: filters.to },
      appliedFilters: {
        supplierId: filters.supplierId || null,
        itemId: filters.itemId || null,
        paymentMethod: filters.paymentMethod || null,
        status: filters.status || null
      },
      summary: {
        totalPurchases: purchases.length,
        receivedPurchasesCount: receivedCount,
        receivedPurchasesTotal: receivedTotal.toFixed(2),
        draftPurchasesCount: draftCount,
        draftPurchasesTotal: draftTotal.toFixed(2),
        reversedPurchasesCount: reversedCount,
        reversedPurchasesTotal: reversedTotal.toFixed(2),
        receivedPaymentSplits: {
          CASH: splits.CASH.toFixed(2),
          UPI: splits.UPI.toFixed(2),
          CARD: splits.CARD.toFixed(2),
          CREDIT: splits.CREDIT.toFixed(2)
        }
      },
      dataQualityNote: 'Financial purchase totals include ONLY received and non-reversed purchase orders.',
      purchases
    };
  }

  static async getSuppliersReport(filters: { from: string; to: string }) {
    validateDateRange(filters.from, filters.to);

    const rows = await InventoryReportsRepository.getSuppliersReport(filters);

    let totalSpend = new Decimal(0);
    let totalDraftSpend = new Decimal(0);
    let totalReversedSpend = new Decimal(0);

    const suppliers = rows.map((r: any) => {
      const recTotal = new Decimal(r.received_total || 0);
      const drTotal = new Decimal(r.draft_total || 0);
      const revTotal = new Decimal(r.reversed_total || 0);

      totalSpend = totalSpend.plus(recTotal);
      totalDraftSpend = totalDraftSpend.plus(drTotal);
      totalReversedSpend = totalReversedSpend.plus(revTotal);

      return {
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        contactPerson: r.contact_person || null,
        phone: r.phone || null,
        email: r.email || null,
        isArchived: r.is_archived,
        totalOrders: parseInt(r.total_orders, 10) || 0,
        receivedOrders: parseInt(r.received_orders, 10) || 0,
        receivedTotal: recTotal.toFixed(2),
        draftOrders: parseInt(r.draft_orders, 10) || 0,
        draftTotal: drTotal.toFixed(2),
        reversedOrders: parseInt(r.reversed_orders, 10) || 0,
        reversedTotal: revTotal.toFixed(2),
        lastPurchaseDate: r.last_purchase_date ? (typeof r.last_purchase_date === 'string' ? r.last_purchase_date.substring(0, 10) : new Date(r.last_purchase_date).toISOString().substring(0, 10)) : null
      };
    });

    return {
      reportType: 'SUPPLIERS',
      dateRange: { from: filters.from, to: filters.to },
      summary: {
        totalSuppliers: suppliers.length,
        totalSpend: totalSpend.toFixed(2),
        totalDraftSpend: totalDraftSpend.toFixed(2),
        totalReversedSpend: totalReversedSpend.toFixed(2)
      },
      dataQualityNote: 'Supplier spend aggregates received purchase orders within the selected date range.',
      suppliers
    };
  }

  static async getWastageReport(filters: { from: string; to: string }) {
    validateDateRange(filters.from, filters.to);

    const rows = await InventoryReportsRepository.getWastageMovements(filters);

    let totalQuantity = new Decimal(0);
    let totalRecordedLoss = new Decimal(0);
    let uncostedCount = 0;
    let wastageTypeCount = 0;
    let manualDecreaseTypeCount = 0;
    let countCorrectionTypeCount = 0;

    const wastageItems = rows.map((r: any) => {
      const qty = new Decimal(r.quantity_wasted || 0);
      totalQuantity = totalQuantity.plus(qty);

      if (r.movement_type === 'WASTAGE') wastageTypeCount++;
      else if (r.movement_type === 'MANUAL_DECREASE') manualDecreaseTypeCount++;
      else if (r.movement_type === 'COUNT_CORRECTION') countCorrectionTypeCount++;

      const unitCost = r.unit_cost !== null && r.unit_cost !== undefined ? String(r.unit_cost) : null;
      let recordedLossAmount: string | null = null;

      if (unitCost !== null) {
        const loss = qty.times(new Decimal(unitCost));
        totalRecordedLoss = totalRecordedLoss.plus(loss);
        recordedLossAmount = loss.toFixed(2);
      } else {
        uncostedCount++;
      }

      return {
        id: r.id,
        inventoryItemId: r.inventory_item_id,
        itemName: r.item_name,
        baseUnit: r.base_unit,
        businessDate: typeof r.business_date === 'string' ? r.business_date.substring(0, 10) : new Date(r.business_date).toISOString().substring(0, 10),
        movementType: r.movement_type,
        quantityWasted: qty.toFixed(3),
        unitCost,
        recordedLossAmount,
        sourceType: r.source_type,
        sourceId: r.source_id,
        reason: r.reason || null,
        createdByName: r.created_by_name || null,
        createdAt: r.created_at
      };
    });

    return {
      reportType: 'WASTAGE',
      dateRange: { from: filters.from, to: filters.to },
      summary: {
        totalWastageRecords: wastageItems.length,
        totalWastedQuantity: totalQuantity.toFixed(3),
        totalRecordedFinancialLoss: totalRecordedLoss.toFixed(2),
        uncostedMovementsCount: uncostedCount,
        breakdownByType: {
          WASTAGE: wastageTypeCount,
          MANUAL_DECREASE: manualDecreaseTypeCount,
          COUNT_CORRECTION: countCorrectionTypeCount
        }
      },
      dataQualityNote: 'Monetary loss reflects explicitly recorded unit costs at movement time. Uncosted movements are reported by quantity without synthetic rate fabrication.',
      wastageItems
    };
  }
}
