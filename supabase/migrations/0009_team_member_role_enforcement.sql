-- Migration: 0009_team_member_role_enforcement
-- Phase 2 of the Auth rollout, part 2: today any authenticated user can add,
-- edit, or delete any team_members row -- including promoting themselves to
-- Owner or deleting the actual Owner -- via a raw Supabase client call. This
-- locks that down to real DB-level role checks.
--
-- IMPORTANT ROLLOUT NOTE: deploy the matching client change (storage.ts's
-- linkTeamMemberAuthUser calling the new link_my_team_member RPC below,
-- instead of a raw team_members update) BEFORE or AT THE SAME TIME as this
-- migration. Once the "team_members update" policy below is live, the OLD
-- raw-update linking code would be silently rejected by RLS for anyone who
-- hasn't logged in yet -- they'd never be able to link their account.
--
-- SELECT stays open to any authenticated user -- login itself depends on
-- reading the full roster (App.tsx matches session.user.email against every
-- team_members row), so it can never be role-gated without breaking login.
--
-- ROLLBACK if anything breaks:
--   drop policy if exists "team_members select" on team_members;
--   drop policy if exists "team_members insert" on team_members;
--   drop policy if exists "team_members update" on team_members;
--   drop policy if exists "team_members delete" on team_members;
--   drop trigger if exists team_members_enforce_role_change on team_members;
--   drop function if exists private.enforce_team_role_change();
--   create policy "authenticated full access" on team_members for all to authenticated using (true) with check (true);
-- (leave link_my_team_member in place -- it's additive and narrowly scoped,
-- harmless even after a rollback)

-- Lets a just-logged-in user link their OWN team_members row using their own
-- session, bypassing the row-level policies below entirely (security definer).
-- Matches by email the same way App.tsx already does, so this can only ever
-- link the row that already represents the calling user -- never an
-- arbitrary one.
create or replace function public.link_my_team_member(p_team_member_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower((select auth.email()));
begin
  if v_uid is null then
    raise exception 'No authenticated session.' using errcode = '28000';
  end if;

  update public.team_members
  set auth_user_id = v_uid
  where id = p_team_member_id
    and auth_user_id is null
    and lower(email) = v_email;
end;
$$;

grant execute on function public.link_my_team_member(text) to authenticated;

drop policy if exists "authenticated full access" on team_members;

create policy "team_members select" on team_members
  for select to authenticated using (true);

-- Owner or Manager may add members; a Manager may only add them as Editor
-- (matches today's UI, which hardcodes new non-owner-created members to Editor).
create policy "team_members insert" on team_members
  for insert to authenticated
  with check (
    (select private.current_user_role()) in ('Owner', 'Manager')
    and (user_role = 'Editor' or (select private.current_user_role()) = 'Owner')
  );

-- Owner or Manager may edit a member, but only an Owner may touch a row that
-- is itself an Owner (so a Manager can't edit/demote the Owner).
create policy "team_members update" on team_members
  for update to authenticated
  using (
    (select private.current_user_role()) in ('Owner', 'Manager')
    and (user_role <> 'Owner' or (select private.current_user_role()) = 'Owner')
  )
  with check (
    (select private.current_user_role()) in ('Owner', 'Manager')
  );

-- Only an Owner may delete a member, and an Owner row can never be deleted
-- via this policy at all (no self-deletion, no deleting another Owner).
create policy "team_members delete" on team_members
  for delete to authenticated
  using (
    (select private.current_user_role()) = 'Owner'
    and user_role <> 'Owner'
  );

-- Closes the gap the row-level USUING check above can't catch on its own:
-- an otherwise-permitted edit (e.g. a Manager fixing someone's email) could
-- otherwise smuggle a user_role escalation through in the same UPDATE.
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
  return new;
end;
$$;

create trigger team_members_enforce_role_change
  before update on public.team_members
  for each row
  execute function private.enforce_team_role_change();
