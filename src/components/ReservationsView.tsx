import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Calendar, CheckCircle2, Loader2, MapPin, MessageSquare } from 'lucide-react';
import { Reservation } from '../types/marketplace';
import { formatMYR, resolveAssetUrl } from '../data/utmCatalog';
import {
  AuthLoadingSkeleton,
  ListRowsSkeleton,
  SyncErrorCard,
} from './NetworkStateViews';

interface ReservationsViewProps {
  user: User | null;
  authLoading?: boolean;
  signingIn?: boolean;
  loading?: boolean;
  slowLatency?: boolean;
  error?: string | null;
  onRetry?: () => void;
  reservations: Reservation[];
  onSignIn: () => void;
  onOpenHandover: (reservation: Reservation, mode: 'seller' | 'buyer') => void;
  onConfirmHandover: (reservation: Reservation) => Promise<void>;
  onOpenChat: (reservation: Reservation) => void;
  onBrowseCatalog: () => void;
}

const STATUS_LABELS: Record<Reservation['status'], string> = {
  pending: 'Awaiting seller handover proposal',
  seller_proposed: 'Seller proposed meeting details',
  buyer_counter_proposed: 'Buyer suggested new meeting details',
  confirmed: 'Handover confirmed',
};

export const ReservationsView: React.FC<ReservationsViewProps> = ({
  user,
  authLoading = false,
  signingIn = false,
  loading = false,
  slowLatency = false,
  error = null,
  onRetry,
  reservations,
  onSignIn,
  onOpenHandover,
  onConfirmHandover,
  onOpenChat,
  onBrowseCatalog,
}) => {
  const [tab, setTab] = useState<'purchases' | 'sales'>('purchases');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (authLoading) {
    return <AuthLoadingSkeleton label="Loading your reservations..." />;
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-5 md:px-10 py-16 text-center">
        <div className="bg-white border border-black/10 rounded-2xl p-10">
          <p className="text-xs font-semibold text-[#4A5D50] mb-2">
            CampusTrade UTM
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#112419] mb-3">
            Sign in to view your reservations
          </h1>
          <p className="text-sm text-[#4A5D50] max-w-md mx-auto mb-6">
            Coordinate campus meeting spots, confirm handover times, and chat
            privately with fellow UTM students (<span className="font-semibold text-[#0A462C]">@graduate.utm.my</span> only).
          </p>
          <button
            type="button"
            disabled={signingIn}
            onClick={onSignIn}
            className="px-5 py-3 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] disabled:opacity-65 inline-flex items-center gap-2 cursor-pointer"
          >
            {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {signingIn
                ? 'Signing in...'
                : 'Sign In with UTM Google (@graduate.utm.my)'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  const purchases = reservations.filter((r) => r.buyerId === user.uid);
  const sales = reservations.filter((r) => r.sellerId === user.uid);
  const activeList = tab === 'purchases' ? purchases : sales;

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-10 py-10 md:py-14">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#659A73] mb-2">
          Your Campus Activity
        </p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#112419]">
          Reservations &amp;{' '}
          <span className="font-display-serif italic font-normal text-utm-gradient">
            Handovers
          </span>
        </h1>
      </div>

      {/* Interactive Segmented Tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-white border border-black/10 rounded-xl mb-8">
        <button
          type="button"
          onClick={() => setTab('purchases')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            tab === 'purchases'
              ? 'bg-[#0A462C] text-white'
              : 'text-[#4A5D50] hover:text-[#112419]'
          }`}
        >
          My Purchases ({purchases.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('sales')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            tab === 'sales'
              ? 'bg-[#0A462C] text-white'
              : 'text-[#4A5D50] hover:text-[#112419]'
          }`}
        >
          My Sales ({sales.length})
        </button>
      </div>

      {error && onRetry && (
        <div className="mb-6">
          <SyncErrorCard
            compact={reservations.length > 0}
            title="Could not sync reservations"
            message={error}
            onRetry={onRetry}
          />
        </div>
      )}

      {actionError && (
        <p className="mb-5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {actionError}
        </p>
      )}

      {loading && reservations.length === 0 ? (
        <ListRowsSkeleton slowLatency={slowLatency} />
      ) : activeList.length === 0 ? (
        <div className="bg-white border border-black/10 rounded-2xl p-12 text-center">
          <p className="text-base font-bold text-[#112419]">
            {tab === 'purchases'
              ? 'You have not reserved any objects yet'
              : 'No buyers have reserved your listings yet'}
          </p>
          <p className="text-sm text-[#4A5D50] mt-1 mb-5">
            Explore the 3D Orbit Sphere or Catalog to discover objects around UTM.
          </p>
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="px-4 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] cursor-pointer"
          >
            Browse Catalog
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {activeList.map((res) => {
            const isBuyer = res.buyerId === user.uid;
            const isSeller = res.sellerId === user.uid;
            const hasHandover = Boolean(
              res.handoverLocation && res.handoverDate && res.handoverTime,
            );
            const canSellerPropose =
              isSeller &&
              (res.status === 'pending' || res.status === 'buyer_counter_proposed');
            const canBuyerAccept =
              isBuyer && res.status === 'seller_proposed' && hasHandover;
            const canBuyerCounter =
              isBuyer && res.status === 'seller_proposed' && hasHandover;
            const canSellerAccept =
              isSeller && res.status === 'buyer_counter_proposed' && hasHandover;

            return (
              <article
                key={res.id}
                className="glass-surface border border-[#0A462C]/12 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <img
                    src={resolveAssetUrl(res.listingImage)}
                    alt={res.listingTitle}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-xl object-cover bg-[#E3ECE0] shrink-0"
                  />
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#4A5D50]">
                      <span>
                        {isBuyer ? `Seller: ${res.sellerName}` : `Buyer: ${res.buyerName}`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-semibold ${
                          res.status === 'confirmed'
                            ? 'text-[#0A462C]'
                            : 'text-amber-700'
                        }`}
                      >
                        {STATUS_LABELS[res.status]}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-[#112419] truncate">
                      {res.listingTitle}
                    </h2>

                    <p className="font-mono-tabular text-sm font-semibold text-[#0A462C]">
                      {formatMYR(res.listingPrice)}
                    </p>

                    {hasHandover && (
                      <div className="pt-2 space-y-1 text-xs text-[#2A3B31]">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#0A462C] shrink-0" />
                          <span>{res.handoverLocation}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#0A462C] shrink-0" />
                          <span>
                            {res.handoverDate} at {res.handoverTime}
                          </span>
                        </p>
                        {res.handoverNote && (
                          <p className="text-[#4A5D50]">{res.handoverNote}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenChat(res)}
                    className="px-3.5 py-2 rounded-xl border border-black/15 text-xs font-semibold text-[#112419] hover:bg-[#F3F3EE] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#0A462C]" />
                    <span>Chat</span>
                  </button>

                  {canSellerPropose && (
                    <button
                      type="button"
                      onClick={() => onOpenHandover(res, 'seller')}
                      className="px-3.5 py-2 rounded-xl bg-[#0A462C] text-white text-xs font-semibold hover:bg-[#0E5D3B] cursor-pointer"
                    >
                      {res.status === 'pending'
                        ? 'Arrange Handover'
                        : 'Propose Different Time'}
                    </button>
                  )}

                  {canBuyerCounter && (
                    <button
                      type="button"
                      onClick={() => onOpenHandover(res, 'buyer')}
                      className="px-3.5 py-2 rounded-xl border border-black/15 text-xs font-semibold text-[#112419] hover:bg-[#F3F3EE] cursor-pointer"
                    >
                      Suggest Changes
                    </button>
                  )}

                  {(canBuyerAccept || canSellerAccept) && (
                    <button
                      type="button"
                      disabled={busyId === res.id}
                      onClick={async () => {
                        setBusyId(res.id);
                        setActionError(null);
                        try {
                          await onConfirmHandover(res);
                        } catch (err) {
                          setActionError(
                            err instanceof Error
                              ? err.message
                              : 'Could not confirm handover. Please try again.',
                          );
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#0A462C] text-white text-xs font-semibold hover:bg-[#0E5D3B] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {busyId === res.id ? 'Confirming...' : 'Confirm Handover'}
                      </span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
