-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/phone-otp: adds a mandatory mobile number to signup, verified via
-- a one-time code, same pattern as the vault's handover OTP.

alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists phone_verified boolean not null default false;

-- Re-point the signup trigger (originally defined in schema.sql) to also
-- capture phone_number from auth.users' raw_user_meta_data. This is
-- security definer, so it bypasses RLS and runs at the moment the
-- auth.users row is inserted -- BEFORE any client-side session exists.
-- That matters because email confirmation is enabled on this project: right
-- after supabase.auth.signUp() resolves there is no session yet (auth.uid()
-- is null until the user clicks the confirmation link), so a client-side
-- `profiles` upsert at that point is silently blocked by the
-- "auth.uid() = id" RLS policy and phone_number never gets saved. Storing
-- it here instead means it's always persisted, regardless of session state.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, phone_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'New user'),
    new.raw_user_meta_data->>'phone_number'
  )
  on conflict (id) do update
    set phone_number = coalesce(public.profiles.phone_number, excluded.phone_number);
  return new;
end;
$$ language plpgsql security definer;

create table if not exists public.phone_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  phone_number text not null,
  -- SHA-256 hex digest of the code, never the code itself -- same reasoning
  -- as vault_orders' otp_code, except here we don't even need a buyer-reveal
  -- path, so hashing (one-way) is strictly better than storing it plain.
  otp_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists phone_otps_user_idx on public.phone_otps (user_id, created_at desc);

alter table public.phone_otps enable row level security;

-- Deliberately no policies at all: this table is only ever touched by the
-- send-phone-otp / verify-phone-otp Edge Functions using the service-role
-- key, which bypasses RLS entirely. No authenticated or anon grant means a
-- client can't read a hash, guess attempts, or race the expiry -- the only
-- way to interact with this table is through those two functions.
revoke all on public.phone_otps from authenticated, anon;
