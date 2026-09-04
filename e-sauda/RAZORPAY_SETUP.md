# feature/razorpay-integration — setup guide

This is a different kind of feature from everything before it: it involves
a **real external account** (Razorpay) and **real server-side code**
(Supabase Edge Functions), not just SQL + React. Follow this in order --
skipping a step will leave "Buy with Vault" broken in a way that's not
obvious from the code.

## What this replaces

Every "Buy with Vault" purchase used to just insert a database row --
`create_vault_order` had zero payment step. Now:

1. Buyer clicks "Buy with Vault" → a Supabase Edge Function creates a real
   Razorpay Order (server-side, price read from the database, never
   trusted from the client).
2. The Razorpay Checkout modal opens in the browser -- a real payment
   form, hitting Razorpay's real (test-mode, for now) systems.
3. On success, a second Edge Function **verifies the payment signature**
   using the secret key -- this is the step that actually proves the
   payment happened, since a browser could otherwise just claim success
   without paying anything.
4. Only once that's verified does `create_vault_order` run, and it now
   *requires* a matching verified-payment row to exist, or it refuses.

**Nothing moves real money yet** -- you'll be using Razorpay's test mode,
which behaves identically to live mode but only accepts test card numbers
and test UPI IDs. Going live later is a config change (swap two keys), not
a code change.

## 1. Create a free Razorpay account

Go to razorpay.com → Sign up. You do **not** need a registered business --
sign up as an individual/sole proprietor. You'll land in test mode by
default, which is exactly what you want right now.

## 2. Get your test API keys

Razorpay Dashboard → **Settings** → **API Keys** → **Generate Test Key**.
You'll get a **Key ID** (starts with `rzp_test_...`) and a **Key Secret**
(shown once -- copy it immediately). Keep both handy for step 4.

## 3. Install the Supabase CLI (if you haven't already)

```bash
npm install -g supabase
supabase login
```

Then link this project to your actual Supabase project (find your project
ref in the Supabase dashboard URL, or under Project Settings → General):

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

## 4. Set your Razorpay keys as Supabase secrets

**Never** put these in your `.env` or anywhere in the React app -- the key
secret must only ever exist server-side. This command stores them as
Edge Function secrets on Supabase's servers, not in your repo:

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_your_key_id
supabase secrets set RAZORPAY_KEY_SECRET=your_key_secret
```

## 5. Deploy the two Edge Functions

```bash
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```

Both live in `supabase/functions/` in your repo -- `_shared/cors.ts` is a
small shared helper, not a function itself, so it doesn't get deployed on
its own.

## 6. Run the SQL migration

Requires `vault_schema.sql` already applied. Then run
`supabase/razorpay_schema.sql` in the SQL Editor.

**Important:** this migration replaces `create_vault_order` with a version
that takes a different argument list, and explicitly drops the old
one-argument version first. If you skip this migration but have already
deployed the Edge Functions, "Buy with Vault" will fail with "No verified
payment found" (correctly refusing to work) rather than silently letting
purchases through unpaid.

## 7. Test it with a fake card

Razorpay's test mode accepts specific test values -- **do not** try a real
card, it won't charge anything but it also won't work since real cards
aren't valid in test mode:

- Test card: `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234` if it asks for one.
- Or test UPI: enter `success@razorpay` as the UPI ID to simulate a
  successful payment (`failure@razorpay` to simulate a decline).

### Test checklist

1. Log in as a buyer, open someone else's listing → **Buy with Vault** →
   confirm the real Razorpay Checkout modal opens (not an instant "funds
   secured" like before).
2. Pay with the test card above → confirm it completes and you land on
   "Funds secured in the Vault", same as the old flow.
3. In your Supabase Table Editor, check `razorpay_payments` → confirm a
   row exists with `consumed_at` now set (proving `create_vault_order`
   actually consumed it).
4. In Razorpay Dashboard → **Payments**, confirm the same payment shows up
   there too -- this is the real proof it hit Razorpay's systems, not just
   your database.
5. Open the Checkout modal again on a different listing, then **close it**
   without paying → confirm you get no error message (this is treated as
   "changed their mind", not a failure).
6. Try the `failure@razorpay` test UPI ID → confirm you get a "Payment
   failed" message.
7. As a sanity check on the security boundary: try calling
   `supabase.rpc('create_vault_order', { p_listing_id: '...', p_razorpay_order_id: 'fake_id' })`
   directly from the browser console with a listing id but a made-up order
   id → confirm it's rejected with "No verified payment found" (proving
   you can't skip payment by calling the RPC directly).

## What's still mocked / a natural next step

**Cancellation still doesn't refund via Razorpay.** `cancel_vault_order`
still just flips the database status -- it doesn't call Razorpay's Refunds
API. Right now, cancelling a real-payment order would leave the buyer's
money sitting in your Razorpay account with no automatic way back to them.
This is the natural next feature once this one's confirmed working: a
third Edge Function (`refund-razorpay-payment`) called from the existing
cancel flow.

**If verification fails after a real charge went through** (e.g. your
Edge Function has a bug, or your Supabase project is down for a moment),
the buyer's money still reached Razorpay -- it's not lost, just not
reflected in your app yet. `lib/razorpay.ts`'s `payWithRazorpay` throws a
distinct error message for this case ("Payment succeeded but could not be
confirmed. Contact support.") so you can tell it apart from an ordinary
failed payment if you ever see it in testing.

## Design notes

**Why two Edge Functions instead of one.** Order creation needs to happen
*before* Checkout opens; verification needs to happen *after* it closes.
Splitting them matches that timing exactly, and keeps each function's job
single-purpose.

**Why the price is read server-side in both functions, never trusted from
the client.** If `create-razorpay-order` accepted an `amount` in the
request body, anyone could open devtools and change it before the request
is sent -- "buy with Vault" would let someone pay ₹1 for anything. Reading
`listings.price` directly in the Edge Function (using the service-role
key, bypassing RLS entirely so it always sees the real, current price)
closes that off structurally, not just by trusting the UI to send the
right number.

**Why `razorpay_payments` has no insert policy for any ordinary role.**
This is what makes a row in that table trustworthy evidence that a real,
signature-verified payment happened -- if regular users could insert into
it, anyone could fake a "verified" payment by just calling
`supabase.from('razorpay_payments').insert(...)` directly, and
`create_vault_order` would have no way to tell a real payment from a
forged one.

**Why signature verification uses a manual timing-safe comparison instead
of `===`.** Standard practice for anything comparing a cryptographic
signature -- a naive `===` returns as soon as it finds a mismatched
character, which leaks (via response timing) how many leading characters
were correct. It's a subtle attack and arguably overkill for this specific
case, but there's no cost to doing it properly.

## Files touched in this branch

- `supabase/razorpay_schema.sql` — new: `razorpay_payments` table + RLS,
  replaces `create_vault_order` with a version requiring a verified
  payment.
- `supabase/functions/_shared/cors.ts` — new: shared CORS headers.
- `supabase/functions/create-razorpay-order/index.ts` — new: Edge
  Function, creates a real Razorpay order.
- `supabase/functions/verify-razorpay-payment/index.ts` — new: Edge
  Function, verifies the payment signature and records it.
- `src/lib/razorpay.ts` — new: client-side orchestration (loads
  Checkout.js, calls both functions, wraps it as one promise).
- `src/lib/vault.ts` — `createVaultOrder` now requires a
  `razorpayOrderId`.
- `src/pages/ListingDetail.tsx` — `handleBuy` now runs the real payment
  flow before creating the vault order.

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors (the Deno Edge Functions aren't
part of this build -- they're outside `tsconfig.json`'s `include`, and run
on Supabase's servers, not in your Vite app).
