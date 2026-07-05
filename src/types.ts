export type Category =
  | 'Mobiles'
  | 'Vehicles'
  | 'Furniture'
  | 'Appliances'
  | 'Electronics'
  | 'Fashion'
  | 'Books'
  | 'Sports'

export interface Listing {
  id: string
  title: string
  price: number
  category: Category
  location: string
  distanceKm: number
  verified: boolean
  escrow: boolean
  ar?: boolean
  spin360?: boolean
  emoji: string
  bg: string
}

export interface User {
  name: string
  city: string
  joined: string
  trustScore: number
  rating: number
  verified: boolean
  completedSaudas: number
  activeListings: number
  listingCap: number
  savedItems: number
}
