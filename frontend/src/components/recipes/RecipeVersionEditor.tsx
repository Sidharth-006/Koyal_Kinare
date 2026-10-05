import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  InventoryItemDTO,
  RecipeVersionDetailDTO,
  CreateDraftIngredientInput,
  CreateDraftPayload,
  UpdateDraftPayload
} from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastContext';
import { Plus, Trash2, AlertCircle, Save, Info } from 'lucide-react';

interface IngredientRowState {
  id?: string;
  inventoryItemId: string;
  quantity: string;
  wastageAllowancePct: string;
  note: string;
  baseUnit: string;
}

interface RecipeVersionEditorProps {
  menuItemId: string;
  existingDraft?: RecipeVersionDetailDTO | null;
  onSuccess: () => void;
  onCancel?: () => void;
}

export const RecipeVersionEditor: React.FC<RecipeVersionEditorProps> = ({
  menuItemId,
  existingDraft,
  onSuccess,
  onCancel
}) => {
  const { showToast } = useToast();
  const isEditing = Boolean(existingDraft);

  // Available inventory items
  const [inventoryItems, setInventoryItems] = useState<InventoryItemDTO[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Draft form state
  const [ingredients, setIngredients] = useState<IngredientRowState[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clientErrors, setClientErrors] = useState<string[]>([]);

  // Load active inventory items
  useEffect(() => {
    let isMounted = true;
    async function fetchInventory() {
      try {
        setLoadingItems(true);
        // Only active inventory items
        const res = await api.listInventoryItems({ status: 'active', pageSize: 100 });
        if (isMounted) {
          setInventoryItems(res.items || []);
        }
      } catch (err: any) {
        if (isMounted) {
          showToast(err.message || 'Failed to load inventory items.', 'error');
        }
      } finally {
        if (isMounted) {
          setLoadingItems(false);
        }
      }
    }
    fetchInventory();
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize form with existing draft data or an empty row
  useEffect(() => {
    if (existingDraft && existingDraft.ingredients) {
      setIngredients(
        existingDraft.ingredients.map((ing) => ({
          id: ing.id,
          inventoryItemId: ing.inventoryItemId,
          quantity: String(ing.quantity),
          wastageAllowancePct: String(ing.wastageAllowancePct || '0'),
          note: ing.note || '',
          baseUnit: ing.unit || ''
        }))
      );
      setNote(existingDraft.note || '');
    } else {
      // Start with one empty row
      setIngredients([
        {
          inventoryItemId: '',
          quantity: '',
          wastageAllowancePct: '0',
          note: '',
          baseUnit: ''
        }
      ]);
      setNote('');
    }
  }, [existingDraft]);

  // Handle inventory item selection
  const handleItemSelect = (index: number, itemId: string) => {
    const selectedItem = inventoryItems.find((i) => i.id === itemId);
    const unit = selectedItem?.base_unit || selectedItem?.baseUnit || '';

    setIngredients((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              inventoryItemId: itemId,
              baseUnit: unit
            }
          : row
      )
    );
  };

  const handleRowChange = (index: number, field: keyof IngredientRowState, value: string) => {
    setIngredients((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRow = () => {
    setIngredients((prev) => [
      ...prev,
      {
        inventoryItemId: '',
        quantity: '',
        wastageAllowancePct: '0',
        note: '',
        baseUnit: ''
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (ingredients.length <= 1) {
      showToast('A recipe version must have at least one ingredient row.', 'warning');
      return;
    }
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  // Duplicate detection
  const selectedItemIds = ingredients.map((i) => i.inventoryItemId).filter(Boolean);
  const duplicateIds = selectedItemIds.filter((id, idx) => selectedItemIds.indexOf(id) !== idx);
  const hasDuplicates = duplicateIds.length > 0;

  // Validation
  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (ingredients.length === 0) {
      errors.push('At least one ingredient is required.');
    }

    // Check unselected items
    const hasUnselected = ingredients.some((ing) => !ing.inventoryItemId);
    if (hasUnselected) {
      errors.push('Please select an inventory item for every ingredient row.');
    }

    // Check duplicate ingredients
    if (hasDuplicates) {
      errors.push('Duplicate inventory items detected. Each ingredient can only be added once.');
    }

    // Check quantities
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      const qtyNum = parseFloat(ing.quantity);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        errors.push(`Row ${i + 1}: Quantity must be greater than 0.`);
      }

      const wastageNum = parseFloat(ing.wastageAllowancePct);
      if (!isNaN(wastageNum) && (wastageNum < 0 || wastageNum > 100)) {
        errors.push(`Row ${i + 1}: Wastage allowance must be between 0% and 100%.`);
      }

      if (ing.note && ing.note.length > 255) {
        errors.push(`Row ${i + 1}: Note cannot exceed 255 characters.`);
      }
    }

    if (note && note.length > 500) {
      errors.push('Version note cannot exceed 500 characters.');
    }

    setClientErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast('Please fix the validation errors before saving.', 'warning');
      return;
    }

    setSubmitting(true);
    setClientErrors([]);

    // Strict contract: ONLY send inventoryItemId, quantity, wastageAllowancePct, note
    // DO NOT send itemNameSnapshot or unitSnapshot
    const payloadIngredients: CreateDraftIngredientInput[] = ingredients.map((ing) => ({
      inventoryItemId: ing.inventoryItemId,
      quantity: parseFloat(ing.quantity),
      wastageAllowancePct: ing.wastageAllowancePct ? parseFloat(ing.wastageAllowancePct) : 0,
      note: ing.note?.trim() || undefined
    }));

    const cleanPayload: CreateDraftPayload | UpdateDraftPayload = {
      ingredients: payloadIngredients,
      note: note.trim() || undefined
    };

    try {
      if (isEditing && existingDraft) {
        await api.updateRecipeDraft(existingDraft.id, cleanPayload);
        showToast('Draft recipe version updated successfully!', 'success');
      } else {
        await api.createRecipeDraft(menuItemId, cleanPayload);
        showToast('New draft recipe version created successfully!', 'success');
      }
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Failed to save recipe draft.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="recipe-version-editor">
      {/* Informational banner: stock deduction notice */}
      <div className="flex items-center gap-2 p-3 bg-cream-100/70 border border-border rounded-xl text-slate-700 text-xs">
        <Info className="w-4 h-4 text-forest-700 shrink-0" />
        <span>
          Recipe quantities are defined per menu item unit. <em>Automatic stock consumption is recorded in Phase 3 Module 3 during POS sales.</em>
        </span>
      </div>

      {/* Validation Errors Box */}
      {clientErrors.length > 0 && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1" data-testid="client-errors-box">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            Please address the following errors:
          </p>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            {clientErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Ingredients Line Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border">
          <h4 className="text-xs font-bold text-forest-800 uppercase tracking-wider">
            Recipe Ingredients ({ingredients.length})
          </h4>
          <span className="text-[11px] text-slate-500 font-medium">Quantities in item base unit</span>
        </div>

        <div className="space-y-3">
          {ingredients.map((row, index) => {
            const isRowDuplicate =
              row.inventoryItemId &&
              selectedItemIds.filter((id) => id === row.inventoryItemId).length > 1;

            return (
              <div
                key={index}
                className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                  isRowDuplicate ? 'bg-rose-50/40 border-rose-300' : 'bg-white border-border'
                }`}
                data-testid={`ingredient-row-${index}`}
              >
                {/* Responsive row top: Selector & Base Unit */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                  {/* Inventory Item Selector */}
                  <div className="sm:col-span-6 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">
                      Inventory Item <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={row.inventoryItemId}
                      onChange={(e) => handleItemSelect(index, e.target.value)}
                      disabled={loadingItems || submitting}
                      className={`w-full text-xs p-2.5 rounded-lg border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-forest-800/20 min-h-[44px] ${
                        isRowDuplicate
                          ? 'border-rose-400 bg-rose-50/20 text-rose-900'
                          : 'border-border bg-white text-slate-800'
                      }`}
                      data-testid={`item-select-${index}`}
                    >
                      <option value="">-- Select Active Inventory Item --</option>
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.base_unit || item.baseUnit})
                        </option>
                      ))}
                    </select>
                    {isRowDuplicate && (
                      <p className="text-[11px] text-rose-600 font-semibold">
                        This item is already added to the draft.
                      </p>
                    )}
                  </div>

                  {/* Read-Only Base Unit */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Base Unit</label>
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={row.baseUnit || '—'}
                      className="w-full text-xs p-2.5 rounded-lg border border-border bg-slate-100 text-slate-600 font-bold text-center select-none min-h-[44px]"
                      data-testid={`base-unit-${index}`}
                      title="Read-only base unit resolved from inventory master"
                    />
                  </div>

                  {/* Quantity Input */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">
                      Quantity <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.0001"
                      value={row.quantity}
                      onChange={(e) => handleRowChange(index, 'quantity', e.target.value)}
                      placeholder="0.00"
                      disabled={submitting}
                      className="w-full text-xs p-2.5 rounded-lg border border-border bg-white text-slate-800 font-bold min-h-[44px] focus:outline-none focus:ring-2 focus:ring-forest-800/20"
                      data-testid={`quantity-input-${index}`}
                    />
                  </div>

                  {/* Wastage Allowance % */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Wastage %</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={row.wastageAllowancePct}
                      onChange={(e) => handleRowChange(index, 'wastageAllowancePct', e.target.value)}
                      placeholder="0"
                      disabled={submitting}
                      className="w-full text-xs p-2.5 rounded-lg border border-border bg-white text-slate-800 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-forest-800/20"
                      data-testid={`wastage-input-${index}`}
                    />
                  </div>
                </div>

                {/* Line note & Remove button */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    maxLength={255}
                    value={row.note}
                    onChange={(e) => handleRowChange(index, 'note', e.target.value)}
                    placeholder="Optional preparation note (e.g. finely chopped, chilled)..."
                    disabled={submitting}
                    className="flex-1 text-xs p-2 rounded-lg border border-border bg-cream-50/30 text-slate-700 min-h-[38px] focus:outline-none focus:ring-1 focus:ring-forest-800/30"
                    data-testid={`note-input-${index}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(index)}
                    disabled={submitting || ingredients.length <= 1}
                    className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors disabled:opacity-40"
                    title="Remove ingredient line"
                    aria-label={`Remove ingredient line ${index + 1}`}
                    data-testid={`remove-row-btn-${index}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add ingredient line button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleAddRow}
          disabled={submitting}
          className="min-h-[44px]"
          data-testid="add-ingredient-btn"
        >
          Add Another Ingredient
        </Button>
      </div>

      {/* Version Note */}
      <div className="space-y-1.5 pt-2 border-t border-border">
        <label className="block text-xs font-bold text-slate-700">
          Version Note (Optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional notes for this version (e.g. Summer special recipe adjustment, reduced sugar)..."
          rows={2}
          maxLength={500}
          disabled={submitting}
          className="w-full text-xs p-3 rounded-xl border border-border bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20"
          data-testid="version-note-input"
        />
        <div className="flex justify-end text-[11px] text-slate-400 font-mono">
          {note.length}/500
        </div>
      </div>

      {/* Submit / Cancel Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={submitting}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          icon={<Save className="w-4 h-4" />}
          isLoading={submitting}
          disabled={submitting || hasDuplicates}
          className="min-h-[44px]"
          data-testid="save-draft-btn"
        >
          {isEditing ? 'Save Draft Changes' : 'Create Draft Recipe'}
        </Button>
      </div>
    </form>
  );
};
