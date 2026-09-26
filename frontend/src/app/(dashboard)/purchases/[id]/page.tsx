'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import {
  PurchaseDTO,
  PurchaseLineDTO,
  SupplierDTO,
  InventoryItemDTO,
  PurchaseLineInput,
  UpdatePurchaseDraftPayload,
  PurchasePaymentMethod
} from '@/lib/types';
import { formatINR, formatDate, formatDateTime } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { PurchaseStatusBadge } from '@/components/purchases/PurchaseStatusBadge';
import { PurchaseLineEditor } from '@/components/purchases/PurchaseLineEditor';
import { ReceiveConfirmModal } from '@/components/purchases/ReceiveConfirmModal';
import { ReverseConfirmModal } from '@/components/purchases/ReverseConfirmModal';
import { AttachmentUploader } from '@/components/purchases/AttachmentUploader';
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  CheckCircle,
  RotateCcw,
  Truck,
  Calendar,
  CreditCard,
  FileText,
  Clock,
  User,
  AlertTriangle,
  RefreshCw,
  Info
} from 'lucide-react';

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const purchaseId = typeof params.id === 'string' ? params.id : '';

  // Purchase State
  const [purchase, setPurchase] = useState<PurchaseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode State (Only for DRAFT)
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Reference Data (Suppliers & Items) for Edit Mode
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemDTO[]>([]);

  // Edit Form Fields
  const [editSupplierMode, setEditSupplierMode] = useState<'REGISTERED' | 'ADHOC'>('REGISTERED');
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editAdhocSupplierName, setEditAdhocSupplierName] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PurchasePaymentMethod>('CASH');
  const [editDiscount, setEditDiscount] = useState('0');
  const [editTaxAmount, setEditTaxAmount] = useState('0');
  const [editNote, setEditNote] = useState('');
  const [editLines, setEditLines] = useState<PurchaseLineInput[]>([]);

  // Modal States
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);

  // Load Purchase Detail
  const loadPurchase = useCallback(async () => {
    if (!purchaseId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await api.getPurchaseById(purchaseId);
      const data = res.purchase;
      setPurchase(data);

      // Populate edit fields
      if (data.status === 'DRAFT') {
        const isRegistered = !!(data.supplier_id || data.supplierId);
        setEditSupplierMode(isRegistered ? 'REGISTERED' : 'ADHOC');
        setEditSupplierId((data.supplier_id || data.supplierId) || '');
        setEditAdhocSupplierName(isRegistered ? '' : (data.supplier_name || data.supplierName || ''));
        setEditPurchaseDate((data.purchase_date || data.purchaseDate || '').slice(0, 10));
        setEditInvoiceNumber((data.invoice_number || data.invoiceNumber) || '');
        setEditPaymentMethod((data.payment_method || data.paymentMethod) || 'CASH');
        setEditDiscount(String(data.discount || '0'));
        setEditTaxAmount(String(data.tax_amount ?? data.taxAmount ?? '0'));
        setEditNote(data.note || '');

        const mappedLines: PurchaseLineInput[] = (data.lines || []).map((l: PurchaseLineDTO) => ({
          inventoryItemId: (l.inventory_item_id || l.inventoryItemId) || '',
          quantity: l.quantity,
          unitRate: l.unit_rate ?? l.unitRate ?? '0',
          lineDiscount: l.line_discount ?? l.lineDiscount ?? '0',
          taxRate: l.tax_rate ?? l.taxRate ?? '0'
        }));
        setEditLines(mappedLines.length > 0 ? mappedLines : [{
          inventoryItemId: '',
          quantity: '1',
          unitRate: '0',
          lineDiscount: '0',
          taxRate: '0'
        }]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase details.');
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    loadPurchase();
  }, [loadPurchase]);

  // Load Reference Data if editing
  useEffect(() => {
    if (isEditing && suppliers.length === 0) {
      api.listSuppliers({ status: 'active', pageSize: 100 })
        .then((res) => setSuppliers(res.items || []))
        .catch(() => {});
      api.listInventoryItems({ status: 'active', pageSize: 100 })
        .then((res) => setInventoryItems(res.items || []))
        .catch(() => {});
    }
  }, [isEditing, suppliers.length]);

  const supplierOptions = useMemo(() => {
    return [
      { label: 'Select a registered supplier...', value: '' },
      ...suppliers.map((s) => ({ label: s.name, value: s.id }))
    ];
  }, [suppliers]);

  const paymentMethodOptions = [
    { label: 'Cash', value: 'CASH' },
    { label: 'UPI / Online', value: 'UPI' },
    { label: 'Card', value: 'CARD' },
    { label: 'Credit', value: 'CREDIT' }
  ];

  // Save Draft Edits (PATCH)
  const handleSaveDraftChanges = async () => {
    const errors: Record<string, string> = {};

    if (editSupplierMode === 'REGISTERED') {
      if (!editSupplierId) errors.supplier = 'Please select a registered supplier.';
    } else {
      if (!editAdhocSupplierName.trim()) errors.supplier = 'Please enter an ad-hoc supplier name.';
    }

    if (!editPurchaseDate) {
      errors.purchaseDate = 'Purchase date is required.';
    }

    if (!editLines || editLines.length === 0) {
      errors.lines = 'At least one purchase line is required.';
    } else {
      editLines.forEach((line, idx) => {
        if (!line.inventoryItemId) errors[`line_${idx}`] = 'Inventory item is required.';
        const q = parseFloat(String(line.quantity));
        if (isNaN(q) || q <= 0) errors[`line_${idx}_qty`] = 'Quantity must be > 0';
        const r = parseFloat(String(line.unitRate));
        if (isNaN(r) || r <= 0) errors[`line_${idx}_rate`] = 'Rate must be > 0';
      });
    }

    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (isSavingEdit) return;

    setIsSavingEdit(true);

    const payload: UpdatePurchaseDraftPayload = {
      supplierId: editSupplierMode === 'REGISTERED' ? editSupplierId : null,
      adhocSupplierName: editSupplierMode === 'ADHOC' ? editAdhocSupplierName.trim() : null,
      purchaseDate: editPurchaseDate,
      invoiceNumber: editInvoiceNumber.trim() || null,
      paymentMethod: editPaymentMethod,
      discount: parseFloat(editDiscount) || 0,
      taxAmount: parseFloat(editTaxAmount) || 0,
      note: editNote.trim() || null,
      lines: editLines.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        quantity: parseFloat(String(l.quantity)) || 0,
        unitRate: parseFloat(String(l.unitRate)) || 0,
        lineDiscount: parseFloat(String(l.lineDiscount)) || 0,
        taxRate: parseFloat(String(l.taxRate)) || 0
      }))
    };

    try {
      const res = await api.updatePurchaseDraft(purchaseId, payload);
      setPurchase(res.purchase);
      setIsEditing(false);
      showToast('Purchase draft updated successfully', 'success');
      loadPurchase();
    } catch (err: any) {
      showToast(err.message || 'Failed to update purchase draft', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Purchase Not Found</h2>
        <p className="text-xs text-slate-600">{error || 'Unable to retrieve purchase details.'}</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/purchases')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Purchases
        </Button>
      </div>
    );
  }

  const pNum = purchase.purchase_number || purchase.purchaseNumber;
  const pDate = purchase.purchase_date || purchase.purchaseDate;
  const sName = purchase.supplier_name || purchase.supplierName || 'Ad-hoc Supplier';
  const pMethod = purchase.payment_method || purchase.paymentMethod;
  const gTotal = purchase.grand_total ?? purchase.grandTotal ?? 0;
  const taxAmt = purchase.tax_amount ?? purchase.taxAmount ?? 0;
  const discountAmt = purchase.discount ?? 0;
  const lines = purchase.lines || [];
  const reversal = purchase.reversal;
  const isDraft = purchase.status === 'DRAFT';
  const isReceived = purchase.status === 'RECEIVED';
  const isReversed = purchase.status === 'REVERSED';

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.push('/purchases')}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold font-mono text-slate-800">{pNum}</h1>
              <PurchaseStatusBadge status={purchase.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on {formatDateTime(purchase.created_at || purchase.createdAt)}
            </p>
          </div>
        </div>

        {/* Action Controls based on Status */}
        <div className="flex items-center gap-2">
          {isDraft && (
            <>
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      loadPurchase();
                    }}
                    disabled={isSavingEdit}
                    icon={<X className="w-3.5 h-3.5" />}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleSaveDraftChanges}
                    isLoading={isSavingEdit}
                    icon={<Save className="w-3.5 h-3.5" />}
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    icon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    Edit Draft
                  </Button>
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    onClick={() => setShowReceiveModal(true)}
                    icon={<CheckCircle className="w-3.5 h-3.5" />}
                  >
                    Receive Stock
                  </Button>
                </>
              )}
            </>
          )}

          {isReceived && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setShowReverseModal(true)}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reverse Purchase
            </Button>
          )}
        </div>
      </div>

      {/* Reversal Banner if Reversed */}
      {isReversed && reversal && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1.5 text-xs text-rose-900">
          <div className="flex items-center gap-2 font-semibold">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <span>Purchase Reversed</span>
          </div>
          <div>
            <strong>Reason:</strong> {reversal.reason}
          </div>
          <div className="text-rose-700 text-[11px]">
            Reversed on {formatDateTime(reversal.reversed_at || reversal.reversedAt)}
          </div>
        </div>
      )}

      {/* Primary Details Card */}
      <Card className="p-5 bg-white shadow-2xs space-y-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
          <Truck className="w-4 h-4 text-forest-700" />
          Purchase Information
        </h3>

        {isEditing ? (
          /* Editable Form Fields */
          <div className="space-y-4 pt-1">
            {/* Supplier Type Toggle */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Supplier Type</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditSupplierMode('REGISTERED');
                    setEditAdhocSupplierName('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    editSupplierMode === 'REGISTERED'
                      ? 'bg-forest-800 text-white border-forest-800'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Registered Supplier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditSupplierMode('ADHOC');
                    setEditSupplierId('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    editSupplierMode === 'ADHOC'
                      ? 'bg-forest-800 text-white border-forest-800'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Ad-hoc Supplier
                </button>
              </div>
            </div>

            <div>
              {editSupplierMode === 'REGISTERED' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Registered Supplier
                  </label>
                  <Select
                    options={supplierOptions}
                    value={editSupplierId}
                    onChange={(e) => setEditSupplierId(e.target.value)}
                    error={editErrors.supplier}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Ad-hoc Supplier Name
                  </label>
                  <Input
                    type="text"
                    value={editAdhocSupplierName}
                    onChange={(e) => setEditAdhocSupplierName(e.target.value)}
                    error={editErrors.supplier}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Purchase Date</label>
                <Input
                  type="date"
                  value={editPurchaseDate}
                  onChange={(e) => setEditPurchaseDate(e.target.value)}
                  error={editErrors.purchaseDate}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Invoice Number</label>
                <Input
                  type="text"
                  value={editInvoiceNumber}
                  onChange={(e) => setEditInvoiceNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                <Select
                  options={paymentMethodOptions}
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value as PurchasePaymentMethod)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-800"
              />
            </div>
          </div>
        ) : (
          /* Read-only Information Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Supplier</span>
              <span className="font-semibold text-slate-800 text-sm">{sName}</span>
              {(purchase.supplier_id || purchase.supplierId) ? (
                <Badge variant="forest" className="mt-1 text-[10px]">Registered</Badge>
              ) : (
                <Badge variant="neutral" className="mt-1 text-[10px]">Ad-hoc</Badge>
              )}
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Purchase Date</span>
              <span className="font-medium text-slate-800">{formatDate(pDate)}</span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Invoice / Bill Ref</span>
              <span className="font-mono text-slate-800">
                {(purchase.invoice_number || purchase.invoiceNumber) || '—'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Payment Method</span>
              <Badge variant="neutral" className="uppercase font-mono text-[10px]">
                {pMethod}
              </Badge>
            </div>

            {purchase.note && (
              <div className="sm:col-span-2 lg:col-span-4 p-3 bg-slate-50 rounded-xl text-slate-700">
                <span className="font-semibold text-slate-500 block text-[11px] mb-0.5">Remarks:</span>
                {purchase.note}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Purchase Lines Presentation */}
      <Card className="p-5 bg-white shadow-2xs space-y-4">
        {isEditing ? (
          <PurchaseLineEditor
            lines={editLines}
            inventoryItems={inventoryItems}
            onChange={setEditLines}
            errors={editErrors}
          />
        ) : (
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Line Items ({lines.length})
              </h3>
              <Badge variant="neutral" className="text-[10px]">
                Immutable Records
              </Badge>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto pt-2">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-3 text-right">Unit Rate</th>
                    <th className="py-2.5 px-3 text-right">Discount</th>
                    <th className="py-2.5 px-3 text-right">Tax Rate</th>
                    <th className="py-2.5 px-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {line.item_name || line.itemName}
                      </td>
                      <td className="py-3 px-3 font-mono">{line.quantity}</td>
                      <td className="py-3 px-3">
                        <Badge variant="neutral" className="text-[10px] font-mono">
                          {line.unit}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {formatINR(line.unit_rate ?? line.unitRate)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        {parseFloat(String(line.line_discount ?? line.lineDiscount)) > 0
                          ? `- ${formatINR(line.line_discount ?? line.lineDiscount)}`
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        {parseFloat(String(line.tax_rate ?? line.taxRate)) > 0
                          ? `${line.tax_rate ?? line.taxRate}%`
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900">
                        {formatINR(line.line_total ?? line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2.5 pt-2">
              {lines.map((line, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span>{line.item_name || line.itemName}</span>
                    <span>{formatINR(line.line_total ?? line.lineTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>
                      {line.quantity} {line.unit} @ {formatINR(line.unit_rate ?? line.unitRate)}
                    </span>
                    {parseFloat(String(line.tax_rate ?? line.taxRate)) > 0 && (
                      <span>Tax: {line.tax_rate ?? line.taxRate}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Authoritative Server Totals Card */}
      <Card className="p-5 bg-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Authoritative Totals
          </h3>
          <Badge variant="forest" className="text-[10px]">
            Server Verified
          </Badge>
        </div>

        <div className="max-w-md ml-auto space-y-2 text-xs">
          {parseFloat(String(discountAmt)) > 0 && (
            <div className="flex items-center justify-between text-amber-700">
              <span>Overall Discount:</span>
              <span className="font-semibold">- {formatINR(discountAmt)}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-slate-600">
            <span>Tax Amount:</span>
            <span className="font-medium text-slate-800">{formatINR(taxAmt)}</span>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-slate-900">
            <span>Grand Total:</span>
            <span className="text-lg text-forest-800">{formatINR(gTotal)}</span>
          </div>
        </div>
      </Card>

      {/* Invoice Attachment Proof Section */}
      <AttachmentUploader
        purchaseId={purchase.id}
        hasAttachment={!!(purchase.attachment_id || purchase.attachmentId)}
        canUpload={isDraft}
        onUploadSuccess={loadPurchase}
      />

      {/* Modals */}
      {showReceiveModal && (
        <ReceiveConfirmModal
          isOpen={showReceiveModal}
          onClose={() => setShowReceiveModal(false)}
          purchase={purchase}
          onSuccess={(updated) => {
            setPurchase(updated);
            showToast('Purchase received and stock movements recorded', 'success');
            loadPurchase();
          }}
          onRefreshNeeded={loadPurchase}
        />
      )}

      {showReverseModal && (
        <ReverseConfirmModal
          isOpen={showReverseModal}
          onClose={() => setShowReverseModal(false)}
          purchase={purchase}
          onSuccess={(updated) => {
            setPurchase(updated);
            showToast('Purchase reversed successfully', 'success');
            loadPurchase();
          }}
          onRefreshNeeded={loadPurchase}
        />
      )}
    </div>
  );
}
