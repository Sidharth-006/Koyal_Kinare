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
      upiSales,
      upiSettlementRecord,
      cardSales,
      cardSettlementRecord,
      closingRecord
    ] = await Promise.all([
      ReconciliationRepository.getOpeningCash(date),
      ReconciliationRepository.getCompletedPaymentsByMethod(date, 'CASH'),
      ReconciliationRepository.getActiveExpensesByMethod(date, 'CASH'),
      ReconciliationRepository.getCompletedPaymentsByMethod(date, 'UPI'),
      ReconciliationRepository.getSettlement(date, 'UPI'),
      ReconciliationRepository.getCompletedPaymentsByMethod(date, 'CARD'),
      ReconciliationRepository.getSettlement(date, 'CARD'),
      ReconciliationRepository.getDailyClosing(date)
    ]);

    const openingCash = openingRecord ? openingRecord.opening_cash : '0.00';
    const expectedClosingCash = subtractMoney(addMoney(openingCash, cashSales), cashExpenses);

    const upiSettlement = upiSettlementRecord ? upiSettlementRecord.settlement_amount : '0.00';
    const upiDifference = subtractMoney(upiSettlement, upiSales);

    const cardSettlement = cardSettlementRecord ? cardSettlementRecord.settlement_amount : '0.00';
    const cardDifference = subtractMoney(cardSettlement, cardSales);

    return {
      businessDate: date,
      openingCash,
      cashSales,
      cashExpenses,
      expectedClosingCash,
      upiSales,
      upiSettlement,
      upiDifference,
      cardSales,
      cardSettlement,
      cardDifference,
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

    const upiSettlementStr = params.upiSettlementAmount !== undefined ? String(params.upiSettlementAmount) : preview.upiSettlement;
    const upiDifference = subtractMoney(upiSettlementStr, preview.upiSales);
    const upiStatus = toDecimal(upiDifference).equals(0) ? 'MATCHED' : 'MISMATCHED';

    const cardSettlementStr = params.cardSettlementAmount !== undefined ? String(params.cardSettlementAmount) : preview.cardSettlement;
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
