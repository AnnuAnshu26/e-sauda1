import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sendPhoneOtp, verifyPhoneOtp } from '../lib/phoneAuth'

export default function VerifyPhone() {
  const { profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentOnce, setSentOnce] = useState(false)
  // Only ever populated when no real SMS provider is configured yet (see
  // send-phone-otp's MOCKED note) -- shown so you can test the flow without
  // needing a live SMS gateway.
  const [debugOtp, setDebugOtp] = useState<string | null>(null)

  async function sendCode() {
    setSending(true)
    setError(null)
    try {
      const { debugOtp } = await sendPhoneOtp(profile?.phone_number ?? '')
      setSentOnce(true)
      setDebugOtp(debugOtp ?? null)
    } catch (err: any) {
      setError(err.message || 'Could not send a code. Try again.')
    } finally {
      setSending(false)
    }
  }

  // Auto-send once as soon as we know the phone number to verify.
  useEffect(() => {
    if (profile?.phone_number && !sentOnce && !sending) sendCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.phone_number])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) {
      setError('Enter the 6-digit code.')
      return
    }
    setVerifying(true)
    setError(null)
    try {
      await verifyPhoneOtp(code)
      await refreshProfile()
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Could not verify that code.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-6 py-20">
      <h1 className="font-display text-2xl font-semibold">Verify your mobile number</h1>
      <p className="mt-2 text-sm text-ink/60">
        We sent a 6-digit code to <strong>{profile?.phone_number ?? 'your number'}</strong>. This is
        required once, and is how buyers/sellers can trust it's really you.
      </p>

      {debugOtp && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          No SMS provider is configured yet, so here's the code directly (see
          SMS_API_KEY in <code>send-phone-otp</code>): <strong>{debugOtp}</strong>
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit code"
          inputMode="numeric"
          maxLength={6}
          className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-center text-lg tracking-[0.4em]"
        />

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={verifying || code.length !== 6}
          className="w-full rounded-full bg-clay px-6 py-3 text-sm font-semibold text-white hover:bg-clay-light disabled:opacity-50"
        >
          {verifying ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      <button
        onClick={sendCode}
        disabled={sending}
        className="mt-4 text-sm font-medium text-clay hover:underline disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Resend code'}
      </button>

      <button onClick={() => signOut()} className="mt-6 text-sm text-ink/40 hover:underline">
        Sign out instead
      </button>
    </div>
  )
}
