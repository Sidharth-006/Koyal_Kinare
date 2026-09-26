'use client';

import React from 'react';
import { InventoryItemDTO, PurchaseLineInput } from '@/lib/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatINR } from '@/lib/format';
import { Plus, Trash2, Package } from 'lucide-react';

export interface PurchaseLineEditorProps {
  lines: PurchaseLineInput[];
  inventoryItems: InventoryItemDTO[];
  onChange: (lines: PurchaseLineInput[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

export const PurchaseLineEditor: React.FC<PurchaseLineEditorProps> = ({
  lines,
  inventoryItems,
  onChange,
  disabled = false,
  errors = {}
}) => {
  const itemMap = React.useMemo(() => {
    const map = new Map<string, InventoryItemDTO>();
    for (const item of inventoryItems) {
      map.set(item.id, item);
    }
    return map;
  }, [inventoryItems]);

  const activeItemOptions = React.useMemo(() => {
    return [
      { label: 'Select item...', value: '' },
      ...inventoryItems
        .filter((item) => !item.isArchived && !item.is_archived)
        .map((item) => ({
          label: `${item.name} (${item.baseUnit || item.base_unit})`,
          value: item.id
        }))
    ];
  }, [inventoryItems]);

  const handleLineChange = (index: number, field: keyof PurchaseLineInput, value: any) => {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    onChange(updated);
  };

  const handleAddLine = () => {
    onChange([
      ...lines,
      {
        inventoryItemId: '',
        quantity: '1',
        unitRate: '0',
        lineDiscount: '0',
        taxRate: '0'
      }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    const updated = lines.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  const calculateLineSubtotal = (line: PurchaseLineInput): number => {
    const qty = parseFloat(String(line.quantity)) || 0;
    const rate = parseFloat(String(line.unitRate)) || 0;
    const discount = parseFloat(String(line.lineDiscount)) || 0;
    const tax = parseFloat(String(line.taxRate)) || 0;

    const base = Math.max(0, qty * rate - discount);
    return base + (base * tax) / 100;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Package className="w-4 h-4 text-forest-700" />
            Purchase Items
          </h3>
          <p className="text-xs text-slate-500">
            Select items, enter quantities and purchase rates. Line totals below are estimated previews.
          </p>
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddLine}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Line
          </Button>
        )}
      </div>

      {errors.lines && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
          {errors.lines}
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200 font-semibold">
            <tr>
              <th className="py-3 px-4 w-[28%]">Item</th>
              <th className="py-3 px-3 w-[18%]">Quantity & Unit</th>
              <th className="py-3 px-3 w-[16%]">Unit Rate (₹)</th>
              <th className="py-3 px-3 w-[14%]">Discount (₹)</th>
              <th className="py-3 px-3 w-[12%]">Tax (%)</th>
              <th className="py-3 px-3 w-[12%] text-right">Est. Total</th>
              {!disabled && <th className="py-3 px-2 w-[4%] text-center"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {lines.map((line, idx) => {
              const selectedItem = itemMap.get(line.inventoryItemId);
              const baseUnit = selectedItem?.baseUnit || selectedItem?.base_unit || 'unit';
              const estTotal = calculateLineSubtotal(line);
              const lineError = errors[`line_${idx}`];

              return (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <Select
                      options={activeItemOptions}
                      value={line.inventoryItemId}
                      disabled={disabled}
                      onChange={(e) => handleLineChange(idx, 'inventoryItemId', e.target.value)}
                      error={lineError && !line.inventoryItemId ? 'Item required' : undefined}
                    />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        value={line.quantity}
                        disabled={disabled}
                        onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                        placeholder="0.00"
                        className="w-24 text-right"
                      />
                      <Badge variant="neutral" className="shrink-0 font-mono text-[11px]">
                        {baseUnit}
                      </Badge>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={line.unitRate}
                      disabled={disabled}
                      onChange={(e) => handleLineChange(idx, 'unitRate', e.target.value)}
                      placeholder="0.00"
                      className="text-right"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={line.lineDiscount ?? '0'}
                      disabled={disabled}
                      onChange={(e) => handleLineChange(idx, 'lineDiscount', e.target.value)}
                      placeholder="0.00"
                      className="text-right"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={line.taxRate ?? '0'}
                      disabled={disabled}
                      onChange={(e) => handleLineChange(idx, 'taxRate', e.target.value)}
                      placeholder="0%"
                      className="text-right"
                    />
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-slate-800">
                    {formatINR(estTotal)}
                  </td>
                  {!disabled && (
                    <td className="py-3 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        disabled={lines.length <= 1}
                        title={lines.length <= 1 ? 'At least one line is required' : 'Remove line'}
                        className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card / Stack View */}
      <div className="md:hidden space-y-3">
        {lines.map((line, idx) => {
          const selectedItem = itemMap.get(line.inventoryItemId);
          const baseUnit = selectedItem?.baseUnit || selectedItem?.base_unit || 'unit';
          const estTotal = calculateLineSubtotal(line);

          return (
            <div
              key={idx}
              className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3 relative"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Line #{idx + 1}
                </span>
                {!disabled && lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Item</label>
                <Select
                  options={activeItemOptions}
                  value={line.inventoryItemId}
                  disabled={disabled}
                  onChange={(e) => handleLineChange(idx, 'inventoryItemId', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Qty ({baseUnit})
                  </label>
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    value={line.quantity}
                    disabled={disabled}
                    onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Rate (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={line.unitRate}
                    disabled={disabled}
                    onChange={(e) => handleLineChange(idx, 'unitRate', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Disc (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={line.lineDiscount ?? '0'}
                    disabled={disabled}
                    onChange={(e) => handleLineChange(idx, 'lineDiscount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tax (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={line.taxRate ?? '0'}
                    disabled={disabled}
                    onChange={(e) => handleLineChange(idx, 'taxRate', e.target.value)}
                    placeholder="0%"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Estimated Subtotal:</span>
                <span className="font-semibold text-slate-800">{formatINR(estTotal)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
