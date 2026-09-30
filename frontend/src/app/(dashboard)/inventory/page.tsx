'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { InventoryOverviewDTO } from '@/lib/types';
import { formatINR, formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Package, AlertTriangle, ShoppingCart, History, Truck,
  ArrowUpRight, RefreshCw, Layers, CheckCircle2, ChevronRight
} from 'lucide-react';

export default function InventoryOverviewPage() {
  const { showToast } = useToast();
  const [overview, setOverview] = useState<InventoryOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInventoryOverview();
      setOverview(data);
    } catch (err: any) {
      const msg = err.message || 'Failed to load inventory overview.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const activeCount = overview?.totalActiveItems ?? overview?.activeItemsCount ?? overview?.total_active_items ?? 0;
  const lowStockCount = overview?.activeLowStockCount ?? overview?.lowStockCount ?? overview?.active_low_stock_count ?? 0;
  const recentPurchases = overview?.recentPurchases ?? [];
  const recentMovements = overview?.recentMovements ?? [];

  const formatDelta = (deltaStr?: string, unit?: string) => {
    if (!deltaStr) return '0';
    const num = parseFloat(deltaStr);
    const formatted = `${num > 0 ? `+${num}` : num} ${unit || ''}`.trim();
    return formatted;
  };

  const formatMovementTypeLabel = (typeStr?: string) => {
    switch (typeStr) {
      case 'OPENING': return 'Opening Stock';
      case 'PURCHASE_RECEIPT': return 'Purchase Receipt';
      case 'PURCHASE_REVERSAL': return 'Purchase Reversal';
      case 'MANUAL_INCREASE': return 'Manual Increase';
      case 'MANUAL_DECREASE': return 'Manual Decrease';
      case 'WASTAGE': return 'Wastage / Spoilage';
      case 'MANUAL_CONSUMPTION': return 'Consumption';
      case 'COUNT_CORRECTION': return 'Count Correction';
      default: return typeStr || 'Movement';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight flex items-center gap-2.5">
            <Package className="w-7 h-7 text-amber-500 shrink-0" />
            <span>Inventory Overview</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Monitor stock thresholds, recent supplier receipts, and inventory ledger activity
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            icon={<RefreshCw className="w-4 h-4 text-forest-800" />}
            onClick={loadOverview}
            disabled={loading}
          >
            Refresh
          </Button>
          <Link href="/inventory/items">
            <Button variant="primary" icon={<Layers className="w-4 h-4" />}>
              Manage Items
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Retry Card */}
      {error && (
        <Card className="bg-rose-50/80 border-rose-200 text-rose-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={loadOverview}>
            Retry
          </Button>
        </Card>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Items */}
        {loading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : (
          <Link href="/inventory/items">
            <Card hoverable className="border-border bg-white h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Active Inventory Items</span>
                <div className="p-2 bg-cream-100 rounded-xl text-forest-800">
                  <Package className="w-4.5 h-4.5" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-forest-800 tracking-tight">{activeCount}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium pt-2 border-t border-border-subtle">
                <span>Master item catalog</span>
                <span className="text-forest-800 font-bold flex items-center gap-0.5">
                  View <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Card>
          </Link>
        )}

        {/* Low-Stock Alerts */}
        {loading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : (
          <Link href="/inventory/low-stock">
            <Card
              hoverable
              className={`h-full flex flex-col justify-between transition-all ${
                lowStockCount > 0
                  ? 'border-amber-300 bg-gradient-to-br from-amber-50/50 via-white to-amber-100/30 ring-1 ring-amber-400/30'
                  : 'border-border bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Low-Stock Alerts</span>
                <div className={`p-2 rounded-xl ${lowStockCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  <AlertTriangle className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className={`text-3xl font-extrabold tracking-tight ${lowStockCount > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                  {lowStockCount}
                </p>
                {lowStockCount > 0 ? (
                  <Badge variant="warning">Requires Action</Badge>
                ) : (
                  <Badge variant="success">All Healthy</Badge>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium pt-2 border-t border-border-subtle">
                <span>Below minimum threshold</span>
                <span className="text-amber-800 font-bold flex items-center gap-0.5">
                  Review <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Card>
          </Link>
        )}

        {/* Recent Purchases */}
        {loading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : (
          <Link href="/purchases">
            <Card hoverable className="border-border bg-white h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Recent Purchases</span>
                <div className="p-2 bg-sky-50 rounded-xl text-sky-700">
                  <ShoppingCart className="w-4.5 h-4.5" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-800 tracking-tight">{recentPurchases.length}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium pt-2 border-t border-border-subtle">
                <span>Latest purchase orders</span>
                <span className="text-sky-800 font-bold flex items-center gap-0.5">
                  Purchases <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Card>
          </Link>
        )}

        {/* Recent Movements */}
        {loading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : (
          <Link href="/inventory/movements">
            <Card hoverable className="border-border bg-white h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Recent Movements</span>
                <div className="p-2 bg-purple-50 rounded-xl text-purple-700">
                  <History className="w-4.5 h-4.5" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-800 tracking-tight">{recentMovements.length}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium pt-2 border-t border-border-subtle">
                <span>Stock audit ledger</span>
                <span className="text-purple-800 font-bold flex items-center gap-0.5">
                  Stock Ledger <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Card>
          </Link>
        )}
      </div>

      {/* Quick Navigation Action Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/inventory/items" className="w-full">
          <Button variant="secondary" size="md" className="w-full justify-between" icon={<Package className="w-4 h-4 text-forest-800" />}>
            <span>Item Master</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400" />
          </Button>
        </Link>
        <Link href="/inventory/low-stock" className="w-full">
          <Button variant="secondary" size="md" className="w-full justify-between" icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}>
            <span>Alerts</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400" />
          </Button>
        </Link>
        <Link href="/inventory/movements" className="w-full">
          <Button variant="secondary" size="md" className="w-full justify-between" icon={<History className="w-4 h-4 text-forest-800" />}>
            <span>Stock Ledger</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400" />
          </Button>
        </Link>
        <Link href="/suppliers" className="w-full">
          <Button variant="secondary" size="md" className="w-full justify-between" icon={<Truck className="w-4 h-4 text-forest-800" />}>
            <span>Suppliers</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400" />
          </Button>
        </Link>
      </div>

      {/* Dual Activity Section: Recent Purchases & Recent Stock Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Purchases Section */}
        <Card className="p-0 overflow-hidden border-border flex flex-col justify-between">
          <div className="p-4 bg-cream-50/70 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShoppingCart className="w-5 h-5 text-forest-800" />
              <h2 className="font-bold text-slate-800 text-sm">Recent Purchases</h2>
            </div>
            <Link href="/purchases">
              <Button variant="ghost" size="sm" className="text-xs font-bold text-forest-800">
                View All
              </Button>
            </Link>
          </div>

          <div className="divide-y divide-border-subtle overflow-x-auto">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="p-4 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : recentPurchases.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                No purchases recorded yet.
              </div>
            ) : (
              recentPurchases.map((p) => {
                const pNum = p.purchase_number || p.purchaseNumber || 'Draft';
                const sName = p.supplier_name || p.supplierName || 'Ad-hoc Supplier';
                const pDate = p.purchase_date || p.purchaseDate || p.created_at || '';
                const gTotal = p.grand_total ?? p.grandTotal ?? 0;
                const status = p.status;

                return (
                  <div key={p.id} className="p-4 hover:bg-cream-50/40 transition-colors flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{pNum}</span>
                        <Badge variant={status === 'RECEIVED' ? 'success' : status === 'REVERSED' ? 'danger' : 'neutral'}>
                          {status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        {sName} • {formatDate(pDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-slate-900 text-sm">{formatINR(gTotal)}</p>
                      <span className="text-[11px] text-slate-400 font-medium uppercase">
                        {p.payment_method || p.paymentMethod || 'CASH'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Recent Movements Section */}
        <Card className="p-0 overflow-hidden border-border flex flex-col justify-between">
          <div className="p-4 bg-cream-50/70 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <History className="w-5 h-5 text-forest-800" />
              <h2 className="font-bold text-slate-800 text-sm">Recent Stock Movements</h2>
            </div>
            <Link href="/inventory/movements">
              <Button variant="ghost" size="sm" className="text-xs font-bold text-forest-800">
                View Ledger
              </Button>
            </Link>
          </div>

          <div className="divide-y divide-border-subtle overflow-x-auto">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="p-4 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : recentMovements.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                No stock movements recorded yet.
              </div>
            ) : (
              recentMovements.map((m) => {
                const deltaNum = parseFloat(m.quantity_delta || m.quantityDelta || '0');
                const isPositive = deltaNum > 0;
                const mTypeLabel = formatMovementTypeLabel(m.movement_type || m.movementType);
                const mDate = m.business_date || m.businessDate || m.created_at || '';

                return (
                  <div key={m.id} className="p-4 hover:bg-cream-50/40 transition-colors flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-xs">
                          {mTypeLabel}
                        </span>
                        {m.reason && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                            ({m.reason})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        {formatDate(mDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-extrabold text-sm px-2 py-0.5 rounded-lg ${
                          isPositive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {formatDelta(m.quantity_delta || m.quantityDelta)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
