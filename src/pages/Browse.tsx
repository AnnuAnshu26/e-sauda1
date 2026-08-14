import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { categories } from "../data/listings";
import { Category, Listing } from "../types";
import { fetchListings } from "../lib/listings";
import { useSavedListings } from "../hooks/useSavedListings";
import ListingCard from "../components/ListingCard";

const tabs: ("All" | Category)[] = ["All", ...categories.map((c) => c.name)];

export default function Browse() {
  const { savedIds, toggleSaved } = useSavedListings();
  const [params, setParams] = useSearchParams();
  const [active, setActive] = useState<"All" | Category>(
    (params.get("category") as Category) || "All",
  );
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [city, setCity] = useState("All cities");
  const [sort, setSort] = useState("Relevance");
  const [searchInput, setSearchInput] = useState(params.get("q") || "");
  const [search, setSearch] = useState(params.get("q") || "");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce typing in the search box so we're not firing a query on every
  // keystroke — 350ms feels responsive without hammering the DB while typing.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Keeps the URL bookmarkable/shareable (e.g. the navbar's search box links here
  // with ?q=...) without fighting the debounce above.
  useEffect(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        search ? next.set("q", search) : next.delete("q");
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchListings({
      category: active,
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
      search,
      city: city !== "All cities" ? city : undefined,
    })
      .then((data) => {
        if (!cancelled) setListings(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load listings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, min, max, search, city]);

  const filtered = useMemo(() => {
    let result = listings;
    if (sort === "Price: Low to High")
      result = [...result].sort((a, b) => a.price - b.price);
    if (sort === "Price: High to Low")
      result = [...result].sort((a, b) => b.price - a.price);
    if (sort === "Nearest first")
      result = [...result].sort((a, b) => a.distanceKm - b.distanceKm);
    return result;
  }, [listings, sort]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              active === t
                ? "bg-forest text-cream"
                : "border border-black/10 bg-white text-ink/80"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-xl2 border border-black/5 bg-white p-5">
          <h3 className="font-display text-lg font-semibold">Filters</h3>

          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              Search
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2">
              <Search size={16} className="shrink-0 text-ink/40" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search listings..."
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              City
            </label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
            >
              <option>All cities</option>
              <option>Bengaluru</option>
              <option>Mumbai</option>
              <option>Delhi NCR</option>
            </select>
          </div>

          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              Price (₹)
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="Min"
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              />
              <input
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="Max"
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink/50">
              Sort by
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
            >
              <option>Relevance</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Nearest first</option>
            </select>
          </div>

          <div className="mt-5 rounded-lg bg-clay/10 p-3 text-xs text-clay">
            <strong>Trust filter is on.</strong> Only sellers within their
            listing cap. Bulk resellers are automatically hidden.
          </div>
        </aside>

        <div>
          <p className="mb-4 font-display text-xl font-semibold">
            {search ? `Results for "${search}"` : active === "All" ? "All listings" : active}{" "}
            <span className="text-base font-normal text-ink/50">
              · {loading ? "…" : filtered.length} results across India
            </span>
          </p>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              Couldn't load listings: {error}
            </p>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-xl2 bg-cream-dark"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  saved={savedIds.has(l.id)}
                  onToggleSaved={toggleSaved}
                />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && !error && (
            <p className="mt-10 text-center text-sm text-ink/50">
              {search
                ? `No listings match "${search}". Try a different search term.`
                : "No listings match these filters yet."}
            </p>
          )}

          <div className="mt-10 rounded-xl2 bg-clay/10 p-8 text-center">
            <p className="font-display text-xl font-semibold">
              Have something to sell?
            </p>
            <p className="mt-1 text-sm text-ink/60">
              It only takes a few minutes to list an item.
            </p>
            <Link
              to="/sell"
              className="mt-4 inline-block rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light"
            >
              Post a listing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
