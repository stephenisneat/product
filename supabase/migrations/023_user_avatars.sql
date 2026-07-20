-- User avatars: profile column + public storage bucket.

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('user-assets', 'user-assets', true)
on conflict (id) do nothing;

-- Authenticated users can upload into their own folder: {userId}/...
create policy "user_assets_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'user-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "user_assets_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'user-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'user-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "user_assets_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'user-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "user_assets_select_public"
on storage.objects for select
to public
using (bucket_id = 'user-assets');
