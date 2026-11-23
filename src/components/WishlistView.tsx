import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { motion } from 'motion/react';
import { ArrowUpRight, Compass, Heart, Loader2 } from 'lucide-react';
import { Listing, WishlistItem } from '../types/marketplace';
import { formatMYR, resolveAssetUrl } from '../data/utmCatalog';
import {
  AuthLoadingSkeleton,
  ListingGridSkeleton,
  SyncErrorCard,
} from './NetworkStateViews';

interface WishlistViewProps {
  user: User | null;
  authLoading?: boolean;
  signingIn?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  wishlistItems: WishlistItem[];
  allListings: Listing[];
  onSignIn: () => void;
  onSelectListing: (listing: Listing) => void;
  onToggleWishlist: (listing: Listing) => Promise<void>;
  onNavigateHome: () => void;
  onBrowseCatalog: () => void;
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  user,
  authLoading = false,
  signingIn = false,
  loading = false,
  error = null,
  onRetry,
  wishlistItems,
  allListings,
  onSignIn,
  onSelectListing,
  onToggleWishlist,
  onNavigateHome,
  onBrowseCatalog,
}) => {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  if (authLoading) {
    return <AuthLoadingSkeleton label="Loading your wishlist..." />;
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-5 md:px-10 py-16 text-center">
        <div className="glass-surface border border-[#0A462C]/12 rounded-3xl p-10 shadow-sm">
          <p className="text-xs font-semibold text-[#659A73] mb-2 uppercase tracking-wider">
            Saved Campus Finds
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#112419] mb-3">
            Sign in to view your{' '}
            <span className="font-display-serif italic font-normal text-utm-gradient">
              Wishlist
            </span>
          </h1>
          <p className="text-sm text-[#4A5D50] max-w-md mx-auto mb-6">
            Bookmark textbooks, gadgets, and campus essentials using your{' '}
            <span className="font-semibold text-[#0A462C]">@graduate.utm.my</span> student account.
          </p>
          <button
            type="button"
            disabled={signingIn}
            onClick={onSignIn}
            className="px-5 py-3 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] disabled:opacity-65 transition-colors inline-flex items-center gap-2 cursor-pointer"
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

  const resolveListing = (item: WishlistItem): Listing => {
    const live = allListings.find((l) => l.id === item.listingId);
    if (live) return live;
    return {
      id: item.listingId,
      title: item.title,
      description: 'Saved in your UTM wishlist.',
      price: item.price,
      category: item.category,
      type: 'item',
      condition: 'Good',
      campusZone: item.campusZone,
      imageUrl: item.imageUrl,
      sellerId: '',
      sellerName: item.sellerName,
      sellerVerifiedUtm: true,
      status: 'available',
    };
  };

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-10 py-10 md:py-14">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <p className="text-xs font-semibold text-[#659A73] uppercase tracking-wider mb-2">
            Curated by You
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#112419]">
            My{' '}
            <span className="font-display-serif italic font-normal text-utm-gradient">
              Wishlist
            </span>
          </h1>
          <p className="text-sm text-[#4A5D50] mt-2 font-mono-tabular">
            {wishlistItems.length} saved {wishlistItems.length === 1 ? 'object' : 'objects'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onNavigateHome}
            className="px-4 py-2.5 rounded-xl glass-surface border border-[#0A462C]/15 text-xs font-semibold text-[#0A462C] hover:bg-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Compass className="w-4 h-4" />
            <span>Explore Sphere</span>
          </button>
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="px-4 py-2.5 rounded-xl bg-[#0A462C] text-white text-xs font-semibold hover:bg-[#0E5D3B] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Browse Catalog</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && onRetry && (
        <div className="mb-6">
          <SyncErrorCard
            compact={wishlistItems.length > 0}
            title="Could not sync wishlist"
            message={error}
            onRetry={onRetry}
          />
        </div>
      )}

      {loading && wishlistItems.length === 0 ? (
        <ListingGridSkeleton count={3} />
      ) : wishlistItems.length === 0 ? (
        <div className="glass-surface border border-[#0A462C]/12 rounded-3xl p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#DCE8D5] text-[#0A462C] flex items-center justify-center mx-auto mb-4">
            <Heart className="w-5 h-5" />
          </div>
          <p className="text-base font-bold text-[#112419]">
            Your wishlist is empty
          </p>
          <p className="text-sm text-[#4A5D50] mt-1 mb-6 max-w-md mx-auto">
            Tap the heart icon on any object in the 3D Orbit Sphere pop-up or
            Catalog to save it here.
          </p>
          <button
            type="button"
            onClick={onNavigateHome}
            className="px-5 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] transition-colors cursor-pointer"
          >
            Discover Items on Sphere
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {wishlistItems.map((wish, idx) => {
            const listing = resolveListing(wish);
            return (
              <motion.div
                key={wish.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.24) }}
                className="group glass-surface border border-[#0A462C]/12 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-200 flex flex-col relative"
              >
                <button
                  type="button"
                  disabled={togglingId === listing.id}
                  onClick={async () => {
                    setTogglingId(listing.id);
                    try {
                      await onToggleWishlist(listing);
                    } finally {
                      setTogglingId(null);
                    }
                  }}
                  aria-label={`Remove ${listing.title} from wishlist`}
                  className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-black/10 text-[#0A462C] flex items-center justify-center shadow-sm hover:scale-110 disabled:opacity-60 transition-transform cursor-pointer"
                >
                  {togglingId === listing.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0A462C]" />
                  ) : (
                    <Heart className="w-4 h-4 fill-[#0A462C] text-[#0A462C]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onSelectListing(listing)}
                  className="text-left flex-1 flex flex-col cursor-pointer"
                >
                  <div className="aspect-[4/3] w-full bg-[#E3ECE0] overflow-hidden">
                    <img
                      src={resolveAssetUrl(listing.imageUrl)}
                      alt={listing.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#4A5D50] mb-1.5">
                        <span>{listing.category}</span>
                        <span
                          className={`font-semibold capitalize ${
                            listing.status === 'available'
                              ? 'text-[#0A462C]'
                              : 'text-amber-700'
                          }`}
                        >
                          {listing.status}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-[#112419] group-hover:text-[#0A462C] transition-colors line-clamp-1">
                        {listing.title}
                      </h2>
                      <p className="text-xs text-[#4A5D50] mt-1">
                        Seller: {listing.sellerName}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-black/5 flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-base font-bold text-[#0A462C]">
                        {formatMYR(listing.price)}
                      </span>
                      <span className="text-xs text-[#4A5D50] truncate max-w-[160px]">
                        {listing.campusZone.split('(')[0].trim()}
                      </span>
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
