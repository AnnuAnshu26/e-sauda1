-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- IMPORTANT CONTEXT: this file existed in the repo already but was empty (1 byte) --
-- despite refund_schema.sql, listing_fee_schema.sql, and account_deletion_schema.sql
-- all referencing it as an already-applied prerequisite (specifically: the
-- razorpay_payments table and a razorpay_payment_id column on vault_orders). This is
-- a reconstruction of what those files assume already exists.
--
-- WHY THIS MATTERS A LOT: without the create_vault_order replacement below,
-- create_vault_order (from vault_schema.sql) has NO payment check at all -- it
-- accepts any listing id from any logged-in user and creates a real vault order,
-- completely bypassing Razorpay Checkout. If your live Supabase project doesn't
-- already have an equivalent function (e.g. applied by hand, not through this
-- committed file), real "purchases" could currently be created with zero payment.
-- Please check this before assuming your Vault flow is actually payment-gated.
--
-- HOW TO CHECK what your live database currently has, before running this:
--   select prosrc from pg_proc where proname = 'create_vault_order';
-- If that function's body does NOT mention razorpay_payments at all, your live
-- database has the same gap and this migration actively fixes something broken,
-- not just re-applies something already there. If it DOES already reference
-- razorpay_payments, this migration is a safe, idempotent no-op re-application.
--
-- Prerequisite: supabase/vault_schema.sql must already be applied.

create extension if not exists pgcrypto;

-- One row per successfully-verified Razorpay payment. Only ever written by
-- verify-razorpay-payment's admin client (see that Edge Function) -- no insert
-- policy exists for the authenticated/anon roles below, which is what makes a row
-- here trustworthy proof that a real payment was actually verified server-side,
-- not just claimed by the browser.
create table if not exists public.razorpay_payments (
  id uuid primary key default gen_random_uuid(),
  razorpay_order_id text not null unique,
  razorpay_payment_id text not null unique,
  listing_id uuid references public.listings on delete cascade not null,
  buyer_id uuid references auth.users on delete cascade not null,
  amount numeric not null,
  -- Set the moment create_vault_order successfully uses this payment, so the same
  -- verified payment can never be used to create a second vault order.
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists razorpay_payments_listing_buyer_idx
  on public.razorpay_payments (listing_id, buyer_id)
  where consumed_at is null;

alter table public.razorpay_payments enable row level security;
-- Deliberately zero policies -- with RLS enabled and no policies, this table is
-- completely inaccessible to authenticated/anon regardless of any GRANT that might
-- exist, which is exactly what we want for a payment-proof table.

-- vault_orders needs to remember which real payment funded it, for the refund flow
-- (see refund_schema.sql) and for showing a real payment reference on receipts.
alter table public.vault_orders
  add column if not exists razorpay_payment_id text;

-- Replaces the version of create_vault_order from vault_schema.sql -- same signature,
-- same ownership/status checks as before, now gated on a real verified payment.
create or replace function public.create_vault_order(p_listing_id uuid)
returns public.vault_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_payment record;
  v_otp text;
  v_order public.vault_orders;
begin
  select * into v_listing from public.listings where id = p_listing_id for update;

  if v_listing is null then
    raise exception 'Listing not found';
  end if;
  if v_listing.owner_id = auth.uid() then
    raise exception 'You cannot buy your own listing';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'This listing is no longer available';
  end if;

  -- The actual payment gate: requires a real, already-verified Razorpay payment for
  -- this exact listing and buyer, not yet used for another order. Uses `not found`
  -- (Postgres's built-in flag for whether the preceding SELECT matched a row) rather
  -- than checking `v_payment is null` -- a lesson learned the hard way on this same
  -- project (see dispute_fee_schema.sql's comment on the composite-row IS NULL/IS NOT
  -- NULL gotcha): a found row here is guaranteed to have every column but
  -- consumed_at non-null, so IS NULL would actually be safe too, but FOUND sidesteps
  -- the whole class of bug rather than relying on reasoning about which columns can
  -- be null.
  select * into v_payment from public.razorpay_payments
    where listing_id = p_listing_id and buyer_id = auth.uid() and consumed_at is null
    order by created_at desc
    limit 1
    for update;

  if not found then
    raise exception 'No verified payment found for this listing. Complete checkout first.';
  end if;

  v_otp := lpad(floor(random() * 900000 + 100000)::text, 6, '0');

  insert into public.vault_orders (listing_id, buyer_id, seller_id, amount, handover_otp, razorpay_payment_id)
  values (p_listing_id, auth.uid(), v_listing.owner_id, v_payment.amount, v_otp, v_payment.razorpay_payment_id)
  returning * into v_order;

  update public.razorpay_payments set consumed_at = now() where id = v_payment.id;
  update public.listings set status = 'sold' where id = p_listing_id;

  return v_order;
end;
$$;

grant execute on function public.create_vault_order(uuid) to authenticated;
