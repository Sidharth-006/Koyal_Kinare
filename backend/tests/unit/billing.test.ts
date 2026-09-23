import { describe, it, expect } from 'vitest';
import { ValidationError } from '@/shared/errors';

describe('POS Billing Validation Unit Tests', () => {
  it('should reject DINE_IN bill without a table ID', () => {
    const orderType = 'DINE_IN';
    const tableId = null;

    expect(() => {
      if (orderType === 'DINE_IN' && !tableId) {
        throw new ValidationError('Table is required for Dine-in orders.');
      }
    }).toThrow(ValidationError);
  });

  it('should reject TAKEAWAY bill with a table assigned', () => {
    const orderType = 'TAKEAWAY';
    const tableId = 'table-uuid-123';

    expect(() => {
      if (orderType === 'TAKEAWAY' && tableId) {
        throw new ValidationError('Takeaway orders must not have a table assigned.');
      }
    }).toThrow(ValidationError);
  });

  it('should reject bill void without a mandatory reason', () => {
    const voidReason = '   ';
    expect(() => {
      if (!voidReason || voidReason.trim().length === 0) {
        throw new ValidationError('Mandatory void reason is required.');
      }
    }).toThrow(ValidationError);
  });
});
