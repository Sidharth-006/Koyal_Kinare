import fs from 'fs';
import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  NoSuchKey
} from '@aws-sdk/client-s3';

export interface StorageProvider {
  saveFile(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  getFile(key: string): Promise<Buffer | null>;
  deleteFile(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface S3StorageConfig {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

/**
 * Local filesystem storage provider (used for local development / testing).
 * Stores files in a private directory with path traversal protection.
 */
export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(baseDir || process.env.STORAGE_LOCAL_DIR || path.join(process.cwd(), 'storage', 'attachments'));
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolveSafePath(key: string): string {
    const safeKey = key.replace(/^[/\\]+/, '');
    const resolvedPath = path.resolve(this.baseDir, safeKey);
    if (!resolvedPath.startsWith(this.baseDir)) {
      throw new Error('Access denied: Path traversal detected.');
    }
    return resolvedPath;
  }

  async saveFile(key: string, buffer: Buffer): Promise<void> {
    const targetPath = this.resolveSafePath(key);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(targetPath, buffer);
  }

  async getFile(key: string): Promise<Buffer | null> {
    const targetPath = this.resolveSafePath(key);
    if (!fs.existsSync(targetPath)) {
      return null;
    }
    return fs.promises.readFile(targetPath);
  }

  async deleteFile(key: string): Promise<void> {
    const targetPath = this.resolveSafePath(key);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const targetPath = this.resolveSafePath(key);
    return fs.existsSync(targetPath);
  }
}

/**
 * S3-compatible private object storage provider (AWS S3, Cloudflare R2, MinIO, etc.).
 * Guarantees persistent private storage on ephemeral platforms like Render.
 */
export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor(config: S3StorageConfig, clientOverride?: S3Client) {
    if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error('S3StorageProvider requires bucket, accessKeyId, and secretAccessKey.');
    }
    this.bucket = config.bucket;

    if (clientOverride) {
      this.client = clientOverride;
    } else {
      this.client = new S3Client({
        region: config.region || 'auto',
        endpoint: config.endpoint || undefined,
        forcePathStyle: config.forcePathStyle ?? false,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey
        }
      });
    }
  }

  async saveFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType
    });
    await this.client.send(command);
  }

  async getFile(key: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      });
      const response = await this.client.send(command);
      if (!response.Body) {
        return null;
      }
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (err: any) {
      if (
        err instanceof NoSuchKey ||
        err?.name === 'NoSuchKey' ||
        err?.name === 'NotFound' ||
        err?.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      });
      await this.client.send(command);
    } catch (err: any) {
      if (
        err instanceof NoSuchKey ||
        err?.name === 'NoSuchKey' ||
        err?.name === 'NotFound' ||
        err?.$metadata?.httpStatusCode === 404
      ) {
        return;
      }
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      });
      await this.client.send(command);
      return true;
    } catch (err: any) {
      if (
        err instanceof NoSuchKey ||
        err?.name === 'NoSuchKey' ||
        err?.name === 'NotFound' ||
        err?.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }
}

/**
 * Factory to instantiate the appropriate StorageProvider based on environment configuration.
 *
 * Selection Rules:
 * 1. If STORAGE_PROVIDER === 's3' or (STORAGE_PROVIDER !== 'local' && S3 credentials configured):
 *    Validates required S3 environment variables and instantiates S3StorageProvider.
 * 2. Otherwise:
 *    Instantiates LocalStorageProvider for local development and test execution.
 */
export function createStorageProvider(env: Record<string, string | undefined> = process.env): StorageProvider {
  const provider = (env.STORAGE_PROVIDER || '').trim().toLowerCase();
  const hasS3Config = !!(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);

  if (provider === 's3' || (provider !== 'local' && hasS3Config)) {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error(
        'Missing S3 object storage configuration. S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required.'
      );
    }

    return new S3StorageProvider({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION || 'auto',
      endpoint: env.S3_ENDPOINT || undefined,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true'
    });
  }

  return new LocalStorageProvider(env.STORAGE_LOCAL_DIR);
}

// Active singleton instance
let activeStorageService: StorageProvider = createStorageProvider();

export const StorageService: StorageProvider = {
  saveFile: (key, buffer, mimeType) => activeStorageService.saveFile(key, buffer, mimeType),
  getFile: (key) => activeStorageService.getFile(key),
  deleteFile: (key) => activeStorageService.deleteFile(key),
  exists: (key) => activeStorageService.exists(key)
};

/**
 * Allows setting or resetting the active storage provider (useful for tests and dynamic configuration).
 */
export function setActiveStorageService(provider: StorageProvider): void {
  activeStorageService = provider;
}

export function resetActiveStorageService(): void {
  activeStorageService = createStorageProvider();
}

/**
 * Validates magic numbers / byte signatures for allowed invoice file types.
 * Prevents file-extension spoofing (e.g., .pdf that is actually an executable).
 */
export function detectMimeType(buffer: Buffer): 'image/jpeg' | 'image/png' | 'application/pdf' | null {
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  // Standard PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'image/png';
  }
  // PDF starts with %PDF- (hex: 25 50 44 46 2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2D
  ) {
    return 'application/pdf';
  }
  return null;
}
