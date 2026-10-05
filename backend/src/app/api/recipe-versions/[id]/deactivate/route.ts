import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { RecipeService } from '@/modules/recipe/recipe.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      undefined;

    const result = await RecipeService.deactivateVersion(
      params.id,
      body,
      admin.id,
      idempotencyKey,
      requestId
    );

    logger.info({
      action: 'DEACTIVATE_RECIPE_VERSION',
      versionId: params.id,
      recipeId: result.recipeId,
      adminId: admin.id,
      requestId,
      idempotencyKey,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'DEACTIVATE_RECIPE_VERSION',
      versionId: params.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
