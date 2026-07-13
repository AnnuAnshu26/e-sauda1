export type Category =
  | 'Mobiles'
  | 'Vehicles'
  | 'Furniture'
  | 'Appliances'
  | 'Electronics'
  | 'Fashion'
  | 'Books'
  | 'Sports'

export interface Listing {
  id: string
  ownerId: string
  title: string
  price: number
  category: Category
  subCategory: string | null
  condition: string
  description: string | null
  city: string | null
  location: string
  distanceKm: number
  verified: boolean
  escrow: boolean
  ar?: boolean
  spin360?: boolean
  emoji: string
  bg: string
  photoUrls: string[]
  status: 'active' | 'sold' | 'removed'
  createdAt: string
}

// Shape the Sell wizard collects and hands to lib/listings.ts createListing().
// A narrower type than Listing since fields like id/status/createdAt are server-assigned.
export interface NewListingInput {
  title: string
  price: number
  category: Category
  subCategory?: string
  condition: string
  description?: string
  city?: string
  location?: string
}

export interface Conversation {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  createdAt: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  body: string
  createdAt: string
}

// A conversation enriched with listing + last-message info, used to render the inbox list.
export interface ConversationSummary extends Conversation {
  listingTitle: string
  listingPrice: number
  listingEmoji: string
  listingPhotoUrl: string | null
  otherPartyId: string
  lastMessageBody: string | null
  lastMessageAt: string | null
}

export type VaultOrderStatus = 'funded' | 'completed' | 'cancelled'

// Represents one "Buy with Vault" purchase attempt. handoverOtp is deliberately NOT a
// field here — it's never fetched as part of a normal row read (the DB revokes
// column-level access to it for everyone but the SECURITY DEFINER functions in
// supabase/vault_schema.sql). It only ever appears via VaultOrderWithOtp, returned
// directly from createVaultOrder/getHandoverOtp.
export interface VaultOrder {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  amount: number
  status: VaultOrderStatus
  createdAt: string
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  listingTitle?: string
  listingEmoji?: string
  listingPhotoUrl?: string | null
}

export interface VaultOrderWithOtp extends VaultOrder {
  handoverOtp: string
}

export type DeliveryStatus = 'assigned' | 'delivered' | 'cancelled'
export type DeliveryPartner = 'Rapido' | 'Uber' | 'Dunzo'

export interface Delivery {
  id: string
  vaultOrderId: string
  buyerId: string
  sellerId: string
  partner: DeliveryPartner
  etaMinutes: number
  distanceKm: number
  fee: number
  status: DeliveryStatus
  createdAt: string
  deliveredAt: string | null
}

export interface Rating {
  id: string
  vaultOrderId: string
  raterId: string
  ratedUserId: string
  stars: number
  comment: string | null
  createdAt: string
}

export interface User {
  name: string
  city: string
  joined: string
  trustScore: number
  rating: number
  verified: boolean
  completedSaudas: number
  activeListings: number
  listingCap: number
  savedItems: number
}