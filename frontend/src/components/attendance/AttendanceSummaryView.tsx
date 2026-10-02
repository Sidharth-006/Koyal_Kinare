'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, ApiError, downloadExportFile } from '@/lib/api';
import {
  AttendanceSummaryResponseDTO,
  StaffDTO
} from '@/lib/types';
import { formatDate, getTodayIsoDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import {
  Download, Filter, RotateCcw, AlertCircle, FileSpreadsheet,
  FileText, Calendar, CheckCircle2, User, Users, Info, Sparkles
} from 'lucide-react';

function getStartOfMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  return `${year}-${month}-01`;
}

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function AttendanceSummaryView() {
  const { showToast } = useToast();
  const today = getTodayIsoDate();

  // Filters state
  const [from, setFrom] = useState<string>(() => getStartOfMonth(today));
  const [to, setTo] = useState<string>(today);
  const [staffId, setStaffId] = useState<string>('');

  // Staff options
  const [staffList, setStaffList] = useState<StaffDTO[]>([]);
  const [loadingStaff, setLoadingStaff] = useState<boolean>(true);

  // Summary data state
  const [summary, setSummary] = useState<AttendanceSummaryResponseDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Export states
  const [exportingXlsx, setExportingXlsx] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  // Load staff list for filter dropdown
  useEffect(() => {
    let isMounted = true;
    async function loadStaff() {
      try {
        const res = await api.listStaff();
        if (isMounted) {
          setStaffList(res.staff || []);
        }
      } catch (err: any) {
        // Staff filter will fall back to All Staff
      } finally {
        if (isMounted) setLoadingStaff(false);
      }
    }
    loadStaff();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch summary
  const fetchSummary = useCallback(async (fromDate: string, toDate: string, selectedStaffId?: string) => {
    if (fromDate > toDate) {
      setError('Start date (from) cannot be after end date (to).');
      showToast('Start date (from) cannot be after end date (to).', 'warning');
      return;
    }

    const dFrom = new Date(fromDate);
    const dTo = new Date(toDate);
    const diffDays = Math.ceil((dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
      setError('Attendance summary date range cannot exceed 366 days.');
      showToast('Date range cannot exceed 366 days.', 'warning');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.getAttendanceSummary(fromDate, toDate, selectedStaffId || undefined);
      setSummary(res);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to load attendance summary.');
      } else {
        setError('Failed to load attendance summary. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Initial load
  useEffect(() => {
    fetchSummary(from, to, staffId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Apply Filter submit
  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSummary(from, to, staffId);
  };

  // Reset Filters to current month & all staff
  const handleResetFilters = () => {
    const defaultFrom = getStartOfMonth(today);
    const defaultTo = today;
    setFrom(defaultFrom);
    setTo(defaultTo);
    setStaffId('');
    fetchSummary(defaultFrom, defaultTo, '');
  };

  // Preset quick selections
  const handleQuickPreset = (preset: 'THIS_MONTH' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'TODAY') => {
    let newFrom = from;
    let newTo = today;

    if (preset === 'THIS_MONTH') {
      newFrom = getStartOfMonth(today);
      newTo = today;
    } else if (preset === 'LAST_7_DAYS') {
      newFrom = shiftDate(today, -6);
      newTo = today;
    } else if (preset === 'LAST_30_DAYS') {
      newFrom = shiftDate(today, -29);
      newTo = today;
    } else if (preset === 'TODAY') {
      newFrom = today;
      newTo = today;
    }

    setFrom(newFrom);
    setTo(newTo);
    fetchSummary(newFrom, newTo, staffId);
  };

  // Export handlers
  const handleExport = async (format: 'XLSX' | 'PDF') => {
    if (from > to) {
      showToast('Start date (from) cannot be after end date (to).', 'warning');
      return;
    }

    if (format === 'XLSX') {
      if (exportingXlsx || exportingPdf) return;
      setExportingXlsx(true);
    } else {
      if (exportingPdf || exportingXlsx) return;
      setExportingPdf(true);
    }

    try {
      const res = await api.getAttendanceReport({
        from,
        to,
        staffId: staffId || undefined,
        format
      });

      const selectedStaff = staffList.find((s) => s.id === staffId);
      const staffSuffix = selectedStaff?.fullName
        ? `_${selectedStaff.fullName.trim().replace(/[^a-zA-Z0-9]/g, '_')}`
        : '';
      const ext = format === 'XLSX' ? 'xlsx' : 'pdf';
      const filename = `attendance_summary_${from}_to_${to}${staffSuffix}.${ext}`;

      downloadExportFile(res, filename);
      showToast(`Attendance report downloaded successfully as ${format}.`, 'success');
    } catch (err: any) {
      if (err instanceof ApiError) {
        showToast(err.message || `Failed to export attendance ${format}.`, 'error');
      } else {
        showToast(`Failed to export attendance ${format}. Please try again.`, 'error');
      }
    } finally {
      if (format === 'XLSX') setExportingXlsx(false);
      else setExportingPdf(false);
    }
  };

  // Avatar helper
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (parts[0]?.[0] || 'S').toUpperCase();
  };

  const metrics = summary?.metrics;
  const staffSummaries = summary?.staffSummaries || [];

  return (
    <div className="space-y-6">
      {/* Filter and Export Action Bar */}
      <Card className="p-4 md:p-5">
        <form onSubmit={handleApplyFilters} className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 flex-1">
              <div>
                <label htmlFor="summary-from" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  From Date *
                </label>
                <input
                  id="summary-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full bg-cream-50/80 border border-border rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 cursor-pointer shadow-2xs"
                  required
                />
              </div>

              <div>
                <label htmlFor="summary-to" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  To Date *
                </label>
                <input
                  id="summary-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full bg-cream-50/80 border border-border rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 cursor-pointer shadow-2xs"
                  required
                />
              </div>

              <div>
                <label htmlFor="summary-staff" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Staff Filter
                </label>
                <select
                  id="summary-staff"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="w-full bg-cream-50/80 border border-border rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 cursor-pointer shadow-2xs"
                  disabled={loadingStaff}
                >
                  <option value="">All Staff Members</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.roleTitle}){s.isArchived ? ' [Archived]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={loading}
                icon={<Filter className="w-4 h-4" />}
              >
                Apply Filters
              </Button>

              {(from !== getStartOfMonth(today) || to !== today || staffId !== '') && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleResetFilters}
                  disabled={loading}
                  icon={<RotateCcw className="w-4 h-4" />}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Quick Presets & Export Buttons row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
            {/* Quick date chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-500 mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => handleQuickPreset('TODAY')}
                className="px-2.5 py-1 rounded-lg bg-cream-100/70 hover:bg-cream-200 border border-border text-slate-700 font-medium transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('LAST_7_DAYS')}
                className="px-2.5 py-1 rounded-lg bg-cream-100/70 hover:bg-cream-200 border border-border text-slate-700 font-medium transition-colors cursor-pointer"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('THIS_MONTH')}
                className="px-2.5 py-1 rounded-lg bg-cream-100/70 hover:bg-cream-200 border border-border text-slate-700 font-medium transition-colors cursor-pointer"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('LAST_30_DAYS')}
                className="px-2.5 py-1 rounded-lg bg-cream-100/70 hover:bg-cream-200 border border-border text-slate-700 font-medium transition-colors cursor-pointer"
              >
                Last 30 Days
              </button>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleExport('XLSX')}
                isLoading={exportingXlsx}
                disabled={exportingXlsx || exportingPdf || loading}
                icon={<FileSpreadsheet className="w-4 h-4 text-emerald-700" />}
              >
                Export Excel
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleExport('PDF')}
                isLoading={exportingPdf}
                disabled={exportingXlsx || exportingPdf || loading}
                icon={<FileText className="w-4 h-4 text-rose-700" />}
              >
                Export PDF
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      )}

      {/* Error Card */}
      {!loading && error && (
        <Card className="p-8 text-center border-rose-200 bg-rose-50/50">
          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
            <AlertCircle className="w-10 h-10 text-rose-600" />
            <h3 className="text-base font-bold text-rose-900">Attendance Summary Error</h3>
            <p className="text-xs text-rose-700 font-medium">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSummary(from, to, staffId)}
              className="mt-2"
              icon={<RotateCcw className="w-4 h-4" />}
            >
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Summary Content */}
      {!loading && !error && metrics && (
        <div className="space-y-6">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Attendance Rate Card (Spans 2 columns on wide screens) */}
            <Card className="col-span-2 p-4 md:p-5 flex flex-col justify-between border-forest-800/20 bg-forest-900 text-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-forest-200">
                  Attendance Rate
                </span>
                <Badge variant="forest" className="bg-emerald-600 text-white font-bold">
                  {metrics.attendanceRate}%
                </Badge>
              </div>

              <div className="my-2">
                <div className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                  {metrics.attendanceRate}%
                </div>
                <div className="w-full bg-forest-800 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, metrics.attendanceRate))}%` }}
                  />
                </div>
              </div>

              <div className="text-[11px] text-forest-200/90 leading-tight">
                <span className="font-semibold text-white">{metrics.effectivePresentDays}</span> effective days /{' '}
                <span className="font-semibold text-white">{metrics.workingDaysDenominator}</span> working base
              </div>
            </Card>

            {/* Total Recorded */}
            <Card className="p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Entries
              </span>
              <div className="text-2xl md:text-3xl font-extrabold text-forest-900 my-1">
                {metrics.totalRecordedEntries}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                across {metrics.totalRecordedDays} day{metrics.totalRecordedDays === 1 ? '' : 's'}
              </div>
            </Card>

            {/* Present Count */}
            <Card className="p-4 flex flex-col justify-between border-emerald-200/60 bg-emerald-50/30">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Present
              </span>
              <div className="text-2xl md:text-3xl font-extrabold text-emerald-700 my-1">
                {metrics.presentCount}
              </div>
              <div className="text-[11px] text-emerald-700/80 font-medium">
                Full-day shifts
              </div>
            </Card>

            {/* Half Day Count */}
            <Card className="p-4 flex flex-col justify-between border-sky-200/60 bg-sky-50/30">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
                Half Day
              </span>
              <div className="text-2xl md:text-3xl font-extrabold text-sky-700 my-1">
                {metrics.halfDayCount}
              </div>
              <div className="text-[11px] text-sky-700/80 font-medium">
                0.5 day credit
              </div>
            </Card>

            {/* Absent Count */}
            <Card className="p-4 flex flex-col justify-between border-rose-200/60 bg-rose-50/30">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                Absent
              </span>
              <div className="text-2xl md:text-3xl font-extrabold text-rose-700 my-1">
                {metrics.absentCount}
              </div>
              <div className="text-[11px] text-rose-700/80 font-medium">
                Unexcused missed
              </div>
            </Card>
          </div>

          {/* Secondary Stats Row: Leave & Off Days + Denominator Explanation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-3.5 flex items-center justify-between border-amber-200/60 bg-amber-50/30">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                  Approved Leaves
                </span>
                <span className="text-xs text-amber-700/90 font-medium">Authorized absence</span>
              </div>
              <span className="text-2xl font-bold text-amber-700">{metrics.leaveCount}</span>
            </Card>

            <Card className="p-3.5 flex items-center justify-between border-slate-200 bg-slate-50/50">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                  Weekly Off Days
                </span>
                <span className="text-xs text-slate-500 font-medium">Excluded from denominator</span>
              </div>
              <span className="text-2xl font-bold text-slate-700">{metrics.offDayCount}</span>
            </Card>

            <Card className="p-3.5 flex items-center gap-2.5 bg-cream-50 border-border text-slate-600 text-xs">
              <Info className="w-4 h-4 text-forest-700 shrink-0" />
              <div className="leading-tight">
                <span className="font-semibold text-slate-700 block">Denominator Formula:</span>
                <span className="text-[11px] text-slate-500">
                  {metrics.formulaDescription || 'Effective Present Days / (Total Entries - Off Days) * 100'}
                </span>
              </div>
            </Card>
          </div>

          {/* Staff-Wise Attendance Breakdown */}
          <Card className="p-0 overflow-hidden border-border">
            <div className="p-4 md:p-5 bg-cream-50/70 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-forest-800 text-base">
                  Staff-Wise Attendance Roster
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Individual attendance rates and status breakdowns from {formatDate(from)} to {formatDate(to)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="forest">
                  {staffSummaries.length} Staff Member{staffSummaries.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </div>

            {/* Empty State */}
            {staffSummaries.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No attendance entries recorded</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  No attendance records were found for the selected date range and staff filter.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop / Tablet Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-cream-50/40 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-4">Staff Member</th>
                        <th className="py-3 px-3 text-center">Present</th>
                        <th className="py-3 px-3 text-center">Half Day</th>
                        <th className="py-3 px-3 text-center">Absent</th>
                        <th className="py-3 px-3 text-center">Leave</th>
                        <th className="py-3 px-3 text-center">Off Day</th>
                        <th className="py-3 px-3 text-center">Working Base</th>
                        <th className="py-3 px-3 text-center">Total</th>
                        <th className="py-3 px-4 text-right">Attendance Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {staffSummaries.map((s) => (
                        <tr key={s.staffId} className="hover:bg-cream-50/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-forest-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {getInitials(s.staffName)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <span>{s.staffName}</span>
                                  {s.isArchived && (
                                    <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                                      Archived
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-slate-500">{s.roleTitle}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-center font-bold text-emerald-700">
                            {s.presentCount}
                          </td>

                          <td className="py-3.5 px-3 text-center font-bold text-sky-700">
                            {s.halfDayCount}
                          </td>

                          <td className="py-3.5 px-3 text-center font-bold text-rose-700">
                            {s.absentCount}
                          </td>

                          <td className="py-3.5 px-3 text-center font-bold text-amber-700">
                            {s.leaveCount}
                          </td>

                          <td className="py-3.5 px-3 text-center font-medium text-slate-600">
                            {s.offDayCount}
                          </td>

                          <td className="py-3.5 px-3 text-center font-medium text-slate-700">
                            {s.workingDaysDenominator}
                          </td>

                          <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                            {s.totalEntries}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-2 justify-end">
                              <span
                                className={`text-sm font-extrabold ${
                                  s.attendanceRate >= 90
                                    ? 'text-emerald-700'
                                    : s.attendanceRate >= 75
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                                }`}
                              >
                                {s.attendanceRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden divide-y divide-border-subtle">
                  {staffSummaries.map((s) => (
                    <div key={s.staffId} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-forest-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {getInitials(s.staffName)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                              <span>{s.staffName}</span>
                              {s.isArchived && (
                                <Badge variant="neutral" className="text-[9px] py-0 px-1">
                                  Archived
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-slate-500">{s.roleTitle}</span>
                          </div>
                        </div>

                        <Badge
                          variant={s.attendanceRate >= 90 ? 'success' : s.attendanceRate >= 75 ? 'warning' : 'danger'}
                          className="text-xs font-bold"
                        >
                          {s.attendanceRate}%
                        </Badge>
                      </div>

                      {/* Stat chips */}
                      <div className="grid grid-cols-5 gap-1 text-center text-xs">
                        <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                          <span className="text-[10px] text-emerald-800 block">Pres</span>
                          <strong className="text-emerald-900 font-bold">{s.presentCount}</strong>
                        </div>
                        <div className="p-1.5 bg-sky-50 rounded-lg border border-sky-100">
                          <span className="text-[10px] text-sky-800 block">Half</span>
                          <strong className="text-sky-900 font-bold">{s.halfDayCount}</strong>
                        </div>
                        <div className="p-1.5 bg-rose-50 rounded-lg border border-rose-100">
                          <span className="text-[10px] text-rose-800 block">Abs</span>
                          <strong className="text-rose-900 font-bold">{s.absentCount}</strong>
                        </div>
                        <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-100">
                          <span className="text-[10px] text-amber-800 block">Leave</span>
                          <strong className="text-amber-900 font-bold">{s.leaveCount}</strong>
                        </div>
                        <div className="p-1.5 bg-slate-100 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-700 block">Off</span>
                          <strong className="text-slate-900 font-bold">{s.offDayCount}</strong>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 flex justify-between pt-1">
                        <span>Working Base: <strong>{s.workingDaysDenominator}</strong></span>
                        <span>Total Entries: <strong>{s.totalEntries}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
