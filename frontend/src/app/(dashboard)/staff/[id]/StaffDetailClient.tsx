'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { StaffDTO, UpdateStaffPayload } from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import {
  ArchiveStaffModal,
  RestoreStaffModal
} from '@/components/staff/StaffConfirmationModals';
import {
  ArrowLeft, User, Phone, Briefcase, Calendar,
  Lock, Eye, EyeOff, Save, RotateCcw, Archive,
  Shield, AlertCircle, FileText, CheckCircle2,
  Clock, HeartHandshake
} from 'lucide-react';

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const staffId = params.id as string;

  const [staff, setStaff] = useState<StaffDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [salaryReference, setSalaryReference] = useState('');
  const [notes, setNotes] = useState('');

  // Protected salary show/hide state (masked by default)
  const [showSalary, setShowSalary] = useState(false);

  // Submission & Validation States
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Archive / Restore Modals
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);

  // Sync form inputs from staff record
  const populateForm = useCallback((data: StaffDTO) => {
    setFullName(data.full_name || data.fullName || '');
    setPhone(data.phone || '');
    setRoleTitle(data.role_title || data.roleTitle || '');
    setJoiningDate(data.joining_date || data.joiningDate || '');
    setEmergencyContact(data.emergency_contact || data.emergencyContact || '');
    setSalaryReference(data.salary_reference || data.salaryReference || '');
    setNotes(data.notes || '');
    setFieldErrors({});
    setShowSalary(false);
  }, []);

  const loadStaff = useCallback(async () => {
    if (!staffId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getStaff(staffId);
      setStaff(res.staff);
      populateForm(res.staff);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message || 'Staff member not found.');
      } else {
        setError('Failed to load staff details. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [staffId, populateForm]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.fullName = 'Full name is required and must be at least 2 characters.';
    } else if (trimmedName.length > 120) {
      errors.fullName = 'Full name cannot exceed 120 characters.';
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && trimmedPhone.length > 25) {
      errors.phone = 'Phone number cannot exceed 25 characters.';
    }

    const trimmedRole = roleTitle.trim();
    if (!trimmedRole) {
      errors.roleTitle = 'Role / title is required.';
    } else if (trimmedRole.length > 80) {
      errors.roleTitle = 'Role / title cannot exceed 80 characters.';
    }

    const trimmedDate = joiningDate.trim();
    if (!trimmedDate || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      errors.joiningDate = 'Joining date must be a valid date in YYYY-MM-DD format.';
    }

    const trimmedEmergency = emergencyContact.trim();
    if (trimmedEmergency && trimmedEmergency.length > 25) {
      errors.emergencyContact = 'Emergency contact cannot exceed 25 characters.';
    }

    const trimmedSalary = salaryReference.trim();
    if (trimmedSalary) {
      const num = Number(trimmedSalary);
      if (isNaN(num) || num < 0) {
        errors.salaryReference = 'Salary reference must be a valid non-negative number.';
      }
    }

    const trimmedNotes = notes.trim();
    if (trimmedNotes && trimmedNotes.length > 1000) {
      errors.notes = 'Notes cannot exceed 1000 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!validate()) return;
    setSaving(true);

    const payload: UpdateStaffPayload = {
      fullName: fullName.trim(),
      phone: phone.trim() || null,
      roleTitle: roleTitle.trim(),
      joiningDate: joiningDate.trim(),
      emergencyContact: emergencyContact.trim() || null,
      salaryReference: salaryReference.trim() ? Number(salaryReference.trim()) : null,
      notes: notes.trim() || null
    };

    try {
      const res = await api.updateStaff(staffId, payload);
      showToast('Staff profile updated successfully', 'success');
      setStaff(res.staff);
      populateForm(res.staff);
    } catch (err: any) {
      if (err instanceof ApiError) {
        showToast(err.message || 'Failed to update staff profile', 'error');
      } else {
        showToast('An unexpected error occurred. Please try again.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (staff) {
      populateForm(staff);
    }
  };

  const handleArchiveSuccess = (updated: StaffDTO) => {
    setStaff(updated);
    populateForm(updated);
  };

  const handleRestoreSuccess = (updated: StaffDTO) => {
    setStaff(updated);
    populateForm(updated);
  };

  // Helper for staff avatar initials
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (parts[0]?.[0] || 'S').toUpperCase();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="w-24 h-9 rounded-xl" />
        </div>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="w-48 h-6" />
              <Skeleton className="w-32 h-4" />
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 lg:col-span-2 space-y-4">
            <Skeleton className="w-full h-10 rounded-xl" />
            <Skeleton className="w-full h-10 rounded-xl" />
            <Skeleton className="w-full h-10 rounded-xl" />
            <Skeleton className="w-full h-24 rounded-xl" />
          </Card>
          <Card className="p-6 space-y-4">
            <Skeleton className="w-full h-10 rounded-xl" />
            <Skeleton className="w-full h-24 rounded-xl" />
          </Card>
        </div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="space-y-6">
        <Link href="/staff">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to Staff Directory
          </Button>
        </Link>
        <Card className="p-8 text-center border-rose-200 bg-rose-50/50">
          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
            <AlertCircle className="w-10 h-10 text-rose-600" />
            <h3 className="text-base font-bold text-rose-900">
              {error || 'Staff Member Not Found'}
            </h3>
            <p className="text-sm text-rose-700">
              The requested staff profile could not be loaded. Please ensure the staff ID is correct.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Button variant="outline" size="sm" onClick={loadStaff}>
                Try Again
              </Button>
              <Link href="/staff">
                <Button variant="primary" size="sm">
                  Staff Directory
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const staffDisplayName = staff.full_name || staff.fullName || 'Staff Member';
  const currentRole = staff.role_title || staff.roleTitle || '—';
  const isArchived = staff.is_archived ?? staff.isArchived ?? false;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link href="/staff">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Staff Directory
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {isArchived ? (
            <Badge variant="neutral">Archived</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          )}
          <Badge variant="forest">Phase 3</Badge>
        </div>
      </div>

      {/* Staff Header Hero Card */}
      <Card className="p-5 md:p-6 bg-linear-to-r from-cream-50/90 to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-forest-800 text-white flex items-center justify-center text-lg font-bold shadow-md shrink-0">
              {getInitials(staffDisplayName)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-forest-900">
                  {staffDisplayName}
                </h1>
                {isArchived && (
                  <Badge variant="neutral" className="text-[11px]">
                    Archived
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-slate-600 mt-1">
                <span className="flex items-center gap-1 font-medium text-slate-800">
                  <Briefcase className="w-3.5 h-3.5 text-forest-800" />
                  {currentRole}
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Joined {formatDate(staff.joining_date || staff.joiningDate)}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-400 text-xs">ID: {staff.id.slice(0, 8)}...</span>
              </div>
            </div>
          </div>

          {/* Quick Archive/Restore Action in Header */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            {isArchived ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRestoreModalOpen(true)}
                className="text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                icon={<RotateCcw className="w-4 h-4" />}
              >
                Restore Staff
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setArchiveModalOpen(true)}
                className="text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50"
                icon={<Archive className="w-4 h-4" />}
              >
                Archive Staff
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Profile & Edit Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal & Operational Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div>
                <h2 className="text-base font-bold text-forest-900">
                  Staff Information
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update primary contact, role, and employment parameters.
                </p>
              </div>
              <Badge variant="forest">Editable</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name *"
                placeholder="e.g. Ramesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={fieldErrors.fullName}
                leftIcon={<User className="w-4 h-4" />}
                maxLength={120}
                required
              />

              <Input
                label="Role / Title *"
                placeholder="e.g. Senior Barista"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                error={fieldErrors.roleTitle}
                leftIcon={<Briefcase className="w-4 h-4" />}
                maxLength={80}
                required
              />

              <Input
                label="Phone Number"
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={fieldErrors.phone}
                leftIcon={<Phone className="w-4 h-4" />}
                maxLength={25}
              />

              <Input
                label="Joining Date *"
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                error={fieldErrors.joiningDate}
                leftIcon={<Calendar className="w-4 h-4" />}
                required
              />

              <div className="md:col-span-2">
                <Input
                  label="Emergency Contact"
                  type="tel"
                  placeholder="e.g. +91 98111 22334 (Spouse / Parent)"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  error={fieldErrors.emergencyContact}
                  leftIcon={<HeartHandshake className="w-4 h-4" />}
                  maxLength={25}
                  helperText="Primary point of contact in case of workplace emergencies."
                />
              </div>
            </div>

            {/* Notes Section */}
            <div className="flex flex-col gap-1.5 pt-2">
              <label
                htmlFor="profile-notes"
                className="text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Internal Notes & Remarks
              </label>
              <textarea
                id="profile-notes"
                rows={3}
                placeholder="Certifications, shift preferences, or administrative notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                className="w-full bg-cream-50/60 border border-border rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 focus:bg-white transition-all shadow-2xs resize-none"
              />
              {fieldErrors.notes && (
                <span className="text-xs font-medium text-danger">{fieldErrors.notes}</span>
              )}
              <div className="flex justify-end">
                <span className="text-[11px] text-slate-400">{notes.length}/1000</span>
              </div>
            </div>

            {/* Save & Cancel Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={saving}
              >
                Discard Changes
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={saving}
                disabled={saving}
                icon={<Save className="w-4 h-4" />}
              >
                Save Profile
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Protected Salary & Operational Scope */}
        <div className="space-y-6">
          {/* Protected Salary Reference Card */}
          <Card className="p-5 md:p-6 border-forest-800/20 bg-linear-to-b from-cream-50/60 to-white space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-forest-100 flex items-center justify-center text-forest-800">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-forest-900">
                  Protected Salary Reference
                </h3>
              </div>
              <Badge variant="forest">Confidential</Badge>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Confidential management reference. Never displayed in general staff lists, attendance rosters, or daily reports.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="staff-detail-salary"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Salary Amount (₹)
                </label>
                <button
                  type="button"
                  onClick={() => setShowSalary(!showSalary)}
                  className="text-xs text-forest-800 hover:text-forest-900 font-semibold flex items-center gap-1.5 min-h-[36px] px-2 rounded-lg hover:bg-cream-100 transition-colors"
                  aria-label={showSalary ? 'Hide salary reference' : 'Reveal salary reference'}
                >
                  {showSalary ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Reveal</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <input
                  id="staff-detail-salary"
                  type={showSalary ? 'number' : 'password'}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={salaryReference}
                  onChange={(e) => setSalaryReference(e.target.value)}
                  className="w-full bg-cream-50/80 border border-border rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 focus:bg-white transition-all shadow-2xs"
                />
              </div>

              {fieldErrors.salaryReference && (
                <span className="text-xs font-medium text-danger block">
                  {fieldErrors.salaryReference}
                </span>
              )}
            </div>

            <div className="p-3 bg-cream-100/60 rounded-xl border border-border/80 text-[11px] text-slate-600 flex items-start gap-2">
              <Shield className="w-4 h-4 text-forest-800 shrink-0 mt-0.5" />
              <span>
                Changes saved here will update the confidential reference record. The value remains masked on screen refresh.
              </span>
            </div>
          </Card>

          {/* Operational Boundaries & Metadata Card */}
          <Card className="p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Shield className="w-4 h-4 text-forest-800" />
              <h3 className="text-sm font-bold text-forest-900">
                Operational Boundaries
              </h3>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-center justify-between py-1 border-b border-border/60">
                <span className="text-slate-500">System Access</span>
                <span className="font-semibold text-slate-800">None (Operational Only)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/60">
                <span className="text-slate-500">Record Status</span>
                <span className="font-semibold text-slate-800">
                  {isArchived ? 'Archived (Preserved)' : 'Active (Roster Eligible)'}
                </span>
              </div>
              {staff.created_at && (
                <div className="flex items-center justify-between py-1 border-b border-border/60">
                  <span className="text-slate-500">Created On</span>
                  <span className="text-slate-800">{formatDate(staff.created_at)}</span>
                </div>
              )}
              {staff.updated_at && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Last Modified</span>
                  <span className="text-slate-800">{formatDateTime(staff.updated_at)}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <Link href="/attendance">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  icon={<Calendar className="w-3.5 h-3.5 text-forest-800" />}
                >
                  View Attendance Roster
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </form>

      {/* Confirmation Modals */}
      <ArchiveStaffModal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        staff={staff}
        onSuccess={handleArchiveSuccess}
      />

      <RestoreStaffModal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        staff={staff}
        onSuccess={handleRestoreSuccess}
      />
    </div>
  );
}
