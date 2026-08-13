import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Shared by every page under src/pages/legal/ -- keeps typography and the
// last-updated stamp consistent without repeating the wrapper markup six times.
export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-xs uppercase tracking-widest2 text-ink/40 hover:text-ink">
        ← Back to e-Sauda
      </Link>
      <span className="mt-8 block text-xs uppercase tracking-widest2 text-ink/40">(Legal)</span>
      <h1 className="mt-2 font-display text-4xl italic text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink/45">Last updated: {lastUpdated}</p>
      <div className="mt-8 max-w-none border-t border-ink/10 pt-8 text-sm leading-relaxed text-ink/70 [&_h2]:font-display [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:italic [&_h2]:text-ink [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        {children}
      </div>
    </div>
  )
}
