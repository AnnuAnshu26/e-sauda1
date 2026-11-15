-- Run in Supabase Dashboard -> SQL Editor. Safe to re-run (idempotent). Non-destructive: only ADDs
-- a column, tables, functions, triggers and policies.
--
-- Server-side chat risk scanning. Before this, `flagged` / `flag_reasons` were computed in the browser
-- and inserted by the client, so a modified client could skip them. Now a BEFORE INSERT trigger
-- re-computes them from the message text and OVERWRITES whatever the client sent.
--
-- Product rules (agreed with the owner):
--   * Buyers and sellers pay each other directly (cash/UPI, in person). Phone numbers and UPI IDs are
--     therefore NOT flagged by themselves.
--   * We flag what actually signals a scam: OTP/PIN requests, advance/"token" payments, QR-scan and
--     UPI "collect request" lures, phishing/shortened links, plus softer signals (bank details shared,
--     impersonation of staff).
--   * Nothing is blocked. A flagged message is delivered together with a visible warning that the
--     RECIPIENT sees, so the potential victim knows the risk. A detection is a risk signal, not proof of fraud.
--
-- Prerequisites: chat_schema.sql, chat_moderation_schema.sql, blocking_schema.sql, admin_schema.sql.

-- 1. Risk level on messages (flagged / flag_reasons already exist) --------------------------------
alter table public.messages
  add column if not exists risk_level text not null default 'low';
alter table public.messages drop constraint if exists messages_risk_level_check;
alter table public.messages
  add constraint messages_risk_level_check check (risk_level in ('low', 'medium', 'high'));

-- 2. Link allow-list (admin-editable) ------------------------------------------------------------
create table if not exists public.chat_link_allowlist (
  domain text primary key,
  note text,
  created_at timestamptz not null default now()
);
alter table public.chat_link_allowlist enable row level security;
drop policy if exists "Anyone can read the link allow-list" on public.chat_link_allowlist;
create policy "Anyone can read the link allow-list" on public.chat_link_allowlist for select using (true);
drop policy if exists "Admins manage the link allow-list" on public.chat_link_allowlist;
create policy "Admins manage the link allow-list" on public.chat_link_allowlist for all
  using (public.is_admin()) with check (public.is_admin());
-- Add your own site's domain here, e.g.:  insert into public.chat_link_allowlist(domain) values ('your-domain.com');
insert into public.chat_link_allowlist (domain, note) values
  ('google.com', 'Maps / general'),
  ('maps.app.goo.gl', 'Google Maps share links'),
  ('youtube.com', 'Video'),
  ('youtu.be', 'Video')
on conflict do nothing;

-- 3. The scanner ---------------------------------------------------------------------------------
-- Returns the highest risk level and the list of reason codes. Mirrors src/lib/moderation.ts
-- (the browser copy only powers the pre-send warning; THIS is the one that is enforced).
create or replace function public.scan_message_risk(p_body text, out risk_level text, out reasons text[])
language plpgsql
stable
set search_path = public
as $$
declare
  v_body text := lower(coalesce(p_body, ''));
  v_reasons text[] := '{}';
  v_high boolean := false;
  v_med boolean := false;
  v_url text;
  v_host text;
  v_allowed boolean;
  c_shorteners constant text[] := array['bit.ly','tinyurl.com','t.co','cutt.ly','rb.gy','is.gd','shorturl.at','tiny.cc','goo.gl','ow.ly','buff.ly','t.ly'];
begin
  -- OTP / one-time codes: asking someone to send or read one out
  if v_body ~ '\y(otp|one[ -]?time[ -]?(password|pin|code)|verification code|security code)\y.{0,40}\y(send|share|tell|give|read|forward|bata|batao|bhej|bhejo)\y'
     or v_body ~ '\y(send|share|tell|give|read|forward|bata|batao|bhej|bhejo)\y.{0,40}\y(otp|one[ -]?time[ -]?(password|pin|code)|verification code|security code)\y' then
    v_reasons := array_append(v_reasons, 'otp_request'::text); v_high := true;
  end if;

  -- UPI PIN / card secrets
  if v_body ~ '\y(upi[ -]?pin|atm[ -]?pin|card[ -]?pin|cvv|card number|net ?banking (id|password))\y' then
    v_reasons := array_append(v_reasons, 'pin_request'::text); v_high := true;
  end if;

  -- Advance / token / booking money, "pay first", "pay before you meet"
  if v_body ~ '\y(advance|token|booking|registration|processing|refundable|security|customs|insurance|verification)[ -](fee|fees|amount|payment|charge|charges|deposit|money)\y'
     or v_body ~ '\y(courier|shipping|delivery|transport)[ -](fee|fees|charge|charges)\y.{0,40}\y(first|advance|before|upfront|in advance)\y'
     or v_body ~ '\y(pay|send|transfer|give|deposit)\y.{0,30}\y(first|in advance|advance|upfront)\y'
     or v_body ~ '\y(pay|send|transfer|payment)\y.{0,30}\ybefore\y.{0,25}\y(meet|meeting|seeing|see|delivery|visit|pickup|pick up|come|coming|checking|inspect|inspection)\y'
     or v_body ~ '\y(pehle|pahle)\y.{0,15}\y(paise|payment|pay|paisa|amount)\y'
     or v_body ~ '\yadvance (de|dena|do|bhej|bhejo)\y' then
    v_reasons := array_append(v_reasons, 'advance_payment'::text); v_high := true;
  end if;

  -- QR scan lures (scanning a QR only ever SENDS money; it never receives it)
  if v_body ~ '\y(scan|scanning)\y.{0,40}\y(qr|barcode|code)\y'
     or v_body ~ '\yqr( ?code)?\y.{0,40}\y(scan|pay|payment|send|receive|refund)\y' then
    v_reasons := array_append(v_reasons, 'qr_payment'::text); v_high := true;
  end if;

  -- UPI "collect request" lure: "I'll send you a request, just accept it"
  if v_body ~ '\y(collect|payment|money|pay)[ -]request\y'
     or v_body ~ '\y(accept|approve|click|tap)\y.{0,25}\y(request|link)\y.{0,25}\y(receive|get|refund|money|payment)\y' then
    v_reasons := array_append(v_reasons, 'collect_request'::text); v_high := true;
  end if;

  -- Links
  if v_body ~ '\y(bit\.ly|tinyurl\.com|cutt\.ly|rb\.gy|is\.gd|shorturl\.at|tiny\.cc|ow\.ly|t\.ly)/\S+' then
    v_reasons := array_append(v_reasons, 'suspicious_link'::text); v_high := true;
  end if;
  for v_url, v_host in
    select m[1], m[2] from regexp_matches(v_body, '((?:https?://|www\.)([^\s/?#:]+)[^\s]*)', 'g') as m
  loop
    v_host := regexp_replace(v_host, '^www\.', '');
    select exists (select 1 from public.chat_link_allowlist a where v_host = a.domain or v_host like '%.' || a.domain)
      into v_allowed;
    if v_host = any (c_shorteners)
       or v_host ~ '^\d{1,3}(\.\d{1,3}){3}$'
       or v_host ~ 'xn--' then
      v_reasons := array_append(v_reasons, 'suspicious_link'::text); v_high := true;
    elsif not v_allowed then
      if v_url ~ '(pay|upi|kyc|verify|refund|reward|claim|bank|login|otp|prize|lottery|wallet|cashback)' then
        v_reasons := array_append(v_reasons, 'suspicious_link'::text); v_high := true;
      else
        v_reasons := array_append(v_reasons, 'external_link'::text); v_med := true;
      end if;
    end if;
  end loop;

  -- Softer signals ------------------------------------------------------------------------------
  -- A UPI handle together with a pay/send verb ("pay me on abc@ybl"). A UPI ID alone is fine: people
  -- legitimately pay by UPI when they meet.
  if v_body ~ '[a-z0-9._-]{2,}@(ok(hdfcbank|icici|sbi|axis)|ybl|ibl|axl|apl|paytm|upi|sbi|hdfcbank|icici|axisbank|pnb|kotak|idfcbank|fbl|ikwik|airtel|jupiter|slice|freecharge|postbank|yesbank|indus|rbl|barodampay|aubank|cnrb|boi|unionbank|dbs|federal)\y'
     and v_body ~ '\y(pay|send|transfer|gpay|phonepe|paytm|upi|bhej|bhejo)\y'
     -- paying in person is the normal flow here, so don't nag when the context is a meetup
     and v_body !~ '\y(meet|meeting|in person|cash|pickup|pick up|on delivery|after (seeing|checking|inspecting))\y' then
    v_reasons := array_append(v_reasons, 'payment_details'::text); v_med := true;
  end if;

  -- IFSC code, or an account number given as such
  if v_body ~ '\y[a-z]{4}0[a-z0-9]{6}\y'
     or v_body ~ '\y(a/?c|account)[ .]*(no|number|num|#)?[ .:-]*\d{9,18}\y' then
    v_reasons := array_append(v_reasons, 'bank_details'::text); v_med := true;
  end if;

  -- Pretending to be e-Sauda / a marketplace / a bank / police
  if v_body ~ '\y(e-?sauda|olx|amazon|flipkart|paytm|phonepe|gpay)[ -](support|team|official|admin|executive|agent|customer care|representative)\y'
     or v_body ~ '\y(customer care|support team|bank manager|cyber cell|cyber police|rbi officer)\y'
     or v_body ~ '\y(i am|i''m|this is|we are)\y.{0,20}\y(from|with|calling from)\y.{0,15}\y(e-?sauda|olx|amazon|flipkart|the bank|rbi|police)\y' then
    v_reasons := array_append(v_reasons, 'impersonation'::text); v_med := true;
  end if;

  reasons := (select coalesce(array_agg(distinct r order by r), '{}') from unnest(v_reasons) as r);
  risk_level := case when v_high then 'high' when v_med then 'medium' else 'low' end;
end;
$$;

-- Short, redacted excerpt for audit logs: digits runs, UPI-style handles and links are masked so the
-- log never keeps payment details or personal identifiers.
create or replace function public.redact_for_log(p_body text)
returns text
language sql
immutable
as $$
  select left(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_body, ''), '(https?://|www\.)\S+', '[link]', 'gi'),
        '[a-z0-9._-]+@[a-z]+', '[id]', 'gi'),
      '\d{4,}', '[number]', 'g'),
    160);
$$;

-- 4. Audit trail ----------------------------------------------------------------------------------
create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages on delete set null,
  conversation_id uuid references public.conversations on delete set null,
  sender_id uuid references auth.users on delete set null,
  risk_level text not null check (risk_level in ('medium', 'high')),
  reasons text[] not null default '{}',
  excerpt text,                                   -- redacted; never the raw message
  escalated boolean not null default false,       -- sender tripped repeated high-risk flags
  appeal_status text not null default 'none' check (appeal_status in ('none', 'requested', 'upheld', 'overturned')),
  appeal_note text,
  appeal_at timestamptz,
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists moderation_events_created_idx on public.moderation_events (created_at desc);
create index if not exists moderation_events_sender_idx on public.moderation_events (sender_id, created_at desc);
create unique index if not exists moderation_events_message_uidx on public.moderation_events (message_id);

alter table public.moderation_events enable row level security;
drop policy if exists "Admins can view moderation events" on public.moderation_events;
create policy "Admins can view moderation events" on public.moderation_events for select using (public.is_admin());
revoke insert, update, delete on public.moderation_events from anon, authenticated;

-- Admins may read the *full* text of a message only while its sender's appeal is open.
drop policy if exists "Admins can read messages under appeal" on public.messages;
create policy "Admins can read messages under appeal" on public.messages for select
  using (
    public.is_admin()
    and exists (select 1 from public.moderation_events e where e.message_id = messages.id and e.appeal_status = 'requested')
  );

-- 5. Trigger: rate limit + scan (BEFORE INSERT) -----------------------------------------------------
-- Name sorts after on_message_check_blocked, so blocked users are rejected first.
create or replace function public.scan_and_limit_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scan record;
  v_recent int;
begin
  if length(new.body) > 2000 then
    raise exception 'Message is too long (max 2000 characters)' using errcode = '22001';
  end if;

  select count(*) into v_recent from public.messages
  where sender_id = new.sender_id and created_at > now() - interval '60 seconds';
  if v_recent >= 30 then
    raise exception 'You are sending messages too quickly. Please wait a moment.' using errcode = '54000';
  end if;

  select * into v_scan from public.scan_message_risk(new.body);
  new.risk_level := v_scan.risk_level;
  new.flagged := v_scan.risk_level <> 'low';
  new.flag_reasons := v_scan.reasons;
  return new;
end;
$$;
drop trigger if exists on_message_scan_risk on public.messages;
create trigger on_message_scan_risk
  before insert on public.messages
  for each row execute procedure public.scan_and_limit_message();

-- 6. Trigger: audit + escalation (AFTER INSERT) -------------------------------------------------------
create or replace function public.log_message_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_highs int;
begin
  if new.risk_level = 'low' then return new; end if;

  select count(*) into v_highs from public.moderation_events
  where sender_id = new.sender_id and risk_level = 'high' and created_at > now() - interval '24 hours';

  insert into public.moderation_events (message_id, conversation_id, sender_id, risk_level, reasons, excerpt, escalated)
  values (new.id, new.conversation_id, new.sender_id, new.risk_level, new.flag_reasons,
          public.redact_for_log(new.body),
          new.risk_level = 'high' and v_highs + 1 >= 3)
  on conflict (message_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_message_log_risk on public.messages;
create trigger on_message_log_risk
  after insert on public.messages
  for each row execute procedure public.log_message_risk();

-- 7. Appeals (false-positive handling) ---------------------------------------------------------------
create or replace function public.appeal_message_flag(p_message_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.moderation_events
  set appeal_status = 'requested', appeal_note = left(coalesce(p_note, ''), 500), appeal_at = now()
  where message_id = p_message_id and sender_id = auth.uid() and appeal_status = 'none';
  if not found then
    raise exception 'Nothing to appeal for this message' using errcode = 'P0002';
  end if;
end;
$$;
grant execute on function public.appeal_message_flag(uuid, text) to authenticated;

create or replace function public.review_moderation_event(p_event_id uuid, p_outcome text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_outcome not in ('upheld', 'overturned') then raise exception 'Invalid outcome'; end if;
  update public.moderation_events
  set appeal_status = p_outcome, reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(coalesce(p_note, ''), 500)
  where id = p_event_id;
end;
$$;
grant execute on function public.review_moderation_event(uuid, text, text) to authenticated;
