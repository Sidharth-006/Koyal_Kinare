export interface AdminDTO {
  id: string;
  email: string;
  displayName?: string;
  display_name?: string;
}

export interface BusinessSettingsDTO {
  id: string;
  cafe_name: string;
  cafeName?: string;
  address: string;
  contact_phone?: string;
  phone?: string;
  email?: string;
  currency: string;
  receipt_header?: string;
  receipt_footer?: string;
  receiptFooterText?: string;
  fssai_license?: string;
  fssaiLicense?: string;
  updated_at: string;
  updated_by?: string | null;
}

export interface TargetSettingsDTO {
  id: string;
  daily_sales_target: string | number;
  dailySalesTarget?: string | number;
  monthly_sales_target: string | number;
  monthlySalesTarget?: string | number;
  updated_at: string;
  updated_by?: string | null;
}

export interface TaxSettingsDTO {
  id: string;
  enabled: boolean;
  label: string;
  rate: string | number;
  is_inclusive: boolean;
  isInclusive?: boolean;
  updated_at: string;
  updated_by?: string | null;
}

export interface CategoryDTO {
  id: string;
  name: string;
  display_order: number;
  displayOrder?: number;
  is_archived: boolean;
  isArchived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuItemDTO {
  id: string;
  category_id: string;
  categoryId?: string;
  category_name?: string;
  categoryName?: string;
  name: string;
  selling_price: string | number;
  sellingPrice?: string | number;
  is_available: boolean;
  isAvailable?: boolean;
  is_archived: boolean;
  isArchived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TableDTO {
  id: string;
  table_number: string;
  name?: string;
  capacity: number;
  is_active?: boolean;
  isActive?: boolean;
  created_at: string;
}

export interface CatalogDTO {
  categories: CategoryDTO[];
  items: MenuItemDTO[];
  tables: TableDTO[];
}

export interface BillLineDTO {
  id: string;
  bill_id?: string;
  billId?: string;
  menu_item_id?: string | null;
  menuItemId?: string | null;
  item_name: string;
  itemName?: string;
  category_name?: string;
  categoryName?: string;
  unit_price: string | number;
  unitPrice?: string | number;
  quantity: number;
  line_discount?: string | number;
  tax_rate?: string | number;
  subtotal: string | number;
  tax?: string | number;
  total?: string | number;
}

export interface PaymentDTO {
  id: string;
  bill_id: string;
  payment_method: 'CASH' | 'UPI' | 'CARD';
  paymentMethod?: 'CASH' | 'UPI' | 'CARD';
  amount: string | number;
  status: 'COMPLETED' | 'VOIDED';
  processed_at?: string;
  created_at: string;
}

export interface BillVoidDTO {
  id: string;
  bill_id: string;
  void_reason: string;
  voidReason?: string;
  voided_by: string;
  voidedBy?: string;
  voided_at: string;
  voidedAt?: string;
  created_at: string;
}

export interface BillDTO {
  id: string;
  bill_number: string;
  billNumber?: string;
  business_date: string;
  operatingDate?: string;
  order_type: 'DINE_IN' | 'TAKEAWAY';
  orderType?: 'DINE_IN' | 'TAKEAWAY';
  table_id?: string | null;
  tableId?: string | null;
  table_name?: string | null;
  tableName?: string | null;
  status: 'DRAFT' | 'PAID' | 'COMPLETED' | 'VOIDED';
  subtotal: string | number;
  discount: string | number;
  tax: string | number;
  taxAmount?: string | number;
  taxRate?: string | number;
  grand_total: string | number;
  grandTotal?: string | number;
  completed_at?: string;
  created_at: string;
  createdAt?: string;
  created_by?: string;
  lines?: BillLineDTO[];
  items?: BillLineDTO[];
  payments?: PaymentDTO[];
  paymentMethod?: 'CASH' | 'UPI' | 'CARD';
  void_record?: BillVoidDTO | null;
  voidReason?: string | null;
  voidedAt?: string | null;
}

export interface ExpenseDTO {
  id: string;
  business_date: string;
  businessDate?: string;
  category: string;
  amount: string | number;
  payment_method: 'CASH' | 'UPI' | 'CARD';
  paymentMethod?: 'CASH' | 'UPI' | 'CARD';
  description: string;
  attachment_id?: string | null;
  is_voided?: boolean;
  status?: 'PAID' | 'VOIDED';
  void_reason?: string | null;
  voidReason?: string | null;
  voided_by?: string | null;
  voided_at?: string | null;
  created_by?: string;
  updated_by?: string | null;
  created_at: string;
  createdAt?: string;
  updated_at?: string;
}

export interface CashOpeningDTO {
  id: string;
  business_date: string;
  opening_cash: string | number;
  openingCash?: string | number;
  set_by: string;
  set_at: string;
  created_at: string;
}

export interface DailyClosingDTO {
  id: string;
  business_date: string;
  opening_cash: string | number;
  cash_sales: string | number;
  cash_expenses: string | number;
  expected_closing_cash: string | number;
  actual_cash: string | number;
  cash_difference: string | number;
  cash_status: 'MATCHED' | 'SHORTAGE' | 'EXCESS';
  upi_sales: string | number;
  upi_settlement: string | number;
  upi_difference: string | number;
  upi_status: 'MATCHED' | 'MISMATCHED';
  card_sales: string | number;
  card_settlement: string | number;
  card_difference: string | number;
  card_status: 'MATCHED' | 'MISMATCHED';
  status: 'OPEN' | 'CLOSED' | 'MISMATCHED';
  isClosed?: boolean;
  notes?: string | null;
  closed_by?: string;
  closed_at?: string;
  created_at?: string;
}

export interface SettlementDTO {
  id: string;
  business_date: string;
  method: 'UPI' | 'CARD';
  expected_amount: string | number;
  settlement_amount: string | number;
  difference: string | number;
  status: 'MATCHED' | 'MISMATCHED';
  notes?: string | null;
  settled_by?: string;
  settled_at?: string;
  created_at?: string;
}

export interface DashboardMetricsDTO {
  operatingDate: string;
  todayCompletedSales: string;
  dailyTarget: string;
  dailyProgressPercent: number;
  dailyRemaining: string;
  completedBillCount: number;
  averageBillValue: string;
  cashSales: string;
  upiSales: string;
  cardSales: string;
  todayExpenses: string;
  estimatedProfit: string;
  monthlySales: string;
  monthlyTarget: string;
  monthlyProgressPercent: number;
  isEstimate: boolean;
  profitDisclaimer: string;
}

export interface SalesMetricsDTO {
  startDate: string;
  endDate: string;
  billCount: number;
  totalSales: string;
  totalSubtotal: string;
  totalDiscount: string;
  totalTax: string;
  averageOrderValue: string;
  paymentSplits: {
    CASH: string;
    UPI: string;
    CARD: string;
  };
  totalExpenses: string;
  estimatedNetProfit: string;
  isEstimate: boolean;
  itemBreakdown: Array<{
    item_name: string;
    category_name: string;
    total_quantity: string | number;
    total_revenue: string;
  }>;
  categoryBreakdown: Array<{
    category_name: string;
    total_quantity: string | number;
    total_revenue: string;
  }>;
  summary?: {
    totalRevenue: string | number;
    totalBills: number;
    averageBillValue: string | number;
    voidedBillsCount: number;
    voidedBillsAmount: string | number;
  };
  paymentBreakdown?: {
    cash: string | number;
    upi: string | number;
    card: string | number;
  };
  itemPerformance?: Array<{
    itemName: string;
    totalQuantity: number;
    totalRevenue: string | number;
  }>;
  categoryPerformance?: Array<{
    categoryName: string;
    totalQuantity: number;
    totalRevenue: string | number;
  }>;
}

export interface ExportResultDTO {
  job?: any;
  metadata?: {
    cafeName: string;
    reportTitle: string;
    appliedDateRange: string;
    generatedAt: string;
    format: 'EXCEL' | 'PDF';
  };
  reportData?: any;
  contentBuffer: string;
  mimeType: string;
}
