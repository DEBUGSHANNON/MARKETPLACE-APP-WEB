import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Check, Database, Edit3, Loader2, MessageSquare, Plus, Trash2, X } from 'lucide-react';
import {
  Listing,
  ListingCategory,
  ListingCondition,
  Reservation,
} from '../types/marketplace';
import { formatMYR, resolveAssetUrl, UTM_CAMPUS_ZONES } from '../data/utmCatalog';

interface MyListingsViewProps {
  user: User | null;
  listings: Listing[];
  reservations: Reservation[];
  onSignIn: () => void;
  onOpenCreateModal: () => void;
  onSeedListings: () => Promise<void>;
  onSelectListing: (listing: Listing) => void;
  onOpenChat: (reservation: Reservation) => void;
  onUpdateListing: (
    listingId: string,
    updates: {
      title: string;
      description: string;
      price: number;
      category: ListingCategory;
      condition: ListingCondition;
      campusZone: string;
    },
  ) => Promise<void>;
  onMarkSold: (listing: Listing) => Promise<void>;
  onDeleteListing: (listing: Listing) => Promise<void>;
}

export const MyListingsView: React.FC<MyListingsViewProps> = ({
  user,
  listings,
  reservations,
  onSignIn,
  onOpenCreateModal,
  onSeedListings,
  onSelectListing,
  onOpenChat,
  onUpdateListing,
  onMarkSold,
  onDeleteListing,
}) => {
  const [editing, setEditing] = useState<Listing | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [category, setCategory] = useState<ListingCategory>('Electronics');
  const [condition, setCondition] = useState<ListingCondition>('Good');
  const [campusZone, setCampusZone] = useState(UTM_CAMPUS_ZONES[0].name);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-5 md:px-10 py-16 text-center">
        <div className="bg-white border border-black/10 rounded-2xl p-10">
          <p className="text-xs font-semibold text-[#4A5D50] mb-2">
            CampusTrade UTM
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#112419] mb-3">
            Sign in to manage your listings
          </h1>
          <p className="text-sm text-[#4A5D50] max-w-md mx-auto mb-6">
            Publish pre-loved textbooks, electronics, bicycles, and student
            services directly to the 3D Orbit Sphere (<span className="font-semibold text-[#0A462C]">@graduate.utm.my</span> only).
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="px-5 py-3 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] cursor-pointer"
          >
            Sign In with UTM Google (@graduate.utm.my)
          </button>
        </div>
      </div>
    );
  }

  const myItems = listings.filter((item) => item.sellerId === user.uid);
  const availableCount = myItems.filter((i) => i.status === 'available').length;
  const reservedCount = myItems.filter((i) => i.status === 'reserved').length;

  const openEdit = (item: Listing) => {
    setEditing(item);
    setTitle(item.title);
    setDescription(item.description);
    setPrice(String(item.price));
    setCategory(item.category);
    setCondition(item.condition);
    setCampusZone(item.campusZone);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const numericPrice = Number(price);
    if (!title.trim() || !description.trim() || !Number.isFinite(numericPrice) || numericPrice < 0) {
      return;
    }
    setSaving(true);
    try {
      await onUpdateListing(editing.id, {
        title: title.trim().slice(0, 100),
        description: description.trim().slice(0, 2000),
        price: Math.round(numericPrice * 100) / 100,
        category,
        condition,
        campusZone,
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-10 py-10 md:py-14">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#659A73] mb-2">
            Seller Studio
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#112419]">
            My{' '}
            <span className="font-display-serif italic font-normal text-utm-gradient">
              Listings
            </span>
          </h1>
          <p className="text-sm text-[#4A5D50] mt-2 font-mono-tabular">
            {myItems.length} Total · {availableCount} Available · {reservedCount}{' '}
            Reserved
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] inline-flex items-center gap-2 self-start md:self-auto whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>List New Object</span>
        </button>
      </div>

      {myItems.length === 0 ? (
        <div className="glass-surface border border-[#0A462C]/12 rounded-3xl p-12 text-center shadow-sm">
          <p className="text-base font-bold text-[#112419]">
            You haven&apos;t published any listings yet
          </p>
          <p className="text-sm text-[#4A5D50] mt-1 mb-6 max-w-md mx-auto">
            Share an object with the UTM community or publish 6 ready-made
            sample items straight into Firebase for buyer/seller testing.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-4 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] cursor-pointer"
            >
              Publish Your First Object
            </button>
            <button
              type="button"
              disabled={seeding}
              onClick={async () => {
                setSeeding(true);
                try {
                  await onSeedListings();
                } finally {
                  setSeeding(false);
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-white border border-[#0A462C]/20 text-sm font-semibold text-[#0A462C] hover:bg-[#DCE8D5]/55 disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              <span>
                {seeding ? 'Saving to Firebase...' : 'Seed 6 Sample Listings'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {myItems.map((item) => {
            const matchedReservation = reservations.find(
              (r) => r.listingId === item.id,
            );
            return (
              <article
                key={item.id}
                className="glass-surface border border-[#0A462C]/12 rounded-2xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
              <button
                type="button"
                onClick={() => onSelectListing(item)}
                className="aspect-[4/3] w-full bg-[#E3ECE0] overflow-hidden cursor-pointer"
              >
                <img
                  src={resolveAssetUrl(item.imageUrl)}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </button>

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-[#4A5D50] mb-1">
                    <span>{item.category}</span>
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
                  <h2 className="text-base font-bold text-[#112419] line-clamp-1">
                    {item.title}
                  </h2>
                  <p className="font-mono-tabular text-base font-bold text-[#0A462C] mt-1.5">
                    {formatMYR(item.price)}
                  </p>
                </div>

                <div className="pt-3 border-t border-black/5 flex flex-wrap items-center gap-2">
                  {item.status !== 'sold' && (
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="flex-1 py-2 px-3 rounded-lg border border-black/15 text-xs font-semibold text-[#112419] hover:bg-[#F3F3EE] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}

                  {item.status === 'reserved' && matchedReservation && (
                    <button
                      type="button"
                      onClick={() => onOpenChat(matchedReservation)}
                      className="flex-1 py-2 px-3 rounded-lg border border-[#0A462C]/25 text-xs font-semibold text-[#0A462C] hover:bg-[#DCE8D5]/60 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>
                  )}

                  {item.status === 'reserved' && (
                    <button
                      type="button"
                      onClick={() => void onMarkSold(item)}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#0A462C] text-white text-xs font-semibold hover:bg-[#0E5D3B] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark Sold</span>
                    </button>
                  )}

                  {item.status === 'available' && (
                    <button
                      type="button"
                      onClick={() => void onDeleteListing(item)}
                      aria-label={`Delete ${item.title}`}
                      className="py-2 px-3 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-listing-title"
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-[#F3F3EE] border border-black/10 rounded-2xl w-full max-w-lg p-6 md:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2
                id="edit-listing-title"
                className="text-xl font-extrabold text-[#112419]"
              >
                Edit Listing
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close edit modal"
                className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
              >
                <X className="w-5 h-5 text-[#4A5D50]" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Title</label>
                <input
                  type="text"
                  maxLength={100}
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-black/10 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Price (RM)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-black/10 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as ListingCondition)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-black/10 text-sm"
                  >
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Used">Used</option>
                    <option value="Not specified">Not specified</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ListingCategory)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-black/10 text-sm"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Books">Books</option>
                    <option value="Mobility">Mobility</option>
                    <option value="Lifestyle">Lifestyle</option>
                    <option value="Clothing">Clothing</option>
                    <option value="Services">Services</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Pickup Zone
                  </label>
                  <select
                    value={campusZone}
                    onChange={(e) => setCampusZone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-black/10 text-sm"
                  >
                    {UTM_CAMPUS_ZONES.map((z) => (
                      <option key={z.id} value={z.name}>
                        {z.shortName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-black/10 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-xl border border-black/15 text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
