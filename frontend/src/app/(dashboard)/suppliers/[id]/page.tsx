'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { SupplierDTO, SupplierPurchaseSummaryDTO } from '@/lib/types';
import { formatINR, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import { SupplierFormModal } from '@/components/suppliers/SupplierFormModal';
import {
  ArchiveSupplierModal,
  RestoreSupplierModal
} from '@/components/suppliers/SupplierConfirmationModals';
import {
  ArrowLeft, Truck, Edit, Archive, RotateCcw,
  Phone, Mail, MapPin, Hash, FileText, CheckCircle2,
  AlertCircle, Calendar, ShoppingCart, IndianRupee, PackageCheck,
  RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<SupplierDTO | null>(null);
  const [purchaseSummary, setPurchaseSummary] = useState<SupplierPurchaseSummaryDTO | null>(null);

  const [loadingSupplier, setLoadingSupplier] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Date filters & pagination for purchase summary
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryPageSize] = useState(10);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);

  const loadSupplier = useCallback(async () => {
    if (!supplierId) return;
    setLoadingSupplier(true);
    setSupplierError(null);
    try {
      const res = await api.getSupplierById(supplierId);
      setSupplier(res.supplier);
    } catch (err: any) {
      setSupplierError(err?.message || 'Failed to load supplier details.');
    } finally {
      setLoadingSupplier(false);
    }
  }, [supplierId]);

  const loadPurchaseSummary = useCallback(async () => {
    if (!supplierId) return;
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const res = await api.getSupplierPurchaseSummary(supplierId, {
        from: fromDate || undefined,
        to: toDate || undefined,
        page: summaryPage,
        pageSize: summaryPageSize
      });
      setPurchaseSummary(res);
    } catch (err: any) {
      setSummaryError(err?.message || 'Failed to load purchase history.');
    } finally {
      setLoadingSummary(false);
    }
  }, [supplierId, fromDate, toDate, summaryPage, summaryPageSize]);

  useEffect(() => {
    loadSupplier();
  }, [loadSupplier]);

  useEffect(() => {
    loadPurchaseSummary();
  }, [loadPurchaseSummary]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setSummaryPage(1);
    loadPurchaseSummary();
  };

  const handleResetFilter = () => {
    setFromDate('');
    setToDate('');
    setSummaryPage(1);
  };

  const isArchived = Boolean(supplier?.isArchived || supplier?.is_archived);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Back Link & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/suppliers"
            className="p-2 text-slate-500 hover:text-forest-800 hover:bg-cream-100 rounded-xl transition-colors border border-border bg-white"
            title="Back to Suppliers"
            aria-label="Back to Suppliers"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-forest-900">
                {loadingSupplier ? <Skeleton className="h-8 w-48 inline-block" /> : supplier?.name}
              </h1>
              {!loadingSupplier && supplier && (
                isArchived ? (
                  <Badge variant="neutral" className="gap-1">
                    <Archive className="w-3 h-3 text-slate-500" />
                    Archived
                  </Badge>
                ) : (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Active
                  </Badge>
                )
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Supplier ID: <span className="font-mono">{supplierId}</span>
            </p>
          </div>
        </div>

        {!loadingSupplier && supplier && (
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              icon={<Edit className="w-4 h-4" />}
            >
              Edit Details
            </Button>
            {isArchived ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setRestoreModalOpen(true)}
                icon={<RotateCcw className="w-4 h-4" />}
              >
                Restore
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setArchiveModalOpen(true)}
                icon={<Archive className="w-4 h-4" />}
              >
                Archive
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Supplier Profile Card */}
      {loadingSupplier && (
        <Card className="p-6 border-border bg-white shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </Card>
      )}

      {supplierError && (
        <Card className="p-6 border-danger/30 bg-rose-50/50 flex flex-col items-center text-center gap-3">
          <AlertCircle className="w-8 h-8 text-danger" />
          <p className="text-sm font-semibold text-danger">{supplierError}</p>
          <Button variant="outline" size="sm" onClick={() => loadSupplier()}>
            Try Again
          </Button>
        </Card>
      )}

      {!loadingSupplier && supplier && (
        <Card className="p-6 border-border bg-white shadow-2xs">
          <h2 className="text-sm font-bold uppercase tracking-wider text-forest-800 mb-4 pb-2 border-b border-border">
            Contact & Identification Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Contact Person */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-cream-100 text-forest-800 rounded-xl shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Contact Person
                </span>
                <span className="text-sm font-medium text-slate-800">
                  {supplier.contactPerson || supplier.contact_person || (
                    <span className="text-slate-400 italic font-normal">Not provided</span>
                  )}
                </span>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-cream-100 text-forest-800 rounded-xl shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Phone Number
                </span>
                <span className="text-sm font-medium text-slate-800">
                  {supplier.phone ? (
                    <a href={`tel:${supplier.phone}`} className="hover:underline text-forest-800">
                      {supplier.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400 italic font-normal">Not provided</span>
                  )}
                </span>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-cream-100 text-forest-800 rounded-xl shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Email Address
                </span>
                <span className="text-sm font-medium text-slate-800">
                  {supplier.email ? (
                    <a href={`mailto:${supplier.email}`} className="hover:underline text-forest-800">
                      {supplier.email}
                    </a>
                  ) : (
                    <span className="text-slate-400 italic font-normal">Not provided</span>
                  )}
                </span>
              </div>
            </div>

            {/* GSTIN */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-cream-100 text-forest-800 rounded-xl shrink-0">
                <Hash className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  GSTIN
                </span>
                <span className="text-sm font-mono font-medium text-slate-800">
                  {supplier.gstin ? (
                    <span className="bg-cream-100 px-2 py-0.5 rounded border border-border">
                      {supplier.gstin}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic font-sans font-normal">Not provided</span>
                  )}
                </span>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3 sm:col-span-2">
              <div className="p-2 bg-cream-100 text-forest-800 rounded-xl shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Address
                </span>
                <span className="text-sm font-medium text-slate-800">
                  {supplier.address || (
                    <span className="text-slate-400 italic font-normal">Not provided</span>
                  )}
                </span>
              </div>
            </div>

            {/* Notes */}
            {supplier.notes && (
              <div className="flex items-start gap-3 sm:col-span-3 pt-2 border-t border-border/60">
                <div className="p-2 bg-cream-100 text-forest-800 rounded-xl shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                    Notes
                  </span>
                  <p className="text-sm text-slate-700 whitespace-pre-line mt-0.5">
                    {supplier.notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* READ-ONLY Purchase History Section */}
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-forest-900 tracking-tight flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-forest-800" />
              Purchase History & Summary
            </h2>
            <p className="text-xs text-slate-500">
              Procurement metrics and historical order summary (READ-ONLY)
            </p>
          </div>

          {/* Date Filter Bar */}
          <form onSubmit={handleApplyFilter} className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-border rounded-xl px-2.5 py-1 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="text-xs text-slate-800 focus:outline-none bg-transparent"
                title="From Date"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="text-xs text-slate-800 focus:outline-none bg-transparent"
                title="To Date"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={loadingSummary}>
              Filter
            </Button>
            {(fromDate || toDate) && (
              <Button type="button" variant="outline" size="sm" onClick={handleResetFilter}>
                Clear
              </Button>
            )}
          </form>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-border bg-white shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Total Purchases
            </span>
            <div className="text-2xl font-bold text-forest-900">
              {loadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                purchaseSummary?.totalPurchasesCount ?? 0
              )}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">All registered orders</span>
          </Card>

          <Card className="p-4 border-border bg-white shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Total Value
            </span>
            <div className="text-2xl font-bold text-forest-900">
              {loadingSummary ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                formatINR(purchaseSummary?.totalPurchasesAmount ?? 0)
              )}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Gross procurement value</span>
          </Card>

          <Card className="p-4 border-border bg-white shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Received Orders
            </span>
            <div className="text-2xl font-bold text-emerald-700">
              {loadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                purchaseSummary?.receivedPurchasesCount ?? 0
              )}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Fulfilled deliveries</span>
          </Card>

          <Card className="p-4 border-border bg-white shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Received Amount
            </span>
            <div className="text-2xl font-bold text-emerald-700">
              {loadingSummary ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                formatINR(purchaseSummary?.receivedPurchasesAmount ?? 0)
              )}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Settled receipt value</span>
          </Card>
        </div>

        {/* Purchase History Table / Empty State */}
        <Card className="overflow-hidden border-border bg-white shadow-2xs">
          {loadingSummary && (
            <div className="p-6 flex flex-col gap-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {!loadingSummary && summaryError && (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
              <AlertCircle className="w-8 h-8 text-danger" />
              <p className="text-sm font-semibold text-danger">{summaryError}</p>
              <Button variant="outline" size="sm" onClick={() => loadPurchaseSummary()}>
                Retry
              </Button>
            </div>
          )}

          {/* DLD Mandated Empty State: "No purchases recorded yet." */}
          {!loadingSummary && !summaryError && (!purchaseSummary?.recentPurchases || purchaseSummary.recentPurchases.length === 0) && (
            <div className="py-12 px-4 text-center">
              <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                <div className="p-3 bg-cream-100 rounded-full text-slate-400">
                  <ShoppingCart className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    No purchases recorded yet.
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Purchases and stock receipts are logged during procurement in Module 3. Once purchase entries are recorded, historical rows will appear here automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* When Module 3 purchases exist in the future, rows render here */}
          {!loadingSummary && !summaryError && purchaseSummary?.recentPurchases && purchaseSummary.recentPurchases.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-cream-50/70 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Purchase Ref</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Items</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchaseSummary.recentPurchases.map((purchase: any, idx: number) => (
                    <tr key={purchase.id || idx} className="hover:bg-cream-50/40">
                      <td className="py-3 px-4 font-mono text-xs">{purchase.referenceNumber || purchase.id}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDate(purchase.date || purchase.createdAt)}</td>
                      <td className="py-3 px-4 text-right">{purchase.linesCount || 0}</td>
                      <td className="py-3 px-4 text-right font-medium">{formatINR(purchase.totalAmount || 0)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="success">{purchase.status || 'RECEIVED'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modals */}
      {supplier && (
        <>
          <SupplierFormModal
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            supplier={supplier}
            onSuccess={updated => {
              setSupplier(updated);
              loadSupplier();
            }}
          />

          <ArchiveSupplierModal
            isOpen={archiveModalOpen}
            onClose={() => setArchiveModalOpen(false)}
            supplier={supplier}
            onSuccess={updated => {
              setSupplier(updated);
              loadSupplier();
            }}
          />

          <RestoreSupplierModal
            isOpen={restoreModalOpen}
            onClose={() => setRestoreModalOpen(false)}
            supplier={supplier}
            onSuccess={updated => {
              setSupplier(updated);
              loadSupplier();
            }}
          />
        </>
      )}
    </div>
  );
}
