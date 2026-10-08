'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { formatINR } from '@/lib/format';
import { Wallet, Smartphone, CreditCard } from 'lucide-react';

interface PaymentSplitCardProps {
  splits: {
    CASH: string;
    UPI: string;
    CARD: string;
  };
}

export const PaymentSplitCard: React.FC<PaymentSplitCardProps> = ({ splits }) => {
  const cash = Number(splits.CASH) || 0;
  const upi = Number(splits.UPI) || 0;
  const card = Number(splits.CARD) || 0;
  const total = cash + upi + card;

  const cashPct = total > 0 ? ((cash / total) * 100).toFixed(1) : '0.0';
  const upiPct = total > 0 ? ((upi / total) * 100).toFixed(1) : '0.0';
  const cardPct = total > 0 ? ((card / total) * 100).toFixed(1) : '0.0';

  return (
    <Card className="p-5 sm:p-6 border-border bg-white shadow-2xs font-sans space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
        <div>
          <h3 className="font-serif text-lg font-bold text-forest-800 tracking-tight">
            Payment Channel Splits
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Cash, UPI & Card settlements for completed orders
          </p>
        </div>
        <span className="text-xs font-bold text-forest-800 bg-cream-100 px-2.5 py-1 rounded-xl">
          Total: {formatINR(total)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Cash */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
            <span className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-700" /> Cash
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">{cashPct}%</span>
          </div>
          <div className="font-serif text-xl font-bold text-emerald-950">
            {formatINR(splits.CASH)}
          </div>
          <div className="w-full bg-emerald-200/60 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${cashPct}%` }} />
          </div>
        </div>

        {/* UPI */}
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900">
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-amber-700" /> UPI
            </span>
            <span className="text-[11px] font-semibold text-amber-700">{upiPct}%</span>
          </div>
          <div className="font-serif text-xl font-bold text-amber-950">
            {formatINR(splits.UPI)}
          </div>
          <div className="w-full bg-amber-200/60 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-600 h-full rounded-full" style={{ width: `${upiPct}%` }} />
          </div>
        </div>

        {/* Card */}
        <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-blue-900">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-700" /> Card
            </span>
            <span className="text-[11px] font-semibold text-blue-700">{cardPct}%</span>
          </div>
          <div className="font-serif text-xl font-bold text-blue-950">
            {formatINR(splits.CARD)}
          </div>
          <div className="w-full bg-blue-200/60 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${cardPct}%` }} />
          </div>
        </div>
      </div>
    </Card>
  );
};
