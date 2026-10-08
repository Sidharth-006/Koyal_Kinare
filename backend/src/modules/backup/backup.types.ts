export type BackupStatus = 'SCHEDULED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type SafeBackupFailureCode =
  | 'ERR_STORAGE_UNAVAILABLE'
  | 'ERR_DATABASE_DUMP_FAILED'
  | 'ERR_CHECKSUM_MISMATCH'
  | 'ERR_INTEGRITY_CHECK_FAILED'
  | 'ERR_TIMEOUT'
  | 'ERR_BACKUP_EXECUTION'
  | 'ERR_BACKUP_NOT_FOUND'
  | 'ERR_INVALID_BACKUP_STATE';

export interface BackupRunRecord {
  id: string;
  scheduled_for: string;
  started_at?: string | null;
  completed_at?: string | null;
  status: BackupStatus;
  backup_reference?: string | null;
  safe_failure_code?: string | null;
  retention_until?: string | null;
  created_at: string;
}

export interface BackupStorageProvider {
  /**
   * Generates a cold database snapshot artifact and persists it to secure storage.
   */
  createSnapshot(): Promise<{ reference: string; byteSize: number; checksum: string }>;

  /**
   * Validates archive integrity in an isolated, sandbox/verification double.
   * STRICT INVARIANT: Never targets or modifies the production database.
   */
  verifySnapshot(reference: string, checksum: string): Promise<boolean>;

  /**
   * Deletes snapshot from storage after retention expiration.
   */
  deleteSnapshot(reference: string): Promise<boolean>;
}

export interface SafeBackupStatusDto {
  lastSuccessfulBackupAt: string | null;
  nextScheduledRun: string | null;
  status: BackupStatus | 'NO_RUNS';
  safeFailureCode: string | null;
  instruction: string;
}
