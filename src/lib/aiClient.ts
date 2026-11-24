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

const DEFAULT_GITHUB_PAGES_API_BASE = 'https://marketplace-app-web.onrender.com';

function resolveApiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'debugshannon.github.io'
  ) {
    return DEFAULT_GITHUB_PAGES_API_BASE;
  }
  return '';
}

const API_BASE = resolveApiBase();
const AI_REQUEST_TIMEOUT_MS = 35000;

async function postAiJson<T>(url: string, body: unknown): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(
      'You are currently offline. Reconnect to use UTM AI tools.',
    );
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        'The AI server is taking a moment to respond (it may be waking up). Please retry in a few seconds.',
      );
    }
    throw new Error(
      'Network connection interrupted while contacting UTM AI. Check your signal and retry.',
    );
  } finally {
    window.clearTimeout(timer);
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {};
  if (!res.ok) {
    if (
      (res.status === 404 || res.status === 405) &&
      typeof window !== 'undefined' &&
      window.location.hostname.endsWith('github.io')
    ) {
      throw new Error(
        'AI features need the Node.js server (GitHub Pages hosts the frontend only). Run locally with npm run dev or use the AI Studio / Render link for AI tools.',
      );
    }
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
