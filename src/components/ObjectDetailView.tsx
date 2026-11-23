import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import {
  ArrowLeft,
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

interface ObjectDetailViewProps {
  listing: Listing;
  allListings: Listing[];
  user: User | null;
  isWishlisted: boolean;
  onToggleWishlist: (listing: Listing) => Promise<void>;
  onBack: () => void;
  backLabel: string;
  onSelectListing: (listing: Listing) => void;
  onReserveListing: (listing: Listing) => Promise<void>;
  onNavigateToReservations: () => void;
  onNavigateToMyListings: () => void;
  onSignIn: () => void;
  onOpenCreateSimilar: (listing: Listing) => void;
}

export const ObjectDetailView: React.FC<ObjectDetailViewProps> = ({
  listing,
  allListings,
  user,
  isWishlisted,
  onToggleWishlist,
  onBack,
  backLabel,
  onSelectListing,
  onReserveListing,
  onNavigateToReservations,
  onNavigateToMyListings,
  onSignIn,
  onOpenCreateSimilar,
}) => {
  const [reserving, setReserving] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showcaseReserved, setShowcaseReserved] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [aiInsights, setAiInsights] = useState<AiListingInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  React.useEffect(() => {
    setAiInsights(null);
    setAiError('');
    setAiLoading(false);
  }, [listing.id]);

  const handleLoadInsights = async () => {
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

  // Interactive 3D tilt motion on the main object image
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 180, damping: 24 });
  const smoothY = useSpring(mouseY, { stiffness: 180, damping: 24 });
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-6, 6]);
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [6, -6]);

  const handleImagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(nx);
    mouseY.set(ny);
  };

  const handleImagePointerLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const zone = useMemo(
    () =>
      UTM_CAMPUS_ZONES.find((z) => z.name === listing.campusZone) ||
      UTM_CAMPUS_ZONES[0],
    [listing.campusZone],
  );

  const related = useMemo(
    () =>
      allListings
        .filter((item) => item.id !== listing.id)
        .sort((a, b) => {
          if (a.category === listing.category && b.category !== listing.category) return -1;
          if (a.category !== listing.category && b.category === listing.category) return 1;
          return 0;
        })
        .slice(0, 4),
    [allListings, listing.id, listing.category],
  );

  const isOwner = Boolean(user && listing.sellerId === user.uid);
  const isReserver = Boolean(user && listing.reservedBy === user.uid);

  const handleReserveClick = async () => {
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

  const statusText =
    listing.status === 'available' && !showcaseReserved
      ? 'Available for campus pickup'
      : listing.status === 'reserved' || showcaseReserved
        ? 'Reserved'
        : 'Sold';

  return (
    <motion.div
      key={listing.id}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-6xl mx-auto px-5 md:px-10 py-8 md:py-12"
    >
      {/* Back navigation */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#4A5D50] hover:text-[#0A462C] transition-colors mb-8 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{backLabel}</span>
      </button>

      {/* Main 2-column contiguous object detail module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        {/* Left: Interactive 3D Tilt Photo Gallery + UTM Pickup Location Card */}
        <div className="lg:col-span-7 space-y-6">
          <div style={{ perspective: 1000 }}>
            <motion.div
              onPointerMove={handleImagePointerMove}
              onPointerLeave={handleImagePointerLeave}
              style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
              className="relative aspect-[4/3] w-full rounded-2xl bg-white border border-black/10 overflow-hidden shadow-sm group"
            >
              {!imageFailed && listing.imageUrl ? (
                <img
                  src={resolveAssetUrl(listing.imageUrl)}
                  alt={listing.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="w-full h-full bg-[#E3ECE0] flex flex-col items-center justify-center p-6 text-center">
                  <span className="text-sm font-semibold text-[#0A462C]">
                    {listing.category}
                  </span>
                  <span className="text-xs text-[#4A5D50] mt-1">{listing.title}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label="Inspect full-screen object photo"
                className="absolute bottom-4 right-4 px-3 py-2 rounded-lg bg-white/95 border border-black/10 text-xs font-semibold text-[#112419] hover:text-[#0A462C] flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Inspect</span>
              </button>
            </motion.div>
          </div>

          {/* UTM Campus Pickup Mini-Map Preview */}
          <div className="glass-surface border border-[#0A462C]/12 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#4A5D50] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0A462C]" />
                <span>Preferred UTM Campus Pickup</span>
              </p>
              <p className="text-sm font-bold text-[#112419]">{listing.campusZone}</p>
              <p className="text-xs text-[#4A5D50]">
                {zone.area} · Skudai Campus ({zone.lat.toFixed(4)}, {zone.lng.toFixed(4)})
              </p>
            </div>

            <div className="w-full sm:w-44 h-24 rounded-xl bg-[#F3F3EE] border border-black/10 relative overflow-hidden shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
                <path
                  d="M12,72 Q35,45 55,22 T88,65"
                  fill="none"
                  stroke="#0A462C"
                  strokeOpacity="0.18"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={zone.mapX}
                  cy={zone.mapY}
                  r="10"
                  fill="#0A462C"
                  fillOpacity="0.15"
                />
                <circle cx={zone.mapX} cy={zone.mapY} r="4.5" fill="#0A462C" />
              </svg>
              <span className="absolute bottom-1.5 left-2 text-[10px] font-semibold text-[#0A462C]">
                {zone.shortName}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Contiguous Purchase & Reservation Module */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 glass-surface border border-[#0A462C]/12 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              {/* Unboxed clean metadata */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#4A5D50]">
                <span>{listing.category}</span>
                <span aria-hidden="true">·</span>
                <span>{listing.condition}</span>
                <span aria-hidden="true">·</span>
                <span>{listing.type === 'service' ? 'Student Service' : 'Physical Item'}</span>
              </div>

              <button
                type="button"
                onClick={() => void onToggleWishlist(listing)}
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#0A462C]/15 bg-white/80 hover:bg-white text-xs font-semibold text-[#0A462C] transition-colors cursor-pointer shrink-0"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    isWishlisted ? 'fill-[#0A462C] text-[#0A462C]' : 'text-[#4A5D50]'
                  }`}
                />
                <span>{isWishlisted ? 'Saved' : 'Save'}</span>
              </button>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#112419]">
              {listing.title}
            </h1>

            <div className="flex items-baseline justify-between gap-4 pt-1">
              <span className="font-mono-tabular text-3xl font-bold text-[#0A462C]">
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
          </div>

          <div className="border-t border-black/10 pt-5 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4A5D50]">
              About This Object
            </h2>
            <p className="text-sm text-[#2A3B31] leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </div>

          {/* Seller Identity Block */}
          <div className="border-t border-black/10 pt-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[#4A5D50]">Listed by</p>
              <p className="text-sm font-bold text-[#112419]">{listing.sellerName}</p>
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

          {/* Interactive AI Buyer & Handover Insights */}
          <div className="border-t border-black/10 pt-4 space-y-2.5">
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void handleLoadInsights()}
              className="w-full py-2.5 px-4 rounded-xl bg-[#DCE8D5]/65 hover:bg-[#DCE8D5] border border-[#0A462C]/15 text-xs font-bold text-[#0A462C] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {aiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#659A73]" />
              )}
              <span>
                {aiLoading
                  ? 'Analyzing price & handover...'
                  : aiInsights
                    ? 'Hide AI Price & Handover Check'
                    : 'AI Fair-Price & Handover Check'}
              </span>
            </button>

            {aiError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                <span>{aiError}</span>
                <button
                  type="button"
                  onClick={() => void handleLoadInsights()}
                  className="font-semibold underline shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {aiInsights && (
              <div className="rounded-xl bg-white/85 border border-[#0A462C]/15 p-3.5 space-y-2 text-xs text-[#2A3B31]">
                <p className="font-bold text-[#0A462C]">{aiInsights.priceVerdict}</p>
                <ul className="space-y-1 list-disc list-inside">
                  {aiInsights.inspectionChecklist.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-[#4A5D50] pt-1 border-t border-black/5">
                  Handover tip: {aiInsights.meetupTip}
                </p>
              </div>
            )}
          </div>

          {/* Primary Action Area */}
          <div className="border-t border-black/10 pt-5 space-y-3">
            {isOwner ? (
              <button
                type="button"
                onClick={onNavigateToMyListings}
                className="w-full py-3.5 px-5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] transition-colors cursor-pointer"
              >
                Manage in My Listings
              </button>
            ) : isReserver ? (
              <button
                type="button"
                onClick={onNavigateToReservations}
                className="w-full py-3.5 px-5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] transition-colors cursor-pointer"
              >
                Open Reservation & Campus Chat
              </button>
            ) : listing.isShowcase ? (
              <>
                {showcaseReserved ? (
                  <button
                    type="button"
                    onClick={() => void onReserveListing(listing)}
                    className="w-full py-3.5 px-5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Open Chat with Seller</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleReserveClick}
                    className="w-full py-3.5 px-5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Reserve &amp; Chat with Seller</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenCreateSimilar(listing)}
                  className="w-full py-3 px-5 rounded-xl border border-black/15 text-[#112419] text-sm font-semibold hover:bg-[#F3F3EE] transition-colors cursor-pointer"
                >
                  Sell a Similar Item on UTM
                </button>
              </>
            ) : listing.status === 'available' ? (
              <button
                type="button"
                disabled={reserving}
                onClick={handleReserveClick}
                className="w-full py-3.5 px-5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
              <div className="p-3.5 rounded-xl bg-[#F3F3EE] text-center text-sm font-medium text-[#4A5D50]">
                This object is currently {listing.status}.
              </div>
            )}

            <p className="text-[11px] text-[#4A5D50] text-center">
              Always meet at public UTM campus landmarks such as PSZ, Arked
              Meranti, or N28.
            </p>
          </div>
        </div>
      </div>

      {/* Related Objects Strip */}
      {related.length > 0 && (
        <section className="mt-16 pt-10 border-t border-black/10">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs font-semibold text-[#4A5D50]">
                Continue exploring
              </p>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#112419] mt-1">
                More Objects Around UTM
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectListing(item)}
                className="group text-left bg-white border border-black/10 rounded-xl overflow-hidden hover:-translate-y-0.5 transition-transform cursor-pointer"
              >
                <div className="aspect-[4/3] bg-[#E3ECE0] overflow-hidden">
                  <img
                    src={resolveAssetUrl(item.imageUrl)}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <p className="text-xs text-[#4A5D50]">
                    {item.category} · {item.condition}
                  </p>
                  <h3 className="text-sm font-bold text-[#112419] mt-1 truncate">
                    {item.title}
                  </h3>
                  <p className="font-mono-tabular text-sm font-semibold text-[#0A462C] mt-1.5">
                    {formatMYR(item.price)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Fullscreen Image Lightbox */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={listing.title}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close image preview"
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white text-[#112419] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={resolveAssetUrl(listing.imageUrl)}
            alt={listing.title}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[86vh] rounded-2xl object-contain"
          />
        </div>
      )}
    </motion.div>
  );
};
