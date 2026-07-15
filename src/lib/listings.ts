import { supabase } from './supabase'
import { Listing, NewListingInput, Category } from '../types'
import { categoryVisual } from '../data/listings'

// Maps a raw Supabase row (snake_case, matches supabase/listings_schema.sql)
// to the app's Listing type (camelCase, matches what ListingCard/Browse/Home expect).
export function mapRow(row: any): Listing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    price: Number(row.price),
    category: row.category as Category,
    subCategory: row.sub_category,
    condition: row.condition,
    description: row.description,
    city: row.city,
    location: row.location,
    distanceKm: Number(row.distance_km ?? 0),
    verified: false, // real per-listing verification isn't wired up yet
    escrow: true, // every listing on the platform uses the vault flow
    emoji: row.emoji,
    bg: row.bg,
    photoUrls: row.photo_urls ?? [],
    status: row.status,
    createdAt: row.created_at,
  }
}
// A single listing's full detail — used by the /listing/:id page.
export async function fetchListingById(id: string): Promise<Listing | null> {
  const { data, error } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapRow(data) : null
}

export interface ListingFilters {
  category?: Category | 'All'
  minPrice?: number
  maxPrice?: number
  // Free-text search box on Browse/Navbar. Matched against title, description, and
  // sub-category with ilike (case-insensitive substring) rather than Postgres full-text
  // search — this is a personal-marketplace scale app, so a GIN/tsvector index would be
  // premature; ilike is plenty fast on a table this size and needs zero schema changes.
  search?: string
}

// Escapes the characters that mean something special inside a Postgres LIKE/ILIKE
// pattern (%, _) so a search for e.g. "100% cotton" doesn't get misread as a wildcard.
function escapeLike(term: string): string {
  return term.replace(/[%_]/g, (c) => `\\${c}`)
}

// Public browse feed — only ever returns active listings from anyone.
export async function fetchListings(filters: ListingFilters = {}): Promise<Listing[]> {
  let query = supabase.from('listings').select('*').eq('status', 'active')

  if (filters.category && filters.category !== 'All') {
    query = query.eq('category', filters.category)
  }
  if (filters.minPrice !== undefined) {
    query = query.gte('price', filters.minPrice)
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte('price', filters.maxPrice)
  }
  if (filters.search && filters.search.trim()) {
    const term = escapeLike(filters.search.trim())
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,sub_category.ilike.%${term}%`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

// A single user's own listings, including sold/removed ones — used by
// Orders' "My listings" tab and Profile's active-listings count.
export async function fetchUserListings(ownerId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

// Used by the Sell wizard to show/enforce the progressive listing cap and
// the tiered anti-bot fee for a specific category.
export async function countActiveListingsInCategory(
  ownerId: string,
  category: Category,
): Promise<number> {
  const { count, error } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('category', category)
    .eq('status', 'active')
  if (error) throw error
  return count ?? 0
}

export async function createListing(
  ownerId: string,
  input: NewListingInput,
): Promise<Listing> {
  const visual = categoryVisual(input.category)
  const { data, error } = await supabase
    .from('listings')
    .insert({
      owner_id: ownerId,
      title: input.title,
      price: input.price,
      category: input.category,
      sub_category: input.subCategory || null,
      condition: input.condition,
      description: input.description || null,
      city: input.city || null,
      location: input.location || input.city || '',
      emoji: visual.emoji,
      bg: visual.bg,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapRow(data)
}

export async function attachPhotos(id: string, photoUrls: string[]): Promise<void> {
  const { error } = await supabase.from('listings').update({ photo_urls: photoUrls }).eq('id', id)
  if (error) throw error
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', id)
  if (error) throw error
}

export async function markListingSold(id: string): Promise<void> {
  const { error } = await supabase.from('listings').update({ status: 'sold' }).eq('id', id)
  if (error) throw error
}
