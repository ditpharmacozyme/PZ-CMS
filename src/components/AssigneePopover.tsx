import React from 'react';
import { Post, TeamMember } from '../types';
import { Popover } from './ui/Popover';
import { combineAssigneeEmails } from '../utils/postOwnership';
import { logTimestamp } from '../utils/date';

/**
 * Fast inline assignment -- sets `assignees[]` (general ownership) and all
 * three `taskRoles` slots (designer/publisher/engagementLead) from a single
 * anchored popover, saving on every tap instead of requiring the 909-line
 * PostDetailModal + its "Save Changes" button.
 *
 * This directly closes the gap that made a freshly created post have zero
 * one-click controls anywhere: PostCard/CalendarListView/MobileDateStripView
 * only render their quick stage-toggle chips once a taskRoles slot is set
 * (see PostCard.tsx's quick-toggle buttons), and until now the *only* place
 * that could ever be set was PostDetailModal's three native <select>s. New
 * posts deliberately ship with empty taskRoles (see NewPostModal.tsx -- the
 * role selects were intentionally removed from creation in a prior phase
 * because they fed fields nothing used until post-creation), so this popover
 * is the fast path meant to fill that gap afterward, not a replacement for
 * that decision.
 *
 * Assignees and task roles stay independent controls here, matching
 * PostDetailModal's existing semantics (checking someone as an assignee
 * doesn't touch taskRoles, and vice versa) -- this only changes how fast
 * they are to set, not what they mean.
 */

export type AssigneeRole = 'designer' | 'publisher' | 'engagementLead';

const ROLE_EMOJI: Record<AssigneeRole, string> = { designer: '🎨', publisher: '🚀', engagementLead: '💬' };
const ROLE_TITLE: Record<AssigneeRole, string> = { designer: 'Designer', publisher: 'Publisher', engagementLead: 'Engagement' };
const ROLE_ORDER: AssigneeRole[] = ['designer', 'publisher', 'engagementLead'];

export interface AssigneePopoverProps {
  post: Post;
  teamMembers: TeamMember[];
  activeTeammate: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  onSavePost: (post: Post) => void;
}

export const AssigneePopover: React.FC<AssigneePopoverProps> = ({
  post,
  teamMembers,
  activeTeammate,
  isOpen,
  onClose,
  anchorRef,
  onSavePost,
}) => {
  const actorName = activeTeammate ? activeTeammate.name : (post.assignees[0] || 'Someone');

  const toggleAssignee = (name: string) => {
    const checked = post.assignees.includes(name);
    const nextAssignees = checked ? post.assignees.filter((n) => n !== name) : [...post.assignees, name];
    const combined = combineAssigneeEmails(nextAssignees, teamMembers);
    onSavePost({
      ...post,
      assignees: nextAssignees,
      reminderEmail: combined || post.reminderEmail,
      activityLog: [
        {
          id: `act-${Date.now()}-assignee`,
          actor: actorName,
          action: `Reassigned to ${nextAssignees.length > 0 ? nextAssignees.join(', ') : 'Unassigned'}`,
          timestamp: logTimestamp(),
        },
        ...post.activityLog,
      ],
    });
  };

  const toggleRole = (role: AssigneeRole, name: string) => {
    const isHolder = post.taskRoles?.[role] === name;
    onSavePost({
      ...post,
      taskRoles: { ...post.taskRoles, [role]: isHolder ? undefined : name },
    });
  };

  return (
    <Popover isOpen={isOpen} onClose={onClose} anchorRef={anchorRef} ariaLabel="Assign people and roles" className="w-72">
      <div className="p-2.5 border-b border-[var(--color-line-subtle)]">
        <p className="font-label-caps text-[10px] font-bold text-[var(--color-ink-muted)]">Assign &amp; roles</p>
      </div>

      {teamMembers.length === 0 ? (
        <p className="p-3 text-[11px] font-body-md text-[var(--color-ink-muted)] italic">
          Add people in Settings → Team to assign this post.
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-line-subtle)]">
          {teamMembers.map((m) => {
            const isAssignee = post.assignees.includes(m.name);
            return (
              <div key={m.id} className="flex items-center gap-2 p-2 hover:bg-[var(--color-muted)] transition-colors">
                <button
                  type="button"
                  onClick={() => toggleAssignee(m.name)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer min-h-[36px]"
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.avatarInitials}
                  </span>
                  <span className="font-body-md text-[12px] text-[var(--color-ink)] truncate">{m.name}</span>
                </button>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {ROLE_ORDER.map((role) => {
                    const isHolder = post.taskRoles?.[role] === m.name;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleRole(role, m.name); }}
                        title={`${ROLE_TITLE[role]}${isHolder ? ' (tap to unassign)' : ''}`}
                        className={`w-7 h-7 rounded flex items-center justify-center text-sm transition-colors cursor-pointer ${
                          isHolder ? 'bg-[var(--color-accent-soft)] ring-1 ring-[var(--color-accent)]' : 'hover:bg-[var(--color-muted)] opacity-50 hover:opacity-100'
                        }`}
                      >
                        {ROLE_EMOJI[role]}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="checkbox"
                  checked={isAssignee}
                  onChange={() => toggleAssignee(m.name)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-3.5 h-3.5 text-[var(--color-accent)] border-[var(--color-line)] rounded flex-shrink-0 cursor-pointer"
                  aria-label={`Assign ${m.name}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </Popover>
  );
};
