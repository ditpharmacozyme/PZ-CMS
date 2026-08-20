import React from 'react';
import { Post, TeamMember } from '../../types';
import { toDateStr, todayStr } from '../../utils/date';
import { PostCard } from './PostCard';

interface CalendarWeekViewProps {
  weekStart: Date;
  setWeekStart: (updater: (prev: Date) => Date) => void;
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
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  weekStart,
  setWeekStart,
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
  currentUserName
}) => {
  return (
    <div className="hidden md:block">
      {/* Week duplicate forward bar */}
      <div className="p-3 bg-[#f7f6f2] border-b border-[#e5e4de] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onDuplicateWeekForward}
            className="flex items-center gap-1.5 bg-white border border-[#bfcab4] hover:bg-[#efeeea] text-[#1b1c1a] font-label-caps text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm text-[#296c00]">content_copy</span>
            <span>Duplicate Week → Next Week</span>
          </button>
          <label className="flex items-center gap-1.5 text-xs text-[#707a67] cursor-pointer">
            <input
              type="checkbox"
              checked={clearCaptionsOnDuplicate}
              onChange={(e) => onSetClearCaptionsOnDuplicate(e.target.checked)}
              className="w-3.5 h-3.5 text-[#296c00] border-[#bfcab4] rounded focus:ring-[#296c00]"
            />
            <span className="font-label-caps text-[11px]">Clear captions when duplicating</span>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart((prev) => new Date(prev.getTime() - 7 * 86400000))}
            className="p-1.5 bg-white border border-[#bfcab4] rounded-lg text-[#707a67] hover:text-[#1b1c1a] hover:bg-[#efeeea] transition-all cursor-pointer"
            title="Previous week"
          >
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const day = now.getDay();
              const diff = now.getDate() - day + (day === 0 ? -6 : 1);
              setWeekStart(() => new Date(now.setDate(diff)));
            }}
            className="px-2.5 py-1 bg-white border border-[#bfcab4] rounded-lg text-xs font-label-caps font-bold text-[#1b1c1a] hover:bg-[#efeeea] transition-all cursor-pointer"
          >
            This Week
          </button>
          <button
            onClick={() => setWeekStart((prev) => new Date(prev.getTime() + 7 * 86400000))}
            className="p-1.5 bg-white border border-[#bfcab4] rounded-lg text-[#707a67] hover:text-[#1b1c1a] hover:bg-[#efeeea] transition-all cursor-pointer"
            title="Next week"
          >
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2 p-3 bg-white">
        {Array.from({ length: 7 }, (_, i) => {
          const dayDate = new Date(weekStart);
          dayDate.setDate(dayDate.getDate() + i);
          const dateStr = toDateStr(dayDate);
          const dayPosts = postsByDate[dateStr] || [];
          const isToday = dateStr === todayIso;

          return (
            <div
              key={i}
              data-date-cell={dateStr}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
              }}
              onDrop={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
                onDropOnCell(e, dateStr);
              }}
              className={`p-2.5 border rounded-xl min-h-[220px] flex flex-col transition-all ${
                isToday ? 'bg-white border-[#296c00] ring-1 ring-[#296c00]/30' : 'bg-[#faf9f5] border-[#e5e4de]'
              } ${touchHoverDate === dateStr ? 'ring-2 ring-[#296c00] bg-[#f0fae8]' : ''}`}
            >
              {/* Day Header */}
              <div className="pb-1.5 mb-2 border-b border-[#e5e4de] flex justify-between items-center flex-shrink-0">
                <span className={`font-label-caps text-xs font-bold ${isToday ? 'text-[#296c00]' : 'text-[#1b1c1a]'}`}>
                  {dayDate.toLocaleDateString('default', { weekday: 'short' })} {dayDate.getDate()}
                </span>
                <button
                  onClick={() => onOpenNewPostModal(dateStr)}
                  className="text-[#296c00] hover:bg-[#efeeea] p-1 rounded-lg flex items-center justify-center cursor-pointer"
                  title="Add post"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              </div>

              {/* Post Stack */}
              <div className="space-y-1.5 flex-1">
                {dayPosts.map((post: Post) => (
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
                    variant="week"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
