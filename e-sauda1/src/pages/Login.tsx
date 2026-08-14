import { useState, FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string })?.from || '/'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-6 py-24">
      <span className="text-xs uppercase tracking-widest2 text-ink/40">(Welcome back)</span>
      <h1 className="mt-2 font-display text-4xl italic text-ink">Log in</h1>
      <p className="mt-2 text-sm text-ink/50">Good to see you again.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
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
            className="mt-2 w-full rounded-lg border border-ink/10 bg-cream px-3 py-2.5 text-sm text-ink"
          />
          <Link to="/forgot-password" className="mt-2 inline-block text-xs font-medium text-clay hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-forest px-6 py-3 text-sm font-medium text-cream hover:bg-forest-light disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/50">
        New here?{' '}
        <Link to="/signup" className="font-medium text-clay hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
