import { supabase } from './supabase'

export interface PublicProfile {
  id: string
  displayName: string
  city: string | null
  trustScore: number
  verified: boolean
  ratingAvg: number | null
  ratingCount: number
  joinedAt: string
}

// Public-facing profile lookup — used by the /seller/:id page so a buyer can see who
// they're dealing with before purchasing. Only exposes fields that are meant to be
// public (RLS on `profiles` already allows anyone to select these columns; see
// supabase/schema.sql's "Profiles are viewable by everyone" policy from the auth branch).
export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, city, trust_score, verified, rating_avg, rating_count, created_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    displayName: data.display_name,
    city: data.city,
    trustScore: data.trust_score,
    verified: data.verified,
    ratingAvg: data.rating_avg,
    ratingCount: data.rating_count,
    joinedAt: data.created_at,
  }
}
