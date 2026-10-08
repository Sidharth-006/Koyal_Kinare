import { IdempotencyKeysRepository } from './idempotency-keys.repository';
import { withTransaction } from '@/shared/database/client';
import { AuditService } from '@/modules/audit/audit.service';
import { ConflictError, IdempotencyError } from '@/shared/errors';
import { logger } from '@/shared/logging/logger';
import { PoolClient } from 'pg';

export interface IdempotentExecutionResult<T> {
  statusCode: number;
  data: T;
  cached: boolean;
}

export class IdempotencyEngineService {
  /**
   * Executes a critical mutation with full transactional idempotency guarantees.
   */
  static async execute<T>(params: {
    adminId: string;
    route: string;
    key?: string | null;
    payload?: any;
    mutationFn: (client: PoolClient) => Promise<{ statusCode: number; data: T }>;
    ttlHours?: number;
    requestId?: string;
  }): Promise<IdempotentExecutionResult<T>> {
    const { adminId, route, key, payload, mutationFn, ttlHours = 24, requestId } = params;

    // If no key provided, execute mutation directly within transaction
    if (!key || typeof key !== 'string' || key.trim() === '') {
      const result = await withTransaction(async (client) => {
        return mutationFn(client);
      });
      return { ...result, cached: false };
    }

    const cleanKey = key.trim();
    const requestHash = IdempotencyKeysRepository.computeHash(payload);

    return withTransaction(async (client) => {
      const existing = await IdempotencyKeysRepository.findByKey(adminId, route, cleanKey, client);

      if (existing) {
        const isExpired = new Date(existing.expires_at).getTime() <= Date.now();

        if (!isExpired) {
          // Payload mismatch check
          if (existing.request_hash !== requestHash) {
            await AuditService.logEvent({
              adminId,
              action: 'IDEMPOTENCY_CONFLICT',
              entityType: 'IDEMPOTENCY_KEY',
              requestId,
              metadata: {
                route,
                key: cleanKey,
              },
            });

            logger.warn(
              {
                requestId,
                action: 'IDEMPOTENCY_CONFLICT',
                adminId,
                route,
              },
              'Idempotency key payload mismatch'
            );

            throw new IdempotencyError('Idempotency key payload mismatch for this route.');
          }

          // In-progress concurrent execution check
          if (existing.status === 'IN_PROGRESS') {
            throw new ConflictError(
              'A mutation with this idempotency key is currently in progress. Please retry shortly.'
            );
          }

          // Completed cached response
          if (existing.status === 'COMPLETED') {
            logger.info(
              {
                requestId,
                action: 'IDEMPOTENT_REPLAY',
                adminId,
                route,
              },
              'Replaying stored response for idempotency key'
            );

            return {
              statusCode: existing.response_reference?.statusCode || 200,
              data: existing.response_reference?.data as T,
              cached: true,
            };
          }

          // If previously failed, clean up old record so retry can execute
          await IdempotencyKeysRepository.deleteById(existing.id, client);
        } else {
          // Key expired, delete old record
          await IdempotencyKeysRepository.deleteById(existing.id, client);
        }
      }

      // Record new IN_PROGRESS key
      const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
      const inProgressRecord = await IdempotencyKeysRepository.createInProgress(
        {
          adminId,
          route,
          key: cleanKey,
          requestHash,
          expiresAt,
        },
        client
      );

      try {
        const result = await mutationFn(client);

        // Mark completed with response reference
        await IdempotencyKeysRepository.markCompleted(
          inProgressRecord.id,
          {
            statusCode: result.statusCode,
            data: result.data,
          },
          client
        );

        return { ...result, cached: false };
      } catch (err) {
        // Mark failed or clean up so retries are allowed
        await IdempotencyKeysRepository.markFailed(inProgressRecord.id, client);
        throw err;
      }
    });
  }
}
