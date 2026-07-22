-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/mandatory-video: sellers now must attach a short video showing the actual
-- item (not just static photos) before publishing a NEW listing. Mirrors
-- image_upload_schema.sql's storage pattern exactly, just for video files and a
-- single-file column instead of an array.
--
-- Existing listings created before this feature keep video_url = null -- there's no
-- way to retroactively force a video onto something already posted, so this is only
-- enforced going forward, in the Sell wizard itself (see Sell.tsx's Next-button
-- validation), not by a NOT NULL constraint here.

alter table public.listings
  add column if not exists video_url text;

insert into storage.buckets (id, name, public)
values ('listing-videos', 'listing-videos', true)
on conflict (id) do nothing;

create policy "Anyone can view listing videos"
  on storage.objects for select
  using (bucket_id = 'listing-videos');

create policy "Users can upload videos into their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own listing videos"
  on storage.objects for delete
  using (
    bucket_id = 'listing-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
