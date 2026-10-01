import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StaffService } from '@/modules/staff/staff.service';
import { AttendanceService } from '@/modules/attendance/attendance.service';
import { AttendanceRepository } from '@/modules/attendance/attendance.repository';
import {
  StaffArchivedError,
  AttendanceConflictError,
  AttendanceTimeInvalidError,
  ValidationError,
  IdempotencyError
} from '@/shared/errors';
import { query } from '@/shared/database/client';

describe('Attendance Flow Integration Tests', () => {
  const testAdminId = '00000000-0000-0000-0000-000000000001';
  let staffA: any;
  let staffB: any;
  let staffC: any;

  beforeAll(async () => {
    await query(`
      INSERT INTO admins (id, email, password_hash, display_name)
      VALUES ($1, 'attendance_admin@cafe.com', 'hash', 'Test Admin')
      ON CONFLICT (id) DO NOTHING;
    `, [testAdminId]);

    await query(`DELETE FROM attendance_records WHERE staff_id IN (SELECT id FROM staff WHERE full_name LIKE 'TEST_ATT_%');`);
    await query(`DELETE FROM staff WHERE full_name LIKE 'TEST_ATT_%';`);

    staffA = await StaffService.createStaff(
      { fullName: 'TEST_ATT_Alice Smith', roleTitle: 'Barista', joiningDate: '2026-01-01' },
      testAdminId
    );
    staffB = await StaffService.createStaff(
      { fullName: 'TEST_ATT_Bob Jones', roleTitle: 'Chef', joiningDate: '2026-01-01' },
      testAdminId
    );
    staffC = await StaffService.createStaff(
      { fullName: 'TEST_ATT_Charlie Brown', roleTitle: 'Server', joiningDate: '2026-01-01' },
      testAdminId
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM attendance_records WHERE staff_id IN (SELECT id FROM staff WHERE full_name LIKE 'TEST_ATT_%');`);
    await query(`DELETE FROM staff WHERE full_name LIKE 'TEST_ATT_%';`);
  });

  it('should fetch daily attendance roster including all active staff', async () => {
    const roster = await AttendanceService.getDailyAttendanceRoster('2026-09-01');
    expect(roster.length).toBeGreaterThanOrEqual(3);

    const aliceEntry = roster.find(r => r.staffId === staffA.id);
    expect(aliceEntry).toBeDefined();
    expect(aliceEntry.staffName).toBe('TEST_ATT_Alice Smith');
    expect(aliceEntry.status).toBeNull(); // Unrecorded initially
  });

  it('should record single attendance for all statuses correctly', async () => {
    // 1. PRESENT with checkInAt and checkOutAt
    const presentRecord = await AttendanceService.saveSingleAttendance(
      staffA.id,
      '2026-09-02',
      {
        status: 'PRESENT',
        checkInAt: '2026-09-02T09:00:00.000Z',
        checkOutAt: '2026-09-02T17:00:00.000Z',
        note: 'Full shift completed'
      },
      testAdminId
    );
    expect(presentRecord.status).toBe('PRESENT');
    expect(presentRecord.check_in_at).toBeDefined();
    expect(presentRecord.check_out_at).toBeDefined();
    expect(presentRecord.note).toBe('Full shift completed');

    // 2. HALF_DAY
    const halfDayRecord = await AttendanceService.saveSingleAttendance(
      staffB.id,
      '2026-09-02',
      {
        status: 'HALF_DAY',
        checkInAt: '2026-09-02T09:00:00.000Z',
        checkOutAt: '2026-09-02T13:00:00.000Z',
        note: 'Morning half shift'
      },
      testAdminId
    );
    expect(halfDayRecord.status).toBe('HALF_DAY');

    // 3. ABSENT (timestamps null)
    const absentRecord = await AttendanceService.saveSingleAttendance(
      staffC.id,
      '2026-09-02',
      {
        status: 'ABSENT',
        note: 'Sick leave'
      },
      testAdminId
    );
    expect(absentRecord.status).toBe('ABSENT');
    expect(absentRecord.check_in_at).toBeNull();
    expect(absentRecord.check_out_at).toBeNull();

    // 4. LEAVE
    const leaveRecord = await AttendanceService.saveSingleAttendance(
      staffA.id,
      '2026-09-03',
      { status: 'LEAVE', note: 'Pre-approved annual leave' },
      testAdminId
    );
    expect(leaveRecord.status).toBe('LEAVE');

    // 5. OFF_DAY
    const offDayRecord = await AttendanceService.saveSingleAttendance(
      staffB.id,
      '2026-09-03',
      { status: 'OFF_DAY' },
      testAdminId
    );
    expect(offDayRecord.status).toBe('OFF_DAY');
  });

  it('should enforce unique (staff_id, business_date) and allow updates', async () => {
    // Initial record
    const record1 = await AttendanceService.saveSingleAttendance(
      staffA.id,
      '2026-09-04',
      { status: 'PRESENT', checkInAt: '2026-09-04T09:00:00Z', checkOutAt: '2026-09-04T17:00:00Z' },
      testAdminId
    );

    // Update same staff on same date
    const record2 = await AttendanceService.saveSingleAttendance(
      staffA.id,
      '2026-09-04',
      { status: 'HALF_DAY', checkInAt: '2026-09-04T09:00:00Z', checkOutAt: '2026-09-04T13:00:00Z', note: 'Left early' },
      testAdminId
    );

    expect(record2.id).toBe(record1.id);
    expect(record2.status).toBe('HALF_DAY');
    expect(record2.note).toBe('Left early');

    // Verify only 1 record exists in DB for this date
    const fetched = await AttendanceRepository.findRecordByStaffAndDate(staffA.id, '2026-09-04');
    expect(fetched).not.toBeNull();
    expect(fetched!.status).toBe('HALF_DAY');
  });

  it('should detect concurrency conflicts when expectedUpdatedAt does not match', async () => {
    const initial = await AttendanceService.saveSingleAttendance(
      staffB.id,
      '2026-09-05',
      { status: 'PRESENT' },
      testAdminId
    );

    // First update changes the timestamp
    await AttendanceService.saveSingleAttendance(
      staffB.id,
      '2026-09-05',
      { status: 'HALF_DAY' },
      testAdminId
    );

    // Concurrent request using stale initial.updated_at must fail
    await expect(
      AttendanceService.saveSingleAttendance(
        staffB.id,
        '2026-09-05',
        {
          status: 'ABSENT',
          expectedUpdatedAt: initial.updated_at
        },
        testAdminId
      )
    ).rejects.toThrow(AttendanceConflictError);
  });

  it('should perform bulk save atomically across multiple staff', async () => {
    const result = await AttendanceService.bulkSaveAttendance(
      '2026-09-06',
      {
        entries: [
          { staffId: staffA.id, status: 'PRESENT', checkInAt: '2026-09-06T09:00:00Z', checkOutAt: '2026-09-06T17:00:00Z' },
          { staffId: staffB.id, status: 'PRESENT', checkInAt: '2026-09-06T09:15:00Z', checkOutAt: '2026-09-06T17:15:00Z' },
          { staffId: staffC.id, status: 'OFF_DAY' }
        ]
      },
      testAdminId
    );

    expect(result.totalSaved).toBe(3);
    expect(result.records.length).toBe(3);

    const recA = await AttendanceRepository.findRecordByStaffAndDate(staffA.id, '2026-09-06');
    const recB = await AttendanceRepository.findRecordByStaffAndDate(staffB.id, '2026-09-06');
    const recC = await AttendanceRepository.findRecordByStaffAndDate(staffC.id, '2026-09-06');

    expect(recA?.status).toBe('PRESENT');
    expect(recB?.status).toBe('PRESENT');
    expect(recC?.status).toBe('OFF_DAY');
  });

  it('should rollback all records if any single entry in bulk save fails validation', async () => {
    await expect(
      AttendanceService.bulkSaveAttendance(
        '2026-09-07',
        {
          entries: [
            { staffId: staffA.id, status: 'PRESENT' },
            { staffId: '00000000-0000-0000-0000-000000000999', status: 'PRESENT' } // Non-existent staff
          ]
        },
        testAdminId
      )
    ).rejects.toThrow();

    // Verify staffA was NOT saved for this date due to rollback
    const recA = await AttendanceRepository.findRecordByStaffAndDate(staffA.id, '2026-09-07');
    expect(recA).toBeNull();
  });

  it('should handle idempotency on bulk save', async () => {
    const idempotencyKey = 'idem-bulk-' + Date.now();

    const res1 = await AttendanceService.bulkSaveAttendance(
      '2026-09-08',
      {
        entries: [
          { staffId: staffA.id, status: 'PRESENT' },
          { staffId: staffB.id, status: 'ABSENT' }
        ]
      },
      testAdminId,
      undefined,
      idempotencyKey
    );

    const res2 = await AttendanceService.bulkSaveAttendance(
      '2026-09-08',
      {
        entries: [
          { staffId: staffA.id, status: 'PRESENT' },
          { staffId: staffB.id, status: 'ABSENT' }
        ]
      },
      testAdminId,
      undefined,
      idempotencyKey
    );

    expect(res2.totalSaved).toBe(res1.totalSaved);
  });

  it('should enforce archive-date business rules relative to business date', async () => {
    const tempStaff = await StaffService.createStaff(
      { fullName: 'TEST_ATT_Temp Worker', roleTitle: 'Helper', joiningDate: '2026-01-01' },
      testAdminId
    );

    // 1. Record historical attendance while active
    const histRecord = await AttendanceService.saveSingleAttendance(
      tempStaff.id,
      '2026-08-01',
      { status: 'PRESENT' },
      testAdminId
    );
    expect(histRecord.status).toBe('PRESENT');

    // 2. Archive the staff
    await StaffService.archiveStaff(tempStaff.id, testAdminId);

    // 3. Historical attendance remains readable
    const fetchedHist = await AttendanceRepository.findRecordByStaffAndDate(tempStaff.id, '2026-08-01');
    expect(fetchedHist).not.toBeNull();
    expect(fetchedHist!.status).toBe('PRESENT');

    // 4. New attendance after archive date (e.g. today or future) is rejected with StaffArchivedError
    await expect(
      AttendanceService.saveSingleAttendance(
        tempStaff.id,
        '2026-10-01',
        { status: 'PRESENT' },
        testAdminId
      )
    ).rejects.toThrow(StaffArchivedError);
  });

  it('should log audit events for attendance lifecycle', async () => {
    const { rows } = await query(
      `SELECT * FROM audit_logs WHERE action IN ('ATTENDANCE_CREATED', 'ATTENDANCE_UPDATED', 'ATTENDANCE_BULK_SAVED') ORDER BY created_at DESC LIMIT 5`
    );

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const actions = rows.map(r => r.action);
    expect(actions.includes('ATTENDANCE_CREATED') || actions.includes('ATTENDANCE_BULK_SAVED')).toBe(true);
  });
});
