import { ReconciliationRepository } from './reconciliation.repository';
import { AuditService } from '../audit/audit.service';
import { addMoney, subtractMoney, toDecimal } from '@/shared/money/decimal';
import { getTodayDateString } from '@/shared/time';
import { ValidationError } from '@/shared/errors';

export class ReconciliationService {
  static async setOpeningCash(businessDate: string | undefined, openingCash: number | string, adminId: string, requestId?: string) {
    if (openingCash === undefined || Number(openingCash) < 0) {
      throw new ValidationError('Opening cash must be non-negative.');
    }
    const date = businessDate || getTodayDateString();
    const opening = await ReconciliationRepository.setOpeningCash(date, String(openingCash), adminId);

    await AuditService.logEvent({
      adminId,
      action: 'OPENING_CASH_SET',
      entityType: 'CASH_OPENING',
      entityId: opening.id,
      requestId,
      afterState: opening
    });

    return opening;
  }

  static async getReconciliationPreview(businessDate?: string) {
    const date = businessDate || getTodayDateString();

    const [
      openingRecord,
      cashSales,
      cashExpenses,
      cashPurchases,
      upiSales,
      upiSettlementRecord,
      cardSales,
      cardSettlementRecord,
      closingRecord
    ] = await Promise.all([
      ReconciliationRepository.getOpeningCash(date),
      ReconciliationRepository.getCompletedPaymentsByMethod(date, 'CASH'),
      ReconciliationRepository.getActiveExpensesByMethod(date, 'CASH'),
      ReconciliationRepository.getReceivedPurchasesByMethod(date, 'CASH'),
      ReconciliationRepository.getCompletedPaymentsByMethod(date, 'UPI'),
      ReconciliationRepository.getSettlement(date, 'UPI'),
      ReconciliationRepository.getCompletedPaymentsByMethod(date, 'CARD'),
      ReconciliationRepository.getSettlement(date, 'CARD'),
      ReconciliationRepository.getDailyClosing(date)
    ]);

    const openingCash = openingRecord ? openingRecord.opening_cash : '0.00';
    // Expected Cash = Opening Cash + Cash Sales - Cash Expenses - Cash Purchases
    const cashBeforePurchases = subtractMoney(addMoney(openingCash, cashSales), cashExpenses);
    const expectedClosingCash = subtractMoney(cashBeforePurchases, cashPurchases);

    const upiSettlement = upiSettlementRecord ? upiSettlementRecord.settlement_amount : '0.00';
    const upiDifference = subtractMoney(upiSettlement, upiSales);

    const cardSettlement = cardSettlementRecord ? cardSettlementRecord.settlement_amount : '0.00';
    const cardDifference = subtractMoney(cardSettlement, cardSales);

    const openingObj = openingRecord ? {
      ...openingRecord,
      openingCash: openingRecord.opening_cash,
      opening_cash: openingRecord.opening_cash
    } : null;

    const closingObj = closingRecord ? {
      ...closingRecord,
      actualCash: closingRecord.actual_cash,
      cashDifference: closingRecord.cash_difference,
      isClosed: closingRecord.status === 'CLOSED'
    } : null;

    const upiSettlementObj = upiSettlementRecord ? {
      ...upiSettlementRecord,
      settlementAmount: upiSettlementRecord.settlement_amount,
      settlement_amount: upiSettlementRecord.settlement_amount
    } : null;

    const cardSettlementObj = cardSettlementRecord ? {
      ...cardSettlementRecord,
      settlementAmount: cardSettlementRecord.settlement_amount,
      settlement_amount: cardSettlementRecord.settlement_amount
    } : null;

    return {
      businessDate: date,
      opening: openingObj,
      openingRecord,
      openingCash,
      opening_cash: openingCash,
      cashSales,
      totalCashSales: cashSales,
      total_cash_sales: cashSales,
      cashExpenses,
      totalCashExpenses: cashExpenses,
      total_cash_expenses: cashExpenses,
      cashPurchases,
      totalCashPurchases: cashPurchases,
      total_cash_purchases: cashPurchases,
      expectedCash: expectedClosingCash,
      expectedClosingCash,
      expected_closing_cash: expectedClosingCash,
      upiSales,
      totalUpiSales: upiSales,
      total_upi_sales: upiSales,
      upiSettlement: upiSettlementObj,
      upiSettlementAmount: upiSettlement,
      upiDifference,
      cardSales,
      totalCardSales: cardSales,
      total_card_sales: cardSales,
      cardSettlement: cardSettlementObj,
      cardSettlementAmount: cardSettlement,
      cardDifference,
      closing: closingObj,
      closingRecord
    };
  }

  static async recordSettlement(
    params: {
      businessDate?: string;
      method: 'UPI' | 'CARD';
      settlementAmount: number | string;
      notes?: string;
    },
    adminId: string,
    requestId?: string
  ) {
    const date = params.businessDate || getTodayDateString();
    if (!['UPI', 'CARD'].includes(params.method)) {
      throw new ValidationError('Invalid settlement method.');
    }
    if (params.settlementAmount === undefined || Number(params.settlementAmount) < 0) {
      throw new ValidationError('Settlement amount must be non-negative.');
    }

    const expectedAmount = await ReconciliationRepository.getCompletedPaymentsByMethod(date, params.method);
    const difference = subtractMoney(params.settlementAmount, expectedAmount);
    const status = toDecimal(difference).equals(0) ? 'MATCHED' : 'MISMATCHED';

    const settlement = await ReconciliationRepository.recordSettlement({
      businessDate: date,
      method: params.method,
      expectedAmount,
      settlementAmount: String(params.settlementAmount),
      difference,
      status,
      notes: params.notes,
      settledBy: adminId
    });

    await AuditService.logEvent({
      adminId,
      action: 'SETTLEMENT_UPDATED',
      entityType: 'SETTLEMENT',
      entityId: settlement.id,
      requestId,
      afterState: settlement
    });

    return settlement;
  }

  static async finalizeDailyClosing(
    params: {
      businessDate?: string;
      actualCash: number | string;
      upiSettlementAmount?: number | string;
      cardSettlementAmount?: number | string;
      notes?: string;
    },
    adminId: string,
    requestId?: string
  ) {
    const date = params.businessDate || getTodayDateString();
    if (params.actualCash === undefined || Number(params.actualCash) < 0) {
      throw new ValidationError('Actual counted cash must be non-negative.');
    }

    const preview = await this.getReconciliationPreview(date);

    const actualCashStr = String(params.actualCash);
    const cashDifference = subtractMoney(actualCashStr, preview.expectedClosingCash);
    const diffDec = toDecimal(cashDifference);

    let cashStatus: 'MATCHED' | 'SHORTAGE' | 'EXCESS' = 'MATCHED';
    if (diffDec.lessThan(0)) {
      cashStatus = 'SHORTAGE';
    } else if (diffDec.greaterThan(0)) {
      cashStatus = 'EXCESS';
    }

    const upiSettlementStr = params.upiSettlementAmount !== undefined
      ? String(params.upiSettlementAmount)
      : (preview.upiSettlementAmount || (typeof preview.upiSettlement === 'string' ? preview.upiSettlement : (preview.upiSettlement?.settlement_amount || '0.00')));
    const upiDifference = subtractMoney(upiSettlementStr, preview.upiSales);
    const upiStatus = toDecimal(upiDifference).equals(0) ? 'MATCHED' : 'MISMATCHED';

    const cardSettlementStr = params.cardSettlementAmount !== undefined
      ? String(params.cardSettlementAmount)
      : (preview.cardSettlementAmount || (typeof preview.cardSettlement === 'string' ? preview.cardSettlement : (preview.cardSettlement?.settlement_amount || '0.00')));
    const cardDifference = subtractMoney(cardSettlementStr, preview.cardSales);
    const cardStatus = toDecimal(cardDifference).equals(0) ? 'MATCHED' : 'MISMATCHED';

    let dayStatus: 'OPEN' | 'CLOSED' | 'MISMATCHED' = 'CLOSED';
    if (cashStatus !== 'MATCHED' || upiStatus !== 'MATCHED' || cardStatus !== 'MATCHED') {
      dayStatus = 'MISMATCHED';
    }

    const closing = await ReconciliationRepository.saveDailyClosing({
      businessDate: date,
      openingCash: preview.openingCash,
      cashSales: preview.cashSales,
      cashExpenses: preview.cashExpenses,
      expectedClosingCash: preview.expectedClosingCash,
      actualCash: actualCashStr,
      cashDifference,
      cashStatus,
      upiSales: preview.upiSales,
      upiSettlement: upiSettlementStr,
      upiDifference,
      upiStatus,
      cardSales: preview.cardSales,
      cardSettlement: cardSettlementStr,
      cardDifference,
      cardStatus,
      status: dayStatus,
      notes: params.notes,
      closedBy: adminId
    });

    await AuditService.logEvent({
      adminId,
      action: 'DAILY_CLOSING_FINALIZED',
      entityType: 'DAILY_CLOSING',
      entityId: closing.id,
      requestId,
      afterState: closing
    });

    return closing;
  }
}
