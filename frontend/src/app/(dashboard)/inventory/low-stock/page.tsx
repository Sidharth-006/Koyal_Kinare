'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { LowStockItemDTO } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  RefreshCw, MessageSquare, Plus, Layers, ArrowLeft, Info
} from 'lucide-react';

export default function LowStockAlertsPage() {
  const { showToast } = useToast();

  const [items, setItems] = useState<LowStockItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Acknowledge Dialog State
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LowStockItemDTO | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [submittingAcknowledge, setSubmittingAcknowledge] = useState(false);

  const loadLowStockAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listLowStock({ page, pageSize });
      setItems(res.items || []);
      const pag = res.pagination || { page: 1, pageSize: 15, total: 0, totalPages: 1 };
      setTotal(pag.total);
      setTotalPages(pag.totalPages || 1);
    } catch (err: any) {
      const msg = err.message || 'Failed to load low-stock alerts.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, showToast]);

  useEffect(() => {
    loadLowStockAlerts();
  }, [loadLowStockAlerts]);

  const openAcknowledgeModal = (item: LowStockItemDTO) => {
    setSelectedItem(item);
    const existingNote = item.acknowledgementNote || item.acknowledgement_note || item.latest_acknowledgement?.note || item.latestAcknowledgement?.note || '';
    setNoteInput(existingNote);
    setShowAcknowledgeModal(true);
  };

  const handleAcknowledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || submittingAcknowledge) return;

    setSubmittingAcknowledge(true);
    try {
      await api.acknowledgeLowStockAlert(selectedItem.id, noteInput);
      showToast(`Alert noted for "${selectedItem.name}".`, 'success');
      setShowAcknowledgeModal(false);
      setSelectedItem(null);
      setNoteInput('');
      loadLowStockAlerts();
    } catch (err: any) {
      showToast(err.message || 'Failed to record acknowledgement note.', 'error');
    } finally {
      setSubmittingAcknowledge(false);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/inventory" className="text-xs font-semibold text-slate-500 hover:text-forest-800 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </Link>
          </div>
          <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight flex items-center gap-2.5">
            <AlertTriangle className="w-7 h-7 text-amber-500 shrink-0" />
            <span>Low-Stock Alerts</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Items currently at or below their configured minimum stock threshold
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            icon={<RefreshCw className="w-4 h-4 text-forest-800" />}
            onClick={loadLowStockAlerts}
            disabled={loading}
          >
            Refresh
          </Button>
          <Link href="/purchases">
            <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
              Create Purchase
            </Button>
          </Link>
        </div>
      </div>

      {/* Operational Notice Banner */}
      <div className="p-4 bg-amber-50/90 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-amber-900 text-xs leading-relaxed">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-900">Authoritative Alert Invariant:</span>{' '}
          Low-stock status is derived strictly from real-time physical inventory balances. Acknowledging an alert records an operational note for your team, but does <strong>not</strong> suppress or resolve the alert until stock replenishment is received and recorded.
        </div>
      </div>

      {/* Error Retry Card */}
      {error && (
        <Card className="bg-rose-50/80 border-rose-200 text-rose-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={loadLowStockAlerts}>
            Retry
          </Button>
        </Card>
      )}

      {/* Desktop / Tablet Table View */}
      <Card className="hidden md:block p-0 overflow-hidden border-border bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-cream-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-4">Item Name</th>
                <th className="p-4 text-right">Current Balance</th>
                <th className="p-4 text-right">Min Threshold</th>
                <th className="p-4 text-right">Deficit</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Operational Note</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="p-4"><Skeleton className="h-5 w-40" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-5 w-20 ml-auto" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-5 w-20 ml-auto" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-5 w-20 ml-auto" /></td>
                    <td className="p-4 text-center"><Skeleton className="h-5 w-24 mx-auto" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-32" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-5 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="max-w-xs mx-auto text-center space-y-3">
                      <div className="p-3 bg-emerald-100 text-emerald-700 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">All Stock Levels Healthy</p>
                      <p className="text-xs text-slate-500">
                        There are currently no inventory items at or below their minimum stock threshold.
                      </p>
                      <Link href="/inventory/items">
                        <Button variant="secondary" size="sm" icon={<Layers className="w-3.5 h-3.5" />}>
                          View Master Items
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const unit = item.baseUnit || item.base_unit || '';
                  const currQty = parseFloat(String(item.current_quantity ?? item.currentQuantity ?? item.availableQuantity ?? item.available_quantity ?? '0'));
                  const minQty = parseFloat(String(item.minimum_quantity ?? item.minimumQuantity ?? item.minimum_stock ?? item.minimumStock ?? '0'));
                  const deficit = parseFloat(String(item.deficit_quantity ?? item.deficitQuantity ?? (minQty - currQty)));
                  const latestAck = item.latest_acknowledgement || item.latestAcknowledgement;
                  const isAck = item.isAcknowledged ?? item.is_acknowledged ?? Boolean(latestAck);
                  const ackNote = item.acknowledgementNote || item.acknowledgement_note || latestAck?.note;
                  const ackDate = item.acknowledgedAt || item.acknowledged_at || latestAck?.acknowledged_at || latestAck?.acknowledgedAt;
                  const lastMov = item.lastMovementAt || item.last_movement_at || item.lastMovement || item.last_movement;

                  return (
                    <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        {lastMov ? (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Last activity: {formatDate(lastMov)}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-4 text-right font-extrabold text-rose-700">
                        {currQty} <span className="text-xs font-semibold text-slate-500">{unit}</span>
                      </td>
                      <td className="p-4 text-right font-semibold text-slate-700">
                        {minQty} <span className="text-xs font-normal text-slate-400">{unit}</span>
                      </td>
                      <td className="p-4 text-right font-extrabold text-amber-700">
                        -{deficit > 0 ? deficit : 0} <span className="text-xs font-normal text-amber-600">{unit}</span>
                      </td>
                      <td className="p-4 text-center">
                        {isAck ? (
                          <Badge variant="info">Noted / In Review</Badge>
                        ) : (
                          <Badge variant="warning">Action Required</Badge>
                        )}
                      </td>
                      <td className="p-4 max-w-xs">
                        {ackNote ? (
                          <div className="text-xs text-slate-700 bg-cream-50 p-2 rounded-lg border border-border-subtle">
                            <p className="font-medium truncate">{ackNote}</p>
                            {ackDate && (
                              <p className="text-[10px] text-slate-400 mt-0.5 font-sans">
                                Noted on {formatDate(ackDate)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic font-normal">No note recorded</span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAcknowledgeModal(item)}
                          icon={<MessageSquare className="w-3.5 h-3.5 text-forest-800" />}
                          className="font-medium text-forest-800"
                        >
                          {isAck ? 'Update Note' : 'Acknowledge'}
                        </Button>
                        <Link href={`/inventory/${item.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Layers className="w-3.5 h-3.5 text-slate-600" />}
                          >
                            Stock
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Responsive Cards View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <Card key={idx} className="p-4 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))
        ) : items.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">All Stock Levels Healthy</p>
            <p className="text-xs text-slate-500">
              There are currently no items below their minimum threshold.
            </p>
          </Card>
        ) : (
          items.map((item) => {
            const unit = item.baseUnit || item.base_unit || '';
            const currQty = parseFloat(String(item.current_quantity ?? item.currentQuantity ?? item.availableQuantity ?? item.available_quantity ?? '0'));
            const minQty = parseFloat(String(item.minimum_quantity ?? item.minimumQuantity ?? item.minimum_stock ?? item.minimumStock ?? '0'));
            const deficit = parseFloat(String(item.deficit_quantity ?? item.deficitQuantity ?? (minQty - currQty)));
            const latestAck = item.latest_acknowledgement || item.latestAcknowledgement;
            const isAck = item.isAcknowledged ?? item.is_acknowledged ?? Boolean(latestAck);
            const ackNote = item.acknowledgementNote || item.acknowledgement_note || latestAck?.note;
            const ackDate = item.acknowledgedAt || item.acknowledged_at || latestAck?.acknowledged_at || latestAck?.acknowledgedAt;
            const lastMov = item.lastMovementAt || item.last_movement_at || item.lastMovement || item.last_movement;

            return (
              <Card key={item.id} className="p-4 space-y-3 border-amber-200 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{item.name}</h3>
                    {lastMov ? (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Last movement: {formatDate(lastMov)}
                      </p>
                    ) : null}
                  </div>
                  {isAck ? (
                    <Badge variant="info">Noted</Badge>
                  ) : (
                    <Badge variant="warning">Action Required</Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/50">
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[10px]">Current</span>
                    <span className="font-extrabold text-rose-700">{currQty} {unit}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[10px]">Min Level</span>
                    <span className="font-bold text-slate-700">{minQty} {unit}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[10px]">Deficit</span>
                    <span className="font-extrabold text-amber-700">-{deficit > 0 ? deficit : 0} {unit}</span>
                  </div>
                </div>

                {ackNote && (
                  <div className="text-xs bg-cream-50 p-2.5 rounded-xl border border-border-subtle">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Operational Note</span>
                    <p className="text-slate-800 font-medium mt-0.5">{ackNote}</p>
                    {ackDate && (
                      <p className="text-[10px] text-slate-400 mt-1">Noted on {formatDate(ackDate)}</p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                  <Link href={`/inventory/${item.id}`}>
                    <Button variant="ghost" size="sm" icon={<Layers className="w-3.5 h-3.5" />}>
                      View Stock
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openAcknowledgeModal(item)}
                    icon={<MessageSquare className="w-3.5 h-3.5 text-forest-800" />}
                  >
                    {isAck ? 'Update Note' : 'Acknowledge Alert'}
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <Card className="p-3 flex items-center justify-between text-xs font-semibold text-slate-600">
          <div>
            Showing <span className="font-bold text-slate-800">{items.length}</span> of <span className="font-bold text-slate-800">{total}</span> alerts
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous
            </Button>
            <span className="px-2 py-1 bg-cream-100 rounded-lg text-slate-800">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              icon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </Button>
          </div>
        </Card>
      )}

      {/* ACKNOWLEDGE ALERT MODAL */}
      <Modal
        isOpen={showAcknowledgeModal}
        onClose={() => setShowAcknowledgeModal(false)}
        title={`Acknowledge Low-Stock Alert`}
      >
        <form onSubmit={handleAcknowledgeSubmit} className="space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
            <p className="font-bold text-sm text-slate-900">
              Item: {selectedItem?.name}
            </p>
            <p className="text-amber-800 leading-relaxed">
              Recording an operational note acknowledges that management is aware of this shortage. This alert remains active until replacement stock is received.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Operational Note <span className="text-slate-400 font-normal">(Optional, max 500 chars)</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Supplier contacted; batch expected by Friday morning..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              maxLength={500}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-forest-800/20 text-sm text-slate-800 placeholder:text-slate-400 font-sans"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border/50">
            <Button
              variant="ghost"
              onClick={() => setShowAcknowledgeModal(false)}
              type="button"
              disabled={submittingAcknowledge}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={submittingAcknowledge}
            >
              Save Acknowledgement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
