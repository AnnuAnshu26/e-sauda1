import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Lock,
  ShieldCheck,
  Truck,
  Sparkles,
  Bike,
  Armchair,
  Snowflake,
  Keyboard,
} from "lucide-react";
import { categories } from "../data/listings";
import { fetchListings } from "../lib/listings";
import { useSavedListings } from "../hooks/useSavedListings";
import { Listing } from "../types";
import ListingCard from "../components/ListingCard";
import Reveal from "../components/Reveal";

const steps = [
  { n: "01", title: "Lock the price", desc: "Chat in-app. Agree on a number. No phone numbers leaked." },
  { n: "02", title: "Fund the vault", desc: "Buyer pays via UPI/card. Money is held — not released." },
  { n: "03", title: "Meet or ship", desc: "Rider assigned. Dashboard shows 'FUNDS SECURED' in green." },
  { n: "04", title: "OTP handover", desc: "Buyer inspects, shares OTP. Vault opens. Seller paid instantly." },
];

const features = [
  { icon: Lock, title: "Vaulted escrow, always", desc: "Buyer's money sits in a digital vault. Handover OTP unlocks only when 'FUNDS SECURED' shows on your dashboard." },
  { icon: ShieldCheck, title: "Progressive trust limits", desc: "New users list 1–2 items. Great ratings unlock more. Bulk resellers stay filtered out — by design." },
  { icon: Truck, title: "One-tap city delivery", desc: "Rapido, Uber & Dunzo baked into checkout. Price, ETA and rider — all locked in one tap." },
  { icon: Sparkles, title: "AI-cleaned photos", desc: "Snap it messy. We segment the background, block stock-photo scams and suggest a fair price." },
];

const heroIcons = [Bike, Armchair, Snowflake, Keyboard];

export default function Home() {
  const { savedIds, toggleSaved } = useSavedListings();
  const [fresh, setFresh] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchListings()
      .then((data) => { if (!cancelled) setFresh(data.slice(0, 8)); })
      .catch(() => { if (!cancelled) setFresh([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      {/* Hero — orchestrated page-load sequence, staggered by hand */}
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-20">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="eyebrow"
        >
          (Made for honest neighbourhood sauda)
        </motion.p>

        <div className="mt-6 grid grid-cols-1 items-end gap-12 lg:grid-cols-2">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="hero-heading text-6xl sm:text-7xl"
          >
            Buy it,<br />
            <span className="not-italic">sell it</span> —<br />
            <span className="text-clay">without the drama.</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="max-w-lg text-base text-ink/60">
              India's first marketplace where money sits in escrow, sellers are
              verified, and a rider shows up when you're ready. No brokers. No
              "OTP bhejo" scams. Just clean deals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/browse"
                className="group flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream transition-transform duration-200 hover:-translate-y-0.5 hover:bg-forest-light"
              >
                Explore listings
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/sell"
                className="rounded-full border border-line/15 px-6 py-3 text-sm font-semibold text-ink transition-colors duration-200 hover:border-line/30 hover:bg-surface"
              >
                List your first item · ₹1
              </Link>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl2 border border-line/10 bg-line/10 sm:grid-cols-3"
        >
          {[
            ["₹42 Cr", "Vaulted last month"],
            ["2.1 M", "Verified sellers"],
            ["4.8★", "Buyer rating"],
          ].map(([n, l]) => (
            <div key={l} className="bg-surface px-8 py-8 transition-colors duration-200 hover:bg-cream-dark">
              <p className="font-display text-4xl italic text-ink">{n}</p>
              <p className="mt-2 eyebrow">{l}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-6 overflow-hidden rounded-xl2 border border-line/10 bg-gradient-to-br from-surface to-cream-dark p-10"
        >
          <span className="absolute right-6 top-6 flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-ink shadow-sm">
            <ShieldCheck size={14} className="text-clay" /> DigiLocker verified
          </span>
          <div className="flex h-64 items-center justify-center gap-8">
            {heroIcons.map((Icon, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cream text-ink/70 shadow-sm"
              >
                <Icon size={26} strokeWidth={1.5} />
              </motion.span>
            ))}
          </div>
          <div className="absolute bottom-6 left-6 right-6 rounded-xl2 border border-line/10 bg-cream p-4 shadow-lg">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> FUNDS SECURED
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">Enfield handover in 32 min</p>
            <p className="text-xs text-ink/50">Rapido rider assigned · ETA 6 min</p>
          </div>
        </motion.div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <Reveal className="mb-8 flex items-end justify-between">
          <div>
            <p className="eyebrow">(Categories)</p>
            <h2 className="mt-2 font-display text-3xl italic text-ink">Shop by category</h2>
          </div>
          <Link to="/browse" className="text-sm font-semibold text-clay hover:underline">See all →</Link>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((c, i) => (
            <Reveal key={c.name} delay={Math.min(i * 0.04, 0.24)}>
              <Link
                to={`/browse?category=${c.name}`}
                className="flex flex-col items-center gap-2 rounded-xl2 border border-line/10 bg-surface px-4 py-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-clay/40 hover:shadow-md"
              >
                <span className="text-3xl">{c.emoji}</span>
                <span className="text-sm font-semibold text-ink">{c.name}</span>
                <span className="text-xs text-ink/40">{(c.count / 1000).toFixed(0)}k live</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-line/10 bg-cream-dark py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-6 eyebrow !text-ink/70">
          <span className="flex items-center gap-2"><Lock size={14} /> Escrow-vaulted payments</span>
          <span className="flex items-center gap-2"><ShieldCheck size={14} /> DigiLocker-verified IDs</span>
          <span className="flex items-center gap-2"><Truck size={14} /> Rapido · Uber · Dunzo delivery</span>
          <span className="flex items-center gap-2"><Sparkles size={14} /> Two-way accountability score</span>
        </div>
      </section>

      {/* Fresh listings */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <Reveal className="mb-8 flex items-end justify-between">
          <div>
            <p className="eyebrow">(Fresh in your city)</p>
            <h2 className="mt-2 font-display text-3xl italic text-ink">Real people, real items</h2>
            <p className="mt-1 text-sm text-ink/50">Every listing gated by our anti-bot fee.</p>
          </div>
          <Link to="/browse" className="text-sm font-semibold text-clay hover:underline">Browse all →</Link>
        </Reveal>
        {loading ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl2 bg-surface" />
            ))}
          </div>
        ) : fresh.length > 0 ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {fresh.map((l, i) => (
              <Reveal key={l.id} delay={Math.min(i * 0.05, 0.3)}>
                <ListingCard listing={l} saved={savedIds.has(l.id)} onToggleSaved={toggleSaved} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-xl2 border border-dashed border-line/15 py-14 text-center">
            <p className="font-medium text-ink">No listings yet — be the first.</p>
            <Link to="/sell" className="mt-3 inline-block text-sm font-semibold text-clay hover:underline">Post the first listing →</Link>
          </div>
        )}
      </section>

      {/* Vault pitch */}
      <section className="border-y border-line/10 bg-cream-dark py-20">
        <Reveal className="mx-auto max-w-3xl px-6 text-center">
          <p className="eyebrow">(The Sauda Vault)</p>
          <h2 className="mt-6 font-display text-5xl italic text-ink">
            No screenshot scams. <span className="text-clay">Ever.</span>
          </h2>
          <p className="mt-5 text-ink/60">
            Every rupee sits in a regulated escrow ledger until the buyer
            physically inspects the item. Seller sees a giant green banner — not
            a WhatsApp screenshot — before handing anything over.
          </p>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-px overflow-hidden rounded-xl2 border border-line/10 bg-line/10 px-0 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div className="h-full bg-cream p-7 transition-colors duration-200 hover:bg-surface">
                <p className="font-display text-3xl italic text-clay">{s.n}</p>
                <p className="mt-3 font-semibold text-ink">{s.title}</p>
                <p className="mt-1 text-sm text-ink/50">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <Reveal className="grid grid-cols-1 items-end gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">(Why e-Sauda)</p>
            <h2 className="mt-4 font-display text-4xl italic leading-tight text-ink">
              Built like OLX <span className="text-clay">wishes</span> it were built.
            </h2>
          </div>
          <p className="text-ink/60">Every feature exists to fix one specific way older classifieds break. Look around.</p>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl2 border border-line/10 bg-line/10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div className="h-full bg-surface p-7 transition-colors duration-200 hover:bg-cream-dark">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-clay/10 text-clay">
                  <f.icon size={18} strokeWidth={1.75} />
                </span>
                <p className="mt-5 font-semibold text-ink">{f.title}</p>
                <p className="mt-1 text-sm text-ink/50">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <Reveal className="rounded-xl2 border border-line/10 bg-gradient-to-br from-forest to-forest-light px-10 py-16 text-cream">
          <p className="font-display text-4xl italic">Your first listing costs ₹1.</p>
          <p className="font-display text-4xl italic text-clay-light">Your last scam happened yesterday.</p>
          <p className="mt-5 max-w-xl text-cream/70">
            Join the marketplace built by neighbours, for neighbours. Fair fees,
            real people, and money that only moves when you're ready.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/sell"
              className="group flex items-center gap-2 rounded-full bg-clay px-6 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-clay-light"
            >
              Start selling
              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/browse"
              className="rounded-full border border-cream/25 px-6 py-3 text-sm font-semibold text-cream transition-colors duration-200 hover:bg-white/5"
            >
              Browse the marketplace
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}