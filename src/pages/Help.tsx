import { useState, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  Search,
  MessageCircle,
  Lock,
  ShieldCheck,
  Upload,
  Heart,
  ShieldAlert,
  Wifi,
  Mail,
} from 'lucide-react'

interface Section {
  icon: ReactNode
  question: string
  answer: ReactNode
}

const sections: Section[] = [
  {
    icon: <Search size={18} />,
    question: 'How do I find something to buy?',
    answer: (
      <>
        <p>
          Use <strong>Browse</strong> (in the navbar) to see every active listing, or type into the
          search bar at the top of any page — it matches titles, descriptions, and categories.
          You can filter by category, price range, and city on the Browse page. <strong>Explore</strong> is
          a shorts-style vertical feed of product videos if you'd rather scroll than search.
        </p>
        <p>
          Open any listing to see its full photos, video, price, condition, and approximate
          location. If you've allowed location access, you'll also see how far away it is.
        </p>
      </>
    ),
  },
  {
    icon: <MessageCircle size={18} />,
    question: 'How do I ask the seller a question first?',
    answer: (
      <p>
        On a listing's page, tap <strong>Chat with seller</strong>. This opens a private message
        thread — all your ongoing chats live under <strong>Messages</strong> in the navbar. From
        inside a chat, a buyer can also propose a different price with the "Make offer" box; the
        seller can accept or decline it, and an accepted offer becomes the real price you pay at
        checkout instead of the original listing price.
      </p>
    ),
  },
  {
    icon: <Lock size={18} />,
    question: 'How does buying actually work? What is the Sauda Vault?',
    answer: (
      <>
        <p>
          Every purchase goes through <strong>escrow</strong>, not straight to the seller. Tap{' '}
          <strong>Buy with Vault</strong> on a listing to pay securely — your money is held safely
          by e-Sauda, not released to the seller yet.
        </p>
        <p>
          After paying, you'll get a 6-digit <strong>handover OTP</strong> on your{' '}
          <strong>Vault</strong> page. Meet the seller, inspect the item in person, and only then
          tell them the code (never share it before you're happy with the item, and never over
          chat/screenshot). The seller enters that code on their own Vault page, which releases
          your payment to them and completes the order.
        </p>
        <p>
          Changed your mind before handover? Either side can cancel a funded order from the Vault
          page. If a delivery rider was already arranged for it, a small logistics fee is deducted
          from the refund.
        </p>
      </>
    ),
  },
  {
    icon: <Upload size={18} />,
    question: 'How do I sell something?',
    answer: (
      <>
        <p>Tap <strong>Sell</strong> in the navbar and follow the four-step wizard:</p>
        <ul>
          <li>Pick a category (each category has a small cap on how many active listings you can have at once).</li>
          <li>Fill in the title, price, condition, description, and your location.</li>
          <li>
            Add up to 6 photos and a <strong>short video</strong> of the item — the video is
            required (photos are optional), since a real clip of the item builds far more buyer
            trust than photos alone. Look for the ✨ <strong>"Suggest description"</strong> button
            once you've added a photo or video — it drafts a starting description for you, which
            you can edit before publishing.
          </li>
          <li>Review everything, then pay a small anti-bot listing fee to publish.</li>
        </ul>
        <p>
          Manage your live listings — edit details, add/remove photos, mark as sold, or take a
          listing down — from <strong>My Listings</strong>.
        </p>
      </>
    ),
  },
  {
    icon: <Heart size={18} />,
    question: 'What does the heart icon do?',
    answer: (
      <p>
        Tapping the heart on any listing adds it to your <strong>Saved</strong> page, so you can
        find it again later without searching for it. Saving something doesn't notify the seller
        or reserve the item.
      </p>
    ),
  },
  {
    icon: <ShieldCheck size={18} />,
    question: 'What keeps this safe from scams?',
    answer: (
      <p>
        Payments are always held in escrow until you've physically inspected the item and shared
        the handover OTP yourself — a seller can never pull the money out early. Chats are
        moderated, and you can <strong>report or block</strong> anyone directly from a listing or
        chat if something feels off. Report buttons are available on every listing and seller
        profile.
      </p>
    ),
  },
  {
    icon: <ShieldAlert size={18} />,
    question: 'Something went wrong — how do I get help?',
    answer: (
      <p>
        Use <strong>Report listing</strong> or <strong>Report user</strong> on the relevant page for
        anything that breaks the rules. For anything else — a payment issue, a stuck order, an
        account problem — reach human support any time at{' '}
        <a href="mailto:edotsauda@gmail.com" className="text-clay hover:underline">
          edotsauda@gmail.com
        </a>{' '}
        or via the <Link to="/contact" className="text-clay hover:underline">Contact us</Link> page.
        Mention your order ID or listing if you have one — it speeds things up. The chat bubble in
        the corner of every page can also answer most questions about your own orders and listings
        right away.
      </p>
    ),
  },
  {
    icon: <Wifi size={18} />,
    question: 'The site feels slow on my connection — can I fix that?',
    answer: (
      <p>
        Yes — turn on <strong>Lite mode</strong> from the link in the footer (or it turns on
        automatically if your browser reports a slow/metered connection). In Lite mode, photos
        stay as plain placeholder boxes you can tap individually to load, and videos won't
        download until you press play — everything else (browsing, chatting, buying, selling)
        keeps working exactly the same.
      </p>
    ),
  },
]

export default function Help() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/" className="text-sm text-ink/50 hover:text-ink">
        ← Back to e-Sauda
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold text-ink">How e-Sauda works</h1>
      <p className="mt-2 text-sm text-ink/60">
        A quick guide to browsing, buying, selling, and staying safe — tap a question to expand it.
      </p>

      <div className="mt-8 space-y-3">
        {sections.map((s, i) => {
          const open = openIndex === i
          return (
            <div key={s.question} className="overflow-hidden rounded-xl2 border border-line/10 bg-surface">
              <button
                onClick={() => setOpenIndex(open ? null : i)}
                className="flex w-full items-center gap-3 p-4 text-left"
                aria-expanded={open}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay/10 text-clay">
                  {s.icon}
                </span>
                <span className="flex-1 text-sm font-semibold text-ink">{s.question}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-ink/40 transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </button>
              {open && (
                <div className="space-y-3 px-4 pb-4 pl-[3.75rem] text-sm leading-relaxed text-ink/70">
                  {s.answer}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-10 flex flex-col items-start gap-3 rounded-xl2 border border-line/10 bg-cream-dark p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink/70">Still stuck on something specific?</p>
        <a
          href="mailto:edotsauda@gmail.com"
          className="flex shrink-0 items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest-light"
        >
          <Mail size={15} /> Email support
        </a>
      </div>
    </div>
  )
}
