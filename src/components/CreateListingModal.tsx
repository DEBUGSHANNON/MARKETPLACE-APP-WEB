import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Sparkles, X } from 'lucide-react';
import {
  Listing,
  ListingCategory,
  ListingCondition,
  ListingType,
} from '../types/marketplace';
import { STUDIO_PRESET_IMAGES, UTM_CAMPUS_ZONES } from '../data/utmCatalog';
import { requestAiListingDraft } from '../lib/aiClient';

interface CreateListingModalProps {
  open: boolean;
  onClose: () => void;
  prefill?: Listing | null;
  onSubmit: (data: {
    title: string;
    description: string;
    price: number;
    category: ListingCategory;
    type: ListingType;
    condition: ListingCondition;
    campusZone: string;
    imageUrl: string;
  }) => Promise<void>;
}

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  open,
  onClose,
  prefill,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('45');
  const [category, setCategory] = useState<ListingCategory>('Electronics');
  const [type, setType] = useState<ListingType>('item');
  const [condition, setCondition] = useState<ListingCondition>('Like New');
  const [campusZone, setCampusZone] = useState(UTM_CAMPUS_ZONES[0].name);
  const [imageUrl, setImageUrl] = useState(STUDIO_PRESET_IMAGES[0].url);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // AI Listing Assistant state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiPriceNote, setAiPriceNote] = useState('');
  const [aiPhotoName, setAiPhotoName] = useState('');
  const [aiPhotoBase64, setAiPhotoBase64] = useState<string | undefined>(undefined);
  const [aiPhotoMimeType, setAiPhotoMimeType] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && prefill) {
      setTitle(prefill.title);
      setDescription(prefill.description);
      setPrice(String(prefill.price));
      setCategory(prefill.category);
      setType(prefill.type);
      setCondition(prefill.condition);
      setCampusZone(prefill.campusZone);
      setImageUrl(prefill.imageUrl);
      setError('');
      setAiPriceNote('');
    } else if (open && !prefill) {
      setTitle('');
      setDescription('');
      setPrice('45');
      setCategory('Electronics');
      setType('item');
      setCondition('Like New');
      setCampusZone(UTM_CAMPUS_ZONES[0].name);
      setImageUrl(STUDIO_PRESET_IMAGES[0].url);
      setError('');
      setAiPrompt('');
      setAiPriceNote('');
      setAiPhotoName('');
      setAiPhotoBase64(undefined);
      setAiPhotoMimeType(undefined);
    }
  }, [open, prefill]);

  if (!open) return null;

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file for AI inspection.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx !== -1) {
        setAiPhotoBase64(result.slice(commaIdx + 1));
        setAiPhotoMimeType(file.type);
        setAiPhotoName(file.name);
        setError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAiDraft = async () => {
    if (!aiPrompt.trim() && !aiPhotoBase64) {
      setError('Tell the AI what you are selling or upload a photo first.');
      return;
    }
    setError('');
    setAiDrafting(true);
    try {
      const draft = await requestAiListingDraft({
        prompt: aiPrompt.trim(),
        imageBase64: aiPhotoBase64,
        imageMimeType: aiPhotoMimeType,
      });
      setTitle(draft.title || '');
      setDescription(draft.description || '');
      if (Number.isFinite(draft.price)) {
        setPrice(String(draft.price));
      }
      if (draft.category) setCategory(draft.category);
      if (draft.type) setType(draft.type);
      if (draft.condition) setCondition(draft.condition);
      if (draft.campusZone) setCampusZone(draft.campusZone);
      setAiPriceNote(draft.priceNote || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI assistant could not draft this listing.');
    } finally {
      setAiDrafting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const numericPrice = Number(price);
    if (!title.trim() || !description.trim()) {
      setError('Please enter a title and description.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 0 || numericPrice > 100000) {
      setError('Please enter a valid price between RM 0 and RM 100,000.');
      return;
    }
    const cleanImg = imageUrl.trim();
    if (
      cleanImg &&
      !cleanImg.startsWith('/src/assets/images/') &&
      !cleanImg.startsWith('https://')
    ) {
      setError('Image URL must start with https:// or use a studio preset.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim().slice(0, 100),
        description: description.trim().slice(0, 2000),
        price: Math.round(numericPrice * 100) / 100,
        category,
        type,
        condition,
        campusZone,
        imageUrl: cleanImg || STUDIO_PRESET_IMAGES[0].url,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-listing-title"
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#F3F3EE] border border-black/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold text-[#659A73] uppercase tracking-wider">
              CampusTrade UTM
            </p>
            <h2
              id="create-listing-title"
              className="text-2xl font-extrabold tracking-tight text-[#112419] mt-1"
            >
              List an Object or Service
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg hover:bg-black/5 text-[#4A5D50] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Smart Listing Assistant */}
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#DCE8D5]/80 via-white/90 to-[#EBF2E8] border border-[#0A462C]/15 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A462C]">
              <Sparkles className="w-4 h-4 text-[#659A73]" />
              <span>AI Listing Studio</span>
            </span>
            <span className="text-[11px] text-[#4A5D50]">
              Auto-fills title, fair RM price &amp; UTM pickup zone
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Logitech mouse used 1 sem, works great, pickup at N28"
              className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-[#0A462C]/15 text-xs sm:text-sm text-[#112419] placeholder:text-[#7A8A7F]"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-white border border-[#0A462C]/15 text-xs font-semibold text-[#0A462C] hover:bg-[#F3F3EE] inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{aiPhotoName ? 'Photo Ready' : 'Scan Photo'}</span>
            </button>
            <button
              type="button"
              disabled={aiDrafting}
              onClick={() => void handleAiDraft()}
              className="px-4 py-2 rounded-xl bg-[#0A462C] text-white text-xs font-semibold hover:bg-[#0E5D3B] disabled:opacity-55 inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              {aiDrafting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{aiDrafting ? 'Drafting...' : 'AI Auto-Draft'}</span>
            </button>
          </div>

          {(aiPhotoName || aiPriceNote) && (
            <div className="text-[11px] text-[#0A462C] flex flex-wrap items-center justify-between gap-2 pt-0.5">
              {aiPriceNote && (
                <span className="font-medium">AI Price Tip: {aiPriceNote}</span>
              )}
              {aiPhotoName && (
                <button
                  type="button"
                  onClick={() => {
                    setAiPhotoName('');
                    setAiPhotoBase64(undefined);
                    setAiPhotoMimeType(undefined);
                  }}
                  className="text-[#4A5D50] hover:text-[#112419] underline cursor-pointer"
                >
                  Clear scanned photo ({aiPhotoName})
                </button>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#112419] mb-1.5">
              Object Title
            </label>
            <input
              type="text"
              maxLength={100}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Casio fx-570EX Scientific Calculator"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-black/10 text-sm text-[#112419]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#112419] mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ListingCategory)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-black/10 text-sm text-[#112419]"
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
              <label className="block text-xs font-semibold text-[#112419] mb-1.5">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ListingCondition)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-black/10 text-sm text-[#112419]"
              >
                <option value="New">New</option>
                <option value="Like New">Like New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Used">Used</option>
                <option value="Not specified">Not specified</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#112419] mb-1.5">
                Price (RM)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-black/10 text-sm font-mono-tabular text-[#112419]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#112419] mb-1.5">
                Listing Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ListingType)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-black/10 text-sm text-[#112419]"
              >
                <option value="item">Physical Item</option>
                <option value="service">Student Service</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#112419] mb-1.5">
                Preferred UTM Pickup Zone
              </label>
              <select
                value={campusZone}
                onChange={(e) => setCampusZone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-black/10 text-sm text-[#112419]"
              >
                {UTM_CAMPUS_ZONES.map((z) => (
                  <option key={z.id} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#112419] mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe condition, included accessories, and preferred handover times..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-black/10 text-sm text-[#112419]"
            />
          </div>

          {/* Studio Photo Picker + Custom HTTPS URL */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#112419]">
              Object Photo (Choose a Studio Preset or Paste HTTPS URL)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {STUDIO_PRESET_IMAGES.map((preset) => {
                const selected = imageUrl === preset.url;
                return (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setImageUrl(preset.url)}
                    className={`rounded-xl overflow-hidden border-2 transition-all aspect-[4/3] cursor-pointer ${
                      selected
                        ? 'border-[#0A462C] ring-2 ring-[#0A462C]/25'
                        : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... or /src/assets/images/..."
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-black/10 text-xs text-[#4A5D50]"
            />
          </div>

          {error && (
            <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-black/15 text-sm font-semibold text-[#112419] hover:bg-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#0A462C] text-white text-sm font-semibold hover:bg-[#0E5D3B] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Publishing...' : 'Publish to UTM Sphere'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
