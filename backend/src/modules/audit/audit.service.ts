import { AuditRepository } from './audit.repository';
import { PoolClient } from 'pg';

export class AuditService {
  static async logEvent(
    params: {
      adminId?: string | null;
      action: string;
      entityType: string;
      entityId?: string | null;
      requestId?: string | null;
      beforeState?: any;
      afterState?: any;
      metadata?: any;
    },
    client?: PoolClient
  ) {
    return AuditRepository.create(params, client);
  }
}
