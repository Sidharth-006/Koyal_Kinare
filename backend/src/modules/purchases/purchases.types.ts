export type PurchaseStatus = 'DRAFT' | 'RECEIVED' | 'REVERSED';

export type PurchasePaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'CREDIT';

export interface PurchaseLine {
  id: string;
  purchase_id: string;
  purchaseId?: string;
  inventory_item_id: string;
  inventoryItemId?: string;
  item_name: string;
  itemName?: string;
  unit: string;
  quantity: string;
  unit_rate: string;
  unitRate?: string;
  line_discount: string;
  lineDiscount?: string;
  tax_rate: string;
  taxRate?: string;
  line_total: string;
  lineTotal?: string;
  created_at: string | Date;
  createdAt?: string | Date;
}

export interface PurchaseReversal {
  id: string;
  purchase_id: string;
  purchaseId?: string;
  reason: string;
  reversed_by: string;
  reversedBy?: string;
  reversed_at: string | Date;
  reversedAt?: string | Date;
}

export interface Purchase {
  id: string;
  purchase_number: string;
  purchaseNumber?: string;
  supplier_id: string | null;
  supplierId?: string | null;
  supplier_name: string;
  supplierName?: string;
  invoice_number: string | null;
  invoiceNumber?: string | null;
  purchase_date: string;
  purchaseDate?: string;
  payment_method: PurchasePaymentMethod;
  paymentMethod?: PurchasePaymentMethod;
  discount: string;
  tax_amount: string;
  taxAmount?: string;
  grand_total: string;
  grandTotal?: string;
  status: PurchaseStatus;
  received_at: string | Date | null;
  receivedAt?: string | Date | null;
  attachment_id: string | null;
  attachmentId?: string | null;
  note: string | null;
  created_by: string;
  createdBy?: string;
  created_at: string | Date;
  createdAt?: string | Date;
  updated_at: string | Date;
  updatedAt?: string | Date;
  lines?: PurchaseLine[];
  reversal?: PurchaseReversal | null;
}

export interface PurchaseLineInput {
  inventoryItemId: string;
  quantity: number | string;
  unitRate: number | string;
  lineDiscount?: number | string;
  taxRate?: number | string;
}

export interface CreatePurchaseDraftInput {
  supplierId?: string | null;
  adhocSupplierName?: string | null;
  invoiceNumber?: string | null;
  purchaseDate: string;
  paymentMethod: PurchasePaymentMethod;
  discount?: number | string;
  taxAmount?: number | string;
  note?: string | null;
  lines: PurchaseLineInput[];
}

export interface UpdatePurchaseDraftInput {
  supplierId?: string | null;
  adhocSupplierName?: string | null;
  invoiceNumber?: string | null;
  purchaseDate?: string;
  paymentMethod?: PurchasePaymentMethod;
  discount?: number | string;
  taxAmount?: number | string;
  note?: string | null;
  lines?: PurchaseLineInput[];
}
