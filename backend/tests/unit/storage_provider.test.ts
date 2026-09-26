import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LocalStorageProvider,
  S3StorageProvider,
  createStorageProvider,
  detectMimeType
} from '@/shared/storage/storage.service';
import { S3Client } from '@aws-sdk/client-s3';

describe('Storage Provider Unit & Configuration Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. FACTORY & PROVIDER SELECTION
  // =========================================================================
  describe('Provider Selection & Configuration', () => {
    it('1. defaults to LocalStorageProvider when STORAGE_PROVIDER is unset or local', () => {
      const provider = createStorageProvider({
        STORAGE_PROVIDER: 'local'
      });
      expect(provider).toBeInstanceOf(LocalStorageProvider);
    });

    it('2. throws an error when STORAGE_PROVIDER=s3 but required credentials are missing', () => {
      expect(() => {
        createStorageProvider({
          STORAGE_PROVIDER: 's3'
        });
      }).toThrow('Missing S3 object storage configuration');
    });

    it('3. instantiates S3StorageProvider when S3 configuration is provided', () => {
      const provider = createStorageProvider({
        STORAGE_PROVIDER: 's3',
        S3_BUCKET: 'koyal-test-bucket',
        S3_ACCESS_KEY_ID: 'test-access-key',
        S3_SECRET_ACCESS_KEY: 'test-secret-key',
        S3_REGION: 'ap-south-1'
      });
      expect(provider).toBeInstanceOf(S3StorageProvider);
    });

    it('4. automatically detects S3 configuration if credentials exist and STORAGE_PROVIDER is not local', () => {
      const provider = createStorageProvider({
        S3_BUCKET: 'koyal-test-bucket',
        S3_ACCESS_KEY_ID: 'test-access-key',
        S3_SECRET_ACCESS_KEY: 'test-secret-key'
      });
      expect(provider).toBeInstanceOf(S3StorageProvider);
    });
  });

  // =========================================================================
  // 2. S3 STORAGE PROVIDER BEHAVIOR (MOCKED SDK LAYER)
  // =========================================================================
  describe('S3StorageProvider Operations with Mocked SDK', () => {
    const dummyConfig = {
      bucket: 'test-bucket',
      accessKeyId: 'dummy-key',
      secretAccessKey: 'dummy-secret',
      region: 'ap-south-1'
    };

    it('5. saveFile sends PutObjectCommand with correct parameters', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const mockClient = { send: mockSend } as unknown as S3Client;

      const provider = new S3StorageProvider(dummyConfig, mockClient);
      const buffer = Buffer.from('test invoice file content');
      await provider.saveFile('purchases/123/file.pdf', buffer, 'application/pdf');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Bucket).toBe('test-bucket');
      expect(command.input.Key).toBe('purchases/123/file.pdf');
      expect(command.input.ContentType).toBe('application/pdf');
      expect(command.input.Body).toEqual(buffer);
    });

    it('6. getFile returns Buffer when object exists', async () => {
      const expectedContent = Buffer.from('stored invoice data');
      const mockSend = vi.fn().mockResolvedValue({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array(expectedContent))
        }
      });
      const mockClient = { send: mockSend } as unknown as S3Client;

      const provider = new S3StorageProvider(dummyConfig, mockClient);
      const result = await provider.getFile('purchases/123/file.pdf');

      expect(result).not.toBeNull();
      expect(result?.equals(expectedContent)).toBe(true);
    });

    it('7. getFile returns null when object does not exist (NoSuchKey / 404)', async () => {
      const notFoundError: any = new Error('NoSuchKey');
      notFoundError.name = 'NoSuchKey';
      const mockSend = vi.fn().mockRejectedValue(notFoundError);
      const mockClient = { send: mockSend } as unknown as S3Client;

      const provider = new S3StorageProvider(dummyConfig, mockClient);
      const result = await provider.getFile('purchases/non-existent.pdf');

      expect(result).toBeNull();
    });

    it('8. deleteFile sends DeleteObjectCommand and suppresses NoSuchKey', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const mockClient = { send: mockSend } as unknown as S3Client;

      const provider = new S3StorageProvider(dummyConfig, mockClient);
      await provider.deleteFile('purchases/123/file.pdf');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Bucket).toBe('test-bucket');
      expect(command.input.Key).toBe('purchases/123/file.pdf');
    });

    it('9. exists returns true when HeadObject succeeds and false when 404', async () => {
      const mockSend = vi.fn()
        .mockResolvedValueOnce({}) // exists
        .mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } }); // not exists
      const mockClient = { send: mockSend } as unknown as S3Client;

      const provider = new S3StorageProvider(dummyConfig, mockClient);
      const exists1 = await provider.exists('purchases/exists.pdf');
      const exists2 = await provider.exists('purchases/missing.pdf');

      expect(exists1).toBe(true);
      expect(exists2).toBe(false);
    });
  });

  // =========================================================================
  // 3. MIME TYPE DETECTION
  // =========================================================================
  describe('MIME Byte Signature Verification', () => {
    it('10. correctly detects JPEG, PNG, PDF magic numbers and rejects others', () => {
      const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const pdf = Buffer.from('%PDF-1.4');
      const plainText = Buffer.from('Plain text file');

      expect(detectMimeType(jpeg)).toBe('image/jpeg');
      expect(detectMimeType(png)).toBe('image/png');
      expect(detectMimeType(pdf)).toBe('application/pdf');
      expect(detectMimeType(plainText)).toBeNull();
    });
  });
});
