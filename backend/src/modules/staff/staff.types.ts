export interface Staff {
  id: string;
  full_name: string;
  phone: string | null;
  role_title: string;
  joining_date: string;
  emergency_contact: string | null;
  salary_reference: string | null;
  notes: string | null;
  is_archived: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStaffDTO {
  fullName: string;
  phone?: string | null;
  roleTitle: string;
  joiningDate: string;
  emergencyContact?: string | null;
  salaryReference?: number | string | null;
  notes?: string | null;
  idempotencyKey?: string;
}

export interface UpdateStaffDTO {
  fullName?: string;
  phone?: string | null;
  roleTitle?: string;
  joiningDate?: string;
  emergencyContact?: string | null;
  salaryReference?: number | string | null;
  notes?: string | null;
}

export interface StaffListParams {
  archived?: boolean | 'all' | string;
  roleTitle?: string;
  search?: string;
}
