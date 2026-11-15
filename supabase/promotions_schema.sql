-- Run in Supabase Dashboard -> SQL Editor. Idempotent and non-destructive.
--
-- Paid promotion of listings (and optionally their reel/video in Explore).
--
-- DESIGN
--   * Plans live in a table (promotion_plans), NOT in code: change a price/duration by editing a row.
--     Prices are stored in paise. Starter plans: Rs 1 (listing) and Rs 5 (listing + reel).
--   * The client never states a price. The create-promotion-order Edge Function reads the plan from here.
--   * A promotion becomes ACTIVE only via activate_promotion(), which only the service role (the
--     Cashfree webhook, after verifying the signature AND re-fetching the order from Cashfree) can call.
--     activate_promotion is idempotent, so webhook retries / replays cannot double-activate.
--   * Expiry is enforced at READ time (expires_at > now()), so an expired promotion can never keep paid
--     placement even if no cron job runs. expire_promotions() just tidies the status column.
--   * Placement is always labelled "Sponsored" in the UI. Only ACTIVE (not sold/removed) listings qualify.
--
-- Prerequisites: listings_schema.sql, notifications_schema.sql, admin_schema.sql, handover_dispute_schema.sql
-- (that file also contains the notifications.type list this one relies on).

-- 1. Plans -------------------------------------------------------------------------------------------
create table if not exists public.promotion_plans (
  code text primary key,
  name text not null,
  description text,
  price_paise integer not null check (price_paise >= 100),     -- Cashfree minimum is Rs 1
  duration_days integer not null check (duration_days between 1 and 90),
  includes_reel boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.promotion_plans enable row level security;
drop policy if exists "Anyone can view active plans" on public.promotion_plans;
create policy "Anyone can view active plans" on public.promotion_plans for select using (is_active or public.is_admin());
drop policy if exists "Admins manage plans" on public.promotion_plans;
create policy "Admins manage plans" on public.promotion_plans for all using (public.is_admin()) with check (public.is_admin());

-- Starter plans. Edit these rows any time to change price/duration -- e.g.
--   update public.promotion_plans set price_paise = 4900, duration_days = 7 where code = 'listing_basic';
insert into public.promotion_plans (code, name, description, price_paise, duration_days, includes_reel, sort_order) values
  ('listing_basic', 'Promote listing',
   'Your listing appears in the Promoted section on Home and near the top of Browse, labelled Sponsored.',
   100, 3, false, 1),
  ('listing_reel', 'Promote listing + reel',
   'Everything in Promote listing, plus your listing''s video is shown in the Explore reels feed, labelled Sponsored.',
   500, 7, true, 2)
on conflict (code) do nothing;

-- 2. Promotions ----------------------------------------------------------------------------------------
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings on delete cascade,
  seller_id uuid not null references auth.users on delete cascade,
  plan_code text not null references public.promotion_plans (code),
  -- Snapshot of what was bought, so later plan edits never rewrite history.
  amount_paise integer not null check (amount_paise >= 100),
  duration_days integer not null check (duration_days > 0),
  includes_reel boolean not null default false,
  status text not null default 'pending_payment' check (status in
    ('pending_payment', 'active', 'expired', 'cancelled', 'payment_failed', 'under_review', 'paused')),
  cashfree_order_id text not null unique,
  cashfree_payment_id text unique,
  payment_session_id text,
  paid_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists promotions_seller_idx on public.promotions (seller_id, created_at desc);
create index if not exists promotions_live_idx on public.promotions (expires_at) where status = 'active';
-- A listing can have only ONE promotion in flight (pending, active or paused).
create unique index if not exists promotions_one_live_per_listing
  on public.promotions (listing_id) where status in ('pending_payment', 'active', 'paused');

alter table public.promotions enable row level security;
drop policy if exists "Sellers view own promotions" on public.promotions;
create policy "Sellers view own promotions" on public.promotions for select using (auth.uid() = seller_id or public.is_admin());
revoke insert, update, delete on public.promotions from anon, authenticated;

-- 3. Service-role-only lifecycle functions -----------------------------------------------------------------
create or replace function public.expire_promotions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.promotions set status = 'expired', updated_at = now()
  where status = 'active' and expires_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Called by the Cashfree webhook AFTER it verified the signature and fetched the order from Cashfree.
-- Idempotent: replays return the existing row untouched. Refuses an amount that doesn't match the order.
create or replace function public.activate_promotion(p_order_id text, p_payment_id text, p_amount_paise integer)
returns public.promotions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.promotions;
  v_listing public.listings;
begin
  select * into v_p from public.promotions where cashfree_order_id = p_order_id for update;
  if not found then raise exception 'Unknown promotion order' using errcode = 'P0002'; end if;

  if v_p.status in ('active', 'expired', 'paused', 'cancelled', 'under_review') and v_p.paid_at is not null then
    return v_p;  -- already processed (webhook retry / replay)
  end if;
  if p_amount_paise is distinct from v_p.amount_paise then
    raise exception 'Paid amount does not match the promotion' using errcode = 'P0001';
  end if;

  select * into v_listing from public.listings where id = v_p.listing_id;

  -- Money arrived for an order we had already cancelled/replaced: never auto-run it, hand it to a human.
  if v_p.status = 'cancelled' then
    update public.promotions
    set status = 'under_review', paid_at = now(), cashfree_payment_id = p_payment_id,
        admin_note = 'Payment arrived for a cancelled order. Refund manually.', updated_at = now()
    where id = v_p.id returning * into v_p;
    return v_p;
  end if;

  if v_listing.status <> 'active' then
    -- Paid, but the listing was sold/removed meanwhile: don't run an ad for it. Needs a human (refund).
    update public.promotions
    set status = 'under_review', paid_at = now(), cashfree_payment_id = p_payment_id,
        admin_note = 'Paid, but the listing was no longer active. Refund or re-link manually.', updated_at = now()
    where id = v_p.id returning * into v_p;
    insert into public.notifications (user_id, type, title, body, link)
    values (v_p.seller_id, 'promotion_failed', 'Promotion on hold',
            'Your payment arrived, but the listing is no longer active, so the promotion was not started. We will review it.', '/my-listings');
    return v_p;
  end if;

  begin
    update public.promotions
    set status = 'active', paid_at = now(), cashfree_payment_id = p_payment_id,
        starts_at = now(), expires_at = now() + make_interval(days => v_p.duration_days), updated_at = now()
    where id = v_p.id returning * into v_p;
  exception when unique_violation then
    -- The listing already has another live promotion (e.g. a late payment on a failed attempt).
    update public.promotions
    set status = 'under_review', paid_at = now(), cashfree_payment_id = p_payment_id,
        admin_note = 'Paid, but this listing already has another live promotion. Refund or merge manually.', updated_at = now()
    where id = v_p.id returning * into v_p;
    return v_p;
  end;

  insert into public.notifications (user_id, type, title, body, link)
  values (v_p.seller_id, 'promotion_active', 'Your promotion is live',
          '"' || v_listing.title || '" is promoted until ' || to_char(v_p.expires_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM') || '.',
          '/my-listings');
  return v_p;
end;
$$;

create or replace function public.fail_promotion(p_order_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.promotions set status = 'payment_failed', updated_at = now()
  where cashfree_order_id = p_order_id and status = 'pending_payment';
$$;

revoke execute on function public.expire_promotions() from public, anon, authenticated;
revoke execute on function public.activate_promotion(text, text, integer) from public, anon, authenticated;
revoke execute on function public.fail_promotion(text) from public, anon, authenticated;
grant execute on function public.expire_promotions() to service_role;
grant execute on function public.activate_promotion(text, text, integer) to service_role;
grant execute on function public.fail_promotion(text) to service_role;

-- 4. Public read: which listings are promoted RIGHT NOW --------------------------------------------------
-- p_scope 'listing' = any active promotion; 'reel' = only promotions that include the reel (and have a video).
-- Randomised order gives every promoter fair rotation instead of always showing the same one first.
create or replace function public.get_promoted_listings(p_scope text default 'listing', p_limit integer default 8)
returns setof public.listings
language sql
stable
security definer
set search_path = public
as $$
  select l.*
  from public.promotions p
  join public.listings l on l.id = p.listing_id
  where p.status = 'active' and p.expires_at > now()
    and l.status = 'active'
    and (p_scope <> 'reel' or (p.includes_reel and l.video_url is not null))
  order by random()
  limit greatest(1, least(p_limit, 20));
$$;
grant execute on function public.get_promoted_listings(text, integer) to anon, authenticated;

-- 5. Admin controls ---------------------------------------------------------------------------------------
create or replace function public.admin_set_promotion_status(p_id uuid, p_status text, p_note text default null)
returns public.promotions
language plpgsql
security definer
set search_path = public
as $$
declare v_p public.promotions;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_status not in ('paused', 'active', 'cancelled') then raise exception 'Invalid status'; end if;
  select * into v_p from public.promotions where id = p_id for update;
  if not found then raise exception 'Promotion not found' using errcode = 'P0002'; end if;
  if v_p.paid_at is null then raise exception 'Only paid promotions can be changed' using errcode = 'P0001'; end if;
  if p_status = 'active' and (v_p.expires_at is null or v_p.expires_at <= now()) then
    raise exception 'This promotion has already expired' using errcode = 'P0001';
  end if;
  update public.promotions set status = p_status, admin_note = left(p_note, 500), updated_at = now()
  where id = p_id returning * into v_p;
  return v_p;
end;
$$;
grant execute on function public.admin_set_promotion_status(uuid, text, text) to authenticated;

create or replace function public.admin_promotion_stats()
returns table (revenue_paise bigint, active_count bigint, expired_count bigint, failed_count bigint, review_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return query
    select coalesce(sum(amount_paise) filter (where paid_at is not null), 0)::bigint,
           count(*) filter (where status = 'active' and expires_at > now()),
           count(*) filter (where status = 'expired' or (status = 'active' and expires_at <= now())),
           count(*) filter (where status = 'payment_failed'),
           count(*) filter (where status = 'under_review')
    from public.promotions;
end;
$$;
grant execute on function public.admin_promotion_stats() to authenticated;
