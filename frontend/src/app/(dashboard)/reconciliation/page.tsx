'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Lock, Unlock, Key, Wallet, CreditCard, DollarSign, CheckCircle2 } from 'lucide-react';

export default function ReconciliationPage() {
  const { showToast } = useToast();

  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reconData, setReconData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Opening Cash Form State
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [submittingOpening, setSubmittingOpening] = useState(false);

  // Closing Inputs State
  const [actualCashInput, setActualCashInput] = useState('');
  const [upiSettlementInput, setUpiSettlementInput] = useState('');
  const [cardSettlementInput, setCardSettlementInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [submittingClosing, setSubmittingClosing] = useState(false);

  // Settlement Modals
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [submittingSettlement, setSubmittingSettlement] = useState(false);

  useEffect(() => {
    loadReconciliation();
  }, [businessDate]);

  const loadReconciliation = async () => {
    setLoading(true);
    try {
      const res = await api.getReconciliationPreview(businessDate);
      const data = res.reconciliation;
      setReconData(data);
      if (data) {
        if (data.closing?.actualCash !== undefined && data.closing?.actualCash !== null) {
          setActualCashInput(String(data.closing.actualCash));
        } else if (data.closing?.actual_cash !== undefined && data.closing?.actual_cash !== null) {
          setActualCashInput(String(data.closing.actual_cash));
        }
        if (data.upiSettlement?.settlementAmount || data.upiSettlement?.settlement_amount) {
          setUpiSettlementInput(String(data.upiSettlement.settlementAmount || data.upiSettlement.settlement_amount));
        }
        if (data.cardSettlement?.settlementAmount || data.cardSettlement?.settlement_amount) {
          setCardSettlementInput(String(data.cardSettlement.settlementAmount || data.cardSettlement.settlement_amount));
        }
        if (data.closing?.notes) {
          setNotesInput(data.closing.notes);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load reconciliation preview', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetOpeningCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingCashInput || parseFloat(openingCashInput) < 0) {
      showToast('Please enter a valid opening cash amount', 'warning');
      return;
    }

    setSubmittingOpening(true);
    try {
      await api.setOpeningCash({
        businessDate,
        openingCash: parseFloat(openingCashInput)
      });
      showToast('Cash opening recorded successfully!', 'success');
      loadReconciliation();
    } catch (err: any) {
      showToast(err.message || 'Failed to record opening cash', 'error');
    } finally {
      setSubmittingOpening(false);
    }
  };

  const handleRecordSettlement = async (method: 'UPI' | 'CARD') => {
    if (!settlementAmount || parseFloat(settlementAmount) < 0) {
      showToast('Please enter a valid settlement amount', 'warning');
      return;
    }

    setSubmittingSettlement(true);
    try {
      await api.recordSettlement({
        businessDate,
        method,
        settlementAmount: parseFloat(settlementAmount),
        notes: settlementNotes
      });
      showToast(`${method} settlement recorded successfully!`, 'success');
      setShowUpiModal(false);
      setShowCardModal(false);
      setSettlementAmount('');
      setSettlementNotes('');
      loadReconciliation();
    } catch (err: any) {
      showToast(err.message || `Failed to record ${method} settlement`, 'error');
    } finally {
      setSubmittingSettlement(false);
    }
  };

  const handleFinalizeDailyClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualCashInput === '' || parseFloat(actualCashInput) < 0) {
      showToast('Please enter actual physical cash in register', 'warning');
      return;
    }

    setSubmittingClosing(true);
    try {
      await api.finalizeDailyClosing({
        businessDate,
        actualCash: parseFloat(actualCashInput),
        upiSettlementAmount: upiSettlementInput ? parseFloat(upiSettlementInput) : undefined,
        cardSettlementAmount: cardSettlementInput ? parseFloat(cardSettlementInput) : undefined,
        notes: notesInput
      });
      showToast('Daily Closing finalized and locked successfully!', 'success');
      loadReconciliation();
    } catch (err: any) {
      showToast(err.message || 'Failed to finalize daily closing', 'error');
    } finally {
      setSubmittingClosing(false);
    }
  };

  // Realtime Variance Calculation
  const openingVal = reconData?.opening?.opening_cash || reconData?.opening?.openingCash || 0;
  const cashSalesVal = reconData?.totalCashSales || reconData?.total_cash_sales || 0;
  const cashExpVal = reconData?.totalCashExpenses || reconData?.total_cash_expenses || 0;

  const expectedCash = Number(reconData?.expectedCash || reconData?.expected_closing_cash || (Number(openingVal) + Number(cashSalesVal) - Number(cashExpVal)));
  const actualCashNum = parseFloat(actualCashInput) || 0;
  const variance = actualCashNum - expectedCash;

  const isClosed = reconData?.closing?.isClosed || reconData?.closing?.status === 'CLOSED';

  const upiSalesVal = reconData?.totalUpiSales || reconData?.total_upi_sales || 0;
  const upiSettledVal = reconData?.upiSettlement?.settlementAmount || reconData?.upiSettlement?.settlement_amount || 0;

  const cardSalesVal = reconData?.totalCardSales || reconData?.total_card_sales || 0;
  const cardSettledVal = reconData?.cardSettlement?.settlementAmount || reconData?.cardSettlement?.settlement_amount || 0;

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight">Daily Closing & Reconciliation</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Reconcile cash drawer, digital payments, settlements, and variance</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Operating Date:</label>
          <Input
            type="date"
            value={businessDate}
            onChange={(e) => setBusinessDate(e.target.value)}
            className="w-auto font-semibold text-forest-800"
          />
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-slate-400 font-medium">Loading reconciliation state...</Card>
      ) : !reconData?.opening ? (
        /* STEP 1: OPENING CASH NOT SET */
        <Card className="max-w-xl mx-auto space-y-4 border-border p-8">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-forest-100 rounded-2xl flex items-center justify-center text-forest-800 mx-auto mb-2">
              <Key className="w-7 h-7" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-forest-800">Set Opening Cash Float</h2>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              No opening cash float has been recorded for <strong className="font-bold text-slate-800">{businessDate}</strong>.
              Please record the starting register float before performing sales and daily closing.
            </p>
          </div>
          <form onSubmit={handleSetOpeningCash} className="space-y-4 pt-2">
            <Input
              label="Opening Cash Float (₹) *"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 1000.00"
              value={openingCashInput}
              onChange={(e) => setOpeningCashInput(e.target.value)}
              required
            />
            <Button variant="primary" type="submit" fullWidth isLoading={submittingOpening}>
              Initialize Register Opening Cash
            </Button>
          </form>
        </Card>
      ) : (
        /* STEP 2: RECONCILIATION PREVIEW & CLOSING FORM */
        <div className="space-y-6">
          {/* Status Bar */}
          <Card className="flex flex-wrap justify-between items-center gap-4 border-border bg-white">
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-2xl ${isClosed ? 'bg-forest-100 text-forest-800' : 'bg-amber-50 text-amber-700'}`}>
                {isClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-sm font-bold text-forest-800">
                  Register Status: {isClosed ? 'CLOSED & LOCKED' : 'OPEN'}
                </p>
                <p className="text-xs text-slate-500 font-medium">Operating Date: {businessDate}</p>
              </div>
            </div>
            {isClosed ? (
              <Badge variant="success">Finalized & Locked</Badge>
            ) : (
              <Badge variant="warning">In Progress</Badge>
            )}
          </Card>

          {/* Cash Drawer Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card hoverable className="border-border">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Opening Float</p>
              <p className="text-xl font-extrabold text-forest-800 mt-1">
                {formatINR(openingVal)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Recorded at day start</p>
            </Card>

            <Card hoverable className="border-border">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Cash Sales (+)</p>
              <p className="text-xl font-extrabold text-emerald-700 mt-1">
                +{formatINR(cashSalesVal)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">From completed cash bills</p>
            </Card>

            <Card hoverable className="border-border">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Cash Expenses (-)</p>
              <p className="text-xl font-extrabold text-rose-600 mt-1">
                -{formatINR(cashExpVal)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Paid out from register</p>
            </Card>

            <Card hoverable className="border-forest-800/30 bg-gradient-to-br from-white via-white to-forest-100/40">
              <p className="text-xs text-forest-800 font-bold uppercase tracking-wider">Expected Register Cash</p>
              <p className="text-xl font-extrabold text-forest-800 mt-1">
                {formatINR(expectedCash)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Float + Sales - Expenses</p>
            </Card>
          </div>

          {/* Non-Cash Payment Methods & Settlements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="space-y-3.5 border-border">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-forest-800 text-base">UPI Payments & Settlement</h3>
                  <p className="text-xs text-slate-500 font-medium">Total UPI collected today</p>
                </div>
                <div className="p-2.5 bg-sky-50 text-sky-700 rounded-2xl">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-border-subtle">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Sales:</span>
                <span className="text-lg font-extrabold text-slate-800">
                  {formatINR(upiSalesVal)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Settled Amount:</span>
                <span className="text-sm font-bold text-emerald-700">
                  {formatINR(upiSettledVal)}
                </span>
              </div>
              {!isClosed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSettlementAmount(String(upiSalesVal));
                    setShowUpiModal(true);
                  }}
                  className="w-full justify-center mt-2"
                >
                  Record UPI Settlement
                </Button>
              )}
            </Card>

            <Card className="space-y-3.5 border-border">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-forest-800 text-base">Card Payments & Settlement</h3>
                  <p className="text-xs text-slate-500 font-medium">Total Card machine sales today</p>
                </div>
                <div className="p-2.5 bg-purple-50 text-purple-700 rounded-2xl">
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-border-subtle">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Sales:</span>
                <span className="text-lg font-extrabold text-slate-800">
                  {formatINR(cardSalesVal)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Settled Amount:</span>
                <span className="text-sm font-bold text-emerald-700">
                  {formatINR(cardSettledVal)}
                </span>
              </div>
              {!isClosed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSettlementAmount(String(cardSalesVal));
                    setShowCardModal(true);
                  }}
                  className="w-full justify-center mt-2"
                >
                  Record Card Settlement
                </Button>
              )}
            </Card>
          </div>

          {/* Daily Closing Form & Realtime Variance */}
          <Card className="space-y-4 border-border">
            <h2 className="text-lg font-bold text-forest-800 border-b border-border pb-3">
              Finalize Register Physical Count
            </h2>

            <form onSubmit={handleFinalizeDailyClosing} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Actual Physical Cash in Drawer (₹) *"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 1400.00"
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  disabled={isClosed}
                  required
                />
                <Input
                  label="UPI Settlement Amount (₹)"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 300.00"
                  value={upiSettlementInput}
                  onChange={(e) => setUpiSettlementInput(e.target.value)}
                  disabled={isClosed}
                />
                <Input
                  label="Card Settlement Amount (₹)"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 0.00"
                  value={cardSettlementInput}
                  onChange={(e) => setCardSettlementInput(e.target.value)}
                  disabled={isClosed}
                />
              </div>

              {/* Realtime Cash Variance Display */}
              <div className="p-4 bg-cream-50 border border-border rounded-2xl flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-700 font-bold uppercase tracking-wider">Calculated Cash Variance</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Actual Cash ({formatINR(actualCashNum)}) - Expected Cash ({formatINR(expectedCash)})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {actualCashInput === '' ? (
                    <Badge variant="neutral">Enter Actual Cash</Badge>
                  ) : Math.abs(variance) < 0.01 ? (
                    <Badge variant="success">MATCHED (₹0.00)</Badge>
                  ) : variance > 0 ? (
                    <Badge variant="info">EXCESS (+{formatINR(variance)})</Badge>
                  ) : (
                    <Badge variant="danger">SHORTAGE ({formatINR(variance)})</Badge>
                  )}
                </div>
              </div>

              <Input
                label="Closing Remarks / Notes"
                placeholder="e.g. Handed over cash float to owner, no discrepancies"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                disabled={isClosed}
              />

              {!isClosed && (
                <Button
                  variant="primary"
                  type="submit"
                  size="lg"
                  isLoading={submittingClosing}
                  className="w-full shadow-md justify-center bg-forest-800 hover:bg-forest-900 text-white rounded-xl py-3.5 font-bold"
                  icon={<Lock className="w-4 h-4" />}
                >
                  Lock & Finalize Daily Closing
                </Button>
              )}
            </form>
          </Card>
        </div>
      )}

      {/* UPI SETTLEMENT MODAL */}
      <Modal
        isOpen={showUpiModal}
        onClose={() => setShowUpiModal(false)}
        title="Record UPI Settlement"
      >
        <div className="space-y-4">
          <Input
            label="Settlement Amount (₹) *"
            type="number"
            value={settlementAmount}
            onChange={(e) => setSettlementAmount(e.target.value)}
          />
          <Input
            label="Notes"
            placeholder="e.g. Bank settlement ref #12345"
            value={settlementNotes}
            onChange={(e) => setSettlementNotes(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowUpiModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={submittingSettlement}
              onClick={() => handleRecordSettlement('UPI')}
            >
              Save Settlement
            </Button>
          </div>
        </div>
      </Modal>

      {/* CARD SETTLEMENT MODAL */}
      <Modal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        title="Record Card Settlement"
      >
        <div className="space-y-4">
          <Input
            label="Settlement Amount (₹) *"
            type="number"
            value={settlementAmount}
            onChange={(e) => setSettlementAmount(e.target.value)}
          />
          <Input
            label="Notes"
            placeholder="e.g. POS machine batch settlement #987"
            value={settlementNotes}
            onChange={(e) => setSettlementNotes(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCardModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={submittingSettlement}
              onClick={() => handleRecordSettlement('CARD')}
            >
              Save Settlement
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
