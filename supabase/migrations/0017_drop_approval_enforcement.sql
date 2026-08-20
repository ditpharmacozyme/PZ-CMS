-- Migration: 0017_drop_approval_enforcement
-- Phase 5 of the UI simplification: the approval concept is removed from
-- the UI (status now auto-derives from stage checkboxes -- see
-- src/utils/postStatus.ts -- which is the real sign-off). The DB-level
-- trigger from 0008 is not just dead weight, it is actively harmful: it
-- still checks user_role not in ('Owner', 'Manager'), and 0014 renamed
-- Owner to Admin, so it now rejects every Admin who tries to change a
-- post's approved/approved_by/approved_at fields with "Only Owner or
-- Manager roles can change post approval status." Since nothing in the UI
-- writes those columns anymore, this migration just removes the trigger
-- and its function so old rows keep round-tripping without the broken
-- guard firing on unrelated updates.
--
-- The approved/approved_by/approved_at columns themselves are NOT dropped
-- (owner's decision -- zero data loss, instantly reversible, matches the
-- precedent set by the dead `assignee` column 0005 deliberately left in
-- place). Post.approved stays in src/types.ts and the storage mappers.
--
-- Do NOT drop private.current_user_role() here: 0008's own rollback
-- comment says to, but private.enforce_team_role_change() (0014) still
-- depends on it for team-role-change enforcement -- dropping it would
-- break every team-role change.

drop trigger if exists posts_enforce_approval_role on public.posts;
drop function if exists private.enforce_post_approval_role();
