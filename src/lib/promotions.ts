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

async function fetchPromotionStatus(id: string): Promise<PromotionStatus | null> {
  const { data } = await supabase.from('promotions').select('status').eq('id', id).maybeSingle()
  return (data?.status as PromotionStatus) ?? null
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

  onStage?.('confirming')
  for (let i = 0; i < 12; i++) {
    const status = await fetchPromotionStatus(order.promotionId)
    if (status === 'active') return 'active'
    if (status === 'payment_failed' || status === 'cancelled') return 'failed'
    await new Promise((r) => setTimeout(r, 2500))
  }
  return 'pending' // payment may still be settling; the webhook will activate it
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
