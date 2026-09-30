import { describe, it, expect } from 'vitest';
import { validateDateRange, normalizeReportFormat } from '@/modules/reporting/inventory-reports.service';

describe('Inventory Reports Validation Unit Tests', () => {
  it('should accept valid date range within 366 days', () => {
    expect(() => validateDateRange('2026-01-01', '2026-01-31')).not.toThrow();
    expect(() => validateDateRange('2026-01-01', '2026-12-31')).not.toThrow();
  });

  it('should throw ValidationError if start or end date is missing', () => {
    expect(() => validateDateRange('', '2026-01-31')).toThrow('Start date (from) and end date (to) are required.');
    expect(() => validateDateRange('2026-01-01', '')).toThrow('Start date (from) and end date (to) are required.');
  });

  it('should throw ValidationError if start date is after end date', () => {
    expect(() => validateDateRange('2026-02-01', '2026-01-01')).toThrow('Start date (from) cannot be after end date (to).');
  });

  it('should throw ReportTooLargeError if date range exceeds 366 days', () => {
    expect(() => validateDateRange('2025-01-01', '2026-03-01')).toThrow('Requested report date range exceeds maximum allowed range (366 days).');
  });

  it('should normalize valid formats XLSX and PDF', () => {
    expect(normalizeReportFormat('XLSX')).toBe('XLSX');
    expect(normalizeReportFormat('xlsx')).toBe('XLSX');
    expect(normalizeReportFormat('PDF')).toBe('PDF');
    expect(normalizeReportFormat('pdf')).toBe('PDF');
  });

  it('should reject invalid report formats', () => {
    expect(() => normalizeReportFormat('DOCX')).toThrow('Invalid format. Supported formats are XLSX and PDF.');
    expect(() => normalizeReportFormat(null)).toThrow('Report format is required (XLSX or PDF).');
  });
});
