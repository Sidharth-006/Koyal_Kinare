import { NextRequest } from 'next/server';
import { ProfitabilityService } from '@/modules/reporting/profitability.service';
import { ReportService } from '@/modules/reporting/report.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const format = searchParams.get('format');

    const profitability = await ProfitabilityService.getPhase2Profitability(from, to);

    if (format) {
      const upper = format.trim().toUpperCase();
      if (upper === 'XLSX' || upper === 'PDF') {
        const exportResult = await ReportService.requestExport(
          {
            reportType: 'PHASE_2_PROFITABILITY',
            startDate: from,
            endDate: to,
            fileFormat: upper as 'XLSX' | 'PDF',
            reportData: profitability
          },
          admin.id
        );
        return successResponse(exportResult);
      }
    }

    return successResponse({ profitability });
  } catch (err) {
    return errorResponse(err);
  }
}
