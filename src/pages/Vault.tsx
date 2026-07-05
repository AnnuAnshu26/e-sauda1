import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'

export default function Vault() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-clay/10 text-clay">
        <Lock size={26} />
      </span>
      <h1 className="mt-6 font-display text-2xl font-semibold">Your Sauda Vault is empty</h1>
      <p className="mt-2 max-w-md text-sm text-ink/60">
        When you tap <strong>Buy with Vault</strong> on a listing, it appears here — funds locked,
        OTP for handover, delivery in a tap.
      </p>
      <button
        onClick={() => navigate('/browse')}
        className="mt-6 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light"
      >
        Find something to buy
      </button>
    </div>
  )
}
