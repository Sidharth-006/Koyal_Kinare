'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { RecipeCoverageItemDTO, RecipeListParams } from '@/lib/types';
import { RecipeStatusBadge } from '@/components/recipes/RecipeStatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import {
  BookOpen,
  ChevronRight,
  RotateCcw,
  AlertCircle,
  FileQuestion
} from 'lucide-react';

type FilterTab = 'ALL' | 'ACTIVE' | 'MISSING' | 'INACTIVE';

export default function RecipeCoveragePage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [recipes, setRecipes] = useState<RecipeCoverageItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadRecipes = async (filterTab: FilterTab, targetPage: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params: RecipeListParams = { page: targetPage };
      if (filterTab === 'MISSING') {
        params.missingOnly = true;
      } else if (filterTab === 'ACTIVE') {
        params.status = 'ACTIVE';
      } else if (filterTab === 'INACTIVE') {
        params.status = 'INACTIVE';
      } else {
        params.status = 'ALL';
      }

      const res = await api.listRecipes(params);
      setRecipes(res.recipes || []);
      setPage(res.pagination?.page || 1);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch (err: any) {
      const msg = err.message || 'Failed to load recipe coverage data.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes(activeFilter, 1);
  }, [activeFilter]);

  const handleFilterChange = (tab: FilterTab) => {
    setActiveFilter(tab);
    setPage(1);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-forest-800 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-forest-700" />
            Recipe Management & Coverage
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Monitor recipe coverage across menu items, manage ingredient drafts, and activate versions
          </p>
        </div>
      </div>

      {/* Filter Tabs (Scope strict: All, Active Recipe, Missing Recipe, Inactive) */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-cream-50 rounded-2xl border border-border">
        <button
          type="button"
          onClick={() => handleFilterChange('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center justify-center ${
            activeFilter === 'ALL'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-cream-100/60'
          }`}
          data-testid="filter-all"
        >
          All
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange('ACTIVE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center justify-center ${
            activeFilter === 'ACTIVE'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-cream-100/60'
          }`}
          data-testid="filter-active"
        >
          Active Recipe
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange('MISSING')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center justify-center ${
            activeFilter === 'MISSING'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-cream-100/60'
          }`}
          data-testid="filter-missing"
        >
          Missing Recipe
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange('INACTIVE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center justify-center ${
            activeFilter === 'INACTIVE'
              ? 'bg-forest-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-cream-100/60'
          }`}
          data-testid="filter-inactive"
        >
          Inactive
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-3" data-testid="recipe-loading-skeleton">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center space-y-3 border-rose-200 bg-rose-50/40" data-testid="recipe-error-state">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <p className="font-bold text-slate-800 text-sm">{error}</p>
          <p className="text-xs text-slate-500">Could not retrieve recipe coverage records.</p>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => loadRecipes(activeFilter, page)}
              className="min-h-[44px]"
            >
              Retry
            </Button>
          </div>
        </Card>
      ) : recipes.length === 0 ? (
        <Card className="p-10 text-center space-y-3 border-border bg-white" data-testid="recipe-empty-state">
          <FileQuestion className="w-10 h-10 text-slate-400 mx-auto opacity-70" />
          <h3 className="font-bold text-slate-800 text-base">No Menu Items Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeFilter === 'MISSING'
              ? 'All menu items currently have active recipes configured.'
              : 'No items match the selected recipe filter.'}
          </p>
          {activeFilter !== 'ALL' && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFilterChange('ALL')}
                className="min-h-[44px]"
              >
                View All Items
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Desktop & Tablet Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-border bg-white shadow-2xs">
            <table className="w-full text-left border-collapse" data-testid="recipes-table">
              <thead>
                <tr className="border-b border-border bg-cream-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="p-4">Menu Item</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 text-center">Active Recipe</th>
                  <th className="p-4 text-center">Ingredients</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {recipes.map((row) => (
                  <tr
                    key={row.menuItemId}
                    onClick={() => router.push(`/menu/${row.menuItemId}/recipe`)}
                    className="hover:bg-cream-50/60 transition-colors cursor-pointer"
                    data-testid={`recipe-row-${row.menuItemId}`}
                  >
                    <td className="p-4 font-bold text-slate-900 text-sm">
                      {row.menuItemName}
                    </td>
                    <td className="p-4 text-slate-600 font-medium">
                      {row.categoryName || 'General'}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <RecipeStatusBadge
                          status={row.status}
                          hasActiveRecipe={row.hasActiveRecipe}
                        />
                        {row.hasActiveRecipe && row.activeVersionNumber && (
                          <span className="text-[11px] font-mono text-slate-500 font-semibold">
                            v{row.activeVersionNumber}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-slate-700">
                      {row.hasActiveRecipe ? row.ingredientCount : '—'}
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/menu/${row.menuItemId}/recipe`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-bold text-forest-800 hover:text-forest-900 hover:underline px-3 py-2 rounded-lg hover:bg-cream-100/70 min-h-[44px]"
                        data-testid={`manage-recipe-link-${row.menuItemId}`}
                      >
                        <span>{row.hasActiveRecipe ? 'View Recipe' : 'Configure Recipe'}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (< md breakpoint) */}
          <div className="md:hidden space-y-3" data-testid="recipes-mobile-list">
            {recipes.map((row) => (
              <div
                key={row.menuItemId}
                onClick={() => router.push(`/menu/${row.menuItemId}/recipe`)}
                className="p-4 bg-white rounded-2xl border border-border shadow-2xs space-y-3 active:bg-cream-50/50 transition-colors cursor-pointer"
                data-testid={`recipe-mobile-card-${row.menuItemId}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{row.menuItemName}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">{row.categoryName || 'General'}</p>
                  </div>
                  <RecipeStatusBadge
                    status={row.status}
                    hasActiveRecipe={row.hasActiveRecipe}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50 text-slate-600">
                  <div>
                    {row.hasActiveRecipe ? (
                      <span className="font-medium">
                        Active Version: <strong className="font-mono text-slate-800">v{row.activeVersionNumber}</strong> ({row.ingredientCount} items)
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium">No active recipe version</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-forest-800 font-bold text-xs min-h-[44px]">
                    <span>Manage</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 text-xs text-slate-500 border-t border-border">
              <span>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} items)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => loadRecipes(activeFilter, page - 1)}
                  className="min-h-[44px]"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => loadRecipes(activeFilter, page + 1)}
                  className="min-h-[44px]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
