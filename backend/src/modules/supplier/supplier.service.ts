import { SupplierRepository } from './supplier.repository';
import {
  CreateSupplierDTO,
  UpdateSupplierDTO,
  SupplierListParams,
  SupplierPurchaseSummary
} from './supplier.types';
import { AuditService } from '../audit/audit.service';
import { IdempotencyRepository } from '../audit/idempotency.repository';
import { withTransaction } from '@/shared/database/client';
import {
  ValidationError,
  NotFoundError,
  DuplicateSupplierError,
  IdempotencyError
} from '@/shared/errors';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class SupplierService {
  static validateName(name: any): string {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Supplier name is required.');
    }
    return name.trim();
  }

  static validateGSTIN(gstin: any): string | null {
    if (gstin === undefined || gstin === null) return null;
    if (typeof gstin !== 'string') {
      throw new ValidationError('GSTIN must be a string.');
    }
    const trimmed = gstin.trim().toUpperCase();
    if (trimmed.length === 0) return null;
    if (!GSTIN_REGEX.test(trimmed)) {
      throw new ValidationError('Invalid GSTIN format. Must be a valid 15-character GSTIN.');
    }
    return trimmed;
  }

  static validateEmail(email: any): string | null {
    if (email === undefined || email === null) return null;
    if (typeof email !== 'string') {
      throw new ValidationError('Email must be a string.');
    }
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length === 0) return null;
    if (!EMAIL_REGEX.test(trimmed)) {
      throw new ValidationError('Invalid email format.');
    }
    return trimmed;
  }

  static validatePhone(phone: any): string | null {
    if (phone === undefined || phone === null) return null;
    if (typeof phone !== 'string') {
      throw new ValidationError('Phone must be a string.');
    }
    const trimmed = phone.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  static validateOptionalText(text: any, fieldName: string): string | null {
    if (text === undefined || text === null) return null;
    if (typeof text !== 'string') {
      throw new ValidationError(`${fieldName} must be a string.`);
    }
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  static async listSuppliers(params: SupplierListParams) {
    return SupplierRepository.list(params);
  }

  static async getSupplierById(id: string) {
    const supplier = await SupplierRepository.findById(id);
    if (!supplier) {
      throw new NotFoundError('Supplier not found.');
    }
    return supplier;
  }

  static async createSupplier(payload: CreateSupplierDTO, adminId: string, requestId?: string) {
    const name = this.validateName(payload.name);
    const contactPerson = this.validateOptionalText(payload.contactPerson, 'Contact person');
    const phone = this.validatePhone(payload.phone);
    const email = this.validateEmail(payload.email);
    const address = this.validateOptionalText(payload.address, 'Address');
    const gstin = this.validateGSTIN(payload.gstin);
    const notes = this.validateOptionalText(payload.notes, 'Notes');

    const idempotencyKey = (payload as any).idempotencyKey;
    if (idempotencyKey) {
      const existing = await IdempotencyRepository.find(idempotencyKey);
      if (existing) {
        const currentHash = IdempotencyRepository.computeHash({
          name,
          contactPerson,
          phone,
          email,
          address,
          gstin,
          notes
        });
        if (existing.request_hash === currentHash) {
          return existing.response_body;
        } else {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
      }
    }

    const existingActive = await SupplierRepository.findActiveByName(name);
    if (existingActive) {
      throw new DuplicateSupplierError('An active supplier with the same name already exists.');
    }

    const result = await withTransaction(async (client) => {
      const supplier = await SupplierRepository.create(
        {
          name,
          contactPerson,
          phone,
          email,
          address,
          gstin,
          notes
        },
        adminId,
        client
      );

      await AuditService.logEvent(
        {
          adminId,
          action: 'SUPPLIER_CREATED',
          entityType: 'SUPPLIER',
          entityId: supplier.id,
          requestId,
          afterState: {
            id: supplier.id,
            name: supplier.name,
            contactPerson: supplier.contact_person,
            address: supplier.address,
            gstin: supplier.gstin,
            notes: supplier.notes,
            isArchived: supplier.is_archived
          }
        },
        client
      );

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({
            name,
            contactPerson,
            phone,
            email,
            address,
            gstin,
            notes
          }),
          201,
          supplier,
          client
        );
      }

      return supplier;
    });

    return result;
  }

  static async updateSupplier(id: string, payload: UpdateSupplierDTO, adminId: string, requestId?: string) {
    const existing = await this.getSupplierById(id);

    const idempotencyKey = (payload as any).idempotencyKey;
    if (idempotencyKey) {
      const cached = await IdempotencyRepository.find(idempotencyKey);
      if (cached) {
        const currentHash = IdempotencyRepository.computeHash({ id, ...payload });
        if (cached.request_hash === currentHash) {
          return cached.response_body;
        } else {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
      }
    }

    let name = existing.name;
    if (payload.name !== undefined) {
      name = this.validateName(payload.name);
      if (name.toLowerCase() !== existing.name.toLowerCase()) {
        const conflict = await SupplierRepository.findActiveByName(name, id);
        if (conflict) {
          throw new DuplicateSupplierError('An active supplier with the same name already exists.');
        }
      }
    }

    const contactPerson = payload.contactPerson !== undefined
      ? this.validateOptionalText(payload.contactPerson, 'Contact person')
      : existing.contact_person;

    const phone = payload.phone !== undefined
      ? this.validatePhone(payload.phone)
      : existing.phone;

    const email = payload.email !== undefined
      ? this.validateEmail(payload.email)
      : existing.email;

    const address = payload.address !== undefined
      ? this.validateOptionalText(payload.address, 'Address')
      : existing.address;

    const gstin = payload.gstin !== undefined
      ? this.validateGSTIN(payload.gstin)
      : existing.gstin;

    const notes = payload.notes !== undefined
      ? this.validateOptionalText(payload.notes, 'Notes')
      : existing.notes;

    const result = await withTransaction(async (client) => {
      const updated = await SupplierRepository.update(
        id,
        {
          name,
          contactPerson,
          phone,
          email,
          address,
          gstin,
          notes
        },
        adminId,
        client
      );

      await AuditService.logEvent(
        {
          adminId,
          action: 'SUPPLIER_UPDATED',
          entityType: 'SUPPLIER',
          entityId: id,
          requestId,
          beforeState: {
            id: existing.id,
            name: existing.name,
            contactPerson: existing.contact_person,
            address: existing.address,
            gstin: existing.gstin,
            notes: existing.notes,
            isArchived: existing.is_archived
          },
          afterState: {
            id: updated.id,
            name: updated.name,
            contactPerson: updated.contact_person,
            address: updated.address,
            gstin: updated.gstin,
            notes: updated.notes,
            isArchived: updated.is_archived
          }
        },
        client
      );

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ id, ...payload }),
          200,
          updated,
          client
        );
      }

      return updated;
    });

    return result;
  }

  static async archiveSupplier(id: string, adminId: string, idempotencyKey?: string, requestId?: string) {
    const existing = await this.getSupplierById(id);
    if (existing.is_archived) {
      throw new ValidationError('Supplier is already archived.');
    }

    if (idempotencyKey) {
      const cached = await IdempotencyRepository.find(idempotencyKey);
      if (cached) {
        const currentHash = IdempotencyRepository.computeHash({ archiveSupplierId: id });
        if (cached.request_hash === currentHash) {
          return cached.response_body;
        } else {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
      }
    }

    const result = await withTransaction(async (client) => {
      const archived = await SupplierRepository.setArchiveStatus(id, true, adminId, client);

      await AuditService.logEvent(
        {
          adminId,
          action: 'SUPPLIER_ARCHIVED',
          entityType: 'SUPPLIER',
          entityId: id,
          requestId,
          beforeState: { id: existing.id, isArchived: existing.is_archived },
          afterState: { id: archived.id, isArchived: archived.is_archived }
        },
        client
      );

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ archiveSupplierId: id }),
          200,
          archived,
          client
        );
      }

      return archived;
    });

    return result;
  }

  static async restoreSupplier(id: string, adminId: string, idempotencyKey?: string, requestId?: string) {
    const existing = await this.getSupplierById(id);
    if (!existing.is_archived) {
      throw new ValidationError('Supplier is not archived.');
    }

    if (idempotencyKey) {
      const cached = await IdempotencyRepository.find(idempotencyKey);
      if (cached) {
        const currentHash = IdempotencyRepository.computeHash({ restoreSupplierId: id });
        if (cached.request_hash === currentHash) {
          return cached.response_body;
        } else {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
      }
    }

    const activeConflict = await SupplierRepository.findActiveByName(existing.name);
    if (activeConflict) {
      throw new DuplicateSupplierError('Cannot restore supplier because an active supplier with the same name already exists.');
    }

    const result = await withTransaction(async (client) => {
      const restored = await SupplierRepository.setArchiveStatus(id, false, adminId, client);

      await AuditService.logEvent(
        {
          adminId,
          action: 'SUPPLIER_RESTORED',
          entityType: 'SUPPLIER',
          entityId: id,
          requestId,
          beforeState: { id: existing.id, isArchived: existing.is_archived },
          afterState: { id: restored.id, isArchived: restored.is_archived }
        },
        client
      );

      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ restoreSupplierId: id }),
          200,
          restored,
          client
        );
      }

      return restored;
    });

    return result;
  }

  static async getPurchaseSummary(
    id: string,
    params: { from?: string; to?: string; page?: number | string; pageSize?: number | string }
  ): Promise<SupplierPurchaseSummary> {
    const existing = await this.getSupplierById(id);

    const page = Math.max(1, parseInt(String(params.page || 1), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(params.pageSize || 20), 10)));

    return {
      supplierId: existing.id,
      totalPurchasesCount: 0,
      totalPurchasesAmount: 0,
      receivedPurchasesCount: 0,
      receivedPurchasesAmount: 0,
      recentPurchases: [],
      pagination: {
        page,
        pageSize,
        total: 0,
        totalPages: 0
      }
    };
  }
}
