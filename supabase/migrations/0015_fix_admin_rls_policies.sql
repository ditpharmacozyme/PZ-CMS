-- Migration: 0015_fix_admin_rls_policies
-- 0014 renamed the Owner role to Admin in team_members data and in the two
-- trigger functions (enforce_team_role_change, prevent_last_admin_deletion),
-- but missed the RLS policies that 0009 created directly on team_members
-- (team_members insert / update / delete), which still hardcode the literal
-- 'Owner' string. Since no row can have user_role = 'Owner' anymore, those
-- policies now reject every real Admin/Manager -- e.g. upsertRemoteTeamMember
-- (src/utils/storage.ts), used by the team-edit UI to save role/name/color
-- changes, silently fails RLS for everyone.
--
-- ROLLBACK: re-run migration 0009's policy definitions verbatim (they used
-- 'Owner' instead of 'Admin').

drop policy if exists "team_members insert" on team_members;
drop policy if exists "team_members update" on team_members;
drop policy if exists "team_members delete" on team_members;

create policy "team_members insert" on team_members
  for insert to authenticated
  with check (
    (select private.current_user_role()) in ('Admin', 'Manager')
    and (user_role = 'Editor' or (select private.current_user_role()) = 'Admin')
  );

create policy "team_members update" on team_members
  for update to authenticated
  using (
    (select private.current_user_role()) in ('Admin', 'Manager')
    and (user_role <> 'Admin' or (select private.current_user_role()) = 'Admin')
  )
  with check (
    (select private.current_user_role()) in ('Admin', 'Manager')
  );

create policy "team_members delete" on team_members
  for delete to authenticated
  using (
    (select private.current_user_role()) = 'Admin'
    and user_role <> 'Admin'
  );
