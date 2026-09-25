import {
  AdminDTO, CatalogDTO, BillDTO, CategoryDTO, MenuItemDTO, TableDTO,
  ExpenseDTO, CashOpeningDTO, DailyClosingDTO, SettlementDTO,
  DashboardMetricsDTO, SalesMetricsDTO, ExportResultDTO, BusinessSettingsDTO,
  TargetSettingsDTO, TaxSettingsDTO, InventoryItemDTO, InventoryListResultDTO,
  SupplierDTO, SupplierListResultDTO, SupplierPurchaseSummaryDTO,
  CreateSupplierPayload, UpdateSupplierPayload, SupplierListParams
} from './types';

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly requestId?: string;

  constructor(message: string, code: string = 'INTERNAL_ERROR', statusCode: number = 500, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include'
  };

  const response = await fetch(endpoint, config);
  const data = await response.json().catch(() => ({}));

  const SAFE_ERROR_MAPPINGS: Record<string, string> = {
    VALIDATION_ERROR: 'Please review the highlighted fields.',
    DAY_ALREADY_CLOSED: 'This day is already closed. Reopen it before changing these details.',
    BILL_ALREADY_VOIDED: 'This bill has already been voided.',
    CONFLICT: 'This record changed elsewhere. Refresh and try again.',
    RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
    INTERNAL_ERROR: 'Something went wrong. Please try again.',
    UNAUTHORIZED: 'Sign-in details are incorrect. Please try again.',
    DUPLICATE_INVENTORY_ITEM: 'An active inventory item already uses this name.',
    ITEM_HAS_STOCK_HISTORY: 'Base unit cannot change after stock activity has started.',
    ITEM_IN_USE: 'Cannot archive inventory item that is in use by pending purchases or operations.',
    DUPLICATE_SUPPLIER: 'An active supplier already uses this name.'
  };

  if (!response.ok) {
    const errorObj = data.error || {};
    const code = errorObj.code || (response.status === 401 ? 'UNAUTHORIZED' : 'UNKNOWN_ERROR');
    const safeMessage = SAFE_ERROR_MAPPINGS[code] || errorObj.message || 'An unexpected error occurred. Please try again.';
    throw new ApiError(safeMessage, code, response.status, data.requestId);
  }

  return data.data as T;
}

export const api = {
  // Auth
  login: (payload: { email?: string; password?: string }) =>
    request<{ admin: AdminDTO }>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () =>
    request<{ message: string }>('/api/auth/logout', { method: 'POST' }),
  me: () =>
    request<{ admin: AdminDTO }>('/api/auth/me'),

  // Settings
  getSettings: () =>
    request<{ settings: { business: BusinessSettingsDTO; targets: TargetSettingsDTO; tax: TaxSettingsDTO } }>('/api/settings'),
  updateBusinessSettings: (payload: Partial<BusinessSettingsDTO>) =>
    request<{ settings: BusinessSettingsDTO }>('/api/settings/business', { method: 'PUT', body: JSON.stringify(payload) }),
  updateTargetSettings: (payload: { dailySalesTarget: number | string; monthlySalesTarget: number | string }) =>
    request<{ targets: TargetSettingsDTO }>('/api/settings/targets', { method: 'PUT', body: JSON.stringify(payload) }),
  updateTaxSettings: (payload: { enabled: boolean; label: string; rate: number | string; isInclusive: boolean }) =>
    request<{ tax: TaxSettingsDTO }>('/api/settings/tax', { method: 'PUT', body: JSON.stringify(payload) }),

  // Menu & Tables
  listCategories: (includeArchived = false) =>
    request<{ categories: CategoryDTO[] }>(`/api/menu/categories?includeArchived=${includeArchived}`),
  createCategory: (name: string, displayOrder = 0) =>
    request<{ category: CategoryDTO }>('/api/menu/categories', { method: 'POST', body: JSON.stringify({ name, displayOrder }) }),
  archiveCategory: (id: string) =>
    request<{ category: CategoryDTO }>(`/api/menu/categories/${id}`, { method: 'DELETE' }),
  restoreCategory: (id: string) =>
    request<{ category: CategoryDTO }>(`/api/menu/categories/${id}/restore`, { method: 'POST' }),

  listMenuItems: (includeArchived = false) =>
    request<{ items: MenuItemDTO[] }>(`/api/menu/items?includeArchived=${includeArchived}`),
  createMenuItem: (payload: { categoryId: string; name: string; sellingPrice: number | string }) =>
    request<{ item: MenuItemDTO }>('/api/menu/items', { method: 'POST', body: JSON.stringify(payload) }),
  toggleMenuItemAvailability: (id: string, isAvailable: boolean) =>
    request<{ item: MenuItemDTO }>(`/api/menu/items/${id}`, { method: 'PATCH', body: JSON.stringify({ isAvailable }) }),
  archiveMenuItem: (id: string) =>
    request<{ item: MenuItemDTO }>(`/api/menu/items/${id}`, { method: 'DELETE' }),
  restoreMenuItem: (id: string) =>
    request<{ item: MenuItemDTO }>(`/api/menu/items/${id}/restore`, { method: 'POST' }),

  listTables: () =>
    request<{ tables: TableDTO[] }>('/api/tables'),

  // POS & Billing
  getCatalog: () =>
    request<{ catalog: CatalogDTO }>('/api/pos/catalog'),
  completeBill: (payload: { orderType: 'DINE_IN' | 'TAKEAWAY'; tableId?: string | null; items: Array<{ menuItemId: string; quantity: number }>; discount?: number | string; paymentMethod: 'CASH' | 'UPI' | 'CARD' }, idempotencyKey?: string) =>
    request<{ bill: BillDTO }>('/api/pos/bills/complete', { method: 'POST', body: JSON.stringify(payload) }, idempotencyKey),
  getBillById: (id: string) =>
    request<{ bill: BillDTO }>(`/api/bills/${id}`),
  listBills: (params: { startDate?: string; endDate?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.status) searchParams.set('status', params.status);
    const queryStr = searchParams.toString();
    return request<{ bills: BillDTO[] }>(`/api/pos/bills${queryStr ? `?${queryStr}` : ''}`);
  },
  voidBill: (id: string, voidReason: string) =>
    request<{ bill: BillDTO }>(`/api/bills/${id}/void`, { method: 'POST', body: JSON.stringify({ voidReason }) }),

  // Expenses
  listExpenses: (params: { startDate?: string; endDate?: string; category?: string; paymentMethod?: string; includeVoided?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.category) searchParams.set('category', params.category);
    if (params.paymentMethod) searchParams.set('paymentMethod', params.paymentMethod);
    if (params.includeVoided !== undefined) searchParams.set('includeVoided', params.includeVoided.toString());
    const queryStr = searchParams.toString();
    return request<{ expenses: ExpenseDTO[] }>(`/api/expenses${queryStr ? `?${queryStr}` : ''}`);
  },
  createExpense: (payload: { businessDate?: string; category: string; amount: number | string; paymentMethod: 'CASH' | 'UPI' | 'CARD'; description: string }) =>
    request<{ expense: ExpenseDTO }>('/api/expenses', { method: 'POST', body: JSON.stringify(payload) }),
  voidExpense: (id: string, voidReason: string) =>
    request<{ expense: ExpenseDTO }>(`/api/expenses/${id}/void`, { method: 'POST', body: JSON.stringify({ voidReason }) }),

  // Reconciliation
  setOpeningCash: (payload: { businessDate?: string; openingCash: number | string }) =>
    request<{ opening: CashOpeningDTO }>('/api/reconciliation/cash-opening', { method: 'POST', body: JSON.stringify(payload) }),
  getReconciliationPreview: (businessDate?: string) =>
    request<{ reconciliation: any }>(`/api/reconciliation/daily-closing?businessDate=${businessDate || ''}`),
  recordSettlement: (payload: { businessDate?: string; method: 'UPI' | 'CARD'; settlementAmount: number | string; notes?: string }) =>
    request<{ settlement: SettlementDTO }>('/api/reconciliation/settlement', { method: 'POST', body: JSON.stringify(payload) }),
  finalizeDailyClosing: (payload: { businessDate?: string; actualCash: number | string; upiSettlementAmount?: number | string; cardSettlementAmount?: number | string; notes?: string }) =>
    request<{ closing: DailyClosingDTO }>('/api/reconciliation/daily-closing', { method: 'POST', body: JSON.stringify(payload) }),

  // Dashboard & Sales
  getDashboardMetrics: (date?: string) =>
    request<{ metrics: DashboardMetricsDTO }>(`/api/dashboard?date=${date || ''}`),
  getSalesMetrics: (startDate: string, endDate: string) =>
    request<{ sales: SalesMetricsDTO }>(`/api/sales?startDate=${startDate}&endDate=${endDate}`),

  // Reports
  exportReport: (payload: { reportType: string; startDate: string; endDate: string; fileFormat: 'EXCEL' | 'PDF' }) =>
    request<ExportResultDTO>('/api/reports/export', { method: 'POST', body: JSON.stringify(payload) }),

  // Inventory Master
  listInventoryItems: (params: { search?: string; type?: string; status?: string; page?: number; pageSize?: number }) => {
    const cleanParams: Record<string, string> = {};
    if (params.search) cleanParams.search = params.search;
    if (params.type) cleanParams.type = params.type;
    if (params.status) cleanParams.status = params.status;
    if (params.page) cleanParams.page = String(params.page);
    if (params.pageSize) cleanParams.pageSize = String(params.pageSize);
    const queryStr = new URLSearchParams(cleanParams).toString();
    return request<InventoryListResultDTO>(`/api/inventory/items?${queryStr}`);
  },
  getInventoryItemById: (id: string) =>
    request<{ item: InventoryItemDTO }>(`/api/inventory/items/${id}`),
  createInventoryItem: (
    payload: { name: string; itemType: string; baseUnit: string; minimumStock: number | string; description?: string },
    idempotencyKey?: string
  ) =>
    request<{ item: InventoryItemDTO }>('/api/inventory/items', { method: 'POST', body: JSON.stringify(payload) }, idempotencyKey),
  updateInventoryItem: (
    id: string,
    payload: { name?: string; itemType?: string; baseUnit?: string; minimumStock?: number | string; description?: string },
    idempotencyKey?: string
  ) =>
    request<{ item: InventoryItemDTO }>(`/api/inventory/items/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, idempotencyKey),
  archiveInventoryItem: (id: string, idempotencyKey?: string) =>
    request<{ item: InventoryItemDTO }>(`/api/inventory/items/${id}/archive`, { method: 'POST' }, idempotencyKey),
  restoreInventoryItem: (id: string, idempotencyKey?: string) =>
    request<{ item: InventoryItemDTO }>(`/api/inventory/items/${id}/restore`, { method: 'POST' }, idempotencyKey),

  // Supplier Management
  listSuppliers: (params?: SupplierListParams) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const queryStr = query.toString();
    return request<SupplierListResultDTO>(`/api/suppliers${queryStr ? `?${queryStr}` : ''}`);
  },
  getSupplierById: (id: string) =>
    request<{ supplier: SupplierDTO }>(`/api/suppliers/${id}`),
  createSupplier: (payload: CreateSupplierPayload, idempotencyKey?: string) =>
    request<{ supplier: SupplierDTO }>('/api/suppliers', { method: 'POST', body: JSON.stringify(payload) }, idempotencyKey),
  updateSupplier: (id: string, payload: UpdateSupplierPayload, idempotencyKey?: string) =>
    request<{ supplier: SupplierDTO }>(`/api/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, idempotencyKey),
  archiveSupplier: (id: string, idempotencyKey?: string) =>
    request<{ supplier: SupplierDTO }>(`/api/suppliers/${id}/archive`, { method: 'POST' }, idempotencyKey),
  restoreSupplier: (id: string, idempotencyKey?: string) =>
    request<{ supplier: SupplierDTO }>(`/api/suppliers/${id}/restore`, { method: 'POST' }, idempotencyKey),
  getSupplierPurchaseSummary: (id: string, params?: { from?: string; to?: string; page?: number | string; pageSize?: number | string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const queryStr = query.toString();
    return request<SupplierPurchaseSummaryDTO>(`/api/suppliers/${id}/purchase-summary${queryStr ? `?${queryStr}` : ''}`);
  }
};

export function downloadExportFile(exportData: ExportResultDTO, filename: string) {
  const binaryString = atob(exportData.contentBuffer || '');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes.buffer], { type: exportData.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
