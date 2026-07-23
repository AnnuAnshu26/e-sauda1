-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/phone-otp: adds a mandatory mobile number to signup, verified via
-- a one-time code, same pattern as the vault's handover OTP.

alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists phone_verified boolean not null default false;

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
