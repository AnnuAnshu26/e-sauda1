import { supabase } from './supabase'
import { mapRow, escapeLike } from './listings'
import { Listing } from '../types'
import { complementaryKeywords } from '../data/recommendations'

// Called from the listing detail page. Looks up this listing's category in the
// complementary-keyword map, then finds other active listings (excluding this one)
// whose title or sub-category matches any of those keywords. Returns [] rather than
// throwing when the category has no mapping or nothing matches — this is a "nice to
// have" section, not something that should ever block the page from rendering.
export async function fetchRecommendedListings(listing: Listing, limit = 8): Promise<Listing[]> {
  const keywords = complementaryKeywords[listing.category]
  if (!keywords || keywords.length === 0) return []

  const orClauses = keywords
    .flatMap((kw) => {
      const term = escapeLike(kw)
      return [`title.ilike.%${term}%`, `sub_category.ilike.%${term}%`]
    })
    .join(',')

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .neq('id', listing.id)
    .or(orClauses)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(mapRow)
}
