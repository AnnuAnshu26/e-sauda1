import { Category } from '../types'

// A few illustrative complementary items per category — not exhaustive, just enough
// to surface genuinely useful cross-sells (buying an AC? you'll likely also need a
// mounting bracket). Matched against other listings' title/sub-category, so results
// are only ever real, currently-active listings someone else has actually posted —
// never fabricated suggestions.
export const complementaryKeywords: Partial<Record<Category, string[]>> = {
  Appliances: ['mounting bracket', 'copper pipe', 'stabilizer', 'stand'],
  Mobiles: ['case', 'screen protector', 'charger', 'earphones'],
  Electronics: ['cable', 'stand', 'cover', 'adapter'],
  Vehicles: ['helmet', 'cover', 'lock', 'battery'],
  Furniture: ['cushion', 'polish', 'cover'],
  Fashion: ['belt', 'wallet', 'shoes'],
  Books: ['bookshelf', 'bookmark'],
  Sports: ['bag', 'gloves', 'net'],
}
