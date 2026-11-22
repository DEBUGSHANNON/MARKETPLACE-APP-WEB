export type AppView =
  | 'orbit'
  | 'catalog'
  | 'detail'
  | 'reservations'
  | 'wishlist'
  | 'messages'
  | 'my-listings'
  | 'profile';

export type ListingCategory =
  | 'Books'
  | 'Electronics'
  | 'Mobility'
  | 'Lifestyle'
  | 'Clothing'
  | 'Services'
  | 'Other';

export type ListingType = 'item' | 'service';

export type ListingCondition =
  | 'New'
  | 'Like New'
  | 'Good'
  | 'Fair'
  | 'Used'
  | 'Not specified';

export type ListingStatus = 'available' | 'reserved' | 'sold';

export type ReservationStatus =
  | 'pending'
  | 'seller_proposed'
  | 'buyer_counter_proposed'
  | 'confirmed';

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: ListingCategory;
  type: ListingType;
  condition: ListingCondition;
  campusZone: string;
  imageUrl: string;
  sellerId: string;
  sellerName: string;
  sellerVerifiedUtm: boolean;
  status: ListingStatus;
  reservedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  isShowcase?: boolean;
}

export interface Reservation {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  status: ReservationStatus;
  handoverLocation: string;
  handoverDate: string;
  handoverTime: string;
  handoverNote: string;
  handoverLat?: number | null;
  handoverLng?: number | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  college?: string;
  dormAddress?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WishlistItem {
  id: string;
  listingId: string;
  title: string;
  price: number;
  category: ListingCategory;
  campusZone: string;
  imageUrl: string;
  sellerName: string;
  createdAt?: unknown;
}

export interface CampusZone {
  id: string;
  name: string;
  shortName: string;
  area: string;
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
}
