-- Run in Supabase Dashboard -> SQL Editor. Idempotent and non-destructive.
--
-- Lightweight handover confirmation + dispute log. NO MONEY MOVES THROUGH THE PLATFORM: buyer and
-- seller pay each other directly (cash/UPI). This only records that BOTH sides confirm the item changed
-- hands, and gives either side a documented way to raise a problem for admin review.
--
-- Flow
--   * Seller taps "I handed it over", buyer taps "I received it" (either order). Each confirmation is
--     timestamped and the other person is notified.
--   * When BOTH have confirmed the deal is "completed": the listing is marked sold (so ratings unlock)
--     and both are notified.
--   * Either person can raise a dispute at any time. Admins can read the chat for a disputed
--     conversation (and only for that), and record a resolution.
-- All writes go through the SECURITY DEFINER functions below; clients have no direct write access.
--
-- Prerequisites: chat_schema.sql, notifications_schema.sql, admin_schema.sql.

-- Canonical notifications.type list (same idempotent pattern as notifications_type_check_fix.sql):
-- the previous list PLUS the new types. Re-running any older file that narrows it is fixed by re-running this.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'message', 'vault_funded', 'vault_completed', 'vault_cancelled',
    'report_reviewed', 'report_dismissed', 'price_drop',
    'meetup_proposed', 'meetup_confirmed', 'meetup_cancelled',
    'handover_confirmed', 'deal_completed', 'dispute_opened', 'dispute_resolved',
    'promotion_active', 'promotion_failed'
  )
);

-- 1. Handover confirmations (one per conversation) -------------------------------------------------
create table if not exists public.deal_handovers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations on delete cascade,
  listing_id uuid not null references public.listings on delete cascade,
  buyer_id uuid not null references auth.users on delete cascade,
  seller_id uuid not null references auth.users on delete cascade,
  seller_confirmed_at timestamptz,
  seller_note text,
  buyer_confirmed_at timestamptz,
  buyer_note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deal_handovers_buyer_idx on public.deal_handovers (buyer_id) where completed_at is not null;
create index if not exists deal_handovers_seller_idx on public.deal_handovers (seller_id) where completed_at is not null;
-- A listing can only be completed once, however many buyers chatted about it.
create unique index if not exists deal_handovers_one_completed_per_listing
  on public.deal_handovers (listing_id) where completed_at is not null;

alter table public.deal_handovers enable row level security;
drop policy if exists "Participants view their handover" on public.deal_handovers;
create policy "Participants view their handover" on public.deal_handovers for select
  using (auth.uid() in (buyer_id, seller_id) or public.is_admin());
revoke insert, update, delete on public.deal_handovers from anon, authenticated;

-- 2. Disputes ----------------------------------------------------------------------------------------
create table if not exists public.deal_disputes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  listing_id uuid not null references public.listings on delete cascade,
  raised_by uuid not null references auth.users on delete cascade,
  against_user uuid not null references auth.users on delete cascade,
  reason text not null check (reason in (
    'not_received', 'wrong_item', 'damaged', 'not_as_described',
    'handover_not_completed', 'receipt_not_confirmed', 'suspected_fraud', 'other')),
  description text not null check (char_length(description) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'dismissed')),
  resolution_note text,
  resolved_by uuid references auth.users on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists deal_disputes_status_idx on public.deal_disputes (status, created_at desc);
create index if not exists deal_disputes_conversation_idx on public.deal_disputes (conversation_id);
-- One live dispute per person per conversation (stops spam; they can raise another once it is closed).
create unique index if not exists deal_disputes_one_live
  on public.deal_disputes (conversation_id, raised_by) where status in ('open', 'under_review');

alter table public.deal_disputes enable row level security;
drop policy if exists "Parties view their disputes" on public.deal_disputes;
create policy "Parties view their disputes" on public.deal_disputes for select
  using (auth.uid() in (raised_by, against_user) or public.is_admin());
revoke insert, update, delete on public.deal_disputes from anon, authenticated;

-- Admins may read a conversation and its messages ONLY while a dispute exists for it.
drop policy if exists "Admins can read conversations under dispute" on public.conversations;
create policy "Admins can read conversations under dispute" on public.conversations for select
  using (public.is_admin() and exists (select 1 from public.deal_disputes d where d.conversation_id = conversations.id));
drop policy if exists "Admins can read messages under dispute" on public.messages;
create policy "Admins can read messages under dispute" on public.messages for select
  using (public.is_admin() and exists (select 1 from public.deal_disputes d where d.conversation_id = messages.conversation_id));

-- 3. confirm_handover ----------------------------------------------------------------------------------
create or replace function public.confirm_handover(p_conversation_id uuid, p_note text default null)
returns public.deal_handovers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations;
  v_listing public.listings;
  v_h public.deal_handovers;
  v_is_seller boolean;
  v_other uuid;
  v_me_name text;
begin
  select * into v_conv from public.conversations where id = p_conversation_id;
  if not found or auth.uid() is null or auth.uid() not in (v_conv.buyer_id, v_conv.seller_id) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  v_is_seller := auth.uid() = v_conv.seller_id;
  v_other := case when v_is_seller then v_conv.buyer_id else v_conv.seller_id end;

  select * into v_listing from public.listings where id = v_conv.listing_id;

  -- Create-or-lock the row for this conversation.
  insert into public.deal_handovers (conversation_id, listing_id, buyer_id, seller_id)
  values (v_conv.id, v_conv.listing_id, v_conv.buyer_id, v_conv.seller_id)
  on conflict (conversation_id) do nothing;
  select * into v_h from public.deal_handovers where conversation_id = v_conv.id for update;

  if v_h.completed_at is not null then
    return v_h;  -- idempotent
  end if;
  -- Removed listing, or another conversation already completed this listing (sold to someone else).
  -- A listing the seller merely marked "sold" by hand can still be confirmed here.
  if v_listing.status = 'removed'
     or exists (select 1 from public.deal_handovers o
                where o.listing_id = v_h.listing_id and o.completed_at is not null and o.id <> v_h.id) then
    raise exception 'This listing is no longer available' using errcode = 'P0001';
  end if;

  if (v_is_seller and v_h.seller_confirmed_at is not null) or (not v_is_seller and v_h.buyer_confirmed_at is not null) then
    return v_h;  -- already confirmed; idempotent
  end if;

  if v_is_seller then
    update public.deal_handovers set seller_confirmed_at = now(), seller_note = left(p_note, 500), updated_at = now()
    where id = v_h.id returning * into v_h;
  else
    update public.deal_handovers set buyer_confirmed_at = now(), buyer_note = left(p_note, 500), updated_at = now()
    where id = v_h.id returning * into v_h;
  end if;

  select coalesce(display_name, 'Someone') into v_me_name from public.profiles where id = auth.uid();

  if v_h.seller_confirmed_at is not null and v_h.buyer_confirmed_at is not null then
    update public.deal_handovers set completed_at = now(), updated_at = now() where id = v_h.id returning * into v_h;
    update public.listings set status = 'sold' where id = v_h.listing_id and status = 'active';
    insert into public.notifications (user_id, type, title, body, link) values
      (v_h.buyer_id, 'deal_completed', 'Deal completed', 'Both of you confirmed the handover of "' || v_listing.title || '". You can now rate each other.', '/messages/' || v_conv.id),
      (v_h.seller_id, 'deal_completed', 'Deal completed', 'Both of you confirmed the handover of "' || v_listing.title || '". You can now rate each other.', '/messages/' || v_conv.id);
  else
    insert into public.notifications (user_id, type, title, body, link) values
      (v_other, 'handover_confirmed',
       case when v_is_seller then v_me_name || ' says the item was handed over' else v_me_name || ' says they received the item' end,
       'Please confirm on your side for "' || v_listing.title || '", or report a problem if something is wrong.',
       '/messages/' || v_conv.id);
  end if;

  return v_h;
end;
$$;
grant execute on function public.confirm_handover(uuid, text) to authenticated;

-- 4. open_dispute -----------------------------------------------------------------------------------------
create or replace function public.open_dispute(p_conversation_id uuid, p_reason text, p_description text)
returns public.deal_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations;
  v_d public.deal_disputes;
  v_against uuid;
begin
  select * into v_conv from public.conversations where id = p_conversation_id;
  if not found or auth.uid() is null or auth.uid() not in (v_conv.buyer_id, v_conv.seller_id) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  v_against := case when auth.uid() = v_conv.seller_id then v_conv.buyer_id else v_conv.seller_id end;

  begin
    insert into public.deal_disputes (conversation_id, listing_id, raised_by, against_user, reason, description)
    values (v_conv.id, v_conv.listing_id, auth.uid(), v_against, p_reason, btrim(p_description))
    returning * into v_d;
  exception when unique_violation then
    raise exception 'You already have an open dispute for this conversation' using errcode = 'P0001';
  end;

  insert into public.notifications (user_id, type, title, body, link)
  values (v_against, 'dispute_opened', 'A problem was reported about a deal',
          'The other person reported an issue. Our team may review the conversation. Please keep communication respectful.',
          '/messages/' || v_conv.id);
  return v_d;
end;
$$;
grant execute on function public.open_dispute(uuid, text, text) to authenticated;

-- 5. resolve_dispute (admins) ---------------------------------------------------------------------------------
create or replace function public.resolve_dispute(p_dispute_id uuid, p_status text, p_note text default null)
returns public.deal_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d public.deal_disputes;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_status not in ('under_review', 'resolved', 'dismissed') then raise exception 'Invalid status'; end if;
  if p_status in ('resolved', 'dismissed') and coalesce(btrim(p_note), '') = '' then
    raise exception 'A resolution note is required' using errcode = 'P0001';
  end if;

  update public.deal_disputes
  set status = p_status, resolution_note = left(p_note, 1000),
      resolved_by = case when p_status = 'under_review' then null else auth.uid() end,
      resolved_at = case when p_status = 'under_review' then null else now() end
  where id = p_dispute_id returning * into v_d;
  if not found then raise exception 'Dispute not found' using errcode = 'P0002'; end if;

  if p_status in ('resolved', 'dismissed') then
    insert into public.notifications (user_id, type, title, body, link) values
      (v_d.raised_by, 'dispute_resolved', 'Your report was reviewed', left(coalesce(p_note, ''), 300), '/messages/' || v_d.conversation_id),
      (v_d.against_user, 'dispute_resolved', 'A report about a deal was reviewed', left(coalesce(p_note, ''), 300), '/messages/' || v_d.conversation_id);
  end if;
  return v_d;
end;
$$;
grant execute on function public.resolve_dispute(uuid, text, text) to authenticated;

-- 6. Completed-deal counts (public: shown on seller profiles) ------------------------------------------------------
create or replace function public.get_user_deal_stats(p_user_id uuid)
returns table (sold_count bigint, bought_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where seller_id = p_user_id),
    count(*) filter (where buyer_id = p_user_id)
  from public.deal_handovers
  where completed_at is not null and p_user_id in (seller_id, buyer_id);
$$;
grant execute on function public.get_user_deal_stats(uuid) to anon, authenticated;
