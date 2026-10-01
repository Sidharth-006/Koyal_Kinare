import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StaffService } from '@/modules/staff/staff.service';
import { AttendanceService } from '@/modules/attendance/attendance.service';
import { ReportService } from '@/modules/reporting/report.service';
import { normalizeReportFormat } from '@/modules/reporting/inventory-reports.service';
import { ValidationError, ReportTooLargeError } from '@/shared/errors';
import { query } from '@/shared/database/client';

describe('Attendance Reports & Exports Integration Tests', () => {
  const testAdminId = '00000000-0000-0000-0000-000000000001';
  let staff1: any;
  let staff2: any;

  beforeAll(async () => {
    await query(`
      INSERT INTO admins (id, email, password_hash, display_name)
      VALUES ($1, 'attendance_rep_admin@cafe.com', 'hash', 'Test Admin')
      ON CONFLICT (id) DO NOTHING;
    `, [testAdminId]);

    await query(`DELETE FROM attendance_records WHERE staff_id IN (SELECT id FROM staff WHERE full_name LIKE 'TEST_REP_%');`);
    await query(`DELETE FROM staff WHERE full_name LIKE 'TEST_REP_%';`);

    staff1 = await StaffService.createStaff(
      { fullName: 'TEST_REP_Deepak Verma', roleTitle: 'Barista', joiningDate: '2026-01-01', salaryReference: 30000 },
      testAdminId
    );
    staff2 = await StaffService.createStaff(
      { fullName: 'TEST_REP_Sunita Rao', roleTitle: 'Kitchen Lead', joiningDate: '2026-01-01', salaryReference: 35000 },
      testAdminId
    );

    // Seed 3 days of attendance
    // Day 1: both present
    await AttendanceService.saveSingleAttendance(staff1.id, '2026-08-10', { status: 'PRESENT', checkInAt: '2026-08-10T09:00:00Z', checkOutAt: '2026-08-10T17:00:00Z' }, testAdminId);
    await AttendanceService.saveSingleAttendance(staff2.id, '2026-08-10', { status: 'PRESENT', checkInAt: '2026-08-10T09:00:00Z', checkOutAt: '2026-08-10T17:00:00Z' }, testAdminId);

    // Day 2: staff1 half-day, staff2 absent
    await AttendanceService.saveSingleAttendance(staff1.id, '2026-08-11', { status: 'HALF_DAY', checkInAt: '2026-08-11T09:00:00Z', checkOutAt: '2026-08-11T13:00:00Z' }, testAdminId);
    await AttendanceService.saveSingleAttendance(staff2.id, '2026-08-11', { status: 'ABSENT', note: 'Unplanned absence' }, testAdminId);

    // Day 3: staff1 off-day, staff2 present
    await AttendanceService.saveSingleAttendance(staff1.id, '2026-08-12', { status: 'OFF_DAY' }, testAdminId);
    await AttendanceService.saveSingleAttendance(staff2.id, '2026-08-12', { status: 'PRESENT', checkInAt: '2026-08-12T09:00:00Z', checkOutAt: '2026-08-12T17:00:00Z' }, testAdminId);
  });

  afterAll(async () => {
    await query(`DELETE FROM attendance_records WHERE staff_id IN (SELECT id FROM staff WHERE full_name LIKE 'TEST_REP_%');`);
    await query(`DELETE FROM staff WHERE full_name LIKE 'TEST_REP_%';`);
  });

  it('should compute attendance summary metrics accurately', async () => {
    const summary = await AttendanceService.getAttendanceSummary('2026-08-10', '2026-08-12');

    expect(summary.dateRange.from).toBe('2026-08-10');
    expect(summary.dateRange.to).toBe('2026-08-12');
    expect(summary.metrics.totalRecordedDays).toBe(3);
    expect(summary.metrics.totalRecordedEntries).toBe(6);
    expect(summary.metrics.presentCount).toBe(3);
    expect(summary.metrics.halfDayCount).toBe(1);
    expect(summary.metrics.absentCount).toBe(1);
    expect(summary.metrics.offDayCount).toBe(1);

    // Effective present days = 3 + 0.5 * 1 = 3.5
    expect(summary.metrics.effectivePresentDays).toBe(3.5);
    // Working days denominator = 6 - 1 = 5
    expect(summary.metrics.workingDaysDenominator).toBe(5);
    // Attendance rate = (3.5 / 5) * 100 = 70.0%
    expect(summary.metrics.attendanceRate).toBe(70);
    expect(summary.metrics.formulaDescription).toBeDefined();

    // Verify staff summaries exist
    expect(summary.staffSummaries.length).toBeGreaterThanOrEqual(2);
    const s1 = summary.staffSummaries.find(s => s.staffId === staff1.id);
    expect(s1).toBeDefined();
    expect(s1?.presentCount).toBe(1);
    expect(s1?.halfDayCount).toBe(1);
    expect(s1?.offDayCount).toBe(1);
    expect(s1?.effectivePresentDays).toBe(1.5);
    // s1 workingDaysDenominator = 3 - 1 = 2
    expect(s1?.workingDaysDenominator).toBe(2);
    // s1 attendanceRate = (1.5 / 2) * 100 = 75.0%
    expect(s1?.attendanceRate).toBe(75);
  });

  it('should reject summary date range exceeding 366 days', async () => {
    await expect(
      AttendanceService.getAttendanceSummary('2025-01-01', '2026-08-10')
    ).rejects.toThrow(ReportTooLargeError);
  });

  it('should reject invalid date range where from > to', async () => {
    await expect(
      AttendanceService.getAttendanceSummary('2026-08-15', '2026-08-10')
    ).rejects.toThrow(ValidationError);
  });

  it('should export attendance report to XLSX with salary excluded', async () => {
    const exportResult = await ReportService.requestExport(
      {
        reportType: 'ATTENDANCE',
        startDate: '2026-08-10',
        endDate: '2026-08-12',
        fileFormat: 'XLSX'
      },
      testAdminId
    );

    expect(exportResult).toBeDefined();
    expect(exportResult.job.status).toBe('COMPLETED');
    expect(exportResult.job.file_format).toBe('EXCEL');
    expect(exportResult.contentBuffer).toBeDefined();

    // Decode and inspect content
    const decoded = Buffer.from(exportResult.contentBuffer, 'base64').toString('utf-8');
    expect(decoded).toContain('Koyal Kinare Cafe');
    expect(decoded).toContain('ATTENDANCE');
    expect(decoded).toContain('TEST_REP_Deepak Verma');
    expect(decoded).toContain('TEST_REP_Sunita Rao');
    // Ensure salary is completely excluded
    expect(decoded).not.toContain('30000');
    expect(decoded).not.toContain('35000');
    expect(decoded).not.toContain('salary');
  });

  it('should export attendance report to PDF with valid structure', async () => {
    const exportResult = await ReportService.requestExport(
      {
        reportType: 'ATTENDANCE',
        startDate: '2026-08-10',
        endDate: '2026-08-12',
        fileFormat: 'PDF'
      },
      testAdminId
    );

    expect(exportResult).toBeDefined();
    expect(exportResult.job.status).toBe('COMPLETED');
    expect(exportResult.job.file_format).toBe('PDF');
    expect(exportResult.mimeType).toBe('application/pdf');

    const pdfBuffer = Buffer.from(exportResult.contentBuffer, 'base64');
    expect(pdfBuffer.length).toBeGreaterThan(100);
    // PDF magic number header
    expect(pdfBuffer.toString('utf-8', 0, 4)).toBe('%PDF');
  });

  it('should reject invalid report format with ValidationError', () => {
    expect(() => normalizeReportFormat('CSV')).toThrow(ValidationError);
    expect(() => normalizeReportFormat('DOCX')).toThrow(ValidationError);
    expect(() => normalizeReportFormat(null)).toThrow(ValidationError);
    expect(normalizeReportFormat('XLSX')).toBe('XLSX');
    expect(normalizeReportFormat('PDF')).toBe('PDF');
  });
});
