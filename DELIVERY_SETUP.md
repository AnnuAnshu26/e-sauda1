# feature/delivery — setup steps

Mock Rapido/Uber/Dunzo-style delivery, available on any funded Vault order as an
alternative to meeting the seller in person.

## Honest scope note

**No real courier is dispatched.** Integrating Rapido/Uber/Dunzo needs a business
partnership agreement with each of them — not something available to wire up directly,
paid or free. "Arranging delivery" picks a mock partner and a plausible ETA/fee based
on the listing's distance. Everything else is real: real database row, real access
control (only the buyer can arrange or mark delivered), real state transitions.

**Important nuance:** arranging delivery does NOT release the vault funds by itself —
that still requires the same OTP handover as meeting in person (see `ESCROW_VAULT_SETUP.md`).
The idea is the rider relays the OTP between buyer and seller in place of an in-person
meetup. This branch deliberately doesn't touch the vault RPCs, so the two features stay
decoupled and each can be tested independently.

## 1. Make the branch

```bash
git checkout main
git pull origin main
git checkout -b feature/delivery
```

## 2. Copy these files over

New:
- `supabase/delivery_schema.sql`
- `src/lib/delivery.ts`

Changed:
- `src/types.ts` — added `Delivery`, `DeliveryStatus`, `DeliveryPartner`
- `src/pages/Vault.tsx` — Buying tab now shows an "Arrange delivery instead of meeting
  up" button on any funded order; once arranged, shows partner/ETA/fee and a "Mark as
  delivered" button. Selling tab shows a read-only status card once the buyer arranges one.

## 3. Run the SQL

Supabase dashboard → SQL Editor → paste all of `supabase/delivery_schema.sql` → Run.
Creates the `deliveries` table plus `arrange_delivery` and `mark_delivered` functions.

## 4. Install and run

```bash
npm install
npm run dev
```

## 5. Test it (two accounts, same as the vault flow)

1. Buy a listing with Vault as User B (as before).
2. On `/vault` → Buying, find the funded order → click **"Arrange delivery instead of
   meeting up"**.
3. Confirm you see a partner name (Rapido/Uber/Dunzo), an ETA, distance, and fee.
4. Switch to User A (the seller) → `/vault` → Selling → confirm you see a read-only
   card: "Buyer arranged [Partner] delivery — ETA X min · rider assigned."
5. Back as User B, click **"Mark as delivered"** — confirm the card updates to show
   delivered status and a prompt to reveal the OTP.
6. Reveal the OTP (existing button, unchanged) and confirm the seller can still enter
   it via **Confirm handover** exactly as before — this proves the two features are
   properly decoupled.
7. Try arranging delivery twice on the same order — confirm the second attempt fails
   with a clean error ("Delivery has already been arranged"), not a duplicate row.

## 6. Commit, push, merge

```bash
git add -A
git commit -m "Add mock delivery arrangement to the Vault buying/selling flow"
git push -u origin feature/delivery
git checkout main
git merge feature/delivery
git push origin main
```
