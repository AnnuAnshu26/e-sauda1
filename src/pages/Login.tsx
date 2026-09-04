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
    <div className="mx-auto flex max-w-sm flex-col px-6 py-20">
      <h1 className="font-display text-3xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-ink/60">Welcome back to e-Sauda.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
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

        {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        New here?{' '}
        <Link to="/signup" className="font-semibold text-clay hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
