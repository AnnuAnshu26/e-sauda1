# feature/razorpay-refund — setup guide

Closes the gap flagged in `RAZORPAY_SETUP.md`: cancelling a Vault order
used to just flip a database status and *compute* a refund amount, but
never actually send it back via Razorpay. This makes that real.

Also fixes the two receipt/error bugs found while testing the original
Razorpay integration -- see the bottom of this doc.

## What changed

- Cancelling a funded order now calls a new Edge Function
  (`cancel-vault-order-and-refund`) instead of the `cancel_vault_order` RPC
  directly. The RPC still runs -- same ownership/status checks, same fee
  deduction logic from feature/dispute-fee -- the function just also
  issues a **real Razorpay refund** afterward for whatever `refund_amount`
  gets computed.
- If a listing's delivery already happened (rider fee already deducted),
  only the remaining `refund_amount` is refunded, exactly as before --
  this feature doesn't change *how much* gets refunded, only that it now
  actually gets sent.
- Vault now distinguishes **"Refund processing"** from **"Refunded"** --
  the moment of cancellation and the moment money actually moves are no
  longer the same instant like they were when everything was mocked.
- If the Razorpay refund call itself fails (network blip, etc.), the
  order still shows as cancelled -- it just shows "Refund processing"
  until a retry succeeds. Cancelling again (or a background retry
  mechanism, if you build one later) safely retries only the refund step,
  never double-cancels or double-refunds.

## 1. Run the SQL migration

Requires `razorpay_schema.sql` and `dispute_fee_schema.sql` already
applied. Then run `supabase/refund_schema.sql` in the SQL Editor.

## 2. Deploy the new Edge Function

No new secrets needed -- it reuses `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`
from the original integration.

```bash
supabase functions deploy cancel-vault-order-and-refund
```

## 3. Test it

1. Buy a listing with a real (test-mode) Razorpay payment, same as
   before.
2. Cancel it (as buyer or seller) → confirm you land back on "active"
   listing status, same as before, but now the row shows **"Refund
   processing ₹X"** first.
3. Check Razorpay Dashboard → **Payments** → find that payment → confirm
   a refund now shows against it.
4. Refresh the Vault page after a few seconds → confirm it now shows
   **"Refunded ₹X"** (the wording only flips once `refund_processed_at`
   is actually set).
5. In Supabase Table Editor, check `vault_orders` for that order →
   confirm `razorpay_refund_id` and `refund_processed_at` are both
   populated.
6. Test the delivery-fee-deduction interaction: arrange a delivery on an
   order, then cancel it → confirm the refund is for `refund_amount`
   (amount minus the rider fee), not the full original amount -- check
   this against the actual refund shown in Razorpay's dashboard, not just
   your own database, to confirm the real refund matches what your app
   computed.
7. **Simulate a failed refund** (optional, harder to trigger deliberately)
   -- if you ever see "Refund processing" get stuck, calling cancel again
   on the same order id is safe and will retry just the refund step.

## Design notes

**Why cancellation isn't rolled back if the refund fails.** By the time a
refund could fail, the order is already cancelled and the listing is
already back to `active` -- other people may already be viewing/acting on
it as available again. Undoing that to "fix" a refund failure would trade
one inconsistency for a worse one. Instead, the order stays cancelled and
the refund is simply retryable, tracked by `refund_processed_at` staying
null.

**Why retry is "call the same function again" rather than a separate
retry endpoint.** `cancel_vault_order`'s own status check already refuses
to double-cancel an already-cancelled order -- the Edge Function catches
that specific rejection and, only if the refund hasn't been processed
yet, treats it as "just retry the refund part" instead of returning an
error. This means there's exactly one place to call from the client
regardless of whether this is the first attempt or a retry.

**Why "Refund processing" vs "Refunded" needed a new
`razorpayPaymentId` check on the client, not just `refundProcessedAt`.**
Orders created before this integration (or in any environment still using
the mocked Vault) have `refund_amount` set but no real payment behind
them at all -- `refund_processed_at` would never get set for those, so
without this check they'd show "Refund processing" forever with nothing
ever going to actually process it. Checking `razorpayPaymentId` first
tells those two situations apart.

## Bugs found and fixed while testing the original integration

Two issues came up during manual testing of feature/razorpay-integration,
both fixed as part of getting that feature working (not part of this
refund feature specifically, but documented here since they were found in
the same session):

1. **Receipt too long.** Razorpay's `receipt` field caps at 40 characters;
   `listing_${uuid}` was 44. Fixed to `l_${uuid}` (38 characters) in
   `create-razorpay-order/index.ts`.
2. **Swallowed error messages.** `supabase.functions.invoke()`'s `error`
   object only exposes a generic "Edge Function returned a non-2xx status
   code" via `error.message` -- the actual JSON body an Edge Function
   returns on failure is only accessible via `error.context` (the real
   Response object). Fixed in `lib/razorpay.ts`'s `invokeFunction` to read
   `error.context.json()` and surface the real message; `lib/vault.ts`
   now reuses this same helper for the same reason.

## Files touched in this branch

- `supabase/refund_schema.sql` — new: `razorpay_refund_id` and
  `refund_processed_at` columns on `vault_orders`.
- `supabase/functions/cancel-vault-order-and-refund/index.ts` — new: Edge
  Function orchestrating cancellation + real refund.
- `src/lib/razorpay.ts` — exported `invokeFunction` for reuse; fixed error
  message unwrapping.
- `src/lib/vault.ts` — `cancelVaultOrder` now calls the Edge Function and
  returns a richer result (`refunded`, `refundFailed`); added
  `razorpay_payment_id`/`refund_processed_at` to reads.
- `src/types.ts` — added `refundProcessedAt`, `razorpayPaymentId` to
  `VaultOrder`.
- `src/pages/Vault.tsx` — shows "Refund processing" vs "Refunded";
  surfaces a distinct message if cancellation succeeded but the refund
  itself needs a retry.
- `supabase/functions/create-razorpay-order/index.ts` — receipt-length
  bugfix (see above).

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
