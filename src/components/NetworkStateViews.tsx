import React from 'react';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';

export const AuthLoadingSkeleton: React.FC<{ label?: string }> = ({
  label = 'Checking your UTM student session...',
}) => (
  <div className="max-w-4xl mx-auto px-5 md:px-10 py-14">
    <div className="glass-surface border border-[#0A462C]/12 rounded-3xl p-8 md:p-10 shadow-sm space-y-5">
      <div className="flex items-center gap-2.5 text-xs font-semibold text-[#0A462C]">
        <Loader2 className="w-4 h-4 animate-spin text-[#659A73]" />
        <span>{label}</span>
      </div>
      <div className="space-y-3 animate-pulse">
        <div className="h-7 w-56 rounded-xl bg-[#0A462C]/10" />
        <div className="h-4 w-full max-w-md rounded-lg bg-black/8" />
        <div className="h-4 w-3/4 max-w-sm rounded-lg bg-black/6" />
      </div>
    </div>
  </div>
);

export const ListingGridSkeleton: React.FC<{
  count?: number;
  slowLatency?: boolean;
}> = ({ count = 6, slowLatency = false }) => (
  <div className="space-y-4">
    {slowLatency && (
      <div className="glass-surface border border-amber-500/30 bg-amber-50/75 rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-amber-900">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        <span>
          Connection is slower than usual — still syncing live UTM campus
          listings...
        </span>
      </div>
    )}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="glass-surface border border-[#0A462C]/10 rounded-2xl overflow-hidden animate-pulse"
        >
          <div className="aspect-[4/3] w-full bg-[#DCE8D5]/65" />
          <div className="p-5 space-y-3">
            <div className="flex justify-between gap-3">
              <div className="h-3 w-24 rounded bg-black/8" />
              <div className="h-3 w-16 rounded bg-[#0A462C]/12" />
            </div>
            <div className="h-5 w-4/5 rounded-lg bg-black/10" />
            <div className="pt-3 border-t border-black/5 flex justify-between">
              <div className="h-5 w-20 rounded bg-[#0A462C]/15" />
              <div className="h-4 w-24 rounded bg-black/8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const ListRowsSkeleton: React.FC<{
  count?: number;
  slowLatency?: boolean;
}> = ({ count = 3, slowLatency = false }) => (
  <div className="space-y-4">
    {slowLatency && (
      <div className="glass-surface border border-amber-500/30 bg-amber-50/75 rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-amber-900">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        <span>
          Syncing your campus orders over a slow connection...
        </span>
      </div>
    )}
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="glass-surface border border-[#0A462C]/10 rounded-2xl p-5 md:p-6 flex items-center gap-4 animate-pulse"
      >
        <div className="w-20 h-20 rounded-xl bg-[#DCE8D5]/70 shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="h-3 w-36 rounded bg-black/8" />
          <div className="h-5 w-52 max-w-full rounded bg-black/10" />
          <div className="h-4 w-24 rounded bg-[#0A462C]/12" />
        </div>
      </div>
    ))}
  </div>
);

export const SyncErrorCard: React.FC<{
  title?: string;
  message: string;
  onRetry: () => void;
  retrying?: boolean;
  compact?: boolean;
}> = ({
  title = 'Connection interrupted',
  message,
  onRetry,
  retrying = false,
  compact = false,
}) => (
  <div
    role="alert"
    className={`glass-surface border border-red-200 bg-red-50/85 rounded-2xl ${
      compact
        ? 'px-4 py-3 flex flex-wrap items-center justify-between gap-3'
        : 'p-8 text-center space-y-3'
    }`}
  >
    <div
      className={
        compact
          ? 'flex items-center gap-2.5 min-w-0'
          : 'flex flex-col items-center gap-2'
      }
    >
      <div
        className={`${
          compact ? 'w-8 h-8 rounded-lg' : 'w-11 h-11 rounded-2xl mb-1'
        } bg-red-100 text-red-700 flex items-center justify-center shrink-0`}
      >
        <WifiOff className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#112419]">{title}</p>
        <p className="text-xs text-[#4A5D50] mt-0.5 break-words">{message}</p>
      </div>
    </div>

    <button
      type="button"
      disabled={retrying}
      onClick={onRetry}
      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A462C] text-white text-xs font-semibold hover:bg-[#0E5D3B] disabled:opacity-55 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
    >
      {retrying ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5" />
      )}
      <span>{retrying ? 'Retrying...' : 'Retry'}</span>
    </button>
  </div>
);
