'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { SafeDeviceSessionDTO } from '@/lib/types';
import { SettingsNav } from '@/components/settings/SettingsNav';
import { DeviceSessionCard } from '@/components/settings/DeviceSessionCard';
import { RevokeSessionModal } from '@/components/settings/RevokeSessionModal';
import { RevokeOthersModal } from '@/components/settings/RevokeOthersModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/ToastContext';
import { Laptop, ShieldCheck, LogOut, RefreshCw, AlertCircle } from 'lucide-react';

export default function SessionsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<SafeDeviceSessionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [selectedSessionToRevoke, setSelectedSessionToRevoke] = useState<SafeDeviceSessionDTO | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showRevokeOthersModal, setShowRevokeOthersModal] = useState(false);

  // Refetch function corresponding to logical query key `deviceSessions`
  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDeviceSessions();
      setSessions(res.sessions || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          // Handled by global 401 session expiry interceptor
          return;
        }
        setError(err.message || 'Unable to load active device sessions. Please try again.');
      } else {
        setError('Unable to load active device sessions. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleOpenRevokeModal = (session: SafeDeviceSessionDTO) => {
    setSelectedSessionToRevoke(session);
    setShowRevokeModal(true);
  };

  const handleRevokeSuccess = (isCurrentSession: boolean) => {
    if (isCurrentSession) {
      // If current device was revoked, skip refetch and redirect straight to login
      router.push('/login');
    } else {
      // Invalidate and refresh deviceSessions query
      loadSessions();
    }
  };

  const handleRevokeOthersSuccess = () => {
    // Invalidate and refresh deviceSessions query
    loadSessions();
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans pb-12">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-forest-900 tracking-tight">Active Device Sessions</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Manage authenticated devices with access to Koyal Kinare Cafe POS & Admin
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={loadSessions}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            className="text-xs min-h-[44px]"
            aria-label="Refresh sessions list"
          >
            Refresh
          </Button>

          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={loading || otherSessionsCount === 0}
            onClick={() => setShowRevokeOthersModal(true)}
            icon={<LogOut className="w-4 h-4" />}
            className="text-xs min-h-[44px]"
          >
            Sign out all other devices {otherSessionsCount > 0 ? `(${otherSessionsCount})` : ''}
          </Button>
        </div>
      </div>

      {/* Sub-Navigation */}
      <SettingsNav />

      {/* Session Security Overview Callout */}
      <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-4 text-xs text-emerald-900">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>
            Sessions are authenticated via secure HTTP-only cookies. Only sanitized device labels and timestamps are visible.
          </span>
        </div>
        <span className="font-bold text-emerald-800 shrink-0 hidden sm:inline">
          {sessions.length} Active {sessions.length === 1 ? 'Device' : 'Devices'}
        </span>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center space-y-4 border-rose-200 bg-rose-50/30">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-rose-900">Failed to load device sessions</h3>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
          </div>
          <Button type="button" variant="primary" size="sm" onClick={loadSessions} className="mx-auto">
            Try Again
          </Button>
        </Card>
      ) : sessions.length === 0 ? (
        <Card className="p-12 text-center space-y-3 border-dashed">
          <Laptop className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No active sessions found</h3>
          <p className="text-xs text-slate-500">Please refresh or sign in again.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {otherSessionsCount === 0 && (
            <div className="p-3 bg-cream-50 border border-border/80 rounded-xl text-xs text-slate-600 font-medium">
              Only this current device is signed in. No other devices currently have active access.
            </div>
          )}

          {sessions.map((session) => (
            <DeviceSessionCard
              key={session.id}
              session={session}
              onRevoke={handleOpenRevokeModal}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <RevokeSessionModal
        isOpen={showRevokeModal}
        session={selectedSessionToRevoke}
        onClose={() => {
          setShowRevokeModal(false);
          setSelectedSessionToRevoke(null);
        }}
        onSuccess={handleRevokeSuccess}
      />

      <RevokeOthersModal
        isOpen={showRevokeOthersModal}
        onClose={() => setShowRevokeOthersModal(false)}
        onSuccess={handleRevokeOthersSuccess}
      />
    </div>
  );
}
