# e-Sauda upgrade: audit findings and progress

Status legend: ✅ done and tested here · 🟡 done, needs your environment to verify · 📋 planned, not started

## What the repo actually is
Vite + React 18 + TypeScript + Tailwind SPA on Vercel. Supabase provides auth, Postgres (RLS), Realtime, Storage and Deno Edge Functions. Cashfree is used only for the seller **listing fee**. Groq powers the chatbot and Suggest Description.

**The platform is already C2C by design** (`docs/C2C_MIGRATION.md`). There is no in-app purchase, escrow or order flow, and buyers pay sellers directly in person. This changes several phases of the master prompt (see "Decisions needed").

## Fixed in this pass

### 1. Notification bell and profile dropdown pushing the page down ✅
**Root cause (not a CSS hack):** `.glass` / `.glass-elevated` in `src/index.css` were declared *after* `@tailwind utilities`, outside any `@layer`. Their `position: relative` therefore beat Tailwind's `absolute` and `sticky` utilities. Every dropdown became an in-flow block, and the `glass sticky` header was never sticky.
**Fix:** moved both classes into `@layer components` so utilities win. Navbar panels also now:
- anchor to the header on mobile (inset 16px, always on-screen);
- anchor under the button from `sm` up;
- close on Escape, outside pointer-down and route change;
- close each other;
- carry `aria-expanded`, `role="dialog"` and `role="menu"`.

### 2. Messages page jumping to the bottom of the website ✅
**Root cause:** `bottomRef.scrollIntoView()` runs on every `messages`/`offers` change and scrolls *all* ancestors, including the window.
**Fix:** scroll only the thread container. The first open of a thread jumps to its latest message. After that, auto-scroll happens only if the reader is within 80px of the bottom, and a `ResizeObserver` keeps them pinned when the composer or banners change height. The same bug was fixed in `ChatbotWidget`.

### 3. Suggest Description 🟡
**Likely root cause (inferred from code + Groq docs; I did not have your error screenshot or API key):** the default model `qwen/qwen3.6-27b` is valid on Groq today, but it is a *reasoning* model that thinks by default. The function capped output at `max_tokens: 600`, so thinking tokens could exhaust it and return empty content, which surfaced as "Could not generate a suggestion right now."
**Fix:**
- `reasoning_effort: "none"` (overridable with the `GROQ_VISION_REASONING_EFFORT` secret) and `max_completion_tokens: 1024`.
- One automatic retry without reasoning params if the provider rejects them.
- Distinct error messages for bad key, missing model, rate limit and oversize payload, plus server-side logging of `finish_reason` and usage.
- Accepts brand, colour, material, size, features and English/Hindi; seller text is clipped and treated as data, not instructions; images are size-capped.
- UI: language selector and a "Try again" button after a failure.
**Deploy:** `supabase functions deploy suggest-description`. Confirm `GROQ_API_KEY` is set. If it still fails, read the function logs: they now say why.

## Test results (real browser, mocked Supabase backend, original vs fixed builds)
| Check | Original | Fixed |
|---|---|---|
| Content shift when bell opens | +435px desktop / +493px mobile | 0px |
| Dropdown computed position | relative | absolute |
| Escape closes panels | no | yes |
| Sticky header after scrolling | scrolls away | stays pinned |
| Window scroll after opening a chat | 453px / 901px | 0 |
| Latest message visible in thread | no | yes |
| JS errors, horizontal overflow | none | none |

Tests: `tests/e2e/` (Playwright, Python). `npm run build` (tsc + vite) passes.
**Not tested:** live Supabase/Realtime, real Groq calls, tablet breakpoint in the full app, reading-older-messages-while-new-arrive, other pages.

## Findings that need your attention
1. **`.env.example` contains a real Supabase URL and anon key.** The anon key is public by design, so this isn't a leak, but it depends entirely on RLS being correct. Prefer placeholders.
2. **Chat moderation is client-side only.** `flagged`/`flag_reasons` are computed in the browser and inserted by the client, so a modified client can skip them. Real enforcement needs a DB trigger or Edge Function.
3. **The current UPI regex matches ordinary emails** (`\b[\w.\-]{2,}@[a-zA-Z]{2,}\b`). Expect false positives.
4. **`c2c_migration.sql` drops tables** (`vault_orders`, `deliveries`, `meetups`, `razorpay_payments`). Confirm whether it has already run in production, and don't rerun it blindly.
5. **No rate limiting** on `suggest-description` or `chat-assistant` (AI cost abuse); CORS is `*` on edge functions.
6. **Chat gaps:** no pagination (`fetchMessages` loads everything), an N+1 query for the last message per conversation, no read/unread or delivery status, and no image messages.
7. **Documentation drift:** older `*_SETUP.md` files and `TESTING_GUIDE.md` still describe the removed Vault flow.
8. **Audit coverage is partial.** Read so far: Navbar, App shell, CSS, Messages, chat/moderation libs, suggest-description, README and C2C docs. Not yet read: Explore (Reels), Home, Browse, ListingDetail, Admin, Profile, Cashfree functions, `recommendations.ts`, and RLS policies in the SQL files.

## Decisions needed before Phases 3, 6, 8, 10, 11
- **Phase 10 (orders, handover, escrow) contradicts the current model.** Today buyers pay sellers in person; Cashfree is only for listing fees. Choose one:
  - (a) keep in-person payment and add a lightweight *handover confirmation + dispute log* (no money movement); or
  - (b) introduce in-platform payments. That needs a payment-gateway marketplace/split-settlement capability and RBI/regulatory review. I will not simulate escrow in the UI.
- **Phase 3A (flag UPI IDs/phone numbers)** fights the in-person-payment model: sharing a number or paying by UPI at a meetup is normal. Proposed: keep phone numbers allowed, flag advance-payment, QR-before-meeting, OTP and phishing patterns, and move enforcement server-side.
- **Phases 6/8 (paid promotions)** can reuse the Cashfree order/webhook functions. Tell me the plans/prices you want as configuration.
- **Phase 11 (legal)** will be drafted against what the product actually does; it needs review by an Indian lawyer before publishing.

## Proposed next steps (each small enough to test properly)
1. Finish the audit of the unread pages and RLS.
2. Server-side chat moderation + read receipts + pagination (+ image messages with QR/OCR).
3. Promotions table + Cashfree order/webhook reuse + "Sponsored" labelling.
4. Reels grid and full-screen viewer, then the recommendation events and ranking.
5. Legal pages.


---
# Pass 2: owner decisions applied

Decisions: handover = lightweight two-sided confirmation + dispute log (no money moves); phone numbers allowed, focus on advance payments / OTP / QR / phishing, with a visible warning on every high-risk message; promotions start at ₹1 (listing) and ₹5 (listing + reel), all configurable.

| Item | Status |
|---|---|
| Server-enforced chat risk scan, recipient warnings, audit log, appeals, rate limit | ✅ tested (Postgres + browser) |
| Handover confirmation (both sides) + disputes + admin resolution | ✅ tested (Postgres + browser) |
| Promotion plans, server-priced checkout, webhook-verified activation, expiry, placements, seller + admin dashboards | ✅ logic tested (Postgres, Node webhook harness, browser). 🟡 **needs one real ₹1 Cashfree payment on your account** |
| Image messages + QR/OCR scanning | 📋 not built (needs image upload in chat) |
| Handover photos / OTP, dispute photos | 📋 not built |
| Promotion view/click analytics, automated refunds | 📋 not built |
| Legal pages (Phase 11), Reels grid redesign (Phase 7), recommendation engine (Phase 9) | 📋 not started |

See `docs/C2C_SAFETY_HANDOVER_PROMOTIONS.md` for deploy order and limitations.

New finding: no migration in the repo creates the `profiles` table, so the schema cannot be rebuilt from the repo alone. Worth exporting the real schema (`supabase db dump --schema public`) into version control.
