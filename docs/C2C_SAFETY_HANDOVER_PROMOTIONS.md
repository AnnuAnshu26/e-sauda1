# Chat safety, handover confirmation and promotions

Everything here is additive: new columns/tables/functions only, nothing dropped, existing data untouched.

## Deploy order
1. **SQL** (Supabase → SQL Editor), in this order. Each file is idempotent.
   1. `supabase/chat_risk_scan_schema.sql`
   2. `supabase/handover_dispute_schema.sql` (also widens the `notifications.type` list)
   3. `supabase/promotions_schema.sql`
2. **Edge Functions**
   - `supabase deploy`: `supabase functions deploy create-promotion-order` and re-deploy `cashfree-webhook` (promotion branch added; `verify_jwt = false` stays as in `config.toml`).
   - Secrets already used by the listing-fee flow are reused: `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `APP_URL`. No new secrets.
   - `suggest-description`: re-deploy (see AUDIT_AND_PROGRESS.md).
3. **Cashfree dashboard**: the webhook URL is the existing `.../functions/v1/cashfree-webhook`; make sure payment *success/failed* events are enabled (they already are for listing fees).
4. **Front end**: deploy as usual.
5. Add your own site's domain to `chat_link_allowlist` so links to it are not flagged.

## 1. Chat risk scanning (Phase 3)
- A `BEFORE INSERT` trigger on `messages` scans every message and **overwrites** `risk_level`, `flagged`, `flag_reasons`: a modified client can no longer skip it. A browser copy (`src/lib/moderation.ts`) only powers the pre-send nudge; `tests/sql/cases.json` is run against both so they cannot drift.
- **Flagged (high):** OTP/PIN requests, advance/token/booking/"pay first"/"pay before you come" (incl. some Hinglish), QR-scan lures, UPI collect-request lures, shortened/IP/punycode/payment-themed links. **Medium:** other external links, UPI ID + pay verb outside a meetup context, bank details, staff impersonation.
- **Not flagged:** phone numbers, plain UPI IDs, emails, "I'll pay cash when we meet".
- **Nothing is blocked.** The recipient sees a warning attached to the message explaining the specific risk; the sender sees a pre-send warning and a note that the other person was warned, plus "Think this is a mistake?" (appeal).
- `moderation_events` is an audit trail with a **redacted** excerpt (digits, UPI-style IDs and links masked). 3 high-risk messages in 24h marks the sender as a repeat sender for admin review. **No automatic suspension** (too risky with a heuristic).
- Rate limit: 30 messages/min/sender; 2000-character cap. Admins can read a message's full text only while the sender's appeal is open.
- Admin → *Chat safety*: appeals, repeat senders, all high-risk.

## 2. Handover confirmation + disputes (Phase 10, lightweight)
- No money moves through e-Sauda. Seller taps "I handed over", buyer taps "I received it", in either order, each timestamped; the other person is notified. When **both** have confirmed: deal completed, listing marked sold (this unlocks the existing ratings), both notified. Completed-deal counts are available via `get_user_deal_stats()`.
- Either person can **Report a problem** (reason + description). Admins can read the chat of a disputed conversation, and only those, and record a resolution that both people are notified about. Admin → *Disputes*.
- All writes go through `SECURITY DEFINER` functions; clients have no direct write access to these tables.

## 3. Promotions (Phases 6 & 8, minimal)
- Plans are rows in `promotion_plans` (prices in paise). Seeded: **₹1 / 3 days** listing promotion, **₹5 / 7 days** listing + reel. Change with e.g.
  `update promotion_plans set price_paise = 4900, duration_days = 7 where code = 'listing_basic';`
- Flow: Promote button (My listings) → plan modal → `create-promotion-order` (price read **server-side** from the plan; ownership and "listing is active" checked; idempotent: same listing+plan within 25 min returns the same checkout session) → Cashfree → **webhook** verifies signature, re-fetches the order from Cashfree, checks amount/currency/tags, then calls `activate_promotion` (service-role only, idempotent). The browser only polls the status.
- Placement: Home "Promoted listings" (≤4), top of Browse (≤2, only if they match the active filters), sponsored reels in Explore (every 4th reel, listing+reel plan only). Always labelled **Sponsored**, de-duplicated from organic results. Expired / paused / sold / removed listings get no placement (enforced at read time via `expires_at`, no cron needed).
- Paid-but-ineligible cases (listing sold meanwhile, late payment on a replaced order, duplicate) go to `under_review` for a human instead of silently running or failing.
- Seller dashboard (My listings → Your promotions) and Admin → *Promotions* (revenue, active/expired/failed/review counts, pause/resume/remove).

## Known limitations (be honest with users)
- **No automated refunds.** Refund promotion payments in the Cashfree dashboard.
- **No view/click tracking** for promotions yet; the dashboard says so.
- **Image/QR-code scanning in chat is not built** (chat has no image messages yet). Today's QR protection is text-based ("scan this QR…"). Image upload + QR decoding is the next piece.
- **Handover has no photo evidence or OTP/QR confirmation yet**, and disputes have no photo attachments, only text.
- Heuristic scanner: it will have false positives *and* misses. Appeals and the admin queue exist for that reason.
- The mobile-number field in the promote modal is required by Cashfree; it is not stored by us beyond the payment provider.
- Edge Functions were verified with a Node harness (stubbed Supabase/Cashfree), **not** executed on Deno/Supabase, and no real Cashfree payment was made. Do one real ₹1 test promotion before announcing.
- Legal pages are **not** updated yet. Terms/Privacy/Refund text should mention: sponsored placement, automated chat scanning + admin access to disputed/appealed chats, the promotion refund policy, and that e-Sauda does not hold or guarantee payments. Needs review by an Indian lawyer.

## Tests (all in `tests/`)
| Suite | How to run | Result |
|---|---|---|
| Scanner rules on real Postgres | `python3 tests/sql/test_chat_risk.py` | 24/24 |
| Trigger/audit/redaction/rate-limit/appeal | `python3 tests/sql/test_chat_triggers.py` | 10/10 |
| TS ↔ SQL scanner parity | `npx esbuild src/lib/moderation.ts --format=esm --outfile=/tmp/moderation.mjs && node tests/sql/test_moderation_ts.mjs` | 24/24 |
| Handover + disputes + RLS | `python3 tests/sql/test_handover.py` | 25/25 |
| Promotions lifecycle + RLS | `python3 tests/sql/test_promotions.py` | 28/28 |
| Webhook promotion branch | `node tests/functions/webhook_promotion_test.mjs` | 10/10 |
| Browser: chat warnings, deal panel, promote modal, sponsored (desktop + mobile) | `tests/e2e/c2c_features_e2e.py` | 48/48 |
| Browser: dropdowns/scroll regression | `tests/e2e/ui_stability_e2e.py` | pass |

SQL tests need `pip install pgserver psycopg2-binary`; browser tests need Playwright (Python).
The SQL harness stubs `profiles` because no migration in the repo creates it.
