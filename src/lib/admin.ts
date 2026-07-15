import { supabase } from './supabase'
import { ReportReason } from './reports'

export interface AdminReport {
  id: string
  reason: ReportReason
  details: string | null
  status: 'open' | 'reviewed' | 'dismissed'
  createdAt: string
  reporterId: string
  reporterName: string
  reportedUserId: string | null
  reportedUserName: string | null
  listingId: string | null
  listingTitle: string | null
  listingStatus: string | null
}

// Deliberately not using PostgREST embedded selects (e.g. `listing:listings(title)`) --
// `reports.reported_user_id` references `auth.users`, not `public.profiles`, so
// PostgREST can't auto-detect that relationship for an embed. Two small `.in()` lookups
// and stitching client-side is simpler than working around that, and this is an admin
// page loaded rarely, not a hot path worth over-optimizing.
export async function fetchReports(status: 'open' | 'reviewed' | 'dismissed' | 'all' = 'open'): Promise<AdminReport[]> {
  let query = supabase.from('reports').select('*').order('created_at', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)

  const { data: reports, error } = await query
  if (error) throw error
  if (!reports || reports.length === 0) return []

  const userIds = Array.from(
    new Set(reports.flatMap((r) => [r.reporter_id, r.reported_user_id].filter(Boolean))),
  )
  const listingIds = Array.from(new Set(reports.map((r) => r.listing_id).filter(Boolean)))

  const [{ data: profiles }, { data: listings }] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id, display_name').in('id', userIds)
      : Promise.resolve({ data: [] as any[] }),
    listingIds.length
      ? supabase.from('listings').select('id, title, status').in('id', listingIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name as string]))
  const listingById = new Map((listings ?? []).map((l) => [l.id, l]))

  return reports.map((r) => {
    const listing = r.listing_id ? listingById.get(r.listing_id) : undefined
    return {
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
      reporterId: r.reporter_id,
      reporterName: nameById.get(r.reporter_id) ?? 'Unknown',
      reportedUserId: r.reported_user_id,
      reportedUserName: r.reported_user_id ? nameById.get(r.reported_user_id) ?? 'Unknown' : null,
      listingId: r.listing_id,
      listingTitle: listing?.title ?? null,
      listingStatus: listing?.status ?? null,
    }
  })
}

export async function updateReportStatus(id: string, status: 'reviewed' | 'dismissed'): Promise<void> {
  const { error } = await supabase.from('reports').update({ status }).eq('id', id)
  if (error) throw error
}
