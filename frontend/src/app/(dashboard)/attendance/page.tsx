'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import {
  DailyAttendanceRosterItemDTO,
  AttendanceStatus,
  BulkAttendanceEntryInput,
  SaveAttendancePayload
} from '@/lib/types';
import { formatDate, getTodayIsoDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import { AttendanceStatusBadge } from '@/components/attendance/AttendanceStatusBadge';
import { AttendanceSummaryView } from '@/components/attendance/AttendanceSummaryView';
import {
  Calendar, ChevronLeft, ChevronRight, Save, RotateCcw,
  CheckCircle2, AlertCircle, Clock, Users, ArrowLeft,
  CalendarCheck, Shield, FileText, Check, BarChart3
} from 'lucide-react';

interface RowState {
  status: AttendanceStatus | null;
  checkInTime: string; // "HH:mm"
  checkOutTime: string; // "HH:mm"
  note: string;
}

const STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  activeClass: string;
  borderClass: string;
}[] = [
  {
    value: 'PRESENT',
    label: 'Present',
    activeClass: 'bg-emerald-600 text-white shadow-xs',
    borderClass: 'border-emerald-600'
  },
  {
    value: 'HALF_DAY',
    label: 'Half Day',
    activeClass: 'bg-sky-600 text-white shadow-xs',
    borderClass: 'border-sky-600'
  },
  {
    value: 'ABSENT',
    label: 'Absent',
    activeClass: 'bg-rose-600 text-white shadow-xs',
    borderClass: 'border-rose-600'
  },
  {
    value: 'LEAVE',
    label: 'Leave',
    activeClass: 'bg-amber-600 text-white shadow-xs',
    borderClass: 'border-amber-600'
  },
  {
    value: 'OFF_DAY',
    label: 'Off Day',
    activeClass: 'bg-slate-700 text-white shadow-xs',
    borderClass: 'border-slate-700'
  }
];

function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function isoToTimeInput(isoStr?: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function timeInputToIso(businessDate: string, timeStr?: string | null): string | null {
  if (!timeStr || !timeStr.trim()) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const hours = parts[0].padStart(2, '0');
  const minutes = parts[1].padStart(2, '0');
  const d = new Date(`${businessDate}T${hours}:${minutes}:00`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function AttendanceRosterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const queryDate = searchParams.get('date');
  const queryTab = searchParams.get('tab');
  const today = getTodayIsoDate();
  const selectedDate = queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate) ? queryDate : today;

  const [activeTab, setActiveTab] = useState<'ROSTER' | 'SUMMARY'>(
    queryTab === 'summary' ? 'SUMMARY' : 'ROSTER'
  );

  useEffect(() => {
    if (queryTab === 'summary') {
      setActiveTab('SUMMARY');
    } else if (queryTab === 'roster') {
      setActiveTab('ROSTER');
    }
  }, [queryTab]);

  const handleTabChange = (tab: 'ROSTER' | 'SUMMARY') => {
    setActiveTab(tab);
    if (tab === 'SUMMARY') {
      router.push('/attendance?tab=summary');
    } else {
      router.push(`/attendance?date=${selectedDate}`);
    }
  };

  const [roster, setRoster] = useState<DailyAttendanceRosterItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local edit states per staffId
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [savingBulk, setSavingBulk] = useState(false);
  const [savingSingleId, setSavingSingleId] = useState<string | null>(null);

  // Map of original roster items by staffId for fast dirty checking
  const rosterMap = useMemo(() => {
    const map: Record<string, DailyAttendanceRosterItemDTO> = {};
    roster.forEach((r) => {
      map[r.staffId] = r;
    });
    return map;
  }, [roster]);

  // Load roster data from backend
  const loadRoster = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDailyAttendance(date);
      setRoster(res.roster || []);

      // Initialize local row states
      const initial: Record<string, RowState> = {};
      (res.roster || []).forEach((item) => {
        initial[item.staffId] = {
          status: item.status,
          checkInTime: isoToTimeInput(item.checkInAt),
          checkOutTime: isoToTimeInput(item.checkOutAt),
          note: item.note || ''
        };
      });
      setRowStates(initial);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to load attendance roster.');
      } else {
        setError('Failed to load attendance roster. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoster(selectedDate);
  }, [selectedDate, loadRoster]);

  // Sync date changes with URL query parameter
  const handleDateChange = (newDate: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    router.push(`/attendance?date=${newDate}`);
  };

  const handlePrevDay = () => {
    handleDateChange(shiftDate(selectedDate, -1));
  };

  const handleNextDay = () => {
    handleDateChange(shiftDate(selectedDate, 1));
  };

  const handleToday = () => {
    handleDateChange(today);
  };

  // Helper for row dirty check
  const isRowDirty = useCallback(
    (staffId: string): boolean => {
      const orig = rosterMap[staffId];
      const current = rowStates[staffId];
      if (!orig || !current) return false;

      const origStatus = orig.status || null;
      const origCheckIn = isoToTimeInput(orig.checkInAt);
      const origCheckOut = isoToTimeInput(orig.checkOutAt);
      const origNote = orig.note || '';

      return (
        current.status !== origStatus ||
        current.checkInTime !== origCheckIn ||
        current.checkOutTime !== origCheckOut ||
        current.note !== origNote
      );
    },
    [rosterMap, rowStates]
  );

  // List of staff IDs with unsaved changes
  const changedStaffIds = useMemo(() => {
    return Object.keys(rowStates).filter((id) => isRowDirty(id));
  }, [rowStates, isRowDirty]);

  const hasUnsavedChanges = changedStaffIds.length > 0;

  // Local state change handlers
  const updateRowStatus = (staffId: string, status: AttendanceStatus) => {
    setRowStates((prev) => {
      const current = prev[staffId] || { status: null, checkInTime: '', checkOutTime: '', note: '' };
      const isAbsence = status === 'ABSENT' || status === 'LEAVE' || status === 'OFF_DAY';
      return {
        ...prev,
        [staffId]: {
          ...current,
          status,
          // Clear time fields if changing to absence
          checkInTime: isAbsence ? '' : current.checkInTime,
          checkOutTime: isAbsence ? '' : current.checkOutTime
        }
      };
    });
  };

  const updateRowField = (
    staffId: string,
    field: 'checkInTime' | 'checkOutTime' | 'note',
    value: string
  ) => {
    setRowStates((prev) => {
      const current = prev[staffId] || { status: null, checkInTime: '', checkOutTime: '', note: '' };
      return {
        ...prev,
        [staffId]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  // Discard all unsaved changes
  const handleDiscardChanges = () => {
    const resetStates: Record<string, RowState> = {};
    roster.forEach((item) => {
      resetStates[item.staffId] = {
        status: item.status,
        checkInTime: isoToTimeInput(item.checkInAt),
        checkOutTime: isoToTimeInput(item.checkOutAt),
        note: item.note || ''
      };
    });
    setRowStates(resetStates);
    showToast('Unsaved changes discarded', 'info');
  };

  // Single Row Reset
  const handleResetRow = (staffId: string) => {
    const orig = rosterMap[staffId];
    if (!orig) return;
    setRowStates((prev) => ({
      ...prev,
      [staffId]: {
        status: orig.status,
        checkInTime: isoToTimeInput(orig.checkInAt),
        checkOutTime: isoToTimeInput(orig.checkOutAt),
        note: orig.note || ''
      }
    }));
  };

  // Single-row save with expectedUpdatedAt optimistic concurrency
  const handleSaveSingleRow = async (staffId: string) => {
    const state = rowStates[staffId];
    const orig = rosterMap[staffId];
    if (!state || !orig) return;

    if (!state.status) {
      showToast(`Please select an attendance status for ${orig.staffName}.`, 'warning');
      return;
    }

    const isPresentOrHalf = state.status === 'PRESENT' || state.status === 'HALF_DAY';

    // Local validation for times
    if (isPresentOrHalf && state.checkInTime && state.checkOutTime) {
      if (state.checkOutTime <= state.checkInTime) {
        showToast(`Check-out must be after check-in for ${orig.staffName}.`, 'error');
        return;
      }
    }

    if (state.note && state.note.length > 500) {
      showToast(`Note for ${orig.staffName} cannot exceed 500 characters.`, 'error');
      return;
    }

    setSavingSingleId(staffId);

    const payload: SaveAttendancePayload = {
      status: state.status,
      checkInAt: isPresentOrHalf ? timeInputToIso(selectedDate, state.checkInTime) : null,
      checkOutAt: isPresentOrHalf ? timeInputToIso(selectedDate, state.checkOutTime) : null,
      note: state.note.trim() || null,
      expectedUpdatedAt: orig.updatedAt || null
    };

    try {
      const res = await api.saveSingleAttendance(staffId, selectedDate, payload);
      showToast(`Attendance updated for ${orig.staffName}`, 'success');

      // Update local roster record to reflect saved state
      setRoster((prev) =>
        prev.map((item) =>
          item.staffId === staffId
            ? {
                ...item,
                attendanceId: res.record.id,
                status: res.record.status,
                checkInAt: res.record.check_in_at || res.record.checkInAt || null,
                checkOutAt: res.record.check_out_at || res.record.checkOutAt || null,
                note: res.record.note,
                updatedAt: res.record.updated_at || null
              }
            : item
        )
      );
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'ATTENDANCE_CONFLICT') {
          showToast('Attendance record was updated on another device. Refresh before saving again.', 'error');
        } else {
          showToast(err.message || 'Failed to save attendance', 'error');
        }
      } else {
        showToast('An unexpected error occurred. Please try again.', 'error');
      }
    } finally {
      setSavingSingleId(null);
    }
  };

  // Bulk Save All Changed Rows
  const handleSaveAll = async () => {
    if (savingBulk || changedStaffIds.length === 0) return;

    // Validate all changed rows
    for (const id of changedStaffIds) {
      const state = rowStates[id];
      const orig = rosterMap[id];
      if (!state.status) {
        showToast(`Please select a status for ${orig?.staffName || 'all modified staff'}.`, 'warning');
        return;
      }

      const isPresentOrHalf = state.status === 'PRESENT' || state.status === 'HALF_DAY';
      if (isPresentOrHalf && state.checkInTime && state.checkOutTime) {
        if (state.checkOutTime <= state.checkInTime) {
          showToast(`Check-out must be after check-in for ${orig?.staffName}.`, 'error');
          return;
        }
      }

      if (state.note && state.note.length > 500) {
        showToast(`Note for ${orig?.staffName} cannot exceed 500 characters.`, 'error');
        return;
      }
    }

    setSavingBulk(true);

    const idempotencyKey =
      typeof window !== 'undefined' && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `ik_bulk_att_${Date.now()}`;

    const entries: BulkAttendanceEntryInput[] = changedStaffIds.map((id) => {
      const state = rowStates[id];
      const isPresentOrHalf = state.status === 'PRESENT' || state.status === 'HALF_DAY';
      return {
        staffId: id,
        status: state.status!,
        checkInAt: isPresentOrHalf ? timeInputToIso(selectedDate, state.checkInTime) : undefined,
        checkOutAt: isPresentOrHalf ? timeInputToIso(selectedDate, state.checkOutTime) : undefined,
        note: state.note.trim() || undefined
      };
    });

    try {
      const res = await api.bulkSaveAttendance(selectedDate, { entries }, idempotencyKey);
      showToast(`Saved attendance for ${res.totalSaved} staff member(s)`, 'success');
      // Reload roster to refresh server timestamps and sync state
      await loadRoster(selectedDate);
    } catch (err: any) {
      // Preserve user local edits; do not reset roster
      if (err instanceof ApiError) {
        showToast(err.message || 'Failed to save attendance roster', 'error');
      } else {
        showToast('An unexpected error occurred while saving. Please try again.', 'error');
      }
    } finally {
      setSavingBulk(false);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let leave = 0;
    let offDay = 0;
    let unrecorded = 0;

    roster.forEach((item) => {
      const state = rowStates[item.staffId];
      const status = state ? state.status : item.status;
      if (status === 'PRESENT') present++;
      else if (status === 'HALF_DAY') halfDay++;
      else if (status === 'ABSENT') absent++;
      else if (status === 'LEAVE') leave++;
      else if (status === 'OFF_DAY') offDay++;
      else unrecorded++;
    });

    const recorded = roster.length - unrecorded;
    return {
      total: roster.length,
      recorded,
      unrecorded,
      present,
      halfDay,
      absent,
      leave,
      offDay
    };
  }, [roster, rowStates]);

  // Initials Avatar Helper
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (parts[0]?.[0] || 'S').toUpperCase();
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-forest-800">
              {activeTab === 'ROSTER' ? 'Daily Attendance Roster' : 'Attendance Summary & Export'}
            </h1>
            <Badge variant="forest">Phase 3</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {activeTab === 'ROSTER'
              ? 'Record shifts, daily attendance, and operational time logs.'
              : 'Analyze attendance rates, review staff-wise summaries, and export reports.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/staff">
            <Button
              variant="secondary"
              size="sm"
              icon={<Users className="w-4 h-4 text-forest-800" />}
            >
              Staff Directory
            </Button>
          </Link>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1.5 p-1 bg-cream-100/80 rounded-2xl border border-cream-200/80 w-fit">
        <button
          type="button"
          onClick={() => handleTabChange('ROSTER')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'ROSTER'
              ? 'bg-white text-forest-900 shadow-xs border border-forest-800/10'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CalendarCheck className="w-4 h-4 text-forest-800" />
          <span>Daily Roster</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('SUMMARY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'SUMMARY'
              ? 'bg-white text-forest-900 shadow-xs border border-forest-800/10'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-forest-800" />
          <span>Summary & Export</span>
        </button>
      </div>

      {activeTab === 'SUMMARY' ? (
        <AttendanceSummaryView />
      ) : (
        <>
          {/* Date Navigation Bar */}
          <Card className="p-4 md:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Date controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevDay}
              aria-label="Previous day"
              icon={<ChevronLeft className="w-4 h-4" />}
            />
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-cream-50/80 border border-border rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 cursor-pointer shadow-2xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextDay}
              aria-label="Next day"
              icon={<ChevronRight className="w-4 h-4" />}
            />
            {selectedDate !== today && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="text-forest-800 font-semibold"
              >
                Jump to Today
              </Button>
            )}
          </div>

          {/* Formatted Date & Status pill indicators */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-forest-900 text-sm mr-1">
              {formatDate(selectedDate)}
            </span>
            <span className="text-slate-300">|</span>
            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-medium border border-emerald-200/60">
              Present: <strong>{metrics.present}</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-sky-50 text-sky-800 font-medium border border-sky-200/60">
              Half Day: <strong>{metrics.halfDay}</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-800 font-medium border border-rose-200/60">
              Absent: <strong>{metrics.absent}</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 font-medium border border-amber-200/60">
              Leave: <strong>{metrics.leave}</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-800 font-medium border border-slate-200">
              Off Day: <strong>{metrics.offDay}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-cream-100 text-forest-900 font-semibold border border-border">
              {metrics.recorded}/{metrics.total} Recorded
            </span>
          </div>
        </div>
      </Card>

      {/* Main Roster List Area */}
      {error ? (
        <Card className="p-8 text-center border-rose-200 bg-rose-50/50">
          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
            <AlertCircle className="w-10 h-10 text-rose-600" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-900">Failed to load attendance roster</h3>
              <p className="text-sm text-rose-700">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadRoster(selectedDate)}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        </Card>
      ) : loading ? (
        <Card className="p-5 md:p-6 space-y-4">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3.5 border-b border-border/50"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="w-36 h-4" />
                    <Skeleton className="w-24 h-3" />
                  </div>
                </div>
                <Skeleton className="w-56 h-8 rounded-xl" />
                <Skeleton className="w-32 h-8 rounded-xl hidden md:block" />
                <Skeleton className="w-20 h-8 rounded-xl" />
              </div>
            ))}
          </div>
        </Card>
      ) : roster.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-forest-100 flex items-center justify-center text-forest-800">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-forest-900">No active staff on this date</h3>
            <p className="text-sm text-slate-500">
              There are no active staff profiles with a joining date on or before {formatDate(selectedDate)}.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Link href="/staff">
                <Button variant="primary" size="sm" icon={<Users className="w-4 h-4" />}>
                  Go to Staff Directory
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          {/* Desktop & Tablet Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-cream-50/70 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Staff Member</th>
                  <th className="py-3.5 px-4">Status Selection</th>
                  <th className="py-3.5 px-4">Check-In / Check-Out</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {roster.map((item) => {
                  const state = rowStates[item.staffId] || {
                    status: null,
                    checkInTime: '',
                    checkOutTime: '',
                    note: ''
                  };
                  const isDirty = isRowDirty(item.staffId);
                  const isPresentOrHalf = state.status === 'PRESENT' || state.status === 'HALF_DAY';
                  const isSingleSaving = savingSingleId === item.staffId;

                  return (
                    <tr
                      key={item.staffId}
                      className={`transition-colors ${
                        isDirty ? 'bg-amber-50/40 hover:bg-amber-50/60' : 'hover:bg-cream-50/40'
                      }`}
                    >
                      {/* Staff Name & Role */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-forest-100 border border-forest-800/15 flex items-center justify-center text-xs font-bold text-forest-800 shrink-0">
                            {getInitials(item.staffName)}
                          </div>
                          <div>
                            <Link
                              href={`/staff/${item.staffId}`}
                              className="font-semibold text-slate-900 block hover:text-forest-800 hover:underline"
                            >
                              {item.staffName}
                            </Link>
                            <span className="text-xs text-slate-500 font-medium">
                              {item.roleTitle}
                            </span>
                            {item.isArchived && (
                              <Badge variant="neutral" className="ml-2 text-[10px]">
                                Archived
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status Selection Buttons */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center p-1 bg-cream-100/70 rounded-xl border border-border text-xs font-semibold gap-1">
                          {STATUS_OPTIONS.map((opt) => {
                            const isSelected = state.status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateRowStatus(item.staffId, opt.value)}
                                className={`px-2.5 py-1.5 rounded-lg transition-all min-h-[36px] ${
                                  isSelected
                                    ? opt.activeClass
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Check-In & Check-Out Time Fields */}
                      <td className="py-3.5 px-4">
                        {isPresentOrHalf ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-white border border-border rounded-xl px-2 py-1 shadow-2xs">
                              <span className="text-[11px] text-slate-400 font-semibold uppercase">
                                In:
                              </span>
                              <input
                                type="time"
                                value={state.checkInTime}
                                onChange={(e) =>
                                  updateRowField(item.staffId, 'checkInTime', e.target.value)
                                }
                                className="text-xs font-mono text-slate-800 bg-transparent focus:outline-none"
                              />
                            </div>
                            <span className="text-slate-300">—</span>
                            <div className="flex items-center gap-1 bg-white border border-border rounded-xl px-2 py-1 shadow-2xs">
                              <span className="text-[11px] text-slate-400 font-semibold uppercase">
                                Out:
                              </span>
                              <input
                                type="time"
                                value={state.checkOutTime}
                                onChange={(e) =>
                                  updateRowField(item.staffId, 'checkOutTime', e.target.value)
                                }
                                className="text-xs font-mono text-slate-800 bg-transparent focus:outline-none"
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Time logging inactive for {state.status ? state.status.toLowerCase() : 'unrecorded'}
                          </span>
                        )}
                      </td>

                      {/* Notes Input */}
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          placeholder="Optional note..."
                          value={state.note}
                          onChange={(e) => updateRowField(item.staffId, 'note', e.target.value)}
                          maxLength={500}
                          className="w-48 bg-cream-50/70 border border-border rounded-xl px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-forest-800/20 focus:bg-white transition-all shadow-2xs"
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isDirty ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResetRow(item.staffId)}
                                disabled={isSingleSaving || savingBulk}
                                title="Reset changes"
                                icon={<RotateCcw className="w-3.5 h-3.5 text-slate-400" />}
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleSaveSingleRow(item.staffId)}
                                isLoading={isSingleSaving}
                                disabled={isSingleSaving || savingBulk}
                                icon={<Save className="w-3.5 h-3.5" />}
                              >
                                Save
                              </Button>
                            </>
                          ) : item.attendanceId ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium px-2 py-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Saved
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 px-2 py-1">Unsaved</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Card View */}
          <div className="lg:hidden divide-y divide-border">
            {roster.map((item) => {
              const state = rowStates[item.staffId] || {
                status: null,
                checkInTime: '',
                checkOutTime: '',
                note: ''
              };
              const isDirty = isRowDirty(item.staffId);
              const isPresentOrHalf = state.status === 'PRESENT' || state.status === 'HALF_DAY';
              const isSingleSaving = savingSingleId === item.staffId;

              return (
                <div
                  key={item.staffId}
                  className={`p-4 flex flex-col gap-3.5 transition-colors ${
                    isDirty ? 'bg-amber-50/40' : ''
                  }`}
                >
                  {/* Card Header: Avatar, Name, Role, Dirty Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-forest-100 border border-forest-800/15 flex items-center justify-center text-xs font-bold text-forest-800 shrink-0">
                        {getInitials(item.staffName)}
                      </div>
                      <div>
                        <Link
                          href={`/staff/${item.staffId}`}
                          className="font-bold text-slate-900 text-sm hover:text-forest-800 hover:underline"
                        >
                          {item.staffName}
                        </Link>
                        <span className="text-xs text-slate-500 font-medium block">
                          {item.roleTitle}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isDirty ? (
                        <Badge variant="warning" className="text-[10px]">
                          Unsaved
                        </Badge>
                      ) : item.attendanceId ? (
                        <Badge variant="success" className="text-[10px]">
                          Saved
                        </Badge>
                      ) : (
                        <Badge variant="neutral" className="text-[10px]">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Status Selection Buttons Grid (Mobile Friendly >= 44px touch targets) */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 bg-cream-100/60 p-1.5 rounded-xl border border-border">
                    {STATUS_OPTIONS.map((opt) => {
                      const isSelected = state.status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateRowStatus(item.staffId, opt.value)}
                          className={`min-h-[44px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center text-center ${
                            isSelected
                              ? opt.activeClass
                              : 'bg-white/80 text-slate-700 hover:bg-white border border-border/60'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Time Logging Inputs (Only for Present / Half Day) */}
                  {isPresentOrHalf && (
                    <div className="grid grid-cols-2 gap-2 text-xs bg-cream-50/50 p-2.5 rounded-xl border border-border/80">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Check-In Time
                        </label>
                        <input
                          type="time"
                          value={state.checkInTime}
                          onChange={(e) =>
                            updateRowField(item.staffId, 'checkInTime', e.target.value)
                          }
                          className="w-full bg-white border border-border rounded-xl px-2.5 py-2 font-mono text-sm text-slate-900 min-h-[44px] focus:outline-none focus:ring-1 focus:ring-forest-800"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Check-Out Time
                        </label>
                        <input
                          type="time"
                          value={state.checkOutTime}
                          onChange={(e) =>
                            updateRowField(item.staffId, 'checkOutTime', e.target.value)
                          }
                          className="w-full bg-white border border-border rounded-xl px-2.5 py-2 font-mono text-sm text-slate-900 min-h-[44px] focus:outline-none focus:ring-1 focus:ring-forest-800"
                        />
                      </div>
                    </div>
                  )}

                  {/* Note Input */}
                  <div>
                    <input
                      type="text"
                      placeholder="Optional shift remarks or notes..."
                      value={state.note}
                      onChange={(e) => updateRowField(item.staffId, 'note', e.target.value)}
                      maxLength={500}
                      className="w-full bg-cream-50/60 border border-border rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 min-h-[44px] focus:outline-none focus:ring-1 focus:ring-forest-800"
                    />
                  </div>

                  {/* Card Actions */}
                  {isDirty && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetRow(item.staffId)}
                        disabled={isSingleSaving || savingBulk}
                      >
                        Reset
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSaveSingleRow(item.staffId)}
                        isLoading={isSingleSaving}
                        disabled={isSingleSaving || savingBulk}
                        icon={<Save className="w-3.5 h-3.5" />}
                      >
                        Save Row
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Floating Bottom Action Bar for Save All */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 left-4 right-4 md:left-64 z-40 flex items-center justify-between p-3.5 md:p-4 bg-forest-900/95 backdrop-blur-md text-white rounded-2xl shadow-elevated border border-forest-800/40 animate-slide-up">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div className="text-xs md:text-sm">
              <strong className="font-semibold text-amber-300">
                {changedStaffIds.length} staff member{changedStaffIds.length > 1 ? 's' : ''}
              </strong>{' '}
              modified
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscardChanges}
              disabled={savingBulk}
              className="text-white border-white/30 hover:bg-white/10"
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={handleSaveAll}
              isLoading={savingBulk}
              disabled={savingBulk}
              icon={<Save className="w-4 h-4" />}
            >
              Save All Changes
            </Button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      }
    >
      <AttendanceRosterContent />
    </Suspense>
  );
}
