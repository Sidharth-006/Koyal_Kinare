import { NextRequest } from 'next/server';
import { ReportService } from '@/modules/reporting/report.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const result = await ReportService.requestExport(body, admin.id);
    return successResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
