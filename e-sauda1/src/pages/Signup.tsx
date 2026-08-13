import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!/^[6-9]\d{9}$/.test(phoneNumber.replace(/\D/g, ''))) {
      setError('Enter a valid 10-digit mobile number — we\'ll send a code to verify it.')
      return
    }

    setLoading(true)
    const { error } = await signUp(email, password, name, phoneNumber)
    setLoading(false)

    if (error) {
      setError(error)
      return
    }

    // Supabase sends a confirmation email by default. Until the user clicks it, there's no
    // active session — so we tell them to check their inbox instead of redirecting in as if
    // they're logged in.
    setCheckEmail(true)
  }

  if (checkEmail) {
    return (
      <div className="mx-auto max-w-sm px-6 py-24 text-center">
        <span className="text-xs uppercase tracking-widest2 text-ink/40">(Almost there)</span>
        <h1 className="mt-2 font-display text-3xl italic text-ink">Check your inbox</h1>
        <p className="mt-3 text-sm text-ink/60">
          We sent a confirmation link to <strong className="text-ink">{email}</strong>. Click it, then come back and
          log in.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="mt-6 rounded-full bg-forest px-6 py-3 text-sm font-medium text-cream hover:bg-forest-light"
        >
          Go to login
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-6 py-24">
      <span className="text-xs uppercase tracking-widest2 text-ink/40">(Join e-Sauda)</span>
      <h1 className="mt-2 font-display text-4xl italic text-ink">Create an account</h1>
      <p className="mt-2 text-sm text-ink/50">Takes under a minute. First listing is ₹1.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-widest2 text-ink/40">Display name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What buyers/sellers will see"
            className="mt-2 w-full rounded-lg border border-ink/10 bg-cream px-3 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest2 text-ink/40">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-lg border border-ink/10 bg-cream px-3 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest2 text-ink/40">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="mt-2 w-full rounded-lg border border-ink/10 bg-cream px-3 py-2.5 text-sm text-ink"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest2 text-ink/40">Mobile number</label>
          <div className="mt-2 flex items-center overflow-hidden rounded-lg border border-ink/10">
            <span className="border-r border-ink/10 bg-cream-dark px-3 py-2.5 text-sm text-ink/60">+91</span>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="10-digit number"
              maxLength={10}
              className="flex-1 bg-cream px-3 py-2.5 text-sm text-ink focus:outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-ink/40">We'll text you a one-time code to verify this.</p>
        </div>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-forest px-6 py-3 text-sm font-medium text-cream hover:bg-forest-light disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/50">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-clay hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
