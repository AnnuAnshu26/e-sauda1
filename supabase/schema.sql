-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.

-- 1. Table that holds public profile info, separate from Supabase's built-in auth.users
--    (auth.users holds email/password and is not directly editable by your app).
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null default 'New user',
  city text,
  trust_score int not null default 50,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. Row Level Security: without this, ANY logged-in user could read/edit ANY profile.
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 3. Auto-create a profile row whenever someone signs up, so you don't have to do it
--    manually from the client (the AuthContext.tsx signUp function does this too as a
--    fallback — having both is fine, the insert will just no-op if the row already exists).
--    Also captures phone_number from signup metadata: when "Confirm email" is enabled in
--    Auth settings, signUp() returns no session until the person confirms, so the
--    client-side upsert in AuthContext.tsx skips itself (an unauthenticated request would
--    get rejected by the "insert their own profile" RLS policy above). This trigger runs
--    with security definer, so it doesn't need a session and always fires.
--    Prerequisite: phone_otp_schema.sql must be run first (it adds the phone_number column).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, phone_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'New user'),
    new.raw_user_meta_data->>'phone_number'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
