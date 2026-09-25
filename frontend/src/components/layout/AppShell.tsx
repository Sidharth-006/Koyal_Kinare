'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Receipt, SlidersHorizontal,
  BarChart3, FileText, Settings, LogOut, Coffee, Calendar, User, Menu as MenuIcon, X, Sparkles, Package, Truck
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { getTodayIsoDate, formatDate } from '@/lib/format';
import { useToast } from '../ui/ToastContext';

export interface AppShellProps {
  children: React.ReactNode;
  admin?: { id: string; email: string; displayName?: string; display_name?: string } | null;
}

export const AppShell: React.FC<AppShellProps> = ({ children, admin }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const today = getTodayIsoDate();

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await api.logout();
      showToast('Logged out successfully', 'success');
      router.push('/login');
    } catch (err: any) {
      showToast(err.message || 'Failed to logout', 'error');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/pos', label: 'POS / Billing', icon: ShoppingBag },
    { href: '/menu', label: 'Menu', icon: UtensilsCrossed },
    { href: '/inventory/items', label: 'Inventory Items', icon: Package },
    { href: '/suppliers', label: 'Suppliers', icon: Truck },
    { href: '/expenses', label: 'Expenses', icon: Receipt },
    { href: '/reconciliation', label: 'Daily Closing', icon: SlidersHorizontal },
    { href: '/sales', label: 'Sales', icon: BarChart3 },
    { href: '/reports', label: 'Reports', icon: FileText },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-slate-800 flex flex-col md:flex-row font-sans">
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-forest-800 text-white shrink-0 p-4 justify-between sticky top-0 h-screen shadow-elevated border-r border-forest-900/30">
        <div>
          {/* Cafe Identity Brand */}
          <div className="flex items-center gap-3.5 px-3 py-3.5 mb-5 border-b border-forest-700/50">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-400/30 shadow-inner">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg tracking-tight text-white leading-tight">Koyal Kinare</h1>
              <p className="text-[11px] font-medium text-cream-200/70 tracking-wide uppercase">Cafe Management & POS</p>
            </div>
          </div>

          {/* Operating Date Badge */}
          <div className="mb-5 px-3.5 py-2.5 bg-forest-900/40 border border-forest-700/60 rounded-xl flex items-center justify-between text-xs font-medium text-cream-100/90 shadow-inner">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{formatDate(today)}</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 min-h-[44px]',
                    isActive
                      ? 'bg-forest-700/90 text-white shadow-sm font-semibold border border-white/10 translate-x-0.5'
                      : 'text-cream-100/75 hover:bg-forest-700/40 hover:text-white'
                  )}
                >
                  <Icon className={clsx("w-5 h-5 shrink-0 transition-colors", isActive ? "text-amber-400" : "text-cream-200/60")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Account & Logout */}
        <div className="pt-4 border-t border-forest-700/50 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-3 py-2 bg-forest-900/30 rounded-xl border border-forest-700/40">
            <div className="p-2 bg-forest-700 text-amber-300 rounded-lg">
              <User className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{admin?.displayName || admin?.display_name || 'Admin'}</p>
              <p className="text-[11px] text-cream-200/60 truncate">{admin?.email || 'admin@koyalkinare.com'}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 transition-colors min-h-[44px] border border-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>{isLoggingOut ? 'Logging out...' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-forest-800 text-white border-b border-forest-900/30 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-400/30">
            <Coffee className="w-5 h-5" />
          </div>
          <span className="font-serif font-bold text-lg tracking-tight text-white">Koyal Kinare</span>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-cream-100 hover:text-white rounded-xl hover:bg-forest-700/60 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          aria-label="Toggle Menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Overlay Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[65px] z-50 bg-forest-900/95 backdrop-blur-xl p-5 flex flex-col justify-between overflow-y-auto animate-fade-in text-white">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={clsx(
                    'flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-base font-medium min-h-[44px]',
                    isActive ? 'bg-forest-700 text-white font-semibold border border-white/10' : 'text-cream-100/80 hover:bg-forest-800'
                  )}
                >
                  <Icon className={clsx("w-5 h-5", isActive ? "text-amber-400" : "text-cream-200/60")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-forest-700/50 flex flex-col gap-4">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full py-3 bg-rose-500/20 text-rose-200 rounded-xl font-semibold min-h-[44px] border border-rose-500/30"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Screen Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full mb-16 md:mb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation Rail */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border flex justify-around items-center p-2 shadow-lg">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold min-h-[44px] min-w-[44px] justify-center transition-colors',
                isActive ? 'text-forest-800 bg-forest-100/80' : 'text-slate-500'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
