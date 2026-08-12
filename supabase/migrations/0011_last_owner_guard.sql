-- Migration: 0011_last_owner_guard
-- Phase 2 of the Auth rollout, part 4: closes the one remaining gap in
-- migration 0009's team-role enforcement. The DELETE policy already blocks
-- removing any Owner row at all (user_role <> 'Owner' in its USING clause),
-- so an Owner can never be deleted via the API. The gap is the UPDATE path:
-- an Owner can demote another Owner (or themselves) to a non-Owner role via
-- the team edit form with no check for whether they're the last one --
-- which would permanently lock the studio out of every Owner-only action
-- (adding members, changing roles) with no way back in short of a manual
-- SQL fix. This closes that by extending the existing role-change trigger.
--
-- ROLLBACK: re-run migration 0009's create-or-replace of
-- private.enforce_team_role_change() to restore its prior (narrower) body.

create or replace function private.enforce_team_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_role is distinct from old.user_role
     and coalesce((select private.current_user_role()), '') <> 'Owner' then
    raise exception 'Only an Owner can change a team member''s role.'
      using errcode = '42501';
  end if;

  if old.user_role = 'Owner'
     and new.user_role is distinct from old.user_role
     and not exists (
       select 1 from public.team_members
       where user_role = 'Owner' and id <> old.id
     ) then
    raise exception 'Cannot change the role of the last remaining Owner.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
