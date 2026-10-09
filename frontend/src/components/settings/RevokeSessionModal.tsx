'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SafeDeviceSessionDTO } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/ToastContext';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';

export interface RevokeSessionModalProps {
  isOpen: boolean;
  session: SafeDeviceSessionDTO | null;
  onClose: () => void;
  onSuccess: (isCurrentSession: boolean) => void;
}

export const RevokeSessionModal: React.FC<RevokeSessionModalProps> = ({
  isOpen,
  session,
  onClose,
  onSuccess
}) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAmbiguousState, setIsAmbiguousState] = useState(false);

  // Operation-scoped idempotency key (generated strictly on mutation initiation, NOT on mount)
  const [operationKey, setOperationKey] = useState<string | null>(null);

  if (!session) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    setOperationKey(null);
    setError(null);
    setIsAmbiguousState(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;

    // Generate operation key ONLY when initiating the mutation if not already held for retry
    let keyToUse = operationKey;
    if (!keyToUse) {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        keyToUse = window.crypto.randomUUID();
      } else {
        keyToUse = `rvk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      setOperationKey(keyToUse);
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.revokeSession(session.id, keyToUse);
      setIsSubmitting(false);
      setOperationKey(null);
      setIsAmbiguousState(false);

      if (res.isCurrentSession) {
        showToast('Current device session revoked. Signed out successfully.', 'info');
      } else {
        showToast('Device session signed out successfully.', 'success');
      }

      onSuccess(res.isCurrentSession);
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);

      if (err instanceof ApiError) {
        if (err.statusCode === 0 || err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT_ERROR') {
          // Ambiguous network failure: preserve the SAME idempotency key for safe retry
          setIsAmbiguousState(true);
          setError('Network connection interrupted. Please check device status or retry safely.');
        } else {
          // Definitive rejection from server
          setError(err.message || 'Failed to sign out device.');
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
      title={session.isCurrent ? 'Sign Out This Device' : 'Sign Out Device'}
      size="sm"
    >
      <div className="space-y-4">
        {session.isCurrent ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900 text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Signing out current device</p>
              <p className="mt-1 text-xs text-rose-800">
                You are signing out of this current device ({session.deviceLabel}). You will be logged out immediately and redirected to the login screen.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Sign out remote device</p>
              <p className="mt-1 text-xs text-amber-800">
                Are you sure you want to sign out this device ({session.deviceLabel})? Any active session on that device will be terminated immediately.
              </p>
            </div>
          </div>
        )}

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
            variant={session.isCurrent ? 'danger' : 'warning'}
            size="md"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            onClick={handleConfirm}
            icon={isAmbiguousState ? <RefreshCw className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
          >
            {isAmbiguousState ? 'Retry safely' : 'Confirm Sign Out'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
