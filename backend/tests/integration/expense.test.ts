import { describe, it, expect } from 'vitest';
import { ExpenseService } from '@/modules/expense/expense.service';

describe('Expense Management Integration Tests', () => {
  it('should validate expense categories', async () => {
    await expect(
      ExpenseService.createExpense(
        { category: 'INVALID_CAT', amount: 100, paymentMethod: 'CASH', description: 'Test' },
        'admin-id'
      )
    ).rejects.toThrow('Invalid expense category');
  });

  it('should validate positive expense amount', async () => {
    await expect(
      ExpenseService.createExpense(
        { category: 'LPG', amount: 0, paymentMethod: 'CASH', description: 'Test' },
        'admin-id'
      )
    ).rejects.toThrow('Expense amount must be greater than 0.');
  });
});
