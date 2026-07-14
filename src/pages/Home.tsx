import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Lock,
  ShieldCheck,
  Truck,
  Camera,
  Sparkles,
  Mic,
} from "lucide-react";
import { categories } from "../data/listings";
import { fetchListings } from "../lib/listings";
import { useSavedListings } from "../hooks/useSavedListings";
import { Listing } from "../types";
import ListingCard from "../components/ListingCard";

const steps = [
  {
    n: "01",
    title: "Lock the price",
    desc: "Chat in-app. Agree on a number. No phone numbers leaked.",
  },
  {
    n: "02",
    title: "Fund the vault",
    desc: "Buyer pays via UPI/card. Money is held — not released.",
  },
  {
    n: "03",
    title: "Meet or ship",
    desc: "Rider assigned. Dashboard shows 'FUNDS SECURED' in green.",
  },
  {
    n: "04",
    title: "OTP handover",
    desc: "Buyer inspects, shares OTP. Vault opens. Seller paid instantly.",
  },
];

const features = [
  {
    icon: Lock,
    title: "Vaulted escrow, always",
    desc: "Buyer's money sits in a digital vault. Handover OTP unlocks only when 'FUNDS SECURED' shows on your dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Progressive trust limits",
    desc: "New users list 1–2 items. Great ratings unlock more. Bulk resellers stay filtered out — by design.",
  },
  {
    icon: Truck,
    title: "One-tap city delivery",
    desc: "Rapido, Uber & Dunzo baked into checkout. Price, ETA and rider — all locked in one tap.",
  },
  {
    icon: Camera,
    title: "AR try-on & 360° spins",
    desc: "See if the sofa fits before you buy. Orbit around a bike on your phone. No more grainy photos.",
  },
  {
    icon: Sparkles,
    title: "AI-cleaned photos",
    desc: "Snap it messy. We segment the background, block stock-photo scams and suggest a fair price.",
  },
  {
    icon: Mic,
    title: "Bolo, aur bech do",
    desc: "Speak in Hindi, Tamil, Bangla — our voice engine fills the form. Listing done in 20 seconds.",
  },
];

export default function Home() {
  const { savedIds, toggleSaved } = useSavedListings();
  const [fresh, setFresh] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchListings()
      .then((data) => {
        if (!cancelled) setFresh(data.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setFresh([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-16">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-clay/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-clay">
              ✦ Made for honest neighbourhood sauda
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] text-ink sm:text-6xl">
              Buy it, sell it —{" "}
              <span className="italic text-clay">without the drama.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-ink/70">
              India's first marketplace where money sits in escrow, sellers are
              verified, and a rider shows up when you're ready. No brokers. No
              "OTP bhejo" scams. Just clean deals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/browse"
                className="flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light"
              >
                Explore listings <ArrowRight size={16} />
              </Link>
              <Link
                to="/sell"
                className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink hover:bg-cream-dark"
              >
                List your first item · ₹1
              </Link>
            </div>
            <div className="mt-10 flex gap-10">
              <div>
                <p className="font-display text-2xl font-semibold text-ink">
                  ₹42 Cr
                </p>
                <p className="text-xs uppercase tracking-wide text-ink/50">
                  Vaulted last month
                </p>
              </div>
              <div>
                <p className="font-display text-2xl font-semibold text-ink">
                  2.1 M
                </p>
                <p className="text-xs uppercase tracking-wide text-ink/50">
                  Verified sellers
                </p>
              </div>
              <div>
                <p className="font-display text-2xl font-semibold text-ink">
                  4.8★
                </p>
                <p className="text-xs uppercase tracking-wide text-ink/50">
                  Buyer rating
                </p>
              </div>
            </div>
          </div>

          <div className="relative rounded-xl2 bg-gradient-to-br from-amber-100 to-orange-50 p-10">
            <span className="absolute right-6 top-6 flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow">
              <ShieldCheck size={14} className="text-clay" /> DigiLocker
              verified
            </span>
            <div className="flex h-64 items-center justify-center text-6xl">
              🛵 🪑 ❄️ ⌨️
            </div>
            <div className="absolute bottom-6 left-6 right-6 rounded-xl2 bg-white p-4 shadow-lg">
              <p className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> FUNDS
                SECURED
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                Enfield handover in 32 min
              </p>
              <p className="text-xs text-ink/50">
                Rapido rider assigned · ETA 6 min
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">
            Shop by category
          </h2>
          <Link
            to="/browse"
            className="text-sm font-semibold text-clay hover:underline"
          >
            See all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((c) => (
            <Link
              key={c.name}
              to={`/browse?category=${c.name}`}
              className="flex flex-col items-center gap-2 rounded-xl2 border border-black/5 bg-cream-dark/60 px-4 py-6 text-center hover:border-clay/40"
            >
              <span className="text-3xl">{c.emoji}</span>
              <span className="text-sm font-semibold text-ink">{c.name}</span>
              <span className="text-xs text-ink/50">
                {(c.count / 1000).toFixed(0)}k live
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-forest py-4 text-cream">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-6 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Lock size={14} /> Escrow-vaulted payments
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck size={14} /> DigiLocker-verified IDs
          </span>
          <span className="flex items-center gap-2">
            <Truck size={14} /> Rapido · Uber · Dunzo delivery
          </span>
          <span className="flex items-center gap-2">
            ★ Two-way accountability score
          </span>
        </div>
      </section>

      {/* Fresh listings */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">
              Fresh in your city
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              Real people, real items. Every listing gated by our anti-bot fee.
            </p>
          </div>
          <Link
            to="/browse"
            className="text-sm font-semibold text-clay hover:underline"
          >
            Browse all →
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-xl2 bg-cream-dark"
              />
            ))}
          </div>
        ) : fresh.length > 0 ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {fresh.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                saved={savedIds.has(l.id)}
                onToggleSaved={toggleSaved}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl2 border border-dashed border-black/15 py-14 text-center">
            <p className="font-medium text-ink">
              No listings yet — be the first.
            </p>
            <Link
              to="/sell"
              className="mt-3 inline-block text-sm font-semibold text-clay hover:underline"
            >
              Post the first listing →
            </Link>
          </div>
        )}
      </section>

      {/* Vault pitch */}
      <section className="bg-cream-dark py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-clay">
            🔒 The Sauda Vault
          </span>
          <h2 className="mt-6 font-display text-4xl font-semibold">
            No screenshot scams. <span className="italic text-clay">Ever.</span>
          </h2>
          <p className="mt-4 text-ink/70">
            Every rupee sits in a regulated escrow ledger until the buyer
            physically inspects the item. Seller sees a giant green banner — not
            a WhatsApp screenshot — before handing anything over.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl2 bg-white p-6">
              <p className="font-display text-2xl font-semibold text-clay">
                {s.n}
              </p>
              <p className="mt-2 font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-sm text-ink/60">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Built like OLX <span className="italic text-clay">wishes</span> it
            were built.
          </h2>
          <p className="text-ink/70">
            Every feature exists to fix one specific way older classifieds
            break. Look around.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl2 border border-black/5 bg-white p-6"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-clay/10 text-clay">
                <f.icon size={18} />
              </span>
              <p className="mt-4 font-semibold text-ink">{f.title}</p>
              <p className="mt-1 text-sm text-ink/60">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-xl2 bg-gradient-to-br from-forest to-forest-light px-10 py-14 text-cream">
          <p className="font-display text-4xl font-semibold">
            Your first listing costs ₹1.
          </p>
          <p className="font-display text-4xl font-semibold italic text-clay-light">
            Your last scam happened yesterday.
          </p>
          <p className="mt-4 max-w-xl text-cream/80">
            Join the marketplace built by neighbours, for neighbours. Fair fees,
            real people, and money that only moves when you're ready.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/sell"
              className="flex items-center gap-2 rounded-full bg-clay px-6 py-3 text-sm font-semibold text-white hover:bg-clay-light"
            >
              Start selling <ArrowRight size={16} />
            </Link>
            <Link
              to="/browse"
              className="rounded-full border border-cream/30 px-6 py-3 text-sm font-semibold text-cream hover:bg-white/10"
            >
              Browse the marketplace
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
