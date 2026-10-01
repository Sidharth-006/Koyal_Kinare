export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'OFF_DAY';

export interface AttendanceRecord {
  id: string;
  staff_id: string;
  staff_name?: string;
  staff_role_title?: string;
  business_date: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveAttendanceRequestDTO {
  status: AttendanceStatus;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  note?: string | null;
  expectedUpdatedAt?: string | null;
}

export interface BulkAttendanceEntryDTO {
  staffId: string;
  status: AttendanceStatus;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  note?: string | null;
}

export interface BulkSaveAttendanceRequestDTO {
  entries: BulkAttendanceEntryDTO[];
}

export interface AttendanceSummaryMetrics {
  totalRecordedDays: number;
  totalRecordedEntries: number;
  presentCount: number;
  halfDayCount: number;
  absentCount: number;
  leaveCount: number;
  offDayCount: number;
  effectivePresentDays: number;
  workingDaysDenominator: number;
  attendanceRate: number;
  formulaDescription: string;
}

export interface StaffAttendanceSummary {
  staffId: string;
  staffName: string;
  roleTitle: string;
  isArchived: boolean;
  totalEntries: number;
  presentCount: number;
  halfDayCount: number;
  absentCount: number;
  leaveCount: number;
  offDayCount: number;
  effectivePresentDays: number;
  workingDaysDenominator: number;
  attendanceRate: number;
}

export interface DailyAttendanceSummary {
  date: string;
  totalEntries: number;
  presentCount: number;
  halfDayCount: number;
  absentCount: number;
  leaveCount: number;
  offDayCount: number;
}

export interface AttendanceSummaryResponse {
  dateRange: {
    from: string;
    to: string;
  };
  metrics: AttendanceSummaryMetrics;
  staffSummaries: StaffAttendanceSummary[];
  dailyTrends: DailyAttendanceSummary[];
}
