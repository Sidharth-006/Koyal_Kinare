import { RevisionRepository } from './revision.repository';
import { AuditService } from '@/modules/audit/audit.service';
import { ConflictError } from '@/shared/errors';
import { logger } from '@/shared/logging/logger';
import { PoolClient } from 'pg';

export class StaleRevisionConflictError extends ConflictError {
  public readonly latestRevision: number;
  public readonly domainKey: string;

  constructor(domainKey: string, latestRevision: number) {
    super(`Stale data detected for domain "${domainKey}". Current revision is ${latestRevision}. Please refresh and retry.`);
    this.domainKey = domainKey;
    this.latestRevision = latestRevision;
  }
}

export class RevisionService {
  /**
   * Retrieves the current atomic revision for a given domain.
   */
  static async getCurrentRevision(domainKey: string, client?: PoolClient): Promise<number> {
    const record = await RevisionRepository.getRevision(domainKey, client);
    return record ? record.revision : 1;
  }

  /**
   * Monotonically increments domain revision inside the mutation transaction.
   */
  static async bumpRevision(domainKey: string, client?: PoolClient): Promise<number> {
    return RevisionRepository.bumpRevision(domainKey, client);
  }

  /**
   * Verifies that the client's expected revision matches current database revision.
   * Throws StaleRevisionConflictError (HTTP 409) if stale.
   */
  static async verifyRevision(
    domainKey: string,
    expectedRevision?: number | string | null,
    client?: PoolClient,
    adminId?: string,
    requestId?: string
  ): Promise<void> {
    if (expectedRevision === undefined || expectedRevision === null || expectedRevision === '') {
      return;
    }

    const expectedNum = typeof expectedRevision === 'string' ? parseInt(expectedRevision, 10) : expectedRevision;
    if (isNaN(expectedNum)) return;

    const current = await this.getCurrentRevision(domainKey, client);

    if (current !== expectedNum) {
      await AuditService.logEvent({
        adminId,
        action: 'MATERIAL_DATA_CONFLICT',
        entityType: 'REVISION',
        entityId: domainKey,
        requestId,
        metadata: {
          domainKey,
          expectedRevision: expectedNum,
          latestRevision: current,
        },
      });

      logger.warn(
        {
          requestId,
          action: 'MATERIAL_DATA_CONFLICT',
          adminId,
          domainKey,
          expectedRevision: expectedNum,
          latestRevision: current,
        },
        'Stale revision conflict detected'
      );

      throw new StaleRevisionConflictError(domainKey, current);
    }
  }

  /**
   * Returns a map of all domain revisions.
   */
  static async getAllRevisions(): Promise<Record<string, { revision: number; updatedAt: string }>> {
    const list = await RevisionRepository.getAllRevisions();
    const result: Record<string, { revision: number; updatedAt: string }> = {};
    for (const item of list) {
      result[item.domainKey] = {
        revision: item.revision,
        updatedAt: item.updatedAt,
      };
    }
    return result;
  }
}
