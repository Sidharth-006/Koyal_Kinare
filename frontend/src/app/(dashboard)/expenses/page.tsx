'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ExpenseDTO } from '@/lib/types';
import { formatINR } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Plus, AlertTriangle, Receipt, Wallet, Ban } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  { label: 'All Categories', value: '' },
  { label: 'Raw Material', value: 'RAW_MATERIALS' },
  { label: 'LPG Gas', value: 'LPG' },
  { label: 'Electricity', value: 'ELECTRICITY' },
  { label: 'Salaries', value: 'SALARY' },
  { label: 'Packaging', value: 'PACKAGING' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
  { label: 'Miscellaneous', value: 'MISCELLANEOUS' }
];

const PAYMENT_METHODS = [
  { label: 'All Payment Methods', value: '' },
  { label: '💵 Cash', value: 'CASH' },
  { label: '📱 UPI', value: 'UPI' },
  { label: '💳 Card', value: 'CARD' }
];

export default function ExpensesPage() {
  const { showToast } = useToast();

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [includeVoided, setIncludeVoided] = useState(true);

  // Data
  const [expenses, setExpenses] = useState<ExpenseDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseDTO | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [submittingVoid, setSubmittingVoid] = useState(false);

  // Form State
  const [category, setCategory] = useState('RAW_MATERIALS');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [description, setDescription] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, [startDate, endDate, categoryFilter, paymentMethodFilter, includeVoided]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await api.listExpenses({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        category: categoryFilter || undefined,
        paymentMethod: paymentMethodFilter || undefined,
        includeVoided
      });
      setExpenses(data.expenses || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load expenses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      showToast('Please enter a valid expense amount', 'warning');
      return;
    }
    if (!description.trim()) {
      showToast('Please enter an expense description', 'warning');
      return;
    }

    setSubmittingAdd(true);
    try {
      await api.createExpense({
        category,
        amount: parseFloat(amount),
        paymentMethod,
        description: description.trim()
      });
      showToast('Expense recorded successfully!', 'success');
      setShowAddModal(false);
      setAmount('');
      setDescription('');
      loadExpenses();
    } catch (err: any) {
      showToast(err.message || 'Failed to create expense', 'error');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleVoidExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense) return;
    if (!voidReason.trim()) {
      showToast('Mandatory void reason is required', 'warning');
      return;
    }

    setSubmittingVoid(true);
    try {
      await api.voidExpense(selectedExpense.id, voidReason.trim());
      showToast(`Expense #${selectedExpense.id.slice(0, 8)} voided successfully`, 'success');
      setShowVoidModal(false);
      setSelectedExpense(null);
      setVoidReason('');
      loadExpenses();
    } catch (err: any) {
      showToast(err.message || 'Failed to void expense', 'error');
    } finally {
      setSubmittingVoid(false);
    }
  };

  // Calculations
  const activeExpenses = expenses.filter(e => e.is_voided !== true && e.status !== 'VOIDED');
  const totalActiveExpense = activeExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const cashExpenses = activeExpenses.filter(e => (e.payment_method || e.paymentMethod) === 'CASH');
  const totalCashExpense = cashExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight">Expense Management</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Track daily operational costs, vendor payments, and cash outlays</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
          Record Expense
        </Button>
      </div>

      {/* Cash Expense Impact Notice Banner */}
      <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3.5 text-amber-900 text-sm shadow-2xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-900">Financial Impact Notice</p>
          <p className="text-xs text-amber-800/90 mt-0.5 font-medium leading-relaxed">
            Cash expenses directly deduct from expected register cash during end-of-day reconciliation.
            Total cash expenses in current view: <strong className="font-bold text-amber-950">{formatINR(totalCashExpense)}</strong>.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 border-border">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Select
          label="Category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={EXPENSE_CATEGORIES}
        />
        <Select
          label="Payment Method"
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
          options={PAYMENT_METHODS}
        />
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={includeVoided}
              onChange={(e) => setIncludeVoided(e.target.checked)}
              className="w-4 h-4 rounded border-border text-forest-800 focus:ring-forest-800/20"
            />
            Include Voided
          </label>
        </div>
      </Card>

      {/* Expense Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card hoverable className="flex justify-between items-center border-border">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Operational Expenses</p>
            <p className="text-2xl font-extrabold text-forest-800 mt-1">{formatINR(totalActiveExpense)}</p>
          </div>
          <div className="p-3 bg-cream-100 rounded-2xl text-forest-800">
            <Receipt className="w-6 h-6" />
          </div>
        </Card>
        <Card hoverable className="flex justify-between items-center border-border">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cash Register Outflow</p>
            <p className="text-2xl font-extrabold text-amber-700 mt-1">{formatINR(totalCashExpense)}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-2xl text-amber-700">
            <Wallet className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Expenses Table */}
      <Card className="p-0 overflow-hidden border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-cream-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-4">Date</th>
                <th className="p-4">Category</th>
                <th className="p-4">Description</th>
                <th className="p-4">Payment Method</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    Loading expense records...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    No expense records found
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => {
                  const isVoided = expense.is_voided === true || expense.status === 'VOIDED';
                  const bDate = expense.business_date || expense.businessDate || new Date(expense.created_at || expense.createdAt || Date.now()).toLocaleDateString();
                  const pMethod = expense.payment_method || expense.paymentMethod;
                  const vReason = expense.void_reason || expense.voidReason;

                  return (
                    <tr
                      key={expense.id}
                      className={`hover:bg-cream-50/50 transition-colors ${
                        isVoided ? 'opacity-60 bg-slate-50 line-through' : ''
                      }`}
                    >
                      <td className="p-4 text-slate-600 font-mono text-xs whitespace-nowrap font-medium">
                        {bDate}
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        <Badge variant="info">{expense.category}</Badge>
                      </td>
                      <td className="p-4 text-slate-700 font-medium max-w-xs truncate">
                        {expense.description}
                        {isVoided && vReason && (
                          <span className="block text-xs text-rose-600 italic no-underline mt-0.5 font-normal">
                            Reason: {vReason}
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-bold text-slate-700">{pMethod}</td>
                      <td className="p-4 text-right font-extrabold text-rose-600 whitespace-nowrap">
                        {formatINR(expense.amount)}
                      </td>
                      <td className="p-4 text-center">
                        {isVoided ? (
                          <Badge variant="danger">VOIDED</Badge>
                        ) : (
                          <Badge variant="success">PAID</Badge>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {!isVoided && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:text-rose-700"
                            icon={<Ban className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setSelectedExpense(expense);
                              setShowVoidModal(true);
                            }}
                          >
                            Void
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

      {/* RECORD EXPENSE MODAL */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Record Operational Expense"
      >
        <form onSubmit={handleAddExpense} className="space-y-4">
          <Select
            label="Expense Category *"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={EXPENSE_CATEGORIES.filter(c => c.value !== '')}
            required
          />
          <Input
            label="Expense Amount (₹) *"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 1500.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Select
            label="Payment Method *"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
            options={[
              { label: '💵 Cash (Deducts from Cash Register)', value: 'CASH' },
              { label: '📱 UPI', value: 'UPI' },
              { label: '💳 Card', value: 'CARD' }
            ]}
            required
          />
          <Input
            label="Description / Purpose *"
            placeholder="e.g. Purchased 10kg coffee beans from supplier"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setShowAddModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submittingAdd}>
              Save Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* VOID EXPENSE MODAL */}
      <Modal
        isOpen={showVoidModal}
        onClose={() => setShowVoidModal(false)}
        title="Void Expense Record"
      >
        <form onSubmit={handleVoidExpense} className="space-y-4">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed font-medium">
            You are about to void Expense #{selectedExpense?.id.slice(0, 8)} of{' '}
            <strong className="font-bold">{selectedExpense && formatINR(selectedExpense.amount)}</strong>.
            This action will mark the status as VOIDED and adjust daily reconciliation.
          </div>

          <Input
            label="Mandatory Void Reason *"
            placeholder="e.g. Duplicate entry, incorrect vendor amount"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setShowVoidModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="danger" type="submit" isLoading={submittingVoid}>
              Confirm Void Expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
