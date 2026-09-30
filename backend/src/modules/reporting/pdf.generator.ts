import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';

export interface ReportPdfMetadata {
  cafeName: string;
  reportTitle: string;
  appliedDateRange: string;
  generatedAt: string;
  format?: string;
}

export class PdfGenerator {
  private doc!: PDFDocument;
  private fontRegular!: PDFFont;
  private fontBold!: PDFFont;
  private pages: PDFPage[] = [];
  private currentPage!: PDFPage;
  private yOffset: number = 0;

  private readonly pageWidth = 595.28; // A4 width
  private readonly pageHeight = 841.89; // A4 height
  private readonly margin = 40;
  private readonly contentWidth = 595.28 - 80;

  // Colors
  private readonly colorForest = rgb(0.12, 0.28, 0.22); // Deep forest green #1e4738
  private readonly colorForestLight = rgb(0.93, 0.96, 0.94);
  private readonly colorDark = rgb(0.12, 0.15, 0.18);
  private readonly colorMuted = rgb(0.45, 0.50, 0.55);
  private readonly colorBorder = rgb(0.85, 0.88, 0.87);
  private readonly colorRowAlt = rgb(0.98, 0.98, 0.98);
  private readonly colorWhite = rgb(1, 1, 1);

  static async generate(metadata: ReportPdfMetadata, data: any): Promise<Uint8Array> {
    const generator = new PdfGenerator();
    return generator.build(metadata, data);
  }

  private async build(metadata: ReportPdfMetadata, data: any): Promise<Uint8Array> {
    this.doc = await PDFDocument.create();
    this.fontRegular = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.doc.embedFont(StandardFonts.HelveticaBold);

    this.addNewPage();
    this.renderHeader(metadata);

    // Determine type of data and render appropriately
    if (this.isInventoryStock(data)) {
      this.renderInventoryStock(data);
    } else if (this.isStockMovements(data)) {
      this.renderStockMovements(data);
    } else if (this.isPurchasesReport(data)) {
      this.renderPurchasesReport(data);
    } else if (this.isSuppliersReport(data)) {
      this.renderSuppliersReport(data);
    } else if (this.isWastageReport(data)) {
      this.renderWastageReport(data);
    } else if (this.isPhase2Profitability(data)) {
      this.renderPhase2Profitability(data);
    } else if (this.isDailySummary(data)) {
      this.renderDailySummary(data);
    } else if (this.isItemSales(data)) {
      this.renderItemSales(data);
    } else if (this.isExpenseReport(data)) {
      this.renderExpenseReport(data);
    } else if (this.isReconciliation(data)) {
      this.renderReconciliation(data);
    } else if (Array.isArray(data)) {
      this.renderGenericTable(data);
    } else {
      this.renderGenericKeyValue(data);
    }

    this.renderFooters(metadata);
    return this.doc.save();
  }

  private addNewPage() {
    this.currentPage = this.doc.addPage([this.pageWidth, this.pageHeight]);
    this.pages.push(this.currentPage);
    this.yOffset = this.pageHeight - this.margin;
  }

  private ensureSpace(neededHeight: number) {
    if (this.yOffset - neededHeight < this.margin + 30) {
      this.addNewPage();
      this.yOffset -= 20;
    }
  }

  private sanitize(val: any): string {
    if (val === null || val === undefined) return '-';
    let str = String(val);
    str = str.replace(/[₹]/g, 'Rs. ');
    str = str.replace(/[^\x20-\x7E\n]/g, ' ');
    return str.trim();
  }

  private renderHeader(metadata: ReportPdfMetadata) {
    this.currentPage.drawRectangle({
      x: 0,
      y: this.pageHeight - 8,
      width: this.pageWidth,
      height: 8,
      color: this.colorForest
    });

    this.yOffset -= 15;

    this.currentPage.drawText('Koyal Kinare Cafe', {
      x: this.margin,
      y: this.yOffset,
      size: 20,
      font: this.fontBold,
      color: this.colorForest
    });

    const badgeText = 'OFFICIAL REPORT';
    const badgeWidth = this.fontBold.widthOfTextAtSize(badgeText, 8) + 12;
    this.currentPage.drawRectangle({
      x: this.pageWidth - this.margin - badgeWidth,
      y: this.yOffset,
      width: badgeWidth,
      height: 16,
      color: this.colorForestLight,
      borderColor: this.colorForest,
      borderWidth: 0.5
    });
    this.currentPage.drawText(badgeText, {
      x: this.pageWidth - this.margin - badgeWidth + 6,
      y: this.yOffset + 4,
      size: 8,
      font: this.fontBold,
      color: this.colorForest
    });

    this.yOffset -= 24;

    const title = this.sanitize(metadata.reportTitle.replace(/ \((PDF|EXCEL|XLSX)\)/i, ''));
    this.currentPage.drawText(title, {
      x: this.margin,
      y: this.yOffset,
      size: 14,
      font: this.fontBold,
      color: this.colorDark
    });

    this.yOffset -= 16;

    const metaStr = `Date Range: ${this.sanitize(metadata.appliedDateRange)}   |   Generated: ${new Date(metadata.generatedAt).toLocaleString('en-IN')}`;
    this.currentPage.drawText(metaStr, {
      x: this.margin,
      y: this.yOffset,
      size: 9,
      font: this.fontRegular,
      color: this.colorMuted
    });

    this.yOffset -= 14;

    this.currentPage.drawLine({
      start: { x: this.margin, y: this.yOffset },
      end: { x: this.pageWidth - this.margin, y: this.yOffset },
      thickness: 1,
      color: this.colorBorder
    });

    this.yOffset -= 20;
  }

  // --- TYPE GUARDS ---

  private isInventoryStock(data: any): boolean {
    return data && (data.reportType === 'INVENTORY_STOCK' || (Array.isArray(data.items) && data.summary && 'totalValuation' in data.summary));
  }

  private isStockMovements(data: any): boolean {
    return data && (data.reportType === 'STOCK_MOVEMENTS' || Array.isArray(data.movements));
  }

  private isPurchasesReport(data: any): boolean {
    return data && (data.reportType === 'PURCHASES' || (Array.isArray(data.purchases) && data.summary && 'receivedPurchasesTotal' in data.summary));
  }

  private isSuppliersReport(data: any): boolean {
    return data && (data.reportType === 'SUPPLIERS' || (Array.isArray(data.suppliers) && data.summary && 'totalSpend' in data.summary));
  }

  private isWastageReport(data: any): boolean {
    return data && (data.reportType === 'WASTAGE' || Array.isArray(data.wastageItems));
  }

  private isPhase2Profitability(data: any): boolean {
    return data && data.financialSummary && ('phase2EstimatedNetProfit' in data.financialSummary || 'wastageIndicators' in data);
  }

  private isDailySummary(data: any): boolean {
    return data && typeof data === 'object' && ('totalSales' in data || 'billCount' in data) && 'paymentSplits' in data;
  }

  private isItemSales(data: any): boolean {
    return data && typeof data === 'object' && Array.isArray(data.itemBreakdown) && !('totalSales' in data);
  }

  private isExpenseReport(data: any): boolean {
    return Array.isArray(data) && data.length > 0 && ('category' in data[0] || 'expense_date' in data[0]);
  }

  private isReconciliation(data: any): boolean {
    return data && typeof data === 'object' && ('openingCash' in data || 'expectedClosingCash' in data || 'actualCash' in data);
  }

  // --- MODULE 5 RENDERERS ---

  private renderInventoryStock(data: any) {
    this.renderSectionTitle('Inventory Valuation & Stock Status Summary');

    const summaryRows = [
      ['Total Active Items', this.sanitize(data.summary?.totalItems || 0)],
      ['Low Stock Items Alert Count', this.sanitize(data.summary?.lowStockItemsCount || 0)],
      ['Total Inventory Valuation', `Rs. ${this.sanitize(data.summary?.totalValuation || '0.00')}`]
    ];
    this.renderCustomTable(['Metric', 'Value'], [260, 255], summaryRows);

    if (Array.isArray(data.items) && data.items.length > 0) {
      this.renderSectionTitle('Item Stock Detail');
      const rows = data.items.map((it: any) => [
        this.sanitize(it.itemName),
        this.sanitize(it.itemType),
        `${this.sanitize(it.currentQuantity)} ${this.sanitize(it.baseUnit)}`,
        `${this.sanitize(it.minimumStock)} ${this.sanitize(it.baseUnit)}`,
        this.sanitize(it.status),
        it.totalValue ? `Rs. ${this.sanitize(it.totalValue)}` : '-'
      ]);
      this.renderCustomTable(
        ['Item Name', 'Category', 'Current Stock', 'Min Stock', 'Status', 'Valuation'],
        [140, 85, 80, 70, 65, 75],
        rows
      );
    }
  }

  private renderStockMovements(data: any) {
    this.renderSectionTitle('Movement Ledger Summary');

    const summaryRows = [
      ['Total Recorded Movements', this.sanitize(data.summary?.totalMovements || 0)],
      ['Total Inbound Quantity', this.sanitize(data.summary?.totalInboundQuantity || '0.000')],
      ['Total Outbound Quantity', this.sanitize(data.summary?.totalOutboundQuantity || '0.000')],
      ['Net Change in Period', this.sanitize(data.summary?.netChangeQuantity || '0.000')]
    ];
    this.renderCustomTable(['Metric', 'Value'], [260, 255], summaryRows);

    if (Array.isArray(data.movements) && data.movements.length > 0) {
      this.renderSectionTitle('Movement Audit Trail');
      const rows = data.movements.map((m: any) => [
        this.sanitize(m.businessDate),
        this.sanitize(m.itemName),
        this.sanitize(m.movementType),
        `${this.sanitize(m.quantityDelta)} ${this.sanitize(m.baseUnit)}`,
        m.unitCost ? `Rs. ${this.sanitize(m.unitCost)}` : '-',
        this.sanitize(m.reason || m.sourceType)
      ]);
      this.renderCustomTable(
        ['Date', 'Item Name', 'Movement Type', 'Quantity Delta', 'Unit Cost', 'Reason / Source'],
        [65, 120, 110, 80, 60, 80],
        rows
      );
    }
  }

  private renderPurchasesReport(data: any) {
    this.renderSectionTitle('Purchase Performance & Financial Breakdown');

    const summaryRows = [
      ['Received Orders (Financial Spend)', `${this.sanitize(data.summary?.receivedPurchasesCount || 0)} orders (Rs. ${this.sanitize(data.summary?.receivedPurchasesTotal || '0.00')})`],
      ['Draft Orders (Uncommitted)', `${this.sanitize(data.summary?.draftPurchasesCount || 0)} orders (Rs. ${this.sanitize(data.summary?.draftPurchasesTotal || '0.00')})`],
      ['Reversed Orders (Annulled)', `${this.sanitize(data.summary?.reversedPurchasesCount || 0)} orders (Rs. ${this.sanitize(data.summary?.reversedPurchasesTotal || '0.00')})`],
      ['Cash Purchases Settled', `Rs. ${this.sanitize(data.summary?.receivedPaymentSplits?.CASH || '0.00')}`],
      ['UPI Purchases Settled', `Rs. ${this.sanitize(data.summary?.receivedPaymentSplits?.UPI || '0.00')}`]
    ];
    this.renderCustomTable(['Purchase Parameter', 'Summary Metric'], [240, 275], summaryRows);

    if (Array.isArray(data.purchases) && data.purchases.length > 0) {
      this.renderSectionTitle('Purchases Order Register');
      const rows = data.purchases.map((p: any) => [
        this.sanitize(p.purchaseNumber),
        this.sanitize(p.purchaseDate),
        this.sanitize(p.supplierName),
        this.sanitize(p.paymentMethod),
        this.sanitize(p.status),
        `Rs. ${this.sanitize(p.grandTotal)}`
      ]);
      this.renderCustomTable(
        ['PO Number', 'Date', 'Supplier Name', 'Payment Mode', 'Status', 'Grand Total'],
        [100, 65, 160, 75, 60, 55],
        rows
      );
    }
  }

  private renderSuppliersReport(data: any) {
    this.renderSectionTitle('Supplier Spend & Performance Overview');

    const summaryRows = [
      ['Total Active / Utilized Suppliers', this.sanitize(data.summary?.totalSuppliers || 0)],
      ['Total Realized Spend (Received)', `Rs. ${this.sanitize(data.summary?.totalSpend || '0.00')}`],
      ['Total Draft Orders Value', `Rs. ${this.sanitize(data.summary?.totalDraftSpend || '0.00')}`],
      ['Total Reversed Orders Value', `Rs. ${this.sanitize(data.summary?.totalReversedSpend || '0.00')}`]
    ];
    this.renderCustomTable(['Metric', 'Value'], [260, 255], summaryRows);

    if (Array.isArray(data.suppliers) && data.suppliers.length > 0) {
      this.renderSectionTitle('Supplier Order Breakdown');
      const rows = data.suppliers.map((s: any) => [
        this.sanitize(s.supplierName),
        this.sanitize(s.phone || s.contactPerson || '-'),
        this.sanitize(s.receivedOrders),
        `Rs. ${this.sanitize(s.receivedTotal)}`,
        this.sanitize(s.lastPurchaseDate || '-')
      ]);
      this.renderCustomTable(
        ['Supplier Name', 'Contact / Phone', 'Received Orders', 'Total Realized Spend', 'Last Order Date'],
        [160, 115, 75, 95, 70],
        rows
      );
    }
  }

  private renderWastageReport(data: any) {
    this.renderSectionTitle('Wastage & Operational Shrinkage Summary');

    const summaryRows = [
      ['Total Wastage Incidents', this.sanitize(data.summary?.totalWastageRecords || 0)],
      ['Total Wasted Quantity (Units)', this.sanitize(data.summary?.totalWastedQuantity || '0.000')],
      ['Recorded Financial Loss', `Rs. ${this.sanitize(data.summary?.totalRecordedFinancialLoss || '0.00')}`],
      ['Uncosted Incidents Count', this.sanitize(data.summary?.uncostedMovementsCount || 0)]
    ];
    this.renderCustomTable(['Wastage Metric', 'Recorded Value'], [260, 255], summaryRows);

    if (Array.isArray(data.wastageItems) && data.wastageItems.length > 0) {
      this.renderSectionTitle('Wastage Incident Log');
      const rows = data.wastageItems.map((w: any) => [
        this.sanitize(w.businessDate),
        this.sanitize(w.itemName),
        this.sanitize(w.movementType),
        `${this.sanitize(w.quantityWasted)} ${this.sanitize(w.baseUnit)}`,
        w.recordedLossAmount ? `Rs. ${this.sanitize(w.recordedLossAmount)}` : 'Uncosted',
        this.sanitize(w.reason || '-')
      ]);
      this.renderCustomTable(
        ['Date', 'Item Name', 'Type', 'Quantity', 'Loss (Recorded)', 'Reason / Notes'],
        [65, 120, 95, 75, 75, 85],
        rows
      );
    }
  }

  private renderPhase2Profitability(data: any) {
    this.renderSectionTitle('Phase 2 Estimated Profitability & Performance Summary');

    const fin = data.financialSummary || {};
    const summaryRows = [
      ['Gross Sales Revenue', `Rs. ${this.sanitize(fin.totalRevenue || '0.00')}`],
      ['Total Operating Expenses', `Rs. ${this.sanitize(fin.totalOperatingExpenses || '0.00')}`],
      ['Total Received Purchases (Inventory Spend)', `Rs. ${this.sanitize(fin.totalReceivedPurchases || '0.00')}`],
      ['Phase 1 Net Profit (Sales - Expenses)', `Rs. ${this.sanitize(fin.phase1NetProfit || '0.00')}`],
      ['Phase 2 Estimated Net Profit', `Rs. ${this.sanitize(fin.phase2EstimatedNetProfit || '0.00')}`]
    ];
    this.renderCustomTable(['Financial Metric', 'Amount'], [260, 255], summaryRows);

    // Disclaimer alert box
    this.ensureSpace(45);
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yOffset - 35,
      width: this.contentWidth,
      height: 35,
      color: this.colorForestLight,
      borderColor: this.colorBorder,
      borderWidth: 0.5
    });
    this.currentPage.drawText('* Disclaimer: Phase 2 profitability reflects cash/accrued inventory purchases during', {
      x: this.margin + 8,
      y: this.yOffset - 14,
      size: 8,
      font: this.fontRegular,
      color: this.colorDark
    });
    this.currentPage.drawText('this period and is not a recipe-costed COGS (scheduled for Phase 3).', {
      x: this.margin + 8,
      y: this.yOffset - 25,
      size: 8,
      font: this.fontRegular,
      color: this.colorDark
    });
    this.yOffset -= 45;

    // Inventory purchase breakdown
    this.renderSectionTitle('Inventory Purchase Category Breakdown');
    const purch = data.purchases || {};
    const purchRows = [
      ['Raw Materials Purchase Total', `Rs. ${this.sanitize(purch.rawMaterialPurchases || '0.00')}`],
      ['Packaging Materials Purchase Total', `Rs. ${this.sanitize(purch.packagingPurchases || '0.00')}`],
      ['Other Inventory Categories Total', `Rs. ${this.sanitize(purch.otherPurchases || '0.00')}`],
      ['Total Received Inventory Purchases', `Rs. ${this.sanitize(purch.totalPurchases || '0.00')}`]
    ];
    this.renderCustomTable(['Purchase Category', 'Total Spend'], [260, 255], purchRows);

    // Wastage & Shrinkage Indicators
    this.renderSectionTitle('Inventory Shrinkage & Consumption Indicators');
    const waste = data.wastageIndicators || {};
    const cons = data.manualConsumptionIndicators || {};
    const indRows = [
      ['Wastage Incidents Count', this.sanitize(waste.wastageMovementCount || 0)],
      ['Wastage Quantity Total', this.sanitize(waste.wastageTotalQuantity || '0.000')],
      ['Manual Decrease Incidents', this.sanitize(waste.manualDecreaseCount || 0)],
      ['Physical Count Deficit Corrections', this.sanitize(waste.countCorrectionDeficitCount || 0)],
      ['Manual Staff / Kitchen Consumption', this.sanitize(cons.manualConsumptionCount || 0)]
    ];
    this.renderCustomTable(['Shrinkage Indicator', 'Count / Total Quantity'], [260, 255], indRows);
  }

  // --- PHASE 1 RENDERERS (PRESERVED) ---

  private renderDailySummary(data: any) {
    this.renderSectionTitle('Key Performance Indicators');

    const kpis = [
      { label: 'Total Revenue', value: `Rs. ${this.sanitize(data.totalSales || '0.00')}` },
      { label: 'Total Orders', value: this.sanitize(data.billCount || 0) },
      { label: 'Avg Order Value', value: `Rs. ${this.sanitize(data.averageOrderValue || '0.00')}` },
      { label: 'Estimated Net Profit', value: `Rs. ${this.sanitize(data.estimatedNetProfit || '0.00')}` }
    ];

    const cardWidth = (this.contentWidth - 30) / 4;
    const cardHeight = 44;

    this.ensureSpace(cardHeight + 20);

    kpis.forEach((kpi, idx) => {
      const x = this.margin + idx * (cardWidth + 10);
      const y = this.yOffset - cardHeight;

      this.currentPage.drawRectangle({
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        color: this.colorForestLight,
        borderColor: this.colorBorder,
        borderWidth: 0.5
      });

      this.currentPage.drawText(kpi.label, {
        x: x + 8,
        y: y + cardHeight - 14,
        size: 7.5,
        font: this.fontRegular,
        color: this.colorMuted
      });

      this.currentPage.drawText(kpi.value, {
        x: x + 8,
        y: y + 10,
        size: 11,
        font: this.fontBold,
        color: this.colorForest
      });
    });

    this.yOffset -= (cardHeight + 20);

    this.renderSectionTitle('Sales & Payment Channel Summary');

    const summaryRows = [
      ['Gross Subtotal', `Rs. ${this.sanitize(data.totalSubtotal || '0.00')}`, 'Cash Payments', `Rs. ${this.sanitize(data.paymentSplits?.CASH || '0.00')}`],
      ['Total Discounts', `Rs. ${this.sanitize(data.totalDiscount || '0.00')}`, 'UPI Settlements', `Rs. ${this.sanitize(data.paymentSplits?.UPI || '0.00')}`],
      ['Taxes Collected', `Rs. ${this.sanitize(data.totalTax || '0.00')}`, 'Card Settlements', `Rs. ${this.sanitize(data.paymentSplits?.CARD || '0.00')}`],
      ['Total Expenses', `Rs. ${this.sanitize(data.totalExpenses || '0.00')}`, 'Net Total Sales', `Rs. ${this.sanitize(data.totalSales || '0.00')}`]
    ];

    this.renderCustomTable(
      ['Financial Metric', 'Amount', 'Payment Mode', 'Settled Total'],
      [140, 115, 140, 120],
      summaryRows
    );

    if (Array.isArray(data.categoryBreakdown) && data.categoryBreakdown.length > 0) {
      this.renderSectionTitle('Category Performance Breakdown');
      const catRows = data.categoryBreakdown.map((c: any) => [
        this.sanitize(c.category_name || 'Uncategorized'),
        this.sanitize(c.total_quantity || 0),
        `Rs. ${this.sanitize(c.total_revenue || '0.00')}`
      ]);
      this.renderCustomTable(['Category Name', 'Units Sold', 'Total Revenue'], [235, 120, 160], catRows);
    }
  }

  private renderItemSales(data: any) {
    if (Array.isArray(data.itemBreakdown) && data.itemBreakdown.length > 0) {
      this.renderSectionTitle('Menu Item Sales Breakdown');
      const rows = data.itemBreakdown.map((it: any) => [
        this.sanitize(it.item_name || 'Item'),
        this.sanitize(it.category_name || '-'),
        this.sanitize(it.total_quantity || 0),
        `Rs. ${this.sanitize(it.total_revenue || '0.00')}`
      ]);
      this.renderCustomTable(
        ['Item Name', 'Category', 'Quantity Sold', 'Total Revenue'],
        [185, 130, 90, 110],
        rows
      );
    }
  }

  private renderExpenseReport(data: any[]) {
    this.renderSectionTitle('Operational Expense Audit Trail');

    let totalExpenseAmount = 0;
    const rows = data.map((exp) => {
      const amt = parseFloat(exp.amount || 0);
      if (!isNaN(amt)) totalExpenseAmount += amt;
      return [
        this.sanitize(exp.expense_date || '-'),
        this.sanitize(exp.category || 'GENERAL'),
        this.sanitize(exp.description || exp.vendor_name || '-'),
        this.sanitize(exp.payment_method || 'CASH'),
        `Rs. ${this.sanitize(exp.amount || '0.00')}`
      ];
    });

    this.renderCustomTable(
      ['Date', 'Category', 'Description / Vendor', 'Payment Mode', 'Amount'],
      [75, 110, 170, 80, 80],
      rows
    );

    this.ensureSpace(25);
    this.currentPage.drawText(`Total Expenses: Rs. ${totalExpenseAmount.toFixed(2)}`, {
      x: this.pageWidth - this.margin - 200,
      y: this.yOffset,
      size: 11,
      font: this.fontBold,
      color: this.colorForest
    });
    this.yOffset -= 25;
  }

  private renderReconciliation(data: any) {
    this.renderSectionTitle('Daily Closing & Cash Reconciliation');

    const rows = [
      ['Business Date', this.sanitize(data.businessDate || '-')],
      ['Opening Cash Float', `Rs. ${this.sanitize(data.openingCash || '0.00')}`],
      ['Cash Sales Recorded', `Rs. ${this.sanitize(data.cashSales || '0.00')}`],
      ['Cash Expenses Paid', `Rs. ${this.sanitize(data.cashExpenses || '0.00')}`],
      ['Cash Purchases Paid', `Rs. ${this.sanitize(data.cashPurchases || '0.00')}`],
      ['Expected Closing Cash', `Rs. ${this.sanitize(data.expectedClosingCash || '0.00')}`],
      ['Actual Physical Cash Counted', `Rs. ${this.sanitize(data.actualCash || '0.00')}`],
      ['Cash Variance / Difference', `Rs. ${this.sanitize(data.cashDifference || '0.00')}`],
      ['UPI Digital Sales', `Rs. ${this.sanitize(data.upiSales || '0.00')}`],
      ['UPI Bank Settlement', `Rs. ${this.sanitize(data.upiSettlement || '0.00')}`],
      ['Card Digital Sales', `Rs. ${this.sanitize(data.cardSales || '0.00')}`],
      ['Card Bank Settlement', `Rs. ${this.sanitize(data.cardSettlement || '0.00')}`],
      ['Register Status', data.isClosed ? 'CLOSED & RECONCILED' : 'OPEN / PENDING CLOSING']
    ];

    this.renderCustomTable(
      ['Audit Parameter', 'Audited Value'],
      [260, 255],
      rows
    );
  }

  private renderGenericTable(data: any[]) {
    if (data.length === 0) {
      this.ensureSpace(30);
      this.currentPage.drawText('No records found for the selected criteria.', {
        x: this.margin,
        y: this.yOffset,
        size: 11,
        font: this.fontRegular,
        color: this.colorMuted
      });
      this.yOffset -= 30;
      return;
    }

    const first = data[0];
    const keys = Object.keys(first).slice(0, 5);
    const colWidth = Math.floor(this.contentWidth / keys.length);
    const colWidths = keys.map(() => colWidth);

    const rows = data.map(item => keys.map(k => this.sanitize(item[k])));
    this.renderCustomTable(keys.map(k => k.replace(/_/g, ' ').toUpperCase()), colWidths, rows);
  }

  private renderGenericKeyValue(data: any) {
    this.renderSectionTitle('Report Summary Data');
    const rows: string[][] = [];
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === 'object' && val !== null) {
        rows.push([this.sanitize(key), JSON.stringify(val).slice(0, 50)]);
      } else {
        rows.push([this.sanitize(key), this.sanitize(val)]);
      }
    }
    this.renderCustomTable(['Field', 'Value'], [220, 295], rows);
  }

  // --- REUSABLE UI HELPERS ---

  private renderSectionTitle(title: string) {
    this.ensureSpace(30);
    this.currentPage.drawText(this.sanitize(title), {
      x: this.margin,
      y: this.yOffset,
      size: 11,
      font: this.fontBold,
      color: this.colorForest
    });
    this.yOffset -= 12;

    this.currentPage.drawLine({
      start: { x: this.margin, y: this.yOffset },
      end: { x: this.margin + 60, y: this.yOffset },
      thickness: 2,
      color: this.colorForest
    });

    this.yOffset -= 12;
  }

  private renderCustomTable(headers: string[], colWidths: number[], rows: string[][]) {
    const rowHeight = 20;
    const headerHeight = 22;

    this.ensureSpace(headerHeight + rowHeight + 10);

    let currentX = this.margin;
    this.currentPage.drawRectangle({
      x: this.margin,
      y: this.yOffset - headerHeight,
      width: this.contentWidth,
      height: headerHeight,
      color: this.colorForest
    });

    headers.forEach((hdr, idx) => {
      this.currentPage.drawText(this.sanitize(hdr), {
        x: currentX + 6,
        y: this.yOffset - 15,
        size: 8.5,
        font: this.fontBold,
        color: this.colorWhite
      });
      currentX += colWidths[idx];
    });

    this.yOffset -= headerHeight;

    rows.forEach((row, rowIdx) => {
      this.ensureSpace(rowHeight);

      const isAlt = rowIdx % 2 === 1;
      if (isAlt) {
        this.currentPage.drawRectangle({
          x: this.margin,
          y: this.yOffset - rowHeight,
          width: this.contentWidth,
          height: rowHeight,
          color: this.colorRowAlt
        });
      }

      this.currentPage.drawLine({
        start: { x: this.margin, y: this.yOffset - rowHeight },
        end: { x: this.pageWidth - this.margin, y: this.yOffset - rowHeight },
        thickness: 0.5,
        color: this.colorBorder
      });

      let cellX = this.margin;
      row.forEach((cell, colIdx) => {
        const text = this.sanitize(cell);
        const maxLen = Math.floor(colWidths[colIdx] / 5.5);
        const display = text.length > maxLen ? text.slice(0, maxLen - 2) + '..' : text;

        this.currentPage.drawText(display, {
          x: cellX + 6,
          y: this.yOffset - 14,
          size: 8.5,
          font: this.fontRegular,
          color: this.colorDark
        });
        cellX += colWidths[colIdx];
      });

      this.yOffset -= rowHeight;
    });

    this.yOffset -= 15;
  }

  private renderFooters(metadata: ReportPdfMetadata) {
    const totalPages = this.pages.length;
    this.pages.forEach((page, idx) => {
      const footerY = 22;

      page.drawLine({
        start: { x: this.margin, y: footerY + 12 },
        end: { x: this.pageWidth - this.margin, y: footerY + 12 },
        thickness: 0.5,
        color: this.colorBorder
      });

      page.drawText('Koyal Kinare Cafe - Confidential Internal Business Document', {
        x: this.margin,
        y: footerY,
        size: 7.5,
        font: this.fontRegular,
        color: this.colorMuted
      });

      const pageStr = `Page ${idx + 1} of ${totalPages}`;
      const pageStrWidth = this.fontRegular.widthOfTextAtSize(pageStr, 7.5);
      page.drawText(pageStr, {
        x: this.pageWidth - this.margin - pageStrWidth,
        y: footerY,
        size: 7.5,
        font: this.fontRegular,
        color: this.colorMuted
      });
    });
  }
}
