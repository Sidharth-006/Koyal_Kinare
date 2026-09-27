'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { ItemStockSummaryDTO, StockMovementDTO, InventoryItemDTO } from '@/lib/types';
import { formatDateTime, formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { MovementTypeBadge } from '@/components/stock/MovementTypeBadge';
import { OpeningStockModal } from '@/components/stock/OpeningStockModal';
import { AdjustmentModal } from '@/components/stock/AdjustmentModal';
import { WastageModal } from '@/components/stock/WastageModal';
import { ConsumptionModal } from '@/components/stock/ConsumptionModal';
import { PhysicalCountModal } from '@/components/stock/PhysicalCountModal';
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  History,
  PlusCircle,
  Sliders,
  Trash2,
  Utensils,
  ClipboardCheck,
  RefreshCw,
  Clock,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Archive,
  UserCheck
} from 'lucide-react';

interface PageProps {
  params: { id: string };
}

export default function InventoryItemStockPage({ params }: PageProps) {
  const routeParams = useParams();
  const id = params?.id || (routeParams?.id as string) || '';
  const { showToast } = useToast();

  const [stockSummary, setStockSummary] = useState<ItemStockSummaryDTO | null>(null);
  const [itemMeta, setItemMeta] = useState<InventoryItemDTO | null>(null);
  const [movements, setMovements] = useState<StockMovementDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);
  const [movementsError, setMovementsError] = useState<string | null>(null);

  // Modals state
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);

  // Fetch Item Stock Summary and Metadata
  const loadStockData = useCallback(async () => {
    try {
      setStockError(null);
      const [stockRes, itemRes] = await Promise.all([
        api.getItemStock(id),
        api.getInventoryItemById(id).catch(() => null)
      ]);

      setStockSummary(stockRes);
      if (itemRes && itemRes.item) {
        setItemMeta(itemRes.item);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setStockError(err.message || 'Failed to load stock details.');
      } else {
        setStockError('An unexpected error occurred while loading stock data.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch Latest 10 Companion Stock Movements
  const loadRecentMovements = useCallback(async () => {
    setMovementsLoading(true);
    setMovementsError(null);
    try {
      const res = await api.listStockMovements({
        itemId: id,
        page: 1,
        pageSize: 10
      });
      setMovements(res.items || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setMovementsError(err.message || 'Failed to load recent movements.');
      } else {
        setMovementsError('Failed to load recent movements.');
      }
    } finally {
      setMovementsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadStockData();
    loadRecentMovements();
  }, [loadStockData, loadRecentMovements]);

  // Handler for successful stock mutation
  const handleActionSuccess = (resultingBalance: string, actionName: string) => {
    showToast(
      `${actionName} recorded. Updated balance: ${Number(resultingBalance).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${stockSummary?.baseUnit || ''}`,
      'success'
    );
    // Refetch authoritative stock summary and movements from server
    loadStockData();
    loadRecentMovements();
  };

  const isArchived = Boolean(itemMeta?.isArchived ?? itemMeta?.is_archived);

  const formatItemType = (type?: string) => {
    switch (type) {
      case 'RAW_MATERIAL':
        return 'Raw Material';
      case 'PACKAGING':
        return 'Packaging';
      case 'BEVERAGE':
        return 'Beverage';
      case 'CONSUMABLE':
        return 'Consumable';
      default:
        return type || 'Inventory Item';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-6 rounded" />
            <Skeleton className="w-32 h-4 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (stockError || !stockSummary) {
    return (
      <div className="space-y-6">
        <Link
          href="/inventory/items"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Inventory Items
        </Link>
        <Card className="p-8 text-center bg-rose-50/50 border-rose-200">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-1">Item Stock Not Found</h2>
          <p className="text-sm text-slate-600 mb-4">{stockError || 'Unable to retrieve inventory stock balance.'}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setLoading(true);
              loadStockData();
              loadRecentMovements();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </Card>
      </div>
    );
  }

  const availableNum = parseFloat(stockSummary.availableQuantity) || 0;
  const minimumNum = parseFloat(stockSummary.minimumStock) || 0;

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
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-serif font-bold text-forest-800">{stockSummary.name}</h1>
                {isArchived && <Badge variant="danger">Archived</Badge>}
                {itemMeta && (
                  <Badge variant="neutral" className="text-xs">
                    {formatItemType(itemMeta.itemType || itemMeta.item_type)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Base Unit: <span className="font-semibold text-slate-700">{stockSummary.baseUnit}</span> • Inventory Item Stock Detail
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              loadStockData();
              loadRecentMovements();
            }}
            title="Refresh Stock Data"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Archived Item Explanation Banner */}
      {isArchived && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <Archive className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-900">Archived Inventory Item</h3>
            <p className="text-xs text-amber-800/90 mt-0.5">
              This item has been archived. Manual stock mutation actions are disabled. Existing ledger history and balances remain available for audit and reporting.
            </p>
          </div>
        </div>
      )}

      {/* Low Stock Warning Banner */}
      {stockSummary.isLowStock && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-900">Low Stock Alert</h3>
              <p className="text-xs text-rose-800/90 mt-0.5">
                Current available stock ({availableNum.toLocaleString(undefined, { maximumFractionDigits: 3 })} {stockSummary.baseUnit}) is below the required minimum threshold ({minimumNum.toLocaleString(undefined, { maximumFractionDigits: 3 })} {stockSummary.baseUnit}).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stock Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available Quantity */}
        <Card className="p-5 border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available Stock</span>
            {stockSummary.isLowStock ? (
              <Badge variant="danger" className="text-[10px]">Low Stock</Badge>
            ) : (
              <Badge variant="success" className="text-[10px]">Optimal</Badge>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold tracking-tight ${stockSummary.isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>
              {availableNum.toLocaleString(undefined, { maximumFractionDigits: 3 })}
            </span>
            <span className="text-sm font-semibold text-slate-500">{stockSummary.baseUnit}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Server-authoritative balance
          </p>
        </Card>

        {/* Minimum Stock Threshold */}
        <Card className="p-5 border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Minimum Threshold</span>
            <span className="text-xs text-slate-400">Reorder Alert</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {minimumNum.toLocaleString(undefined, { maximumFractionDigits: 3 })}
            </span>
            <span className="text-sm font-semibold text-slate-500">{stockSummary.baseUnit}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Configured safety stock trigger level
          </p>
        </Card>

        {/* Stock Health */}
        <Card className="p-5 border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Stock Status</span>
          </div>
          <div className="flex items-center gap-2">
            {stockSummary.isLowStock ? (
              <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
                <TrendingDown className="w-5 h-5" /> Below Safety Level
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-base">
                <TrendingUp className="w-5 h-5" /> Stock Sufficient
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {availableNum <= 0 ? 'Item is out of stock' : `${(availableNum - minimumNum).toFixed(1)} ${stockSummary.baseUnit} buffer above min`}
          </p>
        </Card>

        {/* Last Movement */}
        <Card className="p-5 border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last Movement</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-sm font-semibold text-slate-800">
            {stockSummary.lastMovementAt ? formatDateTime(stockSummary.lastMovementAt.toString()) : 'No movements yet'}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {stockSummary.lastMovementAt ? 'Most recent transaction' : 'Initial stock entry pending'}
          </p>
        </Card>
      </div>

      {/* Action Toolbar */}
      <Card className="p-5 sm:p-6 border-border bg-slate-50/50">
        <div className="mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Stock Ledger Actions</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quantities cannot be arbitrarily modified. Balances update only via server-verified audit transactions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Action 1: Opening Stock */}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowOpeningModal(true)}
            disabled={isArchived}
            className="flex items-center justify-center gap-2 text-xs py-2.5"
          >
            <PlusCircle className="w-4 h-4 text-forest-800" />
            <span>Set Opening Stock</span>
          </Button>

          {/* Action 2: Manual Adjustment */}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowAdjustmentModal(true)}
            disabled={isArchived}
            className="flex items-center justify-center gap-2 text-xs py-2.5"
          >
            <Sliders className="w-4 h-4 text-sky-600" />
            <span>Adjust Stock</span>
          </Button>

          {/* Action 3: Log Wastage */}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowWastageModal(true)}
            disabled={isArchived}
            className="flex items-center justify-center gap-2 text-xs py-2.5"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Log Wastage</span>
          </Button>

          {/* Action 4: Manual Consumption */}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowConsumptionModal(true)}
            disabled={isArchived}
            className="flex items-center justify-center gap-2 text-xs py-2.5"
          >
            <Utensils className="w-4 h-4 text-amber-600" />
            <span>Log Consumption</span>
          </Button>

          {/* Action 5: Physical Count */}
          <Button
            type="button"
            variant="primary"
            onClick={() => setShowCountModal(true)}
            disabled={isArchived}
            className="flex items-center justify-center gap-2 text-xs py-2.5"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Physical Count</span>
          </Button>
        </div>
      </Card>

      {/* Recent Movements Table */}
      <Card className="overflow-hidden border-border p-0">
        <div className="p-4 sm:p-5 border-b border-border bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-forest-800" />
            <h2 className="text-base font-bold text-slate-800">Recent Stock Movements</h2>
            <Badge variant="neutral" className="text-xs font-mono ml-2">
              Latest {movements.length}
            </Badge>
          </div>
        </div>

        {movementsError ? (
          <div className="p-8 text-center bg-rose-50/40">
            <p className="text-xs text-rose-600 mb-3">{movementsError}</p>
            <Button size="sm" variant="secondary" onClick={loadRecentMovements}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry Movements
            </Button>
          </div>
        ) : movementsLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : movements.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700 mb-1">No stock movements recorded yet.</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              This inventory item does not have any recorded transactions. You can initialize it with an Opening Stock entry.
            </p>
            {!isArchived && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowOpeningModal(true)}
              >
                <PlusCircle className="w-4 h-4 mr-1.5 text-forest-800" /> Set Initial Opening Stock
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4 text-right">Quantity Delta</th>
                  <th className="py-3 px-4">Source / Reference</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {movements.map((m) => {
                  const deltaNum = parseFloat(m.quantity_delta || m.quantityDelta || '0');
                  const isPositive = deltaNum > 0;
                  const reasonText = m.reason || '—';
                  const sourceText = m.source_type || m.sourceType || '—';
                  const adminText = m.created_by || m.createdBy || 'System';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Date / Time */}
                      <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                        <div>{formatDate(m.business_date || m.businessDate)}</div>
                        <div className="text-[11px] text-slate-400">
                          {formatDateTime((m.created_at || m.createdAt)?.toString())}
                        </div>
                      </td>

                      {/* Movement Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <MovementTypeBadge type={m.movement_type || m.movementType} />
                      </td>

                      {/* Quantity Delta (Signed +/-) */}
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
                            {stockSummary.baseUnit}
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

                      {/* Created By */}
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
        )}
      </Card>

      {/* Modals */}
      <OpeningStockModal
        isOpen={showOpeningModal}
        onClose={() => setShowOpeningModal(false)}
        itemId={id}
        itemName={stockSummary.name}
        baseUnit={stockSummary.baseUnit}
        currentBalance={stockSummary.availableQuantity}
        isArchived={isArchived}
        onSuccess={(balance) => handleActionSuccess(balance, 'Opening stock')}
      />

      <AdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        itemId={id}
        itemName={stockSummary.name}
        baseUnit={stockSummary.baseUnit}
        currentBalance={stockSummary.availableQuantity}
        isArchived={isArchived}
        onSuccess={(balance) => handleActionSuccess(balance, 'Stock adjustment')}
      />

      <WastageModal
        isOpen={showWastageModal}
        onClose={() => setShowWastageModal(false)}
        itemId={id}
        itemName={stockSummary.name}
        baseUnit={stockSummary.baseUnit}
        currentBalance={stockSummary.availableQuantity}
        isArchived={isArchived}
        onSuccess={(balance) => handleActionSuccess(balance, 'Wastage')}
      />

      <ConsumptionModal
        isOpen={showConsumptionModal}
        onClose={() => setShowConsumptionModal(false)}
        itemId={id}
        itemName={stockSummary.name}
        baseUnit={stockSummary.baseUnit}
        currentBalance={stockSummary.availableQuantity}
        isArchived={isArchived}
        onSuccess={(balance) => handleActionSuccess(balance, 'Consumption')}
      />

      <PhysicalCountModal
        isOpen={showCountModal}
        onClose={() => setShowCountModal(false)}
        itemId={id}
        itemName={stockSummary.name}
        baseUnit={stockSummary.baseUnit}
        currentBalance={stockSummary.availableQuantity}
        isArchived={isArchived}
        onSuccess={(balance) => handleActionSuccess(balance, 'Physical count reconciliation')}
      />
    </div>
  );
}
