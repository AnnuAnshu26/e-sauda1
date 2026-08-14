import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronDown,
  Lock,
  ShieldCheck,
  Truck,
  Sparkles,
} from "lucide-react";
import { categories } from "../data/listings";
import { fetchListings } from "../lib/listings";
import { useSavedListings } from "../hooks/useSavedListings";
import { Listing } from "../types";
import ListingCard from "../components/ListingCard";

const stats = [
  { value: "₹42 Cr", label: "Moved through the vault last month" },
  { value: "2.1 M", label: "Verified sellers, ID-checked" },
  { value: "4.8", suffix: "★", label: "Average buyer rating" },
  { value: "24/7", label: "Escrow held until handover" },
];

const steps = [
  {
    n: "01",
    title: "Lock the price",
    desc: "Chat in-app and agree on a number. No numbers leaked.",
  },
  {
    n: "02",
    title: "Fund the vault",
    desc: "Buyer pays by UPI or card. Money is held, not released.",
  },
  {
    n: "03",
    title: "Meet or ship",
    desc: "A rider is assigned. Status reads funds secured.",
  },
  {
    n: "04",
    title: "Verify and release",
    desc: "Buyer inspects, shares the code. Seller is paid instantly.",
  },
];

const features = [
  {
    icon: Lock,
    title: "Vaulted escrow, always",
    desc: "A buyer's payment sits in escrow. The handover code releases it only once your dashboard reads funds secured.",
  },
  {
    icon: ShieldCheck,
    title: "Progressive trust limits",
    desc: "New accounts list one or two items. Strong ratings unlock more. Bulk resellers stay filtered out, by design.",
  },
  {
    icon: Truck,
    title: "One-tap city delivery",
    desc: "Rapido, Uber and Dunzo are built into checkout — price, ETA and rider locked in with a single tap.",
  },
  {
    icon: Sparkles,
    title: "AI-assisted listings",
    desc: "We clean the background, flag likely stock photos, and suggest a fair price before you publish.",
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
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl3 bg-forest px-6 py-10 text-cream sm:px-12 sm:py-14">
        <div className="flex items-center justify-between border-b border-cream/15 pb-6 text-xs">
          <span className="uppercase tracking-widest2 text-cream/60">
            (e-Sauda marketplace)
          </span>
          <span className="hidden items-center gap-2 uppercase tracking-widest2 text-cream/60 sm:flex">
            <Lock size={12} /> Escrow-protected
          </span>
        </div>

        <div className="grid grid-cols-1 gap-10 pt-10 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-6">
          <h1 className="font-display text-[15vw] italic leading-[0.9] tracking-tight sm:text-[9vw] lg:text-[6.4vw]">
            Trade with
            <br />
            trust.
          </h1>
          <div className="flex flex-col gap-6 pb-2">
            <p className="font-display text-xl italic text-cream/70">
              Buy and sell locally — money held safely, sellers verified.
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-cream/60">
              Money sits in the vault until you inspect the item in person. No
              broker calls, no screenshot scams — just a clean handover.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/browse"
                className="flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-sm font-medium text-forest transition hover:bg-cream-dark"
              >
                Explore listings <ArrowUpRight size={15} />
              </Link>
              <Link
                to="/sell"
                className="rounded-full border border-cream/25 px-6 py-3 text-sm font-medium text-cream transition hover:bg-cream/10"
              >
                List an item — ₹1
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-center gap-2 text-xs uppercase tracking-widest2 text-cream/40">
          <ChevronDown size={13} /> Scroll
        </div>
      </section>

      {/* Stats */}
      <section className="mt-3 grid grid-cols-2 gap-3 rounded-xl3 bg-cream-dark px-6 py-10 sm:px-12 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="font-display text-5xl italic text-ink sm:text-6xl">
              {s.value}
              {s.suffix && (
                <span className="text-2xl not-italic text-clay">
                  {s.suffix}
                </span>
              )}
            </p>
            <p className="mt-3 max-w-[16ch] text-xs leading-snug text-ink/50">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section className="px-2 py-16 sm:px-4">
        <div className="mb-8 flex items-end justify-between border-b border-ink/10 pb-4">
          <div>
            <span className="text-xs uppercase tracking-widest2 text-ink/40">
              (Browse)
            </span>
            <h2 className="mt-2 font-display text-3xl italic text-ink">
              Shop by category
            </h2>
          </div>
          <Link
            to="/browse"
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-widest2 text-ink/50 hover:text-clay"
          >
            See all <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl2 border border-ink/10 bg-ink/10 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((c) => (
            <Link
              key={c.name}
              to={`/browse?category=${c.name}`}
              className="group flex flex-col items-center gap-3 bg-cream px-4 py-8 text-center transition hover:bg-forest hover:text-cream"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 font-display text-lg italic text-ink/70 group-hover:border-cream/30 group-hover:text-cream">
                {c.name.charAt(0)}
              </span>
              <span className="text-xs font-medium text-ink group-hover:text-cream">
                {c.name}
              </span>
              <span className="text-[11px] text-ink/40 group-hover:text-cream/50">
                {(c.count / 1000).toFixed(0)}k live
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Fresh listings */}
      <section className="px-2 pb-16 sm:px-4">
        <div className="mb-8 flex items-end justify-between border-b border-ink/10 pb-4">
          <div>
            <span className="text-xs uppercase tracking-widest2 text-ink/40">
              (Live now)
            </span>
            <h2 className="mt-2 font-display text-3xl italic text-ink">
              Fresh in your city
            </h2>
          </div>
          <Link
            to="/browse"
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-widest2 text-ink/50 hover:text-clay"
          >
            Browse all <ArrowUpRight size={13} />
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
          <div className="rounded-xl2 border border-dashed border-ink/15 py-14 text-center">
            <p className="text-sm text-ink/60">
              No listings yet — be the first.
            </p>
            <Link
              to="/sell"
              className="mt-3 inline-block text-sm font-medium text-clay hover:underline"
            >
              Post the first listing →
            </Link>
          </div>
        )}
      </section>

      {/* Vault explainer */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col justify-between rounded-xl3 bg-cream-dark p-10">
          <span className="text-xs uppercase tracking-widest2 text-ink/40">
            (The vault)
          </span>
          <div>
            <h2 className="font-display text-4xl italic leading-[1.05] text-ink sm:text-5xl">
              No screenshot
              <br />
              scams. Ever.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink/60">
              Every rupee sits in a regulated escrow ledger until the buyer
              physically inspects the item — verified on-screen, not over
              WhatsApp.
            </p>
            <Link
              to="/browse"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-medium text-cream hover:bg-forest-light"
            >
              See it in action <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl3 border border-ink/10 bg-ink/10 sm:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="bg-cream p-8">
              <p className="font-display text-3xl italic text-clay">{s.n}</p>
              <p className="mt-3 text-sm font-medium text-ink">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink/50">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="px-2 py-16 sm:px-4">
        <div className="mb-10 grid grid-cols-1 items-end gap-6 border-b border-ink/10 pb-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <span className="text-xs uppercase tracking-widest2 text-ink/40">
              (Why e-Sauda)
            </span>
            <h2 className="mt-2 font-display text-4xl italic leading-tight text-ink">
              Built for how neighbours actually trade.
            </h2>
          </div>
          <p className="text-sm text-ink/60 lg:justify-self-end lg:text-right">
            Every feature exists to fix one specific way older classifieds
            break.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl2 border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="bg-cream p-6">
              <f.icon size={18} className="text-clay" />
              <p className="mt-4 text-sm font-medium text-ink">{f.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink/50">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mb-4 overflow-hidden rounded-xl3 bg-forest px-6 py-16 text-center text-cream sm:px-12">
        <span className="text-xs uppercase tracking-widest2 text-cream/40">
          (Get started)
        </span>
        <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl italic leading-tight sm:text-5xl">
          Your first listing costs ₹1. Your last scam happened yesterday.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-sm text-cream/60">
          Fair fees, real people, and money that only moves when you're
          ready.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/sell"
            className="flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-sm font-medium text-forest hover:bg-cream-dark"
          >
            Start selling <ArrowUpRight size={15} />
          </Link>
          <Link
            to="/browse"
            className="rounded-full border border-cream/25 px-6 py-3 text-sm font-medium text-cream hover:bg-cream/10"
          >
            Browse the marketplace
          </Link>
        </div>
      </section>
    </div>
  );
}
