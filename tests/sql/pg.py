"""Tiny Postgres harness: boots an embedded Postgres, stubs the Supabase bits
(auth schema, auth.uid(), roles, realtime publication) and applies this repo's
real migration files in order, so new migrations are tested against the real schema."""
import os, re, pgserver, tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
STUB = """
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime; end if;
end $$;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create or replace function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
-- NOTE: no migration in the repo creates `profiles` (it was made by hand in the dashboard), so the
-- harness stubs it with the columns the app reads.
create table if not exists public.profiles (id uuid primary key references auth.users on delete cascade,
  display_name text, city text, trust_score int default 50, verified boolean default false,
  rating_avg numeric, rating_count int default 0, is_admin boolean not null default false, suspended boolean not null default false);
"""
BASE_FILES = ['schema.sql','listings_schema.sql','image_upload_schema.sql','video_upload_schema.sql',
  'listing_geolocation_schema.sql','ar_dimensions_schema.sql','chat_schema.sql','chat_moderation_schema.sql',
  'blocking_schema.sql','notifications_schema.sql','notifications_type_check_fix.sql','reports_schema.sql','admin_schema.sql']

def boot():
    d = tempfile.mkdtemp(prefix='pgtest_')
    srv = pgserver.get_server(d, cleanup_mode='delete')
    srv.psql(STUB)
    # pgcrypto isn't bundled with the embedded server; gen_random_uuid() is built in since PG13.
    return srv

def apply(srv, name, strict=True):
    sql = open(os.path.join(REPO,'supabase',name)).read()
    sql = re.sub(r'create extension if not exists pgcrypto;?', '', sql, flags=re.I)
    try:
        srv.psql(sql)
    except Exception as e:
        if strict: raise RuntimeError(f'{name}: {e}')
        print('WARN', name, str(e)[:200])

def boot_with_base(extra=()):
    srv = boot()
    for f in BASE_FILES: apply(srv, f, strict=False)
    for f in extra: apply(srv, f)
    return srv

if __name__ == '__main__':
    s = boot_with_base()
    print(s.psql("select count(*) from information_schema.tables where table_schema='public'"))
