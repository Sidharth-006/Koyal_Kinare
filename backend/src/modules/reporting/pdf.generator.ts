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
    if (this.isDailySummary(data)) {
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
      this.yOffset -= 20; // small top breathing room on continuation pages
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
    // Green accent bar on top
    this.currentPage.drawRectangle({
      x: 0,
      y: this.pageHeight - 8,
      width: this.pageWidth,
      height: 8,
      color: this.colorForest
    });

    this.yOffset -= 15;

    // Cafe Brand Name
    this.currentPage.drawText('Koyal Kinare Cafe', {
      x: this.margin,
      y: this.yOffset,
      size: 20,
      font: this.fontBold,
      color: this.colorForest
    });

    // Official Report badge
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

    // Report Title
    const title = this.sanitize(metadata.reportTitle.replace(' (PDF)', ''));
    this.currentPage.drawText(title, {
      x: this.margin,
      y: this.yOffset,
      size: 14,
      font: this.fontBold,
      color: this.colorDark
    });

    this.yOffset -= 16;

    // Metadata line (Date Range & Generated At)
    const metaStr = `Date Range: ${this.sanitize(metadata.appliedDateRange)}   |   Generated: ${new Date(metadata.generatedAt).toLocaleString('en-IN')}`;
    this.currentPage.drawText(metaStr, {
      x: this.margin,
      y: this.yOffset,
      size: 9,
      font: this.fontRegular,
      color: this.colorMuted
    });

    this.yOffset -= 14;

    // Divider line
    this.currentPage.drawLine({
      start: { x: this.margin, y: this.yOffset },
      end: { x: this.pageWidth - this.margin, y: this.yOffset },
      thickness: 1,
      color: this.colorBorder
    });

    this.yOffset -= 20;
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

  // --- RENDERERS FOR EACH REPORT TYPE ---

  private renderDailySummary(data: any) {
    // 1. KPI Cards Row
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

      // Card background
      this.currentPage.drawRectangle({
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        color: this.colorForestLight,
        borderColor: this.colorBorder,
        borderWidth: 0.5
      });

      // Label
      this.currentPage.drawText(kpi.label, {
        x: x + 8,
        y: y + cardHeight - 14,
        size: 7.5,
        font: this.fontRegular,
        color: this.colorMuted
      });

      // Value
      this.currentPage.drawText(kpi.value, {
        x: x + 8,
        y: y + 10,
        size: 11,
        font: this.fontBold,
        color: this.colorForest
      });
    });

    this.yOffset -= (cardHeight + 20);

    // 2. Financial Breakdown & Payment Methods
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

    // 3. Category Breakdown Table
    if (Array.isArray(data.categoryBreakdown) && data.categoryBreakdown.length > 0) {
      this.renderSectionTitle('Category Performance Breakdown');
      const catRows = data.categoryBreakdown.map((c: any) => [
        this.sanitize(c.category_name || 'Uncategorized'),
        this.sanitize(c.total_quantity || 0),
        `Rs. ${this.sanitize(c.total_revenue || '0.00')}`
      ]);
      this.renderCustomTable(['Category Name', 'Units Sold', 'Total Revenue'], [235, 120, 160], catRows);
    }

    // 4. Item Sales Table (if any)
    if (Array.isArray(data.itemBreakdown) && data.itemBreakdown.length > 0) {
      this.renderSectionTitle('Top Sold Menu Items');
      const itemRows = data.itemBreakdown.slice(0, 15).map((it: any) => [
        this.sanitize(it.item_name || 'Item'),
        this.sanitize(it.category_name || '-'),
        this.sanitize(it.total_quantity || 0),
        `Rs. ${this.sanitize(it.total_revenue || '0.00')}`
      ]);
      this.renderCustomTable(
        ['Item Name', 'Category', 'Quantity Sold', 'Total Revenue'],
        [185, 130, 90, 110],
        itemRows
      );
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

    if (Array.isArray(data.categoryBreakdown) && data.categoryBreakdown.length > 0) {
      this.renderSectionTitle('Category Sales Breakdown');
      const catRows = data.categoryBreakdown.map((c: any) => [
        this.sanitize(c.category_name || 'Uncategorized'),
        this.sanitize(c.total_quantity || 0),
        `Rs. ${this.sanitize(c.total_revenue || '0.00')}`
      ]);
      this.renderCustomTable(['Category Name', 'Units Sold', 'Total Revenue'], [235, 120, 160], catRows);
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

    // Total expense footer note
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
      this.currentPage.drawText('No records found for the selected date range.', {
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

    // Draw Table Header
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

    // Draw Data Rows
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

      // Bottom row divider line
      this.currentPage.drawLine({
        start: { x: this.margin, y: this.yOffset - rowHeight },
        end: { x: this.pageWidth - this.margin, y: this.yOffset - rowHeight },
        thickness: 0.5,
        color: this.colorBorder
      });

      let cellX = this.margin;
      row.forEach((cell, colIdx) => {
        const text = this.sanitize(cell);
        // Truncate if too long to prevent overlapping
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

    this.yOffset -= 15; // spacing after table
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
