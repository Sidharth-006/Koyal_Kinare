'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/ToastContext';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

export interface RevokeOthersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (revokedCount: number) => void;
}

export const RevokeOthersModal: React.FC<RevokeOthersModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAmbiguousState, setIsAmbiguousState] = useState(false);

  // Operation-scoped idempotency key (generated strictly on mutation initiation, NOT on mount)
  const [operationKey, setOperationKey] = useState<string | null>(null);

  const handleClose = () => {
    if (isSubmitting) return;
    setOperationKey(null);
    setError(null);
    setIsAmbiguousState(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;

    let keyToUse = operationKey;
    if (!keyToUse) {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        keyToUse = window.crypto.randomUUID();
      } else {
        keyToUse = `rvk_oth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      setOperationKey(keyToUse);
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.revokeOtherSessions(keyToUse);
      setIsSubmitting(false);
      setOperationKey(null);
      setIsAmbiguousState(false);

      showToast(`All other sessions revoked successfully (${res.revokedCount} devices signed out).`, 'success');
      onSuccess(res.revokedCount);
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);

      if (err instanceof ApiError) {
        if (err.statusCode === 0 || err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT_ERROR') {
          setIsAmbiguousState(true);
          setError('Network connection interrupted. Please check device status or retry safely.');
        } else {
          setError(err.message || 'Failed to sign out other devices.');
        }
      } else {
        setIsAmbiguousState(true);
        setError('Network connection interrupted. Please check device status or retry safely.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Sign Out All Other Devices"
      size="sm"
    >
      <div className="space-y-4">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-sm">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Active sessions will be terminated</p>
            <p className="mt-1 text-xs text-amber-800">
              Are you sure you want to sign out of all other devices? <strong>Your current session on this device will remain active</strong>, but all other active sessions will be signed out immediately.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between gap-2" role="alert">
            <span>{error}</span>
            {isAmbiguousState && (
              <span className="text-[11px] font-semibold text-red-800 underline">Same key preserved</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            onClick={handleConfirm}
            icon={isAmbiguousState ? <RefreshCw className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
          >
            {isAmbiguousState ? 'Retry safely' : 'Sign Out Other Devices'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
