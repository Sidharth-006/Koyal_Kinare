import { NextRequest } from 'next/server';
import { requireAdmin } from '@/shared/auth/guard';
import { BackupService } from '@/modules/backup/backup.service';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const backupStatus = await BackupService.getBackupStatus();
    return successResponse({ backupStatus });
  } catch (err) {
    return errorResponse(err);
  }
}
