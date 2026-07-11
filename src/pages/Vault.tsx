import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ShieldCheck, AlertTriangle, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchMyPurchases,
  fetchMySales,
  getHandoverOtp,
  confirmHandover,
  cancelVaultOrder,
} from "../lib/vault";
import { VaultOrder } from "../types";

const tabs = ["Buying", "Selling"] as const;

export default function Vault() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Buying");
  const [purchases, setPurchases] = useState<VaultOrder[]>([]);
  const [sales, setSales] = useState<VaultOrder[]>([]);
  const [loading, setLoading] = useState(true);

  function loadOrders() {
    if (!user) return;
    setLoading(true);
    Promise.all([fetchMyPurchases(user.id), fetchMySales(user.id)])
      .then(([p, s]) => {
        setPurchases(p);
        setSales(s);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const funded = (tab === "Buying" ? purchases : sales).filter((o) => o.status === "funded");
  const history = (tab === "Buying" ? purchases : sales).filter((o) => o.status !== "funded");
  const isEmpty = funded.length === 0 && history.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold">Sauda Vault</h1>
      <p className="mt-1 text-sm text-ink/60">
        Funds locked until handover. Never accept a screenshot as proof of payment —
        only trust what this page shows you.
      </p>

      <div className="mt-6 inline-flex rounded-full border border-black/10 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === t ? "bg-cream-dark text-ink" : "text-ink/50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl2 bg-cream-dark" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl2 border border-dashed border-black/15 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-clay/10 text-clay">
            <Lock size={26} />
          </span>
          <h2 className="mt-6 font-display text-xl font-semibold">
            {tab === "Buying" ? "Your Sauda Vault is empty" : "Nothing in escrow yet"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-ink/60">
            {tab === "Buying"
              ? "When you tap Buy with Vault on a listing, it appears here — funds locked, OTP for handover, all in one place."
              : "When a buyer purchases one of your listings with the Vault, it'll show up here for you to confirm handover."}
          </p>
          <button
            onClick={() => navigate("/browse")}
            className="mt-6 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-light"
          >
            {tab === "Buying" ? "Find something to buy" : "Browse the marketplace"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {funded.map((order) =>
            tab === "Buying" ? (
              <BuyingCard key={order.id} order={order} onChange={loadOrders} />
            ) : (
              <SellingCard key={order.id} order={order} onChange={loadOrders} />
            ),
          )}
          {history.length > 0 && (
            <>
              <p className="pt-4 text-xs font-semibold uppercase tracking-wide text-ink/40">
                Past orders
              </p>
              {history.map((order) => (
                <HistoryRow key={order.id} order={order} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OrderHeader({ order }: { order: VaultOrder }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-cream-dark text-xl">
        {order.listingPhotoUrl ? (
          <img src={order.listingPhotoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          order.listingEmoji || "📦"
        )}
      </span>
      <div>
        <p className="font-medium text-ink">{order.listingTitle || "Listing removed"}</p>
        <p className="text-sm text-ink/50">₹{order.amount.toLocaleString("en-IN")}</p>
      </div>
    </div>
  );
}

function BuyingCard({ order, onChange }: { order: VaultOrder; onChange: () => void }) {
  const [otp, setOtp] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setRevealing(true);
    setError(null);
    try {
      const value = await getHandoverOtp(order.id);
      setOtp(value);
    } catch (err: any) {
      setError(err.message || "Couldn't fetch the OTP.");
    } finally {
      setRevealing(false);
    }
  }

  async function submitCancel() {
    setCancelling(true);
    setError(null);
    try {
      await cancelVaultOrder(order.id, reason || "Buyer cancelled");
      onChange();
    } catch (err: any) {
      setError(err.message || "Couldn't cancel this order.");
      setCancelling(false);
    }
  }

  return (
    <div className="rounded-xl2 border border-emerald-200 bg-emerald-50/60 p-5">
      <OrderHeader order={order} />
      <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <ShieldCheck size={15} /> Funds secured — safe to meet the seller
      </p>

      {otp ? (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-ink/50">Handover OTP</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-widest text-ink">{otp}</p>
          <p className="mt-1 text-xs text-ink/50">
            Share this only after inspecting the item in person.
          </p>
        </div>
      ) : (
        <button
          onClick={reveal}
          disabled={revealing}
          className="mt-3 rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          {revealing ? "Loading…" : "Reveal handover OTP"}
        </button>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</p>}

      <div className="mt-4 border-t border-emerald-100 pt-3">
        {showCancel ? (
          <div className="space-y-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (e.g. item didn't match the listing)"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-xs"
            />
            <div className="flex gap-2">
              <button
                onClick={submitCancel}
                disabled={cancelling}
                className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Confirm cancel"}
              </button>
              <button
                onClick={() => setShowCancel(false)}
                className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-semibold text-ink/60"
              >
                Never mind
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCancel(true)}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Cancel this order
          </button>
        )}
      </div>
    </div>
  );
}

function SellingCard({ order, onChange }: { order: VaultOrder; onChange: () => void }) {
  const [entered, setEntered] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setConfirming(true);
    setError(null);
    try {
      await confirmHandover(order.id, entered.trim());
      onChange();
    } catch (err: any) {
      setError(err.message || "Couldn't confirm handover.");
      setConfirming(false);
    }
  }

  return (
    <div className="rounded-xl2 border border-black/5 bg-white p-5">
      <OrderHeader order={order} />

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          Never accept a screenshot or text message as proof of payment. Only hand over
          the item once you've confirmed the OTP below.
        </span>
      </div>

      <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <ShieldCheck size={15} /> Funds secured in the Vault
      </p>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          value={entered}
          onChange={(e) => setEntered(e.target.value)}
          placeholder="Enter buyer's OTP"
          className="w-40 rounded-lg border border-black/10 px-3 py-2 text-sm tracking-widest"
        />
        <button
          type="submit"
          disabled={confirming || !entered.trim()}
          className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
        >
          {confirming ? "Confirming…" : "Confirm handover"}
        </button>
      </form>

      {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function HistoryRow({ order }: { order: VaultOrder }) {
  const isCompleted = order.status === "completed";
  return (
    <div className="flex items-center justify-between rounded-xl2 border border-black/5 bg-white p-4">
      <OrderHeader order={order} />
      {isCompleted ? (
        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <ShieldCheck size={12} /> Completed
        </span>
      ) : (
        <span className="flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-ink/50">
          <X size={12} /> Cancelled
        </span>
      )}
    </div>
  );
}
