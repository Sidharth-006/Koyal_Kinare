import { BackupStorageProvider } from './backup.types';
import crypto from 'crypto';

/**
 * Deterministic Mock Backup Storage Provider for testing and local operation.
 * Simulates storage interactions without requiring live AWS S3 credentials or cloud IAM roles.
 */
export class MockBackupStorageProvider implements BackupStorageProvider {
  private snapshots = new Map<string, { byteSize: number; checksum: string; data: Buffer }>();
  public shouldFailSnapshot = false;
  public shouldFailVerify = false;

  async createSnapshot(): Promise<{ reference: string; byteSize: number; checksum: string }> {
    if (this.shouldFailSnapshot) {
      throw new Error('Simulated storage provider connectivity error (Connection timeout to storage endpoint)');
    }

    const dummyData = Buffer.from(`-- KOYAL KINARE DB DUMP -- ${Date.now()}`);
    const checksum = crypto.createHash('sha256').update(dummyData).digest('hex');
    const reference = `internal/backups/koyal_kinare_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.sql.enc`;

    this.snapshots.set(reference, {
      byteSize: dummyData.length,
      checksum,
      data: dummyData,
    });

    return {
      reference,
      byteSize: dummyData.length,
      checksum,
    };
  }

  async verifySnapshot(reference: string, checksum?: string): Promise<boolean> {
    if (this.shouldFailVerify) {
      return false;
    }

    let item = this.snapshots.get(reference);

    // If reference is an opaque reference (e.g. bkp_...), lookup original snapshot
    if (!item && reference.startsWith('bkp_')) {
      for (const [k, v] of this.snapshots.entries()) {
        const opaque = 'bkp_' + crypto.createHash('sha256').update(k).digest('hex').substring(0, 32);
        if (opaque === reference) {
          item = v;
          break;
        }
      }
    }

    if (!item) {
      return false;
    }

    if (checksum) {
      const calculatedChecksum = crypto.createHash('sha256').update(item.data).digest('hex');
      return calculatedChecksum === checksum;
    }

    return true;
  }

  async deleteSnapshot(reference: string): Promise<boolean> {
    return this.snapshots.delete(reference);
  }

  getSnapshotCount(): number {
    return this.snapshots.size;
  }
}
