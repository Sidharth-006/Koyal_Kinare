'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Laptop, Database } from 'lucide-react';
import { clsx } from 'clsx';

export const SettingsNav: React.FC = () => {
  const pathname = usePathname();

  const tabs = [
    {
      href: '/settings',
      label: 'General Settings',
      icon: Building2,
      exact: true
    },
    {
      href: '/settings/sessions',
      label: 'Device Sessions',
      icon: Laptop,
      exact: false
    },
    {
      href: '/settings/backups',
      label: 'System Backups',
      icon: Database,
      exact: false
    }
  ];

  return (
    <div className="flex border-b border-border bg-white rounded-2xl p-1.5 gap-1.5 shadow-2xs mb-6 overflow-x-auto scrollbar-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.exact ? pathname === tab.href : pathname?.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              'flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px] whitespace-nowrap',
              isActive
                ? 'bg-forest-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-forest-800 hover:bg-cream-100/70'
            )}
          >
            <Icon className={clsx('w-4 h-4', isActive ? 'text-amber-400' : 'text-slate-500')} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
};
