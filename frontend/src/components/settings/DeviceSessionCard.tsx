'use client';

import React from 'react';
import { Laptop, Smartphone, Monitor, ShieldCheck, Clock, Calendar, LogOut } from 'lucide-react';
import { SafeDeviceSessionDTO } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export interface DeviceSessionCardProps {
  session: SafeDeviceSessionDTO;
  onRevoke: (session: SafeDeviceSessionDTO) => void;
  isRevoking?: boolean;
}

export const DeviceSessionCard: React.FC<DeviceSessionCardProps> = ({
  session,
  onRevoke,
  isRevoking = false
}) => {
  const getDeviceIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('iphone') || l.includes('android') || l.includes('mobile')) {
      return <Smartphone className="w-5 h-5 text-forest-700" />;
    }
    if (l.includes('mac') || l.includes('windows') || l.includes('linux')) {
      return <Laptop className="w-5 h-5 text-forest-700" />;
    }
    return <Monitor className="w-5 h-5 text-forest-700" />;
  };

  const formatLastActive = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-border shadow-2xs hover:shadow-xs transition-shadow">
      <div className="flex items-start gap-3.5">
        <div className="p-3 bg-cream-100 rounded-2xl border border-cream-200 shrink-0">
          {getDeviceIcon(session.deviceLabel)}
        </div>
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h4 className="font-bold text-base text-forest-900 tracking-tight truncate">
              {session.deviceLabel}
            </h4>
            {session.isCurrent ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                This Device
              </span>
            ) : null}
            <Badge variant="success">Active</Badge>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              Signed in: {formatDate(session.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              Last active: {formatLastActive(session.lastSeenAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
        <Button
          type="button"
          variant={session.isCurrent ? 'danger' : 'secondary'}
          size="sm"
          isLoading={isRevoking}
          disabled={isRevoking}
          onClick={() => onRevoke(session)}
          icon={<LogOut className="w-4 h-4" />}
          className="min-h-[44px] min-w-[140px] text-xs font-semibold"
        >
          {session.isCurrent ? 'Sign Out This Device' : 'Sign Out Device'}
        </Button>
      </div>
    </Card>
  );
};
