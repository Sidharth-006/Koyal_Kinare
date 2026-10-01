import { describe, it, expect } from 'vitest';
import { StaffService } from '@/modules/staff/staff.service';
import { AttendanceService } from '@/modules/attendance/attendance.service';
import {
  ValidationError,
  InvalidAttendanceStatusError,
  AttendanceTimeInvalidError
} from '@/shared/errors';

describe('Staff & Attendance Validation Unit Tests', () => {
  describe('Staff Field Validations', () => {
    it('should validate full name correctly', () => {
      expect(StaffService.validateFullName('  Rahul Sharma  ')).toBe('Rahul Sharma');
      expect(() => StaffService.validateFullName('')).toThrow(ValidationError);
      expect(() => StaffService.validateFullName('A')).toThrow(ValidationError);
      expect(() => StaffService.validateFullName('a'.repeat(121))).toThrow(ValidationError);
    });

    it('should validate phone correctly with max 25 chars', () => {
      expect(StaffService.validatePhone('  +91 9876543210  ')).toBe('+91 9876543210');
      expect(StaffService.validatePhone(undefined)).toBeNull();
      expect(StaffService.validatePhone(null)).toBeNull();
      expect(StaffService.validatePhone('   ')).toBeNull();
      expect(() => StaffService.validatePhone('1'.repeat(26))).toThrow(ValidationError);
    });

    it('should validate role title correctly with max 80 chars', () => {
      expect(StaffService.validateRoleTitle('  Head Barista  ')).toBe('Head Barista');
      expect(() => StaffService.validateRoleTitle('')).toThrow(ValidationError);
      expect(() => StaffService.validateRoleTitle('   ')).toThrow(ValidationError);
      expect(() => StaffService.validateRoleTitle('R'.repeat(81))).toThrow(ValidationError);
    });

    it('should validate joining date correctly in YYYY-MM-DD format', () => {
      expect(StaffService.validateJoiningDate('2026-01-15')).toBe('2026-01-15');
      expect(() => StaffService.validateJoiningDate('15-01-2026')).toThrow(ValidationError);
      expect(() => StaffService.validateJoiningDate('2026/01/15')).toThrow(ValidationError);
      expect(() => StaffService.validateJoiningDate('invalid-date')).toThrow(ValidationError);
    });

    it('should validate emergency contact correctly with max 25 chars', () => {
      expect(StaffService.validateEmergencyContact('  +91 9123456780  ')).toBe('+91 9123456780');
      expect(StaffService.validateEmergencyContact(null)).toBeNull();
      expect(() => StaffService.validateEmergencyContact('9'.repeat(26))).toThrow(ValidationError);
    });

    it('should validate salary reference correctly as positive decimal', () => {
      expect(StaffService.validateSalaryReference(25000)).toBe('25000.00');
      expect(StaffService.validateSalaryReference('18500.50')).toBe('18500.50');
      expect(StaffService.validateSalaryReference(0)).toBe('0.00');
      expect(StaffService.validateSalaryReference(null)).toBeNull();
      expect(StaffService.validateSalaryReference('')).toBeNull();
      expect(() => StaffService.validateSalaryReference(-100)).toThrow(ValidationError);
      expect(() => StaffService.validateSalaryReference('abc')).toThrow(ValidationError);
    });

    it('should validate staff notes correctly with max 1000 chars', () => {
      expect(StaffService.validateNotes('  Experienced in espresso and latte art  ')).toBe('Experienced in espresso and latte art');
      expect(StaffService.validateNotes(null)).toBeNull();
      expect(() => StaffService.validateNotes('x'.repeat(1001))).toThrow(ValidationError);
    });
  });

  describe('Attendance Status Validations', () => {
    it('should accept valid attendance statuses case-insensitively', () => {
      expect(AttendanceService.validateStatus('PRESENT')).toBe('PRESENT');
      expect(AttendanceService.validateStatus('present')).toBe('PRESENT');
      expect(AttendanceService.validateStatus('ABSENT')).toBe('ABSENT');
      expect(AttendanceService.validateStatus('HALF_DAY')).toBe('HALF_DAY');
      expect(AttendanceService.validateStatus('half_day')).toBe('HALF_DAY');
      expect(AttendanceService.validateStatus('LEAVE')).toBe('LEAVE');
      expect(AttendanceService.validateStatus('OFF_DAY')).toBe('OFF_DAY');
    });

    it('should reject invalid attendance statuses with InvalidAttendanceStatusError', () => {
      expect(() => AttendanceService.validateStatus('HOLIDAY')).toThrow(InvalidAttendanceStatusError);
      expect(() => AttendanceService.validateStatus('LATE')).toThrow(InvalidAttendanceStatusError);
      expect(() => AttendanceService.validateStatus('')).toThrow(InvalidAttendanceStatusError);
      expect(() => AttendanceService.validateStatus(null)).toThrow(InvalidAttendanceStatusError);
    });
  });

  describe('Attendance Timestamp Validations', () => {
    it('should reject check-in and check-out timestamps for ABSENT, LEAVE, OFF_DAY', () => {
      expect(() =>
        AttendanceService.validateTimestamps('ABSENT', '2026-09-30T09:00:00Z', null)
      ).toThrow(AttendanceTimeInvalidError);

      expect(() =>
        AttendanceService.validateTimestamps('LEAVE', null, '2026-09-30T17:00:00Z')
      ).toThrow(AttendanceTimeInvalidError);

      expect(() =>
        AttendanceService.validateTimestamps('OFF_DAY', '2026-09-30T09:00:00Z', '2026-09-30T17:00:00Z')
      ).toThrow(AttendanceTimeInvalidError);

      const nullResult = AttendanceService.validateTimestamps('ABSENT', null, null);
      expect(nullResult.checkInAt).toBeNull();
      expect(nullResult.checkOutAt).toBeNull();
    });

    it('should accept valid in/out timestamps for PRESENT and HALF_DAY', () => {
      const result = AttendanceService.validateTimestamps(
        'PRESENT',
        '2026-09-30T09:00:00.000Z',
        '2026-09-30T17:30:00.000Z'
      );
      expect(result.checkInAt).toBe('2026-09-30T09:00:00.000Z');
      expect(result.checkOutAt).toBe('2026-09-30T17:30:00.000Z');
    });

    it('should reject when checkOutAt is before or equal to checkInAt', () => {
      expect(() =>
        AttendanceService.validateTimestamps(
          'PRESENT',
          '2026-09-30T17:00:00.000Z',
          '2026-09-30T09:00:00.000Z'
        )
      ).toThrow(AttendanceTimeInvalidError);

      expect(() =>
        AttendanceService.validateTimestamps(
          'HALF_DAY',
          '2026-09-30T09:00:00.000Z',
          '2026-09-30T09:00:00.000Z'
        )
      ).toThrow(AttendanceTimeInvalidError);
    });

    it('should validate attendance note with max 500 chars', () => {
      expect(AttendanceService.validateNote('  Covered morning shift  ')).toBe('Covered morning shift');
      expect(AttendanceService.validateNote(null)).toBeNull();
      expect(() => AttendanceService.validateNote('n'.repeat(501))).toThrow(ValidationError);
    });
  });
});
