import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminFetchDisputes, adminResolveDispute, Dispute, DISPUTE_REASON_LABELS, DisputeStatus } from '../lib/handover'
import {
  adminFetchPromotions,
  adminPromotionStats,
  adminSetPromotionStatus,
  AdminPromotion,
  formatRupees,
  isLive,
  PROMOTION_STATUS_LABEL,
} from '../lib/promotions'
import {
  adminFetchMessageBody,
  adminFetchModerationEvents,
  adminReviewModerationEvent,
  ModerationEvent,
} from '../lib/moderationAdmin'
import { reasonCopy } from '../lib/moderation'

const card = 'rounded-xl2 border border-line/5 bg-surface p-5'
const skeleton = <div className="h-28 animate-pulse rounded-xl2 bg-cream-dark" />
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    load()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e?.message || 'Could not load'))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, error, reload: () => setTick((t) => t + 1) }
}

// ---------------------------------------------------------------- Disputes
export function AdminDisputes() {
  const [filter, setFilter] = useState<DisputeStatus | 'all'>('open')
  const { data, error, reload } = useLoad(() => adminFetchDisputes(filter === 'all' ? undefined : filter), [filter])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [acting, setActing] = useState<string | null>(null)
  const [actError, setActError] = useState<string | null>(null)

  async function act(d: Dispute, status: 'under_review' | 'resolved' | 'dismissed') {
    setActing(d.id)
    setActError(null)
    try {
      await adminResolveDispute(d.id, status, notes[d.id] ?? '')
      reload()
    } catch (e: any) {
      setActError(e?.message || 'Could not update')
    } finally {
      setActing(null)
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Deal disputes</h1>
      <p className="mt-1 text-sm text-ink/60">
        Problems reported after a handover. You can read the conversation of a disputed deal (and only those). No money is
        held by e-Sauda, so actions are on accounts and listings.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {(['open', 'under_review', 'resolved', 'dismissed', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${filter === f ? 'bg-forest text-cream' : 'border border-line/10 bg-surface text-ink/80'}`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>
      {(error || actError) && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error || actError}</p>}
      <div className="mt-5 space-y-3">
        {!data ? skeleton : data.length === 0 ? <p className={`${card} text-center text-sm text-ink/50`}>No disputes here.</p> : data.map((d) => (
          <div key={d.id} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-clay/10 px-2.5 py-1 text-xs font-medium text-clay">{DISPUTE_REASON_LABELS[d.reason]}</span>
              <span className="text-xs text-ink/40">{when(d.createdAt)} · <span className="capitalize">{d.status.replace('_', ' ')}</span></span>
            </div>
            <p className="mt-3 text-sm text-ink/80">{d.description}</p>
            <p className="mt-2 text-xs text-ink/60">
              Raised by <Link to={`/seller/${d.raisedBy}`} className="text-clay hover:underline">user</Link> against{' '}
              <Link to={`/seller/${d.againstUser}`} className="text-clay hover:underline">user</Link> ·{' '}
              <Link to={`/listing/${d.listingId}`} className="text-clay hover:underline">listing</Link> ·{' '}
              <Link to={`/messages/${d.conversationId}`} className="text-clay hover:underline">conversation</Link>
            </p>
            {d.resolutionNote && <p className="mt-2 rounded-lg bg-ink/5 p-2 text-xs text-ink/70">Resolution: {d.resolutionNote}</p>}
            {(d.status === 'open' || d.status === 'under_review') && (
              <div className="mt-3 space-y-2">
                <input value={notes[d.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))} placeholder="Resolution note (shown to both people; required to close)" maxLength={1000} className="w-full rounded-lg border border-line/10 bg-surface px-3 py-2 text-sm" />
                <div className="flex flex-wrap gap-2">
                  {d.status === 'open' && <button disabled={acting === d.id} onClick={() => act(d, 'under_review')} className="rounded-full border border-line/10 px-3 py-1.5 text-xs font-semibold text-ink/80">Mark under review</button>}
                  <button disabled={acting === d.id} onClick={() => act(d, 'resolved')} className="rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-50">Resolve</button>
                  <button disabled={acting === d.id} onClick={() => act(d, 'dismissed')} className="rounded-full border border-line/10 px-3 py-1.5 text-xs font-semibold text-ink/80 disabled:opacity-50">Dismiss</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Promotions
export function AdminPromotions() {
  const { data, error, reload } = useLoad(() => Promise.all([adminFetchPromotions(), adminPromotionStats()]), [])
  const [acting, setActing] = useState<string | null>(null)
  const [actError, setActError] = useState<string | null>(null)

  async function act(p: AdminPromotion, status: 'paused' | 'active' | 'cancelled') {
    const note = status === 'active' ? '' : prompt('Reason (visible to admins only):') ?? ''
    if (status !== 'active' && !note) return
    setActing(p.id)
    setActError(null)
    try {
      await adminSetPromotionStatus(p.id, status, note)
      reload()
    } catch (e: any) {
      setActError(e?.message || 'Could not update')
    } finally {
      setActing(null)
    }
  }
  const [promos, stats] = data ?? [null, null]

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Promotions</h1>
      <p className="mt-1 text-sm text-ink/60">Plans and prices are rows in <code>promotion_plans</code>. Edit them in the Supabase table editor.</p>
      {(error || actError) && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error || actError}</p>}
      {stats && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[['Revenue', formatRupees(stats.revenuePaise)], ['Active', stats.active], ['Expired', stats.expired], ['Failed', stats.failed], ['Needs review', stats.review]].map(([k, v]) => (
            <div key={String(k)} className={card}><p className="text-xs text-ink/50">{k}</p><p className="mt-1 font-display text-xl font-semibold">{v}</p></div>
          ))}
        </div>
      )}
      <div className="mt-5 space-y-3">
        {!promos ? skeleton : promos.length === 0 ? <p className={`${card} text-center text-sm text-ink/50`}>No promotions yet.</p> : promos.map((p) => (
          <div key={p.id} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                {formatRupees(p.amountPaise)} · {p.planCode}{p.includesReel && ' (+reel)'}
              </span>
              <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-ink/70">
                {p.status === 'active' && !isLive(p) ? 'Expired' : PROMOTION_STATUS_LABEL[p.status]}
              </span>
            </div>
            <p className="mt-2 text-xs text-ink/60">
              <Link to={`/listing/${p.listingId}`} className="text-clay hover:underline">listing</Link> · seller{' '}
              <Link to={`/seller/${p.sellerId}`} className="text-clay hover:underline">profile</Link> · created {when(p.createdAt)}
              {p.expiresAt && ` · expires ${when(p.expiresAt)}`} · order <span className="font-mono">{p.cashfreeOrderId}</span>
            </p>
            {p.adminNote && <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">{p.adminNote}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {p.status === 'active' && isLive(p) && <button disabled={acting === p.id} onClick={() => act(p, 'paused')} className="rounded-full border border-line/10 px-3 py-1.5 text-xs font-semibold">Pause</button>}
              {p.status === 'paused' && <button disabled={acting === p.id} onClick={() => act(p, 'active')} className="rounded-full border border-line/10 px-3 py-1.5 text-xs font-semibold">Resume</button>}
              {p.paidAt && (p.status === 'active' || p.status === 'paused') && <button disabled={acting === p.id} onClick={() => act(p, 'cancelled')} className="rounded-full border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400">Remove</button>}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-ink/40">Removing a promotion does not refund the payment: refunds are issued from the Cashfree dashboard.</p>
    </div>
  )
}

// ---------------------------------------------------------------- Chat safety
export function AdminChatSafety() {
  const [filter, setFilter] = useState<'appeals' | 'escalated' | 'high' | 'all'>('appeals')
  const { data, error, reload } = useLoad(() => adminFetchModerationEvents(filter), [filter])
  const [bodies, setBodies] = useState<Record<string, string | null>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [acting, setActing] = useState<string | null>(null)
  const [actError, setActError] = useState<string | null>(null)

  async function showBody(ev: ModerationEvent) {
    if (!ev.messageId) return
    const body = await adminFetchMessageBody(ev.messageId)
    setBodies((b) => ({ ...b, [ev.id]: body ?? '(not available)' }))
  }

  async function review(ev: ModerationEvent, outcome: 'upheld' | 'overturned') {
    setActing(ev.id)
    setActError(null)
    try {
      await adminReviewModerationEvent(ev.id, outcome, notes[ev.id] ?? '')
      reload()
    } catch (e: any) {
      setActError(e?.message || 'Could not update')
    } finally {
      setActing(null)
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Chat safety</h1>
      <p className="mt-1 text-sm text-ink/60">
        Messages the scanner flagged. Excerpts are redacted (numbers, UPI IDs and links are masked). A flag is a risk signal, not
        proof of fraud: the other person was shown a warning, nothing was blocked.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {(['appeals', 'escalated', 'high', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${filter === f ? 'bg-forest text-cream' : 'border border-line/10 bg-surface text-ink/80'}`}>
            {f === 'escalated' ? 'Repeat senders' : f}
          </button>
        ))}
      </div>
      {(error || actError) && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error || actError}</p>}
      <div className="mt-5 space-y-3">
        {!data ? skeleton : data.length === 0 ? <p className={`${card} text-center text-sm text-ink/50`}>Nothing here.</p> : data.map((ev) => (
          <div key={ev.id} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ev.riskLevel === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-500'}`}>
                {ev.riskLevel} risk{ev.escalated && ' · repeat sender'}
              </span>
              <span className="text-xs text-ink/40">{when(ev.createdAt)}</span>
            </div>
            <p className="mt-2 text-xs text-ink/60">{ev.reasons.map((r) => r.replace(/_/g, ' ')).join(', ')}</p>
            <p className="mt-2 rounded-lg bg-ink/5 p-2 font-mono text-xs text-ink/80">{ev.excerpt}</p>
            {ev.appealStatus !== 'none' && (
              <div className="mt-3 rounded-lg border border-line/10 p-3 text-xs">
                <p className="font-semibold text-ink">Appeal: <span className="capitalize">{ev.appealStatus}</span></p>
                {ev.appealNote && <p className="mt-1 text-ink/70">{ev.appealNote}</p>}
                {ev.appealStatus === 'requested' && ev.messageId && (
                  <>
                    <button className="mt-2 text-clay underline" onClick={() => showBody(ev)}>
                      Show full message
                    </button>
                    {bodies[ev.id] && <p className="mt-1 rounded bg-ink/5 p-2 text-ink/80">{bodies[ev.id]}</p>}
                    <input value={notes[ev.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [ev.id]: e.target.value }))} placeholder="Review note" maxLength={500} className="mt-2 w-full rounded-lg border border-line/10 bg-surface px-3 py-2 text-xs" />
                    <div className="mt-2 flex gap-2">
                      <button disabled={acting === ev.id} onClick={() => review(ev, 'overturned')} className="rounded-full bg-forest px-3 py-1.5 font-semibold text-cream disabled:opacity-50">Flag was a mistake</button>
                      <button disabled={acting === ev.id} onClick={() => review(ev, 'upheld')} className="rounded-full border border-line/10 px-3 py-1.5 font-semibold">Flag stands</button>
                    </div>
                  </>
                )}
                {ev.reviewNote && <p className="mt-1 text-ink/60">Note: {ev.reviewNote}</p>}
              </div>
            )}
            {ev.reasons.length > 0 && <p className="mt-2 text-[11px] text-ink/40">{reasonCopy(ev.reasons[0])}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
