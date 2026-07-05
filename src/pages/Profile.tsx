import { useNavigate } from 'react-router-dom'
import { Lock, ShieldCheck, Award, Star, TrendingUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  // Stats below (completed saudas, active listings, saved items, rating) live in the
  // listings/orders tables we haven't built yet — they'll come alive in the next branch.
  // Trust score and verified status are real, from the `profiles` table.
  const trustScore = profile?.trust_score ?? 50
  const verified = profile?.verified ?? false
  const displayName = profile?.display_name || user?.email || 'You'

  const badges = [
    { icon: ShieldCheck, label: 'Verified identity', unlocked: verified },
    { icon: Award, label: 'First sauda', unlocked: false },
    { icon: Star, label: '5-star seller', unlocked: false },
    { icon: TrendingUp, label: 'Trust 80+', unlocked: trustScore >= 80 },
  ]

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-xl2 bg-gradient-to-br from-clay/15 to-cream-dark p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest text-2xl font-semibold text-cream">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold">{displayName}</h1>
              <p className="text-sm text-ink/60">{profile?.city || 'Location not set'}</p>
              <div className="mt-1 flex items-center gap-3 text-xs">
                <span className={verified ? 'text-emerald-600' : 'text-amber-600'}>
                  {verified ? 'Verified' : 'Not verified'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink/50">Trust score</p>
            <p className="font-display text-4xl font-semibold text-clay">{trustScore}</p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/60">
          <div className="h-full bg-forest" style={{ width: `${trustScore}%` }} />
        </div>
        <p className="mt-2 text-xs text-ink/50">
          Complete more saudas, get 5-star ratings and verify identity to grow.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Completed saudas" value={0} />
        <Stat label="Active listings" value={0} suffix="of 2 cap" />
        <Stat label="Saved items" value={0} />
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
