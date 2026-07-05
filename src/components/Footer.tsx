import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-black/5 bg-cream">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-xs font-semibold text-cream">e</span>
              <span className="font-display text-base font-semibold">e-Sauda</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-ink/60">
              Trust-first local marketplace. Escrow-secured. Delivery baked in.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">Marketplace</h4>
            <ul className="mt-3 space-y-2 text-sm text-ink/60">
              <li><Link to="/browse" className="hover:text-clay">Browse listings</Link></li>
              <li><Link to="/sell" className="hover:text-clay">Sell an item</Link></li>
              <li><Link to="/vault" className="hover:text-clay">Sauda Vault</Link></li>
              <li><Link to="/orders" className="hover:text-clay">My orders</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">Trust &amp; safety</h4>
            <ul className="mt-3 space-y-2 text-sm text-ink/60">
              <li>DigiLocker verification</li>
              <li>OTP handover</li>
              <li>Chat moderation</li>
              <li>Safe meet zones</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink">Delivery partners</h4>
            <ul className="mt-3 space-y-2 text-sm text-ink/60">
              <li>Rapido</li>
              <li>Uber</li>
              <li>Dunzo</li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-black/5 pt-6 text-xs text-ink/40">
          © 2026 e-Sauda. Prototype demo.
        </p>
      </div>
    </footer>
  )
}
