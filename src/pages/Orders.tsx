import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package } from 'lucide-react'

const tabs = ['Buying', 'Selling', 'My listings'] as const

export default function Orders() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Buying')
  const navigate = useNavigate()

  const counts = { Buying: 0, Selling: 0, 'My listings': 0 }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold">My orders</h1>

      <div className="mt-6 inline-flex rounded-full border border-black/10 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === t ? 'bg-cream-dark text-ink' : 'text-ink/50'
            }`}
          >
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center justify-center rounded-xl2 border border-dashed border-black/15 py-20 text-center">
        <Package size={36} className="text-ink/30" />
        <p className="mt-4 font-medium text-ink">
          {tab === 'Buying' && 'No purchases yet.'}
          {tab === 'Selling' && 'Nothing sold yet.'}
          {tab === 'My listings' && "You haven't posted anything yet."}
        </p>
        <button
          onClick={() => navigate(tab === 'My listings' ? '/sell' : '/browse')}
          className="mt-4 flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream-dark"
        >
          {tab === 'My listings' ? 'Post a listing' : 'Explore marketplace'}
        </button>
      </div>
    </div>
  )
}
