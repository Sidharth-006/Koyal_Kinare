import { describe, it, expect, beforeAll } from 'vitest';
import { ProfitabilityService } from '@/modules/reporting/profitability.service';
import { ReportService } from '@/modules/reporting/report.service';
import { query } from '@/shared/database/client';

describe('Phase 2 Profitability Integration Tests', () => {
  let adminId: string;

  beforeAll(async () => {
    const adminRes = await query('SELECT id FROM admins LIMIT 1');
    if (adminRes.rows.length > 0) {
      adminId = adminRes.rows[0].id;
    } else {
      const inserted = await query(
        "INSERT INTO admins (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id",
        ['profit_admin@koyal.com', 'hash', 'Profit Admin']
      );
      adminId = inserted.rows[0].id;
    }
  });

  it('should generate Phase 2 Profitability with estimate flag, disclaimer, and category breakdowns', async () => {
    const res = await ProfitabilityService.getPhase2Profitability('2026-09-01', '2026-09-30');

    expect(res).toBeDefined();
    expect(res.startDate).toBe('2026-09-01');
    expect(res.endDate).toBe('2026-09-30');

    // Estimate flags
    expect(res.isEstimate).toBe(true);
    expect(res.estimationDisclaimer).toContain('recipe-costed COGS');

    // Financial summary
    expect(res.financialSummary).toBeDefined();
    expect(res.financialSummary).toHaveProperty('totalRevenue');
    expect(res.financialSummary).toHaveProperty('totalOperatingExpenses');
    expect(res.financialSummary).toHaveProperty('totalReceivedPurchases');
    expect(res.financialSummary).toHaveProperty('phase1NetProfit');
    expect(res.financialSummary).toHaveProperty('phase2EstimatedNetProfit');

    // Purchases categories
    expect(res.purchases).toBeDefined();
    expect(res.purchases).toHaveProperty('rawMaterialPurchases');
    expect(res.purchases).toHaveProperty('packagingPurchases');
    expect(res.purchases).toHaveProperty('otherPurchases');

    // Wastage and Consumption indicators
    expect(res.wastageIndicators).toBeDefined();
    expect(res.wastageIndicators).toHaveProperty('wastageMovementCount');
    expect(res.wastageIndicators).toHaveProperty('wastageTotalQuantity');

    expect(res.manualConsumptionIndicators).toBeDefined();
    expect(res.manualConsumptionIndicators).toHaveProperty('manualConsumptionCount');

    // PDF generation test
    const pdfExport = await ReportService.requestExport(
      {
        reportType: 'PHASE_2_PROFITABILITY',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        fileFormat: 'PDF',
        reportData: res
      },
      adminId
    );
    const pdfBuffer = Buffer.from(pdfExport.contentBuffer, 'base64');
    expect(pdfBuffer.slice(0, 5).toString('utf-8')).toBe('%PDF-');
  });
});
