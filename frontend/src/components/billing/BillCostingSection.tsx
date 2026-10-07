'use client';

import React, { useState, useEffect } from 'react';
import { BillDTO, BillCostCoverageDTO, BillConsumptionDTO, InventoryItemDTO } from '@/lib/types';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, AlertTriangle, CheckCircle2, RotateCcw, Info, Layers } from 'lucide-react';

interface BillCostingSectionProps {
  bill: BillDTO;
}

export const BillCostingSection: React.FC<BillCostingSectionProps> = ({ bill }) => {
  const [inventoryItemsMap, setInventoryItemsMap] = useState<Record<string, { name: string; unit: string }>>({});
  const [loadingItems, setLoadingItems] = useState(false);

  const coverage: BillCostCoverageDTO | null = bill.cost_coverage || bill.costCoverage || null;
  const consumptions: BillConsumptionDTO[] = bill.consumptions || [];
  const isVoided = bill.status === 'VOIDED';

  // Load inventory items to resolve human-readable names and units using existing API
  useEffect(() => {
    let isMounted = true;
    if (consumptions.length > 0) {
      setLoadingItems(true);
      api.listInventoryItems({ pageSize: 100 })
        .then((res) => {
          if (!isMounted) return;
          const map: Record<string, { name: string; unit: string }> = {};
          (res.items || []).forEach((item: InventoryItemDTO) => {
            map[item.id] = {
              name: item.name,
              unit: item.baseUnit || item.base_unit || ''
            };
          });
          setInventoryItemsMap(map);
        })
        .catch(() => {
          // Graceful fallback: render IDs if item catalog resolution fails
        })
        .finally(() => {
          if (isMounted) setLoadingItems(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [consumptions.length]);

  const totalLines = coverage?.total_bill_lines ?? coverage?.totalBillLines ?? (bill.lines?.length || 0);
  const coveredLines = coverage?.covered_lines ?? coverage?.coveredLines ?? 0;
  const missingRecipeLines = coverage?.missing_recipe_lines ?? coverage?.missingRecipeLines ?? 0;
  const missingCostLines = coverage?.missing_cost_lines ?? coverage?.missingCostLines ?? 0;

  // Derive coverage state
  const isFullCoverage = coveredLines === totalLines && totalLines > 0 && missingRecipeLines === 0 && missingCostLines === 0;
  const hasMissingRecipe = missingRecipeLines > 0;
  const hasMissingCost = missingCostLines > 0;

  return (
    <Card className="space-y-5 bg-white border border-slate-200">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
            <Layers className="w-5 h-5 text-forest-800" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Costing & Stock Impact</h3>
            <p className="text-xs text-slate-500">
              Server-recorded inventory consumption snapshots and recipe coverage
            </p>
          </div>
        </div>

        {/* Coverage Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {coverage ? (
            <>
              {isFullCoverage && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Full Recipe Coverage ({coveredLines}/{totalLines} lines)
                </span>
              )}
              {hasMissingRecipe && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Recipe Missing ({missingRecipeLines} {missingRecipeLines === 1 ? 'line' : 'lines'})
                </span>
              )}
              {hasMissingCost && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Incomplete Cost Basis ({missingCostLines} {missingCostLines === 1 ? 'line' : 'lines'})
                </span>
              )}
              {!isFullCoverage && !hasMissingRecipe && !hasMissingCost && (
                <Badge variant="neutral">Partial Coverage ({coveredLines}/{totalLines} lines)</Badge>
              )}
            </>
          ) : (
            <Badge variant="neutral">No Costing Recorded</Badge>
          )}
        </div>
      </div>

      {/* Stock Reversal Notice if Bill is Voided */}
      {isVoided && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
          <RotateCcw className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Stock Reversal Applied (Bill Voided)</p>
            <p className="text-rose-700">
              The recipe ingredients recorded for this bill were returned to inventory stock via atomic compensating movements upon void. Cost basis was restored for costed lines.
            </p>
          </div>
        </div>
      )}

      {/* Data-Quality Warnings */}
      {hasMissingRecipe && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Data Quality Notice — Missing Recipe: </span>
            <span>
              {missingRecipeLines} line(s) on this bill had no active recipe configured at completion. No inventory consumption was recorded for those menu items.
            </span>
          </div>
        </div>
      )}

      {hasMissingCost && (
        <div className="p-3 bg-sky-50/80 border border-sky-200 rounded-xl flex items-start gap-2.5 text-xs text-sky-800">
          <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Data Quality Notice — Missing Cost Basis: </span>
            <span>
              {missingCostLines} line(s) consumed physical inventory without an established purchase cost basis. Physical stock was decremented, but unit/total cost snapshots are recorded as null.
            </span>
          </div>
        </div>
      )}

      {/* Coverage Line Counts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
        <div>
          <span className="text-slate-500 font-medium uppercase">Total Lines</span>
          <p className="text-sm font-bold text-slate-800 mt-0.5">{totalLines}</p>
        </div>
        <div>
          <span className="text-slate-500 font-medium uppercase">Covered Lines</span>
          <p className="text-sm font-bold text-emerald-700 mt-0.5">{coveredLines}</p>
        </div>
        <div>
          <span className="text-slate-500 font-medium uppercase">Missing Recipe</span>
          <p className="text-sm font-bold text-amber-700 mt-0.5">{missingRecipeLines}</p>
        </div>
        <div>
          <span className="text-slate-500 font-medium uppercase">Missing Cost</span>
          <p className="text-sm font-bold text-sky-700 mt-0.5">{missingCostLines}</p>
        </div>
      </div>

      {/* Ingredient Consumption Snapshot Table */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
            Ingredient Consumption Breakdown ({consumptions.length} items recorded)
          </h4>
          {loadingItems && (
            <span className="text-[11px] text-slate-400">Resolving ingredient names...</span>
          )}
        </div>

        {consumptions.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
            {missingRecipeLines > 0
              ? 'No recipe consumption records were created because items on this bill had no active recipes.'
              : 'No ingredient consumption recorded for this bill.'}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase">
                  <th className="p-3">Ingredient</th>
                  <th className="p-3 text-right">Quantity Consumed</th>
                  <th className="p-3 text-center">Unit</th>
                  <th className="p-3 text-right">Unit Cost Snapshot</th>
                  <th className="p-3 text-right">Total Cost Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {consumptions.map((item) => {
                  const itemId = item.inventory_item_id || item.inventoryItemId || '';
                  const itemInfo = inventoryItemsMap[itemId];
                  const itemName = itemInfo?.name || `Item (${itemId ? itemId.slice(0, 8) : 'Unknown'})`;
                  const itemUnit = itemInfo?.unit || '—';
                  const qty = item.quantity_consumed || item.quantityConsumed || '0';
                  const unitCost = item.unit_cost_snapshot ?? item.unitCostSnapshot;
                  const totalCost = item.total_cost_snapshot ?? item.totalCostSnapshot;

                  const isCostMissing = unitCost === null || unitCost === undefined;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-semibold text-slate-800">
                        {itemName}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        {qty}
                      </td>
                      <td className="p-3 text-center text-slate-500 font-medium">
                        {itemUnit}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {isCostMissing ? (
                          <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded text-[11px] font-medium border border-sky-200">
                            — (No Cost Basis)
                          </span>
                        ) : (
                          <span className="text-slate-800">{formatINR(unitCost)}</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold">
                        {isCostMissing ? (
                          <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded text-[11px] font-medium border border-sky-200">
                            — (No Cost Basis)
                          </span>
                        ) : (
                          <span className="text-forest-800">{formatINR(totalCost)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contract / Authoritative Costing Footnote */}
      <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p>
          Authoritative server snapshots are recorded atomically upon bill completion. Bill-level aggregate food cost and gross margin totals are not computed in the browser.
        </p>
      </div>
    </Card>
  );
};
