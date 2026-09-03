import React, { useEffect, useRef, useState } from 'react';
import { Post, TeamMember } from '../../types';
import { useBrands } from '../../context/BrandsContext';
import { fromDateStr, visibleStripDates } from '../../utils/date';
import { toggleStage, Stage } from '../../utils/stages';
import { getDayBrandSummary } from '../../utils/brandConflicts';
import { StatusChip } from '../ui/StatusChip';
import { AssigneePopover } from '../AssigneePopover';

interface CalendarCell {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
}

interface MobileDateStripViewProps {
  calendarCells: CalendarCell[];
  postsByDate: Record<string, any[]>;
  todayIso: string;
  selectedMobileDate: string;
  onSelectMobileDate: (dateStr: string) => void;
  onOpenNewPostModal: (date?: string) => void;
  onSelectPost: (post: Post) => void;
  selectedPostIds: Set<string>;
  isSelectMode: boolean;
  onToggleSelect: (postId: string, e?: React.MouseEvent) => void;
  onLongPressPost: (postId: string) => void;
  teamMembers: TeamMember[];
  onSavePost?: (post: Post) => void;
  /** Name of the person currently using the app, for *DoneBy attribution on quick toggles. */
  currentUserName?: string;
  /** Touch-drag-to-reschedule -- lets a day-list post be dragged onto one of
   * the date strip buttons above it. Mirrors the desktop HTML5 drag path;
   * without these the strip's date buttons have no drop target and touch
   * users have no way to reschedule except opening the post and editing the
   * date field. `touchDraggedPostId`/`touchHoverDate` come from CalendarView's
   * own drag state (shared with IdeaBacklog's touch-drag) so a date-strip
   * button can show a hover highlight while something is being dragged onto it. */
  touchDraggedPostId?: string | null;
  touchHoverDate?: string | null;
  onTouchStart?: (postId: string) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  activeTeammate?: TeamMember | null;
}

export const MobileDateStripView: React.FC<MobileDateStripViewProps> = ({
  calendarCells,
  postsByDate,
  todayIso,
  selectedMobileDate,
  onSelectMobileDate,
  onOpenNewPostModal,
  onSelectPost,
  selectedPostIds,
  isSelectMode,
  onToggleSelect,
  onLongPressPost,
  teamMembers,
  onSavePost,
  currentUserName,
  touchDraggedPostId,
  touchHoverDate,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  activeTeammate = null
}) => {
  const handleQuickStageToggle = (post: Post, stage: Stage, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSavePost) return;
    onSavePost(toggleStage(post, stage, currentUserName || 'Someone'));
  };

  // Same single-shared-popover pattern as CalendarListView -- the day list
  // below is a plain .map(), not per-item components, so hooks can't live
  // inside each row's render.
  const assigneeTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [openAssigneePostId, setOpenAssigneePostId] = useState<string | null>(null);
  const { brands } = useBrands();

  const selectedDayPosts = postsByDate[selectedMobileDate] || [];
  const selectedDaySummary = getDayBrandSummary(selectedDayPosts, brands);

  // When this strip is showing the month/week that contains today, open on
  // today and drop the earlier days -- a past date in the strip only invites
  // scheduling into the past by mistake.
  const hidePastDays = calendarCells.some((c) => c.dateStr === todayIso);
  const stripCells = visibleStripDates(calendarCells, todayIso, hidePastDays);

  // If the selection was left on a now-hidden past day (e.g. navigated away and
  // back), snap it forward to today so the day list below stays in range.
  useEffect(() => {
    if (hidePastDays && selectedMobileDate < todayIso) onSelectMobileDate(todayIso);
  }, [hidePastDays, selectedMobileDate, todayIso, onSelectMobileDate]);

  return (
    <div className="md:hidden flex flex-col">
      {/* Horizontal Date Strip */}
      <div className="flex overflow-x-auto bg-[#f1f1f0] border-b border-[#e9e9e7] p-2 gap-2 hide-scrollbar">
        {stripCells
          .map((cell) => {
            const d = cell.dateStr ? fromDateStr(cell.dateStr) : null;
            const dayShort = d ? d.toLocaleDateString('default', { weekday: 'short' }) : '';
            const dayNum = d ? d.getDate() : '';
            const isSelected = cell.dateStr === selectedMobileDate;
            const isToday = cell.dateStr === todayIso;
            const isDropHover = !!touchDraggedPostId && touchHoverDate === cell.dateStr;
            const dayPosts = cell.dateStr ? postsByDate[cell.dateStr] || [] : [];
            const summary = getDayBrandSummary(dayPosts, brands);

            return (
              <button
                key={cell.dateStr}
                data-date-cell={cell.dateStr || ''}
                onClick={() => onSelectMobileDate(cell.dateStr!)}
                className={`flex flex-col items-center justify-center min-w-[3.5rem] py-2 rounded-lg transition-colors relative flex-shrink-0 ${
                  isDropHover
                    ? 'bg-[#4f46e5] text-white ring-2 ring-[#4f46e5] ring-offset-1 scale-105'
                    : isSelected
                    ? 'bg-[#4f46e5] text-white shadow-xs'
                    : isToday
                    ? 'bg-white border border-[#4f46e5] text-[#4f46e5]'
                    : 'bg-white border border-[#e9e9e7] text-[#1b1c1a]'
                }`}
              >
                <span className="font-label-caps text-[9px] font-bold opacity-80">{dayShort}</span>
                <span className="font-headline-md text-base font-bold mt-0.5">{dayNum}</span>

                {/* Brand Color Dots below date */}
                {summary.distinctBrandIds.length > 0 && (
                  <div className="flex items-center gap-0.5 mt-1">
                    {summary.distinctBrandIds.map((bId) => (
                      <span
                        key={bId}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: brands[bId]?.primaryColor || '#4f46e5' }}
                      />
                    ))}
                  </div>
                )}

                {dayPosts.length > 0 && (
                  <div
                    className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center font-label-caps text-[8px] font-bold ${
                      isSelected ? 'bg-white text-[#4f46e5]' : 'bg-[#4f46e5] text-white'
                    }`}
                  >
                    {dayPosts.length}
                  </div>
                )}
              </button>
            );
          })}
      </div>

      {/* Selected Day Posts List */}
      <div className="p-3 sm:p-4 bg-[#f4f4f3]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-headline-md text-lg font-bold text-[#1b1c1a]">
            {fromDateStr(selectedMobileDate).toLocaleDateString('default', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </h3>
          <button
            onClick={() => onOpenNewPostModal(selectedMobileDate)}
            className="flex items-center gap-1 text-[#4f46e5] font-label-caps text-xs font-bold bg-[#eef2ff] px-3 py-1.5 rounded-full hover:bg-[#eef2ff] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Post
          </button>
        </div>

        {/* Multi-Brand / Time Clash Alert Banner on Mobile */}
        {selectedDaySummary.hasCollision && (
          <div className="mb-3 p-2.5 rounded-lg bg-white border border-[#e9e9e7] flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-label-caps text-[10px] font-bold text-[#4f46e5] bg-[#eef2ff] px-1.5 py-0.5 rounded">
                {selectedDaySummary.brandCount} Brands
              </span>
              <p className="text-xs text-[#57574f] truncate">
                {selectedDaySummary.brandNames.join(' • ')}
              </p>
            </div>
            {selectedDaySummary.timeClashes.length > 0 && (
              <span className="text-[10px] font-label-caps font-bold text-[#dc2626] bg-[#fcebeb] px-2 py-0.5 rounded whitespace-nowrap">
                ⚠️ Time Conflict
              </span>
            )}
          </div>
        )}

        {(() => {
          const dayPosts = selectedDayPosts;
          if (dayPosts.length === 0) {
            return (
              <div className="text-center py-10 text-[#5f5f5b] bg-white border border-[#e9e9e7] rounded-lg">
                <span className="material-symbols-outlined text-3xl mb-2 opacity-50">calendar_today</span>
                <p className="font-body-md text-sm">No posts scheduled</p>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {dayPosts.map((post: Post) => {
                const brand = brands[post.brandId];
                const primaryAssignee = post.assignees[0] || '';
                const assigneeMember = teamMembers.find((m) => m.name === primaryAssignee);
                const initials = assigneeMember
                  ? assigneeMember.avatarInitials
                  : (primaryAssignee || '?')
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);
                const bgColor = assigneeMember ? assigneeMember.color : '#e9e9e7';
                const extraAssignees = post.assignees.length - 1;
                const isMobileSelected = selectedPostIds.has(post.id);

                return (
                  <div
                    key={post.id}
                    onTouchStart={(e) => {
                      // Two gestures share this row: hold-still selects (long-press
                      // timer below, unchanged), hold-and-drag reschedules onto a
                      // date strip button above (relayed to CalendarView's shared
                      // touch-drag state). They don't conflict -- dragging the
                      // finger up onto a strip button only ever sets touchHoverDate
                      // if it actually crosses one, so a plain tap or a still
                      // long-press never touches the reschedule path.
                      onTouchStart?.(post.id);
                      const timer = setTimeout(() => {
                        onLongPressPost(post.id);
                      }, 500);
                      (e.currentTarget as any).dataset.longPressTimer = timer.toString();
                    }}
                    onTouchEnd={(e) => {
                      const timer = (e.currentTarget as any).dataset.longPressTimer;
                      if (timer) clearTimeout(parseInt(timer));
                      onTouchEnd?.(e);
                    }}
                    onTouchMove={(e) => {
                      const timer = (e.currentTarget as any).dataset.longPressTimer;
                      if (timer) clearTimeout(parseInt(timer));
                      onTouchMove?.(e);
                    }}
                    onClick={(e) => {
                      if (isSelectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
                        onToggleSelect(post.id, e);
                      } else {
                        onSelectPost(post);
                      }
                    }}
                    style={{ borderLeftColor: brand?.primaryColor }}
                    className={`flex items-start gap-3 p-3 border border-l-4 rounded-lg shadow-2xs active:scale-[0.98] transition-transform cursor-pointer ${
                      isMobileSelected ? 'bg-[#eef2ff] ring-2 ring-[#4f46e5] border-[#4f46e5]' : 'bg-white border-[#e9e9e7]'
                    }`}
                  >
                    {(isSelectMode || selectedPostIds.size > 0) && (
                      <input
                        type="checkbox"
                        checked={isMobileSelected}
                        onChange={() => onToggleSelect(post.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 mt-1 text-[#4f46e5] border-[#e9e9e7] rounded flex-shrink-0"
                      />
                    )}

                    {post.visualUrl && (
                      <div className="w-14 h-14 mt-0.5 rounded overflow-hidden border border-[#e9e9e7] bg-[#f4f4f3] flex-shrink-0">
                        <img src={post.visualUrl} alt={post.title} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <span className="font-label-caps text-[9px] font-bold" style={{ color: brand?.primaryColor }}>
                        {brand?.name} • {post.scheduledTime}
                      </span>
                      <p className="font-headline-md text-sm font-bold text-[#1b1c1a] leading-tight mb-1">
                        {post.title}
                      </p>

                      {/* Status Badge */}
                      <StatusChip post={post} variant="pill-icon" />

                      {/* Task Role Badges */}
                      {post.taskRoles &&
                        (post.taskRoles.designer || post.taskRoles.publisher || post.taskRoles.engagementLead) && (
                          <div className="flex flex-wrap gap-1 mt-2 text-[9px] font-label-caps">
                            {post.taskRoles.designer && (
                              <button
                                type="button"
                                onClick={(e) => handleQuickStageToggle(post, 'design', e)}
                                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                                  post.stageCompletion?.designDone ? 'bg-[#4f46e5] text-white' : 'bg-[#f1f1f0] text-[#57574f]'
                                }`}
                              >
                                🎨 {post.taskRoles.designer}
                              </button>
                            )}
                            {post.taskRoles.publisher && (
                              <button
                                type="button"
                                onClick={(e) => handleQuickStageToggle(post, 'publish', e)}
                                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                                  post.stageCompletion?.publishDone ? 'bg-[#4f46e5] text-white' : 'bg-[#f1f1f0] text-[#57574f]'
                                }`}
                              >
                                🚀 {post.taskRoles.publisher}
                              </button>
                            )}
                            {post.taskRoles.engagementLead && (
                              <button
                                type="button"
                                onClick={(e) => handleQuickStageToggle(post, 'engagement', e)}
                                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                                  post.stageCompletion?.engagementDone ? 'bg-[#4f46e5] text-white' : 'bg-[#f1f1f0] text-[#57574f]'
                                }`}
                              >
                                💬 {post.taskRoles.engagementLead}
                              </button>
                            )}
                          </div>
                        )}
                    </div>

                    <button
                      type="button"
                      ref={(el) => {
                        if (el) assigneeTriggerRefs.current.set(post.id, el);
                        else assigneeTriggerRefs.current.delete(post.id);
                      }}
                      onClick={(e) => { e.stopPropagation(); setOpenAssigneePostId((cur) => (cur === post.id ? null : post.id)); }}
                      className="relative w-8 h-8 rounded-full flex items-center justify-center text-white font-label-caps text-[10px] font-bold flex-shrink-0 shadow-xs cursor-pointer hover:ring-2 hover:ring-[#4f46e5] hover:ring-offset-1 transition-all"
                      style={{ backgroundColor: bgColor }}
                      title={`Assigned to: ${post.assignees.join(', ') || 'nobody'} (tap to change)`}
                    >
                      {initials}
                      {extraAssignees > 0 && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1b1c1a] text-white text-[8px] font-bold flex items-center justify-center border border-white">
                          +{extraAssignees}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {(() => {
        const openPost = openAssigneePostId ? selectedDayPosts.find((p: Post) => p.id === openAssigneePostId) : null;
        if (!openPost) return null;
        return (
          <AssigneePopover
            post={openPost}
            teamMembers={teamMembers}
            activeTeammate={activeTeammate}
            isOpen
            onClose={() => setOpenAssigneePostId(null)}
            anchorRef={{ current: assigneeTriggerRefs.current.get(openPost.id) || null }}
            onSavePost={(updated) => onSavePost?.(updated)}
          />
        );
      })()}
    </div>
  );
};
