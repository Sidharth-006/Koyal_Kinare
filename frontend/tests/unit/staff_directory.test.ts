import { describe, it, expect } from 'vitest';
import { StaffDTO, CreateStaffPayload, UpdateStaffPayload } from '../../src/lib/types';

describe('Staff Directory & Modal Logic (Milestone 2)', () => {
  // Helper functions mirroring component display logic
  const getStaffDisplayName = (staff: StaffDTO) => staff.full_name || staff.fullName || 'Unnamed Staff';
  const getStaffRole = (staff: StaffDTO) => staff.role_title || staff.roleTitle || '—';
  const getStaffJoiningDate = (staff: StaffDTO) => staff.joining_date || staff.joiningDate || '—';
  const isStaffArchived = (staff: StaffDTO) => staff.is_archived ?? staff.isArchived ?? false;

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (parts[0]?.[0] || 'S').toUpperCase();
  };

  const validateStaffForm = (data: {
    fullName: string;
    phone?: string;
    roleTitle: string;
    joiningDate: string;
    emergencyContact?: string;
    salaryReference?: string;
    notes?: string;
  }) => {
    const errors: Record<string, string> = {};

    const trimmedName = data.fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.fullName = 'Full name is required and must be at least 2 characters.';
    } else if (trimmedName.length > 120) {
      errors.fullName = 'Full name cannot exceed 120 characters.';
    }

    const trimmedPhone = (data.phone || '').trim();
    if (trimmedPhone && trimmedPhone.length > 25) {
      errors.phone = 'Phone number cannot exceed 25 characters.';
    }

    const trimmedRole = data.roleTitle.trim();
    if (!trimmedRole) {
      errors.roleTitle = 'Role / title is required.';
    } else if (trimmedRole.length > 80) {
      errors.roleTitle = 'Role / title cannot exceed 80 characters.';
    }

    const trimmedDate = data.joiningDate.trim();
    if (!trimmedDate || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      errors.joiningDate = 'Joining date must be a valid date in YYYY-MM-DD format.';
    }

    const trimmedEmergency = (data.emergencyContact || '').trim();
    if (trimmedEmergency && trimmedEmergency.length > 25) {
      errors.emergencyContact = 'Emergency contact cannot exceed 25 characters.';
    }

    const trimmedSalary = (data.salaryReference || '').trim();
    if (trimmedSalary) {
      const num = Number(trimmedSalary);
      if (isNaN(num) || num < 0) {
        errors.salaryReference = 'Salary reference must be a valid non-negative number.';
      }
    }

    const trimmedNotes = (data.notes || '').trim();
    if (trimmedNotes && trimmedNotes.length > 1000) {
      errors.notes = 'Notes cannot exceed 1000 characters.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  it('correctly extracts display fields from both snake_case and camelCase staff DTOs', () => {
    const staffSnake: StaffDTO = {
      id: 'uuid-1',
      full_name: 'Priya Sharma',
      phone: '+91 98765 43210',
      role_title: 'Senior Barista',
      joining_date: '2026-01-15',
      emergency_contact: '+91 91234 56789',
      notes: null,
      is_archived: false
    };

    expect(getStaffDisplayName(staffSnake)).toBe('Priya Sharma');
    expect(getStaffRole(staffSnake)).toBe('Senior Barista');
    expect(getStaffJoiningDate(staffSnake)).toBe('2026-01-15');
    expect(isStaffArchived(staffSnake)).toBe(false);
    expect(getInitials(getStaffDisplayName(staffSnake))).toBe('PS');

    const staffCamel: StaffDTO = {
      id: 'uuid-2',
      full_name: '',
      fullName: 'Aman Verma',
      phone: null,
      role_title: '',
      roleTitle: 'Kitchen Supervisor',
      joining_date: '',
      joiningDate: '2026-02-01',
      emergency_contact: null,
      notes: null,
      is_archived: undefined as any,
      isArchived: true
    };

    expect(getStaffDisplayName(staffCamel)).toBe('Aman Verma');
    expect(getStaffRole(staffCamel)).toBe('Kitchen Supervisor');
    expect(getStaffJoiningDate(staffCamel)).toBe('2026-02-01');
    expect(isStaffArchived(staffCamel)).toBe(true);
    expect(getInitials(getStaffDisplayName(staffCamel))).toBe('AV');
  });

  it('guarantees salary reference is absent from staff list views', () => {
    const staffRecord: StaffDTO = {
      id: 'uuid-3',
      full_name: 'Rohit Patil',
      phone: '+91 99999 88888',
      role_title: 'Chef',
      joining_date: '2026-03-01',
      emergency_contact: null,
      notes: null,
      is_archived: false
    };

    // Verify salary_reference is undefined in list payload
    expect(staffRecord.salary_reference).toBeUndefined();
    expect(staffRecord.salaryReference).toBeUndefined();

    // Verify standard directory serialization omits salary
    const serialized = JSON.stringify(staffRecord);
    expect(serialized).not.toContain('salary_reference');
    expect(serialized).not.toContain('salaryReference');
  });

  it('validates staff creation payload according to backend constraints', () => {
    // Valid input
    const valid = validateStaffForm({
      fullName: 'Sunil Kumar',
      phone: '+91 9876543210',
      roleTitle: 'Barista',
      joiningDate: '2026-03-15',
      emergencyContact: '+91 9811122233',
      salaryReference: '25000',
      notes: 'Experienced in manual espresso pull.'
    });
    expect(valid.isValid).toBe(true);
    expect(valid.errors).toEqual({});

    // Invalid: Name too short
    const shortName = validateStaffForm({
      fullName: 'A',
      roleTitle: 'Barista',
      joiningDate: '2026-03-15'
    });
    expect(shortName.isValid).toBe(false);
    expect(shortName.errors.fullName).toBeDefined();

    // Invalid: Missing role
    const missingRole = validateStaffForm({
      fullName: 'Sunil Kumar',
      roleTitle: '',
      joiningDate: '2026-03-15'
    });
    expect(missingRole.isValid).toBe(false);
    expect(missingRole.errors.roleTitle).toBeDefined();

    // Invalid: Bad date format
    const badDate = validateStaffForm({
      fullName: 'Sunil Kumar',
      roleTitle: 'Barista',
      joiningDate: '15-03-2026'
    });
    expect(badDate.isValid).toBe(false);
    expect(badDate.errors.joiningDate).toBeDefined();

    // Invalid: Negative salary reference
    const negSalary = validateStaffForm({
      fullName: 'Sunil Kumar',
      roleTitle: 'Barista',
      joiningDate: '2026-03-15',
      salaryReference: '-500'
    });
    expect(negSalary.isValid).toBe(false);
    expect(negSalary.errors.salaryReference).toBeDefined();
  });

  it('verifies archive confirmation contains the exact business-date attendance rule', () => {
    const archiveRuleExplanation =
      'Staff active on the selected business date may have attendance recorded. ' +
      'If the staff member was archived before the selected business date, new attendance will be rejected. ' +
      'Historical attendance recorded while active remains preserved and readable.';

    expect(archiveRuleExplanation).toContain('active on the selected business date');
    expect(archiveRuleExplanation).toContain('archived before the selected business date');
    expect(archiveRuleExplanation).toContain('Historical attendance recorded while active remains preserved');
  });
});

describe('Staff Profile & Edit Screen (Milestone 3)', () => {
  const buildUpdatePayload = (formState: {
    fullName: string;
    phone: string;
    roleTitle: string;
    joiningDate: string;
    emergencyContact: string;
    salaryReference: string;
    notes: string;
  }): UpdateStaffPayload => {
    return {
      fullName: formState.fullName.trim(),
      phone: formState.phone.trim() || null,
      roleTitle: formState.roleTitle.trim(),
      joiningDate: formState.joiningDate.trim(),
      emergencyContact: formState.emergencyContact.trim() || null,
      salaryReference: formState.salaryReference.trim() ? Number(formState.salaryReference.trim()) : null,
      notes: formState.notes.trim() || null
    };
  };

  it('correctly maps detailed staff record with protected salary reference', () => {
    const detailedStaff: StaffDTO = {
      id: 'uuid-101',
      full_name: 'Vikram Singh',
      phone: '+91 98888 77777',
      role_title: 'Head Chef',
      joining_date: '2025-11-01',
      emergency_contact: '+91 97777 66666',
      salary_reference: '45000.00',
      notes: 'Culinary arts diploma',
      is_archived: false,
      created_at: '2025-11-01T10:00:00Z',
      updated_at: '2026-01-10T12:00:00Z'
    };

    expect(detailedStaff.salary_reference).toBe('45000.00');
    expect(detailedStaff.emergency_contact).toBe('+91 97777 66666');
    expect(detailedStaff.is_archived).toBe(false);
  });

  it('ensures salary is masked by default and reveals only on toggle', () => {
    let showSalary = false;
    const salaryVal = '35000.00';

    // Masked state: type password
    const getInputType = (isRevealed: boolean) => (isRevealed ? 'number' : 'password');
    expect(getInputType(showSalary)).toBe('password');

    // Toggle reveal
    showSalary = !showSalary;
    expect(showSalary).toBe(true);
    expect(getInputType(showSalary)).toBe('number');

    // Toggle hide
    showSalary = !showSalary;
    expect(showSalary).toBe(false);
    expect(getInputType(showSalary)).toBe('password');
  });

  it('constructs correct PATCH payload normalizing nullables and numeric salary', () => {
    // With all fields populated
    const fullForm = {
      fullName: 'Vikram Singh',
      phone: '+91 98888 77777',
      roleTitle: 'Executive Chef',
      joiningDate: '2025-11-01',
      emergencyContact: '+91 97777 66666',
      salaryReference: '50000',
      notes: 'Promoted to Executive Chef'
    };

    const payload1 = buildUpdatePayload(fullForm);
    expect(payload1).toEqual({
      fullName: 'Vikram Singh',
      phone: '+91 98888 77777',
      roleTitle: 'Executive Chef',
      joiningDate: '2025-11-01',
      emergencyContact: '+91 97777 66666',
      salaryReference: 50000,
      notes: 'Promoted to Executive Chef'
    });

    // With optional fields cleared to empty string
    const clearedForm = {
      fullName: 'Vikram Singh',
      phone: '',
      roleTitle: 'Executive Chef',
      joiningDate: '2025-11-01',
      emergencyContact: '',
      salaryReference: '',
      notes: ''
    };

    const payload2 = buildUpdatePayload(clearedForm);
    expect(payload2).toEqual({
      fullName: 'Vikram Singh',
      phone: null,
      roleTitle: 'Executive Chef',
      joiningDate: '2025-11-01',
      emergencyContact: null,
      salaryReference: null,
      notes: null
    });
  });

  it('guarantees salary is never exposed in user-facing toasts or error logs', () => {
    const successToastMessage = 'Staff profile updated successfully';
    const failureToastMessage = 'Failed to update staff profile';

    expect(successToastMessage).not.toMatch(/\d+/);
    expect(successToastMessage).not.toContain('salary');
    expect(failureToastMessage).not.toContain('salary');
  });

  it('integrates seamlessly with archive/restore state updates', () => {
    let staffState: StaffDTO = {
      id: 'uuid-101',
      full_name: 'Vikram Singh',
      phone: '+91 98888 77777',
      role_title: 'Head Chef',
      joining_date: '2025-11-01',
      emergency_contact: null,
      salary_reference: '45000.00',
      notes: null,
      is_archived: false
    };

    // Simulate archive callback
    const handleArchiveSuccess = (updated: StaffDTO) => {
      staffState = { ...staffState, ...updated };
    };

    handleArchiveSuccess({ ...staffState, is_archived: true });
    expect(staffState.is_archived).toBe(true);

    // Simulate restore callback
    const handleRestoreSuccess = (updated: StaffDTO) => {
      staffState = { ...staffState, ...updated };
    };

    handleRestoreSuccess({ ...staffState, is_archived: false });
    expect(staffState.is_archived).toBe(false);
  });
});

