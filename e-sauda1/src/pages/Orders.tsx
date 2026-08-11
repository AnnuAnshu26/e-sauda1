import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { deleteListing, fetchUserListings } from "../lib/listings";
import { deleteListingPhotos } from "../lib/storage";
import { Listing } from "../types";

const tabs = ["Buying", "Selling", "My listings"] as const;

export default function Orders() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Buying");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadMyListings() {
    if (!user) return;
    setLoading(true);
    fetchUserListings(user.id)
      .then(setMyListings)
      .catch(() => setMyListings([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMyListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleDelete(id: string) {
    if (!user) return;
    setDeletingId(id);
    try {
      // Best-effort — if photo cleanup fails, still remove the listing row rather
      // than leaving an orphaned, undeletable listing stuck in the UI.
      await deleteListingPhotos(user.id, id).catch(() => {});
      await deleteListing(id);
      setMyListings((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const activeMyListings = myListings.filter((l) => l.status === "active");
  const counts = {
    Buying: 0,
    Selling: 0,
    "My listings": activeMyListings.length,
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold">My orders</h1>

      <div className="mt-6 inline-flex rounded-full border border-black/10 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === t ? "bg-cream-dark text-ink" : "text-ink/50"
            }`}
          >
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      {tab === "My listings" ? (
        loading ? (
          <div className="mt-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl2 bg-cream-dark"
              />
            ))}
          </div>
        ) : myListings.length > 0 ? (
          <div className="mt-6 space-y-3">
            {myListings.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-xl2 border border-black/5 bg-white p-4"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-cream-dark text-2xl">
                    {l.emoji}
                  </span>
                  <div>
                    <p className="font-medium text-ink">{l.title}</p>
                    <p className="text-sm text-ink/50">
                      ₹{l.price.toLocaleString("en-IN")} · {l.category}
                      {l.status !== "active" && (
                        <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs capitalize">
                          {l.status}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(l.id)}
                  disabled={deletingId === l.id}
                  className="flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink/60 hover:border-red-200 hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2 size={13} />{" "}
                  {deletingId === l.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            message="You haven't posted anything yet."
            cta="Post a listing"
            onClick={() => navigate("/sell")}
          />
        )
      ) : (
        <EmptyState
          message={tab === "Buying" ? "No purchases yet." : "Nothing sold yet."}
          cta="Explore marketplace"
          onClick={() => navigate("/browse")}
        />
      )}
    </div>
  );
}

function EmptyState({
  message,
  cta,
  onClick,
}: {
  message: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-xl2 border border-dashed border-black/15 py-20 text-center">
      <Package size={36} className="text-ink/30" />
      <p className="mt-4 font-medium text-ink">{message}</p>
      <button
        onClick={onClick}
        className="mt-4 flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream-dark"
      >
        {cta}
      </button>
    </div>
  );
}
