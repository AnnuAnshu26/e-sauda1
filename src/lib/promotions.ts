import { supabase } from './supabase'
import { invokeFunction } from './edgeFunctions'
import { loadCashfreeSdk, normalizeIndianMobile } from './listingFee'
import { mapRow } from './listings'
import { Listing } from '../types'

export type PromotionStatus =
  | 'pending_payment'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'payment_failed'
  | 'under_review'
  | 'paused'

export interface PromotionPlan {
  code: string
  name: string
  description: string | null
  pricePaise: number
  durationDays: number
  includesReel: boolean
}

export interface Promotion {
  id: string
  listingId: string
  planCode: string
  amountPaise: number
  durationDays: number
  includesReel: boolean
  status: PromotionStatus
  startsAt: string | null
  expiresAt: string | null
  createdAt: string
}

export const PROMOTION_STATUS_LABEL: Record<PromotionStatus, string> = {
  pending_payment: 'Pending payment',
  active: 'Active',
  expired: 'Expired',
  cancelled: 'Cancelled',
  payment_failed: 'Payment failed',
  under_review: 'Under review',
  paused: 'Paused',
}

export const formatRupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

// A promotion is only "live" if it is active AND not past its expiry -- the status column can lag the
// clock, so the expiry timestamp is always checked too.
export function isLive(p: Pick<Promotion, 'status' | 'expiresAt'>): boolean {
  return p.status === 'active' && !!p.expiresAt && new Date(p.expiresAt).getTime() > Date.now()
}

export async function fetchPromotionPlans(): Promise<PromotionPlan[]> {
  const { data, error } = await supabase
    .from('promotion_plans')
    .select('code,name,description,price_paise,duration_days,includes_reel')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    code: r.code,
    name: r.name,
    description: r.description,
    pricePaise: r.price_paise,
    durationDays: r.duration_days,
    includesReel: r.includes_reel,
  }))
}

function mapPromotion(r: any): Promotion {
  return {
    id: r.id,
    listingId: r.listing_id,
    planCode: r.plan_code,
    amountPaise: r.amount_paise,
    durationDays: r.duration_days,
    includesReel: r.includes_reel,
    status: r.status,
    startsAt: r.starts_at,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }
}

export async function fetchMyPromotions(userId: string): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('id,listing_id,plan_code,amount_paise,duration_days,includes_reel,status,starts_at,expires_at,created_at')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPromotion)
}

// Listings with a paid promotion running right now (the server checks status, expiry and that the
// listing is still active). Callers MUST label what they render with these as "Sponsored".
export async function fetchPromotedListings(scope: 'listing' | 'reel' = 'listing', limit = 8): Promise<Listing[]> {
  const { data, error } = await supabase.rpc('get_promoted_listings', { p_scope: scope, p_limit: limit })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

// Asks the SERVER to check the payment with Cashfree and activate the promotion if it was paid.
// (The server, not the browser, decides; it is idempotent and safe to call repeatedly.)
export async function verifyPromotionPayment(promotionId: string): Promise<PromotionStatus | null> {
  try {
    const res = await invokeFunction<{ status: PromotionStatus }>('verify-promotion-payment', { promotionId })
    return res.status ?? null
  } catch {
    return null
  }
}

export type CheckoutOutcome = 'active' | 'pending' | 'failed'

// Starts the payment. The browser's checkout result is NOT trusted: the promotion only becomes active
// when the server verifies the payment (Cashfree webhook), so we poll the promotion's status afterwards.
export async function startPromotionCheckout(
  listingId: string,
  planCode: string,
  phone: string,
  onStage?: (stage: 'creating' | 'paying' | 'confirming') => void,
): Promise<CheckoutOutcome> {
  const customerPhone = normalizeIndianMobile(phone)
  if (!customerPhone) throw new Error('Enter a valid 10-digit Indian mobile number to continue.')

  onStage?.('creating')
  const order = await invokeFunction<{ promotionId: string; paymentSessionId: string }>('create-promotion-order', {
    listingId,
    planCode,
    customerPhone,
  })

  onStage?.('paying')
  await loadCashfreeSdk()
  const cashfree = window.Cashfree!({ mode: 'production' })
  try {
    await cashfree.checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: '_modal' })
  } catch {
    /* not authoritative -- the server-side status below is */
  }

  // Don't wait for Cashfree's webhook: ask the server to verify the order with Cashfree directly.
  // Retry a few times because a UPI payment can take a few seconds to settle.
  onStage?.('confirming')
  for (let i = 0; i < 8; i++) {
    const status = await verifyPromotionPayment(order.promotionId)
    if (status === 'active') return 'active'
    if (status === 'cancelled') return 'failed'
    await new Promise((r) => setTimeout(r, 2500))
  }
  return 'pending' // still unconfirmed; the dashboard's "Check payment" (or the webhook) will finish it
}

// ---- admin ----
export interface AdminPromotion extends Promotion {
  sellerId: string
  paidAt: string | null
  adminNote: string | null
  cashfreeOrderId: string
}

export async function adminFetchPromotions(): Promise<AdminPromotion[]> {
  const { data, error } = await supabase.from('promotions').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    ...mapPromotion(r),
    sellerId: r.seller_id,
    paidAt: r.paid_at,
    adminNote: r.admin_note,
    cashfreeOrderId: r.cashfree_order_id,
  }))
}

export async function adminPromotionStats() {
  const { data, error } = await supabase.rpc('admin_promotion_stats')
  if (error) throw error
  const r = Array.isArray(data) ? data[0] : data
  return {
    revenuePaise: Number(r?.revenue_paise ?? 0),
    active: Number(r?.active_count ?? 0),
    expired: Number(r?.expired_count ?? 0),
    failed: Number(r?.failed_count ?? 0),
    review: Number(r?.review_count ?? 0),
  }
}

export async function adminSetPromotionStatus(id: string, status: 'paused' | 'active' | 'cancelled', note?: string) {
  const { error } = await supabase.rpc('admin_set_promotion_status', { p_id: id, p_status: status, p_note: note ?? null })
  if (error) throw error
}

// Order for the Explore reels feed. A SPONSORED reel is shown FIRST (and labelled), then one more after
// every 4 organic reels, so sellers get real top placement without the feed turning into ads.
// Pure function: de-duplicates (a reel is never shown twice) and works with any number of organic reels.
export function mergeSponsoredReels<T extends { id: string }>(organic: T[], sponsored: T[], every = 4): T[] {
  const sponsoredIds = new Set(sponsored.map((l) => l.id))
  const rest = organic.filter((l) => !sponsoredIds.has(l.id))
  if (sponsored.length === 0) return rest
  const out: T[] = [sponsored[0]]
  let next = 1
  rest.forEach((l, i) => {
    out.push(l)
    if ((i + 1) % every === 0 && next < sponsored.length) out.push(sponsored[next++])
  })
  // Fewer organic reels than slots: don't lose paid reels, append what's left.
  while (next < sponsored.length) out.push(sponsored[next++])
  return out
}
