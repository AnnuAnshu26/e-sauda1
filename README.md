# e-Sauda

Local C2C classifieds marketplace for India. Buyers and sellers deal directly; the only
payment e-Sauda takes is the seller's listing fee (₹1 / ₹10 / ₹25), collected via **Cashfree**.

Stack: React 18 + TypeScript + Vite + Tailwind, Supabase (auth, Postgres, storage, edge functions), deployed on Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev
npm run build                # type-check + production build
```

## Layout

```
api/          Vercel serverless function (link-preview/OG tags for /listing/:id)
docs/         Setup notes per feature (start with CASHFREE_SETUP.md)
public/       robots.txt, sitemap.xml
src/          App (components, pages, hooks, lib, context, data)
supabase/     SQL migrations + edge functions (Deno)
```

## Payments

Cashfree only. See [`docs/CASHFREE_SETUP.md`](./docs/CASHFREE_SETUP.md) for secrets, webhook,
migration (`supabase/cashfree_listing_fee_schema.sql`) and function deployment.

Edge functions: `create-listing-fee-order`, `verify-and-publish-listing`, `cashfree-webhook`.
