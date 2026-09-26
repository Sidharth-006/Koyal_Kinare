'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import {
  SupplierDTO,
  InventoryItemDTO,
  PurchasePaymentMethod,
  PurchaseLineInput,
  CreatePurchaseDraftPayload
} from '@/lib/types';
import { formatINR, getTodayIsoDate } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { PurchaseLineEditor } from '@/components/purchases/PurchaseLineEditor';
import {
  ShoppingCart,
  ArrowLeft,
  Save,
  Truck,
  User,
  Info,
  AlertTriangle,
  Paperclip,
  CheckCircle2
} from 'lucide-react';

export default function NewPurchasePage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Reference Data States
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemDTO[]>([]);
  const [isLoadingRefData, setIsLoadingRefData] = useState(true);

  // Supplier Mode State ('REGISTERED' vs 'ADHOC')
  const [supplierMode, setSupplierMode] = useState<'REGISTERED' | 'ADHOC'>('REGISTERED');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [adhocSupplierName, setAdhocSupplierName] = useState('');

  // Header Field States
  const [purchaseDate, setPurchaseDate] = useState(getTodayIsoDate());
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('CASH');
  const [headerDiscount, setHeaderDiscount] = useState('0');
  const [headerTaxAmount, setHeaderTaxAmount] = useState('0');
  const [note, setNote] = useState('');

  // Optional Attachment State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Line Items State
  const [lines, setLines] = useState<PurchaseLineInput[]>([
    {
      inventoryItemId: '',
      quantity: '1',
      unitRate: '0',
      lineDiscount: '0',
      taxRate: '0'
    }
  ]);

  // Submission & Validation States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Load Active Suppliers & Inventory Items
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [suppliersRes, itemsRes] = await Promise.all([
          api.listSuppliers({ status: 'active', pageSize: 100 }),
          api.listInventoryItems({ status: 'active', pageSize: 100 })
        ]);
        if (isMounted) {
          setSuppliers(suppliersRes.items || []);
          setInventoryItems(itemsRes.items || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setGeneralError('Failed to load required supplier or inventory data.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingRefData(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

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

  // Client-Side Estimated Totals Preview
  const estimatedTotals = useMemo(() => {
    let subtotal = 0;
    let linesTax = 0;

    for (const line of lines) {
      const qty = parseFloat(String(line.quantity)) || 0;
      const rate = parseFloat(String(line.unitRate)) || 0;
      const disc = parseFloat(String(line.lineDiscount)) || 0;
      const taxRate = parseFloat(String(line.taxRate)) || 0;

      const lineNet = Math.max(0, qty * rate - disc);
      const lineTax = (lineNet * taxRate) / 100;
      subtotal += lineNet;
      linesTax += lineTax;
    }

    const overallDiscount = parseFloat(headerDiscount) || 0;
    const overallTax = parseFloat(headerTaxAmount) || 0;

    const finalSubtotal = Math.max(0, subtotal - overallDiscount);
    const finalTax = overallTax > 0 ? overallTax : linesTax;
    const grandTotal = finalSubtotal + finalTax;

    return {
      subtotal,
      overallDiscount,
      totalTax: finalTax,
      grandTotal
    };
  }, [lines, headerDiscount, headerTaxAmount]);

  // Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Supplier validation (mutually exclusive)
    if (supplierMode === 'REGISTERED') {
      if (!selectedSupplierId) {
        errors.supplier = 'Please select a registered supplier.';
      }
    } else {
      if (!adhocSupplierName.trim()) {
        errors.supplier = 'Please enter an ad-hoc supplier name.';
      } else if (adhocSupplierName.trim().length > 100) {
        errors.supplier = 'Ad-hoc supplier name cannot exceed 100 characters.';
      }
    }

    // Purchase Date validation
    if (!purchaseDate) {
      errors.purchaseDate = 'Purchase date is required.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      errors.purchaseDate = 'Purchase date must be in YYYY-MM-DD format.';
    }

    // Payment Method validation
    if (!paymentMethod) {
      errors.paymentMethod = 'Payment method is required.';
    }

    // Lines validation
    if (!lines || lines.length === 0) {
      errors.lines = 'At least one purchase line is required.';
    } else {
      lines.forEach((line, idx) => {
        if (!line.inventoryItemId) {
          errors[`line_${idx}`] = 'Inventory item is required.';
        }
        const qty = parseFloat(String(line.quantity));
        if (isNaN(qty) || qty <= 0) {
          errors[`line_${idx}_qty`] = 'Quantity must be greater than zero.';
        }
        const rate = parseFloat(String(line.unitRate));
        if (isNaN(rate) || rate <= 0) {
          errors[`line_${idx}_rate`] = 'Unit rate must be greater than zero.';
        }
      });
    }

    // Optional File Validation (<= 5MB, JPG/PNG/PDF)
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        errors.attachment = 'Attachment exceeds the 5 MB limit.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveDraft = async () => {
    setGeneralError(null);
    if (!validateForm()) return;
    if (isSubmitting) return;

    setIsSubmitting(true);

    const payload: CreatePurchaseDraftPayload = {
      supplierId: supplierMode === 'REGISTERED' ? selectedSupplierId : null,
      adhocSupplierName: supplierMode === 'ADHOC' ? adhocSupplierName.trim() : null,
      purchaseDate,
      invoiceNumber: invoiceNumber.trim() || null,
      paymentMethod,
      discount: parseFloat(headerDiscount) || 0,
      taxAmount: parseFloat(headerTaxAmount) || 0,
      note: note.trim() || null,
      lines: lines.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        quantity: parseFloat(String(l.quantity)) || 0,
        unitRate: parseFloat(String(l.unitRate)) || 0,
        lineDiscount: parseFloat(String(l.lineDiscount)) || 0,
        taxRate: parseFloat(String(l.taxRate)) || 0
      }))
    };

    try {
      const res = await api.createPurchaseDraft(payload);
      const createdPurchase = res.purchase;

      // If user selected an attachment file during creation, upload it now
      if (selectedFile) {
        try {
          await api.uploadPurchaseAttachment(createdPurchase.id, selectedFile);
        } catch (uploadErr: any) {
          showToast(
            'Draft created, but invoice attachment failed to upload. You can upload it from the purchase detail screen.',
            'warning'
          );
        }
      }

      showToast('Purchase draft created successfully', 'success');
      router.push(`/purchases/${createdPurchase.id}`);
    } catch (err: any) {
      setIsSubmitting(false);
      setGeneralError(err.message || 'Failed to save purchase draft.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => router.push('/purchases')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Purchases
        </Button>
        <div>
          <h1 className="text-xl font-bold font-serif text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-forest-700" />
            Create Purchase Draft
          </h1>
          <p className="text-xs text-slate-500">
            Fill in purchase details. Backend calculates final authoritative totals.
          </p>
        </div>
      </div>

      {generalError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-700">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="space-y-1">
            <span className="font-semibold block">Failed to create purchase</span>
            <span>{generalError}</span>
          </div>
        </div>
      )}

      {/* Supplier & Header Details Card */}
      <Card className="p-5 bg-white shadow-2xs space-y-5">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
          <Truck className="w-4 h-4 text-forest-700" />
          Supplier & Invoice Details
        </h3>

        {/* Supplier Mode Toggle */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            Supplier Type <span className="text-rose-600">*</span>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSupplierMode('REGISTERED');
                setAdhocSupplierName('');
                setFormErrors((prev) => ({ ...prev, supplier: '' }));
              }}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                supplierMode === 'REGISTERED'
                  ? 'bg-forest-800 text-white border-forest-800 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Truck className="w-4 h-4" />
              Registered Supplier
            </button>
            <button
              type="button"
              onClick={() => {
                setSupplierMode('ADHOC');
                setSelectedSupplierId('');
                setFormErrors((prev) => ({ ...prev, supplier: '' }));
              }}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                supplierMode === 'ADHOC'
                  ? 'bg-forest-800 text-white border-forest-800 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <User className="w-4 h-4" />
              Ad-hoc / One-Time Supplier
            </button>
          </div>
        </div>

        {/* Supplier Input Based on Mode */}
        <div>
          {supplierMode === 'REGISTERED' ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Select Registered Supplier <span className="text-rose-600">*</span>
              </label>
              <Select
                options={supplierOptions}
                value={selectedSupplierId}
                disabled={isLoadingRefData}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  setFormErrors((prev) => ({ ...prev, supplier: '' }));
                }}
                error={formErrors.supplier}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Ad-hoc Supplier Name <span className="text-rose-600">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Local Dairy Mart, City Hardware..."
                value={adhocSupplierName}
                maxLength={100}
                onChange={(e) => {
                  setAdhocSupplierName(e.target.value);
                  setFormErrors((prev) => ({ ...prev, supplier: '' }));
                }}
                error={formErrors.supplier}
              />
            </div>
          )}
        </div>

        {/* Date, Invoice #, Payment Method Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Purchase Date <span className="text-rose-600">*</span>
            </label>
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => {
                setPurchaseDate(e.target.value);
                setFormErrors((prev) => ({ ...prev, purchaseDate: '' }));
              }}
              error={formErrors.purchaseDate}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Invoice / Bill Number <span className="text-slate-400">(Optional)</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. INV-2026-089"
              value={invoiceNumber}
              maxLength={100}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Payment Method <span className="text-rose-600">*</span>
            </label>
            <Select
              options={paymentMethodOptions}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PurchasePaymentMethod)}
            />
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Notes / Remarks <span className="text-slate-400">(Optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add internal notes about this purchase..."
            rows={2}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-800"
          />
        </div>

        {/* Attachment Upload Picker */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-forest-700" />
              Invoice Attachment Proof <span className="text-slate-400 font-normal">(Optional)</span>
            </span>
            <span className="text-[11px] text-slate-500">JPG, PNG, PDF (Max 5 MB)</span>
          </div>

          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 5 * 1024 * 1024) {
                  setFormErrors((prev) => ({
                    ...prev,
                    attachment: 'File exceeds 5 MB limit.'
                  }));
                  setSelectedFile(null);
                } else {
                  setSelectedFile(file);
                  setFormErrors((prev) => ({ ...prev, attachment: '' }));
                }
              }
            }}
            className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-forest-800 file:text-white hover:file:bg-forest-900 cursor-pointer"
          />

          {selectedFile && (
            <div className="text-xs text-emerald-800 flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}

          {formErrors.attachment && (
            <p className="text-xs text-rose-600">{formErrors.attachment}</p>
          )}
        </div>
      </Card>

      {/* Purchase Lines Card */}
      <Card className="p-5 bg-white shadow-2xs">
        <PurchaseLineEditor
          lines={lines}
          inventoryItems={inventoryItems}
          onChange={setLines}
          errors={formErrors}
        />
      </Card>

      {/* Totals & Estimated Summary Card */}
      <Card className="p-5 bg-white shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
            Totals & Discounts
          </h3>
          <Badge variant="warning" className="text-[11px]">
            Estimated Preview
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Overall Purchase Discount (₹)
            </label>
            <Input
              type="number"
              min="0"
              step="any"
              value={headerDiscount}
              onChange={(e) => setHeaderDiscount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Overall Tax Amount (₹) <span className="text-slate-400">(Overrides line taxes if set)</span>
            </label>
            <Input
              type="number"
              min="0"
              step="any"
              value={headerTaxAmount}
              onChange={(e) => setHeaderTaxAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Estimated Preview Table */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>Estimated Lines Subtotal:</span>
            <span className="font-medium text-slate-800">{formatINR(estimatedTotals.subtotal)}</span>
          </div>

          {estimatedTotals.overallDiscount > 0 && (
            <div className="flex items-center justify-between text-amber-700">
              <span>Overall Discount:</span>
              <span className="font-medium">- {formatINR(estimatedTotals.overallDiscount)}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-slate-600">
            <span>Estimated Tax:</span>
            <span className="font-medium text-slate-800">{formatINR(estimatedTotals.totalTax)}</span>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-slate-900">
            <span>Estimated Grand Total:</span>
            <span className="text-base text-forest-800">{formatINR(estimatedTotals.grandTotal)}</span>
          </div>

          <div className="pt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5 text-forest-700 shrink-0" />
            <span>
              Server calculates final authoritative totals with exact precision upon saving.
            </span>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/purchases')}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSaveDraft}
          isLoading={isSubmitting}
          icon={<Save className="w-4 h-4" />}
        >
          Save Draft
        </Button>
      </div>
    </div>
  );
}
