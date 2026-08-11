-- Migration: 0006_auth_link
-- Links team_members rows to real Supabase Auth accounts, replacing the
-- client-side-only PIN system. Run this FIRST, while RLS is still open —
-- it has zero effect on current users until the app code (LoginPage/App.tsx)
-- is deployed and everyone has logged in once. Do NOT run 0007 (which
-- actually locks the anon key out) until every teammate has confirmed they
-- can sign in with their new email+password account — see the rollout
-- notes in 0007_authenticated_only_rls.sql.

alter table team_members add column if not exists auth_user_id uuid references auth.users(id);

create unique index if not exists team_members_auth_user_id_idx
  on team_members(auth_user_id) where auth_user_id is not null;
