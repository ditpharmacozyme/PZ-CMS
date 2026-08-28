import React, { useState } from 'react';
import { Post, TeamMember } from '../../types';
import { BRANDS } from '../../data/brands';
import { getDayBrandSummary } from '../../utils/brandConflicts';
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
  /** Inline "type a title on the day" capture. When set, a plain click on a
   *  day opens an in-cell input instead of launching the full wizard (still
   *  reachable via the hover + button). */
  onInlineCreate?: (title: string, dateStr: string) => void;
  onDropOnCell: (e: React.DragEvent, dateStr: string) => void;
  onToggleSelect: (postId: string, e: React.MouseEvent | React.ChangeEvent) => void;
  onPlaceholderClick: (post: any) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>, post?: Post, dateStr?: string) => void;
  teamMembers: TeamMember[];
  onSavePost?: (post: Post) => void;
  currentUserName?: string;
  activeTeammate?: TeamMember | null;
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
  onInlineCreate,
  onDropOnCell,
  onToggleSelect,
  onPlaceholderClick,
  onImageUpload,
  teamMembers,
  onSavePost,
  currentUserName,
  activeTeammate
}) => {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [inlineDate, setInlineDate] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');

  const openCell = (dateStr: string) => {
    if (onInlineCreate) {
      setInlineDate(dateStr);
      setInlineTitle('');
    } else {
      onOpenNewPostModal(dateStr);
    }
  };

  const commitInline = (dateStr: string) => {
    const t = inlineTitle.trim();
    if (t && onInlineCreate) onInlineCreate(t, dateStr);
    setInlineDate(null);
    setInlineTitle('');
  };

  return (
    <div className="hidden md:block">
      {/* Day of Week Header Row */}
      <div className="grid grid-cols-7 border-b border-[#efefed] bg-[#f4f4f3]">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
          <div
            key={d}
            className="py-2.5 text-center font-label-caps text-[11px] font-bold text-[#5f5f5b] tracking-wider border-r border-[#efefed] last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar 7-Column Grid */}
      <div className="grid grid-cols-7 bg-[#efefed] gap-[1px]">
        {calendarCells.map((cell, idx) => {
          const dayPosts = cell.dateStr ? postsByDate[cell.dateStr] || [] : [];
          const brandSummary = getDayBrandSummary(dayPosts);
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
                openCell(cell.dateStr);
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
                !cell.isCurrentMonth ? 'bg-[#f4f4f3]/70 opacity-40' : 'hover:bg-[#f4f4f3]'
              } ${isToday ? 'bg-[#f7faf4] ring-1.5 ring-[#296c00] ring-inset' : ''} ${
                touchHoverDate && touchHoverDate === cell.dateStr ? 'ring-2 ring-[#296c00] bg-[#f0fae8]' : ''
              }`}
            >
              {/* Date Header: Date Number + Brand Pips + Collisions + Time Clashes */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
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

                  {/* Brand Color Dots for scheduled posts */}
                  {brandSummary.distinctBrandIds.length > 0 && (
                    <div className="flex items-center -space-x-1" title={brandSummary.brandNames.join(', ')}>
                      {brandSummary.distinctBrandIds.map((bId) => (
                        <span
                          key={bId}
                          className="w-2 h-2 rounded-full ring-1 ring-white"
                          style={{ backgroundColor: BRANDS[bId]?.primaryColor || '#296c00' }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Multi-Brand Collision Pill */}
                  {brandSummary.hasCollision && (
                    <span
                      className="font-label-caps text-[8px] bg-[#f1f1f0] border border-[#e9e9e7] text-[#57574f] px-1 py-0.2 rounded font-bold"
                      title={`${brandSummary.brandCount} brands scheduled: ${brandSummary.brandNames.join(', ')}`}
                    >
                      {brandSummary.brandCount} brands
                    </span>
                  )}

                  {/* Time Clash Alert Pip */}
                  {brandSummary.timeClashes.length > 0 && (
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#fcebeb] text-[#dc2626] text-[10px] font-bold"
                      title={`Time conflict: ${brandSummary.timeClashes.map((c) => c.time).join(', ')}`}
                    >
                      ⚠️
                    </span>
                  )}
                </div>

                {/* Quick Add Icons on Hover */}
                {cell.dateStr && (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 hover:bg-[#f1f1f0] text-[#5f5f5b] hover:text-[#296c00] rounded cursor-pointer transition-colors"
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
                      className="p-1 hover:bg-[#f1f1f0] text-[#5f5f5b] hover:text-[#296c00] rounded transition-colors"
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
                {inlineDate === cell.dateStr && (
                  <input
                    autoFocus
                    type="text"
                    value={inlineTitle}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setInlineTitle(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') { e.preventDefault(); commitInline(cell.dateStr); }
                      else if (e.key === 'Escape') { e.preventDefault(); setInlineDate(null); setInlineTitle(''); }
                    }}
                    onBlur={() => commitInline(cell.dateStr)}
                    placeholder="Title, then Enter…"
                    className="w-full text-[11px] px-1.5 py-1 border border-[#296c00] rounded bg-white text-[#1b1c1a] focus:outline-none focus:ring-1 focus:ring-[#296c00]"
                  />
                )}
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
                    teamMembers={teamMembers}
                    activeTeammate={activeTeammate}
                    variant="month"
                  />
                ))}

                {/* Expand / Collapse "+ N more" button */}
                {hiddenCount > 0 && !isExpanded && (
                  <button
                    className="w-full text-center py-0.5 bg-[#f1f1f0] hover:bg-[#e9e9e7] text-[#57574f] font-label-caps text-[9px] font-bold rounded transition-colors"
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
                    className="w-full text-center py-0.5 bg-[#f1f1f0] hover:bg-[#e9e9e7] text-[#57574f] font-label-caps text-[9px] font-bold rounded transition-colors"
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
