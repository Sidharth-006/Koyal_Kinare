import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { RecipeService } from '@/modules/recipe/recipe.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));

    const result = await RecipeService.updateDraft(
      params.id,
      body,
      admin.id,
      requestId
    );

    logger.info({
      action: 'UPDATE_RECIPE_DRAFT',
      versionId: params.id,
      versionNumber: result.versionNumber,
      adminId: admin.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'UPDATE_RECIPE_DRAFT',
      versionId: params.id,
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
