import { supabase } from './supabase'

export interface Handover {
  id: string
  conversationId: string
  listingId: string
  buyerId: string
  sellerId: string
  sellerConfirmedAt: string | null
  buyerConfirmedAt: string | null
  completedAt: string | null
}

export type DisputeReason =
  | 'not_received'
  | 'wrong_item'
  | 'damaged'
  | 'not_as_described'
  | 'handover_not_completed'
  | 'receipt_not_confirmed'
  | 'suspected_fraud'
  | 'other'

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'dismissed'

export interface Dispute {
  id: string
  conversationId: string
  listingId: string
  raisedBy: string
  againstUser: string
  reason: DisputeReason
  description: string
  status: DisputeStatus
  resolutionNote: string | null
  createdAt: string
  resolvedAt: string | null
}

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  not_received: 'I did not receive the item',
  wrong_item: 'I received a different item',
  damaged: 'The item is damaged',
  not_as_described: 'The item is very different from the listing',
  handover_not_completed: 'The other person did not complete the handover',
  receipt_not_confirmed: 'The other person will not confirm they received it',
  suspected_fraud: 'I suspect fraud',
  other: 'Something else',
}

function mapHandover(r: any): Handover {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    listingId: r.listing_id,
    buyerId: r.buyer_id,
    sellerId: r.seller_id,
    sellerConfirmedAt: r.seller_confirmed_at,
    buyerConfirmedAt: r.buyer_confirmed_at,
    completedAt: r.completed_at,
  }
}

export function mapDispute(r: any): Dispute {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    listingId: r.listing_id,
    raisedBy: r.raised_by,
    againstUser: r.against_user,
    reason: r.reason,
    description: r.description,
    status: r.status,
    resolutionNote: r.resolution_note,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }
}

export async function fetchHandover(conversationId: string): Promise<Handover | null> {
  const { data, error } = await supabase.from('deal_handovers').select('*').eq('conversation_id', conversationId).maybeSingle()
  if (error) throw error
  return data ? mapHandover(data) : null
}

// Records YOUR side of the handover (seller: "I handed it over", buyer: "I received it").
export async function confirmHandover(conversationId: string, note?: string): Promise<Handover> {
  const { data, error } = await supabase.rpc('confirm_handover', { p_conversation_id: conversationId, p_note: note?.trim() || null })
  if (error) throw error
  return mapHandover(data)
}

export async function openDispute(conversationId: string, reason: DisputeReason, description: string): Promise<Dispute> {
  const { data, error } = await supabase.rpc('open_dispute', {
    p_conversation_id: conversationId,
    p_reason: reason,
    p_description: description,
  })
  if (error) throw error
  return mapDispute(data)
}

export async function fetchDisputesForConversation(conversationId: string): Promise<Dispute[]> {
  const { data, error } = await supabase
    .from('deal_disputes')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapDispute)
}

export async function fetchDealStats(userId: string): Promise<{ sold: number; bought: number }> {
  const { data, error } = await supabase.rpc('get_user_deal_stats', { p_user_id: userId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { sold: Number(row?.sold_count ?? 0), bought: Number(row?.bought_count ?? 0) }
}

// ---- admin ----
export async function adminFetchDisputes(status?: DisputeStatus): Promise<Dispute[]> {
  let q = supabase.from('deal_disputes').select('*').order('created_at', { ascending: false }).limit(100)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(mapDispute)
}

export async function adminResolveDispute(id: string, status: 'under_review' | 'resolved' | 'dismissed', note: string) {
  const { error } = await supabase.rpc('resolve_dispute', { p_dispute_id: id, p_status: status, p_note: note })
  if (error) throw error
}
