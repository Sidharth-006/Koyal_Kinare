'use client';

import React, { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { getTodayIsoDate } from '@/lib/format';
import { ClipboardCheck, ArrowUpRight, ArrowDownRight, Check, AlertOctagon, Archive } from 'lucide-react';

export interface PhysicalCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  baseUnit: string;
  currentBalance: string;
  isArchived?: boolean;
  onSuccess: (resultingBalance: string, movementCreated: boolean) => void;
}

export const PhysicalCountModal: React.FC<PhysicalCountModalProps> = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  baseUnit,
  currentBalance,
  isArchived = false,
  onSuccess
}) => {
  const [actualQuantity, setActualQuantity] = useState('');
  const [businessDate, setBusinessDate] = useState(getTodayIsoDate());
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const generateFreshIdempotencyKey = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const expectedNum = parseFloat(currentBalance) || 0;
  const actualNum = parseFloat(actualQuantity);
  const hasActual = !isNaN(actualNum) && actualQuantity.trim() !== '';
  const varianceNum = hasActual ? actualNum - expectedNum : 0;
  const hasVariance = hasActual && Math.abs(varianceNum) > 0.0001;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (isArchived) {
      errors.actualQuantity = 'Archived items cannot receive new manual stock actions.';
      setFieldErrors(errors);
      return false;
    }

    if (!actualQuantity || actualQuantity.trim() === '') {
      errors.actualQuantity = 'Actual physical count is required.';
    } else {
      const q = parseFloat(actualQuantity);
      if (isNaN(q) || q < 0) {
        errors.actualQuantity = 'Counted quantity cannot be negative.';
      } else {
        const parts = actualQuantity.split('.');
        if (parts.length > 1 && parts[1].length > 3) {
          errors.actualQuantity = 'Counted quantity cannot have more than 3 decimal places.';
        }
      }
    }

    if (hasVariance && (!reason || reason.trim().length === 0)) {
      errors.reason = 'Reason is mandatory when a physical count variance exists.';
    } else if (reason && reason.trim().length > 500) {
      errors.reason = 'Reason cannot exceed 500 characters.';
    }

    if (!businessDate) {
      errors.businessDate = 'Business date is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!validate()) return;
    if (isSubmitting || isArchived) return;

    setIsSubmitting(true);
    const idempotencyKey = generateFreshIdempotencyKey();

    try {
      const res = await api.recordStockCount(
        {
          inventoryItemId: itemId,
          actualQuantity: parseFloat(actualQuantity),
          businessDate,
          reason: reason.trim() ? reason.trim() : undefined
        },
        idempotencyKey
      );

      setIsSubmitting(false);
      onSuccess(res.resultingBalance, res.movementCreated);
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (err instanceof ApiError) {
        setGeneralError(err.message || 'Failed to record physical count.');
      } else {
        setGeneralError('An unexpected error occurred while recording physical count.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Record Physical Stock Count"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm" noValidate>
        {/* Item Header */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">{itemName}</span>
            <Badge variant="neutral" className="text-[10px] font-mono">
              {baseUnit}
            </Badge>
          </div>
          <div className="text-xs text-slate-500 flex justify-between items-center">
            <span>Expected (Book Balance):</span>
            <strong className="text-slate-800 font-mono text-sm">
              {expectedNum.toFixed(3)} {baseUnit}
            </strong>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
          <ClipboardCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Authoritative Physical Audit</span>
            Input verified stock-take count. If a discrepancy exists, the server records a count correction to reconcile ledger to actual stock.
          </div>
        </div>

        {/* Archived Warning Banner */}
        {isArchived && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
            <Archive className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Archived Item</span>
              This item is archived. Archived items cannot receive new manual stock actions.
            </div>
          </div>
        )}

        {generalError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Actual Counted Quantity */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Actual Physical Count ({baseUnit}) *
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              value={actualQuantity}
              onChange={(e) => {
                setActualQuantity(e.target.value);
                if (fieldErrors.actualQuantity) {
                  setFieldErrors((prev) => ({ ...prev, actualQuantity: '' }));
                }
              }}
              placeholder="e.g. 15.000"
              className={fieldErrors.actualQuantity ? 'border-rose-500 focus:border-rose-500' : ''}
              disabled={isSubmitting || isArchived}
            />
            {fieldErrors.actualQuantity && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{fieldErrors.actualQuantity}</p>
            )}
          </div>

          {/* Business Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Business Date *
            </label>
            <Input
              type="date"
              value={businessDate}
              onChange={(e) => {
                setBusinessDate(e.target.value);
                if (fieldErrors.businessDate) {
                  setFieldErrors((prev) => ({ ...prev, businessDate: '' }));
                }
              }}
              disabled={isSubmitting || isArchived}
            />
            {fieldErrors.businessDate && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{fieldErrors.businessDate}</p>
            )}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason / Discrepancy Note {hasVariance ? <span className="text-rose-600">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (fieldErrors.reason) {
                setFieldErrors((prev) => ({ ...prev, reason: '' }));
              }
            }}
            placeholder={
              hasVariance
                ? 'Mandatory due to variance: e.g. Monthly stock-take discrepancy, Spill not logged...'
                : 'Optional audit note: e.g. Routine end-of-month count verified match...'
            }
            className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-800 ${
              fieldErrors.reason ? 'border-rose-500' : 'border-slate-200'
            }`}
            disabled={isSubmitting || isArchived}
          />
          {fieldErrors.reason && (
            <p className="text-xs text-rose-600 mt-1 font-medium">{fieldErrors.reason}</p>
          )}
        </div>

        {/* Live Variance Calculation (UI Preview only) */}
        {hasActual && (
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              varianceNum > 0.0001
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : varianceNum < -0.0001
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Audit Variance Preview
              </span>
              {varianceNum > 0.0001 ? (
                <Badge variant="success" className="flex items-center gap-1 text-[10px]">
                  <ArrowUpRight className="w-3.5 h-3.5" /> SURPLUS
                </Badge>
              ) : varianceNum < -0.0001 ? (
                <Badge variant="warning" className="flex items-center gap-1 text-[10px]">
                  <ArrowDownRight className="w-3.5 h-3.5" /> SHORTAGE
                </Badge>
              ) : (
                <Badge variant="neutral" className="flex items-center gap-1 text-[10px]">
                  <Check className="w-3.5 h-3.5" /> MATCH
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200 text-center text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Expected</span>
                <span className="font-mono font-semibold text-slate-800">
                  {expectedNum.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Actual</span>
                <span className="font-mono font-semibold text-slate-800">
                  {actualNum.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Variance</span>
                <span
                  className={`font-mono font-bold ${
                    varianceNum > 0.0001
                      ? 'text-emerald-700'
                      : varianceNum < -0.0001
                      ? 'text-amber-700'
                      : 'text-slate-700'
                  }`}
                >
                  {varianceNum > 0 ? `+${varianceNum.toFixed(3)}` : varianceNum.toFixed(3)} {baseUnit}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic mt-2">
              * The calculation is a UI preview. Server response is authoritative.
            </p>
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
            type="submit"
            variant="primary"
            disabled={isSubmitting || !hasActual || actualNum < 0 || isArchived}
            isLoading={isSubmitting}
            icon={<ClipboardCheck className="w-4 h-4" />}
          >
            Confirm Count & Reconcile
          </Button>
        </div>
      </form>
    </Modal>
  );
};
