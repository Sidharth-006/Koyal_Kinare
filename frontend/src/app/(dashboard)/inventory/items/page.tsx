'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { InventoryItemDTO, InventoryItemType, InventoryBaseUnit } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Plus, Search, Package, Edit, Archive, RotateCcw,
  ChevronLeft, ChevronRight, AlertTriangle, RefreshCw
} from 'lucide-react';

const ITEM_TYPES: { label: string; value: InventoryItemType }[] = [
  { label: 'Raw Material', value: 'RAW_MATERIAL' },
  { label: 'Packaging', value: 'PACKAGING' },
  { label: 'Beverage', value: 'BEVERAGE' },
  { label: 'Consumable', value: 'CONSUMABLE' }
];

const BASE_UNITS: { label: string; value: InventoryBaseUnit }[] = [
  { label: 'Kilogram (kg)', value: 'KG' },
  { label: 'Gram (g)', value: 'G' },
  { label: 'Liter (L)', value: 'L' },
  { label: 'Milliliter (ml)', value: 'ML' },
  { label: 'Piece (pcs)', value: 'PIECE' },
  { label: 'Packet (pkt)', value: 'PACKET' },
  { label: 'Box (box)', value: 'BOX' }
];

export default function InventoryItemsPage() {
  const { showToast } = useToast();

  // Data State
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemDTO | null>(null);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archivingItem, setArchivingItem] = useState<InventoryItemDTO | null>(null);

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoringItem, setRestoringItem] = useState<InventoryItemDTO | null>(null);

  // Form Field States
  const [formName, setFormName] = useState('');
  const [formItemType, setFormItemType] = useState<InventoryItemType>('RAW_MATERIAL');
  const [formBaseUnit, setFormBaseUnit] = useState<InventoryBaseUnit>('KG');
  const [formMinStock, setFormMinStock] = useState('0');
  const [formDescription, setFormDescription] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [baseUnitWarning, setBaseUnitWarning] = useState<string | null>(null);
  const [submittingForm, setSubmittingForm] = useState(false);

  const [submittingArchive, setSubmittingArchive] = useState(false);
  const [submittingRestore, setSubmittingRestore] = useState(false);

  // Session Idempotency Key
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  const generateIdempotencyKey = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `ik_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const loadInventoryItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listInventoryItems({
        search: searchQuery.trim() || undefined,
        type: selectedType !== 'ALL' ? selectedType : undefined,
        status: selectedStatus,
        page,
        pageSize
      });

      setItems(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      const msg = err.message || 'Failed to load inventory items.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedType, selectedStatus, page, pageSize, showToast]);

  useEffect(() => {
    loadInventoryItems();
  }, [loadInventoryItems]);

  // Reset page to 1 when filters change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleTypeFilterChange = (val: string) => {
    setSelectedType(val);
    setPage(1);
  };

  const handleStatusFilterChange = (val: string) => {
    setSelectedStatus(val);
    setPage(1);
  };

  // Open Form Modal (Create or Edit)
  const openCreateModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormItemType('RAW_MATERIAL');
    setFormBaseUnit('KG');
    setFormMinStock('0');
    setFormDescription('');
    setFormErrors({});
    setBaseUnitWarning(null);
    setIdempotencyKey(generateIdempotencyKey());
    setShowFormModal(true);
  };

  const openEditModal = (item: InventoryItemDTO) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormItemType(item.itemType || item.item_type || 'RAW_MATERIAL');
    setFormBaseUnit(item.baseUnit || item.base_unit || 'KG');
    setFormMinStock(String(item.minimumStock ?? item.minimum_stock ?? '0'));
    setFormDescription(item.description || '');
    setFormErrors({});
    setBaseUnitWarning(null);
    setIdempotencyKey(generateIdempotencyKey());
    setShowFormModal(true);
  };

  // Open Archive / Restore Modals
  const openArchiveModal = (item: InventoryItemDTO) => {
    setArchivingItem(item);
    setIdempotencyKey(generateIdempotencyKey());
    setShowArchiveModal(true);
  };

  const openRestoreModal = (item: InventoryItemDTO) => {
    setRestoringItem(item);
    setIdempotencyKey(generateIdempotencyKey());
    setShowRestoreModal(true);
  };

  // Form Client Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedName = formName.trim();
    if (!trimmedName) {
      errors.name = 'Item name is required.';
    } else if (trimmedName.length > 120) {
      errors.name = 'Item name cannot exceed 120 characters.';
    }

    if (!formItemType) {
      errors.itemType = 'Please select an item type.';
    }

    if (!formBaseUnit) {
      errors.baseUnit = 'Please select a base unit of measure.';
    }

    const minStockNum = parseFloat(formMinStock);
    if (formMinStock === '' || isNaN(minStockNum)) {
      errors.minimumStock = 'Minimum stock is required.';
    } else if (minStockNum < 0) {
      errors.minimumStock = 'Minimum stock level cannot be negative.';
    }

    if (formDescription && formDescription.length > 500) {
      errors.description = 'Description cannot exceed 500 characters.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form Submit Handler (Create or Update)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || submittingForm) return;

    setSubmittingForm(true);
    setBaseUnitWarning(null);

    const payload = {
      name: formName.trim(),
      itemType: formItemType,
      baseUnit: formBaseUnit,
      minimumStock: parseFloat(formMinStock),
      description: formDescription.trim() || undefined
    };

    try {
      if (editingItem) {
        await api.updateInventoryItem(editingItem.id, payload, idempotencyKey);
        showToast('Inventory item updated successfully!', 'success');
      } else {
        await api.createInventoryItem(payload, idempotencyKey);
        showToast('Inventory item created successfully!', 'success');
      }

      setShowFormModal(false);
      loadInventoryItems();
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'ITEM_HAS_STOCK_HISTORY') {
          const warningMsg = 'Base unit cannot change after stock activity has started. Please create a replacement item if a different unit of measure is required.';
          setBaseUnitWarning(warningMsg);
          setFormErrors(prev => ({ ...prev, baseUnit: warningMsg }));
          showToast(warningMsg, 'warning');
        } else if (err.code === 'DUPLICATE_INVENTORY_ITEM') {
          setFormErrors(prev => ({ ...prev, name: 'An active inventory item already uses this name.' }));
          showToast('An active inventory item already uses this name.', 'error');
        } else {
          showToast(err.message || 'Failed to save inventory item.', 'error');
        }
      } else {
        showToast('An unexpected error occurred.', 'error');
      }
    } finally {
      setSubmittingForm(false);
    }
  };

  // Archive Confirm Handler
  const handleArchiveConfirm = async () => {
    if (!archivingItem || submittingArchive) return;
    setSubmittingArchive(true);

    try {
      await api.archiveInventoryItem(archivingItem.id, idempotencyKey);
      showToast(`${archivingItem.name} has been archived.`, 'success');
      setShowArchiveModal(false);
      setArchivingItem(null);
      loadInventoryItems();
    } catch (err: any) {
      showToast(err.message || 'Failed to archive inventory item.', 'error');
    } finally {
      setSubmittingArchive(false);
    }
  };

  // Restore Confirm Handler
  const handleRestoreConfirm = async () => {
    if (!restoringItem || submittingRestore) return;
    setSubmittingRestore(true);

    try {
      await api.restoreInventoryItem(restoringItem.id, idempotencyKey);
      showToast(`${restoringItem.name} has been restored to active inventory.`, 'success');
      setShowRestoreModal(false);
      setRestoringItem(null);
      loadInventoryItems();
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_INVENTORY_ITEM') {
        showToast('Cannot restore item because an active item with the same name already exists.', 'error');
      } else {
        showToast(err.message || 'Failed to restore inventory item.', 'error');
      }
    } finally {
      setSubmittingRestore(false);
    }
  };

  // Helper formatting labels
  const formatItemTypeLabel = (typeStr?: string) => {
    switch (typeStr) {
      case 'RAW_MATERIAL': return 'Raw Material';
      case 'PACKAGING': return 'Packaging';
      case 'BEVERAGE': return 'Beverage';
      case 'CONSUMABLE': return 'Consumable';
      default: return typeStr || 'Unknown';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight flex items-center gap-2.5">
            <Package className="w-7 h-7 text-amber-500 shrink-0" />
            <span>Inventory Items</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Manage raw materials, packaging, units, and minimum stock thresholds
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={openCreateModal}
        >
          Add Item
        </Button>
      </div>

      {/* Filter & Control Bar */}
      <Card className="p-4 border-border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search */}
          <div>
            <Input
              placeholder="Search items by name..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          {/* Item Type Filter */}
          <div>
            <Select
              value={selectedType}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
              options={[
                { label: 'All Item Types', value: 'ALL' },
                ...ITEM_TYPES
              ]}
            />
          </div>

          {/* Status Filter */}
          <div>
            <Select
              value={selectedStatus}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              options={[
                { label: 'Active Items', value: 'active' },
                { label: 'Archived Items', value: 'archived' },
                { label: 'All Records', value: 'all' }
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Error Retry Card */}
      {error && (
        <Card className="bg-rose-50/80 border-rose-200 text-rose-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={loadInventoryItems}>
            Retry
          </Button>
        </Card>
      )}

      {/* Desktop / Tablet Table View */}
      <Card className="hidden md:block p-0 overflow-hidden border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-cream-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-4">Item Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">Base Unit</th>
                <th className="p-4 text-right">Min Threshold</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Last Updated</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="p-4"><Skeleton className="h-5 w-40" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-24" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-16" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-5 w-16 ml-auto" /></td>
                    <td className="p-4 text-center"><Skeleton className="h-5 w-16 mx-auto" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-28" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-5 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="max-w-xs mx-auto text-center space-y-3">
                      <div className="p-3 bg-amber-500/10 text-amber-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                        <Package className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">No inventory items found</p>
                      <p className="text-xs text-slate-500">
                        {searchQuery || selectedType !== 'ALL' || selectedStatus !== 'active'
                          ? 'Try adjusting your search query or filters.'
                          : 'Get started by creating your first inventory master item.'}
                      </p>
                      <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateModal}>
                        Add Inventory Item
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const typeLabel = formatItemTypeLabel(item.itemType || item.item_type);
                  const unitLabel = item.baseUnit || item.base_unit || '-';
                  const minStock = item.minimumStock ?? item.minimum_stock ?? '0';
                  const isArch = item.isArchived ?? item.is_archived ?? false;

                  return (
                    <tr key={item.id} className="hover:bg-cream-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">{item.description}</div>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 font-medium">
                        <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                          {typeLabel}
                        </span>
                      </td>
                      <td className="p-4 text-slate-700 font-bold">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/60 rounded text-xs">
                          {unitLabel}
                        </span>
                      </td>
                      <td className="p-4 text-right font-extrabold text-slate-800">
                        {minStock}
                      </td>
                      <td className="p-4 text-center">
                        {isArch ? (
                          <Badge variant="danger">Archived</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-500 font-medium">
                        {formatDate(item.updated_at || item.created_at)}
                      </td>
                      <td className="p-4 text-right space-x-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(item)}
                          icon={<Edit className="w-3.5 h-3.5" />}
                        >
                          Edit
                        </Button>
                        {isArch ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRestoreModal(item)}
                            icon={<RotateCcw className="w-3.5 h-3.5" />}
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:text-rose-700"
                            onClick={() => openArchiveModal(item)}
                            icon={<Archive className="w-3.5 h-3.5" />}
                          >
                            Archive
                          </Button>
                        )}
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
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">No inventory items found</p>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateModal}>
              Add Inventory Item
            </Button>
          </Card>
        ) : (
          items.map((item) => {
            const typeLabel = formatItemTypeLabel(item.itemType || item.item_type);
            const unitLabel = item.baseUnit || item.base_unit || '-';
            const minStock = item.minimumStock ?? item.minimum_stock ?? '0';
            const isArch = item.isArchived ?? item.is_archived ?? false;

            return (
              <Card key={item.id} className="p-4 space-y-3 border-border">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{item.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.description || 'No description'}</p>
                  </div>
                  {isArch ? <Badge variant="danger">Archived</Badge> : <Badge variant="success">Active</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-cream-50 p-2.5 rounded-xl border border-border/50">
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[10px]">Type</span>
                    <span className="font-bold text-slate-700">{typeLabel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[10px]">Base Unit</span>
                    <span className="font-bold text-amber-800">{unitLabel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[10px]">Min Threshold</span>
                    <span className="font-extrabold text-slate-800">{minStock}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[10px]">Updated</span>
                    <span className="font-medium text-slate-600">{formatDate(item.updated_at || item.created_at)}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-border/40">
                  <Button variant="ghost" size="sm" onClick={() => openEditModal(item)} icon={<Edit className="w-3.5 h-3.5" />}>
                    Edit
                  </Button>
                  {isArch ? (
                    <Button variant="ghost" size="sm" onClick={() => openRestoreModal(item)} icon={<RotateCcw className="w-3.5 h-3.5" />}>
                      Restore
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => openArchiveModal(item)} icon={<Archive className="w-3.5 h-3.5" />}>
                      Archive
                    </Button>
                  )}
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
            Showing <span className="font-bold text-slate-800">{items.length}</span> of <span className="font-bold text-slate-800">{total}</span> items
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

      {/* INVENTORY ITEM FORM MODAL (CREATE / EDIT) */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingItem ? `Edit Inventory Item` : `Add New Inventory Item`}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Base Unit Stock History Warning Callout */}
          {baseUnitWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Base Unit Restriction</p>
                <p className="mt-0.5">{baseUnitWarning}</p>
              </div>
            </div>
          )}

          {/* Item Name */}
          <Input
            label="Item Name *"
            placeholder="e.g. Whole Milk, Paper Coffee Cups, Sugar Bags"
            value={formName}
            onChange={(e) => {
              setFormName(e.target.value);
              if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }));
            }}
            error={formErrors.name}
            required
          />

          {/* Item Type */}
          <Select
            label="Item Type *"
            value={formItemType}
            onChange={(e) => {
              setFormItemType(e.target.value as InventoryItemType);
              if (formErrors.itemType) setFormErrors(prev => ({ ...prev, itemType: '' }));
            }}
            options={ITEM_TYPES}
            error={formErrors.itemType}
            required
          />

          {/* Base Unit */}
          <Select
            label="Base Unit of Measure *"
            value={formBaseUnit}
            onChange={(e) => {
              setFormBaseUnit(e.target.value as InventoryBaseUnit);
              if (formErrors.baseUnit) setFormErrors(prev => ({ ...prev, baseUnit: '' }));
            }}
            options={BASE_UNITS}
            error={formErrors.baseUnit}
            required
          />

          {/* Minimum Stock Level */}
          <Input
            label="Minimum Stock Threshold *"
            type="number"
            min="0"
            step="0.001"
            placeholder="e.g. 5.000"
            value={formMinStock}
            onChange={(e) => {
              setFormMinStock(e.target.value);
              if (formErrors.minimumStock) setFormErrors(prev => ({ ...prev, minimumStock: '' }));
            }}
            error={formErrors.minimumStock}
            required
          />

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional, max 500 characters)</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Grade A full cream milk used for beverages and chai..."
              value={formDescription}
              onChange={(e) => {
                setFormDescription(e.target.value);
                if (formErrors.description) setFormErrors(prev => ({ ...prev, description: '' }));
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-forest-800/20 text-sm text-slate-800 placeholder:text-slate-400"
            />
            {formErrors.description && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{formErrors.description}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border/50">
            <Button variant="ghost" onClick={() => setShowFormModal(false)} type="button" disabled={submittingForm}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submittingForm}>
              {editingItem ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ARCHIVE CONFIRMATION MODAL */}
      <Modal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        title="Archive Inventory Item"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Are you sure you want to archive "{archivingItem?.name}"?</p>
              <p className="mt-1 leading-relaxed">
                Archiving preserves historic stock records and reports. However, this item will no longer be selectable for new purchase orders or stock adjustments.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowArchiveModal(false)} disabled={submittingArchive}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleArchiveConfirm}
              isLoading={submittingArchive}
            >
              Archive Item
            </Button>
          </div>
        </div>
      </Modal>

      {/* RESTORE CONFIRMATION MODAL */}
      <Modal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        title="Restore Inventory Item"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 font-medium">
            Restore <span className="font-bold text-slate-900">"{restoringItem?.name}"</span> back to active inventory master items?
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowRestoreModal(false)} disabled={submittingRestore}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRestoreConfirm}
              isLoading={submittingRestore}
            >
              Restore Item
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
