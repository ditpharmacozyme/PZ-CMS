import React, { useState } from 'react';
import { Post, TeamMember } from '../../types';
import { useBrands } from '../../context/BrandsContext';
import { toDateStr, todayStr } from '../../utils/date';
import { getDayBrandSummary } from '../../utils/brandConflicts';
import { PostCard } from './PostCard';

const WEEK_CAP = 4;

interface CalendarWeekViewProps {
  weekStart: Date;
  postsByDate: Record<string, any[]>;
  todayIso: string;
  touchHoverDate: string | null;
  selectedPostIds: Set<string>;
  isSelectMode: boolean;
  isMobileDevice: boolean;
  clearCaptionsOnDuplicate: boolean;
  onSetClearCaptionsOnDuplicate: (val: boolean) => void;
  onDuplicateWeekForward: () => void;
  onDropOnCell: (e: React.DragEvent, dateStr: string) => void;
  onSelectPost: (post: Post) => void;
  onOpenNewPostModal: (date?: string) => void;
  onToggleSelect: (postId: string, e: React.MouseEvent | React.ChangeEvent) => void;
  teamMembers: TeamMember[];
  onSavePost?: (post: Post) => void;
  currentUserName?: string;
  activeTeammate?: TeamMember | null;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  weekStart,
  postsByDate,
  todayIso,
  touchHoverDate,
  selectedPostIds,
  isSelectMode,
  isMobileDevice,
  clearCaptionsOnDuplicate,
  onSetClearCaptionsOnDuplicate,
  onDuplicateWeekForward,
  onDropOnCell,
  onSelectPost,
  onOpenNewPostModal,
  onToggleSelect,
  teamMembers,
  onSavePost,
  currentUserName,
  activeTeammate
}) => {
  // Period navigation lives once, in CalendarHeader -- this view used to
  // render its own second prev / This Week / next cluster on top of it.
  const { brands } = useBrands();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  return (
    <div className="hidden md:block">
      {/* Week duplicate forward bar */}
      <div className="p-3 bg-[#f4f4f3] border-b border-[#efefed] flex flex-wrap items-center gap-3">
        <button
          onClick={onDuplicateWeekForward}
          className="flex items-center gap-1.5 bg-white border border-[#e9e9e7] hover:bg-[#f1f1f0] text-[#1b1c1a] font-label-caps text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm text-[#4f46e5]">content_copy</span>
          <span>Duplicate Week → Next Week</span>
        </button>
        <label className="flex items-center gap-1.5 text-xs text-[#5f5f5b] cursor-pointer">
          <input
            type="checkbox"
            checked={clearCaptionsOnDuplicate}
            onChange={(e) => onSetClearCaptionsOnDuplicate(e.target.checked)}
            className="w-3.5 h-3.5 text-[#4f46e5] border-[#e9e9e7] rounded focus:ring-[#4f46e5]"
          />
          <span className="font-label-caps text-[11px]">Clear captions when duplicating</span>
        </label>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2 p-3 bg-white">
        {Array.from({ length: 7 }, (_, i) => {
          const dayDate = new Date(weekStart);
          dayDate.setDate(dayDate.getDate() + i);
          const dateStr = toDateStr(dayDate);
          const dayPosts = postsByDate[dateStr] || [];
          const brandSummary = getDayBrandSummary(dayPosts, brands);
          const isToday = dateStr === todayIso;
          const isExpanded = expandedDate === dateStr;
          const visiblePosts = isExpanded ? dayPosts : dayPosts.slice(0, WEEK_CAP);
          const hiddenCount = Math.max(0, dayPosts.length - WEEK_CAP);

          return (
            <div
              key={i}
              data-date-cell={dateStr}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('ring-2', 'ring-[#4f46e5]', 'bg-[#eef2ff]');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-[#4f46e5]', 'bg-[#eef2ff]');
              }}
              onDrop={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-[#4f46e5]', 'bg-[#eef2ff]');
                onDropOnCell(e, dateStr);
              }}
              className={`p-2.5 border rounded-xl min-h-[220px] flex flex-col transition-all ${
                isToday ? 'bg-white border-[#4f46e5] ring-1 ring-[#4f46e5]/30' : 'bg-[#f4f4f3] border-[#efefed]'
              } ${touchHoverDate === dateStr ? 'ring-2 ring-[#4f46e5] bg-[#eef2ff]' : ''}`}
            >
              {/* Day Header */}
              <div className="pb-1.5 mb-2 border-b border-[#efefed] flex justify-between items-center flex-shrink-0 gap-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className={`font-label-caps text-xs font-bold ${isToday ? 'text-[#4f46e5]' : 'text-[#1b1c1a]'}`}>
                    {dayDate.toLocaleDateString('default', { weekday: 'short' })} {dayDate.getDate()}
                  </span>

                  {/* Brand Color Dots */}
                  {brandSummary.distinctBrandIds.length > 0 && (
                    <div className="flex items-center -space-x-1" title={brandSummary.brandNames.join(', ')}>
                      {brandSummary.distinctBrandIds.map((bId) => (
                        <span
                          key={bId}
                          className="w-2 h-2 rounded-full ring-1 ring-white"
                          style={{ backgroundColor: brands[bId]?.primaryColor || '#4f46e5' }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Multi-Brand Collision Pill */}
                  {brandSummary.hasCollision && (
                    <span
                      className="font-label-caps text-[8px] bg-[#f1f1f0] border border-[#e9e9e7] text-[#57574f] px-1 py-0.2 rounded font-bold"
                      title={`${brandSummary.brandCount} brands scheduled`}
                    >
                      {brandSummary.brandCount}b
                    </span>
                  )}

                  {/* Time Clash Alert Pip */}
                  {brandSummary.timeClashes.length > 0 && (
                    <span
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#fcebeb] text-[#dc2626] text-[9px] font-bold"
                      title={`Time conflict: ${brandSummary.timeClashes.map((c) => c.time).join(', ')}`}
                    >
                      ⚠️
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onOpenNewPostModal(dateStr)}
                  className="text-[#4f46e5] hover:bg-[#f1f1f0] p-1 rounded-lg flex items-center justify-center cursor-pointer flex-shrink-0"
                  title="Add post"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              </div>

              {/* Post Stack */}
              <div className="space-y-1.5 flex-1">
                {visiblePosts.map((post: Post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isSelected={selectedPostIds.has(post.id)}
                    isSelectMode={isSelectMode}
                    isMobileDevice={isMobileDevice}
                    onSelectPost={(p, e) => {
                      e.stopPropagation();
                      onSelectPost(p);
                    }}
                    onToggleSelect={onToggleSelect}
                    onQuickUpdatePost={onSavePost}
                    currentUserName={currentUserName}
                    teamMembers={teamMembers}
                    activeTeammate={activeTeammate}
                    variant="week"
                  />
                ))}
                {hiddenCount > 0 && (
                  <button
                    className="w-full text-center py-0.5 bg-[#f1f1f0] hover:bg-[#e9e9e7] text-[#57574f] font-label-caps text-[9px] font-bold rounded transition-colors"
                    onClick={() => setExpandedDate(isExpanded ? null : dateStr)}
                  >
                    {isExpanded ? 'Show less' : `+${hiddenCount} more`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
