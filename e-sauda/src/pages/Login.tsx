import { useState, FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Phone, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type Tab = 'phone' | 'email'

// Basic +<countrycode><number> shape, e.g. +919876543210 -- Supabase's phone
// auth expects E.164, and this is the cheapest way to nudge people into
// typing it that way without pulling in a full phone-input library.
const E164 = /^\+[1-9]\d{7,14}$/

export default function Login() {
  const { signIn, signInWithGoogle, requestPhoneOtp, verifyPhoneOtp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from || '/'

  const [tab, setTab] = useState<Tab>('phone')

  // Email/password state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  // Phone + OTP state
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneLoading, setPhoneLoading] = useState(false)

  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setEmailLoading(true)
    const { error } = await signIn(email, password)
    setEmailLoading(false)
    if (error) {
      setEmailError(error)
      return
    }
    navigate(from, { replace: true })
  }

  async function onRequestOtp(e: FormEvent) {
    e.preventDefault()
    setPhoneError(null)
    if (!E164.test(phone.trim())) {
      setPhoneError('Enter your number with country code, e.g. +919876543210')
      return
    }
    setPhoneLoading(true)
    const { error } = await requestPhoneOtp(phone.trim())
    setPhoneLoading(false)
    if (error) {
      setPhoneError(error)
      return
    }
    setOtpSent(true)
  }

  async function onVerifyOtp(e: FormEvent) {
    e.preventDefault()
    setPhoneError(null)
    if (!otp.trim()) {
      setPhoneError('Enter the code we texted you.')
      return
    }
    setPhoneLoading(true)
    const { error } = await verifyPhoneOtp(phone.trim(), otp.trim())
    setPhoneLoading(false)
    if (error) {
      setPhoneError(error)
      return
    }
    navigate(from, { replace: true })
  }

  async function onGoogle() {
    setGoogleError(null)
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    // On success the browser navigates away to Google immediately, so this
    // setGoogleLoading(false) only ever actually runs on the failure path.
    if (error) {
      setGoogleError(error)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-6 py-20">
      <h1 className="font-display text-3xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-ink/60">Welcome back to e-Sauda.</p>

      <button
        onClick={onGoogle}
        disabled={googleLoading}
        className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-full border border-line/10 bg-surface px-6 py-3 text-sm font-semibold text-ink hover:bg-cream-dark disabled:opacity-50"
      >
        <GoogleIcon />
        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </button>
      {googleError && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{googleError}</p>}

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line/10" />
        <span className="text-xs font-medium uppercase tracking-wide text-ink/40">or</span>
        <span className="h-px flex-1 bg-line/10" />
      </div>

      <div className="flex rounded-full border border-line/10 bg-surface p-1">
        <button
          onClick={() => setTab('phone')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition ${
            tab === 'phone' ? 'bg-forest text-ink' : 'text-ink/50'
          }`}
        >
          <Phone size={14} /> Mobile
        </button>
        <button
          onClick={() => setTab('email')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition ${
            tab === 'email' ? 'bg-forest text-ink' : 'text-ink/50'
          }`}
        >
          <Mail size={14} /> Email
        </button>
      </div>

      {tab === 'phone' ? (
        !otpSent ? (
          <form onSubmit={onRequestOtp} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-ink">Mobile number</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
              />
              <p className="mt-1.5 text-xs text-ink/40">Include your country code.</p>
            </div>
            {phoneError && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{phoneError}</p>}
            <button
              type="submit"
              disabled={phoneLoading}
              className="w-full rounded-full bg-forest px-6 py-3 text-sm font-semibold text-ink hover:bg-forest-light disabled:opacity-50"
            >
              {phoneLoading ? 'Sending code…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerifyOtp} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-ink">Enter the code sent to {phone}</label>
              <input
                type="text"
                inputMode="numeric"
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm tracking-widest"
              />
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false)
                  setOtp('')
                  setPhoneError(null)
                }}
                className="mt-2 text-xs font-medium text-clay hover:underline"
              >
                Use a different number
              </button>
            </div>
            {phoneError && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{phoneError}</p>}
            <button
              type="submit"
              disabled={phoneLoading}
              className="w-full rounded-full bg-forest px-6 py-3 text-sm font-semibold text-ink hover:bg-forest-light disabled:opacity-50"
            >
              {phoneLoading ? 'Verifying…' : 'Verify & log in'}
            </button>
          </form>
        )
      ) : (
        <form onSubmit={onEmailSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-ink">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-surface text-ink mt-2 w-full rounded-lg border border-line/10 px-3 py-2.5 text-sm"
            />
            <Link to="/forgot-password" className="mt-2 inline-block text-xs font-medium text-clay hover:underline">
              Forgot password?
            </Link>
          </div>

          {emailError && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{emailError}</p>}

          <button
            type="submit"
            disabled={emailLoading}
            className="w-full rounded-full bg-forest px-6 py-3 text-sm font-semibold text-ink hover:bg-forest-light disabled:opacity-50"
          >
            {emailLoading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink/60">
        New here?{' '}
        <Link to="/signup" className="font-semibold text-clay hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.4C29.6 35.4 26.9 36.5 24 36.5c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.6 5.4C40.7 36.6 44 30.9 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  )
}
