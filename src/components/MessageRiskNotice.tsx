import { useState } from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { Message } from '../types'
import { warningFor } from '../lib/moderation'
import { appealMessageFlag } from '../lib/chat'

// Shown under a chat bubble whose message the server-side scanner flagged.
//  - To the RECIPIENT (the person who could be scammed): a clear warning that stays attached to the
//    message, explaining what is risky and what to do.
//  - To the SENDER: a short note that the other person was warned, with a way to ask for a human
//    review if they think it was a false positive.
// A flag is a risk signal, not proof of fraud.
export default function MessageRiskNotice({ message, mine }: { message: Message; mine: boolean }) {
  const [appeal, setAppeal] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  if (message.riskLevel === 'low' && !message.flagged) return null

  const level = message.riskLevel === 'low' ? 'medium' : message.riskLevel
  const warning = warningFor(level, message.flagReasons)
  if (!warning) return null
  const high = level === 'high'

  if (!mine) {
    return (
      <div
        role="alert"
        className={`mt-1 max-w-[75%] rounded-lg border p-3 text-xs ${
          high ? 'border-red-500/40 bg-red-500/10 text-red-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'
        }`}
      >
        <p className="flex items-center gap-1.5 font-semibold">
          {high ? <ShieldAlert size={13} /> : <AlertTriangle size={13} />} {warning.title}
        </p>
        {warning.lines.length > 0 ? (
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-ink/80">
            {warning.lines.map((l) => (
              <li key={l}>This message {l}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-ink/80">Never share OTPs, never pay in advance, and pay only in person after checking the item.</p>
        )}
        <p className="mt-1.5 text-ink/60">
          Stay safe! Never share personal payment details or transfer money before you have met and checked the item.
        </p>
      </div>
    )
  }

  async function onAppeal() {
    setAppeal('sending')
    try {
      await appealMessageFlag(message.id)
      setAppeal('sent')
    } catch {
      setAppeal('error')
    }
  }

  return (
    <p className="mt-1 flex max-w-[75%] flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-[11px] text-amber-500">
      <span className="flex items-center gap-1">
        <AlertTriangle size={11} /> The other person was shown a safety warning on this message.
      </span>
      {appeal === 'idle' && (
        <button onClick={onAppeal} className="underline hover:text-amber-400">
          Think this is a mistake?
        </button>
      )}
      {appeal === 'sending' && <span>Sending…</span>}
      {appeal === 'sent' && <span className="text-ink/60">Review requested — thank you.</span>}
      {appeal === 'error' && <span className="text-red-400">Couldn't send the request.</span>}
    </p>
  )
}
