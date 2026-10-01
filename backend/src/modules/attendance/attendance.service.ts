import { AttendanceRepository } from './attendance.repository';
import { StaffRepository } from '../staff/staff.repository';
import {
  AttendanceRecord,
  AttendanceStatus,
  SaveAttendanceRequestDTO,
  BulkSaveAttendanceRequestDTO,
  AttendanceSummaryResponse,
  StaffAttendanceSummary,
  DailyAttendanceSummary
} from './attendance.types';
import { AuditService } from '../audit/audit.service';
import { IdempotencyRepository } from '../audit/idempotency.repository';
import { withTransaction } from '@/shared/database/client';
import {
  ValidationError,
  NotFoundError,
  StaffArchivedError,
  AttendanceTimeInvalidError,
  AttendanceConflictError,
  InvalidAttendanceStatusError,
  ReportTooLargeError,
  IdempotencyError
} from '@/shared/errors';
import { isValidDateString } from '@/shared/time';
import Decimal from 'decimal.js';

const VALID_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'OFF_DAY'];

export class AttendanceService {
  static validateStatus(status: any): AttendanceStatus {
    if (!status || typeof status !== 'string') {
      throw new InvalidAttendanceStatusError('Attendance status is required.');
    }
    const upper = status.trim().toUpperCase() as AttendanceStatus;
    if (!VALID_STATUSES.includes(upper)) {
      throw new InvalidAttendanceStatusError(`Invalid attendance status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}.`);
    }
    return upper;
  }

  static validateTimestamps(status: AttendanceStatus, checkInAt?: string | null, checkOutAt?: string | null): {
    checkInAt: string | null;
    checkOutAt: string | null;
  } {
    const isAbsence = status === 'ABSENT' || status === 'LEAVE' || status === 'OFF_DAY';

    if (isAbsence) {
      if ((checkInAt && checkInAt.trim().length > 0) || (checkOutAt && checkOutAt.trim().length > 0)) {
        throw new AttendanceTimeInvalidError('Check-in and check-out timestamps are only valid for PRESENT or HALF_DAY status.');
      }
      return { checkInAt: null, checkOutAt: null };
    }

    let inTime: Date | null = null;
    let outTime: Date | null = null;

    if (checkInAt && checkInAt.trim().length > 0) {
      inTime = new Date(checkInAt.trim());
      if (isNaN(inTime.getTime())) {
        throw new AttendanceTimeInvalidError('Invalid check-in timestamp format.');
      }
    }

    if (checkOutAt && checkOutAt.trim().length > 0) {
      outTime = new Date(checkOutAt.trim());
      if (isNaN(outTime.getTime())) {
        throw new AttendanceTimeInvalidError('Invalid check-out timestamp format.');
      }
    }

    if (inTime && outTime) {
      if (outTime.getTime() <= inTime.getTime()) {
        throw new AttendanceTimeInvalidError('Check-out timestamp must be after check-in timestamp.');
      }
    }

    return {
      checkInAt: inTime ? inTime.toISOString() : null,
      checkOutAt: outTime ? outTime.toISOString() : null
    };
  }

  static validateNote(note: any): string | null {
    if (note === undefined || note === null) return null;
    if (typeof note !== 'string') {
      throw new ValidationError('Note must be a string.');
    }
    const trimmed = note.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > 500) {
      throw new ValidationError('Note cannot exceed 500 characters.');
    }
    return trimmed;
  }

  static validateDate(dateStr: any, fieldName: string = 'Date'): string {
    if (!dateStr || typeof dateStr !== 'string' || !isValidDateString(dateStr.trim())) {
      throw new ValidationError(`${fieldName} must be a valid date in YYYY-MM-DD format.`);
    }
    return dateStr.trim();
  }

  static async getDailyAttendanceRoster(businessDate: string) {
    const validDate = this.validateDate(businessDate, 'Business date');
    const roster = await AttendanceRepository.getDailyAttendanceRoster(validDate);
    return roster.map(r => ({
      staffId: r.staff_id,
      staffName: r.staff_name,
      roleTitle: r.staff_role_title,
      isArchived: r.is_archived,
      joiningDate: r.joining_date,
      attendanceId: r.attendance_id || null,
      businessDate: validDate,
      status: r.status || null,
      checkInAt: r.check_in_at || null,
      checkOutAt: r.check_out_at || null,
      note: r.note || null,
      updatedAt: r.updated_at || null
    }));
  }

  static async saveSingleAttendance(
    staffId: string,
    businessDate: string,
    payload: SaveAttendanceRequestDTO,
    adminId: string,
    requestId?: string
  ): Promise<AttendanceRecord> {
    const validDate = this.validateDate(businessDate, 'Business date');
    const status = this.validateStatus(payload.status);
    const { checkInAt, checkOutAt } = this.validateTimestamps(status, payload.checkInAt, payload.checkOutAt);
    const note = this.validateNote(payload.note);

    const staff = await StaffRepository.findById(staffId);
    if (!staff) {
      throw new NotFoundError('Staff member not found.');
    }

    if (staff.joining_date > validDate) {
      throw new ValidationError(`Cannot record attendance before staff joining date (${staff.joining_date}).`);
    }

    // Existing record check
    const existing = await AttendanceRepository.findRecordByStaffAndDate(staffId, validDate);

    // Archive-date rule relative to business date:
    // If staff is archived, and has no existing record on this date,
    // check if the staff was archived before this business date.
    if (staff.is_archived && !existing) {
      const archiveDate = new Date(staff.updated_at).toISOString().slice(0, 10);
      if (validDate > archiveDate) {
        throw new StaffArchivedError('Cannot record attendance for a staff member archived prior to the selected business date.');
      }
    }

    // Concurrency / revision check
    if (payload.expectedUpdatedAt && existing) {
      const existingUpdatedIso = new Date(existing.updated_at).toISOString();
      const expectedUpdatedIso = new Date(payload.expectedUpdatedAt).toISOString();
      if (existingUpdatedIso !== expectedUpdatedIso) {
        throw new AttendanceConflictError('Attendance record was updated by another session. Please refresh.');
      }
    }

    const result = await withTransaction(async (client) => {
      const record = await AttendanceRepository.upsertRecord(
        staffId,
        validDate,
        { status, checkInAt, checkOutAt, note },
        adminId,
        client
      );

      const action = existing ? 'ATTENDANCE_UPDATED' : 'ATTENDANCE_CREATED';
      await AuditService.logEvent(
        {
          adminId,
          action,
          entityType: 'ATTENDANCE_RECORD',
          entityId: record.id,
          requestId,
          beforeState: existing ? {
            id: existing.id,
            staffId: existing.staff_id,
            businessDate: existing.business_date,
            status: existing.status,
            checkInAt: existing.check_in_at,
            checkOutAt: existing.check_out_at,
            note: existing.note
          } : null,
          afterState: {
            id: record.id,
            staffId: record.staff_id,
            businessDate: record.business_date,
            status: record.status,
            checkInAt: record.check_in_at,
            checkOutAt: record.check_out_at,
            note: record.note
          }
        },
        client
      );

      return record;
    });

    return result;
  }

  static async bulkSaveAttendance(
    businessDate: string,
    payload: BulkSaveAttendanceRequestDTO,
    adminId: string,
    requestId?: string,
    idempotencyKey?: string
  ) {
    const validDate = this.validateDate(businessDate, 'Business date');

    if (!payload.entries || !Array.isArray(payload.entries) || payload.entries.length === 0) {
      throw new ValidationError('At least one attendance entry must be provided in entries array.');
    }

    if (idempotencyKey) {
      const existingIdem = await IdempotencyRepository.find(idempotencyKey);
      if (existingIdem) {
        const currentHash = IdempotencyRepository.computeHash({ businessDate: validDate, entries: payload.entries });
        if (existingIdem.request_hash === currentHash) {
          return existingIdem.response_body;
        } else {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
      }
    }

    // 1. Pre-validate all entries upfront
    const validatedEntries: {
      staffId: string;
      status: AttendanceStatus;
      checkInAt: string | null;
      checkOutAt: string | null;
      note: string | null;
    }[] = [];

    const staffIdSet = new Set<string>();

    for (let i = 0; i < payload.entries.length; i++) {
      const entry = payload.entries[i];
      if (!entry.staffId || typeof entry.staffId !== 'string') {
        throw new ValidationError(`Entry at index ${i} is missing valid staffId.`);
      }
      if (staffIdSet.has(entry.staffId)) {
        throw new ValidationError(`Duplicate staffId ${entry.staffId} found in bulk entries.`);
      }
      staffIdSet.add(entry.staffId);

      const status = this.validateStatus(entry.status);
      const { checkInAt, checkOutAt } = this.validateTimestamps(status, entry.checkInAt, entry.checkOutAt);
      const note = this.validateNote(entry.note);

      validatedEntries.push({
        staffId: entry.staffId,
        status,
        checkInAt,
        checkOutAt,
        note
      });
    }

    // 2. Execute all saves inside single atomic transaction
    const result = await withTransaction(async (client) => {
      const savedRecords: AttendanceRecord[] = [];
      const statusCounts: Record<AttendanceStatus, number> = {
        PRESENT: 0,
        ABSENT: 0,
        HALF_DAY: 0,
        LEAVE: 0,
        OFF_DAY: 0
      };

      for (const entry of validatedEntries) {
        const staff = await StaffRepository.findById(entry.staffId, client);
        if (!staff) {
          throw new NotFoundError(`Staff member ${entry.staffId} not found.`);
        }

        if (staff.joining_date > validDate) {
          throw new ValidationError(`Cannot record attendance before staff joining date (${staff.joining_date}) for ${staff.full_name}.`);
        }

        const existing = await AttendanceRepository.findRecordByStaffAndDate(entry.staffId, validDate, client);
        if (staff.is_archived && !existing) {
          const archiveDate = new Date(staff.updated_at).toISOString().slice(0, 10);
          if (validDate > archiveDate) {
            throw new StaffArchivedError(`Cannot record attendance for archived staff member ${staff.full_name} after archive date.`);
          }
        }

        const saved = await AttendanceRepository.upsertRecord(
          entry.staffId,
          validDate,
          {
            status: entry.status,
            checkInAt: entry.checkInAt,
            checkOutAt: entry.checkOutAt,
            note: entry.note
          },
          adminId,
          client
        );

        savedRecords.push(saved);
        statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1;
      }

      await AuditService.logEvent(
        {
          adminId,
          action: 'ATTENDANCE_BULK_SAVED',
          entityType: 'ATTENDANCE_RECORD',
          requestId,
          metadata: {
            businessDate: validDate,
            totalEntries: savedRecords.length,
            statusCounts
          }
        },
        client
      );

      const responsePayload = {
        businessDate: validDate,
        totalSaved: savedRecords.length,
        records: savedRecords
      };

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ businessDate: validDate, entries: payload.entries }),
          200,
          responsePayload,
          client
        );
      }

      return responsePayload;
    });

    return result;
  }

  static async getAttendanceSummary(
    from: string,
    to: string,
    staffId?: string
  ): Promise<AttendanceSummaryResponse> {
    const validFrom = this.validateDate(from, 'Start date (from)');
    const validTo = this.validateDate(to, 'End date (to)');

    if (validFrom > validTo) {
      throw new ValidationError('Start date (from) cannot be after end date (to).');
    }

    const fromDate = new Date(validFrom);
    const toDate = new Date(validTo);
    const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
      throw new ReportTooLargeError('Attendance summary date range cannot exceed 366 days.');
    }

    const records = await AttendanceRepository.getAttendanceByDateRange(validFrom, validTo, staffId);

    // Aggregate summary
    const dateSet = new Set<string>();
    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let offDayCount = 0;

    const staffMap = new Map<string, StaffAttendanceSummary>();
    const dailyMap = new Map<string, DailyAttendanceSummary>();

    for (const r of records) {
      dateSet.add(r.business_date);

      // Status counts
      if (r.status === 'PRESENT') presentCount++;
      else if (r.status === 'HALF_DAY') halfDayCount++;
      else if (r.status === 'ABSENT') absentCount++;
      else if (r.status === 'LEAVE') leaveCount++;
      else if (r.status === 'OFF_DAY') offDayCount++;

      // Staff breakdown
      if (!staffMap.has(r.staff_id)) {
        staffMap.set(r.staff_id, {
          staffId: r.staff_id,
          staffName: r.staff_name || 'Unknown',
          roleTitle: r.staff_role_title || 'Staff',
          isArchived: (r as any).is_archived || false,
          totalEntries: 0,
          presentCount: 0,
          halfDayCount: 0,
          absentCount: 0,
          leaveCount: 0,
          offDayCount: 0,
          effectivePresentDays: 0,
          workingDaysDenominator: 0,
          attendanceRate: 0
        });
      }
      const sSummary = staffMap.get(r.staff_id)!;
      sSummary.totalEntries++;
      if (r.status === 'PRESENT') sSummary.presentCount++;
      else if (r.status === 'HALF_DAY') sSummary.halfDayCount++;
      else if (r.status === 'ABSENT') sSummary.absentCount++;
      else if (r.status === 'LEAVE') sSummary.leaveCount++;
      else if (r.status === 'OFF_DAY') sSummary.offDayCount++;

      // Daily breakdown
      if (!dailyMap.has(r.business_date)) {
        dailyMap.set(r.business_date, {
          date: r.business_date,
          totalEntries: 0,
          presentCount: 0,
          halfDayCount: 0,
          absentCount: 0,
          leaveCount: 0,
          offDayCount: 0
        });
      }
      const dSummary = dailyMap.get(r.business_date)!;
      dSummary.totalEntries++;
      if (r.status === 'PRESENT') dSummary.presentCount++;
      else if (r.status === 'HALF_DAY') dSummary.halfDayCount++;
      else if (r.status === 'ABSENT') dSummary.absentCount++;
      else if (r.status === 'LEAVE') dSummary.leaveCount++;
      else if (r.status === 'OFF_DAY') dSummary.offDayCount++;
    }

    // Calculate rates for staff
    for (const s of staffMap.values()) {
      const eff = new Decimal(s.presentCount).plus(new Decimal(s.halfDayCount).times(0.5)).toNumber();
      const workingDenom = s.totalEntries - s.offDayCount;
      s.effectivePresentDays = eff;
      s.workingDaysDenominator = workingDenom;
      s.attendanceRate = workingDenom > 0
        ? Number(new Decimal(eff).dividedBy(workingDenom).times(100).toFixed(1))
        : 0;
    }

    // Global summary metrics
    const totalRecordedEntries = records.length;
    const effectivePresentDays = new Decimal(presentCount).plus(new Decimal(halfDayCount).times(0.5)).toNumber();
    const workingDaysDenominator = totalRecordedEntries - offDayCount;
    const attendanceRate = workingDaysDenominator > 0
      ? Number(new Decimal(effectivePresentDays).dividedBy(workingDaysDenominator).times(100).toFixed(1))
      : 0;

    return {
      dateRange: { from: validFrom, to: validTo },
      metrics: {
        totalRecordedDays: dateSet.size,
        totalRecordedEntries,
        presentCount,
        halfDayCount,
        absentCount,
        leaveCount,
        offDayCount,
        effectivePresentDays,
        workingDaysDenominator,
        attendanceRate,
        formulaDescription: 'Effective Present Days (Present + 0.5 * Half Day) / (Total Recorded Entries - Off Days) * 100'
      },
      staffSummaries: Array.from(staffMap.values()).sort((a, b) => a.staffName.localeCompare(b.staffName)),
      dailyTrends: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    };
  }
}
