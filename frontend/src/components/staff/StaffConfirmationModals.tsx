'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StaffDTO } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/ToastContext';
import { AlertTriangle, Archive, RotateCcw, ShieldCheck } from 'lucide-react';

interface ArchiveStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffDTO | null;
  onSuccess: (updated: StaffDTO) => void;
}

export const ArchiveStaffModal: React.FC<ArchiveStaffModalProps> = ({
  isOpen,
  onClose,
  staff,
  onSuccess
}) => {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!staff) return null;

  const staffName = staff.full_name || staff.fullName || 'Staff Member';
  const roleTitle = staff.role_title || staff.roleTitle || '';

  const handleArchive = async () => {
    if (submitting) return;
    setSubmitting(true);

    const idempotencyKey =
      typeof window !== 'undefined' && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `ik_arch_staff_${Date.now()}`;

    try {
      const res = await api.archiveStaff(staff.id, idempotencyKey);
      showToast('Staff member archived successfully', 'success');
      onSuccess(res.staff);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        showToast(err.message || 'Failed to archive staff member', 'error');
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
      title="Archive Staff Member"
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3.5 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed space-y-1">
            <span className="font-semibold block">Archive Policy & Attendance Rules:</span>
            <p>
              Staff active on the selected business date may have attendance recorded.
              If the staff member was archived before the selected business date, new attendance will be rejected.
            </p>
            <p className="text-amber-800">
              Historical attendance recorded while active remains preserved and readable.
            </p>
          </div>
        </div>

        <div className="bg-cream-50/60 p-3.5 rounded-xl border border-border">
          <p className="text-sm text-slate-700">
            Are you sure you want to archive <strong className="text-forest-900 font-semibold">{staffName}</strong>
            {roleTitle ? ` (${roleTitle})` : ''}?
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleArchive}
            isLoading={submitting}
            disabled={submitting}
            icon={<Archive className="w-4 h-4" />}
          >
            Archive Staff
          </Button>
        </div>
      </div>
    </Modal>
  );
};

interface RestoreStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffDTO | null;
  onSuccess: (updated: StaffDTO) => void;
}

export const RestoreStaffModal: React.FC<RestoreStaffModalProps> = ({
  isOpen,
  onClose,
  staff,
  onSuccess
}) => {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!staff) return null;

  const staffName = staff.full_name || staff.fullName || 'Staff Member';
  const roleTitle = staff.role_title || staff.roleTitle || '';

  const handleRestore = async () => {
    if (submitting) return;
    setSubmitting(true);

    const idempotencyKey =
      typeof window !== 'undefined' && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `ik_rest_staff_${Date.now()}`;

    try {
      const res = await api.restoreStaff(staff.id, idempotencyKey);
      showToast('Staff member restored successfully', 'success');
      onSuccess(res.staff);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        showToast(err.message || 'Failed to restore staff member', 'error');
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
      title="Restore Staff Member"
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3.5 p-3.5 bg-emerald-50/90 border border-emerald-200/90 rounded-xl text-emerald-900">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed space-y-1">
            <span className="font-semibold block">Restore Confirmation:</span>
            <p>
              Restoring this staff member will return them to active status, allowing new daily attendance to be recorded for business dates going forward.
            </p>
          </div>
        </div>

        <div className="bg-cream-50/60 p-3.5 rounded-xl border border-border">
          <p className="text-sm text-slate-700">
            Restore <strong className="text-forest-900 font-semibold">{staffName}</strong>
            {roleTitle ? ` (${roleTitle})` : ''} to active staff roster?
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleRestore}
            isLoading={submitting}
            disabled={submitting}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            Restore Staff
          </Button>
        </div>
      </div>
    </Modal>
  );
};
