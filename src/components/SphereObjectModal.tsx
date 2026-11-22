import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpRight,
  Heart,
  Loader2,
  MapPin,
  Maximize2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Listing } from '../types/marketplace';
import { UTM_CAMPUS_ZONES, formatMYR, resolveAssetUrl } from '../data/utmCatalog';
import { AiListingInsights, requestAiListingInsights } from '../lib/aiClient';

export interface OriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SphereObjectModalProps {
  listing: Listing | null;
  originRect: OriginRect | null;
  user: User | null;
  isWishlisted: boolean;
  onToggleWishlist: (listing: Listing) => Promise<void>;
  onClose: () => void;
  onReserveListing: (listing: Listing) => Promise<void>;
  onNavigateToReservations: () => void;
  onNavigateToMyListings: () => void;
  onSignIn: () => void;
  onOpenFullDetail: (listing: Listing) => void;
  onOpenCreateSimilar: (listing: Listing) => void;
}

export const SphereObjectModal: React.FC<SphereObjectModalProps> = ({
  listing,
  originRect,
  user,
  isWishlisted,
  onToggleWishlist,
  onClose,
  onReserveListing,
  onNavigateToReservations,
  onNavigateToMyListings,
  onSignIn,
  onOpenFullDetail,
  onOpenCreateSimilar,
}) => {
  const [reserving, setReserving] = useState(false);
  const [showcaseReserved, setShowcaseReserved] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [aiInsights, setAiInsights] = useState<AiListingInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const lastOriginRectRef = useRef<OriginRect | null>(null);

  if (originRect) {
    lastOriginRectRef.current = originRect;
  }
  const activeOriginRect = originRect ?? lastOriginRectRef.current;

  // Reset local interaction state whenever a new listing opens
  useEffect(() => {
    setReserving(false);
    setShowcaseReserved(false);
    setImageFailed(false);
    setAiInsights(null);
    setAiLoading(false);
    setAiError('');
  }, [listing?.id]);

  const handleLoadInsights = async () => {
    if (!listing) return;
    if (aiInsights) {
      setAiInsights(null);
      return;
    }
    setAiLoading(true);
    setAiError('');
    try {
      const data = await requestAiListingInsights(listing);
      setAiInsights(data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI check failed.');
    } finally {
      setAiLoading(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    if (!listing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listing, onClose]);

  const zone = useMemo(() => {
    if (!listing) return UTM_CAMPUS_ZONES[0];
    return (
      UTM_CAMPUS_ZONES.find((z) => z.name === listing.campusZone) ||
      UTM_CAMPUS_ZONES[0]
    );
  }, [listing]);

  // Compute exact FLIP transform deltas from the clicked sphere image to the centered modal
  const flipMetrics = useMemo(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const targetW = Math.min(vw * 0.92, 900);
    const targetH = Math.min(vh * 0.86, 560);

    if (!activeOriginRect || activeOriginRect.width <= 0 || activeOriginRect.height <= 0) {
      return { dx: 0, dy: 0, startScale: 0.82 };
    }

    const originCx = activeOriginRect.left + activeOriginRect.width / 2;
    const originCy = activeOriginRect.top + activeOriginRect.height / 2;
    const targetCx = vw / 2;
    const targetCy = vh / 2;

    const dx = originCx - targetCx;
    const dy = originCy - targetCy;
    const scaleByW = activeOriginRect.width / targetW;
    const scaleByH = activeOriginRect.height / targetH;
    const startScale = Math.max(0.14, Math.min(0.85, Math.max(scaleByW, scaleByH)));

    return { dx, dy, startScale };
  }, [activeOriginRect]);

  const isOwner = Boolean(user && listing && listing.sellerId === user.uid);
  const isReserver = Boolean(user && listing && listing.reservedBy === user.uid);

  const handleReserveClick = async () => {
    if (!listing) return;
    if (!user) {
      onSignIn();
      return;
    }
    if (listing.isShowcase) {
      setShowcaseReserved(true);
    }
    setReserving(true);
    try {
      await onReserveListing(listing);
    } finally {
      setReserving(false);
    }
  };

  const statusText = listing
    ? listing.status === 'available' && !showcaseReserved
      ? 'Available for campus pickup'
      : listing.status === 'reserved' || showcaseReserved
        ? 'Reserved'
        : 'Sold'
    : '';

  return (
    <AnimatePresence>
      {listing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={listing.title}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden"
        >
          {/* Semi-transparent frosted backdrop keeping the 3D sphere subtly visible */}
          <motion.div
            key="sphere-popup-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
            className="absolute inset-0 bg-[#112419]/30 backdrop-blur-md cursor-pointer"
          />

          {/* Morphing Pop-Up Card originating from & returning to the clicked 3D image */}
          <motion.div
            key={listing.id}
            initial={{
              x: flipMetrics.dx,
              y: flipMetrics.dy,
              scale: flipMetrics.startScale,
              opacity: 0.72,
            }}
            animate={{
              x: 0,
              y: 0,
              scale: 1,
              opacity: 1,
              transition: {
                type: 'spring',
                stiffness: 300,
                damping: 28,
                mass: 0.82,
              },
            }}
            exit={{
              x: flipMetrics.dx,
              y: flipMetrics.dy,
              scale: flipMetrics.startScale,
              opacity: 0,
              transition: {
                duration: 0.36,
                ease: [0.32, 0.72, 0, 1],
                opacity: { duration: 0.14, delay: 0.22 },
              },
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ transformOrigin: 'center center' }}
            className="relative z-10 w-full max-w-[900px] max-h-[88vh] bg-white/92 backdrop-blur-xl border border-white/70 rounded-3xl shadow-[0_28px_80px_rgba(10,34,20,0.28)] overflow-hidden grid grid-cols-1 md:grid-cols-12"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close pop-up and return to sphere"
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white border border-black/10 text-[#112419] flex items-center justify-center shadow-sm transition-transform hover:scale-105 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left Column: Object Image + Campus Pickup Location */}
            <div className="md:col-span-6 bg-[#E9EEE7]/70 flex flex-col justify-between p-4 sm:p-5 gap-4">
              <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-white border border-black/10 shadow-sm">
                <button
                  type="button"
                  onClick={() => void onToggleWishlist(listing)}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                  className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-black/10 flex items-center justify-center shadow-sm hover:scale-110 transition-transform cursor-pointer"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      isWishlisted ? 'fill-[#0A462C] text-[#0A462C]' : 'text-[#4A5D50]'
                    }`}
                  />
                </button>
                {!imageFailed && listing.imageUrl ? (
                  <img
                    src={resolveAssetUrl(listing.imageUrl)}
                    alt={listing.title}
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#E3ECE0] flex flex-col items-center justify-center p-6 text-center">
                    <span className="text-sm font-semibold text-[#0A462C]">
                      {listing.category}
                    </span>
                    <span className="text-xs text-[#4A5D50] mt-1">
                      {listing.title}
                    </span>
                  </div>
                )}
              </div>

              {/* Compact UTM Pickup Spot */}
              <div className="bg-white/85 border border-black/10 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#4A5D50] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#0A462C] shrink-0" />
                    <span>UTM Campus Pickup</span>
                  </p>
                  <p className="text-xs font-bold text-[#112419] truncate mt-0.5">
                    {listing.campusZone}
                  </p>
                  <p className="text-[11px] text-[#4A5D50] truncate">
                    {zone.area}
                  </p>
                </div>

                <div className="w-20 h-14 rounded-xl bg-[#F3F3EE] border border-black/10 relative overflow-hidden shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
                    <path
                      d="M12,72 Q35,45 55,22 T88,65"
                      fill="none"
                      stroke="#0A462C"
                      strokeOpacity="0.18"
                      strokeWidth="2.5"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={zone.mapX}
                      cy={zone.mapY}
                      r="12"
                      fill="#0A462C"
                      fillOpacity="0.16"
                    />
                    <circle cx={zone.mapX} cy={zone.mapY} r="5.5" fill="#0A462C" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Right Column: Details, Seller & Reservation Actions */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.24, delay: 0.08 }}
              className="md:col-span-6 p-6 sm:p-7 flex flex-col justify-between gap-5 overflow-y-auto max-h-[55vh] md:max-h-[86vh]"
            >
              <div className="space-y-4 pr-6">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#4A5D50]">
                  <span>{listing.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{listing.condition}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {listing.type === 'service' ? 'Student Service' : 'Physical Item'}
                  </span>
                </div>

                <h2 className="text-2xl font-extrabold tracking-tight text-[#112419] leading-snug">
                  {listing.title}
                </h2>

                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono-tabular text-2xl sm:text-3xl font-bold text-[#0A462C]">
                    {formatMYR(listing.price)}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      listing.status === 'available' && !showcaseReserved
                        ? 'text-[#0A462C]'
                        : 'text-amber-700'
                    }`}
                  >
                    {statusText}
                  </span>
                </div>

                <p className="text-sm text-[#2A3B31] leading-relaxed whitespace-pre-line border-t border-black/10 pt-4">
                  {listing.description}
                </p>

                <div className="border-t border-black/10 pt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-[#4A5D50]">Listed by</p>
                    <p className="text-sm font-bold text-[#112419]">
                      {listing.sellerName}
                    </p>
                  </div>
                  {listing.sellerVerifiedUtm ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A462C]">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verified UTM</span>
                    </span>
                  ) : (
                    <span className="text-xs text-[#4A5D50]">Campus Member</span>
                  )}
                </div>

                {/* Compact AI Price & Handover Check */}
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => void handleLoadInsights()}
                    className="w-full py-2 px-3.5 rounded-xl bg-[#DCE8D5]/70 hover:bg-[#DCE8D5] border border-[#0A462C]/15 text-xs font-bold text-[#0A462C] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {aiLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-[#659A73]" />
                    )}
                    <span>
                      {aiLoading
                        ? 'Checking price & pickup...'
                        : aiInsights
                          ? 'Hide AI Handover Check'
                          : 'AI Fair-Price & Handover Check'}
                    </span>
                  </button>

                  {aiError && (
                    <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                      {aiError}
                    </p>
                  )}

                  {aiInsights && (
                    <div className="rounded-xl bg-[#F3F3EE]/90 border border-[#0A462C]/15 p-3 space-y-1.5 text-xs text-[#2A3B31]">
                      <p className="font-bold text-[#0A462C]">{aiInsights.priceVerdict}</p>
                      <ul className="space-y-0.5 list-disc list-inside text-[11px]">
                        {aiInsights.inspectionChecklist.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-[#4A5D50] pt-1 border-t border-black/5">
                        Tip: {aiInsights.meetupTip}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2 border-t border-black/10">
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToMyListings();
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] transition-colors cursor-pointer"
                  >
                    Manage in My Listings
                  </button>
                ) : isReserver ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToReservations();
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] transition-colors cursor-pointer"
                  >
                    Open Reservation & Campus Chat
                  </button>
                ) : listing.isShowcase ? (
                  <>
                    {showcaseReserved ? (
                      <button
                        type="button"
                        onClick={() => void onReserveListing(listing)}
                        className="w-full py-3 px-4 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Open Chat with Seller</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleReserveClick}
                        className="w-full py-3 px-4 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Reserve &amp; Chat with Seller</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCreateSimilar(listing);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl border border-black/15 text-[#112419] text-xs font-semibold hover:bg-[#F3F3EE] transition-colors cursor-pointer"
                    >
                      Sell a Similar Item on UTM
                    </button>
                  </>
                ) : listing.status === 'available' ? (
                  <button
                    type="button"
                    disabled={reserving}
                    onClick={handleReserveClick}
                    className="w-full py-3 px-4 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>
                      {reserving
                        ? 'Reserving...'
                        : user
                          ? 'Reserve Object for Campus Pickup'
                          : 'Sign In to Reserve Object'}
                    </span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-[#F3F3EE] text-center text-xs font-medium text-[#4A5D50]">
                    This object is currently {listing.status}.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onOpenFullDetail(listing)}
                  className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-[#4A5D50] hover:text-[#0A462C] hover:bg-[#F3F3EE] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Open Full Page View</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
