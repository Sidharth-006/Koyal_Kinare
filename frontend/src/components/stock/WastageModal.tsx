'use client';

import React, { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { getTodayIsoDate } from '@/lib/format';
import { Trash2, AlertTriangle, AlertOctagon, CheckCircle, Archive } from 'lucide-react';

export interface WastageModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  baseUnit: string;
  currentBalance: string;
  isArchived?: boolean;
  onSuccess: (resultingBalance: string) => void;
}

export const WastageModal: React.FC<WastageModalProps> = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  baseUnit,
  currentBalance,
  isArchived = false,
  onSuccess
}) => {
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
    return `wst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const qtyNum = parseFloat(quantity) || 0;
  const currentNum = parseFloat(currentBalance) || 0;
  const calculatedBalanceNum = currentNum - qtyNum;
  const isNegative = calculatedBalanceNum < 0;

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

    if (!reason || reason.trim().length === 0) {
      errors.reason = 'A reason is mandatory for logging wastage.';
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
          type: 'WASTAGE',
          quantity: parseFloat(quantity),
          businessDate,
          reason: reason.trim()
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
          setGeneralError(err.message || 'Failed to record wastage.');
        }
      } else {
        setGeneralError('An unexpected error occurred while recording wastage.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Record Stock Wastage"
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

        {/* Permanent Cost Warning Banner */}
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
          <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Permanent Stock & Cost Impact</span>
            Logging wastage records spoiled, expired, or spilled stock as a direct financial loss. This permanently deducts available inventory.
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
          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantity Wasted ({baseUnit}) *
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
              placeholder="e.g. 1.250"
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

        {/* Reason / Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for Wastage <span className="text-rose-600">*</span>
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
            placeholder="e.g. Milk expired before use, Shattered syrup container, Spoiled during power cut..."
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
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                {isNegative ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-slate-600" />
                )}
                Calculated Stock Preview (ESTIMATED):
              </span>
              <Badge variant={isNegative ? 'danger' : 'neutral'} className="text-[10px]">
                {isNegative ? 'Negative Balance Blocked' : 'Valid Wastage'}
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
            variant="danger"
            disabled={isSubmitting || isNegative || isArchived}
            isLoading={isSubmitting}
            icon={<Trash2 className="w-4 h-4" />}
          >
            Confirm Wastage
          </Button>
        </div>
      </form>
    </Modal>
  );
};
