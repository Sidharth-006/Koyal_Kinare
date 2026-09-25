'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { SupplierDTO } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import { SupplierFormModal } from '@/components/suppliers/SupplierFormModal';
import {
  ArchiveSupplierModal,
  RestoreSupplierModal
} from '@/components/suppliers/SupplierConfirmationModals';
import {
  Truck, Plus, Search, Eye, Edit, Archive, RotateCcw,
  ChevronLeft, ChevronRight, Phone, Mail, FileText, CheckCircle2,
  AlertCircle, RefreshCw
} from 'lucide-react';

export default function SuppliersPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierDTO | null>(null);

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archivingSupplier, setArchivingSupplier] = useState<SupplierDTO | null>(null);

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoringSupplier, setRestoringSupplier] = useState<SupplierDTO | null>(null);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listSuppliers({
        search: searchQuery.trim() || undefined,
        status: statusFilter,
        page,
        pageSize
      });

      setSuppliers(res.items || []);
      setTotal(res.pagination?.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load suppliers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, page, pageSize]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // Handle Search Input with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as any);
    setPage(1);
  };

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (supplier: SupplierDTO) => {
    setEditingSupplier(supplier);
    setFormModalOpen(true);
  };

  const handleOpenArchive = (supplier: SupplierDTO) => {
    setArchivingSupplier(supplier);
    setArchiveModalOpen(true);
  };

  const handleOpenRestore = (supplier: SupplierDTO) => {
    setRestoringSupplier(supplier);
    setRestoreModalOpen(true);
  };

  const handleFormSuccess = () => {
    loadSuppliers();
  };

  const handleArchiveSuccess = () => {
    loadSuppliers();
  };

  const handleRestoreSuccess = () => {
    loadSuppliers();
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-forest-100 text-forest-800 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-forest-900">
                Supplier Management
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Maintain vendor master records and procurement directory
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={handleOpenAdd}
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          className="shadow-sm"
        >
          Add Supplier
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 bg-white shadow-2xs border-border flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-80">
          <Input
            id="supplier-search"
            placeholder="Search by name, contact, phone, email..."
            value={searchQuery}
            onChange={handleSearchChange}
            leftIcon={<Search className="w-4 h-4" />}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full sm:w-48">
            <Select
              id="supplier-status-filter"
              value={statusFilter}
              onChange={handleStatusChange}
              options={[
                { label: 'Active Suppliers', value: 'active' },
                { label: 'Archived Suppliers', value: 'archived' },
                { label: 'All Suppliers', value: 'all' }
              ]}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSuppliers()}
            title="Refresh list"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            className="shrink-0"
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="p-6 border-danger/30 bg-rose-50/50 flex flex-col items-center justify-center text-center gap-3">
          <AlertCircle className="w-8 h-8 text-danger" />
          <div>
            <h3 className="text-sm font-semibold text-danger">Failed to load suppliers</h3>
            <p className="text-xs text-slate-600 mt-1">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadSuppliers()}>
            Try Again
          </Button>
        </Card>
      )}

      {/* Suppliers Table */}
      {!error && (
        <Card className="overflow-hidden border-border bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-cream-50/70 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Supplier Name</th>
                  <th className="py-3.5 px-4">Contact Person</th>
                  <th className="py-3.5 px-4">Contact Details</th>
                  <th className="py-3.5 px-4">GSTIN</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <>
                    {[...Array(5)].map((_, i) => (
                      <tr key={`skel-${i}`}>
                        <td className="py-4 px-4"><Skeleton className="h-5 w-40" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-28" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-36" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="py-4 px-4 text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></td>
                        <td className="py-4 px-4 text-right"><Skeleton className="h-8 w-24 ml-auto rounded-lg" /></td>
                      </tr>
                    ))}
                  </>
                )}

                {!loading && suppliers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="p-3 bg-cream-100 rounded-full text-slate-400">
                          <Truck className="w-8 h-8" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700">No suppliers found</h4>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm">
                            {searchQuery
                              ? 'No suppliers match your search filters. Try adjusting your query or status filter.'
                              : 'No suppliers have been added yet. Add your first supplier to start managing procurement.'}
                          </p>
                        </div>
                        {!searchQuery && (
                          <Button size="sm" variant="primary" onClick={handleOpenAdd} className="mt-2">
                            Add First Supplier
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && suppliers.map(supplier => {
                  const isArchived = supplier.isArchived || supplier.is_archived;
                  const contactName = supplier.contactPerson || supplier.contact_person;
                  return (
                    <tr
                      key={supplier.id}
                      className={`hover:bg-cream-50/40 transition-colors ${isArchived ? 'bg-slate-50/60 opacity-85' : ''}`}
                    >
                      <td className="py-3.5 px-4 font-medium text-forest-900">
                        <Link
                          href={`/suppliers/${supplier.id}`}
                          className="hover:text-forest-700 hover:underline flex items-center gap-1.5"
                        >
                          {supplier.name}
                        </Link>
                        {supplier.notes && (
                          <p className="text-xs text-slate-400 line-clamp-1 font-normal mt-0.5">
                            {supplier.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {contactName || <span className="text-slate-400 text-xs italic">—</span>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {supplier.phone && (
                            <span className="flex items-center gap-1.5 text-slate-700">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {supplier.phone}
                            </span>
                          )}
                          {supplier.email && (
                            <span className="flex items-center gap-1.5 text-slate-500">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {supplier.email}
                            </span>
                          )}
                          {!supplier.phone && !supplier.email && (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {supplier.gstin ? (
                          <span className="bg-cream-100 px-1.5 py-0.5 rounded border border-border">
                            {supplier.gstin}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-sans">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isArchived ? (
                          <Badge variant="neutral" className="gap-1">
                            <Archive className="w-3 h-3 text-slate-500" />
                            Archived
                          </Badge>
                        ) : (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/suppliers/${supplier.id}`}
                            className="p-1.5 text-slate-500 hover:text-forest-800 hover:bg-cream-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="View Supplier Details & Purchases"
                            aria-label={`View details for ${supplier.name}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleOpenEdit(supplier)}
                            className="p-1.5 text-slate-500 hover:text-forest-800 hover:bg-cream-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Edit Supplier"
                            aria-label={`Edit ${supplier.name}`}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {isArchived ? (
                            <button
                              onClick={() => handleOpenRestore(supplier)}
                              className="p-1.5 text-forest-700 hover:text-forest-900 hover:bg-forest-50 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                              title="Restore Supplier"
                              aria-label={`Restore ${supplier.name}`}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenArchive(supplier)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                              title="Archive Supplier"
                              aria-label={`Archive ${supplier.name}`}
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!loading && total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-border bg-cream-50/50 text-xs text-slate-500 gap-3">
              <div>
                Showing <span className="font-semibold text-slate-700">{suppliers.length}</span> of{' '}
                <span className="font-semibold text-slate-700">{total}</span> suppliers
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  icon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Previous
                </Button>
                <span className="px-2 font-medium text-slate-600">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <span className="flex items-center gap-1.5">
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Modals */}
      <SupplierFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        supplier={editingSupplier}
        onSuccess={handleFormSuccess}
      />

      <ArchiveSupplierModal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        supplier={archivingSupplier}
        onSuccess={handleArchiveSuccess}
      />

      <RestoreSupplierModal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        supplier={restoringSupplier}
        onSuccess={handleRestoreSuccess}
      />
    </div>
  );
}
