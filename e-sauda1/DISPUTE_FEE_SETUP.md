# feature/dispute-fee — setup guide

What this feature does: this is the last piece of the blueprint's
"Return/Dispute Protocol" — when a buyer or seller cancels a **funded**
Vault order, if a delivery rider had already been arranged for it
(assigned or already delivered), the refund now deducts that rider's fee
instead of refunding the full amount. If the order never had a delivery
arranged (an in-person meetup), cancelling still refunds in full — there's
no logistics cost to recover in that case.

This reuses the real `fee` already stored on the `deliveries` row from the
delivery feature — no new fee amount is invented.

## 1. Run the new SQL migration

Supabase dashboard → **SQL Editor** → New query → paste the entire
contents of `supabase/dispute_fee_schema.sql` → **Run**.

This adds `refund_amount` / `deducted_fee` columns to `vault_orders` and
replaces `cancel_vault_order()` with a version that computes the
deduction — same signature, same ownership/status checks as before, so
nothing else needs to change.

Requires `vault_schema.sql` and `delivery_schema.sql` already applied
(both already are, on your `main`).

## 2. Install and run

```bash
npm install
npm run dev
```

## 3. Test it

**Full refund (no delivery arranged):**
1. Buy a listing with the Vault, don't arrange delivery.
2. Cancel it. Confirm the history shows "Refunded ₹[full amount]" with no
   fee-deducted note.

**Partial refund (delivery already arranged):**
1. Buy a different listing with the Vault.
2. Arrange delivery (so a `deliveries` row exists with `status = 'assigned'`).
3. Try to cancel — before confirming, you should see a warning: "A
   [Partner] rider has already been arranged... you'll get back ₹X instead
   of ₹Y."
4. Confirm the cancel. Check the order history — it should show "Refunded
   ₹X (₹[fee] delivery fee deducted)".
5. Check the delivery itself (if you have UI/DB access to inspect it) —
   its status should now be `cancelled` too, not left dangling as
   `assigned`.

**Already-delivered case:**
1. Buy a listing, arrange delivery, then mark it delivered (simulating the
   rider having completed the trip) — then cancel before confirming
   handover. The fee should still be deducted, since the rider trip
   already happened regardless of what happens with the OTP handover
   afterward.

## Files touched in this branch

- `supabase/dispute_fee_schema.sql` — new: adds refund columns, replaces `cancel_vault_order()`.
- `src/types.ts` — `VaultOrder` now has `refundAmount` / `deductedFee`.
- `src/lib/vault.ts` — mapping and explicit column list include the new fields.
- `src/pages/Vault.tsx` — pre-cancel fee warning (active order) + refund breakdown (history).

Verified in this session: `npm install`, `npx tsc --noEmit`, and
`npm run build` all pass clean with zero errors.

---

## This closes out the free-to-build feature list

Everything left from the original blueprint needs a paid or partnered
account rather than more engineering: a real payment gateway (Razorpay/
Stripe, needs KYC'd business registration), real SMS OTP fallback
(Twilio/Msg91 beyond trial credits), real DigiLocker verification (needs
official government requester registration), real courier dispatch
(needs a business partnership with Rapido/Uber/Dunzo), real voice-based
listing (needs a speech-to-text API account), real AI background removal/
stock-photo detection (needs an image-model API account), and AR/360°
photogrammetry (technically buildable, but a much larger lift than
anything else on this list). Each of those is already documented with an
honest scope note in its respective setup file wherever a mocked version
exists.
