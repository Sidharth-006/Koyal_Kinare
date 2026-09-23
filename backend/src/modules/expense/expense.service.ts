import { ExpenseRepository } from './expense.repository';
import { AuditService } from '../audit/audit.service';
import { getTodayDateString } from '@/shared/time';
import { ValidationError, NotFoundError } from '@/shared/errors';

const VALID_CATEGORIES = [
  'RAW_MATERIALS', 'LPG', 'ELECTRICITY', 'SALARY', 'PACKAGING', 'MAINTENANCE', 'MISCELLANEOUS'
];

export class ExpenseService {
  static async createAttachment(params: {
    storageKey: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }, adminId: string) {
    if (!params.storageKey || !params.fileName) {
      throw new ValidationError('Storage key and file name are required.');
    }
    return ExpenseRepository.createAttachment({ ...params, uploadedBy: adminId });
  }

  static async createExpense(params: {
    businessDate?: string;
    category: string;
    amount: number | string;
    paymentMethod: 'CASH' | 'UPI' | 'CARD';
    description: string;
    attachmentId?: string | null;
  }, adminId: string, requestId?: string) {
    if (!params.category || !VALID_CATEGORIES.includes(params.category)) {
      throw new ValidationError(`Invalid expense category. Allowed: ${VALID_CATEGORIES.join(', ')}`);
    }
    if (!params.amount || Number(params.amount) <= 0) {
      throw new ValidationError('Expense amount must be greater than 0.');
    }
    if (!params.paymentMethod || !['CASH', 'UPI', 'CARD'].includes(params.paymentMethod)) {
      throw new ValidationError('Invalid payment method.');
    }

    const businessDate = params.businessDate || getTodayDateString();

    const expense = await ExpenseRepository.createExpense({
      businessDate,
      category: params.category,
      amount: String(params.amount),
      paymentMethod: params.paymentMethod,
      description: params.description || '',
      attachmentId: params.attachmentId,
      createdBy: adminId
    });

    await AuditService.logEvent({
      adminId,
      action: 'EXPENSE_CREATED',
      entityType: 'EXPENSE',
      entityId: expense.id,
      requestId,
      afterState: expense
    });

    return expense;
  }

  static async voidExpense(id: string, voidReason: string, adminId: string, requestId?: string) {
    if (!voidReason || voidReason.trim().length === 0) {
      throw new ValidationError('Void reason is required.');
    }

    const existing = await ExpenseRepository.findExpenseById(id);
    if (!existing) throw new NotFoundError('Expense not found.');
    if (existing.is_voided) throw new ValidationError('Expense is already voided.');

    const voided = await ExpenseRepository.voidExpense(id, voidReason.trim(), adminId);

    await AuditService.logEvent({
      adminId,
      action: 'EXPENSE_VOIDED',
      entityType: 'EXPENSE',
      entityId: id,
      requestId,
      beforeState: existing,
      afterState: voided,
      metadata: { voidReason }
    });

    return voided;
  }

  static async listExpenses(params: any) {
    return ExpenseRepository.listExpenses(params);
  }

  static async getExpenseById(id: string) {
    const expense = await ExpenseRepository.findExpenseById(id);
    if (!expense) throw new NotFoundError('Expense not found.');
    return expense;
  }
}
