import React, { useRef, useState } from 'react';
import { Post, TeamMember } from '../../types';
import { BRANDS } from '../../data/brands';
import { todayStr } from '../../utils/date';
import { toggleStage, Stage } from '../../utils/stages';
import { getPostTimeConflict } from '../../utils/brandConflicts';
import { StatusChip } from '../ui/StatusChip';
import { AssigneePopover } from '../AssigneePopover';
import { useConfirm } from '../ui/ConfirmDialog';

interface CalendarListViewProps {
  filteredCalendarPosts: Post[];
  selectedPostIds: Set<string>;
  isSelectMode: boolean;
  onSelectPost: (post: Post) => void;
  onDeletePost?: (postId: string) => void;
  onSavePost?: (post: Post) => void;
  onToggleSelect: (postId: string, e: React.MouseEvent | React.ChangeEvent) => void;
  setSelectedPostIds: (fn: (prev: Set<string>) => Set<string>) => void;
  /** Name of the person currently using the app, for *DoneBy attribution on quick toggles. */
  currentUserName?: string;
  teamMembers?: TeamMember[];
  activeTeammate?: TeamMember | null;
}

export const CalendarListView: React.FC<CalendarListViewProps> = ({
  filteredCalendarPosts,
  selectedPostIds,
  isSelectMode,
  onSelectPost,
  onDeletePost,
  onSavePost,
  onToggleSelect,
  setSelectedPostIds,
  currentUserName,
  teamMembers = [],
  activeTeammate = null
}) => {
  const confirm = useConfirm();
  // Only one row's assignee popover can be open at a time, so a single Map
  // of trigger refs (keyed by post id) plus one shared popover instance
  // avoids calling hooks inside the per-row renderPostRow closure, which
  // isn't itself a component and can't hold its own state/refs.
  const assigneeTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [openAssigneePostId, setOpenAssigneePostId] = useState<string | null>(null);
  const openAssigneePost = openAssigneePostId ? filteredCalendarPosts.find((p) => p.id === openAssigneePostId) : null;
  const [showPastPosts, setShowPastPosts] = useState(false);

  const today = todayStr();

  // Partition posts into Today/Upcoming and Past
  const todayAndUpcomingPosts = filteredCalendarPosts
    .filter((p) => !p.scheduledDate || p.scheduledDate >= today)
    .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || '') || (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));

  const pastPosts = filteredCalendarPosts
    .filter((p) => p.scheduledDate && p.scheduledDate < today)
    .sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || ''));

  const allSelected = filteredCalendarPosts.length > 0 && selectedPostIds.size === filteredCalendarPosts.length;

  // Status is derived from the stages (see utils/postStatus.ts), so it's
  // display-only here -- toggling a stage is the only quick action left.
  const handleQuickStageToggle = (post: Post, stage: Stage, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSavePost) return;
    onSavePost(toggleStage(post, stage, currentUserName || 'Someone'));
  };

  const renderPostRow = (post: Post, isPast = false) => {
    const brand = BRANDS[post.brandId];
    const isSelected = selectedPostIds.has(post.id);
    const isToday = post.scheduledDate === today;
    const timeConflict = getPostTimeConflict(post, filteredCalendarPosts);

    return (
      <div
        key={post.id}
        onClick={(e) => {
          if (isSelectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
            onToggleSelect(post.id, e);
          } else {
            onSelectPost(post);
          }
        }}
        className={`p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 transition-all cursor-pointer relative ${
          isSelected
            ? 'bg-[#eef2ff] ring-1 ring-[#4f46e5]'
            : isToday
            ? 'bg-white border-l-4 border-l-[#4f46e5] hover:bg-[#f4f4f3]'
            : isPast
            ? 'bg-[#f4f4f3]/80 opacity-75 hover:opacity-100 hover:bg-white'
            : 'bg-white hover:bg-[#f4f4f3]'
        }`}
      >
        {/* Checkbox (desktop) */}
        <span className="hidden md:flex w-7 flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onClick={(e) => onToggleSelect(post.id, e)}
            onChange={() => {}}
            className="w-4 h-4 text-[#4f46e5] border-[#e9e9e7] rounded focus:ring-[#4f46e5] cursor-pointer"
          />
        </span>

        {/* Date & Brand chip */}
        <div className="flex items-center justify-between md:block md:w-36 font-code-sm text-xs text-[#1b1c1a]">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isToday && (
              <span className="bg-[#4f46e5] text-white font-label-caps text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                Today
              </span>
            )}
            <span className="font-bold">
              {post.scheduledDate || 'Backlog'} {post.scheduledTime ? `(${post.scheduledTime})` : ''}
            </span>
            {timeConflict.hasClash && (
              <span
                className="font-label-caps text-[8px] bg-[#fcebeb] text-[#dc2626] px-1 py-0.2 rounded font-bold"
                title={`Time collision with "${timeConflict.conflictingPost?.title}"`}
              >
                ⚠️ Clash
              </span>
            )}
          </div>
          <span
            className="md:hidden px-2 py-0.5 font-label-caps text-[9px] uppercase font-bold rounded text-white"
            style={{ backgroundColor: brand?.primaryColor || '#4f46e5' }}
          >
            {brand?.shortCode || post.brandId}
          </span>
        </div>

        {/* Brand (desktop) */}
        <div className="hidden md:block w-28">
          <span
            className="px-2 py-0.5 font-label-caps text-[9px] uppercase font-bold rounded text-white inline-block"
            style={{ backgroundColor: brand?.primaryColor || '#4f46e5' }}
          >
            {brand?.name || post.brandId}
          </span>
        </div>

        {/* Title, Caption & Quick Stage Icons */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-headline-md text-xs sm:text-sm font-bold text-[#1b1c1a] truncate">{post.title}</h4>
          </div>
          <p className="font-body-md text-xs text-[#5f5f5b] line-clamp-1 mt-0.5">{post.caption || 'No caption'}</p>

          {/* Quick Stage Badges */}
          {post.taskRoles && (post.taskRoles.designer || post.taskRoles.publisher || post.taskRoles.engagementLead) && (
            <div className="flex items-center gap-1.5 mt-1 text-[9px]">
              {post.taskRoles.designer && (
                <button
                  type="button"
                  onClick={(e) => handleQuickStageToggle(post, 'design', e)}
                  className={`px-1.5 py-0.2 rounded cursor-pointer transition-all ${
                    post.stageCompletion?.designDone ? 'bg-[#4f46e5] text-white font-bold' : 'bg-[#f1f1f0] text-[#57574f]'
                  }`}
                  title="Click to toggle Design done"
                >
                  🎨 {post.taskRoles.designer} {post.stageCompletion?.designDone ? '✓' : ''}
                </button>
              )}
              {post.taskRoles.publisher && (
                <button
                  type="button"
                  onClick={(e) => handleQuickStageToggle(post, 'publish', e)}
                  className={`px-1.5 py-0.2 rounded cursor-pointer transition-all ${
                    post.stageCompletion?.publishDone ? 'bg-[#4f46e5] text-white font-bold' : 'bg-[#f1f1f0] text-[#57574f]'
                  }`}
                  title="Click to toggle Publish done"
                >
                  🚀 {post.taskRoles.publisher} {post.stageCompletion?.publishDone ? '✓' : ''}
                </button>
              )}
              {post.taskRoles.engagementLead && (
                <button
                  type="button"
                  onClick={(e) => handleQuickStageToggle(post, 'engagement', e)}
                  className={`px-1.5 py-0.2 rounded cursor-pointer transition-all ${
                    post.stageCompletion?.engagementDone ? 'bg-[#4f46e5] text-white font-bold' : 'bg-[#f1f1f0] text-[#57574f]'
                  }`}
                  title="Click to toggle Engagement done"
                >
                  💬 {post.taskRoles.engagementLead} {post.stageCompletion?.engagementDone ? '✓' : ''}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status Pill (display only -- derives from the stages above) */}
        <div className="flex items-center justify-between md:contents">
          <div className="md:w-32 relative">
            <StatusChip post={post} variant="pill-dot" title="Updates automatically as design/publish are checked" />
          </div>

          <button
            type="button"
            ref={(el) => {
              if (el) assigneeTriggerRefs.current.set(post.id, el);
              else assigneeTriggerRefs.current.delete(post.id);
            }}
            onClick={(e) => { e.stopPropagation(); setOpenAssigneePostId((cur) => (cur === post.id ? null : post.id)); }}
            className="md:w-28 font-body-md text-xs text-[#57574f] text-left hover:text-[#4f46e5] hover:underline cursor-pointer truncate"
            title="Tap to assign"
          >
            {post.assignees.length > 0 ? post.assignees.join(', ') : 'Unassigned'}
          </button>

          <div className="md:w-32 text-right flex items-center justify-end gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectPost(post);
              }}
              className="text-[#4f46e5] font-label-caps text-xs font-bold hover:bg-[#4f46e5] hover:text-white px-2.5 py-1 bg-[#f1f1f0] rounded-lg transition-colors cursor-pointer"
            >
              Edit
            </button>
            {onDeletePost && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const ok = await confirm({
                    title: `Delete "${post.title}"?`,
                    body: 'This removes the post from the calendar.',
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  });
                  if (ok) onDeletePost(post.id);
                }}
                className="text-[#dc2626] font-label-caps text-xs font-bold hover:bg-[#dc2626] hover:text-white px-2 py-1 bg-[#fcebeb] rounded-lg transition-colors cursor-pointer"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-[#efefed] shadow-xs rounded-xl overflow-hidden">
      {/* Column Headers (desktop) */}
      <div className="p-3 sm:p-4 bg-[#f4f4f3] border-b border-[#efefed] hidden md:flex items-center justify-between font-label-caps text-xs font-bold text-[#1b1c1a]">
        <span className="w-7 flex-shrink-0">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelectedPostIds(
                allSelected ? () => new Set() : () => new Set(filteredCalendarPosts.map((p) => p.id))
              )
            }
            className="w-4 h-4 cursor-pointer"
          />
        </span>
        <span className="w-32">DATE & TIME</span>
        <span className="w-28">BRAND</span>
        <span className="flex-1">TITLE & CAPTION</span>
        <span className="w-32">STATUS</span>
        <span className="w-28">ASSIGNEE</span>
        <span className="w-32 text-right">ACTION</span>
      </div>

      {/* ── Today & Upcoming Posts Section (Always Shown First) ── */}
      <div className="divide-y divide-[#efefed]">
        {todayAndUpcomingPosts.length === 0 && pastPosts.length === 0 ? (
          <div className="p-8 text-center text-xs font-body-md text-[#5f5f5b]">
            No scheduled posts match current filters or search parameters.
          </div>
        ) : (
          todayAndUpcomingPosts.map((post) => renderPostRow(post, false))
        )}
      </div>

      {/* ── Collapsible Past Posts Section (Hidden by Default) ── */}
      {pastPosts.length > 0 && (
        <div className="border-t-2 border-[#efefed] bg-[#f4f4f3]">
          <button
            type="button"
            onClick={() => setShowPastPosts(!showPastPosts)}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#f1f1f0] text-[#5f5f5b] hover:text-[#1b1c1a] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 font-label-caps text-xs font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm transition-transform" style={{ transform: showPastPosts ? 'rotate(90deg)' : 'none' }}>
                chevron_right
              </span>
              <span>Past Scheduled Posts ({pastPosts.length})</span>
            </div>
            <span className="text-[11px] font-medium text-[#5f5f5b]">
              {showPastPosts ? 'Click to collapse' : 'Click to show previous posts'}
            </span>
          </button>

          {showPastPosts && (
            <div className="divide-y divide-[#efefed] border-t border-[#efefed]">
              {pastPosts.map((post) => renderPostRow(post, true))}
            </div>
          )}
        </div>
      )}

      {openAssigneePost && (
        <AssigneePopover
          post={openAssigneePost}
          teamMembers={teamMembers}
          activeTeammate={activeTeammate}
          isOpen
          onClose={() => setOpenAssigneePostId(null)}
          anchorRef={{ current: assigneeTriggerRefs.current.get(openAssigneePost.id) || null }}
          onSavePost={(updated) => onSavePost?.(updated)}
        />
      )}
    </div>
  );
};
