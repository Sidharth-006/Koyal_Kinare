import { BillingRepository } from './billing.repository';
import { MenuRepository } from '../menu/menu.repository';
import { SettingsRepository } from '../settings/settings.repository';
import { AuditService } from '../audit/audit.service';
import { withTransaction } from '@/shared/database/client';
import { calculateTaxExclusive, calculateTaxInclusive, toDecimal, addMoney, multiplyMoney, subtractMoney } from '@/shared/money/decimal';
import { getTodayDateString } from '@/shared/time';
import { ValidationError, NotFoundError, ConflictError } from '@/shared/errors';
import { IdempotencyRepository } from '../audit/idempotency.repository';

export interface CreateBillItemInput {
  menuItemId: string;
  quantity: number;
}

export class BillingService {
  static async completeBill(
    params: {
      orderType: 'DINE_IN' | 'TAKEAWAY';
      tableId?: string | null;
      items: CreateBillItemInput[];
      discount?: number | string;
      paymentMethod: 'CASH' | 'UPI' | 'CARD';
      businessDate?: string;
      idempotencyKey?: string;
    },
    adminId: string,
    requestId?: string
  ) {
    if (!params.items || params.items.length === 0) {
      throw new ValidationError('Bill must contain at least one item.');
    }

    if (params.orderType === 'DINE_IN' && !params.tableId) {
      throw new ValidationError('Table is required for Dine-in orders.');
    }
    if (params.orderType === 'TAKEAWAY' && params.tableId) {
      throw new ValidationError('Takeaway orders must not have a table assigned.');
    }

    if (params.orderType === 'DINE_IN' && params.tableId) {
      const table = await MenuRepository.findTableById(params.tableId);
      if (!table) throw new NotFoundError('Selected table does not exist or is inactive.');
    }

    const businessDate = params.businessDate || getTodayDateString();
    const taxSettings = await SettingsRepository.getTaxSettings();

    // Check idempotency if key supplied
    if (params.idempotencyKey) {
      const existing = await IdempotencyRepository.find(params.idempotencyKey);
      if (existing) {
        const currentHash = IdempotencyRepository.computeHash(params);
        if (existing.request_hash === currentHash) {
          return existing.response_body;
        } else {
          throw new ConflictError('Idempotency key payload mismatch.');
        }
      }
    }

    // Execute atomic bill completion in a single DB transaction
    const result = await withTransaction(async (client) => {
      let rawSubtotal = '0.00';
      const processedLines: any[] = [];

      for (const itemInput of params.items) {
        if (!itemInput.quantity || itemInput.quantity <= 0) {
          throw new ValidationError('Item quantity must be greater than 0.');
        }

        const menuItem = await MenuRepository.findMenuItemById(itemInput.menuItemId);
        if (!menuItem) {
          throw new NotFoundError(`Menu item ${itemInput.menuItemId} not found.`);
        }
        if (menuItem.is_archived) {
          throw new ValidationError(`Menu item "${menuItem.name}" is archived and cannot be added to new bills.`);
        }
        if (!menuItem.is_available) {
          throw new ValidationError(`Menu item "${menuItem.name}" is currently unavailable.`);
        }

        const lineSubtotal = multiplyMoney(menuItem.selling_price, itemInput.quantity);
        rawSubtotal = addMoney(rawSubtotal, lineSubtotal);

        processedLines.push({
          menuItemId: menuItem.id,
          itemName: menuItem.name,
          categoryName: menuItem.category_name || 'General',
          unitPrice: menuItem.selling_price,
          quantity: itemInput.quantity,
          lineDiscount: '0.00',
          taxRate: taxSettings.enabled ? taxSettings.rate : '0.00',
          subtotal: lineSubtotal
        });
      }

      const discountVal = params.discount ? String(params.discount) : '0.00';
      if (toDecimal(discountVal).greaterThan(toDecimal(rawSubtotal))) {
        throw new ValidationError('Discount cannot exceed subtotal.');
      }

      let taxAmount = '0.00';
      let grandTotal = '0.00';

      if (taxSettings.enabled && toDecimal(taxSettings.rate).greaterThan(0)) {
        if (taxSettings.is_inclusive) {
          const calc = calculateTaxInclusive(rawSubtotal, discountVal, taxSettings.rate);
          taxAmount = calc.taxAmount;
          grandTotal = calc.grandTotal;
        } else {
          const calc = calculateTaxExclusive(rawSubtotal, discountVal, taxSettings.rate);
          taxAmount = calc.taxAmount;
          grandTotal = calc.grandTotal;
        }
      } else {
        grandTotal = subtractMoney(rawSubtotal, discountVal);
      }

      const billNumber = await BillingRepository.generateNextBillNumber(client, businessDate);

      const bill = await BillingRepository.createBill(
        {
          billNumber,
          businessDate,
          orderType: params.orderType,
          tableId: params.tableId,
          subtotal: rawSubtotal,
          discount: discountVal,
          tax: taxAmount,
          grandTotal,
          createdBy: adminId
        },
        client
      );

      const createdLines: any[] = [];
      for (const line of processedLines) {
        // Line-level tax portion
        const lineTax = taxSettings.enabled ? multiplyMoney(line.subtotal, toDecimal(taxAmount).dividedBy(rawSubtotal || 1).toString()) : '0.00';
        const lineTotal = addMoney(line.subtotal, lineTax);

        const createdLine = await BillingRepository.createBillLine(
          {
            billId: bill.id,
            menuItemId: line.menuItemId,
            itemName: line.itemName,
            categoryName: line.categoryName,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineDiscount: line.lineDiscount,
            taxRate: line.taxRate,
            subtotal: line.subtotal,
            tax: lineTax,
            total: lineTotal
          },
          client
        );
        createdLines.push(createdLine);
      }

      const payment = await BillingRepository.createPayment(
        {
          billId: bill.id,
          paymentMethod: params.paymentMethod,
          amount: grandTotal
        },
        client
      );

      const fullBill = {
        ...bill,
        lines: createdLines,
        payments: [payment]
      };

      await AuditService.logEvent(
        {
          adminId,
          action: 'BILL_COMPLETED',
          entityType: 'BILL',
          entityId: bill.id,
          requestId,
          afterState: fullBill
        },
        client
      );

      if (params.idempotencyKey) {
        await IdempotencyRepository.save(
          params.idempotencyKey,
          IdempotencyRepository.computeHash(params),
          200,
          fullBill,
          client
        );
      }

      return fullBill;
    });

    return result;
  }

  static async voidBill(billId: string, voidReason: string, adminId: string, requestId?: string) {
    if (!voidReason || voidReason.trim().length === 0) {
      throw new ValidationError('Mandatory void reason is required.');
    }

    const bill = await BillingRepository.findBillById(billId);
    if (!bill) {
      throw new NotFoundError('Bill not found.');
    }

    if (bill.status === 'VOIDED') {
      throw new ValidationError('Bill is already voided.');
    }

    return withTransaction(async (client) => {
      const voidRecord = await BillingRepository.createBillVoid(
        {
          billId,
          voidReason: voidReason.trim(),
          voidedBy: adminId
        },
        client
      );

      const updatedBill = await BillingRepository.findBillById(billId);

      await AuditService.logEvent(
        {
          adminId,
          action: 'BILL_VOIDED',
          entityType: 'BILL',
          entityId: billId,
          requestId,
          beforeState: bill,
          afterState: updatedBill,
          metadata: { voidReason }
        },
        client
      );

      return updatedBill;
    });
  }

  static async getBillById(id: string) {
    const bill = await BillingRepository.findBillById(id);
    if (!bill) throw new NotFoundError('Bill not found.');
    return bill;
  }

  static async listBills(params: any) {
    return BillingRepository.listBills(params);
  }
}
