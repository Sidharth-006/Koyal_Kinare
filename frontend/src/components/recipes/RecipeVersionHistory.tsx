import React from 'react';
import { RecipeVersionSummaryDTO } from '@/lib/types';
import { VersionStatusBadge } from './RecipeStatusBadge';
import { formatDate } from '@/lib/format';
import { History, Calendar, CheckCircle2, FileText } from 'lucide-react';

interface RecipeVersionHistoryProps {
  versions: RecipeVersionSummaryDTO[];
  activeVersionId: string | null;
}

export const RecipeVersionHistory: React.FC<RecipeVersionHistoryProps> = ({
  versions,
  activeVersionId
}) => {
  if (!versions || versions.length === 0) {
    return (
      <div className="p-8 text-center bg-cream-50/50 rounded-2xl border border-border text-slate-500 text-xs">
        <History className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
        <p className="font-semibold">No version history available</p>
        <p className="text-slate-400 mt-0.5">Recipe versions will be recorded here as drafts are created and activated.</p>
      </div>
    );
  }

  // Sort versions descending by versionNumber
  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div className="space-y-3" data-testid="recipe-version-history">
      {sortedVersions.map((v) => {
        const isActive = v.id === activeVersionId || v.status === 'ACTIVE';

        return (
          <div
            key={v.id}
            className={`p-4 rounded-xl border transition-all text-xs ${
              isActive
                ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/30'
                : 'bg-white border-border'
            }`}
            data-testid={`version-item-${v.versionNumber}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-sm text-forest-800">
                  Version {v.versionNumber}
                </span>
                <VersionStatusBadge status={v.status} />
                {isActive && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" />
                    Currently Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Created: {formatDate(v.createdAt)}
                </span>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
              {v.effectiveFrom && (
                <div>
                  <span className="text-slate-400 font-medium">Effective From: </span>
                  <span className="font-semibold text-slate-700">{formatDate(v.effectiveFrom)}</span>
                </div>
              )}
              {v.supersededAt && (
                <div>
                  <span className="text-slate-400 font-medium">Superseded At: </span>
                  <span className="font-semibold text-slate-700">{formatDate(v.supersededAt)}</span>
                </div>
              )}
              {v.note && (
                <div className="sm:col-span-2 flex items-start gap-1.5 mt-1 bg-cream-50/60 p-2 rounded-lg border border-border/40 text-slate-700">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="italic">{v.note}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
