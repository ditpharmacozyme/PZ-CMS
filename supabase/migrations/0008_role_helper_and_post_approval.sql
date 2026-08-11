-- Migration: 0008_role_helper_and_post_approval
-- Phase 2 of the Auth rollout: today every authenticated user has identical
-- database privileges regardless of team_members.user_role -- the Owner/
-- Manager-only checks that gate post approval are client-side only
-- (PostDetailModal.tsx) and trivially bypassed via a raw Supabase client
-- call. This adds the first real DB-level enforcement: only Owner/Manager
-- can flip a post's approved/approved_by/approved_at fields.
--
-- Safe to run any time -- posts.approved is only ever changed through the
-- app's existing PostDetailModal approve toggle, which already gates on
-- Owner/Manager client-side, so this should be a no-op for normal traffic.
-- Ordinary post edits (caption, status, assignees, etc.) are untouched --
-- the trigger only fires when approved/approved_by/approved_at actually
-- change between OLD and NEW.
--
-- ROLLBACK if anything breaks:
--   drop trigger if exists posts_enforce_approval_role on posts;
--   drop function if exists private.enforce_post_approval_role();
--   drop function if exists private.current_user_role();
-- This restores exact 0007 behavior for posts.

create schema if not exists private;

-- Returns the calling user's team_members.user_role, or NULL if their
-- session isn't linked to a team_members row yet (not-yet-logged-in
-- teammate, or no matching profile). NULL is always treated as "no
-- privilege" by every policy/trigger that calls this -- fail closed.
create or replace function private.current_user_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select tm.user_role
  from public.team_members tm
  where tm.auth_user_id = (select auth.uid())
  limit 1;
$$;

revoke execute on function private.current_user_role() from public, anon;
grant execute on function private.current_user_role() to authenticated;

create or replace function private.enforce_post_approval_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.approved    is distinct from old.approved
   or new.approved_by is distinct from old.approved_by
   or new.approved_at is distinct from old.approved_at)
     and coalesce((select private.current_user_role()), '') not in ('Owner', 'Manager') then
    raise exception 'Only Owner or Manager roles can change post approval status.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger posts_enforce_approval_role
  before update on public.posts
  for each row
  execute function private.enforce_post_approval_role();
