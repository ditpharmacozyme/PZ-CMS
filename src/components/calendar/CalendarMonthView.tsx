import React, { useState } from 'react';
import { Post, TeamMember } from '../../types';
import { BRANDS } from '../../data/brands';
import { PostCard } from './PostCard';

interface CalendarCell {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
}

interface CalendarMonthViewProps {
  calendarCells: CalendarCell[];
  postsByDate: Record<string, any[]>;
  todayIso: string;
  touchHoverDate: string | null;
  selectedPostIds: Set<string>;
  isSelectMode: boolean;
  isMobileDevice: boolean;
  onSelectPost: (post: Post) => void;
  onOpenNewPostModal: (date?: string) => void;
  onDropOnCell: (e: React.DragEvent, dateStr: string) => void;
  onToggleSelect: (postId: string, e: React.MouseEvent | React.ChangeEvent) => void;
  onPlaceholderClick: (post: any) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>, post?: Post, dateStr?: string) => void;
  teamMembers: TeamMember[];
  onSavePost?: (post: Post) => void;
  currentUserName?: string;
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  calendarCells,
  postsByDate,
  todayIso,
  touchHoverDate,
  selectedPostIds,
  isSelectMode,
  isMobileDevice,
  onSelectPost,
  onOpenNewPostModal,
  onDropOnCell,
  onToggleSelect,
  onPlaceholderClick,
  onImageUpload,
  teamMembers,
  onSavePost,
  currentUserName
}) => {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  return (
    <div className="hidden md:block">
      {/* Day of Week Header Row */}
      <div className="grid grid-cols-7 border-b border-[#e5e4de] bg-[#f7f6f2]">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
          <div
            key={d}
            className="py-2.5 text-center font-label-caps text-[11px] font-bold text-[#707a67] tracking-wider border-r border-[#e5e4de] last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar 7-Column Grid */}
      <div className="grid grid-cols-7 bg-[#e5e4de] gap-[1px]">
        {calendarCells.map((cell, idx) => {
          const dayPosts = cell.dateStr ? postsByDate[cell.dateStr] || [] : [];
          const distinctBrands = new Set(dayPosts.map((p) => p.brandId));
          const isCollision = distinctBrands.size > 1;
          const isToday = cell.dateStr === todayIso;
          const isExpanded = expandedDate === cell.dateStr;

          // Show up to 3 posts in regular mode, or all when expanded
          const visiblePosts = isExpanded ? dayPosts : dayPosts.slice(0, 3);
          const hiddenCount = Math.max(0, dayPosts.length - 3);

          return (
            <div
              key={idx}
              data-date-cell={cell.dateStr || ''}
              onClick={() => {
                if (!cell.dateStr) return;
                onOpenNewPostModal(cell.dateStr);
              }}
              onDragOver={(e) => {
                if (cell.dateStr) {
                  e.preventDefault();
                  e.currentTarget.classList.add('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
              }}
              onDrop={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-[#296c00]', 'bg-[#f0fae8]');
                if (cell.dateStr) onDropOnCell(e, cell.dateStr);
              }}
              className={`min-h-[125px] lg:min-h-[145px] p-2 bg-white flex flex-col justify-between transition-colors relative group cursor-pointer ${
                !cell.isCurrentMonth ? 'bg-[#faf9f5]/70 opacity-40' : 'hover:bg-[#faf9f5]'
              } ${isToday ? 'bg-[#f7faf4] ring-1.5 ring-[#296c00] ring-inset' : ''} ${
                touchHoverDate && touchHoverDate === cell.dateStr ? 'ring-2 ring-[#296c00] bg-[#f0fae8]' : ''
              }`}
            >
              {/* Date Header: Date Number + Brand Collisions + Quick Actions */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-label-caps text-xs font-bold transition-all ${
                      isToday
                        ? 'bg-[#296c00] text-white w-5 h-5 rounded-full inline-flex items-center justify-center shadow-xs'
                        : cell.isCurrentMonth
                        ? 'text-[#1b1c1a]'
                        : 'text-[#9ca3af]'
                    }`}
                  >
                    {cell.dayNum}
                  </span>

                  {isCollision && (
                    <span
                      className="font-label-caps text-[8px] bg-[#f3f2ee] border border-[#bfcab4] text-[#404a39] px-1 py-0.2 rounded font-bold"
                      title={`${distinctBrands.size} brands posting on this day`}
                    >
                      {distinctBrands.size} brands
                    </span>
                  )}
                </div>

                {/* Quick Add Icons on Hover */}
                {cell.dateStr && (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 hover:bg-[#efeeea] text-[#707a67] hover:text-[#296c00] rounded cursor-pointer transition-colors"
                      title="Upload image directly to this date"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        add_photo_alternate
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onImageUpload(e, undefined, cell.dateStr)}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNewPostModal(cell.dateStr);
                      }}
                      className="p-1 hover:bg-[#efeeea] text-[#707a67] hover:text-[#296c00] rounded transition-colors"
                      title="Add new post"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        add
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Post Card Stack */}
              <div className="space-y-1 flex-1 min-w-0">
                {visiblePosts.map((post) => (
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
                    onPlaceholderClick={onPlaceholderClick}
                    onQuickUpdatePost={onSavePost}
                    currentUserName={currentUserName}
                    variant="month"
                  />
                ))}

                {/* Expand / Collapse "+ N more" button */}
                {hiddenCount > 0 && !isExpanded && (
                  <button
                    className="w-full text-center py-0.5 bg-[#f3f2ee] hover:bg-[#e4e2db] text-[#404a39] font-label-caps text-[9px] font-bold rounded transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDate(cell.dateStr);
                    }}
                  >
                    +{hiddenCount} more
                  </button>
                )}
                {isExpanded && hiddenCount > 0 && (
                  <button
                    className="w-full text-center py-0.5 bg-[#f3f2ee] hover:bg-[#e4e2db] text-[#404a39] font-label-caps text-[9px] font-bold rounded transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDate(null);
                    }}
                  >
                    Show less
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
