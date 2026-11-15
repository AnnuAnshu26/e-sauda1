import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronDown, Circle, Flag, HandCoins, X } from 'lucide-react'
import {
  confirmHandover,
  fetchDisputesForConversation,
  fetchHandover,
  openDispute,
  DISPUTE_REASON_LABELS,
  Dispute,
  DisputeReason,
  Handover,
} from '../lib/handover'

interface Props {
  conversationId: string
  isBuyer: boolean
  listingStatus: string | null
  // Called after a confirmation so the parent can refresh the listing status (sold -> ratings unlock).
  onChanged: () => void
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// "Did the item change hands?" -- confirmed separately by BOTH people. No money moves through
// e-Sauda: payment is made directly between buyer and seller. This only records the two
// confirmations (with timestamps) and gives either person a way to report a problem.
//
// Layout: ONE compact bar so the conversation keeps its space. Timestamps and "Report a problem"
// live behind the "Details" toggle; the report form is a popup, not inline.
export default function DealPanel({ conversationId, isBuyer, listingStatus, onChanged }: Props) {
  const [handover, setHandover] = useState<Handover | null>(null)
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState<DisputeReason>(isBuyer ? 'not_received' : 'receipt_not_confirmed')
  const [details, setDetails] = useState('')

  async function load() {
    try {
      const [h, d] = await Promise.all([fetchHandover(conversationId), fetchDisputesForConversation(conversationId)])
      setHandover(h)
      setDisputes(d)
    } catch {
      /* panel simply shows the default (nothing confirmed yet) state */
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => {
    setLoaded(false)
    setHandover(null)
    setDisputes([])
    setOpen(false)
    setReporting(false)
    setError(null)
    load()
  }, [conversationId])

  // Escape closes the report popup.
  useEffect(() => {
    if (!reporting) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && setReporting(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [reporting, busy])

  const sellerDone = !!handover?.sellerConfirmedAt
  const buyerDone = !!handover?.buyerConfirmedAt
  const myConfirmedAt = isBuyer ? handover?.buyerConfirmedAt : handover?.sellerConfirmedAt
  const otherDone = isBuyer ? sellerDone : buyerDone
  const completed = !!handover?.completedAt
  const liveDispute = disputes.find((d) => d.status === 'open' || d.status === 'under_review')
  const closedDispute = disputes.find((d) => d.status === 'resolved' || d.status === 'dismissed')
  const canConfirm = !myConfirmedAt && !completed && listingStatus !== 'removed'
  const confirmedCount = Number(sellerDone) + Number(buyerDone)
  const otherRole = isBuyer ? 'seller' : 'buyer'

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      setHandover(await confirmHandover(conversationId))
      onChanged()
    } catch (e: any) {
      setError(e?.message || 'Could not record your confirmation. Try again.')
      setOpen(true)
    } finally {
      setBusy(false)
    }
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await openDispute(conversationId, reason, details)
      setReporting(false)
      setDetails('')
      await load()
    } catch (err: any) {
      setError(
        err?.message?.includes('check constraint')
          ? 'Please describe the problem in at least 10 characters.'
          : err?.message || 'Could not send your report.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return null
  // Nothing to show for a listing that was sold in a different conversation and never started here.
  if (listingStatus !== 'active' && listingStatus !== null && !handover && disputes.length === 0) return null

  // One short line saying where things stand and what (if anything) is needed from YOU.
  let status = 'Handover not confirmed yet'
  if (completed) status = 'Deal completed — both confirmed'
  else if (myConfirmedAt) status = `You confirmed · waiting for the ${otherRole}`
  else if (otherDone) status = `The ${otherRole} confirmed — your turn`

  const Step = ({ done, label, at }: { done: boolean; label: string; at?: string | null }) => (
    <li className="flex items-center gap-2 text-xs">
      {done ? <CheckCircle2 size={14} className="shrink-0 text-emerald-500" /> : <Circle size={14} className="shrink-0 text-ink/30" />}
      <span className={done ? 'text-ink' : 'text-ink/60'}>{label}</span>
      {at && <span className="text-ink/40">· {fmt(at)}</span>}
    </li>
  )

  return (
    <div className="shrink-0 border-b border-line/5 bg-surface/40" data-testid="deal-panel">
      {/* Compact bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink">
          <HandCoins size={13} className="shrink-0" />
          <span className="truncate">{status}</span>
          {!completed && <span className="shrink-0 font-normal text-ink/40">({confirmedCount}/2)</span>}
        </span>
        {liveDispute && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">Problem reported</span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {canConfirm && (
            <button
              onClick={handleConfirm}
              disabled={busy}
              className="rounded-full bg-forest px-3 py-1 text-xs font-semibold text-cream disabled:opacity-50"
            >
              {busy ? 'Saving…' : isBuyer ? 'I received it' : 'I handed it over'}
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-ink/60 hover:bg-cream-dark"
          >
            Details <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </span>
      </div>

      {error && !reporting && <p className="px-4 pb-2 text-xs text-red-400">{error}</p>}

      {/* Details (collapsed by default). Capped height so it can never swallow the chat. */}
      {open && (
        <div className="max-h-44 space-y-2 overflow-y-auto overscroll-contain border-t border-line/5 px-4 py-3">
          <ul className="space-y-1.5">
            <Step done={sellerDone} label="Seller confirmed the item was handed over" at={handover?.sellerConfirmedAt} />
            <Step done={buyerDone} label="Buyer confirmed they received it" at={handover?.buyerConfirmedAt} />
          </ul>
          {liveDispute && (
            <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">
              A problem was reported ({DISPUTE_REASON_LABELS[liveDispute.reason]}) and is{' '}
              {liveDispute.status === 'under_review' ? 'being reviewed' : 'waiting for review'}.
            </p>
          )}
          {closedDispute && (
            <p className="rounded-lg bg-ink/5 p-2 text-xs text-ink/70">
              A reported problem was {closedDispute.status === 'resolved' ? 'resolved' : 'closed'}: {closedDispute.resolutionNote}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {!liveDispute && (
              <button
                onClick={() => setReporting(true)}
                className="flex items-center gap-1.5 rounded-full border border-line/10 bg-surface px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-cream-dark"
              >
                <Flag size={12} /> Report a problem
              </button>
            )}
            <Link to="/safety" className="text-[11px] text-ink/50 underline">
              How this works
            </Link>
          </div>
        </div>
      )}

      {/* Report popup */}
      {reporting && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onMouseDown={(e) => e.target === e.currentTarget && !busy && setReporting(false)}
        >
          <form
            onSubmit={handleReport}
            role="dialog"
            aria-modal="true"
            aria-label="Report a problem"
            className="glass-elevated max-h-[92dvh] w-full max-w-md space-y-3 overflow-y-auto overscroll-contain rounded-t-xl2 p-5 sm:rounded-xl2"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">Report a problem</h2>
              <button type="button" onClick={() => setReporting(false)} disabled={busy} aria-label="Close" className="rounded-full p-1.5 text-ink/60 hover:bg-cream-dark">
                <X size={16} />
              </button>
            </div>
            <label className="block text-xs text-ink/70">
              What went wrong?
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as DisputeReason)}
                className="mt-1 w-full rounded-lg border border-line/10 bg-surface px-3 py-2 text-sm text-ink"
              >
                {(Object.keys(DISPUTE_REASON_LABELS) as DisputeReason[]).map((r) => (
                  <option key={r} value={r}>
                    {DISPUTE_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-ink/70">
              Describe what happened
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                className="mt-1 w-full rounded-lg border border-line/10 bg-surface px-3 py-2 text-sm text-ink"
                placeholder="What was agreed, what happened, and when."
              />
            </label>
            <p className="text-[11px] text-ink/50">
              Our team can read this conversation to review your report. e-Sauda does not handle the payment, so we cannot
              refund money, but we can act on accounts.
            </p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || details.trim().length < 10}
                className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-cream disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Send report'}
              </button>
              <button
                type="button"
                onClick={() => setReporting(false)}
                disabled={busy}
                className="rounded-full border border-line/10 px-4 py-2 text-sm font-semibold text-ink/70"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
