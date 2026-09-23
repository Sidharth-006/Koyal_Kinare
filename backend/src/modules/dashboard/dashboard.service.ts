import { SalesService } from '../sales/sales.service';
import { SettingsRepository } from '../settings/settings.repository';
import { getTodayDateString } from '@/shared/time';
import { toDecimal, subtractMoney } from '@/shared/money/decimal';

export class DashboardService {
  static async getDashboardMetrics(operatingDate?: string) {
    const today = operatingDate || getTodayDateString();

    const dateObj = new Date(today);
    const monthStart = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-01`;

    const dailyMetrics = await SalesService.getSalesMetrics(today, today);
    const monthlyMetrics = await SalesService.getSalesMetrics(monthStart, today);
    const targetSettings = await SettingsRepository.getTargetSettings();

    const dailyTarget = targetSettings.daily_sales_target;
    const monthlyTarget = targetSettings.monthly_sales_target;

    const dailySalesDec = toDecimal(dailyMetrics.totalSales);
    const dailyTargetDec = toDecimal(dailyTarget);
    const dailyProgressPercent = dailyTargetDec.greaterThan(0)
      ? dailySalesDec.dividedBy(dailyTargetDec).times(100).toFixed(1)
      : '0.0';
    const dailyRemaining = dailyTargetDec.greaterThan(dailySalesDec)
      ? subtractMoney(dailyTarget, dailyMetrics.totalSales)
      : '0.00';

    const monthlySalesDec = toDecimal(monthlyMetrics.totalSales);
    const monthlyTargetDec = toDecimal(monthlyTarget);
    const monthlyProgressPercent = monthlyTargetDec.greaterThan(0)
      ? monthlySalesDec.dividedBy(monthlyTargetDec).times(100).toFixed(1)
      : '0.0';

    return {
      operatingDate: today,
      todayCompletedSales: dailyMetrics.totalSales,
      dailyTarget,
      dailyProgressPercent: Number(dailyProgressPercent),
      dailyRemaining,
      completedBillCount: dailyMetrics.billCount,
      averageBillValue: dailyMetrics.averageOrderValue,
      cashSales: dailyMetrics.paymentSplits.CASH,
      upiSales: dailyMetrics.paymentSplits.UPI,
      cardSales: dailyMetrics.paymentSplits.CARD,
      todayExpenses: dailyMetrics.totalExpenses,
      estimatedProfit: dailyMetrics.estimatedNetProfit,
      monthlySales: monthlyMetrics.totalSales,
      monthlyTarget,
      monthlyProgressPercent: Number(monthlyProgressPercent),
      isEstimate: true,
      profitDisclaimer: 'Phase 1 profitability is an ESTIMATE because inventory purchase consumption is not included.'
    };
  }
}
