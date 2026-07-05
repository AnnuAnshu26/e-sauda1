import { useNavigate } from 'react-router-dom'
import { Lock, ShieldCheck, Award, Star, TrendingUp } from 'lucide-react'
import { currentUser } from '../data/listings'

const badges = [
  { icon: ShieldCheck, label: 'Verified identity', unlocked: currentUser.verified },
  { icon: Award, label: 'First sauda', unlocked: currentUser.completedSaudas > 0 },
  { icon: Star, label: '5-star seller', unlocked: currentUser.rating >= 4.5 },
  { icon: TrendingUp, label: 'Trust 80+', unlocked: currentUser.trustScore >= 80 },
]

export default function Profile() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-xl2 bg-gradient-to-br from-clay/15 to-cream-dark p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest text-2xl font-semibold text-cream">
              Y
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold">You</h1>
              <p className="text-sm text-ink/60">
                {currentUser.city} · Joined {currentUser.joined}
              </p>
              <div className="mt-1 flex items-center gap-3 text-xs">
                <span className={currentUser.verified ? 'text-emerald-600' : 'text-amber-600'}>
                  {currentUser.verified ? 'Verified' : 'Not verified'}
                </span>
                <span className="flex items-center gap-1 text-ink/70">
                  <Star size={12} className="fill-amber-400 text-amber-400" /> {currentUser.rating}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink/50">Trust score</p>
            <p className="font-display text-4xl font-semibold text-clay">{currentUser.trustScore}</p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/60">
          <div className="h-full bg-forest" style={{ width: `${currentUser.trustScore}%` }} />
        </div>
        <p className="mt-2 text-xs text-ink/50">
          Complete more saudas, get 5-star ratings and verify identity to grow.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Completed saudas" value={currentUser.completedSaudas} />
        <Stat label="Active listings" value={currentUser.activeListings} suffix={`of ${currentUser.listingCap} cap`} />
        <Stat label="Saved items" value={currentUser.savedItems} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl2 border-2 border-dashed border-clay/40 bg-white p-6">
        <div>
          <p className="font-semibold text-ink">Unlock full trust</p>
          <p className="mt-1 text-sm text-ink/60">
            Verify with DigiLocker → +20 trust, +5 listing cap, verified badge on all your ads.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-cream hover:bg-forest-light">
          <Lock size={15} /> Verify with DigiLocker
        </button>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold">Badges</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {badges.map((b) => (
          <div
            key={b.label}
            className={`flex flex-col items-center gap-2 rounded-xl2 border p-6 text-center ${
              b.unlocked ? 'border-clay bg-clay/5' : 'border-black/10'
            }`}
          >
            <b.icon size={22} className={b.unlocked ? 'text-clay' : 'text-ink/30'} />
            <span className="text-sm font-medium">{b.label}</span>
            <span className="text-xs text-ink/40">{b.unlocked ? '✓' : 'Locked'}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={() => navigate('/orders')} className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-cream-dark">
          My orders
        </button>
        <button onClick={() => navigate('/vault')} className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-cream-dark">
          Sauda Vault
        </button>
        <button onClick={() => navigate('/sell')} className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-cream hover:bg-forest-light">
          Post new listing
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl2 border border-black/5 bg-white p-5">
      <p className="text-sm text-ink/50">{label}</p>
      <p className="font-display text-3xl font-semibold text-ink">{value}</p>
      {suffix && <p className="text-xs text-ink/40">{suffix}</p>}
    </div>
  )
}
