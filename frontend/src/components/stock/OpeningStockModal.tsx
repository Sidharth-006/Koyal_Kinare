'use client';

import React, { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { getTodayIsoDate } from '@/lib/format';
import { Layers, AlertTriangle, CheckCircle, Archive } from 'lucide-react';

export interface OpeningStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  baseUnit: string;
  currentBalance: string;
  isArchived?: boolean;
  onSuccess: (resultingBalance: string) => void;
}

export const OpeningStockModal: React.FC<OpeningStockModalProps> = ({
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
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const qtyNum = parseFloat(quantity) || 0;
  const currentNum = parseFloat(currentBalance) || 0;
  const estResulting = (currentNum + qtyNum).toFixed(3);

  const generateFreshIdempotencyKey = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

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

    if (!businessDate) {
      errors.businessDate = 'Business date is required.';
    }

    if (note && note.length > 500) {
      errors.note = 'Note cannot exceed 500 characters.';
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
      const res = await api.recordOpeningStock(
        {
          inventoryItemId: itemId,
          quantity: parseFloat(quantity),
          businessDate,
          note: note.trim() || undefined
        },
        idempotencyKey
      );

      setIsSubmitting(false);
      onSuccess(res.resultingBalance);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      if (err instanceof ApiError) {
        setGeneralError(err.message);
      } else {
        setGeneralError('Network error while recording opening stock. Please check current balance.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Set Initial Opening Stock"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* Item context banner */}
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

        {/* Quantity and Base Unit */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Opening Quantity <span className="text-rose-600">*</span>
          </label>
          <div className="flex items-center gap-2">
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
              placeholder="e.g. 50.000"
              disabled={isSubmitting || isArchived}
              className="flex-1"
            />
            <span className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-700">
              {baseUnit}
            </span>
          </div>
          {fieldErrors.quantity && (
            <p className="text-xs text-rose-600 mt-1 font-medium">{fieldErrors.quantity}</p>
          )}
        </div>

        {/* Business Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Business Date <span className="text-rose-600">*</span>
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

        {/* Note */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Note / Reference <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (fieldErrors.note) {
                setFieldErrors((prev) => ({ ...prev, note: '' }));
              }
            }}
            placeholder="e.g. Initial stock intake before launch..."
            rows={2}
            disabled={isSubmitting || isArchived}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-800 disabled:bg-slate-100"
          />
          {fieldErrors.note && (
            <p className="text-xs text-rose-600 mt-1 font-medium">{fieldErrors.note}</p>
          )}
        </div>

        {/* Calculation Preview Banner */}
        {qtyNum > 0 && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs space-y-1 text-emerald-900">
            <div className="font-semibold flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Calculated Stock Preview (ESTIMATED)</span>
              </div>
              <Badge variant="neutral" className="text-[10px]">Estimated</Badge>
            </div>
            <div className="flex justify-between text-[11px] text-emerald-800">
              <span>Current Balance:</span>
              <span>{currentBalance} {baseUnit}</span>
            </div>
            <div className="flex justify-between text-[11px] text-emerald-800">
              <span>Opening Addition:</span>
              <span>+ {qtyNum.toFixed(3)} {baseUnit}</span>
            </div>
            <div className="pt-1 border-t border-emerald-200 flex justify-between font-bold text-emerald-950">
              <span>ESTIMATED Resulting Balance:</span>
              <span>{estResulting} {baseUnit}</span>
            </div>
            <p className="text-[10px] text-emerald-700 italic pt-0.5">
              * Server response is authoritative. Final balance determined on submit.
            </p>
          </div>
        )}

        {generalError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{generalError}</span>
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
            isLoading={isSubmitting}
            disabled={isSubmitting || isArchived}
            icon={<Layers className="w-4 h-4" />}
          >
            Confirm Opening Stock
          </Button>
        </div>
      </form>
    </Modal>
  );
};
