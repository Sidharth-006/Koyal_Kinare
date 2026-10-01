import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StaffService } from '@/modules/staff/staff.service';
import { StaffRepository } from '@/modules/staff/staff.repository';
import { NotFoundError, ValidationError, IdempotencyError } from '@/shared/errors';
import { query } from '@/shared/database/client';

describe('Staff Management Integration Tests', () => {
  const testAdminId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    await query(`
      INSERT INTO admins (id, email, password_hash, display_name)
      VALUES ($1, 'staff_test_admin@cafe.com', 'hash', 'Test Admin')
      ON CONFLICT (id) DO NOTHING;
    `, [testAdminId]);

    await query(`DELETE FROM staff WHERE full_name LIKE 'TEST_STAFF_%';`);
  });

  afterAll(async () => {
    await query(`DELETE FROM attendance_records WHERE staff_id IN (SELECT id FROM staff WHERE full_name LIKE 'TEST_STAFF_%');`);
    await query(`DELETE FROM staff WHERE full_name LIKE 'TEST_STAFF_%';`);
  });

  it('should create an active staff member with all fields normalized', async () => {
    const staff = await StaffService.createStaff(
      {
        fullName: '  TEST_STAFF_Aarav Mehta  ',
        phone: '  +91 9876543210  ',
        roleTitle: '  Senior Barista  ',
        joiningDate: '2026-02-01',
        emergencyContact: '  +91 9123456789  ',
        salaryReference: 28000,
        notes: '  Specialist in pour-over and manual brews  '
      },
      testAdminId
    );

    expect(staff).toBeDefined();
    expect(staff.id).toBeDefined();
    expect(staff.full_name).toBe('TEST_STAFF_Aarav Mehta');
    expect(staff.phone).toBe('+91 9876543210');
    expect(staff.role_title).toBe('Senior Barista');
    expect(staff.joining_date).toBe('2026-02-01');
    expect(staff.emergency_contact).toBe('+91 9123456789');
    expect(staff.salary_reference).toBe('28000.00');
    expect(staff.notes).toBe('Specialist in pour-over and manual brews');
    expect(staff.is_archived).toBe(false);
  });

  it('should read single staff by ID with salary reference included', async () => {
    const created = await StaffService.createStaff(
      {
        fullName: 'TEST_STAFF_Pooja Nair',
        roleTitle: 'Cashier',
        joiningDate: '2026-03-01',
        salaryReference: '20000.50'
      },
      testAdminId
    );

    const fetched = await StaffService.getStaffById(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.full_name).toBe('TEST_STAFF_Pooja Nair');
    expect(fetched.salary_reference).toBe('20000.50');
  });

  it('should omit salary_reference from general staff list queries', async () => {
    const staffList = await StaffService.listStaff({ search: 'TEST_STAFF_' });
    expect(staffList.length).toBeGreaterThanOrEqual(1);

    for (const member of staffList) {
      expect((member as any).salary_reference).toBeUndefined();
    }
  });

  it('should filter staff by roleTitle and archived status', async () => {
    const list = await StaffService.listStaff({
      roleTitle: 'Senior Barista',
      archived: false
    });

    expect(list.some(s => s.role_title === 'Senior Barista')).toBe(true);
  });

  it('should update staff details cleanly', async () => {
    const created = await StaffService.createStaff(
      {
        fullName: 'TEST_STAFF_Vikram Sen',
        roleTitle: 'Junior Cook',
        joiningDate: '2026-03-10'
      },
      testAdminId
    );

    const updated = await StaffService.updateStaff(
      created.id,
      {
        roleTitle: 'Head Chef',
        salaryReference: 45000,
        notes: 'Promoted after review'
      },
      testAdminId
    );

    expect(updated.role_title).toBe('Head Chef');
    expect(updated.salary_reference).toBe('45000.00');
    expect(updated.notes).toBe('Promoted after review');
    expect(updated.full_name).toBe('TEST_STAFF_Vikram Sen');
  });

  it('should archive and restore staff idempotently', async () => {
    const staff = await StaffService.createStaff(
      {
        fullName: 'TEST_STAFF_Karan Joshi',
        roleTitle: 'Server',
        joiningDate: '2026-01-20'
      },
      testAdminId
    );

    // Archive
    const archived = await StaffService.archiveStaff(staff.id, testAdminId);
    expect(archived.is_archived).toBe(true);

    // Second archive is idempotent
    const archivedAgain = await StaffService.archiveStaff(staff.id, testAdminId);
    expect(archivedAgain.is_archived).toBe(true);

    // Verify list excludes archived by default
    const activeList = await StaffService.listStaff({ search: 'Karan Joshi' });
    expect(activeList.some(s => s.id === staff.id)).toBe(false);

    // Verify list includes archived when requested
    const allList = await StaffService.listStaff({ search: 'Karan Joshi', archived: 'all' });
    expect(allList.some(s => s.id === staff.id)).toBe(true);

    // Restore
    const restored = await StaffService.restoreStaff(staff.id, testAdminId);
    expect(restored.is_archived).toBe(false);

    // Second restore is idempotent
    const restoredAgain = await StaffService.restoreStaff(staff.id, testAdminId);
    expect(restoredAgain.is_archived).toBe(false);
  });

  it('should handle idempotency on staff creation', async () => {
    const idempotencyKey = 'idem-staff-' + Date.now();

    const staff1 = await StaffService.createStaff(
      {
        fullName: 'TEST_STAFF_Idem Member',
        roleTitle: 'Barista',
        joiningDate: '2026-02-15',
        idempotencyKey
      },
      testAdminId
    );

    // Repeat identical request with same key
    const staff2 = await StaffService.createStaff(
      {
        fullName: 'TEST_STAFF_Idem Member',
        roleTitle: 'Barista',
        joiningDate: '2026-02-15',
        idempotencyKey
      },
      testAdminId
    );

    expect(staff2.id).toBe(staff1.id);

    // Request with same key but different payload throws IdempotencyError
    await expect(
      StaffService.createStaff(
        {
          fullName: 'TEST_STAFF_Different Payload',
          roleTitle: 'Cook',
          joiningDate: '2026-02-15',
          idempotencyKey
        },
        testAdminId
      )
    ).rejects.toThrow(IdempotencyError);
  });

  it('should record audit events for staff operations without personal details', async () => {
    const staff = await StaffService.createStaff(
      {
        fullName: 'TEST_STAFF_Audit Check',
        phone: '+91 9999999999',
        roleTitle: 'Manager',
        joiningDate: '2026-01-01',
        salaryReference: 60000
      },
      testAdminId
    );

    const { rows } = await query(
      `SELECT * FROM audit_logs WHERE entity_id = $1 AND entity_type = 'STAFF' ORDER BY created_at DESC`,
      [staff.id]
    );

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].action).toBe('STAFF_CREATED');
    // Ensure phone and salary reference are NOT in audit afterState
    expect(rows[0].after_state.phone).toBeUndefined();
    expect(rows[0].after_state.salaryReference).toBeUndefined();
    expect(rows[0].after_state.salary_reference).toBeUndefined();
  });
});
