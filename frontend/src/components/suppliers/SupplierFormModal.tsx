'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SupplierDTO, CreateSupplierPayload, UpdateSupplierPayload } from '@/lib/types';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/ToastContext';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: SupplierDTO | null;
  onSuccess: (supplier: SupplierDTO) => void;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onSuccess
}) => {
  const { showToast } = useToast();
  const isEditing = Boolean(supplier);

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (supplier) {
        setName(supplier.name || '');
        setContactPerson(supplier.contactPerson || supplier.contact_person || '');
        setPhone(supplier.phone || '');
        setEmail(supplier.email || '');
        setAddress(supplier.address || '');
        setGstin(supplier.gstin || '');
        setNotes(supplier.notes || '');
      } else {
        setName('');
        setContactPerson('');
        setPhone('');
        setEmail('');
        setAddress('');
        setGstin('');
        setNotes('');
      }
      setErrors({});
    }
  }, [isOpen, supplier]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Supplier name is required.';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const idempotencyKey = typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `ik_${Date.now()}`;

    const payload: CreateSupplierPayload | UpdateSupplierPayload = {
      name: name.trim(),
      contactPerson: contactPerson.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      gstin: gstin.trim() || undefined,
      notes: notes.trim() || undefined
    };

    try {
      if (isEditing && supplier) {
        const res = await api.updateSupplier(supplier.id, payload, idempotencyKey);
        showToast('Supplier updated successfully', 'success');
        onSuccess(res.supplier);
      } else {
        const res = await api.createSupplier(payload as CreateSupplierPayload, idempotencyKey);
        showToast('Supplier created successfully', 'success');
        onSuccess(res.supplier);
      }
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'DUPLICATE_SUPPLIER') {
          setErrors(prev => ({ ...prev, name: 'An active supplier already uses this name.' }));
          showToast('An active supplier already uses this name.', 'error');
        } else if (err.code === 'VALIDATION_ERROR') {
          showToast(err.message || 'Please review the highlighted fields.', 'error');
        } else {
          showToast(err.message || 'Failed to save supplier', 'error');
        }
      } else {
        showToast('An unexpected error occurred. Please try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Supplier' : 'Add New Supplier'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 overflow-y-auto max-h-[75vh]">
        <Input
          label="Supplier Name *"
          id="supplier-name"
          placeholder="e.g. Metro Dairy Products"
          value={name}
          onChange={e => setName(e.target.value)}
          error={errors.name}
          disabled={submitting}
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Contact Person"
            id="supplier-contact-person"
            placeholder="e.g. Ramesh Kumar"
            value={contactPerson}
            onChange={e => setContactPerson(e.target.value)}
            disabled={submitting}
          />
          <Input
            label="Phone"
            id="supplier-phone"
            type="tel"
            placeholder="e.g. +91 9876543210"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            error={errors.phone}
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Email"
            id="supplier-email"
            type="email"
            placeholder="e.g. orders@metrodairy.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            error={errors.email}
            disabled={submitting}
          />
          <Input
            label="GSTIN (Optional)"
            id="supplier-gstin"
            placeholder="e.g. 27AAPFU0939F1ZV"
            value={gstin}
            onChange={e => setGstin(e.target.value.toUpperCase())}
            error={errors.gstin}
            disabled={submitting}
            helperText="15-character GSTIN format"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="supplier-address" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Address
          </label>
          <textarea
            id="supplier-address"
            rows={2}
            className="w-full bg-cream-50/60 border border-border rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 focus:bg-white transition-all duration-200 shadow-2xs resize-none"
            placeholder="e.g. Plot 45, Industrial Area, Sector 2"
            value={address}
            onChange={e => setAddress(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="supplier-notes" className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Notes
          </label>
          <textarea
            id="supplier-notes"
            rows={2}
            className="w-full bg-cream-50/60 border border-border rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 focus:bg-white transition-all duration-200 shadow-2xs resize-none"
            placeholder="e.g. Early morning delivery schedule, payment terms 15 days"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
            disabled={submitting}
          >
            {isEditing ? 'Save Changes' : 'Create Supplier'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
