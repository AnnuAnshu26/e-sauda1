import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-cream">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/15 font-display text-sm italic text-ink">e</span>
              <span className="font-display text-lg italic text-ink">e-Sauda</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-ink/50">
              Trust-first local marketplace. Escrow-secured. Delivery baked in.
            </p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest2 text-ink/40">Marketplace</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-ink/60">
              <li><Link to="/browse" className="hover:text-clay">Browse listings</Link></li>
              <li><Link to="/sell" className="hover:text-clay">Sell an item</Link></li>
              <li><Link to="/vault" className="hover:text-clay">Sauda Vault</Link></li>
              <li><Link to="/orders" className="hover:text-clay">My orders</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest2 text-ink/40">Trust &amp; safety</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-ink/60">
              <li>DigiLocker verification (coming soon)</li>
              <li>OTP handover</li>
              <li>Chat moderation</li>
              <li>Report &amp; block</li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest2 text-ink/40">Legal</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-ink/60">
              <li><Link to="/terms" className="hover:text-clay">Terms and conditions</Link></li>
              <li><Link to="/privacy" className="hover:text-clay">Privacy policy</Link></li>
              <li><Link to="/refund-policy" className="hover:text-clay">Cancellation &amp; refunds</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-clay">Shipping policy</Link></li>
              <li><Link to="/pricing" className="hover:text-clay">Pricing</Link></li>
              <li><Link to="/contact" className="hover:text-clay">Contact us</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-12 border-t border-ink/10 pt-6 text-xs text-ink/40">
          © 2026 e-Sauda. <Link to="/terms" className="hover:text-clay">Terms</Link> · <Link to="/privacy" className="hover:text-clay">Privacy</Link>
        </p>
      </div>
    </footer>
  )
}
