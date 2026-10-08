import { BackupRepository } from './backup.repository';
import {
  BackupStorageProvider,
  BackupRunRecord,
  SafeBackupStatusDto,
  SafeBackupFailureCode,
} from './backup.types';
import { MockBackupStorageProvider } from './backup-provider.mock';
import { AuditService } from '@/modules/audit/audit.service';
import { logger } from '@/shared/logging/logger';
import crypto from 'crypto';

export class BackupService {
  private static registeredProvider: BackupStorageProvider | null = null;

  /**
   * Registers a production or custom backup storage provider.
   * In production, an infrastructure-level cloud provider (e.g., AWS S3 / Neon branching)
   * must be registered via this method.
   */
  static registerProvider(provider: BackupStorageProvider): void {
    this.registeredProvider = provider;
  }

  /**
   * Resolves the active backup storage provider.
   * Priority:
   * 1. Explicitly passed provider (e.g., in automated tests or jobs)
   * 2. Registered production provider
   * 3. In non-production (test/development), MockBackupStorageProvider for deterministic verification
   * In production with no registered provider, throws to prevent false claims of cloud backups.
   */
  static resolveProvider(explicitProvider?: BackupStorageProvider): BackupStorageProvider {
    if (explicitProvider) {
      return explicitProvider;
    }
    if (this.registeredProvider) {
      return this.registeredProvider;
    }
    if (process.env.NODE_ENV !== 'production') {
      return new MockBackupStorageProvider();
    }
    throw new Error('Production backup storage provider not configured. External cloud storage infrastructure integration required.');
  }

  /**
   * Schedules a future backup run.
   */
  static async scheduleBackupRun(scheduledFor: Date, requestId?: string): Promise<BackupRunRecord> {
    const run = await BackupRepository.createRun({
      scheduledFor,
      status: 'SCHEDULED',
    });

    await AuditService.logEvent({
      action: 'BACKUP_SCHEDULED',
      entityType: 'BACKUP_RUN',
      entityId: run.id,
      requestId,
      metadata: {
        scheduledFor: scheduledFor.toISOString(),
      },
    });

    logger.info(
      {
        requestId,
        action: 'BACKUP_SCHEDULED',
        backupRunId: run.id,
        scheduledFor: scheduledFor.toISOString(),
      },
      'Backup run scheduled'
    );

    return run;
  }

  /**
   * Executes the daily automated backup workflow.
   * State machine: SCHEDULED -> RUNNING -> SUCCEEDED | FAILED.
   * STRICT: Encrypts/hashes the storage reference; never stores raw credentials or provider paths.
   */
  static async runDailyBackup(
    provider?: BackupStorageProvider,
    scheduledFor?: Date,
    requestId?: string
  ): Promise<{ backupRunId: string; status: 'SUCCEEDED' | 'FAILED'; safeFailureCode?: SafeBackupFailureCode }> {
    const activeProvider = this.resolveProvider(provider);
    const scheduleTime = scheduledFor || new Date();

    // 1. Mark as RUNNING
    const run = await BackupRepository.createRun({
      scheduledFor: scheduleTime,
      status: 'RUNNING',
      startedAt: new Date(),
    });

    await AuditService.logEvent({
      action: 'BACKUP_STARTED',
      entityType: 'BACKUP_RUN',
      entityId: run.id,
      requestId,
    });

    logger.info(
      {
        requestId,
        action: 'BACKUP_STARTED',
        backupRunId: run.id,
      },
      'Daily database backup initiated'
    );

    const startTime = Date.now();

    try {
      // 2. Perform database snapshot via provider
      const snapshot = await activeProvider.createSnapshot();

      // 3. Generate opaque encrypted/hashed backup reference (no technical URL exposed)
      const opaqueReference = 'bkp_' + crypto.createHash('sha256').update(snapshot.reference).digest('hex').substring(0, 32);

      // 4. Calculate retention policy: 30 days
      const retentionUntil = new Date(Date.now() + 30 * 86400 * 1000);

      // 5. Update backup run to SUCCEEDED
      await BackupRepository.markSucceeded({
        id: run.id,
        backupReference: opaqueReference,
        retentionUntil,
      });

      const durationMs = Date.now() - startTime;

      await AuditService.logEvent({
        action: 'BACKUP_SUCCEEDED',
        entityType: 'BACKUP_RUN',
        entityId: run.id,
        requestId,
        metadata: {
          byteSize: snapshot.byteSize,
          durationMs,
        },
      });

      logger.info(
        {
          requestId,
          action: 'BACKUP_SUCCEEDED',
          backupRunId: run.id,
          durationMs,
        },
        'Daily database backup succeeded'
      );

      return { backupRunId: run.id, status: 'SUCCEEDED' };
    } catch (err: any) {
      // 6. Map failure to safe failure code
      let safeFailureCode: SafeBackupFailureCode = 'ERR_BACKUP_EXECUTION';
      const errMsg = (err?.message || '').toLowerCase();

      if (errMsg.includes('storage') || errMsg.includes('connection') || errMsg.includes('timeout')) {
        safeFailureCode = 'ERR_STORAGE_UNAVAILABLE';
      } else if (errMsg.includes('dump') || errMsg.includes('pg_dump')) {
        safeFailureCode = 'ERR_DATABASE_DUMP_FAILED';
      } else if (errMsg.includes('checksum')) {
        safeFailureCode = 'ERR_CHECKSUM_MISMATCH';
      }

      await BackupRepository.markFailed({
        id: run.id,
        safeFailureCode,
      });

      await AuditService.logEvent({
        action: 'BACKUP_FAILED',
        entityType: 'BACKUP_RUN',
        entityId: run.id,
        requestId,
        metadata: {
          safeFailureCode,
        },
      });

      // Developer log contains technical details (redacting secrets)
      logger.error(
        {
          requestId,
          action: 'BACKUP_FAILED',
          backupRunId: run.id,
          safeFailureCode,
          err: err?.message,
        },
        'Daily database backup failed'
      );

      return { backupRunId: run.id, status: 'FAILED', safeFailureCode };
    }
  }

  /**
   * Verifies backup restore integrity in an isolated sandbox.
   * STRICT INVARIANT: Never targets or modifies the production database.
   */
  static async verifyBackupRestore(
    backupRunId: string,
    provider?: BackupStorageProvider,
    requestId?: string
  ): Promise<{ verified: boolean; backupRunId: string; safeFailureCode?: SafeBackupFailureCode }> {
    const activeProvider = this.resolveProvider(provider);

    await AuditService.logEvent({
      action: 'RESTORE_VERIFICATION_STARTED',
      entityType: 'BACKUP_RUN',
      entityId: backupRunId,
      requestId,
    });

    logger.info(
      {
        requestId,
        action: 'RESTORE_VERIFICATION_STARTED',
        backupRunId,
      },
      'Backup restore verification started in isolated verification double'
    );

    const run = await BackupRepository.findById(backupRunId);

    if (!run || run.status !== 'SUCCEEDED') {
      const code: SafeBackupFailureCode = run ? 'ERR_INVALID_BACKUP_STATE' : 'ERR_BACKUP_NOT_FOUND';

      await AuditService.logEvent({
        action: 'RESTORE_VERIFICATION_FAILED',
        entityType: 'BACKUP_RUN',
        entityId: backupRunId,
        requestId,
        metadata: { safeFailureCode: code },
      });

      logger.warn(
        {
          requestId,
          action: 'RESTORE_VERIFICATION_FAILED',
          backupRunId,
          safeFailureCode: code,
        },
        'Backup verification failed: run not found or not in SUCCEEDED state'
      );

      return { verified: false, backupRunId, safeFailureCode: code };
    }

    try {
      // Execute integrity verification test in isolated sandbox double
      const isIntegrityValid = await activeProvider.verifySnapshot(
        run.backup_reference || '',
        ''
      );

      if (!isIntegrityValid) {
        await AuditService.logEvent({
          action: 'RESTORE_VERIFICATION_FAILED',
          entityType: 'BACKUP_RUN',
          entityId: backupRunId,
          requestId,
          metadata: { safeFailureCode: 'ERR_INTEGRITY_CHECK_FAILED' },
        });

        logger.warn(
          {
            requestId,
            action: 'RESTORE_VERIFICATION_FAILED',
            backupRunId,
            safeFailureCode: 'ERR_INTEGRITY_CHECK_FAILED',
          },
          'Backup restore verification failed checksum/integrity'
        );

        return { verified: false, backupRunId, safeFailureCode: 'ERR_INTEGRITY_CHECK_FAILED' };
      }

      await AuditService.logEvent({
        action: 'RESTORE_VERIFICATION_SUCCEEDED',
        entityType: 'BACKUP_RUN',
        entityId: backupRunId,
        requestId,
      });

      logger.info(
        {
          requestId,
          action: 'RESTORE_VERIFICATION_SUCCEEDED',
          backupRunId,
        },
        'Backup restore verification succeeded in isolated verification double'
      );

      return { verified: true, backupRunId };
    } catch (err: any) {
      await AuditService.logEvent({
        action: 'RESTORE_VERIFICATION_FAILED',
        entityType: 'BACKUP_RUN',
        entityId: backupRunId,
        requestId,
        metadata: { safeFailureCode: 'ERR_INTEGRITY_CHECK_FAILED' },
      });

      logger.error(
        {
          requestId,
          action: 'RESTORE_VERIFICATION_FAILED',
          backupRunId,
          err: err?.message,
        },
        'Backup verification encountered error'
      );

      return { verified: false, backupRunId, safeFailureCode: 'ERR_INTEGRITY_CHECK_FAILED' };
    }
  }

  /**
   * Retrieves safe backup status for Admin UI/API consumption.
   * STRICT: NEVER leaks backup_reference, technical paths, provider details, or raw stack traces.
   */
  static async getBackupStatus(): Promise<SafeBackupStatusDto> {
    const latest = await BackupRepository.getLatestRun();
    const lastSuccessful = await BackupRepository.getLastSuccessfulRun();

    // Calculate next scheduled run: next 02:00:00 UTC
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setUTCHours(2, 0, 0, 0);
    if (nextRun.getTime() <= now.getTime()) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    if (!latest) {
      return {
        lastSuccessfulBackupAt: null,
        nextScheduledRun: nextRun.toISOString(),
        status: 'NO_RUNS',
        safeFailureCode: null,
        instruction: 'No automated backups have run yet. Next run is scheduled.',
      };
    }

    let instruction = 'All automated backups are running normally.';
    if (latest.status === 'FAILED') {
      instruction = 'Backup needs attention. Contact the developer.';
    } else if (latest.status === 'RUNNING') {
      instruction = 'Automated backup is currently in progress.';
    } else if (latest.status === 'SCHEDULED') {
      instruction = 'Next automated backup is scheduled.';
    }

    return {
      lastSuccessfulBackupAt: lastSuccessful?.completed_at || null,
      nextScheduledRun: nextRun.toISOString(),
      status: latest.status,
      safeFailureCode: latest.status === 'FAILED' ? latest.safe_failure_code || 'ERR_BACKUP_EXECUTION' : null,
      instruction,
    };
  }

  /**
   * Cleans expired backups based on retention policy.
   * Operational routine — NOT exposed to public API.
   */
  static async cleanExpiredBackups(provider?: BackupStorageProvider): Promise<number> {
    const activeProvider = this.resolveProvider(provider);
    const expiredRuns = await BackupRepository.findExpiredRuns();
    let cleaned = 0;

    for (const run of expiredRuns) {
      if (run.backup_reference) {
        await activeProvider.deleteSnapshot(run.backup_reference);
      }
      await BackupRepository.deleteRun(run.id);
      cleaned++;
    }

    logger.info({ action: 'CLEAN_EXPIRED_BACKUPS', cleanedCount: cleaned }, 'Cleaned expired backups');
    return cleaned;
  }
}
