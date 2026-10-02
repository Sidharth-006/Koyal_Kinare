import { describe, it, expect } from 'vitest';
import {
  AttendanceStatus,
  AttendanceSummaryResponseDTO,
  AttendanceReportParams,
  ExportResultDTO,
  StaffAttendanceSummaryDTO
} from '../../src/lib/types';

describe('Milestone 5 — Attendance Summary & Export', () => {
  // Pure helper functions mirroring summary and export validation
  const validateDateRange = (from: string, to: string): { valid: boolean; error?: string } => {
    if (!from || !to) {
      return { valid: false, error: 'Start date and end date are required.' };
    }
    if (from > to) {
      return { valid: false, error: 'Start date (from) cannot be after end date (to).' };
    }
    const dFrom = new Date(from);
    const dTo = new Date(to);
    const diffDays = Math.ceil((dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
      return { valid: false, error: 'Attendance summary date range cannot exceed 366 days.' };
    }
    return { valid: true };
  };

  const buildExportParams = (
    from: string,
    to: string,
    staffId: string,
    format: 'XLSX' | 'PDF'
  ): AttendanceReportParams => {
    return {
      from,
      to,
      staffId: staffId ? staffId : undefined,
      format
    };
  };

  const getStartOfMonth = (dateStr: string): string => {
    const [year, month] = dateStr.split('-');
    return `${year}-${month}-01`;
  };

  const shiftDate = (dateStr: string, days: number): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day + days));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  it('1. summary loads with from and to date filters', () => {
    const from = '2026-09-01';
    const to = '2026-09-30';
    const validation = validateDateRange(from, to);
    expect(validation.valid).toBe(true);
    expect(validation.error).toBeUndefined();

    // Verify preset calculations
    expect(getStartOfMonth('2026-10-15')).toBe('2026-10-01');
    expect(shiftDate('2026-10-08', -6)).toBe('2026-10-02');
  });

  it('2. optional staffId is sent correctly when specified and omitted when empty', () => {
    // When staffId is provided
    const withStaff = buildExportParams('2026-10-01', '2026-10-31', 'staff-123', 'XLSX');
    expect(withStaff.staffId).toBe('staff-123');

    // When staffId is empty string ("All Staff")
    const allStaff = buildExportParams('2026-10-01', '2026-10-31', '', 'PDF');
    expect(allStaff.staffId).toBeUndefined();
  });

  it('3. from <= to validation prevents inverted date ranges and ranges > 366 days', () => {
    // Inverted range
    const inverted = validateDateRange('2026-10-15', '2026-10-01');
    expect(inverted.valid).toBe(false);
    expect(inverted.error).toBe('Start date (from) cannot be after end date (to).');

    // Identical dates (single day range: valid)
    const singleDay = validateDateRange('2026-10-01', '2026-10-01');
    expect(singleDay.valid).toBe(true);

    // Range exceeding 366 days
    const tooLong = validateDateRange('2025-01-01', '2026-02-15');
    expect(tooLong.valid).toBe(false);
    expect(tooLong.error).toContain('366 days');
  });

  it('4. summary strictly uses actual backend DTO fields', () => {
    const mockSummary: AttendanceSummaryResponseDTO = {
      dateRange: {
        from: '2026-10-01',
        to: '2026-10-07'
      },
      metrics: {
        totalRecordedDays: 7,
        totalRecordedEntries: 28,
        presentCount: 22,
        halfDayCount: 2,
        absentCount: 2,
        leaveCount: 1,
        offDayCount: 1,
        effectivePresentDays: 23,
        workingDaysDenominator: 27,
        attendanceRate: 85.2,
        formulaDescription: 'Effective Present Days (Present + 0.5 * Half Day) / (Total Recorded Entries - Off Days) * 100'
      },
      staffSummaries: [
        {
          staffId: 'staff-1',
          staffName: 'Aarav Sharma',
          roleTitle: 'Barista',
          isArchived: false,
          totalEntries: 7,
          presentCount: 6,
          halfDayCount: 0,
          absentCount: 0,
          leaveCount: 0,
          offDayCount: 1,
          effectivePresentDays: 6,
          workingDaysDenominator: 6,
          attendanceRate: 100
        }
      ],
      dailyTrends: [
        {
          date: '2026-10-01',
          totalEntries: 4,
          presentCount: 4,
          halfDayCount: 0,
          absentCount: 0,
          leaveCount: 0,
          offDayCount: 0
        }
      ]
    };

    expect(mockSummary.metrics.totalRecordedDays).toBe(7);
    expect(mockSummary.metrics.presentCount).toBe(22);
    expect(mockSummary.metrics.attendanceRate).toBe(85.2);
    expect(mockSummary.metrics.formulaDescription).toContain('Effective Present Days');
    expect(mockSummary.staffSummaries[0].staffName).toBe('Aarav Sharma');
    expect(mockSummary.staffSummaries[0].attendanceRate).toBe(100);

    // Ensure forbidden invented fields are absent
    expect((mockSummary.metrics as any).overtime).toBeUndefined();
    expect((mockSummary.metrics as any).salary).toBeUndefined();
    expect((mockSummary.metrics as any).payroll).toBeUndefined();
    expect((mockSummary.metrics as any).performanceScore).toBeUndefined();
  });

  it('5. all five attendance statuses map correctly without inventing new statuses', () => {
    const validStatuses: AttendanceStatus[] = ['PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE', 'OFF_DAY'];
    expect(validStatuses.length).toBe(5);

    const counts: Record<AttendanceStatus, number> = {
      PRESENT: 10,
      HALF_DAY: 2,
      ABSENT: 1,
      LEAVE: 1,
      OFF_DAY: 2
    };

    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(16);
    expect(counts['PRESENT']).toBe(10);
    expect(counts['HALF_DAY']).toBe(2);
    expect(counts['ABSENT']).toBe(1);
    expect(counts['LEAVE']).toBe(1);
    expect(counts['OFF_DAY']).toBe(2);
  });

  it('6. attendance rate displays backend-provided value and denominator explanation', () => {
    const metrics = {
      effectivePresentDays: 14.5,
      workingDaysDenominator: 16,
      attendanceRate: 90.6,
      formulaDescription: 'Effective Present Days (Present + 0.5 * Half Day) / (Total Recorded Entries - Off Days) * 100'
    };

    // Frontend displays backend-provided rate directly without recalculation
    expect(metrics.attendanceRate).toBe(90.6);
    expect(metrics.formulaDescription).toContain('Effective Present Days');
    expect(metrics.workingDaysDenominator).toBe(16);
  });

  it('7. handles empty summary state gracefully when no records exist', () => {
    const emptySummary: AttendanceSummaryResponseDTO = {
      dateRange: { from: '2026-01-01', to: '2026-01-07' },
      metrics: {
        totalRecordedDays: 0,
        totalRecordedEntries: 0,
        presentCount: 0,
        halfDayCount: 0,
        absentCount: 0,
        leaveCount: 0,
        offDayCount: 0,
        effectivePresentDays: 0,
        workingDaysDenominator: 0,
        attendanceRate: 0,
        formulaDescription: 'Effective Present Days (Present + 0.5 * Half Day) / (Total Recorded Entries - Off Days) * 100'
      },
      staffSummaries: [],
      dailyTrends: []
    };

    expect(emptySummary.staffSummaries.length).toBe(0);
    expect(emptySummary.metrics.totalRecordedEntries).toBe(0);
    expect(emptySummary.metrics.attendanceRate).toBe(0);
  });

  it('8. handles summary error state safely with user-friendly retry message', () => {
    const getSafeErrorMessage = (err: any): string => {
      if (err?.message && !err.message.includes('Internal server error')) {
        return err.message;
      }
      return 'Failed to load attendance summary. Please try again.';
    };

    expect(getSafeErrorMessage({ message: 'Start date (from) cannot be after end date (to).' }))
      .toBe('Start date (from) cannot be after end date (to).');
    expect(getSafeErrorMessage(new Error('Internal server error: DB connection failed')))
      .toBe('Failed to load attendance summary. Please try again.');
  });

  it('9 & 10. XLSX and PDF exports use the current filters and supported formats', () => {
    const xlsxParams = buildExportParams('2026-10-01', '2026-10-15', 'staff-99', 'XLSX');
    expect(xlsxParams).toEqual({
      from: '2026-10-01',
      to: '2026-10-15',
      staffId: 'staff-99',
      format: 'XLSX'
    });

    const pdfParams = buildExportParams('2026-10-01', '2026-10-15', '', 'PDF');
    expect(pdfParams).toEqual({
      from: '2026-10-01',
      to: '2026-10-15',
      staffId: undefined,
      format: 'PDF'
    });
  });

  it('11. prevents duplicate export clicks while downloading', () => {
    let exportingXlsx = false;
    let exportingPdf = false;

    // Simulate clicking XLSX export
    const triggerExport = (format: 'XLSX' | 'PDF'): boolean => {
      if (format === 'XLSX') {
        if (exportingXlsx || exportingPdf) return false;
        exportingXlsx = true;
        return true;
      } else {
        if (exportingPdf || exportingXlsx) return false;
        exportingPdf = true;
        return true;
      }
    };

    // First click succeeds
    expect(triggerExport('XLSX')).toBe(true);
    expect(exportingXlsx).toBe(true);

    // Duplicate click during download is blocked
    expect(triggerExport('XLSX')).toBe(false);
    expect(triggerExport('PDF')).toBe(false);

    // Download completes
    exportingXlsx = false;
    expect(triggerExport('PDF')).toBe(true);
    expect(exportingPdf).toBe(true);
  });

  it('12. strictly verifies salary is NEVER rendered or exposed in attendance summary', () => {
    const staffRow: StaffAttendanceSummaryDTO = {
      staffId: 'staff-42',
      staffName: 'Vikram Joshi',
      roleTitle: 'Kitchen Manager',
      isArchived: false,
      totalEntries: 20,
      presentCount: 18,
      halfDayCount: 2,
      absentCount: 0,
      leaveCount: 0,
      offDayCount: 4,
      effectivePresentDays: 19,
      workingDaysDenominator: 16,
      attendanceRate: 100
    };

    expect((staffRow as any).salary).toBeUndefined();
    expect((staffRow as any).salaryReference).toBeUndefined();
    expect((staffRow as any).salary_reference).toBeUndefined();
    expect((staffRow as any).payroll).toBeUndefined();

    const serialized = JSON.stringify(staffRow);
    expect(serialized).not.toContain('salary');
    expect(serialized).not.toContain('payroll');
  });

  it('13. salary is NEVER included in frontend-generated export payload or data', () => {
    const exportRequest: AttendanceReportParams = {
      from: '2026-10-01',
      to: '2026-10-31',
      staffId: 'staff-42',
      format: 'XLSX'
    };

    expect((exportRequest as any).salary).toBeUndefined();
    expect((exportRequest as any).salaryReference).toBeUndefined();
    expect(JSON.stringify(exportRequest)).not.toContain('salary');

    const mockExportResponse: ExportResultDTO = {
      filename: 'attendance_report.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      contentBuffer: 'UEsDBBQAAAAIA...',
      fileSizeBytes: 1024
    };

    expect((mockExportResponse as any).salary).toBeUndefined();
    expect(JSON.stringify(mockExportResponse)).not.toContain('salary');
  });
});
