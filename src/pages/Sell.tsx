import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categories, currentUser } from '../data/listings'
import { Category } from '../types'
import { Mic, Upload, Check } from 'lucide-react'

const stepNames = ['Category', 'Details', 'Media', 'Review']

export default function Sell() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState<Category | null>(null)
  const [subCategory, setSubCategory] = useState('')
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [condition, setCondition] = useState('Good')
  const [posted, setPosted] = useState(false)

  const nextListingFee = currentUser.activeListings === 0 ? 1 : 10

  function next() {
    setStep((s) => Math.min(s + 1, 3))
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function publish() {
    // NOTE: this is a local, in-memory stand-in for a real "create listing" API call.
    // Wire this up to your backend in the listings/create-listing branch.
    setPosted(true)
  }

  if (posted) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check size={28} />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold">Listing submitted</h1>
        <p className="mt-2 text-sm text-ink/60">
          "{title || 'Your item'}" is queued for the anti-bot fee of ₹{nextListingFee}. Once paid,
          it goes live in {category || 'your category'}.
        </p>
        <button
          onClick={() => navigate('/orders')}
          className="mt-8 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light"
        >
          Go to My listings
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold">Post a listing</h1>
      <p className="mt-1 text-sm text-ink/60">Voice-first flow. Photos auto-cleaned. Fair-price check baked in.</p>

      <div className="mt-6 rounded-xl2 border border-black/5 bg-white p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldIcon /> Listing cap: {currentUser.activeListings} / {currentUser.listingCap}
        </p>
        <p className="mt-1 text-xs text-ink/50">Verify with DigiLocker on your profile to raise the cap.</p>
      </div>

      <div className="mt-8 flex items-center gap-3">
        {stepNames.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i === step ? 'bg-forest text-cream' : i < step ? 'bg-clay text-white' : 'bg-cream-dark text-ink/50'
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'font-semibold text-ink' : 'text-ink/50'}`}>{s}</span>
            {i < stepNames.length - 1 && <span className="h-px w-8 bg-black/10" />}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl2 border border-black/5 bg-white p-6">
        {step === 0 && (
          <div>
            <h2 className="font-semibold text-ink">Choose a category</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {categories.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setCategory(c.name)}
                  className={`flex flex-col items-center gap-2 rounded-xl2 border p-4 ${
                    category === c.name ? 'border-clay bg-clay/5' : 'border-black/10 hover:border-black/20'
                  }`}
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="text-sm font-medium">{c.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-5">
              <label className="text-sm font-medium text-ink">Sub-category</label>
              <input
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                placeholder="e.g. Motorbikes, Keyboards"
                className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="mt-5 rounded-lg bg-clay/10 p-3 text-xs text-clay">
              Anti-bot fee for your next listing in <strong>this category</strong>: ₹{nextListingFee}.
              Rises as you post more in the same sub-category — bulk resellers pay ₹500/listing.
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">Tell us about the item</h2>
              <button className="flex items-center gap-2 rounded-full bg-clay/10 px-3 py-1.5 text-xs font-semibold text-clay">
                <Mic size={13} /> Speak instead
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-ink">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Keychron Q1 Pro · Wireless Mechanical"
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-ink">Price (₹)</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="12500"
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm"
                />
                <p className="mt-1 text-xs text-ink/50">
                  Smart pricing suggests a fair range once you add photos in the next step.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-ink">Condition</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm"
                >
                  <option>New</option>
                  <option>Like new</option>
                  <option>Good</option>
                  <option>Fair</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-ink">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Any dents, accessories included, reason for selling..."
                  className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-semibold text-ink">Add photos</h2>
            <p className="mt-1 text-sm text-ink/60">
              We'll clean the background and flag stock/watermarked images automatically.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl2 border-2 border-dashed border-black/15 text-ink/40 hover:border-clay/40">
                <Upload size={20} />
                <span className="text-xs">Upload</span>
                <input type="file" className="hidden" accept="image/*" multiple />
              </label>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex aspect-square items-center justify-center rounded-xl2 bg-cream-dark text-ink/20">
                  <span className="text-xs">Empty</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-semibold text-ink">Review your listing</h2>
            <div className="mt-4 space-y-2 text-sm">
              <Row label="Category" value={category ? `${category}${subCategory ? ' · ' + subCategory : ''}` : '—'} />
              <Row label="Title" value={title || '—'} />
              <Row label="Price" value={price ? `₹${price}` : '—'} />
              <Row label="Condition" value={condition} />
              <Row label="Description" value={description || '—'} />
              <Row label="Anti-bot fee due now" value={`₹${nextListingFee}`} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          onClick={back}
          disabled={step === 0}
          className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-30"
        >
          Back
        </button>
        {step < 3 ? (
          <button
            onClick={next}
            disabled={step === 0 && !category}
            className="rounded-full bg-forest px-6 py-2.5 text-sm font-semibold text-cream disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            onClick={publish}
            className="rounded-full bg-clay px-6 py-2.5 text-sm font-semibold text-white hover:bg-clay-light"
          >
            Pay ₹{nextListingFee} &amp; publish
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-black/5 py-2">
      <span className="text-ink/50">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-ink">{value}</span>
    </div>
  )
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3Z" />
    </svg>
  )
}
