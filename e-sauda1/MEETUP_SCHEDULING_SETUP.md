# feature/meetup-scheduling — setup guide

Lets buyer and seller agree on a real date/time/location for handover,
instead of only coordinating that through free-text chat with nothing
structured to look back at. Also adds one-tap "get a ride there" buttons
once a location is set.

## What's real here, and what isn't

**Fully real, works today, no external account needed:**
- The meetup scheduling itself (propose / confirm / cancel / re-propose) —
  just your own database, same pattern as everything else in this app.
- Notifications when the other party proposes, confirms, or cancels.
- The **"Get an Uber there"** button — this uses Uber's actual, public,
  documented universal-link format (`developer.uber.com/docs/deep-linking`).
  No API key, no partner approval, no sandbox needed — it's a plain URL
  that opens the real Uber app (or mobile web, if the app isn't installed)
  with your current location as pickup and the meetup spot as dropoff,
  already filled in.

**Honestly not real, and the UI says so:**
- The **"Open Rapido"** button. Unlike Uber, Rapido has no publicly
  documented deep-link scheme for pre-filling pickup/dropoff — I checked
  before building this rather than guess at an undocumented URL that could
  silently break. It just opens Rapido's site with nothing pre-filled.
  The UI explicitly says "Rapido doesn't currently support that" right
  next to the button, rather than implying both buttons do the same thing.

## 1. Run the SQL migration

Requires `vault_schema.sql` and `notifications_schema.sql` already
applied. Then run `supabase/meetup_schema.sql` in the SQL Editor.

## 2. Test it

1. As the buyer on a funded Vault order, go to **Vault** → find the
   **Meetup** section → **"Propose a time & place to meet"**.
2. Fill in a date/time and a location description (e.g. "Metro gate,
   Sector 18") → optionally click **"Attach my current location"** (your
   browser will ask permission) → **Propose**.
3. Log in as the **seller** → confirm you see a notification and the
   proposed time/place on the same order in Vault, with a **Confirm**
   button (since you're not the one who proposed it).
4. Click **Confirm** → confirm the buyer gets a "Meetup confirmed"
   notification, and both sides now show "Confirmed by both of you".
5. If you attached a location, confirm **"Get an Uber there"** is now
   visible → click it → your browser will ask for location permission
   again (this is a fresh request each time, for *your own* current
   position as pickup — not stored, not shared with the other party) →
   confirm it opens Uber (app if installed, else mobile web) with pickup
   and dropoff already filled in.
6. Click **"Open Rapido"** → confirm it opens Rapido's site with no
   prefill, and re-read the small note under the buttons — confirms the
   UI is being upfront about the difference.
7. Click **"Propose different time"** → change the time → submit →
   confirm the other party gets notified again, and the meetup updates in
   place (not a duplicate).
8. Click **Cancel** on a confirmed meetup → confirm both the status and
   the other party's notification reflect it, and that **"Propose a time &
   place to meet"** reappears so a new one can be scheduled.
9. Try proposing without attaching a location at all → confirm the
   meetup still saves fine with just the text description, and the Uber
   button is replaced with "Attach a location... to enable one-tap ride
   booking" instead of erroring.

## Design notes

**Why one row per order instead of a history of proposals.** There's only
ever one "current" plan for a given order — re-proposing is meant to
replace the old plan, not create a parallel one alongside it. A primary
key of `vault_order_id` makes this a natural upsert rather than needing to
track "which proposal is the active one" separately.

**Why the notification trigger needed a fix mid-build.** The first
version only fired when `status` changed — but re-proposing a *different*
time while still in `'proposed'` status (i.e. before the other party
confirmed) doesn't change the status at all, so that case would have
silently sent no notification. Fixed by also checking whether
`meetup_at`/`location_name` changed even when `status` didn't.

**Why pickup location is captured fresh at click-time, not stored.** The
buyer and seller are travelling *from* different places to the *same*
meetup point — only the destination is shared/stored; each person's own
current location is requested live, right when they click "Get an Uber
there", and only ever used to build that one URL, never saved anywhere.

**Why Rapido wasn't just skipped entirely.** Even without prefill, giving
people a direct link to open the app is still marginally more useful than
nothing, and being explicit that it's a lesser experience than the Uber
button (rather than quietly making it look equivalent) is the more honest
choice than omitting Rapido and only offering Uber.

## Files touched in this branch

- `supabase/meetup_schema.sql` — new: `meetups` table + RLS + notification
  trigger.
- `src/lib/meetups.ts` — new: `fetchMeetup`, `proposeMeetup`,
  `confirmMeetup`, `cancelMeetup`.
- `src/lib/rideLinks.ts` — new: `getCurrentLocation`, `buildUberRideLink`,
  `getRapidoLink`.
- `src/components/MeetupPlanner.tsx` — new: the UI, used by both buyer and
  seller views.
- `src/pages/Vault.tsx` — added `<MeetupPlanner>` to both `BuyingCard` and
  `SellingCard`.

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
