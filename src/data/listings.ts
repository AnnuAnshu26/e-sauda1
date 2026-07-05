import { Category, Listing, User } from '../types'

export const categories: { name: Category; emoji: string; count: number }[] = [
  { name: 'Mobiles', emoji: '📱', count: 42000 },
  { name: 'Vehicles', emoji: '🛵', count: 18000 },
  { name: 'Furniture', emoji: '🪑', count: 23000 },
  { name: 'Appliances', emoji: '❄️', count: 11000 },
  { name: 'Electronics', emoji: '⌨️', count: 31000 },
  { name: 'Fashion', emoji: '👜', count: 9000 },
  { name: 'Books', emoji: '📚', count: 6000 },
  { name: 'Sports', emoji: '🏸', count: 4000 },
]

export const listings: Listing[] = [
  { id: 'l1', title: 'Royal Enfield Classic 350 · 2022', price: 142000, category: 'Vehicles', location: 'Bandra West', distanceKm: 2.1, verified: true, escrow: true, spin360: true, emoji: '🛵', bg: 'from-orange-200 to-amber-100' },
  { id: 'l2', title: 'Keychron Q1 Pro · Wireless Mechanical', price: 12500, category: 'Electronics', location: 'Koramangala', distanceKm: 4.8, verified: true, escrow: true, ar: true, emoji: '⌨️', bg: 'bg-emerald-100' },
  { id: 'l3', title: 'Godrej 1.5 Ton 5⭐ Split AC', price: 18900, category: 'Appliances', location: 'Salt Lake', distanceKm: 8.2, verified: true, escrow: true, ar: true, spin360: true, emoji: '❄️', bg: 'bg-sky-100' },
  { id: 'l4', title: 'Solid Sheesham 5-Shelf Bookshelf', price: 6200, category: 'Furniture', location: 'Vaishali Nagar', distanceKm: 5.5, verified: true, escrow: true, emoji: '🪑', bg: 'bg-amber-100' },
  { id: 'l5', title: 'iPhone 13 · 128GB · Midnight', price: 38000, category: 'Mobiles', location: 'Connaught Place', distanceKm: 2.8, verified: true, escrow: true, emoji: '📱', bg: 'bg-neutral-200' },
  { id: 'l6', title: 'Yonex Astrox 88D Pro', price: 14300, category: 'Sports', location: 'HSR Layout', distanceKm: 4.1, verified: true, escrow: true, emoji: '🏸', bg: 'bg-lime-100' },
  { id: 'l7', title: 'Studds Full-face Helmet · Size L', price: 2100, category: 'Vehicles', location: 'Andheri', distanceKm: 1.8, verified: true, escrow: true, emoji: '⛑️', bg: 'bg-neutral-200' },
  { id: 'l8', title: 'Motorcycle Chain Lube Kit', price: 650, category: 'Vehicles', location: 'Powai', distanceKm: 2.2, verified: true, escrow: true, emoji: '🧰', bg: 'bg-amber-100' },
  { id: 'l9', title: 'Herman Miller Aeron · Size B', price: 78000, category: 'Furniture', location: 'Powai', distanceKm: 0.6, verified: true, escrow: true, ar: true, spin360: true, emoji: '💺', bg: 'bg-neutral-200' },
  { id: 'l10', title: 'SG Cricket Bat · English Willow', price: 8500, category: 'Sports', location: 'Malviya Nagar', distanceKm: 3.1, verified: true, escrow: true, emoji: '🏏', bg: 'bg-amber-100' },
  { id: 'l11', title: 'Nike Air Force 1 · UK 9', price: 5200, category: 'Fashion', location: 'Anna Nagar', distanceKm: 1.3, verified: true, escrow: true, emoji: '👟', bg: 'bg-neutral-200' },
  { id: 'l12', title: 'The Kite Runner · Paperback', price: 180, category: 'Books', location: 'Sector 62', distanceKm: 3.2, verified: true, escrow: true, emoji: '📕', bg: 'bg-rose-100' },
]

export const currentUser: User = {
  name: 'You',
  city: 'Bengaluru',
  joined: 'this month',
  trustScore: 62,
  rating: 4.6,
  verified: false,
  completedSaudas: 0,
  activeListings: 0,
  listingCap: 2,
  savedItems: 0,
}
