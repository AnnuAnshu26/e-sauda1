import { Heart, Lock, Camera, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Listing } from '../types'

export default function ListingCard({ listing }: { listing: Listing }) {
  const [saved, setSaved] = useState(false)

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group block overflow-hidden rounded-xl2 border border-black/5 bg-white transition hover:shadow-lg"
    >
      <div className={`relative flex h-40 items-center justify-center text-5xl ${listing.bg}`}>
        {listing.photoUrls?.length > 0 && (
          <img
            src={listing.photoUrls[0]}
            alt={listing.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {listing.escrow && (
            <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-ink">
              <Lock size={11} /> Escrow
            </span>
          )}
          {listing.ar && (
            <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-ink">
              <Camera size={11} /> AR
            </span>
          )}
          {listing.spin360 && (
            <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-ink">
              <RotateCw size={11} /> 360°
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setSaved((v) => !v)
          }}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90"
          aria-label="Save listing"
        >
          <Heart size={14} className={saved ? 'fill-clay text-clay' : 'text-ink/70'} />
        </button>
        {!(listing.photoUrls?.length > 0) && <span>{listing.emoji}</span>}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-ink">
            ₹{listing.price.toLocaleString('en-IN')}
          </p>
          {listing.verified && (
            <span className="text-xs font-medium text-clay">✓ Verified</span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-ink/80">{listing.title}</p>
        <p className="mt-1 text-xs text-ink/50">
          {listing.location} · {listing.distanceKm}km
        </p>
      </div>
    </Link>
  )
}
