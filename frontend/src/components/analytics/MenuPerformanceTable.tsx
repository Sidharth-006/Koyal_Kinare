'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatINR } from '@/lib/format';
import { MenuPerformanceItem, MenuPerformanceSortKey, CompletenessStatus } from '@/lib/types';
import { Search, ArrowUpDown, Sparkles, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface MenuPerformanceTableProps {
  items: MenuPerformanceItem[];
  summary: {
    totalItems: number;
    itemsWithCostData: number;
    itemsWithoutCostData: number;
  };
  appliedSort: string;
  onSortChange: (sort: MenuPerformanceSortKey) => void;
  isLoading?: boolean;
}

const SORT_OPTIONS: Array<{ value: MenuPerformanceSortKey; label: string }> = [
  { value: 'revenue', label: 'Revenue (High to Low)' },
  { value: 'quantity', label: 'Quantity Sold (High to Low)' },
  { value: 'food_cost', label: 'Food Cost (High to Low)' },
  { value: 'gross_margin', label: 'Gross Margin ₹ (High to Low)' },
  { value: 'food_cost_percent', label: 'Food Cost % (High to Low)' }
];

export const MenuPerformanceTable: React.FC<MenuPerformanceTableProps> = ({
  items,
  summary,
  appliedSort,
  onSortChange,
  isLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (i) =>
        i.itemName.toLowerCase().includes(term) ||
        i.categoryName.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  const renderBadge = (status: CompletenessStatus) => {
    if (status === 'COMPLETE') {
      return (
        <Badge variant="success" className="text-[10px] px-2 py-0.5">
          Complete
        </Badge>
      );
    }
    if (status === 'PARTIAL') {
      return (
        <Badge variant="warning" className="text-[10px] px-2 py-0.5">
          Partial Cost
        </Badge>
      );
    }
    return (
      <Badge variant="danger" className="text-[10px] px-2 py-0.5">
        Missing Recipe
      </Badge>
    );
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Summary Chips & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-border shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
            Total Items Sold: <strong>{summary.totalItems}</strong>
          </span>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
            Costed: <strong>{summary.itemsWithCostData}</strong>
          </span>
          {summary.itemsWithoutCostData > 0 && (
            <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              Uncosted: <strong>{summary.itemsWithoutCostData}</strong>
            </span>
          )}
        </div>

        {/* Filter and Sort Controls */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search item or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs min-h-[38px] w-full"
            />
          </div>

          <div className="sm:w-56 shrink-0">
            <Select
              value={appliedSort}
              onChange={(e) => onSortChange(e.target.value as MenuPerformanceSortKey)}
              options={SORT_OPTIONS}
              className="text-xs min-h-[38px]"
            />
          </div>
        </div>
      </div>

      {/* Desktop / Tablet Data Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-border shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Menu Item & Category</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Revenue</th>
                <th className="py-3 px-4 text-right">Food Cost</th>
                <th className="py-3 px-4 text-right">Gross Margin</th>
                <th className="py-3 px-4 text-right">Margin %</th>
                <th className="py-3 px-4 text-right">Food Cost %</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 font-medium">
                    No menu items found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.menuItemId || `${item.itemName}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{item.itemName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">{item.categoryName}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-700">
                      {item.totalQuantity}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-forest-800">
                      {formatINR(item.totalRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {item.hasCostData && item.foodCost ? formatINR(item.foodCost) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {item.hasCostData && item.grossMargin ? formatINR(item.grossMargin) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                      {item.hasCostData && item.grossMarginPercent ? `${item.grossMarginPercent}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-amber-700">
                      {item.hasCostData && item.foodCostPercent ? `${item.foodCostPercent}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {renderBadge(item.completenessStatus)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List (<640px) */}
      <div className="sm:hidden space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-border text-slate-400 text-xs font-medium">
            No menu items found matching the selected criteria.
          </div>
        ) : (
          filteredItems.map((item, idx) => (
            <Card key={item.menuItemId || `${item.itemName}-${idx}`} className="p-4 border-border bg-white shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-800 leading-tight">{item.itemName}</h4>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">{item.categoryName}</span>
                </div>
                {renderBadge(item.completenessStatus)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/60">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity Sold</span>
                  <span className="font-semibold text-slate-700">{item.totalQuantity}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Revenue</span>
                  <span className="font-bold text-forest-800">{formatINR(item.totalRevenue)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Food Cost</span>
                  <span className="font-medium text-slate-700">{item.hasCostData && item.foodCost ? formatINR(item.foodCost) : '—'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Gross Margin</span>
                  <span className="font-medium text-slate-700">{item.hasCostData && item.grossMargin ? formatINR(item.grossMargin) : '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Food Cost %</span>
                  <span className="font-semibold text-amber-700">{item.hasCostData && item.foodCostPercent ? `${item.foodCostPercent}%` : '—'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Margin %</span>
                  <span className="font-semibold text-emerald-700">{item.hasCostData && item.grossMarginPercent ? `${item.grossMarginPercent}%` : '—'}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
