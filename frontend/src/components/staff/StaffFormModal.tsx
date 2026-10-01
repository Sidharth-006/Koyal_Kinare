'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StaffDTO, CreateStaffPayload, UpdateStaffPayload } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/ToastContext';
import { Eye, EyeOff, Lock, User, Phone, Briefcase, Calendar, AlertCircle } from 'lucide-react';

interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff?: StaffDTO | null;
  onSuccess: (savedStaff: StaffDTO) => void;
}

export const StaffFormModal: React.FC<StaffFormModalProps> = ({
  isOpen,
  onClose,
  staff,
  onSuccess
}) => {
  const { showToast } = useToast();
  const isEditing = Boolean(staff);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [salaryReference, setSalaryReference] = useState('');
  const [showSalary, setShowSalary] = useState(false);
  const [notes, setNotes] = useState('');

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;

    if (staff) {
      setFullName(staff.full_name || staff.fullName || '');
      setPhone(staff.phone || '');
      setRoleTitle(staff.role_title || staff.roleTitle || '');
      setJoiningDate(staff.joining_date || staff.joiningDate || '');
      setEmergencyContact(staff.emergency_contact || staff.emergencyContact || '');
      setNotes(staff.notes || '');
      setShowSalary(false);

      // In directory list, salary_reference is omitted for privacy.
      // If we are editing, fetch full record to load confidential salary reference.
      if (staff.salary_reference !== undefined || staff.salaryReference !== undefined) {
        setSalaryReference(staff.salary_reference || staff.salaryReference || '');
      } else {
        setSalaryReference('');
        setLoadingDetails(true);
        api.getStaff(staff.id)
          .then((res) => {
            if (res.staff) {
              setSalaryReference(
                res.staff.salary_reference || res.staff.salaryReference || ''
              );
              if (res.staff.notes) setNotes(res.staff.notes);
            }
          })
          .catch(() => {
            // Non-blocking: fallback to whatever was passed
          })
          .finally(() => {
            setLoadingDetails(false);
          });
      }
    } else {
      // Default to today's local date (YYYY-MM-DD) for create
      const today = new Date().toISOString().split('T')[0];
      setFullName('');
      setPhone('');
      setRoleTitle('');
      setJoiningDate(today);
      setEmergencyContact('');
      setSalaryReference('');
      setShowSalary(false);
      setNotes('');
      setLoadingDetails(false);
    }
    setErrors({});
  }, [isOpen, staff]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      newErrors.fullName = 'Full name is required and must be at least 2 characters.';
    } else if (trimmedName.length > 120) {
      newErrors.fullName = 'Full name cannot exceed 120 characters.';
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && trimmedPhone.length > 25) {
      newErrors.phone = 'Phone number cannot exceed 25 characters.';
    }

    const trimmedRole = roleTitle.trim();
    if (!trimmedRole) {
      newErrors.roleTitle = 'Role / title is required.';
    } else if (trimmedRole.length > 80) {
      newErrors.roleTitle = 'Role / title cannot exceed 80 characters.';
    }

    const trimmedDate = joiningDate.trim();
    if (!trimmedDate || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      newErrors.joiningDate = 'Joining date must be a valid date in YYYY-MM-DD format.';
    }

    const trimmedEmergency = emergencyContact.trim();
    if (trimmedEmergency && trimmedEmergency.length > 25) {
      newErrors.emergencyContact = 'Emergency contact cannot exceed 25 characters.';
    }

    const trimmedSalary = salaryReference.trim();
    if (trimmedSalary) {
      const num = Number(trimmedSalary);
      if (isNaN(num) || num < 0) {
        newErrors.salaryReference = 'Salary reference must be a valid non-negative number.';
      }
    }

    const trimmedNotes = notes.trim();
    if (trimmedNotes && trimmedNotes.length > 1000) {
      newErrors.notes = 'Notes cannot exceed 1000 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!validate()) return;
    setSubmitting(true);

    try {
      if (isEditing && staff) {
        const payload: UpdateStaffPayload = {
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          roleTitle: roleTitle.trim(),
          joiningDate: joiningDate.trim(),
          emergencyContact: emergencyContact.trim() || null,
          salaryReference: salaryReference.trim() ? Number(salaryReference.trim()) : null,
          notes: notes.trim() || null
        };

        const res = await api.updateStaff(staff.id, payload);
        showToast('Staff member updated successfully', 'success');
        onSuccess(res.staff);
        onClose();
      } else {
        const idempotencyKey =
          typeof window !== 'undefined' && window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : `ik_create_staff_${Date.now()}`;

        const payload: CreateStaffPayload = {
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          roleTitle: roleTitle.trim(),
          joiningDate: joiningDate.trim(),
          emergencyContact: emergencyContact.trim() || undefined,
          salaryReference: salaryReference.trim() ? Number(salaryReference.trim()) : undefined,
          notes: notes.trim() || undefined
        };

        const res = await api.createStaff(payload, idempotencyKey);
        showToast('Staff member created successfully', 'success');
        onSuccess(res.staff);
        onClose();
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        showToast(err.message || 'Failed to save staff member', 'error');
      } else {
        showToast('An unexpected error occurred. Please try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Staff Member' : 'Add New Staff Member'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Notice badge */}
        <div className="flex items-center gap-2 p-3 bg-cream-50/80 border border-border rounded-xl text-xs text-slate-600">
          <User className="w-4 h-4 text-forest-800 shrink-0" />
          <span>
            Staff profiles are operational cafe records for roster and attendance tracking. Staff do not receive system logins.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Full Name *"
            placeholder="e.g. Ramesh Kumar"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            leftIcon={<User className="w-4 h-4" />}
            maxLength={120}
            required
            autoFocus
          />

          <Input
            label="Role / Title *"
            placeholder="e.g. Senior Barista, Head Chef"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            error={errors.roleTitle}
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
            error={errors.phone}
            leftIcon={<Phone className="w-4 h-4" />}
            maxLength={25}
          />

          <Input
            label="Joining Date *"
            type="date"
            value={joiningDate}
            onChange={(e) => setJoiningDate(e.target.value)}
            error={errors.joiningDate}
            leftIcon={<Calendar className="w-4 h-4" />}
            required
          />

          <Input
            label="Emergency Contact"
            type="tel"
            placeholder="e.g. +91 98111 22334 (Spouse / Parent)"
            value={emergencyContact}
            onChange={(e) => setEmergencyContact(e.target.value)}
            error={errors.emergencyContact}
            maxLength={25}
          />

          {/* Protected Salary Reference Card */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="salary-reference"
                className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-forest-800" />
                Salary Reference (₹)
              </label>
              <button
                type="button"
                onClick={() => setShowSalary(!showSalary)}
                className="text-xs text-forest-800 hover:text-forest-900 font-medium flex items-center gap-1 min-h-[32px] px-1"
                aria-label={showSalary ? 'Hide salary' : 'Show salary'}
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
                id="salary-reference"
                type={showSalary ? 'number' : 'password'}
                step="0.01"
                min="0"
                placeholder={loadingDetails ? 'Loading...' : '0.00'}
                value={salaryReference}
                onChange={(e) => setSalaryReference(e.target.value)}
                disabled={loadingDetails}
                className="w-full bg-cream-50/60 border border-border rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 focus:bg-white transition-all shadow-2xs"
              />
            </div>
            {errors.salaryReference && (
              <span className="text-xs font-medium text-danger">{errors.salaryReference}</span>
            )}
            <span className="text-[11px] text-slate-500">
              Confidential internal reference. Never displayed on general rosters, attendance views, or reports.
            </span>
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="staff-notes" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Notes / Internal Remarks
          </label>
          <textarea
            id="staff-notes"
            rows={3}
            placeholder="Special certifications, shift preferences, or administrative notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            className="w-full bg-cream-50/60 border border-border rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 focus:bg-white transition-all shadow-2xs resize-none"
          />
          {errors.notes && <span className="text-xs font-medium text-danger">{errors.notes}</span>}
          <div className="flex justify-end">
            <span className="text-[11px] text-slate-400">{notes.length}/1000</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
            disabled={submitting || loadingDetails}
          >
            {isEditing ? 'Save Changes' : 'Create Staff Member'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
