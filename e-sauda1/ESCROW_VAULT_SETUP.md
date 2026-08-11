# feature/escrow-vault — setup steps

Real "Buy with Vault" flow: buyer locks funds, seller sees FUNDS SECURED, handover is
gated by an OTP only the buyer can see, and either side can cancel before handover.

## Honest scope note — read this first

**No real money moves in this branch.** "Funding" a vault order creates a database row —
there's no payment gateway involved. Real escrow (holding actual rupees) needs a
registered, KYC'd account with a gateway like Razorpay or Stripe, which isn't something
that can be wired up for free or without registering a real business. That's a hard
requirement, not a shortcut I skipped.

Everything **else** here is real, not a UI mockup:
- Real database rows in a real `vault_orders` table
- Real per-user access control enforced **in Postgres itself** (not just hidden in the
  UI) — a user literally cannot query another user's OTP, even via the browser dev
  tools, because the database column is locked down at the SQL level
- Real atomic state transitions (funded → completed / cancelled), handled by database
  functions so two people can't race each other into an inconsistent state

When you're ready for real payments later, the swap-in point is exactly one place:
add a real payment confirmation step before `create_vault_order` runs. Nothing else in
this flow needs to change.

## 1. Make the branch

```bash
git checkout main
git pull origin main
git checkout -b feature/escrow-vault
```

## 2. Copy these files into your project (overwrite where they exist)

New:
- `supabase/vault_schema.sql`
- `src/lib/vault.ts`

Changed:
- `src/types.ts` — added `VaultOrder`, `VaultOrderWithOtp`
- `src/pages/ListingDetail.tsx` — added a "Buy with Vault" button next to "Chat with
  seller"; after a successful purchase, shows the handover OTP right there
- `src/pages/Vault.tsx` — completely rebuilt: Buying/Selling tabs, OTP reveal, handover
  confirmation, cancel flow, and order history

## 3. Run the SQL

Supabase dashboard → SQL Editor → New query → paste **all** of `supabase/vault_schema.sql`
→ Run. This creates the `vault_orders` table, locks down the OTP column so only the
database functions can read it, and creates four functions:
- `create_vault_order` — buyer purchases
- `get_handover_otp` — buyer re-checks their OTP later
- `confirm_handover` — seller submits the OTP to release funds
- `cancel_vault_order` — either party cancels before handover

## 4. Install and run

```bash
npm install
npm run dev
```

## 5. Test it — you'll need two accounts

1. **As User A**: post a listing (or reuse an existing one).
2. **As User B** (use an incognito window so both sessions stay logged in
   simultaneously): open that listing → click **Buy with Vault**. You should
   immediately see a green "Funds secured" panel with a 6-digit OTP.
3. Go to `/vault` as User B — the order should appear under **Buying**, funded, with
   a "Reveal handover OTP" button (click it — same OTP as before).
4. Switch to **User A**, go to `/vault` → **Selling** tab. You should see the order
   with the amber "never accept a screenshot" warning and an OTP input field.
5. Try entering a **wrong** OTP first — confirm you get a clear "Incorrect OTP" error,
   not a crash.
6. Enter the **correct** OTP (from step 3) — the order should move to completed on
   both sides.
7. Repeat the purchase with a second listing, but this time have User B click
   **Cancel this order** from the Buying tab instead. Confirm:
   - the order shows as Cancelled on both sides
   - the listing itself goes back to `active` and reappears in `/browse`

## 6. Also worth checking

- Try buying your own listing (as the owner) — the button shouldn't even show
  (there's an "This is your own listing" message instead).
- Try opening the same listing in two more incognito tabs and clicking Buy with Vault
  from both at nearly the same time — only one should succeed; the second should get
  a "no longer available" style error, confirming the DB-level uniqueness constraint
  is actually doing its job, not just client-side checks.

## 7. Commit, push, merge

```bash
git add -A
git commit -m "Add real escrow vault flow: buy, OTP handover, cancel"
git push -u origin feature/escrow-vault
git checkout main
git merge feature/escrow-vault
git push origin main
```

## What's still a placeholder after this branch

- **Orders.tsx's "Buying"/"Selling" tabs** still show empty states — they weren't wired
  to the new `vault_orders` data in this branch, to keep the change set focused. Vault.tsx
  is the fully working piece; hooking Orders up to read the same data (as a read-only
  history view) is a small, natural follow-up.
- **Ratings/trust score** don't update when an order completes yet — that's a nice next
  addition once this is tested and merged.
- **Real payment collection** — see the scope note at the top.

## Next branch

`feature/delivery` — Rapido/Uber/Dunzo-style delivery arrangement once a handover is
confirmed, or `feature/ratings` — buyer/seller rate each other after a completed order,
which feeds the trust score and progressive listing caps already shown on Profile.
