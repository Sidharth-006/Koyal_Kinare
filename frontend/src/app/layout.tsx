import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/ToastContext';

export const metadata: Metadata = {
  title: 'Koyal Kinare Cafe Management',
  description: 'Cafe Management and POS Billing System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-slate-800 font-sans selection:bg-forest-800 selection:text-white">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}

