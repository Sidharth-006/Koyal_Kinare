'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { StockMovementDTO, StockMovementType, InventoryItemDTO } from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { MovementTypeBadge } from '@/components/stock/MovementTypeBadge';
import {
  History,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  UserCheck,
  Calendar,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

const MOVEMENT_TYPE_OPTIONS = [
  { label: 'All Movement Types', value: '' },
  { label: 'Opening Stock', value: 'OPENING' },
  { label: 'Purchase Receipt', value: 'PURCHASE_RECEIPT' },
  { label: 'Purchase Reversal', value: 'PURCHASE_REVERSAL' },
  { label: 'Manual Increase', value: 'MANUAL_INCREASE' },
  { label: 'Manual Decrease', value: 'MANUAL_DECREASE' },
  { label: 'Wastage', value: 'WASTAGE' },
  { label: 'Manual Consumption', value: 'MANUAL_CONSUMPTION' },
  { label: 'Count Correction', value: 'COUNT_CORRECTION' }
];

function StockLedgerContent() {
  const searchParams = useSearchParams();
  const initialItemId = searchParams.get('itemId') || '';

  // Filter States
  const [selectedItemId, setSelectedItemId] = useState(initialItemId);
  const [selectedType, setSelectedType] = useState<StockMovementType | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);

  // Data States
  const [movements, setMovements] = useState<StockMovementDTO[]>([]);
  const [itemsList, setItemsList] = useState<InventoryItemDTO[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, InventoryItemDTO>>({});
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load Inventory Items for Filter Dropdown & ID resolving
  useEffect(() => {
    let isMounted = true;
    api
      .listInventoryItems({ status: 'all', pageSize: 100 })
      .then((res) => {
        if (!isMounted) return;
        setItemsList(res.items || []);
        const map: Record<string, InventoryItemDTO> = {};
        for (const item of res.items || []) {
          map[item.id] = item;
        }
        setItemsMap(map);
      })
      .catch((err) => {
        console.error('Failed to load inventory item options:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Stock Movements from Server
  const fetchMovements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listStockMovements({
        itemId: selectedItemId || undefined,
        type: (selectedType as StockMovementType) || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
        pageSize
      });

      setMovements(res.items || []);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to fetch stock movements.');
      } else {
        setError('An unexpected error occurred while loading the stock ledger.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedItemId, selectedType, fromDate, toDate, page, pageSize]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const handleResetFilters = () => {
    setSelectedItemId('');
    setSelectedType('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(selectedItemId || selectedType || fromDate || toDate);

  const itemOptions = [
    { label: 'All Inventory Items', value: '' },
    ...itemsList.map((item) => ({
      label: `${item.name} (${item.baseUnit || item.base_unit || '-'})`,
      value: item.id
    }))
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <Link
            href="/inventory/items"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-forest-800 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Inventory Items
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-100 border border-forest-800/20 flex items-center justify-center text-forest-800">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-forest-800">Stock Ledger</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete, immutable audit trail of all inventory receipts, adjustments, and counts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchMovements}
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filter Card */}
      <Card className="p-4 sm:p-5 border-border bg-slate-50/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Item Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Inventory Item
            </label>
            <Select
              options={itemOptions}
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Movement Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Movement Type
            </label>
            <Select
              options={MOVEMENT_TYPE_OPTIONS}
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value as StockMovementType | '');
                setPage(1);
              }}
            />
          </div>

          {/* From Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              From Date
            </label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              To Date
            </label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Filter Summary & Clear Action */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60 text-xs text-slate-600">
            <span>
              Active filters applied. Showing matching movements from server.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-forest-800 hover:text-forest-900 h-7 px-2"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear Filters
            </Button>
          </div>
        )}
      </Card>

      {/* Movements Table Card */}
      <Card className="overflow-hidden border-border p-0">
        <div className="p-4 sm:p-5 border-b border-border bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-forest-800" />
            <h2 className="text-base font-bold text-slate-800">Ledger Entries</h2>
            <Badge variant="neutral" className="text-xs font-mono ml-2">
              {total} Total Records
            </Badge>
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center bg-rose-50/40">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-xs text-rose-600 mb-3">{error}</p>
            <Button size="sm" variant="secondary" onClick={fetchMovements}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry Query
            </Button>
          </div>
        ) : loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : movements.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              {hasActiveFilters ? 'No stock movements match your filter criteria.' : 'No stock movements recorded yet.'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {hasActiveFilters
                ? 'Try adjusting your item, date range, or movement type filters.'
                : 'Inventory adjustments, receipts, and counts will be recorded here.'}
            </p>
            {hasActiveFilters && (
              <Button size="sm" variant="secondary" onClick={handleResetFilters}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Date / Time</th>
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Movement Type</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4">Source / Reference</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4 text-right">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {movements.map((m) => {
                    const item = itemsMap[m.inventory_item_id || m.inventoryItemId || ''];
                    const itemName = item?.name || m.inventory_item_id || m.inventoryItemId;
                    const itemUnit = item?.baseUnit || item?.base_unit || '';
                    const deltaNum = parseFloat(m.quantity_delta || m.quantityDelta || '0');
                    const isPositive = deltaNum > 0;
                    const reasonText = m.reason || '—';
                    const sourceText = m.source_type || m.sourceType || '—';
                    const adminText = m.created_by || m.createdBy || '—';

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Date / Time */}
                        <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                          <div>{formatDate(m.business_date || m.businessDate)}</div>
                          <div className="text-[11px] text-slate-400">
                            {formatDateTime((m.created_at || m.createdAt)?.toString())}
                          </div>
                        </td>

                        {/* Item Name */}
                        <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {item ? (
                            <Link
                              href={`/inventory/${item.id}`}
                              className="text-forest-800 hover:underline flex items-center gap-1.5"
                            >
                              <span>{itemName}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-slate-600">{itemName}</span>
                          )}
                        </td>

                        {/* Movement Type */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <MovementTypeBadge type={m.movement_type || m.movementType} />
                        </td>

                        {/* Quantity (Signed +/-) */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              isPositive
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }
                          >
                            {isPositive ? `+${deltaNum.toFixed(3)}` : deltaNum.toFixed(3)}{' '}
                            <span className="text-xs text-slate-500 font-normal">
                              {itemUnit}
                            </span>
                          </span>
                        </td>

                        {/* Source / Reference (Read-only text) */}
                        <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-mono font-medium text-slate-700">
                            {sourceText}
                          </span>
                        </td>

                        {/* Reason */}
                        <td className="py-3.5 px-4 text-slate-600 text-xs max-w-xs truncate">
                          {reasonText}
                        </td>

                        {/* Recorded By */}
                        <td className="py-3.5 px-4 text-right text-xs text-slate-500 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-slate-400" />
                            <span>{adminText}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards View */}
            <div className="md:hidden divide-y divide-border">
              {movements.map((m) => {
                const item = itemsMap[m.inventory_item_id || m.inventoryItemId || ''];
                const itemName = item?.name || m.inventory_item_id || m.inventoryItemId;
                const itemUnit = item?.baseUnit || item?.base_unit || '';
                const deltaNum = parseFloat(m.quantity_delta || m.quantityDelta || '0');
                const isPositive = deltaNum > 0;
                const reasonText = m.reason || '—';
                const sourceText = m.source_type || m.sourceType || '—';
                const adminText = m.created_by || m.createdBy || '—';

                return (
                  <div key={m.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {item ? (
                          <Link
                            href={`/inventory/${item.id}`}
                            className="font-bold text-slate-800 hover:text-forest-800 text-sm flex items-center gap-1"
                          >
                            <span>{itemName}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </Link>
                        ) : (
                          <span className="font-bold text-slate-800 text-sm">{itemName}</span>
                        )}
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {formatDate(m.business_date || m.businessDate)} • {formatDateTime((m.created_at || m.createdAt)?.toString())}
                        </span>
                      </div>
                      <MovementTypeBadge type={m.movement_type || m.movementType} />
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-border/60 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-semibold uppercase">Quantity</span>
                        <span className={`font-mono font-bold text-sm ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isPositive ? `+${deltaNum.toFixed(3)}` : deltaNum.toFixed(3)} {itemUnit}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] font-semibold uppercase">Source</span>
                        <span className="font-mono text-xs font-medium text-slate-700">
                          {sourceText}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 flex justify-between gap-2">
                      <div className="truncate max-w-[65%]">
                        <span className="text-slate-400 font-medium">Reason: </span>
                        <span>{reasonText}</span>
                      </div>
                      <div className="text-right text-[11px] text-slate-400 shrink-0">
                        <span>By: {adminText}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Server-Side Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-slate-500">
            <div>
              Page <span className="font-semibold text-slate-800">{page}</span> of{' '}
              <span className="font-semibold text-slate-800">{totalPages}</span> ({total} entries)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="h-8 px-2.5"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="h-8 px-2.5"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function StockLedgerPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      }
    >
      <StockLedgerContent />
    </Suspense>
  );
}
