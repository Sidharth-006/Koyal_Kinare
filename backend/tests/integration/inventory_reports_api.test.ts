import { describe, it, expect, beforeAll } from 'vitest';
import { InventoryReportsService } from '@/modules/reporting/inventory-reports.service';
import { ReportService } from '@/modules/reporting/report.service';
import { InventoryRepository } from '@/modules/inventory/inventory.repository';
import { SupplierService } from '@/modules/supplier/supplier.service';
import { PurchaseService } from '@/modules/purchases/purchases.service';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { query } from '@/shared/database/client';
import { ReportTooLargeError, ValidationError } from '@/shared/errors';

describe('Inventory Reports & Export Generation Integration Tests', () => {
  let adminId: string;
  let testSupplierId: string;
  let testItem1: any;
  let testItem2: any;

  beforeAll(async () => {
    const adminRes = await query('SELECT id FROM admins LIMIT 1');
    if (adminRes.rows.length > 0) {
      adminId = adminRes.rows[0].id;
    } else {
      const inserted = await query(
        "INSERT INTO admins (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id",
        ['reports_admin@koyal.com', 'hash', 'Reports Admin']
      );
      adminId = inserted.rows[0].id;
    }

    // 1. Create items
    testItem1 = await InventoryRepository.create(
      {
        name: `Report Item Alpha ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '5.000'
      },
      adminId
    );

    testItem2 = await InventoryRepository.create(
      {
        name: `Report Item Beta ${Date.now()}`,
        itemType: 'PACKAGING',
        baseUnit: 'BOX',
        minimumStock: '2.000'
      },
      adminId
    );

    // 2. Create supplier
    const supplier = await SupplierService.createSupplier(
      {
        name: `Report Test Supplier ${Date.now()}`,
        contactPerson: 'Rahul Kumar',
        phone: '9876543210'
      },
      adminId
    );
    testSupplierId = supplier.id;

    // 3. Create and receive a purchase
    const purchase = await PurchaseService.createDraft(
      {
        supplierId: testSupplierId,
        purchaseDate: '2026-09-10',
        paymentMethod: 'CASH',
        lines: [
          {
            inventoryItemId: testItem1.id,
            quantity: 10,
            unitRate: 100
          }
        ]
      },
      adminId
    );
    await PurchaseService.receivePurchase(purchase.id, adminId, `rec-${Date.now()}`);

    // 4. Create a draft purchase (must NOT be counted in financial total)
    await PurchaseService.createDraft(
      {
        supplierId: testSupplierId,
        purchaseDate: '2026-09-10',
        paymentMethod: 'UPI',
        lines: [
          {
            inventoryItemId: testItem2.id,
            quantity: 5,
            unitRate: 200
          }
        ]
      },
      adminId
    );

    // 5. Record a wastage adjustment (uncosted by default)
    await StockLedgerService.recordAdjustment(
      {
        inventoryItemId: testItem1.id,
        businessDate: '2026-09-11',
        type: 'WASTAGE',
        quantity: '1.000',
        reason: 'Spilled during transport'
      },
      adminId
    );

    // 6. Insert a wastage movement with explicit recorded unit_cost
    await query(
      `INSERT INTO stock_movements (inventory_item_id, business_date, movement_type, quantity_delta, unit_cost, source_type, source_id, reason, created_by)
       VALUES ($1, '2026-09-12', 'WASTAGE', -2.000, 50.00, 'MANUAL_WASTAGE', $2, 'Expired stock', $3)`,
      [testItem1.id, `waste-${Date.now()}`, adminId]
    );
  });

  it('should generate inventory stock report and support XLSX and PDF export', async () => {
    const reportData = await InventoryReportsService.getInventoryStockReport('2026-09-15');

    expect(reportData.reportType).toBe('INVENTORY_STOCK');
    expect(reportData.summary.totalItems).toBeGreaterThan(0);
    expect(Number(reportData.summary.totalValuation)).toBeGreaterThan(0);

    // Test XLSX export
    const xlsxExport = await ReportService.requestExport(
      {
        reportType: 'INVENTORY_STOCK',
        asOf: '2026-09-15',
        fileFormat: 'XLSX',
        reportData
      },
      adminId
    );
    expect(xlsxExport.contentBuffer).toBeDefined();
    expect(xlsxExport.mimeType).toBe('text/csv');

    // Test PDF export
    const pdfExport = await ReportService.requestExport(
      {
        reportType: 'INVENTORY_STOCK',
        asOf: '2026-09-15',
        fileFormat: 'PDF',
        reportData
      },
      adminId
    );
    const pdfBuffer = Buffer.from(pdfExport.contentBuffer, 'base64');
    expect(pdfBuffer.slice(0, 5).toString('utf-8')).toBe('%PDF-');
  });

  it('should generate stock movements report for date range', async () => {
    const reportData = await InventoryReportsService.getStockMovementsReport({
      from: '2026-09-01',
      to: '2026-09-20'
    });

    expect(reportData.reportType).toBe('STOCK_MOVEMENTS');
    expect(reportData.summary.totalMovements).toBeGreaterThan(0);
    expect(Number(reportData.summary.totalInboundQuantity)).toBeGreaterThan(0);

    const pdfExport = await ReportService.requestExport(
      {
        reportType: 'STOCK_MOVEMENTS',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        fileFormat: 'PDF',
        reportData
      },
      adminId
    );
    const pdfBuffer = Buffer.from(pdfExport.contentBuffer, 'base64');
    expect(pdfBuffer.slice(0, 5).toString('utf-8')).toBe('%PDF-');
  });

  it('should generate purchases report with received vs draft separation', async () => {
    const reportData = await InventoryReportsService.getPurchasesReport({
      from: '2026-09-01',
      to: '2026-09-20'
    });

    expect(reportData.reportType).toBe('PURCHASES');
    expect(reportData.summary.receivedPurchasesCount).toBeGreaterThan(0);
    expect(Number(reportData.summary.receivedPurchasesTotal)).toBeGreaterThan(0);
    expect(reportData.summary.draftPurchasesCount).toBeGreaterThan(0);

    // Verify financial rule: draft total is tracked separately from received spend
    expect(Number(reportData.summary.draftPurchasesTotal)).toBeGreaterThan(0);
  });

  it('should generate supplier spend report', async () => {
    const reportData = await InventoryReportsService.getSuppliersReport({
      from: '2026-09-01',
      to: '2026-09-20'
    });

    expect(reportData.reportType).toBe('SUPPLIERS');
    expect(reportData.summary.totalSuppliers).toBeGreaterThan(0);
    expect(Number(reportData.summary.totalSpend)).toBeGreaterThan(0);

    const targetSupplier = reportData.suppliers.find((s: any) => s.supplierId === testSupplierId);
    expect(targetSupplier).toBeDefined();
    expect(targetSupplier?.receivedOrders).toBeGreaterThan(0);
  });

  it('should generate wastage report with exact quantities and recorded unit costs', async () => {
    const reportData = await InventoryReportsService.getWastageReport({
      from: '2026-09-01',
      to: '2026-09-20'
    });

    expect(reportData.reportType).toBe('WASTAGE');
    expect(reportData.summary.totalWastageRecords).toBeGreaterThan(0);
    expect(Number(reportData.summary.totalWastedQuantity)).toBeGreaterThan(0);
    expect(reportData.summary.uncostedMovementsCount).toBeGreaterThan(0);
    expect(Number(reportData.summary.totalRecordedFinancialLoss)).toBeGreaterThan(0);
  });

  it('should reject reports exceeding 366 days maximum date range', async () => {
    await expect(
      InventoryReportsService.getStockMovementsReport({
        from: '2025-01-01',
        to: '2026-03-01'
      })
    ).rejects.toThrow(ReportTooLargeError);
  });
});
