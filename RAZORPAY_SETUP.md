# Razorpay setup (listing fee only)

e-Sauda is a C2C classifieds platform. Buyers and sellers meet and pay each other
directly (cash / UPI), so **the only payment that goes through Razorpay is the seller's
listing fee** (₹1 / ₹10 / ₹25 depending on how many active listings they already have in
that category). Money lands in the bank account linked to your Razorpay account, minus
Razorpay's fee. e-Sauda never holds a buyer's or seller's money.

## How the fee flow works

1. Seller finishes the Sell wizard and taps **Pay ₹X & publish**.
2. `create-listing-fee-order` (Edge Function) counts the seller's active listings in that
   category, works out the fee server-side, and creates a Razorpay order.
3. The Razorpay Checkout modal opens in the browser; the seller pays.
4. `verify-listing-fee-payment` checks Razorpay's signature server-side and records the
   payment in `listing_fee_payments`.
5. `create_listing_with_fee` (Postgres function) only creates the listing if a verified,
   unused payment exists for that order. If publishing fails after payment, the order stays
   valid, so retrying does not charge again.

## Setup

1. Complete Razorpay activation (KYC, PAN, bank account). Until then only test mode works.
2. Set the Edge Function secrets:
   ```
   supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxx RAZORPAY_KEY_SECRET=xxx
   ```
   (use `rzp_test_...` keys while testing).
3. Deploy the two fee functions:
   ```
   supabase functions deploy create-listing-fee-order
   supabase functions deploy verify-listing-fee-payment
   ```
4. Make sure `razorpay_schema.sql`, `listing_fee_schema.sql` and
   `create_listing_with_fee_geolocation.sql` were applied earlier, then run
   `c2c_migration.sql` (see `C2C_MIGRATION.md`).

## Removed

`create-razorpay-order`, `verify-razorpay-payment` and `cancel-vault-order-and-refund` (the
old "Buy with Vault" purchase and refund functions) no longer exist. If you deployed them
before, remove them:
```
supabase functions delete create-razorpay-order
supabase functions delete verify-razorpay-payment
supabase functions delete cancel-vault-order-and-refund
```

## Testing (test mode)

- Sell something as a new user: first listing in a category should charge ₹1, second ₹10,
  third ₹25. Use Razorpay's test card/UPI details.
- Close the Checkout modal without paying: nothing is published, no error banner.
- Check `listing_fee_payments` has a row marked consumed after a successful publish.
