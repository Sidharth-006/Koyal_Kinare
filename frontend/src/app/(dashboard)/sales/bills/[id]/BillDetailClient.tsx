'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { BillDTO } from '@/lib/types';
import { formatINR } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

export default function BillDetailPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const billId = params?.id as string;

  const [bill, setBill] = useState<BillDTO | null>(null);
  const [loading, setLoading] = useState(true);

  // Void Bill Modal State
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [submittingVoid, setSubmittingVoid] = useState(false);

  useEffect(() => {
    if (billId) {
      loadBillDetails();
    }
  }, [billId]);

  const loadBillDetails = async () => {
    setLoading(true);
    try {
      const res = await api.getBillById(billId);
      setBill(res.bill);
    } catch (err: any) {
      showToast(err.message || 'Failed to load bill details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVoidBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason.trim()) {
      showToast('Mandatory void reason is required', 'warning');
      return;
    }

    setSubmittingVoid(true);
    try {
      const res = await api.voidBill(billId, voidReason.trim());
      setBill(res.bill);
      showToast(`Bill #${res.bill.bill_number || res.bill.billNumber} voided successfully!`, 'success');
      setShowVoidModal(false);
      setVoidReason('');
    } catch (err: any) {
      showToast(err.message || 'Failed to void bill', 'error');
    } finally {
      setSubmittingVoid(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center text-slate-500">Loading bill details...</Card>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center text-slate-500">
          <p>Bill not found</p>
          <Link href="/sales" className="text-emerald-400 font-semibold mt-2 inline-block">
            ← Return to Sales Analytics
          </Link>
        </Card>
      </div>
    );
  }

  const isVoided = bill.status === 'VOIDED';
  const bNum = bill.bill_number || bill.billNumber;
  const bDate = bill.business_date || bill.operatingDate;
  const oType = bill.order_type || bill.orderType;
  const tName = bill.table_name || bill.tableName;
  const cAt = bill.created_at || bill.createdAt;
  const gTotal = bill.grand_total || bill.grandTotal;
  const lines = bill.lines || bill.items || [];
  const pm = bill.payments && bill.payments.length > 0 ? bill.payments[0].payment_method : (bill.paymentMethod || 'CASH');
  const vReason = bill.void_record?.void_reason || bill.voidReason;
  const vAt = bill.void_record?.voided_at || bill.voidedAt;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link
            href="/sales"
            className="text-xs text-slate-500 hover:text-emerald-700 transition-colors font-medium flex items-center gap-1 mb-2"
          >
            ← Back to Sales Analytics
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Bill #{bNum}</h1>
            {isVoided ? (
              <Badge variant="danger">VOIDED</Badge>
            ) : (
              <Badge variant="success">PAID</Badge>
            )}
          </div>
        </div>

        {!isVoided && (
          <Button
            variant="danger"
            onClick={() => setShowVoidModal(true)}
            className="shadow-sm"
          >
            🚫 Void Bill
          </Button>
        )}
      </div>

      {/* Void Notice Card if Voided */}
      {isVoided && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-rose-800 text-sm flex items-center gap-2">
              ⚠️ Bill Voided Audit Record
            </span>
            <span className="text-xs font-mono text-rose-600">
              Voided At: {vAt ? new Date(vAt).toLocaleString() : 'N/A'}
            </span>
          </div>
          <p className="text-xs text-rose-700">
            Mandatory Void Reason: <strong className="text-rose-900 italic">"{vReason || 'No reason provided'}"</strong>
          </p>
          <div className="pt-2 border-t border-rose-200 flex items-center gap-2 text-[11px] text-rose-700">
            <span>ℹ️ Preservation Compliance:</span>
            <span className="bg-rose-100 px-2 py-0.5 rounded text-rose-800">
              Original payment record preserved for payment history & financial audit. Excluded from sales totals.
            </span>
          </div>
        </div>
      )}

      {/* Bill Metadata Grid */}
      <Card className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white border border-slate-200">
        <div>
          <span className="text-xs text-slate-500 font-medium uppercase">Operating Date</span>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">{bDate}</p>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-medium uppercase">Order Type</span>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">
            {oType} {tName ? `(${tName})` : ''}
          </p>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-medium uppercase">Payment Method</span>
          <p className="text-sm font-semibold text-emerald-700 mt-0.5">{pm}</p>
        </div>
        <div>
          <span className="text-xs text-slate-500 font-medium uppercase">Created At</span>
          <p className="text-xs font-mono text-slate-700 mt-0.5">
            {cAt ? new Date(cAt).toLocaleTimeString() : '-'}
          </p>
        </div>
      </Card>

      {/* Frozen Line Items Table */}
      <Card className="p-0 overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm">Frozen Line Item Snapshots</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="p-4">Item Name</th>
                <th className="p-4 text-right">Unit Price</th>
                <th className="p-4 text-center">Quantity</th>
                <th className="p-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {lines.map((item, idx) => {
                const iName = item.item_name || item.itemName;
                const uPrice = item.unit_price || item.unitPrice;
                const sub = item.subtotal;
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{iName}</td>
                    <td className="p-4 text-right font-mono text-slate-600">
                      {formatINR(uPrice)}
                    </td>
                    <td className="p-4 text-center font-bold text-slate-800">{item.quantity}</td>
                    <td className="p-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatINR(sub)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Financial Breakdown Summary Card */}
      <Card className="space-y-2 bg-white border border-slate-200">
        <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
          Authoritative Financial Breakdown
        </h3>
        <div className="space-y-1.5 text-sm pt-1">
          <div className="flex justify-between text-slate-600">
            <span>Items Subtotal:</span>
            <span className="font-mono text-slate-800">{formatINR(bill.subtotal)}</span>
          </div>

          {Number(bill.discount) > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount Applied:</span>
              <span className="font-mono">-{formatINR(bill.discount)}</span>
            </div>
          )}

          {Number(bill.tax || bill.taxAmount || 0) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Tax ({bill.taxRate || 0}%):</span>
              <span className="font-mono text-slate-800">+{formatINR(bill.tax || bill.taxAmount || 0)}</span>
            </div>
          )}

          <div className="flex justify-between font-bold text-lg text-slate-900 pt-2 border-t border-slate-200">
            <span>GRAND TOTAL:</span>
            <span className={isVoided ? 'text-rose-600 line-through' : 'text-emerald-700'}>
              {formatINR(gTotal)}
            </span>
          </div>
        </div>
      </Card>

      {/* MANDATORY VOID BILL MODAL */}
      <Modal
        isOpen={showVoidModal}
        onClose={() => setShowVoidModal(false)}
        title="Void Bill Confirmation"
      >
        <form onSubmit={handleVoidBill} className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            You are voiding Bill <strong>#{bNum}</strong> with grand total{' '}
            <strong>{formatINR(gTotal)}</strong>.
            This action will exclude the bill from sales reports while preserving payment history records.
          </div>

          <Input
            label="Mandatory Void Reason *"
            placeholder="e.g. Customer returned order, accidental double billing"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setShowVoidModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="danger" type="submit" isLoading={submittingVoid}>
              Confirm & Void Bill
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
