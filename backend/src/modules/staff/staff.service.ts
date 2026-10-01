import { StaffRepository } from './staff.repository';
import { Staff, CreateStaffDTO, UpdateStaffDTO, StaffListParams } from './staff.types';
import { AuditService } from '../audit/audit.service';
import { IdempotencyRepository } from '../audit/idempotency.repository';
import { withTransaction } from '@/shared/database/client';
import { ValidationError, NotFoundError, IdempotencyError } from '@/shared/errors';
import { isValidDateString } from '@/shared/time';
import Decimal from 'decimal.js';

export class StaffService {
  static validateFullName(name: any): string {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new ValidationError('Full name is required and must be at least 2 characters.');
    }
    const trimmed = name.trim();
    if (trimmed.length > 120) {
      throw new ValidationError('Full name cannot exceed 120 characters.');
    }
    return trimmed;
  }

  static validatePhone(phone: any): string | null {
    if (phone === undefined || phone === null) return null;
    if (typeof phone !== 'string') {
      throw new ValidationError('Phone must be a string.');
    }
    const trimmed = phone.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > 25) {
      throw new ValidationError('Phone cannot exceed 25 characters.');
    }
    return trimmed;
  }

  static validateRoleTitle(roleTitle: any): string {
    if (!roleTitle || typeof roleTitle !== 'string' || roleTitle.trim().length === 0) {
      throw new ValidationError('Role title is required.');
    }
    const trimmed = roleTitle.trim();
    if (trimmed.length > 80) {
      throw new ValidationError('Role title cannot exceed 80 characters.');
    }
    return trimmed;
  }

  static validateJoiningDate(date: any): string {
    if (!date || typeof date !== 'string' || !isValidDateString(date.trim())) {
      throw new ValidationError('Joining date must be a valid date in YYYY-MM-DD format.');
    }
    return date.trim();
  }

  static validateEmergencyContact(contact: any): string | null {
    if (contact === undefined || contact === null) return null;
    if (typeof contact !== 'string') {
      throw new ValidationError('Emergency contact must be a string.');
    }
    const trimmed = contact.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > 25) {
      throw new ValidationError('Emergency contact cannot exceed 25 characters.');
    }
    return trimmed;
  }

  static validateSalaryReference(salary: any): string | null {
    if (salary === undefined || salary === null || salary === '') return null;
    try {
      const dec = new Decimal(salary);
      if (dec.isNegative()) {
        throw new ValidationError('Salary reference cannot be negative.');
      }
      return dec.toFixed(2);
    } catch (err: any) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError('Salary reference must be a valid numeric amount.');
    }
  }

  static validateNotes(notes: any): string | null {
    if (notes === undefined || notes === null) return null;
    if (typeof notes !== 'string') {
      throw new ValidationError('Notes must be a string.');
    }
    const trimmed = notes.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > 1000) {
      throw new ValidationError('Notes cannot exceed 1000 characters.');
    }
    return trimmed;
  }

  static async listStaff(params: StaffListParams) {
    return StaffRepository.list(params);
  }

  static async getStaffById(id: string): Promise<Staff> {
    const staff = await StaffRepository.findById(id);
    if (!staff) {
      throw new NotFoundError('Staff member not found.');
    }
    return staff;
  }

  static async createStaff(payload: CreateStaffDTO, adminId: string, requestId?: string): Promise<Staff> {
    const fullName = this.validateFullName(payload.fullName);
    const phone = this.validatePhone(payload.phone);
    const roleTitle = this.validateRoleTitle(payload.roleTitle);
    const joiningDate = this.validateJoiningDate(payload.joiningDate);
    const emergencyContact = this.validateEmergencyContact(payload.emergencyContact);
    const salaryReference = this.validateSalaryReference(payload.salaryReference);
    const notes = this.validateNotes(payload.notes);

    const idempotencyKey = payload.idempotencyKey;
    if (idempotencyKey) {
      const existing = await IdempotencyRepository.find(idempotencyKey);
      if (existing) {
        const currentHash = IdempotencyRepository.computeHash({
          fullName,
          phone,
          roleTitle,
          joiningDate,
          emergencyContact,
          salaryReference,
          notes
        });
        if (existing.request_hash === currentHash) {
          return existing.response_body;
        } else {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
      }
    }

    const result = await withTransaction(async (client) => {
      const staff = await StaffRepository.create(
        {
          fullName,
          phone,
          roleTitle,
          joiningDate,
          emergencyContact,
          salaryReference,
          notes
        },
        adminId,
        client
      );

      // Audit event without sensitive personal/financial data
      await AuditService.logEvent(
        {
          adminId,
          action: 'STAFF_CREATED',
          entityType: 'STAFF',
          entityId: staff.id,
          requestId,
          afterState: {
            id: staff.id,
            fullName: staff.full_name,
            roleTitle: staff.role_title,
            joiningDate: staff.joining_date,
            isArchived: staff.is_archived
          }
        },
        client
      );

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({
            fullName,
            phone,
            roleTitle,
            joiningDate,
            emergencyContact,
            salaryReference,
            notes
          }),
          201,
          staff,
          client
        );
      }

      return staff;
    });

    return result;
  }

  static async updateStaff(id: string, payload: UpdateStaffDTO, adminId: string, requestId?: string): Promise<Staff> {
    const existing = await StaffRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Staff member not found.');
    }

    const updateData: {
      fullName?: string;
      phone?: string | null;
      roleTitle?: string;
      joiningDate?: string;
      emergencyContact?: string | null;
      salaryReference?: string | null;
      notes?: string | null;
    } = {};

    if (payload.fullName !== undefined) {
      updateData.fullName = this.validateFullName(payload.fullName);
    }
    if (payload.phone !== undefined) {
      updateData.phone = this.validatePhone(payload.phone);
    }
    if (payload.roleTitle !== undefined) {
      updateData.roleTitle = this.validateRoleTitle(payload.roleTitle);
    }
    if (payload.joiningDate !== undefined) {
      updateData.joiningDate = this.validateJoiningDate(payload.joiningDate);
    }
    if (payload.emergencyContact !== undefined) {
      updateData.emergencyContact = this.validateEmergencyContact(payload.emergencyContact);
    }
    if (payload.salaryReference !== undefined) {
      updateData.salaryReference = this.validateSalaryReference(payload.salaryReference);
    }
    if (payload.notes !== undefined) {
      updateData.notes = this.validateNotes(payload.notes);
    }

    const result = await withTransaction(async (client) => {
      const updated = await StaffRepository.update(id, updateData, adminId, client);

      await AuditService.logEvent(
        {
          adminId,
          action: 'STAFF_UPDATED',
          entityType: 'STAFF',
          entityId: updated.id,
          requestId,
          beforeState: {
            id: existing.id,
            fullName: existing.full_name,
            roleTitle: existing.role_title,
            joiningDate: existing.joining_date,
            isArchived: existing.is_archived
          },
          afterState: {
            id: updated.id,
            fullName: updated.full_name,
            roleTitle: updated.role_title,
            joiningDate: updated.joining_date,
            isArchived: updated.is_archived
          }
        },
        client
      );

      return updated;
    });

    return result;
  }

  static async archiveStaff(id: string, adminId: string, requestId?: string, idempotencyKey?: string): Promise<Staff> {
    const existing = await StaffRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Staff member not found.');
    }

    if (existing.is_archived) {
      return existing; // idempotent
    }

    if (idempotencyKey) {
      const existingIdem = await IdempotencyRepository.find(idempotencyKey);
      if (existingIdem) {
        return existingIdem.response_body;
      }
    }

    const result = await withTransaction(async (client) => {
      const archived = await StaffRepository.setArchivedStatus(id, true, adminId, client);

      await AuditService.logEvent(
        {
          adminId,
          action: 'STAFF_ARCHIVED',
          entityType: 'STAFF',
          entityId: archived.id,
          requestId,
          metadata: {
            staffId: archived.id,
            fullName: archived.full_name,
            isArchived: true
          }
        },
        client
      );

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ action: 'archive', id }),
          200,
          archived,
          client
        );
      }

      return archived;
    });

    return result;
  }

  static async restoreStaff(id: string, adminId: string, requestId?: string, idempotencyKey?: string): Promise<Staff> {
    const existing = await StaffRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Staff member not found.');
    }

    if (!existing.is_archived) {
      return existing; // idempotent
    }

    if (idempotencyKey) {
      const existingIdem = await IdempotencyRepository.find(idempotencyKey);
      if (existingIdem) {
        return existingIdem.response_body;
      }
    }

    const result = await withTransaction(async (client) => {
      const restored = await StaffRepository.setArchivedStatus(id, false, adminId, client);

      await AuditService.logEvent(
        {
          adminId,
          action: 'STAFF_RESTORED',
          entityType: 'STAFF',
          entityId: restored.id,
          requestId,
          metadata: {
            staffId: restored.id,
            fullName: restored.full_name,
            isArchived: false
          }
        },
        client
      );

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ action: 'restore', id }),
          200,
          restored,
          client
        );
      }

      return restored;
    });

    return result;
  }
}
