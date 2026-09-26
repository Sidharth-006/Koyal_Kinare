'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  PurchaseDTO,
  PurchaseStatus,
  PurchasePaymentMethod,
  SupplierDTO,
  InventoryItemDTO
} from '@/lib/types';
import { formatINR, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { PurchaseStatusBadge } from '@/components/purchases/PurchaseStatusBadge';
import {
  Plus,
  Search,
  ShoppingCart,
  Calendar,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertTriangle
} from 'lucide-react';

export default function PurchasesListPage() {
  const router = useRouter();

  // Data States
  const [purchases, setPurchases] = useState<PurchaseDTO[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Pagination States
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Load Filter Options (Suppliers & Inventory Items)
  useEffect(() => {
    let isMounted = true;
    async function loadFilterData() {
      try {
        const [suppliersRes, itemsRes] = await Promise.all([
          api.listSuppliers({ status: 'all', pageSize: 100 }),
          api.listInventoryItems({ status: 'all', pageSize: 100 })
        ]);
        if (isMounted) {
          setSuppliers(suppliersRes.items || []);
          setInventoryItems(itemsRes.items || []);
        }
      } catch (err) {
        // Non-blocking for list screen
      }
    }
    loadFilterData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Purchases with Server Filtering & Pagination
  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.listPurchases({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        supplierId: selectedSupplierId || undefined,
        inventoryItemId: selectedInventoryItemId || undefined,
        paymentMethod: selectedPaymentMethod !== 'ALL' ? (selectedPaymentMethod as PurchasePaymentMethod) : undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as PurchaseStatus) : undefined,
        page,
        pageSize
      });

      setPurchases(res.items || []);
      setTotal(res.pagination?.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchases.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedSupplierId, selectedInventoryItemId, selectedPaymentMethod, selectedStatus, page, pageSize]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedSupplierId('');
    setSelectedInventoryItemId('');
    setSelectedPaymentMethod('ALL');
    setSelectedStatus('ALL');
    setPage(1);
  };

  const supplierOptions = [
    { label: 'All Suppliers', value: '' },
    ...suppliers.map((s) => ({ label: s.name, value: s.id }))
  ];

  const itemOptions = [
    { label: 'All Inventory Items', value: '' },
    ...inventoryItems.map((i) => ({ label: i.name, value: i.id }))
  ];

  const paymentMethodOptions = [
    { label: 'All Payment Methods', value: 'ALL' },
    { label: 'Cash', value: 'CASH' },
    { label: 'UPI', value: 'UPI' },
    { label: 'Card', value: 'CARD' },
    { label: 'Credit', value: 'CREDIT' }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-800 flex items-center gap-2.5">
            <ShoppingCart className="w-6 h-6 text-forest-700" />
            Purchase Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create supplier purchase drafts, track stock-in receipts, and manage invoice proof.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => router.push('/purchases/new')}
          icon={<Plus className="w-4 h-4" />}
        >
          New Purchase
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white shadow-2xs space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-forest-700" />
            Search & Filter
          </span>
          {(startDate || endDate || selectedSupplierId || selectedInventoryItemId || selectedPaymentMethod !== 'ALL' || selectedStatus !== 'ALL') && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-forest-700 hover:text-forest-900 font-medium normal-case flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Reset Filters
            </button>
          )}
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-slate-100 pb-3">
          {(['ALL', 'DRAFT', 'RECEIVED', 'REVERSED'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setSelectedStatus(status);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedStatus === status
                  ? 'bg-forest-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' ? 'All Purchases' : status === 'DRAFT' ? 'Drafts' : status === 'RECEIVED' ? 'Received' : 'Reversed'}
            </button>
          ))}
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Supplier</label>
            <Select
              options={supplierOptions}
              value={selectedSupplierId}
              onChange={(e) => {
                setSelectedSupplierId(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Payment Method</label>
            <Select
              options={paymentMethodOptions}
              value={selectedPaymentMethod}
              onChange={(e) => {
                setSelectedPaymentMethod(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      {/* Purchases Data Presentation */}
      {error ? (
        <Card className="p-8 text-center bg-rose-50/50 border border-rose-200">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-rose-800">Failed to load purchases</h3>
          <p className="text-xs text-rose-600 mt-1 max-w-md mx-auto">{error}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={fetchPurchases}
            className="mt-4"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Retry
          </Button>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      ) : purchases.length === 0 ? (
        <Card className="p-12 text-center bg-white">
          <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No purchases found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {startDate || endDate || selectedSupplierId || selectedPaymentMethod !== 'ALL' || selectedStatus !== 'ALL'
              ? 'No purchases match the selected filter criteria. Try adjusting or clearing your filters.'
              : 'Get started by creating your first supplier purchase draft.'}
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => router.push('/purchases/new')}
            className="mt-4"
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            New Purchase
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Purchase #</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4 text-right">Grand Total</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((purchase) => {
                  const pNum = purchase.purchase_number || purchase.purchaseNumber;
                  const pDate = purchase.purchase_date || purchase.purchaseDate;
                  const sName = purchase.supplier_name || purchase.supplierName || 'Ad-hoc Supplier';
                  const pMethod = purchase.payment_method || purchase.paymentMethod;
                  const gTotal = purchase.grand_total ?? purchase.grandTotal ?? 0;

                  return (
                    <tr
                      key={purchase.id}
                      onClick={() => router.push(`/purchases/${purchase.id}`)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                        {pNum}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {formatDate(pDate)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {sName}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="neutral" className="uppercase font-mono text-[10px]">
                          {pMethod}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                        {formatINR(gTotal)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <PurchaseStatusBadge status={purchase.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/purchases/${purchase.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-900 group-hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View */}
          <div className="md:hidden space-y-3">
            {purchases.map((purchase) => {
              const pNum = purchase.purchase_number || purchase.purchaseNumber;
              const pDate = purchase.purchase_date || purchase.purchaseDate;
              const sName = purchase.supplier_name || purchase.supplierName || 'Ad-hoc Supplier';
              const pMethod = purchase.payment_method || purchase.paymentMethod;
              const gTotal = purchase.grand_total ?? purchase.grandTotal ?? 0;

              return (
                <div
                  key={purchase.id}
                  onClick={() => router.push(`/purchases/${purchase.id}`)}
                  className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3 cursor-pointer active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-sm text-slate-800">
                      {pNum}
                    </span>
                    <PurchaseStatusBadge status={purchase.status} />
                  </div>

                  <div className="text-xs text-slate-600 flex items-center justify-between">
                    <span className="font-medium text-slate-800 text-sm truncate max-w-[200px]">
                      {sName}
                    </span>
                    <span>{formatDate(pDate)}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <Badge variant="neutral" className="uppercase font-mono text-[10px]">
                      {pMethod}
                    </Badge>
                    <span className="text-sm font-bold text-slate-900">
                      {formatINR(gTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl text-xs text-slate-600">
              <span>
                Showing Page <strong className="text-slate-800">{page}</strong> of{' '}
                <strong className="text-slate-800">{totalPages}</strong> ({total} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  icon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  icon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
