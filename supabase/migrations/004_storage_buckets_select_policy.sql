-- Storage API looks up buckets as the caller's role (anon/authenticated).
-- RLS is enabled on storage.buckets with no default SELECT policy, so clients
-- get "Bucket not found" even when the row exists (Studio uses service_role).
create policy "buckets_select_public"
on storage.buckets for select
to public
using (true);
