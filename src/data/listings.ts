import { Category } from '../types'

// Category metadata used across the app: the Sell wizard's category picker,
// Browse's tabs, and to assign a default emoji/card background to a new
// listing at creation time (since real photo upload is a later branch).
export const categories: { name: Category; emoji: string; bg: string; count: number }[] = [
  { name: 'Mobiles', emoji: '📱', bg: 'bg-neutral-200', count: 42000 },
  { name: 'Vehicles', emoji: '🛵', bg: 'from-orange-200 to-amber-100', count: 18000 },
  { name: 'Furniture', emoji: '🪑', bg: 'bg-amber-100', count: 23000 },
  { name: 'Appliances', emoji: '❄️', bg: 'bg-sky-100', count: 11000 },
  { name: 'Electronics', emoji: '⌨️', bg: 'bg-emerald-100', count: 31000 },
  { name: 'Fashion', emoji: '👜', bg: 'bg-neutral-200', count: 9000 },
  { name: 'Books', emoji: '📚', bg: 'bg-rose-100', count: 6000 },
  { name: 'Sports', emoji: '🏸', bg: 'bg-lime-100', count: 4000 },
]

export function categoryVisual(category: Category): { emoji: string; bg: string } {
  const match = categories.find((c) => c.name === category)
  return match ? { emoji: match.emoji, bg: match.bg } : { emoji: '📦', bg: 'bg-neutral-200' }
}