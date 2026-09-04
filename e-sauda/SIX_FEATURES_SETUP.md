# New features — setup guide

This covers the 6 requested features. Most of the work is already in the code;
what's listed below is the part that has to happen in the Supabase/Google
dashboards (can't be done from application code).

## 1. Wishlist → Recommendations
No setup needed. `src/lib/recommendations.ts` → `fetchWishlistBasedRecommendations`
ranks other active listings by how much they overlap with what's in the
user's wishlist (category weight + keyword overlap). Shown on Home as
"Recommended for you", logged-in users only.

## 2. Negotiation (seller counter-offers)
Run this migration (needs `supabase/chat_offers_schema.sql` already applied):

```
supabase/chat_offers_negotiation_schema.sql
```

This lets either side counter a pending offer (previously only the buyer
could propose, and the seller could only accept/decline). The accepted
amount already flowed through to the real Razorpay charge before this
change — that part didn't need fixing, only the missing counter-offer path
did. No dashboard steps beyond running the SQL.

## 3. Location on every listing
Already required in the Sell wizard before this round; no change needed.

## 4. Real interactive map per listing
Run these two migrations, in order:

```
supabase/listing_geolocation_schema.sql
supabase/create_listing_with_fee_geolocation.sql
```

Uses **OpenStreetMap + Leaflet** (`leaflet`, `react-leaflet` — already added
to `package.json`, run `npm install`), not Google Maps — this needs **no API
key or billing account** to work. Coordinates are resolved from the seller's
free-text location via OSM's Nominatim geocoder (also free, no key), at the
neighbourhood/area level only — never a precise address, matching the
"don't expose exact location" requirement by construction.

If you'd rather use Google Maps/Places later (e.g. for a proper location
autocomplete instead of free text), only `src/lib/geocoding.ts` and
`src/components/ListingMap.tsx` would need to change — everything else
already just calls `geocodeLocation()` and renders `<ListingMap>`.

## 5. Login required + Mobile OTP + Google
The whole app is now gated behind `RequireAuth` (see `src/App.tsx`) except
`/login`, `/signup`, `/forgot-password`, `/reset-password`, and the legal
pages (kept public — Razorpay and app-store review expect Terms/Privacy/
Refund/Contact to be reachable without an account).

Two dashboard steps are required for this to actually work in production
(Supabase Dashboard → Authentication → Providers):

- **Phone (OTP)**: enable the Phone provider and configure an SMS provider
  (Twilio, MessageBird, Vonage, or MSG91 are supported). Without this,
  `requestPhoneOtp` will fail with a clear error from Supabase.
- **Google**: enable the Google provider, and create an OAuth 2.0 Client ID
  in Google Cloud Console (Authorized redirect URI = the callback URL shown
  on that same Supabase provider settings page). Paste the Client ID/secret
  into Supabase.

See the existing `AUTH_SETUP.md` for the general auth setup this builds on.

## 6. Explore (Shorts-style video feed)
No setup needed. `/explore` (linked in the navbar) shows every active
listing with a video in a vertical snap-scrolling feed — tapping a video or
"View details" opens the exact same `/listing/:id` page as Browse. Since
every listing already requires a video at creation time, this needed no
schema change, just a new query (`fetchListingsWithVideo` in
`src/lib/listings.ts`) and the feed UI (`src/pages/Explore.tsx`).

---

## Quick start
```bash
npm install
```
Then in the Supabase SQL editor, run (if not already applied):
1. `supabase/chat_offers_negotiation_schema.sql`
2. `supabase/listing_geolocation_schema.sql`
3. `supabase/create_listing_with_fee_geolocation.sql`

Then enable the Phone and Google providers as described in section 5 above.
