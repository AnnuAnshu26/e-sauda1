import { useEffect, useRef, useState } from 'react'
import { X, Megaphone, Check, Film } from 'lucide-react'
import { Listing } from '../types'
import {
  fetchPromotionPlans,
  formatRupees,
  startPromotionCheckout,
  PromotionPlan,
  CheckoutOutcome,
} from '../lib/promotions'

interface Props {
  listing: Listing
  onClose: () => void
  onDone: () => void // refresh the promotion list after a (possibly) successful payment
}

// Plans, prices and durations come from the database (promotion_plans), so changing a price is a
// data edit, not a code change. The server re-reads the plan when creating the order; the price shown
// here is informational and can never be used to pay a different amount.
export default function PromoteModal({ listing, onClose, onDone }: Props) {
  const [plans, setPlans] = useState<PromotionPlan[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [stage, setStage] = useState<null | 'creating' | 'paying' | 'confirming'>(null)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<CheckoutOutcome | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const busy = stage !== null

  useEffect(() => {
    fetchPromotionPlans()
      .then((p) => {
        setPlans(p)
        setSelected(p[0]?.code ?? null)
      })
      .catch(() => setLoadError('Could not load promotion plans. Please try again.'))
  }, [])

  // Escape closes (unless a payment is in progress); focus moves into the dialog; background scroll locks.
  useEffect(() => {
    dialogRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [busy, onClose])

  async function pay() {
    if (!selected) return
    setError(null)
    try {
      const result = await startPromotionCheckout(listing.id, selected, phone, setStage)
      setOutcome(result)
      onDone()
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. You have not been charged unless your bank says otherwise.')
    } finally {
      setStage(null)
    }
  }

  const plan = plans?.find((p) => p.code === selected)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Promote listing"
        className="glass-elevated max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-xl2 p-5 outline-none sm:rounded-xl2"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-clay">
              <Megaphone size={13} /> Promote listing
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink">{listing.title}</h2>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="rounded-full p-1.5 text-ink/60 hover:bg-cream-dark disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        {outcome ? (
          <div className="mt-5 text-center" data-testid="promote-outcome">
            {outcome === 'active' && (
              <>
                <p className="font-display text-lg font-semibold text-emerald-500">Your promotion is live 🎉</p>
                <p className="mt-1 text-sm text-ink/60">It is labelled “Sponsored” wherever it appears.</p>
              </>
            )}
            {outcome === 'pending' && (
              <>
                <p className="font-display text-lg font-semibold text-ink">Payment received? Almost there…</p>
                <p className="mt-1 text-sm text-ink/60">
                  We activate your promotion only after the payment is confirmed. This can take a minute — check “Your
                  promotions” on this page. If money left your account and nothing activates, contact us.
                </p>
              </>
            )}
            {outcome === 'failed' && (
              <>
                <p className="font-display text-lg font-semibold text-red-400">Payment did not go through</p>
                <p className="mt-1 text-sm text-ink/60">You can try again.</p>
              </>
            )}
            <button onClick={onClose} className="mt-4 rounded-full bg-forest px-5 py-2 text-sm font-semibold text-cream">
              Done
            </button>
          </div>
        ) : (
          <>
            {loadError && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{loadError}</p>}
            {!plans && !loadError && <div className="mt-4 h-28 animate-pulse rounded-xl2 bg-cream-dark" />}
            {plans && plans.length === 0 && <p className="mt-4 text-sm text-ink/60">No promotion plans are available right now.</p>}

            <div className="mt-4 space-y-2" role="radiogroup" aria-label="Promotion plan">
              {plans?.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  role="radio"
                  aria-checked={selected === p.code}
                  disabled={busy}
                  onClick={() => setSelected(p.code)}
                  className={`w-full rounded-xl2 border p-4 text-left transition-colors ${
                    selected === p.code ? 'border-clay bg-clay/5' : 'border-line/10 bg-surface hover:bg-cream-dark'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink">{p.name}</span>
                    <span className="font-display text-lg font-semibold text-ink">{formatRupees(p.pricePaise)}</span>
                  </span>
                  <span className="mt-1 block text-xs text-ink/60">
                    {p.durationDays} day{p.durationDays === 1 ? '' : 's'}
                  </span>
                  {p.description && <span className="mt-1.5 block text-xs text-ink/70">{p.description}</span>}
                  <span className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink/60">
                    <span className="flex items-center gap-1"><Check size={11} /> Promoted section on Home &amp; Browse</span>
                    {p.includesReel && (
                      <span className="flex items-center gap-1"><Film size={11} /> Reel in Explore</span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {plan?.includesReel && !listing.videoUrl && (
              <p className="mt-3 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-500">
                This listing has no video, so the reel placement won&apos;t show — only the listing promotion will.
              </p>
            )}

            <label className="mt-4 block text-xs text-ink/70">
              Mobile number (required by the payment provider)
              <input
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                disabled={busy}
                className="mt-1 w-full rounded-lg border border-line/10 bg-surface px-3 py-2 text-sm text-ink focus:outline-none"
              />
            </label>

            <ul className="mt-3 space-y-1 text-[11px] text-ink/50">
              <li>Promoted listings are always labelled “Sponsored”. Promotion buys visibility, not a guarantee of a sale.</li>
              <li>Your promotion starts only after your payment is confirmed. Sold or removed listings stop being shown.</li>
              <li>Promoted listings follow the same safety rules as every other listing.</li>
            </ul>

            {error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{error}</p>}

            <button
              onClick={pay}
              disabled={busy || !plan || phone.trim().length < 10}
              className="mt-4 w-full rounded-full bg-forest px-5 py-3 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
            >
              {stage === 'creating' && 'Preparing payment…'}
              {stage === 'paying' && 'Complete the payment in the window…'}
              {stage === 'confirming' && 'Confirming your payment…'}
              {!stage && (plan ? `Pay ${formatRupees(plan.pricePaise)} and promote` : 'Choose a plan')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
