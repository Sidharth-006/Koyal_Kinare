'use client';

import React, { useState } from 'react';
import { PurchaseDTO } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export interface ReverseConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: PurchaseDTO;
  onSuccess: (updatedPurchase: PurchaseDTO) => void;
  onRefreshNeeded: () => void;
}

export const ReverseConfirmModal: React.FC<ReverseConfirmModalProps> = ({
  isOpen,
  onClose,
  purchase,
  onSuccess,
  onRefreshNeeded
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate ONE idempotency key per modal session
  const [idempotencyKey] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `rev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  const handleConfirmReverse = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      setError('A reversal reason of at least 5 characters is required.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.reversePurchase(purchase.id, trimmedReason, idempotencyKey);
      setIsSubmitting(false);
      onSuccess(res.purchase);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);

      if (err instanceof ApiError) {
        if (err.code === 'PURCHASE_ALREADY_REVERSED') {
          setError('This purchase has already been reversed. Refreshing...');
          setTimeout(() => {
            onRefreshNeeded();
            onClose();
          }, 1500);
          return;
        }

        if (err.code === 'INSUFFICIENT_STOCK') {
          setError('Cannot reverse purchase: stock has already been consumed and would result in negative balance.');
          return;
        }

        setError(err.message || 'Failed to reverse purchase.');
      } else {
        setError('Network error occurred while reversing purchase. Please check current purchase status.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Reverse Purchase"
      size="md"
    >
      <div className="space-y-4 text-sm">
        {/* Warning Banner */}
        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Compensating Reversal</span>
            This will create compensating stock entries in the Stock Ledger while preserving the original purchase history.
            This action cannot be undone.
          </div>
        </div>

        {/* Reason Textarea */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            Reversal Reason <span className="text-rose-600">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Explain why this purchase is being reversed (e.g. Returned goods, invoice error)..."
            rows={3}
            disabled={isSubmitting}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-800 disabled:bg-slate-100"
          />
          <p className="text-[11px] text-slate-500">Minimum 5 characters required.</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-2 border-t border-slate-200 flex justify-end gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirmReverse}
            isLoading={isSubmitting}
            disabled={reason.trim().length < 5}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            Confirm Reversal
          </Button>
        </div>
      </div>
    </Modal>
  );
};
