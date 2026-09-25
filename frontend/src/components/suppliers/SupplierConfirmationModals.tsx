'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SupplierDTO } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/ToastContext';
import { AlertTriangle, Archive, RotateCcw } from 'lucide-react';

interface ArchiveSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: SupplierDTO | null;
  onSuccess: (updated: SupplierDTO) => void;
}

export const ArchiveSupplierModal: React.FC<ArchiveSupplierModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onSuccess
}) => {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!supplier) return null;

  const handleArchive = async () => {
    setSubmitting(true);
    const idempotencyKey = typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `ik_arch_${Date.now()}`;

    try {
      const res = await api.archiveSupplier(supplier.id, idempotencyKey);
      showToast('Supplier archived successfully', 'success');
      onSuccess(res.supplier);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        showToast(err.message || 'Failed to archive supplier', 'error');
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
      title="Archive Supplier"
      size="sm"
    >
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3.5 p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold block mb-0.5">Please confirm archiving:</span>
            Historic purchase records remain, but this supplier cannot be selected for new purchases.
          </div>
        </div>

        <p className="text-sm text-slate-600">
          Are you sure you want to archive <strong className="text-forest-900 font-semibold">{supplier.name}</strong>?
        </p>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
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
            Archive Supplier
          </Button>
        </div>
      </div>
    </Modal>
  );
};

interface RestoreSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: SupplierDTO | null;
  onSuccess: (updated: SupplierDTO) => void;
}

export const RestoreSupplierModal: React.FC<RestoreSupplierModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onSuccess
}) => {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!supplier) return null;

  const handleRestore = async () => {
    setSubmitting(true);
    const idempotencyKey = typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `ik_rest_${Date.now()}`;

    try {
      const res = await api.restoreSupplier(supplier.id, idempotencyKey);
      showToast('Supplier restored successfully', 'success');
      onSuccess(res.supplier);
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'DUPLICATE_SUPPLIER') {
          showToast('An active supplier already uses this name.', 'error');
        } else {
          showToast(err.message || 'Failed to restore supplier', 'error');
        }
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
      title="Restore Supplier"
      size="sm"
    >
      <div className="p-6 flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Restore <strong className="text-forest-900 font-semibold">{supplier.name}</strong> to active status? Once restored, this supplier will be available for new procurement entries.
        </p>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
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
            Restore Supplier
          </Button>
        </div>
      </div>
    </Modal>
  );
};
