'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  MenuItemRecipeResponseDTO,
  MenuItemDTO
} from '@/lib/types';
import { RecipeStatusBadge, VersionStatusBadge } from '@/components/recipes/RecipeStatusBadge';
import { RecipeVersionEditor } from '@/components/recipes/RecipeVersionEditor';
import { RecipeVersionHistory } from '@/components/recipes/RecipeVersionHistory';
import { ActivateRecipeModal } from '@/components/recipes/ActivateRecipeModal';
import { DeactivateRecipeModal } from '@/components/recipes/DeactivateRecipeModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import { formatDate } from '@/lib/format';
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  Plus,
  AlertTriangle,
  History,
  FileEdit,
  UtensilsCrossed,
  ShieldAlert
} from 'lucide-react';

export default function MenuItemRecipeClient() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const menuItemId = params?.id as string;

  // Recipe detail data state
  const [data, setData] = useState<MenuItemRecipeResponseDTO | null>(null);
  const [menuItem, setMenuItem] = useState<MenuItemDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor mode state
  const [showEditor, setShowEditor] = useState(false);

  // Modals state
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  const loadRecipeData = async () => {
    if (!menuItemId || menuItemId === 'placeholder') return;
    setLoading(true);
    setError(null);
    try {
      const [recipeRes, menuItemsRes] = await Promise.all([
        api.getMenuItemRecipe(menuItemId),
        api.listMenuItems(true)
      ]);
      setData(recipeRes);

      const foundItem = menuItemsRes.items?.find((i) => i.id === menuItemId) || null;
      setMenuItem(foundItem);

      // Auto-open editor if a draft already exists
      if (recipeRes.draftVersion) {
        setShowEditor(true);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to load recipe details.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipeData();
  }, [menuItemId]);

  const handleMutationSuccess = () => {
    loadRecipeData();
  };

  if (loading && menuItemId !== 'placeholder') {
    return (
      <div className="space-y-6 font-sans" data-testid="recipe-detail-loading">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-64 rounded-xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6 font-sans" data-testid="recipe-detail-error">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Recipe Coverage</span>
        </Link>
        <Card className="p-8 text-center space-y-3 border-rose-200 bg-rose-50/40">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">Unable to load recipe</h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">{error || 'Menu item recipe not found.'}</p>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={loadRecipeData}
              className="min-h-[44px]"
            >
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { recipe, activeVersion, draftVersion, versions } = data;
  const itemName = menuItem?.name || 'Menu Item';
  const categoryName = menuItem?.category_name || menuItem?.categoryName || 'General';
  const hasActive = Boolean(activeVersion && recipe?.status === 'ACTIVE');

  return (
    <div className="space-y-6 font-sans">
      {/* Breadcrumb / Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-2 text-xs font-bold text-forest-800 hover:text-forest-900 hover:underline min-h-[44px]"
          data-testid="back-to-recipes-link"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Recipe Coverage</span>
        </Link>
      </div>

      {/* Menu Item Header Card (Scope-safe: Item name, category, recipe status - NO selling price) */}
      <Card className="p-5 md:p-6 border-border bg-white space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-cream-100 text-forest-900 border border-border">
                {categoryName}
              </span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-forest-800 tracking-tight" data-testid="recipe-menu-item-name">
              {itemName}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <RecipeStatusBadge
              status={recipe?.status}
              hasActiveRecipe={hasActive}
            />
          </div>
        </div>

        {/* Status explanation strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            {hasActive ? (
              <span className="flex items-center gap-1.5 text-emerald-800 font-semibold" data-testid="active-version-info">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Active Version: <strong>Version {activeVersion?.versionNumber}</strong> ({activeVersion?.ingredients.length} ingredients)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-800 font-semibold" data-testid="missing-active-version-notice">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                No active recipe version is currently linked.
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            {recipe?.updatedAt ? `Last updated: ${formatDate(recipe.updatedAt)}` : ''}
          </div>
        </div>
      </Card>

      {/* SECTION 1: Active Recipe Card (when one exists) */}
      {activeVersion && (
        <Card className="p-5 md:p-6 border-emerald-200 bg-white space-y-4 shadow-2xs" data-testid="active-recipe-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-sm">
                    Active Recipe — Version {activeVersion.versionNumber}
                  </h3>
                  <VersionStatusBadge status={activeVersion.status} />
                </div>
                {activeVersion.effectiveFrom && (
                  <p className="text-[11px] text-slate-500 font-medium">
                    Effective since {formatDate(activeVersion.effectiveFrom)}
                  </p>
                )}
              </div>
            </div>

            {/* Deactivate button (if active) */}
            {recipe?.status === 'ACTIVE' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<ShieldAlert className="w-4 h-4 text-rose-600" />}
                onClick={() => setShowDeactivateModal(true)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 min-h-[44px]"
                data-testid="deactivate-recipe-btn"
              >
                Deactivate Recipe
              </Button>
            )}
          </div>

          {/* Active Ingredients Table */}
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full text-left border-collapse text-xs" data-testid="active-ingredients-table">
              <thead>
                <tr className="bg-cream-50/70 border-b border-border text-[11px] font-bold text-slate-600 uppercase">
                  <th className="p-3">Ingredient</th>
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3 text-center">Unit</th>
                  <th className="p-3 text-right">Wastage %</th>
                  <th className="p-3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {activeVersion.ingredients.map((ing) => (
                  <tr key={ing.id} className="hover:bg-cream-50/40">
                    <td className="p-3 font-semibold text-slate-800">{ing.itemName}</td>
                    <td className="p-3 text-right font-mono font-bold text-forest-800">{ing.quantity}</td>
                    <td className="p-3 text-center font-mono text-slate-600">{ing.unit}</td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {parseFloat(ing.wastageAllowancePct) > 0 ? `${ing.wastageAllowancePct}%` : '0%'}
                    </td>
                    <td className="p-3 text-slate-500 italic">{ing.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activeVersion.note && (
            <p className="text-xs text-slate-600 italic bg-cream-50/50 p-2.5 rounded-lg border border-border/50">
              <strong>Version Note:</strong> {activeVersion.note}
            </p>
          )}
        </Card>
      )}

      {/* SECTION 2: Draft Recipe / Editor Section */}
      <Card className="p-5 md:p-6 border-border bg-white space-y-4 shadow-2xs" data-testid="draft-section-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <FileEdit className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm">
                  {draftVersion ? `Recipe Draft — Version ${draftVersion.versionNumber}` : 'Recipe Draft'}
                </h3>
                {draftVersion && <VersionStatusBadge status="DRAFT" />}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {draftVersion
                  ? 'Unpublished draft version ready for modification or activation'
                  : 'Prepare and stage a new recipe version before activating'}
              </p>
            </div>
          </div>

          {/* Header Action: Activate Draft or Create Draft */}
          {draftVersion ? (
            <Button
              type="button"
              variant="primary"
              icon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => setShowActivateModal(true)}
              className="min-h-[44px]"
              data-testid="activate-draft-btn"
            >
              Activate Draft (v{draftVersion.versionNumber})
            </Button>
          ) : !showEditor ? (
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowEditor(true)}
              className="min-h-[44px]"
              data-testid="create-draft-btn"
            >
              Create Draft Version
            </Button>
          ) : null}
        </div>

        {/* Editor Form */}
        {showEditor ? (
          <RecipeVersionEditor
            menuItemId={menuItemId}
            existingDraft={draftVersion}
            onSuccess={() => {
              loadRecipeData();
            }}
            onCancel={draftVersion ? undefined : () => setShowEditor(false)}
          />
        ) : (
          <div className="p-8 text-center bg-cream-50/50 rounded-2xl border border-dashed border-border space-y-2 text-xs text-slate-500">
            <UtensilsCrossed className="w-8 h-8 text-slate-400 mx-auto opacity-70" />
            <p className="font-bold text-slate-700">No active draft in progress</p>
            <p className="text-slate-400 max-w-sm mx-auto">
              Click &quot;Create Draft Version&quot; to configure ingredients, quantities, and wastage allowances for this menu item.
            </p>
          </div>
        )}
      </Card>

      {/* SECTION 3: Version History / Timeline */}
      <Card className="p-5 md:p-6 border-border bg-white space-y-4 shadow-2xs">
        <div className="flex items-center gap-2.5 pb-3 border-b border-border">
          <span className="p-2 bg-forest-100 text-forest-800 rounded-xl">
            <History className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Version History & Timeline</h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Historic record of all created, activated, superseded, and inactive versions
            </p>
          </div>
        </div>

        <RecipeVersionHistory
          versions={versions}
          activeVersionId={recipe?.activeVersionId || null}
        />
      </Card>

      {/* Activation Modal */}
      {draftVersion && (
        <ActivateRecipeModal
          isOpen={showActivateModal}
          onClose={() => setShowActivateModal(false)}
          versionId={draftVersion.id}
          versionNumber={draftVersion.versionNumber}
          menuItemName={itemName}
          onSuccess={handleMutationSuccess}
        />
      )}

      {/* Deactivation Modal */}
      {activeVersion && (
        <DeactivateRecipeModal
          isOpen={showDeactivateModal}
          onClose={() => setShowDeactivateModal(false)}
          versionId={activeVersion.id}
          versionNumber={activeVersion.versionNumber}
          menuItemName={itemName}
          onSuccess={handleMutationSuccess}
        />
      )}
    </div>
  );
}
