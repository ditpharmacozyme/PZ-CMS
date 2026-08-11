-- Migration: 0007_authenticated_only_rls
-- Closes the anon-key exposure: every table currently allows the public
-- anon key (embedded in the shipped JS bundle) to read and write everything,
-- logged in or not. This swaps every policy from unscoped/anon to
-- `to authenticated`, so a real Supabase Auth session is required.
--
-- DO NOT RUN THIS until:
--   1. 0006_auth_link.sql has been applied,
--   2. all 7 teammates have Supabase Auth accounts (Dashboard -> Authentication
--      -> Users -> Add user/Invite, using their existing team_members.email),
--   3. the new email+password LoginPage/App.tsx code is deployed and every
--      teammate has confirmed they can log in successfully at least once.
-- Running this before all 7 can log in with real credentials locks everyone
-- out of the app at once, since the anon key stops working immediately.

drop policy if exists "anon full access" on posts;
create policy "authenticated full access" on posts for all to authenticated using (true) with check (true);

drop policy if exists "anon full access" on templates;
create policy "authenticated full access" on templates for all to authenticated using (true) with check (true);

drop policy if exists "anon full access" on content_bank;
create policy "authenticated full access" on content_bank for all to authenticated using (true) with check (true);

drop policy if exists "anon full access" on assets;
create policy "authenticated full access" on assets for all to authenticated using (true) with check (true);

drop policy if exists "anon full access" on team_members;
create policy "authenticated full access" on team_members for all to authenticated using (true) with check (true);

drop policy if exists "anon full access" on audit_log;
create policy "authenticated full access" on audit_log for all to authenticated using (true) with check (true);
