import React, { useState } from 'react';
import { Post } from '../../types';
import { BRANDS } from '../../data/brands';
import { getPostStatusConfig } from '../../utils/statusConfig';
import { todayStr } from '../../utils/date';
import { toggleStage, Stage } from '../../utils/stages';

interface CalendarListViewProps {
  filteredCalendarPosts: Post[];
  selectedPostIds: Set<string>;
  isSelectMode: boolean;
  bulkAssignee: string;
  onApplyBulkAssignee: (assignee: string) => void;
  uniqueAssignees: string[];
  onClearSelection: () => void;
  onSelectPost: (post: Post) => void;
  onDeletePost?: (postId: string) => void;
  onSavePost?: (post: Post) => void;
  onToggleSelect: (postId: string, e: React.MouseEvent | React.ChangeEvent) => void;
  setSelectedPostIds: (fn: (prev: Set<string>) => Set<string>) => void;
  /** Name of the person currently using the app, for *DoneBy attribution on quick toggles. */
  currentUserName?: string;
}

export const CalendarListView: React.FC<CalendarListViewProps> = ({
  filteredCalendarPosts,
  selectedPostIds,
  isSelectMode,
  bulkAssignee,
  onApplyBulkAssignee,
  uniqueAssignees,
  onClearSelection,
  onSelectPost,
  onDeletePost,
  onSavePost,
  onToggleSelect,
  setSelectedPostIds,
  currentUserName
}) => {
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
    const statusCfg = getPostStatusConfig(post);
    const isToday = post.scheduledDate === today;

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
            ? 'bg-[#f0fae8] ring-1 ring-[#296c00]'
            : isToday
            ? 'bg-white border-l-4 border-l-[#296c00] hover:bg-[#faf9f5]'
            : isPast
            ? 'bg-[#faf9f5]/80 opacity-75 hover:opacity-100 hover:bg-white'
            : 'bg-white hover:bg-[#faf9f5]'
        }`}
      >
        {/* Checkbox (desktop) */}
        <span className="hidden md:flex w-7 flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onClick={(e) => onToggleSelect(post.id, e)}
            onChange={() => {}}
            className="w-4 h-4 text-[#296c00] border-[#bfcab4] rounded focus:ring-[#296c00] cursor-pointer"
          />
        </span>

        {/* Date & Brand chip */}
        <div className="flex items-center justify-between md:block md:w-32 font-code-sm text-xs text-[#1b1c1a]">
          <div className="flex items-center gap-1.5">
            {isToday && (
              <span className="bg-[#296c00] text-white font-label-caps text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                Today
              </span>
            )}
            <span className="font-bold">
              {post.scheduledDate || 'Backlog'} {post.scheduledTime ? `(${post.scheduledTime})` : ''}
            </span>
          </div>
          <span
            className="md:hidden px-2 py-0.5 font-label-caps text-[9px] uppercase font-bold rounded text-white"
            style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
          >
            {brand?.shortCode || post.brandId}
          </span>
        </div>

        {/* Brand (desktop) */}
        <div className="hidden md:block w-28">
          <span
            className="px-2 py-0.5 font-label-caps text-[9px] uppercase font-bold rounded text-white inline-block"
            style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
          >
            {brand?.name || post.brandId}
          </span>
        </div>

        {/* Title, Caption & Quick Stage Icons */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-headline-md text-xs sm:text-sm font-bold text-[#1b1c1a] truncate">{post.title}</h4>
          </div>
          <p className="font-body-md text-xs text-[#707a67] line-clamp-1 mt-0.5">{post.caption || 'No caption'}</p>

          {/* Quick Stage Badges */}
          {post.taskRoles && (post.taskRoles.designer || post.taskRoles.publisher || post.taskRoles.engagementLead) && (
            <div className="flex items-center gap-1.5 mt-1 text-[9px]">
              {post.taskRoles.designer && (
                <button
                  type="button"
                  onClick={(e) => handleQuickStageToggle(post, 'design', e)}
                  className={`px-1.5 py-0.2 rounded cursor-pointer transition-all ${
                    post.stageCompletion?.designDone ? 'bg-[#296c00] text-white font-bold' : 'bg-[#efeeea] text-[#404a39]'
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
                    post.stageCompletion?.publishDone ? 'bg-[#296c00] text-white font-bold' : 'bg-[#efeeea] text-[#404a39]'
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
                    post.stageCompletion?.engagementDone ? 'bg-[#296c00] text-white font-bold' : 'bg-[#efeeea] text-[#404a39]'
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
            <span
              className="font-label-caps text-[10px] font-bold uppercase px-2.5 py-1 rounded-full flex items-center justify-center gap-1.5 w-fit"
              style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
              title="Updates automatically as design/publish are checked"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusCfg.color }} />
              <span>{statusCfg.label}</span>
            </span>
          </div>

          <div className="md:w-28 font-body-md text-xs text-[#404a39]">
            {post.assignees.length > 0 ? post.assignees.join(', ') : 'Unassigned'}
          </div>

          <div className="md:w-32 text-right flex items-center justify-end gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectPost(post);
              }}
              className="text-[#296c00] font-label-caps text-xs font-bold hover:bg-[#296c00] hover:text-white px-2.5 py-1 bg-[#efeeea] rounded-lg transition-colors cursor-pointer"
            >
              Edit
            </button>
            {onDeletePost && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Are you sure you want to delete post "${post.title}"?`)) {
                    onDeletePost(post.id);
                  }
                }}
                className="text-[#ba1a1a] font-label-caps text-xs font-bold hover:bg-[#ba1a1a] hover:text-white px-2 py-1 bg-[#ffdad6] rounded-lg transition-colors cursor-pointer"
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
    <div className="bg-white border border-[#e5e4de] shadow-xs rounded-xl overflow-hidden">
      {/* In-list bulk action bar */}
      {selectedPostIds.size > 0 && (
        <div className="p-3 bg-[#f0fae8] border-b border-[#296c00]/30 flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-label-caps text-xs font-bold text-[#296c00]">{selectedPostIds.size} selected</span>
          <select
            value={bulkAssignee}
            onChange={(e) => e.target.value && onApplyBulkAssignee(e.target.value)}
            className="bg-white border border-[#bfcab4] px-2 py-1.5 font-label-caps text-xs rounded-lg min-h-[36px]"
          >
            <option value="">Reassign to…</option>
            {uniqueAssignees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            onClick={onClearSelection}
            className="ml-auto text-[#707a67] font-label-caps text-xs hover:text-[#1b1c1a] px-2 py-1.5 cursor-pointer"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Column Headers (desktop) */}
      <div className="p-3 sm:p-4 bg-[#f7f6f2] border-b border-[#e5e4de] hidden md:flex items-center justify-between font-label-caps text-xs font-bold text-[#1b1c1a]">
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
      <div className="divide-y divide-[#f0eee6]">
        {todayAndUpcomingPosts.length === 0 && pastPosts.length === 0 ? (
          <div className="p-8 text-center text-xs font-body-md text-[#707a67]">
            No scheduled posts match current filters or search parameters.
          </div>
        ) : (
          todayAndUpcomingPosts.map((post) => renderPostRow(post, false))
        )}
      </div>

      {/* ── Collapsible Past Posts Section (Hidden by Default) ── */}
      {pastPosts.length > 0 && (
        <div className="border-t-2 border-[#e5e4de] bg-[#faf9f5]">
          <button
            type="button"
            onClick={() => setShowPastPosts(!showPastPosts)}
            className="w-full p-3.5 flex items-center justify-between hover:bg-[#efeeea] text-[#707a67] hover:text-[#1b1c1a] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 font-label-caps text-xs font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm transition-transform" style={{ transform: showPastPosts ? 'rotate(90deg)' : 'none' }}>
                chevron_right
              </span>
              <span>Past Scheduled Posts ({pastPosts.length})</span>
            </div>
            <span className="text-[11px] font-medium text-[#707a67]">
              {showPastPosts ? 'Click to collapse' : 'Click to show previous posts'}
            </span>
          </button>

          {showPastPosts && (
            <div className="divide-y divide-[#f0eee6] border-t border-[#e5e4de]">
              {pastPosts.map((post) => renderPostRow(post, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
