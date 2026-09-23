'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { CategoryDTO, MenuItemDTO } from '@/lib/types';
import { formatINR } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Plus, Search, Layers, UtensilsCrossed, Archive, RotateCcw } from 'lucide-react';

export default function MenuManagementPage() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'ITEMS' | 'CATEGORIES'>('ITEMS');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data State
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [items, setItems] = useState<MenuItemDTO[]>([]);

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategoryId, setNewItemCategoryId] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [submittingItem, setSubmittingItem] = useState(false);

  const [newCatName, setNewCatName] = useState('');
  const [newCatOrder, setNewCatOrder] = useState('0');
  const [submittingCat, setSubmittingCat] = useState(false);

  useEffect(() => {
    loadData();
  }, [includeArchived]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [catRes, itemRes] = await Promise.all([
        api.listCategories(includeArchived),
        api.listMenuItems(includeArchived)
      ]);
      setCategories(catRes.categories || []);
      setItems(itemRes.items || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load menu data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered Menu Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const catId = item.category_id || item.categoryId;
      const matchesCat = selectedCategoryFilter === 'ALL' || catId === selectedCategoryFilter;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [items, selectedCategoryFilter, searchQuery]);

  // Handlers for Items
  const handleToggleAvailability = async (item: MenuItemDTO) => {
    const isAvail = item.is_available ?? item.isAvailable ?? true;
    try {
      const updated = await api.toggleMenuItemAvailability(item.id, !isAvail);
      setItems(prev => prev.map(i => (i.id === item.id ? updated.item : i)));
      showToast(`${item.name} is now ${!isAvail ? 'Available' : 'Out of Stock'}`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to update item availability', 'error');
    }
  };

  const handleArchiveItem = async (id: string) => {
    try {
      await api.archiveMenuItem(id);
      showToast('Item archived successfully', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to archive item', 'error');
    }
  };

  const handleRestoreItem = async (id: string) => {
    try {
      await api.restoreMenuItem(id);
      showToast('Item restored successfully', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore item', 'error');
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemCategoryId || !newItemPrice) {
      showToast('Please fill all required fields', 'warning');
      return;
    }

    setSubmittingItem(true);
    try {
      await api.createMenuItem({
        name: newItemName,
        categoryId: newItemCategoryId,
        sellingPrice: parseFloat(newItemPrice)
      });
      showToast('Menu item created successfully!', 'success');
      setShowItemModal(false);
      setNewItemName('');
      setNewItemPrice('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create menu item', 'error');
    } finally {
      setSubmittingItem(false);
    }
  };

  // Handlers for Categories
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) {
      showToast('Category name is required', 'warning');
      return;
    }

    setSubmittingCat(true);
    try {
      await api.createCategory(newCatName, parseInt(newCatOrder) || 0);
      showToast('Category created successfully!', 'success');
      setShowCategoryModal(false);
      setNewCatName('');
      setNewCatOrder('0');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create category', 'error');
    } finally {
      setSubmittingCat(false);
    }
  };

  const handleArchiveCategory = async (id: string) => {
    try {
      await api.archiveCategory(id);
      showToast('Category archived successfully', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to archive category', 'error');
    }
  };

  const handleRestoreCategory = async (id: string) => {
    try {
      await api.restoreCategory(id);
      showToast('Category restored successfully', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore category', 'error');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest-800 tracking-tight">Menu & Catalog Management</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Manage categories, menu items, prices, and stock availability</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'ITEMS' ? (
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                if (categories.length === 0) {
                  showToast('Create a category first before adding menu items', 'warning');
                  return;
                }
                if (!newItemCategoryId && categories.length > 0) {
                  setNewItemCategoryId(categories[0].id);
                }
                setShowItemModal(true);
              }}
            >
              Add Menu Item
            </Button>
          ) : (
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCategoryModal(true)}>
              Add Category
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs & Global Filters */}
      <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-border">
        <div className="flex gap-2 bg-cream-50 p-1.5 rounded-2xl border border-border">
          <button
            onClick={() => setActiveTab('ITEMS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
              activeTab === 'ITEMS'
                ? 'bg-forest-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Menu Items ({items.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('CATEGORIES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
              activeTab === 'CATEGORIES'
                ? 'bg-forest-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Categories ({categories.length})</span>
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="w-4 h-4 rounded border-border text-forest-800 focus:ring-forest-800/20"
          />
          <span>Show Archived Records</span>
        </label>
      </Card>

      {/* TAB 1: MENU ITEMS */}
      {activeTab === 'ITEMS' && (
        <div className="space-y-4">
          {/* Item Search & Category Filter */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Input
                placeholder="Search items by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>
            <Select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              options={[
                { label: 'All Categories', value: 'ALL' },
                ...categories.map(c => ({ label: c.name, value: c.id }))
              ]}
            />
          </div>

          {/* Items Table */}
          <Card className="p-0 overflow-hidden border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-cream-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4 text-right">Selling Price</th>
                    <th className="p-4 text-center">Availability</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Loading menu items...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No menu items found
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isAvail = item.is_available ?? item.isAvailable ?? true;
                      const isArch = item.is_archived ?? item.isArchived ?? false;
                      const catName = item.category_name || item.categoryName;
                      const price = item.selling_price || item.sellingPrice;

                      return (
                        <tr key={item.id} className="hover:bg-cream-50/50 transition-colors">
                          <td className="p-4 font-bold text-slate-800">{item.name}</td>
                          <td className="p-4 text-slate-500 font-medium">{catName || 'General'}</td>
                          <td className="p-4 text-right font-extrabold text-forest-800">
                            {formatINR(price)}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleToggleAvailability(item)}
                              disabled={isArch}
                              className={`px-3 py-1 rounded-full text-xs font-bold transition-all min-h-[36px] ${
                                isAvail
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              }`}
                            >
                              {isAvail ? 'In Stock' : 'Out of Stock'}
                            </button>
                          </td>
                          <td className="p-4 text-center">
                            {isArch ? (
                              <Badge variant="danger">Archived</Badge>
                            ) : (
                              <Badge variant="success">Active</Badge>
                            )}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {isArch ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRestoreItem(item.id)}
                                icon={<RotateCcw className="w-3.5 h-3.5" />}
                              >
                                Restore
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-600 hover:text-rose-700"
                                onClick={() => handleArchiveItem(item.id)}
                                icon={<Archive className="w-3.5 h-3.5" />}
                              >
                                Archive
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
        </div>
      )}

      {/* TAB 2: CATEGORIES */}
      {activeTab === 'CATEGORIES' && (
        <Card className="p-0 overflow-hidden border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-cream-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="p-4">Category Name</th>
                  <th className="p-4 text-center">Display Order</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      Loading categories...
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      No categories found
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => {
                    const isArch = cat.is_archived ?? cat.isArchived ?? false;
                    const dispOrder = cat.display_order ?? cat.displayOrder ?? 0;
                    return (
                      <tr key={cat.id} className="hover:bg-cream-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{cat.name}</td>
                        <td className="p-4 text-center text-slate-500 font-medium">{dispOrder}</td>
                        <td className="p-4 text-center">
                          {isArch ? (
                            <Badge variant="danger">Archived</Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {isArch ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestoreCategory(cat.id)}
                              icon={<RotateCcw className="w-3.5 h-3.5" />}
                            >
                              Restore
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:text-rose-700"
                              onClick={() => handleArchiveCategory(cat.id)}
                              icon={<Archive className="w-3.5 h-3.5" />}
                            >
                              Archive
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
      )}

      {/* CREATE ITEM MODAL */}
      <Modal
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        title="Add New Menu Item"
      >
        <form onSubmit={handleCreateItem} className="space-y-4">
          <Input
            label="Item Name *"
            placeholder="e.g. Masala Chai, Paneer Tikka"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            required
          />
          <Select
            label="Category *"
            value={newItemCategoryId}
            onChange={(e) => setNewItemCategoryId(e.target.value)}
            options={categories.map(c => ({ label: c.name, value: c.id }))}
            required
          />
          <Input
            label="Selling Price (₹) *"
            type="number"
            min="0"
            step="0.5"
            placeholder="e.g. 150.00"
            value={newItemPrice}
            onChange={(e) => setNewItemPrice(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setShowItemModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submittingItem}>
              Create Item
            </Button>
          </div>
        </form>
      </Modal>

      {/* CREATE CATEGORY MODAL */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Add New Category"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <Input
            label="Category Name *"
            placeholder="e.g. Beverages, Starters, Desserts"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            required
          />
          <Input
            label="Display Order"
            type="number"
            placeholder="0"
            value={newCatOrder}
            onChange={(e) => setNewCatOrder(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setShowCategoryModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submittingCat}>
              Create Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
