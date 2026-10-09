'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { SafeBackupStatusDTO } from '@/lib/types';
import { SettingsNav } from '@/components/settings/SettingsNav';
import { BackupHealthCard } from '@/components/settings/BackupHealthCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function BackupsPage() {
  const [backupStatus, setBackupStatus] = useState<SafeBackupStatusDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Logical query key: `backupStatus`
  const loadBackupStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBackupStatus();
      setBackupStatus(res.backupStatus || null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          return;
        }
        setError(err.message || 'Unable to retrieve backup health status.');
      } else {
        setError('Unable to retrieve backup health status.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackupStatus();
  }, [loadBackupStatus]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans pb-12">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-forest-900 tracking-tight">System Backup Health</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Monitor automated operational database snapshots and disaster resilience
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={loadBackupStatus}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            className="text-xs min-h-[44px]"
            aria-label="Refresh backup health"
          >
            Check Status
          </Button>
        </div>
      </div>

      {/* Sub-Navigation */}
      <SettingsNav />

      {/* Backup Health Content */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center space-y-4 border-rose-200 bg-rose-50/30">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-rose-900">Failed to load backup status</h3>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
          </div>
          <Button type="button" variant="primary" size="sm" onClick={loadBackupStatus} className="mx-auto">
            Try Again
          </Button>
        </Card>
      ) : (
        <BackupHealthCard
          backupStatus={backupStatus}
          loading={loading}
          error={error}
          onRefresh={loadBackupStatus}
        />
      )}
    </div>
  );
}
