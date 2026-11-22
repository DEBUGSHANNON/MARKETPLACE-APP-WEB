import {
  Listing,
  ListingCategory,
  ListingCondition,
  ListingType,
} from '../types/marketplace';

export interface AiListingDraft {
  title: string;
  description: string;
  price: number;
  category: ListingCategory;
  type: ListingType;
  condition: ListingCondition;
  campusZone: string;
  priceNote: string;
}

export interface AiConciergeMatch {
  id: string;
  reason: string;
}

export interface AiConciergeResult {
  answer: string;
  matches: AiConciergeMatch[];
}

export interface AiListingInsights {
  priceVerdict: string;
  inspectionChecklist: string[];
  meetupTip: string;
}

async function postAiJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `AI request failed (${res.status}).`,
    );
  }
  return data as T;
}

export function requestAiListingDraft(payload: {
  prompt: string;
  imageBase64?: string;
  imageMimeType?: string;
}): Promise<AiListingDraft> {
  return postAiJson<AiListingDraft>('/api/ai/draft-listing', payload);
}

export function requestAiCampusConcierge(
  query: string,
  listings: Listing[],
): Promise<AiConciergeResult> {
  return postAiJson<AiConciergeResult>('/api/ai/campus-concierge', {
    query,
    listings: listings.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      price: l.price,
      category: l.category,
      condition: l.condition,
      campusZone: l.campusZone,
      status: l.status,
    })),
  });
}

export function requestAiListingInsights(
  listing: Listing,
): Promise<AiListingInsights> {
  return postAiJson<AiListingInsights>('/api/ai/listing-insights', {
    listing: {
      title: listing.title,
      description: listing.description,
      price: listing.price,
      category: listing.category,
      condition: listing.condition,
      campusZone: listing.campusZone,
      type: listing.type,
    },
  });
}

export function requestAiChatSuggestions(payload: {
  role: 'buyer' | 'seller';
  listingTitle: string;
  listingPrice: number;
  handoverLocation?: string;
  recentMessages: Array<{ sender: string; text: string }>;
}): Promise<{ suggestions: string[] }> {
  return postAiJson<{ suggestions: string[] }>('/api/ai/chat-reply', payload);
}
