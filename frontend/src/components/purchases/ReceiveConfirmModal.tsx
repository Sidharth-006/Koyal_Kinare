'use client';

import React, { useState } from 'react';
import { PurchaseDTO } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatINR, formatDate } from '@/lib/format';
import { AlertTriangle, CheckCircle, Info, RefreshCw, ShieldAlert } from 'lucide-react';

export interface ReceiveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: PurchaseDTO;
  onSuccess: (updatedPurchase: PurchaseDTO) => void;
  onRefreshNeeded: () => void;
}

export const ReceiveConfirmModal: React.FC<ReceiveConfirmModalProps> = ({
  isOpen,
  onClose,
  purchase,
  onSuccess,
  onRefreshNeeded
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAmbiguousState, setIsAmbiguousState] = useState(false);
  // Generate ONE idempotency key per receive session
  const [idempotencyKey] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `recv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  const lines = purchase.lines || [];
  const grandTotal = purchase.grand_total ?? purchase.grandTotal ?? 0;
  const isCash = (purchase.payment_method || purchase.paymentMethod) === 'CASH';

  const handleConfirmReceive = async () => {
    if (isSubmitting || isAmbiguousState) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.receivePurchase(purchase.id, idempotencyKey);
      setIsSubmitting(false);
      onSuccess(res.purchase);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);

      if (err instanceof ApiError) {
        if (err.code === 'PURCHASE_ALREADY_RECEIVED') {
          setError('This purchase has already been received. Refreshing detail...');
          setTimeout(() => {
            onRefreshNeeded();
            onClose();
          }, 1500);
          return;
        }

        if (err.code === 'IDEMPOTENCY_KEY_REUSED') {
          setError('This receive operation was already processed with this key. Refreshing...');
          setTimeout(() => {
            onRefreshNeeded();
            onClose();
          }, 1500);
          return;
        }

        setError(err.message || 'Failed to receive purchase.');
      } else {
        // Ambiguous network failure: DO NOT retry with a new key!
        setIsAmbiguousState(true);
        setError(
          'Network connection interrupted during receive. The server may have processed this request. Please do not retry immediately — check the purchase status.'
        );
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Receive Purchase & Update Stock"
      size="lg"
    >
      <div className="space-y-4 text-sm">
        {/* Purchase Summary Review */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">
              {purchase.purchase_number || purchase.purchaseNumber}
            </span>
            <span className="text-slate-500 text-xs">
              {formatDate(purchase.purchase_date || purchase.purchaseDate)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Supplier:</span>
            <span className="font-medium text-slate-800">
              {purchase.supplier_name || purchase.supplierName || 'Ad-hoc Supplier'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Payment Method:</span>
            <Badge variant="neutral" className="uppercase font-mono text-[10px]">
              {purchase.payment_method || purchase.paymentMethod}
            </Badge>
          </div>
        </div>

        {/* Line Items Review Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            Line Items ({lines.length})
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
            {lines.map((line, idx) => (
              <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-slate-800">
                    {line.item_name || line.itemName}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Qty: {line.quantity} {line.unit} @ ₹{line.unit_rate || line.unitRate}
                  </div>
                </div>
                <div className="font-medium text-slate-800">
                  {formatINR(line.line_total || line.lineTotal)}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-slate-50 p-2.5 border-t border-slate-200 flex items-center justify-between font-semibold text-slate-900">
            <span>Authoritative Grand Total:</span>
            <span className="text-base text-forest-800">{formatINR(grandTotal)}</span>
          </div>
        </div>

        {/* Notices */}
        <div className="space-y-2">
          {/* Stock Impact Notice */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Stock Impact</span>
              Receiving this purchase will record stock-in movements in the Stock Ledger for its purchase lines.
            </div>
          </div>

          {/* Cash Impact Notice */}
          {isCash && (
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Cash Reconciliation Impact</span>
                This is a CASH purchase. Receiving it will reduce the expected cash drawer balance by{' '}
                <strong className="font-bold">{formatINR(grandTotal)}</strong> in daily closing reconciliation.
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              isAmbiguousState
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {isAmbiguousState ? (
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div>{error}</div>
              {isAmbiguousState && (
                <div className="pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onRefreshNeeded();
                      onClose();
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Refresh Status Now
                  </Button>
                </div>
              )}
            </div>
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
          {!isAmbiguousState && (
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmReceive}
              isLoading={isSubmitting}
              icon={<CheckCircle className="w-4 h-4" />}
            >
              Confirm Receive
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
