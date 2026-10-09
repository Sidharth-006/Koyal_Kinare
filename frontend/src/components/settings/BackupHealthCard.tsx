'use client';

import React from 'react';
import { Database, AlertCircle, Clock, Calendar, RefreshCw } from 'lucide-react';
import { SafeBackupStatusDTO } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export interface BackupHealthCardProps {
  backupStatus: SafeBackupStatusDTO | null;
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
}

export const BackupHealthCard: React.FC<BackupHealthCardProps> = ({
  backupStatus,
  loading,
  error,
  onRefresh
}) => {
  const formatTimestamp = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'None recorded';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZoneName: 'short'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Healthy
          </span>
        );
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-spin" />
            Backup In Progress
          </span>
        );
      case 'SCHEDULED':
      case 'NO_RUNS':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Scheduled
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            Attention Required
          </span>
        );
    }
  };

  const isFailed = backupStatus?.status === 'FAILED' || !!error;

  return (
    <Card className="p-6 border border-border shadow-2xs space-y-6">
      {/* Header and Live Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/80">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-cream-100 text-forest-800 rounded-2xl border border-cream-200 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-forest-900 tracking-tight">Database Backup Status</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {backupStatus?.instruction || 'Automated operational status'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-xs text-slate-500 animate-pulse">Checking status...</span>
          ) : (
            getStatusBadge(backupStatus?.status)
          )}
          {onRefresh && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              className="text-xs min-h-[36px]"
              aria-label="Refresh backup status"
            >
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Attention Notice (Exact Safe String mandated by DLD) */}
      {isFailed && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900 animate-fade-in" role="alert">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Backup needs attention. Please contact the developer.</p>
          </div>
        </div>
      )}

      {/* Safe Metrics Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4.5 bg-cream-50/60 border border-border/70 rounded-2xl space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Calendar className="w-4 h-4 text-forest-700" />
            <span>Last Successful Backup</span>
          </div>
          <p className="text-sm font-bold text-forest-900">
            {loading ? '—' : formatTimestamp(backupStatus?.lastSuccessfulBackupAt)}
          </p>
        </div>

        <div className="p-4.5 bg-cream-50/60 border border-border/70 rounded-2xl space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Clock className="w-4 h-4 text-forest-700" />
            <span>Next Scheduled Backup</span>
          </div>
          <p className="text-sm font-bold text-forest-900">
            {loading ? '—' : formatTimestamp(backupStatus?.nextScheduledRun)}
          </p>
        </div>
      </div>
    </Card>
  );
};
