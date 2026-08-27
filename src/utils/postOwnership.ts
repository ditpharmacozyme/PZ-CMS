import { Post, TeamMember } from '../types';

/**
 * True when this teammate is meaningfully attached to a post -- either a
 * plain assignee, or named in one of the specialized taskRoles slots
 * (designer/publisher/engagementLead). Assignees-only matching hid an
 * entire category of work: someone who is only the 🎨 Designer on a post
 * (never added to `assignees`) never showed up as "theirs" anywhere in the
 * app. Every cross-cutting "is this mine" check -- the calendar's My Posts
 * chip, the dashboard's per-person filter, My Work -- should go through
 * this instead of re-deriving it.
 */
export function isMine(post: Post, teammate: TeamMember | null | undefined): boolean {
  if (!teammate) return false;
  const name = teammate.name;
  if (post.assignees.includes(name)) return true;
  const roles = post.taskRoles;
  if (!roles) return false;
  return roles.designer === name || roles.publisher === name || roles.engagementLead === name;
}

/**
 * Comma-joined, de-duplicated email addresses for a list of assignee names --
 * the reminder-email auto-fill formula. Was copy-pasted identically in
 * NewPostModal and PostDetailModal; both now call this instead.
 */
export function combineAssigneeEmails(names: string[], teamMembers: TeamMember[]): string {
  const emails = names
    .map((name) => teamMembers.find((tm) => tm.name === name)?.email)
    .filter((e): e is string => Boolean(e && e.trim()));
  return Array.from(new Set(emails)).join(', ');
}
