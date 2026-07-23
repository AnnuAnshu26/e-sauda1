import { supabase } from './supabase'
import { mapRow, escapeLike } from './listings'
import { Listing } from '../types'
import { complementaryKeywords, specificComplementaryTriggers } from '../data/recommendations'

// Called from the listing detail page. Looks up this listing's category (and, if its
// own title/sub-category matches a known specific trigger like "scooty" or "shirt", a
// more targeted list too) in the complementary-keyword map, then finds other active
// listings (excluding this one) whose title or sub-category matches any of those
// keywords. Returns [] rather than throwing when nothing matches -- this is a "nice to
// have" section, not something that should ever block the page from rendering.
export async function fetchRecommendedListings(listing: Listing, limit = 8): Promise<Listing[]> {
  const haystack = `${listing.title} ${listing.subCategory ?? ''}`.toLowerCase()

  const specificKeywords = specificComplementaryTriggers
    .filter((t) => t.matches.some((m) => haystack.includes(m)))
    .flatMap((t) => t.keywords)

  const keywords = Array.from(new Set([...specificKeywords, ...(complementaryKeywords[listing.category] ?? [])]))
  if (keywords.length === 0) return []

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
