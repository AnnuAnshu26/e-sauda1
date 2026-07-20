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
  // True when all three dimensions are present. Not stored directly — mapRow()
  // computes it from widthCm/heightCm/depthCm so it can never drift from the data
  // that actually drives the size-check viewer.
  ar?: boolean
  spin360?: boolean
  // Real-world size in centimetres, entered by the seller in Sell/EditListing.
  // All three (or none) — a box with only two dimensions can't be scaled correctly,
  // so SpaceFitViewer requires the full set before it'll render.
  widthCm?: number | null
  heightCm?: number | null
  depthCm?: number | null
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
  widthCm?: number
  heightCm?: number
  depthCm?: number
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
  flagged: boolean
  flagReasons: string[]
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
  // Only meaningful once status === 'cancelled'. refundAmount is null until then;
  // deductedFee defaults to 0 and only becomes non-zero if a delivery rider had
  // already been arranged for this order at cancellation time.
  refundAmount: number | null
  deductedFee: number
  // Set once cancel-vault-order-and-refund's Razorpay call actually succeeds --
  // distinct from refundAmount, which is just the *computed* amount and gets set
  // immediately on cancellation regardless of whether the real refund went through.
  refundProcessedAt: string | null
  // Null for orders created before the Razorpay integration (or in any environment
  // still running the mocked Vault) -- there's no real payment behind those, so
  // "refund processing" would never resolve for them. Non-null means a real payment
  // exists and refundProcessedAt is meaningful to wait on.
  razorpayPaymentId: string | null
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
export type NotificationType =
  | 'message'
  | 'vault_funded'
  | 'vault_completed'
  | 'vault_cancelled'
  | 'report_reviewed'
  | 'report_dismissed'
  | 'price_drop'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  read: boolean
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