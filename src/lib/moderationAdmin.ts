import { supabase } from './supabase'

export interface ModerationEvent {
  id: string
  messageId: string | null
  conversationId: string | null
  senderId: string | null
  riskLevel: 'medium' | 'high'
  reasons: string[]
  excerpt: string | null
  escalated: boolean
  appealStatus: 'none' | 'requested' | 'upheld' | 'overturned'
  appealNote: string | null
  reviewNote: string | null
  createdAt: string
}

export async function adminFetchModerationEvents(filter: 'escalated' | 'appeals' | 'high' | 'all'): Promise<ModerationEvent[]> {
  let q = supabase.from('moderation_events').select('*').order('created_at', { ascending: false }).limit(100)
  if (filter === 'escalated') q = q.eq('escalated', true)
  if (filter === 'appeals') q = q.eq('appeal_status', 'requested')
  if (filter === 'high') q = q.eq('risk_level', 'high')
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    messageId: r.message_id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    riskLevel: r.risk_level,
    reasons: r.reasons ?? [],
    excerpt: r.excerpt,
    escalated: r.escalated,
    appealStatus: r.appeal_status,
    appealNote: r.appeal_note,
    reviewNote: r.review_note,
    createdAt: r.created_at,
  }))
}

// The full text is only readable by admins while the sender's appeal is open (see the RLS policy).
export async function adminFetchMessageBody(messageId: string): Promise<string | null> {
  const { data } = await supabase.from('messages').select('body').eq('id', messageId).maybeSingle()
  return data?.body ?? null
}

export async function adminReviewModerationEvent(id: string, outcome: 'upheld' | 'overturned', note: string) {
  const { error } = await supabase.rpc('review_moderation_event', { p_event_id: id, p_outcome: outcome, p_note: note })
  if (error) throw error
}
