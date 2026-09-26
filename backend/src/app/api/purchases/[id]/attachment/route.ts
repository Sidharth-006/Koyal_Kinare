import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { PurchaseService } from '@/modules/purchases/purchases.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';
import { ValidationError } from '@/shared/errors';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/purchases/:id/attachment
 * Upload private invoice proof (JPEG, PNG, PDF <= 5MB)
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);

    if (!params.id || !UUID_REGEX.test(params.id)) {
      throw new ValidationError('Invalid purchase ID format. Expected UUID.');
    }

    // Parse multipart/form-data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw new ValidationError('Failed to parse multipart form data. Please provide a valid file upload.');
    }

    const file = formData.get('file');
    if (!file || typeof file === 'string' || typeof (file as any).arrayBuffer !== 'function') {
      throw new ValidationError('File is required in formData under key "file".');
    }

    const fileObj = file as File;
    const arrayBuffer = await fileObj.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const attachment = await PurchaseService.uploadAttachment(
      {
        purchaseId: params.id,
        fileName: fileObj.name || 'invoice',
        buffer,
        fileSize: fileObj.size,
        clientMime: fileObj.type
      },
      admin.id,
      requestId
    );

    logger.info({
      action: 'UPLOAD_PURCHASE_ATTACHMENT',
      purchaseId: params.id,
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse({ attachment, purchaseId: params.id }, 201, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'UPLOAD_PURCHASE_ATTACHMENT',
      purchaseId: params?.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}

/**
 * GET /api/purchases/:id/attachment
 * Authorized download/viewing of purchase invoice proof
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);

    if (!params.id || !UUID_REGEX.test(params.id)) {
      throw new ValidationError('Invalid purchase ID format. Expected UUID.');
    }

    const { buffer, metadata } = await PurchaseService.getAttachment(params.id);

    logger.info({
      action: 'GET_PURCHASE_ATTACHMENT',
      purchaseId: params.id,
      attachmentId: metadata.id,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': metadata.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(metadata.fileName)}"`,
        'Content-Length': String(metadata.fileSize),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      }
    });
  } catch (err) {
    logger.warn({
      action: 'GET_PURCHASE_ATTACHMENT',
      purchaseId: params?.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
