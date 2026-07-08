import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Search, Bell, Plus, User as UserIcon, MessageSquare, Wallet, ShoppingBag, LogOut, Inbox } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate(`/browse${query ? `?q=${encodeURIComponent(query)}` : ''}`)
  }

  async function handleSignOut() {
    await signOut()
    setMenuOpen(false)
    navigate('/')
  }

  const initial = (profile?.display_name || user?.email || 'Y').charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-sm font-semibold text-cream">
            e
          </span>
          <span className="font-display text-lg font-semibold text-ink">e-Sauda</span>
        </Link>

        <form
          onSubmit={onSearch}
          className="flex flex-1 items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 max-w-xl"
        >
          <MapPin size={16} className="shrink-0 text-ink/60" />
          <span className="shrink-0 text-sm text-ink/80">{profile?.city || 'Bengaluru'}</span>
          <span className="h-4 w-px shrink-0 bg-black/10" />
          <Search size={16} className="shrink-0 text-ink/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try &quot;mechanical keyboard under 3k&quot;'
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink/40 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-clay/15 px-3 py-1 text-xs font-semibold text-clay"
          >
            AI SEARCH
          </button>
        </form>

        <nav className="hidden shrink-0 items-center gap-6 text-sm font-medium text-ink/80 md:flex">
          <Link to="/browse" className="hover:text-ink">Browse</Link>
          {user && <Link to="/messages" className="hover:text-ink">Messages</Link>}
          <Link to="/vault" className="hover:text-ink">Vault</Link>
          <Link to="/orders" className="hover:text-ink">Orders</Link>
        </nav>

        <button className="relative shrink-0 rounded-full p-2 text-ink/70 hover:bg-black/5" aria-label="Notifications">
          <Bell size={18} />
        </button>

        {!user ? (
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-ink/80 hover:text-ink">
              Log in
            </Link>
            <Link to="/signup" className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest-light">
              Sign up
            </Link>
          </div>
        ) : (
          <>
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-light font-semibold text-white"
              >
                {initial}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl2 border border-black/10 bg-white p-2 shadow-xl">
                  <div className="flex items-center gap-3 border-b border-black/5 p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-light font-semibold text-white">
                      {initial}
                    </span>
                    <div>
                      <p className="truncate text-sm font-semibold text-ink">
                        {profile?.display_name || user.email}
                      </p>
                      <p className="text-xs text-ink/60">Trust {profile?.trust_score ?? 50}</p>
                    </div>
                  </div>
                  <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream">
                    <UserIcon size={16} /> My profile
                  </Link>
                  <Link to="/messages" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream">
                    <Inbox size={16} /> Messages
                  </Link>
                  <Link to="/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream">
                    <MessageSquare size={16} /> My orders
                  </Link>
                  <Link to="/vault" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream">
                    <Wallet size={16} /> Sauda Vault
                  </Link>
                  <Link to="/browse" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-cream">
                    <ShoppingBag size={16} /> Browse marketplace
                  </Link>
                  <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm text-red-600 hover:bg-red-50">
                    <LogOut size={16} /> Log out
                  </button>
                </div>
              )}
            </div>

            <Link
              to="/sell"
              className="flex shrink-0 items-center gap-1 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest-light"
            >
              <Plus size={16} /> Sell
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
