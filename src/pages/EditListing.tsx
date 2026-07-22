import { useEffect, useState, FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { X, Upload, Video } from 'lucide-react'
import { fetchListingById, updateListing, updateListingPhotos, updateListingVideo } from '../lib/listings'
import {
  uploadListingPhotos,
  deleteListingPhotoByUrl,
  validatePhotoFiles,
  MAX_PHOTOS,
  uploadListingVideo,
  deleteListingVideo,
  validateVideoFile,
  validateVideoDuration,
} from '../lib/storage'
import { useAuth } from '../context/AuthContext'
import { Listing } from '../types'

// Deliberately a standalone lightweight form rather than reusing the Sell wizard --
// Sell's multi-step voice-first flow (with the listing-cap/fee-tier logic baked into
// its category step) is built for *creating* a listing, not fixing a typo in one that
// already exists. Category is intentionally not editable here; see the comment on
// ListingUpdateInput in lib/listings.ts for why.
export default function EditListing() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [condition, setCondition] = useState('Good')
  const [description, setDescription] = useState('')
  const [city, setCity] = useState('')
  const [widthCm, setWidthCm] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [depthCm, setDepthCm] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [photos, setPhotos] = useState<string[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [removingUrl, setRemovingUrl] = useState<string | null>(null)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [savingVideo, setSavingVideo] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchListingById(id)
      .then((data) => {
        if (!data) {
          setNotFound(true)
          return
        }
        if (user && data.ownerId !== user.id) {
          setForbidden(true)
          return
        }
        setListing(data)
        setTitle(data.title)
        setPrice(String(data.price))
        setCondition(data.condition)
        setDescription(data.description || '')
        setCity(data.city || '')
        setWidthCm(data.widthCm != null ? String(data.widthCm) : '')
        setHeightCm(data.heightCm != null ? String(data.heightCm) : '')
        setDepthCm(data.depthCm != null ? String(data.depthCm) : '')
        setPhotos(data.photoUrls || [])
        setVideoUrl(data.videoUrl)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, user])

  // Photo changes save immediately (unlike title/price/etc, which wait for the form's
  // Save button) — matches how removing a photo or picking a file feels everywhere
  // else in the app: an action, not a draft edit.
  async function handleRemovePhoto(url: string) {
    if (!id) return
    setPhotoError(null)
    setRemovingUrl(url)
    const next = photos.filter((p) => p !== url)
    try {
      await updateListingPhotos(id, next)
      await deleteListingPhotoByUrl(url)
      setPhotos(next)
    } catch (err: any) {
      setPhotoError(err.message || 'Could not remove that photo.')
    } finally {
      setRemovingUrl(null)
    }
  }

  async function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    if (!id || !user) return
    const files = Array.from(e.target.files || [])
    e.target.value = '' // lets picking the same file again re-trigger onChange
    if (files.length === 0) return

    setPhotoError(null)
    if (photos.length + files.length > MAX_PHOTOS) {
      setPhotoError(`You can have up to ${MAX_PHOTOS} photos total (${photos.length} already there).`)
      return
    }
    const fileValidationError = validatePhotoFiles(files)
    if (fileValidationError) {
      setPhotoError(fileValidationError)
      return
    }

    setUploadingPhotos(true)
    try {
      const newUrls = await uploadListingPhotos(user.id, id, files, photos.length)
      const next = [...photos, ...newUrls]
      await updateListingPhotos(id, next)
      setPhotos(next)
    } catch (err: any) {
      setPhotoError(err.message || 'Could not upload those photos.')
    } finally {
      setUploadingPhotos(false)
    }
  }

  async function handleReplaceVideo(e: React.ChangeEvent<HTMLInputElement>) {
    if (!id || !user) return
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setVideoError(null)
    const sizeError = validateVideoFile(file)
    if (sizeError) {
      setVideoError(sizeError)
      return
    }
    const durationError = await validateVideoDuration(file)
    if (durationError) {
      setVideoError(durationError)
      return
    }

    setSavingVideo(true)
    try {
      // Old file, if any, is left in storage rather than deleted-then-replaced --
      // uploadListingVideo uses upsert on the same path (derived from the filename),
      // which usually overwrites it anyway; any orphaned older file is harmless
      // clutter, not a correctness issue, and not worth a second network round trip
      // to clean up on every replace.
      const url = await uploadListingVideo(user.id, id, file)
      await updateListingVideo(id, url)
      setVideoUrl(url)
    } catch (err: any) {
      setVideoError(err.message || 'Could not upload that video.')
    } finally {
      setSavingVideo(false)
    }
  }

  async function handleRemoveVideo() {
    if (!id || !user) return
    setVideoError(null)
    setSavingVideo(true)
    try {
      await updateListingVideo(id, null)
      await deleteListingVideo(user.id, id)
      setVideoUrl(null)
    } catch (err: any) {
      setVideoError(err.message || 'Could not remove the video.')
    } finally {
      setSavingVideo(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setError(null)

    const parsedPrice = Number(price)
    if (!title.trim()) {
      setError('Title cannot be empty.')
      return
    }
    if (!price || parsedPrice < 0 || Number.isNaN(parsedPrice)) {
      setError('Enter a valid price.')
      return
    }

    setSaving(true)
    try {
      await updateListing(id, {
        title: title.trim(),
        price: parsedPrice,
        condition,
        description: description.trim(),
        city: city.trim(),
        location: city.trim(),
        widthCm: widthCm && heightCm && depthCm ? Number(widthCm) : null,
        heightCm: widthCm && heightCm && depthCm ? Number(heightCm) : null,
        depthCm: widthCm && heightCm && depthCm ? Number(depthCm) : null,
      })
      setSaved(true)
      setTimeout(() => navigate(`/listing/${id}`), 900)
    } catch (err: any) {
      setError(err.message || 'Could not save changes. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20">
        <div className="h-8 w-1/2 animate-pulse rounded bg-cream-dark" />
        <div className="mt-6 h-64 animate-pulse rounded-xl2 bg-cream-dark" />
      </div>
    )
  }

  if (notFound) {
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

  if (forbidden) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="font-display text-2xl font-semibold">Not your listing</p>
        <p className="mt-2 text-sm text-ink/60">You can only edit listings you own.</p>
        <Link to="/browse" className="mt-6 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream">
          Back to Browse
        </Link>
      </div>
    )
  }

  if (!listing) return null

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Link to={`/listing/${listing.id}`} className="text-sm text-ink/50 hover:text-ink">
        ← Back to listing
      </Link>
      <h1 className="mt-2 font-display text-3xl font-semibold">Edit listing</h1>
      <p className="mt-1 text-sm text-ink/60">
        Category ({listing.category}
        {listing.subCategory ? ` · ${listing.subCategory}` : ''}) can't be changed here — post a
        new listing if it belongs elsewhere.
      </p>

      <div className="mt-8">
        <label className="text-sm font-medium text-ink">Photos</label>
        <p className="mt-1 text-xs text-ink/50">
          Changes here save immediately — no need to hit Save changes below.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-xl2 bg-cream-dark">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemovePhoto(url)}
                disabled={removingUrl === url}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-50"
                aria-label="Remove photo"
              >
                <X size={13} />
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl2 border-2 border-dashed border-black/15 text-ink/40 hover:border-clay/40">
              <Upload size={18} />
              <span className="text-xs">{uploadingPhotos ? 'Uploading…' : 'Add'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploadingPhotos}
                onChange={handleAddPhotos}
              />
            </label>
          )}
        </div>

        {photoError && <p className="mt-2 text-xs text-red-600">{photoError}</p>}
      </div>

      <div className="mt-8">
        <label className="text-sm font-medium text-ink">Video</label>
        <p className="mt-1 text-xs text-ink/50">
          Changes here save immediately — no need to hit Save changes below.
        </p>

        {videoUrl ? (
          <div className="group relative mt-3 aspect-video w-full max-w-sm overflow-hidden rounded-xl2 bg-black">
            <video src={videoUrl} controls className="h-full w-full" />
            <button
              type="button"
              onClick={handleRemoveVideo}
              disabled={savingVideo}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-50"
              aria-label="Remove video"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="mt-3 flex aspect-video w-full max-w-sm cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl2 border-2 border-dashed border-black/15 text-ink/40 hover:border-clay/40">
            <Video size={20} />
            <span className="text-xs">{savingVideo ? 'Uploading…' : 'Add a video'}</span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              disabled={savingVideo}
              onChange={handleReplaceVideo}
            />
          </label>
        )}
        {videoError && <p className="mt-2 text-xs text-red-600">{videoError}</p>}
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm font-medium text-ink">Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-ink">Price (₹)</label>
          <input
            required
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm"
          />
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
          <label className="text-sm font-medium text-ink">City</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-2 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm"
          />
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

        <div>
          <label className="text-sm font-medium text-ink">Dimensions (optional)</label>
          <p className="mt-1 text-xs text-ink/50">
            Add all three to let buyers preview it in their own space in 3D/AR.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
              placeholder="Width cm"
              className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm"
            />
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="Height cm"
              className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm"
            />
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={depthCm}
              onChange={(e) => setDepthCm(e.target.value)}
              placeholder="Depth cm"
              className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        {saved && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Saved. Taking you back…</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
