import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { QrCode } from 'lucide-react'

interface ArQrCodeProps {
  url: string
}

// AR itself is camera-based (WebXR on Android Chrome, Quick Look on iOS Safari), so
// the "View in AR" button can only ever actually work ON a phone — someone browsing
// this listing on a laptop has no way to trigger it at all otherwise. Scanning this
// QR code opens the same listing on their phone, where the button becomes tappable.
// Generated entirely client-side via the `qrcode` package: no API, no account, no
// daily quota, nothing that can fail due to a rate limit.
export default function ArQrCode({ url }: ArQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || dataUrl) return
    let cancelled = false
    QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: '#2b1d14', light: '#f5f0e8' } })
      .then((result) => {
        if (!cancelled) setDataUrl(result)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, url, dataUrl])

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-clay hover:underline"
      >
        <QrCode size={14} />
        {open ? 'Hide QR code' : 'On a computer? Scan to try AR on your phone'}
      </button>

      {open && (
        <div className="mt-2 inline-flex flex-col items-center rounded-xl2 border border-black/10 bg-white p-3">
          {error ? (
            <p className="w-40 text-center text-xs text-red-600">Couldn't generate the QR code.</p>
          ) : dataUrl ? (
            <img src={dataUrl} alt="QR code linking to this listing" width={160} height={160} />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center text-xs text-ink/40">
              Generating…
            </div>
          )}
          <p className="mt-2 max-w-[160px] text-center text-[11px] text-ink/50">
            Scan with your phone's camera to open this listing there and try AR.
          </p>
        </div>
      )}
    </div>
  )
}
