import { Heart, Lock, BadgeCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Listing } from '../types'

interface ListingCardProps {
  listing: Listing
  // Both optional: pages that use useSavedListings() pass these to persist saves;
  // if omitted, the heart still works but only for the current render (local-only).
  saved?: boolean
  onToggleSaved?: (listingId: string) => void
}

export default function ListingCard({ listing, saved: savedProp, onToggleSaved }: ListingCardProps) {
  const [localSaved, setLocalSaved] = useState(false)
  const controlled = onToggleSaved !== undefined
  const saved = controlled ? !!savedProp : localSaved

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group block overflow-hidden rounded-xl2 border border-ink/10 bg-cream transition hover:border-ink/25"
    >
      <div className={`relative flex h-40 items-center justify-center ${listing.bg}`}>
        {listing.photoUrls?.length > 0 && (
          <img
            src={listing.photoUrls[0]}
            alt={listing.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {listing.escrow && (
            <span className="flex items-center gap-1 rounded-full bg-cream/95 px-2 py-1 text-[11px] font-medium text-ink">
              <Lock size={11} /> Escrow
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            controlled ? onToggleSaved!(listing.id) : setLocalSaved((v) => !v)
          }}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cream/95"
          aria-label={saved ? 'Remove from saved' : 'Save listing'}
        >
          <Heart size={14} className={saved ? 'fill-clay text-clay' : 'text-ink/70'} />
        </button>
        {!(listing.photoUrls?.length > 0) && (
          <span className="font-display text-3xl italic text-ink/25">{listing.emoji}</span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-xl italic text-ink">
            ₹{listing.price.toLocaleString('en-IN')}
          </p>
          {listing.verified && (
            <span className="flex items-center gap-1 text-xs font-medium text-clay">
              <BadgeCheck size={13} /> Verified
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-ink/70">{listing.title}</p>
        <p className="mt-1 text-xs text-ink/45">
          {listing.location} · {listing.distanceKm}km
        </p>
      </div>
    </Link>
  )
}