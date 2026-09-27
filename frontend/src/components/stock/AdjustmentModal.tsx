'use client';

import React, { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { getTodayIsoDate } from '@/lib/format';
import { ArrowUpRight, ArrowDownRight, AlertTriangle, AlertOctagon, CheckCircle, Sliders, Archive } from 'lucide-react';

export interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  baseUnit: string;
  currentBalance: string;
  isArchived?: boolean;
  onSuccess: (resultingBalance: string) => void;
}

export const AdjustmentModal: React.FC<AdjustmentModalProps> = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  baseUnit,
  currentBalance,
  isArchived = false,
  onSuccess
}) => {
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [quantity, setQuantity] = useState('');
  const [businessDate, setBusinessDate] = useState(getTodayIsoDate());
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const generateFreshIdempotencyKey = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `adj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const qtyNum = parseFloat(quantity) || 0;
  const currentNum = parseFloat(currentBalance) || 0;
  const calculatedBalanceNum = direction === 'INCREASE' ? currentNum + qtyNum : currentNum - qtyNum;
  const isNegative = direction === 'DECREASE' && calculatedBalanceNum < 0;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (isArchived) {
      errors.quantity = 'Archived items cannot receive new manual stock actions.';
      setFieldErrors(errors);
      return false;
    }

    if (!quantity || quantity.trim() === '') {
      errors.quantity = 'Quantity is required.';
    } else {
      const q = parseFloat(quantity);
      if (isNaN(q) || q <= 0) {
        errors.quantity = 'Quantity must be greater than zero.';
      } else {
        const parts = quantity.split('.');
        if (parts.length > 1 && parts[1].length > 3) {
          errors.quantity = 'Quantity cannot have more than 3 decimal places.';
        }
      }
    }

    if (direction === 'DECREASE' && (!reason || reason.trim().length === 0)) {
      errors.reason = 'Reason is mandatory for manual decreases.';
    } else if (reason.trim().length > 500) {
      errors.reason = 'Reason cannot exceed 500 characters.';
    }

    if (isNegative) {
      errors.quantity = 'This change would make stock negative. Review the current quantity.';
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
      const res = await api.recordStockAdjustment(
        {
          inventoryItemId: itemId,
          type: direction === 'INCREASE' ? 'MANUAL_INCREASE' : 'MANUAL_DECREASE',
          quantity: parseFloat(quantity),
          businessDate,
          reason: reason.trim() || undefined
        },
        idempotencyKey
      );

      setIsSubmitting(false);
      onSuccess(res.resultingBalance);
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (err instanceof ApiError) {
        if (err.statusCode === 409 || err.code === 'INSUFFICIENT_STOCK' || err.message.toLowerCase().includes('negative') || err.message.toLowerCase().includes('insufficient')) {
          setGeneralError('This change would make stock negative. Review the current quantity.');
        } else {
          setGeneralError(err.message || 'Failed to record adjustment.');
        }
      } else {
        setGeneralError('An unexpected error occurred while recording stock adjustment.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Adjust Inventory Stock"
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
          <div className="text-xs text-slate-500">
            Current system balance: <strong className="text-slate-700">{currentBalance} {baseUnit}</strong>
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
            <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Direction Toggle */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
            Adjustment Direction *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setDirection('INCREASE');
                if (fieldErrors.reason) {
                  setFieldErrors((prev) => ({ ...prev, reason: '' }));
                }
              }}
              disabled={isSubmitting || isArchived}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                direction === 'INCREASE'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm ring-1 ring-emerald-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              <span>Increase Stock (+)</span>
            </button>

            <button
              type="button"
              onClick={() => setDirection('DECREASE')}
              disabled={isSubmitting || isArchived}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                direction === 'DECREASE'
                  ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-sm ring-1 ring-amber-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ArrowDownRight className="w-4 h-4 text-amber-600" />
              <span>Decrease Stock (-)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantity ({baseUnit}) *
            </label>
            <Input
              type="number"
              step="any"
              min="0.001"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                if (fieldErrors.quantity) {
                  setFieldErrors((prev) => ({ ...prev, quantity: '' }));
                }
              }}
              placeholder="e.g. 5.000"
              className={fieldErrors.quantity ? 'border-rose-500 focus:border-rose-500' : ''}
              disabled={isSubmitting || isArchived}
            />
            {fieldErrors.quantity && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{fieldErrors.quantity}</p>
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
            Reason {direction === 'DECREASE' ? <span className="text-rose-600">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
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
              direction === 'DECREASE'
                ? 'Mandatory: e.g. Damaged during prep, Spill cleanup, Sample testing...'
                : 'Optional note: e.g. Found untracked reserve, Supplier bonus...'
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

        {/* Calculated Impact Preview */}
        {qtyNum > 0 && (
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isNegative
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                {isNegative ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                )}
                Calculated Stock Preview (ESTIMATED):
              </span>
              <Badge variant={isNegative ? 'danger' : 'neutral'} className="text-[10px]">
                {isNegative ? 'Negative Balance Blocked' : 'Estimated Result'}
              </Badge>
            </div>
            <div className="mt-2 text-xs flex items-center justify-between">
              <span className="text-slate-600">ESTIMATED Resulting Balance:</span>
              <span className={`font-mono font-bold ${isNegative ? 'text-rose-700' : 'text-slate-900'}`}>
                {calculatedBalanceNum.toFixed(3)} {baseUnit}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 italic mt-1">
              * Server response is authoritative. Final balance determined on submit.
            </p>
            {isNegative && (
              <p className="text-xs font-bold text-rose-700 mt-2 border-t border-rose-200 pt-2">
                This change would make stock negative. Review the current quantity.
              </p>
            )}
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
            disabled={isSubmitting || isNegative || isArchived}
            isLoading={isSubmitting}
            icon={<Sliders className="w-4 h-4" />}
          >
            Confirm Adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
