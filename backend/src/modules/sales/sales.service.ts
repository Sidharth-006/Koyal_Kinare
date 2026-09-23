import { SalesRepository } from './sales.repository';
import { subtractMoney, toDecimal } from '@/shared/money/decimal';

export class SalesService {
  static async getSalesMetrics(startDate: string, endDate: string) {
    const summary = await SalesRepository.getSalesSummary(startDate, endDate);
    const paymentSplitsRaw = await SalesRepository.getPaymentSplits(startDate, endDate);
    const totalExpenses = await SalesRepository.getExpensesSummary(startDate, endDate);
    const itemBreakdown = await SalesRepository.getItemSalesBreakdown(startDate, endDate);
    const categoryBreakdown = await SalesRepository.getCategorySalesBreakdown(startDate, endDate);

    const billCount = parseInt(summary.bill_count, 10);
    const totalSales = summary.total_sales;
    const averageOrderValue = billCount > 0 ? toDecimal(totalSales).dividedBy(billCount).toFixed(2) : '0.00';

    const splits = {
      CASH: '0.00',
      UPI: '0.00',
      CARD: '0.00'
    };

    for (const split of paymentSplitsRaw) {
      if (split.payment_method in splits) {
        (splits as any)[split.payment_method] = split.total_amount;
      }
    }

    const estimatedNetProfit = subtractMoney(totalSales, totalExpenses);

    return {
      startDate,
      endDate,
      billCount,
      totalSales,
      totalSubtotal: summary.total_subtotal,
      totalDiscount: summary.total_discount,
      totalTax: summary.total_tax,
      averageOrderValue,
      paymentSplits: splits,
      totalExpenses,
      estimatedNetProfit,
      isEstimate: true,
      itemBreakdown,
      categoryBreakdown
    };
  }
}
