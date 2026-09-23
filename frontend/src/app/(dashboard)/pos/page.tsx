'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { CatalogDTO, MenuItemDTO, BillDTO } from '@/lib/types';
import { formatINR } from '@/lib/format';
import { useToast } from '@/components/ui/ToastContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Search, RefreshCw, ShoppingBag, Trash2, Printer, Plus, Minus, Check } from 'lucide-react';

interface CartItem {
  menuItem: MenuItemDTO;
  quantity: number;
}

export default function POSPage() {
  const { showToast } = useToast();

  const [catalog, setCatalog] = useState<CatalogDTO | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');

  // Checkout & Idempotency
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [completedBill, setCompletedBill] = useState<BillDTO | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Initialize Idempotency Key
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const data = await api.getCatalog();
      setCatalog(data.catalog);
    } catch (err: any) {
      showToast(err.message || 'Failed to load POS catalog', 'error');
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Category & Item filtering
  const filteredItems = useMemo(() => {
    if (!catalog?.items) return [];
    return catalog.items.filter(item => {
      const catId = item.category_id || item.categoryId;
      const matchesCategory = selectedCategory === 'ALL' || catId === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [catalog, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (item: MenuItemDTO) => {
    const isAvail = item.is_available ?? item.isAvailable ?? true;
    if (!isAvail) {
      showToast(`${item.name} is currently out of stock`, 'warning');
      return;
    }
    setCart(prev => {
      const existingIndex = prev.findIndex(ci => ci.menuItem.id === item.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(ci => {
        if (ci.menuItem.id === itemId) {
          const newQty = ci.quantity + delta;
          return newQty > 0 ? { ...ci, quantity: newQty } : null;
        }
        return ci;
      }).filter(Boolean) as CartItem[];
    });
  };

  const clearCart = () => {
    setCart([]);
    setDiscountInput('0');
    setSelectedTableId('');
  };

  // Calculations (Client preview)
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = Number(item.menuItem.selling_price || item.menuItem.sellingPrice || 0);
      return sum + price * item.quantity;
    }, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const d = parseFloat(discountInput) || 0;
    return Math.min(Math.max(0, d), cartSubtotal);
  }, [discountInput, cartSubtotal]);

  const previewTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - discountAmount);
  }, [cartSubtotal, discountAmount]);

  // Checkout submission
  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty', 'warning');
      return;
    }

    if (orderType === 'DINE_IN' && !selectedTableId) {
      showToast('Please select a table for Dine-in orders', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const keyToUse = idempotencyKey || crypto.randomUUID();
      if (!idempotencyKey) setIdempotencyKey(keyToUse);

      const payload = {
        orderType,
        tableId: orderType === 'DINE_IN' ? selectedTableId : null,
        items: cart.map(item => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity
        })),
        discount: parseFloat(discountInput) || 0,
        paymentMethod
      };

      const res = await api.completeBill(payload, keyToUse);
      setCompletedBill(res.bill);
      setShowReceiptModal(true);
      showToast(`Bill #${res.bill.bill_number || res.bill.billNumber} created successfully!`, 'success');
      
      clearCart();
      setIdempotencyKey(crypto.randomUUID());
    } catch (err: any) {
      showToast(err.message || 'Failed to complete transaction', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col lg:flex-row gap-5 overflow-hidden font-sans">
      {/* LEFT PANE: CATALOG & CATEGORIES */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border border-border rounded-2xl shadow-card overflow-hidden">
        {/* Search & Categories Bar */}
        <div className="p-4 md:p-5 border-b border-border space-y-3.5 bg-cream-50/50">
          <div className="flex gap-2.5 items-center">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-800/15 focus:border-forest-800 text-sm shadow-2xs"
              />
              <Search className="absolute left-3.5 top-3 text-slate-400 w-4 h-4" />
            </div>
            <Button variant="secondary" size="md" onClick={loadCatalog} title="Refresh catalog">
              <RefreshCw className="w-4 h-4 text-forest-800" />
            </Button>
          </div>

          {/* Category Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[40px] shadow-2xs ${
                selectedCategory === 'ALL'
                  ? 'bg-forest-800 text-white shadow-forest-800/15'
                  : 'bg-white text-slate-700 hover:bg-cream-100 border border-border'
              }`}
            >
              All Items ({catalog?.items?.length || 0})
            </button>
            {catalog?.categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[40px] shadow-2xs ${
                  selectedCategory === cat.id
                    ? 'bg-forest-800 text-white shadow-forest-800/15'
                    : 'bg-white text-slate-700 hover:bg-cream-100 border border-border'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Item Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 bg-cream-50/20">
          {loadingCatalog ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-28 bg-cream-200/50 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <ShoppingBag className="w-10 h-10 mb-2 stroke-1" />
              <p className="text-sm font-medium">No menu items found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {filteredItems.map((item) => {
                const isAvail = item.is_available ?? item.isAvailable ?? true;
                const price = item.selling_price || item.sellingPrice;
                const catName = item.category_name || item.categoryName;
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    disabled={!isAvail}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all min-h-[110px] relative overflow-hidden group shadow-2xs ${
                      !isAvail
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                        : 'bg-white border-border hover:border-forest-800/40 hover:shadow-card-hover active:scale-[0.98]'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <h3 className="font-bold text-forest-800 text-sm line-clamp-2 leading-snug">{item.name}</h3>
                        {!isAvail && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-700 font-bold rounded">
                            OUT
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 mt-1 block font-medium">{catName || 'General'}</span>
                    </div>
                    <div className="mt-3 flex justify-between items-center">
                      <span className="text-forest-800 font-extrabold text-sm">
                        {formatINR(price)}
                      </span>
                      <span className="text-xs font-bold text-forest-800 group-hover:underline flex items-center gap-0.5">
                        <Plus className="w-3.5 h-3.5" /> Add
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: CART & BILLING */}
      <div className="w-full lg:w-[420px] flex flex-col bg-white border border-border rounded-2xl overflow-hidden shadow-card">
        {/* Cart Header */}
        <div className="p-4 md:p-5 border-b border-border bg-cream-50/60 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif font-bold text-lg text-forest-800">Current Order</h2>
            <Badge variant="forest">{cart.reduce((s, i) => s + i.quantity, 0)} items</Badge>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2.5 py-1 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Order Type & Table Selection */}
        <div className="p-4 border-b border-border bg-white space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setOrderType('DINE_IN');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center justify-center gap-2 ${
                orderType === 'DINE_IN'
                  ? 'bg-forest-800 text-white shadow-sm'
                  : 'bg-cream-50 text-slate-600 hover:bg-cream-100 border border-border'
              }`}
            >
              🍽️ Dine-In
            </button>
            <button
              onClick={() => {
                setOrderType('TAKEAWAY');
                setSelectedTableId('');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center justify-center gap-2 ${
                orderType === 'TAKEAWAY'
                  ? 'bg-forest-800 text-white shadow-sm'
                  : 'bg-cream-50 text-slate-600 hover:bg-cream-100 border border-border'
              }`}
            >
              🛍️ Takeaway
            </button>
          </div>

          {orderType === 'DINE_IN' && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-600 font-bold mb-1">Select Table *</label>
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="w-full py-2.5 px-3 bg-cream-50/60 border border-border rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 min-h-[44px]"
              >
                <option value="">-- Choose Table --</option>
                {catalog?.tables?.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.table_number || table.name} (Capacity: {table.capacity})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-cream-50/10">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8">
              <ShoppingBag className="w-8 h-8 mb-2 stroke-1" />
              <p className="text-xs font-medium">Cart is empty</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Click catalog items to add to order</p>
            </div>
          ) : (
            cart.map(({ menuItem, quantity }) => {
              const price = Number(menuItem.selling_price || menuItem.sellingPrice || 0);
              return (
                <div
                  key={menuItem.id}
                  className="flex items-center justify-between p-3 bg-white border border-border/80 rounded-xl shadow-2xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold text-forest-800 truncate">{menuItem.name}</p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {formatINR(price)} × {quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-border rounded-lg overflow-hidden bg-cream-50">
                      <button
                        onClick={() => updateQuantity(menuItem.id, -1)}
                        className="px-2 py-1 text-slate-700 hover:bg-cream-200 font-bold min-h-[32px] min-w-[32px] flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-bold text-forest-800">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(menuItem.id, 1)}
                        className="px-2 py-1 text-slate-700 hover:bg-cream-200 font-bold min-h-[32px] min-w-[32px] flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-xs font-extrabold text-forest-800 min-w-[60px] text-right">
                      {formatINR(price * quantity)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Checkout & Financial Summary Section */}
        <div className="p-4 border-t border-border bg-cream-50/50 space-y-3">
          {/* Discount Input & Payment Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-bold mb-1">Discount (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-border rounded-xl text-slate-800 text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 min-h-[40px]"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-bold mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-border rounded-xl text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 min-h-[40px]"
              >
                <option value="CASH">💵 Cash</option>
                <option value="UPI">📱 UPI</option>
                <option value="CARD">💳 Card</option>
              </select>
            </div>
          </div>

          {/* Subtotal & Total Preview */}
          <div className="space-y-1 text-xs pt-1 border-t border-border/60">
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Subtotal:</span>
              <span>{formatINR(cartSubtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Discount:</span>
                <span>-{formatINR(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-forest-800 pt-1 border-t border-border">
              <span>Est. Total:</span>
              <span className="text-forest-800">{formatINR(previewTotal)}</span>
            </div>
          </div>

          {/* Complete Order Button */}
          <Button
            variant="primary"
            size="lg"
            isLoading={submitting}
            disabled={cart.length === 0 || (orderType === 'DINE_IN' && !selectedTableId)}
            onClick={handleCheckout}
            className="w-full shadow-md justify-center bg-forest-800 hover:bg-forest-900 text-white rounded-xl py-3.5 font-bold"
          >
            Complete Order ({paymentMethod}) • {formatINR(previewTotal)}
          </Button>
        </div>
      </div>

      {/* PRINTABLE RECEIPT MODAL */}
      <Modal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        title="Transaction Completed"
        size="md"
      >
        {completedBill && (
          <div className="space-y-4 font-sans">
            {/* Thermal Receipt Printable Container */}
            <div
              id="printable-receipt"
              className="bg-white text-slate-900 p-6 rounded-2xl font-mono text-xs shadow-inner border border-slate-200"
            >
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
                <h2 className="text-base font-bold text-black uppercase font-serif">Koyal Kinare Cafe</h2>
                <p className="text-[11px] text-slate-600">Riverside Drive, Cafe Management</p>
                <p className="text-[11px] text-slate-600">Bill #{completedBill.bill_number || completedBill.billNumber}</p>
                <p className="text-[10px] text-slate-500">
                  {new Date(completedBill.created_at || completedBill.createdAt || Date.now()).toLocaleString()}
                </p>
              </div>

              <div className="py-2 border-b border-dashed border-slate-400 flex justify-between text-[11px]">
                <span>Type: {completedBill.order_type || completedBill.orderType}</span>
                {(completedBill.table_name || completedBill.tableName) && (
                  <span>Table: {completedBill.table_name || completedBill.tableName}</span>
                )}
                <span>
                  Payment:{' '}
                  {completedBill.payments && completedBill.payments.length > 0
                    ? completedBill.payments[0].payment_method
                    : completedBill.paymentMethod}
                </span>
              </div>

              {/* Items */}
              <div className="py-3 border-b border-dashed border-slate-400 space-y-1.5">
                <div className="flex justify-between font-bold text-[11px]">
                  <span>Item</span>
                  <span>Qty × Price</span>
                  <span>Total</span>
                </div>
                {(completedBill.lines || completedBill.items)?.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate pr-2">{item.item_name || item.itemName}</span>
                    <span className="whitespace-nowrap">
                      {item.quantity} × {formatINR(item.unit_price || item.unitPrice)}
                    </span>
                    <span className="font-semibold whitespace-nowrap">
                      {formatINR(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="pt-3 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatINR(completedBill.subtotal)}</span>
                </div>
                {Number(completedBill.discount) > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-{formatINR(completedBill.discount)}</span>
                  </div>
                )}
                {Number(completedBill.tax || completedBill.taxAmount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Tax ({completedBill.taxRate || 0}%):</span>
                    <span>+{formatINR(completedBill.tax || completedBill.taxAmount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-900">
                  <span>GRAND TOTAL:</span>
                  <span>{formatINR(completedBill.grand_total || completedBill.grandTotal)}</span>
                </div>
              </div>

              <div className="text-center pt-4 text-[10px] text-slate-500 border-t border-dashed border-slate-400 mt-4">
                Thank you for visiting Koyal Kinare Cafe!
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  window.print();
                }}
                icon={<Printer className="w-4 h-4" />}
              >
                Print Receipt
              </Button>
              <Button variant="primary" onClick={() => setShowReceiptModal(false)}>
                Done (Next Order)
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
