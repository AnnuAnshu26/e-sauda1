import { useEffect, useState } from 'react'
import { MapPin, Calendar, Car, Check, X, Navigation } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchMeetup, proposeMeetup, confirmMeetup, cancelMeetup, Meetup } from '../lib/meetups'
import { getCurrentLocation, buildUberRideLink, getRapidoLink } from '../lib/rideLinks'

function formatMeetupTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function MeetupPlanner({
  vaultOrderId,
  otherPartyLabel,
}: {
  vaultOrderId: string
  otherPartyLabel: string
}) {
  const { user } = useAuth()
  const [meetup, setMeetup] = useState<Meetup | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gettingRide, setGettingRide] = useState(false)

  useEffect(() => {
    fetchMeetup(vaultOrderId)
      .then(setMeetup)
      .catch(() => setMeetup(null))
      .finally(() => setLoading(false))
  }, [vaultOrderId])

  function startEditing() {
    if (meetup) {
      // Pre-fill with the existing proposal so a "propose a different time" edit
      // starts from what's already there instead of a blank form.
      setDateInput(meetup.meetupAt.slice(0, 16))
      setLocationInput(meetup.locationName)
      setCoords(
        meetup.locationLat != null && meetup.locationLng != null
          ? { lat: meetup.locationLat, lng: meetup.locationLng }
          : null,
      )
    }
    setError(null)
    setEditing(true)
  }

  async function handleUseCurrentLocation() {
    setLocating(true)
    setError(null)
    try {
      setCoords(await getCurrentLocation())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLocating(false)
    }
  }

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !dateInput || !locationInput.trim()) return
    setSaving(true)
    setError(null)
    try {
      const result = await proposeMeetup({
        vaultOrderId,
        proposedBy: user.id,
        meetupAt: new Date(dateInput).toISOString(),
        locationName: locationInput.trim(),
        locationLat: coords?.lat,
        locationLng: coords?.lng,
      })
      setMeetup(result)
      setEditing(false)
    } catch (err: any) {
      setError(err.message || 'Could not save this meetup.')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      setMeetup(await confirmMeetup(vaultOrderId))
    } catch (err: any) {
      setError(err.message || 'Could not confirm.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    setSaving(true)
    setError(null)
    try {
      setMeetup(await cancelMeetup(vaultOrderId))
    } catch (err: any) {
      setError(err.message || 'Could not cancel.')
    } finally {
      setSaving(false)
    }
  }

  async function handleGetUberRide(dropoffLat: number, dropoffLng: number, label: string) {
    setGettingRide(true)
    setError(null)
    try {
      const pickup = await getCurrentLocation()
      window.open(buildUberRideLink(pickup, { lat: dropoffLat, lng: dropoffLng }, label), '_blank')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGettingRide(false)
    }
  }

  if (loading) return null

  const isProposer = meetup?.proposedBy === user?.id

  return (
    <div className="mt-4 border-t border-ink/10 pt-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/50">
        <Calendar size={12} /> Meetup
      </p>

      {editing ? (
        <form onSubmit={handlePropose} className="mt-2 space-y-2">
          <input
            type="datetime-local"
            required
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-xs"
          />
          <input
            required
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            placeholder="Where? e.g. Cafe Coffee Day, Sector 18 metro gate"
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-xs"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="flex items-center gap-1 rounded-full border border-ink/10 bg-cream px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-cream-dark disabled:opacity-50"
            >
              <Navigation size={11} /> {locating ? 'Locating…' : coords ? 'Location attached ✓' : 'Attach my current location'}
            </button>
          </div>
          {!coords && (
            <p className="text-[11px] text-ink/40">
              Optional -- without this, "Get a ride there" won't be available, but the meetup itself still works fine with just a description.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-forest px-4 py-1.5 text-xs font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Propose'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-ink/10 px-4 py-1.5 text-xs font-semibold text-ink/60"
            >
              Never mind
            </button>
          </div>
        </form>
      ) : !meetup || meetup.status === 'cancelled' ? (
        <div className="mt-2">
          {meetup?.status === 'cancelled' && (
            <p className="text-xs text-ink/50">The last planned meetup was cancelled.</p>
          )}
          <button
            onClick={startEditing}
            className="mt-2 flex items-center gap-1.5 rounded-full border border-ink/10 bg-cream px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-dark"
          >
            <MapPin size={12} /> Propose a time &amp; place to meet
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm font-medium text-ink">{formatMeetupTime(meetup.meetupAt)}</p>
          <p className="text-xs text-ink/60">{meetup.locationName}</p>
          <p className="mt-1 text-[11px] text-ink/40">
            {meetup.status === 'confirmed'
              ? 'Confirmed by both of you'
              : isProposer
                ? `Waiting for ${otherPartyLabel} to confirm`
                : `Proposed by ${otherPartyLabel}`}
          </p>

          {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {meetup.status === 'proposed' && !isProposer && (
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
              >
                <Check size={12} /> Confirm
              </button>
            )}
            <button
              onClick={startEditing}
              className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-cream-dark"
            >
              Propose different time
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              <X size={12} /> Cancel
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {meetup.locationLat != null && meetup.locationLng != null ? (
              <button
                onClick={() => handleGetUberRide(meetup.locationLat!, meetup.locationLng!, meetup.locationName)}
                disabled={gettingRide}
                className="flex items-center gap-1.5 rounded-full border border-ink/10 bg-cream px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-dark disabled:opacity-50"
              >
                <Car size={12} /> {gettingRide ? 'Getting your location…' : 'Get an Uber there'}
              </button>
            ) : (
              <p className="text-[11px] text-ink/40">
                Attach a location to the meetup to enable one-tap ride booking.
              </p>
            )}
            <a
              href={getRapidoLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-ink/10 bg-cream px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-dark"
            >
              <Car size={12} /> Open Rapido
            </a>
          </div>
          <p className="mt-1 text-[10px] text-ink/35">
            Uber opens with your route pre-filled. Rapido doesn't currently support that, so it just opens the app/site.
          </p>
        </div>
      )}
    </div>
  )
}
