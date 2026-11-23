import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Loader2, Plus, Search, Sparkles, X } from 'lucide-react';
import {
  Listing,
  ListingCategory,
  ListingStatus,
  ListingType,
} from '../types/marketplace';
import { formatMYR, resolveAssetUrl } from '../data/utmCatalog';
import { AiConciergeResult, requestAiCampusConcierge } from '../lib/aiClient';

interface CatalogViewProps {
  listings: Listing[];
  wishlistIds: Set<string>;
  onToggleWishlist: (listing: Listing) => Promise<void>;
  onSelectListing: (listing: Listing) => void;
  onOpenCreateModal: () => void;
}

const CATEGORIES: Array<'All' | ListingCategory> = [
  'All',
  'Electronics',
  'Books',
  'Mobility',
  'Lifestyle',
  'Clothing',
  'Services',
  'Other',
];

const AI_QUICK_QUERIES = [
  'Exam calculator or textbooks under RM 80',
  'Quiet study gear for PSZ Library',
  'Campus commute or hostel desk upgrade',
];

export const CatalogView: React.FC<CatalogViewProps> = ({
  listings,
  wishlistIds,
  onToggleWishlist,
  onSelectListing,
  onOpenCreateModal,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | ListingCategory>('All');
  const [typeFilter, setTypeFilter] = useState<'all' | ListingType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ListingStatus>('all');

  // AI Campus Finder state
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<AiConciergeResult | null>(null);

  const aiMatchMap = useMemo(() => {
    const map = new Map<string, string>();
    aiResult?.matches.forEach((m) => map.set(m.id, m.reason));
    return map;
  }, [aiResult]);

  const handleAskAi = async (customQuery?: string) => {
    const clean = (customQuery ?? aiQuery).trim();
    if (!clean || aiLoading) return;
    if (customQuery) setAiQuery(customQuery);
    setAiLoading(true);
    setAiError('');
    try {
      const res = await requestAiCampusConcierge(clean, listings);
      setAiResult(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not run AI search.');
    } finally {
      setAiLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = listings.filter((item) => {
      const matchesText =
        !q ||
        `${item.title} ${item.description} ${item.category} ${item.campusZone}`
          .toLowerCase()
          .includes(q);
      const matchesCat = category === 'All' || item.category === category;
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesText && matchesCat && matchesType && matchesStatus;
    });

    if (aiMatchMap.size === 0) return base;
    return [...base].sort((a, b) => {
      const aMatched = aiMatchMap.has(a.id) ? 0 : 1;
      const bMatched = aiMatchMap.has(b.id) ? 0 : 1;
      return aMatched - bMatched;
    });
  }, [listings, search, category, typeFilter, statusFilter, aiMatchMap]);

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-10 py-10 md:py-14">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#659A73] mb-2">
            UTM Skudai Marketplace
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#112419]">
            Browse All{' '}
            <span className="font-display-serif italic font-normal text-utm-gradient">
              Campus Objects
            </span>
          </h1>
        </div>

        <button
          type="button"
          onClick={onOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] transition-colors inline-flex items-center gap-2 self-start md:self-auto whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>List New Object</span>
        </button>
      </div>

      {/* Interactive AI Campus Finder */}
      <div className="glass-surface border border-[#0A462C]/15 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0A462C]">
            <Sparkles className="w-4 h-4 text-[#659A73]" />
            <span>Ask UTM AI Finder</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {AI_QUICK_QUERIES.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => void handleAskAi(sample)}
                className="px-2.5 py-1 rounded-lg bg-[#DCE8D5]/65 hover:bg-[#DCE8D5] text-[11px] font-semibold text-[#0A462C] transition-colors cursor-pointer"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleAskAi();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            placeholder="Describe what you need at UTM (e.g. 'study headphones under RM 200 near Meranti')..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-[#0A462C]/15 text-base sm:text-sm text-[#112419] placeholder:text-[#7A8A7F]"
          />
          <button
            type="submit"
            disabled={aiLoading || !aiQuery.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            {aiLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{aiLoading ? 'Matching...' : 'Find with AI'}</span>
          </button>
        </form>

        {aiError && (
          <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {aiError}
          </p>
        )}

        {aiResult && (
          <div className="rounded-xl bg-[#DCE8D5]/55 border border-[#0A462C]/15 px-4 py-3 flex items-start justify-between gap-3">
            <div className="space-y-1 text-xs sm:text-sm text-[#112419]">
              <p className="font-semibold text-[#0A462C]">
                AI Concierge ({aiResult.matches.length} matched)
              </p>
              <p className="text-[#2A3B31] leading-relaxed">{aiResult.answer}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAiResult(null);
                setAiQuery('');
              }}
              aria-label="Clear AI recommendations"
              className="p-1.5 rounded-lg hover:bg-white/70 text-[#4A5D50] shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-5">
        {CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#0A462C] text-white'
                  : 'bg-white border border-black/10 text-[#4A5D50] hover:text-[#112419]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Search & Secondary Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-8">
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-[#4A5D50] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by keyword, zone, or category..."
            aria-label="Search marketplace objects"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-black/10 text-base sm:text-sm text-[#112419] placeholder:text-[#7A8A7F]"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | ListingType)}
          aria-label="Filter by listing type"
          className="sm:col-span-3 px-3.5 py-2.5 rounded-xl bg-white border border-black/10 text-base sm:text-sm text-[#112419]"
        >
          <option value="all">Items & Services</option>
          <option value="item">Physical Items</option>
          <option value="service">Student Services</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | ListingStatus)}
          aria-label="Filter by availability"
          className="sm:col-span-3 px-3.5 py-2.5 rounded-xl bg-white border border-black/10 text-base sm:text-sm text-[#112419]"
        >
          <option value="all">All Availability</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <div className="glass-surface border border-[#0A462C]/12 rounded-2xl p-12 text-center">
          <p className="text-base font-bold text-[#112419]">
            No matching objects found
          </p>
          <p className="text-sm text-[#4A5D50] mt-1 mb-5">
            Try clearing your search or switch to another category.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategory('All');
              setTypeFilter('all');
              setStatusFilter('all');
              setAiResult(null);
            }}
            className="px-4 py-2 rounded-lg border border-black/15 text-sm font-semibold text-[#112419] hover:bg-[#F3F3EE] cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {filtered.map((item, idx) => {
            const wished = wishlistIds.has(item.id);
            const aiReason = aiMatchMap.get(item.id);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.22,
                  delay: Math.min(idx * 0.03, 0.25),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={`group relative glass-surface rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-200 flex flex-col ${
                  aiReason
                    ? 'border-2 border-[#0A462C]/55 ring-2 ring-[#659A73]/25'
                    : 'border border-[#0A462C]/12'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void onToggleWishlist(item)}
                  aria-label={wished ? `Remove ${item.title} from wishlist` : `Save ${item.title} to wishlist`}
                  className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-black/10 flex items-center justify-center shadow-sm hover:scale-110 transition-transform cursor-pointer"
                >
                  <Heart
                    className={`w-4 h-4 transition-colors ${
                      wished ? 'fill-[#0A462C] text-[#0A462C]' : 'text-[#4A5D50]'
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => onSelectListing(item)}
                  className="text-left flex-1 flex flex-col cursor-pointer"
                >
                  <div className="aspect-[4/3] w-full bg-[#E3ECE0] overflow-hidden relative">
                    <img
                      src={resolveAssetUrl(item.imageUrl)}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#4A5D50] mb-1.5">
                        <span>
                          {item.category} · {item.condition}
                        </span>
                        <span
                          className={`font-semibold capitalize ${
                            item.status === 'available'
                              ? 'text-[#0A462C]'
                              : 'text-amber-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <h2 className="text-base font-bold text-[#112419] group-hover:text-[#0A462C] transition-colors leading-snug line-clamp-1">
                        {item.title}
                      </h2>

                      {aiReason ? (
                        <p className="text-xs font-medium text-[#0A462C] mt-1.5 bg-[#DCE8D5]/55 rounded-lg px-2.5 py-1.5 leading-relaxed">
                          AI Match: {aiReason}
                        </p>
                      ) : (
                        <p className="text-xs text-[#4A5D50] mt-1.5 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-black/5 flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-base font-bold text-[#0A462C]">
                        {formatMYR(item.price)}
                      </span>
                      <span className="text-xs text-[#4A5D50] truncate max-w-[160px]">
                        {item.campusZone.split('(')[0].trim()}
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
