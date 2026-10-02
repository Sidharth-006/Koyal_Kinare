import {
  AdminDTO, CatalogDTO, BillDTO, CategoryDTO, MenuItemDTO, TableDTO,
  ExpenseDTO, CashOpeningDTO, DailyClosingDTO, SettlementDTO,
  DashboardMetricsDTO, SalesMetricsDTO, ExportResultDTO, BusinessSettingsDTO,
  TargetSettingsDTO, TaxSettingsDTO, InventoryItemDTO, InventoryListResultDTO,
  SupplierDTO, SupplierListResultDTO, SupplierPurchaseSummaryDTO,
  CreateSupplierPayload, UpdateSupplierPayload, SupplierListParams,
  PurchaseDTO, PurchaseListResultDTO, PurchaseListParams,
  CreatePurchaseDraftPayload, UpdatePurchaseDraftPayload, PurchaseAttachmentDTO,
  StockMovementDTO, ItemStockSummaryDTO, StockCountDTO, StockMovementListParams,
  StockMovementListResultDTO, RecordOpeningStockPayload, RecordAdjustmentPayload,
  RecordStockCountPayload, RecordOpeningStockResultDTO, RecordAdjustmentResultDTO,
  RecordStockCountResultDTO, InventoryOverviewDTO, LowStockItemDTO, LowStockListResultDTO,
  AcknowledgeAlertPayload, Phase2ProfitabilityDTO, InventoryStockReportParams,
  StockMovementsReportParams, PurchasesReportParams, SupplierSummaryReportParams,
  WastageReportParams, Phase2ProfitabilityReportParams,
  StaffDTO, CreateStaffPayload, UpdateStaffPayload, StaffListParams,
  AttendanceStatus, AttendanceRecordDTO, DailyAttendanceRosterItemDTO,
  SaveAttendancePayload, BulkSaveAttendancePayload, BulkSaveAttendanceResultDTO,
  AttendanceSummaryResponseDTO, AttendanceReportParams
} from './types';

/** Base URL for all API requests. Dynamically resolves from NEXT_PUBLIC_API_URL or environment host. */
export function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return 'https://koyal-kinare.onrender.com';
    }
  }
  return 'http://localhost:3000';
}

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

  if (typeof window !== 'undefined') {
    const savedToken = localStorage.getItem('koyal_token');
    if (savedToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include'
  };

  const SAFE_ERROR_MAPPINGS: Record<string, string> = {
    VALIDATION_ERROR: 'Please review the highlighted fields.',
    DAY_ALREADY_CLOSED: 'This day is already closed. Reopen it before changing these details.',
    BILL_ALREADY_VOIDED: 'This bill has already been voided.',
    CONFLICT: 'This record changed elsewhere. Refresh and try again.',
    RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
    INTERNAL_ERROR: 'Something went wrong. Please try again.',
    UNAUTHORIZED: 'Sign-in details are incorrect. Please try again.',
    SERVER_UNAVAILABLE: 'The server is currently starting up or temporarily unavailable. Please try again in a few moments.',
    NETWORK_ERROR: 'Unable to connect to the server. Please check your network connection and try again.',
    TIMEOUT_ERROR: 'Request timed out while connecting to the server. Please try again.',
    DUPLICATE_INVENTORY_ITEM: 'An active inventory item already uses this name.',
    ITEM_HAS_STOCK_HISTORY: 'Base unit cannot change after stock activity has started.',
    ITEM_IN_USE: 'Cannot archive inventory item that is in use by pending purchases or operations.',
    DUPLICATE_SUPPLIER: 'An active supplier already uses this name.',
    PURCHASE_ALREADY_RECEIVED: 'This purchase has already been received.',
    PURCHASE_NOT_RECEIVABLE: 'Purchase cannot be received in its current status.',
    PURCHASE_NOT_EDITABLE: 'Only draft purchases can be edited.',
    PURCHASE_ALREADY_REVERSED: 'This purchase has already been reversed.',
    PURCHASE_NOT_REVERSIBLE: 'Only received purchases can be reversed.',
    SUPPLIER_INACTIVE: 'Selected supplier is inactive or archived.',
    INVENTORY_ITEM_ARCHIVED: 'One or more selected inventory items are archived.',
    INSUFFICIENT_STOCK: 'This change would make stock negative. Review the current quantity.',
    DUPLICATE_OPENING_STOCK: 'Opening stock has already been recorded for this item on the selected date.',
    DUPLICATE_MOVEMENT: 'A stock movement for this source reference has already been recorded.',
    IDEMPOTENCY_KEY_REUSED: 'This request was already submitted. Please refresh and check current state.',
    STAFF_ARCHIVED: 'Cannot record attendance for a staff member who was archived before this date.',
    ATTENDANCE_TIME_INVALID: 'Check-in and check-out times must be valid and check-out must be after check-in.',
    ATTENDANCE_CONFLICT: 'Attendance record was updated on another device. Please refresh.',
    INVALID_ATTENDANCE_STATUS: 'Please provide a valid attendance status.',
    REPORT_TOO_LARGE: 'Attendance report date range cannot exceed 366 days.'
  };

  const apiBase = getApiBase();
  const url = endpoint.startsWith('/') ? `${apiBase}${endpoint}` : endpoint;

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (fetchErr: any) {
    if (fetchErr?.name === 'AbortError') {
      throw new ApiError('Request timed out while connecting to the server.', 'TIMEOUT_ERROR', 408);
    }
    throw new ApiError(
      'Unable to connect to the server. Please check your network connection and try again.',
      'NETWORK_ERROR',
      0
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorObj = data.error || {};
    let code = errorObj.code;
    if (!code) {
      if (response.status === 401) {
        code = 'UNAUTHORIZED';
      } else if (response.status === 502 || response.status === 503 || response.status === 504) {
        code = 'SERVER_UNAVAILABLE';
      } else {
        code = 'UNKNOWN_ERROR';
      }
    }
    const safeMessage = (code === 'VALIDATION_ERROR' && errorObj.message)
      ? errorObj.message
      : (SAFE_ERROR_MAPPINGS[code] || errorObj.message || 'An unexpected error occurred. Please try again.');
    throw new ApiError(safeMessage, code, response.status, data.requestId);
  }

  return data.data as T;
}

export interface LoginOptions {
  onRetry?: (status: string, attempt: number) => void;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export const api = {
  // Wake-up ping for Render cold start
  wakeUp: async () => {
    const apiBase = getApiBase();
    for (let i = 0; i < 3; i++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`${apiBase}/api/health`, {
          credentials: 'include',
          signal: controller.signal
        });
        clearTimeout(timer);
        if (res.ok) return;
      } catch {
        // Ignore and retry on transient cold start error
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  },

  // Auth
  login: async (
    payload: { email?: string; password?: string },
    options?: LoginOptions
  ): Promise<{ admin: AdminDTO }> => {
    const maxRetries = options?.maxRetries ?? 5;
    let delay = options?.retryDelayMs ?? 1500;
    const timeoutMs = options?.timeoutMs ?? 12000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const result = await request<{ admin: AdminDTO; token?: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (result.token && typeof window !== 'undefined') {
          localStorage.setItem('koyal_token', result.token);
        }
        return result;
      } catch (err: any) {
        clearTimeout(timer);

        // Genuine auth/validation client errors (401, 400, 422) must NEVER be retried
        const isClientAuthError =
          err instanceof ApiError &&
          err.statusCode >= 400 &&
          err.statusCode < 500 &&
          err.statusCode !== 408;

        if (isClientAuthError) {
          throw err;
        }

        // Transient errors caused by Render cold start: network failure, abort/timeout, or 5xx (502, 503, 504)
        const isTransient =
          err instanceof ApiError
            ? err.statusCode === 0 || err.statusCode === 408 || err.statusCode >= 500 || err.code === 'NETWORK_ERROR' || err.code === 'SERVER_UNAVAILABLE'
            : true;

        if (!isTransient || attempt >= maxRetries) {
          if (err instanceof ApiError && (err.statusCode >= 500 || err.statusCode === 0 || err.statusCode === 408)) {
            throw new ApiError(
              'The server is taking longer than expected to respond. Please try again in a few moments.',
              'SERVER_UNAVAILABLE',
              err.statusCode || 503
            );
          }
          throw err;
        }

        // Notify UI of cold start waking state
        if (options?.onRetry) {
          options.onRetry('Connecting to server...', attempt);
        }

        // Backoff delay before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay + 1000, 5000);
      }
    }

    throw new ApiError(
      'The server is taking longer than expected to respond. Please try again in a few moments.',
      'SERVER_UNAVAILABLE',
      503
    );
  },
  logout: async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('koyal_token');
    }
    return request<{ message: string }>('/api/auth/logout', { method: 'POST' });
  },
  me: async () => {
    try {
      return await request<{ admin: AdminDTO }>('/api/auth/me');
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('koyal_token');
      }
      throw err;
    }
  },

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
    request<{ reconciliation: any }>(`/api/reconciliation/daily-closing?businessDate=${businessDate || ''}`, { cache: 'no-store' }),
  recordSettlement: (payload: { businessDate?: string; method: 'UPI' | 'CARD'; settlementAmount: number | string; notes?: string }) =>
    request<{ settlement: SettlementDTO }>('/api/reconciliation/settlement', { method: 'POST', body: JSON.stringify(payload) }),
  finalizeDailyClosing: (payload: { businessDate?: string; actualCash: number | string; upiSettlementAmount?: number | string; cardSettlementAmount?: number | string; notes?: string }) =>
    request<{ closing: DailyClosingDTO }>('/api/reconciliation/daily-closing', { method: 'POST', body: JSON.stringify(payload) }),

  // Dashboard & Sales
  getDashboardMetrics: (date?: string) =>
    request<{ metrics: DashboardMetricsDTO }>(`/api/dashboard?date=${date || ''}`, { cache: 'no-store' }),
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
  },

  // Module 3: Purchase Management
  listPurchases: (params?: PurchaseListParams) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.supplierId) query.set('supplierId', params.supplierId);
    if (params?.inventoryItemId) query.set('inventoryItemId', params.inventoryItemId);
    if (params?.paymentMethod) query.set('paymentMethod', params.paymentMethod);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const queryStr = query.toString();
    return request<PurchaseListResultDTO>(`/api/purchases${queryStr ? `?${queryStr}` : ''}`);
  },
  getPurchaseById: (id: string) =>
    request<{ purchase: PurchaseDTO }>(`/api/purchases/${id}`),
  createPurchaseDraft: (payload: CreatePurchaseDraftPayload) =>
    request<{ purchase: PurchaseDTO }>('/api/purchases', { method: 'POST', body: JSON.stringify(payload) }),
  updatePurchaseDraft: (id: string, payload: UpdatePurchaseDraftPayload) =>
    request<{ purchase: PurchaseDTO }>(`/api/purchases/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  receivePurchase: (id: string, idempotencyKey: string) =>
    request<{ purchase: PurchaseDTO }>(`/api/purchases/${id}/receive`, { method: 'POST' }, idempotencyKey),
  reversePurchase: (id: string, reason: string, idempotencyKey: string) =>
    request<{ purchase: PurchaseDTO }>(`/api/purchases/${id}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) }, idempotencyKey),
  uploadPurchaseAttachment: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${getApiBase()}/api/purchases/${id}/attachment`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorObj = data.error || {};
      const message = errorObj.message || 'Failed to upload attachment.';
      throw new ApiError(message, errorObj.code || 'UPLOAD_FAILED', response.status, data.requestId);
    }
    return data.data as { attachment: PurchaseAttachmentDTO; purchaseId: string };
  },
  downloadPurchaseAttachment: async (id: string, fallbackFileName?: string) => {
    const response = await fetch(`${getApiBase()}/api/purchases/${id}/attachment`, {
      method: 'GET',
      credentials: 'include'
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const errorObj = data.error || {};
      throw new ApiError(errorObj.message || 'Failed to download attachment.', errorObj.code || 'DOWNLOAD_FAILED', response.status);
    }
    const blob = await response.blob();
    let filename = fallbackFileName || 'invoice';
    const disposition = response.headers.get('Content-Disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename=["']?([^"';]+)["']?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 2000);
  },

  // Module 4: Stock Ledger & Physical Counts
  getItemStock: (id: string) =>
    request<ItemStockSummaryDTO>(`/api/inventory/items/${id}/stock`),

  listStockMovements: (params?: StockMovementListParams) => {
    const query = new URLSearchParams();
    if (params?.itemId) query.set('itemId', params.itemId);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.type) query.set('type', params.type);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const queryStr = query.toString();
    return request<StockMovementListResultDTO>(`/api/stock/movements${queryStr ? `?${queryStr}` : ''}`);
  },

  recordOpeningStock: (payload: RecordOpeningStockPayload, idempotencyKey?: string) =>
    request<RecordOpeningStockResultDTO>('/api/stock/opening', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, idempotencyKey),

  recordStockAdjustment: (payload: RecordAdjustmentPayload, idempotencyKey?: string) =>
    request<RecordAdjustmentResultDTO>('/api/stock/adjustments', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, idempotencyKey),

  recordStockCount: (payload: RecordStockCountPayload, idempotencyKey?: string) =>
    request<RecordStockCountResultDTO>('/api/stock/counts', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, idempotencyKey),

  // Module 5: Inventory Alerts, Reports & Financial Integration
  getInventoryOverview: () =>
    request<InventoryOverviewDTO>('/api/inventory/overview', { cache: 'no-store' }),

  listLowStock: (params?: { page?: number | string; pageSize?: number | string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const queryStr = query.toString();
    return request<LowStockListResultDTO>(`/api/inventory/low-stock${queryStr ? `?${queryStr}` : ''}`, { cache: 'no-store' });
  },

  acknowledgeLowStockAlert: (itemId: string, note?: string) =>
    request<{ acknowledgement: any }>(`/api/inventory/low-stock/${itemId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ note: note?.trim() || undefined })
    }),

  getInventoryStockReport: (params?: InventoryStockReportParams) => {
    const query = new URLSearchParams();
    if (params?.asOf) query.set('asOf', params.asOf);
    if (params?.format) query.set('format', params.format);
    const queryStr = query.toString();
    return request<ExportResultDTO>(`/api/reports/inventory-stock${queryStr ? `?${queryStr}` : ''}`);
  },

  getStockMovementsReport: (params: StockMovementsReportParams) => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.itemId) query.set('itemId', params.itemId);
    if (params.movementType) query.set('movementType', params.movementType);
    if (params.format) query.set('format', params.format);
    const queryStr = query.toString();
    return request<ExportResultDTO>(`/api/reports/stock-movements${queryStr ? `?${queryStr}` : ''}`);
  },

  getPurchasesReport: (params: PurchasesReportParams) => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.supplierId) query.set('supplierId', params.supplierId);
    if (params.itemId) query.set('itemId', params.itemId);
    if (params.paymentMethod) query.set('paymentMethod', params.paymentMethod);
    if (params.status) query.set('status', params.status);
    if (params.format) query.set('format', params.format);
    const queryStr = query.toString();
    return request<ExportResultDTO>(`/api/reports/purchases${queryStr ? `?${queryStr}` : ''}`);
  },

  getSuppliersReport: (params: SupplierSummaryReportParams) => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.format) query.set('format', params.format);
    const queryStr = query.toString();
    return request<ExportResultDTO>(`/api/reports/suppliers${queryStr ? `?${queryStr}` : ''}`);
  },

  getWastageReport: (params: WastageReportParams) => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.format) query.set('format', params.format);
    const queryStr = query.toString();
    return request<ExportResultDTO>(`/api/reports/wastage${queryStr ? `?${queryStr}` : ''}`);
  },

  getPhase2Profitability: (params: Phase2ProfitabilityReportParams) => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.format) query.set('format', params.format);
    const queryStr = query.toString();
    return request<ExportResultDTO | { profitability: Phase2ProfitabilityDTO }>(`/api/profitability/phase-2${queryStr ? `?${queryStr}` : ''}`);
  },

  // Staff
  listStaff: (params?: StaffListParams) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.roleTitle) query.set('roleTitle', params.roleTitle);
    if (params?.archived !== undefined) query.set('archived', String(params.archived));
    const queryStr = query.toString();
    return request<{ staff: StaffDTO[] }>(`/api/staff${queryStr ? `?${queryStr}` : ''}`);
  },
  getStaff: (id: string) =>
    request<{ staff: StaffDTO }>(`/api/staff/${encodeURIComponent(id)}`),
  createStaff: (payload: CreateStaffPayload, idempotencyKey?: string) =>
    request<{ staff: StaffDTO }>('/api/staff', { method: 'POST', body: JSON.stringify(payload) }, idempotencyKey),
  updateStaff: (id: string, payload: UpdateStaffPayload) =>
    request<{ staff: StaffDTO }>(`/api/staff/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveStaff: (id: string, idempotencyKey?: string) =>
    request<{ staff: StaffDTO }>(`/api/staff/${encodeURIComponent(id)}/archive`, { method: 'POST' }, idempotencyKey),
  restoreStaff: (id: string, idempotencyKey?: string) =>
    request<{ staff: StaffDTO }>(`/api/staff/${encodeURIComponent(id)}/restore`, { method: 'POST' }, idempotencyKey),

  // Attendance
  getDailyAttendance: (date: string) =>
    request<{ date: string; roster: DailyAttendanceRosterItemDTO[] }>(`/api/attendance?date=${encodeURIComponent(date)}`),
  saveSingleAttendance: (staffId: string, date: string, payload: SaveAttendancePayload) =>
    request<{ record: AttendanceRecordDTO }>(`/api/attendance/${encodeURIComponent(staffId)}?date=${encodeURIComponent(date)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  bulkSaveAttendance: (date: string, payload: BulkSaveAttendancePayload, idempotencyKey?: string) =>
    request<BulkSaveAttendanceResultDTO>(`/api/attendance/bulk?date=${encodeURIComponent(date)}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, idempotencyKey),
  getAttendanceSummary: (from: string, to: string, staffId?: string) => {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    if (staffId) query.set('staffId', staffId);
    const queryStr = query.toString();
    return request<AttendanceSummaryResponseDTO>(`/api/attendance/summary${queryStr ? `?${queryStr}` : ''}`);
  },
  getAttendanceReport: (params: AttendanceReportParams) => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.staffId) query.set('staffId', params.staffId);
    if (params.format) query.set('format', params.format);
    const queryStr = query.toString();
    return request<ExportResultDTO>(`/api/reports/attendance${queryStr ? `?${queryStr}` : ''}`);
  }
};

export function downloadExportFile(exportData: ExportResultDTO, filename: string) {
  const cleanBase64 = (exportData.contentBuffer || '').replace(/\s/g, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: exportData.mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 2000);
}
