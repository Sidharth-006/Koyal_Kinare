import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { query } from '@/shared/database/client';
import { AuthRepository } from '@/modules/auth/auth.repository';
import { hashPassword, generateSessionToken } from '@/shared/auth/security';
import { createSessionCookie } from '@/shared/auth/session';
import { PurchaseService } from '@/modules/purchases/purchases.service';
import { PurchaseRepository } from '@/modules/purchases/purchases.repository';
import { SupplierRepository } from '@/modules/supplier/supplier.repository';
import { InventoryRepository } from '@/modules/inventory/inventory.repository';
import { StorageService, StorageProvider, setActiveStorageService, resetActiveStorageService } from '@/shared/storage/storage.service';
import { POST as uploadAttachmentHandler, GET as downloadAttachmentHandler } from '@/app/api/purchases/[id]/attachment/route';

describe('Purchase Attachment Integration Tests', { timeout: 30000 }, () => {
  let adminId: string;
  let authCookie: string;
  let testSupplierId: string;
  let testItemId: string;
  let draftPurchaseId: string;
  let receivedPurchaseId: string;

  // Valid binary payloads with signatures
  const validJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
  const validPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
  const validPdf = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF');

  beforeAll(async () => {
    // 1. Create test admin and session
    const email = `purchase_attachment_admin_${Date.now()}@koyal.com`;
    const passwordHash = await hashPassword('AdminPass123!');
    const admin = await AuthRepository.createAdmin({
      email,
      passwordHash,
      displayName: 'Attachment Admin'
    });
    adminId = admin.id;

    const { rawToken, tokenHash } = generateSessionToken();
    await AuthRepository.createSession({
      adminId: admin.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 86400 * 1000)
    });
    authCookie = createSessionCookie(rawToken);

    // 2. Create supplier & item
    const supplier = await SupplierRepository.create(
      { name: `Attachment Supplier ${Date.now()}` },
      adminId
    );
    testSupplierId = supplier.id;

    const item = await InventoryRepository.create(
      {
        name: `Attachment Item ${Date.now()}`,
        itemType: 'RAW_MATERIAL',
        baseUnit: 'KG',
        minimumStock: '5.000'
      },
      adminId
    );
    testItemId = item.id;

    // 3. Create Draft purchase
    const draft = await PurchaseService.createDraft(
      {
        supplierId: testSupplierId,
        purchaseDate: '2026-09-26',
        paymentMethod: 'CASH',
        invoiceNumber: 'INV-ATT-01',
        lines: [{ inventoryItemId: testItemId, quantity: 10, unitRate: 15 }]
      },
      adminId
    );
    draftPurchaseId = draft.id;

    // 4. Create Received purchase
    const p2 = await PurchaseService.createDraft(
      {
        supplierId: testSupplierId,
        purchaseDate: '2026-09-26',
        paymentMethod: 'CASH',
        invoiceNumber: 'INV-ATT-02',
        lines: [{ inventoryItemId: testItemId, quantity: 5, unitRate: 20 }]
      },
      adminId
    );
    await PurchaseService.receivePurchase(p2.id, adminId, `idemp-recv-${Date.now()}`);
    receivedPurchaseId = p2.id;
  });

  afterAll(async () => {
    // Cleanup purchases, attachments, items, suppliers
    const { rows: purchases } = await query('SELECT id, attachment_id FROM purchases WHERE created_by = $1', [adminId]);
    for (const p of purchases) {
      if (p.attachment_id) {
        const att = await PurchaseRepository.findAttachmentById(p.attachment_id);
        if (att) {
          await StorageService.deleteFile(att.storage_key).catch(() => {});
        }
      }
    }
    await query('DELETE FROM purchase_lines WHERE purchase_id IN (SELECT id FROM purchases WHERE created_by = $1)', [adminId]);
    await query('DELETE FROM purchases WHERE created_by = $1', [adminId]);
    await query('DELETE FROM attachments WHERE uploaded_by = $1', [adminId]);
    await query('DELETE FROM stock_movements WHERE inventory_item_id = $1', [testItemId]);
    await query('DELETE FROM inventory_balances WHERE inventory_item_id = $1', [testItemId]);
    await query('DELETE FROM inventory_items WHERE id = $1', [testItemId]);
    await query('DELETE FROM suppliers WHERE id = $1', [testSupplierId]);
    await query('DELETE FROM audit_logs WHERE admin_id = $1', [adminId]);
    await query('DELETE FROM sessions WHERE admin_id = $1', [adminId]);
    await query('DELETE FROM admins WHERE id = $1', [adminId]);
  });

  function createUploadRequest(
    purchaseId: string,
    fileBuffer?: Buffer,
    fileName?: string,
    mimeType?: string,
    authenticated: boolean = true
  ): NextRequest {
    const formData = new FormData();
    if (fileBuffer && fileName) {
      const blob = new Blob([fileBuffer], { type: mimeType || 'application/octet-stream' });
      formData.append('file', blob, fileName);
    }

    const headers: Record<string, string> = {};
    if (authenticated) {
      headers['cookie'] = authCookie;
    }

    return new NextRequest(new URL(`http://localhost:3000/api/purchases/${purchaseId}/attachment`), {
      method: 'POST',
      headers,
      body: formData
    });
  }

  function createDownloadRequest(purchaseId: string, authenticated: boolean = true): NextRequest {
    const headers: Record<string, string> = {};
    if (authenticated) {
      headers['cookie'] = authCookie;
    }
    return new NextRequest(new URL(`http://localhost:3000/api/purchases/${purchaseId}/attachment`), {
      method: 'GET',
      headers
    });
  }

  // =========================================================================
  // 1. AUTHENTICATION & INPUT VALIDATION
  // =========================================================================
  describe('Authentication & Input Validation', () => {
    it('1. unauthenticated upload request is rejected with 401', async () => {
      const req = createUploadRequest(draftPurchaseId, validPdf, 'invoice.pdf', 'application/pdf', false);
      const res = await uploadAttachmentHandler(req, { params: { id: draftPurchaseId } });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('2. upload without file is rejected with 400', async () => {
      const req = createUploadRequest(draftPurchaseId);
      const res = await uploadAttachmentHandler(req, { params: { id: draftPurchaseId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('File is required');
    });

    it('3. unknown purchase ID returns 404', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000099';
      const req = createUploadRequest(nonExistentId, validPdf, 'invoice.pdf', 'application/pdf');
      const res = await uploadAttachmentHandler(req, { params: { id: nonExistentId } });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
      expect(json.error.message).toContain('Purchase not found');
    });

    it('4. invalid UUID format returns 400', async () => {
      const req = createUploadRequest('not-a-uuid', validPdf, 'invoice.pdf', 'application/pdf');
      const res = await uploadAttachmentHandler(req, { params: { id: 'not-a-uuid' } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('Invalid purchase ID format');
    });
  });

  // =========================================================================
  // 2. MIME & FILE SIZE BOUNDARY ENFORCEMENT
  // =========================================================================
  describe('MIME & File Size Boundaries', () => {
    it('5. unsupported MIME (e.g. text/plain or executable) is rejected with 400', async () => {
      const badBuffer = Buffer.from('console.log("malicious code");');
      const req = createUploadRequest(draftPurchaseId, badBuffer, 'script.js', 'text/javascript');
      const res = await uploadAttachmentHandler(req, { params: { id: draftPurchaseId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('Only JPEG, PNG, and PDF files are allowed');
    });

    it('6. file extension spoofing (e.g. .pdf extension with plain text content) is rejected by magic byte detection', async () => {
      const fakePdf = Buffer.from('This is a text file renamed to fake.pdf');
      const req = createUploadRequest(draftPurchaseId, fakePdf, 'fake.pdf', 'application/pdf');
      const res = await uploadAttachmentHandler(req, { params: { id: draftPurchaseId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('Only JPEG, PNG, and PDF files are allowed');
    });

    it('7. file exceeding 5 MB is rejected with 400', async () => {
      // 5 MB + 10 bytes with PDF header
      const largeBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.alloc(5 * 1024 * 1024 + 10)
      ]);
      const req = createUploadRequest(draftPurchaseId, largeBuffer, 'huge_invoice.pdf', 'application/pdf');
      const res = await uploadAttachmentHandler(req, { params: { id: draftPurchaseId } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain('exceeds the 5 MB limit');
    });
  });

  // =========================================================================
  // 3. SUCCESSFUL UPLOAD LIFECYCLE (JPEG, PNG, PDF)
  // =========================================================================
  describe('Successful Uploads & State Integrity', () => {
    it('8. valid JPEG upload succeeds, stores metadata, and updates purchases.attachment_id', async () => {
      const req = createUploadRequest(draftPurchaseId, validJpeg, 'invoice.jpg', 'image/jpeg');
      const res = await uploadAttachmentHandler(req, { params: { id: draftPurchaseId } });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.attachment.id).toBeDefined();
      expect(json.data.attachment.fileName).toBe('invoice.jpg');
      expect(json.data.attachment.mimeType).toBe('image/jpeg');
      // Crucial: raw storage path / key is NOT leaked to client
      expect(json.data.attachment.storageKey).toBeUndefined();
      expect(json.data.attachment.storage_key).toBeUndefined();

      // Verify DB link
      const updated = await PurchaseRepository.findById(draftPurchaseId);
      expect(updated?.attachment_id).toBe(json.data.attachment.id);

      // Verify attachments table record
      const attRow = await PurchaseRepository.findAttachmentById(json.data.attachment.id);
      expect(attRow).not.toBeNull();
      expect(attRow?.file_name).toBe('invoice.jpg');
      expect(attRow?.mime_type).toBe('image/jpeg');
      expect(attRow?.uploaded_by).toBe(adminId);
    });

    it('9. valid PNG upload succeeds on a received purchase', async () => {
      const req = createUploadRequest(receivedPurchaseId, validPng, 'receipt.png', 'image/png');
      const res = await uploadAttachmentHandler(req, { params: { id: receivedPurchaseId } });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.attachment.mimeType).toBe('image/png');

      const updated = await PurchaseRepository.findById(receivedPurchaseId);
      expect(updated?.attachment_id).toBe(json.data.attachment.id);
      expect(updated?.status).toBe('RECEIVED'); // Status is preserved intact
    });

    it('10. valid PDF upload succeeds and overwrites previous attachment reference cleanly', async () => {
      const req = createUploadRequest(draftPurchaseId, validPdf, 'final_invoice.pdf', 'application/pdf');
      const res = await uploadAttachmentHandler(req, { params: { id: draftPurchaseId } });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.attachment.mimeType).toBe('application/pdf');

      const updated = await PurchaseRepository.findById(draftPurchaseId);
      expect(updated?.attachment_id).toBe(json.data.attachment.id);
    });

    it('11. audit log entry is created on successful upload', async () => {
      const { rows } = await query(
        `SELECT * FROM audit_logs WHERE action = 'PURCHASE_ATTACHMENT_UPLOADED' AND entity_id = $1`,
        [draftPurchaseId]
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].admin_id).toBe(adminId);
    });
  });

  // =========================================================================
  // 4. AUTHORIZED DOWNLOAD / VIEWING API
  // =========================================================================
  describe('Authorized Download / Viewing API', () => {
    it('12. unauthenticated GET /api/purchases/:id/attachment is rejected with 401', async () => {
      const req = createDownloadRequest(draftPurchaseId, false);
      const res = await downloadAttachmentHandler(req, { params: { id: draftPurchaseId } });
      expect(res.status).toBe(401);
    });

    it('13. authenticated GET downloads invoice with correct private streaming headers', async () => {
      const req = createDownloadRequest(draftPurchaseId, true);
      const res = await downloadAttachmentHandler(req, { params: { id: draftPurchaseId } });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(res.headers.get('Cache-Control')).toContain('private');
      expect(res.headers.get('Content-Disposition')).toContain('final_invoice.pdf');

      const arrayBuffer = await res.arrayBuffer();
      const downloadedBuffer = Buffer.from(arrayBuffer);
      expect(downloadedBuffer.equals(validPdf)).toBe(true);
    });

    it('14. download for purchase without attachment returns 404', async () => {
      // Create a purchase without attachment
      const pWithout = await PurchaseService.createDraft(
        {
          supplierId: testSupplierId,
          purchaseDate: '2026-09-26',
          paymentMethod: 'CASH',
          lines: [{ inventoryItemId: testItemId, quantity: 1, unitRate: 10 }]
        },
        adminId
      );

      const req = createDownloadRequest(pWithout.id, true);
      const res = await downloadAttachmentHandler(req, { params: { id: pWithout.id } });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.message).toContain('does not have an attachment');
    });
  });

  // =========================================================================
  // 5. PRODUCTION OBJECT STORAGE ABSTRACTION (S3 PROVIDER INTEGRATION)
  // =========================================================================
  describe('Production Object Storage Abstraction Integration', () => {
    it('15. upload through S3StorageProvider saves object, updates DB, and leaves no raw secrets/keys in API response', async () => {
      const mockStorage = new Map<string, Buffer>();
      const mockS3Provider: StorageProvider = {
        saveFile: vi.fn(async (key, buffer) => {
          mockStorage.set(key, buffer);
        }),
        getFile: vi.fn(async (key) => mockStorage.get(key) || null),
        deleteFile: vi.fn(async (key) => {
          mockStorage.delete(key);
        }),
        exists: vi.fn(async (key) => mockStorage.has(key))
      };

      setActiveStorageService(mockS3Provider);

      try {
        const req = createUploadRequest(draftPurchaseId, validPdf, 's3_invoice.pdf', 'application/pdf');
        const res = await uploadAttachmentHandler(req, { params: { id: draftPurchaseId } });

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.data.attachment.id).toBeDefined();
        expect(json.data.attachment.fileName).toBe('s3_invoice.pdf');
        // No raw storage key or credentials leaked
        expect(json.data.attachment.storageKey).toBeUndefined();
        expect(json.data.attachment.storage_key).toBeUndefined();

        // Verify S3 provider saveFile was invoked
        expect(mockS3Provider.saveFile).toHaveBeenCalledTimes(1);
        const savedKey = (mockS3Provider.saveFile as any).mock.calls[0][0];
        expect(savedKey).toMatch(/^purchases\/[0-9a-f-]+\/[0-9a-f-]+\.pdf$/i);

        // Verify download through S3 provider
        const dlReq = createDownloadRequest(draftPurchaseId, true);
        const dlRes = await downloadAttachmentHandler(dlReq, { params: { id: draftPurchaseId } });
        expect(dlRes.status).toBe(200);
        expect(dlRes.headers.get('Content-Type')).toBe('application/pdf');
        const dlBuffer = Buffer.from(await dlRes.arrayBuffer());
        expect(dlBuffer.equals(validPdf)).toBe(true);
      } finally {
        resetActiveStorageService();
      }
    });

    it('16. cleanup: when DB transaction fails, uploaded object is deleted from storage provider', async () => {
      const mockS3Provider: StorageProvider = {
        saveFile: vi.fn().mockResolvedValue(undefined),
        getFile: vi.fn().mockResolvedValue(null),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(false)
      };

      setActiveStorageService(mockS3Provider);

      try {
        // Mock PurchaseRepository.createAttachment to throw error
        const originalCreateAtt = PurchaseRepository.createAttachment;
        (PurchaseRepository as any).createAttachment = vi.fn().mockRejectedValue(new Error('Simulated DB failure'));

        try {
          const req = createUploadRequest(draftPurchaseId, validPdf, 'fail_invoice.pdf', 'application/pdf');
          const res = await uploadAttachmentHandler(req, { params: { id: draftPurchaseId } });
          expect(res.status).toBe(500);

          // Verify saveFile was called, followed immediately by deleteFile compensation
          expect(mockS3Provider.saveFile).toHaveBeenCalledTimes(1);
          expect(mockS3Provider.deleteFile).toHaveBeenCalledTimes(1);
        } finally {
          (PurchaseRepository as any).createAttachment = originalCreateAtt;
        }
      } finally {
        resetActiveStorageService();
      }
    });
  });
});

