import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Lock, ShieldCheck, MapPin, MessageCircle } from 'lucide-react'
import { fetchListingById } from '../lib/listings'
import { fetchRecommendedListings } from '../lib/recommendations'
import { getOrCreateConversation } from '../lib/chat'
import { createVaultOrder } from '../lib/vault'
import { payWithRazorpay } from '../lib/razorpay'
import { useAuth } from '../context/AuthContext'
import { useSavedListings } from '../hooks/useSavedListings'
import { Listing, VaultOrderWithOtp } from '../types'
import ReportButton from '../components/ReportButton'
import ListingCard from '../components/ListingCard'
import SpaceFitViewer from '../components/SpaceFitViewer'

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { savedIds, toggleSaved } = useSavedListings()
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activePhoto, setActivePhoto] = useState(0)
  const [startingChat, setStartingChat] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [purchase, setPurchase] = useState<VaultOrderWithOtp | null>(null)
  const [recommended, setRecommended] = useState<Listing[]>([])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchListingById(id)
      .then((data) => {
        if (!data) setNotFound(true)
        setListing(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  // Runs after the main listing loads (not in parallel with it) since it needs the
  // listing's category to know what to look for. Failing quietly to an empty list is
  // fine here — this section is a bonus, not core to viewing or buying the listing.
  useEffect(() => {
    if (!listing) {
      setRecommended([])
      return
    }
    let cancelled = false
    fetchRecommendedListings(listing)
      .then((results) => {
        if (!cancelled) setRecommended(results)
      })
      .catch(() => {
        if (!cancelled) setRecommended([])
      })
    return () => {
      cancelled = true
    }
  }, [listing?.id, listing?.category])

  const isOwner = !!user && !!listing && user.id === listing.ownerId

  async function handleChat() {
    if (!user) {
      navigate('/login')
      return
    }
    if (!listing) return
    setStartingChat(true)
    setChatError(null)
    try {
      const conversation = await getOrCreateConversation(listing.id, user.id, listing.ownerId)
      navigate(`/messages/${conversation.id}`)
    } catch (err: any) {
      setChatError(err.message || 'Could not start a chat. Try again.')
    } finally {
      setStartingChat(false)
    }
  }

  async function handleBuy() {
    if (!user) {
      navigate('/login')
      return
    }
    if (!listing) return
    setBuying(true)
    setBuyError(null)
    try {
      const { razorpayOrderId } = await payWithRazorpay(
        listing.id,
        profile?.display_name || 'e-Sauda buyer',
        user.email || '',
      )
      const order = await createVaultOrder(listing.id, razorpayOrderId)
      setPurchase(order)
      setListing({ ...listing, status: 'sold' })
    } catch (err: any) {
      // Closing the Checkout modal without paying isn't a failure worth alarming
      // someone about -- they just changed their mind, so no error banner for it.
      if (err.message !== 'cancelled') {
        setBuyError(err.message || 'Could not complete this purchase. Try again.')
      }
    } finally {
      setBuying(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="h-96 animate-pulse rounded-xl2 bg-cream-dark" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-cream-dark" />
            <div className="h-6 w-1/3 animate-pulse rounded bg-cream-dark" />
            <div className="h-24 animate-pulse rounded bg-cream-dark" />
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !listing) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="font-display text-2xl font-semibold">Listing not found</p>
        <p className="mt-2 text-sm text-ink/60">It may have been removed or sold.</p>
        <Link to="/browse" className="mt-6 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream">
          Back to Browse
        </Link>
      </div>
    )
  }

  const photos = listing.photoUrls ?? []

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div>
          <div className={`flex h-96 items-center justify-center overflow-hidden rounded-xl2 text-8xl ${listing.bg}`}>
            {photos.length > 0 ? (
              <img src={photos[activePhoto]} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <span>{listing.emoji}</span>
            )}
          </div>
          {photos.length > 1 && (
            <div className="mt-3 flex gap-2">
              {photos.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setActivePhoto(i)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
                    i === activePhoto ? 'border-clay' : 'border-transparent'
                  }`}
                >
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {listing.ar && listing.widthCm && listing.heightCm && listing.depthCm && (
            <SpaceFitViewer
              widthCm={listing.widthCm}
              heightCm={listing.heightCm}
              depthCm={listing.depthCm}
              title={listing.title}
            />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            {listing.escrow && (
              <span className="flex items-center gap-1 rounded-full bg-clay/10 px-2.5 py-1 text-xs font-medium text-clay">
                <Lock size={11} /> Escrow protected
              </span>
            )}
            {listing.verified && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <ShieldCheck size={11} /> Verified
              </span>
            )}
            <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-ink/60">
              {listing.status !== 'active' ? listing.status.toUpperCase() : listing.category}
            </span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">{listing.title}</h1>
          <p className="mt-2 font-display text-2xl font-semibold text-clay">
            ₹{listing.price.toLocaleString('en-IN')}
          </p>

          <p className="mt-3 flex items-center gap-1 text-sm text-ink/60">
            <MapPin size={14} /> {listing.location || listing.city || 'Location not set'} · {listing.distanceKm}km away
          </p>
          {!isOwner && (
            <div className="mt-1 flex items-center gap-3">
              <Link to={`/seller/${listing.ownerId}`} className="text-sm text-clay hover:underline">
                View seller profile
              </Link>
              <ReportButton listingId={listing.id} reportedUserId={listing.ownerId} label="Report listing" />
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-ink/50">Condition</p>
              <p className="font-medium text-ink">{listing.condition}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-ink/50">Category</p>
              <p className="font-medium text-ink">
                {listing.category}
                {listing.subCategory ? ` · ${listing.subCategory}` : ''}
              </p>
            </div>
          </div>

          {listing.description && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-ink">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{listing.description}</p>
            </div>
          )}

          {chatError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{chatError}</p>}
          {buyError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{buyError}</p>}

          <div className="mt-8">
            {isOwner ? (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-black/5 p-4 text-sm text-ink/60">
                This is your own listing.
                <Link
                  to={`/listing/${listing.id}/edit`}
                  className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-cream-dark"
                >
                  Edit listing
                </Link>
              </div>
            ) : purchase ? (
              <div className="rounded-xl2 border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <ShieldCheck size={16} /> Funds secured in the Vault
                </p>
                <p className="mt-3 text-xs uppercase tracking-wide text-ink/50">Your handover OTP</p>
                <p className="mt-1 font-display text-3xl font-semibold tracking-widest text-ink">
                  {purchase.handoverOtp}
                </p>
                <p className="mt-2 text-xs text-ink/50">
                  Only share this with the seller in person, after you've inspected the item.
                  Never send it over chat, SMS, or a screenshot.
                </p>
                <Link
                  to="/vault"
                  className="mt-4 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-cream hover:bg-forest-light"
                >
                  Go to Sauda Vault
                </Link>
              </div>
            ) : listing.status !== 'active' ? (
              <div className="rounded-lg bg-black/5 p-4 text-sm text-ink/60">
                This listing is no longer available.
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleChat}
                  disabled={startingChat}
                  className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink hover:bg-cream-dark disabled:opacity-50"
                >
                  <MessageCircle size={16} />
                  {startingChat ? 'Starting chat…' : 'Chat with seller'}
                </button>
                <button
                  onClick={handleBuy}
                  disabled={buying}
                  className="flex items-center gap-2 rounded-full bg-clay px-6 py-3 text-sm font-semibold text-white hover:bg-clay-light disabled:opacity-50"
                >
                  <Lock size={16} />
                  {buying ? 'Locking funds…' : 'Buy with Vault'}
                </button>
              </div>
            )}
          </div>
        </div>

        {recommended.length > 0 && (
          <div className="mt-12">
            <p className="font-display text-xl font-semibold text-ink">You might also need</p>
            <p className="mt-1 text-sm text-ink/50">
              Other active listings that often go with a {listing.category.toLowerCase()} purchase.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
              {recommended.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  saved={savedIds.has(l.id)}
                  onToggleSaved={toggleSaved}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
