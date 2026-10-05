import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { RecipeService } from '@/modules/recipe/recipe.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';
import { logger } from '@/shared/logging/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const admin = await requireAdmin(req);
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const missingOnly = searchParams.get('missingOnly') || undefined;
    const page = searchParams.get('page') || undefined;

    const result = await RecipeService.listRecipes({
      status,
      missingOnly,
      page
    });

    logger.info({
      action: 'LIST_RECIPES',
      adminId: admin.id,
      requestId,
      count: result.recipes.length,
      total: result.pagination.total,
      durationMs: Date.now() - startTime,
      outcome: 'SUCCESS'
    });

    return successResponse(result, 200, {}, requestId);
  } catch (err) {
    logger.warn({
      action: 'LIST_RECIPES',
      requestId,
      durationMs: Date.now() - startTime,
      outcome: 'FAILURE',
      error: (err as any)?.message
    });
    return errorResponse(err, requestId);
  }
}
