export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  contactPerson?: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  notes: string | null;
  is_archived: boolean;
  isArchived?: boolean;
  created_by: string | null;
  createdBy?: string | null;
  updated_by: string | null;
  updatedBy?: string | null;
  created_at: string | Date;
  createdAt?: string | Date;
  updated_at: string | Date;
  updatedAt?: string | Date;
}

export interface CreateSupplierDTO {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  notes?: string;
}

export interface UpdateSupplierDTO {
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  notes?: string;
}

export interface SupplierListParams {
  search?: string;
  status?: 'active' | 'archived' | 'all';
  page?: number | string;
  pageSize?: number | string;
}

export interface SupplierPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SupplierListResult {
  items: Supplier[];
  pagination: SupplierPagination;
}

export interface SupplierPurchaseSummary {
  supplierId: string;
  totalPurchasesCount: number;
  totalPurchasesAmount: number;
  receivedPurchasesCount: number;
  receivedPurchasesAmount: number;
  recentPurchases: any[];
  pagination: SupplierPagination;
}
