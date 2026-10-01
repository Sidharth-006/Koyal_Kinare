'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { StaffDTO } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import { StaffFormModal } from '@/components/staff/StaffFormModal';
import {
  ArchiveStaffModal,
  RestoreStaffModal
} from '@/components/staff/StaffConfirmationModals';
import {
  Users, UserPlus, Search, Edit, Archive, RotateCcw,
  ChevronLeft, ChevronRight, Phone, Calendar, Briefcase,
  AlertCircle, RefreshCw, CalendarCheck, Shield, Eye
} from 'lucide-react';

export default function StaffPage() {
  const { showToast } = useToast();

  const [staffList, setStaffList] = useState<StaffDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffDTO | null>(null);

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archivingStaff, setArchivingStaff] = useState<StaffDTO | null>(null);

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoringStaff, setRestoringStaff] = useState<StaffDTO | null>(null);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listStaff({
        search: searchQuery.trim() || undefined,
        archived: statusFilter,
        roleTitle: selectedRole !== 'ALL' ? selectedRole : undefined
      });

      setStaffList(res.staff || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to load staff directory.');
      } else {
        setError('Failed to load staff directory. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, selectedRole]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Dynamically derive role filter options from returned staff data without fixed taxonomy
  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    staffList.forEach((s) => {
      const r = (s.role_title || s.roleTitle || '').trim();
      if (r) roles.add(r);
    });
    return Array.from(roles).sort();
  }, [staffList]);

  // Client-side pagination based on the retrieved staff array
  const total = staffList.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Reset page if totalPages shrinks
  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [page, totalPages]);

  const paginatedStaff = useMemo(() => {
    const start = (page - 1) * pageSize;
    return staffList.slice(start, start + pageSize);
  }, [staffList, page, pageSize]);

  // Search input handler
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (status: 'active' | 'archived' | 'all') => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value);
    setPage(1);
  };

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (staff: StaffDTO) => {
    setEditingStaff(staff);
    setFormModalOpen(true);
  };

  const handleOpenArchive = (staff: StaffDTO) => {
    setArchivingStaff(staff);
    setArchiveModalOpen(true);
  };

  const handleOpenRestore = (staff: StaffDTO) => {
    setRestoringStaff(staff);
    setRestoreModalOpen(true);
  };

  const handleFormSuccess = () => {
    loadStaff();
  };

  const handleArchiveSuccess = () => {
    loadStaff();
  };

  const handleRestoreSuccess = () => {
    loadStaff();
  };

  // Helper for staff initials avatar
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (parts[0]?.[0] || 'S').toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-forest-800">
              Staff Directory
            </h1>
            <Badge variant="forest">Phase 3</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Operational team profiles and attendance roster management.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/attendance">
            <Button
              variant="secondary"
              icon={<CalendarCheck className="w-4 h-4 text-forest-800" />}
            >
              Daily Attendance
            </Button>
          </Link>
          <Button
            variant="primary"
            onClick={handleOpenAdd}
            icon={<UserPlus className="w-4 h-4" />}
          >
            Add Staff
          </Button>
        </div>
      </div>

      {/* Operational disclaimer note */}
      <div className="flex items-center gap-2 p-3 bg-cream-50/90 border border-border rounded-xl text-xs text-slate-600">
        <Shield className="w-4 h-4 text-forest-800 shrink-0" />
        <span>
          <strong>Operational records only:</strong> Staff profiles in this module do not have login credentials or system access.
        </span>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search box */}
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search by name, role, or phone..."
              value={searchQuery}
              onChange={handleSearchChange}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Status Tabs and Role Filter */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Pills */}
            <div className="inline-flex items-center p-1 bg-cream-100/80 rounded-xl border border-border text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleStatusChange('active')}
                className={`px-3 py-1.5 rounded-lg transition-all min-h-[36px] ${
                  statusFilter === 'active'
                    ? 'bg-white text-forest-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('archived')}
                className={`px-3 py-1.5 rounded-lg transition-all min-h-[36px] ${
                  statusFilter === 'archived'
                    ? 'bg-white text-forest-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Archived
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('all')}
                className={`px-3 py-1.5 rounded-lg transition-all min-h-[36px] ${
                  statusFilter === 'all'
                    ? 'bg-white text-forest-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
            </div>

            {/* Dynamic Role Filter */}
            {availableRoles.length > 0 && (
              <div className="w-44">
                <Select
                  value={selectedRole}
                  onChange={handleRoleChange}
                  options={[
                    { value: 'ALL', label: 'All Roles' },
                    ...availableRoles.map((r) => ({ value: r, label: r }))
                  ]}
                />
              </div>
            )}

            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadStaff}
              disabled={loading}
              title="Refresh staff directory"
              aria-label="Refresh staff directory"
              icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            />
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {error ? (
        <Card className="p-8 text-center border-rose-200 bg-rose-50/50">
          <div className="flex flex-col items-center justify-center gap-3">
            <AlertCircle className="w-10 h-10 text-rose-600" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-900">Failed to load staff directory</h3>
              <p className="text-sm text-rose-700">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadStaff} className="mt-2">
              Try Again
            </Button>
          </div>
        </Card>
      ) : loading ? (
        <Card className="p-4 md:p-6 space-y-4">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="w-36 h-4" />
                    <Skeleton className="w-24 h-3" />
                  </div>
                </div>
                <Skeleton className="w-24 h-4 hidden sm:block" />
                <Skeleton className="w-20 h-6 rounded-full" />
                <Skeleton className="w-16 h-8 rounded-lg" />
              </div>
            ))}
          </div>
        </Card>
      ) : staffList.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-forest-100 flex items-center justify-center text-forest-800">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-forest-900">No staff members found</h3>
            <p className="text-sm text-slate-500">
              {searchQuery || selectedRole !== 'ALL' || statusFilter !== 'active'
                ? 'No staff members match your filter criteria. Try adjusting search or filters.'
                : 'Get started by creating your first staff member profile for attendance and operations.'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {(searchQuery || selectedRole !== 'ALL' || statusFilter !== 'active') ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRole('ALL');
                    setStatusFilter('active');
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleOpenAdd} icon={<UserPlus className="w-4 h-4" />}>
                  Add Staff Member
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          {/* Desktop & Tablet Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-cream-50/70 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Staff Member</th>
                  <th className="py-3.5 px-4">Role / Title</th>
                  <th className="py-3.5 px-4">Phone Number</th>
                  <th className="py-3.5 px-4">Joining Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {paginatedStaff.map((staff) => {
                  const fullName = staff.full_name || staff.fullName || 'Unnamed Staff';
                  const roleTitle = staff.role_title || staff.roleTitle || '—';
                  const phone = staff.phone;
                  const joiningDate = staff.joining_date || staff.joiningDate || '—';
                  const isArchived = staff.is_archived ?? staff.isArchived ?? false;

                  return (
                    <tr
                      key={staff.id}
                      className="hover:bg-cream-50/40 transition-colors"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-forest-100 border border-forest-800/15 flex items-center justify-center text-xs font-bold text-forest-800 shrink-0">
                            {getInitials(fullName)}
                          </div>
                          <div>
                            <Link
                              href={`/staff/${staff.id}`}
                              className="font-semibold text-slate-900 block hover:text-forest-800 hover:underline"
                            >
                              {fullName}
                            </Link>
                            <span className="text-[11px] text-slate-500">ID: {staff.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {roleTitle}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {phone ? (
                          <a
                            href={`tel:${phone}`}
                            className="inline-flex items-center gap-1.5 hover:text-forest-800 hover:underline min-h-[32px]"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Joining Date */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{joiningDate}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isArchived ? (
                          <Badge variant="neutral">Archived</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/staff/${staff.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`View ${fullName}`}
                              icon={<Eye className="w-3.5 h-3.5" />}
                            >
                              View
                            </Button>
                          </Link>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(staff)}
                            aria-label={`Edit ${fullName}`}
                            icon={<Edit className="w-3.5 h-3.5" />}
                          >
                            Edit
                          </Button>

                          {isArchived ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenRestore(staff)}
                              aria-label={`Restore ${fullName}`}
                              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                              icon={<RotateCcw className="w-3.5 h-3.5" />}
                            >
                              Restore
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenArchive(staff)}
                              aria-label={`Archive ${fullName}`}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              icon={<Archive className="w-3.5 h-3.5" />}
                            >
                              Archive
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-border">
            {paginatedStaff.map((staff) => {
              const fullName = staff.full_name || staff.fullName || 'Unnamed Staff';
              const roleTitle = staff.role_title || staff.roleTitle || '—';
              const phone = staff.phone;
              const joiningDate = staff.joining_date || staff.joiningDate || '—';
              const isArchived = staff.is_archived ?? staff.isArchived ?? false;

              return (
                <div key={staff.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-forest-100 border border-forest-800/15 flex items-center justify-center text-xs font-bold text-forest-800 shrink-0">
                        {getInitials(fullName)}
                      </div>
                      <div>
                        <Link
                          href={`/staff/${staff.id}`}
                          className="font-bold text-slate-900 text-sm hover:text-forest-800 hover:underline"
                        >
                          {fullName}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          <span>{roleTitle}</span>
                        </div>
                      </div>
                    </div>
                    {isArchived ? (
                      <Badge variant="neutral">Archived</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-cream-50/50 p-2.5 rounded-xl border border-border/60">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {phone ? (
                        <a href={`tel:${phone}`} className="hover:underline text-slate-800">
                          {phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">No phone</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{joiningDate}</span>
                    </div>
                  </div>

                  {/* Actions for mobile card */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Link href={`/staff/${staff.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="w-3.5 h-3.5" />}
                      >
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEdit(staff)}
                      icon={<Edit className="w-3.5 h-3.5" />}
                    >
                      Edit
                    </Button>
                    {isArchived ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenRestore(staff)}
                        className="text-emerald-700 hover:text-emerald-800"
                        icon={<RotateCcw className="w-3.5 h-3.5" />}
                      >
                        Restore
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenArchive(staff)}
                        className="text-rose-600 hover:text-rose-700"
                        icon={<Archive className="w-3.5 h-3.5" />}
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 border-t border-border bg-cream-50/40 text-xs">
              <span className="text-slate-500">
                Showing{' '}
                <strong className="text-slate-700 font-semibold">
                  {(page - 1) * pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-700 font-semibold">
                  {Math.min(page * pageSize, total)}
                </strong>{' '}
                of <strong className="text-slate-700 font-semibold">{total}</strong> staff members
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
      <StaffFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        staff={editingStaff}
        onSuccess={handleFormSuccess}
      />

      <ArchiveStaffModal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        staff={archivingStaff}
        onSuccess={handleArchiveSuccess}
      />

      <RestoreStaffModal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        staff={restoringStaff}
        onSuccess={handleRestoreSuccess}
      />
    </div>
  );
}
