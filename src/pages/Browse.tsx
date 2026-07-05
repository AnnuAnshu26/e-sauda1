import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { categories, listings } from '../data/listings'
import { Category } from '../types'
import ListingCard from '../components/ListingCard'

const tabs: ('All' | Category)[] = ['All', ...categories.map((c) => c.name)]

export default function Browse() {
  const [params] = useSearchParams()
  const [active, setActive] = useState<'All' | Category>(
    (params.get('category') as Category) || 'All',
  )
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [sort, setSort] = useState('Relevance')

  const filtered = useMemo(() => {
    let result = listings.filter((l) => active === 'All' || l.category === active)
    if (min) result = result.filter((l) => l.price >= Number(min))
    if (max) result = result.filter((l) => l.price <= Number(max))
    if (sort === 'Price: Low to High') result = [...result].sort((a, b) => a.price - b.price)
    if (sort === 'Price: High to Low') result = [...result].sort((a, b) => b.price - a.price)
    if (sort === 'Nearest first') result = [...result].sort((a, b) => a.distanceKm - b.distanceKm)
    return result
  }, [active, min, max, sort])

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              active === t ? 'bg-forest text-cream' : 'border border-black/10 bg-white text-ink/80'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-xl2 border border-black/5 bg-white p-5">
          <h3 className="font-display text-lg font-semibold">Filters</h3>

          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/50">City</label>
            <select className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">
              <option>All cities</option>
              <option>Bengaluru</option>
              <option>Mumbai</option>
              <option>Delhi NCR</option>
            </select>
          </div>

          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/50">Price (₹)</label>
            <div className="mt-2 flex gap-2">
              <input
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="Min"
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              />
              <input
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="Max"
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/50">Sort by</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
            >
              <option>Relevance</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Nearest first</option>
            </select>
          </div>

          <div className="mt-5 rounded-lg bg-clay/10 p-3 text-xs text-clay">
            <strong>Trust filter is on.</strong> Only sellers within their listing cap. Bulk
            resellers are automatically hidden.
          </div>
        </aside>

        <div>
          <p className="mb-4 font-display text-xl font-semibold">
            {active === 'All' ? 'All listings' : active}{' '}
            <span className="text-base font-normal text-ink/50">
              · {filtered.length} results across India
            </span>
          </p>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="mt-10 text-center text-sm text-ink/50">No listings match these filters yet.</p>
          )}

          <div className="mt-10 rounded-xl2 bg-clay/10 p-8 text-center">
            <p className="font-display text-xl font-semibold">Have something to sell?</p>
            <p className="mt-1 text-sm text-ink/60">
              Post it in under 20 seconds using our voice-first listing flow.
            </p>
            <a
              href="/sell"
              className="mt-4 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light"
            >
              Post a listing
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
