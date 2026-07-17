-- Local development seed (applied only by the Supabase CLI on `supabase start`
-- / `supabase db reset`; never applied to hosted projects via `supabase db push`).
--
-- Recent Supabase local Postgres images ship restricted default privileges: new
-- public-schema tables grant only TRUNCATE/REFERENCES/TRIGGER to the anon,
-- authenticated, and service_role API roles (not SELECT/INSERT/UPDATE/DELETE).
-- Hosted Supabase projects grant full DML by default, which is what this app's
-- migrations assume, so without this the local app fails at runtime with
-- Postgres error 42501 "permission denied for table ..." (e.g. workspace_members
-- during signup). Row access is still governed by the RLS policies in the
-- migrations; these grants only expose the tables to the API roles.

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;
grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
