import { query } from '@/shared/database/client';

export interface ExportJobRecord {
  id: string;
  report_type: string;
  date_range_start: string;
  date_range_end: string;
  file_format: 'EXCEL' | 'PDF';
  file_key?: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  error_message?: string | null;
  requested_by: string;
  created_at: string;
}

export class ExportRepository {
  static async createExportJob(params: {
    reportType: string;
    startDate: string;
    endDate: string;
    fileFormat: 'EXCEL' | 'PDF';
    requestedBy: string;
  }): Promise<ExportJobRecord> {
    const text = `
      INSERT INTO export_jobs (report_type, date_range_start, date_range_end, file_format, status, requested_by)
      VALUES ($1, $2, $3, $4, 'COMPLETED', $5)
      RETURNING *;
    `;
    const { rows } = await query(text, [params.reportType, params.startDate, params.endDate, params.fileFormat, params.requestedBy]);
    return rows[0];
  }
}
