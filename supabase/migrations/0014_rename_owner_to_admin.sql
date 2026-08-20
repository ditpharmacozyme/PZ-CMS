-- Migration: Rename Owner role to Admin
-- Updates any existing team_members that have the 'Owner' user_role to 'Admin'
--
-- ROOT-CAUSE NOTE (added after this migration was found to abort on first
-- run): the role-change guard trigger installed in 0009/0011 calls
-- private.enforce_team_role_change() -- this migration originally tried to
-- update that logic but wrote CREATE OR REPLACE FUNCTION
-- public.enforce_team_role_change() (wrong schema), which created a dead,
-- never-wired function while the real private-schema one kept its old
-- 'Owner'-only check. The UPDATE below changes every row's user_role, which
-- fires that guard; run from the SQL editor (no authenticated session)
-- current_user_role() is null, so the guard always rejected it and this
-- migration aborted before creating anything -- which is also why 0015/0016
-- (including the get_due_reminders/mark_reminder_sent RPCs the email
-- reminder trigger depends on) never got applied. Fixed by disabling the
-- guard trigger for just this bulk rename, and by correctly replacing
-- private.enforce_team_role_change() (not a stray public copy) so future
-- role changes check for 'Admin' instead of a role string nothing can ever
-- match again post-rename.

alter table public.team_members disable trigger team_members_enforce_role_change;

UPDATE public.team_members
SET user_role = 'Admin'
WHERE user_role = 'Owner';

alter table public.team_members enable trigger team_members_enforce_role_change;

-- Replace the guard the trigger actually calls (private schema, matches
-- 0009/0011) so it checks for 'Admin' instead of 'Owner', keeping 0011's
-- last-remaining-role guard.
create or replace function private.enforce_team_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_role is distinct from old.user_role
     and coalesce((select private.current_user_role()), '') <> 'Admin' then
    raise exception 'Only an Admin can change a team member''s role.'
      using errcode = '42501';
  end if;

  if old.user_role = 'Admin'
     and new.user_role is distinct from old.user_role
     and not exists (
       select 1 from public.team_members
       where user_role = 'Admin' and id <> old.id
     ) then
    raise exception 'Cannot change the role of the last remaining Admin.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- And update the prevent_last_owner_deletion trigger function
CREATE OR REPLACE FUNCTION public.prevent_last_admin_deletion()
RETURNS trigger AS $$
DECLARE
  admin_count int;
BEGIN
  IF OLD.user_role = 'Admin' THEN
    SELECT count(*) INTO admin_count FROM public.team_members WHERE user_role = 'Admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Permission denied: Cannot delete the last Admin';
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger, create new one
DROP TRIGGER IF EXISTS ensure_one_owner_remains ON public.team_members;
DROP TRIGGER IF EXISTS ensure_one_admin_remains ON public.team_members;

CREATE TRIGGER ensure_one_admin_remains
  BEFORE DELETE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_admin_deletion();
