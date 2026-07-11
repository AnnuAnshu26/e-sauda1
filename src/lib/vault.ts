import { supabase } from './supabase'
import { VaultOrder, VaultOrderWithOtp } from '../types'

function mapRow(row: any): VaultOrder {
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    amount: Number(row.amount),
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    listingTitle: row.listings?.title,
    listingEmoji: row.listings?.emoji,
    listingPhotoUrl: row.listings?.photo_urls?.[0] ?? null,
  }
}

// NOTE on scope: everything below is real — real rows, real per-user access control
// enforced in Postgres (see supabase/vault_schema.sql), real state transitions. The
// only mocked part is the payment itself: creating a vault order doesn't call any
// payment gateway, it just writes a row. See the schema file for the full note.

// Called from the listing detail page's "Buy with Vault" button. The returned OTP is
// only available here and from getHandoverOtp() below — it's never part of a normal
// row fetch (see fetchMyPurchases/fetchMySales, which explicitly exclude it).
export async function createVaultOrder(listingId: string): Promise<VaultOrderWithOtp> {
  const { data, error } = await supabase.rpc('create_vault_order', { p_listing_id: listingId })
  if (error) throw error
  return { ...mapRow(data), handoverOtp: data.handover_otp }
}

// Lets the buyer look up the OTP again later (e.g. they closed the app before the
// meetup). Enforced server-side to only work for the buyer of a still-funded order.
export async function getHandoverOtp(orderId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_handover_otp', { p_order_id: orderId })
  if (error) throw error
  return data as string
}

// Seller submits the OTP the buyer read out in person. Wrong OTP, wrong caller, or an
// order that's already completed/cancelled all fail server-side with a clear message.
export async function confirmHandover(orderId: string, enteredOtp: string): Promise<VaultOrder> {
  const { data, error } = await supabase.rpc('confirm_handover', {
    p_order_id: orderId,
    p_entered_otp: enteredOtp,
  })
  if (error) throw error
  return mapRow(data)
}

export async function cancelVaultOrder(orderId: string, reason: string): Promise<VaultOrder> {
  const { data, error } = await supabase.rpc('cancel_vault_order', {
    p_order_id: orderId,
    p_reason: reason,
  })
  if (error) throw error
  return mapRow(data)
}

// handover_otp is intentionally absent from this column list — column-level SELECT on
// it is revoked for every client role in vault_schema.sql, so even asking for it here
// would just error. Only the RPC functions above can read or write it.
const SELECT_COLUMNS =
  'id, listing_id, buyer_id, seller_id, amount, status, created_at, completed_at, cancelled_at, cancel_reason, listings(title, emoji, photo_urls)'

export async function fetchMyPurchases(userId: string): Promise<VaultOrder[]> {
  const { data, error } = await supabase
    .from('vault_orders')
    .select(SELECT_COLUMNS)
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function fetchMySales(userId: string): Promise<VaultOrder[]> {
  const { data, error } = await supabase
    .from('vault_orders')
    .select(SELECT_COLUMNS)
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}
