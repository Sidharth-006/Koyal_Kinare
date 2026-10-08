import { describe, it, expect, beforeEach } from 'vitest';
import { parseDeviceLabel, hashUserAgent, hashIp } from '@/shared/auth/device-label';
import { checkRateLimit, resetRateLimitStore, RateLimitExceededError } from '@/shared/auth/rate-limiter';
import { verifyMutationOrigin } from '@/shared/auth/csrf';
import { NextRequest } from 'next/server';
import { StaleRevisionConflictError } from '@/modules/settings/revision.service';
import { MockBackupStorageProvider } from '@/modules/backup/backup-provider.mock';
import { SafeBackupFailureCode } from '@/modules/backup/backup.types';

describe('Operational Resilience Unit Tests (Module 5)', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  describe('Device Metadata Parsing & Hashing', () => {
    it('should parse Windows Chrome user agent safely', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(parseDeviceLabel(ua)).toBe('Chrome on Windows');
    });

    it('should parse macOS Safari user agent safely', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
      expect(parseDeviceLabel(ua)).toBe('Safari on macOS');
    });

    it('should parse Linux Firefox user agent safely', () => {
      const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0';
      expect(parseDeviceLabel(ua)).toBe('Firefox on Linux');
    });

    it('should parse iOS Safari user agent safely', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      expect(parseDeviceLabel(ua)).toBe('Safari on iOS');
    });

    it('should parse Android Chrome user agent safely', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36';
      expect(parseDeviceLabel(ua)).toBe('Chrome on Android');
    });

    it('should parse Windows Edge user agent safely', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      expect(parseDeviceLabel(ua)).toBe('Edge on Windows');
    });

    it('should return Unknown Device for empty or undefined user agent', () => {
      expect(parseDeviceLabel('')).toBe('Unknown Device');
      expect(parseDeviceLabel(null)).toBe('Unknown Device');
      expect(parseDeviceLabel(undefined)).toBe('Unknown Device');
    });

    it('should produce deterministic one-way SHA-256 hashes for user agents', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const hash1 = hashUserAgent(ua);
      const hash2 = hashUserAgent(ua);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).not.toContain('Mozilla');
    });

    it('should produce deterministic one-way SHA-256 hashes for IP addresses and never leak raw IP', () => {
      const ip = '192.168.1.100';
      const hash = hashIp(ip);
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
      expect(hash).not.toContain('192.168');
      expect(hashIp(null)).toBeNull();
      expect(hashIp('')).toBeNull();
    });
  });

  describe('Rate Limiter Sliding Window', () => {
    it('should allow requests within limit and throw RateLimitExceededError when exceeded', () => {
      const key = 'test-client-1';
      // Limit 3 requests in window
      checkRateLimit(key, 3, 5000);
      checkRateLimit(key, 3, 5000);
      checkRateLimit(key, 3, 5000);

      expect(() => checkRateLimit(key, 3, 5000)).toThrow(RateLimitExceededError);
    });

    it('should isolate rate limits across different keys', () => {
      checkRateLimit('key-A', 1, 5000);
      expect(() => checkRateLimit('key-A', 1, 5000)).toThrow(RateLimitExceededError);

      // key-B should still be allowed
      expect(() => checkRateLimit('key-B', 1, 5000)).not.toThrow();
    });

    it('should reset limits when resetRateLimitStore is called', () => {
      checkRateLimit('reset-key', 1, 5000);
      expect(() => checkRateLimit('reset-key', 1, 5000)).toThrow(RateLimitExceededError);

      resetRateLimitStore();
      expect(() => checkRateLimit('reset-key', 1, 5000)).not.toThrow();
    });
  });

  describe('Origin / CSRF Verification', () => {
    it('should allow GET requests without origin checking', () => {
      const req = new NextRequest('http://localhost:3000/api/settings/sessions', { method: 'GET' });
      expect(() => verifyMutationOrigin(req)).not.toThrow();
    });

    it('should allow localhost mutations in development', () => {
      const req = new NextRequest('http://localhost:3000/api/settings/sessions/revoke-others', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' }
      });
      expect(() => verifyMutationOrigin(req)).not.toThrow();
    });

    it('should reject unauthorized cross-origin mutations', () => {
      const req = new NextRequest('http://localhost:3000/api/settings/sessions/revoke-others', {
        method: 'POST',
        headers: { origin: 'https://malicious-attacker-site.com' }
      });
      expect(() => verifyMutationOrigin(req)).toThrow('Cross-origin request rejected.');
    });
  });

  describe('Optimistic Concurrency & Revision Error', () => {
    it('should format StaleRevisionConflictError with correct HTTP 409 and latestRevision', () => {
      const err = new StaleRevisionConflictError('bill', 42);
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
      expect(err.latestRevision).toBe(42);
      expect(err.domainKey).toBe('bill');
      expect(err.message).toContain('Current revision is 42');
    });
  });

  describe('Mock Backup Storage Provider', () => {
    it('should create snapshot and verify its integrity accurately', async () => {
      const provider = new MockBackupStorageProvider();
      const snapshot = await provider.createSnapshot();

      expect(snapshot.reference).toContain('internal/backups/koyal_kinare_');
      expect(snapshot.byteSize).toBeGreaterThan(0);
      expect(snapshot.checksum).toHaveLength(64);

      const isValid = await provider.verifySnapshot(snapshot.reference, snapshot.checksum);
      expect(isValid).toBe(true);
    });

    it('should fail snapshot creation when simulated failure is turned on', async () => {
      const provider = new MockBackupStorageProvider();
      provider.shouldFailSnapshot = true;

      await expect(provider.createSnapshot()).rejects.toThrow('Simulated storage provider connectivity error');
    });

    it('should report false for invalid snapshot or failed verification flag', async () => {
      const provider = new MockBackupStorageProvider();
      const snapshot = await provider.createSnapshot();

      provider.shouldFailVerify = true;
      const isValid = await provider.verifySnapshot(snapshot.reference, snapshot.checksum);
      expect(isValid).toBe(false);

      provider.shouldFailVerify = false;
      const nonExistent = await provider.verifySnapshot('non-existent-ref', snapshot.checksum);
      expect(nonExistent).toBe(false);
    });

    it('should delete snapshot correctly', async () => {
      const provider = new MockBackupStorageProvider();
      const snapshot = await provider.createSnapshot();
      expect(provider.getSnapshotCount()).toBe(1);

      await provider.deleteSnapshot(snapshot.reference);
      expect(provider.getSnapshotCount()).toBe(0);
    });
  });
});
